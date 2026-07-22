# Page Dependency Trees

## `/dashboard/master/kelas` (comfort reference, not a template)
- `app/dashboard/master/kelas/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/master/kelas/_page-content.tsx`
    - `app/dashboard/master/kelas/actions.ts`
    - `components/dashboard/page-header.tsx`
      - `lib/utils.ts`
    - `components/ui/confirm-dialog.tsx`

## `/dashboard/keuangan-terpusat`
- `app/dashboard/keuangan-terpusat/page.tsx`
  - `lib/auth/guard.ts`
  - `lib/finance/access.ts`
  - `lib/finance/dashboard.ts`

## `/dashboard/keuangan-terpusat/loket`
- `app/dashboard/keuangan-terpusat/loket/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/keuangan-terpusat/loket/actions.ts`
  - `app/dashboard/keuangan-terpusat/loket/_cashier-client.tsx`
    - `lib/finance/types.ts`

## `/dashboard/keuangan-terpusat/kredensial`
- `app/dashboard/keuangan-terpusat/kredensial/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/keuangan-terpusat/kredensial/actions.ts`
  - `app/dashboard/keuangan-terpusat/kredensial/_credential-client.tsx`
    - `lib/finance/types.ts`

## `/dashboard/keuangan-terpusat/payout`
- `app/dashboard/keuangan-terpusat/payout/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/keuangan-terpusat/payout/actions.ts`
  - `app/dashboard/keuangan-terpusat/payout/_payout-client.tsx`

## `/dashboard/keuangan-terpusat/payroll`
- `app/dashboard/keuangan-terpusat/payroll/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/keuangan-terpusat/payroll/actions.ts`
  - `app/dashboard/keuangan-terpusat/payroll/_payroll-client.tsx`

## `/dashboard/keuangan-terpusat/operasi`
- `app/dashboard/keuangan-terpusat/operasi/page.tsx`
  - `lib/auth/guard.ts`
  - `app/dashboard/keuangan-terpusat/operasi/actions.ts`

## Shared dashboard shell for every route above
- `app/dashboard/layout.tsx`
  - `components/layout/client-layout.tsx`
    - `components/layout/sidebar.tsx`
    - `components/layout/header.tsx`
    - `components/layout/bottom-nav.tsx`
    - `lib/utils.ts`
  - `components/dashboard/page-header.tsx`
  - `app/globals.css`
  - `tailwind.config.ts`
