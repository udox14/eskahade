'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getPanitiaPsb, getPanitiaUpk, getKepengurusanAsrama, addPanitiaPsb, addPanitiaUpk, addKepengurusanAsrama, removePanitiaPsb, removePanitiaUpk, removeKepengurusanAsrama, resetPanitiaPsb, resetPanitiaUpk, resetKepengurusanAsrama, getAvailableUsersForDropdown, PanitiaMember } from './actions'
import { Users, Search, Plus, Trash2, ShieldAlert, CheckCircle, Shield, X, Loader2, RefreshCcw, ChevronDown } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'

export default function KepanitiaanPageContent() {
  const [activeTab, setActiveTab] = useState<'PSB' | 'UPK' | 'ASRAMA'>('PSB')
  const [psbMembers, setPsbMembers] = useState<PanitiaMember[]>([])
  const [upkMembers, setUpkMembers] = useState<PanitiaMember[]>([])
  const [asramaMembers, setAsramaMembers] = useState<PanitiaMember[]>([])
  const [loading, setLoading] = useState(true)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<{ id: string, full_name: string, source_type: string, guru_id: number | null, asrama: string | null }[]>([])
  const [selectedSource, setSelectedSource] = useState<'guru' | 'sadesa' | 'umum'>('guru')
  
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [psbDivisi, setPsbDivisi] = useState<'verifikasi' | 'asrama' | 'bayar'>('verifikasi')
  
  const [asramaJabatan, setAsramaJabatan] = useState<'ketua' | 'sekretaris' | 'bendahara'>('ketua')
  const [selectedAsramaForAdd, setSelectedAsramaForAdd] = useState<string>('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [psb, upk, asrama, usersData] = await Promise.all([getPanitiaPsb(), getPanitiaUpk(), getKepengurusanAsrama(), getAvailableUsersForDropdown()])
      setPsbMembers(psb)
      setUpkMembers(upk)
      setAsramaMembers(asrama)
      setAvailableUsers(usersData)
    } catch (err) {
      toast.error('Gagal memuat data kepanitiaan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
        const res = await addKepengurusanAsrama(selectedUserIds, selectedAsramaForAdd, asramaJabatan)
        if (res.error) throw new Error(res.error)
      }
      toast.success('Berhasil menambahkan anggota')
      setIsAddModalOpen(false)
      setSelectedUserIds([])
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
    if (!confirm(`PERINGATAN! Anda akan menghapus SELURUH hak akses ${eventName}. Lanjutkan?`)) return

    const toastId = toast.loading(`Mengosongkan ${eventName}...`)
    try {
      if (activeTab === 'PSB') {
        await resetPanitiaPsb()
      } else if (activeTab === 'UPK') {
        await resetPanitiaUpk()
      } else {
        await resetKepengurusanAsrama()
      }
      toast.success(`${eventName} berhasil dikosongkan`)
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
          className={`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'PSB' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Panitia PSB
        </button>
        <button 
          onClick={() => setActiveTab('UPK')}
          className={`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'UPK' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Panitia UPK
        </button>
        <button 
          onClick={() => setActiveTab('ASRAMA')}
          className={`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'ASRAMA' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Pengurus Asrama
        </button>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="font-bold text-lg text-slate-800">
            {activeTab === 'ASRAMA' ? 'Anggota Pengurus' : `Anggota Tim ${activeTab}`}
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
          {activeTab !== 'ASRAMA' && (
            <button 
              onClick={() => { setSelectedUserIds([]); setIsAddModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Tambah Anggota
            </button>
          )}
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
        ) : activeTab === 'UPK' ? (
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
          <div className="flex flex-col divide-y divide-gray-100">
            {ALL_ASRAMA_LIST.map(asramaName => {
              const membersInAsrama = asramaMembers.filter(m => m.asrama_binaan === asramaName)
              return (
                <details key={asramaName} className="group bg-white [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors outline-none select-none">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-800">{asramaName}</span>
                      {membersInAsrama.length > 0 && (
                        <span className="bg-slate-100 text-slate-500 font-medium text-[10px] px-2 py-0.5 rounded-full">{membersInAsrama.length} Pengurus</span>
                      )}
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  
                  <div className="p-4 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                      {(['ketua', 'sekretaris', 'bendahara'] as const).map(jabatan => {
                        const jabatanMembers = membersInAsrama.filter(m => m.jabatan === jabatan)
                        return (
                          <div key={jabatan} className="border border-slate-100 rounded-lg bg-slate-50 flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center bg-white px-3 py-2 border-b border-slate-100">
                              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">{jabatan}</span>
                              <button
                                onClick={() => {
                                  setAsramaJabatan(jabatan)
                                  setSelectedAsramaForAdd(asramaName)
                                  setSelectedUserIds([])
                                  setIsAddModalOpen(true)
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                                title={`Tambah ${jabatan} ${asramaName}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex flex-col gap-1 p-2 flex-1">
                              {jabatanMembers.length === 0 ? (
                                <div className="text-slate-400 text-[10px] italic py-1 text-center bg-white border border-dashed border-slate-200 rounded">Belum ada {jabatan}</div>
                              ) : (
                                jabatanMembers.map(u => (
                                  <div key={u.id} className="flex justify-between items-center bg-white px-2 py-1.5 rounded border border-slate-100 shadow-sm group/item">
                                    <div className="truncate pr-2">
                                      <div className="font-bold text-xs text-slate-700 truncate">{u.full_name}</div>
                                      <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{u.source_type || 'MANUAL'}</div>
                                    </div>
                                    <button onClick={() => handleRemoveMember(u.id, 'ASRAMA')} title="Cabut Jabatan" className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0 opacity-0 group-hover/item:opacity-100">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
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
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="text-sm font-bold text-blue-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Menambahkan <span className="uppercase">{asramaJabatan}</span> di asrama {selectedAsramaForAdd}
                  </div>
                  <p className="text-xs text-blue-600 mt-1">User yang dipilih otomatis diikatkan ke asrama ini.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pilih User</label>
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <select
                    value={selectedSource}
                    onChange={(e) => {
                      setSelectedSource(e.target.value as any)
                      setSelectedUserIds([])
                    }}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold text-slate-700"
                  >
                    <option value="guru">Guru</option>
                    <option value="sadesa">SADESA</option>
                    <option value="umum">Umum</option>
                  </select>
                  
                  <select
                    value={selectedUserIds[0] || ''}
                    onChange={(e) => setSelectedUserIds(e.target.value ? [e.target.value] : [])}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-bold text-slate-700"
                  >
                    <option value="">-- Pilih User --</option>
                    {availableUsers
                      .filter(u => {
                        if (selectedSource === 'guru') return u.source_type === 'guru' || u.guru_id !== null
                        if (selectedSource === 'sadesa') {
                          if (activeTab === 'ASRAMA' && u.asrama !== selectedAsramaForAdd) return false
                          return u.source_type === 'sadesa'
                        }
                        return u.source_type !== 'guru' && u.source_type !== 'sadesa' && u.guru_id === null
                      })
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                  </select>
                </div>
              </div>
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
