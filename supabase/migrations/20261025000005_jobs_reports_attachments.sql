-- Slice 6: lampiran, aturan nonaktif master, job terjadwal, dan 13 laporan tetap (view dengan security_invoker agar RLS cabang berlaku).

-- ---------------------------------------------------------------- lampiran
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('STOCK_DOC', 'STOCK_COUNT', 'SCHEDULE_CHANGE', 'INCIDENT', 'WORK_ORDER')),
  entity_id uuid not null,
  branch_id uuid not null references public.branches (id),
  storage_path text not null unique,
  file_name text not null,
  mime text,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now()
);
create index attachments_entity_idx on public.attachments (entity_type, entity_id);

-- apakah lampiran masih boleh ditambah / dihapus pada dokumen induk
create or replace function public._attachment_state(p_type text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare st text; br uuid;
begin
  case p_type
    when 'STOCK_DOC' then
      select status, branch_id into st, br from public.stock_documents where id = p_id;
      return jsonb_build_object('branch', br, 'add', st = 'DRAFT', 'delete', st = 'DRAFT');
    when 'STOCK_COUNT' then
      select status, branch_id into st, br from public.stock_counts where id = p_id;
      return jsonb_build_object('branch', br, 'add', st in ('OPEN', 'COUNTING'), 'delete', st in ('OPEN', 'COUNTING'));
    when 'SCHEDULE_CHANGE' then
      select status, branch_id into st, br from public.schedule_changes where id = p_id;
      return jsonb_build_object('branch', br, 'add', st in ('REQUESTED', 'REVISION'), 'delete', false);
    when 'INCIDENT' then
      select status, branch_id into st, br from public.incidents where id = p_id;
      return jsonb_build_object('branch', br, 'add', st <> 'CLOSED', 'delete', false);
    when 'WORK_ORDER' then
      select status, branch_id into st, br from public.work_orders where id = p_id;
      return jsonb_build_object('branch', br, 'add', st not in ('COMPLETED', 'CANCELLED'), 'delete', false);
  end case;
  return jsonb_build_object('branch', null, 'add', false, 'delete', false);
end $$;

create or replace function public.attachments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
  max_files integer := public.param_int('attachment.max_files', 5);
  max_mb integer := public.param_int('attachment.max_mb', 5);
begin
  s := public._attachment_state(coalesce(new.entity_type, old.entity_type), coalesce(new.entity_id, old.entity_id));
  if tg_op = 'DELETE' then
    if not (s ->> 'delete')::boolean then raise exception 'Lampiran tidak dapat dihapus setelah dokumen diajukan'; end if;
    return old;
  end if;
  if (s ->> 'branch') is null then raise exception 'Dokumen induk lampiran tidak ditemukan'; end if;
  if (s ->> 'branch')::uuid <> new.branch_id then raise exception 'Cabang lampiran tidak sesuai dokumen'; end if;
  if not (s ->> 'add')::boolean then raise exception 'Dokumen sudah tidak menerima lampiran baru'; end if;
  if (select count(*) from public.attachments where entity_type = new.entity_type and entity_id = new.entity_id) >= max_files then
    raise exception 'Maksimal % lampiran per dokumen', max_files;
  end if;
  if new.size_bytes > max_mb::bigint * 1048576 then raise exception 'Ukuran lampiran maksimal % MB', max_mb; end if;
  if new.mime is null or not (new.mime like 'image/%' or new.mime = 'application/pdf') then
    raise exception 'Lampiran harus berupa gambar atau PDF';
  end if;
  return new;
end $$;
create trigger attachments_guard before insert or delete on public.attachments
  for each row execute function public.attachments_guard();
create or replace function public.attachments_no_update() returns trigger
language plpgsql as $$ begin raise exception 'Lampiran tidak dapat diubah'; end $$;
create trigger attachments_no_update before update on public.attachments
  for each row execute function public.attachments_no_update();

alter table public.attachments enable row level security;
create policy attachments_select on public.attachments for select to authenticated
  using (public.can_see_branch(branch_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_branch(branch_id));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid());

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict (id) do nothing;
  end if;
exception when others then
  raise notice 'Bucket storage tidak dibuat: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- aturan nonaktif master (mengganti titik ekstensi slice 1)
create or replace function public.uom_locked(p_sparepart uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.stock_document_lines where sparepart_id = p_sparepart)
      or exists (select 1 from public.stock_balances where sparepart_id = p_sparepart)
      or exists (select 1 from public.wo_parts where sparepart_id = p_sparepart);
end $$;

create or replace function public.deactivation_block_reason(p_entity text, p_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  case p_entity
    when 'vehicles' then
      if exists (select 1 from public.work_orders where vehicle_id = p_id and status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS')) then
        return 'Kendaraan masih memiliki Work Order aktif';
      end if;
      if exists (select 1 from public.incidents where vehicle_id = p_id and status <> 'CLOSED') then
        return 'Kendaraan masih memiliki insiden yang belum ditutup';
      end if;
    when 'spareparts' then
      if exists (select 1 from public.stock_balances where sparepart_id = p_id and qty_on_hand > 0) then
        return 'Sparepart masih memiliki stok; kosongkan lebih dulu lewat mutasi';
      end if;
      if exists (select 1 from public.stock_document_lines l join public.stock_documents d on d.id = l.document_id
                 where l.sparepart_id = p_id and d.status in ('DRAFT', 'SUBMITTED', 'APPROVED')) then
        return 'Sparepart dipakai pada dokumen mutasi yang belum selesai';
      end if;
      if exists (select 1 from public.wo_parts p join public.work_orders w on w.id = p.work_order_id
                 where p.sparepart_id = p_id and w.status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS')) then
        return 'Sparepart dipakai pada Work Order aktif';
      end if;
    when 'locations' then
      if exists (select 1 from public.stock_balances where location_id = p_id and qty_on_hand > 0) then
        return 'Lokasi masih menyimpan stok';
      end if;
      if exists (select 1 from public.stock_counts where location_id = p_id and status in ('OPEN', 'COUNTING', 'REVIEW')) then
        return 'Lokasi sedang diopname';
      end if;
    when 'vendors' then
      if exists (select 1 from public.work_orders where vendor_id = p_id and status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS')) then
        return 'Vendor masih dipakai Work Order aktif';
      end if;
      if exists (select 1 from public.maintenance_plans where vendor_id = p_id and is_active) then
        return 'Vendor masih dipakai rencana perawatan aktif';
      end if;
    else
      null;
  end case;
  return null;
end $$;

-- ---------------------------------------------------------------- job terjadwal
create or replace function public._stock_low_alert() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select sp.id as sparepart_id, l.branch_id
    from public.spareparts sp
    join public.stock_balances b on b.sparepart_id = sp.id
    join public.locations l on l.id = b.location_id
    where sp.is_active and sp.min_stock > 0
    group by sp.id, sp.min_stock, l.branch_id
    having sum(b.qty_on_hand) < sp.min_stock
  loop
    perform public._stock_check_low(r.sparepart_id, r.branch_id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public._wo_validation_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  w record;
  n integer := 0;
  late boolean;
begin
  for w in
    select id, wo_no, branch_id, validation_due from public.work_orders
    where type = 'EMERGENCY' and emergency_validation = 'PENDING' and validation_due is not null
      and now() >= validation_due - interval '4 hours'
  loop
    late := now() > w.validation_due;
    perform public._notify_users(
      public._users_with_role('DEPT_HEAD', w.branch_id) || public._users_with_permission('approval.viewall', w.branch_id),
      'approval', case when late then 'Validasi WO emergensi TERLAMBAT' else 'Validasi WO emergensi segera jatuh tempo' end,
      w.wo_no || ' · batas ' || public._fmt_ts(w.validation_due), '/maintenance/work-orders/' || w.id,
      'val:' || w.id::text || ':' || to_char(now(), 'YYYYMMDDHH24'));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public._run_jobs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb := '{}'::jsonb;
begin
  res := res || jsonb_build_object('incident_escalation', public._incident_escalate());
  res := res || jsonb_build_object('approval_sla', public._approval_sla_check());
  res := res || jsonb_build_object('preventive_wo', public._wo_generate_preventive());
  res := res || jsonb_build_object('overdue', public._wo_mark_overdue());
  res := res || jsonb_build_object('low_stock', public._stock_low_alert());
  res := res || jsonb_build_object('emergency_validation', public._wo_validation_reminders());
  return res;
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('kbl-jobs', '* * * * *', 'select public._run_jobs()');
  end if;
exception when others then
  raise notice 'pg_cron tidak diaktifkan (job tetap dapat dipicu lewat /api/jobs/run): %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- laporan (RPT-01 … RPT-13)
create view public.rpt_01_mutasi with (security_invoker = true) as
select d.doc_no, d.doc_date as tgl, d.type as tipe, d.status, d.branch_id, sp.code as kode, sp.name as sparepart,
       l.qty, sp.uom as satuan, v.plate_no as kendaraan, w.wo_no, lf.name as dari, lt.name as ke
from public.stock_documents d
join public.stock_document_lines l on l.document_id = d.id
join public.spareparts sp on sp.id = l.sparepart_id
left join public.vehicles v on v.id = d.vehicle_id
left join public.work_orders w on w.id = d.work_order_id
left join public.locations lf on lf.id = l.from_location_id
left join public.locations lt on lt.id = l.to_location_id;

create view public.rpt_02_kartu_stok with (security_invoker = true) as
select (m.posted_at at time zone 'Asia/Jakarta')::date as tgl, m.posted_at as waktu, m.doc_no, m.doc_type as tipe, m.branch_id,
       m.sparepart_id, sp.code as kode, sp.name as sparepart, loc.name as lokasi,
       greatest(m.qty_delta, 0) as masuk, greatest(-m.qty_delta, 0) as keluar, m.balance_after as saldo
from public.stock_movements m
join public.spareparts sp on sp.id = m.sparepart_id
join public.locations loc on loc.id = m.location_id;

create view public.rpt_03_posisi_stok with (security_invoker = true) as
select current_date as tgl, l.branch_id, b.sparepart_id, b.location_id, sp.code as kode, sp.name as sparepart, sp.category as kategori, l.name as lokasi,
       b.qty_on_hand as on_hand, b.qty_reserved as reservasi, b.qty_on_hand - b.qty_reserved as tersedia, sp.min_stock as stok_min,
       (sum(b.qty_on_hand) over (partition by b.sparepart_id, l.branch_id)) < sp.min_stock as di_bawah_min
from public.stock_balances b
join public.spareparts sp on sp.id = b.sparepart_id
join public.locations l on l.id = b.location_id;

create view public.rpt_04_opname with (security_invoker = true) as
select (c.opened_at at time zone 'Asia/Jakarta')::date as tgl, c.count_no, c.branch_id, loc.name as lokasi, c.status,
       sp.code as kode, sp.name as sparepart, cl.system_qty as sistem, cl.counted_qty as fisik, cl.diff_qty as selisih,
       rc.name as alasan, cl.reason_note as keterangan
from public.stock_count_lines cl
join public.stock_counts c on c.id = cl.count_id
join public.locations loc on loc.id = c.location_id
join public.spareparts sp on sp.id = cl.sparepart_id
left join public.reason_codes rc on rc.id = cl.reason_code_id;

create view public.rpt_05_jadwal_realisasi with (security_invoker = true) as
select (coalesce(w.scheduled_start, w.due_at, w.created_at) at time zone 'Asia/Jakarta')::date as tgl, w.wo_no, w.branch_id,
       v.plate_no as kendaraan, w.type as jenis, coalesce(w.description, '-') as tugas, w.status,
       w.scheduled_start as rencana_mulai, w.actual_start as realisasi_mulai, w.actual_end as realisasi_selesai,
       round(extract(epoch from (w.actual_start - w.original_start)) / 3600.0, 1) as selisih_jam
from public.work_orders w join public.vehicles v on v.id = w.vehicle_id;

create view public.rpt_06_overdue with (security_invoker = true) as
select (w.due_at at time zone 'Asia/Jakarta')::date as tgl, w.wo_no, w.branch_id, v.plate_no as kendaraan,
       coalesce(w.description, '-') as tugas, w.due_at as jatuh_tempo,
       floor(extract(epoch from (now() - w.due_at)) / 86400)::integer as hari_terlambat
from public.work_orders w join public.vehicles v on v.id = w.vehicle_id
where w.is_overdue;

create view public.rpt_07_anomali with (security_invoker = true) as
select (s.requested_at at time zone 'Asia/Jakarta')::date as tgl, s.change_no, w.wo_no, s.branch_id, v.plate_no as kendaraan,
       case s.change_type when 'ADVANCE' then 'Percepatan' else 'Penundaan' end as tipe,
       s.old_start as jadwal_lama, s.new_start as jadwal_baru, round(s.delta_minutes / 1440.0, 2) as selisih_hari,
       rc.name as alasan, s.reason_note as keterangan, pr.name as pengaju, s.status as keputusan
from public.schedule_changes s
join public.work_orders w on w.id = s.work_order_id
join public.vehicles v on v.id = w.vehicle_id
join public.reason_codes rc on rc.id = s.reason_code_id
left join public.profiles pr on pr.id = s.requested_by;

create view public.rpt_08_rekap_alasan with (security_invoker = true) as
select date_trunc('month', s.requested_at at time zone 'Asia/Jakarta')::date as tgl, s.branch_id, rc.name as alasan,
       count(*)::integer as jumlah,
       count(*) filter (where s.change_type = 'ADVANCE')::integer as percepatan,
       count(*) filter (where s.change_type = 'POSTPONE')::integer as penundaan,
       round(avg(abs(s.delta_minutes)) / 1440.0, 2) as rata_selisih_hari
from public.schedule_changes s join public.reason_codes rc on rc.id = s.reason_code_id
group by 1, 2, 3;

create view public.rpt_09_riwayat_perawatan with (security_invoker = true) as
select (w.actual_end at time zone 'Asia/Jakarta')::date as tgl, w.wo_no, w.branch_id, v.plate_no as kendaraan, w.type as jenis,
       coalesce(w.description, '-') as pekerjaan, w.completion_note as catatan,
       (select string_agg(sp.name || ' ×' || trim_scale(p.qty_used)::text, ', ' order by sp.name)
        from public.wo_parts p join public.spareparts sp on sp.id = p.sparepart_id
        where p.work_order_id = w.id and p.qty_used > 0) as part_terpakai
from public.work_orders w join public.vehicles v on v.id = w.vehicle_id
where w.status = 'COMPLETED';

create view public.rpt_10_pemakaian_part with (security_invoker = true) as
select (m.posted_at at time zone 'Asia/Jakarta')::date as tgl, m.branch_id, v.plate_no as kendaraan, sp.code as kode,
       sp.name as sparepart, -m.qty_delta as qty, sp.uom as satuan, m.doc_no, w.wo_no
from public.stock_movements m
join public.vehicles v on v.id = m.vehicle_id
join public.spareparts sp on sp.id = m.sparepart_id
left join public.work_orders w on w.id = m.work_order_id
where m.doc_type = 'OUT' and m.qty_delta < 0;

create view public.rpt_11_insiden with (security_invoker = true) as
select (i.reported_at at time zone 'Asia/Jakarta')::date as tgl, i.incident_no, i.branch_id, v.plate_no as kendaraan,
       i.type as jenis, coalesce(i.address, '-') as lokasi, i.status, i.reported_at as waktu_lapor,
       i.acknowledged_at as waktu_ack, i.resolved_at as waktu_selesai,
       round(extract(epoch from (i.acknowledged_at - i.reported_at)) / 60.0, 1) as menit_ack, i.resolution_note as penanganan
from public.incidents i join public.vehicles v on v.id = i.vehicle_id
where not i.is_false_report;

create view public.rpt_12_waktu_respon with (security_invoker = true) as
select date_trunc('month', i.reported_at at time zone 'Asia/Jakarta')::date as tgl, i.branch_id,
       count(*)::integer as jumlah,
       round(avg(extract(epoch from (i.acknowledged_at - i.reported_at)) / 60.0)::numeric, 1) as rata_menit_ack,
       round(max(extract(epoch from (i.acknowledged_at - i.reported_at)) / 60.0)::numeric, 1) as maks_menit_ack,
       round(avg(extract(epoch from (i.resolved_at - i.reported_at)) / 60.0)::numeric, 1) as rata_menit_selesai
from public.incidents i
where not i.is_false_report
group by 1, 2;

create view public.rpt_13_kinerja_approval with (security_invoker = true) as
select date_trunc('month', r.requested_at at time zone 'Asia/Jakarta')::date as tgl, r.branch_id, r.doc_type as jenis,
       count(*)::integer as jumlah,
       round(avg(extract(epoch from (r.decided_at - r.requested_at)) / 3600.0) filter (where r.decided_at is not null)::numeric, 1) as rata_jam_proses,
       count(*) filter (where exists (select 1 from public.approval_actions a where a.request_id = r.id and a.action = 'SLA_BREACH'))::integer as terlambat_sla,
       count(*) filter (where exists (select 1 from public.approval_actions a where a.request_id = r.id and a.action = 'OVERRIDE'))::integer as override
from public.approval_requests r
group by 1, 2, 3;

grant select on public.attachments to authenticated;
grant insert, delete on public.attachments to authenticated;
grant all on public.attachments to service_role;
grant select on public.rpt_01_mutasi, public.rpt_02_kartu_stok, public.rpt_03_posisi_stok, public.rpt_04_opname,
  public.rpt_05_jadwal_realisasi, public.rpt_06_overdue, public.rpt_07_anomali, public.rpt_08_rekap_alasan,
  public.rpt_09_riwayat_perawatan, public.rpt_10_pemakaian_part, public.rpt_11_insiden, public.rpt_12_waktu_respon,
  public.rpt_13_kinerja_approval to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

select public._lockdown_functions();
