export type PoskestrenJabatan = 'ketua' | 'bendahara' | 'sekretaris'
export type PoskestrenPersonnelType = 'MEDICAL' | 'EMPLOYEE'
export type PoskestrenVisitStatus = 'MENUNGGU' | 'DIPERIKSA' | 'OBAT' | 'SELESAI' | 'DIRUJUK' | 'BATAL'
export type PoskestrenPageSize = 20 | 50 | 100 | 'all'
export type PoskestrenStockMovementType =
  | 'PURCHASE'
  | 'PATIENT'
  | 'PREVENTIVE'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'LOST'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'REVERSAL'
export type PoskestrenMedicineSource = 'STOCK' | 'EXTERNAL'
export type PoskestrenObservationStatus = 'ACTIVE' | 'RECOVERED' | 'REFERRED'
export type PoskestrenOutsideReferenceType = 'REGION' | 'PROVIDER' | 'DRIVER'


export type PoskestrenListQuery = {
  q?: string
  from?: string
  to?: string
  status?: string
  cursor?: string
  limit?: PoskestrenPageSize
  filters?: Record<string, string | number | boolean | null | undefined>
}

export type PoskestrenListResult<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
  truncated: boolean
  limit: number
}

export type PrescriptionDraftItem = {
  medicineId: string
  locationId?: string | null
  requestedQuantityBase: number
  dosage?: string | null
  notes?: string | null
}

export type ClinicalMedicineDraftItem = {
  localId?: string
  sourceType: PoskestrenMedicineSource
  medicineId?: string | null
  locationId?: string | null
  medicineName?: string | null
  quantityBase?: number | null
  dosage?: string | null
  notes?: string | null
}

export const POSKESTREN_PAGE_SIZES = [20, 50, 100, 'all'] as const
export const POSKESTREN_ALL_LIMIT = 1000

export const POSKESTREN_HREF = {
  examination: '/dashboard/poskestren/pemeriksaan',
  observation: '/dashboard/poskestren/observasi',
  finance: '/dashboard/poskestren/keuangan',
  reports: '/dashboard/poskestren/cetak',
  medicine: '/dashboard/poskestren/obat',
  management: '/dashboard/poskestren/manajemen',
} as const

