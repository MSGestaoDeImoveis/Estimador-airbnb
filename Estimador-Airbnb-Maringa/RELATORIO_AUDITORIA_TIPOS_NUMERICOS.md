# RELATÓRIO — AUDITORIA PREVENTIVA DE COMPATIBILIDADE FRONTEND → POSTGRESQL

Projeto: Estimador de Potencial — Locação por Temporada (Maringá/PR) +
Gestão de Imóveis (MS Gestão de Imóveis).

Baseline: `Estimador-Airbnb-Maringa_FINAL_GITHUB_VERCEL.zip`, a versão
publicada e validada, fornecida nesta conversa.

**Ordem seguida, exatamente como instruído: AUDITAR → IDENTIFICAR →
REPRODUZIR → PROVAR → CLASSIFICAR → só depois CORRIGIR.** Nenhuma linha de
código foi alterada antes de concluir a auditoria e a reprodução abaixo.

---

## 1. Causa raiz do erro relatado

```
PostgreSQL 22P02 — invalid input syntax for type numeric: ""
```

Encontrada em `src/lib/supabaseDataMappers.js`, função `appToRow`
(linhas 39-45, antes da correção):

```js
export function appToRow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}
```

Esta função é usada por **todos os 21 repositórios** da camada de dados
(`makeListRepo`/`makeSingletonRepo`, em `supabaseData.js`) e faz **só**
renomear as chaves de camelCase para snake_case — ela nunca teve nenhum
conhecimento do tipo da coluna de destino no Postgres. Um campo numérico
opcional deixado em branco num formulário produz `""` (string vazia) no
estado React (`e.target.value` de um `<input type="number">` vazio), e
essa string chega ao Postgres exatamente como `""` — inválida para
colunas `numeric`/`integer`/`date`.

## 2. Auditoria — comparação de todas as colunas contra o que o frontend envia

Comparei as 3 migrations (`0001_modulos_01_07.sql`,
`0002_gestao_de_imoveis.sql`, `0003_rls_policies.sql`) com o schema real
usado pelas telas (`GESTAO_SCHEMAS`, `EMPTY_COMP`, `DEFAULT_SETTINGS` em
`EstimatorCore.jsx`) e com o comportamento de `GestaoField`/`ComparableForm`
(como cada tipo de campo — `number`, `date`, `ref`, `select`, `text`,
`checkbox` — lê e escreve o valor).

**Achado estrutural, confirmado por leitura de código:**
- `GestaoField` (linha 3574): campos `number`/`date` usam `<input
  type=.../>` com `value={value || ""}` e `onChange={(e) =>
  onChange(e.target.value)}` — sempre a string bruta, nunca convertida.
- `GestaoField` (linha 3565): campos `ref` (referências/FK) usam um
  `<select>` cuja opção "sem seleção" tem `value=""` — se deixado assim,
  `onChange` recebe `""`.
- `ComparableForm` (linhas 1569-1589): todos os `<input type="number">` e
  o `<input type="date">` seguem exatamente o mesmo padrão.
- **Exceção que já está correta:** a tela de Configurações (`SettingsScreen`,
  linhas 2000, 2013, 2014) já chama `toNum(e.target.value, ...)` antes de
  salvar — os 3 campos numéricos de `settings` já chegavam sempre como
  número, mesmo antes desta correção.

Nenhuma outra inconsistência foi encontrada em: nomes de campos
(camelCase ↔ snake_case — já coberto e confirmado por
`test-field-coverage.mjs`, 193/193, reexecutado nesta auditoria sem
alteração), colunas ausentes de um lado ou do outro, boolean recebendo
valor incompatível (todos os checkboxes produzem `true`/`false` reais),
ou conteúdo de colunas `jsonb` incompatível (Postgres aceita qualquer
JSON válido em `jsonb` — uma `""` dentro de `settings.costs`, por
exemplo, não gera erro de tipo, só continuaria sendo uma string dentro do
JSON, exatamente como já é hoje).

## 3. Reprodução (payload real, função real, sem mock)

Escrevi um script que importa `appToRow`/`appToRowSeguro` **diretamente**
de `supabaseDataMappers.js` (sem simular nada) e monta o objeto exato que
sairia de vários formulários, mostrando o payload que seria enviado a
`supabase.from(tabela).insert(row)`. Trecho representativo (comparável —
o caso já confirmado em produção):

```
Objeto no estado React: {"quartos":2,"area":"","diaria":"","taxaLimpeza":"","nota":"","avaliacoes":""}
Payload enviado (ANTES da correção):
  "area": { "valor": "", "tipoDaColuna": "numeric" }
  "diaria": { "valor": "", "tipoDaColuna": "numeric" }
  "taxa_limpeza": { "valor": "", "tipoDaColuna": "numeric" }
  ...
```

O mesmo padrão foi reproduzido para: `imoveis` (números + duas
referências não selecionadas), `reservas` (valor/taxas/datas),
`limpeza` (referência opcional), `enxoval` (quantidades), `manutencao`
(referência + custo), `financeiro` (referência + data),
`repasses_parceiros` (datas) — em todos os casos, `appToRow` devolveu
`""` inalterada para colunas `numeric`/`integer`/`date`/FK, usando a
**mesma função, sem nenhuma variação de código** entre elas e o caso já
confirmado em produção.

**Limitação honesta:** não tenho acesso a um Postgres real nesta sessão
para executar o `insert` de fato contra o banco. A classificação abaixo
como "bug comprovado" para os casos além do `comparables.area` (já
confirmado em produção) se apoia em: (a) o mecanismo é **idêntico**
código a código ao caso já confirmado — mesma função, mesmo caminho,
mesma ausência de tratamento; e (b) o comportamento do PostgreSQL para
`''::numeric`, `''::integer`, `''::date` (erro 22P02) e para uma FK
`text` apontando para um valor que não existe na tabela referenciada
(erro 23503) é determinístico e documentado — não uma suposição. Ainda
assim, marco isso explicitamente para você não confundir com um teste
against um banco real.

## 4. Classificação de todos os casos auditados

| Área | Colunas | Classificação | Motivo |
|---|---|---|---|
| `comparables` | `quartos, banheiros, area, capacidade, camas, diaria, taxa_limpeza, nota, avaliacoes` (numeric/integer), `data_pesquisa` (date) | 🔴 **bug comprovado** | `area` confirmado em produção; os demais usam a mesma função sem nenhuma diferença |
| `comparables.ocupacao_observada` | text | ⚪ **falso positivo** | Coluna é `text`, não `numeric` — `""` é um valor válido; não deve ser (e não foi) alterado |
| `imoveis` | `quartos, banheiros, camas, capacidade, percentual_comissao` (numeric/integer), `inicio_gestao` (date), `proprietario_id, parceiro_id` (FK opcional) | 🔴 **bug comprovado** | Mesmo mecanismo; campos `ref`/`number`/`date` não marcados como obrigatórios no schema do formulário |
| `reservas` | `valor, taxas` (numeric), `checkin, checkout` (date), `imovel_id` (FK, não marcado obrigatório) | 🔴 **bug comprovado** | Idem |
| `indicacoes` | `data_indicacao, inicio_participacao` (date), `parceiro_id, imovel_id` (FK) | 🔴 **bug comprovado** | Idem |
| `limpeza` | `data` (date), `imovel_id, reserva_id` (FK, `reserva_id` explicitamente opcional na tela) | 🔴 **bug comprovado** | Idem |
| `lavanderia` | `envio, recebimento` (date), `quantidade` (integer), `imovel_id` (FK) | 🔴 **bug comprovado** | Idem |
| `enxoval` | `quantidade_necessaria, quantidade_atual, estoque_minimo` (integer), `imovel_id` (FK) | 🔴 **bug comprovado** | Idem |
| `manutencao` | `data` (date), `custo` (numeric), `imovel_id, prestador_id` (FK, `prestador_id` opcional) | 🔴 **bug comprovado** | Idem |
| `pendencias` | `prazo` (date), `imovel_id` (FK opcional) | 🔴 **bug comprovado** | Idem |
| `financeiro` | `valor` (numeric), `data` (date), `imovel_id, reserva_id` (FK, ambos opcionais) | 🔴 **bug comprovado** | Idem |
| `comissoes` | `receita, percentual` (numeric), `imovel_id, reserva_id, financeiro_id` (FK, todos opcionais) | 🔴 **bug comprovado** | Idem |
| `repasses` | `receita, despesas, comissao` (numeric), `data` (date), `proprietario_id, imovel_id, comissao_id` (FK) | 🔴 **bug comprovado** | Idem |
| `repasses_parceiros` | `comissao_recebida, valor_participacao` (numeric), `data_prevista, data_pagamento` (date), `parceiro_id, imovel_id` (FK) | 🔴 **bug comprovado** | Idem |
| `repasses_parceiros.origem_comissao_id` | FK | ⚪ **falso positivo** | Nunca é digitado pelo usuário — é sempre preenchido programaticamente com o id de uma comissão real, no momento em que o repasse é gerado (não passa por nenhum formulário) |
| `onboarding_checklist_itens.imovel_id` | FK | ⚪ **falso positivo** | Sempre preenchido a partir da chave do dicionário (um imóvel real existente), nunca digitado |
| `settings.comissao_pct, noites_mes, duracao_media_estadia` | numeric/integer | ⚪ **falso positivo (já protegido)** | O formulário já chama `toNum()` antes de salvar — nunca chega `""` na prática hoje |
| Campos `text` NOT NULL (`nome`, `titulo`, `item`) | text | ⚪ **falso positivo** | Já bloqueados no cliente antes de salvar (`required: true` + validação no botão Salvar) — nunca chegam vazios ao banco |
| Colunas `jsonb` (`costs`, `adjustments`, `ocupacaoPadrao`, `target`, `result`, `texts`, `config`) | jsonb | ⚪ **falso positivo** | Postgres aceita qualquer JSON válido em `jsonb`; uma `""` interna não gera erro de tipo |
| `apresentacao_config`, `parceria_config` | (todas) | ⚪ **falso positivo** | Usam `makeConfigRepo`, que nunca passou por `appToRow` — mapeamento explícito de 4 campos, sem risco |
| camelCase ↔ snake_case (todas as tabelas) | — | 🟢 **sem problema** | Já coberto e confirmado por `test-field-coverage.mjs` (193/193), reexecutado sem alteração nesta auditoria |
| Boolean recebendo valor incompatível | — | 🟢 **sem problema** | Todos os checkboxes produzem `true`/`false` reais (`e.target.checked`) |

**Nenhum risco foi classificado como 🟡 teórico e depois corrigido** — os
únicos corrigidos abaixo são 🔴 comprovados pelo mecanismo idêntico ao já
confirmado em produção.

## 5. Correção implementada

**Centralizada na fronteira de persistência, como pedido** — nenhum dos
formulários (`ComparableForm`, `GestaoForm`, `GestaoField`) foi tocado.

### Arquivos alterados

| Arquivo | O que mudou | Por quê |
|---|---|---|
| `src/lib/supabaseDataMappers.js` | Nova função `appToRowSeguro(obj, table)` + mapa `TIPOS_ESPECIAIS_POR_TABELA` (uma entrada só para as colunas numéricas/data/referência de cada tabela — todas extraídas das migrations 0001/0002, não inventadas). A função `appToRow` original **não foi removida nem alterada** — continua exportada, exatamente como estava. | É exatamente a "fronteira de serialização" — o lugar certo para uma correção ciente do tipo da coluna, sem tocar em UI nem em regra de negócio. |
| `src/lib/supabaseData.js` | `makeListRepo.create()`/`.update()` e `makeSingletonRepo.save()` passam a chamar `appToRowSeguro(item, table)` em vez de `appToRow(item)`. Nenhuma outra linha do arquivo foi tocada — `makeConfigRepo` (usado por `apresentacao_config`/`parceria_config`) nem chamava `appToRow`, então não precisou de nenhuma mudança. | É onde `appToRow` já era chamado — trocar a chamada é a mudança mínima possível. |

**`gestaoDataBridge.js` não foi alterado** — confirmado que ele nunca
manipula valores de campo individualmente (só orquestra diffs de listas
inteiras); a causa está exclusivamente na camada de mapeamento, como
a auditoria comprovou antes de qualquer alteração.

### Como a correção funciona

```js
function sanitizarValorPorTipo(valor, tipo) {
  if ((tipo === "numero" || tipo === "data" || tipo === "fk") && (valor === "" || valor === undefined)) {
    return null;
  }
  return valor; // qualquer outro caso — incluindo "", 0, false, null,
                // string não vazia — preservado exatamente como está
}
```

Só as colunas explicitamente listadas em `TIPOS_ESPECIAIS_POR_TABELA`
(as mesmas da tabela da seção 4, marcadas 🔴) recebem essa conversão.
Qualquer coluna ausente do mapa — todas as `text`, `boolean`, `jsonb` —
passa por `appToRowSeguro` exatamente como sempre passou por `appToRow`,
byte a byte (comprovado pelo teste da seção 6, item 10).

## 6. Testes criados e executados

Novo arquivo: `tests/fase7/test-correcao-tipos-numericos.mjs` — 46
asserções, todas usando as funções reais de `supabaseDataMappers.js`
(sem mock, sem rede — mesmo padrão de `test-mappers.mjs` da Fase 2).
Cobre exatamente os cenários pedidos:

| Cenário pedido | Coberto |
|---|---|
| Comparável com números opcionais vazios | ✅ |
| Comparável com todos os números preenchidos | ✅ |
| Edição de comparável limpando um número | ✅ |
| Gestão de imóveis com números opcionais vazios | ✅ (imóveis) |
| Gestão de imóveis com números preenchidos | ✅ |
| Reservas com valores/taxas vazios | ✅ |
| Reservas com datas vazias | ✅ |
| Módulos com campos de referência vazios | ✅ (limpeza, manutenção) |
| Módulos com referências preenchidas | ✅ (comissões) |
| Manutenção/enxoval/lavanderia com números vazios | ✅ |
| Financeiro/comissões/repasses com campos numéricos vazios | ✅ |
| Strings vazias continuam strings vazias em coluna text | ✅ |
| Zero continua zero | ✅ |
| False continua false | ✅ |
| Null continua null | ✅ |
| JSONB continua exatamente no formato atual | ✅ |

```
node tests/fase7/test-correcao-tipos-numericos.mjs
→ 46 asserções — TODAS PASSARAM
```

## 7. Regra de não regressão — executada

| Suíte | Resultado |
|---|---|
| `tests/fase2/test-mappers.mjs` | ✅ 26 passaram, 0 falharam |
| `tests/fase2/test-field-coverage.mjs` | ✅ 193 campos, 0 sem correspondência |
| Testes sintéticos da Fase 3 (externa, não alterada) | ✅ Ambas as suítes passaram |
| `tests/fase4/test-bridge.mjs` | ✅ 27 asserções, todas passaram |
| `tests/fase4/test-correcao-concorrencia.mjs` | ✅ 16 asserções, todas passaram |
| `tests/fase5/test-correcoes-auditoria.mjs` (A1/A2/A3) | ✅ 10 asserções, todas passaram |
| `tests/fase6/test-correcao-a5.mjs` (A5) | ✅ 11 asserções, todas passaram |
| `tests/fase7/test-correcao-tipos-numericos.mjs` (novo) | ✅ 46 asserções, todas passaram |
| `npm run build` | ✅ Sucesso, sem erros |
| `npm run lint` (projeto inteiro) | ✅ 0 erros, 25 avisos — mesmo total de antes (os dois arquivos alterados, `supabaseData.js`/`supabaseDataMappers.js`, têm **0 avisos**) |

**Nenhum comportamento previamente validado mudou** — não foi necessário
reverter nada.

## 8. Confirmação de escopo (diff contra a baseline)

```
diff -rq (baseline)/codigo-fonte  (corrigida)/codigo-fonte
→ só 2 arquivos diferem: src/lib/supabaseData.js, src/lib/supabaseDataMappers.js
→ 1 arquivo novo: tests/fase7/test-correcao-tipos-numericos.mjs

diff -rq (baseline)/supabase-fase1  (corrigida)/supabase-fase1
→ nenhuma diferença — schema/migrations intactos
```

- `EstimatorCore.jsx`: **não tocado** — confirma que UI, cálculos, PDFs,
  regras de negócio, comissão de 25%, regra dos 12 meses, parceiros,
  indicações, onboarding, histórico e backup continuam byte a byte iguais.
- `gestaoDataBridge.js`: **não tocado**.
- A1 (`item(ns) de onboarding`), A5 (`mesclarCorrecaoPorId`), A3
  (`setSaveError(true)`): confirmados presentes, contagens inalteradas.
- A4: `grep -c "try {" supabaseData.js` → **0** — continua sem correção,
  como instruído.
- RLS, schema, arquitetura (Frontend → Bridge → Data Layer → Supabase):
  inalterados.

## 9. Conclusão

Além do bug já relatado em produção (`comparables.area`), a auditoria
encontrou **a mesma classe de erro** presente em praticamente todas as
colunas numéricas, de data e de referência opcional das 21 tabelas —
confirmado pelo mecanismo de código idêntico, não por suposição. A
correção foi implementada de forma centralizada, na fronteira de
serialização, sem tocar em UI, cálculos, regras de negócio, schema ou em
`gestaoDataBridge.js`. Toda a bateria de regressão (Fases 2 a 6 + os
novos testes) passa sem nenhuma alteração de comportamento.

---

## Encerramento

- Nenhum deploy foi feito.
- Nada foi enviado ao GitHub.
- A versão publicada original não foi alterada — todo o trabalho foi
  feito em uma cópia.
- A4 permanece sem correção, como instruído.
- Nenhuma nova fase de desenvolvimento foi iniciada.

**PARE.**
