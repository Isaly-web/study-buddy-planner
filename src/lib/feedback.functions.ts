import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const HUB_BASE = "https://feedback.isaly.se";

function getKey(): string {
  const key = process.env.FEEDBACK_HUB_API_KEY;
  if (!key) throw new Error("Feedback Hub saknar API-nyckel.");
  return key;
}

async function getUserEmail(supabase: {
  auth: { getUser: () => Promise<{ data: { user: { email?: string | null } | null } }> };
}): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new Error("Din e-post kunde inte hittas.");
  return email;
}

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        message: z.string().trim().min(1).max(4000),
        category: z.enum(["bug", "suggestion", "other"]),
        page_url: z.string().trim().max(500).optional().nullable(),
        os: z.string().trim().max(120).optional().nullable(),
        device: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = await getUserEmail(context.supabase);
    const res = await fetch(`${HUB_BASE}/api/public/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: getKey(),
        message: data.message,
        category: data.category,
        user_identifier: email,
        page_url: data.page_url ?? null,
        os: data.os ?? null,
        device: data.device ?? null,
      }),
    });
    if (!res.ok) {
      throw new Error("Kunde inte skicka feedback just nu.");
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true as const, id: body.id ?? null };
  });

export type FeedbackListItem = {
  id: string;
  message: string;
  category: string | null;
  status: string | null;
  created_at: string;
};

export const listMyFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackListItem[]> => {
    const email = await getUserEmail(context.supabase);
    const url = new URL(`${HUB_BASE}/api/public/feedback/mine`);
    url.searchParams.set("api_key", getKey());
    url.searchParams.set("user_identifier", email);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Kunde inte hämta feedback.");
    const body = (await res.json()) as unknown;
    const b = body as Record<string, unknown>;
    const raw = Array.isArray(body)
      ? (body as unknown[])
      : Array.isArray(b.feedback)
        ? (b.feedback as unknown[])
        : Array.isArray(b.items)
          ? (b.items as unknown[])
          : Array.isArray(b.data)
            ? (b.data as unknown[])
            : [];
    return raw.map((r) => {
      const x = r as Record<string, unknown>;
      return {
        id: String(x.id ?? ""),
        message: String(x.message ?? ""),
        category: (x.category as string | null | undefined) ?? null,
        status: (x.status as string | null | undefined) ?? null,
        created_at: String(x.created_at ?? x.createdAt ?? ""),
      };
    });
  });

export type FeedbackReply = {
  id: string;
  message: string;
  author: string | null;
  created_at: string;
};

export type FeedbackDetail = FeedbackListItem & {
  replies: FeedbackReply[];
  page_url?: string | null;
};

export const getMyFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }): Promise<FeedbackDetail> => {
    const email = await getUserEmail(context.supabase);
    const url = new URL(`${HUB_BASE}/api/public/feedback/mine/${encodeURIComponent(data.id)}`);
    url.searchParams.set("api_key", getKey());
    url.searchParams.set("user_identifier", email);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Kunde inte hämta feedback.");
    const body = (await res.json()) as Record<string, unknown>;
    const item =
      (body.feedback as Record<string, unknown> | undefined) ??
      body;
    const repliesRaw = Array.isArray(body.replies)
      ? (body.replies as unknown[])
      : Array.isArray(body.conversation)
        ? (body.conversation as unknown[])
        : Array.isArray(body.messages)
          ? (body.messages as unknown[])
          : [];
    const replies: FeedbackReply[] = repliesRaw.map((r) => {
      const x = r as Record<string, unknown>;
      return {
        id: String(x.id ?? crypto.randomUUID()),
        message: String(x.message ?? x.body ?? x.content ?? ""),
        author: (x.author as string | null | undefined) ?? (x.author_role as string | null | undefined) ?? null,
        created_at: String(x.created_at ?? x.createdAt ?? ""),
      };
    });
    return {
      id: String(item.id ?? data.id),
      message: String(item.message ?? ""),
      category: (item.category as string | null | undefined) ?? null,
      status: (item.status as string | null | undefined) ?? null,
      created_at: String(item.created_at ?? item.createdAt ?? ""),
      page_url: (item.page_url as string | null | undefined) ?? null,
      replies,
    };
  });