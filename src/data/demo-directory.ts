// DEMO HR DIRECTORY — stands in for the real HR system until it is integrated.
// In production, eligibility must come from Mammut Group's HR/identity service
// (see src/lib/integrations/hr.ts). These records exist only to exercise the
// eligibility states and are labelled as demo data throughout the UI.

export interface DirectoryRecord {
  mobile: string;
  name: string;
  employeeCode: string;
  unit: string;
  company: string;
  status: "active" | "pending" | "inactive";
  admin?: boolean;
}

export const demoDirectory: DirectoryRecord[] = [
  { mobile: "09121111111", name: "سارا احمدی", employeeCode: "10234", unit: "منابع انسانی", company: "گروه صنعتی ماموت", status: "active" },
  { mobile: "09122222222", name: "رضا کریمی", employeeCode: "11872", unit: "فروش و بازاریابی", company: "ماموت خودرو", status: "active" },
  { mobile: "09123333333", name: "مریم رضایی", employeeCode: "13540", unit: "مالی", company: "گروه صنعتی ماموت", status: "pending" },
  { mobile: "09124444444", name: "علی محمدی", employeeCode: "08811", unit: "تولید", company: "ماموت صنعت", status: "inactive" },
  { mobile: "09120000000", name: "مدیر فروش تیارا", employeeCode: "00001", unit: "فروش سازمانی تیارا", company: "تیارا", status: "active", admin: true },
];
