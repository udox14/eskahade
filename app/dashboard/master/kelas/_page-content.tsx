'use client'

import { useState, useEffect } from 'react'
import { getMarhalahList, getKelasList, tambahKelas, hapusKelas, importKelasMassal, getTahunAjaranAktif } from './actions'
import { Trash2, Plus, FileSpreadsheet, Upload, Save, Download, List, CalendarDays, AlertTriangle, Printer } from 'lucide-react'
import {
  Button, NativeSelect, TextInput, Table, Badge, Alert, ActionIcon,
  SegmentedControl, FileButton, Group, Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import Link from 'next/link'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// Konfirmasi hapus berbasis modal Mantine (pengganti window.confirm), tetap return Promise<boolean>
function confirmHapus(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v) } }
    modals.openConfirmModal({
      title: 'Konfirmasi',
      children: <Text size="sm">{message}</Text>,
      labels: { confirm: 'Ya, Hapus', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => done(true),
      onCancel: () => done(false),
      onClose: () => done(false),
    })
  })
}

export default function MasterKelasPage() {
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [kelasList, setKelasList] = useState<any[]>([])
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [m, k, ta] = await Promise.all([getMarhalahList(), getKelasList(), getTahunAjaranAktif()])
    setMarhalahList(m)
    setKelasList(k)
    setTahunAktif(ta)
    setLoading(false)
  }

  const handleTambahManual = async (formData: FormData) => {
    const nid = 'tambah-kelas'
    notifications.show({ id: nid, loading: true, message: 'Menambahkan kelas...', autoClose: false, withCloseButton: false })
    const res = await tambahKelas(formData)
    if ('error' in res) {
      notifications.update({ id: nid, loading: false, color: 'red', title: 'Gagal', message: res.error, autoClose: 4000, withCloseButton: true })
    } else {
      notifications.update({ id: nid, loading: false, color: 'green', message: 'Kelas berhasil ditambahkan', autoClose: 2500, withCloseButton: true })
      loadData()
      const form = document.getElementById('form-manual') as HTMLFormElement
      if (form) form.reset()
    }
  }

  const handleHapus = async (id: string) => {
    if (!await confirmHapus('Hapus kelas ini?')) return
    const nid = 'hapus-kelas'
    notifications.show({ id: nid, loading: true, message: 'Menghapus...', autoClose: false, withCloseButton: false })
    const res = await hapusKelas(id)
    if ('error' in res) {
      notifications.update({ id: nid, loading: false, color: 'red', title: 'Gagal', message: res.error, autoClose: 4000, withCloseButton: true })
    } else {
      notifications.update({ id: nid, loading: false, color: 'green', message: 'Kelas dihapus', autoClose: 2500, withCloseButton: true })
      loadData()
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA KELAS": "1-A", "MARHALAH": "Ibtidaiyyah 1", "TEMPAT": "Gedung Barat", "GRADE": "A", "B/L": "B", "JENIS KELAMIN": "L" },
      { "NAMA KELAS": "1-B", "MARHALAH": "Ibtidaiyyah 1", "TEMPAT": "Gedung Timur", "GRADE": "B", "B/L": "L", "JENIS KELAMIN": "P" },
      { "NAMA KELAS": "2-A", "MARHALAH": "Ibtidaiyyah 2", "TEMPAT": "Aula Lama", "GRADE": "AB", "B/L": "B", "JENIS KELAMIN": "C" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:15}, {wch:20}, {wch:20}, {wch:10}, {wch:10}, {wch:10}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Kelas")
    XLSX.writeFile(workbook, "Template_Master_Kelas.xlsx")
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      setExcelData(data)
      notifications.show({ color: 'green', message: `Berhasil membaca ${data.length} baris`, autoClose: 2500 })
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanExcel = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const nid = 'import-kelas'
    notifications.show({ id: nid, loading: true, message: 'Mengimport data...', autoClose: false, withCloseButton: false })
    const res = await importKelasMassal(excelData)
    setIsProcessing(false)
    if ('error' in res) {
      notifications.update({ id: nid, loading: false, color: 'red', title: 'Gagal Import', message: res.error, autoClose: 4000, withCloseButton: true })
    } else {
      notifications.update({ id: nid, loading: false, color: 'green', message: `Sukses! ${(res as any).count} kelas ditambahkan.`, autoClose: 2500, withCloseButton: true })
      setExcelData([])
      loadData()
      setMode('manual')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Manajemen Kelas & Ruangan"
          description="Atur struktur kelas per tahun ajaran."
          action={(
            <Button
              component={Link}
              href="/dashboard/master/kelas/tempelan"
              variant="default"
              leftSection={<Printer className="h-4 w-4" />}
              fw={700}
            >
              Cetak Tempelan
            </Button>
          )}
          className="flex-1"
        />
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as 'manual' | 'excel')}
          data={[
            { value: 'manual', label: <Group gap={6} wrap="nowrap"><List className="w-4 h-4" /> Daftar & Manual</Group> },
            { value: 'excel', label: <Group gap={6} wrap="nowrap"><FileSpreadsheet className="w-4 h-4" /> Import Excel</Group> },
          ]}
        />
      </div>

      {/* BANNER TAHUN AJARAN */}
      {!loading && (tahunAktif ? (
        <Alert color="green" variant="light" radius="xl" icon={<CalendarDays className="w-5 h-5" />}>
          <Text size="sm" c="green.9">
            Tahun ajaran aktif: <b>{tahunAktif.nama}</b>
            <span style={{ color: 'var(--mantine-color-green-7)' }}> — Kelas baru otomatis masuk ke tahun ini.</span>
          </Text>
        </Alert>
      ) : (
        <Alert color="yellow" variant="light" radius="xl" icon={<AlertTriangle className="w-5 h-5" />}
          title={<span className="text-amber-800">Belum ada tahun ajaran aktif!</span>}>
          <Text size="xs" c="yellow.8">Kelas tidak bisa ditambahkan sebelum tahun ajaran diaktifkan.</Text>
          <Link href="/dashboard/pengaturan/tahun-ajaran" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-amber-800 underline hover:text-amber-900">
            <CalendarDays className="w-3.5 h-3.5" /> Atur Tahun Ajaran →
          </Link>
        </Alert>
      ))}

      {mode === 'manual' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">Tambah Kelas Satuan</h3>
            <form id="form-manual" action={handleTambahManual} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tingkat (Marhalah)</label>
                <NativeSelect name="marhalah_id" required data={marhalahList?.map(m => ({ value: String(m.id), label: m.nama })) ?? []} />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nama Kelas (Ex: 1-B)</label>
                <TextInput name="nama_kelas" required placeholder="Contoh: 1-14" />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tempat</label>
                <TextInput name="tempat" placeholder="Contoh: Gedung Barat" />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Grade (Komposisi)</label>
                <NativeSelect name="grade" data={[
                  { value: '', label: '- Pilih -' },
                  { value: 'A', label: 'A (hanya A)' },
                  { value: 'AB', label: 'AB (A & B)' },
                  { value: 'ABC', label: 'ABC (campur semua)' },
                  { value: 'B', label: 'B (hanya B)' },
                  { value: 'BC', label: 'BC (B & C)' },
                  { value: 'C', label: 'C (hanya C)' },
                ]} />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">B/L (Baru/Lama)</label>
                <TextInput name="baru_lama" placeholder="Contoh: B / L" styles={{ input: { textTransform: 'uppercase' } }} />
              </div>
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Jenis Kelamin</label>
                <NativeSelect name="jenis_kelamin" defaultValue="L" data={[
                  { value: 'L', label: 'Putra (L)' },
                  { value: 'P', label: 'Putri (P)' },
                  { value: 'C', label: 'Campuran (L & P)' },
                ]} />
              </div>
              <Button type="submit" color="blue" leftSection={<Plus className="w-4 h-4" />} fw={700}>
                Tambah
              </Button>
            </form>
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b text-xs font-bold text-slate-500 uppercase flex justify-between items-center">
               <span>Daftar Kelas Tersedia</span><span className="bg-white border px-2 py-0.5 rounded text-slate-600">{kelasList.length} Rombel</span>
            </div>
            <Table.ScrollContainer minWidth={760}>
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="lg" fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nama Kelas</Table.Th>
                    <Table.Th>Tingkat</Table.Th>
                    <Table.Th>Tempat</Table.Th>
                    <Table.Th>Grade</Table.Th>
                    <Table.Th>B/L</Table.Th>
                    <Table.Th>L/P</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {kelasList?.map((k) => (
                    <Table.Tr key={k.id}>
                      <Table.Td fw={500} c="dark.6">{k.nama_kelas}</Table.Td>
                      <Table.Td c="dimmed">{k.marhalah_nama || '-'}</Table.Td>
                      <Table.Td c="dimmed">{k.tempat || '-'}</Table.Td>
                      <Table.Td c="dimmed" fw={600}>{k.grade || '-'}</Table.Td>
                      <Table.Td c="dimmed" fw={600}>{k.baru_lama || '-'}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light"
                          color={k.jenis_kelamin === 'L' ? 'blue' : k.jenis_kelamin === 'P' ? 'pink' : 'grape'}>
                          {k.jenis_kelamin === 'C' ? 'CAMPURAN' : k.jenis_kelamin === 'L' ? 'PUTRA' : 'PUTRI'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleHapus(k.id)} aria-label="Hapus kelas">
                          <Trash2 className="w-4 h-4" />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </div>
        </div>
      )}

      {mode === 'excel' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col justify-center items-center text-center space-y-4">
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Download className="w-6 h-6"/></div>
                   <div><h3 className="font-bold text-blue-900">1. Download Template</h3><p className="text-xs text-blue-600 max-w-xs mx-auto mt-1">Gunakan template ini untuk mengisi daftar kelas baru secara massal.</p></div>
                   <Button onClick={handleDownloadTemplate} variant="white" color="blue" fw={700}>Download Excel</Button>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col justify-center items-center text-center space-y-4">
                   <div className="bg-green-100 p-3 rounded-full text-green-600"><Upload className="w-6 h-6"/></div>
                   <div><h3 className="font-bold text-green-900">2. Upload File</h3><p className="text-xs text-green-600 max-w-xs mx-auto mt-1">Upload file Excel yang sudah diisi di sini.</p></div>
                   <FileButton onChange={handleUpload} accept=".xlsx">
                     {(props) => <Button {...props} color="green" fw={700}>Pilih File Excel</Button>}
                   </FileButton>
                </div>
            </div>
            {excelData.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Preview ({excelData.length} Kelas)</h3>
                        <Button onClick={handleSimpanExcel} loading={isProcessing} color="green" fw={700}
                          leftSection={<Save className="w-4 h-4" />}>
                           Simpan Semua
                        </Button>
                    </div>
                    <div className="max-h-64 overflow-auto">
                        <Table.ScrollContainer minWidth={720}>
                          <Table stickyHeader fz="sm">
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Nama Kelas</Table.Th>
                                <Table.Th>Marhalah</Table.Th>
                                <Table.Th>Tempat</Table.Th>
                                <Table.Th>Grade</Table.Th>
                                <Table.Th>B/L</Table.Th>
                                <Table.Th>L/P</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {excelData.map((row, i) => (
                                <Table.Tr key={i}>
                                  <Table.Td>{row['NAMA KELAS'] || row['nama kelas']}</Table.Td>
                                  <Table.Td>{row['MARHALAH'] || row['marhalah']}</Table.Td>
                                  <Table.Td>{row['TEMPAT'] || row['tempat'] || '-'}</Table.Td>
                                  <Table.Td fw={600}>{row['GRADE'] || row['grade'] || '-'}</Table.Td>
                                  <Table.Td fw={600}>{row['B/L'] || row['BARU/LAMA'] || row['baru/lama'] || row['baru_lama'] || '-'}</Table.Td>
                                  <Table.Td>{row['JENIS KELAMIN'] || row['jenis kelamin']}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Table.ScrollContainer>
                    </div>
                </div>
            )}
         </div>
      )}
    </div>
  )
}
