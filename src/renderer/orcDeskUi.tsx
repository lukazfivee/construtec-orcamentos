import { useEffect, type FormEvent, type ReactNode } from 'react';
import { brl, numero, plural } from '../shared/formatoBr';
import { X, type LucideIcon } from './icons';
import './orcDesk.css';

export { brl, plural };
export const signBrl = (value: number) => `${value > 0 ? '+' : (value < 0 ? '−' : '')}${brl(Math.abs(value))}`;
export const nfmt = (value: number) => numero(value, 3);
export const pctSigned = (value: number) => `${value > 0 ? '+' : (value < 0 ? '−' : '')}${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const revText = (revision: number) => `REV.${String(revision).padStart(2, '0')}`;

export const statusChip = (status: string): { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neu' | 'vio' } => {
  switch (status) {
    case 'draft': return { label: 'Em edição', tone: 'warn' };
    case 'review': return { label: 'Em revisão', tone: 'info' };
    case 'sent': return { label: 'Enviada', tone: 'neu' };
    case 'approved': return { label: 'Aprovada', tone: 'ok' };
    case 'rejected': return { label: 'Recusada', tone: 'bad' };
    default: return { label: status, tone: 'neu' };
  }
};

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: ReactNode }) {
  return <div className="od-head">
    <div><span className="od-eyebrow">{eyebrow}</span><h1>{title}</h1>{sub && <span className="od-sub">{sub}</span>}</div>
    {children && <div className="od-actions">{children}</div>}
  </div>;
}

export function Seg<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (next: T) => void; disabled?: boolean;
}) {
  return <div className="od-seg" role="group" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} disabled={disabled} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function EmptyState({ icon: Icon, tone, title, children, actions }: { icon: LucideIcon; tone?: 'bad' | 'ok'; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <div className="od-empty" role={tone === 'bad' ? 'alert' : undefined}>
    <span className={`od-empty-ic${tone ? ` ${tone}` : ''}`}><Icon size={26} /></span>
    <b>{title}</b>
    {children && <span>{children}</span>}
    {actions && <div className="od-empty-actions">{actions}</div>}
  </div>;
}

export function Drawer({ title, sub, icon: Icon, onClose, children, footer }: {
  title: string; sub?: string; icon: LucideIcon; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="od-drawer-bg" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="od-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="od-drawer-head">
        <span className="od-row-ic"><Icon size={19} /></span>
        <span className="od-grow"><b>{title}</b>{sub && <span>{sub}</span>}</span>
        <button type="button" className="od-ibtn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="od-drawer-body">{children}</div>
      {footer && <div className="od-drawer-foot">{footer}</div>}
    </aside>
  </div>;
}

/* Casca unica das janelas (a da Nova proposta): cabecalho claro com icone de 22 px, titulo 17/600 em frase normal,
   apoio 12,5, corpo de 20 px e rodape com botoes .od-btn de 40 px. Esc e clique fora fecham (se nao estiver ocupado). */
export function Dialogo({ id, icon: Icon, title, sub, onClose, children, footer, className, busy, onSubmit, tone, toolbar }: {
  id: string; icon: LucideIcon; title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; toolbar?: ReactNode;
  className?: string; busy?: boolean; onSubmit?: (event: FormEvent<HTMLFormElement>) => void; tone?: 'bad';
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  const body = <>
    <div className="dlg-body">{children}</div>
    {footer && <footer className="dlg-foot">{footer}</footer>}
  </>;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className={`new-proposal-dialog dlg${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <Icon size={22} className={tone === 'bad' ? 'dlg-ic bad' : 'dlg-ic'} aria-hidden="true" />
          <span>
            <h2 id={`${id}-title`}>{title}</h2>
            {sub && <p>{sub}</p>}
          </span>
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      {toolbar}
      {onSubmit ? <form className="dlg-form" onSubmit={onSubmit}>{body}</form> : body}
    </section>
  </div>;
}

export const downloadText = (name: string, text: string, mime = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([`\uFEFF${text}`], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// O site de computador roda sem o Electron: foto, PDF e a conta do EXSAT so existem no aplicativo.
export const hasDesktopApp = () => typeof window !== 'undefined' && !!window.construtec?.runtime;
