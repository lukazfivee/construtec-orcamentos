// Corpo da proposta montado pelo usuario: lista ordenada de blocos (titulo, paragrafo, lista, tabela de itens
// e condicoes comerciais). NULL = a proposta usa o layout fixo de sempre, entao as antigas nao mudam.
// Aditiva e idempotente; jsonb (e nao json) para o guard de proposta aprovada poder comparar a linha.
export const proposalBodyBlocksMigration = `
  ALTER TABLE proposals ADD COLUMN IF NOT EXISTS body_blocks jsonb;
`;
