import { useState } from "react"
import { ARRETS_ZOOM, ZOOM_MAX, ZOOM_MIN, type ZoomTable } from "../recette"

// **La seule barre de zoom de l'atelier.** Il y en avait trois — la retouche
// d'une image, la frame d'une animation, et la surface où l'on vise une
// couleur à la pipette —, chacune avec ses boutons, ses mots et sa place :
// passer de la frame à la pipette changeait l'interface sous la main. Signalé
// par l'auteur le 16 septembre 2026 ; c'est celle de la retouche qui reste.

/** *moins*, le pour cent, *plus*, et le retour à cent — **repris de
 *  `CommandesDeZoom` (`Tables.tsx`, U2/`B24`)**, seul l'habillage passe au
 *  papier du carnet. Le champ suit le zoom effectif, y compris en `ajusté` :
 *  un champ vide pendant qu'on regarde une image à 59 % laisserait deviner le
 *  nombre. */
export function CommandesDuZoom({
  zoom,
  onZoom,
  ajuste,
  maximum = ZOOM_MAX,
  libelle = "Pour cent d'agrandissement",
}: {
  zoom: ZoomTable
  onZoom: (zoom: ZoomTable) => void
  ajuste: number
  maximum?: number
  /** Le nom du champ du pour cent, quand plusieurs surfaces cohabitent. */
  libelle?: string
}) {
  const effectif = zoom === "ajuste" ? ajuste : zoom
  const [ecrit, setEcrit] = useState<string | null>(null)
  const bornerIci = (v: number) => Math.max(ZOOM_MIN, Math.min(maximum, Math.round(v)))
  const arrets = [...ARRETS_ZOOM, 400, 600, 800, 1200, 1600].filter((v) => v <= maximum)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseInt(texte.replace(/[^\d]/g, ""), 10)
    // **Hors bornes, on ramène — on ne refuse pas.**
    if (Number.isFinite(lu)) onZoom(bornerIci(lu))
  }

  return (
    <span className="flex items-center gap-[4px]">
      <button
        type="button"
        aria-label="Reculer"
        title="Reculer"
        disabled={effectif <= ZOOM_MIN}
        onClick={() =>
          onZoom(
            bornerIci([...arrets].reverse().find((a) => a < effectif) ?? ZOOM_MIN),
          )
        }
        className="flex h-[26px] w-[26px] items-center justify-center rounded-7 text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={libelle}
        value={ecrit ?? `${effectif}`}
        onChange={(e) => setEcrit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") valider((e.target as HTMLInputElement).value)
          // Échap rend la valeur d'avant — comme partout ailleurs.
          if (e.key === "Escape") setEcrit(null)
        }}
        onBlur={(e) => ecrit !== null && valider(e.target.value)}
        className="mesure h-[26px] w-[34px] rounded-7 border border-trait bg-carte px-[4px] text-right text-[12px] text-encre tabular-nums"
      />
      <span className="text-[12px] text-encre-4">%</span>
      <button
        type="button"
        aria-label="Approcher"
        title="Approcher"
        disabled={effectif >= maximum}
        onClick={() => onZoom(bornerIci(arrets.find((a) => a > effectif) ?? maximum))}
        className="flex h-[26px] w-[26px] items-center justify-center rounded-7 text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
      >
        +
      </button>
      <button
        type="button"
        title="Un pixel d'image pour un pixel d'écran"
        aria-pressed={zoom === 100}
        onClick={() => onZoom(100)}
        className={[
          "h-[26px] shrink-0 whitespace-nowrap rounded-7 px-[8px] text-[12px] transition-colors duration-120",
          zoom === 100 ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
        ].join(" ")}
      >
        100 %
      </button>
      <button
        type="button"
        title="Toute l'image dans le cadre"
        aria-pressed={zoom === "ajuste"}
        onClick={() => onZoom("ajuste")}
        className={[
          "h-[26px] shrink-0 whitespace-nowrap rounded-7 px-[8px] text-[12px] transition-colors duration-120",
          zoom === "ajuste" ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
        ].join(" ")}
      >
        Adapter
      </button>
    </span>
  )
}


/** **La barre entière, posée pareil partout** : les commandes à droite, le
 *  rappel des gestes à gauche, sur une ligne au-dessus de l'image. */
export function BarreDuZoom(props: Parameters<typeof CommandesDuZoom>[0]) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-[8px] py-[4px]">
      <span className="text-[11px] text-encre-3">Ctrl + molette : zoom · Espace + glisser : déplacer la vue</span>
      <div data-zoom className="ml-auto flex items-center gap-[4px] rounded-8 bg-papier-cote p-[4px]">
        <CommandesDuZoom {...props} />
      </div>
    </div>
  )
}
