'use client'

import { useState } from 'react'
import { getLaporanKeuangan } from './actions'
import { FileText, Calendar, Download, TrendingUp, Building2, HeartPulse, BookOpen, Trophy, AlertCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  ActionIcon, Badge, Button, Center, Flex, Group, Loader, NativeSelect, Paper, Progress,
  SimpleGrid, Stack, Table, Text, ThemeIcon,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function LaporanKeuanganPage() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetchedTahun, setFetchedTahun] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const loadData = async () => {
    setLoading(true)
    const res = await getLaporanKeuangan(tahun)
    setData(res)
    setFetchedTahun(tahun)
    setPage(1)
    setLoading(false)
  }

  const isDirty = tahun !== fetchedTahun

  const getPaginatedData = () => {
    if (!data?.list) return []
    return data.list.slice((page - 1) * limit, page * limit)
  }

  const totalItems = data?.list?.length || 0
  const totalPages = Math.ceil(totalItems / limit)

  const handleExport = async () => {
    if (!data || data.list.length === 0) return toast.warning('Data kosong')
    const XLSX = await import('xlsx')
    const rows = data.list.map((item: any, idx: number) => ({
      No: idx + 1,
      Tanggal: format(new Date(item.tanggal_bayar), 'dd/MM/yyyy HH:mm'),
      Santri: item.santri?.nama_lengkap,
      NIS: item.santri?.nis,
      Asrama: item.santri?.asrama,
      Jenis: item.jenis_biaya,
      Tahun_Tagihan: item.tahun_tagihan || '-',
      Nominal: item.nominal_bayar,
      Penerima: item.penerima?.full_name || 'Sistem',
      Keterangan: item.keterangan,
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:5},{wch:20},{wch:30},{wch:15},{wch:15},{wch:15},{wch:10},{wch:15},{wch:20},{wch:30}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Laporan ${tahun}`)
    XLSX.writeFile(workbook, `Laporan_Keuangan_${tahun}.xlsx`)
    toast.success('Laporan berhasil didownload')
  }

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER */}
      <DashboardPageHeader
        title="Laporan Keuangan"
        description="Rekapitulasi arus kas dan monitoring tagihan."
        className="border-b pb-4"
        action={(
          <Stack gap="xs" w={{ base: '100%', xs: 'auto' }}>
            <Flex direction={{ base: 'column', xs: 'row' }} gap="xs" align={{ xs: 'center' }}>
              <Group gap={0} wrap="nowrap" justify="space-between"
                style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 12, padding: 4, background: '#fff', boxShadow: 'var(--mantine-shadow-sm)' }}>
                <Button variant="subtle" color="gray" size="compact-md" onClick={() => setTahun(t => t - 1)}>−</Button>
                <Group gap={6} px="xs" wrap="nowrap">
                  <Calendar className="w-4 h-4" color="var(--mantine-color-teal-7)" />
                  <Text ff="monospace" fw={700} c="teal.7">{tahun}</Text>
                </Group>
                <Button variant="subtle" color="gray" size="compact-md" onClick={() => setTahun(t => t + 1)}>+</Button>
              </Group>

              <Button
                onClick={loadData}
                loading={loading}
                fullWidth
                color={isDirty || !data ? 'teal' : 'gray'}
                variant={isDirty || !data ? 'filled' : 'light'}
                fw={700}
                leftSection={!loading && <Search className="w-4 h-4" />}
              >
                {loading ? 'Memuat...' : data ? (isDirty ? 'Perbarui' : 'Muat Ulang') : 'Tampilkan'}
              </Button>
            </Flex>

            <Button
              onClick={handleExport}
              disabled={!data?.list?.length}
              fullWidth
              variant="default"
              fw={700}
              leftSection={<Download className="w-4 h-4" />}
            >
              Export Excel
            </Button>
          </Stack>
        )}
      />

      {/* EMPTY STATE */}
      {!data && !loading && (
        <Stack align="center" justify="center" py={96} gap="md" ta="center">
          <ThemeIcon size={80} radius="xl" variant="light" color="teal">
            <FileText className="w-10 h-10" />
          </ThemeIcon>
          <div>
            <Text size="lg" fw={700} c="dimmed">Laporan belum dimuat</Text>
            <Text size="sm" c="dimmed" mt={4}>Pilih tahun lalu tekan <strong>Tampilkan</strong> untuk memuat laporan keuangan.</Text>
          </div>
          <Button mt="xs" color="teal" size="md" fw={700} onClick={loadData}>
            Tampilkan Laporan {tahun}
          </Button>
        </Stack>
      )}

      {loading && (
        <Stack align="center" justify="center" py={96} gap="sm">
          <Loader color="teal" size="xl" />
          <Text size="sm" c="dimmed">Memuat laporan tahun {tahun}...</Text>
        </Stack>
      )}

      {/* HASIL */}
      {data && !loading && (
        <Stack gap="xl">
          {/* CASH FLOW */}
          <div>
            <Group gap="xs" mb="sm">
              <TrendingUp className="w-4 h-4" />
              <Text fw={700} size="sm" tt="uppercase" c="dark.6" style={{ letterSpacing: '0.03em' }}>Arus Kas Masuk (Cash Flow)</Text>
            </Group>
            <Paper withBorder radius="md" p="lg" shadow="sm"
              style={{ background: 'linear-gradient(to right, var(--mantine-color-teal-0), #fff)', borderColor: 'var(--mantine-color-teal-1)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="teal.6" fw={700} mb={4}>TOTAL TERIMA TAHUN {fetchedTahun}</Text>
                  <Text fz={36} fw={800} c="teal.8">Rp {data.cashFlow.TOTAL.toLocaleString('id-ID')}</Text>
                </div>
                <ThemeIcon size={64} radius="xl" variant="light" color="teal">
                  <TrendingUp className="w-8 h-8" />
                </ThemeIcon>
              </Group>
            </Paper>
          </div>

          {/* ANALISA TARGET */}
          <div>
            <Group gap="xs" mb="sm">
              <Building2 className="w-4 h-4" />
              <Text fw={700} size="sm" tt="uppercase" c="dark.6" style={{ letterSpacing: '0.03em' }}>Analisa Tagihan & Piutang</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
              <StatCard label="Uang Bangunan" icon={Building2} color="indigo" stats={data.targets.BANGUNAN} info="Akumulasi Sepanjang Masa" />
              <StatCard label="Kesehatan" icon={HeartPulse} color="pink" stats={data.targets.KESEHATAN} info={`Tagihan Tahun ${fetchedTahun}`} />
              <StatCard label="EHB (Ujian)" icon={BookOpen} color="blue" stats={data.targets.EHB} info={`Tagihan Tahun ${fetchedTahun}`} />
              <StatCard label="Ekstrakurikuler" icon={Trophy} color="orange" stats={data.targets.EKSKUL} info={`Tagihan Tahun ${fetchedTahun}`} />
            </SimpleGrid>
          </div>

          {/* TABEL RINCIAN */}
          <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden' }}>
            <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align="center" gap="xs"
              px="lg" py="sm" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Rincian Transaksi (Total: {totalItems})</Text>
              <Group gap="xs">
                <Text size="xs" c="dimmed">Tampilkan:</Text>
                <NativeSelect size="xs" value={String(limit)} onChange={e => { setLimit(Number(e.currentTarget.value)); setPage(1) }}
                  data={['10', '20', '50', '100']} w={70} />
              </Group>
            </Flex>

            <Table.ScrollContainer minWidth={720} style={{ minHeight: 300 }}>
              <Table verticalSpacing="sm" horizontalSpacing="lg" fz="sm" highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tanggal</Table.Th>
                    <Table.Th>Nama Santri</Table.Th>
                    <Table.Th>Jenis Biaya</Table.Th>
                    <Table.Th ta="right">Nominal</Table.Th>
                    <Table.Th>Penerima</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {getPaginatedData().length === 0 ? (
                    <Table.Tr><Table.Td colSpan={5} ta="center" py={40} c="dimmed">Belum ada transaksi.</Table.Td></Table.Tr>
                  ) : getPaginatedData().map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td fz="xs" c="dimmed" ff="monospace">
                        {format(new Date(item.tanggal_bayar), 'dd MMM yyyy HH:mm', { locale: id })}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700} c="dark.7">{item.santri?.nama_lengkap}</Text>
                        <Text fz={10} c="dimmed">{item.santri?.asrama} ({item.santri?.nis})</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" radius="sm"
                          color={item.jenis_biaya === 'BANGUNAN' ? 'indigo' : 'gray'}>
                          {item.jenis_biaya} {item.tahun_tagihan ? `(${item.tahun_tagihan})` : ''}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" fw={700} c="dark.6">
                        Rp {item.nominal_bayar.toLocaleString('id-ID')}
                      </Table.Td>
                      <Table.Td fz="xs" c="dimmed">
                        {item.penerima?.full_name?.split(' ')[0]}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {totalItems > limit && (
              <Group justify="space-between" px="lg" py="sm" bg="gray.0" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                <Text size="xs" c="dimmed">Hal {page} dari {totalPages}</Text>
                <Group gap="xs">
                  <ActionIcon variant="default" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Sebelumnya">
                    <ChevronLeft className="w-4 h-4" />
                  </ActionIcon>
                  <ActionIcon variant="default" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Berikutnya">
                    <ChevronRight className="w-4 h-4" />
                  </ActionIcon>
                </Group>
              </Group>
            )}
          </Paper>
        </Stack>
      )}
    </div>
  )
}

function StatCard({ label, icon: Icon, color, stats, info }: any) {
  const percent = stats.target > 0 ? Math.round((stats.terima / stats.target) * 100) : 0
  return (
    <Paper withBorder radius="md" p="lg" shadow="sm">
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <div>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
          <Text fz={10} c="gray.4" mt={2}>{info}</Text>
        </div>
        <ThemeIcon variant="light" color={color} radius="xl" size="lg">
          <Icon className="w-5 h-5" />
        </ThemeIcon>
      </Group>
      <div>
        <Text fz="xl" fw={800} c={`${color}.6`} mb={4}>
          {percent}% <Text span fz="xs" fw={400} c="dimmed">Lunas</Text>
        </Text>
        <Progress value={percent} color={color} size="sm" mb="sm" />
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Target:</Text>
            <Text size="xs" ff="monospace" fw={700}>Rp {stats.target.toLocaleString('id-ID')}</Text>
          </Group>
          <Group justify="space-between" c="red.6">
            <Group gap={4}><AlertCircle className="w-3 h-3" /><Text size="xs" fw={700}>Kurang:</Text></Group>
            <Text size="xs" ff="monospace" fw={700}>Rp {stats.kurang.toLocaleString('id-ID')}</Text>
          </Group>
        </Stack>
      </div>
    </Paper>
  )
}
