# Walkthrough BRI-5: Penyaluran Dana BRI / QLola Non-STP

## Ringkasan Eksekutif

Fase **BRI-5 — Distribution BRI / QLola Non-STP** telah diimplementasikan dan dikeraskan secara komprehensif sebagai satu paket utuh berdasarkan mandat [AGENTS.md](file:///c:/DATA/Codes/eskahade/AGENTS.md), [BRI_INTEGRATION_PRD.md](file:///c:/DATA/Codes/eskahade/docs/BRI_INTEGRATION_PRD.md), dan evaluasi peninjau (*reviewer*).

Prinsip fundamental penyaluran dana yang ditegakkan:
1. **`ALLOCATION = HAK DANA`**: Alokasi menentukan hak dana entitas penerima (Pesantren, Katering, Laundry).
2. **`DISTRIBUTION = PENGIRIMAN DANA`**: Penyaluran adalah instruksi aktual pengiriman dana dari rekening koleksi Koperasi ke rekening penerima.
3. **NON-STP WAJIB**: Penyaluran metode `BRI_QLOLA` **secara mutlak wajib Non-STP** (*Non-Straight Through Processing*). Eskahade dilarang mengeksekusi transfer *irreversible* tanpa persetujuan manusia.
   - Alur Bisnis: `Eskahade Submit (Maker)` $\to$ `PENDING_APPROVAL` (Dana RESERVED) $\to$ `Signer manusia approve di portal QLola BRI eksternal` $\to$ BRI eksekusi $\to$ Eskahade sinkronisasi hasil akhir.
4. **Maker / Signer Hard Separation**: User Eskahade bertindak sebagai Maker, tidak boleh dan tidak dapat mengemulasi Signer QLola, serta sistem dilarang menyimpan kredensial Signer maupun Soft Token QLola.
5. **Contract Gating**:
   ```
   QLOLA_H2H_CONTRACT: TBD
   QLOLA REAL SUBMISSION: DISABLED
   QLOLA REAL APPROVAL STATUS SYNC: TBD
   QLOLA REAL CANCELLATION: TBD
   QLOLA REAL EXECUTION STATUS: TBD
   DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY: NOT VERIFIED
   REMOTE MIGRATION STATE 0182/0183/0184/0185: NOT VERIFIED / UNKNOWN
   ```

---

## 1. Pemisahan Tiga Layer Arsitektur (*Three-Layer Architecture*)

Untuk menjamin kejujuran teknis dan kepatuhan audit perbankan, implementasi BRI-5 memisahkan secara tegas tiga lapisan sistem:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DOMAIN STATE MACHINE (Implemented & Production-Ready)              │
│ • State transitions: DRAFT -> PENDING_APPROVAL -> PROCESSING -> DISTRIBUTED│
│ • Hard database triggers: Overdraw guard, Over-reserve guard, Immutability  │
│ • Cancellation safety: CANCEL_PENDING preserves reservation                 │
│ • Method switch lock: Mencegah switch ke CASH/MANUAL saat reservasi aktif   │
│ • First-class provider evidence requirements for terminal transitions       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ LAYER 2: TEST PROVIDER (Simulated Test-Only Adapter)                        │
│ • Digunakan khusus dalam suite pengujian domain Non-STP                     │
│ • Mensimulasikan: ACKNOWLEDGED, TIMEOUT, REJECTED, EXECUTION_SUCCESS        │
│ • Menghasilkan bukti pengujian terisolasi (source = 'TEST_PROVIDER')       │
│ • Eksplisit bertanda SIMULATED TEST-ONLY, bukan integrasi bank langsung     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ LAYER 3: REAL QLOLA H2H (Contract TBD / Production-Disabled)               │
│ • Status: QLOLA_H2H_CONTRACT_TBD (Real submission DISABLED)                 │
│ • Pengajuan produksi tanpa adapter pengujian fail-closed seketika           │
│ • Intent outbox disimpan sebagai SUBMISSION_PENDING (lokal saja)            │
│ • Status distribusi tetap DRAFT (dilarang klaim SUBMITTED / PENDING_APPROVAL│
│   tanpa konfirmasi otoritatif dari bank)                                    │
│ • Endpoint publik transfer BRIAPI (/intrabank dan /interbank) TIDAK         │
│   digunakan karena tidak terbukti terhubung ke antrean approval QLola       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Penggunaan Skema & Migrasi Baru (`0185_bri_qlola_distribution.sql`)

### A. Penggunaan Skema Locked (Migrasi 0182)
Sistem mempertahankan skema yang telah terkunci dari Migrasi 0182:
- `finance_distributions`: Header distribusi, status machine Non-STP, constraint method.
- `finance_distribution_items`: Pemotongan alokasi per item via relasi `allocation_id`.
- `finance_distribution_recipients`: Entitas penerima first-class (`PESANTREN`, `KATERING`, `LAUNDRY`).
- `finance_recipient_accounts`: Buku rekening penerima dengan batasan maksimal 1 rekening primer aktif.
- `finance_recipient_allowed_methods`: Matriks metode penyaluran yang sah per penerima.
- Database Triggers:
  - `trg_finance_dist_items_prevent_overdraw`
  - `trg_finance_dist_status_prevent_over_reserve`
  - `trg_finance_dist_items_immutable_on_update`
  - `trg_finance_dist_items_immutable_on_delete`
  - `trg_finance_dist_enforce_qlola_insert`
  - `trg_finance_dist_enforce_qlola_transitions`
  - `trg_finance_dist_enforce_allowed_method`
  - `trg_finance_correction_items_prevent_over_correct`

### B. Penambahan pada Migrasi Baru (`0185_bri_qlola_distribution.sql`)
1. **Kolom Snapshot & Dispatch Tracking pada `finance_distributions`**:
   - `recipient_name TEXT`, `recipient_category TEXT`: Snapshot identitas penerima.
   - `destination_bank_code TEXT`, `destination_account_holder TEXT`: Snapshot perbankan.
   - `account_id TEXT REFERENCES finance_recipient_accounts(id)`: Referensi master rekening.
   - `distribution_request_id TEXT UNIQUE`: ID idempotensi pengajuan (*anti double-submit*).
   - `batch_reference TEXT`, `maker_reference TEXT`, `approval_workflow_reference TEXT`, `bank_transaction_reference TEXT`, `provider_status TEXT`: Pelacakan audit.
   - `dispatch_attempted_at TEXT`: Stempel waktu pencatatan upaya pengiriman ke jaringan penyedia.
   - `provider_request_hash TEXT`: Hash SHA-256 payload instruksi transfer.
   - `submission_outcome TEXT`: Indikator hasil pengiriman (`NOT_DISPATCHED`, `SUBMISSION_PENDING`, `SUBMITTED`, `UNKNOWN`, `FAILED`).
   - `bank_fee_amount INTEGER`, `bank_fee_bearer TEXT`, `bank_fee_reference TEXT`, `bank_fee_captured_at TEXT`: Pemisahan biaya transfer bank dari hak penerima.
   - `currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR')`: Hard guard mata uang Rupiah.
   - `rejection_reason TEXT`, `cancellation_reason TEXT`: Alasan pembatalan/penolakan resmi.
2. **Tabel Outbox Intent Transfer (`finance_qlola_transfer_intents`)**:
   - Menyimpan intent transfer outbox dengan status: `CREATED`, `SUBMISSION_PENDING`, `SUBMITTED`, `UNKNOWN`, `CONFIRMED`, `CANCELLED`, `FAILED`.
   - Dilindungi trigger `trg_finance_qlola_intents_prevent_duplicate_active` (anti-duplikasi intent aktif).
   - Dilindungi trigger `trg_finance_qlola_intents_prevent_over_reserve_insert/update` (intent `SUBMISSION_PENDING` dan `UNKNOWN` wajib memvalidasi ketersediaan alokasi).
3. **Tabel Bukti Otoritatif Penyedia (`finance_qlola_provider_evidence`) — APPEND-ONLY**:
   - Tabel first-class untuk mencatat bukti transaksi eksternal:
     - `source`: `BANK_WEBHOOK`, `BANK_STATEMENT`, `H2H_SYNC`, `MANUAL_OFFICIAL_PROOF`, `TEST_PROVIDER`.
     - `evidence_type`: `SUBMISSION_ACK`, `APPROVAL_PROGRESS`, `EXECUTION_SUCCESS`, `EXECUTION_REJECTED`, `EXECUTION_FAILED`, `CANCELLATION_CONFIRMED`.
     - `evidence_strength`: `AUTHORITATIVE_EXACT`, `MANUAL_RESOLVED`, `CANDIDATE`.
     - `operator_authorized_by`, `manual_proof_reference`, `audit_linkage`, `notes`: Audit trail lengkap.
     - `provider_state`, `provider_reference`, `observed_at`, `raw_evidence_hash`, `recorded_by`.
   - **Append-Only Guarantees**: Dilindungi trigger `trg_finance_qlola_evidence_immutable_update` dan `trg_finance_qlola_evidence_immutable_delete` yang secara mutlak melarang mutasi UPDATE atau DELETE pada bukti penyedia.
   - **Validasi Bukti Manual**: Dilindungi trigger `trg_finance_qlola_evidence_validate_manual_proof` yang mewajibkan `operator_authorized_by`, `manual_proof_reference`, dan `notes` saat `source = 'MANUAL_OFFICIAL_PROOF'`.
4. **Database Triggers Integritas Finansial & Bukti Bank**:
   - `trg_finance_dist_header_financial_fields_immutable`: Membekukan snapshot finansial setelah meninggalkan `DRAFT`, dan membekukan `DRAFT` dari modifikasi jika memiliki outbox intent aktif.
   - `trg_finance_dist_prevent_method_switch_when_reserving`: Menolak penggantian metode saat dana dalam status reservasi aktif (`PENDING_APPROVAL`, `PROCESSING`, `CANCEL_PENDING`, atau memiliki intent `SUBMISSION_PENDING`/`UNKNOWN`).
   - `trg_finance_dist_prevent_cancel_if_dispatched`: Mencegah transisi langsung ke `CANCELLED` jika pengiriman ke bank pernah dicoba (`dispatch_attempted_at IS NOT NULL` atau outcome `SUBMITTED`/`UNKNOWN`) kecuali telah ada bukti `CANCELLATION_CONFIRMED` dari bank.
   - `trg_finance_dist_require_provider_evidence`: Mewajibkan rekaman bukti penyedia berkekuatan otoritatif (`AUTHORITATIVE_EXACT` atau `MANUAL_RESOLVED`) pada `finance_qlola_provider_evidence` untuk semua transisi status:
     - `DRAFT -> PENDING_APPROVAL` wajib `SUBMISSION_ACK`
     - `PENDING_APPROVAL -> PROCESSING` wajib `APPROVAL_PROGRESS`
     - `PROCESSING -> DISTRIBUTED` wajib `EXECUTION_SUCCESS`
     - `-> FAILED` wajib `EXECUTION_FAILED`
     - `-> REJECTED` wajib bukti penolakan
   - `trg_finance_dist_bank_fee_guard`: Memvalidasi pencatatan fee bank satu kali dari NULL, membekukan perubahan setelah tercatat (baik 0 maupun >0), dan mewajibkan bukti `EXECUTION_SUCCESS`.
   - `trg_finance_qlola_evidence_prevent_collision`: Mendeteksi tabrakan nomor referensi eksekusi bank lintas distribusi (`COLLISION_CONFLICT`).

---

## 3. Pemetaan Hak Dana Entitas Penerima (*Recipient Mapping Locked*)

Sistem mengunci pemetaan alokasi pos pembayaran ke entitas penerima:

| Pos Alokasi Tagihan | Entitas Penerima | Rekening Tujuan Default | Catatan |
| :--- | :--- | :--- | :--- |
| `SPP` | `PESANTREN` | Rekening Yayasan Pesantren | Operasional Pesantren |
| `USPP` | `PESANTREN` | Rekening Yayasan Pesantren | Pengembangan Pesantren |
| `EHB` | `PESANTREN` | Rekening Yayasan Pesantren | Pelaksanaan Ujian |
| `EKSKUL` | `PESANTREN` | Rekening Yayasan Pesantren | Kegiatan Santri |
| `KESEHATAN` | `PESANTREN` | Rekening Yayasan Pesantren | Poskestren / Layanan Medis |
| `UANG_MAKAN` | `KATERING` | Rekening Vendor Katering (`master_jasa`) | Disesuaikan dengan vendor per santri |
| `UANG_NYUCI` | `LAUNDRY` | Rekening Vendor Laundry (`master_jasa`) | Disesuaikan dengan vendor per santri |
| `UANG_JAJAN` | *TIDAK DIDISTRIBUSIKAN* | Saldo Dompet Santri (`finance_wallet_ledger`) | Dana titipan santri |
| `Admin Koperasi` | *TIDAK DIDISTRIBUSIKAN* | Rekening Pendapatan Koperasi | Hak Koperasi, bukan hak penerima |

Penerima tidak pernah diambil dari *free-text*, melainkan divalidasi terhadap master `finance_distribution_recipients`.

---

## 4. Snapshot Rekening & Immutabilitas Penerima

Saat instruksi penyaluran dibuat:
1. Penerima wajib aktif (`is_active = 1`). Penerima nonaktif ditolak seketika (*fail-closed*).
2. Rekening tujuan wajib aktif (`is_active = 1`).
3. Snapshot permanen disimpan ke header `finance_distributions`:
   - `recipient_name`
   - `recipient_category`
   - `destination_bank` & `destination_bank_code`
   - `destination_account`
   - `destination_account_holder` & `account_holder_name`
   - `account_id`
   - `currency = 'IDR'`
4. **Immutabilitas Terjamin**: Perubahan rekening atau nama vendor pada master di kemudian hari **tidak akan pernah mengubah** data historis penyaluran yang telah dibuat.

---

## 5. Formula Dana Siap Salur & Guard Reservasi Basis Data

### A. Formula Dana Tersedia (*Available to Distribute*)
Formula memperhitungkan alokasi kotor, koreksi, seluruh status distribusi yang menahan reservasi, serta **active transfer intents**:
$$\text{Available} = (\text{Allocation Amount} - \sum \text{Corrections}) - \sum \text{Reserved Amount}$$

Entitas yang mereservasi dana alokasi:
1. **Status Distribusi Aktif**:
   - `PENDING_APPROVAL` (Live reservation - setelah `SUBMISSION_ACK` otoritatif diterima)
   - `PROCESSING` (Live reservation)
   - `CANCEL_PENDING` (Live reservation)
   - `DISTRIBUTED` (Committed actual delivery)
2. **Transfer Intents Aktif (`SUBMISSION_PENDING / UNKNOWN RESERVES FUNDS`)**:
   - `SUBMISSION_PENDING`: Intent siap dikirim ke bank, menahan reservasi alokasi secara preventif.
   - `UNKNOWN`: Dispatch terjadi tetapi ACK tidak diketahui / timeout; **alokasi tetap ditahan** agar tidak dapat diajukan ulang atau disalurkan lewat metode lain.
   - Alokasi yang dicakup oleh intent `SUBMISSION_PENDING` atau `UNKNOWN` pada distribusi berstatus `DRAFT` dihitung sebagai *reserved* dalam query ketersediaan dana dan dilindungi oleh database trigger `trg_finance_qlola_intents_prevent_over_reserve_insert/update`.

### B. Proteksi Konkurensi Basis Data
- `trg_finance_dist_items_prevent_overdraw`: Memblokir penambahan item distribusi jika total reservasi + penyaluran melebihi sisa alokasi efektif.
- `trg_finance_dist_status_prevent_over_reserve`: Memblokir pembaruan status distribusi ke status reserving jika ada distribusi paralel lain yang telah mengambil jatah alokasi yang sama.
- `trg_finance_qlola_intents_prevent_over_reserve_insert/update`: Memblokir pembuatan atau mutasi intent transfer jika melebihi ketersediaan alokasi.
- `trg_finance_correction_items_prevent_over_correct`: Memblokir input koreksi jika membuat reservasi bank aktif menjadi *undercollateralized*.

---

## 6. Mesin Status Penyaluran Non-STP (*State Machine*)

```
             ┌────────────────────────┐
             │         DRAFT          │ (Reserves via active intent if SUBMISSION_PENDING/UNKNOWN)
             └───────────┬────────────┘
                         │ (Wajib ada bukti SUBMISSION_ACK otoritatif)
             ┌───────────▼────────────┐
             │    PENDING_APPROVAL    │◄──────────┐
             └─────┬────────────┬─────┘           │
                   │            │                 │ (Wajib APPROVAL_PROGRESS)
     ┌─────────────▼───┐   ┌────▼───────────┐     │
     │   PROCESSING    │   │ CANCEL_PENDING ├─────┘
     └─────┬───────────┘   └────┬───────────┘
           │                    │
┌──────────▼────────────────────▼──────────────┐
│  TERMINAL: DISTRIBUTED | FAILED | REJECTED   │
│            | CANCELLED                       │
└──────────────────────────────────────────────┘
```

### Transisi yang Sah & Perilaku Reservasi:

| Dari Status | Ke Status | Makna Bisnis | Status Reservasi | Bukti Otoritatif Wajib |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | `PENDING_APPROVAL` | Maker menerima konfirmasi `SUBMISSION_ACK` dari provider | Dana **RESERVED** | `SUBMISSION_ACK` (`AUTHORITATIVE_EXACT` / `MANUAL_RESOLVED`) |
| `DRAFT` | `CANCELLED` | Petugas membatalkan draf sebelum dispatch | Dana dilepas | Tidak ada dispatch |
| `PENDING_APPROVAL` | `PROCESSING` | Signer menyetujui di QLola; transfer diproses | Dana tetap **RESERVED** | `APPROVAL_PROGRESS` |
| `PENDING_APPROVAL` | `REJECTED` | Signer menolak instruksi di portal QLola | Dana **DILEPAS** | `EXECUTION_REJECTED` / `APPROVAL_REJECTED` |
| `PENDING_APPROVAL` | `CANCEL_PENDING` | Pembatalan diajukan pasca-dispatch | Dana tetap **RESERVED** | Catatan pembatalan |
| `PENDING_APPROVAL` | `CANCELLED` | Dibatalkan sebelum dispatch jaringan | Dana **DILEPAS** | `dispatch_attempted_at IS NULL` |
| `PROCESSING` | `DISTRIBUTED` | Bank berhasil mengeksekusi transfer ke rekening | Dana **COMMITTED** (Final) | `EXECUTION_SUCCESS` |
| `PROCESSING` | `FAILED` | Bank secara otoritatif menyatakan transfer gagal | Dana **DILEPAS** | `EXECUTION_FAILED` |
| `PROCESSING` | `CANCEL_PENDING` | Pembatalan diajukan saat pemrosesan bank | Dana tetap **RESERVED** | Catatan pembatalan |
| `CANCEL_PENDING` | `CANCELLED` | Bank resmi mengonfirmasi pembatalan transfer | Dana **DILEPAS** | `CANCELLATION_CONFIRMED` |
| `CANCEL_PENDING` | `DISTRIBUTED` | Bank mengeksekusi transfer (batal gagal) | Dana **COMMITTED** (Final) | `EXECUTION_SUCCESS` |
| `CANCEL_PENDING` | `PROCESSING` | Permintaan pembatalan ditolak bank, lanjut proses | Dana tetap **RESERVED** | Status bank aktif |

**Non-STP Guard**: Transisi langsung `DRAFT -> DISTRIBUTED`, `DRAFT -> PROCESSING`, dan `PENDING_APPROVAL -> DISTRIBUTED` secara mutlak diblokir oleh trigger basis data `trg_finance_dist_enforce_qlola_transitions`.

---

## 7. Keamanan Dispatch, UNKNOWN Outcome & Pembatalan

1. **Penanganan Status UNKNOWN & Timeout (UNKNOWN != FAILED)**:
   - Jika koneksi terputus atau timeout terjadi setelah dispatch:
     - Intent outbox: `UNKNOWN`.
     - Status distribusi: tetap `DRAFT` dengan `submission_outcome = 'UNKNOWN'` (DRAFT dibekukan).
     - Dana **TETAP RESERVED** melalui reservasi aktif transfer intent.
     - `dispatch_attempted_at`: tercatat secara permanen.
     - **DILARANG KERAS**: Mengubah status ke `FAILED` atau `CANCELLED`, mengklaim `PENDING_APPROVAL` tanpa ACK, melepas reservasi dana, membuat transfer baru, atau mengalihkan ke `CASH`/`MANUAL_TRANSFER`.

2. **Arsitektur Pembatalan Pre-ACK (`PRE-ACK CANCELLATION LIVES ON TRANSFER INTENT`)**:
   - Jika distribusi masih `DRAFT`, dispatch telah dicoba, intent `UNKNOWN`, dan operator meminta pembatalan:
     - **DILARANG**: Mengubah distribusi menjadi `DRAFT -> CANCEL_PENDING` (karena provider belum mengakui transaksi, state machine distribusi terkunci: `DRAFT -> PENDING_APPROVAL | CANCELLED`).
     - **SOLUSI OTORITATIF**: Ketidakpastian pembatalan dimodelkan pada **TRANSFER INTENT** (`intent_status = 'CANCEL_PENDING'`).
     - Status distribusi tetap `DRAFT` (dibekukan).
     - Dana **TETAP RESERVED** oleh intent `CANCEL_PENDING`.
     - Jika penyedia kemudian mengonfirmasi pembatalan (`CANCELLATION_CONFIRMED` non-`TEST_PROVIDER`):
       - Intent beralih ke `CANCELLED`.
       - Distribusi beralih `DRAFT -> CANCELLED`.
       - Reservasi dana dilepas.
     - Jika penyedia justru mengirim `SUBMISSION_ACK` setelah permintaan pembatalan:
       - Intent beralih ke `SUBMITTED`.
       - Distribusi beralih `DRAFT -> PENDING_APPROVAL`.
       - Reservasi dana tetap dipertahankan utuh tanpa jeda atau *double-count*.

3. **Handoff Reservasi ACK Atomik (`ACK RESERVATION HANDOFF IS ATOMIC`)**:
   - Pemindahan reservasi dari intent (`SUBMITTED`) ke distribusi (`PENDING_APPROVAL`) dieksekusi secara atomik dalam satu batch transaksi D1.
   - Tidak ada jendela transisi di mana dana menjadi tidak tereservasi.
   - Proteksi konkurensi memastikan permintaan lain yang bersaing tidak dapat merebut alokasi (*overdraw guard*).
   - Injeksi kegagalan pada batch membatalkan kedua status secara bersih (*full rollback*).

4. **TEST_PROVIDER Bukan Bukti Otoritatif (`TEST_PROVIDER IS NEVER ELIGIBLE FINANCIAL EVIDENCE`)**:
   - Penegakan mutlak di tingkat trigger basis data (`trg_finance_dist_require_provider_evidence`, `trg_finance_dist_bank_fee_guard`, `trg_finance_dist_prevent_cancel_if_dispatched`):
     - `pe.source != 'TEST_PROVIDER'`
     - `pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')`
   - Trigger basis data secara mutlak menolak `TEST_PROVIDER` untuk mengotorisasi transisi status finansial atau pencatatan fee bank dalam kondisi apa pun (independen dari `NODE_ENV`).

5. **Identitas Otoritatif Bukti Manual (`MANUAL PROOF IDENTITY COMES FROM AUTHENTICATED SERVER SESSION`)**:
   - Operator pengesah `MANUAL_OFFICIAL_PROOF` wajib merupakan user server yang terotentikasi dan terdaftar di tabel `users`.
   - Role operator diverifikasi dari matriks kewenangan finansial (`admin`, `bendahara`).
   - Klien dilarang memalsukan identitas operator atau kekuatan bukti.
   - Field audit permanen: `operator_authorized_by`, `operator_role_snapshot`, `manual_proof_reference`, `notes`, `resolved_at`.

6. **Idempotensi & Anti-Duplikasi Intent**:
   - Pengajuan ulang (*second submit*) pada distribusi dengan intent `UNKNOWN`, `SUBMISSION_PENDING`, atau `CANCEL_PENDING` mengembalikan rekaman existing tanpa membuat intent baru atau mengirim transfer ganda.

7. **Larangan Pergantian Metode**:
   - Trigger `trg_finance_dist_prevent_method_switch_when_reserving` memblokir mutasi kolom `method` saat status masih menahan reservasi atau memiliki intent aktif (`SUBMISSION_PENDING`, `UNKNOWN`, `CANCEL_PENDING`).

---

## 8. Pencatatan Biaya Bank (*Bank Fee Capture*)

- Biaya bank (`bank_fee_amount`, `bank_fee_bearer`, `bank_fee_reference`, `bank_fee_captured_at`) dicatat terpisah dan **tidak memotong hak alokasi penerima**.
- Nilai `bank_fee_amount = NULL` menandakan fee belum dicatat. Nilai `bank_fee_amount >= 0` (termasuk 0) menandakan fee telah dicatat secara otoritatif.
- Trigger `trg_finance_dist_bank_fee_guard` menegakkan:
  1. Pengisian hanya boleh dari NULL (satu kali pencatatan).
  2. Wajib didasari bukti eksekusi bank `EXECUTION_SUCCESS` otoritatif non-`TEST_PROVIDER`.
  3. Setelah terisi, nominal fee bank bersifat **immutable** (tidak dapat diubah, baik bernilai 0 maupun > 0).

---

## 9. Penilaian API Transfer BRI & Matriks Kontrak QLola

### A. Penilaian Dokumentasi Resmi BRIAPI
Dokumentasi resmi BRIAPI SNAP BI menetapkan path transfer:
- Intrabank v1.0: `/intrabank/snap/v1.0/transfer-intrabank`
- Intrabank v2.0: `/intrabank/snap/v2.0/transfer-intrabank`
- Interbank v1.0: `/interbank/snap/v1.0/transfer-interbank`
- Interbank v2.0: `/interbank/snap/v2.0/transfer-interbank`

Wording Akurasi Kontrak:
> "Public BRIAPI menyediakan endpoint eksekusi transfer dana intrabank dan interbank (baik versi v1.0 maupun v2.0). Dalam dokumentasi publik yang tersedia, tidak ditemukan mekanisme yang menyatakan request endpoint tersebut otomatis masuk ke QLola Maker/Checker/Signer approval queue. Oleh karena itu direct BRIAPI transfer dinonaktifkan untuk metode BRI_QLOLA sampai PIC BRI mengonfirmasi kompatibilitas antrean persetujuan QLola."

```typescript
export const DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY = 'NOT_VERIFIED' as const
export const BRIAPI_TRANSFER_QLOLA_QUEUE_STATE = 'CONTRACT_TBD' as const
export const QLOLA_H2H_CONTRACT_STATE = 'QLOLA_H2H_CONTRACT_TBD' as const
export const QLOLA_REAL_SUBMISSION = 'DISABLED' as const
export const QLOLA_REAL_APPROVAL_STATUS_SYNC = 'NOT_IMPLEMENTED / CONTRACT_TBD' as const
export const QLOLA_REAL_CANCELLATION = 'CONTRACT_TBD' as const
export const QLOLA_REAL_EXECUTION_STATUS = 'CONTRACT_TBD' as const
```

---

## 10. Hasil Pengujian Lengkap (`test-bri-distribution.cjs`)

Seluruh skenario pengujian unit, integrasi, dan 14 skenario regresi peninjau lolos 100%:

```
=================================================================
BRI-5: RUNNING HARDENED QLOLA NON-STP DISTRIBUTION TEST SUITE
=================================================================

--- 1. Testing Recipient Master, Allowed Methods & Account Snapshot ---
✓ 1.1: Inactive recipient blocked fail-closed.
✓ 1.2: Item type category to recipient category validation enforced.
✓ 1.3: Recipient snapshot and primary account captured immutably.
✓ 1.4: Changing master account holder leaves historical snapshot untouched.

--- 2. Testing Available-to-Distribute & Reservation Engine ---
✓ 2.1 & 2.2: Partial reservation and remaining availability formula verified.
✓ 2.3: Over-distribution blocked when amount exceeds available.
✓ 2.4: Concurrency race prevented by database trigger trg_finance_dist_status_prevent_over_reserve.
✓ 2.5: Correction reduces effective allocation availability.
✓ 2.6: Over-correction rejected by trigger trg_finance_correction_items_prevent_over_correct.

--- 3. Testing Non-STP State Machine & Transition Guards ---
✓ 3.2: Direct DRAFT -> DISTRIBUTED blocked by Non-STP trigger.
✓ 3.3: Direct DRAFT -> PROCESSING blocked by Non-STP trigger.
✓ 3.4: PENDING_APPROVAL -> DISTRIBUTED blocked without intermediate bank processing.
✓ 3.5: Signer approval synced to PROCESSING.
✓ 3.6: Bank execution completed to DISTRIBUTED with bank transaction reference.
✓ 3.7: Terminal status immutability verified.

--- 4. Testing Submission Idempotency & Outbox Transfer Intent ---
✓ 4.1: Outbox intent created with SUBMITTED status and Maker reference.
✓ 4.2: Duplicate submission returns identical result without re-reserving.
✓ 4.3: Unique index uq_finance_distributions_req_id verified.

--- 5. Testing Cancellation Safety & Provider Switch Guards ---
✓ 5.1: Cancel while DRAFT transitions directly to CANCELLED and releases reservation.
✓ 5.2: Cancel while PENDING_APPROVAL before submission releases reservation.
✓ 5.3: Cancel without bank confirmation enters CANCEL_PENDING and safely preserves reservation.
✓ 5.4: Switching method to CASH/MANUAL while in CANCEL_PENDING strictly blocked.
✓ 5.5: Official bank cancellation and rejection releases reservation cleanly.

--- 6. Testing Post-Distribution Correction & Recovery ---
✓ 6.1: Correction on distributed allocation queues PENDING_RECOVERY without historical mutation.

--- 7. Testing Role Authorization & Maker/Signer Separation ---
✓ 7.1-7.4: Role authorization matrix and Maker/Signer separation verified.

--- 8. Testing Money, Bank Fee & Account Masking ---
✓ 8.1: Zero and negative amounts rejected fail-closed.
✓ 8.2: Currency hard-bound to IDR.
✓ 8.3: Beneficiary account masking verified for audit logging.

--- 9. Testing Contract Isolation & Provider Seams ---
✓ 9.1: Contract isolation declarations and account inquiry seam verified.

--- 10. Running BRI-5 Reviewer Hardening Suite (14 Tests + Regressions) ---
✓ Test 1: SUBMISSION_PENDING reserves allocation.
✓ Test 2: UNKNOWN reserves allocation.
✓ Test 3: competing distribution blocked while intent reserves.
✓ Test 4: provider ACK transfers reservation without double-count.
✓ Test 5: DRAFT with active intent cannot edit item/recipient/method.
✓ Reviewer Test 1: UNKNOWN pre-ACK cancel does NOT perform DRAFT -> CANCEL_PENDING (returns DRAFT, intent CANCEL_PENDING).
✓ Reviewer Test 2: UNKNOWN -> intent CANCEL_PENDING preserves reservation.
✓ Reviewer Test 3: Provider later confirms cancellation -> DRAFT -> CANCELLED.
✓ Reviewer Test 4: Provider later sends SUBMISSION_ACK after cancel request -> distribution PENDING_APPROVAL, intent SUBMITTED, reservation preserved.
✓ Reviewer Test 5: ACK handoff intent reservation -> distribution reservation is atomic in one batch.
✓ Reviewer Test 6: Concurrent competing reserve during ACK cannot overdraw (competing 500k against 700k reserved from 1M fails).
✓ Reviewer Test 7: Injected failure during ACK handoff rolls back both states.
✓ Reviewer Test 8: DRAFT -> PENDING_APPROVAL without eligible SUBMISSION_ACK blocked DB.
✓ Reviewer Test 9: PENDING_APPROVAL -> PROCESSING without eligible APPROVAL_PROGRESS blocked DB.
✓ Reviewer Test 10: TEST_PROVIDER evidence cannot authorize PENDING_APPROVAL (DB trigger rejects).
✓ Reviewer Test 11: TEST_PROVIDER evidence cannot authorize DISTRIBUTED (DB trigger rejects).
✓ Reviewer Test 12: Authenticated manual proof resolution with verified DB operator and role snapshot.
✓ Reviewer Test 13: Spoofed operator identity / unauthorized role rejected fail-closed.
✓ Reviewer Test 14: Fee capture requires eligible real/manual-authoritative execution evidence (TEST_PROVIDER rejected).
✓ Regression: cancel before dispatch releases intent reservation.
✓ Regression: dispatch attempted + no ACK does NOT release reservation.
✓ Regression: timeout does not create PENDING_APPROVAL without ACK.
✓ Regression: second submit UNKNOWN creates zero new intent/network business identity.
✓ Regression: provider evidence UPDATE and DELETE blocked (append-only).
✓ Regression: candidate bank-statement evidence cannot mark DISTRIBUTED.

=================================================================
SUCCESS: ALL BRI-5 QLOLA NON-STP DISTRIBUTION TESTS PASSED!
=================================================================
```

---

## 11. Hasil Pengujian Migrasi 0185 (`test-migration-0185.cjs`)

```
--- Running Migration 0185 Invariant Tests ---
✓ 1. Snapshot and tracking columns persisted successfully.
✓ 2. Unique index uq_finance_distributions_req_id blocks duplicate request ID.
✓ 3. Table finance_qlola_transfer_intents stores outbox records with valid state machine & anti-duplication.
✓ 4. Extended immutability trigger blocks tampering with recipient snapshots and bank codes after submission.
✓ 5. Trigger trg_finance_dist_prevent_method_switch_when_reserving blocks switching to CASH/MANUAL while in PENDING_APPROVAL.
✓ 6. Method switch protection verified across all live reserving states (PENDING_APPROVAL, PROCESSING, CANCEL_PENDING).
✓ 7. Trigger trg_finance_dist_prevent_cancel_if_dispatched blocks direct CANCELLED after dispatch attempt.
✓ 8. Trigger trg_finance_dist_require_provider_evidence enforces authoritative bank evidence.
✓ 9. Trigger trg_finance_qlola_evidence_prevent_collision blocks execution reference collision across distributions.
✓ 10. Trigger trg_finance_qlola_evidence_immutable enforces append-only provider evidence.
✓ 11. Bank fee guard allows NULL -> 0 once with evidence, and strictly blocks subsequent modification.

======================================================
SUCCESS: ALL MIGRATION 0185 TESTS PASSED!
======================================================
```

---

## 12. Hasil Verifikasi Regresi Komprehensif

| Test Suite / Verifikasi | Target | Hasil |
| :--- | :--- | :--- |
| `scripts/test-migration-0185.cjs` | 11 Invariant Database Penyaluran Non-STP, Triggers, & Evidence | **PASSED (11/11)** |
| `scripts/test-bri-distribution.cjs` | Seluruh Skenario Penyaluran QLola Non-STP & 20 Hardening Tests | **PASSED (100%)** |
| `scripts/test-bri-settlement.cjs` | Baseline BRI-4 (Recovery, Settlement & Reconciliation) | **PASSED (23/23)** |
| `scripts/test-migration-0184.cjs` | Baseline Migrasi 0184 | **PASSED (14/14)** |
| `scripts/test-bri-collection.cjs` | Baseline BRI-3 (BRIVA Collection) | **PASSED** |
| `scripts/test-migration-0183.cjs` | Baseline Migrasi 0183 | **PASSED** |
| `scripts/test-bri-core.cjs` | Baseline BRI-2 (Core Adapter & Crypto) | **PASSED** |
| `scripts/test-migration-0182.cjs` | Baseline Migrasi 0182 (33 Invariants + Regression) | **PASSED (33/33)** |
| `node ./node_modules/typescript/bin/tsc --noEmit` | TypeScript Strict Typecheck | **PASSED (0 errors)** |
| `cmd /c "npm run build"` | Next.js Production Turbopack Build | **PASSED (Exit code 0)** |
| `git diff --check` | Formatting & Whitespace Audit | **PASSED (Clean)** |

---

## 13. Deklarasi Status Formal

```
REMOTE MIGRATION STATE 0182/0183/0184/0185: NOT VERIFIED / UNKNOWN
QLOLA_H2H_CONTRACT: TBD
QLOLA REAL SUBMISSION: DISABLED
QLOLA REAL APPROVAL STATUS SYNC: TBD
QLOLA REAL CANCELLATION: TBD
QLOLA REAL EXECUTION STATUS: TBD
DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY: NOT VERIFIED
BRIAPI_TRANSFER -> QLOLA_APPROVAL_QUEUE: NOT VERIFIED
QLOLA SANDBOX/UAT: NOT VERIFIED
```

---

## 14. Gerbang Penyelesaian (*Completion Gate*)

Sesuai instruksi dan aturan tata kelola:
- Tidak ada migrasi remote yang dieksekusi.
- Modul BRI-6 (Cash & Manual Distribution Hardening) **TIDAK** dimulai.
- Seluruh pekerjaan fase BRI-5 telah selesai sebagai satu paket dan berhenti di sini menunggu evaluasi peninjau.

```
BRI-6 READINESS: READY
```
Menunggu konfirmasi resmi:
> `BRI-5 LOCKED`
