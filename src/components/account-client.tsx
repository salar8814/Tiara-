"use client";

import { useActionState, useState } from "react";
import { updateProfileAction, type ProfileState } from "@/app/actions/shop";
import type { User } from "@/lib/types";
import { AddressForm } from "./address-form";
import { Button, Field, Icon, Input, Notice } from "./ui";

export function ProfileForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  const hrManaged = !!user.employeeCode;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="نام و نام خانوادگی" htmlFor="p-name" hint={hrManaged ? "از سامانهٔ منابع انسانی خوانده می‌شود" : undefined}>
        <Input id="p-name" name="name" defaultValue={user.name ?? ""} readOnly={hrManaged} disabled={hrManaged} />
      </Field>
      <Field label="شمارهٔ همراه" htmlFor="p-mobile">
        <Input id="p-mobile" value={user.mobile} dir="ltr" className="text-end" disabled readOnly />
      </Field>
      <Field label="سازمان" htmlFor="p-company">
        <Input id="p-company" name="company" defaultValue={user.company ?? ""} disabled={hrManaged} />
      </Field>
      <Field label="واحد" htmlFor="p-unit">
        <Input id="p-unit" name="unit" defaultValue={user.unit ?? ""} disabled={hrManaged} />
      </Field>
      {!hrManaged && (
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره…" : "ذخیرهٔ اطلاعات"}</Button>
          {state.ok && <span className="text-sm font-semibold text-success">ذخیره شد.</span>}
          {state.error && <span className="text-sm font-semibold text-danger">{state.error}</span>}
        </div>
      )}
      {hrManaged && <Notice tone="info" className="sm:col-span-2">اطلاعات کارمندی از سوابق منابع انسانی خوانده می‌شود و برای اصلاح آن باید با منابع انسانی تماس بگیرید.</Notice>}
    </form>
  );
}

export function NewAddress({ defaults }: { defaults: { recipient: string | null; mobile: string } }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!open) {
    return (
      <div>
        {saved && <Notice tone="success" className="mb-3">نشانی ذخیره شد.</Notice>}
        <Button variant="secondary" onClick={() => { setOpen(true); setSaved(false); }}><Icon name="plus" size={16} /> افزودن نشانی</Button>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h3 className="mb-4 font-bold text-ink">نشانی جدید</h3>
      <AddressForm defaults={defaults} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); setSaved(true); }} />
    </div>
  );
}
