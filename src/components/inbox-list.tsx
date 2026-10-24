"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui";
import { approvalBatchApproveAction } from "@/app/(app)/approvals/actions";

export interface InboxRow {
  id: string;
  docType: string;
  docLabel: string;
  docNo: string;
  summary: string;
  requester: string;
  branch: string;
  requestedAt: string;
  age: string;
  level: string;
  late: boolean;
  sla: string;
  batchable: boolean;
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const anyBatch = rows.some((r) => r.batchable);

  return (
    <>
      {anyBatch && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <ActionButton
            tone="primary"
            label={`Setujui terpilih (${picked.length})`}
            confirm={`Setujui ${picked.length} dokumen sekaligus? Hanya mutasi Masuk yang dapat disetujui massal.`}
            action={() => approvalBatchApproveAction(picked).then((r) => (r.ok ? (setPicked([]), r) : r))}
          />
          <span className="text-xs text-muted">Maksimal 20. Tolak dan revisi tetap satu per satu.</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted">
            <tr>
              {anyBatch && <th className="w-10 px-3 py-2" />}
              <th className="px-3 py-2 font-medium">Jenis</th>
              <th className="px-3 py-2 font-medium">No. Dokumen</th>
              <th className="px-3 py-2 font-medium">Ringkasan</th>
              <th className="px-3 py-2 font-medium">Diajukan oleh</th>
              <th className="px-3 py-2 font-medium">Umur</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                {anyBatch && (
                  <td className="px-3 py-2">
                    {r.batchable && (
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${r.docNo}`}
                        checked={picked.includes(r.id)}
                        onChange={() => toggle(r.id)}
                        disabled={!picked.includes(r.id) && picked.length >= 20}
                        className="h-4 w-4"
                      />
                    )}
                  </td>
                )}
                <td className="px-3 py-2 align-top">{r.docLabel}</td>
                <td className="px-3 py-2 align-top">
                  <Link href={`/approvals/${r.id}`} className="font-medium underline decoration-brand decoration-2 underline-offset-2">
                    {r.docNo}
                  </Link>
                </td>
                <td className="px-3 py-2 align-top">{r.summary}</td>
                <td className="px-3 py-2 align-top">
                  {r.requester}
                  <span className="block text-xs text-muted">{r.branch}</span>
                </td>
                <td className="px-3 py-2 align-top">{r.age}</td>
                <td className="px-3 py-2 align-top">{r.level}</td>
                <td className="px-3 py-2 align-top">{r.late ? <Badge tone="bad">Terlambat</Badge> : <span className="text-muted">{r.sla}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
