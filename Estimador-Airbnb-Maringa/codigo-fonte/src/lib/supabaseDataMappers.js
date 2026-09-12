// =============================================================================
// FASE 2 — Funções puras da camada de dados (mapeamento + formatação de erro)
// =============================================================================
// Isolado de supabaseData.js de propósito: este arquivo não importa o client
// Supabase nem nada do Vite (`import.meta.env`), então pode ser testado com
// Node puro, sem precisar de rede, de credenciais ou do bundler. Toda a
// lógica que decide "como converter" e "como classificar um erro" mora
// aqui; supabaseData.js só decide "quando chamar".
// =============================================================================

export function camelToSnake(key) {
  return key.replace(/([A-Z])/g, "_$1").toLowerCase();
}
export function snakeToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// Campos que existem no banco só para controle interno (user_id) ou como
// metadado técnico (created_at/updated_at) — nenhum faz parte do modelo
// que o frontend já conhece hoje, então são removidos antes de devolver
// o objeto para quem chamou a camada.
const CAMPOS_INTERNOS = new Set(["user_id", "created_at", "updated_at"]);

// Conversão só nas chaves de primeiro nível (as colunas da linha) — nunca
// dentro do conteúdo de colunas jsonb (target, result, adjustments, costs,
// texts, config, ocupacaoPadrao). O conteúdo dessas colunas já é tratado
// como um "blob congelado" hoje (localStorage) e no banco (jsonb);
// convertê-lo por dentro mudaria o formato que o app espera encontrar lá.
export function rowToApp(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (CAMPOS_INTERNOS.has(k)) continue;
    out[snakeToCamel(k)] = v;
  }
  return out;
}

export function appToRow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

// =============================================================================
// CORREÇÃO (auditoria preventiva de compatibilidade com o PostgreSQL) —
// erro real em produção: PostgreSQL 22P02 "invalid input syntax for type
// numeric" ao criar um comparável com um campo numérico opcional vazio.
// Causa raiz: `appToRow` (acima) nunca conheceu o tipo da coluna de
// destino — ela só renomeia chaves, então uma string vazia "" digitada
// num campo numérico/data, ou um campo de referência (FK) deixado em
// "—", chegava ao Postgres exatamente como "", que não é um valor válido
// para colunas `numeric`/`integer`/`date`, e para uma coluna de FK "" é
// tratada como um valor de texto que não corresponde a nenhum registro
// (erro de FK, 23503) — em nenhum dos dois casos "" significa a mesma
// coisa que "o usuário não preencheu".
//
// A correção é consciente do tipo da coluna, por tabela: só os campos
// abaixo (numéricos, de data, ou referências opcionais) recebem a
// conversão "" → null. Qualquer coluna de texto, boolean ou jsonb não
// listada aqui passa por `appToRow` exatamente como sempre passou — "",
// 0, false, null e o conteúdo de colunas jsonb continuam intocados.
const TIPOS_ESPECIAIS_POR_TABELA = {
  comparables: {
    quartos: "numero", banheiros: "numero", area: "numero", capacidade: "numero", camas: "numero",
    diaria: "numero", taxa_limpeza: "numero", nota: "numero", avaliacoes: "numero", data_pesquisa: "data",
  },
  settings: {
    comissao_pct: "numero", noites_mes: "numero", duracao_media_estadia: "numero",
  },
  imoveis: {
    quartos: "numero", banheiros: "numero", camas: "numero", capacidade: "numero",
    proprietario_id: "fk", parceiro_id: "fk", inicio_gestao: "data", percentual_comissao: "numero",
  },
  reservas: {
    imovel_id: "fk", checkin: "data", checkout: "data", valor: "numero", taxas: "numero",
  },
  indicacoes: {
    parceiro_id: "fk", imovel_id: "fk", data_indicacao: "data", inicio_participacao: "data",
  },
  limpeza: {
    imovel_id: "fk", reserva_id: "fk", data: "data",
  },
  lavanderia: {
    imovel_id: "fk", envio: "data", recebimento: "data", quantidade: "numero",
  },
  enxoval: {
    imovel_id: "fk", quantidade_necessaria: "numero", quantidade_atual: "numero", estoque_minimo: "numero",
  },
  manutencao: {
    imovel_id: "fk", data: "data", prestador_id: "fk", custo: "numero",
  },
  pendencias: {
    imovel_id: "fk", prazo: "data",
  },
  onboarding_checklist_itens: {
    imovel_id: "fk",
  },
  financeiro: {
    imovel_id: "fk", reserva_id: "fk", valor: "numero", data: "data",
  },
  comissoes: {
    imovel_id: "fk", reserva_id: "fk", financeiro_id: "fk", receita: "numero", percentual: "numero",
  },
  repasses: {
    proprietario_id: "fk", imovel_id: "fk", comissao_id: "fk", receita: "numero", despesas: "numero", comissao: "numero", data: "data",
  },
  repasses_parceiros: {
    parceiro_id: "fk", imovel_id: "fk", comissao_recebida: "numero", valor_participacao: "numero",
    data_prevista: "data", data_pagamento: "data", origem_comissao_id: "fk",
  },
};

// Só "" e `undefined` (quando a chave está mesmo presente no objeto) viram
// `null` — e só para os tipos "numero"/"data"/"fk" acima. Qualquer outro
// valor (número real, string não vazia, 0, false, null, um id válido)
// passa exatamente como está, sem nenhuma outra transformação.
function sanitizarValorPorTipo(valor, tipo) {
  if ((tipo === "numero" || tipo === "data" || tipo === "fk") && (valor === "" || valor === undefined)) {
    return null;
  }
  return valor;
}

// Mesma função que `appToRow`, mas recebendo também o nome da tabela de
// destino (snake_case, o mesmo nome já usado em `makeListRepo`/
// `makeSingletonRepo`), para poder consultar `TIPOS_ESPECIAIS_POR_TABELA`
// e sanear só os campos que precisam. Tabelas ou colunas ausentes do mapa
// acima não sofrem nenhuma alteração — o comportamento de `appToRow` é
// preservado por padrão.
export function appToRowSeguro(obj, table) {
  const tipos = TIPOS_ESPECIAIS_POR_TABELA[table] || {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const dbKey = camelToSnake(k);
    out[dbKey] = sanitizarValorPorTipo(v, tipos[dbKey]);
  }
  return out;
}

// `type` é um destes valores fixos, para quem consome a camada poder
// decidir o que fazer sem precisar entender códigos do Postgres:
//   "not_found"   registro não existe (ou RLS escondeu por não ser seu)
//   "validation"  dado inválido antes mesmo de chamar o Supabase
//   "permission"  RLS recusou a operação
//   "constraint"  UNIQUE ou FOREIGN KEY do banco impediu a operação
//                 (ex.: tentar excluir um imóvel que ainda tem reservas —
//                 a FK com ON DELETE RESTRICT da Fase 1 gera esse erro)
//   "network"     não conseguiu nem falar com o Supabase
//   "unknown"     qualquer outra coisa não prevista acima
export function shapeError(error) {
  if (!error) return { type: "unknown", message: "Erro desconhecido.", raw: error };
  const code = error.code || "";
  if (code === "PGRST116") return { type: "not_found", message: "Registro não encontrado.", raw: error };
  if (code === "23505") return { type: "constraint", message: "Já existe um registro com esse valor único (ex.: código de parceiro repetido).", raw: error };
  if (code === "23503") return { type: "constraint", message: "Esta operação foi impedida porque existem registros vinculados (ex.: exclusão bloqueada por integridade referencial).", raw: error };
  if (code === "42501" || /row-level security/i.test(error.message || "")) {
    return { type: "permission", message: "Acesso negado pela política de segurança (RLS).", raw: error };
  }
  if (error.message && /fetch|network|failed to fetch/i.test(error.message)) {
    return { type: "network", message: "Não foi possível se conectar ao Supabase.", raw: error };
  }
  return { type: "unknown", message: error.message || "Erro inesperado.", raw: error };
}

export function ok(data) { return { ok: true, data }; }
export function fail(error) { return { ok: false, error: shapeError(error) }; }
