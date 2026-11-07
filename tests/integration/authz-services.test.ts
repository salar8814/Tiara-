import { beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/authz";
import { db } from "@/lib/db";
import { reconcile } from "@/lib/repo/inventory";
import { createOrder, getOrderById } from "@/lib/repo/orders";
import { getVariant } from "@/lib/repo/products";
import { createRfq, getRfqById, transitionRfq } from "@/lib/repo/rfqs";
import { addAddress, createSession, deleteAddress, getAddress, getUser, listAddresses, upsertUserOnLogin, userForSession } from "@/lib/repo/users";
import {
  ValidationError,
  adjustStock,
  assignRfqOwner,
  changeOrderStatus,
  changeStaffRole,
  confirmRfqOrder,
  issueRfqQuotation,
  recordPayment,
  updatePricing,
} from "@/lib/services/admin";
import { getOwnOrder } from "@/lib/services/customer";
import type { User } from "@/lib/types";
import { count, setStockViaLedger, staffUser, stockOf } from "../helpers";

const V = "v-viana-noir-50";
let customer: User, employee: User, sales: User, finance: User, warehouse: User, admin: User;

beforeAll(() => {
  customer = upsertUserOnLogin("09129990001");
  employee = upsertUserOnLogin("09121111111"); // eligible employee, no staff role
  sales = staffUser("09126660001", ["sales"]);
  finance = staffUser("09126660002", ["finance"]);
  warehouse = staffUser("09126660003", ["warehouse"]);
  admin = staffUser("09120000000", ["admin"]);
  setStockViaLedger(V, 10);
});

const newOrder = () => createOrder({ user: employee, lines: [{ variantId: V, qty: 1 }], deliveryMethod: "workplace", address: null, paymentMethod: "gateway" });

describe("admin operations are denied to non-staff and to the wrong role", () => {
  it("anonymous, customers and ordinary employees can do nothing", () => {
    const o = newOrder();
    for (const actor of [null, customer, employee]) {
      expect(() => updatePricing(actor, V, { retailPrice: 1, employeePrice: 1, maxPerOrder: 1 })).toThrow(ForbiddenError);
      expect(() => adjustStock(actor, V, 100, "steal stock")).toThrow(ForbiddenError);
      expect(() => recordPayment(actor, o.id, "BANK-FAKE-1")).toThrow(ForbiddenError);
      expect(() => changeOrderStatus(actor, o.id, "cancelled", null)).toThrow(ForbiddenError);
      expect(() => changeStaffRole(actor, actor?.mobile ?? "09120000001", "admin", true)).toThrow(ForbiddenError);
    }
    expect(getOrderById(o.id)!.status).toBe("pending_payment");
    expect(getVariant(V)!.retailPrice).toBe(1_850_000);
  });

  it("sales cannot touch money or stock", () => {
    const o = newOrder();
    expect(() => recordPayment(sales, o.id, "BANK-SALES-1")).toThrow(ForbiddenError);
    expect(() => adjustStock(sales, V, 5, "count")).toThrow(ForbiddenError);
    expect(() => updatePricing(sales, V, { retailPrice: 2, employeePrice: 1, maxPerOrder: 1 })).toThrow(ForbiddenError);
  });

  it("warehouse cannot record payments, change prices, or cancel paid orders", () => {
    const o = newOrder();
    expect(() => recordPayment(warehouse, o.id, "BANK-WH-0001")).toThrow(ForbiddenError);
    expect(() => updatePricing(warehouse, V, { retailPrice: 2, employeePrice: 1, maxPerOrder: 1 })).toThrow(ForbiddenError);
    recordPayment(finance, o.id, "BANK-WH-0002");
    expect(() => changeOrderStatus(warehouse, o.id, "cancelled", null)).toThrow(ForbiddenError);
    changeOrderStatus(warehouse, o.id, "processing", null); // allowed: fulfilment
    expect(getOrderById(o.id)!.status).toBe("processing");
  });

  it("finance cannot adjust stock, fulfil orders, issue quotations or grant roles", () => {
    const o = newOrder();
    recordPayment(finance, o.id, "BANK-FIN-0001");
    expect(() => adjustStock(finance, V, 1, "count")).toThrow(ForbiddenError);
    expect(() => changeOrderStatus(finance, o.id, "processing", null)).toThrow(ForbiddenError);
    expect(() => changeStaffRole(finance, "09120000099", "admin", true)).toThrow(ForbiddenError);
    const r = createRfq({ userId: null, company: "x", contactName: "x", phone: "09125550001", occasion: "nowruz", budget: "unknown", deadline: "2099-01-01", items: [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", customization: [], note: "" }] });
    transitionRfq(r.id, "in_review", "staff:sales");
    expect(() => issueRfqQuotation(finance, r.id, { lines: [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", unitPrice: 10, note: "" }], discount: 0, validUntil: "2099-01-01", deliveryDate: "2099-01-01", terms: null })).toThrow(ForbiddenError);
    expect(() => confirmRfqOrder(sales, r.id, "PO-1234")).toThrow(ForbiddenError);
  });

  it("sales can quote, but only for items that are in the RFQ", () => {
    const r = createRfq({ userId: null, company: "x", contactName: "x", phone: "09125550002", occasion: "nowruz", budget: "unknown", deadline: "2099-01-01", items: [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", customization: [], note: "" }] });
    transitionRfq(r.id, "in_review", "staff:sales");
    expect(() => issueRfqQuotation(sales, r.id, { lines: [{ productId: "p-viana-noir", name: "x", qty: 1, unitLabel: "عدد", unitPrice: 1, note: "" }], discount: 0, validUntil: "2099-01-01", deliveryDate: "2099-01-01", terms: null })).toThrow(ValidationError);
    const q = issueRfqQuotation(sales, r.id, { lines: [{ productId: "b-nowruz", name: "x", qty: 100, unitLabel: "بسته", unitPrice: 2_000_000, note: "" }], discount: 0, validUntil: "2099-01-01", deliveryDate: "2099-01-01", terms: null });
    expect(q.status).toBe("issued");
    expect(() => assignRfqOwner(sales, r.id, finance.mobile)).toThrow(ValidationError); // owner must be sales
    assignRfqOwner(sales, r.id, sales.mobile);
    expect(getRfqById(r.id)!.assignedTo).toBe(sales.mobile);
  });
});

describe("B-06: stock adjustments are deltas and never lose reservations", () => {
  it("a reservation made while the admin form was open is preserved", () => {
    setStockViaLedger(V, 10);
    newOrder(); // 9
    adjustStock(warehouse, V, 5, "رسید انبار 4512"); // 14, not "10 + 5"
    expect(stockOf(V)).toBe(14);
    expect(() => adjustStock(warehouse, V, -100, "write-off")).toThrow(ValidationError);
    expect(() => adjustStock(warehouse, V, 3, "")).toThrow(ValidationError); // reason required
    expect(reconcile()).toEqual([]);
  });
});

describe("pricing validation", () => {
  it("employee price cannot exceed retail; values must be sane", () => {
    expect(() => updatePricing(admin, V, { retailPrice: 100, employeePrice: 200, maxPerOrder: 3 })).toThrow(ValidationError);
    expect(() => updatePricing(admin, V, { retailPrice: 0, employeePrice: 0, maxPerOrder: 3 })).toThrow(ValidationError);
    expect(() => updatePricing(admin, V, { retailPrice: 100, employeePrice: 50, maxPerOrder: 0 })).toThrow(ValidationError);
    expect(() => updatePricing(admin, V, { retailPrice: 1.5, employeePrice: 1, maxPerOrder: 1 })).toThrow(ValidationError);
  });

  it("price changes are audited with before/after; past orders keep their price", () => {
    const o = newOrder();
    updatePricing(admin, V, { retailPrice: 1_900_000, employeePrice: 1_300_000, maxPerOrder: 3 });
    const row = db().prepare("SELECT * FROM audit_log WHERE action = 'variant.pricing' AND entity_id = ? ORDER BY id DESC LIMIT 1").get(V) as { before: string; after: string; actor: string };
    expect(JSON.parse(row.before).employeePrice).toBe(1_295_000);
    expect(JSON.parse(row.after).employeePrice).toBe(1_300_000);
    expect(row.actor).toBe(`staff:${admin.mobile}`);
    expect(getOrderById(o.id)!.items[0].unitPrice).toBe(1_295_000);
    updatePricing(admin, V, { retailPrice: 1_850_000, employeePrice: 1_295_000, maxPerOrder: 3 });
  });

  it("the audit log and inventory ledger are append-only", () => {
    expect(() => db().prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
    expect(() => db().prepare("UPDATE inventory_movements SET delta = 1").run()).toThrow(/append-only/);
  });
});

describe("staff role management", () => {
  it("granting a role ends that person's sessions; the last admin cannot be removed", () => {
    const target = upsertUserOnLogin("09127771234");
    const { token } = createSession(target.id);
    expect(userForSession(token)).not.toBeNull();
    changeStaffRole(admin, target.mobile, "sales", true);
    expect(userForSession(token)).toBeNull();
    expect(count("SELECT COUNT(*) c FROM staff_roles WHERE mobile = ? AND role = 'sales'", target.mobile)).toBe(1);
    expect(() => changeStaffRole(admin, admin.mobile, "admin", false)).toThrow(ValidationError);
    db().prepare("DELETE FROM staff_roles WHERE role = 'admin' AND mobile <> ?").run(admin.mobile);
    const other = staffUser("09127779999", ["admin"]);
    changeStaffRole(other, admin.mobile, "admin", false); // ok, another admin remains
    const reloaded = getUser(admin.id)!; // the app re-resolves the actor from the DB on every request
    expect(reloaded.staffRoles).toEqual([]);
    expect(() => changeStaffRole(reloaded, other.mobile, "admin", false)).toThrow(ForbiddenError);
  });

  it("rejects invalid role names and mobiles", () => {
    const a = staffUser("09120000000", ["admin"]);
    expect(() => changeStaffRole(a, "09127770000", "superuser" as never, true)).toThrow(ValidationError);
    expect(() => changeStaffRole(a, "12345", "sales", true)).toThrow(ValidationError);
  });
});

describe("customer data isolation (IDOR)", () => {
  it("orders are only visible to their owner", () => {
    const o = newOrder();
    expect(getOwnOrder(employee, o.code)?.id).toBe(o.id);
    expect(getOwnOrder(customer, o.code)).toBeNull();
  });

  it("addresses cannot be read or deleted by another user", () => {
    const a = addAddress(employee.id, { label: "خانه", recipient: "سارا احمدی", mobile: "09121111111", province: "تهران", city: "تهران", street: "خیابان ولیعصر کوچه بهار", plaque: "12", unit: "4", postalCode: "1433875911" }, true);
    expect(getAddress(customer.id, a.id)).toBeNull();
    deleteAddress(customer.id, a.id);
    expect(getAddress(employee.id, a.id)).not.toBeNull();
    expect(listAddresses(customer.id)).toHaveLength(0);
  });
});
