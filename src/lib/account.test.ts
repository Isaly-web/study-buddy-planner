import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deleteMyData, PHOTO_BUCKETS } from "./account";

type Entry = { name: string; id: string | null };

function makeClient(tree: Record<string, Entry[]>, opts: { removeError?: boolean } = {}) {
  const calls: string[] = [];
  const client = {
    rpc: async (fn: string) => {
      calls.push(`rpc:${fn}`);
      return { data: null, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        list: async (path: string, o: { limit: number; offset: number }) => {
          const entries = tree[`${bucket}/${path}`] ?? [];
          return { data: entries.slice(o.offset, o.offset + o.limit), error: null };
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${bucket}:${paths.join(",")}`);
          return { error: opts.removeError ? new Error("nope") : null };
        },
      }),
    },
    auth: {
      signOut: async (o?: { scope?: string }) => {
        calls.push(`signOut:${o?.scope}`);
      },
    },
  };
  return { client: client as never, calls };
}

describe("deleteMyData", () => {
  it("removes screenshots (also in sub-folders), then deletes the rows, then signs out locally", async () => {
    const { client, calls } = makeClient({
      "feedback-screenshots/u1": [
        { name: "a.png", id: "x" },
        { name: "sub", id: null },
      ],
      "feedback-screenshots/u1/sub": [{ name: "b.png", id: "y" }],
    });
    await deleteMyData(client, "u1");
    expect(calls).toEqual([
      "remove:feedback-screenshots:u1/a.png,u1/sub/b.png",
      "rpc:delete_account_app_data",
      "signOut:local",
    ]);
  });

  it("still deletes the rows when there are no files", async () => {
    const { client, calls } = makeClient({});
    await deleteMyData(client, "u1");
    expect(calls).toEqual(["rpc:delete_account_app_data", "signOut:local"]);
  });

  it("deletes no rows and does not sign out when the files cannot be removed", async () => {
    const { client, calls } = makeClient(
      { "feedback-screenshots/u1": [{ name: "a.png", id: "x" }] },
      { removeError: true },
    );
    await expect(deleteMyData(client, "u1")).rejects.toThrow();
    expect(calls.some((c) => c.startsWith("rpc:") || c.startsWith("signOut"))).toBe(false);
  });
});

describe("migrations", () => {
  const dir = join(__dirname, "../../supabase/migrations");
  const sqls = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
  const fn = readFileSync(join(dir, "20261105120000_delete_account_app_data.sql"), "utf8").replace(
    /--.*$/gm,
    "",
  );

  it("covers every storage bucket the migrations create", () => {
    const buckets = [
      ...sqls.join("\n").matchAll(/insert into storage\.buckets[^;]*?values \('([\w-]+)'/gi),
    ].map((m) => m[1]);
    expect(buckets.length).toBeGreaterThan(0);
    for (const b of buckets) expect(PHOTO_BUCKETS as readonly string[]).toContain(b);
  });

  it("never touches auth.users", () => {
    expect(fn).not.toMatch(/auth\.users/i);
  });

  it("covers every study_buddy_planner table that has a user column", () => {
    const tables = new Set<string>();
    for (const sql of sqls) {
      for (const m of sql.matchAll(
        /create table (?:if not exists )?study_buddy_planner\.(\w+)\s*\(([\s\S]*?)\n\);/gi,
      )) {
        if (/\buser_id\b|references auth\.users/i.test(m[2]!)) tables.add(m[1]!);
      }
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const t of tables)
      expect(fn, `missing ${t}`).toMatch(new RegExp(`study_buddy_planner\\.${t}\\b`, "i"));
  });
});
