-- Perubahan jadwal diajukan oleh teknisi (atau pembuat WO di pusat), diputuskan Supervisor.
-- Sebelumnya Supervisor sekaligus pengaju dan approver level 1, sehingga pengajuannya macet
-- (pengaju tidak boleh memutuskan dokumennya sendiri).

-- Supervisor tidak lagi mengajukan; Mekanik mengajukan untuk WO yang ditugaskan kepadanya.
delete from public.role_permissions
where permission_code = 'schedule.request'
  and role_id = (select id from public.roles where name = 'SUPERVISOR');

insert into public.role_permissions (role_id, permission_code)
select r.id, 'schedule.request' from public.roles r where r.name = 'MECHANIC'
on conflict do nothing;

-- Mekanik hanya boleh mengajukan untuk WO miliknya; pemegang wo.write (Admin Pusat) untuk WO mana pun di cabangnya.
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
  if not public.has_permission('wo.write') and w.assignee_id is distinct from auth.uid() then
    raise exception 'Perubahan jadwal hanya dapat diajukan oleh teknisi yang ditugaskan pada WO ini';
  end if;
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

select public._lockdown_functions();
