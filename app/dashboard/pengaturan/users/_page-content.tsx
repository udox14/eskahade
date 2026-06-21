'use client'

import React from 'react'

import { useState, useEffect } from 'react'
import { getUsersList, updateUserRoles, resetUserPassword, deleteUser, updateUserDetails, createUsersBatch, getUserOverrides, setUserFiturOverride, removeUserFiturOverride, getAllActiveFitur, getUserCreationCandidates, createUsersFromSourcesBatch, createAllGuruAccounts } from './actions'
import type { UserCreationCandidate } from './actions'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { UserCog, Save, Loader2, Shield, Plus, Home, Mail, Key, Trash2, Edit, FileSpreadsheet, Upload, CheckCircle, AlertCircle, Download, AlertTriangle, ShieldCheck, ShieldOff, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button, TextInput, NativeSelect, ActionIcon, Modal } from '@mantine/core'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { rolesCanAccessFeature } from '@/lib/auth/role-access'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'bendahara', label: 'Bendahara Umum' },
  { value: 'sekpen', label: 'Sekpen' },
  { value: 'keamanan', label: 'Keamanan' },
  { value: 'dewan_santri', label: 'Dewan Santri' },
  { value: 'pengurus_asrama', label: 'Pengurus Asrama' },
  { value: 'wali_kelas', label: 'Wali Kelas' },
  { value: 'guru', label: 'Guru' },
]

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4", "AL-BAGHORY"]
const DEFAULT_USER_PASSWORD = 'eskahade2026'
const STRUCTURAL_ROLE_VALUES = ['pengurus_asrama', 'sekpen', 'dewan_santri', 'keamanan']
const STRUCTURAL_JABATAN = [
  { value: 'anggota', label: 'Anggota' },
  { value: 'ketua', label: 'Ketua' },
  { value: 'sekretaris', label: 'Sekretaris' },
  { value: 'bendahara', label: 'Bendahara' },
]
const DEFAULT_STRUCTURAL_JABATAN = 'anggota'

type SelectedBatchConfig = {
  source_type: 'guru' | 'sadesa'
  source_ref_id: string
  role: string
  asrama_binaan: string
  structural_jabatan: string
}

export default function ManajemenUserPage() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Filter State
  const [filterRole, setFilterRole] = useState('SEMUA')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')
  const [filterJabatan, setFilterJabatan] = useState('SEMUA')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modals
  const [isOpenAdd, setIsOpenAdd] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newRole, setNewRole] = useState('guru')
  const [candidateSource, setCandidateSource] = useState<'guru' | 'sadesa'>('guru')
  const [userCandidates, setUserCandidates] = useState<UserCreationCandidate[]>([])
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedBatchConfigs, setSelectedBatchConfigs] = useState<Record<string, SelectedBatchConfig>>({})
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  const [isAsramaModalOpen, setIsAsramaModalOpen] = useState(false)
  const [pendingRoleUpdate, setPendingRoleUpdate] = useState<{userId: string, roles: string[]} | null>(null)

  // Multi-role edit modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [roleEditUser, setRoleEditUser] = useState<any>(null)
  const [roleEditSelected, setRoleEditSelected] = useState<string[]>([])
  const [roleEditJabatan, setRoleEditJabatan] = useState('')

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

  useEffect(() => {
    loadCandidates()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const data = await getUsersList()
    setUsers(data)
    setLoading(false)
  }

  const loadCandidates = async () => {
    setLoadingCandidates(true)
    try {
      const data = await getUserCreationCandidates()
      setUserCandidates(data)
    } catch {
      toast.error('Gagal memuat data kandidat akun')
    } finally {
      setLoadingCandidates(false)
    }
  }

  const parseRoles = (u: any): string[] => {
    try {
      if (u.roles) {
        const parsed = JSON.parse(u.roles)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [u.role]
  }

  const needsStructuralJabatan = (roles: string[]) => roles.some(role => STRUCTURAL_ROLE_VALUES.includes(role))
  const getJabatanLabel = (value: string | null | undefined) => STRUCTURAL_JABATAN.find(j => j.value === value)?.label || ''
  const getStructuralJabatan = (u: any) => needsStructuralJabatan(parseRoles(u)) ? (u.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : ''
  const getEffectiveUserRoles = (u: any) => {
    const roles = parseRoles(u)
    const structuralJabatan = needsStructuralJabatan(roles) ? (u.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : ''
    if (!structuralJabatan) return roles
    return Array.from(new Set([
      ...roles,
      `jabatan:${structuralJabatan}`,
      ...roles.map(role => `${role}:${structuralJabatan}`),
    ]))
  }

  const filteredUsers = users.filter(u => {
    let matchRole = true
    if (filterRole !== 'SEMUA') {
      matchRole = parseRoles(u).includes(filterRole)
    }
    const matchAsrama = filterAsrama === 'SEMUA' || u.asrama_binaan === filterAsrama
    const matchJabatan = filterJabatan === 'SEMUA' || getStructuralJabatan(u) === filterJabatan
    let matchSearch = true
    if (searchQuery.trim() !== '') {
      const qs = searchQuery.toLowerCase()
      matchSearch = (u.full_name?.toLowerCase().includes(qs) ||
                     u.email?.toLowerCase().includes(qs) ||
                     u.nip?.toLowerCase().includes(qs))
    }
    return matchRole && matchAsrama && matchJabatan && matchSearch
  })

  const filteredCandidates = userCandidates.filter(candidate => {
    if (candidate.source_type !== candidateSource) return false
    if (!candidateSearch.trim()) return true
    const q = candidateSearch.toLowerCase()
    return [
      candidate.label,
      candidate.full_name,
      candidate.email,
      candidate.meta || '',
    ].some(value => value.toLowerCase().includes(q))
  })

  const selectedBatchCandidates = userCandidates
    .filter(candidate => Boolean(selectedBatchConfigs[`${candidate.source_type}:${candidate.source_ref_id}`]))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const closeAddModal = () => {
    setIsOpenAdd(false)
    setCandidateSource('guru')
    setCandidateSearch('')
    setSelectedBatchConfigs({})
    setNewRole('guru')
  }

  const toggleCandidateSelection = (candidate: UserCreationCandidate) => {
    const key = `${candidate.source_type}:${candidate.source_ref_id}`
    setSelectedBatchConfigs(prev => {
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return {
        ...prev,
        [key]: {
          source_type: candidate.source_type,
          source_ref_id: candidate.source_ref_id,
          role: candidate.source_type === 'guru' ? 'guru' : newRole,
          asrama_binaan: '',
          structural_jabatan: needsStructuralJabatan([candidate.source_type === 'guru' ? 'guru' : newRole]) ? DEFAULT_STRUCTURAL_JABATAN : '',
        },
      }
    })
  }

  const updateSelectedBatchConfig = (key: string, patch: Partial<SelectedBatchConfig>) => {
    setSelectedBatchConfigs(prev => {
      const current = prev[key]
      if (!current) return prev
      return { ...prev, [key]: { ...current, ...patch } }
    })
  }

  const handleSelectAllVisibleCandidates = () => {
    setSelectedBatchConfigs(prev => {
      const next = { ...prev }
      filteredCandidates.forEach(candidate => {
        if (candidate.has_account) return
        const key = `${candidate.source_type}:${candidate.source_ref_id}`
        if (!next[key]) {
          next[key] = {
            source_type: candidate.source_type,
            source_ref_id: candidate.source_ref_id,
            role: candidate.source_type === 'guru' ? 'guru' : newRole,
            asrama_binaan: '',
            structural_jabatan: needsStructuralJabatan([candidate.source_type === 'guru' ? 'guru' : newRole]) ? DEFAULT_STRUCTURAL_JABATAN : '',
          }
        }
      })
      return next
    })
  }

  const openRoleModal = (user: any) => {
    setRoleEditUser(user)
    const roles = parseRoles(user)
    setRoleEditSelected(roles)
    setRoleEditJabatan(needsStructuralJabatan(roles) ? (user.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : '')
    setIsRoleModalOpen(true)
  }

  const handleSaveRoles = async () => {
    if (!roleEditUser || roleEditSelected.length === 0) {
      toast.error('Pilih minimal satu role')
      return
    }
    if (needsStructuralJabatan(roleEditSelected) && !roleEditJabatan) {
      toast.error('Pilih jabatan struktural')
      return
    }
    if (roleEditSelected.includes('pengurus_asrama') && !roleEditUser.asrama_binaan) {
      setPendingRoleUpdate({ userId: roleEditUser.id, roles: roleEditSelected })
      setIsRoleModalOpen(false)
      setIsAsramaModalOpen(true)
      return
    }
    setProcessingId(roleEditUser.id)
    const toastId = toast.loading('Menyimpan role...')
    const res = await updateUserRoles(roleEditUser.id, roleEditSelected, roleEditUser.asrama_binaan, roleEditJabatan)
    toast.dismiss(toastId)
    setProcessingId(null)
    if ('error' in res) {
      toast.error('Gagal update', { description: (res as any).error })
    } else {
      const rolesJson = JSON.stringify(roleEditSelected)
      setUsers(prev => prev.map(u => u.id === roleEditUser.id ? { ...u, role: roleEditSelected[0], roles: rolesJson, structural_jabatan: needsStructuralJabatan(roleEditSelected) ? roleEditJabatan : null } : u))
      toast.success('Role diperbarui', { description: roleEditSelected.map(r => ROLES.find(x=>x.value===r)?.label||r).join(', ') })
      setIsRoleModalOpen(false)
    }
  }

  const handleSelectAsrama = async (asrama: string) => {
    if (pendingRoleUpdate) {
      setIsAsramaModalOpen(false)
      setProcessingId(pendingRoleUpdate.userId)
      const toastId = toast.loading('Menyimpan role...')
      const currentUser = users.find(u => u.id === pendingRoleUpdate.userId)
      const structuralJabatan = needsStructuralJabatan(pendingRoleUpdate.roles) ? (currentUser?.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : ''
      const res = await updateUserRoles(pendingRoleUpdate.userId, pendingRoleUpdate.roles, asrama, structuralJabatan)
      toast.dismiss(toastId)
      setProcessingId(null)
      if ('error' in res) {
        toast.error('Gagal update', { description: (res as any).error })
      } else {
        const rolesJson = JSON.stringify(pendingRoleUpdate.roles)
        setUsers(prev => prev.map(u => u.id === pendingRoleUpdate!.userId ? { ...u, role: pendingRoleUpdate!.roles[0], roles: rolesJson, asrama_binaan: asrama, structural_jabatan: structuralJabatan || null } : u))
        toast.success('Role & Asrama diperbarui')
      }
      setPendingRoleUpdate(null)
    }
  }

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
        await removeUserFiturOverride(overrideUser.id, fiturId)
        setOverrideList(prev => prev.filter(o => o.fitur_id !== fiturId))
      } else if (currentAction === 'revoke') {
        await removeUserFiturOverride(overrideUser.id, fiturId)
        setOverrideList(prev => prev.filter(o => o.fitur_id !== fiturId))
      } else if (userHasAccess) {
        await setUserFiturOverride(overrideUser.id, fiturId, 'revoke')
        setOverrideList(prev => [...prev.filter(o => o.fitur_id !== fiturId), { fitur_id: fiturId, action: 'revoke' }])
      } else {
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

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const items = Object.values(selectedBatchConfigs)
    if (items.length === 0) {
      toast.error('Pilih dulu orang yang akan dibuatkan akun')
      return
    }
    setIsCreating(true)
    const toastId = toast.loading("Membuat akun batch...")
    const res = await createUsersFromSourcesBatch(items)
    setIsCreating(false)
    toast.dismiss(toastId)
    if (!res?.success && (!res?.count || res.count === 0)) {
      toast.error("Gagal membuat user", { description: res?.errors?.join(', ') || 'Terjadi kesalahan sistem.' })
    } else {
      toast.success("Akun Berhasil Dibuat!", { description: `${res.count} akun berhasil dibuat.` })
      if (res.errors?.length) {
        toast.warning("Sebagian akun gagal dibuat", { description: res.errors.join(', ') })
      }
      closeAddModal()
      await loadCandidates()
      loadData()
    }
  }

  const handleCreateAllGuruAccounts = async () => {
    if (!await confirm('Buat atau sinkronkan akun untuk semua data guru? Akun yang sudah ada akan ditambahkan role Guru tanpa menghapus role lain.')) return
    setIsCreating(true)
    const toastId = toast.loading('Menyinkronkan akun guru...')
    try {
      const res = await createAllGuruAccounts()
      toast.dismiss(toastId)
      if (!res.success && res.failed > 0) {
        toast.error('Gagal menyinkronkan akun guru', { description: res.errors?.slice(0, 3).join(', ') || 'Terjadi kesalahan sistem.' })
        return
      }
      toast.success('Sinkron akun guru selesai', {
        description: `Dibuat ${res.created}, ditautkan ${res.linked}, diperbarui ${res.updated}, sudah ada ${res.existing}, gagal ${res.failed}.`,
      })
      if (res.errors?.length) {
        toast.warning('Sebagian guru gagal diproses', { description: res.errors.slice(0, 3).join(', ') })
      }
      await loadCandidates()
      loadData()
    } catch (error: any) {
      toast.dismiss(toastId)
      toast.error('Gagal menyinkronkan akun guru', { description: String(error?.message || 'Terjadi kesalahan sistem.') })
    } finally {
      setIsCreating(false)
    }
  }

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
      toast.success("Password Berhasil Direset", { description: `Password baru: ${newPass}` })
      setIsOpenReset(false)
      setUserToReset(null)
    }
  }

  const handleResetToDefaultPassword = async () => {
    if (!userToReset) return
    const toastId = toast.loading("Mereset ke password default...")
    const res = await resetUserPassword(userToReset.id, DEFAULT_USER_PASSWORD)
    toast.dismiss(toastId)
    if ('error' in res) {
      toast.error("Gagal Reset", { description: (res as any).error })
    } else {
      toast.success("Password Default Diterapkan", { description: `Password baru: ${DEFAULT_USER_PASSWORD}` })
      setIsOpenReset(false)
      setUserToReset(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    const toastId = toast.loading("Menghapus user...")
    try {
      const res = await deleteUser(userToDelete.id)
      if ('error' in res) {
        toast.error("Gagal Hapus", { description: (res as any).error })
      } else {
        toast.success("User Dihapus")
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id))
        setIsOpenDelete(false)
        setUserToDelete(null)
      }
    } catch (error: any) {
      toast.error("Gagal Hapus", { description: String(error?.message || 'Terjadi kesalahan saat menghapus user.') })
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA LENGKAP": "Budi Santoso", "EMAIL": "budi@sukahideng.or.id", "PASSWORD": "password123", "ROLE": "wali_kelas", "JABATAN": "", "ASRAMA": "" },
      { "NAMA LENGKAP": "Ahmad Keamanan", "EMAIL": "ahmad@sukahideng.or.id", "PASSWORD": "password123", "ROLE": "keamanan", "JABATAN": "anggota", "ASRAMA": "" },
      { "NAMA LENGKAP": "Siti Pengurus", "EMAIL": "siti@sukahideng.or.id", "PASSWORD": "password123", "ROLE": "pengurus_asrama", "JABATAN": "bendahara", "ASRAMA": "BAHAGIA" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:15}, {wch:15}, {wch:15}]
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
      const mappedData = data.map((row: any) => ({
        full_name: row['NAMA LENGKAP'],
        email: row['EMAIL'],
        password: row['PASSWORD'],
        role: row['ROLE']?.toLowerCase(),
        structural_jabatan: row['JABATAN']?.toLowerCase(),
        asrama_binaan: row['ASRAMA']?.toUpperCase(),
        isValid: row['NAMA LENGKAP'] && row['EMAIL'] && row['PASSWORD'] && row['ROLE']
      }))
      setExcelData(mappedData)
      toast.dismiss(toastId)
      toast.success(`Berhasil membaca ${mappedData.length} baris data`)
    } catch {
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
        "JABATAN": getJabatanLabel(getStructuralJabatan(u)) || "-",
        "ASRAMA BINAAN": u.asrama_binaan || "-",
        "KELAS BINAAN": u.kelas_binaan || "-"
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{wch: 30}, {wch: 35}, {wch: 25}, {wch: 16}, {wch: 20}, {wch: 24}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data User Terpilih")
      XLSX.writeFile(wb, `Export_Akun_User_${new Date().getTime()}.xlsx`)
      toast.success("Berhasil export Excel!")
    } catch {
      toast.error("Gagal export data")
    } finally {
      toast.dismiss(toastId)
    }
  }

  const { paged: pagedUsers, totalPages: totalPagesUsers, safePage: safePageUsers } = usePagination(filteredUsers, pageSize, page)

  return (
    <div className="space-y-6 pb-20">

      {/* HEADER */}
      <div className="border-b pb-4 space-y-4">
        <DashboardPageHeader
          title="Manajemen Pengguna"
          description="Kelola akun, reset password, dan hak akses."
        />

        <div className="flex flex-col xl:flex-row gap-3 xl:items-end">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <TextInput
              placeholder="Cari nama, email, nip..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<Search className="w-4 h-4" />}
              className="flex-1 min-w-0"
            />
            <NativeSelect
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              data={[
                { label: 'Semua Role', value: 'SEMUA' },
                ...ROLES.map(r => ({ label: r.label, value: r.value })),
              ]}
              className="sm:w-[210px] xl:w-[220px]"
            />
            <NativeSelect
              value={filterAsrama}
              onChange={(e) => setFilterAsrama(e.target.value)}
              data={[
                { label: 'Semua Asrama', value: 'SEMUA' },
                ...ASRAMA_LIST.map(a => ({ label: a, value: a })),
              ]}
              className="sm:w-[190px] xl:w-[200px]"
            />
            <NativeSelect
              value={filterJabatan}
              onChange={(e) => setFilterJabatan(e.target.value)}
              data={[
                { label: 'Semua Jabatan', value: 'SEMUA' },
                ...STRUCTURAL_JABATAN.map(j => ({ label: j.label, value: j.value })),
              ]}
              className="sm:w-[190px] xl:w-[200px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:min-w-[420px]">
            <Button
              onClick={handleExportSelected}
              disabled={selectedIds.length === 0}
              color="teal"
              leftSection={<Download className="w-4 h-4" />}
            >
              Export ({selectedIds.length})
            </Button>
            <Button
              onClick={() => setIsOpenImport(true)}
              color="blue"
              leftSection={<FileSpreadsheet className="w-4 h-4" />}
            >
              Import Excel
            </Button>
            <Button
              onClick={() => setIsOpenAdd(true)}
              color="green"
              leftSection={<Plus className="w-4 h-4" />}
            >
              Tambah User
            </Button>
          </div>
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
                <th className="px-6 py-4">Kelas Binaan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">Memuat data...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10">Data user tidak ditemukan.</td></tr>
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
                                r === 'guru' ? 'bg-indigo-100 text-indigo-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {rl?.label || r}
                              </span>
                            )
                          })}
                        </div>
                        <ActionIcon
                          onClick={() => openRoleModal(u)}
                          variant="subtle"
                          color="blue"
                          size="sm"
                          title="Edit Role"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </ActionIcon>
                        {processingId === u.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600"/>}
                      </div>
                      {needsStructuralJabatan(parseRoles(u)) && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                            {getJabatanLabel(getStructuralJabatan(u)) || 'Anggota'}
                          </span>
                        </div>
                      )}
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
                    <td className="px-6 py-4">
                      {parseRoles(u).includes('wali_kelas') ? (
                        <span className="inline-flex items-center bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-bold">
                          {u.kelas_binaan || "Belum ditugaskan"}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ActionIcon
                          onClick={() => openOverrideModal(u)}
                          variant="subtle"
                          color="teal"
                          size="sm"
                          title="Grant / Revoke Fitur"
                        >
                          <ShieldCheck className="w-4 h-4"/>
                        </ActionIcon>
                        <ActionIcon
                          onClick={() => {
                            setUserToEdit({ id: u.id, name: u.full_name, email: u.email })
                            setIsOpenEdit(true)
                          }}
                          variant="subtle"
                          color="blue"
                          size="sm"
                          title="Edit Detail"
                        >
                          <Edit className="w-4 h-4"/>
                        </ActionIcon>
                        <ActionIcon
                          onClick={() => {
                            setUserToReset({ id: u.id, name: u.full_name })
                            setIsOpenReset(true)
                          }}
                          variant="subtle"
                          color="orange"
                          size="sm"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4"/>
                        </ActionIcon>
                        <ActionIcon
                          onClick={() => {
                            setUserToDelete({ id: u.id, name: u.full_name })
                            setIsOpenDelete(true)
                          }}
                          variant="subtle"
                          color="red"
                          size="sm"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </ActionIcon>
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

      {/* --- MODAL TAMBAH USER --- */}
      <Modal
        opened={isOpenAdd}
        onClose={closeAddModal}
        title="Tambah Pengguna Baru"
        size="calc(min(1200px, 96vw))"
        centered
        styles={{
          body: {
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: 'min(720px, calc(92vh - 60px))',
          }
        }}
      >
        <form onSubmit={handleCreateUser} className="p-4 md:p-5 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6 xl:items-stretch flex-1 min-h-0 overflow-hidden">
            <div className="xl:order-1 min-h-0 h-full flex flex-col gap-4 overflow-hidden">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-emerald-800">Password Default</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">eskahade2026</p>
                <p className="mt-1 text-[11px] text-emerald-700">Akun baru akan dibuat otomatis dengan password ini.</p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-indigo-800">Akun Guru Massal</p>
                    <p className="mt-1 text-[11px] text-indigo-700">Buat atau tautkan akun untuk semua data guru tanpa menghapus role lain.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreateAllGuruAccounts}
                    loading={isCreating}
                    color="indigo"
                    size="xs"
                    leftSection={!isCreating ? <UserCog className="w-3.5 h-3.5" /> : undefined}
                    className="shrink-0"
                  >
                    Buat Semua Guru
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role Default Saat Memilih</label>
                <NativeSelect
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  data={ROLES.map(r => ({ label: r.label, value: r.value }))}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex-1 min-h-0 h-0 flex flex-col">
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Akun Yang Akan Dibuat</p>
                    <p className="text-[11px] text-slate-500">Atur role dan asrama binaan masing-masing di sini.</p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                    {selectedBatchCandidates.length} orang
                  </span>
                </div>

                {selectedBatchCandidates.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500 flex-1">
                    Pilih orang dari kolom kanan dulu.
                  </div>
                ) : (
                  <div className="overflow-y-auto overscroll-contain divide-y min-h-0 flex-1">
                    {selectedBatchCandidates.map(candidate => {
                      const key = `${candidate.source_type}:${candidate.source_ref_id}`
                      const config = selectedBatchConfigs[key]
                      return (
                        <div key={key} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">{candidate.full_name}</p>
                              <p className="text-xs text-slate-500">{candidate.email}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{candidate.meta || (candidate.source_type === 'guru' ? 'Data Guru' : 'Santri SADESA')}</p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => toggleCandidateSelection(candidate)}
                              variant="default"
                              size="compact-xs"
                            >
                              Hapus
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Role</label>
                              <NativeSelect
                                value={config?.role || (candidate.source_type === 'guru' ? 'guru' : 'wali_kelas')}
                                onChange={(e) => updateSelectedBatchConfig(key, {
                                  role: e.target.value,
                                  asrama_binaan: e.target.value === 'pengurus_asrama' ? config?.asrama_binaan || '' : '',
                                  structural_jabatan: needsStructuralJabatan([e.target.value]) ? (config?.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : '',
                                })}
                                data={ROLES.map(r => ({ label: r.label, value: r.value }))}
                                size="sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Jabatan</label>
                              <NativeSelect
                                value={config?.structural_jabatan || ''}
                                disabled={!needsStructuralJabatan([config?.role || ''])}
                                onChange={(e) => updateSelectedBatchConfig(key, { structural_jabatan: e.target.value })}
                                data={[
                                  { label: '-- Pilih Jabatan --', value: '' },
                                  ...STRUCTURAL_JABATAN.map(j => ({ label: j.label, value: j.value })),
                                ]}
                                size="sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Asrama Binaan</label>
                              <NativeSelect
                                value={config?.asrama_binaan || ''}
                                disabled={config?.role !== 'pengurus_asrama'}
                                onChange={(e) => updateSelectedBatchConfig(key, { asrama_binaan: e.target.value })}
                                data={[
                                  { label: '-- Pilih Asrama --', value: '' },
                                  ...ASRAMA_LIST.map(a => ({ label: a, value: a })),
                                ]}
                                size="sm"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="xl:order-2 min-h-0 h-full flex flex-col gap-4 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sumber Data</label>
                  <NativeSelect
                    value={candidateSource}
                    onChange={(e) => {
                      setCandidateSource(e.target.value as 'guru' | 'sadesa')
                      setCandidateSearch('')
                    }}
                    data={[
                      { label: 'Guru', value: 'guru' },
                      { label: 'SADESA', value: 'sadesa' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cari Orang</label>
                  <TextInput
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder={candidateSource === 'guru' ? 'Cari nama guru...' : 'Cari santri SADESA...'}
                  />
                </div>
              </div>

              <div className="min-h-0 h-0 flex-1 flex flex-col">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Kandidat Akun</label>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">{filteredCandidates.filter(c => !c.has_account).length} kandidat tersedia</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllVisibleCandidates}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      Pilih semua hasil
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBatchConfigs({})}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto overscroll-contain border border-slate-200 rounded-xl divide-y bg-slate-50 min-h-0 flex-1">
                  {loadingCandidates ? (
                    <div className="px-4 py-8 text-sm text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat kandidat akun...
                    </div>
                  ) : filteredCandidates.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-500 text-center">
                      Tidak ada data yang cocok.
                    </div>
                  ) : (
                    filteredCandidates.map(candidate => {
                      const candidateKey = `${candidate.source_type}:${candidate.source_ref_id}`
                      const selected = Boolean(selectedBatchConfigs[candidateKey])
                      return (
                        <button
                          key={candidateKey}
                          type="button"
                          disabled={candidate.has_account}
                          onClick={() => toggleCandidateSelection(candidate)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            candidate.has_account
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : selected
                                ? 'bg-emerald-50 border-l-4 border-emerald-500'
                                : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${selected ? 'text-emerald-800' : ''}`}>{candidate.label}</p>
                              <p className="text-xs text-slate-500 truncate">{candidate.email}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{candidate.meta || (candidate.source_type === 'guru' ? 'Data Guru' : 'Santri SADESA')}</p>
                            </div>
                            {candidate.has_account ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Sudah ada akun</span>
                            ) : selected ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">Terpilih</span>
                            ) : null}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 md:pt-4 border-t bg-white">
            <Button
              type="submit"
              loading={isCreating}
              disabled={isCreating || selectedBatchCandidates.length === 0}
              color="green"
              size="lg"
              fullWidth
              leftSection={!isCreating ? <Save className="w-5 h-5" /> : undefined}
            >
              {isCreating ? "Membuat Akun..." : `Buat ${selectedBatchCandidates.length || ''} Akun Sekarang`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL PILIH ASRAMA --- */}
      <Modal
        opened={isAsramaModalOpen}
        onClose={() => { setIsAsramaModalOpen(false); setPendingRoleUpdate(null) }}
        title={<div className="flex items-center gap-2"><Home className="w-5 h-5 text-orange-600" /> Pilih Asrama Binaan</div>}
        size="md"
        centered
      >
        <p className="text-xs text-slate-500 mb-4">Klik asrama yang akan dikelola user ini.</p>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
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
      </Modal>

      {/* --- MODAL RESET PASSWORD --- */}
      <Modal
        opened={isOpenReset && !!userToReset}
        onClose={() => setIsOpenReset(false)}
        title={<div className="flex items-center gap-2 text-red-800"><Key className="w-5 h-5" /> Reset Password</div>}
        size="sm"
        centered
      >
        {userToReset && (
          <>
            <p className="text-xs text-red-600 mb-4">Mengganti password untuk <b>{userToReset.name}</b></p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-amber-800">Reset Cepat</p>
                <p className="mt-1 text-sm text-amber-900">Klik tombol di bawah untuk langsung set password default.</p>
                <Button
                  type="button"
                  onClick={handleResetToDefaultPassword}
                  color="yellow"
                  fullWidth
                  className="mt-3"
                >
                  Set Password Default: {DEFAULT_USER_PASSWORD}
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Atau isi manual</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <TextInput
                name="new_password"
                label="Password Baru"
                type="text"
                required
                minLength={6}
                placeholder="Min 6 karakter"
                styles={{ input: { textAlign: 'center', fontWeight: 700, fontSize: '1.125rem' } }}
              />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button type="button" variant="default" onClick={() => setIsOpenReset(false)}>Batal</Button>
                <Button type="submit" color="red">Simpan Password</Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* --- MODAL EDIT USER --- */}
      <Modal
        opened={isOpenEdit && !!userToEdit}
        onClose={() => setIsOpenEdit(false)}
        title={<div className="flex items-center gap-2 text-blue-800"><Edit className="w-5 h-5" /> Edit User</div>}
        size="sm"
        centered
      >
        {userToEdit && (
          <form onSubmit={handleEditUser} className="space-y-4">
            <TextInput
              name="full_name"
              label="Nama Lengkap"
              defaultValue={userToEdit.name}
              required
            />
            <TextInput
              name="email"
              label="Email Login"
              type="email"
              defaultValue={userToEdit.email}
              required
            />
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="default" onClick={() => setIsOpenEdit(false)}>Batal</Button>
              <Button type="submit" color="blue">Simpan Perubahan</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- MODAL IMPORT EXCEL --- */}
      <Modal
        opened={isOpenImport}
        onClose={() => { setIsOpenImport(false); setExcelData([]) }}
        title={<div className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600" /> Import User Massal</div>}
        size="xl"
        centered
      >
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
            <div>
              <p className="font-bold text-blue-900 text-sm">Download Template Excel</p>
              <p className="text-xs text-blue-600">Gunakan format ini untuk import.</p>
            </div>
            <Button
              onClick={handleDownloadTemplate}
              variant="default"
              size="xs"
              leftSection={<Download className="w-3 h-3" />}
            >
              Template.xlsx
            </Button>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 relative hover:bg-slate-100 transition-colors">
            <input type="file" accept=".xlsx" onChange={handleUploadExcel} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2"/>
            <p className="text-sm font-bold text-slate-600">Klik untuk upload file Excel</p>
          </div>

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
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <Button
                  onClick={handleSimpanBatch}
                  loading={isImporting}
                  disabled={isImporting || excelData.filter(d=>d.isValid).length === 0}
                  color="green"
                  leftSection={!isImporting ? <Save className="w-4 h-4" /> : undefined}
                >
                  Eksekusi Import
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* --- MODAL KONFIRMASI DELETE --- */}
      <Modal
        opened={isOpenDelete && !!userToDelete}
        onClose={() => setIsOpenDelete(false)}
        size="sm"
        centered
        withCloseButton={false}
      >
        {userToDelete && (
          <div className="text-center p-2">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Akun?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Apakah Anda yakin ingin menghapus akun <b>{userToDelete.name}</b>?
              <br/>Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="default" onClick={() => setIsOpenDelete(false)}>Batal</Button>
              <Button
                color="red"
                onClick={handleDeleteUser}
                leftSection={<Trash2 className="w-4 h-4" />}
              >
                Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- MODAL EDIT MULTI-ROLE --- */}
      <Modal
        opened={isRoleModalOpen && !!roleEditUser}
        onClose={() => setIsRoleModalOpen(false)}
        title={roleEditUser ? <div><p className="font-bold text-sm">Edit Role</p><p className="text-[11px] text-slate-500">{roleEditUser.full_name}</p></div> : 'Edit Role'}
        size="sm"
        centered
      >
        <div className="space-y-2">
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
                      setRoleEditSelected(prev => {
                        const next = [...prev, r.value]
                        if (needsStructuralJabatan(next) && !roleEditJabatan) setRoleEditJabatan(roleEditUser.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN)
                        return next
                      })
                    } else {
                      setRoleEditSelected(prev => {
                        const next = prev.filter(x => x !== r.value)
                        if (!needsStructuralJabatan(next)) setRoleEditJabatan('')
                        return next
                      })
                    }
                  }}
                />
                <span className={`text-sm font-semibold ${checked ? 'text-blue-800' : 'text-slate-700'}`}>{r.label}</span>
              </label>
            )
          })}
          {needsStructuralJabatan(roleEditSelected) && (
            <div className="pt-3">
              <NativeSelect
                label="Jabatan Struktural"
                value={roleEditJabatan}
                onChange={(e) => setRoleEditJabatan(e.target.value)}
                data={STRUCTURAL_JABATAN.map(j => ({ label: j.label, value: j.value }))}
              />
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-end gap-2">
          <Button variant="default" onClick={() => setIsRoleModalOpen(false)}>Batal</Button>
          <Button
            color="blue"
            disabled={roleEditSelected.length === 0}
            onClick={handleSaveRoles}
            leftSection={<Save className="w-3.5 h-3.5" />}
          >
            Simpan Role
          </Button>
        </div>
      </Modal>

      {/* --- MODAL GRANT / REVOKE FITUR --- */}
      <Modal
        opened={isOverrideModalOpen && !!overrideUser}
        onClose={() => setIsOverrideModalOpen(false)}
        title={overrideUser ? (
          <div>
            <p className="font-bold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Grant / Revoke Fitur</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{overrideUser.full_name} — {parseRoles(overrideUser).map((r: string) => ROLES.find(x=>x.value===r)?.label||r).join(', ')}</p>
          </div>
        ) : 'Grant / Revoke Fitur'}
        size="lg"
        centered
      >
        {overrideUser && (
          <>
            <div className="flex-1 overflow-y-auto max-h-[60vh] pr-1">
              {overrideLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-1">
                  {allFitur.filter(f => f.href !== '/dashboard').map(f => {
                    const userRoles = getEffectiveUserRoles(overrideUser)
                    const hasViaRole = rolesCanAccessFeature(f.roles, userRoles)
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
                            {override ? <ToggleLeft className="w-3.5 h-3.5" /> : effectiveAccess ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t flex justify-between items-center text-[10px] text-slate-400">
              <span>✅ = Dari Role · 🟢 Granted · 🔴 Revoked</span>
              <Button variant="default" size="xs" onClick={() => setIsOverrideModalOpen(false)}>Tutup</Button>
            </div>
          </>
        )}
      </Modal>

    </div>
  )
}
