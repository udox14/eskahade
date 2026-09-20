// app/dashboard/keuangan/tarif/kop-tab.tsx
// Tab Pengaturan Kop Dokumen & Cetak Resmi Keuangan
// Mengelola profil kop identitas pesantren dan pemilihan kop per jenis dokumen keuangan.

'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Building,
  FileText,
  Eye,
  FloppyDisk,
} from '@phosphor-icons/react'
import DocumentLetterhead from '@/components/print/document-letterhead'
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

  const activeProfile =
    profiles.find((p) => p.id === selectedProfileId) || profiles[0]

  // Update field pada active profile
  const handleProfileChange = <K extends keyof LetterheadProfile>(
    field: K,
    val: LetterheadProfile[K]
  ) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === selectedProfileId ? { ...p, [field]: val } : p))
    )
  }

  // Set active profile sebagai default
  const handleSetDefaultProfile = (profileId: string) => {
    setProfiles((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === profileId,
      }))
    )
  }

  // Update mode per-dokumen
  const handleDocModeChange = (docKey: string, mode: LetterheadMode) => {
    setConfigs((prev) =>
      prev.map((c) => (c.documentKey === docKey ? { ...c, mode } : c))
    )
  }

  // Update profileId per-dokumen
  const handleDocProfileChange = (docKey: string, profileId: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.documentKey === docKey ? { ...c, profileId } : c))
    )
  }

  // Simpan profil kop ke DB
  const handleSaveProfiles = async () => {
    if (!canMutate) return
    setIsSavingProfiles(true)
    try {
      const res = await saveLetterheadProfilesAction(profiles)
      if (res.success) {
        toast.success('Profil kop surat berhasil disimpan.')
      } else {
        toast.error(res.error || 'Gagal menyimpan profil kop surat.')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSavingProfiles(false)
    }
  }

  // Simpan konfigurasi dokumen ke DB
  const handleSaveConfigs = async () => {
    if (!canMutate) return
    setIsSavingConfigs(true)
    try {
      const res = await saveDocumentPrintConfigsAction(configs)
      if (res.success) {
        toast.success('Pengaturan kop dokumen berhasil disimpan.')
      } else {
        toast.error(res.error || 'Gagal menyimpan pengaturan dokumen.')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSavingConfigs(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── BAGIAN 1: PROFIL KOP IDENTITAS LEMBAGA ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" weight="bold" />
              <h3 className="text-base font-bold text-slate-900">
                Profil Kop Identitas Lembaga
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur nama instansi resmi, unit, alamat, dan kontak yang tercetak di bagian atas laporan dan kuitansi.
            </p>
          </div>

          {canMutate && (
            <button
              type="button"
              onClick={handleSaveProfiles}
              disabled={isSavingProfiles}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <FloppyDisk className="w-4 h-4" />
              <span>{isSavingProfiles ? 'Menyimpan...' : 'Simpan Profil Kop'}</span>
            </button>
          )}
        </div>

        {/* Tab Pilihan Profil */}
        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((p) => {
            const isSelected = p.id === selectedProfileId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfileId(p.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{p.name}</span>
                {p.isDefault && (
                  <span className="px-1.5 py-0.2 text-[9px] bg-emerald-200/70 text-emerald-900 rounded font-black uppercase">
                    Default
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Form Edit Profil Terpilih */}
        {activeProfile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Profil (Internal)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.name}
                onChange={(e) => handleProfileChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Lembaga / Instansi (Kop Baris 1)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.institutionName}
                onChange={(e) => handleProfileChange('institutionName', e.target.value)}
                placeholder="Contoh: Pondok Pesantren Sukahideng"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Subjudul / Unit Lembaga (Opsional)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.subheading || ''}
                onChange={(e) => handleProfileChange('subheading', e.target.value)}
                placeholder="Contoh: Lembaga Pendidikan & Pengasuhan Pesantren Terpadu"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Statistik / NSPP (Opsional)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.nspp || ''}
                onChange={(e) => handleProfileChange('nspp', e.target.value)}
                placeholder="Nomor Statistik Pesantren (opsional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Alamat Lengkap Pesantren
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.address || ''}
                onChange={(e) => handleProfileChange('address', e.target.value)}
                placeholder="Alamat lengkap instansi / pesantren (opsional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Baris Kontak / Website / Email
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={activeProfile.contactLine || ''}
                onChange={(e) => handleProfileChange('contactLine', e.target.value)}
                placeholder="Kontak, telepon, email, atau website (opsional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Logo Dokumen (URL Publik)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled={!canMutate}
                  value={activeProfile.logoUrl || ''}
                  onChange={(e) => handleProfileChange('logoUrl', e.target.value)}
                  placeholder="Contoh: /logo.png (kosongkan jika tanpa logo)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                />
                <select
                  disabled={!canMutate}
                  value={activeProfile.logoPosition || 'left'}
                  onChange={(e) =>
                    handleProfileChange(
                      'logoPosition',
                      e.target.value as 'left' | 'center'
                    )
                  }
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white"
                >
                  <option value="left">Kiri</option>
                  <option value="center">Tengah</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canMutate}
                  checked={activeProfile.showDivider !== false}
                  onChange={(e) => handleProfileChange('showDivider', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold">Tampilkan Garis Pembatas Kop (Divider Line)</span>
              </label>

              {canMutate && !activeProfile.isDefault && (
                <button
                  type="button"
                  onClick={() => handleSetDefaultProfile(activeProfile.id)}
                  className="text-emerald-700 hover:text-emerald-800 font-bold underline text-xs"
                >
                  Jadikan Profil Default Utama
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Preview Box */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500 mb-3 text-xs font-semibold">
            <Eye className="w-4 h-4" />
            <span>Pratinjau Hasil Cetak Kop (Hitam-Putih Friendly):</span>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-300 shadow-2xs">
            <DocumentLetterhead profile={activeProfile} mode="default" />
            <div className="text-center py-4 border border-dashed border-slate-200 rounded text-slate-400 text-xs italic">
              [ Konten laporan / slip dokumen akan ditampilkan di area ini ]
            </div>
          </div>
        </div>
      </div>

      {/* ── BAGIAN 2: PENGATURAN KOP PER JENIS DOKUMEN ────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" weight="bold" />
              <h3 className="text-base font-bold text-slate-900">
                Penerapan Kop per Jenis Dokumen
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan apakah setiap laporan atau kuitansi menggunakan kop default, profil khusus, atau dicetak tanpa kop.
            </p>
          </div>

          {canMutate && (
            <button
              type="button"
              onClick={handleSaveConfigs}
              disabled={isSavingConfigs}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <FloppyDisk className="w-4 h-4" />
              <span>{isSavingConfigs ? 'Menyimpan...' : 'Simpan Pengaturan Dokumen'}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">Jenis Dokumen</th>
                <th className="py-2.5 px-3">Pilihan Mode Kop</th>
                <th className="py-2.5 px-3">Profil Spesifik</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map((doc) => {
                const isCard = doc.documentKey === 'card_santri'
                return (
                  <tr key={doc.documentKey} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      <div>{doc.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {doc.documentKey}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <select
                        disabled={!canMutate || isCard}
                        value={doc.mode}
                        onChange={(e) =>
                          handleDocModeChange(doc.documentKey, e.target.value as LetterheadMode)
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="default">Kop Default</option>
                        <option value="profile">Profil Tertentu</option>
                        <option value="none">Tanpa Kop (None)</option>
                      </select>
                    </td>

                    <td className="py-3 px-3">
                      {doc.mode === 'profile' ? (
                        <select
                          disabled={!canMutate}
                          value={doc.profileId || profiles[0]?.id || ''}
                          onChange={(e) =>
                            handleDocProfileChange(doc.documentKey, e.target.value)
                          }
                          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white"
                        >
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400 italic">
                          {doc.mode === 'none' ? 'Tidak memakai profil' : 'Mengikuti kop default'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {doc.mode === 'none' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          Tanpa Kop
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Kop Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
