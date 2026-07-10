'use server'

import { revalidatePath } from 'next/cache'
import { execute, generateId, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { uploadToR2 } from '@/lib/r2/upload'
import { requirePortalSessionAction } from '@/lib/portal/session'
import { getTunggakanSppSantri } from '@/lib/spp/tunggakan'
import { getNonSppOutstandingSantri, NON_SPP_JENIS_ALL, type NonSppJenis } from '@/lib/keuangan/non-spp-outstanding'
import { getPaymentChannels, getPendingSubmission } from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'

const PORTAL_PATHS = ['/portal-ortu/tagihan', '/portal-ortu/riwayat', '/portal-ortu/beranda']

// Detail item yang disimpan di detail_json — nominal SELALU hasil hitung server
export type SppDetailItem = {
  source: 'BERJALAN' | 'HISTORIS'
  historis_id: string | null
  tahun: number
  bulan: number
  nominal: number
}
export type NonSppDetailItem = {
  jenis_biaya: NonSppJenis
  tahun_ajaran_id: number
  tahun_tagihan: number | null
  nominal: number
}

// Kunci item dari client:
//   SPP     → 'B:<tahun>-<bulan>' (berjalan) | 'H:<historis_id>'
//   NON_SPP → '<jenis_biaya>'
export async function createSubmission(input: {
  kategori: 'SPP' | 'NON_SPP'
  itemKeys: string[]
  metode: 'TRANSFER' | 'QRIS'
  bankId?: string | null
  catatan?: string | null
}): Promise<{ success: true; submissionId: string; jumlah: number } | { error: string }> {
  try {
    const session = await requirePortalSessionAction()

    const kategori = input.kategori === 'NON_SPP' ? 'NON_SPP' : 'SPP'
    const metode = input.metode === 'QRIS' ? 'QRIS' : 'TRANSFER'
    const itemKeys = Array.from(new Set((input.itemKeys || []).map(String)))
    if (!itemKeys.length) return { error: 'Pilih tagihan yang akan dibayar terlebih dahulu.' }

    const pending = await getPendingSubmission(session.santri_id, kategori)
    if (pending) {
      return { error: 'Masih ada pengajuan yang menunggu konfirmasi. Tunggu atau batalkan dulu pengajuan tersebut.' }
    }

    const channels = await getPaymentChannels()
    let bankSnapshot: string | null = null
    if (metode === 'TRANSFER') {
      const bank = channels.banks.find(b => b.id === String(input.bankId || ''))
      if (!bank) return { error: 'Pilih rekening tujuan transfer.' }
      bankSnapshot = JSON.stringify(bank)
    } else if (!channels.qris_url) {
      return { error: 'Pembayaran QRIS belum tersedia. Gunakan transfer bank.' }
    }

    // Hitung ulang item terpilih dari data tagihan live (jangan percaya client)
    let detail: SppDetailItem[] | NonSppDetailItem[]
    let jumlah = 0

    if (kategori === 'SPP') {
      if (session.bebas_spp) return { error: 'Santri ini berstatus bebas SPP.' }
      if (isAsramaTanpaKamar(session.asrama)) return { error: 'Asrama santri ini tidak memiliki kewajiban SPP.' }

      const tunggakan = await getTunggakanSppSantri(session.santri_id)
      const byKey = new Map<string, SppDetailItem>()
      tunggakan.items.forEach(item => {
        const key = item.source === 'HISTORIS' ? `H:${item.id}` : `B:${item.tahun}-${item.bulan}`
        byKey.set(key, {
          source: item.source,
          historis_id: item.id,
          tahun: item.tahun,
          bulan: item.bulan,
          nominal: item.nominal,
        })
      })
      const picked: SppDetailItem[] = []
      for (const key of itemKeys) {
        const item = byKey.get(key)
        if (!item) return { error: 'Ada bulan yang sudah tidak tertagih lagi. Muat ulang halaman lalu pilih kembali.' }
        picked.push(item)
      }
      detail = picked
      jumlah = picked.reduce((sum, item) => sum + item.nominal, 0)
    } else {
      const outstanding = await getNonSppOutstandingSantri(session.santri_id)
      if (!outstanding) return { error: 'Tahun ajaran aktif belum diatur. Hubungi admin pesantren.' }
      const picked: NonSppDetailItem[] = []
      for (const key of itemKeys) {
        if (!(NON_SPP_JENIS_ALL as readonly string[]).includes(key)) {
          return { error: 'Jenis biaya tidak dikenal. Muat ulang halaman lalu pilih kembali.' }
        }
        const item = outstanding.items.find(i => i.jenis === key)
        if (!item || item.sisa <= 0) {
          return { error: `Tagihan ${key} sudah lunas atau tidak tersedia. Muat ulang halaman.` }
        }
        picked.push({
          jenis_biaya: item.jenis,
          tahun_ajaran_id: item.tahun_ajaran_id,
          tahun_tagihan: item.tahun_tagihan,
          nominal: item.sisa,
        })
      }
      detail = picked
      jumlah = picked.reduce((sum, item) => sum + item.nominal, 0)
    }

    if (jumlah <= 0) return { error: 'Total tagihan tidak valid.' }

    const id = generateId()
    try {
      await execute(`
        INSERT INTO portal_payment_submission
          (id, santri_id, kategori, detail_json, jumlah, metode, bank_tujuan, catatan_ortu, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_konfirmasi')
      `, [
        id,
        session.santri_id,
        kategori,
        JSON.stringify(detail),
        jumlah,
        metode,
        bankSnapshot,
        String(input.catatan || '').trim() || null,
      ])
    } catch (err: any) {
      // Backstop race: partial unique index uq_portal_submission_pending
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        return { error: 'Masih ada pengajuan yang menunggu konfirmasi untuk kategori ini.' }
      }
      throw err
    }

    await logActivity({
      actor: { name: `Ortu ${session.nama}` },
      module: 'portal_ortu',
      action: 'create_submission',
      entityType: 'portal_payment_submission',
      entityId: id,
      entityLabel: session.nama,
      summary: `Ortu mengajukan pembayaran ${kategori} ${jumlah} via ${metode} (${session.nama})`,
      details: { santri_id: session.santri_id, kategori, metode, jumlah, detail },
    })

    PORTAL_PATHS.forEach(p => revalidatePath(p))
    return { success: true, submissionId: id, jumlah }
  } catch (err: any) {
    return { error: err?.message || 'Gagal membuat pengajuan.' }
  }
}

export async function uploadBukti(formData: FormData): Promise<{ success: true } | { error: string }> {
  try {
    const session = await requirePortalSessionAction()

    const submissionId = String(formData.get('submissionId') || '')
    const file = formData.get('bukti')
    if (!submissionId) return { error: 'Pengajuan tidak valid.' }
    if (!(file instanceof File) || file.size === 0) return { error: 'Pilih foto bukti pembayaran.' }
    if (!file.type.startsWith('image/')) return { error: 'Bukti harus berupa gambar.' }
    if (file.size > 2 * 1024 * 1024) return { error: 'Ukuran bukti maksimal 2MB.' }

    const submission = await queryOne<{ id: string; status: string; bukti_url: string | null }>(`
      SELECT id, status, bukti_url FROM portal_payment_submission
      WHERE id = ? AND santri_id = ?
    `, [submissionId, session.santri_id])
    if (!submission) return { error: 'Pengajuan tidak ditemukan.' }
    if (submission.status !== 'menunggu_konfirmasi' && submission.status !== 'ditolak') {
      return { error: 'Pengajuan ini sudah diproses dan tidak bisa diubah lagi.' }
    }

    // Key: bukti-portal/<submissionId>_<timestamp>.<ext> — tidak bisa ditebak.
    // /api/file/[...key] memang publik; risiko diterima (lihat rencana portal ortu).
    const uploaded = await uploadToR2(file, submissionId, 'bukti-portal')
    if ('error' in uploaded) return { error: uploaded.error }

    // Upload ulang setelah ditolak memakai row yang sama: reset ke menunggu
    await execute(`
      UPDATE portal_payment_submission
      SET bukti_url = ?, status = 'menunggu_konfirmasi',
          rejected_by = NULL, rejected_at = NULL, reject_reason = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `, [uploaded.url, submissionId])

    await logActivity({
      actor: { name: `Ortu ${session.nama}` },
      module: 'portal_ortu',
      action: 'upload_bukti',
      entityType: 'portal_payment_submission',
      entityId: submissionId,
      entityLabel: session.nama,
      summary: `Ortu mengunggah bukti pembayaran (${session.nama})`,
      details: { santri_id: session.santri_id, resubmit: submission.status === 'ditolak' },
    })

    PORTAL_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Gagal mengunggah bukti.' }
  }
}

export async function cancelSubmission(submissionId: string): Promise<{ success: true } | { error: string }> {
  try {
    const session = await requirePortalSessionAction()

    const submission = await queryOne<{ id: string; status: string }>(`
      SELECT id, status FROM portal_payment_submission
      WHERE id = ? AND santri_id = ?
    `, [String(submissionId || ''), session.santri_id])
    if (!submission) return { error: 'Pengajuan tidak ditemukan.' }
    if (submission.status !== 'menunggu_konfirmasi' && submission.status !== 'ditolak') {
      return { error: 'Hanya pengajuan yang belum diproses yang bisa dibatalkan.' }
    }

    await execute(`
      UPDATE portal_payment_submission
      SET status = 'dibatalkan', updated_at = datetime('now')
      WHERE id = ? AND status IN ('menunggu_konfirmasi', 'ditolak')
    `, [submission.id])

    await logActivity({
      actor: { name: `Ortu ${session.nama}` },
      module: 'portal_ortu',
      action: 'cancel_submission',
      entityType: 'portal_payment_submission',
      entityId: submission.id,
      entityLabel: session.nama,
      summary: `Ortu membatalkan pengajuan pembayaran (${session.nama})`,
      details: { santri_id: session.santri_id },
    })

    PORTAL_PATHS.forEach(p => revalidatePath(p))
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Gagal membatalkan pengajuan.' }
  }
}
