'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50 rounded-b-xl text-sm">
      {/* Info */}
      <div className="text-gray-500 text-xs">
        {total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total} data`}
      </div>

      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-xs">Tampilkan</span>
          <select
            value={pageSize}
            onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
            className="border rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(s => (
              <option key={s} value={s}>{getPageSizeLabel(s)}</option>
            ))}
          </select>
        </div>

        {/* Navigation — sembunyikan kalau pageSize = 0 (semua) */}
        {pageSize !== 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <NavBtn onClick={() => onPageChange(1)} disabled={currentPage === 1} title="Halaman pertama">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </NavBtn>
            <NavBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} title="Sebelumnya">
              <ChevronLeft className="w-3.5 h-3.5" />
            </NavBtn>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {getPageRange(currentPage, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-1 text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(Number(p))}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <NavBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} title="Berikutnya">
              <ChevronRight className="w-3.5 h-3.5" />
            </NavBtn>
            <NavBtn onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} title="Halaman terakhir">
              <ChevronsRight className="w-3.5 h-3.5" />
            </NavBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function NavBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded border bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function getPageRange(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}
