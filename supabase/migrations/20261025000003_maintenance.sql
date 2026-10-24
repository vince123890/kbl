-- Slice 4: perawatan dan penjadwalan. Rencana, Work Order, reservasi part, perubahan jadwal (anomali), job preventif dan overdue.

-- ---------------------------------------------------------------- rencana perawatan
create table public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id),
  branch_id uuid not null references public.branches (id),
  task_name text not null,
  interval_days integer check (interval_days is null or interval_days > 0),
  interval_km integer check (interval_km is null or interval_km > 0),
  last_done_at date,
  last_done_km numeric(12, 1),
  next_due_at date,
  next_due_km numeric(12, 1),
  vendor_id uuid references public.vendors (id),
  lead_days integer check (lead_days is null or lead_days >= 0),
  lead_km integer check (lead_km is null or lead_km >= 0),
  notes text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint maintenance_plans_interval check (interval_days is not null or interval_km is not null)
);
create index maintenance_plans_vehicle_idx on public.maintenance_plans (vehicle_id);

create table public.maintenance_plan_parts (
  plan_id uuid not null references public.maintenance_plans (id) on delete cascade,
  sparepart_id uuid not null references public.spareparts (id),
  qty numeric(14, 3) not null check (qty > 0),
  primary key (plan_id, sparepart_id)
);

create or replace function public.maintenance_plans_calc() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.vehicles;
begin
  select * into v from public.vehicles where id = new.vehicle_id;
  if not found then raise exception 'Kendaraan tidak ditemukan'; end if;
  new.branch_id := v.branch_id;
  if tg_op = 'INSERT' or new.interval_days is distinct from old.interval_days or new.interval_km is distinct from old.interval_km
     or new.last_done_at is distinct from old.last_done_at or new.last_done_km is distinct from old.last_done_km then
    new.next_due_at := case when new.interval_days is not null
      then coalesce(new.last_done_at, (now() at time zone 'Asia/Jakarta')::date) + new.interval_days end;
    new.next_due_km := case when new.interval_km is not null
      then coalesce(new.last_done_km, v.odometer) + new.interval_km end;
  end if;
  return new;
end $$;
create trigger maintenance_plans_calc before insert or update on public.maintenance_plans
  for each row execute function public.maintenance_plans_calc();
create trigger maintenance_plans_touch before insert or update on public.maintenance_plans
  for each row execute function public.touch_row();
create trigger maintenance_plans_audit after insert or update on public.maintenance_plans
  for each row execute function public.audit_row('id');

-- ---------------------------------------------------------------- work order
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  wo_no text not null unique,
  branch_id uuid not null references public.branches (id),
  vehicle_id uuid not null references public.vehicles (id),
  type text not null check (type in ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY')),
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status text not null default 'PLANNED' check (status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  plan_id uuid references public.maintenance_plans (id),
  incident_id uuid,
  source_note text,
  vendor_id uuid references public.vendors (id),
  assignee_id uuid references public.profiles (id),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  original_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  due_at timestamptz,
  is_overdue boolean not null default false,
  description text,
  completion_note text,
  end_odometer numeric(12, 1),
  auto_generated boolean not null default false,
  schedule_changed boolean not null default false,
  needs_reschedule boolean not null default false,
  emergency_validation text not null default 'NONE' check (emergency_validation in ('NONE', 'PENDING', 'VALIDATED', 'REJECTED', 'REVISION')),
  validation_due timestamptz,
  cancel_reason text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint work_orders_range check (scheduled_start is null or scheduled_end is null or scheduled_end > scheduled_start)
);
create index work_orders_vehicle_idx on public.work_orders (vehicle_id, scheduled_start);
create index work_orders_status_idx on public.work_orders (status, due_at);
create index work_orders_branch_idx on public.work_orders (branch_id, scheduled_start);
create unique index work_orders_one_active_per_plan on public.work_orders (plan_id)
  where plan_id is not null and status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS');

create table public.wo_parts (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id),
  sparepart_id uuid not null references public.spareparts (id),
  location_id uuid references public.locations (id),
  qty_planned numeric(14, 3) not null check (qty_planned >= 0),
  qty_used numeric(14, 3) not null default 0 check (qty_used >= 0),
  qty_reserved_applied numeric(14, 3) not null default 0 check (qty_reserved_applied >= 0),
  unique (work_order_id, sparepart_id)
);

alter table public.stock_documents
  add constraint stock_documents_wo_fk foreign key (work_order_id) references public.work_orders (id);

create trigger work_orders_touch before insert or update on public.work_orders
  for each row execute function public.touch_row();
create trigger work_orders_audit after insert or update on public.work_orders
  for each row execute function public.audit_row('id', 'is_overdue,needs_reschedule');

create or replace function public.work_orders_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Work Order tidak dapat dihapus; gunakan batal'; end if;
  if old.status <> new.status and not (
       (old.status = 'PLANNED' and new.status in ('SCHEDULED', 'IN_PROGRESS', 'CANCELLED'))
    or (old.status = 'SCHEDULED' and new.status in ('PLANNED', 'IN_PROGRESS', 'CANCELLED'))
    or (old.status = 'IN_PROGRESS' and new.status in ('COMPLETED', 'CANCELLED'))) then
    raise exception 'Perubahan status WO % → % tidak diperbolehkan', old.status, new.status;
  end if;
  return new;
end $$;
create trigger work_orders_guard before update or delete on public.work_orders
  for each row execute function public.work_orders_guard();

-- ---------------------------------------------------------------- perubahan jadwal
create table public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  change_no text not null unique,
  work_order_id uuid not null references public.work_orders (id),
  branch_id uuid not null references public.branches (id),
  change_type text not null check (change_type in ('ADVANCE', 'POSTPONE')),
  old_start timestamptz not null,
  old_end timestamptz not null,
  new_start timestamptz not null,
  new_end timestamptz not null,
  delta_minutes integer not null,
  reason_code_id uuid not null references public.reason_codes (id),
  reason_note text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'REVISION', 'WITHDRAWN')),
  was_overdue boolean not null default false,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_note text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint schedule_changes_range check (new_end > new_start)
);
create unique index schedule_changes_one_open on public.schedule_changes (work_order_id) where status in ('REQUESTED', 'REVISION');
create index schedule_changes_branch_idx on public.schedule_changes (branch_id, requested_at desc);
create trigger schedule_changes_touch before insert or update on public.schedule_changes
  for each row execute function public.touch_row();
create trigger schedule_changes_audit after insert or update on public.schedule_changes
  for each row execute function public.audit_row('id');
create or replace function public.schedule_changes_no_delete() returns trigger
language plpgsql as $$ begin raise exception 'Jejak anomali jadwal tidak boleh dihapus'; end $$;
create trigger schedule_changes_no_delete before delete on public.schedule_changes
  for each row execute function public.schedule_changes_no_delete();

-- ---------------------------------------------------------------- RLS
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_plan_parts enable row level security;
alter table public.work_orders enable row level security;
alter table public.wo_parts enable row level security;
alter table public.schedule_changes enable row level security;

create policy plans_select on public.maintenance_plans for select to authenticated
  using (public.can_see_branch(branch_id) and (public.has_permission('plan.write') or public.has_permission('master.read')));
create policy plans_insert on public.maintenance_plans for insert to authenticated
  with check (public.has_permission('plan.write'));
create policy plans_update on public.maintenance_plans for update to authenticated
  using (public.has_permission('plan.write') and public.can_see_branch(branch_id))
  with check (public.has_permission('plan.write'));
create policy plan_parts_select on public.maintenance_plan_parts for select to authenticated
  using (exists (select 1 from public.maintenance_plans p where p.id = plan_id));
create policy plan_parts_write on public.maintenance_plan_parts for all to authenticated
  using (public.has_permission('plan.write') and exists (select 1 from public.maintenance_plans p where p.id = plan_id))
  with check (public.has_permission('plan.write') and exists (select 1 from public.maintenance_plans p where p.id = plan_id));

create policy work_orders_select on public.work_orders for select to authenticated
  using (public.has_permission('wo.read') and public.can_see_branch(branch_id)
         and (public.has_permission('master.read')
              or vehicle_id in (select v.id from public.vehicles v where v.main_driver_id = auth.uid())));
create policy wo_parts_select on public.wo_parts for select to authenticated
  using (exists (select 1 from public.work_orders w where w.id = work_order_id));
create policy schedule_changes_select on public.schedule_changes for select to authenticated
  using (public.can_see_branch(branch_id)
         and (public.has_permission('schedule.request') or public.has_permission('approval.act') or public.has_permission('wo.execute')));

-- ---------------------------------------------------------------- pembantu
create or replace function public._fmt_ts(t timestamptz) returns text
language sql immutable as $$ select to_char(t at time zone 'Asia/Jakarta', 'DD/MM HH24:MI') $$;

-- WO aktif yang bentrok (kendaraan atau teknisi sama dan rentang beririsan)
create or replace function public._wo_conflicts(p_vehicle uuid, p_assignee uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns table (id uuid, wo_no text, scheduled_start timestamptz, scheduled_end timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select w.id, w.wo_no, w.scheduled_start, w.scheduled_end,
         case when w.vehicle_id = p_vehicle then 'VEHICLE' else 'ASSIGNEE' end
  from public.work_orders w
  where w.status in ('SCHEDULED', 'IN_PROGRESS')
    and w.id is distinct from p_exclude
    and w.scheduled_start is not null and w.scheduled_end is not null
    and w.scheduled_start < p_end and p_start < w.scheduled_end
    and (w.vehicle_id = p_vehicle or (p_assignee is not null and w.assignee_id = p_assignee));
$$;

create or replace function public._wo_conflict_message(p_vehicle uuid, p_assignee uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  plate text;
  who text;
begin
  select * into c from public._wo_conflicts(p_vehicle, p_assignee, p_start, p_end, p_exclude) limit 1;
  if not found then return null; end if;
  if c.kind = 'VEHICLE' then
    select plate_no into plate from public.vehicles where id = p_vehicle;
    return format('Kendaraan %s sudah dijadwalkan pada %s–%s (%s)', plate, public._fmt_ts(c.scheduled_start),
                  to_char(c.scheduled_end at time zone 'Asia/Jakarta', 'HH24:MI'), c.wo_no);
  end if;
  select name into who from public.profiles where id = p_assignee;
  return format('Teknisi %s sudah bertugas pada %s–%s (%s)', who, public._fmt_ts(c.scheduled_start),
                to_char(c.scheduled_end at time zone 'Asia/Jakarta', 'HH24:MI'), c.wo_no);
end $$;

-- menyelaraskan reservasi stok dengan kebutuhan part WO (idempoten)
create or replace function public._wo_sync_reservation(p_wo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  r record;
  desired numeric;
  delta numeric;
  enabled boolean := coalesce(public.param_text('stock.reservation_enabled', 'true'), 'true') = 'true';
begin
  select * into w from public.work_orders where id = p_wo;
  for r in select * from public.wo_parts where work_order_id = p_wo loop
    desired := case when enabled and r.location_id is not null and w.status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS')
                    then greatest(r.qty_planned - r.qty_used, 0) else 0 end;
    delta := desired - r.qty_reserved_applied;
    if delta <> 0 then
      insert into public.stock_balances (sparepart_id, location_id) values (r.sparepart_id, r.location_id) on conflict do nothing;
      update public.stock_balances set qty_reserved = qty_reserved + delta, updated_at = now()
      where sparepart_id = r.sparepart_id and location_id = r.location_id;
      update public.wo_parts set qty_reserved_applied = desired where id = r.id;
    end if;
  end loop;
end $$;

-- melepas reservasi lama dan memasang daftar part baru
create or replace function public._wo_replace_parts(p_wo uuid, p_parts jsonb, p_branch uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  pt jsonb;
  q numeric;
  sp public.spareparts;
  loc uuid;
begin
  for r in select * from public.wo_parts where work_order_id = p_wo loop
    if r.qty_reserved_applied > 0 and r.location_id is not null then
      update public.stock_balances set qty_reserved = greatest(qty_reserved - r.qty_reserved_applied, 0), updated_at = now()
      where sparepart_id = r.sparepart_id and location_id = r.location_id;
    end if;
  end loop;
  -- pemakaian yang sudah tercatat dipertahankan
  delete from public.wo_parts where work_order_id = p_wo and qty_used = 0;
  update public.wo_parts set qty_reserved_applied = 0, qty_planned = qty_used where work_order_id = p_wo;

  for pt in select * from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb)) loop
    select * into sp from public.spareparts where id = (pt ->> 'sparepart_id')::uuid;
    if not found then raise exception 'Sparepart tidak ditemukan'; end if;
    begin
      q := replace(coalesce(pt ->> 'qty', ''), ',', '.')::numeric;
    exception when others then
      raise exception 'Qty % tidak valid', sp.name;
    end;
    if q is null or q <= 0 then raise exception 'Qty % harus lebih dari 0', sp.name; end if;
    if public._uom_whole(sp.uom) and q <> trunc(q) then raise exception 'Qty % harus bilangan bulat (satuan %)', sp.name, sp.uom; end if;
    loc := nullif(pt ->> 'location_id', '')::uuid;
    if loc is not null and public.location_branch(loc) is distinct from p_branch then
      raise exception 'Lokasi part % harus berada di cabang WO', sp.name;
    end if;
    insert into public.wo_parts (work_order_id, sparepart_id, location_id, qty_planned)
    values (p_wo, sp.id, loc, q)
    on conflict (work_order_id, sparepart_id) do update set qty_planned = excluded.qty_planned, location_id = excluded.location_id;
  end loop;
  perform public._wo_sync_reservation(p_wo);
end $$;

create or replace function public._wo_flag_conflicts(p_vehicle uuid, p_assignee uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.work_orders w set needs_reschedule = true
  where w.id in (select id from public._wo_conflicts(p_vehicle, p_assignee, p_start, p_end, p_exclude))
    and w.type <> 'EMERGENCY';
  get diagnostics n = row_count;
  return n;
end $$;

-- validasi pasca-kejadian WO emergensi
create or replace function public._wo_start_emergency_validation(p_wo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  plate text;
begin
  select * into w from public.work_orders where id = p_wo;
  select plate_no into plate from public.vehicles where id = w.vehicle_id;
  update public.work_orders
  set emergency_validation = 'PENDING',
      validation_due = now() + make_interval(hours => public.param_int('incident.validation_hours', 24))
  where id = p_wo;
  perform public._approval_submit('EMERGENCY_WO', w.id, w.wo_no, 'WO emergensi ' || plate, w.branch_id, '{}'::jsonb);
end $$;

create or replace function public._wo_emergency_on_approval(p_wo uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.work_orders
  set emergency_validation = case p_outcome when 'APPROVED' then 'VALIDATED' when 'REJECTED' then 'REJECTED' else 'REVISION' end
  where id = p_wo;
end $$;

create or replace function public.wo_resubmit_emergency(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.work_orders;
begin
  if auth.uid() is null or not public.has_permission('wo.write') then raise exception 'Anda tidak berwenang mengajukan ulang validasi'; end if;
  select * into w from public.work_orders where id = p_id for update;
  if not found then raise exception 'Work Order tidak ditemukan'; end if;
  if not public.can_see_branch(w.branch_id) then raise exception 'Work Order ini berada di cabang lain'; end if;
  if w.type <> 'EMERGENCY' or w.emergency_validation <> 'REVISION' then
    raise exception 'Hanya WO emergensi yang diminta revisi yang dapat diajukan ulang';
  end if;
  perform public._wo_start_emergency_validation(w.id);
end $$;

-- ---------------------------------------------------------------- simpan WO
create or replace function public.wo_save(
  p_id uuid, p_type text, p_priority text, p_vehicle uuid, p_start timestamptz, p_end timestamptz,
  p_vendor uuid, p_assignee uuid, p_description text, p_parts jsonb,
  p_source text default null, p_version integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  v public.vehicles;
  wid uuid := p_id;
  st text;
  s timestamptz := p_start;
  e timestamptz := p_end;
  prio text := coalesce(nullif(p_priority, ''), 'NORMAL');
  msg text;
  warnings jsonb := '[]'::jsonb;
  flagged integer;
  ptype text := p_type;
begin
  if auth.uid() is null or not public.has_permission('wo.write') then raise exception 'Anda tidak berwenang mengelola Work Order'; end if;
  if prio not in ('LOW', 'NORMAL', 'HIGH', 'URGENT') then raise exception 'Prioritas tidak valid'; end if;
  if p_id is not null then
    select * into w from public.work_orders where id = p_id for update;
    if not found then raise exception 'Work Order tidak ditemukan'; end if;
    if p_version is not null and w.row_version <> p_version then raise exception 'Data diubah oleh pengguna lain, muat ulang lalu coba lagi'; end if;
    if w.status not in ('PLANNED', 'SCHEDULED') then raise exception 'WO berstatus % tidak dapat diedit', w.status; end if;
    ptype := w.type;
    select * into v from public.vehicles where id = w.vehicle_id;
  else
    if p_type not in ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY') then raise exception 'Jenis WO tidak valid'; end if;
    select * into v from public.vehicles where id = p_vehicle;
    if not found then raise exception 'Kendaraan tidak ditemukan'; end if;
  end if;
  if not public.can_see_branch(v.branch_id) then raise exception 'Kendaraan ini berada di cabang lain'; end if;
  if ptype = 'EMERGENCY' then prio := 'URGENT'; end if;

  if (s is null) <> (e is null) then raise exception 'Isi jadwal mulai dan selesai sekaligus, atau kosongkan keduanya'; end if;
  if ptype = 'EMERGENCY' and s is null then s := now(); e := now() + interval '4 hours'; end if;
  if s is not null and e <= s then raise exception 'Jadwal selesai harus setelah jadwal mulai'; end if;
  if p_assignee is not null and not (p_assignee = any (public._users_with_permission('wo.execute', v.branch_id))) then
    raise exception 'Teknisi yang dipilih tidak dapat menjalankan Work Order di cabang ini';
  end if;

  if p_id is not null and w.status = 'SCHEDULED' and (s is distinct from w.scheduled_start or e is distinct from w.scheduled_end) then
    raise exception 'Jadwal WO yang sudah dijadwalkan diubah lewat Ajukan Perubahan Jadwal agar alasannya tercatat';
  end if;

  st := case when s is not null and (p_assignee is not null or p_vendor is not null) then 'SCHEDULED' else 'PLANNED' end;
  if p_id is not null and w.status = 'SCHEDULED' and st = 'PLANNED' then
    raise exception 'WO yang sudah dijadwalkan harus tetap memiliki teknisi atau bengkel';
  end if;

  if st = 'SCHEDULED' then
    msg := public._wo_conflict_message(v.id, p_assignee, s, e, p_id);
    if msg is not null then
      if ptype = 'EMERGENCY' then
        warnings := warnings || to_jsonb(msg || '. WO terdampak ditandai "Perlu dijadwal ulang".');
      else
        raise exception '%', msg;
      end if;
    end if;
  end if;

  if wid is null then
    insert into public.work_orders (wo_no, branch_id, vehicle_id, type, priority, status, vendor_id, assignee_id,
                                    scheduled_start, scheduled_end, original_start, due_at, description, source_note)
    values (public._next_doc_no('WO', v.branch_id), v.branch_id, v.id, ptype, prio, st, p_vendor, p_assignee, s, e,
            case when st = 'SCHEDULED' then s end, case when ptype = 'EMERGENCY' then null else s end,
            nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_source, '')), ''))
    returning id into wid;
  else
    update public.work_orders
    set priority = prio, status = st, vendor_id = p_vendor, assignee_id = p_assignee,
        scheduled_start = s, scheduled_end = e,
        original_start = coalesce(original_start, case when st = 'SCHEDULED' then s end),
        due_at = coalesce(due_at, case when ptype = 'EMERGENCY' then null else s end),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        source_note = nullif(btrim(coalesce(p_source, '')), '')
    where id = wid;
  end if;

  perform public._wo_replace_parts(wid, p_parts, v.branch_id);

  if ptype = 'EMERGENCY' and st = 'SCHEDULED' then
    flagged := public._wo_flag_conflicts(v.id, p_assignee, s, e, wid);
    if flagged > 0 then warnings := warnings || to_jsonb(flagged || ' WO lain ditandai perlu dijadwal ulang'); end if;
  end if;
  if p_id is null and ptype = 'EMERGENCY' then perform public._wo_start_emergency_validation(wid); end if;

  if st = 'SCHEDULED' and p_assignee is not null and (p_id is null or w.assignee_id is distinct from p_assignee) then
    perform public._notify_users(array[p_assignee], 'schedule', 'Work Order baru untuk Anda',
      (select wo_no from public.work_orders where id = wid) || ' · ' || v.plate_no || ' · ' || public._fmt_ts(s), '/maintenance/work-orders/' || wid, null);
  end if;
  return jsonb_build_object('id', wid, 'warnings', warnings);
end $$;

-- WO emergensi dari insiden (dipanggil fungsi insiden)
create or replace function public._wo_create_emergency(p_incident uuid, p_vehicle uuid, p_desc text, p_assignee uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v public.vehicles;
  wid uuid;
  s timestamptz := now();
  e timestamptz := now() + interval '4 hours';
begin
  select * into v from public.vehicles where id = p_vehicle;
  insert into public.work_orders (wo_no, branch_id, vehicle_id, type, priority, status, incident_id, assignee_id,
                                  scheduled_start, scheduled_end, original_start, description)
  values (public._next_doc_no('WO', v.branch_id), v.branch_id, v.id, 'EMERGENCY', 'URGENT', 'SCHEDULED', p_incident, p_assignee,
          s, e, s, p_desc)
  returning id into wid;
  perform public._wo_flag_conflicts(v.id, p_assignee, s, e, wid);
  perform public._wo_start_emergency_validation(wid);
  return wid;
end $$;

-- ---------------------------------------------------------------- eksekusi WO
create or replace function public._wo_actor_check(p_wo uuid, p_perm text) returns public.work_orders
language plpgsql security definer set search_path = public as $$
declare w public.work_orders;
begin
  if auth.uid() is null or not public.has_permission(p_perm) then raise exception 'Anda tidak berwenang melakukan aksi ini'; end if;
  select * into w from public.work_orders where id = p_wo for update;
  if not found then raise exception 'Work Order tidak ditemukan'; end if;
  if not public.can_see_branch(w.branch_id) then raise exception 'Work Order ini berada di cabang lain'; end if;
  return w;
end $$;

create or replace function public.wo_start(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.work_orders;
begin
  w := public._wo_actor_check(p_id, 'wo.execute');
  if not public.has_permission('wo.write') and w.assignee_id is distinct from auth.uid() then
    raise exception 'Work Order ini ditugaskan kepada teknisi lain';
  end if;
  if w.status <> 'SCHEDULED' then raise exception 'Hanya WO berstatus Scheduled yang dapat dimulai (saat ini %)', w.status; end if;
  update public.work_orders set status = 'IN_PROGRESS', actual_start = now(), is_overdue = false where id = w.id;
  perform set_config('app.system_update', 'on', true);
  update public.vehicles set status = 'IN_MAINTENANCE' where id = w.vehicle_id and status <> 'IN_MAINTENANCE';
  perform set_config('app.system_update', '', true);
end $$;

create or replace function public.wo_complete(p_id uuid, p_odometer numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  v public.vehicles;
  km numeric;
begin
  w := public._wo_actor_check(p_id, 'wo.execute');
  if not public.has_permission('wo.write') and w.assignee_id is distinct from auth.uid() then
    raise exception 'Work Order ini ditugaskan kepada teknisi lain';
  end if;
  if w.status <> 'IN_PROGRESS' then raise exception 'Hanya WO yang sedang dikerjakan yang dapat diselesaikan (saat ini %)', w.status; end if;
  select * into v from public.vehicles where id = w.vehicle_id for update;
  km := coalesce(p_odometer, v.odometer);
  if km < v.odometer then
    raise exception 'Odometer akhir % km tidak boleh lebih kecil dari odometer kendaraan % km',
      public._fmt_qty(km), public._fmt_qty(v.odometer);
  end if;
  update public.work_orders
  set status = 'COMPLETED', actual_end = now(), end_odometer = km, is_overdue = false,
      completion_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = w.id;
  perform set_config('app.system_update', 'on', true);
  update public.vehicles
  set odometer = km,
      status = case when exists (select 1 from public.work_orders x where x.vehicle_id = w.vehicle_id and x.id <> w.id and x.status = 'IN_PROGRESS')
                    then 'IN_MAINTENANCE' else 'ACTIVE' end
  where id = w.vehicle_id and status <> 'OUT_OF_SERVICE';
  perform set_config('app.system_update', '', true);
  if w.plan_id is not null then
    update public.maintenance_plans
    set last_done_at = (now() at time zone 'Asia/Jakarta')::date, last_done_km = km
    where id = w.plan_id;
  end if;
  perform public._wo_sync_reservation(w.id);
end $$;

create or replace function public.wo_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  sc record;
begin
  w := public._wo_actor_check(p_id, 'wo.write');
  if w.status in ('COMPLETED', 'CANCELLED') then raise exception 'WO berstatus % tidak dapat dibatalkan', w.status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Alasan pembatalan wajib diisi'; end if;
  if exists (select 1 from public.wo_parts where work_order_id = w.id and qty_used > 0) then
    raise exception 'Sparepart yang sudah terpakai harus dikembalikan lewat Mutasi Retur sebelum WO dibatalkan';
  end if;
  update public.work_orders set status = 'CANCELLED', cancel_reason = btrim(p_reason), is_overdue = false where id = w.id;
  for sc in select id from public.schedule_changes where work_order_id = w.id and status in ('REQUESTED', 'REVISION') loop
    perform public._approval_cancel('SCHEDULE_CHANGE', sc.id, 'WO dibatalkan');
    update public.schedule_changes set status = 'WITHDRAWN', decision_note = 'WO dibatalkan' where id = sc.id;
  end loop;
  if w.status = 'IN_PROGRESS' then
    perform set_config('app.system_update', 'on', true);
    update public.vehicles
    set status = case when exists (select 1 from public.work_orders x where x.vehicle_id = w.vehicle_id and x.id <> w.id and x.status = 'IN_PROGRESS')
                      then 'IN_MAINTENANCE' else 'ACTIVE' end
    where id = w.vehicle_id and status <> 'OUT_OF_SERVICE';
    perform set_config('app.system_update', '', true);
  end if;
  if w.type = 'EMERGENCY' and w.emergency_validation = 'PENDING' then
    perform public._approval_cancel('EMERGENCY_WO', w.id, 'WO dibatalkan');
  end if;
  perform public._wo_sync_reservation(w.id);
end $$;

-- pemakaian part dari mutasi yang diposting
create or replace function public._wo_on_stock_posted(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.stock_documents;
  r record;
begin
  select * into d from public.stock_documents where id = p_doc;
  if d.work_order_id is null or d.type not in ('OUT', 'RETURN') then return; end if;
  for r in select sparepart_id, sum(qty) as qty, min(from_location_id::text)::uuid as loc
           from public.stock_document_lines where document_id = d.id group by sparepart_id loop
    if d.type = 'OUT' then
      insert into public.wo_parts (work_order_id, sparepart_id, location_id, qty_planned, qty_used)
      values (d.work_order_id, r.sparepart_id, r.loc, r.qty, r.qty)
      on conflict (work_order_id, sparepart_id) do update
        set qty_used = public.wo_parts.qty_used + r.qty,
            qty_planned = greatest(public.wo_parts.qty_planned, public.wo_parts.qty_used + r.qty);
    else
      update public.wo_parts set qty_used = greatest(qty_used - r.qty, 0)
      where work_order_id = d.work_order_id and sparepart_id = r.sparepart_id;
    end if;
  end loop;
  perform public._wo_sync_reservation(d.work_order_id);
end $$;

-- ---------------------------------------------------------------- perubahan jadwal
create or replace function public._schedule_change_validate(
  p_wo public.work_orders, p_new_start timestamptz, p_new_end timestamptz, p_reason uuid, p_note text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  rc public.reason_codes;
  ne timestamptz := p_new_end;
  msg text;
begin
  if p_wo.status not in ('PLANNED', 'SCHEDULED') then raise exception 'Hanya WO Planned atau Scheduled yang jadwalnya dapat diubah'; end if;
  if p_wo.scheduled_start is null then raise exception 'WO belum memiliki jadwal; atur jadwal langsung pada WO'; end if;
  if p_new_start is null then raise exception 'Jadwal baru wajib diisi'; end if;
  if ne is null then ne := p_new_start + (p_wo.scheduled_end - p_wo.scheduled_start); end if;
  if ne <= p_new_start then raise exception 'Jadwal selesai harus setelah jadwal mulai'; end if;
  if p_new_start = p_wo.scheduled_start and ne = p_wo.scheduled_end then raise exception 'Jadwal baru harus berbeda dari jadwal lama'; end if;
  select * into rc from public.reason_codes where id = p_reason and is_active and used_for in ('SCHEDULE_CHANGE', 'ALL');
  if not found then raise exception 'Kategori alasan wajib dipilih'; end if;
  if rc.require_note and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Alasan "%" wajib disertai keterangan', rc.name;
  end if;
  if p_wo.type <> 'EMERGENCY' and p_wo.status = 'SCHEDULED' then
    msg := public._wo_conflict_message(p_wo.vehicle_id, p_wo.assignee_id, p_new_start, ne, p_wo.id);
    if msg is not null then raise exception '%', msg; end if;
  end if;
  return ne;
end $$;

create or replace function public._schedule_change_submit(p_sc uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.schedule_changes;
  plate text;
  days numeric;
  hq integer;
  rid uuid;
  notice text;
begin
  select * into c from public.schedule_changes where id = p_sc;
  select v.plate_no into plate from public.work_orders w join public.vehicles v on v.id = w.vehicle_id where w.id = c.work_order_id;
  days := round(abs(c.delta_minutes) / 1440.0, 2);
  hq := case when days > 7 or c.was_overdue then 1 else 0 end;
  if days > 7 then notice := format('%s %s hari melebihi 7 hari; akan dieskalasi ke Admin Pusat',
                                    case when c.change_type = 'POSTPONE' then 'Penundaan' else 'Percepatan' end, trim_scale(days));
  elsif c.was_overdue then notice := 'WO sudah melewati jatuh tempo; akan dieskalasi ke Admin Pusat'; end if;
  rid := public._approval_submit('SCHEDULE_CHANGE', c.id, c.change_no,
    case when c.change_type = 'POSTPONE' then 'Tunda ' else 'Percepat ' end || trim_scale(days) || ' hari, ' || plate,
    c.branch_id, jsonb_build_object('delta_days', days, 'hq_level', hq));
  return jsonb_build_object('id', c.id, 'request_id', rid, 'notice', notice);
end $$;

create or replace function public.schedule_change_request(
  p_wo uuid, p_new_start timestamptz, p_new_end timestamptz, p_reason uuid, p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w public.work_orders;
  ne timestamptz;
  cid uuid;
begin
  w := public._wo_actor_check(p_wo, 'schedule.request');
  ne := public._schedule_change_validate(w, p_new_start, p_new_end, p_reason, p_note);
  if exists (select 1 from public.schedule_changes where work_order_id = w.id and status in ('REQUESTED', 'REVISION')) then
    raise exception 'WO ini masih memiliki pengajuan perubahan jadwal yang berjalan';
  end if;
  insert into public.schedule_changes (change_no, work_order_id, branch_id, change_type, old_start, old_end, new_start, new_end,
                                       delta_minutes, reason_code_id, reason_note, was_overdue, requested_by)
  values (public._next_doc_no('PJ', w.branch_id), w.id, w.branch_id,
          case when p_new_start < w.scheduled_start then 'ADVANCE' else 'POSTPONE' end,
          w.scheduled_start, w.scheduled_end, p_new_start, ne,
          (extract(epoch from (p_new_start - w.scheduled_start)) / 60)::integer, p_reason,
          nullif(btrim(coalesce(p_note, '')), ''), w.is_overdue, auth.uid())
  returning id into cid;
  return public._schedule_change_submit(cid);
end $$;

create or replace function public.schedule_change_resubmit(
  p_id uuid, p_new_start timestamptz, p_new_end timestamptz, p_reason uuid, p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.schedule_changes;
  w public.work_orders;
  ne timestamptz;
begin
  select * into c from public.schedule_changes where id = p_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
  if c.requested_by <> auth.uid() then raise exception 'Hanya pengaju yang dapat memperbaiki pengajuan ini'; end if;
  if c.status <> 'REVISION' then raise exception 'Hanya pengajuan berstatus Revisi yang dapat diajukan ulang'; end if;
  select * into w from public.work_orders where id = c.work_order_id for update;
  ne := public._schedule_change_validate(w, p_new_start, p_new_end, p_reason, p_note);
  update public.schedule_changes
  set status = 'REQUESTED', new_start = p_new_start, new_end = ne, old_start = w.scheduled_start, old_end = w.scheduled_end,
      change_type = case when p_new_start < w.scheduled_start then 'ADVANCE' else 'POSTPONE' end,
      delta_minutes = (extract(epoch from (p_new_start - w.scheduled_start)) / 60)::integer,
      reason_code_id = p_reason, reason_note = nullif(btrim(coalesce(p_note, '')), ''), was_overdue = w.is_overdue
  where id = c.id;
  return public._schedule_change_submit(c.id);
end $$;

create or replace function public.schedule_change_withdraw(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.schedule_changes;
begin
  select * into c from public.schedule_changes where id = p_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
  if c.requested_by <> auth.uid() then raise exception 'Hanya pengaju yang dapat menarik kembali pengajuan ini'; end if;
  if c.status not in ('REQUESTED', 'REVISION') then raise exception 'Pengajuan berstatus % tidak dapat ditarik', c.status; end if;
  perform public._approval_cancel('SCHEDULE_CHANGE', c.id, 'Ditarik kembali oleh pengaju');
  update public.schedule_changes set status = 'WITHDRAWN', decided_at = now(), decision_note = 'Ditarik kembali oleh pengaju' where id = c.id;
end $$;

create or replace function public._schedule_change_on_approval(p_sc uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.schedule_changes;
  w public.work_orders;
  msg text;
  drv uuid;
  plate text;
begin
  select * into c from public.schedule_changes where id = p_sc for update;
  if p_outcome = 'REJECTED' then
    update public.schedule_changes set status = 'REJECTED', decided_at = now(), decision_note = p_note where id = c.id;
    return;
  elsif p_outcome = 'REVISION' then
    update public.schedule_changes set status = 'REVISION', decision_note = p_note where id = c.id;
    return;
  end if;
  select * into w from public.work_orders where id = c.work_order_id for update;
  if w.status not in ('PLANNED', 'SCHEDULED') then raise exception 'WO % sudah berstatus % sehingga jadwal tidak dapat diubah', w.wo_no, w.status; end if;
  if w.type <> 'EMERGENCY' and w.status = 'SCHEDULED' then
    msg := public._wo_conflict_message(w.vehicle_id, w.assignee_id, c.new_start, c.new_end, w.id);
    if msg is not null then raise exception '%', msg; end if;
  end if;
  update public.work_orders
  set scheduled_start = c.new_start, scheduled_end = c.new_end, schedule_changed = true, needs_reschedule = false,
      original_start = coalesce(original_start, c.old_start)
  where id = w.id;
  update public.schedule_changes set status = 'APPROVED', decided_at = now(), decision_note = p_note where id = c.id;
  select main_driver_id, plate_no into drv, plate from public.vehicles where id = w.vehicle_id;
  perform public._notify_users(array_remove(array[w.assignee_id, drv, c.requested_by], null), 'schedule',
    'Jadwal WO berubah', w.wo_no || ' · ' || plate || ' → ' || public._fmt_ts(c.new_start), '/maintenance/work-orders/' || w.id, null);
end $$;

-- daftar teknisi yang dapat ditugaskan pada sebuah cabang (untuk form WO)
create or replace function public.wo_assignees(p_branch uuid) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from public.profiles p
  where p.id = any (public._users_with_permission('wo.execute', p_branch))
    and public.can_see_branch(p_branch)
    and (public.has_permission('wo.write') or public.has_permission('wo.execute'))
  order by p.name;
$$;

-- ---------------------------------------------------------------- job
create or replace function public._wo_generate_preventive() returns integer
language plpgsql security definer set search_path = public as $$
declare
  p record;
  ld integer;
  lk integer;
  due_days boolean;
  due_km boolean;
  wid uuid;
  due timestamptz;
  n integer := 0;
begin
  for p in
    select pl.*, v.odometer as odo, v.plate_no
    from public.maintenance_plans pl join public.vehicles v on v.id = pl.vehicle_id
    where pl.is_active and v.is_active and v.status <> 'OUT_OF_SERVICE'
      and not exists (select 1 from public.work_orders w where w.plan_id = pl.id and w.status in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS'))
  loop
    ld := coalesce(p.lead_days, public.param_int('maintenance.lead_days', 7));
    lk := coalesce(p.lead_km, public.param_int('maintenance.lead_km', 500));
    due_days := p.next_due_at is not null and (now() at time zone 'Asia/Jakarta')::date >= p.next_due_at - ld;
    due_km := p.next_due_km is not null and p.odo >= p.next_due_km - lk;
    if due_days or due_km then
      due := case when p.next_due_at is not null and (due_days or not due_km)
                  then (p.next_due_at::timestamp + interval '23 hours 59 minutes') at time zone 'Asia/Jakarta'
                  else now() + make_interval(days => ld) end;
      insert into public.work_orders (wo_no, branch_id, vehicle_id, type, priority, status, plan_id, vendor_id, due_at, description, auto_generated)
      values (public._next_doc_no('WO', p.branch_id), p.branch_id, p.vehicle_id, 'PREVENTIVE', 'NORMAL', 'PLANNED', p.id, p.vendor_id,
              due, p.task_name, true)
      returning id into wid;
      insert into public.wo_parts (work_order_id, sparepart_id, location_id, qty_planned)
      select wid, pp.sparepart_id,
             (select b.location_id from public.stock_balances b join public.locations l on l.id = b.location_id
              where b.sparepart_id = pp.sparepart_id and l.branch_id = p.branch_id and l.is_active
              order by b.qty_on_hand desc limit 1),
             pp.qty
      from public.maintenance_plan_parts pp where pp.plan_id = p.id;
      perform public._wo_sync_reservation(wid);
      perform public._notify_users(public._users_with_permission('wo.write', p.branch_id), 'schedule',
        'WO preventif dibuat otomatis', p.task_name || ' · ' || p.plate_no, '/maintenance/work-orders/' || wid, 'wo-gen:' || wid::text);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public._wo_mark_overdue() returns integer
language plpgsql security definer set search_path = public as $$
declare
  w record;
  n integer := 0;
begin
  for w in
    update public.work_orders x set is_overdue = true
    where x.status in ('PLANNED', 'SCHEDULED') and x.due_at is not null and now() > x.due_at and not x.is_overdue
    returning x.id, x.wo_no, x.branch_id, x.vehicle_id
  loop
    perform public._notify_users(
      public._users_with_permission('wo.write', w.branch_id) || public._users_with_permission('approval.viewall', w.branch_id),
      'schedule', 'Perawatan melewati jatuh tempo', w.wo_no || ' sudah overdue', '/maintenance/work-orders/' || w.id, 'overdue:' || w.id::text);
    n := n + 1;
  end loop;
  update public.work_orders set is_overdue = false
  where is_overdue and (status not in ('PLANNED', 'SCHEDULED') or due_at is null or now() <= due_at);
  return n;
end $$;

grant select on public.maintenance_plans, public.maintenance_plan_parts, public.work_orders, public.wo_parts,
  public.schedule_changes to authenticated;
grant insert, update on public.maintenance_plans to authenticated;
grant insert, update, delete on public.maintenance_plan_parts to authenticated;
grant all on public.maintenance_plans, public.maintenance_plan_parts, public.work_orders, public.wo_parts,
  public.schedule_changes to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

select public._lockdown_functions();
