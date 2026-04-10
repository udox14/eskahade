import { query, queryOne } from '@/lib/db'
import Link from 'next/link'
import { Pencil, ChevronRight, Users, Home, BookOpen } from 'lucide-react'
import { PaginationControls } from './santri-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  page: number
  limit: number
  q: string
  asrama: string
  kamar: string
  sekolah: string
  kelasSekolah: string
  marhalah: string
  kelasPesantren: string
  userAsrama: string | null
}

export async function SantriTable({
  page, limit, q, asrama, kamar, sekolah, kelasSekolah, marhalah, kelasPesantren, userAsrama
}: Props) {
  const offset = (page - 1) * limit

  let whereClauses: string[] = ["s.status_global = 'aktif'"]
  const params: any[] = []

  let joinClause = ''
  if (kelasPesantren) {
    joinClause = "JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'"
    whereClauses.push('rp.kelas_id = ?')
    params.push(kelasPesantren)
  } else if (marhalah) {
    joinClause = "JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif' JOIN kelas k ON k.id = rp.kelas_id"
    whereClauses.push('k.marhalah_id = ?')
    params.push(marhalah)
  }

  if (q)            { whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (asrama && asrama !== 'semua')       { whereClauses.push('s.asrama = ?');           params.push(asrama) }
  if (kamar && kamar !== 'semua')        { whereClauses.push('s.kamar = ?');            params.push(kamar) }
  if (sekolah && sekolah !== 'semua')      { whereClauses.push('s.sekolah = ?');          params.push(sekolah) }
  if (kelasSekolah && kelasSekolah !== 'semua') { whereClauses.push('s.kelas_sekolah LIKE ?'); params.push(`%${kelasSekolah}%`) }

  const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const [countRow, santriList] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri s ${joinClause} ${whereStr}`, params
    ),
    query<any>(
      `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.status_global
       FROM santri s ${joinClause} ${whereStr}
       ORDER BY s.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ])

  const count = countRow?.total || 0

  if (santriList.length === 0) {
    return (
      <Card className="border-dashed py-16 text-center bg-muted/20">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-foreground font-medium">Data tidak ditemukan</p>
        <p className="text-muted-foreground text-sm mt-1">Coba ubah kata kunci atau hapus filter</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Counter */}
      <p className="text-xs text-muted-foreground px-1 font-medium">{count} santri ditemukan</p>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-3">
        {santriList.map((santri: any) => (
          <Card key={santri.id} className="overflow-hidden shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate block">{santri.nama_lengkap}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{santri.nis}</p>
                </div>
                <Badge variant={santri.status_global === 'aktif' ? 'default' : santri.status_global === 'lulus' ? 'secondary' : 'destructive'} className="shrink-0 text-[10px] h-5 py-0 px-2 uppercase tracking-wide">
                  {santri.status_global}
                </Badge>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 overflow-hidden">
                  <Home className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{santri.asrama || '-'} · Kmr {santri.kamar || '-'}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <BookOpen className="w-3.5 h-3.5 opacity-70" />
                  {santri.sekolah || '-'} {santri.kelas_sekolah ? `Kls ${santri.kelas_sekolah}` : ''}
                </span>
              </div>
              <div className="mt-4 flex gap-2 pt-3 border-t border-border/50">
                {!userAsrama && (
                  <Link href={`/dashboard/santri/${santri.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 h-9 rounded-lg border-amber-200/50 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-400")}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Link>
                )}
                <Link href={`/dashboard/santri/${santri.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1 h-9 rounded-lg")}>
                  Detail <ChevronRight className="w-3.5 h-3.5 ml-1.5 -mr-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Tabel */}
      <Card className="hidden md:block shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-4">Nama Lengkap</TableHead>
              <TableHead className="py-4">NIS</TableHead>
              <TableHead className="py-4">Asrama & Kamar</TableHead>
              <TableHead className="py-4">Sekolah</TableHead>
              <TableHead className="py-4 text-center">Status</TableHead>
              <TableHead className="py-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {santriList.map((santri: any) => (
              <TableRow key={santri.id} className="group">
                <TableCell className="font-medium">{santri.nama_lengkap}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{santri.nis}</TableCell>
                <TableCell>
                  <p className="font-medium text-xs">{santri.asrama || '-'}</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">Kamar {santri.kamar || '-'}</p>
                </TableCell>
                <TableCell>
                  <p className="text-indigo-600 dark:text-indigo-400 font-medium text-xs">{santri.sekolah || '-'}</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{santri.kelas_sekolah ? `Kelas ${santri.kelas_sekolah}` : '-'}</p>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={santri.status_global === 'aktif' ? 'default' : santri.status_global === 'lulus' ? 'secondary' : 'destructive'} className="text-[10px] font-semibold uppercase tracking-wider">
                    {santri.status_global}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    {!userAsrama && (
                      <Link href={`/dashboard/santri/${santri.id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors")}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Link>
                    )}
                    <Link href={`/dashboard/santri/${santri.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 px-3 transition-colors shadow-none")}>
                      Detail <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {count > 0 && (
        <Card className="px-4 py-2 bg-background border-border shadow-sm">
          <PaginationControls total={count} limit={limit} page={page} />
        </Card>
      )}
    </div>
  )
}
