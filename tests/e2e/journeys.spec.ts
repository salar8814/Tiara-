import { expect, test, type Page } from "@playwright/test";

// Serial end-to-end journeys against the real production build. Every test
// fails on any uncaught page error or console error.
test.describe.configure({ mode: "serial" });

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
});
test.afterEach(() => {
  expect(errors, "browser errors").toEqual([]);
});

async function login(page: Page, mobile: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.fill("#mobile", mobile);
  await page.getByRole("button", { name: "دریافت کد ورود" }).click();
  const code = page.locator("strong.ltr").first();
  await expect(code).toHaveText(/^\d{5}$/);
  await page.fill("#code", (await code.textContent())!.trim());
  await page.getByRole("button", { name: "ورود و بررسی شرایط" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

let orderCode = "";
let rfqCode = "";

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  const acc = await request.get("/account", { maxRedirects: 0 });
  expect(acc.headers()["cache-control"]).toContain("no-store");
});

test("B2C: browse, filter, cart, checkout with validation, sandbox payment", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.locator("article")).toHaveCount(12);
  await page.getByText("عطر ویانا").first().click();
  await expect(page).toHaveURL(/category=fragrance/);
  await expect(page.locator("article")).toHaveCount(3);
  await page.fill('input[name="q"]', "چیزی-که-نیست");
  await expect(page.getByText("محصولی با این فیلترها پیدا نشد")).toBeVisible();

  await page.goto("/shop/viana-noir");
  await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
  await expect(page.getByText("به سبد خرید اضافه شد")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText("عطر ویانا — نوآر")).toBeVisible();

  await page.getByRole("link", { name: "ادامهٔ فرایند خرید" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, "09121111111", "/checkout");
  await expect(page).toHaveURL(/\/checkout$/);

  await page.fill("#a-street", "خیابان ولیعصر، کوچهٔ بهار، ساختمان آرین");
  await page.getByRole("button", { name: "ذخیرهٔ نشانی" }).click();
  await expect(page.getByText("کد پستی ۱۰ رقمی معتبر وارد کنید")).toBeVisible();
  // typed data must survive a validation error (React resets forms after actions)
  await expect(page.locator("#a-street")).toHaveValue("خیابان ولیعصر، کوچهٔ بهار، ساختمان آرین");
  await page.fill("#a-plaque", "۱۲");
  await page.fill("#a-postal", "۱۴۳۳۸۷۵۹۱۱");
  await page.getByRole("button", { name: "ذخیرهٔ نشانی" }).click();
  await expect(page.getByText("افزودن نشانی جدید")).toBeVisible();

  await page.getByRole("button", { name: "ثبت سفارش و ادامه به پرداخت" }).click();
  await page.waitForURL(/\/checkout\/TS-/);
  orderCode = page.url().split("/").pop()!;
  await expect(page.getByText("۱٬۳۷۵٬۰۰۰ تومان").first()).toBeVisible(); // 1,295,000 + 80,000 shipping

  await page.getByRole("button", { name: "شبیه‌سازی پرداخت ناموفق" }).click();
  await expect(page.getByText("پرداخت ناموفق بود")).toBeVisible();
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
  await expect(page.getByText("پرداخت تأیید شد · مرجع")).toBeVisible();
  await expect(page.getByText("تراکنش مالی واقعی ندارد")).toBeVisible();
});

test("isolation: another customer cannot open the order; employees cannot open admin", async ({ page }) => {
  await login(page, "09122222222", "/account");
  const res = await page.goto(`/account/orders/${orderCode}`);
  expect(res?.status()).toBe(404);
  const pay = await page.goto(`/checkout/${orderCode}`);
  expect(pay?.status()).toBe(404);
  // the browser logs the two intended 404 responses as console errors; anything else still fails
  errors = errors.filter((e) => !e.includes("status of 404"));
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\?denied=admin/);
});

test("B2B: MOQ validation, RFQ submission, meeting request", async ({ page }) => {
  await page.goto("/corporate/nowruz-gift-set");
  await page.fill("#b2b-qty", "95");
  await page.getByRole("button", { name: "افزودن به فهرست استعلام" }).click();
  await expect(page.getByText("حداقل سفارش ۱۰۰ بسته است")).toBeVisible();
  await page.getByRole("button", { name: /اصلاح به ۱۰۰/ }).click();
  await page.getByText("حکاکی روی شیشهٔ عطر").click();
  await page.getByRole("button", { name: "افزودن به فهرست استعلام" }).click();
  await expect(page.getByText("در فهرست استعلام ذخیره شد")).toBeVisible();

  await page.goto("/corporate/inquiry");
  await page.getByRole("button", { name: "ثبت درخواست استعلام" }).click();
  await expect(page.getByText("لطفاً موارد مشخص‌شده را اصلاح کنید")).toBeVisible();
  await page.fill("#company", "شرکت آزمون نهایی");
  await page.fill("#contactName", "سارا احمدی");
  await page.fill("#phone", "09121111111");
  await page.selectOption("#occasion", "nowruz");
  await page.selectOption("#budget", "1m-2m");
  const sel = page.locator('[role="group"][aria-labelledby="deadline-label"] select');
  await sel.nth(2).selectOption({ index: 2 });
  await sel.nth(1).selectOption({ index: 1 });
  await sel.nth(0).selectOption({ index: 1 });
  await page.getByText("جلسه با کارشناس فروش").click();
  await page.getByRole("button", { name: "ثبت استعلام و انتخاب زمان جلسه" }).click();
  await page.waitForURL(/\/corporate\/meeting\?rfq=/);
  rfqCode = new URL(page.url()).searchParams.get("rfq")!;
  expect(rfqCode).toMatch(/^RFQ-\d{4}-\d{5}$/);

  await page.locator('label:has(input[name="_time"]:not([disabled]))').first().click();
  await page.getByRole("button", { name: "ثبت درخواست جلسه" }).click();
  await page.waitForURL(/\/corporate\/requests\//);
  await expect(page.getByText("درخواست جلسه ثبت شد و منتظر تأیید کارشناس است")).toBeVisible();
});

test("roles: sales quotes, finance cannot quote, warehouse cannot see requests", async ({ page }) => {
  await login(page, "09126660002", "/admin"); // finance
  await page.goto(`/admin/requests/${rfqCode}`);
  await expect(page.getByRole("button", { name: "صدور پیشنهاد قیمت" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "شروع بررسی" })).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, "09126660003", "/admin"); // warehouse
  await expect(page.getByRole("link", { name: "نقش‌های کارکنان" })).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/admin\?denied=1/);

  await page.context().clearCookies();
  await login(page, "09126660001", "/admin"); // sales
  await page.goto(`/admin/requests/${rfqCode}`);
  await page.getByRole("button", { name: "شروع بررسی" }).click();
  await page.fill('input[name="price0"]', "2450000");
  await page.getByRole("button", { name: "صدور پیشنهاد قیمت" }).click();
  await expect(page.getByText("پیشنهاد قیمت صادر و برای خریدار")).toBeVisible();
});

test("guest with tracking code can read but not approve; owner approves", async ({ page }) => {
  await page.goto("/corporate/track");
  await page.fill("#t-code", rfqCode);
  await page.fill("#t-phone", "09129999999");
  await page.getByRole("button", { name: "پیگیری" }).click();
  await expect(page.getByText("درخواستی با این کد و شمارهٔ تماس پیدا نشد")).toBeVisible();
  await expect(page.locator("#t-code")).toHaveValue(rfqCode); // not wiped by the failed attempt
  await page.fill("#t-phone", "09121111111");
  await page.getByRole("button", { name: "پیگیری" }).click();
  await page.waitForURL(/\/corporate\/requests\//);
  await expect(page.getByText("پیشنهاد قیمت · نسخهٔ ۱")).toBeVisible();
  await expect(page.getByRole("button", { name: "تأیید پیشنهاد و دریافت پیش‌فاکتور" })).toHaveCount(0);
  await expect(page.getByText("با شمارهٔ همراه درخواست‌کننده وارد شوید")).toBeVisible();

  await login(page, "09121111111", `/corporate/requests/${rfqCode}`);
  await page.getByRole("button", { name: "تأیید پیشنهاد و دریافت پیش‌فاکتور" }).click();
  await expect(page.getByText("پیش‌فاکتور صادر شد").first()).toBeVisible();
  await page.getByRole("link", { name: "مشاهده و چاپ پیش‌فاکتور" }).click();
  await expect(page.getByText(/PF-\d{4}-\d{5}/).first()).toBeVisible();
});

test("finance confirms the corporate order with a PO reference; audit log records it", async ({ page }) => {
  await login(page, "09126660002", `/admin/requests/${rfqCode}`);
  await page.fill('input[name="reference"]', "PO-77821");
  await page.getByRole("button", { name: "قطعی کردن سفارش" }).click();
  await expect(page.getByText("تغییر ثبت شد")).toBeVisible();
  await expect(page.getByRole("heading", { name: /سفارش قطعی/ })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "09120000000", "/admin/audit");
  await expect(page.getByText("corporate_order.confirm")).toBeVisible();
  await expect(page.getByText("quotation.issue")).toBeVisible();
});

test("eligibility states: pending and ineligible users cannot check out", async ({ page }) => {
  await login(page, "09123333333", "/checkout");
  await expect(page.getByText("حساب کارمندی شما در انتظار فعال‌سازی است")).toBeVisible();
  await page.context().clearCookies();
  await login(page, "09124444444", "/checkout");
  await expect(page.getByText("دسترسی شما به فروشگاه کارکنان فعال نیست")).toBeVisible();
});

test("mobile layout has no horizontal overflow", async ({ browser }) => {
  // Plain 390px viewport (not isMobile): with isMobile the layout viewport stretches to the
  // content and hides overflow, which is how a real fieldset overflow slipped through before.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const p of ["/", "/shop", "/shop/viana-noir", "/cart", "/corporate", "/corporate/nowruz-gift-set", "/corporate/inquiry", "/corporate/meeting", "/corporate/track", "/login"]) {
    await page.goto(p);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `page width on ${p}`).toBeLessThanOrEqual(390);
  }
  await ctx.close();
});
