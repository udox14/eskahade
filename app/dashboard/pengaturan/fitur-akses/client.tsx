'use client'

import { useState, useTransition } from 'react'
import { toggleFiturActive, addRoleToFitur, removeRoleFromFitur, toggleFiturBottomNav, setBottomNavUrutan, toggleBottomNavGlobal, toggleCrudPermission } from './actions'
import { ToggleRight, ToggleLeft, ShieldAlert, Info, Users, CheckCircle2, XCircle, LayoutGrid, Smartphone, ShieldCheck, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Trash2, Search, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrudAction } from '@/lib/auth/crud'

import {
  SquaresFour as LayoutDashboard,
  Users as PhosphorUsers,
  BookOpen,
  ShieldWarning as ShieldWarningIcon,
  FileText,
  Gear as Settings,
  Database as DatabaseIcon,
  CalendarCheck,
  TrendUp as TrendingUp,
  ArrowUp as ArrowUpCircle,
  UserPlus,
  Printer,
  ClipboardText as ClipboardCheck,
  UserCheck,
  MapPin,
  Book,
  UserGear as UserCog,
  Moon,
  Stethoscope,
  Clock,
  Gavel,
  CreditCard,
  List as LayoutList,
  FileXls as FileSpreadsheet,
  Funnel as Filter,
  Envelope as Mail,
  ChartBar as BarChart3,
  Briefcase,
  Wallet,
  Coins,
  ShoppingCart,
  Package,
  Image as ImageIcon,
  GraduationCap as School,
  Palette,
  Archive,
  ForkKnife as Utensils,
  Calendar,
  ArrowsLeftRight as ArrowLeftRight,
  Flame,
  Clipboard as ClipboardList
} from "@phosphor-icons/react";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users: PhosphorUsers, BookOpen, ShieldAlert: ShieldWarningIcon, FileText, Settings,
  Database: DatabaseIcon, CalendarCheck, TrendingUp, ArrowUpCircle, UserPlus,
  Printer, ClipboardCheck, UserCheck, MapPin, Book, UserCog,
  Moon, Stethoscope, Clock, Gavel, CreditCard, LayoutList, FileSpreadsheet,
  Filter, Mail, BarChart3, Briefcase, Wallet, Coins, ShoppingCart, Package,
  ImageIcon, School, Palette, Archive, Utensils, CalendarDays: Calendar, ArrowLeftRight,
  Flame, ClipboardList,
}

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}

const ALL_ROLES = [
  'admin',
  'keamanan',
  'sekpen',
  'dewan_santri',
  'pengurus_asrama',
  'wali_kelas',
  'guru',
  'bendahara',
  'jabatan:anggota',
  'jabatan:ketua',
  'jabatan:sekretaris',
  'jabatan:bendahara',
]

const ROLE_LABEL: Record<string, string> = {
  admin:           'Admin',
  keamanan:        'Keamanan',
  sekpen:          'Sekpen',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Asrama',
  wali_kelas:      'Wali Kelas',
  guru:            'Guru',
  bendahara:       'Bendahara',
  'jabatan:anggota':   'Anggota',
  'jabatan:ketua':      'Ketua',
  'jabatan:sekretaris': 'Sekretaris',
  'jabatan:bendahara':  'Bendahara',
}

const ROLE_LABEL_FULL: Record<string, string> = {
  admin:           'Administrator',
  keamanan:        'Keamanan',
  sekpen:          'SEKPEN',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Pengurus Asrama',
  wali_kelas:      'Wali Kelas',
  guru:            'Guru',
  bendahara:       'Bendahara',
  'jabatan:anggota':   'Jabatan Anggota',
  'jabatan:ketua':      'Jabatan Ketua',
  'jabatan:sekretaris': 'Jabatan Sekretaris',
  'jabatan:bendahara':  'Jabatan Bendahara',
}

const ROLE_COLOR: Record<string, string> = {
  admin:           'bg-red-100 text-red-700 border-red-200',
  keamanan:        'bg-orange-100 text-orange-700 border-orange-200',
  sekpen:          'bg-blue-100 text-blue-700 border-blue-200',
  dewan_santri:    'bg-purple-100 text-purple-700 border-purple-200',
  pengurus_asrama: 'bg-green-100 text-green-700 border-green-200',
  wali_kelas:      'bg-teal-100 text-teal-700 border-teal-200',
  guru:            'bg-indigo-100 text-indigo-700 border-indigo-200',
  bendahara:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  'jabatan:anggota':   'bg-zinc-100 text-zinc-700 border-zinc-200',
  'jabatan:ketua':      'bg-slate-900 text-white border-slate-900',
  'jabatan:sekretaris': 'bg-sky-100 text-sky-700 border-sky-200',
  'jabatan:bendahara':  'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const ROLE_BG_SOFT: Record<string, string> = {
  admin:           'bg-red-50 border-red-200',
  keamanan:        'bg-orange-50 border-orange-200',
  sekpen:          'bg-blue-50 border-blue-200',
  dewan_santri:    'bg-purple-50 border-purple-200',
  pengurus_asrama: 'bg-green-50 border-green-200',
  wali_kelas:      'bg-teal-50 border-teal-200',
  guru:            'bg-indigo-50 border-indigo-200',
  bendahara:       'bg-yellow-50 border-yellow-200',
  'jabatan:anggota':   'bg-zinc-50 border-zinc-200',
  'jabatan:ketua':      'bg-slate-50 border-slate-300',
  'jabatan:sekretaris': 'bg-sky-50 border-sky-200',
  'jabatan:bendahara':  'bg-emerald-50 border-emerald-200',
}

const ROLE_HEADER: Record<string, string> = {
  admin:           'from-red-600 to-red-700',
  keamanan:        'from-orange-500 to-orange-600',
  sekpen:          'from-blue-600 to-blue-700',
  dewan_santri:    'from-purple-600 to-purple-700',
  pengurus_asrama: 'from-green-600 to-green-700',
  wali_kelas:      'from-teal-600 to-teal-700',
  guru:            'from-indigo-600 to-indigo-700',
  bendahara:       'from-yellow-500 to-yellow-600',
  'jabatan:anggota':   'from-zinc-500 to-zinc-600',
  'jabatan:ketua':      'from-slate-700 to-slate-900',
  'jabatan:sekretaris': 'from-sky-500 to-sky-600',
  'jabatan:bendahara':  'from-emerald-500 to-emerald-600',
}

const GROUP_ORDER = [
  '_standalone',
  'Data Santri',
  'Kesantrian',
  'Asrama',
  'Perizinan & Disiplin',
  'Akademik',
  'Pengkelasan',
  'Nilai & Rapor',
  'Absensi Akademik',
  'Absensi',
  'Keuangan Pusat',
  'Keuangan Santri',
  'Keuangan',
  'UPK',
  'EHB',
  'Master Data',
]

interface FiturItem {
  id: number
  group_name: string
  title: string
  href: string
  icon: string
  roles: string[]
  is_active: boolean
  is_bottomnav: boolean
  bottomnav_urutan: number
}

interface CrudPermissionItem {
  fitur_href: string
  role: string
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

interface Props {
  fiturList: FiturItem[]
  globalBottomNavEnabled: boolean
  crudPermissions: CrudPermissionItem[]
}

function getOrderedGroups(grouped: Map<string, FiturItem[]>) {
  const ordered = GROUP_ORDER.filter(g => grouped.has(g))
  const extra = Array.from(grouped.keys()).filter(g => !GROUP_ORDER.includes(g)).sort()
  return [...ordered, ...extra]
}

function groupFiturList(fiturList: FiturItem[]) {
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturList) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  return grouped
}

function EmptySearchState({ label = 'Tidak ada fitur yang cocok.' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
      {label}
    </div>
  )
}

// ── Tab: Per Fitur ────────────────────────────────────────────────────────────
function TabPerFitur({
  fiturList,
  loadingId,
  pending,
  onToggleActive,
  onToggleRole,
}: {
  fiturList: FiturItem[]
  loadingId: string | null
  pending: boolean
  onToggleActive: (f: FiturItem) => void
  onToggleRole: (f: FiturItem, role: string) => void
}) {
  const grouped = groupFiturList(fiturList)
  const groups = getOrderedGroups(grouped)

  return (
    <div className="space-y-4">
      {fiturList.length === 0 && <EmptySearchState />}

      {groups.map(group => (
        <div key={group} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">
              {group === '_standalone' ? 'Menu Utama' : group}
            </h2>
            <span className="ml-auto text-xs text-slate-400">{grouped.get(group)!.length} fitur</span>
          </div>

          <div className="divide-y divide-slate-100">
            {grouped.get(group)!.map(fitur => (
              <div
                key={fitur.id}
                className={cn(
                  "grid gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(220px,1fr)_minmax(360px,2fr)_auto] lg:items-center",
                  !fitur.is_active && "bg-slate-50/80 opacity-70"
                )}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm">{fitur.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{fitur.href}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map(role => {
                    const hasRole = fitur.roles.includes(role)
                    const isAdmin = role === 'admin'
                    const isLoading = loadingId === `role-${fitur.id}-${role}`
                    return (
                      <button
                        key={role}
                        onClick={() => onToggleRole(fitur, role)}
                        disabled={isAdmin || isLoading || pending}
                        title={isAdmin ? 'Admin selalu punya akses' : hasRole ? `Cabut akses ${ROLE_LABEL[role]}` : `Beri akses ${ROLE_LABEL[role]}`}
                        className={cn(
                          "text-[11px] px-2 py-1 rounded-full border font-semibold transition-all duration-200",
                          isLoading && "opacity-50 cursor-wait",
                          isAdmin
                            ? "cursor-not-allowed opacity-80 " + ROLE_COLOR[role]
                            : hasRole
                              ? cn(ROLE_COLOR[role], "hover:opacity-75")
                              : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {isLoading ? '...' : ROLE_LABEL[role]}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => onToggleActive(fitur)}
                  disabled={loadingId === `active-${fitur.id}` || pending}
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 lg:ml-auto",
                    loadingId === `active-${fitur.id}` && "opacity-50 cursor-wait",
                    fitur.is_active
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  )}
                >
                  {fitur.is_active
                    ? <><ToggleRight className="w-4 h-4" /> Aktif</>
                    : <><ToggleLeft className="w-4 h-4" /> Nonaktif</>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Per Role ─────────────────────────────────────────────────────────────
function TabPerRole({ fiturList }: { fiturList: FiturItem[] }) {
  const [selectedRole, setSelectedRole] = useState<string>('sekpen')

  // Kelompokkan fitur yang dimiliki role terpilih, per grup
  const fiturForRole = fiturList.filter(f => f.roles.includes(selectedRole))
  const grouped = groupFiturList(fiturForRole)
  const groups = getOrderedGroups(grouped)

  const totalAktif   = fiturForRole.filter(f => f.is_active).length
  const totalNonaktif = fiturForRole.filter(f => !f.is_active).length

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {ALL_ROLES.map(role => {
          const count = fiturList.filter(f => f.roles.includes(role) && f.is_active).length
          const isSelected = selectedRole === role
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all duration-200",
                isSelected
                  ? `bg-gradient-to-br ${ROLE_HEADER[role]} text-white border-transparent shadow-sm`
                  : `bg-white ${ROLE_BG_SOFT[role]} hover:shadow-sm`
              )}
            >
              <span>{ROLE_LABEL[role]}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", isSelected ? "bg-white/20 text-white" : "bg-white/80 text-slate-500")}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Summary bar */}
      <div className={cn(
        "flex items-center gap-4 px-5 py-3 rounded-xl border",
        ROLE_BG_SOFT[selectedRole]
      )}>
        <div className={cn("w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0", ROLE_HEADER[selectedRole])}>
          <Users className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-800 text-sm">{ROLE_LABEL_FULL[selectedRole]}</div>
          <div className="text-xs text-slate-500">
            {fiturForRole.length} fitur diberikan akses
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {totalAktif} aktif
          </div>
          {totalNonaktif > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <XCircle className="w-3.5 h-3.5" />
              {totalNonaktif} nonaktif
            </div>
          )}
        </div>
      </div>

      {/* Daftar fitur per grup untuk role terpilih */}
      {fiturForRole.length === 0 ? (
        <EmptySearchState label="Tidak ada fitur untuk role ini pada pencarian sekarang." />
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {group === '_standalone' ? 'Menu Utama' : group}
                </span>
                <span className="ml-auto text-xs text-slate-400">{grouped.get(group)!.length} fitur</span>
              </div>
              <div className="divide-y divide-gray-50">
                {grouped.get(group)!.map(fitur => (
                  <div
                    key={fitur.id}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 transition-colors",
                      !fitur.is_active && "opacity-50"
                    )}
                  >
                    {/* Status dot */}
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      fitur.is_active ? "bg-green-400" : "bg-red-300"
                    )} />

                    {/* Nama fitur */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800">{fitur.title}</span>
                      <span className="text-xs text-slate-400 font-mono ml-2 hidden sm:inline">{fitur.href}</span>
                    </div>

                    {/* Badge status */}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full border font-medium shrink-0",
                      fitur.is_active
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-500 border-red-200"
                    )}>
                      {fitur.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fitur yang TIDAK dimiliki role ini */}
      {(() => {
        const tidakPunya: FiturItem[] = []
        if (tidakPunya.length === 0) return null
        return (
          <details className="group">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-medium px-1 py-2 flex items-center gap-1.5 select-none">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Lihat {tidakPunya.length} fitur yang tidak dapat diakses role ini
            </summary>
            <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden opacity-50">
              <div className="divide-y divide-gray-50">
                {tidakPunya.map(fitur => (
                  <div key={fitur.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-sm text-slate-500">{fitur.title}</span>
                    <span className="text-xs text-slate-400 font-mono ml-auto hidden sm:inline">{fitur.href}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )
      })()}
    </div>
  )
}

// ── Tab: CRUD ────────────────────────────────────────────────────────────────
function TabCrudMatrix({
  fiturList,
  crudPermissions,
  loadingId,
  pending,
  onToggleCrud,
}: {
  fiturList: FiturItem[]
  crudPermissions: CrudPermissionItem[]
  loadingId: string | null
  pending: boolean
  onToggleCrud: (fitur: FiturItem, role: string, action: CrudAction, currentValue: boolean) => void
}) {
  const [selectedRole, setSelectedRole] = useState<string>('sekpen')
  const crudMap = new Map(crudPermissions.map(p => [`${p.fitur_href}::${p.role}`, p]))
  const fiturForRole = fiturList.filter(f => f.roles.includes(selectedRole))

  function hasCrud(fitur: FiturItem, role: string, action: CrudAction) {
    if (role === 'admin') return true
    const row = crudMap.get(`${fitur.href}::${role}`)
    if (!row) return false
    if (action === 'create') return row.can_create
    if (action === 'update') return row.can_update
    return row.can_delete
  }

  const grouped = groupFiturList(fiturForRole)
  const groups = getOrderedGroups(grouped)
  const actionLabels: { action: CrudAction; label: string; title: string }[] = [
    { action: 'create', label: 'C', title: 'Create / tambah / import / catat' },
    { action: 'update', label: 'U', title: 'Update / simpan / verifikasi / reset' },
    { action: 'delete', label: 'D', title: 'Delete / hapus / batalkan' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {ALL_ROLES.map(role => {
          const isSelected = selectedRole === role
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-center transition-all duration-200 text-xs font-bold",
                isSelected
                  ? `bg-gradient-to-br ${ROLE_HEADER[role]} text-white border-transparent shadow-sm`
                  : `bg-white ${ROLE_BG_SOFT[role]} hover:shadow-sm`
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {ROLE_LABEL[role]}
            </button>
          )
        })}
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <span>
          <strong>R</strong> tetap diatur dari tab Per Fitur. Di sini admin mengatur <strong>C/U/D</strong> untuk role terpilih. Admin selalu full CRUD.
        </span>
      </div>

      {fiturForRole.length === 0 && <EmptySearchState label="Tidak ada izin CRUD untuk role ini pada pencarian sekarang." />}

      {groups.map(group => (
        <div key={group} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">
              {group === '_standalone' ? 'Menu Utama' : group}
            </h2>
            <span className="ml-auto text-xs text-slate-400">{grouped.get(group)!.length} fitur</span>
          </div>

          <div className="divide-y divide-gray-50">
            {grouped.get(group)!.map(fitur => (
              <div key={fitur.id} className={cn("flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center", !fitur.is_active && "bg-slate-50/80 opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 text-sm">{fitur.title}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{fitur.href}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-blue-50 border-blue-200 text-blue-700 text-xs font-black">
                    R
                  </span>
                  {actionLabels.map(item => {
                    const value = hasCrud(fitur, selectedRole, item.action)
                    const key = `crud-${fitur.href}-${selectedRole}-${item.action}`
                    const disabled = selectedRole === 'admin' || loadingId === key || pending
                    return (
                      <button
                        key={item.action}
                        onClick={() => onToggleCrud(fitur, selectedRole, item.action, value)}
                        disabled={disabled}
                        title={selectedRole === 'admin' ? 'Admin selalu full CRUD' : item.title}
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-black transition-all",
                          loadingId === key && "opacity-50 cursor-wait",
                          disabled && selectedRole === 'admin' && "cursor-not-allowed",
                          value
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            : "bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                        )}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Bottom Nav ───────────────────────────────────────────────────────────
function TabBottomNav({
  fiturList,
  loadingId,
  pending,
  globalEnabled,
  togglingGlobal,
  onToggleGlobal,
  onToggleBottomNav,
  onSetUrutan,
}: {
  fiturList: FiturItem[]
  loadingId: string | null
  pending: boolean
  globalEnabled: boolean
  togglingGlobal: boolean
  onToggleGlobal: () => void
  onToggleBottomNav: (f: FiturItem) => void
  onSetUrutan: (f: FiturItem, urutan: number) => void
}) {
  const [selectedRole, setSelectedRole] = useState<string>('sekpen')

  // Hitung berapa fitur is_bottomnav per role (kecuali dashboard)
  const roleCount: Record<string, number> = {}
  for (const f of fiturList) {
    if (!f.is_bottomnav || f.href === '/dashboard' || !f.is_active) continue
    for (const role of f.roles) {
      roleCount[role] = (roleCount[role] ?? 0) + 1
    }
  }

  // Filter fitur yang dimiliki role terpilih
  const roleFiturs = fiturList.filter(
    f => f.roles.includes(selectedRole) && f.is_active && f.href !== '/dashboard'
  )

  // Bagi fitur yang aktif di bottom nav dan yang tidak
  const activeItems = roleFiturs
    .filter(f => f.is_bottomnav)
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)

  const otherItems = roleFiturs
    .filter(f => !f.is_bottomnav)
    .sort((a, b) => a.title.localeCompare(b.title))

  // Bagi secara simetris ke kiri dan kanan untuk Mock Preview
  const midIndex = Math.ceil(activeItems.length / 2)
  const leftItems = activeItems.slice(0, midIndex)
  const rightItems = activeItems.slice(midIndex)

  // Handler geser urutan
  const handleMove = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= activeItems.length) return

    const item1 = activeItems[index]
    const item2 = activeItems[targetIndex]

    // Set new sequential orders to guarantee uniqueness
    const u1 = targetIndex + 1
    const u2 = index + 1

    onSetUrutan(item1, u1)
    onSetUrutan(item2, u2)
  }

  const renderEmptySlot = () => (
    <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg w-full h-[40px] opacity-40 select-none bg-slate-50">
      <span className="text-[12px] font-bold text-slate-400">+</span>
      <span className="text-[7.5px] font-medium text-slate-400">Kosong</span>
    </div>
  )

  const renderPreviewItem = (item: FiturItem, index: number) => {
    const Icon = getIcon(item.icon)
    const isFirst = index === 0
    const isLast = index === activeItems.length - 1
    const isLoading = loadingId === `bottomnav-${item.id}` || loadingId === `urutan-${item.id}`

    return (
      <div className="group/item flex flex-col items-center justify-center gap-0.5 w-full h-full relative p-0.5 rounded-lg hover:bg-slate-50 transition-colors">
        <div className="p-0.5 text-slate-500">
          <Icon className="w-4.5 h-4.5" weight="duotone" />
        </div>
        <span className="text-[8px] font-semibold text-slate-500 truncate max-w-[48px] px-0.5">
          {item.title}
        </span>

        {/* Action Controls Overlay on Hover */}
        <div className="absolute inset-0 bg-white/95 rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 shadow-sm border border-slate-100">
          {!isFirst && (
            <button
              onClick={() => handleMove(index, 'left')}
              disabled={isLoading || pending}
              className="w-4.5 h-4.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30"
              title="Geser Kiri"
            >
              <ArrowLeft className="w-2.5 h-2.5" />
            </button>
          )}
          
          <button
            onClick={() => onToggleBottomNav(item)}
            disabled={isLoading || pending}
            className="w-4.5 h-4.5 rounded bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30"
            title="Hapus"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>

          {!isLast && (
            <button
              onClick={() => handleMove(index, 'right')}
              disabled={isLoading || pending}
              className="w-4.5 h-4.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30"
              title="Geser Kanan"
            >
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Toggle Global */}
      <div className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${
        globalEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
      }`}>
        <div>
          <p className="text-sm font-bold text-slate-800">Bottom Nav — Aktif Global</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {globalEnabled
              ? 'Bottom nav tampil untuk semua user (sesuai preferensi masing-masing).'
              : 'Bottom nav disembunyikan dari semua user, apapun preferensi mereka.'}
          </p>
        </div>
        <button
          onClick={onToggleGlobal}
          disabled={togglingGlobal}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            globalEnabled ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            globalEnabled ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
        <Smartphone className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
        <span>
          Slot 1, 2, 4, dan 5 diisi fitur yang ditandai di sini. <strong>Slot ke-3 (tengah) selalu &quot;MENU&quot;</strong> yang mengarah ke halaman Dashboard.
          Tiap role hanya melihat fitur yang ia miliki sekaligus ditandai bottom nav. Maksimal <strong>4 fitur aktif per role</strong>.
        </span>
      </div>

      {/* Grid Ringkasan Per Role sekaligus selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          Pilih Role untuk Dikonfigurasi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(ROLE_LABEL).map(([role, label]) => {
            const count = roleCount[role] ?? 0
            const over = count > 4
            const isSelected = selectedRole === role
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all duration-200 relative group cursor-pointer",
                  isSelected
                    ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20"
                    : over 
                      ? "bg-amber-50 border-amber-200 hover:border-amber-300"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                )}
              >
                <span className={cn(
                  "font-semibold block mb-0.5 text-xs transition-colors",
                  isSelected 
                    ? "text-emerald-700" 
                    : ROLE_COLOR[role]?.split(' ')[1] ?? "text-slate-700"
                )}>
                  {label}
                </span>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isSelected
                    ? "text-emerald-600 font-semibold"
                    : over
                      ? "text-amber-600 font-bold"
                      : "text-slate-500"
                )}>
                  {count} / 4 slot terpakai
                </span>

                {/* Check indicator */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel untuk role terpilih */}
      <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-5 mt-2 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/65 pb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Pengaturan Bottom Nav — {ROLE_LABEL[selectedRole]}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur menu pintasan bawah yang muncul khusus untuk role <strong>{ROLE_LABEL[selectedRole]}</strong>.
            </p>
          </div>
          <div className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border font-bold w-fit",
            activeItems.length > 4 
              ? "bg-amber-100 border-amber-200 text-amber-800" 
              : "bg-emerald-100 border-emerald-200 text-emerald-800"
          )}>
            {activeItems.length} / 4 Slot Terpakai
          </div>
        </div>

        {/* LIVE SMARTPHONE PREVIEW */}
        <div className="flex flex-col items-center justify-center bg-slate-100/30 rounded-xl py-6 border border-slate-200/50 shadow-inner">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Live Preview (Tampilan Mobile)
          </p>
          
          {/* Smartphone Frame Mockup */}
          <div className="w-[300px] border-[6px] border-slate-800 rounded-[28px] bg-slate-50 shadow-xl overflow-hidden relative flex flex-col justify-between h-[160px] ring-4 ring-slate-800/10">
            {/* Phone Screen Mockup Content */}
            <div className="p-3.5 flex-1 flex flex-col justify-start space-y-2 opacity-[0.15] select-none pointer-events-none">
              <div className="h-2 w-1/3 bg-slate-400 rounded"></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-6 bg-slate-300 rounded"></div>
                <div className="h-6 bg-slate-300 rounded"></div>
                <div className="h-6 bg-slate-300 rounded"></div>
              </div>
              <div className="h-5 bg-slate-300 rounded w-full"></div>
            </div>

            {/* Live Bottom Nav Mockup */}
            <div className="bg-white border-t border-slate-100 h-14 w-full shrink-0 relative z-10">
              <div className="grid grid-cols-5 h-full relative px-1 items-stretch">
                {/* Slot 1 */}
                <div className="flex items-center justify-center relative">
                  {leftItems[0] ? renderPreviewItem(leftItems[0], 0) : renderEmptySlot()}
                </div>

                {/* Slot 2 */}
                <div className="flex items-center justify-center relative">
                  {leftItems[1] ? renderPreviewItem(leftItems[1], 1) : renderEmptySlot()}
                </div>

                {/* Slot 3: Center MENU */}
                <div className="flex items-center justify-center relative">
                  <div className="flex flex-col items-center justify-end h-full pb-1.5 relative w-full opacity-60">
                    <div className="absolute -top-3.5 w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow border-2 border-white scale-90">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <span className="text-[7.5px] font-black text-emerald-700 tracking-wider">MENU</span>
                  </div>
                </div>

                {/* Slot 4 */}
                <div className="flex items-center justify-center relative">
                  {rightItems[0] ? renderPreviewItem(rightItems[0], 2) : renderEmptySlot()}
                </div>

                {/* Slot 5 */}
                <div className="flex items-center justify-center relative">
                  {rightItems[1] ? renderPreviewItem(rightItems[1], 3) : renderEmptySlot()}
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-[10px] text-slate-400 mt-3 text-center px-4">
            Arahkan kursor ke menu preview di atas untuk menggeser (<strong className="text-slate-600">← →</strong>) atau menghapus (<strong className="text-red-500">×</strong>).
          </p>
        </div>

        {/* Warning jika melebihi 4 */}
        {activeItems.length > 4 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 animate-pulse">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <span>
              <strong>Peringatan:</strong> Batas maksimal adalah 4 menu.
              Hanya 4 menu pertama (urutan terkecil) yang akan ditampilkan pada aplikasi mobile. Silakan hapus atau sesuaikan urutan.
            </span>
          </div>
        )}

        {/* LIST ITEM AKTIF */}
        <div className="space-y-3.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Menu Aktif di Bottom Nav ({activeItems.length})
          </p>
          
          {activeItems.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-xs">
              Belum ada menu bottom nav yang diaktifkan untuk role ini.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm">
              {activeItems.map((fitur, idx) => {
                const isLoading = loadingId === `bottomnav-${fitur.id}` || loadingId === `urutan-${fitur.id}`
                const isFirst = idx === 0
                const isLast = idx === activeItems.length - 1
                
                return (
                  <div key={fitur.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMove(idx, 'left')}
                        disabled={isFirst || isLoading || pending}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 transition-colors cursor-pointer"
                        title="Geser Naik"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'right')}
                        disabled={isLast || isLoading || pending}
                        className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-30 transition-colors cursor-pointer"
                        title="Geser Turun"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Nama & href */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 block sm:inline">{fitur.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono sm:ml-2 block sm:inline truncate">{fitur.href}</span>
                    </div>

                    {/* Hapus Button */}
                    <button
                      onClick={() => onToggleBottomNav(fitur)}
                      disabled={isLoading || pending}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-40 shrink-0 font-medium cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* LIST ITEM YANG BISA DITAMBAHKAN */}
        <div className="space-y-3.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Tambah Menu Lainnya ({otherItems.length})
          </p>
          
          {otherItems.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl py-6 text-center text-slate-400 text-xs">
              Semua fitur akses role ini sudah ada di bottom nav.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto scrollbar-thin shadow-sm">
              {otherItems.map(fitur => {
                const isLoading = loadingId === `bottomnav-${fitur.id}`
                return (
                  <div key={fitur.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="w-16 shrink-0 hidden sm:block"></div> {/* Spacer to match the order alignment */}
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-700 block sm:inline">{fitur.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono sm:ml-2 block sm:inline truncate">{fitur.href}</span>
                    </div>

                    <button
                      onClick={() => onToggleBottomNav(fitur)}
                      disabled={isLoading || pending}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-40 shrink-0 font-medium cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tambahkan</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function FiturAksesClient({ fiturList: initial, globalBottomNavEnabled: initialGlobal, crudPermissions: initialCrudPermissions }: Props) {
  const [fiturList, setFiturList] = useState<FiturItem[]>(initial)
  const [crudPermissions, setCrudPermissions] = useState<CrudPermissionItem[]>(initialCrudPermissions)
  const [globalEnabled, setGlobalEnabled] = useState(initialGlobal)
  const [togglingGlobal, setTogglingGlobal] = useState(false)
  const [activeTab, setActiveTab] = useState<'fitur' | 'role' | 'crud' | 'bottomnav'>('fitur')
  const [searchQuery, setSearchQuery] = useState('')
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [resetting, setResetting] = useState(false)
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredFiturList = normalizedSearch
    ? fiturList.filter(fitur => {
        const haystack = `${fitur.title} ${fitur.href} ${fitur.group_name}`.toLowerCase()
        return haystack.includes(normalizedSearch)
      })
    : fiturList
  const showSearch = activeTab !== 'bottomnav'

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleResetDemo() {
    if (!confirm('Reset SEMUA data demo (DEMO_DB) dan isi ulang data sampel? Data demo saat ini akan dihapus. Data ASLI tidak terpengaruh.')) return
    setResetting(true)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Reset gagal')
      showToast(`Data demo di-reset (${json.seeded} seed, ${json.syncedUsers} user demo).`, 'success')
    } catch (e: any) {
      showToast(e?.message || 'Reset gagal', 'error')
    } finally {
      setResetting(false)
    }
  }

  function updateLocal(id: number, updater: (f: FiturItem) => FiturItem) {
    setFiturList(prev => prev.map(f => f.id === id ? updater(f) : f))
  }

  function updateCrudLocal(fiturHref: string, role: string, action: CrudAction, value: boolean) {
    setCrudPermissions(prev => {
      const existing = prev.find(p => p.fitur_href === fiturHref && p.role === role)
      if (existing) {
        return prev.map(p => {
          if (p.fitur_href !== fiturHref || p.role !== role) return p
          return {
            ...p,
            can_create: action === 'create' ? value : p.can_create,
            can_update: action === 'update' ? value : p.can_update,
            can_delete: action === 'delete' ? value : p.can_delete,
          }
        })
      }
      return [
        ...prev,
        {
          fitur_href: fiturHref,
          role,
          can_create: action === 'create' ? value : false,
          can_update: action === 'update' ? value : false,
          can_delete: action === 'delete' ? value : false,
        },
      ]
    })
  }

  function handleToggleActive(fitur: FiturItem) {
    const key = `active-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await toggleFiturActive(fitur.id, fitur.is_active)
        updateLocal(fitur.id, f => ({ ...f, is_active: !f.is_active }))
        showToast(`Fitur "${fitur.title}" ${fitur.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      } catch {
        showToast('Gagal mengubah status fitur', 'error')
      } finally {
        setLoadingId(null)
      }
    })
  }

  async function handleToggleGlobal() {
    setTogglingGlobal(true)
    try {
      await toggleBottomNavGlobal(globalEnabled)
      setGlobalEnabled(v => !v)
      showToast(`Bottom nav ${globalEnabled ? 'dinonaktifkan' : 'diaktifkan'} untuk semua user`)
    } catch {
      showToast('Gagal mengubah setting global', 'error')
    } finally {
      setTogglingGlobal(false)
    }
  }

  function handleToggleBottomNav(fitur: FiturItem) {
    const key = `bottomnav-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await toggleFiturBottomNav(fitur.id, fitur.is_bottomnav)
        updateLocal(fitur.id, f => ({ ...f, is_bottomnav: !f.is_bottomnav }))
        showToast(`"${fitur.title}" ${fitur.is_bottomnav ? 'dihapus dari' : 'ditambahkan ke'} bottom nav`)
      } catch {
        showToast('Gagal mengubah bottom nav', 'error')
      } finally {
        setLoadingId(null)
      }
    })
  }

  function handleSetUrutan(fitur: FiturItem, urutan: number) {
    const key = `urutan-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await setBottomNavUrutan(fitur.id, urutan)
        updateLocal(fitur.id, f => ({ ...f, bottomnav_urutan: urutan }))
        showToast(`Urutan "${fitur.title}" diubah ke ${urutan}`)
      } catch {
        showToast('Gagal mengubah urutan', 'error')
      } finally {
        setLoadingId(null)
      }
    })
  }

  function handleToggleRole(fitur: FiturItem, role: string) {
    if (role === 'admin') return
    const hasRole = fitur.roles.includes(role)
    const key = `role-${fitur.id}-${role}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        if (hasRole) {
          await removeRoleFromFitur(fitur.id, role)
          updateLocal(fitur.id, f => ({ ...f, roles: f.roles.filter(r => r !== role) }))
          showToast(`Role "${ROLE_LABEL[role]}" dihapus dari "${fitur.title}"`)
        } else {
          await addRoleToFitur(fitur.id, role)
          updateLocal(fitur.id, f => ({ ...f, roles: [...f.roles, role] }))
          showToast(`Role "${ROLE_LABEL[role]}" ditambahkan ke "${fitur.title}"`)
        }
      } catch {
        showToast('Gagal mengubah akses role', 'error')
      } finally {
        setLoadingId(null)
      }
    })
  }

  function handleToggleCrud(fitur: FiturItem, role: string, action: CrudAction, currentValue: boolean) {
    if (role === 'admin') return
    const key = `crud-${fitur.href}-${role}-${action}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await toggleCrudPermission(fitur.href, role, action, currentValue)
        updateCrudLocal(fitur.href, role, action, !currentValue)
        showToast(`${action.toUpperCase()} "${fitur.title}" untuk ${ROLE_LABEL[role]} ${currentValue ? 'dinonaktifkan' : 'diaktifkan'}`)
      } catch {
        showToast('Gagal mengubah izin CRUD', 'error')
      } finally {
        setLoadingId(null)
      }
    })
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-sm text-sm font-medium animate-in slide-in-from-top-2 duration-300",
          toast.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <span>
          Perubahan akses tersimpan langsung ke database dan berlaku dalam <strong>±5 menit</strong> setelah cache diperbarui.
          Role <strong>Admin</strong> tidak bisa dicabut aksesnya dari fitur apapun.
        </span>
      </div>

      {/* Reset data demo */}
      <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <div className="flex items-start gap-3 text-sm text-amber-800">
          <RotateCcw className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>Akun Demo</strong> — kosongkan data sandbox lalu isi ulang data sampel.
            Hanya berlaku ke <strong>DEMO_DB</strong>, data asli aman.
          </span>
        </div>
        <button
          type="button"
          onClick={handleResetDemo}
          disabled={resetting}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className={cn("w-4 h-4", resetting && "animate-spin")} />
          {resetting ? 'Mereset…' : 'Reset Data Demo'}
        </button>
      </div>

      {showSearch && (
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari fitur, href, atau grup..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('fitur')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTab === 'fitur'
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          Per Fitur
        </button>
        <button
          onClick={() => setActiveTab('role')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTab === 'role'
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users className="w-4 h-4" />
          Per Role
        </button>
        <button
          onClick={() => setActiveTab('bottomnav')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTab === 'bottomnav'
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Smartphone className="w-4 h-4" />
          Bottom Nav
        </button>
        <button
          onClick={() => setActiveTab('crud')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            activeTab === 'crud'
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          CRUD
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'fitur' ? (
        <TabPerFitur
          fiturList={filteredFiturList}
          loadingId={loadingId}
          pending={pending}
          onToggleActive={handleToggleActive}
          onToggleRole={handleToggleRole}
        />
      ) : activeTab === 'role' ? (
        <TabPerRole fiturList={filteredFiturList} />
      ) : activeTab === 'crud' ? (
        <TabCrudMatrix
          fiturList={filteredFiturList}
          crudPermissions={crudPermissions}
          loadingId={loadingId}
          pending={pending}
          onToggleCrud={handleToggleCrud}
        />
      ) : (
        <TabBottomNav
          fiturList={fiturList}
          loadingId={loadingId}
          pending={pending}
          globalEnabled={globalEnabled}
          togglingGlobal={togglingGlobal}
          onToggleGlobal={handleToggleGlobal}
          onToggleBottomNav={handleToggleBottomNav}
          onSetUrutan={handleSetUrutan}
        />
      )}
    </div>
  )
}
