'use client'

import { useState, useEffect } from 'react'
import { getDaftarKelas, getKandidatWaliKelas, setWaliKelas } from './actions'
import { UserCheck, Save, Loader2, School, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function ManajemenWaliKelasPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [kandidatList, setKandidatList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [kelas, kandidat] = await Promise.all([
      getDaftarKelas(),
      getKandidatWaliKelas()
    ])
    setKelasList(kelas)
    setKandidatList(kandidat)
    setLoading(false)
  }

  const handleSimpan = async (kelasId: string, userId: string) => {
    setProcessingId(kelasId)
    const res = await setWaliKelas(kelasId, userId)
    
    if (res?.error) {
      toast.error("Gagal update", { description: res.error })
    } else {
      toast.success("Berhasil", { description: "Wali kelas telah diperbarui." })
      // Update local state agar UI berubah instan
      setKelasList(prev => prev.map(k => {
        if (k.id === kelasId) {
          const user = kandidatList.find(u => u.id === userId)
          return { ...k, wali_kelas: user ? { id: user.id, full_name: user.full_name } : null }
        }
        return k
      }))
    }
    setProcessingId(null)
  }

  // Filter Search
  const filteredKelas = kelasList.filter(k => 
    k.nama_kelas.toLowerCase().includes(search.toLowerCase()) ||
    k.marhalah?.nama.toLowerCase().includes(search.toLowerCase()) ||
    k.wali_kelas?.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600"/> Manajemen Wali Kelas
          </h1>
          <p className="text-gray-500 text-sm">Pasangkan kelas dengan ustadz/ustadzah yang bertanggung jawab.</p>
        </div>
        
        {/* Search */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
            <input 
                type="text" 
                placeholder="Cari kelas / nama wali..." 
                className="pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
      </div>

      {/* TABEL LIST */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-bold border-b">
            <tr>
              <th className="px-6 py-4">Nama Kelas</th>
              <th className="px-6 py-4">Tingkat (Marhalah)</th>
              <th className="px-6 py-4">Wali Kelas</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></td></tr>
            ) : filteredKelas.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400">Data tidak ditemukan.</td></tr>
            ) : (
              filteredKelas.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <School className="w-4 h-4"/>
                        </div>
                        <span className="font-bold text-gray-800 text-lg">{k.nama_kelas}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {k.marhalah?.nama}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select 
                        className={`p-2 border rounded-lg text-sm w-64 outline-none cursor-pointer font-bold transition-colors ${
                          k.wali_kelas ? 'bg-white border-gray-200 text-gray-700' : 'bg-red-50 border-red-200 text-red-600'
                        }`}
                        value={k.wali_kelas?.id || ""}
                        onChange={(e) => handleSimpan(k.id, e.target.value)}
                        disabled={processingId === k.id}
                      >
                        <option value="">-- Belum Ada Wali Kelas --</option>
                        {kandidatList.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                      {processingId === k.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600"/>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {k.wali_kelas ? (
                        <span className="text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-full">TERISI</span>
                    ) : (
                        <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded-full">KOSONG</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}