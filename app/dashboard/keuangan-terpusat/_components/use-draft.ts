'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'finance-draft:'

/**
 * State yang ikut tersimpan di `sessionStorage`.
 *
 * Formulir keuangan terpanjang — jurnal manual multi-baris dan kebijakan
 * payroll — sebelumnya hilang total begitu halaman disegarkan atau pengguna
 * pindah sebentar untuk memeriksa angka. Draf disimpan per tab peramban saja
 * (`sessionStorage`, bukan `localStorage`) supaya tidak menghidupkan kembali
 * isian lama berhari-hari kemudian.
 */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [restored, setRestored] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    // Ditunda satu frame agar tidak memanggil setState di badan effect, dan agar
    // render pertama tetap sama dengan hasil server.
    const timer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(`${PREFIX}${key}`)
        if (!saved) return
        setValue(JSON.parse(saved) as T)
        setRestored(true)
      } catch { /* draf rusak atau storage diblokir — abaikan saja */ }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    try { sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value)) } catch { /* abaikan */ }
  }, [key, value])

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(`${PREFIX}${key}`) } catch { /* abaikan */ }
    setValue(initial)
    setRestored(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { value, setValue, clear, restored, dismissRestored: useCallback(() => setRestored(false), []) }
}
