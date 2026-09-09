// L'écran Personnages — qui il y a dans ce jeu, ce que chacun réclame, et ce
// qui manque.
//
// « Savoir d'un coup d'œil ce qui est fait et ce qui ne l'est pas, afin de
// savoir quoi lancer sans tenir la liste dans ma tête » (US-119). C'est la
// contrepartie de l'Atelier, une fois de plus : l'Atelier fabrique une image,
// celui-ci dit **combien il en manque**.
//
// **Deux colonnes, `380px · 1fr`** — les personnages et le plan à gauche, les
// cases à droite (`docs/DESIGN.md` § Layout). Aucune largeur nouvelle : la 380
// est celle de la fiche asset et de l'écran Univers, réemployée pour ce qu'elle
// nomme déjà, la colonne de ce qu'on manipule.
//
// **Ce n'est pas une grille d'assets, et c'est ce qui préserve l'invariant** :
// ni recherche, ni filtres, ni sélection multiple (`docs/archive/plan-versions-tenues.md` C1). La
// réserve de T8 avait tenu la même règle par le même moyen — une privation
// assumée, pas un manque à combler.
//
// **C2 y ajoute une case à cocher, et elle ne rompt pas cet invariant** — ce qui
// se coche est une **attitude**, c'est-à-dire une ligne du plan du jeu, jamais
// une image. On ne sélectionne toujours aucun asset ici : les vignettes d'une
// case ne se cochent pas, ne se glissent pas, ne se comptent pas. La différence
// n'est pas un détail de vocabulaire — c'est elle qui empêche cet écran de
// redevenir une seconde planche contact, et le jour où l'on cochera une image,
// l'invariant sera tombé.
//
// **C3 lui donne son second axe, et il ne devient pas une grille pour autant.**
// Les emplacements et les pièces se posent à gauche, sous les attitudes — deux
// listes qu'on écrit une fois, comme les deux autres. Et la matrice **se lit
// colonne par colonne** : un onglet par pièce, jamais un damier de vignettes.
// C'est le motif de C1 pris au mot — « on lit une colonne, on ne balaie pas une
// planche contact » — et c'est ce qui empêche l'écran de redevenir la seconde
// planche contact que la privation existe pour éviter.
//
// **Il couvre l'atelier, donc il porte sa propre fente de refus** : une raison
// envoyée derrière lui serait invisible au moment précis où elle compte.

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  api,
  CE_QU_ON_PREND,
  NOM_DE_CE_QU_ON_PREND,
  poserLeFichier,
  type AmbianceDuJeu,
  type Asset,
  type Bande,
  type Case,
  type CaseDirection,
  type EmplacementCorps,
  type Personnage,
  type Piece,
  type Portee,
  type Pose,
  type PorteeDeLaPiece,
  type PosesDesTypes,
  type Sortie as SortieAuJeu,
  type Vestiaire,
} from "../api"
import type { Fente } from "./BarreChassis"
import { BandeQuiTourne, sujetAsset, useVisee } from "./Apercu"
import { PanneauCalque } from "./Calque"
import { Bouton, Libelle, Segments, ZoneTexte } from "./chassis"
import { PANNEAU } from "./Infobulle"
import { FicheDeLaChose } from "./FicheChose"
import { EcranCalibrage } from "./Calibrage"
import { EcranPlanche } from "./Planche"
import { EcranVitrine } from "./Vitrine"

/** Ce qui remplit vraiment une case — **et ce n'est pas toujours le nombre
 *  d'images qu'elle porte** (E10).
 *
 *  Avec des directions, une image ne compte que si elle est rangée dans une
 *  direction que cette chose tient encore : sans ça, une image restée dans une
 *  direction rangée ferait afficher *quatre sur trois*. Sans direction
 *  déclarée, c'est la longueur de la liste, comme avant.
 *
 *  Écrit ici et lu des deux côtés — la matrice et le compte du codex —, parce
 *  que deux calculs auraient fini par donner deux chiffres pour la même case. */
export function faitesDeLaCase(case_: Case | undefined): number {
  if (!case_) return 0
  if (case_.directions.length + case_.directions_rangees.length > 1)
    return case_.directions.reduce((somme, a) => somme + a.images.length, 0)
  return case_.images.length
}

/** **Les deux calques de la matrice** (A12) : les images fixes, et les
 *  animations.
 *
 *  ⚠️ **Ils ne se mêlent pas, et c'est la décision de la tranche.** Une case qui
 *  porterait les deux serait « remplie » dès qu'elle a l'une des deux, et une
 *  animation manquante se cacherait derrière une image présente — très
 *  exactement ce que l'auteur veut voir. L'invariant *une case est prise dès
 *  qu'une image la porte* n'est pas tordu, il vaut **deux fois**, une fois par
 *  calque. */
export type CalqueDeLaMatrice = "images" | "animations"

/** Ce qui remplit le **calque animé** d'une case — le pendant exact de
 *  `faitesDeLaCase`, et écrit juste à côté d'elle pour la même raison : deux
 *  calculs auraient fini par donner deux chiffres pour la même case.
 *
 *  Le repli sur la première direction est déjà fait par le serveur : une bande
 *  gardée avant que le jeu ne déclare ses angles s'y range, et on ne la compte
 *  donc qu'une fois. */
export function animeesDeLaCase(case_: Case | undefined): number {
  if (!case_) return 0
  if (case_.directions.length + case_.directions_rangees.length > 1)
    return case_.directions.reduce((somme, a) => somme + a.bandes.length, 0)
  return case_.bandes.length
}

/** Combien d'animations une case demande — **une par direction, jamais autant
 *  que d'images**.
 *
 *  C'est là que les deux calques cessent de se ressembler : une marche demande
 *  huit images *par direction* pour être dessinée, et **une seule bande par
 *  direction** pour être animée — la bande porte déjà ses huit images dedans.
 *  Le serveur le calcule, cette fonction ne fait que le rendre lisible avec son
 *  repli pour les cases qu'il n'a pas encore composées. */
export const animeesDemandees = (case_: Case | undefined): number =>
  case_?.bandes_demandees ?? 1

/** Les poses qu'un personnage tient, dans l'ordre du plan.
 *
 *  **Déduit, jamais reçu.** Le disque garde ce que le personnage *écarte* : une
 *  liste de tenues envoyée avec lui serait périmée dès la pose suivante ajoutée
 *  au plan, puisqu'un ajout n'écrit — et donc n'annonce — aucun personnage.
 *  C'est la même règle que les îlots du tableau, qui se lisent sur les cartes.
 */
/** Les types d'objet qui n'ont **aucune** attitude, et le savent (E9).
 *
 *  Écrit ici pour une seule phrase — celle qui remplace la rangée de poses
 *  d'une tuile. Le serveur, lui, ne lui envoie simplement aucune pose : l'écran
 *  n'a pas à rejouer la règle, seulement à dire pourquoi il n'y a rien plutôt
 *  que de laisser un vide passer pour un oubli. */
const SANS_ATTITUDES = ["décor", "tuile"]

export const posesTenues = (plan: Pose[], personnage: Personnage): Pose[] =>
  plan.filter((p) => !personnage.ecartees.includes(p.identifiant))

/** Les deux ordres d'une colonne de pièce (C4, US-152). */
export type Ordre = "attitude" | "pire"

/** Où une attitude se range quand on veut **attaquer par le pire** (US-152).
 *
 *  Trois groupes, et l'ordre des groupes est la moitié de la réponse : ce qui
 *  reste à regarder d'abord, ce dont on s'est déjà occupé ensuite, ce qui n'a
 *  rien à montrer en dernier. « Ce qui reste à regarder » n'est pas un drapeau
 *  posé quelque part — c'est un calque **sur lequel la main n'est pas encore
 *  passée**, et ça se lit dans sa recette, comme tout le reste de C3 et C4.
 *
 *  Dans le premier groupe, la mesure la plus défavorable décide, la pire en
 *  tête. Elle vient du serveur (`calque.gravite`) : un second barème écrit ici
 *  aurait donné deux classements sur les mêmes cinq nombres, et l'écran aurait
 *  fini par surligner une mesure et en trier une autre. */
const rang = (calque: Asset | undefined): [number, number] => {
  if (!calque?.calque) return [2, 0]
  if (calque.recette.difference === null) return [2, 0]
  const vu =
    calque.recette.difference.affinage.length > 0 ||
    calque.recette.difference.retouche.length > 0
  return [vu ? 1 : 0, calque.calque.gravite]
}

/** Les attitudes d'une colonne de pièce, dans l'ordre demandé.
 *
 *  **Le tri est stable sur l'ordre du plan** : deux calques de même gravité
 *  restent dans l'ordre où l'auteur a écrit ses attitudes, et la liste ne
 *  frémit pas quand une mesure bouge d'un millième.
 */
export function rangees(
  tenues: Pose[],
  cases: Record<string, Case>,
  piece: string,
  ordre: Ordre,
): Pose[] {
  if (ordre === "attitude") return tenues
  const clef = (pose: Pose) => rang(cases[pose.identifiant]?.calques[piece]?.[0])
  return tenues
    .map((pose, place) => ({ pose, place, rang: clef(pose) }))
    .sort(
      (a, b) =>
        a.rang[0] - b.rang[0] || b.rang[1] - a.rang[1] || a.place - b.place,
    )
    .map((entree) => entree.pose)
}

export function EcranEtabli({
  ouvert,
  plan,
  emplacements,
  pieces,
  onPersonnage,
  onArmer,
  onAnimer,
  dossierJeu,
  onFente,
  barreQuiPaie,
  onOuvrirCase,
  onMonterLaBande,
  onOuvrirLaBande,
  onSuperposition,
  onSupprimer,
}: {
  /** **Le vestiaire du projet** (C3) — l'autre axe de la même matrice. Tenu par
   *  `App` comme le plan, et pour la même raison : un seul endroit écoute le
   *  flux, pour toute la vie de l'onglet. */
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  /** Le plan du jeu, tenu par `App` — comme le tableau. **Un seul endroit
   *  écoute le flux**, pour toute la vie de l'onglet. */
  plan: Pose[]
  /** **Ce que l'appel vient de rendre, posé par le même chemin que le flux.**
   *  Les deux se croisent — le serveur annonce avant que l'appel ne revienne —,
   *  et c'est la fonte par identifiant qui les tient (`docs/PIEGES.md`).
   *  L'écran ne garde donc aucune copie à lui : il écrit, et il reçoit. */
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  /** **La matrice arme, l'atelier tire.** Cliquer une case vide ne dépense
   *  rien : ça remplit le prompt de l'atelier avec le signalement du
   *  personnage et le nom de l'attitude, ça retient la case visée, et ça rend
   *  la main. C'est le bouton Générer de l'atelier qui paie — « le corps naît
   *  dans l'atelier et nulle part ailleurs » reste vrai au pied de la lettre,
   *  et il n'existe qu'un seul endroit d'où l'on paie.
   *
   *  **Une attitude, ou N depuis C2** (US-128). Le geste est le même — armer —,
   *  et c'est le compte qui décide si l'appel se plie. En faire deux gestes
   *  aurait donné deux façons de dire la même intention, qui se seraient
   *  contredites au premier désarmement. */
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    /** **Les angles d'une planche de pose** (E13). Deux ou plus, et l'appel se
     *  plie : une attitude, N directions, un seul appel payé. */
    directions?: string[] | null,
  ) => void
  /** **Animer une case** (A9, V3) — la seconde façon de la remplir, et elle ne
   *  passe pas par la barre qui paie.
   *
   *  Elle ouvre l'écran qui commande un clip : on y choisit l'image de départ,
   *  le mouvement, le modèle et le nombre, et **c'est le bouton de cet écran-là
   *  qui paie**. La matrice ne fait ici que désigner la case, exactement comme
   *  `onArmer` ne fait que remplir un prompt.
   *
   *  **La direction est facultative** parce qu'un jeu vu de face n'en déclare
   *  aucune, et qu'on anime alors la pose telle quelle. */
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  /** **Où le jeu range ses images** (C5) — le dossier posé dans les Réglages.
   *
   *  L'écran ne s'en sert que pour griser avec sa raison ; le geste, lui, le
   *  redemande au serveur, qui en est le seul dépositaire. Vide, ce n'est pas
   *  une erreur : c'est un réglage que personne n'a encore posé, et le bouton
   *  le dit au lieu de partir puis d'échouer. */
  /** La chose du jeu ouverte — **c'est le codex qui la désigne**, en descendant
   *  d'un étage. L'établi n'en choisit aucune : il est la profondeur d'une
   *  chose, et sans elle il n'existe pas. */
  ouvert: Personnage
  dossierJeu: string
  /** Ce que cet onglet a à dire dans la barre du châssis. **Il n'a plus sa
   *  fente à lui** : elle n'existait que parce que cet écran couvrait
   *  l'atelier, et qu'une raison envoyée à la barre d'état se serait rendue
   *  derrière lui. Devenu un onglet, il partage la fente du châssis. */
  onFente: (fente: Fente) => void
  /** **La barre qui paie, rendue au pied de l'établi** (E2). Elle appartient au
   *  châssis, pas à cet écran : il n'en existe qu'une dans le produit, et elle
   *  sert les deux lieux d'où l'argent part. */
  barreQuiPaie: ReactNode
  /** **Tenu par `App`**, comme la chose ouverte : c'est un étage du fil
   *  d'Ariane, et le fil vit dans le châssis. */
  onOuvrirCase: (identifiant: string) => void
  /** **Remonter d'une case animée jusqu'au clip qui l'a remplie** (A12).
   *
   *  Tenu par `App` comme les deux gestes voisins, et pour la même raison : le
   *  montage d'un clip vit dans la galerie, et cet écran-ci n'a pas à savoir
   *  qu'il existe des onglets. Il désigne un clip ; `App` décide où l'ouvrir. */
  onMonterLaBande: (clip: string) => void
  /** **Retravailler une animation gardée** (A7) — l'autre porte de la
   *  vignette : celle-ci rouvre ce qui est gardé, `onMonterLaBande`
   *  retourne à la matière qui l'a fourni. */
  onOuvrirLaBande: (bande: string) => void
  /** **Refaire le calage d'un vêtement à la main** (G16) : ouvre l'image dans
   *  les tables, sur la superposition. Deux gestes en un, et c'est pour ça
   *  qu'il vit dans le châssis plutôt qu'ici — la table ouverte est un état de
   *  l'établi, pas de la matrice. */
  onSuperposition: (identifiant: string) => void
  /** **Jeter le calque qu'on n'a pas choisi** (US-505). Tenu par `App` et non
   *  ici, parce que supprimer ouvre le bandeau qui rend — *« annuler »* — et
   *  que ce bandeau appartient au châssis. Un second chemin de suppression
   *  aurait été un second endroit d'où l'on jette sans pouvoir défaire. */
  onSupprimer: (identifiants: string[]) => void
}) {
  // **La fiche ouverte, ou non.** De l'écran et non du serveur : ouvrir une
  // fiche ne change pas le jeu, et l'enregistrer en ferait un état à remettre
  // d'accord avec la chose ouverte à chaque changement d'onglet.
  const [ficheOuverte, setFicheOuverte] = useState(false)
  // **La vitrine, troisième plein cadre du même endroit** (E16). Elle ne
  // fabrique rien et ne modifie rien : comme la fiche, elle retire la barre qui
  // paie, et Échap rend l'établi.
  const [vitrineOuverte, setVitrineOuverte] = useState(false)
  // **Le calibrage, quatrième plein cadre du même endroit** (E17). Il n'est pas
  // dans la barre des tables, et c'est une décision : une table décrit l'image
  // ouverte, celui-ci travaille sur *toutes* les poses à la fois et écrit dans
  // chacune. Le mettre dans la barre voudrait dire que la barre de l'image A
  // porte un outil qui modifie les images B, C et D.
  const [calibrageOuvert, setCalibrageOuvert] = useState(false)
  // **La planche, cinquième plein cadre — et le seul qui garde la barre qui
  // paie** (E13). Les quatre autres règlent, jugent ou recalculent : aucun ne
  // dépense. Celui-ci, si, et c'est même tout ce qu'il fait — on y entre pour
  // voir ce qu'on achète avant de payer.
  //
  // Il retient **la pose**, pas un booléen : on change de pose en cliquant dans
  // sa matrice, sans refermer, et une planche est toujours la planche *d'une*
  // pose.
  const [planchePose, setPlanchePose] = useState<string | null>(null)

  // Changer de chose referme la fiche : elle décrit celle qu'on regardait, et
  // la garder ouverte sur la suivante ferait croire qu'on a réglé l'une en
  // réglant l'autre.
  useEffect(() => {
    setFicheOuverte(false)
    setVitrineOuverte(false)
    setCalibrageOuvert(false)
    setPlanchePose(null)
  }, [ouvert.identifiant])

  const setRefus = (texte: string) =>
    onFente(texte ? { ton: 'echec', texte } : null)
  // **La colonne qu'on lit** (C3) : le corps, ou une pièce. Un identifiant et
  // non l'objet — la pièce continue d'arriver par le flux, renommée ou rangée
  // ailleurs, et une copie gardée ici serait celle d'avant. Même règle que la
  // fiche et l'écran de découpe (`docs/PIEGES.md`).
  const [colonne, setColonne] = useState<string | null>(null)
  // Le calque ouvert dans le panneau de droite, par identifiant et pour la même
  // raison : il se recalcule à chaque zone posée, et l'objet gardé serait celui
  // d'avant le recalcul.
  const [calque, setCalque] = useState<string | null>(null)

  const echouer = (erreur: unknown, defaut: string) =>
    setRefus(erreur instanceof Error ? erreur.message : defaut)

  const piece = pieces.find((p) => p.identifiant === colonne) ?? null
  // Une pièce retirée du vestiaire ramène la colonne au corps d'elle-même : on
  // ne retient qu'un identifiant, et on le relit dans la liste que le flux tient
  // à jour. Rien à nettoyer, donc rien qui puisse échouer à moitié.
  const colonneVive = piece ? colonne : null

  // Le calque ouvert, relu dans les cases du personnage — la seule vérité de cet
  // onglet. Il ne survit ni à la fermeture de sa colonne, ni à la disparition de
  // son image.
  const ouvertCalque = ouvert
    ? (ouvert.cases
        .flatMap((c) => Object.values(c.calques).flat())
        .find((a) => a.identifiant === calque) ?? null)
    : null
  const caseDuCalque = ouvert?.cases.find((c) => c.pose === ouvertCalque?.pose) ?? null

  return (
    // `data-univers` marque ce qui appartient à cet onglet, comme l'onglet
    // Univers : un garde de saisie doit pouvoir distinguer un champ qu'on écrit
    // **ici** du champ de prompt de la galerie.
    //
    // **Plus d'en-tête à lui.** Il en portait un de 44 px — son nom, le nom du
    // jeu, sa fente de refus, et un bouton pour retourner à l'atelier. Les
    // trois premiers sont dans la barre du châssis ; le quatrième n'a plus
    // d'objet, un onglet ne se ferme pas.
    //
    // ⚠️ **`data-etabli` est parti d'ici en `B10`**, et il n'est pas perdu : il
    // vit sur `PageDuSujet.tsx`, qui est devenue le lieu « un sujet est
    // ouvert » et qui contient cet écran-ci comme profondeur. Deux marqueurs
    // identiques imbriqués auraient fait dire au premier `querySelector` venu
    // autre chose selon la profondeur ouverte. Cette matrice garde le sien,
    // `data-matrice`, pour ce qui veut la viser *elle*.
    <div data-matrice data-univers className="flex min-h-0 min-w-0 flex-col bg-fond-0">
      {/* ⚠️ **L'outil en plein cadre est parti d'ici** (`B25`). Une case pleine
          ouvrait l'ancien écran des tables *dans* cette matrice, comme une
          profondeur de plus du même endroit ; elle ouvre maintenant la retouche,
          qui prend la surface entière et que le châssis monte seul. Un écran
          atteint par deux montages est un écran dont les deux conditions
          finissent par ne plus dire la même chose.

          **La fiche, elle, reste en plein cadre** (E12) : c'est la profondeur
          suivante du même endroit, et elle emprunte le mécanisme qui existait
          plutôt que d'en inventer un. Comme l'outil d'avant, elle fait
          disparaître la barre qui paie — régler ne se paie pas. */}
      {(planchePose ? (
          <EcranPlanche
            personnage={ouvert}
            pose={planchePose}
            plan={ouvert.plan ?? plan}
            onPose={setPlanchePose}
            onFermer={() => setPlanchePose(null)}
            onVitrine={() => {
              // On passe de la planche à la vitrine sans repasser par
              // l'établi : c'est la même profondeur, et refermer pour rouvrir
              // aurait fait perdre l'endroit où l'on était. Même geste que
              // depuis la fiche.
              setPlanchePose(null)
              setVitrineOuverte(true)
            }}
            onArmer={(pose, directions) => {
              const attitude = (ouvert.plan ?? plan).find(
                (p) => p.identifiant === pose,
              )
              if (attitude) onArmer(ouvert, [attitude], null, null, directions)
            }}
            onErreur={echouer}
          />
        ) : calibrageOuvert ? (
          <EcranCalibrage
            personnage={ouvert}
            onFermer={() => setCalibrageOuvert(false)}
            onErreur={echouer}
          />
        ) : vitrineOuverte ? (
          <EcranVitrine
            personnage={ouvert}
            personnages={[ouvert]}
            plan={ouvert.plan ?? plan}
            onFermer={() => setVitrineOuverte(false)}
            onErreur={echouer}
          />
        ) : ficheOuverte ? (
          <FicheDeLaChose
            personnage={ouvert}
            plan={ouvert.plan ?? plan}
            onPersonnage={onPersonnage}
            onFermer={() => setFicheOuverte(false)}
            onVitrine={() => {
              // On passe de la fiche à la vitrine sans repasser par l'établi :
              // c'est la même profondeur, et refermer pour rouvrir aurait fait
              // perdre l'endroit où l'on était.
              setFicheOuverte(false)
              setVitrineOuverte(true)
            }}
            // **Et de la fiche au calibrage, pour la même raison** (R8) : c'est
            // sur la fiche qu'on voit qu'une pose sort du lot, et la même
            // profondeur ne se referme pas pour se rouvrir.
            onCalibrage={() => {
              setFicheOuverte(false)
              setCalibrageOuvert(true)
            }}
            onErreur={echouer}
          />
        ) : (
      <div className="flex min-h-0 flex-1">
        <Fiche
          plan={plan}
          personnage={ouvert}
          emplacements={emplacements}
          pieces={pieces}
          colonne={colonneVive}
          onColonne={(identifiant) => {
            setColonne(identifiant)
            setCalque(null)
          }}
          onCalque={setCalque}
          onOuvrirCase={onOuvrirCase}
          onMonterLaBande={onMonterLaBande}
          onOuvrirLaBande={onOuvrirLaBande}
          onPersonnage={onPersonnage}
          onArmer={onArmer}
          onAnimer={onAnimer}
          onFiche={() => setFicheOuverte(true)}
          onVitrine={() => setVitrineOuverte(true)}
          onCalibrage={() => setCalibrageOuvert(true)}
          onPlanche={setPlanchePose}
          dossierJeu={dossierJeu}
          onErreur={echouer}
        />
        {ouvertCalque && piece && (
          <PanneauCalque
            calque={ouvertCalque}
            corps={
              caseDuCalque?.images.find(
                (a) => a.identifiant === ouvertCalque.recette.difference?.base,
              ) ?? null
            }
            pose={
              plan.find((p) => p.identifiant === ouvertCalque.pose)?.nom ??
              (ouvertCalque.pose ?? "")
            }
            piece={piece.nom}
            retenu={
              caseDuCalque?.retenus?.[piece.identifiant] ===
              ouvertCalque.identifiant
            }
            onFermer={() => setCalque(null)}
            onSupprimer={() => {
              onSupprimer([ouvertCalque.identifiant])
              setCalque(null)
            }}
            onSuperposition={() => onSuperposition(ouvertCalque.identifiant)}
            onErreur={echouer}
          />
        )}
      </div>
        ))}
      {/* **La barre qui paie se retire quand la fiche s'ouvre** (E12) —
          exactement comme quand un outil s'ouvre : régler, ranger, désigner une
          référence n'appelle personne, et un écran incapable de dépenser ne
          porte pas le champ qui dépense. `App` la retire déjà pour l'outil,
          qu'il tient ; celle-ci se décide ici, où la fiche vit. */}
      {/* **La planche est la seule des cinq profondeurs à garder la barre qui
          paie** (E13) : c'est le seul endroit du produit où l'on regarde ce
          qu'on achète *avant* de payer, et l'écarter de la barre aurait obligé
          à remonter d'un cran pour dépenser — c'est-à-dire à perdre de vue ce
          qu'on venait de regarder. */}
      {ficheOuverte || vitrineOuverte || calibrageOuvert ? null : barreQuiPaie}
    </div>
  )
}

// ── Ce qui est monté dans le codex ───────────────────────────────────────────
//
// La colonne de gauche de cet écran portait trois listes : les personnages, le
// plan de poses, le vestiaire. **Les trois sont montées dans le codex** — la
// première parce qu'elle *est* le codex, les deux autres parce qu'elles
// s'imposent à plusieurs choses du jeu et n'appartenaient donc pas à la colonne
// d'une seule. Les deux dernières sont exportées telles quelles ; la liste des
// personnages est réécrite là-bas, en cartes.

/** Le plan du jeu — la liste des attitudes que chaque personnage se voit
 *  proposer (US-116, US-118).
 *
 *  **Nommer, c'est créer** : écrire un nom qui n'existe pas encore l'ajoute
 *  sur-le-champ, sans écran de gestion. Et l'ajout ne lance **aucune
 *  génération** — il ajoute une case vide chez chacun, ce qui ne coûte rien. */
export function PlanDuJeu({
  plan,
  onPlan,
  onErreur,
}: {
  plan: Pose[]
  onPlan: (plan: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")

  const ajouter = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      onPlan((await api.ajouterPose(propre)).plan)
      setNom("")
    } catch (erreur) {
      onErreur(erreur, "attitude refusée")
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>Les attitudes du jeu</Libelle>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        Écrite une fois pour le jeu entier — c'est elle qui permet de comparer
        deux personnages ligne à ligne. Ajouter une attitude ajoute une case
        vide à chacun, jamais une génération.
      </p>

      {plan.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Le plan est vide : aucun personnage n'a de case à remplir.
        </p>
      ) : (
        <ul className="flex flex-col">
          {plan.map((pose) => (
            <LignePose
              key={pose.identifiant}
              pose={pose}
              onPlan={onPlan}
              onErreur={onErreur}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ajouter()
          }}
          placeholder="nommer une attitude"
          aria-label="Nom de l'attitude à ajouter"
          className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          inactif={!nom.trim()}
          onClick={() => void ajouter()}
          enfants="Ajouter une attitude"
        />
      </div>
    </section>
  )
}

/** Une attitude du plan : son nom, ce qu'elle demande, et son retrait.
 *
 *  Le nom se corrige **en place** — l'identifiant, lui, ne bouge pas, et c'est
 *  ce qui laisse leur case aux images déjà faites (US-118). */
function LignePose({
  pose,
  onPlan,
  onErreur,
}: {
  pose: Pose
  onPlan: (plan: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(pose.nom)
  const [consigne, setConsigne] = useState(pose.consigne)

  // Une pose renommée ailleurs — un autre onglet, l'agent — arrive par le flux.
  // Sans ça, le champ garderait le nom d'avant et le réécrirait au premier
  // départ du focus.
  useEffect(() => setNom(pose.nom), [pose.nom])
  useEffect(() => setConsigne(pose.consigne), [pose.consigne])

  const renommer = async () => {
    const propre = nom.trim()
    if (!propre || propre === pose.nom) {
      setNom(pose.nom)
      return
    }
    try {
      onPlan((await api.reglerPose(pose.identifiant, { nom: propre })).plan)
    } catch (erreur) {
      setNom(pose.nom)
      onErreur(erreur, "renommage refusé")
    }
  }

  const regler = async (images: number) => {
    try {
      onPlan((await api.reglerPose(pose.identifiant, { images })).plan)
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  /** Ce que cette attitude dit au modèle, en anglais (E10, US-241).
   *
   *  **Le nom se lit, la consigne part.** Jusqu'à E10 c'était le même texte, et
   *  le nom français partait au milieu d'une phrase anglaise. Vide, c'est
   *  encore le nom qui part — le produit ne traduit pas à la place de l'auteur —
   *  et le champ le dit en clair. */
  const poser = async () => {
    const propre = consigne.trim()
    if (propre === pose.consigne) return
    try {
      onPlan((await api.reglerPose(pose.identifiant, { consigne: propre })).plan)
    } catch (erreur) {
      setConsigne(pose.consigne)
      onErreur(erreur, "consigne refusée")
    }
  }

  return (
    <li className="flex h-[26px] items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => void renommer()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        aria-label={`Nom de l'attitude ${pose.nom}`}
        className="mesure h-[24px] w-[110px] shrink-0 rounded-[2px] border border-transparent bg-transparent px-1 text-[11px] text-texte-2 hover:border-bord focus:border-bord-fort focus:bg-fond-2"
      />
      <input
        value={consigne}
        onChange={(e) => setConsigne(e.target.value)}
        onBlur={() => void poser()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        placeholder={`${pose.nom} — part tel quel`}
        aria-label={`Ce que « ${pose.nom} » dit au modèle`}
        title="en anglais : c'est ce texte-là qui part, et il ne se retape jamais sur chaque direction"
        className="champ h-[24px] min-w-0 flex-1 rounded-[2px] border border-transparent bg-transparent px-1 text-[11px] text-texte-3 hover:border-bord focus:border-bord-fort focus:bg-fond-2 focus:text-texte-2"
      />
      <input
        type="number"
        min={1}
        max={64}
        value={pose.images}
        onChange={(e) => void regler(Number(e.target.value))}
        aria-label={`Images demandées pour ${pose.nom}`}
        className="mesure h-[24px] w-[46px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte-2"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            onPlan((await api.retirerPose(pose.identifiant)).plan)
          } catch (erreur) {
            onErreur(erreur, "retrait refusé")
          }
        }}
        aria-label={`Retirer l'attitude ${pose.nom}`}
        title="les images déjà faites restent"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
      >
        ×
      </button>
    </li>
  )
}

/** Le vestiaire du projet — où les pièces se posent, et ce qu'elles sont
 *  (US-136, US-137).
 *
 *  **Deux listes qu'on écrit une fois**, comme les personnages et les attitudes
 *  juste au-dessus, et rangées dans la même colonne pour cette raison-là. Ni
 *  vignette, ni recherche : un jeu a des emplacements, pas des centaines.
 *
 *  **Nommer, c'est créer** (US-138) — et jusqu'au bout : écrire « casque · tête »
 *  crée la tête si elle n'existe pas. Ranger n'est jamais un préalable, et il
 *  n'y a donc aucun ordre imposé entre les deux champs. */
export function Vestiaire({
  emplacements,
  pieces,
  onVestiaire,
  onErreur,
}: {
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  onVestiaire: (vestiaire: Vestiaire) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")
  const [ou, setOu] = useState("")

  const ajouter = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      onVestiaire(await api.ajouterPiece({ nom: propre, emplacement: ou.trim() }))
      setNom("")
      setOu("")
    } catch (erreur) {
      onErreur(erreur, "pièce refusée")
    }
  }

  // **Rangées par emplacement, dans l'ordre de l'auteur**, et les orphelines à
  // la fin sous un intitulé qui dit ce qu'elles sont : une pièce sans
  // emplacement n'est pas une erreur, c'est une pièce qu'on vient de nommer.
  const groupes = [
    ...emplacements.map((e) => ({
      cle: e.identifiant,
      nom: e.nom,
      pieces: pieces.filter((p) => p.emplacement === e.identifiant),
    })),
    {
      cle: "",
      nom: "sans emplacement",
      pieces: pieces.filter(
        (p) => !emplacements.some((e) => e.identifiant === p.emplacement),
      ),
    },
  ].filter((g) => g.pieces.length > 0 || g.cle !== "")

  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>Ce qu'on porte</Libelle>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        Décrite une fois pour le jeu entier, une pièce se pose sur n'importe
        lequel de ses personnages. Elle n'a pas d'image à elle : elle n'apparaît
        que sur un corps.
      </p>

      {groupes.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Aucune pièce — et aucun emplacement. Les deux se créent en nommant.
        </p>
      ) : (
        groupes.map((groupe) => (
          <div key={groupe.cle} className="flex flex-col">
            <div className="flex items-center gap-2 pt-1">
              <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
                {groupe.nom}
              </span>
              {groupe.cle && (
                <button
                  type="button"
                  onClick={() => {
                    void api
                      .retirerEmplacement(groupe.cle)
                      .then(onVestiaire)
                      .catch((e) => onErreur(e, "retrait refusé"))
                  }}
                  aria-label={`Retirer l'emplacement ${groupe.nom}`}
                  title="les pièces qui l'occupaient restent — jamais de cascade"
                  className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
                >
                  ×
                </button>
              )}
            </div>
            {groupe.pieces.map((piece) => (
              <LignePiece
                key={piece.identifiant}
                piece={piece}
                onVestiaire={onVestiaire}
                onErreur={onErreur}
              />
            ))}
          </div>
        ))
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ajouter()
          }}
          placeholder="nommer une pièce"
          aria-label="Nom de la pièce à ajouter"
          className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <input
          value={ou}
          onChange={(e) => setOu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ajouter()
          }}
          // **Un exemple, pas une étiquette.** « où » demandait à l'auteur de
          // deviner de quoi on parle ; deux endroits du corps le lui disent
          // sans une ligne de plus (séance du 29 août 2026).
          placeholder="tête, dos…"
          aria-label="Emplacement de la pièce sur le corps — créé s'il n'existe pas"
          className="mesure h-[34px] w-[86px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          inactif={!nom.trim()}
          onClick={() => void ajouter()}
          enfants="Ajouter"
        />
      </div>
    </section>
  )
}

/** Une pièce : son nom, ce qu'elle est, où elle se pose, et **sa portée**.
 *
 *  La portée est un choix de l'auteur et jamais une déduction (US-139) : c'est
 *  elle qui décide si l'atelier saura fabriquer un calque, et le produit ne lit
 *  pas le mot « cape » pour s'en faire une idée. Deux valeurs, la liste est
 *  close, et le défaut est celle qui marche. */
function LignePiece({
  piece,
  onVestiaire,
  onErreur,
}: {
  piece: Piece
  onVestiaire: (vestiaire: Vestiaire) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(piece.nom)
  const [description, setDescription] = useState(piece.description)

  // Une pièce réglée ailleurs — un autre onglet, l'agent — arrive par le flux.
  // Sans ça, les champs garderaient les valeurs d'avant et les réécriraient au
  // premier départ du focus.
  useEffect(() => setNom(piece.nom), [piece.nom])
  useEffect(() => setDescription(piece.description), [piece.description])

  const regler = async (champs: Parameters<typeof api.reglerPiece>[1]) => {
    try {
      onVestiaire(await api.reglerPiece(piece.identifiant, champs))
    } catch (erreur) {
      setNom(piece.nom)
      setDescription(piece.description)
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <div className="flex flex-col gap-1 border-b border-bord py-1.5">
      <div className="flex items-center gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => {
            const propre = nom.trim()
            if (!propre || propre === piece.nom) return setNom(piece.nom)
            void regler({ nom: propre })
          }}
          aria-label={`Nom de la pièce ${piece.nom}`}
          className="mesure h-[24px] min-w-0 flex-1 rounded-[2px] border border-transparent bg-transparent px-1 text-[11.5px] text-texte-2 hover:border-bord focus:border-bord focus:bg-fond-2"
        />
        {/* **La portée, déclarée** (US-139). Un `select` et non deux boutons :
            la liste est close, et l'auteur choisit dans ce qui existe. */}
        <select
          value={piece.portee}
          onChange={(e) => void regler({ portee: e.target.value as Portee })}
          aria-label={`Portée de ${piece.nom}`}
          title="contenue : elle tient dans la silhouette du corps. agrandit : elle en déborde (cape, arme longue), et la planche part alors avec de la marge. L'atelier ne le devine pas."
          className="mesure h-[24px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
        >
          <option value="contenue">contenue</option>
          <option value="agrandit">agrandit</option>
        </select>
        <button
          type="button"
          onClick={() => {
            void api
              .retirerPiece(piece.identifiant)
              .then(onVestiaire)
              .catch((e) => onErreur(e, "retrait refusé"))
          }}
          aria-label={`Retirer la pièce ${piece.nom}`}
          title="ses calques restent — jamais de cascade"
          className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
        >
          ×
        </button>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description === piece.description) return
          void regler({ description })
        }}
        rows={2}
        placeholder="ce qu'elle est — ce texte part dans le prompt"
        aria-label={`Description de ${piece.nom}`}
        className="mesure w-full resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11px] leading-4 text-texte placeholder:text-texte-3"
      />
      <SurQuiElleEstPosee piece={piece} />
    </div>
  )
}

/** **Sur quels personnages cette pièce est posée** (E15, US-284).
 *
 *  C'est tout l'établi d'une pièce, et il ne montre **aucune image** : le
 *  produit interdit de générer un casque sur fond vide — un casque n'existe
 *  qu'apparu sur un corps —, et une chose qui n'a pas d'image à elle ne fait pas
 *  semblant d'en avoir. Ce qui manque se lit comme partout ailleurs : *posée sur
 *  1 personnage sur 3*.
 *
 *  **Rien n'est enregistré** : c'est l'image qui dit sa pièce, et une pièce
 *  posée se déduit donc des assets, comme une case pleine. */
function SurQuiElleEstPosee({ piece }: { piece: Piece }) {
  const [portee, setPortee] = useState<PorteeDeLaPiece | null>(null)

  useEffect(() => {
    let vivant = true
    void api
      .porteeDeLaPiece(piece.identifiant)
      .then((recue) => vivant && setPortee(recue))
      .catch(() => vivant && setPortee(null))
    return () => {
      vivant = false
    }
  }, [piece.identifiant])

  if (!portee) return null

  return (
    <div className="flex flex-col gap-0.5">
      <p className="mesure text-[10px] leading-4 text-texte-3">
        {portee.candidats === 0
          ? "Aucune chose du jeu ne peut la porter — une pièce se pose sur un corps."
          : `Posée sur ${portee.posee} personnage${
              portee.posee > 1 ? "s" : ""
            } sur ${portee.candidats}.`}
      </p>
      {portee.portee.length > 0 && (
        <ul className="flex flex-col">
          {portee.portee.map((qui) => (
            <li
              key={qui.personnage}
              className="mesure flex items-baseline gap-2 text-[10px] leading-4"
            >
              <span
                className={
                  qui.poses.length > 0 ? "text-texte-2" : "text-texte-3"
                }
              >
                {qui.nom}
              </span>
              <span className="min-w-0 flex-1 truncate text-texte-3">
                {qui.poses.length > 0
                  ? qui.poses.join(" · ")
                  : "pas encore posée"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── La colonne de droite — ce personnage-là ──────────────────────────────────

function Fiche({
  plan,
  personnage,
  emplacements,
  pieces,
  colonne,
  onColonne,
  onCalque,
  onOuvrirCase,
  onMonterLaBande,
  onOuvrirLaBande,
  onPersonnage,
  onArmer,
  onAnimer,
  onFiche,
  onVitrine,
  onCalibrage,
  onPlanche,
  dossierJeu,
  onErreur,
}: {
  plan: Pose[]
  personnage: Personnage | null
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  colonne: string | null
  onColonne: (piece: string | null) => void
  onCalque: (calque: string | null) => void
  onOuvrirCase: (identifiant: string) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    /** **Les angles d'une planche de pose** (E13). Deux ou plus, et l'appel se
     *  plie : une attitude, N directions, un seul appel payé. */
    directions?: string[] | null,
  ) => void
  /** **Animer une case** (A9) — l'écran qui commande un clip. La matrice
   *  désigne, cet écran-là paie. */
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  /** Descendre d'un cran : la fiche plein cadre (E12). Elle vit dans l'établi
   *  parce que c'est de là qu'on y entre et qu'on y revient. */
  onFiche: () => void
  /** Et la vitrine (E16), qui montre ce qu'on regardait — ici, une chose et
   *  toutes ses poses à la même échelle. */
  onVitrine: () => void
  /** Et le calibrage (E17), qui les empile dans la même case. */
  onCalibrage: () => void
  /** **Remonter d'une case animée jusqu'à son clip** (A12). Portée par la fiche
   *  pour la même raison que la planche : c'est sa matrice qui la déclenche. */
  onMonterLaBande: (clip: string) => void
  /** **Retravailler une animation gardée** (A7) — l'autre porte de la
   *  vignette : celle-ci rouvre ce qui est gardé, `onMonterLaBande`
   *  retourne à la matière qui l'a fourni. */
  onOuvrirLaBande: (bande: string) => void
  /** **Ouvrir la planche d'une pose** (E13). Portée par la fiche parce que
   *  c'est sa matrice qui la déclenche, ligne par ligne. */
  onPlanche: (pose: string) => void
  dossierJeu: string
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  if (!personnage) {
    return (
      // L'état vide en serif, comme la bibliothèque et le tableau : c'est une
      // invitation, et le troisième emploi du display (`docs/DESIGN.md`
      // § Typography, règle 1). **Rien de plus** — le codex porte déjà le champ
      // qui nomme et son explication, et les redire ici en ferait un doublon.
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Ce jeu n'a encore personne. <em className="text-texte-2">Nomme le premier.</em>
        </p>
      </div>
    )
  }

  return (
    // **Deux colonnes, `300px · 1fr`** (E2) : ce qu'elle *est* à gauche, ce
    // qu'elle *a* et ce qu'on peut lui ajouter à droite. La 300 ne disparaît
    // donc pas avec la V2.1 — elle **change de locataire** : c'était la colonne
    // des réglages d'une génération, qui descend dans l'établi et n'a plus à se
    // ressaisir ; c'est maintenant l'identité d'une chose du jeu.
    //
    // Les quatre blocs empilés sur toute la largeur tenaient tant que l'écran
    // n'était qu'une fiche. La matrice a besoin de la largeur — une pose y a
    // quatre cases depuis les directions — et l'identité n'en a jamais eu
    // besoin : elle est du texte.
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
      <aside
        {...PANNEAU}
        className="defile flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-bord bg-fond-1 p-3"
      >
        <Identite
          personnage={personnage}
          onPersonnage={onPersonnage}
          onFiche={onFiche}
          onVitrine={onVitrine}
          onCalibrage={onCalibrage}
          onErreur={onErreur}
        />
        <Sortie personnage={personnage} dossierJeu={dossierJeu} />
      </aside>

      <div className="defile flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto p-4">
        {/* **Un établi n'affiche que ce que sa famille peut avoir** (E15) :
            un décor et un bouton n'ont pas de vestiaire, et leur établi ne
            dessine donc aucune colonne d'équipement. Pas une colonne grisée —
            ce qu'une famille ne peut pas avoir n'existe pas dans son établi, et
            le grisé reste réservé à ce qui viendra. */}
        {personnage.equipable && (
          <Colonnes
            emplacements={emplacements}
            pieces={pieces}
            colonne={colonne}
            onColonne={onColonne}
          />
        )}
        <Cases
          plan={plan}
          personnage={personnage}
          piece={pieces.find((p) => p.identifiant === colonne) ?? null}
          onCalque={onCalque}
          onOuvrirCase={onOuvrirCase}
          onMonterLaBande={onMonterLaBande}
          onOuvrirLaBande={onOuvrirLaBande}
          onPersonnage={onPersonnage}
          onArmer={onArmer}
          onAnimer={onAnimer}
          onPlanche={onPlanche}
          onErreur={onErreur}
        />
      </div>
    </div>
  )
}

/** Le personnage part dans le jeu (US-154, US-155).
 *
 *  **En bas de la fiche, et c'est l'ordre du geste** : on regarde ce qui est
 *  fait, ce qui manque, et alors seulement on livre. Un bouton posé en tête
 *  aurait proposé de sortir avant d'avoir montré ce qu'il y a à sortir.
 *
 *  **Grisé avec sa raison**, jamais caché (`docs/design-motifs.md` § Le grisé porte sa
 *  raison) : ici la chose existe — c'est un personnage —, et ce qui manque est
 *  nommé. Deux raisons, et l'ordre compte : ce qu'il faut fabriquer d'abord, le
 *  réglage ensuite.
 *
 *  **Ce qui décide, c'est `corps`**, calculé par le serveur — celui-là même qui
 *  écrira les fichiers. L'écran ne rejoue pas la règle « cette pose est
 *  remplie » : il la lit, comme la planche d'équipement la lit déjà pour savoir
 *  quelle attitude est éligible. */
function Sortie({
  personnage,
  dossierJeu,
}: {
  personnage: Personnage
  dossierJeu: string
}) {
  const [sortie, setSortie] = useState<SortieAuJeu | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const dernier = useRef(personnage.identifiant)

  // Changer de personnage efface le compte rendu du précédent : « 12 fichiers
  // posés » sous le nom de quelqu'un d'autre serait un mensonge, et c'est le
  // geste de la fiche asset, repris tel quel.
  useEffect(() => {
    if (dernier.current === personnage.identifiant) return
    dernier.current = personnage.identifiant
    setSortie(null)
    setRefus(null)
  }, [personnage])

  const remplies = personnage.cases.filter((c) => c.corps).length
  const raison =
    remplies === 0
      ? "aucune attitude remplie — il n'y a rien à sortir"
      : !dossierJeu.trim()
        ? "aucun dossier de jeu — pose-le dans l'écran Réglages"
        : null

  const sortir = async () => {
    setEnCours(true)
    setRefus(null)
    try {
      setSortie(await api.sortirPersonnage(personnage.identifiant))
    } catch (erreur) {
      setSortie(null)
      setRefus(erreur instanceof Error ? erreur.message : "sortie refusée")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="flex flex-col gap-2 border-t border-bord pt-4">
      <Libelle>Sortir vers le jeu</Libelle>
      <div className="flex items-center gap-3">
        <Bouton
          inactif={raison !== null || enCours}
          onClick={() => void sortir()}
          titre={raison ?? dossierJeu}
          enfants={enCours ? "Sortie…" : "Poser dans le dossier du jeu"}
        />
        <span className="mesure min-w-0 flex-1 truncate text-[10px] text-texte-3">
          {raison ?? dossierJeu}
        </span>
      </div>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        Un fichier par attitude et par pièce, plus un descriptif qui dit ce
        qu'est chacun. C'est le rendu qui part ; l'image payée reste ici.
      </p>
      {sortie && (
        <p className="mesure text-[10px] leading-4 text-texte-2">
          {sortie.compte} fichiers posés dans{" "}
          <span className="text-texte">{sortie.dossier}</span>. Rien n'a été
          écrasé.
        </p>
      )}
      {refus && (
        <p className="mesure flex items-center gap-1.5 text-[10px] text-ancien-echec">
          <span aria-hidden className="inline-block h-px w-2 bg-ancien-echec" />
          {refus}
        </p>
      )}
    </section>
  )
}

/** Le second axe de la matrice — **une colonne à la fois** (C3).
 *
 *  Deux axes, dit le cadrage : les poses d'un côté, les emplacements de
 *  l'autre. Un damier de vignettes les aurait croisés à l'écran — et aurait
 *  redonné à cet écran très exactement ce que la privation de C1 lui refuse, une
 *  seconde planche contact. On choisit donc **la colonne qu'on lit**, et la
 *  matrice reste ce qu'elle est : une ligne par attitude.
 *
 *  Le motif de C1 le disait déjà, et il est repris au mot : *on lit une colonne,
 *  on ne balaie pas une planche contact.*
 *
 *  **Absent tant qu'il n'y a pas de pièce**, jamais grisé : le § Le grisé porte
 *  sa raison suppose une chose indisponible, et ici il n'y a pas de chose —
 *  c'est la bascule de `+ personnage` et celle de `Fabriquer ensemble`.
 *
 *  **Et absent pour une famille qui ne porte rien** (E15) : un décor n'a pas de
 *  vestiaire, et son établi ne dessine donc pas cette section. C'est l'appelant
 *  qui tranche, parce que c'est lui qui connaît la chose. */
function Colonnes({
  emplacements,
  pieces,
  colonne,
  onColonne,
}: {
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  colonne: string | null
  onColonne: (piece: string | null) => void
}) {
  if (pieces.length === 0) return null
  // Dans l'ordre des emplacements, et les orphelines à la fin : c'est l'ordre
  // dans lequel l'auteur habille quelqu'un, pas celui de l'alphabet.
  const rangees = [
    ...emplacements.flatMap((e) => pieces.filter((p) => p.emplacement === e.identifiant)),
    ...pieces.filter((p) => !emplacements.some((e) => e.identifiant === p.emplacement)),
  ]
  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>La colonne qu'on lit</Libelle>
      <div className="flex flex-wrap items-center gap-1.5">
        <Onglet actif={colonne === null} onClick={() => onColonne(null)}>
          le corps
        </Onglet>
        {rangees.map((piece) => (
          <Onglet
            key={piece.identifiant}
            actif={colonne === piece.identifiant}
            onClick={() => onColonne(piece.identifiant)}
          >
            {piece.nom}
          </Onglet>
        ))}
      </div>
    </section>
  )
}

/** Le rang de 26 px de l'arbre, couché. Aucune grammaire neuve : actif sur
 *  `--fond-3`, survol `--fond-2`, 80 ms. */
function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={[
        "mesure h-[26px] rounded-[2px] px-2 text-[10px] transition-colors duration-[80ms]",
        actif
          ? "bg-fond-3 text-texte"
          : "bg-fond-1 text-texte-3 hover:bg-fond-2 hover:text-texte-2",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

/** Le nom et la description — écrits **une fois** (US-115).
 *
 *  La description part avec chaque génération de pose : c'est très exactement
 *  le signalement qu'on ne veut plus retaper à chaque prompt. */
function Identite({
  personnage,
  onPersonnage,
  onFiche,
  onVitrine,
  onCalibrage,
  onErreur,
}: {
  personnage: Personnage
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  /** Descendre d'un cran : la fiche plein cadre (E12). */
  onFiche: () => void
  /** Et la vitrine (E16). */
  onVitrine: () => void
  /** Et le calibrage (E17). */
  onCalibrage: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(personnage.nom)
  const [description, setDescription] = useState(personnage.description)
  const dernier = useRef(personnage.identifiant)
  // **Les types du jeu, demandés à la route qui les sert** (E9) — les mêmes que
  // l'assistant règle, et pas une seconde liste écrite ici. Vide tant qu'elle
  // n'est pas revenue : le choix se montre alors sans option, plutôt que de
  // proposer huit noms que le jeu ne porte peut-être pas.
  const [types, setTypes] = useState<PosesDesTypes["types"]>([])
  // **Les ambiances du jeu** (E11), demandées à la route qui les sert. Elles se
  // désignent ici et nulle part ailleurs : une collection reste un dossier qui
  // ne décide de rien, et confondre ranger et régler ferait qu'un rangement
  // changerait un style.
  const [ambiances, setAmbiances] = useState<AmbianceDuJeu[]>([])

  useEffect(() => {
    void api
      .posesDesTypes()
      .then((recu) => setTypes(recu?.types ?? []))
      .catch(() => setTypes([]))
    void api
      .coteAmbiances()
      .then((recu) => setAmbiances(recu?.ambiances ?? []))
      .catch(() => setAmbiances([]))
  }, [])

  // Changer de personnage remet les champs sur celui-là. Sans ça, le panneau
  // garderait le texte du précédent et on croirait l'avoir écrit ici — c'est
  // le geste de la fiche asset, et la même panne.
  useEffect(() => {
    if (dernier.current === personnage.identifiant) return
    dernier.current = personnage.identifiant
    setNom(personnage.nom)
    setDescription(personnage.description)
  }, [personnage])

  const poser = async (champs: {
    nom?: string
    description?: string
    type?: string
    ambiance?: string
    prend?: string
  }) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
      onPersonnage(rendu.personnage)
    } catch (erreur) {
      setNom(personnage.nom)
      setDescription(personnage.description)
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <section className="flex flex-col gap-2">
      {/* **Le nom sur sa ligne, les portes sur la leur** — corrigé le 31 août
          2026. Les cinq tenaient une seule rangée dans une colonne de 284 px,
          et la rangée en demandait 372 : `Supprimer` dépassait de 72 px au-delà
          du bord, atteignable seulement en trouvant une barre de défilement
          horizontale que personne ne cherche sur une colonne de réglages. C'est
          aussi ce qu'interdit la règle écrite du projet — « un panneau est
          borné par l'écran, jamais par son contenu » (`docs/DESIGN.md`
          § Layout).

          La rangée passe donc à la ligne au lieu de sortir, et le nom prend la
          sienne : c'est le seul champ des cinq qu'on écrit, et il n'avait
          aucune raison de disputer sa largeur à des liens. */}
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => {
          if (nom.trim() && nom !== personnage.nom) void poser({ nom: nom.trim() })
          else setNom(personnage.nom)
        }}
        aria-label="Nom du personnage"
        className="w-full min-w-0 rounded-[2px] border border-transparent bg-transparent px-1 text-[15px] leading-none text-texte hover:border-bord focus:border-bord-fort focus:bg-fond-1"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* **Un clic sur « sa fiche » ouvre l'écran plein cadre** (E12). Le
            geste est celui de la maquette : on descend d'un cran depuis
            l'établi, et Échap ramène à l'endroit exact d'où l'on venait. */}
        <button
          type="button"
          onClick={onFiche}
          title="ce qu'elle est, ce qui l'habille, ses images de référence — rien de tout ça ne coûte"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          sa fiche ›
        </button>
        {/* **La vitrine montre ce qu'on regardait** (E16) : ouverte d'ici, ce
            sont toutes les poses de cette chose, à la même échelle — c'est comme
            ça qu'une pose sortie d'un quart plus petite se voit. */}
        <button
          type="button"
          onClick={onVitrine}
          title="voir ce que ça donne, en grand, sur le fond que la bible décrit"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          la vitrine ›
        </button>
        {/* **Le calibrage s'ouvre d'ici** (E17), sur la matrice de ses poses :
            c'est là qu'on les voit toutes, donc là qu'on remarque qu'elles ne
            s'accordent pas. Il ne fabrique rien et ne coûte rien — il change le
            rendu d'images déjà payées. */}
        <button
          type="button"
          onClick={onCalibrage}
          title="toutes ses poses empilées dans la même case — c'est comme ça qu'on voit qu'il rapetisse en frappant"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          le calibrage ›
        </button>
        {/* **Et il sort de la rangée des portes.** Les trois au-dessus ouvrent
            un écran ; celui-ci détruit. Les mettre côte à côte, du même
            caractère et de la même taille, faisait du plus dangereux des quatre
            le voisin des trois plus anodins. `ml-auto` le pousse au bout de la
            ligne, et il passe seul à la suivante quand la place manque. */}
        <button
          type="button"
          onClick={async () => {
            try {
              const parti = await api.supprimerPersonnage(personnage.identifiant)
              onPersonnage({ ...parti.personnage, supprime: true })
            } catch (erreur) {
              onErreur(erreur, "suppression refusée")
            }
          }}
          title="ses images restent, marquées « personnage supprimé »"
          className="mesure ml-auto shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
        >
          Supprimer
        </button>
      </div>

      {/* **Le type d'objet, et il décide de ce que cette chose réclame** (E9).
          Un coffre demande *fermé, ouvert, vidé* ; une tuile ne demande rien.
          Posé juste sous le nom parce que c'est la deuxième chose qu'on sait
          d'une chose du jeu, et parce qu'il change la matrice entière : le
          laisser en bas aurait fait chercher pourquoi les cases ont changé.

          **Les images ne bougent pas** en changeant de type — elles gardent
          l'identifiant de leur pose, et remettre le type d'avant les remet dans
          leur case. C'est ce que dit l'explication, parce que c'est la première
          crainte qu'un tel réglage inspire. */}
      <div className="flex flex-col gap-1">
        <Libelle>Type d'objet</Libelle>
        <select
          value={personnage.type ?? ""}
          aria-label="Type d'objet"
          onChange={(e) => void poser({ type: e.target.value })}
          className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-1 px-1 text-[11px] text-texte-2"
        >
          <option value="">aucun — suit le plan du jeu</option>
          {types.map((type) => (
            <option key={type.nom} value={type.nom}>
              {type.nom} — {type.poses.length === 0
                ? "aucune pose"
                : `${type.poses.length} pose${type.poses.length > 1 ? "s" : ""}`}
            </option>
          ))}
        </select>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Il décide des attitudes qu'on lui demande. En changer ne déplace aucune
          image : chacune garde l'attitude qu'on lui a donnée.
        </p>
      </div>

      {/* **Son ambiance, et ce qu'elle lui prend** (E11).

          Une ambiance ne s'impose pas : on la désigne, puis on choisit ce qu'on
          lui prend. C'est ce qui distingue le modèle retenu de celui qui avait
          été écrit avant — trois étages d'héritage automatique, abandonnés. Ici
          ce n'est plus un héritage subi, c'est un choix.

          **Et c'est la chose du jeu qui la porte, jamais la collection où elle
          est rangée** : grouper vingt monstres et régler leur style sont deux
          gestes différents.

          Absent quand le jeu n'en a aucune : il n'y a pas de chose à griser —
          c'est la bascule de « + personnage », et non le grisé qui porte sa
          raison. L'endroit où l'on en fabrique est nommé à la place. */}
      <div className="flex flex-col gap-1">
        <Libelle>Son ambiance</Libelle>
        {ambiances.length === 0 ? (
          <p className="mesure text-[10px] leading-4 text-texte-3">
            Ce jeu n'a encore aucune ambiance. Elles se fabriquent dans
            l'onglet Univers, côté Ambiances et couleurs.
          </p>
        ) : (
          <>
            <select
              value={personnage.ambiance ?? ""}
              aria-label="Son ambiance"
              onChange={(e) => void poser({ ambiance: e.target.value })}
              className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-1 px-1 text-[11px] text-texte-2"
            >
              <option value="">aucune — le style du jeu</option>
              {ambiances.map((ambiance) => (
                <option key={ambiance.identifiant} value={ambiance.identifiant}>
                  {ambiance.nom}
                </option>
              ))}
            </select>
            {/* **Ce qu'on lui prend**, et seulement quand il y a une ambiance à
                qui le prendre. Trois réponses, mesurées sur trois cas réels : un
                rôdeur des vases prend tout ; une ombre rampante, de forme
                complètement différente des références, ne prend que les
                couleurs ; une version noire d'un personnage prend les couleurs
                et le texte, mais garde sa propre image. */}
            {personnage.ambiance && (
              <select
                value={personnage.prend ?? "tout"}
                aria-label="Ce qu'elle prend à son ambiance"
                onChange={(e) => void poser({ prend: e.target.value })}
                className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-1 px-1 text-[11px] text-texte-2"
              >
                {CE_QU_ON_PREND.map((quoi) => (
                  <option key={quoi} value={quoi}>
                    elle lui prend {NOM_DE_CE_QU_ON_PREND[quoi]}
                  </option>
                ))}
              </select>
            )}
            <p className="mesure text-[10px] leading-4 text-texte-3">
              La palette agit au retour, sur la machine : rien n'est payé, et ce
              qui est déjà fait suit.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Libelle>Description</Libelle>
        {/* **La boîte suit le texte** — corrigé le 31 août 2026. C'est le texte
            le plus cher du produit : il repart avec chaque image de cette
            chose, donc il décide de ce qu'on paie et de ce qu'on obtient. Il
            s'écrivait dans trois lignes — mesuré sur un personnage réel, 733
            signes dont un sixième visible —, et un texte qu'on ne relit pas est
            un texte qu'on ne corrige pas. Le plafond de seize lignes est ce qui
            empêche la colonne de partir hors de l'écran ; au-delà, la zone
            défile. */}
        <ZoneTexte
          valeur={description}
          onChange={setDescription}
          onBlur={() => {
            if (description !== personnage.description)
              void poser({ description })
          }}
          lignesMin={3}
          lignesMax={16}
          placeholder="ce qu'il faut redire au modèle à chaque image de ce personnage"
          aria-label="Description du personnage"
          className="mesure w-full rounded-[2px] border border-bord bg-fond-1 p-2 text-[11px] leading-5 text-texte placeholder:text-texte-3"
        />
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Elle part avec chaque image de ce personnage. Écrite ici une fois,
          elle ne se retape jamais dans un prompt.
        </p>
      </div>
    </section>
  )
}

/** Les cases de ce personnage — ce qui est fait, ce qui manque (US-117, US-119).
 *
 *  **Une ligne par attitude tenue**, et les attitudes écartées reléguées à une
 *  ligne en bas : un figurant ne réclame pas les images d'un héros, et sa
 *  colonne ne doit pas montrer cinq cases qu'il n'aura jamais. */
function Cases({
  plan,
  personnage,
  piece,
  onCalque,
  onOuvrirCase,
  onMonterLaBande,
  onOuvrirLaBande,
  onPersonnage,
  onArmer,
  onAnimer,
  onPlanche,
  onErreur,
}: {
  plan: Pose[]
  personnage: Personnage
  /** La colonne qu'on lit : une pièce, ou le corps (C3). C'est **le seul
   *  aiguillage de ce composant** — le reste, les attitudes tenues, les cochées,
   *  les écartées, ne change pas d'une colonne à l'autre. */
  piece: Piece | null
  onCalque: (calque: string | null) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    /** **Les angles d'une planche de pose** (E13). Deux ou plus, et l'appel se
     *  plie : une attitude, N directions, un seul appel payé. */
    directions?: string[] | null,
  ) => void
  /** **Animer une case** (A9) — l'écran qui commande un clip. La matrice
   *  désigne, cet écran-là paie. */
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  /** Ouvrir l'outil d'une case pleine, en plein cadre (E2). */
  onOuvrirCase: (identifiant: string) => void
  /** **Remonter d'une case animée jusqu'au clip qui l'a remplie** (A12). La
   *  bande vient d'un clip payé, et l'écran qui la découpe est celui du
   *  montage : ce geste y ramène, et la matrice n'a pas à savoir que cet écran
   *  vit dans la galerie — c'est `App` qui l'ouvre. */
  onMonterLaBande: (clip: string) => void
  /** **Retravailler une animation gardée** (A7) — l'autre porte de la
   *  vignette : celle-ci rouvre ce qui est gardé, `onMonterLaBande`
   *  retourne à la matière qui l'a fourni. */
  onOuvrirLaBande: (bande: string) => void
  /** **Ouvrir la planche d'une pose** (E13) — voir ce qu'on achète avant de
   *  payer. Une ligne de la matrice y mène, et c'est la porte que la maquette
   *  décrit : on y entre en cliquant une pose, on en sort par Échap. */
  onPlanche: (pose: string) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  // **Ce que cette chose-là réclame** (E9), et non plus ce que le jeu réclame :
  // un coffre demande *fermé, ouvert, vidé*, une tuile ne demande rien. Le
  // serveur la compose — la règle a quatre branches, et un second calcul écrit
  // ici aurait divergé au premier type qui écrit sa liste. Le plan du jeu reste
  // le repli des choses d'avant E9, qui n'ont pas de type.
  const reclame = personnage.plan ?? plan
  const tenues = posesTenues(reclame, personnage)
  const ecartees = reclame.filter((p) => personnage.ecartees.includes(p.identifiant))
  const origines = Object.fromEntries(
    personnage.cases.map((c) => [c.pose, c.origine]),
  ) as Record<string, "type" | "ici" | undefined>
  // **Les attitudes cochées pour partir ensemble** (US-128). Elles vivent dans
  // l'onglet et nulle part ailleurs : c'est une intention qui vaut pour le
  // prochain appel, exactement comme la case visée de C1, et l'enregistrer en
  // ferait un état à remettre d'accord avec le plan à chaque ajout de pose.
  //
  // **Ce qui se coche est une attitude, jamais une image** — c'est ce qui garde
  // vrai « la matrice n'offre pas de sélection multiple » : on ne sélectionne
  // toujours aucun asset ici.
  const [cochees, setCochees] = useState<string[]>([])
  // **L'ordre où l'on regarde une colonne de pièce** (C4, US-152). Il vit dans
  // l'onglet, comme les attitudes cochées : c'est une façon de lire, pas un
  // état du jeu, et l'enregistrer en ferait un réglage de plus à tenir.
  const [ordre, setOrdre] = useState<Ordre>("attitude")
  // **Le calque qu'on regarde** (A12) — les images fixes, ou les animations. Il
  // vit dans l'onglet comme l'ordre et les attitudes cochées, et pour la même
  // raison : c'est une façon de lire, pas un état du jeu.
  //
  // **Le défaut est le calque des images**, et c'est ce qui tient « un projet
  // sans aucune animation se comporte comme aujourd'hui » : on ouvre sur
  // l'écran d'avant, au pixel près, et la seule chose qui s'ajoute est la
  // bascule — sans quoi le calque animé serait inatteignable.
  const [calqueMatrice, setCalqueMatrice] = useState<CalqueDeLaMatrice>("images")
  /** L'archive des animations est en train de se fabriquer (A4). Elle ne coûte
   *  rien mais elle prend un instant — une planche par bande, et une image
   *  animée découpée dedans —, et un bouton qui ne dit rien pendant ce temps-là
   *  se reclique. */
  const [sort, setSort] = useState(false)
  // Une pose décochée du plan, ou retirée au personnage, sort d'elle-même : on
  // ne retient que des identifiants, et on les relit dans le plan vivant.
  const lot = tenues.filter((p) => cochees.includes(p.identifiant))
  // Les cases viennent du **serveur** : elles se déduisent des assets, que cet
  // écran ne tient pas. Rangées par pose pour être lues ligne à ligne.
  const cases = Object.fromEntries(personnage.cases.map((c) => [c.pose, c]))

  // **Une jauge par calque** (A12), et chacune compte des **cases faites**, pas
  // des images : c'est la définition que la matrice emploie déjà partout, et
  // c'est celle qui répond à la question qu'on vient poser — *combien de poses
  // sont couvertes*. Les deux se lisent côte à côte parce que leur écart est le
  // sujet même de la tranche : quatre poses dessinées, une seule animée.
  const jaugeImages = tenues.filter(
    (p) =>
      faitesDeLaCase(cases[p.identifiant]) >=
      (cases[p.identifiant]?.demandees ?? p.images),
  ).length
  const jaugeAnimations = tenues.filter(
    (p) =>
      animeesDeLaCase(cases[p.identifiant]) >=
      animeesDemandees(cases[p.identifiant]),
  ).length

  /** Retirer une image de sa case. L'image reste en bibliothèque — c'est la
   *  désignation qu'on défait, pas l'image qu'on jette.
   *
   *  **Rien à recharger ici** : l'asset change, le serveur l'annonce, et les
   *  cases se redemandent d'elles-mêmes (`App`). Un rechargement écrit ici
   *  serait un second chemin vers le même état. */
  const designer = async (asset: string) => {
    try {
      await api.designer(asset, null, null)
    } catch (erreur) {
      onErreur(erreur, "désignation refusée")
    }
  }

  /** **Retirer une bande de sa case** (A12) — et rien de plus.
   *
   *  ⚠️ **Ni la bande, ni le clip ne s'en vont.** C'est la désignation qu'on
   *  défait, exactement comme `designer` juste au-dessus le fait pour une image :
   *  la bande redevient un brouillon, elle reste dans son clip, elle se
   *  réaffecte. Le clip, lui, a été payé — il n'existe aucun geste de cet
   *  écran-ci qui puisse le perdre.
   *
   *  **Rien à recharger ici** non plus : le serveur annonce la bande, `App`
   *  redemande le plan, et les cases reviennent recomposées. C'est ce que le
   *  genre `bande` du flux est venu apporter dans cette tranche — sans lui, la
   *  matrice serait restée juste jusqu'au prochain changement de projet. */
  const detacher = async (bande: string) => {
    try {
      await api.affecterLaBande(bande, null, null)
    } catch (erreur) {
      onErreur(erreur, "retrait refusé")
    }
  }

  /** Toutes les animations de ce personnage sortent, en une archive (A4).
   *
   *  **L'interface ne dresse pas la liste**, et c'est le point : « les
   *  animations de ce personnage » a déjà une écriture, celle qui remplit ce
   *  calque-ci, et la refaire ici en aurait fait une deuxième. On nomme le
   *  personnage, le serveur rassemble.
   *
   *  Le bouton est sur le calque animé et nulle part ailleurs : c'est là qu'on
   *  regarde ce qui va sortir, et c'est là qu'on voudra le faire sortir. */
  const sortirLesAnimations = async () => {
    if (sort) return
    setSort(true)
    try {
      poserLeFichier(await api.exporterLesBandesDuPersonnage(personnage.identifiant))
    } catch (erreur) {
      onErreur(erreur, "sortie refusée")
    } finally {
      setSort(false)
    }
  }

  /** Garder celle-ci plutôt qu'une autre (US-504).
   *
   *  **C'est le favori de la galerie, et rien d'autre.** La règle qui décide de
   *  ce qui part — *le favori d'abord, sinon la plus récente* — existe depuis
   *  `C2` et sert déjà la planche d'équipement et l'export. Ce qui manquait
   *  était l'endroit où la poser : la matrice est le seul écran du produit qui
   *  montre des images concurrentes côte à côte, et c'est celui qui n'offrait
   *  pas la marque.
   *
   *  **Rien à recharger ici**, comme la désignation juste au-dessus : l'asset
   *  change, le serveur l'annonce, et les cases se redemandent d'elles-mêmes.
   *  L'annonce manquait au favori seul — corrigée le 4 septembre 2026. */
  const basculerFavori = async (asset: string) => {
    const image = personnage.cases
      .flatMap((c) => [...c.images, ...Object.values(c.calques).flat()])
      .find((a) => a.identifiant === asset)
    try {
      await api.favori([asset], !image?.favori)
    } catch (erreur) {
      onErreur(erreur, "favori refusé")
    }
  }

  /** Dire sous quel angle une image montre sa pose (E10).
   *
   *  **Confirmer et déplacer sont le même geste** — celui qui écrit la
   *  direction sur l'image —, et il n'y en a donc qu'un. Le personnage et la
   *  pose sont renvoyés tels quels : ce qui bouge est la direction, et une
   *  désignation partielle effacerait la case. */
  const placer = async (asset: string, direction: string) => {
    const tenue = personnage.cases.find((c) =>
      c.images.some((image) => image.identifiant === asset),
    )
    try {
      await api.designer(asset, personnage.identifiant, tenue?.pose ?? null, direction)
    } catch (erreur) {
      onErreur(erreur, "direction refusée")
    }
  }

  /** Remplir une case au miroir (B1).
   *
   *  **Rien à recharger**, comme la désignation juste au-dessus : le serveur
   *  écrit l'asset et annonce la bibliothèque, et les cases se redemandent
   *  d'elles-mêmes. La direction part avec le geste — c'est celle de la case
   *  qu'on remplit, et le serveur n'a pas à la redeviner. */
  const retourner = async (asset: string, direction: string) => {
    try {
      await api.retourner(asset, direction)
    } catch (erreur) {
      onErreur(erreur, "retournement refusé")
    }
  }

  /** Ranger — ou rendre — une direction, **pour cette chose seule**.
   *
   *  La portée large — une mort n'a qu'un angle, pour tout le jeu — se prend
   *  sur l'attitude, dans le codex. Ici on ne parle que de cette chose : le
   *  dragon n'attaque que vers le sud, les autres continuent d'attaquer
   *  partout. */
  const rangerDirection = async (
    pose: string,
    direction: string,
    rangee: boolean,
  ) => {
    try {
      const rendu = await api.rangerDirection(
        pose,
        direction,
        rangee,
        personnage.identifiant,
      )
      if (rendu.personnage) onPersonnage(rendu.personnage)
    } catch (erreur) {
      onErreur(erreur, "rangement refusé")
    }
  }

  /** Effacer une attitude que cette chose s'était ajoutée. Les images faites
   *  pour elle **restent en bibliothèque** et gardent son identifiant : la
   *  remettre les remet dans leur case. */
  const effacerAjoutee = async (pose: string) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, {
        retirer_ajoutee: pose,
      })
      onPersonnage(rendu.personnage)
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  const cocher = async (pose: string, tenue: boolean) => {
    const suivantes = tenue
      ? [...tenues.map((p) => p.identifiant), pose]
      : tenues.map((p) => p.identifiant).filter((p) => p !== pose)
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, {
        poses: suivantes,
      })
      onPersonnage(rendu.personnage)
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Libelle>{piece ? `${piece.nom} — pose par pose` : "Ce qu'il lui faut"}</Libelle>
        {/* **L'ordre est un choix, et le plan reste le défaut** (C4, US-152).
            Le plan du jeu est l'ordre de l'auteur, et c'est le seul dans lequel
            une case *vide* se lit — la colonne dit d'abord ce qui manque. Le
            pire en tête est ce qu'on demande quand on vient travailler la
            planche qu'on vient de recevoir, et il est à un clic.

            Absent sur la colonne du corps : il n'y a pas de mesure à classer,
            donc pas de chose indisponible — il n'y a rien du tout. */}
        {piece && (
          <div className="ml-auto">
            <Segments<Ordre>
              valeurs={["attitude", "pire"] as const}
              valeur={ordre}
              onChange={setOrdre}
              libelles={{ attitude: "par attitude", pire: "par le pire" }}
            />
          </div>
        )}
        {/* **Les deux calques, et leurs deux jauges au même endroit** (A12).
            La bascule *est* la jauge : chaque calque porte son compte sur le
            segment qui l'ouvre, et l'on passe de l'un à l'autre d'un geste sans
            aller lire un total ailleurs. Deux commandes séparées auraient donné
            un chiffre qu'on lit ici et un calque qu'on change là.

            Absent sur une colonne de pièce : on y habille des corps, et une
            animation ne s'habille pas. */}
        {!piece && reclame.length > 0 && (
          <div className="ml-auto">
            <Segments<CalqueDeLaMatrice>
              valeurs={["images", "animations"] as const}
              valeur={calqueMatrice}
              onChange={setCalqueMatrice}
              libelles={{
                images: `images ${jaugeImages} / ${tenues.length}`,
                animations: `animations ${jaugeAnimations} / ${tenues.length}`,
              }}
            />
          </div>
        )}
      </div>

      {/* **L'écran dit de quoi chaque jauge est le total** (A12) — sans cette
          phrase, deux nombres différents sur deux boutons se lisent comme une
          contradiction plutôt que comme la mesure qu'ils sont. Une pose est
          *dessinée* quand elle a toutes ses images, *animée* quand chacune de
          ses directions porte une bande : ce ne sont pas les mêmes comptes, et
          leur écart est très exactement ce qu'on vient voir. */}
      {!piece && reclame.length > 0 && (
        <p className="mesure text-[9.5px] leading-4 text-texte-3">
          {calqueMatrice === "images"
            ? "des attitudes dont toutes les images sont faites — une animation "
              + "manquante ne s'y voit pas, elle se lit sur l'autre calque"
            : "des attitudes qui portent une animation par direction — une "
              + "bande suffit, elle porte déjà ses images dedans"}
        </p>
      )}

      {reclame.length === 0 ? (
        // **Une tuile n'a pas de rangée de poses du tout** (E9) — pas une
        // rangée grisée, qui lui promettrait qu'elle en aura une un jour. Elle
        // ne bouge pas, elle se raccorde, et la phrase le dit plutôt que de
        // laisser une liste vide passer pour un oubli.
        <p className="mesure text-[10px] leading-4 text-texte-3">
          {personnage.type && SANS_ATTITUDES.includes(personnage.type)
            ? `Un ${personnage.type} n'a pas d'attitudes : il ne bouge pas, il se `
              + `raccorde. Une seule image le remplit.`
            : "Rien à remplir pour l'instant — une attitude s'écrit à gauche, ou "
              + "se pose sur le type de cette chose dans les réglages du jeu."}
        </p>
      ) : piece ? (
        <ul className="flex flex-col gap-px">
          {rangees(tenues, cases, piece.identifiant, ordre).map((pose) => (
            <LigneCalque
              key={pose.identifiant}
              pose={pose}
              piece={piece}
              case_={cases[pose.identifiant]}
              cochee={cochees.includes(pose.identifiant)}
              onCocher={(veut) =>
                setCochees((precedentes) =>
                  veut
                    ? [...precedentes, pose.identifiant]
                    : precedentes.filter((p) => p !== pose.identifiant),
                )
              }
              onOuvrir={onCalque}
              onFavori={(asset) => void basculerFavori(asset)}
              onArmer={() => onArmer(personnage, [pose], piece)}
            />
          ))}
        </ul>
      ) : calqueMatrice === "animations" ? (
        // **Le calque animé** (A12) — les mêmes attitudes, ce qui les anime, et
        // le geste qui commande le clip qui manque. Une pose écartée n'y est pas
        // plus que sur l'autre calque : les deux lisent `tenues`.
        <ul className="flex flex-col gap-px">
          {tenues.map((pose) => (
            <LigneAnimee
              key={pose.identifiant}
              pose={pose}
              case_={cases[pose.identifiant]}
              onAnimer={() => onAnimer(personnage, pose)}
              onAnimerDirection={(direction, nom) =>
                onAnimer(personnage, pose, { identifiant: direction, nom })
              }
              onMonter={onMonterLaBande}
              onOuvrir={onOuvrirLaBande}
              onDetacher={(bande) => void detacher(bande)}
            />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-px">
          {tenues.map((pose) => (
            <LigneCase
              key={pose.identifiant}
              pose={pose}
              case_={cases[pose.identifiant]}
              cochee={cochees.includes(pose.identifiant)}
              onCocher={(veut) =>
                // La forme fonctionnelle, jamais la valeur du rendu : deux
                // clics rapprochés partagent le même rendu, donc la même liste
                // périmée, et le second effacerait le premier
                // (`docs/PIEGES.md`, payé en T3).
                setCochees((precedentes) =>
                  veut
                    ? [...precedentes, pose.identifiant]
                    : precedentes.filter((p) => p !== pose.identifiant),
                )
              }
              origine={origines[pose.identifiant] ?? "type"}
              onArmer={() => onArmer(personnage, [pose])}
              onArmerDirection={(direction) =>
                onArmer(personnage, [pose], null, direction)
              }
              onAnimer={() => onAnimer(personnage, pose)}
              onAnimerDirection={(direction, nom) =>
                onAnimer(personnage, pose, { identifiant: direction, nom })
              }
              onPlanche={() => onPlanche(pose.identifiant)}
              onRangerDirection={(direction, rangee) =>
                void rangerDirection(pose.identifiant, direction, rangee)
              }
              onPlacer={(asset, direction) => void placer(asset, direction)}
              onRetourner={(asset, direction) => void retourner(asset, direction)}
              // **Le × ne veut pas dire la même chose des deux côtés**, et c'est
              // ce que l'origine sert à trancher. Une pose du type se **range**
              // — elle appartient au type, elle reviendra chez les autres, et
              // la reléguer sous le trait la garde à un clic. Une pose ajoutée
              // ici s'**efface** : elle n'existe que sur cette chose, et la
              // reléguer aurait laissé une ligne barrée que rien ne
              // reproposera jamais.
              onRetirer={() =>
                origines[pose.identifiant] === "ici"
                  ? void effacerAjoutee(pose.identifiant)
                  : void cocher(pose.identifiant, false)
              }
              onDesigner={(asset) => void designer(asset)}
              onFavori={(asset) => void basculerFavori(asset)}
              onOuvrirCase={onOuvrirCase}
            />
          ))}
        </ul>
      )}

      {/* **Le geste du lot, et il n'existe que quand il a un objet.** Sans deux
          attitudes cochées, `Fabriquer ensemble` ne désigne rien : il est
          absent, et non grisé avec sa raison. Le § Le grisé porte sa raison
          suppose une chose indisponible ; ici il n'y a pas de chose — c'est la
          bascule de `+ personnage`, et celle de la réserve avant elle.

          Ce qu'il dit, il le dit en clair : **N attitudes, un seul appel**. Le
          prix, lui, se lit dans l'atelier, à côté du bouton qui paie — et c'est
          là qu'on lit aussi ce qu'un compte faux coûterait. */}
      {/* **Le seuil n'est pas le même des deux côtés, et ce n'est pas une
          inconséquence.** Créer une pose seule n'est pas un lot : c'est la
          génération de C1, et la plier ferait payer un gabarit pour une image
          que le produit sait déjà demander. Habiller une pose seule, si : il n'y
          a pas d'autre chemin vers un calque, et ce qui part n'est pas un
          gabarit vide mais le corps lui-même. */}
      {/* **Et il n'existe pas sur le calque animé** (A12) : ce qui se plie est
          une planche d'images, et une animation ne se plie pas — un clip se
          commande case par case, avec son image de départ à lui. Les attitudes
          cochées survivent pourtant à la bascule, et c'est voulu : on revient
          sur le calque des images et le lot est resté armé. */}
      {calqueMatrice === "images" &&
        (piece ? lot.length >= 1 && lot.every((p) => cases[p.identifiant]?.corps) : lot.length >= 2) && (
        <div className="flex items-center gap-2 pt-1">
          <span className="mesure text-[10px] text-texte-3">
            {lot.length} {lot.length > 1 ? "attitudes" : "attitude"}, un seul appel
          </span>
          <button
            type="button"
            onClick={() => {
              onArmer(personnage, lot, piece)
              setCochees([])
            }}
            title="prépare la planche dans l'atelier — rien n'est dépensé ici"
            className="mesure ml-auto px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
          >
            {piece ? "Habiller ensemble ›" : "Fabriquer ensemble ›"}
          </button>
        </div>
      )}

      {/* **La sortie des animations** (A4), et elle ne vit que sur le calque
          animé : c'est là qu'on regarde ce qui va sortir. Elle ne porte aucun
          nombre, et c'est délibéré — l'archive emporte *toutes* les animations
          du personnage, y compris celles d'une attitude rangée sous le trait,
          que la jauge ci-dessus ne compte pas. Un chiffre affiché ici aurait
          annoncé moins que ce que l'archive contient. */}
      {calqueMatrice === "animations" &&
        personnage.cases.some((c) => c.bandes.length > 0) && (
        <div className="flex items-center gap-2 pt-1">
          <span className="mesure text-[10px] text-texte-3">
            planche de sprites, son descriptif, et une image qui tourne
          </span>
          <button
            type="button"
            disabled={sort}
            onClick={() => void sortirLesAnimations()}
            title="toutes ses animations, dans une seule archive — rien n'est dépensé"
            className="mesure ml-auto px-1 text-[10px] text-texte-2 hover:text-texte disabled:opacity-40"
          >
            {sort ? "…" : "Sortir ses animations ›"}
          </button>
        </div>
      )}

      {/* **Ce qu'on range se relègue sous un trait, barré et pâle** (E9) —
          plutôt que de disparaître. C'est ce qui permet de défaire un rangement
          sans se rappeler ce qu'on a rangé : la ligne est encore là, elle a
          seulement cessé de compter. Le barré dit « écarté », le pâle dit
          « pas ici », et le trait sépare ce qui reste à faire de ce dont on a
          décidé qu'il n'y avait rien à faire.

          **Un clic la dérange**, et c'est le même geste qu'à la coche : la
          liste des tenues repart au serveur avec celle-ci en plus. */}
      {ecartees.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-bord pt-2">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            rangé — pas pour cette chose
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {ecartees.map((pose) => (
              <button
                key={pose.identifiant}
                type="button"
                onClick={() => void cocher(pose.identifiant, true)}
                title="lui rendre cette attitude"
                className="mesure h-[24px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte-3 line-through decoration-texte-3/60 opacity-60 hover:bg-fond-2 hover:text-texte-2 hover:no-underline hover:opacity-100"
              >
                {pose.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* **Une attitude pour cette chose seule** (E9) : un boss garde les six
          de son type et s'ajoute sa transformation, sans qu'une case vide
          paraisse chez ses voisines. **Nommer, c'est créer** — un nom tapé, une
          entrée, et la ligne existe ; rien n'est fabriqué et rien n'est payé.

          Absent sur une colonne de pièce : là on habille des attitudes qui
          existent, on n'en écrit pas de nouvelles. */}
      {!piece && (
        <AjoutDePose
          personnage={personnage}
          onPersonnage={onPersonnage}
          onErreur={onErreur}
        />
      )}
    </section>
  )
}

/** Écrire une attitude **pour cette chose seule** (E9).
 *
 *  Le geste du plan du jeu, ramené d'un cran : le champ crée en validant, sans
 *  formulaire et sans bouton d'ouverture, exactement comme le nom d'un
 *  personnage dans le codex. Ce qu'il ajoute ne part nulle part ailleurs — les
 *  autres choses du même type ne voient rien paraître, et c'est très exactement
 *  ce que la tranche promet. */
function AjoutDePose({
  personnage,
  onPersonnage,
  onErreur,
}: {
  personnage: Personnage
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")

  const ajouter = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, {
        ajouter: propre,
      })
      onPersonnage(rendu.personnage)
      setNom("")
    } catch (erreur) {
      onErreur(erreur, "attitude refusée")
    }
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void ajouter()
        }}
        placeholder="une attitude pour elle seule…"
        aria-label={`Ajouter une attitude à ${personnage.nom}`}
        title="elle n'existera que pour cette chose — les autres du même type ne la verront pas"
        className="champ h-[26px] w-[240px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[11px] text-texte placeholder:text-texte-3"
      />
      <span className="mesure text-[9.5px] text-texte-3">
        pour cette chose seule — rien n'est fabriqué
      </span>
    </div>
  )
}

/** Une attitude tenue : ce qu'elle demande, ce qui la remplit, et le geste qui
 *  arme l'atelier quand elle manque (US-119, US-120).
 *
 *  **La case vide est une case, pas un trou** : elle occupe la même hauteur que
 *  les autres et dit ce qu'elle attend. C'est très exactement ce que la matrice
 *  sert à voir — « savoir quoi lancer sans tenir la liste dans ma tête ». */
function LigneCase({
  pose,
  case_,
  cochee,
  origine,
  onCocher,
  onArmer,
  onArmerDirection,
  onAnimer,
  onAnimerDirection,
  onPlanche,
  onRangerDirection,
  onPlacer,
  onRetourner,
  onRetirer,
  onDesigner,
  onFavori,
  onOuvrirCase,
}: {
  pose: Pose
  case_: Case | undefined
  /** **Cochée pour partir avec les autres** (US-128). C'est l'attitude qu'on
   *  coche, pas ses images : la case reste une ligne du plan du jeu. */
  cochee: boolean
  /** **D'où vient cette pose** (E9) : du type d'objet, ou ajoutée sur cette
   *  chose-là. Écrit sur la ligne parce qu'on ne saurait sinon plus qui la
   *  reproposera demain — changer le type emporte les siennes, jamais celles
   *  qu'on a ajoutées ici. */
  origine: "type" | "ici"
  onCocher: (veut: boolean) => void
  onArmer: () => void
  /** Armer **une case** — cette pose dans cette direction-là (E10). Le sujet
   *  composé par le serveur y ajoute la consigne de la direction. */
  onArmerDirection?: (direction: string) => void
  /** **Animer cette attitude** (A9) — l'autre façon de remplir une case, et
   *  elle ne passe pas par la barre qui paie : elle ouvre l'écran qui commande
   *  un clip, et c'est le bouton de cet écran-là qui dépense. */
  onAnimer: () => void
  /** Animer **une case** — cette attitude sous cet angle-là. Le nom voyage
   *  avec l'identifiant parce que l'écran du clip l'écrit dans son titre, et
   *  qu'il n'a pas la liste des directions du jeu sous la main. */
  onAnimerDirection?: (direction: string, nom: string) => void
  /** **Ouvrir la planche de cette pose** (E13) — voir ce qu'on achète avant de
   *  payer : combien de cases, ce qui est écrit dans chacune, et le prix.
   *  Absent quand la pose n'a qu'une direction : il n'y a rien à plier. */
  onPlanche?: () => void
  /** Ranger une direction **pour cette chose seule** — la portée étroite. */
  onRangerDirection?: (direction: string, rangee: boolean) => void
  /** Dire sous quel angle une image montre sa pose. Confirmer et déplacer sont
   *  le même geste, et il n'y en a donc qu'un. */
  onPlacer?: (asset: string, direction: string) => void
  /** **Remplir une case au miroir** (B1) — l'image de départ et la case visée.
   *  Rien n'est payé : c'est la même image, vue de l'autre côté. */
  onRetourner?: (asset: string, direction: string) => void
  onRetirer: () => void
  onDesigner: (asset: string) => void
  /** **Garder celle-ci plutôt qu'une autre** (US-504). C'est le favori, la
   *  seule marque que l'auteur pose lui-même, et c'est elle qui décide du
   *  corps qui part en planche et qui sort dans le jeu. */
  onFavori: (asset: string) => void
  onOuvrirCase: (identifiant: string) => void
}) {
  const images = case_?.images ?? []
  // **Le corps retenu, dit par le serveur** — celui-là même qui composera la
  // planche. Sa marque ne paraît que si l'attitude a le choix : une attitude à
  // une seule image ne pose pas la question.
  const retenu = case_?.corps ?? null
  const concurrence = images.length > 1
  const demandees = case_?.demandees ?? pose.images
  const faites = faitesDeLaCase(case_)
  const faite = faites >= demandees

  // **Ce jeu a-t-il des directions ?** Deux ou plus — tenues et rangées
  // confondues —, et la ligne se découpe en cases. Une seule, ou aucune : le
  // mot ne paraît nulle part, et l'affichage est celui d'avant E10 au pixel
  // près. « Un jeu qui ne veut pas de directions ne les voit jamais. »
  const angles = case_?.directions ?? []
  const rangees = case_?.directions_rangees ?? []
  const aDesDirections = angles.length + rangees.length > 1

  // **Le produit nomme la direction qui manque** (US-239) — c'est très
  // exactement ce qu'il ne savait pas dire avant E10.
  //
  // **Manquer, c'est n'avoir rien du tout.** Une direction commencée mais pas
  // finie n'est pas un manque : sa propre rangée porte déjà son compte, et la
  // nommer ici ferait lire « il manque sud » sous une image de sud.
  const vides = angles.filter((a) => a.images.length === 0)
  const incompletes = angles.filter((a) => a.images.length < a.demandees)

  // **Ce que le miroir peut remplir sans rien payer** (B1).
  const miroirs = useMiroirsDeLAttitude(angles)

  return (
    <li className="flex flex-col border-b border-bord">
    <div className="flex min-h-[52px] items-center gap-3 px-1 py-1">
      <input
        type="checkbox"
        checked={cochee}
        onChange={(e) => onCocher(e.target.checked)}
        aria-label={`Faire partir ${pose.nom} avec les autres`}
        title="cochées ensemble, elles partent en une seule planche"
        className="shrink-0 accent-ancien-signal"
      />
      <span className="flex w-[110px] shrink-0 flex-col justify-center">
        <span className="truncate text-[11.5px] text-texte-2">{pose.nom}</span>
        {/* **L'origine, et seulement quand elle apprend quelque chose.** La
            venue du type est le cas ordinaire — l'écrire sur chaque ligne
            aurait fait six mentions identiques que personne ne lit. Ce qu'on a
            ajouté ici, lui, est une décision, et il se rappelle. */}
        {origine === "ici" && (
          <span
            className="mesure text-[9px] leading-3 text-texte-3"
            title="ajoutée sur cette chose seule — changer son type ne l'emporte pas"
          >
            ajoutée ici
          </span>
        )}
      </span>

      {/* Les vignettes de cette case. **La même image que la grille, servie par
          la même route** — `sujetAsset` est le seul endroit du produit qui
          nomme l'adresse de l'image d'un asset.

          **Avec des directions, elles descendent d'un cran** : chaque case est
          une pose dans une direction, et c'est là que les vignettes vont. La
          rangée dit alors ce qui manque, par son nom. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {aDesDirections ? (
          <span className="mesure text-[10px] leading-4 text-texte-3">
            {angles.length === 0
              ? "aucune direction — tout est rangé"
              : vides.length > 0
                ? `il manque ${vides.map((a) => a.nom).join(", ")}`
                : incompletes.length > 0
                  ? `${incompletes.length} direction${
                      incompletes.length > 1 ? "s" : ""
                    } à compléter`
                  : "toutes ses directions sont faites"}
          </span>
        ) : (
          <>
            {images.map((asset) => (
              <VignetteDeCase
                key={asset.identifiant}
                asset={asset}
                pose={pose.nom}
                retenu={asset.identifiant === retenu}
                concurrence={concurrence}
                onDesigner={onDesigner}
                onFavori={onFavori}
                onOuvrir={onOuvrirCase}
              />
            ))}
            {images.length === 0 && (
              <span className="mesure text-[10px] text-texte-3">rien encore</span>
            )}
          </>
        )}
      </div>

      {/* **Ce que le lot a mesuré sur cette case-là** (US-135). Elles
          s'affichent et n'empêchent rien : le compte d'images est le seul refus
          automatique du produit. Le chiffre et son jumeau, **jamais un seuil** —
          un seuil serait un nombre inventé sur un corpus de vingt-quatre
          planches, et le produit n'en écrit pas qui ne mesure rien. Sur ce
          corpus, les deux planches qui répétaient une pose ressortaient à 0,999
          et 1,000 quand les vingt-deux autres plafonnaient à 0,897 : l'écart se
          lit sans qu'on ait à le trancher. */}
      <MesuresDuLot case_={case_} />

      {/* **Le produit des deux, jamais les deux facteurs séparés** (E10) : une
          pose demande *tant d'images dans tant de directions*, et écrire « 4 ×
          4 » demanderait au lecteur de faire la multiplication qu'on cherche à
          lui épargner. Sans direction déclarée, le produit vaut le facteur et le
          chiffre est celui d'avant. */}
      <span
        className={[
          "mesure shrink-0 text-[9.5px]",
          faite ? "text-ancien-ok" : "text-texte-3",
        ].join(" ")}
        title={
          aDesDirections
            ? `${pose.images} image${pose.images > 1 ? "s" : ""} dans ${
                angles.length
              } direction${angles.length > 1 ? "s" : ""}`
            : undefined
        }
      >
        {faites} / {demandees}
      </span>

      {/* **La planche s'ouvre d'ici** (E13), et seulement quand il y a quelque
          chose à plier : sans deux directions, une pose vaut une image et il n'y
          a pas de feuille à regarder. C'est la troisième porte de l'établi, et
          la seule des cinq où la barre qui paie reste. */}
      {aDesDirections && angles.length > 1 && onPlanche && (
        <button
          type="button"
          onClick={onPlanche}
          aria-label={`Ouvrir la planche de ${pose.nom}`}
          title={`${angles.length} directions, un seul appel — on voit ce qu'on achète avant de payer`}
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          la planche ›
        </button>
      )}

      {/* **Armer, pas payer.** Ce bouton remplit le prompt de l'atelier et rend
          la main : c'est là-bas qu'on relit et qu'on dépense. */}
      <button
        type="button"
        onClick={onArmer}
        aria-label={`Fabriquer ${pose.nom}`}
        title="prépare le prompt dans l'atelier — rien n'est dépensé ici"
        className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Fabriquer ›
      </button>

      {/* **Animer, et c'est un autre chemin que fabriquer** (A9, V3). Celui-ci
          ne remplit pas le prompt : il ouvre l'écran qui commande un clip, où
          l'on choisit l'image de départ, le mouvement et le modèle, et où le
          bouton porte le montant. On y paie une vidéo, pas une image. */}
      <button
        type="button"
        onClick={onAnimer}
        aria-label={`Animer ${pose.nom}`}
        title="ouvre l'écran qui commande un clip — rien n'est dépensé ici"
        className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Animer ›
      </button>

      <button
        type="button"
        onClick={onRetirer}
        aria-label={
          origine === "ici"
            ? `Effacer ${pose.nom}, ajoutée ici`
            : `Retirer ${pose.nom} de ce personnage`
        }
        title={
          origine === "ici"
            ? "elle n'existe que sur cette chose — ses images restent en bibliothèque"
            : "ce personnage n'a pas besoin de cette attitude"
        }
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
      >
        ×
      </button>
    </div>

    {/* ── Une case par direction (E10) ────────────────────────────────────
        « Une case du plan est une pose dans une direction » : c'est ici que
        l'idée devient visible, et c'est ce qui permet enfin de dire qu'il
        manque le nord. */}
    {aDesDirections && (
      <ul className="flex flex-col border-t border-bord/60 bg-fond-1/40">
        {angles.map((angle) => (
          <SousLigneDirection
            key={angle.identifiant}
            pose={pose}
            angle={angle}
            retenu={retenu}
            concurrence={concurrence}
            onDesigner={onDesigner}
            onFavori={onFavori}
            onOuvrirCase={onOuvrirCase}
            onArmer={() => onArmerDirection?.(angle.identifiant)}
            onAnimer={() => onAnimerDirection?.(angle.identifiant, angle.nom)}
            onRanger={() => onRangerDirection?.(angle.identifiant, true)}
            onPlacer={onPlacer}
            angles={angles}
            miroirDepuis={miroirs[angle.identifiant] ?? null}
            onRetourner={onRetourner}
          />
        ))}

        {/* **Ce qui est rangé se relègue sous un trait, barré et pâle** —
            l'idiome de E9, repris tel quel : on défait un rangement sans avoir
            à se rappeler ce qu'on a rangé. La portée est écrite, parce que
            dérangée au jeu et dérangée ici ne sont pas le même geste. */}
        {rangees.length > 0 && (
          <li className="flex items-center gap-2 border-t border-bord px-1 py-1 pl-[26px]">
            {rangees.map((angle) => (
              <button
                key={angle.identifiant}
                type="button"
                onClick={() => onRangerDirection?.(angle.identifiant, false)}
                aria-label={`Rendre ${angle.nom} à ${pose.nom}`}
                title={
                  angle.portee === "ici"
                    ? "rangée sur cette chose seule"
                    : "rangée sur l'attitude, pour tout le jeu"
                }
                className="mesure text-[10px] text-texte-3 line-through opacity-60 hover:text-ancien-signal hover:no-underline hover:opacity-100"
              >
                {angle.nom}
              </button>
            ))}
            <span className="mesure text-[9px] text-texte-3">
              rangées — un clic les rend
            </span>
          </li>
        )}

        {/* **L'orphelin se voit** : une image dont la direction n'existe plus
            reste montrée plutôt que de retomber en silence dans la première
            colonne venue. Jamais de cascade, ici comme partout. */}
        {(case_?.sans_direction.length ?? 0) > 0 && (
          <li className="mesure flex items-center gap-2 border-t border-bord px-1 py-1 pl-[26px] text-[10px] text-texte-3">
            {case_?.sans_direction.length} image
            {(case_?.sans_direction.length ?? 0) > 1 ? "s" : ""} rangée
            {(case_?.sans_direction.length ?? 0) > 1 ? "s" : ""} dans une
            direction que ce jeu n'a plus — elles restent en bibliothèque
          </li>
        )}
      </ul>
    )}
    </li>
  )
}

/** Ce qui peut se remplir au miroir dans cette attitude — la case visée, et
 *  l'image d'où elle viendrait (B1).
 *
 *  **La paire de directions est demandée au serveur, jamais calculée ici.** Les
 *  directions d'un jeu sont libres et l'auteur les renomme : `bas` et `haut`
 *  sont dans ce dépôt et dans aucune liste livrée. Deviner qu'un mot français en
 *  désigne un autre serait la déduction que le produit refuse ailleurs — *vide
 *  ne veut pas dire sud*.
 *
 *  **Une question par direction remplie, et seulement s'il y a une case vide à
 *  remplir.** Une attitude complète ne demande rien ; une attitude sans aucune
 *  image non plus. Ce qui reste est le cas mesuré — michel porte 25 images en
 *  `droite` et aucune en `gauche` —, et il coûte un aller-retour par rangée. */
function useMiroirsDeLAttitude(angles: CaseDirection[]) {
  const [miroirs, setMiroirs] = useState<Record<string, string>>({})
  const aRemplir = angles.some((a) => a.images.length === 0)
  // La clé est la liste des images candidates : elle change quand une case se
  // remplit ou se vide, et pas au rythme des rendus.
  const sources = aRemplir
    ? angles
        .filter((a) => a.images.length > 0)
        .map((a) => a.images[0].identifiant)
        .join(",")
    : ""

  useEffect(() => {
    if (!sources) {
      setMiroirs({})
      return
    }
    let vivant = true
    void Promise.all(
      sources.split(",").map((identifiant) =>
        api.miroirPropose(identifiant).catch(() => null),
      ),
    ).then((reponses) => {
      if (!vivant) return
      const trouves: Record<string, string> = {}
      for (const reponse of reponses)
        if (reponse?.propose) trouves[reponse.propose] = reponse.asset
      setMiroirs(trouves)
    })
    return () => {
      vivant = false
    }
  }, [sources])

  return miroirs
}

/** Une case : **une pose dans une direction** (E10).
 *
 *  C'est l'unité que le produit ne savait pas nommer avant cette étape. Elle
 *  porte son nom, ce qui la remplit, son compte — les vignettes d'un cycle,
 *  dans cette case-là — et les deux gestes qui la concernent : la fabriquer, ou
 *  la ranger parce que cette chose ne la réclame pas. */
function SousLigneDirection({
  pose,
  angle,
  angles,
  retenu,
  concurrence,
  onDesigner,
  onFavori,
  onOuvrirCase,
  onArmer,
  onAnimer,
  onRanger,
  onPlacer,
  miroirDepuis,
  onRetourner,
}: {
  pose: Pose
  angle: CaseDirection
  /** Toutes les directions tenues — de quoi déplacer une image d'une case à
   *  l'autre sans quitter la rangée. */
  angles: CaseDirection[]
  /** **Le corps retenu de l'attitude entière**, toutes directions confondues :
   *  c'est ainsi que le serveur le choisit, et l'écran ne réinvente pas une
   *  seconde règle par direction. */
  retenu: string | null
  concurrence: boolean
  onDesigner: (asset: string) => void
  onFavori: (asset: string) => void
  onOuvrirCase: (identifiant: string) => void
  onArmer: () => void
  /** **Animer cette case** (A9) — ouvre l'écran qui commande un clip, avec
   *  cette attitude et cet angle déjà visés. */
  onAnimer: () => void
  onRanger: () => void
  onPlacer?: (asset: string, direction: string) => void
  /** L'image dont cette case-ci est le miroir, quand le serveur en a désigné
   *  une (B1). `null` le reste du temps, et le geste ne paraît pas : il n'y a
   *  rien à retourner. */
  miroirDepuis?: string | null
  onRetourner?: (asset: string, direction: string) => void
}) {
  const faite = angle.images.length >= angle.demandees

  return (
    <li className="flex min-h-[52px] items-center gap-3 border-t border-bord/40 px-1 py-1 pl-[26px]">
      <span className="w-[92px] shrink-0 truncate text-[11px] text-texte-3">
        {angle.nom}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {angle.images.map((asset) => (
          <span key={asset.identifiant} className="flex flex-col items-center gap-0.5">
            <VignetteDeCase
              asset={asset}
              pose={`${pose.nom} — ${angle.nom}`}
              retenu={asset.identifiant === retenu}
              concurrence={concurrence}
              onDesigner={onDesigner}
              onFavori={onFavori}
              onOuvrir={onOuvrirCase}
            />
            {/* **« À confirmer », et un clic la place** (US-242). Une image
                faite avant la déclaration ne connaît pas sa direction ; le
                produit la range dans la première et le dit, plutôt que de faire
                passer un rangement pour une déduction. */}
            {!asset.direction && (
              <select
                value=""
                onChange={(e) =>
                  e.target.value && onPlacer?.(asset.identifiant, e.target.value)
                }
                aria-label={`Direction de ${asset.label}`}
                title="faite avant les directions — le produit ne devine pas la sienne"
                className="mesure h-[16px] w-[44px] rounded-[2px] border border-epingle/60 bg-fond-2 px-0.5 text-[8px] text-epingle"
              >
                <option value="">à confirmer</option>
                {angles.map((autre) => (
                  <option key={autre.identifiant} value={autre.identifiant}>
                    {autre.nom}
                  </option>
                ))}
              </select>
            )}
          </span>
        ))}
        {angle.images.length === 0 && (
          <span className="mesure text-[10px] text-texte-3">rien encore</span>
        )}
      </div>

      {/* **Le compte d'un cycle, dans une seule case** — et non une jauge : une
          jauge porte le nom d'un ensemble, ce compte-ci porte le nom d'une
          direction — c'est écrit dans la maquette de l'établi,
          `docs/maquettes-v2.1/02-etabli-personnage.html`. */}
      <span
        className={[
          "mesure shrink-0 text-[9.5px]",
          faite ? "text-ancien-ok" : "text-texte-3",
        ].join(" ")}
      >
        {angle.images.length} / {angle.demandees}
      </span>

      {/* **Le miroir, avant les deux gestes qui paient** (B1). Il ne paraît que
          quand une image existe dans la direction d'en face : sans elle il n'y
          a rien à retourner, et un bouton grisé en permanence sur les cases où
          le miroir ne s'applique pas serait une colonne de refus. Il est
          d'abord dans l'ordre parce qu'il est gratuit — la question *faut-il
          payer ?* se pose une fois qu'on sait que non. */}
      {angle.images.length === 0 && miroirDepuis && (
        <button
          type="button"
          onClick={() => onRetourner?.(miroirDepuis, angle.identifiant)}
          aria-label={`Retourner vers ${angle.nom} pour ${pose.nom}`}
          title="la même image, vue de l'autre côté"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          Retourner › gratuit
        </button>
      )}

      <button
        type="button"
        onClick={onArmer}
        aria-label={`Fabriquer ${pose.nom} vers ${angle.nom}`}
        title="prépare le prompt dans l'atelier — l'attitude et la direction, chacune écrite une fois"
        className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Fabriquer ›
      </button>

      <button
        type="button"
        onClick={onAnimer}
        aria-label={`Animer ${pose.nom} vers ${angle.nom}`}
        title="ouvre l'écran qui commande un clip — l'attitude et l'angle sont déjà visés"
        className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Animer ›
      </button>

      <button
        type="button"
        onClick={onRanger}
        aria-label={`Ranger ${angle.nom} pour ${pose.nom}`}
        title="cette chose ne réclame pas cet angle — elle reste montrée, barrée, et un clic la rend"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
      >
        ×
      </button>
    </li>
  )
}


/** Une attitude sur **le calque animé** (A12) : ce qui l'anime, ce qui manque,
 *  et le geste qui commande le clip.
 *
 *  **C'est la même ligne que `LigneCase`, avec un autre contenu de case** — et
 *  c'est délibéré : l'auteur passe de l'un à l'autre d'un geste, et une seconde
 *  disposition lui aurait fait relire l'écran à chaque bascule. Ce qui change
 *  est ce qui remplit la case, ce qu'on y compte, et ce qu'on peut en faire.
 *
 *  **Ce qui n'y est pas, et pourquoi.** Pas de case à cocher : ce qui se coche
 *  part en une planche d'images, et une animation ne se plie pas. Pas de croix
 *  sur la ligne : retirer une attitude au personnage est un geste du plan, il
 *  vaut pour les deux calques, et il vit déjà sur l'autre — deux chemins vers
 *  la même décision auraient fini par se contredire. */
function LigneAnimee({
  pose,
  case_,
  onAnimer,
  onAnimerDirection,
  onMonter,
  onOuvrir,
  onDetacher,
}: {
  pose: Pose
  case_: Case | undefined
  /** **Commander le clip qui remplira cette case** (A9). Il ne dépense rien :
   *  il ouvre l'écran du clip, où l'image de départ est déjà proposée. */
  onAnimer: () => void
  onAnimerDirection: (direction: string, nom: string) => void
  /** Remonter jusqu'au clip dont cette bande est tirée. */
  onMonter: (clip: string) => void
  onOuvrir: (bande: string) => void
  /** Retirer la bande de sa case — **sans perdre ni la bande, ni le clip**. */
  onDetacher: (bande: string) => void
}) {
  const bandes = case_?.bandes ?? []
  const faites = animeesDeLaCase(case_)
  const demandees = animeesDemandees(case_)
  const faite = faites >= demandees

  // **Les mêmes directions que sur l'autre calque**, lues au même endroit : le
  // jeu qui n'en déclare aucune ne voit pas le mot paraître ici non plus.
  const angles = case_?.directions ?? []
  const rangees = case_?.directions_rangees ?? []
  const aDesDirections = angles.length + rangees.length > 1
  const vides = angles.filter((a) => a.bandes.length === 0)

  return (
    <li className="flex flex-col border-b border-bord">
      <div className="flex min-h-[52px] items-center gap-3 px-1 py-1">
        {/* La place de la coche de l'autre calque, tenue vide : les deux
            calques se superposent au pixel près quand on bascule, et le nom des
            attitudes ne saute pas d'un cran. */}
        <span aria-hidden className="w-[13px] shrink-0" />
        <span className="flex w-[110px] shrink-0 flex-col justify-center">
          <span className="truncate text-[11.5px] text-texte-2">{pose.nom}</span>
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {aDesDirections ? (
            <span className="mesure text-[10px] leading-4 text-texte-3">
              {angles.length === 0
                ? "aucune direction — tout est rangé"
                : vides.length > 0
                  ? `pas encore animée vers ${vides.map((a) => a.nom).join(", ")}`
                  : "toutes ses directions sont animées"}
            </span>
          ) : (
            <>
              {bandes.map((bande) => (
                <VignetteDeBande
                  key={bande.identifiant}
                  bande={bande}
                  pose={pose.nom}
                  onMonter={onMonter}
                  onOuvrir={onOuvrir}
                  onDetacher={onDetacher}
                />
              ))}
              {bandes.length === 0 && (
                <span className="mesure text-[10px] text-texte-3">
                  rien ne bouge encore
                </span>
              )}
            </>
          )}
        </div>

        {/* **Une par direction, jamais autant que d'images** : c'est le chiffre
            qui dit que les deux calques ne se comptent pas pareil. Une marche
            demande huit images pour être dessinée et **une bande** pour être
            animée — la bande porte ses huit images dedans. */}
        <span
          className={[
            "mesure shrink-0 text-[9.5px]",
            faite ? "text-ancien-ok" : "text-texte-3",
          ].join(" ")}
          title={
            aDesDirections
              ? `une animation par direction — ${angles.length} au total`
              : "une animation suffit : elle porte déjà ses images dedans"
          }
        >
          {faites} / {demandees}
        </span>

        <button
          type="button"
          onClick={onAnimer}
          aria-label={`Animer ${pose.nom}`}
          title="ouvre l'écran qui commande un clip — l'image de départ y est déjà proposée"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          Animer ›
        </button>
      </div>

      {/* ── Une case par direction, sur le calque animé aussi (A12) ────────
          Même découpe que les images, et pour la même raison exactement : sans
          elle on ne saurait pas dire qu'il manque la marche vers le nord. */}
      {aDesDirections && (
        <ul className="flex flex-col border-t border-bord/60 bg-fond-1/40">
          {angles.map((angle) => (
            <SousLigneAnimee
              key={angle.identifiant}
              pose={pose}
              angle={angle}
              onAnimer={() => onAnimerDirection(angle.identifiant, angle.nom)}
              onMonter={onMonter}
              onOuvrir={onOuvrir}
              onDetacher={onDetacher}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Une case animée : **une pose dans une direction**, et ce qui la fait bouger.
 *
 *  Le pendant exact de `SousLigneDirection`, sans le rangement ni la
 *  confirmation d'angle : ranger une direction vaut pour la pose entière, les
 *  deux calques compris, et le geste vit sur celui des images. */
function SousLigneAnimee({
  pose,
  angle,
  onAnimer,
  onMonter,
  onOuvrir,
  onDetacher,
}: {
  pose: Pose
  angle: CaseDirection
  onAnimer: () => void
  onMonter: (clip: string) => void
  onOuvrir: (bande: string) => void
  onDetacher: (bande: string) => void
}) {
  // **Une seule bande remplit une case**, quel que soit le nombre d'images de
  // la pose : c'est la règle du calque, et elle est écrite là où elle se lit.
  const faite = angle.bandes.length >= 1

  return (
    <li className="flex min-h-[52px] items-center gap-3 border-t border-bord/40 px-1 py-1 pl-[26px]">
      <span className="w-[92px] shrink-0 truncate text-[11px] text-texte-3">
        {angle.nom}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {angle.bandes.map((bande) => (
          <VignetteDeBande
            key={bande.identifiant}
            bande={bande}
            pose={`${pose.nom} — ${angle.nom}`}
            onMonter={onMonter}
            onOuvrir={onOuvrir}
            onDetacher={onDetacher}
          />
        ))}
        {angle.bandes.length === 0 && (
          <span className="mesure text-[10px] text-texte-3">
            rien ne bouge encore
          </span>
        )}
      </div>

      <span
        className={[
          "mesure shrink-0 text-[9.5px]",
          faite ? "text-ancien-ok" : "text-texte-3",
        ].join(" ")}
      >
        {angle.bandes.length} / 1
      </span>

      <button
        type="button"
        onClick={onAnimer}
        aria-label={`Animer ${pose.nom} vers ${angle.nom}`}
        title="ouvre l'écran qui commande un clip — l'attitude et l'angle sont déjà visés"
        className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Animer ›
      </button>
    </li>
  )
}

/** Une animation dans une case de la matrice — **elle y tourne**, elle dit d'où
 *  elle vient, et elle se retire sans rien perdre (A12).
 *
 *  **Elle tourne pour de vrai, à la taille de la vignette.** Une image figée
 *  aurait montré la première pose de la bande et rien d'autre : on n'aurait pas
 *  vu la différence entre une animation juste et une animation dont l'ordre des
 *  images est faux. C'est très exactement ce qu'on vient voir ici.
 *
 *  **Le clip est nommé, et il est à un clic.** Une bande vient d'un clip qui a
 *  été payé une fois ; savoir lequel est ce qui permet d'en tirer une seconde
 *  bande plutôt que d'en commander un autre. */
function VignetteDeBande({
  bande,
  pose,
  onMonter,
  onOuvrir,
  onDetacher,
}: {
  bande: Bande
  pose: string
  onMonter: (clip: string) => void
  /** **Retravailler l'animation elle-même** (A7). */
  onOuvrir: (bande: string) => void
  onDetacher: (bande: string) => void
}) {
  return (
    <span className="group relative flex flex-col items-center gap-0.5">
      {/* **La vignette ouvre l'animation, son nom remonte au clip** (A7).
          Deux portes, et elles ne mènent pas au même endroit : l'une
          retravaille ce qui est gardé, l'autre retourne à la matière qui l'a
          fournie. ⚠️ Avant `A7` il n'y avait que la seconde, et c'était le
          défaut — une animation gardée ne se rouvrait par aucun chemin, si bien
          que corriger une virgule demandait de tout refaire de mémoire. */}
      <button
        type="button"
        onClick={() => onOuvrir(bande.identifiant)}
        aria-label={`Retravailler l'animation ${bande.nom}`}
        title="ouvre son atelier — ses images une par une, avec tous ses réglages"
        className="border border-transparent hover:border-ancien-signal"
      >
        <BandeQuiTourne
          bande={bande}
          cote={44}
          titre={`${bande.nom} — ${bande.compte} images, ${bande.cadence} par seconde`}
        />
      </button>
      <button
        type="button"
        onClick={() => onMonter(bande.clip)}
        aria-label={`Ouvrir le clip dont vient ${bande.nom}`}
        title="remonte au clip qui l'a fournie — il est payé, et il peut en donner d'autres"
        className="mesure w-[52px] truncate text-center text-[8.5px] text-texte-3 hover:text-ancien-signal"
      >
        {bande.nom}
      </button>
      <button
        type="button"
        onClick={() => onDetacher(bande.identifiant)}
        aria-label={`Retirer cette animation de la case ${pose}`}
        title="la bande et son clip restent — c'est la case qu'on vide"
        className="mesure absolute top-0 right-0 hidden bg-fond-0/80 px-1 text-[10px] text-texte-3 group-hover:block hover:text-ancien-echec"
      >
        ×
      </button>
    </span>
  )
}


/** Une image dans une case de la matrice — vignette, retrait, et **la barre
 *  d'espace**.
 *
 *  Elle existe pour la troisième de ces trois choses. La visée est un *hook*, et
 *  un hook ne s'appelle pas dans une boucle : sans ce composant, les vignettes
 *  de la matrice restaient le seul endroit du produit où l'on voyait une image
 *  en 44 px sans pouvoir la regarder en grand. Corrigé le 31 août 2026 (E0) —
 *  la barre d'espace ne connaît plus d'exception. */
function VignetteDeCase({
  asset,
  pose,
  retenu,
  concurrence,
  onDesigner,
  onFavori,
  onOuvrir,
}: {
  asset: Asset
  pose: string
  /** **C'est ce corps-là qui part en planche d'équipement**, et qui sort dans
   *  le jeu — dit par le serveur, jamais déduit ici. */
  retenu: boolean
  /** Cette attitude a-t-elle plus d'un corps ? La marque ne paraît que là. */
  concurrence: boolean
  onDesigner: (identifiant: string) => void
  onFavori: (identifiant: string) => void
  /** **Une case pleine ouvre son outil en plein cadre** (E2), sans quitter
   *  l'établi ni changer d'onglet. C'est la porte que les tables de E3
   *  franchiront ; d'ici là elle donne la recette, seul outil qui existe. */
  onOuvrir: (identifiant: string) => void
}) {
  const visee = useVisee(sujetAsset(asset))
  return (
    <span
      className="group relative"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <button
        type="button"
        onClick={() => onOuvrir(asset.identifiant)}
        aria-label={`Ouvrir ${asset.label} dans son outil`}
        title="l'outil s'ouvre en plein cadre, sans quitter l'établi"
        className="block"
      >
        <img
          src={sujetAsset(asset).src}
          alt={asset.label}
          className={[
            "damier h-[44px] w-[44px] object-contain",
            retenu && concurrence ? "outline outline-1 outline-ancien-signal" : "",
          ].join(" ")}
          style={{ imageRendering: "pixelated" }}
        />
      </button>
      {/* **Le coin est passé en haut, la croix en bas** — les deux marques se
          disputaient le même angle depuis que la première existe. L'ordre est
          celui du produit : le coin plein en cyan est en haut à droite sur
          toutes les tuiles de la galerie, et c'est lui qui ne peut pas
          déménager sans que la marque cesse d'être la même. */}
      <CoinFavori
        asset={asset}
        retenu={retenu}
        concurrence={concurrence}
        onBasculer={() => onFavori(asset.identifiant)}
      />
      <button
        type="button"
        onClick={() => onDesigner(asset.identifiant)}
        aria-label={`Retirer cette image de la case ${pose}`}
        title="l'image reste en bibliothèque — c'est la case qu'on vide"
        className="mesure absolute right-0 bottom-0 hidden bg-fond-0/80 px-1 text-[10px] text-texte-3 group-hover:block hover:text-ancien-echec"
      >
        ×
      </button>
    </span>
  )
}


/** Une attitude dans la colonne d'une pièce : ce que le calque a donné, ou ce
 *  qui l'empêche (US-141, US-143, US-147).
 *
 *  **Une pose sans corps est visiblement inéligible, et elle porte sa raison.**
 *  On ne paie jamais pour habiller une case vide : la coche est éteinte, la
 *  rangée est en `--texte-3`, et la phrase dit pourquoi. Le serveur refuserait
 *  de toute façon — c'est lui qui décide —, mais un refus qui n'arrive qu'après
 *  le clic est un refus qui arrive trop tard.
 *
 *  **Le calque se montre superposé à son corps** (US-143), en petit ici et en
 *  grand dans le panneau : on juge un résultat à l'œil, pas un chiffre. */
function LigneCalque({
  pose,
  piece,
  case_,
  cochee,
  onCocher,
  onOuvrir,
  onFavori,
  onArmer,
}: {
  pose: Pose
  piece: Piece
  case_: Case | undefined
  cochee: boolean
  onCocher: (veut: boolean) => void
  onOuvrir: (calque: string | null) => void
  onFavori: (identifiant: string) => void
  onArmer: () => void
}) {
  const corps = case_?.images.find((a) => a.identifiant === case_?.corps) ?? null
  const calques = case_?.calques[piece.identifiant] ?? []
  const habillable = Boolean(case_?.corps)
  // **Le retenu vient du serveur**, comme le corps de la case juste au-dessus.
  // Le calculer ici aurait fait une seconde règle à tenir d'accord avec celle
  // qui décide vraiment, à l'export.
  const retenu = case_?.retenus?.[piece.identifiant] ?? null
  const choisi = calques.find((a) => a.identifiant === retenu) ?? calques[0]

  return (
    <li
      className={[
        "flex min-h-[52px] items-center gap-3 border-b border-bord px-1 py-1",
        habillable ? "" : "text-texte-3",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={cochee && habillable}
        disabled={!habillable}
        onChange={(e) => onCocher(e.target.checked)}
        aria-label={`Habiller ${pose.nom} avec ${piece.nom}`}
        title={
          habillable
            ? "cochées ensemble, elles partent en une seule planche"
            : "cette attitude n'a pas encore de corps"
        }
        className="shrink-0 accent-ancien-signal disabled:opacity-40"
      />
      <span className="w-[110px] shrink-0 truncate text-[11.5px] text-texte-2">
        {pose.nom}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {calques.map((asset) => (
          <Superposition
            key={asset.identifiant}
            calque={asset}
            corps={corps}
            retenu={asset.identifiant === retenu}
            concurrence={calques.length > 1}
            onOuvrir={() => onOuvrir(asset.identifiant)}
            onFavori={() => onFavori(asset.identifiant)}
          />
        ))}
        {calques.length === 0 && (
          <span className="mesure text-[10px] text-texte-3">
            {habillable
              ? "rien encore"
              : `« ${pose.nom} » n'a pas encore de corps — une pièce se pose sur un corps`}
          </span>
        )}
      </div>

      {/* **Les mesures sont celles du calque retenu**, et non de la première
          image venue. Elles décrivaient jusqu'ici `calques[0]` — la plus
          récente, donc le retenu tant que personne ne marquait de favori. Dès
          qu'un favori plus ancien était posé, la rangée décrivait un calque et
          l'export en sortait un autre. Relevé le 4 septembre 2026. */}
      <MesuresDuCalque calque={choisi} />

      {/* **Armer, pas payer** — la règle de C1, telle quelle. Absent quand la
          pose n'a pas de corps : il n'y a pas de chose indisponible, il n'y a
          rien du tout. */}
      {habillable && (
        <button
          type="button"
          onClick={onArmer}
          aria-label={`Habiller ${pose.nom} de ${piece.nom}`}
          title="prépare la planche dans l'atelier — rien n'est dépensé ici"
          className="mesure shrink-0 px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          Habiller ›
        </button>
      )}
    </li>
  )
}

/** Le calque sur son corps, en vignette. **Les deux images ont les mêmes
 *  dimensions rendues** — c'est la différence qui les leur donne —, donc la
 *  superposition est exacte sans qu'aucune mise à l'échelle soit calculée ici.
 *
 *  Un corps habillé n'a pas de calque à superposer : il *est* l'image, et il se
 *  montre seul. C'est `recette.difference` qui les distingue, et rien d'autre. */
function Superposition({
  calque,
  corps,
  retenu,
  concurrence,
  onOuvrir,
  onFavori,
}: {
  calque: Asset
  corps: Asset | null
  /** **C'est celui-ci qui part dans le jeu**, dit par le serveur. */
  retenu: boolean
  /** Cette case a-t-elle plus d'un calque pour cette pièce ? La marque du
   *  retenu ne paraît **que** là : seule une case qui a le choix pose la
   *  question, et un liseré sur chaque vignette du produit aurait fait un
   *  ornement au lieu d'une réponse. */
  concurrence: boolean
  onOuvrir: () => void
  onFavori: () => void
}) {
  const dessus = sujetAsset(calque)
  const dessous = corps ? sujetAsset(corps) : null
  const empile = calque.recette.difference !== null
  // La barre d'espace montre **le calque seul**, pas la superposition : c'est ce
  // que le bouton nomme, et l'aperçu est la vignette en grand, jamais une
  // seconde composition. Ajouté le 31 août 2026 (E0).
  const visee = useVisee(dessus)
  return (
    <span
      className="group relative shrink-0"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <button
        type="button"
        onClick={onOuvrir}
        title={
          empile
            ? "voir le calque en grand, et borner sa zone"
            : "corps habillé — il s'exporte, il ne s'empile pas"
        }
        aria-label={`Ouvrir ${calque.label}`}
        className={[
          "damier relative block h-[44px] w-[44px]",
          retenu && concurrence ? "outline outline-1 outline-ancien-signal" : "",
        ].join(" ")}
      >
        {dessous && empile && (
          <img
            src={dessous.src}
            alt=""
            className="absolute inset-0 h-full w-full object-contain opacity-45"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        <img
          src={dessus.src}
          alt={calque.label}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </button>
      <CoinFavori
        asset={calque}
        retenu={retenu}
        concurrence={concurrence}
        onBasculer={onFavori}
      />
    </span>
  )
}

/** Le coin plein en cyan, **et il se pose d'un clic** (US-504).
 *
 *  **C'est la seule marque que l'auteur pose lui-même**, et elle a la même
 *  forme partout — la tuile de la galerie, le codex, et maintenant la matrice.
 *  Elle décide de ce qui part : `corps_retenu` lit le favori d'abord, le plus
 *  récent ensuite. La matrice était le dernier endroit où l'on voyait des
 *  images concurrentes sans pouvoir dire laquelle garder.
 *
 *  **Éteint, il ne paraît qu'au survol**, comme la croix juste en dessous :
 *  une case pleine de coins gris aurait fait passer une marque rare pour un
 *  décor de vignette. */
function CoinFavori({
  asset,
  retenu,
  concurrence,
  onBasculer,
}: {
  asset: Asset
  retenu: boolean
  concurrence: boolean
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-label={
        asset.favori
          ? `Retirer le favori de ${asset.label}`
          : `Garder ${asset.label}`
      }
      title={
        asset.favori
          ? "retirer la marque — la plus récente redeviendrait celle qui part"
          : concurrence
            ? retenu
              ? "c'est déjà elle qui part, parce qu'elle est la plus récente — la marquer la garde même après une autre"
              : "la garder : c'est elle qui partira dans le jeu, même si une autre est faite après"
            : "la garder : c'est elle qui partira dans le jeu"
      }
      className={[
        "absolute top-0 right-0 h-[14px] w-[14px]",
        asset.favori ? "" : "hidden group-hover:block",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-l-transparent",
          asset.favori ? "border-t-ancien-signal" : "border-t-texte-3/60",
        ].join(" ")}
      />
    </button>
  )
}

/** Ce que la différence a mesuré, en deux lignes sur la rangée de sa case.
 *
 *  **Elle ne paraît que s'il y a quelque chose à dire**, comme les mesures de
 *  lot juste en dessous : une colonne vide en permanence serait du cadrage
 *  affiché. Deux des cinq ici — celles qui décident —, les cinq dans le
 *  panneau : la rangée sert à repérer, le panneau à juger.
 *
 *  **Jamais un seuil, jamais une couleur.** `--echec` veut dire *ce qui échoue
 *  ou ce qui détruit*, et un calque qui a repeint 4 % du corps n'échoue pas : il
 *  est là, gardé, et c'est l'auteur qui décide. */
function MesuresDuCalque({ calque }: { calque: Asset | undefined }) {
  const mesures = calque?.calque
  if (!mesures) return null
  const difference = calque?.recette.difference ?? null
  const part = (valeur: number) => `${(valeur * 100).toFixed(1).replace(".", ",")} %`
  return (
    <span
      className="mesure shrink-0 text-right text-[9.5px] text-texte-3"
      title="mesuré au dépliage de la planche — ces chiffres n'empêchent jamais de garder"
    >
      <span className="block">
        repeint {part(mesures.repeint)} · ajout {part(mesures.ajout)}
      </span>
      <span className="block">
        échelle {mesures.echelle.toFixed(2).replace(".", ",")}× ·{" "}
        {difference ? "calque" : "corps habillé"}
      </span>
      {/* **La mesure qui décide de la place de cette rangée** (C4, US-152), et
          si la main y est passée. Deux faits sur la même ligne parce qu'ils
          répondent à la même question — *dois-je regarder celle-ci ?* — et que
          c'est très exactement ce que « par le pire » ordonne.

          Sur un corps habillé, rien : ce n'est pas un calque, il ne se retouche
          pas, et la ligne au-dessus a déjà dit pourquoi. */}
      {difference && (
        <span className="block">
          {difference.affinage.length || difference.retouche.length
            ? "main posée"
            : `à regarder · ${mesures.pire}`}
        </span>
      )}
    </span>
  )
}

/** Ressemblance et dérive, quand l'image de cette case est sortie d'une planche.
 *
 *  **Elle ne paraît que s'il y a quelque chose à dire** : la quasi-totalité des
 *  images du produit ne sortent d'aucun lot, et une colonne vide en permanence
 *  serait du cadrage affiché — le reproche qui a fait écarter la maquette.
 *
 *  Le jumeau est nommé, pas seulement compté : « ressemble à la case 3 » se
 *  vérifie d'un coup d'œil, « 0,98 » tout seul demande de chercher à quoi. */
function MesuresDuLot({ case_ }: { case_: Case | undefined }) {
  const lot = case_?.images.find((a) => a.lot)?.lot
  if (!lot) return null
  return (
    <span
      className="mesure shrink-0 text-right text-[9.5px] text-texte-3"
      title="mesuré au dépliage du lot — ces chiffres n'empêchent jamais de garder"
    >
      <span className="block">
        ressemblance {lot.ressemblance.toFixed(2)}
        {lot.jumeau >= 0 ? ` · case ${lot.jumeau + 1}` : ""}
      </span>
      <span className="block">
        grille {lot.grille_px || "—"} px · dérive {lot.derive.toFixed(2)}×
      </span>
    </span>
  )
}
