import {
  diffEAplicarLista, diffEAplicarOnboarding, salvarSingleton,
  carregarGestaoDoSupabase, idOnboarding, listaParaDictOnboarding,
} from "../../src/lib/gestaoDataBridge.js";

// ---- "Supabase" simulado em memória, reaproveitando o mesmo formato de
// resultado { ok, data } / { ok:false, error } da camada real (supabaseData.js) ----
const db = {};
function table(name) { if (!db[name]) db[name] = new Map(); return db[name]; }
function makeListRepoMock(tableName, idField = "id") {
  return {
    async getAll() { return { ok: true, data: [...table(tableName).values()] }; },
    async getById(id) {
      const t = table(tableName);
      if (!t.has(id)) return { ok: false, error: { type: "not_found" } };
      return { ok: true, data: t.get(id) };
    },
    async create(item) {
      const t = table(tableName);
      if (t.has(item[idField])) return { ok: false, error: { type: "constraint" } };
      t.set(item[idField], { ...item });
      return { ok: true, data: { ...item } };
    },
    async update(id, patch) {
      const t = table(tableName);
      if (!t.has(id)) return { ok: false, error: { type: "not_found" } };
      const atual = { ...t.get(id), ...patch, [idField]: id };
      t.set(id, atual);
      return { ok: true, data: { ...atual } };
    },
    async remove(id) {
      const t = table(tableName);
      if (!t.has(id)) return { ok: false, error: { type: "not_found" } };
      t.delete(id);
      return { ok: true, data: true };
    },
    // simula uma falha de rede controlada em uma única chamada, para testar
    // "nunca mostrar como salvo o que não foi"
    _forcarFalhaProxima(metodo) { this[`__falha_${metodo}`] = true; },
  };
}
function makeSingletonRepoMock() {
  let linha = null;
  return {
    async get() { return { ok: true, data: linha }; },
    async save(patch) { linha = { ...(linha || {}), ...patch }; return { ok: true, data: { ...linha } }; },
  };
}

const imoveisRepo = makeListRepoMock("imoveis");
const reservasRepo = makeListRepoMock("reservas");
const onboardingRepo = makeListRepoMock("onboarding_checklist_itens");
const settingsRepoMock = makeSingletonRepoMock();

const assertions = [];
const assert = (desc, cond) => assertions.push([desc, !!cond]);

const run = async () => {
  console.log("=== TESTE: CREATE -> UPDATE -> READ -> DELETE via diffEAplicarLista ===");
  // CREATE
  let r = await diffEAplicarLista(imoveisRepo, "id", [], [{ id: "im1", nome: "Studio A", proprietarioId: "p1" }]);
  assert("CREATE: sem erros", r.erros.length === 0);
  assert("CREATE: item final tem o nome certo", r.itensFinais[0].nome === "Studio A");
  assert("CREATE: realmente gravou no banco simulado", (await imoveisRepo.getAll()).data.length === 1);

  // UPDATE
  r = await diffEAplicarLista(imoveisRepo, "id", r.itensFinais, [{ id: "im1", nome: "Studio A Renovado", proprietarioId: "p1" }]);
  assert("UPDATE: sem erros", r.erros.length === 0);
  assert("UPDATE: nome atualizado", r.itensFinais[0].nome === "Studio A Renovado");
  // READ (getAll reflete o estado)
  const lido = await imoveisRepo.getAll();
  assert("READ: reflete a atualização", lido.data[0].nome === "Studio A Renovado");

  // DELETE
  r = await diffEAplicarLista(imoveisRepo, "id", r.itensFinais, []);
  assert("DELETE: sem erros", r.erros.length === 0);
  assert("DELETE: lista final vazia", r.itensFinais.length === 0);
  assert("DELETE: realmente removeu do banco simulado", (await imoveisRepo.getAll()).data.length === 0);

  console.log("\n=== TESTE: erro de UPDATE não é mostrado como sucesso (Regra 10 da Fase 4) ===");
  await diffEAplicarLista(reservasRepo, "id", [], [{ id: "r1", hospede: "Ana", valor: 100 }]);
  const repoComFalha = { ...reservasRepo, update: async () => ({ ok: false, error: { type: "network", message: "offline" } }) };
  const rFalha = await diffEAplicarLista(repoComFalha, "id", [{ id: "r1", hospede: "Ana", valor: 100 }], [{ id: "r1", hospede: "Ana", valor: 999 }]);
  assert("UPDATE com falha: erro reportado", rFalha.erros.length === 1 && rFalha.erros[0].tipo === "update");
  assert("UPDATE com falha: valor final é o ÚLTIMO CONFIRMADO (100), não o que falhou (999)", rFalha.itensFinais[0].valor === 100);

  console.log("\n=== TESTE: erro de CREATE não entra na lista final ===");
  const repoCreateFalha = { ...imoveisRepo, create: async () => ({ ok: false, error: { type: "constraint" } }) };
  const rCreateFalha = await diffEAplicarLista(repoCreateFalha, "id", [], [{ id: "im2", nome: "Novo" }]);
  assert("CREATE com falha: erro reportado", rCreateFalha.erros.length === 1 && rCreateFalha.erros[0].tipo === "create");
  assert("CREATE com falha: item NÃO aparece como criado", rCreateFalha.itensFinais.length === 0);

  console.log("\n=== TESTE: erro de DELETE preserva o registro (não remove visualmente) ===");
  await diffEAplicarLista(imoveisRepo, "id", [], [{ id: "im3", nome: "Studio C" }]);
  const repoDeleteFalha = { ...imoveisRepo, remove: async () => ({ ok: false, error: { type: "constraint", message: "FK" } }) };
  const rDeleteFalha = await diffEAplicarLista(repoDeleteFalha, "id", [{ id: "im3", nome: "Studio C" }], []);
  assert("DELETE com falha: erro reportado", rDeleteFalha.erros.length === 1 && rDeleteFalha.erros[0].tipo === "delete");
  assert("DELETE com falha: registro PRESERVADO na lista final", rDeleteFalha.itensFinais.length === 1 && rDeleteFalha.itensFinais[0].id === "im3");

  console.log("\n=== TESTE: registro sem id nunca é inventado/migrado ===");
  const rSemId = await diffEAplicarLista(imoveisRepo, "id", [], [{ nome: "Sem id" }]);
  assert("SEM_ID: erro reportado, não cria", rSemId.erros.length === 1 && rSemId.erros[0].tipo === "SEM_ID" && rSemId.itensFinais.length === 0);

  console.log("\n=== TESTE: onboarding — dict -> Supabase -> dict, ida e volta ===");
  const dictInicial = {};
  const r1 = await diffEAplicarOnboarding(onboardingRepo, dictInicial, { im1: { "Contrato assinado": true } });
  assert("Onboarding: sem erros ao criar", r1.erros.length === 0);
  assert("Onboarding: dictFinal reflete o valor marcado", r1.dictFinal.im1["Contrato assinado"] === true);
  const linhasSalvas = (await onboardingRepo.getAll()).data;
  assert("Onboarding: gravou 1 linha com id determinístico esperado", linhasSalvas.length === 1 && linhasSalvas[0].id === idOnboarding("im1", "Contrato assinado"));
  const dictReconstruido = listaParaDictOnboarding(linhasSalvas);
  assert("Onboarding: listaParaDictOnboarding reconstrói o mesmo dict", dictReconstruido.im1["Contrato assinado"] === true);

  // desmarcar (false) — deve fazer update, não create
  const r2 = await diffEAplicarOnboarding(onboardingRepo, r1.dictFinal, { im1: { "Contrato assinado": false } });
  assert("Onboarding: desmarcar funciona (update)", r2.dictFinal.im1["Contrato assinado"] === false);
  assert("Onboarding: continua sendo 1 linha só (não duplicou)", (await onboardingRepo.getAll()).data.length === 1);

  console.log("\n=== TESTE: singleton (settings) — upsert direto ===");
  const s1 = await salvarSingleton(settingsRepoMock, { comissaoPct: 20 });
  assert("Singleton: primeiro save ok", s1.ok && s1.dados.comissaoPct === 20);
  const s2 = await salvarSingleton(settingsRepoMock, { comissaoPct: 25 });
  assert("Singleton: segundo save (update) ok", s2.ok && s2.dados.comissaoPct === 25);

  console.log("\n=== TESTE: carregarGestaoDoSupabase — erro em um módulo não trava os outros ===");
  const repos = {
    proprietariosRepo: makeListRepoMock("proprietarios"), prestadoresRepo: makeListRepoMock("prestadores"),
    parceirosRepo: makeListRepoMock("parceiros"), imoveisRepo,
    reservasRepo: { getAll: async () => ({ ok: false, error: { type: "network" } }) },
    indicacoesRepo: makeListRepoMock("indicacoes"), limpezaRepo: makeListRepoMock("limpeza"),
    lavanderiaRepo: makeListRepoMock("lavanderia"), enxovalRepo: makeListRepoMock("enxoval"),
    manutencaoRepo: makeListRepoMock("manutencao"), pendenciasRepo: makeListRepoMock("pendencias"),
    financeiroRepo: makeListRepoMock("financeiro"), comissoesRepo: makeListRepoMock("comissoes"),
    repassesRepo: makeListRepoMock("repasses"), repassesParceirosRepo: makeListRepoMock("repassesParceiros"),
    onboardingChecklistRepo: onboardingRepo,
  };
  const carregado = await carregarGestaoDoSupabase(repos);
  assert("Carregamento: erro de 'reservas' reportado", carregado.erros.some((e) => e.modulo === "reservas"));
  assert("Carregamento: 'reservas' vem como [] (não trava o app)", Array.isArray(carregado.data.reservas) && carregado.data.reservas.length === 0);
  assert("Carregamento: outros módulos carregaram normalmente (imoveis)", Array.isArray(carregado.data.imoveis));
  assert("Carregamento: onboarding veio como dict", typeof carregado.data.onboardingChecklists === "object");

  console.log("\n=== RESULTADO ===");
  let ok = true;
  for (const [d, c] of assertions) { console.log((c ? "OK  " : "FAIL"), "-", d); if (!c) ok = false; }
  console.log(ok ? "\nTODAS AS ASSERCOES DA FASE 4 (bridge) PASSARAM" : "\nALGUMA ASSERCAO FALHOU");
  if (!ok) process.exit(1);
};
run().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(1); });
