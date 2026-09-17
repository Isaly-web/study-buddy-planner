import { describe, expect, it } from "vitest";
import {
  getWeekStart,
  getWeekEnd,
  classifyPlanDate,
  bucketPlanTasks,
  groupTasksByDate,
} from "./plan-helpers";

// 2024-01-01 was a Monday; 2024-01-03 a Wednesday; 2024-01-07 a Sunday.

describe("getWeekStart / getWeekEnd", () => {
  it("finds the Monday-start week for a mid-week date", () => {
    expect(getWeekStart("2024-01-03")).toBe("2024-01-01");
    expect(getWeekEnd("2024-01-03")).toBe("2024-01-07");
  });

  it("is stable when the reference date is already Monday", () => {
    expect(getWeekStart("2024-01-01")).toBe("2024-01-01");
    expect(getWeekEnd("2024-01-01")).toBe("2024-01-07");
  });

  it("is stable when the reference date is Sunday (end of week)", () => {
    expect(getWeekStart("2024-01-07")).toBe("2024-01-01");
    expect(getWeekEnd("2024-01-07")).toBe("2024-01-07");
  });
});

describe("classifyPlanDate", () => {
  const today = "2024-01-03"; // Wednesday

  it("classifies today", () => {
    expect(classifyPlanDate("2024-01-03", today)).toBe("today");
  });

  it("classifies earlier-in-week days as this-week (not just future ones)", () => {
    expect(classifyPlanDate("2024-01-01", today)).toBe("this-week");
    expect(classifyPlanDate("2024-01-02", today)).toBe("this-week");
  });

  it("classifies the rest of the current week as this-week", () => {
    expect(classifyPlanDate("2024-01-04", today)).toBe("this-week");
    expect(classifyPlanDate("2024-01-07", today)).toBe("this-week");
  });

  it("classifies dates beyond the current week as upcoming", () => {
    expect(classifyPlanDate("2024-01-08", today)).toBe("upcoming");
    expect(classifyPlanDate("2024-02-01", today)).toBe("upcoming");
  });

  it("classifies dates before the current week as past", () => {
    expect(classifyPlanDate("2023-12-31", today)).toBe("past");
  });

  it("handles week boundaries correctly when today is Monday", () => {
    const monday = "2024-01-01";
    expect(classifyPlanDate("2024-01-07", monday)).toBe("this-week");
    expect(classifyPlanDate("2024-01-08", monday)).toBe("upcoming");
    expect(classifyPlanDate("2023-12-31", monday)).toBe("past");
  });

  it("handles week boundaries correctly when today is Sunday", () => {
    const sunday = "2024-01-07";
    expect(classifyPlanDate("2024-01-01", sunday)).toBe("this-week");
    expect(classifyPlanDate("2024-01-08", sunday)).toBe("upcoming");
  });
});

describe("bucketPlanTasks", () => {
  const today = "2024-01-03";

  it("splits tasks into today / this-week / upcoming, dropping past", () => {
    const tasks = [
      { id: "1", day_date: "2023-12-31" }, // past
      { id: "2", day_date: "2024-01-03" }, // today
      { id: "3", day_date: "2024-01-05" }, // this week
      { id: "4", day_date: "2024-01-10" }, // upcoming
    ];
    const result = bucketPlanTasks(tasks, today);
    expect(result.today.map((t) => t.id)).toEqual(["2"]);
    expect(result.thisWeek.map((t) => t.id)).toEqual(["3"]);
    expect(result.upcoming.map((t) => t.id)).toEqual(["4"]);
  });

  it("preserves completion state on each task untouched", () => {
    const tasks = [
      { id: "1", day_date: "2024-01-03", completed_at: "2024-01-03T10:00:00Z" },
      { id: "2", day_date: "2024-01-03", completed_at: null },
    ];
    const result = bucketPlanTasks(tasks, today);
    expect(result.today).toEqual(tasks);
  });

  it("lets exam and assignment sessions coexist in the same bucket", () => {
    const tasks = [
      { id: "1", day_date: "2024-01-03", goal_type: "exam" },
      { id: "2", day_date: "2024-01-03", goal_type: "assignment" },
    ];
    const result = bucketPlanTasks(tasks, today);
    expect(result.today.map((t) => t.goal_type)).toEqual(["exam", "assignment"]);
  });

  it("renders sessions with a null topic_id (assignments) without special-casing", () => {
    const tasks = [
      { id: "1", day_date: "2024-01-03", topic_id: "t-1" },
      { id: "2", day_date: "2024-01-03", topic_id: null },
    ];
    const result = bucketPlanTasks(tasks, today);
    expect(result.today).toHaveLength(2);
    expect(result.today.find((t) => t.id === "2")?.topic_id).toBeNull();
  });
});

describe("groupTasksByDate", () => {
  it("groups and sorts tasks chronologically by day_date", () => {
    const tasks = [
      { id: "1", day_date: "2024-01-05" },
      { id: "2", day_date: "2024-01-03" },
      { id: "3", day_date: "2024-01-05" },
    ];
    const groups = groupTasksByDate(tasks);
    expect(groups.map(([day]) => day)).toEqual(["2024-01-03", "2024-01-05"]);
    expect(groups.find(([day]) => day === "2024-01-05")?.[1]).toHaveLength(2);
  });
});
