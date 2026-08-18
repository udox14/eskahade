#!/usr/bin/env bash
# Menerapkan skema Keuangan Terpusat yang baru ke satu database D1.
#
#   bash scripts/apply-finance-migration.sh eskahade-demo-finance
#   bash scripts/apply-finance-migration.sh eskahade-finance
#
# Kenapa skrip, bukan satu berkas SQL raksasa: pada 16 Agustus 2026 migrasi 0007
# gagal separuh jalan di produksi dan menghilangkan tabel finance_bills. Skrip ini
# menjalankan tiap berkas sebagai perintah --file terpisah dan BERHENTI di
# kegagalan pertama, supaya tidak ada berkas berikutnya yang jalan di atas skema
# yang sudah rusak sebagian.
#
# Urutan berkas tidak boleh diacak: seluruh tabel dibuat lebih dulu, seluruh
# trigger paling akhir. SQLite membuat trigger tanpa memvalidasi tabel yang hanya
# disebut di dalam body-nya, jadi trigger yang dibuat terlalu awal akan
# "menggantung" dan baru meledak belakangan.

set -euo pipefail

DB="${1:-}"
if [ -z "$DB" ]; then
  echo "Pemakaian: bash scripts/apply-finance-migration.sh <nama-database-d1>"
  echo "Contoh   : bash scripts/apply-finance-migration.sh eskahade-demo-finance"
  exit 1
fi

BERKAS=(
  0001a_drop_legacy
  0001b_tables_core
  0001c_tables_billing
  0001d_tables_loket
  0001e_tables_payout
  0001f_tables_support
  0001g_triggers
  0001h_seed
)

echo "Menerapkan skema keuangan ke: $DB"
echo "Jumlah berkas: ${#BERKAS[@]}"
echo

for i in "${!BERKAS[@]}"; do
  nama="${BERKAS[$i]}"
  printf '[%d/%d] %s ... ' "$((i + 1))" "${#BERKAS[@]}" "$nama"
  if npx wrangler d1 execute "$DB" --remote --file "migrations-finance/${nama}.sql" > /tmp/finmig.log 2>&1; then
    echo "OK"
  else
    echo "GAGAL"
    echo
    echo "--- keluaran wrangler ---"
    tail -30 /tmp/finmig.log
    echo
    echo "BERHENTI. Jangan jalankan berkas berikutnya dan jangan menambal manual."
    echo "Pulihkan dari export lalu ulangi dari awal."
    exit 1
  fi
done

echo
echo "Verifikasi struktur:"
npx wrangler d1 execute "$DB" --remote \
  --command "SELECT type, COUNT(*) jumlah FROM sqlite_master WHERE name LIKE 'finance_%' OR name='student_credentials' GROUP BY type;"

echo
echo "Yang harus terlihat: 37 tabel dan 21 trigger."
echo "Kalau angkanya meleset, JANGAN lanjut ke deploy - pulihkan dari export."
