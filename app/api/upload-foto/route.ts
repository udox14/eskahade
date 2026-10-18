import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { uploadBase64ImageToR2 } from '@/lib/r2/upload'
import { isFinancialProofKey } from '@/lib/finance/proofs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const base64 = String(body?.base64 || '')
    const folder = String(body?.folder || 'uploads').trim()
    if (isFinancialProofKey(folder)) return NextResponse.json({error:'Gunakan unggahan bukti finansial privat.'},{status:403})
    const filenamePrefix = String(body?.filenamePrefix || session.id || 'file').trim()

    if (!base64.startsWith('data:image/')) {
      return NextResponse.json({ error: 'File harus berupa gambar.' }, { status: 400 })
    }

    const result = await uploadBase64ImageToR2({
      base64,
      folder,
      filenamePrefix,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ url: result.url })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal upload file.' }, { status: 500 })
  }
}
