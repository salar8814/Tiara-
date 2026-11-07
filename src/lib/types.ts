// Shared domain model for both purchasing journeys.
// One product model serves B2C (employee store) and B2B (corporate sales);
// channel-specific rules live in `b2c` / `b2b` blocks instead of separate catalogs.

export type Channel = "b2c" | "b2b";

export type ArtShape =
  | "perfume"
  | "tube"
  | "balm"
  | "candle"
  | "diffuser"
  | "spray"
  | "car"
  | "box";

export interface ProductArt {
  shape: ArtShape;
  /** background tone */
  bg: string;
  /** main object colour */
  body: string;
  /** cap / label / accent colour */
  accent: string;
}

export interface Variant {
  id: string;
  productId: string;
  label: string;
  sku: string;
  /** Consumer (retail) price in Toman, VAT included */
  retailPrice: number;
  /** Employee price in Toman, VAT included */
  employeePrice: number;
  stock: number;
  /** Per-order cap for discounted employee purchases */
  maxPerOrder: number;
}

export interface PriceTier {
  minQty: number;
  /** Indicative unit price in Toman, excluding VAT and customisation */
  unitPrice: number;
}

export interface CustomizationOption {
  id: string;
  label: string;
  /** additional lead time in days */
  extraLeadDays: number;
}

export interface B2BConfig {
  /** minimum order quantity (units or packs) */
  moq: number;
  /** quantity must be a multiple of this (carton size) */
  step: number;
  unitLabel: string;
  /**
   * "tiered": indicative volume bands shown to signed-in buyers.
   * "quote": never show a price — depends on customisation/contract.
   */
  priceMode: "tiered" | "quote";
  tiers: PriceTier[];
  customization: CustomizationOption[];
  leadTimeDays: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  kind: "single" | "bundle";
  channels: Channel[];
  summary: string;
  description: string;
  highlights: string[];
  /** bundle contents, human readable */
  components: string[];
  occasions: string[];
  art: ProductArt;
  b2b: B2BConfig | null;
  active: boolean;
  sort: number;
  variants: Variant[];
}

export type Eligibility = "eligible" | "pending" | "ineligible" | "not_employee";
export type Role = "employee" | "customer";
/** Staff duties are separate from the customer role (see src/lib/authz.ts). */
export type StaffRole = "admin" | "sales" | "finance" | "warehouse";

export interface User {
  id: string;
  mobile: string;
  name: string | null;
  role: Role;
  eligibility: Eligibility;
  employeeCode: string | null;
  unit: string | null;
  company: string | null;
  staffRoles: StaffRole[];
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  plaque: string;
  unit: string;
  postalCode: string;
  isDefault: boolean;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "gateway" | "payroll";
export type PaymentStatus = "unpaid" | "paid" | "paid_sandbox" | "failed" | "refund_pending" | "refunded";

export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  qty: number;
  unitRetail: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  code: string;
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  refundRef: string | null;
  deliveryMethod: string;
  subtotalRetail: number;
  employeeDiscount: number;
  shipping: number;
  total: number;
  address: Omit<Address, "id" | "userId" | "isDefault" | "label"> | null;
  items: OrderItem[];
  events: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  status: string;
  note: string | null;
  actor: string;
  createdAt: string;
}

/**
 * RFQ lifecycle. An inquiry (RFQ) is NOT an order:
 * submitted → in_review → quoted → approved → converted (confirmed corporate order)
 * Side exits: declined (customer), closed (sales).
 */
export type RfqStatus =
  | "submitted"
  | "in_review"
  | "quoted"
  | "approved"
  | "converted"
  | "declined"
  | "closed";

export interface RfqItem {
  productId: string;
  name: string;
  qty: number;
  unitLabel: string;
  customization: string[];
  note: string;
}

export interface Rfq {
  id: string;
  code: string;
  userId: string | null;
  status: RfqStatus;
  company: string;
  contactName: string;
  phone: string;
  email: string | null;
  department: string | null;
  occasion: string;
  budget: string;
  customization: string | null;
  deadline: string; // ISO date
  notes: string | null;
  /** staff mobile of the sales owner */
  assignedTo: string | null;
  items: RfqItem[];
  events: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export type QuotationStatus = "issued" | "approved" | "declined" | "superseded" | "expired" | "withdrawn";

export interface QuotationLine {
  productId: string;
  name: string;
  qty: number;
  unitLabel: string;
  unitPrice: number;
  note: string;
}

export interface Quotation {
  id: string;
  rfqId: string;
  version: number;
  status: QuotationStatus;
  lines: QuotationLine[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  validUntil: string;
  deliveryDate: string;
  terms: string | null;
  proformaNumber: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type CorporateOrderStatus = "confirmed" | "in_production" | "shipped" | "delivered";

export interface CorporateOrder {
  id: string;
  code: string;
  rfqId: string;
  quotationId: string;
  status: CorporateOrderStatus;
  total: number;
  reference: string;
  createdAt: string;
}

export type MeetingStatus = "requested" | "confirmed" | "cancelled" | "completed";
export type MeetingType = "onsite_client" | "onsite_tiara" | "online";

export interface Meeting {
  id: string;
  rfqId: string | null;
  userId: string | null;
  date: string; // ISO yyyy-mm-dd
  time: string; // HH:mm
  type: MeetingType;
  status: MeetingStatus;
  company: string;
  contactName: string;
  phone: string;
  topic: string | null;
  createdAt: string;
}
