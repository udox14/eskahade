'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useConfirm } from '@/components/ui/confirm-dialog'
import { deleteSantri } from './actions'

type Props = {
  santriId: string
  nama: string
  nis?: string | null
}

export function DeleteSantriButton({ santriId, nama, nis }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const ok = await confirm(
      `Hapus permanen data santri ${nama}?\nData utama dan riwayat yang menempel ke santri ini akan ikut dihapus. Gunakan hanya untuk data ganda/residu.`,
      {
        title: 'Hapus Data Santri',
        confirmLabel: 'Ya, Hapus',
        variant: 'danger',
      }
    )

    if (!ok) return

    setIsDeleting(true)
    const toastId = toast.loading('Menghapus data santri...')

    try {
      const result = await deleteSantri(santriId)
      toast.dismiss(toastId)

      if ('error' in result) {
        toast.error('Gagal menghapus santri', { description: result.error })
        return
      }

      toast.success('Data santri dihapus', {
        description: nis ? `${nama} (${nis})` : nama,
      })
      router.replace('/dashboard/santri')
      router.refresh()
    } catch (error) {
      toast.dismiss(toastId)
      toast.error('Gagal menghapus santri', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-bold text-red-700 shadow-sm transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Hapus Data
    </button>
  )
}
