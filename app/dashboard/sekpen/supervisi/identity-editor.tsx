'use client';
import { useState } from 'react';
import { getActivityTeachers, updateInterviewIdentity } from './actions';
import type { Interview, Teacher } from '@/lib/supervisi/types';
import { inputClass, buttonClass, secondaryClass } from '@/components/supervisi/styles';
export default function IdentityEditor({ interview, onSaved, onBusyChange }: {
    interview: Interview;
    onSaved: () => Promise<void>;
    onBusyChange: (busy: boolean) => void;
}) {
    const [teachers, setTeachers] = useState<Teacher[]>([]), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [guru, setGuru] = useState(interview.guru_id), [key, setKey] = useState(interview.identity.key), [error, setError] = useState('');
    async function load() { setBusy(true); setError(''); try {
        setTeachers(await getActivityTeachers(interview.kegiatan_id));
        setOpen(true);
    }
    catch {
        setError('Pilihan identitas belum dapat dimuat.');
    }
    finally {
        setBusy(false);
    } }
    async function save() { setBusy(true); onBusyChange(true); setError(''); try {
        const r = await updateInterviewIdentity(interview.id, interview.revision, guru, key);
        if (r.ok) {
            await onSaved();
            setOpen(false);
        }
        else
            setError(r.error);
    }
    catch {
        setError('Identitas belum tersimpan. Muat ulang untuk memeriksa status.');
    }
    finally {
        setBusy(false);
        onBusyChange(false);
    } }
    const teacher = teachers.find(t => t.id === guru);
    return <div className="space-y-3">{error && <p role="alert" className="text-sm text-amber-700">{error}</p>}{!open ? <button disabled={busy} className={secondaryClass} onClick={load}>Koreksi pilihan guru / kelas</button> : <div className="space-y-3 rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Pilihan hanya dapat dikoreksi sebelum jawaban pertama disimpan.</p><label className="block text-sm font-medium">Guru<select className={`${inputClass} mt-1`} disabled={busy} value={guru} onChange={e => { const id = Number(e.target.value); setGuru(id); const contexts = teachers.find(t => t.id === id)?.contexts ?? []; setKey(contexts.length === 1 ? contexts[0].key : ''); }}>{teachers.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></label><label className="block text-sm font-medium">Kelas · waktu · kitab / mata pelajaran<select className={`${inputClass} mt-1`} disabled={busy} value={key} onChange={e => setKey(e.target.value)}><option value="">Pilih konteks pengajian</option>{teacher?.contexts.map(c => <option key={c.key} value={c.key}>{c.kelas_nama} · {c.hari}, {c.sesi} · {c.kitab_nama} / {c.mapel_nama}</option>)}</select></label><div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy || !key} onClick={save}>Simpan identitas</button><button className={secondaryClass} disabled={busy} onClick={() => setOpen(false)}>Batal</button></div></div>}</div>;
}
