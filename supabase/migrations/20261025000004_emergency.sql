-- Slice 5: emergensi. Lapor darurat (idempoten), insiden sisi pusat, kontak darurat, dan langkah cepat (playbook).

alter table public.branches add column region text;

-- ---------------------------------------------------------------- tabel
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_no text not null unique,
  branch_id uuid not null references public.branches (id),
  vehicle_id uuid not null references public.vehicles (id),
  reporter_id uuid references public.profiles (id),
  driver_id uuid references public.profiles (id),
  type text not null check (type in ('BREAKDOWN', 'ACCIDENT', 'TIRE', 'FIRE', 'MEDICAL', 'OTHER')),
  status text not null default 'REPORTED' check (status in ('REPORTED', 'ACKNOWLEDGED', 'IN_HANDLING', 'RESOLVED', 'CLOSED')),
  lat numeric(9, 6) check (lat is null or lat between -90 and 90),
  lng numeric(9, 6) check (lng is null or lng between -180 and 180),
  address text,
  description text,
  casualties integer check (casualties is null or casualties >= 0),
  source text not null default 'DRIVER' check (source in ('DRIVER', 'CENTER')),
  idempotency_key text,
  reported_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_note text,
  escalated_level integer not null default 0,
  is_false_report boolean not null default false,
  false_reason text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index incidents_idem_unique on public.incidents (reporter_id, idempotency_key) where idempotency_key is not null;
create index incidents_status_idx on public.incidents (status, reported_at desc);
create index incidents_branch_idx on public.incidents (branch_id, reported_at desc);
alter table public.work_orders add constraint work_orders_incident_fk foreign key (incident_id) references public.incidents (id);

create table public.incident_logs (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents (id),
  actor_id uuid,
  actor_name text,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
create index incident_logs_incident_idx on public.incident_logs (incident_id, id);
create trigger incident_logs_append_only before update or delete on public.incident_logs
  for each row execute function public.forbid_modify();

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'GLOBAL' check (scope in ('GLOBAL', 'BRANCH', 'REGION')),
  branch_id uuid references public.branches (id),
  region text,
  role_label text not null,
  name text not null,
  phone text not null,
  priority integer not null default 10 check (priority > 0),
  service_hours text,
  notes text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.emergency_playbooks (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null check (incident_type in ('BREAKDOWN', 'ACCIDENT', 'TIRE', 'FIRE', 'MEDICAL', 'OTHER', 'GENERAL')),
  title text not null,
  steps jsonb not null,
  is_active boolean not null default true,
  version integer not null default 1,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index emergency_playbooks_one_active on public.emergency_playbooks (incident_type) where is_active;

-- ---------------------------------------------------------------- trigger
create trigger incidents_touch before insert or update on public.incidents
  for each row execute function public.touch_row();
create trigger incidents_audit after insert or update on public.incidents
  for each row execute function public.audit_row('id', 'escalated_level');
create trigger emergency_contacts_touch before insert or update on public.emergency_contacts
  for each row execute function public.touch_row();
create trigger emergency_contacts_audit after insert or update on public.emergency_contacts
  for each row execute function public.audit_row('id');
create trigger emergency_playbooks_touch before insert or update on public.emergency_playbooks
  for each row execute function public.touch_row();
create trigger emergency_playbooks_audit after insert or update on public.emergency_playbooks
  for each row execute function public.audit_row('id');

create or replace function public.incidents_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Insiden tidak dapat dihapus; tandai sebagai laporan keliru bila salah catat'; end if;
  if old.status <> new.status and not (
       (old.status = 'REPORTED' and new.status in ('ACKNOWLEDGED', 'CLOSED'))
    or (old.status = 'ACKNOWLEDGED' and new.status in ('IN_HANDLING', 'RESOLVED', 'CLOSED'))
    or (old.status = 'IN_HANDLING' and new.status in ('RESOLVED', 'CLOSED'))
    or (old.status = 'RESOLVED' and new.status = 'CLOSED')) then
    raise exception 'Perubahan status insiden % → % tidak diperbolehkan', old.status, new.status;
  end if;
  return new;
end $$;
create trigger incidents_guard before update or delete on public.incidents
  for each row execute function public.incidents_guard();

create or replace function public.emergency_contacts_guard() returns trigger
language plpgsql as $$
begin
  if btrim(new.role_label) = '' or btrim(new.name) = '' then raise exception 'Peran dan nama kontak wajib diisi'; end if;
  if new.phone !~ '^[+0-9 ()\-]{6,25}$' then raise exception 'Format telepon tidak valid'; end if;
  if new.scope = 'GLOBAL' then new.branch_id := null; new.region := null;
  elsif new.scope = 'BRANCH' and new.branch_id is null then raise exception 'Pilih cabang untuk kontak bercakupan cabang';
  elsif new.scope = 'REGION' and nullif(btrim(coalesce(new.region, '')), '') is null then raise exception 'Isi wilayah untuk kontak bercakupan wilayah';
  end if;
  if new.scope = 'BRANCH' then new.region := null; end if;
  if new.scope = 'REGION' then new.branch_id := null; end if;
  if tg_op = 'UPDATE' and old.is_active and not new.is_active and old.scope = 'GLOBAL'
     and not exists (select 1 from public.emergency_contacts c where c.scope = 'GLOBAL' and c.is_active and c.id <> old.id) then
    raise exception 'Kontak Global terakhir tidak dapat dinonaktifkan';
  end if;
  return new;
end $$;
create trigger emergency_contacts_guard before insert or update on public.emergency_contacts
  for each row execute function public.emergency_contacts_guard();

create or replace function public.emergency_playbooks_guard() returns trigger
language plpgsql as $$
declare s jsonb;
begin
  if jsonb_typeof(new.steps) <> 'array' or jsonb_array_length(new.steps) = 0 then raise exception 'Langkah cepat minimal satu langkah'; end if;
  for s in select * from jsonb_array_elements(new.steps) loop
    if jsonb_typeof(s) <> 'string' or btrim(s #>> '{}') = '' then raise exception 'Setiap langkah harus berupa teks'; end if;
  end loop;
  if tg_op = 'UPDATE' then
    new.incident_type := old.incident_type;
    if old.is_active and not new.is_active and old.incident_type = 'GENERAL' then
      raise exception 'Langkah cepat Umum tidak dapat dinonaktifkan karena menjadi cadangan jenis lain';
    end if;
    if new.steps is distinct from old.steps or new.title is distinct from old.title then new.version := old.version + 1; end if;
  end if;
  return new;
end $$;
create trigger emergency_playbooks_guard before insert or update on public.emergency_playbooks
  for each row execute function public.emergency_playbooks_guard();

-- ---------------------------------------------------------------- RLS
alter table public.incidents enable row level security;
alter table public.incident_logs enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.emergency_playbooks enable row level security;

create policy incidents_select on public.incidents for select to authenticated
  using (public.can_see_branch(branch_id)
         and (reporter_id = auth.uid() or driver_id = auth.uid() or public.has_permission('incident.handle')
              or (public.has_permission('incident.report') and public.has_permission('master.read'))));
create policy incident_logs_select on public.incident_logs for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id));
create policy emergency_contacts_select on public.emergency_contacts for select to authenticated
  using (is_active or public.has_permission('contact.manage'));
create policy emergency_contacts_insert on public.emergency_contacts for insert to authenticated
  with check (public.has_permission('contact.manage'));
create policy emergency_contacts_update on public.emergency_contacts for update to authenticated
  using (public.has_permission('contact.manage')) with check (public.has_permission('contact.manage'));
create policy emergency_playbooks_select on public.emergency_playbooks for select to authenticated
  using (is_active or public.has_permission('contact.manage'));
create policy emergency_playbooks_insert on public.emergency_playbooks for insert to authenticated
  with check (public.has_permission('contact.manage'));
create policy emergency_playbooks_update on public.emergency_playbooks for update to authenticated
  using (public.has_permission('contact.manage')) with check (public.has_permission('contact.manage'));

-- ---------------------------------------------------------------- pembantu
create or replace function public._incident_log(p_incident uuid, p_action text, p_note text) returns void
language sql security definer set search_path = public as $$
  insert into public.incident_logs (incident_id, actor_id, actor_name, action, note)
  values (p_incident, auth.uid(), public._actor_label(auth.uid()), p_action, p_note);
$$;

-- isi respons laporan: insiden + langkah cepat + kontak (kontak Global selalu ikut)
create or replace function public._incident_payload(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  i public.incidents;
  br public.branches;
  pb public.emergency_playbooks;
  contacts jsonb;
begin
  select * into i from public.incidents where id = p_id;
  select * into br from public.branches where id = i.branch_id;
  select * into pb from public.emergency_playbooks where incident_type = i.type and is_active;
  if not found then select * into pb from public.emergency_playbooks where incident_type = 'GENERAL' and is_active; end if;
  select coalesce(jsonb_agg(jsonb_build_object('role_label', c.role_label, 'name', c.name, 'phone', c.phone,
                                                'service_hours', c.service_hours) order by c.priority, c.name), '[]'::jsonb)
  into contacts
  from public.emergency_contacts c
  where c.is_active and (c.scope = 'GLOBAL' or (c.scope = 'BRANCH' and c.branch_id = i.branch_id)
                         or (c.scope = 'REGION' and br.region is not null and lower(c.region) = lower(br.region)));
  return jsonb_build_object(
    'incident', jsonb_build_object('id', i.id, 'incident_no', i.incident_no, 'status', i.status, 'type', i.type, 'reported_at', i.reported_at),
    'playbook', jsonb_build_object('title', coalesce(pb.title, 'Langkah cepat'), 'steps', coalesce(pb.steps, '[]'::jsonb)),
    'contacts', contacts);
end $$;

create or replace function public._incident_handler_check(p_id uuid) returns public.incidents
language plpgsql security definer set search_path = public as $$
declare i public.incidents;
begin
  if auth.uid() is null or not public.has_permission('incident.handle') then raise exception 'Anda tidak berwenang menangani insiden'; end if;
  select * into i from public.incidents where id = p_id for update;
  if not found then raise exception 'Insiden tidak ditemukan'; end if;
  if not public.can_see_branch(i.branch_id) then raise exception 'Insiden ini berada di cabang lain'; end if;
  return i;
end $$;

-- ---------------------------------------------------------------- lapor
-- Idempoten: pengiriman ulang dengan kunci yang sama mengembalikan laporan yang sama.
create or replace function public.incident_report(
  p_vehicle uuid, p_type text, p_lat numeric, p_lng numeric, p_address text, p_description text,
  p_casualties integer, p_idem text, p_driver uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v public.vehicles;
  existing uuid;
  iid uuid;
  drv uuid;
  src text := 'DRIVER';
begin
  if me is null then raise exception 'Sesi berakhir, silakan login kembali'; end if;
  if not public.has_permission('incident.report') then raise exception 'Anda tidak berwenang melaporkan insiden'; end if;
  if p_type not in ('BREAKDOWN', 'ACCIDENT', 'TIRE', 'FIRE', 'MEDICAL', 'OTHER') then raise exception 'Jenis kejadian tidak valid'; end if;

  if nullif(btrim(coalesce(p_idem, '')), '') is not null then
    select id into existing from public.incidents where reporter_id = me and idempotency_key = btrim(p_idem);
    if found then return public._incident_payload(existing); end if;
  end if;

  select * into v from public.vehicles where id = p_vehicle;
  if not found then raise exception 'Kendaraan tidak ditemukan'; end if;
  if not public.can_see_branch(v.branch_id) then raise exception 'Kendaraan ini berada di cabang lain'; end if;
  if not public.has_permission('master.read') and v.main_driver_id is distinct from me then
    raise exception 'Anda hanya dapat melapor untuk kendaraan yang ditugaskan kepada Anda';
  end if;

  drv := v.main_driver_id;
  if p_driver is not null then
    if not public.has_permission('incident.handle') then raise exception 'Hanya pusat yang dapat mencatat laporan atas nama pengemudi'; end if;
    drv := p_driver;
    src := 'CENTER';
  elsif drv is null then
    drv := me;
  end if;

  insert into public.incidents (incident_no, branch_id, vehicle_id, reporter_id, driver_id, type, lat, lng, address, description,
                                casualties, source, idempotency_key)
  values (public._next_doc_no('INC', v.branch_id), v.branch_id, v.id, me, drv, p_type, p_lat, p_lng,
          nullif(btrim(coalesce(p_address, '')), ''), nullif(btrim(coalesce(p_description, '')), ''),
          p_casualties, src, nullif(btrim(coalesce(p_idem, '')), ''))
  returning id into iid;
  perform public._incident_log(iid, 'REPORTED', case when src = 'CENTER' then 'Dicatat oleh pusat atas laporan telepon' else null end);

  perform public._notify_users(
    array_remove(public._users_with_permission('incident.handle', v.branch_id), me), 'incident',
    'INSIDEN ' || case p_type when 'BREAKDOWN' then 'MOGOK' when 'ACCIDENT' then 'KECELAKAAN' when 'TIRE' then 'BAN' when 'FIRE' then 'KEBAKARAN' when 'MEDICAL' then 'MEDIS' else 'LAINNYA' end,
    v.plate_no || coalesce(' · ' || nullif(btrim(coalesce(p_address, '')), ''), ''), '/emergency/incidents/' || iid, 'inc:' || iid::text);
  return public._incident_payload(iid);
end $$;

-- langkah 2 (opsional) setelah laporan terkirim: pelapor menambah keterangan dan jumlah korban
create or replace function public.incident_add_detail(p_id uuid, p_description text, p_casualties integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  extra text := nullif(btrim(coalesce(p_description, '')), '');
begin
  select * into i from public.incidents where id = p_id for update;
  if not found then raise exception 'Insiden tidak ditemukan'; end if;
  if auth.uid() is distinct from i.reporter_id and auth.uid() is distinct from i.driver_id and not public.has_permission('incident.handle') then
    raise exception 'Anda tidak berwenang menambah keterangan insiden ini';
  end if;
  if i.status = 'CLOSED' then raise exception 'Insiden sudah ditutup'; end if;
  if extra is null and p_casualties is null then raise exception 'Isi keterangan atau jumlah korban'; end if;
  update public.incidents
  set description = case when extra is null then description when description is null then extra else description || E'
' || extra end,
      casualties = coalesce(p_casualties, casualties)
  where id = i.id;
  perform public._incident_log(i.id, 'DETAIL_ADDED', coalesce(extra, '') || case when p_casualties is not null then ' (korban: ' || p_casualties || ')' else '' end);
  perform public._notify_users(array_remove(public._users_with_permission('incident.handle', i.branch_id), auth.uid()), 'incident',
    'Keterangan tambahan insiden', i.incident_no || ': ' || coalesce(extra, 'jumlah korban diperbarui'), '/emergency/incidents/' || i.id, null);
end $$;

-- ---------------------------------------------------------------- penanganan pusat
create or replace function public.incident_ack(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i public.incidents;
begin
  i := public._incident_handler_check(p_id);
  if i.status <> 'REPORTED' then raise exception 'Insiden sudah dikonfirmasi (status %)', i.status; end if;
  update public.incidents set status = 'ACKNOWLEDGED', acknowledged_at = now(), acknowledged_by = auth.uid() where id = i.id;
  perform public._incident_log(i.id, 'ACKNOWLEDGED', null);
  perform public._notify_users(array_remove(array[i.reporter_id, i.driver_id], null), 'incident', 'Laporan Anda sudah diterima pusat',
    i.incident_no || ' · ' || public._actor_label(auth.uid()) || ' menangani', '/emergency/incidents/' || i.id, null);
end $$;

create or replace function public.incident_log_action(p_id uuid, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  i := public._incident_handler_check(p_id);
  if p_action not in ('ASSIGN_TOW', 'ASSIGN_TECH', 'REPLACEMENT_VEHICLE', 'NOTE') then raise exception 'Aksi tidak dikenal'; end if;
  if note is null then raise exception 'Catatan wajib diisi'; end if;
  if i.status in ('RESOLVED', 'CLOSED') then raise exception 'Insiden sudah % dan tidak dapat ditindaklanjuti lagi', i.status; end if;
  if i.status = 'REPORTED' then
    update public.incidents set status = 'ACKNOWLEDGED', acknowledged_at = now(), acknowledged_by = auth.uid() where id = i.id;
    perform public._incident_log(i.id, 'ACKNOWLEDGED', null);
  end if;
  if p_action <> 'NOTE' then
    update public.incidents set status = 'IN_HANDLING' where id = i.id and status = 'ACKNOWLEDGED';
  end if;
  perform public._incident_log(i.id, p_action, note);
  if p_action <> 'NOTE' then
    perform public._notify_users(array_remove(array[i.reporter_id, i.driver_id], null), 'incident', 'Tindak lanjut insiden',
      i.incident_no || ': ' || note, '/emergency/incidents/' || i.id, null);
  end if;
end $$;

create or replace function public.incident_resolve(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  i := public._incident_handler_check(p_id);
  if note is null then raise exception 'Catatan hasil penanganan wajib diisi'; end if;
  if i.status not in ('ACKNOWLEDGED', 'IN_HANDLING') then raise exception 'Insiden berstatus % tidak dapat diselesaikan', i.status; end if;
  update public.incidents set status = 'RESOLVED', resolved_at = now(), resolution_note = note where id = i.id;
  perform public._incident_log(i.id, 'RESOLVED', note);
  perform public._notify_users(array_remove(array[i.reporter_id, i.driver_id], null), 'incident', 'Insiden diselesaikan',
    i.incident_no || ': ' || note, '/emergency/incidents/' || i.id, null);
end $$;

create or replace function public.incident_close(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i public.incidents;
begin
  if auth.uid() is null or not public.has_permission('incident.close') then raise exception 'Hanya Admin Pusat yang dapat menutup insiden'; end if;
  select * into i from public.incidents where id = p_id for update;
  if not found then raise exception 'Insiden tidak ditemukan'; end if;
  if i.status <> 'RESOLVED' then raise exception 'Insiden harus diselesaikan terlebih dahulu sebelum ditutup'; end if;
  update public.incidents set status = 'CLOSED', closed_at = now() where id = i.id;
  perform public._incident_log(i.id, 'CLOSED', null);
end $$;

create or replace function public.incident_mark_false(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  i := public._incident_handler_check(p_id);
  if reason is null then raise exception 'Alasan wajib diisi'; end if;
  if i.status = 'CLOSED' then raise exception 'Insiden sudah ditutup'; end if;
  update public.incidents set is_false_report = true, false_reason = reason, status = 'CLOSED', closed_at = now() where id = i.id;
  perform public._incident_log(i.id, 'FALSE_REPORT', reason);
end $$;

create or replace function public.incident_correct_type(p_id uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.incidents;
begin
  i := public._incident_handler_check(p_id);
  if p_type not in ('BREAKDOWN', 'ACCIDENT', 'TIRE', 'FIRE', 'MEDICAL', 'OTHER') then raise exception 'Jenis kejadian tidak valid'; end if;
  if i.status = 'CLOSED' then raise exception 'Insiden sudah ditutup'; end if;
  update public.incidents set type = p_type where id = i.id;
  perform public._incident_log(i.id, 'TYPE_CORRECTED', i.type || ' → ' || p_type);
end $$;

create or replace function public.incident_create_wo(p_id uuid, p_assignee uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  wid uuid;
  wno text;
begin
  i := public._incident_handler_check(p_id);
  if not public.has_permission('wo.write') then raise exception 'Anda tidak berwenang membuat Work Order'; end if;
  if i.status in ('CLOSED', 'RESOLVED') then raise exception 'Insiden berstatus % tidak dapat dibuatkan WO', i.status; end if;
  if exists (select 1 from public.work_orders where incident_id = i.id and status <> 'CANCELLED') then
    raise exception 'Insiden ini sudah memiliki Work Order emergensi';
  end if;
  if p_assignee is not null and not (p_assignee = any (public._users_with_permission('wo.execute', i.branch_id))) then
    raise exception 'Teknisi yang dipilih tidak dapat menjalankan Work Order di cabang ini';
  end if;
  if i.status = 'REPORTED' then
    update public.incidents set status = 'ACKNOWLEDGED', acknowledged_at = now(), acknowledged_by = auth.uid() where id = i.id;
    perform public._incident_log(i.id, 'ACKNOWLEDGED', null);
  end if;
  wid := public._wo_create_emergency(i.id, i.vehicle_id, coalesce(i.description, 'Insiden ' || i.incident_no), p_assignee);
  select wo_no into wno from public.work_orders where id = wid;
  update public.incidents set status = 'IN_HANDLING' where id = i.id and status = 'ACKNOWLEDGED';
  perform public._incident_log(i.id, 'WO_CREATED', wno);
  return wid;
end $$;

-- eskalasi otomatis insiden tanpa ACK (dipanggil job tiap menit)
create or replace function public._incident_escalate() returns integer
language plpgsql security definer set search_path = public as $$
declare
  i public.incidents;
  mins integer := public.param_int('incident.ack_minutes', 5);
  n integer := 0;
  plate text;
begin
  for i in
    select * from public.incidents
    where status = 'REPORTED' and escalated_level < 3
      and now() >= reported_at + make_interval(mins => mins * (escalated_level + 1))
  loop
    update public.incidents set escalated_level = escalated_level + 1 where id = i.id;
    perform public._incident_log(i.id, 'ESCALATED', 'Belum dikonfirmasi setelah ' || (mins * (i.escalated_level + 1)) || ' menit');
    select plate_no into plate from public.vehicles where id = i.vehicle_id;
    perform public._notify_users(
      public._users_with_permission('incident.handle', i.branch_id) || case when i.escalated_level >= 1 then public._users_with_permission('incident.close', i.branch_id) else array[]::uuid[] end,
      'incident', 'BELUM ADA YANG MERESPONS INSIDEN', i.incident_no || ' · ' || plate || ' sudah ' || (mins * (i.escalated_level + 1)) || ' menit',
      '/emergency/incidents/' || i.id, 'esc:' || i.id::text || ':' || (i.escalated_level + 1)::text);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- data awal
insert into public.emergency_contacts (scope, role_label, name, phone, priority, notes) values
  ('GLOBAL', 'Control Tower Pusat', 'Kantor Pusat (nomor utama)', '(061) 80044515', 1,
   'Nomor awal dari profil perusahaan. Ganti dengan nomor Control Tower yang aktif 24 jam.');

insert into public.emergency_playbooks (incident_type, title, steps) values
  ('GENERAL', 'Langkah cepat umum', '["Hentikan kendaraan di tempat yang aman", "Nyalakan lampu hazard", "Hubungi pusat dan jelaskan kondisi"]'),
  ('BREAKDOWN', 'Kendaraan mogok', '["Nyalakan lampu hazard", "Pasang segitiga pengaman", "Keluar ke area aman di luar jalur kendaraan", "Tunggu arahan pusat"]'),
  ('ACCIDENT', 'Kecelakaan', '["Hentikan kendaraan dan nyalakan hazard", "Pastikan keselamatan diri dan korban", "Hubungi ambulans atau polisi bila ada korban", "Jangan memindahkan kendaraan sebelum difoto", "Tunggu arahan pusat"]'),
  ('TIRE', 'Ban bermasalah', '["Menepi dengan aman dan nyalakan hazard", "Pasang segitiga pengaman", "Jangan mengganti ban di sisi jalan yang ramai", "Tunggu arahan pusat atau derek"]'),
  ('FIRE', 'Kebakaran', '["Hentikan kendaraan dan matikan mesin", "Keluar dan menjauh minimal 50 meter", "Hubungi pemadam kebakaran", "Jangan membuka kap mesin", "Hubungi pusat"]'),
  ('MEDICAL', 'Kondisi medis', '["Hentikan kendaraan di tempat aman", "Hubungi ambulans", "Beri pertolongan pertama bila Anda mampu", "Hubungi pusat"]'),
  ('OTHER', 'Kejadian lainnya', '["Hentikan kendaraan di tempat aman", "Nyalakan lampu hazard", "Hubungi pusat dan jelaskan kondisi"]');

grant select on public.incidents, public.incident_logs, public.emergency_contacts, public.emergency_playbooks to authenticated;
grant insert, update on public.emergency_contacts, public.emergency_playbooks to authenticated;
grant all on public.incidents, public.incident_logs, public.emergency_contacts, public.emergency_playbooks to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

select public._lockdown_functions();
