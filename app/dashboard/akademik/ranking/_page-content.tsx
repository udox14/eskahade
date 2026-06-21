'use client'

import { useState, useRef, useMemo } from 'react'
import { getJuaraUmum, getSantriByKelas, saveKejuaraanRow, recalcKejuaraanKelas, getRecalcKelasList, importKejuaraan } from './actions'
import { Trophy, Loader2, Printer, Search, Pencil, Check, AlertCircle, RefreshCw, FileSpreadsheet, Upload } from 'lucide-react'
import { useReactToPrint } from '@/lib/pdf/client'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

// Parse input nilai -> number|null. Kosong = null (bukan 0).
function parseNum(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

type RowStatus = 'saving' | 'saved' | 'error'

type SantriRef = { id: string; rp_id: string; nama: string; nis: string; asrama: string; kamar: string }

// Baris editable di preview. jumlah/rata default null (kosong), bukan 0.
type EditRow = {
  rank: number
  sumber: 'guru' | 'sekpen' | null
  riwayat_pendidikan_id: string | null
  kelas_id: string
  kelas_nama: string
  tahun_ajaran: string | null
  marhalah_nama: string
  marhalah_urutan: number
  wali_kelas: string
  santri_nama: string
  nis: string
  asrama: string
  kamar: string
  jumlah: string
  rata: string
}

export default function JuaraUmumPage() {
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [tahunAjaran, setTahunAjaran] = useState('2025/2026')
  const [rows, setRows] = useState<EditRow[]>([])
  const [santriByKelas, setSantriByKelas] = useState<Record<string, SantriRef[]>>({})
  const [loading, setLoading] = useState(false)
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({})
  const [recalcing, setRecalcing] = useState(false)
  const [recalcKelas, setRecalcKelas] = useState('all')
  const [recalcProgress, setRecalcProgress] = useState({ done: 0, total: 0 })
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dimensi kertas F4 mengikuti orientasi.
  const paper = orientation === 'landscape'
    ? { w: '330mm', h: '215mm' }
    : { w: '215mm', h: '330mm' }

  // Opsi kelas untuk recalc per kelas (diturunkan dari data yang sudah dimuat).
  const kelasOptions = useMemo(() => {
    const seen = new Map<string, string>()
    rows.forEach(r => { if (!seen.has(r.kelas_id)) seen.set(r.kelas_id, r.kelas_nama) })
    return Array.from(seen, ([id, nama]) => ({ id, nama }))
  }, [rows])

  // Referensi untuk area yang akan dicetak
  const printRef = useRef<HTMLDivElement>(null)

  // Fungsi React-to-Print (Update untuk v3.x)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Lampiran_Kejuaraan_Semester_${selectedSemester === '1' ? 'Ganjil' : 'Genap'}`,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Logic lama tetap: tarik hasil ranking dari input nilai guru (jadi nilai awal yang bisa diedit).
      const [res, santriMap] = await Promise.all([
        getJuaraUmum(Number(selectedSemester)),
        getSantriByKelas(),
      ])
      const mapped: EditRow[] = res.map((r: any) => ({
        rank: r.rank,
        sumber: r.sumber ?? null,
        riwayat_pendidikan_id: r.riwayat_pendidikan_id ?? null,
        kelas_id: r.kelas_id,
        kelas_nama: r.kelas_nama,
        tahun_ajaran: r.tahun_ajaran,
        marhalah_nama: r.marhalah_nama,
        marhalah_urutan: r.marhalah_urutan,
        wali_kelas: r.wali_kelas,
        santri_nama: r.santri_nama || '',
        nis: r.nis || '',
        asrama: r.asrama || '',
        kamar: r.kamar || '',
        // default null (kosong) bila belum ada nilai, bukan 0
        jumlah: r.jumlah === 0 || r.jumlah ? String(r.jumlah) : '',
        rata: r.rata === 0 || r.rata ? String(r.rata) : '',
      }))
      setRows(mapped)
      setRowStatus({})
      setSantriByKelas(santriMap)
      if (res.length > 0 && res[0].tahun_ajaran) {
        setTahunAjaran(res[0].tahun_ajaran)
      }
    } catch (error) {
      alert('Gagal memuat data kejuaraan.')
    } finally {
      setLoading(false)
    }
  }

  const updateRow = (idx: number, patch: Partial<EditRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  // Auto-save SATU baris ke database. Dipanggil saat pilih santri / selesai isi nilai.
  // Hanya jalan bila santri sudah dipilih (punya riwayat_pendidikan_id).
  const saveRow = async (idx: number, rowArg?: EditRow) => {
    const row = rowArg ?? rows[idx]
    if (!row || !row.riwayat_pendidikan_id) return
    setRowStatus(s => ({ ...s, [idx]: 'saving' }))
    try {
      const res = await saveKejuaraanRow(Number(selectedSemester), {
        riwayat_pendidikan_id: row.riwayat_pendidikan_id,
        ranking_kelas: row.rank,
        jumlah: parseNum(row.jumlah),
        rata: parseNum(row.rata),
      })
      if (res?.error) {
        setRowStatus(s => ({ ...s, [idx]: 'error' }))
        return
      }
      // Tandai baris jadi 'sekpen' (final) tanpa reload.
      setRows(prev => prev.map((r, i) => (i === idx ? { ...r, sumber: 'sekpen' } : r)))
      setRowStatus(s => ({ ...s, [idx]: 'saved' }))
    } catch {
      setRowStatus(s => ({ ...s, [idx]: 'error' }))
    }
  }

  // Saat sekpen memilih nama santri dari combobox: asrama & kamar otomatis dari database,
  // lalu langsung auto-save baris itu (per item).
  const handlePickSantri = (idx: number, kelasId: string, namaInput: string) => {
    const list = santriByKelas[kelasId] || []
    const found = list.find(s => s.nama.toLowerCase() === namaInput.toLowerCase())
    if (found) {
      const patch = {
        santri_nama: found.nama,
        nis: found.nis,
        asrama: found.asrama,
        kamar: found.kamar,
        riwayat_pendidikan_id: found.rp_id,
      }
      updateRow(idx, patch)
      saveRow(idx, { ...rows[idx], ...patch }) // pakai nilai terbaru, bukan state lama
    } else {
      // Ketikan bebas (santri belum match) — biarkan, asrama/kamar dikosongkan, belum disimpan.
      updateRow(idx, { santri_nama: namaInput, nis: '', asrama: '', kamar: '', riwayat_pendidikan_id: null })
      setRowStatus(s => { const c = { ...s }; delete c[idx]; return c })
    }
  }

  // Export Excel: 3 sheet (Juara 1/2/3). Nomor 001,002.. nyambung lintas sheet (juara 1 -> 3).
  const handleExportExcel = async () => {
    const filled = rows.filter(r => r.santri_nama.trim())
    if (filled.length === 0) {
      alert('Belum ada nama juara untuk diexport.')
      return
    }
    const XLSX = await import('xlsx')
    const pad = (n: number) => String(n).padStart(3, '0')
    const headers = ['Kelas', 'Ranking', 'Nama Santri', 'Nomor']

    const wb = XLSX.utils.book_new()
    let counter = 0 // global -> nomor nyambung juara1..juara3

    for (const juara of [1, 2, 3]) {
      // rows sudah urut marhalah_urutan -> nama_kelas (Tamhidiyyah 1 .. dst).
      const data = rows
        .filter(r => r.rank === juara && r.santri_nama.trim())
        .map(r => {
          counter++
          return [r.kelas_nama, r.rank, r.santri_nama, pad(counter)]
        })
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
      ws['!cols'] = [
        { wch: Math.max(8, ...data.map(d => String(d[0]).length)) },
        { wch: 8 },
        { wch: Math.max(12, ...data.map(d => String(d[2]).length)) },
        { wch: 8 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, `Juara ${juara}`)
    }

    const sem = selectedSemester === '1' ? 'Ganjil' : 'Genap'
    XLSX.writeFile(wb, `Kejuaraan_${sem}_${tahunAjaran.replace(/\//g, '-')}.xlsx`)
  }

  // Import balik file Excel hasil export (upsert). Baca 3 sheet (Juara 1/2/3).
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset biar bisa pilih file sama lagi
    if (!file) return
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      const items: { kelas_nama: string; ranking_kelas: number; santri_nama: string }[] = []
      for (const name of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[name], { defval: '' })
        for (const r of json) {
          const kelas = String(r['Kelas'] ?? '').trim()
          const rank = Number(r['Ranking'])
          const nama = String(r['Nama Santri'] ?? '').trim()
          if (!kelas || !rank) continue
          items.push({ kelas_nama: kelas, ranking_kelas: rank, santri_nama: nama })
        }
      }

      if (items.length === 0) {
        alert('File tidak berisi data valid. Pakai file hasil Export Excel fitur ini.')
        return
      }

      const res = await importKejuaraan(Number(selectedSemester), items)
      if (res?.success) {
        alert(
          `Import selesai.\n` +
          `Diupdate/ditambah: ${res.upsert}\n` +
          `Sama (dilewati): ${res.sama}\n` +
          `Kosong (tak nimpa): ${res.kosong}\n` +
          `Santri tak ketemu: ${res.takKetemu}`
        )
        await loadData() // refresh preview
      }
    } catch (err) {
      alert('Gagal import. Pastikan file .xlsx hasil export fitur ini.')
    } finally {
      setImporting(false)
    }
  }

  // Hitung ulang dari nilai guru (per kelas / semua). Hasilnya hitungan guru, bukan sekpen.
  // "Semua" dipecah: satu kelas per request (loop sekuensial) -> hindari limit subrequest Worker.
  const handleRecalc = async () => {
    const isAll = recalcKelas === 'all'
    const label = isAll ? 'SEMUA kelas' : (kelasOptions.find(k => k.id === recalcKelas)?.nama || 'kelas terpilih')
    if (!confirm(`Hitung ulang ranking ${label} dari input nilai guru?\n\nIni MENIMPA data juara (termasuk yang sudah difinalkan sekpen) dengan hasil hitungan guru.`)) {
      return
    }
    setRecalcing(true)
    setRecalcProgress({ done: 0, total: 0 })
    try {
      const sem = Number(selectedSemester)

      // Tentukan daftar kelas yang akan dihitung.
      const targets = isAll
        ? await getRecalcKelasList()
        : [{ id: recalcKelas, nama: label }]

      setRecalcProgress({ done: 0, total: targets.length })

      let totalSantri = 0
      let gagal = 0
      for (let i = 0; i < targets.length; i++) {
        try {
          const res = await recalcKejuaraanKelas(sem, targets[i].id)
          totalSantri += res?.santriDihitung || 0
        } catch {
          gagal++
        }
        setRecalcProgress({ done: i + 1, total: targets.length })
      }

      const pesanGagal = gagal > 0 ? ` (${gagal} kelas gagal)` : ''
      alert(`Selesai. ${targets.length - gagal} kelas, ${totalSantri} santri dihitung ulang${pesanGagal}.`)
      await loadData() // reload -> tampilkan hasil guru terbaru
    } catch (e) {
      alert('Gagal menghitung ulang.')
    } finally {
      setRecalcing(false)
    }
  }

  // Logika Grouping (Untuk menggabungkan kolom Nomor dan Kelas pakai rowSpan di tabel cetak)
  const groupedData: any[] = []
  let currentClass = ''
  let classIndex = 0

  rows.forEach((item, idx) => {
    if (item.kelas_nama !== currentClass) {
      currentClass = item.kelas_nama
      classIndex++
      groupedData.push({
        ...item,
        _idx: idx,
        isFirst: true,
        classIndex,
        rowSpan: rows.filter(d => d.kelas_nama === currentClass).length,
      })
    } else {
      groupedData.push({ ...item, _idx: idx, isFirst: false })
    }
  })

  return (
    <div className="space-y-6 pb-24">

      {/* HEADER */}
      <DashboardPageHeader
        title="Kejuaraan & Prestasi"
        description="Rekapitulasi dan cetak lampiran Juara Umum 1, 2, dan 3 seluruh kelas."
        className="border-b pb-4"
      />

      {/* FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-end gap-4">
        <div className="w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pilih Semester EHB</label>
          <select
            className="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Semester Ganjil (1)</option>
            <option value="2">Semester Genap (2)</option>
          </select>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="w-full sm:w-auto bg-slate-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm font-bold"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
          Tarik Data Juara
        </button>

        {/* Import dari file Excel hasil export (upsert) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleImportFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full sm:w-auto bg-violet-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm font-bold"
        >
          {importing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Upload className="w-5 h-5"/>}
          Import Excel
        </button>

        {rows.length > 0 && (
          <div className="w-full sm:w-auto sm:ml-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportExcel}
              className="w-full sm:w-auto bg-green-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-800 transition-colors shadow-sm font-bold"
            >
              <FileSpreadsheet className="w-5 h-5"/>
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm font-bold"
            >
              <Printer className="w-5 h-5"/>
              Cetak PDF / Print
            </button>
          </div>
        )}
      </div>

      {/* RECALC BAR (Sekpen hitung ulang dari nilai guru) */}
      <div className="bg-amber-50 p-5 rounded-2xl shadow-sm border border-amber-200 flex flex-col sm:flex-row items-end gap-4">
        <div className="flex-1">
          <label className="text-xs font-bold text-amber-700 uppercase block mb-1">Hitung Ulang dari Nilai Guru</label>
          <p className="text-xs text-amber-700/80 mb-2">Ambil ulang ranking dari input nilai guru. Menimpa data juara (termasuk yang sudah difinalkan sekpen) dengan hitungan guru.</p>
          <select
            className="w-full sm:w-auto p-3 border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
            value={recalcKelas}
            onChange={(e) => setRecalcKelas(e.target.value)}
          >
            <option value="all">Semua Kelas</option>
            {kelasOptions.map(k => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRecalc}
          disabled={recalcing}
          className="w-full sm:w-auto bg-amber-600 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm font-bold"
        >
          {recalcing ? <Loader2 className="w-5 h-5 animate-spin"/> : <RefreshCw className="w-5 h-5"/>}
          {recalcing && recalcProgress.total > 0
            ? `Menghitung ${recalcProgress.done}/${recalcProgress.total}…`
            : 'Hitung Ulang'}
        </button>
      </div>

      {/* EMPTY STATE / LOADING */}
      {loading ? (
         <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500 mb-3"/> <p className="text-slate-500 font-medium">Memindai data juara...</p></div>
      ) : rows.length === 0 ? (
         <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
           <Trophy className="w-14 h-14 text-slate-300 mx-auto mb-3"/>
           <h3 className="text-lg font-bold text-slate-600">Pilih semester dan klik Tarik Data.</h3>
           <p className="text-sm text-slate-500">Hasil ranking guru jadi nilai awal. Belum diisi guru? Sekpen bisa input manual langsung di preview.</p>
         </div>
      ) : (

         /* PREVIEW AREA (KERTAS F4 SIMULASI NARROW MARGIN) */
         <div className="bg-slate-200 p-4 md:p-8 rounded-2xl overflow-x-auto shadow-inner border border-slate-300">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-200">Preview Dokumen Cetak</span>
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-amber-200 inline-flex items-center gap-1"><Pencil className="w-3 h-3"/> Bisa Diedit</span>
                <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-200 inline-flex items-center gap-1"><Check className="w-3 h-3"/> Auto-Simpan</span>
                {/* Toggle orientasi cetak */}
                <div className="inline-flex rounded-full border border-slate-300 bg-white overflow-hidden text-xs font-bold">
                    <button
                        onClick={() => setOrientation('landscape')}
                        className={`px-3 py-1 transition-colors ${orientation === 'landscape' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Landscape
                    </button>
                    <button
                        onClick={() => setOrientation('portrait')}
                        className={`px-3 py-1 transition-colors ${orientation === 'portrait' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        Portrait
                    </button>
                </div>
            </div>

            {/* KERTAS PUTIH MURNI UNTUK DICETAK (Tanpa Kop, Font Arial 11pt, Kertas F4, Margin Sempit) */}
            <div
                ref={printRef}
                className="bg-white mx-auto shadow-xl relative text-black"
                style={{
                  width: paper.w,
                  minHeight: paper.h,
                  padding: '10mm', /* Margin narrow (1cm) */
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '11pt'
                }}
            >
                {/* CSS Khusus Print: reset margin, paksa Arial F4 narrow, dan ratakan tampilan input jadi teks polos saat dicetak */}
                <style type="text/css" media="print">
                    {`
                      @page { size: ${paper.w} ${paper.h} ${orientation}; margin: 10mm; }
                      body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 11pt !important;
                      }
                      .cetak-input {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 11pt !important;
                        -webkit-appearance: none;
                        appearance: none;
                      }
                      .no-print { display: none !important; }
                    `}
                </style>

                {/* JUDUL DOKUMEN (Langsung ke Judul) */}
                <div className="text-center mb-6">
                    <h2 className="font-bold underline tracking-wide uppercase">LAMPIRAN KEPUTUSAN KEJUARAAN EHB</h2>
                    <p className="font-bold uppercase mt-1">
                        SEMESTER {selectedSemester === '1' ? 'GANJIL' : 'GENAP'} TAHUN AJARAN {tahunAjaran}
                    </p>
                </div>

                {/* TABEL DATA JUARA */}
                <table className="w-full border-collapse border border-black">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-black p-2 w-[5%] text-center">No</th>
                            <th className="border border-black p-2 w-[20%] text-center">Tingkat / Kelas</th>
                            <th className="border border-black p-2 w-[5%] text-center">Juara</th>
                            {/* Kolom nama tidak diberi lebar fixed agar otomatis melebar semaksimal mungkin */}
                            <th className="border border-black p-2 w-auto">Nama Santri</th>
                            <th className="border border-black p-2 w-[12%]">Asrama / Kamar</th>
                            <th className="border border-black p-2 w-[8%] text-center">Jml Nilai</th>
                            <th className="border border-black p-2 w-[8%] text-center">Rata-rata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedData.map((item) => {
                          const idx = item._idx
                          const list = santriByKelas[item.kelas_id] || []
                          const datalistId = `santri-${item.kelas_id}`
                          return (
                            <tr key={idx}>
                                {/* Penggabungan Sel (RowSpan) agar rapi per kelas */}
                                {item.isFirst && (
                                    <td rowSpan={item.rowSpan} className="border border-black p-2 text-center align-top">
                                        {item.classIndex}
                                    </td>
                                )}
                                {item.isFirst && (
                                    <td rowSpan={item.rowSpan} className="border border-black p-2 align-top text-center whitespace-nowrap">
                                        <div>{item.kelas_nama}</div>
                                        <div className="text-[9pt] mt-1 capitalize text-slate-800">{item.wali_kelas}</div>
                                    </td>
                                )}

                                {/* Juara */}
                                <td className="border border-black p-2 text-center">
                                  {item.rank}
                                  {item.sumber === 'sekpen' && (
                                    <span className="no-print block mt-1 text-[8pt] font-bold text-emerald-700 normal-case">final</span>
                                  )}
                                  {item.sumber === 'guru' && (
                                    <span className="no-print block mt-1 text-[8pt] text-slate-400 normal-case">guru</span>
                                  )}
                                </td>

                                {/* Nama Santri — combobox (datalist) per kelas + indikator auto-save */}
                                <td className="border border-black p-1">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      list={datalistId}
                                      className="cetak-input flex-1 uppercase bg-amber-50/40 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                                      value={item.santri_nama}
                                      placeholder="Ketik / pilih nama…"
                                      onChange={(e) => handlePickSantri(idx, item.kelas_id, e.target.value)}
                                    />
                                    <span className="no-print w-4 shrink-0 flex items-center justify-center">
                                      {rowStatus[idx] === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400"/>}
                                      {rowStatus[idx] === 'saved' && <Check className="w-3.5 h-3.5 text-emerald-600"/>}
                                      {rowStatus[idx] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500"/>}
                                    </span>
                                  </div>
                                  <datalist id={datalistId}>
                                    {list.map(s => (
                                      <option key={s.id} value={s.nama} />
                                    ))}
                                  </datalist>
                                </td>

                                {/* Asrama / Kamar — auto dari database (format ASRAMA/ KAMAR) */}
                                <td className="border border-black p-2 whitespace-nowrap">
                                  {item.asrama ? `${item.asrama}/ ${item.kamar}` : ''}
                                </td>

                                {/* Jumlah nilai — input manual, default kosong */}
                                <td className="border border-black p-1 text-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="cetak-input w-full text-center bg-amber-50/40 border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                                    value={item.jumlah}
                                    onChange={(e) => updateRow(idx, { jumlah: e.target.value })}
                                    onBlur={() => saveRow(idx)}
                                  />
                                </td>

                                {/* Rata-rata — input manual, default kosong */}
                                <td className="border border-black p-1 text-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="cetak-input w-full text-center bg-amber-50/40 border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-indigo-400"
                                    value={item.rata}
                                    onChange={(e) => updateRow(idx, { rata: e.target.value })}
                                    onBlur={() => saveRow(idx)}
                                  />
                                </td>
                            </tr>
                          )
                        })}
                    </tbody>
                </table>
            </div>
         </div>
      )}
    </div>
  )
}
