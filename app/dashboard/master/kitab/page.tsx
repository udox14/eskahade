import { createClient } from '@/lib/supabase/server'
import { getKitabList, getReferensiKitab, simpanKitab, hapusKitab } from './actions'
import { Save, Trash2, Book } from 'lucide-react'

export default async function MasterKitabPage() {
  const list = await getKitabList()
  const { mapel, marhalah } = await getReferensiKitab()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Kitab Kurikulum</h1>
        <p className="text-gray-500 text-sm">Atur judul kitab yang digunakan untuk setiap mata pelajaran per marhalah.</p>
      </div>

      {/* FORM INPUT */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Book className="w-5 h-5 text-blue-600"/> Tambah / Update Kitab
        </h3>
        <form 
          action={async (formData) => {
            'use server'
            await simpanKitab(formData)
          }} 
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Marhalah</label>
            <select name="marhalah_id" required className="w-full p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-500">
              {marhalah?.map(m => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Mata Pelajaran</label>
            <select name="mapel_id" required className="w-full p-2 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-500">
              {mapel?.map(m => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nama Kitab</label>
            <input type="text" name="nama_kitab" required placeholder="Contoh: Jurumiyah" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" />
          </div>
          <button className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 font-medium flex items-center justify-center gap-2">
            <Save className="w-4 h-4"/> Simpan
          </button>
        </form>
      </div>

      {/* TABEL LIST */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-600 font-bold">
            <tr>
              <th className="px-6 py-3">Marhalah</th>
              <th className="px-6 py-3">Mata Pelajaran</th>
              <th className="px-6 py-3">Nama Kitab</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-blue-800">{item.marhalah?.nama}</td>
                <td className="px-6 py-3">{item.mapel?.nama}</td>
                <td className="px-6 py-3 font-bold italic text-gray-700">"{item.nama_kitab}"</td>
                <td className="px-6 py-3 text-right">
                  <form action={async () => {
                    'use server'
                    await hapusKitab(item.id)
                  }}>
                    <button className="text-gray-400 hover:text-red-600 transition-colors" title="Hapus">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">Belum ada data kitab.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}