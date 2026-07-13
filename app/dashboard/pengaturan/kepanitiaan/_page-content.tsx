'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getPanitiaPsb, getPanitiaUpk, getKepengurusanAsrama, addPanitiaPsb, addPanitiaUpk, addKepengurusanAsrama, removePanitiaPsb, removePanitiaUpk, removeKepengurusanAsrama, resetPanitiaPsb, resetPanitiaUpk, resetKepengurusanAsrama, searchUsers, PanitiaMember } from './actions'
import { Users, Search, Plus, Trash2, ShieldAlert, CheckCircle, Shield, X, Loader2, RefreshCcw } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export default function KepanitiaanPageContent() {
  const [activeTab, setActiveTab] = useState<'PSB' | 'UPK' | 'ASRAMA'>('PSB')
  const [psbMembers, setPsbMembers] = useState<PanitiaMember[]>([])
  const [upkMembers, setUpkMembers] = useState<PanitiaMember[]>([])
  const [asramaMembers, setAsramaMembers] = useState<PanitiaMember[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string, full_name: string, email: string, roles: string, source_type: string }[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [psbDivisi, setPsbDivisi] = useState<'verifikasi' | 'asrama' | 'bayar'>('verifikasi')
  const [asramaJabatan, setAsramaJabatan] = useState<'ketua' | 'sekretaris' | 'bendahara'>('ketua')
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [psb, upk, asrama] = await Promise.all([getPanitiaPsb(), getPanitiaUpk(), getKepengurusanAsrama()])
      setPsbMembers(psb)
      setUpkMembers(upk)
      setAsramaMembers(asrama)
    } catch (err) {
      toast.error('Gagal memuat data kepanitiaan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true)
        const res = await searchUsers(searchQuery)
        setSearchResults(res)
        setIsSearching(false)
      } else {
        setSearchResults([])
      }
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const handleAddSubmit = async () => {
    if (selectedUserIds.length === 0) return toast.warning('Pilih minimal 1 user')
    setIsSubmitting(true)
    
    try {
      if (activeTab === 'PSB') {
        const res = await addPanitiaPsb(selectedUserIds, psbDivisi)
        if (res.error) throw new Error(res.error)
      } else if (activeTab === 'UPK') {
        const res = await addPanitiaUpk(selectedUserIds)
        if (res.error) throw new Error(res.error)
      } else {
        const res = await addKepengurusanAsrama(selectedUserIds, asramaJabatan)
        if (res.error) throw new Error(res.error)
      }
      toast.success('Berhasil menambahkan anggota')
      setIsAddModalOpen(false)
      setSelectedUserIds([])
      setSearchQuery('')
      loadData()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan anggota')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = async (userId: string, target: 'PSB' | 'UPK' | 'ASRAMA', psbDivisi?: 'verifikasi' | 'asrama' | 'bayar' | 'all') => {
    if (!confirm('Hapus hak akses user ini?')) return
    
    const toastId = toast.loading('Menghapus...')
    try {
      if (target === 'PSB') {
        await removePanitiaPsb(userId, psbDivisi || 'all')
      } else if (target === 'UPK') {
        await removePanitiaUpk(userId)
      } else {
        await removeKepengurusanAsrama(userId)
      }
      toast.success('Berhasil menghapus hak akses')
      loadData()
    } catch (err) {
      toast.error('Gagal menghapus')
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleResetPanitia = async () => {
    const eventName = activeTab === 'ASRAMA' ? 'Pengurus Asrama' : activeTab
    if (!confirm(\`PERINGATAN! Anda akan menghapus SELURUH hak akses \${eventName}. Lanjutkan?\`)) return

    const toastId = toast.loading(\`Mengosongkan \${eventName}...\`)
    try {
      if (activeTab === 'PSB') {
        await resetPanitiaPsb()
      } else if (activeTab === 'UPK') {
        await resetPanitiaUpk()
      } else {
        await resetKepengurusanAsrama()
      }
      toast.success(\`\${eventName} berhasil dikosongkan\`)
      loadData()
    } catch (err) {
      toast.error('Gagal mengosongkan panitia')
    } finally {
      toast.dismiss(toastId)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <DashboardPageHeader
        title="Manajemen Tim & Kepengurusan"
        description="Atur hak akses secara massal untuk event tahunan PSB, UPK, dan Kepengurusan Asrama."
      />

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        <button 
          onClick={() => setActiveTab('PSB')}
          className={\`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 \${activeTab === 'PSB' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
        >
          Panitia PSB
        </button>
        <button 
          onClick={() => setActiveTab('UPK')}
          className={\`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 \${activeTab === 'UPK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
        >
          Panitia UPK
        </button>
        <button 
          onClick={() => setActiveTab('ASRAMA')}
          className={\`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 \${activeTab === 'ASRAMA' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
        >
          Pengurus Asrama (KSB)
        </button>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="font-bold text-lg text-slate-800">
            {activeTab === 'ASRAMA' ? 'Anggota Pengurus' : \`Anggota Tim \${activeTab}\`}
          </h2>
          <p className="text-sm text-slate-500">
            Total {activeTab === 'PSB' ? psbMembers.length : activeTab === 'UPK' ? upkMembers.length : asramaMembers.length} anggota aktif
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleResetPanitia}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> Kosongkan {activeTab === 'ASRAMA' ? 'Pengurus' : 'Panitia'}
          </button>
          <button 
            onClick={() => { setSelectedUserIds([]); setIsAddModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah {activeTab === 'ASRAMA' ? 'Pengurus' : 'Anggota'}
          </button>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Memuat data...</div>
        ) : activeTab === 'PSB' ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">Asal Role</th>
                <th className="px-6 py-4">Divisi PSB (Akses)</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {psbMembers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada panitia terdaftar</td></tr>}
              {psbMembers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-medium">
                      {u.source_type?.toUpperCase() || 'MANUAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {u.psb_verifikasi_akses === 1 && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Kesekretariatan</span>}
                      {u.psb_asrama_akses === 1 && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Asrama</span>}
                      {u.psb_bayar_akses === 1 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Pembayaran</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleRemoveMember(u.id, 'PSB', 'all')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">Asal Role</th>
                <th className="px-6 py-4">Akses UPK</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {upkMembers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada panitia terdaftar</td></tr>}
              {upkMembers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-medium">
                      {u.source_type?.toUpperCase() || 'MANUAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-max">
                      <Shield className="w-3 h-3"/> Akses Penuh UPK
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleRemoveMember(u.id, 'UPK')} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">Asal Role</th>
                <th className="px-6 py-4">Jabatan Asrama</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asramaMembers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada pengurus terdaftar</td></tr>}
              {asramaMembers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-medium">
                      {u.source_type?.toUpperCase() || 'MANUAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={\`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-max \${
                      u.jabatan === 'ketua' ? 'bg-red-100 text-red-700' :
                      u.jabatan === 'sekretaris' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }\`}>
                      <ShieldAlert className="w-3 h-3"/> {u.jabatan?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleRemoveMember(u.id, 'ASRAMA')} title="Jadikan Anggota Biasa" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600"/> Tambah {activeTab === 'ASRAMA' ? 'Pengurus' : 'Panitia'} {activeTab}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'PSB' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Divisi / Akses PSB</label>
                  <select 
                    value={psbDivisi} 
                    onChange={(e) => setPsbDivisi(e.target.value as any)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold text-slate-700"
                  >
                    <option value="verifikasi">Kesekretariatan & Verifikasi</option>
                    <option value="asrama">Penempatan Asrama</option>
                    <option value="bayar">Keuangan & Pembayaran</option>
                  </select>
                </div>
              )}
              
              {activeTab === 'ASRAMA' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih Jabatan Asrama</label>
                  <select 
                    value={asramaJabatan} 
                    onChange={(e) => setAsramaJabatan(e.target.value as any)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold text-slate-700"
                  >
                    <option value="ketua">Ketua</option>
                    <option value="sekretaris">Sekretaris</option>
                    <option value="bendahara">Bendahara</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cari User (Guru/Sadesa)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Ketik minimal 3 huruf nama/email..." 
                    className="w-full border-2 border-slate-200 rounded-xl p-3 pl-10 outline-none focus:border-blue-500"
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  {isSearching && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="border rounded-xl overflow-hidden mt-4 divide-y max-h-[40vh] overflow-y-auto">
                  {searchResults.map(user => {
                    const isSelected = selectedUserIds.includes(user.id)
                    return (
                      <label key={user.id} className={\`flex items-center gap-3 p-3 cursor-pointer transition-colors \${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}\`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds(prev => [...prev, user.id])
                            else setSelectedUserIds(prev => prev.filter(id => id !== user.id))
                          }}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                        <div>
                          <div className="font-bold text-slate-800">{user.full_name}</div>
                          <div className="text-xs text-slate-500">{user.email} • {user.source_type || 'User'}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t bg-slate-50 shrink-0 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">{selectedUserIds.length} terpilih</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100">Batal</button>
                <button type="button" disabled={isSubmitting || selectedUserIds.length === 0} onClick={handleAddSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4" />} Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
