import { redirect } from "next/navigation";

/** O cadastro de proposta passou para /cadastrar/proposta (em etapas); links antigos continuam funcionando. */
export default async function PaginaNovoRegistro(props: PageProps<"/registros/novo">) {
  const cliente = (await props.searchParams).cliente;
  redirect(
    typeof cliente === "string" && cliente ? `/cadastrar/proposta?cliente=${encodeURIComponent(cliente)}` : "/cadastrar/proposta",
  );
}
