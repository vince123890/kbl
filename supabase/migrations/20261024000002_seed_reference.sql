-- Data referensi awal: cabang pusat, permission, 7 role bawaan, kategori alasan, parameter sistem.

insert into public.branches (code, name, is_hq) values ('HQ', 'Kantor Pusat', true);

insert into public.permissions (code, description) values
  ('master.read', 'Melihat data master'),
  ('master.write', 'Mengubah data master'),
  ('stock.read', 'Melihat stok dan mutasi'),
  ('stock.create', 'Membuat mutasi sparepart'),
  ('stock.cancel', 'Membatalkan mutasi sparepart'),
  ('count.create', 'Membuat sesi stock opname'),
  ('count.enter', 'Menginput hasil hitung opname'),
  ('plan.write', 'Mengelola rencana perawatan'),
  ('wo.read', 'Melihat work order'),
  ('wo.write', 'Membuat dan mengubah work order'),
  ('wo.execute', 'Menjalankan work order'),
  ('schedule.request', 'Mengajukan perubahan jadwal'),
  ('incident.report', 'Melaporkan insiden emergensi'),
  ('incident.handle', 'Menangani insiden emergensi'),
  ('contact.manage', 'Mengelola kontak darurat dan langkah cepat'),
  ('approval.act', 'Memutuskan approval'),
  ('approval.viewall', 'Melihat semua antrean approval'),
  ('approval.override', 'Override approval'),
  ('report.view', 'Melihat laporan'),
  ('report.export', 'Mengekspor laporan'),
  ('admin.user', 'Mengelola user'),
  ('admin.role', 'Mengelola role dan permission'),
  ('admin.flow', 'Mengelola alur approval'),
  ('admin.param', 'Mengelola parameter sistem'),
  ('audit.view', 'Melihat audit log'),
  ('branch.all', 'Mengakses data semua cabang');

insert into public.roles (name, description, is_builtin) values
  ('DRIVER', 'Pengemudi', true),
  ('MECHANIC', 'Mekanik / Teknisi', true),
  ('WAREHOUSE', 'Staf Gudang', true),
  ('SUPERVISOR', 'Supervisor Workshop', true),
  ('DEPT_HEAD', 'Kepala Departemen', true),
  ('HQ_ADMIN', 'Admin Pusat / Control Tower', true),
  ('SYS_ADMIN', 'Admin Sistem', true);

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from (values
  ('DRIVER', 'wo.read'), ('DRIVER', 'incident.report'),

  ('MECHANIC', 'master.read'), ('MECHANIC', 'stock.read'), ('MECHANIC', 'stock.create'),
  ('MECHANIC', 'wo.read'), ('MECHANIC', 'wo.execute'), ('MECHANIC', 'incident.report'), ('MECHANIC', 'report.view'),

  ('WAREHOUSE', 'master.read'), ('WAREHOUSE', 'stock.read'), ('WAREHOUSE', 'stock.create'),
  ('WAREHOUSE', 'stock.cancel'), ('WAREHOUSE', 'count.create'), ('WAREHOUSE', 'count.enter'),
  ('WAREHOUSE', 'wo.read'), ('WAREHOUSE', 'incident.report'), ('WAREHOUSE', 'report.view'), ('WAREHOUSE', 'report.export'),

  ('SUPERVISOR', 'master.read'), ('SUPERVISOR', 'stock.read'), ('SUPERVISOR', 'plan.write'),
  ('SUPERVISOR', 'wo.read'), ('SUPERVISOR', 'wo.write'), ('SUPERVISOR', 'wo.execute'),
  ('SUPERVISOR', 'schedule.request'), ('SUPERVISOR', 'incident.report'), ('SUPERVISOR', 'incident.handle'),
  ('SUPERVISOR', 'approval.act'), ('SUPERVISOR', 'report.view'), ('SUPERVISOR', 'report.export'),

  ('DEPT_HEAD', 'master.read'), ('DEPT_HEAD', 'stock.read'), ('DEPT_HEAD', 'wo.read'),
  ('DEPT_HEAD', 'incident.report'), ('DEPT_HEAD', 'approval.act'),
  ('DEPT_HEAD', 'report.view'), ('DEPT_HEAD', 'report.export'),

  ('HQ_ADMIN', 'master.read'), ('HQ_ADMIN', 'stock.read'), ('HQ_ADMIN', 'plan.write'),
  ('HQ_ADMIN', 'wo.read'), ('HQ_ADMIN', 'wo.write'), ('HQ_ADMIN', 'schedule.request'),
  ('HQ_ADMIN', 'incident.report'), ('HQ_ADMIN', 'incident.handle'), ('HQ_ADMIN', 'contact.manage'),
  ('HQ_ADMIN', 'approval.act'), ('HQ_ADMIN', 'approval.viewall'), ('HQ_ADMIN', 'approval.override'),
  ('HQ_ADMIN', 'report.view'), ('HQ_ADMIN', 'report.export'), ('HQ_ADMIN', 'audit.view'), ('HQ_ADMIN', 'branch.all'),

  ('SYS_ADMIN', 'master.read'), ('SYS_ADMIN', 'master.write'), ('SYS_ADMIN', 'stock.read'),
  ('SYS_ADMIN', 'report.view'), ('SYS_ADMIN', 'report.export'),
  ('SYS_ADMIN', 'admin.user'), ('SYS_ADMIN', 'admin.role'), ('SYS_ADMIN', 'admin.flow'), ('SYS_ADMIN', 'admin.param'),
  ('SYS_ADMIN', 'audit.view'), ('SYS_ADMIN', 'branch.all')
) as m (role_name, perm)
join public.roles r on r.name = m.role_name
join public.permissions p on p.code = m.perm;

insert into public.reason_codes (code, name, used_for, require_note) values
  ('VEH_OPERATING', 'Kendaraan masih beroperasi', 'SCHEDULE_CHANGE', false),
  ('PART_UNAVAILABLE', 'Sparepart belum tersedia', 'SCHEDULE_CHANGE', false),
  ('SUDDEN_DAMAGE', 'Kerusakan mendadak', 'SCHEDULE_CHANGE', false),
  ('OPS_REQUEST', 'Permintaan operasional', 'SCHEDULE_CHANGE', false),
  ('WEATHER_ROAD', 'Cuaca / kondisi jalan', 'SCHEDULE_CHANGE', false),
  ('WORKSHOP_FULL', 'Bengkel penuh', 'SCHEDULE_CHANGE', false),
  ('OTHER', 'Lainnya', 'ALL', true);

insert into public.system_parameters (key, value, type, grp, label, min_value, max_value) values
  ('maintenance.lead_days', '7', 'int', 'Perawatan', 'Lead time WO preventif (hari)', 0, 90),
  ('maintenance.lead_km', '500', 'int', 'Perawatan', 'Lead time WO preventif (km)', 0, 50000),
  ('incident.ack_minutes', '5', 'int', 'Emergensi', 'Batas waktu ACK insiden (menit)', 1, 120),
  ('incident.validation_hours', '24', 'int', 'Emergensi', 'Batas validasi WO emergensi (jam)', 1, 168),
  ('approval.reminder_hours', '12', 'int', 'Approval', 'Interval reminder SLA (jam)', 1, 168),
  ('count.freeze_mode', 'freeze', 'text', 'Opname', 'Mode opname (freeze / recount)', null, null),
  ('stock.reservation_enabled', 'true', 'bool', 'Stok', 'Aktifkan reservasi stok', null, null),
  ('attachment.max_files', '5', 'int', 'Lampiran', 'Maksimum jumlah lampiran', 1, 20),
  ('attachment.max_mb', '5', 'int', 'Lampiran', 'Maksimum ukuran lampiran (MB)', 1, 50);
