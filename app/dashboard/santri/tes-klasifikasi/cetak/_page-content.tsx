'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardList, FileText, LayoutList, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useReactToPrint } from '@/lib/pdf/client'
import { TesKlasifikasiTabs } from '../_tabs'
import { getPenjadwalanData, getCetakJadwalData } from '../penjadwalan/actions'

type View = 'menu' | 'jadwal' | 'blanko-absensi' | 'blanko-penilaian'
type PrintMode = 'all' | 'sesi' | 'ruangan' | 'asrama'

const MENU_ITEMS: { view: View; label: string; desc: string; icon: React.ElementType; ready: boolean }[] = [
  { view: 'jadwal', label: 'Jadwal Peserta', desc: 'Cetak jadwal tes klasifikasi semua peserta, per sesi, atau per ruangan.', icon: LayoutList, ready: true },
  { view: 'blanko-absensi', label: 'Blanko Absensi', desc: 'Lembar daftar hadir peserta tes klasifikasi per sesi dan ruangan.', icon: ClipboardList, ready: true },
  { view: 'blanko-penilaian', label: 'Blanko Penilaian', desc: 'Lembar penilaian tes klasifikasi per peserta.', icon: FileText, ready: true },
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
    MAN: 'MA',
    SMA: 'SMA',
    SMK: 'SMK',
  }
  return map[value] || value || '-'
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

function getAsramaOptions(rows: any[]) {
  return Array.from(new Set(rows.map(row => String(row.asrama || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'id-ID', { sensitivity: 'base', numeric: true }))
}

function PrintSheet({ event, rows, mode, selectedSesi, selectedRuangan }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string }) {
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
  const groups = Array.from(groupsMap.values())

  return (
    <div>
      {groups.map((items, groupIndex) => {
        const first = items[0]
        return (
          <div
            key={`${first.sesi_id}-${first.ruangan_id}-${groupIndex}`}
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
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              JADWAL PESERTA TES KLASIFIKASI TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm 8mm', marginBottom: '4mm', fontSize: '11pt' }}>
              <div><b>Tanggal:</b> {formatDate(first.tanggal)}</div>
              <div><b>Waktu:</b> {formatTime(first)}</div>
              <div><b>Ruangan:</b> {first.nama_ruangan}</div>
              <div><b>Tempat:</b> {first.tempat || '-'}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10mm' }} />
                <col />
                <col style={{ width: '29mm' }} />
                <col style={{ width: '31mm' }} />
                <col style={{ width: '25mm' }} />
                <col style={{ width: '24mm' }} />
                <col style={{ width: '27mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'Nama Lengkap', 'Asrama/Kamar', 'Tanggal tes', 'Waktu', 'Ruangan', 'Tempat'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{index + 1}</td>
                    <td style={printTd}>{row.nama_lengkap}</td>
                    <td style={printTd}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={printTd}>{formatDate(row.tanggal)}</td>
                    <td style={printTd}>{formatTime(row)}</td>
                    <td style={printTd}>{row.nama_ruangan}</td>
                    <td style={printTd}>{row.tempat || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function AbsensiSheet({ event, rows, mode, selectedSesi, selectedRuangan }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string }) {
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

  return (
    <div>
      {Array.from(groupsMap.values()).flatMap(items => {
        const first = items[0]
        return chunkRows(items, 30).map((chunk, chunkIndex) => {
          const padded = [...chunk]
          while (padded.length < 30) padded.push(null)

          return (
            <div key={`${first.sesi_id}-${first.ruangan_id}-${chunkIndex}`} style={absensiPageStyle}>
              <div style={absensiTitleStyle}>DAFTAR HADIR PESERTA TES KLASIFIKASI</div>
              <div style={absensiSubtitleStyle}>TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}</div>
              <div style={absensiMetaStyle}>
                <div>Tanggal</div><div>: {formatDate(first.tanggal)}</div>
                <div>Sesi/Waktu</div><div>: {first.sesi_label || `Sesi ${first.nomor_sesi}`} ({formatTime(first)})</div>
                <div>Ruangan</div><div>: {first.nama_ruangan}</div>
                <div>Tempat</div><div>: {first.tempat || '-'}</div>
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
                    <th style={absensiThStyle}>ASRAMA/KAMAR</th>
                    <th style={absensiThStyle}>SEKOLAH</th>
                    <th style={absensiThStyle} colSpan={2}>TANDA TANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  {padded.map((row, index) => (
                    <tr key={row?.id || `blank-${index}`}>
                      <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{chunkIndex * 30 + index + 1}</td>
                      <td style={{ ...absensiTdStyle, textTransform: 'uppercase' }}>{row?.nama_lengkap || ''}</td>
                      <td style={absensiTdStyle}>{row ? `${row.asrama || '-'}/${row.kamar || '-'}` : ''}</td>
                      <td style={{ ...absensiTdStyle, textAlign: 'center' }}>{row ? formatSekolah(row.sekolah) : ''}</td>
                      {index % 2 === 0 ? (
                        <>
                          <td rowSpan={2} style={signatureTdStyle}>
                            <span style={signatureNumberStyle}>{chunkIndex * 30 + index + 1}</span>
                          </td>
                          <td rowSpan={2} style={signatureTdStyle}>
                            {index < 29 && <span style={signatureNumberStyle}>{chunkIndex * 30 + index + 2}</span>}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      })}
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
}: {
  event: any
  rows: any[]
  mode: PrintMode
  selectedSesi: string
  selectedRuangan: string
  selectedAsrama: string
  blankOnly: boolean
  blankCount: number
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

  return (
    <div>
      {pages.map((items, pageIndex) => (
        <div key={`penilaian-page-${pageIndex}`} style={penilaianPageStyle}>
          {[0, 1].map(slot => {
            const row = items[slot] || { id: `empty-${pageIndex}-${slot}`, __blank: true }
            return <PenilaianBlanko key={`${row.id}-${slot}`} event={event} row={row} blank={blankOnly || row.__blank} />
          })}
        </div>
      ))}
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
              ['NAMA', upperOrBlank(row.nama_lengkap, blank)],
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
  padding: '1.2mm',
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.1,
}

const printTd: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1.1mm',
  verticalAlign: 'middle',
  lineHeight: 1.12,
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
  height: '9mm',
  padding: '1mm',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontSize: '10pt',
  fontWeight: 700,
  lineHeight: 1,
}

const absensiTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '7.6mm',
  padding: '0.7mm 1.2mm',
  verticalAlign: 'middle',
  fontSize: '10pt',
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
  width: '210mm',
  height: '330mm',
  padding: '4mm',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '2mm',
  fontFamily: '"Arial Narrow", Arial, sans-serif',
  color: '#000',
  background: '#fff',
  overflow: 'hidden',
  breakAfter: 'page',
}

const penilaianBlankoStyle: React.CSSProperties = {
  height: '160mm',
  width: '100%',
  border: '1pt solid #000',
  boxSizing: 'border-box',
  fontFamily: '"Arial Narrow", Arial, sans-serif',
  fontSize: '9pt',
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
  fontSize: '10.5pt',
  lineHeight: 1.05,
}

const penilaianSectionTitleStyle: React.CSSProperties = {
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '10.5pt',
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
  fontSize: '9.5pt',
  height: '7mm',
  padding: '0.6mm',
}

const penilaianInfoTdStyle: React.CSSProperties = {
  border: '1pt solid #000',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontWeight: 700,
  fontSize: '9.3pt',
  height: '6.8mm',
  padding: '0.7mm',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const penilaianInfoTdCenterStyle: React.CSSProperties = {
  ...penilaianInfoTdStyle,
  fontSize: '9.5pt',
}

const penilaianIdentityBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '1mm 2mm',
}

const penilaianIdentityLabelStyle: React.CSSProperties = {
  border: '1pt solid #000',
  width: '64mm',
  height: '4.2mm',
  padding: '0.5mm 2mm',
  verticalAlign: 'middle',
  fontSize: '9.2pt',
}

const penilaianIdentityValueStyle: React.CSSProperties = {
  border: '1pt solid #000',
  height: '4.2mm',
  padding: '0.5mm 2mm',
  verticalAlign: 'middle',
  fontSize: '9.2pt',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const penilaianAssessmentBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '0 2mm',
  height: '67mm',
  boxSizing: 'border-box',
}

const penilaianBoldLineStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '9.5pt',
  lineHeight: 1.05,
  paddingTop: '1mm',
}

const penilaianColonStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: '3mm',
}

const penilaianWriteLinesStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'repeat(4, 6.6mm)',
  margin: '0 7mm 0 0',
}

const penilaianWrittenLineStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
}

const penilaianCheckRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '22mm',
  minHeight: '5.8mm',
  fontSize: '9pt',
}

const penilaianCheckLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2.5mm',
  whiteSpace: 'nowrap',
  fontSize: '9pt',
  fontWeight: 400,
}

const penilaianCheckBoxStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '5mm',
  height: '5mm',
  border: '1pt solid #000',
  boxSizing: 'border-box',
}

const penilaianChoiceLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 4mm 37mm 47mm 1fr',
  alignItems: 'center',
  minHeight: '6mm',
  fontSize: '9pt',
}

const penilaianChoiceTitleStyle: React.CSSProperties = {
  fontWeight: 700,
}

const penilaianHafalanLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28mm 4mm 1fr',
  alignItems: 'end',
  minHeight: '9mm',
  fontSize: '9pt',
}

const penilaianLongLineStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  height: '5mm',
}

const penilaianNahwuBoxStyle: React.CSSProperties = {
  borderBottom: '1pt solid #000',
  padding: '1mm 2mm',
  minHeight: '11mm',
  boxSizing: 'border-box',
}

const penilaianFooterStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 60mm',
  minHeight: '21mm',
  flex: 1,
}

const penilaianMarhalahStyle: React.CSSProperties = {
  borderRight: '1pt solid #000',
  padding: '1.2mm 2mm',
  boxSizing: 'border-box',
  fontSize: '9pt',
}

const penilaianFooterOptionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5mm',
  minHeight: '6.2mm',
}

const penilaianVerticalRuleStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '1pt',
  height: '11mm',
  background: '#000',
}

const penilaianGradeBoxStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '27mm',
  height: '11mm',
  border: '1pt solid #000',
}

const penilaianSignatureBoxStyle: React.CSSProperties = {
  textAlign: 'center',
  paddingTop: '3mm',
  fontSize: '9pt',
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
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const activeEvent = data?.activeEvent
  const rows = printData?.rows || []
  const asramaOptions = getAsramaOptions(rows)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const loaded = await getPenjadwalanData()
        setData(loaded)
        if (loaded.activeEvent) {
          setPrintData(await getCetakJadwalData(loaded.activeEvent.id))
        }
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
                onClick={async () => {
                  setPrintData(await getCetakJadwalData(activeEvent.id))
                  window.setTimeout(() => handlePrintAbsensi(), 100)
                }}
                disabled={rows.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-100 p-4">
              <div className="max-h-[760px] overflow-auto">
                <div style={{ zoom: 0.35 }} className="origin-top-left bg-white shadow">
                  <AbsensiSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                </div>
              </div>
            </div>
            <div className="hidden">
              <div ref={absensiPrintRef}>
                <AbsensiSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
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
      : !activeEvent || rows.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'asrama' && !selectedAsrama)

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
                        {asramaOptions.map(asrama => <option key={asrama} value={asrama}>{asrama}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={async () => {
                  if (activeEvent) setPrintData(await getCetakJadwalData(activeEvent.id))
                  window.setTimeout(() => handlePrintPenilaian(), 100)
                }}
                disabled={disablePenilaianPrint}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-100 p-4">
              <div className="max-h-[760px] overflow-auto">
                <div style={{ zoom: 0.38 }} className="origin-top-left bg-white shadow">
                  <PenilaianSheet
                    event={printData?.event || activeEvent}
                    rows={rows}
                    mode={printMode}
                    selectedSesi={selectedSesi}
                    selectedRuangan={selectedRuangan}
                    selectedAsrama={selectedAsrama}
                    blankOnly={penilaianBlankOnly}
                    blankCount={penilaianBlankCount}
                  />
                </div>
              </div>
            </div>
            <div className="hidden">
              <div ref={penilaianPrintRef}>
                <PenilaianSheet
                  event={printData?.event || activeEvent}
                  rows={rows}
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
                onClick={async () => {
                  setPrintData(await getCetakJadwalData(activeEvent.id))
                  window.setTimeout(() => handlePrint(), 100)
                }}
                disabled={rows.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" /> Cetak / PDF
              </button>
            </div>

            <div className="rounded-xl border bg-slate-100 p-4">
              <div className="max-h-[640px] overflow-auto">
                <div style={{ zoom: 0.36 }} className="origin-top-left bg-white shadow">
                  <PrintSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                </div>
              </div>
            </div>
            <div className="hidden">
              <div ref={printRef}>
                <PrintSheet event={printData?.event} rows={rows} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
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
