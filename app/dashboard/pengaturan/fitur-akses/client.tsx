'use client'

import { useState, useTransition } from 'react'
import { toggleFiturActive, addRoleToFitur, removeRoleFromFitur } from './actions'
import { ToggleRight, ToggleLeft, ShieldAlert, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const ALL_ROLES = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  keamanan: 'Keamanan',
  sekpen: 'Sekpen',
  dewan_santri: 'Dewan Santri',
  pengurus_asrama: 'Asrama',
  wali_kelas: 'Wali Kelas',
  bendahara: 'Bendahara',
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

export function FiturAksesClient({ fiturList: initial }: Props) {
  const [fiturList, setFiturList] = useState<FiturItem[]>(initial)
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
    if (role === 'admin') return // admin selalu punya akses
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

  // Group fitur
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturList) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-top-2 duration-300",
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

      {/* Legend role */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium mr-1">Role:</span>
        {ALL_ROLES.map(r => (
          <span key={r} className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", ROLE_COLOR[r])}>
            {ROLE_LABEL[r]}
          </span>
        ))}
      </div>

      {/* Tabel per grup */}
      {groups.map(group => (
        <div key={group} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700 text-sm">
              {group === '_standalone' ? 'Menu Utama' : group}
            </h2>
            <span className="ml-auto text-xs text-gray-400">{grouped.get(group)!.length} fitur</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Fitur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Akses Role</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grouped.get(group)!.map(fitur => (
                  <tr
                    key={fitur.id}
                    className={cn(
                      "transition-colors",
                      !fitur.is_active && "bg-gray-50/80 opacity-60"
                    )}
                  >
                    {/* Nama fitur */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{fitur.title}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[180px]">{fitur.href}</div>
                    </td>

                    {/* Role toggle buttons */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_ROLES.map(role => {
                          const hasRole = fitur.roles.includes(role)
                          const isAdmin = role === 'admin'
                          const isLoading = loadingId === `role-${fitur.id}-${role}`

                          return (
                            <button
                              key={role}
                              onClick={() => handleToggleRole(fitur, role)}
                              disabled={isAdmin || isLoading || pending}
                              title={isAdmin ? 'Admin selalu punya akses' : hasRole ? `Cabut akses ${ROLE_LABEL[role]}` : `Beri akses ${ROLE_LABEL[role]}`}
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-200",
                                isLoading && "opacity-50 cursor-wait",
                                isAdmin
                                  ? "cursor-not-allowed opacity-80 " + ROLE_COLOR[role]
                                  : hasRole
                                    ? cn(ROLE_COLOR[role], "hover:opacity-75 hover:scale-95")
                                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                              )}
                            >
                              {isLoading ? '...' : ROLE_LABEL[role]}
                            </button>
                          )
                        })}
                      </div>
                    </td>

                    {/* Toggle aktif */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleActive(fitur)}
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
