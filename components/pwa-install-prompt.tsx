'use client';

import React, { useState, useEffect } from 'react';
import { 
  DownloadSimple, 
  X, 
  DeviceMobile, 
  Lightning, 
  ShieldCheck, 
  CornersOut, 
  Export as ShareIcon, 
  PlusSquare, 
  Info, 
  CheckCircle 
} from '@phosphor-icons/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const SNOOZE_DAYS = 3;
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
const DISMISSED_KEY = 'pwa_install_dismissed_at';
const INSTALLED_KEY = 'pwa_installed';

export function PwaInstallPrompt() {
  const [isMounted, setIsMounted] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // 1. Cek apakah sudah dalam mode Standalone (PWA terinstall)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return;
    }

    // 2. Cek status install & snooze dari localStorage
    const installed = localStorage.getItem(INSTALLED_KEY) === 'true';
    if (installed) {
      setIsInstalled(true);
      return;
    }

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const timePassed = Date.now() - parseInt(dismissedAt, 10);
      if (timePassed < SNOOZE_MS) {
        setIsSnoozed(true);
      } else {
        setIsSnoozed(false);
      }
    } else {
      setIsSnoozed(false);
    }

    // 3. Cek apakah perangkat iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    // 4. Tangkap event beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setIsSnoozed(true);
    setShowModal(false);
  };

  const handleInstallClick = async () => {
    if (isIos) {
      setShowModal(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem(INSTALLED_KEY, 'true');
          setIsInstalled(true);
        } else {
          handleDismiss();
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA install error:', err);
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  // Jangan render di server atau jika sudah standalone / installed / snoozed
  if (!isMounted || isStandalone || isInstalled || isSnoozed) {
    return null;
  }

  return (
    <>
      {/* Widget Floating Ringkas (Compact Floating Badge) */}
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="group relative flex items-center gap-2.5 rounded-full border border-emerald-600/30 bg-slate-900/90 p-1.5 pr-2.5 shadow-xl backdrop-blur-md transition-all hover:bg-slate-900 dark:bg-emerald-950/90 dark:border-emerald-500/40">
          
          {/* Tombol Utama pasang & info */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 pl-1.5 text-left transition-transform active:scale-95 cursor-pointer"
            title="Lihat Manfaat & Install Aplikasi"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
              <DownloadSimple className="h-4 w-4 animate-bounce" weight="bold" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold leading-tight text-white">
                Install ESKAHADE
              </span>
              <span className="text-[10px] font-medium leading-tight text-emerald-400">
                Aplikasi Instan & Cepat
              </span>
            </div>
          </button>

          <div className="h-5 w-[1px] bg-slate-700/60 dark:bg-emerald-800/60" />

          {/* Action Install Cepat */}
          <button
            onClick={handleInstallClick}
            className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            Pasang
          </button>

          {/* Tombol Close (Snooze 3 Hari) */}
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Tutup (Muncul lagi 3 hari kemudian)"
          >
            <X className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>
      </div>

      {/* Modal / Dialog Manfaat Install */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="relative bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 p-5 text-white">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
                  <DeviceMobile className="h-6 w-6 text-emerald-300" weight="duotone" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Install Aplikasi ESKAHADE</h3>
                  <p className="text-xs text-emerald-200/90 mt-0.5">Pengalaman Akses Sistem Pesantren Lebih Baik</p>
                </div>
              </div>
            </div>

            {/* Content: Manfaat Install (Tanpa Emoji, Menggunakan Icon Phosphor) */}
            <div className="p-5 space-y-3.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Dapatkan kemudahan dan performa terbaik dengan menginstal ESKAHADE langsung di perangkat Anda:
              </p>

              <div className="space-y-2.5">
                {/* Point 1 */}
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                    <Lightning className="h-4 w-4" weight="bold" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Akses Cepat 1-Ketuk</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Buka aplikasi instan dari Layar Utama (Home Screen) tanpa perlu mengetik URL di peramban web.
                    </p>
                  </div>
                </div>

                {/* Point 2 */}
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400">
                    <ShieldCheck className="h-4 w-4" weight="bold" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Navigasi Praktis & Stabil</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Akses fitur sistem pesantren lebih lancar dengan antarmuka yang lebih fokus dan responsif.
                    </p>
                  </div>
                </div>

                {/* Point 3 */}
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400">
                    <CornersOut className="h-4 w-4" weight="bold" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Tampilan Penuh Layar</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Pengalaman penggunaan aplikasi native tanpa terganggu oleh bilah alamat peramban.
                    </p>
                  </div>
                </div>
              </div>

              {/* Petunjuk Khusus iOS (Safari) */}
              {isIos && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" weight="bold" />
                    Panduan Pemasangan di iPhone / iPad (Safari):
                  </div>
                  <ol className="list-decimal list-inside text-[11px] space-y-1 text-amber-800 dark:text-amber-300">
                    <li>Ketuk tombol <span className="font-semibold">Bagikan (Share)</span> <ShareIcon className="inline h-3.5 w-3.5 mb-0.5 text-amber-700 dark:text-amber-300" weight="bold" /> di bagian bawah peramban Safari.</li>
                    <li>Geser ke bawah dan pilih menu <span className="font-semibold font-mono bg-amber-200/60 dark:bg-amber-900/60 px-1 py-0.5 rounded">'Tambahkan ke Layar Utama'</span> (<PlusSquare className="inline h-3.5 w-3.5 mb-0.5 text-amber-700 dark:text-amber-300" weight="bold" /> Add to Home Screen).</li>
                    <li>Ketuk <span className="font-semibold">Tambah</span> di pojok kanan atas.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Nanti Saja (Tutup 3 Hari)
              </button>
              
              {!isIos && (
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    handleInstallClick();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-95 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" weight="bold" />
                  Install Sekarang
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
