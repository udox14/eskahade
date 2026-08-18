import io

# (berkas, potongan lama, potongan baru)
EDITS = [
    # TOPUP_PAID: sudah terekam penuh di finance_journals + finance_payment_intents.
    ('lib/finance/payments.ts',
     """      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(
        generateId(), 'TOPUP_PAID', 'PAYMENT_INTENT', intent.id, JSON.stringify({ santriId: intent.santri_id, amountRupiah: intent.amount_rupiah, late: Boolean(late) }),
      ),
""", ''),

    # ACCOUNT_FROZEN: pembekuan dompet wajib punya jejak siapa/kapan/kenapa.
    ('lib/finance/reversals.ts',
     """      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(generateId(),'ACCOUNT_FROZEN_PROVIDER_REVERSAL','PAYMENT_INTENT',intent.id,JSON.stringify({santriId:intent.santri_id,receivableRupiah:shortfall})),
""",
     """      ...(shortfall>0?[db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'FREEZE_WALLET','PAYMENT_INTENT',?,?)`).bind(generateId(),input.actorId,intent.id,JSON.stringify({santriId:intent.santri_id,receivableRupiah:shortfall,reason:'PROVIDER_REVERSAL_RECEIVABLE'}))]:[]),
"""),

    # ALLOCATION_CREATED: sudah terekam penuh di finance_allocations + jurnal.
    ('lib/finance/wallet.ts',
     """      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json)
        VALUES(?,?,?,?,?)`).bind(generateId(), 'ALLOCATION_CREATED', 'ALLOCATION', allocationId, JSON.stringify({ santriId: input.santriId, destination: input.destination, amountRupiah: input.amountRupiah })),
""", ''),

    # POCKET_MONEY_WITHDRAWN: sudah terekam penuh di finance_withdrawals.
    ('lib/finance/withdrawal.ts',
     """      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(
        generateId(), 'POCKET_MONEY_WITHDRAWN', 'WITHDRAWAL', withdrawalId,
        JSON.stringify({ santriId: credential.santri_id, amountRupiah: input.amountRupiah }),
      ),
""", ''),

    # WITHDRAWAL_LIMIT_CHANGED: wali mengubah limit anaknya - jejaknya wajib ada.
    ('app/portal-ortu/(app)/keuangan/actions.ts',
     """    db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(generateId(),'WITHDRAWAL_LIMIT_CHANGED','STUDENT',session.santri_id,JSON.stringify(next)),
""",
     """    db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'GUARDIAN',?,'CHANGE_WITHDRAWAL_LIMIT','STUDENT',?,?)`).bind(generateId(),session.guardian_id||null,session.santri_id,JSON.stringify(next)),
"""),
]

for path, old, new in EDITS:
    s = io.open(path, encoding='utf-8').read()
    if old not in s:
        print('LEWAT (tidak cocok):', path)
        continue
    io.open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1))
    print('ok  ', path)
