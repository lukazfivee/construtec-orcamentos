import { FileText, Grid2X2, Layers3, LogOut, Menu } from 'lucide-react';
import type { AuthUser } from '../shared/contracts';
import type { NavItem, NavSection } from './navSections';
import { NAV_ITEMS } from './navSections';

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

export interface AppSidebarProps {
  activeNav: NavSection;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onSelectNav: (label: NavSection) => void;
  user?: AuthUser | null;
  onLogout?: () => void;
  /** Propostas em edicao ou revisao (selo do menu no desktop). */
  pendingProposals?: number;
}

export function AppSidebarMobile({
  activeNav,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onSelectNav,
  user,
  onLogout,
}: AppSidebarProps) {
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
        {NAV_ITEMS.map(({ label, icon: Icon }) => {
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
    </aside>
  );
}
