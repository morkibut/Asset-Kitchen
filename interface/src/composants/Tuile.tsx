// La tuile — l'objet central du produit.
//
// « L'emplacement » (`docs/DESIGN.md`) : au moment où la génération part,
// N tuiles paraissent **à leur taille définitive**, jauge en pied de zone image
// et compteur en mono. La tuile devient l'image, ou devient l'échec. La grille
// ne se recompose jamais entre le départ et l'arrivée — l'œil reste où il est,
// et l'échec atterrit à l'endroit précis où le succès serait arrivé.
//
// **Depuis T3, la grille est faite d'assets** — c'est la bibliothèque, et c'est
// la seule grille du produit (US-31). Un emplacement qui n'a pas encore donné
// son asset y tient quand même sa place, et il la tient sous **la même clé**
// (`<génération>-<rang>`, qui est précisément l'identifiant que l'asset
// portera) : l'image ne se glisse donc pas à côté de son attente, elle la
// remplace. C'est ce qui rend vraie, sans machinerie, la phrase du design.
//
// **Dessinée sur le papier depuis `D3`** (11 septembre 2026), d'après
// `docs/archive/pistes-2026-09-04/carnet/Galerie.dc.html` :
//
// - **arrondi 5**, celui que la planche donne à toutes ses vignettes. Le châssis
//   sombre tenait le rayon 0 — « le bord de la tuile et le bord du sprite sont
//   la même sorte de ligne » — et l'argument ne survit pas au papier : sur un
//   fond clair, c'est le pourtour neutre qui sépare l'image de la page, pas
//   l'angle vif ;
// - **derrière l'image, `--pourtour`** — le gris neutre à 15 % de réflectance,
//   « derrière une image, et nulle part ailleurs » ;
// - **le damier là où il veut dire quelque chose** : une image détourée montre
//   sa transparence, une image encore brute montre le gris. C'est la règle des
//   onze pièces prise au mot — *le damier dit transparent, le gris dit pas
//   encore détouré* —, et le châssis sombre damait les deux sans distinction ;
// - **le liseré rouille pour ce qui est choisi**, posé en `outline` intérieur,
//   comme `.tuile-on` sur la planche.
//
// Aucune ombre : la grille se lit toujours comme une planche contact.

import { useEffect, useState } from "react"
import {
  api,
  depense,
  estMiroir,
  type Asset,
  type Emplacement,
  type Generation,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { Jauge, type Zoom } from "./pieces"

/**
 * Ce que la grille itère. Un asset, un emplacement qui l'attend encore, ou un
 * clip gardé (B22).
 *
 * `cle` est la même dans les trois cas, et c'est tout le mécanisme :
 * `<génération>-<rang>`, l'identifiant que l'asset porte à sa naissance.
 * `date` et `rang` sont l'ordre — la date du **lot**, jamais celle de
 * l'arrivée, sans quoi les variations d'un même lot glisseraient les unes par
 * rapport aux autres pendant qu'on les regarde.
 *
 * **`"clip"` est un clip relu depuis le dépôt**, pas depuis le chantier qui
 * vient de le voir arriver — c'est ce qui le fait survivre à la fermeture de
 * son lot (`api.clips`). Il n'a pas d'`emplacement` : rien de subi (raté, en
 * cours) n'a de sens pour un clip qu'on relit longtemps après, il est arrivé
 * ou il n'existe pas.
 */
export type Entree =
  | { cle: string; date: number; rang: number; sorte: "asset"; asset: Asset }
  | {
      cle: string
      date: number
      rang: number
      sorte: "emplacement"
      generation: Generation
      emplacement: Emplacement
    }
  | { cle: string; date: number; rang: number; sorte: "clip"; generation: Generation }

export function Tuile({
  entree,
  selectionnee,
  cote,
  zoom,
  onOuvrir,
  onRelancer,
  onChoisir,
  autresDuLot = 0,
  onGarderLeClip,
  onDecouperLeClip,
  onOuvrirLeClip,
}: {
  entree: Entree
  selectionnee: boolean
  /** Le cran de la grille, en pixels — ce que la tuile demande au serveur, et
   *  non ce qu'elle rend. Voir `api.vignette`. */
  cote: number
  /** Le cran de zoom de la grille — 1, 2 ou 4 (U8).
   *
   *  **Le vocabulaire du produit, pas une largeur mesurée.** La tuile pourrait
   *  se mesurer elle-même et décider à partir de sa largeur ; elle dépendrait
   *  alors d'une mise en page qui n'existe pas encore au premier rendu, et
   *  clignoterait le temps d'une image. Le cran, lui, est connu d'avance et
   *  c'est déjà lui qui décide de tout le reste de la grille. */
  zoom: Zoom
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRelancer: (generation: string, rang: number) => void
  /** **Ouvrir le choix d'une planche qui attend** (R6). Il ne dépense rien —
   *  c'est la seule chose à savoir avant de le confier à une tuile. */
  onChoisir: (generation: string, rang: number) => void
  /** Combien d'autres clips sont encore montrés du **même geste** (A9). Zéro
   *  quand le clip est parti seul, et le bouton *garder celui-ci* ne paraît
   *  alors pas : il n'y aurait rien à jeter. */
  autresDuLot?: number
  /** Garder ce clip-là et jeter les autres du lot. **Un seul geste, et il se
   *  défait** ; ce qui a été payé reste au journal. */
  onGarderLeClip?: (generation: string) => void
  /** **Ouvrir le montage de ce clip** (A10). Il ne dépense rien — c'est la
   *  seule chose à savoir avant de le confier à une tuile, et c'est la même
   *  garantie que pour le choix d'une planche. */
  onDecouperLeClip?: (generation: string) => void
  /** **Ouvrir la fiche de ce clip dans la colonne de droite** (V3.02) — le
   *  même geste que celui qui ouvre la fiche d'une image, et rien d'autre. */
  onOuvrirLeClip?: (generation: string) => void
}) {
  const asset = entree.sorte === "asset" ? entree.asset : null
  const emplacement = entree.sorte === "emplacement" ? entree.emplacement : null
  const lot = entree.sorte === "asset" ? null : entree.generation
  const rate =
    emplacement !== null &&
    (emplacement.statut === "echouee" || emplacement.statut === "interrompue")
  const enCours =
    emplacement !== null &&
    (emplacement.statut === "en_cours" || emplacement.statut === "en_attente")
  /** **La planche est là, et elle attend un regard** (R6). Ni raté ni en
   *  cours : payée, arrivée, entière, et rien n'est entré en bibliothèque tant
   *  que l'auteur n'a pas dit ce qu'il gardait. Elle porte donc l'image de la
   *  planche — ce qu'on a acheté se voit — et un geste, pas une raison. */
  const attend = lot?.pliage?.attend_un_choix === true
  /** **Un clip, et il est arrivé** (A9), qu'il vienne du chantier ou du dépôt
   *  (B22). Ni raté ni en cours : payé, arrivé, et il garde sa place parce
   *  qu'aucun asset ne viendra le remplacer — un clip n'entre pas en
   *  bibliothèque, ce n'est pas une image. Un clip relu depuis le dépôt
   *  (`sorte: "clip"`) n'a pas d'emplacement à interroger : il n'est là que
   *  parce qu'il est arrivé, sinon `api.clips` ne l'aurait pas rendu.
   *
   *  Ce qu'il montre est **une image prélevée dedans**, jamais une tuile en
   *  erreur : c'est le critère de la tranche, en toutes lettres. Quand
   *  l'extraction n'a pas pu se faire — le décodeur manque —, la tuile dit
   *  pourquoi et reste une tuile ordinaire. Le clip, lui, reste payé. */
  const clip = lot?.clip ?? null
  /** **Le damier ne se pose que sur ce qui est détouré** (`D3`). Sans passe de
   *  détourage, l'image est celle qui est arrivée du fournisseur : elle est
   *  opaque, et le damier promettrait alors une transparence qui n'existe pas.
   *  Elle se juge donc sur `--pourtour`, le gris neutre, comme la planche la
   *  dessine. */
  const detouree = asset !== null && asset.recette.passes.length > 0
  const clipArrive =
    clip !== null && (entree.sorte === "clip" || emplacement?.statut === "reussie")
  const clipEnImages = clipArrive && clip.images > 0

  const titre =
    entree.sorte === "asset" ? entree.asset.label : entree.generation.demande.prompt

  // **La tuile montre ce que l'asset est devenu**, pas ce que le fournisseur a
  // rendu : dès qu'une recette existe, c'est le rendu qui s'affiche. Juger sur
  // le brut alors qu'on a détouré et remis sur grille ferait juger autre chose
  // que ce qui partira dans le jeu.
  //
  // C'est `sujetAsset` qui le dit, et il le dit **une fois pour trois surfaces**
  // — la tuile, la fiche et l'aperçu. Espace, le pointeur posé ici, ouvre donc
  // exactement l'image qui est sous les yeux, jamais une autre.
  const sujet = asset ? sujetAsset(asset) : null
  // **La grille demande une vignette, l'aperçu demande le fichier.** Ce sont
  // deux emplois, donc deux adresses : la tuile fait cent quarante-cinq pixels
  // de côté et recevait jusqu'à mille vingt-quatre — mesuré, 25,5 Mo
  // téléchargés pour 0,5 Mo affiché sur un seul passage. `sujet` reste ce que
  // le pointeur vise, et c'est bien le fichier entier qu'Espace doit ouvrir.
  const source = asset
    ? vignetteAsset(asset, cote)
    : clipEnImages && lot
      ? // La couverture du clip (B22) — sa première frame, réduite au
        // serveur, jamais le fichier entier : cent clips ne doivent pas
        // faire télécharger cent images à leur résolution native pour
        // n'en montrer qu'un timbre-poste.
        api.couvertureDuClip(lot.identifiant, cote)
      : attend && lot && emplacement
        ? api.image(lot.identifiant, emplacement.rang)
        : null
  const visee = useVisee(sujet)
  // **Le survol qui fait défiler les frames d'un clip** (B22). Porté par la
  // tuile entière — la même surface que `visee` — et non par une sous-partie :
  // survoler l'image ou sa légende doit jouer la même chose.
  const [survolee, setSurvolee] = useState(false)

  /** La tuile est-elle à la taille de repos ? **Mesuré, pas estimé** : à 1× la
   *  tuile fait 132,6 px et la ligne des mesures en réclame 137 (U8). Aux deux
   *  autres crans, la place suffit largement. */
  const serree = zoom === 1

  return (
    <figure
      onPointerEnter={() => {
        visee.entrer()
        setSurvolee(true)
      }}
      onPointerLeave={() => {
        visee.sortir()
        setSurvolee(false)
      }}
      className={[
        // **`min-w-0`, et c'est lui qui répare le débordement** (U8). Une case
        // de grille vaut `min-width: auto` par défaut, c'est-à-dire *au moins
        // la largeur de mon contenu* : la ligne des mesures réclamait 137 px
        // dans une tuile de 132,6, et la tuile s'élargissait pour la loger —
        // donc le lien *PNG ↓* sortait de 13,2 px sur la droite et se posait
        // sur la voisine. Mesuré au navigateur le 31 août 2026. La tuile est
        // désormais bornée par sa colonne, et c'est à son contenu de tenir
        // dedans.
        "arrivee relative flex min-w-0 flex-col overflow-hidden rounded-5 border",
        rate ? "border-trait-echec bg-fond-echec" : "border-trait bg-carte",
        // Le liseré du sélectionné — `.tuile-on` de `Galerie.dc.html` : deux
        // pixels de rouille posés **à l'intérieur** du bord, donc rien n'est
        // déplacé dans la grille. Aucune couleur de plus ici.
        selectionnee ? "outline-2 -outline-offset-2 outline-signal" : "",
      ].join(" ")}
    >
      {/* **Deux noms pour deux surfaces, jamais le même deux fois.** L'image et
          le bouton du pied mènent au même écran quand la planche attend, mais
          les nommer pareil ferait dire deux fois la même chose à qui lit
          l'écran autrement qu'avec les yeux — et rendrait le second
          introuvable. */}
      <button
        type="button"
        disabled={
          !asset && !clipArrive && !(attend && lot !== null && emplacement !== null)
        }
        onClick={(evenement) => {
          if (asset) return onOuvrir(asset.identifiant, evenement)
          // **Un clip s'ouvre comme une image** (V3.02) : le clic ouvre sa
          // fiche dans la colonne de droite — la vidéo, ce qu'il porte, ce
          // qu'il a produit — et rien d'autre. Avant la tranche, ce bouton
          // était là, désactivé : le clip était la seule chose de la galerie
          // qui ne s'ouvrait pas.
          if (clipArrive && lot) {
            if (onOuvrirLeClip) return onOuvrirLeClip(lot.identifiant)
            return
          }
          // La planche entière est ce qu'on veut voir en grand pour choisir :
          // le clic mène là où le bouton du bas mène, et pas ailleurs.
          if (attend && lot && emplacement) onChoisir(lot.identifiant, emplacement.rang)
        }}
        aria-label={attend ? "Ouvrir la planche" : "Ouvrir le résultat"}
        className={`relative aspect-square w-full cursor-pointer overflow-hidden disabled:cursor-default ${
          detouree ? "damier-papier" : "bg-pourtour"
        }`}
      >
        {source && !(clipEnImages && survolee) && (
          <img
            src={source}
            alt={titre.slice(0, 80)}
            // **Rien ne part pour ce qui est sous le bas de l'écran.** Toutes
            // les images de la grille partaient d'un coup, y compris celles
            // qu'il aurait fallu faire défiler pour voir. Mesuré : 82 requêtes
            // d'image pour un seul passage, la plus lente à arriver après
            // 3,8 s — en local, sans réseau.
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {/* **Le survol joue les frames en boucle** (B22) — sur la planche
            contact déjà servie au montage (`A10`), jamais un nouvel appel
            payant : elle ne se charge qu'ici, au premier survol, jamais à
            l'ouverture de la galerie. */}
        {clipEnImages && lot && clip && (
          <PelliculeAuSurvol
            survolee={survolee}
            identifiant={lot.identifiant}
            images={clip.images}
            cadence={clip.cadence}
          />
        )}
        {clipEnImages && clip && <CoinDeLecture clip={clip} />}
        {enCours && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2">
            <Jauge
              demarreLe={emplacement.demarre_le}
              attendue={emplacement.duree_attendue_s}
            />
          </div>
        )}
        {rate && <Raté raison={emplacement.raison} />}
        {attend && lot?.pliage && <Attend pliage={lot.pliage} />}
        <Pastille asset={asset} emplacement={emplacement} />
        {/* « Coin plein haut-droit, `--signal`, 13 px — la seule marque
            visuelle, parce que c'est la seule que l'auteur pose lui-même »
            (`docs/design-motifs.md` § La tuile). Ce que le système constate est un
            mot ; ce que l'auteur pose est une forme. */}
        {asset?.favori && <CoinFavori />}
      </button>

      <figcaption className="flex min-h-[34px] flex-col justify-center gap-[4px] border-t border-trait px-2 py-1.5">
        <span className="truncate text-[11.5px] text-encre" title={titre}>
          {titre}
        </span>
        {clipArrive && lot ? (
          <CeQueLeClipDit
            generation={lot}
            autresDuLot={autresDuLot}
            onGarder={
              onGarderLeClip ? () => onGarderLeClip(lot.identifiant) : undefined
            }
            onDecouper={
              onDecouperLeClip ? () => onDecouperLeClip(lot.identifiant) : undefined
            }
          />
        ) : attend && lot && emplacement ? (
          // **Le geste, jamais une raison.** Une planche qui attend n'a rien
          // raté : ce qui lui manque est une décision, et le mot du bouton est
          // celui de la décision — pas « voir », qui laisserait croire qu'on
          // peut regarder sans trancher.
          <button
            type="button"
            onClick={() => onChoisir(lot.identifiant, emplacement.rang)}
            className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
          >
            Choisir ce qu'on garde
          </button>
        ) : rate && lot && emplacement ? (
          <button
            type="button"
            onClick={() => onRelancer(lot.identifiant, emplacement.rang)}
            className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
          >
            Relancer
          </button>
        ) : asset ? (
          <Mesures asset={asset} serree={serree} />
        ) : (
          <span className="mesure text-[10.5px] text-encre-4">en attente</span>
        )}
      </figcaption>
    </figure>
  )
}

/** Le nombre de colonnes de la planche contact (`atelier/services/montage.py`,
 *  `CONTACT_COLONNES`). Un clip ne change jamais, donc sa planche non plus :
 *  c'est une constante du format écrit sur le disque, pas une mesure — la
 *  changer invaliderait toutes les planches déjà là. */
const COLONNES_DE_LA_PELLICULE = 16

/** Défile les frames d'un clip pendant le survol, revient à zéro en sortant.
 *
 *  **Bornée à douze par seconde** : au-delà, l'œil ne distingue plus une frame
 *  de plus et le navigateur décoderait pour rien — c'est la même retenue que
 *  la mesure du contour (`docs/PIEGES.md`), appliquée ici au rythme plutôt
 *  qu'à un seuil. */
function useDefilementDesFrames(actif: boolean, images: number, cadence: number): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!actif || images <= 1) {
      setFrame(0)
      return
    }
    const parSeconde = Math.min(Math.max(cadence || 8, 2), 12)
    const identifiant = window.setInterval(() => {
      setFrame((f) => (f + 1) % images)
    }, 1000 / parSeconde)
    return () => window.clearInterval(identifiant)
  }, [actif, images, cadence])
  return frame
}

/** Les frames d'un clip, en boucle, au survol (B22).
 *
 *  **Une seule image chargée** — la planche contact déjà écrite par le
 *  montage (`A10`, `api.contactDuClip`) — jamais une par frame : cent clips
 *  survolés un par un ne coûteraient jamais plus qu'une planche à la fois, et
 *  aucun ne coûte quoi que ce soit tant qu'on ne le survole pas, puisque ce
 *  composant ne pose son `background-image` que rendu, c'est-à-dire survolé.
 *
 *  **En pourcentages, jamais en pixels.** La case de la grille n'a pas de
 *  largeur connue d'avance — `auto-fill` l'étire selon la fenêtre — et mesurer
 *  le DOM pour la retrouver serait le genre de mesure que ce produit évite
 *  déjà ailleurs (U8). `background-size` en `%` se cale sur la boîte réelle
 *  tout seul ; seul le nombre de colonnes et de lignes de la grille compte. */
function PelliculeAuSurvol({
  survolee,
  identifiant,
  images,
  cadence,
}: {
  survolee: boolean
  identifiant: string
  images: number
  cadence: number
}) {
  const frame = useDefilementDesFrames(survolee, images, cadence)
  if (!survolee) return null
  const colonnes = COLONNES_DE_LA_PELLICULE
  const lignes = Math.max(1, Math.ceil(images / colonnes))
  const colonne = frame % colonnes
  const ligne = Math.floor(frame / colonnes)
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${api.contactDuClip(identifiant)})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${colonnes * 100}% ${lignes * 100}%`,
        backgroundPosition:
          `${colonnes > 1 ? (colonne * 100) / (colonnes - 1) : 0}% ` +
          `${lignes > 1 ? (ligne * 100) / (lignes - 1) : 0}%`,
        imageRendering: "pixelated",
      }}
    />
  )
}

/** Le coin de lecture — un triangle et la durée, en bas à gauche (B22).
 *
 *  **La seule différence au repos** entre la tuile d'un clip et celle d'une
 *  image : ni cadre, ni couleur à part, comme le propose la maquette
 *  (`Galerie.dc.html`). La durée est **mesurée sur le fichier** — images sur
 *  cadence —, jamais celle qu'on avait demandée : c'est la règle constante du
 *  produit, et un clip peut rendre quatre secondes et demie pour cinq
 *  commandées. */
function CoinDeLecture({ clip }: { clip: { images: number; cadence: number } }) {
  if (!clip.cadence) return null
  const secondes = Math.max(1, Math.round(clip.images / clip.cadence))
  return (
    <span
      aria-hidden
      /* Le coin de lecture est **la seule marque sombre de la tuile**, et c'est
         la planche qui le veut : un galet d'encre à 72 %, arrondi 8, écrit en
         papier — il se pose sur l'image, jamais sur le châssis, et l'encre du
         papier y serait illisible sur un sprite clair. */
      className="mesure absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-8 bg-encre/72 px-1 py-px text-[10.5px] text-papier"
    >
      <svg width="6" height="7" viewBox="0 0 6 7" fill="currentColor">
        <polygon points="0,0 6,3.5 0,7" />
      </svg>
      {secondes}s
    </span>
  )
}

/** Ce qu'un clip arrivé dit sous son image (A9).
 *
 *  **Trois choses, et pas une de plus** — c'est la même règle que pour un asset,
 *  et un clip n'a pas droit à plus de place qu'une image :
 *
 *  1. **ce qu'il porte** : combien d'images, à quelle cadence — mesurées sur le
 *     fichier, jamais déduites de ce qui a été demandé ;
 *  2. **ce qu'il a coûté**, et ce montant est celui de la facture, pas
 *     l'estimation lue avant l'envoi ;
 *  3. **le geste**, quand il y en a un : garder celui-ci et jeter les autres du
 *     même lot.
 *
 *  Quand les images n'ont pas pu être tirées, la première ligne dit pourquoi.
 *  **Ce n'est pas un échec** : le clip est là, il est payé, et il se découpera
 *  le jour où ce qui manque sera installé. */
function CeQueLeClipDit({
  generation,
  autresDuLot,
  onGarder,
  onDecouper,
}: {
  generation: Generation
  autresDuLot: number
  onGarder?: () => void
  onDecouper?: () => void
}) {
  const clip = generation.clip
  if (!clip) return null
  return (
    <>
      <div className="mesure flex min-w-0 items-center gap-1.5 text-[11px] text-encre-2">
        <span className="min-w-0 truncate">
          {clip.images > 0
            ? `${clip.images} images · ${clip.cadence.toFixed(0)} i/s`
            : (clip.extraction_refus ?? "images non tirées")}
        </span>
        <span aria-hidden className="shrink-0">
          ·
        </span>
        {/* **Le montant de la facture, pas l'estimation.** Le mot qui va avec
            vient du serveur, écrit une fois : deux rédactions de la même
            nuance finiraient par dire deux choses. */}
        <span className="shrink-0" title={clip.montant_dit}>
          {depense(generation.consomme, generation.unite)}
        </span>
      </div>
      {/* **Garder celui-ci, et jeter les autres du même geste.** Il ne paraît
          que s'il y a d'autres clips à jeter : proposer de jeter zéro clip
          serait proposer un geste qui ne fait rien. */}
      {autresDuLot > 0 && onGarder && (
        <button
          type="button"
          onClick={onGarder}
          title="les autres quittent la galerie et restent au journal des dépenses"
          className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
        >
          Garder celui-ci · jeter {autresDuLot} autre
          {autresDuLot > 1 ? "s" : ""}
        </button>
      )}
      {/* **La porte du montage** (A10), et il n'y en a qu'une : un clip se
          découpe depuis sa tuile, là où on le regarde. Elle ne paraît que quand
          les images ont pu être tirées — sans elles il n'y a rien à découper, et
          la première ligne dit déjà pourquoi. */}
      {clip.images > 0 && onDecouper && (
        <button
          type="button"
          onClick={onDecouper}
          title="rien n'y dépense : le clip est déjà payé"
          className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
        >
          Découper ›
        </button>
      )}
    </>
  )
}

/** Une tuile porte au maximum un nom et trois mesures. Au-delà, c'est la fiche
 *  qui prend le relais — c'est la règle qui empêche la grille de se charger.
 *
 *  **`--encre-2` et 11 px, et c'est la règle du projet qui l'impose** — corrigé
 *  le 31 août 2026, sur `--texte-2` qui était alors l'encre courante du châssis
 *  sombre. `--texte-3` était alors sous le seuil de lisibilité
 *  *délibérément*
 *  (`docs/archive/DESIGN-chassis-chaud-2026-09-04.md` § Typography), et la
 *  phrase qui l'autorisait disait à quelle
 *  condition : « il ne porte jamais d'information dont l'absence bloquerait —
 *  il porte le grisé, la méta et la raison, tous redondants avec une autre
 *  marque ». **Le prix n'est redondant avec rien** : l'image ne dit pas ce
 *  qu'elle a coûté, et l'argent est l'enjeu que le produit met au centre — il a
 *  un écran à lui. Il était donc le seul fait non redondant de la carte, écrit
 *  dans le gris réservé à ce qui l'est. */
function Mesures({ asset, serree }: { asset: Asset; serree: boolean }) {
  return (
    <div
      data-mesures
      className="mesure flex min-w-0 items-center gap-1.5 text-[11px] text-encre-2"
    >
      {/* Les dimensions **du rendu** quand il y en a un : c'est l'image qu'on
          regarde, donc c'est elle qu'on mesure.

          **Elle est la seule des trois qui cède** (U8). Le prix est l'enjeu que
          le produit met au centre et le téléchargement est une cible : ni l'un
          ni l'autre ne se tronque. Les dimensions, elles, sont redites en entier
          sur la fiche, à un clic — et une largeur coupée reste lisible là où un
          prix coupé ne veut plus rien dire. */}
      <span className="min-w-0 truncate">
        {asset.traite
          ? `${asset.rendu_largeur}×${asset.rendu_hauteur}`
          : `${asset.largeur}×${asset.hauteur}`}
      </span>
      {/* **Le point de séparation cède avant les mesures.** Mesuré au
          navigateur : à la taille de repos, la ligne dispose de 120 px et ses
          quatre morceaux en réclament 124 — les dimensions se coupaient donc de
          trois pixels, et `831×907` se lisait `831×9…`. Le point et son écart
          valent treize pixels à eux deux, et un point n'est pas une mesure : ce
          qu'il fait, l'écart le fait déjà. */}
      {!serree && (
        <span aria-hidden className="shrink-0">
          ·
        </span>
      )}
      {/* **« gratuit », jamais « $0,0000 »** (F2). Une tuile faite chez un
          fournisseur qui ne facture pas n'a pas de prix ; afficher zéro dollar
          se lirait *sans limite* là où il faut lire *sans prix*. Ce qu'elle a
          consommé — un jeton — se lit sur sa fiche, où il y a la place de le
          dire avec son mot. */}
      {/* **Une image obtenue au miroir ne dit pas un prix, elle dit d'où elle
          vient** (B1). Elle n'a rien coûté : l'argent a été dépensé une fois,
          pour l'image de départ, et la filiation y mène. « $0,0000 » se lirait
          comme un appel qui n'a rien facturé, ce qui est une autre chose — ici
          il n'y a pas eu d'appel du tout.
          **Les deux faits ensemble, jamais l'un sans l'autre** : une image
          générée sur laquelle l'auteur pose ensuite un miroir garde son prix,
          parce que l'étiquette dit ce qui a été payé.
          Le mot seul à la taille de repos, comme le téléchargement juste en
          dessous : la ligne dispose de 120 px, et « gratuit » y prendrait la
          place des dimensions. */}
      <span className="shrink-0">
        {estMiroir(asset.recette) && asset.consomme === 0
          ? serree
            ? "miroir"
            : "miroir · gratuit"
          : depense(asset.consomme, asset.unite)}
      </span>
      {/* **À la taille de repos, le lien se réduit à sa flèche.** La planche
          contact ne perd pas une colonne pour un bouton secondaire, et le
          téléchargement reste atteignable aux trois tailles — c'est le mot qui
          part, pas la cible. Le nom complet reste dans le `title` et dans le
          nom accessible, pour qui lit l'écran autrement qu'avec les yeux. */}
      <a
        href={api.telechargementAsset(asset.identifiant)}
        download
        onClick={(e) => e.stopPropagation()}
        title="télécharger le PNG"
        aria-label="télécharger le PNG"
        className="ml-auto shrink-0 text-signal hover:opacity-70"
      >
        {serree ? "↓" : "PNG ↓"}
      </a>
    </div>
  )
}

/**
 * Une pastille, et une seule — pour un état **subi**.
 *
 * `docs/design-motifs.md` § La tuile en donne la liste close : `réglé`, `agent`,
 * `parent supprimé`. « interrompu » lui appartient depuis T1, pour la même
 * raison : c'est ce que le système constate, jamais ce que l'auteur pose.
 *
 * L'ordre n'est pas arbitraire : une filiation cassée se lit avant un réglage,
 * parce qu'elle change ce qu'on peut encore comprendre de l'image.
 */
function Pastille({
  asset,
  emplacement,
}: {
  asset: Asset | null
  emplacement: Emplacement | null
}) {
  // **`agent` passe avant `réglé`, et c'est l'ordre qui décide** puisqu'une
  // tuile n'en porte qu'une. « Savoir à qui parler quand quelque chose me
  // surprend » (US-39) est ce qu'on cherche en premier devant une image
  // inattendue ; qu'elle ait aussi été retouchée se lit dans sa fiche.
  const [mot, teinte] =
    emplacement?.statut === "interrompue"
      ? ["interrompu", "text-encre-attention"]
      : asset?.parent_supprime
        ? ["parent supprimé", "text-encre-attention"]
        : asset?.provenance === "agent"
          ? // Le rouille, et c'est la seule fois qu'une pastille le porte : ce
            // qu'un agent a posé se lit comme ce que le produit fait — et le
            // rouille ne se pose ici qu'en encre, jamais en fond.
            ["agent", "text-signal"]
          : asset?.epingle
            ? ["réglé", "text-encre-attention"]
            : [null, ""]
  if (!mot) return null
  return (
    // **Une étiquette de papier posée sur l'image**, comme la marque *calque*
    // de `Galerie.dc.html` : une carte claire plutôt qu'un voile sombre — le
    // mot y garde sa couleur, et l'encre d'attention reste lisible.
    <span
      className={`mesure absolute top-1.5 left-1.5 rounded-5 bg-carte px-1 py-px text-[10.5px] ${teinte}`}
    >
      {mot}
    </span>
  )
}

function CoinFavori() {
  return (
    <span
      aria-label="favori"
      className="absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-t-signal border-l-transparent"
    />
  )
}

/** « Un raté affiche sa raison en clair à la place de l'image. » */
function Raté({ raison }: { raison: string | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      <p className="text-center text-[11.5px] leading-snug text-echec">
        {raison ?? "échec sans raison connue"}
      </p>
    </div>
  )
}

/** Une planche arrivée qui attend un regard (R6).
 *
 * **Ni un raté ni une pastille**, et ce n'est pas une nuance : un raté couvre
 * l'image, parce qu'il n'y a rien à voir dessous ; une pastille dit un état
 * subi. Ici l'image est justement ce qu'il faut regarder — c'est elle qu'on a
 * payée — et l'état n'est pas subi, il attend un geste. Le bandeau se pose donc
 * **en bas**, sur un fond posé, et laisse la planche visible.
 *
 * **Le trio d'attention** — fond, trait, encre —, comme « interrompu » et
 * « réglé à la main » depuis `D2` : arrêté à un instant, que le système ne
 * bougera pas tout seul, et que seul un geste de l'auteur relance. C'est très
 * exactement cette définition-là, et le carnet n'a pas de quatrième signal.
 */
function Attend({ pliage }: { pliage: NonNullable<Generation["pliage"]> }) {
  const pleines = pliage.pleines?.length ?? 0
  const mot =
    pliage.surplus > 0
      ? `${pliage.surplus} de trop`
      : `${pleines} case${pleines > 1 ? "s" : ""} pleine${pleines > 1 ? "s" : ""}`
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 border-t border-trait-attention bg-fond-attention px-2 py-1">
      <span aria-hidden className="inline-block h-px w-2 bg-encre-attention" />
      <span className="mesure truncate text-[10.5px] text-encre-attention">
        {pliage.trouvees} sujets · {mot}
      </span>
    </div>
  )
}
