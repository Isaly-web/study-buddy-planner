// Retention of feedback screenshots (backlog B3). A screenshot is attached once to a feedback
// message and the Feedback Hub gets a signed URL that is valid for one year (feedback.functions.ts),
// so after SCREENSHOT_RETENTION_MONTHS the file has no purpose left and is deleted. This is
// age-based (per file), not inactivity-based: it is the only upload in this app, it is never
// shown again to the user, and the same rule is safe for every Isaly app sharing the bucket.
// Called by POST /api/public/hooks/purge-feedback-screenshots. Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// (constant time); the publishable key is public and never accepted. Body {"dryRun": true} only reports.
import { createHash, timingSafeEqual } from "node:crypto";

export const SCREENSHOT_RETENTION_MONTHS = 12;
const BUCKET = "feedback-screenshots";
const MAX_FOLDERS_PER_RUN = 200;
const MAX_FILES_PER_FOLDER = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function screenshotCutoff(now: Date, months = SCREENSHOT_RETENTION_MONTHS): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/** True only for a file whose creation time is known and older than the cutoff (fail closed). */
export function isExpired(createdAt: string | null | undefined, cutoff: Date): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t < cutoff.getTime();
}

export type PurgeResult = {
  ok: true;
  dryRun: boolean;
  checkedFolders: number;
  deletedFiles: number;
  failedFolders: number;
};

type StorageItem = { name: string; id: string | null; created_at?: string | null };
type StorageBucket = {
  list: (
    path: string,
    opts: { limit: number; sortBy?: { column: string; order: string } },
  ) => Promise<{ data: StorageItem[] | null; error: unknown }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};
export type StorageAdmin = { storage: { from: (bucket: string) => StorageBucket } };

export async function purgeExpiredScreenshots(
  admin: StorageAdmin,
  opts: { dryRun: boolean; now?: Date },
): Promise<PurgeResult> {
  const cutoff = screenshotCutoff(opts.now ?? new Date());
  const bucket = admin.storage.from(BUCKET);
  const result: PurgeResult = {
    ok: true,
    dryRun: opts.dryRun,
    checkedFolders: 0,
    deletedFiles: 0,
    failedFolders: 0,
  };
  const { data: folders, error } = await bucket.list("", {
    limit: MAX_FOLDERS_PER_RUN,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error("Could not list storage");
  for (const folder of folders ?? []) {
    if (!UUID.test(folder.name)) continue;
    result.checkedFolders++;
    try {
      const { data: files, error: lErr } = await bucket.list(folder.name, {
        limit: MAX_FILES_PER_FOLDER,
      });
      if (lErr) throw new Error("list failed");
      const expired = (files ?? [])
        .filter((f) => f.id && isExpired(f.created_at, cutoff))
        .map((f) => `${folder.name}/${f.name}`);
      if (expired.length === 0) continue;
      if (!opts.dryRun) {
        const { error: rErr } = await bucket.remove(expired);
        if (rErr) throw new Error("remove failed");
      }
      result.deletedFiles += expired.length;
    } catch {
      result.failedFolders++;
    }
  }
  return result;
}

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function isAuthorized(request: Request, serviceKey: string | undefined): boolean {
  if (!serviceKey) return false;
  const token = /^Bearer (.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  return !!token && sameSecret(token, serviceKey);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handlePurgeRequest(request: Request): Promise<Response> {
  if (!isAuthorized(request, process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return json({ error: "Unauthorized" }, 401);
  }
  let dryRun = false;
  try {
    dryRun = ((await request.json()) as { dryRun?: unknown })?.dryRun === true;
  } catch {
    /* empty body = real run */
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return json(
      await purgeExpiredScreenshots(supabaseAdmin as unknown as StorageAdmin, { dryRun }),
      200,
    );
  } catch {
    return json({ error: "Purge failed" }, 500);
  }
}
