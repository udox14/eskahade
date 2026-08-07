import { guardPage } from '@/lib/auth/guard'
import { isDemo } from '@/lib/auth/session'
import { getCachedPsbMonitoring } from '@/lib/pimpinan/cache'
import { PSB_STATUS_ORDER } from '@/lib/pimpinan/psb'
import {
  PageHeader,
  PrintButton,
  KpiCard,
  SectionCard,
  DataTable,
  Badge,
  EmptyState,
} from '../_components/pimpinan-ui'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  VERIFICATION: 'Belum Verifikasi',
  VERIFIED: 'Sudah Verifikasi',
  PLACED_ASRAMA: 'Sudah Asrama',
  PAID: 'Sudah Bayar',
  PLACED_KAMAR: 'Sudah Kamar',
  DONE: 'Selesai',
}

export default async function PimpinanPsbPage() {
  const session = await guardPage('/dashboard/pimpinan/psb')
  const scope = isDemo(session) ? 'demo' : 'live'
  const data = await getCachedPsbMonitoring(scope)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring PSB"
        description="Progress daftar ulang santri baru. Data bersifat baca saja."
        actions={<PrintButton />}
      />

      <div className="print-area space-y-5">
        {data.total === 0 ? (
          <EmptyState
            title="Belum ada peserta PSB"
            description="Data pendaftar PSB akan tampil di sini saat masa pendaftaran berlangsung."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {PSB_STATUS_ORDER.map(status => (
                <KpiCard
                  key={status}
                  label={STATUS_LABEL[status]}
                  value={data.summary[status]}
                  tone={status === 'DONE' ? 'good' : status === 'VERIFICATION' ? 'warn' : 'default'}
                />
              ))}
            </div>

            <KpiCard label="Total Santri Baru" value={data.total} sub="peserta dalam proses PSB" />

            <SectionCard title="Santri Baru Terbaru" subtitle="15 pendaftar terakhir beserta statusnya.">
              <DataTable
                columns={[
                  { label: 'Nama' },
                  { label: 'NIS' },
                  { label: 'Asrama / Kamar' },
                  { label: 'Status' },
                ]}
                empty={data.recent.length === 0}
                emptyText="Belum ada santri dalam proses PSB."
              >
                {data.recent.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{row.nama_lengkap}</td>
                    <td className="px-4 py-3 text-slate-500">{row.nis || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.asrama || '-'}
                      {row.kamar ? ` · ${row.kamar}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.status === 'DONE'
                            ? 'good'
                            : row.status === 'VERIFICATION'
                              ? 'warn'
                              : 'default'
                        }
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  )
}
