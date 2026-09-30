type Props = {
  sobre?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
};

export function CabecalhoPagina({ sobre, titulo, descricao, acoes }: Props) {
  return (
    <div className="cabecalho-pagina">
      <div>
        {sobre ? <div className="sobre">{sobre}</div> : null}
        <h1>{titulo}</h1>
        {descricao ? <p className="descricao">{descricao}</p> : null}
      </div>
      {acoes ? <div className="acoes-pagina nao-imprimir">{acoes}</div> : null}
    </div>
  );
}
