-- foundation-auth-master: skema, RLS, trigger audit, dan aturan master data.
-- Diuji lewat PGlite (tests/db) dan dijalankan di Supabase (auth.uid(), auth.users, role anon/authenticated/service_role).

-- ---------------------------------------------------------------- helpers umum
create or replace function public.touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := auth.uid();
    new.row_version := 1;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
    new.row_version := old.row_version + 1;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- master: cabang
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  is_hq boolean not null default false,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint branches_hq_active check (not (is_hq and not is_active))
);
create unique index branches_single_hq on public.branches (is_hq) where is_hq;

-- ---------------------------------------------------------------- role & permission
create table public.permissions (
  code text primary key,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_builtin boolean not null default false,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_code text not null references public.permissions (code) on delete cascade,
  primary key (role_id, permission_code)
);

-- ---------------------------------------------------------------- profil pengguna
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  branch_id uuid not null references public.branches (id),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index profiles_email_unique on public.profiles (lower(email));

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------- fungsi otorisasi
create or replace function public.has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    where pr.id = auth.uid() and pr.is_active and rp.permission_code = p
  );
$$;

create or replace function public.my_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.can_see_branch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('branch.all') or b = public.my_branch();
$$;

-- ---------------------------------------------------------------- master lain
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null,
  plate_norm text generated always as (upper(regexp_replace(plate_no, '\s', '', 'g'))) stored,
  type text not null,
  model text,
  year integer check (year is null or year between 1950 and 2100),
  branch_id uuid not null references public.branches (id),
  odometer numeric(12,1) not null default 0 check (odometer >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE')),
  main_driver_id uuid references public.profiles (id),
  notes text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index vehicles_plate_unique on public.vehicles (plate_norm);

create table public.vehicle_odometer_logs (
  id bigint generated always as identity primary key,
  vehicle_id uuid not null references public.vehicles (id),
  old_value numeric(12,1) not null,
  new_value numeric(12,1) not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table public.spareparts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  uom text not null,
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  description text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id),
  code text not null,
  name text not null,
  notes text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (branch_id, code)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('BENGKEL', 'DEREK', 'ASURANSI', 'SUPPLIER')),
  phone text not null,
  address text,
  region text,
  pic text,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.reason_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  used_for text not null check (used_for in ('SCHEDULE_CHANGE', 'OPNAME_DIFF', 'REJECT', 'ALL')),
  require_note boolean not null default false,
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table public.system_parameters (
  key text primary key,
  value text not null,
  type text not null check (type in ('int', 'bool', 'text')),
  grp text not null,
  label text not null,
  min_value numeric,
  max_value numeric,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- ---------------------------------------------------------------- audit log (append-only)
create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  entity text not null,
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  ip text,
  meta jsonb
);
create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, at desc);

create or replace function public.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs bersifat append-only';
end $$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_immutable();

-- argumen: [0] kolom kunci (dipisah koma), [1] kolom yang diabaikan (dipisah koma, opsional)
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  key_cols text[] := string_to_array(tg_argv[0], ',');
  ignore_cols text[] := array['updated_at', 'updated_by', 'row_version', 'created_at', 'created_by']
    || coalesce(string_to_array(nullif(tg_argv[1], ''), ','), array[]::text[]);
  rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  eid text;
  act text;
  b jsonb;
  a jsonb;
begin
  select string_agg(rec ->> k, ':') into eid from unnest(key_cols) k;

  if tg_op = 'INSERT' then
    act := 'CREATE'; b := null; a := to_jsonb(new) - ignore_cols;
  elsif tg_op = 'DELETE' then
    act := 'DELETE'; b := to_jsonb(old) - ignore_cols; a := null;
  else
    b := to_jsonb(old) - ignore_cols;
    a := to_jsonb(new) - ignore_cols;
    if b = a then return new; end if;
    act := 'UPDATE';
    if (a ? 'is_active') and (b ->> 'is_active') is distinct from (a ->> 'is_active') then
      act := case when (a ->> 'is_active') = 'true' then 'ACTIVATE' else 'DEACTIVATE' end;
    end if;
  end if;

  insert into public.audit_logs (user_id, entity, entity_id, action, before, after)
  values (auth.uid(), tg_table_name, eid, act, b, a);
  return coalesce(new, old);
end $$;

-- pencatatan event keamanan (login, akses ditolak, dst). Hanya service_role.
create or replace function public.log_security_event(
  p_user uuid, p_action text, p_meta jsonb default null, p_ip text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (user_id, entity, entity_id, action, meta, ip)
  values (p_user, 'security', p_user::text, p_action, p_meta, p_ip);
$$;
revoke all on function public.log_security_event(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.log_security_event(uuid, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------- titik ekstensi slice berikutnya
-- Slice stok/WO menggantikan fungsi ini (create or replace) agar penonaktifan master yang masih dipakai ditolak.
create or replace function public.deactivation_block_reason(p_entity text, p_id uuid) returns text
language sql stable as $$ select null::text $$;

create or replace function public.uom_locked(p_sparepart uuid) returns boolean
language sql stable as $$ select false $$;

create or replace function public.guard_deactivate() returns trigger
language plpgsql as $$
declare reason text;
begin
  if old.is_active and not new.is_active then
    reason := public.deactivation_block_reason(tg_table_name, old.id);
    if reason is not null then raise exception '%', reason; end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- aturan khusus tabel
create or replace function public.branches_guard() returns trigger
language plpgsql as $$
begin
  if new.code is distinct from old.code and (
    exists (select 1 from public.profiles where branch_id = old.id)
    or exists (select 1 from public.vehicles where branch_id = old.id)
    or exists (select 1 from public.locations where branch_id = old.id)
  ) then
    raise exception 'Kode cabang tidak dapat diubah karena sudah dipakai data lain';
  end if;
  return new;
end $$;
create trigger branches_guard before update on public.branches
  for each row execute function public.branches_guard();

create or replace function public.vehicles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'IN_MAINTENANCE' and auth.uid() is not null then
      raise exception 'Status Dalam Perawatan diatur otomatis oleh Work Order';
    end if;
    return new;
  end if;
  if new.odometer < old.odometer then
    raise exception 'Odometer tidak boleh lebih kecil dari %', old.odometer;
  end if;
  if new.status = 'IN_MAINTENANCE' and old.status <> 'IN_MAINTENANCE'
     and auth.uid() is not null and coalesce(current_setting('app.system_update', true), '') <> 'on' then
    raise exception 'Status Dalam Perawatan diatur otomatis oleh Work Order';
  end if;
  if new.odometer <> old.odometer then
    insert into public.vehicle_odometer_logs (vehicle_id, old_value, new_value, changed_by)
    values (old.id, old.odometer, new.odometer, auth.uid());
  end if;
  return new;
end $$;
create trigger vehicles_guard before insert or update on public.vehicles
  for each row execute function public.vehicles_guard();

create or replace function public.spareparts_guard() returns trigger
language plpgsql as $$
begin
  if new.uom is distinct from old.uom and public.uom_locked(old.id) then
    raise exception 'Satuan tidak dapat diubah karena sparepart sudah memiliki mutasi';
  end if;
  return new;
end $$;
create trigger spareparts_guard before update on public.spareparts
  for each row execute function public.spareparts_guard();

create or replace function public.parameters_guard() returns trigger
language plpgsql as $$
begin
  new.key := old.key; new.type := old.type; new.grp := old.grp; new.label := old.label;
  new.min_value := old.min_value; new.max_value := old.max_value;
  if new.type = 'int' then
    if new.value !~ '^-?[0-9]+$' then
      raise exception 'Nilai % harus berupa bilangan bulat', new.label;
    end if;
    if new.min_value is not null and new.value::numeric < new.min_value then
      raise exception 'Nilai % minimal %', new.label, new.min_value;
    end if;
    if new.max_value is not null and new.value::numeric > new.max_value then
      raise exception 'Nilai % maksimal %', new.label, new.max_value;
    end if;
  elsif new.type = 'bool' and new.value not in ('true', 'false') then
    raise exception 'Nilai % harus true atau false', new.label;
  end if;
  return new;
end $$;
create trigger parameters_guard before update on public.system_parameters
  for each row execute function public.parameters_guard();

create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  -- sesi pengguna biasa hanya boleh mengubah nama dan telepon sendiri
  if auth.uid() is not null and not public.has_permission('admin.user') then
    if new.id <> old.id or new.email <> old.email or new.branch_id <> old.branch_id
       or new.is_active <> old.is_active or new.must_change_password <> old.must_change_password
       or new.failed_attempts <> old.failed_attempts
       or new.locked_until is distinct from old.locked_until
       or new.last_login_at is distinct from old.last_login_at then
      raise exception 'Hanya nama dan telepon yang dapat diubah';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.roles_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_builtin then raise exception 'Role bawaan tidak dapat dihapus'; end if;
    if exists (select 1 from public.user_roles where role_id = old.id) then
      raise exception 'Role masih dipakai % user', (select count(*) from public.user_roles where role_id = old.id);
    end if;
    return old;
  end if;
  if old.is_builtin and new.name <> old.name then
    raise exception 'Nama role bawaan tidak dapat diubah';
  end if;
  return new;
end $$;
create trigger roles_guard before update or delete on public.roles
  for each row execute function public.roles_guard();

-- SYS_ADMIN harus selalu mempertahankan permission pengelolaan
create or replace function public.role_permissions_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.permission_code in ('admin.user', 'admin.role', 'audit.view')
     and exists (select 1 from public.roles r where r.id = old.role_id and r.name = 'SYS_ADMIN') then
    raise exception 'SYS_ADMIN harus tetap memiliki permission %', old.permission_code;
  end if;
  return coalesce(new, old);
end $$;
create trigger role_permissions_guard before delete on public.role_permissions
  for each row execute function public.role_permissions_guard();

-- minimal satu SYS_ADMIN aktif
create or replace function public.keep_one_sysadmin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(to_jsonb(old) ->> 'user_id', to_jsonb(old) ->> 'id')::uuid;
  rid uuid := (to_jsonb(old) ->> 'role_id')::uuid;
  is_sa boolean;
  remaining integer;
begin
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where r.name = 'SYS_ADMIN' and ur.user_id = uid and (rid is null or ur.role_id = rid)
  ) into is_sa;
  if not is_sa then return coalesce(new, old); end if;

  select count(*) into remaining
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
  where r.name = 'SYS_ADMIN' and p.is_active and p.id <> uid;
  if remaining = 0 then
    raise exception 'Minimal satu SYS_ADMIN aktif harus ada';
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_keep_sysadmin before update on public.profiles
  for each row when (old.is_active and not new.is_active)
  execute function public.keep_one_sysadmin();
create trigger user_roles_keep_sysadmin before delete on public.user_roles
  for each row execute function public.keep_one_sysadmin();

-- ---------------------------------------------------------------- trigger umum
do $$
declare t text;
begin
  foreach t in array array['branches', 'roles', 'profiles', 'vehicles', 'spareparts', 'locations',
                           'vendors', 'reason_codes', 'system_parameters']
  loop
    execute format('create trigger %I_touch before insert or update on public.%I
                    for each row execute function public.touch_row()', t, t);
  end loop;

  foreach t in array array['branches', 'vehicles', 'spareparts', 'locations', 'vendors', 'reason_codes']
  loop
    execute format('create trigger %I_guard_deactivate before update on public.%I
                    for each row execute function public.guard_deactivate()', t, t);
  end loop;
end $$;

create trigger branches_audit after insert or update on public.branches
  for each row execute function public.audit_row('id');
create trigger roles_audit after insert or update or delete on public.roles
  for each row execute function public.audit_row('id');
create trigger role_permissions_audit after insert or delete on public.role_permissions
  for each row execute function public.audit_row('role_id,permission_code');
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function public.audit_row('user_id,role_id');
create trigger profiles_audit after insert or update on public.profiles
  for each row execute function public.audit_row('id', 'failed_attempts,locked_until,last_login_at,must_change_password');
create trigger vehicles_audit after insert or update on public.vehicles
  for each row execute function public.audit_row('id');
create trigger spareparts_audit after insert or update on public.spareparts
  for each row execute function public.audit_row('id');
create trigger locations_audit after insert or update on public.locations
  for each row execute function public.audit_row('id');
create trigger vendors_audit after insert or update on public.vendors
  for each row execute function public.audit_row('id');
create trigger reason_codes_audit after insert or update on public.reason_codes
  for each row execute function public.audit_row('id');
create trigger system_parameters_audit after update on public.system_parameters
  for each row execute function public.audit_row('key');

-- ---------------------------------------------------------------- hak akses & RLS
alter table public.branches enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_odometer_logs enable row level security;
alter table public.spareparts enable row level security;
alter table public.locations enable row level security;
alter table public.vendors enable row level security;
alter table public.reason_codes enable row level security;
alter table public.system_parameters enable row level security;
alter table public.audit_logs enable row level security;

-- cabang: terlihat oleh semua pengguna login
create policy branches_select on public.branches for select to authenticated using (true);
create policy branches_write on public.branches for insert to authenticated with check (public.has_permission('master.write'));
create policy branches_update on public.branches for update to authenticated
  using (public.has_permission('master.write')) with check (public.has_permission('master.write'));

create policy permissions_select on public.permissions for select to authenticated using (true);

create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_insert on public.roles for insert to authenticated with check (public.has_permission('admin.role'));
create policy roles_update on public.roles for update to authenticated
  using (public.has_permission('admin.role')) with check (public.has_permission('admin.role'));
create policy roles_delete on public.roles for delete to authenticated using (public.has_permission('admin.role'));

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions for insert to authenticated with check (public.has_permission('admin.role'));
create policy role_permissions_delete on public.role_permissions for delete to authenticated using (public.has_permission('admin.role'));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('admin.user') or public.can_see_branch(branch_id));
create policy profiles_insert on public.profiles for insert to authenticated with check (public.has_permission('admin.user'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('admin.user'))
  with check (id = auth.uid() or public.has_permission('admin.user'));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('admin.user') or public.has_permission('admin.role'));
create policy user_roles_insert on public.user_roles for insert to authenticated with check (public.has_permission('admin.user'));
create policy user_roles_delete on public.user_roles for delete to authenticated using (public.has_permission('admin.user'));

create policy vehicles_select on public.vehicles for select to authenticated
  using (public.can_see_branch(branch_id) and (public.has_permission('master.read') or main_driver_id = auth.uid()));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (public.has_permission('master.write') and public.can_see_branch(branch_id));
create policy vehicles_update on public.vehicles for update to authenticated
  using (public.has_permission('master.write') and public.can_see_branch(branch_id))
  with check (public.has_permission('master.write') and public.can_see_branch(branch_id));

create policy odometer_logs_select on public.vehicle_odometer_logs for select to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));

create policy spareparts_select on public.spareparts for select to authenticated using (public.has_permission('master.read'));
create policy spareparts_insert on public.spareparts for insert to authenticated with check (public.has_permission('master.write'));
create policy spareparts_update on public.spareparts for update to authenticated
  using (public.has_permission('master.write')) with check (public.has_permission('master.write'));

create policy locations_select on public.locations for select to authenticated
  using (public.can_see_branch(branch_id) and public.has_permission('master.read'));
create policy locations_insert on public.locations for insert to authenticated
  with check (public.has_permission('master.write') and public.can_see_branch(branch_id));
create policy locations_update on public.locations for update to authenticated
  using (public.has_permission('master.write') and public.can_see_branch(branch_id))
  with check (public.has_permission('master.write') and public.can_see_branch(branch_id));

create policy vendors_select on public.vendors for select to authenticated using (public.has_permission('master.read'));
create policy vendors_insert on public.vendors for insert to authenticated with check (public.has_permission('master.write'));
create policy vendors_update on public.vendors for update to authenticated
  using (public.has_permission('master.write')) with check (public.has_permission('master.write'));

create policy reason_codes_select on public.reason_codes for select to authenticated using (true);
create policy reason_codes_insert on public.reason_codes for insert to authenticated with check (public.has_permission('master.write'));
create policy reason_codes_update on public.reason_codes for update to authenticated
  using (public.has_permission('master.write')) with check (public.has_permission('master.write'));

create policy parameters_select on public.system_parameters for select to authenticated using (true);
create policy parameters_update on public.system_parameters for update to authenticated
  using (public.has_permission('admin.param')) with check (public.has_permission('admin.param'));

create policy audit_select on public.audit_logs for select to authenticated using (public.has_permission('audit.view'));

-- grant tabel: tidak ada DELETE pada master; audit_logs hanya SELECT
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant insert, update on public.branches, public.profiles, public.vehicles, public.spareparts,
  public.locations, public.vendors, public.reason_codes, public.roles to authenticated;
grant update on public.system_parameters to authenticated;
grant insert, delete on public.user_roles, public.role_permissions to authenticated;
grant delete on public.roles to authenticated;
grant all on all tables in schema public to service_role;
revoke update, delete, truncate on public.audit_logs from service_role, authenticated, anon;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.has_permission(text), public.my_branch(), public.can_see_branch(uuid)
  to authenticated, service_role;
