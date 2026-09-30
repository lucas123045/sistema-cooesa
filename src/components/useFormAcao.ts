"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState sem o reset automático de formulário do React 19: quando a
 * validação falha, o que o usuário digitou continua nos campos.
 * Uso: <form onSubmit={enviar}> em vez de <form action={...}>.
 */
export function useFormAcao<E extends object>(
  acao: (estado: E, dados: FormData) => Promise<E>,
  inicial: E,
): [E, (e: FormEvent<HTMLFormElement>) => void, boolean] {
  const [estado, despachar, pendente] = useActionState<E, FormData>(
    acao as (estado: Awaited<E>, dados: FormData) => Promise<E>,
    inicial as Awaited<E>,
  );
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => despachar(dados));
  };
  return [estado, enviar, pendente];
}
