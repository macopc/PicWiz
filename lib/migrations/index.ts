import { migrate001 } from "./001-local-store";
import { migrate002 } from "./002-picwiz-v2";

export const LOCAL_MIGRATIONS = [
  { version: 1, name: "001-local-store", apply: migrate001 },
  { version: 2, name: "002-picwiz-v2", apply: migrate002 },
] as const;

/** Pure upgrades; full validation and the atomic storage commit belong to the repository. */
export function migrateLocalDocument(input: unknown, instant: string): unknown {
  let document = input;
  const version =
    input === null
      ? 0
      : typeof input === "object" && "version" in input
        ? input.version
        : undefined;
  if (version !== 0 && version !== 1) return input;
  for (const migration of LOCAL_MIGRATIONS) {
    if (migration.version > version)
      document = migration.apply(document, instant);
  }
  return document;
}
