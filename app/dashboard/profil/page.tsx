'use client'

import { useState, useEffect, useRef } from 'react'
import { getProfilData, updateProfil, updatePassword, uploadAvatar } from './actions'
import {
  User, Camera, Save, Lock, Phone, Mail, Shield,
  Loader2, CheckCircle, Eye, EyeOff, Building2
} from 'lucide-react'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', wali_kelas: 'Wali Kelas', pengurus_asrama: 'Pengurus Asrama',
  akademik: 'Akademik', keamanan: 'Keamanan', dewan_santri: 'Dewan Santri', bendahara: 'Bendahara',
}
const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  pengurus_asrama: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  keamanan: 'bg-blue-100 text-blue-700 border-blue-200',
  akademik: 'bg-purple-100 text-purple-700 border-purple-200',
  wali_kelas: 'bg-amber-100 text-amber-700 border-amber-200',
  dewan_santri: 'bg-teal-100 text-teal-700 border-teal-200',
  bendahara: 'bg-orange-100 text-orange-700 border-orange-200',
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 right-4 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4" /> : '⚠️'} {msg}
    </div>
  )
}

export default function ProfilPage() {
  const [profil, setProfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [nama, setNama] = useState('')
  const [phone, setPhone] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    getProfilData().then(data => {
      if (data) {
        setProfil(data); setNama(data.full_name || ''); setPhone(data.phone || '')
        setAvatarPreview(data.avatar_url || null)
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Ukuran file maksimal 2MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadingAvatar(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await uploadAvatar(fd)
    setUploadingAvatar(false)
    if ('error' in res) { showToast(res.error as string, 'error'); setAvatarPreview(profil?.avatar_url || null); return }
    showToast('Foto profil diperbarui!', 'success')
    setProfil((p: any) => ({ ...p, avatar_url: (res as any).url }))
  }

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    const res = await updateProfil({ full_name: nama, phone })
    setSavingInfo(false)
    if ('error' in res) { showToast(res.error as string, 'error'); return }
    showToast('Profil berhasil disimpan!', 'success')
    setProfil((p: any) => ({ ...p, full_name: nama, phone }))
  }

  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) { showToast('Semua field harus diisi', 'error'); return }
    setSavingPw(true)
    const res = await updatePassword({ current: pwCurrent, new: pwNew, confirm: pwConfirm })
    setSavingPw(false)
    if ('error' in res) { showToast(res.error as string, 'error'); return }
    showToast('Password berhasil diubah!', 'success')
    setPwCurrent(''); setPwNew(''); setPwConfirm('')
  }

  const initials = (profil?.full_name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  const pwStrength = pwNew.length === 0 ? 0 : pwNew.length < 6 ? 1 : pwNew.length < 10 ? 2 : 3

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div className="max-w-xl mx-auto space-y-5 pb-20">

        {/* KARTU IDENTITAS */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 relative">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '8px 8px' }} />
          </div>
          <div className="px-5 pb-5 -mt-10">
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    : <span className="text-white text-xl font-black">{initials}</span>
                  }
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow border-2 border-white transition-colors">
                  <Camera className="w-3 h-3" />
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div className="mb-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${ROLE_COLOR[profil?.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <Shield className="w-3 h-3" />{ROLE_LABEL[profil?.role] || profil?.role}
                </span>
              </div>
            </div>
            <div className="mt-2.5">
              <h2 className="text-lg font-black text-slate-800">{profil?.full_name || '—'}</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{profil?.email}</p>
              {profil?.asrama_binaan && (
                <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1"><Building2 className="w-3 h-3" />{profil.asrama_binaan}</p>
              )}
            </div>
          </div>
        </div>

        {/* INFORMASI AKUN */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" /> Informasi Akun
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Nama Lengkap</label>
              <input value={nama} onChange={e => setNama(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Email</label>
              <input value={profil?.email || ''} disabled
                className="w-full border border-slate-100 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
              <p className="text-[10px] text-slate-400 mt-1">Email tidak dapat diubah</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />No. HP / WhatsApp</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="08xxxxxxxxxx" type="tel" />
            </div>
          </div>
          <button onClick={handleSaveInfo} disabled={savingInfo}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>

        {/* GANTI PASSWORD */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" /> Ganti Password
          </h3>
          <div className="space-y-3">
            {([
              { label: 'Password Saat Ini', val: pwCurrent, set: setPwCurrent },
              { label: 'Password Baru', val: pwNew, set: setPwNew },
              { label: 'Konfirmasi Password Baru', val: pwConfirm, set: setPwConfirm },
            ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent pr-10 transition-all"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            {pwNew && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      pwStrength >= i ? i === 1 ? 'bg-red-400' : i === 2 ? 'bg-amber-400' : 'bg-emerald-500' : 'bg-slate-100'
                    }`} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {pwStrength === 1 ? 'Lemah — tambah karakter' : pwStrength === 2 ? 'Cukup' : 'Kuat ✓'}
                </p>
              </div>
            )}
          </div>
          <button onClick={handleChangePassword} disabled={savingPw}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Ganti Password
          </button>
        </div>

      </div>
    </>
  )
}
