# Construtec Orçamentos — Handoff para Codex

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`

## Modo de trabalho preferido

Usar como padrão:

```text
@ponytail
$caveman full
```

Princípios:
- menor diff possível;
- corrigir causa raiz;
- reutilizar estruturas existentes;
- evitar overengineering;
- validar TypeScript + ESLint antes de merge;
- manter compatibilidade com Electron/Windows;
- quando gerar release, entregar `.exe` direto.

## Estado atual

A `main` contém toda a sequência recente de correções e funcionalidades.

### 1. Importação por imagem/PDF
- OCR/importação em lote já existe;
- parser foi melhorado para preservar texto bruto quando não consegue transformar tudo em itens;
- importador deve continuar genérico para diferentes fornecedores/layouts;
- não hardcodar formatos de um único fornecedor.

### 2. Exsat
Fluxo atual:
- login com sessão Electron persistente;
- `credentials: 'include'` nas requisições autenticadas;
- detecção de login corrigida;
- crawler parte de rotas reais do catálogo;
- parser reconhece código + descrição em formatos diferentes;
- fallback por `BrowserWindow` oculto para ler DOM já renderizado quando o catálogo depende de JavaScript.

Commits importantes:
- `e37f68c` — reconhecer login Exsat;
- `7d3d713` — reconhecer produtos do catálogo;
- `369e50c` — iniciar varredura nas rotas reais;
- `ef3eaa7` — ler catálogo com DOM renderizado.

### 3. Build Windows
Workflow principal:
`.github/workflows/build-windows-installer.yml`

Fluxo:
```text
npm ci
npm run verify
npm run make:windows
```

A publicação do EXE foi ajustada para usar Release `windows-latest` em vez de depender de GitHub Artifacts quando a quota estiver esgotada.

### 4. Propostas
Já existe:
- criação de proposta do zero;
- cliente + obra;
- numeração automática `PA-XXXX`;
- revisão 00;
- revisões posteriores preservadas;
- catálogo integrado;
- adicionar/remover item;
- alterar quantidade;
- BDI/multiplicador interno;
- histórico de revisões;
- geração de PDF + Word;
- resumo comercial.

### 5. Módulo de Mão de Obra
Implementado e mergeado na `main`.

Commit principal:
`a0b5dff879af3767808955d8449d18c79bfe2e8d`

Cada função/profissional possui:
- descrição da função;
- quantidade de profissionais;
- salário mensal;
- alimentação mensal;
- transporte mensal;
- outros custos mensais;
- horas mensais padrão;
- horas previstas.

Cálculos:
```text
custoMensal = salarioMensal + alimentacaoMensal + transporteMensal + outrosCustosMensais
valorHora = custoMensal / horasMensaisPadrao
custoMaoDeObraItem = quantidadeProfissionais * valorHora * horasPrevistas
maoDeObraTotal = soma dos custos de todas as funções
```

O default de horas mensais é 176, mas é configurável por proposta e não está hardcoded na fórmula.

Arquivos principais do módulo:
- `src/shared/labor.ts`
- `src/server/migrations/005-proposal-labor.ts`
- `src/server/services/proposalLabor.ts`
- `src/server/routes/proposals.ts`
- `src/renderer/ProposalLaborPanel.tsx`
- `src/renderer/App.tsx`
- `src/renderer/api.ts`
- `src/shared/contracts.ts`

O resumo da proposta agora considera:
- Total de Materiais;
- Total de Mão de Obra;
- Custo Base;
- BDI/acréscimos;
- Valor Final da Proposta.

Ao criar nova revisão, a composição de mão de obra deve ser preservada como snapshot.

## Próximas etapas sugeridas

1. Validar visualmente o módulo de mão de obra no app instalado.
2. Ajustar UX da aba de mão de obra se necessário.
3. Permitir edição manual de descrição/preço de itens da proposta.
4. Separar claramente materiais, mão de obra e serviços no documento final.
5. Evoluir condições comerciais:
   - prazo;
   - garantia;
   - forma de pagamento;
   - inclusões/exclusões;
   - observações.
6. Melhorar template PDF/Word com identidade visual Construtec.
7. Gerar próxima versão Windows somente após validação funcional.

## Regra importante de negócio

BDI/margem são internos. O cliente deve receber apenas os valores comerciais finais, sem exposição de BDI no documento final.
