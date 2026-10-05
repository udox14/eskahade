'use client';
import { forwardRef } from 'react';
import DocumentLetterhead from '@/components/print/document-letterhead';
import type { LetterheadProfile, LetterheadMode } from '@/lib/print/letterhead';
import type { Interview } from '@/lib/supervisi/types';
import { contextTime, contextBooks } from '@/lib/supervisi/context';
import { SECTIONS, SCALE } from '@/lib/supervisi/instrument';
export const PRINT_CSS = `@page { size:A4 portrait; margin:15mm; }
 html,body { margin:0!important; padding:0!important; background:white!important; }
 .supervisi-print { color:#172033; font-family:Arial,sans-serif; font-size:10pt; line-height:1.55; padding:0!important; width:100%; }
 .supervisi-print h1 { font-size:15pt; text-align:center; margin:12pt 0 4pt; }
 .supervisi-print h2 { font-size:11pt; margin:16pt 0 8pt; break-after:avoid; }
 .supervisi-print .print-question { margin:0 0 10pt; }
 .supervisi-print .question-label { font-weight:600; margin:0 0 3pt; break-after:avoid; }
 .supervisi-print .question-answer { white-space:pre-wrap; overflow-wrap:anywhere; orphans:3; widows:3; }
 .supervisi-print .print-meta { display:grid; grid-template-columns:1fr 1fr; gap:7pt 16pt; margin:15pt 0; overflow-wrap:anywhere; }
 .supervisi-print .print-subtitle { text-align:center; color:#475569; font-size:9pt; }
 .supervisi-print section { break-inside:auto; }
 .supervisi-print .draft-label { text-align:center; font-weight:bold; letter-spacing:2pt; }
 @media print { .supervisi-print { max-width:none!important; border:0!important; box-shadow:none!important; } }
`;
export default forwardRef<HTMLDivElement, {
    interview: Interview;
    profile: LetterheadProfile | null;
    mode: LetterheadMode;
}>(function PrintView({ interview: i, profile, mode }, ref) {
    return <div ref={ref} className="supervisi-print bg-white text-slate-900"><style>{PRINT_CSS}</style><DocumentLetterhead profile={profile} mode={mode}/><h1>Hasil Wawancara Santri</h1><p className="print-subtitle">Instrumen Supervisi dan Pembinaan Pengajar</p>{i.status === 'draft' && <p className="draft-label">DRAFT</p>}<div className="print-meta">{[['Pengajar', i.identity.guru_nama], ['Kegiatan', i.identity.kegiatan_nama], ['Kelas', i.identity.kelas_nama], ['Tahun ajaran', i.identity.tahun_nama], ['Kitab / Mata pelajaran', contextBooks(i.identity)], ['Waktu pengajian', contextTime(i.identity)], ['Tanggal wawancara', i.tanggal], ['Pewawancara', i.identity.pewawancara]].map(([l, v]) => <div key={l}><strong>{l}</strong><br />{v}</div>)}</div><p>Skala: 1 — {SCALE[0]}; 2 — {SCALE[1]}; 3 — {SCALE[2]}; 4 — {SCALE[3]}. Tidak diketahui tidak diberi skor.</p>{SECTIONS.map(s => <section key={s.title}><h2>{s.title}</h2>{s.items.map(item => { const a = i.answers[item.id]; return <div key={item.id} className="print-question"><p className="question-label">{item.label}</p><div className="question-answer">{item.kind === 'text' ? (a?.text || 'Belum diisi') : a?.unknown ? `Tidak diketahui\nCatatan: ${a.note || 'Belum diisi'}` : a?.score ? `${a.score} — ${SCALE[a.score - 1]}` : 'Belum diisi'}</div></div>; })}</section>)}<p style={{ fontSize: '8pt', marginTop: '16pt', color: '#64748b' }}>Identitas santri tidak dicatat. Hasil ini digunakan untuk pembinaan dan peningkatan kualitas pengajian.</p></div>;
});
