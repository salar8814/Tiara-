import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { Container, PageHeader } from "@/components/ui";
import { tehranIsoDate } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { b2bSnapshot } from "@/lib/snapshot";

export const metadata: Metadata = { title: "فهرست استعلام" };

export default async function InquiryPage() {
  const user = await currentUser();
  return (
    <Container>
      <PageHeader
        crumbs={[{ href: "/", label: "دنیای تیارا" }, { href: "/corporate", label: "خرید سازمانی" }, { label: "فهرست استعلام" }]}
        title="فهرست استعلام و درخواست قیمت"
        lead="تعداد و سفارشی‌سازی هر قلم را مشخص کنید و جزئیات مناسبت را بنویسید. پس از ثبت، کد پیگیری دریافت می‌کنید."
      />
      <InquiryForm
        catalog={b2bSnapshot(!!user)}
        today={tehranIsoDate()}
        defaults={{ company: user?.company, contactName: user?.name, phone: user?.mobile, department: user?.unit }}
      />
    </Container>
  );
}
