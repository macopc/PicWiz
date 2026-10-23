import { migrate001 } from "./001-local-store";

export const LOCAL_MIGRATIONS = [
  { version: 1, name: "001-local-store", apply: migrate001 },
] as const;

/** Pure upgrade pipeline. Validation and the single atomic commit live in the repository. */
export function migrateLocalDocument(input: unknown, instant: string): unknown {
  let document = input;
  const version =
    input === null
      ? 0
      : typeof input === "object" && "version" in input
        ? input.version
        : undefined;
  if (version !== 0) return document; // Repository rejects malformed or future schemas without writing.
  for (const migration of LOCAL_MIGRATIONS) {
    if (migration.version > version)
      document = migration.apply(document, instant);
  }
  return document;
}
