'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Printer, AlertCircle } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { useReactToPrint } from '@/lib/pdf/client';
import type { resolveDocumentLetterhead } from '@/lib/print/letterhead-server';
import type { Interview } from '@/lib/supervisi/types';
import { AutosaveQueue } from '@/lib/supervisi/autosave';
import { ITEMS, SECTIONS, SCALE, OPENING, GUIDANCE, CLOSING, isAnswered, completedCount, type Answer } from '@/lib/supervisi/instrument';
import { getInterview, getInterviewHistory, saveInterview } from './actions';
import { buttonClass, inputClass, secondaryClass } from '@/components/supervisi/styles';
import PrintView, { PRINT_CSS } from './print-view';
import IdentityEditor from './identity-editor';
type History = Awaited<ReturnType<typeof getInterviewHistory>>;
export default function InterviewForm({ initial, history: initialHistory, letterhead }: {
    initial: Interview;
    history: History;
    letterhead: Awaited<ReturnType<typeof resolveDocumentLetterhead>>;
}) {
    const [interview, setInterview] = useState(initial), [answers, setAnswers] = useState(initial.answers), [tanggal, setTanggal] = useState(initial.tanggal), [position, setPosition] = useState(initial.editable ? 0 : 54), [history, setHistory] = useState(initialHistory);
    const [, render] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState(''), [latest, setLatest] = useState<Interview | null>(null), [printable, setPrintable] = useState(initial), [printOpen, setPrintOpen] = useState(false);
    const [queue] = useState(() => new AutosaveQueue(initial.id, initial.revision, saveInterview, () => render(n => n + 1)));
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null), printRef = useRef<HTMLDivElement>(null), router = useRouter();
    const item = ITEMS[position - 1], answer = item ? answers[item.id] ?? {} : {}, count = completedCount(answers), editable = interview.editable && !busy;
    const sectionIndex = item ? SECTIONS.findIndex(s => s.items.some(i => i.id === item.id)) : -1;
    const sectionStarts = SECTIONS.map((_, i) => 1 + SECTIONS.slice(0, i).reduce((n, s) => n + s.items.length, 0));
    const activeStep = position === 0 ? 0 : position === 54 ? 11 : sectionIndex + 1;
    const steps = [{ title: 'Identitas & pembukaan', position: 0, complete: true }, ...SECTIONS.map((s, i) => ({ title: s.title, position: sectionStarts[i], complete: s.items.every(item => isAnswered(item, answers[item.id])) })), { title: 'Review & penutup', position: 54, complete: interview.status === 'selesai' }];
    useEffect(() => {
        queue.stopped = false;
        const before = (e: BeforeUnloadEvent) => { if (queue.dirty) {
            e.preventDefault();
            e.returnValue = '';
        } };
        const online = () => { void queue.flush(); };
        window.addEventListener('beforeunload', before);
        window.addEventListener('online', online);
        const retry = setInterval(() => { if (queue.dirty && !queue.conflict)
            void queue.flush(); }, 5000);
        return () => { queue.stopped = true; window.removeEventListener('beforeunload', before); window.removeEventListener('online', online); clearInterval(retry); if (timer.current)
            clearTimeout(timer.current); };
    }, [queue]);
    function change(value: Answer, immediate = false) { if (!item || !editable)
        return; setAnswers(a => ({ ...a, [item.id]: value })); queue.edit(item.id, value); if (timer.current)
        clearTimeout(timer.current); if (immediate)
        void queue.flush();
    else
        timer.current = setTimeout(() => void queue.flush(), 600); }
    function navigate(n: number) { if (busy) return; if (timer.current)
        clearTimeout(timer.current); void queue.flush(); setPosition(Math.max(0, Math.min(54, n))); }
    async function leave() { if (busy) return; if (queue.dirty && !await queue.flush()) {
        setError('Ada jawaban belum tersimpan. Selesaikan penyimpanan sebelum kembali ke rekap.');
        return;
    } router.push('/dashboard/sekpen/supervisi'); }
    async function refresh() { const [i, h] = await Promise.all([getInterview(interview.id), getInterviewHistory(interview.id)]); setInterview(i); setAnswers(i.answers); setTanggal(i.tanggal); setHistory(h); queue.revision = i.revision; }
    async function finalize() { setBusy(true); setError(''); try {
        if (!await queue.flush()) {
            setError(queue.error || 'Jawaban belum tersimpan.');
            return;
        }
        const r = await saveInterview({ id: interview.id, revision: queue.revision, operationId: crypto.randomUUID(), patch: {}, action: 'submit' });
        if (!r.ok)
            setError(r.error);
        else {
            await refresh();
            setPosition(54);
        }
    }
    catch {
        setError('Hasil belum dapat diselesaikan. Coba lagi.');
    }
    finally {
        setBusy(false);
    } }
    async function reopen() { setBusy(true); setError(''); try {
        const r = await saveInterview({ id: interview.id, revision: queue.revision, operationId: crypto.randomUUID(), patch: {}, action: 'reopen', reason });
        if (!r.ok)
            setError(r.error);
        else {
            await refresh();
            setReason('');
        }
    }
    catch {
        setError('Hasil belum dapat dibuka kembali.');
    }
    finally {
        setBusy(false);
    } }
    async function fetchLatest() { try {
        setLatest(await getInterview(interview.id));
    }
    catch {
        setError('Versi terbaru tidak dapat dimuat. Periksa akses Anda.');
    } }
    async function rebase() { if (!latest)
        return; if (!latest.editable) {
        setError('Versi terbaru sudah terkunci. Perubahan lokal tetap ditampilkan tetapi tidak dapat disimpan.');
        return;
    } const local = { ...(queue.inflight?.patch ?? {}), ...queue.pending }; setAnswers({ ...latest.answers, ...local }); setTanggal(queue.tanggal ?? queue.inflight?.tanggal ?? latest.tanggal); setInterview(latest); queue.rebase(latest.revision); setLatest(null); setError(''); await queue.flush(); }
    const print = useReactToPrint({ contentRef: printRef, documentTitle: `Supervisi-${interview.identity.guru_nama}-${tanggal}`, pageStyle: PRINT_CSS, pdfOptions: { format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }, printBackground: true, preferCSSPageSize: true }, onBeforePrint: async () => { if (queue.dirty && !await queue.flush())
            throw new Error('Jawaban belum tersimpan.'); const i = await getInterview(interview.id); setPrintable(i); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); }, onPrintError: () => setError('PDF belum dapat dibuat. Pastikan jawaban tersimpan, periksa koneksi dan konfigurasi PDF, lalu coba lagi.') });
    async function showPrint() { setBusy(true); setError(''); try {
        if (queue.dirty && !await queue.flush()) {
            setError('Simpan jawaban terlebih dahulu sebelum mencetak.');
            return;
        }
        setPrintable(await getInterview(interview.id));
        setPrintOpen(true);
    }
    catch {
        setError('Hasil cetak tidak dapat dimuat. Periksa akses Anda.');
    }
    finally {
        setBusy(false);
    } }
    const status = queue.saving ? 'Menyimpan…' : queue.dirty ? 'Belum tersimpan' : 'Tersimpan';
    return <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 sm:p-6">
  <button onClick={leave} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500"><ArrowLeft size={16}/>Rekap supervisi</button>
  <DashboardPageHeader title={interview.identity.guru_nama} description={`${interview.identity.kelas_nama} · ${interview.identity.kitab_nama} · ${interview.status === 'draft' ? 'Draft wawancara' : 'Wawancara selesai'}`} action={<button className={secondaryClass} disabled={busy || queue.saving} onClick={showPrint}><Printer size={16}/>Cetak / PDF</button>}/>
  <div className="space-y-2"><div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{count} dari 53 item terisi · {Math.round(count / 53 * 100)}%</span><span role="status" aria-live="polite" className={queue.dirty ? 'text-amber-700' : 'text-slate-500'}>{status}</span></div><progress aria-label="Progress wawancara" max={53} value={count} className="h-2 w-full accent-emerald-600"/></div>
  {(error || queue.error) && <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><div className="flex gap-2"><AlertCircle size={18} className="shrink-0"/><span>{error || queue.error}</span></div>{queue.conflict || error.startsWith('CONFLICT:') ? <button onClick={fetchLatest} className={secondaryClass}>Bandingkan versi terbaru</button> : queue.dirty && <button onClick={() => void queue.flush()} className={secondaryClass}>Coba simpan lagi</button>}</div>}
  {latest && <section className="space-y-4 rounded-xl border border-amber-200 bg-white p-4"><h2 className="font-semibold">Periksa perubahan sebelum menyimpan ulang</h2><p className="text-sm text-slate-500">Perubahan lokal Anda tetap ada. Menyimpan ulang akan mempertahankan versi terbaru untuk item yang tidak Anda ubah.</p>{Object.entries({ ...queue.inflight?.patch, ...queue.pending }).map(([id, a]) => <div key={id} className="border-t border-slate-100 pt-3 text-sm"><p className="font-medium">{ITEMS.find(i => i.id === id)?.label}</p><p className="mt-2 whitespace-pre-wrap text-slate-500">Versi terbaru: {latest.answers[id]?.text ?? (latest.answers[id]?.unknown ? `Tidak diketahui: ${latest.answers[id]?.note}` : latest.answers[id]?.score ?? 'Kosong')}</p><p className="mt-1 whitespace-pre-wrap text-emerald-700">Perubahan Anda: {a.text ?? (a.unknown ? `Tidak diketahui: ${a.note}` : a.score ?? 'Kosong')}</p></div>)}<button className={buttonClass} onClick={rebase} disabled={!latest.editable}>Simpan ulang perubahan saya</button></section>}
  <nav aria-label="Langkah wawancara" className="space-y-2"><div className="grid grid-cols-6 gap-1 sm:grid-cols-12">{steps.map((s, i) => <button key={s.title} aria-label={`Langkah ${i + 1}: ${s.title}`} aria-current={activeStep === i ? 'step' : undefined} title={s.title} onClick={() => navigate(s.position)} className={`flex min-h-11 items-center justify-center border-b-2 text-xs font-semibold ${activeStep === i ? 'border-emerald-600 text-emerald-700' : s.complete ? 'border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-400'}`}>{s.complete && activeStep !== i ? <Check size={14}/> : i + 1}</button>)}</div><p className="text-xs text-slate-500">Langkah {activeStep + 1} dari 12 · <span className="font-medium text-slate-700">{steps[activeStep].title}</span></p></nav>
  {position === 0 && interview.editable && Object.keys(answers).length === 0 && !queue.dirty && <IdentityEditor interview={{...interview,revision:queue.revision}} onSaved={refresh} onBusyChange={setBusy}/>}
  {position === 0 && <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Identitas & pembukaan</h2><dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Pengajar', interview.identity.guru_nama], ['Kelas', interview.identity.kelas_nama], ['Kitab / Mata pelajaran', `${interview.identity.kitab_nama} / ${interview.identity.mapel_nama}`], ['Waktu pengajian', `${interview.identity.hari}, ${interview.identity.sesi}`], ['Pewawancara', interview.identity.pewawancara], ['Kegiatan', interview.identity.kegiatan_nama]].map(([l, v]) => <div key={l}><dt className="text-xs text-slate-500">{l}</dt><dd className="mt-1 font-medium text-slate-900">{v}</dd></div>)}</dl><label className="block text-sm font-medium">Tanggal wawancara<input type="date" disabled={!editable} className={`${inputClass} mt-1`} value={tanggal} onChange={e => { setTanggal(e.target.value); queue.setDate(e.target.value); if (timer.current)
        clearTimeout(timer.current); timer.current = setTimeout(() => void queue.flush(), 600); }} onBlur={() => void queue.flush()}/></label><div className="border-t border-slate-100 pt-5"><h3 className="font-semibold text-slate-900">Petunjuk wawancara</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{GUIDANCE.map(g => <li key={g}>{g}</li>)}</ul><p className="mt-5 text-xs font-medium text-slate-500">Kalimat pembuka</p><blockquote className="mt-2 border-l-2 border-emerald-500 pl-4 text-sm leading-7 text-slate-700">“{OPENING}”</blockquote></div></section>}
  {item && <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"><p className="text-xs font-medium text-slate-500">{SECTIONS[sectionIndex].title} · Item {position} dari 53</p><h2 id="question-label" className="text-lg font-semibold leading-7 text-slate-900">{item.label}</h2>{item.kind === 'score' ? <><p className="text-sm leading-6 text-slate-500">Pilih berdasarkan kecenderungan jawaban santri. Jika tidak dapat dinilai dari pengalaman santri, pilih Tidak diketahui dan isi catatan.</p><div role="radiogroup" aria-labelledby="question-label" className="grid grid-cols-2 gap-3">{SCALE.map((label, i) => <button role="radio" aria-checked={!answer.unknown && answer.score === i + 1} key={label} disabled={!editable} onClick={() => change({ score: i + 1, unknown: false }, true)} className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${!answer.unknown && answer.score === i + 1 ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><span className="mb-1 block text-xl font-semibold">{i + 1}</span><span className="text-xs leading-5">{label}</span></button>)}<button role="radio" aria-checked={!!answer.unknown} disabled={!editable} onClick={() => change({ unknown: true, score: null, note: answer.note ?? '' }, true)} className={`col-span-2 min-h-11 rounded-lg border px-4 py-3 text-left text-sm ${answer.unknown ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>Tidak diketahui</button></div>{answer.unknown && <label className="block text-sm font-medium">Catatan Tidak diketahui <span className="text-red-600">*</span><textarea disabled={!editable} maxLength={10000} rows={4} className={`${inputClass} mt-2 resize-y`} value={answer.note ?? ''} onChange={e => change({ ...answer, note: e.target.value })} onBlur={() => void queue.flush()}/>{!answer.note?.trim() && <span className="mt-1 block text-xs text-amber-700">Isi alasan indikator tidak dapat dinilai.</span>}</label>}</> : <><p className="text-sm text-slate-500">Rangkum jawaban kelompok santri tanpa mencantumkan identitas. Jika tidak ada temuan, tuliskan secara eksplisit.</p><textarea aria-labelledby="question-label" disabled={!editable} maxLength={10000} rows={8} className={`${inputClass} resize-y leading-7`} placeholder="Tuliskan rangkuman jawaban…" value={answer.text ?? ''} onChange={e => change({ text: e.target.value })} onBlur={() => void queue.flush()}/><p className="text-xs text-slate-400">{answer.text?.length ?? 0}/10.000 karakter · Wajib diisi</p></>}<div className="flex items-center gap-2 text-xs text-slate-500">{isAnswered(item, answer) ? <><Check size={14} className="text-emerald-600"/>Item sudah terisi</> : 'Item belum lengkap'}</div></section>}
  {position === 54 && <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Review & penutup</h2><p className="text-sm leading-6 text-slate-600">{CLOSING}</p>{SECTIONS.map((s, si) => <details key={s.title} open={s.items.some(i => !isAnswered(i, answers[i.id]))}><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-slate-100 py-3 text-sm font-semibold text-slate-800"><span>{s.title}</span><span className="shrink-0 text-xs text-slate-500">{s.items.filter(i => isAnswered(i, answers[i.id])).length}/{s.items.length}</span></summary>{s.items.map((i, index) => <button key={i.id} className="block min-h-11 w-full border-t border-slate-50 py-3 text-left" onClick={() => navigate(sectionStarts[si] + index)}><span className="block text-sm text-slate-700">{i.label}</span><span className={`mt-1 block whitespace-pre-wrap text-xs leading-6 ${isAnswered(i, answers[i.id]) ? 'text-slate-500' : 'text-amber-700'}`}>{i.kind === 'text' ? (answers[i.id]?.text || 'Belum diisi') : answers[i.id]?.unknown ? `Tidak diketahui · ${answers[i.id]?.note || 'Catatan belum diisi'}` : answers[i.id]?.score ? `${answers[i.id]?.score} — ${SCALE[Number(answers[i.id]?.score) - 1]}` : 'Belum diisi'}</span></button>)}</details>)}{interview.editable && <><p className="text-sm text-slate-500">Setelah diselesaikan, hasil terkunci. Koreksi berikutnya memerlukan admin membuka kembali hasil.</p><button className={`${buttonClass} w-full`} disabled={busy || count !== 53 || queue.dirty || queue.saving || queue.conflict} onClick={finalize}>Selesaikan wawancara</button>{count !== 53 && <p className="text-xs text-amber-700">Lengkapi {53 - count} item yang belum terisi.</p>}</>}{interview.admin && interview.status === 'selesai' && interview.activityOpen && <details><summary className="min-h-11 cursor-pointer text-sm font-medium text-slate-600">Buka kembali hasil untuk koreksi</summary><label className="mt-3 block text-sm font-medium">Alasan membuka kembali<textarea className={`${inputClass} mt-1`} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label><button className={`${secondaryClass} mt-3`} disabled={busy || !reason.trim()} onClick={reopen}>Konfirmasi buka kembali</button></details>}</section>}
  <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur-sm"><button disabled={position === 0} className={secondaryClass} onClick={() => navigate(position - 1)}><ChevronLeft size={16}/>Kembali</button><span className="text-xs text-slate-400">{position === 0 ? 'Pembukaan' : position === 54 ? 'Review' : `${position}/53`}</span><button disabled={position === 54} className={buttonClass} onClick={() => navigate(position + 1)}>{position === 53 ? 'Review' : 'Lanjut'}<ChevronRight size={16}/></button></div>
  <details className="text-sm"><summary className="min-h-11 cursor-pointer font-medium text-slate-500">Riwayat perubahan</summary><ul className="space-y-3 border-l border-slate-200 pl-4">{history.map(h => <li key={h.id}><p className="text-slate-700">{{ start: 'Mulai draft', save: 'Simpan jawaban', submit: 'Selesai', reopen: 'Buka kembali', identity: 'Koreksi identitas' }[h.action] ?? h.action} · {h.actor_name}</p><p className="text-xs text-slate-400">{new Date(h.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} · Revisi {h.revision}</p>{h.reason && <p className="mt-1 text-xs text-slate-500">{h.reason}</p>}</li>)}</ul></details>
  {printOpen && <section className="space-y-4 border-t border-slate-200 pt-5"><div className="flex flex-wrap gap-3"><button className={buttonClass} onClick={() => void print()}><Printer size={16}/>Cetak / Simpan PDF</button><button className={secondaryClass} onClick={() => setPrintOpen(false)}>Tutup preview</button></div><div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6"><PrintView ref={printRef} interview={printable} profile={letterhead.profile} mode={letterhead.mode}/></div></section>}
 </div>;
}
