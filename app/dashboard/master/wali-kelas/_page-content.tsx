'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { getJadwalFilterOptions, getKelasJadwalByMarhalah, importGuruMassal, tambahGuruManual, hapusGuru, hapusGuruMassal, simpanJadwalBatch } from './actions'
import { UserCheck, Save, School, Search, Upload, Download, List, Plus, Trash2, CheckSquare, Square, Printer, Filter, CalendarDays, UsersRound, Settings2 } from 'lucide-react'
import {
  ActionIcon, Alert, Badge, Box, Button, Center, FileButton, Flex, Grid, Group, Loader, Modal,
  NativeSelect, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, UnstyledButton,
} from '@mantine/core'
import { toast } from '@/lib/toast'
import Pagination, { usePagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import Link from 'next/link'

type SessionKey = 's' | 'a' | 'm'
type WeeklySessionKey = 'shubuh' | 'ashar' | 'maghrib'
type WeeklyMap = Record<WeeklySessionKey, Record<number, string>>
type GabunganMap = Record<WeeklySessionKey, { groupKey: string; tempat: string }>
type ScheduleModalTab = 'gabungan' | 'override'

const HARI_LIST = [
  { index: 1, label: 'Senin' },
  { index: 2, label: 'Selasa' },
  { index: 3, label: 'Rabu' },
  { index: 4, label: 'Kamis' },
  { index: 5, label: 'Jumat' },
  { index: 6, label: 'Sabtu' },
  { index: 0, label: 'Ahad' },
] as const

const SESSION_META: { key: SessionKey; serverKey: WeeklySessionKey; label: string }[] = [
  { key: 's', serverKey: 'shubuh', label: 'Shubuh' },
  { key: 'a', serverKey: 'ashar', label: 'Ashar' },
  { key: 'm', serverKey: 'maghrib', label: 'Maghrib' },
]

function isStructuralLibur(hariIndex: number, session: WeeklySessionKey) {
  if (hariIndex === 2 && session === 'maghrib') return true
  if (hariIndex === 4 && session === 'maghrib') return true
  if (hariIndex === 5 && (session === 'shubuh' || session === 'ashar')) return true
  return false
}

function makeEmptyWeeklyMap(): WeeklyMap {
  return {
    shubuh: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    ashar: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
    maghrib: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
  }
}

function makeEmptyGabunganMap(): GabunganMap {
  return {
    shubuh: { groupKey: '', tempat: '' },
    ashar: { groupKey: '', tempat: '' },
    maghrib: { groupKey: '', tempat: '' },
  }
}

function buildRuleSignature(weekly: WeeklyMap) {
  return SESSION_META.flatMap(session =>
    HARI_LIST
      .map(day => {
        const value = weekly[session.serverKey]?.[day.index] || ''
        return value ? `${session.serverKey}|${day.index}|${value}` : ''
      })
      .filter(Boolean)
  ).join('||')
}

function buildGabunganSignature(gabungan: GabunganMap) {
  return SESSION_META
    .map(session => {
      const item = gabungan[session.serverKey]
      return `${session.serverKey}|${String(item?.groupKey || '').trim()}|${String(item?.tempat || '').trim()}`
    })
    .join('||')
}

const fieldLabelStyles = { label: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.03em', color: 'var(--mantine-color-dimmed)' } }

export default function ManajemenGuruPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<'JADWAL' | 'MASTER'>('JADWAL')

  const [kelasList, setKelasList] = useState<any[]>([])
  const [localKelasList, setLocalKelasList] = useState<any[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [waliUserList, setWaliUserList] = useState<any[]>([])
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [jadwalLoaded, setJadwalLoaded] = useState(false)
  const [scheduleModal, setScheduleModal] = useState<{ kelasId: string; tab: ScheduleModalTab } | null>(null)

  const [guruList, setGuruList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedGuruIds, setSelectedGuruIds] = useState<string[]>([])
  const [guruSearch, setGuruSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  const [excelData, setExcelData] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [newGuru, setNewGuru] = useState({ nama: '', gelar: '', kode: '' })
  const [search, setSearch] = useState('')

  useEffect(() => { loadInitialData() }, [])

  const loadInitialData = async () => {
    setLoading(true)
    const res = await getJadwalFilterOptions()
    setGuruList(res.guruList)
    setMarhalahList(res.marhalahList)
    setWaliUserList(res.waliUserList || [])
    setSelectedGuruIds([])
    setLoading(false)
  }

  const loadKelasByFilter = async (marhalahId: string) => {
    setLoading(true)
    const kelas = await getKelasJadwalByMarhalah(marhalahId)
    setKelasList(kelas)
    const mappedLocal = kelas.map((k: any) => {
      const weekly = makeEmptyWeeklyMap()
      const gabungan = makeEmptyGabunganMap()
      ;(k.weekly_rules || []).forEach((rule: any) => {
        if (weekly[rule.sesi as WeeklySessionKey]) {
          weekly[rule.sesi as WeeklySessionKey][Number(rule.hari_index)] = String(rule.guru_id)
        }
      })
      SESSION_META.forEach(session => {
        const item = k.gabungan?.[session.serverKey]
        if (item) {
          gabungan[session.serverKey] = {
            groupKey: item.group_key || '',
            tempat: item.tempat || '',
          }
        }
      })

      return {
        id: k.id,
        nama_kelas: k.nama_kelas,
        marhalah_nama: k.marhalah_nama,
        wali_kelas_id: k.wali_kelas_id || '',
        s: k.guru_shubuh_id?.toString() || '',
        a: k.guru_ashar_id?.toString() || '',
        m: k.guru_maghrib_id?.toString() || '',
        weekly,
        gabungan,
      }
    })
    setLocalKelasList(mappedLocal)
    setJadwalLoaded(true)
    setLoading(false)
  }

  const handleChangeLocal = (kelasId: string, field: SessionKey | 'wali_kelas_id', value: string) => {
    setLocalKelasList(prev => prev.map(k => k.id === kelasId ? { ...k, [field]: value } : k))
  }

  const handleChangeWeekly = (kelasId: string, session: WeeklySessionKey, hariIndex: number, guruId: string) => {
    setLocalKelasList(prev => prev.map(k => {
      if (k.id !== kelasId) return k
      return { ...k, weekly: { ...k.weekly, [session]: { ...k.weekly[session], [hariIndex]: guruId } } }
    }))
  }

  const handleChangeGabungan = (kelasId: string, session: WeeklySessionKey, field: 'groupKey' | 'tempat', value: string) => {
    setLocalKelasList(prev => prev.map(k => {
      if (k.id !== kelasId) return k
      return { ...k, gabungan: { ...k.gabungan, [session]: { ...(k.gabungan?.[session] || { groupKey: '', tempat: '' }), [field]: value } } }
    }))
  }

  const handleSimpanSemua = async () => {
    const changedClasses = localKelasList.filter(local => {
      const asli = kelasList.find((k: any) => k.id === local.id)
      if (!asli) return false

      const asliWeekly = makeEmptyWeeklyMap()
      const asliGabungan = makeEmptyGabunganMap()
      ;(asli.weekly_rules || []).forEach((rule: any) => {
        if (asliWeekly[rule.sesi as WeeklySessionKey]) {
          asliWeekly[rule.sesi as WeeklySessionKey][Number(rule.hari_index)] = String(rule.guru_id)
        }
      })
      SESSION_META.forEach(session => {
        const item = asli.gabungan?.[session.serverKey]
        if (item) {
          asliGabungan[session.serverKey] = { groupKey: item.group_key || '', tempat: item.tempat || '' }
        }
      })

      return (
        (asli.guru_shubuh_id?.toString() || '') !== local.s ||
        (asli.guru_ashar_id?.toString() || '') !== local.a ||
        (asli.guru_maghrib_id?.toString() || '') !== local.m ||
        (asli.wali_kelas_id || '') !== local.wali_kelas_id ||
        buildRuleSignature(asliWeekly) !== buildRuleSignature(local.weekly) ||
        buildGabunganSignature(asliGabungan) !== buildGabunganSignature(local.gabungan)
      )
    })

    if (changedClasses.length === 0) {
      toast.info('Tidak ada perubahan', { description: 'Jadwal, wali kelas, dan pembagian harian belum ada yang diubah.' })
      return
    }

    if (!await confirm(`Terdapat ${changedClasses.length} perubahan jadwal. Simpan sekarang?`)) return
    setIsSavingBatch(true)
    const toastId = toast.loading(`Menyimpan ${changedClasses.length} jadwal...`)

    const payload = changedClasses.map(k => ({
      kelasId: k.id,
      waliKelasId: k.wali_kelas_id || null,
      shubuhId: Number(k.s) || null,
      asharId: Number(k.a) || null,
      maghribId: Number(k.m) || null,
      weeklyRules: SESSION_META.flatMap(session =>
        HARI_LIST.map(day => ({
          sesi: session.serverKey,
          hariIndex: day.index,
          guruId: Number(k.weekly[session.serverKey]?.[day.index] || 0) || null,
        }))
      ),
      gabungan: SESSION_META.reduce((acc: any, session) => {
        acc[session.serverKey] = {
          groupKey: k.gabungan?.[session.serverKey]?.groupKey || null,
          tempat: k.gabungan?.[session.serverKey]?.tempat || null,
        }
        return acc
      }, {}),
    }))

    const res = await simpanJadwalBatch(payload as any)
    setIsSavingBatch(false)
    toast.dismiss(toastId)
    if ('error' in res) toast.error('Gagal', { description: (res as any).error })
    else {
      toast.success('Berhasil!', { description: `${(res as any).count} kelas telah diperbarui.` })
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    }
  }

  const handleTambahGuru = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGuru.nama) return toast.warning('Nama wajib diisi')
    const toastId = toast.loading('Menambahkan...')
    const res = await tambahGuruManual(newGuru.nama, newGuru.gelar, newGuru.kode)
    toast.dismiss(toastId)
    if ((res as any).success) {
      toast.success('Guru ditambahkan')
      setNewGuru({ nama: '', gelar: '', kode: '' })
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error((res as any).error)
  }

  const handleHapusGuru = async (id: string, nama: string) => {
    if (!await confirm(`Hapus guru ${nama}? Pastikan tidak sedang mengajar.`)) return
    const res = await hapusGuru(id as any)
    if ((res as any).success) {
      toast.success('Guru dihapus')
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error((res as any).error)
  }

  const toggleSelectGuru = (id: string) => {
    setSelectedGuruIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const toggleSelectAllGuru = () => {
    if (selectedGuruIds.length === guruList.length) setSelectedGuruIds([])
    else setSelectedGuruIds(guruList.map(g => g.id))
  }

  const handleHapusBatch = async () => {
    if (selectedGuruIds.length === 0) return
    if (!await confirm(`Yakin ingin menghapus ${selectedGuruIds.length} guru yang dipilih? Pastikan mereka tidak sedang terpasang di jadwal!`)) return
    setIsDeletingBatch(true)
    const toastId = toast.loading('Menghapus data...')
    const res = await hapusGuruMassal(selectedGuruIds as any)
    setIsDeletingBatch(false)
    toast.dismiss(toastId)
    if ((res as any).success) {
      toast.success('Berhasil', { description: `${(res as any).count} guru dihapus.` })
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
    } else toast.error('Gagal Menghapus', { description: (res as any).error })
  }

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const rows = [
      { 'NAMA LENGKAP': 'Ahmad Fulan', 'GELAR': 'S.Pd.I', 'KODE': 'AHM' },
      { 'NAMA LENGKAP': 'Budi Santoso', 'GELAR': 'M.Ag', 'KODE': 'BUD' },
    ]
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Guru')
    XLSX.writeFile(wb, 'Template_Guru.xlsx')
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      setExcelData(JSON.parse(JSON.stringify(data)))
      toast.success(`${data.length} baris terbaca`)
    } catch {
      toast.error('Gagal baca file')
    }
  }

  const handleSimpanGuru = async () => {
    if (excelData.length === 0) return
    setIsProcessing(true)
    const toastId = toast.loading('Mengimport data guru...')
    const res = await importGuruMassal(excelData)
    setIsProcessing(false)
    toast.dismiss(toastId)
    if ('error' in res) toast.error('Gagal import', { description: (res as any).error })
    else {
      const skippedMsg = ((res as any).skipped ?? 0) > 0 ? ` (${(res as any).skipped} duplikat dilewati)` : ''
      toast.success(`Berhasil import ${(res as any).count} guru${skippedMsg}`)
      setExcelData([])
      await loadInitialData()
      if (selectedMarhalah) await loadKelasByFilter(selectedMarhalah)
      setTab('JADWAL')
    }
  }

  const filteredLocalKelas = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return localKelasList
    return localKelasList.filter(k =>
      String(k.nama_kelas || '').toLowerCase().includes(q) ||
      String(k.marhalah_nama || '').toLowerCase().includes(q)
    )
  }, [localKelasList, search])

  const filteredForDropdown = useMemo(() => guruSearch
    ? guruList.filter(g => g.nama_lengkap.toLowerCase().includes(guruSearch.toLowerCase()))
    : guruList, [guruList, guruSearch])

  const guruOptions = useMemo(() => filteredForDropdown.map((g: any) => ({ value: String(g.id), label: g.nama_lengkap })), [filteredForDropdown])
  const waliOptions = useMemo(() => [{ value: '', label: '- Belum diatur -' }, ...waliUserList.map((u: any) => ({ value: String(u.id), label: u.full_name || '(Tanpa nama)' }))], [waliUserList])

  const { paged: pagedGuruList, totalPages: totalPagesGuruList, safePage: safePageGuruList } = usePagination(guruList, pageSize, page)
  const activeScheduleClass = useMemo(
    () => scheduleModal ? localKelasList.find(k => k.id === scheduleModal.kelasId) : null,
    [localKelasList, scheduleModal]
  )
  const countGabunganFilled = (k: any) => SESSION_META.filter(session => {
    const item = k.gabungan?.[session.serverKey]
    return String(item?.groupKey || '').trim() || String(item?.tempat || '').trim()
  }).length
  const countOverrideFilled = (k: any) => SESSION_META.reduce((total, session) => (
    total + HARI_LIST.filter(day => !isStructuralLibur(day.index, session.serverKey) && k.weekly?.[session.serverKey]?.[day.index]).length
  ), 0)

  return (
    <div className="space-y-6 pb-20">
      <Flex direction={{ base: 'column', sm: 'row' }} gap="md" align={{ sm: 'flex-start' }} justify={{ sm: 'space-between' }}
        pb="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <DashboardPageHeader
          title="Manajemen Guru & Jadwal"
          description="Atur guru default, pembagian harian mingguan, dan wali kelas manual."
          action={(
            <Button component={Link} href="/dashboard/master/wali-kelas/cetak" variant="default" fw={700} leftSection={<Printer className="h-4 w-4" />}>
              Cetak Tugas Mengajar
            </Button>
          )}
          className="flex-1"
        />
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as 'JADWAL' | 'MASTER')}
          data={[
            { value: 'JADWAL', label: <Group gap={6} wrap="nowrap"><School className="w-4 h-4" /> Jadwal Kelas</Group> },
            { value: 'MASTER', label: <Group gap={6} wrap="nowrap"><UserCheck className="w-4 h-4" /> Master Guru</Group> },
          ]}
        />
      </Flex>

      {tab === 'JADWAL' && (
        <Stack gap="md">
          <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'stretch', sm: 'flex-end' }} gap="sm">
            <Flex direction={{ base: 'column', sm: 'row' }} gap="sm" w={{ base: '100%', sm: 'auto' }}>
              <NativeSelect
                leftSection={<Filter className="w-4 h-4" />}
                w={{ base: '100%', sm: 240 }}
                value={selectedMarhalah}
                onChange={async (e) => {
                  const value = e.currentTarget.value
                  setSelectedMarhalah(value); setSearch(''); setJadwalLoaded(false); setKelasList([]); setLocalKelasList([])
                  if (!value) return
                  await loadKelasByFilter(value)
                }}
                data={[{ value: '', label: 'Pilih tingkat / marhalah...' }, { value: 'SEMUA', label: 'Tampilkan semua' }, ...marhalahList.map((m: any) => ({ value: String(m.id), label: m.nama }))]}
              />
              <TextInput leftSection={<Search className="w-4 h-4" />} w={{ base: '100%', sm: 224 }} disabled={!jadwalLoaded} placeholder="Cari kelas..." value={search} onChange={e => setSearch(e.currentTarget.value)} />
              <TextInput leftSection={<Search className="w-4 h-4" />} w={{ base: '100%', sm: 224 }} disabled={!jadwalLoaded} placeholder="Cari guru di dropdown..." value={guruSearch} onChange={e => setGuruSearch(e.currentTarget.value)} />
            </Flex>
            <Button onClick={handleSimpanSemua} loading={isSavingBatch} disabled={loading || !jadwalLoaded} color="indigo" fw={700} leftSection={!isSavingBatch && <Save className="w-4 h-4" />}>
              SIMPAN JADWAL
            </Button>
          </Flex>

          <Alert color="indigo" variant="light" radius="lg" icon={<CalendarDays className="w-4 h-4" />} title="Pembagian Harian Mingguan">
            <Text size="xs" c="dimmed">Kolom default tetap menjadi fallback. Jika sel harian dikosongkan, kelas akan otomatis memakai guru default sesi tersebut.</Text>
          </Alert>

          <Stack gap="md">
            {loading ? (
              <Paper withBorder radius="md" py={80} ta="center"><Loader color="gray" size="lg" mx="auto" /></Paper>
            ) : !jadwalLoaded ? (
              <Paper withBorder radius="md" py={80} ta="center">
                <Text fw={600} c="dimmed">Pilih tingkat / marhalah dulu</Text>
                <Text size="sm" c="dimmed" mt={4}>Konten jadwal kelas akan dimuat setelah filter dipilih.</Text>
              </Paper>
            ) : filteredLocalKelas.length === 0 ? (
              <Paper withBorder radius="md" py={80} ta="center">
                <Text fw={600} c="dimmed">Tidak ada kelas</Text>
                <Text size="sm" c="dimmed" mt={4}>Coba pilih filter lain atau gunakan opsi tampilkan semua.</Text>
              </Paper>
            ) : filteredLocalKelas.map(k => (
              <Paper key={k.id} withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
                <Box px="md" py="sm" bg="gray.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                  <Text fw={700} c="dark.7">{k.nama_kelas}</Text>
                  <Text size="xs" c="dimmed">{k.marhalah_nama || 'Tanpa tingkat'}</Text>
                </Box>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm" p="md">
                  <NativeSelect label="Wali Kelas" value={k.wali_kelas_id} onChange={e => handleChangeLocal(k.id, 'wali_kelas_id', e.currentTarget.value)} data={waliOptions} styles={fieldLabelStyles} />
                  <NativeSelect label="Default Shubuh" value={k.s} onChange={e => handleChangeLocal(k.id, 's', e.currentTarget.value)} data={[{ value: '', label: '- Kosong -' }, ...guruOptions]} styles={fieldLabelStyles} />
                  <NativeSelect label="Default Ashar" value={k.a} onChange={e => handleChangeLocal(k.id, 'a', e.currentTarget.value)} data={[{ value: '', label: '- Kosong -' }, ...guruOptions]} styles={fieldLabelStyles} />
                  <NativeSelect label="Default Maghrib" value={k.m} onChange={e => handleChangeLocal(k.id, 'm', e.currentTarget.value)} data={[{ value: '', label: '- Kosong -' }, ...guruOptions]}
                    styles={{ ...fieldLabelStyles, input: { borderColor: 'var(--mantine-color-yellow-4)', background: 'var(--mantine-color-yellow-0)', fontWeight: 700 } }} />
                </SimpleGrid>

                <Box px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <ScheduleTriggerButton icon={<UsersRound className="h-4 w-4" color="var(--mantine-color-indigo-6)" />} title="Kelas Gabungan" subtitle={`${countGabunganFilled(k)} sesi terisi`} onClick={() => setScheduleModal({ kelasId: k.id, tab: 'gabungan' })} />
                    <ScheduleTriggerButton icon={<CalendarDays className="h-4 w-4" color="var(--mantine-color-indigo-6)" />} title="Override Harian" subtitle={`${countOverrideFilled(k)} sel diubah`} onClick={() => setScheduleModal({ kelasId: k.id, tab: 'override' })} />
                  </SimpleGrid>
                </Box>
              </Paper>
            ))}
          </Stack>
        </Stack>
      )}

      {/* SCHEDULE MODAL */}
      <Modal
        opened={!!(scheduleModal && activeScheduleClass)}
        onClose={() => setScheduleModal(null)}
        size={1100}
        title={scheduleModal && activeScheduleClass ? (
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="indigo.6">{activeScheduleClass.marhalah_nama || 'Tanpa tingkat'}</Text>
            <Text fz="lg" fw={900} c="dark.8">{activeScheduleClass.nama_kelas}</Text>
          </div>
        ) : null}
      >
        {scheduleModal && activeScheduleClass && (
          <Stack gap="md">
            <SegmentedControl
              value={scheduleModal.tab}
              onChange={(v) => setScheduleModal(prev => prev ? { ...prev, tab: v as ScheduleModalTab } : prev)}
              data={[
                { value: 'gabungan', label: <Group gap={6} wrap="nowrap"><UsersRound className="h-4 w-4" /> Kelas Gabungan</Group> },
                { value: 'override', label: <Group gap={6} wrap="nowrap"><CalendarDays className="h-4 w-4" /> Override Harian</Group> },
              ]}
            />

            {scheduleModal.tab === 'gabungan' ? (
              <Stack gap="sm">
                <div>
                  <Text size="sm" fw={700} c="dark.6">Kelas Gabungan per Sesi</Text>
                  <Text size="xs" c="dimmed">Isi kode yang sama pada beberapa kelas jika kelas itu digabung pada sesi tertentu. Jadwal gabungan mengikuti kelas pertama dalam kelompok.</Text>
                </div>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  {SESSION_META.map(session => (
                    <Paper key={session.serverKey} withBorder radius="md" bg="gray.0" p="sm">
                      <Text size="11px" fw={900} tt="uppercase" c="dimmed" mb="xs">{session.label}</Text>
                      <TextInput size="xs" mb="xs" placeholder="Kode gabungan"
                        value={activeScheduleClass.gabungan?.[session.serverKey]?.groupKey || ''}
                        onChange={e => handleChangeGabungan(activeScheduleClass.id, session.serverKey, 'groupKey', e.currentTarget.value)} />
                      <TextInput size="xs" placeholder="Tempat"
                        value={activeScheduleClass.gabungan?.[session.serverKey]?.tempat || ''}
                        onChange={e => handleChangeGabungan(activeScheduleClass.id, session.serverKey, 'tempat', e.currentTarget.value)} />
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            ) : (
              <Stack gap="sm">
                <div>
                  <Text size="sm" fw={700} c="dark.6">Override Harian</Text>
                  <Text size="xs" c="dimmed">Kosongkan sel untuk memakai guru default sesi. Sel abu-abu berarti sesi itu memang libur pengajian.</Text>
                </div>
                <Table.ScrollContainer minWidth={920}>
                  <Table withColumnBorders fz="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Sesi</Table.Th>
                        {HARI_LIST.map(day => <Table.Th key={day.index} ta="center">{day.label}</Table.Th>)}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {SESSION_META.map(session => (
                        <Table.Tr key={session.serverKey}>
                          <Table.Td fw={700} c="dark.7">{session.label}</Table.Td>
                          {HARI_LIST.map(day => {
                            const disabled = isStructuralLibur(day.index, session.serverKey)
                            return (
                              <Table.Td key={`${session.serverKey}-${day.index}`}>
                                <NativeSelect size="xs" disabled={disabled}
                                  value={activeScheduleClass.weekly[session.serverKey]?.[day.index] || ''}
                                  onChange={e => handleChangeWeekly(activeScheduleClass.id, session.serverKey, day.index, e.currentTarget.value)}
                                  data={[{ value: '', label: disabled ? 'Libur' : 'Default' }, ...(disabled ? [] : guruOptions)]} />
                              </Table.Td>
                            )
                          })}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Stack>
            )}
          </Stack>
        )}
      </Modal>

      {tab === 'MASTER' && (
        <Stack gap="lg">
          <Paper withBorder radius="md" p="lg" shadow="sm">
            <Group gap="xs" mb="md" pb="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Plus className="w-5 h-5" color="var(--mantine-color-green-6)" /><Text fw={700} c="dark.7">Tambah Guru Baru (Manual)</Text>
            </Group>
            <form onSubmit={handleTambahGuru}>
              <Flex direction={{ base: 'column', sm: 'row' }} gap="md" align={{ sm: 'flex-end' }}>
                <TextInput label="Nama Lengkap" required value={newGuru.nama} onChange={e => setNewGuru({ ...newGuru, nama: e.currentTarget.value })} placeholder="Contoh: Ahmad" style={{ flex: 1, width: '100%' }} styles={fieldLabelStyles} />
                <TextInput label="Gelar (Opsional)" value={newGuru.gelar} onChange={e => setNewGuru({ ...newGuru, gelar: e.currentTarget.value })} placeholder="S.Pd." w={{ base: '100%', sm: 180 }} styles={fieldLabelStyles} />
                <TextInput label="Kode (Opsional)" value={newGuru.kode} onChange={e => setNewGuru({ ...newGuru, kode: e.currentTarget.value })} placeholder="AHM" w={{ base: '100%', sm: 180 }} styles={fieldLabelStyles} />
                <Button type="submit" color="green" fw={700} w={{ base: '100%', sm: 'auto' }}>Simpan</Button>
              </Flex>
            </form>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Paper radius="md" p="lg" bg="blue.0" style={{ border: '1px solid var(--mantine-color-blue-1)' }}>
              <Stack align="center" gap="sm" ta="center">
                <Download className="w-8 h-8" color="var(--mantine-color-blue-6)" />
                <Text fw={700} c="blue.9">1. Template Data Guru</Text>
                <Button onClick={handleDownloadTemplate} variant="white" color="blue" size="xs" fw={700}>Download .xlsx</Button>
              </Stack>
            </Paper>
            <Paper radius="md" p="lg" bg="green.0" style={{ border: '1px solid var(--mantine-color-green-1)' }}>
              <Stack align="center" gap="sm" ta="center">
                <Upload className="w-8 h-8" color="var(--mantine-color-green-6)" />
                <Text fw={700} c="green.9">2. Upload Excel</Text>
                <FileButton onChange={handleUpload} accept=".xlsx">
                  {(props) => <Button {...props} color="green" size="xs" fw={700}>Pilih File</Button>}
                </FileButton>
              </Stack>
            </Paper>
          </SimpleGrid>

          {excelData.length > 0 && (() => {
            const previewRows = excelData.map(d => {
              const nama = String(d['NAMA LENGKAP'] || d['NAMA'] || d['nama'] || '').trim()
              const isDuplikat = guruList.some(g => g.nama_lengkap.toLowerCase() === nama.toLowerCase())
              return { nama, gelar: d['GELAR'] || d['gelar'] || '-', isDuplikat }
            })
            const dupCount = previewRows.filter(r => r.isDuplikat).length
            const newCount = previewRows.length - dupCount
            return (
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" mb="sm">
                  <div>
                    <Group gap="xs"><List className="w-4 h-4" /><Text fw={700} c="dark.6">Preview ({excelData.length} baris)</Text></Group>
                    <Text size="xs" mt={2}>
                      <Text span c="green.6" fw={700}>{newCount} baru</Text>
                      {dupCount > 0 && <Text span c="red.5" fw={700} ml="xs">{dupCount} duplikat (dilewati)</Text>}
                    </Text>
                  </div>
                  <Button onClick={handleSimpanGuru} loading={isProcessing} disabled={newCount === 0} color="green" fw={700}>Simpan {newCount} Guru Baru</Button>
                </Group>
                <Paper withBorder radius="sm" style={{ maxHeight: 256, overflow: 'auto' }}>
                  <Table fz="sm" stickyHeader>
                    <Table.Thead><Table.Tr><Table.Th>Nama</Table.Th><Table.Th>Gelar</Table.Th><Table.Th ta="center">Status</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {previewRows.map((r, i) => (
                        <Table.Tr key={i} bg={r.isDuplikat ? 'red.0' : undefined}>
                          <Table.Td fw={500} c={r.isDuplikat ? 'red.4' : 'dark.7'} td={r.isDuplikat ? 'line-through' : undefined}>{r.nama}</Table.Td>
                          <Table.Td c="dimmed">{r.gelar}</Table.Td>
                          <Table.Td ta="center">
                            <Badge size="sm" radius="xl" color={r.isDuplikat ? 'red' : 'green'} variant="light">{r.isDuplikat ? 'Duplikat' : 'Baru'}</Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Paper>
            )
          })()}

          <Paper withBorder radius="md" p="md" shadow="sm">
            <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align={{ base: 'flex-start', sm: 'center' }} gap="md" mb="md" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <div>
                <Text fw={700} c="dark.6">Daftar Guru Terdaftar ({guruList.length})</Text>
                <Text size="xs" c="dimmed">Pilih kotak centang untuk menghapus banyak data sekaligus.</Text>
              </div>
              <Group gap="sm">
                <UnstyledButton onClick={toggleSelectAllGuru}>
                  <Group gap="xs" c="dark.5">
                    {selectedGuruIds.length === guruList.length && guruList.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <Text size="sm" fw={500}>Pilih Semua</Text>
                  </Group>
                </UnstyledButton>
                {selectedGuruIds.length > 0 && (
                  <Button onClick={handleHapusBatch} loading={isDeletingBatch} color="red" size="compact-md" fw={700} leftSection={!isDeletingBatch && <Trash2 className="w-4 h-4" />}>
                    Hapus Terpilih ({selectedGuruIds.length})
                  </Button>
                )}
              </Group>
            </Flex>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" style={{ maxHeight: 384, overflow: 'auto' }}>
              {pagedGuruList.map(g => {
                const sel = selectedGuruIds.includes(g.id)
                return (
                  <Paper key={g.id} withBorder radius="md" p="sm" onClick={() => toggleSelectGuru(g.id)}
                    style={{ cursor: 'pointer', background: sel ? 'var(--mantine-color-red-0)' : 'var(--mantine-color-gray-0)', borderColor: sel ? 'var(--mantine-color-red-2)' : undefined }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap" style={{ overflow: 'hidden' }}>
                        {sel ? <CheckSquare className="w-5 h-5 shrink-0" color="var(--mantine-color-red-5)" /> : <Square className="w-5 h-5 shrink-0" color="var(--mantine-color-gray-3)" />}
                        <div style={{ overflow: 'hidden' }}>
                          <Text size="sm" fw={700} truncate c={sel ? 'red.7' : 'dark.7'}>{g.nama_lengkap}</Text>
                          <Text size="xs" c="dimmed">{g.gelar || '-'}</Text>
                        </div>
                      </Group>
                      <ActionIcon variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); handleHapusGuru(g.id, g.nama_lengkap) }} aria-label="Hapus guru">
                        <Trash2 className="w-4 h-4" />
                      </ActionIcon>
                    </Group>
                  </Paper>
                )
              })}
            </SimpleGrid>

            <Pagination
              currentPage={safePageGuruList}
              totalPages={totalPagesGuruList}
              pageSize={pageSize}
              total={guruList.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          </Paper>
        </Stack>
      )}
    </div>
  )
}

function ScheduleTriggerButton({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick}>
      <Paper withBorder radius="md" bg="gray.0" px="md" py="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            {icon}
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={700} c="dark.7">{title}</Text>
              <Text size="xs" c="dimmed" truncate>{subtitle}</Text>
            </div>
          </Group>
          <Settings2 className="h-4 w-4 shrink-0" color="var(--mantine-color-gray-4)" />
        </Group>
      </Paper>
    </UnstyledButton>
  )
}
