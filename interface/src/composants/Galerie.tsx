// La galerie — la grille du jeu, son arbre, sa barre d'outils, sa fiche.
//
// **Elle était écrite en clair dans `App.tsx`** jusqu'à `C4` : la grille, la
// cible, les réinjections et la barre d'état y tenaient quatre cents lignes au
// milieu de six mille, et le carnet renvoyait vers elles sans qu'aucun fichier
// ne porte son nom. Elle est désormais un écran comme les vingt et un autres du
// carnet — un fichier, une planche (`docs/archive/pistes-2026-09-04/carnet/Galerie.dc.html`).
//
// **Et elle est dessinée sur cette planche depuis `D3`** (11 septembre 2026).
// `C4` l'avait sortie d'`App.tsx` sans y toucher : elle est passée au papier ce
// jour-là, avec `Tuile.tsx`, `Fiche.tsx` et `BarreEtat.tsx` — sa grille, sa
// cible, ses réinjections et son pied. Deux nombres de la géométrie d'avant
// tombent avec eux : la marge de la surface passe de 16 à **30** et la gouttière
// de 9 à **14**, les deux valeurs que `docs/DESIGN.md` § Spacing déclare.
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
  vueRestreint,
  JUGEMENTS,
  ROLES_DE_GALERIE,
  TRIS_DE_GALERIE,
  VUE_PAR_DEFAUT,
  type Asset,
  type Bibliotheque,
  type Etat,
  type Filtre,
  type Generation,
  type GroupeDeGalerie,
  type VueDeLaGalerie,
  type Personnage,
  type Univers,
  type Pose,
  type Reinjection,
  type Role,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { FenetreAssembler, raisonAssemblage } from "./AssemblerAnimation"
import { CRANS, ZOOMS, type Zoom } from "./pieces"
import { useImport, type Import } from "./Import"
import { Tuile, type Entree } from "./Tuile"
import { BarreOutils } from "./BarreOutils"
import { CeQuiNEstPasEntre } from "./Import"
import { EcranDepliage } from "./Depliage"
import { EcranMontage } from "./Montage"
import { Fiche } from "./Fiche"
import { FicheDuClip } from "./FicheDuClip"
import { GalerieMedias } from "./GalerieMedias"
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
  presentation = "barre",
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
  /** Où la bande est posée. **Les deux gestes sont les mêmes des deux côtés** —
   *  seul le cadre change : un liseré collé sous les réglages dans la barre, un
   *  bloc de la grille du guichet dans l'écran *Préparer une image*, qui compte
   *  ses marges en 14 et ses coins en `rounded-7`. Deux composants auraient fini
   *  par n'avoir plus les mêmes libellés, donc plus le même geste. */
  presentation?: "barre" | "preparation"
}) {
  if (!personnage || poses.length === 0) return null
  const lot = poses.length >= 2
  return (
    <div
      className={
        presentation === "preparation"
          ? "flex flex-wrap items-center gap-[8px] rounded-7 border border-trait bg-carte p-[14px]"
          : "flex flex-wrap items-center gap-2 border-b border-trait bg-carte px-4 pt-3"
      }
    >
      <span className="mesure text-[10.5px] tracking-[.14em] text-encre-4 uppercase">
        Pour
      </span>
      <span className="flex flex-wrap items-center gap-1.5 rounded-5 border border-signal bg-ligne-ouverte py-1 pr-1 pl-2">
        <span className="text-[11.5px] text-encre">{personnage.nom}</span>
        {poses.map((pose) => (
          <span key={pose.identifiant} className="flex items-center">
            <span className="mesure text-[10.5px] text-signal">{pose.nom}</span>
            <button
              type="button"
              onClick={() => onRetirer(pose)}
              aria-label={`Retirer ${pose.nom} de ce qui part`}
              className="mesure px-1 text-[10.5px] text-encre-4 hover:text-echec"
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
        <span className="mesure text-[10.5px] text-encre-4">
          {poses.length} attitudes, un seul appel
        </span>
      )}
      {lot && (
        <button
          type="button"
          onClick={onDesarmer}
          aria-label="Ne plus viser ces cases"
          className="mesure ml-auto px-1 text-[10.5px] text-encre-4 hover:text-echec"
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
    <div className="flex items-center gap-2 border-b border-trait bg-carte px-4 pt-3">
      <span className="mesure text-[10.5px] tracking-[.14em] text-encre-4 uppercase">
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
      className="flex items-center gap-1.5 rounded-5 border border-contour bg-carte py-1 pr-1 pl-1"
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
          className="damier-papier h-6 w-6 rounded-5 object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      )}
      <select
        aria-label="Rôle de la réinjection"
        value={role}
        onChange={(e) => onRole(asset, e.target.value as Role)}
        className="mesure bg-transparent text-[10.5px] text-encre-2"
      >
        <option value="reference">référence</option>
        <option value="edition">source d'édition</option>
        <option value="style">guide de style</option>
      </select>
      <button
        type="button"
        onClick={() => onRetirer(asset)}
        aria-label="Retirer la réinjection"
        className="mesure px-1 text-[10.5px] text-encre-4 hover:text-echec"
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
  groupes,
  vueRestreinte = false,
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
  /** Les groupes que le serveur a formés (RP11), ou rien si l'on ne regroupe
   *  pas. Replié, un groupe montre son origine et **compte ce qu'il montre** :
   *  ses dérivés sont dans la page, et il ne prétend jamais à un total qu'il
   *  n'a pas compté. */
  groupes?: GroupeDeGalerie[]
  /** Un des deux filtres de la vue écarte-t-il des images ? Il compte comme un
   *  filtre pour l'état vide : sans lui, un rôle sans résultat rendrait « Rien
   *  n'est encore sorti d'ici. Écris. » sur une bibliothèque pleine. */
  vueRestreinte?: boolean
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
  // **Les groupes se déplient un par un, et l'écran est seul à le savoir.**
  // Déplier ne redemande rien au serveur : les dérivés sont déjà dans la page,
  // c'est tout l'intérêt d'avoir groupé côté serveur — le pli est une affaire
  // de place à l'écran, pas de données.
  const [deplies, setDeplies] = useState<string[]>([])
  const derivesDe = useMemo(() => {
    const table = new Map<string, string[]>()
    for (const groupe of groupes ?? []) table.set(groupe.origine, groupe.derives)
    return table
  }, [groupes])
  const replies = useMemo(() => {
    if (!groupes) return new Set<string>()
    const caches = new Set<string>()
    for (const groupe of groupes)
      if (!deplies.includes(groupe.origine))
        for (const derive of groupe.derives) caches.add(derive)
    return caches
  }, [groupes, deplies])
  const montrees = groupes ? entrees.filter((e) => !replies.has(e.cle)) : entrees

  // **Deux états vides, et ce ne sont pas les mêmes** (US-34, US-35). Une
  // bibliothèque vide invite à écrire ; un filtre sans résultat est une impasse,
  // et une impasse doit porter le geste qui en sort — sinon la grille est muette
  // au moment précis où elle devrait aider.
  if (entrees.length === 0) {
    return filtreActif(filtre) || vueRestreinte ? (
      <div
        {...depot.props}
        {...NOMMEE}
        className={`flex flex-1 flex-col items-center justify-center gap-3 px-[30px] py-[22px] ${cadreDepot(depot.survole)}`}
      >
        <p className="max-w-[380px] text-center font-serif text-[25px] leading-tight text-encre-3">
          Rien ne répond à ce filtre.
        </p>
        <button
          type="button"
          onClick={onRetirerFiltre}
          className="mesure text-[11px] text-signal hover:opacity-70"
        >
          Retirer le filtre ›
        </button>
      </div>
    ) : (
      <div
        {...depot.props}
        {...NOMMEE}
        className={`flex flex-1 items-center justify-center px-[30px] py-[22px] ${cadreDepot(depot.survole)}`}
      >
        <p className="max-w-[380px] text-center font-serif text-[25px] leading-tight text-encre-3">
          Rien n'est encore sorti d'ici. <em className="text-encre">Écris.</em>
        </p>
      </div>
    )
  }

  return (
    <div
      {...depot.props}
      {...NOMMEE}
      className={`defile min-h-0 flex-1 overflow-y-auto px-[30px] py-[22px] ${cadreDepot(depot.survole)}`}
    >
      <div
        className="grid gap-[14px]"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${CRANS[zoom]}px, 1fr))`,
        }}
      >
        {montrees.map((entree) => (
          <CaseDeGrille
            key={entree.cle}
            derives={derivesDe.get(entree.cle)?.length ?? 0}
            deplie={deplies.includes(entree.cle)}
            onPlier={() =>
              setDeplies((ouverts) =>
                ouverts.includes(entree.cle)
                  ? ouverts.filter((c) => c !== entree.cle)
                  : [...ouverts, entree.cle],
              )
            }
          >
          <Tuile
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
          </CaseDeGrille>
        ))}
      </div>
    </div>
  )
}

/** Une case de la grille — la tuile, et le pli de son groupe quand elle en
 *  ouvre un (RP11).
 *
 *  **Le pli se pose sous la tuile, jamais dessus.** La grille est la seule
 *  surface du produit où l'on juge : un badge posé sur l'image cacherait ce
 *  qu'on est en train de regarder. La ligne fait la hauteur d'une mesure, dans
 *  la forme des autres fentes du produit — mono 10,5 px, `--signal` pour le
 *  geste — et elle n'existe que pour les cases qui ont quelque chose dessous.
 *
 *  **Le compte est celui de ce qui est montré**, pas un total réclamé au
 *  serveur : les dérivés sont dans la page, ils se comptent, et une grille qui
 *  annoncerait « 12 dérivés » en n'en tenant que 6 mentirait en silence. */
function CaseDeGrille({
  derives,
  deplie,
  onPlier,
  children,
}: {
  derives: number
  deplie: boolean
  onPlier: () => void
  children: React.ReactNode
}) {
  if (derives === 0) return <>{children}</>
  return (
    <div className="flex flex-col gap-1">
      {children}
      <button
        type="button"
        onClick={onPlier}
        aria-expanded={deplie}
        className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
      >
        {derives} dérivé{derives > 1 ? "s" : ""} {deplie ? "‹" : "›"}
      </button>
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
 *  rien — un `outline` ne prend pas de place dans la mise en page. **Le rouille
 *  du papier depuis `D3`**, et c'est le même trait que celui du dépôt sur la
 *  planche `Galerie.dc.html`.
 *
 *  Écrit une fois pour les trois états de la grille : pleine, filtrée à vide,
 *  et vide. Une bibliothèque vide est très exactement le moment où l'on fait
 *  entrer sa première image, et une surface qui n'accepterait le dépôt qu'une
 *  fois pleine serait fermée quand elle sert le plus. */
const cadreDepot = (survole: boolean) =>
  survole ? "outline outline-1 -outline-offset-1 outline-signal" : ""

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
//
// **Les deux valeurs déclarées, depuis `D3`** : 30 est la marge de la surface,
// 14 sa gouttière — les deux nombres que le § Spacing écrit noir sur blanc. Le
// châssis sombre y mettait 16 et 9, qui ne sont dans aucune des listes fermées ;
// la planche `Galerie.dc.html` dessine 24/30 de marge et 9 de gouttière, et
// c'est la valeur déclarée qui l'emporte quand les deux disent presque la même
// chose. Ils doivent rester d'accord avec les classes de la grille juste
// au-dessus : c'est cette égalité-là qui rend vrai le grisé du zoom.
const PADDING = 30
const GOUTTIERE = 14

// **Le plafond de la grille** (B3), identique à `PAR_DEFAUT` côté serveur
// (`atelier/services/bibliotheque.py`). « Charger la suite » ne fait que le
// faire monter : la même requête, plus large, jamais un second appel qui
// s'additionnerait à la première page.
const TAILLE_PAGE_GRILLE = 200

// **Là où la galerie garde sa façon de regarder** (RP11). Même préfixe que le
// brouillon local, même numéro de version dans la clé : une forme qui change
// n'écrase pas ce que l'ancienne avait écrit, elle repart du défaut.
const VUE_GARDEE = "asset-kitchen:galerie:v1"

/** Ce que la galerie avait choisi la dernière fois — le tri, les deux filtres
 *  et le regroupement.
 *
 *  **Chaque valeur est relue contre sa liste fermée**, jamais reprise telle
 *  quelle : ce qui est écrit là vient du disque d'un navigateur, et une valeur
 *  d'une version d'avant enverrait un `tri=` que la route ne connaît pas. Le
 *  serveur retomberait sur son défaut sans rien dire, et le contrôle à l'écran
 *  afficherait autre chose que ce que la grille montre. */
function vueGardee(): VueDeLaGalerie {
  try {
    const garde = JSON.parse(localStorage.getItem(VUE_GARDEE) ?? "{}")
    return {
      tri: TRIS_DE_GALERIE.includes(garde.tri) ? garde.tri : VUE_PAR_DEFAUT.tri,
      role: ROLES_DE_GALERIE.includes(garde.role) ? garde.role : VUE_PAR_DEFAUT.role,
      jugement: JUGEMENTS.includes(garde.jugement)
        ? garde.jugement
        : VUE_PAR_DEFAUT.jugement,
      groupe: garde.groupe === true,
    }
  } catch {
    return VUE_PAR_DEFAUT
  }
}

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

  /** Les groupes que le serveur a formés, ou rien tant qu'on ne regroupe pas
   *  (RP11). Ils arrivent avec la grille et dans son ordre. */
  const [groupes, setGroupes] = useState<GroupeDeGalerie[] | undefined>(undefined)

  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE)
  /** Le tri, les deux filtres et le regroupement — **retrouvés à
   *  l'ouverture** (RP11). C'est un critère de la tranche : on revient dans la
   *  galerie comme on l'a laissée. Le filtre et la recherche, eux, ne se
   *  gardent pas : ils répondent à une question du moment, pas à une façon de
   *  regarder. */
  const [vue, setVue] = useState<VueDeLaGalerie>(vueGardee)
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
  // change de taille, et quand la transition de 220 ms sur les colonnes s'achève
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
  // La déduire tient aussi la promesse de `docs/DESIGN.md` : le liseré rouille
  // d'une tuile dit « sélectionné », et il n'a plus qu'un seul sens.
  const fiche = selection.length === 1 ? selection[0] : null

  // ── La grille ─────────────────────────────────────────────────────────────
  //
  // Elle se redemande quand le filtre change, et **seulement** alors. Le
  // filtrage vit côté serveur : le rejouer ici sur les deux cents assets que cet
  // onglet a en mémoire ferait dire à la recherche autre chose qu'à la
  // bibliothèque, et c'est exactement la divergence relevée chez SpriteCook.

  const relireGrille = useCallback(async () => {
    try {
      const { assets, total, groupes } = await api.assets({
        ...filtre,
        ...vue,
        sansProjet: bibliotheque.courant === null,
        limite: limiteGrille,
      })
      setGrille(assets)
      setTotalGrille(total)
      setGroupes(groupes)
    } catch (erreur) {
      echouer(erreur, "la bibliothèque ne répond pas")
    }
  }, [filtre, vue, bibliotheque.courant, limiteGrille])

  useEffect(() => {
    void relireGrille()
  }, [relireGrille])

  // **Ce qu'on a choisi de la grille se retrouve après fermeture** (RP11), et
  // seulement ça : un tri, deux filtres, un regroupement. Le `try` est celui du
  // brouillon local — un navigateur peut refuser d'écrire, et une galerie qui
  // ne s'ouvre pas pour ça serait un prix absurde.
  useEffect(() => {
    try {
      localStorage.setItem(VUE_GARDEE, JSON.stringify(vue))
    } catch {
      /* rien à faire : la vue vaudra le défaut à la prochaine ouverture */
    }
  }, [vue])

  // **Changer de filtre repart de la première page** (B3) : sans ça, une
  // recherche neuve hériterait du plafond agrandi par « Charger la suite »
  // sur la recherche précédente, et montrerait quatre cents images d'un
  // sujet qui n'en a que huit. **Changer de tri aussi**, et pour la même
  // raison : c'est une autre page, pas la même agrandie.
  useEffect(() => {
    setLimiteGrille(TAILLE_PAGE_GRILLE)
  }, [filtre, vue, bibliotheque.courant])

  const chargerLaSuiteGrille = () =>
    setLimiteGrille((limite) => limite + TAILLE_PAGE_GRILLE)

  // ── Ce que la grille montre ───────────────────────────────────────────────

  // **Le filtre « clips »** (B22) : distinct des familles, parce qu'un clip
  // n'en a aucune — le rejouer aux mêmes places que « personnages » ou
  // « décors » ferait passer pour une famille ce qui n'en est pas une.
  const clipsSeuls = famille === "clips"

  const entrees = useMemo<Entree[]>(() => {
    // **Ce qui n'est pas encore une image, puis les images dans l'ordre du
    // serveur** (RP11). Avant la tranche, tout était re-trié ici par date : ça
    // revenait au même tant que la route n'avait qu'un ordre, et ça défaisait
    // le tri et le regroupement dès qu'elle en a eu quatre. Le chantier et les
    // clips restent en tête — ils viennent d'arriver, ils sont par définition
    // les plus récents, et le serveur ne les connaît pas.
    const enCours = new Map<string, Entree>()
    const parCle = new Map<string, Entree>()
    // **Les deux filtres de la vue écartent le chantier comme le filtre le
    // fait** (RP11) : c'est ce que le bouton *Favoris* faisait avant d'être
    // mangé par le jugement, et la raison n'a pas changé — un lot qui n'est pas
    // encore arrivé n'a ni rôle ni jugement. Le tri et le regroupement, eux, ne
    // retirent rien : ils rangent.
    if (!filtreActif(filtre) && !vueRestreint(vue)) {
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
          enCours.set(cle, {
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
          enCours.set(cle, {
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
    // **Un asset remplace l'emplacement qui l'attendait** : à la même clé, et
    // il passe alors dans le bloc des images — l'attente est finie, elle n'a
    // plus à tenir la tête de la grille.
    const attendent = [...enCours.values()]
      .filter((e) => !parCle.has(e.cle))
      .sort((a, b) => b.date - a.date || a.rang - b.rang)
    return [...attendent, ...parCle.values()]
  }, [chantier, clipsDuJeu, grille, filtre, vue, famille, clipsSeuls, bibliotheque.courant])

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
                className="underline underline-offset-2 hover:text-encre"
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

  /** Poser un asset déjà produit sur la toile de l'univers, tel quel — **sans
   *  nouvelle fabrication** (US-540). La route existe déjà côté serveur
   *  (`api.poserAssetSurToile`, déjà branchée depuis l'écran Fabrications) ;
   *  la galerie l'emploie pour la même chose, sur une fiche d'asset. */
  const poserSurLaToile = async (asset: string) => {
    if (!bibliotheque.courant) return
    try {
      const { deja_presente } = await api.poserAssetSurToile(bibliotheque.courant, asset)
      setFente({
        ton: "ok",
        texte: deja_presente ? "Déjà posée sur la toile." : "Posée sur la toile.",
      })
    } catch (erreur) {
      echouer(erreur, "l'image n'a pas pu être posée sur la toile")
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

  // La navigation de projets est globale depuis l'atelier unifié. La garder ici
  // aurait laissé deux arbres pour le même jeu, dont un décalé de l'autre. Le
  // rangement demeure dans la barre de sélection, au moment où une sélection
  // existe réellement.
  const colonnes = [
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
    clips: clipsDuJeu,
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
    groupes,
    indisponibles,
    marquerFavori,
    mesurerCentre,
    ouverte,
    ouvrir,
    plancheAChoisir,
    poserSurLaToile,
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
    setVue,
    setZoom,
    supprimer,
    totalGrille,
    vue,
    zoom,
    zoomRendu,
    centre,
    ficheClip,
  }
}

// ── `C4` · l'écran de la galerie ────────────────────────────────────────────
//
// Trois colonnes : où ça se range, la grille, la fiche d'une image — la planche
// `docs/archive/pistes-2026-09-04/carnet/Galerie.dc.html`. Elle était écrite en clair
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
  onSon,
  onSource3D,
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
  /** Portes optionnelles vers les ateliers ajoutés après la galerie historique. */
  onSon?: (identifiant: string) => void
  onSource3D?: (source: import("../api-3d").Source3D) => void
}) {
  const {
    annulation,
    annuler,
    centre,
    chargerLaSuiteGrille,
    clipEnFiche,
    clips,
    colonnes,
    entree,
    entrees,
    exportEnCours,
    exporter,
    famille,
    filtre,
    garderLeClip,
    grille,
    groupes,
    indisponibles,
    marquerFavori,
    mesurerCentre,
    ouverte,
    ouvrir,
    plancheAChoisir,
    poserSurLaToile,
    ranger,
    relancer,
    selection,
    setDepliage,
    setFamille,
    setFicheClip,
    setFiltre,
    setSelection,
    setVue,
    setZoom,
    supprimer,
    totalGrille,
    vue,
    zoom,
    zoomRendu,
  } = g

  const changerDeMedia = useCallback(() => setSelection([]), [setSelection])

  // ── En faire une animation (`RP21`, chemin 2) ─────────────────────────────
  //
  // **La sélection existe déjà** (US-31) : ce geste en est un troisième
  // usage, à côté de ranger et exporter. Rien de neuf n'est inventé sur la
  // grille elle-même.
  const imagesSelectionnees = selection
    .map((identifiant) => grille.find((a) => a.identifiant === identifiant))
    .filter((a): a is Asset => a != null)
  const raisonAnimer = raisonAssemblage(imagesSelectionnees, selection.length)
  const [assemblerOuvert, setAssemblerOuvert] = useState(false)

  /* Quatre colonnes, largeurs absolues, et 220 ms sur la largeur quand
      l'une se replie ou que la fiche s'ouvre — la durée du § Motion pour
      « un volet entre ou sort », depuis `D3` : 160 ms n'était dans aucune
      des quatre. Les panneaux restent montés : replier n'est pas fermer, et
      retrouver un panneau où on l'avait laissé fait partie de ce que le
      mouvement promet.

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
        /* **Le papier commence ici** (`D3`). La galerie est posée dans une case
           d'`App.tsx` qui porte encore le fond de l'ancien châssis ; elle peint
           donc sa propre surface plutôt que d'attendre que `D6` fasse tomber
           celui du dessous — sans quoi la grille du carnet flotterait sur du
           presque-noir. */
        className="grid min-h-0 bg-papier"
        onTransitionEnd={mesurerCentre}
        style={{
          gridTemplateColumns: colonnes,
          transition: "grid-template-columns 220ms var(--ease-entree)",
        }}
      >
        {/* `min-w-0` **et** `min-h-0` : une piste de grille en `minmax(0,1fr)`
            n'empêche pas son contenu de l'élargir — c'est l'élément posé dedans
            qui vaut `min-width: auto`, donc la largeur de ce qu'il contient. Une
            barre d'outils trop pleine faisait alors glisser la page entière sur
            la droite, en-tête et pied compris. Constaté au navigateur le 27 août
            2026, à la première sélection. */}
        <section ref={centre} className="flex min-h-0 min-w-0 flex-col">
          <GalerieMedias
            filtre={filtre}
            onRecherche={(recherche) => setFiltre((f) => ({ ...f, recherche }))}
            entrees={entrees}
            clips={clips}
            /* Voir `clipsVivants` : les deux listes se rejoignent là-bas. */
            projet={bibliotheque.courant}
            onChanger={changerDeMedia}
            onBande={ouvrirLAtelierDeBande}
            onSon={onSon}
            onSource3D={onSource3D}
          >
          {(sorte, videos) => <>
          <BarreOutils
            recherche={filtre.recherche}
            onRecherche={(recherche) => setFiltre((f) => ({ ...f, recherche }))}
            sansRecherche
            tri={vue.tri}
            onTri={(tri) => setVue((v) => ({ ...v, tri }))}
            role={vue.role}
            onRole={(role) => setVue((v) => ({ ...v, role }))}
            jugement={vue.jugement}
            onJugement={(jugement) => setVue((v) => ({ ...v, jugement }))}
            groupe={vue.groupe}
            onGroupe={(groupe) => setVue((v) => ({ ...v, groupe }))}
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
            onAnimer={() => setAssemblerOuvert(true)}
            raisonAnimer={raisonAnimer}
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
              personnages={personnages}
              onBande={ouvrirLAtelierDeBande}
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
            entrees={
              sorte === "videos"
                ? videos
                : // **`!clip` et non `clip === null`** : le champ est déclaré
                  // facultatif (`Generation.clip?`), le serveur l'écrit à
                  // `null` mais rien n'oblige un producteur d'événement à le
                  // faire — et un champ absent faisait alors disparaître de
                  // l'onglet Images *toutes* les générations, pas seulement les
                  // clips : l'emplacement en cours, l'échec qui porte sa
                  // raison, la planche qui attend un regard.
                  entrees.filter((entree) => entree.sorte === "asset" || !entree.generation.clip)
            }
            selection={selection}
            filtre={filtre}
            zoom={zoomRendu}
            entree={entree}
            /* **Les groupes ne valent que pour l'onglet des images** : les
               vidéos sont des clips, pas des images de la bibliothèque, et
               aucune filiation ne les relie. */
            groupes={sorte === "videos" ? undefined : groupes}
            vueRestreinte={vueRestreint(vue)}
            onRelancer={relancer}
            onChoisir={(generation, rang) => setDepliage({ generation, rang })}
            onOuvrir={ouvrir}
            /* **Tout ce qui écarte s'en va d'un geste** : le filtre *et* les
               deux de la vue. Ne rendre que le premier laisserait l'impasse
               ouverte, et le bouton qui promet d'en sortir n'en sortirait
               pas. Le tri et le regroupement restent : ils n'y sont pour
               rien. */
            onRetirerFiltre={() => {
              setFiltre(FILTRE_VIDE)
              setVue((v) => ({ ...v, role: "tous", jugement: "tous" }))
            }}
            onGarderLeClip={garderLeClip}
            onDecouperLeClip={setMontageOuvert}
            onOuvrirLeClip={setFicheClip}
          />
          )}

          {/* **Un seul pied, deux faits, et c'est le dessin de la planche**
              (`D3`, `Galerie.dc.html`) : à gauche ce que la grille montre et ce
              qu'elle cache, à droite le rappel qu'on ne paie pas ici. Le châssis
              sombre en faisait deux bandes de 26 px empilées, chacune avec son
              trait — deux traits pour un seul pied, quand « le trait sépare des
              panneaux, pas des lignes » (`docs/DESIGN.md` § Les traits).

              À gauche, **la grille dit quand elle est coupée** (B3). Elle
              s'arrêtait à 200 images sans le dire, et l'auteur croyait avoir
              tout vu — une liste tronquée qui ne le dit pas ment en silence
              (§ Les six règles, 6). Absent tant que tout ce qui répond au filtre
              est déjà montré, et la moitié droite reste alors seule.

              À droite, **le pied dit qu'aucun appel ne part d'ici** (E4). De
              quoi savoir d'un coup d'œil dans quelle moitié du produit on se
              trouve : ici on juge et on range, on ne paie jamais. La phrase
              tient la place de la barre qui paie, et c'est son absence qui est
              le message. */}
          <div className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait px-[30px] py-[14px] text-[12.5px] text-encre-3">
            {totalGrille !== null && grille.length < totalGrille ? (
              <span className="mesure flex items-center gap-2 text-[11px] text-encre-4">
                {`${grille.length} montrées sur ${totalGrille}`}
                <button
                  type="button"
                  onClick={chargerLaSuiteGrille}
                  className="mesure text-[11px] text-signal hover:opacity-70"
                >
                  Charger la suite ›
                </button>
              </span>
            ) : (
              <span />
            )}
            <span className="text-right">
              aucun appel ne part d'ici — on paie depuis le codex et depuis
              l'établi d'une chose du jeu
            </span>
          </div>
          </>}
          </GalerieMedias>
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
              onPoserSurLaToile={
                bibliotheque.courant
                  ? () => void poserSurLaToile(ouverte.identifiant)
                  : undefined
              }
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
              /* La bande garde son chemin d'arrivée pour revenir au clip. */
              onOuvrirLaBande={(identifiant) => {
                setFicheClip(null)
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
          {assemblerOuvert && (
            <FenetreAssembler
              images={imagesSelectionnees}
              personnages={personnages}
              plan={plan}
              onFermer={() => setAssemblerOuvert(false)}
              onFait={(bandes) => {
                setAssemblerOuvert(false)
                setSelection([])
                if (bandes.length > 0) ouvrirLAtelierDeBande(bandes[0].identifiant)
              }}
            />
          )}
        </div>
      </main>
  )
}
