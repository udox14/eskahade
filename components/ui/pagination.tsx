'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 0] // 0 = semua

export function getPageSizeLabel(size: number) {
  return size === 0 ? 'Semua' : String(size)
}

export function usePagination<T>(data: T[], pageSize: number, currentPage: number) {
  const total = data.length
  const effectiveSize = pageSize === 0 ? total : pageSize
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const start = pageSize === 0 ? 0 : (safePage - 1) * effectiveSize
  const paged = data.slice(start, start + effectiveSize)
  return { paged, totalPages, safePage, total, start }
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const start = pageSize === 0 ? 1 : (currentPage - 1) * pageSize + 1
  const end = pageSize === 0 ? total : Math.min(currentPage * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-card text-card-foreground rounded-b-xl text-sm">
      {/* Info */}
      <div className="text-muted-foreground text-xs">
        {total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total} data`}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Tampilkan</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              onPageSizeChange(Number(val))
              onPageChange(1)
            }}
          >
            <SelectTrigger className="h-8 w-[80px] text-xs">
              <SelectValue placeholder={getPageSizeLabel(pageSize)} />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {getPageSizeLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              title="Halaman pertama"
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 mx-1">
              {getPageRange(currentPage, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="icon"
                    className={`w-8 h-8 text-xs ${p === currentPage ? "" : "text-muted-foreground"}`}
                    onClick={() => onPageChange(Number(p))}
                  >
                    {p}
                  </Button>
                )
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Halaman terakhir"
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function getPageRange(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}
