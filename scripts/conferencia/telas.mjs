// Catalogo de telas do kit: como chegar em cada uma e a que parte da Referencia ela corresponde.
//  ref: chave da tela em DesktopOrc.dc.html (referencia.json > desktop.telas), usada na comparacao de textos.
//  quadros: "rodada:estado" dos quadros das Rodadas 21 a 24 que mostram esta tela (lista de estados a conferir).
//  passos: acoes na ordem. { clicar, em?, n? } | { linha, botao? } | { js } | { espera }. As funcoes recebem os dados de teste.

const IR = (secao) => ({ clicar: secao, em: '.side' });
const ABRIR = (numero) => ({ linha: numero, botao: 'Abrir' });

export const TELAS_DESKTOP = (d) => [
  { id: 'inicio', nome: 'Início', ref: 'sPainel', quadros: ['23:painel'], passos: [IR('Início')] },
  { id: 'propostas', nome: 'Propostas (lista)', ref: 'sProps', quadros: ['23:props'], passos: [IR('Propostas')] },
  { id: 'proposta-itens', nome: 'Proposta: Itens', ref: 'sProp', quadros: ['23:itens', '23:exProp'], passos: [IR('Propostas'), ABRIR(d.longa.numero)] },
  { id: 'proposta-mao-de-obra', nome: 'Proposta: Mão de obra', ref: 'sProp', quadros: [], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'Mão de obra' }] },
  { id: 'proposta-kits', nome: 'Proposta: Kits', ref: 'sProp', quadros: ['23:add'], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'Kits', em: '.section-tabs' }] },
  { id: 'proposta-corpo', nome: 'Proposta: Corpo e condições', ref: 'sProp', quadros: [], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'Corpo e condições' }] },
  { id: 'proposta-historico', nome: 'Proposta: Histórico (revisões)', ref: 'sProp', quadros: ['23:p42rev'], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'Histórico' }] },
  { id: 'proposta-inserir', nome: 'Proposta: menu Inserir', ref: 'dAdd', quadros: ['23:add'], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'Inserir' }] },
  { id: 'pdf', nome: 'PDF da proposta', ref: 'sPdf', quadros: ['23:pdf', '23:pdfShare', '23:pdfSend', '23:pdfRes'], passos: [IR('Propostas'), ABRIR(d.longa.numero), { clicar: 'PDF' }, { espera: 2500 }] },
  { id: 'comparativo', nome: 'Comparativo de revisões', ref: 'sCmp', quadros: ['23:cmp', '23:cmpOnly', '23:cmp041'], passos: [IR('Propostas'), ABRIR(`${d.revisoes.numero} REV.01`), { clicar: 'Comparar revisões' }, { espera: 2500 }] },
  { id: 'catalogo', nome: 'Catálogo', ref: 'sCat', quadros: ['24:cat'], passos: [IR('Catálogo')] },
  { id: 'catalogo-importar', nome: 'Catálogo: Importar lista', ref: 'sImp', quadros: ['24:imp1', '24:imp2', '24:imp3Err', '24:impRun', '24:impOk'], passos: [IR('Catálogo'), { clicar: 'Importar lista' }] },
  { id: 'exsat', nome: 'Integração EXSAT', ref: 'sEx', quadros: ['24:ex', '24:exSync', '24:exAfter'], passos: [IR('Catálogo'), { clicar: 'EX Integração' }] },
  { id: 'kits', nome: 'Kits', ref: 'sKits', quadros: ['24:kits'], passos: [IR('Kits')] },
  { id: 'kits-usar', nome: 'Kits: Usar em proposta', ref: 'dKit', quadros: ['24:kitUse'], passos: [IR('Kits'), { clicar: 'Usar em proposta' }] },
  { id: 'clientes', nome: 'Clientes', ref: 'sClis', quadros: ['24:cli'], passos: [IR('Clientes'), { espera: 1500 }] },
  { id: 'configuracoes-geral', nome: 'Configurações: Geral', ref: 'sCfg', quadros: ['24:cfg'], passos: [IR('Configurações')] },
  { id: 'configuracoes-empresa', nome: 'Configurações: Empresa e propostas', ref: 'sCfg', quadros: ['24:cfg'], passos: [IR('Configurações'), { clicar: 'Empresa e propostas' }] },
  { id: 'configuracoes-usuarios', nome: 'Configurações: Usuários', ref: null, quadros: [], passos: [IR('Configurações'), { clicar: 'Usuários' }, { espera: 1500 }] },
  { id: 'configuracoes-sistema', nome: 'Configurações: Sistema', ref: null, quadros: [], passos: [IR('Configurações'), { clicar: 'Sistema' }, { espera: 1500 }] },
  { id: 'nova-proposta', nome: 'Nova proposta (janela)', ref: 'dNova', quadros: ['23:nova'], passos: [IR('Propostas'), { clicar: 'Nova proposta' }] },
];

// Celular: abre o /m/ e troca de tela por OC.go (mesma rota do app). Cada tela e carregada do zero.
const M = (tela, params = {}) => ({ js: `OC.go(${JSON.stringify(tela)}, ${JSON.stringify(params)})` });
const PRONTO = { espera: 1400 };

export const TELAS_CELULAR = (d) => [
  { id: 'inicio', nome: 'Início', quadros: [], passos: [M('home'), PRONTO] },
  { id: 'painel', nome: 'Painel', quadros: [], passos: [M('painel'), PRONTO] },
  { id: 'avisos', nome: 'Avisos', quadros: [], passos: [M('avisos'), PRONTO] },
  { id: 'propostas', nome: 'Propostas (lista)', quadros: [], passos: [M('props'), PRONTO] },
  { id: 'proposta-resumo', nome: 'Proposta: Resumo', quadros: ['21:fromPdf'], passos: [M('prop', { id: d.longa.id, tab: 'resumo' }), PRONTO] },
  { id: 'proposta-itens', nome: 'Proposta: Itens', quadros: [], passos: [M('prop', { id: d.longa.id, tab: 'itens' }), PRONTO] },
  { id: 'proposta-revisoes', nome: 'Proposta: Revisões', quadros: ['21:fromCmp'], passos: [M('prop', { id: d.revisoes.id, tab: 'revisoes' }), PRONTO] },
  { id: 'nova-proposta', nome: 'Nova proposta', quadros: [], passos: [M('nova'), PRONTO] },
  { id: 'mao-de-obra', nome: 'Mão de obra', quadros: [], passos: [M('labor', { id: d.longa.id }), PRONTO] },
  { id: 'pdf', nome: 'PDF da proposta', quadros: ['21:pdf', '21:pdfZoom', '21:pdfShare', '21:pdfSend', '21:pdfRes', '21:pdfTec', '21:pdfLoad', '21:pdfVazio', '21:pdfErro'], passos: [M('pdf', { id: d.longa.id }), { espera: 2800 }] },
  { id: 'comparativo', nome: 'Comparativo de revisões', quadros: ['21:cmp', '21:cmpOnly', '21:cmpPick', '21:cmp041', '21:cmpTec', '21:cmpLoad', '21:cmpVazio', '21:cmpErro'], passos: [M('cmp', { id: d.revisoes.id }), { espera: 2200 }] },
  { id: 'link-do-cliente', nome: 'Link do cliente', quadros: [], passos: [M('link', { id: d.aprovada.id }), PRONTO] },
  { id: 'corpo', nome: 'Corpo da proposta', quadros: [], passos: [M('corpo', { id: d.longa.id }), PRONTO] },
  { id: 'kits', nome: 'Kits', quadros: [], passos: [M('kits'), PRONTO] },
  { id: 'kit', nome: 'Kit (detalhe)', quadros: [], passos: [M('kit', { id: d.kitId }), PRONTO] },
  { id: 'menu', nome: 'Menu', quadros: [], passos: [M('menu'), PRONTO] },
  { id: 'configuracoes', nome: 'Configurações', quadros: [], passos: [M('cfg'), PRONTO] },
  { id: 'configuracoes-corpo', nome: 'Configurações: corpo padrão', quadros: [], passos: [M('cfgCorpo'), PRONTO] },
  { id: 'configuracoes-empresa', nome: 'Configurações: empresa', quadros: [], passos: [M('cfgEmp'), PRONTO] },
  { id: 'catalogo', nome: 'Catálogo', quadros: ['22:fromImp', '22:fromEx'], passos: [M('cat'), PRONTO] },
  { id: 'catalogo-configurar', nome: 'Catálogo: configurar', quadros: [], passos: [M('catConf'), PRONTO] },
  { id: 'importar', nome: 'Importar catálogo', quadros: ['22:imp1', '22:impFile', '22:imp2', '22:impCol', '22:impMiss', '22:imp3Err', '22:impFix', '22:impOk', '22:impLoad', '22:impRun', '22:impVazio', '22:impErro'], passos: [M('imp'), PRONTO] },
  { id: 'exsat', nome: 'Integração EXSAT', quadros: ['22:ex', '22:exProp', '22:exUpd', '22:exSync', '22:exAfter', '22:exLoad', '22:exVazio', '22:exErro'], passos: [M('exsat'), PRONTO] },
  { id: 'clientes', nome: 'Clientes', quadros: [], passos: [M('cli'), PRONTO] },
  { id: 'descartadas', nome: 'Propostas descartadas', quadros: [], passos: [M('desc'), PRONTO] },
  { id: 'descartada-detalhe', nome: 'Proposta descartada (detalhe)', quadros: [], passos: [M('descDet', { id: d.descartadaId }), PRONTO] },
  { id: 'usuarios', nome: 'Usuários', quadros: [], passos: [M('users'), PRONTO] },
  { id: 'ajuda', nome: 'Ajuda', quadros: [], passos: [M('ajuda'), PRONTO] },
];

export const VIEWPORTS_DESKTOP = ['1440x900', '1280x800', '1280x720'];
export const VIEWPORTS_CELULAR = ['375x812'];
export const TEMAS = ['claro', 'escuro'];
