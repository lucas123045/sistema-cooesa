import { valorParaCampo } from "@/lib/valores";
import { salvarNota } from "./acoes";

type NotaForm = {
  id?: number;
  numero?: string | null;
  data_emissao?: string | null;
  data_credito?: string | null;
  cliente_id?: number | null;
  empresa_texto?: string | null;
  titulo?: string | null;
  valor?: string | number | null;
  ano?: number | null;
  registro_num?: number | null;
};

export function FormNota({ nota, clientes }: { nota?: NotaForm; clientes: { id: number; nome: string }[] }) {
  return <form action={salvarNota} className="formulario painel-corpo">
    {nota?.id ? <input type="hidden" name="id" value={nota.id} /> : null}
    <div className="campo c-4"><label htmlFor="numero">Número da NF</label><input id="numero" name="numero" defaultValue={nota?.numero ?? ""} maxLength={80} /></div>
    <div className="campo c-4"><label htmlFor="data_emissao">Data de emissão</label><input id="data_emissao" name="data_emissao" type="date" defaultValue={nota?.data_emissao ?? ""} /></div>
    <div className="campo c-4"><label htmlFor="data_credito">Data de crédito</label><input id="data_credito" name="data_credito" type="date" defaultValue={nota?.data_credito ?? ""} /></div>
    <div className="campo c-6"><label htmlFor="cliente_id">Cliente cadastrado</label><select id="cliente_id" name="cliente_id" defaultValue={nota?.cliente_id ?? ""}><option value="">Não vincular a cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
    <div className="campo c-6"><label htmlFor="empresa_texto">Empresa como aparece na nota</label><input id="empresa_texto" name="empresa_texto" defaultValue={nota?.empresa_texto ?? ""} maxLength={240} /></div>
    <div className="campo c-8"><label htmlFor="titulo">Título / referência</label><input id="titulo" name="titulo" defaultValue={nota?.titulo ?? ""} maxLength={500} /></div>
    <div className="campo c-4"><label htmlFor="valor">Valor (R$)</label><input id="valor" name="valor" inputMode="decimal" defaultValue={valorParaCampo(nota?.valor)} required /></div>
    <div className="campo c-4"><label htmlFor="ano">Ano</label><input id="ano" name="ano" type="number" min={1990} max={2100} defaultValue={nota?.ano ?? new Date().getFullYear()} required /></div>
    <div className="campo c-4"><label htmlFor="registro_num">Registro relacionado</label><input id="registro_num" name="registro_num" type="number" min={1} defaultValue={nota?.registro_num ?? ""} /></div>
    <div className="campo c-12"><button className="btn btn-primario" type="submit">Salvar nota fiscal</button></div>
  </form>;
}
