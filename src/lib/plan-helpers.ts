// Pure date-classification/grouping logic for the unified Plan view
// (Phase 5). The Plan is a read view over existing `tasks` rows -- these
// helpers only decide which of three sections a task's day_date falls
// into, and how to group a list of tasks by date for display.

export type PlanBucket = "past" | "today" | "this-week" | "upcoming";

// Monday-start ISO week containing dateISO (YYYY-MM-DD strings compare
// lexicographically the same as chronologically, so no Date math is
// needed once we have the bounds).
export function getWeekStart(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const daysSinceMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

export function getWeekEnd(dateISO: string): string {
  const start = getWeekStart(dateISO);
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function classifyPlanDate(dateISO: string, todayISO: string): PlanBucket {
  if (dateISO === todayISO) return "today";
  const weekStart = getWeekStart(todayISO);
  const weekEnd = getWeekEnd(todayISO);
  if (dateISO < weekStart) return "past";
  if (dateISO <= weekEnd) return "this-week";
  return "upcoming";
}

export function bucketPlanTasks<T extends { day_date: string }>(
  tasks: T[],
  todayISO: string,
): { today: T[]; thisWeek: T[]; upcoming: T[] } {
  const today: T[] = [];
  const thisWeek: T[] = [];
  const upcoming: T[] = [];
  for (const t of tasks) {
    const bucket = classifyPlanDate(t.day_date, todayISO);
    if (bucket === "today") today.push(t);
    else if (bucket === "this-week") thisWeek.push(t);
    else if (bucket === "upcoming") upcoming.push(t);
    // "past" tasks are not surfaced in Plan; the server query already
    // only fetches from the start of the current week onward.
  }
  return { today, thisWeek, upcoming };
}

// Groups a list of tasks by day_date, sorted chronologically. Used to
// render "This week" / "Upcoming" as date-headed groups.
export function groupTasksByDate<T extends { day_date: string }>(tasks: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const t of tasks) {
    const arr = map.get(t.day_date) ?? [];
    arr.push(t);
    map.set(t.day_date, arr);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
