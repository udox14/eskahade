import { createClient } from '@/lib/supabase/server'
import { tambahJenisPelanggaran, hapusJenisPelanggaran } from './actions'
import { Trash2, Plus, ShieldAlert } from 'lucide-react'

export default async function MasterPelanggaranPage() {
  const supabase = await createClient()

  const { data: list } = await supabase
    .from('master_pelanggaran')
    .select('*')
    .order('kategori', { ascending: false }) // Berat dulu
    .order('poin', { ascending: false })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Master Jenis Pelanggaran</h1>
      
      {/* FORM TAMBAH */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600"/> Tambah Aturan Baru
        </h3>
        <form 
          action={async (formData) => {
            'use server'
            await tambahJenisPelanggaran(formData)
          }} 
          className="flex flex-col md:flex-row gap-4 items-end"
        >
          <div className="w-full md:w-1/4">
            <label className="text-xs font-bold text-gray-500 uppercase">Kategori</label>
            <select name="kategori" className="w-full p-2 border rounded mt-1 bg-gray-50">
              <option value="RINGAN">RINGAN</option>
              <option value="SEDANG">SEDANG</option>
              <option value="BERAT">BERAT</option>
            </select>
          </div>
          <div className="w-full md:w-1/2">
            <label className="text-xs font-bold text-gray-500 uppercase">Nama Pelanggaran</label>
            <input type="text" name="nama_pelanggaran" required placeholder="Contoh: Kabur lewat jendela" className="w-full p-2 border rounded mt-1" />
          </div>
          <div className="w-full md:w-1/6">
            <label className="text-xs font-bold text-gray-500 uppercase">Poin</label>
            <input type="number" name="poin" required defaultValue={5} className="w-full p-2 border rounded mt-1" />
          </div>
          <button className="bg-green-700 text-white p-2 rounded w-full md:w-auto hover:bg-green-800">
            Simpan
          </button>
        </form>
      </div>

      {/* TABEL LIST */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-500">
            <tr>
              <th className="px-6 py-3">Kategori</th>
              <th className="px-6 py-3">Nama Pelanggaran</th>
              <th className="px-6 py-3 text-center">Poin</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list?.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.kategori === 'BERAT' ? 'bg-red-100 text-red-700' :
                        item.kategori === 'SEDANG' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                        {item.kategori}
                    </span>
                </td>
                <td className="px-6 py-3 font-medium">{item.nama_pelanggaran}</td>
                <td className="px-6 py-3 text-center font-mono">{item.poin}</td>
                <td className="px-6 py-3 text-right">
                  <form action={async () => {
                    'use server'
                    await hapusJenisPelanggaran(item.id)
                  }}>
                    <button className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}