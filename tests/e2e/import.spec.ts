import { expect, test } from "@playwright/test";
import {
  SOURCE_COLOR,
  canvasSnapshot,
  expectCenterColor,
  expectStyle,
  openEditor,
  readStore,
  setSlider,
  sourceFromStore,
} from "./helpers";

// Trace recording would add unrelated work to the measured decode/render interval.
test.use({ trace: "off", video: "off" });

test("a real 4K drop renders within one second; invalid files preserve pixels and source without uploading", async ({
  page,
}, testInfo) => {
  const uploadRequests: string[] = [];
  page.on("request", (request) => {
    if (
      !["GET", "HEAD"].includes(request.method()) ||
      /\/upload(?:\/|\?|$)/i.test(request.url())
    ) {
      uploadRequests.push(
        `${request.method()} ${new URL(request.url()).pathname}`,
      );
    }
  });
  await openEditor(page);
  await page.getByRole("button", { name: "Use example", exact: true }).click();
  await sourceFromStore(page);
  await page.getByRole("button", { name: "No frame", exact: true }).click();
  await setSlider(page, "Corner radius", 0);
  await setSlider(page, "Shadow", 0);
  await expectStyle(page, { frame: "none", radius: 0, shadow: 0 });

  const elapsedMs = await page
    .getByTestId("drop-zone")
    .evaluate(async (dropZone, color) => {
      const fixture = document.createElement("canvas");
      fixture.width = 3840;
      fixture.height = 2160;
      const context = fixture.getContext("2d")!;
      context.fillStyle = "#192238";
      context.fillRect(0, 0, fixture.width, fixture.height);
      for (let y = 0; y < fixture.height; y += 64) {
        for (let x = 0; x < fixture.width; x += 64) {
          context.fillStyle = `rgb(${(x / 16) % 240}, ${(y / 16) % 240}, ${(x + y) % 240})`;
          context.fillRect(x + 4, y + 4, 52, 52);
        }
      }
      context.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      context.fillRect(1664, 824, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) =>
        fixture.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not generate 4K fixture")),
          "image/png",
        ),
      );
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([blob], "generated-4k.png", { type: "image/png" }),
      );

      const matches = () => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="composition-canvas"]',
        );
        if (!canvas || !canvas.width || !canvas.height) return false;
        const pixel = canvas
          .getContext("2d")!
          .getImageData(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
          ).data;
        return (
          Math.abs(pixel[0] - color.r) <= 3 &&
          Math.abs(pixel[1] - color.g) <= 3 &&
          Math.abs(pixel[2] - color.b) <= 3 &&
          pixel[3] === 255
        );
      };
      if (matches())
        throw new Error("The initial preview must differ from the 4K fixture");
      const started = performance.now();
      dropZone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
      return new Promise<number>((resolve, reject) => {
        const inspect = () => {
          if (matches()) {
            requestAnimationFrame(() => resolve(performance.now() - started));
          } else if (performance.now() - started > 2000) {
            reject(
              new Error(
                "4K screenshot pixels did not reach the preview within two seconds",
              ),
            );
          } else {
            requestAnimationFrame(inspect);
          }
        };
        requestAnimationFrame(inspect);
      });
    }, SOURCE_COLOR);
  await testInfo.attach("4k-drop-render-timing", {
    body: JSON.stringify({ elapsedMs, inputWidth: 3840, inputHeight: 2160 }),
    contentType: "application/json",
  });
  expect(
    elapsedMs,
    "drop dispatch → decoded screenshot pixels and following animation frame",
  ).toBeLessThan(1000);

  const source = await sourceFromStore(page, "generated-4k.png");
  expect(source.width).toBeGreaterThan(0);
  expect(source.height).toBeGreaterThan(0);
  expect(source.width).toBeLessThanOrEqual(3840);
  expect(source.height).toBeLessThanOrEqual(2160);
  expect(source.width / source.height).toBeCloseTo(16 / 9, 2);

  const sliderTimings = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="composition-canvas"]',
    )!;
    const context = canvas.getContext("2d")!;
    const original = context.drawImage;
    let lastDraw = 0;
    context.drawImage = ((...args: unknown[]) => {
      Reflect.apply(original, context, args);
      lastDraw = performance.now();
    }) as typeof original;
    const results: { slider: string; elapsedMs: number }[] = [];
    try {
      for (const [id, value] of [
        ["padding", 130],
        ["corner-radius", 30],
        ["shadow", 70],
      ] as const) {
        const input = document.getElementById(id) as HTMLInputElement;
        const started = performance.now();
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, String(value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise<void>((resolve, reject) => {
          const inspect = () => {
            if (lastDraw >= started) resolve();
            else if (performance.now() - started > 500)
              reject(new Error(`${id} did not repaint within 500ms`));
            else requestAnimationFrame(inspect);
          };
          requestAnimationFrame(inspect);
        });
        results.push({ slider: id, elapsedMs: lastDraw - started });
      }
    } finally {
      context.drawImage = original;
    }
    return results;
  });
  await testInfo.attach("4k-slider-repaint-timing", {
    body: JSON.stringify(sliderTimings),
    contentType: "application/json",
  });
  for (const timing of sliderTimings)
    expect(
      timing.elapsedMs,
      `${timing.slider} input → screenshot repaint`,
    ).toBeLessThan(100);
  await expectStyle(page, { padding: 130, radius: 30, shadow: 70 });
  const before = await canvasSnapshot(page);

  for (const disguisedAsPng of [false, true]) {
    await page.getByTestId("drop-zone").evaluate((dropZone, disguised) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          ["This is text, not an image."],
          disguised ? "forged.png" : "notes.txt",
          {
            type: disguised ? "image/png" : "text/plain",
          },
        ),
      );
      dropZone.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
      dropZone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    }, disguisedAsPng);
    const rejection = page
      .getByRole("alert")
      .filter({ hasText: /image|png|format|type|supported|file/i });
    await expect(rejection).toBeVisible();
    expect(await canvasSnapshot(page)).toEqual(before);
    expect((await readStore(page))!.composition.source).toEqual(source);
    await rejection
      .getByRole("button", { name: "Dismiss message", exact: true })
      .click();
    await expect(rejection).toHaveCount(0);
  }

  await page.reload();
  expect(await sourceFromStore(page, "generated-4k.png")).toEqual(source);
  await expectCenterColor(page, SOURCE_COLOR);
  expect(
    uploadRequests,
    "screenshots must remain in the browser without a POST or upload request",
  ).toEqual([]);
});
