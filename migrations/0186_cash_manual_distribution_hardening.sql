-- ============================================================================
-- MIGRATION 0186: CASH & MANUAL DISTRIBUTION HARDENING
-- Memperkuat integritas metode penyaluran CASH dan MANUAL_TRANSFER (Fase BRI-6):
-- 1. Snapshot kas & akun sumber pada finance_distributions
-- 2. Model Bukti Distribusi Kas & Manual (finance_cash_manual_evidence) - Append-Only & Provenance
-- 3. Database triggers untuk state machine CASH & MANUAL_TRANSFER
-- 4. Proteksi overdraw & reservasi lintas-metode (Cross-Method Invariant)
-- 5. Validasi sesi kas loket & rekening tujuan aktif
-- ============================================================================

-- 1. Tambah kolom kas dan akun sumber pada finance_distributions
ALTER TABLE finance_distributions ADD COLUMN cash_session_id TEXT REFERENCES finance_cash_sessions(id);
ALTER TABLE finance_distributions ADD COLUMN cash_prepared_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN cash_handed_over_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN cash_receiver_name TEXT;
ALTER TABLE finance_distributions ADD COLUMN cash_returned_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN cash_return_reason TEXT;
ALTER TABLE finance_distributions ADD COLUMN source_account_id TEXT REFERENCES finance_recipient_accounts(id);
ALTER TABLE finance_distributions ADD COLUMN source_account_number TEXT;
ALTER TABLE finance_distributions ADD COLUMN source_bank_code TEXT;
ALTER TABLE finance_distributions ADD COLUMN source_account_holder TEXT;
ALTER TABLE finance_distributions ADD COLUMN manual_transfer_initiated_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN manual_transfer_executed_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN manual_transfer_proof_ref TEXT;
ALTER TABLE finance_distributions ADD COLUMN statement_transaction_id TEXT REFERENCES finance_bri_statement_transactions(id);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_cash_session
    ON finance_distributions(cash_session_id)
    WHERE cash_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_distributions_source_acc
    ON finance_distributions(source_account_id)
    WHERE source_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_distributions_stmt_tx
    ON finance_distributions(statement_transaction_id)
    WHERE statement_transaction_id IS NOT NULL AND status = 'DISTRIBUTED';

-- 1b. Kolom semantik investigasi & rekonsiliasi transfer manual pada finance_reconciliation_items
ALTER TABLE finance_reconciliation_items ADD COLUMN reason_code TEXT;
ALTER TABLE finance_reconciliation_items ADD COLUMN investigation_resolution TEXT;

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_investigation
    ON finance_reconciliation_items(investigation_resolution)
    WHERE investigation_resolution IS NOT NULL;

-- 2. Tabel Bukti Distribusi Kas & Manual (Append-Only Evidence)
CREATE TABLE IF NOT EXISTS finance_cash_manual_evidence (
    id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL REFERENCES finance_distributions(id),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'CASH_PREPARED',
        'CASH_HANDOVER_RECEIPT',
        'CASH_RETURNED',
        'MANUAL_TRANSFER_INITIATED',
        'MANUAL_TRANSFER_SUCCESS',
        'MANUAL_TRANSFER_FAILED',
        'MANUAL_TRANSFER_UNKNOWN',
        'BANK_STATEMENT_DEBIT',
        'MANUAL_OFFICIAL_PROOF'
    )),
    evidence_strength TEXT NOT NULL DEFAULT 'AUTHORITATIVE_EXACT' CHECK (evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED', 'CANDIDATE')),
    source TEXT NOT NULL CHECK (source IN ('CASH_DESK', 'PHYSICAL_RECEIPT', 'BANK_RECEIPT', 'BANK_STATEMENT', 'MANUAL_OFFICIAL_PROOF', 'AUDIT_RECORD')),
    reference_number TEXT,
    raw_evidence_hash TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    operator_id TEXT NOT NULL REFERENCES users(id),
    operator_role_snapshot TEXT NOT NULL,
    receiving_person_name TEXT,
    notes TEXT,
    attachment_url TEXT,
    attachment_hash TEXT,
    attachment_mime TEXT,
    attachment_size INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_cash_manual_evidence_dist
    ON finance_cash_manual_evidence(distribution_id);

CREATE INDEX IF NOT EXISTS idx_finance_cash_manual_evidence_ref
    ON finance_cash_manual_evidence(reference_number)
    WHERE reference_number IS NOT NULL;

-- 3. Triggers Append-Only & Audit Integrity pada finance_cash_manual_evidence
CREATE TRIGGER IF NOT EXISTS trg_finance_cash_manual_evidence_immutable_update
BEFORE UPDATE ON finance_cash_manual_evidence
BEGIN
    SELECT RAISE(ABORT, 'Tabel finance_cash_manual_evidence bersifat append-only. UPDATE dilarang.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_cash_manual_evidence_immutable_delete
BEFORE DELETE ON finance_cash_manual_evidence
BEGIN
    SELECT RAISE(ABORT, 'Tabel finance_cash_manual_evidence bersifat append-only. DELETE dilarang.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_cash_manual_evidence_validate_operator
BEFORE INSERT ON finance_cash_manual_evidence
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.operator_id)
        THEN RAISE(ABORT, 'operator_id tidak valid: Pengguna tidak terdaftar dalam tabel users.')
        WHEN NEW.source = 'MANUAL_OFFICIAL_PROOF' AND LOWER(NEW.operator_role_snapshot) NOT IN ('admin', 'bendahara')
        THEN RAISE(ABORT, 'Hanya role admin atau bendahara yang berwenang mengesahkan bukti penyaluran manual (MANUAL_OFFICIAL_PROOF).')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_cash_manual_evidence_prevent_collision
BEFORE INSERT ON finance_cash_manual_evidence
FOR EACH ROW
WHEN NEW.reference_number IS NOT NULL AND NEW.evidence_type IN ('MANUAL_TRANSFER_SUCCESS', 'CASH_HANDOVER_RECEIPT', 'BANK_STATEMENT_DEBIT')
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM finance_cash_manual_evidence other
            WHERE other.reference_number = NEW.reference_number
              AND other.evidence_type = NEW.evidence_type
              AND other.distribution_id != NEW.distribution_id
        )
        THEN RAISE(ABORT, 'COLLISION_CONFLICT: Nomor referensi bukti penyaluran telah digunakan untuk distribusi lain.')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_dist_prevent_double_stmt_consumption
BEFORE UPDATE OF status, statement_transaction_id ON finance_distributions
FOR EACH ROW
WHEN NEW.status = 'DISTRIBUTED' AND NEW.statement_transaction_id IS NOT NULL
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM finance_distributions other
            WHERE other.statement_transaction_id = NEW.statement_transaction_id
              AND other.status = 'DISTRIBUTED'
              AND other.id != NEW.id
        )
        THEN RAISE(ABORT, 'STMT_TRANSACTION_ALREADY_CONSUMED: Mutasi bank ini telah digunakan untuk menyelesaikan penyaluran lain.')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_dist_insert_prevent_double_stmt_consumption
BEFORE INSERT ON finance_distributions
FOR EACH ROW
WHEN NEW.status = 'DISTRIBUTED' AND NEW.statement_transaction_id IS NOT NULL
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM finance_distributions other
            WHERE other.statement_transaction_id = NEW.statement_transaction_id
              AND other.status = 'DISTRIBUTED'
        )
        THEN RAISE(ABORT, 'STMT_TRANSACTION_ALREADY_CONSUMED: Mutasi bank ini telah digunakan untuk menyelesaikan penyaluran lain.')
    END;
END;

-- 4. Validasi Penerima & Rekening Tujuan Aktif saat Pembuatan Distribusi
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_check_recipient_and_account_active
BEFORE INSERT ON finance_distributions
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.recipient_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM finance_distribution_recipients r
            WHERE r.id = NEW.recipient_id AND r.is_active = 0
        )
        THEN RAISE(ABORT, 'Penerima tidak aktif. Pembuatan distribusi baru diblokir.')

        WHEN NEW.account_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM finance_recipient_accounts a
            WHERE a.id = NEW.account_id AND a.is_active = 0
        )
        THEN RAISE(ABORT, 'Rekening penerima tidak aktif. Pembuatan distribusi baru diblokir.')

        WHEN NEW.method = 'MANUAL_TRANSFER' AND NEW.account_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM finance_recipient_accounts a
            WHERE a.id = NEW.account_id AND a.recipient_id = NEW.recipient_id
        )
        THEN RAISE(ABORT, 'Rekening tujuan tidak cocok dengan penerima distribusi.')
    END;
END;

-- 5. Validasi Sesi Kas Fisik Aktif & Likuiditas Kas Laci pada Penyaluran Tunai (CASH)
-- Invariant Finansial Kritis:
-- - Sesi kas fisik wajib OPEN
-- - Saat DRAFT -> PROCESSING: Uang kas fisik laci (expected_closing_balance) dikurangi seluruh
--   penyaluran kas fisik lain yang sedang berstatus PROCESSING pada sesi ini (live reservations)
--   wajib mencukupi (NEW.total_amount + SUM(other PROCESSING) <= cs.expected_closing_balance).
DROP TRIGGER IF EXISTS trg_finance_dist_enforce_cash_session_balance;
CREATE TRIGGER trg_finance_dist_enforce_cash_session_balance
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'CASH' AND NEW.status IN ('PROCESSING', 'DISTRIBUTED') AND NEW.cash_session_id IS NOT NULL
BEGIN
    SELECT CASE
        -- A. Validasi sesi kas berstatus OPEN
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_cash_sessions cs
            WHERE cs.id = NEW.cash_session_id AND cs.status = 'OPEN'
        )
        THEN RAISE(ABORT, 'Sesi kas fisik tidak ditemukan atau berstatus ditutup (CLOSED). Penyaluran kas wajib terhubung ke sesi kas aktif.')

        -- B. Validasi likuiditas fisik laci saat persiapan kas (status = PROCESSING):
        -- Menjamin akumulasi kas fisik yang sedang dipesan (PROCESSING) tidak melampaui kas fisik tersedia di laci loket
        WHEN NEW.status = 'PROCESSING' AND EXISTS (
            SELECT 1 FROM finance_cash_sessions cs
            WHERE cs.id = NEW.cash_session_id
              AND (
                  NEW.total_amount + (
                      SELECT COALESCE(SUM(other.total_amount), 0)
                      FROM finance_distributions other
                      WHERE other.cash_session_id = NEW.cash_session_id
                        AND other.method = 'CASH'
                        AND other.status = 'PROCESSING'
                        AND other.id != NEW.id
                  )
              ) > cs.expected_closing_balance
        )
        THEN RAISE(ABORT, 'Saldo kas fisik pada sesi loket tidak mencukupi untuk menyiapkan penyaluran tunai (melebihi saldo tersedia setelah memperhitungkan reservasi kas aktif).')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_dist_enforce_cash_session_balance_insert
BEFORE INSERT ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'CASH' AND NEW.status = 'PROCESSING' AND NEW.cash_session_id IS NOT NULL
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM finance_cash_sessions cs
            WHERE cs.id = NEW.cash_session_id AND cs.status = 'OPEN'
        )
        THEN RAISE(ABORT, 'Sesi kas fisik tidak ditemukan atau berstatus ditutup (CLOSED). Penyaluran kas wajib terhubung ke sesi kas aktif.')

        WHEN EXISTS (
            SELECT 1 FROM finance_cash_sessions cs
            WHERE cs.id = NEW.cash_session_id
              AND (
                  NEW.total_amount + (
                      SELECT COALESCE(SUM(other.total_amount), 0)
                      FROM finance_distributions other
                      WHERE other.cash_session_id = NEW.cash_session_id
                        AND other.method = 'CASH'
                        AND other.status = 'PROCESSING'
                  )
              ) > cs.expected_closing_balance
        )
        THEN RAISE(ABORT, 'Saldo kas fisik pada sesi loket tidak mencukupi untuk menyiapkan penyaluran tunai (melebihi saldo tersedia setelah memperhitungkan reservasi kas aktif).')
    END;
END;

-- 5B. Larangan Menutup Sesi Kas dengan Outstanding Cash Reservation
CREATE TRIGGER IF NOT EXISTS trg_finance_cash_session_prevent_close_with_live_reservations
BEFORE UPDATE OF status ON finance_cash_sessions
FOR EACH ROW
WHEN OLD.status = 'OPEN' AND NEW.status = 'CLOSED'
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM finance_distributions d
            WHERE d.cash_session_id = OLD.id
              AND d.method = 'CASH'
              AND d.status = 'PROCESSING'
        )
        THEN RAISE(ABORT, 'Sesi kas tidak dapat ditutup karena masih terdapat penyaluran kas fisik berstatus PROCESSING yang telah disiapkan (uang fisik masih di luar laci). Selesaikan serah terima (DISTRIBUTED) atau batalkan dengan pengembalian kas (CASH_RETURNED) terlebih dahulu.')
    END;
END;

-- 6. Trigger Rekonstruksi: Bukti & Transisi Status untuk Seluruh Metode (BRI_QLOLA, CASH, MANUAL_TRANSFER)
DROP TRIGGER IF EXISTS trg_finance_dist_require_provider_evidence;
CREATE TRIGGER trg_finance_dist_require_evidence
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    -- 6A. BRI_QLOLA (Mempertahankan Invariant 0185)
    SELECT CASE
        WHEN NEW.method = 'BRI_QLOLA' AND OLD.status = 'DRAFT' AND NEW.status = 'PENDING_APPROVAL'
         AND NOT EXISTS (
             SELECT 1 FROM finance_qlola_provider_evidence pe
             WHERE pe.distribution_id = NEW.id
               AND pe.evidence_type = 'SUBMISSION_ACK'
               AND pe.source != 'TEST_PROVIDER'
               AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif (non-TEST_PROVIDER).')

        WHEN NEW.method = 'BRI_QLOLA' AND OLD.status = 'PENDING_APPROVAL' AND NEW.status = 'PROCESSING'
         AND NOT EXISTS (
             SELECT 1 FROM finance_qlola_provider_evidence pe
             WHERE pe.distribution_id = NEW.id
               AND pe.evidence_type = 'APPROVAL_PROGRESS'
               AND pe.source != 'TEST_PROVIDER'
               AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan PENDING_APPROVAL ke PROCESSING wajib memiliki bukti APPROVAL_PROGRESS otoritatif (non-TEST_PROVIDER).')

        WHEN NEW.method = 'BRI_QLOLA' AND NEW.status = 'DISTRIBUTED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_qlola_provider_evidence pe
             WHERE pe.distribution_id = NEW.id
               AND pe.evidence_type = 'EXECUTION_SUCCESS'
               AND pe.source != 'TEST_PROVIDER'
               AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif (non-TEST_PROVIDER).')

        WHEN NEW.method = 'BRI_QLOLA' AND NEW.status = 'FAILED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_qlola_provider_evidence pe
             WHERE pe.distribution_id = NEW.id
               AND pe.evidence_type = 'EXECUTION_FAILED'
               AND pe.source != 'TEST_PROVIDER'
               AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke FAILED wajib memiliki bukti EXECUTION_FAILED otoritatif (non-TEST_PROVIDER).')

        WHEN NEW.method = 'BRI_QLOLA' AND NEW.status = 'REJECTED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_qlola_provider_evidence pe
             WHERE pe.distribution_id = NEW.id
               AND pe.evidence_type IN ('EXECUTION_REJECTED', 'APPROVAL_REJECTED')
               AND pe.source != 'TEST_PROVIDER'
               AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke REJECTED wajib memiliki bukti penolakan otoritatif (non-TEST_PROVIDER).')
    END;

    -- 6B. CASH
    SELECT CASE
        WHEN NEW.method = 'CASH' AND OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PROCESSING', 'CANCELLED')
        THEN RAISE(ABORT, 'Penyaluran CASH dari DRAFT hanya boleh beralih ke PROCESSING (persiapan kas) atau dibatalkan ke CANCELLED.')

        WHEN NEW.method = 'CASH' AND OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'CANCELLED')
        THEN RAISE(ABORT, 'Penyaluran CASH dari PROCESSING hanya boleh beralih ke DISTRIBUTED (serah terima) atau CANCELLED.')

        WHEN NEW.method = 'CASH' AND OLD.status = 'DISTRIBUTED'
        THEN RAISE(ABORT, 'Distribusi tunai yang telah DISTRIBUTED bersifat final dan tidak dapat diubah statusnya.')

        WHEN NEW.method = 'CASH' AND NEW.status = 'DISTRIBUTED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_cash_manual_evidence ce
             WHERE ce.distribution_id = NEW.id
               AND ce.evidence_type = 'CASH_HANDOVER_RECEIPT'
               AND ce.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke DISTRIBUTED untuk CASH wajib memiliki bukti serah terima kas fisik otoritatif (CASH_HANDOVER_RECEIPT).')
    END;

    -- 6C. MANUAL_TRANSFER
    SELECT CASE
        WHEN NEW.method = 'MANUAL_TRANSFER' AND OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PROCESSING', 'CANCELLED')
        THEN RAISE(ABORT, 'Penyaluran MANUAL_TRANSFER dari DRAFT hanya boleh beralih ke PROCESSING (inisiasi transfer) atau dibatalkan ke CANCELLED.')

        WHEN NEW.method = 'MANUAL_TRANSFER' AND OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'FAILED')
        THEN RAISE(ABORT, 'Penyaluran MANUAL_TRANSFER dari PROCESSING hanya boleh beralih ke DISTRIBUTED (sukses) atau FAILED (gagal).')

        WHEN NEW.method = 'MANUAL_TRANSFER' AND OLD.status = 'DISTRIBUTED'
        THEN RAISE(ABORT, 'Distribusi transfer manual yang telah DISTRIBUTED bersifat final dan tidak dapat diubah statusnya.')

        WHEN NEW.method = 'MANUAL_TRANSFER' AND NEW.status = 'DISTRIBUTED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_cash_manual_evidence ce
             WHERE ce.distribution_id = NEW.id
               AND ce.evidence_type IN ('MANUAL_TRANSFER_SUCCESS', 'BANK_STATEMENT_DEBIT', 'MANUAL_OFFICIAL_PROOF')
               AND ce.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke DISTRIBUTED untuk MANUAL_TRANSFER wajib memiliki bukti transfer bank sukses otoritatif.')

        WHEN NEW.method = 'MANUAL_TRANSFER' AND NEW.status = 'FAILED'
         AND NOT EXISTS (
             SELECT 1 FROM finance_cash_manual_evidence ce
             WHERE ce.distribution_id = NEW.id
               AND ce.evidence_type = 'MANUAL_TRANSFER_FAILED'
               AND ce.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
         )
        THEN RAISE(ABORT, 'Peralihan status ke FAILED untuk MANUAL_TRANSFER wajib memiliki bukti kegagalan bank resmi (MANUAL_TRANSFER_FAILED).')
    END;
END;

-- 7. Trigger Rekonstruksi: Pembatalan Aman Lintas Metode
DROP TRIGGER IF EXISTS trg_finance_dist_prevent_cancel_if_dispatched;
CREATE TRIGGER trg_finance_dist_prevent_cancel_if_dispatched
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.status = 'CANCELLED'
BEGIN
    -- 7A. BRI_QLOLA
    SELECT CASE
        WHEN OLD.method = 'BRI_QLOLA' AND (
            OLD.dispatch_attempted_at IS NOT NULL
            OR OLD.submission_outcome IN ('SUBMITTED', 'UNKNOWN')
            OR OLD.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING')
            OR EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = OLD.id
                  AND ti.intent_status IN ('SUBMITTED', 'UNKNOWN', 'CANCEL_PENDING')
            )
        ) AND NOT EXISTS (
            SELECT 1 FROM finance_qlola_provider_evidence pe
            WHERE pe.distribution_id = OLD.id
              AND pe.evidence_type = 'CANCELLATION_CONFIRMED'
              AND pe.source != 'TEST_PROVIDER'
              AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
        )
        THEN RAISE(ABORT, 'Pembatalan dilarang: Pengiriman ke bank telah dicoba atau diakui tanpa bukti konfirmasi pembatalan otoritatif (CANCELLATION_CONFIRMED non-TEST_PROVIDER).')
    END;

    -- 7B. CASH
    SELECT CASE
        WHEN OLD.method = 'CASH' AND OLD.status = 'DISTRIBUTED'
        THEN RAISE(ABORT, 'Pembatalan dilarang: Penyaluran tunai telah diserahkan (DISTRIBUTED). Gunakan alur pemulihan / koreksi.')

        WHEN OLD.method = 'CASH' AND OLD.status = 'PROCESSING' AND EXISTS (
            SELECT 1 FROM finance_cash_manual_evidence ce
            WHERE ce.distribution_id = OLD.id
              AND ce.evidence_type = 'CASH_HANDOVER_RECEIPT'
        )
        THEN RAISE(ABORT, 'Pembatalan dilarang: Kas telah diserahkan dengan tanda terima fisik.')

        WHEN OLD.method = 'CASH' AND OLD.status = 'PROCESSING' AND NOT EXISTS (
            SELECT 1 FROM finance_cash_manual_evidence ce
            WHERE ce.distribution_id = OLD.id
              AND ce.evidence_type = 'CASH_RETURNED'
              AND ce.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
        )
        THEN RAISE(ABORT, 'Pembatalan penyaluran CASH dalam status PROCESSING wajib menyertakan bukti pengembalian fisik kas (CASH_RETURNED).')
    END;

    -- 7C. MANUAL_TRANSFER
    SELECT CASE
        WHEN OLD.method = 'MANUAL_TRANSFER' AND OLD.status = 'DISTRIBUTED'
        THEN RAISE(ABORT, 'Pembatalan dilarang: Penyaluran transfer manual telah selesai (DISTRIBUTED). Gunakan alur pemulihan / koreksi.')

        WHEN OLD.method = 'MANUAL_TRANSFER' AND OLD.status = 'PROCESSING'
        THEN RAISE(ABORT, 'Pembatalan dilarang saat transfer manual sedang diproses (PROCESSING). Gunakan bukti kegagalan bank resmi untuk menetapkan status FAILED.')
    END;
END;

-- 8. Trigger Rekonstruksi: Immutabilitas Field Finansial Header Termasuk Sesi Kas & Akun Sumber
DROP TRIGGER IF EXISTS trg_finance_dist_header_financial_fields_immutable;
CREATE TRIGGER trg_finance_dist_header_financial_fields_immutable
BEFORE UPDATE ON finance_distributions
FOR EACH ROW
WHEN OLD.status != 'DRAFT' OR EXISTS (
    SELECT 1 FROM finance_qlola_transfer_intents ti
    WHERE ti.distribution_id = OLD.id
      AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
)
BEGIN
    SELECT
        CASE
            WHEN NEW.recipient_type != OLD.recipient_type
              OR NEW.recipient_id IS NOT OLD.recipient_id
              OR NEW.item_type != OLD.item_type
              OR NEW.period != OLD.period
              OR NEW.total_amount != OLD.total_amount
              OR NEW.method != OLD.method
              OR NEW.destination_bank IS NOT OLD.destination_bank
              OR NEW.destination_account IS NOT OLD.destination_account
              OR NEW.account_holder_name IS NOT OLD.account_holder_name
              OR (OLD.recipient_name IS NOT NULL AND NEW.recipient_name IS NOT OLD.recipient_name)
              OR (OLD.recipient_category IS NOT NULL AND NEW.recipient_category IS NOT OLD.recipient_category)
              OR (OLD.destination_bank_code IS NOT NULL AND NEW.destination_bank_code IS NOT OLD.destination_bank_code)
              OR (OLD.destination_account_holder IS NOT NULL AND NEW.destination_account_holder IS NOT OLD.destination_account_holder)
              OR (OLD.account_id IS NOT NULL AND NEW.account_id IS NOT OLD.account_id)
              OR NEW.currency != OLD.currency
              OR (OLD.distribution_request_id IS NOT NULL AND NEW.distribution_request_id IS NOT OLD.distribution_request_id)
              OR (OLD.cash_session_id IS NOT NULL AND NEW.cash_session_id IS NOT OLD.cash_session_id)
              OR (OLD.source_account_id IS NOT NULL AND NEW.source_account_id IS NOT OLD.source_account_id)
              OR (OLD.source_account_number IS NOT NULL AND NEW.source_account_number IS NOT OLD.source_account_number)
              OR (OLD.source_bank_code IS NOT NULL AND NEW.source_bank_code IS NOT OLD.source_bank_code)
              OR (OLD.source_account_holder IS NOT NULL AND NEW.source_account_holder IS NOT OLD.source_account_holder)
              OR (OLD.statement_transaction_id IS NOT NULL AND NEW.statement_transaction_id IS NOT OLD.statement_transaction_id)
            THEN RAISE(ABORT, 'Field finansial instruksi penyaluran bersifat immutable saat memiliki intent transfer aktif atau setelah meninggalkan DRAFT.')
        END;
END;

-- 9. Trigger Rekonstruksi: Validasi & Immutabilitas Pencatatan Fee Bank Lintas Metode
DROP TRIGGER IF EXISTS trg_finance_dist_bank_fee_guard;
CREATE TRIGGER trg_finance_dist_bank_fee_guard
BEFORE UPDATE OF bank_fee_amount ON finance_distributions
FOR EACH ROW
BEGIN
    SELECT
        CASE
            -- 1. Jika sudah dicatat (OLD.bank_fee_amount IS NOT NULL), tidak boleh diubah lagi (immutable baik 0 maupun >0)
            WHEN OLD.bank_fee_amount IS NOT NULL AND NEW.bank_fee_amount != OLD.bank_fee_amount
            THEN RAISE(ABORT, 'Nominal fee bank bersifat immutable setelah dicatat (tidak dapat diubah, baik bernilai 0 maupun > 0).')

            -- 2. Untuk BRI_QLOLA: jika baru pertama kali dicatat dari NULL, wajib memiliki bukti provider EXECUTION_SUCCESS otoritatif non-TEST_PROVIDER
            WHEN OLD.method = 'BRI_QLOLA' AND OLD.bank_fee_amount IS NULL AND NEW.bank_fee_amount IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'EXECUTION_SUCCESS'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah (EXECUTION_SUCCESS non-TEST_PROVIDER).')

            -- 3. Untuk MANUAL_TRANSFER: jika baru pertama kali dicatat dari NULL, wajib memiliki bukti sukses transfer bank di finance_cash_manual_evidence
            WHEN OLD.method = 'MANUAL_TRANSFER' AND OLD.bank_fee_amount IS NULL AND NEW.bank_fee_amount IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1 FROM finance_cash_manual_evidence ce
                 WHERE ce.distribution_id = NEW.id
                   AND ce.evidence_type IN ('MANUAL_TRANSFER_SUCCESS', 'BANK_STATEMENT_DEBIT', 'MANUAL_OFFICIAL_PROOF')
                   AND ce.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Pencatatan fee bank untuk transfer manual wajib didasari bukti transfer sukses otoritatif.')
        END;
END;

