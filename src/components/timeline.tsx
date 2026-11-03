import { jDateTime } from "@/lib/format";
import type { TimelineEvent } from "@/lib/types";
import { cx } from "./ui";

export function Timeline({ events, labels }: { events: TimelineEvent[]; labels: Record<string, string> }) {
  const ordered = [...events].reverse();
  return (
    <ol className="relative space-y-5 border-s border-line ps-6">
      {ordered.map((e, i) => (
        <li key={i} className="relative">
          <span className={cx("absolute -start-[1.84rem] top-1.5 size-3 rounded-full ring-4 ring-surface", i === 0 ? "bg-accent-600" : "bg-line-strong")} />
          <p className={cx("text-sm font-bold", i === 0 ? "text-ink" : "text-ink-soft")}>{labels[e.status] ?? e.status}</p>
          {e.note && <p className="mt-0.5 text-sm leading-6 text-muted">{e.note}</p>}
          <p className="mt-0.5 text-xs text-subtle">{jDateTime(e.createdAt)}{e.actor.startsWith("admin") ? " · کارشناس تیارا" : e.actor === "system" ? " · سامانه" : ""}</p>
        </li>
      ))}
    </ol>
  );
}
