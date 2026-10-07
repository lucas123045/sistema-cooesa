import { Icone, type NomeIcone } from "@/components/Icone";

type Props = {
  icone?: NomeIcone;
  sobre?: React.ReactNode;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
};

export function CabecalhoPagina({ icone, sobre, titulo, descricao, acoes }: Props) {
  return (
    <div className="cabecalho-pagina">
      <div>
        {sobre ? <div className="sobre">{sobre}</div> : null}
        <h1 className={icone ? "titulo-com-icone" : undefined}>
          {icone ? (
            <span className="titulo-icone">
              <Icone nome={icone} tamanho={22} />
            </span>
          ) : null}
          {titulo}
        </h1>
        {descricao ? <p className="descricao">{descricao}</p> : null}
      </div>
      {acoes ? <div className="acoes-pagina nao-imprimir">{acoes}</div> : null}
    </div>
  );
}
