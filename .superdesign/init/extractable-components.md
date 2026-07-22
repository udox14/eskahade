# Extractable Components

## DashboardShell
- Source: `components/layout/client-layout.tsx`
- Category: layout
- Description: Sidebar, sticky header, responsive content canvas, and mobile bottom nav.
- Extractable props: `sidebarCollapsed`, `activePath`, `mobileMenuOpen`.
- Hardcoded: shell dimensions, colors, spacing, application navigation pattern.

## DashboardSidebar
- Source: `components/layout/sidebar.tsx`
- Category: layout
- Description: Grouped dark navigation with active state and collapse behavior.
- Extractable props: `activePath`, `isCollapsed`.
- Hardcoded: group labels, icon treatment, theme styles.

## DashboardHeader
- Source: `components/layout/header.tsx`
- Category: layout
- Description: Compact date, notification, user avatar, and multi-role header.
- Extractable props: `userName`, `roleLabel`, `showNotification`.
- Hardcoded: dimensions, icon layout, dropdown styling.

## DashboardPageHeader
- Source: `components/dashboard/page-header.tsx`
- Category: basic
- Description: Standard compact page heading with optional right action.
- Extractable props: `title`, `description`, `showAction`.
- Hardcoded: title scale, spacing, responsive layout.

## FinanceContextHelp
- Source: new component to create after design approval.
- Category: basic
- Description: Collapsible contextual guide containing purpose, prerequisites, steps, and risk notes.
- Extractable props: `isOpen`, `stepCount`.
- Hardcoded: help icon, information hierarchy and status colors.
