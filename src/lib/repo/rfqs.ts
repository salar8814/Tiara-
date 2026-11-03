import "server-only";
import { storeRules } from "@/data/rules";
import { db, newId, now } from "../db";
import { corporateOrderTransitions, rfqTransitions } from "../status";
import type {
  CorporateOrder,
  CorporateOrderStatus,
  Quotation,
  QuotationLine,
  Rfq,
  RfqItem,
  RfqStatus,
} from "../types";
import { addEvent, listEvents, uniqueCode } from "./common";

interface RfqRow {
  id: string;
  code: string;
  user_id: string | null;
  status: RfqStatus;
  company: string;
  contact_name: string;
  phone: string;
  email: string | null;
  department: string | null;
  occasion: string;
  budget: string;
  customization: string | null;
  deadline: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function hydrate(r: RfqRow): Rfq {
  const items = (
    db().prepare("SELECT * FROM rfq_items WHERE rfq_id = ?").all(r.id) as {
      product_id: string;
      name: string;
      qty: number;
      unit_label: string;
      customization: string;
      note: string;
    }[]
  ).map<RfqItem>((i) => ({
    productId: i.product_id,
    name: i.name,
    qty: i.qty,
    unitLabel: i.unit_label,
    customization: JSON.parse(i.customization),
    note: i.note,
  }));
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    status: r.status,
    company: r.company,
    contactName: r.contact_name,
    phone: r.phone,
    email: r.email,
    department: r.department,
    occasion: r.occasion,
    budget: r.budget,
    customization: r.customization,
    deadline: r.deadline,
    notes: r.notes,
    items,
    events: listEvents("rfq", r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface NewRfq {
  userId: string | null;
  company: string;
  contactName: string;
  phone: string;
  email?: string;
  department?: string;
  occasion: string;
  budget: string;
  customization?: string;
  deadline: string;
  notes?: string;
  items: RfqItem[];
}

export function createRfq(input: NewRfq): Rfq {
  const id = newId();
  const tx = db().transaction(() => {
    const code = uniqueCode(storeRules.rfqCodePrefix, "rfqs");
    const ts = now();
    db()
      .prepare(
        `INSERT INTO rfqs (id, code, user_id, status, company, contact_name, phone, email, department, occasion, budget, customization, deadline, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, code, input.userId, input.company, input.contactName, input.phone, input.email ?? null, input.department ?? null,
        input.occasion, input.budget, input.customization ?? null, input.deadline, input.notes ?? null, ts, ts,
      );
    const ins = db().prepare(
      "INSERT INTO rfq_items (rfq_id, product_id, name, qty, unit_label, customization, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const i of input.items) ins.run(id, i.productId, i.name, i.qty, i.unitLabel, JSON.stringify(i.customization), i.note);
    addEvent("rfq", id, "submitted", "استعلام ثبت شد. این درخواست هنوز سفارش یا تعهد خرید نیست.", "customer");
  });
  tx();
  return getRfqById(id)!;
}

export function getRfqById(id: string): Rfq | null {
  const r = db().prepare("SELECT * FROM rfqs WHERE id = ?").get(id) as RfqRow | undefined;
  return r ? hydrate(r) : null;
}

export function getRfqByCode(code: string): Rfq | null {
  const r = db().prepare("SELECT * FROM rfqs WHERE code = ?").get(code) as RfqRow | undefined;
  return r ? hydrate(r) : null;
}

export function listRfqs(filter: { userId?: string; status?: RfqStatus } = {}): Rfq[] {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.userId) {
    where.push("user_id = ?");
    args.push(filter.userId);
  }
  if (filter.status) {
    where.push("status = ?");
    args.push(filter.status);
  }
  const rows = db()
    .prepare(`SELECT * FROM rfqs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`)
    .all(...args) as RfqRow[];
  return rows.map(hydrate);
}

/** Link guest RFQs to an account when the contact phone matches the verified login mobile. */
export function claimRfqsForUser(userId: string, mobile: string) {
  db().prepare("UPDATE rfqs SET user_id = ? WHERE user_id IS NULL AND phone = ?").run(userId, mobile);
  db().prepare("UPDATE meetings SET user_id = ? WHERE user_id IS NULL AND phone = ?").run(userId, mobile);
}

export function transitionRfq(id: string, to: RfqStatus, actor: string, note: string | null = null) {
  const r = getRfqById(id);
  if (!r) throw new Error("not found");
  if (!rfqTransitions[r.status].includes(to)) throw new Error(`invalid transition ${r.status} → ${to}`);
  db().prepare("UPDATE rfqs SET status = ?, updated_at = ? WHERE id = ?").run(to, now(), id);
  addEvent("rfq", id, to, note, actor);
}

// ── quotations ──

interface QuotationRow {
  id: string;
  rfq_id: string;
  version: number;
  status: Quotation["status"];
  lines: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  valid_until: string;
  delivery_date: string;
  terms: string | null;
  proforma_number: string | null;
  created_at: string;
  decided_at: string | null;
}

const toQuotation = (r: QuotationRow): Quotation => ({
  id: r.id,
  rfqId: r.rfq_id,
  version: r.version,
  status: r.status,
  lines: JSON.parse(r.lines),
  subtotal: r.subtotal,
  discount: r.discount,
  vat: r.vat,
  total: r.total,
  validUntil: r.valid_until,
  deliveryDate: r.delivery_date,
  terms: r.terms,
  proformaNumber: r.proforma_number,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
});

export function listQuotations(rfqId: string): Quotation[] {
  expireQuotations(rfqId);
  return (db().prepare("SELECT * FROM quotations WHERE rfq_id = ? ORDER BY version DESC").all(rfqId) as QuotationRow[]).map(toQuotation);
}

function expireQuotations(rfqId: string) {
  const today = new Date().toISOString().slice(0, 10);
  db().prepare("UPDATE quotations SET status = 'expired' WHERE rfq_id = ? AND status = 'issued' AND valid_until < ?").run(rfqId, today);
}

export function quotationTotals(lines: QuotationLine[], discount: number) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const taxable = Math.max(0, subtotal - discount);
  const vat = Math.round(taxable * storeRules.vatRate);
  return { subtotal, discount, vat, total: taxable + vat };
}

export function issueQuotation(
  rfqId: string,
  input: { lines: QuotationLine[]; discount: number; validUntil: string; deliveryDate: string; terms: string | null },
  actor: string,
): Quotation {
  const id = newId();
  const tx = db().transaction(() => {
    const rfq = getRfqById(rfqId);
    if (!rfq) throw new Error("not found");
    if (!["in_review", "quoted", "declined"].includes(rfq.status)) throw new Error("RFQ is not open for quotation");
    const prev = db().prepare("SELECT COALESCE(MAX(version),0) v FROM quotations WHERE rfq_id = ?").get(rfqId) as { v: number };
    db().prepare("UPDATE quotations SET status = 'superseded' WHERE rfq_id = ? AND status = 'issued'").run(rfqId);
    const t = quotationTotals(input.lines, input.discount);
    db()
      .prepare(
        `INSERT INTO quotations (id, rfq_id, version, status, lines, subtotal, discount, vat, total, valid_until, delivery_date, terms, proforma_number, created_at, decided_at)
         VALUES (?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
      )
      .run(id, rfqId, prev.v + 1, JSON.stringify(input.lines), t.subtotal, t.discount, t.vat, t.total, input.validUntil, input.deliveryDate, input.terms, now());
    if (rfq.status !== "quoted") {
      db().prepare("UPDATE rfqs SET status = 'quoted', updated_at = ? WHERE id = ?").run(now(), rfqId);
    }
    addEvent("rfq", rfqId, "quoted", `پیشنهاد قیمت نسخهٔ ${(prev.v + 1).toLocaleString("fa-IR")} صادر شد.`, actor);
  });
  tx();
  return toQuotation(db().prepare("SELECT * FROM quotations WHERE id = ?").get(id) as QuotationRow);
}

/** Customer decision. Approval issues a pro forma invoice number; it is still not a confirmed order. */
export function decideQuotation(quotationId: string, decision: "approved" | "declined", actor: string, note: string | null) {
  const tx = db().transaction(() => {
    const q = db().prepare("SELECT * FROM quotations WHERE id = ?").get(quotationId) as QuotationRow | undefined;
    if (!q) throw new Error("not found");
    expireQuotations(q.rfq_id);
    const fresh = db().prepare("SELECT status FROM quotations WHERE id = ?").get(quotationId) as { status: string };
    if (fresh.status !== "issued") throw new Error("quotation is not awaiting a decision");
    const proforma = decision === "approved" ? uniqueCode(storeRules.proformaPrefix, "quotations", "proforma_number") : null;
    db()
      .prepare("UPDATE quotations SET status = ?, proforma_number = ?, decided_at = ? WHERE id = ?")
      .run(decision, proforma, now(), quotationId);
    db().prepare("UPDATE rfqs SET status = ?, updated_at = ? WHERE id = ?").run(decision, now(), q.rfq_id);
    addEvent(
      "rfq",
      q.rfq_id,
      decision,
      decision === "approved" ? `پیشنهاد قیمت تأیید شد و پیش‌فاکتور ${proforma} صادر شد.${note ? ` — ${note}` : ""}` : `پیشنهاد قیمت رد شد.${note ? ` دلیل: ${note}` : ""}`,
      actor,
    );
  });
  tx();
}

// ── corporate orders ──

interface CoRow {
  id: string;
  code: string;
  rfq_id: string;
  quotation_id: string;
  status: CorporateOrderStatus;
  total: number;
  reference: string;
  created_at: string;
}

const toCo = (r: CoRow): CorporateOrder => ({
  id: r.id,
  code: r.code,
  rfqId: r.rfq_id,
  quotationId: r.quotation_id,
  status: r.status,
  total: r.total,
  reference: r.reference,
  createdAt: r.created_at,
});

/** Sales confirms the order once payment or a purchase order against the pro forma is received. */
export function confirmCorporateOrder(rfqId: string, reference: string, actor: string): CorporateOrder {
  const id = newId();
  const tx = db().transaction(() => {
    const rfq = getRfqById(rfqId);
    if (!rfq || rfq.status !== "approved") throw new Error("RFQ has no approved quotation");
    const q = db().prepare("SELECT * FROM quotations WHERE rfq_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1").get(rfqId) as
      | QuotationRow
      | undefined;
    if (!q) throw new Error("no approved quotation");
    const code = uniqueCode(storeRules.corporateOrderPrefix, "corporate_orders");
    db()
      .prepare("INSERT INTO corporate_orders (id, code, rfq_id, quotation_id, status, total, reference, created_at) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)")
      .run(id, code, rfqId, q.id, q.total, reference, now());
    db().prepare("UPDATE rfqs SET status = 'converted', updated_at = ? WHERE id = ?").run(now(), rfqId);
    addEvent("rfq", rfqId, "converted", `سفارش قطعی ${code} ثبت شد (مرجع پرداخت/سفارش خرید: ${reference}).`, actor);
    addEvent("corporate_order", id, "confirmed", null, actor);
  });
  tx();
  return toCo(db().prepare("SELECT * FROM corporate_orders WHERE id = ?").get(id) as CoRow);
}

export function getCorporateOrderForRfq(rfqId: string): (CorporateOrder & { events: ReturnType<typeof listEvents> }) | null {
  const r = db().prepare("SELECT * FROM corporate_orders WHERE rfq_id = ?").get(rfqId) as CoRow | undefined;
  return r ? { ...toCo(r), events: listEvents("corporate_order", r.id) } : null;
}

export function listCorporateOrders(userId?: string): (CorporateOrder & { rfqCode: string; company: string })[] {
  const rows = (
    userId
      ? db()
          .prepare(
            "SELECT c.*, r.code AS rfq_code, r.company FROM corporate_orders c JOIN rfqs r ON r.id = c.rfq_id WHERE r.user_id = ? ORDER BY c.created_at DESC",
          )
          .all(userId)
      : db().prepare("SELECT c.*, r.code AS rfq_code, r.company FROM corporate_orders c JOIN rfqs r ON r.id = c.rfq_id ORDER BY c.created_at DESC").all()
  ) as (CoRow & { rfq_code: string; company: string })[];
  return rows.map((r) => ({ ...toCo(r), rfqCode: r.rfq_code, company: r.company }));
}

export function transitionCorporateOrder(id: string, to: CorporateOrderStatus, actor: string) {
  const r = db().prepare("SELECT * FROM corporate_orders WHERE id = ?").get(id) as CoRow | undefined;
  if (!r) throw new Error("not found");
  if (!corporateOrderTransitions[r.status].includes(to)) throw new Error("invalid transition");
  db().prepare("UPDATE corporate_orders SET status = ? WHERE id = ?").run(to, id);
  addEvent("corporate_order", id, to, null, actor);
}
