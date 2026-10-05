import { getInterview, getInterviewHistory } from '../actions';
import { resolveDocumentLetterhead } from '@/lib/print/letterhead-server';
import InterviewForm from '../interview-form';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    let data;
    try {
        const interview = await getInterview(id);
        const [history, letterhead] = await Promise.all([getInterviewHistory(id), resolveDocumentLetterhead('supervisi')]);
        data = { interview, history, letterhead };
    }
    catch {
        data = null;
    }
    if (!data)
        return <div className="p-6"><h1 className="text-xl font-bold text-slate-900">Wawancara tidak dapat dibuka</h1><p className="mt-2 text-sm text-slate-600">Periksa akses atau hubungi admin.</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700" href="/dashboard/sekpen/supervisi">Kembali ke rekap</Link></div>;
    return <InterviewForm initial={data.interview} history={data.history} letterhead={data.letterhead}/>;
}
