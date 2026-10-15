# O4: Desktop do Orçamentos (Clientes, Configurações, Descartadas)

Ticket lukazfivee/construtec-orcamentos#186. Branch `feat/telas-o4`, a partir de `feat/suite-telas-final` (já com o O2 e o O3). Conferido em 14/10/2026 com `npm run conferencia`, Chrome headless, dados de teste locais, portas 3181 a 3184.

Telas: Clientes; Configurações › Geral, Empresa e propostas, Usuários e Sistema. "Propostas descartadas" fica dentro de Configurações › Sistema, só para administrador. Tudo nos temas claro e escuro, em 1280x720, 1280x800 e 1440x900 (30 capturas).

## Resultado

- **Kit:** 0 achados antes e depois. Não há corte, sobreposição, rolagem aninhada, divergência de cor nem texto da Referência (sClis, sCfg) faltando.
- **Conferência a olho (prints de 1280x720, dois temas):** só um defeito. Em Configurações › Usuários, a linha do próprio usuário ("Nome · Você") tinha as colunas Nome, E-mail e Perfil em posições diferentes das outras linhas. Ela não tem o botão "Excluir login", e a coluna de ações usava largura automática.

Prints: `antes/` (Usuários) e `depois/<resolução>/<tema>/`. Lista do kit: `divergencias-depois.md`.

## O que mudou

- `src/config-centro.css`: no desktop (≥ 1200 px), a coluna de ações de cada usuário tem largura mínima fixa (320) e os botões ficam alinhados à direita. Nome, E-mail e Perfil agora ficam alinhados em todas as linhas.

## Removido da interface

Nada.

## Observações (não corrigidas, fora do escopo visual)

- Em Sistema, "Versão do App" mostra `v1.0.6`, mas o `package.json` está em 1.0.12. O número vem do ambiente (o servidor web do kit), não da tela; confirmar no app instalado.
- Os textos de "Ambiente e Armazenamento Local" ("Offline Local-First", "PGlite / PostgreSQL") descrevem o modo do aplicativo do computador e aparecem iguais na versão web. Isso é comportamento atual; não mexi.
- A aba Empresa e propostas mostra os dados padrão da empresa embutidos no app (razão social, CNPJ, contato). Não são dados de teste criados pelo kit.

## Não conferido

- Usuário sem permissão de administrador (Usuários e Sistema não aparecem para ele).
- Configurações › Sistema com a lista de descartadas vazia ou longa (o kit tem uma proposta descartada).
- O Electron real, escala de letras maiores desligada e janelas abaixo de 1200 px.

## Testes

- `npm run verify`: typecheck ok, lint 0 erros (34 avisos já existentes), testes 336/337 passando, 1 pulado, 0 falhas.
- Chrome headless e servidores do kit encerrados pelo próprio kit.
