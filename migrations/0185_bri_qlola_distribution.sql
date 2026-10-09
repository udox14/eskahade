-- ============================================================================
-- MIGRATION 0185: BRI / QLOLA NON-STP DISTRIBUTION FOUNDATION
-- Membangun schema pendukung penyaluran dana Non-STP QLola:
-- 1. Snapshot immutable penerima dan rekening pada finance_distributions
-- 2. Dispatch evidence columns & QLola workflow tracking references
-- 3. Model Outbox / Intent Transfer (finance_qlola_transfer_intents)
-- 4. Tabel Bukti Eksternal / Penyedia (finance_qlola_provider_evidence) - Append-Only & Provenance
-- 5. Database triggers pemeliharaan integritas finansial, bukti bank, dan immutabilitas
-- ============================================================================

-- 1. Tambah kolom snapshot dan tracking pada finance_distributions
ALTER TABLE finance_distributions ADD COLUMN recipient_name TEXT;
ALTER TABLE finance_distributions ADD COLUMN recipient_category TEXT CHECK (recipient_category IS NULL OR recipient_category IN ('PESANTREN', 'KATERING', 'LAUNDRY'));
ALTER TABLE finance_distributions ADD COLUMN destination_bank_code TEXT;
ALTER TABLE finance_distributions ADD COLUMN destination_account_holder TEXT;
ALTER TABLE finance_distributions ADD COLUMN account_id TEXT REFERENCES finance_recipient_accounts(id);
ALTER TABLE finance_distributions ADD COLUMN distribution_request_id TEXT;
ALTER TABLE finance_distributions ADD COLUMN batch_reference TEXT;
ALTER TABLE finance_distributions ADD COLUMN maker_reference TEXT;
ALTER TABLE finance_distributions ADD COLUMN approval_workflow_reference TEXT;
ALTER TABLE finance_distributions ADD COLUMN bank_transaction_reference TEXT;
ALTER TABLE finance_distributions ADD COLUMN provider_status TEXT;
ALTER TABLE finance_distributions ADD COLUMN dispatch_attempted_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN provider_request_hash TEXT;
ALTER TABLE finance_distributions ADD COLUMN submission_outcome TEXT CHECK (submission_outcome IS NULL OR submission_outcome IN ('NOT_DISPATCHED', 'SUBMISSION_PENDING', 'SUBMITTED', 'UNKNOWN', 'FAILED'));
ALTER TABLE finance_distributions ADD COLUMN bank_fee_amount INTEGER DEFAULT NULL CHECK (bank_fee_amount IS NULL OR bank_fee_amount >= 0);
ALTER TABLE finance_distributions ADD COLUMN bank_fee_bearer TEXT CHECK (bank_fee_bearer IS NULL OR bank_fee_bearer IN ('KOPERASI', 'BENEFICIARY'));
ALTER TABLE finance_distributions ADD COLUMN bank_fee_reference TEXT;
ALTER TABLE finance_distributions ADD COLUMN bank_fee_captured_at TEXT;
ALTER TABLE finance_distributions ADD COLUMN currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR');
ALTER TABLE finance_distributions ADD COLUMN rejection_reason TEXT;
ALTER TABLE finance_distributions ADD COLUMN cancellation_reason TEXT;

-- Indeks unik untuk distribution_request_id guna menjamin idempotensi submit
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_distributions_req_id
    ON finance_distributions(distribution_request_id)
    WHERE distribution_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_distributions_batch_ref
    ON finance_distributions(batch_reference);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_acc_id
    ON finance_distributions(account_id);

-- 2. Tabel Intent Penyaluran QLola (Outbox / Intent Model)
CREATE TABLE IF NOT EXISTS finance_qlola_transfer_intents (
    id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL REFERENCES finance_distributions(id),
    distribution_request_id TEXT NOT NULL UNIQUE,
    intent_status TEXT NOT NULL CHECK (intent_status IN ('CREATED', 'SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING', 'SUBMITTED', 'CONFIRMED', 'CANCELLED', 'FAILED')),
    external_id TEXT,
    maker_user_id TEXT NOT NULL REFERENCES users(id),
    payload_hash TEXT NOT NULL,
    provider_status TEXT,
    error_details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_qlola_intents_dist
    ON finance_qlola_transfer_intents(distribution_id);

CREATE INDEX IF NOT EXISTS idx_finance_qlola_intents_status
    ON finance_qlola_transfer_intents(intent_status);

-- 3. Tabel Bukti Eksternal / Penyedia (First-Class Provider Evidence)
CREATE TABLE IF NOT EXISTS finance_qlola_provider_evidence (
    id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL REFERENCES finance_distributions(id),
    source TEXT NOT NULL CHECK (source IN ('BANK_WEBHOOK', 'BANK_STATEMENT', 'H2H_SYNC', 'MANUAL_OFFICIAL_PROOF', 'TEST_PROVIDER')),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('SUBMISSION_ACK', 'APPROVAL_PROGRESS', 'EXECUTION_SUCCESS', 'EXECUTION_REJECTED', 'EXECUTION_FAILED', 'CANCELLATION_CONFIRMED', 'APPROVAL_REJECTED')),
    evidence_strength TEXT NOT NULL DEFAULT 'AUTHORITATIVE_EXACT' CHECK (evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED', 'CANDIDATE')),
    provider_state TEXT NOT NULL,
    provider_reference TEXT,
    observed_at TEXT NOT NULL,
    raw_evidence_hash TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    operator_authorized_by TEXT REFERENCES users(id),
    operator_role_snapshot TEXT,
    manual_proof_reference TEXT,
    audit_linkage TEXT,
    notes TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_qlola_evidence_dist
    ON finance_qlola_provider_evidence(distribution_id);

CREATE INDEX IF NOT EXISTS idx_finance_qlola_evidence_ref
    ON finance_qlola_provider_evidence(provider_reference)
    WHERE provider_reference IS NOT NULL;

-- 4. Triggers Append-Only & Audit Integrity pada finance_qlola_provider_evidence
CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_evidence_immutable_update
BEFORE UPDATE ON finance_qlola_provider_evidence
BEGIN
    SELECT RAISE(ABORT, 'Tabel finance_qlola_provider_evidence bersifat append-only. UPDATE dilarang.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_evidence_immutable_delete
BEFORE DELETE ON finance_qlola_provider_evidence
BEGIN
    SELECT RAISE(ABORT, 'Tabel finance_qlola_provider_evidence bersifat append-only. DELETE dilarang.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_evidence_validate_manual_proof
BEFORE INSERT ON finance_qlola_provider_evidence
FOR EACH ROW
WHEN NEW.source = 'MANUAL_OFFICIAL_PROOF'
BEGIN
    SELECT CASE
        WHEN NEW.operator_authorized_by IS NULL
          OR NEW.operator_role_snapshot IS NULL
          OR NEW.manual_proof_reference IS NULL
          OR NEW.notes IS NULL
        THEN RAISE(ABORT, 'Bukti MANUAL_OFFICIAL_PROOF wajib menyertakan operator_authorized_by (user ID yang sah), operator_role_snapshot, manual_proof_reference, dan notes untuk audit trail.')
        WHEN NOT EXISTS (
            SELECT 1 FROM users u WHERE u.id = NEW.operator_authorized_by
        )
        THEN RAISE(ABORT, 'operator_authorized_by tidak valid: User tidak ditemukan dalam sistem database.')
        WHEN LOWER(NEW.operator_role_snapshot) NOT IN ('admin', 'bendahara')
        THEN RAISE(ABORT, 'Hanya role admin atau bendahara yang berwenang mengesahkan bukti penyaluran manual.')
    END;
END;

-- 5. Trigger: Deteksi tabrakan referensi eksekusi bank lintas distribusi
CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_evidence_prevent_collision
BEFORE INSERT ON finance_qlola_provider_evidence
FOR EACH ROW
WHEN NEW.provider_reference IS NOT NULL AND NEW.evidence_type = 'EXECUTION_SUCCESS'
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1 FROM finance_qlola_provider_evidence other
                WHERE other.provider_reference = NEW.provider_reference
                  AND other.evidence_type = 'EXECUTION_SUCCESS'
                  AND other.distribution_id != NEW.distribution_id
            )
            THEN RAISE(ABORT, 'COLLISION_CONFLICT: Nomor referensi eksekusi bank telah digunakan untuk distribusi lain.')
        END;
END;

-- 6. Triggers pada finance_qlola_transfer_intents: Reservasi Dana & Anti-Duplikasi Intent
CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_intents_prevent_duplicate_active
BEFORE INSERT ON finance_qlola_transfer_intents
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM finance_qlola_transfer_intents ti
    WHERE ti.distribution_id = NEW.distribution_id
      AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING', 'SUBMITTED', 'CONFIRMED')
)
BEGIN
    SELECT RAISE(ABORT, 'Distribusi telah memiliki intent transfer aktif atau telah disubmit. Pembuatan intent kedua dilarang.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_intents_prevent_over_reserve_insert
BEFORE INSERT ON finance_qlola_transfer_intents
FOR EACH ROW
WHEN NEW.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM finance_distribution_items cur_di
                JOIN finance_allocations a ON cur_di.allocation_id = a.id
                WHERE cur_di.distribution_id = NEW.distribution_id
                  AND (
                      COALESCE((
                          SELECT SUM(other_di.amount)
                          FROM finance_distribution_items other_di
                          JOIN finance_distributions other_d ON other_di.distribution_id = other_d.id
                          WHERE other_di.allocation_id = cur_di.allocation_id
                            AND other_d.id != NEW.distribution_id
                            AND (
                                other_d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                                OR (
                                    other_d.status = 'DRAFT' AND EXISTS (
                                        SELECT 1 FROM finance_qlola_transfer_intents other_ti
                                        WHERE other_ti.distribution_id = other_d.id
                                          AND other_ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
                                    )
                                )
                            )
                      ), 0) + cur_di.amount
                  ) > (
                      a.amount - COALESCE((
                          SELECT SUM(fci.amount)
                          FROM finance_correction_items fci
                          WHERE fci.target_allocation_id = a.id
                      ), 0)
                  )
            )
            THEN RAISE(ABORT, 'Reservasi intent transfer melebihi sisa alokasi efektif yang tersedia.')
        END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_qlola_intents_prevent_over_reserve_update
BEFORE UPDATE OF intent_status ON finance_qlola_transfer_intents
FOR EACH ROW
WHEN NEW.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING') AND OLD.intent_status NOT IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM finance_distribution_items cur_di
                JOIN finance_allocations a ON cur_di.allocation_id = a.id
                WHERE cur_di.distribution_id = NEW.distribution_id
                  AND (
                      COALESCE((
                          SELECT SUM(other_di.amount)
                          FROM finance_distribution_items other_di
                          JOIN finance_distributions other_d ON other_di.distribution_id = other_d.id
                          WHERE other_di.allocation_id = cur_di.allocation_id
                            AND other_d.id != NEW.distribution_id
                            AND (
                                other_d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                                OR (
                                    other_d.status = 'DRAFT' AND EXISTS (
                                        SELECT 1 FROM finance_qlola_transfer_intents other_ti
                                        WHERE other_ti.distribution_id = other_d.id
                                          AND other_ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
                                    )
                                )
                            )
                      ), 0) + cur_di.amount
                  ) > (
                      a.amount - COALESCE((
                          SELECT SUM(fci.amount)
                          FROM finance_correction_items fci
                          WHERE fci.target_allocation_id = a.id
                      ), 0)
                  )
            )
            THEN RAISE(ABORT, 'Reservasi intent transfer melebihi sisa alokasi efektif yang tersedia.')
        END;
END;

-- 7. Update Triggers pada finance_distribution_items: Mencegah Overdraw & Freeze saat Intent Aktif
DROP TRIGGER IF EXISTS trg_finance_dist_items_prevent_overdraw;
CREATE TRIGGER trg_finance_dist_items_prevent_overdraw
BEFORE INSERT ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT
        CASE
            WHEN status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED') THEN 1
            WHEN status = 'DRAFT' AND EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = finance_distributions.id
                  AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
            ) THEN 1
            ELSE 0
        END
    FROM finance_distributions WHERE id = NEW.distribution_id
) = 1
BEGIN
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(di.amount)
                    FROM finance_distribution_items di
                    JOIN finance_distributions d ON di.distribution_id = d.id
                    WHERE di.allocation_id = NEW.allocation_id
                      AND (
                          d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                          OR (
                              d.status = 'DRAFT' AND EXISTS (
                                  SELECT 1 FROM finance_qlola_transfer_intents ti
                                  WHERE ti.distribution_id = d.id
                                    AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
                              )
                          )
                      )
                ), 0) + NEW.amount
            ) > (
                SELECT fa.amount - COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = fa.id
                ), 0)
                FROM finance_allocations fa
                WHERE fa.id = NEW.allocation_id
            )
            THEN RAISE(ABORT, 'Total penyaluran dan reservasi melebihi dana alokasi efektif yang tersedia (setelah memperhitungkan koreksi dan intent aktif).')
        END;
END;

DROP TRIGGER IF EXISTS trg_finance_dist_items_immutable_on_update;
CREATE TRIGGER trg_finance_dist_items_immutable_on_update
BEFORE UPDATE ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
) != 'DRAFT' OR EXISTS (
    SELECT 1 FROM finance_qlola_transfer_intents ti
    WHERE ti.distribution_id = OLD.distribution_id
      AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
)
BEGIN
    SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh diubah saat memiliki intent transfer aktif atau setelah pengajuan.');
END;

DROP TRIGGER IF EXISTS trg_finance_dist_items_immutable_on_delete;
CREATE TRIGGER trg_finance_dist_items_immutable_on_delete
BEFORE DELETE ON finance_distribution_items
FOR EACH ROW
WHEN (
    SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
) != 'DRAFT' OR EXISTS (
    SELECT 1 FROM finance_qlola_transfer_intents ti
    WHERE ti.distribution_id = OLD.distribution_id
      AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
)
BEGIN
    SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh dihapus saat memiliki intent transfer aktif atau setelah pengajuan.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_dist_items_immutable_on_insert
BEFORE INSERT ON finance_distribution_items
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM finance_qlola_transfer_intents ti
    WHERE ti.distribution_id = NEW.distribution_id
      AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
)
BEGIN
    SELECT RAISE(ABORT, 'Dilarang menambah item pada distribusi yang memiliki intent transfer aktif.');
END;

-- 8. Update Triggers pada finance_distributions: Immutabilitas, Metode, Pembatalan, dan Bukti Provider
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
            THEN RAISE(ABORT, 'Field finansial instruksi penyaluran bersifat immutable saat memiliki intent transfer aktif atau setelah meninggalkan DRAFT.')
        END;
END;

DROP TRIGGER IF EXISTS trg_finance_dist_status_prevent_over_reserve;
CREATE TRIGGER trg_finance_dist_status_prevent_over_reserve
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN (
    OLD.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
    AND NEW.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
)
BEGIN
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM finance_distribution_items cur_di
                JOIN finance_allocations a ON cur_di.allocation_id = a.id
                WHERE cur_di.distribution_id = NEW.id
                  AND (
                      COALESCE((
                          SELECT SUM(other_di.amount)
                          FROM finance_distribution_items other_di
                          JOIN finance_distributions other_d ON other_di.distribution_id = other_d.id
                          WHERE other_di.allocation_id = cur_di.allocation_id
                            AND other_d.id != NEW.id
                            AND (
                                other_d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                                OR (
                                    other_d.status = 'DRAFT' AND EXISTS (
                                        SELECT 1 FROM finance_qlola_transfer_intents ti
                                        WHERE ti.distribution_id = other_d.id
                                          AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
                                    )
                                )
                            )
                      ), 0) + cur_di.amount
                  ) > (
                      a.amount - COALESCE((
                          SELECT SUM(fci.amount)
                          FROM finance_correction_items fci
                          WHERE fci.target_allocation_id = a.id
                      ), 0)
                  )
            )
            THEN RAISE(ABORT, 'Perubahan status gagal: Reservasi dana melebihi sisa alokasi efektif yang tersedia (setelah memperhitungkan koreksi dan intent aktif).')
        END;
END;

DROP TRIGGER IF EXISTS trg_finance_dist_prevent_method_switch_when_reserving;
CREATE TRIGGER trg_finance_dist_prevent_method_switch_when_reserving
BEFORE UPDATE OF method ON finance_distributions
FOR EACH ROW
WHEN OLD.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING')
  OR EXISTS (
      SELECT 1 FROM finance_qlola_transfer_intents ti
      WHERE ti.distribution_id = OLD.id
        AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
  )
BEGIN
    SELECT CASE
        WHEN NEW.method != OLD.method
        THEN RAISE(ABORT, 'Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif atau memiliki intent transfer aktif.')
    END;
END;

DROP TRIGGER IF EXISTS trg_finance_dist_prevent_cancel_if_dispatched;
CREATE TRIGGER trg_finance_dist_prevent_cancel_if_dispatched
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.status = 'CANCELLED'
BEGIN
    SELECT
        CASE
            WHEN (
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
END;

DROP TRIGGER IF EXISTS trg_finance_dist_require_provider_evidence;
CREATE TRIGGER trg_finance_dist_require_provider_evidence
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'BRI_QLOLA' AND OLD.status != NEW.status
BEGIN
    SELECT
        CASE
            -- DRAFT -> PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif non-TEST_PROVIDER
            WHEN OLD.status = 'DRAFT' AND NEW.status = 'PENDING_APPROVAL'
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'SUBMISSION_ACK'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif (non-TEST_PROVIDER).')

            -- PENDING_APPROVAL -> PROCESSING wajib memiliki bukti APPROVAL_PROGRESS otoritatif non-TEST_PROVIDER
            WHEN OLD.status = 'PENDING_APPROVAL' AND NEW.status = 'PROCESSING'
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'APPROVAL_PROGRESS'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Peralihan PENDING_APPROVAL ke PROCESSING wajib memiliki bukti APPROVAL_PROGRESS otoritatif (non-TEST_PROVIDER).')

            -- Peralihan ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif non-TEST_PROVIDER
            WHEN NEW.status = 'DISTRIBUTED'
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'EXECUTION_SUCCESS'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Peralihan status ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif (non-TEST_PROVIDER).')

            -- Peralihan ke FAILED wajib memiliki bukti EXECUTION_FAILED otoritatif non-TEST_PROVIDER
            WHEN NEW.status = 'FAILED'
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'EXECUTION_FAILED'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Peralihan status ke FAILED wajib memiliki bukti EXECUTION_FAILED otoritatif (non-TEST_PROVIDER).')

            -- Peralihan ke REJECTED wajib memiliki bukti penolakan otoritatif non-TEST_PROVIDER
            WHEN NEW.status = 'REJECTED'
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type IN ('EXECUTION_REJECTED', 'APPROVAL_REJECTED')
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Peralihan status ke REJECTED wajib memiliki bukti penolakan otoritatif (non-TEST_PROVIDER).')
        END;
END;

-- 9. Trigger: Validasi & Immutabilitas Pencatatan Fee Bank
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_bank_fee_guard
BEFORE UPDATE OF bank_fee_amount ON finance_distributions
FOR EACH ROW
BEGIN
    SELECT
        CASE
            -- 1. Jika sudah dicatat (OLD.bank_fee_amount IS NOT NULL), tidak boleh diubah lagi (immutable baik 0 maupun >0)
            WHEN OLD.bank_fee_amount IS NOT NULL AND NEW.bank_fee_amount != OLD.bank_fee_amount
            THEN RAISE(ABORT, 'Nominal fee bank bersifat immutable setelah dicatat (tidak dapat diubah, baik bernilai 0 maupun > 0).')

            -- 2. Jika baru pertama kali dicatat dari NULL, wajib memiliki bukti provider EXECUTION_SUCCESS otoritatif non-TEST_PROVIDER
            WHEN OLD.bank_fee_amount IS NULL AND NEW.bank_fee_amount IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1 FROM finance_qlola_provider_evidence pe
                 WHERE pe.distribution_id = NEW.id
                   AND pe.evidence_type = 'EXECUTION_SUCCESS'
                   AND pe.source != 'TEST_PROVIDER'
                   AND pe.evidence_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')
             )
            THEN RAISE(ABORT, 'Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah (EXECUTION_SUCCESS non-TEST_PROVIDER).')
        END;
END;
