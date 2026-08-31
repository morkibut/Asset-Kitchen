// Le champ de prompt — 56 px au minimum, 13,5 px, le seul endroit du produit
// où le texte est plus gros que le châssis.
//
// « L'atelier s'ouvre sur un champ de prompt actif, sans écran à traverser »
// (`docs/PLAN.md`, T1). Le prompt négatif est replié : on l'écrit rarement, on
// le lit encore moins.
//
// **Et depuis R2, ce qui partira se voit** (US-158) — d'abord dans un dépliant
// posé sous le champ, **puis dans un écran entier depuis E14**. Ce n'est pas un
// changement d'avis : c'est une mesure. Sur le plus long appel payé du dépôt, le
// style pèse 890 caractères sur 1 690 et le sujet 40 — 53 % contre 2 %. Un bloc
// replié qui résume 53 % de ce qui part n'est pas un résumé, c'est un angle
// mort, et ce qu'il faut y faire — éteindre, corriger, décocher une image — ne
// tient pas dans une bande dépliée sous une barre de saisie.
//
// **La barre garde son champ, son bouton et son prix ; elle perd sa bande
// dépliante.** Ce n'est donc pas un écran de plus dans le chemin : c'est un
// dépliant qui devient un écran.

import { useEffect, useRef } from "react"
import { Bouton, Raison, Revers, usePli } from "./chassis"

export function ChampPrompt({
  prompt,
  onPrompt,
  promptNegatif,
  onPromptNegatif,
  repris,
  onRendre,
  refus,
  ouAller,
  onAller,
  revers,
  provenance,
  onGenerer,
  variations,
  enVol = 0,
}: {
  prompt: string
  onPrompt: (v: string) => void
  promptNegatif: string
  onPromptNegatif: (v: string) => void
  /** Le texte est repris à la main : le champ **est** ce qui partira. */
  repris: boolean
  /** Rendre la main à l'atelier : le champ redevient le sujet seul.
   *
   *  **Reprendre, lui, s'est déplacé** : il vit sous le texte assemblé de
   *  l'écran de confirmation (E14), c'est-à-dire là où on lit ce qu'on
   *  reprendrait. */
  onRendre: () => void
  refus: string | null
  ouAller?: string
  onAller?: () => void
  /** Le repli hors ligne, quand il y a un catalogue à servir. */
  revers?: { texte: string; enCours: boolean; onReessayer: () => void } | null
  /** **D'où vient ce qui est écrit là, quand ce n'est pas l'auteur** (E2).
   *
   *  C'est la règle jumelle de celle que le produit tient depuis T1 : *ce qui
   *  est indisponible est grisé avec sa raison* avait besoin de son revers —
   *  **ce qui est devinable est prérempli avec sa provenance, et se défait d'un
   *  clic**. Un champ prérempli n'est pas un champ décidé.
   *
   *  Et se défaire ne change **rien** au réglage durable : c'est le texte de
   *  cet appel-ci qu'on efface, pas la consigne de la pose ni le signalement de
   *  la chose, qui restent où ils sont écrits. */
  provenance?: { texte: string; onDefaire: () => void } | null
  onGenerer: () => void
  variations: number
  /** Combien d'images sont **en route en ce moment** — payées, pas encore
   *  arrivées. Zéro la plupart du temps. Elle ne se voyaient que dans la grille
   *  de la galerie, alors qu'on paie aussi depuis le codex et depuis l'établi :
   *  on dépensait, l'écran ne bougeait pas, et l'on recliquait. */
  enVol?: number
}) {
  // **Le repli vit dans le registre du châssis, pas ici.** La galerie était le
  // fond du produit et ce champ ne se démontait jamais ; la V2.1 en fait un
  // onglet, et un état local se serait perdu à chaque aller-retour vers
  // l'Univers ou le Codex — refermant sous la main ce qu'on venait d'ouvrir.
  const [negatifOuvert, basculerNegatif] = usePli("prompt.negatif")
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => champ.current?.focus(), [])

  const toucheGenerer = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !refus) {
      e.preventDefault()
      onGenerer()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-bord bg-fond-1 p-4">
      <textarea
        ref={champ}
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={toucheGenerer}
        rows={repris ? 6 : 2}
        placeholder={
          repris
            ? "Le texte part exactement tel qu'il est écrit ici."
            : "Décris ce que tu veux fabriquer."
        }
        className={[
          "resize-y rounded-[3px] border px-3 py-2 placeholder:text-texte-3",
          repris
            ? "mesure min-h-[120px] leading-relaxed border-signal bg-fond-2 text-[11.5px] text-texte"
            : // **56 px, la première des deux exceptions nommées à la liste
              // fermée des hauteurs** (`docs/DESIGN.md` § Spacing) : ce n'est
              // pas une bande, c'est une zone de saisie sur plusieurs lignes.
              //
              // L'interligne est écrit ici et non hérité, parce que c'est lui
              // qui fait la mesure : deux lignes à 19 px, plus 8 px de garde en
              // haut et en bas, plus le trait, font exactement 56. Avec
              // `leading-relaxed` (1,625 → 22 px) les deux mêmes lignes en
              // faisaient 62, et le `min-h` n'y pouvait rien — il est un
              // minimum, pas une hauteur.
              "min-h-[56px] leading-[19px] border-bord-fort bg-fond-2 text-[13.5px] text-texte",
        ].join(" ")}
      />

      {/* La ligne de provenance, **sous le champ** : elle parle de ce qui est
          écrit dedans, pas de ce qui va partir. */}
      {provenance && (
        <p className="mesure flex items-center gap-1.5 text-[10px] leading-4 text-texte-3">
          <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
          <span>{provenance.texte}</span>
          <button
            type="button"
            onClick={provenance.onDefaire}
            className="text-signal hover:text-signal-clair"
          >
            défaire ›
          </button>
        </p>
      )}

      {negatifOuvert && (
        <textarea
          value={promptNegatif}
          onChange={(e) => onPromptNegatif(e.target.value)}
          onKeyDown={toucheGenerer}
          rows={1}
          placeholder="Ce que tu ne veux pas."
          className="min-h-[34px] resize-y rounded-[3px] border border-bord bg-fond-2 px-3 py-2 text-[12.5px] leading-[16px] text-texte-2 placeholder:text-texte-3"
        />
      )}

      {/* **Le texte repris se rend là où il a été pris.** Reprendre vit dans
          l'écran de confirmation, sous le texte assemblé ; rendre la main vit
          ici, parce que c'est ce champ-là qui change de nature. */}
      {repris && (
        <p className="mesure flex items-center gap-1.5 text-[10px] leading-4 text-signal">
          <span aria-hidden className="inline-block h-px w-2 bg-signal" />
          <span>le texte part exactement tel qu'il est écrit ici</span>
          <button
            type="button"
            onClick={onRendre}
            className="text-signal hover:text-signal-clair"
          >
            Rendre la main à l'atelier ›
          </button>
        </p>
      )}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={basculerNegatif}
          className="mesure h-[34px] text-[10px] text-texte-3 hover:text-texte-2"
        >
          {negatifOuvert ? "− " : "+ "}prompt négatif
          {promptNegatif && !negatifOuvert ? " ·" : ""}
        </button>

        <div className="ml-auto flex flex-col items-end">
          <Bouton principal inactif={refus !== null} onClick={onGenerer} enfants={
            variations > 1 ? `Générer ${variations} variations` : "Générer"
          } />
          {/* La fente : une ligne mono 10 px alignée à droite, trois
              locataires, **jamais deux à la fois** — `docs/DESIGN.md`
              `docs/design-motifs.md`, *Le revers*. Le refus l'emporte : quand le catalogue
              n'a jamais été reçu, il n'y a ni date à porter ni nuance à faire,
              et c'est le grisé ordinaire qui reprend la main. */}
          {refus ? (
            <Raison texte={refus} ouAller={ouAller} onAller={onAller} />
          ) : revers ? (
            <Revers
              texte={revers.texte}
              geste="Réessayer"
              onGeste={revers.onReessayer}
              enCours={revers.enCours}
            />
          ) : enVol > 0 ? (
            /* **Le quatrième locataire de la fente, et il dit qu'on a payé** —
                ajouté le 31 août 2026, sur un bug signalé par l'auteur. On peut
                dépenser depuis le codex et depuis l'établi, mais ce qui part ne
                se voyait que dans la grille de la galerie : on payait, l'écran
                ne bougeait pas, et l'on recliquait. La fente est l'endroit
                prévu — la ligne sous le bouton, un locataire à la fois — et le
                refus continue de l'emporter sur tout. */
            <p className="mesure mt-1 text-[10px] text-signal">
              {enVol === 1 ? "1 image part" : `${enVol} images partent`} · elles
              arrivent dans la galerie
            </p>
          ) : (
            <p className="mesure mt-1 text-[10px] text-texte-3">Ctrl + Entrée</p>
          )}
        </div>
      </div>
    </div>
  )
}
