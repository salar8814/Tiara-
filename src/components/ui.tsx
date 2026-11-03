import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/status";
import { toman } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buttons ──

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type BtnSize = "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap select-none";
const btnVariant: Record<BtnVariant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800",
  dark: "bg-ink text-white hover:bg-ink-soft",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink-soft hover:bg-canvas",
  ghost: "text-accent-700 hover:bg-accent-50",
  danger: "bg-surface text-danger border border-danger/30 hover:bg-danger-soft",
};
const btnSize: Record<BtnSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md", extra?: string) {
  return cx(btnBase, btnVariant[variant], btnSize[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button className={btn(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link className={btn(variant, size, className)} {...props} />;
}

// ── Badges & notices ──

const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-soft",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  brand: "bg-indigo-50 text-indigo-700",
  clay: "bg-clay-50 text-clay-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-6", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "prototype";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-info/20 bg-info-soft text-info",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-success/25 bg-success-soft text-success",
    prototype: "border-dashed border-ink/25 bg-surface text-ink-soft",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm leading-7", styles, className)}>
      {tone === "prototype" && (
        <span className="ms-0 me-2 inline-block rounded bg-ink px-1.5 text-[0.6875rem] font-bold tracking-wide text-white">نمونهٔ اولیه</span>
      )}
      {title && <strong className="font-bold">{title} </strong>}
      {children}
    </div>
  );
}

// ── Layout ──

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Card({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <As className={cx("rounded-lg border border-line bg-surface", className)}>{children}</As>;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-center justify-between gap-4", className)}>
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="مسیر صفحه" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-subtle">/</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-soft">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  lead,
  crumbs,
  action,
}: {
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: { href?: string; label: string }[];
  action?: ReactNode;
}) {
  return (
    <header className="pb-6 pt-6 sm:pt-8">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[2rem] sm:leading-tight">{title}</h1>
          {lead && <p className="mt-2 text-[0.9375rem] text-muted">{lead}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-sunken text-muted" aria-hidden>
        {icon ?? <Icon name="box" />}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Forms ──

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-soft">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "block w-full rounded-md border bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-accent-100 disabled:bg-sunken disabled:text-muted";
export const inputClass = (invalid?: boolean) =>
  cx(inputBase, "h-11", invalid ? "border-danger focus:border-danger" : "border-line-strong focus:border-accent-600");

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cx(inputClass(invalid), className)} {...props} />;
}

export function Select({ invalid, className, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={cx(inputClass(invalid), "appearance-none bg-[length:12px]", className)} style={{ backgroundImage: chevron, backgroundRepeat: "no-repeat", backgroundPosition: "left 0.9rem center", paddingInlineEnd: "2.25rem" }} {...props}>
      {children}
    </select>
  );
}

const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%236b6a78' stroke-width='1.6'/%3E%3C/svg%3E")`;

export function Textarea({ invalid, className, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx(inputBase, "min-h-24 py-2.5 leading-7", invalid ? "border-danger" : "border-line-strong focus:border-accent-600", className)}
      {...props}
    />
  );
}

// ── Commerce ──

export function Money({ value, className, strike }: { value: number; className?: string; strike?: boolean }) {
  return <span className={cx("num", strike && "text-subtle line-through decoration-1", className)}>{toman(value)}</span>;
}

export function KeyValue({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-6 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-end font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Icons (inline, stroke-based, 20px) ──

const paths: Record<string, ReactNode> = {
  bag: <path d="M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  search: <path d="m20 20-4.5-4.5M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
  calendar: <path d="M5 6h14v14H5V6Zm0 4h14M9 3v4m6-4v4" />,
  truck: <path d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  shield: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
  building: <path d="M4 20V5l8-2v17M12 9h8v11M7 8h2M7 12h2M7 16h2M15 13h2M15 16h2M3 20h18" />,
  box: <path d="M4 8 12 4l8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8" />,
  doc: <path d="M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5M10 16h5" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01" />,
  pin: <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M5 4v4h4m10 12v-4h-4" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  grid: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />,
  chevron: <path d="m15 6-6 6 6 6" />,
  tag: <path d="M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
};

export function Icon({ name, className, size = 20 }: { name: keyof typeof paths | string; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx("shrink-0", className)}
    >
      {paths[name] ?? paths.box}
    </svg>
  );
}

// ── Timeline ──

export function Stepper({ steps, current, tone = "accent" }: { steps: { id: string; label: string }[]; current: number; tone?: "accent" | "danger" }) {
  return (
    <ol className="grid gap-3 sm:flex sm:items-start sm:gap-0" aria-label="مراحل">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-start sm:gap-2" aria-current={active ? "step" : undefined}>
            <div className="flex w-full items-center gap-2">
              <span
                className={cx(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  done && "border-accent-600 bg-accent-600 text-white",
                  active && (tone === "danger" ? "border-danger bg-danger-soft text-danger" : "border-accent-600 bg-accent-50 text-accent-700"),
                  !done && !active && "border-line-strong bg-surface text-subtle",
                )}
              >
                {done ? <Icon name="check" size={14} /> : (i + 1).toLocaleString("fa-IR")}
              </span>
              {i < steps.length - 1 && <span className={cx("hidden h-px flex-1 sm:block", done ? "bg-accent-600" : "bg-line-strong")} />}
            </div>
            <span className={cx("text-[0.8125rem] leading-5", active ? "font-bold text-ink" : done ? "text-ink-soft" : "text-subtle")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={cx("rounded-full border px-3 py-1 text-xs font-semibold", active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-soft")}>
      {label}
    </Link>
  );
}
