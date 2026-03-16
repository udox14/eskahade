'use client'

import { useState, useTransition } from 'react'
import { toggleFiturActive, addRoleToFitur, removeRoleFromFitur } from './actions'
import { ToggleRight, ToggleLeft, ShieldAlert, Info, Users, CheckCircle2, XCircle, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const ALL_ROLES = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']

const ROLE_LABEL: Record<string, string> = {
  admin:           'Admin',
  keamanan:        'Keamanan',
  sekpen:          'Sekpen',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Asrama',
  wali_kelas:      'Wali Kelas',
  bendahara:       'Bendahara',
}

const ROLE_LABEL_FULL: Record<string, string> = {
  admin:           'Administrator',
  keamanan:        'Keamanan',
  sekpen:          'Sekretaris Pen.',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Pengurus Asrama',
  wali_kelas:      'Wali Kelas',
  bendahara:       'Bendahara',
}

const ROLE_COLOR: Record<string, string> = {
  admin:           'bg-red-100 text-red-700 border-red-200',
  keamanan:        'bg-orange-100 text-orange-700 border-orange-200',
  sekpen:          'bg-blue-100 text-blue-700 border-blue-200',
  dewan_santri:    'bg-purple-100 text-purple-700 border-purple-200',
  pengurus_asrama: 'bg-green-100 text-green-700 border-green-200',
  wali_kelas:      'bg-teal-100 text-teal-700 border-teal-200',
  bendahara:       'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const ROLE_BG_SOFT: Record<string, string> = {
  admin:           'bg-red-50 border-red-200',
  keamanan:        'bg-orange-50 border-orange-200',
  sekpen:          'bg-blue-50 border-blue-200',
  dewan_santri:    'bg-purple-50 border-purple-200',
  pengurus_asrama: 'bg-green-50 border-green-200',
  wali_kelas:      'bg-teal-50 border-teal-200',
  bendahara:       'bg-yellow-50 border-yellow-200',
}

const ROLE_HEADER: Record<string, string> = {
  admin:           'from-red-600 to-red-700',
  keamanan:        'from-orange-500 to-orange-600',
  sekpen:          'from-blue-600 to-blue-700',
  dewan_santri:    'from-purple-600 to-purple-700',
  pengurus_asrama: 'from-green-600 to-green-700',
  wali_kelas:      'from-teal-600 to-teal-700',
  bendahara:       'from-yellow-500 to-yellow-600',
}

const GROUP_ORDER = ['_standalone', 'Kesantrian', 'Pengkelasan', 'Nilai & Rapor', 'Absensi', 'Keuangan', 'UPK', 'Master Data']

interface FiturItem {
  id: number
  group_name: string
  title: string
  href: string
  roles: string[]
  is_active: boolean
}

interface Props {
  fiturList: FiturItem[]
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
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturList) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  return (
    <div className="space-y-4">
      {/* Legend role */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-xs text-slate-500 font-semibold mr-1">Role:</span>
        {ALL_ROLES.map(r => (
          <span key={r} className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", ROLE_COLOR[r])}>
            {ROLE_LABEL[r]}
          </span>
        ))}
      </div>

      {groups.map(group => (
        <div key={group} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-700 text-sm">
              {group === '_standalone' ? 'Menu Utama' : group}
            </h2>
            <span className="ml-auto text-xs text-slate-400">{grouped.get(group)!.length} fitur</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Fitur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Akses Role</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grouped.get(group)!.map(fitur => (
                  <tr key={fitur.id} className={cn("transition-colors", !fitur.is_active && "bg-slate-50/80 opacity-60")}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{fitur.title}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">{fitur.href}</div>
                    </td>
                    <td className="px-4 py-4">
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
                                "text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-200",
                                isLoading && "opacity-50 cursor-wait",
                                isAdmin
                                  ? "cursor-not-allowed opacity-80 " + ROLE_COLOR[role]
                                  : hasRole
                                    ? cn(ROLE_COLOR[role], "hover:opacity-75 hover:scale-95")
                                    : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                              )}
                            >
                              {isLoading ? '...' : ROLE_LABEL[role]}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onToggleActive(fitur)}
                        disabled={loadingId === `active-${fitur.id}` || pending}
                        className={cn(
                          "flex items-center gap-1.5 ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200",
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturForRole) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  const totalAktif   = fiturForRole.filter(f => f.is_active).length
  const totalNonaktif = fiturForRole.filter(f => !f.is_active).length

  return (
    <div className="space-y-5">

      {/* Role selector cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {ALL_ROLES.map(role => {
          const count = fiturList.filter(f => f.roles.includes(role) && f.is_active).length
          const isSelected = selectedRole === role
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-center transition-all duration-200",
                isSelected
                  ? `bg-gradient-to-br ${ROLE_HEADER[role]} text-white border-transparent shadow-sm scale-105`
                  : `bg-white ${ROLE_BG_SOFT[role]} hover:scale-102 hover:shadow-sm`
              )}
            >
              <span className={cn("text-xs font-bold", isSelected ? "text-white" : "text-slate-700")}>
                {ROLE_LABEL_FULL[role]}
              </span>
              <span className={cn(
                "text-lg font-black leading-none",
                isSelected ? "text-white" : ROLE_COLOR[role].split(' ')[1]
              )}>
                {count}
              </span>
              <span className={cn("text-[10px]", isSelected ? "text-white/70" : "text-slate-400")}>
                fitur aktif
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
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-slate-400 text-sm">
          Role ini belum punya akses ke fitur apapun.
        </div>
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
        const tidakPunya = fiturList.filter(f => !f.roles.includes(selectedRole) && f.is_active)
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

// ── Main Component ────────────────────────────────────────────────────────────
export function FiturAksesClient({ fiturList: initial }: Props) {
  const [fiturList, setFiturList] = useState<FiturItem[]>(initial)
  const [activeTab, setActiveTab] = useState<'fitur' | 'role'>('fitur')
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function updateLocal(id: number, updater: (f: FiturItem) => FiturItem) {
    setFiturList(prev => prev.map(f => f.id === id ? updater(f) : f))
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
      </div>

      {/* Tab content */}
      {activeTab === 'fitur' ? (
        <TabPerFitur
          fiturList={fiturList}
          loadingId={loadingId}
          pending={pending}
          onToggleActive={handleToggleActive}
          onToggleRole={handleToggleRole}
        />
      ) : (
        <TabPerRole fiturList={fiturList} />
      )}
    </div>
  )
}
