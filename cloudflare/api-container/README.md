# Orçamentos: Cloudflare Container e PostgreSQL

Interface e API no mesmo Worker. O banco PostgreSQL deve pertencer a uma conta
Neon permanente; não usar banco claimable não reivindicado em produção.

## Preparação

Na raiz do Orçamentos: `npm ci` e `npx vite build`.
Nesta pasta: `npm ci`. Docker Desktop deve estar ativo e seu diretório
`resources/bin` disponível no PATH do terminal.

## Configuração privada

Cadastrar com `npx wrangler secret put NOME`, sem versionar valores:

- `DATABASE_URL`: conexão PostgreSQL Neon com TLS.
- `SESSION_SECRET`: valor aleatório com pelo menos 32 caracteres, estável.
- `CONSTRUTEC_SETUP_TOKEN`: valor aleatório com pelo menos 32 caracteres.
- `CONSTRUTEC_ALLOWED_ORIGINS`: origens HTTPS exatas separadas por vírgula,
  incluindo o endereço final do Worker.
- `CONSTRUTEC_PUBLIC_URL` (opcional): endereço público do Orçamentos usado para montar
  o link enviado ao cliente (`/c/#token`). Sem ele vale a primeira origem de
  `CONSTRUTEC_ALLOWED_ORIGINS`. É repassado ao Container pelo `index.js`.
- `CONSTRUTEC_INTEGRATION_KEY`: valor aleatório com pelo menos 32 caracteres,
  **igual** ao do Worker `centro-custos-api`. Sem ele, o envio de propostas
  aprovadas ao Centro de Custos fica desligado na nuvem.
- `CONSTRUTEC_IDENTITY_KEY`: valor aleatório com pelo menos 32 caracteres,
  **igual** ao do Worker `centro-custos-api` (contas pelo diretório central).

- `EXSAT_CREDENTIAL_KEY` (opcional, mas sem ele a aba Exsat do site não guarda conta nenhuma):
  chave de 32 bytes que criptografa (AES-256-GCM) a senha da conta de revendedor da Exsat no banco.
  Criar e cadastrar, sem mostrar nem versionar o valor:

  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put EXSAT_CREDENTIAL_KEY
  ```

  Depois publicar de novo (`npm run deploy:cloud`, pela pasta principal) para o Container receber a variável. Guarde uma cópia
  da chave no cofre de senhas da empresa: se ela for perdida ou trocada, a conta guardada fica ilegível e o administrador
  precisa digitar a conta da Exsat de novo (nada mais é afetado). Sem a chave (ou com chave inválida) o servidor recusa gravar
  e ler a conta e a tela avisa. A tabela `exsat_credentials` não entra no dump diário do backup.

`POST /api/auth/setup` requer o token de setup em Authorization Bearer no modo
remoto. Provisionar o administrador por canal administrativo; não inserir esse
token no frontend. Depois usar login e sessão normais.

## Validação e publicação

`npm run check` constrói a imagem e valida o Worker sem publicar.
`npm run deploy` publica. Validar `/health`, login e operações com sessão,
inclusive após reinício. O banco remoto recebe migrações na inicialização,
sem dados de demonstração. Dados locais existentes não são importados.

Backup PGlite não se aplica ao PostgreSQL remoto. Configurar backup/retenção
no provedor antes de colocar dados financeiros reais em produção.

Fontes: https://developers.cloudflare.com/containers/get-started/
e https://developers.cloudflare.com/containers/examples/env-vars-and-secrets/
