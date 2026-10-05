import { getSupervisiHome } from './actions';
import SupervisiHome from './home';
export const dynamic = 'force-dynamic';
export default async function Page() {
    let initial;
    try {
        initial = await getSupervisiHome();
    }
    catch {
        initial = null;
    }
    if (!initial)
        return <div className="p-6"><h1 className="text-xl font-bold text-slate-900">Supervisi</h1><p className="mt-3 text-sm text-slate-600">Anda belum diberi akses Supervisi, atau modul belum siap. Hubungi admin untuk memeriksa akses dan migration.</p></div>;
    return <SupervisiHome initial={initial}/>;
}
