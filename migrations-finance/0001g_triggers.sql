-- Migrasi keuangan 0001g - SELURUH TRIGGER.
--
-- Berkas ini sengaja dipisah dan dijalankan PALING AKHIR setelah 0001b-0001f,
-- ketika semua tabel sudah ada. Alasannya adalah insiden 0007 (16 Agu 2026):
-- SQLite membuat trigger tanpa memvalidasi tabel yang hanya disebut di dalam
-- body-nya, sehingga trigger yang dibuat sebelum tabel rujukannya ada akan
-- "menggantung" dan baru meledak saat dipicu atau saat skema divalidasi ulang.
--
-- Beberapa trigger di sini merujuk tabel lintas modul: validate_post membaca
-- dompet, withdrawal_validate membaca kebijakan kredensial dan limit. Jangan
-- pecah berkas ini per modul.

PRAGMA foreign_keys = ON;

-- =====================================================================
-- LEDGER - double-entry dipertahankan penuh, disalin apa adanya.
-- =====================================================================

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_period_open
BEFORE INSERT ON finance_journals
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_periods
    WHERE period_key = substr(NEW.effective_date, 1, 7) AND status = 'CLOSED'
  ) THEN RAISE(ABORT, 'FINANCE_PERIOD_CLOSED') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_entry_draft_only
BEFORE INSERT ON finance_journal_entries
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_journals WHERE id = NEW.journal_id), '') <> 'DRAFT'
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_NOT_DRAFT') END;
  SELECT CASE WHEN COALESCE((SELECT is_active FROM finance_accounts WHERE id = NEW.account_id), 0) <> 1
    THEN RAISE(ABORT, 'FINANCE_ACCOUNT_INACTIVE') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_entry_no_update
BEFORE UPDATE ON finance_journal_entries BEGIN SELECT RAISE(ABORT, 'FINANCE_ENTRY_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_entry_no_delete
BEFORE DELETE ON finance_journal_entries BEGIN SELECT RAISE(ABORT, 'FINANCE_ENTRY_IMMUTABLE'); END;

-- Inti jaminan uang: debit harus sama dengan kredit, minimal dua baris, dan
-- tidak ada akun maupun dompet yang boleh jatuh di bawah nol.
CREATE TRIGGER IF NOT EXISTS trg_finance_journal_validate_post
BEFORE UPDATE OF status ON finance_journals
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM finance_journal_entries WHERE journal_id = NEW.id) < 2
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_MINIMUM_TWO_ENTRIES') END;
  SELECT CASE WHEN
    COALESCE((SELECT SUM(CASE WHEN side='DEBIT' THEN amount_rupiah ELSE 0 END) FROM finance_journal_entries WHERE journal_id=NEW.id), 0)
    <>
    COALESCE((SELECT SUM(CASE WHEN side='CREDIT' THEN amount_rupiah ELSE 0 END) FROM finance_journal_entries WHERE journal_id=NEW.id), 0)
    THEN RAISE(ABORT, 'FINANCE_JOURNAL_UNBALANCED') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM finance_journal_entries e
    JOIN finance_accounts a ON a.id=e.account_id
    LEFT JOIN finance_account_balances b ON b.account_id=e.account_id
    WHERE e.journal_id=NEW.id AND a.allow_negative=0
    GROUP BY e.account_id
    HAVING COALESCE(MAX(b.balance_rupiah),0) + SUM(CASE WHEN a.normal_balance=e.side THEN e.amount_rupiah ELSE -e.amount_rupiah END) < 0
  ) THEN RAISE(ABORT, 'FINANCE_ACCOUNT_NEGATIVE') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_wallet_movements m
    LEFT JOIN finance_student_wallets w ON w.santri_id=m.santri_id AND w.wallet_kind=m.wallet_kind
    WHERE m.journal_id=NEW.id
    GROUP BY m.santri_id,m.wallet_kind
    HAVING COALESCE(MAX(w.balance_rupiah),0)+SUM(m.amount_rupiah)<0 OR MAX(CASE WHEN w.frozen_at IS NOT NULL THEN 1 ELSE 0 END)=1
  ) THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_apply_balances
AFTER UPDATE OF status ON finance_journals
WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
BEGIN
  INSERT INTO finance_account_balances(account_id,balance_rupiah,version,updated_at)
  SELECT e.account_id,
         SUM(CASE WHEN a.normal_balance=e.side THEN e.amount_rupiah ELSE -e.amount_rupiah END),
         1,datetime('now')
  FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id
  WHERE e.journal_id=NEW.id
  GROUP BY e.account_id
  ON CONFLICT(account_id) DO UPDATE SET
    balance_rupiah=balance_rupiah+excluded.balance_rupiah,
    version=version+1,
    updated_at=datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_posted_immutable
BEFORE UPDATE ON finance_journals
WHEN OLD.status = 'POSTED'
BEGIN SELECT RAISE(ABORT, 'FINANCE_JOURNAL_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_journal_no_delete
BEFORE DELETE ON finance_journals BEGIN SELECT RAISE(ABORT, 'FINANCE_JOURNAL_IMMUTABLE'); END;

-- Top-up hanya boleh dibukukan bila intent-nya benar-benar sudah PAID dan
-- belum pernah dibukukan. Ini penjaga utama terhadap callback ganda Duitku.
CREATE TRIGGER IF NOT EXISTS trg_finance_topup_journal_requires_paid_intent
BEFORE INSERT ON finance_journals
WHEN NEW.source_type='TOPUP'
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_payment_intents WHERE id=NEW.source_id),'') <> 'PAID'
    THEN RAISE(ABORT, 'FINANCE_TOPUP_INTENT_NOT_PAID') END;
  SELECT CASE WHEN (SELECT journal_id FROM finance_payment_intents WHERE id=NEW.source_id) IS NOT NULL
    THEN RAISE(ABORT, 'FINANCE_TOPUP_ALREADY_POSTED') END;
END;

-- =====================================================================
-- DOMPET SANTRI
-- =====================================================================

CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_validate
BEFORE INSERT ON finance_wallet_movements
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_journals WHERE id=NEW.journal_id), '') <> 'DRAFT'
    THEN RAISE(ABORT, 'FINANCE_WALLET_JOURNAL_NOT_DRAFT') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM finance_student_wallets
    WHERE santri_id=NEW.santri_id AND wallet_kind=NEW.wallet_kind AND frozen_at IS NOT NULL
  ) THEN RAISE(ABORT, 'FINANCE_WALLET_FROZEN') END;
  SELECT CASE WHEN COALESCE((
    SELECT balance_rupiah FROM finance_student_wallets
    WHERE santri_id=NEW.santri_id AND wallet_kind=NEW.wallet_kind
  ), 0) + NEW.amount_rupiah < 0 THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
END;

-- Versi ringkas dari trigger lama. Yang lama memakai ~20 baris subquery
-- berkorelasi untuk menangani kasus satu jurnal punya beberapa pergerakan pada
-- dompet yang sama. Kasus itu tidak pernah terjadi - setiap resep jurnal
-- menyentuh tiap dompet paling banyak sekali - dan sekarang dijamin mustahil
-- oleh uq_finance_wallet_movement_per_journal di bawah. Perilakunya identik.
CREATE TRIGGER IF NOT EXISTS trg_finance_journal_apply_wallets
AFTER UPDATE OF status ON finance_journals
WHEN OLD.status='DRAFT' AND NEW.status='POSTED'
BEGIN
  -- Baris dompet dipastikan ada lebih dulu dengan saldo 0, baru saldonya
  -- ditambah. Pola upsert lama (INSERT ... SUM(amount) ... ON CONFLICT DO UPDATE)
  -- menabrak CHECK balance_rupiah>=0 pada setiap jurnal yang mengurangi dompet:
  -- SQLite mengevaluasi CHECK pada baris kandidat (yang nilainya negatif)
  -- SEBELUM konflik UNIQUE diselesaikan, sehingga alokasi dan penarikan selalu
  -- gagal. Bug ini ada di skema lama dan tidak pernah terpicu karena uji lama
  -- hanya menguji top-up (nilai positif).
  INSERT OR IGNORE INTO finance_student_wallets(santri_id,wallet_kind,balance_rupiah,version)
  SELECT DISTINCT santri_id,wallet_kind,0,0
  FROM finance_wallet_movements WHERE journal_id=NEW.id;

  UPDATE finance_student_wallets
  SET balance_rupiah=balance_rupiah+(
        SELECT SUM(m.amount_rupiah) FROM finance_wallet_movements m
        WHERE m.journal_id=NEW.id
          AND m.santri_id=finance_student_wallets.santri_id
          AND m.wallet_kind=finance_student_wallets.wallet_kind),
      version=version+1,
      updated_at=datetime('now')
  WHERE EXISTS (
    SELECT 1 FROM finance_wallet_movements m
    WHERE m.journal_id=NEW.id
      AND m.santri_id=finance_student_wallets.santri_id
      AND m.wallet_kind=finance_student_wallets.wallet_kind);

  UPDATE finance_wallet_movements
  SET balance_after=(SELECT w.balance_rupiah FROM finance_student_wallets w
                     WHERE w.santri_id=finance_wallet_movements.santri_id
                       AND w.wallet_kind=finance_wallet_movements.wallet_kind),
      balance_before=(SELECT w.balance_rupiah FROM finance_student_wallets w
                      WHERE w.santri_id=finance_wallet_movements.santri_id
                        AND w.wallet_kind=finance_wallet_movements.wallet_kind)
                     - finance_wallet_movements.amount_rupiah
  WHERE journal_id=NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_no_update
BEFORE UPDATE ON finance_wallet_movements
WHEN OLD.balance_before IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'FINANCE_WALLET_MOVEMENT_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_movement_no_delete
BEFORE DELETE ON finance_wallet_movements
BEGIN SELECT RAISE(ABORT, 'FINANCE_WALLET_MOVEMENT_IMMUTABLE'); END;

-- =====================================================================
-- TAGIHAN DAN ALOKASI - versi mutakhir hasil perbaikan 0009.
-- =====================================================================

CREATE TRIGGER IF NOT EXISTS trg_finance_bill_payment_rules
BEFORE UPDATE OF paid_rupiah ON finance_bills
BEGIN
  SELECT CASE WHEN NEW.paid_rupiah>NEW.amount_rupiah THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN OLD.bill_kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY') AND NEW.paid_rupiah NOT IN (0,NEW.amount_rupiah)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_allocation_bill_validate
BEFORE INSERT ON finance_allocation_bill_items
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_bills WHERE id=NEW.bill_id),'') NOT IN ('OPEN','PARTIAL')
    THEN RAISE(ABORT,'FINANCE_BILL_NOT_OPEN') END;
  SELECT CASE WHEN
    COALESCE((SELECT santri_id FROM finance_bills WHERE id=NEW.bill_id),'')
    <> COALESCE((SELECT santri_id FROM finance_allocations WHERE id=NEW.allocation_id),'')
    THEN RAISE(ABORT,'FINANCE_BILL_OWNER_MISMATCH') END;
  SELECT CASE WHEN NEW.amount_rupiah>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN (SELECT bill_kind FROM finance_bills WHERE id=NEW.bill_id) IN ('SPP','NON_SPP','MAKAN','LAUNDRY')
    AND NEW.amount_rupiah<>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_allocation_bill_apply
AFTER INSERT ON finance_allocation_bill_items
BEGIN
  UPDATE finance_bills
  SET paid_rupiah=paid_rupiah+NEW.amount_rupiah,
      status=CASE WHEN paid_rupiah+NEW.amount_rupiah=amount_rupiah THEN 'PAID' ELSE 'PARTIAL' END,
      updated_at=datetime('now')
  WHERE id=NEW.bill_id;
END;

-- =====================================================================
-- PENARIKAN LOKET - dipertahankan UTUH, termasuk ketiga limit.
-- Ini yang menegakkan limit secara atomik terhadap race dua loket sekaligus;
-- jangan pernah dipindah ke lapisan aplikasi.
-- =====================================================================

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_validate
BEFORE INSERT ON finance_withdrawals
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_cash_shifts WHERE id=NEW.shift_id), '') <> 'OPEN'
    THEN RAISE(ABORT, 'FINANCE_SHIFT_NOT_OPEN') END;
  SELECT CASE WHEN COALESCE((SELECT operator_id FROM finance_cash_shifts WHERE id=NEW.shift_id), '') <> NEW.operator_id
    THEN RAISE(ABORT, 'FINANCE_SHIFT_OPERATOR_MISMATCH') END;
  SELECT CASE WHEN NEW.amount_rupiah > (SELECT per_transaction_cap_rupiah FROM finance_credential_policy WHERE singleton_id=1)
    THEN RAISE(ABORT, 'FINANCE_WITHDRAWAL_CAP_EXCEEDED') END;
  SELECT CASE WHEN NEW.amount_rupiah % (SELECT denomination_rupiah FROM finance_credential_policy WHERE singleton_id=1) <> 0
    THEN RAISE(ABORT, 'FINANCE_WITHDRAWAL_DENOMINATION') END;
  SELECT CASE WHEN COALESCE((SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=NEW.santri_id AND wallet_kind='JAJAN'),0) < NEW.amount_rupiah
    THEN RAISE(ABORT, 'FINANCE_WALLET_INSUFFICIENT') END;
  SELECT CASE WHEN (SELECT daily_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND date(created_at,'+7 hours')=date('now','+7 hours')),0) + NEW.amount_rupiah >
    (SELECT daily_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_DAILY_LIMIT_EXCEEDED') END;
  SELECT CASE WHEN (SELECT weekly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND date(created_at,'+7 hours') >= date('now','+7 hours','-' || ((strftime('%w','now','+7 hours')+6)%7) || ' days')),0) + NEW.amount_rupiah >
    (SELECT weekly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_WEEKLY_LIMIT_EXCEEDED') END;
  SELECT CASE WHEN (SELECT monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id) IS NOT NULL AND
    COALESCE((SELECT SUM(amount_rupiah) FROM finance_withdrawals WHERE santri_id=NEW.santri_id AND status='SUCCESS' AND strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours')),0) + NEW.amount_rupiah >
    (SELECT monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=NEW.santri_id)
    THEN RAISE(ABORT, 'FINANCE_MONTHLY_LIMIT_EXCEEDED') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_apply_wallet
AFTER INSERT ON finance_withdrawals
BEGIN
  INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id)
  VALUES('wm-' || NEW.id, 'withdrawal:' || NEW.idempotency_key, NEW.journal_id, NEW.santri_id, 'JAJAN', -NEW.amount_rupiah, 'WITHDRAWAL', 'WITHDRAWAL', NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_no_update
BEFORE UPDATE ON finance_withdrawals BEGIN SELECT RAISE(ABORT, 'FINANCE_WITHDRAWAL_IMMUTABLE'); END;

CREATE TRIGGER IF NOT EXISTS trg_finance_withdrawal_no_delete
BEFORE DELETE ON finance_withdrawals BEGIN SELECT RAISE(ABORT, 'FINANCE_WITHDRAWAL_IMMUTABLE'); END;

-- =====================================================================
-- PENCAIRAN - maker-checker.
-- =====================================================================

-- Cooling period 24 jam dihapus. Yang TETAP: yang mengajukan tidak boleh
-- menyetujui, dan rekening penerima wajib sudah diverifikasi petugas lain.
CREATE TRIGGER IF NOT EXISTS trg_finance_payout_no_self_check
BEFORE UPDATE OF status ON finance_payouts
WHEN NEW.status IN ('DISETUJUI','DIBAYAR')
BEGIN
  SELECT CASE WHEN NEW.checker_id IS NULL
    THEN RAISE(ABORT, 'FINANCE_CHECKER_REQUIRED') END;
  SELECT CASE WHEN NEW.maker_id=NEW.checker_id
    THEN RAISE(ABORT, 'FINANCE_SELF_APPROVAL_FORBIDDEN') END;
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_recipients WHERE id=NEW.recipient_id),'') <> 'ACTIVE'
    THEN RAISE(ABORT, 'FINANCE_RECIPIENT_NOT_ACTIVE') END;
END;

-- =====================================================================
-- INDEX yang bergantung pada perilaku trigger di atas.
-- =====================================================================

-- Menjamin satu jurnal menyentuh tiap dompet santri paling banyak sekali,
-- yang membuat perhitungan balance_before/balance_after di
-- trg_finance_journal_apply_wallets bisa sesederhana di atas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_wallet_movement_per_journal
  ON finance_wallet_movements(journal_id, santri_id, wallet_kind);
