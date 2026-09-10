import { useState } from 'react';
import {
  Bell,
  ChevronDown,
  HelpCircle,
  LayoutGrid,
  Mail,
  Search,
} from 'lucide-react';
import type { AuthUser, ProposalDetail } from '../shared/contracts';
import { HelpModal } from './HelpModal';
import { NotificationsPopover } from './NotificationsPopover';
import { SuiteSwitcherPopover } from './SuiteSwitcherPopover';
import { UserProfilePopover } from './UserProfilePopover';

const brandLogo = new URL('../assets/logo-branca.png', import.meta.url).href;

interface AppTopbarProps {
  user?: AuthUser | null;
  activeNav: string;
  proposal: ProposalDetail | null;
  onOpenCatalog: () => void;
  onLogout?: () => void;
  showNotice: (message: string) => void;
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CT';

export function AppTopbar({
  user,
  activeNav,
  proposal,
  onOpenCatalog,
  onLogout,
  showNotice,
}: AppTopbarProps) {
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const divergentCount =
    proposal?.isLatest
      ? proposal.items.filter(
          (item) =>
            item.catalogCurrentCost !== null &&
            item.catalogCurrentCost !== undefined &&
            Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01
        ).length
      : 0;

  const displayName = user?.name || 'Marcos Ribeiro';
  const displayInitials = user?.name ? getInitials(user.name) : 'MR';

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img src={brandLogo} alt="Construtec" />
          <span>Orçamentos</span>
        </div>

        <div className="local-state">
          <span aria-hidden="true" /> Offline{' '}
          <button
            type="button"
            onClick={() => showNotice('Os dados desta versão ficam armazenados localmente neste computador.')}
          >
            Dados locais <ChevronDown size={14} />
          </button>
        </div>

        <button
          className="global-search"
          type="button"
          disabled={activeNav !== 'Propostas'}
          onClick={onOpenCatalog}
        >
          <Search size={17} />
          <span>{activeNav === 'Propostas' ? 'Buscar no catálogo' : 'Busca disponível em Propostas'}</span>
          {activeNav === 'Propostas' && <kbd>Ctrl+K</kbd>}
        </button>

        <div className="top-actions">
          {/* Suíte Construtec / App Switcher */}
          <div className="top-action-anchor suite-switcher-container">
            <button
              id="btn-suite-switcher"
              className={`btn-suite-topbar ${suiteOpen ? 'active' : ''}`}
              type="button"
              aria-expanded={suiteOpen}
              onClick={() => {
                setSuiteOpen((prev) => !prev);
                setNotificationsOpen(false);
                setProfileOpen(false);
              }}
              title="Alternar entre sistemas da Suíte Construtec"
            >
              <LayoutGrid size={15} />
              <span className="suite-label">Suíte</span>
              <ChevronDown size={11} className="suite-caret" />
            </button>
            {suiteOpen && (
              <SuiteSwitcherPopover onClose={() => setSuiteOpen(false)} />
            )}
          </div>

          <div className="top-action-anchor">
            <button
              className={`icon-button ${notificationsOpen ? 'active' : ''}`}
              aria-label="Notificações"
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setSuiteOpen(false);
                setProfileOpen(false);
              }}
              title="Notificações e alertas do sistema"
            >
              <Bell size={18} />
              {divergentCount > 0 && <span className="notification-badge" aria-label={`${divergentCount} divergências`} />}
            </button>
            {notificationsOpen && (
              <NotificationsPopover
                proposal={proposal}
                onClose={() => setNotificationsOpen(false)}
              />
            )}
          </div>

          <button
            className={`icon-button ${helpOpen ? 'active' : ''}`}
            aria-label="Central de Ajuda"
            type="button"
            onClick={() => {
              setHelpOpen(true);
              setSuiteOpen(false);
              setNotificationsOpen(false);
              setProfileOpen(false);
            }}
            title="Central de Ajuda e Atalhos (Ctrl+H)"
          >
            <HelpCircle size={18} />
          </button>

          <button
            className="icon-button"
            aria-label="Webmail Corporativo (UOL Pro)"
            type="button"
            onClick={() => {
              void window.construtec?.openWebmail?.();
              showNotice('Abrindo UOL Webmail Pro corporativo…');
            }}
            title="Webmail Corporativo (UOL Pro)"
          >
            <Mail size={18} />
          </button>

          <span className="divider" />

          <div className="top-action-anchor">
            <button
              className={`profile ${profileOpen ? 'active' : ''}`}
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setSuiteOpen(false);
                setNotificationsOpen(false);
              }}
              title={`Perfil: ${displayName}`}
              aria-label="Menu do usuário"
            >
              <span>{displayInitials}</span>
              <b>{displayName}</b>
              <ChevronDown size={14} />
            </button>
            {profileOpen && user && onLogout && (
              <UserProfilePopover
                user={user}
                onLogout={onLogout}
                onClose={() => setProfileOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
