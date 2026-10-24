import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanQuery, one } from "@/lib/lookups";

export interface MovementRow {
  id: string;
  doc_no: string;
  doc_date: string;
  type: string;
  status: string;
  branch_id: string;
  created_by: string | null;
  vehicles: { plate_no: string } | null;
  work_orders: { wo_no: string } | null;
  from_loc: { name: string } | null;
  to_loc: { name: string } | null;
  stock_document_lines: { count: number }[];
}

type Sp = Record<string, string | string[] | undefined>;

/** Id dokumen yang cocok dengan kata kunci: no. dokumen, no. polisi, atau kode/nama sparepart. */
async function matchingDocIds(supabase: SupabaseClient, q: string): Promise<string[]> {
  const [byNo, plates, parts] = await Promise.all([
    supabase.from("stock_documents").select("id").ilike("doc_no", `%${q}%`).limit(500),
    supabase.from("vehicles").select("id").ilike("plate_no", `%${q}%`).limit(100),
    supabase.from("spareparts").select("id").or(`code.ilike.%${q}%,name.ilike.%${q}%`).limit(100),
  ]);
  const ids = new Set((byNo.data ?? []).map((d) => d.id as string));
  const vIds = (plates.data ?? []).map((v) => v.id as string);
  if (vIds.length) {
    const { data } = await supabase.from("stock_documents").select("id").in("vehicle_id", vIds).limit(500);
    for (const d of data ?? []) ids.add(d.id as string);
  }
  const pIds = (parts.data ?? []).map((p) => p.id as string);
  if (pIds.length) {
    const { data } = await supabase.from("stock_document_lines").select("document_id").in("sparepart_id", pIds).limit(1000);
    for (const d of data ?? []) ids.add(d.document_id as string);
  }
  return [...ids];
}

const SELECT =
  "id,doc_no,doc_date,type,status,branch_id,created_by,vehicles(plate_no),work_orders(wo_no)," +
  "from_loc:locations!stock_documents_from_location_id_fkey(name),to_loc:locations!stock_documents_to_location_id_fkey(name),stock_document_lines(count)";

/** Query daftar mutasi dengan filter dari URL; dipakai halaman daftar dan ekspor CSV. */
export async function queryMovements(supabase: SupabaseClient, sp: Sp, range?: [number, number]) {
  let query = supabase.from("stock_documents").select(SELECT, { count: "exact" });
  if (one(sp, "type")) query = query.eq("type", one(sp, "type"));
  if (one(sp, "status")) query = query.eq("status", one(sp, "status"));
  if (one(sp, "branch")) query = query.eq("branch_id", one(sp, "branch"));
  if (one(sp, "vehicle")) query = query.eq("vehicle_id", one(sp, "vehicle"));
  if (one(sp, "creator")) query = query.eq("created_by", one(sp, "creator"));
  if (one(sp, "from")) query = query.gte("doc_date", one(sp, "from"));
  if (one(sp, "to")) query = query.lte("doc_date", one(sp, "to"));
  const q = cleanQuery(one(sp, "q"));
  if (q) {
    const ids = await matchingDocIds(supabase, q);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  query = query.order("doc_date", { ascending: false }).order("created_at", { ascending: false });
  if (range) query = query.range(range[0], range[1]);
  const { data, count, error } = await query;
  return { rows: (data ?? []) as unknown as MovementRow[], count: count ?? 0, error };
}
