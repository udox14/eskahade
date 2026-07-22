# ESKAHADE Finance Design System

## Intent
Keep the established ESKAHADE dashboard shell and visual language, but make finance screens denser, calmer, audit-friendly, and fast to scan. The KELAS module is a comfort reference only—not a page template.

## Layout hierarchy
1. Shared compact `DashboardPageHeader` with title, one-line description, scope/status, and primary action.
2. Compact finance sub-navigation or breadcrumb strip; avoid six oversized navigation cards.
3. Contextual help panel, collapsed by default after first use, with “Tujuan / Sebelum mulai / Langkah / Catatan risiko”.
4. Key metrics in 3–5 compact cards; every card answers an operational question.
5. Exceptions and pending work before historical tables.
6. Dense tables and forms with labels, helper text, status chips, and explicit empty states.

## Density
- Page vertical gap: 20–24px.
- Panel padding: 16–20px desktop, 14–16px mobile.
- Use `rounded-xl`, not `rounded-2xl`, for most operational panels.
- Default control height: 38–40px.
- Table row: 44–52px.
- Currency uses tabular numerals and right alignment.

## Color and semantics
- Emerald is the primary action/accent, not a decorative flood.
- Slate surfaces and borders dominate.
- Amber only for review/cutoff/exception; red only for blocked/failed/negative; blue for informational guidance.
- Charts use emerald, teal, blue, amber, and slate with accessible contrast.

## Finance dashboard information architecture
- KPI cards: bank/clearing position, total guardian float, allocated wallets, unresolved exceptions.
- Allocation composition: useful horizontal stacked bar or donut with direct labels.
- Cash movement trend: compact 30-day inflow/outflow chart.
- Work queue: unmatched bank rows, late top-ups, payout failures, pending payout approvals.
- Recent journal activity table.
- Chart of accounts should be secondary and collapsible/filterable, not the first dominant content.

## Guidance and commentary
- Every page includes a concise “Cara menggunakan halaman ini” panel.
- Explain role boundaries and why a control may be disabled.
- Place field-specific help under complex controls.
- Destructive or irreversible actions show consequences before the button.
- Empty states explain the next valid action.
- Use human language; technical ledger terms may include a short parenthetical explanation.

## Responsive behavior
- Desktop optimized for finance operations at 1280–1440px.
- Mobile stacks forms and metric cards; tables may scroll horizontally.
- Never hide financial status or approval state solely in hover interactions.
