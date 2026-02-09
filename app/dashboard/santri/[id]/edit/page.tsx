import { getSantriById, updateSantri } from './actions'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Params = Promise<{ id: string }>

export default async function EditSantriPage(props: { params: Params }) {
  const params = await props.params;
  const id = params.id;

  const { data: santri, error } = await getSantriById(id)

  if (error || !santri) {
    return <div className="p-8 text-center text-red-500">Data tidak ditemukan.</div>
  }

  const updateWithId = updateSantri.bind(null, id)

  // Opsi Asrama
  const ASRAMA_LIST = [
    "AL-FALAH", "AS-SALAM", "BAHAGIA", 
    "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/santri/${id}`} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Data Santri</h1>
          <p className="text-slate-500 text-sm">Lengkapi data asrama, sekolah, dan identitas.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <form action={async (formData) => { "use server"; await updateWithId(formData) }} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DATA UTAMA */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Induk Santri (NIS)</label>
              <input name="nis" defaultValue={santri.nis} required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIK</label>
              <input name="nik" defaultValue={santri.nik} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input name="nama_lengkap" defaultValue={santri.nama_lengkap} required className="w-full p-2 border rounded-lg font-bold focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Kelamin</label>
              <select name="jenis_kelamin" defaultValue={santri.jenis_kelamin} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status Keaktifan</label>
              <select name="status_global" defaultValue={santri.status_global} className="w-full p-2 border rounded-lg bg-white font-medium text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="aktif">Aktif</option>
                <option value="cuti">Cuti</option>
                <option value="lulus">Lulus</option>
                <option value="alumni">Alumni</option>
                <option value="dikeluarkan">Dikeluarkan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tempat Lahir</label>
              <input name="tempat_lahir" defaultValue={santri.tempat_lahir} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Lahir</label>
              <input type="date" name="tanggal_lahir" defaultValue={santri.tanggal_lahir} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Ayah</label>
              <input name="nama_ayah" defaultValue={santri.nama_ayah} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Ibu</label>
              <input name="nama_ibu" defaultValue={santri.nama_ibu} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>

          {/* AREA DATA TEMPAT TINGGAL (ASRAMA) */}
          <div className="pt-2 border-t mt-2">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Asrama & Mukim</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-green-50/50 p-4 rounded-lg border border-green-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Asrama</label>
                <select name="asrama" defaultValue={santri.asrama} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">-- Pilih Asrama --</option>
                  {ASRAMA_LIST.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Kamar (1-50)</label>
                <input 
                  name="kamar" 
                  type="number" 
                  min="1" 
                  max="50"
                  defaultValue={santri.kamar} 
                  placeholder="Contoh: 12" 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                />
              </div>
            </div>
          </div>

          {/* AREA DATA SEKOLAH */}
          <div className="pt-2 border-t mt-2">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Sekolah Formal</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asal Sekolah</label>
                <select name="sekolah" defaultValue={santri.sekolah} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">-- Pilih Sekolah --</option>
                  <option value="MTSU">MTSU (MTs Sukahideng)</option>
                  <option value="MTSN">MTSN (MTs Negeri)</option>
                  <option value="MAN">MAN (MA Negeri)</option>
                  <option value="SMK">SMK</option>
                  <option value="SMA">SMA</option>
                  <option value="SMP">SMP</option>
                  <option value="SADESA">SADESA</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kelas di Sekolah</label>
                <input 
                  name="kelas_sekolah" 
                  defaultValue={santri.kelas_sekolah} 
                  placeholder="Contoh: 7 A, 10 IPA 1" 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
                />
              </div>
            </div>
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
            <textarea name="alamat" rows={3} defaultValue={santri.alamat} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></textarea>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-4 border-t flex justify-end gap-3">
            <Link href={`/dashboard/santri/${id}`} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Batal
            </Link>
            <button type="submit" className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm hover:shadow">
              <Save className="w-4 h-4" /> Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}