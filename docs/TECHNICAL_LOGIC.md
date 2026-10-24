# Technical Logic — Sistem Manajemen Perawatan & Sparepart Kendaraan (KBL)

| | |
|---|---|
| Versi | 0.1 (draft) |
| Tanggal | 2026-10-24 |
| Dokumen terkait | [PRD.md](PRD.md), [requirement.docx](requirement.docx) |

Dokumen ini menjabarkan logika sistem dari PRD: model data, state machine, aturan bisnis, dan kontrak API. Bersifat **stack-agnostic**; tipe data memakai notasi umum. Item bertanda **[Asumsi]** belum dikonfirmasi.

---

## 1. Arsitektur Ringkas

```
[Web / PWA Mobile] ──HTTPS──> [API Backend] ──> [RDBMS]
                                   │
                                   ├── Approval Engine
                                   ├── Scheduler (job berkala)
                                   ├── Notification Service (push/email/WA/SMS) [Asumsi]
                                   └── Object Storage (foto/lampiran)
```

Prinsip:
- **Ledger-based stock**: saldo stok diturunkan dari tabel mutasi (`stock_movements`) yang append-only; tabel saldo hanya cache yang diperbarui dalam transaksi yang sama.
- **Approval engine generik**: satu mekanisme untuk semua jenis dokumen.
- **Audit log** pada semua perubahan entitas penting.
- **Multi-cabang**: setiap data transaksi membawa `branch_id`; RBAC dibatasi per cabang, peran pusat melintasi cabang.

## 2. Model Data

### 2.1 Master

| Tabel | Kolom utama |
|---|---|
| `branches` | id, code, name, is_hq |
| `users` | id, name, phone, email, branch_id, status |
| `roles`, `user_roles` | role (DRIVER, MECHANIC, WAREHOUSE, SUPERVISOR, DEPT_HEAD, HQ_ADMIN, SYS_ADMIN) |
| `vehicles` | id, plate_no, type, model, year, branch_id, odometer, status (ACTIVE, IN_MAINTENANCE, OUT_OF_SERVICE) |
| `spareparts` | id, code, name, category, uom, min_stock, is_active |
| `locations` | id, branch_id, code, name (gudang/rak) |
| `vendors` | id, name, type (BENGKEL, DEREK, ASURANSI, SUPPLIER), phone, region |

### 2.2 Stok

| Tabel | Kolom utama |
|---|---|
| `stock_balances` | sparepart_id, location_id, qty_on_hand, qty_reserved, updated_at — PK (sparepart_id, location_id) |
| `stock_movements` (append-only) | id, doc_type, doc_id, doc_line_id, sparepart_id, location_id, qty_delta (±), balance_after, posted_at, posted_by |
| `stock_documents` | id, doc_no, type (IN, OUT, RETURN, TRANSFER, ADJUSTMENT), status, branch_id, vehicle_id?, work_order_id?, notes, created_by, created_at |
| `stock_document_lines` | id, document_id, sparepart_id, qty, uom, from_location_id?, to_location_id?, notes |

### 2.3 Opname

| Tabel | Kolom utama |
|---|---|
| `stock_counts` | id, count_no, location_id, type (PERIODIC, AD_HOC), status, opened_at, opened_by |
| `stock_count_lines` | id, count_id, sparepart_id, system_qty (snapshot), counted_qty?, diff_qty, reason_code?, reason_note? |

### 2.4 Perawatan

| Tabel | Kolom utama |
|---|---|
| `maintenance_plans` | id, vehicle_id, task_name, interval_days?, interval_km?, last_done_at?, last_done_km?, next_due_at?, next_due_km?, is_active |
| `work_orders` | id, wo_no, vehicle_id, type (PREVENTIVE, CORRECTIVE, EMERGENCY), priority, status, plan_id?, incident_id?, vendor_id?, assignee_id?, scheduled_start, scheduled_end, original_start, actual_start?, actual_end?, due_at, is_overdue, branch_id |
| `work_order_parts` | id, work_order_id, sparepart_id, qty_planned, qty_used |
| `schedule_changes` | id, work_order_id, change_type (ADVANCE, POSTPONE), old_start, new_start, delta_minutes, reason_code, reason_note, status, requested_by, requested_at |

### 2.5 Approval

| Tabel | Kolom utama |
|---|---|
| `approval_flows` | id, doc_type, name, is_active |
| `approval_flow_steps` | id, flow_id, step_no, approver_role, department?, condition (ekspresi ambang, mis. `abs(diff_qty_total) > 5`), sla_hours |
| `approval_requests` | id, doc_type, doc_id, flow_id, current_step, status (PENDING, APPROVED, REJECTED, REVISION, CANCELLED), requested_by, requested_at |
| `approval_actions` (append-only) | id, request_id, step_no, actor_id, action (APPROVE, REJECT, REQUEST_REVISION, OVERRIDE, ESCALATE), note, acted_at |

### 2.6 Emergensi

| Tabel | Kolom utama |
|---|---|
| `incidents` | id, incident_no, vehicle_id, driver_id, type, status, lat, lng, address, description, reported_at, acknowledged_at?, resolved_at?, branch_id |
| `incident_media` | id, incident_id, url |
| `incident_logs` (append-only) | id, incident_id, actor_id, action, note, created_at |
| `emergency_contacts` | id, scope (GLOBAL/BRANCH/REGION), scope_ref?, role_label, name, phone, priority, is_active |
| `emergency_playbooks` | id, incident_type, title, steps (daftar terurut), is_active |

### 2.7 Lainnya

`notifications` (id, user_id, channel, payload, status, sent_at), `audit_logs` (id, entity, entity_id, action, before, after, actor_id, at).

Penomoran dokumen: `{PREFIX}-{BRANCH}-{YYYYMM}-{seq}` dengan sequence per prefix/cabang/bulan, dibuat dalam transaksi (lock baris counter).

## 3. State Machine

### 3.1 Dokumen Stok

```
DRAFT → SUBMITTED → APPROVED → POSTED
          │  ↑          │
          │  └─REVISION─┘ (kembali ke DRAFT)
          └→ REJECTED
DRAFT/SUBMITTED → CANCELLED
```
- Hanya `POSTED` yang menulis ke `stock_movements`.
- `POSTED` immutable. Koreksi = dokumen baru bertipe pembalik yang mereferensikan dokumen asal.

### 3.2 Stock Count

```
OPEN → COUNTING → REVIEW → (approval) → APPROVED → ADJUSTED
                              └→ REJECTED → COUNTING (hitung ulang)
```

### 3.3 Work Order

```
PLANNED → SCHEDULED → IN_PROGRESS → COMPLETED
    └──────────┴────────────┴──→ CANCELLED
EMERGENCY: dibuat langsung sebagai SCHEDULED/IN_PROGRESS; approval pasca-kejadian
```
`is_overdue` = `status ∈ {PLANNED, SCHEDULED}` dan `now > due_at` (dihitung job berkala, lihat 6).

### 3.4 Incident

```
REPORTED → ACKNOWLEDGED → IN_HANDLING → RESOLVED → CLOSED
```
`ACKNOWLEDGED` dicatat saat staf pusat pertama membuka/mengonfirmasi (mengukur waktu respon). `CLOSED` oleh pusat setelah review.

## 4. Aturan Bisnis & Algoritma

### 4.1 Posting mutasi stok (atomik)

```
POST(document):
  BEGIN TRANSACTION
    ASSERT document.status == APPROVED
    for line in document.lines (urut sparepart_id, location_id → hindari deadlock):
      lock stock_balances row (sparepart, location) FOR UPDATE
      delta = per tipe:
        IN       : +qty  ke to_location
        OUT      : -qty  dari from_location
        RETURN   : +qty  ke to_location
        TRANSFER : -qty from_location, +qty to_location (dua movement)
        ADJUSTMENT: sesuai diff
      if balance.qty_on_hand + delta < 0: ABORT "stok tidak cukup"
      insert stock_movements(qty_delta=delta, balance_after=...)
      update stock_balances
    document.status = POSTED
  COMMIT
```
- Idempotent: posting ulang pada dokumen `POSTED` ditolak/diabaikan.
- **Reservasi [Asumsi]**: saat WO terjadwal membutuhkan part, `qty_reserved` ditambah; ketersediaan = `qty_on_hand − qty_reserved`. Reservasi dilepas saat mutasi keluar diposting atau WO dibatalkan.
- Peringatan stok minimum: setelah posting, jika `qty_on_hand < min_stock` → buat notifikasi ke gudang & pusat.

### 4.2 Stock opname

```
OPEN_COUNT(location):
  snapshot: untuk tiap sparepart di lokasi → system_qty = qty_on_hand saat itu
  [Asumsi] opsi freeze: blok mutasi pada lokasi selama sesi, atau terima mutasi lalu
  hitung system_qty ulang saat review (system_qty_at_review).

REVIEW:
  diff_qty = counted_qty − system_qty (gunakan system_qty saat review bila tidak freeze)
  item dengan diff_qty != 0 wajib reason_code
  approval flow dipilih berdasar total |diff| / nilai ambang

ON APPROVED:
  buat stock_document(type=ADJUSTMENT) dari semua diff ≠ 0 → POST (4.1)
  count.status = ADJUSTED
```

### 4.3 Penjadwalan preventif

Penentuan jatuh tempo per `maintenance_plan`:
```
next_due_at = last_done_at + interval_days         (jika interval_days)
next_due_km = last_done_km + interval_km           (jika interval_km)
due bila: now ≥ next_due_at  ATAU  vehicle.odometer ≥ next_due_km   ("mana yang lebih dulu")
lead time: buat WO PLANNED pada (due − lead_days) [Asumsi: default 7 hari / 500 km]
```
Setelah WO `COMPLETED`: `last_done_at/km` diperbarui ke nilai aktual, `next_due_*` dihitung ulang.

Pencegahan duplikat: satu plan hanya boleh punya satu WO aktif (non-final) — unique partial index pada (`plan_id`) untuk status non-final.

### 4.4 Deteksi bentrok jadwal

Saat membuat/mengubah jadwal WO, tolak/peringatkan jika ada WO lain (status aktif) dengan:
- `vehicle_id` sama dan rentang waktu beririsan, atau
- `assignee_id`/bay sama dan rentang beririsan.

Overlap: `a.start < b.end AND b.start < a.end`. WO EMERGENCY boleh melanggar (peringatan, bukan blokir) dan menandai WO terdampak untuk dijadwal ulang (memicu anomali, 4.5).

### 4.5 Anomali jadwal (percepatan/penundaan)

```
CHANGE_SCHEDULE(wo, new_start, reason_code, reason_note):
  VALIDATE reason_code wajib; reason_note wajib bila reason_code = OTHER
  delta = new_start − wo.scheduled_start
  type  = delta < 0 ? ADVANCE : POSTPONE
  insert schedule_changes(status=REQUESTED, old/new, delta_minutes, ...)
  buat approval_request(doc_type=SCHEDULE_CHANGE)
  ON APPROVED: wo.scheduled_start/end = baru; original_start tidak berubah;
               kirim notifikasi ke teknisi/vendor/pengemudi
  ON REJECTED: jadwal tetap
```
Eskalasi level berdasar ambang **[Asumsi]**: `|delta| ≤ 1 hari` → Supervisor; `> 1 hari` → + Kepala Departemen; `> 7 hari` atau WO sudah overdue → + Admin Pusat.

Metrik: `lateness = actual_start − original_start`; jumlah perubahan per WO; distribusi `reason_code`.

### 4.6 Approval engine

```
SUBMIT(doc):
  flow = cari approval_flow aktif untuk doc_type
  steps = flow.steps yang condition-nya benar terhadap doc (evaluasi ekspresi)
  jika steps kosong → auto-approve
  buat approval_request(current_step = step pertama), notifikasi approver

ACT(request, actor, action, note):
  VALIDATE actor memiliki approver_role/department sesuai step & cabang
  VALIDATE actor != request.requested_by         (segregation of duties)
  APPROVE → step berikutnya, atau jika terakhir: request.APPROVED + trigger handler dokumen
  REJECT  → request.REJECTED (note wajib) + dokumen REJECTED
  REQUEST_REVISION → dokumen kembali DRAFT, request.REVISION
  OVERRIDE (HQ_ADMIN) → loncat step; wajib note; action tercatat OVERRIDE
  setiap ACT → insert approval_actions (immutable)

JOB eskalasi: request PENDING melewati sla_hours → ESCALATE (notifikasi ke atasan approver / HQ)
```
Handler per `doc_type` dipanggil pada `APPROVED`: stok → POST; opname → buat ADJUSTMENT; schedule change → terapkan jadwal; WO emergensi → tandai `emergency_validated`.

### 4.7 Emergensi (di jalan)

**Pelaporan** — `POST /incidents` harus ringan: field wajib hanya `vehicle_id`, `type`; lokasi diambil otomatis dari perangkat bila diizinkan.

```
ON REPORT:
  insert incident(status=REPORTED)
  respon API langsung berisi:
     playbook = emergency_playbooks[type]
     contacts = emergency_contacts untuk cabang/wilayah kendaraan, urut priority
                 (selalu sertakan kontak GLOBAL pusat)
  notifikasi ke: Control Tower pusat + atasan langsung + supervisor cabang
                 (channel prioritas tinggi: push + WA/SMS [Asumsi])
  jika tidak ada ACK dalam T menit [Asumsi: 5] → eskalasi ke kontak berikutnya

ON PUSAT ACK: acknowledged_at = now, status = ACKNOWLEDGED
ON TINDAK LANJUT: tulis incident_logs (kirim derek, teknisi, kendaraan pengganti)
ON BUTUH PERBAIKAN: buat WO type=EMERGENCY (incident_id) — masuk antrean prioritas tertinggi
```
**Offline**: klien menyimpan laporan di antrean lokal (IndexedDB), retry dengan `Idempotency-Key` (UUID dari klien) agar tidak ganda; layar langkah cepat & kontak di-cache lokal sehingga tetap tampil tanpa sinyal; tombol *call*/SMS ke nomor pusat sebagai fallback.

**WO emergensi & approval**: WO EMERGENCY boleh dieksekusi lebih dulu; approval dilakukan pasca-kejadian (batas waktu mis. 24 jam [Asumsi]); pemakaian part untuk WO ini tetap melalui mutasi stok, dengan approval dipercepat atau auto-approve + review pasca-kejadian [Asumsi].

### 4.8 Hak akses

| Aksi | Peran |
|---|---|
| Buat mutasi/opname | WAREHOUSE, MECHANIC (mutasi OUT untuk WO miliknya) |
| Approve | sesuai `approval_flow_steps` (SUPERVISOR, DEPT_HEAD, HQ_ADMIN) |
| Atur jadwal | SUPERVISOR, HQ_ADMIN |
| Lapor emergensi | DRIVER (kendaraan yang ditugaskan), siapa pun yang login [Asumsi] |
| Tangani emergensi, kelola kontak/playbook | HQ_ADMIN |
| Master data, flow approval | SYS_ADMIN |

Data dibatasi `branch_id` kecuali peran pusat.

## 5. Kontrak API (REST, ringkas)

Konvensi: JSON, auth Bearer token, paginasi `?page&limit`, error `{code, message, details}`, header `Idempotency-Key` untuk POST kritikal (mutasi, incident).

| Modul | Endpoint | Keterangan |
|---|---|---|
| Stok | `GET /spareparts`, `GET /spareparts/{id}/stock-card` | Kartu stok + saldo berjalan |
| | `POST /stock-documents` · `GET/PATCH /stock-documents/{id}` | Buat/ubah selama DRAFT |
| | `POST /stock-documents/{id}/submit` · `/cancel` | |
| Opname | `POST /stock-counts` · `GET /stock-counts/{id}` | Buka sesi + snapshot |
| | `PUT /stock-counts/{id}/lines` | Input hitung fisik |
| | `POST /stock-counts/{id}/submit` | Masuk review/approval |
| WO | `GET /work-orders?from&to&vehicle&status&type` | Kalender/jadwal |
| | `POST /work-orders` · `PATCH /work-orders/{id}` · `POST /work-orders/{id}/start`, `/complete`, `/cancel` | |
| Jadwal | `POST /work-orders/{id}/reschedule` | Body: new_start, reason_code, reason_note |
| | `GET /schedule-changes?type&reason&branch` | Laporan anomali |
| Plan | `GET/POST/PATCH /maintenance-plans` | |
| Approval | `GET /approvals/inbox` · `GET /approvals/{id}` | |
| | `POST /approvals/{id}/approve` · `/reject` · `/request-revision` · `/override` | |
| Admin | `GET/POST/PATCH /approval-flows` | |
| Emergensi | `POST /incidents` | Respon: incident + playbook + contacts |
| | `GET /incidents?status` · `GET /incidents/{id}` | |
| | `POST /incidents/{id}/acknowledge` · `/logs` · `/status` | Sisi pusat |
| | `GET/POST/PATCH /emergency-contacts`, `/emergency-playbooks` | Kelola konten |
| Dashboard | `GET /dashboard/hq` | Stok kritis, overdue, anomali, antrean approval, insiden aktif |

Contoh `POST /incidents`:
```json
{
  "vehicle_id": 12,
  "type": "BREAKDOWN",
  "lat": -6.2, "lng": 106.8,
  "description": "Mesin mati di tol",
  "media": []
}
```
Respon `201`:
```json
{
  "incident": { "id": 301, "incident_no": "INC-JKT-202610-0007", "status": "REPORTED" },
  "playbook": { "title": "Kendaraan Mogok", "steps": ["Nyalakan hazard", "Pasang segitiga pengaman", "Keluar dari kendaraan ke area aman", "Tunggu arahan pusat"] },
  "contacts": [
    { "role_label": "Control Tower Pusat", "name": "...", "phone": "..." },
    { "role_label": "Derek terdekat", "name": "...", "phone": "..." }
  ]
}
```

## 6. Job Terjadwal

| Job | Frekuensi | Tugas |
|---|---|---|
| `generate-preventive-wo` | harian | Evaluasi plan (4.3), buat WO PLANNED |
| `mark-overdue` | tiap 15 mnt | Set `is_overdue`, notifikasi pusat |
| `approval-sla-escalation` | tiap 15 mnt | Eskalasi request melewati SLA |
| `incident-ack-escalation` | tiap 1 mnt | Eskalasi insiden tanpa ACK |
| `low-stock-alert` | harian | Ringkasan stok di bawah minimum |
| `emergency-wo-validation-reminder` | per jam | Ingatkan approval pasca-kejadian |

## 7. Validasi Utama

- Qty > 0; satuan sesuai master sparepart.
- Mutasi OUT: kendaraan atau WO wajib terisi.
- Reschedule: `new_start` ≠ jadwal lama, `reason_code` wajib.
- Reject / override / selisih opname: catatan/alasan wajib.
- Pengaju ≠ approver pada dokumen yang sama.
- Incident: `vehicle_id` dan `type` wajib; sisanya opsional agar pelaporan cepat.

## 8. Non-Fungsional (implementasi)

- **Konkurensi**: row-level lock pada `stock_balances` saat posting; urutan lock deterministik.
- **Audit**: trigger/aplikasi menulis `audit_logs`; `approval_actions`, `stock_movements`, `incident_logs` append-only.
- **Keamanan**: RBAC + filter cabang di lapisan query; validasi input; lampiran dipindai tipe/ukuran; rate limit.
- **Notifikasi**: antrean (retry + dead letter); kanal prioritas terpisah untuk emergensi.
- **Observability**: log terstruktur, metrik waktu respon insiden, kedalaman antrean approval.
- **Indeks penting**: `stock_movements(sparepart_id, location_id, posted_at)`, `work_orders(vehicle_id, scheduled_start)`, `work_orders(status, due_at)`, `approval_requests(status, current_step)`, `incidents(status, reported_at)`.

## 9. Pengujian (acceptance ringkas)

1. Mutasi OUT melebihi stok → ditolak, saldo tak berubah.
2. Dua posting bersamaan pada part yang sama → saldo konsisten, tidak negatif.
3. Dokumen `POSTED` tidak bisa diedit; koreksi lewat dokumen pembalik.
4. Opname dengan selisih tanpa alasan → tidak bisa submit; setelah approved → ADJUSTMENT terposting.
5. Reschedule tanpa alasan → ditolak; dengan alasan → anomali tercatat + approval berjenjang sesuai ambang.
6. Pengaju mencoba menyetujui dokumennya → ditolak.
7. Plan interval hari/km → WO dibuat sekali (tanpa duplikat) saat mendekati jatuh tempo.
8. Laporan emergensi → respon memuat playbook & kontak < 2 dtk; pusat menerima notifikasi; tanpa ACK → eskalasi.
9. Laporan emergensi saat offline → terkirim sekali saat online (idempotent).
10. User cabang A tidak dapat melihat data cabang B; HQ_ADMIN dapat.
