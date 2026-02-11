'use client'

import { useState, useEffect } from 'react'
import { getUsersList, updateUserRole, createUser, resetUserPassword, deleteUser, updateUserDetails, createUsersBatch } from './actions'
import { UserCog, Save, Loader2, Shield, Plus, X, Home, Mail, Key, Trash2, Edit, Filter, FileSpreadsheet, Upload, CheckCircle, AlertCircle, Download, AlertTriangle, Coins } from 'lucide-react'
import { toast } from 'sonner' 

declare global {
  interface Window {
    XLSX: any;
  }
}

// UPDATE: Tambahkan Role Bendahara
const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'bendahara', label: 'Bendahara Umum' }, // BARU
  { value: 'sekpen', label: 'Sekpen' },
  { value: 'keamanan', label: 'Keamanan' },
  { value: 'dewan_santri', label: 'Dewan Santri' },
  { value: 'pengurus_asrama', label: 'Pengurus Asrama' },
  { value: 'wali_kelas', label: 'Wali Kelas' },
]

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function ManajemenUserPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  // Filter State
  const [filterRole, setFilterRole] = useState('SEMUA')

  // Modals
  const [isOpenAdd, setIsOpenAdd] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newRole, setNewRole] = useState('wali_kelas')

  const [isAsramaModalOpen, setIsAsramaModalOpen] = useState(false)
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{userId: string, role: string} | null>(null)

  const [isOpenReset, setIsOpenReset] = useState(false)
  const [userToReset, setUserToReset] = useState<{id: string, name: string} | null>(null)

  const [isOpenDelete, setIsOpenDelete] = useState(false)
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null)

  const [isOpenEdit, setIsOpenEdit] = useState(false)
  const [userToEdit, setUserToEdit] = useState<{id: string, name: string, email: string} | null>(null)

  // State Import Excel
  const [isOpenImport, setIsOpenImport] = useState(false)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const data = await getUsersList()
    setUsers(data)
    setLoading(false)
  }

  // --- FILTERING ---
  const filteredUsers = users.filter(u => {
    if (filterRole === 'SEMUA') return true
    return u.role === filterRole
  })

  // --- HANDLERS ROLE ---
  const executeUpdateRole = async (userId: string, newRole: string, asrama?: string) => {
    setProcessingId(userId)
    const toastId = toast.loading("Mengupdate hak akses...")

    const res = await updateUserRole(userId, newRole, asrama)
    
    toast.dismiss(toastId)
    setProcessingId(null)

    if (res?.error) {
      toast.error("Gagal update", { description: res.error })
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, asrama_binaan: asrama } : u))
      toast.success("Berhasil diupdate", { 
        description: `Role diubah menjadi ${newRole.replace('_', ' ')} ${asrama ? `(${asrama})` : ''}` 
      })
    }
  }

  const handleRoleChange = (userId: string, newRole: string) => {
    if (newRole === 'pengurus_asrama') {
      setPendingRoleUpdate({ userId, role: newRole })
      setIsAsramaModalOpen(true)
      return
    }
    executeUpdateRole(userId, newRole)
  }

  const handleSelectAsrama = (asrama: string) => {
    if (pendingRoleUpdate) {
      setIsAsramaModalOpen(false)
      executeUpdateRole(pendingRoleUpdate.userId, pendingRoleUpdate.role, asrama)
      setPendingRoleUpdate(null)
    }
  }

  // --- HANDLER CREATE ---
  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsCreating(true)
    const toastId = toast.loading("Membuat akun baru...")
    
    const formData = new FormData(e.currentTarget)
    const res = await createUser(formData)
    
    setIsCreating(false)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal membuat user", { description: res.error })
    } else {
      toast.success("Akun Berhasil Dibuat!", { description: "User bisa langsung login sekarang." })
      setIsOpenAdd(false)
      loadData()
    }
  }

  // --- HANDLER EDIT USER ---
  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userToEdit) return

    const formData = new FormData(e.currentTarget)
    const fullName = formData.get('full_name') as string
    const email = formData.get('email') as string

    const toastId = toast.loading("Menyimpan perubahan...")
    const res = await updateUserDetails(userToEdit.id, fullName, email)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal Edit", { description: res.error })
    } else {
      toast.success("Data User Diperbarui")
      setIsOpenEdit(false)
      setUserToEdit(null)
      loadData()
    }
  }

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userToReset) return

    const formData = new FormData(e.currentTarget)
    const newPass = formData.get('new_password') as string

    const toastId = toast.loading("Mereset password...")
    const res = await resetUserPassword(userToReset.id, newPass)
    toast.dismiss(toastId)

    if (res?.error) {
      toast.error("Gagal Reset", { description: res.error })
    } else {
      toast.success("Password Berhasil Direset")
      setIsOpenReset(false)
      setUserToReset(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    
    const toastId = toast.loading("Menghapus user...")
    const res = await deleteUser(userToDelete.id)
    toast.dismiss(toastId)

    if (res?.error) {
        toast.error("Gagal Hapus", { description: res.error })
    } else {
        toast.success("User Dihapus")
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id))
        setIsOpenDelete(false)
        setUserToDelete(null)
    }
  }

  // --- HANDLER IMPORT EXCEL (CDN) ---
  const handleDownloadTemplate = () => {
    if (!window.XLSX) return toast.error("Library Excel belum siap.")

    const rows = [
      { "NAMA LENGKAP": "Budi Santoso", "EMAIL": "budi@pesantren.com", "PASSWORD": "password123", "ROLE": "wali_kelas", "ASRAMA": "" },
      { "NAMA LENGKAP": "Ahmad Keamanan", "EMAIL": "ahmad@pesantren.com", "PASSWORD": "password123", "ROLE": "keamanan", "ASRAMA": "" },
      { "NAMA LENGKAP": "Siti Bendahara", "EMAIL": "siti@pesantren.com", "PASSWORD": "password123", "ROLE": "bendahara", "ASRAMA": "" },
    ]
    const worksheet = window.XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:15}, {wch:15}]
    
    const workbook = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Template User")
    window.XLSX.writeFile(workbook, "Template_Import_User.xlsx")

    toast.success("Template berhasil didownload")
  }

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.XLSX) return toast.error("Library Excel belum siap.")

    const toastId = toast.loading("Membaca file Excel...")

    const reader = new FileReader()
    reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result
          const wb = window.XLSX.read(bstr, { type: 'binary' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = window.XLSX.utils.sheet_to_json(ws)
          
          // Mapping
          const mappedData = data.map((row: any) => ({
              full_name: row['NAMA LENGKAP'],
              email: row['EMAIL'],
              password: row['PASSWORD'],
              role: row['ROLE']?.toLowerCase(),
              asrama_binaan: row['ASRAMA']?.toUpperCase(),
              isValid: row['NAMA LENGKAP'] && row['EMAIL'] && row['PASSWORD'] && row['ROLE']
          }))
          
          setExcelData(mappedData)
          toast.dismiss(toastId)
          toast.success(`Berhasil membaca ${mappedData.length} baris data`)
        } catch (error) {
          toast.dismiss(toastId)
          toast.error("File Excel tidak valid")
        }
    }
    reader.readAsBinaryString(file)
  }

  const handleSimpanBatch = async () => {
    if (excelData.length === 0) return
    if (!confirm(`Import ${excelData.filter(d=>d.isValid).length} user?`)) return

    setIsImporting(true)
    const toastId = toast.loading("Membuat akun batch...")
    
    const validData = excelData.filter(d => d.isValid)
    const res = await createUsersBatch(validData)
    
    setIsImporting(false)
    toast.dismiss(toastId)

    if (res?.success) {
        toast.success(`Berhasil membuat ${res.count} user.`)
        if (res.errors) {
            toast.warning("Beberapa user gagal", { description: res.errors.join(", ") })
        }
        setIsOpenImport(false)
        setExcelData([])
        loadData()
    } else {
        toast.error("Gagal Import", { description: "Terjadi kesalahan sistem." })
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-700">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h1>
            <p className="text-gray-500 text-sm">Kelola akun, reset password, dan hak akses.</p>
          </div>
        </div>
        
        <div className="flex gap-2">
            {/* Filter Dropdown */}
            <div className="relative">
                <select 
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-3 pr-8 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                    <option value="SEMUA">Semua Role</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <Filter className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>

            <button 
                onClick={() => setIsOpenImport(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
            >
                <FileSpreadsheet className="w-5 h-5" /> Import Excel
            </button>
            
            <button 
                onClick={() => setIsOpenAdd(true)}
                className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
            >
                <Plus className="w-5 h-5" /> Tambah User
            </button>
        </div>
      </div>

      {/* TABEL LIST */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b">
              <tr>
                <th className="px-6 py-4">Nama Lengkap & Email</th>
                <th className="px-6 py-4">Role / Hak Akses</th>
                <th className="px-6 py-4">Asrama Binaan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10">Memuat data...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10">Data user tidak ditemukan.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{u.full_name || "Tanpa Nama"}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Mail className="w-3 h-3"/> {u.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select 
                          className={`p-2 border rounded-lg text-sm w-48 outline-none cursor-pointer font-bold transition-colors ${
                            u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            u.role === 'pengurus_asrama' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            u.role === 'bendahara' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-white text-gray-700'
                          }`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={processingId === u.id}
                        >
                          {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        {processingId === u.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600"/>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.role === 'pengurus_asrama' ? (
                        <button 
                          onClick={() => {
                            setPendingRoleUpdate({ userId: u.id, role: 'pengurus_asrama' })
                            setIsAsramaModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                        >
                          <Home className="w-3 h-3"/> {u.asrama_binaan || "Pilih Asrama"}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        
                        <button 
                          onClick={() => {
                            setUserToEdit({ id: u.id, name: u.full_name, email: u.email })
                            setIsOpenEdit(true)
                          }}
                          className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Edit Detail"
                        >
                          <Edit className="w-4 h-4"/>
                        </button>

                        <button 
                          onClick={() => {
                            setUserToReset({ id: u.id, name: u.full_name })
                            setIsOpenReset(true)
                          }}
                          className="text-gray-500 hover:text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4"/>
                        </button>

                        <button 
                          onClick={() => {
                            setUserToDelete({ id: u.id, name: u.full_name })
                            setIsOpenDelete(true)
                          }}
                          className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ... MODAL (Sama seperti sebelumnya) ... */}
      {/* SAYA TIDAK MENGULANG BAGIAN MODAL AGAR KODE TIDAK KEPOTONG, */}
      {/* KARENA BAGIAN BAWAH FILE INI SUDAH BENAR SEPERTI SEBELUMNYA */}
      {/* Pastikan Anda menyalin bagian modal dari kode sebelumnya jika belum ada */}
      {/* Tapi untuk amannya, saya sertakan full code lagi di bawah ini */}
      
      {/* --- MODAL TAMBAH USER --- */}
      {isOpenAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Tambah Pengguna Baru</h3>
              <button onClick={() => setIsOpenAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                <input name="full_name" required placeholder="Contoh: Ustadz Ahmad" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Login</label>
                <input name="email" type="email" required placeholder="email@pesantren.com" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                <input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role / Hak Akses</label>
                <select 
                  name="role" 
                  className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {newRole === 'pengurus_asrama' && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-orange-800 uppercase mb-1">Pilih Asrama Binaan</label>
                  <select name="asrama_binaan" required className="w-full p-2.5 border rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="">-- Pilih Asrama --</option>
                    {ASRAMA_LIST.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-bold shadow-md flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                  {isCreating ? "Membuat Akun..." : "Buat Akun Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PILIH ASRAMA (POPUP TOMBOL) --- */}
      {isAsramaModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 transition-all">
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Home className="w-5 h-5 text-orange-600"/> Pilih Asrama Binaan</h3>
                <p className="text-xs text-gray-500 mt-1">Klik asrama yang akan dikelola user ini.</p>
              </div>
              <button 
                onClick={() => { setIsAsramaModalOpen(false); setPendingRoleUpdate(null); }}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {ASRAMA_LIST.map((asrama) => (
                <button
                  key={asrama}
                  onClick={() => handleSelectAsrama(asrama)}
                  className="p-4 rounded-xl border-2 border-gray-100 hover:border-orange-500 hover:bg-orange-50 text-gray-700 hover:text-orange-800 font-bold text-sm transition-all text-center flex flex-col items-center gap-2 group"
                >
                  <Home className="w-6 h-6 text-gray-300 group-hover:text-orange-500 transition-colors"/>
                  {asrama}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL RESET PASSWORD --- */}
      {isOpenReset && userToReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b bg-red-50">
              <h3 className="text-lg font-bold text-red-800 flex items-center gap-2"><Key className="w-5 h-5"/> Reset Password</h3>
              <p className="text-xs text-red-600 mt-1">Mengganti password untuk <b>{userToReset.name}</b></p>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password Baru</label>
                <input name="new_password" type="text" required minLength={6} placeholder="Min 6 karakter" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 outline-none text-center font-bold text-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setIsOpenReset(false)} className="py-2 rounded-lg border border-gray-300 text-gray-600 font-bold hover:bg-gray-50">Batal</button>
                <button type="submit" className="py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-md">Simpan Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT USER --- */}
      {isOpenEdit && userToEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-blue-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2"><Edit className="w-5 h-5"/> Edit User</h3>
              <button onClick={() => setIsOpenEdit(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                <input name="full_name" defaultValue={userToEdit.name} required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Login</label>
                <input name="email" type="email" defaultValue={userToEdit.email} required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpenEdit(false)} className="px-4 py-2 border rounded-lg text-gray-600 font-bold hover:bg-gray-50">Batal</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL IMPORT EXCEL --- */}
      {isOpenImport && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="p-4 border-b bg-gray-50 flex justify-between items-center sticky top-0 bg-gray-50 z-10">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600"/> Import User Massal</h3>
                <button onClick={() => { setIsOpenImport(false); setExcelData([]) }}><X className="w-6 h-6 text-gray-400 hover:text-gray-600"/></button>
             </div>

             <div className="p-6 space-y-6">
                
                {/* 1. DOWNLOAD */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                   <div>
                      <p className="font-bold text-blue-900 text-sm">Download Template Excel</p>
                      <p className="text-xs text-blue-600">Gunakan format ini untuk import.</p>
                   </div>
                   <button onClick={handleDownloadTemplate} className="bg-white text-blue-700 px-3 py-1.5 rounded border border-blue-200 text-xs font-bold hover:bg-blue-50 flex items-center gap-1">
                      <Download className="w-3 h-3"/> Template.xlsx
                   </button>
                </div>

                {/* 2. UPLOAD */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 relative hover:bg-gray-100 transition-colors">
                   <input type="file" accept=".xlsx" onChange={handleUploadExcel} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                   <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2"/>
                   <p className="text-sm font-bold text-gray-600">Klik untuk upload file Excel</p>
                </div>

                {/* 3. PREVIEW */}
                {excelData.length > 0 && (
                   <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b text-xs font-bold text-gray-600 flex justify-between">
                         <span>Preview Data ({excelData.length})</span>
                         <span className="text-green-600">Valid: {excelData.filter(d=>d.isValid).length}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                         <table className="w-full text-xs text-left">
                            <thead className="bg-white sticky top-0 shadow-sm">
                               <tr>
                                  <th className="p-2 border-b">Nama</th>
                                  <th className="p-2 border-b">Email</th>
                                  <th className="p-2 border-b">Role</th>
                                  <th className="p-2 border-b text-center">Status</th>
                               </tr>
                            </thead>
                            <tbody>
                               {excelData.map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                     <td className="p-2">{row.full_name}</td>
                                     <td className="p-2">{row.email}</td>
                                     <td className="p-2 uppercase">{row.role}</td>
                                     <td className="p-2 text-center">
                                        {row.isValid ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto"/> : <AlertCircle className="w-4 h-4 text-red-500 mx-auto"/>}
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                      <div className="p-4 bg-gray-50 border-t text-right">
                         <button 
                            onClick={handleSimpanBatch}
                            disabled={isImporting || excelData.filter(d=>d.isValid).length === 0}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 ml-auto"
                         >
                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Eksekusi Import
                         </button>
                      </div>
                   </div>
                )}
             </div>
           </div>
         </div>
      )}

      {/* --- MODAL KONFIRMASI DELETE --- */}
      {isOpenDelete && userToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Hapus Akun?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Apakah Anda yakin ingin menghapus akun <b>{userToDelete.name}</b>?
              <br/>Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setIsOpenDelete(false)} className="py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50">Batal</button>
               <button onClick={handleDeleteUser} className="py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Hapus</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}