import { queryOne } from '@/lib/db'

// Kartu santri (QR + PIN) tidak lagi dipakai untuk pencairan uang jajan.
// Modul Kredensial dinonaktifkan tanpa menghapus tabel/data: aktif hanya bila
// app_settings.finance_credentials_enabled = '1'. Default (tidak ada baris) = nonaktif.
export async function isCredentialsModuleEnabled(): Promise<boolean> {
  const row = await queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'finance_credentials_enabled'`).catch(() => null)
  return row?.value === '1'
}

export async function assertCredentialsModuleEnabled(): Promise<void> {
  if (!await isCredentialsModuleEnabled()) {
    throw new Error('Modul Kredensial & Kartu dinonaktifkan. Pencairan uang jajan kini melalui menu Pencairan Uang Jajan.')
  }
}
