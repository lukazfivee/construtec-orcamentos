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
