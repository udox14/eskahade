'use client'

import { useState, useRef } from 'react'
import { getSantriTelat } from './actions'
import { PemanggilanTelatView } from './pemanggilan-telat-view'
import { useReactToPrint } from '@/lib/pdf/client'
import { Printer, ArrowLeft, Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { Button, TextInput, ActionIcon } from '@mantine/core'

export default function CetakTelatPage() {
  const router = useRouter()
  const [tglRef, setTglRef] = useState(new Date().toISOString().split('T')[0])
  const [tglPanggil, setTglPanggil] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<Record<string, any[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const printRef = useRef(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Pemanggilan_Telat_${tglRef}`,
    onAfterPrint: () => toast.success("Dokumen dikirim ke printer")
  })

  const handleLoad = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getSantriTelat(tglRef)
    setData(res)
    setLoading(false)
    if (res) {
      const count = Object.values(res).reduce((acc: number, curr: any) => acc + curr.length, 0)
      toast.success(`Ditemukan ${count} santri terlambat pada periode ini.`)
    } else {
      toast.info("Tidak ada data santri terlambat pada minggu ini.")
    }
  }

  const totalSantri = data ? Object.values(data).reduce((acc: number, curr: any) => acc + curr.length, 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <ActionIcon onClick={() => router.back()} variant="subtle" color="gray" size="lg">
          <ArrowLeft className="w-5 h-5" />
        </ActionIcon>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cetak Santri Terlambat</h1>
          <p className="text-slate-500 text-sm">Daftar santri yang belum kembali melebihi batas izin (Per Minggu).</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border flex flex-col md:flex-row gap-6 items-end shadow-sm print:hidden">
        <div className="w-full md:w-1/3">
          <TextInput
            type="date"
            label="1. Pilih Minggu (Tanggal Referensi)"
            description="Sistem otomatis mendeteksi periode Rabu - Selasa."
            value={tglRef}
            onChange={(e) => setTglRef(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/3">
          <TextInput
            type="date"
            label="2. Tanggal Pemanggilan (Sidang)"
            description="Tanggal ini akan tertulis di surat."
            value={tglPanggil}
            onChange={(e) => setTglPanggil(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center flex-1 justify-end">
          <Button
            onClick={handleLoad}
            loading={loading}
            leftSection={<Search className="w-4 h-4" />}
            color="blue"
          >
            Tampilkan Data
          </Button>
          {totalSantri > 0 && (
            <Button
              onClick={() => handlePrint()}
              leftSection={<Printer className="w-4 h-4" />}
              color="green"
            >
              Cetak PDF
            </Button>
          )}
        </div>
      </div>

      <div className="bg-slate-100 p-8 rounded-xl border overflow-auto min-h-[500px] flex justify-center items-start">
        {!hasSearched ? (
          <div className="text-center text-slate-400 py-32 flex flex-col items-center">
            <Search className="w-12 h-12 mb-3 text-slate-300" />
            <p className="font-medium">Siap Mencari Data</p>
            <p className="text-sm">Silakan pilih tanggal dan klik tombol "Tampilkan Data".</p>
          </div>
        ) : loading ? (
          <div className="text-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          </div>
        ) : !data || totalSantri === 0 ? (
          <div className="text-center text-slate-400 py-32 flex flex-col items-center bg-white p-10 rounded-xl border border-dashed">
            <p className="font-bold text-slate-600">Tidak Ada Data</p>
            <p className="text-sm">Tidak ditemukan santri terlambat pada periode minggu tersebut.</p>
          </div>
        ) : (
          <div ref={printRef}>
            <PemanggilanTelatView
              dataPerAsrama={data}
              tglPanggil={new Date(tglPanggil)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
