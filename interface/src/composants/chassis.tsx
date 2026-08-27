// Le châssis : les quelques pièces que tout le reste réutilise.
// Elles portent les hauteurs de contrôle de `docs/DESIGN.md` § Spacing —
// c'est cette grille de densité, pas les marges, qui fait l'instrument.

import type { ReactNode } from "react"

/**
 * « Le grisé porte sa raison — jamais une infobulle. »
 *
 * Une ligne sœur permanente sous le contrôle indisponible : mono 10 px,
 * `--texte-3`, précédée d'un tiret de 8 px, avec un lien en `--signal` quand il
 * y a un endroit où aller. Le produit interdit de proposer puis de refuser :
 * l'apparence doit donc dire pourquoi sans qu'on ait à chercher.
 */
export function Raison({
  texte,
  ouAller,
  onAller,
}: {
  texte: string | null
  ouAller?: string
  onAller?: () => void
}) {
  if (!texte) return null
  return (
    <p className="mesure mt-1 flex items-center gap-1.5 text-[10px] leading-4 text-texte-3">
      <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
      <span>{texte}</span>
      {ouAller && onAller && (
        <button
          type="button"
          onClick={onAller}
          className="text-signal hover:text-signal-clair"
        >
          {ouAller} ›
        </button>
      )}
    </p>
  )
}

export function EnTetePanneau({ children }: { children: ReactNode }) {
  return (
    <div className="mesure flex h-[30px] shrink-0 items-center border-b border-bord px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
      {children}
    </div>
  )
}

export function Libelle({ children }: { children: ReactNode }) {
  return <span className="text-[11px] text-texte-2">{children}</span>
}

export function Bouton({
  enfants,
  principal = false,
  inactif = false,
  onClick,
  titre,
}: {
  enfants: ReactNode
  principal?: boolean
  inactif?: boolean
  onClick?: () => void
  titre?: string
}) {
  const base =
    "h-8 rounded-[2px] px-3 text-[13px] transition-colors duration-[80ms] disabled:cursor-not-allowed"
  const couleurs = inactif
    ? "border border-bord bg-fond-2 text-texte-3"
    : principal
      ? "bg-signal text-fond-0 hover:bg-signal-clair font-medium"
      : "border border-bord-fort bg-fond-2 text-texte hover:bg-fond-3"
  return (
    <button
      type="button"
      title={titre}
      disabled={inactif}
      onClick={onClick}
      className={`${base} ${couleurs}`}
    >
      {enfants}
    </button>
  )
}

/** Un choix parmi peu — proportions, variations. Un segment indisponible est
 *  grisé, jamais caché : l'absence n'apprend rien, le grisé apprend pourquoi. */
export function Segments<T extends string | number>({
  valeurs,
  valeur,
  onChange,
  indisponibles = [],
}: {
  valeurs: readonly T[]
  valeur: T
  onChange: (v: T) => void
  indisponibles?: readonly T[]
}) {
  return (
    <div className="flex gap-1">
      {valeurs.map((v) => {
        const choisi = v === valeur
        const grise = indisponibles.includes(v)
        return (
          <button
            key={String(v)}
            type="button"
            disabled={grise}
            onClick={() => onChange(v)}
            className={[
              "mesure h-[26px] min-w-[34px] rounded-[2px] border px-2 text-[11.5px] transition-colors duration-[80ms]",
              grise
                ? "border-bord bg-fond-2 text-texte-3"
                : choisi
                  ? "border-signal bg-signal/13 text-signal"
                  : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
            ].join(" ")}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

/** Le point de la barre d'état. Seul endroit du produit avec un rayon plein. */
export function Point({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[5px] w-[5px] rounded-full"
      style={{ background: couleur }}
    />
  )
}
