import { useState } from 'react';
import { Bell, ChevronDown, CircleHelp, LayoutGrid, Mail, Moon, Search, Sun } from 'lucide-react';
import { isCloudRuntime } from './api';
import type { AppTopbarProps } from './AppTopbarMobile';
import { AppTopbarMobile } from './AppTopbarMobile';
import { HelpModal } from './HelpModal';
import { NotificationsPopover } from './NotificationsPopover';
import { SuiteSwitcherPopover } from './SuiteSwitcherPopover';
import { UpdateNotice } from './UpdateNotice';
import { useTheme } from './theme';
import { useIsMobile } from './useIsMobile';

const isCloud = isCloudRuntime();

export function AppTopbar(props: AppTopbarProps) {
  const mobile = useIsMobile();
  return mobile ? <AppTopbarMobile {...props} /> : <AppTopbarDesktop {...props} />;
}

/* Barra do topo identica a do Centro de Custos (shell.js + layout.css): busca a esquerda, selo de dados,
   botao Suite e tema. Notificacoes, ajuda e e-mail ficam antes do selo, no mesmo padrao de botao de icone. */
function AppTopbarDesktop({ activeNav, proposal, editorOpen, onSearch, onSelectApp, showNotice }: AppTopbarProps) {
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const theme = useTheme();
  const escuro = theme.resolved === 'escuro';

  const divergentCount = proposal?.isLatest
    ? proposal.items.filter(
      (item) => item.catalogCurrentCost !== null && item.catalogCurrentCost !== undefined
        && Math.abs(item.catalogCurrentCost - item.unitCost) >= 0.01,
    ).length
    : 0;
  const searchLabel = editorOpen ? 'Buscar no catálogo' : 'Buscar propostas, clientes, obras';

  return (
    <>
      <header className="top">
        <div className="busca" role="search">
          <Search className="ph" size={18} strokeWidth={1.5} />
          <input
            className="inp"
            type="search"
            readOnly
            placeholder={searchLabel}
            aria-label={`${searchLabel}. Atalho Ctrl K`}
            onClick={onSearch}
            onKeyDown={(event) => { if (event.key === 'Enter') onSearch?.(); }}
          />
          <kbd>Ctrl K</kbd>
        </div>
        <span className="espaco" />
        <UpdateNotice />
        <div className="ancora">
          <button
            type="button"
            className={`ibtn ${notificationsOpen ? 'ativo' : ''}`}
            aria-label="Notificações"
            title="Notificações e alertas do sistema"
            onClick={() => { setNotificationsOpen((prev) => !prev); setSuiteOpen(false); }}
          >
            <Bell className="ph" size={20} strokeWidth={1.5} />
            {divergentCount > 0 && <span className="ponto-aviso" aria-label={`${divergentCount} divergências`} />}
          </button>
          {notificationsOpen && <NotificationsPopover proposal={proposal} onClose={() => setNotificationsOpen(false)} />}
        </div>
        <button
          type="button"
          className="ibtn help-button"
          aria-label="Central de Ajuda"
          title="Central de Ajuda e Atalhos (Ctrl+H)"
          onClick={() => { setHelpOpen(true); setSuiteOpen(false); setNotificationsOpen(false); }}
        >
          <CircleHelp className="ph" size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="ibtn"
          aria-label="Webmail Corporativo (UOL Pro)"
          title="Webmail Corporativo (UOL Pro)"
          onClick={() => {
            void window.construtec?.openWebmail?.();
            showNotice('Abrindo UOL Webmail Pro corporativo…');
          }}
        >
          <Mail className="ph" size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`selo ${isCloud ? 'ok' : 'local'}`}
          aria-live="polite"
          title={isCloud
            ? 'Os dados desta versão ficam armazenados na nuvem, em um banco PostgreSQL.'
            : 'Os dados desta versão ficam armazenados localmente neste computador.'}
          onClick={() => showNotice(isCloud
            ? 'Os dados desta versão ficam armazenados na nuvem, em um banco PostgreSQL.'
            : 'Os dados desta versão ficam armazenados localmente neste computador.')}
        >
          <span className="ponto" />
          <span>{isCloud ? 'Dados na nuvem' : 'Dados neste computador'}</span>
        </button>
        <div className="suite">
          <button
            id="btn-suite-switcher"
            type="button"
            className="btn btn-s"
            aria-haspopup="menu"
            aria-expanded={suiteOpen}
            onClick={() => { setSuiteOpen((prev) => !prev); setNotificationsOpen(false); }}
          >
            <LayoutGrid className="ph" size={17} strokeWidth={1.5} />Suíte<ChevronDown size={12} strokeWidth={1.5} />
          </button>
          {suiteOpen && (
            <SuiteSwitcherPopover
              activeApp={activeNav === 'Centro de Custos' ? 'centro-custos' : 'orcamentos'}
              onSelectApp={onSelectApp}
              onClose={() => setSuiteOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          className="ibtn theme-toggle"
          aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
          title={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
          onClick={theme.toggle}
        >
          {escuro ? <Sun className="ph" size={20} strokeWidth={1.5} /> : <Moon className="ph" size={20} strokeWidth={1.5} />}
        </button>
      </header>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
