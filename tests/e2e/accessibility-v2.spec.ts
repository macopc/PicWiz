import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { closeDialog, openBatch, openEditor, openPresets, showInspector, uploadSolid } from "./helpers";

async function audit(page: Page, testInfo: TestInfo, state: string) {
  // Audit the rendered product and dialogs. No global rule disables or CSS exclusions.
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(violation => violation.impact === "critical" || violation.impact === "serious");
  await testInfo.attach(`axe-${state}`, { body: JSON.stringify({ url: results.url, violations: results.violations }, null, 2), contentType: "application/json" });
  expect(blocking.map(({ id, impact, description, nodes }) => ({ id, impact, description, targets: nodes.map(node => node.target) })), `${state}: serious/critical accessibility violations`).toEqual([]);
}

test("real product workspace, annotations, preset library and batch dialog have no serious or critical axe violations", async ({ page }, testInfo) => {
  await openEditor(page);
  await audit(page, testInfo, "empty-workspace");
  await uploadSolid(page, "accessible.png", 640, 360);
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await showInspector(page, "Annotate");
  await expect(page.getByText(/Text fits · 1 rendered line/)).toBeVisible();
  await page.getByLabel('Annotation Width',{exact:true}).fill('2');
  await expect(page.getByText(/Some text is clipped/)).toBeVisible();
  await audit(page, testInfo, "annotation-editor");
  await openPresets(page);
  await page.getByRole('button',{name:'Save current style',exact:true}).first().click();
  await page.getByLabel('Preset name',{exact:true}).fill('Launch notes');
  await page.getByRole('dialog').getByRole('button',{name:'Save preset',exact:true}).click();
  await openPresets(page);
  await audit(page, testInfo, "preset-library");
  await closeDialog(page);
  await openBatch(page, ["landscape"]);
  await audit(page, testInfo, "batch-dialog");
});
