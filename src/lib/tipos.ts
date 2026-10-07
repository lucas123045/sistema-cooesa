/** Tipos das linhas lidas do banco (tabelas e views). Numéricos podem vir como string (numeric). */

export type Num = number | string;

export type LinhaRegistroLista = {
  num: number;
  cliente_id: number;
  cliente: string;
  empresa_original: string | null;
  gerente: string | null;
  escopo: string | null;
  situacao: string | null;
  grupo: string | null;
  contrato_total: boolean;
  data_ini: string | null;
  data_ini_texto: string | null;
  data_enc: string | null;
  data_enc_texto: string | null;
  tipo: "P" | "T";
  valor: Num | null;
  valor_texto: string | null;
  valor_vencedor: Num | null;
  entidade: string | null;
  obs: string | null;
  ano: number;
  setor: string | null;
  area: string | null;
  empreendimento: string | null;
  servico: string | null;
  especialidade: string | null;
};

/** Dados técnicos e comerciais da proposta (migração 20261009120000). */
export type DadosTecnicosRegistro = {
  descricao: string | null;
  obra: string | null;
  local_municipio: string | null;
  local_uf: string | null;
  cliente_final: string | null;
  potencia_mw: Num | null;
  tensao_kv: Num | null;
  extensao_km: Num | null;
  modalidade: string | null;
  edital: string | null;
  revisao: number;
  validade_dias: number | null;
  prazo_meses: Num | null;
  horas_estimadas: number | null;
  responsavel_tecnico: string | null;
  concorrentes: string | null;
  motivo_perda: string | null;
};

export type Registro = Omit<LinhaRegistroLista, "cliente" | "grupo" | "contrato_total"> &
  Partial<DadosTecnicosRegistro> & {
    contato: string | null;
    criado_em: string;
    criado_por: string | null;
    atualizado_em: string | null;
    atualizado_por: string | null;
  };

export type Acompanhamento = {
  id: number;
  registro_num: number | null;
  fonte: string;
  situacao_na_epoca: string | null;
  obs: string | null;
  a_receber: Num | null;
  empresa_texto: string | null;
  escopo_texto: string | null;
  chave_importacao: string | null;
  criado_em: string;
  criado_por: string | null;
};

export type NotaFiscal = {
  id: number;
  numero: string | null;
  data_emissao: string | null;
  data_credito: string | null;
  cliente_id: number | null;
  empresa_texto: string | null;
  titulo: string | null;
  valor: Num;
  ano: number;
  registro_num: number | null;
  origem_aba: string | null;
  origem_linha: number | null;
  cliente?: string | null;
  cliente_exibicao?: string | null;
  a_receber?: boolean;
};

export type LinhaHistorico = {
  id: number;
  tabela: string;
  chave: string;
  acao: "insert" | "update" | "delete";
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario: string;
  quando: string;
};

export type Resumo = {
  total_propostas: number;
  encerrados: number;
  em_andamento: number;
  contratos_totais: number;
  pct_sucesso: Num | null;
  clientes_distintos: number;
  clientes_contrataram: number;
  aguardando: number;
  perdidas: number;
  canceladas: number;
  em_litigio: number;
  sem_situacao: number;
  tipo_p: number;
  tipo_t: number;
  valor_total_registros: Num;
  valor_contratado_p: Num;
  valor_contratado_t_mensal: Num;
  primeiro_ano: number | null;
  ultimo_ano: number | null;
};

export type ResumoAnual = {
  ano: number;
  propostas: number;
  contratos: number;
  pct_sucesso: Num | null;
  aguardando: number;
  perdidas: number;
  valor_proposto_p: Num;
  valor_proposto_t: Num;
  valor_contratado_p: Num;
  valor_contratado_t: Num;
};

export type FaturamentoMensal = {
  ano: number;
  mes: number | null;
  quantidade: number;
  total: Num;
  a_receber_quantidade: number;
  a_receber_valor: Num;
  irpj: Num;
  csll: Num;
  cofins: Num;
  pis: Num;
  inss: Num;
  iss: Num;
  tributos_total: Num;
};

export type LinhaCliente = {
  id: number;
  nome: string;
  propostas: number;
  contratos: number;
  pct_sucesso: Num | null;
  valor_contratado_p: Num;
  valor_contratado_t: Num;
  valor_proposto_p: Num;
  faturado: Num;
  notas: number;
  primeiro_ano: number | null;
  ultimo_ano: number | null;
  status: string | null;
  status_sugerido: string | null;
  razao_social: string | null;
  cnpj: string | null;
  setor: string | null;
  cidade: string | null;
  uf: string | null;
  site: string | null;
  responsavel: string | null;
  origem: string | null;
  observacoes: string | null;
  ultima_proposta: string | null;
  criado_em: string;
  atualizado_em: string | null;
};

export type ContatoEmpresa = {
  id: number;
  cliente_id: number;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  observacoes: string | null;
};

export type Pendencia = {
  tipo: string;
  chave: string;
  referencia: string;
  descricao: string;
  link: string | null;
  registro_num: number | null;
};

export type LinhaCurriculo = {
  num: number;
  cliente: string;
  escopo: string | null;
  ano: number;
  data_ini: string | null;
  data_enc: string | null;
  situacao: string;
  setor: string | null;
  area: string | null;
  empreendimento: string | null;
  servico: string | null;
  especialidade: string | null;
  tipo: "P" | "T";
  valor: Num | null;
  gerente: string | null;
};
