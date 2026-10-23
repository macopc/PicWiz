import { describe, expect, it } from "vitest";
import { migrate001 } from "../../lib/migrations/001-local-store";
import { migrateLocalDocument } from "../../lib/migrations";
import { createStore } from "../../lib/storage";

describe("versioned local migrations", () => {
  const instant = "2026-10-23T13:00:00.000Z";
  it("initializes a relational envelope through migration 001", () => {
    expect(migrateLocalDocument(null, instant)).toMatchObject({
      version: 1,
      composition: {
        id: "current",
        createdAt: instant,
        status: "empty",
        source: null,
      },
      presets: [],
      jobs: [],
    });
  });
  it("upgrades an explicit empty v0 without changing its input", () => {
    const old = { version: 0 };
    expect(migrateLocalDocument(old, instant)).toHaveProperty("version", 1);
    expect(old).toEqual({ version: 0 });
    expect(() =>
      migrate001({ version: 0, source: "unrecognized data" }, instant),
    ).toThrow(/preserved/);
  });
  it("leaves existing and future documents untouched for repository validation", () => {
    const current = createStore();
    expect(migrateLocalDocument(current, instant)).toBe(current);
    const future = { version: 99, futureData: true };
    expect(migrateLocalDocument(future, instant)).toBe(future);
  });
});
