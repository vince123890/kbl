-- Slice 3: inventori sparepart. Mutasi (draft → diajukan → disetujui → diposting), ledger stok, saldo, dan stock opname.
-- Saldo hanya berubah di _stock_doc_post. Dokumen POSTED tidak dapat diubah; koreksi lewat dokumen pembalik.

create or replace function public.location_branch(l uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from public.locations where id = l;
$$;

-- ---------------------------------------------------------------- tabel
create table public.stock_documents (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  type text not null check (type in ('IN', 'OUT', 'RETURN', 'TRANSFER', 'ADJUSTMENT')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED')),
  branch_id uuid not null references public.branches (id),
  doc_date date not null default current_date,
  vehicle_id uuid references public.vehicles (id),
  work_order_id uuid,
  from_location_id uuid references public.locations (id),
  to_location_id uuid references public.locations (id),
  notes text,
  reverses_doc_id uuid references public.stock_documents (id),
  count_id uuid,
  decision_note text,
  cancel_reason text,
  submitted_at timestamptz,
  posted_at timestamptz,
  posted_by uuid,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create index stock_documents_branch_idx on public.stock_documents (branch_id, doc_date desc);
create index stock_documents_status_idx on public.stock_documents (status);
create unique index stock_documents_one_reversal on public.stock_documents (reverses_doc_id)
  where reverses_doc_id is not null and status not in ('CANCELLED', 'REJECTED');

create table public.stock_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.stock_documents (id),
  line_no integer not null,
  sparepart_id uuid not null references public.spareparts (id),
  qty numeric(14, 3) not null check (qty > 0),
  from_location_id uuid references public.locations (id),
  to_location_id uuid references public.locations (id),
  notes text,
  unique (document_id, line_no)
);
create index stock_document_lines_sparepart_idx on public.stock_document_lines (sparepart_id);

create table public.stock_balances (
  sparepart_id uuid not null references public.spareparts (id),
  location_id uuid not null references public.locations (id),
  qty_on_hand numeric(14, 3) not null default 0 check (qty_on_hand >= 0),
  qty_reserved numeric(14, 3) not null default 0 check (qty_reserved >= 0),
  updated_at timestamptz not null default now(),
  primary key (sparepart_id, location_id)
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.stock_documents (id),
  line_id uuid not null references public.stock_document_lines (id),
  doc_no text not null,
  doc_type text not null,
  sparepart_id uuid not null references public.spareparts (id),
  location_id uuid not null references public.locations (id),
  branch_id uuid not null references public.branches (id),
  qty_delta numeric(14, 3) not null check (qty_delta <> 0),
  balance_after numeric(14, 3) not null,
  vehicle_id uuid references public.vehicles (id),
  work_order_id uuid,
  posted_at timestamptz not null default now(),
  posted_by uuid
);
create index stock_movements_card_idx on public.stock_movements (sparepart_id, location_id, posted_at, id);
create index stock_movements_branch_idx on public.stock_movements (branch_id, posted_at desc);
create trigger stock_movements_append_only before update or delete on public.stock_movements
  for each row execute function public.forbid_modify();

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  count_no text not null unique,
  branch_id uuid not null references public.branches (id),
  location_id uuid not null references public.locations (id),
  type text not null check (type in ('PERIODIC', 'AD_HOC')),
  category text,
  status text not null default 'OPEN' check (status in ('OPEN', 'COUNTING', 'REVIEW', 'APPROVED', 'ADJUSTED', 'CANCELLED')),
  notes text,
  opened_at timestamptz not null default now(),
  review_at timestamptz,
  closed_at timestamptz,
  adjustment_doc_id uuid references public.stock_documents (id),
  decision_note text,
  cancel_reason text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index stock_counts_one_open_per_location on public.stock_counts (location_id)
  where status in ('OPEN', 'COUNTING', 'REVIEW');
alter table public.stock_documents add constraint stock_documents_count_fk foreign key (count_id) references public.stock_counts (id);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id),
  sparepart_id uuid not null references public.spareparts (id),
  snapshot_qty numeric(14, 3) not null,
  system_qty numeric(14, 3) not null,
  counted_qty numeric(14, 3) check (counted_qty is null or counted_qty >= 0),
  not_counted boolean not null default false,
  diff_qty numeric(14, 3) generated always as (case when counted_qty is null then null else counted_qty - system_qty end) stored,
  reason_code_id uuid references public.reason_codes (id),
  reason_note text,
  unique (count_id, sparepart_id)
);

-- ---------------------------------------------------------------- trigger & guard
create trigger stock_documents_touch before insert or update on public.stock_documents
  for each row execute function public.touch_row();
create trigger stock_counts_touch before insert or update on public.stock_counts
  for each row execute function public.touch_row();
create trigger stock_documents_audit after insert or update on public.stock_documents
  for each row execute function public.audit_row('id');
create trigger stock_counts_audit after insert or update on public.stock_counts
  for each row execute function public.audit_row('id');

create or replace function public.stock_documents_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Dokumen stok tidak dapat dihapus; gunakan batal atau dokumen pembalik'; end if;
  if tg_op = 'UPDATE' then
    if old.status <> new.status and not (
         (old.status = 'DRAFT' and new.status in ('SUBMITTED', 'CANCELLED', 'APPROVED'))
      or (old.status = 'SUBMITTED' and new.status in ('APPROVED', 'REJECTED', 'DRAFT', 'CANCELLED'))
      or (old.status = 'APPROVED' and new.status = 'POSTED')) then
      raise exception 'Perubahan status % → % tidak diperbolehkan', old.status, new.status;
    end if;
    if old.status <> 'DRAFT' and (new.type, new.branch_id, new.doc_date, new.vehicle_id, new.work_order_id,
        new.from_location_id, new.to_location_id, new.notes, new.doc_no)
        is distinct from (old.type, old.branch_id, old.doc_date, old.vehicle_id, old.work_order_id,
        old.from_location_id, old.to_location_id, old.notes, old.doc_no) then
      raise exception 'Dokumen % sudah diajukan dan tidak dapat diubah', old.doc_no;
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger stock_documents_guard before update or delete on public.stock_documents
  for each row execute function public.stock_documents_guard();

create or replace function public.stock_lines_guard() returns trigger
language plpgsql as $$
declare st text;
begin
  select status into st from public.stock_documents where id = coalesce(new.document_id, old.document_id);
  if st is distinct from 'DRAFT' then
    raise exception 'Baris dokumen hanya dapat diubah saat dokumen berstatus Draft';
  end if;
  return coalesce(new, old);
end $$;
create trigger stock_lines_guard before insert or update or delete on public.stock_document_lines
  for each row execute function public.stock_lines_guard();

create or replace function public.stock_counts_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Sesi opname tidak dapat dihapus; gunakan batal'; end if;
  if old.status <> new.status and not (
       (old.status = 'OPEN' and new.status in ('COUNTING', 'CANCELLED'))
    or (old.status = 'COUNTING' and new.status in ('REVIEW', 'CANCELLED'))
    or (old.status = 'REVIEW' and new.status in ('APPROVED', 'COUNTING', 'CANCELLED'))
    or (old.status = 'APPROVED' and new.status = 'ADJUSTED')) then
    raise exception 'Perubahan status opname % → % tidak diperbolehkan', old.status, new.status;
  end if;
  return new;
end $$;
create trigger stock_counts_guard before update or delete on public.stock_counts
  for each row execute function public.stock_counts_guard();

create or replace function public.stock_count_lines_guard() returns trigger
language plpgsql as $$
declare st text;
begin
  select status into st from public.stock_counts where id = coalesce(new.count_id, old.count_id);
  if tg_op = 'DELETE' then raise exception 'Baris opname tidak dapat dihapus'; end if;
  if tg_op = 'UPDATE' and st not in ('OPEN', 'COUNTING', 'REVIEW') then
    raise exception 'Hasil hitung tidak dapat diubah setelah opname disetujui atau dibatalkan';
  end if;
  return new;
end $$;
create trigger stock_count_lines_guard before update or delete on public.stock_count_lines
  for each row execute function public.stock_count_lines_guard();

-- ---------------------------------------------------------------- RLS
alter table public.stock_documents enable row level security;
alter table public.stock_document_lines enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;

create policy stock_documents_select on public.stock_documents for select to authenticated
  using (public.has_permission('stock.read') and public.can_see_branch(branch_id));
create policy stock_document_lines_select on public.stock_document_lines for select to authenticated
  using (exists (select 1 from public.stock_documents d where d.id = document_id));
create policy stock_balances_select on public.stock_balances for select to authenticated
  using (public.has_permission('stock.read') and public.can_see_branch(public.location_branch(location_id)));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_permission('stock.read') and public.can_see_branch(branch_id));
create policy stock_counts_select on public.stock_counts for select to authenticated
  using (public.has_permission('stock.read') and public.can_see_branch(branch_id));
create policy stock_count_lines_select on public.stock_count_lines for select to authenticated
  using (exists (select 1 from public.stock_counts c where c.id = count_id));

-- ---------------------------------------------------------------- pembantu
create or replace function public._uom_whole(p_uom text) returns boolean
language sql immutable as $$ select lower(p_uom) in ('pcs', 'set', 'pail', 'unit', 'buah', 'roll', 'box', 'drum') $$;

create or replace function public._fmt_qty(n numeric) returns text
language sql immutable as $$ select trim_scale(n)::text $$;

create or replace function public._stock_available(p_sparepart uuid, p_location uuid, p_wo uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  onhand numeric := 0;
  reserved numeric := 0;
  own numeric := 0;
begin
  select qty_on_hand, qty_reserved into onhand, reserved
  from public.stock_balances where sparepart_id = p_sparepart and location_id = p_location;
  if p_wo is not null then
    select coalesce(sum(qty_reserved_applied), 0) into own
    from public.wo_parts where work_order_id = p_wo and sparepart_id = p_sparepart and location_id = p_location;
  end if;
  return coalesce(onhand, 0) - coalesce(reserved, 0) + own;
end $$;

-- pengguna biasa hanya boleh mutasi Keluar untuk WO yang ditugaskan padanya (permission stock.cancel = operator gudang penuh)
create or replace function public._stock_can_operate(p_type text, p_wo uuid, p_branch uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sesi berakhir, silakan login kembali'; end if;
  if not public.has_permission('stock.create') then raise exception 'Anda tidak berwenang membuat mutasi sparepart'; end if;
  if not public.can_see_branch(p_branch) then raise exception 'Cabang ini bukan cabang Anda'; end if;
  if not public.has_permission('stock.cancel') then
    if p_type <> 'OUT' then
      raise exception 'Anda hanya dapat membuat mutasi Keluar untuk Work Order yang ditugaskan kepada Anda';
    end if;
    if p_wo is null or not exists (select 1 from public.work_orders w where w.id = p_wo and w.assignee_id = auth.uid()) then
      raise exception 'Mutasi Keluar harus merujuk Work Order yang ditugaskan kepada Anda';
    end if;
  end if;
end $$;

create or replace function public._count_blocking(p_location uuid) returns text
language sql stable security definer set search_path = public as $$
  select c.count_no from public.stock_counts c
  where c.location_id = p_location and c.status in ('OPEN', 'COUNTING', 'REVIEW')
    and public.param_text('count.freeze_mode', 'freeze') = 'freeze'
  limit 1;
$$;

-- ---------------------------------------------------------------- simpan draft
create or replace function public.stock_doc_save(
  p_id uuid, p_type text, p_branch uuid, p_date date, p_vehicle uuid, p_wo uuid,
  p_from uuid, p_to uuid, p_notes text, p_lines jsonb, p_version integer default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d public.stock_documents;
  did uuid := p_id;
  ln jsonb;
  i integer := 0;
  sp public.spareparts;
  q numeric;
  lf uuid;
  lt uuid;
  prefix text;
  v uuid := p_vehicle;
  w record;
  b uuid := p_branch;
begin
  if p_type not in ('IN', 'OUT', 'RETURN', 'TRANSFER', 'ADJUSTMENT') then raise exception 'Tipe mutasi tidak valid'; end if;
  if p_id is not null then
    select * into d from public.stock_documents where id = p_id for update;
    if not found then raise exception 'Dokumen tidak ditemukan'; end if;
    if d.status <> 'DRAFT' then raise exception 'Dokumen % sudah diajukan dan tidak dapat diubah', d.doc_no; end if;
    if p_version is not null and d.row_version <> p_version then
      raise exception 'Data diubah oleh pengguna lain, muat ulang lalu coba lagi';
    end if;
    b := d.branch_id;
  end if;
  if b is null then raise exception 'Cabang wajib diisi'; end if;
  perform public._stock_can_operate(p_type, p_wo, b);

  if p_wo is not null then
    select * into w from public.work_orders where id = p_wo;
    if not found or w.branch_id <> b then raise exception 'Work Order tidak ditemukan pada cabang ini'; end if;
    if w.status not in ('PLANNED', 'SCHEDULED', 'IN_PROGRESS') then
      raise exception 'Work Order % berstatus % sehingga tidak dapat dipakai untuk mutasi', w.wo_no, w.status;
    end if;
    v := w.vehicle_id;
  end if;
  if v is not null and not exists (select 1 from public.vehicles where id = v and branch_id = b) then
    raise exception 'Kendaraan tidak ditemukan pada cabang ini';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Daftar item tidak valid'; end if;

  prefix := case p_type when 'IN' then 'MSK' when 'OUT' then 'KLR' when 'RETURN' then 'RTR' when 'TRANSFER' then 'TRF' else 'ADJ' end;
  if did is null then
    insert into public.stock_documents (doc_no, type, branch_id, doc_date, vehicle_id, work_order_id, from_location_id, to_location_id, notes)
    values (public._next_doc_no(prefix, b), p_type, b, coalesce(p_date, current_date), v, p_wo,
            case when p_type in ('OUT', 'TRANSFER') then p_from end,
            case when p_type in ('IN', 'RETURN', 'TRANSFER') then p_to end,
            nullif(btrim(coalesce(p_notes, '')), ''))
    returning id into did;
  else
    update public.stock_documents
    set doc_date = coalesce(p_date, doc_date), vehicle_id = v, work_order_id = p_wo,
        from_location_id = case when p_type in ('OUT', 'TRANSFER') then p_from end,
        to_location_id = case when p_type in ('IN', 'RETURN', 'TRANSFER') then p_to end,
        notes = nullif(btrim(coalesce(p_notes, '')), '')
    where id = did;
    delete from public.stock_document_lines where document_id = did;
  end if;

  for ln in select * from jsonb_array_elements(p_lines) loop
    select * into sp from public.spareparts where id = (ln ->> 'sparepart_id')::uuid;
    if not found then raise exception 'Sparepart tidak ditemukan'; end if;
    if not sp.is_active then raise exception 'Sparepart % nonaktif', sp.name; end if;
    begin
      q := replace(coalesce(ln ->> 'qty', ''), ',', '.')::numeric;
    exception when others then
      raise exception 'Qty % tidak valid', sp.name;
    end;
    if q is null or q <= 0 then raise exception 'Qty % harus lebih dari 0', sp.name; end if;
    if public._uom_whole(sp.uom) and q <> trunc(q) then
      raise exception 'Qty % harus bilangan bulat (satuan %)', sp.name, sp.uom;
    end if;
    lf := case when p_type = 'ADJUSTMENT' then nullif(ln ->> 'from_location_id', '')::uuid
               when p_type in ('OUT', 'TRANSFER') then coalesce(nullif(ln ->> 'from_location_id', '')::uuid, p_from) end;
    lt := case when p_type = 'ADJUSTMENT' then nullif(ln ->> 'to_location_id', '')::uuid
               when p_type in ('IN', 'RETURN', 'TRANSFER') then coalesce(nullif(ln ->> 'to_location_id', '')::uuid, p_to) end;
    if lf is not null and public.location_branch(lf) is distinct from b then raise exception 'Lokasi asal harus berada di cabang dokumen'; end if;
    if lt is not null and public.location_branch(lt) is distinct from b then raise exception 'Lokasi tujuan harus berada di cabang dokumen'; end if;
    i := i + 1;
    insert into public.stock_document_lines (document_id, line_no, sparepart_id, qty, from_location_id, to_location_id, notes)
    values (did, i, sp.id, q, lf, lt, nullif(btrim(coalesce(ln ->> 'notes', '')), ''));
  end loop;
  return did;
end $$;

-- ---------------------------------------------------------------- ajukan
create or replace function public.stock_doc_submit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.stock_documents;
  l record;
  need record;
  nlines integer;
  total numeric;
  avail numeric;
  blocking text;
  veh text;
  sp_name text;
  loc_name text;
  type_label text;
  loc_id uuid;
  st text;
  rid uuid;
begin
  select * into d from public.stock_documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan'; end if;
  perform public._stock_can_operate(d.type, d.work_order_id, d.branch_id);
  if d.status <> 'DRAFT' then raise exception 'Hanya dokumen Draft yang dapat diajukan'; end if;

  select count(*), coalesce(sum(qty), 0) into nlines, total from public.stock_document_lines where document_id = d.id;
  if nlines = 0 then raise exception 'Tambahkan minimal satu item'; end if;

  for l in select * from public.stock_document_lines where document_id = d.id order by line_no loop
    select name into sp_name from public.spareparts where id = l.sparepart_id;
    case d.type
      when 'IN', 'RETURN' then
        if l.to_location_id is null then raise exception 'Lokasi tujuan wajib diisi (%)', sp_name; end if;
      when 'OUT' then
        if l.from_location_id is null then raise exception 'Lokasi asal wajib diisi (%)', sp_name; end if;
      when 'TRANSFER' then
        if l.from_location_id is null or l.to_location_id is null then raise exception 'Lokasi asal dan tujuan wajib diisi (%)', sp_name; end if;
        if l.from_location_id = l.to_location_id then raise exception 'Lokasi asal dan tujuan tidak boleh sama (%)', sp_name; end if;
      else
        if l.from_location_id is null and l.to_location_id is null then raise exception 'Lokasi wajib diisi (%)', sp_name; end if;
    end case;
    foreach loc_id in array array[l.from_location_id, l.to_location_id] loop
      if loc_id is not null then
        blocking := public._count_blocking(loc_id);
        if blocking is not null then
          select name into loc_name from public.locations where id = loc_id;
          raise exception 'Lokasi % sedang diopname (%); mutasi ditahan sampai opname selesai', loc_name, blocking;
        end if;
      end if;
    end loop;
  end loop;

  if d.type = 'OUT' and d.vehicle_id is null and d.work_order_id is null then
    raise exception 'Mutasi Keluar wajib mengisi kendaraan atau Work Order';
  end if;

  for need in
    select dl.sparepart_id, dl.from_location_id as loc, sum(dl.qty) as qty
    from public.stock_document_lines dl
    where dl.document_id = d.id and dl.from_location_id is not null
    group by dl.sparepart_id, dl.from_location_id
  loop
    avail := public._stock_available(need.sparepart_id, need.loc, d.work_order_id);
    if need.qty > avail then
      select name into sp_name from public.spareparts where id = need.sparepart_id;
      select name into loc_name from public.locations where id = need.loc;
      raise exception '%: diminta %, tersedia % di %', sp_name, public._fmt_qty(need.qty), public._fmt_qty(greatest(avail, 0)), loc_name;
    end if;
  end loop;

  update public.stock_documents set status = 'SUBMITTED', submitted_at = now() where id = d.id;
  select plate_no into veh from public.vehicles where id = d.vehicle_id;
  type_label := case d.type when 'IN' then 'Masuk' when 'OUT' then 'Keluar' when 'RETURN' then 'Retur' when 'TRANSFER' then 'Transfer' else 'Penyesuaian' end;
  rid := public._approval_submit('STOCK', d.id, d.doc_no,
    nlines || ' item, ' || type_label || coalesce(', ' || veh, ''), d.branch_id,
    jsonb_build_object('total_qty', total, 'item_count', nlines));
  select status into st from public.stock_documents where id = d.id;
  return jsonb_build_object('status', st, 'request_id', rid);
end $$;

-- ---------------------------------------------------------------- batal & pembalik
create or replace function public.stock_doc_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.stock_documents;
begin
  if auth.uid() is null or not public.has_permission('stock.cancel') then raise exception 'Anda tidak berwenang membatalkan mutasi'; end if;
  select * into d from public.stock_documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan'; end if;
  if not public.can_see_branch(d.branch_id) then raise exception 'Dokumen ini berada di cabang lain'; end if;
  if d.status not in ('DRAFT', 'SUBMITTED') then
    raise exception 'Dokumen berstatus % tidak dapat dibatalkan; gunakan Buat Pembalik bila sudah diposting', d.status;
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Alasan pembatalan wajib diisi'; end if;
  if d.status = 'SUBMITTED' then perform public._approval_cancel('STOCK', d.id, p_reason); end if;
  update public.stock_documents set status = 'CANCELLED', cancel_reason = btrim(p_reason) where id = d.id;
end $$;

create or replace function public.stock_doc_reverse(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d public.stock_documents;
  nid uuid;
begin
  if auth.uid() is null or not public.has_permission('stock.cancel') then raise exception 'Anda tidak berwenang membuat dokumen pembalik'; end if;
  select * into d from public.stock_documents where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan'; end if;
  if not public.can_see_branch(d.branch_id) then raise exception 'Dokumen ini berada di cabang lain'; end if;
  if d.status <> 'POSTED' then raise exception 'Hanya dokumen yang sudah diposting yang dapat dibalik'; end if;
  if d.reverses_doc_id is not null then raise exception 'Dokumen pembalik tidak dapat dibalik lagi'; end if;
  if exists (select 1 from public.stock_documents x where x.reverses_doc_id = d.id and x.status not in ('CANCELLED', 'REJECTED')) then
    raise exception 'Dokumen % sudah memiliki dokumen pembalik', d.doc_no;
  end if;
  insert into public.stock_documents (doc_no, type, branch_id, doc_date, notes, reverses_doc_id)
  values (public._next_doc_no('ADJ', d.branch_id), 'ADJUSTMENT', d.branch_id, current_date, 'Pembalik ' || d.doc_no, d.id)
  returning id into nid;
  insert into public.stock_document_lines (document_id, line_no, sparepart_id, qty, from_location_id, to_location_id, notes)
  select nid, line_no, sparepart_id, qty, to_location_id, from_location_id, 'Pembalik ' || d.doc_no
  from public.stock_document_lines where document_id = d.id;
  return nid;
end $$;

-- ---------------------------------------------------------------- posting (satu-satunya penulis saldo)
create or replace function public._stock_check_low(p_sparepart uuid, p_branch uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  sp public.spareparts;
  total numeric;
begin
  select * into sp from public.spareparts where id = p_sparepart;
  select coalesce(sum(b.qty_on_hand), 0) into total
  from public.stock_balances b join public.locations l on l.id = b.location_id
  where b.sparepart_id = p_sparepart and l.branch_id = p_branch;
  if sp.min_stock > 0 and total < sp.min_stock then
    perform public._notify_users(
      public._users_with_permission('stock.cancel', p_branch) || public._users_with_permission('approval.viewall', p_branch),
      'stock', 'Stok di bawah minimum',
      sp.name || ': tersisa ' || public._fmt_qty(total) || ' ' || sp.uom || ' (minimum ' || public._fmt_qty(sp.min_stock) || ')',
      '/inventory/balances?low=1', 'low:' || p_sparepart::text || ':' || p_branch::text || ':' || current_date::text);
  end if;
end $$;

create or replace function public._stock_doc_post(p_doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.stock_documents;
  leg record;
  bal numeric;
  sp_name text;
  loc_name text;
  touched uuid[] := array[]::uuid[];
  spid uuid;
begin
  select * into d from public.stock_documents where id = p_doc for update;
  if d.status <> 'APPROVED' then raise exception 'Dokumen % belum disetujui atau sudah diposting', d.doc_no; end if;

  for leg in
    select line_id, sparepart_id, location_id, delta from (
      select id as line_id, sparepart_id, from_location_id as location_id, -qty as delta
      from public.stock_document_lines where document_id = d.id and from_location_id is not null
      union all
      select id, sparepart_id, to_location_id, qty
      from public.stock_document_lines where document_id = d.id and to_location_id is not null
    ) x order by sparepart_id, location_id, delta
  loop
    insert into public.stock_balances (sparepart_id, location_id) values (leg.sparepart_id, leg.location_id)
    on conflict do nothing;
    select qty_on_hand into bal from public.stock_balances
    where sparepart_id = leg.sparepart_id and location_id = leg.location_id for update;
    if bal + leg.delta < 0 then
      select name into sp_name from public.spareparts where id = leg.sparepart_id;
      select name into loc_name from public.locations where id = leg.location_id;
      raise exception '%: diminta %, tersedia % di %', sp_name, public._fmt_qty(-leg.delta), public._fmt_qty(bal), loc_name;
    end if;
    update public.stock_balances
    set qty_on_hand = bal + leg.delta, updated_at = now()
    where sparepart_id = leg.sparepart_id and location_id = leg.location_id;
    insert into public.stock_movements (document_id, line_id, doc_no, doc_type, sparepart_id, location_id, branch_id,
                                        qty_delta, balance_after, vehicle_id, work_order_id, posted_by)
    values (d.id, leg.line_id, d.doc_no, d.type, leg.sparepart_id, leg.location_id, d.branch_id,
            leg.delta, bal + leg.delta, d.vehicle_id, d.work_order_id, auth.uid());
    if leg.delta < 0 then touched := array_append(touched, leg.sparepart_id); end if;
  end loop;

  update public.stock_documents set status = 'POSTED', posted_at = now(), posted_by = auth.uid() where id = d.id;
  perform public._wo_on_stock_posted(d.id);
  for spid in select distinct x from unnest(touched) x loop
    perform public._stock_check_low(spid, d.branch_id);
  end loop;
end $$;

-- handler approval
create or replace function public._stock_doc_on_approval(p_doc uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_outcome = 'APPROVED' then
    update public.stock_documents set status = 'APPROVED', decision_note = p_note where id = p_doc;
    perform public._stock_doc_post(p_doc);
  elsif p_outcome = 'REJECTED' then
    update public.stock_documents set status = 'REJECTED', decision_note = p_note where id = p_doc;
  elsif p_outcome = 'REVISION' then
    update public.stock_documents set status = 'DRAFT', decision_note = p_note where id = p_doc;
  end if;
end $$;

-- ---------------------------------------------------------------- stock opname
create or replace function public.count_open(p_location uuid, p_type text, p_category text, p_notes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  loc public.locations;
  cid uuid;
  n integer;
begin
  if auth.uid() is null or not public.has_permission('count.create') then raise exception 'Anda tidak berwenang membuka sesi opname'; end if;
  if p_type not in ('PERIODIC', 'AD_HOC') then raise exception 'Tipe opname tidak valid'; end if;
  select * into loc from public.locations where id = p_location;
  if not found or not loc.is_active then raise exception 'Lokasi tidak ditemukan'; end if;
  if not public.can_see_branch(loc.branch_id) then raise exception 'Lokasi ini berada di cabang lain'; end if;
  if exists (select 1 from public.stock_counts where location_id = p_location and status in ('OPEN', 'COUNTING', 'REVIEW')) then
    raise exception 'Lokasi % masih memiliki sesi opname yang berjalan', loc.name;
  end if;
  insert into public.stock_counts (count_no, branch_id, location_id, type, category, notes)
  values (public._next_doc_no('OPN', loc.branch_id), loc.branch_id, p_location, p_type,
          nullif(btrim(coalesce(p_category, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into cid;
  insert into public.stock_count_lines (count_id, sparepart_id, snapshot_qty, system_qty)
  select cid, b.sparepart_id, b.qty_on_hand, b.qty_on_hand
  from public.stock_balances b join public.spareparts s on s.id = b.sparepart_id
  where b.location_id = p_location and s.is_active
    and (nullif(btrim(coalesce(p_category, '')), '') is null or s.category = btrim(p_category));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Lokasi % tidak memiliki stok untuk dihitung', loc.name; end if;
  return cid;
end $$;

create or replace function public.count_enter(p_id uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.stock_counts;
  ln jsonb;
  q numeric;
  nc boolean;
  sp public.spareparts;
begin
  if auth.uid() is null or not public.has_permission('count.enter') then raise exception 'Anda tidak berwenang menginput hasil hitung'; end if;
  select * into c from public.stock_counts where id = p_id for update;
  if not found then raise exception 'Sesi opname tidak ditemukan'; end if;
  if not public.can_see_branch(c.branch_id) then raise exception 'Sesi ini berada di cabang lain'; end if;
  if c.status not in ('OPEN', 'COUNTING') then raise exception 'Opname berstatus % sehingga hasil hitung tidak dapat diubah', c.status; end if;
  for ln in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    nc := coalesce((ln ->> 'not_counted')::boolean, false);
    q := null;
    if not nc and nullif(btrim(coalesce(ln ->> 'counted_qty', '')), '') is not null then
      begin
        q := replace(btrim(ln ->> 'counted_qty'), ',', '.')::numeric;
      exception when others then
        raise exception 'Qty hitung tidak valid';
      end;
      if q < 0 then raise exception 'Qty hitung tidak boleh negatif'; end if;
    end if;
    select * into sp from public.spareparts where id = (ln ->> 'sparepart_id')::uuid;
    if q is not null and public._uom_whole(sp.uom) and q <> trunc(q) then
      raise exception 'Qty % harus bilangan bulat (satuan %)', sp.name, sp.uom;
    end if;
    update public.stock_count_lines
    set counted_qty = q, not_counted = nc,
        reason_code_id = nullif(ln ->> 'reason_code_id', '')::uuid,
        reason_note = nullif(btrim(coalesce(ln ->> 'reason_note', '')), '')
    where count_id = p_id and sparepart_id = (ln ->> 'sparepart_id')::uuid;
  end loop;
  if c.status = 'OPEN' then update public.stock_counts set status = 'COUNTING' where id = p_id; end if;
end $$;

create or replace function public.count_submit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.stock_counts;
  l record;
  sp_name text;
  rc public.reason_codes;
  abs_total numeric;
  diff_items integer;
  rid uuid;
  st text;
begin
  if auth.uid() is null or not public.has_permission('count.create') then raise exception 'Anda tidak berwenang mengajukan opname'; end if;
  select * into c from public.stock_counts where id = p_id for update;
  if not found then raise exception 'Sesi opname tidak ditemukan'; end if;
  if not public.can_see_branch(c.branch_id) then raise exception 'Sesi ini berada di cabang lain'; end if;
  if c.status <> 'COUNTING' then raise exception 'Hanya opname berstatus Penghitungan yang dapat diajukan'; end if;

  if public.param_text('count.freeze_mode', 'freeze') = 'recount' then
    update public.stock_count_lines cl
    set system_qty = coalesce((select b.qty_on_hand from public.stock_balances b
                               where b.sparepart_id = cl.sparepart_id and b.location_id = c.location_id), 0)
    where cl.count_id = c.id;
  end if;

  for l in select cl.*, s.name as sp_name from public.stock_count_lines cl join public.spareparts s on s.id = cl.sparepart_id
           where cl.count_id = c.id order by s.name loop
    if l.counted_qty is null and not l.not_counted then
      raise exception '% belum dihitung. Isi qty fisik atau tandai "tidak dihitung" dengan alasan', l.sp_name;
    end if;
    if l.not_counted and (l.reason_code_id is null) then
      raise exception '% ditandai tidak dihitung; alasan wajib diisi', l.sp_name;
    end if;
    if l.counted_qty is not null and l.counted_qty <> l.system_qty and l.reason_code_id is null then
      raise exception '% berselisih (sistem %, fisik %); alasan wajib diisi', l.sp_name, public._fmt_qty(l.system_qty), public._fmt_qty(l.counted_qty);
    end if;
    if l.reason_code_id is not null then
      select * into rc from public.reason_codes where id = l.reason_code_id;
      if rc.require_note and l.reason_note is null then
        raise exception '% : alasan "%" wajib disertai keterangan', l.sp_name, rc.name;
      end if;
    end if;
  end loop;

  select coalesce(sum(abs(diff_qty)), 0), count(*) filter (where diff_qty <> 0)
  into abs_total, diff_items from public.stock_count_lines where count_id = c.id and counted_qty is not null;

  update public.stock_counts set status = 'REVIEW', review_at = now() where id = c.id;
  rid := public._approval_submit('COUNT', c.id, c.count_no,
    diff_items || ' item selisih, total ' || public._fmt_qty(abs_total), c.branch_id,
    jsonb_build_object('abs_diff_total', abs_total, 'diff_items', diff_items));
  select status into st from public.stock_counts where id = c.id;
  return jsonb_build_object('status', st, 'request_id', rid);
end $$;

create or replace function public.count_cancel(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.stock_counts;
begin
  if auth.uid() is null or not public.has_permission('count.create') then raise exception 'Anda tidak berwenang membatalkan opname'; end if;
  select * into c from public.stock_counts where id = p_id for update;
  if not found then raise exception 'Sesi opname tidak ditemukan'; end if;
  if not public.can_see_branch(c.branch_id) then raise exception 'Sesi ini berada di cabang lain'; end if;
  if c.status not in ('OPEN', 'COUNTING', 'REVIEW') then raise exception 'Opname berstatus % tidak dapat dibatalkan', c.status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Alasan pembatalan wajib diisi'; end if;
  if c.status = 'REVIEW' then perform public._approval_cancel('COUNT', c.id, p_reason); end if;
  update public.stock_counts set status = 'CANCELLED', cancel_reason = btrim(p_reason), closed_at = now() where id = c.id;
end $$;

create or replace function public._count_on_approval(p_count uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.stock_counts;
  did uuid;
  n integer := 0;
begin
  select * into c from public.stock_counts where id = p_count for update;
  if p_outcome in ('REJECTED', 'REVISION') then
    update public.stock_counts set status = 'COUNTING', decision_note = p_note where id = c.id;
    return;
  end if;
  update public.stock_counts set status = 'APPROVED', decision_note = p_note where id = c.id;
  insert into public.stock_documents (doc_no, type, branch_id, notes, count_id)
  values (public._next_doc_no('ADJ', c.branch_id), 'ADJUSTMENT', c.branch_id, 'Penyesuaian opname ' || c.count_no, c.id)
  returning id into did;
  insert into public.stock_document_lines (document_id, line_no, sparepart_id, qty, from_location_id, to_location_id, notes)
  select did, row_number() over (order by sparepart_id), sparepart_id, abs(diff_qty),
         case when diff_qty < 0 then c.location_id end,
         case when diff_qty > 0 then c.location_id end,
         'Opname ' || c.count_no
  from public.stock_count_lines where count_id = c.id and diff_qty is not null and diff_qty <> 0;
  get diagnostics n = row_count;
  if n > 0 then
    update public.stock_documents set status = 'APPROVED' where id = did;
    perform public._stock_doc_post(did);
    update public.stock_counts set adjustment_doc_id = did where id = c.id;
  else
    update public.stock_documents set status = 'CANCELLED', cancel_reason = 'Tidak ada selisih' where id = did;
  end if;
  update public.stock_counts set status = 'ADJUSTED', closed_at = now() where id = c.id;
end $$;

grant select on public.stock_documents, public.stock_document_lines, public.stock_balances, public.stock_movements,
  public.stock_counts, public.stock_count_lines to authenticated;
grant all on public.stock_documents, public.stock_document_lines, public.stock_balances, public.stock_movements,
  public.stock_counts, public.stock_count_lines to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

select public._lockdown_functions();
