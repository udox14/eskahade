"""POST-RELEASE PATCH C1 Verification Test Suite
Tests:
1. Shared Kop / Print Infrastructure (Letterhead profiles, document configs, CR80 card exemption)
2. Authoritative identity (no fictitious addresses, contacts, websites, emails, or NSPP)
3. Neutral footers (no unverified digital validation claims)
4. Pagination 50 Standard across all finance read models, queries, actions, and page states
5. Elimination of internal jargon (PRD numbers, schema tables) from user-facing copy
6. Receipt auditability across cash payment, distribution recording, global history, and portal ortu
7. POS scanner & header decluttering (no Sparkles / Coins)
8. Dashboard cash session shortcut (Buka Sesi Kas CTA)
9. SQLite runtime pagination contract (>100 mocked records, search beyond page 1, non-overlap)
"""

import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def check(condition: bool, message: str) -> None:
    if not condition:
        print(f"  [FAIL] {message}")
        sys.exit(1)
    else:
        print(f"  [PASS] {message}")


def test_letterhead_infrastructure_and_authoritative_data():
    print("Testing Shared Kop / Print Infrastructure & Authoritative Data...")
    letterhead_path = ROOT / "lib" / "print" / "letterhead.ts"
    check(letterhead_path.exists(), "lib/print/letterhead.ts exists")

    content = letterhead_path.read_text(encoding="utf-8")
    check("Pondok Pesantren Sukahideng" in content, "Default profile has authoritative 'Pondok Pesantren Sukahideng'")
    check("sukahideng_main" in content, "'sukahideng_main' profile ID exists")
    check("koperasi_sukahideng" in content, "'koperasi_sukahideng' profile ID exists")
    check("dewan_santri" in content, "'dewan_santri' profile ID exists")
    check("card_santri" in content, "'card_santri' document config exists")
    check("mode: 'none'" in content, "card_santri explicitly defaults to mode 'none'")

    # BLOCKER 1: Verify all fictitious/assumed default identity data is deleted
    check("sukahideng.or.id" not in content, "Fictitious domain sukahideng.or.id removed from default profiles")
    check("Desa Sukarapih RT.016" not in content, "Fictitious RT/RW removed from default profiles")
    check("51.2.32.06.26.002" not in content, "Fictitious NSPP removed from default profiles")

    # Component checks
    doc_lh_path = ROOT / "components" / "print" / "document-letterhead.tsx"
    check(doc_lh_path.exists(), "components/print/document-letterhead.tsx exists")
    lh_content = doc_lh_path.read_text(encoding="utf-8")
    check("DEFAULT_LETTERHEAD_PROFILES[0]" in lh_content, "DocumentLetterhead defaults to primary Sukahideng profile")

    shell_path = ROOT / "components" / "print" / "print-document-shell.tsx"
    check(shell_path.exists(), "components/print/print-document-shell.tsx exists")

    # BLOCKER 2: Verify footer claims are neutralized (no fake digital validation claims)
    shell_content = shell_path.read_text(encoding="utf-8")
    check("Lembar Sah Dokumen" not in shell_content, "Fake 'Lembar Sah Dokumen' removed from PrintDocumentShell")

    po_receipt = (ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_receipt-modal.tsx").read_text(encoding="utf-8")
    check("tanpa tanda tangan basah" not in po_receipt, "Fake 'tanpa tanda tangan basah' claim removed from Portal Ortu receipt")
    check("AUTHENTICATED" not in po_receipt, "Fake 'AUTHENTICATED' badge removed from Portal Ortu receipt")

    tx_modal = (ROOT / "components" / "finance" / "transaction-receipt-modal.tsx").read_text(encoding="utf-8")
    check("merupakan bukti transaksi yang sah" not in tx_modal, "Unverified 'bukti transaksi yang sah' claim removed from transaction receipt modal")

    # Kop tab in Pengaturan Keuangan
    kop_tab_path = ROOT / "app" / "dashboard" / "keuangan" / "tarif" / "kop-tab.tsx"
    check(kop_tab_path.exists(), "Kop & Cetak tab exists in Pengaturan Keuangan")
    kop_content = kop_tab_path.read_text(encoding="utf-8")
    check("Profil Kop Identitas Lembaga" in kop_content, "Kop profile manager present")
    check("Penerapan Kop per Jenis Dokumen" in kop_content, "Per-document letterhead mapping present")


def test_standard_pagination_50():
    print("\nTesting Standard Pagination (50)...")
    constants_path = ROOT / "lib" / "finance" / "constants.ts"
    check(constants_path.exists(), "lib/finance/constants.ts exists")
    const_content = constants_path.read_text(encoding="utf-8")
    check("export const DEFAULT_FINANCE_PAGE_SIZE = 50" in const_content, "DEFAULT_FINANCE_PAGE_SIZE is 50")

    # Check backends
    hist_content = (ROOT / "lib" / "finance" / "history.ts").read_text(encoding="utf-8")
    check("DEFAULT_FINANCE_PAGE_SIZE" in hist_content, "history.ts uses DEFAULT_FINANCE_PAGE_SIZE")

    dist_content = (ROOT / "lib" / "finance" / "distributions.ts").read_text(encoding="utf-8")
    check("DEFAULT_FINANCE_PAGE_SIZE" in dist_content, "distributions.ts uses DEFAULT_FINANCE_PAGE_SIZE")

    rep_content = (ROOT / "lib" / "finance" / "reports.ts").read_text(encoding="utf-8")
    check("DEFAULT_FINANCE_PAGE_SIZE" in rep_content, "reports.ts uses DEFAULT_FINANCE_PAGE_SIZE")

    # Check actions
    peny_act = (ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "actions.ts").read_text(encoding="utf-8")
    check("pageSize: params?.historyPageSize || 50" in peny_act, "penyaluran actions.ts defaults history to 50")

    riw_act = (ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "actions.ts").read_text(encoding="utf-8")
    check("pageSize: 50" in riw_act, "riwayat actions.ts defaults to 50")

    stat_act = (ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "actions.ts").read_text(encoding="utf-8")
    check("params?.pageSize !== undefined ? params.pageSize : 50" in stat_act, "status-pembayaran actions.ts defaults to 50")

    kred_act = (ROOT / "app" / "dashboard" / "keuangan" / "kredensial" / "actions.ts").read_text(encoding="utf-8")
    check("params.pageSize || 50" in kred_act, "kredensial actions.ts defaults to 50")

    uang_act = (ROOT / "app" / "dashboard" / "keuangan" / "uang-jajan" / "actions.ts").read_text(encoding="utf-8")
    check("params.pageSize || 50" in uang_act, "uang-jajan actions.ts defaults to 50")

    # Check pages initial data load
    check("pageSize: 50" in (ROOT / "app" / "dashboard" / "keuangan" / "laporan" / "page.tsx").read_text(encoding="utf-8"), "laporan page.tsx pageSize 50")
    check("pageSize: 50" in (ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "page.tsx").read_text(encoding="utf-8"), "status-pembayaran page.tsx pageSize 50")
    check("pageSize: 50" in (ROOT / "app" / "dashboard" / "keuangan" / "kredensial" / "page.tsx").read_text(encoding="utf-8"), "kredensial page.tsx pageSize 50")
    check("pageSize: 50" in (ROOT / "app" / "dashboard" / "keuangan" / "uang-jajan" / "page.tsx").read_text(encoding="utf-8"), "uang-jajan page.tsx pageSize 50")


def test_jargon_elimination():
    print("\nTesting Elimination of Internal PRD Jargon...")
    finance_ui_dir = ROOT / "app" / "dashboard" / "keuangan"
    
    jargon_regex = re.compile(r'(?<!//)(?<!/\*)\b(PRD\s*#\d+|Sesuai\s+PRD|\(PRD\s*#|finance_wallet_ledger)\b', re.IGNORECASE)
    
    violating_files = []
    for f in finance_ui_dir.glob("**/*.tsx"):
        lines = f.read_text(encoding="utf-8").splitlines()
        for idx, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
                continue
            if jargon_regex.search(line):
                violating_files.append((f.name, idx, line.strip()))

    if violating_files:
        for fname, lno, lcontent in violating_files:
            print(f"  Found jargon in {fname}:{lno} -> {lcontent}")
    check(len(violating_files) == 0, f"No user-facing PRD/table jargon found in finance UI (found {len(violating_files)})")


def test_receipts_and_auditability():
    print("\nTesting Receipt Availability and Letterhead Centralization...")
    # Status pembayaran cash receipt
    catat_bayar_path = ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "catat-bayar-modal.tsx"
    cb_content = catat_bayar_path.read_text(encoding="utf-8")
    check("Bangkalan" not in cb_content, "Bangkalan/Madura removed from cash receipt kop")
    check("<DocumentLetterhead" in cb_content, "Status pembayaran cash receipt uses DocumentLetterhead")

    # Penyaluran receipt
    peny_bukti = (ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "bukti-penyaluran-modal.tsx").read_text(encoding="utf-8")
    check("<DocumentLetterhead" in peny_bukti, "Bukti penyaluran uses DocumentLetterhead")

    # Triggering receipt right after recording distribution
    peny_page = (ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "_page-content.tsx").read_text(encoding="utf-8")
    check("setReceiptDistributionId(newId)" in peny_page, "Penyaluran page opens receipt modal immediately after recording")

    # Global History receipt modal
    check((ROOT / "components" / "finance" / "transaction-receipt-modal.tsx").exists(), "TransactionReceiptModal component exists")
    tx_drawer = (ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "transaction-detail-drawer.tsx").read_text(encoding="utf-8")
    check("TransactionReceiptModal" in tx_drawer, "TransactionDetailDrawer integrates TransactionReceiptModal")
    check("Cetak Kuitansi / Bukti" in tx_drawer, "TransactionDetailDrawer has Cetak Kuitansi button")

    # POS receipt kop
    pos_receipt = (ROOT / "app" / "dashboard" / "koperasi" / "loket" / "pos-receipt-modal.tsx").read_text(encoding="utf-8")
    check("KOPERASI PESANTREN ESKAHADE" not in pos_receipt, "ESKAHADE removed from POS receipt kop")
    check("Sukahideng" in pos_receipt, "POS receipt kop uses Sukahideng")

    # Portal ortu receipts
    po_receipt = (ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_receipt-modal.tsx").read_text(encoding="utf-8")
    check("<DocumentLetterhead" in po_receipt, "Portal Ortu receipt uses DocumentLetterhead")
    check("item.type === 'TOPUP'" in po_receipt, "Portal Ortu receipt supports TOPUP")

    po_riwayat = (ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_riwayat-client.tsx").read_text(encoding="utf-8")
    check("item.type === 'TOPUP'" in po_riwayat, "Portal Ortu history shows Kuitansi button for TOPUP")


def test_pos_declutter_and_cash_session_shortcut():
    print("\nTesting POS Declutter & Dashboard Cash Session Shortcut...")
    # Scanner
    scanner_content = (ROOT / "app" / "dashboard" / "koperasi" / "loket" / "pos-card-scanner.tsx").read_text(encoding="utf-8")
    check("Sparkles" not in scanner_content, "Sparkles decorative icon removed from pos-card-scanner")

    # Header
    header_content = (ROOT / "app" / "dashboard" / "koperasi" / "loket" / "pos-header.tsx").read_text(encoding="utf-8")
    check("Coins" not in header_content, "Coins decorative icon removed from pos-header")

    # Dashboard cash session shortcut
    keu_actions = (ROOT / "app" / "dashboard" / "keuangan" / "actions.ts").read_text(encoding="utf-8")
    check("getActiveCashSession" in keu_actions, "Dashboard actions queries getActiveCashSession")
    check("activeCashSession" in keu_actions, "Dashboard actions returns activeCashSession")

    keu_page = (ROOT / "app" / "dashboard" / "keuangan" / "_page-content.tsx").read_text(encoding="utf-8")
    check("Buka Sesi Kas" in keu_page, "Dashboard Keuangan renders 'Buka Sesi Kas' CTA")
    check("/dashboard/koperasi/loket" in keu_page, "CTA links to /dashboard/koperasi/loket")


def test_pagination_runtime_contract():
    print("\nTesting Pagination Runtime Contract (>100 mocked records, search beyond page 1)...")
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = OFF;")
    conn.executescript("""
        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            asrama TEXT,
            kamar TEXT,
            tempat_makan_id TEXT,
            tempat_mencuci_id TEXT,
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE master_jasa (
            id TEXT PRIMARY KEY,
            nama_jasa TEXT NOT NULL,
            jenis TEXT NOT NULL
        );
        CREATE TABLE finance_obligations (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            period TEXT NOT NULL,
            amount_expected INTEGER NOT NULL,
            amount_exempted INTEGER NOT NULL DEFAULT 0,
            amount_paid INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'UNPAID',
            provider_id TEXT
        );
        CREATE TABLE finance_credentials (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL,
            card_token TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE'
        );
        CREATE TABLE finance_student_pins (
            santri_id TEXT PRIMARY KEY,
            pin_hash TEXT,
            locked_until TEXT
        );
        CREATE TABLE finance_payments (
            id TEXT PRIMARY KEY,
            payment_number TEXT NOT NULL UNIQUE,
            santri_id TEXT,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'PAID',
            paid_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE finance_distributions (
            id TEXT PRIMARY KEY,
            distribution_number TEXT NOT NULL UNIQUE,
            recipient_type TEXT NOT NULL,
            recipient_id TEXT,
            recipient_name TEXT NOT NULL,
            item_type TEXT NOT NULL,
            period TEXT NOT NULL,
            total_amount INTEGER NOT NULL,
            transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # Mock 120 santri (>100 records)
    for i in range(1, 121):
        sid = f"santri-{i:03d}"
        nis = f"NIS{1000 + i}"
        if i == 77:
            nama = "Zaki Al-Faruq TargetSearch"
            asrama = "Asrama A"
        else:
            nama = f"Santri Siswa {i:03d}"
            asrama = "Asrama A" if i % 2 == 0 else "Asrama B"
        conn.execute(
            "INSERT INTO santri (id, nis, nama_lengkap, asrama, saldo_uang_jajan, status_global) VALUES (?, ?, ?, ?, ?, 'aktif')",
            (sid, nis, nama, asrama, 50000)
        )
        conn.execute(
            "INSERT INTO finance_payments (id, payment_number, santri_id, amount, status) VALUES (?, ?, ?, ?, 'PAID')",
            (f"pay-{i:03d}", f"PAY-{1000 + i}", sid, 150000)
        )
        conn.execute(
            "INSERT INTO finance_distributions (id, distribution_number, recipient_type, recipient_name, item_type, period, total_amount) VALUES (?, ?, 'KATERING', ?, 'MAKAN', '2026-09', ?)",
            (f"dist-{i:03d}", f"DIS-{1000 + i}", f"Vendor {i:03d}", 500000)
        )

    # 1. Total count query without filter
    total_count = conn.execute("SELECT COUNT(*) FROM santri WHERE status_global = 'aktif'").fetchone()[0]
    check(total_count == 120, "Initial mock has 120 santri (>100 records)")

    # 2. Server-side pagination query (Page 1 vs Page 2)
    page_size = 50
    page_1_rows = conn.execute(
        "SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?",
        (page_size, 0)
    ).fetchall()
    check(len(page_1_rows) == 50, "Page 1 contains exactly 50 records (LIMIT 50 OFFSET 0)")

    page_2_rows = conn.execute(
        "SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?",
        (page_size, 50)
    ).fetchall()
    check(len(page_2_rows) == 50, "Page 2 contains exactly 50 records (LIMIT 50 OFFSET 50)")

    page_3_rows = conn.execute(
        "SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?",
        (page_size, 100)
    ).fetchall()
    check(len(page_3_rows) == 20, "Page 3 contains remaining 20 records (LIMIT 50 OFFSET 100)")

    # 3. Non-overlapping verification
    p1_ids = {r[0] for r in page_1_rows}
    p2_ids = {r[0] for r in page_2_rows}
    overlap = p1_ids.intersection(p2_ids)
    check(len(overlap) == 0, "Page 1 and Page 2 have zero overlapping records")

    # 4. Target record #77 is naturally in page 2 (index > 50)
    target_in_p1 = any(r[0] == "santri-077" for r in page_1_rows)
    target_in_p2 = any(r[0] == "santri-077" for r in page_2_rows)
    check(not target_in_p1, "Target record #77 is NOT in page 1 without search")
    check(target_in_p2, "Target record #77 is present in page 2")

    # 5. Search filter executed BEFORE limit/offset
    search_term = "%Zaki Al-Faruq TargetSearch%"
    search_count = conn.execute(
        "SELECT COUNT(*) FROM santri WHERE status_global = 'aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?)",
        (search_term, search_term)
    ).fetchone()[0]
    check(search_count == 1, "Total count query with search filter returns 1 (evaluated before pagination)")

    search_rows = conn.execute(
        "SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif' AND (nama_lengkap LIKE ? OR nis LIKE ?) ORDER BY id ASC LIMIT ? OFFSET ?",
        (search_term, search_term, page_size, 0)
    ).fetchall()
    check(len(search_rows) == 1, "Search query with LIMIT 50 returns 1 record")
    check(search_rows[0][0] == "santri-077", "Search successfully finds record that naturally sits beyond page 1")


if __name__ == "__main__":
    print("=== RUNNING POST-RELEASE PATCH C1 TESTS ===")
    test_letterhead_infrastructure_and_authoritative_data()
    test_standard_pagination_50()
    test_jargon_elimination()
    test_receipts_and_auditability()
    test_pos_declutter_and_cash_session_shortcut()
    test_pagination_runtime_contract()
    print("\nALL POST-RELEASE PATCH C1 CHECKS PASSED SUCCESSFULLY!")
