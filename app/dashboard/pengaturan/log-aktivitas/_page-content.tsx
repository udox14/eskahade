'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Eye, Filter, RotateCcw } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button, TextInput, NativeSelect, SegmentedControl, Switch, Modal } from '@mantine/core'

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

      <SegmentedControl
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'log' | 'settings')}
        data={[
          { label: 'Log', value: 'log' },
          { label: 'Pengaturan', value: 'settings' },
        ]}
      />

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
                      <Switch
                        checked={item.log_create}
                        disabled={isPending}
                        onChange={(e) => handleToggleConfig(item.fitur_href, 'create', e.currentTarget.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={item.log_update}
                        disabled={isPending}
                        onChange={(e) => handleToggleConfig(item.fitur_href, 'update', e.currentTarget.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={item.log_delete}
                        disabled={isPending}
                        onChange={(e) => handleToggleConfig(item.fitur_href, 'delete', e.currentTarget.checked)}
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
              <TextInput
                value={formState.q}
                onChange={(e) => setFormState(current => ({ ...current, q: e.target.value }))}
                placeholder="Cari objek, ID, atau ringkasan"
              />
              <TextInput
                value={formState.actor}
                onChange={(e) => setFormState(current => ({ ...current, actor: e.target.value }))}
                placeholder="Cari user pelaku"
              />
              <NativeSelect
                value={formState.module}
                onChange={(e) => setFormState(current => ({ ...current, module: e.target.value }))}
                data={[
                  { label: 'Semua modul', value: '' },
                  ...modules.map((m) => ({ label: prettifyLabel(m), value: m })),
                ]}
              />
              <NativeSelect
                value={formState.action}
                onChange={(e) => setFormState(current => ({ ...current, action: e.target.value }))}
                data={[
                  { label: 'Semua aksi', value: '' },
                  ...actions.map((a) => ({ label: prettifyLabel(a), value: a })),
                ]}
              />
              <TextInput
                type="date"
                value={formState.startDate}
                onChange={(e) => setFormState(current => ({ ...current, startDate: e.target.value }))}
              />
              <TextInput
                type="date"
                value={formState.endDate}
                onChange={(e) => setFormState(current => ({ ...current, endDate: e.target.value }))}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" color="blue">Terapkan filter</Button>
              <Button
                type="button"
                variant="default"
                onClick={resetFilters}
                leftSection={<RotateCcw className="h-4 w-4" />}
              >
                Reset
              </Button>
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
                        <Button
                          type="button"
                          size="xs"
                          variant="default"
                          onClick={() => setSelected(row)}
                          leftSection={<Eye className="h-3.5 w-3.5" />}
                        >
                          Lihat
                        </Button>
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

      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Detail Log Aktivitas"
        size="xl"
        centered
      >
        {selected && (
          <>
            <p className="mb-4 text-sm text-slate-500">{selected.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
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
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="text-sm font-semibold text-slate-800">Metadata</div>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(selected.details || {}, null, 2)}
              </pre>
            </div>
          </>
        )}
      </Modal>
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
