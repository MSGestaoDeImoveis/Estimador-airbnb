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
