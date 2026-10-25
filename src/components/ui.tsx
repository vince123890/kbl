import Link from "next/link";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Judul halaman. Di ponsel, tombol aksi turun ke baris sendiri dan berbagi lebar agar semuanya terlihat. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions flex flex-wrap items-start gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const tones = {
    neutral: "bg-background text-muted border border-border",
    good: "bg-brand-soft text-foreground",
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

export function StatusBadge({
  map,
  value,
}: {
  map: Record<string, { label: string; tone?: "neutral" | "good" | "bad" | "warn" }>;
  value: string | null | undefined;
}) {
  const def = value ? map[value] : undefined;
  return <Badge tone={def?.tone ?? "neutral"}>{def?.label ?? value ?? "-"}</Badge>;
}

export const TABLE_WRAP = "overflow-x-auto rounded-xl border border-border bg-surface";
export const TH = "px-3 py-2 font-medium";
export const TD = "px-3 py-2 align-top";

/** Memberi tiap sel `data-label` = nama kolomnya, dipakai tampilan kartu di ponsel. */
function withLabels(children: ReactNode, head: ReactNode[]): ReactNode {
  return Children.toArray(children).map((row) => {
    if (!isValidElement(row) || row.type !== "tr") return row;
    const tr = row as ReactElement<{ children?: ReactNode }>;
    let i = 0;
    const cells = Children.toArray(tr.props.children).map((c) => {
      if (!isValidElement(c) || c.type !== "td") return c;
      const span = (c.props as { colSpan?: number }).colSpan ?? 1;
      const h = head[i];
      i += span;
      return cloneElement(c as ReactElement<Record<string, unknown>>, { "data-label": typeof h === "string" ? h : "" });
    });
    return cloneElement(tr, undefined, cells);
  });
}

/**
 * Tabel standar. Di layar lebar berupa tabel; di ponsel (< 768px) tiap baris menjadi kartu yang menampilkan
 * semua kolom bertumpuk beserta tombol aksinya, tanpa perlu geser ke samping.
 */
export function DataTable({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className={`${TABLE_WRAP} table-cards-wrap`}>
      <table className="table-cards w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-0">{withLabels(children, head)}</tbody>
      </table>
    </div>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Pasangan label–nilai untuk ringkasan dokumen. */
export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
          <dd className="mt-0.5">{v === null || v === undefined || v === "" ? <span className="text-muted">-</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "good"; children: ReactNode }) {
  const t = { warn: "bg-warn-soft", bad: "bg-danger-soft text-danger", good: "bg-brand-soft" }[tone];
  return (
    <p role={tone === "bad" ? "alert" : "status"} className={`mb-4 rounded-lg px-3 py-2 text-sm ${t}`}>
      {children}
    </p>
  );
}

export function ButtonLink({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`tap inline-flex items-center rounded-lg px-4 text-sm font-medium ${
        primary ? "bg-brand text-on-brand hover:bg-brand-strong" : "border border-border hover:bg-brand-soft"
      }`}
    >
      {children}
    </Link>
  );
}
