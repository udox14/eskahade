import { execute } from './lib/db/index';

async function main() {
    await execute("UPDATE fitur_akses SET title = 'Ruangan EHB' WHERE href = '/dashboard/ehb/ruangan'");
    await execute("UPDATE fitur_akses SET title = 'Pengawas EHB' WHERE href = '/dashboard/ehb/pengawas'");
    await execute("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/ruangan/plotting'");
    await execute("DELETE FROM fitur_akses WHERE href = '/dashboard/ehb/pengawas/plotting'");
    console.log("Updated fitur_akses");
}

main().catch(console.error);
