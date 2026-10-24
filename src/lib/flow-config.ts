// Metrik kondisi yang dapat dipakai pada level approval, per jenis dokumen. Harus sama dengan daftar di approval_flow_save (SQL).
export const FLOW_METRICS: Record<string, { value: string; label: string }[]> = {
  STOCK: [
    { value: "total_qty", label: "Total qty semua item" },
    { value: "item_count", label: "Jumlah item" },
  ],
  COUNT: [
    { value: "abs_diff_total", label: "Total selisih (absolut)" },
    { value: "diff_items", label: "Jumlah item berselisih" },
  ],
  SCHEDULE_CHANGE: [
    { value: "delta_days", label: "Selisih jadwal (hari)" },
    { value: "hq_level", label: "Perlu eskalasi pusat (1 = ya)" },
  ],
  EMERGENCY_WO: [],
};

export const FLOW_OPS = [">", ">=", "<", "<=", "="] as const;

export interface FlowStepInput {
  role: string;
  sla_hours: number;
  metric: string;
  op: string;
  value: string;
}
