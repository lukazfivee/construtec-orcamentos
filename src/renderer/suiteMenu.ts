// Lista do menu Suíte, a mesma do desktop do Centro de Custos (public/d/suite.js): quatro destinos e o Webmail.
// O menu tem só estes destinos. Centralizada aqui para o desktop e o celular não divergirem.
export type SuiteAppId = 'orcamentos' | 'centro-custos' | 'chamados' | 'webmail';

export interface SuiteMenuEntry {
  id: SuiteAppId;
  title: string;
  subtitle: string;
  /** Endereço fixo; null quando o destino depende do ambiente (Centro, Chamados) ou da tela atual (Orçamentos). */
  url: string | null;
}

/* Entrada do Chamados e O.S.: pagina do Centro que inicia o login central ja direcionado ao Chamados (handoff de uso unico). */
export const CHAMADOS_ENTRADA_PATH = '/chamados/entrar';
export const chamadosEntradaUrl = (centroUrl: string) => `${centroUrl.replace(/\/+$/, '')}${CHAMADOS_ENTRADA_PATH}`;
export const WEBMAIL_URL = 'https://webmailpro.uol.com.br/';
export const SUITE_MENU_TITLE = 'Suíte Construtec';

export const SUITE_APPS: SuiteMenuEntry[] = [
  { id: 'orcamentos', title: 'Orçamentos', subtitle: 'Etapa 01 · propostas e BDI', url: null },
  { id: 'centro-custos', title: 'Centro de Custos', subtitle: 'Etapa 02 · gestão das obras', url: null },
  { id: 'chamados', title: 'Chamados e O.S.', subtitle: 'Etapa 03 · atendimento e manutenção', url: null },
];

export const SUITE_WEBMAIL: SuiteMenuEntry = {
  id: 'webmail',
  title: 'Webmail',
  subtitle: 'E-mail corporativo UOL',
  url: WEBMAIL_URL,
};
