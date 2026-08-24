# Construtec Orçamentos

Aplicação desktop local-first para transformar catálogo, custos e mão de obra em propostas comerciais padronizadas da Construtec Engenharia.

## Estado do projeto

A fundação **comp-first** está implementada: Electron Forge, Vite, React e TypeScript no aplicativo desktop, Express na API local e PGlite/PostgreSQL para persistência. A primeira superfície é a mesa operacional de propostas, aprovada antes da implementação e reproduzida em código.

Esta entrega estabelece a arquitetura, o banco inicial e a interface navegável. Autenticação completa, regras de cálculo, geração de documentos e integrações externas entram nas próximas fases code-first.

## Executar localmente

Requisitos: Node.js 22+ e npm 11+.

```powershell
npm install
npm start
```

Validações disponíveis:

```powershell
npm run verify
npm run package
```

O pacote não instalável gerado pelo Electron Forge fica em `out/`. Use `npm run make` quando a configuração do instalador estiver pronta para distribuição.

## Estrutura

- `src/renderer/`: interface React da mesa operacional;
- `src/server/`: API Express local e serviços;
- `src/server/migrations/`: esquema versionado do PGlite;
- `src/main.ts`: ciclo de vida e janela segura do Electron;
- `src/preload.ts`: ponte mínima e tipada entre renderer e processo principal;
- `.impeccable/`: decisões, composições aprovadas e evidências de revisão visual.

## Princípios

- funcionamento offline como padrão;
- zero dependência de IA nas rotinas do produto;
- snapshot de preço e dados comerciais por item da proposta;
- separação rigorosa entre visão interna e documento do cliente;
- revisões imutáveis, histórico e auditoria;
- arquitetura preparada para futura integração ao Centro de Custos Construtec V3.

Consulte [PRODUCT.md](PRODUCT.md) para o contexto durável do produto.
