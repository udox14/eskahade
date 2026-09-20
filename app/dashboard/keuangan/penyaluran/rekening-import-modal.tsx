'use client'

import { useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import {
  X,
  FileXls,
  DownloadSimple,
  UploadSimple,
  CheckCircle,
  WarningCircle,
  XCircle,
  ArrowClockwise,
  ArrowLeft,
  Info,
} from '@phosphor-icons/react'
import {
  getProviderAccountTemplateDataAction,
  importProviderAccountsAction,
} from './actions'
import type {
  ValidatedImportAccountRow,
  ProviderAccountTemplateRow,
} from '@/lib/finance/distribution-types'

interface RekeningImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  serviceType?: 'Makan' | 'Cuci'
}

export default function RekeningImportModal({
  isOpen,
  onClose,
  onSuccess,
  serviceType,
}: RekeningImportModalProps) {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2>(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parsed and validated rows
  const [parsedRows, setParsedRows] = useState<ValidatedImportAccountRow[]>([])
  const [fileName, setFileName] = useState<string>('')

  // Reset state when closing
  const handleClose = () => {
    setStep(1)
    setParsedRows([])
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  // Unduh Template Excel Pre-filled dengan Provider Existing
  const handleDownloadTemplate = async () => {
    try {
      const templatePayload = await getProviderAccountTemplateDataAction()
      const XLSX = await import('xlsx')

      const headers = [
        'ID Penyedia (Jangan Ubah)',
        'Nama Penyedia',
        'Jenis Layanan',
        'Nama Bank',
        'Nomor Rekening',
        'Nama Pemilik Rekening',
        'Rekening Utama (YA / TIDAK)',
        'Catatan',
      ]

      const rows = templatePayload.providers.map((p) => [
        p.provider_id,
        p.nama_penyedia,
        p.jenis_layanan,
        '',
        '',
        '',
        'TIDAK',
        '',
      ])

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      // Set column widths
      ws['!cols'] = [
        { wch: 38 }, // provider_id
        { wch: 35 }, // nama_penyedia
        { wch: 15 }, // jenis_layanan
        { wch: 20 }, // bank
        { wch: 22 }, // nomor_rekening
        { wch: 30 }, // nama_pemilik
        { wch: 26 }, // rekening_utama
        { wch: 25 }, // catatan
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rekening Penyedia')
      XLSX.writeFile(wb, 'Template_Rekening_Penyedia.xlsx')

      toast.success('Template Excel berhasil diunduh.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh template Excel.')
    }
  }

  // Upload & Parse Excel File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    startTransition(async () => {
      try {
        const XLSX = await import('xlsx')
        const arrayBuffer = await file.arrayBuffer()
        const wb = XLSX.read(arrayBuffer, { type: 'array' })

        const sheetName = wb.SheetNames[0]
        if (!sheetName) {
          throw new Error('File Excel tidak memiliki lembar kerja (worksheet).')
        }

        const ws = wb.Sheets[sheetName]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        if (rawRows.length === 0) {
          throw new Error('File Excel kosong atau tidak memiliki baris data.')
        }

        // Ambil data master provider & existing accounts untuk validasi referensial dan duplikasi
        const templatePayload = await getProviderAccountTemplateDataAction()
        const providerMap = new Map<string, ProviderAccountTemplateRow>()
        for (const p of templatePayload.providers) {
          providerMap.set(p.provider_id, p)
        }

        const existingDbAccounts = new Set(
          templatePayload.existingAccounts.map(
            (a) => `${a.provider_id}|${a.bank_name.trim().toUpperCase()}|${a.account_number.trim()}`
          )
        )

        const validated: ValidatedImportAccountRow[] = []
        const seenInFile = new Set<string>()

        rawRows.forEach((r, idx) => {
          // Cari kolom dengan toleransi nama kolom
          const rawId = String(
            r['ID Penyedia (Jangan Ubah)'] ||
              r['ID Penyedia'] ||
              r['provider_id'] ||
              r['Provider ID'] ||
              ''
          ).trim()

          const rawNama = String(
            r['Nama Penyedia'] || r['nama_penyedia'] || r['Provider Name'] || ''
          ).trim()

          const rawJenis = String(
            r['Jenis Layanan'] || r['jenis_layanan'] || r['Layanan'] || ''
          ).trim()

          const rawBank = String(r['Nama Bank'] || r['bank'] || r['Bank'] || '').trim()

          const rawNoRek = String(
            r['Nomor Rekening'] || r['nomor_rekening'] || r['No Rekening'] || r['No. Rekening'] || ''
          ).trim()

          const rawPemilik = String(
            r['Nama Pemilik Rekening'] ||
              r['nama_pemilik'] ||
              r['Pemilik Rekening'] ||
              r['Atas Nama'] ||
              ''
          ).trim()

          const rawUtama = String(
            r['Rekening Utama (YA / TIDAK)'] ||
              r['rekening_utama'] ||
              r['Rekening Utama'] ||
              r['Utama'] ||
              ''
          ).trim().toUpperCase()

          const rawCatatan = String(r['Catatan'] || r['catatan'] || '').trim()

          // Jika baris benar-benar kosong di bagian bank/rekening, lewati (misal baris template yang tidak diisi)
          if (!rawBank && !rawNoRek && !rawPemilik) {
            return
          }

          // 1. Validasi Provider ID
          const provider = providerMap.get(rawId)
          if (!provider) {
            validated.push({
              index: idx,
              provider_id: rawId,
              nama_penyedia: rawNama || 'Tidak Dikenal',
              jenis_layanan: rawJenis || '-',
              bank: rawBank,
              nomor_rekening: rawNoRek,
              nama_pemilik: rawPemilik,
              is_primary: false,
              catatan: rawCatatan || null,
              status: 'INVALID',
              message: `ID Penyedia "${rawId}" tidak terdaftar di sistem master jasa.`,
            })
            return
          }

          // 2. Validasi Kesesuaian Nama Penyedia vs Provider ID
          // Aturan PRD: Jangan gunakan nama untuk menentukan provider; source identity tetap Provider ID.
          // Tandai warning yang jelas jika nama di file berbeda dengan master.
          let warningMsg: string | undefined = undefined
          if (rawNama && rawNama.toLowerCase() !== provider.nama_penyedia.trim().toLowerCase()) {
            warningMsg = `Nama di file ("${rawNama}") tidak cocok dengan master data ("${provider.nama_penyedia}"). Data tetap dikaitkan ke Provider ID resmi.`
          }

          // 3. Validasi Kelengkapan Kolom Rekening Wajib
          if (!rawBank || !rawNoRek || !rawPemilik) {
            const missing = []
            if (!rawBank) missing.push('Nama Bank')
            if (!rawNoRek) missing.push('Nomor Rekening')
            if (!rawPemilik) missing.push('Nama Pemilik')
            validated.push({
              index: idx,
              provider_id: rawId,
              nama_penyedia: provider.nama_penyedia,
              jenis_layanan: provider.jenis_layanan,
              bank: rawBank,
              nomor_rekening: rawNoRek,
              nama_pemilik: rawPemilik,
              is_primary: false,
              catatan: rawCatatan || null,
              status: 'INVALID',
              message: `Kolom wajib belum lengkap: ${missing.join(', ')}.`,
              warning: warningMsg,
            })
            return
          }

          const fileKey = `${rawId}|${rawBank.toUpperCase()}|${rawNoRek}`
          const isPrimary = ['YA', 'Y', 'TRUE', '1'].includes(rawUtama)

          // 4. Deteksi Duplikasi terhadap Database Existing
          if (existingDbAccounts.has(fileKey)) {
            validated.push({
              index: idx,
              provider_id: rawId,
              nama_penyedia: provider.nama_penyedia,
              jenis_layanan: provider.jenis_layanan,
              bank: rawBank,
              nomor_rekening: rawNoRek,
              nama_pemilik: rawPemilik,
              is_primary: isPrimary,
              catatan: rawCatatan || null,
              status: 'SKIPPED_DUPLICATE',
              message: 'Rekening identik sudah ada di database. Baris ini akan dilewati (SKIPPED).',
              warning: warningMsg,
            })
            return
          }

          // 5. Deteksi Duplikasi Intra-File
          if (seenInFile.has(fileKey)) {
            validated.push({
              index: idx,
              provider_id: rawId,
              nama_penyedia: provider.nama_penyedia,
              jenis_layanan: provider.jenis_layanan,
              bank: rawBank,
              nomor_rekening: rawNoRek,
              nama_pemilik: rawPemilik,
              is_primary: false,
              catatan: rawCatatan || null,
              status: 'SKIPPED_DUPLICATE',
              message: 'Duplikat dengan baris lain di dalam file yang sama. Baris ini akan dilewati.',
              warning: warningMsg,
            })
            return
          }
          seenInFile.add(fileKey)

          // 6. Baris Baru yang Valid
          validated.push({
            index: idx,
            provider_id: rawId,
            nama_penyedia: provider.nama_penyedia,
            jenis_layanan: provider.jenis_layanan,
            bank: rawBank,
            nomor_rekening: rawNoRek,
            nama_pemilik: rawPemilik,
            is_primary: isPrimary,
            catatan: rawCatatan || null,
            status: 'VALID_NEW',
            warning: warningMsg,
          })
        })

        if (validated.length === 0) {
          throw new Error(
            'Tidak ada data rekening yang diisi pada file Excel. Pastikan Anda telah mengisi Nama Bank, Nomor Rekening, dan Pemilik.'
          )
        }

        setParsedRows(validated)
        setStep(2)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal membaca file Excel.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  // Eksekusi Simpan Impor
  const handleConfirmImport = async () => {
    // Pencegahan Partial Ambiguous Import
    const invalidRows = parsedRows.filter((r) => r.status === 'INVALID')
    if (invalidRows.length > 0) {
      toast.error(
        `Terdapat ${invalidRows.length} baris tidak valid. Perbaiki kesalahan file Excel sebelum melanjutkan untuk mencegah impor parsial yang ambigu.`
      )
      return
    }

    const validNewRows = parsedRows.filter((r) => r.status === 'VALID_NEW')
    if (validNewRows.length === 0) {
      toast.info('Seluruh rekening pada file sudah terdaftar di sistem. Tidak ada rekening baru yang perlu disimpan.')
      return
    }

    startTransition(async () => {
      try {
        const result = await importProviderAccountsAction(parsedRows)
        toast.success(
          `Impor selesai: ${result.insertedCount} rekening baru disimpan, ${result.skippedCount} rekening duplikat dilewati.`
        )
        onSuccess()
        handleClose()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan rekening dari Excel.')
      }
    })
  }

  if (!isOpen) return null

  const validNewCount = parsedRows.filter((r) => r.status === 'VALID_NEW').length
  const skippedDuplicateCount = parsedRows.filter((r) => r.status === 'SKIPPED_DUPLICATE').length
  const invalidCount = parsedRows.filter((r) => r.status === 'INVALID').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <FileXls size={22} weight="duotone" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Import Rekening Penyedia {serviceType ? `(${serviceType === 'Makan' ? 'Katering' : 'Laundry'})` : ''} via Excel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 1
                  ? 'Unduh template resmi dan unggah data rekening penyedia'
                  : `Preview dan validasi hasil impor (${fileName})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Upload & Download Template */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            {/* Box Panduan Unduh Template */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-emerald-600 mt-0.5 shrink-0" weight="fill" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">
                    Langkah 1: Gunakan Template Resmi
                  </h4>
                  <p className="text-xs text-emerald-700/90 mt-0.5">
                    Template sudah terisi otomatis dengan nama dan ID seluruh penyedia katering &
                    laundry yang aktif di sistem.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold shadow-2xs transition shrink-0"
              >
                <DownloadSimple size={15} weight="bold" />
                Unduh Template
              </button>
            </div>

            {/* Area Dropzone Upload */}
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition bg-slate-50/30">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <UploadSimple size={28} weight="duotone" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Pilih atau Tarik File Excel ke Sini
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Format file didukung: <span className="font-semibold text-slate-600">.xlsx</span>.
                Pastikan kolom ID Penyedia tidak diubah.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={isPending}
                className="hidden"
                id="excel-file-input"
              />

              <label
                htmlFor="excel-file-input"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition"
              >
                {isPending ? (
                  <>
                    <ArrowClockwise size={16} className="animate-spin" />
                    Membaca Data Excel...
                  </>
                ) : (
                  <>
                    <FileXls size={16} weight="bold" />
                    Pilih File Excel
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Validation Table */}
        {step === 2 && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Summary Badges Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Hasil Analisis:</span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {validNewCount} Baru (Siap Simpan)
                </span>
                {skippedDuplicateCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    {skippedDuplicateCount} Duplikat (Lewati)
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                    {invalidCount} Error
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setParsedRows([])
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                <ArrowLeft size={13} /> Ganti File
              </button>
            </div>

            {/* Error Banner jika ada baris invalid */}
            {invalidCount > 0 && (
              <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <XCircle size={18} className="shrink-0 text-rose-600" weight="fill" />
                <span>
                  Terdapat <strong>{invalidCount} baris</strong> yang tidak valid. Perbaiki data
                  terlebih dahulu untuk mencegah impor sebagian yang ambigu.
                </span>
              </div>
            )}

            {/* Table Preview */}
            <div className="flex-1 overflow-y-auto min-h-[260px] max-h-[380px] p-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-3">Penyedia</th>
                    <th className="py-2.5 px-3">Bank</th>
                    <th className="py-2.5 px-3">Nomor Rekening</th>
                    <th className="py-2.5 px-3">Nama Pemilik</th>
                    <th className="py-2.5 px-3 text-center">Utama</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/70 transition ${
                        row.status === 'INVALID'
                          ? 'bg-rose-50/30'
                          : row.status === 'SKIPPED_DUPLICATE'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {row.nama_penyedia}
                        </span>
                        <span className="text-[10px] text-slate-400">{row.jenis_layanan}</span>
                        {row.warning && (
                          <span className="text-[10px] text-amber-700 block font-medium mt-0.5" title={row.warning}>
                            ⚠️ {row.warning}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{row.bank || '-'}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        {row.nomor_rekening || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {row.nama_pemilik || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.is_primary ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            YA
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">TIDAK</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.status === 'VALID_NEW' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle size={14} weight="fill" /> Siap Simpan
                          </span>
                        )}
                        {row.status === 'SKIPPED_DUPLICATE' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700" title={row.message}>
                            <WarningCircle size={14} weight="fill" /> Lewati (Duplikat)
                          </span>
                        )}
                        {row.status === 'INVALID' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700" title={row.message}>
                            <XCircle size={14} weight="fill" /> {row.message || 'Error'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Modal Actions */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total Baris:{' '}
                <strong className="text-slate-800">{parsedRows.length} baris</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={validNewCount === 0 || invalidCount > 0 || isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <ArrowClockwise size={15} className="animate-spin" />
                      Menyimpan Rekening...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={15} weight="bold" />
                      Simpan {validNewCount} Rekening Baru
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
