'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getDaftarCetakRapor,
  getDataIdentitas,
  getDataRapor,
  getKelasList,
  getKitabPilihanOptions,
  getLegerRaporData,
  getRaporTitimangsa,
  getRaporTtdPimpinan,
  getRaporTtdWali,
  getTahunAjaranList,
  saveKitabPilihan,
  saveRaporTitimangsa,
  saveRaporTtdPimpinan,
  saveRaporTtdWali,
  updateIdentitasSantriRapor,
} from './actions'
import { IdentitasSantriHalaman } from './identitas-view'
import { RaporSatuHalaman } from './rapor-view'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useReactToPrint } from '@/lib/pdf/client'
import {
  BookOpen,
  CalendarCog,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  IdCard,
  Loader2,
  Pencil,
  PenLine,
  Printer,
  Search,
  Save,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type PrintKind = 'rapor' | 'identitas'

type TtdValue = { url: string; x: number; y: number; w: number; nama?: string }

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

// Editor TTD: upload gambar + geser posisi X/Y + ukuran, dengan preview live.
function TtdEditorModal({
  open,
  title,
  subtitle,
  previewName,
  initial,
  editableName = false,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  subtitle: string
  previewName: string
  initial: TtdValue
  editableName?: boolean
  onClose: () => void
  onSave: (v: TtdValue) => Promise<void>
}) {
  const [form, setForm] = useState<TtdValue>(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset form tiap modal dibuka.
  useEffect(() => {
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const set = (patch: Partial<TtdValue>) => setForm(prev => ({ ...prev, ...patch }))

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar.')
      return
    }
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/upload-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, folder: 'ttd-rapor', filenamePrefix: 'ttd' }),
      })
      const data = await res.json()
      if (data?.url) {
        set({ url: data.url })
        toast.success('Tanda tangan terupload.')
      } else {
        toast.error(data?.error || 'Gagal upload.')
      }
    } catch {
      toast.error('Gagal upload tanda tangan.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  const ttdImgStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: '24px',
    transform: `translate(calc(-50% + ${form.x}px), ${form.y}px)`,
    width: `${form.w}px`,
    height: 'auto',
    zIndex: 10,
    pointerEvents: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b bg-slate-50 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p>
            <h2 className="text-lg font-bold text-slate-800">{previewName}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Tutup modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Preview */}
          <div className="relative mx-auto flex h-[130px] w-[240px] flex-col justify-end overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
            {form.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.url} alt="Preview TTD" style={ttdImgStyle} />
            ) : null}
            <p className="z-[1] border-t border-black pt-[2px] text-[11px] font-bold uppercase">{(editableName ? form.nama : previewName) || 'Nama'}</p>
          </div>

          {editableName && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nama Pimpinan</label>
              <input
                value={form.nama ?? ''}
                onChange={e => set({ nama: e.target.value })}
                placeholder="Nama lengkap pimpinan"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Upload */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {form.url ? 'Ganti Gambar Tanda Tangan' : 'Upload Gambar Tanda Tangan'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>

          {/* Sliders */}
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
              <span>Geser Horizontal (X)</span><span>{form.x}px</span>
            </div>
            <input type="range" min={-120} max={120} value={form.x} onChange={e => set({ x: Number(e.target.value) })} className="w-full accent-blue-600" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
              <span>Geser Vertikal (Y)</span><span>{form.y}px</span>
            </div>
            <input type="range" min={-100} max={60} value={form.y} onChange={e => set({ y: Number(e.target.value) })} className="w-full accent-blue-600" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
              <span>Ukuran (Lebar)</span><span>{form.w}px</span>
            </div>
            <input type="range" min={30} max={240} value={form.w} onChange={e => set({ w: Number(e.target.value) })} className="w-full accent-blue-600" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button onClick={save} disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

const emptyIdentitasForm = {
  riwayat_id: '',
  santri_id: '',
  nis: '',
  nama_lengkap: '',
  nik: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  jenis_kelamin: 'L',
  nama_ayah: '',
  nama_ibu: '',
  no_wa_ortu: '',
  alamat: '',
  alamat_lengkap: '',
  kecamatan: '',
  kab_kota: '',
  provinsi: '',
  asrama: '',
  kamar: '',
  tahun_masuk: '',
}

export default function CetakRaporPage() {
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [selectedTA, setSelectedTA] = useState<number | undefined>(undefined)
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [tahunAjaran, setTahunAjaran] = useState('')

  const [daftar, setDaftar] = useState<any[]>([])
  const [dataRapor, setDataRapor] = useState<any[]>([])
  const [dataIdentitas, setDataIdentitas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [editIdentitasOpen, setEditIdentitasOpen] = useState(false)
  const [identitySaving, setIdentitySaving] = useState(false)
  const [identitasForm, setIdentitasForm] = useState<any>(emptyIdentitasForm)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [kitabModalOpen, setKitabModalOpen] = useState(false)
  const [kitabLoading, setKitabLoading] = useState(false)
  const [kitabSaving, setKitabSaving] = useState(false)
  const [kitabOptions, setKitabOptions] = useState<any[]>([])
  // mapel_id -> kitab_id ('' = gabung semua judul)
  const [kitabSelections, setKitabSelections] = useState<Record<number, string>>({})

  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('F4')

  const [titimangsa, setTitimangsa] = useState<{ tempat: string; tanggal: string }>({ tempat: 'Sukahideng', tanggal: '' })
  const [titimangsaModalOpen, setTitimangsaModalOpen] = useState(false)
  const [titimangsaForm, setTitimangsaForm] = useState<{ tempat: string; tanggal: string }>({ tempat: 'Sukahideng', tanggal: '' })
  const [titimangsaSaving, setTitimangsaSaving] = useState(false)

  const [pimpinanTtd, setPimpinanTtd] = useState<TtdValue>({ url: '', x: 0, y: 0, w: 100, nama: '' })
  const [pimpinanTtdOpen, setPimpinanTtdOpen] = useState(false)
  const [waliTtd, setWaliTtd] = useState<{ url: string; x: number; y: number; w: number; nama: string | null } | null>(null)
  const [waliTtdOpen, setWaliTtdOpen] = useState(false)

  const [printKind, setPrintKind] = useState<PrintKind>('rapor')
  const [printRows, setPrintRows] = useState<any[]>([])
  const [printTitle, setPrintTitle] = useState('Cetak_Rapor')
  const [printQueued, setPrintQueued] = useState(false)
  const printRef = useRef<HTMLDivElement | null>(null)

  const selectedKelasName = useMemo(() => {
    return kelasList.find(k => k.id === selectedKelas)?.nama_kelas || 'Kelas'
  }, [kelasList, selectedKelas])
  const paginatedDaftar = usePagination(daftar, pageSize, currentPage)

  // Dua ukuran kertas yang dipakai di lapangan: A4 & F4 (folio).
  const PAPER = {
    A4: { w: 210, h: 297 },
    F4: { w: 215, h: 330 },
  } as const
  const paper = PAPER[paperSize]

  // @page dipaksa ke ukuran terpilih supaya printer tidak menebak / menskala.
  // Lebar & tinggi sheet diset eksak per kertas, lalu di-zoom agar pas 1 halaman.
  const pageStyle = `
    @page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
      .sheet-wrap {
        width: 100%;
        display: flex;
        justify-content: center;       /* center horizontal => margin kiri = kanan */
        align-items: flex-start;
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
        break-after: page;
        page-break-after: always;
      }
      .sheet-wrap:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .print-sheet {
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  `

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printTitle,
    pageStyle,
    onAfterPrint: () => {
      toast.success('Dokumen dikirim ke printer.')
    },
    onPrintError: () => {
      toast.error('Gagal mencetak dokumen.')
    },
  })

  useEffect(() => {
    getTahunAjaranList().then(list => {
      setTahunAjaranList(list)
      const aktif = list.find((t: any) => t.is_active === 1)
      if (aktif) setSelectedTA(aktif.id)
    })
    getRaporTitimangsa().then(setTitimangsa).catch(() => {})
    getRaporTtdPimpinan().then(setPimpinanTtd).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedTA) return
    const ta = tahunAjaranList.find((t: any) => Number(t.id) === Number(selectedTA))
    if (ta) setTahunAjaran(ta.nama)
    setSelectedKelas('')
    setDaftar([])
    setDataRapor([])
    setDataIdentitas([])
    setCurrentPage(1)
    getKelasList(selectedTA).then(setKelasList)
  }, [selectedTA, tahunAjaranList])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedKelas, selectedSemester])

  // Skala tiap sheet agar muat 1 halaman kertas terpilih (96dpi), tetap center.
  // transform-origin top center => sisa ruang dibagi rata kiri-kanan
  // (margin kiri = margin kanan). Wrapper di-set tinggi hasil skala supaya
  // tidak ada ruang kosong / tumpah ke halaman berikutnya.
  const fitSheetsToPage = () => {
    const root = printRef.current
    if (!root) return
    const PXW = (paper.w / 25.4) * 96
    const PXH = (paper.h / 25.4) * 96
    const wraps = root.querySelectorAll<HTMLElement>('.sheet-wrap')
    wraps.forEach(wrap => {
      const el = wrap.querySelector<HTMLElement>('.print-sheet')
      if (!el) return
      el.style.transform = 'none'
      el.style.transformOrigin = 'top center'
      el.style.width = `${paper.w}mm`
      el.style.minHeight = '0'   // buang floor 297mm biar ukur tinggi konten asli
      const w = el.scrollWidth
      const h = el.scrollHeight
      // -2px epsilon supaya pembulatan tidak memicu halaman kedua
      const scale = Math.min(1, (PXW - 2) / w, (PXH - 2) / h)
      if (scale < 1) {
        el.style.transform = `scale(${scale})`
        wrap.style.height = `${Math.ceil(h * scale)}px`
      } else {
        wrap.style.height = ''
      }
    })
  }

  useEffect(() => {
    if (!printQueued || printRows.length === 0) return

    const timer = window.setTimeout(() => {
      toast.info('Menyiapkan dokumen untuk dicetak...')
      fitSheetsToPage()
      handlePrint()
      setPrintQueued(false)
    }, 80)

    return () => window.clearTimeout(timer)
  }, [handlePrint, printQueued, printRows])

  const handleLoad = async () => {
    if (!selectedKelas) {
      toast.warning('Mohon pilih Kelas terlebih dahulu.')
      return
    }

    setLoading(true)
    const loadToast = toast.loading('Mengambil daftar santri dan data cetak...')
    setDaftar([])
    setDataRapor([])
    setDataIdentitas([])
    setPrintRows([])
    setCurrentPage(1)

    try {
      const semester = Number(selectedSemester)
      const [list, rapor, identitas, waliTtdData] = await Promise.all([
        getDaftarCetakRapor(selectedKelas, semester),
        getDataRapor(selectedKelas, semester),
        getDataIdentitas(selectedKelas),
        getRaporTtdWali(selectedKelas),
      ])

      setDaftar(list.siswa || [])
      setDataRapor(rapor || [])
      setDataIdentitas(identitas || [])
      setWaliTtd(waliTtdData)

      if (!list.siswa?.length) {
        toast.info('Data Kosong', { description: 'Belum ada santri aktif di kelas ini.' })
      } else {
        toast.success('Data Siap', { description: `Berhasil memuat ${list.siswa.length} santri.` })
      }
    } catch (error) {
      console.error(error)
      toast.error('Terjadi Kesalahan', { description: 'Gagal mengambil data dari server.' })
    } finally {
      setLoading(false)
      toast.dismiss(loadToast)
    }
  }

  const queuePrint = (kind: PrintKind, rows: any[], title: string) => {
    if (!rows.length) {
      toast.warning('Tidak ada data untuk dicetak.')
      return
    }

    setPrintKind(kind)
    setPrintRows(rows)
    setPrintTitle(title)
    setPrintQueued(true)
  }

  const printRaporOne = (row: any) => {
    const rapor = dataRapor.find(item => item.id === row.riwayat_id)
    queuePrint('rapor', rapor ? [rapor] : [], `Rapor_${row.nama}_Smt${selectedSemester}`)
  }

  const printIdentitasOne = (row: any) => {
    const identitas = dataIdentitas.find(item => item.riwayat_id === row.riwayat_id)
    queuePrint('identitas', identitas ? [identitas] : [], `Identitas_${row.nama}`)
  }

  const openEditIdentitas = (row: any) => {
    const identitas = dataIdentitas.find(item => item.riwayat_id === row.riwayat_id)
    if (!identitas) {
      toast.warning('Data identitas belum tersedia.')
      return
    }

    setIdentitasForm({
      ...emptyIdentitasForm,
      ...identitas,
      tanggal_lahir: identitas.tanggal_lahir || '',
      tahun_masuk: identitas.tahun_masuk ? String(identitas.tahun_masuk) : '',
    })
    setEditIdentitasOpen(true)
  }

  const setIdentitasField = (field: string, value: string) => {
    setIdentitasForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleSaveIdentitas = async () => {
    setIdentitySaving(true)
    const toastId = toast.loading('Menyimpan identitas santri...')

    try {
      const res = await updateIdentitasSantriRapor(identitasForm)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      if (!res?.data) {
        toast.error('Server tidak mengembalikan data identitas terbaru.')
        return
      }

      const updated = res.data
      setDataIdentitas(prev => prev.map(item => item.riwayat_id === updated.riwayat_id ? updated : item))
      setDaftar(prev => prev.map(item => item.riwayat_id === updated.riwayat_id
        ? { ...item, nis: updated.nis || '-', nama: updated.nama_lengkap || 'Tanpa Nama' }
        : item
      ))
      setDataRapor(prev => prev.map(item => item.id === updated.riwayat_id
        ? {
            ...item,
            santri: {
              ...item.santri,
              nama_lengkap: updated.nama_lengkap,
              nis: updated.nis,
              nama_ayah: updated.nama_ayah,
            },
          }
        : item
      ))
      setEditIdentitasOpen(false)
      toast.success('Identitas santri berhasil diperbarui.')
    } catch (error) {
      console.error(error)
      toast.error('Gagal menyimpan identitas santri.')
    } finally {
      toast.dismiss(toastId)
      setIdentitySaving(false)
    }
  }

  const openTitimangsaModal = () => {
    setTitimangsaForm(titimangsa)
    setTitimangsaModalOpen(true)
  }

  const handleSaveTitimangsa = async () => {
    setTitimangsaSaving(true)
    const toastId = toast.loading('Menyimpan titimangsa...')
    try {
      const res = await saveRaporTitimangsa(titimangsaForm.tempat, titimangsaForm.tanggal)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      if (res?.data) setTitimangsa(res.data)
      setTitimangsaModalOpen(false)
      toast.success('Titimangsa rapor tersimpan.')
    } catch (error) {
      console.error(error)
      toast.error('Gagal menyimpan titimangsa.')
    } finally {
      toast.dismiss(toastId)
      setTitimangsaSaving(false)
    }
  }

  const savePimpinanTtd = async (v: TtdValue) => {
    const res = await saveRaporTtdPimpinan({ url: v.url, x: v.x, y: v.y, w: v.w, nama: v.nama ?? '' })
    if (res?.error) { toast.error(res.error); return }
    if (res?.data) setPimpinanTtd(res.data)
    setPimpinanTtdOpen(false)
    toast.success('Tanda tangan pimpinan tersimpan.')
  }

  const saveWaliTtd = async (v: TtdValue) => {
    if (!selectedKelas) return
    const res = await saveRaporTtdWali(selectedKelas, v)
    if (res?.error) { toast.error(res.error); return }
    if (res?.data) setWaliTtd(prev => ({ ...res.data, nama: prev?.nama ?? null }))
    setWaliTtdOpen(false)
    toast.success('Tanda tangan wali kelas tersimpan.')
  }

  const openKitabModal = async () => {
    if (!selectedKelas) return toast.warning('Pilih kelas terlebih dahulu.')
    setKitabModalOpen(true)
    setKitabLoading(true)
    try {
      const opts = await getKitabPilihanOptions(selectedKelas)
      setKitabOptions(opts)
      const init: Record<number, string> = {}
      opts.forEach((m: any) => {
        init[m.mapel_id] = m.selected_kitab_id != null ? String(m.selected_kitab_id) : ''
      })
      setKitabSelections(init)
    } catch (error) {
      console.error(error)
      toast.error('Gagal memuat opsi kitab.')
      setKitabModalOpen(false)
    } finally {
      setKitabLoading(false)
    }
  }

  const handleSaveKitab = async () => {
    setKitabSaving(true)
    const toastId = toast.loading('Menyimpan pilihan kitab...')
    try {
      const selections = kitabOptions.map((m: any) => ({
        mapel_id: m.mapel_id,
        kitab_id: kitabSelections[m.mapel_id] ? Number(kitabSelections[m.mapel_id]) : null,
      }))
      const res = await saveKitabPilihan(selectedKelas, selections)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      setKitabModalOpen(false)
      toast.success('Pilihan kitab tersimpan.')
      await handleLoad()
    } catch (error) {
      console.error(error)
      toast.error('Gagal menyimpan pilihan kitab.')
    } finally {
      toast.dismiss(toastId)
      setKitabSaving(false)
    }
  }

  const handleExportLeger = async () => {
    if (!selectedKelas) return toast.warning('Pilih kelas terlebih dahulu.')

    setIsExporting(true)
    const toastId = toast.loading('Download leger Excel...')

    try {
      const XLSX = await import('xlsx')
      const dataLeger = await getLegerRaporData(selectedKelas, Number(selectedSemester))

      if (!dataLeger.siswa.length) {
        toast.info('Data leger kosong.')
        return
      }

      const headers = [
        'No',
        'NIS',
        'Nama Santri',
        ...dataLeger.mapel.map((m: any) => m.nama),
        'Jumlah',
        'Rata-rata',
        'Ranking',
      ]
      const rows = dataLeger.siswa.map((s: any, idx: number) => {
        const rowData: any[] = [idx + 1, s.nis, s.nama]
        dataLeger.mapel.forEach((m: any) => rowData.push(s.nilai[m.id] || ''))
        rowData.push(s.jumlah || '', s.rata || '', s.rank || '')
        return rowData
      })

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = headers.map((header) => ({ wch: header === 'Nama Santri' ? 28 : 14 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Leger ${selectedKelasName}`)
      XLSX.writeFile(wb, `Leger_${selectedKelasName}_Semester_${selectedSemester}.xlsx`)
      toast.success('Leger berhasil didownload.')
    } catch (error) {
      console.error(error)
      toast.error('Gagal export leger.')
    } finally {
      setIsExporting(false)
      toast.dismiss(toastId)
    }
  }

  const hasData = daftar.length > 0

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cetak Rapor Santri</h1>
          <p className="text-sm text-slate-500">Pilih kelas, lalu cetak rapor atau identitas per santri.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={openTitimangsaModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              <CalendarCog className="h-3.5 w-3.5" /> Titimangsa: {titimangsa.tempat}{titimangsa.tanggal ? `, ${titimangsa.tanggal}` : ' (tgl cetak)'}
            </button>
            <button
              onClick={() => setPimpinanTtdOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              <PenLine className="h-3.5 w-3.5" /> TTD Pimpinan
            </button>
          </div>
        </div>
        {hasData ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ukuran Kertas</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
                {(['A4', 'F4'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPaperSize(p)}
                    className={[
                      'px-4 py-1.5 text-sm font-bold transition-colors',
                      paperSize === p ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400">{paperSize === 'F4' ? '215 × 330 mm' : '210 × 297 mm'}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <button
              onClick={openKitabModal}
              className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700"
            >
              <BookOpen className="h-4 w-4" /> Atur Kitab Rapor
            </button>
            <button
              onClick={() => waliTtd ? setWaliTtdOpen(true) : toast.warning('Kelas ini belum punya wali kelas.')}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <PenLine className="h-4 w-4" /> TTD Wali Kelas
            </button>
            <button
              onClick={() => queuePrint('rapor', dataRapor, `Rapor_${selectedKelasName}_Smt${selectedSemester}`)}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              <Printer className="h-4 w-4" /> Cetak Semua Rapor
            </button>
            <button
              onClick={() => queuePrint('identitas', dataIdentitas, `Identitas_${selectedKelasName}`)}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-900"
            >
              <IdCard className="h-4 w-4" /> Cetak Semua Identitas
            </button>
            <button
              onClick={handleExportLeger}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Leger Excel
            </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-none flex-col items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden md:flex-row">
        <div className="w-full md:w-auto">
          <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Tahun Ajaran
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-44"
            value={selectedTA ?? ''}
            onChange={(e) => setSelectedTA(Number(e.target.value))}
          >
            <option value="">-- Pilih --</option>
            {tahunAjaranList.map(ta => (
              <option key={ta.id} value={ta.id}>
                {ta.nama}{ta.is_active ? ' (Aktif)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto">
          <label className="mb-1 block text-sm font-medium text-slate-700">Kelas</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Pilih --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>

        <div className="w-full md:w-auto">
          <label className="mb-1 block text-sm font-medium text-slate-700">Semester</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-32"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Ganjil</option>
            <option value="2">Genap</option>
          </select>
        </div>

        <button
          onClick={handleLoad}
          disabled={!selectedKelas || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 md:w-auto"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Tampilkan
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm print:hidden">
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-slate-400">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-500" />
            <p>Sedang menyusun daftar santri...</p>
          </div>
        ) : !hasData ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-4 text-center text-slate-400">
            <FileText className="mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium">Belum ada data ditampilkan.</p>
            <p className="text-sm">Silakan pilih kelas dan klik tombol Tampilkan.</p>
          </div>
        ) : (
          <>
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                <tr>
                  <th className="w-14 px-4 py-3 text-center">No</th>
                  <th className="px-4 py-3">Santri</th>
                  <th className="w-32 px-4 py-3">NIS</th>
                  <th className="w-40 px-4 py-3">Status Nilai</th>
                  <th className="w-40 px-4 py-3 text-center">Rapor</th>
                  <th className="w-64 px-4 py-3 text-center">Identitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDaftar.paged.map((row, idx) => (
                  <tr key={row.riwayat_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">{paginatedDaftar.start + idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.nama}</p>
                      <p className="text-xs text-slate-500">{row.kelas?.nama_kelas || selectedKelasName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.nis}</td>
                    <td className="px-4 py-3">
                      {row.status_nilai?.lengkap ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          {row.status_nilai?.terisi ?? 0}/{row.status_nilai?.total ?? 0} nilai
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => printRaporOne(row)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Printer className="h-3.5 w-3.5" /> Cetak Rapor
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditIdentitas(row)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => printIdentitasOne(row)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          <IdCard className="h-3.5 w-3.5" /> Cetak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paginatedDaftar.safePage}
            totalPages={paginatedDaftar.totalPages}
            pageSize={pageSize}
            total={paginatedDaftar.total}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
          </>
        )}
      </div>

      <div className="fixed -left-[10000px] top-0 print:static print:left-0">
        <div ref={printRef} className="w-fit bg-white print:w-full">
          {printKind === 'rapor' ? (
            <div>
              {printRows.map((siswa) => (
                <div key={siswa.id} className="sheet-wrap">
                  <RaporSatuHalaman
                    data={siswa}
                    semester={Number(selectedSemester)}
                    tahunAjaran={tahunAjaran}
                    titimangsaTempat={titimangsa.tempat}
                    titimangsaTanggal={titimangsa.tanggal}
                    pimpinanTtd={pimpinanTtd}
                    pimpinanNama={pimpinanTtd.nama}
                    waliTtd={waliTtd ? { url: waliTtd.url, x: waliTtd.x, y: waliTtd.y, w: waliTtd.w } : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {printRows.map((siswa) => (
                <div key={siswa.riwayat_id} className="sheet-wrap">
                  <IdentitasSantriHalaman data={siswa} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editIdentitasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Edit Identitas Rapor</p>
                <h2 className="text-lg font-bold text-slate-800">{identitasForm.nama_lengkap || 'Santri'}</h2>
                <p className="text-xs text-slate-500">Perubahan disimpan ke data utama santri.</p>
              </div>
              <button
                onClick={() => setEditIdentitasOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">NIS</label>
                  <input value={identitasForm.nis || ''} onChange={e => setIdentitasField('nis', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nama Lengkap</label>
                  <input value={identitasForm.nama_lengkap || ''} onChange={e => setIdentitasField('nama_lengkap', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">NIK</label>
                  <input value={identitasForm.nik || ''} onChange={e => setIdentitasField('nik', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jenis Kelamin</label>
                  <select value={identitasForm.jenis_kelamin || 'L'} onChange={e => setIdentitasField('jenis_kelamin', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tempat Lahir</label>
                  <input value={identitasForm.tempat_lahir || ''} onChange={e => setIdentitasField('tempat_lahir', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tanggal Lahir</label>
                  <input type="date" value={identitasForm.tanggal_lahir || ''} onChange={e => setIdentitasField('tanggal_lahir', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tahun Masuk</label>
                  <input type="number" value={identitasForm.tahun_masuk || ''} onChange={e => setIdentitasField('tahun_masuk', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">No. Telepon Orang Tua</label>
                  <input value={identitasForm.no_wa_ortu || ''} onChange={e => setIdentitasField('no_wa_ortu', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nama Ayah</label>
                  <input value={identitasForm.nama_ayah || ''} onChange={e => setIdentitasField('nama_ayah', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Nama Ibu</label>
                  <input value={identitasForm.nama_ibu || ''} onChange={e => setIdentitasField('nama_ibu', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                  <input value={identitasForm.asrama || ''} onChange={e => setIdentitasField('asrama', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jama'ah / Kamar</label>
                  <input value={identitasForm.kamar || ''} onChange={e => setIdentitasField('kamar', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Alamat Ringkas</label>
                  <textarea value={identitasForm.alamat || ''} onChange={e => setIdentitasField('alamat', e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Alamat Lengkap</label>
                  <textarea value={identitasForm.alamat_lengkap || ''} onChange={e => setIdentitasField('alamat_lengkap', e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kecamatan</label>
                  <input value={identitasForm.kecamatan || ''} onChange={e => setIdentitasField('kecamatan', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kab/Kota</label>
                  <input value={identitasForm.kab_kota || ''} onChange={e => setIdentitasField('kab_kota', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Provinsi</label>
                  <input value={identitasForm.provinsi || ''} onChange={e => setIdentitasField('provinsi', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4">
              <button onClick={() => setEditIdentitasOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button
                onClick={handleSaveIdentitas}
                disabled={identitySaving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {identitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan Identitas
              </button>
            </div>
          </div>
        </div>
      )}

      {kitabModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Atur Kitab Rapor</p>
                <h2 className="text-lg font-bold text-slate-800">{selectedKelasName}</h2>
                <p className="text-xs text-slate-500">Pilih satu kitab per mapel. &quot;Gabung semua judul&quot; = tampilkan seluruh kitab.</p>
              </div>
              <button
                onClick={() => setKitabModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {kitabLoading ? (
                <div className="flex min-h-[160px] items-center justify-center text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : kitabOptions.length === 0 ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center text-center text-slate-400">
                  <BookOpen className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium">Tidak ada mapel berkitab ganda.</p>
                  <p className="text-sm">Semua mapel hanya punya satu kitab, tidak perlu diatur.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kitabOptions.map((m: any) => (
                    <div key={m.mapel_id} className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1.4fr] sm:items-center">
                      <label className="text-sm font-bold text-slate-700">{m.mapel_nama}</label>
                      <select
                        value={kitabSelections[m.mapel_id] ?? ''}
                        onChange={e => setKitabSelections(prev => ({ ...prev, [m.mapel_id]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Gabung semua judul</option>
                        {m.opsi.map((k: any) => (
                          <option key={k.kitab_id} value={k.kitab_id}>{k.nama_kitab}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4">
              <button onClick={() => setKitabModalOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button
                onClick={handleSaveKitab}
                disabled={kitabSaving || kitabLoading || kitabOptions.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {kitabSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {titimangsaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Titimangsa Rapor</p>
                <h2 className="text-lg font-bold text-slate-800">Tempat &amp; Tanggal Terbit</h2>
                <p className="text-xs text-slate-500">Berlaku untuk semua kelas (universal).</p>
              </div>
              <button
                onClick={() => setTitimangsaModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Diberikan di (Tempat)</label>
                <input
                  value={titimangsaForm.tempat}
                  onChange={e => setTitimangsaForm(prev => ({ ...prev, tempat: e.target.value }))}
                  placeholder="Sukahideng"
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Tanggal Terbit</label>
                <input
                  type="date"
                  value={titimangsaForm.tanggal}
                  onChange={e => setTitimangsaForm(prev => ({ ...prev, tanggal: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">Kosongkan untuk memakai tanggal saat mencetak.</p>
                {titimangsaForm.tanggal && (
                  <button
                    onClick={() => setTitimangsaForm(prev => ({ ...prev, tanggal: '' }))}
                    className="mt-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    Kosongkan tanggal
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4">
              <button onClick={() => setTitimangsaModalOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button
                onClick={handleSaveTitimangsa}
                disabled={titimangsaSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {titimangsaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <TtdEditorModal
        open={pimpinanTtdOpen}
        title="Tanda Tangan Pimpinan (Global)"
        subtitle="Berlaku untuk semua rapor."
        previewName={pimpinanTtd.nama || 'Nama Pimpinan'}
        initial={pimpinanTtd}
        editableName
        onClose={() => setPimpinanTtdOpen(false)}
        onSave={savePimpinanTtd}
      />

      <TtdEditorModal
        open={waliTtdOpen}
        title="Tanda Tangan Wali Kelas"
        subtitle={`Khusus wali kelas ${selectedKelasName}.`}
        previewName={waliTtd?.nama || 'Wali Kelas'}
        initial={waliTtd ? { url: waliTtd.url, x: waliTtd.x, y: waliTtd.y, w: waliTtd.w } : { url: '', x: 0, y: 0, w: 100 }}
        onClose={() => setWaliTtdOpen(false)}
        onSave={saveWaliTtd}
      />
    </div>
  )
}
