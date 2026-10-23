import { AppError, DEFAULT_STYLE } from "../domain";

/** Version zero represents an uninitialized document, never a user composition. */
export function migrate001(input: unknown, instant: string): unknown {
  if (
    input !== null &&
    (typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !("version" in input) ||
      input.version !== 0)
  ) {
    throw new AppError(
      "storage_corrupt",
      "This local document cannot be migrated. It has been preserved.",
    );
  }
  return {
    version: 1,
    composition: {
      id: "current",
      createdAt: instant,
      updatedAt: instant,
      status: "empty",
      style: { ...DEFAULT_STYLE },
      source: null,
    },
    presets: [],
    jobs: [],
  };
}
