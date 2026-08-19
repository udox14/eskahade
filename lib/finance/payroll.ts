import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { financeError } from './errors'
import { prepareJournalStatements } from './ledger'
import { syncFinanceTeacherSnapshots } from './snapshots'
import { akrualGajiGuru } from './postings'
import { rekapAbsensiGuruUntukPayroll } from './teacher-attendance'

/**
 * Payroll guru: gaji tetap bulanan, dengan potongan opsional untuk sesi alfa
 * (tidak mengajar tanpa keterangan) dan sesi badal (digantikan guru lain).
 *
 * Rumusnya tunggal dan tidak punya mode kebijakan:
 *   potongan = alfa_sesi x tarif_alfa + badal_sesi x tarif_badal
 *   bersih   = max(0, gaji_bulanan - potongan)
 *
 * Guru yang dibayar penuh cukup punya kedua tarif potongan bernilai 0.
 *
 * Angka sesinya TIDAK diketik bendahara. Sumbernya rekap absensi guru yang
 * dikelola sekpen, ditarik saat periode dihitung dan dibekukan di baris ini.
 * Bendahara menerima data yang sudah final; koreksi apa pun dilakukan sekpen di
 * halaman rekap, lalu payroll dihitung ulang. Satu angka, satu pemilik - kalau
 * dua peran sama-sama bisa mengubahnya, tidak ada lagi yang bisa dimintai
 * pertanggungjawaban ketika slip gaji seorang guru ternyata salah.
 *
 * Satuannya sesi, bukan hari: shubuh, ashar, dan maghrib dihitung terpisah,
 * persis seperti rekapnya. Lihat migrasi keuangan 0003.
 */

export function hitungPotongan(input: {
  monthlySalaryRupiah: number
  alfaSesi: number
  badalSesi: number
  alfaPerSesiRupiah: number
  badalPerSesiRupiah: number
}) {
  const potongan = input.alfaSesi * input.alfaPerSesiRupiah + input.badalSesi * input.badalPerSesiRupiah
  // Potongan tidak pernah membuat gaji jadi negatif - guru tidak berutang ke
  // pesantren karena tidak mengajar. Batas bawahnya nol.
  const bersih = Math.max(0, input.monthlySalaryRupiah - potongan)
  return { deductionRupiah: potongan, netRupiah: bersih }
}

export async function createPayrollPeriod(periodKey: string, actorId?: string | null) {
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) throw new Error('Format periode tidak valid.')
    const id = generateId(), db = await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_payroll_periods(id,period_key) VALUES(?,?)`).bind(id, periodKey),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CREATE','PAYROLL_PERIOD',?,?)`)
        .bind(generateId(), actorId || null, id, JSON.stringify({ periodKey })),
    ])
    return { success: true as const, id }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function setTeacherCompensation(input: {
  teacherId: string
  effectiveFrom: string
  monthlySalaryRupiah: number
  alfaDeductionPerSesiRupiah: number
  badalDeductionPerSesiRupiah: number
  actorId: string
}) {
  try {
    if (!input.teacherId) throw new Error('Guru wajib dipilih.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new Error('Tanggal efektif tidak valid.')
    for (const [label, value] of [
      ['Gaji bulanan', input.monthlySalaryRupiah],
      ['Potongan per sesi alfa', input.alfaDeductionPerSesiRupiah],
      ['Potongan per sesi badal', input.badalDeductionPerSesiRupiah],
    ] as const) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} harus rupiah bulat dan tidak negatif.`)
    }
    const id = generateId(), db = await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_teacher_compensation
        (id,teacher_id,effective_from,monthly_salary_rupiah,alfa_deduction_per_sesi_rupiah,badal_deduction_per_sesi_rupiah,created_by)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(teacher_id,effective_from) DO UPDATE SET
          monthly_salary_rupiah=excluded.monthly_salary_rupiah,
          alfa_deduction_per_sesi_rupiah=excluded.alfa_deduction_per_sesi_rupiah,
          badal_deduction_per_sesi_rupiah=excluded.badal_deduction_per_sesi_rupiah`).bind(
        id, input.teacherId, input.effectiveFrom, input.monthlySalaryRupiah,
        input.alfaDeductionPerSesiRupiah, input.badalDeductionPerSesiRupiah, input.actorId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'SET','TEACHER_COMPENSATION',?,?)`)
        .bind(generateId(), input.actorId, id, JSON.stringify(input)),
    ])
    return { success: true as const, id }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

/**
 * Menyiapkan baris payroll untuk seluruh guru yang punya kompensasi berlaku,
 * dengan jumlah sesi alfa dan badal ditarik dari rekap absensi guru bulan itu.
 *
 * Menghitung ulang menimpa angka sesi dengan keadaan rekap terkini - itulah
 * gunanya menghitung ulang. Catatan bebas yang pernah ditulis dipertahankan.
 *
 * Guru yang tidak muncul di rekap (tidak punya jadwal mengajar pada bulan itu)
 * dihitung nol sesi alfa dan nol sesi badal, jadi gajinya utuh. Tidak punya
 * jadwal bukan pelanggaran, dan memotong gaji atas ketiadaan data akan menghukum
 * guru untuk kesalahan penjadwalan.
 */
export async function calculatePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period = await queryOne<{ id: string; period_key: string; status: string }>(
      `SELECT id,period_key,status FROM finance_payroll_periods WHERE id=?`, [periodId])
    if (!period) throw new Error('Periode payroll tidak ditemukan.')
    if (!['DRAFT', 'DIHITUNG'].includes(period.status)) throw new Error('Periode yang sudah disetujui tidak dapat dihitung ulang.')

    // Melempar bila sekpen belum mengunci bulan itu.
    const absensi = await rekapAbsensiGuruUntukPayroll(period.period_key)

    const teachers = await query<any>(`SELECT c.teacher_id,c.monthly_salary_rupiah,c.alfa_deduction_per_sesi_rupiah,c.badal_deduction_per_sesi_rupiah
      FROM finance_teacher_compensation c
      WHERE c.effective_from=(SELECT MAX(c2.effective_from) FROM finance_teacher_compensation c2
        WHERE c2.teacher_id=c.teacher_id AND c2.effective_from<=?)`, [`${period.period_key}-31`])
    if (!teachers.length) throw new Error('Belum ada guru yang punya kompensasi berlaku untuk periode ini.')

    const existing = await query<any>(`SELECT teacher_id,note FROM finance_payroll_items WHERE payroll_period_id=?`, [periodId])
    const catatanSebelumnya = new Map(existing.map(row => [String(row.teacher_id), row.note]))

    await syncFinanceTeacherSnapshots(teachers.map(row => String(row.teacher_id)))

    const db = await getDB()
    const statements = [db.prepare(`DELETE FROM finance_payroll_items WHERE payroll_period_id=? AND status='DIHITUNG'`).bind(periodId)]
    let guruDenganPotongan = 0
    for (const teacher of teachers) {
      const teacherId = String(teacher.teacher_id)
      const rekap = absensi.perGuru.get(teacherId)
      const alfaSesi = rekap?.alfaSesi ?? 0
      const badalSesi = rekap?.badalSesi ?? 0
      const gaji = Number(teacher.monthly_salary_rupiah || 0)
      const { deductionRupiah, netRupiah } = hitungPotongan({
        monthlySalaryRupiah: gaji,
        alfaSesi, badalSesi,
        alfaPerSesiRupiah: Number(teacher.alfa_deduction_per_sesi_rupiah || 0),
        badalPerSesiRupiah: Number(teacher.badal_deduction_per_sesi_rupiah || 0),
      })
      if (deductionRupiah > 0) guruDenganPotongan += 1
      statements.push(db.prepare(`INSERT INTO finance_payroll_items
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_sesi,badal_sesi,wajib_sesi,hadir_sesi,
         deduction_rupiah,net_rupiah,note,attendance_synced_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`).bind(
        generateId(), periodId, teacherId, gaji, alfaSesi, badalSesi,
        rekap?.wajibSesi ?? 0, rekap?.hadirSesi ?? 0,
        deductionRupiah, netRupiah, catatanSebelumnya.get(teacherId) || null))
      if (statements.length >= 70) await db.batch(statements.splice(0))
    }
    statements.push(
      db.prepare(`UPDATE finance_payroll_periods SET status='DIHITUNG',attendance_locked_at=? WHERE id=? AND status IN ('DRAFT','DIHITUNG')`)
        .bind(absensi.kunci.locked_at, periodId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CALCULATE','PAYROLL_PERIOD',?,?)`)
        .bind(generateId(), actorId, periodId, JSON.stringify({
          teacherCount: teachers.length,
          guruDenganPotongan,
          attendanceLockedAt: absensi.kunci.locked_at,
          attendanceLockedBy: absensi.kunci.locked_by_nama,
        })),
    )
    await db.batch(statements)
    return { success: true as const, itemCount: teachers.length, guruDenganPotongan }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

/**
 * Persetujuan memposting akrual ke ledger: beban payroll didebit, utang payroll
 * dikredit, satu jurnal per guru. Guru dengan gaji bersih nol tidak menghasilkan
 * jurnal sama sekali - tidak ada yang perlu dibukukan.
 *
 * Menolak bila rekap absensi sudah dibuka dan dikunci ulang setelah perhitungan
 * terakhir: angka di layar bukan lagi angka yang berlaku, dan menyetujuinya
 * akan mengakrualkan gaji yang sudah kedaluwarsa.
 */
export async function approvePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period = await queryOne<{ period_key: string; status: string; attendance_locked_at: string | null }>(
      `SELECT period_key,status,attendance_locked_at FROM finance_payroll_periods WHERE id=?`, [periodId])
    if (!period || period.status !== 'DIHITUNG') throw new Error('Payroll belum selesai dihitung.')

    const absensi = await rekapAbsensiGuruUntukPayroll(period.period_key)
    if (period.attendance_locked_at && period.attendance_locked_at !== absensi.kunci.locked_at) {
      throw new Error('Rekap absensi bulan ini sudah dikoreksi sekpen setelah payroll dihitung. Tekan Hitung ulang sebelum menyetujui.')
    }

    const items = await query<any>(`SELECT * FROM finance_payroll_items WHERE payroll_period_id=? AND status='DIHITUNG'`, [periodId])
    if (!items.length) throw new Error('Tidak ada baris payroll pada periode ini.')

    const db = await getDB()
    const statements: any[] = []
    for (const item of items) {
      if (Number(item.net_rupiah) <= 0) {
        statements.push(db.prepare(`UPDATE finance_payroll_items SET status='DISETUJUI',updated_at=datetime('now') WHERE id=? AND status='DIHITUNG'`).bind(item.id))
      } else {
        const journal = prepareJournalStatements(db, {
          idempotencyKey: `payroll:${periodId}:${item.teacher_id}`,
          effectiveDate: `${period.period_key}-28`,
          description: `Akrual payroll guru ${item.teacher_id}`,
          sourceType: 'PAYROLL_ACCRUAL', sourceId: item.id, actorType: 'STAFF', actorId,
          ...akrualGajiGuru({ guruId: String(item.teacher_id), nominalRupiah: Number(item.net_rupiah) }),
        })
        statements.push(
          ...journal.statements,
          db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
          db.prepare(`UPDATE finance_payroll_items SET status='DISETUJUI',journal_id=?,updated_at=datetime('now') WHERE id=? AND status='DIHITUNG'`).bind(journal.journalId, item.id),
        )
      }
      if (statements.length >= 70) await db.batch(statements.splice(0))
    }
    statements.push(
      db.prepare(`UPDATE finance_payroll_periods SET status='DISETUJUI',approved_by=?,approved_at=datetime('now') WHERE id=? AND status='DIHITUNG'`).bind(actorId, periodId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'APPROVE','PAYROLL_PERIOD',?,?)`)
        .bind(generateId(), actorId, periodId, JSON.stringify({ itemCount: items.length })),
    )
    await db.batch(statements)
    return { success: true as const, itemCount: items.length }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}
