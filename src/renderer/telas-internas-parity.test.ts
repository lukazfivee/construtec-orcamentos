import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

// Telas internas (editor da proposta, Catalogo, Kits, Clientes, Configuracoes, PDF) com os mesmos tokens e componentes
// do Centro de Custos. Aqui ficam travados os tokens estaticos, a ausencia de botoes ambiguos e o PDF/Word sempre claros.
const root = process.cwd();
// O tamanho das letras vem multiplicado por --fs (escala-75.css); a medida comparada e a base em px.
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/calc\(([0-9.]+(?:px|rem)) \* var\(--fs, 1\)\)/g, '$1');
const editor = read('src/editor-itens-centro.css');
const paineis = read('src/editor-paineis-centro.css');
const internas = read('src/telas-internas-centro.css');
const dialogos = read('src/dialogos-centro.css');

const has = (css: string, selector: string, ...props: string[]) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`, 'gm');
  const bodies = [...css.matchAll(re)].map((match) => match[1]);
  assert.ok(bodies.length > 0, `regra ${selector} nao encontrada`);
  for (const prop of props) assert.ok(bodies.some((body) => body.includes(prop)), `${selector} sem ${prop}`);
};

test('arquivos novos de CSS entram depois da casca do Centro', () => {
  const renderer = read('src/renderer.tsx');
  const order = ['./config-centro.css', './editor-itens-centro.css', './editor-paineis-centro.css', './telas-internas-centro.css', './dialogos-centro.css'];
  const positions = order.map((file) => renderer.indexOf(`'${file}'`));
  positions.forEach((position, index) => assert.ok(position > 0, `${order[index]} nao importado`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('tabela de itens: cabecalho 11/600 caixa alta, corpo 13, linha de 56 px e campos de 40 px como o .tbl/.inp do Centro', () => {
  has(editor, '.app-shell.cc .proposal-items-table thead th', 'height: 40px', 'font-size: 11px', 'font-weight: 600', 'letter-spacing: .05em', 'text-transform: uppercase');
  // 55 px + 1 px de borda colapsada = linha de 56 px, igual ao .tbl td do Centro
  has(editor, '.app-shell.cc .proposal-items-table tbody td', 'height: 55px', 'font-size: 13px');
  has(editor, '.app-shell.cc .proposal-items-table td input:not([type="checkbox"]), .app-shell.cc .proposal-items-table td select', 'height: 40px', 'border-radius: 10px');
  has(editor, '.app-shell.cc .proposal-items-table', 'min-width: 0', 'table-layout: fixed');
});

test('tabela de itens: colunas somam menos que a area util em 1280 (sem rolagem horizontal)', () => {
  const width = (selector: string) => {
    const match = editor.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{ width: (\\d+)px`));
    assert.ok(match, `largura de ${selector} nao encontrada`);
    return Number(match[1]);
  };
  const fixed = width('.app-shell.cc .proposal-items-table .col-select, .app-shell.cc .proposal-items-table td.col-select') // checkbox
    + width('.app-shell.cc .proposal-items-table .col-index') + width('.app-shell.cc .proposal-items-table .col-code')
    + width('.app-shell.cc .proposal-items-table .col-quantity') + width('.app-shell.cc .proposal-items-table .col-unit');
  assert.ok(fixed + 3 * 84 + 92 + 150 <= 1280 - 236 - 260, 'colunas fixas deixam menos de 150 px para a descricao em 1280');
});

test('barra de ferramentas: Subir e Descer tem rotulo proprio (sem dois botoes Mover iguais)', () => {
  const toolbar = read('src/renderer/ProposalItemsToolbar.tsx');
  assert.ok(!/<\/?[A-Za-z]+[^>]*>\s*Mover\s*</.test(toolbar.replace(/aria-label="[^"]*"/g, '')), 'texto visivel "Mover" repetido');
  assert.match(toolbar, /aria-label="Subir item selecionado"[\s\S]*?Subir/);
  assert.match(toolbar, /aria-label="Descer item selecionado"[\s\S]*?Descer/);
  assert.equal((toolbar.match(/> Mover</g) ?? []).length, 0);
});

test('abas de propostas abertas, status e resumo comercial usam os tokens do Centro', () => {
  has(editor, '.app-shell.cc .proposal-tabs', 'gap: 26px');
  has(editor, '.app-shell.cc .proposal-tabs button.selected::after', 'height: 2px');
  has(editor, '.app-shell.cc .meta-field .status-select', 'min-width: 0', 'height: 24px', 'border-radius: 12px');
  has(editor, '.app-shell.cc .commercial-panel .panel-card', 'border-radius: 14px');
  has(editor, '.app-shell.cc .commercial-panel .amount.blue strong', 'font-size: 21px', 'font-weight: 600');
  has(editor, '.app-shell.cc .commercial-panel .amount.blue span', 'font-size: 11.5px', 'text-transform: uppercase');
  const summary = read('src/renderer/ProposalSummaryPanel.tsx');
  assert.match(summary, /className="panel-card summary-card"/);
});

test('Adicionar linha sai do centro da tela, onde o aviso rapido aparece', () => {
  has(editor, '.app-shell.cc .proposal-items-panel .add-line', 'align-self: flex-start');
});

test('abas internas: Mao de obra, Kits, Condicoes e Historico usam cartao, campos e tabela do Centro', () => {
  has(paineis, '.app-shell.cc .history-table td', 'height: 56px', 'font-size: 13px');
  has(paineis, '.app-shell.cc .kp-card', 'border-radius: 14px');
  has(paineis, '.app-shell.cc .labor-form', 'border-radius: 14px');
  const kits = read('src/renderer/ProposalKitsPanel.tsx');
  assert.ok(!/style=\{\{/.test(kits), 'ProposalKitsPanel nao deve ter estilos em linha');
  const conditions = read('src/renderer/ProposalCommercialConditionsPanel.tsx');
  assert.ok(!/border: '1px solid var\(--line-strong\)'/.test(conditions), 'Condicoes sem borda em linha');
});

test('Catalogo, Clientes e Kits: cabecalho .cab com eyebrow e formularios com campos e botoes do Centro', () => {
  for (const file of ['CatalogEditor', 'ClientsRegistry', 'KitsEditor']) {
    const source = read(`src/renderer/${file}.tsx`);
    assert.match(source, /className="management-header cab"/, `${file} sem cabecalho .cab`);
    assert.match(source, /<span className="eyebrow">Cadastros<\/span>/, `${file} sem eyebrow`);
  }
  has(internas, '.app-shell.cc .management-body', 'border-radius: 14px');
  has(internas, '.app-shell.cc .client-list > button', 'min-height: 56px');
  has(internas, '.app-shell.cc .management-search', 'height: 40px', 'border-radius: 10px');
  const table = read('src/renderer/KitItemsTable.tsx');
  assert.ok(!/style=\{\{/.test(table), 'KitItemsTable nao deve ter estilos em linha');
});

test('Configuracoes: abas de pagina mantem o formulario montado (paineis hidden, nao desmontados)', () => {
  const source = read('src/renderer/SettingsWorkspace.tsx');
  assert.match(source, /className="st-tabs" role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.equal((source.match(/hidden=\{tab !== /g) ?? []).length, 5);
  assert.match(source, /<form id="settings-form"/);
  has(internas, '.app-shell.cc .st-tabs .tab[aria-selected="true"]', 'box-shadow: inset 0 -2px 0');
  has(internas, '.app-shell.cc .st-tabs', 'gap: 26px');
});

test('dialogos: raio 14, sombra de popover e botoes de 40 px', () => {
  has(dialogos, '.modal-card', 'border-radius: 14px', 'box-shadow: var(--shadow-pop)');
  has(dialogos, '.modal-card .modal-footer button', 'height: 40px', 'border-radius: 10px');
});

test('PDF e Word da proposta continuam claros: os estilos do Centro nao tocam a pagina do documento', () => {
  for (const css of [editor, paineis, internas, dialogos]) {
    assert.ok(!/\.pdf-page-scale|\.sheet-timbrado|\.pdf-page\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'CSS do tema tocando o documento');
  }
  const pdfCss = read('src/proposal-pdf-page.css');
  assert.ok(!/var\(--color-|prefers-color-scheme|data-theme/.test(pdfCss), 'pagina do PDF dependente do tema');
});

test('sem emoji nos arquivos novos', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const css of [editor, paineis, internas, dialogos, read('src/kit-itens.css')]) assert.ok(!emoji.test(css));
});
