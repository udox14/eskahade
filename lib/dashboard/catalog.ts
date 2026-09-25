export const DASHBOARD_WIDGETS = [
  { key: 'attention', title: 'Perlu perhatian', hrefs: ['/dashboard/keamanan/perizinan', '/dashboard/keuangan/rekonsiliasi'] },
  { key: 'attendance', title: 'Kehadiran hari ini', hrefs: ['/dashboard/akademik/absensi', '/dashboard/asrama/absen-malam'] },
  { key: 'permissions', title: 'Perizinan', hrefs: ['/dashboard/keamanan/perizinan'] },
  { key: 'schedule', title: 'Jadwal hari ini', hrefs: ['/dashboard/guru/absensi', '/dashboard/akademik/kalender-pendidikan'] },
  { key: 'payments', title: 'Pembayaran bulan ini', hrefs: ['/dashboard/keuangan/status-pembayaran'] },
  { key: 'wallet', title: 'Uang jajan bulan ini', hrefs: ['/dashboard/keuangan/uang-jajan'] },
  { key: 'cash', title: 'Loket & rekonsiliasi', hrefs: ['/dashboard/koperasi/loket', '/dashboard/keuangan/rekonsiliasi'] },
  { key: 'activity', title: 'Aktivitas saya', hrefs: [] },
] as const

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]['key']

export const DASHBOARD_ROLES = [
  'admin', 'pimpinan', 'bendahara', 'admin_koperasi', 'petugas_koperasi',
  'dewan_santri', 'pengurus_asrama', 'keamanan', 'sekpen', 'wali_kelas',
  'guru', 'akademik', 'poskestren', 'panitia_upk', 'tester', 'demo',
] as const

const DEFAULTS: Record<string, DashboardWidgetKey[]> = {
  admin: ['attention', 'attendance', 'payments', 'wallet', 'cash', 'activity'],
  pimpinan: ['attention', 'attendance', 'payments', 'wallet', 'cash', 'activity'],
  bendahara: ['payments', 'wallet', 'cash', 'activity'],
  admin_koperasi: ['wallet', 'cash', 'activity'],
  petugas_koperasi: ['wallet', 'cash', 'activity'],
  dewan_santri: ['attention', 'permissions', 'attendance', 'activity'],
  pengurus_asrama: ['attention', 'permissions', 'attendance', 'activity'],
  keamanan: ['attention', 'permissions', 'attendance', 'activity'],
  sekpen: ['attention', 'attendance', 'schedule', 'activity'],
  wali_kelas: ['attendance', 'schedule', 'activity'],
  guru: ['attendance', 'schedule', 'activity'],
  akademik: ['attendance', 'schedule', 'activity'],
  poskestren: ['activity'],
  panitia_upk: ['activity'],
  tester: ['attention', 'attendance', 'payments', 'wallet', 'cash', 'activity'],
  demo: ['attention', 'attendance', 'payments', 'wallet', 'cash', 'activity'],
}

export function defaultWidgetsForRole(role: string): DashboardWidgetKey[] {
  return DEFAULTS[role] ?? ['activity']
}

export function isWidgetKey(value: string): value is DashboardWidgetKey {
  return DASHBOARD_WIDGETS.some(widget => widget.key === value)
}

export function widgetIsAllowed(key: DashboardWidgetKey, allowedHrefs: Set<string>) {
  const widget = DASHBOARD_WIDGETS.find(item => item.key === key)
  return !!widget && (widget.hrefs.length === 0 || widget.hrefs.some(href => allowedHrefs.has(href)))
}
