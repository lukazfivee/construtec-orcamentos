import type { LucideIcon } from 'lucide-react';
import { Box, FileText, Grid2X2, Layers3, Settings, Users } from 'lucide-react';

export type NavSection = 'Início' | 'Propostas' | 'Centro de Custos' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações';

export type NavItem = { label: NavSection; icon: LucideIcon };

/* Menu do desktop em grupos, como o do Centro de Custos (rotulo do grupo em caixa alta pequena).
   Icones Lucide equivalentes aos Phosphor do Centro: squares-four, file-text, package, users, stack, gear-six. */
export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Visão geral', items: [{ label: 'Início', icon: Grid2X2 }] },
  { title: 'Comercial', items: [{ label: 'Propostas', icon: FileText }] },
  { title: 'Cadastros', items: [
    { label: 'Catálogo', icon: Box },
    { label: 'Clientes', icon: Users },
    { label: 'Kits', icon: Layers3 },
  ] },
  { title: 'Administração', items: [{ label: 'Configurações', icon: Settings }] },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
