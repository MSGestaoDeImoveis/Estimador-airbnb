// =============================================================================
// FASE 2 — Camada de acesso a dados (Supabase)
// =============================================================================
//
// Este arquivo é NOVO e ISOLADO. Nada no restante do aplicativo o importa
// ainda — EstimatorCore.jsx continua usando loadJSON()/saveJSON() e o
// localStorage exatamente como antes. Esta camada só existe para ser
// testada isoladamente nesta fase; a substituição de fato acontece na
// FASE 4, com aprovação explícita.
//
// Responsabilidade desta camada:
//   COMPONENTES / TELAS  →  (nada muda aqui na Fase 2)
//   CAMADA DE DADOS       →  este arquivo (+ supabaseDataMappers.js)
//   SUPABASE              →  reaproveita o client já existente (supabaseClient.js)
//   POSTGRESQL            →  as 21 tabelas criadas na Fase 1
//
// O resto do app, quando um dia consumir isto (Fase 4), não precisa saber:
//   - que os nomes de coluna no banco são snake_case;
//   - que existe uma coluna user_id;
//   - o nome exato das tabelas;
//   - nada sobre RLS.
// Ele só chama, por exemplo, `imoveisRepo.getAll()` e recebe de volta
// objetos no MESMO formato camelCase que já usa hoje.
//
// NADA nesta fase:
//   - substitui loadJSON/saveJSON/setGestaoModuleData;
//   - migra dados reais;
//   - cria triggers, RPCs ou lógica de negócio no banco;
//   - altera regras (25%, uma comissão por reserva, 12 meses, etc.) —
//     essas continuam só no EstimatorCore.jsx, como hoje.
// =============================================================================

import { supabase } from "./supabaseClient.js";
import { appToRow, camelToSnake, fail, ok, rowToApp } from "./supabaseDataMappers.js";

/* -----------------------------------------------------------------------
   USUÁRIO AUTENTICADO
   -----------------------------------------------------------------------
   A camada nunca aceita um user_id vindo de fora — ela sempre pega da
   sessão Supabase atual (a mesma que AuthContext.jsx já usa). Isso evita
   qualquer possibilidade de um consumidor da camada "escolher" outro
   user_id por engano; o RLS do banco reforça isso de qualquer forma, mas
   a camada nem tenta permitir esse caminho. */
async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session?.user?.id ?? null;
}

/* -----------------------------------------------------------------------
   FÁBRICA GENÉRICA — entidades em lista (a maioria: imóveis, reservas,
   comissões, etc.)
   -----------------------------------------------------------------------
   Uma única implementação de CRUD, reaproveitada para as 18 entidades em
   lista (não para as 3 de "uma linha por usuário" — ver abaixo). Isso
   evita 18 cópias quase idênticas do mesmo código, mas cada chamada
   continua granular (uma linha por vez), nunca um "regravar tudo". */
function makeListRepo(table, { idField = "id" } = {}) {
  return {
    // getAll() — todas as linhas do usuário atual (RLS já filtra sozinho,
    // mas o filtro explícito facilita testar e deixa a intenção clara).
    async getAll() {
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
      if (error) return fail(error);
      return ok(data.map(rowToApp));
    },

    async getById(id) {
      if (!id) return fail({ message: `${idField} é obrigatório.`, code: "validation" });
      const { data, error } = await supabase.from(table).select("*").eq(idField, id).maybeSingle();
      if (error) return fail(error);
      if (!data) return fail({ code: "PGRST116" });
      return ok(rowToApp(data));
    },

    // create(item) — item já deve trazer o próprio idField preenchido
    // (o app gera o id da mesma forma que já gera hoje para o
    // localStorage — nenhum novo mecanismo de geração de id foi criado).
    async create(item) {
      if (!item || !item[idField]) return fail({ message: `Campo "${idField}" é obrigatório para criar.`, code: "validation" });
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const row = { ...appToRow(item), user_id: userId };
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) return fail(error);
      return ok(rowToApp(data));
    },

    async update(id, patch) {
      if (!id) return fail({ message: `${idField} é obrigatório.`, code: "validation" });
      const row = appToRow(patch);
      delete row.user_id; // nunca permitir trocar o dono de um registro por aqui
      delete row[camelToSnake(idField)];
      const { data, error } = await supabase.from(table).update(row).eq(idField, id).select().maybeSingle();
      if (error) return fail(error);
      if (!data) return fail({ code: "PGRST116" });
      return ok(rowToApp(data));
    },

    // remove(id) — NÃO tenta prever nem contornar uma rejeição por FK.
    // Se o banco recusar (ON DELETE RESTRICT da Fase 1), o erro chega
    // como { type: "constraint" } para quem chamou decidir o que fazer —
    // exatamente como a lógica de exclusão protegida já se comporta hoje
    // no frontend, só que agora também garantido pelo banco.
    async remove(id) {
      if (!id) return fail({ message: `${idField} é obrigatório.`, code: "validation" });
      const { error } = await supabase.from(table).delete().eq(idField, id);
      if (error) return fail(error);
      return ok(true);
    },
  };
}

/* -----------------------------------------------------------------------
   FÁBRICA GENÉRICA — "uma linha por usuário" (settings, apresentação,
   parceria)
   ----------------------------------------------------------------------- */
function makeSingletonRepo(table) {
  return {
    async get() {
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).maybeSingle();
      if (error) return fail(error);
      if (!data) return ok(null); // ainda não existe linha para este usuário — não é erro
      return ok(rowToApp(data));
    },
    // save() faz upsert — cria a linha na primeira vez, atualiza depois.
    async save(patch) {
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const row = { ...appToRow(patch), user_id: userId };
      const { data, error } = await supabase.from(table).upsert(row, { onConflict: "user_id" }).select().single();
      if (error) return fail(error);
      return ok(rowToApp(data));
    },
  };
}

/* -----------------------------------------------------------------------
   REPOSITÓRIOS DEDICADOS — apresentacao_config e parceria_config
   -----------------------------------------------------------------------
   Estas duas tabelas NÃO seguem o padrão genérico de conversão de nomes.
   Hoje, no localStorage, existem 4 chaves separadas:
     apresentacaoTexts, apresentacaoFoto, parceriaConfig, parceiroContador
   Na Fase 1, elas foram consolidadas em 2 tabelas (uma linha por usuário
   cada), com colunas próprias (texts/foto e config/contador) — não um
   espelho 1:1 de camelCase para snake_case, porque o nome da própria
   tabela já cumpre o papel do prefixo "apresentacao"/"parceria". Por
   isso, o `makeSingletonRepo` genérico (que assume conversão automática
   de nomes) não se aplica aqui sem ajuste — em vez de forçar isso pelo
   conversor genérico, uso dois repositórios com o mapeamento explícito
   dos 4 campos reais. Ver relatório desta fase, seção "Decisões técnicas". */
function makeConfigRepo(table, campos) {
  return {
    async get() {
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).maybeSingle();
      if (error) return fail(error);
      if (!data) return ok(null);
      const out = {};
      for (const [appKey, dbKey] of Object.entries(campos)) out[appKey] = data[dbKey];
      return ok(out);
    },
    async save(patch) {
      const userId = await getCurrentUserId();
      if (!userId) return fail({ message: "Sem sessão autenticada.", code: "42501" });
      const row = { user_id: userId };
      for (const [appKey, dbKey] of Object.entries(campos)) {
        if (patch[appKey] !== undefined) row[dbKey] = patch[appKey];
      }
      const { data, error } = await supabase.from(table).upsert(row, { onConflict: "user_id" }).select().single();
      if (error) return fail(error);
      const out = {};
      for (const [appKey, dbKey] of Object.entries(campos)) out[appKey] = data[dbKey];
      return ok(out);
    },
  };
}

/* -----------------------------------------------------------------------
   REPOSITÓRIOS — um por tabela da Fase 1
   ----------------------------------------------------------------------- */

// Módulos 01–07
export const comparablesRepo = makeListRepo("comparables");
export const settingsRepo = makeSingletonRepo("settings");
export const historicoRepo = makeListRepo("historico_analises", { idField: "codigo" });
export const apresentacaoRepo = makeConfigRepo("apresentacao_config", { apresentacaoTexts: "texts", apresentacaoFoto: "foto" });
export const parceriaRepo = makeConfigRepo("parceria_config", { parceriaConfig: "config", parceiroContador: "contador" });

// Gestão de Imóveis (módulo 08)
export const proprietariosRepo = makeListRepo("proprietarios");
export const prestadoresRepo = makeListRepo("prestadores");
export const parceirosRepo = makeListRepo("parceiros");
export const imoveisRepo = makeListRepo("imoveis");
export const reservasRepo = makeListRepo("reservas");
export const indicacoesRepo = makeListRepo("indicacoes");
export const limpezaRepo = makeListRepo("limpeza");
export const lavanderiaRepo = makeListRepo("lavanderia");
export const enxovalRepo = makeListRepo("enxoval");
export const manutencaoRepo = makeListRepo("manutencao");
export const pendenciasRepo = makeListRepo("pendencias");
export const onboardingChecklistRepo = makeListRepo("onboarding_checklist_itens");
export const financeiroRepo = makeListRepo("financeiro");
export const comissoesRepo = makeListRepo("comissoes");
export const repassesRepo = makeListRepo("repasses");
export const repassesParceirosRepo = makeListRepo("repasses_parceiros");

// Exportado só para o script de teste de integração desta fase.
export const _internal = { getCurrentUserId, makeListRepo, makeSingletonRepo };
