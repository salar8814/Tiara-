import "server-only";
import { b2bRules } from "@/data/rules";
import { db, newId, now } from "../db";
import { addDays, faTime, jDayLabel, tehranIsoDate } from "../format";
import type { Meeting, MeetingStatus, MeetingType } from "../types";
import { addEvent } from "./common";

interface MeetingRow {
  id: string;
  rfq_id: string | null;
  user_id: string | null;
  date: string;
  time: string;
  type: MeetingType;
  status: MeetingStatus;
  company: string;
  contact_name: string;
  phone: string;
  topic: string | null;
  created_at: string;
}

const toMeeting = (r: MeetingRow): Meeting => ({
  id: r.id,
  rfqId: r.rfq_id,
  userId: r.user_id,
  date: r.date,
  time: r.time,
  type: r.type,
  status: r.status,
  company: r.company,
  contactName: r.contact_name,
  phone: r.phone,
  topic: r.topic,
  createdAt: r.created_at,
});

/** Next bookable working days (Sat–Wed), starting tomorrow, Tehran time. */
export function bookableDays(): string[] {
  const out: string[] = [];
  let d = addDays(tehranIsoDate(), 1);
  while (out.length < b2bRules.meeting.daysAhead) {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (b2bRules.meeting.workingDays.includes(dow)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function takenSlots(days: string[]): Set<string> {
  if (!days.length) return new Set();
  const rows = db()
    .prepare(
      `SELECT date, time FROM meetings WHERE status IN ('requested','confirmed') AND date IN (${days.map(() => "?").join(",")})`,
    )
    .all(...days) as { date: string; time: string }[];
  return new Set(rows.map((r) => `${r.date} ${r.time}`));
}

export class SlotTakenError extends Error {}

export function requestMeeting(input: {
  rfqId: string | null;
  userId: string | null;
  date: string;
  time: string;
  type: MeetingType;
  company: string;
  contactName: string;
  phone: string;
  topic: string | null;
}): Meeting {
  const days = bookableDays();
  if (!days.includes(input.date) || !b2bRules.meeting.slots.includes(input.time)) {
    throw new SlotTakenError("این زمان قابل رزرو نیست.");
  }
  const id = newId();
  try {
    db()
      .prepare(
        `INSERT INTO meetings (id, rfq_id, user_id, date, time, type, status, company, contact_name, phone, topic, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?)`,
      )
      .run(id, input.rfqId, input.userId, input.date, input.time, input.type, input.company, input.contactName, input.phone, input.topic, now());
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new SlotTakenError("این زمان همین الان توسط سازمان دیگری رزرو شد. زمان دیگری انتخاب کنید.");
    throw e;
  }
  if (input.rfqId) addEvent("rfq", input.rfqId, "meeting_requested", `درخواست جلسه برای ${jDayLabel(input.date).weekday} ${jDayLabel(input.date).day}، ساعت ${faTime(input.time)} ثبت شد.`, "customer");
  addEvent("meeting", id, "requested", null, "customer");
  return getMeeting(id)!;
}

export function getMeeting(id: string): Meeting | null {
  const r = db().prepare("SELECT * FROM meetings WHERE id = ?").get(id) as MeetingRow | undefined;
  return r ? toMeeting(r) : null;
}

export function listMeetings(filter: { userId?: string; rfqId?: string } = {}): Meeting[] {
  let rows: MeetingRow[];
  if (filter.rfqId) rows = db().prepare("SELECT * FROM meetings WHERE rfq_id = ? ORDER BY date, time").all(filter.rfqId) as MeetingRow[];
  else if (filter.userId) rows = db().prepare("SELECT * FROM meetings WHERE user_id = ? ORDER BY date DESC, time").all(filter.userId) as MeetingRow[];
  else rows = db().prepare("SELECT * FROM meetings ORDER BY date DESC, time").all() as MeetingRow[];
  return rows.map(toMeeting);
}

const meetingTransitions: Record<MeetingStatus, MeetingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

export function setMeetingStatus(id: string, to: MeetingStatus, actor: string) {
  const m = getMeeting(id);
  if (!m) throw new Error("not found");
  if (!meetingTransitions[m.status].includes(to)) throw new Error("invalid transition");
  db().prepare("UPDATE meetings SET status = ? WHERE id = ?").run(to, id);
  addEvent("meeting", id, to, null, actor);
  if (m.rfqId) {
    const label = to === "confirmed" ? "جلسه توسط کارشناس تأیید شد." : to === "cancelled" ? "جلسه لغو شد." : "جلسه برگزار شد.";
    addEvent("rfq", m.rfqId, `meeting_${to}`, label, actor);
  }
}
