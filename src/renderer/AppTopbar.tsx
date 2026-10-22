import { useEffect, useState } from 'react';
import { isCloudRuntime, proposalApi } from './api';
import { Ph } from './Ph';
import type { AppTopbarProps } from './AppTopbarMobile';
import type { ProposalSummary } from '../shared/contracts';
import { AppTopbarMobile } from './AppTopbarMobile';
import { HelpModal } from './HelpModal';
import { NotificationsPopover } from './NotificationsPopover';
import { bellCount, bellLabel, useNoticeCount } from './notificationsFeed';
import { SuiteSwitcherPopover } from './SuiteSwitcherPopover';
import { openWebmail } from './webmail';
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
function AppTopbarDesktop({ activeNav, editorOpen, onSearch, onOpenSearchResult, onSelectApp, showNotice, assistantOpen, onToggleAssistant, onFollowNotice }: AppTopbarProps) {
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const theme = useTheme();
  const escuro = theme.resolved === 'escuro';
  const [search, setSearch] = useState('');
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);

  // Contador do sino: os avisos da Suite, os mesmos do celular.
  const notices = useNoticeCount();
  const searchLabel = editorOpen ? 'Buscar no catálogo' : 'Buscar propostas, clientes, obras';
  const results = search.trim().length < 2 ? [] : proposals.filter((proposal) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return [proposal.number, proposal.clientName, proposal.workName].some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
  }).slice(0, 6);

  useEffect(() => {
    if (search.trim().length < 2) return;
    let active = true;
    void proposalApi.list().then((result) => { if (active) setProposals(result.proposals); }).catch(() => { if (active) setProposals([]); });
    return () => { active = false; };
  }, [search]);

  return (
    <>
      <header className="top">
        <div className="busca" role="search">
          <Ph name="magnifying-glass" />
          <input
            id="global-search"
            className="inp"
            type="search"
            value={search}
            placeholder={searchLabel}
            aria-label={`${searchLabel}. Atalho Ctrl K`}
            aria-controls="global-search-results"
            aria-expanded={results.length > 0}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) onOpenSearchResult?.(results[0].id); }}
          />
          <kbd>Ctrl K</kbd>
          {search.trim().length >= 2 && <div className="busca-res" id="global-search-results" role="listbox">
            {results.length ? results.map((proposal) => <button key={proposal.id} type="button" role="option" onClick={() => onOpenSearchResult?.(proposal.id)}>
              <Ph name="file-text" size={18} /><span><b>{proposal.number} · {proposal.clientName}</b><small>{proposal.workName}</small></span>
            </button>) : <p>Nada encontrado para “{search}”.</p>}
          </div>}
        </div>
        <span className="espaco" />
        <UpdateNotice />
        {/* Assistente (decisao D1 da Suite): ibtn de 36 px, o primeiro dos botoes de icone, mesmo icone do botao flutuante. */}
        <button
          type="button"
          id="btn-assistente"
          className={`ibtn ${assistantOpen ? 'ativo' : ''}`}
          aria-label="Assistente"
          title="Assistente"
          aria-expanded={assistantOpen}
          onClick={() => { onToggleAssistant?.(); setSuiteOpen(false); setNotificationsOpen(false); }}
        >
          <Ph name="sparkle-fill" />
        </button>
        <div className="ancora">
          <button
            type="button"
            data-sino
            className={`ibtn ${notificationsOpen ? 'ativo' : ''}`}
            aria-label={bellLabel(notices.unread)}
            title="Notificações"
            aria-expanded={notificationsOpen}
            onClick={() => { setNotificationsOpen((prev) => !prev); setSuiteOpen(false); }}
          >
            <Ph name="bell" />
            {notices.unread > 0 && <span className="bell-count" aria-hidden="true">{bellCount(notices.unread)}</span>}
          </button>
          {notificationsOpen && (
            <NotificationsPopover
              onClose={() => setNotificationsOpen(false)}
              onUnreadChange={notices.setUnread}
              onFollow={(link) => onFollowNotice?.(link)}
            />
          )}
        </div>
        <button
          type="button"
          className="ibtn help-button"
          aria-label="Central de Ajuda"
          title="Central de Ajuda e Atalhos (Ctrl+H)"
          onClick={() => { setHelpOpen(true); setSuiteOpen(false); setNotificationsOpen(false); }}
        >
          <Ph name="question" />
        </button>
        <button
          type="button"
          className="ibtn"
          aria-label="Webmail Corporativo (UOL Pro)"
          title="Webmail Corporativo (UOL Pro)"
          onClick={() => {
            openWebmail();
            showNotice('Abrindo UOL Webmail Pro corporativo…');
          }}
        >
          <Ph name="envelope-simple" />
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
            <Ph name="squares-four" />Suíte<Ph name="caret-down" size={12} />
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
          <Ph name={escuro ? 'sun' : 'moon'} />
        </button>
      </header>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
