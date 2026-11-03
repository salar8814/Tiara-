// Shared product taxonomy used by both channels.

export interface Category {
  id: string;
  name: string;
  short: string;
  description: string;
}

export const categories: Category[] = [
  {
    id: "fragrance",
    name: "عطر ویانا",
    short: "عطر",
    description: "ادوپرفیوم‌های ویانا با ماندگاری بالا، ساخت گروه ماموت",
  },
  {
    id: "personal-care",
    name: "مراقبت از دست و لب",
    short: "مراقبت شخصی",
    description: "کرم‌ها و بالم‌های مرطوب‌کننده برای استفادهٔ روزانه",
  },
  {
    id: "home",
    name: "رایحهٔ خانه",
    short: "رایحهٔ خانه",
    description: "شمع‌های دست‌ساز و خوشبوکننده‌های محیط",
  },
  {
    id: "car-care",
    name: "مراقبت از خودرو",
    short: "خودرو",
    description: "مکمل‌های سوخت و محصولات نگهداری خودرو",
  },
  {
    id: "gift-sets",
    name: "بسته‌های هدیه",
    short: "بستهٔ هدیه",
    description: "بسته‌های آماده برای هدیهٔ سازمانی و مناسبتی",
  },
];

export interface Occasion {
  id: string;
  name: string;
}

/** Corporate gifting occasions (B2B collections + RFQ form) */
export const occasions: Occasion[] = [
  { id: "nowruz", name: "نوروز" },
  { id: "yalda", name: "شب یلدا" },
  { id: "employee-day", name: "هدیهٔ روز کارمند" },
  { id: "onboarding", name: "خوش‌آمد کارکنان جدید" },
  { id: "client-gift", name: "هدیه به مشتریان و شرکا" },
  { id: "event", name: "همایش و رویداد" },
  { id: "fleet", name: "ناوگان و خودروهای سازمانی" },
  { id: "other", name: "سایر" },
];

export const categoryById = (id: string) => categories.find((c) => c.id === id);
export const occasionById = (id: string) => occasions.find((o) => o.id === id);
