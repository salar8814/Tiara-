import { Notice } from "./ui";

/** Shows the result of a redirecting admin action (?ok=1 / ?error=...). */
export function AdminFlash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error) return <Notice tone="danger" className="mb-4">{sp.error.slice(0, 300)}</Notice>;
  if (sp.ok) return <Notice tone="success" className="mb-4">تغییر ثبت شد.</Notice>;
  return null;
}
