"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/cliente";

type Cadastro = { factorId: string; qr: string; segredo: string };

/** Ativa ou desativa a verificação em dois passos (aplicativo autenticador, TOTP). */
export function SegundoFator({ ativo }: { ativo: boolean }) {
  const router = useRouter();
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function iniciar() {
    setErro(null);
    setOcupado(true);
    const supabase = criarClienteNavegador();
    try {
      // Limpa cadastros abandonados no meio, que impediriam um novo.
      const { data: fatores } = await supabase.auth.mfa.listFactors();
      for (const f of fatores?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Cooesa ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error || !data) throw new Error();
      setCadastro({ factorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
    } catch {
      setErro("Não foi possível iniciar a ativação. Confira se a verificação em dois passos (TOTP) está habilitada no Supabase.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!cadastro) return;
    if (!/^\d{6}$/.test(codigo.replace(/\s/g, ""))) {
      setErro("Digite os 6 números que o aplicativo mostra.");
      return;
    }
    setErro(null);
    setOcupado(true);
    const supabase = criarClienteNavegador();
    const { data: desafio } = await supabase.auth.mfa.challenge({ factorId: cadastro.factorId });
    const { error } = desafio
      ? await supabase.auth.mfa.verify({ factorId: cadastro.factorId, challengeId: desafio.id, code: codigo.replace(/\s/g, "") })
      : { error: new Error() };
    setOcupado(false);
    if (error) {
      setErro("Código incorreto ou vencido. Digite o código que está aparecendo agora no aplicativo.");
      return;
    }
    setCadastro(null);
    setCodigo("");
    router.refresh();
  }

  async function desativar() {
    if (!window.confirm("Desativar a verificação em dois passos? Sua conta voltará a depender só da senha.")) return;
    setErro(null);
    setOcupado(true);
    const supabase = criarClienteNavegador();
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    for (const f of fatores?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
    setOcupado(false);
    router.refresh();
  }

  if (ativo) {
    return (
      <div className="pilha">
        <p className="aviso aviso-sucesso">
          <strong>Ativa.</strong> Ao entrar, além da senha, o sistema pede o código do aplicativo autenticador.
        </p>
        <button className="btn btn-perigo" type="button" onClick={desativar} disabled={ocupado}>
          Desativar verificação em dois passos
        </button>
        {erro ? <p className="aviso aviso-erro">{erro}</p> : null}
      </div>
    );
  }

  if (!cadastro) {
    return (
      <div className="pilha">
        <p className="texto-2">
          Protege sua conta mesmo se alguém descobrir a senha. Você vai precisar de um aplicativo autenticador no celular (Google
          Authenticator, Microsoft Authenticator ou similar).
        </p>
        <button className="btn btn-primario" type="button" onClick={iniciar} disabled={ocupado}>
          {ocupado ? "Preparando…" : "Ativar verificação em dois passos"}
        </button>
        {erro ? <p className="aviso aviso-erro">{erro}</p> : null}
      </div>
    );
  }

  return (
    <form className="pilha" onSubmit={confirmar}>
      <ol className="passos-mfa">
        <li>Abra o aplicativo autenticador e escolha adicionar conta.</li>
        <li>
          Escaneie o código abaixo. Sem câmera? Digite a chave: <code className="chave-mfa">{cadastro.segredo}</code>
        </li>
        <li>Digite o código de 6 números que aparecer.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR em SVG gerado pelo Supabase (data URI) */}
      <img src={cadastro.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} className="qr-mfa" />
      <div className="campo" style={{ maxWidth: 220 }}>
        <label htmlFor="codigo-mfa">Código</label>
        <input
          id="codigo-mfa"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="campo-codigo"
        />
      </div>
      {erro ? <p className="aviso aviso-erro">{erro}</p> : null}
      <div className="atalhos">
        <button className="btn btn-primario" type="submit" disabled={ocupado}>
          {ocupado ? "Conferindo…" : "Confirmar e ativar"}
        </button>
        <button className="btn btn-texto" type="button" onClick={() => setCadastro(null)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
