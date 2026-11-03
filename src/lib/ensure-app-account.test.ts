import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAppAccount, resetAppAccountBootstrap } from "./ensure-app-account";

// ensure_app_account() in Postgres does the real work; this file tests the client's own logic:
// the RPC is called correctly, once per user and session, concurrent callers share one request,
// an error never blocks the app but allows a retry, and sign-out resets the memo.

function makeClient(
  calls: string[],
  results: Array<{ data?: unknown; error?: { message: string } | null }>,
) {
  let i = 0;
  return {
    rpc: async (fn: string, ...rest: unknown[]) => {
      calls.push(`rpc:${fn}${rest.length ? `:${JSON.stringify(rest)}` : ""}`);
      const r = results[Math.min(i++, results.length - 1)] ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
  } as never;
}

const created = { profile_created: true };
const existing = { profile_created: false };

describe("ensureAppAccount", () => {
  beforeEach(() => resetAppAccountBootstrap());

  it("calls ensure_app_account without arguments (the function acts on auth.uid())", async () => {
    const calls: string[] = [];
    const res = await ensureAppAccount(makeClient(calls, [{ data: created }]), "u1");
    expect(res).toEqual(created);
    expect(calls).toEqual(["rpc:ensure_app_account"]);
  });

  it("runs only once per user until sign-out", async () => {
    const calls: string[] = [];
    const client = makeClient(calls, [{ data: created }, { data: existing }]);
    await ensureAppAccount(client, "u1");
    await ensureAppAccount(client, "u1");
    await ensureAppAccount(client, "u1");
    expect(calls).toHaveLength(1);
  });

  it("concurrent callers share a single request", async () => {
    const calls: string[] = [];
    const client = makeClient(calls, [{ data: created }]);
    const results = await Promise.all([
      ensureAppAccount(client, "u1"),
      ensureAppAccount(client, "u1"),
      ensureAppAccount(client, "u1"),
    ]);
    expect(calls).toHaveLength(1);
    expect(results).toEqual([created, created, created]);
  });

  it("different users in the same tab each get a call", async () => {
    const calls: string[] = [];
    const client = makeClient(calls, [{ data: created }]);
    await ensureAppAccount(client, "u1");
    await ensureAppAccount(client, "u2");
    expect(calls).toHaveLength(2);
  });

  it("an RPC error is logged, never thrown, and the next call retries", async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = makeClient(calls, [{ error: { message: "boom" } }, { data: created }]);

    expect(await ensureAppAccount(client, "u1")).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);

    expect(await ensureAppAccount(client, "u1")).toEqual(created);
    expect(calls).toHaveLength(2);
    spy.mockRestore();
  });

  it("resetAppAccountBootstrap makes the next call run again", async () => {
    const calls: string[] = [];
    const client = makeClient(calls, [{ data: created }, { data: existing }]);
    await ensureAppAccount(client, "u1");
    resetAppAccountBootstrap();
    await ensureAppAccount(client, "u1");
    expect(calls).toHaveLength(2);
  });
});
