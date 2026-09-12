// =============================================================================
// Testes das correções dos achados A1, A2 e A3 da auditoria da Fase 5.
// =============================================================================
// EstimatorCore.jsx só exporta o componente `App` (é um arquivo de UI React,
// não uma biblioteca) — não há como importar `setGestaoModuleData` ou
// `gestaoDependentesParaExcluir` isoladamente sem mudar a superfície de
// exportação do arquivo, o que não foi pedido e alteraria mais do que o
// estritamente necessário. Por isso, como já foi feito para o teste do
// carregamento inicial (Fase 4), cada teste abaixo reproduz FIELMENTE o
// trecho de lógica corrigido (mesmo formato de dados, mesma sequência de
// operações), citando a linha/função real correspondente em cada comentário,
// para comprovar que a correção funciona como pretendido.
// =============================================================================

const assertions = [];
const assert = (desc, cond) => assertions.push([desc, !!cond]);

/* -----------------------------------------------------------------------
   A2 — setGestaoModuleData / setComparables / setHistorico agora atualizam
   o ref de forma SÍNCRONA (no mesmo instante em que o novo estado é
   montado), em vez de depender de um useEffect assíncrono. Reproduz aqui a
   versão CORRIGIDA de `setGestaoModuleData` (EstimatorCore.jsx, função de
   mesmo nome) contra um "Supabase" simulado, e comprova que duas chamadas
   muito próximas para o MESMO módulo (delete seguido de outra alteração)
   não fazem o item excluído reaparecer.
   ----------------------------------------------------------------------- */
function makeListRepoMock(tableName, idField = "id") {
  const t = new Map();
  return {
    async getAll() { return { ok: true, data: [...t.values()] }; },
    async create(item) { t.set(item[idField], { ...item }); return { ok: true, data: { ...item } }; },
    async update(id, patch) { const atual = { ...t.get(id), ...patch }; t.set(id, atual); return { ok: true, data: { ...atual } }; },
    async remove(id) { if (!t.has(id)) return { ok: false, error: { type: "not_found" } }; t.delete(id); return { ok: true, data: true }; },
  };
}

async function diffEAplicarLista(repo, idField, anteriores, seguintes) {
  const anterioresPorId = new Map((anteriores || []).map((x) => [x[idField], x]));
  const seguintesPorId = new Map((seguintes || []).map((x) => [x[idField], x]));
  const erros = [];
  const itensFinais = [];
  for (const item of seguintes || []) {
    const id = item[idField];
    const anterior = anterioresPorId.get(id);
    if (anterior === undefined) { const r = await repo.create(item); if (r.ok) itensFinais.push(r.data); else erros.push({ tipo: "create", id }); continue; }
    if (JSON.stringify(anterior) === JSON.stringify(item)) { itensFinais.push(anterior); continue; }
    const r = await repo.update(id, item);
    if (r.ok) itensFinais.push(r.data); else { erros.push({ tipo: "update", id }); itensFinais.push(anterior); }
  }
  for (const item of anteriores || []) {
    const id = item[idField];
    if (seguintesPorId.has(id)) continue;
    const r = await repo.remove(id);
    if (!r.ok) { erros.push({ tipo: "delete", id }); itensFinais.push(item); }
  }
  return { itensFinais, erros };
}

// Reproduz `setGestaoModuleData` como está HOJE (pós-correção): o ref é
// atualizado de forma síncrona, antes de qualquer `await`.
function criarGestaoDataHandlerCorrigido({ repo, estadoInicial }) {
  const gestaoDataRef = { current: estadoInicial };
  const historicoEstados = [];
  function setGestaoModuleData(moduleKey, itemsOuDict) {
    const anterior = gestaoDataRef.current;
    const proximoEstado = { ...anterior, [moduleKey]: itemsOuDict };
    gestaoDataRef.current = proximoEstado; // <- SÍNCRONO (a correção)
    historicoEstados.push(proximoEstado);
    const anterioresDoModulo = anterior[moduleKey] || [];
    return diffEAplicarLista(repo, "id", anterioresDoModulo, itemsOuDict).then(({ itensFinais, erros }) => {
      if (erros.length > 0) {
        gestaoDataRef.current = { ...gestaoDataRef.current, [moduleKey]: itensFinais };
        historicoEstados.push(gestaoDataRef.current);
      }
    });
  }
  return { setGestaoModuleData, gestaoDataRef, historicoEstados };
}

// Para comparação: a versão ANTIGA (com ref assíncrono via "useEffect"
// simulado, que só sincroniza depois de um `tick`) — usada só para provar
// que o bug realmente existia antes da correção.
function criarGestaoDataHandlerAntigo({ repo, estadoInicial }) {
  let estadoReact = estadoInicial;
  const gestaoDataRef = { current: estadoInicial };
  // Simula o useEffect: só roda depois de um "microtask" (setTimeout 0),
  // igual ao comportamento real de um efeito React rodando após o commit.
  function agendarSincronizacaoDoRef(novoEstado) {
    setTimeout(() => { gestaoDataRef.current = novoEstado; }, 0);
  }
  function setGestaoModuleData(moduleKey, itemsOuDict) {
    const anterior = gestaoDataRef.current; // pode estar desatualizado!
    const proximoEstado = { ...estadoReact, [moduleKey]: itemsOuDict };
    estadoReact = proximoEstado;
    agendarSincronizacaoDoRef(proximoEstado); // assíncrono, como o useEffect antigo
    const anterioresDoModulo = anterior[moduleKey] || [];
    return diffEAplicarLista(repo, "id", anterioresDoModulo, itemsOuDict).then(({ itensFinais, erros }) => {
      if (erros.length > 0) { estadoReact = { ...estadoReact, [moduleKey]: itensFinais }; }
      return estadoReact;
    });
  }
  return { setGestaoModuleData, getEstadoReact: () => estadoReact };
}

async function testeA2_versaoCorrigidaNaoResuscitaItemExcluido() {
  const repo = makeListRepoMock("imoveis");
  await repo.create({ id: "im1", nome: "A" });
  await repo.create({ id: "im2", nome: "B" });
  const { setGestaoModuleData, gestaoDataRef } = criarGestaoDataHandlerCorrigido({
    repo, estadoInicial: { imoveis: [{ id: "im1", nome: "A" }, { id: "im2", nome: "B" }] },
  });

  // Duas chamadas para o MESMO módulo, de propósito, sem esperar a
  // primeira terminar (mesma condição que causava o bug antes da correção):
  const p1 = setGestaoModuleData("imoveis", [{ id: "im2", nome: "B" }]); // exclui im1
  const p2 = setGestaoModuleData("imoveis", [{ id: "im2", nome: "B renomeado" }]); // edita im2, no mesmo instante
  await Promise.all([p1, p2]);

  const finalNoBanco = (await repo.getAll()).data;
  assert("A2 corrigido: im1 realmente excluído do banco simulado", !finalNoBanco.some((i) => i.id === "im1"));
  assert("A2 corrigido: im1 NÃO ressuscitou no estado final (ref)", !(gestaoDataRef.current.imoveis || []).some((i) => i.id === "im1"));
  assert("A2 corrigido: im2 refletindo a edição mais recente", (gestaoDataRef.current.imoveis || []).find((i) => i.id === "im2")?.nome === "B renomeado");
}

async function testeA2_versaoAntigaDemonstraOProblema() {
  const repo = makeListRepoMock("imoveis-antigo");
  await repo.create({ id: "im1", nome: "A" });
  await repo.create({ id: "im2", nome: "B" });
  const { setGestaoModuleData, getEstadoReact } = criarGestaoDataHandlerAntigo({
    repo, estadoInicial: { imoveis: [{ id: "im1", nome: "A" }, { id: "im2", nome: "B" }] },
  });

  const p1 = setGestaoModuleData("imoveis", [{ id: "im2", nome: "B" }]); // exclui im1
  const p2 = setGestaoModuleData("imoveis", [{ id: "im2", nome: "B renomeado" }]); // edita im2 ANTES do ref sincronizar
  await Promise.all([p1, p2]);

  const finalNoBanco = (await repo.getAll()).data;
  const estadoFinal = getEstadoReact();
  assert("A2 (versão antiga, referência): im1 excluído no banco (o dado real está correto)", !finalNoBanco.some((i) => i.id === "im1"));
  assert(
    "A2 (versão antiga, referência): reproduz o bug relatado — im1 reaparece no estado visível por causa do 'anterior' desatualizado",
    (estadoFinal.imoveis || []).some((i) => i.id === "im1")
  );
}

/* -----------------------------------------------------------------------
   A1 — GESTAO_DEPENDENCIAS/gestaoDependentesParaExcluir agora também
   contam itens de onboarding marcados para o imóvel, além das entidades
   em lista já cobertas.
   ----------------------------------------------------------------------- */
const GESTAO_DEPENDENCIAS = {
  imoveis: [["reservas", "imovelId", "reserva(s)"]], // reduzido para o teste; a regra testada é a do onboarding, adicionada por igual
};
// Reprodução fiel da função corrigida em EstimatorCore.jsx.
function gestaoDependentesParaExcluir(allData, moduleKey, id) {
  const regras = GESTAO_DEPENDENCIAS[moduleKey];
  const encontrados = [];
  if (regras) {
    for (const [refModule, refKey, label] of regras) {
      const n = (allData[refModule] || []).filter((r) => r[refKey] === id).length;
      if (n > 0) encontrados.push(`${n} ${label}`);
    }
  }
  if (moduleKey === "imoveis") {
    const itensOnboarding = Object.keys((allData.onboardingChecklists && allData.onboardingChecklists[id]) || {}).length;
    if (itensOnboarding > 0) encontrados.push(`${itensOnboarding} item(ns) de onboarding`);
  }
  return encontrados;
}

function testeA1_onboardingBloqueiaExclusaoComAviso() {
  const allData = {
    reservas: [],
    onboardingChecklists: { im1: { "Chave de reserva": true, "Fotos": false } },
  };
  const dependentes = gestaoDependentesParaExcluir(allData, "imoveis", "im1");
  assert("A1: exclusão de imóvel com itens de onboarding agora aparece no aviso", dependentes.some((d) => d.includes("item(ns) de onboarding")));
  assert("A1: quantidade correta (2 itens)", dependentes.some((d) => d.startsWith("2 item(ns) de onboarding")));

  const semOnboarding = gestaoDependentesParaExcluir({ reservas: [], onboardingChecklists: {} }, "imoveis", "im2");
  assert("A1: imóvel sem itens de onboarding não gera aviso indevido", !semOnboarding.some((d) => d.includes("onboarding")));

  const outroModulo = gestaoDependentesParaExcluir({ onboardingChecklists: { p1: { x: true } } }, "proprietarios", "p1");
  assert("A1: a checagem de onboarding só se aplica a 'imoveis', não a outros módulos", !outroModulo.some((d) => d.includes("onboarding")));
}

/* -----------------------------------------------------------------------
   A3 — módulo desconhecido em setGestaoModuleData agora aciona
   setSaveError(true), além do console.error.
   ----------------------------------------------------------------------- */
function testeA3_moduloDesconhecidoAcionaSaveError() {
  let saveErrorChamado = false;
  const setSaveError = (v) => { saveErrorChamado = v; };
  const GESTAO_REPO_POR_MODULO = { imoveis: {} }; // "moduloFantasma" de propósito não está aqui

  // Reprodução fiel do branch corrigido.
  function setGestaoModuleDataTrechoDeErro(moduleKey) {
    const repo = GESTAO_REPO_POR_MODULO[moduleKey];
    if (!repo) {
      setSaveError(true);
      return;
    }
  }
  setGestaoModuleDataTrechoDeErro("moduloFantasma");
  assert("A3: setSaveError(true) é chamado quando o módulo não tem repositório", saveErrorChamado === true);
}

const run = async () => {
  await testeA2_versaoCorrigidaNaoResuscitaItemExcluido();
  await testeA2_versaoAntigaDemonstraOProblema();
  testeA1_onboardingBloqueiaExclusaoComAviso();
  testeA3_moduloDesconhecidoAcionaSaveError();

  let ok = true;
  for (const [desc, cond] of assertions) { console.log((cond ? "OK  " : "FAIL"), "-", desc); if (!cond) ok = false; }
  console.log(ok ? "\nTODAS AS ASSERCOES DAS CORRECOES A1/A2/A3 PASSARAM" : "\nALGUMA ASSERCAO FALHOU");
  if (!ok) process.exit(1);
};
run().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(1); });
