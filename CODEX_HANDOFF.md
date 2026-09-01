# Construtec Orçamentos — Handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`
Última atualização deste rastro: `2026-09-01 BRT`

Este arquivo existe para outra IA, editor ou operador continuar exatamente do estado atual do projeto.

## Como continuar

Leia nesta ordem antes de alterar o código:

1. `AGENTS.md`
2. `.cursorrules`
3. `.cursor/rules/ai-architecture.mdc`
4. `PRODUCT.md`
5. `README.md`
6. `CODEX_HANDOFF.md`
7. `OPENCODE.md`, quando existir

Modo preferido pelo usuário:

```text
@ponytail
$caveman full
```

Regras práticas:

- menor diff correto;
- causa raiz primeiro;
- sem abstração futura sem necessidade;
- comunicação curta em português;
- nunca expor custos internos, salários, BDI ou margem em documentos do cliente;
- usar Context7 quando mexer em Electron/PGlite/frameworks ou APIs cujo comportamento possa ter mudado;
- validar mudanças substanciais com `npm run verify`, auditoria de produção e instalador Windows no CI.

## Estado atual do produto

Fundação:

- Electron Forge + Vite + React + TypeScript;
- API local Express em `127.0.0.1` com bearer token interno por execução;
- PGlite/PostgreSQL local-first;
- catálogo, clientes, obras, propostas, revisões, kits, mão de obra, Home/Dashboard, Configurações, importação em lote, PDF e Word;
- funcionamento offline como padrão.

Propostas:

- criação do zero com numeração `PA-####` e revisão 00;
- revisões posteriores imutáveis;
- snapshots de cliente, obra, catálogo e valores comerciais;
- CRUD/duplicação/reordenação de itens;
- BDI interno e mão de obra;
- clonagem, exclusão, status, KPIs e histórico;
- PDF/Word mostram somente dados comerciais finais, sem custo base, salários, BDI detalhado ou margem interna.

Autenticação e auditoria:

- primeiro administrador configurável;
- senhas com bcrypt;
- sessão JWT efêmera por usuário;
- perfis `admin`, `commercial` e `viewer`;
- gestão de usuários em Configurações;
- viewer somente leitura;
- alterações sensíveis restritas a admin;
- `audit_events.user_id` preenchido nas principais mutações de propostas, itens, BDI, contexto, mão de obra, catálogo, clientes, obras e importação em lote.

Backup e restauração:

- backup local somente para administrador;
- usa `PGlite.dumpDataDir('gzip')` e gera `.tar.gz` consistente;
- restauração valida o arquivo em PGlite temporário antes de tocar no banco atual;
- cria backup de emergência e diretório de rollback;
- fecha API/PGlite antes da substituição;
- em falha restaura o banco anterior;
- reinicia o app após sucesso ou rollback;
- IPC de restauração confirma administrador ativo.

## Exsat — estado atual

- login abre o site real em `BrowserWindow` isolado com `persist:construtec-exsat`;
- senha não é armazenada pelo app;
- importação manual, em lote e varredura automática/incremental existem;
- histórico de sincronização persiste em `exsat-sync-state.json`;
- detecção de login não depende mais do nome do cookie;
- ao fechar a janela de login, a sessão é reconfirmada de verdade;
- `lastSyncAt` e `lastFullSyncAt` só avançam depois da importação realmente confirmada;
- desconectar limpa eventual `pendingSync`;
- sessão expirada durante a leitura interrompe com `EXSAT_LOGIN_REQUIRED`;
- páginas válidas sem produtos não contam como falha e ainda podem contribuir com links;
- páginas com erro real recebem uma segunda tentativa automática antes de entrar em `failedUrls`;
- o diálogo agora destaca melhor conexão, processamento, prévia pronta e confirmação pendente;
- quando `EXSAT_LOGIN_REQUIRED` chega ao renderer, a interface muda imediatamente para desconectada, limpa a prévia/fonte pendente, encerra o estado local da sessão e pede novo login;
- snapshots de propostas existentes continuam intocados por qualquer atualização do catálogo.

## Últimos avanços

```text
50d5c3d merge PR #65 — record Exsat sync only after confirmed import
59a3c80 merge PR #66 — stop Exsat sync when authenticated session expires
d4abf12 merge PR #67 — retry Exsat pages and tolerate empty categories
00c4b97 merge PR #68 — clarify Exsat synchronization states
58015f4 merge PR #69 — reset Exsat UI when session expires
```

Também concluídos anteriormente:

```text
88431f2 merge PR #62 — backup local consistente
9284df7 merge PR #63 — restauração local segura
af45bc6 merge PR #64 — detecção confiável de sessão Exsat
```

## Validação recente

PR #68:
- segurança: sucesso;
- `npm run verify`: sucesso;
- auditoria de produção: sucesso;
- instalador Windows x64: sucesso;
- workflow Windows: `33534816923`.

PR #69:
- segurança: sucesso;
- `npm run verify`: sucesso;
- auditoria de produção: sucesso;
- instalador Windows x64: sucesso;
- workflow Windows: `33541223624`.

Nenhum desses merges usou `[release]`; não tratar como nova release versionada.

## Próxima rota de desenvolvimento

1. Testar em instalação Windows com a conta autorizada: login real, fechar janela, atualização automática, confirmação de importação, sessão expirada e relogin.
2. Se o teste real estiver correto, considerar a frente Exsat estabilizada por enquanto.
3. Voltar para a importação universal de catálogo por imagem/PDF de qualquer fornecedor, reforçando código, descrição, fabricante, modelo, unidade/quantidade, preço e fornecedor sem depender de layout fixo.
4. Fazer pente-fino de duplicidades, itens sem preço, códigos conflitantes e atualização de centenas de itens sem tocar em propostas históricas.
5. Validar ciclo completo Catálogo → Kit → Proposta → Mão de obra → BDI → Revisão → PDF/Word.
6. Só iniciar integração com Centro de Custos Construtec V3 quando houver contrato/API real; não inventar endpoint, credencial ou esquema.
7. Depois de um bloco funcional aprovado, criar commit com `[release]`, confirmar release versionada e disponibilizar `Construtec-Orcamentos-Setup.exe` diretamente.

## Bloqueios atuais

- Validação real da Exsat exige interação com a conta autorizada no Windows.
- Integração com Centro de Custos V3 depende de contrato/API real ainda não presente no repositório.
- Nunca commitar credenciais, cookies, tokens, `.env` ou segredos.

## Convenções de release

Workflow principal:

```text
.github/workflows/build-windows-installer.yml
```

Fluxo esperado:

```text
npm ci
npm run verify
npm run security:audit:prod
npm run make:windows
```

- commit normal na `main`: não tratar como release versionada;
- commit contendo `[release]`: gera release versionada `build-N` pelo fluxo existente;
- em artefatos/release, manter `Construtec-Orcamentos-Setup.exe` disponível diretamente.
