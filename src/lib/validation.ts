import { z } from "zod";
import { toLatinDigits } from "./format";

// Shared validation for server actions. Messages are user-facing Persian.

const digits = (s: unknown) => (typeof s === "string" ? toLatinDigits(s).replace(/[\s-]/g, "") : s);
const trimmed = (s: unknown) => (typeof s === "string" ? s.trim() : s);

export const mobileSchema = z.preprocess(
  digits,
  z.string().regex(/^09\d{9}$/, "شمارهٔ همراه باید ۱۱ رقم و با ۰۹ شروع شود"),
);

/** Mobile or landline (021…) */
export const phoneSchema = z.preprocess(
  digits,
  z.string().regex(/^0\d{10}$/, "شمارهٔ تماس معتبر وارد کنید (مثلاً ۰۹۱۲۳۴۵۶۷۸۹ یا ۰۲۱۸۸۰۰۰۰۰۰)"),
);

export const otpSchema = z.preprocess(digits, z.string().regex(/^\d{5}$/, "کد ۵ رقمی را وارد کنید"));

export const postalCodeSchema = z.preprocess(
  digits,
  z.string().regex(/^[13-9]\d{9}$/, "کد پستی ۱۰ رقمی معتبر وارد کنید"),
);

const req = (label: string, min = 2, max = 200) =>
  z.preprocess(trimmed, z.string().min(min, `${label} را وارد کنید`).max(max, `${label} بیش از حد طولانی است`));

export const addressSchema = z.object({
  label: z.preprocess(trimmed, z.string().max(40).default("خانه")),
  recipient: req("نام گیرنده"),
  mobile: mobileSchema,
  province: req("استان"),
  city: req("شهر"),
  street: req("نشانی", 8, 400),
  plaque: z.preprocess(digits, z.string().min(1, "پلاک را وارد کنید").max(10)),
  unit: z.preprocess(digits, z.string().max(10).default("")),
  postalCode: postalCodeSchema,
});

export type AddressInput = z.infer<typeof addressSchema>;

export const rfqContactSchema = z.object({
  company: req("نام سازمان"),
  department: z.preprocess(trimmed, z.string().max(120).optional()),
  contactName: req("نام و نام خانوادگی"),
  phone: phoneSchema,
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : trimmed(v)),
    z.email("ایمیل معتبر نیست").optional(),
  ),
  occasion: req("مناسبت", 1),
  budget: req("بازهٔ بودجه", 1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ تحویل را انتخاب کنید"),
  customization: z.preprocess(trimmed, z.string().max(1000).optional()),
  notes: z.preprocess(trimmed, z.string().max(1000).optional()),
});

export const rfqItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  customization: z.array(z.string()).max(10),
  note: z.string().max(300),
});

export const meetingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "روز جلسه را انتخاب کنید"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "ساعت جلسه را انتخاب کنید"),
  type: z.enum(["onsite_client", "onsite_tiara", "online"], "نوع جلسه را انتخاب کنید"),
  company: req("نام سازمان"),
  contactName: req("نام و نام خانوادگی"),
  phone: phoneSchema,
  topic: z.preprocess(trimmed, z.string().max(600).optional()),
  rfqCode: z.preprocess(trimmed, z.string().max(40).optional()),
});

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
