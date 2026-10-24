"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type ActionResult } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyDbError } from "@/lib/pg-errors";
import { BUCKET, ENTITY_TABLE, type AttachmentEntity } from "@/lib/attachments";

const ENTITIES = Object.keys(ENTITY_TABLE);

function safeName(name: string): string {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80) || "berkas";
}

/**
 * Unggah lampiran. Urutan: baris basis data dulu (RLS + aturan jumlah/ukuran/tipe/status dokumen),
 * baru berkas ke storage; bila storage gagal, baris dibatalkan agar tidak ada lampiran yatim.
 */
export async function uploadAttachmentAction(entity: AttachmentEntity, entityId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };
  if (!ENTITIES.includes(entity)) return { ok: false, error: "Jenis dokumen tidak dikenal" };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Pilih berkas terlebih dahulu" };

  const supabase = await createClient();
  const { data: parent } = await supabase.from(ENTITY_TABLE[entity]).select("branch_id").eq("id", entityId).maybeSingle();
  if (!parent) return { ok: false, error: "Dokumen tidak ditemukan" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "Penyimpanan berkas belum dikonfigurasi" };
  const admin = createAdminClient();

  let done = 0;
  for (const file of files) {
    const path = `${entity}/${entityId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { data: row, error } = await supabase
      .from("attachments")
      .insert({
        entity_type: entity,
        entity_id: entityId,
        branch_id: parent.branch_id,
        storage_path: path,
        file_name: file.name.slice(0, 160),
        mime: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `${file.name}: ${friendlyDbError(error)}` };
    const up = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      await admin.from("attachments").delete().eq("id", row.id);
      return { ok: false, error: `${file.name}: gagal menyimpan berkas (${up.error.message})` };
    }
    done++;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${done} lampiran ditambahkan` };
}

export async function deleteAttachmentAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login kembali" };
  const supabase = await createClient();
  const { data: row } = await supabase.from("attachments").select("storage_path").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Lampiran tidak ditemukan" };
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) await createAdminClient().storage.from(BUCKET).remove([row.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Lampiran dihapus" };
}
