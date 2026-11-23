// Pembangun notifikasi untuk alur persetujuan non-keuangan & setoran SPP (NOTIF-5).
// Pola sama dengan finance-events: statement dijaga EXISTS pada baris hasil tulis yang sama,
// dibungkus safeNotices() (skema belum siap / error → tanpa notifikasi, tulis data tetap jalan).

import { periodLabel } from './finance-events'
import { dedupeKeyPart, notifyStatement } from './outbox'
import type { SqlStatement } from './types'

/** Nama unit bisa berspasi. */
const keyPart = dedupeKeyPart

const jenisIzin = (jenis: string | null | undefined) => jenis === 'PULANG' ? 'izin pulang' : 'izin keluar kompleks'

function keperluan(jenis: string | null | undefined, alasan: string | null | undefined) {
  const reason = String(alasan ?? '').replace(/\s+/g, ' ').trim()
  return reason ? `${jenisIzin(jenis)} (${reason.slice(0, 80)})` : jenisIzin(jenis)
}

// ── Perizinan ─────────────────────────────────────────────────────────

export function izinSubmittedNotices(p: { pengajuanId: string; santriId: string; namaSantri: string; asrama: string | null; jenis: string; alasan: string | null; actorId: string | null }): SqlStatement[] {
  return [notifyStatement('STAFF_IZIN_DIAJUKAN', `IZIN_SUBMITTED:${p.pengajuanId}`, {
    santri_id: p.santriId, nama_santri: p.namaSantri, asrama: p.asrama ?? '-',
    keperluan: keperluan(p.jenis, p.alasan), actor_user_id: p.actorId,
  }, { sql: "SELECT 1 FROM perizinan_pengajuan WHERE id = ? AND status = 'PENDING'", params: [p.pengajuanId] })]
}

export function izinDecidedNotices(p: { pengajuanId: string; namaSantri: string; jenis: string; alasan: string | null; submittedBy: string | null; decision: 'APPROVED' | 'REJECTED' }): SqlStatement[] {
  if (!p.submittedBy) return []
  return [notifyStatement('STAFF_IZIN_DIPUTUSKAN', `IZIN_DECIDED:${p.pengajuanId}`, {
    nama_santri: p.namaSantri, keperluan: keperluan(p.jenis, p.alasan),
    keputusan: p.decision === 'APPROVED' ? 'disetujui' : 'ditolak', actor_user_id: p.submittedBy,
  }, { sql: 'SELECT 1 FROM perizinan_pengajuan WHERE id = ? AND status = ?', params: [p.pengajuanId, p.decision] })]
}

// ── Setoran SPP ───────────────────────────────────────────────────────

const setoranGuard = (unit: string, tahun: number, bulan: number, tujuan: string, status: string) => ({
  sql: `SELECT 1 FROM spp_setoran WHERE COALESCE(NULLIF(TRIM(unit_setor), ''), asrama) = ? AND tahun = ? AND bulan = ?
        AND tujuan_setoran = ? AND status = ?`,
  params: [unit, tahun, bulan, tujuan, status],
})

const periode = (tahun: number, bulan: number) => periodLabel(`${tahun}-${String(bulan).padStart(2, '0')}`)

export function setoranSubmittedNotices(p: { unit: string; tahun: number; bulan: number; jumlah: number; tujuan: 'BENDAHARA_PUSAT' | 'DEWAN_SANTRI'; actorId: string | null; stamp: string }): SqlStatement[] {
  const code = p.tujuan === 'BENDAHARA_PUSAT' ? 'STAFF_SETORAN_SPP_MENUNGGU' : 'STAFF_SETORAN_DEWAN_MENUNGGU'
  // Setoran bisa dikirim ulang (upsert) → dedupe per pengiriman.
  return [notifyStatement(code, `SETORAN_SUBMITTED:${p.tujuan}:${keyPart(p.unit)}:${p.tahun}-${p.bulan}:${p.stamp}`, {
    asrama: p.unit, periode: periode(p.tahun, p.bulan), nominal: p.jumlah, actor_user_id: p.actorId,
  }, setoranGuard(p.unit, p.tahun, p.bulan, p.tujuan, 'menunggu_konfirmasi'))]
}

export function setoranConfirmedNotices(p: { unit: string; tahun: number; bulan: number; jumlah: number; tujuan: 'BENDAHARA_PUSAT' | 'DEWAN_SANTRI'; actorId: string | null; stamp: string }): SqlStatement[] {
  return [notifyStatement('STAFF_SETORAN_SPP_DIKONFIRMASI', `SETORAN_CONFIRMED:${p.tujuan}:${keyPart(p.unit)}:${p.tahun}-${p.bulan}:${p.stamp}`, {
    asrama: p.unit, periode: periode(p.tahun, p.bulan), nominal: p.jumlah,
    pihak: p.tujuan === 'BENDAHARA_PUSAT' ? 'Bendahara Pesantren' : 'Dewan Santri', actor_user_id: p.actorId,
  }, setoranGuard(p.unit, p.tahun, p.bulan, p.tujuan, 'dikonfirmasi'))]
}

// ── Santri keluar ─────────────────────────────────────────────────────

export function keluarSubmittedNotices(p: { pengajuanId: string; namaSantri: string; asrama: string; actorId: string; stamp: string }): SqlStatement[] {
  return [notifyStatement('STAFF_SANTRI_KELUAR_DIAJUKAN', `KELUAR_SUBMITTED:${p.pengajuanId}:${p.stamp}`, {
    nama_santri: p.namaSantri, asrama: p.asrama, actor_user_id: p.actorId,
    // Baris baru hanya mengisi created_at; tandai ulang mengisi updated_at.
  }, { sql: "SELECT 1 FROM santri_keluar_tandai WHERE id = ? AND status = 'pending' AND (updated_at = ? OR created_at = ?)", params: [p.pengajuanId, p.stamp, p.stamp] })]
}

export function keluarDecidedNotices(p: { pengajuanId: string; namaSantri: string; submittedBy: string | null; decision: 'disetujui' | 'ditolak'; catatan?: string | null }): SqlStatement[] {
  if (!p.submittedBy) return []
  return [notifyStatement('STAFF_SANTRI_KELUAR_DIPUTUSKAN', `KELUAR_DECIDED:${p.pengajuanId}`, {
    nama_santri: p.namaSantri, keputusan: p.decision, catatan: String(p.catatan ?? '').trim() || 'tidak ada', actor_user_id: p.submittedBy,
  }, { sql: 'SELECT 1 FROM santri_keluar_tandai WHERE id = ? AND status = ?', params: [p.pengajuanId, p.decision] })]
}
