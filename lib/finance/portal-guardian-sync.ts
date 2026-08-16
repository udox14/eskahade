// lib/finance/portal-guardian-sync.ts
//
// Sinkronkan password_hash guardian Keuangan Terpusat mengikuti perubahan
// password akun portal santri (ganti mandiri / reset admin). Tanpa ini,
// reauth kenaikan limit pencairan & atur PIN santri (lib/finance/...) tetap
// memverifikasi password DEFAULT lama selamanya, walau ortu sudah ganti
// password di portal — lihat app/api/portal-ortu/login/route.ts yang hanya
// menyalin hash ke finance_guardians SEKALI saat migrasi login pertama.

import { getFinanceDB as getDB } from '@/lib/db'

export async function syncGuardianPasswordHash(santriId: string, passwordHash: string): Promise<void> {
  const db = await getDB()
  await db.prepare(`
    UPDATE finance_guardians SET password_hash=?, updated_at=datetime('now')
    WHERE legacy_santri_id=? AND status='ACTIVE'
  `).bind(passwordHash, santriId).run()
}
