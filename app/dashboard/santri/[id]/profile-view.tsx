'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { incidentLabel, sessionLabel } from '@/lib/discipline/format'
import {
  User,
  MapPin,
  School,
  Home,
  BookOpen,
  AlertTriangle,
  Clock,
  CreditCard,
  Wallet,
  Trophy,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Utensils,
  Shirt,
  ArrowLeft,
  Pencil,
} from 'lucide-react'
import { format, isValid } from 'date-fns'
import { id } from 'date-fns/locale'
import { DeleteSantriButton } from './delete-santri-button'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'

// ── Helper: format tanggal aman, tidak crash jika null/invalid ────────────────
function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (!isValid(date)) return '-'
  try {
    return format(date, fmt, { locale: id })
  } catch {
    return '-'
  }
}

function getStatusBadge(status: string | null | undefined) {
  const s = status || 'aktif'
  if (s === 'aktif') {
    return {
      label: 'Aktif',
      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    }
  }
  if (s === 'nonaktif_sementara') {
    return {
      label: 'Nonaktif',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    }
  }
  if (s === 'lulus') {
    return {
      label: 'Lulus',
      className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
    }
  }
  if (s === 'keluar') {
    return {
      label: 'Keluar',
      className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    }
  }
  return {
    label: s.toUpperCase(),
    className: 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20',
  }
}

import type {
  SantriDetail,
  RiwayatAkademikWithNilai,
  RiwayatPerizinanRow,
  RiwayatSPPRow,
  RiwayatTabunganRow,
} from './actions'
import type { DisciplineIncident } from '@/lib/discipline/data'

interface Props {
  santri: SantriDetail
  akademik: RiwayatAkademikWithNilai[]
  pelanggaran: DisciplineIncident[]
  perizinan: RiwayatPerizinanRow[]
  spp: RiwayatSPPRow[]
  tabungan: RiwayatTabunganRow[]
  isReadOnly?: boolean
  isAdmin?: boolean
}

export function SantriProfileView({
  santri,
  akademik,
  pelanggaran,
  perizinan,
  spp,
  tabungan,
  isReadOnly = false,
  isAdmin = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'PROFIL' | 'AKADEMIK' | 'KEUANGAN' | 'DISIPLIN'>('PROFIL')

  const statusBadge = getStatusBadge(santri.status_global as string | undefined)

  return (
    <div className="space-y-4">
      {/* 1. TOP BAR: NAVIGASI BACK & TOMBOL AKSI */}
      <div className="flex items-center justify-between gap-3 px-1">
        <Link
          href="/dashboard/santri"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
          <span>Data Santri</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <Link
              href={`/dashboard/santri/${santri.id}/edit`}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Data</span>
            </Link>
          )}
          {isAdmin && (
            <DeleteSantriButton
              santriId={santri.id}
              nama={santri.nama_lengkap}
              nis={santri.nis}
              compact
            />
          )}
        </div>
      </div>

      {/* 2. UNIFIED COMPACT PROFILE HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-5">
          <div className="flex items-start gap-3.5 sm:gap-5">
            {/* FOTO PROFIL (3:4 Formal Aspect Ratio Frame) */}
            <SantriPhotoAvatar
              src={santri.foto_url as string | null | undefined}
              alt={santri.nama_lengkap}
              name={santri.nama_lengkap}
              size="lg"
            />

            {/* IDENTITAS UTAMA SANTRI */}
            <div className="flex-1 min-w-0">
              {/* Baris 1: Nama Santri + Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">
                  {santri.nama_lengkap}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
                {santri.kategori_efektif === 'BARU' && (
                  <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-500/20">
                    BARU
                  </span>
                )}
                {santri.kategori_santri === 'SADESA' && (
                  <span className="shrink-0 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 ring-1 ring-inset ring-purple-500/20">
                    SADESA
                  </span>
                )}
              </div>

              {/* Baris 2: NIS & NIK */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-slate-500 font-mono">
                <span>NIS: {santri.nis || '-'}</span>
                {Boolean(santri.nik) && (
                  <span className="hidden sm:inline text-slate-400">· NIK: {String(santri.nik)}</span>
                )}
              </div>

              {/* Baris 3: Kamar & Kelas (Ringkas 1 baris) */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {santri.asrama ? `${santri.asrama} · Kmr ${santri.kamar || '-'}` : 'Non-Asrama'}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {santri.info_kelas || '-'}
                    {santri.sekolah ? ` · ${santri.sekolah}` : ''}
                    {santri.kelas_sekolah ? ` (Kls ${santri.kelas_sekolah})` : ''}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION TERPADU */}
        <div className="flex border-t border-slate-100 bg-slate-50/60 px-2 sm:px-4 overflow-x-auto scrollbar-hide">
          <TabButton
            active={activeTab === 'PROFIL'}
            onClick={() => setActiveTab('PROFIL')}
            icon={User}
            label="Biodata"
          />
          <TabButton
            active={activeTab === 'AKADEMIK'}
            onClick={() => setActiveTab('AKADEMIK')}
            icon={BookOpen}
            label="Akademik"
            count={akademik.length}
          />
          <TabButton
            active={activeTab === 'KEUANGAN'}
            onClick={() => setActiveTab('KEUANGAN')}
            icon={CreditCard}
            label="Keuangan"
            count={spp.length + tabungan.length}
          />
          <TabButton
            active={activeTab === 'DISIPLIN'}
            onClick={() => setActiveTab('DISIPLIN')}
            icon={AlertTriangle}
            label="Kedisiplinan"
            count={perizinan.length + pelanggaran.length}
          />
        </div>
      </div>

      {/* 3. KONTEN TABS */}

      {/* ── TAB PROFIL (BIODATA HIGH-DENSITY) ── */}
      {activeTab === 'PROFIL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* SEKSI 1: IDENTITAS PRIBADI */}
          <SectionCard title="Identitas Pribadi" icon={User}>
            <FieldItem label="NIS (Nomor Induk)" value={santri.nis as string} isMono />
            <FieldItem label="NIK" value={santri.nik as string} isMono />
            <FieldItem
              label="Jenis Kelamin"
              value={santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
            />
            <FieldItem
              label="Tempat, Tanggal Lahir"
              value={`${(santri.tempat_lahir as string) || '-'}, ${safeFormat(santri.tanggal_lahir as string, 'dd MMMM yyyy')}`}
            />
            <FieldItem label="Golongan Darah" value={(santri.gol_darah as string) || '-'} />
            <FieldItem
              label="Status Santri"
              badge={
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
              }
            />
            <FieldItem
              label="Kategori Santri"
              value={(santri.kategori_efektif as string) || (santri.kategori_santri as string) || 'REGULER'}
            />
            {santri.kategori_efektif === 'BARU' && (
              <FieldItem
                label="Kategori Pasca Masa Baru"
                value={(santri.kategori_santri as string) || 'REGULER'}
              />
            )}
            <FieldItem
              label="Tanggal Masuk"
              value={safeFormat(santri.tanggal_masuk as string, 'dd MMMM yyyy')}
            />
            {santri.tanggal_keluar ? (
              <FieldItem
                label="Tanggal Keluar"
                value={safeFormat(santri.tanggal_keluar as string, 'dd MMMM yyyy')}
              />
            ) : null}
          </SectionCard>

          {/* SEKSI 2: TEMPAT TINGGAL & FASILITAS PONDOK */}
          <SectionCard title="Tempat Tinggal & Fasilitas Pondok" icon={Home}>
            <FieldItem label="Asrama" value={(santri.asrama as string) || '-'} />
            <FieldItem label="Kamar" value={(santri.kamar as string) || '-'} />
            <FieldItem label="Kelas Diniyah" value={santri.info_kelas || '-'} />
            <FieldItem
              label="Tempat Makan (Katering)"
              value={(santri.nama_tempat_makan as string) || 'Belum diatur'}
              icon={<Utensils className="w-3.5 h-3.5 text-slate-400 inline mr-1" />}
            />
            <FieldItem
              label="Tempat Cuci (Laundry)"
              value={(santri.nama_tempat_mencuci as string) || 'Belum diatur'}
              icon={<Shirt className="w-3.5 h-3.5 text-slate-400 inline mr-1" />}
            />
          </SectionCard>

          {/* SEKSI 3: PENDIDIKAN FORMAL & KELUARGA */}
          <SectionCard title="Pendidikan Formal & Orang Tua" icon={School}>
            {santri.kategori_santri === 'SADESA' ? (
              <div className="col-span-full py-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Sekolah Formal
                </span>
                <span className="text-xs sm:text-sm font-medium text-slate-600 italic">
                  Santri program SADESA (Tanpa sekolah formal)
                </span>
              </div>
            ) : (
              <>
                <FieldItem label="Sekolah Formal" value={(santri.sekolah as string) || '-'} />
                <FieldItem
                  label="Kelas Formal"
                  value={santri.kelas_sekolah ? `Kelas ${santri.kelas_sekolah}` : '-'}
                />
              </>
            )}
            <div className="col-span-full border-t border-slate-100 my-1 pt-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-slate-400" /> Data Orang Tua
              </span>
              <div className="grid grid-cols-2 gap-x-4">
                <FieldItem label="Nama Ayah" value={(santri.nama_ayah as string) || '-'} />
                <FieldItem label="Nama Ibu" value={(santri.nama_ibu as string) || '-'} />
              </div>
            </div>
          </SectionCard>

          {/* SEKSI 4: DOMISILI & ALAMAT */}
          <SectionCard title="Domisili Asal & Alamat" icon={MapPin}>
            <div className="col-span-full py-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Alamat Lengkap
              </span>
              <p className="text-xs sm:text-sm text-slate-800 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                {(santri.alamat_lengkap as string) || (santri.alamat as string) || 'Alamat belum diisi.'}
              </p>
            </div>
            <FieldItem label="Kecamatan" value={(santri.kecamatan as string) || '-'} />
            <FieldItem label="Kab/Kota" value={(santri.kab_kota as string) || '-'} />
            <FieldItem label="Provinsi" value={(santri.provinsi as string) || '-'} />
            {santri.jemaah ? <FieldItem label="Jemaah" value={santri.jemaah as string} /> : null}
          </SectionCard>
        </div>
      )}

      {/* ── TAB AKADEMIK ── */}
      {activeTab === 'AKADEMIK' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {akademik.length === 0 ? (
            <EmptyState text="Belum ada riwayat pendidikan atau nilai akademik tercatat." />
          ) : (
            akademik.map((riwayat) => {
              const kelasNama = riwayat.nama_kelas || 'Kelas'
              const marhalah = riwayat.marhalah_nama || ''
              const tahunAjaran = riwayat.tahun_ajaran_nama || 'Tahun Ajar Aktif'
              const rank = riwayat.ranking_kelas
              const rataRata = riwayat.rata_rata

              // Mapels
              const mapelList = Array.from(
                new Set(riwayat.nilai_detail.map((n) => n.mapel_nama).filter(Boolean))
              )

              return (
                <div
                  key={riwayat.id}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden"
                >
                  {/* Header Kelas */}
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">{kelasNama}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {marhalah ? `${marhalah} · ` : ''}
                        {tahunAjaran}
                      </p>
                    </div>
                    {rank != null && (
                      <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" /> Rank {rank}
                        </span>
                        {rataRata != null && (
                          <span className="text-xs text-slate-500 font-mono">
                            Rata-rata: {rataRata}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tabel Nilai */}
                  {mapelList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm text-left">
                        <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[11px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4">Mata Pelajaran</th>
                            <th className="py-2.5 px-3 w-28 text-center">Semester 1</th>
                            <th className="py-2.5 px-3 w-28 text-center">Semester 2</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mapelList.map((mapelNama) => {
                            const s1 = riwayat.nilai_detail.find(
                              (n) => n.mapel_nama === mapelNama && n.semester === 1
                            )?.nilai
                            const s2 = riwayat.nilai_detail.find(
                              (n) => n.mapel_nama === mapelNama && n.semester === 2
                            )?.nilai
                            return (
                              <tr key={mapelNama} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2 px-4 font-medium text-slate-800">{mapelNama}</td>
                                <td className="py-2 px-3 text-center font-mono text-slate-700">
                                  {s1 ?? '-'}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-700">
                                  {s2 ?? '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs italic">
                      Belum ada rincian nilai di kelas ini.
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── TAB KEUANGAN ── */}
      {activeTab === 'KEUANGAN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* SPP */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Riwayat SPP
              </h3>
              <span className="text-[11px] bg-white text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                {spp.length} Transaksi
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {spp.length === 0 ? (
                <EmptyState text="Belum ada riwayat pembayaran SPP." />
              ) : (
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="bg-slate-50/50 font-semibold text-slate-500 uppercase text-[11px] sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Periode</th>
                      <th className="py-2 px-3 text-right">Nominal</th>
                      <th className="py-2 px-3 text-right">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {spp.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {s.bulan}/{s.tahun}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          Rp {Number(s.nominal_bayar || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-400">
                          {safeFormat(s.tanggal_bayar, 'dd/MM/yy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* TABUNGAN */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-600" /> Mutasi Tabungan
              </h3>
              <span className="text-[11px] bg-white text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                {tabungan.length} Mutasi
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {tabungan.length === 0 ? (
                <EmptyState text="Belum ada transaksi tabungan." />
              ) : (
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="bg-slate-50/50 font-semibold text-slate-500 uppercase text-[11px] sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Keterangan</th>
                      <th className="py-2 px-3 text-right">Nominal</th>
                      <th className="py-2 px-3 text-right">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tabungan.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 flex items-center gap-1.5">
                          {t.jenis === 'MASUK' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[130px] font-medium text-slate-800">
                            {t.keterangan}
                          </span>
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-bold ${
                            t.jenis === 'MASUK' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {t.jenis === 'MASUK' ? '+' : '-'} Rp{' '}
                          {Number(t.nominal || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-400">
                          {safeFormat(t.created_at, 'dd/MM/yy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB KEDISIPLINAN ── */}
      {activeTab === 'DISIPLIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-150">
          {/* PERIZINAN */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" /> Riwayat Izin
              </h3>
              <span className="text-[11px] bg-white text-slate-700 px-2 py-0.5 rounded-full font-bold border border-slate-200">
                {perizinan.length} Izin
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {perizinan.length === 0 ? (
                <EmptyState text="Belum ada riwayat perizinan santri." />
              ) : (
                perizinan.map((p) => (
                  <div key={p.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset ${
                          p.status === 'KEMBALI'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {safeFormat(p.created_at, 'dd MMM yyyy')}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800 text-xs sm:text-sm mb-1">{p.alasan}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Home className="w-3 h-3 text-slate-400" />{' '}
                      {p.jenis === 'PULANG' ? 'Izin Pulang' : 'Izin Keluar'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PELANGGARAN */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Riwayat Pelanggaran
              </h3>
              <span className="text-[11px] bg-white text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-200">
                {pelanggaran.reduce((sum, p) => sum + (p.jumlah_kejadian ?? 0), 0)} Kejadian
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {pelanggaran.length === 0 ? (
                <EmptyState text="Alhamdulillah, tidak ada riwayat pelanggaran." />
              ) : (
                pelanggaran.map((p) => (
                  <div key={p.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded text-[10px] ring-1 ring-inset ring-rose-600/20">
                        {p.perlu_verifikasi ? 'Perlu verifikasi' : `${p.jumlah_kejadian ?? 1} kejadian`}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {safeFormat(p.tanggal, 'dd MMM yyyy')}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800 text-xs sm:text-sm mb-1">{p.deskripsi}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-slate-400" />
                      <span>{incidentLabel(p.jenis)}</span>
                      <span>· {p.source === 'pengajian' ? 'Pengajian' : 'Umum'}</span>
                      {p.sesi && <span>· {sessionLabel(p.sesi, p.jenis, p.source || '')}</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap outline-none ${
        active
          ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs -mb-px'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-600'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-1">{children}</div>
    </div>
  )
}

function FieldItem({
  label,
  value,
  isMono = false,
  badge = null,
  icon = null,
}: {
  label: string
  value?: string | number | null
  isMono?: boolean
  badge?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="py-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
        {label}
      </span>
      {badge ? (
        <div className="mt-0.5">{badge}</div>
      ) : (
        <span
          className={`text-xs sm:text-sm text-slate-800 break-words flex items-center ${
            isMono ? 'font-mono' : 'font-medium'
          }`}
        >
          {icon}
          {value || '-'}
        </span>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-8 text-center text-slate-400 italic text-xs sm:text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      {text}
    </div>
  )
}
