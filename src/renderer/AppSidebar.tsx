import type { SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, LogOut } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import type { AppSidebarProps } from './AppSidebarMobile';
import { AppSidebarMobile } from './AppSidebarMobile';
import { NAV_GROUPS } from './navSections';
import { useIsMobile } from './useIsMobile';

export type { NavSection } from './navSections';

/* Menu lateral identico ao do Centro de Custos (public/d/shell.js + layout.css + menu.css):
   236 px aberto, 72 px recolhido, botao na borda e Ctrl B, escolha guardada; sem escolha, recolhe abaixo de 1280 px. */
const MENU_KEY = 'orc_d_menu';
const brandLogo = new URL('../assets/logo-branca.png', import.meta.url).href;
const brandIcon = new URL('../assets/logo-icon.png', import.meta.url).href;

const roleLabels: Record<AuthUser['role'], string> = { admin: 'Administrador', commercial: 'Comercial', viewer: 'Consulta' };

const getInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CT';

function initialCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(MENU_KEY);
    if (saved) return saved === 'recolhido';
  } catch { /* sem armazenamento */ }
  return window.innerWidth < 1280;
}

export function AppSidebar(props: AppSidebarProps) {
  const mobile = useIsMobile();
  return mobile ? <AppSidebarMobile {...props} /> : <AppSidebarDesktop {...props} />;
}

function AppSidebarDesktop({ activeNav, onSelectNav, user, onLogout, pendingProposals = 0 }: AppSidebarProps) {
  const [recolhido, setRecolhido] = useState(initialCollapsed);
  const [dica, setDica] = useState<{ text: string; left: number; top: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  /* A largura da coluna fica no .app-shell; o atributo na raiz evita passar estado por props. */
  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-recolhido', recolhido);
  }, [recolhido]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => document.documentElement.classList.add('menu-anima'));
    return () => cancelAnimationFrame(frame);
  }, []);

  const alternar = () => {
    setRecolhido((atual) => {
      try { localStorage.setItem(MENU_KEY, atual ? 'aberto' : 'recolhido'); } catch { /* segue sem guardar */ }
      return !atual;
    });
    setDica(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        alternar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Nome do item ao lado do icone com o menu recolhido (fora do menu, para a lista poder rolar). */
  const mostrarDica = (event: SyntheticEvent) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-rot]');
    if (!item || !recolhido) { setDica(null); return; }
    const r = item.getBoundingClientRect();
    setDica({ text: item.dataset.rot ?? '', left: r.right + 14, top: r.top + r.height / 2 });
  };

  const displayName = user?.name || 'Marcos Ribeiro';
  const role = user ? roleLabels[user.role] ?? user.role : roleLabels.commercial;
  const badges: Partial<Record<string, number>> = { Propostas: pendingProposals };

  return (
    <aside className="side" id="menu-lateral" aria-label="Navegação principal">
      <button type="button" className="marca" onClick={() => onSelectNav('Início')} aria-label="Construtec Orçamentos, ir para Início">
        <img className="logo" src={brandLogo} alt="Construtec" />
        <img className="simb" src={brandIcon} alt="" />
        <span>Orçamentos</span>
      </button>
      <button
        type="button"
        className="recolher"
        aria-controls="menu-lateral"
        aria-expanded={!recolhido}
        aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
        title={`${recolhido ? 'Expandir menu' : 'Recolher menu'} (Ctrl B)`}
        onClick={alternar}
      >
        <ChevronLeft className="ph" size={14} strokeWidth={1.5} />
      </button>
      <nav
        ref={navRef}
        aria-label="Navegação principal"
        onMouseOver={mostrarDica}
        onFocus={mostrarDica}
        onMouseLeave={() => setDica(null)}
        onBlur={() => setDica(null)}
        onScroll={() => setDica(null)}
        onClick={() => setDica(null)}
      >
        {NAV_GROUPS.map((group) => (
          <div className="grupo" key={group.title}>
            <span>{group.title}</span>
            {group.items.map(({ label, icon: Icon }) => {
              const count = badges[label] ?? 0;
              return (
                <button
                  key={label}
                  type="button"
                  className="nav"
                  aria-current={label === activeNav ? 'page' : undefined}
                  aria-label={label}
                  data-rot={label}
                  onClick={() => onSelectNav(label)}
                >
                  <Icon className="ph" size={18} strokeWidth={1.5} />
                  <span className="rot">{label}</span>
                  {count > 0 && (
                    <span className="badge" title={`${count} em edição ou revisão`}>{count > 99 ? '99+' : count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="quem">
        <span className="avatar" aria-hidden="true">{getInitials(displayName)}</span>
        <span className="nome"><b>{displayName}</b><span>{role}</span></span>
        {onLogout && (
          <button type="button" className="ibtn" aria-label="Sair" title="Sair" onClick={onLogout}>
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {dica && <div className="menu-dica" style={{ left: dica.left, top: dica.top }}>{dica.text}</div>}
    </aside>
  );
}
