---
name: sequential-thinking
description: Guia e protocolo de uso do servidor MCP sequential-thinking para raciocínio reflexivo, estruturação de problemas complexos, depuração profunda e bifurcação de hipóteses no Construtec.
---

# Sequential Thinking

O **Sequential Thinking** é uma ferramenta MCP (`sequentialthinking`) desenvolvida pela Model Context Protocol para decompor problemas complexos em passos dinâmicos, reflexivos e adaptáveis.

---

## 1. Quando Utilizar

Ative este fluxo de raciocínio quando:
- **Refatorações Arquiteturais**: Mudanças no core financeiro (`calculations.ts`), banco de dados SQLite ou IPC Electron.
- **Depuração de Erros Críticos**: Falhas intermitentes de sincronização, concorrência ou cálculo divergente de BDI/margens.
- **Tomada de Decisão com Múltiplos Caminhos**: Escolha de estratégias de build (PWA vs Electron vs Mobile nativo).
- **Tarefas com Requisitos Ambíguos**: Necessidade de validar suposições antes de alterar arquivos de produção.

---

## 2. Esquema da Ferramenta (`sequentialthinking`)

| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `thought` | `string` | Sim | Conteúdo do pensamento atual, análise ou hipótese. |
| `thoughtNumber` | `integer` | Sim | Número ordinal do pensamento atual (inicia em 1). |
| `totalThoughts` | `integer` | Sim | Estimativa dinâmica do total de passos necessários (pode mudar). |
| `nextThoughtNeeded`| `boolean` | Sim | `true` se mais reflexão é necessária; `false` se concluiu. |
| `isRevision` | `boolean` | Não | Indica se este passo revisa uma suposição anterior. |
| `revisesThought` | `integer` | Não | Número do pensamento que está sendo revisado. |
| `branchFromThought`| `integer` | Não | Ponto de ramificação para explorar hipótese alternativa. |
| `branchId` | `string` | Não | Identificador da ramificação alternativa. |
| `needsMoreThoughts`| `boolean` | Não | Solicita formalmente expansão no número total de passos. |

---

## 3. Passo a Passo de Utilização

### Passo 1: Iniciar com o Problema e Hipótese
Envie o primeiro pensamento (`thoughtNumber: 1`) definindo o objetivo, o escopo e a estimativa inicial (`totalThoughts: 3` ou `5`):
```json
{
  "thought": "Analisando divergência de arredondamento em BDI composto no calculations.ts",
  "thoughtNumber": 1,
  "totalThoughts": 3,
  "nextThoughtNeeded": true
}
```

### Passo 2: Investigar e Testar Hipótese
No passo 2, aprofunde os detalhes técnicos, faça medições ou verifique contratos de interface:
```json
{
  "thought": "Identificado que Math.round em centavos antes do somatório acumulado gera perda de 1 centavo em lotes grandes.",
  "thoughtNumber": 2,
  "totalThoughts": 3,
  "nextThoughtNeeded": true
}
```

### Passo 3: Ajustar Hipótese ou Ramificar (se necessário)
Se uma suposição inicial falhar, não ignore: use `isRevision: true` e `revisesThought`:
```json
{
  "thought": "Revisão: O erro não vem do BDI composto, e sim do rateio proporcional dos itens sem custo base.",
  "thoughtNumber": 3,
  "totalThoughts": 4,
  "isRevision": true,
  "revisesThought": 2,
  "nextThoughtNeeded": true
}
```

### Passo 4: Sintetizar a Solução e Concluir
Quando o caminho estiver claro e validado, encerre com `nextThoughtNeeded: false`:
```json
{
  "thought": "Solução consolidada: aplicar arredondamento banker's rounding ao final da matriz e validar com run-calc-test.mjs.",
  "thoughtNumber": 4,
  "totalThoughts": 4,
  "nextThoughtNeeded": false
}
```

---

## 4. Integração no Workspace

O servidor MCP está registrado em `.agents/mcp_config.json` e `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "cmd.exe",
      "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

Para IAs que não possuem o servidor MCP conectado via IDE, execute via script stdio Node.js:
```bash
npx -y @modelcontextprotocol/server-sequential-thinking
```

---

## 5. Boas Práticas
1. **Total dinâmico**: Ajuste `totalThoughts` conforme descobre complexidade extra.
2. **Sem preconceito de resposta**: Questione suposições na primeira divergência observada.
3. **Mantenha concisão**: O `thought` deve ser denso em valor analítico, não apenas texto repetitivo.
4. **Respeito às regras do projeto**: Aplicar `ponytail` (menor solução correta) e `MAX_LINES <= 350`.
