// app/dashboard/keuangan/tarif/kop-tab.tsx
// Tab Pengaturan Kop Dokumen & Cetak Resmi Keuangan

'use client'

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Building, FileText, Eye, FloppyDisk } from '@phosphor-icons/react'
import DocumentLetterhead from '@/components/print/document-letterhead'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import {
  saveLetterheadProfilesAction,
  saveDocumentPrintConfigsAction,
} from './actions'
import type {
  LetterheadProfile,
  DocumentPrintConfig,
  LetterheadMode,
} from '@/lib/print/letterhead'

interface KopTabProps {
  initialProfiles: LetterheadProfile[]
  initialConfigs: DocumentPrintConfig[]
  canMutate: boolean
}

const LOGO_POS_OPTIONS: SelectPickerOption[] = [
  { value: 'left', label: 'Logo Kiri' },
  { value: 'center', label: 'Logo Tengah' },
]

const DOC_MODE_OPTIONS: SelectPickerOption[] = [
  { value: 'default', label: 'Kop Default' },
  { value: 'profile', label: 'Profil Khusus' },
  { value: 'none', label: 'Tanpa Kop' },
]

export default function KopTab({
  initialProfiles,
  initialConfigs,
  canMutate,
}: KopTabProps) {
  const [profiles, setProfiles] = useState<LetterheadProfile[]>(initialProfiles)
  const [configs, setConfigs] = useState<DocumentPrintConfig[]>(initialConfigs)
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialProfiles[0]?.id || 'sukahideng_main'
  )
  const [isSavingProfiles, setIsSavingProfiles] = useState(false)
  const [isSavingConfigs, setIsSavingConfigs] = useState(false)

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0]

  const profileOptions = useMemo<SelectPickerOption[]>(
    () => profiles.map((p) => ({ value: p.id, label: p.name })),
    [profiles]
  )

  const handleProfileChange = <K extends keyof LetterheadProfile>(
    field: K,
    val: LetterheadProfile[K]
  ) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === selectedProfileId ? { ...p, [field]: val } : p))
    )
  }

  const handleSetDefaultProfile = (profileId: string) => {
    setProfiles((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === profileId,
      }))
    )
  }

  const handleDocModeChange = (docKey: string, mode: LetterheadMode) => {
    setConfigs((prev) =>
      prev.map((c) => (c.documentKey === docKey ? { ...c, mode } : c))
    )
  }

  const handleDocProfileChange = (docKey: string, profileId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.documentKey === docKey ? { ...c, profileId } : c))
    )
  }

  const handleSaveProfiles = async () => {
    if (!canMutate) return
    setIsSavingProfiles(true)
    try {
      const res = await saveLetterheadProfilesAction(profiles)
      if (res.success) toast.success('Profil kop surat berhasil disimpan.')
      else toast.error(res.error || 'Gagal menyimpan profil kop surat.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSavingProfiles(false)
    }
  }

  const handleSaveConfigs = async () => {
    if (!canMutate) return
    setIsSavingConfigs(true)
    try {
      const res = await saveDocumentPrintConfigsAction(configs)
      if (res.success) toast.success('Pengaturan kop dokumen berhasil disimpan.')
      else toast.error(res.error || 'Gagal menyimpan pengaturan dokumen.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSavingConfigs(false)
    }
  }

  // Filter kartu santri nonaktif dari tampilan daftar (tetap disimpan di state agar kompatibel dengan DB)
  const visibleConfigs = configs.filter((c) => c.documentKey !== 'card_santri')

  return (
    <div className="space-y-6">
      {/* Bagian 1: Profil Kop Identitas Lembaga */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Profil Kop Identitas Lembaga</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Atur nama instansi resmi, alamat, dan kontak yang tercetak di bagian atas laporan dan kuitansi.
            </p>
          </div>

          {canMutate && (
            <button
              type="button"
              onClick={handleSaveProfiles}
              disabled={isSavingProfiles}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FloppyDisk className="h-4 w-4" aria-hidden="true" />
              <span>{isSavingProfiles ? 'Menyimpan…' : 'Simpan Profil Kop'}</span>
            </button>
          )}
        </div>

        {/* Pilihan Profil */}
        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((p) => {
            const isSelected = p.id === selectedProfileId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfileId(p.id)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{p.name}</span>
                {p.isDefault && (
                  <span className="rounded bg-emerald-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-900">
                    Utama
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Form Profil Terpilih */}
        {activeProfile && (
          <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Nama Profil (Internal)</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.name}
                onChange={(e) => handleProfileChange('name', e.target.value)}
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Nama Lembaga / Instansi (Baris 1)</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.institutionName}
                onChange={(e) => handleProfileChange('institutionName', e.target.value)}
                placeholder="Contoh: Pondok Pesantren Sukahideng"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Subjudul / Unit Lembaga (Opsional)</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.subheading || ''}
                onChange={(e) => handleProfileChange('subheading', e.target.value)}
                placeholder="Contoh: Lembaga Pendidikan & Pengasuhan Pesantren"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Nomor Statistik / NSPP (Opsional)</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.nspp || ''}
                onChange={(e) => handleProfileChange('nspp', e.target.value)}
                placeholder="Nomor Statistik Pesantren (opsional)"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block font-semibold text-slate-700">Alamat Lengkap Pesantren</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.address || ''}
                onChange={(e) => handleProfileChange('address', e.target.value)}
                placeholder="Alamat lengkap instansi / pesantren"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Kontak / Website / Email</label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.contactLine || ''}
                onChange={(e) => handleProfileChange('contactLine', e.target.value)}
                placeholder="Telepon, email, atau situs web"
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Logo Dokumen (URL Publik)</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  disabled={!canMutate}
                  value={activeProfile.logoUrl || ''}
                  onChange={(e) => handleProfileChange('logoUrl', e.target.value)}
                  placeholder="Contoh: /logo.png (kosongkan jika tanpa logo)"
                  className="min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-800 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
                />
                <SelectPicker
                  value={activeProfile.logoPosition || 'left'}
                  options={LOGO_POS_OPTIONS}
                  onChange={(val) => handleProfileChange('logoPosition', val as 'left' | 'center')}
                  disabled={!canMutate}
                  ariaLabel="Posisi logo kop"
                  className="w-full sm:w-36 [&>button]:w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 md:col-span-2">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canMutate}
                  checked={activeProfile.showDivider !== false}
                  onChange={(e) => handleProfileChange('showDivider', e.target.checked)}
                  className="rounded border-slate-300 accent-emerald-700"
                />
                <span className="font-semibold">Tampilkan garis pembatas bawah kop</span>
              </label>

              {canMutate && !activeProfile.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefaultProfile(activeProfile.id)}
                  className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800 cursor-pointer"
                >
                  Jadikan Profil Utama
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Preview Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Pratinjau Hasil Cetak Kop (Siap Cetak Hitam-Putih)</span>
          </div>
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-2xs">
            <DocumentLetterhead profile={activeProfile} mode="default" />
            <div className="rounded border border-dashed border-slate-200 py-4 text-center text-xs italic text-slate-400">
              Area isi laporan atau kuitansi
            </div>
          </div>
        </div>
      </section>

      {/* Bagian 2: Penerapan Kop per Jenis Dokumen */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-700" weight="bold" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Penerapan Kop per Jenis Dokumen</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Tentukan apakah setiap laporan atau kuitansi memakai kop utama, profil khusus, atau tanpa kop.
            </p>
          </div>

          {canMutate && (
            <button
              type="button"
              onClick={handleSaveConfigs}
              disabled={isSavingConfigs}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FloppyDisk className="h-4 w-4" aria-hidden="true" />
              <span>{isSavingConfigs ? 'Menyimpan…' : 'Simpan Pengaturan Dokumen'}</span>
            </button>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 md:hidden">
          {visibleConfigs.map((doc) => (
            <div key={`m-doc-${doc.documentKey}`} className="p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{doc.label}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    doc.mode === 'none'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {doc.mode === 'none' ? 'Tanpa Kop' : 'Kop Aktif'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <SelectPicker
                  value={doc.mode}
                  options={DOC_MODE_OPTIONS}
                  onChange={(val) => handleDocModeChange(doc.documentKey, val as LetterheadMode)}
                  disabled={!canMutate}
                  ariaLabel={`Mode kop ${doc.label}`}
                  className="w-full [&>button]:w-full"
                />
                {doc.mode === 'profile' && (
                  <SelectPicker
                    value={doc.profileId || profiles[0]?.id || ''}
                    options={profileOptions}
                    onChange={(val) => handleDocProfileChange(doc.documentKey, val)}
                    disabled={!canMutate}
                    ariaLabel={`Profil kop ${doc.label}`}
                    className="w-full [&>button]:w-full"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Jenis Dokumen</th>
                <th className="py-3 px-4">Mode Kop</th>
                <th className="py-3 px-4">Profil Khusus</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleConfigs.map((doc) => (
                <tr key={doc.documentKey} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{doc.label}</td>
                  <td className="py-3 px-4">
                    <SelectPicker
                      value={doc.mode}
                      options={DOC_MODE_OPTIONS}
                      onChange={(val) => handleDocModeChange(doc.documentKey, val as LetterheadMode)}
                      disabled={!canMutate}
                      ariaLabel={`Mode kop ${doc.label}`}
                      className="w-44 [&>button]:w-full"
                    />
                  </td>
                  <td className="py-3 px-4">
                    {doc.mode === 'profile' ? (
                      <SelectPicker
                        value={doc.profileId || profiles[0]?.id || ''}
                        options={profileOptions}
                        onChange={(val) => handleDocProfileChange(doc.documentKey, val)}
                        disabled={!canMutate}
                        ariaLabel={`Profil kop ${doc.label}`}
                        className="w-56 [&>button]:w-full"
                      />
                    ) : (
                      <span className="text-slate-400">
                        {doc.mode === 'none' ? 'Tidak memakai kop' : 'Mengikuti kop utama'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {doc.mode === 'none' ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        Tanpa Kop
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Kop Aktif
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
