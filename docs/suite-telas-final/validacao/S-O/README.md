# S-O: passada de segurança do Orçamentos

Ticket lukazfivee/construtec-orcamentos#192. Branch `feat/telas-so`, a partir de `feat/suite-telas-final` (com O1 a O7). Feita em 14/10/2026.

**Onde rodou:** só em 127.0.0.1, portas 3211 a 3216, banco PGlite temporário e "Centro" falso do kit, com usuários de teste: admin, comercial (com p10) e técnico (sem p10). Nada contra produção, Neon, Cloudflare, AppData ou conta e chave reais. As sondas ficaram em `.vite/so/` (ignorada pelo git) e não entram no repositório.

**Escopo:** o diff da integração contra a `main`. Não há rota nova nem movida. As mudanças de produto são CSS, quatro textos (`HomeWorkspace.tsx`, `ProposalsListWorkspace.tsx`, `ProposalsListFilterBar.tsx`), `public/m/m.css` e uma classe em `public/m/screen-avisos.js`. O resto é o kit de conferência, que só sobe em 127.0.0.1. Como as telas finalizadas usam as rotas existentes, as cinco verificações valeram para as telas e as rotas que elas chamam.

Roteiro (skills `cybersecurity-skills`): testing-for-xss-vulnerabilities, testing-for-broken-access-control, performing-security-headers-audit, testing-cors-misconfiguration e testing-for-sensitive-data-exposure.

## Achados

| # | Severidade | Tela ou rota | Achado | Situação |
|---|---|---|---|---|
| 1 | **Alto** | `GET /api/dashboard` (Início do Desktop; Início, Painel e assistente do Celular) | Conta sem p10 (técnico) recebia `totalCost` de cada proposta recente: o custo total da proposta. | **Corrigido** |
| 2 | Médio | Todas as rotas `/api/*` | Respostas JSON com dados de proposta e cliente saem sem `Cache-Control: no-store` e sem `X-Content-Type-Options: nosniff`. | Não corrigido (já existia; fora do diff) |
| 3 | Médio | `/`, `/d/`, `/m/` (arquivos estáticos) | Só `/c` (página pública do cliente) tem `Content-Security-Policy: frame-ancestors 'self'`; o app pode ser embutido em outro site (clickjacking). | Não corrigido (já existia; fora do diff) |
| 4 | Baixo | API em modo local (desktop/Electron) | Sem nuvem, o CORS aceita `Origin: null` e IPs de rede privada (192.168.x, 10.x). Na nuvem vale a lista exata, já coberta por `cloud-runtime.test.ts`. | Não corrigido (comportamento do desktop) |

### 1. Custo no painel para quem não tem p10 (alto, corrigido)

- **Reproduzir:** servidor local com o técnico Paula (papel `tecnico`, sem p10). Criar uma proposta com item de custo 777,77 como admin e, com a sessão do técnico, fazer `GET /api/dashboard`.
- **Evidência antes:** `"itemCount":2,"totalCost":9315.35,"totalSale"…` na resposta do técnico. As outras rotas (`/proposals`, `/proposals/:id`, `/labor`, `/catalog`, `/kits`, `/price-drift`, `/document`) já mascaravam o custo.
- **Causa:** o `suiteGuard` mascarava `/api/proposals`, `/api/catalog`, `/api/kits` e `/api/settings`, mas não `/api/dashboard`, que monta a lista de propostas recentes com `totalCost`.
- **Correção:** `src/server/suiteGuard.ts` passa a mascarar também o GET de `/api/dashboard` (mesma `maskJson` com a lista `COST_KEYS`). O comercial, que tem p10, continua vendo.
- **Regressão:** teste novo em `src/server/suiteGuard.test.ts` ("painel (/api/dashboard) esconde custo de quem nao tem p10"). Falhou antes da correção (1 falha) e passa depois. Depois da correção, a sonda mostrou `/dashboard` sem custo para o técnico.

## O que passou

- **XSS:** carga `'"><img src=x onerror=…>` gravada em razão social, nome fantasia, contato, cargo, obra, endereço, produto, fabricante, modelo, categoria, kit, item, categoria do item, escopo e função da mão de obra. Abri 13 telas do Celular (Início, Propostas, Resumo, Itens, Revisões, Mão de obra, Corpo, PDF, Kits, Clientes, Catálogo, Nova, Painel) e 9 do Desktop (Início, Propostas, editor com Itens, Mão de obra, Corpo e Histórico, Catálogo, Kits, Clientes). A carga apareceu como texto em todas as 22 (controle positivo) e não executou em nenhuma. O documento HTML da proposta (`/document`) sai com a carga escapada.
- **Acesso por papel:** sem sessão, tudo dá 401. Técnico e comercial levam 403 em `/users`, `/users/authorized-emails/list`, `/system/backup`, `/proposals/discarded`, descartar proposta, cadastrar conta EXSAT e `PATCH /settings`. Aprovar proposta dá 403 para o técnico. O técnico também leva 403 ao gravar custo: BDI, importação com `unitCost` e catálogo.
- **Exposição de dados (p10):** sem p10, custo, BDI e margem saem zerados em propostas, detalhe, mão de obra, histórico, catálogo, visão geral do catálogo, kits, mudanças de preço e documento. O Celular usa a mesma API e por isso herda a máscara.
- **CORS (modo local):** `https://evil.example` e `http://localhost.evil.example` levam 403. Nenhuma resposta manda `Access-Control-Allow-Credentials`. `X-Powered-By` está desligado.

## Não coberto

- Cabeçalhos e CORS da nuvem (Worker da Cloudflare): só por leitura de código e pelos testes existentes, nada medido em produção.
- O PDF gerado pelo Electron (o `/document` HTML foi conferido).

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes), testes 337/338 passando (um a mais que antes: o de regressão), 1 pulado, 0 falhas.
- Processos de teste encerrados; nada ouvindo em 3211 a 3216.
