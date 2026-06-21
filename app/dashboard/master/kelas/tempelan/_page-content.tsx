'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useReactToPrint } from '@/lib/pdf/client'
import { AlertTriangle, ArrowLeft, Eye, Printer } from 'lucide-react'
import { Alert, Box, Button, Center, Grid, Group, Loader, NativeSelect, Paper, Text } from '@mantine/core'
import { toast } from '@/lib/toast'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getKelasTempelanList,
  getTempelanKelasData,
  getTempelanKelasSemuaData,
  getTahunAjaranAktif,
  type TempelanKelasItem,
} from '../actions'

function getClassFontSize(name: string) {
  const len = name.trim().length
  if (len <= 6) return '82pt'
  if (len <= 10) return '72pt'
  if (len <= 14) return '62pt'
  if (len <= 18) return '54pt'
  return '46pt'
}

function getPlaceFontSize(place: string) {
  const len = place.trim().length
  if (len <= 16) return '28pt'
  if (len <= 26) return '24pt'
  if (len <= 36) return '20pt'
  return '17pt'
}

function TempelanKelasPrint({ item }: { item: TempelanKelasItem }) {
  const tempat = item.tempat?.trim() || 'Tempat belum diatur'

  return (
    <div
      style={{
        width: '318mm',
        height: '203mm',
        boxSizing: 'border-box',
        padding: '8mm 10mm',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: '"Times New Roman", Times, serif',
        display: 'flex',
        flexDirection: 'column',
        border: '1.5pt solid #0f172a',
        breakAfter: 'page',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5mm',
          borderBottom: '2.2pt solid #0f172a',
          paddingBottom: '4mm',
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logohitam.png"
          alt="Logo Pesantren"
          style={{ width: '25mm', height: '25mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '17pt', fontWeight: 400, letterSpacing: '0.3pt', lineHeight: 1.05 }}>
            SEKSI PENGAJARAN DEWAN SANTRI
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 700, letterSpacing: '0.2pt', lineHeight: 1.1, marginTop: '0.8mm' }}>
            LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG
          </div>
          <div style={{ fontSize: '13pt', fontWeight: 400, letterSpacing: '0.8pt', lineHeight: 1.1, marginTop: '0.8mm' }}>
            TAHUN AJARAN {item.tahun_ajaran_nama}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          marginTop: '7mm',
          border: '2pt solid #1e3a8a',
          borderRadius: '4mm',
          padding: '10mm 12mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            width: '100%',
            fontSize: getClassFontSize(item.nama_kelas),
            fontWeight: 900,
            letterSpacing: '-0.6pt',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            textTransform: 'uppercase',
          }}
        >
          {item.nama_kelas}
        </div>

        <div
          style={{
            width: '100%',
            marginTop: '8mm',
            fontSize: getPlaceFontSize(tempat),
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '0.2pt',
            textTransform: 'uppercase',
          }}
        >
          {tempat}
        </div>
      </div>

      <div
        style={{
          marginTop: '4mm',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          fontSize: '10pt',
          color: '#334155',
          flexShrink: 0,
        }}
      >
        <span>{item.marhalah_nama || 'Tanpa marhalah'}</span>
      </div>
    </div>
  )
}

function TempelanPreview({ item }: { item: TempelanKelasItem }) {
  return (
    <div className="bg-white shadow-2xl" style={{ zoom: 0.34 }}>
      <TempelanKelasPrint item={item} />
    </div>
  )
}

export default function TempelanKelasPage() {
  const [tahunAktif, setTahunAktif] = useState<any>(null)
  const [kelasList, setKelasList] = useState<TempelanKelasItem[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [previewItem, setPreviewItem] = useState<TempelanKelasItem | null>(null)
  const [bulkItems, setBulkItems] = useState<TempelanKelasItem[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const bulkPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Tempelan Kelas',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  const handleBulkPrint = useReactToPrint({
    contentRef: bulkPrintRef,
    documentTitle: 'Semua Tempelan Kelas',
    pageStyle: `
      @page { size: 330mm 215mm; margin: 6mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { font-family: "Times New Roman", Times, serif; }
      }
    `,
  })

  useEffect(() => {
    const init = async () => {
      const [tahun, kelas] = await Promise.all([getTahunAjaranAktif(), getKelasTempelanList()])
      setTahunAktif(tahun)
      setKelasList(kelas)
      setLoadingInit(false)
    }
    init()
  }, [])

  const totalLabel = useMemo(() => {
    if (bulkItems.length === 0) return `${kelasList.length} kelas tersedia`
    return `${bulkItems.length} lembar siap dicetak`
  }, [bulkItems, kelasList.length])

  const handleLoadPreview = async () => {
    if (!selectedKelas) return toast.error('Pilih kelas terlebih dahulu')
    setLoadingPreview(true)
    setHasLoadedPreview(false)
    const data = await getTempelanKelasData(selectedKelas)
    setPreviewItem(data)
    setHasLoadedPreview(true)
    setLoadingPreview(false)
    if (!data) toast.error('Data kelas tidak ditemukan')
  }

  const handleLoadBulk = async () => {
    setLoadingBulk(true)
    try {
      const data = await getTempelanKelasSemuaData()
      if (data.length === 0) {
        toast.error('Belum ada kelas untuk dicetak')
        setLoadingBulk(false)
        return
      }
      setBulkItems(data)
      setTimeout(() => {
        handleBulkPrint()
        setLoadingBulk(false)
      }, 500)
    } catch {
      toast.error('Gagal memuat tempelan kelas')
      setLoadingBulk(false)
    }
  }

  if (loadingInit) {
    return <Center p={80}><Loader color="blue" size="lg" /></Center>
  }

  return (
    <div className="space-y-6 pb-20">
      <DashboardPageHeader
        title="Tempelan Kelas"
        description="Cetak tempelan nama kelas dan tempat untuk tahun ajaran aktif."
        action={(
          <Button component={Link} href="/dashboard/master/kelas" variant="default" fw={700} leftSection={<ArrowLeft className="h-4 w-4" />}>
            Kembali ke Kelas
          </Button>
        )}
      />

      {!tahunAktif ? (
        <Alert color="yellow" variant="light" radius="md" icon={<AlertTriangle className="w-5 h-5" />}>
          <Text size="sm" fw={500} c="yellow.8">Belum ada tahun ajaran aktif, jadi tempelan belum bisa disiapkan.</Text>
        </Alert>
      ) : (
        <Alert color="blue" variant="light" radius="md">
          <Group gap="sm">
            <Text size="sm" fw={700} c="blue.9">Tahun ajaran aktif: {tahunAktif.nama}</Text>
            <Text size="xs" c="blue.6" ml="auto">{totalLabel}</Text>
          </Group>
        </Alert>
      )}

      <Paper withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
        <Box px="lg" py="sm" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Text size="sm" fw={700} c="dark.6">Siapkan Cetakan</Text>
          <Text size="xs" c="dimmed" mt={4}>Format F4 Landscape, margin narrow, bisa per kelas atau semua sekaligus.</Text>
        </Box>
        <Grid gutter="md" p="lg" align="flex-end">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NativeSelect
              label="Pilih Kelas"
              value={selectedKelas}
              onChange={(e) => { setSelectedKelas(e.currentTarget.value); setPreviewItem(null); setHasLoadedPreview(false) }}
              data={[{ value: '', label: '-- Pilih kelas --' }, ...kelasList.map((kelas) => ({ value: String(kelas.id), label: `${kelas.nama_kelas} ${kelas.tempat ? `• ${kelas.tempat}` : ''}` }))]}
              styles={{ label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mantine-color-dimmed)' } }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Button onClick={handleLoadPreview} loading={loadingPreview} disabled={loadingBulk} fullWidth color="blue" fw={700} leftSection={!loadingPreview && <Eye className="h-4 w-4" />}>
              Muat Preview
            </Button>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Button onClick={handleLoadBulk} loading={loadingBulk} disabled={loadingPreview || !tahunAktif} fullWidth color="dark" fw={700} leftSection={!loadingBulk && <Printer className="h-4 w-4" />}>
              Cetak Semua
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {hasLoadedPreview && previewItem && (
        <Box>
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Preview untuk <Text span fw={700} c="dark.7">{previewItem.nama_kelas}</Text>
              <Text span c="gray.4" ml="xs">· 1 lembar F4 Landscape</Text>
            </Text>
            <Button onClick={() => handlePrint()} color="teal" fw={700} leftSection={<Printer className="h-4 w-4" />}>
              Cetak Kelas Ini
            </Button>
          </Group>

          <Box style={{ maxHeight: 780, overflow: 'auto', borderRadius: 16, border: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-gray-1)', padding: 16, display: 'flex', justifyContent: 'center' }}>
            <TempelanPreview item={previewItem} />
          </Box>
        </Box>
      )}

      <div className="hidden">
        <div ref={printRef}>
          {previewItem ? <TempelanKelasPrint item={previewItem} /> : null}
        </div>
      </div>

      <div className="hidden">
        <div ref={bulkPrintRef}>
          {bulkItems.map(item => (
            <TempelanKelasPrint key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
