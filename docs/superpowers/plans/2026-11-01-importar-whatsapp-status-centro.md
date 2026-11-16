# Importar compras do WhatsApp: estado real no Centro (2026-11-01)

Este arquivo substitui o plano de implementação de 2026-10-30, que ficou obsoleto: a feature já foi implementada e publicada no repo do Centro (`lukazfivee/centro-custos-construtec`) pelo Codex em 2026-10-30, antes de o plano ser escrito. Fonte: `CODEX_HANDOFF.md` do Centro (PR #225, correções #227 e #229), commit lido `9fa047b`.

O design aprovado continua em `docs/superpowers/specs/2026-10-30-importar-whatsapp-centro-custos-design.md`.

## O que já existe no Centro

- Tela `public/d/telas/importar-whatsapp.js`, rota `routes/whatsappImport.js` (permissão `p2`), serviço `services/whatsappImport.js`, migração `120_whatsapp_imports.sql`, módulos em `lib/whatsappImport/` (`money`, `names`, `check`, `source`, `identity`) e 10 arquivos `test/whatsapp-import-*.test.js`.
- Compras entram `pendente`; IA escolhe a categoria (reserva "Outros"); centro novo só com `p5` e sem escopo de obras (senão vira pendência "peça a admin ou gestor"); data = dia da importação; competência fechada vira pendência; idempotência por hash da mensagem + linha; histórico e desfazer.
- A IA só estrutura; o servidor revalida cada item contra o texto original (valor, descrição, centro e fornecedor precisam casar com um trecho único) e confere a soma dos blocos com total.

## Conferência feita nesta sessão

- Os 14 testes unitários sem dependências (`check`, `money`, `names`, `source`, `multiline`, `identity`, `unparsed`) passam. Não rodei `npm run verify` nem a integração com banco (clone sem `node_modules`).
- Mensagem fictícia no formato do grupo (formato A com centro quebrado em duas linhas, formato B com total, espaço antes de vírgula, cabeçalho numerado): linhas únicas passam; soma do bloco B divergente derruba o bloco inteiro com o motivo certo.

## Diferença encontrada

- Duas linhas idênticas na mesma mensagem (mesmo valor, descrição e centro) viram pendência ("não corresponde a um trecho inequívoco"). É conservador de propósito, mas uma compra repetida de verdade exigiria lançar à mão. Possível ajuste pequeno: aceitar quando o número de linhas idênticas na mensagem for igual ao número de itens idênticos extraídos. Decisão do usuário.

## Não testado

- Fluxo real com o Gemini e a tela no navegador (o próprio handoff do Centro diz que não houve lançamento com conta corporativa em produção).
- Mensagens reais do grupo: usar só fixtures anonimizados nos repos públicos.

## Próximos passos possíveis

1. Decidir sobre linhas idênticas (acima).
2. Primeiro uso real e coleta dos formatos que caírem em pendência.
3. Versão para celular (`public/m/`), fora do escopo atual.
