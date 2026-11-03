import { InquiryBar } from "@/components/inquiry-bar";

// Everything under /corporate uses the terracotta channel accent.
export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-channel="b2b">
      {children}
      <InquiryBar />
    </div>
  );
}
