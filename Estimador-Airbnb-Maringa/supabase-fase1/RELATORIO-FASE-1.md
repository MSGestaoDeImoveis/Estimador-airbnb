# Relatório — Fase 1: Preparação do Supabase

**Estimador de Potencial — Locação por Temporada (Maringá/PR)**
**Versão base: V2.3.3.1**

Confirmo antes de tudo: **nenhum arquivo do frontend foi tocado** —
`EstimatorCore.jsx`, `App.jsx`, `main.jsx`, `AuthContext.jsx`,
`LoginScreen.jsx`, `LogoutButton.jsx` continuam exatamente como estavam.
O sistema continua funcionando 100% com `localStorage`, como hoje.

Entrego aqui só o schema SQL (3 arquivos de migration) e este relatório.
**Nada foi executado contra um banco Supabase real** — não tenho acesso
às credenciais do seu projeto, e mesmo que tivesse, a Fase 1 pede só a
preparação, não a aplicação. Os arquivos estão prontos para você rodar
via SQL Editor do Supabase ou `supabase db push` (CLI).

---

## 1. Arquitetura do banco criada

21 tabelas em `public`, todas com RLS habilitado, nenhum dado ainda
(schema vazio). Chaves primárias de entidade em `text` (não `uuid`) —
decisão explicada na seção 9.

## 2. Lista de todas as tabelas

**Módulos 01–07:** `comparables`, `settings`, `historico_analises`,
`apresentacao_config`, `parceria_config`.

**Gestão de Imóveis (módulo 08):** `proprietarios`, `prestadores`,
`parceiros`, `imoveis`, `reservas`, `indicacoes`, `limpeza`,
`lavanderia`, `enxoval`, `manutencao`, `pendencias`,
`onboarding_checklist_itens`, `financeiro`, `comissoes`, `repasses`,
`repasses_parceiros`.

## 3. Campos principais de cada tabela

Ver os 3 arquivos SQL (`migrations/0001...`, `0002...`, `0003...`) — cada
`create table` lista todos os campos com comentários explicando qualquer
decisão não óbvia. Não repito a lista completa aqui para não duplicar
uma fonte de verdade que já existe no SQL.

## 4. Tipos utilizados

Segui a seção 15 do seu documento à risca: `boolean` para booleanos,
`integer` para contagens (quartos, banheiros, capacidade, camas,
quantidades), `numeric` para valores monetários e percentuais, `date`
para datas (nenhum campo atual guarda horário junto com a data, então
não usei `timestamptz` nesses casos — só em `created_at`/`updated_at`,
que são metadados novos, não campos que já existiam), `text` para
textos e para os próprios IDs, `jsonb` para as estruturas congeladas
(`adjustments`, `costs`, `target`, `result`, `texts`, `config`).

## 5. Foreign Keys

Todas as 23 relações listadas na seção 9 do seu documento foram
criadas, nem uma a mais. Nenhuma usa `ON DELETE CASCADE` — todas usam
`ON DELETE RESTRICT` (a exclusão é impedida pelo próprio Postgres
quando existem registros dependentes, que é exatamente o que a lógica
atual do frontend já faz em JavaScript — agora reforçado no banco).

## 6. UNIQUE constraints

- `parceiros.codigo_parceiro` — único.
- `financeiro.reserva_id` — único (uma reserva → um lançamento
  financeiro principal).
- `comissoes.reserva_id` — único (uma reserva → uma comissão).
- `repasses.comissao_id` — único (uma comissão → um repasse ao
  proprietário).
- `repasses_parceiros.origem_comissao_id` — único (uma comissão → um
  repasse ao parceiro).
- `onboarding_checklist_itens (imovel_id, item)` — único (composto).

**Detalhe técnico que vale explicar:** em Postgres, uma constraint
`UNIQUE` numa coluna que aceita `NULL` **já permite múltiplos `NULL`**
(cada `NULL` é tratado como diferente de qualquer outro `NULL` — não
precisei de nenhum índice parcial `WHERE ... IS NOT NULL` para isso
funcionar). Ou seja: registros antigos/manuais sem `reserva_id`,
`comissao_id` etc. continuam podendo existir livremente, e a restrição
só entra em ação quando o valor está de fato preenchido — exatamente
como pedido.

## 7. RLS

Habilitado nas 21 tabelas. Nenhuma tabela ficou de fora.

## 8. Policies

4 por tabela (select/insert/update/delete), todas com a mesma condição:
`user_id = auth.uid()`. Nenhuma policy pública, nenhuma com `USING
(true)`. Escrevi isso como um bloco `DO $$ ... $$` percorrendo as 21
tabelas em vez de repetir manualmente 84 comandos `CREATE POLICY` — o
resultado final no banco é idêntico (84 policies reais), só a forma de
escrever a migration é mais compacta. Se preferir que eu reescreva de
forma totalmente explícita (uma linha por policy, sem laço), aviso que
é só me pedir — não fiz por padrão porque a instrução pedia migrations
"claras e reproduzíveis", e um laço sobre uma lista visível de nomes de
tabela atende isso sem 84 blocos repetidos.

## 9. Estratégia adotada para preservar os IDs atuais

Todas as chaves primárias de entidade (`comparables.id`,
`imoveis.id`, etc.) são `text`, não `uuid`. Isso significa que o `id`
gerado hoje pelo `uid()` do frontend (ex.: `"a1b2c3d4"`) pode ser
inserido exatamente como está, sem nenhuma conversão, e todas as
Foreign Keys que apontam para essas tabelas também são `text` — vão
aceitar esses mesmos valores diretamente. **Nenhum ID precisa ser
trocado na futura migração (Fase 3).**

## 10. Estratégia prevista para a futura migração do localStorage

Não implementada agora (pertence à Fase 3), mas a estrutura já foi
pensada para ela: como os tipos de PK/FK aceitam os IDs atuais
diretamente, a Fase 3 poderá fazer, por entidade, só um `INSERT` em
lote dos registros como estão hoje, respeitando a ordem de dependência
das tabelas (a mesma ordem em que elas foram criadas nesta migration:
proprietarios/prestadores/parceiros → imoveis → reservas/indicações →
demais entidades de imóvel → financeiro → comissões → repasses).

## 11. Como os relacionamentos serão preservados

Como os IDs não mudam (seção 9), cada valor de `imovelId`,
`proprietarioId`, `reservaId` etc. que já existe hoje nos dados vai
continuar apontando corretamente para o mesmo registro depois de
migrado — não é necessário reescrever nenhuma referência.

## 12. Como as exclusões destrutivas foram evitadas

Todas as 23 Foreign Keys usam `ON DELETE RESTRICT` (padrão do Postgres
quando não se especifica nada, mas escrevi explicitamente para deixar
claro na leitura do SQL). Na prática: tentar excluir, por exemplo, um
imóvel que tem reservas vinculadas vai gerar um erro do próprio banco,
**mesmo que o frontend um dia esqueça de checar isso em JavaScript**.
Isso é uma camada a mais de segurança em cima da proteção que já existe
hoje na interface — não substitui a mensagem amigável que o app mostra
ao usuário (isso continua sendo trabalho do frontend, na Fase 4), só
garante que o banco nunca permite a exclusão por baixo dos panos.

## 13. O que deliberadamente NÃO foi implementado nesta fase

- Nenhuma alteração no frontend.
- Nenhuma migração de dados.
- Nenhuma trigger ou RPC de regra de negócio complexa (conflito de
  parceiro, indicação vigente, janela de 12 meses, reconciliação,
  bloqueios de edição por causa de repasse existente) — tudo isso
  continua só em JavaScript, como está hoje, conforme instruído.
- Nenhum sistema multiusuário, workspace ou papéis — só o `user_id`
  simples, isolando cada usuário dos demais.
- Nenhuma implementação de Supabase Storage para a foto da Apresentação
  — ela continua prevista como texto (base64) por enquanto.
- Nenhuma coluna `status` inventada em `financeiro` (o modelo atual não
  tem esse campo, e não criei um que não existe).
- **A regra dos 25% não foi implementada como coluna `GENERATED`** —
  ver seção 9 abaixo ("pontos que precisam da sua decisão"), é a
  decisão mais importante que ficou pendente desta fase.

## 14. Arquivos SQL/migrations criados

```
supabase-fase1/
├── migrations/
│   ├── 0001_modulos_01_07.sql        (comparables, settings, historico_analises,
│   │                                   apresentacao_config, parceria_config)
│   ├── 0002_gestao_de_imoveis.sql    (16 tabelas da Gestão de Imóveis, em ordem
│   │                                   de dependência)
│   └── 0003_rls_policies.sql         (RLS + 84 policies nas 21 tabelas)
└── RELATORIO-FASE-1.md               (este relatório)
```

Nenhum arquivo do projeto React foi criado, movido ou alterado.

## 15. Riscos identificados

- **SQL não testado contra um banco real.** Não tenho acesso ao seu
  projeto Supabase, então esta migration nunca foi executada de
  verdade — só revisada manualmente, com atenção especial à ordem de
  criação das tabelas (para as Foreign Keys não falharem por apontar
  para algo que ainda não existe) e à sintaxe do bloco `DO` de RLS.
  **Recomendo rodar num projeto Supabase de teste antes de aplicar no
  seu projeto real**, e me avisar se algo der erro — normalmente seria
  um detalhe pequeno de sintaxe, não um problema de desenho.
- **IDs como `text` em vez de `uuid`** têm uma desvantagem sutil: o
  Postgres não gera esse valor sozinho (diferente de `uuid` com
  `default gen_random_uuid()`), então qualquer inserção futura precisa
  continuar vindo com o `id` já pronto do lado do cliente — exatamente
  como o app já faz hoje com `uid()`. Não é um problema agora, mas é
  algo que a Fase 2 (camada de acesso a dados) vai precisar ter em
  mente.
- **`user_id default auth.uid()`**: coloquei esse valor padrão para
  facilitar inserções futuras (Fase 4), mas ele só funciona quando a
  inserção acontece autenticada, através do client do Supabase — não
  funciona em um `INSERT` feito "por fora" (ex.: direto no SQL Editor,
  sem estar logado como aquele usuário). Isso é relevante para a Fase 3:
  a migração de dados provavelmente vai precisar informar o `user_id`
  explicitamente em vez de depender do valor padrão.

## 16. Incompatibilidades encontradas

Duas, e sinalizo as duas sem ter corrigido nada sozinho, como
instruído:

**(a) Histórico de Análises não tem campo `id`.** Reli o código real do
`handleAnalyze()` para confirmar, e o registro salvo hoje é
`{ codigo, criadoEm, endereco, tipo, target, result }` — **sem `id`**.
O `codigo` (formato `MS-AAAAMMDD-XXXX`, com verificação de colisão no
momento da geração) já funciona como identificador único na prática.
Usei `codigo` como chave primária de `historico_analises` em vez de
inventar um `id` que os dados reais não têm. Se você preferir manter um
`id` técnico separado do `codigo` (por exemplo, pensando numa eventual
reformulação do código no futuro), me avise antes da Fase 2 — é uma
mudança pequena no schema, mas melhor decidir agora do que depois de
começar a migrar dados de verdade.

**(b) `comissaoRecebida` não é um campo obrigatório no frontend** (não
tem `required: true`), então registros de `repasses_parceiros` podem
existir hoje com esse campo vazio. Isso é compatível com o schema como
ficou (coluna `numeric`, aceita `NULL`), só registro aqui para ficar
claro que não é um esquecimento.

## 17. Pontos que precisam da sua decisão antes da Fase 2

**(1) A regra dos 25% e a coluna `valor_participacao` — decisão mais
importante desta fase.** Avaliei implementar `valor_participacao` como
coluna `GENERATED ALWAYS AS (comissao_recebida * 0.25) STORED`, que
seria a forma mais forte de garantir a regra (o banco simplesmente não
aceitaria outro valor). **Não implementei**, porque isso entra em
conflito direto com a tela de Reconciliação que vocês já têm (V2.3.3):
ela existe justamente para **detectar e reportar** repasses onde
`valorParticipacao` diverge de 25% de `comissaoRecebida`, sem corrigir
nada sozinha. Uma coluna gerada recalcularia esse valor
automaticamente a cada escrita — o que tornaria **impossível** importar
um registro histórico já divergente (a Fase 3 precisaria descartar ou
"corrigir" silenciosamente esses casos antes de inserir, o que a
Reconciliação foi desenhada para nunca fazer). Por isso deixei
`valor_participacao` como uma coluna `numeric` comum, igual está hoje
no modelo do frontend, e trago a decisão para você: **quer manter assim
(regra só em JavaScript, como hoje) e reforçar no banco só depois
através de uma trigger/RPC — que já é o combinado para regras
complexas — ou prefere uma outra estratégia (por exemplo, uma coluna
`GENERATED` só para registros novos, mantendo os antigos "congelados"
de outra forma)?**

**(2) `historico_analises` sem `id` própria** (seção 16-a) — usar
`codigo` como chave primária está funcionalmente correto hoje, mas
quero confirmar que você está de acordo antes de seguir, já que é uma
diferença em relação ao que seu documento assumia.

**(3) Nomeação das policies.** Usei um padrão automático
(`nome_da_tabela_select_own`, `..._insert_own`, etc.) gerado pelo laço
SQL. Se sua equipe (ou você mesmo revisando depois) preferir nomes
diferentes, é trivial ajustar — só avise antes de rodar em produção,
porque renomear policies depois de criadas exige `DROP` + `CREATE` de
novo.

**(4) Onde versionar esses arquivos SQL.** Coloquei numa pasta
`supabase-fase1/migrations/` separada do código do frontend, seguindo a
convenção que o Supabase CLI usa (`supabase/migrations/`). Se você já
usa (ou pretende usar) o Supabase CLI no projeto, o caminho correto
seria mover esses 3 arquivos para dentro de `supabase/migrations/` no
repositório do projeto — não fiz isso automaticamente porque não tenho
certeza da estrutura de pastas fora do `codigo-fonte/` que você usa no
seu ambiente real de deploy.

---

## Conclusão da Fase 1

Schema criado (só como arquivos SQL, não aplicado), FKs, UNIQUE
constraints e RLS prontos, IDs preservados como `text` sem conversão,
nenhuma cascata destrutiva, nenhuma trigger complexa antecipada,
**zero alterações no frontend**. A aplicação V2.3.3.1 continua
funcionando exatamente como antes, com `localStorage`.

**Aguardando sua aprovação explícita, e principalmente sua decisão
sobre o ponto 1 acima (regra dos 25%), antes de iniciar a Fase 2.**
