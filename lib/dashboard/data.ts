import { getCloudflareContext } from '@opennextjs/cloudflare'
import { query, queryOne } from '@/lib/db'
import { isDemoRequest } from '@/lib/auth/demo-context'
import { getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { toWibDateInputValue } from '@/lib/date/wib'
import { DASHBOARD_WIDGETS, type DashboardWidgetKey } from './catalog'

export type WidgetLine = { label: string; detail?: string }
export type DashboardWidgetData = {
  key: DashboardWidgetKey
  title: string
  href: string | null
  value: string
  description: string
  lines: WidgetLine[]
  updatedAt: string
  unavailable?: boolean
}

type Context = {
  session: SessionUser
  roles: string[]
  hrefs: Set<string>
  today: string
  monthStart: string
  nextMonthStart: string
  asrama: string | null
  unrestricted: boolean
  refresh: boolean
  demo: boolean
}

const FIVE_MINUTES = 300
const rupiah = (amount: number) => `Rp${Math.round(amount).toLocaleString('id-ID')}`

function nextMonth(day: string) {
  const [year, month] = day.split('-').map(Number)
  const value = new Date(Date.UTC(year, month, 1))
  return value.toISOString().slice(0, 10)
}

async function cached<T>(ctx: Context, key: string, load: () => Promise<T>): Promise<T> {
  // Only module-level, scope-specific aggregates use this cache. Authorization
  // happens before this function and no personal activity is ever stored here.
  type CacheBinding = { get(key: string): Promise<string | null>; put(key: string, value: string, options: { expirationTtl: number }): Promise<void> }
  let kv: CacheBinding | null = null
  try {
    const { env } = await getCloudflareContext({ async: true })
    kv = env.NEXT_INC_CACHE_KV as unknown as CacheBinding
  } catch { /* Local development without Cloudflare bindings. */ }
  const cacheKey = 'dashboard:v1:' + (process.env.NODE_ENV === 'production' ? '' : 'dev-') +
    (ctx.demo ? 'demo' : 'prod') + ':' + key
  if (kv && !ctx.refresh) {
    try {
      const value = await kv.get(cacheKey)
      if (value) return JSON.parse(value) as T
    } catch { /* An unavailable cache must not hide the widget. */ }
  }
  const result = await load()
  if (kv) {
    try { await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: FIVE_MINUTES }) }
    catch { /* D1 result remains usable. */ }
  }
  return result
}

function permissionScope(ctx: Context) {
  if (ctx.roles.some(role => ['admin', 'demo', 'tester', 'dewan_santri', 'keamanan', 'sekpen'].includes(role))) return { clause: '', params: [] as unknown[] }
  if (!ctx.asrama) return null
  return { clause: ' AND s.asrama = ?', params: [ctx.asrama] as unknown[] }
}

async function permissionStats(ctx: Context) {
  const scope = permissionScope(ctx)
  if (!scope) return { pending: 0, late: 0 }
  const load = async () => {
    const [pending, late] = await Promise.all([
      queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM perizinan_pengajuan pq JOIN santri s ON s.id = pq.santri_id WHERE pq.status = 'PENDING'${scope.clause}`,
        scope.params
      ),
      queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM perizinan p JOIN santri s ON s.id = p.santri_id WHERE p.status = 'TELAT'${scope.clause}`,
        scope.params
      ),
    ])
    return { pending: pending?.total ?? 0, late: late?.total ?? 0 }
  }
  return scope.clause === '' ? cached(ctx, 'permissions:all', load) : load()
}

async function reconciliationCount(ctx: Context) {
  return cached(ctx, 'reconciliation:open', async () => {
    const row = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM finance_reconciliation_items
       WHERE resolution_action = 'NONE'
         AND match_status IN ('UNALLOCATED_TRANSFER', 'AMOUNT_MISMATCH', 'UNMATCHED_INTERNAL', 'UNMATCHED_EXTERNAL')`
    )
    return row?.total ?? 0
  })
}

function make(key: DashboardWidgetKey, href: string | null, value: string, description: string, lines: WidgetLine[] = []): DashboardWidgetData {
  return {
    key, title: DASHBOARD_WIDGETS.find(item => item.key === key)?.title ?? key,
    href, value, description, lines, updatedAt: new Date().toISOString(),
  }
}

async function loadWidget(key: DashboardWidgetKey, ctx: Context): Promise<DashboardWidgetData> {
  const permits = ctx.hrefs.has('/dashboard/keamanan/perizinan')
  const recon = ctx.hrefs.has('/dashboard/keuangan/rekonsiliasi')
  const cash = ctx.hrefs.has('/dashboard/koperasi/loket')

  if (key === 'attention') {
    const [permissions, mismatch] = await Promise.all([
      permits ? permissionStats(ctx) : Promise.resolve(null),
      recon ? reconciliationCount(ctx) : Promise.resolve(null),
    ])
    const lines: WidgetLine[] = []
    if (permissions) {
      lines.push({ label: `${permissions.pending} pengajuan izin menunggu` })
      lines.push({ label: `${permissions.late} santri terlambat kembali` })
    }
    if (mismatch !== null) lines.push({ label: `${mismatch} transaksi perlu diperiksa` })
    const total = (permissions?.pending ?? 0) + (permissions?.late ?? 0) + (mismatch ?? 0)
    return make(key, permits ? '/dashboard/keamanan/perizinan' : '/dashboard/keuangan/rekonsiliasi', String(total),
      total ? 'Hal yang membutuhkan tindak lanjut' : 'Tidak ada hal mendesak', lines)
  }

  if (key === 'permissions') {
    const stats = await permissionStats(ctx)
    return make(key, '/dashboard/keamanan/perizinan', String(stats.pending), 'Pengajuan menunggu keputusan',
      [{ label: `${stats.late} santri terlambat kembali` }])
  }

  if (key === 'attendance') {
    if (!ctx.unrestricted && ctx.roles.includes('pengurus_asrama')) {
      if (!ctx.asrama) return make(key, '/dashboard/asrama/absen-malam', '—', 'Asrama binaan belum ditetapkan')
      const row = await queryOne<{ total: number; hadir: number }>(
        `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN a.status = 'HADIR' THEN 1 ELSE 0 END), 0) AS hadir
         FROM absen_malam_v2 a JOIN santri s ON s.id = a.santri_id
         WHERE a.tanggal = ? AND s.asrama = ?`,
        [ctx.today, ctx.asrama]
      )
      const total = row?.total ?? 0
      return make(key, '/dashboard/asrama/absen-malam', total ? `${Math.round(((row?.hadir ?? 0) / total) * 100)}%` : '—',
        total ? `${row?.hadir ?? 0} dari ${total} catatan absen malam` : 'Belum ada catatan hari ini')
    }
    if (!ctx.unrestricted && ctx.roles.includes('guru')) {
      const user = await queryOne<{ source_ref_id: string | null }>(
        'SELECT source_ref_id FROM users WHERE id = ?', [ctx.session.id]
      )
      const guruId = Number(user?.source_ref_id)
      if (!Number.isInteger(guruId) || guruId <= 0) {
        return make(key, '/dashboard/guru/absensi', '—', 'Akun belum terhubung ke data guru')
      }
      const dayIndex = new Date(ctx.today + 'T12:00:00+07:00').getUTCDay()
      const row = await queryOne<{ total: number; hadir: number }>(
        "SELECT COUNT(*) * 3 AS total, COALESCE(SUM((a.shubuh = 'H') + (a.ashar = 'H') + (a.maghrib = 'H')), 0) AS hadir " +
        "FROM absensi_harian a JOIN riwayat_pendidikan rp ON rp.id = a.riwayat_pendidikan_id " +
        "JOIN kelas k ON k.id = rp.kelas_id JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1 " +
        "WHERE a.tanggal = ? AND EXISTS (SELECT 1 FROM kelas_jadwal_guru_mingguan j " +
        "WHERE j.kelas_id = rp.kelas_id AND j.hari_index = ? AND j.guru_id = ?)",
        [ctx.today, dayIndex, guruId]
      )
      const total = row?.total ?? 0
      return make(key, '/dashboard/guru/absensi',
        total ? String(Math.round(((row?.hadir ?? 0) / total) * 100)) + '%' : '—',
        total ? String(row?.hadir ?? 0) + ' dari ' + String(total) + ' entri kelas yang diajar' : 'Belum ada absensi kelas hari ini')
    }
    const scopedClass = !ctx.unrestricted && ctx.roles.includes('wali_kelas')
    const clause = scopedClass ? ' AND k.wali_kelas_id = ?' : ''
    const params = scopedClass ? [ctx.today, ctx.session.id] : [ctx.today]
    if (!ctx.unrestricted && !scopedClass) {
      return make(key, ctx.hrefs.has('/dashboard/akademik/absensi') ? '/dashboard/akademik/absensi' : '/dashboard/guru/absensi', '—', 'Ringkasan kehadiran tersedia di modul Absensi')
    }
    const loadAttendance = () => queryOne<{ total: number; hadir: number }>(
      `SELECT COUNT(*) * 3 AS total,
        COALESCE(SUM((a.shubuh = 'H') + (a.ashar = 'H') + (a.maghrib = 'H')), 0) AS hadir
       FROM absensi_harian a
       JOIN riwayat_pendidikan rp ON rp.id = a.riwayat_pendidikan_id
       JOIN kelas k ON k.id = rp.kelas_id
       JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
       WHERE a.tanggal = ?${clause}`,
      params
    )
    const row = scopedClass ? await loadAttendance() : await cached(ctx, 'attendance:academic:all:' + ctx.today, loadAttendance)
    const total = row?.total ?? 0
    return make(key, ctx.hrefs.has('/dashboard/akademik/absensi') ? '/dashboard/akademik/absensi' : '/dashboard/guru/absensi', total ? `${Math.round(((row?.hadir ?? 0) / total) * 100)}%` : '—',
      total ? `${row?.hadir ?? 0} dari ${total} entri kehadiran` : 'Belum ada absensi hari ini')
  }

  if (key === 'schedule') {
    const dayIndex = new Date(`${ctx.today}T12:00:00+07:00`).getUTCDay()
    const isTeacher = !ctx.unrestricted && ctx.roles.includes('guru')
    const isWali = !ctx.unrestricted && !isTeacher && ctx.roles.includes('wali_kelas')
    let clause = ''
    let params: unknown[] = [dayIndex]
    if (isTeacher) {
      const user = await queryOne<{ source_ref_id: string | null }>('SELECT source_ref_id FROM users WHERE id = ?', [ctx.session.id])
      const guruId = Number(user?.source_ref_id)
      if (!Number.isInteger(guruId) || guruId <= 0) return make(key, '/dashboard/guru/absensi', '—', 'Akun belum terhubung ke data guru')
      clause = ' AND j.guru_id = ?'
      params = [dayIndex, guruId]
    } else if (isWali) {
      clause = ' AND k.wali_kelas_id = ?'
      params = [dayIndex, ctx.session.id]
    } else if (!ctx.unrestricted) {
      return make(key, '/dashboard/guru/absensi', '—', 'Jadwal tersedia di modul terkait')
    }
    const rows = await query<{ nama_kelas: string; sesi: string; total: number }>(
      `SELECT k.nama_kelas, j.sesi, COUNT(*) OVER() AS total
       FROM kelas_jadwal_guru_mingguan j JOIN kelas k ON k.id = j.kelas_id
       JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
       WHERE j.hari_index = ?${clause} ORDER BY j.sesi, k.nama_kelas LIMIT 3`, params
    )
    return make(key, ctx.hrefs.has('/dashboard/akademik/kalender-pendidikan') && !isTeacher ? '/dashboard/akademik/kalender-pendidikan' : '/dashboard/guru/absensi',
      String(rows[0]?.total ?? 0), 'Sesi pengajian hari ini', rows.map(row => ({ label: row.nama_kelas, detail: row.sesi })))
  }

  if (key === 'payments') {
    const row = await cached(ctx, `payments:${ctx.monthStart}`, () => queryOne<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(a.amount), 0) AS total, COUNT(DISTINCT p.id) AS count
       FROM finance_payments p JOIN finance_allocations a ON a.payment_id = p.id
       WHERE p.paid_at >= ? AND p.paid_at < ?
         AND p.fund_management = 'KOPERASI' AND p.correction_status != 'FULLY_CORRECTED'
         AND a.target_type = 'OBLIGATION'`,
      [ctx.monthStart, ctx.nextMonthStart]
    ))
    return make(key, '/dashboard/keuangan/status-pembayaran', rupiah(row?.total ?? 0),
      'Penerimaan kewajiban santri', [{ label: `${row?.count ?? 0} pembayaran bulan ini` }])
  }

  if (key === 'wallet') {
    const row = await cached(ctx, `wallet:${ctx.monthStart}`, () => queryOne<{ topup: number; withdrawal: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'IN' AND movement_type IN ('TOPUP_ONLINE', 'TOPUP_CASH') THEN amount ELSE 0 END), 0) AS topup,
         COALESCE(SUM(CASE WHEN direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET' THEN amount ELSE 0 END), 0) AS withdrawal
       FROM finance_wallet_ledger WHERE created_at >= ? AND created_at < ?`,
      [ctx.monthStart, ctx.nextMonthStart]
    ))
    return make(key, '/dashboard/keuangan/uang-jajan', rupiah(row?.topup ?? 0),
      'Top-up dana titipan santri', [{ label: `Penarikan ${rupiah(row?.withdrawal ?? 0)}` }])
  }

  if (key === 'cash') {
    const [sessions, mismatch] = await Promise.all([
      cash ? (ctx.roles.includes('petugas_koperasi') && !ctx.unrestricted
        ? queryOne<{ total: number }>(
            "SELECT COUNT(*) AS total FROM finance_cash_sessions WHERE status = 'OPEN' AND operator_id = ?",
            [ctx.session.id]
          )
        : cached(ctx, 'cash:open', () => queryOne<{ total: number }>(
            "SELECT COUNT(*) AS total FROM finance_cash_sessions WHERE status = 'OPEN'"
          ))) : Promise.resolve(null),
      recon ? reconciliationCount(ctx) : Promise.resolve(null),
    ])
    return make(key, cash ? '/dashboard/koperasi/loket' : '/dashboard/keuangan/rekonsiliasi',
      String(sessions?.total ?? mismatch ?? 0), cash ? 'Sesi kas terbuka' : 'Transaksi perlu diperiksa',
      mismatch !== null && cash ? [{ label: `${mismatch} transaksi perlu diperiksa` }] : [])
  }

  const rows = await query<{ summary: string; created_at: string }>(
    'SELECT summary, created_at FROM activity_log WHERE actor_user_id = ? ORDER BY created_at DESC LIMIT 5',
    [ctx.session.id]
  )
  return make(key, '/dashboard/profil', String(rows.length), 'Aktivitas terakhir akun Anda',
    rows.map(row => ({ label: row.summary, detail: row.created_at.slice(0, 16) })))
}

export async function loadDashboardWidgets(
  session: SessionUser,
  hrefs: Set<string>,
  keys: DashboardWidgetKey[],
  refresh = false
): Promise<DashboardWidgetData[]> {
  const roles = getEffectiveRoles(session)
  const today = toWibDateInputValue()
  const unrestricted = roles.some(role => ['admin', 'pimpinan', 'sekpen', 'dewan_santri', 'keamanan', 'bendahara', 'demo', 'tester', 'akademik'].includes(role))
  const ctx: Context = {
    session, roles, hrefs, today, monthStart: `${today.slice(0, 7)}-01`,
    nextMonthStart: nextMonth(today), asrama: session.asrama_binaan,
    unrestricted, refresh, demo: await isDemoRequest(),
  }
  return Promise.all(keys.map(async key => {
    try { return await loadWidget(key, ctx) }
    catch (error) {
      console.error('[dashboard-widget]', key, error)
      return { ...make(key, null, '—', 'Data belum tersedia'), unavailable: true }
    }
  }))
}
