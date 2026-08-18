import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { financeError } from './errors'
import { prepareJournalStatements } from './ledger'
import { syncFinanceTeacherSnapshots } from './snapshots'
import { akrualGajiGuru } from './postings'

/**
 * Payroll guru: gaji tetap bulanan, dengan potongan opsional untuk hari alfa
 * (tidak hadir tanpa keterangan) dan hari badal (digantikan guru lain).
 *
 * Rumusnya tunggal dan tidak punya mode kebijakan:
 *   potongan = alfa_days x tarif_alfa + badal_days x tarif_badal
 *   bersih   = max(0, gaji_bulanan - potongan)
 *
 * Guru yang dibayar penuh cukup punya kedua tarif potongan bernilai 0. Yang
 * diketik operator tiap bulan hanya dua angka per guru: jumlah hari alfa dan
 * jumlah hari badal. Tidak ada absensi per sesi, tidak ada versi kebijakan,
 * tidak ada threshold kehadiran.
 */

export function hitungPotongan(input: {
  monthlySalaryRupiah: number
  alfaDays: number
  badalDays: number
  alfaPerDayRupiah: number
  badalPerDayRupiah: number
}) {
  const potongan = input.alfaDays * input.alfaPerDayRupiah + input.badalDays * input.badalPerDayRupiah
  // Potongan tidak pernah membuat gaji jadi negatif - guru tidak berutang ke
  // pesantren karena tidak masuk. Batas bawahnya nol.
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
  alfaDeductionPerDayRupiah: number
  badalDeductionPerDayRupiah: number
  actorId: string
}) {
  try {
    if (!input.teacherId) throw new Error('Guru wajib dipilih.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) throw new Error('Tanggal efektif tidak valid.')
    for (const [label, value] of [
      ['Gaji bulanan', input.monthlySalaryRupiah],
      ['Potongan per hari alfa', input.alfaDeductionPerDayRupiah],
      ['Potongan per hari badal', input.badalDeductionPerDayRupiah],
    ] as const) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} harus rupiah bulat dan tidak negatif.`)
    }
    const id = generateId(), db = await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_teacher_compensation
        (id,teacher_id,effective_from,monthly_salary_rupiah,alfa_deduction_per_day_rupiah,badal_deduction_per_day_rupiah,created_by)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(teacher_id,effective_from) DO UPDATE SET
          monthly_salary_rupiah=excluded.monthly_salary_rupiah,
          alfa_deduction_per_day_rupiah=excluded.alfa_deduction_per_day_rupiah,
          badal_deduction_per_day_rupiah=excluded.badal_deduction_per_day_rupiah`).bind(
        id, input.teacherId, input.effectiveFrom, input.monthlySalaryRupiah,
        input.alfaDeductionPerDayRupiah, input.badalDeductionPerDayRupiah, input.actorId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'SET','TEACHER_COMPENSATION',?,?)`)
        .bind(generateId(), input.actorId, id, JSON.stringify(input)),
    ])
    return { success: true as const, id }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

/**
 * Menyiapkan baris payroll untuk seluruh guru yang punya kompensasi berlaku.
 * Hari alfa/badal dimulai dari nol - operator mengisinya setelah ini. Menghitung
 * ulang periode yang sudah pernah dihitung mempertahankan angka hari yang sudah
 * diketik, supaya perubahan gaji tidak menghapus pekerjaan operator.
 */
export async function calculatePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period = await queryOne<{ id: string; period_key: string; status: string }>(
      `SELECT id,period_key,status FROM finance_payroll_periods WHERE id=?`, [periodId])
    if (!period) throw new Error('Periode payroll tidak ditemukan.')
    if (!['DRAFT', 'DIHITUNG'].includes(period.status)) throw new Error('Periode yang sudah disetujui tidak dapat dihitung ulang.')

    const teachers = await query<any>(`SELECT c.teacher_id,c.monthly_salary_rupiah,c.alfa_deduction_per_day_rupiah,c.badal_deduction_per_day_rupiah
      FROM finance_teacher_compensation c
      WHERE c.effective_from=(SELECT MAX(c2.effective_from) FROM finance_teacher_compensation c2
        WHERE c2.teacher_id=c.teacher_id AND c2.effective_from<=?)`, [`${period.period_key}-31`])
    if (!teachers.length) throw new Error('Belum ada guru yang punya kompensasi berlaku untuk periode ini.')

    const existing = await query<any>(`SELECT teacher_id,alfa_days,badal_days,note FROM finance_payroll_items WHERE payroll_period_id=?`, [periodId])
    const sebelumnya = new Map(existing.map(row => [String(row.teacher_id), row]))

    await syncFinanceTeacherSnapshots(teachers.map(row => String(row.teacher_id)))

    const db = await getDB()
    const statements = [db.prepare(`DELETE FROM finance_payroll_items WHERE payroll_period_id=? AND status='DIHITUNG'`).bind(periodId)]
    for (const teacher of teachers) {
      const prev = sebelumnya.get(String(teacher.teacher_id))
      const alfaDays = Number(prev?.alfa_days || 0)
      const badalDays = Number(prev?.badal_days || 0)
      const gaji = Number(teacher.monthly_salary_rupiah || 0)
      const { deductionRupiah, netRupiah } = hitungPotongan({
        monthlySalaryRupiah: gaji,
        alfaDays, badalDays,
        alfaPerDayRupiah: Number(teacher.alfa_deduction_per_day_rupiah || 0),
        badalPerDayRupiah: Number(teacher.badal_deduction_per_day_rupiah || 0),
      })
      statements.push(db.prepare(`INSERT INTO finance_payroll_items
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_days,badal_days,deduction_rupiah,net_rupiah,note)
        VALUES(?,?,?,?,?,?,?,?,?)`).bind(
        generateId(), periodId, String(teacher.teacher_id), gaji, alfaDays, badalDays,
        deductionRupiah, netRupiah, prev?.note || null))
      if (statements.length >= 70) await db.batch(statements.splice(0))
    }
    statements.push(
      db.prepare(`UPDATE finance_payroll_periods SET status='DIHITUNG' WHERE id=? AND status IN ('DRAFT','DIHITUNG')`).bind(periodId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CALCULATE','PAYROLL_PERIOD',?,?)`)
        .bind(generateId(), actorId, periodId, JSON.stringify({ teacherCount: teachers.length })),
    )
    await db.batch(statements)
    return { success: true as const, itemCount: teachers.length }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

/** Satu-satunya hal yang diketik operator tiap bulan: berapa hari alfa dan berapa hari badal. */
export async function setPayrollDays(input: {
  itemId: string
  alfaDays: number
  badalDays: number
  note?: string | null
  actorId: string
}) {
  try {
    if (!Number.isSafeInteger(input.alfaDays) || input.alfaDays < 0) throw new Error('Jumlah hari alfa tidak valid.')
    if (!Number.isSafeInteger(input.badalDays) || input.badalDays < 0) throw new Error('Jumlah hari badal tidak valid.')
    const item = await queryOne<any>(`SELECT i.id,i.payroll_period_id,i.teacher_id,i.monthly_salary_rupiah,i.status,p.status period_status
      FROM finance_payroll_items i JOIN finance_payroll_periods p ON p.id=i.payroll_period_id WHERE i.id=?`, [input.itemId])
    if (!item) throw new Error('Baris payroll tidak ditemukan.')
    if (item.status !== 'DIHITUNG' || item.period_status !== 'DIHITUNG') {
      throw new Error('Baris yang sudah disetujui atau dibayar tidak dapat diubah.')
    }
    const comp = await queryOne<any>(`SELECT alfa_deduction_per_day_rupiah,badal_deduction_per_day_rupiah
      FROM finance_teacher_compensation WHERE teacher_id=? ORDER BY effective_from DESC LIMIT 1`, [item.teacher_id])
    const { deductionRupiah, netRupiah } = hitungPotongan({
      monthlySalaryRupiah: Number(item.monthly_salary_rupiah || 0),
      alfaDays: input.alfaDays, badalDays: input.badalDays,
      alfaPerDayRupiah: Number(comp?.alfa_deduction_per_day_rupiah || 0),
      badalPerDayRupiah: Number(comp?.badal_deduction_per_day_rupiah || 0),
    })
    const db = await getDB()
    await db.batch([
      db.prepare(`UPDATE finance_payroll_items SET alfa_days=?,badal_days=?,deduction_rupiah=?,net_rupiah=?,note=?,updated_at=datetime('now')
        WHERE id=? AND status='DIHITUNG'`).bind(input.alfaDays, input.badalDays, deductionRupiah, netRupiah, input.note?.trim() || null, input.itemId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'SET_DAYS','PAYROLL_ITEM',?,?)`)
        .bind(generateId(), input.actorId, input.itemId, JSON.stringify({ alfaDays: input.alfaDays, badalDays: input.badalDays, deductionRupiah, netRupiah })),
    ])
    return { success: true as const, deductionRupiah, netRupiah }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

/**
 * Persetujuan memposting akrual ke ledger: beban payroll didebit, utang payroll
 * dikredit, satu jurnal per guru. Guru dengan gaji bersih nol tidak menghasilkan
 * jurnal sama sekali - tidak ada yang perlu dibukukan.
 */
export async function approvePayrollPeriod(periodId: string, actorId: string) {
  try {
    const period = await queryOne<{ period_key: string; status: string }>(
      `SELECT period_key,status FROM finance_payroll_periods WHERE id=?`, [periodId])
    if (!period || period.status !== 'DIHITUNG') throw new Error('Payroll belum selesai dihitung.')
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
