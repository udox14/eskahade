# Relevant Routes

| Route | Entry | Layout |
|---|---|---|
| `/dashboard/master/kelas` | `app/dashboard/master/kelas/page.tsx` → `_page-content.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat` | `app/dashboard/keuangan-terpusat/page.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/loket` | `loket/page.tsx` → `_cashier-client.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/kredensial` | `kredensial/page.tsx` → `_credential-client.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/payout` | `payout/page.tsx` → `_payout-client.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/payroll` | `payroll/page.tsx` → `_payroll-client.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/operasi` | `operasi/page.tsx` | Dashboard |
| `/dashboard/keuangan-terpusat/break-glass` | `break-glass/page.tsx` | Dashboard |

All dashboard routes are server-rendered inside `app/dashboard/layout.tsx`. The finance flow is role-aware and keeps the application shell intact.
