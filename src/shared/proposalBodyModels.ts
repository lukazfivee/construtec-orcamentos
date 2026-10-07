// Modelos de proposta completos (corpo inteiro, na ordem de uma proposta tecnica-comercial da Construtec).
// Texto-padrao editavel: o que esta entre [colchetes] e para o usuario preencher; {{variaveis}} vem da proposta.
// Nunca leva custo, BDI ou margem. Aplicar um modelo troca o corpo inteiro; propostas existentes nao mudam sozinhas.
import { DEFAULT_LETTER_PLACE, LETTER_TITLE_DEFAULT, newBodyId, todayIso, type BodyBlock } from './proposalBody';

export type BodyModelId = 'servico' | 'fornecimento';
type ModelBlock = Omit<BodyBlock, 'id'>;
export type BodyModel = { id: string; name: string; description: string; blocks: ModelBlock[] };

const para = (title: string, text: string, extra: Partial<ModelBlock> = {}): ModelBlock => ({ type: 'paragrafo', title, text, enabled: true, ...extra });
const list = (text: string, title?: string, extra: Partial<ModelBlock> = {}): ModelBlock => ({ type: 'lista', ...(title ? { title } : {}), text, enabled: true, ...extra });

const LETTER: ModelBlock = {
  type: 'carta', title: LETTER_TITLE_DEFAULT, enabled: true, numbered: true,
  fields: {
    place: DEFAULT_LETTER_PLACE, recipient: '{{cliente}}', attention: '{{contato}}', department: '{{setor_contato}}',
    reference: 'Proposta nº {{numero}} - {{escopo}} - Obra: {{obra}}',
    greeting: 'Prezados Senhores:',
    intro: 'Atendendo à vossa solicitação, segue nossa Proposta Técnica-Comercial para o fornecimento em referência, conforme detalhamento abaixo:',
  },
};
const PRESENTATION = para('Apresentação – CONSTRUTEC', 'A CONSTRUTEC é uma empresa especializada e dedicada exclusivamente ao desenvolvimento de soluções tecnológicas aplicadas e execução de serviços nas áreas de segurança eletrônica (CFTV e controle de acesso), automação predial (BMS), automação industrial, elétrica e detecção e alarme de incêndio, e vem oferecendo aos seus clientes uma ampla linha de serviços para empresas de todos os portes, sempre com a aplicação da mais atual tecnologia, aliada a uma equipe altamente capacitada, levando, consequentemente, a um custo/benefício sem igual no mercado.');
const REFERENCES = list('- [Projetos, memoriais e demais documentos de referência]', 'Documentos de referência');
const CONDITIONS_OFF: ModelBlock = { type: 'condicoes', enabled: false };
const CLOSING: ModelBlock = {
  type: 'fechamento', enabled: true,
  text: 'No aguardo de breve pronunciamento por parte de V.Sas., nos colocamos à inteira disposição para quaisquer esclarecimentos que se fizerem necessários.',
  fields: { signer: '{{responsavel}}', role: '' },
};
const PAYMENT = [
  para('Condições de pagamento', 'Mediante a apresentação de boletim de medição e autorização de pagamento, após análise do cliente.'),
  para('Prazo de pagamento', 'Conforme normas indicadas pelo cliente.'),
  para('Validade da proposta', 'Esta proposta é válida até {{validade}}.'),
];

export const BODY_MODELS: BodyModel[] = [
  {
    id: 'servico', name: 'Proposta de serviço (mão de obra)',
    description: 'Carta de abertura, escopo, prazos, planilha, equipe, responsabilidades, pagamento, validade e assinatura.',
    blocks: [
      LETTER, PRESENTATION,
      para('Objetivo', 'Fornecimento de mão de obra especializada para execução dos serviços de {{escopo}}, para atender a obra {{obra}}, de {{cliente}}.'),
      para('Escopo do serviço', 'Seguem abaixo os itens de fornecimento contemplados neste escopo de serviço:'),
      list('- [Item do escopo 1]\n- [Item do escopo 2]\n- [Item do escopo 3]'),
      list('- [Item fora do escopo 1]\n- [Item fora do escopo 2]', 'Fora de escopo'),
      REFERENCES,
      para('Mobilização do serviço', 'O início do serviço se dará [10] dias úteis após a emissão do pedido de compra ou solicitação de aceite da proposta via e-mail.'),
      para('Prazo de execução do serviço', 'O tempo de execução do serviço será de [150] dias corridos.'),
      para('Cronograma', 'O cronograma de avanço físico será seguido conforme os marcos de entregas propostos por {{cliente}}.'),
      para('Treinamento', 'Após o comissionamento e os testes dos sistemas, será fornecido treinamento para a equipe de manutenção do cliente, conforme solicitação.'),
      para('Operação assistida', 'A equipe da CONSTRUTEC irá apoiar a equipe de manutenção do cliente por [30] dias após a entrega total do sistema.'),
      para('Garantia', 'A CONSTRUTEC dará [90] dias de garantia aos serviços executados.'),
      { type: 'itens', title: 'Planilha orçamentária', text: 'Planilha de mão de obra - {{obra}}', enabled: true },
      para('Equipe técnica', 'A equipe técnica para desenvolvimento das atividades na obra {{obra}}:'),
      list('- [Engenheiro responsável]\n- [Supervisor]\n- [Instalador / montador]'),
      { type: 'titulo', title: 'Responsabilidades do serviço', enabled: true },
      list('- Fornecer mão de obra qualificada para a execução do serviço contratado;\n- Fornecer as ferramentas necessárias para a execução do serviço;\n- Fornecer transporte e alimentação da equipe;\n- Fornecer a documentação de ASO, NRs e certificações técnicas da equipe;\n- Enviar informações técnicas quando solicitadas pelo cliente.', 'Responsabilidades da CONSTRUTEC', { sub: true }),
      list('- Fornecer os documentos e as informações técnicas necessárias, com seus pareceres;\n- Liberar as áreas para as frentes de trabalho;\n- Cumprir o cronograma físico da obra, para não gerar atrasos na entrega do serviço nem aditivos;\n- Fornecer os materiais, quando não estiverem no escopo desta proposta.', 'Responsabilidades do CLIENTE', { sub: true }),
      ...PAYMENT, CONDITIONS_OFF, CLOSING,
    ],
  },
  {
    id: 'fornecimento', name: 'Proposta de fornecimento (materiais)',
    description: 'Mesmo esqueleto, sem mobilização, equipe e responsabilidades de serviço: escopo, prazo de entrega, lista de materiais, pagamento e validade.',
    blocks: [
      LETTER, PRESENTATION,
      para('Objetivo', 'Fornecimento de materiais e equipamentos para {{escopo}}, para atender a obra {{obra}}, de {{cliente}}.'),
      para('Escopo do fornecimento', 'Seguem abaixo os itens contemplados neste fornecimento, detalhados na planilha orçamentária:'),
      list('- [Item do fornecimento 1]\n- [Item do fornecimento 2]\n- [Item do fornecimento 3]'),
      list('- [Item fora do fornecimento 1]\n- [Item fora do fornecimento 2]', 'Fora de escopo'),
      REFERENCES,
      para('Prazo de entrega', 'A entrega dos materiais será realizada em [30] dias corridos após a emissão do pedido de compra ou o aceite da proposta via e-mail.'),
      para('Garantia', 'Os equipamentos seguem a garantia do fabricante.'),
      { type: 'itens', title: 'Planilha orçamentária', text: 'Lista de materiais - {{obra}}', enabled: true },
      ...PAYMENT, CONDITIONS_OFF, CLOSING,
    ],
  },
];

// Modelo salvo pela empresa a partir do corpo de uma proposta (blocos sem id; os ids saem novos ao aplicar).
export type CompanyBodyModel = { id: string; name: string; blocks: ModelBlock[] };

// Modelos de fabrica primeiro; com a lista da empresa, tambem os salvos por ela.
export const findBodyModel = (id: string | null | undefined, company: CompanyBodyModel[] = []): BodyModel | undefined =>
  BODY_MODELS.find((model) => model.id === id)
  ?? company.filter((model) => model.id === id).map((model): BodyModel => ({ id: model.id, name: model.name, description: 'Modelo salvo pela empresa.', blocks: model.blocks }))[0];

// Blocos novos (ids novos) do modelo; a data da carta e a de hoje.
export const modelBodyBlocks = (model: BodyModel, today = todayIso(), place = DEFAULT_LETTER_PLACE): BodyBlock[] =>
  model.blocks.map((block) => ({
    ...block, id: newBodyId(),
    ...(block.fields ? { fields: block.type === 'carta' ? { ...block.fields, place, date: today } : { ...block.fields } } : {}),
  }));

// Trechos [entre colchetes] que o usuario ainda precisa preencher.
export const pendingPlaceholders = (blocks: BodyBlock[]): number =>
  blocks.filter((block) => block.enabled).reduce((total, block) => {
    const text = [block.title, block.text, ...Object.values(block.fields ?? {})].join('\n');
    return total + (text.match(/\[[^\][\n]+\]/g)?.length ?? 0);
  }, 0);
