-- ============================================================
-- FASE 1 — Estimador de Potencial (V2.3.3.1)
-- Migration 0001: tabelas dos módulos 01–07 (fora da Gestão de Imóveis)
--
-- IMPORTANTE — decisão de design registrada aqui:
-- Os IDs atuais são strings curtas geradas por uid() no cliente
-- (ex.: "a1b2c3d4"), NÃO uuid. Por instrução explícita desta fase,
-- os IDs não são convertidos para uuid — todas as chaves primárias de
-- entidade usam `text`, para aceitar os valores existentes sem
-- transformação na futura migração (Fase 3).
-- ============================================================

-- ------------------------------------------------------------
-- comparables (Base de Comparáveis)
-- ------------------------------------------------------------
create table if not exists public.comparables (
  id                  text primary key,
  user_id             uuid not null references auth.users(id) default auth.uid(),
  demo                boolean not null default false,
  zona                text,
  bairro              text,
  regiao              text,
  endereco_ref        text,
  tipo                text,
  quartos             integer,
  banheiros           integer,
  area                numeric,
  capacidade          integer,
  camas               integer,
  garagem             boolean not null default false,
  elevador            boolean not null default false,
  varanda             boolean not null default false,
  piscina             boolean not null default false,
  academia            boolean not null default false,
  ar_condicionado     boolean not null default false,
  maquina_lavar       boolean not null default false,
  espaco_trabalho     boolean not null default false,
  mobiliado           boolean not null default true,
  padrao              text,
  diaria              numeric,
  taxa_limpeza        numeric,
  nota                numeric,
  avaliacoes          numeric,
  superhost           boolean not null default false,
  ocupacao_observada  text,
  diferenciais        text,
  data_pesquisa       date,
  link                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.comparables is 'Base de Comparáveis (módulo 02). Espelha EMPTY_COMP do frontend.';

-- ------------------------------------------------------------
-- settings (Configurações) — uma linha por usuário
-- ------------------------------------------------------------
create table if not exists public.settings (
  user_id                  uuid primary key references auth.users(id) default auth.uid(),
  adjustments              jsonb not null default '{}'::jsonb,
  costs                    jsonb not null default '{}'::jsonb,
  comissao_pct             numeric,
  comissao_base            text,
  ocupacao_padrao          jsonb not null default '{}'::jsonb,
  noites_mes               integer,
  duracao_media_estadia    numeric,
  updated_at               timestamptz not null default now()
);
comment on table public.settings is 'Configurações (módulo 04). Espelha DEFAULT_SETTINGS. Uma linha por usuário (PK = user_id).';

-- ------------------------------------------------------------
-- historico_analises (Histórico de Análises)
-- ------------------------------------------------------------
-- ATENÇÃO — INCOMPATIBILIDADE ENCONTRADA (ver relatório, seção "Incompatibilidades"):
-- o registro de histórico gerado hoje pelo frontend (handleAnalyze) NÃO possui
-- um campo `id` separado — só possui `codigo` (formato MS-AAAAMMDD-XXXX,
-- gerado com verificação de colisão no cliente). Usei `codigo` como chave
-- primária em vez de inventar um `id` que não existe nos dados reais.
-- Aguardando sua confirmação (ver seção 9 do relatório).
create table if not exists public.historico_analises (
  codigo        text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  criado_em     timestamptz not null default now(),
  endereco      text,
  tipo          text,
  target        jsonb not null,
  result        jsonb not null
);
comment on table public.historico_analises is 'Histórico de Análises (módulo 06). target/result são snapshots congelados — não normalizados nesta fase, conforme instrução.';

-- ------------------------------------------------------------
-- apresentacao_config (Apresentação / Estudo de Potencial) — uma linha por usuário
-- ------------------------------------------------------------
create table if not exists public.apresentacao_config (
  user_id       uuid primary key references auth.users(id) default auth.uid(),
  texts         jsonb not null default '{}'::jsonb,
  -- Foto mantida como texto (base64) nesta fase, sem Storage — conforme instrução.
  foto          text,
  updated_at    timestamptz not null default now()
);
comment on table public.apresentacao_config is 'Textos e foto do Estudo de Potencial (módulo 05). Foto em base64 por enquanto; migração para Supabase Storage fica para etapa futura, fora do escopo desta fase.';

-- ------------------------------------------------------------
-- parceria_config (Parceria com Corretores) — uma linha por usuário
-- ------------------------------------------------------------
create table if not exists public.parceria_config (
  user_id       uuid primary key references auth.users(id) default auth.uid(),
  config        jsonb not null default '{}'::jsonb,
  contador      integer not null default 0,
  updated_at    timestamptz not null default now()
);
comment on table public.parceria_config is 'Configuração da Proposta de Parceria (módulo 07) + contador sequencial de PAR-XXXX. Não é histórico de propostas — só a config atual, como hoje.';
