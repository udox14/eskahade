-- Index performa modul Monitoring Pimpinan (read-only) pada FINANCE_DB.

-- finance_journal_entries: query arus kas (bulanan & tren 30 hari) JOIN
-- finance_journals via journal_id. Tabel entries immutable (trigger blokir
-- update/delete), sehingga index ini aman dan sangat membantu.
CREATE INDEX IF NOT EXISTS idx_finance_entry_journal
  ON finance_journal_entries(journal_id);
