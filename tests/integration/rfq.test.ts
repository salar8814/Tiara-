import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, tehranIsoDate } from "@/lib/format";
import {
  RfqStateError,
  confirmCorporateOrder,
  createRfq,
  decideQuotation,
  getCorporateOrderForRfq,
  getRfqById,
  issueQuotation,
  listQuotations,
  quotationTotals,
  transitionCorporateOrder,
  transitionRfq,
} from "@/lib/repo/rfqs";
import { upsertUserOnLogin } from "@/lib/repo/users";
import { NotAllowedError, decideOwnQuotation } from "@/lib/services/customer";
import { count } from "../helpers";

const items = [
  { productId: "b-nowruz", name: "بستهٔ هدیهٔ نوروزی", qty: 120, unitLabel: "بسته", customization: ["حکاکی روی شیشهٔ عطر"], note: "" },
  { productId: "p-viana-noir", name: "عطر ویانا — نوآر", qty: 300, unitLabel: "عدد", customization: [], note: "" },
];
const newRfq = (userId: string | null = null) =>
  createRfq({ userId, company: "شرکت آزمون", contactName: "آزمون", phone: "09125550000", occasion: "nowruz", budget: "1m-2m", deadline: addDays(tehranIsoDate(), 30), items });
const lines = [
  { productId: "b-nowruz", name: "x", qty: 120, unitLabel: "بسته", unitPrice: 2_450_000, note: "" },
  { productId: "p-viana-noir", name: "y", qty: 300, unitLabel: "عدد", unitPrice: 1_040_000, note: "" },
];
const quote = (rfqId: string, validUntil = addDays(tehranIsoDate(), 14), discount = 5_000_000) =>
  issueQuotation(rfqId, { lines, discount, validUntil, deliveryDate: addDays(tehranIsoDate(), 30), terms: null }, "staff:sales");

describe("RFQ → quotation → pro forma → confirmed order", () => {
  it("full lifecycle, with inquiry, quotation and order kept distinct", () => {
    const r = newRfq();
    expect(r.status).toBe("submitted");
    expect(count("SELECT COUNT(*) c FROM corporate_orders WHERE rfq_id = ?", r.id)).toBe(0);
    expect(() => quote(r.id)).toThrow(RfqStateError); // must be reviewed first
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id);
    expect(q).toMatchObject({ version: 1, status: "issued", subtotal: 606_000_000, discount: 5_000_000, vat: 60_100_000, total: 661_100_000 });
    expect(getRfqById(r.id)!.status).toBe("quoted");
    decideQuotation(q.id, "approved", "customer:x", null);
    const approved = listQuotations(r.id)[0];
    expect(approved.status).toBe("approved");
    expect(approved.proformaNumber).toMatch(/^PF-\d{4}-\d{5}$/);
    expect(getRfqById(r.id)!.status).toBe("approved");
    expect(getCorporateOrderForRfq(r.id)).toBeNull(); // approval is NOT an order
    const co = confirmCorporateOrder(r.id, "PO-77821", "staff:fin");
    expect(co).toMatchObject({ status: "confirmed", total: 661_100_000, reference: "PO-77821" });
    expect(getRfqById(r.id)!.status).toBe("converted");
    transitionCorporateOrder(co.id, "in_production", "staff:wh");
    expect(() => transitionCorporateOrder(co.id, "delivered", "staff:wh")).toThrow(RfqStateError);
  });

  it("VAT is applied after discount", () => {
    expect(quotationTotals(lines, 6_000_000)).toEqual({ subtotal: 606_000_000, discount: 6_000_000, vat: 60_000_000, total: 660_000_000 });
  });

  it("a corporate order cannot be confirmed twice or without approval", () => {
    const r = newRfq();
    expect(() => confirmCorporateOrder(r.id, "PO-1", "staff:fin")).toThrow(RfqStateError);
    transitionRfq(r.id, "in_review", "staff:sales");
    decideQuotation(quote(r.id).id, "approved", "customer:x", null);
    confirmCorporateOrder(r.id, "PO-2000", "staff:fin");
    expect(() => confirmCorporateOrder(r.id, "PO-2001", "staff:fin")).toThrow(RfqStateError);
    expect(count("SELECT COUNT(*) c FROM corporate_orders WHERE rfq_id = ?", r.id)).toBe(1);
  });

  it("invalid quotations are refused", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    expect(() => issueQuotation(r.id, { lines: [{ ...lines[0], unitPrice: 0 }], discount: 0, validUntil: "2099-01-01", deliveryDate: "2099-01-01", terms: null }, "s")).toThrow(RfqStateError);
    expect(() => issueQuotation(r.id, { lines, discount: 10_000_000_000, validUntil: "2099-01-01", deliveryDate: "2099-01-01", terms: null }, "s")).toThrow(RfqStateError);
  });

  it("workflow states cannot be forced through manual transitions", () => {
    const r = newRfq();
    expect(() => transitionRfq(r.id, "approved", "staff:sales")).toThrow(RfqStateError);
    expect(() => transitionRfq(r.id, "converted", "staff:sales")).toThrow(RfqStateError);
  });
});

describe("quotation versioning", () => {
  it("a new version supersedes the open one; the old version cannot be approved", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    const v1 = quote(r.id);
    const v2 = quote(r.id, undefined, 0);
    expect(v2.version).toBe(2);
    expect(listQuotations(r.id).find((q) => q.id === v1.id)!.status).toBe("superseded");
    expect(() => decideQuotation(v1.id, "approved", "customer:x", null)).toThrow(RfqStateError);
    expect(count("SELECT COUNT(*) c FROM quotations WHERE rfq_id = ? AND status = 'issued'", r.id)).toBe(1);
  });

  it("a declined quotation can be revised", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    decideQuotation(quote(r.id).id, "declined", "customer:x", "too expensive");
    expect(getRfqById(r.id)!.status).toBe("declined");
    const v2 = quote(r.id, undefined, 20_000_000);
    expect(v2.version).toBe(2);
    expect(getRfqById(r.id)!.status).toBe("quoted");
  });
});

describe("B-08: withdrawn prices cannot be accepted", () => {
  it("closing the RFQ withdraws its open quotation", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id);
    transitionRfq(r.id, "closed", "staff:sales");
    expect(listQuotations(r.id)[0].status).toBe("withdrawn");
    expect(() => decideQuotation(q.id, "approved", "customer:x", null)).toThrow(RfqStateError);
    expect(getRfqById(r.id)!.status).toBe("closed");
  });

  it("re-opening for revision withdraws the open quotation", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id);
    transitionRfq(r.id, "in_review", "staff:sales");
    expect(() => decideQuotation(q.id, "approved", "customer:x", null)).toThrow(RfqStateError);
    expect(getRfqById(r.id)!.status).toBe("in_review");
  });
});

describe("quotation expiration", () => {
  it("expired quotations cannot be approved and the RFQ returns to review", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id, addDays(tehranIsoDate(), -1));
    expect(listQuotations(r.id)[0].status).toBe("expired");
    expect(getRfqById(r.id)!.status).toBe("in_review");
    expect(() => decideQuotation(q.id, "approved", "customer:x", null)).toThrow(RfqStateError);
  });

  it("valid through the last day (Tehran calendar)", () => {
    const r = newRfq();
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id, tehranIsoDate());
    decideQuotation(q.id, "approved", "customer:x", null);
    expect(listQuotations(r.id)[0].status).toBe("approved");
  });
});

describe("B-15: approval requires the verified owner", () => {
  it("guests, other customers and staff cannot approve; the owner can", () => {
    const owner = upsertUserOnLogin("09125550000");
    const r = newRfq(owner.id);
    transitionRfq(r.id, "in_review", "staff:sales");
    const q = quote(r.id);
    expect(() => decideOwnQuotation(null, r.code, q.id, "approved", null)).toThrow(NotAllowedError);
    expect(() => decideOwnQuotation(upsertUserOnLogin("09129998888"), r.code, q.id, "approved", null)).toThrow(NotAllowedError);
    db().prepare("INSERT OR IGNORE INTO staff_roles (mobile, role, granted_by, granted_at) VALUES ('09126660001','sales','test','x')").run();
    expect(() => decideOwnQuotation(upsertUserOnLogin("09126660001"), r.code, q.id, "approved", null)).toThrow(NotAllowedError);
    expect(listQuotations(r.id)[0].status).toBe("issued");
    decideOwnQuotation(owner, r.code, q.id, "approved", null);
    expect(listQuotations(r.id)[0].status).toBe("approved");
  });

  it("decisions are audited", () => {
    expect(count("SELECT COUNT(*) c FROM audit_log WHERE action = 'quotation.approved'")).toBeGreaterThan(0);
  });
});
