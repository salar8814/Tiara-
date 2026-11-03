"use client";

import { useMemo, useState } from "react";
import { isoToJalali, jalaliMonthLength, jalaliMonths, jalaliToIso } from "@/lib/jalali";
import { cx } from "./ui";

/** Jalali (Solar Hijri) date picker built from native selects — accessible and mobile-friendly. Emits ISO (Gregorian) yyyy-mm-dd. */
export function JalaliDateInput({
  id,
  value,
  onChange,
  min,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  min: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const minJ = useMemo(() => isoToJalali(min), [min]);
  const [j, setJ] = useState(() => (value ? isoToJalali(value) : null));
  const years = [minJ.jy, minJ.jy + 1];
  const cls = cx(
    "h-11 rounded-md border bg-surface px-2 text-[0.9375rem] focus:outline-none focus:ring-2 focus:ring-accent-100",
    invalid ? "border-danger" : "border-line-strong focus:border-accent-600",
  );

  const update = (next: { jy: number; jm: number; jd: number }) => {
    const len = jalaliMonthLength(next.jy, next.jm);
    const fixed = { ...next, jd: Math.min(next.jd, len) };
    setJ(fixed);
    const iso = jalaliToIso(fixed.jy, fixed.jm, fixed.jd);
    onChange(iso);
  };

  const cur = j ?? { jy: 0, jm: 0, jd: 0 };
  const days = cur.jy && cur.jm ? jalaliMonthLength(cur.jy, cur.jm) : 31;

  return (
    <div className="flex gap-2" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
      <select
        id={id}
        aria-label="روز"
        className={cx(cls, "w-20")}
        value={cur.jd || ""}
        onChange={(e) => update({ jy: cur.jy || minJ.jy, jm: cur.jm || minJ.jm, jd: Number(e.target.value) })}
      >
        <option value="" disabled>روز</option>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d.toLocaleString("fa-IR")}</option>
        ))}
      </select>
      <select
        aria-label="ماه"
        className={cx(cls, "flex-1")}
        value={cur.jm || ""}
        onChange={(e) => update({ jy: cur.jy || minJ.jy, jm: Number(e.target.value), jd: cur.jd || 1 })}
      >
        <option value="" disabled>ماه</option>
        {jalaliMonths.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        aria-label="سال"
        className={cx(cls, "w-24")}
        value={cur.jy || ""}
        onChange={(e) => update({ jy: Number(e.target.value), jm: cur.jm || minJ.jm, jd: cur.jd || 1 })}
      >
        <option value="" disabled>سال</option>
        {years.map((y) => (
          <option key={y} value={y}>{y.toLocaleString("fa-IR", { useGrouping: false })}</option>
        ))}
      </select>
    </div>
  );
}
