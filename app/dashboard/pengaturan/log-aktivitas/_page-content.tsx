'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Eye, Filter, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import Pagination from '@/components/ui/pagination'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

import { toggleFeatureLogConfig, type ActivityLogConfigItem, type ActivityLogItem } from './actions'

type Props = {
  rows: ActivityLogItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  filters: {
    module: string
    action: string
    actor: string
    q: string
    startDate: string
    endDate: string
  }
  modules: string[]
  actions: string[]
  configs: ActivityLogConfigItem[]
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function prettifyLabel(value: string) {
  return value
    .split('_')
    .join(' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

export default function PageContent({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  filters,
  modules,
  actions,
  configs,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [selected, setSelected] = useState<ActivityLogItem | null>(null)
  const [formState, setFormState] = useState(filters)
  const [configState, setConfigState] = useState(configs)
  const [activeTab, setActiveTab] = useState<'log' | 'settings'>('log')
  const [isPending, startTransition] = useTransition()

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  )

  function pushWith(next: Record<string, string | number | undefined>) {
    const params = new URLSearchParams()
    const merged = {
      ...formState,
      page,
      pageSize,
      ...next,
    }

    for (const [key, value] of Object.entries(merged)) {
      if (value == null) continue
      const stringValue = String(value).trim()
      if (!stringValue) continue
      params.set(key, stringValue)
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    pushWith({ ...formState, page: 1 })
  }

  function resetFilters() {
    const nextState = {
      module: '',
      action: '',
      actor: '',
      q: '',
      startDate: '',
      endDate: '',
    }
    setFormState(nextState)
    router.push(pathname)
  }

  function handleToggleConfig(fiturHref: string, kind: 'create' | 'update' | 'delete', nextValue: boolean) {
    const previous = configState
    setConfigState(current =>
      current.map((item) => item.fitur_href === fiturHref ? { ...item, [`log_${kind}`]: nextValue } : item)
    )

    startTransition(async () => {
      const result = await toggleFeatureLogConfig(fiturHref, kind, nextValue)
      if (!result?.success) {
        setConfigState(previous)
        toast.error('Gagal mengubah pengaturan log')
        return
      }
      toast.success(`Log ${kind.toUpperCase()} ${nextValue ? 'diaktifkan' : 'dimatikan'}`)
    })
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Log Aktivitas"
        description="Audit trail aksi penting seperti login, perubahan akses, transaksi, dan perubahan data penting."
      />

      <div className="flex flex-wrap gap-2">
        <TabButton
          active={activeTab === 'log'}
          onClick={() => setActiveTab('log')}
        >
          Log
        </TabButton>
        <TabButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          Pengaturan
        </TabButton>
      </div>

      {activeTab === 'settings' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="text-sm font-semibold text-slate-900">Pengaturan Log Per Fitur</div>
            <p className="mt-1 text-sm text-slate-500">
              Admin bisa mengatur logging `create`, `update`, dan `delete` untuk semua fitur yang terdaftar di aplikasi.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Grup</th>
                  <th className="px-4 py-3 font-semibold">Fitur</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold text-center">C</th>
                  <th className="px-4 py-3 font-semibold text-center">U</th>
                  <th className="px-4 py-3 font-semibold text-center">D</th>
                </tr>
              </thead>
              <tbody>
                {configState.map((item) => (
                  <tr key={item.fitur_href} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{item.group_name}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.fitur_href}</td>
                    <td className="px-4 py-3 text-center">
                      <ConfigToggle
                        checked={item.log_create}
                        disabled={isPending}
                        onChange={(nextValue) => handleToggleConfig(item.fitur_href, 'create', nextValue)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ConfigToggle
                        checked={item.log_update}
                        disabled={isPending}
                        onChange={(nextValue) => handleToggleConfig(item.fitur_href, 'update', nextValue)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ConfigToggle
                        checked={item.log_delete}
                        disabled={isPending}
                        onChange={(nextValue) => handleToggleConfig(item.fitur_href, 'delete', nextValue)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="h-4 w-4" />
              <span>Filter log</span>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  {activeFilterCount} aktif
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                value={formState.q}
                onChange={(event) => setFormState(current => ({ ...current, q: event.target.value }))}
                placeholder="Cari objek, ID, atau ringkasan"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={formState.actor}
                onChange={(event) => setFormState(current => ({ ...current, actor: event.target.value }))}
                placeholder="Cari user pelaku"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <select
                value={formState.module}
                onChange={(event) => setFormState(current => ({ ...current, module: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Semua modul</option>
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {prettifyLabel(module)}
                  </option>
                ))}
              </select>
              <select
                value={formState.action}
                onChange={(event) => setFormState(current => ({ ...current, action: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Semua aksi</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {prettifyLabel(action)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={formState.startDate}
                onChange={(event) => setFormState(current => ({ ...current, startDate: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                type="date"
                value={formState.endDate}
                onChange={(event) => setFormState(current => ({ ...current, endDate: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Terapkan filter
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Waktu</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Modul</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                    <th className="px-4 py-3 font-semibold">Objek</th>
                    <th className="px-4 py-3 font-semibold">Ringkasan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Belum ada log yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.actor_name || '-'}</div>
                        {row.actor_roles.length > 0 ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.actor_roles.join(', ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{prettifyLabel(row.module)}</td>
                      <td className="px-4 py-3 text-slate-700">{prettifyLabel(row.action)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.entity_label || '-'}</div>
                        {row.entity_id ? (
                          <div className="mt-1 text-xs text-slate-500">{row.entity_id}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.summary}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage) => pushWith({ page: nextPage })}
              onPageSizeChange={(nextPageSize) => pushWith({ page: 1, pageSize: nextPageSize === 0 ? 100 : nextPageSize })}
            />
          </div>
        </>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detail Log Aktivitas</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <InfoItem label="Waktu" value={formatDateTime(selected.created_at)} />
              <InfoItem label="Status" value={selected.status} />
              <InfoItem label="User" value={selected.actor_name || '-'} />
              <InfoItem label="Role" value={selected.actor_roles.join(', ') || '-'} />
              <InfoItem label="Modul" value={prettifyLabel(selected.module)} />
              <InfoItem label="Aksi" value={prettifyLabel(selected.action)} />
              <InfoItem label="Jenis objek" value={selected.entity_type || '-'} />
              <InfoItem label="Objek" value={selected.entity_label || '-'} />
              <InfoItem label="Entity ID" value={selected.entity_id || '-'} />
            </div>

            <div className="border-t border-slate-200 px-5 py-5">
              <div className="text-sm font-semibold text-slate-800">Metadata</div>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(selected.details || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  )
}

function ConfigToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (nextValue: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        checked
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-600'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:opacity-85'}`}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
