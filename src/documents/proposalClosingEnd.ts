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

// Onde comeca o grupo do fechamento: o fechamento (ultimo bloco) mais a secao de texto logo antes dele (titulo e ate 3 blocos
// de texto ou lista). Sem titulo nesse trecho, so o fechamento fica no grupo.
export const closingGroupStart = (parts: ReadonlyArray<{ kind: string }>): number => {
  const last = parts.length - 1;
  for (let index = last - 1; index >= 0 && index >= last - 4; index -= 1) {
    const kind = parts[index].kind;
    if (kind === 'heading') return index;
    if (kind !== 'paragraph' && kind !== 'list') break;
  }
  return last;
};
