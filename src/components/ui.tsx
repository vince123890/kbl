import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const tones = {
    neutral: "bg-background text-muted border border-border",
    good: "bg-brand-soft text-brand-strong",
    bad: "bg-danger-soft text-danger",
    warn: "bg-warn-soft",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones}`}>{children}</span>;
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-muted">{total} data</p>;
  const link = "tap inline-flex items-center rounded-lg border border-border px-3 text-sm hover:bg-background";
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted">
        {total} data · halaman {page} dari {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={link} href={hrefFor(page - 1)}>Sebelumnya</Link> : <span className={`${link} opacity-40`}>Sebelumnya</span>}
        {page < pages ? <Link className={link} href={hrefFor(page + 1)}>Berikutnya</Link> : <span className={`${link} opacity-40`}>Berikutnya</span>}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</div>;
}
