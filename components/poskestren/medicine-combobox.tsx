'use client'

import { Children, isValidElement, useId, useState, type ReactNode, type SelectHTMLAttributes } from 'react'

type Option = { value: string; label: string }
function labelText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(labelText).join('')
  if (isValidElement<{children?: ReactNode}>(node)) return labelText(node.props.children)
  return ''
}

// Also accepts existing option children so inventory forms keep their form contracts.
export function MedicineCombobox({ options, value, defaultValue, onValueChange, onChange, children,
  allowExternal = false, onExternal, name, required, disabled, className, ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple'> & {
  options?: Option[]; onValueChange?: (value: string) => void;
  allowExternal?: boolean; onExternal?: (name: string) => void;
}) {
  const id = useId()
  const [internal, setInternal] = useState(String(defaultValue ?? ''))
  const selected = String(value ?? internal)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const entries: Option[] = options ?? Children.toArray(children).flatMap(child =>
    isValidElement<{value?: string; children?: ReactNode}>(child)
      ? [{value: String(child.props.value ?? labelText(child.props.children)), label: labelText(child.props.children)}] : [])
  const choices = entries.filter(o => o.value && o.label.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')))
  const canCreate = allowExternal && search.trim().length > 0
  function choose(v: string) {
    setInternal(v); onValueChange?.(v)
    onChange?.({target:{value:v}, currentTarget:{value:v}} as React.ChangeEvent<HTMLSelectElement>)
    setOpen(false); setSearch(''); setActive(0)
  }
  function pick(index: number) {
    if (index < choices.length) choose(choices[index].value)
    else if (canCreate) { onExternal?.(search.trim()); setOpen(false); setSearch('') }
  }
  return <div className="relative min-w-0" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) {setOpen(false); setSearch('')} }}>
    {name ? <input type="hidden" name={name} value={selected} disabled={disabled} /> : null}
    <input id={rest.id} aria-label={rest['aria-label'] || 'Cari obat'} role="combobox" aria-expanded={open}
      aria-controls={id} aria-autocomplete="list" aria-activedescendant={open ? `${id}-${active}` : undefined}
      autoComplete="off" disabled={disabled} required={required} className={className || 'min-h-10 w-full rounded-lg border px-3 py-2 text-sm'}
      value={open ? search : entries.find(o => o.value === selected)?.label || ''}
      placeholder={entries.find(o=>!o.value)?.label || 'Cari obat...'}
      onFocus={()=>{setOpen(true);setSearch('');setActive(0)}}
      onChange={e=>{setSearch(e.target.value);setOpen(true);setActive(0); if(selected) {setInternal('');onValueChange?.('');onChange?.({target:{value:''},currentTarget:{value:''}} as React.ChangeEvent<HTMLSelectElement>)}}}
      onKeyDown={e=>{
        if(e.key==='Escape'){setOpen(false);setSearch('');return}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(choices.length-1+(canCreate?1:0),n+(e.key==='ArrowDown'?1:-1))))}
        if(e.key==='Enter'&&open){e.preventDefault();if(choices.length||canCreate)pick(active)}
      }} />
    {open ? <div id={id} role="listbox" className="absolute z-[90] mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-lg border bg-white shadow-xl">
      {!required && selected ? <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>choose('')} className="block w-full p-2 text-left text-sm">Hapus pilihan</button> : null}
      {choices.map((o,i)=><button key={o.value} id={`${id}-${i}`} type="button" role="option" aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(i)} className={`block w-full p-3 text-left text-sm ${i===active?'bg-emerald-50':'hover:bg-slate-50'}`}>{o.label}</button>)}
      {canCreate ? <button id={`${id}-${choices.length}`} type="button" role="option" aria-selected={active===choices.length} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(choices.length)} className="block w-full border-t p-3 text-left text-sm font-bold text-emerald-700">Beli dari luar: {search}</button> : null}
      {!choices.length&&!canCreate ? <p className="p-3 text-sm text-slate-500">Obat tidak ditemukan.</p> : null}
    </div> : null}
  </div>
}
