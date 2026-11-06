// "Radera mina uppgifter": deletes the signed-in person's Studieplan data and nothing else.
//
// 1. The person's feedback screenshots in the private bucket `feedback-screenshots` (folder =
//    user id, see supabase/migrations/20260911173419_feedback_screenshots_bucket.sql) are removed
//    first, with the person's own session. SQL cannot do this: deleting storage.objects rows
//    leaves the files in the object store. If this step fails nothing else is deleted, so the
//    person can simply try again.
// 2. study_buddy_planner.delete_account_app_data() (supabase/migrations/20261105120000_*.sql)
//    deletes the rows in one transaction.
// 3. The shared Isaly login (auth.users) is NEVER deleted from here: it is shared by every Isaly
//    app. Signing out uses scope "local" so the person stays signed in in the other Isaly apps.
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKETS = ["feedback-screenshots"] as const;

const LIST_PAGE = 100;
const REMOVE_BATCH = 100;

type StorageApi = {
  list: (
    path: string,
    opts: { limit: number; offset: number },
  ) => Promise<{ data: Array<{ name: string; id: string | null }> | null; error: unknown }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};

type Client = {
  rpc: SupabaseClient["rpc"];
  storage: { from: (bucket: string) => StorageApi };
  auth: { signOut: (opts?: { scope?: "local" | "global" | "others" }) => Promise<unknown> };
};

/** Every file path under `<prefix>/`, including files in sub-folders. */
async function listFiles(storage: StorageApi, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await storage.list(prefix, { limit: LIST_PAGE, offset });
    if (error) throw error;
    const entries = data ?? [];
    for (const entry of entries) {
      // Folders come back without an id.
      if (entry.id === null) files.push(...(await listFiles(storage, `${prefix}/${entry.name}`)));
      else files.push(`${prefix}/${entry.name}`);
    }
    if (entries.length < LIST_PAGE) return files;
  }
}

export async function deleteMyData(client: Client, userId: string): Promise<void> {
  for (const bucket of PHOTO_BUCKETS) {
    const storage = client.storage.from(bucket);
    const files = await listFiles(storage, userId);
    for (let i = 0; i < files.length; i += REMOVE_BATCH) {
      const { error } = await storage.remove(files.slice(i, i + REMOVE_BATCH));
      if (error) throw error;
    }
  }

  const { error } = await client.rpc("delete_account_app_data" as never);
  if (error) throw new Error((error as { message: string }).message);

  await client.auth.signOut({ scope: "local" });
}
