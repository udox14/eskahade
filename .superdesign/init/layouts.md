# Shared Layouts

## Dashboard server layout
- Source: `app/dashboard/layout.tsx`
- Authenticates the user, resolves effective multi-roles and feature access, then renders `ClientLayout`.
- Full implementation must be passed from the source file for page drafts.

## ClientLayout
- Source: `components/layout/client-layout.tsx`
- Fixed desktop sidebar (240px expanded / 64px collapsed), sticky 48px header, scrollable `bg-slate-50/50` main area, mobile drawer and bottom navigation.
- Main content uses `p-4 md:p-8`, `max-w-7xl mx-auto`, and `space-y-6`.

```tsx
<div className="relative flex h-[100dvh] w-full bg-slate-50 font-sans text-slate-900 antialiased overflow-hidden">
  <aside className="hidden md:flex fixed inset-y-0 z-50 w-60 border-r border-slate-200">...</aside>
  <div className="flex-1 flex flex-col min-w-0 h-full md:pl-60">
    <div className="sticky top-0 z-40 h-12 bg-white border-b border-slate-100 px-4 md:px-8"><Header /></div>
    <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
      <div className="max-w-7xl mx-auto w-full space-y-6 pb-20 md:pb-4">{children}</div>
    </main>
    <BottomNav />
  </div>
</div>
```

## Sidebar
- Source: `components/layout/sidebar.tsx`
- Dark themed grouped navigation, collapsible on desktop, drawer on mobile. Finance group is `Keuangan Terpusat`.
- The file exceeds 500 lines; pass its full source for layout reproduction.

## Header
- Source: `components/layout/header.tsx`
- Compact 48px header: date pill on left, notification and role-aware profile on right.
- Full source should be passed to design commands.

## BottomNav
- Source: `components/layout/bottom-nav.tsx`
- Role-aware mobile navigation shown below dashboard content.
