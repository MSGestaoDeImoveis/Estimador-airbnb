# Estimador de Potencial — Locação por Temporada (Maringá/PR)

Aplicação web (React + Supabase) para estimar o potencial de faturamento de
imóveis para locação por temporada, apresentar a oportunidade a
proprietários e operar a Gestão de Imóveis da MS Gestão de Imóveis
(financeiro, comissões, parceiros, onboarding, etc.).

> **Nota de arquitetura:** esta versão usa **Supabase como fonte única de
> dados** (autenticação, banco de dados com RLS por usuário). Isso é
> diferente das primeiras versões deste projeto, que guardavam tudo
> apenas no navegador (localStorage) — se você tem documentação antiga
> mencionando "nada é enviado para a internet" ou "dados salvos só neste
> computador", ela descreve uma versão anterior e não se aplica mais.
> Hoje, ao fazer login, seus dados (comparáveis, gestão de imóveis,
> configurações, histórico) são lidos e gravados no seu projeto Supabase.

## Estrutura deste repositório

```
codigo-fonte/        → projeto React (Vite) — é aqui que o build acontece
  src/
    App.jsx           → ponto de entrada (autenticação + app)
    lib/
      EstimatorCore.jsx      → todas as telas e regras de negócio
      gestaoDataBridge.js    → ponte entre o estado React e o Supabase
      supabaseData.js        → camada de acesso a dados (repositórios)
      supabaseDataMappers.js → conversão camelCase ↔ snake_case e erros
      supabaseClient.js      → cliente Supabase (usa variáveis de ambiente)
      AuthContext.jsx, LoginScreen.jsx, LogoutButton.jsx → autenticação
  tests/               → testes automatizados (Node, sem dependências externas)
supabase-fase1/       → schema SQL e políticas de RLS do banco (referência —
                         rode estas migrations no SQL Editor do seu projeto
                         Supabase antes do primeiro uso)
```

## Como rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) 18 ou superior.

```bash
cd codigo-fonte
npm install
cp .env.example .env   # depois edite o .env com os dados do seu Supabase
npm run dev
```

## Configurar o Supabase (obrigatório antes do primeiro uso)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor** do projeto, rode, nesta ordem, os 3 arquivos de
   `supabase-fase1/migrations/`:
   - `0001_modulos_01_07.sql`
   - `0002_gestao_de_imoveis.sql`
   - `0003_rls_policies.sql`
3. Em **Project Settings → API**, copie a **Project URL** e a **anon /
   public key** (nunca a `service_role`/secret).
4. Em **Authentication → Users**, cadastre manualmente cada usuário
   autorizado (não existe tela de cadastro público no app). Em
   **Authentication → Providers → Email**, recomenda-se desativar "Allow
   new users to sign up".
5. Copie `codigo-fonte/.env.example` para `codigo-fonte/.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-aqui
   ```
   O arquivo `.env` nunca deve ser enviado ao GitHub (já está no
   `.gitignore`).

## Deploy na Vercel

Ver `RELATORIO_FINAL_PUBLICACAO.md` para o passo a passo completo e a
lista exata de variáveis de ambiente a configurar.

## Testes

```bash
cd codigo-fonte
node tests/fase2/test-mappers.mjs
node tests/fase2/test-field-coverage.mjs
node tests/fase4/test-bridge.mjs
node tests/fase4/test-correcao-concorrencia.mjs
node tests/fase5/test-correcoes-auditoria.mjs
node tests/fase6/test-correcao-a5.mjs
npm run build
npm run lint
```

## Migração de dados de uma versão anterior (localStorage → Supabase)

Se você já usou uma versão anterior deste app (antes da migração para
Supabase) e tem dados salvos no navegador, existe uma ferramenta separada
de migração controlada (não incluída neste pacote de publicação — peça-a
separadamente se precisar). Ela audita, faz snapshot e migra os dados do
localStorage para o Supabase sem apagar nada automaticamente.

## Histórico do projeto

Este projeto evoluiu por várias fases: da ferramenta original (Análise
Rápida + Base de Comparáveis) até a Gestão de Imóveis completa
(financeiro, comissões, parceiros, onboarding), e depois por uma
migração de persistência de localStorage para Supabase (Fases 1 a 6:
banco, camada de dados, migração, frontend conectado, auditoria e
correções). Todas as regras de negócio, cálculos e PDFs da ferramenta
original foram preservados integralmente ao longo dessa migração.
