# Segurança do Construtec Orçamentos

Este projeto é um aplicativo desktop local-first. A regra de segurança é simples: o app instalado deve continuar offline e seguro por padrão; qualquer integração externa precisa ser explícita, autenticada e revisada.

## Regra obrigatória do projeto

Antes de liberar instalador ou deploy:

1. `npm run verify` deve passar.
2. `npm run security:audit:prod` deve passar sem vulnerabilidades `high` ou `critical`.
3. Workflows, scripts de build, Electron main/preload, API local e Worker Cloudflare exigem revisão via CODEOWNERS.
4. O Worker OCR deve ter `OCR_SHARED_TOKEN` configurado; endpoint OCR público sem token é proibido.
5. O aplicativo só deve chamar OCR remoto quando `CONSTRUTEC_OCR_URL` e `CONSTRUTEC_OCR_TOKEN` estiverem configurados.
6. A `main` deve ser protegida no GitHub:
   - exigir pull request;
   - exigir pelo menos 1 aprovação;
   - exigir status checks de build/auditoria;
   - bloquear force-push;
   - bloquear exclusão da branch;
   - exigir conversa resolvida antes de merge.

## GitHub Actions

- Use permissões mínimas (`permissions`) por workflow/job.
- Ações devem ser pinadas por SHA quando possível.
- Não use `pull_request_target` para executar código de PR.
- Não imprima secrets em logs.
- Deploys que usam secrets devem usar environment protegido.

## Dependências

- Dependabot fica habilitado para `npm` e `github-actions`.
- Vulnerabilidades em dependências de produção bloqueiam CI.
- Vulnerabilidades em dependências de build/dev são registradas para triagem; se afetarem geração de instalador ou execução de código no CI, priorize como risco de supply chain.

## OCR Cloudflare

O Worker OCR não deve armazenar imagens e deve responder com `cache-control: no-store`. Mesmo assim, imagens podem conter dados comerciais; use o OCR local quando possível.

Configuração esperada:

```text
OCR_SHARED_TOKEN=<segredo no Cloudflare Worker>
CONSTRUTEC_OCR_URL=https://construtec-catalog-ocr.<subdominio>.workers.dev
CONSTRUTEC_OCR_TOKEN=<mesmo valor do OCR_SHARED_TOKEN>
```

## Assinatura do instalador Windows

O EXE publicado deve ser assinado com certificado Authenticode antes de distribuição ampla. Enquanto não houver certificado:

- publique apenas via release oficial do GitHub;
- divulgue o SHA-256 do asset;
- evite instaladores reenviados por canais paralelos.

## Dados locais

O banco local fica no perfil do usuário. Ele pode conter clientes, custos, propostas e histórico. Para ambientes com maior exigência:

- ativar criptografia em repouso;
- proteger backups/exportações;
- documentar política de retenção;
- preferir Windows BitLocker/criptografia de disco como camada mínima.
