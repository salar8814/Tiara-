// Business rules kept as data so they can be reviewed and changed in one place.

export const storeRules = {
  currency: "تومان",
  /** Iranian VAT rate applied to B2B quotations (B2C prices are VAT-inclusive) */
  vatRate: 0.1,
  deliveryMethods: [
    {
      id: "courier",
      name: "ارسال پستی / پیک به نشانی",
      description: "تهران ۲ تا ۳ روز کاری، سایر شهرها ۳ تا ۵ روز کاری",
      fee: 80_000,
      freeOver: 3_000_000,
      requiresAddress: true,
    },
    {
      id: "workplace",
      name: "تحویل در محل کار",
      description: "تحویل از طریق واحد اداری در دفتر مرکزی گروه، بدون هزینه",
      fee: 0,
      freeOver: 0,
      requiresAddress: false,
    },
  ],
  /** Employee price applies only to users whose HR eligibility is "eligible" */
  employeePriceRequiresEligibility: true,
  orderCodePrefix: "TS",
  rfqCodePrefix: "RFQ",
  corporateOrderPrefix: "CO",
  proformaPrefix: "PF",
  quotationValidityDays: 14,
};

export const b2bRules = {
  budgetRanges: [
    { id: "lt500", name: "کمتر از ۵۰۰ هزار تومان برای هر بسته" },
    { id: "500-1m", name: "۵۰۰ هزار تا ۱ میلیون تومان" },
    { id: "1m-2m", name: "۱ تا ۲ میلیون تومان" },
    { id: "gt2m", name: "بیش از ۲ میلیون تومان" },
    { id: "unknown", name: "هنوز مشخص نیست" },
  ],
  meeting: {
    /** working days ahead that can be booked */
    daysAhead: 10,
    /** Iranian work week: Saturday (6) … Wednesday (3). JS getDay(): 0=Sun … 6=Sat */
    workingDays: [6, 0, 1, 2, 3],
    slots: ["09:00", "10:30", "12:00", "14:00", "15:30"],
    types: [
      { id: "onsite_client", name: "حضوری در محل سازمان" },
      { id: "onsite_tiara", name: "حضوری در دفتر تیارا" },
      { id: "online", name: "جلسهٔ آنلاین" },
    ],
    durationMinutes: 45,
  },
  /** Sales team response SLA in working days */
  responseSlaDays: 1,
};
