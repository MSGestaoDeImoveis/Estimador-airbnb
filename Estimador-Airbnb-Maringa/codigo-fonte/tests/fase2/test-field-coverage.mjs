import { camelToSnake } from '../../src/lib/supabaseDataMappers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const camposPorEntidade = {
  comparables: ['id','demo','zona','bairro','regiao','enderecoRef','tipo','quartos','banheiros','area','capacidade','camas','garagem','elevador','varanda','piscina','academia','arCondicionado','maquinaLavar','espacoTrabalho','mobiliado','padrao','diaria','taxaLimpeza','nota','avaliacoes','superhost','ocupacaoObservada','diferenciais','dataPesquisa','link'],
  settings: ['adjustments','costs','comissaoPct','comissaoBase','ocupacaoPadrao','noitesMes','duracaoMediaEstadia'],
  historico_analises: ['codigo','criadoEm','endereco','tipo','target','result'],
  imoveis: ['id','nome','endereco','bairro','regiao','tipo','quartos','banheiros','camas','capacidade','proprietarioId','parceiroId','status','telefoneOperacional','inicioGestao','percentualComissao','informacoesAcesso','observacoesInternas','observacoes'],
  proprietarios: ['id','nome','telefone','whatsapp','email','observacoes'],
  reservas: ['id','imovelId','hospede','contato','checkin','checkout','plataforma','status','valor','taxas','observacoes'],
  limpeza: ['id','imovelId','reservaId','data','horario','responsavel','status','observacoes'],
  lavanderia: ['id','imovelId','envio','recebimento','quantidade','responsavel','status','observacoes'],
  enxoval: ['id','imovelId','item','quantidadeNecessaria','quantidadeAtual','estoqueMinimo','observacoes'],
  manutencao: ['id','imovelId','problema','data','prioridade','prestadorId','status','custo','observacoes'],
  prestadores: ['id','nome','categoria','telefone','whatsapp','contato','regiao','disponibilidade','emergencia','status','observacoes'],
  financeiro: ['id','tipo','imovelId','reservaId','categoria','descricao','valor','data','observacoes'],
  comissoes: ['id','imovelId','reservaId','financeiroId','periodo','receita','percentual','status','observacoes'],
  repasses: ['id','proprietarioId','imovelId','comissaoId','periodo','receita','despesas','comissao','status','data','observacoes'],
  pendencias: ['id','titulo','imovelId','prioridade','prazo','responsavel','status','observacoes'],
  parceiros: ['id','nome','empresa','telefone','whatsapp','email','creci','tipo','codigoParceiro','status','observacoes'],
  indicacoes: ['id','parceiroId','imovelId','dataIndicacao','statusIndicacao','inicioParticipacao','observacoes'],
  repasses_parceiros: ['id','parceiroId','imovelId','periodo','comissaoRecebida','valorParticipacao','status','dataPrevista','dataPagamento','origemComissaoId','observacoes'],
  onboarding_checklist_itens: ['id','imovelId','item','concluido'],
};

const sql1 = fs.readFileSync(path.join(__dirname, '../../../supabase-fase1/migrations/0001_modulos_01_07.sql'), 'utf8');
const sql2 = fs.readFileSync(path.join(__dirname, '../../../supabase-fase1/migrations/0002_gestao_de_imoveis.sql'), 'utf8');
const sqlTudo = sql1 + '\n' + sql2;

function colunasDaTabela(sql, tabela) {
  const re = new RegExp(`create table if not exists public\\.${tabela} \\(([\\s\\S]*?)\\n\\);`, 'm');
  const m = sql.match(re);
  if (!m) return null;
  const body = m[1];
  const linhas = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--') && !l.startsWith('constraint'));
  return linhas.map(l => l.split(/\s+/)[0].replace(/,$/, ''));
}

let totalCampos = 0, semColunaCorrespondente = 0;
for (const [tabela, campos] of Object.entries(camposPorEntidade)) {
  const colunas = colunasDaTabela(sqlTudo, tabela);
  if (!colunas) { console.log(`AVISO: tabela ${tabela} não encontrada no SQL`); continue; }
  for (const campo of campos) {
    totalCampos++;
    const esperado = camelToSnake(campo);
    if (!colunas.includes(esperado)) {
      semColunaCorrespondente++;
      console.log(`FALTA - ${tabela}.${campo} -> camelToSnake da "${esperado}", mas essa coluna não existe no SQL. Colunas reais: ${colunas.join(', ')}`);
    }
  }
}
console.log(`\n${totalCampos} campos verificados, ${semColunaCorrespondente} sem correspondência exata no SQL.`);
process.exit(semColunaCorrespondente > 0 ? 1 : 0);
