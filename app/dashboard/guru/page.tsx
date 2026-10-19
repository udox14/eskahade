import { redirect } from 'next/navigation'

// Preserve the existing sidebar/bookmark URL. The destination applies its own
// page and CRUD authorization before rendering the shared teacher master.
export default function GuruPage() {
  redirect('/dashboard/master/wali-kelas')
}
