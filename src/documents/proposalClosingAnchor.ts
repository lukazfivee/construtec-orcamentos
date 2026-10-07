// Fechamento (frase final, validade e assinatura) sempre no fim da ultima pagina do PDF, perto do rodape.
// Na impressao o fechamento ocupa uma pagina propria (quebra antes) com a altura util inteira e fica alinhado
// ao fim dela. Nao ha como saber, so com CSS ou script, quanto sobra na ultima pagina de texto: uma simulacao da
// paginacao errou ate 30 mm contra a impressao real, entao a posicao fixa na pagina propria e a que nunca falha.
// Na tela (pre-visualizacao) o fechamento continua logo depois do texto.

// pageMm: altura util de uma pagina (folha menos as margens do @page); 1 mm a menos evita folha extra por arredondamento.
export const anchorCss = (pageMm: number): string => `
    @media print {
      .closing-end { break-before: page; min-height: ${pageMm - 1}mm; display: flex; flex-direction: column; justify-content: flex-end; }
      .closing-end > .closing-block { margin-top: 0; }
    }`;

// Fim da pagina do fechamento: quem acrescenta texto no final do documento (aviso de validade do celular) o coloca aqui.
export const CLOSING_END_MARK = '<!--closing-end-->';
