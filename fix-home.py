import re

with open("app/dashboard/home-client.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert functions after getIcon
icon_func_end = """function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}"""

inserted_functions = """function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Settings
}

const MENU_TITLE_MAP: Record<string, string> = {
  'Manajemen User': 'User',
  'Manajemen Santri': 'Tools Santri',
  'Manajemen Guru & Jadwal': 'Guru & Jadwal',
  'Manajemen Kelas': 'Kelas',
  'Manajemen Kitab': 'Kitab',
  'Pembagian Kitab Guru': 'Kitab Guru',
  'Manajemen Fitur': 'Fitur Akses',
};

function getMenuTitle(title: string) {
  return MENU_TITLE_MAP[title] ?? title;
}

const GROUP_ITEM_ORDER: Record<string, string[]> = {
  'Master Data': [
    'Tahun Ajaran',
    'Setup Tahun Ajaran',
    'Kelas',
    'Kitab',
    'Kitab Guru',
    'Guru & Jadwal',
    'Tools Santri',
    'Arsip Alumni',
    'Periode Perpulangan',
    'Master Pelanggaran',
    'User',
    'Fitur Akses',
    'Log Aktivitas',
  ],
};

function sortGroupItems(group: string, items: FiturAkses[]) {
  const preferredOrder = GROUP_ITEM_ORDER[group];
  if (!preferredOrder) return items;

  const rankMap = new Map(preferredOrder.map((title, index) => [title, index]));
  return [...items].sort((a, b) => {
    const aTitle = getMenuTitle(a.title);
    const bTitle = getMenuTitle(b.title);
    const aRank = rankMap.get(aTitle);
    const bRank = rankMap.get(bTitle);

    if (aRank != null && bRank != null) return aRank - bRank;
    if (aRank != null) return -1;
    if (bRank != null) return 1;
    return a.urutan - b.urutan;
  });
}"""

content = content.replace(icon_func_end, inserted_functions)

# 2. Add POSKESTREN and Keuangan Terpusat to GROUP_META
group_meta_target = """  'EHB':          { label: 'Ujian EHB',            icon: ClipboardList },
  'PSB':          { label: 'Pendaftaran PSB',      icon: UserPlus },
  'Master Data':  { label: 'Master Data',          icon: Database },"""
group_meta_replacement = """  'Keuangan Terpusat': { label: 'Keuangan Terpusat', icon: Bank },
  'EHB':          { label: 'Ujian EHB',            icon: ClipboardList },
  'PSB':          { label: 'Pendaftaran PSB',      icon: UserPlus },
  'POSKESTREN':   { label: 'POSKESTREN',           icon: Stethoscope },
  'Master Data':  { label: 'Master Data',          icon: Database },"""
content = content.replace(group_meta_target, group_meta_replacement)

# 3. Add to GROUP_ORDER
group_order_target = """  'Keuangan Pusat',
  'Keuangan Santri',
  'Keuangan',
  'Operasional',
  'UPK',
  'EHB',
  'PSB',
  'Master Data',"""
group_order_replacement = """  'Keuangan Pusat',
  'Keuangan Terpusat',
  'Keuangan Santri',
  'Keuangan',
  'Operasional',
  'UPK',
  'EHB',
  'PSB',
  'POSKESTREN',
  'Master Data',"""
content = content.replace(group_order_target, group_order_replacement)

# 4. Add to GROUP_COLORS
group_colors_target = """  'Keuangan Pusat':        { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hoverText: 'group-hover:text-emerald-700' },
  'Keuangan Santri':       { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600', hoverText: 'group-hover:text-cyan-700' },"""
group_colors_replacement = """  'Keuangan Pusat':        { bg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', hoverText: 'group-hover:text-emerald-700' },
  'Keuangan Terpusat':     { bg: 'bg-teal-50 text-teal-600', text: 'text-teal-600', hoverText: 'group-hover:text-teal-700' },
  'Keuangan Santri':       { bg: 'bg-cyan-50 text-cyan-600', text: 'text-cyan-600', hoverText: 'group-hover:text-cyan-700' },"""
content = content.replace(group_colors_target, group_colors_replacement)

group_colors_target2 = """  'PSB':                   { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600', hoverText: 'group-hover:text-violet-700' },
}"""
group_colors_replacement2 = """  'PSB':                   { bg: 'bg-violet-50 text-violet-600', text: 'text-violet-600', hoverText: 'group-hover:text-violet-700' },
  'POSKESTREN':            { bg: 'bg-red-50 text-red-600', text: 'text-red-600', hoverText: 'group-hover:text-red-700' },
}"""
content = content.replace(group_colors_target2, group_colors_replacement2)


# 5. Use getMenuTitle in filtering
filter_target = "const titleMatch = fitur.title.toLowerCase().includes(searchQuery.toLowerCase())"
filter_replacement = "const titleMatch = getMenuTitle(fitur.title).toLowerCase().includes(searchQuery.toLowerCase())"
content = content.replace(filter_target, filter_replacement)

# 6. Apply sortGroupItems for activeGroup
active_group_target = "const items = grouped.get(activeGroup)!"
active_group_replacement = "const items = sortGroupItems(activeGroup, grouped.get(activeGroup)!)"
content = content.replace(active_group_target, active_group_replacement)

# 7. Apply getMenuTitle to display
title_target = '<h4 className="text-sm font-bold text-slate-800 truncate">{fitur.title}</h4>'
title_replacement = '<h4 className="text-sm font-bold text-slate-800 truncate">{getMenuTitle(fitur.title)}</h4>'
content = content.replace(title_target, title_replacement)

with open("app/dashboard/home-client.tsx", "w", encoding="utf-8") as f:
    f.write(content)
