# Testes da Fase 2 — Camada de acesso a dados

Três scripts, dois já executados e aprovados por mim, um para você rodar.

## 1. `test-mappers.mjs` — JÁ EXECUTADO, 26/26 OK

Testa as funções puras de conversão (`camelToSnake`, `snakeToCamel`,
`rowToApp`, `appToRow`) e de classificação de erro (`shapeError`). Não
precisa de rede, de Supabase, nem de credenciais — roda em qualquer
lugar com Node instalado.

```
node tests/fase2/test-mappers.mjs
```

## 2. `test-field-coverage.mjs` — JÁ EXECUTADO, 193/193 campos OK

Pega **todos** os campos reais de 19 das 21 entidades (direto dos
schemas do `EstimatorCore.jsx`), roda `camelToSnake` em cada um, e
confere que o resultado bate exatamente com o nome de coluna que existe
de verdade nos arquivos SQL da Fase 1 (`../supabase-fase1/migrations/`).
Não testa `apresentacao_config` nem `parceria_config` porque essas duas
não seguem conversão automática — ver a próxima seção e o relatório da
Fase 2.

```
node tests/fase2/test-field-coverage.mjs
```

## 3. `test-integration-supabase.mjs` — NÃO EXECUTADO POR MIM

Este eu não rodei — não tenho acesso à internet para `supabase.co` nem
às credenciais do seu projeto neste ambiente. É um roteiro pronto para
você rodar, uma vez, contra um projeto Supabase (de preferência um de
teste). Ele testa criação/leitura/atualização/exclusão e, principalmente,
que um usuário B não consegue ver os dados de um usuário A (prova real
do RLS, com duas sessões de verdade, não só "parece que funciona").

Antes de rodar:
1. Preencha `USUARIO_A`/`USUARIO_B` no topo do arquivo com dois usuários
   de teste já cadastrados no seu Supabase Auth.
2. Garanta que as migrations da Fase 1 já foram aplicadas nesse projeto.
3. `VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... node tests/fase2/test-integration-supabase.mjs`

Ele só cria/edita/apaga um registro de proprietário claramente marcado
como teste (`"PROPRIETÁRIO DE TESTE — FASE 2"`, id prefixado com
`teste-fase2-`) — nunca mexe em dados que já existirem na tabela.
