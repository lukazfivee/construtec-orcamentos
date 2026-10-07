import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { exsatErrorMessage, exsatPanelKind, isImportableRow } from './catalogImportDialogModel';
import { newRow } from './catalogImportHelpers';
import { ignoredText, jobPercent } from './ExsatAccountCard';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const css = read('src/renderer/catalogImportDialog.css');
const dialog = read('src/renderer/CatalogImportDialog.tsx');
const exsatPanel = read('src/renderer/CatalogImportExsat.tsx');
const table = read('src/renderer/CatalogImportTable.tsx');
const accountCard = read('src/renderer/ExsatAccountCard.tsx');
const hook = read('src/renderer/useExsatServer.ts');
const rule = (selector: string) => {
  const found = css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  assert.ok(found, `regra ${selector} ausente`);
  return found[1];
};

test('importar em lote: erros da Exsat chegam em portugues, sem codigo tecnico nem prefixo do IPC', () => {
  const ipc = new Error("Error invoking remote method 'exsat:preview-auto': Error: EXSAT_NO_PRODUCTS");
  assert.match(exsatErrorMessage(ipc, 'x'), /Não encontramos produtos/);
  assert.match(exsatErrorMessage(new Error('EXSAT_LOGIN_REQUIRED'), 'x'), /sessão da Exsat expirou/);
  assert.match(exsatErrorMessage(new Error('EXSAT_URL_INVALID'), 'x'), /Endereço inválido/);
  assert.match(exsatErrorMessage(new Error('EXSAT_HTTP_503'), 'x'), /fora do ar/);
  assert.match(exsatErrorMessage(new Error("Error invoking remote method 'x': Error: Algo deu errado"), 'x'), /^Algo deu errado$/);
  assert.equal(exsatErrorMessage(undefined, 'Falha geral'), 'Falha geral');
  for (const code of ['EXSAT_NO_PRODUCTS', 'EXSAT_URL_INVALID', 'EXSAT_UNAVAILABLE', 'EXSAT_RESPONSE_TOO_LARGE']) {
    assert.ok(!/EXSAT_/.test(exsatErrorMessage(new Error(code), 'x')), code);
  }
});

test('importar em lote: na Exsat entram os confirmados e os editados, nunca divergente, indisponivel ou com erro', () => {
  const base = { code: 'EX-1', description: 'Camera IP', category: 'CFTV', unit: 'un' };
  assert.equal(isImportableRow('exsat', newRow({ ...base, status: 'confirmed' })), true);
  assert.equal(isImportableRow('exsat', newRow(base)), true, 'linha editada pelo usuario');
  for (const status of ['divergent', 'unavailable', 'error', 'no_price'] as const) {
    assert.equal(isImportableRow('exsat', newRow({ ...base, status })), false, status);
  }
  assert.equal(isImportableRow('exsat', newRow({ ...base, code: '' })), false);
  assert.equal(isImportableRow('manual', newRow({ ...base, status: 'divergent' })), true);
  assert.equal(isImportableRow('file', newRow({ ...base, description: 'ab' })), false);
});

test('importar em lote: no site a aba Exsat tem o cartao Conta Exsat; a senha so entra no campo e nunca volta', () => {
  assert.equal(exsatPanelKind(false), 'web');
  assert.equal(exsatPanelKind(true), 'desktop');
  assert.match(exsatPanel, /if \(!desktop\) return props\.server \? <ExsatAccountCard/);
  assert.ok(!/Só no aplicativo|não guarda a sua senha/.test(exsatPanel + accountCard), 'texto antigo de so no aplicativo');
  for (const text of ['Conta Exsat', 'Salvar e conectar', 'Atualizar catálogo', 'Conectada', 'Não conectada', 'role="progressbar"', 'Remover conta']) assert.ok(accountCard.includes(text), text);
  // Campo de senha do tipo password, sem autopreenchimento, limpo logo depois do envio e nunca preenchido com dado do servidor.
  assert.match(accountCard, /type="password"[^>]*autoComplete="new-password"/);
  assert.match(accountCard, /const typed = password;\s*setPassword\(''\)/);
  assert.ok(!/status\??\.password|server\.status\??\.[a-z]*[pP]ass/.test(accountCard), 'senha vinda do servidor');
  assert.ok(!/localStorage|sessionStorage/.test(accountCard + hook), 'senha ou conta em armazenamento do navegador');
  // So administrador ve o formulario; o servidor tambem recusa.
  assert.match(accountCard, /status\.canManage && ready/);
  // O que a varredura entrega vai para a mesma tabela de conferencia; itens sem preco sao informados, nunca importados.
  assert.match(dialog, /ignoredText\(result\.withoutPrice\)/);
  assert.match(accountCard, /itens sem preço ignorados/);
  assert.match(dialog, /importInChunks\(finalRows\)/);
  assert.equal(ignoredText(1), '1 item sem preço ignorado');
  assert.equal(ignoredText(241), '241 itens sem preço ignorados');
  // O seletor de arquivo do Electron nao existe no site: a aba Planilha leva ao assistente e Imagem/PDF explica.
  assert.match(dialog, /const canPick = !!app\?\.selectCatalogImport/);
  assert.match(dialog, /Abrir o assistente de importação/);
  assert.match(dialog, /roda só no aplicativo do computador/);
  assert.ok(!/\/api\/catalog\/import\/exsat/.test(read('src/renderer/api.ts') + read('public/m/screen-imp.js')), 'caminho publico sem login ainda ligado');
});

test('importar em lote: andamento da varredura em %, sem rolagem aninhada e sem cor fixa', () => {
  assert.equal(jobPercent({ pagesRead: 30, pagesFailed: 10, pagesTotal: 80 } as Parameters<typeof jobPercent>[0]), 50);
  assert.equal(jobPercent({ pagesRead: 0, pagesFailed: 0, pagesTotal: 0 } as Parameters<typeof jobPercent>[0]), 0);
  assert.equal(jobPercent({ pagesRead: 200, pagesFailed: 0, pagesTotal: 100 } as Parameters<typeof jobPercent>[0]), 100);
  assert.match(rule('.cid-prog'), /overflow: hidden/);
  assert.ok(!/overflow-y/.test(rule('.cid-job')), 'rolagem aninhada no andamento');
  assert.match(table, /SHOW_MAX = 300/);
});

test('importar em lote: visual do Centro, um unico corpo rolavel e nada de altura fixa', () => {
  assert.match(rule('.cid'), /border-radius: 14px/);
  assert.match(rule('.cid'), /max-height: min\(820px, 100%\)/);
  assert.ok(!/(?:^|[\s;])height:/.test(rule('.cid')), 'altura fixa corta o conteudo');
  assert.match(rule('.cid-body'), /overflow-y: auto/);
  assert.match(rule('.cid-table-wrap'), /overflow-x: auto/);
  assert.ok(!/overflow-y/.test(rule('.cid-table-wrap')), 'rolagem aninhada');
  assert.match(rule('.cid-tab[aria-selected="true"]'), /inset 0 -2px 0/);
  assert.match(rule('.cid-kv'), /gap: 12px 24px/);
  assert.match(rule('.cid-table td'), /height: 48px/);
  assert.match(dialog, /className="od-eyebrow">Catálogo/);
  assert.match(dialog, /role="tablist"/);
  assert.match(dialog, /aria-modal="true"/);
  // Cores so por tokens do tema (claro e escuro); sem hex solto.
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/var\([^)]*\)/g, '')), 'cor fixa no CSS do dialogo');
});

test('importar em lote: sem coluna ou linha vazia, valor unitario na Exsat e arquivos dentro do limite de linhas', () => {
  assert.match(table, /if \(rows\.length === 0\)/);
  assert.match(table, /Custo unitário/);
  assert.ok(!/key: 'source'/.test(table), 'coluna Fonte saiu da tabela');
  for (const [name, source] of Object.entries({ dialog, exsatPanel, table, accountCard, hook })) assert.ok(source.split('\n').length <= 350, `${name} passou de 350 linhas`);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const source of [dialog, exsatPanel, table, css]) assert.ok(!emoji.test(source));
});

test('importar em lote: regras antigas do dialogo removidas dos CSS globais', () => {
  for (const file of ['src/index.css', 'src/impeccable-audit.css', 'src/dialogos-centro.css', 'src/mobile-responsive.css']) {
    assert.ok(!/\.import-(?:dialog|overlay|source|summary|table|picker)|\.exsat-(?:session|source|failures)/.test(read(file)), file);
  }
});
