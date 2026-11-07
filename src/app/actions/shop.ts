"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paymentMode } from "@/lib/config";
import { payrollEnabled } from "@/lib/integrations";
import { CheckoutError, OrderStateError, customerCancelOrder, settleSandboxPayment } from "@/lib/repo/orders";
import { getPurchasableVariants } from "@/lib/repo/products";
import { AddressLimitError, MAX_ADDRESSES, addAddress, deleteAddress, getAddress, setDefaultAddress, updateProfile } from "@/lib/repo/users";
import { getOwnOrder, placeOrder } from "@/lib/services/customer";
import { currentUser } from "@/lib/session";
import type { Address } from "@/lib/types";
import { addressSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export interface PlaceOrderInput {
  lines: { variantId: string; qty: number }[];
  deliveryMethod: string;
  addressId: string | null;
  paymentMethod: "gateway" | "payroll";
  /** generated once per checkout attempt by the browser; makes double submits idempotent */
  idempotencyKey: string;
}

export type PlaceOrderResult = { ok: false; error: string; lineErrors?: Record<string, string> } | { ok: true; code: string };

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "برای ثبت سفارش ابتدا وارد شوید." };
  if (input.paymentMethod !== "gateway" && input.paymentMethod !== "payroll") return { ok: false, error: "روش پرداخت نامعتبر است." };
  if (input.paymentMethod === "payroll" && !payrollEnabled()) {
    return { ok: false, error: "کسر از حقوق هنوز فعال نیست؛ پرداخت اینترنتی را انتخاب کنید." };
  }
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .filter((l) => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty > 0)
    .slice(0, 50);
  let address: Address | null = null;
  if (input.addressId) {
    address = getAddress(user.id, input.addressId);
    if (!address) return { ok: false, error: "نشانی انتخاب‌شده یافت نشد." };
  }
  try {
    const order = placeOrder(user, {
      lines,
      deliveryMethod: String(input.deliveryMethod),
      address,
      paymentMethod: input.paymentMethod,
      idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : null,
    });
    revalidatePath("/shop");
    return { ok: true, code: order.code };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message, lineErrors: e.lineErrors };
    console.error(e);
    return { ok: false, error: "ثبت سفارش با خطا مواجه شد. دوباره تلاش کنید." };
  }
}

export async function cancelOwnOrderAction(form: FormData) {
  const user = await currentUser();
  const code = String(form.get("code") ?? "").slice(0, 40);
  if (!user) redirect("/login");
  const done = customerCancelOrder(user, code);
  revalidatePath("/account");
  redirect(`/account/orders/${encodeURIComponent(code)}?${done ? "cancelled=1" : "error=state"}`);
}

export async function sandboxPayAction(form: FormData) {
  const user = await currentUser();
  const code = String(form.get("code") ?? "");
  const outcome = form.get("outcome") === "failure" ? "failure" : "success";
  const order = user ? getOwnOrder(user, code) : null;
  if (!user || !order) redirect("/account");
  if (paymentMode() !== "sandbox") redirect(`/checkout/${code}?error=gateway`);
  try {
    settleSandboxPayment(order.id, outcome);
  } catch (e) {
    if (!(e instanceof OrderStateError)) throw e;
    redirect(`/checkout/${code}?error=state`);
  }
  redirect(`/checkout/${code}?result=${outcome}`);
}

/** Validates current stock/prices for a past order and returns lines the client can add to the cart. */
export async function reorderAction(code: string): Promise<{ lines: { variantId: string; qty: number }[]; skipped: string[] }> {
  const user = await currentUser();
  const order = user ? getOwnOrder(user, code) : null;
  if (!user || !order) return { lines: [], skipped: [] };
  const variants = getPurchasableVariants(order.items.map((i) => i.variantId));
  const lines: { variantId: string; qty: number }[] = [];
  const skipped: string[] = [];
  for (const i of order.items) {
    const v = variants.get(i.variantId);
    if (!v || v.stock === 0) skipped.push(`${i.name} (${i.variantLabel})`);
    else lines.push({ variantId: v.id, qty: Math.min(i.qty, v.stock, v.maxPerOrder) });
  }
  return { lines, skipped };
}

// ── account ──

export interface AddressFormState {
  ok?: boolean;
  errors?: FieldErrors;
  address?: Address;
  /** submitted values, restored after React resets the form on error */
  values?: Record<string, string>;
}

export async function addAddressAction(_prev: AddressFormState, form: FormData): Promise<AddressFormState> {
  const user = await currentUser();
  if (!user) return { errors: { _: "ابتدا وارد شوید." } };
  const values = Object.fromEntries(["label", "recipient", "mobile", "province", "city", "street", "plaque", "unit", "postalCode"].map((k) => [k, String(form.get(k) ?? "").slice(0, 400)]));
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  let address: Address;
  try {
    address = addAddress(user.id, parsed.data, form.get("makeDefault") === "on");
  } catch (e) {
    if (e instanceof AddressLimitError) return { errors: { _: `حداکثر ${MAX_ADDRESSES.toLocaleString("fa-IR")} نشانی می‌توانید ذخیره کنید.` }, values };
    throw e;
  }
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true, address };
}

export async function deleteAddressAction(form: FormData) {
  const user = await currentUser();
  if (!user) return;
  deleteAddress(user.id, String(form.get("id")));
  revalidatePath("/account");
}

export async function defaultAddressAction(form: FormData) {
  const user = await currentUser();
  if (!user) return;
  setDefaultAddress(user.id, String(form.get("id")));
  revalidatePath("/account");
}

export interface ProfileState {
  ok?: boolean;
  error?: string;
}

export async function updateProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await currentUser();
  if (!user) return { error: "ابتدا وارد شوید." };
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "نام و نام خانوادگی را وارد کنید." };
  // HR-sourced fields stay read-only for employees.
  const company = user.employeeCode ? user.company : String(form.get("company") ?? "").trim() || null;
  const unit = user.employeeCode ? user.unit : String(form.get("unit") ?? "").trim() || null;
  updateProfile(user.id, { name: user.employeeCode ? (user.name ?? name) : name, company, unit });
  revalidatePath("/account");
  return { ok: true };
}
