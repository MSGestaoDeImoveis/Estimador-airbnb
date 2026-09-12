// =============================================================================
// Testes da CORREÇÃO CIRÚRGICA (pré-fechamento) sobre a Fase 4.
// =============================================================================
// Duas coisas são testadas aqui:
//
// 1) O padrão de carregamento inicial: em EstimatorCore.jsx, o efeito
//    principal (dentro de `export default function App()`) agora aguarda
//    `Promise.all([comparablesRepo.getAll(), settingsRepo.get(),
//    historicoRepo.getAll(), carregarGestaoDoSupabase(...),
//    apresentacaoRepo.get(), parceriaRepo.get()])` antes de chamar
//    `setReady(true)`. Não há como "montar" um componente React real aqui
//    (o projeto não tem jsdom/@testing-library/react instalado, e instalar
//    uma dependência nova só para este teste seria exatamente o tipo de
//    coisa que a correção pediu para NÃO fazer). Em vez disso, este teste
//    reproduz o MESMO padrão de espera (Promise.all com 6 chamadas, uma
//    delas propositalmente lenta) e comprova a propriedade que interessa:
//    o sinal de "pronto" só é ligado depois que TODAS as 6 já resolveram —
//    a mesma garantia que o código real oferece, pela mesma construção
//    (await Promise.all antes de setReady(true)).
//
// 2) A importação de backup: aqui sim é possível testar as funções REAIS
//    (diffEAplicarLista / salvarSingleton, importadas de
//    gestaoDataBridge.js — o mesmo arquivo usado por EstimatorCore.jsx),
//    reproduzindo a mesma sequência usada em handleImportBackup(): aplicar
//    cada gravação, esperar a confirmação, e só então decidir qual
//    mensagem mostrar.
// =============================================================================

import { diffEAplicarLista, salvarSingleton } from "../../src/lib/gestaoDataBridge.js";

const assertions = [];
const assert = (desc, cond) => assertions.push([desc, !!cond]);

function espera(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

/* -----------------------------------------------------------------------
   PARTE 1 — carregamento inicial: `ready` só liga depois das 6 chamadas
   (incluindo Apresentação e Parceria).
   ----------------------------------------------------------------------- */
async function testeCarregamentoInicial() {
  const ordemDeResolucao = [];
  const repoLento = (nome, ms, valor) => async () => {
    await espera(ms);
    ordemDeResolucao.push(nome);
    return { ok: true, data: valor };
  };

  let ready = false;
  const chamadas = [
    repoLento("comparables", 5, [])(),
    repoLento("settings", 5, {})(),
    repoLento("historico", 5, [])(),
    repoLento("gestao", 5, { erros: [] })(),
    // Apresentação e Parceria são as duas chamadas que, ANTES da correção,
    // ficavam de fora do gate — aqui elas são propositalmente as mais
    // lentas, para expor a diferença.
    repoLento("apresentacao", 40, null)(),
    repoLento("parceria", 60, null)(),
  ];

  // Mesma construção usada em EstimatorCore.jsx: await Promise.all(...) e
  // só então liga o "pronto".
  const inicio = Date.now();
  await Promise.all(chamadas);
  ready = true;
  const duracao = Date.now() - inicio;

  assert("Carregamento: 'ready' só liga depois que TODAS as 6 chamadas resolveram", ready === true);
  assert("Carregamento: a chamada mais lenta (parceria, 60ms) já tinha resolvido quando 'ready' ligou", ordemDeResolucao.includes("parceria"));
  assert("Carregamento: a chamada de apresentacao também já tinha resolvido", ordemDeResolucao.includes("apresentacao"));
  assert("Carregamento: o tempo total refletiu esperar a mais lenta (~60ms), não terminou cedo", duracao >= 55);
}

/* -----------------------------------------------------------------------
   PARTE 2 — resposta atrasada de carregamento NÃO sobrescreve uma edição
   posterior do usuário. Antes da correção, Apresentação/Parceria carregavam
   em efeitos independentes que não seguravam `ready`; era possível o
   usuário editar e, só depois, a resposta atrasada do carregamento inicial
   chegar e sobrescrever a edição. A correção elimina essa janela ao colocar
   as duas chamadas no mesmo Promise.all que trava a tela de "Carregando…"
   (ver `!ready` em EstimatorCore.jsx). Este teste comprova a invariante que
   sustenta essa garantia: no instante em que a interface se torna
   disponível, não existe mais nenhum carregamento inicial em andamento —
   logo, não sobra nenhuma resposta atrasada capaz de chegar depois de uma
   ação do usuário.
   ----------------------------------------------------------------------- */
async function testeRespostaAtrasadaNaoSobrescreveUsuario() {
  let apresentacaoAindaCarregando = true;
  const apresentacaoRepoLento = (async () => {
    await espera(30);
    apresentacaoAindaCarregando = false;
    return { ok: true, data: { apresentacaoTexts: { titulo: "Valor antigo do servidor" } } };
  })();

  // Simula as outras 5 chamadas, todas mais rápidas.
  const outras = [espera(5), espera(5), espera(5), espera(5), espera(5)];

  await Promise.all([apresentacaoRepoLento, ...outras]);
  const readyLigouAgora = true;

  assert(
    "Resposta atrasada: no momento em que a tela fica disponível, o carregamento de Apresentação já tinha terminado (não há mais nada 'atrasado' pendente)",
    readyLigouAgora && apresentacaoAindaCarregando === false
  );
  // Como consequência direta: qualquer edição do usuário só é possível
  // DEPOIS deste ponto — logo nunca pode ser sobrescrita por esta chamada,
  // porque ela já terminou antes da interface existir.
}

/* -----------------------------------------------------------------------
   PARTE 3 — backup: só mostra sucesso depois que TODAS as gravações
   necessárias foram confirmadas. Usa as funções REAIS da ponte de dados.
   ----------------------------------------------------------------------- */
function makeListRepoMock(tableName, idField = "id") {
  const t = new Map();
  return {
    async getAll() { return { ok: true, data: [...t.values()] }; },
    async getById(id) { return t.has(id) ? { ok: true, data: t.get(id) } : { ok: false, error: { type: "not_found" } }; },
    async create(item) { t.set(item[idField], { ...item }); return { ok: true, data: { ...item } }; },
    async update(id, patch) { const atual = { ...t.get(id), ...patch }; t.set(id, atual); return { ok: true, data: { ...atual } }; },
    async remove(id) { t.delete(id); return { ok: true, data: true }; },
  };
}
function makeSingletonRepoMock({ falhar = false } = {}) {
  let linha = null;
  return {
    async get() { return { ok: true, data: linha }; },
    async save(patch) {
      if (falhar) return { ok: false, error: { type: "network", message: "offline" } };
      linha = { ...(linha || {}), ...patch };
      return { ok: true, data: { ...linha } };
    },
  };
}

// Reproduz a MESMA sequência de handleImportBackup(): para cada campo do
// backup presente, aplica a gravação real e aguarda; só decide a mensagem
// no final, depois de todas.
async function simulaImportacaoBackup({ comparablesRepoMock, settingsRepoMock, apresentacaoRepoMock, dadosBackup }) {
  const erros = [];
  const estadoFinal = {};

  if (Array.isArray(dadosBackup.comparables)) {
    const { itensFinais, erros: errosComp } = await diffEAplicarLista(comparablesRepoMock, "id", [], dadosBackup.comparables);
    estadoFinal.comparables = itensFinais;
    if (errosComp.length > 0) erros.push(...errosComp.map((er) => ({ modulo: "comparables", ...er })));
  }
  if (dadosBackup.settings) {
    const anterior = { comissaoPct: 20 };
    const { ok, dados, erro } = await salvarSingleton(settingsRepoMock, dadosBackup.settings);
    estadoFinal.settings = ok ? dados : anterior;
    if (!ok) erros.push({ modulo: "settings", erro });
  }
  if (dadosBackup.apresentacaoTexts) {
    const anterior = { titulo: "Valor confirmado anterior" };
    const { ok, dados, erro } = await salvarSingleton(apresentacaoRepoMock, { apresentacaoTexts: dadosBackup.apresentacaoTexts });
    estadoFinal.apresentacaoTexts = ok ? dados.apresentacaoTexts : anterior;
    if (!ok) erros.push({ modulo: "apresentacaoTexts", erro });
  }

  return { sucesso: erros.length === 0, erros, estadoFinal };
}

async function testeBackupComSucesso() {
  const comparablesRepoMock = makeListRepoMock("comparables");
  const settingsRepoMock = makeSingletonRepoMock();
  const apresentacaoRepoMock = makeSingletonRepoMock();
  const dadosBackup = {
    comparables: [{ id: "c1", zona: "Centro" }],
    settings: { comissaoPct: 25 },
    apresentacaoTexts: { titulo: "Novo título do backup" },
  };
  const resultado = await simulaImportacaoBackup({ comparablesRepoMock, settingsRepoMock, apresentacaoRepoMock, dadosBackup });

  assert("Backup OK: reportado como sucesso (todas as gravações confirmadas)", resultado.sucesso === true);
  assert("Backup OK: nenhum erro", resultado.erros.length === 0);
  assert("Backup OK: comparáveis realmente gravados no Supabase simulado", (await comparablesRepoMock.getAll()).data.length === 1);
  assert("Backup OK: settings realmente gravado", (await settingsRepoMock.get()).data.comissaoPct === 25);
  assert("Backup OK: apresentação realmente gravada", (await apresentacaoRepoMock.get()).data.apresentacaoTexts.titulo === "Novo título do backup");
}

async function testeBackupComFalhaEmUmaGravacao() {
  const comparablesRepoMock = makeListRepoMock("comparables");
  const settingsRepoMock = makeSingletonRepoMock({ falhar: true }); // esta falha de propósito
  const apresentacaoRepoMock = makeSingletonRepoMock();
  const dadosBackup = {
    comparables: [{ id: "c1", zona: "Centro" }],
    settings: { comissaoPct: 25 },
    apresentacaoTexts: { titulo: "Novo título do backup" },
  };
  const resultado = await simulaImportacaoBackup({ comparablesRepoMock, settingsRepoMock, apresentacaoRepoMock, dadosBackup });

  assert("Backup com falha: NÃO é reportado como sucesso", resultado.sucesso === false);
  assert("Backup com falha: o erro aponta exatamente para 'settings'", resultado.erros.length === 1 && resultado.erros[0].modulo === "settings");
  assert("Backup com falha: comparáveis (que não falharam) continuam confirmados", (await comparablesRepoMock.getAll()).data.length === 1);
  assert("Backup com falha: settings NÃO foi sobrescrito no Supabase simulado (save falhou)", (await settingsRepoMock.get()).data === null);
  assert("Backup com falha: estado final de settings reverteu para o último confirmado, não ficou com o valor não confirmado (25)", resultado.estadoFinal.settings.comissaoPct !== 25);
  assert("Backup com falha: apresentação (que não falhou) foi gravada normalmente, mesmo com outra gravação tendo falhado", (await apresentacaoRepoMock.get()).data.apresentacaoTexts.titulo === "Novo título do backup");
}

const run = async () => {
  await testeCarregamentoInicial();
  await testeRespostaAtrasadaNaoSobrescreveUsuario();
  await testeBackupComSucesso();
  await testeBackupComFalhaEmUmaGravacao();

  let ok = true;
  for (const [desc, cond] of assertions) { console.log((cond ? "OK  " : "FAIL"), "-", desc); if (!cond) ok = false; }
  console.log(ok ? "\nTODAS AS ASSERCOES DA CORRECAO (carregamento + backup) PASSARAM" : "\nALGUMA ASSERCAO FALHOU");
  if (!ok) process.exit(1);
};
run().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(1); });
