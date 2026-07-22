import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { paymentGateway } from './gateway'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'

type PaymentIntentRow = {
  id: string
  merchant_order_id: string
  santri_id: string
  guardian_id: string | null
  amount_rupiah: number
  gateway_fee_rupiah: number
  charged_amount_rupiah: number
  status: string
  expires_at: string
  journal_id: string | null
}

function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function createTopupIntent(input: {
  santriId: string
  guardianId?: string | null
  amountRupiah: number
  gatewayFeeRupiah: number
  paymentMethod: string
  customerName: string
  email?: string | null
  phone?: string | null
}) {
  try {
    assertIntegerRupiah(input.amountRupiah)
    if (!Number.isSafeInteger(input.gatewayFeeRupiah) || input.gatewayFeeRupiah < 0) throw new Error('Biaya gateway tidak valid.')
    const db = await getDB()
    await db.prepare(`UPDATE finance_payment_intents SET status='EXPIRED',updated_at=datetime('now')
      WHERE santri_id=? AND status='PENDING' AND datetime(expires_at)<=datetime('now')`).bind(input.santriId).run()
    const existing = await queryOne<{ id: string }>(`SELECT id FROM finance_payment_intents WHERE santri_id=? AND status='PENDING'`, [input.santriId])
    if (existing) return { success: false as const, error: 'Masih ada instruksi top-up aktif untuk santri ini.' }

    const ttlHours = Math.max(1, Math.min(168, Number((await queryOne<{ value: string }>(`SELECT value FROM finance_settings WHERE key='finance_payment_intent_ttl_hours'`))?.value || 24)))
    const id = generateId()
    const merchantOrderId = `SKH-${Date.now()}-${id.slice(0, 8)}`
    const charged = input.amountRupiah + input.gatewayFeeRupiah
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString()
    await db.prepare(`INSERT INTO finance_payment_intents
      (id,merchant_order_id,santri_id,guardian_id,payment_method,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status,expires_at)
      VALUES(?,?,?,?,?,?,?,?,'PENDING',?)`).bind(
        id, merchantOrderId, input.santriId, input.guardianId || null, input.paymentMethod,
        input.amountRupiah, input.gatewayFeeRupiah, charged, expiresAt,
      ).run()

    try {
      const base = publicBaseUrl()
      const gateway = paymentGateway()
      const result = await gateway.createPayment({
        merchantOrderId, amountRupiah: charged, paymentMethod: input.paymentMethod,
        customerName: input.customerName, email: input.email, phone: input.phone,
        returnUrl: `${base}/portal-ortu/keuangan?topup=${id}`,
        callbackUrl: `${base}/api/finance/gateway/duitku/callback`, expiryMinutes: ttlHours * 60,
      })
      await db.prepare(`UPDATE finance_payment_intents SET payment_url=?,va_number=?,qr_string=?,provider_reference=?,updated_at=datetime('now') WHERE id=? AND status='PENDING'`).bind(
        result.paymentUrl || null, result.vaNumber || null, result.qrString || null, result.providerReference || null, id,
      ).run()
      return { success: true as const, intentId: id, merchantOrderId, expiresAt, chargedAmountRupiah: charged, ...result }
    } catch (error) {
      await db.prepare(`UPDATE finance_payment_intents SET status='CANCELLED',updated_at=datetime('now') WHERE id=? AND status='PENDING'`).bind(id).run()
      throw error
    }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function processDuitkuCallback(payload: Record<string, string>) {
  const gateway = paymentGateway('DUITKU')
  if (!gateway.verifyCallback(payload)) return { success: false as const, status: 401, error: 'Signature tidak valid.' }
  const orderId = String(payload.merchantOrderId || '')
  const eventKey = gateway.callbackEventKey(payload)
  const intent = await queryOne<PaymentIntentRow>(`SELECT id,merchant_order_id,santri_id,guardian_id,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status,expires_at,journal_id
    FROM finance_payment_intents WHERE merchant_order_id=?`, [orderId])
  if (!intent) return { success: false as const, status: 404, error: 'Order tidak ditemukan.' }
  if (Number(payload.amount) !== Number(intent.charged_amount_rupiah)) return { success: false as const, status: 400, error: 'Nominal callback tidak cocok.' }
  if (String(payload.resultCode) !== '00') return { success: true as const, ignored: true }

  try {
    const db = await getDB()
    const eventId = generateId()
    const journal = prepareJournalStatements(db, {
      idempotencyKey: `duitku-paid:${orderId}`,
      description: `Top-up Duitku ${orderId}`,
      sourceType: 'TOPUP', sourceId: intent.id, externalReference: payload.reference || null,
      actorType: 'GATEWAY', actorId: 'DUITKU',
      entries: [
        { accountCode: '1102', side: 'DEBIT', amountRupiah: intent.charged_amount_rupiah, santriId: intent.santri_id },
        { accountCode: '2101', side: 'CREDIT', amountRupiah: intent.amount_rupiah, santriId: intent.santri_id },
        ...(intent.gateway_fee_rupiah > 0 ? [{ accountCode: '4104' as const, side: 'CREDIT' as const, amountRupiah: intent.gateway_fee_rupiah, santriId: intent.santri_id }] : []),
      ],
    })
    const late = new Date(intent.expires_at).getTime() < Date.now() ? 1 : 0
    await db.batch([
      db.prepare(`INSERT INTO finance_gateway_events(id,provider,event_key,event_type,merchant_order_id,signature_valid,payload_json)
        VALUES(?,'DUITKU',?,'PAID',?,1,?)`).bind(eventId, eventKey, orderId, JSON.stringify(payload)),
      db.prepare(`UPDATE finance_payment_intents SET status='PAID',paid_at=datetime('now'),late_paid=?,review_status=CASE WHEN ?=1 THEN 'REQUIRED' ELSE review_status END,provider_reference=COALESCE(?,provider_reference),updated_at=datetime('now')
        WHERE id=? AND status IN ('PENDING','EXPIRED')`).bind(late, late, payload.reference || null, intent.id),
      ...journal.statements,
      ...prepareWalletStatements(db, journal.journalId, [{
        idempotencyKey: `topup:${orderId}`, santriId: intent.santri_id, walletKind: 'TITIPAN',
        amountRupiah: intent.amount_rupiah, movementType: 'TOPUP', referenceType: 'PAYMENT_INTENT', referenceId: intent.id,
      }]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`UPDATE finance_payment_intents SET journal_id=? WHERE id=? AND status='PAID' AND journal_id IS NULL`).bind(journal.journalId, intent.id),
      db.prepare(`UPDATE finance_gateway_events SET processing_status='PROCESSED',processed_at=datetime('now') WHERE id=?`).bind(eventId),
      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(
        generateId(), 'TOPUP_PAID', 'PAYMENT_INTENT', intent.id, JSON.stringify({ santriId: intent.santri_id, amountRupiah: intent.amount_rupiah, late: Boolean(late) }),
      ),
    ])
    return { success: true as const, intentId: intent.id, journalId: journal.journalId }
  } catch (error) {
    const posted = await queryOne<{ journal_id: string | null }>(`SELECT journal_id FROM finance_payment_intents WHERE id=?`, [intent.id]).catch(() => null)
    if (posted?.journal_id) return { success: true as const, intentId: intent.id, journalId: posted.journal_id, duplicate: true }
    return { success: false as const, status: 500, ...financeError(error) }
  }
}
