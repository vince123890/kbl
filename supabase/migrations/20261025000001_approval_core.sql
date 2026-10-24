-- Slice 2: fondasi transaksi (penomoran, notifikasi, pembantu otorisasi) dan mesin approval generik.
-- Konvensi: fungsi berawalan "_" hanya untuk internal (service_role / dipanggil fungsi lain);
-- fungsi tanpa awalan adalah API yang boleh dipanggil pengguna login dan memeriksa izin sendiri.

-- ---------------------------------------------------------------- permission tambahan
insert into public.permissions (code, description) values
  ('admin.notif', 'Melihat log notifikasi'),
  ('incident.close', 'Menutup insiden emergensi');

insert into public.role_permissions (role_id, permission_code)
select r.id, m.perm
from (values ('SYS_ADMIN', 'admin.notif'), ('HQ_ADMIN', 'incident.close')) as m (role_name, perm)
join public.roles r on r.name = m.role_name;

-- ---------------------------------------------------------------- pembatasan hak eksekusi fungsi
create or replace function public._lockdown_functions() returns void
language plpgsql as $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
      and p.proname <> 'log_security_event'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    if left(f.proname, 1) = '_' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- pembantu umum
create or replace function public.forbid_modify() returns trigger
language plpgsql as $$
begin
  raise exception '% bersifat append-only dan tidak dapat diubah atau dihapus', tg_table_name;
end $$;

create or replace function public.has_role(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles ro on ro.id = ur.role_id
    where pr.id = auth.uid() and pr.is_active and ro.name = r
  );
$$;

create or replace function public.param_text(k text, d text default null) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.system_parameters where key = k), d);
$$;

create or replace function public.param_int(k text, d integer) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select value::integer from public.system_parameters where key = k and type = 'int'), d);
$$;

create or replace function public._users_with_permission(p_perm text, p_branch uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct pr.id), array[]::uuid[])
  from public.profiles pr
  join public.user_roles ur on ur.user_id = pr.id
  join public.role_permissions rp on rp.role_id = ur.role_id
  where pr.is_active and rp.permission_code = p_perm
    and (pr.branch_id = p_branch or exists (
      select 1 from public.user_roles u2
      join public.role_permissions r2 on r2.role_id = u2.role_id
      where u2.user_id = pr.id and r2.permission_code = 'branch.all'));
$$;

create or replace function public._users_with_role(p_role text, p_branch uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct pr.id), array[]::uuid[])
  from public.profiles pr
  join public.user_roles ur on ur.user_id = pr.id
  join public.roles ro on ro.id = ur.role_id
  where pr.is_active and ro.name = p_role
    and (pr.branch_id = p_branch or exists (
      select 1 from public.user_roles u2
      join public.role_permissions r2 on r2.role_id = u2.role_id
      where u2.user_id = pr.id and r2.permission_code = 'branch.all'));
$$;

-- ---------------------------------------------------------------- penomoran dokumen
create table public.doc_counters (
  prefix text not null,
  branch_code text not null,
  period text not null,
  last_no integer not null default 0,
  primary key (prefix, branch_code, period)
);
alter table public.doc_counters enable row level security;

-- {PREFIX}-{CABANG}-{YYYYMM}-{urut}; baris counter dikunci oleh upsert sehingga urutan tidak ganda.
create or replace function public._next_doc_no(p_prefix text, p_branch uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  bc text;
  per text := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM');
  n integer;
begin
  select code into bc from public.branches where id = p_branch;
  if bc is null then raise exception 'Cabang tidak ditemukan'; end if;
  insert into public.doc_counters (prefix, branch_code, period, last_no) values (p_prefix, bc, per, 1)
  on conflict (prefix, branch_code, period) do update set last_no = public.doc_counters.last_no + 1
  returning last_no into n;
  return p_prefix || '-' || bc || '-' || per || '-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- notifikasi
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  channel text not null check (channel in ('INAPP', 'PUSH', 'WHATSAPP', 'SMS', 'EMAIL')),
  kind text not null,
  title text not null,
  body text,
  link text,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'FAILED', 'READ')),
  attempts integer not null default 0,
  last_error text,
  dedup_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_queue_idx on public.notifications (status, channel) where status in ('QUEUED', 'FAILED');
create unique index notifications_dedup_idx on public.notifications (user_id, channel, dedup_key) where dedup_key is not null;
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.has_permission('admin.notif'));

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

-- Kegagalan notifikasi tidak boleh menggagalkan transaksi bisnis, maka semua galat ditelan.
create or replace function public._notify_users(
  p_users uuid[], p_kind text, p_title text, p_body text, p_link text default null, p_dedup text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  ch text;
  chans text[];
begin
  chans := string_to_array(replace(public.param_text('notify.channels.' || p_kind, 'INAPP'), ' ', ''), ',');
  if not ('INAPP' = any (chans)) then chans := array_prepend('INAPP', chans); end if;
  foreach u in array coalesce(p_users, array[]::uuid[]) loop
    foreach ch in array chans loop
      if ch not in ('INAPP', 'PUSH', 'WHATSAPP', 'SMS', 'EMAIL') then continue; end if;
      insert into public.notifications (user_id, channel, kind, title, body, link, status, sent_at, dedup_key)
      values (u, ch, p_kind, p_title, p_body, p_link,
              case when ch = 'INAPP' then 'SENT' else 'QUEUED' end,
              case when ch = 'INAPP' then now() end, p_dedup)
      on conflict do nothing;
    end loop;
  end loop;
exception when others then
  null;
end $$;

create or replace function public.notification_mark_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.notifications
  set status = 'READ', read_at = now()
  where user_id = auth.uid() and channel = 'INAPP' and status <> 'READ'
    and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

insert into public.system_parameters (key, value, type, grp, label) values
  ('notify.channels.incident', 'INAPP,PUSH,WHATSAPP', 'text', 'Notifikasi', 'Kanal notifikasi insiden'),
  ('notify.channels.approval', 'INAPP,PUSH', 'text', 'Notifikasi', 'Kanal notifikasi approval'),
  ('notify.channels.stock', 'INAPP', 'text', 'Notifikasi', 'Kanal notifikasi stok'),
  ('notify.channels.schedule', 'INAPP,PUSH', 'text', 'Notifikasi', 'Kanal notifikasi jadwal dan WO'),
  ('notify.channels.system', 'INAPP', 'text', 'Notifikasi', 'Kanal notifikasi sistem');

-- ---------------------------------------------------------------- alur approval
create table public.approval_flows (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('STOCK', 'COUNT', 'SCHEDULE_CHANGE', 'EMERGENCY_WO')),
  name text not null,
  is_active boolean not null default true,
  version integer not null default 1,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index approval_flows_one_active on public.approval_flows (doc_type) where is_active;

create table public.approval_flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.approval_flows (id) on delete cascade,
  step_no integer not null check (step_no > 0),
  approver_role text not null references public.roles (name) on update cascade,
  sla_hours integer not null default 24 check (sla_hours > 0),
  cond_metric text,
  cond_op text check (cond_op in ('>', '>=', '<', '<=', '=')),
  cond_value numeric,
  unique (flow_id, step_no),
  check ((cond_metric is null) = (cond_op is null) and (cond_op is null) = (cond_value is null))
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null,
  doc_id uuid not null,
  doc_no text,
  summary text,
  branch_id uuid not null references public.branches (id),
  flow_id uuid references public.approval_flows (id),
  steps jsonb not null default '[]',
  current_step integer not null default 1 check (current_step >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'REVISION', 'CANCELLED')),
  step_started_at timestamptz not null default now(),
  sla_notified_step integer,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_note text
);
create unique index approval_requests_one_pending on public.approval_requests (doc_type, doc_id) where status = 'PENDING';
create index approval_requests_status_idx on public.approval_requests (status, branch_id);

create table public.approval_actions (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.approval_requests (id),
  step_no integer not null default 0,
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text not null check (action in
    ('SUBMIT', 'APPROVE', 'REJECT', 'REVISE', 'OVERRIDE', 'ESCALATE', 'AUTO_APPROVE', 'CANCEL', 'POST_FAILED', 'REMIND', 'SLA_BREACH')),
  note text,
  from_status text,
  to_status text,
  acted_at timestamptz not null default now()
);
create index approval_actions_request_idx on public.approval_actions (request_id, id);
create trigger approval_actions_append_only before update or delete on public.approval_actions
  for each row execute function public.forbid_modify();

create trigger approval_flows_touch before insert or update on public.approval_flows
  for each row execute function public.touch_row();
create trigger approval_flows_audit after insert or update on public.approval_flows
  for each row execute function public.audit_row('id');
create trigger approval_flow_steps_audit after insert or update or delete on public.approval_flow_steps
  for each row execute function public.audit_row('flow_id,step_no');

alter table public.approval_flows enable row level security;
alter table public.approval_flow_steps enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_actions enable row level security;

create policy approval_flows_select on public.approval_flows for select to authenticated using (true);
create policy approval_flow_steps_select on public.approval_flow_steps for select to authenticated using (true);
create policy approval_requests_select on public.approval_requests for select to authenticated
  using (public.can_see_branch(branch_id)
         and (requested_by = auth.uid() or public.has_permission('approval.act') or public.has_permission('approval.viewall')));
create policy approval_actions_select on public.approval_actions for select to authenticated
  using (exists (select 1 from public.approval_requests r where r.id = request_id));

create or replace function public._approval_metric(p_metrics jsonb, k text) returns numeric
language sql immutable as $$ select coalesce((p_metrics ->> k)::numeric, 0) $$;

create or replace function public._approval_cond_ok(op text, a numeric, b numeric) returns boolean
language sql immutable as $$
  select case op when '>' then a > b when '>=' then a >= b when '<' then a < b when '<=' then a <= b when '=' then a = b else false end
$$;

create or replace function public._actor_label(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select name from public.profiles where id = p_user;
$$;

-- memberi tahu approver pada level berjalan
create or replace function public._approval_notify_step(p_request uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  st jsonb;
  targets uuid[];
begin
  select * into r from public.approval_requests where id = p_request;
  if not found or r.status <> 'PENDING' or r.current_step < 1 then return; end if;
  st := r.steps -> (r.current_step - 1);
  select array_agg(x) into targets
  from unnest(public._users_with_role(st ->> 'role', r.branch_id)) x
  where x <> r.requested_by and x = any (public._users_with_permission('approval.act', r.branch_id));
  perform public._notify_users(targets, 'approval', 'Menunggu persetujuan Anda',
    coalesce(r.doc_no, '') || ' · ' || coalesce(r.summary, ''), '/approvals/' || r.id,
    case when p_force then null else r.id::text || ':' || r.current_step::text end);
end $$;

-- membuat permintaan approval untuk sebuah dokumen. Dipanggil fungsi dokumen saat diajukan.
create or replace function public._approval_submit(
  p_doc_type text, p_doc_id uuid, p_doc_no text, p_summary text, p_branch uuid, p_metrics jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f public.approval_flows;
  s record;
  steps jsonb := '[]'::jsonb;
  n integer := 0;
  rid uuid;
  me uuid := auth.uid();
begin
  select * into f from public.approval_flows where doc_type = p_doc_type and is_active;
  if found then
    for s in select * from public.approval_flow_steps where flow_id = f.id order by step_no loop
      if s.cond_metric is null
         or public._approval_cond_ok(s.cond_op, public._approval_metric(p_metrics, s.cond_metric), s.cond_value) then
        n := n + 1;
        steps := steps || jsonb_build_array(jsonb_build_object('n', n, 'role', s.approver_role, 'sla_hours', s.sla_hours));
      end if;
    end loop;
  end if;

  if n = 0 then
    insert into public.approval_requests (doc_type, doc_id, doc_no, summary, branch_id, flow_id, steps, current_step,
                                          status, requested_by, decided_at)
    values (p_doc_type, p_doc_id, p_doc_no, p_summary, p_branch, f.id, '[]', 0, 'APPROVED', coalesce(me, '00000000-0000-0000-0000-000000000000'), now())
    returning id into rid;
    insert into public.approval_actions (request_id, step_no, actor_id, actor_name, action, note, from_status, to_status)
    values (rid, 0, me, public._actor_label(me), 'AUTO_APPROVE', 'Tidak ada level approval yang berlaku', 'PENDING', 'APPROVED');
    perform public._approval_run_handler(rid, 'APPROVED', null);
    return rid;
  end if;

  insert into public.approval_requests (doc_type, doc_id, doc_no, summary, branch_id, flow_id, steps, current_step, requested_by)
  values (p_doc_type, p_doc_id, p_doc_no, p_summary, p_branch, f.id, steps, 1, me)
  returning id into rid;
  insert into public.approval_actions (request_id, step_no, actor_id, actor_name, action, from_status, to_status)
  values (rid, 0, me, public._actor_label(me), 'SUBMIT', null, 'PENDING');
  perform public._approval_notify_step(rid);
  return rid;
end $$;

-- memanggil handler dokumen: <doc>_on_approval(doc_id, outcome, note)
create or replace function public._approval_run_handler(p_request uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  fn text;
begin
  select * into r from public.approval_requests where id = p_request;
  fn := case r.doc_type
    when 'STOCK' then '_stock_doc_on_approval'
    when 'COUNT' then '_count_on_approval'
    when 'SCHEDULE_CHANGE' then '_schedule_change_on_approval'
    when 'EMERGENCY_WO' then '_wo_emergency_on_approval'
  end;
  if fn is null then raise exception 'Jenis dokumen approval tidak dikenal: %', r.doc_type; end if;
  execute format('select public.%I($1, $2, $3)', fn) using r.doc_id, p_outcome, p_note;
end $$;

-- keputusan akhir (approve level terakhir, reject, revisi, override) dengan penanganan kegagalan handler
create or replace function public._approval_finalize(
  p_request uuid, p_status text, p_action text, p_note text, p_step integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  me uuid := auth.uid();
  my_role text;
begin
  select * into r from public.approval_requests where id = p_request;
  select string_agg(ro.name, ',') into my_role
  from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = me;
  begin
    update public.approval_requests
    set status = p_status, decided_at = now(), decision_note = p_note
    where id = p_request;
    insert into public.approval_actions (request_id, step_no, actor_id, actor_name, actor_role, action, note, from_status, to_status)
    values (p_request, p_step, me, public._actor_label(me), my_role, p_action, p_note, 'PENDING', p_status);
    perform public._approval_run_handler(p_request, p_status, p_note);
  exception when others then
    insert into public.approval_actions (request_id, step_no, actor_id, actor_name, actor_role, action, note, from_status, to_status)
    values (p_request, p_step, me, public._actor_label(me), my_role, 'POST_FAILED', sqlerrm, 'PENDING', 'PENDING');
    perform public._notify_users(array[r.requested_by, me], 'approval', 'Persetujuan gagal diproses',
      coalesce(r.doc_no, '') || ': ' || sqlerrm, '/approvals/' || r.id, null);
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  perform public._notify_users(array[r.requested_by], 'approval',
    case p_status when 'APPROVED' then 'Dokumen disetujui' when 'REJECTED' then 'Dokumen ditolak' else 'Dokumen perlu direvisi' end,
    coalesce(r.doc_no, '') || coalesce(' · ' || p_note, ''), '/approvals/' || r.id, null);
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

create or replace function public.approval_act(p_request uuid, p_action text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  me uuid := auth.uid();
  st jsonb;
  total integer;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  last_actor text;
  my_role text;
begin
  if me is null then raise exception 'Sesi berakhir, silakan login kembali'; end if;
  if p_action not in ('APPROVE', 'REJECT', 'REVISE') then raise exception 'Aksi approval tidak dikenal'; end if;
  select * into r from public.approval_requests where id = p_request for update;
  if not found then raise exception 'Approval tidak ditemukan'; end if;
  if r.status <> 'PENDING' then
    select actor_name into last_actor from public.approval_actions
    where request_id = r.id and action in ('APPROVE', 'REJECT', 'REVISE', 'OVERRIDE', 'AUTO_APPROVE', 'CANCEL')
    order by id desc limit 1;
    raise exception 'Dokumen sudah diputuskan oleh %', coalesce(last_actor, 'pengguna lain');
  end if;
  if not public.has_permission('approval.act') then raise exception 'Anda tidak berwenang memutuskan approval'; end if;
  if not public.can_see_branch(r.branch_id) then raise exception 'Dokumen ini berada di cabang lain'; end if;
  if r.requested_by = me then raise exception 'Anda tidak dapat memutuskan dokumen yang Anda ajukan sendiri'; end if;
  st := r.steps -> (r.current_step - 1);
  if not public.has_role(st ->> 'role') then
    raise exception 'Dokumen ini menunggu persetujuan % (level % dari %)', st ->> 'role', r.current_step, jsonb_array_length(r.steps);
  end if;
  if p_action in ('REJECT', 'REVISE') and note is null then
    raise exception 'Catatan wajib diisi untuk penolakan atau permintaan revisi';
  end if;
  total := jsonb_array_length(r.steps);

  if p_action = 'APPROVE' and r.current_step < total then
    select string_agg(ro.name, ',') into my_role
    from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = me;
    update public.approval_requests set current_step = current_step + 1, step_started_at = now() where id = r.id;
    insert into public.approval_actions (request_id, step_no, actor_id, actor_name, actor_role, action, note, from_status, to_status)
    values (r.id, r.current_step, me, public._actor_label(me), my_role, 'APPROVE', note, 'PENDING', 'PENDING');
    perform public._approval_notify_step(r.id);
    return jsonb_build_object('ok', true, 'status', 'PENDING', 'message', 'Disetujui, diteruskan ke level berikutnya');
  end if;

  return public._approval_finalize(
    r.id, case p_action when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else 'REVISION' end,
    p_action, note, r.current_step);
end $$;

create or replace function public.approval_override(p_request uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  me uuid := auth.uid();
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if me is null or not public.has_permission('approval.override') then
    raise exception 'Anda tidak berwenang melakukan override';
  end if;
  if note is null then raise exception 'Catatan wajib diisi untuk override'; end if;
  select * into r from public.approval_requests where id = p_request for update;
  if not found then raise exception 'Approval tidak ditemukan'; end if;
  if r.status <> 'PENDING' then raise exception 'Dokumen sudah diputuskan'; end if;
  if r.requested_by = me then raise exception 'Override tidak dapat dilakukan atas dokumen yang Anda ajukan sendiri'; end if;
  return public._approval_finalize(r.id, 'APPROVED', 'OVERRIDE', note, r.current_step);
end $$;

create or replace function public.approval_escalate(p_request uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  me uuid := auth.uid();
begin
  if me is null or not public.has_permission('approval.override') then
    raise exception 'Anda tidak berwenang melakukan eskalasi';
  end if;
  select * into r from public.approval_requests where id = p_request for update;
  if not found then raise exception 'Approval tidak ditemukan'; end if;
  if r.status <> 'PENDING' then raise exception 'Dokumen sudah diputuskan'; end if;
  if r.current_step >= jsonb_array_length(r.steps) then raise exception 'Dokumen sudah berada di level terakhir'; end if;
  update public.approval_requests set current_step = current_step + 1, step_started_at = now() where id = r.id;
  insert into public.approval_actions (request_id, step_no, actor_id, actor_name, action, note, from_status, to_status)
  values (r.id, r.current_step, me, public._actor_label(me), 'ESCALATE', nullif(btrim(coalesce(p_note, '')), ''), 'PENDING', 'PENDING');
  perform public._approval_notify_step(r.id);
  return jsonb_build_object('ok', true, 'status', 'PENDING');
end $$;

create or replace function public.approval_remind(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.approval_requests;
begin
  if auth.uid() is null or not public.has_permission('approval.override') then
    raise exception 'Anda tidak berwenang mengirim pengingat';
  end if;
  select * into r from public.approval_requests where id = p_request;
  if not found or r.status <> 'PENDING' then raise exception 'Dokumen tidak sedang menunggu approval'; end if;
  perform public._approval_notify_step(r.id, true);
  insert into public.approval_actions (request_id, step_no, actor_id, actor_name, action, from_status, to_status)
  values (r.id, r.current_step, auth.uid(), public._actor_label(auth.uid()), 'REMIND', 'PENDING', 'PENDING');
end $$;

-- membatalkan permintaan yang masih berjalan ketika dokumennya dibatalkan/ditarik
create or replace function public._approval_cancel(p_doc_type text, p_doc_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.approval_requests;
begin
  select * into r from public.approval_requests
  where doc_type = p_doc_type and doc_id = p_doc_id and status = 'PENDING' for update;
  if not found then return; end if;
  update public.approval_requests set status = 'CANCELLED', decided_at = now(), decision_note = p_note where id = r.id;
  insert into public.approval_actions (request_id, step_no, actor_id, actor_name, action, note, from_status, to_status)
  values (r.id, r.current_step, auth.uid(), public._actor_label(auth.uid()), 'CANCEL', p_note, 'PENDING', 'CANCELLED');
end $$;

-- mengelola alur: selalu membuat versi baru dan menonaktifkan versi sebelumnya (dokumen berjalan memakai snapshot)
create or replace function public.approval_flow_save(p_doc_type text, p_name text, p_steps jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  old public.approval_flows;
  fid uuid;
  s jsonb;
  i integer := 0;
  metrics text[];
  m text;
  op text;
  role_name text;
begin
  if auth.uid() is null or not public.has_permission('admin.flow') then
    raise exception 'Anda tidak berwenang mengelola alur approval';
  end if;
  metrics := case p_doc_type
    when 'STOCK' then array['total_qty', 'item_count']
    when 'COUNT' then array['abs_diff_total', 'diff_items']
    when 'SCHEDULE_CHANGE' then array['delta_days', 'hq_level']
    when 'EMERGENCY_WO' then array[]::text[]
  end;
  if metrics is null then raise exception 'Jenis dokumen tidak dikenal'; end if;
  if jsonb_typeof(coalesce(p_steps, '[]'::jsonb)) <> 'array' then raise exception 'Level harus berupa daftar'; end if;

  for s in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) loop
    role_name := s ->> 'role';
    if not exists (select 1 from public.roles where name = role_name) then
      raise exception 'Role % tidak ditemukan', coalesce(role_name, '(kosong)');
    end if;
    if not exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
                   where r.name = role_name and rp.permission_code = 'approval.act') then
      raise exception 'Role % tidak memiliki permission approval.act sehingga tidak dapat menjadi approver', role_name;
    end if;
    m := nullif(s ->> 'metric', '');
    op := nullif(s ->> 'op', '');
    if m is not null and not (m = any (metrics)) then
      raise exception 'Metrik % tidak berlaku untuk jenis dokumen ini', m;
    end if;
    if (m is null) <> (op is null) or (m is null) <> (nullif(s ->> 'value', '') is null) then
      raise exception 'Kondisi harus berisi metrik, operator, dan nilai sekaligus';
    end if;
  end loop;

  select * into old from public.approval_flows where doc_type = p_doc_type and is_active;
  if found then update public.approval_flows set is_active = false where id = old.id; end if;
  insert into public.approval_flows (doc_type, name, is_active, version)
  values (p_doc_type, coalesce(nullif(btrim(p_name), ''), 'Alur ' || p_doc_type), true, coalesce(old.version, 0) + 1)
  returning id into fid;

  for s in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) loop
    i := i + 1;
    insert into public.approval_flow_steps (flow_id, step_no, approver_role, sla_hours, cond_metric, cond_op, cond_value)
    values (fid, i, s ->> 'role', coalesce(nullif(s ->> 'sla_hours', '')::integer, 24),
            nullif(s ->> 'metric', ''), nullif(s ->> 'op', ''), nullif(s ->> 'value', '')::numeric);
  end loop;
  return fid;
end $$;

-- peringatan SLA: dipanggil job terjadwal
create or replace function public._approval_sla_check() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests;
  st jsonb;
  n integer := 0;
begin
  for r in
    select * from public.approval_requests
    where status = 'PENDING' and current_step > 0
      and sla_notified_step is distinct from current_step
  loop
    st := r.steps -> (r.current_step - 1);
    if now() > r.step_started_at + make_interval(hours => (st ->> 'sla_hours')::integer) then
      update public.approval_requests set sla_notified_step = current_step where id = r.id;
      insert into public.approval_actions (request_id, step_no, action, note, from_status, to_status)
      values (r.id, r.current_step, 'SLA_BREACH', 'Melewati SLA ' || (st ->> 'sla_hours') || ' jam', 'PENDING', 'PENDING');
      perform public._notify_users(
        public._users_with_permission('approval.viewall', r.branch_id) || public._users_with_role(st ->> 'role', r.branch_id),
        'approval', 'Approval melewati SLA', coalesce(r.doc_no, '') || ' menunggu ' || (st ->> 'role'),
        '/approvals/' || r.id, 'sla:' || r.id::text || ':' || r.current_step::text);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- alur bawaan (asumsi, dapat diubah di Alur Approval)
do $$
declare fid uuid;
begin
  insert into public.approval_flows (doc_type, name) values ('STOCK', 'Mutasi sparepart') returning id into fid;
  insert into public.approval_flow_steps (flow_id, step_no, approver_role, sla_hours, cond_metric, cond_op, cond_value) values
    (fid, 1, 'SUPERVISOR', 24, null, null, null),
    (fid, 2, 'DEPT_HEAD', 24, 'total_qty', '>', 50);

  insert into public.approval_flows (doc_type, name) values ('COUNT', 'Penyesuaian stock opname') returning id into fid;
  insert into public.approval_flow_steps (flow_id, step_no, approver_role, sla_hours, cond_metric, cond_op, cond_value) values
    (fid, 1, 'SUPERVISOR', 24, null, null, null),
    (fid, 2, 'DEPT_HEAD', 48, 'abs_diff_total', '>', 5),
    (fid, 3, 'HQ_ADMIN', 48, 'abs_diff_total', '>', 50);

  insert into public.approval_flows (doc_type, name) values ('SCHEDULE_CHANGE', 'Perubahan jadwal perawatan') returning id into fid;
  insert into public.approval_flow_steps (flow_id, step_no, approver_role, sla_hours, cond_metric, cond_op, cond_value) values
    (fid, 1, 'SUPERVISOR', 12, null, null, null),
    (fid, 2, 'DEPT_HEAD', 24, 'delta_days', '>', 1),
    (fid, 3, 'HQ_ADMIN', 24, 'hq_level', '>=', 1);

  insert into public.approval_flows (doc_type, name) values ('EMERGENCY_WO', 'Validasi pasca-kejadian WO emergensi') returning id into fid;
  insert into public.approval_flow_steps (flow_id, step_no, approver_role, sla_hours, cond_metric, cond_op, cond_value) values
    (fid, 1, 'DEPT_HEAD', 24, null, null, null);
end $$;

grant select on public.doc_counters, public.notifications, public.push_subscriptions,
  public.approval_flows, public.approval_flow_steps, public.approval_requests, public.approval_actions to authenticated;
grant all on public.doc_counters, public.notifications, public.push_subscriptions,
  public.approval_flows, public.approval_flow_steps, public.approval_requests, public.approval_actions to service_role;
revoke select on public.doc_counters from authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

select public._lockdown_functions();
