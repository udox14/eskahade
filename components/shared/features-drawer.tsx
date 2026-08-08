'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  Building,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  HeartPulse,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Award,
  Calendar,
  Layers,
} from 'lucide-react'

const pengurusServices = [
  {
    title: 'Data Induk & Kesantrian',
    description: 'Manajemen biodata santri terpusat, status keaktifan, rekam jejak pembinaan karakter, dan data wali santri.',
    icon: Users,
  },
  {
    title: 'Presensi & Keasramaan',
    description: 'Pemantauan presensi shalat berjamaah, absen malam asrama, perpindahan kamar, dan verifikasi perpulangan santri.',
    icon: Building,
  },
  {
    title: 'Tahfidz & Setoran Hafalan',
    description: 'Pencatatan ziyadah dan murajaah hafalan Al-Qur\'an, rekapitulasi capaian juz, serta laporan penilaian pengawas.',
    icon: BookOpen,
  },
  {
    title: 'Keuangan & SPP Pesantren',
    description: 'Pencatatan tagihan SPP, riwayat transaksi pembayaran, pengeluaran kas, serta integrasi kasir Unit Usaha (UPK).',
    icon: CreditCard,
  },
  {
    title: 'Layanan Poskestren & Uang Jajan',
    description: 'Pencatatan kesehatan santri di Poskestren dan pengawasan saldo uang jajan santri secara terukur.',
    icon: HeartPulse,
  },
  {
    title: 'Pelaporan & Analitik Management',
    description: 'Rekapitulasi otomatis untuk evaluasi pengurus, dewan santri, dan laporan berkala pimpinan pesantren.',
    icon: FileText,
  },
]

const parentPortalServices = [
  {
    title: 'Beranda Ringkasan Santri',
    description: 'Wali santri dapat melihat profil anak, kamar asrama, wali kelas/asrama, dan ringkasan status harian.',
    icon: Home,
  },
  {
    title: 'Monitoring Shalat & Presensi',
    description: 'Informasi kehadiran shalat berjamaah lima waktu dan kedisiplinan absen malam santri di asrama.',
    icon: Calendar,
  },
  {
    title: 'Capaian Hafalan Al-Qur\'an',
    description: 'Wali santri melihat perkembangan setoran ayat, juz yang telah dihafal, dan nilai perkembangan hafalan.',
    icon: Award,
  },
  {
    title: 'Perizinan & Perpulangan',
    description: 'Pantau status izin keluar/pulang santri, tanggal batas kembali, dan riwayat perizinan secara resmi.',
    icon: CheckCircle2,
  },
  {
    title: 'Tagihan & SPP Digital',
    description: 'Transparansi rincian SPP dan pembayaran via QRIS/Transfer dengan konfirmasi dan kuitansi digital.',
    icon: CreditCard,
  },
]

type TabType = 'pengurus' | 'ortu'

export default function FeaturesDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('pengurus')

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#12372a] hover:text-[#247451] transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5 text-[#c9952e]" />
        <span>Detail Fitur & Layanan</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Slide-over Backdrop & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-[#ddd4c3] flex flex-col h-full">
              
              {/* Header */}
              <div className="p-6 border-b border-[#ddd4c3]/50 bg-[#f7f1e5]/60 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#247451] uppercase mb-1">
                    <Layers className="h-4 w-4 text-[#c9952e]" />
                    <span>Modul & Layanan Terpadu</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#12372a]">
                    ESKAHADE Sukahideng
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Sistem Informasi Manajemen Pondok Pesantren Sukahideng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                  aria-label="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-4 bg-[#fffdf8]">
                <div className="flex gap-2 p-1 bg-[#f7f1e5] rounded-xl border border-[#ddd4c3]/40">
                  <button
                    type="button"
                    onClick={() => setActiveTab('pengurus')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                      activeTab === 'pengurus'
                        ? 'bg-[#12372a] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#12372a]'
                    }`}
                  >
                    Portal Pengurus & Guru
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ortu')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                      activeTab === 'ortu'
                        ? 'bg-[#12372a] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#12372a]'
                    }`}
                  >
                    Portal Orang Tua Santri
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fffdf8]">
                {activeTab === 'pengurus' && (
                  <div className="space-y-4 animate-in fade-in-50 duration-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#247451]">
                      Fasilitas Manajemen Pesantren
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {pengurusServices.map((item) => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.title}
                            className="p-4 rounded-xl border border-[#ddd4c3]/50 bg-[#f7f1e5]/30 hover:bg-[#f7f1e5]/70 hover:border-[#247451]/30 transition-all flex gap-3.5"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#12372a] text-[#c9952e] shadow-sm">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-[#12372a]">
                                {item.title}
                              </h4>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'ortu' && (
                  <div className="space-y-4 animate-in fade-in-50 duration-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#247451]">
                      Akses Khusus Wali Santri
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {parentPortalServices.map((item) => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.title}
                            className="p-4 rounded-xl border border-[#ddd4c3]/50 bg-[#f7f1e5]/30 hover:bg-[#f7f1e5]/70 hover:border-[#247451]/30 transition-all flex gap-3.5"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#247451] text-white shadow-sm">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-extrabold text-[#12372a]">
                                {item.title}
                              </h4>
                              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    <div className="p-4 rounded-xl border border-[#247451]/20 bg-[#dcecdf]/40 flex gap-3 items-center">
                      <ShieldCheck className="h-6 w-6 text-[#247451] shrink-0" />
                      <p className="text-xs font-semibold text-[#12372a]">
                        Akses Portal Orang Tua terenkripsi dan dapat dipantau langsung dari HP kapan saja.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#ddd4c3]/50 bg-[#f7f1e5] text-center text-xs font-bold text-slate-500">
                Pondok Pesantren Sukahideng — Sukamanah, Tasikmalaya
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
