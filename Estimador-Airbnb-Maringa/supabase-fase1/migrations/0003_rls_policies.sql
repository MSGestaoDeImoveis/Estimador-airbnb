-- ============================================================
-- FASE 1 — Estimador de Potencial (V2.3.3.1)
-- Migration 0003: Row Level Security (RLS) + policies
--
-- Regra única, igual em todas as 21 tabelas: um usuário autenticado só
-- enxerga e só altera linhas onde user_id = auth.uid(). Nenhuma policy
-- pública, nenhum "USING (true)" em dado privado, conforme instrução.
-- Preparado para eventual evolução multiusuário futura (não implementada
-- agora): bastaria trocar a condição de user_id por uma verificação de
-- workspace/equipe sem precisar redesenhar as tabelas.
-- ============================================================

do $$
declare
  tabela text;
  tabelas text[] := array[
    'comparables', 'settings', 'historico_analises', 'apresentacao_config', 'parceria_config',
    'proprietarios', 'prestadores', 'parceiros', 'imoveis', 'reservas', 'indicacoes',
    'limpeza', 'lavanderia', 'enxoval', 'manutencao', 'pendencias', 'onboarding_checklist_itens',
    'financeiro', 'comissoes', 'repasses', 'repasses_parceiros'
  ];
begin
  foreach tabela in array tabelas loop
    execute format('alter table public.%I enable row level security;', tabela);

    execute format(
      'create policy %I on public.%I for select using (user_id = auth.uid());',
      tabela || '_select_own', tabela
    );
    execute format(
      'create policy %I on public.%I for insert with check (user_id = auth.uid());',
      tabela || '_insert_own', tabela
    );
    execute format(
      'create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());',
      tabela || '_update_own', tabela
    );
    execute format(
      'create policy %I on public.%I for delete using (user_id = auth.uid());',
      tabela || '_delete_own', tabela
    );
  end loop;
end $$;

-- Nada de policies adicionais, nenhuma exceção pública. Se uma policy já
-- existir com o mesmo nome (reexecução da migration), o bloco acima falha
-- de propósito em vez de duplicar silenciosamente — reexecute só em um
-- banco limpo, ou apague as policies antigas antes.
