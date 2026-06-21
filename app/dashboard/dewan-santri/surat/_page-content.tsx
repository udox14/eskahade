'use client'

import React from 'react'

import { useCallback, useState, useRef, useEffect } from 'react'
import { Button, ActionIcon, TextInput, Textarea, NativeSelect, Badge } from '@mantine/core'
import { cariSantri, cekTunggakanSantri, catatSuratKeluar, getRiwayatSurat, hapusRiwayatSurat, getSantriById } from './actions'
import { useSearchParams } from 'next/navigation'
import { SuratView } from './surat-view'
import { useReactToPrint } from '@/lib/pdf/client'
import { Printer, Search, FileText, ArrowLeft, Loader2, History, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useConfirm } from '@/components/ui/confirm-dialog'

const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

type JenisSurat = 'MONDOK' | 'IZIN' | 'BERHENTI' | 'TAGIHAN'

type SantriSurat = {
  id: string
  nama_lengkap: string
  nis?: string | null
  asrama?: string | null
  kamar?: string | null
  tempat_lahir?: string | null
  tanggal_lahir?: string | null
  jenis_kelamin?: string | null
  alamat?: string | null
  nama_ayah?: string | null
  sekolah?: string | null
  kelas_sekolah?: string | null
}

type DataTambahanSurat = {
  alasan?: string
  tglMulai?: string
  tglSelesai?: string
}

type DataTunggakanSurat = {
  adaTunggakan: boolean
  listBulan: string
  total: number
  tahun: number
  totalBulan?: number
  totalHistoris?: number
  totalBerjalan?: number
  historis?: Array<{ label: string; nominal: number }>
  berjalan?: Array<{ label: string; nominal: number }>
  items?: Array<{ label: string; nominal: number; source: 'BERJALAN' | 'HISTORIS' }>
}

type RiwayatSurat = {
  id: string
  jenis_surat: JenisSurat | string
  detail_info: string | null
  created_at: string
  nama_lengkap: string
  asrama: string | null
  admin_nama: string | null
}

export default function LayananSuratPage() {
  const confirm = useConfirm()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [jenisSurat, setJenisSurat] = useState<JenisSurat | null>(null)

  useEffect(() => {
    const action = searchParams.get('action')
    const sId = searchParams.get('santriId')
    if (action === 'tagihan' && sId) {
      setJenisSurat('TAGIHAN')
      setLoading(true)
      getSantriById(sId).then(async (s) => {
        if (s) {
          setSelectedSantri(s)
          const tunggakan = await cekTunggakanSantri(s.id)
          setDataTunggakan(tunggakan)
          setStep(4)
        } else {
          toast.error("Santri tidak ditemukan")
        }
        setLoading(false)
      }).catch(err => {
        toast.error(err?.message || "Gagal memuat data santri")
        setLoading(false)
      })
    }
  }, [searchParams])

  const [search, setSearch] = useState('')
  const [hasilCari, setHasilCari] = useState<SantriSurat[]>([])
  const [selectedSantri, setSelectedSantri] = useState<SantriSurat | null>(null)
  const [dataTambahan, setDataTambahan] = useState<DataTambahanSurat>({})
  const [dataTunggakan, setDataTunggakan] = useState<DataTunggakanSurat | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const [riwayat, setRiwayat] = useState<RiwayatSurat[]>([])
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1)
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear())
  const [loadingRiwayat, setLoadingRiwayat] = useState(true)

  const printRef = useRef<HTMLDivElement>(null)

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Surat_${jenisSurat}_${selectedSantri?.nama_lengkap}`,
    onAfterPrint: () => {
        setIsPrinting(false)
        toast.success("Dokumen dikirim ke printer")
    }
  })

  const loadRiwayat = useCallback(async () => {
    setLoadingRiwayat(true)
    const res = await getRiwayatSurat(filterBulan, filterTahun)
    setRiwayat(res)
    setLoadingRiwayat(false)
  }, [filterBulan, filterTahun])

  useEffect(() => {
    loadRiwayat()
  }, [loadRiwayat])

  const selectJenis = (jenis: JenisSurat) => {
    setJenisSurat(jenis)
    setStep(2)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (search.length < 3) return toast.warning("Ketik minimal 3 huruf")
    setLoading(true)
    const res = await cariSantri(search)
    setHasilCari(res)
    setLoading(false)
  }

  const selectSantri = async (s: SantriSurat) => {
    setSelectedSantri(s)

    if (jenisSurat === 'TAGIHAN') {
       const tunggakan = await cekTunggakanSantri(s.id)
       setDataTunggakan(tunggakan)
       if (!tunggakan.adaTunggakan) toast.success("Santri ini LUNAS (Tidak ada tunggakan)")
    }

    if (jenisSurat === 'MONDOK' || jenisSurat === 'TAGIHAN') {
       setStep(4)
    } else {
       setStep(3)
    }
  }

  const handleInputTambahan = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(4)
  }

  const handlePrintProcess = async () => {
    if (!selectedSantri || !jenisSurat) return
    setIsPrinting(true)

    const info = jenisSurat === 'IZIN' ? (dataTambahan.alasan || 'Izin Pulang') :
                 jenisSurat === 'TAGIHAN' ? `Tunggakan: ${dataTunggakan?.totalBulan ?? dataTunggakan?.items?.length ?? 0} bulan, Total Rp ${dataTunggakan?.total?.toLocaleString('id-ID')}` :
                 jenisSurat === 'BERHENTI' ? "Pengunduran Diri" : "Keterangan Aktif"

    try {
      const res = await catatSuratKeluar(selectedSantri.id, jenisSurat, info)

      if ('error' in res) {
        toast.error("Gagal mencatat riwayat surat", { description: "Tapi proses cetak tetap dilanjutkan." })
      } else {
        loadRiwayat()
      }

      triggerPrint()
    } catch (error) {
      console.error(error)
      toast.error("Terjadi kendala saat menyiapkan cetak", { description: "Silakan coba cetak ulang." })
      setIsPrinting(false)
    }
  }

  const handleDeleteRiwayat = async (id: string) => {
    if (!await confirm("Hapus catatan surat ini?")) return

    const toastId = toast.loading("Menghapus...")
    const res = await hapusRiwayatSurat(id)
    toast.dismiss(toastId)

    if ('error' in res) {
        toast.error("Gagal hapus", { description: res.error })
    } else {
        toast.success("Berhasil dihapus")
        loadRiwayat()
    }
  }

  return (
    <div className="space-y-12 pb-20">

       {/* HEADER */}
       <div className="flex items-center gap-4 print:hidden">
        {step > 1 && (
            <ActionIcon onClick={() => setStep(step - 1)} variant="subtle" color="gray" size="lg" radius="xl">
              <ArrowLeft className="w-5 h-5"/>
            </ActionIcon>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Layanan Surat</h1>
          <p className="text-slate-500 text-sm">Generator surat otomatis & Arsip surat keluar.</p>
        </div>
      </div>

      {/* GENERATOR */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 print:border-none print:p-0 print:bg-white">

          {/* STEP 1: PILIH JENIS */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in print:hidden">
                <MenuCard title="Ket. Mondok" desc="Surat aktif santri" icon={FileText} color="bg-blue-600" onClick={() => selectJenis('MONDOK')} />
                <MenuCard title="Izin Pulang" desc="Surat jalan & perizinan" icon={FileText} color="bg-purple-600" onClick={() => selectJenis('IZIN')} />
                <MenuCard title="Surat Tagihan" desc="Pemberitahuan tunggakan SPP" icon={FileText} color="bg-orange-600" onClick={() => selectJenis('TAGIHAN')} />
                <MenuCard title="Berhenti / Pindah" desc="Surat keterangan keluar" icon={FileText} color="bg-red-600" onClick={() => selectJenis('BERHENTI')} />
            </div>
          )}

          {/* STEP 2: CARI SANTRI */}
          {step === 2 && (
            <div className="bg-white p-6 rounded-xl border shadow-sm max-w-xl mx-auto animate-in slide-in-from-right-4 print:hidden">
                <h3 className="font-bold text-lg mb-4 text-center">Cari Santri</h3>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <TextInput
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Nama / NIS..."
                      className="flex-1"
                      radius="xl"
                    />
                    <Button type="submit" loading={loading} color="blue" px="lg" radius="lg">
                      {!loading && <Search className="w-5 h-5"/>}
                    </Button>
                </form>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {hasilCari.map(s => (
                        <div key={s.id} onClick={() => selectSantri(s)} className="p-3 border rounded hover:bg-blue-50 cursor-pointer">
                            <p className="font-bold">{s.nama_lengkap}</p>
                            <p className="text-xs text-slate-500">{s.asrama} - Kamar {s.kamar}</p>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* STEP 3: INPUT TAMBAHAN */}
          {step === 3 && (
            <div className="bg-white p-6 rounded-xl border shadow-sm max-w-xl mx-auto animate-in slide-in-from-right-4 print:hidden">
                <h3 className="font-bold text-lg mb-4">Detail Surat {jenisSurat}</h3>
                <form onSubmit={handleInputTambahan} className="space-y-4">
                    {jenisSurat === 'IZIN' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <TextInput
                                  type="date"
                                  label="Dari Tanggal"
                                  required
                                  onChange={e => setDataTambahan({...dataTambahan, tglMulai: e.target.value})}
                                />
                                <TextInput
                                  type="date"
                                  label="Sampai Tanggal"
                                  required
                                  onChange={e => setDataTambahan({...dataTambahan, tglSelesai: e.target.value})}
                                />
                            </div>
                            <Textarea
                              label="Keperluan"
                              required
                              onChange={e => setDataTambahan({...dataTambahan, alasan: e.target.value})}
                              rows={3}
                            />
                        </>
                    )}
                    {jenisSurat === 'BERHENTI' && (
                        <Textarea
                          label="Alasan Berhenti"
                          required
                          onChange={e => setDataTambahan({...dataTambahan, alasan: e.target.value})}
                          rows={3}
                        />
                    )}
                    <Button type="submit" color="green" fullWidth>Lanjut Preview</Button>
                </form>
            </div>
          )}

          {/* STEP 4: PREVIEW */}
          {step === 4 && selectedSantri && jenisSurat && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in">
                <div className="flex gap-4 print:hidden">
                    <Button onClick={() => setStep(1)} disabled={isPrinting} variant="outline" color="gray">Batal / Ganti</Button>
                    <Button
                      onClick={() => handlePrintProcess()}
                      loading={isPrinting}
                      color="green"
                      leftSection={<Printer className="w-4 h-4"/>}
                    >
                      Cetak & Simpan
                    </Button>
                </div>

                <div className="bg-slate-200 p-8 border rounded-xl overflow-auto max-w-full print:p-0 print:bg-white print:border-none print:w-full print:overflow-visible">
                    <div ref={printRef} className="bg-white shadow-2xl print:shadow-none print:w-full">
                        <SuratView
                            jenis={jenisSurat}
                            dataSantri={selectedSantri}
                            dataTambahan={dataTambahan}
                            dataTunggakan={dataTunggakan || undefined}
                        />
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* RIWAYAT */}
      <div className="border-t pt-8 print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-6 h-6 text-orange-600"/> Agenda Surat Keluar
              </h2>

              <div className="flex gap-2">
                  <NativeSelect
                    value={String(filterBulan)}
                    onChange={e => setFilterBulan(Number(e.target.value))}
                    data={BULAN_LIST.map((b, i) => ({ label: b, value: String(i+1) }))}
                  />
                  <NativeSelect
                    value={String(filterTahun)}
                    onChange={e => setFilterTahun(Number(e.target.value))}
                    data={['2024', '2025', '2026']}
                  />
              </div>
          </div>

          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
             {loadingRiwayat ? (
                 <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400"/></div>
             ) : riwayat.length === 0 ? (
                 <div className="text-center py-12 text-slate-400 text-sm">Belum ada surat keluar bulan ini.</div>
             ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                            <tr>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Jenis Surat</th>
                                <th className="px-6 py-3">Atas Nama</th>
                                <th className="px-6 py-3">Asrama</th>
                                <th className="px-6 py-3">Keterangan</th>
                                <th className="px-6 py-3">Admin</th>
                                <th className="px-6 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {riwayat.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{format(new Date(row.created_at), 'dd/MM/yyyy HH:mm', {locale:id})}</td>
                                    <td className="px-6 py-3">
                                        <Badge
                                          color={
                                            row.jenis_surat === 'IZIN' ? 'grape' :
                                            row.jenis_surat === 'TAGIHAN' ? 'orange' :
                                            'blue'
                                          }
                                          variant="light"
                                          size="sm"
                                        >
                                          {row.jenis_surat}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-3 font-bold text-slate-800">{row.nama_lengkap}</td>
                                    <td className="px-6 py-3 text-xs text-slate-500">{row.asrama}</td>
                                    <td className="px-6 py-3 text-xs italic text-slate-600 max-w-xs truncate">{row.detail_info}</td>
                                    <td className="px-6 py-3 text-xs text-slate-500">{row.admin_nama}</td>
                                    <td className="px-6 py-3 text-right">
                                        <ActionIcon
                                          onClick={() => handleDeleteRiwayat(row.id)}
                                          variant="subtle"
                                          color="red"
                                          title="Hapus Arsip"
                                        >
                                          <Trash2 className="w-4 h-4"/>
                                        </ActionIcon>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             )}
          </div>
      </div>

    </div>
  )
}

function MenuCard({
  title,
  desc,
  icon: Icon,
  color,
  onClick,
}: {
  title: string
  desc: string
  icon: React.ElementType
  color: string
  onClick: () => void
}) {
  return (
    <div onClick={onClick} className={`${color} text-white p-6 rounded-2xl shadow-sm cursor-pointer hover:scale-105 transition-transform flex flex-col items-center text-center justify-center h-40`}>
       <Icon className="w-10 h-10 mb-3 opacity-80"/>
       <h3 className="font-bold text-lg">{title}</h3>
       <p className="text-xs opacity-80">{desc}</p>
    </div>
  )
}
