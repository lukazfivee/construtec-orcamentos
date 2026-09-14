# Construtec Orçamentos — handoff operacional

## 2026-09-10 — Alíquota de Impostos, Recuperação PGlite e Formatação DOCX

- Recuperação de Banco de Dados: Corrupção de WAL do PGlite (`could not locate valid checkpoint record`) corrigida com reconstrução limpa de WAL e controle Castagnoli CRC32C. 100% dos dados mantidos intactos.
- Auto-cura de travas: Implementada remoção preventiva de `postmaster.pid` obsoleto em `src/server/services/database.ts` para evitar travamentos em reinicializações bruscas.
- Alíquota de Impostos (%):
  - Migração `010-proposal-tax.ts` e coluna `tax_percentage` em `proposals`.
  - Rota `PATCH /api/proposals/:id/tax` ativa e tipada.
  - `ProposalEditorWorkspace.tsx` sanitiza `%`, vírgulas e espaços, evitando erros de `NaN`.
  - `ProposalSummaryPanel.tsx` recalcula instantaneamente os totais em tempo real durante a digitação.
  - Regra de cálculo comercial: Custo-base × BDI = Subtotal com BDI; Impostos = Subtotal com BDI × (Alíquota / 100); Total Final = Subtotal com BDI + Impostos.
- Formatação DOCX (Word): `proposalDocx.ts` recebeu suporte a `columnSpan: 2` na linha de impostos no resumo quando há materiais e mão de obra, eliminando descompasso de colunas no Word.
- Validação: `npx tsc --noEmit` passou com 0 erros; `npm run test:critical` passou com 19/19 testes; regra `MAX_LINES <= 350` respeitada em todos os arquivos modificados.

## 2026-09-10 — Mesa única Orçamentos → Centro de Custos

- Retomada encontrada no diretório de trabalho: navegação integrada, workspace com iframe e ação de proposta já estavam implementados e não foram sobrescritos.
- Corrigido o deep link da obra: `http://localhost:3333/#obra=<id>` agora abre a tela de Obras / centros e o detalhe do centro indicado após autenticação, em `../../centro de custos CONSTRUTEC/public/app.js`.
- Corrigido o diagnóstico falso de serviço desconectado: o Centro agora libera CORS somente para origens locais, permitindo que o Orçamentos em `:5173` consulte a saúde em `:3333`.
- Corrigido o bloqueio do iframe no Chrome: a CSP do Centro declara explicitamente `http://localhost:5173` como frame pai permitido.
- Validação: `npm run test:critical` no Orçamentos passou (19/19); `npm run check` no Centro de Custos passou (78 arquivos); checagem direta do deep link passou.
- Próximo passo: reiniciar a suíte e homologar a navegação com os dois serviços locais ativos e uma sessão autenticada no Centro de Custos.

## 2026-09-08 — Homologação da suíte

- Corrigida sincronização: outbox permanece pendente até recibo válido do Centro; exportação manual preserva comportamento anterior.
- Reenvio real homologado, com IDs de obra e baseline original no recibo.
- Roteiro repetível: node scripts/homologate-suite.mjs, com PGlite isolado e processos em portas temporárias.
- Detalhes e evidências: ../../INTEGRAÇÃO-ORÇAMENTOS-CENTRO V3/09-HOMOLOGACAO-SUITE.md.
- Base local preservada: 7c204aa; fetch origin/main executado, divergência de 8 commits locais e 1 remoto. Nenhum merge sobre alterações locais.
- Aplicativo instalado e banco de produção preservados; não foi gerado instalador.
- Validação final: `npm run verify` código 0, 19/19 testes, typecheck/lint sem erros e 11 avisos preexistentes.
- Histórico integral preservado em CODEX_HANDOFF-ARQUIVO-01.md e CODEX_HANDOFF-ARQUIVO-02.md (divisão para MAX_LINES <= 350).
