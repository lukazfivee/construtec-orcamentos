import {
  Box,
  ChevronLeft,
  FileText,
  Grid2X2,
  Layers3,
  LogOut,
  Menu,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AuthUser } from '../shared/contracts';

const MENU_KEY = 'orc_menu_recolhido';

function lerRecolhido(): boolean {
  try { return localStorage.getItem(MENU_KEY) === '1'; } catch { return false; }
}

export type NavSection = 'Início' | 'Propostas' | 'Centro de Custos' | 'Catálogo' | 'Clientes' | 'Kits' | 'Configurações';

type NavItem = { label: NavSection; icon: typeof Grid2X2 };

/* Desktop mantem a navegacao completa na lateral. */
const navItems: NavItem[] = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Catálogo', icon: Box },
  { label: 'Clientes', icon: Users },
  { label: 'Kits', icon: Layers3 },
  { label: 'Configurações', icon: Settings },
];

/* Barra inferior no celular: tres destinos de uso diario. Espelha o padrao do
   Centro de Custos, onde a barra carrega poucos itens largos em vez de uma
   tira comprimida com todos. */
const mobilePrimaryNav: NavItem[] = [
  { label: 'Início', icon: Grid2X2 },
  { label: 'Propostas', icon: FileText },
  { label: 'Kits', icon: Layers3 },
];

/* "Menu" desliza o mesmo painel completo de navegacao usado no desktop,
   igual ao Centro de Custos: nao um subconjunto separado. */

interface AppSidebarProps {
  activeNav: NavSection;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onSelectNav: (label: NavSection) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export function AppSidebar({
  activeNav,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onSelectNav,
  user,
  onLogout,
}: AppSidebarProps) {
  const [recolhido, setRecolhido] = useState(lerRecolhido);

  /* A largura da coluna fica no .app-shell (App.tsx); o atributo na raiz evita passar estado por props. */
  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-recolhido', recolhido);
    try { localStorage.setItem(MENU_KEY, recolhido ? '1' : '0'); } catch { /* segue sem guardar */ }
  }, [recolhido]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setRecolhido((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <nav>
        <span className="sidebar-mobile-only" aria-hidden="true">
          {mobilePrimaryNav.map(({ label, icon: Icon }) => {
            const active = label === activeNav;
            return (
              <button
                key={label}
                type="button"
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelectNav(label)}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={mobileMenuOpen ? 'active' : ''}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            onClick={onToggleMobileMenu}
          >
            <Menu size={22} />
            <span>Menu</span>
          </button>
        </span>
        <span className="sidebar-desktop-only">
          {navItems.map(({ label, icon: Icon }) => {
            const active = label === activeNav;
            return (
              <button
                key={label}
                type="button"
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                data-rot={label}
                onClick={() => onSelectNav(label)}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            );
          })}
        </span>
      </nav>
    {mobileMenuOpen && (
      <button
        type="button"
        className="mobile-nav-scrim"
        aria-label="Fechar menu"
        onClick={onCloseMobileMenu}
      />
    )}
    <div
      className={`mobile-nav-menu ${mobileMenuOpen ? 'open' : ''}`}
      id="mobile-nav-menu"
      role="menu"
      aria-label="Navegação completa"
      aria-hidden={!mobileMenuOpen}
    >
      {navItems.map(({ label, icon: Icon }) => {
        const active = label === activeNav;
        return (
          <button
            key={label}
            type="button"
            role="menuitem"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            tabIndex={mobileMenuOpen ? 0 : -1}
            onClick={() => onSelectNav(label)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        );
      })}
      {user && onLogout && (
        <button
          type="button"
          role="menuitem"
          className="mobile-nav-logout"
          tabIndex={mobileMenuOpen ? 0 : -1}
          onClick={() => {
            onCloseMobileMenu();
            onLogout();
          }}
        >
          <LogOut size={20} />
          <span>Sair ({user.name})</span>
        </button>
      )}
    </div>
    <button
        className="collapse"
        type="button"
        aria-expanded={!recolhido}
        aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
        title={(recolhido ? 'Expandir menu' : 'Recolher menu') + ' (Ctrl B)'}
        onClick={() => setRecolhido((v) => !v)}
      >
        <ChevronLeft size={17} />
        <span>Recolher</span>
      </button>
    </aside>
  );
}
