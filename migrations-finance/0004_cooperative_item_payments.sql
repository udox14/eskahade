-- Additive and rerunnable: never reset production data.
-- Apply ONLY to eskahade-finance/demo-finance. IF NOT EXISTS completes a prior partial apply.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS finance_coop_recipients (
 id TEXT PRIMARY KEY, source_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('PESANTREN','MAKAN','LAUNDRY')),
 name TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'CASH' CHECK(method IN ('CASH','TRANSFER')),
 bank_name TEXT, account_encrypted TEXT, account_mask TEXT, account_holder TEXT,
 UNIQUE(kind,source_id)
);
INSERT OR IGNORE INTO finance_coop_recipients(id,kind,name) VALUES('pesantren','PESANTREN','Bendahara Pesantren');
CREATE TABLE IF NOT EXISTS finance_coop_user_units (user_id TEXT NOT NULL,recipient_id TEXT NOT NULL REFERENCES finance_coop_recipients(id),PRIMARY KEY(user_id,recipient_id));
CREATE TABLE IF NOT EXISTS finance_coop_tariffs (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY')),
 title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),
 effective_month TEXT NOT NULL, recurring INTEGER NOT NULL DEFAULT 1 CHECK(recurring IN (0,1)),created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_coop_bills (
 id TEXT PRIMARY KEY,santri_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY')),
 title TEXT NOT NULL,period_key TEXT,tariff_id TEXT,recipient_id TEXT NOT NULL REFERENCES finance_coop_recipients(id),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=amount),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PARTIAL','PAID','VOID')),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(santri_id,tariff_id,period_key)
);
CREATE INDEX IF NOT EXISTS finance_coop_bills_student ON finance_coop_bills(santri_id,status);
CREATE TABLE IF NOT EXISTS finance_student_va (
 santri_id TEXT PRIMARY KEY,va_number TEXT NOT NULL UNIQUE,customer_no TEXT NOT NULL UNIQUE,
 provider_trx_id TEXT, status TEXT NOT NULL DEFAULT 'NEW',updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS finance_orders (
 id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL DEFAULT '',santri_id TEXT NOT NULL,actor_id TEXT NOT NULL,
 channel TEXT NOT NULL CHECK(channel IN ('VA','CASH')),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),fee INTEGER NOT NULL CHECK(typeof(fee)='integer' AND fee>=0),
 total INTEGER NOT NULL CHECK(total=amount+fee),
 status TEXT NOT NULL DEFAULT 'PREPARING' CHECK(status IN ('PREPARING','PENDING','PAID','CANCELLED','REVIEW','REVERSED')),
 expires_at TEXT NOT NULL,va_number TEXT,provider_reference TEXT UNIQUE,journal_id TEXT REFERENCES finance_journals(id),
 shift_id TEXT REFERENCES finance_cash_shifts(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),paid_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_order_one_active ON finance_orders(santri_id) WHERE status IN ('PREPARING','PENDING','REVIEW');
CREATE TABLE IF NOT EXISTS finance_order_items (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES finance_orders(id),bill_id TEXT REFERENCES finance_coop_bills(id),
 kind TEXT NOT NULL CHECK(kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY','JAJAN')),title TEXT NOT NULL,
 recipient_id TEXT REFERENCES finance_coop_recipients(id),amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),
 policy TEXT NOT NULL CHECK(policy IN ('FULL','INSTALLMENT')),UNIQUE(order_id,bill_id),
 CHECK((kind='JAJAN' AND bill_id IS NULL AND recipient_id IS NULL) OR (kind<>'JAJAN' AND bill_id IS NOT NULL AND recipient_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS finance_entitlements (
 id TEXT PRIMARY KEY,order_item_id TEXT NOT NULL UNIQUE REFERENCES finance_order_items(id),recipient_id TEXT NOT NULL REFERENCES finance_coop_recipients(id),
 amount INTEGER NOT NULL CHECK(amount>0),paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=amount),reversed INTEGER NOT NULL DEFAULT 0 CHECK(reversed IN (0,1)),
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS finance_distributions (
 id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL DEFAULT '',recipient_id TEXT NOT NULL REFERENCES finance_coop_recipients(id),
 gross INTEGER NOT NULL CHECK(typeof(gross)='integer' AND gross>0),fee INTEGER NOT NULL CHECK(typeof(fee)='integer' AND fee>=0),
 fee_bearer TEXT NOT NULL CHECK(fee_bearer IN ('KOPERASI','PENERIMA')),net INTEGER NOT NULL CHECK(net>0 AND net=gross-CASE WHEN fee_bearer='PENERIMA' THEN fee ELSE 0 END),
 method TEXT NOT NULL CHECK(method IN ('CASH','TRANSFER')),recipient_snapshot TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PAID','CANCELLED')),
 reference TEXT,proof_url TEXT,received_by TEXT,actor_id TEXT NOT NULL,shift_id TEXT REFERENCES finance_cash_shifts(id),
 journal_id TEXT REFERENCES finance_journals(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),paid_at TEXT
);
CREATE TABLE IF NOT EXISTS finance_distribution_items (
 distribution_id TEXT NOT NULL REFERENCES finance_distributions(id),entitlement_id TEXT NOT NULL REFERENCES finance_entitlements(id),
 amount INTEGER NOT NULL CHECK(amount>0),PRIMARY KEY(distribution_id,entitlement_id)
);
CREATE TABLE IF NOT EXISTS finance_cash_entries (
 id TEXT PRIMARY KEY,shift_id TEXT NOT NULL REFERENCES finance_cash_shifts(id),journal_id TEXT NOT NULL UNIQUE REFERENCES finance_journals(id),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount<>0),created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS finance_payment_exceptions (
 id TEXT PRIMARY KEY,event_key TEXT NOT NULL UNIQUE,order_id TEXT REFERENCES finance_orders(id),reason TEXT NOT NULL,payload_json TEXT NOT NULL,
 resolution TEXT,resolved_by TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS finance_snap_events (event_key TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES finance_orders(id),created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS finance_coop_reconciliations (
 id TEXT PRIMARY KEY,period_key TEXT NOT NULL,statement_reference TEXT NOT NULL,actual_bank INTEGER NOT NULL,book_bank INTEGER NOT NULL,
 note TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
INSERT OR IGNORE INTO finance_accounts(id,code,name,account_type,normal_balance) VALUES('fa-pesantren-payable','2106','Hak Bendahara Pesantren','LIABILITY','CREDIT');
INSERT OR IGNORE INTO finance_settings(key,value) VALUES('cooperative_settings','{"paymentPolicy":"FULL","overrides":{},"transferFeeBearer":"KOPERASI","gatewayFee":0,"onlineEnabled":false}');

CREATE TRIGGER IF NOT EXISTS finance_coop_item_validate BEFORE INSERT ON finance_order_items BEGIN
 SELECT CASE WHEN (SELECT status FROM finance_orders WHERE id=NEW.order_id)<>'PREPARING' THEN RAISE(ABORT,'Pesanan sudah dikunci.') END;
 SELECT CASE WHEN NEW.bill_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM finance_coop_bills b JOIN finance_orders o ON o.id=NEW.order_id WHERE b.id=NEW.bill_id AND b.santri_id=o.santri_id
 AND b.recipient_id=NEW.recipient_id AND b.kind=NEW.kind AND b.status IN ('OPEN','PARTIAL') AND NEW.amount<=b.amount-b.paid
 AND (NEW.policy='INSTALLMENT' OR NEW.amount=b.amount-b.paid)) THEN RAISE(ABORT,'Tagihan berubah atau bukan milik santri.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_order_post BEFORE UPDATE OF status ON finance_orders WHEN NEW.status='PAID' BEGIN
 SELECT CASE WHEN OLD.status NOT IN ('PREPARING','PENDING') THEN RAISE(ABORT,'Pembayaran tidak dapat dibukukan ulang.') END;
 SELECT CASE WHEN NEW.journal_id IS NULL OR NOT EXISTS(SELECT 1 FROM finance_journals WHERE id=NEW.journal_id AND status='POSTED') THEN RAISE(ABORT,'Jurnal pembayaran belum selesai.') END;
 SELECT CASE WHEN NEW.amount<>COALESCE((SELECT SUM(amount) FROM finance_order_items WHERE order_id=NEW.id),0) THEN RAISE(ABORT,'Total item tidak cocok.') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_order_items i JOIN finance_coop_bills b ON b.id=i.bill_id WHERE i.order_id=NEW.id AND (b.status NOT IN ('OPEN','PARTIAL') OR b.paid+i.amount>b.amount OR (i.policy='FULL' AND b.paid+i.amount<>b.amount))) THEN RAISE(ABORT,'Tagihan sudah berubah.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_order_apply AFTER UPDATE OF status ON finance_orders WHEN NEW.status='PAID' BEGIN
 UPDATE finance_coop_bills SET paid=paid+(SELECT i.amount FROM finance_order_items i WHERE i.order_id=NEW.id AND i.bill_id=finance_coop_bills.id),
 status=CASE WHEN paid+(SELECT i.amount FROM finance_order_items i WHERE i.order_id=NEW.id AND i.bill_id=finance_coop_bills.id)=amount THEN 'PAID' ELSE 'PARTIAL' END
 WHERE id IN(SELECT bill_id FROM finance_order_items WHERE order_id=NEW.id);
 INSERT INTO finance_entitlements(id,order_item_id,recipient_id,amount) SELECT 'ent-'||id,id,recipient_id,amount FROM finance_order_items WHERE order_id=NEW.id AND recipient_id IS NOT NULL;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_order_immutable BEFORE UPDATE ON finance_orders WHEN (OLD.status='REVERSED' OR (OLD.status='PAID' AND NEW.status<>'REVERSED')) BEGIN SELECT RAISE(ABORT,'Pembayaran selesai tidak dapat diubah.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_item_no_update BEFORE UPDATE ON finance_order_items BEGIN SELECT RAISE(ABORT,'Item pesanan tidak dapat diubah.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_item_no_delete BEFORE DELETE ON finance_order_items BEGIN SELECT RAISE(ABORT,'Item pesanan tidak dapat dihapus.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_item BEFORE INSERT ON finance_distribution_items BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_entitlements e JOIN finance_distributions d ON d.id=NEW.distribution_id WHERE e.id=NEW.entitlement_id AND e.recipient_id=d.recipient_id AND e.reversed=0 AND d.status='DRAFT' AND NEW.amount<=e.amount-e.paid-COALESCE((SELECT SUM(i.amount) FROM finance_distribution_items i JOIN finance_distributions pending ON pending.id=i.distribution_id WHERE i.entitlement_id=e.id AND pending.status='DRAFT'),0)) THEN RAISE(ABORT,'Hak penerima tidak mencukupi.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_pay BEFORE UPDATE OF status ON finance_distributions WHEN NEW.status='PAID' BEGIN
 SELECT CASE WHEN OLD.status<>'DRAFT' OR NEW.journal_id IS NULL OR NEW.reference IS NULL OR NEW.reference='' THEN RAISE(ABORT,'Pencairan belum lengkap atau sudah selesai.') END;
 SELECT CASE WHEN NEW.gross<>COALESCE((SELECT SUM(amount) FROM finance_distribution_items WHERE distribution_id=NEW.id),0) THEN RAISE(ABORT,'Rincian pencairan tidak cocok.') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_distribution_items i JOIN finance_entitlements e ON e.id=i.entitlement_id WHERE i.distribution_id=NEW.id AND (e.reversed=1 OR e.paid+i.amount>e.amount)) THEN RAISE(ABORT,'Hak sudah dicairkan.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_apply AFTER UPDATE OF status ON finance_distributions WHEN NEW.status='PAID' BEGIN
 UPDATE finance_entitlements SET paid=paid+(SELECT i.amount FROM finance_distribution_items i WHERE i.distribution_id=NEW.id AND i.entitlement_id=finance_entitlements.id) WHERE id IN(SELECT entitlement_id FROM finance_distribution_items WHERE distribution_id=NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_immutable BEFORE UPDATE ON finance_distributions WHEN OLD.status='PAID' BEGIN SELECT RAISE(ABORT,'Pencairan selesai tidak dapat diubah.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_cash_validate BEFORE INSERT ON finance_cash_entries BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_cash_shifts WHERE id=NEW.shift_id AND status='OPEN') THEN RAISE(ABORT,'Shift tidak aktif.') END;
 SELECT CASE WHEN NEW.amount<0 AND COALESCE((SELECT opening_cash_rupiah FROM finance_cash_shifts WHERE id=NEW.shift_id),0)+COALESCE((SELECT SUM(amount) FROM finance_cash_entries WHERE shift_id=NEW.shift_id),0)+NEW.amount<0 THEN RAISE(ABORT,'Kas loket tidak mencukupi.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_cash_no_update BEFORE UPDATE ON finance_cash_entries BEGIN SELECT RAISE(ABORT,'Mutasi kas tidak dapat diubah.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_cash_no_delete BEFORE DELETE ON finance_cash_entries BEGIN SELECT RAISE(ABORT,'Mutasi kas tidak dapat dihapus.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_audit_no_update BEFORE UPDATE ON finance_audit_log BEGIN SELECT RAISE(ABORT,'Audit immutable.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_audit_no_delete BEFORE DELETE ON finance_audit_log BEGIN SELECT RAISE(ABORT,'Audit immutable.'); END;
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_live_qr ON student_credentials(santri_id) WHERE status IN ('ACTIVE','BLOCKED');
CREATE TRIGGER IF NOT EXISTS finance_qr_terminal_status BEFORE UPDATE OF status ON student_credentials WHEN OLD.status IN ('LOST','REVOKED') AND NEW.status<>OLD.status BEGIN SELECT RAISE(ABORT,'Kartu telah dicabut permanen.'); END;

CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_items_no_update BEFORE UPDATE ON finance_distribution_items BEGIN SELECT RAISE(ABORT,'Rincian pencairan immutable.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_distribution_items_no_delete BEFORE DELETE ON finance_distribution_items BEGIN SELECT RAISE(ABORT,'Rincian pencairan immutable.'); END;
CREATE TRIGGER IF NOT EXISTS finance_coop_order_reverse BEFORE UPDATE OF status ON finance_orders WHEN NEW.status='REVERSED' BEGIN
 SELECT CASE WHEN OLD.status<>'PAID' OR NOT EXISTS(SELECT 1 FROM finance_journals WHERE reversal_of_id=OLD.journal_id AND status='POSTED') THEN RAISE(ABORT,'Jurnal pembalik wajib tersedia.') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_entitlements e JOIN finance_order_items i ON i.id=e.order_item_id WHERE i.order_id=NEW.id AND (e.paid>0 OR EXISTS(SELECT 1 FROM finance_distribution_items di JOIN finance_distributions d ON d.id=di.distribution_id WHERE di.entitlement_id=e.id AND d.status='DRAFT'))) THEN RAISE(ABORT,'Dana sudah dicairkan atau dipesan untuk pencairan.') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_coop_order_reverse_apply AFTER UPDATE OF status ON finance_orders WHEN NEW.status='REVERSED' BEGIN
 UPDATE finance_coop_bills SET paid=paid-(SELECT amount FROM finance_order_items WHERE order_id=NEW.id AND bill_id=finance_coop_bills.id),status=CASE WHEN paid-(SELECT amount FROM finance_order_items WHERE order_id=NEW.id AND bill_id=finance_coop_bills.id)=0 THEN 'OPEN' ELSE 'PARTIAL' END WHERE id IN(SELECT bill_id FROM finance_order_items WHERE order_id=NEW.id);
 UPDATE finance_entitlements SET reversed=1 WHERE order_item_id IN(SELECT id FROM finance_order_items WHERE order_id=NEW.id);
END;
CREATE UNIQUE INDEX IF NOT EXISTS finance_coop_bill_period ON finance_coop_bills(santri_id,period_key) WHERE tariff_id IS NOT NULL;
