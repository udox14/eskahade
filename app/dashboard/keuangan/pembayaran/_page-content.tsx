'use client'

import { useState, useEffect } from 'react'
import { cariSantriKeuangan, getInfoTagihan, bayarTagihan, getMonitoringPembayaran, bayarLunasSetahun } from './actions'
import { Search, Building2, Calendar, CheckCircle, Clock, Home, User, Zap, Filter, ArrowLeft } from 'lucide-react'
import {
  ActionIcon, Badge, Button, Center, Flex, Grid, Group, Loader, NativeSelect, Paper, Progress,
  Stack, Table, Text, TextInput, ThemeIcon, UnstyledButton,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

export default function LoketPembayaranPage() {
  const confirm = useConfirm()
  // --- STATE UTAMA ---
  const [selectedSantri, setSelectedSantri] = useState<any>(null)

  // --- STATE MONITORING (TABEL) ---
  const [tahunTagihan, setTahunTagihan] = useState(new Date().getFullYear())
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterKamar, setFilterKamar] = useState('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')

  const [dataList, setDataList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loadingList, setLoadingList] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // --- STATE PAYMENT FORM ---
  const [infoTagihan, setInfoTagihan] = useState<any>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [nominalCicil, setNominalCicil] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // 1. LOAD MONITORING DATA
  const loadMonitoring = async () => {
    setLoadingList(true)
    const res = await getMonitoringPembayaran(filterAsrama, filterKamar, searchQuery, tahunTagihan)
    setDataList(res)
    setLoadingList(false)
    setHasLoaded(true)
  }

  // 2. LOAD INFO DETAIL SANTRI
  useEffect(() => {
    if (selectedSantri) {
      loadInfo()
    }
  }, [selectedSantri, tahunTagihan])

  const loadInfo = async () => {
    setLoadingInfo(true)
    const res = await getInfoTagihan(selectedSantri.id, selectedSantri.tahun_masuk_fix, tahunTagihan)
    setInfoTagihan(res)
    setLoadingInfo(false)
  }

  // ============================================================
  // FIX TOMBOL BACK HP: Sync view ke browser history
  // ============================================================
  useEffect(() => {
    if (selectedSantri) {
      window.history.pushState({ view: 'DETAIL' }, '')
    }
  }, [selectedSantri])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (!e.state || e.state.view !== 'DETAIL') {
        setSelectedSantri(null)
        setInfoTagihan(null)
        setNominalCicil('')
        loadMonitoring()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  // ============================================================

  // --- HANDLERS ---

  const handleSelect = (s: any) => {
    setSelectedSantri(s)
    setNominalCicil('')
  }

  const handleLunasTahunanSemua = async () => {
    if (!infoTagihan) return
    if (!await confirm(`Lunasi seluruh tagihan tahunan (EHB, Kesehatan, Ekskul) untuk ${selectedSantri.nama_lengkap}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan...")
    const res = await bayarLunasSetahun(selectedSantri.id, tahunTagihan, selectedSantri.tahun_masuk_fix)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.warning(res.error)
    } else {
      toast.success("Lunas Berhasil!", { description: `Total Rp ${res.total?.toLocaleString()} diterima.` })
      loadInfo()
    }
  }

  const handleLunasBangunan = async () => {
    const sisa = infoTagihan.bangunan.sisa
    if (sisa <= 0) return toast.info("Sudah lunas.")

    if (!await confirm(`Lunasi sisa Uang Bangunan sebesar Rp ${sisa.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pelunasan bangunan...")

    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', sisa, null, 'Pelunasan Bangunan')

    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Bangunan Lunas!", { description: "Terima kasih." })
      loadInfo()
    }
  }

  const handleBayarBangunan = async () => {
    const bayar = parseInt(nominalCicil.replace(/\./g, ''))
    if (!bayar || bayar <= 0) return toast.warning("Nominal tidak valid")
    if (bayar > infoTagihan.bangunan.sisa) return toast.warning("Nominal melebihi sisa tagihan!")

    if (!await confirm(`Terima pembayaran Uang Bangunan Rp ${bayar.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, 'BANGUNAN', bayar, null, 'Cicilan Bangunan')
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Berhasil!", { description: "Pembayaran cicilan diterima." })
      setNominalCicil('')
      loadInfo()
    }
  }

  const handleBayarTahunan = async (jenis: string, nominal: number) => {
    if (nominal <= 0) return toast.error("Tarif belum diatur untuk angkatan ini.")
    if (!await confirm(`Terima pembayaran ${jenis} Tahun ${tahunTagihan} sebesar Rp ${nominal.toLocaleString()}?`)) return

    setIsProcessing(true)
    const toastId = toast.loading("Memproses pembayaran...")
    const res = await bayarTagihan(selectedSantri.id, jenis, nominal, tahunTagihan, `Bayar ${jenis} ${tahunTagihan}`)
    setIsProcessing(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal", { description: res.error })
    } else {
      toast.success("Lunas!", { description: `${jenis} tahun ${tahunTagihan} berhasil dibayar.` })
      loadInfo()
    }
  }

  const handleBackToList = () => {
    window.history.back()
  }

  const { paged: pagedDataList, totalPages: totalPagesDataList, safePage: safePageDataList } = usePagination(dataList, pageSize, page)
  return (
    <div className="space-y-8 pb-20">
      {/* HEADER GLOBAL */}
      <DashboardPageHeader
        title="Loket Keuangan Pusat"
        description="Penerimaan Uang Bangunan dan tagihan tahunan."
        action={(
          <Group gap={0} wrap="nowrap"
            style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, padding: 4, background: '#fff', boxShadow: 'var(--mantine-shadow-sm)' }}>
            <Button variant="subtle" color="gray" size="compact-md" onClick={() => setTahunTagihan(t => t - 1)}>−</Button>
            <Text ff="monospace" fw={700} c="indigo.7" px="xs">{tahunTagihan}</Text>
            <Button variant="subtle" color="gray" size="compact-md" onClick={() => setTahunTagihan(t => t + 1)}>+</Button>
          </Group>
        )}
      />

      {/* VIEW 1: TABEL MONITORING & PENCARIAN */}
      {!selectedSantri ? (
        <Stack gap="lg">
          {/* Filter Bar */}
          <Paper withBorder radius="md" p="md" shadow="sm">
            <Flex direction={{ base: 'column', sm: 'row' }} gap="md" align={{ sm: 'flex-end' }}>
              <div style={{ flex: 1, width: '100%' }}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>Cari Nama / NIS</Text>
                <TextInput
                  leftSection={<Search className="w-4 h-4" />}
                  placeholder="Ketik nama santri..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.currentTarget.value)}
                  onKeyDown={e => e.key === 'Enter' && loadMonitoring()}
                />
              </div>
              <div style={{ width: '100%', maxWidth: 220 }}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>Asrama</Text>
                <NativeSelect
                  value={filterAsrama}
                  onChange={e => { setFilterAsrama(e.currentTarget.value); setFilterKamar('SEMUA') }}
                  data={[{ value: 'SEMUA', label: 'Semua Asrama' }, ...ASRAMA_LIST.map(a => ({ value: a, label: a }))]}
                />
              </div>
              <div style={{ width: '100%', maxWidth: 140 }}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>Kamar</Text>
                <NativeSelect
                  value={filterKamar}
                  onChange={e => setFilterKamar(e.currentTarget.value)}
                  data={[{ value: 'SEMUA', label: 'Semua' }, ...Array.from({ length: 30 }, (_, i) => String(i + 1))]}
                />
              </div>
              <Button onClick={loadMonitoring} loading={loadingList} color="indigo" fw={700}>
                Tampilkan
              </Button>
            </Flex>
          </Paper>

          {/* Tabel Santri */}
          <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden' }}>
            {!hasLoaded ? (
              <Stack align="center" py={80} gap="sm" c="dimmed">
                <Filter className="w-12 h-12" color="var(--mantine-color-gray-4)" />
                <Text c="dimmed">Silakan gunakan filter di atas untuk menampilkan data.</Text>
              </Stack>
            ) : dataList.length === 0 ? (
              <Center py={80}><Text c="dimmed">Data tidak ditemukan.</Text></Center>
            ) : (
              <>
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="sm" horizontalSpacing="lg" fz="sm" highlightOnHover>
                    <Table.Thead bg="gray.0">
                      <Table.Tr>
                        <Table.Th>Nama Santri</Table.Th>
                        <Table.Th ta="center">Bangunan</Table.Th>
                        <Table.Th ta="center">Tahunan {tahunTagihan}</Table.Th>
                        <Table.Th ta="right">Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pagedDataList.map((s) => (
                        <Table.Tr key={s.id} onClick={() => handleSelect(s)} style={{ cursor: 'pointer' }}>
                          <Table.Td>
                            <Text fw={700} c="dark.7">{s.nama_lengkap}</Text>
                            <Text size="xs" c="dimmed">{s.asrama} - Kamar {s.kamar}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge size="sm" variant="light" radius="sm"
                              color={s.status_bangunan === 'LUNAS' ? 'green' : s.status_bangunan === 'CICIL' ? 'orange' : 'gray'}>
                              {s.status_bangunan}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group justify="center" gap={4} wrap="nowrap">
                              <BadgeItem label="EHB" active={s.lunas_ehb} />
                              <BadgeItem label="KES" active={s.lunas_kesehatan} />
                              <BadgeItem label="EKS" active={s.lunas_ekskul} />
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Group justify="flex-end" gap={4} c="indigo.6">
                              <Text size="xs" fw={700}>Bayar</Text>
                              <ArrowLeft className="w-3 h-3" style={{ transform: 'rotate(180deg)' }} />
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Pagination
                  currentPage={safePageDataList}
                  totalPages={totalPagesDataList}
                  pageSize={pageSize}
                  total={dataList.length}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                />
              </>
            )}
          </Paper>
        </Stack>
      ) : (
        /* VIEW 2: FORM PEMBAYARAN DETAIL */
        <Stack gap="lg">
          {/* Tombol Kembali */}
          <UnstyledButton onClick={handleBackToList}>
            <Group gap="xs" c="dimmed">
              <ArrowLeft className="w-4 h-4" />
              <Text size="sm" fw={700}>Kembali ke Daftar</Text>
            </Group>
          </UnstyledButton>

          {/* INFO SANTRI */}
          <Paper withBorder radius="md" p="md" shadow="sm">
            <Group gap="md">
              <ThemeIcon size={48} radius="xl" variant="light" color="indigo"><User className="w-6 h-6" /></ThemeIcon>
              <div>
                <Text fw={700} fz="xl" c="dark.7">{selectedSantri.nama_lengkap}</Text>
                <Group gap="md" mt={4} c="dimmed">
                  <Group gap={4}><Calendar className="w-3 h-3" /><Text size="sm">Angkatan {selectedSantri.tahun_masuk_fix}</Text></Group>
                  <Group gap={4}><Home className="w-3 h-3" /><Text size="sm">{selectedSantri.asrama}</Text></Group>
                </Group>
              </div>
            </Group>
          </Paper>

          {loadingInfo ? (
            <Center py={80}><Loader color="indigo" size="xl" /></Center>
          ) : infoTagihan && (
            <Grid gutter="lg">
              {/* KIRI: UANG BANGUNAN (CICILAN) */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden', height: '100%' }}>
                  <Group justify="space-between" p="md" bg="indigo.0" style={{ borderBottom: '1px solid var(--mantine-color-indigo-1)' }}>
                    <Group gap="xs"><Building2 className="w-5 h-5" color="var(--mantine-color-indigo-9)" /><Text fw={700} c="indigo.9">Uang Bangunan</Text></Group>
                    <Badge variant="light" radius="sm" color={infoTagihan.bangunan.status === 'LUNAS' ? 'green' : 'orange'}>
                      {infoTagihan.bangunan.status}
                    </Badge>
                  </Group>
                  <div style={{ padding: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm" c="dimmed">Terbayar</Text>
                        <Text size="sm" fw={700} c="dark.7">
                          {Math.round((infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100)}%
                        </Text>
                      </Group>
                      <Progress value={(infoTagihan.bangunan.sudah_bayar / infoTagihan.bangunan.total_wajib) * 100} color="indigo" size="lg" />
                    </div>

                    <Group justify="space-between" mb="lg" pb="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                      <div>
                        <Text c="gray.5" size="xs" tt="uppercase">Total Wajib</Text>
                        <Text fw={700}>Rp {infoTagihan.bangunan.total_wajib.toLocaleString()}</Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text c="gray.5" size="xs" tt="uppercase">Sisa Tagihan</Text>
                        <Text fw={700} c="red.6">Rp {infoTagihan.bangunan.sisa.toLocaleString()}</Text>
                      </div>
                    </Group>

                    {infoTagihan.bangunan.sisa > 0 ? (
                      <Stack gap="xs">
                        <Group gap="xs" wrap="nowrap">
                          <TextInput
                            type="number"
                            placeholder="Nominal Cicilan..."
                            style={{ flex: 1 }}
                            value={nominalCicil}
                            onChange={e => setNominalCicil(e.currentTarget.value)}
                          />
                          <Button onClick={handleBayarBangunan} disabled={isProcessing} color="indigo" fw={700}>Bayar</Button>
                        </Group>
                        <Button onClick={handleLunasBangunan} disabled={isProcessing} color="green" fw={700} fullWidth
                          leftSection={<Zap className="w-4 h-4" color="var(--mantine-color-yellow-3)" />}>
                          LUNASI SEKARANG (100%)
                        </Button>
                      </Stack>
                    ) : (
                      <Center p="md" bg="green.0" style={{ borderRadius: 8, border: '1px solid var(--mantine-color-green-1)' }}>
                        <Text fw={700} c="green.7">LUNAS</Text>
                      </Center>
                    )}
                  </div>
                </Paper>
              </Grid.Col>

              {/* KANAN: TAGIHAN TAHUNAN */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Group p="md" bg="teal.0" style={{ borderBottom: '1px solid var(--mantine-color-teal-1)' }}>
                    <Group gap="xs"><Calendar className="w-5 h-5" color="var(--mantine-color-teal-9)" /><Text fw={700} c="teal.9">Tagihan Tahunan ({tahunTagihan})</Text></Group>
                  </Group>
                  <div style={{ flex: 1 }}>
                    {['KESEHATAN', 'EHB', 'EKSKUL'].map((jenis, i) => {
                      const data = infoTagihan.tahunan[jenis]
                      return (
                        <Group key={jenis} justify="space-between" p="md"
                          style={{ borderTop: i > 0 ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
                          <div>
                            <Text fw={700} c="dark.6">{jenis === 'EHB' ? 'EHB (Ujian)' : jenis}</Text>
                            <Text size="xs" c="dimmed">Tarif: Rp {data.nominal.toLocaleString()}</Text>
                          </div>
                          {data.lunas ? (
                            <Badge size="lg" radius="xl" variant="light" color="green" leftSection={<CheckCircle className="w-4 h-4" />}>LUNAS</Badge>
                          ) : (
                            <Button size="compact-sm" variant="outline" color="red" fw={700}
                              onClick={() => handleBayarTahunan(jenis, data.nominal)}
                              disabled={isProcessing || data.nominal === 0}
                              leftSection={<Clock className="w-3 h-3" />}>
                              BAYAR
                            </Button>
                          )}
                        </Group>
                      )
                    })}
                  </div>

                  {/* FOOTER: LUNAS SEMUA TAHUNAN */}
                  {(!infoTagihan.tahunan.EHB.lunas || !infoTagihan.tahunan.KESEHATAN.lunas || !infoTagihan.tahunan.EKSKUL.lunas) && (
                    <div style={{ padding: 16, background: 'var(--mantine-color-teal-0)', borderTop: '1px solid var(--mantine-color-teal-1)', marginTop: 'auto' }}>
                      <Button onClick={handleLunasTahunanSemua} disabled={isProcessing} color="teal" fw={700} fullWidth
                        leftSection={<Zap className="w-4 h-4" color="var(--mantine-color-yellow-3)" />}>
                        BAYAR LUNAS SEMUA (TAHUNAN)
                      </Button>
                    </div>
                  )}

                  {Object.values(infoTagihan.tahunan).some((x: any) => x.nominal === 0) && (
                    <Text p="sm" bg="yellow.0" size="xs" ta="center" c="yellow.8" style={{ borderTop: '1px solid var(--mantine-color-yellow-1)' }}>
                      *Jika tarif Rp 0, artinya belum diatur di menu Pengaturan Tarif untuk angkatan ini.
                    </Text>
                  )}
                </Paper>
              </Grid.Col>
            </Grid>
          )}
        </Stack>
      )}
    </div>
  )
}

function BadgeItem({ label, active }: { label: string; active: boolean }) {
  return (
    <Badge size="sm" variant="light" radius="sm" color={active ? 'green' : 'gray'}>
      {label}
    </Badge>
  )
}
