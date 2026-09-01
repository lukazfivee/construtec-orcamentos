# Construtec Orçamentos — Handoff operacional

Repositório: `lukazfivee/construtec-orcamentos`
Branch principal: `main`
Última atualização deste rastro: `2026-09-01 13:10 BRT`

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

- primeiro administrador configurável em instalações novas e existentes;
- senhas com bcrypt;
- sessão JWT efêmera por usuário;
- perfis `admin`, `commercial` e `viewer`;
- gestão de usuários em Configurações;
- usuário `viewer` somente leitura;
- alterações de Configurações e gestão de usuários restritas a `admin`;
- criação/revisão/clone de propostas usam o usuário autenticado;
- `audit_events.user_id` preenchido nas principais mutações de propostas, itens, BDI, contexto, mão de obra, catálogo, clientes, obras e importação em lote.

Backup e restauração:

- backup local disponível somente para administrador;
- usa `PGlite.dumpDataDir('gzip')` e gera `.tar.gz` consistente;
- restauração valida o arquivo em PGlite temporário antes de tocar no banco atual;
- confirmação mostra versão de esquema, propostas e usuários encontrados;
- backup de emergência do banco atual é criado automaticamente antes da troca;
- API/PGlite são fechados antes da substituição do data directory;
- banco anterior é movido para diretório de rollback;
- em falha, o banco parcial é removido e o banco anterior é restaurado;
- app reinicia após sucesso ou rollback;
- IPC de restauração também valida que a sessão atual pertence a administrador ativo.

Exsat:

- login abre o site real em `BrowserWindow` isolado com partição `persist:construtec-exsat`;
- senha não é armazenada pelo aplicativo;
- importação manual, em lote e varredura automática/incremental já existem;
- histórico básico de sincronização é persistido em `exsat-sync-state.json`;
- correção mais recente removeu a dependência do nome do cookie para detectar login;
- status agora usa redirecionamento real do endpoint de login e marcadores de conta autenticada (`logout`, `sair`, `minha conta`, `meus pedidos`), com página renderizada como fallback;
- ao fechar a janela de login, o estado é sempre reconfirmado, evitando falso positivo por simples navegação.

## Últimos avanços

```text
40aa4b0 docs: document local backup and restore
88431f2 merge PR #62 — feat: create consistent local database backups
9284df7 merge PR #63 — feat: restore local database safely
af45bc6 merge PR #64 — fix: make Exsat login detection reliable
```

PRs relevantes:

- `#62` backup local consistente;
- `#63` restauração local segura;
- `#64` detecção confiável de sessão Exsat.

## Validação recente

PR #63 — restauração:

- `npm run verify`: sucesso no CI;
- auditoria de produção: sucesso;
- auditoria de segurança: sucesso;
- instalador Windows x64: sucesso;
- workflow: `33528286833`.

PR #64 — Exsat:

- `npm run verify`: sucesso no CI;
- auditoria de produção: sucesso;
- auditoria de segurança: sucesso;
- instalador Windows x64: sucesso;
- workflow: `33529339851`.

Não houve nova release versionada nesses merges porque os commits não usaram `[release]`.

## Próxima rota de desenvolvimento

1. Testar em instalação Windows o fluxo real da Exsat: abrir login, autenticar, fechar janela e confirmar `Conta conectada` sem refazer login.
2. Fortalecer feedback de sincronização Exsat na interface: estado conectado/desconectado, última sincronização, modo full/incremental e falhas por página.
3. Revisar a sincronização incremental para evitar varreduras desnecessárias e manter catálogo atualizado sem alterar snapshots de propostas existentes.
4. Só iniciar integração com Centro de Custos Construtec V3 quando houver contrato/API real disponível; não inventar endpoint, credencial ou esquema externo.
5. Quando houver um bloco funcional aprovado para distribuição, gerar commit com `[release]`, confirmar release versionada e disponibilizar o EXE direto.

## Bloqueios atuais

- Integração com Centro de Custos V3 depende de contrato/API real ainda não presente neste repositório.
- Validação final do login Exsat exige interação real com a conta autorizada no Windows.
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
