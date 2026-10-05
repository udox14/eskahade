'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { ChevronRight, Plus, Search, ClipboardCheck, AlertCircle } from 'lucide-react';
import { getSupervisiHome, getCoverage, getSupervisiAnalytics, getActivityTeachers, startInterview, changeActivityStatus } from './actions';
import ActivityEditor from './activity-editor';
import type { Teacher } from '@/lib/supervisi/types';
import { SCALE } from '@/lib/supervisi/instrument';
import { useRouter } from 'next/navigation';
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles';
const labels = { belum: 'Belum dimulai', draft: 'Draft', selesai: 'Selesai' };
export default function SupervisiHome({ initial }: {
    initial: Awaited<ReturnType<typeof getSupervisiHome>>;
}) {
    const [home, setHome] = useState(initial), [activityId, setActivityId] = useState(initial.activities[0]?.id ?? ''), [tab, setTab] = useState('rekap');
    const [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [kelas, setKelas] = useState(''), [page, setPage] = useState(1);
    const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getCoverage>> | null>(null), [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof getSupervisiAnalytics>> | null>(null);
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [editor, setEditor] = useState<string | null>(null), [starting, setStarting] = useState(false), [teachers, setTeachers] = useState<Teacher[]>([]), [teacherId, setTeacherId] = useState(0), [context, setContext] = useState(''), [busy, setBusy] = useState(false), [reason, setReason] = useState('');
    const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    const router = useRouter(), activity = home.activities.find(a => a.id === activityId), teacher = teachers.find(t => t.id === teacherId);
    useEffect(() => { let active = true; if (!activityId)
        return; const timer = setTimeout(() => { setLoading(true); setError(''); Promise.all([getCoverage(activityId, search, status, kelas, page), tab === 'analitik' ? getSupervisiAnalytics(activityId) : Promise.resolve(null)]).then(([c, a]) => { if (active) {
        setCoverage(c);
        if (a)
            setAnalytics(a);
    } }).catch(() => { if (active)
        setError('Data belum dapat dimuat. Periksa akses atau coba lagi.'); }).finally(() => { if (active)
        setLoading(false); }); }, 250); return () => { active = false; clearTimeout(timer); }; }, [activityId, search, status, kelas, page, tab, home]);
    async function refresh() { const data = await getSupervisiHome(); setHome(data); if (!activityId)
        setActivityId(data.activities[0]?.id ?? ''); }
    async function begin() { setError(''); setBusy(true); try {
        const t = await getActivityTeachers(activityId);
        setTeachers(t);
        setTeacherId(0);
        setContext('');
        setStarting(true);
    }
    catch {
        setError('Daftar guru belum dapat dimuat.');
    }
    finally {
        setBusy(false);
    } }
    async function start() { setBusy(true); setError(''); try {
        const r = await startInterview(activityId, teacherId, context, date);
        if (r.ok)
            router.push(`/dashboard/sekpen/supervisi/${r.data}`);
        else
            setError(r.error);
    }
    catch {
        setError('Wawancara belum dapat dimulai. Coba lagi.');
    }
    finally {
        setBusy(false);
    } }
    async function transition(next: 'terbuka' | 'ditutup') { if (!activity)
        return; setBusy(true); setError(''); try {
        const r = await changeActivityStatus(activity.id, next, activity.revision, reason);
        if (r.ok) {
            setReason('');
            await refresh();
        }
        else
            setError(r.error);
    }
    catch {
        setError('Status kegiatan belum dapat diubah.');
    }
    finally {
        setBusy(false);
    } }
    const totals = coverage?.totals ?? [], n = (s: string) => totals.find(t => t.status === s)?.n ?? 0, total = totals.reduce((a, b) => a + b.n, 0);
    return <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-6">
  <DashboardPageHeader title="Supervisi" description="Dengarkan pengalaman santri, pantau wawancara, dan siapkan bahan pembinaan." action={activity?.status === 'terbuka' ? <button disabled={busy} onClick={begin} className={buttonClass}><Plus size={18}/>Mulai wawancara</button> : undefined}/>
  {error && <div role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18}/>{error}</div>}
  <div className="flex flex-wrap items-end gap-3"><label className="w-full sm:max-w-sm"><span className="mb-1 block text-xs font-medium text-slate-500">Kegiatan supervisi</span><select className={inputClass} value={activityId} onChange={e => { setActivityId(e.target.value); setPage(1); setCoverage(null); setAnalytics(null); setStarting(false); }}><option value="">Pilih kegiatan</option>{home.activities.map(a => <option key={a.id} value={a.id}>{a.nama} · {a.tahun_nama}</option>)}</select></label>{activity && <span className="pb-3 text-sm capitalize text-slate-500">{activity.status}</span>}{home.admin && <button className={secondaryClass} onClick={() => setEditor('new')}><Plus size={16}/>Kegiatan baru</button>}</div>
  <div className="flex gap-6 border-b border-slate-200" role="tablist">{['rekap', 'analitik', ...(home.admin ? ['kegiatan'] : [])].map(t => <button role="tab" aria-selected={tab === t} key={t} onClick={() => { setTab(t); setStarting(false); }} className={`min-h-11 border-b-2 px-1 text-sm font-semibold capitalize ${tab === t ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>{t}</button>)}</div>
  {editor && <ActivityEditor years={home.years} activity={editor === 'new' ? undefined : activity} onClose={() => setEditor(null)} onSaved={async (id) => { await refresh(); setActivityId(id); setEditor(null); }}/>}
  {!activity && !editor && <div className="py-16 text-center text-slate-500"><ClipboardCheck className="mx-auto mb-3" size={32}/><p className="font-semibold text-slate-900">Belum ada kegiatan supervisi.</p><p className="mt-1 text-sm">{home.admin ? 'Buat kegiatan dan pilih guru yang akan diwawancara.' : 'Admin perlu membuka kegiatan terlebih dahulu.'}</p></div>}
  {activity && starting && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Identitas wawancara</h2><p className="text-sm text-slate-500">Satu kelompok santri dari satu kelas. Identitas santri tidak dicatat.</p><label className="block text-sm font-medium">Guru<select className={`${inputClass} mt-1`} value={teacherId} onChange={e => { const id = Number(e.target.value); setTeacherId(id); const c = teachers.find(t => t.id === id)?.contexts ?? []; setContext(c.length === 1 ? c[0].key : ''); }}><option value={0}>Pilih guru</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></label>{teacher && <><label className="block text-sm font-medium">Kelas · waktu · kitab / mata pelajaran<select className={`${inputClass} mt-1`} value={context} onChange={e => setContext(e.target.value)}><option value="">Pilih konteks pengajian</option>{teacher.contexts.map(c => <option key={c.key} value={c.key}>{c.kelas_nama} · {c.hari}, {c.sesi} · {c.kitab_nama} / {c.mapel_nama}</option>)}</select></label>{!teacher.contexts.length && <p role="alert" className="text-sm text-amber-700">Penugasan kitab/mapel belum lengkap. Minta admin memperbaiki master penugasan guru.</p>}</>}<label className="block text-sm font-medium">Tanggal wawancara<input type="date" className={`${inputClass} mt-1`} value={date} onChange={e => setDate(e.target.value)}/></label><div className="flex gap-3"><button disabled={!context || !date || busy} className={buttonClass} onClick={start}>Buka draft<ChevronRight size={16}/></button><button className={secondaryClass} onClick={() => setStarting(false)}>Batal</button></div></section>}
  {activity && tab === 'rekap' && !starting && <>
   <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">{[['Target guru', total], ['Belum dimulai', n('belum')], ['Draft', n('draft')], ['Selesai', n('selesai')]].map(([l, v]) => <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{v}</p></div>)}</div>
   <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]"><label className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input aria-label="Cari guru" placeholder="Cari nama guru…" className={`${inputClass} pl-9`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label><select aria-label="Status wawancara" className={inputClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">Semua status</option>{Object.entries(labels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><select aria-label="Kelas" className={inputClass} value={kelas} onChange={e => { setKelas(e.target.value); setPage(1); }}><option value="">Semua kelas</option>{coverage?.classes.map(k => <option key={k}>{k}</option>)}</select></div>
   {loading ? <div className="space-y-3" aria-label="Memuat rekap">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100"/>)}</div> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="hidden grid-cols-[2fr_1fr_1fr_100px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 sm:grid"><span>Pengajar / kelas</span><span>Status</span><span>Progress</span><span /></div>{coverage?.rows.map(r => <div key={r.guru_id} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[2fr_1fr_1fr_100px] sm:items-center sm:px-5"><div><p className="font-semibold text-slate-900">{r.guru_nama}</p><p className="mt-1 text-xs text-slate-500">{r.kelas.join(', ')}</p></div><div className="text-sm text-slate-600">{labels[r.status]}</div><div className="flex items-center gap-2 text-xs text-slate-500"><progress className="h-1.5 w-24 accent-emerald-600" max={53} value={r.completed_count}/>{r.completed_count}/53</div><div>{r.interview_id ? <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-700" href={`/dashboard/sekpen/supervisi/${r.interview_id}`}>Detail<ChevronRight size={15}/></Link> : r.status === 'belum' && activity.status === 'terbuka' ? <button className="min-h-11 text-sm font-semibold text-emerald-700" onClick={async () => { await begin(); setTeacherId(r.guru_id); }}>Mulai</button> : <span className="text-xs text-slate-400">{r.status === 'belum' ? '—' : 'Petugas lain'}</span>}</div></div>)}{!coverage?.rows.length && <p className="p-8 text-center text-sm text-slate-500">Tidak ada guru yang sesuai filter.</p>}</div>}
   <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{coverage?.total ?? 0} guru · Halaman {page}</span><div className="flex gap-2"><button className={secondaryClass} disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Kembali</button><button className={secondaryClass} disabled={loading || page * 20 >= (coverage?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Lanjut</button></div></div>
  </>}
  {activity && tab === 'analitik' && <section className="space-y-5"><p className="text-sm text-slate-500">{home.all ? 'Seluruh hasil selesai pada kegiatan ini.' : 'Hanya hasil selesai milik Anda.'} Tidak diketahui tidak dihitung sebagai skor nol.</p>{loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-100"/> : analytics?.count ? <><p className="font-semibold text-slate-900">{analytics.count} wawancara selesai</p>{analytics.sections.map(s => <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><h2 className="font-semibold text-slate-900">{s.title}</h2><span className="shrink-0 font-semibold tabular-nums text-emerald-700">{s.average?.toFixed(2) ?? '—'} / 4</span></div><div className="mt-3 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${(s.average ?? 0) / 4 * 100}%` }}/></div><p className="mt-2 text-xs text-slate-500">{s.rated} jawaban dinilai · {s.unknown} tidak diketahui</p><details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-600">Lihat indikator dan distribusi skor</summary><div className="space-y-5">{s.indicators.map(i => <div key={i.id}><p className="text-sm text-slate-700">{i.label}</p><p className="mt-1 text-xs text-slate-500">Rata-rata {i.average?.toFixed(2) ?? '—'} · Dinilai {i.rated} · Tidak diketahui {i.unknown}</p><div className="mt-2 grid gap-2">{i.distribution.map((v, j) => <div key={j} className="grid grid-cols-[1fr_60px] gap-3 text-xs text-slate-500"><span>{j + 1} · {SCALE[j]}</span><span className="text-right tabular-nums">{v}</span></div>)}</div></div>)}</div></details></div>)}</> : <p className="py-12 text-center text-sm text-slate-500">Belum ada hasil selesai yang dapat dianalisis.</p>}</section>}
  {activity && tab === 'kegiatan' && home.admin && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">{activity.nama}</h2><p className="text-sm text-slate-500">{activity.tahun_nama} · {activity.status}. Daftar target dibekukan setelah kegiatan dibuka.</p>{activity.status === 'persiapan' && <div className="flex flex-wrap gap-3"><button className={secondaryClass} onClick={() => setEditor(activity.id)}>Atur target guru</button><button disabled={busy} className={buttonClass} onClick={() => transition('terbuka')}>Buka kegiatan</button></div>}{activity.status === 'terbuka' && <details><summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-700">Tutup kegiatan</summary><p className="mb-3 text-sm text-slate-500">Semua draft dan hasil akan menjadi read-only sampai admin membuka kegiatan kembali.</p><button className={secondaryClass} disabled={busy} onClick={() => transition('ditutup')}>Konfirmasi tutup kegiatan</button></details>}{activity.status === 'ditutup' && <><label className="block text-sm font-medium">Alasan membuka kembali<textarea maxLength={1000} className={`${inputClass} mt-1`} value={reason} onChange={e => setReason(e.target.value)}/></label><button disabled={busy || !reason.trim()} className={buttonClass} onClick={() => transition('terbuka')}>Buka kembali kegiatan</button></>}</section>}
 </div>;
}
