// =============================================================================
// FASE 2 — Teste de INTEGRAÇÃO contra um Supabase real
// =============================================================================
//
// ESTE SCRIPT NÃO FOI EXECUTADO POR MIM. Não tenho acesso à internet para
// supabase.co nem às credenciais do seu projeto neste ambiente — só validei
// a camada com testes puros (tests/fase2/test-mappers.mjs e
// test-field-coverage.mjs), que não precisam de rede.
//
// Este script é para VOCÊ rodar, uma vez, contra um projeto Supabase (de
// preferência um projeto de TESTE, não o de produção, já que ele cria e
// apaga registros de verdade — sempre claramente identificados, nunca
// mexendo em dados que você já tenha).
//
// COMO RODAR:
//   1. cd codigo-fonte
//   2. npm install
//   3. Defina as variáveis de ambiente (mesmo .env que o app já usa):
//        VITE_SUPABASE_URL=...
//        VITE_SUPABASE_PUBLISHABLE_KEY=...
//   4. Rode com dois usuários de teste já cadastrados no seu Supabase Auth
//      (e-mail/senha) — ajuste as constantes USUARIO_A e USUARIO_B abaixo.
//   5. node tests/fase2/test-integration-supabase.mjs
//
// O QUE ESTE SCRIPT VERIFICA:
//   1. login do Usuário A;
//   2. criar um proprietário de teste;
//   3. ler de volta e conferir que os campos batem;
//   4. atualizar e conferir;
//   5. login do Usuário B;
//   6. confirmar que o Usuário B NÃO enxerga o registro do Usuário A
//      (prova real do RLS, não só "parece que funciona");
//   7. voltar para o Usuário A e excluir o registro de teste (limpeza).
//
// NÃO faz: testes destrutivos em dados que não foram criados por ele
// mesmo, alteração de RLS, uso de SERVICE ROLE KEY.
// =============================================================================

import { supabase } from "../../src/lib/supabaseClient.js";
import { proprietariosRepo } from "../../src/lib/supabaseData.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// AJUSTE ANTES DE RODAR — dois usuários de teste já existentes no seu
// Supabase Auth (crie-os no painel se ainda não tiver).
const USUARIO_A = { email: "teste-a@example.com", senha: "TROQUE_AQUI" };
const USUARIO_B = { email: "teste-b@example.com", senha: "TROQUE_AQUI" };

// CORREÇÃO — este script usa o MESMO client importado de
// supabaseClient.js que supabaseData.js também importa (o import do
// ESM é resolvido para o mesmo arquivo, então é a mesma instância —
// um singleton de verdade, não duas cópias). A versão anterior deste
// script criava um client separado com createClient() e autenticava
// só nele; como os repositórios de supabaseData.js continuavam usando
// o client de supabaseClient.js (sem sessão nenhuma), o teste de RLS
// não provava nada de verdade — a troca de sessão abaixo agora afeta
// exatamente o client que os repositórios usam.

function assert(cond, msg) {
  if (!cond) throw new Error("FALHOU: " + msg);
  console.log("OK   - " + msg);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY antes de rodar.");
    process.exit(1);
  }

  console.log("1) Login do Usuário A...");
  const { error: loginErrA } = await supabase.auth.signInWithPassword(USUARIO_A);
  assert(!loginErrA, "login do Usuário A funcionou");

  console.log("2) Criando proprietário de teste...");
  const idTeste = "teste-fase2-" + Date.now();
  const criar = await proprietariosRepo.create({ id: idTeste, nome: "PROPRIETÁRIO DE TESTE — FASE 2" });
  assert(criar.ok, "criação retornou ok=true");
  assert(criar.data.id === idTeste, "id preservado exatamente como enviado (TEXT, sem virar uuid)");
  assert(criar.data.nome === "PROPRIETÁRIO DE TESTE — FASE 2", "campo nome voltou correto");
  assert(criar.data.userId === undefined, "user_id NÃO aparece no objeto devolvido ao app");

  console.log("3) Lendo de volta por id...");
  const leitura = await proprietariosRepo.getById(idTeste);
  assert(leitura.ok && leitura.data.nome === "PROPRIETÁRIO DE TESTE — FASE 2", "leitura bate com o que foi criado");

  console.log("4) Atualizando...");
  const upd = await proprietariosRepo.update(idTeste, { telefone: "44999999999" });
  assert(upd.ok && upd.data.telefone === "44999999999", "atualização refletida");

  console.log("5) Login do Usuário B (troca de sessão no MESMO client usado pelos repositórios)...");
  await supabase.auth.signOut();
  const { error: loginErrB } = await supabase.auth.signInWithPassword(USUARIO_B);
  assert(!loginErrB, "login do Usuário B funcionou");

  console.log("6) Confirmando que o Usuário B NÃO vê o registro do Usuário A...");
  const tentativaB = await proprietariosRepo.getById(idTeste);
  assert(!tentativaB.ok && tentativaB.error.type === "not_found", "RLS escondeu o registro do outro usuário (not_found, não um erro de permissão explícito — assim que o RLS do Postgres se comporta por padrão em SELECT)");

  console.log("7) Voltando para o Usuário A e limpando o registro de teste...");
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword(USUARIO_A);
  const del = await proprietariosRepo.remove(idTeste);
  assert(del.ok, "exclusão do registro de teste funcionou (sem vínculos, deveria funcionar normalmente)");

  console.log("\nTodos os testes de integração passaram.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
