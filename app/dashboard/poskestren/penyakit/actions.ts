'use server'

import { query } from '@/lib/db'
import { requirePoskestrenStaffFeature } from '@/lib/poskestren/access'
import {
  academicYearStartForMonth,
  currentWibMonth,
  type DiseaseGender,
  type DiseaseMetricBasis,
  type DiseasePeriodMode,
  type DiseaseReportInput,
  type DiseaseReportOptions,
  type DiseaseReportResult,
  type DiseaseReportRow,
} from '@/lib/poskestren/disease-report'

const PATH = '/dashboard/poskestren/penyakit'
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function isValidDate(value: string | undefined) {
  if (!value || !DATE_RE.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

type NormalizedInput = {
  periodMode: DiseasePeriodMode
  from: string
  to: string
  label: string
  asrama: string
  gender: DiseaseGender
  basis: DiseaseMetricBasis
}

type DiseaseEvent = {
  event_id: string
  santri_id: string
  event_date: string
  diagnosis_key: string
  diagnosis_name: string
  gender: string
  event_asrama: string | null
}

function lastDayOfMonth(month: string) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).getUTCDate()
}

function normalizeInput(input: DiseaseReportInput): NormalizedInput {
  const periodMode: DiseasePeriodMode = ['month', 'semester', 'range'].includes(input.periodMode)
    ? input.periodMode
    : 'month'
  let from = ''
  let to = ''
  let label = ''
  if (periodMode === 'month') {
    const month = MONTH_RE.test(input.month || '') ? input.month! : currentWibMonth()
    from = `${month}-01`
    to = `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}`
    label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${from}T00:00:00Z`))
  } else if (periodMode === 'semester') {
    const currentStart = academicYearStartForMonth(currentWibMonth())
    const year = Number.isInteger(input.academicYearStart) && Number(input.academicYearStart) >= 2000 && Number(input.academicYearStart) <= 2200
      ? Number(input.academicYearStart)
      : currentStart
    const semester = input.semester === 2 ? 2 : 1
    if (semester === 1) {
      from = `${year}-07-01`
      to = `${year}-12-31`
    } else {
      from = `${year + 1}-01-01`
      to = `${year + 1}-06-30`
    }
    label = `Semester ${semester} ${year}/${year + 1}`
  } else {
    if (!isValidDate(input.from) || !isValidDate(input.to) || input.from! > input.to!) {
      throw new Error('Rentang tanggal tidak valid.')
    }
    from = input.from!
    to = input.to!
    label = `${from} s.d. ${to}`
  }
  const gender: DiseaseGender = input.gender === 'L' || input.gender === 'P' ? input.gender : ''
  const basis: DiseaseMetricBasis = input.basis === 'episodes' || input.basis === 'both' ? input.basis : 'unique'
  return {
    periodMode,
    from,
    to,
    label,
    asrama: String(input.asrama || '').trim().slice(0, 120),
    gender,
    basis,
  }
}

const eventDormSql = (studentAlias: string, dateSql: string) => `COALESCE(
  (SELECT mal.asrama_baru FROM mutasi_asrama_log mal
   WHERE mal.santri_id = ${studentAlias}.id AND DATE(mal.created_at) <= ${dateSql}
   ORDER BY mal.created_at DESC, mal.id DESC LIMIT 1),
  (SELECT mal.asrama_lama FROM mutasi_asrama_log mal
   WHERE mal.santri_id = ${studentAlias}.id AND DATE(mal.created_at) > ${dateSql}
   ORDER BY mal.created_at, mal.id LIMIT 1),
  ${studentAlias}.asrama
)`

async function loadEvents(from: string, to: string): Promise<DiseaseEvent[]> {
  const visitDate = 'v.queue_date'
  const examDate = "SUBSTR(e.examined_at,1,10)"
  return query<DiseaseEvent>(
    `SELECT * FROM (
       SELECT v.id AS event_id, s.id AS santri_id, v.queue_date AS event_date,
              COALESCE(v.diagnosis_id,
                (SELECT dx.id FROM poskestren_diagnosis dx
                 WHERE LOWER(TRIM(dx.name)) = LOWER(TRIM(v.diagnosis)) LIMIT 1),
                'legacy:' || LOWER(TRIM(v.diagnosis))) AS diagnosis_key,
              COALESCE(d.name, NULLIF(TRIM(v.diagnosis), '')) AS diagnosis_name,
              s.jenis_kelamin AS gender,
              ${eventDormSql('s', visitDate)} AS event_asrama
       FROM poskestren_visit v
       JOIN poskestren_patient p ON p.id = v.patient_id
       JOIN santri s ON s.id = p.santri_id
       LEFT JOIN poskestren_diagnosis d ON d.id = v.diagnosis_id
       WHERE v.queue_date BETWEEN ? AND ?
         AND v.status IN ('SELESAI','DIRUJUK')
         AND COALESCE(d.name, NULLIF(TRIM(v.diagnosis), '')) IS NOT NULL
       UNION ALL
       SELECT e.id, s.id, ${examDate},
              COALESCE(json_extract(e.clinical_json,'$.diagnosisId'),
                (SELECT dx.id FROM poskestren_diagnosis dx
                 WHERE LOWER(TRIM(dx.name)) = LOWER(TRIM(json_extract(e.clinical_json,'$.diagnosis'))) LIMIT 1),
                'legacy:' || LOWER(TRIM(json_extract(e.clinical_json,'$.diagnosis')))),
              COALESCE(d.name, NULLIF(TRIM(json_extract(e.clinical_json,'$.diagnosis')), '')),
              s.jenis_kelamin,
              ${eventDormSql('s', examDate)}
       FROM poskestren_clinical_exam e
       LEFT JOIN poskestren_dorm_visit dv ON dv.id = e.dorm_visit_id
       LEFT JOIN poskestren_observation o ON o.id = e.observation_id
       JOIN poskestren_patient p ON p.id = COALESCE(dv.patient_id, o.patient_id)
       JOIN santri s ON s.id = p.santri_id
       LEFT JOIN poskestren_diagnosis d ON d.id = json_extract(e.clinical_json,'$.diagnosisId')
       WHERE ${examDate} BETWEEN ? AND ?
         AND (e.dorm_visit_id IS NULL OR dv.status = 'SELESAI')
         AND COALESCE(d.name, NULLIF(TRIM(json_extract(e.clinical_json,'$.diagnosis')), '')) IS NOT NULL
     ) events
     ORDER BY event_date, event_id`,
    [from, to, from, to]
  )
}

async function loadActivePopulation(to: string) {
  const dormAtEnd = eventDormSql('s', '?')
  return query<{ id: string; gender: string; asrama_at_end: string | null }>(
    `SELECT s.id, s.jenis_kelamin AS gender, ${dormAtEnd} AS asrama_at_end
     FROM santri s
     WHERE COALESCE(DATE(s.tanggal_masuk), DATE(s.created_at), '0001-01-01') <= ?
       AND NOT (s.status_global = 'keluar' AND (s.tanggal_keluar IS NULL OR DATE(s.tanggal_keluar) <= ?))
       AND NOT (s.status_global = 'arsip' AND NOT EXISTS (
         SELECT 1 FROM santri_arsip sa WHERE sa.santri_id_asli = s.id AND DATE(sa.tanggal_arsip) > ?
       ))
       AND NOT EXISTS (
         SELECT 1 FROM santri_nonaktif_log sn
         WHERE sn.santri_id = s.id AND DATE(sn.tanggal_mulai) <= ?
           AND (sn.tanggal_aktif_aktual IS NULL OR DATE(sn.tanggal_aktif_aktual) > ?)
       )`,
    [to, to, to, to, to, to, to]
  )
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10000) / 100 : 0
}

export async function getDiseaseReportOptions(): Promise<DiseaseReportOptions> {
  await requirePoskestrenStaffFeature(PATH)
  const [asramaRows, years] = await Promise.all([
    query<{ name: string }>(
      `SELECT DISTINCT name FROM (
         SELECT TRIM(asrama) AS name FROM santri
         UNION SELECT TRIM(asrama_lama) FROM mutasi_asrama_log
         UNION SELECT TRIM(asrama_baru) FROM mutasi_asrama_log
       ) WHERE name IS NOT NULL AND name <> '' ORDER BY name COLLATE NOCASE`
    ),
    query<{ min_year: number | null; max_year: number | null }>(
      `SELECT MIN(year_value) AS min_year, MAX(year_value) AS max_year FROM (
         SELECT CAST(SUBSTR(queue_date,1,4) AS INTEGER) AS year_value
         FROM poskestren_visit WHERE diagnosis IS NOT NULL OR diagnosis_id IS NOT NULL
         UNION ALL
         SELECT CAST(SUBSTR(examined_at,1,4) AS INTEGER)
         FROM poskestren_clinical_exam
       )`
    ),
  ])
  const currentMonth = currentWibMonth()
  const currentStart = academicYearStartForMonth(currentMonth)
  const rawMin = Number(years[0]?.min_year)
  const rawMax = Number(years[0]?.max_year)
  const min = Math.min(rawMin >= 2000 && rawMin <= 2200 ? rawMin - 1 : currentStart, currentStart)
  const max = Math.max(rawMax >= 2000 && rawMax <= 2200 ? rawMax : currentStart, currentStart)
  const academicYearStarts = Array.from({ length: max - min + 1 }, (_, index) => max - index)
  return { asrama: asramaRows.map(row => row.name), academicYearStarts, currentMonth, currentAcademicYearStart: currentStart }
}

export async function getDiseaseCaseReport(input: DiseaseReportInput): Promise<DiseaseReportResult> {
  await requirePoskestrenStaffFeature(PATH)
  const normalized = normalizeInput(input)
  const [rawEvents, population] = await Promise.all([
    loadEvents(normalized.from, normalized.to),
    loadActivePopulation(normalized.to),
  ])
  const events = rawEvents.filter(event =>
    (!normalized.gender || event.gender === normalized.gender) &&
    (!normalized.asrama || event.event_asrama === normalized.asrama)
  )
  const activeStudents = population.filter(student =>
    (!normalized.gender || student.gender === normalized.gender) &&
    (!normalized.asrama || student.asrama_at_end === normalized.asrama)
  ).length
  const diagnosedStudents = new Set(events.map(event => event.santri_id)).size
  const groups = new Map<string, { name: string; students: Set<string>; episodes: number }>()
  for (const event of events) {
    const group = groups.get(event.diagnosis_key) || { name: event.diagnosis_name, students: new Set<string>(), episodes: 0 }
    group.students.add(event.santri_id)
    group.episodes += 1
    groups.set(event.diagnosis_key, group)
  }
  const rows: DiseaseReportRow[] = [...groups.entries()].map(([diagnosisKey, group]) => ({
    diagnosisKey,
    diagnosisName: group.name,
    uniqueStudents: group.students.size,
    episodes: group.episodes,
    uniqueSharePercent: percent(group.students.size, diagnosedStudents),
    uniqueActivePercent: percent(group.students.size, activeStudents),
    episodeSharePercent: percent(group.episodes, events.length),
    episodesPer100Active: percent(group.episodes, activeStudents),
  })).sort((a, b) => b.uniqueStudents - a.uniqueStudents || b.episodes - a.episodes || a.diagnosisName.localeCompare(b.diagnosisName, 'id'))
  return {
    period: { mode: normalized.periodMode, from: normalized.from, to: normalized.to, label: normalized.label },
    filters: { asrama: normalized.asrama, gender: normalized.gender, basis: normalized.basis },
    totals: { diagnosedStudents, episodes: events.length, activeStudents, diagnoses: rows.length },
    rows,
  }
}
