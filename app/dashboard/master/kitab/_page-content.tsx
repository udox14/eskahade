'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { getMarhalahList, getMapelList, getKitabList, tambahKitab, hapusKitab, importKitabMassal, getTahunAjaranAktif } from './actions'
import { Plus, Trash2, FileSpreadsheet, Download, Upload, CheckCircle, List, CalendarDays, AlertTriangle } from 'lucide-react'
import {
  ActionIcon, Alert, Button, FileButton, Flex, Grid, Group, Loader, NativeSelect, Paper,
  SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import Pagination, { usePagination } from '@/components/ui/pagination'
import Link from 'next/link'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function MasterKitabPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'LIST' | 'IMPORT'>('LIST')

  // Data
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [mapelList, setMapelList] = useState<any[]>([])
  const [kitabList, setKitabList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filter List
  const [filterMarhalah, setFilterMarhalah] = useState('')

  // State Import
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    initData()
  }, [])

  useEffect(() => {
    loadKitab()
  }, [filterMarhalah])

  const initData = async () => {
    const [m, mp, ta] = await Promise.all([getMarhalahList(), getMapelList(), getTahunAjaranAktif()])
    setMarhalahList(m)
    setMapelList(mp)
    setTahunAktif(ta)
  }

  const loadKitab = async () => {
    setLoading(true)
    const res = await getKitabList(filterMarhalah)
    setKitabList(res)
    setLoading(false)
  }

  // --- HANDLER MANUAL ---
  const handleTambah = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const toastId = toast.loading("Menambahkan...")

    const res = await tambahKitab(formData)
    toast.dismiss(toastId)

    if ('error' in res) {
      toast.error(res.error)
    } else {
      toast.success("Kitab ditambahkan")
      loadKitab()
      form.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if (!await confirm("Hapus kitab ini?")) return
    await hapusKitab(id)
    toast.success("Dihapus")
    loadKitab()
  }

  // --- HANDLER EXCEL ---
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA KITAB": "Jurumiyah", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Nahwu" },
      { "NAMA KITAB": "Kailani", "MARHALAH": "Ibtidaiyyah 1", "MAPEL": "Shorof" }
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master Kitab")
    XLSX.writeFile(wb, "Template_Kitab.xlsx")
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setExcelData(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris terbaca`)
    } catch {
      toast.error("Gagal membaca file Excel")
    }
  }

  const handleSimpanImport = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const res = await importKitabMassal(excelData)
    setIsProcessing(false)

    if ((res as any).success) {
      const { inserted, updated, failed } = res as any
      const parts = []
      if (inserted > 0) parts.push(`${inserted} ditambahkan`)
      if (updated > 0) parts.push(`${updated} diperbarui`)
      if (failed > 0) parts.push(`${failed} dilewati`)
      toast.success(`Import selesai: ${parts.join(', ')}`)
      setExcelData([])
      setTab('LIST')
      loadKitab()
    } else {
      toast.error((res as any).error)
    }
  }

  const { paged: pagedKitabList, totalPages: totalPagesKitabList, safePage: safePageKitabList } = usePagination(kitabList, pageSize, page)

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <Flex direction={{ base: 'column', sm: 'row' }} gap="md" align={{ sm: 'flex-start' }} justify={{ sm: 'space-between' }}
        pb="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <DashboardPageHeader
          title="Manajemen Kitab"
          description="Database kitab kuning per marhalah dan mapel. Harga UPK dikelola di Katalog UPK."
          className="flex-1"
        />
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as 'LIST' | 'IMPORT')}
          data={[
            { value: 'LIST', label: <Group gap={6} wrap="nowrap"><List className="w-4 h-4" /> Daftar Kitab</Group> },
            { value: 'IMPORT', label: <Group gap={6} wrap="nowrap"><FileSpreadsheet className="w-4 h-4" /> Import Excel</Group> },
          ]}
        />
      </Flex>

      {/* BANNER TAHUN AJARAN */}
      {tahunAktif ? (
        <Alert color="teal" variant="light" radius="xl" icon={<CalendarDays className="w-5 h-5" />}>
          <Text size="sm" c="teal.9">
            Menampilkan kitab tahun ajaran: <b>{tahunAktif.nama}</b>
            <span style={{ color: 'var(--mantine-color-teal-7)' }}> — Kitab baru otomatis masuk ke tahun ini.</span>
          </Text>
        </Alert>
      ) : (
        <Alert color="yellow" variant="light" radius="xl" icon={<AlertTriangle className="w-5 h-5" />}
          title={<span className="text-amber-800">Belum ada tahun ajaran aktif!</span>}>
          <Text size="xs" c="yellow.8">Kitab tidak bisa ditambahkan sebelum tahun ajaran diaktifkan.</Text>
          <Link href="/dashboard/pengaturan/tahun-ajaran" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-800 underline hover:text-amber-900">
            <CalendarDays className="w-3.5 h-3.5" /> Atur Tahun Ajaran →
          </Link>
        </Alert>
      )}

      {/* --- TAB LIST & INPUT MANUAL --- */}
      {tab === 'LIST' && (
        <Grid gutter="lg">
          {/* FORM INPUT */}
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Paper withBorder radius="md" p="lg" shadow="sm" style={{ position: 'sticky', top: 16 }}>
              <Group gap="xs" mb="md"><Plus className="w-4 h-4" /><Text fw={700} c="dark.6">Tambah Kitab</Text></Group>
              <form onSubmit={handleTambah}>
                <Stack gap="sm">
                  <TextInput name="nama_kitab" required label="Nama Kitab" placeholder="Contoh: Jurumiyah"
                    styles={{ label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mantine-color-dimmed)' } }} />
                  <NativeSelect name="marhalah_id" required label="Tingkat (Marhalah)"
                    data={[{ value: '', label: '-- Pilih --' }, ...marhalahList.map(m => ({ value: String(m.id), label: m.nama }))]}
                    styles={{ label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mantine-color-dimmed)' } }} />
                  <NativeSelect name="mapel_id" required label="Mata Pelajaran"
                    data={[{ value: '', label: '-- Pilih --' }, ...mapelList.map(m => ({ value: String(m.id), label: m.nama }))]}
                    styles={{ label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mantine-color-dimmed)' } }} />
                  <Button type="submit" color="teal" fw={700} fullWidth>Simpan</Button>
                </Stack>
              </form>
            </Paper>
          </Grid.Col>

          {/* TABEL LIST */}
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <Stack gap="md">
              {/* Filter */}
              <Paper withBorder radius="md" p="xs" shadow="sm">
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" fw={700} c="dimmed" ml="xs">Filter:</Text>
                  <NativeSelect variant="unstyled" style={{ flex: 1 }} value={filterMarhalah} onChange={(e) => setFilterMarhalah(e.currentTarget.value)}
                    data={[{ value: '', label: 'Semua Marhalah' }, ...marhalahList.map(m => ({ value: String(m.id), label: m.nama }))]}
                    styles={{ input: { fontWeight: 700 } }} />
                </Group>
              </Paper>

              <Paper withBorder radius="md" shadow="sm" style={{ overflow: 'hidden' }}>
                <Table.ScrollContainer minWidth={420}>
                  <Table verticalSpacing="sm" horizontalSpacing="md" fz="sm" highlightOnHover>
                    <Table.Thead bg="gray.0">
                      <Table.Tr>
                        <Table.Th>Nama Kitab</Table.Th>
                        <Table.Th ta="center">Aksi</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {loading ? (
                        <Table.Tr><Table.Td colSpan={2} ta="center" py={40}><Loader size="sm" color="gray" /></Table.Td></Table.Tr>
                      ) : kitabList.length === 0 ? (
                        <Table.Tr><Table.Td colSpan={2} ta="center" py={40} c="dimmed">Belum ada data.</Table.Td></Table.Tr>
                      ) : (
                        pagedKitabList.map(k => (
                          <Table.Tr key={k.id}>
                            <Table.Td>
                              <Text fw={700} c="dark.7">{k.nama_kitab}</Text>
                              <Text size="xs" c="dimmed">{k.marhalah_nama} • {k.mapel_nama}</Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              <ActionIcon variant="subtle" color="red" onClick={() => handleHapus(k.id)} aria-label="Hapus kitab">
                                <Trash2 className="w-4 h-4" />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Pagination
                  currentPage={safePageKitabList}
                  totalPages={totalPagesKitabList}
                  pageSize={pageSize}
                  total={kitabList.length}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                />
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      )}

      {/* --- TAB 2: IMPORT EXCEL --- */}
      {tab === 'IMPORT' && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Paper radius="md" p="lg" bg="blue.0" style={{ border: '1px solid var(--mantine-color-blue-1)' }}>
              <Stack align="center" gap="sm" ta="center">
                <Download className="w-8 h-8" color="var(--mantine-color-blue-6)" />
                <Text fw={700} c="blue.9">1. Template Data Kitab</Text>
                <Button onClick={downloadTemplate} variant="white" color="blue" size="xs" fw={700}>Download .xlsx</Button>
              </Stack>
            </Paper>
            <Paper radius="md" p="lg" bg="green.0" style={{ border: '1px solid var(--mantine-color-green-1)' }}>
              <Stack align="center" gap="sm" ta="center">
                <Upload className="w-8 h-8" color="var(--mantine-color-green-6)" />
                <Text fw={700} c="green.9">2. Upload Excel</Text>
                <FileButton onChange={handleUpload} accept=".xlsx">
                  {(props) => <Button {...props} color="green" size="xs" fw={700}>Pilih File</Button>}
                </FileButton>
              </Stack>
            </Paper>
          </SimpleGrid>

          {excelData.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" mb="md">
                <Group gap="xs"><CheckCircle className="w-4 h-4" color="var(--mantine-color-green-5)" /><Text fw={700} c="dark.6">Preview ({excelData.length})</Text></Group>
                <Button onClick={handleSimpanImport} loading={isProcessing} color="green" fw={700}>Simpan Semua</Button>
              </Group>
              <Paper withBorder radius="sm" style={{ maxHeight: 256, overflow: 'auto' }}>
                <Table fz="sm" stickyHeader>
                  <Table.Thead>
                    <Table.Tr><Table.Th>Kitab</Table.Th><Table.Th>Marhalah</Table.Th><Table.Th>Mapel</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {excelData.map((d, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{d['NAMA KITAB'] || d['nama kitab']}</Table.Td>
                        <Table.Td>{d['MARHALAH'] || d['marhalah']}</Table.Td>
                        <Table.Td>{d['MAPEL'] || d['mapel']}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Paper>
          )}
        </Stack>
      )}
    </div>
  )
}
