import { camelToSnake, snakeToCamel, rowToApp, appToRow, shapeError } from '../../src/lib/supabaseDataMappers.js';

let passed = 0, failed = 0;
function check(desc, got, expected) {
  const okRes = JSON.stringify(got) === JSON.stringify(expected);
  console.log((okRes ? 'OK  ' : 'FAIL') + ' - ' + desc + (okRes ? '' : ` | esperado=${JSON.stringify(expected)} obtido=${JSON.stringify(got)}`));
  okRes ? passed++ : failed++;
}

// camelToSnake / snakeToCamel — casos reais dos 21 schemas
check('camelToSnake imovelId', camelToSnake('imovelId'), 'imovel_id');
check('camelToSnake proprietarioId', camelToSnake('proprietarioId'), 'proprietario_id');
check('camelToSnake percentualComissao', camelToSnake('percentualComissao'), 'percentual_comissao');
check('camelToSnake valorParticipacao', camelToSnake('valorParticipacao'), 'valor_participacao');
check('camelToSnake origemComissaoId', camelToSnake('origemComissaoId'), 'origem_comissao_id');
check('camelToSnake quantidadeNecessaria', camelToSnake('quantidadeNecessaria'), 'quantidade_necessaria');
check('camelToSnake codigoParceiro', camelToSnake('codigoParceiro'), 'codigo_parceiro');
check('camelToSnake id (sem mudanca)', camelToSnake('id'), 'id');
check('snakeToCamel imovel_id', snakeToCamel('imovel_id'), 'imovelId');
check('snakeToCamel inicio_participacao', snakeToCamel('inicio_participacao'), 'inicioParticipacao');
check('snakeToCamel data_pagamento', snakeToCamel('data_pagamento'), 'dataPagamento');
check('roundtrip camelToSnake->snakeToCamel', snakeToCamel(camelToSnake('quantidadeNecessaria')), 'quantidadeNecessaria');
check('roundtrip snakeToCamel->camelToSnake', camelToSnake(snakeToCamel('origem_comissao_id')), 'origem_comissao_id');

// rowToApp — remove campos internos, mantem jsonb intacto por dentro
const row = {
  id: 'abc123', user_id: 'uuid-do-usuario', imovel_id: 'im1', percentual_comissao: 20,
  created_at: '2026-01-01', updated_at: '2026-01-02',
};
check('rowToApp remove user_id/created_at/updated_at e converte chaves', rowToApp(row),
  { id: 'abc123', imovelId: 'im1', percentualComissao: 20 });

const rowComJsonb = { id: 'h1', codigo: 'MS-1', target: { zona: 'Zona 1', quartos: 2 }, user_id: 'x' };
check('rowToApp preserva conteudo interno do jsonb (nao mexe nas chaves de dentro)',
  rowToApp(rowComJsonb), { id: 'h1', codigo: 'MS-1', target: { zona: 'Zona 1', quartos: 2 } });

check('rowToApp com null', rowToApp(null), null);

// appToRow — converte para snake_case
check('appToRow', appToRow({ imovelId: 'im1', percentualComissao: 20 }), { imovel_id: 'im1', percentual_comissao: 20 });
check('appToRow preserva valor de jsonb aninhado sem tocar nas chaves internas',
  appToRow({ target: { zona: 'Z1', quartos: 2 } }), { target: { zona: 'Z1', quartos: 2 } });

// shapeError — códigos Postgres mapeados corretamente
check('shapeError unique_violation (23505)', shapeError({ code: '23505', message: 'duplicate' }).type, 'constraint');
check('shapeError foreign_key_violation (23503)', shapeError({ code: '23503', message: 'fk' }).type, 'constraint');
check('shapeError not found (PGRST116)', shapeError({ code: 'PGRST116' }).type, 'not_found');
check('shapeError RLS/permission', shapeError({ message: 'new row violates row-level security policy' }).type, 'permission');
check('shapeError permission por codigo 42501', shapeError({ code: '42501', message: 'permission denied' }).type, 'permission');
check('shapeError network', shapeError({ message: 'Failed to fetch' }).type, 'network');
check('shapeError unknown', shapeError({ message: 'algo aleatorio' }).type, 'unknown');
check('shapeError null', shapeError(null).type, 'unknown');

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed > 0 ? 1 : 0);
