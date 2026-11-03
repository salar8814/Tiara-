import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
// Usage: start the app with OTP_MODE=display PAYMENT_MODE=sandbox on a fresh DB, then:
//   node scripts/smoke-test.mjs ./screenshots
const OUT = process.argv[2] ?? "./screenshots";
fs.mkdirSync(OUT, { recursive: true });

for (let i = 0; i < 60; i++) {
  try { const r = await fetch(BASE); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "fa-IR" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
const shot = (name, full = true) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const step = (s) => console.log("•", s);

async function login(mobile, next) {
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`);
  await page.fill("#mobile", mobile);
  await page.getByRole("button", { name: "دریافت کد ورود" }).click();
  const code = (await page.locator("strong.ltr").first().textContent()).trim();
  await page.fill("#code", code);
  await page.getByRole("button", { name: "ورود و بررسی شرایط" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

// ── Landing & B2C browse ──
step("landing");
await page.goto(BASE);
await shot("01-landing");

step("shop + filters");
await page.goto(`${BASE}/shop`);
await shot("02-shop");
await page.getByText("عطر ویانا").first().click();
await page.waitForURL(/category=fragrance/);
await page.waitForTimeout(500);
console.log("  fragrance cards:", await page.locator("article").count());
await page.fill('input[name="q"]', "ناموجود-نیست");
await page.waitForTimeout(900);
console.log("  empty state visible:", await page.getByText("محصولی با این فیلترها پیدا نشد").isVisible());

step("pdp + add to cart");
await page.goto(`${BASE}/shop/viana-noir`);
await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
await page.getByText("به سبد خرید اضافه شد").first().waitFor();
await shot("03-pdp");
await page.goto(`${BASE}/shop/handmade-scented-candle`);
await page.getByText("بهار نارنج").click();
await page.getByRole("button", { name: "افزایش" }).click();
await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();

step("cart (guest)");
await page.goto(`${BASE}/cart`);
await page.getByText("اقلام سبد").first().waitFor();
await shot("04-cart-guest");

step("checkout → login as eligible employee");
await page.getByRole("link", { name: "ادامهٔ فرایند خرید" }).click();
await page.waitForURL(/\/login/);
await shot("05-login");
await login("09121111111", "/checkout");
await page.waitForURL(/\/checkout/);
await page.getByText("نشانی جدید").first().waitFor();
// validation errors first
await page.getByRole("button", { name: "ذخیرهٔ نشانی" }).click();
await page.getByText("کد پستی ۱۰ رقمی معتبر وارد کنید").first().waitFor();
await shot("06-checkout-validation");
await page.fill("#a-street", "خیابان ولیعصر، کوچهٔ بهار، ساختمان آرین");
await page.fill("#a-plaque", "۱۲");
await page.fill("#a-unit", "۴");
await page.fill("#a-postal", "۱۴۳۳۸۷۵۹۱۱");
await page.getByRole("button", { name: "ذخیرهٔ نشانی" }).click();
await page.getByText("افزودن نشانی جدید").first().waitFor();
await shot("07-checkout");
await page.getByRole("button", { name: "ثبت سفارش و ادامه به پرداخت" }).click();
await page.waitForURL(/\/checkout\/TS-/);
await shot("08-payment");
const orderCode = page.url().split("/").pop();
await page.getByRole("button", { name: "شبیه‌سازی پرداخت ناموفق" }).click();
await page.getByText("پرداخت ناموفق بود").first().waitFor();
await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
await page.getByText("پرداخت تأیید شد").first().waitFor();
await shot("09-paid");
console.log("  order", orderCode);

step("account orders");
await page.goto(`${BASE}/account?tab=orders`);
await shot("10-account-orders");

// ── B2B ──
step("corporate catalog");
await page.goto(`${BASE}/corporate`);
await shot("11-corporate");
await page.goto(`${BASE}/corporate/nowruz-gift-set`);
await page.fill("#b2b-qty", "95");
await page.getByRole("button", { name: "افزودن به فهرست استعلام" }).click();
console.log("  moq error:", await page.getByText("حداقل سفارش ۱۰۰ بسته است").first().isVisible());
await page.fill("#b2b-qty", "120");
await page.getByText("حکاکی روی شیشهٔ عطر").click();
await page.getByRole("button", { name: "افزودن به فهرست استعلام" }).click();
await page.getByText("در فهرست استعلام ذخیره شد").first().waitFor();
await shot("12-b2b-pdp");
await page.goto(`${BASE}/corporate/viana-noir`);
await page.fill("#b2b-qty", "300");
await page.getByRole("button", { name: "افزودن به فهرست استعلام" }).click();
await page.getByText("در فهرست استعلام ذخیره شد").first().waitFor();
await shot("13-b2b-pdp-tiers");

step("RFQ basket + submit");
await page.goto(`${BASE}/corporate/inquiry`);
await page.getByRole("button", { name: "ثبت درخواست استعلام" }).click();
await page.getByText("لطفاً موارد مشخص‌شده را اصلاح کنید").first().waitFor();
await shot("14-rfq-validation");
await page.selectOption("#occasion", "nowruz");
await page.selectOption("#budget", "1m-2m");
const sel = page.locator('[role="group"][aria-labelledby="deadline-label"] select');
await sel.nth(2).selectOption({ index: 2 }); // next Jalali year
await sel.nth(1).selectOption({ index: 1 }); // Farvardin
await sel.nth(0).selectOption({ index: 1 });
await page.fill("#customization", "لوگوی سازمان روی جعبه، کارت تبریک با امضای مدیرعامل");
await page.getByText("جلسه با کارشناس فروش").click();
await shot("15-rfq");
await page.getByRole("button", { name: "ثبت استعلام و انتخاب زمان جلسه" }).click();
await page.waitForURL(/\/corporate\/meeting\?rfq=/);
const rfqCode = new URL(page.url()).searchParams.get("rfq");
console.log("  rfq", rfqCode);

step("meeting booking");
await page.locator('label:has(input[name="_time"]:not([disabled]))').first().click();
await shot("16-meeting");
await page.getByRole("button", { name: "ثبت درخواست جلسه" }).click();
await page.waitForURL(/\/corporate\/requests\//);
await shot("17-request-tracking");

// ── Admin: review + quote ──
step("admin quotes");
await ctx.clearCookies();
await login("09120000000", "/admin");
await shot("18-admin-dashboard");
await page.goto(`${BASE}/admin/requests/${rfqCode}`);
await page.getByRole("button", { name: "شروع بررسی" }).click();
await page.getByRole("button", { name: "صدور پیشنهاد قیمت" }).waitFor();
await page.fill('input[name="price0"]', "2450000");
const p1 = await page.inputValue('input[name="price1"]');
console.log("  suggested tier price for line 2:", p1);
await page.fill('input[name="discount"]', "5000000");
await page.getByRole("button", { name: "صدور پیشنهاد قیمت" }).click();
await page.getByText("پیشنهاد قیمت صادر و برای خریدار").first().waitFor();
await shot("19-admin-quote");
await page.goto(`${BASE}/admin/meetings`);
await page.getByRole("button", { name: "تأیید جلسه" }).first().click();
await page.waitForTimeout(500);
await page.goto(`${BASE}/admin/products`);
await shot("20-admin-products", false);

// ── Customer approves ──
step("customer approves quotation");
await ctx.clearCookies();
await login("09121111111", `/corporate/requests/${rfqCode}`);
await shot("21-quotation");
await page.getByRole("button", { name: "تأیید پیشنهاد و دریافت پیش‌فاکتور" }).click();
await page.getByText("پیشنهاد قیمت تأیید شد و پیش‌فاکتور صادر شد").first().waitFor();
await page.getByRole("link", { name: "مشاهده و چاپ پیش‌فاکتور" }).click();
await shot("22-proforma");

// ── Admin confirms order ──
step("admin confirms corporate order");
await ctx.clearCookies();
await login("09120000000", `/admin/requests/${rfqCode}`);
await page.fill('input[name="reference"]', "PO-77821");
await page.getByRole("button", { name: "قطعی کردن سفارش" }).click();
await page.getByText("سفارش قطعی").first().waitFor();

step("customer sees converted + reorder");
await ctx.clearCookies();
await login("09121111111", "/account?tab=requests");
await shot("23-account-requests");

// ── Eligibility states ──
step("ineligible & pending users");
await ctx.clearCookies();
await login("09124444444", "/shop");
await shot("24-ineligible", false);
await ctx.clearCookies();
await login("09123333333", "/checkout");
await shot("25-pending-checkout", false);

// ── Guest tracking ──
step("guest tracking");
await ctx.clearCookies();
await page.goto(`${BASE}/corporate/requests/${rfqCode}`);
await page.waitForURL(/\/corporate\/track/);
await page.fill("#t-phone", "09129999999");
await page.getByRole("button", { name: "پیگیری" }).click();
await page.getByText("درخواستی با این کد").first().waitFor();
await page.fill("#t-phone", "09121111111");
await page.getByRole("button", { name: "پیگیری" }).click();
await page.waitForURL(/\/corporate\/requests\//);

// ── Mobile ──
step("mobile screenshots");
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "fa-IR", isMobile: true, hasTouch: true });
const mp = await m.newPage();
mp.on("pageerror", (e) => errors.push(`mobile pageerror: ${e.message}`));
for (const [name, path] of [["m-landing", "/"], ["m-shop", "/shop"], ["m-pdp", "/shop/viana-noir"], ["m-corporate", "/corporate"], ["m-meeting", "/corporate/meeting"]]) {
  await mp.goto(BASE + path);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push(`horizontal overflow on ${path}`);
  await mp.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

console.log("\nERRORS:", errors.length ? errors : "none");
await browser.close();
