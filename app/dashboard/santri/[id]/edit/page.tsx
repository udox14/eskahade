import { guardPage } from '@/lib/auth/guard'
import { canCrud } from '@/lib/auth/crud'
import { getSantriById, updateSantri } from './actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

const GOL_DARAH = ['A', 'B', 'AB', 'O']
const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]
const SEKOLAH_LIST = ["MTSU", "MTSN", "MAN", "SMK", "SMA", "SMP", "SADESA", "LAINNYA"]

const inputCls = "w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
const labelCls = "block text-xs font-bold text-gray-500 uppercase mb-1"

export default async function EditSantriPage({ params }: Props) {
  await guardPage('/dashboard/santri')
  if (!(await canCrud('/dashboard/santri', 'update'))) redirect('/dashboard/santri')
  const { id } = await params
  const { data: santri, error } = await getSantriById(id)

  if (!santri || error) return notFound()

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

      <form action={handleUpdate} className="space-y-6">

        {/* ── IDENTITAS ── */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b">
            <h3 className="font-bold text-blue-800 text-sm uppercase tracking-wide">Identitas Santri</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>NIS <span className="text-red-500">*</span></label>
              <input name="nis" defaultValue={s.nis || ''} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
              <input name="nama_lengkap" defaultValue={s.nama_lengkap || ''} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NIK</label>
              <input name="nik" defaultValue={s.nik || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Jenis Kelamin</label>
              <select name="jenis_kelamin" defaultValue={s.jenis_kelamin || 'L'} className={inputCls + " bg-white"}>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tempat Lahir</label>
              <input name="tempat_lahir" defaultValue={s.tempat_lahir || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tanggal Lahir</label>
              <input type="date" name="tanggal_lahir" defaultValue={s.tanggal_lahir || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Golongan Darah</label>
              <select name="gol_darah" defaultValue={s.gol_darah || ''} className={inputCls + " bg-white"}>
                <option value="">-- Tidak Diketahui --</option>
                {GOL_DARAH.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── ORANG TUA & KONTAK ── */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b">
            <h3 className="font-bold text-green-800 text-sm uppercase tracking-wide">Data Orang Tua & Kontak</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nama Ayah</label>
              <input name="nama_ayah" defaultValue={s.nama_ayah || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nama Ibu</label>
              <input name="nama_ibu" defaultValue={s.nama_ibu || ''} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>No. WhatsApp Orang Tua</label>
              <input name="no_wa_ortu" defaultValue={s.no_wa_ortu || ''} placeholder="Contoh: 08123456789" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── ALAMAT ── */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-yellow-50 border-b">
            <h3 className="font-bold text-yellow-800 text-sm uppercase tracking-wide">Alamat Lengkap</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelCls}>Alamat (Ringkas)</label>
              <textarea name="alamat" rows={2} defaultValue={s.alamat || ''} placeholder="Alamat singkat" className={inputCls + " resize-none"} />
            </div>
            <div>
              <label className={labelCls}>Alamat Lengkap (Jalan/Kampung, RT/RW, Desa)</label>
              <textarea name="alamat_lengkap" rows={2} defaultValue={s.alamat_lengkap || ''} placeholder="Contoh: Kp. Sukarame RT 01/02 Desa Sukahideng" className={inputCls + " resize-none"} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Kecamatan</label>
                <input name="kecamatan" defaultValue={s.kecamatan || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kab/Kota</label>
                <input name="kab_kota" defaultValue={s.kab_kota || ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Provinsi</label>
                <input name="provinsi" defaultValue={s.provinsi || ''} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Jemaah</label>
              <input name="jemaah" defaultValue={s.jemaah || ''} placeholder="Pengelompokan berdasarkan wilayah/jemaah" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── PESANTREN ── */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-purple-50 border-b">
            <h3 className="font-bold text-purple-800 text-sm uppercase tracking-wide">Data Pesantren</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Asrama</label>
              <select name="asrama" defaultValue={s.asrama || ''} className={inputCls + " bg-white"}>
                <option value="">-- Pilih Asrama --</option>
                {ASRAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kamar</label>
              <input name="kamar" defaultValue={s.kamar || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sekolah Formal</label>
              <select name="sekolah" defaultValue={s.sekolah || ''} className={inputCls + " bg-white"}>
                <option value="">-- Pilih Sekolah --</option>
                {SEKOLAH_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kelas Sekolah</label>
              <input name="kelas_sekolah" defaultValue={s.kelas_sekolah || ''} placeholder="Contoh: 7A, 8B" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tanggal Masuk</label>
              <input type="date" name="tanggal_masuk" defaultValue={s.tanggal_masuk || ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tanggal Keluar <span className="text-gray-400 font-normal normal-case">(isi jika keluar sebelum lulus)</span></label>
              <input type="date" name="tanggal_keluar" defaultValue={s.tanggal_keluar || ''} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── TOMBOL ── */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/dashboard/santri/${id}`} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">
            Batal
          </Link>
          <button type="submit" className="bg-green-700 hover:bg-green-800 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors text-sm">
            <Save className="w-4 h-4" />
            Simpan Perubahan
          </button>
        </div>

      </form>
    </div>
  )
}
