'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, Plus, CheckCircle, Circle, Trash2, Loader2, BookOpen, Users, AlertTriangle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTahunAjaranList,
  tambahTahunAjaran,
  aktifkanTahunAjaran,
  hapusTahunAjaran,
} from './actions'

export default function TahunAjaranPage() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nama, setNama] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loadingAktif, setLoadingAktif] = useState<number | null>(null)
  const [loadingHapus, setLoadingHapus] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const data = await getTahunAjaranList()
    setList(data)
    setLoading(false)
  }

  const handleTambah = async () => {
    if (!nama.trim()) return toast.error('Isi nama tahun ajaran dulu.')
    setIsSaving(true)
    const res = await tambahTahunAjaran(nama.trim())
    setIsSaving(false)
    if (res?.error) toast.error(res.error)
    else {
      toast.success(`Tahun ajaran "${nama}" berhasil ditambahkan.`)
      setNama('')
      loadData()
    }
  }

  const handleAktifkan = async (id: number, nama: string) => {
    if (!confirm(`Aktifkan tahun ajaran "${nama}"?\n\nSemua kelas baru yang dibuat akan otomatis masuk ke tahun ajaran ini.`)) return
    setLoadingAktif(id)
    const res = await aktifkanTahunAjaran(id)
    setLoadingAktif(null)
    if (res?.error) toast.error(res.error)
    else {
      toast.success(`Tahun ajaran "${nama}" sekarang aktif.`)
      loadData()
    }
  }

  const handleHapus = async (id: number, nama: string) => {
    if (!confirm(`Hapus tahun ajaran "${nama}"?\nPastikan tidak ada kelas terkait.`)) return
    setLoadingHapus(id)
    const res = await hapusTahunAjaran(id)
    setLoadingHapus(null)
    if (res?.error) toast.error(res.error)
    else {
      toast.success('Tahun ajaran dihapus.')
      loadData()
    }
  }

  const aktif = list.find(t => t.is_active)

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-green-700" />
          Tahun Ajaran
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Kelola tahun ajaran. Hanya satu yang bisa aktif dalam satu waktu. Kelas baru otomatis terhubung ke tahun ajaran yang sedang aktif.
        </p>
      </div>

      {/* INFO AKTIF */}
      {aktif && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">Tahun Ajaran Aktif: {aktif.nama}</p>
            <p className="text-xs text-green-600 mt-0.5">
              {aktif.jumlah_kelas} kelas · {aktif.jumlah_santri} santri aktif
            </p>
          </div>
        </div>
      )}

      {/* FORM TAMBAH */}
      <div className="bg-white border rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wide">Tambah Tahun Ajaran Baru</h2>
        <div className="flex gap-3">
          <input
            value={nama}
            onChange={e => setNama(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTambah()}
            placeholder="Contoh: 2025/2026"
            className="flex-1 p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleTambah}
            disabled={isSaving || !nama.trim()}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tambah
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Format yang disarankan: <span className="font-mono">2025/2026</span></p>
      </div>

      {/* DAFTAR TAHUN AJARAN */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Daftar Tahun Ajaran</h2>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada tahun ajaran. Tambahkan di atas.</p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map(ta => (
              <div
                key={ta.id}
                className={`px-6 py-4 flex items-center gap-4 transition-colors ${ta.is_active ? 'bg-green-50/60' : 'hover:bg-gray-50'}`}
              >
                {/* STATUS ICON */}
                <div className="flex-shrink-0">
                  {ta.is_active
                    ? <CheckCircle className="w-6 h-6 text-green-600" />
                    : <Circle className="w-6 h-6 text-gray-300" />
                  }
                </div>

                {/* INFO */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-base ${ta.is_active ? 'text-green-800' : 'text-gray-700'}`}>
                      {ta.nama}
                    </span>
                    {ta.is_active && (
                      <span className="text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {ta.jumlah_kelas} kelas
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {ta.jumlah_santri} santri aktif
                    </span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!ta.is_active && (
                    <button
                      onClick={() => handleAktifkan(ta.id, ta.nama)}
                      disabled={loadingAktif === ta.id}
                      className="text-xs font-bold text-green-700 border border-green-300 bg-white hover:bg-green-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {loadingAktif === ta.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCircle className="w-3 h-3" />
                      }
                      Aktifkan
                    </button>
                  )}
                  {!ta.is_active && (
                    <button
                      onClick={() => handleHapus(ta.id, ta.nama)}
                      disabled={loadingHapus === ta.id}
                      className="text-xs font-bold text-red-500 border border-red-200 bg-white hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                      title="Hapus tahun ajaran"
                    >
                      {loadingHapus === ta.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CATATAN */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-bold">Catatan Penting</p>
          <ul className="space-y-1 text-xs list-disc list-inside text-amber-700">
            <li>Mengaktifkan tahun ajaran baru <strong>tidak menghapus</strong> data tahun sebelumnya.</li>
            <li>Setelah mengaktifkan tahun ajaran baru, buat kelas-kelas baru untuk tahun tersebut.</li>
            <li>Data santri, nilai, absensi, dan keuangan tahun lama tetap aman dan bisa dilihat di riwayat.</li>
            <li>Tahun ajaran hanya bisa dihapus jika belum ada kelas yang terdaftar di dalamnya.</li>
          </ul>
        </div>
      </div>

    </div>
  )
}
