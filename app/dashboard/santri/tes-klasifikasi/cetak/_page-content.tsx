'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardList, FileText, LayoutList, Loader2, Printer, Users, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useReactToPrint } from '@/lib/pdf/client'
import { TesKlasifikasiTabs } from '../_tabs'
import { getPenjadwalanData, getCetakJadwalData, getCetakBelumDitesData, getCetakNahwuData } from '../penjadwalan/actions'

type View = 'menu' | 'jadwal' | 'blanko-absensi' | 'blanko-penilaian' | 'belum-dites' | 'nahwu' | 'absensi-nahwu'
type PrintMode = 'all' | 'sesi' | 'ruangan' | 'asrama'

const MENU_ITEMS: { view: View; label: string; desc: string; icon: React.ElementType; ready: boolean }[] = [
  { view: 'jadwal', label: 'Jadwal Peserta', desc: 'Cetak jadwal tes klasifikasi semua peserta, per sesi, atau per ruangan.', icon: LayoutList, ready: true },
  { view: 'blanko-absensi', label: 'Blanko Absensi', desc: 'Lembar daftar hadir peserta tes klasifikasi per sesi dan ruangan.', icon: ClipboardList, ready: true },
  { view: 'blanko-penilaian', label: 'Blanko Penilaian', desc: 'Lembar penilaian tes klasifikasi per peserta.', icon: FileText, ready: true },
  { view: 'belum-dites', label: 'Belum Dites', desc: 'Cetak daftar santri yang belum dites klasifikasi.', icon: Users, ready: true },
  { view: 'nahwu', label: 'Tes Nahwu', desc: 'Cetak daftar santri rekomendasi tes nahwu lanjutan.', icon: BookOpen, ready: true },
  { view: 'absensi-nahwu', label: 'Absensi Nahwu', desc: 'Lembar daftar hadir tes nahwu lanjutan.', icon: ClipboardList, ready: true },
]

function formatDate(date: string) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatTime(row: { waktu_mulai?: string | null; waktu_selesai?: string | null }) {
  return `${row.waktu_mulai || '-'} - ${row.waktu_selesai || '-'}`
}

function formatSekolah(sekolah: string | null | undefined) {
  const value = String(sekolah || '').toUpperCase().trim()
  const map: Record<string, string> = {
    MTSU: 'MTs',
    MTSN: 'MTsN',
    SMP: 'SMP',
    MAN: 'MAN',
    SMA: 'SMA',
    SMK: 'SMK',
  }
  return map[value] || value || '-'
}

function formatNama(nama: string | null | undefined) {
  if (!nama) return ''
  return String(nama).replace(/\b(muhammad|muhamad|mohammad|mohamad|muchammad|muchamad|mohammed|mochammad|mochamad)\b/ig, 'M.')
}

function formatHariTanggal(date: string | null | undefined) {
  if (!date) return ''
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`)).toUpperCase()
}

function getTahunCetak(event: any) {
  const years = String(event?.tahun_ajaran_nama || '').match(/\d{4}/g)
  return years?.[years.length - 1] || String(new Date().getFullYear())
}

function upperOrBlank(value: unknown, blank: boolean) {
  if (blank) return ''
  return String(value || '').toUpperCase()
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks.length ? chunks : [[]]
}



function PrintSheet({ event, rows, mode, selectedSesi, selectedRuangan, selectedAsrama, preview }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string; selectedAsrama: string; preview?: boolean }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
    if (mode === 'ruangan' && selectedRuangan) return String(row.ruangan_id) === selectedRuangan
    if (mode === 'asrama' && selectedAsrama) return String(row.asrama || '') === selectedAsrama
    return true
  })
  const groupsMap = new Map<string, any[]>()
  filtered.forEach(row => {
    const key = `${row.tanggal}|${row.sesi_id}|${row.ruangan_id}`
    groupsMap.set(key, [...(groupsMap.get(key) || []), row])
  })
  const groups = Array.from(groupsMap.values())
  const allPages = groups.flatMap(items => chunkRows(items, 45).map((chunk, chunkIndex) => ({ chunk, chunkIndex })))
  const totalPages = allPages.length
  const displayPages = preview ? allPages.slice(0, 2) : allPages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map(({ chunk, chunkIndex }, pageIndex) => {
        const first = chunk[0]
        return (
          <div
            key={`${first.sesi_id}-${first.ruangan_id}-${pageIndex}`}
            style={{
              width: '210mm',
              minHeight: '330mm',
              padding: '8mm',
              boxSizing: 'border-box',
              fontFamily: '"Arial Narrow", Arial, sans-serif',
              fontSize: '11pt',
              color: '#000',
              background: '#fff',
              breakAfter: 'page',
              boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none',
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              JADWAL PESERTA TES KLASIFIKASI TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4mm', fontSize: '11pt' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
                <div><b>Tanggal</b></div><div>:</div><div>{formatDate(first.tanggal)}</div>
                <div><b>Ruangan</b></div><div>:</div><div>{first.nama_ruangan}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
                <div><b>Waktu</b></div><div>:</div><div>{formatTime(first)}</div>
                <div><b>Tempat</b></div><div>:</div><div>{first.tempat || '-'}</div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5pt' }}>
              <colgroup>
                <col style={{ width: '12mm' }} />
                <col />
                <col style={{ width: '40mm' }} />
                <col style={{ width: '25mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'NAMA LENGKAP', 'ASRAMA/KAMAR', 'SEKOLAH'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunk.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{chunkIndex * 45 + index + 1}</td>
                    <td style={{ ...printTd, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatNama(row.nama_lengkap)}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{formatSekolah(row.sekolah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function BelumDitesSheet({ event, rows, mode, selectedAsrama, preview }: { event: any; rows: any[]; mode: PrintMode; selectedAsrama: string; preview?: boolean }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'asrama' && selectedAsrama) return String(row.asrama || '') === selectedAsrama
    return true
  })
  const allPages = chunkRows(filtered, 45).map((chunk, chunkIndex) => ({ chunk, chunkIndex }))
  const totalPages = allPages.length
  const displayPages = preview ? allPages.slice(0, 2) : allPages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map(({ chunk, chunkIndex }, pageIndex) => (
          <div
            key={`belum-dites-${pageIndex}`}
            style={{
              width: '210mm',
              minHeight: '330mm',
              padding: '8mm',
              boxSizing: 'border-box',
              fontFamily: '"Arial Narrow", Arial, sans-serif',
              fontSize: '11pt',
              color: '#000',
              background: '#fff',
              breakAfter: 'page',
              boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none',
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              DAFTAR SANTRI BELUM DITES KLASIFIKASI TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5pt' }}>
              <colgroup>
                <col style={{ width: '12mm' }} />
                <col />
                <col style={{ width: '40mm' }} />
                <col style={{ width: '25mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'NAMA LENGKAP', 'ASRAMA/KAMAR', 'SEKOLAH'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunk.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{chunkIndex * 45 + index + 1}</td>
                    <td style={{ ...printTd, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatNama(row.nama_lengkap)}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{formatSekolah(row.sekolah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      ))}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function NahwuSheet({ event, rows, mode, selectedAsrama, preview }: { event: any; rows: any[]; mode: PrintMode; selectedAsrama: string; preview?: boolean }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'asrama' && selectedAsrama) return String(row.asrama || '') === selectedAsrama
    return true
  })
  const allPages = chunkRows(filtered, 45).map((chunk, chunkIndex) => ({ chunk, chunkIndex }))
  const totalPages = allPages.length
  const displayPages = preview ? allPages.slice(0, 2) : allPages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map(({ chunk, chunkIndex }, pageIndex) => (
          <div
            key={`nahwu-${pageIndex}`}
            style={{
              width: '210mm',
              minHeight: '330mm',
              padding: '8mm',
              boxSizing: 'border-box',
              fontFamily: '"Arial Narrow", Arial, sans-serif',
              fontSize: '11pt',
              color: '#000',
              background: '#fff',
              breakAfter: 'page',
              boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none',
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              DAFTAR SANTRI REKOMENDASI TES NAHWU LANJUTAN TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5pt' }}>
              <colgroup>
                <col style={{ width: '12mm' }} />
                <col />
                <col style={{ width: '40mm' }} />
                <col style={{ width: '25mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'NAMA LENGKAP', 'ASRAMA/KAMAR', 'SEKOLAH'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunk.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{chunkIndex * 45 + index + 1}</td>
                    <td style={{ ...printTd, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatNama(row.nama_lengkap)}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={{ ...printTd, textAlign: 'center' }}>{formatSekolah(row.sekolah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      ))}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function AbsensiNahwuSheet({ event, rows, mode, selectedAsrama, preview }: { event: any; rows: any[]; mode: PrintMode; selectedAsrama: string; preview?: boolean }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'asrama' && selectedAsrama) return String(row.asrama || '') === selectedAsrama
    return true
  })
  
  const allPages = chunkRows(filtered, 45).map((chunk, chunkIndex) => {
    const padded = [...chunk]
    while (padded.length < 45) padded.push(null)
    return { chunkIndex, padded }
  })

  const totalPages = allPages.length
  const displayPages = preview ? allPages.slice(0, 2) : allPages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map(({ chunkIndex, padded }) => (
        <div key={`absensi-nahwu-${chunkIndex}`} style={{ ...absensiPageStyle, boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none' }}>
          <div style={absensiTitleStyle}>DAFTAR HADIR TES NAHWU LANJUTAN</div>
          <div style={absensiSubtitleStyle}>TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4mm', fontSize: '11pt' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
              <div><b>Tanggal</b></div><div>:</div><div>.............................................</div>
              <div><b>Ruangan</b></div><div>:</div><div>.............................................</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
              <div><b>Sesi/Waktu</b></div><div>:</div><div>.............................................</div>
              <div><b>Tempat</b></div><div>:</div><div>.............................................</div>
            </div>
          </div>

          <table style={absensiTableStyle}>
            <colgroup>
              <col style={{ width: '11mm' }} />
              <col />
              <col style={{ width: '31mm' }} />
              <col style={{ width: '20mm' }} />
              <col style={{ width: '32mm' }} />
              <col style={{ width: '32mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={absensiThStyle}>NO</th>
                <th style={absensiThStyle}>NAMA LENGKAP</th>
                <th style={absensiThStyle}>ASRAMA</th>
                <th style={absensiThStyle}>SEKOLAH</th>
                <th style={absensiThStyle} colSpan={2}>TANDA TANGAN</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((row, index) => (
                <tr key={row?.id || `blank-${index}`}>
                  <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{chunkIndex * 45 + index + 1}</td>
                  <td style={{ ...absensiTdStyle, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatNama(row?.nama_lengkap)}</td>
                  <td style={absensiTdStyle}>{row ? `${row.asrama || '-'}/${row.kamar || '-'}` : ''}</td>
                  <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{row ? formatSekolah(row.sekolah) : ''}</td>
                  {index % 2 === 0 ? (
                    <>
                      <td rowSpan={2} style={signatureTdStyle}>
                        <span style={signatureNumberStyle}>{chunkIndex * 45 + index + 1}</span>
                      </td>
                      <td rowSpan={2} style={signatureTdStyle}>
                        {index < 44 && <span style={signatureNumberStyle}>{chunkIndex * 45 + index + 2}</span>}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function AbsensiSheet({ event, rows, mode, selectedSesi, selectedRuangan, preview }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string; preview?: boolean }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
    if (mode === 'ruangan' && selectedRuangan) return String(row.ruangan_id) === selectedRuangan
    return true
  })
  const groupsMap = new Map<string, any[]>()
  filtered.forEach(row => {
    const key = `${row.tanggal}|${row.sesi_id}|${row.ruangan_id}`
    groupsMap.set(key, [...(groupsMap.get(key) || []), row])
  })

  const allPages = Array.from(groupsMap.values()).flatMap(items => {
    const first = items[0]
    return chunkRows(items, 45).map((chunk, chunkIndex) => {
      const padded = [...chunk]
      while (padded.length < 45) padded.push(null)
      return { first, chunkIndex, padded }
    })
  })

  const totalPages = allPages.length
  const displayPages = preview ? allPages.slice(0, 2) : allPages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map(({ first, chunkIndex, padded }) => (
        <div key={`${first.sesi_id}-${first.ruangan_id}-${chunkIndex}`} style={{ ...absensiPageStyle, boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none' }}>
          <div style={absensiTitleStyle}>DAFTAR HADIR PESERTA TES KLASIFIKASI</div>
          <div style={absensiSubtitleStyle}>TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4mm', fontSize: '11pt' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
              <div><b>Tanggal</b></div><div>:</div><div>{formatDate(first.tanggal)}</div>
              <div><b>Ruangan</b></div><div>:</div><div>{first.nama_ruangan}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '1mm 2mm' }}>
              <div><b>Sesi/Waktu</b></div><div>:</div><div>{first.sesi_label || `Sesi ${first.nomor_sesi}`} ({formatTime(first)})</div>
              <div><b>Tempat</b></div><div>:</div><div>{first.tempat || '-'}</div>
            </div>
          </div>

          <table style={absensiTableStyle}>
            <colgroup>
              <col style={{ width: '11mm' }} />
              <col />
              <col style={{ width: '31mm' }} />
              <col style={{ width: '20mm' }} />
              <col style={{ width: '32mm' }} />
              <col style={{ width: '32mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={absensiThStyle}>NO</th>
                <th style={absensiThStyle}>NAMA LENGKAP</th>
                <th style={absensiThStyle}>ASRAMA</th>
                <th style={absensiThStyle}>SEKOLAH</th>
                <th style={absensiThStyle} colSpan={2}>TANDA TANGAN</th>
              </tr>
            </thead>
            <tbody>
              {padded.map((row, index) => (
                <tr key={row?.id || `blank-${index}`}>
                  <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{chunkIndex * 45 + index + 1}</td>
                  <td style={{ ...absensiTdStyle, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatNama(row?.nama_lengkap)}</td>
                  <td style={absensiTdStyle}>{row ? `${row.asrama || '-'}/${row.kamar || '-'}` : ''}</td>
                  <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{row ? formatSekolah(row.sekolah) : ''}</td>
                  {index % 2 === 0 ? (
                    <>
                      <td rowSpan={2} style={signatureTdStyle}>
                        <span style={signatureNumberStyle}>{chunkIndex * 45 + index + 1}</span>
                      </td>
                      <td rowSpan={2} style={signatureTdStyle}>
                        {index < 44 && <span style={signatureNumberStyle}>{chunkIndex * 45 + index + 2}</span>}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function PenilaianSheet({
  event,
  rows,
  mode,
  selectedSesi,
  selectedRuangan,
  selectedAsrama,
  blankOnly,
  blankCount,
  preview,
}: {
  event: any
  rows: any[]
  mode: PrintMode
  selectedSesi: string
  selectedRuangan: string
  selectedAsrama: string
  blankOnly: boolean
  blankCount: number
  preview?: boolean
}) {
  if (!event && !blankOnly) return null
  const filtered = blankOnly
    ? Array.from({ length: Math.max(1, blankCount) }, (_, index) => ({ id: `kosong-${index}`, __blank: true }))
    : rows.filter(row => {
        if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
        if (mode === 'asrama' && selectedAsrama) return String(row.asrama || '') === selectedAsrama
        return true
      })
  const pages = chunkRows(filtered, 2)
  const totalPages = pages.length
  const displayPages = preview ? pages.slice(0, 2) : pages

  return (
    <div className={preview ? "flex flex-col items-center gap-6" : ""}>
      {displayPages.map((items, pageIndex) => (
        <div key={`penilaian-page-${pageIndex}`} style={{ ...penilaianPageStyle, boxShadow: preview ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none' }}>
          {[0, 1].map(slot => {
            const row = items[slot] || { id: `empty-${pageIndex}-${slot}`, __blank: true }
            return <PenilaianBlanko key={`${row.id}-${slot}`} event={event} row={row} blank={blankOnly || row.__blank} />
          })}
        </div>
      ))}
      {preview && totalPages > 2 && (
        <div className="py-4 text-center text-sm font-bold text-slate-500">
          Menampilkan 2 dari {totalPages} halaman. Silakan cetak untuk melihat seluruh data.
        </div>
      )}
    </div>
  )
}

function PenilaianBlanko({ event, row, blank }: { event: any; row: any; blank: boolean }) {
  const asramaKamar = blank ? '' : `${row.asrama || '-'}/${row.kamar || '-'}`
  const sekolah = blank ? '' : formatSekolah(row.sekolah)
  const tahunCetak = getTahunCetak(event)

  return (
    <div style={penilaianBlankoStyle}>
      <div style={penilaianTopBoxStyle}>
        <div style={penilaianHeaderTitleStyle}>PANITIA PSB BIDANG KLASIFIKASI SANTRI BARU</div>
        <div style={penilaianHeaderTitleStyle}>LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG</div>
        <div style={penilaianSectionTitleStyle}>INFO TEST KLASIFIKASI</div>
        <table style={penilaianTableStyle}>
          <thead>
            <tr>
              {['HARI, TANGGAL', 'SESI', 'NO URUT', 'TEMPAT', 'DEWAN PENGUJI'].map(label => (
                <th key={label} style={penilaianInfoThStyle}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={penilaianInfoTdStyle}>{upperOrBlank(formatHariTanggal(row.tanggal), blank)}</td>
              <td style={penilaianInfoTdCenterStyle}>{blank ? '' : row.nomor_sesi}</td>
              <td style={penilaianInfoTdCenterStyle}>{blank ? '' : row.nomor_urut}</td>
              <td style={penilaianInfoTdCenterStyle}>{upperOrBlank(row.tempat || row.nama_ruangan, blank)}</td>
              <td style={penilaianInfoTdCenterStyle}>{upperOrBlank(row.pengetes_nama, blank)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={penilaianIdentityBoxStyle}>
        <div style={penilaianSectionTitleStyle}>IDENTITAS SANTRI</div>
        <table style={penilaianTableStyle}>
          <tbody>
            {[
              ['NAMA', upperOrBlank(formatNama(row.nama_lengkap), blank)],
              ['NO INDUK', blank ? '' : row.nis || ''],
              ['ASRAMA / KMR', upperOrBlank(asramaKamar, blank)],
              ['SEKOLAH', upperOrBlank(sekolah, blank)],
              ['ALAMAT', upperOrBlank(row.alamat, blank)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={penilaianIdentityLabelStyle}>{label}</td>
                <td style={penilaianIdentityValueStyle}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={penilaianAssessmentBoxStyle}>
        <div style={penilaianSectionTitleStyle}>LEMBAR PENGETESAN</div>
        <div style={penilaianBoldLineStyle}>TES TULIS AL-QUR'AN <span style={penilaianColonStyle}>:</span></div>
        <div style={penilaianWriteLinesStyle}>
          <div style={penilaianWrittenLineStyle} />
          <div style={penilaianWrittenLineStyle} />
          <div style={penilaianWrittenLineStyle} />
          <div style={penilaianWrittenLineStyle} />
        </div>
        <div style={penilaianCheckRowStyle}>
          <CheckLabel label="BAIK" />
          <CheckLabel label="KURANG" />
          <CheckLabel label="TIDAK BISA" />
        </div>
        <div style={penilaianBoldLineStyle}>TES BACA AL- QUR'AN <span style={penilaianColonStyle}>:</span></div>
        <div style={penilaianChoiceLineStyle}>
          <span style={penilaianChoiceTitleStyle}>KELANCARAN</span><span>:</span>
          <CheckLabel label="LANCAR" />
          <CheckLabel label="TIDAK LANCAR" />
          <CheckLabel label="TIDAK BISA" />
        </div>
        <div style={penilaianChoiceLineStyle}>
          <span style={penilaianChoiceTitleStyle}>TAJWID</span><span>:</span>
          <CheckLabel label="BAIK" />
          <CheckLabel label="KURANG" />
          <CheckLabel label="TIDAK BISA" />
        </div>
        <div style={penilaianHafalanLineStyle}>
          <span style={penilaianChoiceTitleStyle}>HAFALAN</span><span>:</span>
          <span style={penilaianLongLineStyle} />
        </div>
      </div>

      <div style={penilaianNahwuBoxStyle}>
        <div style={penilaianBoldLineStyle}>SUDAH BELAJAR ILMU NAHWU (AL-AJURUMIYAH DSB) <i>opsional</i></div>
        <div style={penilaianCheckRowStyle}>
          <CheckLabel label="SUDAH" />
          <CheckLabel label="BELUM" />
          <CheckLabel label="__________" />
        </div>
      </div>

      <div style={penilaianFooterStyle}>
        <div style={penilaianMarhalahStyle}>
          <div style={{ textAlign: 'center', fontWeight: 700 }}>MARHALAH / KELAS <i>(DIISI OLEH PANITIA)</i></div>
          <div style={penilaianFooterOptionsStyle}>
            <CheckLabel label="TMH" />
            <CheckLabel label="IBT 1" />
            <span style={penilaianVerticalRuleStyle} />
            <span>GRADE</span>
            <span style={penilaianGradeBoxStyle} />
          </div>
          <div style={penilaianFooterOptionsStyle}>
            <CheckLabel label="REKOMENDASI TES NAHWU" />
          </div>
        </div>
        <div style={penilaianSignatureBoxStyle}>
          <div>Sukahideng, ____ Juli {tahunCetak}</div>
          <div>Penguji,</div>
        </div>
      </div>
    </div>
  )
}

function CheckLabel({ label }: { label: string }) {
  return (
    <span style={penilaianCheckLabelStyle}>
      <span style={penilaianCheckBoxStyle} />
      <span>{label}</span>
    </span>
  )
}

const printTh: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1mm',
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.1,
}

const printTd: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '0.8mm 1mm',
  verticalAlign: 'middle',
  lineHeight: 1.1,
}

const absensiPageStyle: React.CSSProperties = {
  width: '210mm',
  height: '330mm',
  padding: '8mm 10mm 8mm 20mm',
  boxSizing: 'border-box',
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#fff',
  color: '#000',
  overflow: 'hidden',
  breakAfter: 'page',
}

const absensiTitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '15pt',
  fontWeight: 700,
  lineHeight: 1,
  marginTop: '2mm',
}

const absensiSubtitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '12pt',
  fontWeight: 700,
  lineHeight: 1,
  marginTop: '2mm',
  marginBottom: '5mm',
}

const absensiMetaStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 1fr 24mm 1fr',
  gap: '1.2mm 2mm',
  fontSize: '11pt',
  lineHeight: 1.1,
  marginBottom: '4mm',
}

const absensiTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const absensiThStyle: React.CSSProperties = {
  border: '1pt solid #000',
  backgroundColor: '#e5e7eb',
  height: '7.5mm',
  padding: '1mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '9.5pt',
  fontWeight: 700,
  lineHeight: 1,
}

const absensiTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '5.8mm',
  padding: '0.5mm 1.2mm',
  verticalAlign: 'middle',
  fontSize: '9.5pt',
  lineHeight: 1,
}

const signatureTdStyle: React.CSSProperties = {
  ...absensiTdStyle,
  position: 'relative',
  padding: 0,
}

const signatureNumberStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1mm',
  left: '1.2mm',
  fontSize: '8.5pt',
  lineHeight: 1,
}

const penilaianPageStyle: React.CSSProperties = {
  width: '330mm',
  height: '210mm',
  padding: '4mm 6mm',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  fontFamily: '"Arial Narrow", Arial, sans-serif',
  color: '#000',
  background: '#fff',
  overflow: 'hidden',
  breakAfter: 'page',
}

const penilaianBlankoStyle: React.CSSProperties = {
  height: '202mm',
  width: '155mm',
  border: '1pt solid #000',
  boxSizing: 'border-box',
  fontFamily: '"Arial Narrow", Arial, sans-serif',
  fontSize: '10pt',
  lineHeight: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#fff',
}

const penilaianTopBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '1mm',
}

const penilaianHeaderTitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '11pt',
  lineHeight: 1.05,
}

const penilaianSectionTitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '11pt',
  lineHeight: 1.1,
  padding: '1mm 0',
}

const penilaianTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
}

const penilaianInfoThStyle: React.CSSProperties = {
  border: '1pt solid #000',
  background: '#d9d9d9',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontWeight: 700,
  fontSize: '10pt',
  height: '8.5mm',
  padding: '0.6mm',
}

const penilaianInfoTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontWeight: 700,
  fontSize: '9.8pt',
  height: '8mm',
  padding: '0.7mm',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const penilaianInfoTdCenterStyle: React.CSSProperties = {
  ...penilaianInfoTdStyle,
  fontSize: '10pt',
}

const penilaianIdentityBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '1mm 2mm',
}

const penilaianIdentityLabelStyle: React.CSSProperties = {
  border: '1pt solid #000',
  width: '64mm',
  height: '5.5mm',
  padding: '0.5mm 2mm',
  verticalAlign: 'middle',
  fontSize: '10pt',
}

const penilaianIdentityValueStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '5.5mm',
  padding: '0.5mm 2mm',
  verticalAlign: 'middle',
  fontSize: '10pt',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const penilaianAssessmentBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '0 2mm',
  height: '95mm',
  boxSizing: 'border-box',
}

const penilaianBoldLineStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '10pt',
  lineHeight: 1.05,
  paddingTop: '1mm',
}

const penilaianColonStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: '3mm',
}

const penilaianWriteLinesStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'repeat(4, 9mm)',
  margin: '0 7mm 0 0',
}

const penilaianWrittenLineStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
}

const penilaianCheckRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '22mm',
  minHeight: '7mm',
  fontSize: '10pt',
}

const penilaianCheckLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2.5mm',
  whiteSpace: 'nowrap',
  fontSize: '10pt',
  fontWeight: 400,
}

const penilaianCheckBoxStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '5.5mm',
  height: '5.5mm',
  border: '1pt solid #000',
  boxSizing: 'border-box',
}

const penilaianChoiceLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 4mm 37mm 47mm 1fr',
  alignItems: 'center',
  minHeight: '7mm',
  fontSize: '10pt',
}

const penilaianChoiceTitleStyle: React.CSSProperties = {
  fontWeight: 700,
}

const penilaianHafalanLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 4mm 1fr',
  alignItems: 'end',
  minHeight: '12mm',
  fontSize: '10pt',
}

const penilaianLongLineStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  height: '5mm',
}

const penilaianNahwuBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '1mm 2mm',
  minHeight: '15mm',
  boxSizing: 'border-box',
}

const penilaianFooterStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 60mm',
  minHeight: '28mm',
  flex: 1,
}

const penilaianMarhalahStyle: React.CSSProperties = {
  borderRight: '1pt solid #000',
  padding: '1.2mm 2mm',
  boxSizing: 'border-box',
  fontSize: '10pt',
}

const penilaianFooterOptionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5mm',
  minHeight: '8mm',
}

const penilaianVerticalRuleStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '1pt',
  height: '13mm',
  background: '#000',
}

const penilaianGradeBoxStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '27mm',
  height: '13mm',
  border: '1pt solid #000',
}

const penilaianSignatureBoxStyle: React.CSSProperties = {
  textAlign: 'center',
  paddingTop: '3mm',
  fontSize: '10pt',
  lineHeight: 1.05,
}

function PlaceholderView({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <DashboardPageHeader title={label} description="Format cetak ini akan dilanjutkan setelah format jadwal." />
      <TesKlasifikasiTabs />
      <button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Placeholder fitur cetak berikutnya.
      </div>
    </div>
  )
}

export default function CetakTesKlasifikasiPage() {
  const [view, setView] = useState<View>('menu')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [printData, setPrintData] = useState<{ event: any; rows: any[] } | null>(null)
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [selectedSesi, setSelectedSesi] = useState('')
  const [selectedRuangan, setSelectedRuangan] = useState('')
  const [selectedAsrama, setSelectedAsrama] = useState('')
  const [penilaianBlankOnly, setPenilaianBlankOnly] = useState(false)
  const [penilaianBlankCount, setPenilaianBlankCount] = useState(2)
  const printRef = useRef<HTMLDivElement>(null)
  const absensiPrintRef = useRef<HTMLDivElement>(null)
  const penilaianPrintRef = useRef<HTMLDivElement>(null)
  const belumDitesPrintRef = useRef<HTMLDivElement>(null)
  const nahwuPrintRef = useRef<HTMLDivElement>(null)
  const absensiNahwuPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Jadwal Tes Klasifikasi',
    filename: 'jadwal-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintAbsensi = useReactToPrint({
    contentRef: absensiPrintRef,
    documentTitle: 'Blanko Absensi Tes Klasifikasi',
    filename: 'blanko-absensi-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintPenilaian = useReactToPrint({
    contentRef: penilaianPrintRef,
    documentTitle: 'Blanko Penilaian Tes Klasifikasi',
    filename: 'blanko-penilaian-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 330mm 210mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintBelumDites = useReactToPrint({
    contentRef: belumDitesPrintRef,
    documentTitle: 'Santri Belum Dites',
    filename: 'santri-belum-dites.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintNahwu = useReactToPrint({
    contentRef: nahwuPrintRef,
    documentTitle: 'Santri Rekomendasi Tes Nahwu',
    filename: 'santri-rekomendasi-tes-nahwu.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const handlePrintAbsensiNahwu = useReactToPrint({
    contentRef: absensiNahwuPrintRef,
    documentTitle: 'Blanko Absensi Tes Nahwu',
    filename: 'blanko-absensi-tes-nahwu.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const activeEvent = data?.activeEvent
  const asramaOptions = data?.asramaList || []
  const [loadingPrintData, setLoadingPrintData] = useState(false)

  const refreshPrintData = async () => {
    if (!activeEvent) return
    setLoadingPrintData(true)
    try {
      const filters: any = {}
      if (printMode === 'sesi' && selectedSesi) filters.sesi_id = selectedSesi
      if (printMode === 'ruangan' && selectedRuangan) filters.ruangan_id = selectedRuangan
      if (printMode === 'asrama' && selectedAsrama) filters.asrama = selectedAsrama
      
      let loaded: any
      if (view === 'belum-dites') {
        loaded = await getCetakBelumDitesData(activeEvent.id, filters)
      } else if (view === 'nahwu' || view === 'absensi-nahwu') {
        loaded = await getCetakNahwuData(activeEvent.id, filters)
      } else {
        loaded = await getCetakJadwalData(activeEvent.id, filters)
      }
      setPrintData(loaded)
    } catch (e: any) {
      toast.error('Gagal memuat data cetak', { description: e?.message })
    } finally {
      setLoadingPrintData(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const loaded = await getPenjadwalanData()
        setData(loaded)
      } catch (error: any) {
        toast.error('Gagal memuat data cetak', { description: error?.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (view === 'blanko-absensi') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Blanko Absensi Tes Klasifikasi" description="Cetak daftar hadir peserta per sesi dan ruangan." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="sesi">Per Sesi</option>
                  <option value="ruangan">Per Ruangan</option>
                </select>
              </div>
              {printMode === 'sesi' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                  <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih sesi</option>
                    {(data?.sesiList || []).map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} - {sesi.label}</option>)}
                  </select>
                </div>
              )}
              {printMode === 'ruangan' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ruangan</label>
                  <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih ruangan</option>
                    {(data?.ruanganList || []).map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={refreshPrintData}
                disabled={loadingPrintData || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
              </button>
              <button
                onClick={handlePrintAbsensi}
                disabled={!printData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <AbsensiSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} preview />
              </div>
            </div>
            <div className="hidden">
              <div ref={absensiPrintRef}>
                <AbsensiSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }
  if (view === 'blanko-penilaian') {
    const disablePenilaianPrint = penilaianBlankOnly
      ? penilaianBlankCount < 1
      : !activeEvent || !printData?.rows?.length

    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Blanko Penilaian Tes Klasifikasi" description="Cetak lembar penilaian per peserta atau blanko kosong untuk peserta susulan." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            {!activeEvent && !penilaianBlankOnly && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Buat atau aktifkan event penjadwalan terlebih dahulu, atau pilih mode blanko kosong.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jenis Blanko</label>
                <select value={penilaianBlankOnly ? 'kosong' : 'terisi'} onChange={e => setPenilaianBlankOnly(e.target.value === 'kosong')} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="terisi">Terisi Data Peserta</option>
                  <option value="kosong">Kosong</option>
                </select>
              </div>

              {penilaianBlankOnly ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Jumlah Blanko</label>
                  <input
                    type="number"
                    min={1}
                    value={penilaianBlankCount}
                    onChange={e => setPenilaianBlankCount(Math.max(1, Number(e.target.value || 1)))}
                    className="w-32 rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                    <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="all">Semua</option>
                      <option value="sesi">Per Sesi</option>
                      <option value="asrama">Per Asrama</option>
                    </select>
                  </div>
                  {printMode === 'sesi' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                      <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                        <option value="">Pilih sesi</option>
                        {(data?.sesiList || []).map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} - {sesi.label}</option>)}
                      </select>
                    </div>
                  )}
                  {printMode === 'asrama' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                      <select value={selectedAsrama} onChange={e => setSelectedAsrama(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                        <option value="">Pilih asrama</option>
                        {asramaOptions.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {!penilaianBlankOnly && (
                <button
                  onClick={refreshPrintData}
                  disabled={loadingPrintData || (printMode === 'sesi' && !selectedSesi) || (printMode === 'asrama' && !selectedAsrama)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                >
                  {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
                </button>
              )}
              <button
                onClick={handlePrintPenilaian}
                disabled={disablePenilaianPrint}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <PenilaianSheet
                  event={printData?.event || activeEvent}
                  rows={printData?.rows || []}
                  mode={printMode}
                  selectedSesi={selectedSesi}
                  selectedRuangan={selectedRuangan}
                  selectedAsrama={selectedAsrama}
                  blankOnly={penilaianBlankOnly}
                  blankCount={penilaianBlankCount}
                  preview
                />
              </div>
            </div>
            <div className="hidden">
              <div ref={penilaianPrintRef}>
                <PenilaianSheet
                  event={printData?.event || activeEvent}
                  rows={printData?.rows || []}
                  mode={printMode}
                  selectedSesi={selectedSesi}
                  selectedRuangan={selectedRuangan}
                  selectedAsrama={selectedAsrama}
                  blankOnly={penilaianBlankOnly}
                  blankCount={penilaianBlankCount}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (view === 'jadwal') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Jadwal Peserta Tes Klasifikasi" description="Cetak jadwal peserta semua, per sesi, atau per ruangan." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="sesi">Per Sesi</option>
                  <option value="ruangan">Per Ruangan</option>
                  <option value="asrama">Per Asrama</option>
                </select>
              </div>
              {printMode === 'sesi' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                  <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih sesi</option>
                    {(data?.sesiList || []).map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} - {sesi.label}</option>)}
                  </select>
                </div>
              )}
              {printMode === 'ruangan' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ruangan</label>
                  <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih ruangan</option>
                    {(data?.ruanganList || []).map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                  </select>
                </div>
              )}
              {printMode === 'asrama' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                  <select value={selectedAsrama} onChange={e => setSelectedAsrama(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih asrama</option>
                    {asramaOptions.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={refreshPrintData}
                disabled={loadingPrintData || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan) || (printMode === 'asrama' && !selectedAsrama)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
              </button>
              <button
                onClick={handlePrint}
                disabled={!printData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <PrintSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} selectedAsrama={selectedAsrama} preview />
              </div>
            </div>
            <div className="hidden">
              <div ref={printRef}>
                <PrintSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} selectedAsrama={selectedAsrama} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (view === 'belum-dites') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Santri Belum Dites" description="Cetak daftar santri yang belum dites klasifikasi." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="asrama">Per Asrama</option>
                </select>
              </div>
              
              {printMode === 'asrama' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                  <select value={selectedAsrama} onChange={e => setSelectedAsrama(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih asrama</option>
                    {asramaOptions.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={refreshPrintData}
                disabled={loadingPrintData || (printMode === 'asrama' && !selectedAsrama)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
              </button>
              <button
                onClick={handlePrintBelumDites}
                disabled={!printData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <BelumDitesSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} preview />
              </div>
            </div>
            <div className="hidden">
              <div ref={belumDitesPrintRef}>
                <BelumDitesSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (view === 'nahwu') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Santri Rekomendasi Tes Nahwu" description="Cetak daftar santri yang direkomendasikan tes nahwu lanjutan." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="asrama">Per Asrama</option>
                </select>
              </div>
              
              {printMode === 'asrama' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                  <select value={selectedAsrama} onChange={e => setSelectedAsrama(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih asrama</option>
                    {asramaOptions.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={refreshPrintData}
                disabled={loadingPrintData || (printMode === 'asrama' && !selectedAsrama)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
              </button>
              <button
                onClick={handlePrintNahwu}
                disabled={!printData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <NahwuSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} preview />
              </div>
            </div>
            <div className="hidden">
              <div ref={nahwuPrintRef}>
                <NahwuSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (view === 'absensi-nahwu') {
    return (
      <div className="mx-auto max-w-7xl space-y-5 pb-20">
        <DashboardPageHeader title="Absensi Tes Nahwu" description="Cetak daftar hadir peserta tes nahwu lanjutan." />
        <TesKlasifikasiTabs />
        <button onClick={() => setView('menu')} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Kembali</button>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
        ) : !activeEvent ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Buat atau aktifkan event penjadwalan terlebih dahulu.
          </div>
        ) : (
          <section className="space-y-5 rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                  <option value="all">Semua</option>
                  <option value="asrama">Per Asrama</option>
                </select>
              </div>
              
              {printMode === 'asrama' && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Asrama</label>
                  <select value={selectedAsrama} onChange={e => setSelectedAsrama(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih asrama</option>
                    {asramaOptions.map((asrama: string) => <option key={asrama} value={asrama}>{asrama}</option>)}
                  </select>
                </div>
              )}
              <button
                onClick={refreshPrintData}
                disabled={loadingPrintData || (printMode === 'asrama' && !selectedAsrama)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                {loadingPrintData ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
              </button>
              <button
                onClick={handlePrintAbsensiNahwu}
                disabled={!printData?.rows?.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-200/60 p-4 lg:p-8">
              <div className="max-h-[75vh] w-full overflow-auto rounded-xl">
                <AbsensiNahwuSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} preview />
              </div>
            </div>
            <div className="hidden">
              <div ref={absensiNahwuPrintRef}>
                <AbsensiNahwuSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedAsrama={selectedAsrama} />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Cetak Tes Klasifikasi"
        description="Pilih dokumen administrasi tes klasifikasi yang akan dicetak."
      />
      <TesKlasifikasiTabs />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className="group rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 transition-colors group-hover:bg-emerald-100">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="mb-1 text-sm font-bold text-slate-800">{item.label}</p>
                    {!item.ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Soon</span>}
                  </div>
                  <p className="text-xs leading-snug text-slate-400">{item.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
