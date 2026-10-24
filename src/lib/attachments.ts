import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AttachmentEntity = "STOCK_DOC" | "STOCK_COUNT" | "SCHEDULE_CHANGE" | "INCIDENT" | "WORK_ORDER";

export const ENTITY_TABLE: Record<AttachmentEntity, string> = {
  STOCK_DOC: "stock_documents",
  STOCK_COUNT: "stock_counts",
  SCHEDULE_CHANGE: "schedule_changes",
  INCIDENT: "incidents",
  WORK_ORDER: "work_orders",
};

export const BUCKET = "attachments";

export interface AttachmentView {
  id: string;
  file_name: string;
  mime: string | null;
  size_bytes: number;
  uploaded_at: string;
  url: string | null;
  isImage: boolean;
}

/** Daftar lampiran sebuah dokumen beserta tautan unduh bertanda tangan (berlaku 1 jam). */
export async function listAttachments(entity: AttachmentEntity, entityId: string): Promise<AttachmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id,file_name,mime,size_bytes,uploaded_at,storage_path")
    .eq("entity_type", entity)
    .eq("entity_id", entityId)
    .order("uploaded_at");
  const rows = data ?? [];
  if (!rows.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return rows.map((r) => ({ ...r, url: null, isImage: !!r.mime?.startsWith("image/") }));
  }
  const { data: signed } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    mime: r.mime,
    size_bytes: r.size_bytes,
    uploaded_at: r.uploaded_at,
    url: urlBy.get(r.storage_path) ?? null,
    isImage: !!r.mime?.startsWith("image/"),
  }));
}
