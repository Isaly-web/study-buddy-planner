import { describe, expect, it } from "vitest";
import {
  daysBetween,
  distributeTasks,
  planAssignmentSessions,
  buildAssignmentTaskRows,
  hasPlanningSupport,
  supportsExerciseTutor,
  GOAL_TYPES,
  PLANNABLE_GOAL_TYPES,
} from "./exams.functions";

describe("daysBetween", () => {
  it("is inclusive of both endpoints", () => {
    expect(daysBetween("2026-09-16", "2026-09-16")).toEqual(["2026-09-16"]);
    expect(daysBetween("2026-09-16", "2026-09-18")).toEqual([
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
    ]);
  });
});

describe("distributeTasks (existing exam planning, unchanged)", () => {
  const plan = {
    topics: [
      {
        title: "Topic A",
        tasks: [
          { title: "A1", estimated_minutes: 20 },
          { title: "A2", estimated_minutes: 20 },
        ],
      },
      { title: "Topic B", tasks: [{ title: "B1", estimated_minutes: 15 }] },
    ],
  };

  it("reserves the last day as a review day when there are >= 3 days", () => {
    const days = ["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"];
    const distribution = distributeTasks(plan, days);
    // 3 tasks total, distributed only across the first 3 days (last day reserved).
    expect(distribution.every((d) => d.day !== "2026-09-19")).toBe(true);
    expect(distribution).toHaveLength(3);
  });

  it("uses every day when there are fewer than 3 days", () => {
    const days = ["2026-09-16", "2026-09-17"];
    const distribution = distributeTasks(plan, days);
    expect(distribution.some((d) => d.day === "2026-09-17")).toBe(true);
    expect(distribution).toHaveLength(3);
  });

  it("preserves task titles, minutes and a stable order", () => {
    const days = ["2026-09-16"];
    const distribution = distributeTasks(plan, days);
    expect(distribution.map((d) => d.task.title)).toEqual(["A1", "A2", "B1"]);
    expect(distribution.map((d) => d.order)).toEqual([0, 1, 2]);
  });
});

describe("planAssignmentSessions (new, minimal assignment planning)", () => {
  it("creates exactly one session when the assignment is due today", () => {
    const sessions = planAssignmentSessions({
      description: "Read chapter 5",
      days: ["2026-09-16"],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      day: "2026-09-16",
      title: "Read chapter 5",
      estimated_minutes: 20,
      order: 0,
    });
  });

  it("caps sessions at 3 even with many available days", () => {
    const days = ["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
    const sessions = planAssignmentSessions({ description: "Finish worksheet", days });
    expect(sessions).toHaveLength(3);
  });

  it("clusters sessions on the days closest to (and including) the due date", () => {
    const days = ["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
    const sessions = planAssignmentSessions({ description: "Finish worksheet", days });
    expect(sessions.map((s) => s.day)).toEqual(["2026-09-18", "2026-09-19", "2026-09-20"]);
  });

  it("uses fewer sessions than the cap when fewer days are available", () => {
    const sessions = planAssignmentSessions({
      description: "Quick task",
      days: ["2026-09-16", "2026-09-17"],
    });
    expect(sessions).toHaveLength(2);
  });
});

describe("buildAssignmentTaskRows", () => {
  it("links every session to the goal via goal_id and never sets a topic_id", () => {
    const sessions = planAssignmentSessions({
      description: "Read chapter 5",
      days: ["2026-09-16", "2026-09-17"],
    });
    const rows = buildAssignmentTaskRows("11111111-1111-1111-1111-111111111111", sessions);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.goal_id).toBe("11111111-1111-1111-1111-111111111111");
      expect(row.topic_id).toBeNull();
    }
  });

  it("produces no fields related to topics, exercises or vocabulary", () => {
    const sessions = planAssignmentSessions({
      description: "Read chapter 5",
      days: ["2026-09-16"],
    });
    const rows = buildAssignmentTaskRows("11111111-1111-1111-1111-111111111111", sessions);
    const keys = Object.keys(rows[0]).sort();
    expect(keys).toEqual(
      ["day_date", "estimated_minutes", "goal_id", "order", "title", "topic_id"].sort(),
    );
  });
});

describe("hasPlanningSupport (goal-type awareness)", () => {
  it("recognizes all four goal types in the data model", () => {
    expect(GOAL_TYPES).toEqual(["exam", "assignment", "vocabulary", "other"]);
  });

  it("supports planning for exam and assignment", () => {
    expect(hasPlanningSupport("exam")).toBe(true);
    expect(hasPlanningSupport("assignment")).toBe(true);
    expect(PLANNABLE_GOAL_TYPES).toEqual(["exam", "assignment"]);
  });

  it("does NOT support planning for vocabulary or other yet", () => {
    expect(hasPlanningSupport("vocabulary")).toBe(false);
    expect(hasPlanningSupport("other")).toBe(false);
  });

  it("rejects unknown goal types", () => {
    expect(hasPlanningSupport("homework")).toBe(false);
    expect(hasPlanningSupport("")).toBe(false);
  });
});

describe("supportsExerciseTutor (Study Home: exam-only AI tutor gating)", () => {
  it("allows the AI exercise tutor for exams", () => {
    expect(supportsExerciseTutor("exam")).toBe(true);
  });

  it("does NOT allow the AI exercise tutor for assignments", () => {
    expect(supportsExerciseTutor("assignment")).toBe(false);
  });

  it("does NOT allow the AI exercise tutor for vocabulary or other goals", () => {
    expect(supportsExerciseTutor("vocabulary")).toBe(false);
    expect(supportsExerciseTutor("other")).toBe(false);
  });
});
