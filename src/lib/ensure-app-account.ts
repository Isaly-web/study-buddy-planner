// Makes sure the signed-in user has the row this app needs: a study_buddy_planner.profiles row.
// The work is done by the Postgres function study_buddy_planner.ensure_app_account()
// (supabase/migrations/20261103120000_ensure_app_account.sql), which is idempotent and acts only
// on auth.uid(), so this file knows nothing about what an account consists of.
//
// Why it exists: auth.users is shared by every Isaly app, and no app may put a trigger on it
// (Isaly App Foundation). A person who created their login in another app, or who deleted their
// data here and signs in again, has no profile until this runs.
//
// Called once per page load and user (the result is memoised) from
// src/routes/_authenticated/route.tsx. The memo is cleared on sign-out (see src/routes/__root.tsx),
// otherwise a new sign-in in the same tab would skip the call.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureAppAccountResult = {
  profile_created: boolean;
};

type RpcClient = Pick<SupabaseClient, "rpc">;

const ensured = new Map<string, Promise<EnsureAppAccountResult | null>>();

async function callEnsure(client: RpcClient): Promise<EnsureAppAccountResult | null> {
  const { data, error } = await client.rpc("ensure_app_account" as never);
  if (error) throw new Error(error.message);
  return (data ?? null) as EnsureAppAccountResult | null;
}

/**
 * Runs ensure_app_account() at most once per user until resetAppAccountBootstrap() is called.
 * Concurrent callers share one request. Never throws: an error is logged and the next call tries
 * again, so a network blip neither locks the user out nor blocks the app.
 */
export function ensureAppAccount(
  client: RpcClient,
  userId: string,
): Promise<EnsureAppAccountResult | null> {
  const existing = ensured.get(userId);
  if (existing) return existing;

  const pending = callEnsure(client).catch((err: unknown) => {
    ensured.delete(userId);
    console.error("[ensure-app-account] could not ensure the profile", err);
    return null;
  });
  ensured.set(userId, pending);
  return pending;
}

/** Cleared on sign-out so the next sign-in (even by the same user) runs the call again. */
export function resetAppAccountBootstrap(): void {
  ensured.clear();
}
