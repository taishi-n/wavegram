import { expect, test } from "@playwright/test";

test("renders and seeks", async ({ page }) => {
  await page.goto("/examples/basic.html");
  const player = page.locator("wavegram-player").first();
  await expect(player).toBeVisible();

  await page.waitForFunction(() => {
    const element = document.querySelector("wavegram-player");
    const shadow = element?.shadowRoot;
    return shadow?.querySelector(".status")?.textContent === "";
  });

  const box = await player.boundingBox();
  if (!box) throw new Error("Player did not render.");
  await page.mouse.click(box.x + box.width * 0.5, box.y + 80);

  const current = await player.evaluate((element) => element.shadowRoot?.querySelector(".current")?.textContent);
  expect(current).not.toBe("00:00.000");
});
