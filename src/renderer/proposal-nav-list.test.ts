import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { countPendingProposals, INITIAL_PROPOSAL_VIEW_MODE, viewModeOnSelectNav } from './proposalNav';

// Propostas abre sempre na lista principal: ao abrir o app, ao escolher Propostas no menu (mesmo com um editor aberto)
// e ao escolher Orcamentos no menu Suite. O editor so abre quando o usuario escolhe uma proposta.
const root = process.cwd();
const app = readFileSync(path.join(root, 'src/renderer/App.tsx'), 'utf8');

test('modo inicial e o menu sempre levam para a lista', () => {
  assert.equal(INITIAL_PROPOSAL_VIEW_MODE, 'list');
  assert.equal(viewModeOnSelectNav(), 'list');
});

test('App.tsx: estado inicial da visao e a lista; menu e Suite voltam para a lista', () => {
  assert.match(app, /useState<ProposalViewMode>\(INITIAL_PROPOSAL_VIEW_MODE\)/);
  assert.doesNotMatch(app, /useState<'editor' \| 'list' \| 'pdf' \| 'compare'>\('editor'\)/);
  // onSelectNav (menu lateral e assistente de IA, mesma funcao selectNav) reseta a visao
  assert.match(app, /const selectNav = \(label: NavSection\) => \{[^}]*setProposalViewMode\(viewModeOnSelectNav\(\)\)/s);
  assert.match(app, /onSelectNav=\{selectNav\}/);
  assert.match(app, /navigate=\{selectNav\}/);
  // onSelectApp('orcamentos') (menu Suite) reseta a visao
  assert.match(app, /app === 'orcamentos'\) \{[^}]*setProposalViewMode\(viewModeOnSelectNav\(\)\)/s);
});

test('App.tsx: o editor so abre por escolha explicita (linha, deep link, nova proposta, kit, catalogo, clientes)', () => {
  const opens = [...app.matchAll(/setProposalViewMode\('editor'\)/g)].length;
  assert.ok(opens >= 5, `esperava ao menos 5 aberturas explicitas do editor, achei ${opens}`);
  assert.match(app, /useProposalDeepLink\([\s\S]*?setProposalViewMode\('editor'\)/);
  assert.match(app, /proposalCreated[\s\S]*setProposalViewMode\('editor'\)/);
  assert.match(app, /openProposalFromList[\s\S]*setProposalViewMode\('editor'\)/);
});

test('Catalogo, Clientes, Kits e Configuracoes montam a visao principal da secao (sem restaurar item aberto)', () => {
  for (const key of ['catalog', 'clients', 'kits', 'settings']) assert.match(app, new RegExp(`key="${key}"`));
  // nenhuma dessas secoes guarda o item aberto fora do componente (remonta ao trocar de menu)
  for (const file of ['CatalogWorkspace.tsx', 'ClientsWorkspace.tsx', 'KitsWorkspace.tsx']) {
    const source = readFileSync(path.join(root, 'src/renderer', file), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage/, `${file} nao deve restaurar item de sessao anterior`);
  }
});

test('contagem do selo de Propostas: so as ultimas revisoes em edicao ou revisao', () => {
  assert.equal(countPendingProposals([
    { status: 'draft', isLatest: true },
    { status: 'review', isLatest: true },
    { status: 'sent', isLatest: true },
    { status: 'approved', isLatest: true },
    { status: 'draft', isLatest: false },
    { status: 'draft' },
  ]), 3);
  assert.equal(countPendingProposals([]), 0);
});
