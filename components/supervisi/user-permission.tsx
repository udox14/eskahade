'use client';
import { useEffect, useState } from 'react';
import { getSupervisiUserPermission, setSupervisiUserPermission } from '@/app/dashboard/sekpen/supervisi/actions';
export default function SupervisiUserPermission({ userId }: {
    userId: string;
}) {
    const [all, setAll] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
    useEffect(() => { let active = true; getSupervisiUserPermission(userId).then(v => { if (active)
        setAll(v); }).catch(() => { if (active)
        setError('Izin Supervisi belum dapat dimuat. Jalankan migration modul terlebih dahulu.'); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [userId]);
    async function toggle() { setLoading(true); setError(''); try {
        const r = await setSupervisiUserPermission(userId, !all);
        if (r.ok)
            setAll(!all);
        else
            setError(r.error);
    }
    catch {
        setError('Izin belum tersimpan.');
    }
    finally {
        setLoading(false);
    } }
    return <div className="mb-4 rounded-lg border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">Supervisi</p><p className="mt-1 text-xs leading-5 text-slate-500">Berikan akses modul melalui daftar fitur di bawah. Izin tambahan ini berlaku setelah akses modul diberikan.</p><label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 accent-emerald-600" disabled={loading || !!error} checked={all} onChange={toggle}/>Lihat dan kelola semua draft, analitik, serta cetak hasil</label>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}</div>;
}
