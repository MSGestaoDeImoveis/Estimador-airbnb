// =============================================================================
// FASE 4 — Ponte entre o estado React do EstimatorCore.jsx e a camada de
// dados da Fase 2 (supabaseData.js).
// =============================================================================
//
// Por que este arquivo existe: o EstimatorCore.jsx sempre funcionou assim —
// cada tela de Gestão de Imóveis chama `setModuleData(moduleKey, novoArray)`
// passando a lista JÁ ATUALIZADA daquele módulo (com um item criado, editado
// ou removido). Antes, isso ia inteiro para uma chave do localStorage.
// Agora, cada chamada precisa virar uma ou mais operações INDIVIDUAIS no
// Supabase (create/update/delete por registro — nunca a lista inteira como
// um blob), sem duplicar essa lógica em cada uma das dezenas de telas que
// chamam `setModuleData`. Por isso a lógica de "descobrir o que mudou entre
// a lista antiga e a nova, e aplicar só isso" mora aqui, uma vez só.
//
// Este arquivo NUNCA chama `supabase.from(...)` diretamente — só usa os
// repositórios exportados por supabaseData.js (a camada da Fase 2), como a
// Fase 4 exige.
// =============================================================================

/* -----------------------------------------------------------------------
   Igualdade "de negócio" — mesma lógica já usada e testada na Fase 3
   (fase3-migracao.js): undefined/null são equivalentes (porque um insert
   grava undefined como null no banco), mas "", 0 e false NUNCA são
   equivalentes a null. Evita diffs "fantasma" (marcar como alterado um
   campo que na prática tem o mesmo valor).
   ----------------------------------------------------------------------- */
function valorNormalizado(v) { return v === undefined ? null : v; }
function valoresIguais(a, b) {
  const na = valorNormalizado(a);
  const nb = valorNormalizado(b);
  if (na === nb) return true;
  if (na === null || nb === null) return false;
  if (typeof na === "object" && typeof nb === "object") {
    try { return JSON.stringify(na) === JSON.stringify(nb); } catch (e) { return false; }
  }
  return false;
}
function registrosIguais(a, b) {
  const chaves = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const chave of chaves) {
    if (!valoresIguais(a ? a[chave] : undefined, b ? b[chave] : undefined)) return false;
  }
  return true;
}

/* -----------------------------------------------------------------------
   diffEAplicarLista — para os 16 módulos de Gestão de Imóveis + comparables
   + historicoAnalises (todos "uma linha por registro, com id/codigo").
   Recebe a lista ANTERIOR (o que já estava confirmado no Supabase) e a lista
   SEGUINTE (o que a tela quer que passe a valer) e:
     - registro que só existe na seguinte  → repo.create(registro)
     - registro que existe nas duas mas com valores diferentes → repo.update
     - registro que só existia na anterior → repo.remove(id)
     - registro igual nas duas → não faz nenhuma chamada
   Devolve a lista que REALMENTE ficou confirmada no Supabase (itensFinais)
   e a lista de erros (erros) — nunca lança exceção, para quem chamar poder
   decidir como avisar o usuário (Regra 10 da Fase 4: nunca esconder erro).
   ----------------------------------------------------------------------- */
export async function diffEAplicarLista(repo, idField, anteriores, seguintes) {
  const anterioresPorId = new Map((anteriores || []).map((x) => [x[idField], x]));
  const seguintesPorId = new Map((seguintes || []).map((x) => [x[idField], x]));
  const erros = [];
  const itensFinais = [];

  for (const item of seguintes || []) {
    const id = item[idField];
    if (id === undefined || id === null || id === "") {
      erros.push({ tipo: "SEM_ID", registro: item });
      continue; // nunca inventa um id — igual à Fase 3
    }
    const anterior = anterioresPorId.get(id);
    if (anterior === undefined) {
      const r = await repo.create(item);
      if (r.ok) itensFinais.push(r.data);
      else erros.push({ tipo: "create", id, erro: r.error }); // criação falhou: não entra na lista final
      continue;
    }
    if (registrosIguais(item, anterior)) { itensFinais.push(anterior); continue; }
    const r = await repo.update(id, item);
    if (r.ok) itensFinais.push(r.data);
    else { erros.push({ tipo: "update", id, erro: r.error }); itensFinais.push(anterior); } // mantém o último valor confirmado
  }

  for (const item of anteriores || []) {
    const id = item[idField];
    if (seguintesPorId.has(id)) continue; // já tratado acima
    const r = await repo.remove(id);
    if (!r.ok) { erros.push({ tipo: "delete", id, erro: r.error }); itensFinais.push(item); } // exclusão falhou: preserva o registro
  }

  return { itensFinais, erros };
}

/* -----------------------------------------------------------------------
   Onboarding — caso especial. No app, `gestaoData.onboardingChecklists`
   sempre foi um dicionário { [imovelId]: { [item]: true/false } }, nunca
   uma lista. No Supabase (desde a Fase 1) é a tabela
   `onboarding_checklist_itens`, uma linha por item. O id de cada linha é
   determinístico (`onb__<imovelId>__<item>`, sanitizado) — a MESMA função
   já usada e testada na ferramenta de migração da Fase 3, reaproveitada
   aqui de propósito: um item marcado hoje pelo app precisa bater com o
   mesmo id de um item já migrado pela Fase 3, ou viraria um registro
   duplicado em vez de uma atualização.
   ----------------------------------------------------------------------- */
export function idOnboarding(imovelId, item) {
  return `onb__${imovelId}__${item}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function listaParaDictOnboarding(linhas) {
  const dict = {};
  for (const linha of linhas || []) {
    if (!dict[linha.imovelId]) dict[linha.imovelId] = {};
    dict[linha.imovelId][linha.item] = !!linha.concluido;
  }
  return dict;
}

export async function diffEAplicarOnboarding(repo, dictAnterior, dictSeguinte) {
  const erros = [];
  const dictFinal = {};
  const idsImoveis = new Set([...Object.keys(dictAnterior || {}), ...Object.keys(dictSeguinte || {})]);

  for (const imovelId of idsImoveis) {
    const itensAnteriores = (dictAnterior && dictAnterior[imovelId]) || {};
    const itensSeguintes = (dictSeguinte && dictSeguinte[imovelId]) || {};
    const chavesItens = new Set([...Object.keys(itensAnteriores), ...Object.keys(itensSeguintes)]);
    const itensFinais = {};

    for (const item of chavesItens) {
      const valorAnterior = !!itensAnteriores[item];
      const valorSeguinte = item in itensSeguintes ? !!itensSeguintes[item] : valorAnterior;
      if (valorAnterior === valorSeguinte) { itensFinais[item] = valorAnterior; continue; }

      const id = idOnboarding(imovelId, item);
      const registro = { id, imovelId, item, concluido: valorSeguinte };
      const upd = await repo.update(id, registro);
      if (upd.ok) { itensFinais[item] = valorSeguinte; continue; }
      if (upd.error && upd.error.type === "not_found") {
        const criado = await repo.create(registro);
        if (criado.ok) { itensFinais[item] = valorSeguinte; }
        else { erros.push({ tipo: "create", id, erro: criado.error }); itensFinais[item] = valorAnterior; }
        continue;
      }
      erros.push({ tipo: "update", id, erro: upd.error });
      itensFinais[item] = valorAnterior;
    }
    if (Object.keys(itensFinais).length > 0) dictFinal[imovelId] = itensFinais;
  }

  return { dictFinal, erros };
}

/* -----------------------------------------------------------------------
   Singleton (settings / apresentacao_config / parceria_config) — sempre
   uma linha por usuário, sempre upsert via repo.save(patch). Não precisa
   de diff: ou o Supabase confirma o upsert, ou não.
   ----------------------------------------------------------------------- */
export async function salvarSingleton(repo, patch) {
  const r = await repo.save(patch);
  return { ok: r.ok, dados: r.ok ? r.data : null, erro: r.ok ? null : r.error };
}

/* -----------------------------------------------------------------------
   Carregamento inicial da Gestão de Imóveis — busca as 15 tabelas em
   lista + a tabela de onboarding (convertida de volta para o dicionário
   que o resto do app espera), em paralelo.
   ----------------------------------------------------------------------- */
export async function carregarGestaoDoSupabase(repos) {
  const especificacao = [
    ["proprietarios", repos.proprietariosRepo],
    ["prestadores", repos.prestadoresRepo],
    ["parceiros", repos.parceirosRepo],
    ["imoveis", repos.imoveisRepo],
    ["reservas", repos.reservasRepo],
    ["indicacoes", repos.indicacoesRepo],
    ["limpeza", repos.limpezaRepo],
    ["lavanderia", repos.lavanderiaRepo],
    ["enxoval", repos.enxovalRepo],
    ["manutencao", repos.manutencaoRepo],
    ["pendencias", repos.pendenciasRepo],
    ["financeiro", repos.financeiroRepo],
    ["comissoes", repos.comissoesRepo],
    ["repasses", repos.repassesRepo],
    ["repassesParceiros", repos.repassesParceirosRepo],
  ];

  const erros = [];
  const data = {};

  const resultados = await Promise.all(especificacao.map(([, repo]) => repo.getAll()));
  especificacao.forEach(([chave], i) => {
    const r = resultados[i];
    if (r.ok) data[chave] = r.data;
    else { data[chave] = []; erros.push({ modulo: chave, erro: r.error }); }
  });

  const onboardingR = await repos.onboardingChecklistRepo.getAll();
  if (onboardingR.ok) data.onboardingChecklists = listaParaDictOnboarding(onboardingR.data);
  else { data.onboardingChecklists = {}; erros.push({ modulo: "onboardingChecklists", erro: onboardingR.error }); }

  return { data, erros };
}
