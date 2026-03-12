import { getSantriById, updateSantri } from './actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditSantriPage({ params }: Props) {
  const { id } = await params
  const { data: santri, error } = await getSantriById(id)

  if (!santri || error) {
    return notFound()
  }

  const s = santri as any

  async function handleUpdate(formData: FormData) {
    'use server'
    await updateSantri(id, formData)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/santri/${id}`} className="p-2 bg-white border hover:bg-gray-50 rounded-full transition-colors shadow-sm text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Edit Data Santri</h1>
          <p className="text-gray-500 text-sm">{s.nama_lengkap} — NIS: {s.nis}</p>
        </div>
      </div>

      <form action={handleUpdate} className="bg-white border rounded-xl shadow-sm p-6 space-y-6">

        {/* IDENTITAS */}
        <div>
          <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Identitas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NIS</label>
              <input name="nis" defaultValue={s.nis || ''} required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
              <input name="nama_lengkap" defaultValue={s.nama_lengkap || ''} required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NIK</label>
              <input name="nik" defaultValue={s.nik || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jenis Kelamin</label>
              <select name="jenis_kelamin" defaultValue={s.jenis_kelamin || 'L'} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tempat Lahir</label>
              <input name="tempat_lahir" defaultValue={s.tempat_lahir || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Lahir</label>
              <input type="date" name="tanggal_lahir" defaultValue={s.tanggal_lahir || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
        </div>

        {/* ORANG TUA */}
        <div>
          <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Data Orang Tua</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Ayah</label>
              <input name="nama_ayah" defaultValue={s.nama_ayah || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Ibu</label>
              <input name="nama_ibu" defaultValue={s.nama_ibu || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat</label>
            <textarea name="alamat" rows={2} defaultValue={s.alamat || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"></textarea>
          </div>
        </div>

        {/* PESANTREN */}
        <div>
          <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Data Pesantren</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
              <select name="status_global" defaultValue={s.status_global || 'aktif'} className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                <option value="aktif">Aktif</option>
                <option value="arsip">Arsip</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Asrama</label>
              <input name="asrama" defaultValue={s.asrama || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kamar</label>
              <input name="kamar" defaultValue={s.kamar || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sekolah Formal</label>
              <input name="sekolah" defaultValue={s.sekolah || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas Sekolah</label>
              <input name="kelas_sekolah" defaultValue={s.kelas_sekolah || ''} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
          </div>
        </div>

        {/* TOMBOL SIMPAN */}
        <div className="pt-4 border-t flex justify-end">
          <button
            type="submit"
            className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors"
          >
            <Save className="w-5 h-5" />
            Simpan Perubahan
          </button>
        </div>

      </form>
    </div>
  )
}
