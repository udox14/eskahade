'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { getUsersList, updateUserRoles, createUser, resetUserPassword, deleteUser, updateUserDetails, createUsersBatch, getUserOverrides, setUserFiturOverride, removeUserFiturOverride, getAllActiveFitur } from './actions'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { UserCog, Save, Loader2, Shield, Plus, X, Home, Mail, Key, Trash2, Edit, Filter, FileSpreadsheet, Upload, CheckCircle, AlertCircle, Download, AlertTriangle, Coins, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import Pagination, { usePagination } from '@/components/ui/pagination' 
import { useConfirm } from '@/components/ui/confirm-dialog'

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

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]

export default function ManajemenUserPage() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  // Filter State
  const [filterRole, setFilterRole] = useState('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modals
  const [isOpenAdd, setIsOpenAdd] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newRole, setNewRole] = useState('wali_kelas')

  const [isAsramaModalOpen, setIsAsramaModalOpen] = useState(false)
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{userId: string, roles: string[]} | null>(null)

  // Multi-role edit modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [roleEditUser, setRoleEditUser] = useState<any>(null)
  const [roleEditSelected, setRoleEditSelected] = useState<string[]>([])

  // Grant/Revoke modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
  const [overrideUser, setOverrideUser] = useState<any>(null)
  const [overrideList, setOverrideList] = useState<{fitur_id:number,action:string}[]>([])
  const [allFitur, setAllFitur] = useState<FiturAkses[]>([])
  const [overrideLoading, setOverrideLoading] = useState(false)

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
  // Parse user roles helper
  const parseRoles = (u: any): string[] => {
    try {
      if (u.roles) {
        const parsed = JSON.parse(u.roles)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [u.role]
  }

  const filteredUsers = users.filter(u => {
    let matchRole = true
    if (filterRole !== 'SEMUA') {
      matchRole = parseRoles(u).includes(filterRole)
    }

    let matchSearch = true
    if (searchQuery.trim() !== '') {
      const qs = searchQuery.toLowerCase()
      matchSearch = (u.full_name?.toLowerCase().includes(qs) || 
                     u.email?.toLowerCase().includes(qs) || 
                     u.nip?.toLowerCase().includes(qs))
    }

    return matchRole && matchSearch
  })

  // --- HANDLERS MULTI-ROLE ---
  const openRoleModal = (user: any) => {
    setRoleEditUser(user)
    setRoleEditSelected(parseRoles(user))
    setIsRoleModalOpen(true)
  }

  const handleSaveRoles = async () => {
    if (!roleEditUser || roleEditSelected.length === 0) {
      toast.error('Pilih minimal satu role')
      return
    }
    // Jika ada pengurus_asrama, tanya asrama
    if (roleEditSelected.includes('pengurus_asrama') && !roleEditUser.asrama_binaan) {
      setPendingRoleUpdate({ userId: roleEditUser.id, roles: roleEditSelected })
      setIsRoleModalOpen(false)
      setIsAsramaModalOpen(true)
      return
    }
    setProcessingId(roleEditUser.id)
    const toastId = toast.loading('Menyimpan role...')
    const res = await updateUserRoles(roleEditUser.id, roleEditSelected, roleEditUser.asrama_binaan)
    toast.dismiss(toastId)
    setProcessingId(null)
    if ('error' in res) {
      toast.error('Gagal update', { description: (res as any).error })
    } else {
      const rolesJson = JSON.stringify(roleEditSelected)
      setUsers(prev => prev.map(u => u.id === roleEditUser.id ? { ...u, role: roleEditSelected[0], roles: rolesJson } : u))
      toast.success('Role diperbarui', { description: roleEditSelected.map(r => ROLES.find(x=>x.value===r)?.label||r).join(', ') })
      setIsRoleModalOpen(false)
    }
  }

  const handleSelectAsrama = async (asrama: string) => {
    if (pendingRoleUpdate) {
      setIsAsramaModalOpen(false)
      setProcessingId(pendingRoleUpdate.userId)
      const toastId = toast.loading('Menyimpan role...')
      const res = await updateUserRoles(pendingRoleUpdate.userId, pendingRoleUpdate.roles, asrama)
      toast.dismiss(toastId)
      setProcessingId(null)
      if ('error' in res) {
        toast.error('Gagal update', { description: (res as any).error })
      } else {
        const rolesJson = JSON.stringify(pendingRoleUpdate.roles)
        setUsers(prev => prev.map(u => u.id === pendingRoleUpdate!.userId ? { ...u, role: pendingRoleUpdate!.roles[0], roles: rolesJson, asrama_binaan: asrama } : u))
        toast.success('Role & Asrama diperbarui')
      }
      setPendingRoleUpdate(null)
    }
  }

  // --- HANDLERS OVERRIDE (GRANT/REVOKE) ---
  const openOverrideModal = async (user: any) => {
    setOverrideUser(user)
    setOverrideLoading(true)
    setIsOverrideModalOpen(true)
    try {
      const [overrides, fitur] = await Promise.all([
        getUserOverrides(user.id),
        getAllActiveFitur(),
      ])
      setOverrideList(overrides.map(o => ({ fitur_id: o.fitur_id, action: o.action })))
      setAllFitur(fitur.filter(f => f.is_active))
    } catch {
      toast.error('Gagal memuat data fitur')
    } finally {
      setOverrideLoading(false)
    }
  }

  const handleOverrideToggle = async (fiturId: number, currentAction: string | null, userHasAccess: boolean) => {
    if (!overrideUser) return
    const toastId = toast.loading('Menyimpan...')
    try {
      if (currentAction === 'grant') {
        // Remove grant override
        await removeUserFiturOverride(overrideUser.id, fiturId)
        setOverrideList(prev => prev.filter(o => o.fitur_id !== fiturId))
      } else if (currentAction === 'revoke') {
        // Remove revoke override
        await removeUserFiturOverride(overrideUser.id, fiturId)
        setOverrideList(prev => prev.filter(o => o.fitur_id !== fiturId))
      } else if (userHasAccess) {
        // User has access via role → revoke it
        await setUserFiturOverride(overrideUser.id, fiturId, 'revoke')
        setOverrideList(prev => [...prev.filter(o => o.fitur_id !== fiturId), { fitur_id: fiturId, action: 'revoke' }])
      } else {
        // User doesn't have access → grant it
        await setUserFiturOverride(overrideUser.id, fiturId, 'grant')
        setOverrideList(prev => [...prev.filter(o => o.fitur_id !== fiturId), { fitur_id: fiturId, action: 'grant' }])
      }
      toast.success('Tersimpan')
    } catch {
      toast.error('Gagal menyimpan')
    } finally {
      toast.dismiss(toastId)
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

    if ('error' in res) {
      toast.error("Gagal membuat user", { description: (res as any).error })
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

    if ('error' in res) {
      toast.error("Gagal Edit", { description: (res as any).error })
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

    if ('error' in res) {
      toast.error("Gagal Reset", { description: (res as any).error })
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

    if ('error' in res) {
        toast.error("Gagal Hapus", { description: (res as any).error })
    } else {
        toast.success("User Dihapus")
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id))
        setIsOpenDelete(false)
        setUserToDelete(null)
    }
  }

  // --- HANDLER IMPORT EXCEL ---
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')

    const rows = [
      { "NAMA LENGKAP": "Budi Santoso", "EMAIL": "budi@pesantren.com", "PASSWORD": "password123", "ROLE": "wali_kelas", "ASRAMA": "" },
      { "NAMA LENGKAP": "Ahmad Keamanan", "EMAIL": "ahmad@pesantren.com", "PASSWORD": "password123", "ROLE": "keamanan", "ASRAMA": "" },
      { "NAMA LENGKAP": "Siti Bendahara", "EMAIL": "siti@pesantren.com", "PASSWORD": "password123", "ROLE": "bendahara", "ASRAMA": "" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:15}, {wch:15}]
    
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template User")
    XLSX.writeFile(workbook, "Template_Import_User.xlsx")

    toast.success("Template berhasil didownload")
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const toastId = toast.loading("Membaca file Excel...")

    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      
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

  const handleSimpanBatch = async () => {
    if (excelData.length === 0) return
    if (!await confirm(`Import ${excelData.filter(d=>d.isValid).length} user?`)) return

    setIsImporting(true)
    const toastId = toast.loading("Membuat akun batch...")
    
    const validData = excelData.filter(d => d.isValid)
    const res = await createUsersBatch(validData)
    
    setIsImporting(false)
    toast.dismiss(toastId)

    if (res?.success) {
        toast.success(`Berhasil membuat ${(res as any).count} user.`)
        if ((res as any).errors) {
            toast.warning("Beberapa user gagal", { description: (res as any).errors.join(", ") })
        }
        setIsOpenImport(false)
        setExcelData([])
        loadData()
    } else {
        toast.error("Gagal Import", { description: "Terjadi kesalahan sistem." })
    }
  }

  const handleExportSelected = async () => {
    if (selectedIds.length === 0) return
    const toastId = toast.loading("Menyiapkan data export...")
    
    try {
      const selectedUsers = users.filter(u => selectedIds.includes(u.id))
      const XLSX = await import('xlsx')
      
      const rows = selectedUsers.map(u => ({
        "NAMA LENGKAP": u.full_name || "-",
        "EMAIL": u.email,
        "ROLE": ROLES.find(r => r.value === u.role)?.label || u.role,
        "ASRAMA BINAAN": u.asrama_binaan || "-"
      }))
      
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{wch: 30}, {wch: 35}, {wch: 25}, {wch: 20}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data User Terpilih")
      XLSX.writeFile(wb, `Export_Akun_User_${new Date().getTime()}.xlsx`)
      
      toast.success("Berhasil export Excel!")
    } catch(e) {
      toast.error("Gagal export data")
    } finally {
      toast.dismiss(toastId)
    }
  }

  const { paged: pagedUsers, totalPages: totalPagesUsers, safePage: safePageUsers } = usePagination(filteredUsers, pageSize, page)

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-700">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h1>
            <p className="text-slate-500 text-sm">Kelola akun, reset password, dan hak akses.</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap md:flex-nowrap">
            {/* Search Bar */}
            <div className="relative flex-grow md:flex-grow-0">
                <input 
                    type="text"
                    placeholder="Cari nama, email, nip..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-700 py-2 pl-9 pr-3 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
                <select 
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                    <option value="SEMUA">Semua Role</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <Filter className="w-4 h-4 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"/>
            </div>

            <button 
                onClick={handleExportSelected}
                disabled={selectedIds.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors cursor-pointer"
            >
                <Download className="w-5 h-5" /> Export ({selectedIds.length})
            </button>

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
          <>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelection = Array.from(new Set([...selectedIds, ...pagedUsers.map(u => u.id)]));
                        setSelectedIds(newSelection);
                      } else {
                        const visibleIds = new Set(pagedUsers.map(u => u.id));
                        setSelectedIds(prev => prev.filter(id => !visibleIds.has(id)));
                      }
                    }}
                    checked={pagedUsers.length > 0 && pagedUsers.every(u => selectedIds.includes(u.id))}
                  />
                </th>
                <th className="px-6 py-4">Nama Lengkap & Email</th>
                <th className="px-6 py-4">Role / Hak Akses</th>
                <th className="px-6 py-4">Asrama Binaan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">Memuat data...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10">Data user tidak ditemukan.</td></tr>
              ) : (
                pagedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        checked={selectedIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(prev => [...prev, u.id])
                          else setSelectedIds(prev => prev.filter(id => id !== u.id))
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{u.full_name || "Tanpa Nama"}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Mail className="w-3 h-3"/> {u.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {parseRoles(u).map(r => {
                            const rl = ROLES.find(x => x.value === r)
                            return (
                              <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r === 'admin' ? 'bg-purple-100 text-purple-700' :
                                r === 'pengurus_asrama' ? 'bg-orange-100 text-orange-700' :
                                r === 'bendahara' ? 'bg-emerald-100 text-emerald-700' :
                                r === 'keamanan' ? 'bg-red-100 text-red-700' :
                                r === 'dewan_santri' ? 'bg-violet-100 text-violet-700' :
                                r === 'sekpen' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {rl?.label || r}
                              </span>
                            )
                          })}
                        </div>
                        <button
                          onClick={() => openRoleModal(u)}
                          className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit Role"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {processingId === u.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600"/>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {parseRoles(u).includes('pengurus_asrama') ? (
                        <button 
                          onClick={() => {
                            setPendingRoleUpdate({ userId: u.id, roles: parseRoles(u) })
                            setIsAsramaModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                        >
                          <Home className="w-3 h-3"/> {u.asrama_binaan || "Pilih Asrama"}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        
                        <button 
                          onClick={() => openOverrideModal(u)}
                          className="text-slate-500 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                          title="Grant / Revoke Fitur"
                        >
                          <ShieldCheck className="w-4 h-4"/>
                        </button>

                        <button 
                          onClick={() => {
                            setUserToEdit({ id: u.id, name: u.full_name, email: u.email })
                            setIsOpenEdit(true)
                          }}
                          className="text-slate-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Edit Detail"
                        >
                          <Edit className="w-4 h-4"/>
                        </button>

                        <button 
                          onClick={() => {
                            setUserToReset({ id: u.id, name: u.full_name })
                            setIsOpenReset(true)
                          }}
                          className="text-slate-500 hover:text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4"/>
                        </button>

                        <button 
                          onClick={() => {
                            setUserToDelete({ id: u.id, name: u.full_name })
                            setIsOpenDelete(true)
                          }}
                          className="text-slate-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
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
          <Pagination
            currentPage={safePageUsers}
            totalPages={totalPagesUsers}
            pageSize={pageSize}
            total={filteredUsers.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
          </>
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
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Tambah Pengguna Baru</h3>
              <button onClick={() => setIsOpenAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                <input name="full_name" required placeholder="Contoh: Ustadz Ahmad" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Login</label>
                <input name="email" type="email" required placeholder="email@pesantren.com" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                <input name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / Hak Akses</label>
                <select 
                  name="role" 
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-green-500 outline-none"
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
                  <select name="asrama_binaan" required className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 outline-none">
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
                  className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-bold shadow-sm flex justify-center items-center gap-2 disabled:opacity-70"
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
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Home className="w-5 h-5 text-orange-600"/> Pilih Asrama Binaan</h3>
                <p className="text-xs text-slate-500 mt-1">Klik asrama yang akan dikelola user ini.</p>
              </div>
              <button 
                onClick={() => { setIsAsramaModalOpen(false); setPendingRoleUpdate(null); }}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {ASRAMA_LIST.map((asrama) => (
                <button
                  key={asrama}
                  onClick={() => handleSelectAsrama(asrama)}
                  className="p-4 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 text-slate-700 hover:text-orange-800 font-bold text-sm transition-all text-center flex flex-col items-center gap-2 group"
                >
                  <Home className="w-6 h-6 text-slate-300 group-hover:text-orange-500 transition-colors"/>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password Baru</label>
                <input name="new_password" type="text" required minLength={6} placeholder="Min 6 karakter" className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-red-500 outline-none text-center font-bold text-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setIsOpenReset(false)} className="py-2 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50">Batal</button>
                <button type="submit" className="py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-sm">Simpan Password</button>
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
              <button onClick={() => setIsOpenEdit(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                <input name="full_name" defaultValue={userToEdit.name} required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Login</label>
                <input name="email" type="email" defaultValue={userToEdit.email} required className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsOpenEdit(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50">Batal</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL IMPORT EXCEL --- */}
      {isOpenImport && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="p-4 border-b bg-slate-50 flex justify-between items-center sticky top-0 bg-slate-50 z-10">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600"/> Import User Massal</h3>
                <button onClick={() => { setIsOpenImport(false); setExcelData([]) }}><X className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
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
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 relative hover:bg-slate-100 transition-colors">
                   <input type="file" accept=".xlsx" onChange={handleUploadExcel} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                   <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2"/>
                   <p className="text-sm font-bold text-slate-600">Klik untuk upload file Excel</p>
                </div>

                {/* 3. PREVIEW */}
                {excelData.length > 0 && (
                   <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b text-xs font-bold text-slate-600 flex justify-between">
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
                                  <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
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
                      <div className="p-4 bg-slate-50 border-t text-right">
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
            <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Akun?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Apakah Anda yakin ingin menghapus akun <b>{userToDelete.name}</b>?
              <br/>Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setIsOpenDelete(false)} className="py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50">Batal</button>
               <button onClick={handleDeleteUser} className="py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT MULTI-ROLE --- */}
      {isRoleModalOpen && roleEditUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Edit Role</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{roleEditUser.full_name}</p>
              </div>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-2">
              {ROLES.map(r => {
                const checked = roleEditSelected.includes(r.value)
                return (
                  <label key={r.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
                    checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-blue-600"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRoleEditSelected(prev => [...prev, r.value])
                        } else {
                          setRoleEditSelected(prev => prev.filter(x => x !== r.value))
                        }
                      }}
                    />
                    <span className={`text-sm font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}>{r.label}</span>
                  </label>
                )
              })}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 font-medium">Batal</button>
              <button onClick={handleSaveRoles} disabled={roleEditSelected.length === 0} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Simpan Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL GRANT / REVOKE FITUR --- */}
      {isOverrideModalOpen && overrideUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Grant / Revoke Fitur</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{overrideUser.full_name} — {parseRoles(overrideUser).map(r => ROLES.find(x=>x.value===r)?.label||r).join(', ')}</p>
              </div>
              <button onClick={() => setIsOverrideModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {overrideLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-1">
                  {allFitur.filter(f => f.href !== '/dashboard').map(f => {
                    const userRoles = parseRoles(overrideUser)
                    const hasViaRole = f.roles.some(r => userRoles.includes(r))
                    const override = overrideList.find(o => o.fitur_id === f.id)
                    const effectiveAccess = override ? override.action === 'grant' : hasViaRole

                    let statusLabel = ''
                    let statusColor = ''
                    let statusIcon: React.ReactNode = null
                    if (override?.action === 'grant') {
                      statusLabel = 'Granted'
                      statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      statusIcon = <ShieldCheck className="w-3 h-3" />
                    } else if (override?.action === 'revoke') {
                      statusLabel = 'Revoked'
                      statusColor = 'text-red-600 bg-red-50 border-red-200'
                      statusIcon = <ShieldOff className="w-3 h-3" />
                    } else if (hasViaRole) {
                      statusLabel = 'Dari Role'
                      statusColor = 'text-blue-600 bg-blue-50 border-blue-200'
                      statusIcon = <Shield className="w-3 h-3" />
                    }

                    return (
                      <div key={f.id} className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
                        effectiveAccess ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50/50'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold truncate ${effectiveAccess ? 'text-slate-800' : 'text-slate-400'}`}>{f.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{f.group_name === '_standalone' ? '' : f.group_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusLabel && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusColor}`}>
                              {statusIcon}{statusLabel}
                            </span>
                          )}
                          <button
                            onClick={() => handleOverrideToggle(f.id, override?.action || null, hasViaRole)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              override?.action === 'grant' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                              override?.action === 'revoke' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                              effectiveAccess ? 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600' :
                              'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                            }`}
                            title={override ? 'Reset Override' : effectiveAccess ? 'Revoke' : 'Grant'}
                          >
                            {override ? <X className="w-3.5 h-3.5" /> : effectiveAccess ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-slate-50 flex justify-between items-center text-[10px] text-slate-400 shrink-0">
              <span>✅ = Dari Role · 🟢 Granted · 🔴 Revoked</span>
              <button onClick={() => setIsOverrideModalOpen(false)} className="px-3 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium">Tutup</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}