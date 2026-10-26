-- Daftar pengemudi untuk dialog "Catat Insiden" (laporan lewat telepon).
-- Sebelumnya dibaca langsung dari user_roles, yang hanya boleh dibaca pemegang izin admin, sehingga
-- Admin Pusat selalu melihat daftar kosong dan tidak dapat mencatat atas nama pengemudi.
create or replace function public.incident_drivers() returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
  where public.has_permission('incident.handle')
    and r.name = 'DRIVER'
    and p.is_active
    and public.can_see_branch(p.branch_id)
  order by p.name;
$$;

select public._lockdown_functions();
