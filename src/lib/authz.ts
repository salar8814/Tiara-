// Server-side authorization model. Every privileged operation calls `assertCan`
// with the actor resolved from the session cookie — never from client input.
//
// Separation of duties (decision recorded in docs/ARCHITECTURE_DECISIONS.md ADR-004):
//   sales     — RFQs, quotations, meetings, customer lookup
//   finance   — payment recording, refunds, corporate order confirmation, cancellations of paid orders
//   warehouse — stock adjustments, fulfilment (processing/shipped/delivered), corporate production/shipping
//   admin     — everything above plus catalog prices/settings, staff roles and the audit log

import type { StaffRole, User } from "./types";

export type Permission =
  | "staff.dashboard"
  | "catalog.edit"
  | "inventory.adjust"
  | "orders.view"
  | "orders.fulfil"
  | "orders.cancel_unpaid"
  | "orders.cancel_paid"
  | "payments.record"
  | "refunds.record"
  | "rfq.manage"
  | "quotes.issue"
  | "corporate_orders.confirm"
  | "corporate_orders.fulfil"
  | "meetings.manage"
  | "customers.view"
  | "audit.view"
  | "staff.manage";

const grants: Record<StaffRole, Permission[]> = {
  sales: ["staff.dashboard", "orders.view", "rfq.manage", "quotes.issue", "meetings.manage", "customers.view"],
  finance: ["staff.dashboard", "orders.view", "orders.cancel_unpaid", "orders.cancel_paid", "payments.record", "refunds.record", "corporate_orders.confirm", "customers.view"],
  warehouse: ["staff.dashboard", "orders.view", "orders.fulfil", "orders.cancel_unpaid", "inventory.adjust", "corporate_orders.fulfil"],
  admin: [],
};
const all = Array.from(new Set(Object.values(grants).flat())).concat(["catalog.edit", "audit.view", "staff.manage"] as Permission[]);
grants.admin = all;

export class ForbiddenError extends Error {
  constructor(public permission: Permission) {
    super(`forbidden: ${permission}`);
  }
}

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.staffRoles.some((r) => grants[r].includes(permission));
}

export function assertCan(user: User | null | undefined, permission: Permission): asserts user is User {
  if (!can(user, permission)) throw new ForbiddenError(permission);
}

export const isStaff = (user: User | null | undefined) => !!user && user.staffRoles.length > 0;

/** Stable actor string for audit trails. */
export const actorOf = (user: User) => `staff:${user.mobile}`;

export const staffRoleLabels: Record<StaffRole, string> = {
  admin: "مدیر سامانه",
  sales: "فروش سازمانی",
  finance: "مالی",
  warehouse: "انبار",
};
