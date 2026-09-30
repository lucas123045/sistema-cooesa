/** Nomes legíveis das colunas, usados no histórico de alterações. */
export const ROTULO_CAMPO: Record<string, string> = {
  num: "Nº",
  cliente_id: "Cliente",
  empresa_original: "Grafia original do cliente",
  contato: "Contato",
  gerente: "Gerente",
  escopo: "Escopo",
  situacao: "Situação",
  data_ini: "Início",
  data_ini_texto: "Início (texto original)",
  data_enc: "Encerramento",
  data_enc_texto: "Encerramento (texto original)",
  tipo: "Tipo",
  valor: "Valor",
  valor_texto: "Valor (texto original)",
  valor_vencedor: "Valor do vencedor",
  entidade: "Entidade",
  obs: "Observações",
  ano: "Ano",
  setor: "Setor",
  area: "Área",
  empreendimento: "Empreendimento",
  servico: "Serviço",
  especialidade: "Especialidade",
  nome: "Nome",
  numero: "Número",
  data_emissao: "Emissão",
  data_credito: "Crédito",
  empresa_texto: "Empresa (texto)",
  titulo: "Título",
  registro_num: "Registro vinculado",
  origem_aba: "Aba de origem",
  origem_linha: "Linha de origem",
  fonte: "Fonte",
  situacao_na_epoca: "Situação na época",
  a_receber: "A receber",
  escopo_texto: "Escopo (texto)",
  chave: "Chave",
  descricao: "Descrição",
};

/** Colunas de carimbo que não interessam no diff. */
export const CAMPOS_OCULTOS_HISTORICO = new Set(["criado_em", "criado_por", "atualizado_em", "atualizado_por", "id", "chave_importacao"]);

export const ROTULO_TIPO_PENDENCIA: Record<string, string> = {
  data_inicio: "Data de início ilegível",
  data_encerramento: "Data de encerramento inferida (mês/ano)",
  valor_texto: "Valor em texto",
  sem_situacao: "Registro sem situação",
  sem_escopo: "Registro sem escopo",
  cliente_unificado: "Nome de cliente unificado na extração",
  cliente_duplicado: "Possível cliente duplicado",
  acompanhamento_nao_vinculado: "Acompanhamento antigo sem registro",
  nota_incompleta: "Nota fiscal sem cliente ou data",
  nota_cliente_nao_cadastrado: "Nota com empresa não cadastrada",
  faturamento_divergente: "Total da planilha diferente das notas",
};

/** Ordem de exibição dos grupos na tela de Pendências. */
export const ORDEM_TIPO_PENDENCIA = Object.keys(ROTULO_TIPO_PENDENCIA);

/** Pendências que se resolvem só corrigindo o dado (não há “marcar como revisada”). */
export const PENDENCIAS_SO_CORRECAO = new Set(["sem_situacao", "sem_escopo", "data_inicio"]);
