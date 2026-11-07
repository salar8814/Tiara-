"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAddressAction, type AddressFormState } from "@/app/actions/shop";
import { provinces } from "@/data/iran";
import type { Address } from "@/lib/types";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

export function AddressForm({
  onSaved,
  onCancel,
  defaults,
}: {
  onSaved?: (a: Address) => void;
  onCancel?: () => void;
  defaults?: { recipient?: string | null; mobile?: string };
}) {
  const [state, action, pending] = useActionState<AddressFormState, FormData>(addAddressAction, {});
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && state.address && handled.current !== state.address.id) {
      handled.current = state.address.id;
      onSaved?.(state.address);
    }
  }, [state, onSaved]);
  const e = state.errors ?? {};
  const val = (k: string, fallback = "") => state.values?.[k] ?? fallback;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {e._ && <Notice tone="danger" className="sm:col-span-2">{e._}</Notice>}
      <Field label="نام گیرنده" htmlFor="a-recipient" error={e.recipient} required>
        <Input id="a-recipient" name="recipient" autoComplete="name" defaultValue={val("recipient", defaults?.recipient ?? "")} invalid={!!e.recipient} />
      </Field>
      <Field label="شمارهٔ همراه گیرنده" htmlFor="a-mobile" error={e.mobile} required>
        <Input id="a-mobile" name="mobile" inputMode="tel" autoComplete="tel" dir="ltr" className="text-end" placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹" defaultValue={val("mobile", defaults?.mobile ?? "")} invalid={!!e.mobile} />
      </Field>
      <Field label="استان" htmlFor="a-province" error={e.province} required>
        <Select key={val("province", "تهران")} id="a-province" name="province" defaultValue={val("province", "تهران")} invalid={!!e.province}>
          {provinces.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </Field>
      <Field label="شهر" htmlFor="a-city" error={e.city} required>
        <Input id="a-city" name="city" defaultValue={val("city", "تهران")} autoComplete="address-level2" invalid={!!e.city} />
      </Field>
      <Field label="نشانی پستی" htmlFor="a-street" error={e.street} hint="خیابان، کوچه و نشانه‌های لازم" required className="sm:col-span-2">
        <Textarea id="a-street" name="street" rows={2} defaultValue={val("street")} autoComplete="street-address" invalid={!!e.street} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="پلاک" htmlFor="a-plaque" error={e.plaque} required>
          <Input id="a-plaque" name="plaque" inputMode="numeric" defaultValue={val("plaque")} invalid={!!e.plaque} />
        </Field>
        <Field label="واحد" htmlFor="a-unit" error={e.unit}>
          <Input id="a-unit" name="unit" inputMode="numeric" defaultValue={val("unit")} invalid={!!e.unit} />
        </Field>
      </div>
      <Field label="کد پستی" htmlFor="a-postal" error={e.postalCode} hint="۱۰ رقم، بدون خط تیره" required>
        <Input id="a-postal" name="postalCode" inputMode="numeric" defaultValue={val("postalCode")} dir="ltr" className="text-end" maxLength={12} autoComplete="postal-code" invalid={!!e.postalCode} />
      </Field>
      <Field label="عنوان نشانی" htmlFor="a-label" hint="مثلاً خانه یا محل کار">
        <Input id="a-label" name="label" defaultValue={val("label", "خانه")} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-soft">
        <input type="checkbox" name="makeDefault" className="size-4 accent-indigo-600" /> نشانی پیش‌فرض باشد
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره…" : "ذخیرهٔ نشانی"}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>انصراف</Button>}
      </div>
    </form>
  );
}
