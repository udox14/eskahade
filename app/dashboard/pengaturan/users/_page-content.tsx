'use client'

import React, { useState, useEffect } from 'react'
import {
  getUsersList, updateUserRole, createUser, resetUserPassword,
  deleteUser, updateUserDetails, createUsersBatch
} from './actions'
import {
  UserCog, Save, Loader2, Shield, Plus, X, Home, Mail, Key,
  Trash2, Edit, Filter, FileSpreadsheet, Upload, CheckCircle,
  AlertCircle, Download, AlertTriangle, Coins, Users, Lock,
  ShieldCheck, Search, ChevronRight, History, MoreHorizontal,
  ArrowRight, Sparkles, CheckCircle2, UserPlus, Activity, ShieldAlert
} from 'lucide-react'
import { toast } from 'sonner'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'bendahara', label: 'Bendahara Umum' },
  { value: 'sekpen', label: 'Sekpen' },
  { value: 'keamanan', label: 'Keamanan' },
  { value: 'dewan_santri', label: 'Dewan Santri' },
  { value: 'pengurus_asrama', label: 'Pengurus Asrama' },
  { value: 'wali_kelas', label: 'Wali Kelas' },
]

const ROLE_COLOR_CLASS: Record<string, string> = {
  admin:           'bg-rose-500/10 text-rose-700 border-rose-500/20',
  bendahara:       'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  sekpen:          'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  keamanan:        'bg-orange-500/10 text-orange-700 border-orange-500/20',
  dewan_santri:    'bg-purple-500/10 text-purple-700 border-purple-500/20',
  pengurus_asrama: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  wali_kelas:      'bg-teal-500/10 text-teal-700 border-teal-500/20',
}

const ASRAMA_LIST = ["AL-FALAH", "AS-SALAM", "BAHAGIA", "ASY-SYIFA 1", "ASY-SYIFA 2", "ASY-SYIFA 3", "ASY-SYIFA 4"]

export default function ManajemenUserPage() {
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  const [isOpenImport, setIsOpenImport] = useState(false)
  const [excelData, setExcelData] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const data = await getUsersList()
    setUsers(data)
    setLoading(false)
  }

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'SEMUA' || u.role === filterRole
    const matchesSearch = searchQuery === '' || 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  const executeUpdateRole = async (userId: string, newRole: string, asrama?: string) => {
    setProcessingId(userId)
    const toastId = toast.loading("Updating security clearance...")
    const res = await updateUserRole(userId, newRole, asrama)
    toast.dismiss(toastId)
    setProcessingId(null)

    if ('error' in res) {
      toast.error("Update Failed", { description: (res as any).error })
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, asrama_binaan: asrama } : u))
      toast.success("Identity Updated", { 
        description: `Matriks diubah ke ${newRole.replace('_', ' ').toUpperCase()} ${asrama ? `(${asrama})` : ''}` 
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

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsCreating(true)
    const toastId = toast.loading("Synthesizing new identity...")
    const formData = new FormData(e.currentTarget)
    const res = await createUser(formData)
    setIsCreating(false)
    toast.dismiss(toastId)

    if ('error' in res) {
      toast.error("Creation Blocked", { description: (res as any).error })
    } else {
      toast.success("Access Granted", { description: "Identity synced to core system." })
      setIsOpenAdd(false)
      loadData()
    }
  }

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userToEdit) return
    const formData = new FormData(e.currentTarget)
    const fullName = formData.get('full_name') as string
    const email = formData.get('email') as string
    const toastId = toast.loading("Syncing modifications...")
    const res = await updateUserDetails(userToEdit.id, fullName, email)
    toast.dismiss(toastId)

    if ('error' in res) {
      toast.error("Override Failed", { description: (res as any).error })
    } else {
      toast.success("Identity Modified")
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
    const toastId = toast.loading("Resetting authentication sequence...")
    const res = await resetUserPassword(userToReset.id, newPass)
    toast.dismiss(toastId)

    if ('error' in res) {
      toast.error("Hard Reset Failed", { description: (res as any).error })
    } else {
      toast.success("Security Key Re-issued")
      setIsOpenReset(false)
      setUserToReset(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    const toastId = toast.loading("Decomissioning identity...")
    const res = await deleteUser(userToDelete.id)
    toast.dismiss(toastId)

    if ('error' in res) {
        toast.error("Decommission Failed", { description: (res as any).error })
    } else {
        toast.success("Identity Terminated")
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id))
        setIsOpenDelete(false)
        setUserToDelete(null)
    }
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { "NAMA LENGKAP": "Budi Santoso", "EMAIL": "budi@pesantren.com", "PASSWORD": "password123", "ROLE": "wali_kelas", "ASRAMA": "" },
      { "NAMA LENGKAP": "Ahmad Keamanan", "EMAIL": "ahmad@pesantren.com", "PASSWORD": "password123", "ROLE": "keamanan", "ASRAMA": "" },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:15}, {wch:15}]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template User")
    XLSX.writeFile(workbook, "Protocol_Import_User.xlsx")
    toast.success("Pattern Sequence Downloaded")
  }

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading("Parsing encryption layers...")
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
          asrama_binaan: row['ASRAMA']?.toUpperCase(),
          isValid: row['NAMA LENGKAP'] && row['EMAIL'] && row['PASSWORD'] && row['ROLE']
      }))
      setExcelData(mappedData)
      toast.dismiss(toastId)
      toast.success(`Decoded ${mappedData.length} entries`)
    } catch (error) {
      toast.dismiss(toastId)
      toast.error("Sequence Corruption Detected")
    }
  }

  const handleSimpanBatch = async () => {
    if (excelData.length === 0) return
    setIsImporting(true)
    const toastId = toast.loading("Injecting batch protocols...")
    const validData = excelData.filter(d => d.isValid)
    const res = await createUsersBatch(validData)
    setIsImporting(false)
    toast.dismiss(toastId)

    if (res?.success) {
        toast.success(`Success fully injected ${(res as any).count} identities.`)
        if ((res as any).errors) {
            toast.warning("Partial Injection Failed", { description: (res as any).errors.join(", ") })
        }
        setIsOpenImport(false)
        setExcelData([])
        loadData()
    } else {
        toast.error("Global Injection Failure")
    }
  }

  const { paged: pagedUsers, totalPages: totalPagesUsers, safePage: safePageUsers } = usePagination(filteredUsers, pageSize, page)

  return (
    <div className="max-w-6xl mx-auto px-2 pb-32 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-blue-500/10 rounded-[2rem] text-blue-600 shadow-sm border-2 border-blue-500/20 scale-110">
            <UserCog className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">Identity Manager</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70 mt-1.5 flex items-center gap-2">
               <ShieldCheck className="w-3.5 h-3.5 text-emerald-600"/> High-Level Access Control
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-blue-500 transition-colors"/>
               <Input 
                 placeholder="SEARCH IDENTITY..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="h-10 w-full sm:w-64 pl-9 rounded-xl border-border bg-background/50 font-bold text-[10px] uppercase tracking-widest focus-visible:ring-blue-500"
               />
            </div>

            <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? 'all')}>
               <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl border-border bg-background font-black text-[10px] uppercase tracking-widest focus:ring-blue-500">
                  <SelectValue placeholder="FILTER ROLE" />
               </SelectTrigger>
               <SelectContent className="rounded-xl font-black text-[10px] uppercase">
                  <SelectItem value="SEMUA">ALL CLEARANCE</SelectItem>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
               </SelectContent>
            </Select>

            <Button 
                onClick={() => setIsOpenImport(true)}
                variant="outline"
                className="h-10 px-5 rounded-xl border-indigo-500/20 text-indigo-700 bg-indigo-500/5 hover:bg-indigo-500/10 font-black text-[10px] uppercase tracking-widest gap-2"
            >
                <FileSpreadsheet className="w-4 h-4" /> BATCH IMPORT
            </Button>
            
            <Button 
                onClick={() => setIsOpenAdd(true)}
                className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg shadow-emerald-500/20"
            >
                <Plus className="w-4 h-4" /> ADD USER
            </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Identities', val: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/5' },
           { label: 'Admin Access', val: users.filter(u => u.role === 'admin').length, icon: Shield, color: 'text-rose-600', bg: 'bg-rose-500/5' },
           { label: 'Operational Active', val: users.length, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-500/5' },
           { label: 'Clearance Matched', val: filteredUsers.length, icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-500/5' },
         ].map((s, i) => (
           <Card key={i} className="border-border shadow-sm overflow-hidden group">
              <CardContent className="p-5 flex items-center gap-4">
                 <div className={cn("p-2.5 rounded-2xl shrink-0 transition-transform group-hover:scale-110", s.bg, s.color)}>
                    <s.icon className="w-4 h-4"/>
                 </div>
                 <div>
                    <div className="text-xl font-black tracking-tight leading-none mb-0.5">{s.val}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{s.label}</div>
                 </div>
              </CardContent>
           </Card>
         ))}
      </div>

      {/* MAIN TABLE (PREMIUM) */}
      <Card className="border-border shadow-sm overflow-hidden bg-background">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest h-12">Authorized Entity</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest h-12">Security Matriks</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest h-12">Delegation</TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest h-12 text-right">Operational</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="h-64 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500/30 mb-2"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Decrypting assets...</p>
              </TableCell></TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-64 text-center opacity-40">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-widest">No matching clearance records found.</p>
              </TableCell></TableRow>
            ) : (
              pagedUsers.map((u) => (
                <TableRow key={u.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-sm border-2 border-white transition-all group-hover:scale-105", 
                          u.role === 'admin' ? 'bg-rose-500' : 
                          u.role === 'bendahara' ? 'bg-emerald-500' :
                          u.role === 'pengurus_asrama' ? 'bg-amber-500' : 'bg-slate-400'
                       )}>
                          {u.full_name?.charAt(0) || '?'}
                       </div>
                       <div>
                          <div className="font-black text-sm text-foreground uppercase tracking-tight leading-none mb-1 group-hover:text-blue-600 transition-colors">{u.full_name || "NULL_ENTITY"}</div>
                          <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                             <Mail className="w-2.5 h-2.5"/> {u.email}
                          </div>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)} disabled={processingId === u.id}>
                          <SelectTrigger className={cn("h-8 rounded-xl font-black text-[9px] uppercase tracking-widest w-44 border-none shadow-none focus:ring-0", ROLE_COLOR_CLASS[u.role])}>
                             <div className="flex items-center gap-1.5"><Shield className="w-3 h-3"/> <SelectValue /></div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border shadow-2xl">
                             {ROLES.map(r => (
                               <SelectItem key={r.value} value={r.value} className="text-[9px] font-black uppercase tracking-widest rounded-lg">{r.label}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                       {processingId === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600"/>}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {u.role === 'pengurus_asrama' ? (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPendingRoleUpdate({ userId: u.id, role: 'pengurus_asrama' })
                          setIsAsramaModalOpen(true)
                        }}
                        className="h-8 rounded-xl text-[9px] font-black tracking-widest uppercase border-amber-500/20 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10 gap-1.5"
                      >
                        <Home className="w-3 h-3"/> {u.asrama_binaan || "SELECT SECTOR"}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest opacity-20 border-none bg-muted h-5 px-2">GLOBAL CORE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                     <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground flex items-center justify-center hover:bg-muted transition-colors">
                            <MoreHorizontal className="w-4 h-4"/>
                        </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="w-48 rounded-xl border-border shadow-xl">
                          <DropdownMenuLabel className="text-[9px] font-black uppercase text-muted-foreground px-3 py-2">Entity Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setUserToEdit({ id: u.id, name: u.full_name, email: u.email }); setIsOpenEdit(true); }} className="rounded-lg text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 gap-2 cursor-pointer">
                             <Edit className="w-3.5 h-3.5 text-blue-600"/> Modify Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setUserToReset({ id: u.id, name: u.full_name }); setIsOpenReset(true); }} className="rounded-lg text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 gap-2 cursor-pointer">
                             <Key className="w-3.5 h-3.5 text-orange-600"/> Reset Auth Key
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="opacity-50" />
                          <DropdownMenuItem onClick={() => { setUserToDelete({ id: u.id, name: u.full_name }); setIsOpenDelete(true); }} className="rounded-lg text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 gap-2 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                             <Trash2 className="w-3.5 h-3.5"/> Destructive Deletion
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        <div className="px-6 py-4 bg-muted/10 border-t">
           <Pagination
             currentPage={safePageUsers}
             totalPages={totalPagesUsers}
             pageSize={pageSize}
             total={filteredUsers.length}
             onPageChange={setPage}
             onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
           />
        </div>
      </Card>

      {/* --- MODAL ADD USER --- */}
      <Dialog open={isOpenAdd} onOpenChange={setIsOpenAdd}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] gap-0 p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-blue-600 text-white relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                <UserPlus className="w-6 h-6"/>
             </div>
             <DialogTitle className="text-xl font-black uppercase tracking-tight">Generate New Identity</DialogTitle>
             <DialogDescription className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Initialize authentication assets for a new staff member.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="p-8 space-y-5 bg-card">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Entity Name</Label>
                <Input name="full_name" required placeholder="Full professional name..." className="h-11 rounded-xl border-border bg-background focus-visible:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Secure Email</Label>
                <Input name="email" type="email" required placeholder="staff@pesantren.com" className="h-11 rounded-xl border-border bg-background focus-visible:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Initial Authentication Key</Label>
                <Input name="password" type="password" required minLength={6} placeholder="Min. 6 alphanumeric" className="h-11 rounded-xl border-border bg-background focus-visible:ring-blue-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Access Protocol</Label>
                <Select name="role" defaultValue={newRole} onValueChange={(v) => setNewRole(v ?? 'wali_santri')}>
                   <SelectTrigger className="h-11 rounded-xl font-bold">
                      <SelectValue placeholder="Select Clearance" />
                   </SelectTrigger>
                   <SelectContent className="rounded-xl font-bold">
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                   </SelectContent>
                </Select>
              </div>

              {newRole === 'pengurus_asrama' && (
                <Alert className="bg-amber-500/5 border-amber-500/10 p-4 animate-in slide-in-from-top-2">
                   <Home className="w-4 h-4 text-amber-600"/>
                   <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-amber-900 mb-2">Sector Delegation Required</AlertTitle>
                   <Select name="asrama_binaan" required>
                      <SelectTrigger className="h-10 rounded-xl bg-background border-border font-bold text-xs">
                         <SelectValue placeholder="Select Sector..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold text-xs">
                         {ASRAMA_LIST.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </Alert>
              )}

              <Button type="submit" disabled={isCreating} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 mt-2">
                 {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>}
                 INITIATE PROTOCOL
              </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- SECTOR SELECTOR MODAL --- */}
      <Dialog open={isAsramaModalOpen} onOpenChange={(val) => { if(!val){ setIsAsramaModalOpen(false); setPendingRoleUpdate(null); } }}>
         <DialogContent className="sm:max-w-[500px] border-none p-0 overflow-hidden rounded-[2rem] shadow-2xl">
            <DialogHeader className="p-8 bg-amber-500 text-white">
               <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><Home className="w-6 h-6"/> Sector Delegation</DialogTitle>
               <DialogDescription className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Select an administrative sector for this operational officer.</DialogDescription>
            </DialogHeader>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {ASRAMA_LIST.map((asrama) => (
                  <button
                    key={asrama}
                    onClick={() => handleSelectAsrama(asrama)}
                    className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-border/50 hover:border-amber-500 hover:bg-amber-500/5 transition-all text-left active:scale-95"
                  >
                    <div className="p-2.5 rounded-xl bg-muted group-hover:bg-amber-500 group-hover:text-white transition-colors">
                       <Home className="w-5 h-5"/>
                    </div>
                    <span className="font-black text-xs uppercase tracking-tight text-foreground group-hover:text-amber-900">{asrama}</span>
                  </button>
               ))}
            </div>
            <div className="p-4 bg-muted/40 border-t flex justify-end px-8">
               <Button variant="ghost" className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest text-muted-foreground" onClick={() => { setIsAsramaModalOpen(false); setPendingRoleUpdate(null); }}>Abort</Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- RESET PASS MODAL --- */}
      <Dialog open={isOpenReset} onOpenChange={setIsOpenReset}>
         <DialogContent className="sm:max-w-sm rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden">
            <DialogHeader className="p-6 bg-rose-600 text-white">
               <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3"><Key className="w-5 h-5"/> Emergency Lockout</DialogTitle>
               <DialogDescription className="text-rose-100 text-[10px] font-bold uppercase tracking-widest">Resetting key for: {userToReset?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="p-6 space-y-6">
                <div className="space-y-1.5 text-center">
                  <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">New Authentication Key</Label>
                  <Input name="new_password" type="text" required minLength={6} placeholder="Min. 6 alphanumeric" className="h-14 rounded-2xl border-muted bg-muted/30 text-center font-black text-xl tracking-widest focus-visible:ring-rose-500 uppercase" />
                </div>
                <div className="flex gap-3">
                   <Button variant="outline" type="button" onClick={() => setIsOpenReset(false)} className="flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest">Abort</Button>
                   <Button type="submit" className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20">Sync Key</Button>
                </div>
            </form>
         </DialogContent>
      </Dialog>

      {/* --- EDIT MODAL --- */}
      <Dialog open={isOpenEdit} onOpenChange={setIsOpenEdit}>
         <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden">
            <DialogHeader className="p-8 bg-indigo-600 text-white">
               <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><Edit className="w-5 h-5"/> Modify Protocol</DialogTitle>
               <DialogDescription className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">Updating identification records.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="p-8 space-y-5">
               <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assigned Name</Label>
                 <Input name="full_name" defaultValue={userToEdit?.name} required className="h-11 rounded-xl border-border bg-background font-bold focus-visible:ring-indigo-500" />
               </div>
               <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Secure Email</Label>
                 <Input name="email" type="email" defaultValue={userToEdit?.email} required className="h-11 rounded-xl border-border bg-background font-bold focus-visible:ring-indigo-500" />
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                 <Button variant="ghost" type="button" onClick={() => setIsOpenEdit(false)} className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10">Abort</Button>
                 <Button type="submit" className="px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-indigo-500/20">Commit Sync</Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>

      {/* --- DELETE MODAL --- */}
      <Dialog open={isOpenDelete} onOpenChange={setIsOpenDelete}>
         <DialogContent className="sm:max-w-sm rounded-[2rem] p-8 border-none shadow-2xl text-center">
            <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-rose-600">
               <AlertTriangle className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight mb-2">Decomission Entity?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest px-4 leading-relaxed">
               You are about to permanently erase the identity of <b>{userToDelete?.name}</b>. All access permissions will be revoked immediately.
            </DialogDescription>
            <div className="grid grid-cols-2 gap-3 mt-8">
               <Button variant="outline" onClick={() => setIsOpenDelete(false)} className="h-12 rounded-xl border-border font-black text-[11px] uppercase tracking-widest">Abort</Button>
               <Button onClick={handleDeleteUser} className="h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4"/> Delete
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      {/* --- IMPORT MODAL --- */}
      <Dialog open={isOpenImport} onOpenChange={(val) => { if(!val){ setIsOpenImport(false); setExcelData([]); } }}>
         <DialogContent className="sm:max-w-3xl rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 relative">
               <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-indigo-950 opacity-50" />
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
               <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                     <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3"><FileSpreadsheet className="w-6 h-6 text-indigo-400"/> Batch Identity Injection</DialogTitle>
                     <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Inject mass identity protocols via encrypted spreadsheet files.</DialogDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={() => { setIsOpenImport(false); setExcelData([]); }}>
                     <X className="w-6 h-6"/>
                  </Button>
               </div>
            </DialogHeader>

            <div className="p-8 space-y-8 overflow-y-auto no-scrollbar flex-1 bg-card">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Template Section */}
                  <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/10 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg">
                           <Download className="w-5 h-5"/>
                        </div>
                        <h4 className="font-black text-[10px] uppercase tracking-loose text-indigo-900">Sequence Pattern</h4>
                     </div>
                     <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">Identity attributes must exactly match the authorized protocol schema.</p>
                     <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full h-10 rounded-xl bg-white text-indigo-700 border-indigo-500/10 hover:bg-indigo-50 hover:text-indigo-800 font-black text-[10px] uppercase tracking-widest gap-2">
                        Download Pattern
                     </Button>
                  </div>

                  {/* Upload Section */}
                  <div className="relative group border-2 border-dashed border-indigo-500/20 rounded-3xl p-6 text-center bg-indigo-500/[0.02] hover:bg-indigo-500/[0.05] hover:border-indigo-500/40 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[160px]">
                     <input type="file" accept=".xlsx" onChange={handleUploadExcel} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                     <div className="p-4 bg-white rounded-2xl shadow-sm mb-3 text-indigo-500 transition-transform group-hover:scale-110">
                        <Upload className="w-8 h-8"/>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Inject identity sequence file (.xlsx)</p>
                  </div>
               </div>

               {excelData.length > 0 && (
                  <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 pt-2">
                     <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                           <History className="w-4 h-4 text-emerald-600"/> Decoded Buffers
                        </h4>
                        <Badge variant="outline" className="text-[9px] font-black text-emerald-700 bg-emerald-50 border-emerald-500/20">
                           {excelData.filter(d=>d.isValid).length} Valid protocols found
                        </Badge>
                     </div>
                     <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-background">
                        <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                           <Table className="text-[10px]">
                              <TableHeader className="bg-muted px-2">
                                 <TableRow>
                                    <TableHead className="font-black uppercase h-8 px-4">Entity</TableHead>
                                    <TableHead className="font-black uppercase h-8">Clearance</TableHead>
                                    <TableHead className="font-black uppercase h-8 text-center">Status</TableHead>
                                 </TableRow>
                              </TableHeader>
                              <TableBody>
                                 {excelData.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-muted/30">
                                       <TableCell className="px-4 py-3">
                                          <div className="font-black uppercase tracking-tight text-foreground leading-none mb-0.5">{row.full_name}</div>
                                          <div className="text-[8px] font-black opacity-40 uppercase tracking-widest">{row.email}</div>
                                       </TableCell>
                                       <TableCell className="font-black uppercase whitespace-nowrap">{row.role || '??'}</TableCell>
                                       <TableCell className="text-center">
                                          {row.isValid 
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/> 
                                            : <AlertCircle className="w-4 h-4 text-rose-500 mx-auto"/>}
                                       </TableCell>
                                    </TableRow>
                                 ))}
                              </TableBody>
                           </Table>
                        </div>
                     </div>
                     <div className="pt-4 flex justify-between items-center px-2">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest max-w-[200px]">Ensure all decrypted data is correct before injection.</p>
                        <Button 
                           onClick={handleSimpanBatch}
                           disabled={isImporting || excelData.filter(d=>d.isValid).length === 0}
                           className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 gap-2 active:scale-95"
                        >
                           {isImporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                           Execute Protocol Injection
                        </Button>
                     </div>
                  </div>
               )}
            </div>
         </DialogContent>
      </Dialog>
    </div>
  )
}