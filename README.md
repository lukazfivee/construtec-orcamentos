# Construtec Orçamentos

Aplicação desktop local-first para transformar catálogo, custos e mão de obra em propostas comerciais padronizadas da Construtec Engenharia.

## Estado do projeto

A fundação **comp-first** está implementada: Electron Forge, Vite, React e TypeScript no aplicativo desktop, Express na API local e PGlite/PostgreSQL para persistência. A primeira superfície é a mesa operacional de propostas, aprovada antes da implementação e reproduzida em código.

O fluxo **code-first** já permite pesquisar o catálogo local, inserir itens com snapshot comercial, editar quantidades e BDI, recalcular totais e excluir itens com auditoria. O controle de revisões também está ativo: cada nova revisão copia os snapshots, preserva a versão anterior em modo somente leitura e pode ser consultada pela aba Histórico.

Clientes e obras também possuem uma área própria de cadastro, busca e edição. A revisão atual pode trocar cliente e obra em conjunto; os nomes ficam congelados na proposta para que alterações futuras no cadastro não modifiquem documentos históricos.

O app também gera a revisão aberta em PDF e Word, com pré-visualização, identidade visual corporativa e escolha da pasta de destino. Os arquivos do cliente exibem somente quantidades e valores de venda; custos, margem e BDI permanecem restritos à interface interna.

Novas propostas podem ser criadas diretamente pela mesa operacional: o usuário seleciona cliente e obra, informa escopo e validade, e o sistema gera automaticamente a próxima numeração `PA-####` na revisão 00. As abas superiores agora representam propostas reais salvas no banco e permitem alternar entre elas.

O catálogo possui cadastro e edição de materiais e serviços, incluindo código, descrição, categoria, fabricante, modelo, unidade, custo, fonte e estado ativo. Atualizações afetam somente novas inclusões; os snapshots comerciais das propostas existentes permanecem inalterados.

Lotes de itens podem ser revisados e importados por colagem manual, planilhas XLSX/CSV/TSV, imagens lidas pelo OCR nativo do Windows ou páginas públicas da Exsat. Códigos repetidos atualizam o catálogo, sem alterar propostas já emitidas.

Autenticação completa e integrações externas entram nas próximas fases.

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

## Instalador do Windows

O instalador x64 é gerado automaticamente pelo GitHub Actions em uma máquina Windows. Abra a execução **Gerar instalador do Windows**, baixe o artefato `Construtec-Orcamentos-Windows-x64` e extraia o arquivo `Construtec-Orcamentos-1.0.0-Setup.exe`.

Para gerar em um computador Windows de desenvolvimento:

```powershell
npm ci
npm run verify
npm run make:windows
```

## Estrutura

- `src/renderer/`: interface React da mesa operacional;
- `src/server/`: API Express local e serviços;
- `src/server/routes/`: rotas validadas para catálogo, clientes, obras e propostas;
- `src/server/migrations/`: esquema versionado do PGlite;
- `src/shared/`: contratos tipados compartilhados entre API e interface;
- `src/main.ts`: ciclo de vida e janela segura do Electron;
- `src/preload.ts`: ponte mínima e tipada entre renderer e processo principal;
- `.impeccable/`: decisões, composições aprovadas e evidências de revisão visual.

## Princípios

- funcionamento offline como padrão;
- zero dependência de IA nas rotinas do produto;
- snapshot de preço e dados comerciais por item da proposta;
- snapshot de cliente e obra por revisão da proposta;
- separação rigorosa entre visão interna e documento do cliente;
- revisões imutáveis, histórico e auditoria;
- arquitetura preparada para futura integração ao Centro de Custos Construtec V3.

Consulte [PRODUCT.md](PRODUCT.md) para o contexto durável do produto.
