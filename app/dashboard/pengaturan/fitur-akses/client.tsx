'use client'

import { useState, useTransition } from 'react'
import { 
  toggleFiturActive, addRoleToFitur, removeRoleFromFitur, 
  toggleFiturBottomNav, setBottomNavUrutan, toggleBottomNavGlobal 
} from './actions'
import { 
  ToggleRight, ToggleLeft, ShieldAlert, Info, Users, 
  CheckCircle2, XCircle, LayoutGrid, Smartphone,
  ShieldCheck, Lock, Unlock, ChevronRight, ListOrdered,
  Zap, ArrowRight, Shield, Activity, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const ALL_ROLES = ['admin', 'keamanan', 'sekpen', 'dewan_santri', 'pengurus_asrama', 'wali_kelas', 'bendahara']

const ROLE_LABEL: Record<string, string> = {
  admin:           'Admin',
  keamanan:        'Keamanan',
  sekpen:          'Sekpen',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Asrama',
  wali_kelas:      'Wali Kelas',
  bendahara:       'Bendahara',
}

const ROLE_LABEL_FULL: Record<string, string> = {
  admin:           'Administrator',
  keamanan:        'Keamanan',
  sekpen:          'Sekretaris Pen.',
  dewan_santri:    'Dewan Santri',
  pengurus_asrama: 'Pengurus Asrama',
  wali_kelas:      'Wali Kelas',
  bendahara:       'Bendahara',
}

const ROLE_COLOR_CLASS: Record<string, string> = {
  admin:           'bg-rose-500/10 text-rose-700 border-rose-500/20',
  keamanan:        'bg-orange-500/10 text-orange-700 border-orange-500/20',
  sekpen:          'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  dewan_santri:    'bg-purple-500/10 text-purple-700 border-purple-500/20',
  pengurus_asrama: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  wali_kelas:      'bg-teal-500/10 text-teal-700 border-teal-500/20',
  bendahara:       'bg-amber-500/10 text-amber-700 border-amber-500/20',
}

const ROLE_GRADIENT: Record<string, string> = {
  admin:           'from-rose-600 to-rose-700 shadow-rose-500/20',
  keamanan:        'from-orange-500 to-orange-600 shadow-orange-500/20',
  sekpen:          'from-indigo-600 to-indigo-700 shadow-indigo-500/20',
  dewan_santri:    'from-purple-600 to-purple-700 shadow-purple-500/20',
  pengurus_asrama: 'from-emerald-600 to-emerald-700 shadow-emerald-500/20',
  wali_kelas:      'from-teal-600 to-teal-700 shadow-teal-500/20',
  bendahara:       'from-amber-500 to-amber-600 shadow-amber-500/20',
}

const GROUP_ORDER = ['_standalone', 'Kesantrian', 'Pengkelasan', 'Nilai & Rapor', 'Absensi', 'Keuangan', 'UPK', 'Master Data']

interface FiturItem {
  id: number
  group_name: string
  title: string
  href: string
  roles: string[]
  is_active: boolean
  is_bottomnav: boolean
  bottomnav_urutan: number
}

interface Props {
  fiturList: FiturItem[]
  globalBottomNavEnabled: boolean
}

// ── Tab: Per Fitur ────────────────────────────────────────────────────────────
function TabPerFitur({
  fiturList,
  loadingId,
  pending,
  onToggleActive,
  onToggleRole,
}: {
  fiturList: FiturItem[]
  loadingId: string | null
  pending: boolean
  onToggleActive: (f: FiturItem) => void
  onToggleRole: (f: FiturItem, role: string) => void
}) {
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturList) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Legend role */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5"/> Access Reference:
          </span>
          {ALL_ROLES.map(r => (
            <Badge key={r} variant="outline" className={cn("text-[10px] px-2.5 py-0.5 rounded-full font-black tracking-tighter uppercase", ROLE_COLOR_CLASS[r])}>
              {ROLE_LABEL[r]}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {groups.map(group => (
        <Card key={group} className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg border shadow-sm">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xs font-black text-foreground uppercase tracking-widest">
                    {group === '_standalone' ? 'Sistem Utama' : group}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    {grouped.get(group)!.length} Fitur Terdaftar
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6">Identitas Fitur</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-4 text-center">Matriks Akses</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.get(group)!.map(fitur => (
                <TableRow key={fitur.id} className={cn("transition-colors group", !fitur.is_active && "opacity-60 bg-muted/30 whitespace-nowrap")}>
                  <TableCell className="px-6 py-4">
                    <div className="font-black text-sm text-foreground uppercase tracking-tight leading-none mb-1">{fitur.title}</div>
                    <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                       <ArrowRight className="w-2.5 h-2.5"/> {fitur.href}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex flex-wrap justify-center gap-1.5 min-w-[280px]">
                      {ALL_ROLES.map(role => {
                        const hasRole = fitur.roles.includes(role)
                        const isAdmin = role === 'admin'
                        const isLoading = loadingId === `role-${fitur.id}-${role}`
                        return (
                          <button
                            key={role}
                            onClick={() => onToggleRole(fitur, role)}
                            disabled={isAdmin || isLoading || pending}
                            className={cn(
                              "text-[9px] px-2.5 py-1.5 rounded-xl border-2 font-black transition-all duration-300 uppercase tracking-tighter whitespace-nowrap",
                              isLoading && "opacity-50 !scale-90",
                              isAdmin
                                ? "cursor-not-allowed opacity-40 bg-muted text-muted-foreground border-transparent"
                                : hasRole
                                  ? cn(ROLE_COLOR_CLASS[role], "hover:scale-105 active:scale-90 border-current shadow-sm")
                                  : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {isLoading ? '...' : ROLE_LABEL[role]}
                          </button>
                        )
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <Button
                      variant={fitur.is_active ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => onToggleActive(fitur)}
                      disabled={loadingId === `active-${fitur.id}` || pending}
                      className={cn(
                        "h-8 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all shadow-sm active:scale-95 gap-2",
                        fitur.is_active 
                          ? "border-emerald-500/20 text-emerald-700 bg-emerald-500/5 hover:bg-emerald-500/10 hover:text-emerald-800"
                          : ""
                      )}
                    >
                      {loadingId === `active-${fitur.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : fitur.is_active ? (
                        <><Zap className="w-3.5 h-3.5" /> AKTIF</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5" /> OFF</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}

// ── Tab: Per Role ─────────────────────────────────────────────────────────────
function TabPerRole({ fiturList }: { fiturList: FiturItem[] }) {
  const [selectedRole, setSelectedRole] = useState<string>('sekpen')

  const fiturForRole = fiturList.filter(f => f.roles.includes(selectedRole))
  const grouped = new Map<string, FiturItem[]>()
  for (const f of fiturForRole) {
    if (!grouped.has(f.group_name)) grouped.set(f.group_name, [])
    grouped.get(f.group_name)!.push(f)
  }
  const groups = GROUP_ORDER.filter(g => grouped.has(g))

  const totalAktif   = fiturForRole.filter(f => f.is_active).length
  const totalNonaktif = fiturForRole.filter(f => !f.is_active).length

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Role selector cards (PREMIUM) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {ALL_ROLES.map(role => {
          const count = fiturList.filter(f => f.roles.includes(role) && f.is_active).length
          const isSelected = selectedRole === role
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "group relative flex flex-col items-center gap-2 p-4 rounded-3xl border-2 text-center transition-all duration-500 active:scale-95",
                isSelected
                  ? cn(`bg-gradient-to-br border-transparent shadow-xl scale-105 z-10`, ROLE_GRADIENT[role])
                  : `bg-card border-border hover:border-slate-300 hover:shadow-lg`
              )}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 p-1 bg-white/20 rounded-full text-white">
                  <CheckCircle2 className="w-3 h-3"/>
                </div>
              )}
              <div className={cn(
                "p-2.5 rounded-2xl transition-transform duration-500",
                isSelected ? "bg-white/20 scale-110" : "bg-muted text-muted-foreground group-hover:scale-110"
              )}>
                 <Shield className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className={cn("text-[9px] font-black uppercase tracking-widest", isSelected ? "text-white/80" : "text-muted-foreground")}>
                  {ROLE_LABEL[role]}
                </span>
                <div className={cn("text-xl font-black tracking-tight leading-none", isSelected ? "text-white" : "text-foreground")}>
                  {count}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Summary Area */}
      <Card className={cn(
        "border-border shadow-xl overflow-hidden relative group",
        ROLE_COLOR_CLASS[selectedRole].split(' ')[0],
      )}>
        <div className={cn("absolute top-0 right-0 w-48 h-48 bg-gradient-to-br opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl transition-all duration-1000", ROLE_GRADIENT[selectedRole])} />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className={cn("w-14 h-14 rounded-[2rem] bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg scale-110", ROLE_GRADIENT[selectedRole])}>
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-black text-foreground tracking-tight uppercase leading-none mb-1">{ROLE_LABEL_FULL[selectedRole]} Matriks</h2>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center justify-center sm:justify-start gap-1.5">
               <Activity className="w-3.5 h-3.5 text-emerald-600"/> {fiturForRole.length} Fitur Terotorisasi
            </div>
          </div>
          <div className="flex items-center gap-4 bg-background/50 backdrop-blur-sm p-3 rounded-2xl border border-border shadow-inner">
            <div className="px-4 py-1.5 text-center">
              <div className="text-lg font-black text-emerald-600 leading-none">{totalAktif}</div>
              <div className="text-[8px] font-black uppercase tracking-widest opacity-50">Online</div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="px-4 py-1.5 text-center">
              <div className={cn("text-lg font-black leading-none", totalNonaktif > 0 ? "text-rose-600" : "text-muted-foreground/30")}>{totalNonaktif}</div>
              <div className="text-[8px] font-black uppercase tracking-widest opacity-50">Offline</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {groups.map(group => (
          <Card key={group} className="border-border shadow-sm bg-muted/5 group overflow-hidden">
             <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                   <ChevronRight className="w-3.5 h-3.5 text-indigo-500 p-0.5 bg-indigo-500/10 rounded-full"/>
                   {group === '_standalone' ? 'Sistem Utama' : group}
                </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                   {grouped.get(group)!.map(fitur => (
                      <div key={fitur.id} className={cn("flex items-center justify-between gap-4 px-5 py-4 transition-all hover:bg-muted/50", !fitur.is_active && "bg-muted/30")}>
                         <div className="space-y-0.5 min-w-0">
                            <div className={cn("text-[11px] font-black uppercase tracking-tight truncate group-hover:text-foreground transition-colors", fitur.is_active ? 'text-slate-800' : 'text-muted-foreground opacity-60')}>
                               {fitur.title}
                            </div>
                            <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-40 font-mono truncate">{fitur.href}</div>
                         </div>
                         <Badge variant={fitur.is_active ? "default" : "outline"} className={cn("text-[8px] font-black tracking-widest h-5 px-2 py-0 border-none", fitur.is_active ? "bg-emerald-600 shadow-emerald-500/10" : "text-muted-foreground opacity-30")}>
                            {fitur.is_active ? 'READY' : 'STANDBY'}
                         </Badge>
                      </div>
                   ))}
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      {/* Fitur Terkunci (DETAILS REPLACEMENT) */}
      {(() => {
        const tidakPunya = fiturList.filter(f => !f.roles.includes(selectedRole))
        if (tidakPunya.length === 0) return null
        return (
          <Alert variant="warning" className="bg-muted/50 border-dashed py-3">
             <Lock className="w-4 h-4 opacity-50" />
             <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Restricted Assets</AlertTitle>
             <AlertDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                Terdapat {tidakPunya.length} fitur sistem lainnya yang tidak memiliki izin akses untuk matriks {ROLE_LABEL[selectedRole]}.
             </AlertDescription>
          </Alert>
        )
      })()}
    </div>
  )
}

// ── Tab: Bottom Nav ───────────────────────────────────────────────────────────
function TabBottomNav({
  fiturList,
  loadingId,
  pending,
  globalEnabled,
  togglingGlobal,
  onToggleGlobal,
  onToggleBottomNav,
  onSetUrutan,
}: {
  fiturList: FiturItem[]
  loadingId: string | null
  pending: boolean
  globalEnabled: boolean
  togglingGlobal: boolean
  onToggleGlobal: () => void
  onToggleBottomNav: (f: FiturItem) => void
  onSetUrutan: (f: FiturItem, urutan: number) => void
}) {
  const roleCount: Record<string, number> = {}
  for (const f of fiturList) {
    if (!f.is_bottomnav) continue
    for (const role of f.roles) {
      roleCount[role] = (roleCount[role] ?? 0) + 1
    }
  }

  const bottomNavItems = fiturList
    .filter(f => f.is_bottomnav)
    .sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)

  const otherItems = fiturList
    .filter(f => !f.is_bottomnav && f.is_active)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Global Logic Switch (PREMIUM) */}
      <Card className={cn(
        "border-border shadow-xl overflow-hidden transition-all duration-700 relative",
        globalEnabled ? 'bg-emerald-500/5' : 'bg-muted/20 grayscale'
      )}>
        <CardContent className="p-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={cn("w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 shadow-lg border-2 transition-all duration-700", globalEnabled ? "bg-emerald-600 border-emerald-400 text-white" : "bg-card border-border text-muted-foreground")}>
               <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight uppercase leading-none mb-1">Global Navigation Bar</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 flex items-center gap-1.5">
                 {globalEnabled ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/> Active on All Devices</> : <><XCircle className="w-3.5 h-3.5 text-rose-500"/> Permanently Hidden</>}
              </p>
            </div>
          </div>
          <Switch 
            checked={globalEnabled} 
            onCheckedChange={onToggleGlobal} 
            disabled={togglingGlobal} 
            className="data-[state=checked]:bg-emerald-600"
          />
        </CardContent>
      </Card>

      {/* Intelligence Note */}
      <Alert className="bg-indigo-500/5 border-indigo-500/20 py-4">
        <Smartphone className="w-4 h-4 text-indigo-600" />
        <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 font-black text-indigo-800">Docks System Protocol</AlertTitle>
        <AlertDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-loose leading-relaxed">
          Sistem akan mengisi maksimal <strong>4 slot dinamis</strong> per role sesuai delegasi di bawah. 
          Slot ke-5 secara otomatis direservasi oleh sistem untuk <strong>Dashboard Master</strong>. 
          Urutan menentukan prioritas visual di layar mobile.
        </AlertDescription>
      </Alert>

      {/* Role Quota Monitor */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {ALL_ROLES.map(role => {
          const count = roleCount[role] ?? 0
          const over = count > 4
          return (
            <Card key={role} className={cn("border-border shadow-sm p-4 text-center space-y-2 relative overflow-hidden", over ? "bg-rose-50 border-rose-200" : "bg-card")}>
              {over && <div className="absolute top-0 right-0 w-8 h-8 bg-rose-500/10 rounded-bl-full flex items-center justify-center"><ShieldAlert className="w-3 h-3 text-rose-600"/></div>}
              <div className={cn("text-[9px] font-black uppercase tracking-widest", ROLE_COLOR_CLASS[role].split(' ')[1])}>{ROLE_LABEL[role]}</div>
              <div className="flex flex-col items-center">
                 <div className={cn("text-xl font-black leading-none", over ? "text-rose-600" : "text-foreground")}>{count}</div>
                 <div className="text-[8px] font-black text-muted-foreground uppercase opacity-40">/ 4 slots</div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Active Bottom Nav */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b py-4">
           <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-emerald-600"/> Optimized Docking Areas
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           {bottomNavItems.length === 0 ? (
             <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-4 border-dashed m-4 border-2 rounded-2xl">
                <LayoutGrid className="w-12 h-12 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">No Dynamic Assets Docked</p>
             </div>
           ) : (
             <Table>
                <TableHeader className="bg-muted/10">
                   <TableRow>
                      <TableHead className="w-20 text-[10px] font-black uppercase px-6">Rank</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Functional Unit</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-center hidden md:table-cell">Target Role</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right px-6">Action</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {bottomNavItems.map(fitur => {
                     const isLoading = loadingId === `bottomnav-${fitur.id}` || loadingId === `urutan-${fitur.id}`
                     return (
                        <TableRow key={fitur.id} className="group">
                           <TableCell className="px-6">
                              <Select
                                value={String(fitur.bottomnav_urutan)}
                                onValueChange={val => onSetUrutan(fitur, Number(val))}
                                disabled={isLoading || pending}
                              >
                                <SelectTrigger className="w-14 h-9 rounded-xl font-black text-xs border-emerald-500/20 focus:ring-emerald-500/20">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border shadow-2xl">
                                   {[1, 2, 3, 4].map(num => (
                                      <SelectItem key={num} value={String(num)} className="rounded-lg font-black text-xs">SLOT {num}</SelectItem>
                                   ))}
                                </SelectContent>
                              </Select>
                           </TableCell>
                           <TableCell>
                              <div className="font-black text-xs uppercase tracking-tight text-foreground">{fitur.title}</div>
                              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-40 font-mono truncate max-w-[150px]">{fitur.href}</div>
                           </TableCell>
                           <TableCell className="hidden md:table-cell">
                              <div className="flex justify-center flex-wrap gap-1">
                                {fitur.roles.slice(0, 3).map(role => (
                                  <Badge key={role} variant="outline" className={cn("text-[8px] px-2 py-0 h-4 border-none", ROLE_COLOR_CLASS[role])}>
                                    {ROLE_LABEL[role]}
                                  </Badge>
                                ))}
                                {fitur.roles.length > 3 && <Badge variant="outline" className="text-[8px] px-2 py-0 h-4">+ {fitur.roles.length - 3}</Badge>}
                              </div>
                           </TableCell>
                           <TableCell className="px-6 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onToggleBottomNav(fitur)}
                                disabled={isLoading || pending}
                                className="h-8 rounded-xl text-[9px] font-black border-emerald-500/20 text-emerald-700 bg-emerald-500/5 hover:bg-emerald-500/10 gap-2 uppercase tracking-widest active:scale-95"
                              >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ToggleRight className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">DOCK ACTIVE</span>
                              </Button>
                           </TableCell>
                        </TableRow>
                     )
                   })}
                </TableBody>
             </Table>
           )}
        </CardContent>
      </Card>

      {/* Other Available Features */}
      {otherItems.length > 0 && (
        <Card className="border-border border-dashed shadow-none bg-muted/5">
           <CardHeader className="py-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Available Assets for Docking</CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-x-12 px-6 pb-6">
                 {otherItems.map(fitur => (
                   <div key={fitur.id} className="flex items-center justify-between py-3 group">
                      <div className="flex-1 min-w-0">
                         <div className="text-[11px] font-black uppercase tracking-tight text-slate-500 group-hover:text-foreground transition-colors truncate">{fitur.title}</div>
                         <div className="text-[8px] font-black text-muted-foreground opacity-30 font-mono truncate">{fitur.href}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleBottomNav(fitur)}
                        disabled={loadingId === `bottomnav-${fitur.id}` || pending}
                        className="h-7 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-600 rounded-lg transition-all"
                      >
                         Add to Dock <ArrowRight className="w-2.5 h-2.5 ml-1"/>
                      </Button>
                   </div>
                 ))}
              </div>
           </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function FiturAksesClient({ fiturList: initial, globalBottomNavEnabled: initialGlobal }: Props) {
  const [fiturList, setFiturList] = useState<FiturItem[]>(initial)
  const [globalEnabled, setGlobalEnabled] = useState(initialGlobal)
  const [togglingGlobal, setTogglingGlobal] = useState(false)
  const [activeTab, setActiveTab] = useState('fitur')
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function updateLocal(id: number, updater: (f: FiturItem) => FiturItem) {
    setFiturList(prev => prev.map(f => f.id === id ? updater(f) : f))
  }

  function handleToggleActive(fitur: FiturItem) {
    const key = `active-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await toggleFiturActive(fitur.id, fitur.is_active)
        updateLocal(fitur.id, f => ({ ...f, is_active: !f.is_active }))
        toast.success(`Fitur "${fitur.title}" ${fitur.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      } catch {
        toast.error('Gagal sinkronisasi status fitur')
      } finally {
        setLoadingId(null)
      }
    })
  }

  async function handleToggleGlobal() {
    setTogglingGlobal(true)
    try {
      await toggleBottomNavGlobal(globalEnabled)
      setGlobalEnabled(v => !v)
      toast.success(`Bottom Docks ${globalEnabled ? 'deactivated' : 'operational'} globally`)
    } catch {
      toast.error('Gagal sinkronisasi status global')
    } finally {
      setTogglingGlobal(false)
    }
  }

  function handleToggleBottomNav(fitur: FiturItem) {
    const key = `bottomnav-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await toggleFiturBottomNav(fitur.id, fitur.is_bottomnav)
        updateLocal(fitur.id, f => ({ ...f, is_bottomnav: !f.is_bottomnav }))
        toast.success(`Asset "${fitur.title}" status dock diperbarui`)
      } catch {
        toast.error('Gagal konfigurasi docking asset')
      } finally {
        setLoadingId(null)
      }
    })
  }

  function handleSetUrutan(fitur: FiturItem, urutan: number) {
    const key = `urutan-${fitur.id}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        await setBottomNavUrutan(fitur.id, urutan)
        updateLocal(fitur.id, f => ({ ...f, bottomnav_urutan: urutan }))
        toast.success(`Priority set to ${urutan} for "${fitur.title}"`)
      } catch {
        toast.error('Gagal menetapkan prioritas docking')
      } finally {
        setLoadingId(null)
      }
    })
  }

  function handleToggleRole(fitur: FiturItem, role: string) {
    if (role === 'admin') return
    const hasRole = fitur.roles.includes(role)
    const key = `role-${fitur.id}-${role}`
    setLoadingId(key)
    startTransition(async () => {
      try {
        if (hasRole) {
          await removeRoleFromFitur(fitur.id, role)
          updateLocal(fitur.id, f => ({ ...f, roles: f.roles.filter(r => r !== role) }))
          toast.success(`Delegasi "${ROLE_LABEL[role]}" dicabut dari "${fitur.title}"`)
        } else {
          await addRoleToFitur(fitur.id, role)
          updateLocal(fitur.id, f => ({ ...f, roles: [...f.roles, role] }))
          toast.success(`Delegasi "${ROLE_LABEL[role]}" berhasil diberikan ke "${fitur.title}"`)
        }
      } catch {
        toast.error('Gagal sinkronisasi delegasi role')
      } finally {
        setLoadingId(null)
      }
    })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-500/10 rounded-[2rem] text-indigo-600 shadow-sm border-2 border-indigo-500/20 scale-110">
            <LayoutGrid className="w-6 h-6"/>
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">Fitur & Hak Akses</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70 mt-1.5 flex items-center gap-2">
               <Unlock className="w-3.5 h-3.5 text-emerald-600"/> Permission Management Core
            </p>
          </div>
        </div>

        {/* Info Banner Integrated */}
        <div className="hidden lg:flex items-center gap-4 bg-blue-500/5 px-5 py-3 rounded-2xl border border-blue-500/10 backdrop-blur-sm">
           <Info className="w-4 h-4 text-blue-500" />
           <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 opacity-80 leading-tight">
              Changes sync in real-time. <br/> Administrator assets are immutable.
           </p>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* TABS NAVIGATION (PREMIUM) */}
      <Tabs defaultValue="fitur" value={activeTab} onValueChange={(v) => setActiveTab(v ?? 'fitur')} className="w-full">
        <TabsList className="h-14 bg-muted/50 p-1.5 rounded-[1.5rem] border border-border shadow-inner mb-8 overflow-x-auto no-scrollbar justify-start">
          <TabsTrigger value="fitur" className="h-11 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 flex items-center gap-3">
             <LayoutGrid className="w-4 h-4" /> Feature matrix
          </TabsTrigger>
          <TabsTrigger value="role" className="h-11 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 flex items-center gap-3">
             <Users className="w-4 h-4" /> Role delegation
          </TabsTrigger>
          <TabsTrigger value="bottomnav" className="h-11 px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 flex items-center gap-3">
             <Smartphone className="w-4 h-4" /> Docks system
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fitur">
          <TabPerFitur
            fiturList={fiturList}
            loadingId={loadingId}
            pending={pending}
            onToggleActive={handleToggleActive}
            onToggleRole={handleToggleRole}
          />
        </TabsContent>
        <TabsContent value="role">
          <TabPerRole fiturList={fiturList} />
        </TabsContent>
        <TabsContent value="bottomnav">
          <TabBottomNav
            fiturList={fiturList}
            loadingId={loadingId}
            pending={pending}
            globalEnabled={globalEnabled}
            togglingGlobal={togglingGlobal}
            onToggleGlobal={handleToggleGlobal}
            onToggleBottomNav={handleToggleBottomNav}
            onSetUrutan={handleSetUrutan}
          />
        </TabsContent>
      </Tabs>

      {/* MOBILE INFO BANNER */}
      <div className="lg:hidden flex items-start gap-3 bg-blue-500/5 px-5 py-4 rounded-2xl border border-blue-500/10">
         <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
         <p className="text-[9px] font-black uppercase tracking-widest text-blue-800 opacity-80 leading-relaxed">
            Semua perubahan akses tersimpan secara otomatis. Role Administrator memiliki akses mutlak yang tidak dapat dimodifikasi.
         </p>
      </div>
    </div>
  )
}
