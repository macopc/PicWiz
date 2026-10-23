import { AppError, type Style } from "../domain";
import { validateV1Store, V1_SIZES } from "./frozen-v1";

/** V1 is validated before conversion; normalization must never repair damaged records. */
export function migrate002(input: unknown): unknown {
  const old = validateV1Store(input);
  const convertStyle = (style: Style): Style => ({
    ...style,
    padding: Math.round(
      (style.padding * V1_SIZES[style.size as keyof typeof V1_SIZES].width) /
        1600,
    ),
    radius: Math.round(
      (style.radius * V1_SIZES[style.size as keyof typeof V1_SIZES].width) /
        1600,
    ),
  });
  return {
    ...old,
    version: 2,
    composition: {
      ...old.composition,
      style: convertStyle(old.composition.style),
      annotations: [],
    },
    presets: old.presets.map((preset) => ({
      ...preset,
      style: convertStyle(preset.style),
    })),
    jobs: old.jobs.map((job) => {
      const match = Object.entries(V1_SIZES)
        .flatMap(([size, dimensions]) =>
          ([1, 2] as const).map((scale) => ({ size, scale, ...dimensions })),
        )
        .find(
          (value) =>
            value.width * value.scale === job.width &&
            value.height * value.scale === job.height,
        );
      if (!match)
        throw new AppError(
          "storage_corrupt",
          "The saved export size is invalid. The original data has been preserved.",
        );
      return {
        ...job,
        formats: [match.size],
        scale: match.scale,
        total: 1,
        completed: job.status === "succeeded" ? 1 : 0,
        failed: job.status === "failed" ? 1 : 0,
      };
    }),
  };
}
