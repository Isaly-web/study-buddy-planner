import { describe, expect, it } from "vitest";
import {
  isAuthorized,
  isExpired,
  purgeExpiredScreenshots,
  screenshotCutoff,
  type StorageAdmin,
} from "./feedback-screenshot-retention.server";

const UID = "11111111-1111-1111-1111-111111111111";
const now = new Date("2026-11-04T00:00:00Z");

function fake() {
  const removed: string[] = [];
  const admin: StorageAdmin & { removed: string[] } = {
    removed,
    storage: {
      from: () => ({
        list: async (p: string) =>
          p === ""
            ? {
                data: [
                  { name: UID, id: null },
                  { name: "not-a-uuid", id: null },
                ],
                error: null,
              }
            : {
                data: [
                  { name: "old.png", id: "1", created_at: "2025-06-01T00:00:00Z" },
                  { name: "new.png", id: "2", created_at: "2026-09-01T00:00:00Z" },
                  { name: "unknown.png", id: "3", created_at: null },
                ],
                error: null,
              },
        remove: async (paths: string[]) => (removed.push(...paths), { error: null }),
      }),
    },
  };
  return admin;
}

describe("screenshot retention", () => {
  it("cutoff is 12 months back", () => {
    expect(screenshotCutoff(now).toISOString()).toBe("2025-11-04T00:00:00.000Z");
  });
  it("unknown age is never expired", () => {
    const c = screenshotCutoff(now);
    expect(isExpired(null, c)).toBe(false);
    expect(isExpired("junk", c)).toBe(false);
    expect(isExpired("2025-01-01T00:00:00Z", c)).toBe(true);
  });
  it("removes only old files", async () => {
    const a = fake();
    const r = await purgeExpiredScreenshots(a, { dryRun: false, now });
    expect(a.removed).toEqual([`${UID}/old.png`]);
    expect(r.deletedFiles).toBe(1);
  });
  it("dry run removes nothing", async () => {
    const a = fake();
    const r = await purgeExpiredScreenshots(a, { dryRun: true, now });
    expect(r.deletedFiles).toBe(1);
    expect(a.removed.length).toBe(0);
  });
  it("only the service-role key is accepted", () => {
    const req = (t: string) =>
      new Request("http://x", { headers: { authorization: `Bearer ${t}` } });
    expect(isAuthorized(req("secret"), "secret")).toBe(true);
    expect(isAuthorized(req("other"), "secret")).toBe(false);
    expect(isAuthorized(req("secret"), undefined)).toBe(false);
    expect(isAuthorized(new Request("http://x"), "secret")).toBe(false);
  });
});
