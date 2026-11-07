import { describe, expect, it } from "vitest";
import { b2bRules } from "@/data/rules";
import { MAX_ACTIVE_MEETINGS_PER_PHONE, SlotTakenError, bookableDays, requestMeeting, setMeetingStatus } from "@/lib/repo/meetings";
import { AddressLimitError, MAX_ADDRESSES, addAddress, upsertUserOnLogin } from "@/lib/repo/users";

const base = { rfqId: null, userId: null, type: "online" as const, company: "x", contactName: "x", topic: null };

describe("meetings", () => {
  it("one active booking per slot", () => {
    const [d] = bookableDays();
    requestMeeting({ ...base, date: d, time: b2bRules.meeting.slots[0], phone: "09125550100" });
    expect(() => requestMeeting({ ...base, date: d, time: b2bRules.meeting.slots[0], phone: "09125550101" })).toThrow(SlotTakenError);
  });

  it(`at most ${MAX_ACTIVE_MEETINGS_PER_PHONE} active requests per phone (slot-exhaustion abuse)`, () => {
    const days = bookableDays();
    const phone = "09125550200";
    requestMeeting({ ...base, date: days[1], time: b2bRules.meeting.slots[0], phone });
    const m2 = requestMeeting({ ...base, date: days[1], time: b2bRules.meeting.slots[1], phone });
    expect(() => requestMeeting({ ...base, date: days[1], time: b2bRules.meeting.slots[2], phone })).toThrow(SlotTakenError);
    setMeetingStatus(m2.id, "cancelled", "staff:sales"); // cancelling frees the slot and the quota
    requestMeeting({ ...base, date: days[1], time: b2bRules.meeting.slots[1], phone });
  });

  it("only working days in the booking window and configured slots are bookable", () => {
    const days = bookableDays();
    expect(days).toHaveLength(b2bRules.meeting.daysAhead);
    for (const d of days) expect(b2bRules.meeting.workingDays).toContain(new Date(`${d}T12:00:00Z`).getUTCDay());
    expect(() => requestMeeting({ ...base, date: "2000-01-01", time: "09:00", phone: "09125550300" })).toThrow(SlotTakenError);
    expect(() => requestMeeting({ ...base, date: days[2], time: "03:00", phone: "09125550300" })).toThrow(SlotTakenError);
  });

  it("invalid meeting transitions are refused", () => {
    const days = bookableDays();
    const m = requestMeeting({ ...base, date: days[3], time: b2bRules.meeting.slots[0], phone: "09125550400" });
    expect(() => setMeetingStatus(m.id, "completed", "s")).toThrow();
    setMeetingStatus(m.id, "confirmed", "s");
    setMeetingStatus(m.id, "completed", "s");
    expect(() => setMeetingStatus(m.id, "cancelled", "s")).toThrow();
  });
});

describe("address book", () => {
  it(`is capped at ${MAX_ADDRESSES} addresses per user`, () => {
    const u = upsertUserOnLogin("09121119999");
    const a = { label: "x", recipient: "x y", mobile: "09121119999", province: "تهران", city: "تهران", street: "خیابان آزمون پلاک", plaque: "1", unit: "", postalCode: "1433875911" };
    for (let i = 0; i < MAX_ADDRESSES; i++) addAddress(u.id, a, false);
    expect(() => addAddress(u.id, a, false)).toThrow(AddressLimitError);
  });
});
