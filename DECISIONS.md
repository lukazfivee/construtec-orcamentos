# Decisões

## Revisão de segurança do link do cliente (outubro/2026)

Decidido e implementado: M8 (p11 para excluir proposta, mudar status, reabrir e criar revisão; o pedido de ajuste do
cliente cria a revisão por dentro do serviço e não passa pelo guarda de rota).

Resolvidos na rodada de pendências baixas: B5, B12, S5 e também B8 (exportar não marca mais a outbox como entregue; só o aceite do Centro marca; snapshot sem linha de outbox ganha a linha; linhas com 72 tentativas viram `failed`), B9 (reserva atômica com FOR UPDATE SKIP LOCKED e coluna `claimed_at`, migração 019), B10 (o selo guarda `approvedAt` = aceite do cliente, `recordedBy` = quem confirmou e, dentro de `approval`, os campos opcionais `clientAcceptance` e `confirmedBy`), B13 (escrita de custo em itens e import-batch exige p10; no import-batch `unitCost: 0` é tolerado porque o app o envia por padrão), S1/S2 (só 401 de sessão desloga; chave de serviço recusada, rota inexistente e limite do Centro viram 503 em português) e S3 (link do cliente só na versão online: 409 no servidor sem banco e botão escondido no desktop).

S4 (p12) não se aplica ao Orçamentos: p12 trata de medições e este app não tem medições. Não será implementado aqui.

## Corpo da proposta montado pelo usuario (outubro/2026)

Coluna `proposals.body_blocks` (jsonb, migracao 020). NULL = documento no layout fixo de sempre, entao propostas antigas nao mudam.
Com corpo, a lista ordenada de blocos (`titulo`, `paragrafo`, `lista`, `itens`, `condicoes`) define a ordem do PDF, do Word, da pagina do
cliente e da pre-visualizacao; a tabela de itens existe uma vez e nao sai, as condicoes so se desligam. A fonte unica de limites,
limpeza de texto, variaveis (`{{cliente}}`, `{{obra}}`, `{{numero}}`, `{{revisao}}`, `{{valor_total}}`, `{{validade}}`, `{{responsavel}}`, nunca
custo, BDI ou margem) e ordem e `src/shared/proposalBody.ts`. O hash do aceite do cliente inclui o texto dos blocos ligados quando ha corpo
(sem corpo o hash e o mesmo de antes). O campo "Escopo comercial" deixou de existir na tela: vira o bloco "Escopo" do corpo, e
`proposals.scope` segue guardado (lista, Centro, clonagem). Modelos de texto e corpo padrao ficam em `app_settings`
(`body_templates`, `default_body_blocks`).

## Proposta completa montada pelo usuario: carta, modelos e formato de carta (outubro/2026)

Dois blocos novos no corpo (`carta` e `fechamento`, no maximo um de cada), sem migracao nova: tudo cabe em `body_blocks`.
A `carta` guarda local, data, destinatario, A/C, setor, REF., saudacao e frase de abertura (campos em `fields`, com variaveis), o
titulo do documento (no `title`) e a opcao `numbered`, que numera os titulos (1., 2. ... e 1.1. nos blocos marcados `sub`). O `fechamento` guarda o
paragrafo final (`text`) e a assinatura (`fields.signer` e `role`). Na tabela de itens, `text` e o titulo da planilha. A variavel `{{escopo}}`
traz o escopo digitado na criacao. Corpos antigos nao mudam: os campos novos so entram no hash do aceite quando existem.

Com a carta, o documento muda para formato de carta: sem quadro de identificacao e sem o titulo fixo, texto de 10 pt justificado, e
cabecalho com logo e rodape com pagina em todas as paginas pelas caixas de margem do `@page` (Chromium 131 ou mais novo: Electron 43 e
Chrome/Edge atuais). Em navegador sem esse recurso o cabecalho so aparece na tela. A assinatura e o fecho fixos so somem quando o corpo tem
`fechamento`. Modelos completos ("Proposta de servico" e "Proposta de fornecimento") ficam em `src/shared/proposalBodyModels.ts`; escolher um na
criacao da proposta (`bodyModel`) vale no lugar do corpo padrao da empresa. Texto entre [colchetes] e pendencia do usuario.

## Login da Exsat no servidor (outubro/2026)

Decidido pelo Lucas: (1) importar só preço lido com login; (2) a senha da conta Exsat pode passar pelo servidor, desde que criptografada; (3) varrer o catálogo inteiro, sem teto de 500, descartando e contando itens sem preço; (4) a coluna Fonte continua fora.

Implementado assim: AES-256-GCM em repouso com chave só em variável de ambiente (`EXSAT_CREDENTIAL_KEY`; sem ela o servidor recusa gravar e ler); a conta só é gravada depois que a Exsat aceita o login (uma tentativa por clique, pausa depois de falha); cookie da Exsat só em memória; varredura em segundo plano por departamento, uma página por vez com pausa, estado no banco e retomável; `exsat_credentials` fora do dump de backup. Cadastrar, trocar e remover a conta exige p10 e perfil admin. A resposta de erro de leitura do corpo (`entity.*`) passou a ser genérica para o corpo cru, que pode conter a senha, não ir para o log nem para a tela.

Alternativa descartada: ler preço público de URL sem login (podia importar preço de tabela como custo). Se a Exsat passar a exigir captcha no login, a decisão é não contornar: o aplicativo do computador sincroniza e o site mostra o catálogo.

## 2026-10-10 — Suíte: entrada pela sessão do Centro (#sessao=)

- O login do Orçamentos dentro da Suíte mostrava "Integração de contas com o Centro de Custos não configurada" porque o código de uso único (#handoff=) só é trocado com a chave de serviço do servidor, que o app instalado não tem. Agora a Suíte entrega a sessão corporativa da conta em `#sessao=<token>` e o `AuthGate` a valida pelo servidor local (`/api/auth/me`, que consulta o Centro só com o Bearer).
- `#sessao=` só vale com `runtime.suite === true`: num navegador, um link com esse trecho não troca a conta de quem abre. O token sai do endereço logo que lido. `#handoff=` segue para quem tem a chave de serviço (servidor na nuvem). Detalhe do lado do Centro em `DECISIONS.md` do Centro de Custos, 2026-10-10.

## 2026-10-12 — Suíte no navegador: logado no Centro, o Orçamentos entra sozinho

- Pedido: "se eu estou logado no Centro de Custos, não preciso fazer login no Orçamentos". No navegador os dois sites ficam em domínios diferentes e não enxergam a sessão um do outro; o menu Suíte do Centro só abria o endereço daqui, que pedia o login.
- Regra única, no `AuthGate` (desktop e web) e no `public/m/app.js` (celular): sem sessão, a aba vai uma vez para `entrar-orcamentos.html` do Centro, que volta com `#handoff=` (conta logada lá, troca pelo servidor como no app Android) ou `#centro=0` (mostra o login daqui). Uma vez por aba (`sessionStorage`, `construtec.auth.centro`); sem como guardar a marca não pergunta, para nunca ficar indo e voltando. "Sair" marca a aba: recarregar depois de sair não entra de novo pelo Centro.
- Só no site publicado (`ORCAMENTOS_WEB`): app do Windows (`file://`, entra por `#sessao=`), app Android (`SuiteConstrutec/`, entra pelo app), servidor de desenvolvimento e o Orçamentos embutido no Centro ficam fora. No celular, o site instalado na tela inicial também fica fora: ele guarda os dados à parte e abriria o Centro por cima.
- No celular, entrar por `#handoff=` passou a manter o `#proposta=` (antes o endereço era limpo inteiro e a proposta pedida pelo app ou pelo Centro não abria).
- Lado do Centro: `public/entrar-orcamentos.js` e `DECISIONS.md` do Centro de Custos, 2026-10-12.

## 2026-10-20 — Criar proposta conversando com o assistente de IA

- Pedido do Lucas: dizer as informações e a IA ir montando a proposta. Já existia o assistente com Gemini (Firebase AI Logic, #174), que só consultava e abria telas; a criação entrou como novas ferramentas dele (`rascunho_atualizar`, `rascunho_itens`, `rascunho_ver`, `rascunho_descartar`, `finalizar_rascunho`), no computador (`src/renderer/assistant/`) e no celular (`public/m/ia-draft.js`, `ia-tools.js`, `ia-chat.js`). Sem servidor, Worker nem chave novos.
- O rascunho vive só na memória da conversa. A IA nunca grava: `finalizar_rascunho` apenas mostra um cartão de conferência, e só o botão **Criar proposta** (`commitDraft` / `IA.draft.commit`) chama as rotas de sempre (cliente, obra, `POST /api/proposals`, `import-batch`), com a sessão de quem está logado. Auditoria, perfil e `suiteGuard` valem como no formulário.
- A IA não tem ferramenta de preço, BDI, imposto, envio, aprovação nem exclusão. Item com código do catálogo entra pelo código (o servidor traz descrição, unidade e custo); sem código vira linha avulsa **sem preço** (custo e venda 0), que a pessoa completa no editor. BDI e imposto vêm dos padrões da empresa. Custo do catálogo só chega ao modelo com p10 (regra do assistente).
- Cliente novo e obra nova só são cadastrados junto da proposta, depois da confirmação da pessoa no chat e no cartão. Falha no meio não duplica cadastro (o rascunho guarda os ids já criados). Prazo, pagamento e garantia entram no JSON de `scope` (mesmo formato do painel de condições); não existe campo de desconto e a IA não inventa um.
- Perfil de consulta não monta rascunho. O desktop e o celular têm implementações paralelas; `mobile-assistant-draft.test.ts` compara as duas nas mesmas entradas para não divergirem.
- Fora desta versão: editar proposta existente, mão de obra, anexos, preço sugerido pela IA. Os dados digitados na conversa seguem para o Gemini (plano gratuito do Firebase AI Logic, como as consultas que o assistente já fazia): não escrever dado sensível de cliente além do nome e da obra.

## 2026-10-20 (tarde) — Assistente: valor, BDI e imposto ditos pela pessoa

- Primeiro uso real: o Lucas deu o valor de um serviço (2 eletroímãs), pediu BDI e imposto, e o item entrou sem valor, porque a primeira versão proibia a IA de anotar qualquer valor. Mudança, só para quem tem a permissão de custo (p10), igual ao editor e ao `suiteGuard`:
- O valor dito entra como **custo unitário** do item avulso (`custo_unitario`); o preço de venda sai do BDI e do imposto da proposta. Item do catálogo continua usando o custo do catálogo (custo informado é ignorado com aviso). Sem valor, o item segue entrando sem preço.
- `bdi` (multiplicador: 25% vira 1,25) e `imposto_pct` entram em `rascunho_atualizar` só quando a pessoa pedir; sem pedido valem os padrões da empresa. O commit aplica BDI e imposto (`PATCH /bdi`, `/tax`) **antes** de importar os itens, porque o preço de venda de cada item nasce com o BDI da proposta; se isso falhar, a proposta existe, os itens não entram e o cartão avisa.
- Sem p10 a IA recusa custo, BDI e imposto (nada entra no rascunho) e o prompt manda dizer que se informam no editor. A IA continua sem ferramenta de envio, aprovação ou exclusão, e a criação continua só pelo botão do cartão.

## 2026-10-20 (noite) — Assistente: mão de obra e edição de proposta existente

- Pedido do Lucas: tirar as duas limitações da primeira versão. Mesmo princípio: a IA anota num plano em memória e **só o botão do cartão grava**, com a sessão de quem está logado.
- **Mão de obra** (`rascunho_mao_de_obra` na criação e `editar_mao_de_obra` na edição), só com p10 (é custo, igual ao `suiteGuard`): descrição, profissionais, salário mensal e horas por profissional são obrigatórios (a IA pergunta o que faltar); alimentação, transporte e outros custos são opcionais (0). O custo por hora e o total saem das horas-padrão da proposta no servidor; alteração usa as horas-padrão da própria mão de obra. Na criação a mão de obra é gravada por último; se falhar, a proposta e os itens já existem e o cartão avisa.
- **Editar proposta existente** (`editar_abrir`, `editar_campos`, `editar_itens`, `editar_mao_de_obra`, `editar_ver`, `editar_descartar`, `finalizar_edicao`): só a revisão atual em edição ou em revisão (mesma regra do servidor); enviada, aprovada, recusada ou revisão antiga pede reabrir ou criar revisão no editor. A IA acha o id com `listar_propostas`, e os números de itens e de mão de obra seguem a lista mostrada ao abrir e **não renumeram** quando algo é removido. Muda escopo, prazo, pagamento, garantia, validade (dias a partir de hoje), BDI e imposto (p10), itens (quantidade, unidade, descrição, custo com p10, inclusão e remoção) e mão de obra. Não muda status, cliente, obra, corpo nem kits, e não envia nem aprova.
- Aplicar grava na ordem do editor (detalhes, BDI, imposto, itens, mão de obra; BDI antes dos itens novos) e **para no primeiro erro**: o cartão guarda só o que falta e a nova tentativa não repete o que já foi feito. Terminado, abre a proposta atualizada. Sem p10 a IA recusa custo, BDI, imposto e mão de obra e continua alterando quantidades e textos.
- O campo `scope` (JSON de condições) é lido e remontado preservando as observações internas; o limite de 1200 caracteres vale sobre o JSON já escapado (`packScope`). Computador e celular têm implementações paralelas (`proposalEdit.ts`/`ia-edit.js`); `mobile-assistant-edit.test.ts` compara as duas.
