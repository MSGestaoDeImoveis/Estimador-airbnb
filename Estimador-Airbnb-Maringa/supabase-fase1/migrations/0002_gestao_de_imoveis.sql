-- ============================================================
-- FASE 1 — Estimador de Potencial (V2.3.3.1)
-- Migration 0002: Gestão de Imóveis (módulo 08) — 16 tabelas
--
-- Ordem de criação respeita as dependências (Foreign Keys), na mesma
-- ordem já usada no plano de migração (Fase 3 futura):
-- proprietarios/prestadores/parceiros → imoveis → reservas/indicacoes
-- → limpeza/lavanderia/enxoval/manutencao/pendencias/onboarding
-- → financeiro → comissoes → repasses/repasses_parceiros
--
-- Nenhum ON DELETE CASCADE é usado em nenhuma FK desta migration — por
-- instrução explícita, exclusões destrutivas continuam impedidas pelo
-- próprio banco (ON DELETE RESTRICT), a mesma intenção que a lógica do
-- frontend já implementa hoje em JavaScript.
-- ============================================================

-- ------------------------------------------------------------
-- proprietarios
-- ------------------------------------------------------------
create table if not exists public.proprietarios (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  nome          text not null,
  telefone      text,
  whatsapp      text,
  email         text,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- prestadores
-- ------------------------------------------------------------
create table if not exists public.prestadores (
  id             text primary key,
  user_id        uuid not null references auth.users(id) default auth.uid(),
  nome           text not null,
  categoria      text,
  telefone       text,
  whatsapp       text,
  contato        text,
  regiao         text,
  disponibilidade text,
  emergencia     text,
  status         text,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- parceiros
-- ------------------------------------------------------------
create table if not exists public.parceiros (
  id                text primary key,
  user_id           uuid not null references auth.users(id) default auth.uid(),
  nome              text not null,
  empresa           text,
  telefone          text,
  whatsapp          text,
  email             text,
  creci             text,
  tipo              text,
  codigo_parceiro   text,
  status            text,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Regra existente: código do parceiro (PAR-0001...) não pode se repetir.
  -- UNIQUE em Postgres permite múltiplos NULL (cada NULL é distinto dos
  -- demais), então registros sem código ainda não ficam bloqueados.
  constraint parceiros_codigo_parceiro_key unique (codigo_parceiro)
);

-- ------------------------------------------------------------
-- imoveis
-- ------------------------------------------------------------
create table if not exists public.imoveis (
  id                       text primary key,
  user_id                  uuid not null references auth.users(id) default auth.uid(),
  nome                     text not null,
  endereco                 text,
  bairro                   text,
  regiao                   text,
  tipo                     text,
  quartos                  integer,
  banheiros                integer,
  camas                    integer,
  capacidade               integer,
  proprietario_id          text references public.proprietarios(id) on delete restrict,
  parceiro_id              text references public.parceiros(id) on delete restrict,
  status                   text,
  telefone_operacional     text,
  inicio_gestao            date,
  percentual_comissao      numeric,
  informacoes_acesso       text,
  observacoes_internas     text,
  observacoes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ------------------------------------------------------------
-- reservas
-- ------------------------------------------------------------
create table if not exists public.reservas (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  imovel_id     text references public.imoveis(id) on delete restrict,
  hospede       text,
  contato       text,
  checkin       date,
  checkout      date,
  plataforma    text,
  status        text,
  valor         numeric,
  taxas         numeric,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- indicacoes
-- ------------------------------------------------------------
create table if not exists public.indicacoes (
  id                      text primary key,
  user_id                 uuid not null references auth.users(id) default auth.uid(),
  parceiro_id             text references public.parceiros(id) on delete restrict,
  imovel_id               text references public.imoveis(id) on delete restrict,
  data_indicacao          date,
  status_indicacao        text,
  inicio_participacao     date,
  observacoes             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ------------------------------------------------------------
-- limpeza
-- ------------------------------------------------------------
create table if not exists public.limpeza (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  imovel_id     text references public.imoveis(id) on delete restrict,
  reserva_id    text references public.reservas(id) on delete restrict,
  data          date,
  horario       text,
  responsavel   text,
  status        text,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- lavanderia
-- ------------------------------------------------------------
create table if not exists public.lavanderia (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  imovel_id     text references public.imoveis(id) on delete restrict,
  envio         date,
  recebimento   date,
  quantidade    integer,
  responsavel   text,
  status        text,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- enxoval
-- ------------------------------------------------------------
create table if not exists public.enxoval (
  id                      text primary key,
  user_id                 uuid not null references auth.users(id) default auth.uid(),
  imovel_id               text references public.imoveis(id) on delete restrict,
  item                    text,
  quantidade_necessaria   integer,
  quantidade_atual        integer,
  estoque_minimo          integer,
  observacoes             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ------------------------------------------------------------
-- manutencao
-- ------------------------------------------------------------
create table if not exists public.manutencao (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  imovel_id     text references public.imoveis(id) on delete restrict,
  problema      text,
  data          date,
  prioridade    text,
  prestador_id  text references public.prestadores(id) on delete restrict,
  status        text,
  custo         numeric,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- pendencias
-- ------------------------------------------------------------
create table if not exists public.pendencias (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  titulo        text not null,
  imovel_id     text references public.imoveis(id) on delete restrict,
  prioridade    text,
  prazo         date,
  responsavel   text,
  status        text,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- onboarding_checklist_itens
-- ------------------------------------------------------------
create table if not exists public.onboarding_checklist_itens (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  imovel_id     text references public.imoveis(id) on delete restrict,
  item          text not null,
  concluido     boolean not null default false,
  updated_at    timestamptz not null default now(),
  constraint onboarding_checklist_itens_imovel_item_key unique (imovel_id, item)
);
comment on table public.onboarding_checklist_itens is 'Substitui o dicionário onboardingChecklists (hoje {[imovelId]: {[item]: bool}}) por uma linha por item, como pedido.';

-- ------------------------------------------------------------
-- financeiro
-- ------------------------------------------------------------
-- IMPORTANTE: o modelo atual do frontend NÃO possui campo de status de
-- pagamento no Financeiro — por instrução explícita, esse campo NÃO foi
-- inventado aqui.
create table if not exists public.financeiro (
  id            text primary key,
  user_id       uuid not null references auth.users(id) default auth.uid(),
  tipo          text,
  imovel_id     text references public.imoveis(id) on delete restrict,
  reserva_id    text references public.reservas(id) on delete restrict,
  categoria     text,
  descricao     text,
  valor         numeric,
  data          date,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Regra existente (V2.3.2): uma reserva gera no máximo um lançamento
  -- financeiro principal. UNIQUE permite múltiplos NULL (lançamentos sem
  -- reserva de origem, ex.: despesas avulsas, continuam livres).
  constraint financeiro_reserva_id_key unique (reserva_id)
);

-- ------------------------------------------------------------
-- comissoes
-- ------------------------------------------------------------
create table if not exists public.comissoes (
  id              text primary key,
  user_id         uuid not null references auth.users(id) default auth.uid(),
  imovel_id       text references public.imoveis(id) on delete restrict,
  reserva_id      text references public.reservas(id) on delete restrict,
  financeiro_id   text references public.financeiro(id) on delete restrict,
  periodo         text,
  receita         numeric,
  percentual      numeric,
  status          text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Regra existente (V2.3.1/V2.3.2.1): uma reserva → no máximo uma comissão.
  -- Registros manuais/legados sem reserva_id continuam sem essa restrição.
  constraint comissoes_reserva_id_key unique (reserva_id)
);

-- ------------------------------------------------------------
-- repasses (repasse ao proprietário)
-- ------------------------------------------------------------
create table if not exists public.repasses (
  id                text primary key,
  user_id           uuid not null references auth.users(id) default auth.uid(),
  proprietario_id   text references public.proprietarios(id) on delete restrict,
  imovel_id         text references public.imoveis(id) on delete restrict,
  comissao_id       text references public.comissoes(id) on delete restrict,
  periodo           text,
  receita           numeric,
  despesas          numeric,
  comissao          numeric,
  status            text,
  data              date,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Regra existente (V2.3.2/V2.3.2.1): uma comissão → no máximo um repasse
  -- ao proprietário.
  constraint repasses_comissao_id_key unique (comissao_id)
);

-- ------------------------------------------------------------
-- repasses_parceiros
-- ------------------------------------------------------------
-- IMPORTANTE — ver seção 9 do relatório ("regra dos 25%"): valor_participacao
-- é mantido como coluna numeric comum, IGUAL ao modelo atual — não como
-- coluna GENERATED. Motivo: a tela de Reconciliação (V2.3.3) existe
-- justamente para detectar e reportar quando valor_participacao diverge de
-- 25% de comissao_recebida, sem corrigir sozinha; uma coluna GENERATED
-- recalcularia (e apagaria) esse valor divergente no momento da escrita,
-- tornando impossível importar ou preservar um registro histórico
-- inconsistente para a Reconciliação analisar. Ficou pendente de decisão
-- sua — não improvisei a alternativa.
create table if not exists public.repasses_parceiros (
  id                    text primary key,
  user_id               uuid not null references auth.users(id) default auth.uid(),
  parceiro_id           text references public.parceiros(id) on delete restrict,
  imovel_id             text references public.imoveis(id) on delete restrict,
  periodo               text,
  comissao_recebida     numeric,
  valor_participacao    numeric,
  status                text,
  data_prevista         date,
  data_pagamento        date,
  origem_comissao_id    text references public.comissoes(id) on delete restrict,
  observacoes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Regra existente (V2.3.1): uma comissão → no máximo um repasse ao parceiro.
  constraint repasses_parceiros_origem_comissao_id_key unique (origem_comissao_id)
);
