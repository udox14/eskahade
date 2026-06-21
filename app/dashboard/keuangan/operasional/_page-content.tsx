'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from '@/lib/pdf/client'
import {
  Calendar, CheckCircle2, Eye, Pencil, Plus, Printer, RefreshCw, Save, ShieldCheck, Trash2, Wallet, XCircle,
} from 'lucide-react'
import {
  ActionIcon, Badge, Box, Button, Flex, Grid, Group, Loader, Modal, NativeSelect, Paper,
  SegmentedControl, SimpleGrid, Stack, Table, Text, Textarea, TextInput,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { OperasionalPrintSheet } from '@/components/operasional/ledger-print-sheet'
import { useConfirm } from '@/components/ui/confirm-dialog'
import type {
  OperasionalLedgerData,
  OperasionalPrintPreference,
  OperasionalScope,
  SaveOperasionalAlokasiPayload,
  SaveOperasionalTransaksiPayload,
} from '@/lib/operasional'
import {
  cancelBendaharaAlokasi,
  deleteBendaharaTransaksi,
  getBendaharaOperasionalPageData,
  postBendaharaAlokasi,
  saveBendaharaAlokasi,
  saveBendaharaPrintPrefs,
  saveBendaharaTransaksi,
} from './actions'

type BendaharaPageData = {
  scope: OperasionalScope
  activeUnitId: string | null
  dashboard: Array<{
    unit_id: string
    unit_name: string
    saldo_awal: number
    alokasi_bendahara: number
    pemasukan_lain: number
    pengeluaran: number
    penyesuaian: number
    saldo_akhir: number
    ada_bukti: number
    tanpa_bukti: number
  }>
  ledger: OperasionalLedgerData | null
  printPreferences: OperasionalPrintPreference | null
}

type AllocationForm = {
  id?: string
  unitId: string
  nominal: string
  catatan: string
}

type CorrectionForm = {
  id?: string
  tanggal: string
  kategori: string
  uraian: string
  nominal: string
  partnerName: string
  catatan: string
}

const DEFAULT_PREFS: OperasionalPrintPreference = {
  unit_id: '',
  report_type: 'bendahara',
  scope_key: '',
  slot1_label: '',
  slot1_nama: '',
  slot1_jabatan: '',
  slot2_label: '',
  slot2_nama: '',
  slot2_jabatan: '',
  slot3_label: '',
  slot3_nama: '',
  slot3_jabatan: '',
}

const BULAN_OPTIONS = [
  { value: 1, label: 'JANUARI' }, { value: 2, label: 'FEBRUARI' }, { value: 3, label: 'MARET' },
  { value: 4, label: 'APRIL' }, { value: 5, label: 'MEI' }, { value: 6, label: 'JUNI' },
  { value: 7, label: 'JULI' }, { value: 8, label: 'AGUSTUS' }, { value: 9, label: 'SEPTEMBER' },
  { value: 10, label: 'OKTOBER' }, { value: 11, label: 'NOVEMBER' }, { value: 12, label: 'DESEMBER' },
]

function getTodayValue() {
  return new Date().toISOString().slice(0, 10)
}

function makeAllocationForm(unitId = ''): AllocationForm {
  return { unitId, nominal: '', catatan: '' }
}

function makeCorrectionForm(): CorrectionForm {
  return {
    tanggal: getTodayValue(),
    kategori: 'Penyesuaian',
    uraian: '',
    nominal: '',
    partnerName: '',
    catatan: '',
  }
}

// Warna badge per tipe transaksi
function tipeColor(tipe: string) {
  return tipe === 'PENGELUARAN' ? 'pink' : tipe === 'PEMASUKAN' ? 'teal' : 'yellow'
}
function statusColor(status: string) {
  return status === 'posted' ? 'teal' : status === 'cancelled' ? 'pink' : 'yellow'
}

export default function PageContent({ initialTab = 'monitoring' }: { initialTab?: 'monitoring' | 'alokasi' | 'print' }) {
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [data, setData] = useState<BendaharaPageData | null>(null)
  const [activeTab, setActiveTab] = useState<'monitoring' | 'alokasi' | 'print'>(initialTab)
  const [loading, setLoading] = useState(false)
  const [savingAllocation, setSavingAllocation] = useState(false)
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [allocationForm, setAllocationForm] = useState<AllocationForm>(makeAllocationForm())
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>(makeCorrectionForm())
  const [prefs, setPrefs] = useState<OperasionalPrintPreference>(DEFAULT_PREFS)
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false)
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const confirm = useConfirm()

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data?.ledger ? `Monitoring_Operasional_${data.ledger.unit.name}_${bulan}_${tahun}` : 'Monitoring_Operasional',
  })

  const activeUnitId = data?.activeUnitId || ''
  const ledger = data?.ledger || null
  const dashboard = data?.dashboard || []

  async function load(targetUnitId?: string | null) {
    setLoading(true)
    try {
      const result = await getBendaharaOperasionalPageData(tahun, bulan, targetUnitId || activeUnitId || undefined)
      setData(result)
      setAllocationForm(prev => prev.unitId ? prev : makeAllocationForm(result.activeUnitId || result.scope.defaultUnitId || ''))
      setPrefs(result.printPreferences || DEFAULT_PREFS)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal memuat monitoring operasional.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun, bulan])

  const selectedUnitName = useMemo(
    () => data?.scope.unitOptions.find(unit => unit.id === activeUnitId)?.name || ledger?.unit.name || '-',
    [activeUnitId, data?.scope.unitOptions, ledger?.unit.name]
  )

  async function handleSaveAllocation(postAfterSave = false) {
    if (!allocationForm.unitId) return
    setSavingAllocation(true)
    try {
      const payload: SaveOperasionalAlokasiPayload = {
        id: allocationForm.id,
        tahun,
        bulan,
        unitId: allocationForm.unitId,
        nominal: Number(allocationForm.nominal || 0),
        catatan: allocationForm.catatan,
      }
      const result = await saveBendaharaAlokasi(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (postAfterSave && result.id) {
        const postResult = await postBendaharaAlokasi(result.id)
        if ('error' in postResult) {
          toast.error(postResult.error)
          return
        }
        toast.success('Alokasi berhasil diposting.')
      } else {
        toast.success('Alokasi berhasil disimpan sebagai draft.')
      }
      setAllocationForm(makeAllocationForm(allocationForm.unitId))
      setAllocationModalOpen(false)
      await load(allocationForm.unitId)
    } finally {
      setSavingAllocation(false)
    }
  }

  async function handlePostAllocation(id: string) {
    const result = await postBendaharaAlokasi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Alokasi berhasil diposting.')
    await load(activeUnitId)
  }

  async function handleCancelAllocation(id: string) {
    const ok = await confirm('Batalkan alokasi ini?\nTransaksi sistem terkait akan disembunyikan dari ledger aktif.', { variant: 'warning', confirmLabel: 'Ya, Batalkan' })
    if (!ok) return

    const result = await cancelBendaharaAlokasi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Alokasi berhasil dibatalkan.')
    await load(activeUnitId)
  }

  async function handleSaveCorrection() {
    if (!activeUnitId) return
    setSavingCorrection(true)
    try {
      const payload: SaveOperasionalTransaksiPayload = {
        id: correctionForm.id,
        tanggal: correctionForm.tanggal,
        unitId: activeUnitId,
        tipe: 'PENYESUAIAN',
        kategori: correctionForm.kategori,
        uraian: correctionForm.uraian,
        nominal: Number(correctionForm.nominal || 0),
        partnerName: correctionForm.partnerName,
        catatan: correctionForm.catatan,
      }
      const result = await saveBendaharaTransaksi(payload)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(correctionForm.id ? 'Penyesuaian diperbarui.' : 'Penyesuaian berhasil ditambahkan.')
      setCorrectionForm(makeCorrectionForm())
      setCorrectionModalOpen(false)
      await load(activeUnitId)
    } finally {
      setSavingCorrection(false)
    }
  }

  async function handleDeleteCorrection(id: string) {
    const ok = await confirm('Hapus transaksi penyesuaian ini?', { variant: 'warning', confirmLabel: 'Ya, Hapus' })
    if (!ok) return

    const result = await deleteBendaharaTransaksi(id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Transaksi manual berhasil dihapus.')
    if (correctionForm.id === id) setCorrectionForm(makeCorrectionForm())
    await load(activeUnitId)
  }

  async function handleSavePrefs() {
    if (!activeUnitId) return
    setSavingPrefs(true)
    try {
      await saveBendaharaPrintPrefs({
        ...prefs,
        unit_id: activeUnitId,
        report_type: 'bendahara',
        scope_key: `bendahara:${activeUnitId}`,
      })
      toast.success('Preferensi cetak bendahara tersimpan.')
      setSignatureModalOpen(false)
      await load(activeUnitId)
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menyimpan preferensi cetak.')
    } finally {
      setSavingPrefs(false)
    }
  }

  const activeRow = dashboard.find(row => row.unit_id === activeUnitId)

  return (
    <div className="space-y-6 pb-16">
      <DashboardPageHeader
        title="Operasional Unit"
        description="Buat alokasi bulanan, pantau realisasi pengeluaran, dan cetak laporan operasional per unit."
        action={(
          <Flex direction={{ base: 'column', xs: 'row' }} gap="xs" w={{ base: '100%', xs: 'auto' }}>
            <Group gap="xs" wrap="nowrap"
              style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 12, padding: '6px 12px', background: '#fff', boxShadow: 'var(--mantine-shadow-sm)' }}>
              <Calendar className="h-4 w-4" color="var(--mantine-color-gray-5)" />
              <NativeSelect variant="unstyled" value={String(bulan)} onChange={e => setBulan(Number(e.currentTarget.value) || 1)}
                data={BULAN_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} styles={{ input: { fontWeight: 600, fontSize: 14 } }} />
              <Text c="gray.3">/</Text>
              <TextInput variant="unstyled" type="number" value={tahun} onChange={e => setTahun(Number(e.currentTarget.value) || now.getFullYear())}
                w={64} styles={{ input: { fontWeight: 600, fontSize: 14 } }} />
            </Group>
            <Button onClick={() => load(activeUnitId)} loading={loading} color="dark" fw={600}
              leftSection={!loading && <RefreshCw className="h-4 w-4" />}>
              Muat
            </Button>
          </Flex>
        )}
      />

      <SegmentedControl
        fullWidth
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
        data={[
          { value: 'monitoring', label: 'Monitoring' },
          { value: 'alokasi', label: 'Alokasi' },
          { value: 'print', label: 'Cetak' },
        ]}
      />

      {!data || loading ? (
        <Paper withBorder radius="lg" px="lg" py={64} shadow="sm" ta="center">
          <Loader size="sm" color="gray" mx="auto" mb="sm" />
          <Text size="sm" c="dimmed">Memuat dashboard operasional...</Text>
        </Paper>
      ) : (
        <>
          <Paper withBorder radius="lg" p="md" shadow="sm">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={8}>Unit Dipantau</Text>
            <NativeSelect
              value={activeUnitId}
              onChange={async e => {
                const nextUnitId = e.currentTarget.value
                setAllocationForm(prev => ({ ...prev, unitId: nextUnitId }))
                await load(nextUnitId)
              }}
              data={data.scope.unitOptions.map(unit => ({ value: unit.id, label: unit.name }))}
            />
          </Paper>

          {activeTab === 'monitoring' ? (
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Stack gap="lg">
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
                    <SummaryCard label="Unit Aktif" value={selectedUnitName} tone="gray" />
                    <SummaryCard label="Saldo Awal" value={formatCurrency(ledger?.saldoAwal || 0)} tone="gray" />
                    <SummaryCard label="Pengeluaran" value={formatCurrency(ledger?.totals.pengeluaran || 0)} tone="pink" />
                    <SummaryCard label="Saldo Akhir" value={formatCurrency(ledger?.saldoAkhir || 0)} tone="blue" />
                  </SimpleGrid>

                  {/* REKAP LINTAS UNIT */}
                  <Paper withBorder radius="lg" p="lg" shadow="sm">
                    <Group gap="xs" mb="md">
                      <Eye className="h-4 w-4" color="var(--mantine-color-gray-6)" />
                      <Text fw={600} c="dark.7">Rekap Lintas Unit</Text>
                    </Group>
                    {/* Mobile cards */}
                    <Stack gap="sm" hiddenFrom="md">
                      {dashboard.map(row => (
                        <Paper key={row.unit_id} withBorder radius="lg" p="md" shadow="sm"
                          onClick={() => load(row.unit_id)} style={{ cursor: 'pointer', borderColor: row.unit_id === activeUnitId ? 'var(--mantine-color-dark-9)' : undefined, background: row.unit_id === activeUnitId ? 'var(--mantine-color-gray-0)' : undefined }}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <div style={{ minWidth: 0 }}>
                              <Text fw={600} c="dark.8" truncate>{row.unit_name}</Text>
                              <Text size="xs" c="dimmed" mt={4}>{row.tanpa_bukti > 0 ? `${row.tanpa_bukti} transaksi tanpa bukti` : 'Semua transaksi sudah terbaca'}</Text>
                            </div>
                            <Badge variant="light" color="gray" radius="xl">Buka</Badge>
                          </Group>
                          <Stack gap={8} mt="sm">
                            <InfoRow label="Saldo Awal" value={formatCurrency(row.saldo_awal)} mono />
                            <InfoRow label="Alokasi" value={formatCurrency(row.alokasi_bendahara)} mono valueColor="teal.7" />
                            <InfoRow label="Pemasukan Lain" value={formatCurrency(row.pemasukan_lain)} mono />
                            <InfoRow label="Pengeluaran" value={formatCurrency(row.pengeluaran)} mono valueColor="pink.7" />
                            <InfoRow label="Saldo Akhir" value={formatCurrency(row.saldo_akhir)} mono />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                    {/* Desktop table */}
                    <Table.ScrollContainer minWidth={860} visibleFrom="md">
                      <Table fz="sm" verticalSpacing="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Unit</Table.Th>
                            <Table.Th ta="right">Saldo Awal</Table.Th>
                            <Table.Th ta="right">Alokasi</Table.Th>
                            <Table.Th ta="right">Pemasukan Lain</Table.Th>
                            <Table.Th ta="right">Pengeluaran</Table.Th>
                            <Table.Th ta="right">Saldo Akhir</Table.Th>
                            <Table.Th ta="center">Tanpa Bukti</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {dashboard.map(row => (
                            <Table.Tr key={row.unit_id} bg={row.unit_id === activeUnitId ? 'gray.0' : undefined}>
                              <Table.Td fw={600} c="dark.7">{row.unit_name}</Table.Td>
                              <Table.Td ta="right" ff="monospace">{formatCurrency(row.saldo_awal)}</Table.Td>
                              <Table.Td ta="right" ff="monospace" c="teal.7">{formatCurrency(row.alokasi_bendahara)}</Table.Td>
                              <Table.Td ta="right" ff="monospace">{formatCurrency(row.pemasukan_lain)}</Table.Td>
                              <Table.Td ta="right" ff="monospace" c="pink.7">{formatCurrency(row.pengeluaran)}</Table.Td>
                              <Table.Td ta="right" ff="monospace" fw={600}>{formatCurrency(row.saldo_akhir)}</Table.Td>
                              <Table.Td ta="center">
                                <Button size="compact-xs" variant="default" onClick={() => load(row.unit_id)}>
                                  {row.tanpa_bukti > 0 ? `${row.tanpa_bukti} transaksi` : '0'}
                                </Button>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Paper>

                  {/* DETAIL LEDGER */}
                  <Paper withBorder radius="lg" p="lg" shadow="sm">
                    <Group justify="space-between" mb="md">
                      <Group gap="xs">
                        <Wallet className="h-4 w-4" color="var(--mantine-color-gray-6)" />
                        <Text fw={600} c="dark.7">Detail Ledger {selectedUnitName}</Text>
                      </Group>
                      <Button variant="default" onClick={() => setCorrectionModalOpen(true)} leftSection={<Plus className="h-4 w-4" />}>
                        Penyesuaian
                      </Button>
                    </Group>
                    {/* Mobile cards */}
                    <Stack gap="sm" hiddenFrom="sm">
                      {!ledger || ledger.transactions.length === 0 ? (
                        <Paper withBorder style={{ borderStyle: 'dashed' }} radius="md" px="md" py={32} ta="center">
                          <Text size="sm" c="gray.5">Belum ada transaksi pada unit ini.</Text>
                        </Paper>
                      ) : ledger.transactions.map(row => (
                        <Paper key={row.id} withBorder radius="lg" p="md" shadow="sm">
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <div style={{ minWidth: 0 }}>
                              <Text size="sm" fw={600} c="dark.7" truncate>{row.uraian}</Text>
                              <Text size="xs" c="dimmed" mt={4}>{row.tanggal}</Text>
                            </div>
                            <Badge variant="light" color={tipeColor(row.tipe)} radius="xl">{row.tipe}</Badge>
                          </Group>
                          <Stack gap={8} mt="sm">
                            <InfoRow label="Kategori" value={row.kategori || '-'} />
                            <InfoRow label="Pihak Terkait" value={row.partner_name || '-'} />
                            <InfoRow label="Nominal" value={formatCurrency(row.nominal)} mono valueColor="dark.7" />
                            <InfoRow label="Bukti" value={row.receipt_url ? 'Tersedia' : 'Tanpa bukti'} valueColor={row.receipt_url ? 'blue.7' : 'yellow.8'} />
                          </Stack>
                          <Group gap="xs" mt="md">
                            {row.receipt_url ? (
                              <Button component="a" href={row.receipt_url} target="_blank" rel="noreferrer" size="compact-sm" variant="outline" color="blue">Lihat Bukti</Button>
                            ) : null}
                            {!row.is_system && row.tipe === 'PENYESUAIAN' ? (
                              <>
                                <Button size="compact-sm" variant="default" leftSection={<Pencil className="h-3.5 w-3.5" />}
                                  onClick={() => { setCorrectionForm({ id: row.id, tanggal: row.tanggal, kategori: row.kategori || 'Penyesuaian', uraian: row.uraian, nominal: String(row.nominal), partnerName: row.partner_name || '', catatan: row.catatan || '' }); setCorrectionModalOpen(true) }}>
                                  Edit
                                </Button>
                                <Button size="compact-sm" variant="outline" color="pink" leftSection={<Trash2 className="h-3.5 w-3.5" />}
                                  onClick={() => handleDeleteCorrection(row.id)}>Hapus</Button>
                              </>
                            ) : (
                              <Badge variant="light" color="gray">{row.is_system ? 'Transaksi sistem' : 'Hanya baca'}</Badge>
                            )}
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                    {/* Desktop table */}
                    <Table.ScrollContainer minWidth={760} visibleFrom="sm">
                      <Table fz="sm" verticalSpacing="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Tanggal</Table.Th>
                            <Table.Th>Tipe</Table.Th>
                            <Table.Th>Uraian</Table.Th>
                            <Table.Th ta="right">Nominal</Table.Th>
                            <Table.Th>Bukti</Table.Th>
                            <Table.Th ta="right">Aksi</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {!ledger || ledger.transactions.length === 0 ? (
                            <Table.Tr><Table.Td colSpan={6} ta="center" py={40} c="gray.5">Belum ada transaksi pada unit ini.</Table.Td></Table.Tr>
                          ) : ledger.transactions.map(row => (
                            <Table.Tr key={row.id} style={{ verticalAlign: 'top' }}>
                              <Table.Td c="dimmed">{row.tanggal}</Table.Td>
                              <Table.Td><Badge variant="light" color={tipeColor(row.tipe)} radius="xl">{row.tipe}</Badge></Table.Td>
                              <Table.Td>
                                <Text fw={500} c="dark.7">{row.uraian}</Text>
                                <Text size="xs" c="dimmed">{row.kategori || '-'}{row.partner_name ? ` • ${row.partner_name}` : ''}</Text>
                              </Table.Td>
                              <Table.Td ta="right" ff="monospace" fw={600}>{formatCurrency(row.nominal)}</Table.Td>
                              <Table.Td>
                                {row.receipt_url ? <Text component="a" href={row.receipt_url} target="_blank" rel="noreferrer" c="blue.6">Lihat</Text> : <Text size="xs" c="yellow.7">Tanpa bukti</Text>}
                              </Table.Td>
                              <Table.Td>
                                <Group justify="flex-end" gap="xs">
                                  {!row.is_system && row.tipe === 'PENYESUAIAN' ? (
                                    <>
                                      <ActionIcon variant="default" onClick={() => { setCorrectionForm({ id: row.id, tanggal: row.tanggal, kategori: row.kategori || 'Penyesuaian', uraian: row.uraian, nominal: String(row.nominal), partnerName: row.partner_name || '', catatan: row.catatan || '' }); setCorrectionModalOpen(true) }} aria-label="Edit">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </ActionIcon>
                                      <ActionIcon variant="outline" color="pink" onClick={() => handleDeleteCorrection(row.id)} aria-label="Hapus">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </ActionIcon>
                                    </>
                                  ) : (
                                    <Text size="xs" fw={600} c="gray.5">{row.is_system ? 'Sistem' : 'Read only'}</Text>
                                  )}
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Paper>
                </Stack>
              </Grid.Col>

              {/* SIDE PANEL */}
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <Stack gap="lg">
                  <Paper withBorder radius="lg" p="lg" shadow="sm">
                    <Group justify="space-between" mb="md">
                      <Group gap="xs">
                        <CheckCircle2 className="h-4 w-4" color="var(--mantine-color-gray-6)" />
                        <Text fw={600} c="dark.7">Alokasi Bulan Aktif</Text>
                      </Group>
                      <Button color="dark" onClick={() => setAllocationModalOpen(true)} leftSection={<Plus className="h-4 w-4" />}>Alokasi</Button>
                    </Group>
                    <Stack gap="sm">
                      {!ledger || ledger.allocations.length === 0 ? (
                        <Text size="sm" c="gray.5">Belum ada alokasi untuk unit ini pada periode aktif.</Text>
                      ) : ledger.allocations.map(item => (
                        <Paper key={item.id} withBorder radius="md" p="md">
                          <Group justify="space-between" align="flex-start" gap="sm">
                            <div>
                              <Text fz="lg" fw={600} c="dark.8">{formatCurrency(item.nominal)}</Text>
                              <Text size="sm" c="dimmed">{item.catatan || 'Tanpa catatan.'}</Text>
                            </div>
                            <Group gap="xs">
                              <Badge variant="light" color={statusColor(item.status)} radius="xl">{item.status.toUpperCase()}</Badge>
                              {item.status === 'draft' ? (
                                <Button size="compact-xs" variant="outline" color="teal" leftSection={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => handlePostAllocation(item.id)}>Posting</Button>
                              ) : null}
                              {item.status !== 'cancelled' ? (
                                <Button size="compact-xs" variant="outline" color="pink" leftSection={<XCircle className="h-3.5 w-3.5" />} onClick={() => handleCancelAllocation(item.id)}>Batalkan</Button>
                              ) : null}
                            </Group>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="lg" shadow="sm">
                    <Group gap="xs" mb="md">
                      <ShieldCheck className="h-4 w-4" color="var(--mantine-color-gray-6)" />
                      <Text fw={600} c="dark.7">Catatan Monitoring</Text>
                    </Group>
                    <Stack gap="sm">
                      <InfoRow label="Transaksi dengan bukti" value={`${activeRow?.ada_bukti ?? 0} item`} />
                      <InfoRow label="Transaksi tanpa bukti" value={`${activeRow?.tanpa_bukti ?? 0} item`} />
                      <InfoRow label="Total pemasukan lain" value={formatCurrency(ledger?.totals.pemasukan_lain || 0)} />
                      <InfoRow label="Total penyesuaian" value={formatCurrency(ledger?.totals.penyesuaian || 0)} />
                    </Stack>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          ) : activeTab === 'alokasi' ? (
            <Paper withBorder radius="lg" p="lg" shadow="sm">
              <Flex direction={{ base: 'column', lg: 'row' }} gap="md" align={{ lg: 'flex-start' }} justify={{ lg: 'space-between' }}
                style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 12, background: 'var(--mantine-color-gray-0)', padding: 16 }}>
                <div>
                  <Text fw={500} c="dark.7">Alokasi dikerjakan lewat modal</Text>
                  <Text size="sm" c="dimmed" mt={4}>Halaman alokasi sengaja dibuat lebih lega. Daftar alokasi tetap tampil di tab monitoring.</Text>
                </div>
                <Button color="dark" onClick={() => setAllocationModalOpen(true)} leftSection={<Plus className="h-4 w-4" />} style={{ flexShrink: 0 }}>Buat Alokasi</Button>
              </Flex>
            </Paper>
          ) : (
            <Paper withBorder radius="lg" p="lg" shadow="sm">
              <Flex direction={{ base: 'column', lg: 'row' }} gap="sm" align={{ lg: 'center' }} justify={{ lg: 'space-between' }} mb="md">
                <div>
                  <Text fw={600} c="dark.7">Preview Laporan Bendahara</Text>
                  <Text size="sm" c="dimmed">Cetak per unit dengan format laporan yang formal dan rapi.</Text>
                </div>
                <Flex direction={{ base: 'column', xs: 'row' }} gap="xs">
                  <Button variant="default" onClick={() => setSignatureModalOpen(true)} leftSection={<Pencil className="h-4 w-4" />}>Tanda Tangan</Button>
                  <Button color="dark" onClick={() => handlePrint()} leftSection={<Printer className="h-4 w-4" />}>Cetak</Button>
                </Flex>
              </Flex>

              {ledger ? (
                <Paper withBorder style={{ borderStyle: 'dashed', borderColor: 'var(--mantine-color-gray-4)' }} radius="md" p="md" bg="gray.0">
                  <div style={{ position: 'absolute', left: -99999, top: 0 }}>
                    <OperasionalPrintSheet ref={printRef} ledger={ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" />
                  </div>
                  <Box style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--mantine-color-gray-3)', background: '#fff' }}>
                    <Box style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                      <OperasionalPrintSheet ledger={ledger} preferences={prefs} bulan={bulan} tahun={tahun} subtitle="Laporan Bulanan" preview />
                    </Box>
                  </Box>
                </Paper>
              ) : (
                <Text size="sm" c="gray.5">Pilih unit terlebih dahulu.</Text>
              )}
            </Paper>
          )}
        </>
      )}

      {/* MODAL: ALOKASI */}
      <Modal opened={allocationModalOpen} onClose={() => setAllocationModalOpen(false)} title="Buat Alokasi Operasional" size={672} centered>
        <Stack gap="sm">
          <NativeSelect label="Unit Tujuan" value={allocationForm.unitId} onChange={e => setAllocationForm(prev => ({ ...prev, unitId: e.currentTarget.value }))}
            data={[{ value: '', label: 'Pilih unit' }, ...(data?.scope.unitOptions.map(unit => ({ value: unit.id, label: unit.name })) ?? [])]} />
          <TextInput label="Nominal" type="number" value={allocationForm.nominal} onChange={e => setAllocationForm(prev => ({ ...prev, nominal: e.currentTarget.value }))} />
          <Textarea label="Catatan" minRows={4} autosize value={allocationForm.catatan} onChange={e => setAllocationForm(prev => ({ ...prev, catatan: e.currentTarget.value }))} />
          <Group gap="xs">
            <Button variant="default" loading={savingAllocation} disabled={!allocationForm.unitId || !allocationForm.nominal.trim()} onClick={() => handleSaveAllocation(false)} leftSection={<Save className="h-4 w-4" />}>Simpan Draft</Button>
            <Button color="dark" loading={savingAllocation} disabled={!allocationForm.unitId || !allocationForm.nominal.trim()} onClick={() => handleSaveAllocation(true)} leftSection={<CheckCircle2 className="h-4 w-4" />}>Simpan & Posting</Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: PENYESUAIAN */}
      <Modal opened={correctionModalOpen} onClose={() => setCorrectionModalOpen(false)} title={correctionForm.id ? 'Edit Penyesuaian Saldo' : 'Tambah Penyesuaian Saldo'} size={672} centered>
        <Stack gap="sm">
          <TextInput label="Tanggal" type="date" value={correctionForm.tanggal} onChange={e => setCorrectionForm(prev => ({ ...prev, tanggal: e.currentTarget.value }))} />
          <TextInput label="Kategori" value={correctionForm.kategori} onChange={e => setCorrectionForm(prev => ({ ...prev, kategori: e.currentTarget.value }))} />
          <TextInput label="Uraian" value={correctionForm.uraian} onChange={e => setCorrectionForm(prev => ({ ...prev, uraian: e.currentTarget.value }))} />
          <TextInput label="Nominal" type="number" placeholder="Gunakan negatif untuk pengurang saldo" value={correctionForm.nominal} onChange={e => setCorrectionForm(prev => ({ ...prev, nominal: e.currentTarget.value }))} />
          <TextInput label="Pihak Terkait" value={correctionForm.partnerName} onChange={e => setCorrectionForm(prev => ({ ...prev, partnerName: e.currentTarget.value }))} />
          <Textarea label="Catatan" minRows={4} autosize value={correctionForm.catatan} onChange={e => setCorrectionForm(prev => ({ ...prev, catatan: e.currentTarget.value }))} />
          <Group gap="xs">
            <Button color="dark" loading={savingCorrection} disabled={!activeUnitId || !correctionForm.uraian.trim() || !correctionForm.nominal.trim()} onClick={handleSaveCorrection} leftSection={<Save className="h-4 w-4" />}>
              {correctionForm.id ? 'Simpan Koreksi' : 'Tambah Koreksi'}
            </Button>
            <Button variant="default" onClick={() => { setCorrectionForm(makeCorrectionForm()); setCorrectionModalOpen(false) }}>Batal</Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: TANDA TANGAN */}
      <Modal opened={signatureModalOpen} onClose={() => setSignatureModalOpen(false)} title="Atur Tanda Tangan Laporan" size={672} centered>
        <Stack gap="md">
          {[1, 2, 3].map(index => (
            <Paper key={index} withBorder radius="md" p="sm">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="sm">Kolom {index}</Text>
              <Stack gap="sm">
                <TextInput label="Label" value={prefs[`slot${index}_label` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_label`]: e.currentTarget.value }))} />
                <TextInput label="Nama" value={prefs[`slot${index}_nama` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_nama`]: e.currentTarget.value }))} />
                <TextInput label="Jabatan" value={prefs[`slot${index}_jabatan` as keyof OperasionalPrintPreference] as string} onChange={e => setPrefs(prev => ({ ...prev, [`slot${index}_jabatan`]: e.currentTarget.value }))} />
              </Stack>
            </Paper>
          ))}
          <Group gap="xs">
            <Button color="dark" loading={savingPrefs} disabled={!activeUnitId} onClick={handleSavePrefs} leftSection={<Save className="h-4 w-4" />}>Simpan Preferensi</Button>
            <Button variant="default" onClick={() => setSignatureModalOpen(false)}>Tutup</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'gray' | 'pink' | 'blue' }) {
  return (
    <Paper withBorder radius="lg" p="md" shadow="sm" bg={`${tone}.0`} style={{ borderColor: `var(--mantine-color-${tone}-2)` }}>
      <Text size="xs" fw={700} tt="uppercase" c={`${tone}.7`}>{label}</Text>
      <Text fz="xl" fw={600} mt={8} c={`${tone}.8`}>{value}</Text>
    </Paper>
  )
}

function InfoRow({ label, value, mono, valueColor = 'dark.7' }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="sm" px="sm" py={10}
      style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 12 }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={600} ta="right" c={valueColor} ff={mono ? 'monospace' : undefined}>{value}</Text>
    </Group>
  )
}

function formatCurrency(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`
}
