// Formatador unico pt-BR da interface (desktop): dinheiro, percentual, multiplicador, numero e plural.
// Use estas funcoes em vez de toFixed/replace ou de valores crus na tela.
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const finito = (value: number | null | undefined) => (Number.isFinite(value) ? Number(value) : 0);

/** R$ 1.234,56 (sempre com centavos). */
export const brl = (value: number | null | undefined) => brlFmt.format(finito(value));

/** 1.234,56 (duas casas, sem o simbolo). Campos de dinheiro fora de foco. */
export const dinheiro = (value: number | null | undefined) => decimal2.format(finito(value));

/** 1.234 ou 1.234,5 (ate `casas` casas, sem zeros a direita). */
export const numero = (value: number | null | undefined, casas = 2) =>
  finito(value).toLocaleString('pt-BR', { maximumFractionDigits: casas });

/** 99,3% (ate `casas` casas). Recebe o percentual ja em pontos (99.3, nao 0.993). */
export const pct = (value: number | null | undefined, casas = 1) =>
  `${finito(value).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`;

/** 1,25× (multiplicador com duas casas). */
export const mult = (value: number | null | undefined) => `${decimal2.format(finito(value))}×`;

/** "1 proposta" / "2 propostas" (numero formatado + singular ou plural). */
export const plural = (count: number, singular: string, pluralForm: string) =>
  `${numero(count, 0)} ${Math.abs(count) === 1 ? singular : pluralForm}`;
