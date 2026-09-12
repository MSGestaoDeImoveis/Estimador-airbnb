// =============================================================================
// Teste dedicado do achado A5 (auditoria da Fase 6).
// =============================================================================
// Cenário exigido, exatamente como reproduzido no relatório da Fase 6:
//   OPERAÇÃO A falha (ex.: exclusão recusada pelo Supabase)
//   OPERAÇÃO B, no mesmo módulo, mexe em OUTRO registro e tem sucesso
//   → a recuperação de erro de A não pode apagar a alteração de B,
//     nem no estado visível (o objeto de estado) nem na ref.
//
// Este arquivo tem duas partes:
//   1) PARTE 1 reproduz a versão ANTIGA de `setGestaoModuleData` (a que
//      causava o A5) e comprova que o bug realmente acontecia.
//   2) PARTE 2 reproduz a versão NOVA (pós-correção, com mesclagem por id
//      em vez de substituição do array inteiro) e comprova que o mesmo
//      cenário não perde mais a alteração de B.
//
// EstimatorCore.jsx só exporta o componente `App` (é um arquivo de UI
// React) — como já feito para os testes de Fase 4/Fase 5, cada mirror
// abaixo reproduz FIELMENTE o trecho real de código correspondente.
// =============================================================================

const assertions = [];
const assert = (desc, cond) => assertions.push([desc, !!cond]);

function makeListRepoMock(tableName, idField = "id") {
  const t = new Map();
  return {
    async getAll() { return { ok: true, data: [...t.values()] }; },
    async create(item) { t.set(item[idField], { ...item }); return { ok: true, data: { ...item } }; },
    async update(id, patch) {
      const atual = { ...t.get(id), ...patch };
      t.set(id, atual);
      return { ok: true, data: { ...atual } };
    },
    async remove(id) {
      if (t.__falharProximoRemove) { t.__falharProximoRemove = false; return { ok: false, error: { type: "constraint" } }; }
      if (!t.has(id)) return { ok: false, error: { type: "not_found" } };
      t.delete(id);
      return { ok: true, data: true };
    },
    _forcarFalhaRemove() { t.__falharProximoRemove = true; },
    _table: t,
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

/* =========================================================================
   PARTE 1 — versão ANTIGA (pré-correção do A5): substitui o array inteiro.
   ========================================================================= */
function criarSetGestaoModuleDataAntigo({ repo }) {
  const gestaoDataRef = { current: { imoveis: [{ id: "im1", nome: "Original" }, { id: "im2", nome: "Original2" }] } };
  function setGestaoModuleData(moduleKey, itemsOuDict) {
    const anterior = gestaoDataRef.current;
    const proximoEstado = { ...anterior, [moduleKey]: itemsOuDict };
    gestaoDataRef.current = proximoEstado;
    const anterioresDoModulo = anterior[moduleKey] || [];
    return diffEAplicarLista(repo, "id", anterioresDoModulo, itemsOuDict).then(({ itensFinais, erros }) => {
      if (erros.length > 0) {
        // BUG do A5: substitui o array inteiro pelo snapshot desta chamada,
        // descartando qualquer alteração concorrente feita por outra chamada.
        gestaoDataRef.current = { ...gestaoDataRef.current, [moduleKey]: itensFinais };
      }
    });
  }
  return { setGestaoModuleData, gestaoDataRef };
}

/* =========================================================================
   PARTE 2 — versão NOVA (pós-correção do A5): mescla por id, tocando SÓ os
   ids que realmente tiveram erro nesta chamada (não todos os ids do
   payload) — um id que só "passou junto" no array sem ser alterado nunca
   deveria ser corrigido com o valor antigo que esta chamada tinha dele.
   ========================================================================= */
// Mesma função `mesclarCorrecaoPorId` que passa a existir em
// EstimatorCore.jsx (mirror fiel, ver comentário "CORREÇÃO (Fase 6, achado
// A5)" no arquivo real).
function mesclarCorrecaoPorId(listaAtual, idField, erros, itensFinais) {
  const finalPorId = new Map((itensFinais || []).map((x) => [x[idField], x]));
  const idsComErro = new Set((erros || []).map((e) => e.id).filter((id) => id !== undefined));
  const resultado = [];
  const vistos = new Set();
  for (const item of listaAtual || []) {
    const id = item[idField];
    vistos.add(id);
    if (!idsComErro.has(id)) { resultado.push(item); continue; } // sem erro nesta chamada -> preserva como está (pode já refletir outra operação)
    if (finalPorId.has(id)) resultado.push(finalPorId.get(id)); // reverte/preserva o valor confirmado correspondente a este erro
    // senão: era uma criação que falhou -> corretamente não entra no resultado
  }
  for (const [id, item] of finalPorId) {
    if (idsComErro.has(id) && !vistos.has(id)) resultado.push(item); // exclusão que falhou e o item não estava mais na lista atual -> readiciona
  }
  return resultado;
}

function criarSetGestaoModuleDataNovo({ repo }) {
  const gestaoDataRef = { current: { imoveis: [{ id: "im1", nome: "Original" }, { id: "im2", nome: "Original2" }] } };
  function setGestaoModuleData(moduleKey, itemsOuDict) {
    const anterior = gestaoDataRef.current;
    const proximoEstado = { ...anterior, [moduleKey]: itemsOuDict };
    gestaoDataRef.current = proximoEstado;
    const anterioresDoModulo = anterior[moduleKey] || [];
    return diffEAplicarLista(repo, "id", anterioresDoModulo, itemsOuDict).then(({ itensFinais, erros }) => {
      if (erros.length > 0) {
        // CORREÇÃO A5: mescla por id, no estado ATUAL (que pode já refletir
        // outra operação concorrente), tocando só os ids que ESTA chamada
        // realmente não conseguiu confirmar — nunca substitui o array
        // inteiro.
        const atualAgora = gestaoDataRef.current[moduleKey] || [];
        const mesclado = mesclarCorrecaoPorId(atualAgora, "id", erros, itensFinais);
        gestaoDataRef.current = { ...gestaoDataRef.current, [moduleKey]: mesclado };
      }
    });
  }
  return { setGestaoModuleData, gestaoDataRef };
}

/* =========================================================================
   Cenário exigido: A falha, B (outro registro) tem sucesso.
   ========================================================================= */
async function testeA5_versaoAntigaReproduzOBug() {
  const repo = makeListRepoMock("imoveis-antigo");
  await repo.create({ id: "im1", nome: "Original" });
  await repo.create({ id: "im2", nome: "Original2" });
  const { setGestaoModuleData, gestaoDataRef } = criarSetGestaoModuleDataAntigo({ repo });

  repo._forcarFalhaRemove(); // OPERAÇÃO A vai falhar
  const opA = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Original2" }]); // tenta excluir im1
  const opB = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Editado por B" }]); // edita im2, sucesso
  await Promise.all([opA, opB]);

  const im2NoBanco = repo._table.get("im2").nome;
  const im2NaRef = (gestaoDataRef.current.imoveis || []).find((i) => i.id === "im2")?.nome;

  assert("A5 (versão antiga, referência): banco tem a edição de B confirmada", im2NoBanco === "Editado por B");
  assert(
    "A5 (versão antiga, referência): REPRODUZ o bug — a ref perdeu a edição de B por causa da recuperação de erro de A",
    im2NaRef !== "Editado por B"
  );
}

async function testeA5_versaoNovaPreservaAlteracaoDeB() {
  const repo = makeListRepoMock("imoveis-novo");
  await repo.create({ id: "im1", nome: "Original" });
  await repo.create({ id: "im2", nome: "Original2" });
  const { setGestaoModuleData, gestaoDataRef } = criarSetGestaoModuleDataNovo({ repo });

  repo._forcarFalhaRemove(); // OPERAÇÃO A (exclusão de im1) vai falhar
  const opA = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Original2" }]); // tenta excluir im1
  const opB = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Editado por B" }]); // edita im2, sucesso
  await Promise.all([opA, opB]);

  const im2NoBanco = repo._table.get("im2").nome;
  const im1NoBanco = repo._table.get("im1"); // deveria continuar existindo (exclusão falhou)
  const imoveisNaRefFinal = gestaoDataRef.current.imoveis || [];
  const im1NaRef = imoveisNaRefFinal.find((i) => i.id === "im1");
  const im2NaRef = imoveisNaRefFinal.find((i) => i.id === "im2");

  assert("A5 corrigido: banco tem a edição de B confirmada", im2NoBanco === "Editado por B");
  assert("A5 corrigido: banco ainda tem im1 (exclusão de A falhou de verdade)", !!im1NoBanco);
  assert(
    "A5 corrigido: a REF reflete a edição de B (não foi apagada pela recuperação de erro de A)",
    !!im2NaRef && im2NaRef.nome === "Editado por B"
  );
  assert(
    "A5 corrigido: a REF também reflete que im1 não foi excluído (recuperação de A funcionou, no seu próprio id)",
    !!im1NaRef && im1NaRef.nome === "Original"
  );
  assert("A5 corrigido: nenhum registro extra ou perdido — exatamente 2 imóveis no estado final", imoveisNaRefFinal.length === 2);
}

// Variante adicional: falha em A, sucesso em B, MAS com uma terceira
// operação C concorrente que cria um novo imóvel im3 — garante que a
// mesclagem por id não interfere em ids que nenhuma das operações A/B
// tocou.
async function testeA5_naoInterfereEmOperacaoTerceiraNaoRelacionada() {
  const repo = makeListRepoMock("imoveis-terceira");
  await repo.create({ id: "im1", nome: "Original" });
  await repo.create({ id: "im2", nome: "Original2" });
  const { setGestaoModuleData, gestaoDataRef } = criarSetGestaoModuleDataNovo({ repo });

  repo._forcarFalhaRemove();
  const opA = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Original2" }]); // exclui im1 (falha)
  const opB = setGestaoModuleData("imoveis", [{ id: "im2", nome: "Editado por B" }]); // edita im2 (sucesso)
  // OPERAÇÃO C: cria im3 diretamente na ref, simulando outra chamada
  // concorrente que nem passou pelo diff ainda quando A/B resolveram.
  gestaoDataRef.current = { ...gestaoDataRef.current, imoveis: [...gestaoDataRef.current.imoveis, { id: "im3", nome: "Criado por C" }] };

  await Promise.all([opA, opB]);

  const im3NaRef = (gestaoDataRef.current.imoveis || []).find((i) => i.id === "im3");
  assert("A5 corrigido: operação C (não relacionada) não foi afetada pela mesclagem de A/B", !!im3NaRef && im3NaRef.nome === "Criado por C");
}

/* =========================================================================
   Onboarding (dicionário) — mesmo princípio, testado à parte porque a
   estrutura de dados é diferente (dict, não lista).
   ========================================================================= */
function idOnboarding(imovelId, item) {
  return `onb__${imovelId}__${item}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function makeOnboardingRepoMock() {
  const t = new Map();
  return {
    async update(id, patch) {
      if (t.__falharProximoUpdate === id) { t.__falharProximoUpdate = null; return { ok: false, error: { type: "network" } }; }
      if (!t.has(id)) return { ok: false, error: { type: "not_found" } };
      const atual = { ...t.get(id), ...patch };
      t.set(id, atual);
      return { ok: true, data: atual };
    },
    async create(item) { t.set(item.id, { ...item }); return { ok: true, data: { ...item } }; },
    _forcarFalhaUpdate(id) { t.__falharProximoUpdate = id; },
    _table: t,
  };
}
async function diffEAplicarOnboarding(repo, dictAnterior, dictSeguinte) {
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
        if (criado.ok) { itensFinais[item] = valorSeguinte; } else { erros.push({ tipo: "create", id }); itensFinais[item] = valorAnterior; }
        continue;
      }
      erros.push({ tipo: "update", id });
      itensFinais[item] = valorAnterior;
    }
    if (Object.keys(itensFinais).length > 0) dictFinal[imovelId] = itensFinais;
  }
  return { dictFinal, erros };
}

// Mirror fiel do ramo "onboardingChecklists" corrigido de setGestaoModuleData.
function criarSetOnboardingNovo({ repo }) {
  const gestaoDataRef = { current: { onboardingChecklists: { im1: { "Chave": true }, im2: { "Fotos": false } } } };
  function setOnboarding(itemsOuDict) {
    const anterior = gestaoDataRef.current;
    const proximoEstado = { ...anterior, onboardingChecklists: itemsOuDict };
    gestaoDataRef.current = proximoEstado;
    const dictAnteriorOnboarding = anterior.onboardingChecklists || {};
    return diffEAplicarOnboarding(repo, dictAnteriorOnboarding, itemsOuDict).then(({ dictFinal, erros }) => {
      if (erros.length > 0) {
        const idsComErro = new Set(erros.map((e) => e.id).filter((id) => id !== undefined));
        const dictAtual = gestaoDataRef.current.onboardingChecklists || {};
        const dictCorrigido = { ...dictAtual };
        const imoveisEnvolvidos = new Set([...Object.keys(dictAnteriorOnboarding), ...Object.keys(itemsOuDict || {})]);
        for (const imovelId of imoveisEnvolvidos) {
          const itensAntes = dictAnteriorOnboarding[imovelId] || {};
          const itensDepois = (itemsOuDict && itemsOuDict[imovelId]) || {};
          const chavesDeItens = new Set([...Object.keys(itensAntes), ...Object.keys(itensDepois)]);
          for (const item of chavesDeItens) {
            const id = idOnboarding(imovelId, item);
            if (!idsComErro.has(id)) continue;
            const valorFinal = dictFinal && dictFinal[imovelId] ? dictFinal[imovelId][item] : undefined;
            if (valorFinal === undefined) {
              if (dictCorrigido[imovelId]) { const { [item]: _r, ...resto } = dictCorrigido[imovelId]; dictCorrigido[imovelId] = resto; }
            } else {
              dictCorrigido[imovelId] = { ...dictCorrigido[imovelId], [item]: valorFinal };
            }
          }
        }
        gestaoDataRef.current = { ...gestaoDataRef.current, onboardingChecklists: dictCorrigido };
      }
    });
  }
  return { setOnboarding, gestaoDataRef };
}

async function testeA5_onboardingNaoPerdeAlteracaoDeOutroImovel() {
  const repo = makeOnboardingRepoMock();
  await repo.create({ id: idOnboarding("im1", "Chave"), imovelId: "im1", item: "Chave", concluido: true });
  await repo.create({ id: idOnboarding("im2", "Fotos"), imovelId: "im2", item: "Fotos", concluido: false });
  const { setOnboarding, gestaoDataRef } = criarSetOnboardingNovo({ repo });

  // OPERAÇÃO A: marca im1/Chave como false — vai FALHAR.
  repo._forcarFalhaUpdate(idOnboarding("im1", "Chave"));
  const opA = setOnboarding({ im1: { "Chave": false }, im2: { "Fotos": false } });
  // OPERAÇÃO B: marca im2/Fotos como true — tem SUCESSO.
  const opB = setOnboarding({ im1: { "Chave": false }, im2: { "Fotos": true } });
  await Promise.all([opA, opB]);

  const im2NoBanco = repo._table.get(idOnboarding("im2", "Fotos")).concluido;
  const im2NaRef = gestaoDataRef.current.onboardingChecklists.im2 && gestaoDataRef.current.onboardingChecklists.im2["Fotos"];
  const im1NaRef = gestaoDataRef.current.onboardingChecklists.im1 && gestaoDataRef.current.onboardingChecklists.im1["Chave"];

  assert("A5 onboarding: banco tem a marcação de B confirmada (im2/Fotos = true)", im2NoBanco === true);
  assert("A5 onboarding: a REF reflete a marcação de B (não foi apagada pela recuperação de erro de A)", im2NaRef === true);
  assert("A5 onboarding: a REF reflete que im1/Chave voltou para o valor confirmado (true), já que A falhou", im1NaRef === true);
}

const run = async () => {
  await testeA5_versaoAntigaReproduzOBug();
  await testeA5_versaoNovaPreservaAlteracaoDeB();
  await testeA5_naoInterfereEmOperacaoTerceiraNaoRelacionada();
  await testeA5_onboardingNaoPerdeAlteracaoDeOutroImovel();

  let ok = true;
  for (const [desc, cond] of assertions) { console.log((cond ? "OK  " : "FAIL"), "-", desc); if (!cond) ok = false; }
  console.log(ok ? "\nTODAS AS ASSERCOES DA CORRECAO A5 PASSARAM" : "\nALGUMA ASSERCAO FALHOU");
  if (!ok) process.exit(1);
};
run().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(1); });
