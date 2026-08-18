import io, re

p = 'app/dashboard/keuangan-terpusat/operasi/actions.ts'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        print('  LEWAT:', label)
        return
    s = s.replace(old, new, 1)
    print('  ok   :', label)


rep("import { closeFinancePeriod,approvePeriodReopen,financePeriodReadiness,reopenFinancePeriod } from '@/lib/finance/periods'",
    "import { closeFinancePeriod,financePeriodReadiness,reopenFinancePeriod } from '@/lib/finance/periods'", 'impor periods')

rep("import { importBankStatement,manuallyMatchBankTransaction } from '@/lib/finance/reconciliation'",
    "import { reconciliationChecks,reconciliationTargets,recordReconciliationCheck } from '@/lib/finance/reconciliation'", 'impor reconciliation')

# impor mutasi bank -> checklist
rep("""export async function importBankAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),file=form.get('file');if(!(file instanceof File))return{error:'Pilih file CSV/XLS/XLSX.'};const r=await importBankStatement({file,bankAccountLabel:String(form.get('bankLabel')||'Rekening Utama'),actorId:s.id});if(r.success)revalidatePath(PATH);return r}""",
    """export async function recordReconciliationAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await recordReconciliationCheck({
    periodKey:String(form.get('period')),
    bankAccountLabel:String(form.get('bankLabel')),
    systemTotalRupiah:Number(form.get('systemTotal')),
    statementTotalRupiah:Number(form.get('statementTotal')),
    note:String(form.get('note')||'')||null,
    actorId:s.id,
  })
  if(r.success)refreshOperations()
  return r
}""", 'aksi rekonsiliasi')

rep("""export async function approveReopenAction(form:FormData){const s=await requireFinanceAccess('CHECK'),r=await approvePeriodReopen(String(form.get('period')),s.id,String(form.get('reason')));if(r.success)revalidatePath(PATH);return r}\n""",
    "", 'aksi approve reopen dihapus')

rep("""export async function reopenPeriodAction(form:FormData){const s=await requireFinanceAccess('CONFIGURE'),r=await reopenFinancePeriod(String(form.get('period')),s.id,String(form.get('reason')));if(r.success)revalidatePath(PATH);return r}""",
    """export async function reopenPeriodAction(form:FormData){
  const s=await requireFinanceAccess('CONFIGURE')
  const r=await reopenFinancePeriod({
    periodKey:String(form.get('period')),
    actorId:s.id,
    approvedBy:String(form.get('approvedBy')||''),
    reason:String(form.get('reason')),
  })
  if(r.success)revalidatePath(PATH)
  return r
}""", 'aksi reopen')

# pencocokan manual per baris dihapus
s2 = re.sub(r"export async function manualMatchBankAction\(form:FormData\)\{\n(?:.*?\n)*?\}\n", "", s, count=1)
print(('  ok   : ' if s2 != s else '  LEWAT: ') + 'aksi manual match dihapus')
s = s2

# data: ganti tiga query import/mutasi/kandidat jadi checklist
a = s.index('    periods:await query<any>(')
b = s.index('    paymentReviews:await query<any>(')
s = s[:a] + """    periods:await query<any>(`SELECT * FROM finance_periods ORDER BY period_key DESC LIMIT 24`),
    reconciliationTargets:await reconciliationTargets(),
    reconciliationChecks:await reconciliationChecks(defaultPeriod),
    staff:await mainQuery<any>(`SELECT id,full_name FROM users ORDER BY full_name`),
""" + s[b:]
print('  ok   : data rekonsiliasi')

io.open(p, 'w', encoding='utf-8').write(s)
print('selesai')
