import Image from "next/image";

/** Estado leve de navegação, com o arquivo original da marca. */
export function TelaCarregamento() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="sr-only">Carregando página…</span>
      <Image
        src="/brand/logo-cooesa-original.jpeg"
        alt=""
        width={200}
        height={200}
        unoptimized
      />
    </div>
  );
}
