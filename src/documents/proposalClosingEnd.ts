// Fechamento (frase final, assinatura e validade) logo depois do ultimo texto, sem pagina propria: o bloco inteiro
// fica junto e, se nao couber no resto da pagina, vai inteiro para a seguinte. (O #154 colava o fechamento no
// rodape com pagina forcada, mas deixava a ultima pagina quase vazia.)

export const closingEndCss = `
    .closing-end { break-inside: avoid; page-break-inside: avoid; }`;

// Fim do bloco do fechamento: quem acrescenta texto no final do documento (aviso de validade do celular) o coloca aqui.
export const CLOSING_END_MARK = '<!--closing-end-->';

// Fim do corpo do documento com carta (dentro do grupo do meio da tabela de cabecalho e rodape): sem fechamento ancorado,
// o aviso de validade do celular entra aqui, antes do rodape repetido.
export const SHEET_END_MARK = '<!--sheet-end-->';
