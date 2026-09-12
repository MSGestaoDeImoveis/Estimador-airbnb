// =============================================================================
// Testes da auditoria preventiva de compatibilidade Frontend → PostgreSQL.
// =============================================================================
// Motivação: erro real em produção, PostgreSQL 22P02 "invalid input syntax
// for type numeric: ''" ao criar um comparável com um número opcional
// vazio. Causa raiz: `appToRow` (supabaseDataMappers.js) nunca conheceu o
// tipo da coluna de destino. A correção (`appToRowSeguro`) converte ""
// para null SÓ nas colunas numéricas/data/referência conhecidas de cada
// tabela — texto, boolean, zero, false, null e jsonb continuam intocados.
//
// Este arquivo testa as funções REAIS de supabaseDataMappers.js (puras,
// sem rede) — o mesmo padrão já usado por test-mappers.mjs (Fase 2).
// =============================================================================

import { appToRow, appToRowSeguro } from "../../src/lib/supabaseDataMappers.js";

const assertions = [];
const assert = (d, c) => assertions.push([d, !!c]);

/* -------------------------------------------------------------------------
   1) Comparável — números opcionais vazios (o bug já confirmado em
   produção) e comparável com todos os números preenchidos.
   ------------------------------------------------------------------------- */
{
  const vazio = appToRowSeguro(
    { id: "c1", zona: "Centro", tipo: "Apartamento", quartos: 2, banheiros: 1, area: "", capacidade: 0, camas: 1, diaria: "", taxaLimpeza: "", nota: "", avaliacoes: "", ocupacaoObservada: "", dataPesquisa: "2026-09-12", superhost: false, diferenciais: "" },
    "comparables"
  );
  assert("Comparável com números vazios: area -> null", vazio.area === null);
  assert("Comparável com números vazios: diaria -> null", vazio.diaria === null);
  assert("Comparável com números vazios: taxa_limpeza -> null", vazio.taxa_limpeza === null);
  assert("Comparável com números vazios: nota -> null", vazio.nota === null);
  assert("Comparável com números vazios: avaliacoes -> null", vazio.avaliacoes === null);
  assert("Comparável: capacidade 0 continua 0 (zero não é 'vazio')", vazio.capacidade === 0);
  assert("Comparável: ocupacao_observada é TEXT — '' permanece '' (não convertido)", vazio.ocupacao_observada === "");
  assert("Comparável: diferenciais (texto) '' permanece ''", vazio.diferenciais === "");
  assert("Comparável: superhost false permanece false", vazio.superhost === false);

  const preenchido = appToRowSeguro(
    { id: "c2", zona: "Centro", quartos: 2, banheiros: 1, area: 65, capacidade: 4, camas: 2, diaria: 250, taxaLimpeza: 80, nota: 4.8, avaliacoes: 120, dataPesquisa: "2026-09-12" },
    "comparables"
  );
  assert("Comparável com todos os números preenchidos: nenhum vira null", Object.values(preenchido).every((v) => v !== null));
  assert("Comparável preenchido: area continua 65", preenchido.area === 65);
}

/* -------------------------------------------------------------------------
   2) Edição de comparável limpando um número (estado anterior preenchido,
   novo estado com o campo vazio).
   ------------------------------------------------------------------------- */
{
  const patch = appToRowSeguro({ area: "", diaria: 250 }, "comparables"); // limpou area, manteve diaria
  assert("Edição: campo limpo (area) vira null", patch.area === null);
  assert("Edição: campo não tocado (diaria) permanece com o valor enviado", patch.diaria === 250);
}

/* -------------------------------------------------------------------------
   3) Gestão de Imóveis — números opcionais vazios e preenchidos (imóvel).
   ------------------------------------------------------------------------- */
{
  const vazio = appToRowSeguro({ id: "im1", nome: "Studio", quartos: "", banheiros: "", camas: "", capacidade: "", percentualComissao: "" }, "imoveis");
  assert("Imóvel com números vazios: quartos -> null", vazio.quartos === null);
  assert("Imóvel com números vazios: percentual_comissao -> null", vazio.percentual_comissao === null);

  const preenchido = appToRowSeguro({ id: "im2", nome: "Studio 2", quartos: 2, banheiros: 1, camas: 2, capacidade: 4, percentualComissao: 20 }, "imoveis");
  assert("Imóvel com números preenchidos: nenhum vira null", [preenchido.quartos, preenchido.banheiros, preenchido.camas, preenchido.capacidade, preenchido.percentual_comissao].every((v) => v !== null));
}

/* -------------------------------------------------------------------------
   4) Reservas — valores/taxas vazios e datas vazias.
   ------------------------------------------------------------------------- */
{
  const row = appToRowSeguro({ id: "r1", imovelId: "im1", checkin: "", checkout: "", valor: "", taxas: "" }, "reservas");
  assert("Reserva com valores vazios: valor -> null", row.valor === null);
  assert("Reserva com valores vazios: taxas -> null", row.taxas === null);
  assert("Reserva com datas vazias: checkin -> null", row.checkin === null);
  assert("Reserva com datas vazias: checkout -> null", row.checkout === null);

  const preenchida = appToRowSeguro({ id: "r2", imovelId: "im1", checkin: "2026-10-01", checkout: "2026-10-05", valor: 1000, taxas: 50 }, "reservas");
  assert("Reserva preenchida: datas e valores preservados", preenchida.checkin === "2026-10-01" && preenchida.valor === 1000);
}

/* -------------------------------------------------------------------------
   5) Módulos com campos de referência (FK) vazios e preenchidos.
   ------------------------------------------------------------------------- */
{
  const semRefs = appToRowSeguro({ id: "l1", imovelId: "im1", reservaId: "" }, "limpeza");
  assert("Limpeza: reservaId (FK opcional) vazio -> null", semRefs.reserva_id === null);
  assert("Limpeza: imovelId preenchido preservado", semRefs.imovel_id === "im1");

  const semImovel = appToRowSeguro({ id: "m1", imovelId: "", prestadorId: "" }, "manutencao");
  assert("Manutenção: imovelId (FK opcional) vazio -> null", semImovel.imovel_id === null);
  assert("Manutenção: prestadorId (FK opcional) vazio -> null", semImovel.prestador_id === null);

  const comRefs = appToRowSeguro({ id: "co1", imovelId: "im1", reservaId: "r1", financeiroId: "f1" }, "comissoes");
  assert("Comissão com referências preenchidas: todas preservadas", comRefs.imovel_id === "im1" && comRefs.reserva_id === "r1" && comRefs.financeiro_id === "f1");
}

/* -------------------------------------------------------------------------
   6) Manutenção / Enxoval / Lavanderia — números vazios.
   ------------------------------------------------------------------------- */
{
  const manut = appToRowSeguro({ id: "m2", custo: "" }, "manutencao");
  assert("Manutenção: custo vazio -> null", manut.custo === null);

  const enx = appToRowSeguro({ id: "e1", quantidadeNecessaria: "", quantidadeAtual: 0, estoqueMinimo: "" }, "enxoval");
  assert("Enxoval: quantidade_necessaria vazio -> null", enx.quantidade_necessaria === null);
  assert("Enxoval: quantidade_atual 0 continua 0", enx.quantidade_atual === 0);
  assert("Enxoval: estoque_minimo vazio -> null", enx.estoque_minimo === null);

  const lav = appToRowSeguro({ id: "lv1", quantidade: "", envio: "", recebimento: "" }, "lavanderia");
  assert("Lavanderia: quantidade vazia -> null", lav.quantidade === null);
  assert("Lavanderia: datas vazias -> null", lav.envio === null && lav.recebimento === null);
}

/* -------------------------------------------------------------------------
   7) Financeiro / Comissões / Repasses — campos numéricos vazios.
   ------------------------------------------------------------------------- */
{
  const fin = appToRowSeguro({ id: "f1", valor: "", data: "" }, "financeiro");
  assert("Financeiro: valor vazio -> null", fin.valor === null);
  assert("Financeiro: data vazia -> null", fin.data === null);

  const com = appToRowSeguro({ id: "co2", receita: "", percentual: "" }, "comissoes");
  assert("Comissão: receita/percentual vazios -> null", com.receita === null && com.percentual === null);

  const rep = appToRowSeguro({ id: "rep1", receita: "", despesas: 0, comissao: "" }, "repasses");
  assert("Repasse: receita vazia -> null", rep.receita === null);
  assert("Repasse: despesas 0 continua 0", rep.despesas === 0);

  const repP = appToRowSeguro({ id: "rp1", comissaoRecebida: "", valorParticipacao: "" }, "repasses_parceiros");
  assert("Repasse a parceiro: comissaoRecebida/valorParticipacao vazios -> null", repP.comissao_recebida === null && repP.valor_participacao === null);
}

/* -------------------------------------------------------------------------
   8) Preservação de valores que NÃO são "vazios": string continua string
   em coluna text; zero continua zero; false continua false; null continua
   null.
   ------------------------------------------------------------------------- */
{
  const row = appToRowSeguro(
    { id: "p1", nome: "Fulano", telefone: "", observacoes: "" },
    "proprietarios" // tabela sem nenhuma coluna especial no mapa
  );
  assert("String vazia em coluna text (proprietarios.telefone) continua ''", row.telefone === "");
  assert("String vazia em coluna text (proprietarios.observacoes) continua ''", row.observacoes === "");

  const numerico = appToRowSeguro({ id: "e2", quantidadeAtual: 0 }, "enxoval");
  assert("Zero continua zero (não vira null)", numerico.quantidade_atual === 0);

  const booleano = appToRowSeguro({ id: "onb1", concluido: false }, "onboarding_checklist_itens");
  assert("false continua false", booleano.concluido === false);

  const comNull = appToRowSeguro({ id: "im3", parceiroId: null }, "imoveis");
  assert("null explícito continua null (não é alterado nem 'corrigido' de novo)", comNull.parceiro_id === null);
}

/* -------------------------------------------------------------------------
   9) JSONB continua exatamente no formato atual (settings/histórico) —
   nenhum conteúdo interno é tocado, mesmo que tenha uma "" lá dentro.
   ------------------------------------------------------------------------- */
{
  const settingsRow = appToRowSeguro({ comissaoPct: 20, costs: { agua: 50, gas: "" }, adjustments: {} }, "settings");
  assert("settings.costs (jsonb) preservado sem alteração de conteúdo interno", JSON.stringify(settingsRow.costs) === JSON.stringify({ agua: 50, gas: "" }));

  const historicoRow = appToRowSeguro({ target: { quartos: "" }, result: { ok: true } }, "historico_analises");
  assert("historico.target (jsonb) preserva '' interno sem alteração", historicoRow.target.quartos === "");
}

/* -------------------------------------------------------------------------
   10) Tabela sem nenhuma coluna especial no mapa: appToRowSeguro produz
   exatamente o mesmo resultado que o appToRow original — nenhuma
   conversão genérica indiscriminada.
   ------------------------------------------------------------------------- */
{
  const obj = { id: "pa1", nome: "Corretor", empresa: "", telefone: "" };
  const antigo = appToRow(obj);
  const novo = appToRowSeguro(obj, "parceiros");
  assert("Tabela sem colunas especiais: appToRowSeguro === appToRow (nenhuma diferença)", JSON.stringify(antigo) === JSON.stringify(novo));
}

const run = () => {
  let ok = true;
  for (const [d, c] of assertions) { console.log((c ? "OK  " : "FAIL"), "-", d); if (!c) ok = false; }
  console.log(ok ? `\n${assertions.length} asserções — TODAS PASSARAM` : "\nALGUMA ASSERCAO FALHOU");
  if (!ok) process.exit(1);
};
run();
