import type { CatalogImportStatus } from '../shared/contracts';
import type { Row } from './catalogImportHelpers';

export type ImportMode = 'manual' | 'file' | 'image' | 'exsat';

// Mensagens das falhas da Exsat em portugues. Os codigos (EXSAT_*) chegam como texto dentro do erro do IPC do Electron
// ("Error invoking remote method ...: Error: EXSAT_NO_PRODUCTS") ou como mensagem da API; antes iam crus para a tela.
const EXSAT_MESSAGES: Array<[RegExp, string]> = [
  [/EXSAT_LOGIN_REQUIRED/, 'Sua sessão da Exsat expirou. Entre novamente para continuar.'],
  [/EXSAT_NO_PRODUCTS/, 'Não encontramos produtos com preço nessa página. Confira se você está conectado e se o endereço é de uma categoria ou busca.'],
  [/EXSAT_URL_INVALID/, 'Endereço inválido. Use endereços https://exsat.com.br/...'],
  [/EXSAT_RESPONSE_TOO_LARGE/, 'A página da Exsat é grande demais para ler. Use uma categoria menor.'],
  [/EXSAT_TOO_MANY_REDIRECTS/, 'A Exsat redirecionou a página vezes demais. Tente de novo mais tarde.'],
  [/EXSAT_UNAVAILABLE|EXSAT_HTTP_5\d\d/, 'A Exsat está fora do ar ou não respondeu. Tente de novo em alguns minutos.'],
  [/EXSAT_HTTP_4\d\d/, 'A Exsat recusou a consulta dessa página. Confira o endereço e a sua conta.'],
];

export const exsatErrorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const known = EXSAT_MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return known[1];
  const cleaned = message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/i, '').trim();
  return cleaned || fallback;
};

// Na Exsat so entram itens confirmados na pagina do produto ou editados por voce; divergentes, indisponiveis e com erro ficam de fora.
export const isImportableRow = (mode: ImportMode, row: Row) => {
  const valid = row.code.trim().length >= 2 && row.description.trim().length >= 3 && row.category.trim().length >= 2 && !!row.unit.trim();
  if (!valid) return false;
  if (mode !== 'exsat') return true;
  return row.status === 'confirmed' || row.status === undefined;
};

export const statusTone: Record<CatalogImportStatus, 'ok' | 'warn' | 'bad' | 'info' | ''> = {
  new: 'info', updated: 'info', unchanged: '', no_price: 'bad', confirmed: 'ok', divergent: 'warn', unavailable: 'bad', error: 'bad',
};

// No site nao existe o aplicativo: a conta e a leitura da Exsat so rodam no Electron.
export type ExsatPanelKind = 'desktop' | 'web';
export const exsatPanelKind = (desktop: boolean): ExsatPanelKind => (desktop ? 'desktop' : 'web');
