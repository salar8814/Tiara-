// DEMO DATA — never loaded when TIARA_ENV=production (see src/lib/db.ts seedDemo,
// which also refuses to start if these records are found in a production DB).
//
// Stands in for Mammut Group's HR system and for staff role assignments so the
// eligibility states and role separation can be exercised in development/test.
// In production: HR records come from the HR integration or
// `npm run hr:import` (a CSV supplied by HR), and staff roles from `npm run staff:grant`.

export interface DirectoryRecord {
  mobile: string;
  name: string;
  employeeCode: string;
  unit: string;
  company: string;
  status: "active" | "pending" | "inactive";
}

export const demoDirectory: DirectoryRecord[] = [
  { mobile: "09121111111", name: "سارا احمدی", employeeCode: "10234", unit: "منابع انسانی", company: "گروه صنعتی ماموت", status: "active" },
  { mobile: "09122222222", name: "رضا کریمی", employeeCode: "11872", unit: "فروش و بازاریابی", company: "ماموت خودرو", status: "active" },
  { mobile: "09123333333", name: "مریم رضایی", employeeCode: "13540", unit: "مالی", company: "گروه صنعتی ماموت", status: "pending" },
  { mobile: "09124444444", name: "علی محمدی", employeeCode: "08811", unit: "تولید", company: "ماموت صنعت", status: "inactive" },
  { mobile: "09120000000", name: "مدیر سامانهٔ تیارا", employeeCode: "00001", unit: "فناوری اطلاعات", company: "تیارا", status: "active" },
  { mobile: "09126660001", name: "کارشناس فروش سازمانی", employeeCode: "00011", unit: "فروش سازمانی تیارا", company: "تیارا", status: "active" },
  { mobile: "09126660002", name: "کارشناس مالی", employeeCode: "00012", unit: "مالی تیارا", company: "تیارا", status: "active" },
  { mobile: "09126660003", name: "مسئول انبار", employeeCode: "00013", unit: "انبار تیارا", company: "تیارا", status: "active" },
];

export const demoStaff: { mobile: string; roles: ("admin" | "sales" | "finance" | "warehouse")[] }[] = [
  { mobile: "09120000000", roles: ["admin"] },
  { mobile: "09126660001", roles: ["sales"] },
  { mobile: "09126660002", roles: ["finance"] },
  { mobile: "09126660003", roles: ["warehouse"] },
];
