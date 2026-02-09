'use client'

import { useState, useEffect } from 'react'
import { getKelasList, getDataRanking, hitungUlangRanking } from './actions'
import { Trophy, RefreshCw, Loader2 } from 'lucide-react'

export default function RankingPage() {
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  
  const [rankingData, setRankingData] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [calculating, setCalculating] = useState(false)

  // Load Kelas
  useEffect(() => {
    getKelasList().then(setKelasList)
  }, [])

  // Load Ranking jika filter berubah
  useEffect(() => {
    if (!selectedKelas) return
    loadData()
  }, [selectedKelas, selectedSemester])

  const loadData = async () => {
    setLoadingData(true)
    const res = await getDataRanking(selectedKelas, Number(selectedSemester))
    setRankingData(res)
    setLoadingData(false)
  }

  const handleHitung = async () => {
    if (!confirm("Hitung ulang ranking kelas ini? Data lama akan ditimpa.")) return
    
    setCalculating(true)
    const res = await hitungUlangRanking(selectedKelas, Number(selectedSemester))
    setCalculating(false)

    if (res?.error) {
      alert("Gagal: " + res.error)
    } else {
      alert("Berhasil menghitung ranking!")
      loadData() // Refresh tabel
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ranking & Prestasi</h1>
          <p className="text-gray-500 text-sm">Hitung akumulasi nilai dan tentukan peringkat kelas.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-end justify-between shadow-sm">
        <div className="flex gap-4 w-full md:w-auto">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Pilih Kelas</label>
            <select 
              className="p-2 border rounded-md w-48 bg-gray-50"
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
            >
              <option value="">-- Kelas --</option>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Semester</label>
            <select 
              className="p-2 border rounded-md w-32 bg-gray-50"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="1">Ganjil</option>
              <option value="2">Genap</option>
            </select>
          </div>
        </div>

        {/* TOMBOL HITUNG */}
        <button 
          onClick={handleHitung}
          disabled={!selectedKelas || calculating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm w-full md:w-auto justify-center"
        >
          {calculating ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
          {calculating ? "Menghitung..." : "Hitung Ulang Ranking"}
        </button>
      </div>

      {/* HASIL RANKING */}
      {!selectedKelas ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
          <p className="text-gray-500">Pilih kelas untuk melihat juara.</p>
        </div>
      ) : loadingData ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600"/></div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          {rankingData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Data ranking belum tersedia. Klik tombol <b>"Hitung Ulang Ranking"</b> di atas.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-6 py-3 w-16 text-center">Rank</th>
                  <th className="px-6 py-3">Nama Santri</th>
                  <th className="px-6 py-3">NIS</th>
                  <th className="px-6 py-3 text-center">Jml Nilai</th>
                  <th className="px-6 py-3 text-center">Rata-rata</th>
                  <th className="px-6 py-3 text-center">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rankingData.map((r, index) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${index < 3 ? 'bg-yellow-50/50' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300' :
                        index === 1 ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-300' :
                        index === 2 ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300' :
                        'text-gray-500'
                      }`}>
                        {r.ranking_kelas}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {r.nama}
                      {index === 0 && <Trophy className="w-4 h-4 text-yellow-500 inline ml-2"/>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{r.nis}</td>
                    <td className="px-6 py-4 text-center">{r.jumlah_nilai}</td>
                    <td className="px-6 py-4 text-center font-bold">{r.rata_rata}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        r.predikat === 'Mumtaz' ? 'bg-green-100 text-green-700' :
                        r.predikat === 'Jayyid Jiddan' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {r.predikat}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}