'use server'

import { revalidatePath } from 'next/cache'
import { execute, generateId, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { uploadToR2 } from '@/lib/r2/upload'
import { requirePortalSessionAction } from '@/lib/portal/session'
import { syncPortalSppBills, syncPortalNonSppBills, getPortalOpenBills } from '@/lib/finance/portal-bills-sync'
import { getPaymentChannels, getPendingSubmission } from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'

const PORTAL_PATHS = ['/portal-ortu/tagihan', '/portal-ortu/riwayat', '/portal-ortu/beranda']

// Detail item yang disimpan di detail_json — nominal SELALU hasil hitung server.
// billId merujuk ke finance_bills (Keuangan Terpusat) — lihat lib/finance/portal-bills-sync.ts.
export type PortalBillDetailItem = {
  billId: string
  title: string
  amountRupiah: number
}

// Kunci item dari client = finance_bills.id (lihat getPortalOpenBills)
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

    if (kategori === 'SPP') {
      if (session.bebas_spp) return { error: 'Santri ini berstatus bebas SPP.' }
      if (isAsramaTanpaKamar(session.asrama)) return { error: 'Asrama santri ini tidak memiliki kewajiban SPP.' }
    }

    // Sinkronkan tagihan Keuangan Terpusat dengan tunggakan legacy terbaru,
    // lalu hitung ulang item terpilih dari finance_bills (jangan percaya client).
    await (kategori === 'SPP' ? syncPortalSppBills(session.santri_id, true) : syncPortalNonSppBills(session.santri_id))
    const openBills = await getPortalOpenBills(session.santri_id, kategori)
    const byId = new Map(openBills.map(bill => [bill.id, bill]))
    const detail: PortalBillDetailItem[] = []
    for (const key of itemKeys) {
      const bill = byId.get(key)
      if (!bill) return { error: 'Ada tagihan yang sudah tidak berlaku lagi. Muat ulang halaman lalu pilih kembali.' }
      detail.push({ billId: bill.id, title: bill.title, amountRupiah: Number(bill.amount_rupiah) })
    }
    const jumlah = detail.reduce((sum, item) => sum + item.amountRupiah, 0)

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

    const submission = await queryOne<{ id: string; kategori: 'SPP' | 'NON_SPP'; status: string; bukti_url: string | null }>(`
      SELECT id, kategori, status, bukti_url FROM portal_payment_submission
      WHERE id = ? AND santri_id = ?
    `, [submissionId, session.santri_id])
    if (!submission) return { error: 'Pengajuan tidak ditemukan.' }
    if (submission.status !== 'menunggu_konfirmasi' && submission.status !== 'ditolak') {
      return { error: 'Pengajuan ini sudah diproses dan tidak bisa diubah lagi.' }
    }

    // Upload ulang bukti pada pengajuan yang ditolak mengembalikan status ke
    // menunggu — pastikan tidak ada pengajuan lain kategori yang sama yang
    // sudah menunggu (mis. ortu bikin pengajuan baru dulu sebelum upload
    // ulang yang lama), supaya tidak sekadar gagal kena UNIQUE constraint.
    if (submission.status === 'ditolak') {
      const pending = await getPendingSubmission(session.santri_id, submission.kategori)
      if (pending && pending.id !== submission.id) {
        return { error: 'Ada pengajuan lain untuk kategori ini yang sedang menunggu konfirmasi. Batalkan pengajuan itu dulu sebelum upload ulang bukti ini.' }
      }
    }

    // Key: bukti-portal/<submissionId>_<timestamp>.<ext> — tidak bisa ditebak.
    // /api/file/[...key] memang publik; risiko diterima (lihat rencana portal ortu).
    const uploaded = await uploadToR2(file, submissionId, 'bukti-portal')
    if ('error' in uploaded) return { error: uploaded.error }

    // Upload ulang setelah ditolak memakai row yang sama: reset ke menunggu
    try {
      await execute(`
        UPDATE portal_payment_submission
        SET bukti_url = ?, status = 'menunggu_konfirmasi',
            rejected_by = NULL, rejected_at = NULL, reject_reason = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `, [uploaded.url, submissionId])
    } catch (err: any) {
      // Backstop race: partial unique index uq_portal_submission_pending
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        return { error: 'Ada pengajuan lain untuk kategori ini yang sedang menunggu konfirmasi. Batalkan pengajuan itu dulu sebelum upload ulang bukti ini.' }
      }
      throw err
    }

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
