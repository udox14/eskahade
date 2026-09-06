export type DiseasePeriodMode = 'month' | 'semester' | 'range'
export type DiseaseMetricBasis = 'unique' | 'episodes' | 'both'
export type DiseaseGender = '' | 'L' | 'P'

export type DiseaseReportInput = {
  periodMode: DiseasePeriodMode
  month?: string
  academicYearStart?: number
  semester?: 1 | 2
  from?: string
  to?: string
  asrama?: string
  gender?: DiseaseGender
  basis?: DiseaseMetricBasis
}

export type DiseaseReportRow = {
  diagnosisKey: string
  diagnosisName: string
  uniqueStudents: number
  episodes: number
  uniqueSharePercent: number
  uniqueActivePercent: number
  episodeSharePercent: number
  episodesPer100Active: number
}

export type DiseaseReportResult = {
  period: {
    mode: DiseasePeriodMode
    from: string
    to: string
    label: string
  }
  filters: {
    asrama: string
    gender: DiseaseGender
    basis: DiseaseMetricBasis
  }
  totals: {
    diagnosedStudents: number
    episodes: number
    activeStudents: number
    diagnoses: number
  }
  rows: DiseaseReportRow[]
}

export type DiseaseReportOptions = {
  asrama: string[]
  academicYearStarts: number[]
  currentMonth: string
  currentAcademicYearStart: number
}

export function currentWibMonth(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date).slice(0, 7)
}

export function academicYearStartForMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return monthNumber >= 7 ? year : year - 1
}
