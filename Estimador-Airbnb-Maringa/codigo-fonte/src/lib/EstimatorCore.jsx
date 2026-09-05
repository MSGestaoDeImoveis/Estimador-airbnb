import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MS_LOGO_DATA_URI } from "./logo.js";

/* =========================================================================
   TOKENS / CONSTANTS
   ========================================================================= */

const PADRAO_ORDER = ["Econômico", "Médio", "Superior", "Premium"];
const AMENITY_KEYS = [
  "garagem", "elevador", "varanda", "piscina", "academia",
  "arCondicionado", "maquinaLavar", "espacoTrabalho",
];
const AMENITY_LABELS = {
  garagem: "Garagem", elevador: "Elevador", varanda: "Varanda",
  piscina: "Piscina", academia: "Academia", arCondicionado: "Ar-condicionado",
  maquinaLavar: "Máquina de lavar", espacoTrabalho: "Espaço de trabalho",
};

const DEFAULT_ADJUSTMENTS = {
  garagem: 5, arCondicionado: 5, varanda: 3, piscina: 8, academia: 5,
  vista: 5, localizacaoExcepcional: 8, mobiliarioSuperior: 10,
  espacoTrabalho: 3, maquinaLavar: 3, acabamentoSuperior: 8,
  semGaragem: -4, semElevador: -3, mobiliarioInferior: -8,
  imovelAntigo: -5, localizacaoMenosConveniente: -6, poucasComodidades: -5,
};

const ADJUSTMENT_LABELS = {
  garagem: "Garagem", arCondicionado: "Ar-condicionado", varanda: "Varanda",
  piscina: "Piscina", academia: "Academia", vista: "Vista diferenciada",
  localizacaoExcepcional: "Localização excepcional",
  mobiliarioSuperior: "Mobiliário superior", espacoTrabalho: "Espaço de trabalho",
  maquinaLavar: "Máquina de lavar", acabamentoSuperior: "Acabamento superior",
  semGaragem: "Sem garagem", semElevador: "Sem elevador (prédio alto)",
  mobiliarioInferior: "Mobiliário inferior", imovelAntigo: "Imóvel antigo/desgastado",
  localizacaoMenosConveniente: "Localização menos conveniente",
  poucasComodidades: "Poucas comodidades",
};

const DEFAULT_COSTS = {
  taxaPlataforma: { tipo: "percentual", valor: 4, label: "Taxa da plataforma" },
  limpeza: { tipo: "porCheckout", valor: 100, label: "Limpeza" },
  lavanderia: { tipo: "porCheckout", valor: 35, label: "Lavanderia" },
  energia: { tipo: "fixo", valor: 250, label: "Energia" },
  internet: { tipo: "fixo", valor: 100, label: "Internet" },
  agua: { tipo: "fixo", valor: 90, label: "Água" },
  gas: { tipo: "fixo", valor: 50, label: "Gás" },
  iptu: { tipo: "fixo", valor: 75, label: "IPTU" },
  seguroResidencial: { tipo: "fixo", valor: 30, label: "Seguro residencial" },
  manutencao: { tipo: "fixo", valor: 120, label: "Manutenção" },
  reposicao: { tipo: "fixo", valor: 100, label: "Reposição" },
  imprevistosOperacionais: { tipo: "fixo", valor: 70, label: "Imprevistos operacionais" },
};

const DEFAULT_SETTINGS = {
  adjustments: DEFAULT_ADJUSTMENTS,
  costs: DEFAULT_COSTS,
  comissaoPct: 20,
  comissaoBase: "bruta",
  ocupacaoPadrao: { conservador: 45, provavel: 55, otimista: 65 },
  noitesMes: 30,
  duracaoMediaEstadia: 3,
};

const EMPTY_TARGET = {
  zona: "", bairro: "", regiao: "",
  tipo: "Apartamento", quartos: 1, banheiros: 1, area: "", capacidade: 2, camas: 1,
  garagem: false, elevador: false, varanda: false, piscina: false, academia: false,
  arCondicionado: false, maquinaLavar: false, espacoTrabalho: false, mobiliado: true,
  padrao: "Médio",
  mobiliarioNivel: "padrao", // padrao | superior | inferior
  vistaDiferenciada: false, localizacaoExcepcional: false,
  localizacaoMenosConveniente: false, acabamentoSuperior: false,
  imovelAntigo: false, poucasComodidades: false,
  linkAnuncio: "", aluguelTradicional: "", observacoes: "",
  // NOVO — condomínio e custos específicos do imóvel
  portaria: "semPortaria", // semPortaria | eletronica | 24h
  aguaInclusaCondominio: false, gasInclusoCondominio: false,
  condominioManual: "", usarCondominioManual: false,
};

// NOVO — normaliza settings carregados do armazenamento local, preenchendo
// com os novos custos padrão qualquer chave que ainda não exista (ex.: usuários
// que já tinham "settings" salvos antes desta atualização), sem apagar nenhum
// valor já personalizado pelo usuário.
function normalizeSettings(saved) {
  if (!saved) return DEFAULT_SETTINGS;
  const costs = { ...DEFAULT_COSTS, ...(saved.costs || {}) };
  return { ...DEFAULT_SETTINGS, ...saved, costs };
}

/* =========================================================================
   MATH HELPERS
   ========================================================================= */

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function toNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function fmtMoney(v) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtMoneyRange(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  if (Math.round(a) === Math.round(b)) return fmtMoney(a);
  return `${fmtMoney(a)} – ${fmtMoney(b)}`;
}
function fmtPct(v, digits = 0) {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff;
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}
// weighted percentile over pairs [{value, weight}]
function weightedPercentile(pairs, p) {
  const valid = pairs.filter((x) => Number.isFinite(x.value) && x.weight > 0);
  if (!valid.length) return NaN;
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  const totalW = sorted.reduce((s, x) => s + x.weight, 0);
  let cum = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prevCum = cum;
    cum += sorted[i].weight;
    const frac = cum / totalW;
    if (frac >= p) {
      // linear interpolate within this bucket's boundary using previous point when possible
      if (i === 0) return sorted[i].value;
      const prevFrac = prevCum / totalW;
      const t = (p - prevFrac) / (frac - prevFrac || 1);
      return sorted[i - 1].value + t * (sorted[i].value - sorted[i - 1].value);
    }
  }
  return sorted[sorted.length - 1].value;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

// NOVO — código único por análise, formato MS-YYYYMMDD-XXXX (fácil de
// pesquisar). Confere contra os códigos já existentes no Histórico e
// regenera o sufixo em caso de colisão (extremamente raro).
function generateAnalysisCode(existingCodes) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem caracteres ambíguos (0/O, 1/I)
  let code;
  do {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    code = `MS-${ymd}-${suffix}`;
  } while (existingCodes.includes(code));
  return code;
}

/* =========================================================================
   SCORING
   ========================================================================= */

function locationScore(comp, target) {
  if (target.zona && comp.zona && comp.zona.trim().toLowerCase() === target.zona.trim().toLowerCase()) return 100;
  if (target.regiao && comp.regiao && comp.regiao === target.regiao) return 55;
  return 15;
}
function quartosScore(comp, target) {
  const diff = Math.abs(toNum(comp.quartos) - toNum(target.quartos));
  if (diff === 0) return 100;
  if (diff === 1) return 65;
  if (diff === 2) return 35;
  return 10;
}
function areaScore(comp, target) {
  const a = toNum(comp.area), b = toNum(target.area);
  if (!a || !b) return 50;
  const diffPct = Math.abs(a - b) / b;
  return clamp(100 - diffPct * 150, 0, 100);
}
function capScore(comp, target) {
  const diff = Math.abs(toNum(comp.capacidade) - toNum(target.capacidade));
  if (diff === 0) return 100;
  if (diff === 1) return 70;
  if (diff === 2) return 40;
  return 15;
}
function padraoScore(comp, target) {
  const i1 = PADRAO_ORDER.indexOf(comp.padrao), i2 = PADRAO_ORDER.indexOf(target.padrao);
  if (i1 < 0 || i2 < 0) return 50;
  const diff = Math.abs(i1 - i2);
  if (diff === 0) return 100;
  if (diff === 1) return 55;
  return 20;
}
function amenityScore(comp, target) {
  let matches = 0;
  AMENITY_KEYS.forEach((k) => { if (!!comp[k] === !!target[k]) matches++; });
  return (matches / AMENITY_KEYS.length) * 100;
}
function qualityScore(comp) {
  if (comp.nota) return clamp((toNum(comp.nota) / 5) * 100, 0, 100);
  return 60;
}
function computeScore(comp, target) {
  const loc = locationScore(comp, target);
  const qt = quartosScore(comp, target);
  const ar = areaScore(comp, target);
  const cap = capScore(comp, target);
  const pad = padraoScore(comp, target);
  const am = amenityScore(comp, target);
  const ql = qualityScore(comp);
  const outros = 70; // fator qualitativo (diferenciais textuais) — não comparável automaticamente
  const total = loc * 0.30 + qt * 0.20 + ar * 0.10 + cap * 0.10 + pad * 0.10 + am * 0.10 + ql * 0.05 + outros * 0.05;
  return { total: Math.round(total), parts: { loc, qt, ar, cap, pad, am, ql, outros } };
}

function pickComparables(comparables, target, excludedIds, maxN = 8, minScore = 40) {
  const scored = comparables
    .filter((c) => !excludedIds.includes(c.id))
    .map((c) => ({ comp: c, score: computeScore(c, target) }))
    .sort((a, b) => b.score.total - a.score.total);
  let chosen = scored.filter((s) => s.score.total >= minScore).slice(0, maxN);
  if (chosen.length < 3) chosen = scored.slice(0, Math.min(maxN, scored.length));
  return chosen;
}

/* =========================================================================
   CONDOMÍNIO — estimativa automática por imóvel
   (NOVO — o condomínio não é um custo fixo global: depende das
   características do imóvel analisado, por isso vive fora de DEFAULT_COSTS
   e é calculado individualmente para cada `target`.)
   ========================================================================= */

function estimateCondominio(target) {
  const tipo = target.tipo;
  let valor;

  if (tipo === "Apartamento") {
    valor = 250;
    if (target.garagem) valor += 30;
    if (target.elevador) valor += 50;
    if (target.academia) valor += 70;
    if (target.piscina) valor += 100;
  } else if (tipo === "Kitnet/Studio") {
    // Tratado como apartamento compacto: base menor, mesmos ajustes
    // estruturais (exceto garagem, pouco comum nesse perfil).
    valor = 200;
    if (target.elevador) valor += 50;
    if (target.academia) valor += 70;
    if (target.piscina) valor += 100;
  } else if (tipo === "Casa de condomínio") {
    // Casa de condomínio tem taxa própria — não é R$ 0 automático.
    valor = 250;
    if (target.garagem) valor += 30;
    if (target.academia) valor += 70;
    if (target.piscina) valor += 100;
  } else if (tipo === "Casa") {
    // Por enquanto, casas (fora de condomínio) são tratadas sem condomínio.
    valor = 0;
  } else {
    // "Outro" ou tipo não mapeado: lógica conservadora, sem estimativa artificial.
    valor = 0;
  }

  if (tipo === "Apartamento" || tipo === "Kitnet/Studio" || tipo === "Casa de condomínio") {
    switch (target.padrao) {
      case "Econômico": valor -= 50; break;
      case "Superior": valor += 100; break;
      case "Premium": valor += 200; break;
      default: break;
    }
    switch (target.portaria) {
      case "eletronica": valor += 40; break;
      case "24h": valor += 200; break;
      default: break;
    }
  }

  return Math.max(0, valor);
}

// Centraliza a escolha entre a estimativa automática e o valor real informado
// pelo usuário, para não duplicar essa lógica em nenhum outro lugar do código.
function getCondominio(target) {
  if (target.usarCondominioManual && toNum(target.condominioManual, -1) >= 0) {
    return toNum(target.condominioManual, 0);
  }
  return estimateCondominio(target);
}

/* =========================================================================
   ANALYSIS ENGINE
   ========================================================================= */

function runAnalysis(target, comparables, settings, excludedIds) {
  const chosen = pickComparables(comparables, target, excludedIds || []);
  const alerts = [];

  if (chosen.length === 0) {
    return { chosen: [], alerts: ["⚠️ Nenhum comparável cadastrado ainda. Cadastre imóveis na Base de Comparáveis antes de analisar."], empty: true };
  }
  if (chosen.length < 5) alerts.push(`⚠️ Apenas ${chosen.length} comparável(is) encontrado(s). A estimativa possui confiança reduzida.`);

  const diarias = chosen.map((c) => ({ value: toNum(c.comp.diaria), weight: c.score.total }));
  const conservadorBase = weightedPercentile(diarias, 0.25);
  const provavelBase = weightedPercentile(diarias, 0.50);
  const otimistaBase = weightedPercentile(diarias, 0.75);

  // adjustments
  const adj = settings.adjustments;
  const applied = [];
  const addIf = (cond, key) => { if (cond && adj[key]) applied.push({ key, label: ADJUSTMENT_LABELS[key], pct: adj[key] }); };
  addIf(target.garagem, "garagem");
  addIf(!target.garagem, "semGaragem");
  addIf(target.arCondicionado, "arCondicionado");
  addIf(target.varanda, "varanda");
  addIf(target.piscina, "piscina");
  addIf(target.academia, "academia");
  addIf(!target.elevador, "semElevador");
  addIf(target.espacoTrabalho, "espacoTrabalho");
  addIf(target.maquinaLavar, "maquinaLavar");
  addIf(target.mobiliarioNivel === "superior", "mobiliarioSuperior");
  addIf(target.mobiliarioNivel === "inferior", "mobiliarioInferior");
  addIf(target.vistaDiferenciada, "vista");
  addIf(target.localizacaoExcepcional, "localizacaoExcepcional");
  addIf(target.localizacaoMenosConveniente, "localizacaoMenosConveniente");
  addIf(target.acabamentoSuperior, "acabamentoSuperior");
  addIf(target.imovelAntigo, "imovelAntigo");
  addIf(target.poucasComodidades, "poucasComodidades");

  const totalAdjPct = applied.reduce((s, a) => s + a.pct, 0);
  const factor = 1 + totalAdjPct / 100;
  const conservador = conservadorBase * factor;
  const provavel = provavelBase * factor;
  const otimista = otimistaBase * factor;
  const recomendada = provavel;

  // occupancy
  const ocupComps = chosen.filter((c) => c.comp.ocupacaoObservada);
  let ocup, ocupIsHypothesis = true;
  if (ocupComps.length >= 3) {
    const pairs = ocupComps.map((c) => ({ value: toNum(c.comp.ocupacaoObservada), weight: c.score.total }));
    const p = weightedPercentile(pairs, 0.5);
    ocup = { conservador: clamp(p - 10, 5, 95), provavel: clamp(p, 5, 95), otimista: clamp(p + 10, 5, 95) };
    ocupIsHypothesis = false;
  } else {
    ocup = { ...settings.ocupacaoPadrao };
    alerts.push("ℹ️ Não há dados suficientes de ocupação na base. Usando premissa configurável (ajustável em Configurações), não um dado observado.");
  }

  const noites = settings.noitesMes;
  const scenario = (diaria, ocupPct) => {
    const noitesOcupadas = noites * (ocupPct / 100);
    const receita = diaria * noitesOcupadas;
    return { diaria, ocupPct, noitesOcupadas, receita };
  };
  const scenarios = {
    conservador: scenario(conservador, ocup.conservador),
    provavel: scenario(provavel, ocup.provavel),
    otimista: scenario(otimista, ocup.otimista),
  };

  // costs (computed on "provável" scenario, and also for conservador/otimista for completeness)
  function computeCosts(receita, noitesOcupadas, target) {
    const c = settings.costs;
    const checkouts = noitesOcupadas / Math.max(settings.duracaoMediaEstadia, 1);
    const taxaPlataforma = c.taxaPlataforma.tipo === "percentual" ? receita * (c.taxaPlataforma.valor / 100) : toNum(c.taxaPlataforma.valor);
    const limpeza = c.limpeza.tipo === "porCheckout" ? checkouts * c.limpeza.valor : toNum(c.limpeza.valor);
    const lavanderia = c.lavanderia.tipo === "porCheckout" ? checkouts * c.lavanderia.valor : toNum(c.lavanderia.valor);
    const energia = toNum(c.energia.valor);
    const internet = toNum(c.internet.valor);
    // Água e gás: zerados quando já estão inclusos no condomínio, para não cobrar em duplicidade.
    const agua = target.aguaInclusaCondominio ? 0 : toNum(c.agua.valor);
    const gas = target.gasInclusoCondominio ? 0 : toNum(c.gas.valor);
    const condominio = getCondominio(target);
    const iptu = toNum(c.iptu.valor);
    const seguroResidencial = toNum(c.seguroResidencial.valor);
    const manutencao = toNum(c.manutencao.valor);
    const reposicao = toNum(c.reposicao.valor);
    const imprevistosOperacionais = toNum(c.imprevistosOperacionais.valor);
    const total = taxaPlataforma + limpeza + lavanderia + energia + internet + agua + gas
      + condominio + iptu + seguroResidencial + manutencao + reposicao + imprevistosOperacionais;
    return {
      taxaPlataforma, limpeza, lavanderia, energia, internet, agua, gas, condominio,
      iptu, seguroResidencial, manutencao, reposicao, imprevistosOperacionais,
      total, checkouts,
    };
  }

  const costsByScenario = {
    conservador: computeCosts(scenarios.conservador.receita, scenarios.conservador.noitesOcupadas, target),
    provavel: computeCosts(scenarios.provavel.receita, scenarios.provavel.noitesOcupadas, target),
    otimista: computeCosts(scenarios.otimista.receita, scenarios.otimista.noitesOcupadas, target),
  };

  function computeCommission(receita, custosTotal) {
    const base = settings.comissaoBase === "liquida" ? Math.max(receita - custosTotal, 0) : receita;
    return base * (settings.comissaoPct / 100);
  }
  const commissionByScenario = {
    conservador: computeCommission(scenarios.conservador.receita, costsByScenario.conservador.total),
    provavel: computeCommission(scenarios.provavel.receita, costsByScenario.provavel.total),
    otimista: computeCommission(scenarios.otimista.receita, costsByScenario.otimista.total),
  };
  const ownerResultByScenario = {
    conservador: scenarios.conservador.receita - costsByScenario.conservador.total - commissionByScenario.conservador,
    provavel: scenarios.provavel.receita - costsByScenario.provavel.total - commissionByScenario.provavel,
    otimista: scenarios.otimista.receita - costsByScenario.otimista.total - commissionByScenario.otimista,
  };
  const annualProvavel = scenarios.provavel.receita * 12;

  // traditional rent comparison
  let comparison = null;
  const aluguel = toNum(target.aluguelTradicional);
  if (aluguel > 0) {
    const diff = ownerResultByScenario.provavel - aluguel;
    comparison = { aluguel, resultado: ownerResultByScenario.provavel, diff, diffPct: (diff / aluguel) * 100, melhor: diff >= 0 };
  }

  // confidence
  const avgScore = mean(chosen.map((c) => c.score.total));
  const diariaVals = chosen.map((c) => toNum(c.comp.diaria));
  const cv = diariaVals.length > 1 ? stdev(diariaVals) / mean(diariaVals) : 0;
  const avgAge = mean(chosen.map((c) => daysSince(c.comp.dataPesquisa)).filter((d) => d !== null));

  const level = (v, highT, medT, inverse) => {
    if (inverse) return v <= highT ? "Alta" : v <= medT ? "Média" : "Baixa";
    return v >= highT ? "Alta" : v >= medT ? "Média" : "Baixa";
  };
  const nLevel = level(chosen.length, 8, 5, false);
  const scoreLevel = level(avgScore, 80, 60, false);
  const dispersionLevel = level(cv, 0.15, 0.30, true);
  const recencyLevel = Number.isFinite(avgAge) ? level(avgAge, 30, 90, true) : "Baixa";
  const ocupLevel = ocupIsHypothesis ? "Baixa" : "Alta";
  const levels = [nLevel, scoreLevel, dispersionLevel, recencyLevel, ocupLevel];
  const overall = levels.includes("Baixa") ? "Baixa" : levels.includes("Média") ? "Média" : "Alta";

  if (cv > 0.30) alerts.push("⚠️ A faixa de diárias entre os comparáveis está muito dispersa — os imóveis podem não ser suficientemente parecidos.");
  if (Number.isFinite(avgAge) && avgAge > 90) alerts.push(`⚠️ Os dados dos comparáveis usados têm em média ${Math.round(avgAge)} dias. Considere atualizar a base.`);
  if (avgScore < 60) alerts.push("⚠️ Os comparáveis disponíveis têm baixa similaridade com este imóvel. Trate a estimativa com cautela.");
  const targetArea = toNum(target.area);
  const compAreas = chosen.map((c) => toNum(c.comp.area)).filter(Boolean);
  if (targetArea && compAreas.length) {
    const m = mean(compAreas), sd = stdev(compAreas) || 1;
    if (Math.abs(targetArea - m) > 2.5 * sd) alerts.push("⚠️ A área informada está bem fora do padrão observado nos comparáveis desta região/perfil.");
  }

  return {
    chosen, alerts, empty: false,
    diaria: { conservador, provavel, otimista, recomendada, conservadorBase, provavelBase, otimistaBase },
    adjustments: { applied, totalAdjPct },
    ocupacao: { ...ocup, isHypothesis: ocupIsHypothesis },
    scenarios, costsByScenario, commissionByScenario, ownerResultByScenario, annualProvavel,
    comparison,
    confidence: { overall, nLevel, scoreLevel, dispersionLevel, recencyLevel, ocupLevel, avgScore, cv, avgAge, n: chosen.length },
  };
}

/* =========================================================================
   REFERENCE BANK (aggregation)
   ========================================================================= */

function areaFaixa(area) {
  const a = toNum(area);
  if (!a) return "—";
  if (a < 30) return "<30m²";
  if (a < 50) return "30–50m²";
  if (a < 80) return "50–80m²";
  if (a < 120) return "80–120m²";
  return "120m²+";
}
function buildReferenceGroups(comparables) {
  const groups = {};
  comparables.forEach((c) => {
    const key = `${c.zona || "—"}|${c.quartos}q|${areaFaixa(c.area)}|${c.padrao}`;
    if (!groups[key]) groups[key] = { zona: c.zona || "—", quartos: c.quartos, faixaArea: areaFaixa(c.area), padrao: c.padrao, items: [] };
    groups[key].items.push(c);
  });
  return Object.values(groups).map((g) => {
    const diarias = g.items.map((i) => toNum(i.diaria)).filter((v) => v > 0);
    const ocupacoes = g.items.map((i) => toNum(i.ocupacaoObservada)).filter((v) => v > 0);
    const sortedD = [...diarias].sort((a, b) => a - b);
    const med = sortedD.length ? (sortedD.length % 2 ? sortedD[(sortedD.length - 1) / 2]
      : (sortedD[sortedD.length / 2 - 1] + sortedD[sortedD.length / 2]) / 2) : NaN;
    const scored = g.items.map((i) => ({ score: 70 })); // neutral weight for aggregate view
    const mediaPond = mean(diarias);
    const confN = diarias.length >= 8 ? "Alta" : diarias.length >= 5 ? "Média" : "Baixa";
    return {
      ...g,
      n: g.items.length,
      min: diarias.length ? Math.min(...diarias) : NaN,
      max: diarias.length ? Math.max(...diarias) : NaN,
      mediana: med,
      media: mediaPond,
      ocupacaoRef: ocupacoes.length ? mean(ocupacoes) : null,
      confianca: confN,
    };
  }).sort((a, b) => (a.zona > b.zona ? 1 : -1));
}

/* =========================================================================
   DEMO DATA  — DADOS DE DEMONSTRAÇÃO — SUBSTITUIR POR DADOS REAIS
   ========================================================================= */

function demoComp(o) {
  return {
    id: uid(), demo: true,
    zona: "", bairro: "", regiao: "",
    tipo: "Apartamento", quartos: 1, banheiros: 1, area: 40, capacidade: 2, camas: 1,
    garagem: false, elevador: false, varanda: false, piscina: false, academia: false,
    arCondicionado: false, maquinaLavar: false, espacoTrabalho: false, mobiliado: true,
    padrao: "Médio", diaria: 200, taxaLimpeza: 80, nota: 4.6, avaliacoes: 20, superhost: false,
    ocupacaoObservada: "", diferenciais: "", dataPesquisa: "2026-08-01", link: "",
    ...o,
  };
}

const DEMO_COMPARABLES = [
  // Zona 07 (10 itens) — região "Sul"
  demoComp({ zona: "Zona 07", bairro: "Rua Pioneiro Miguel Culpi", regiao: "Sul", quartos: 1, area: 32, capacidade: 2, camas: 1, garagem: false, arCondicionado: true, padrao: "Econômico", diaria: 160, nota: 4.3, avaliacoes: 12, dataPesquisa: "2026-08-10" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Bono Bini", regiao: "Sul", quartos: 1, area: 38, capacidade: 2, camas: 1, garagem: true, arCondicionado: true, padrao: "Médio", diaria: 205, nota: 4.7, avaliacoes: 34, dataPesquisa: "2026-08-05" }),
  demoComp({ zona: "Zona 07", bairro: "Avenida Prudente de Moraes", regiao: "Sul", quartos: 1, area: 45, capacidade: 3, camas: 1, garagem: true, varanda: true, arCondicionado: true, padrao: "Médio", diaria: 230, nota: 4.8, avaliacoes: 51, ocupacaoObservada: 58, dataPesquisa: "2026-07-20" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Rio Grande do Norte", regiao: "Sul", quartos: 1, area: 42, capacidade: 2, camas: 1, garagem: true, arCondicionado: true, maquinaLavar: true, padrao: "Médio", diaria: 235, nota: 4.6, avaliacoes: 19, ocupacaoObservada: 52, dataPesquisa: "2026-08-12" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Waldir Correa Cabral", regiao: "Sul", quartos: 1, area: 48, capacidade: 3, camas: 2, garagem: true, elevador: true, arCondicionado: true, padrao: "Superior", diaria: 265, nota: 4.9, avaliacoes: 61, superhost: true, ocupacaoObservada: 63, dataPesquisa: "2026-08-14" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Pioneiro Miguel Culpi", regiao: "Sul", quartos: 2, area: 58, capacidade: 4, camas: 2, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 280, nota: 4.5, avaliacoes: 22, dataPesquisa: "2026-06-15" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Waldir Correa Cabral", regiao: "Sul", quartos: 2, area: 62, capacidade: 4, camas: 2, garagem: true, elevador: true, piscina: true, arCondicionado: true, padrao: "Superior", diaria: 340, nota: 4.8, avaliacoes: 40, ocupacaoObservada: 60, dataPesquisa: "2026-08-02" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Bono Bini", regiao: "Sul", quartos: 1, area: 30, capacidade: 2, camas: 1, garagem: false, arCondicionado: false, padrao: "Econômico", diaria: 145, nota: 4.1, avaliacoes: 8, dataPesquisa: "2026-05-20" }),
  demoComp({ zona: "Zona 07", bairro: "Rua Rio Grande do Norte", regiao: "Sul", quartos: 1, area: 40, capacidade: 2, camas: 1, garagem: true, arCondicionado: true, espacoTrabalho: true, padrao: "Médio", diaria: 220, nota: 4.7, avaliacoes: 27, dataPesquisa: "2026-08-08" }),
  demoComp({ zona: "Zona 07", bairro: "Avenida Prudente de Moraes", regiao: "Sul", quartos: 3, area: 85, capacidade: 6, camas: 3, garagem: true, elevador: true, piscina: true, academia: true, arCondicionado: true, padrao: "Premium", diaria: 480, nota: 4.9, avaliacoes: 33, superhost: true, ocupacaoObservada: 55, dataPesquisa: "2026-08-16" }),

  // Zona 01 (10 itens) — região "Norte"
  demoComp({ zona: "Zona 01", bairro: "Avenida Duque de Caxias", regiao: "Norte", quartos: 1, area: 35, capacidade: 2, camas: 1, garagem: false, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 190, nota: 4.4, avaliacoes: 15, dataPesquisa: "2026-08-01" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Pernambuco", regiao: "Norte", quartos: 1, area: 40, capacidade: 2, camas: 1, garagem: true, elevador: true, arCondicionado: true, padrao: "Superior", diaria: 240, nota: 4.8, avaliacoes: 48, ocupacaoObservada: 61, dataPesquisa: "2026-08-11" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Paranaguá", regiao: "Norte", quartos: 2, area: 55, capacidade: 4, camas: 2, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 260, nota: 4.5, avaliacoes: 20, dataPesquisa: "2026-07-25" }),
  demoComp({ zona: "Zona 01", bairro: "Avenida Duque de Caxias", regiao: "Norte", quartos: 2, area: 65, capacidade: 4, camas: 2, garagem: true, elevador: true, piscina: true, academia: true, arCondicionado: true, padrao: "Superior", diaria: 350, nota: 4.9, avaliacoes: 70, superhost: true, ocupacaoObservada: 66, dataPesquisa: "2026-08-13" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Pernambuco", regiao: "Norte", quartos: 2, area: 78, capacidade: 5, camas: 3, garagem: true, elevador: true, piscina: true, academia: true, arCondicionado: true, espacoTrabalho: true, padrao: "Premium", diaria: 420, nota: 4.9, avaliacoes: 55, superhost: true, ocupacaoObservada: 60, dataPesquisa: "2026-08-18" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Paranaguá", regiao: "Norte", quartos: 1, area: 30, capacidade: 2, camas: 1, garagem: false, elevador: false, arCondicionado: false, padrao: "Econômico", diaria: 150, nota: 4.0, avaliacoes: 6, dataPesquisa: "2026-04-30" }),
  demoComp({ zona: "Zona 01", bairro: "Avenida Duque de Caxias", regiao: "Norte", quartos: 1, area: 44, capacidade: 3, camas: 1, garagem: true, elevador: true, varanda: true, arCondicionado: true, padrao: "Médio", diaria: 225, nota: 4.6, avaliacoes: 24, dataPesquisa: "2026-08-06" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Santos Dumont", regiao: "Norte", quartos: 3, area: 90, capacidade: 6, camas: 3, garagem: true, elevador: true, piscina: true, arCondicionado: true, padrao: "Superior", diaria: 400, nota: 4.7, avaliacoes: 18, dataPesquisa: "2026-06-02" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Pernambuco", regiao: "Norte", quartos: 2, area: 60, capacidade: 4, camas: 2, garagem: true, elevador: true, arCondicionado: true, maquinaLavar: true, padrao: "Médio", diaria: 275, nota: 4.5, avaliacoes: 29, ocupacaoObservada: 57, dataPesquisa: "2026-08-09" }),
  demoComp({ zona: "Zona 01", bairro: "Rua Paranaguá", regiao: "Norte", quartos: 1, area: 38, capacidade: 2, camas: 1, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 215, nota: 4.6, avaliacoes: 31, dataPesquisa: "2026-07-28" }),

  // Centro / Zona Central (10 itens) — região "Central"
  demoComp({ zona: "Centro", bairro: "Avenida Brasil", regiao: "Central", quartos: 1, area: 33, capacidade: 2, camas: 1, garagem: false, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 195, nota: 4.5, avaliacoes: 26, dataPesquisa: "2026-08-04" }),
  demoComp({ zona: "Centro", bairro: "Rua Pará", regiao: "Central", quartos: 1, area: 40, capacidade: 2, camas: 1, garagem: true, elevador: true, arCondicionado: true, espacoTrabalho: true, padrao: "Superior", diaria: 245, nota: 4.8, avaliacoes: 44, ocupacaoObservada: 64, dataPesquisa: "2026-08-15" }),
  demoComp({ zona: "Centro", bairro: "Avenida Tiradentes", regiao: "Central", quartos: 2, area: 52, capacidade: 4, camas: 2, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 250, nota: 4.4, avaliacoes: 17, dataPesquisa: "2026-06-25" }),
  demoComp({ zona: "Centro", bairro: "Rua São Paulo", regiao: "Central", quartos: 2, area: 70, capacidade: 4, camas: 2, garagem: true, elevador: true, piscina: true, arCondicionado: true, padrao: "Superior", diaria: 330, nota: 4.7, avaliacoes: 38, ocupacaoObservada: 59, dataPesquisa: "2026-08-07" }),
  demoComp({ zona: "Centro", bairro: "Avenida Brasil", regiao: "Central", quartos: 3, area: 95, capacidade: 6, camas: 3, garagem: true, elevador: true, piscina: true, academia: true, arCondicionado: true, padrao: "Premium", diaria: 460, nota: 4.9, avaliacoes: 49, superhost: true, ocupacaoObservada: 58, dataPesquisa: "2026-08-17" }),
  demoComp({ zona: "Centro", bairro: "Rua Pará", regiao: "Central", quartos: 1, area: 28, capacidade: 1, camas: 1, garagem: false, elevador: false, arCondicionado: false, padrao: "Econômico", diaria: 140, nota: 4.2, avaliacoes: 9, dataPesquisa: "2026-05-10" }),
  demoComp({ zona: "Centro", bairro: "Avenida Tiradentes", regiao: "Central", quartos: 1, area: 46, capacidade: 3, camas: 1, garagem: true, elevador: true, varanda: true, arCondicionado: true, maquinaLavar: true, padrao: "Superior", diaria: 255, nota: 4.8, avaliacoes: 41, ocupacaoObservada: 62, dataPesquisa: "2026-08-13" }),
  demoComp({ zona: "Centro", bairro: "Rua São Paulo", regiao: "Central", quartos: 2, area: 60, capacidade: 4, camas: 2, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 265, nota: 4.5, avaliacoes: 21, dataPesquisa: "2026-07-15" }),
  demoComp({ zona: "Centro", bairro: "Avenida Brasil", regiao: "Central", quartos: 1, area: 36, capacidade: 2, camas: 1, garagem: true, elevador: true, arCondicionado: true, padrao: "Médio", diaria: 210, nota: 4.6, avaliacoes: 30, dataPesquisa: "2026-08-03" }),
  demoComp({ zona: "Centro", bairro: "Rua Pará", regiao: "Central", quartos: 3, area: 88, capacidade: 6, camas: 3, garagem: true, elevador: true, piscina: true, arCondicionado: true, padrao: "Superior", diaria: 410, nota: 4.7, avaliacoes: 25, dataPesquisa: "2026-06-20" }),
];

/* =========================================================================
   STORAGE
   ========================================================================= */

// NOTE: the only technical change made to port this from a Claude Artifact
// (which used window.storage) to a standalone local app is this storage
// layer. It now reads/writes the browser's localStorage instead, which is
// the correct and standard mechanism for a private, offline, single-user
// local application. Every function signature below is unchanged, so
// nothing else in this file had to be touched.
const LOCAL_STORAGE_PREFIX = "estimador-airbnb-maringa:";
async function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
async function saveJSON(key, value) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/* =========================================================================
   STYLE
   ========================================================================= */

const GlobalStyle = () => (
  <style>{`
    :root {
      --bg: #F6F5F1;
      --paper: #FFFFFF;
      --ink: #17302B;
      --ink-soft: #57685F;
      --ink-faint: #8B978F;
      --line: #DEDACD;
      --line-soft: #EAE7DC;
      --accent: #2E6F5E;
      --accent-soft: #E4EFE9;
      --warm: #C1793D;
      --warm-soft: #F5E7D8;
      --alert: #AE4A3B;
      --alert-soft: #F4E1DD;
      --good: #2E6F5E;
      --good-soft: #E1EFE7;
      --mid: #B4842A;
      --mid-soft: #F4E9D3;
    }
    .rmi-root { background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }
    .rmi-display { font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; }
    .rmi-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .rmi-shell { display: flex; min-height: 100vh; }
    .rmi-sidebar { width: 232px; flex-shrink: 0; background: var(--ink); color: #EDEEE9; display: flex; flex-direction: column; padding: 22px 14px; }
    .rmi-brand { font-family: Georgia, serif; font-size: 19px; line-height: 1.25; padding: 0 10px 20px 10px; border-bottom: 1px solid rgba(255,255,255,0.14); margin-bottom: 14px; }
    .rmi-brand small { display:block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #AAB5AC; margin-top: 4px; }
    .rmi-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px; font-size: 13.5px; cursor: pointer; color: #D7DAD3; margin-bottom: 2px; border: 1px solid transparent; }
    .rmi-nav-item:hover { background: rgba(255,255,255,0.06); }
    .rmi-nav-item.active { background: rgba(255,255,255,0.10); color: #fff; border-color: rgba(255,255,255,0.14); }
    .rmi-nav-num { font-family: ui-monospace, monospace; font-size: 11px; color: #8FA79B; width: 16px; }
    .rmi-main { flex: 1; min-width: 0; padding: 28px 34px 60px 34px; }
    .rmi-mobile-nav { display: none; }
    @media (max-width: 860px) {
      .rmi-shell { flex-direction: column; }
      .rmi-sidebar { display: none; }
      .rmi-mobile-nav { display: flex; overflow-x: auto; gap: 6px; background: var(--ink); padding: 10px 12px; }
      .rmi-mobile-nav .rmi-nav-item { white-space: nowrap; margin-bottom: 0; }
      .rmi-main { padding: 18px 16px 48px 16px; }
    }
    .eyebrow { font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
    .page-title { font-family: Georgia, serif; font-size: 28px; margin: 4px 0 6px 0; letter-spacing: -0.01em; }
    .page-sub { color: var(--ink-soft); font-size: 13.5px; max-width: 640px; line-height: 1.5; margin-bottom: 22px; }
    .card { background: var(--paper); border: 1px solid var(--line); border-radius: 3px; padding: 18px 20px; }
    .card + .card { margin-top: 14px; }
    .card-title { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); margin-bottom: 12px; }
    .grid { display: grid; gap: 14px; }
    .g2 { grid-template-columns: repeat(2, 1fr); }
    .g3 { grid-template-columns: repeat(3, 1fr); }
    .g4 { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 700px) { .g2, .g3, .g4 { grid-template-columns: 1fr 1fr; } }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; }
    .rmi-input, .rmi-select, .rmi-textarea { border: 1px solid var(--line); background: var(--paper); border-radius: 3px; padding: 7px 9px; font-size: 13.5px; color: var(--ink); font-family: inherit; }
    .rmi-input:focus, .rmi-select:focus, .rmi-textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
    .rmi-textarea { resize: vertical; min-height: 56px; }
    .check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 0; }
    .check-row input { width: 15px; height: 15px; accent-color: var(--accent); }
    .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 3px; padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: #275C4D; }
    .btn-ghost { background: transparent; border-color: var(--line); color: var(--ink); }
    .btn-ghost:hover { background: var(--line-soft); }
    .btn-warm { background: var(--warm); color: #fff; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .btn-danger-ghost { background: transparent; border-color: var(--alert); color: var(--alert); }
    table.rmi-table { width: 100%; border-collapse: collapse; font-size: 12.8px; }
    table.rmi-table th { text-align: left; font-size: 10.8px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
    table.rmi-table td { padding: 7px 8px; border-bottom: 1px solid var(--line-soft); vertical-align: middle; }
    table.rmi-table tr:hover td { background: var(--accent-soft); }
    .tag { display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 2px; }
    .tag-econ { background: #E7E4DA; color: #5B5748; }
    .tag-medio { background: var(--accent-soft); color: var(--accent); }
    .tag-superior { background: var(--warm-soft); color: var(--warm); }
    .tag-premium { background: #E9DEEF; color: #6B3D80; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .badge-alta { background: var(--good-soft); color: var(--good); }
    .badge-media { background: var(--mid-soft); color: var(--mid); }
    .badge-baixa { background: var(--alert-soft); color: var(--alert); }
    .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .alert-box { display: flex; gap: 8px; padding: 10px 12px; border-radius: 3px; background: var(--warm-soft); border: 1px solid #E4C9A8; font-size: 12.8px; color: #6B4A22; margin-bottom: 8px; line-height: 1.45; }
    .info-box { background: var(--accent-soft); border-color: #B9D6C9; color: #1F4A3D; }
    .range-wrap { margin: 18px 0 10px 0; }
    .range-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-faint); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .range-track { position: relative; height: 10px; border-radius: 6px; background: linear-gradient(90deg, #DCE7DF, var(--accent-soft) 40%, var(--accent) 75%, #1F4A3D); }
    .range-marker { position: absolute; top: -7px; width: 3px; height: 24px; background: var(--ink); border-radius: 2px; }
    .range-marker::after { content: attr(data-label); position: absolute; top: -22px; left: 50%; transform: translateX(-50%); font-size: 11.5px; font-weight: 700; white-space: nowrap; font-family: ui-monospace, monospace; }
    .kpi-num { font-family: Georgia, serif; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em; }
    .kpi-label { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .divider { height: 1px; background: var(--line); margin: 16px 0; }
    .hstack { display: flex; align-items: center; gap: 10px; }
    .spread { display: flex; align-items: center; justify-content: space-between; }
    .link-btn { background: none; border: none; color: var(--accent); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; }
    .pill-toggle { display: inline-flex; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
    .pill-toggle button { border: none; background: var(--paper); padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink-soft); }
    .pill-toggle button.active { background: var(--ink); color: #fff; }
    .comp-row-score { font-family: ui-monospace, monospace; font-weight: 700; }
    .amenity-chip { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 20px; background: var(--line-soft); color: var(--ink-soft); margin: 1px 3px 1px 0; }
    .presentation { max-width: 760px; margin: 0 auto; }
    .presentation .card { padding: 26px 30px; }
    .footnote { font-size: 11.5px; color: var(--ink-faint); line-height: 1.5; }

    /* =====================================================================
       PREMIUM PRESENTATION (pv-*) — NOVO, isolado do restante do app.
       Usado apenas pelo "Estudo de Potencial" exportável da aba
       "Apresentação". Não reaproveita nem sobrescreve nenhuma classe
       acima — identidade visual própria, estilo editorial imobiliário,
       fiel à referência visual fornecida (6 páginas fixas).
       ===================================================================== */
    .pv-doc { max-width: 700px; margin: 0 auto; background: var(--paper); }
    .pv-page { position: relative; background: var(--paper); padding: 46px 44px 40px 44px; min-height: 640px; box-sizing: border-box; border-bottom: 10px solid var(--bg); display: flex; flex-direction: column; }
    .pv-page:last-child { border-bottom: none; }
    .pv-brandrow { display: flex; align-items: center; gap: 8px; color: var(--accent); margin-bottom: 22px; }
    .pv-brandrow svg { flex-shrink: 0; }
    .pv-brandrow span { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: var(--ink-soft); }
    .pv-title { font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; font-size: 30px; line-height: 1.22; color: var(--ink); letter-spacing: -0.01em; margin: 0 0 12px 0; font-weight: 400; }
    .pv-title-sm { font-family: Georgia, serif; font-size: 21px; line-height: 1.3; color: var(--ink); margin: 0 0 10px 0; font-weight: 400; }
    .pv-sub { font-size: 12.5px; color: var(--ink-soft); line-height: 1.6; max-width: 560px; }
    .pv-meta { font-size: 11.5px; color: var(--ink-faint); letter-spacing: 0.01em; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
    .pv-rule { height: 1px; background: var(--line); margin: 22px 0; border: none; }
    .pv-rule-sm { height: 1px; background: var(--line-soft); margin: 14px 0; border: none; }
    .pv-photo { width: 100%; height: 190px; border-radius: 3px; object-fit: cover; margin-bottom: 22px; border: 1px solid var(--line-soft); }
    .pv-photo-placeholder { width: 100%; height: 190px; border-radius: 3px; margin-bottom: 22px; border: 1px dashed var(--line); background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--ink-faint); }
    .pv-photo-placeholder span { font-size: 11px; }
    .pv-grid2x2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 26px; row-gap: 18px; }
    .pv-stat-cell { padding: 12px 0 12px 0; }
    .pv-grid2x2 .pv-stat-cell:nth-child(odd) { border-right: 1px solid var(--line-soft); }
    .pv-grid2x2 .pv-stat-cell:nth-child(1), .pv-grid2x2 .pv-stat-cell:nth-child(2) { border-bottom: 1px solid var(--line-soft); padding-bottom: 18px; }
    .pv-stat-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-faint); font-weight: 700; margin-bottom: 6px; }
    .pv-stat-num { font-family: Georgia, serif; font-size: 27px; line-height: 1.05; color: var(--ink); letter-spacing: -0.01em; }
    .pv-stat-num small { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; font-weight: 500; color: var(--ink-faint); margin-left: 3px; }
    .pv-stat-num.pv-accent { color: var(--accent); }
    .pv-stat-desc { font-size: 10.5px; color: var(--ink-faint); margin-top: 3px; }
    .pv-quote-box { margin-top: 22px; padding: 16px 18px; background: var(--accent-soft); border-radius: 3px; font-size: 12px; line-height: 1.65; color: var(--ink); display: flex; gap: 10px; }
    .pv-quote-box svg { flex-shrink: 0; color: var(--accent); margin-top: 2px; }
    .pv-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--line-soft); display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: var(--ink-faint); gap: 18px; }
    .pv-footer-texts { display: flex; justify-content: space-between; flex: 1; gap: 18px; }
    .pv-pagenum { flex-shrink: 0; font-size: 10px; color: var(--ink-faint); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .pv-logo-badge { height: 15px; width: auto; opacity: 0.82; display: inline-block; vertical-align: middle; }
    .pv-eyebrow { font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 10px; }
    .pv-scenarios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
    .pv-scenario { padding: 16px 14px; border: 1px solid var(--line); border-radius: 4px; background: var(--paper); }
    .pv-scenario.pv-featured { background: var(--accent-soft); border: 1.5px solid var(--accent); position: relative; }
    .pv-scenario-star { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; }
    .pv-scenario-tag { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; color: var(--ink-faint); margin-bottom: 10px; }
    .pv-scenario.pv-featured .pv-scenario-tag { color: var(--accent); }
    .pv-scenario-diaria { font-family: Georgia, serif; font-size: 20px; color: var(--ink); margin-bottom: 3px; }
    .pv-scenario-diaria small { font-size: 11px; font-weight: 400; color: var(--ink-faint); font-family: ui-sans-serif, system-ui, sans-serif; }
    .pv-scenario-row { font-size: 10.5px; color: var(--ink-soft); margin-top: 2px; }
    .pv-scenario-receita { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line-soft); }
    .pv-scenario-receita .num { font-family: Georgia, serif; font-size: 17px; color: var(--ink); }
    .pv-scenario-receita .num small { font-size: 10.5px; font-weight: 400; color: var(--ink-faint); font-family: ui-sans-serif, system-ui, sans-serif; }
    .pv-scenario-receita .desc { font-size: 9.5px; color: var(--ink-faint); margin-top: 1px; }
    .pv-scenario-annual { font-size: 10px; color: var(--ink-soft); margin-top: 8px; }
    .pv-market-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); font-weight: 700; margin-bottom: 14px; text-align: center; }
    .pv-indicators3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .pv-indicator { text-align: left; }
    .pv-indicator-icon { width: 34px; height: 34px; border-radius: 50%; border: 1.3px solid var(--accent); display: flex; align-items: center; justify-content: center; color: var(--accent); margin-bottom: 10px; }
    .pv-indicator-num { font-family: Georgia, serif; font-size: 24px; color: var(--ink); margin-bottom: 3px; }
    .pv-indicator-desc { font-size: 11px; color: var(--ink-soft); line-height: 1.4; }
    .pv-indicator-note { font-size: 9px; color: var(--ink-faint); line-height: 1.4; margin-top: 4px; font-style: italic; }
    .pv-methodology-note { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--line-soft); font-size: 10px; color: var(--ink-faint); line-height: 1.5; }
    .pv-methodology-note b { color: var(--ink-soft); font-weight: 700; }
    .pv-cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 12px; }
    .pv-cal-card { border: 1px solid var(--line); border-radius: 4px; padding: 16px 15px; }
    .pv-cal-icon { width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
    .pv-cal-when { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); font-weight: 700; margin-bottom: 4px; }
    .pv-cal-what { font-family: Georgia, serif; font-size: 16px; color: var(--ink); margin-bottom: 6px; }
    .pv-cal-desc { font-size: 10.5px; color: var(--ink-soft); line-height: 1.5; }
    .pv-vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; margin-top: 16px; }
    .pv-vs-col { padding: 20px 18px; border: 1px solid var(--line); border-radius: 4px; text-align: center; background: var(--paper); }
    .pv-vs-col.pv-win { border: 1.5px solid var(--accent); background: var(--accent-soft); }
    .pv-vs-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); font-weight: 700; margin-bottom: 8px; }
    .pv-vs-num { font-family: Georgia, serif; font-size: 24px; color: var(--ink); }
    .pv-vs-num small { font-size: 11px; font-weight: 400; color: var(--ink-faint); font-family: ui-sans-serif, system-ui, sans-serif; }
    .pv-vs-caption { font-size: 9.5px; color: var(--ink-faint); margin-top: 4px; }
    .pv-vs-sep { font-family: Georgia, serif; font-style: italic; color: var(--ink-faint); font-size: 13px; }
    .pv-compare-banner { margin-top: 16px; padding: 12px 16px; border-radius: 3px; background: var(--accent-soft); display: flex; gap: 10px; align-items: flex-start; }
    .pv-compare-banner.pv-neutral { background: var(--bg); }
    .pv-compare-banner svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
    .pv-compare-banner .headline { font-size: 12.5px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
    .pv-compare-banner .sub { font-size: 10.5px; color: var(--ink-soft); line-height: 1.5; }
    .pv-advantages4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; text-align: center; }
    .pv-advantage-icon { width: 32px; height: 32px; border-radius: 50%; border: 1.3px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--accent); margin: 0 auto 8px auto; }
    .pv-advantage-label { font-size: 10.5px; color: var(--ink); line-height: 1.35; }
    .pv-checklist { list-style: none; margin: 16px 0 0 0; padding: 0; }
    .pv-checklist li { display: flex; gap: 9px; align-items: flex-start; padding: 7px 0; font-size: 11.5px; color: var(--ink); line-height: 1.45; }
    .pv-checklist svg { color: var(--accent); flex-shrink: 0; margin-top: 1px; }
    .pv-services { list-style: none; margin: 14px 0 0 0; padding: 0; }
    .pv-services li { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line-soft); font-size: 12px; color: var(--ink); }
    .pv-services li:last-child { border-bottom: none; }
    .pv-services .ic { width: 26px; height: 26px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pv-side-card { border: 1px solid var(--line); border-radius: 4px; padding: 20px 18px; background: var(--bg); margin-top: 18px; }
    .pv-side-card .t { font-family: Georgia, serif; font-size: 16px; color: var(--ink); line-height: 1.3; margin-bottom: 6px; }
    .pv-side-card .d { font-size: 11px; color: var(--ink-soft); line-height: 1.5; }
    .pv-next-card { border-radius: 5px; background: var(--ink); color: #fff; padding: 22px 20px; margin-top: 16px; }
    .pv-next-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #B9CFC4; font-weight: 700; margin-bottom: 8px; }
    .pv-next-card .msg { font-size: 12.5px; line-height: 1.55; color: #EAF2ED; margin-bottom: 14px; }
    .pv-next-card .contact { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 700; color: #fff; }
    .pv-photo-tools { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 12px; color: var(--ink-soft); }
    .pv-photo-tools label.btn-file { border: 1px solid var(--line); border-radius: 3px; padding: 6px 12px; cursor: pointer; font-size: 12px; color: var(--ink); background: var(--paper); }
    label.btn-file { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 3px; padding: 9px 14px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--paper); }
    label.btn-file:hover { background: var(--line-soft); }
    label.btn-file input[type=file] { display: none; }
    .pv-photo-tools input[type=file] { display: none; }
    @media print {
      .pv-page { break-after: page; }
    }
  `}</style>
);

/* =========================================================================
   SMALL UI ATOMS
   ========================================================================= */

function PadraoTag({ padrao }) {
  const cls = padrao === "Econômico" ? "tag-econ" : padrao === "Médio" ? "tag-medio" : padrao === "Superior" ? "tag-superior" : "tag-premium";
  return <span className={`tag ${cls}`}>{padrao}</span>;
}

function ConfidenceBadge({ level }) {
  const cls = level === "Alta" ? "badge-alta" : level === "Média" ? "badge-media" : "badge-baixa";
  return <span className={`badge ${cls}`}><span className="badge-dot" />{level === "Alta" ? "Confiança alta" : level === "Média" ? "Confiança média" : "Confiança baixa"}</span>;
}

function RangeBar({ conservador, provavel, otimista, unit }) {
  const min = conservador, max = otimista;
  const span = Math.max(max - min, 1);
  const pos = (v) => clamp(((v - min) / span) * 100, 4, 96);
  const fmt = unit === "%" ? (v) => `${Math.round(v)}%` : (v) => fmtMoney(v);
  return (
    <div className="range-wrap">
      <div className="range-labels"><span>Conservador</span><span>Provável</span><span>Otimista</span></div>
      <div className="range-track">
        <div className="range-marker" style={{ left: `${pos(conservador)}%` }} data-label={fmt(conservador)} />
        <div className="range-marker" style={{ left: `${pos(provavel)}%`, height: 30, top: -13, width: 4 }} data-label={fmt(provavel)} />
        <div className="range-marker" style={{ left: `${pos(otimista)}%` }} data-label={fmt(otimista)} />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function AlertList({ alerts }) {
  if (!alerts || !alerts.length) return null;
  return <div>{alerts.map((a, i) => (
    <div key={i} className={`alert-box ${a.startsWith("ℹ️") ? "info-box" : ""}`}>{a}</div>
  ))}</div>;
}

/* =========================================================================
   NAV
   ========================================================================= */

const NAV_ITEMS = [
  { key: "analise", num: "01", label: "Análise Rápida" },
  { key: "base", num: "02", label: "Base de Comparáveis" },
  { key: "referencias", num: "03", label: "Banco de Referências" },
  { key: "config", num: "04", label: "Configurações" },
  { key: "apresentacao", num: "05", label: "Apresentação" },
  { key: "historico", num: "06", label: "Histórico de Análises" },
];

function Nav({ view, setView, mobile }) {
  return (
    <>
      {NAV_ITEMS.map((it) => (
        <div key={it.key} className={`rmi-nav-item ${view === it.key ? "active" : ""}`} onClick={() => setView(it.key)}>
          <span className="rmi-nav-num">{it.num}</span>{it.label}
        </div>
      ))}
    </>
  );
}

/* =========================================================================
   QUICK ANALYSIS — FORM
   ========================================================================= */

function AmenityGrid({ target, setTarget }) {
  return (
    <div className="grid g4">
      {AMENITY_KEYS.map((k) => (
        <label key={k} className="check-row">
          <input type="checkbox" checked={!!target[k]} onChange={(e) => setTarget({ ...target, [k]: e.target.checked })} />
          {AMENITY_LABELS[k]}
        </label>
      ))}
      <label className="check-row">
        <input type="checkbox" checked={!!target.mobiliado} onChange={(e) => setTarget({ ...target, mobiliado: e.target.checked })} />
        Mobiliado
      </label>
    </div>
  );
}

function QuickAnalysisScreen({ target, setTarget, onAnalyze, comparablesCount, onImportAnalysis }) {
  const set = (patch) => setTarget({ ...target, ...patch });
  const importInputRef = React.useRef(null);
  return (
    <div>
      <div className="eyebrow">Modo 2 — Análise Rápida</div>
      <h1 className="page-title">Analisar novo imóvel</h1>
      <p className="page-sub">Preencha as características principais — leva menos de 2 minutos. A ferramenta busca automaticamente os comparáveis mais parecidos na sua base ({comparablesCount} cadastrados) e gera uma faixa de estimativa, nunca um número único.</p>

      <div className="card">
        <div className="card-title">Localização</div>
        <div className="grid g3">
          <Field label="Zona"><input className="rmi-input" value={target.zona} onChange={(e) => set({ zona: e.target.value })} placeholder="Ex: Zona 07" /></Field>
          <Field label="Rua"><input className="rmi-input" value={target.bairro} onChange={(e) => set({ bairro: e.target.value })} placeholder="Ex: Rua das Palmeiras" /></Field>
          <Field label="Região">
            <select className="rmi-select" value={target.regiao} onChange={(e) => set({ regiao: e.target.value })}>
              <option value="">—</option>
              <option>Norte</option><option>Sul</option><option>Central</option><option>Leste</option><option>Oeste</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Imóvel</div>
        <div className="grid g4">
          <Field label="Tipo">
            <select className="rmi-select" value={target.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              <option>Apartamento</option><option>Casa</option><option>Kitnet/Studio</option><option>Casa de condomínio</option><option>Outro</option>
            </select>
          </Field>
          <Field label="Quartos"><input type="number" min="0" className="rmi-input" value={target.quartos} onChange={(e) => set({ quartos: e.target.value })} /></Field>
          <Field label="Banheiros"><input type="number" min="0" className="rmi-input" value={target.banheiros} onChange={(e) => set({ banheiros: e.target.value })} /></Field>
          <Field label="Área (m²)"><input type="number" min="0" className="rmi-input" value={target.area} onChange={(e) => set({ area: e.target.value })} placeholder="Ex: 45" /></Field>
          <Field label="Capacidade (hóspedes)"><input type="number" min="0" className="rmi-input" value={target.capacidade} onChange={(e) => set({ capacidade: e.target.value })} /></Field>
          <Field label="Camas"><input type="number" min="0" className="rmi-input" value={target.camas} onChange={(e) => set({ camas: e.target.value })} /></Field>
          <Field label="Padrão">
            <select className="rmi-select" value={target.padrao} onChange={(e) => set({ padrao: e.target.value })}>
              {PADRAO_ORDER.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Mobiliário">
            <select className="rmi-select" value={target.mobiliarioNivel} onChange={(e) => set({ mobiliarioNivel: e.target.value })}>
              <option value="padrao">Padrão</option><option value="superior">Superior</option><option value="inferior">Inferior</option>
            </select>
          </Field>
          <Field label="Portaria">
            <select className="rmi-select" value={target.portaria} onChange={(e) => set({ portaria: e.target.value })}>
              <option value="semPortaria">Sem portaria</option>
              <option value="eletronica">Portaria eletrônica/remota</option>
              <option value="24h">Portaria 24 horas</option>
            </select>
          </Field>
        </div>
        <div className="divider" />
        <AmenityGrid target={target} setTarget={setTarget} />
      </div>

      <div className="card">
        <div className="card-title">Condomínio e custos específicos deste imóvel</div>
        <div className="grid g2">
          <div>
            <label style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 600, display: "block", marginBottom: 6 }}>Condomínio</label>
            <div className="pill-toggle" style={{ marginBottom: 8 }}>
              <button type="button" className={!target.usarCondominioManual ? "active" : ""} onClick={() => set({ usarCondominioManual: false })}>Usar estimativa automática</button>
              <button type="button" className={target.usarCondominioManual ? "active" : ""} onClick={() => set({ usarCondominioManual: true })}>Informar valor real</button>
            </div>
            {target.usarCondominioManual ? (
              <input type="number" min="0" className="rmi-input" style={{ width: "100%" }} value={target.condominioManual} onChange={(e) => set({ condominioManual: e.target.value })} placeholder="Ex: 420" />
            ) : (
              <div className="footnote">Estimado em <b style={{ color: "var(--ink)" }}>{fmtMoney(estimateCondominio(target))}</b>/mês, com base nas características informadas acima. Valor aproximado — o condomínio real pode variar.</div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: "var(--ink-soft)", fontWeight: 600, display: "block", marginBottom: 6 }}>Água e gás</label>
            <label className="check-row"><input type="checkbox" checked={!!target.aguaInclusaCondominio} onChange={(e) => set({ aguaInclusaCondominio: e.target.checked })} /> Água inclusa no condomínio</label>
            <label className="check-row"><input type="checkbox" checked={!!target.gasInclusoCondominio} onChange={(e) => set({ gasInclusoCondominio: e.target.checked })} /> Gás incluso no condomínio</label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Outros fatores (ajustam a estimativa — veja pesos em Configurações)</div>
        <div className="grid g3">
          <label className="check-row"><input type="checkbox" checked={target.vistaDiferenciada} onChange={(e) => set({ vistaDiferenciada: e.target.checked })} /> Vista diferenciada</label>
          <label className="check-row"><input type="checkbox" checked={target.localizacaoExcepcional} onChange={(e) => set({ localizacaoExcepcional: e.target.checked })} /> Localização excepcional</label>
          <label className="check-row"><input type="checkbox" checked={target.localizacaoMenosConveniente} onChange={(e) => set({ localizacaoMenosConveniente: e.target.checked })} /> Localização menos conveniente</label>
          <label className="check-row"><input type="checkbox" checked={target.acabamentoSuperior} onChange={(e) => set({ acabamentoSuperior: e.target.checked })} /> Acabamento superior</label>
          <label className="check-row"><input type="checkbox" checked={target.imovelAntigo} onChange={(e) => set({ imovelAntigo: e.target.checked })} /> Imóvel antigo/desgastado</label>
          <label className="check-row"><input type="checkbox" checked={target.poucasComodidades} onChange={(e) => set({ poucasComodidades: e.target.checked })} /> Poucas comodidades</label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Opcional</div>
        <div className="grid g2">
          <Field label="Link do anúncio atual (se houver)"><input className="rmi-input" value={target.linkAnuncio} onChange={(e) => set({ linkAnuncio: e.target.value })} /></Field>
          <Field label="Aluguel tradicional (R$/mês)"><input type="number" min="0" className="rmi-input" value={target.aluguelTradicional} onChange={(e) => set({ aluguelTradicional: e.target.value })} placeholder="Ex: 2300" /></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Observações"><textarea className="rmi-textarea" value={target.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></Field>
        </div>
      </div>

      <div className="hstack" style={{ marginTop: 6 }}>
        <button className="btn btn-primary" onClick={onAnalyze}>Gerar estimativa →</button>
        <label className="btn-file" style={{ marginBottom: 0 }}>
          Importar análise anterior
          <input ref={importInputRef} type="file" accept="application/json" onChange={onImportAnalysis} />
        </label>
      </div>
    </div>
  );
}

/* =========================================================================
   RESULT PANEL
   ========================================================================= */

function ScenarioCol({ title, s, ownerResult }) {
  return (
    <div>
      <div className="kpi-label">{title}</div>
      <div className="kpi-num">{fmtMoney(s.diaria)}<span style={{ fontSize: 13, color: "var(--ink-faint)" }}>/noite</span></div>
      <div className="footnote" style={{ marginTop: 6 }}>Ocupação {fmtPct(s.ocupPct)} · {s.noitesOcupadas.toFixed(0)} noites/mês</div>
      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{fmtMoney(s.receita)}<span style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }}> receita/mês</span></div>
      {ownerResult !== undefined && <div className="footnote" style={{ marginTop: 2 }}>Proprietário: {fmtMoney(ownerResult)}</div>}
    </div>
  );
}

function ResultPanel({ result, target, settings, onTogglePresentation, onExcludeComp, excludedIds }) {
  if (!result || result.empty) {
    return <div className="card"><AlertList alerts={result ? result.alerts : []} /></div>;
  }
  const { diaria, scenarios, ownerResultByScenario, annualProvavel, comparison, confidence, chosen, adjustments, ocupacao, costsByScenario, commissionByScenario } = result;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Resultado da Análise</div>
          <h2 className="page-title" style={{ fontSize: 22, margin: "2px 0" }}>Potencial do imóvel</h2>
        </div>
        <div className="hstack">
          <ConfidenceBadge level={confidence.overall} />
          <button className="btn btn-ghost btn-sm" onClick={onTogglePresentation}>Modo Apresentação</button>
        </div>
      </div>

      <AlertList alerts={result.alerts} />

      <div className="card">
        <div className="card-title">Diária estimada</div>
        <RangeBar conservador={diaria.conservador} provavel={diaria.provavel} otimista={diaria.otimista} />
        <div className="spread" style={{ marginTop: 4 }}>
          <div className="footnote">Diária recomendada inicial: <b style={{ color: "var(--ink)" }}>{fmtMoney(diaria.recomendada)}</b></div>
          {adjustments.totalAdjPct !== 0 && <div className="footnote">Ajuste aplicado: {adjustments.totalAdjPct > 0 ? "+" : ""}{adjustments.totalAdjPct.toFixed(0)}% sobre a base dos comparáveis</div>}
        </div>
        {adjustments.applied.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {adjustments.applied.map((a) => (
              <span key={a.key} className="amenity-chip">{a.label} {a.pct > 0 ? "+" : ""}{a.pct}%</span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Ocupação estimada {ocupacao.isHypothesis && <span style={{ fontWeight: 400, textTransform: "none", color: "var(--warm)" }}>· hipótese configurável, não dado observado</span>}</div>
        <RangeBar conservador={ocupacao.conservador} provavel={ocupacao.provavel} otimista={ocupacao.otimista} unit="%" />
      </div>

      <div className="card">
        <div className="card-title">Faturamento mensal por cenário</div>
        <div className="grid g3">
          <ScenarioCol title="Conservador" s={scenarios.conservador} ownerResult={ownerResultByScenario.conservador} />
          <ScenarioCol title="Provável" s={scenarios.provavel} ownerResult={ownerResultByScenario.provavel} />
          <ScenarioCol title="Otimista" s={scenarios.otimista} ownerResult={ownerResultByScenario.otimista} />
        </div>
        <div className="divider" />
        <div className="footnote">Receita anual estimada (cenário provável): <b style={{ color: "var(--ink)" }}>{fmtMoney(annualProvavel)}</b></div>
      </div>

      <div className="card">
        <div className="card-title">Custos e comissão (cenário provável)</div>

        <div className="footnote" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Custos variáveis</div>
        <div className="grid g3">
          <div><div className="kpi-label">Taxa plataforma</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.taxaPlataforma)}</div></div>
          <div><div className="kpi-label">Limpeza</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.limpeza)}</div></div>
          <div><div className="kpi-label">Lavanderia</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.lavanderia)}</div></div>
        </div>

        <div className="divider" />

        <div className="footnote" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Custos mensais</div>
        <div className="grid g4">
          <div><div className="kpi-label">Energia</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.energia)}</div></div>
          <div><div className="kpi-label">Internet</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.internet)}</div></div>
          <div><div className="kpi-label">Água{target.aguaInclusaCondominio ? " (no condomínio)" : ""}</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.agua)}</div></div>
          <div><div className="kpi-label">Gás{target.gasInclusoCondominio ? " (no condomínio)" : ""}</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.gas)}</div></div>
          <div>
            <div className="kpi-label">Condomínio {target.usarCondominioManual ? "(informado)" : "(estimado)"}</div>
            <div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.condominio)}</div>
          </div>
          <div><div className="kpi-label">IPTU</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.iptu)}</div></div>
          <div><div className="kpi-label">Seguro residencial</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.seguroResidencial)}</div></div>
          <div><div className="kpi-label">Manutenção</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.manutencao)}</div></div>
          <div><div className="kpi-label">Reposição</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.reposicao)}</div></div>
          <div><div className="kpi-label">Imprevistos operacionais</div><div style={{ fontWeight: 700 }}>{fmtMoney(costsByScenario.provavel.imprevistosOperacionais)}</div></div>
        </div>
        {!target.usarCondominioManual && (
          <div className="footnote" style={{ marginTop: 8 }}>Condomínio estimado com base nas características e estrutura do imóvel. O valor real do condomínio pode variar.</div>
        )}

        <div className="divider" />
        <div className="spread">
          <div className="footnote">Total de custos/mês: <b style={{ color: "var(--ink)" }}>{fmtMoney(costsByScenario.provavel.total)}</b></div>
          <div className="footnote">Minha comissão ({settings.comissaoPct}% sobre {settings.comissaoBase === "bruta" ? "receita bruta" : "receita líquida"}): <b style={{ color: "var(--ink)" }}>{fmtMoney(commissionByScenario.provavel)}</b></div>
          <div className="footnote">Resultado estimado do proprietário: <b style={{ color: "var(--accent)" }}>{fmtMoney(ownerResultByScenario.provavel)}</b></div>
        </div>
      </div>

      {comparison && (
        <div className="card">
          <div className="card-title">Comparação com aluguel tradicional</div>
          <div className="grid g3">
            <div><div className="kpi-label">Aluguel tradicional</div><div className="kpi-num" style={{ fontSize: 22 }}>{fmtMoney(comparison.aluguel)}</div></div>
            <div><div className="kpi-label">Locação por temporada (proprietário)</div><div className="kpi-num" style={{ fontSize: 22 }}>{fmtMoney(comparison.resultado)}</div></div>
            <div><div className="kpi-label">Diferença estimada</div>
              <div className="kpi-num" style={{ fontSize: 22, color: comparison.melhor ? "var(--good)" : "var(--alert)" }}>
                {comparison.diff >= 0 ? "+" : ""}{fmtMoney(comparison.diff)}
              </div>
              <div className="footnote">{comparison.diffPct >= 0 ? "+" : ""}{comparison.diffPct.toFixed(0)}% em relação ao aluguel tradicional</div>
            </div>
          </div>
          {!comparison.melhor && <div className="alert-box" style={{ marginTop: 10 }}>Neste cenário, o aluguel tradicional tende a ser mais vantajoso para o proprietário do que a locação por temporada. Vale apresentar isso com transparência.</div>}
        </div>
      )}

      <div className="card">
        <div className="spread">
          <div className="card-title" style={{ marginBottom: 0 }}>Comparáveis utilizados ({chosen.length})</div>
          <span className="footnote">Score médio: {confidence.avgScore.toFixed(0)} · Idade média dos dados: {Number.isFinite(confidence.avgAge) ? `${Math.round(confidence.avgAge)} dias` : "—"}</span>
        </div>
        <table className="rmi-table" style={{ marginTop: 8 }}>
          <thead><tr><th>Imóvel</th><th>Zona</th><th>Quartos</th><th>Área</th><th>Padrão</th><th>Diária</th><th>Score</th><th></th></tr></thead>
          <tbody>
            {chosen.map(({ comp, score }) => (
              <tr key={comp.id}>
                <td>{comp.bairro || comp.tipo}{comp.demo ? " [DEMO]" : ""}</td>
                <td>{comp.zona}</td>
                <td>{comp.quartos}</td>
                <td>{comp.area}m²</td>
                <td><PadraoTag padrao={comp.padrao} /></td>
                <td className="rmi-mono">{fmtMoney(comp.diaria)}</td>
                <td className="comp-row-score">{score.total}</td>
                <td><button className="link-btn" onClick={() => onExcludeComp(comp.id)}>remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {excludedIds.length > 0 && <div className="footnote" style={{ marginTop: 8 }}>{excludedIds.length} comparável(is) removido(s) manualmente desta análise.</div>}
      </div>

      <div className="footnote" style={{ marginTop: 10 }}>
        Estimativa baseada em imóveis comparáveis cadastrados na base. Não é garantia de receita — trata-se de uma referência de mercado para apoiar a decisão de prospecção.
      </div>
    </div>
  );
}

/* =========================================================================
   PRESENTATION VIEW (owner-facing)
   ========================================================================= */

function PresentationView({ target, result, onBack }) {
  if (!result || result.empty) return null;
  const { diaria, ocupacao, scenarios, ownerResultByScenario, comparison, adjustments } = result;
  return (
    <div className="presentation">
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="eyebrow">Apresentação ao proprietário</div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Voltar</button>
      </div>
      <h1 className="page-title" style={{ fontSize: 30 }}>Potencial de locação por temporada</h1>
      <p className="page-sub">{target.tipo} · {target.quartos} quarto(s) · {target.area ? `${target.area}m²` : ""} · {target.bairro || target.zona}</p>

      <div className="card">
        <div className="card-title">Diária estimada de mercado</div>
        <RangeBar conservador={diaria.conservador} provavel={diaria.provavel} otimista={diaria.otimista} />
        <div className="footnote" style={{ marginTop: 6 }}>Diária recomendada para iniciar: <b style={{ color: "var(--ink)" }}>{fmtMoney(diaria.recomendada)}</b></div>
      </div>

      <div className="card">
        <div className="card-title">Ocupação estimada</div>
        <RangeBar conservador={ocupacao.conservador} provavel={ocupacao.provavel} otimista={ocupacao.otimista} unit="%" />
      </div>

      <div className="card">
        <div className="card-title">Faturamento potencial (mensal)</div>
        <div className="grid g3">
          <ScenarioCol title="Conservador" s={scenarios.conservador} />
          <ScenarioCol title="Provável" s={scenarios.provavel} />
          <ScenarioCol title="Otimista" s={scenarios.otimista} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Resultado estimado para o proprietário (cenário provável)</div>
        <div className="kpi-num" style={{ fontSize: 34, color: "var(--accent)" }}>{fmtMoney(ownerResultByScenario.provavel)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-soft)" }}> /mês, após custos e comissão de gestão</span></div>
      </div>

      {comparison && (
        <div className="card">
          <div className="card-title">Comparação com aluguel tradicional</div>
          <div className="grid g2">
            <div><div className="kpi-label">Aluguel tradicional</div><div className="kpi-num" style={{ fontSize: 24 }}>{fmtMoney(comparison.aluguel)}</div></div>
            <div><div className="kpi-label">Temporada (estimado)</div><div className="kpi-num" style={{ fontSize: 24, color: comparison.melhor ? "var(--good)" : "var(--alert)" }}>{fmtMoney(comparison.resultado)}</div></div>
          </div>
        </div>
      )}

      {adjustments.applied.length > 0 && (
        <div className="card">
          <div className="card-title">Principais fatores considerados</div>
          {adjustments.applied.map((a) => <span key={a.key} className="amenity-chip">{a.label}</span>)}
        </div>
      )}

      <div className="footnote" style={{ marginTop: 14 }}>
        Os valores acima são estimativas com base em imóveis comparáveis da região e não constituem garantia de receita. O desempenho real depende de fatores como sazonalidade, concorrência, qualidade do anúncio e gestão operacional.
      </div>
    </div>
  );
}

/* =========================================================================
   BASE DE COMPARÁVEIS
   ========================================================================= */

const EMPTY_COMP = {
  zona: "", bairro: "", regiao: "", enderecoRef: "",
  tipo: "Apartamento", quartos: 1, banheiros: 1, area: "", capacidade: 2, camas: 1,
  garagem: false, elevador: false, varanda: false, piscina: false, academia: false,
  arCondicionado: false, maquinaLavar: false, espacoTrabalho: false, mobiliado: true,
  padrao: "Médio", diaria: "", taxaLimpeza: "", nota: "", avaliacoes: "", superhost: false,
  ocupacaoObservada: "", diferenciais: "", dataPesquisa: new Date().toISOString().slice(0, 10), link: "",
};

/* =========================================================================
   PREENCHIMENTO AUTOMÁTICO — colar texto de uma ficha e extrair os campos
   (NOVO — recurso adicional, não altera nenhum campo, cálculo ou fluxo
   existente. Só ajuda a preencher o formulário mais rápido.)
   ========================================================================= */

function normalizeKey(s) {
  return s
    .toLowerCase()
    .replace(/²/g, "2")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, "");
}

const FICHA_FIELD_MAP = {
  rua: { field: "bairro", type: "text" },
  endereco: { field: "bairro", type: "text" },
  zona: { field: "zona", type: "zona" },
  regiao: { field: "regiao", type: "select", options: ["Norte", "Sul", "Central", "Leste", "Oeste"] },
  referenciadeendereco: { field: "enderecoRef", type: "text" },
  tipo: { field: "tipo", type: "select", options: ["Apartamento", "Casa", "Kitnet/Studio", "Casa de condomínio", "Outro"] },
  quartos: { field: "quartos", type: "number" },
  banheiros: { field: "banheiros", type: "number" },
  aream2: { field: "area", type: "number" },
  area: { field: "area", type: "number" },
  capacidade: { field: "capacidade", type: "number" },
  camas: { field: "camas", type: "number" },
  padrao: { field: "padrao", type: "select", options: PADRAO_ORDER },
  diariaobservadar: { field: "diaria", type: "number-or-skip" },
  diariaobservada: { field: "diaria", type: "number-or-skip" },
  taxadelimpeza: { field: "taxaLimpeza", type: "number-or-skip" },
  taxadeocupacaomediaestimada: { field: "ocupacaoObservada", type: "number-or-skip" },
  ocupacaomediaestimada: { field: "ocupacaoObservada", type: "number-or-skip" },
  ocupacao: { field: "ocupacaoObservada", type: "number-or-skip" },
  notadoanuncio: { field: "nota", type: "number-or-skip" },
  nota: { field: "nota", type: "number-or-skip" },
  numerodeavaliacoes: { field: "avaliacoes", type: "number-or-skip" },
  avaliacoes: { field: "avaliacoes", type: "number-or-skip" },
  superhost: { field: "superhost", type: "boolean" },
  datadapesquisa: { field: "dataPesquisa", type: "date" },
  garagem: { field: "garagem", type: "boolean" },
  elevador: { field: "elevador", type: "boolean" },
  varanda: { field: "varanda", type: "boolean" },
  piscina: { field: "piscina", type: "boolean" },
  academia: { field: "academia", type: "boolean" },
  arcondicionado: { field: "arCondicionado", type: "boolean" },
  maquinadelavar: { field: "maquinaLavar", type: "boolean" },
  espacodetrabalho: { field: "espacoTrabalho", type: "boolean" },
  mobiliado: { field: "mobiliado", type: "boolean" },
  diferenciais: { field: "diferenciais", type: "text" },
  linkdoanuncio: { field: "link", type: "text" },
  link: { field: "link", type: "text" },
};

function isInformed(raw) {
  const v = raw.trim().toLowerCase();
  return v && v !== "não informado" && v !== "nao informado" && v !== "n/a" && v !== "-" && v !== "—";
}

function parseNumberLoose(raw) {
  const m = raw.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// Extrai "Zona 07" de dentro de um valor como "Vila Santo Antônio (Zona 07)".
// O que sobrar (ex.: "Vila Santo Antônio") é devolvido para juntar à
// Referência de endereço, sem descartar a informação.
function extractZona(raw) {
  const m = raw.match(/zona\s*\d+/i);
  if (!m) return { zonaValue: raw.trim(), leftover: "" };
  const zonaValue = m[0].replace(/\s+/g, " ").replace(/zona/i, "Zona").trim();
  const leftover = raw.replace(m[0], "").replace(/[()]/g, "").trim().replace(/^[-–—]\s*/, "");
  return { zonaValue, leftover };
}

function matchOption(raw, options) {
  const norm = (s) => normalizeKey(s);
  const target = norm(raw);
  const found = options.find((o) => norm(o) === target);
  return found || null;
}

// Recebe o texto colado (no formato de uma "Ficha de Análise do Imóvel")
// e devolve um objeto parcial com os campos reconhecidos, prontos para
// mesclar no estado do formulário. Nunca inventa valores: campos marcados
// como "Não informado" (ou ausentes no texto) simplesmente não são
// preenchidos, e ficam para você completar manualmente se quiser.
function parseFichaText(text) {
  const lines = text.split(/\r?\n/);
  const entries = []; // [{ key: normalizedLabel, value: string }]
  let current = null;

  lines.forEach((line) => {
    const m = line.match(/^\s*([^:]{2,42}):\s*(.*)$/);
    if (m && normalizeKey(m[1]) in FICHA_FIELD_MAP) {
      current = { key: normalizeKey(m[1]), value: m[2] };
      entries.push(current);
    } else if (current && line.trim()) {
      // continuação de um valor que quebrou em mais de uma linha
      current.value += " " + line.trim();
    }
  });

  const patch = {};
  let zonaLeftover = "";
  let matchedCount = 0;

  entries.forEach(({ key, value }) => {
    const spec = FICHA_FIELD_MAP[key];
    const raw = value.trim();
    if (!spec) return;

    if (spec.type === "zona") {
      if (!isInformed(raw)) return;
      const { zonaValue, leftover } = extractZona(raw);
      patch.zona = zonaValue;
      zonaLeftover = leftover;
      matchedCount++;
      return;
    }
    if (spec.type === "text") {
      if (!isInformed(raw)) return;
      patch[spec.field] = raw;
      matchedCount++;
      return;
    }
    if (spec.type === "number") {
      const n = parseNumberLoose(raw);
      if (n === null) return;
      patch[spec.field] = n;
      matchedCount++;
      return;
    }
    if (spec.type === "number-or-skip") {
      if (!isInformed(raw)) return; // respeita "Não informado" — não inventa
      const n = parseNumberLoose(raw);
      if (n === null) return;
      patch[spec.field] = n;
      matchedCount++;
      return;
    }
    if (spec.type === "boolean") {
      patch[spec.field] = /sim/i.test(raw);
      matchedCount++;
      return;
    }
    if (spec.type === "select") {
      const opt = matchOption(raw, spec.options);
      if (!opt) return;
      patch[spec.field] = opt;
      matchedCount++;
      return;
    }
    if (spec.type === "date") {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      patch[spec.field] = d.toISOString().slice(0, 10);
      matchedCount++;
      return;
    }
  });

  if (zonaLeftover) {
    patch.enderecoRef = patch.enderecoRef ? `${zonaLeftover} — ${patch.enderecoRef}` : zonaLeftover;
  }

  return { patch, matchedCount };
}

function ComparableForm({ initial, onSave, onCancel }) {
  const [c, setC] = useState(initial || EMPTY_COMP);
  const set = (patch) => setC({ ...c, ...patch });
  const [pasteText, setPasteText] = useState("");
  const [pasteFeedback, setPasteFeedback] = useState("");
  const handleAutoFill = () => {
    if (!pasteText.trim()) return;
    const { patch, matchedCount } = parseFichaText(pasteText);
    setC({ ...c, ...patch });
    setPasteFeedback(
      matchedCount > 0
        ? `${matchedCount} campo(s) preenchido(s) automaticamente. Confira antes de salvar.`
        : "Não consegui reconhecer nenhum campo neste texto. Confira se está no formato \"Campo: valor\", uma informação por linha."
    );
  };
  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <div className="card-title">{initial ? "Editar comparável" : "Novo comparável"}</div>

      <div className="card" style={{ background: "var(--accent-soft)", border: "1px dashed var(--accent)" }}>
        <div className="card-title">Preenchimento automático (colar ficha)</div>
        <p className="footnote" style={{ marginBottom: 8 }}>
          Cole abaixo o texto de uma ficha no formato "Campo: valor" (uma informação por linha) e clique em
          "Preencher campos" — os campos reconhecidos abaixo são preenchidos automaticamente. Nada é enviado
          para fora do seu computador; a leitura acontece aqui mesmo. Campos marcados como "Não informado"
          são deixados em branco, para não inventar dados.
        </p>
        <textarea
          className="rmi-textarea" style={{ width: "100%", minHeight: 130, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
          value={pasteText} onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Rua: Rua Doutor Miguel Vieira Ferreira, 91\nZona: Vila Santo Antônio (Zona 07)\nRegião: Central\nTipo: Apartamento\nQuartos: 1\n..."}
        />
        <div className="hstack" style={{ marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleAutoFill}>Preencher campos</button>
          {pasteFeedback && <span className="footnote">{pasteFeedback}</span>}
        </div>
      </div>

      <div className="grid g4">
        <Field label="Zona"><input className="rmi-input" value={c.zona} onChange={(e) => set({ zona: e.target.value })} /></Field>
        <Field label="Rua"><input className="rmi-input" value={c.bairro} onChange={(e) => set({ bairro: e.target.value })} /></Field>
        <Field label="Região">
          <select className="rmi-select" value={c.regiao} onChange={(e) => set({ regiao: e.target.value })}>
            <option value="">—</option><option>Norte</option><option>Sul</option><option>Central</option><option>Leste</option><option>Oeste</option>
          </select>
        </Field>
        <Field label="Referência de endereço"><input className="rmi-input" value={c.enderecoRef} onChange={(e) => set({ enderecoRef: e.target.value })} /></Field>
      </div>
      <div className="divider" />
      <div className="grid g4">
        <Field label="Tipo">
          <select className="rmi-select" value={c.tipo} onChange={(e) => set({ tipo: e.target.value })}>
            <option>Apartamento</option><option>Casa</option><option>Kitnet/Studio</option><option>Casa de condomínio</option><option>Outro</option>
          </select>
        </Field>
        <Field label="Quartos"><input type="number" className="rmi-input" value={c.quartos} onChange={(e) => set({ quartos: e.target.value })} /></Field>
        <Field label="Banheiros"><input type="number" className="rmi-input" value={c.banheiros} onChange={(e) => set({ banheiros: e.target.value })} /></Field>
        <Field label="Área (m²)"><input type="number" className="rmi-input" value={c.area} onChange={(e) => set({ area: e.target.value })} /></Field>
        <Field label="Capacidade"><input type="number" className="rmi-input" value={c.capacidade} onChange={(e) => set({ capacidade: e.target.value })} /></Field>
        <Field label="Camas"><input type="number" className="rmi-input" value={c.camas} onChange={(e) => set({ camas: e.target.value })} /></Field>
        <Field label="Padrão">
          <select className="rmi-select" value={c.padrao} onChange={(e) => set({ padrao: e.target.value })}>
            {PADRAO_ORDER.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Diária observada (R$)"><input type="number" className="rmi-input" value={c.diaria} onChange={(e) => set({ diaria: e.target.value })} /></Field>
      </div>
      <div className="divider" />
      <AmenityGrid target={c} setTarget={setC} />
      <div className="divider" />
      <div className="grid g4">
        <Field label="Taxa de limpeza (R$)"><input type="number" className="rmi-input" value={c.taxaLimpeza} onChange={(e) => set({ taxaLimpeza: e.target.value })} /></Field>
        <Field label="Nota do anúncio (0–5)"><input type="number" step="0.1" max="5" className="rmi-input" value={c.nota} onChange={(e) => set({ nota: e.target.value })} /></Field>
        <Field label="Nº avaliações"><input type="number" className="rmi-input" value={c.avaliacoes} onChange={(e) => set({ avaliacoes: e.target.value })} /></Field>
        <Field label="Ocupação observada (%, opcional)"><input type="number" className="rmi-input" value={c.ocupacaoObservada} onChange={(e) => set({ ocupacaoObservada: e.target.value })} /></Field>
        <Field label="Data da pesquisa"><input type="date" className="rmi-input" value={c.dataPesquisa} onChange={(e) => set({ dataPesquisa: e.target.value })} /></Field>
        <label className="check-row" style={{ alignSelf: "end" }}><input type="checkbox" checked={c.superhost} onChange={(e) => set({ superhost: e.target.checked })} /> Superhost</label>
      </div>
      <div className="grid g2" style={{ marginTop: 10 }}>
        <Field label="Diferenciais"><input className="rmi-input" value={c.diferenciais} onChange={(e) => set({ diferenciais: e.target.value })} /></Field>
        <Field label="Link do anúncio"><input className="rmi-input" value={c.link} onChange={(e) => set({ link: e.target.value })} /></Field>
      </div>
      <div className="hstack" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => onSave(c)}>Salvar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function BaseScreen({ comparables, setComparables }) {
  const [editing, setEditing] = useState(null); // null | 'new' | comp object
  const [filter, setFilter] = useState({ zona: "", quartos: "", padrao: "" });
  // NOVO — seleção em massa para exclusão
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const filtered = comparables.filter((c) =>
    (!filter.zona || (c.zona || "").toLowerCase().includes(filter.zona.toLowerCase())) &&
    (!filter.quartos || String(c.quartos) === filter.quartos) &&
    (!filter.padrao || c.padrao === filter.padrao)
  );

  const handleSave = (c) => {
    let next;
    if (c.id) {
      next = comparables.map((x) => (x.id === c.id ? c : x));
    } else {
      next = [...comparables, { ...c, id: uid(), demo: false }];
    }
    setComparables(next);
    setEditing(null);
  };
  const handleDelete = (id) => {
    if (window.confirm && !window.confirm("Remover este comparável da base?")) return;
    setComparables(comparables.filter((c) => c.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };
  const markUpdated = (id) => {
    setComparables(comparables.map((c) => (c.id === id ? { ...c, dataPesquisa: new Date().toISOString().slice(0, 10) } : c)));
  };

  // NOVO — seleção em massa (respeita os filtros aplicados)
  const filteredIds = filtered.map((c) => c.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) return prev.filter((id) => !filteredIds.includes(id));
      const merged = new Set([...prev, ...filteredIds]);
      return [...merged];
    });
  };
  const handleBulkDelete = () => {
    setComparables(comparables.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    setConfirmingBulkDelete(false);
  };

  // NOVO — exportação da base (tudo ou apenas selecionados) e backup/importação.
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleExportExcel = async (list) => {
    if (list.length === 0) { window.alert("Nenhum comparável para exportar."); return; }
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(list);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparáveis");
    XLSX.writeFile(wb, `comparaveis-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const handleExportJSON = (list) => {
    if (list.length === 0) { window.alert("Nenhum comparável para exportar."); return; }
    const backup = {
      _tipo: "backup-comparaveis-estimador-airbnb-maringa",
      _versao: 1,
      exportadoEm: new Date().toISOString(),
      comparables: list,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    downloadBlob(blob, `backup-comparaveis-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const handleImportBase = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const imported = Array.isArray(data.comparables) ? data.comparables : (Array.isArray(data) ? data : null);
        if (!imported) {
          window.alert("Não foi possível reconhecer este arquivo como um backup de comparáveis.");
          return;
        }
        const existingIds = new Set(comparables.map((c) => c.id));
        const withIds = imported.map((c) => (c && c.id ? c : { ...c, id: uid() }));
        const novos = withIds.filter((c) => !existingIds.has(c.id));
        const duplicados = withIds.length - novos.length;
        if (novos.length === 0) {
          window.alert(duplicados > 0 ? "Todos os comparáveis deste arquivo já existem na base atual (nenhum importado)." : "Nenhum comparável válido encontrado neste arquivo.");
          return;
        }
        const msg = `Importar ${novos.length} comparável(is) novo(s) para a base atual?` + (duplicados > 0 ? ` (${duplicados} já existente(s) na base serão ignorados.)` : "");
        if (!window.confirm(msg)) return;
        setComparables([...comparables, ...novos]);
        window.alert(`${novos.length} comparável(is) importado(s) com sucesso.`);
      } catch (err) {
        window.alert("Não foi possível ler este arquivo.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div>
      <div className="spread">
        <div>
          <div className="eyebrow">Modo 1 — Pesquisa de Mercado</div>
          <h1 className="page-title">Base de comparáveis</h1>
          <p className="page-sub">Cadastre aqui os imóveis que você pesquisou no Airbnb. Quanto mais comparáveis por região/perfil, mais confiável fica a estimativa. Recomendado: 10–15 por região.</p>
        </div>
        {editing === null && <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Novo comparável</button>}
      </div>

      <div className="hstack" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => handleExportExcel(comparables)}>Exportar tudo (Excel)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => handleExportJSON(comparables)}>Exportar tudo (backup JSON)</button>
        <label className="btn-file" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 400 }}>
          Importar base (JSON)
          <input type="file" accept="application/json" onChange={handleImportBase} />
        </label>
      </div>

      {editing === "new" && <ComparableForm onSave={handleSave} onCancel={() => setEditing(null)} />}
      {editing && editing !== "new" && <ComparableForm initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} />}

      <div className="card">
        <div className="grid g3">
          <Field label="Filtrar por zona"><input className="rmi-input" value={filter.zona} onChange={(e) => setFilter({ ...filter, zona: e.target.value })} /></Field>
          <Field label="Filtrar por quartos"><input className="rmi-input" value={filter.quartos} onChange={(e) => setFilter({ ...filter, quartos: e.target.value })} /></Field>
          <Field label="Filtrar por padrão">
            <select className="rmi-select" value={filter.padrao} onChange={(e) => setFilter({ ...filter, padrao: e.target.value })}>
              <option value="">Todos</option>{PADRAO_ORDER.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {selectedIds.length > 0 && (
          <div className="spread" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="footnote">{selectedIds.length} comparável(is) selecionado(s)</div>
            <span className="hstack">
              <button className="btn btn-ghost btn-sm" onClick={() => handleExportExcel(comparables.filter((c) => selectedIds.includes(c.id)))}>Exportar selecionados (Excel)</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleExportJSON(comparables.filter((c) => selectedIds.includes(c.id)))}>Exportar selecionados (JSON)</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => setConfirmingBulkDelete(true)}>
                🗑 Excluir selecionados ({selectedIds.length})
              </button>
            </span>
          </div>
        )}

        {confirmingBulkDelete && (
          <div className="alert-box" style={{ marginTop: 12, alignItems: "center", justifyContent: "space-between" }}>
            <span>Tem certeza que deseja excluir {selectedIds.length} comparáveis? Esta ação não poderá ser desfeita.</span>
            <span className="hstack" style={{ flexShrink: 0, marginLeft: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingBulkDelete(false)}>Cancelar</button>
              <button className="btn btn-warm btn-sm" onClick={handleBulkDelete}>Excluir {selectedIds.length} comparáveis</button>
            </span>
          </div>
        )}

        <table className="rmi-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} /></th>
              <th>Zona/Rua</th><th>Quartos</th><th>Área</th><th>Padrão</th><th>Diária</th><th>Nota</th><th>Atualizado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const age = daysSince(c.dataPesquisa);
              return (
                <tr key={c.id}>
                  <td><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelectOne(c.id)} /></td>
                  <td>{c.zona}{c.bairro ? ` · ${c.bairro}` : ""}{c.demo ? " [DEMO]" : ""}</td>
                  <td>{c.quartos}</td>
                  <td>{c.area}m²</td>
                  <td><PadraoTag padrao={c.padrao} /></td>
                  <td className="rmi-mono">{fmtMoney(toNum(c.diaria))}</td>
                  <td>{c.nota || "—"}</td>
                  <td>{age === null ? "—" : age <= 30 ? `${age}d` : <span style={{ color: "var(--alert)" }}>⚠️ {age}d</span>}</td>
                  <td className="hstack">
                    <button className="link-btn" onClick={() => setEditing(c)}>editar</button>
                    <button className="link-btn" onClick={() => markUpdated(c.id)}>atualizar</button>
                    <button className="link-btn" style={{ color: "var(--alert)" }} onClick={() => handleDelete(c.id)}>excluir</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={9} className="footnote" style={{ padding: 16 }}>Nenhum comparável encontrado com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   BANCO DE REFERÊNCIAS
   ========================================================================= */

function ReferenceBankScreen({ comparables }) {
  const [filter, setFilter] = useState({ zona: "", padrao: "" });
  const groups = useMemo(() => buildReferenceGroups(comparables), [comparables]);
  const filtered = groups.filter((g) =>
    (!filter.zona || g.zona.toLowerCase().includes(filter.zona.toLowerCase())) &&
    (!filter.padrao || g.padrao === filter.padrao)
  );
  return (
    <div>
      <div className="eyebrow">Modo 1 — Pesquisa de Mercado</div>
      <h1 className="page-title">Banco de referências</h1>
      <p className="page-sub">Referências de mercado agrupadas por Zona + Quartos + Faixa de área + Padrão, geradas automaticamente a partir da Base de Comparáveis.</p>

      <div className="card">
        <div className="grid g2">
          <Field label="Filtrar por zona"><input className="rmi-input" value={filter.zona} onChange={(e) => setFilter({ ...filter, zona: e.target.value })} /></Field>
          <Field label="Filtrar por padrão">
            <select className="rmi-select" value={filter.padrao} onChange={(e) => setFilter({ ...filter, padrao: e.target.value })}>
              <option value="">Todos</option>{PADRAO_ORDER.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        {filtered.map((g, i) => (
          <div className="card" key={i}>
            <div className="spread">
              <div>
                <div style={{ fontWeight: 700 }}>{g.zona}</div>
                <div className="footnote">{g.quartos} quarto(s) · {g.faixaArea} · {g.padrao}</div>
              </div>
              <ConfidenceBadge level={g.confianca} />
            </div>
            <div className="divider" />
            <div className="grid g3">
              <div><div className="kpi-label">Mínima</div><div style={{ fontWeight: 700 }}>{fmtMoney(g.min)}</div></div>
              <div><div className="kpi-label">Mediana</div><div style={{ fontWeight: 700, color: "var(--accent)" }}>{fmtMoney(g.mediana)}</div></div>
              <div><div className="kpi-label">Máxima</div><div style={{ fontWeight: 700 }}>{fmtMoney(g.max)}</div></div>
            </div>
            <div className="footnote" style={{ marginTop: 8 }}>
              Média: {fmtMoney(g.media)} · {g.n} comparável(is){g.ocupacaoRef ? ` · Ocupação de referência: ${fmtPct(g.ocupacaoRef)}` : ""}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card footnote">Nenhum grupo encontrado. Cadastre mais comparáveis na Base.</div>}
      </div>
    </div>
  );
}

/* =========================================================================
   CONFIGURAÇÕES
   ========================================================================= */

function SettingsScreen({ settings, setSettings, onExportBackup, onImportBackup }) {
  const set = (patch) => setSettings({ ...settings, ...patch });
  const setAdj = (key, v) => setSettings({ ...settings, adjustments: { ...settings.adjustments, [key]: toNum(v, 0) } });
  const setCost = (key, patch) => setSettings({ ...settings, costs: { ...settings.costs, [key]: { ...settings.costs[key], ...patch } } });
  const setOcup = (key, v) => setSettings({ ...settings, ocupacaoPadrao: { ...settings.ocupacaoPadrao, [key]: toNum(v, 0) } });

  return (
    <div>
      <div className="eyebrow">Configurações</div>
      <h1 className="page-title">Premissas e parâmetros</h1>
      <p className="page-sub">Estes valores são hipóteses ajustáveis usadas nos cálculos — não são fatos de mercado. Ajuste conforme sua realidade operacional.</p>

      <div className="card">
        <div className="card-title">Ajustes por características (% sobre a diária base)</div>
        <div className="grid g4">
          {Object.keys(ADJUSTMENT_LABELS).map((key) => (
            <Field key={key} label={ADJUSTMENT_LABELS[key]}>
              <input type="number" className="rmi-input" value={settings.adjustments[key]} onChange={(e) => setAdj(key, e.target.value)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Ocupação padrão (quando não houver dados suficientes na base)</div>
        <div className="grid g3">
          <Field label="Conservador (%)"><input type="number" className="rmi-input" value={settings.ocupacaoPadrao.conservador} onChange={(e) => setOcup("conservador", e.target.value)} /></Field>
          <Field label="Provável (%)"><input type="number" className="rmi-input" value={settings.ocupacaoPadrao.provavel} onChange={(e) => setOcup("provavel", e.target.value)} /></Field>
          <Field label="Otimista (%)"><input type="number" className="rmi-input" value={settings.ocupacaoPadrao.otimista} onChange={(e) => setOcup("otimista", e.target.value)} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Custos operacionais</div>
        <table className="rmi-table">
          <thead><tr><th>Custo</th><th>Tipo</th><th>Valor</th></tr></thead>
          <tbody>
            {Object.keys(settings.costs).map((key) => {
              const c = settings.costs[key];
              return (
                <tr key={key}>
                  <td>{c.label}</td>
                  <td>
                    <select className="rmi-select" value={c.tipo} onChange={(e) => setCost(key, { tipo: e.target.value })}>
                      <option value="fixo">Fixo (R$/mês)</option>
                      <option value="porCheckout">Por checkout (R$)</option>
                      <option value="percentual">% da receita</option>
                    </select>
                  </td>
                  <td><input type="number" className="rmi-input" style={{ width: 110 }} value={c.valor} onChange={(e) => setCost(key, { valor: toNum(e.target.value, 0) })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Comissão do gestor</div>
        <div className="grid g3">
          <Field label="Percentual (%)"><input type="number" className="rmi-input" value={settings.comissaoPct} onChange={(e) => set({ comissaoPct: toNum(e.target.value, 0) })} /></Field>
          <Field label="Calculada sobre">
            <select className="rmi-select" value={settings.comissaoBase} onChange={(e) => set({ comissaoBase: e.target.value })}>
              <option value="bruta">Receita bruta</option>
              <option value="liquida">Receita líquida (após custos)</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Outros parâmetros</div>
        <div className="grid g2">
          <Field label="Noites disponíveis por mês"><input type="number" className="rmi-input" value={settings.noitesMes} onChange={(e) => set({ noitesMes: toNum(e.target.value, 30) })} /></Field>
          <Field label="Duração média da estadia (noites)"><input type="number" className="rmi-input" value={settings.duracaoMediaEstadia} onChange={(e) => set({ duracaoMediaEstadia: toNum(e.target.value, 1) })} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Backup dos dados</div>
        <p className="footnote" style={{ marginBottom: 10 }}>
          Seus dados (Base de Comparáveis e Configurações) ficam salvos apenas neste computador. Exporte um backup
          regularmente — por exemplo antes de formatar o computador ou trocar de máquina — e guarde o arquivo em um
          lugar seguro (pen drive, e-mail para você mesmo, Google Drive, etc.).
        </p>
        <div className="hstack">
          <button className="btn btn-ghost" onClick={onExportBackup}>Exportar backup (.json)</button>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            Importar backup (.json)
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={onImportBackup} />
          </label>
        </div>
        <p className="footnote" style={{ marginTop: 8 }}>Importar um backup substitui os dados atuais deste computador pelos dados do arquivo.</p>
      </div>
    </div>
  );
}

/* =========================================================================
   APRESENTAÇÃO — "Estudo de Potencial para Locação por Temporada"
   (REFEITO — documento único de 6 páginas fixas, fiel a uma referência
   visual fornecida pelo usuário (layout, hierarquia, cores, tipografia).
   Reutiliza os mesmos dados já calculados por runAnalysis — nenhuma
   fórmula nova. Correção importante: o destaque financeiro principal
   passa a ser `ownerResultByScenario` (resultado líquido do proprietário,
   já calculado acima como receita - custos - comissão), não mais a
   receita bruta. Não altera login/autenticação/Supabase/comparáveis/
   configurações/custos/comissão — só a camada de apresentação.
   Continua sem mostrar: endereço/identidade de comparável individual,
   scores, pesos, metodologia técnica ou custos internos detalhados. )
   ========================================================================= */

const DEFAULT_APRESENTACAO_TEXTS = {
  contato: "(44) 99900-0000",
};

// NOVO — identidade da empresa (usada de forma discreta no rodapé/selo do PDF).
const COMPANY_NAME = "MS Gestão de Imóveis";

// Referências de mercado fixas, usadas como contexto comercial (não
// calculadas a partir dos dados do usuário — números de mercado fornecidos
// para compor a narrativa, sempre como referência, nunca como garantia).
const MARKET_REFERENCE = {
  imoveisAnunciados: "500+",
  imoveisAnunciadosDesc: "Anúncios de hospedagem por temporada identificados em Maringá",
  imoveisAnunciadosFonte: "Referência baseada na oferta identificada na plataforma Airbnb para Maringá.",
  ocupacaoMediaPct: 65,
  ocupacaoMediaDesc: "Taxa de ocupação utilizada como referência geral de mercado",
};

const OPPORTUNITY_TIMELINE = [
  { when: "Maio", what: "Expoingá", desc: "Uma das maiores feiras agropecuárias do Sul do Brasil, com grande fluxo de visitantes, profissionais e participantes ligados ao agronegócio." },
  { when: "Novembro a Janeiro", what: "Maringá Encantada", desc: "Período de maior movimentação turística e familiar, impulsionado pela programação natalina de fim de ano." },
  { when: "Janeiro / Fevereiro / Julho", what: "Calendário universitário", desc: "Períodos relacionados a vestibulares, matrículas, transferências, formaturas e movimentação estudantil." },
];

/* --------------------------- ícones de traço fino --------------------------- */

function PvIcon({ name, size = 18 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "house": return <svg {...c}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-6h4v6" /></svg>;
    case "percent": return <svg {...c}><circle cx="6.5" cy="6.5" r="2.3" /><circle cx="17.5" cy="17.5" r="2.3" /><line x1="19" y1="5" x2="5" y2="19" /></svg>;
    case "chart": return <svg {...c}><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="13" width="3" height="7" /><rect x="11" y="9" width="3" height="11" /><rect x="16" y="5" width="3" height="15" /></svg>;
    case "leaf": return <svg {...c}><path d="M4 20c8 0 14-6 14-14v-2h-2C8 4 4 10 4 18v2z" /><path d="M4 20 14 10" /></svg>;
    case "tree": return <svg {...c}><path d="M12 3 7 11h3l-4 6h4v4h4v-4h4l-4-6h3z" /></svg>;
    case "cap": return <svg {...c}><path d="M12 5 2 10l10 5 10-5-10-5z" /><path d="M6 12.5v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" /></svg>;
    case "check": return <svg {...c}><path d="m4 12.5 5 5L20 6" /></svg>;
    case "checkcircle": return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="m8.3 12.3 2.4 2.4 5-5.1" /></svg>;
    case "trend": return <svg {...c}><polyline points="4,17 10,10 14,14 20,6" /><polyline points="14,6 20,6 20,12" /></svg>;
    case "swap": return <svg {...c}><polyline points="4,7 8,7 8,17" /><polyline points="6,5 8,7 6,9" /><polyline points="20,17 16,17 16,7" /><polyline points="18,19 16,17 18,15" /></svg>;
    case "pin": return <svg {...c}><path d="M12 21s7-6.5 7-11.5A7 7 0 1 0 5 9.5C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2" /></svg>;
    case "tag": return <svg {...c}><path d="M12 3h6a1 1 0 0 1 1 1v6l-9 9-7-7 9-9z" /><circle cx="15.5" cy="7.5" r="1" /></svg>;
    case "chat": return <svg {...c}><path d="M4 5h16v11H8l-4 4V5z" /></svg>;
    case "calendar": return <svg {...c}><rect x="4" y="5" width="16" height="15" rx="1.5" /><line x1="4" y1="9.5" x2="20" y2="9.5" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>;
    case "tool": return <svg {...c}><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3-3z" /></svg>;
    case "star": return <svg {...c}><path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3L3 9.5l6.4-.6z" /></svg>;
    case "phone": return <svg {...c}><path d="M6 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10 19 5 14 5 5a2 2 0 0 1 1-2z" /></svg>;
    case "building": return <svg {...c}><rect x="5" y="3" width="14" height="18" rx="1" /><line x1="9" y1="7" x2="9" y2="7.01" /><line x1="15" y1="7" x2="15" y2="7.01" /><line x1="9" y1="11" x2="9" y2="11.01" /><line x1="15" y1="11" x2="15" y2="11.01" /><line x1="9" y1="15" x2="9" y2="15.01" /><line x1="15" y1="15" x2="15" y2="15.01" /></svg>;
    case "users": return <svg {...c}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2" /><path d="M15.5 14a5 5 0 0 1 4.5 6" /></svg>;
    case "photo": return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5 3 3L18 10l1 1" /></svg>;
    case "quote": return <svg {...c}><path d="M7 8c-2 0-3.5 1.6-3.5 4S5 16 7 16" /><path d="M15 8c-2 0-3.5 1.6-3.5 4s1.5 4 3.5 4" /></svg>;
    case "clipboard": return <svg {...c}><rect x="6" y="4" width="12" height="17" rx="1.5" /><rect x="9" y="2.3" width="6" height="3" rx="1" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="15" y2="15" /></svg>;
    default: return null;
  }
}

/* --------------------------- utilidades da apresentação --------------------------- */

function pvFormatDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function pvPropertyMeta(target) {
  const parts = [];
  if (target.tipo) parts.push(target.tipo);
  if (toNum(target.quartos) >= 1) parts.push(`${target.quartos} quarto(s)`);
  parts.push(target.area ? `${target.area} m²` : "Área não informada");
  if (target.bairro || target.zona) parts.push(target.bairro || target.zona);
  parts.push("Maringá/PR");
  return parts.join(" · ");
}

function PvBrandRow({ label }) {
  return (
    <div className="pv-brandrow">
      <PvIcon name="house" size={16} />
      <span>{label}</span>
    </div>
  );
}

function PvFooter({ n, left, right }) {
  return (
    <div className="pv-footer">
      <div className="pv-footer-texts">
        <span>{left || ""}</span>
        <span>{right || ""}</span>
      </div>
      <span className="pv-pagenum">
        <img src={MS_LOGO_DATA_URI} alt="" className="pv-logo-badge" />
        {String(n).padStart(2, "0")}
      </span>
    </div>
  );
}

/* --------------------------------- PÁGINA 1 --------------------------------- */

function PvPagina1({ target, result, photo, codigo }) {
  const { diaria, ocupacao, ownerResultByScenario } = result;
  const annualLiquidoProvavel = ownerResultByScenario.provavel * 12;
  return (
    <div className="pv-page">
      <PvBrandRow label="Estudo de Potencial" />
      <h1 className="pv-title">Estudo de Potencial<br />para Locação por Temporada</h1>
      <div className="pv-meta"><PvIcon name="pin" size={12} />{pvPropertyMeta(target)}</div>

      {photo ? (
        <img src={photo} alt="Imóvel" className="pv-photo" />
      ) : (
        <div className="pv-photo-placeholder"><PvIcon name="photo" size={26} /><span>Foto do imóvel (opcional)</span></div>
      )}

      <div className="pv-grid2x2">
        <div className="pv-stat-cell">
          <div className="pv-stat-label">Diária provável</div>
          <div className="pv-stat-num">{fmtMoney(diaria.provavel)}<small>/ noite</small></div>
        </div>
        <div className="pv-stat-cell">
          <div className="pv-stat-label">Ocupação estimada</div>
          <div className="pv-stat-num">{fmtPct(ocupacao.provavel)}</div>
        </div>
        <div className="pv-stat-cell">
          <div className="pv-stat-label">Resultado mensal estimado</div>
          <div className="pv-stat-num pv-accent">{fmtMoney(ownerResultByScenario.provavel)}</div>
          <div className="pv-stat-desc">Resultado líquido estimado após custos operacionais e gestão</div>
        </div>
        <div className="pv-stat-cell">
          <div className="pv-stat-label">Projeção anual estimada</div>
          <div className="pv-stat-num">{fmtMoney(annualLiquidoProvavel)}</div>
          <div className="pv-stat-desc">líquido estimado no ano</div>
        </div>
      </div>

      <div className="pv-quote-box">
        <PvIcon name="quote" size={16} />
        <span>Com base no perfil deste imóvel e nas referências de mercado utilizadas na análise, identificamos potencial para exploração através da locação por temporada, com uma estimativa financeira estruturada.</span>
      </div>

      <PvFooter
        n={1}
        left={`${COMPANY_NAME} · Estudo elaborado em ${pvFormatDate(new Date())}${codigo ? ` · Código ${codigo}` : ""}`}
        right="Este estudo não constitui garantia de resultado."
      />
    </div>
  );
}

/* --------------------------------- PÁGINA 2 --------------------------------- */

function PvScenarioCard({ label, s, ownerResult, featured }) {
  return (
    <div className={`pv-scenario${featured ? " pv-featured" : ""}`}>
      {featured && <div className="pv-scenario-star"><PvIcon name="star" size={12} /></div>}
      <div className="pv-scenario-tag">{label}</div>
      <div className="pv-scenario-diaria">{fmtMoney(s.diaria)}<small> / noite</small></div>
      <div className="pv-scenario-row">Ocupação {fmtPct(s.ocupPct)} · {s.noitesOcupadas.toFixed(0)} noites/mês</div>
      <div className="pv-scenario-receita">
        <div className="num">{fmtMoney(ownerResult)}<small> / mês</small></div>
        <div className="desc">Resultado líquido estimado após custos operacionais e gestão</div>
      </div>
      <div className="pv-scenario-annual">Projeção anual: {fmtMoney(ownerResult * 12)}</div>
    </div>
  );
}

function PvPagina2({ result }) {
  const { scenarios, ownerResultByScenario, chosen } = result;
  return (
    <div className="pv-page">
      <div className="pv-eyebrow">Potencial financeiro</div>
      <h2 className="pv-title-sm">Quanto este imóvel pode gerar?</h2>
      <p className="pv-sub">Três cenários de mercado, construídos a partir do perfil do imóvel e das referências utilizadas neste estudo.</p>

      <div className="pv-scenarios">
        <PvScenarioCard label="Conservador" s={scenarios.conservador} ownerResult={ownerResultByScenario.conservador} />
        <PvScenarioCard label="Provável" s={scenarios.provavel} ownerResult={ownerResultByScenario.provavel} featured />
        <PvScenarioCard label="Otimista" s={scenarios.otimista} ownerResult={ownerResultByScenario.otimista} />
      </div>

      <div className="pv-rule" />
      <div className="pv-market-title">Mercado de locação por temporada em Maringá</div>
      <div className="pv-indicators3">
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="building" size={16} /></div>
          <div className="pv-indicator-num">{MARKET_REFERENCE.imoveisAnunciados}</div>
          <div className="pv-indicator-desc">{MARKET_REFERENCE.imoveisAnunciadosDesc}</div>
          <div className="pv-indicator-note">{MARKET_REFERENCE.imoveisAnunciadosFonte}</div>
        </div>
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="percent" size={16} /></div>
          <div className="pv-indicator-num">{MARKET_REFERENCE.ocupacaoMediaPct}%</div>
          <div className="pv-indicator-desc">{MARKET_REFERENCE.ocupacaoMediaDesc}</div>
        </div>
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="chart" size={16} /></div>
          <div className="pv-indicator-num">{chosen.length}</div>
          <div className="pv-indicator-desc">Imóveis comparáveis analisados para este estudo</div>
        </div>
      </div>

      <p className="pv-sub" style={{ marginTop: 18, maxWidth: "none" }}>
        Maringá apresenta demanda consistente ao longo do ano, impulsionada por negócios, agronegócio,
        universidades, eventos e visitantes. O mercado de curta temporada vem crescendo e se profissionalizando,
        gerando boas oportunidades para imóveis bem posicionados.
      </p>

      <PvFooter n={2} />
    </div>
  );
}

/* --------------------------------- PÁGINA 3 --------------------------------- */

function PvPagina3() {
  return (
    <div className="pv-page">
      <div className="pv-eyebrow">Demanda na região</div>
      <h2 className="pv-title-sm">Comportamento da demanda</h2>
      <p className="pv-sub" style={{ maxWidth: "none" }}>A locação por temporada em Maringá possui demanda diversificada ao longo do ano, com picos importantes em momentos estratégicos.</p>

      <div className="pv-market-title" style={{ textAlign: "left", marginTop: 20 }}>Calendário de oportunidades</div>
      <div className="pv-cal-grid">
        {OPPORTUNITY_TIMELINE.map((item, i) => (
          <div className="pv-cal-card" key={i}>
            <div className="pv-cal-icon"><PvIcon name={i === 0 ? "leaf" : i === 1 ? "tree" : "cap"} size={15} /></div>
            <div className="pv-cal-when">{item.when}</div>
            <div className="pv-cal-what">{item.what}</div>
            <div className="pv-cal-desc">{item.desc}</div>
          </div>
        ))}
      </div>

      <p className="pv-sub" style={{ marginTop: 20, maxWidth: "none" }}>
        Além desses períodos, eventos corporativos, congressos, competições esportivas e o turismo de negócios
        mantêm a cidade ativa durante todo o ano.
      </p>

      <PvFooter n={3} />
    </div>
  );
}

/* --------------------------------- PÁGINA 4 --------------------------------- */

function PvPagina4({ result }) {
  const { comparison, ownerResultByScenario } = result;
  const liquidoProvavel = ownerResultByScenario.provavel;
  // Valores internos completos (sem arredondamento) usados no cálculo do
  // potencial adicional — o arredondamento acontece só na exibição (fmtMoney/fmtPct).
  const diffMensal = comparison ? liquidoProvavel - comparison.aluguel : null;
  const diffAnual = diffMensal !== null ? diffMensal * 12 : null;
  const pctAdicional = comparison && comparison.aluguel > 0 ? (diffMensal / comparison.aluguel) * 100 : null;
  const melhor = diffMensal !== null ? diffMensal >= 0 : null;
  const sign = melhor ? "+" : "−";
  return (
    <div className="pv-page">
      <div className="pv-eyebrow">Comparação de modelos</div>
      <h2 className="pv-title-sm">Locação tradicional vs. locação por temporada</h2>

      {comparison ? (
        <>
          <div className="pv-vs">
            <div className="pv-vs-col">
              <div className="pv-vs-label">Locação tradicional</div>
              <div className="pv-vs-num">{fmtMoney(comparison.aluguel)}<small> / mês</small></div>
              <div className="pv-vs-caption">Valor mensal bruto estimado da locação tradicional</div>
            </div>
            <div className="pv-vs-sep">vs.</div>
            <div className={`pv-vs-col${melhor ? " pv-win" : ""}`}>
              <div className="pv-vs-label">Locação por temporada</div>
              <div className="pv-vs-num">{fmtMoney(liquidoProvavel)}<small> / mês</small></div>
              <div className="pv-vs-caption">Resultado líquido estimado após custos operacionais e gestão (cenário provável)</div>
            </div>
          </div>

          <div className={`pv-compare-banner${melhor ? "" : " pv-neutral"}`}>
            <PvIcon name={melhor ? "trend" : "chat"} size={18} />
            <div>
              {melhor ? (
                <>
                  <div className="headline">Potencial adicional estimado</div>
                  <div className="sub" style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 4 }}>
                    {sign} {fmtMoney(Math.abs(diffMensal))}/mês {pctAdicional !== null ? `(${sign}${Math.abs(pctAdicional).toFixed(1)}%)` : ""}
                  </div>
                  <div className="sub" style={{ fontSize: 12.5, color: "var(--ink)" }}>
                    {sign} {fmtMoney(Math.abs(diffAnual))}/ano {pctAdicional !== null ? `(${sign}${Math.abs(pctAdicional).toFixed(1)}%)` : ""}
                  </div>
                  <div className="sub" style={{ marginTop: 6 }}>A estimativa pode variar conforme ocupação, precificação, custos operacionais e desempenho do imóvel.</div>
                </>
              ) : (
                <>
                  <div className="headline">Neste cenário, a locação tradicional apresenta resultado financeiro estimado superior</div>
                  <div className="sub" style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 4 }}>
                    {sign} {fmtMoney(Math.abs(diffMensal))}/mês {pctAdicional !== null ? `(${sign}${Math.abs(pctAdicional).toFixed(1)}%)` : ""} em relação à locação tradicional
                  </div>
                  <div className="sub" style={{ marginTop: 6 }}>A estimativa pode variar conforme ocupação, precificação, custos operacionais e desempenho do imóvel.</div>
                </>
              )}
            </div>
          </div>

          <div className="pv-indicator-note" style={{ marginTop: 10, fontSize: 10 }}>
            O valor da locação tradicional é apresentado de forma bruta e pode ser impactado por vacância,
            manutenção, reparos e outros encargos. O resultado efetivo do proprietário pode variar.
          </div>
        </>
      ) : (
        <div className="pv-compare-banner pv-neutral">
          <PvIcon name="chat" size={18} />
          <div className="sub">Informe o valor do aluguel tradicional na Análise Rápida para incluir esta comparação no estudo.</div>
        </div>
      )}

      <div className="pv-rule" />
      <div className="pv-market-title" style={{ textAlign: "left" }}>Vantagens da locação por temporada</div>
      <div className="pv-advantages4">
        <div><div className="pv-advantage-icon"><PvIcon name="trend" size={15} /></div><div className="pv-advantage-label">Maior potencial de receita</div></div>
        <div><div className="pv-advantage-icon"><PvIcon name="calendar" size={15} /></div><div className="pv-advantage-label">Flexibilidade de uso</div></div>
        <div><div className="pv-advantage-icon"><PvIcon name="house" size={15} /></div><div className="pv-advantage-label">Valorização do imóvel</div></div>
        <div><div className="pv-advantage-icon"><PvIcon name="swap" size={15} /></div><div className="pv-advantage-label">Demanda diversificada o ano todo</div></div>
      </div>

      <PvFooter n={4} />
    </div>
  );
}

/* --------------------------------- PÁGINA 5 --------------------------------- */

function PvPagina5({ result }) {
  const { chosen } = result;
  const checklist = [
    "Localização com demanda consistente para negócios, universidades e eventos",
    "Perfil do imóvel adequado ao público de curta temporada",
    "Comparáveis utilizados como referência para a estimativa",
    "Precificação alinhada às características e ao posicionamento do imóvel",
  ];
  return (
    <div className="pv-page">
      <div className="pv-eyebrow">Base da análise</div>
      <h2 className="pv-title-sm">Por que este imóvel tem esse potencial?</h2>
      <p className="pv-sub" style={{ maxWidth: "none" }}>Nossa estimativa considera referências de mercado e características que ajudam a avaliar a atratividade do imóvel para locação por temporada.</p>

      <div className="pv-indicators3" style={{ marginTop: 18 }}>
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="building" size={16} /></div>
          <div className="pv-indicator-num">{MARKET_REFERENCE.imoveisAnunciados}</div>
          <div className="pv-indicator-desc">{MARKET_REFERENCE.imoveisAnunciadosDesc}</div>
        </div>
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="percent" size={16} /></div>
          <div className="pv-indicator-num">{MARKET_REFERENCE.ocupacaoMediaPct}%</div>
          <div className="pv-indicator-desc">{MARKET_REFERENCE.ocupacaoMediaDesc}</div>
        </div>
        <div className="pv-indicator">
          <div className="pv-indicator-icon"><PvIcon name="users" size={16} /></div>
          <div className="pv-indicator-num">{chosen.length}</div>
          <div className="pv-indicator-desc">imóveis semelhantes analisados</div>
        </div>
      </div>

      <ul className="pv-checklist">
        {checklist.map((c, i) => <li key={i}><PvIcon name="checkcircle" size={15} />{c}</li>)}
      </ul>

      <PvFooter n={5} />
    </div>
  );
}

/* --------------------------------- PÁGINA 6 --------------------------------- */

function PvPagina6({ texts, setTexts, editable }) {
  const services = [
    { icon: "pin", label: "Posicionamento estratégico do anúncio" },
    { icon: "tag", label: "Precificação dinâmica conforme demanda" },
    { icon: "chat", label: "Atendimento ágil e comunicação com hóspedes" },
    { icon: "calendar", label: "Gestão de reservas e calendário" },
    { icon: "clipboard", label: "Acompanhamento da operação" },
    { icon: "tool", label: "Manutenção e padrão de qualidade" },
    { icon: "chart", label: "Relatórios e análise de desempenho" },
  ];
  return (
    <div className="pv-page">
      <div className="pv-eyebrow">Gestão profissional</div>
      <h2 className="pv-title-sm">Potencial existe. Resultado exige estratégia.</h2>
      <p className="pv-sub" style={{ maxWidth: "none" }}>Para transformar potencial em resultado consistente, uma gestão profissional acompanha toda a operação.</p>

      <div className="grid g2" style={{ marginTop: 10, alignItems: "start" }}>
        <div>
          <ul className="pv-services">
            {services.map((s, i) => (
              <li key={i}><span className="ic"><PvIcon name={s.icon} size={13} /></span>{s.label}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="pv-side-card">
            <div className="t">Cuidamos de todo o ciclo da locação por temporada</div>
            <div className="d">para você ter mais resultado e tranquilidade.</div>
          </div>
          <div className="pv-next-card">
            <div className="lbl">Próximo passo</div>
            <div className="msg">Vamos conversar sobre como podemos maximizar o potencial deste imóvel.</div>
            <div className="contact">
              <PvIcon name="phone" size={15} />
              {editable ? (
                <input
                  value={texts.contato}
                  onChange={(e) => setTexts({ ...texts, contato: e.target.value })}
                  style={{ background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.4)", color: "#fff", fontSize: 14, fontWeight: 700, padding: "2px 0", width: 160 }}
                />
              ) : (
                <span>{texts.contato}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pv-methodology-note">
        <b>Metodologia da análise</b> — estimativas baseadas em referências de mercado, imóveis comparáveis e
        informações disponíveis em plataformas de hospedagem por temporada.
      </div>

      <PvFooter n={6} left="Este estudo tem caráter informativo e não constitui garantia de resultado." />
    </div>
  );
}

/* --------------------------------- documento completo --------------------------------- */

function PresentacaoPremiumDoc({ target, result, texts, setTexts, photo, codigo, editable }) {
  return (
    <div className="pv-doc">
      <PvPagina1 target={target} result={result} photo={photo} codigo={codigo} />
      <PvPagina2 result={result} />
      <PvPagina3 />
      <PvPagina4 result={result} />
      <PvPagina5 result={result} />
      <PvPagina6 texts={texts} setTexts={setTexts} editable={editable} />
    </div>
  );
}

function ApresentacaoScreen({ target, result, texts, setTexts, photo, setPhoto, codigo, exportRef, onExportPdf, exporting }) {
  const fileInputRef = React.useRef(null);

  if (!result || result.empty) {
    return (
      <div>
        <div className="eyebrow">Apresentação ao Proprietário</div>
        <h1 className="page-title">Estudo de Potencial</h1>
        <p className="page-sub">Faça uma análise em "Análise Rápida" primeiro. Esta aba usa os resultados calculados por lá, mostrando apenas as informações apropriadas para o proprietário.</p>
      </div>
    );
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="eyebrow">Apresentação ao Proprietário</div>
      <h1 className="page-title" style={{ fontSize: 24, margin: "2px 0" }}>Estudo de Potencial para Locação por Temporada</h1>
      <p className="page-sub">
        Documento de 6 páginas para o proprietário — o destaque financeiro é o resultado líquido estimado, não a receita bruta. Sem comparáveis identificados, pesos, custos internos ou comissão.
        {codigo && <> Código desta análise: <b style={{ color: "var(--ink)" }}>{codigo}</b>.</>}
      </p>

      <div className="pv-photo-tools">
        <label className="btn-file">
          {photo ? "Trocar foto do imóvel" : "Adicionar foto do imóvel (opcional)"}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} />
        </label>
        {photo && <button className="link-btn" onClick={() => setPhoto(null)}>remover foto</button>}
      </div>

      <div className="hstack" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={onExportPdf} disabled={exporting}>{exporting ? "Gerando PDF…" : "Exportar apresentação (PDF)"}</button>
      </div>

      <div ref={exportRef}>
        <PresentacaoPremiumDoc target={target} result={result} texts={texts} setTexts={setTexts} photo={photo} codigo={codigo} editable />
      </div>
    </div>
  );
}

/* =========================================================================
   HISTÓRICO DE ANÁLISES
   (NOVO — armazena e permite recuperar/buscar/exportar cada análise já
   gerada, sem alterar o fluxo atual de "Gerar estimativa". Não expõe
   comparáveis individuais nem dados internos — apenas o que já aparece
   na Análise Rápida/Apresentação daquele estudo.)
   ========================================================================= */

function HistoricoScreen({ historico, onRecuperar }) {
  const [busca, setBusca] = useState("");

  const filtrado = historico.filter((h) => {
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (
      h.codigo.toLowerCase().includes(q) ||
      (h.endereco || "").toLowerCase().includes(q) ||
      (h.tipo || "").toLowerCase().includes(q)
    );
  });

  const handleExportRecord = (h) => {
    const backup = {
      _tipo: "analise-estimador-airbnb-maringa",
      _versao: 1,
      exportadoEm: new Date().toISOString(),
      ...h,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${h.codigo}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="eyebrow">Histórico</div>
      <h1 className="page-title">Histórico de Análises</h1>
      <p className="page-sub">Todas as análises geradas em "Gerar estimativa" ficam registradas aqui automaticamente, com um código único cada uma. Busque por código, endereço ou tipo do imóvel para recuperar, visualizar ou baixar novamente um estudo.</p>

      <div className="card">
        <Field label="Buscar por código, endereço ou tipo do imóvel">
          <input className="rmi-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex: MS-20260904-A1B2, Zona 07, Apartamento…" />
        </Field>

        <table className="rmi-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Código</th><th>Imóvel</th><th>Tipo</th><th>Data</th><th>Resultado mensal provável</th><th>Resultado anual provável</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtrado.map((h) => {
              const mensal = h.result && h.result.ownerResultByScenario ? h.result.ownerResultByScenario.provavel : null;
              const anual = mensal !== null ? mensal * 12 : null;
              const data = new Date(h.criadoEm);
              return (
                <tr key={h.codigo}>
                  <td className="rmi-mono">{h.codigo}</td>
                  <td>{h.endereco || "—"}</td>
                  <td>{h.tipo || "—"}</td>
                  <td>{Number.isNaN(data.getTime()) ? "—" : pvFormatDate(data)}</td>
                  <td className="rmi-mono">{mensal !== null ? fmtMoney(mensal) : "—"}</td>
                  <td className="rmi-mono">{anual !== null ? fmtMoney(anual) : "—"}</td>
                  <td className="hstack">
                    <button className="link-btn" onClick={() => onRecuperar(h)}>recuperar</button>
                    <button className="link-btn" onClick={() => handleExportRecord(h)}>baixar JSON</button>
                  </td>
                </tr>
              );
            })}
            {filtrado.length === 0 && (
              <tr><td colSpan={7} className="footnote" style={{ padding: 16 }}>
                {historico.length === 0 ? "Nenhuma análise gerada ainda. Use \"Gerar estimativa\" na Análise Rápida." : "Nenhuma análise encontrada com essa busca."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   ROOT APP
   ========================================================================= */

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("analise");
  const [comparables, setComparablesState] = useState([]);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [target, setTarget] = useState(EMPTY_TARGET);
  const [excludedIds, setExcludedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [presentation, setPresentation] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // NOVO — código único da análise atual + Histórico de Análises (persistido localmente)
  const [analysisCode, setAnalysisCode] = useState(null);
  const [historico, setHistoricoState] = useState([]);

  useEffect(() => {
    (async () => {
      const savedComps = await loadJSON("comparables", null);
      const savedSettings = await loadJSON("settings", null);
      const savedHistorico = await loadJSON("historicoAnalises", null);
      // Only seed demo data the very first time (key never saved before).
      // If the person has since saved an empty list on purpose, respect that.
      setComparablesState(savedComps !== null ? savedComps : DEMO_COMPARABLES);
      setSettingsState(normalizeSettings(savedSettings));
      setHistoricoState(Array.isArray(savedHistorico) ? savedHistorico : []);
      setReady(true);
    })();
  }, []);

  const setComparables = useCallback((next) => {
    setComparablesState(next);
    saveJSON("comparables", next).then((ok) => { if (!ok) setSaveError(true); });
  }, []);
  const setSettings = useCallback((next) => {
    setSettingsState(next);
    saveJSON("settings", next).then((ok) => { if (!ok) setSaveError(true); });
  }, []);
  const setHistorico = useCallback((next) => {
    setHistoricoState(next);
    saveJSON("historicoAnalises", next).then((ok) => { if (!ok) setSaveError(true); });
  }, []);

  const handleAnalyze = () => {
    setExcludedIds([]);
    const r = runAnalysis(target, comparables, settings, []);
    setResult(r);
    setPresentation(false);
    // NOVO — cada análise gerada recebe um código único e é registrada no
    // Histórico (mesmo fluxo de "Gerar estimativa" de sempre, sem nenhuma
    // etapa extra para quem só quer analisar).
    setHistorico((prevHistorico) => {
      const codigo = generateAnalysisCode(prevHistorico.map((h) => h.codigo));
      setAnalysisCode(codigo);
      const registro = {
        codigo,
        criadoEm: new Date().toISOString(),
        endereco: target.bairro || target.zona || "",
        tipo: target.tipo,
        target,
        result: r,
      };
      const next = [registro, ...prevHistorico];
      saveJSON("historicoAnalises", next).then((ok) => { if (!ok) setSaveError(true); });
      return next;
    });
  };
  const handleExcludeComp = (id) => {
    const nextExcluded = [...excludedIds, id];
    setExcludedIds(nextExcluded);
    setResult(runAnalysis(target, comparables, settings, nextExcluded));
  };

  // NOVO — recuperar uma análise do Histórico: repõe o imóvel e o resultado
  // exatamente como estavam no momento em que a análise foi gerada.
  const handleRecuperarAnalise = (registro) => {
    setTarget(registro.target);
    setExcludedIds([]);
    setResult(registro.result);
    setAnalysisCode(registro.codigo);
    setPresentation(false);
    setView("analise");
  };

  // NOVO — "Importar análise anterior": preenche o formulário da Análise
  // Rápida a partir de um JSON exportado (do Histórico ou de uma análise
  // individual), sem alterar o fluxo normal de análise.
  const handleImportAnalysis = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const importedTarget = data && data.target ? data.target : (data && data._tipo === "analise-estimador-airbnb-maringa" ? data.target : null);
        if (!importedTarget || typeof importedTarget !== "object") {
          window.alert("Não foi possível reconhecer este arquivo como uma análise exportada por esta ferramenta.");
          return;
        }
        setTarget({ ...EMPTY_TARGET, ...importedTarget });
        window.alert("Dados da análise importados. Revise os campos e clique em \"Gerar estimativa\" para continuar.");
      } catch (err) {
        window.alert("Não foi possível ler este arquivo.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- NOVO: textos editáveis + foto opcional da aba Apresentação (persistidos localmente) ---
  const [apresentacaoTexts, setApresentacaoTextsState] = useState(DEFAULT_APRESENTACAO_TEXTS);
  const [apresentacaoFoto, setApresentacaoFotoState] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const presentationExportRef = React.useRef(null);
  useEffect(() => {
    loadJSON("apresentacaoTexts", null).then((saved) => {
      if (saved) setApresentacaoTextsState({ ...DEFAULT_APRESENTACAO_TEXTS, ...saved });
    });
    loadJSON("apresentacaoFoto", null).then((saved) => {
      if (saved) setApresentacaoFotoState(saved);
    });
  }, []);
  const setApresentacaoTexts = useCallback((next) => {
    setApresentacaoTextsState(next);
    saveJSON("apresentacaoTexts", next);
  }, []);
  const setApresentacaoFoto = useCallback((next) => {
    setApresentacaoFotoState(next);
    saveJSON("apresentacaoFoto", next);
  }, []);

  // --- NOVO: exportar o Estudo de Potencial (6 páginas) para PDF ---
  // Captura cada página (.pv-page) individualmente e a coloca em uma página
  // de PDF própria — evita cortar cards ao meio, o que aconteceria se o
  // documento inteiro fosse capturado como uma única imagem e fatiado por
  // altura de pixel (uma página do estudo podia acabar dividida entre duas
  // páginas do PDF, ou duas páginas do estudo caberem numa só).
  const handleExportPdf = async () => {
    if (!presentationExportRef.current) return;
    setExportingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const pageNodes = presentationExportRef.current.querySelectorAll(".pv-page");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageNodes.length; i++) {
        const canvas = await html2canvas(pageNodes[i], { scale: 2, backgroundColor: "#FFFFFF" });
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const imgHeightAtFullWidth = (canvas.height * pageWidth) / canvas.width;
        if (i > 0) pdf.addPage();
        if (imgHeightAtFullWidth <= pageHeight) {
          pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeightAtFullWidth);
        } else {
          // Página com mais conteúdo do que cabe numa folha A4 em escala 1:1:
          // reduz proporcionalmente para caber inteira, em vez de cortar.
          const scale = pageHeight / imgHeightAtFullWidth;
          const w = pageWidth * scale;
          const offsetX = (pageWidth - w) / 2;
          pdf.addImage(imgData, "JPEG", offsetX, 0, w, pageHeight);
        }
      }
      const base = (target.bairro || target.zona || "imovel").replace(/[^a-zA-Z0-9]+/g, "_");
      pdf.save(`Estudo_de_Potencial_${base}.pdf`);
    } catch (e) {
      window.alert("Não foi possível gerar o PDF neste navegador. Tente novamente ou use Arquivo > Imprimir > Salvar como PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // --- NOVO: backup / restauração de dados ---
  const handleExportBackup = () => {
    const backup = {
      _tipo: "backup-estimador-airbnb-maringa",
      _versao: 1,
      exportadoEm: new Date().toISOString(),
      comparables, settings, apresentacaoTexts,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-estimador-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleImportBackup = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!window.confirm("Isso vai substituir os dados atuais deste computador pelos dados do arquivo de backup. Continuar?")) return;
        if (Array.isArray(data.comparables)) setComparables(data.comparables);
        if (data.settings) setSettings(data.settings);
        if (data.apresentacaoTexts) setApresentacaoTexts(data.apresentacaoTexts);
        window.alert("Backup importado com sucesso.");
      } catch (err) {
        window.alert("Não foi possível ler este arquivo. Verifique se é um backup exportado por esta ferramenta.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!ready) {
    return <div className="rmi-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div className="footnote">Carregando…</div></div>;
  }

  if (presentation) {
    return (
      <div className="rmi-root">
        <GlobalStyle />
        <div style={{ padding: "28px 20px" }}>
          <PresentationView target={target} result={result} onBack={() => setPresentation(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="rmi-root">
      <GlobalStyle />
      <div className="rmi-shell">
        <div className="rmi-sidebar">
          <div className="rmi-brand">Inteligência de Mercado<br />Locação por Temporada<small>Maringá / PR</small></div>
          <Nav view={view} setView={setView} />
          {saveError && <div className="footnote" style={{ marginTop: "auto", color: "#E7B9AE", padding: "10px 12px" }}>Não foi possível salvar as últimas alterações neste dispositivo.</div>}
        </div>
        <div className="rmi-mobile-nav"><Nav view={view} setView={setView} mobile /></div>
        <div className="rmi-main">
          {view === "analise" && (
            <>
              <QuickAnalysisScreen target={target} setTarget={setTarget} onAnalyze={handleAnalyze} comparablesCount={comparables.length} onImportAnalysis={handleImportAnalysis} />
              {result && (
                <div style={{ marginTop: 28 }}>
                  <ResultPanel result={result} target={target} settings={settings} onTogglePresentation={() => setPresentation(true)} onExcludeComp={handleExcludeComp} excludedIds={excludedIds} />
                </div>
              )}
            </>
          )}
          {view === "base" && <BaseScreen comparables={comparables} setComparables={setComparables} />}
          {view === "referencias" && <ReferenceBankScreen comparables={comparables} />}
          {view === "config" && <SettingsScreen settings={settings} setSettings={setSettings} onExportBackup={handleExportBackup} onImportBackup={handleImportBackup} />}
          {view === "apresentacao" && (
            <ApresentacaoScreen
              target={target} result={result} texts={apresentacaoTexts} setTexts={setApresentacaoTexts}
              photo={apresentacaoFoto} setPhoto={setApresentacaoFoto} codigo={analysisCode}
              exportRef={presentationExportRef} onExportPdf={handleExportPdf} exporting={exportingPdf}
            />
          )}
          {view === "historico" && <HistoricoScreen historico={historico} onRecuperar={handleRecuperarAnalise} />}
        </div>
      </div>
    </div>
  );
}
