// Locale helpers — Persian digits, Toman, Jalali (Solar Hijri) dates.
// Uses the built-in ICU Persian calendar; no third-party date library needed.

const faNumber = new Intl.NumberFormat("fa-IR");

export const faNum = (n: number) => faNumber.format(n);

export const toman = (n: number) => `${faNumber.format(n)} تومان`;

/** Convert Persian/Arabic digits to Latin digits (for user input). */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Convert Latin digits in a string to Persian digits (for display of codes). */
export function toFaDigits(input: string): string {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

const TZ = "Asia/Tehran";

export function jDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    ...opts,
  }).format(d);
}

export function jDateTime(iso: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "شنبه ۹ آبان" for a local yyyy-mm-dd date */
export function jDayLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00+03:30`);
  return {
    weekday: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, weekday: "long" }).format(d),
    day: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TZ, day: "numeric", month: "long" }).format(d),
  };
}

/** Tehran-local yyyy-mm-dd for a Date */
export function tehranIsoDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA yields yyyy-mm-dd
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export const faTime = (hhmm: string) => toFaDigits(hhmm);
