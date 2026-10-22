import type { CSSProperties } from 'react';

/* Icone Phosphor pela fonte embutida, igual ao CC.icon do Centro de Custos (public/d/d-core.js):
   "nome-fill" usa o estilo preenchido. Sem tamanho, o CSS do contexto decide (ex.: .ibtn .ph). */
export function Ph({ name, size, className }: { name: string; size?: number; className?: string }) {
  const fill = name.endsWith('-fill');
  const base = fill ? name.slice(0, -5) : name;
  const style: CSSProperties | undefined = size ? { fontSize: size } : undefined;
  return <i className={`${fill ? 'ph-fill' : 'ph'} ph-${base}${className ? ` ${className}` : ''}`} aria-hidden="true" style={style} />;
}
