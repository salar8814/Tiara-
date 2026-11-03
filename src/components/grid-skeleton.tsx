import { Container } from "./ui";

export function GridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <Container className="pt-8" >
      <div aria-busy aria-label="در حال بارگذاری" className="space-y-6">
        <div className="h-4 w-40 animate-pulse rounded bg-sunken" />
        <div className="h-9 w-72 animate-pulse rounded bg-sunken" />
        <div className="h-12 animate-pulse rounded-lg bg-sunken" />
        <div className={`grid grid-cols-2 gap-4 ${cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {Array.from({ length: cols * 2 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="aspect-[4/3.4] animate-pulse bg-sunken" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-1/3 animate-pulse rounded bg-sunken" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
                <div className="h-9 animate-pulse rounded bg-sunken" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
