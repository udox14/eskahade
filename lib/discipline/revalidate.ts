import { revalidatePath, revalidateTag } from 'next/cache'
export function revalidateDiscipline(santriId?:string) {
 revalidateTag('discipline',{expire:0})
 for(const path of ['/dashboard/keamanan','/dashboard/surat-santri','/dashboard/pimpinan/disiplin','/portal-ortu/beranda','/portal-ortu/aktivitas','/portal-ortu/pelanggaran']) revalidatePath(path)
 if(santriId) revalidatePath(`/dashboard/santri/${santriId}`)
 else revalidatePath('/dashboard/santri/[id]','page')
}
