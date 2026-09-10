// La galerie — la grille du jeu, son arbre, sa barre d'outils, sa fiche.
//
// **Elle était écrite en clair dans `App.tsx`** jusqu'à `C4` : la grille, la
// cible, les réinjections et la barre d'état y tenaient quatre cents lignes au
// milieu de six mille, et le carnet renvoyait vers elles sans qu'aucun fichier
// ne porte son nom. Elle est désormais un écran comme les vingt et un autres du
// carnet — un fichier, une planche (`docs/pistes-2026-09-04/carnet/Galerie.dc.html`).
//
// **Une seule grille dans tout le produit** (US-31). Celle qui sert à réutiliser
// est exactement celle qui sert à organiser : mêmes filtres, même recherche,
// même sélection multiple. Elle est faite d'assets — la bibliothèque —, et un
// emplacement qui n'a pas encore donné son asset y tient sa place sous la même
// clé, donc à la même place. L'image ne se glisse pas à côté de son attente :
// elle la remplace.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  filtreActif,
  FILTRE_VIDE,
  poserLeFichier,
  type Asset,
  type Bibliotheque,
  type Etat,
  type Filtre,
  type Generation,
  type Personnage,
  type Univers,
  type Pose,
  type Reinjection,
  type Role,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { CRANS, ZOOMS, type Zoom } from "./chassis"
import { useImport, type Import } from "./Import"
import { Tuile, type Entree } from "./Tuile"
import { Arbre } from "./Arbre"
import { BarreOutils } from "./BarreOutils"
import { CeQuiNEstPasEntre } from "./Import"
import { EcranDepliage } from "./Depliage"
import { EcranMontage } from "./Montage"
import { Fiche } from "./Fiche"
import { FicheDuClip } from "./FicheDuClip"
import type { Racine } from "../lieux"
import type { Table } from "../recette"
import type { Fente } from "./EnTeteDeSurface"
import type { Annulation } from "./BarreOutils"
import { fondre, type Vivant } from "../flux"
import { useDepot } from "./Tableau"


// ── La case visée ───────────────────────────────────────────────────────────

/**
 * Pour quelle case le prochain appel partira (US-120).
 *
 * **La bande n'existe que quand l'atelier est armé** — même règle que celle des
 * réinjections, juste au-dessus : une rangée vide en permanence au-dessus du
 * prompt serait du cadrage affiché, et le prompt est l'endroit où l'atelier
 * s'ouvre.
 *
 * Elle est là parce qu'une intention invisible est une intention qu'on oublie :
 * ce qui décide où l'image ira doit se lire au moment où l'on appuie, à côté du
 * bouton qui paie. Et elle se défait d'un clic — armer n'est pas s'engager.
 */
export function Cible({
  personnage,
  poses,
  onRetirer,
  onDesarmer,
}: {
  /** **Relus dans les listes vivantes**, jamais gardés au moment de l'armement :
   *  un personnage supprimé ou une pose retirée du plan font disparaître la
   *  bande, ce qui est exactement ce qu'il faut — la case n'existe plus. */
  personnage: Personnage | null
  /** Une case, ou N depuis C2. **Le nom du personnage ne se répète pas** : il
   *  est écrit une fois, et les attitudes suivent — un lot n'en vise qu'un. */
  poses: Pose[]
  onRetirer: (pose: Pose) => void
  onDesarmer: () => void
}) {
  if (!personnage || poses.length === 0) return null
  const lot = poses.length >= 2
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-bord bg-fond-1 px-4 pt-3">
      <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Pour
      </span>
      <span className="flex flex-wrap items-center gap-1.5 rounded-[2px] border border-signal-froid bg-signal-froid/13 py-1 pr-1 pl-2">
        <span className="text-[11.5px] text-texte">{personnage.nom}</span>
        {poses.map((pose) => (
          <span key={pose.identifiant} className="flex items-center">
            <span className="mesure text-[10px] text-signal-froid">{pose.nom}</span>
            <button
              type="button"
              onClick={() => onRetirer(pose)}
              aria-label={`Retirer ${pose.nom} de ce qui part`}
              className="mesure px-1 text-[10px] text-texte-3 hover:text-echec-froid"
            >
              ×
            </button>
          </span>
        ))}
      </span>
      {/* **Un lot le dit en toutes lettres, au-dessus du bouton qui paie.**
          C'est la phrase du § Le grisé porte sa raison prise par l'autre bout :
          ici rien n'est refusé, mais ce qui va se passer n'est pas ce qu'on
          fait d'habitude — neuf cases, un seul appel — et l'écrire coûte moins
          cher que de le faire deviner. */}
      {lot && (
        <span className="mesure text-[10px] text-texte-3">
          {poses.length} attitudes, un seul appel
        </span>
      )}
      {lot && (
        <button
          type="button"
          onClick={onDesarmer}
          aria-label="Ne plus viser ces cases"
          className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-echec-froid"
        >
          tout retirer
        </button>
      )}
    </div>
  )
}

// ── Les images réinjectées ──────────────────────────────────────────────────

/**
 * Ce qui repartira avec l'appel (US-12).
 *
 * La bande n'existe que quand il y a quelque chose dedans : une rangée vide en
 * permanence au-dessus du prompt serait du cadrage affiché, et le prompt est
 * l'endroit où l'atelier s'ouvre.
 */
export function Reinjections({
  reinjections,
  grille,
  onRetirer,
  onRole,
}: {
  reinjections: Reinjection[]
  grille: Asset[]
  onRetirer: (asset: string) => void
  onRole: (asset: string, role: Role) => void
}) {
  if (reinjections.length === 0) return null
  return (
    <div className="flex items-center gap-2 border-b border-bord bg-fond-1 px-4 pt-3">
      <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Repart avec
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {reinjections.map(({ asset, role }) => (
          <UneReinjection
            key={asset}
            connu={grille.find((a) => a.identifiant === asset)}
            asset={asset}
            role={role}
            onRetirer={onRetirer}
            onRole={onRole}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Une réinjection : sa vignette, son rôle, son retrait.
 *
 * **Deux corrections du 31 août 2026 (E0), et la même cause.** La vignette
 * demandait son image à `api.rendu` en direct, alors que `sujetAsset` est le
 * seul endroit du produit qui nomme l'adresse de l'image d'un asset : un asset
 * sans recette n'a pas de rendu, et la bande montrait donc un trou là où la
 * grille montre l'image. Et la barre d'espace ne l'atteignait pas, faute d'un
 * composant où poser la visée — un hook ne s'appelle pas dans une boucle.
 */
function UneReinjection({
  connu,
  asset,
  role,
  onRetirer,
  onRole,
}: {
  connu: Asset | undefined
  asset: string
  role: Role
  onRetirer: (asset: string) => void
  onRole: (asset: string, role: Role) => void
}) {
  const visee = useVisee(connu ? sujetAsset(connu) : null)
  return (
    <span
      className="flex items-center gap-1.5 rounded-[2px] border border-bord bg-fond-2 py-1 pr-1 pl-1"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      {connu && (
        <img
          // **Vingt-quatre pixels ne demandent pas un fichier de deux
          // mégaoctets** — corrigé le 31 août 2026, en même temps que la
          // grille. Le cran demandé est celui de la grille au repos : la
          // vignette est déjà dans le cache du navigateur, et la bande ne
          // coûte alors rien du tout. Ce que le pointeur vise, lui, reste le
          // fichier entier — c'est ce qu'Espace doit ouvrir.
          src={vignetteAsset(connu, 256)}
          alt=""
          className="damier h-6 w-6 object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      )}
      <select
        aria-label="Rôle de la réinjection"
        value={role}
        onChange={(e) => onRole(asset, e.target.value as Role)}
        className="mesure bg-transparent text-[10px] text-texte-2"
      >
        <option value="reference">référence</option>
        <option value="edition">source d'édition</option>
        <option value="style">guide de style</option>
      </select>
      <button
        type="button"
        onClick={() => onRetirer(asset)}
        aria-label="Retirer la réinjection"
        className="mesure px-1 text-[10px] text-texte-3 hover:text-echec-froid"
      >
        ×
      </button>
    </span>
  )
}

// ── La grille ───────────────────────────────────────────────────────────────

export function Grille({
  entrees,
  selection,
  filtre,
  zoom,
  entree,
  onRelancer,
  onChoisir,
  onOuvrir,
  onRetirerFiltre,
  onGarderLeClip,
  onDecouperLeClip,
  onOuvrirLeClip,
}: {
  entrees: Entree[]
  selection: string[]
  filtre: Filtre
  /** Le cran **rendu**, pas le cran choisi : à une largeur où le choix ne tient
   *  pas, la grille rend le plus grand qui tienne, et la barre d'outils le dit. */
  zoom: Zoom
  /** Faire entrer une image en la déposant ici (US-167). */
  entree: Import
  onRelancer: (generation: string, rang: number) => void
  /** **Ouvrir le choix d'une planche qui attend** (R6). Elle est arrivée et
   *  payée ; ce qui lui manque est une décision, et ce geste ne dépense rien. */
  onChoisir: (generation: string, rang: number) => void
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRetirerFiltre: () => void
  /** **Garder ce clip-là, jeter les autres du même geste** (A9). Absent là où
   *  la grille sert à désigner plutôt qu'à juger — on ne jette pas trois vidéos
   *  payées en cherchant une image de référence. */
  onGarderLeClip?: (generation: string) => void
  /** **Ouvrir le montage de ce clip** (A10). Absent pour la même raison que le
   *  geste d'au-dessus : une grille qui sert à désigner une image de référence
   *  n'a pas à ouvrir un écran de découpage. */
  onDecouperLeClip?: (generation: string) => void
  /** **Ouvrir la fiche de ce clip** (V3.02), dans la même colonne que la fiche
   *  d'une image. Absent là où la grille ne montre pas de clips. */
  onOuvrirLeClip?: (generation: string) => void
}) {
  // **La même mécanique de dépôt que le tableau d'inspiration**, réemployée
  // telle quelle : c'est le geste, pas la surface, qui décide de la forme. Un
  // texte lâché ici ne fait rien — la bibliothèque n'a pas de carte texte —, et
  // ne rien faire est la bonne réponse plutôt qu'un refus.
  const depot = useDepot(
    (fichier) => void entree.entrer(fichier),
    () => {},
  )
  // **Deux états vides, et ce ne sont pas les mêmes** (US-34, US-35). Une
  // bibliothèque vide invite à écrire ; un filtre sans résultat est une impasse,
  // et une impasse doit porter le geste qui en sort — sinon la grille est muette
  // au moment précis où elle devrait aider.
  if (entrees.length === 0) {
    return filtreActif(filtre) ? (
      <div
        {...depot.props}
        {...NOMMEE}
        className={`flex flex-1 flex-col items-center justify-center gap-3 p-4 ${cadreDepot(depot.survole)}`}
      >
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Rien ne répond à ce filtre.
        </p>
        <button
          type="button"
          onClick={onRetirerFiltre}
          className="mesure text-[11px] text-signal-froid hover:text-signal-froid-clair"
        >
          Retirer le filtre ›
        </button>
      </div>
    ) : (
      <div
        {...depot.props}
        {...NOMMEE}
        className={`flex flex-1 items-center justify-center p-4 ${cadreDepot(depot.survole)}`}
      >
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Rien n'est encore sorti d'ici. <em className="text-texte-2">Écris.</em>
        </p>
      </div>
    )
  }

  return (
    <div
      {...depot.props}
      {...NOMMEE}
      className={`defile min-h-0 flex-1 overflow-y-auto p-4 ${cadreDepot(depot.survole)}`}
    >
      <div
        className="grid gap-[9px]"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${CRANS[zoom]}px, 1fr))`,
        }}
      >
        {entrees.map((entree) => (
          <Tuile
            key={entree.cle}
            entree={entree}
            selectionnee={selection.includes(entree.cle)}
            // **Deux tailles servies, pas trois, et jamais la largeur rendue.**
            // Une case d'`auto-fill` mesure entre son cran et presque deux
            // fois son cran ; demander 256 px au cran 1 couvre donc la case la
            // plus large **et** un écran à deux points par pixel, sans jamais
            // agrandir une vignette. Une adresse par largeur de fenêtre, elle,
            // viderait le cache du navigateur à chaque repli de panneau.
            cote={Math.max(256, CRANS[zoom])}
            zoom={zoom}
            onRelancer={onRelancer}
            onChoisir={onChoisir}
            onOuvrir={onOuvrir}
            /* **Combien d'autres clips du même geste sont encore montrés.** Il
               se compte sur les entrées de la grille, la seule vérité de cet
               écran : un clip déjà jeté n'y est plus, donc il ne se compte
               plus, et le bouton disparaît de lui-même quand il ne reste
               qu'un clip du lot. */
            autresDuLot={autresDuLot(entrees, entree)}
            onGarderLeClip={onGarderLeClip}
            onDecouperLeClip={onDecouperLeClip}
            onOuvrirLeClip={onOuvrirLeClip}
          />
        ))}
      </div>
    </div>
  )
}

/** Combien d'autres clips du même geste la grille montre encore (A9).
 *
 *  **Sur le lot écrit par le serveur, jamais sur une ressemblance.** Quatre
 *  clips lancés d'un coup partagent leur texte et leur minute ; les rapprocher
 *  là-dessus marcherait presque toujours, et jetterait la mauvaise vidéo payée
 *  le jour où l'auteur relance exactement la même chose. */
function autresDuLot(entrees: Entree[], entree: Entree): number {
  // **`"clip"` compte aussi** (B22) : un lot pas encore départagé peut
  // survivre à la fermeture du chantier, un clip de chaque côté du départage
  // — un dans le chantier qui vient d'arriver, l'autre déjà relu depuis le
  // dépôt après un rechargement.
  if (entree.sorte === "asset") return 0
  const lot = entree.generation.clip?.lot
  if (!lot) return 0
  return entrees.filter(
    (autre) =>
      autre.sorte !== "asset" &&
      autre.generation.clip?.lot === lot &&
      autre.generation.identifiant !== entree.generation.identifiant,
  ).length
}

/** Ce que la grille montre quand un fichier la survole.
 *
 *  **Un liseré intérieur, jamais un voile.** La grille est la seule surface du
 *  produit où l'on juge : un calque par-dessus les images cacherait ce qu'on
 *  est en train de regarder au moment précis où l'on décide où déposer. Le
 *  `--signal` posé en `inset` dit « ici » sans rien recouvrir, et il ne déplace
 *  rien — un `outline` ne prend pas de place dans la mise en page.
 *
 *  Écrit une fois pour les trois états de la grille : pleine, filtrée à vide,
 *  et vide. Une bibliothèque vide est très exactement le moment où l'on fait
 *  entrer sa première image, et une surface qui n'accepterait le dépôt qu'une
 *  fois pleine serait fermée quand elle sert le plus. */
const cadreDepot = (survole: boolean) =>
  survole ? "outline outline-1 -outline-offset-1 outline-signal-froid" : ""

/** La grille se nomme, dans ses trois états.
 *
 *  **Parce qu'elle reçoit un dépôt** : une surface où l'on peut lâcher un
 *  fichier doit pouvoir être désignée autrement que par la vue — c'est la même
 *  raison qui a nommé le dépliant du prompt. Le nom est le même pour les trois
 *  états, parce que c'est la même surface : pleine, filtrée à vide, ou vide. */
const NOMMEE = { role: "region", "aria-label": "Grille des images" } as const

// « Zoom 1× / 2× / 4× — un niveau indisponible à la largeur courante est
// **grisé, pas caché** » (`docs/DESIGN.md` § Layout). Les crans eux-mêmes vivent
// dans le châssis : ce sont ceux des vignettes du tableau d'inspiration, et un
// seul vocabulaire de taille traverse tout le produit.
//
// Le padding de la zone centrale et la gouttière de la grille, `docs/DESIGN.md`
// § Spacing. Ils servent à répondre à une seule question : **combien de tuiles
// de ce cran tiennent côte à côte ?**
const PADDING = 16
const GOUTTIERE = 9

// **Le plafond de la grille** (B3), identique à `PAR_DEFAUT` côté serveur
// (`atelier/services/bibliotheque.py`). « Charger la suite » ne fait que le
// faire monter : la même requête, plus large, jamais un second appel qui
// s'additionnerait à la première page.
const TAILLE_PAGE_GRILLE = 200

/**
 * Un cran tient-il à cette largeur ?
 *
 * **Il faut deux colonnes, pas une.** Trouvé en ouvrant l'atelier, jamais au
 * banc : `minmax(cran, 1fr)` accepte une colonne unique et l'**étire** jusqu'au
 * bord — à 4× sur une colonne de 1060 px, une seule tuile occupait 1028 px, soit
 * huit fois la taille de repos pour un contrôle qui en annonce quatre. Une
 * grille d'une colonne n'est plus une planche contact, c'est une visionneuse, et
 * ce n'est pas ce que le zoom promet.
 *
 * **1× est toujours disponible.** C'est l'état de repos du produit, et quelque
 * chose doit se rendre : le griser laisserait la grille sans cran valide.
 */
const tient = (cran: Zoom, largeur: number): boolean =>
  cran === 1 || 2 * CRANS[cran] + GOUTTIERE <= largeur - 2 * PADDING

// ── `C4` · ce que la galerie tient ──────────────────────────────────────────
//
// **Un seul crochet, et il porte tout l'écran** : sa grille, son filtre, sa
// sélection, son zoom, ses jugements. Tout cela vivait en clair dans `App.tsx`
// — huit cents lignes au milieu de six mille, sans qu'aucun fichier ne porte le
// nom de l'écran. Rien n'y a changé de comportement : les états sont les mêmes,
// dans le même ordre, et ce que le reste du produit leur emprunte est rendu.
//
// `App` garde ce qui n'appartient pas à la galerie et que la galerie lit — le
// chantier, la bibliothèque, la fente du châssis — et le passe ici.

export type CeQueLaGalerieLit = {
  bibliotheque: Bibliotheque
  chantier: Generation[]
  setChantier: React.Dispatch<React.SetStateAction<Generation[]>>
  clipsDuJeu: Generation[]
  echouer: (erreur: unknown, defaut: string) => void
  setPanne: React.Dispatch<React.SetStateAction<string | null>>
  setFente: React.Dispatch<React.SetStateAction<Fente>>
  replies: Record<string, boolean>
  vivant: { current: Vivant }
}

export function useGalerie({
  bibliotheque,
  chantier,
  setChantier,
  clipsDuJeu,
  echouer,
  setPanne,
  setFente,
  replies,
  vivant,
}: CeQueLaGalerieLit) {
  /** La planche dont on choisit ce qu'on garde (R6) — **par identifiant, jamais
   *  par objet**. La génération vit dans le chantier, que le flux tient à jour :
   *  en garder une copie ici ferait un second exemplaire qui vieillirait pendant
   *  qu'on regarde, et l'écran trancherait sur des mesures périmées. */
  const [depliage, setDepliage] = useState<{
    generation: string
    rang: number
  } | null>(null)
  // La bibliothèque telle que le serveur l'a filtrée. C'est **lui** qui filtre :
  // la recherche doit porter sur tout, pas sur ce que cet onglet a en mémoire.
  const [grille, setGrille] = useState<Asset[]>([])
  // **Ce que le filtre courant rendrait sans plafond** (B3). La grille
  // s'arrêtait à 200 sans le dire — l'auteur croyait avoir tout vu. `null`
  // tant que le premier `GET /assets` n'a pas répondu : on ne compare jamais
  // une grille encore vide à un total qu'on n'a pas encore lu.
  const [totalGrille, setTotalGrille] = useState<number | null>(null)
  const [limiteGrille, setLimiteGrille] = useState(TAILLE_PAGE_GRILLE)

  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE)
  /** La famille qu'on regarde dans la galerie, `""` pour toutes, `"aucune"`
   *  pour ce qui n'appartient à aucune chose du jeu (E4), `"clips"` pour eux
   *  seuls — distinct des familles, parce qu'un clip n'en a aucune (B22). */
  const [famille, setFamille] = useState("")
  const [selection, setSelection] = useState<string[]>([])
  const [annulation, setAnnulation] = useState<Annulation | null>(null)
  // **Le seul geste du produit dont le résultat n'arrive pas par le flux** :
  // une archive ne s'annonce pas, elle se télécharge. Ce drapeau ne sert
  // qu'à empêcher un second clic pendant que le premier fabrique le ZIP —
  // deux archives identiques dans les téléchargements pour un double-clic.
  const [exportEnCours, setExportEnCours] = useState(false)

  /** **Le clip dont la fiche est ouverte** (V3.02) — l'identifiant de sa
   *  génération, ou rien.
   *
   *  La même colonne que la fiche d'une image, pour ce que la galerie garde
   *  sans que ce soit une image : un clip se regarde maintenant d'un clic,
   *  comme elle — et le clic ne fait rien d'autre. C'est un état à part, et
   *  non une sélection : les gestes de la barre d'outils — favori, supprimer,
   *  exporter — sont des gestes d'image, et une clé de clip qui s'y mêlerait
   *  ferait « supprimer » tenter d'effacer une vidéo payée. */
  const [ficheClip, setFicheClip] = useState<string | null>(null)

  /** Le zoom de la grille — 1× / 2× / 4×, `docs/DESIGN.md` § Layout. Il n'est
   *  ni sauvegardé ni partagé : c'est un réglage de coup d'œil, pas une
   *  propriété de la bibliothèque. */
  const [zoom, setZoom] = useState<Zoom>(1)
  /** La largeur de la colonne centrale, **mesurée**. C'est elle qui décide
   *  quels crans de zoom tiennent. Zéro veut dire « pas encore mesurée » et non
   *  « nulle » : rien n'est grisé tant qu'on n'a pas regardé. */
  const [largeurCentre, setLargeurCentre] = useState(0)
  const centre = useRef<HTMLElement>(null)


  const dernierClic = useRef<string | null>(null)

  /** **Faire entrer une image depuis l'écran** (R3). Le bouton de la barre
   *  d'outils et le dépôt sur la grille passent tous les deux par ici, donc par
   *  le même service que l'outil MCP : il n'y a qu'un endroit du produit qui
   *  fasse entrer une image, et il n'a pas bougé. */
  const entree = useImport({
    onErreur: (raison) => setPanne(raison),
    onEntree: () => void vivant.current.relireGrille(),
  })

  // ── La largeur de la colonne centrale, mesurée ────────────────────────────
  //
  // **On regarde la colonne, on ne la recalcule pas.** Les largeurs du § Layout
  // sont déjà écrites une fois, dans `colonnes` ; les soustraire à nouveau ici
  // en ferait une seconde vérité, et le jour où l'une des deux bouge, le grisé
  // du zoom mentirait sans que rien ne le dise.
  //
  // **Trois moments, et il n'y en a pas d'autre** : au montage, quand la fenêtre
  // change de taille, et quand la transition de 160 ms sur les colonnes s'achève
  // — c'est-à-dire quand un panneau s'est replié ou que la fiche s'est ouverte.
  // Mesurer au moment où l'on replie donnerait la largeur d'**avant** : la
  // transition n'a pas commencé, et c'est l'arrivée qui compte.
  //
  // Pas de `ResizeObserver` : ses rappels sont livrés par la boucle de rendu, et
  // un onglet qui ne compose pas ses images ne les livre jamais — vu le 27 août
  // au navigateur, où le grisé du zoom n'est **jamais** apparu. Un rectangle se
  // lit à la demande, dans tous les cas.
  const mesurerCentre = useCallback(() => {
    const largeur = centre.current?.getBoundingClientRect().width ?? 0
    setLargeurCentre((deja) => (Math.abs(deja - largeur) < 1 ? deja : largeur))
  }, [])

  useEffect(() => {
    window.addEventListener("resize", mesurerCentre)
    return () => window.removeEventListener("resize", mesurerCentre)
  }, [mesurerCentre])


  // **La fiche n'est pas un état : c'est la sélection quand elle vaut un.**
  //
  // Les tenir tous les deux, c'était deux vérités sur la même chose — et elles
  // ont divergé au premier clic un peu vif : deux clics dans le même tick
  // lisaient la même sélection périmée, et le second effaçait le premier au
  // lieu de s'y ajouter. Vu au navigateur, jamais au banc, parce qu'une main
  // humaine met plus d'un rendu entre deux clics.
  //
  // La déduire tient aussi la promesse de `docs/DESIGN.md` : l'anneau
  // `--lumiere` dit « sélectionné », et il n'a plus qu'un seul sens.
  const fiche = selection.length === 1 ? selection[0] : null

  // ── La grille ─────────────────────────────────────────────────────────────
  //
  // Elle se redemande quand le filtre change, et **seulement** alors. Le
  // filtrage vit côté serveur : le rejouer ici sur les deux cents assets que cet
  // onglet a en mémoire ferait dire à la recherche autre chose qu'à la
  // bibliothèque, et c'est exactement la divergence relevée chez SpriteCook.

  const relireGrille = useCallback(async () => {
    try {
      const { assets, total } = await api.assets({
        ...filtre,
        sansProjet: bibliotheque.courant === null,
        limite: limiteGrille,
      })
      setGrille(assets)
      setTotalGrille(total)
    } catch (erreur) {
      echouer(erreur, "la bibliothèque ne répond pas")
    }
  }, [filtre, bibliotheque.courant, limiteGrille])

  useEffect(() => {
    void relireGrille()
  }, [relireGrille])

  // **Changer de filtre repart de la première page** (B3) : sans ça, une
  // recherche neuve hériterait du plafond agrandi par « Charger la suite »
  // sur la recherche précédente, et montrerait quatre cents images d'un
  // sujet qui n'en a que huit.
  useEffect(() => {
    setLimiteGrille(TAILLE_PAGE_GRILLE)
  }, [filtre, bibliotheque.courant])

  const chargerLaSuiteGrille = () =>
    setLimiteGrille((limite) => limite + TAILLE_PAGE_GRILLE)

  // ── Ce que la grille montre ───────────────────────────────────────────────

  // **Le filtre « clips »** (B22) : distinct des familles, parce qu'un clip
  // n'en a aucune — le rejouer aux mêmes places que « personnages » ou
  // « décors » ferait passer pour une famille ce qui n'en est pas une.
  const clipsSeuls = famille === "clips"

  const entrees = useMemo<Entree[]>(() => {
    const parCle = new Map<string, Entree>()
    if (!filtreActif(filtre)) {
      // **Les clips gardés, relus depuis le dépôt** (B22), avant le chantier
      // pour que celui-ci les recouvre à la même clé s'il en tient une
      // version plus fraîche — encore en cours, ou pas encore départagée. Un
      // clip n'a pas de famille : il ne paraît que sous « Toutes » ou sous
      // le filtre qui lui est dédié.
      if (famille === "" || clipsSeuls) {
        for (const generation of clipsDuJeu) {
          if (generation.clip?.jete) continue
          const emplacement = generation.emplacements[0]
          const rang = emplacement?.rang ?? 0
          const cle = `${generation.identifiant}-${rang}`
          parCle.set(cle, {
            cle,
            date: generation.cree_le,
            rang,
            sorte: "clip",
            generation,
          })
        }
      }
      // Le chantier ensuite : il tient sa place **avant** que l'image n'existe.
      // Il ne paraît pas quand un filtre est posé — un lot qui n'est pas encore
      // arrivé n'a rien à quoi un filtre puisse s'appliquer, et le faire
      // apparaître dans une recherche mentirait sur ce qu'elle a trouvé.
      for (const generation of chantier) {
        // **Le chantier d'un autre jeu ne montre rien ici** (B4). Le flux
        // filtre déjà ce qui arrive en direct ; ce garde-ci couvre ce qui
        // était déjà dans le chantier **avant** un changement de jeu — le
        // premier message du flux ne se rejoue pas à la bascule, seuls les
        // faits qui suivent le sont.
        if (generation.projet !== bibliotheque.courant) continue
        // **Une planche qui attend un choix garde sa place** (R6). Elle est
        // réussie — payée, arrivée, entière — mais rien n'est entré en
        // bibliothèque : sans cette ligne, sa tuile disparaîtrait à l'arrivée
        // et aucun asset ne prendrait le relais. L'auteur verrait son appel
        // s'évanouir sous ses yeux, ce qui est exactement le gâchis silencieux
        // que la tranche répare.
        const attend = generation.pliage?.attend_un_choix === true
        // **Un clip garde sa place à l'arrivée** (A9), et pour la raison même
        // qui la garde à une planche : il n'entre pas en bibliothèque — ce
        // n'est pas une image —, donc aucun asset ne prendrait le relais. Sans
        // cette ligne, la tuile d'un clip payé disparaîtrait sous les yeux de
        // l'auteur à la seconde où il arrive.
        //
        // **Jeté, il s'en va** : c'est tout le sens du geste. Il reste au
        // journal des dépenses, où l'argent, lui, ne s'efface jamais.
        const clip = generation.clip ?? null
        if (clip?.jete) continue
        // **Un clip n'a pas de famille** (B22) : le filtre « Clips » le garde,
        // un filtre de famille précis l'exclut comme il exclurait n'importe
        // quelle image qui n'est pas la sienne. Ce qui n'est pas un clip ne
        // gagne ni ne perd rien ici — c'est la règle d'avant B22.
        if (clip && famille && famille !== "clips") continue
        if (!clip && clipsSeuls) continue
        for (const emplacement of generation.emplacements) {
          if (emplacement.statut === "reussie" && !attend && !clip) continue
          const cle = `${generation.identifiant}-${emplacement.rang}`
          parCle.set(cle, {
            cle,
            date: generation.cree_le,
            rang: emplacement.rang,
            sorte: "emplacement",
            generation,
            emplacement,
          })
        }
      }
    }
    // Puis la bibliothèque : un asset **remplace** l'emplacement qui l'attendait,
    // à la même clé et donc à la même place. Absente du tout quand seuls les
    // clips sont demandés — un clip n'étant pas un asset, aucun des deux ne se
    // recouvrent jamais, mais autant ne pas parcourir la grille pour rien.
    if (!clipsSeuls) {
      for (const asset of grille) {
        // **Le filtre par famille se pose ici, sur la grille chargée** (E4). Ce
        // n'est pas un filtre de serveur comme la recherche ou la collection : la
        // famille d'une image est celle de la chose du jeu à qui elle appartient,
        // et la seule famille qui existe aujourd'hui est *personnages*. Le jour
        // où les quatre autres portent des choses (E15), il descendra au serveur
        // avec elles — d'ici là, le poser en bas lui ferait porter une requête
        // pour une distinction qui n'existe pas encore.
        if (famille === "aucune" && asset.personnage) continue
        if (famille === "personnages" && !asset.personnage) continue
        if (famille && famille !== "aucune" && famille !== "personnages") continue
        parCle.set(asset.identifiant, {
          cle: asset.identifiant,
          date: asset.cree_le,
          rang: asset.rang,
          sorte: "asset",
          asset,
        })
      }
    }
    return [...parCle.values()].sort(
      (a, b) => b.date - a.date || a.rang - b.rang,
    )
  }, [chantier, clipsDuJeu, grille, filtre, famille, clipsSeuls, bibliotheque.courant])

  /** La planche ouverte, relue dans le chantier — la seule vérité (R6).
   *
   *  Elle disparaît d'elle-même quand le lot cesse d'attendre : le dépliage
   *  fait, la génération revient sans `attend_un_choix`, et l'écran se referme
   *  sans que personne ait à le fermer. */
  const plancheAChoisir = depliage
    ? (() => {
        const lot = chantier.find((g) => g.identifiant === depliage.generation)
        return lot?.pliage?.attend_un_choix
          ? { generation: lot, rang: depliage.rang }
          : null
      })()
    : null

  const relancer = async (identifiant: string, rang: number) => {
    try {
      const generation = await api.relancer(identifiant, rang)
      setChantier((liste) => fondre(liste, generation))
    } catch (erreur) {
      echouer(erreur, "relance refusée")
    }
  }

  // ── Juger : sélectionner, marquer, jeter ──────────────────────────────────

  const ouvrir = (identifiant: string, evenement?: React.MouseEvent) => {
    const multiple = evenement?.ctrlKey || evenement?.metaKey
    const etendue = evenement?.shiftKey
    if (multiple) {
      // La forme fonctionnelle, et pas la valeur du rendu courant : deux clics
      // rapprochés partagent le même rendu, donc la même sélection périmée.
      setSelection((precedente) =>
        precedente.includes(identifiant)
          ? precedente.filter((i) => i !== identifiant)
          : [...precedente, identifiant],
      )
    } else if (etendue && dernierClic.current) {
      const cles = entrees.map((e) => e.cle)
      const depart = cles.indexOf(dernierClic.current)
      const arrivee = cles.indexOf(identifiant)
      if (depart >= 0 && arrivee >= 0) {
        const [a, b] = depart < arrivee ? [depart, arrivee] : [arrivee, depart]
        setSelection(
          cles
            .slice(a, b + 1)
            .filter((cle) => grille.some((g) => g.identifiant === cle)),
        )
      }
    } else {
      setSelection([identifiant])
    }
    dernierClic.current = identifiant
  }

  /** **Ce qui vient d'être jeté**, ou rien — pour que celui qui l'a jeté puisse
   *  le rendre sans dépendre d'un état lu au prochain rendu. */
  const supprimer = async (identifiants: string[]): Promise<string[] | null> => {
    if (identifiants.length === 0) return null
    try {
      const rendu = await api.supprimerAssets(identifiants)
      setAnnulation({ identifiants: rendu.supprimes, expireLe: rendu.expire_le })
      setSelection([])
      await relireGrille()
      return rendu.supprimes
    } catch (erreur) {
      echouer(erreur, "suppression refusée")
      return null
    }
  }

  /** Rendre ce qui a été jeté. **Les identifiants sont passés, jamais relus** :
   *  un compte rendu posé au moment de la suppression garderait sinon la valeur
   *  d'`annulation` telle qu'elle était *avant* — c'est-à-dire vide, et le
   *  geste ne ferait rien. Constaté au navigateur le 4 septembre 2026. */
  const rendre = async (identifiants: string[]) => {
    try {
      await api.restaurer(identifiants)
      setAnnulation(null)
      await relireGrille()
    } catch (erreur) {
      setAnnulation(null)
      echouer(erreur, "annulation refusée")
    }
  }

  const annuler = async () => {
    if (!annulation) return
    await rendre(annulation.identifiants)
  }

  /** **Garder ce clip-là, et jeter les autres du même geste** (A9).
   *
   *  Les autres se lisent sur le lot que le serveur a écrit, jamais sur une
   *  ressemblance : quatre clips lancés d'un coup partagent leur texte et leur
   *  minute, et les rapprocher là-dessus jetterait la mauvaise vidéo payée le
   *  jour où l'auteur relance exactement la même chose.
   *
   *  **Le compte rendu porte le geste qui rend**, comme la suppression depuis
   *  l'établi : le bandeau d'annulation de la barre d'outils décompte huit
   *  secondes, et ce geste-ci n'expire pas — un clip écarté est toujours là,
   *  au journal, et se remontre quand on veut. Un compte à rebours mentirait. */
  const garderLeClip = (identifiant: string) => {
    const clip = chantier.find((g) => g.identifiant === identifiant)
    const lot = clip?.clip?.lot
    if (!lot) return
    const autres = chantier
      .filter(
        (g) =>
          g.clip?.lot === lot &&
          !g.clip.jete &&
          g.identifiant !== identifiant,
      )
      .map((g) => g.identifiant)
    if (autres.length === 0) return
    void api
      .garderClip(identifiant, autres)
      .then(({ garde, jetes }) => {
        setChantier((liste) =>
          [garde, ...jetes].reduce((tenue, recu) => fondre(tenue, recu), liste),
        )
        setFente({
          ton: "ok",
          texte: (
            <>
              {jetes.length} clip{jetes.length > 1 ? "s" : ""} écarté
              {jetes.length > 1 ? "s" : ""} — ils restent au journal des
              dépenses,{" "}
              <button
                type="button"
                onClick={() => {
                  void api
                    .rendreClips(autres)
                    .then(({ clips }) =>
                      setChantier((liste) =>
                        clips.reduce((tenue, recu) => fondre(tenue, recu), liste),
                      ),
                    )
                  setFente(null)
                }}
                className="underline underline-offset-2 hover:text-texte"
              >
                les rendre
              </button>
            </>
          ),
        })
      })
      .catch((erreur) => echouer(erreur, "le clip n'a pas pu être gardé"))
  }

  const marquerFavori = async (identifiants: string[], favori: boolean) => {
    try {
      await api.favori(identifiants, favori)
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "favori refusé")
    }
  }

  /** L'export d'une sélection (US-76).
   *
   *  **La sélection reste après coup**, contrairement au rangement qui la vide :
   *  exporter ne change rien à la bibliothèque, donc rien ne justifie de perdre
   *  ce qu'on avait sous la main — on exporte souvent deux fois de suite, une
   *  fois pour le jeu et une fois pour l'archive.
   */
  const exporter = async () => {
    if (exportEnCours) return
    setExportEnCours(true)
    try {
      poserLeFichier(await api.exporter(selection))
    } catch (erreur) {
      echouer(erreur, "export refusé")
    } finally {
      setExportEnCours(false)
    }
  }

  const ranger = async (rangement: {
    projet?: string | null
    collection?: string | null
  }) => {
    try {
      await api.ranger(selection, rangement)
      setSelection([])
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "rangement refusé")
    }
  }

  // **Trois colonnes depuis E4** — `240px · 1fr · 380px` : où ça se range, la
  // grille d'assets, la fiche d'une image. C'est l'ancien atelier **moins sa
  // colonne de réglages de 300 px**, qui suit la barre qui paie : la galerie ne
  // paie plus, donc elle n'a rien à régler avant de payer.
  const colonnes = [
    `${replies.arbre ? 0 : 240}px`,
    "minmax(0,1fr)",
    `${fiche || ficheClip ? 380 : 0}px`,
  ].join(" ")

  const ouverte = fiche ? grille.find((a) => a.identifiant === fiche) : undefined

  /** **Le clip dont la fiche est ouverte**, relu dans ce que la galerie tient
   *  déjà — jamais un aller-retour pour ouvrir : la fiche se bâtit de ce qui
   *  est sous les yeux, comme la fiche d'une image. */
  const clipEnFiche = ficheClip
    ? entrees.find(
        (e): e is Extract<Entree, { sorte: "emplacement" }> =>
          e.sorte === "emplacement" &&
          e.generation.identifiant === ficheClip &&
          e.generation.clip != null,
      )
    : undefined
  /** La fiche d'un clip disparaît avec sa tuile : un clip jeté quitte la
   *  grille, et une colonne ouverte sur ce qui n'existe plus serait une porte
   *  sur un mur. On referme alors, silencieusement, comme la fiche d'une image
   *  supprimée. */
  useEffect(() => {
    if (!ficheClip) return
    const presente = entrees.some(
      (e) => e.sorte === "emplacement" && e.generation.identifiant === ficheClip,
    )
    if (!presente) setFicheClip(null)
  }, [entrees, ficheClip])

  // **Un cran est indisponible quand la colonne est trop étroite pour lui**, et
  // c'est une largeur mesurée qui le dit — pas une soustraction refaite ici à
  // partir des largeurs du § Layout, qui serait une seconde vérité sur la même
  // chose. Tant que rien n'a été mesuré, rien n'est grisé : **zéro n'est pas
  // une largeur, c'est l'absence de mesure**, exactement comme le `0×0` d'une
  // carte qui n'a pas abouti.
  const indisponibles = largeurCentre
    ? ZOOMS.filter((cran) => !tient(cran, largeurCentre))
    : []

  // **Le cran choisi reste choisi**, même devenu trop grand — c'est la règle
  // du modèle du catalogue (US-9), et il n'y a aucune raison d'en avoir deux.
  // Mais une grille doit rendre quelque chose : elle rend donc au plus grand
  // cran qui tient, et la barre d'outils **dit** que c'est ce qui se passe.
  // Sans cette phrase, le contrôle annoncerait 4× sur des tuiles de 400 px.
  const zoomRendu = indisponibles.includes(zoom)
    ? ([...ZOOMS].reverse().find((cran) => !indisponibles.includes(cran)) ?? 1)
    : zoom

  return {
    annulation,
    annuler,
    chargerLaSuiteGrille,
    clipEnFiche,
    colonnes,
    depliage,
    entree,
    entrees,
    exportEnCours,
    exporter,
    famille,
    fiche,
    filtre,
    garderLeClip,
    grille,
    indisponibles,
    marquerFavori,
    mesurerCentre,
    ouverte,
    ouvrir,
    plancheAChoisir,
    ranger,
    relancer,
    relireGrille,
    rendre,
    selection,
    setDepliage,
    setFamille,
    setFicheClip,
    setFiltre,
    setGrille,
    setSelection,
    setZoom,
    supprimer,
    totalGrille,
    zoom,
    zoomRendu,
    centre,
    ficheClip,
  }
}

// ── `C4` · l'écran de la galerie ────────────────────────────────────────────
//
// Trois colonnes : où ça se range, la grille, la fiche d'une image — la planche
// `docs/pistes-2026-09-04/carnet/Galerie.dc.html`. Elle était écrite en clair
// dans `App.tsx` ; elle est un écran, comme les vingt et un autres du carnet.
//
// Ce qu'elle tient lui vient de `useGalerie`, en un seul objet ; le reste — le
// jeu ouvert, l'univers, les portes vers les autres écrans — lui est passé,
// parce que ce n'est pas à elle.

/** Ce que la galerie tient — la valise que `useGalerie` rend. */
export type EtatDeLaGalerie = ReturnType<typeof useGalerie>

export function Galerie({
  g,
  bibliotheque,
  echouer,
  etat,
  montageOuvert,
  setMontageOuvert,
  ouvrirLAtelierDeBande,
  ouvrirLaRetouche,
  personnages,
  plan,
  reinjecter,
  reprendreReglages,
  setChantier,
  setChoseOuverte,
  poserLaRacine,
  setPanne,
  univers,
}: {
  g: EtatDeLaGalerie
  bibliotheque: Bibliotheque
  echouer: (erreur: unknown, defaut: string) => void
  /** Ce que l'atelier sait de lui-même. La fiche d'une image ne se monte pas
   *  tant qu'il n'est pas arrivé — la même garde qu'avant `C4`. */
  etat: Etat | null
  montageOuvert: string | null
  setMontageOuvert: (clip: string | null) => void
  ouvrirLAtelierDeBande: (identifiant: string | null) => void
  ouvrirLaRetouche: (asset: string | null, table?: Table | null) => void
  personnages: Personnage[]
  plan: Pose[]
  reinjecter: (asset: string, role: Role) => void
  reprendreReglages: (asset: Asset) => void
  setChantier: React.Dispatch<React.SetStateAction<Generation[]>>
  setChoseOuverte: (sujet: string | null) => void
  poserLaRacine: (prochaine: Racine) => void
  setPanne: React.Dispatch<React.SetStateAction<string | null>>
  univers: Univers
}) {
  const {
    annulation,
    annuler,
    centre,
    chargerLaSuiteGrille,
    clipEnFiche,
    colonnes,
    entree,
    entrees,
    exportEnCours,
    exporter,
    famille,
    filtre,
    garderLeClip,
    grille,
    indisponibles,
    marquerFavori,
    mesurerCentre,
    ouverte,
    ouvrir,
    plancheAChoisir,
    ranger,
    relancer,
    selection,
    setDepliage,
    setFamille,
    setFicheClip,
    setFiltre,
    setSelection,
    setZoom,
    supprimer,
    totalGrille,
    zoom,
    zoomRendu,
  } = g

  /* Quatre colonnes, largeurs absolues, et 160 ms sur la largeur quand
      l'une se replie ou que la fiche s'ouvre — `docs/DESIGN.md` § Motion,
      « tu n'as pas perdu ta place ». Les panneaux restent montés : replier
      n'est pas fermer, et retrouver un panneau où on l'avait laissé fait
      partie de ce que le mouvement promet.

      **Chaque case est `flex`, et c'est ce qui borne le panneau qu'elle
      porte** — `docs/archive/DESIGN-chassis-chaud-2026-09-04.md` § Six
      règles de comportement, la première. Une case
      de grille est haute comme sa piste, mais un `aside` posé dedans en
      bloc reste haut comme *son contenu* : son `overflow-y-auto` intérieur
      n'a alors rien à contraindre, et l'`overflow-hidden` de la case rogne
      en silence. Mesuré au navigateur le 27 août 2026 : 300 px coupés dans
      les réglages, 660 px dans la fiche — la filiation entière hors
      d'atteinte. En `flex`, l'`aside` est étiré, exactement comme sur
      l'écran Univers, seul panneau du produit qui défilait.

      **Elle n'est plus le fond du produit, elle est un onglet.** Jusqu'à la
      V2.1 cette grille était toujours montée et les autres écrans venaient
      se poser dessus ; c'est elle, désormais, qui se retire quand un autre
      onglet est allumé. Ce qu'elle tient — la grille, l'arbre, le tableau —
      vit de toute façon dans `App`, et lui survit. */
  /* **Et elle se retire quand la retouche s'ouvre** — corrigé le 31 août
      2026. Elle restait montée sous la table de retouche : invisible, mais
      vivante. Mesuré au navigateur — 152 commandes atteignables à la
      Tabulation, dont 83 hors de l'écran, appartenant toutes à la grille du
      dessous, « Supprimer la sélection » comprise : on la traversait à
      l'aveugle. Et les 54 px dont la page débordait faisaient reparaître sa
      barre tout en bas de la table, ce que la règle « un panneau est borné
      par l'écran, jamais par son contenu » interdit. La retirer répare les
      deux d'un coup, et elle ne perd rien en partant : ce qu'elle tient vit
      dans `App`, pas dans son montage. */

  return (
      <main
        className="grid min-h-0"
        onTransitionEnd={mesurerCentre}
        style={{
          gridTemplateColumns: colonnes,
          transition: "grid-template-columns 160ms ease-in-out",
        }}
      >
        <div className="flex min-h-0 overflow-hidden">
          <Arbre
            bibliotheque={bibliotheque}
            collection={filtre.collection}
            onCollection={(collection) => setFiltre((f) => ({ ...f, collection }))}
            onErreur={setPanne}
            onRelancer={relancer}
          />
        </div>


        {/* `min-w-0` **et** `min-h-0` : une piste de grille en `minmax(0,1fr)`
            n'empêche pas son contenu de l'élargir — c'est l'élément posé dedans
            qui vaut `min-width: auto`, donc la largeur de ce qu'il contient. Une
            barre d'outils trop pleine faisait alors glisser la page entière sur
            la droite, en-tête et pied compris. Constaté au navigateur le 27 août
            2026, à la première sélection. */}
        <section ref={centre} className="flex min-h-0 min-w-0 flex-col">
          <BarreOutils
            recherche={filtre.recherche}
            onRecherche={(recherche) => setFiltre((f) => ({ ...f, recherche }))}
            favoris={filtre.favoris}
            onFavoris={(favoris) => setFiltre((f) => ({ ...f, favoris }))}
            famille={famille}
            onFamille={setFamille}
            collection={filtre.collection}
            collections={bibliotheque.collections}
            projets={bibliotheque.projets}
            selection={selection}
            onRanger={ranger}
            onFavori={(favori) => void marquerFavori(selection, favori)}
            onSupprimer={() => void supprimer(selection)}
            onVider={() => setSelection([])}
            entree={entree}
            onExporter={() => void exporter()}
            exportEnCours={exportEnCours}
            annulation={annulation}
            onAnnuler={annuler}
            compte={grille.length}
            zoom={zoom}
            onZoom={setZoom}
            zoomsIndisponibles={indisponibles}
            zoomRendu={zoomRendu}
          />
          {/* Ce qui n'est pas entré — un refus qui nomme le fichier, un doublon
              qui propose. **Au-dessus de la grille et non dans la barre d'état** :
              un import refusé ne doit pas griser Générer, et la barre d'état est
              le seul endroit du produit qui le ferait. */}
          <CeQuiNEstPasEntre
            etat={entree}
            onOuvrir={(identifiant) => setSelection([identifiant])}
          />
          {/* **L'écran du choix prend la place de la grille** (R6), il ne se
              pose pas dessus : c'est la profondeur suivante du même endroit,
              exactement comme un outil dans l'établi. Le pied de la galerie
              reste sous lui, et sa phrase est plus vraie que jamais — écarter
              un sujet ne rappelle personne. */}
          {/* **Et le montage prend la même place** (A10), pour la même raison
              exactement : découper un clip est la profondeur suivante de la
              galerie, on y entre depuis la tuile du clip, et rien n'y dépense.
              Il passe avant le choix d'une planche parce que les deux ne
              peuvent pas être ouverts ensemble — on n'ouvre pas un montage
              depuis un écran de choix. */}
          {montageOuvert ? (
            <EcranMontage
              clip={montageOuvert}
              onFermer={() => setMontageOuvert(null)}
              onErreur={(raison) => setPanne(raison)}
            />
          ) : plancheAChoisir ? (
            <EcranDepliage
              generation={plancheAChoisir.generation}
              rang={plancheAChoisir.rang}
              onFini={(rendue) => {
                setDepliage(null)
                setChantier((liste) => fondre(liste, rendue))
              }}
              onFermer={() => setDepliage(null)}
              onErreur={echouer}
            />
          ) : (
          <Grille
            entrees={entrees}
            selection={selection}
            filtre={filtre}
            zoom={zoomRendu}
            entree={entree}
            onRelancer={relancer}
            onChoisir={(generation, rang) => setDepliage({ generation, rang })}
            onOuvrir={ouvrir}
            onRetirerFiltre={() => setFiltre(FILTRE_VIDE)}
            onGarderLeClip={garderLeClip}
            onDecouperLeClip={setMontageOuvert}
            onOuvrirLeClip={setFicheClip}
          />
          )}

          {/* **La grille dit quand elle est coupée** (B3). Elle s'arrêtait à
              200 images sans le dire, et l'auteur croyait avoir tout vu — une
              liste tronquée qui ne le dit pas ment en silence (`docs/DESIGN.md`
              § Les six règles, 6). Absent tant que tout ce qui répond au
              filtre est déjà montré. */}
          {totalGrille !== null && grille.length < totalGrille && (
            <p className="mesure flex h-[26px] shrink-0 items-center gap-1.5 border-t border-bord px-4 text-[10px] text-texte-3">
              <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
              {`${grille.length} montrées sur ${totalGrille}`}
              <button
                type="button"
                onClick={chargerLaSuiteGrille}
                className="mesure ml-auto text-[10px] text-signal-froid hover:text-signal-froid-clair"
              >
                Charger la suite ›
              </button>
            </p>
          )}

          {/* **Le pied de la galerie dit qu'aucun appel ne part d'ici** (E4).
              De quoi savoir d'un coup d'œil dans quelle moitié du produit on se
              trouve : ici on juge et on range, on ne paie jamais. La phrase
              tient la place de la barre qui paie, et c'est son absence qui est
              le message — la même règle que la barre d'état d'une table. */}
          <p className="mesure flex h-[26px] shrink-0 items-center gap-1.5 border-t border-bord px-4 text-[10px] text-texte-3">
            <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
            aucun appel ne part d'ici — on paie depuis le codex et depuis
            l'établi d'une chose du jeu
          </p>
        </section>

        <div className="flex min-h-0 overflow-hidden">
          {ouverte && etat && (
            <Fiche
              asset={ouverte}
              univers={univers}
              plan={plan}
              personnages={personnages}
              onFermer={() => setSelection([])}
              onErreur={setPanne}
              onReinjecter={(role) => reinjecter(ouverte.identifiant, role)}
              onReglages={() => void reprendreReglages(ouverte)}
              onSupprimer={() => void supprimer([ouverte.identifiant])}
              // **Les deux portes** (E4). L'établi de la chose à qui l'image
              // appartient — un onglet plus loin, à la profondeur de la
              // chose —, et la retouche, qui s'ouvre sur n'importe quelle
              // image sans quitter la galerie.
              /* ⚠️ **Le lieu d'abord, la profondeur ensuite** — depuis `B0`.
                 Poser une racine repose la pile, donc efface ce qui était
                 au-dessus : descendre puis changer de lieu perdait la
                 descente. Avec douze états indépendants l'ordre ne comptait
                 pas ; avec une pile il compte, et c'est le bon sens de
                 lecture — on va quelque part, puis on y descend. */
              onOuvrirLEtabli={() => {
                if (!ouverte.personnage) return
                poserLaRacine("codex")
                setChoseOuverte(ouverte.personnage)
                ouvrirLaRetouche(ouverte.identifiant)
              }}
              // **La porte de la galerie mène à la retouche** (`B25`), et sans
              // quitter la galerie : c'est la seule des six qui serve des images
              // n'appartenant à aucune chose du jeu, et l'écran sait les ouvrir
              // depuis cette tranche.
              onRetoucher={() => ouvrirLaRetouche(ouverte.identifiant)}
              onOuvrir={(identifiant) => setSelection([identifiant])}
            />
          )}
          {clipEnFiche && (
            <FicheDuClip
              generation={clipEnFiche.generation}
              plan={plan}
              personnages={personnages}
              depart={
                grille.find(
                  (a) =>
                    a.identifiant === (clipEnFiche.generation.clip?.depart ?? ""),
                ) ?? null
              }
              onFermer={() => setFicheClip(null)}
              /* **Découper se prend d'ici comme de la tuile** (V3.02), et il
                 referme la fiche : le montage prend la place de la grille, et
                 deux lecteurs du même clip ne luttent pas pour l'œil. */
              onDecouper={() => {
                setFicheClip(null)
                setMontageOuvert(clipEnFiche.generation.identifiant)
              }}
              /* **Une bande du clip s'ouvre dans l'atelier d'une animation**
                 (A7). C'est un autre onglet : la matrice vit au codex, et seul
                 `App` sait qu'il existe des onglets — comme le passage inverse,
                 qu'`A12` tient déjà. */
              onOuvrirLaBande={(identifiant) => {
                setFicheClip(null)
                poserLaRacine("codex")
                ouvrirLAtelierDeBande(identifiant)
              }}
              /* Le sprite de départ s'ouvre comme une image, **et sa fiche
                 remplace celle du clip** : la colonne est une porte, jamais
                 deux panneaux empilés sur la même question. */
              onOuvrir={(identifiant) => {
                setFicheClip(null)
                setSelection([identifiant])
              }}
            />
          )}
        </div>
      </main>
  )
}
