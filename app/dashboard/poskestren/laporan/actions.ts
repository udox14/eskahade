/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { query } from '@/lib/db'
import { requirePoskestrenFeature } from '@/lib/poskestren/access'
import { POSKESTREN_HREF } from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.reports
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function monthPeriod(month: string) {
  if (!MONTH_RE.test(month)) throw new Error('Periode bulan tidak valid.')
  const [year, number] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export async function getMonthlyReport(month: string) {
  await requirePoskestrenFeature(PATH)
  const { from, to } = monthPeriod(month)
  const [
    visitSummary,
    visitsByDorm,
    diagnoses,
    medicalStaff,
    preventiveSummary,
    preventivePrograms,
    medicineUsage,
    purchaseSummary,
    stockSummary,
    locationStockSummary,
    transferSummary,
    orderSummary,
    financeSummary,
    financeAccounts,
    expenseCategories,
  ] = await Promise.all([
    query<any>(
      `SELECT COUNT(*) AS visits,
              COUNT(DISTINCT p.santri_id) AS unique_patients,
              COUNT(CASE WHEN v.status = 'MENUNGGU' THEN 1 END) AS waiting,
              COUNT(CASE WHEN v.status = 'DIPERIKSA' THEN 1 END) AS examining,
              COUNT(CASE WHEN v.awaiting_medicine = 1 THEN 1 END) AS waiting_medicine,
              COUNT(CASE WHEN v.status = 'SELESAI' THEN 1 END) AS completed,
              COUNT(CASE WHEN v.status = 'DIRUJUK' THEN 1 END) AS referred,
              COUNT(CASE WHEN v.status = 'BATAL' THEN 1 END) AS cancelled,
              COUNT(CASE WHEN v.source_type = 'DATA_SAKIT' THEN 1 END) AS sick_source
       FROM poskestren_visit v
       JOIN poskestren_patient p ON p.id = v.patient_id
       WHERE v.queue_date BETWEEN ? AND ?`,
      [from, to]
    ),
    query<any>(
      `SELECT COALESCE(s.asrama, 'Tanpa asrama') AS label, COUNT(*) AS total
       FROM poskestren_visit v
       JOIN poskestren_patient p ON p.id = v.patient_id
       JOIN santri s ON s.id = p.santri_id
       WHERE v.queue_date BETWEEN ? AND ?
       GROUP BY COALESCE(s.asrama, 'Tanpa asrama')
       ORDER BY total DESC, label LIMIT 30`,
      [from, to]
    ),
    query<any>(
      `SELECT COALESCE(NULLIF(TRIM(v.diagnosis), ''), 'Belum diisi') AS label, COUNT(*) AS total
       FROM poskestren_visit v
       WHERE v.queue_date BETWEEN ? AND ? AND v.status IN ('SELESAI','DIRUJUK')
       GROUP BY COALESCE(NULLIF(TRIM(v.diagnosis), ''), 'Belum diisi')
       ORDER BY total DESC, label LIMIT 30`,
      [from, to]
    ),
    query<any>(
      `SELECT COALESCE(pp.full_name, 'Belum ditentukan') AS label,
              COUNT(*) AS total,
              COUNT(CASE WHEN v.status = 'DIRUJUK' THEN 1 END) AS referred
       FROM poskestren_visit v
       LEFT JOIN poskestren_personnel pp ON pp.id = v.personnel_id
       WHERE v.queue_date BETWEEN ? AND ? AND v.status IN ('SELESAI','DIRUJUK')
       GROUP BY v.personnel_id, COALESCE(pp.full_name, 'Belum ditentukan')
       ORDER BY total DESC`,
      [from, to]
    ),
    query<any>(
      `SELECT COUNT(DISTINCT pr.id) AS programs,
              COUNT(pt.id) AS participants,
              COUNT(CASE WHEN pt.attendance = 'PRESENT' THEN 1 END) AS present,
              COUNT(CASE WHEN pt.follow_up IS NOT NULL AND TRIM(pt.follow_up) <> '' THEN 1 END) AS follow_up
       FROM poskestren_preventive_program pr
       LEFT JOIN poskestren_preventive_participant pt ON pt.program_id = pr.id
       WHERE pr.program_date BETWEEN ? AND ?`,
      [from, to]
    ),
    query<any>(
      `SELECT pr.title, pr.program_date, COALESCE(t.name, 'Lainnya') AS type_name,
              pr.status, COUNT(pt.id) AS participants,
              COUNT(CASE WHEN pt.attendance = 'PRESENT' THEN 1 END) AS present,
              COUNT(CASE WHEN pt.follow_up IS NOT NULL AND TRIM(pt.follow_up) <> '' THEN 1 END) AS follow_up
       FROM poskestren_preventive_program pr
       LEFT JOIN poskestren_preventive_type t ON t.id = pr.type_id
       LEFT JOIN poskestren_preventive_participant pt ON pt.program_id = pr.id
       WHERE pr.program_date BETWEEN ? AND ?
       GROUP BY pr.id ORDER BY pr.program_date, pr.title`,
      [from, to]
    ),
    query<any>(
      `SELECT m.name, m.base_unit,
              SUM(CASE WHEN sm.quantity_delta < 0 THEN -sm.quantity_delta ELSE 0 END) AS used_quantity,
              SUM(CASE WHEN sm.movement_type = 'PATIENT' THEN -sm.quantity_delta ELSE 0 END) AS patient_quantity,
              SUM(CASE WHEN sm.reference_type = 'QUICK_MEDICINE_ISSUE' THEN -sm.quantity_delta ELSE 0 END) AS quick_quantity,
              SUM(CASE WHEN sm.movement_type = 'PATIENT' AND sm.reference_type <> 'QUICK_MEDICINE_ISSUE' THEN -sm.quantity_delta ELSE 0 END) AS clinical_quantity,
              SUM(CASE WHEN sm.movement_type = 'PREVENTIVE' THEN -sm.quantity_delta ELSE 0 END) AS preventive_quantity,
              SUM(CASE WHEN sm.movement_type IN ('EXPIRED','DAMAGED','LOST') THEN -sm.quantity_delta ELSE 0 END) AS loss_quantity
       FROM poskestren_stock_movement sm
       JOIN poskestren_medicine m ON m.id = sm.medicine_id
       WHERE sm.movement_date BETWEEN ? AND ? AND sm.quantity_delta < 0
       GROUP BY m.id ORDER BY used_quantity DESC LIMIT 50`,
      [from, to]
    ),
    query<any>(
      `SELECT COUNT(*) AS purchases,
              COALESCE(SUM(total_rupiah), 0) AS total,
              COUNT(CASE WHEN payment_status = 'POSTED' THEN 1 END) AS paid,
              COUNT(CASE WHEN status = 'RECEIVED' THEN 1 END) AS received
       FROM poskestren_purchase WHERE purchase_date BETWEEN ? AND ?`,
      [from, to]
    ),
    query<any>(
      `SELECT COUNT(CASE WHEN total_stock_base <= minimum_stock_base THEN 1 END) AS critical,
              COUNT(CASE WHEN total_stock_base = 0 THEN 1 END) AS empty,
              COALESCE(SUM(total_stock_base), 0) AS total_units,
              COALESCE((SELECT SUM(quantity_base) FROM poskestren_medicine_location_stock mls
                        JOIN poskestren_stock_location sl ON sl.id = mls.location_id
                        WHERE sl.location_type = 'CENTRAL'), 0) AS central_units,
              COALESCE((SELECT SUM(quantity_base) FROM poskestren_medicine_location_stock mls
                        JOIN poskestren_stock_location sl ON sl.id = mls.location_id
                        WHERE sl.location_type = 'DORM' AND sl.is_active = 1), 0) AS dorm_units
       FROM poskestren_medicine WHERE is_active = 1`,
      []
    ),
    query<any>(
      `SELECT sl.name AS location_name, sl.location_type,
              COALESCE(SUM(mls.quantity_base), 0) AS quantity_base
       FROM poskestren_stock_location sl
       LEFT JOIN poskestren_medicine_location_stock mls ON mls.location_id = sl.id
       WHERE sl.is_active = 1
       GROUP BY sl.id ORDER BY sl.location_type, sl.name COLLATE NOCASE`,
      []
    ),
    query<any>(
      `SELECT COUNT(DISTINCT t.id) AS transfers,
              COALESCE(SUM(CASE WHEN t.transfer_date BETWEEN ? AND ? THEN ti.quantity_base ELSE 0 END), 0) AS transferred_units
       FROM poskestren_stock_transfer t
       LEFT JOIN poskestren_stock_transfer_item ti ON ti.transfer_id = t.id
       WHERE t.status = 'COMPLETED' AND t.transfer_date BETWEEN ? AND ?`,
      [from, to, from, to]
    ),
    query<any>(
      `SELECT status, COUNT(*) AS total
       FROM poskestren_medicine_order
       WHERE order_date BETWEEN ? AND ?
       GROUP BY status ORDER BY status`,
      [from, to]
    ),
    query<any>(
      `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' AND status = 'POSTED' THEN amount_rupiah ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' AND status = 'POSTED' THEN amount_rupiah ELSE 0 END), 0) AS expense,
              COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' AND category_id = 'pos-expense-medicine' AND status = 'POSTED' THEN amount_rupiah ELSE 0 END), 0) AS medicine_expense
       FROM poskestren_finance_transaction
       WHERE transaction_date BETWEEN ? AND ?`,
      [from, to]
    ),
    query<any>(
      `SELECT a.name,
              COALESCE(SUM(CASE
                WHEN t.transaction_type IN ('INCOME','OPENING','TRANSFER_IN') THEN t.amount_rupiah
                WHEN t.transaction_type IN ('EXPENSE','TRANSFER_OUT') THEN -t.amount_rupiah
                WHEN t.transaction_type = 'REVERSAL' AND original.transaction_type IN ('EXPENSE','TRANSFER_OUT') THEN t.amount_rupiah
                WHEN t.transaction_type = 'REVERSAL' THEN -t.amount_rupiah ELSE 0 END), 0) AS balance
       FROM poskestren_cash_account a
       LEFT JOIN poskestren_finance_transaction t ON t.account_id = a.id AND t.transaction_date <= ?
       LEFT JOIN poskestren_finance_transaction original ON original.id = t.linked_transaction_id
       GROUP BY a.id ORDER BY a.name`,
      [to]
    ),
    query<any>(
      `SELECT COALESCE(c.name, 'Tanpa kategori') AS name, SUM(t.amount_rupiah) AS total
       FROM poskestren_finance_transaction t
       LEFT JOIN poskestren_finance_category c ON c.id = t.category_id
       WHERE t.transaction_type = 'EXPENSE' AND t.status = 'POSTED'
         AND t.transaction_date BETWEEN ? AND ?
       GROUP BY t.category_id, COALESCE(c.name, 'Tanpa kategori')
       ORDER BY total DESC`,
      [from, to]
    ),
  ])
  return {
    period: { month, from, to },
    visitSummary: visitSummary[0] || {},
    visitsByDorm,
    diagnoses,
    medicalStaff,
    preventiveSummary: preventiveSummary[0] || {},
    preventivePrograms,
    medicineUsage,
    purchaseSummary: purchaseSummary[0] || {},
    stockSummary: stockSummary[0] || {},
    locationStockSummary,
    transferSummary: transferSummary[0] || {},
    orderSummary,
    financeSummary: financeSummary[0] || {},
    financeAccounts,
    expenseCategories,
  }
}

export async function getPayrollReport(month: string) {
  await requirePoskestrenFeature(PATH)
  const { from, to } = monthPeriod(month)
  const [medicalEvents, employees] = await Promise.all([
    query<any>(
      `SELECT p.id, p.full_name, p.profession, e.event_type, e.event_date,
              e.event_count, e.rate, e.event_count * e.rate AS subtotal
       FROM poskestren_personnel p
       LEFT JOIN (
         SELECT rated.personnel_id, rated.event_type, rated.event_date,
                COUNT(*) AS event_count, rated.rate
         FROM (
           SELECT ps.personnel_id, 'SESSION' AS event_type, ps.session_date AS event_date,
                  COALESCE((
                    SELECT ch.session_rate_rupiah
                    FROM poskestren_compensation_history ch
                    WHERE ch.personnel_id = ps.personnel_id
                      AND ch.effective_from <= ps.session_date
                    ORDER BY ch.effective_from DESC LIMIT 1
                  ), 0) AS rate
           FROM poskestren_practice_session ps
           WHERE ps.status = 'CLOSED' AND ps.session_date BETWEEN ? AND ?
           UNION ALL
           SELECT v.personnel_id, 'PATIENT' AS event_type, v.queue_date AS event_date,
                  COALESCE((
                    SELECT ch.patient_rate_rupiah
                    FROM poskestren_compensation_history ch
                    WHERE ch.personnel_id = v.personnel_id
                      AND ch.effective_from <= v.queue_date
                    ORDER BY ch.effective_from DESC LIMIT 1
                  ), 0) AS rate
           FROM poskestren_visit v
           WHERE v.personnel_id IS NOT NULL
             AND v.status IN ('SELESAI','DIRUJUK')
             AND v.fee_category = 'NORMAL'
             AND v.queue_date BETWEEN ? AND ?
           UNION ALL
           SELECT v.personnel_id, 'PATIENT_TREATMENT' AS event_type, v.queue_date AS event_date,
                  COALESCE((
                    SELECT COALESCE(ch.patient_rate_with_treatment_rupiah, ch.patient_rate_rupiah)
                    FROM poskestren_compensation_history ch
                    WHERE ch.personnel_id = v.personnel_id
                      AND ch.effective_from <= v.queue_date
                    ORDER BY ch.effective_from DESC LIMIT 1
                  ), 0) AS rate
           FROM poskestren_visit v
           WHERE v.personnel_id IS NOT NULL
             AND v.status IN ('SELESAI','DIRUJUK')
             AND v.fee_category = 'TREATMENT'
             AND v.queue_date BETWEEN ? AND ?
           UNION ALL
           SELECT dv.personnel_id, 'DORM_PATIENT', DATE(dv.visited_at,'+7 hours'),
             COALESCE((SELECT ch.patient_rate_rupiah FROM poskestren_compensation_history ch
               WHERE ch.personnel_id=dv.personnel_id AND ch.effective_from<=DATE(dv.visited_at,'+7 hours')
               ORDER BY ch.effective_from DESC LIMIT 1),0)
           FROM poskestren_dorm_visit dv
           WHERE dv.status='SELESAI' AND dv.completed_at IS NOT NULL AND dv.personnel_id IS NOT NULL
             AND DATE(dv.visited_at,'+7 hours') BETWEEN ? AND ?
         ) rated
         GROUP BY rated.personnel_id, rated.event_type, rated.event_date, rated.rate
       ) e ON e.personnel_id = p.id
       WHERE p.personnel_type = 'MEDICAL'
         AND (p.employment_start IS NULL OR p.employment_start <= ?)
         AND (p.employment_end IS NULL OR p.employment_end >= ?)
       ORDER BY p.full_name, e.event_type, e.event_date`,
      [from, to, from, to, from, to, from, to, to, from]
    ),
    query<any>(
      `SELECT p.id, p.full_name, p.position_name,
              COALESCE((
                SELECT ch.monthly_salary_rupiah FROM poskestren_compensation_history ch
                WHERE ch.personnel_id = p.id AND ch.effective_from <= ?
                ORDER BY ch.effective_from DESC LIMIT 1
              ), 0) AS monthly_salary,
              (
                SELECT ch.effective_from FROM poskestren_compensation_history ch
                WHERE ch.personnel_id = p.id AND ch.effective_from <= ?
                ORDER BY ch.effective_from DESC LIMIT 1
              ) AS effective_from
       FROM poskestren_personnel p
       WHERE p.personnel_type = 'EMPLOYEE'
         AND (p.employment_start IS NULL OR p.employment_start <= ?)
         AND (p.employment_end IS NULL OR p.employment_end >= ?)
       ORDER BY p.full_name`,
      [to, to, to, from]
    ),
  ])
  const medicalMap = new Map<string, any>()
  for (const event of medicalEvents) {
    const row = medicalMap.get(event.id) || {
      id: event.id,
      full_name: event.full_name,
      profession: event.profession,
      session_count: 0,
      visit_count: 0,
      visit_treatment_count: 0,
      dorm_visit_count: 0,
      dorm_subtotal: 0,
      session_rates: [] as string[],
      patient_rates: [] as string[],
      patient_treatment_rates: [] as string[],
      session_subtotal: 0,
      patient_subtotal: 0,
      patient_treatment_subtotal: 0,
      total: 0,
    }
    if (event.event_type === 'SESSION') {
      row.session_count += Number(event.event_count)
      row.session_subtotal += Number(event.subtotal)
      row.session_rates.push(`${event.event_date}:${event.rate}`)
    } else if (event.event_type === 'PATIENT') {
      row.visit_count += Number(event.event_count)
      row.patient_subtotal += Number(event.subtotal)
      row.patient_rates.push(`${event.event_date}:${event.rate}`)
    } else if (event.event_type === 'DORM_PATIENT') {
      row.dorm_visit_count += Number(event.event_count)
      row.dorm_subtotal += Number(event.subtotal)
    } else if (event.event_type === 'PATIENT_TREATMENT') {
      row.visit_treatment_count += Number(event.event_count)
      row.patient_treatment_subtotal += Number(event.subtotal)
      row.patient_treatment_rates.push(`${event.event_date}:${event.rate}`)
    }
    row.total = row.session_subtotal + row.patient_subtotal + row.patient_treatment_subtotal + row.dorm_subtotal
    medicalMap.set(event.id, row)
  }
  const medicalRows = [...medicalMap.values()]
  const employeeRows = employees.map(row => ({ ...row, total: Number(row.monthly_salary) }))
  return {
    period: { month, from, to },
    medical: medicalRows,
    employees: employeeRows,
    medicalTotal: medicalRows.reduce((sum, row) => sum + row.total, 0),
    employeeTotal: employeeRows.reduce((sum, row) => sum + row.total, 0),
    grandTotal: medicalRows.reduce((sum, row) => sum + row.total, 0) + employeeRows.reduce((sum, row) => sum + row.total, 0),
  }
}
