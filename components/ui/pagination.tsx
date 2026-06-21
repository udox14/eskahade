'use client'

import { Pagination as MantinePagination, NativeSelect } from '@mantine/core'

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
          <NativeSelect
            size="xs"
            value={String(pageSize)}
            onChange={e => { onPageSizeChange(Number(e.currentTarget.value)); onPageChange(1) }}
            data={PAGE_SIZE_OPTIONS.map(s => ({ value: String(s), label: getPageSizeLabel(s) }))}
            w={84}
          />
        </div>

        {/* Navigation — sembunyikan kalau pageSize = 0 (semua) */}
        {pageSize !== 0 && totalPages > 1 && (
          <MantinePagination
            size="sm"
            withEdges
            total={totalPages}
            value={currentPage}
            onChange={onPageChange}
          />
        )}
      </div>
    </div>
  )
}
