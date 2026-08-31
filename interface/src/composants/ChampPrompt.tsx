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
import { secondes } from "../api"
import { Bouton, Jauge, Raison, Revers, useEcoule, usePli } from "./chassis"

/** Ce qui est payé et pas encore arrivé. `null` la plupart du temps. */
export type EnVol = {
  /** Combien d'images, tous lots confondus. */
  images: number
  /** Le départ du plus ancien encore en route, en secondes Unix. `null` — rien
   *  n'est parti, tout est en file chez le fournisseur. */
  demarreLe: number | null
  /** Ce que ce lot-là a mis la dernière fois, en secondes. */
  attendue: number
}

/**
 * **Le bouton qui paie porte l'état de ce qu'il a payé** — écrit le 31 août
 * 2026, sur un second signalement de l'auteur : *« je voudrais vraiment un
 * retour très visuel qui fait comprendre qu'on n'a pas besoin de rappuyer sur
 * générer »*.
 *
 * La correction de la veille avait posé le compte dans la fente, et c'était trop
 * peu pour trois raisons qui s'additionnent :
 *
 * - **la fente est à la place, à la taille et sur la ligne de `Ctrl + Entrée`**,
 *   que l'œil a appris à lire comme du décor. Un changement de couleur sur dix
 *   pixels ne se relit pas ;
 * - **le bouton, lui, ne changeait pas.** On cliquait *Générer*, et *Générer*
 *   revenait identique, plein, disponible. Tout ce que le bouton disait était
 *   « il ne s'est rien passé » — et il le disait plus fort que la ligne d'en
 *   dessous ne disait le contraire ;
 * - **le résultat atterrit ailleurs.** « Elles arrivent dans la galerie » est
 *   une consigne d'aller voir : depuis le codex ou l'établi, rien ne bouge.
 *
 * Le remède s'attaque à la deuxième, qui est la cause : **la chose qu'on
 * recliquerait devient la chose qui dit que ça marche.** Le bloc prend la place
 * exacte du bouton — mêmes 34 px, aucune hauteur neuve — et porte les deux faits
 * qu'on cherche : combien partent, et depuis quand. La jauge du produit court à
 * son bord bas, la même qu'une tuile en génération et qu'une retouche de fiche.
 * Générer redescend dans la fente, en lien : il reste à portée, il cesse d'être
 * ce qui saute aux yeux.
 *
 * **Ce n'est pas un bouton, et c'est délibéré** : il n'y a rien à y cliquer.
 * `role="status"` le dit aussi aux lecteurs d'écran, qui l'annoncent sans qu'on
 * ait à aller le chercher — c'est le même service rendu par l'autre bout.
 *
 * La moitié qui répond à la troisième raison n'est pas ici : c'est la pastille
 * de l'onglet Galerie (`BarreChassis`), qui suit d'un lieu à l'autre.
 *
 * **`shrink-0` et `whitespace-nowrap` : le bloc garde ses 34 px, quoi qu'il
 * arrive.** Vu au navigateur en colonne étroite — l'établi, un panneau ouvert —
 * la phrase passait à deux lignes et le bloc à cinquante-et-un pixels, ce qui
 * faisait sauter toute la barre au moment précis où elle doit rassurer. C'est le
 * libellé du prompt négatif qui cède à la place, et c'est le bon ordre : pendant
 * qu'un lot est en route, le repli du prompt négatif est le contrôle le moins
 * pressé de la rangée.
 */
function EnRoute({ images, demarreLe, attendue }: EnVol) {
  const ecoule = useEcoule(demarreLe)

  return (
    <div
      role="status"
      className="relative flex h-[34px] shrink-0 items-center overflow-hidden whitespace-nowrap rounded-[2px] border border-signal bg-fond-2 px-3"
    >
      <span className="mesure text-[11px] text-signal">
        {images === 1 ? "1 image en route" : `${images} images en route`}
        {demarreLe === null
          ? " · en file"
          : ` · ${secondes(ecoule)} / ~${secondes(attendue)}`}
      </span>
      {/* La jauge telle quelle, sans son compteur : le compteur est déjà dans
          la ligne au-dessus, et la barre se pose au bord bas — l'endroit exact
          où une tuile en génération porte la sienne. */}
      <span className="absolute inset-x-0 bottom-0 block">
        <Jauge demarreLe={demarreLe} attendue={attendue} compteur={false} />
      </span>
    </div>
  )
}

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
  enVol = null,
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
  /** Ce qui est **en route en ce moment** — payé, pas encore arrivé. `null` la
   *  plupart du temps. Ces images-là ne se voyaient que dans la grille de la
   *  galerie, alors qu'on paie aussi depuis le codex et depuis l'établi : on
   *  dépensait, l'écran ne bougeait pas, et l'on recliquait. */
  enVol?: EnVol | null
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
          // `min-w-0 truncate` : ce libellé cède la place au bloc en route
          // quand la colonne est étroite. **Avec un plancher** — sans lui il
          // tombait à zéro pixel, mesuré au navigateur : un contrôle réduit à
          // rien n'est plus un contrôle, c'est une panne silencieuse.
          className="mesure h-[34px] min-w-[3.5rem] truncate text-[10px] text-texte-3 hover:text-texte-2"
        >
          {negatifOuvert ? "− " : "+ "}prompt négatif
          {promptNegatif && !negatifOuvert ? " ·" : ""}
        </button>

        <div className="ml-auto flex flex-col items-end">
          {/* **Tant que quelque chose est en route, l'état prend la place du
              bouton** — et Générer redescend dans la fente. C'est l'inversion
              qui répare le bug : ce qu'on recliquerait est devenu ce qui dit
              que ça marche. Voir `EnRoute`. */}
          {enVol && enVol.images > 0 ? (
            <EnRoute {...enVol} />
          ) : (
            <Bouton principal inactif={refus !== null} onClick={onGenerer} enfants={
              variations > 1 ? `Générer ${variations} variations` : "Générer"
            } />
          )}
          {/* La fente : une ligne mono 10 px alignée à droite, quatre
              locataires, **jamais deux à la fois** — `docs/DESIGN.md`
              `docs/design-motifs.md`, *Le revers*. Le refus l'emporte : quand le catalogue
              n'a jamais été reçu, il n'y a ni date à porter ni nuance à faire,
              et c'est le grisé ordinaire qui reprend la main.

              **Et le refus l'emporte même sur un départ en cours** : quand rien
              ne peut partir, un lien `Générer encore` mentirait sur le geste
              disponible. Le bloc au-dessus continue de dire ce qui est en
              route ; la fente dit ce qu'on peut faire ensuite, comme toujours. */}
          {refus ? (
            <Raison texte={refus} ouAller={ouAller} onAller={onAller} />
          ) : revers ? (
            <Revers
              texte={revers.texte}
              geste="Réessayer"
              onGeste={revers.onReessayer}
              enCours={revers.enCours}
            />
          ) : enVol && enVol.images > 0 ? (
            /* **Générer, en lien, pendant qu'un lot est en route.** Il reste à
                portée — on a le droit de lancer une seconde série sans attendre
                la première — mais il cesse d'être ce qui saute aux yeux, et
                c'est tout le remède. */
            <button
              type="button"
              onClick={onGenerer}
              className="mesure mt-1 text-[10px] text-signal hover:text-signal-clair"
            >
              Générer encore ›
            </button>
          ) : (
            <p className="mesure mt-1 text-[10px] text-texte-3">Ctrl + Entrée</p>
          )}
        </div>
      </div>
    </div>
  )
}
