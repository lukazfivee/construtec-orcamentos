import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';

type Props = { existing: string[]; disabled: boolean; onSave: (name: string) => Promise<boolean> };

// "Salvar corpo como modelo da empresa": pede um nome; nome que ja existe atualiza aquele modelo.
export function SaveBodyModel({ existing, disabled, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = name.replace(/\s+/g, ' ').trim();
  const replaces = existing.some((item) => item.toLowerCase() === clean.toLowerCase());
  const save = async () => {
    if (!clean || busy) return;
    setBusy(true);
    const done = await onSave(clean);
    setBusy(false);
    if (done) { setOpen(false); setName(''); }
  };
  if (!open) return <button type="button" disabled={disabled} onClick={() => setOpen(true)}><BookmarkPlus size={16} />Salvar como modelo</button>;
  return (
    <span className="body-save-model" role="group" aria-label="Salvar corpo como modelo da empresa">
      <input autoFocus maxLength={80} value={name} placeholder="Nome do modelo" aria-label="Nome do modelo" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); if (event.key === 'Escape') setOpen(false); }} />
      <button type="button" className="body-btn primary" disabled={!clean || busy} onClick={() => void save()}>{replaces ? 'Atualizar modelo' : 'Salvar modelo'}</button>
      <button type="button" className="body-btn" onClick={() => setOpen(false)}>Cancelar</button>
    </span>
  );
}
