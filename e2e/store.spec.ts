import { expect, test } from "@playwright/test";

test("browse the shop and filter by price", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/shop?sort=price-asc&category=home");
  await expect(page.getByRole("link", { name: /Ceramic pourer/ })).toBeVisible();
});

test("add a product to the bag", async ({ page }) => {
  await page.goto("/products/ceramic-pourer");
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByText("Added to bag")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText("Ceramic pourer")).toBeVisible();
});

test("checkout asks for customer details", async ({ page }) => {
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your name, email, and a Ghana phone number.")).toBeVisible();
});

test("admin redirects when logged out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/login/);
});

test("an admin can open the orders table", async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, "Admin credentials are not in the environment.");
  await page.goto("/account/login?next=/admin/orders");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL || "");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD || "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/orders/);
  await expect(page.getByRole("columnheader", { name: "Order" })).toBeVisible();
});

  test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("home, shop, product, cart, and checkout fit a phone", async ({ page }) => {
    for (const path of ["/", "/shop", "/products/ceramic-pourer", "/cart", "/checkout"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
