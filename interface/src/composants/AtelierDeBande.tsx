// -*- coding: utf-8 -*-
/** **L'atelier d'une animation gardée** (A7) — image par image.
 *
 *  > ### ⚠️ Une animation gardée était un cul-de-sac
 *  >
 *  > Le produit savait garder une animation avec tous ses réglages — le cadre,
 *  > la recette, la vitesse, le sens, ses images — et **ne savait pas la
 *  > rouvrir**. La vignette de la matrice remontait au *clip* : l'écran
 *  > repartait donc des réglages du jeu, et corriger une virgule demandait de
 *  > tout refaire de mémoire. Trouvé à l'usage par l'auteur le 4 septembre 2026.
 *
 *  **Ce n'est pas l'écran de montage, et le partage est net.** Le montage
 *  *taille un clip en animations* : on y choisit des images sur une pellicule.
 *  Celui-ci *retravaille une animation gardée* : on y corrige une image à la
 *  fois. Deux écrans parce que ce sont deux moments — on ne taille pas et on ne
 *  corrige pas avec la même main.
 *
 *  **Le châssis AU4** garde l'image au centre, le ruban en bas et un sélecteur
 *  de table fixe au-dessus du panneau de droite. La Main de chaque occurrence
 *  vient après son placement ; les anciennes recettes restent inchangées.
 *
 *  ## Ce qui n'est pas automatique, et pourquoi
 *
 *  Les corrections vivent d'abord à l'écran : l'aperçu se refait à chaque geste
 *  et **rien n'est écrit** tant que l'auteur n'a pas enregistré. C'est la règle
 *  déjà tenue par le montage — *c'est un bouton et pas un automatisme* —, et
 *  elle vaut double ici : une correction au pixel se tâtonne, et enregistrer à
 *  chaque flèche écrirait vingt planches pour un seul geste.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  api,
  type Ancrage,
  type Asset,
  type AtelierDeBande as AtelierRecu,
  type Bande,
  type CadrePose,
  type EtatTraitement,
  type Prise,
  type Recette,
  type Univers,
} from "../api"
import { rangDeLaBande } from "./Apercu"
import { Curseur, EnTetePanneau, Libelle } from "./pieces"
import { PANNEAU } from "./Infobulle"
import { avecPassage, avecVeille, dort, mainDe, OPACITE, placeDe, videe, type Table } from "../recette"
import { useHistoriqueDeBande, type EtatDeBande } from "./historiqueDeBande"
import { EcranDecoupe } from "./Decoupe"
import { SourceDeFrame } from "./SourceDeFrame"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { useEtatDuParcours } from "./MemoireDuParcours"
import { useMainDuParcours } from "./MainDuParcours"
import { EnregistrerSous, raisonDEnregistrerSous } from "./EnregistrerSous"
// **Les six postes viennent de la retouche** (`B26`). L'atelier d'une animation
// montait jusqu'ici les six panneaux de l'ancien châssis ; celui-ci s'en va, et
// refaire cet écran-là n'était pas dans le périmètre du déménagement. Il gagne
// au passage les moteurs de `B17` et `B18`, qui n'étaient jamais arrivés dans
// l'ancien panneau — c'est un gain de la tranche, pas un dommage collatéral.
import {
  Interrupteur,
  ReglagesDeLaGrille,
  ReglagesDesCouleurs,
  ReglagesDuContour,
  ReglagesDuDetourage,
  ReglagesDuNettoyage,
  ReglagesDuRecadrage,
  ReglagesDeLaMain,
  ReglagesDuRetournement,
  RemettreAZero,
  SelecteurDeTable,
  ToileDeLaMain,
  type Poste,
} from "./Retouche"

/** Les neuf points, **dans l'ordre où ils se dessinent** — trois par rangée.
 *  Les mots sont ceux du serveur, à la lettre : deux vocabulaires pour la même
 *  chose finiraient par ne plus désigner le même point. */
const ANCRAGES: readonly (readonly Ancrage[])[] = [
  ["haut-gauche", "haut", "haut-droite"],
  ["gauche", "centre", "droite"],
  ["bas-gauche", "bas", "bas-droite"],
]

/** Ce que chaque point veut dire en clair. Un carré de neuf cases sans un mot
 *  est un test de devinette : l'auteur doit savoir ce qu'il choisit avant de
 *  cliquer, pas après. */
const MOT_DE_L_ANCRAGE: Record<Ancrage, string> = {
  "haut-gauche": "accroché en haut à gauche",
  haut: "accroché en haut, centré",
  "haut-droite": "accroché en haut à droite",
  gauche: "accroché à gauche, à mi-hauteur",
  centre: "au milieu, dans les deux sens",
  droite: "accroché à droite, à mi-hauteur",
  "bas-gauche": "posé au sol, à gauche",
  bas: "posé au sol, centré — le défaut du produit",
  "bas-droite": "posé au sol, à droite",
}

/** D'où le rectangle vient. Les mots sont ceux du serveur, pour la même raison
 *  que les neuf points : deux vocabulaires finiraient par ne plus désigner la
 *  même mesure. */
const MOT_DU_CADRE: Record<string, string> = {
  clip: "pris sur le clip entier — toutes ses bandes ont la même assise",
  bande: "pris sur cette animation seule",
  main: "posé à la main",
}

/** Les places d'une recette, **dans l'ordre du traitement, et leur mot
 *  français**.
 *
 *  ⚠️ **La même liste vit sur le serveur** — `atelier/services/montage.py`,
 *  `PLACES_DE_LA_RECETTE` —, et `tests/test_v303.py` les tient ensemble. Deux
 *  endroits qui nomment les places finiraient par ne plus les nommer pareil, et
 *  c'est celui de l'écran qui mentirait le premier : c'est celui qu'on relit le
 *  moins.
 *
 *  **Pourquoi l'écran en a besoin, alors que la V3.03.1 s'en passait.** Le
 *  serveur dit ce que chaque frame écarte *de la bande* ; à partir de la
 *  V3.03.2 l'auteur choisit un sous-ensemble que le serveur ne connaît pas, et
 *  ce qui est **séparé à l'intérieur d'une sélection** n'est pas l'union des
 *  écarts à la bande — trois frames qui s'écartent toutes de la même façon sont
 *  d'accord entre elles. */
export const PLACES_DE_LA_RECETTE: readonly (readonly [keyof Recette, string])[] =
  [
    ["passes", "détourage"],
    ["recadrage", "recadrage"],
    ["grille", "grille"],
    ["quantification", "quantification"],
    ["bords", "bords"],
    ["contours", "contours"],
    // **Le retournement, en queue et avant la main** (B1) — voir le serveur.
    ["retournement", "retournement"],
    ["main", "la main"],
  ]

const memeValeur = (une: unknown, autre: unknown) =>
  JSON.stringify(une ?? null) === JSON.stringify(autre ?? null)

const estUnObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)

/** **Reporter sur `cible` ce qui a changé entre `avant` et `apres`** — et rien
 *  d'autre (V3.03.2).
 *
 *  > ### ⚠️ Poser une recette entière sur une sélection aplatit ce qu'elle avait
 *  >
 *  > Les tables rendent une recette complète à chaque geste : bouger un curseur
 *  > renvoie *toute* la recette de la frame qu'on regarde. L'écrire telle quelle
 *  > sur les cinq frames choisies leur donnerait aussi les quatre valeurs
 *  > qu'elles ne partageaient pas — **sans un mot**, et le plan l'interdit :
 *  > *rien ne se réécrit en silence*.
 *
 *  **C'est ce qui sépare une valeur d'une recette nommée.** Une valeur voyage
 *  seule ; une recette nommée remplace l'ensemble, parce qu'*en prendre la
 *  moitié rendrait une image que personne n'a jamais jugée* (`A7` bis ②). Les
 *  deux gestes existent à l'écran, et ils ne font pas la même chose.
 *
 *  **Une liste voyage entière**, comme une valeur simple : deux listes de passes
 *  n'ont ni la même longueur ni les mêmes moteurs, et il n'existe aucune
 *  correspondance terme à terme entre elles. Les objets, eux, se descendent
 *  place par place — changer le tramage ne doit pas emporter le nombre de
 *  couleurs. */
export function reporterLeChange<T>(cible: T, avant: T, apres: T): T {
  if (memeValeur(avant, apres)) return cible
  if (!estUnObjet(avant) || !estUnObjet(apres) || !estUnObjet(cible))
    return apres
  const rendu: Record<string, unknown> = { ...cible }
  for (const cle of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    rendu[cle] = reporterLeChange(
      (cible as Record<string, unknown>)[cle],
      avant[cle],
      apres[cle],
    )
  }
  return rendu as T
}

/** Les places sur lesquelles un lot de recettes **n'est pas d'accord**.
 *
 *  Le mot du plan est *séparé*, et il se lit sur la table : *ces images-là n'ont
 *  pas la même valeur ici*. Un lot d'une seule recette n'est séparé sur rien. */
export function placesSeparees(recettes: (Recette | null)[]): string[] {
  if (recettes.length < 2) return []
  const [premiere, ...autres] = recettes
  return PLACES_DE_LA_RECETTE.filter(([cle]) =>
    autres.some((une) => !memeValeur(une?.[cle], premiere?.[cle])),
  ).map(([, mot]) => mot)
}

/** **Une recette nommée ne remplace pas la main d'une image** (V3.03.2).
 *
 *  > ### ⚠️ Le sens du garde-fou est l'inverse de celui qu'on attend
 *  >
 *  > Le risque n'est pas qu'une recette nommée *propage* une retouche : elle
 *  > n'en porte jamais. Le serveur la lui retire au moment de l'enregistrer —
 *  > *un réglage voyage, une coordonnée ne voyage pas* (`U5`, `US-342`,
 *  > `atelier/domaine/recette.py`, `voyage`). Le risque est qu'elle **efface**
 *  > celle que l'image avait : « remplacer tout l'ensemble » remplacerait alors
 *  > des passages par du vide, sans un mot, et *rien ne se réécrit en silence*.
 *
 *  Un curseur des tables n'a pas ce défaut : `reporterLeChange` ne déplace que
 *  ce qui a changé, et aucune table de cet écran ne touche à la main. Ce
 *  garde-fou est donc **au seul endroit qui pose une recette entière**.
 *
 *  La Main finale d'AU4 vit séparément sur la prise. Le garde-fou reste requis
 *  pour les recettes individuelles historiques, qui pouvaient déjà en porter. */
const sansToucherALaMain = (rendue: Recette, dOrigine: Recette | null): Recette =>
  ({ ...rendue, main: dOrigine?.main ?? null })

/** Deux prises désignent-elles **la même image du même clip** ? Une prise sans
 *  clip nommé prend celui de la bande — c'est la règle du serveur, et la
 *  réécrire autrement ferait entrer deux fois la même image au chutier. */
const memeImage = (une: Prise, autre: Prise, clipDeLaBande: string) =>
  une.numero === autre.numero &&
  (une.clip || clipDeLaBande) === (autre.clip || clipDeLaBande)

/** **Mettre des images au chutier** (V3.03.3), sans jamais l'y écrire deux fois.
 *
 *  Le chutier est la réserve de la bande : les images retirées du ruban, et
 *  celles qu'on est allé chercher dans le clip. Une prise y arrive **entière** —
 *  sa recette individuelle comprise —, parce que la reposer trois gestes plus
 *  loin doit la rendre telle qu'elle était : *retirer puis remettre* n'est pas
 *  une façon d'effacer un réglage.
 *
 *  ⚠️ **Elle n'y entre qu'une fois.** La même image mise de côté deux fois
 *  ferait deux vignettes identiques dans une réserve qu'on lit d'un coup d'œil,
 *  et il faudrait choisir laquelle poser. La dernière venue gagne : c'est celle
 *  dont on vient de décider, et elle porte les réglages les plus récents.
 *
 *  Écrite ici et employée aussi par le montage, qui repose un découpage sur une
 *  animation gardée — **deux règles pour le même fait finiraient par ne pas
 *  ranger pareil**. */
export function auChutier(
  chutier: Prise[],
  emportees: Prise[],
  clipDeLaBande: string,
): Prise[] {
  const rendu = [...chutier]
  for (const prise of emportees) {
    const deja = rendu.findIndex((une) => memeImage(une, prise, clipDeLaBande))
    if (deja >= 0) rendu[deja] = prise
    else rendu.push(prise)
  }
  return rendu
}

/** **Reposer un découpage sur une animation déjà gardée** (V3.03.3).
 *
 *  C'est ce que « Reprendre le montage » écrit au retour : le montage ne connaît
 *  que des **numéros d'image**, l'animation porte des **prises** — d'où elles
 *  viennent, de combien elles sont poussées, et leur recette à elles.
 *
 *  > ### ⚠️ Une recette individuelle voyage avec sa prise
 *  >
 *  > Une image qu'on garde retrouve **sa** prise, poussée et recette comprises :
 *  > passer par le montage pour ajouter une image ne doit pas défaire les
 *  > réglages posés sur les onze autres. Et une image que le nouveau découpage
 *  > laisse tombe **au chutier** au lieu de disparaître — changer d'avis sur une
 *  > image ne doit pas effacer ce qu'on avait réglé dessus.
 *
 *  Une image demandée deux fois — le geste *dupliquer* — reçoit la prise
 *  d'origine une fois et une prise neuve ensuite : c'est la même image, et rien
 *  ne dit que la seconde copie doit hériter d'une correction au pixel posée sur
 *  la première.
 *
 *  > ### ⚠️ Le chutier est cherché lui aussi, et ce qu'on y prend en sort
 *  >
 *  > Une image mise de côté que le montage reprend revenait **neuve** : sans sa
 *  > poussée, sans sa recette — et elle restait au chutier par-dessus le marché,
 *  > si bien que le ruban la jouait pendant que la réserve proposait encore de
 *  > la poser. C'est très exactement ce à quoi le chutier sert, et la reprise
 *  > était le seul chemin qui le contournait. Vu au navigateur le 5 septembre
 *  > 2026, sur l'atelier jetable de la tranche. */
export function remonterLaBande(
  bande: Bande,
  clip: string,
  retenues: number[],
  occurrences?: (string | undefined)[],
): { prises: Prise[]; chutier: Prise[] } {
  const restantes = [...bande.prises]
  const reserve = [...bande.chutier]
  const chercher = (ou: Prise[], numero: number, identifiant?: string) => {
    const la = ou.findIndex(
      (prise) => prise.numero === numero && (prise.clip || bande.clip) === clip && (!identifiant || prise.identifiant === identifiant),
    )
    return la < 0 ? undefined : ou.splice(la, 1)[0]
  }
  const prises = retenues.map(
    (numero, index) =>
      chercher(restantes, numero, occurrences?.[index]) ??
      chercher(reserve, numero, occurrences?.[index]) ?? { numero, clip: "", dx: 0, dy: 0, ...(occurrences?.[index] ? { identifiant: occurrences[index] } : {}) },
  )
  return { prises, chutier: auChutier(reserve, restantes, bande.clip) }
}

export function EcranAtelierDeBande({
  identifiant,
  univers,
  traitement,
  onFermer,
  onErreur,
  onChangee,
  onReprendreLeMontage,
}: {
  identifiant: string
  /** La palette du jeu et ses couleurs nommées — ce que la quantification et
   *  les contours lisent pour proposer autre chose qu'un nuancier vide. */
  univers: Univers
  /** Ce que la machine sait faire : quels moteurs de détourage répondent,
   *  quelles réductions sont disponibles, et **la raison de chaque grisé**.
   *  Il vient de l'écran d'accueil, comme pour l'établi. */
  traitement: EtatTraitement
  onFermer: () => void
  onErreur: (raison: string) => void
  /** L'animation a changé sur le disque — la matrice et la galerie l'affichent
   *  aussi, et une vignette qui montrerait l'ancienne planche serait un
   *  mensonge silencieux. */
  onChangee?: () => void
  /** **Rouvrir le montage sur cette animation** (V3.03.3) — avec ses images
   *  retenues et ses réglages, pour en changer la sélection.
   *
   *  L'atelier ne l'ouvre pas lui-même : le montage prend la place de cet
   *  écran-ci, comme cet écran-ci prend celle de la matrice, et c'est celui qui
   *  tient les deux qui décide lequel est à l'écran. Absent, le bouton ne
   *  paraît pas. */
  onReprendreLeMontage?: (bande: Bande) => void
}) {
  const [recu, setRecu] = useState<AtelierRecu | null>(null)
  const [prises, setPrises] = useState<Prise[]>([])
  /** **La réserve de la bande** (V3.03.3) : les images retirées du ruban et
   *  celles qu'on est allé chercher dans le clip, pas encore posées.
   *
   *  ⚠️ **Elle se garde avec la bande**, à la différence de la sélection : ce
   *  qu'on a mis de côté est une intention qui survit à la fermeture de
   *  l'atelier — sans quoi il faudrait retrouver l'image dans la pellicule à
   *  chaque visite, ce qui est très exactement le geste qu'elle évite. */
  const [chutier, setChutier] = useState<Prise[]>([])
  /** La pellicule du clip est-elle ouverte au milieu de l'écran ? Elle prend la
   *  place de l'image en grand — *on ne pose pas un écran sur un écran*. */
  const [auClip, setAuClip] = useState(false)
  const [recette, setRecette] = useState<Recette | null>(null)
  const [cadence, setCadence] = useState(8)
  const [sens, setSens] = useState<"boucle" | "aller-retour">("boucle")
  const [courante, setCourante] = useEtatDuParcours(`bande:${identifiant}:frame`, 0)
  /** **Les images que les tables règlent** (V3.03.2) — rangs triés, jamais vide,
   *  et `courante` en fait toujours partie.
   *
   *  Elle appartient au parcours de cette session, jamais à la bande écrite.
   *  Revenir de sa fiche retrouve la sélection ; aucune requête d’export ou
   *  de sauvegarde ne la transforme en propriété de l’animation. */
  const [selection, setSelection] = useEtatDuParcours<number[]>(`bande:${identifiant}:selection`, [0])
  const [pelure, setPelure] = useState(0)
  const [joue, setJoue] = useEtatDuParcours(`bande:${identifiant}:lecture`, true)
  const [pas, setPas] = useState(0)
  const [planche, setPlanche] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)
  const [remesure, setRemesure] = useState(false)
  const [recettes, setRecettes] = useState<Record<string, Recette>>({})
  /** **Ce que chaque frame écarte de la bande, à l'instant qu'on regarde**
   *  (V3.03.1). Il vient de l'aperçu et non de l'ouverture : l'ouverture dit
   *  l'état du disque, et entre deux enregistrements le ruban doit suivre ce
   *  qu'on vient de régler. Les mots des places sont ceux du serveur — deux
   *  vocabulaires des mêmes places finiraient par ne plus les nommer pareil. */
  const [ecarts, setEcarts] = useState<
    { places: string[]; fenetre_davant: boolean }[]
  >([])
  /** **Le zoom de la frame** (V3.03.1). `null` veut dire *ajusté* — le facteur
   *  qui fait tenir la pose entière —, et c'est l'état d'ouverture : on regarde
   *  d'abord la pose, on s'en approche ensuite.
   *
   *  ⚠️ **Il compte en facteurs entiers, pas en pour cent**, et il ne réemploie
   *  donc pas la commande des tables. Deux raisons, et elles vont ensemble :
   *  la règle de cet écran est *au plus proche voisin et à facteur entier* —
   *  un sprite à 1,5× rend des pixels de deux tailles, ce que personne n'a
   *  dessiné —, et l'échelle des tables s'arrête à 250 %, où une case de 64 px
   *  ferait 160 px de large : plus petit que ce que l'écran montre déjà. Le
   *  même geste, la même barre, une échelle qui convient à ce qu'on regarde. */
  const [zoom, setZoom] = useEtatDuParcours<number | null>(`bande:${identifiant}:zoom`, null)
  const [table, setTable] = useEtatDuParcours<Table>(`bande:${identifiant}:table`, "detourage")
  const [panneau, setPanneau] = useEtatDuParcours<"retouche" | "calques">(`bande:${identifiant}:panneau`, "retouche")
  const [passeArmee, setPasseArmee] = useState<number | null>(null)
  const [rectangleSource, setRectangleSource] = useState(false)
  const [decoupe, setDecoupe] = useState<Asset | null>(null)
  /** **Enregistrer sous** (`RP20`) — la fenêtre qui demande la case d'arrivée.
   *  Elle emporte le ruban tel qu'il est sous les doigts : une image retirée ou
   *  dupliquée doit l'être dans ce qui sort. */
  const [enregistrerSous, setEnregistrerSous] = useState(false)
  const [preleve, setPreleve] = useState(false)
  const [messageDecoupe, setMessageDecoupe] = useState("")
  const etatMain = useMainDuParcours(`bande:${identifiant}:main`, univers)
  const framePeinte = useRef(0)
  const toile = useRef<HTMLDivElement | null>(null)
  const espace = useRef<HTMLDivElement | null>(null)
  const facteurVue = useRef(1)
  const [surface, setSurface] = useState({ largeur: 420, hauteur: 420 })
  const [deplacementVue, setDeplacementVue] = useState(false)
  const pan = useRef<{ x: number; y: number; gauche: number; haut: number } | null>(null)
  const restaurer = useCallback((etat: EtatDeBande) => {
    setJoue(false)
    setPrises(etat.prises)
    setChutier(etat.chutier)
    setRecette(etat.recette)
    setCadence(etat.cadence)
    setSens(etat.sens)
  }, [])
  const historique = useHistoriqueDeBande(identifiant, recu !== null, { prises, chutier, recette, cadence, sens }, restaurer)
  const brouillon = useBrouillonLocal<EtatDeBande>({
    cle: `bande:${recu?.bande.projet ?? ""}:${identifiant}`, pret: recu !== null,
    reference: { prises: recu?.bande.prises ?? [], chutier: recu?.bande.chutier ?? [], recette: recu?.bande.recette ?? null, cadence: recu?.bande.cadence ?? 8, sens: recu?.bande.sens ?? "boucle" },
    etat: { prises, chutier, recette, cadence, sens }, appliquer: restaurer,
    ecran: "L’atelier d’une animation", quoi: recu?.bande.nom || identifiant,
  })
  useEffect(() => {
    const element = espace.current
    if (!element) return
    const mesurer = () => { if (element.clientWidth && element.clientHeight) setSurface({ largeur: element.clientWidth, hauteur: element.clientHeight }) }
    const mesure = new ResizeObserver(mesurer)
    mesure.observe(element)
    mesurer()
    const molette = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setZoom(Math.max(1, Math.min(32, facteurVue.current + (event.deltaY < 0 ? 1 : -1))))
    }
    element.addEventListener("wheel", molette, { passive: false })
    return () => { mesure.disconnect(); element.removeEventListener("wheel", molette) }
  }, [recu?.bande.identifiant, auClip])
  useEffect(() => {
    const debut = (event: KeyboardEvent) => {
      if (event.code !== "Space" || (event.target as HTMLElement)?.closest("input, textarea, select, button, [contenteditable=true]")) return
      event.preventDefault(); setDeplacementVue(true)
    }
    const fin = () => { setDeplacementVue(false); pan.current = null }
    const relache = (event: KeyboardEvent) => { if (event.code === "Space") fin() }
    window.addEventListener("keydown", debut); window.addEventListener("keyup", relache); window.addEventListener("blur", fin)
    return () => { window.removeEventListener("keydown", debut); window.removeEventListener("keyup", relache); window.removeEventListener("blur", fin) }
  }, [])

  // **Dire une panne ne doit pas relancer l'aperçu.** L'écran d'accueil passe
  // une fonction neuve à chaque rendu ; la laisser dans les dépendances ferait
  // repartir la demande d'aperçu à chaque rendu de l'écran au-dessus, pour un
  // geste que l'auteur n'a pas fait.
  const direPanne = useRef(onErreur)
  direPanne.current = onErreur

  // ── Ouvrir ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        const ouvert = await api.ouvrirLaBande(identifiant)
        if (!vivant) return
        setRecu(ouvert)
        setPrises(ouvert.bande.prises)
        setChutier(ouvert.bande.chutier ?? [])
        setRecette(ouvert.bande.recette)
        setCadence(ouvert.bande.cadence)
        setSens(ouvert.bande.sens)
        setPlanche(ouvert.planche)
        setEcarts(ouvert.ecarts ?? [])
      } catch (erreur) {
        if (vivant) direPanne.current((erreur as Error).message)
      }
    })()
    return () => {
      vivant = false
    }
  }, [identifiant])

  // **Les recettes enregistrées, lues une fois.** Elles vivent sur le disque et
  // ne changent pas pendant qu'on corrige une animation ; les redemander à
  // chaque geste serait un aller-retour pour rien. Un échec ne dit rien à
  // l'écran : sans recettes nommées, le bloc ne paraît simplement pas.
  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        const lues = await api.recettesNommees()
        if (vivant) setRecettes(lues.recettes)
      } catch {
        /* pas de recette nommée : le bloc ne paraît pas */
      }
    })()
    return () => {
      vivant = false
    }
  }, [])

  // ── Ce qui a bougé depuis l'ouverture ─────────────────────────────────────
  //
  // Comparé au départ et non compté au fil de l'eau : pousser une image puis la
  // repousser dans l'autre sens ne laisse **rien** à enregistrer, et un compteur
  // qui monterait à deux mentirait sur ce qu'il reste à faire.
  const change = useMemo(() => {
    if (!recu) return false
    return (
      JSON.stringify(prises) !== JSON.stringify(recu.bande.prises) ||
      JSON.stringify(chutier) !== JSON.stringify(recu.bande.chutier ?? []) ||
      JSON.stringify(recette) !== JSON.stringify(recu.bande.recette) ||
      cadence !== recu.bande.cadence ||
      sens !== recu.bande.sens
    )
  }, [recu, prises, chutier, recette, cadence, sens])

  // ── L'aperçu, refait à chaque geste et **sans rien écrire** ───────────────

  useEffect(() => {
    if (!recu || prises.length === 0) return
    let vivant = true
    // Un petit délai, parce que les flèches se tiennent enfoncées : sans lui,
    // une pression continue enverrait une demande par répétition du clavier.
    const minuteur = window.setTimeout(() => {
      void (async () => {
        try {
          const apercu = await api.apercuDeBande({
            clip: recu.bande.clip,
            prises,
            recette,
            cadre: recu.bande.cadre,
          })
          if (!vivant) return
          setPlanche(apercu.planche)
          // Le ruban suit ce qu'on vient de régler, pas ce qui est sur le
          // disque : l'aperçu est le seul appel qui reparte à chaque geste.
          if (apercu.ecarts_des_frames) setEcarts(apercu.ecarts_des_frames)
        } catch (erreur) {
          if (vivant) direPanne.current((erreur as Error).message)
        }
      })()
    }, 120)
    return () => {
      vivant = false
      window.clearTimeout(minuteur)
    }
  }, [recu, prises, recette])

  // ── Le lecteur ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!joue || prises.length < 2 || cadence <= 0) return
    const minuteur = window.setInterval(
      () => setPas((p) => p + 1),
      1000 / cadence,
    )
    return () => window.clearInterval(minuteur)
  }, [joue, prises.length, cadence])

  // Arrêté, on regarde l'image choisie ; en marche, celle du cycle. Le rang du
  // cycle est calculé par la **même** règle que partout ailleurs.
  const rang = joue
    ? rangDeLaBande(pas, prises.length, sens)
    : Math.min(courante, Math.max(0, prises.length - 1))

  // ── Les gestes ────────────────────────────────────────────────────────────
  //
  // ⚠️ **On corrige l'image qu'on regarde**, et il a fallu l'écrire exprès :
  // l'animation tourne à l'ouverture, donc la première flèche arrive pendant que
  // les images défilent. Sans cette ligne, elle poussait la *première* image de
  // la bande — celle que l'auteur ne regardait pas —, l'animation s'arrêtait
  // ailleurs, et la correction se voyait sur une pose au hasard. Vu à l'écran le
  // 5 septembre 2026, sur l'atelier jetable de la tranche.
  const affichee = useRef(0)
  affichee.current = rang

  const corriger = useCallback(
    (change: (prise: Prise) => Prise) => {
      const cible = affichee.current
      setJoue(false)
      setCourante(cible)
      // **Et le ruban suit la flèche.** Sans cette ligne, pousser une image
      // pendant que l'animation tourne laissait la sélection là où elle était :
      // les tables réglaient une frame, la fiche en montrait une deuxième et le
      // liseré du ruban en marquait une troisième. Une flèche désigne une image
      // aussi clairement qu'un clic — elle doit la choisir pareil. Vu au
      // navigateur le 5 septembre 2026, sur l'atelier jetable de la tranche.
      setSelection([cible])
      setPrises((avant) =>
        avant.map((prise, index) => (index === cible ? change(prise) : prise)),
      )
    },
    [],
  )

  const pousser = useCallback(
    (dx: number, dy: number) =>
      corriger((prise) => ({ ...prise, dx: prise.dx + dx, dy: prise.dy + dy })),
    [corriger],
  )

  // ── La recette d'une frame (V3.03.1) ──────────────────────────────────────
  //
  // **Elle naît au premier réglage touché**, et pas avant : tant que personne
  // n'a rien changé sur cette image-là, elle suit la bande — c'est ce qui fait
  // qu'une bande d'avant la tranche se rouvre sans que rien ne migre.
  //
  // Elle passe par `corriger`, comme la poussée au pixel, et pour la même
  // raison : *on corrige l'image qu'on regarde*. Régler pendant que l'animation
  // tourne poserait sinon le réglage sur une pose au hasard.

  /** **La frame que les tables règlent : celle qu'on a choisie**, et non celle
   *  qui passe.
   *
   *  > ### ⚠️ Un panneau qui clignote onze fois par seconde
   *  >
   *  > Les tables ont d'abord suivi l'image *affichée*, par analogie avec les
   *  > flèches. Lecteur en marche, le titre, la phrase d'écart et le bouton
   *  > « reprendre la recette » apparaissaient et disparaissaient à la cadence
   *  > de l'animation — onze fois par seconde sur cette bande-ci. On ne clique
   *  > pas un bouton qui s'en va, et on ne lit pas un panneau qui bat. Vu au
   *  > navigateur le 5 septembre 2026, sur une bande dont une seule frame
   *  > s'écartait ; aucun essai ne pouvait le voir, ils lisent un instant.
   *
   *  **Les deux gestes n'ont pas le même temps, et c'est ce qui les sépare.**
   *  Une flèche est instantanée : on regarde l'image, on pousse, ça tombe là où
   *  l'œil était — c'est la règle d'`A7`, et elle ne bouge pas. Une table se
   *  *lit* avant d'être touchée, et lire prend plus longtemps qu'une image de
   *  l'animation. Elle suit donc la frame **choisie** — le mot du plan —, qui ne
   *  change que sur un clic dans le ruban, lequel arrête le lecteur. */
  const choisie = Math.min(courante, Math.max(0, prises.length - 1))
  const reglee = prises[choisie]?.recette ?? recette

  /** Corriger **la frame choisie** — pour les gestes qu'on lit avant de les
   *  faire.
   *
   *  > ### ⚠️ La fiche disait « l'image choisie » et en changeait une autre
   *  >
   *  > La fiche de la frame passait par `corriger`, comme les flèches : lecteur
   *  > en marche, elle décrivait l'image *qui passe*. On choisissait l'image 14,
   *  > la fiche montrait l'image 10, et taper un numéro remplaçait la 10. La
   *  > phrase « cette image a sa recette à elle » désignait, elle aussi, une
   *  > image au hasard. Vu au navigateur le 5 septembre 2026.
   *
   *  Le partage est celui des tables, et pour la même raison : **remplacer une
   *  prise se lit d'abord** — quel clip, quel numéro, ce que la frame va perdre
   *  — et lire prend plus longtemps qu'une image de l'animation. Les flèches,
   *  elles, gardent la règle d'`A7` et tombent sur ce que l'œil regardait ;
   *  elles emmènent le ruban avec elles, si bien qu'après la première poussée
   *  les deux désignent la même image. */
  const corrigerLaChoisie = useCallback(
    (change: (prise: Prise) => Prise) => {
      setJoue(false)
      setPrises((avant) =>
        avant.map((prise, index) => (index === choisie ? change(prise) : prise)),
      )
    },
    [choisie],
  )

  const remettreDroit = useCallback(
    () => corrigerLaChoisie((prise) => ({ ...prise, dx: 0, dy: 0 })),
    [corrigerLaChoisie],
  )

  /** **Changer l'image d'une frame** — et sa recette individuelle ne suit pas
   *  (V3.03.3).
   *
   *  > ### ⚠️ Une retouche mentirait sur une autre image
   *  >
   *  > Une recette individuelle a été posée *en regardant celle-là* : un point
   *  > de pipette, un cadre tracé, un passage de la main désignent un endroit de
   *  > cette image-ci, et l'image 22 n'a pas le bras au même endroit que la 21.
   *  > La transporter donnerait un réglage que personne n'a jamais jugé, et il
   *  > se verrait à l'export.
   *
   *  La frame revient donc à la recette de l'animation, et **l'écran le dit
   *  avant** — sous le contrôle qui remplace, quand la frame en a une à perdre.
   *  C'est la même règle que le lot `U` tient pour une recette qui voyage, prise
   *  par l'autre bout : là-bas la recette change d'image, ici c'est l'image qui
   *  change sous la recette. */
  const remplacer = useCallback(
    (numero: number, clip: string) =>
      corrigerLaChoisie((prise) =>
        prise.numero === numero && prise.clip === clip
          ? prise
          : { ...prise, numero, clip, recette: null, main_apres_placement: null },
      ),
    [corrigerLaChoisie],
  )

  // ── Une image, plusieurs, ou toutes (V3.03.2) ─────────────────────────────

  /** Les rangs réellement choisis — bornés à ce que la bande porte, et **jamais
   *  vides** : sans image choisie, les tables régleraient le néant. */
  const choisies = useMemo(() => {
    const dans = selection.filter((rang) => rang < prises.length)
    return dans.length > 0 ? dans : [choisie]
  }, [selection, prises.length, choisie])

  const plusieurs = choisies.length > 1
  /** **Toute la bande est choisie**, et ce cas-là ne se pose pas comme les
   *  autres : voir `poserSurLaSelection`. */
  const toutes = prises.length > 0 && choisies.length === prises.length

  /** Ce sur quoi les images choisies **ne sont pas d'accord**. Les tables le
   *  disent place par place, et la phrase du haut une fois pour le lot. */
  const separes = useMemo(
    () => placesSeparees(choisies.map((rang) => prises[rang]?.recette ?? recette)),
    [choisies, prises, recette],
  )

  /** Combien d'images choisies ont déjà **leur recette à elles** — le nombre que
   *  la phrase du lot annonce, une fois et pas trente. */
  const siennes = choisies.filter((rang) => Boolean(prises[rang]?.recette)).length

  const laFrameAAuMine = useCallback(
    (index: number) => Boolean(prises[index]?.recette),
    [prises],
  )

  // **Cliquer une image arrête le lecteur ; changer l'étendue du choix, non.**
  // La règle est simple à tenir et à expliquer : ce qui change l'image sous les
  // yeux arrête l'animation, ce qui ne change que la portée des tables la
  // laisse tourner.

  const choisirUne = useCallback((rang: number) => {
    setJoue(false)
    setCourante(rang)
    setSelection([rang])
  }, [])

  /** Étendre depuis l'image des tables jusqu'à celle qu'on clique. L'ancre ne
   *  bouge pas : c'est elle qu'on lit pendant qu'on étend. */
  const etendreJusqua = useCallback(
    (rang: number) => {
      setJoue(false)
      const [debut, fin] = courante <= rang ? [courante, rang] : [rang, courante]
      setSelection(Array.from({ length: fin - debut + 1 }, (_, i) => debut + i))
    },
    [courante],
  )

  const basculerUne = useCallback(
    (rang: number) => {
      setJoue(false)
      if (!choisies.includes(rang)) {
        setCourante(rang)
        setSelection([...choisies, rang].sort((a, b) => a - b))
        return
      }
      const reste = choisies.filter((autre) => autre !== rang)
      // **Jamais vide** — retirer la dernière laisserait les tables sans rien à
      // régler, et un panneau qui ne règle rien est un panneau cassé.
      if (reste.length === 0) return
      setSelection(reste)
      if (rang === courante) setCourante(reste[0])
    },
    [choisies, courante],
  )

  const choisirToutes = useCallback(
    () => setSelection(prises.map((_, rang) => rang)),
    [prises],
  )

  const nEnChoisirQuUne = useCallback(
    () => setSelection([choisie]),
    [choisie],
  )

  /** **Poser une valeur sur toutes les images choisies** (V3.03.2), et rien que
   *  cette valeur — `reporterLeChange` dit pourquoi.
   *
   *  ⚠️ **Toute la bande choisie se règle sur la bande**, pas image par image.
   *  Douze recettes individuelles identiques annonceraient douze écarts là où il
   *  n'y en a aucun : le ruban se couvrirait de liserés, et « reprendre la
   *  recette de l'animation » n'aurait plus rien à reprendre. */
  const poserSurLaSelection = useCallback(
    (apres: Recette) => {
      const avant = reglee
      if (!avant) return
      setJoue(false)
      if (toutes)
        setRecette((laBande) =>
          laBande ? reporterLeChange(laBande, avant, apres) : apres,
        )
      setPrises((liste) =>
        liste.map((prise, rang) => {
          // ⚠️ **Les recettes individuelles suivent quand même.** Sans cette
          // ligne, un curseur posé sur les douze n'en bougerait que neuf, et les
          // trois qui s'écartaient l'ignoreraient sans un mot — un curseur qui
          // bouge sans que l'image change ne se distingue pas d'un curseur cassé.
          if (toutes)
            return prise.recette
              ? {
                  ...prise,
                  recette: reporterLeChange(prise.recette, avant, apres),
                }
              : prise
          if (!choisies.includes(rang)) return prise
          // La recette individuelle naît d'une **copie** de celle de la bande —
          // la règle de la V3.03.1, et elle vaut pour chaque image du lot.
          const sienne = prise.recette ?? recette
          return sienne
            ? { ...prise, recette: reporterLeChange(sienne, avant, apres) }
            : prise
        }),
      )
    },
    [reglee, toutes, choisies, recette],
  )

  /** **Poser une recette nommée**, qui remplace tout l'ensemble (`A7` bis ②).
   *
   *  C'est l'autre geste, et il ne fait pas ce que fait le précédent : une
   *  valeur voyage seule, une recette nommée remplace. Sur toute la bande, elle
   *  devient la recette de l'animation **et efface les recettes individuelles** —
   *  ce sont elles qu'elle remplace, et les garder au-dessus reviendrait à ne
   *  rien remplacer du tout. C'est ce que la phrase du lot annonce avant. */
  const poserLaRecetteNommee = useCallback(
    (nommee: Recette) => {
      setJoue(false)
      if (toutes) {
        setRecette((laBande) => sansToucherALaMain(nommee, laBande))
        setPrises((liste) => liste.map((prise) => ({
          ...prise,
          recette: prise.recette?.main ? sansToucherALaMain(nommee, prise.recette) : null,
        })))
        return
      }
      setPrises((liste) =>
        liste.map((prise, rang) =>
          choisies.includes(rang)
            ? {
                ...prise,
                recette: sansToucherALaMain(nommee, prise.recette ?? recette),
              }
            : prise,
        ),
      )
    },
    [toutes, choisies, recette],
  )

  /** Rendre les images choisies au défaut. **Un geste annulable comme les
   *  autres** : il n'écrit rien, il repose `null`, et « Annuler » ramène ce
   *  qu'il y avait. */
  const reprendreLaRecetteDeLaBande = useCallback(() => {
    setJoue(false)
    setPrises((liste) =>
      liste.map((prise, rang) =>
        choisies.includes(rang) ? { ...prise, recette: null } : prise,
      ),
    )
  }, [choisies])

  // ── Le ruban se monte (V3.03.3) ───────────────────────────────────────────
  //
  // **Une bande gardée n'est pas un tirage figé** : on retire, on duplique, on
  // déplace, on va chercher une image de plus dans le clip. Les quatre gestes
  // passent par la même porte, et aucun n'écrit avant « Enregistrer ».

  const clipDeLaBande = recu?.bande.clip ?? ""
  const imagesMax = recu?.images_max ?? 64
  const [premiereChoisie] = choisies

  /** **La seule porte par laquelle l'ordre du ruban change.**
   *
   *  Elle prend le nouvel ordre sous la forme *d'où vient chaque image* —
   *  `venu` est son rang d'avant, `-1` pour une image qui n'était pas dans la
   *  bande — et elle emmène avec elle ce que le serveur avait dit de chaque
   *  frame.
   *
   *  ⚠️ **Sans ce transport, les liserés glissent d'un cran.** Les écarts sont
   *  indexés par rang ; retirer la deuxième image sans les déplacer ferait
   *  porter à la troisième ce que la quatrième écartait, jusqu'à ce que
   *  l'aperçu réponde — cent vingt millisecondes plus tard, et *pendant qu'on
   *  regarde le résultat de son geste*. Une image neuve, elle, attend l'aperçu :
   *  ce qu'elle écarte est une phrase, et **les mots des places viennent du
   *  serveur** — les écrire ici serait le second vocabulaire que la V3.03.1
   *  s'est employée à ne pas fabriquer. */
  const remonterLeRuban = useCallback(
    (
      ordre: { prise: Prise; venu: number }[],
      suite?: { chutier?: Prise[]; choix?: number[] },
    ) => {
      setJoue(false)
      setPrises(ordre.map((o) => o.prise))
      setEcarts((avant) =>
        ordre.map(
          (o) =>
            (o.venu >= 0 ? avant[o.venu] : undefined) ?? {
              places: [],
              fenetre_davant: false,
            },
        ),
      )
      if (suite?.chutier) setChutier(suite.chutier)
      if (suite?.choix?.length) {
        setSelection(suite.choix)
        setCourante(suite.choix[0])
      }
    },
    [],
  )

  /** Retirer les images choisies — **elles vont au chutier, pas au néant**.
   *
   *  Fermé quand tout est choisi : une bande garde au moins une image, et le
   *  serveur le refuserait de toute façon — le dire ici évite de découvrir le
   *  refus après une minute de travail. */
  const retirer = useCallback(() => {
    if (choisies.length >= prises.length) return
    const partent = new Set(choisies)
    const ordre = prises
      .map((prise, rang) => ({ prise, venu: rang }))
      .filter((o) => !partent.has(o.venu))
    const apres = Math.min(premiereChoisie, ordre.length - 1)
    remonterLeRuban(ordre, {
      chutier: auChutier(
        chutier,
        choisies.map((rang) => prises[rang]),
        clipDeLaBande,
      ),
      choix: [Math.max(0, apres)],
    })
  }, [choisies, premiereChoisie, prises, chutier, clipDeLaBande, remonterLeRuban])

  /** Dupliquer les images choisies — **la copie se pose juste après l'original**,
   *  et elle emporte sa recette : c'est la même image.
   *
   *  Ce sont **les copies qui restent choisies**. Elles sont ce qu'on vient de
   *  faire, et laisser le choix sur les originales ferait paraître le liseré
   *  glisser d'un cran vers la gauche au moment précis où le ruban s'allonge. */
  const dupliquer = useCallback(() => {
    if (prises.length + choisies.length > imagesMax) return
    const copiees = new Set(choisies)
    const ordre: { prise: Prise; venu: number }[] = []
    const neuves: number[] = []
    prises.forEach((prise, rang) => {
      ordre.push({ prise, venu: rang })
      if (!copiees.has(rang)) return
      neuves.push(ordre.length)
      // `venu` reste celui de l'original : la copie porte la même recette, donc
      // le même écart, et le liseré paraît avec elle plutôt qu'à l'aperçu
      // suivant.
      ordre.push({ prise: { ...prise, identifiant: crypto.randomUUID() }, venu: rang })
    })
    remonterLeRuban(ordre, { choix: neuves })
  }, [choisies, prises, imagesMax, remonterLeRuban])

  /** Sortir les images choisies et les reposer à la place `ou` **de ce qui
   *  reste**.
   *
   *  Compter la place dans ce qui reste plutôt que dans le ruban entier est ce
   *  qui rend le geste juste quand le choix n'est pas d'un seul tenant : les
   *  images choisies se regroupent là où on les pose, ce qui est la seule
   *  réponse qu'on puisse expliquer en une phrase. */
  const deplacerVers = useCallback(
    (ou: number) => {
      const bougent = new Set(choisies)
      const restants = prises
        .map((prise, rang) => ({ prise, venu: rang }))
        .filter((o) => !bougent.has(o.venu))
      const partants = choisies.map((rang) => ({ prise: prises[rang], venu: rang }))
      const place = Math.max(0, Math.min(restants.length, ou))
      remonterLeRuban(
        [...restants.slice(0, place), ...partants, ...restants.slice(place)],
        { choix: partants.map((_, rang) => place + rang) },
      )
    },
    [choisies, prises, remonterLeRuban],
  )

  /** Où les images choisies se tiennent **dans ce qui reste** — le point de
   *  départ des deux boutons, et de rien d'autre. */
  const placeDuChoix = useMemo(
    () =>
      prises.filter(
        (_, rang) => rang < premiereChoisie && !choisies.includes(rang),
      ).length,
    [prises, premiereChoisie, choisies],
  )

  /** Déposer le choix **avant l'image sur laquelle on lâche**. Lâcher sur une
   *  image choisie ne fait rien : on ne se dépose pas sur soi-même. */
  const deposerSur = useCallback(
    (rang: number) => {
      if (choisies.includes(rang)) return
      deplacerVers(prises.filter((_, r) => r < rang && !choisies.includes(r)).length)
    },
    [choisies, prises, deplacerVers],
  )

  /** Poser une image du chutier **avant ou après la frame choisie**, et l'en
   *  sortir : une image est dans la bande ou au chutier, jamais dans les deux.
   *
   *  ⚠️ **Elle se pose à côté de la frame *choisie*, pas de celle qui passe.**
   *  C'est la règle de la V3.03.1 reprise ici : le lecteur peut tourner pendant
   *  qu'on travaille, et une insertion qui viserait l'image affichée tomberait
   *  à un rang tiré au sort par le métronome. */
  const insererDuChutier = useCallback(
    (rang: number, ou: "avant" | "apres") => {
      const prise = chutier[rang]
      if (!prise) return
      if (prises.length + 1 > imagesMax) return
      const place = Math.min(prises.length, ou === "avant" ? choisie : choisie + 1)
      const ordre = prises.map((une, r) => ({ prise: une, venu: r }))
      ordre.splice(place, 0, { prise, venu: -1 })
      remonterLeRuban(ordre, {
        chutier: chutier.filter((_, r) => r !== rang),
        choix: [place],
      })
    },
    [chutier, prises, choisie, imagesMax, remonterLeRuban],
  )

  /** **Prendre des images dans le clip** — elles entrent au chutier, et rien du
   *  ruban ne bouge. Le geste est celui du montage vu de l'autre côté : là-bas
   *  on taille, ici on va chercher ce qui manque. */
  const prendreAuClip = useCallback(
    (numeros: number[]) => {
      setChutier((avant) =>
        auChutier(
          avant,
          numeros.map((numero) => ({ numero, clip: "", dx: 0, dy: 0 })),
          clipDeLaBande,
        ),
      )
      setAuClip(false)
    },
    [clipDeLaBande],
  )

  /** Ce que le chutier laisse tomber sans qu'on le repose. **Un geste qui ne
   *  perd rien** : l'image est dans le clip, elle s'y reprend. */
  const viderDuChutier = useCallback(
    (rang: number) => setChutier((avant) => avant.filter((_, r) => r !== rang)),
    [],
  )

  /** Ce que les tables de l'établi attendent pour se rendre sur cette frame.
   *
   *  ⚠️ **`regler` et `poser` font ici la même chose**, et c'est la seule
   *  différence de fond avec l'établi. Là-bas, `regler` bouge la valeur à
   *  l'écran et `poser` l'envoie au serveur ; ici **rien ne part avant
   *  « Enregistrer »**, donc les deux posent dans l'état local et l'aperçu se
   *  refait tout seul. Une table qui écrirait en passant serait le seul geste
   *  de l'écran à ne pas s'annuler.
   *
   *  `mesures` est `null` et le reste : les taches et les poches se mesurent
   *  sur **un asset**, et une frame de bande n'en est pas un. Les postes sont
   *  écrits pour ce cas — *on ne grise pas sur une ignorance* —, et ils se
   *  taisent alors sur ce qu'ils ne savent pas au lieu de l'inventer.
   *
   *  Les panneaux sont ceux de l'image. La Main reçoit une recette d'affichage
   *  indépendante : ses gestes écrivent main_apres_placement sur une seule prise. */
  const poste: Poste | null = reglee
    ? {
        recette: reglee,
        univers,
        traitement,
        regler: poserSurLaSelection,
        poser: poserSurLaSelection,
        mesures: null,
        ouvrir: setTable,
        etatMain,
        armee: passeArmee,
        onArmer: (passe) => { setJoue(false); setCourante(choisie); setSelection([choisie]); setPasseArmee(passe); setRectangleSource(false) },
      }
    : null

  const annuler = useCallback(() => {
    if (!recu) return
    setPrises(recu.bande.prises)
    setChutier(recu.bande.chutier ?? [])
    setEcarts(recu.ecarts ?? [])
    setRecette(recu.bande.recette)
    setCadence(recu.bande.cadence)
    setSens(recu.bande.sens)
  }, [recu])

  const enregistrer = useCallback(async () => {
    if (!recu) return
    setEnregistre(true)
    try {
      await api.corrigerLaBande(recu.bande.identifiant, {
        prises,
        chutier,
        recette,
        cadence,
        sens,
      })
      // On repart de ce que le serveur a **vraiment** écrit, pas de ce qu'on
      // croyait envoyer : la poussée est bornée là-bas, donc une correction
      // poussée hors de la case revient corrigée — et c'est ce qu'il faut voir.
      //
      // Rouvrir plutôt que garder la bande rendue, parce qu'un détourage changé
      // périme la fenêtre commune : c'est le serveur qui sait le dire, et un
      // écran qui l'annoncerait encore à jour serait un mensonge silencieux.
      const ouvert = await api.ouvrirLaBande(recu.bande.identifiant)
      setRecu(ouvert)
      setPrises(ouvert.bande.prises)
      setChutier(ouvert.bande.chutier ?? [])
      setPlanche(ouvert.planche)
      setEcarts(ouvert.ecarts ?? [])
      onChangee?.()
      brouillon.effacer()
    } catch (erreur) {
      onErreur((erreur as Error).message)
    } finally {
      setEnregistre(false)
    }
  }, [recu, prises, chutier, recette, cadence, sens, onChangee, onErreur])

  useEffect(() => {
    const clavier = (event: KeyboardEvent) => {
      if (decoupe) return
      if (!(event.ctrlKey || event.metaKey)) return
      if ((event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true]")) return
      const touche = event.key.toLowerCase()
      if (touche === "s") { event.preventDefault(); if (!enregistre && change) void enregistrer() }
      if (touche === "z") { event.preventDefault(); if (event.shiftKey) historique.refaire(); else historique.defaire() }
      if (touche === "y") { event.preventDefault(); historique.refaire() }
    }
    window.addEventListener("keydown", clavier)
    return () => window.removeEventListener("keydown", clavier)
  }, [historique, enregistrer, enregistre, change, decoupe])

  // ── Reprendre la fenêtre commune ──────────────────────────────────────────
  //
  // **Le seul geste de cet écran qui écrit sans passer par « Enregistrer »**, et
  // c'est pourquoi il est fermé tant que des corrections attendent : mesurer
  // avec la recette du disque puis écrire par-dessus des réglages en cours
  // laisserait la bande à moitié neuve, ce que le critère interdit.
  const reprendreLeCadre = useCallback(async () => {
    if (!recu) return
    setRemesure(true)
    try {
      await api.reprendreLeCadreDeLaBande(recu.bande.identifiant)
      const ouvert = await api.ouvrirLaBande(recu.bande.identifiant)
      setRecu(ouvert)
      setPrises(ouvert.bande.prises)
      setChutier(ouvert.bande.chutier ?? [])
      setPlanche(ouvert.planche)
      setEcarts(ouvert.ecarts ?? [])
      onChangee?.()
    } catch (erreur) {
      onErreur((erreur as Error).message)
    } finally {
      setRemesure(false)
    }
  }, [recu, onChangee, onErreur])

  // ── Le clavier ────────────────────────────────────────────────────────────

  useEffect(() => {
    const ecouter = (evenement: KeyboardEvent) => {
      const dans = toile.current
      if (!dans || !dans.contains(document.activeElement)) return
      const pasDuGeste = evenement.shiftKey ? 5 : 1
      const gestes: Record<string, [number, number]> = {
        ArrowLeft: [-pasDuGeste, 0],
        ArrowRight: [pasDuGeste, 0],
        ArrowUp: [0, -pasDuGeste],
        ArrowDown: [0, pasDuGeste],
      }
      const geste = gestes[evenement.key]
      if (!geste) return
      evenement.preventDefault()
      pousser(geste[0], geste[1])
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [pousser])

  if (!recu || !planche) {
    return (
      <div
        data-atelier-de-bande
        className="mesure flex h-full items-center justify-center text-[11px] text-encre-3"
      >
        on rouvre l'animation…
      </div>
    )
  }

  const bande = recu.bande
  const compte = prises.length
  const large = bande.case_largeur || 64
  const haut = bande.case_hauteur || 64
  // Au plus proche voisin et à facteur entier : un sprite lissé n'est plus un
  // sprite, et un facteur fractionnaire déforme ses pixels carrés.
  const ajuste = Math.max(1, Math.floor(Math.min(surface.hauteur / haut, surface.largeur / large)))
  const facteur = zoom ?? ajuste
  facteurVue.current = facteur

  if (decoupe) return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center justify-between border-b border-trait p-[8px] text-[12px]"><span>Découpe de {decoupe.label}</span><button type="button" onClick={() => setDecoupe(null)}>‹ {bande.nom}</button></div>
    <EcranDecoupe sujet={{ famille: "planche", planche: decoupe, onDecoupe: (nees) => { setMessageDecoupe(`${nees.length} image${nees.length > 1 ? "s" : ""} ajoutée${nees.length > 1 ? "s" : ""} à la bibliothèque.`); setDecoupe(null); onChangee?.() } }} onFermer={() => setDecoupe(null)} onFente={(fente) => { if (fente?.ton === "echec") onErreur(String(fente.texte)) }} />
  </div>

  return (
    <div
      data-atelier-de-bande={bande.identifiant}
      className="atelier-animation-unifie grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] grid-rows-[auto_minmax(0,1fr)_auto] gap-[14px] bg-papier p-[14px]"
    >
      <header className="col-span-2 flex min-w-0 items-center justify-between gap-[22px]">
        <div className="min-w-0"><h1 className="truncate font-serif text-[25px] text-encre">{bande.nom}</h1><p className="mt-[4px] text-[12px] text-encre-3">Animation · {compte} frames · {change ? "Brouillon de retouche" : "Version enregistrée"}</p></div>
        <div className="flex shrink-0 items-center gap-[8px]"><button type="button" onClick={onFermer} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre-controle">‹ Animations</button><button type="button" onClick={() => void enregistrer()} disabled={!change || enregistre} className="h-[34px] rounded-7 bg-signal px-[14px] text-[12px] text-encre-sur-signal disabled:opacity-50">{enregistre ? "on enregistre…" : "Enregistrer ›"}</button><button type="button" title={raisonDEnregistrerSous(recette) ?? "Le résultat devient une autre pose ou direction"} disabled={!!raisonDEnregistrerSous(recette)} onClick={() => { setJoue(false); setEnregistrerSous(true) }} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre-controle disabled:opacity-50">Enregistrer sous…</button></div>
      </header>
      {/* ── Les tables de la frame choisie ───────────────────────────────── */}
      <aside
        {...PANNEAU}
        className="col-start-2 row-start-2 row-span-2 flex min-h-0 flex-col gap-[14px] rounded-8 border border-trait bg-carte p-[14px]"
      >
        <h2 className="font-serif text-[25px] text-encre">Le résultat</h2>
        <div className="flex gap-[4px] rounded-7 bg-papier-cote p-[4px]">{(["retouche", "calques"] as const).map((nom) => <button key={nom} type="button" aria-pressed={panneau === nom} onClick={() => { setPanneau(nom); if (nom === "calques") { setTable("main"); setSelection([choisie]) } }} className={`h-[30px] flex-1 rounded-7 px-[8px] text-[12px] ${panneau === nom ? "bg-carte text-encre" : "text-encre-3"}`}>{nom === "retouche" ? "Retouche" : "Calques"}</button>)}</div>

        <AvisBrouillon brouillon={brouillon} />
        {panneau === "retouche" && <SelecteurDeTable table={table} onTable={(suivante) => { setTable(suivante); setPasseArmee(null); setRectangleSource(false); if (suivante === "main") setSelection([choisie]) }} />}
        {/* **La bascule et la remise à zéro de l'établi, posées contre la
            même table** (RP22) : avant, ni l'une ni l'autre n'existaient ici,
            et un réglage raté sur une frame ne se rattrapait qu'en refermant
            l'atelier sans enregistrer. Absentes pour les deux fabriques —
            elles n'ont pas de place dans la recette. */}
        {panneau === "retouche" && poste && placeDe(table) !== null && (
          <div className="flex shrink-0 items-center gap-[8px]">
            <RemettreAZero onClick={() => void poste!.poser(videe(poste!.recette, table))} />
            <Interrupteur
              endormie={dort(poste.recette, table)}
              onBasculer={() =>
                void poste!.poser(avecVeille(poste!.recette, table, !dort(poste!.recette, table)))
              }
            />
          </div>
        )}
        <div className="order-last flex shrink-0 flex-wrap gap-[8px] border-t border-trait pt-[14px] text-[12px]">
          <button type="button" disabled={preleve} onClick={async () => {
            setJoue(false); setCourante(rang); setPreleve(true)
            try { const recu = await api.preleverFrameDeBande(bande.identifiant, rang, { prises, recette: recette! }); const image = recu.asset ?? recu.doublon; if (image) setDecoupe(image) }
            catch (e) { onErreur((e as Error).message) } finally { setPreleve(false) }
          }} className="rounded-7 border border-trait px-[8px] py-[4px]">{preleve ? "Préparation…" : "Découper cette frame"}</button>
          {table === "recadrage" && <button type="button" onClick={() => { setJoue(false); setCourante(choisie); setSelection([choisie]); setRectangleSource(true); setPasseArmee(null) }} className="rounded-7 border border-trait px-[8px] py-[4px]">Tracer le recadrage sur la source</button>}
        </div>
        {messageDecoupe && <p role="status" className="text-[12px] text-encre-3">{messageDecoupe}</p>}
        <label className="flex items-center gap-[8px] text-[12px] text-encre-3">Appliquer à
          <select aria-label="Portée des réglages" value={table === "main" ? "frame" : toutes ? "bande" : plusieurs ? "selection" : "frame"}
            disabled={table === "main"} onChange={(event) => event.target.value === "bande" ? choisirToutes() : event.target.value === "frame" ? nEnChoisirQuUne() : undefined}
            className="h-[30px] min-w-0 flex-1 rounded-7 border border-trait bg-carte px-[8px] text-encre">
            <option value="frame">Frame {choisie + 1}</option>
            <option value="selection" disabled={!plusieurs}>Sélection ({choisies.length})</option>
            <option value="bande">Animation entière ({prises.length})</option>
          </select>
        </label>
        <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto">

        <details className="order-last text-[12px] text-encre-3"><summary className="cursor-pointer">Portée et héritage de la recette</summary><p className="mt-[8px] text-[12px] leading-relaxed text-encre-3">
          {compte} image{compte > 1 ? "s" : ""}, {cadence} par seconde —{" "}
          {(Math.max(1, sens === "aller-retour" && compte > 1 ? compte * 2 - 2 : compte) / cadence).toFixed(2)} s par tour.{" "}
          {/* **Ce que règlent les tables, en une phrase et à chaque fois.** Trois
              portées possibles — une image, un lot, l'animation entière — et
              rien d'autre à l'écran ne les distingue : la même colonne, les
              mêmes curseurs. Sans cette phrase, un réglage posé sur douze images
              ressemble trait pour trait à un réglage posé sur une. */}
          {table === "main" ? <span>La Main corrige une seule frame à la fois.</span> : plusieurs ? (
            toutes ? (
              <>
                Les <b className="text-encre-2">{compte} images</b> sont
                choisies : ce qui se règle ici vaut pour toute l'animation.
              </>
            ) : (
              <>
                <b className="text-encre-2">{choisies.length} images</b>{" "}
                choisies : ce qui se règle ici se pose sur les{" "}
                {choisies.length}.
              </>
            )
          ) : laFrameAAuMine(choisie) ? (
            <>
              L'image {choisie + 1} a <b className="text-encre-2">sa recette à
              elle</b> : ce qui se règle ici ne vaut que pour elle.
            </>
          ) : (
            <>
              L’image {choisie + 1} hérite de la recette de l’animation.
              Toucher un réglage crée une correction pour cette frame seulement.
            </>
          )}
        </p></details>

        <details className="order-last border-t border-trait pt-[8px] text-[12px] text-encre-3"><summary className="cursor-pointer">Recettes réutilisables</summary><RecetteEnregistree
          recettes={recettes}
          choisies={choisies.length}
          siennes={siennes}
          toutes={toutes}
          onRecette={poserLaRecetteNommee}
        /></details>

        <ReglagesDeLaFrame
          table={table}
          poste={poste}
          sienne={laFrameAAuMine(choisie)}
          ancre={choisie + 1}
          choisies={choisies.length}
          siennes={siennes}
          separes={separes}
          ecart={ecarts[choisie]}
          onReprendre={reprendreLaRecetteDeLaBande}
        />

        {table === "main" && reglee && <div className="flex flex-col gap-[14px]">
          <p className="text-[12px] leading-relaxed text-encre-3">{panneau === "calques" ? `Les calques appartiennent à la frame ${choisie + 1}.` : "Peignez directement sur l’image ; la lecture s’arrête au début du trait."}</p>
          <ReglagesDeLaMain {...poste!} section={panneau === "calques" ? "calques" : "peinture"} etatMain={etatMain} recette={{ ...reglee, main: prises[choisie]?.main_apres_placement ?? null }}
            poser={(suivante) => { setJoue(false); setPrises((liste) => liste.map((prise, index) => index === choisie ? { ...prise, main_apres_placement: suivante.main } : prise)) }}
            regler={(suivante) => { setJoue(false); setPrises((liste) => liste.map((prise, index) => index === choisie ? { ...prise, main_apres_placement: suivante.main } : prise)) }} />
        </div>}
        {table === "retournement" && poste && <ReglagesDuRetournement {...poste} />}

        {/* **Le titre dit les trois gestes, plus le mot qui les nommait mal**
            (RP22) : « Position, source et pelure d'oignon » ne disait ni ce
            que la section faisait ni comment s'en servir — trois mots de
            jargon sans un verbe. Les trois verbes du plan, dans l'ordre où ils
            paraissent dessous. */}
        <details className="border-t border-trait pt-[14px]">
          <summary className="cursor-pointer text-[13px] text-encre-2">Déplacer, remplacer, voir en transparence</summary>
          <CorrectionDeLImage prise={prises[choisie]} clipDeLaBande={bande.clip} imagesParClip={recu.images_par_clip}
            voisins={recu.clips_voisins} melangee={bande.melangee} pelure={pelure} onPelure={setPelure} onRemplacer={remplacer} onRemettreDroit={remettreDroit} />
        </details>

        {change && (
          <div className="flex flex-col gap-1.5 border-t border-trait pt-2">
            <p className="mesure text-[10px] leading-4 text-signal">
              des corrections attendent — rien n'est écrit tant que vous n'avez
              pas enregistré
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={annuler}
                className="mesure border border-trait px-2 py-1 text-[10px] text-encre-3 hover:text-encre"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
        </div>
      </aside>

      {/* ── La frame en grand, avec le zoom des tables ─────────────────────
          … ou la pellicule du clip quand on va y chercher une image (V3.03.3).
          **Elle prend la place, elle ne se pose pas dessus** : c'est la
          profondeur suivante du même endroit, comme le montage prend celle de
          la grille. Le ruban et le chutier restent visibles à droite —
          justement ce qu'on regarde pendant qu'on choisit. */}
      {auClip ? (
        <div className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden"><PelliculeDuClip
          clip={bande.clip}
          images={recu.images_par_clip[bande.clip] ?? 0}
          contact={recu.contact}
          deja={[
            ...prises.filter((p) => !p.clip || p.clip === bande.clip),
            ...chutier.filter((p) => !p.clip || p.clip === bande.clip),
          ].map((p) => p.numero)}
          onPrendre={prendreAuClip}
          onFermer={() => setAuClip(false)}
        /></div>
      ) : (
      <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col gap-[8px] overflow-hidden">
        <div className="flex shrink-0 items-center gap-[8px]"><button type="button" onClick={historique.defaire} disabled={!historique.peutDefaire} title="Ctrl + Z" className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 disabled:opacity-50">Défaire</button><button type="button" onClick={historique.refaire} disabled={!historique.peutRefaire} title="Ctrl + Maj + Z" className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 disabled:opacity-50">Refaire</button><span className="ml-auto text-[12px] text-encre-3">Frame {rang + 1} / {compte} · {large} × {haut} px</span></div>
        {(passeArmee !== null || rectangleSource) && reglee && prises[choisie] ? <SourceDeFrame
          source={api.imageDuClip(prises[choisie].clip || bande.clip, prises[choisie].numero)} recette={reglee} passe={passeArmee} rectangle={rectangleSource}
          onRecette={(suite) => corrigerLaChoisie((prise) => ({ ...prise, recette: suite }))} onFermer={() => { setPasseArmee(null); setRectangleSource(false) }} /> : <>
        <ZoomDeLaFrame
          facteur={facteur}
          ajuste={ajuste}
          surMesure={zoom !== null}
          onZoom={setZoom}
        />

        <div ref={espace} data-vue-de-la-frame className="defile flex min-h-0 min-w-0 flex-1 items-start justify-start overflow-auto rounded-7 border border-trait bg-pourtour"
          onPointerDownCapture={(event) => {
            if (!deplacementVue && event.button !== 1) return
            event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
            pan.current = { x: event.clientX, y: event.clientY, gauche: event.currentTarget.scrollLeft, haut: event.currentTarget.scrollTop }
          }}
          onPointerMoveCapture={(event) => { if (!pan.current) return; event.stopPropagation(); event.currentTarget.scrollLeft = pan.current.gauche - event.clientX + pan.current.x; event.currentTarget.scrollTop = pan.current.haut - event.clientY + pan.current.y }}
          onPointerUpCapture={(event) => { if (!pan.current) return; event.stopPropagation(); pan.current = null }}>
        <div className="m-auto shrink-0">
        <CaseEnGrand
          ref={toile}
          planche={planche}
          rang={rang}
          precedent={rang > 0 ? rang - 1 : compte - 1}
          compte={compte}
          large={large}
          haut={haut}
          facteur={facteur}
          pelure={pelure}
          onPousser={pousser}
          main={table === "main" && reglee ? <ToileDeLaMain
            asset={{ identifiant: bande.identifiant, empreinte: "", label: `${bande.nom} · frame ${rang + 1}`, largeur: large, hauteur: haut, rendu_largeur: large, rendu_hauteur: haut }}
            avant={false} etat={etatMain}
            rendu={<span aria-hidden className="absolute inset-0" style={{ backgroundImage: `url(${planche})`, backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`, backgroundPosition: `-${rang * large * facteur}px 0`, imageRendering: "pixelated" }} />}
            onDebut={() => { framePeinte.current = rang; setJoue(false); setCourante(rang); setSelection([rang]) }}
            onPassage={(trait) => setPrises((liste) => liste.map((prise, index) => {
              if (index !== framePeinte.current) return prise
              const main = mainDe({ ...reglee, main: prise.main_apres_placement ?? null })
              const actif = etatMain.actif === OPACITE || main.calques[etatMain.actif] ? etatMain.actif : OPACITE
              return { ...prise, main_apres_placement: avecPassage(main, actif, trait) }
            }))}
          /> : undefined}
        />
        </div></div>
        <p className="text-[11px] text-encre-3">Ctrl + molette : zoom · Espace + glisser ou bouton central : déplacer la vue</p>
        </>}
      </div>
      )}

      {/* ── Ses images, et le lecteur sous elles ─────────────────────────── */}
      <aside
        {...PANNEAU}
        className="atelier-timeline col-start-1 row-start-3 flex max-h-[300px] min-h-0 min-w-0 flex-col gap-[8px] overflow-y-auto"
      >
        <Lecteur joue={joue} onJoue={setJoue} cadence={cadence} onCadence={setCadence} rang={rang} compte={compte} />
        <div className="flex items-baseline gap-[8px]">
          <span className="text-[12px] text-encre-3">Frames de l’animation</span>
          {/* **Les deux boutons du choix** (V3.03.2). Ils sont là pour le
              clavier autant que pour la souris : la maj-clic et le ctrl-clic
              existent, mais aucun des deux ne se fait sans souris, et *tout se
              fait au clavier autant qu'à la souris* est un critère de la
              version. Ils ne touchent pas au lecteur — ils changent la portée
              des tables, pas l'image sous les yeux. */}
          <button
            type="button"
            onClick={choisirToutes}
            disabled={toutes}
            className="mesure ml-auto text-[10px] text-encre-3 hover:text-signal disabled:text-eteint"
          >
            toutes
          </button>
          {plusieurs && (
            <button
              type="button"
              onClick={nEnChoisirQuUne}
              className="mesure text-[10px] text-encre-3 hover:text-signal"
            >
              une seule
            </button>
          )}
        </div>

        {/* **Le montage du ruban** (V3.03.3) — une bande gardée n'est pas un
            tirage figé. Les quatre gestes sont des boutons et pas seulement des
            raccourcis : le glissement fait la même chose à la souris, mais
            *tout se fait au clavier autant qu'à la souris* est un critère de la
            version, et les flèches sont déjà prises par la poussée au pixel. */}
        <MontageDuRuban
          choisies={choisies.length}
          compte={compte}
          place={placeDuChoix}
          restants={compte - choisies.length}
          plafond={imagesMax}
          onRetirer={retirer}
          onDupliquer={dupliquer}
          onDeplacer={deplacerVers}
        />

        <div className="defile flex shrink-0 gap-[8px] overflow-x-auto p-[8px]">
          {prises.map((prise, index) => (
            <ImageDeLaBande
              key={prise.identifiant || `${prise.clip}-${prise.numero}-${index}`}
              prise={prise}
              index={index}
              planche={planche}
              large={large}
              haut={haut}
              compte={compte}
              courante={index === rang}
              choisie={choisies.includes(index)}
              venueDAilleurs={Boolean(prise.clip) && prise.clip !== bande.clip}
              ecart={ecarts[index]}
              onChoisir={(comment) =>
                comment === "etendre"
                  ? etendreJusqua(index)
                  : comment === "ajouter"
                    ? basculerUne(index)
                    : choisirUne(index)
              }
              onPrendreEnMain={() => {
                if (!choisies.includes(index)) choisirUne(index)
              }}
              onDeposer={() => deposerSur(index)}
            />
          ))}
        </div>

        <details className="px-[8px]"><summary className="cursor-pointer text-[12px] text-encre-3">Chutier · {chutier.length} image{chutier.length > 1 ? "s" : ""}</summary><LeChutier
          chutier={chutier}
          clipDeLaBande={bande.clip}
          contact={recu.contact}
          imagesParClip={recu.images_par_clip}
          ancre={choisie + 1}
          plein={compte >= imagesMax}
          onInserer={insererDuChutier}
          onVider={viderDuChutier}
          onAllerAuClip={() => setAuClip(true)}
        /></details>

        {/* **Les réglages de l'animation restent avec jouer et pause** —
            tranché avec l'auteur le 5 septembre 2026. La vitesse, le sens, la
            fenêtre et l'ancrage décrivent la bande entière, pas l'image qu'on
            corrige : les laisser à gauche, sous un titre qui dit « la recette
            de cette image », aurait fait croire qu'on règle une pose alors
            qu'on règle les douze. */}
        <details className="shrink-0 border-t border-trait p-[8px]"><summary className="cursor-pointer text-[12px] text-encre-3">Animation · boucle, repère et fenêtre commune</summary>
        <div className="flex flex-col gap-[14px] pt-[8px]">
          {onReprendreLeMontage && (
            <RepriseDuMontage
              melangee={bande.melangee}
              bloquee={change}
              onReprendre={() => onReprendreLeMontage(bande)}
            />
          )}

          <ReglagesDeLaBande sens={sens} onSens={setSens} />

          <ChoixDeLAncrage
            ancrage={recette?.grille?.ancrage ?? "bas"}
            onAncrage={(point) =>
              setRecette((avant) =>
                avant?.grille
                  ? { ...avant, grille: { ...avant.grille, ancrage: point } }
                  : avant,
              )
            }
          />

          <FenetreDeLaBande
            cadre={bande.cadre}
            etat={recu.cadre}
            enCours={remesure}
            bloquee={change}
            onReprendre={() => void reprendreLeCadre()}
          />
        </div></details>
      </aside>
      {/* **La fenêtre d'Enregistrer sous…** (`RP20`). Elle emporte la recette et
          le ruban en cours : ce qui sort est ce que l'écran montre, y compris
          avant d'avoir enregistré. */}
      {enregistrerSous && (
        <EnregistrerSous
          quoi="animation"
          identifiant={bande.identifiant}
          recette={recette}
          prises={prises}
          onFermer={() => setEnregistrerSous(false)}
          onFait={() => onChangee?.()}
        />
      )}
    </div>
  )
}

/** L'image en grand, **avec la précédente en transparence dessous**.
 *
 *  La pelure d'oignon est le geste que l'animation demande depuis toujours :
 *  juger un déplacement au lieu de le deviner. Elle est **réglable et éteinte
 *  par défaut** — allumée d'office, elle ferait croire à un défaut de rendu sur
 *  la première ouverture. */
const CaseEnGrand = (() => {
  function Rendu(
    {
      planche,
      rang,
      precedent,
      compte,
      large,
      haut,
      facteur,
      pelure,
      onPousser,
      main,
    }: {
      planche: string
      rang: number
      precedent: number
      compte: number
      large: number
      haut: number
      facteur: number
      pelure: number
      onPousser: (dx: number, dy: number) => void
      main?: React.ReactNode
    },
    ref: React.Ref<HTMLDivElement>,
  ) {
    const depart = useRef<{ x: number; y: number } | null>(null)

    const fond = (place: number) => ({
      width: large * facteur,
      height: haut * facteur,
      backgroundImage: `url(${planche})`,
      backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`,
      backgroundPosition: `-${place * large * facteur}px 0`,
      imageRendering: "pixelated" as const,
    })

    return (
      <div
        ref={ref}
        tabIndex={0}
        data-case-en-grand={rang}
        role="application"
        aria-label="l'image à corriger — les flèches la déplacent d'un pixel"
        title="cliquez, puis les flèches — Maj pour cinq pixels à la fois"
        className="relative cursor-move border border-trait bg-pourtour outline-none focus:border-signal"
        style={{ width: large * facteur, height: haut * facteur }}
        onPointerDown={(evenement) => {
          if (main) return
          evenement.currentTarget.setPointerCapture(evenement.pointerId)
          depart.current = { x: evenement.clientX, y: evenement.clientY }
        }}
        onPointerMove={(evenement) => {
          if (!depart.current) return
          // La souris se compte en pixels d'écran, la correction en pixels du
          // sprite : sans cette division, un geste d'un centimètre pousserait
          // le sujet de trente blocs.
          const dx = Math.round(
            (evenement.clientX - depart.current.x) / facteur,
          )
          const dy = Math.round(
            (evenement.clientY - depart.current.y) / facteur,
          )
          if (!dx && !dy) return
          depart.current = {
            x: depart.current.x + dx * facteur,
            y: depart.current.y + dy * facteur,
          }
          onPousser(dx, dy)
        }}
        onPointerUp={() => {
          depart.current = null
        }}
      >
        {pelure > 0 && compte > 1 && (
          <span
            data-pelure
            aria-hidden
            className="absolute left-0 top-0"
            style={{ ...fond(precedent), opacity: pelure / 100 }}
          />
        )}
        {main ?? <span className="absolute left-0 top-0" style={fond(rang)} />}
      </div>
    )
  }
  return Object.assign(
    // eslint-disable-next-line react-hooks/rules-of-hooks
    (props: Parameters<typeof Rendu>[0] & { ref?: React.Ref<HTMLDivElement> }) =>
      Rendu(props, props.ref ?? null),
    { displayName: "CaseEnGrand" },
  )
})()

/** Ce qui se corrige sur **l'image choisie**, et rien que sur elle. */
function CorrectionDeLImage({
  prise,
  clipDeLaBande,
  imagesParClip,
  voisins,
  melangee,
  pelure,
  onPelure,
  onRemplacer,
  onRemettreDroit,
}: {
  prise: Prise | undefined
  clipDeLaBande: string
  imagesParClip: Record<string, number>
  voisins: AtelierRecu["clips_voisins"]
  melangee: boolean
  pelure: number
  onPelure: (v: number) => void
  onRemplacer: (numero: number, clip: string) => void
  onRemettreDroit: () => void
}) {
  if (!prise) return null
  const venue = prise.clip || clipDeLaBande
  const combien =
    imagesParClip[venue] ??
    voisins.find((c) => c.identifiant === venue)?.images ??
    0
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <Libelle aide="codex.bande.image">l'image choisie</Libelle>
        <span className="mesure ml-auto text-[10px] text-encre-3">
          image {prise.numero}
          {melangee && (
            <>
              {" "}
              — du clip <b className="text-encre-2">{venue.slice(0, 8)}</b>
            </>
          )}
        </span>
      </div>

      {/* **Le premier geste : déplacer l'image dans son cadre** (RP22). */}
      <Libelle aide="bande.position">Déplacer</Libelle>
      <p className="text-[12px] leading-relaxed text-encre-3">
        Poussée de <b className="text-encre-2">{prise.dx}</b> horizontalement et{" "}
        <b className="text-encre-2">{prise.dy}</b> verticalement, en pixels du
        sprite. Aux bords, les flèches <b className="text-encre-2">cessent
        d'avoir un effet</b> plutôt que de rogner l'image.
      </p>
      {(prise.dx !== 0 || prise.dy !== 0) && (
        <button
          type="button"
          onClick={onRemettreDroit}
          className="mesure self-start border border-trait px-2 py-1 text-[10px] text-encre-3 hover:text-signal"
        >
          remettre cette image droite
        </button>
      )}

      {/* **Le deuxième geste : la remplacer par une autre image du clip ou
          d'un clip voisin** (RP22). Voisin seulement : un clip d'ailleurs
          donnerait une animation où le sujet change au milieu, et la liste ne
          paraît pas s'il n'y en a qu'un — un menu à un seul choix n'est pas un
          choix. */}
      {combien > 0 && (
        <div className="flex flex-col gap-1.5">
          <Libelle aide="bande.remplacer">Remplacer</Libelle>
          <label className="mesure flex items-center gap-1.5 text-[10px] text-encre-3">
            la remplacer par l'image
            <input
              type="number"
              min={0}
              max={combien - 1}
              value={prise.numero}
              onChange={(evenement) =>
                onRemplacer(Number(evenement.target.value), prise.clip)
              }
              aria-label="remplacer par une autre image du clip"
              className="w-16 border border-trait bg-carte px-1 py-0.5 text-encre"
            />
            <span>sur {combien}</span>
          </label>
          {voisins.length > 1 && (
            <label className="mesure flex flex-wrap items-center gap-1.5 text-[10px] text-encre-3">
              la prendre dans
              <select
                value={venue}
                onChange={(evenement) => {
                  const choisi = evenement.target.value
                  const combienLa =
                    voisins.find((c) => c.identifiant === choisi)?.images ?? 0
                  // Le numéro est borné sur le clip d'arrivée : l'image 40 d'un
                  // clip de cinquante n'existe pas dans un clip de vingt, et le
                  // serveur refuserait la correction entière.
                  onRemplacer(
                    Math.min(prise.numero, Math.max(0, combienLa - 1)),
                    choisi === clipDeLaBande ? "" : choisi,
                  )
                }}
                aria-label="prendre cette image dans un autre clip"
                className="border border-trait bg-carte px-1 py-0.5 text-encre"
              >
                {voisins.map((clip) => (
                  <option key={clip.identifiant} value={clip.identifiant}>
                    {/* **Le repère court avec le mouvement**, et pas seulement
                        le mouvement : deux tirages de la même marche portent
                        le même mot, et la liste les rendrait indiscernables.
                        C'est le même repère que la vignette écrit à côté de
                        l'image. */}
                    {clip.mouvement || "clip"} · {clip.identifiant.slice(0, 8)} —{" "}
                    {clip.images} images
                    {clip.identifiant === clipDeLaBande ? " · celui de l'animation" : ""}
                  </option>
                ))}
              </select>
              <span>· le clip est payé, en reprendre une image ne coûte rien</span>
            </label>
          )}
          {/* ⚠️ **Ce que remplacer coûte, dit avant de remplacer** (V3.03.3).
              Une recette individuelle a été posée en regardant cette
              image-là : un point de pipette, un cadre tracé, un passage de la
              main désignent un endroit qui n'est pas au même endroit sur
              l'image d'à côté. Elle ne suit donc pas — et *rien ne se réécrit
              en silence* veut dire que l'écran le dit **avant**, sous le
              contrôle qui le fera. */}
          {prise.recette && (
            <p
              data-recette-perdue-au-remplacement
              className="mesure text-[10px] leading-4 text-signal"
            >
              Cette image a <b className="text-encre-2">sa recette à elle</b> :
              la remplacer la rend à la recette de l'animation. C'est une
              autre image, et un réglage posé en regardant celle-ci
              mentirait dessus.
            </p>
          )}
        </div>
      )}

      {/* **Le troisième geste : voir la précédente en transparence** (RP22). */}
      <Libelle aide="bande.pelure">Comparer</Libelle>
      <Curseur
        libelle="L'image d'avant, en transparence"
        valeur={pelure}
        min={0}
        max={80}
        pas={5}
        unite=" %"
        onChange={onPelure}
      />
    </div>
  )
}

/** Une image de l'animation, dans la colonne de droite.
 *
 *  **Elle porte deux états qui ne se confondent pas** (V3.03.2) : *celle qu'on
 *  voit en grand* — elle défile quand le lecteur tourne — et *celles que les
 *  tables règlent*, qui ne bougent que sur un clic. Un seul liseré pour les deux
 *  ferait clignoter le choix à la cadence de l'animation. */
function ImageDeLaBande({
  prise,
  index,
  planche,
  large,
  haut,
  compte,
  courante,
  choisie,
  venueDAilleurs,
  ecart,
  onChoisir,
  onPrendreEnMain,
  onDeposer,
}: {
  prise: Prise
  index: number
  planche: string
  large: number
  haut: number
  compte: number
  /** Celle qu'on voit en grand, à cet instant. */
  courante: boolean
  /** Elle fait partie de ce que les tables règlent. */
  choisie: boolean
  venueDAilleurs: boolean
  /** Ce que cette image change à la recette de l'animation, ou rien (V3.03.1).
   *  **Les places sont nommées par le serveur** — voir `ReglagesDeLaFrame`. */
  ecart?: { places: string[]; fenetre_davant: boolean }
  onChoisir: (comment: "seule" | "etendre" | "ajouter") => void
  /** On commence à la glisser : si elle n'était pas choisie, elle le devient —
   *  sans quoi le glissement déplacerait un choix qu'on ne regarde pas. */
  onPrendreEnMain: () => void
  /** On lâche le choix **avant celle-ci**. */
  onDeposer: () => void
}) {
  const cote = 64
  const facteur = Math.min(cote / haut, cote / large)
  // **Une recette égale à celle de la bande ne s'annonce pas** : le serveur rend
  // une liste de places vide, et un liseré posé là dirait qu'il s'est passé
  // quelque chose alors que rien n'a changé.
  const secarte = Boolean(ecart && ecart.places.length > 0)
  const dit = secarte
    ? `image ${prise.numero} — s'écarte de l'animation : ${ecart!.places.join(", ")}`
    : venueDAilleurs
      ? `image ${prise.numero}, prise dans un autre clip`
      : `image ${prise.numero}`
  return (
    <button
      type="button"
      // **Maj étend, Ctrl ajoute** — les deux gestes de toute liste qui se
      // sélectionne, et l'auteur les connaît déjà de son explorateur de
      // fichiers. `metaKey` pour la même raison de l'autre côté du Mac. Ce que
      // ni l'un ni l'autre ne fait sans souris se fait par les deux boutons
      // « toutes » et « une seule », en haut du ruban.
      onClick={(evenement) =>
        onChoisir(
          evenement.shiftKey
            ? "etendre"
            : evenement.ctrlKey || evenement.metaKey
              ? "ajouter"
              : "seule",
        )
      }
      // **Le glissement déplace, le clic choisit** (V3.03.3). Les deux vivent
      // sur le même bouton parce que c'est la même chose qu'on manipule, et le
      // navigateur les sépare tout seul : un glissement n'émet pas de clic.
      draggable
      onDragStart={onPrendreEnMain}
      onDragOver={(evenement) => evenement.preventDefault()}
      onDrop={(evenement) => {
        evenement.preventDefault()
        onDeposer()
      }}
      data-image-de-la-bande={index}
      data-secarte={secarte ? "" : undefined}
      data-choisie={choisie ? "" : undefined}
      aria-label={`l'image ${prise.numero}, ${index + 1}ᵉ de l'animation${
        secarte ? ` — s'écarte de l'animation : ${ecart!.places.join(", ")}` : ""
      }`}
      aria-current={courante}
      aria-pressed={choisie}
      title={dit}
      className={`relative flex items-center justify-center overflow-hidden border bg-pourtour ${
        courante
          ? "border-signal"
          : choisie
            ? "border-encre-3"
            : "border-trait hover:border-encre-4"
      }`}
      style={{ width: cote, height: cote }}
    >
      <span
        style={{
          display: "block",
          width: large * facteur,
          height: haut * facteur,
          backgroundImage: `url(${planche})`,
          backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`,
          backgroundPosition: `-${index * large * facteur}px 0`,
          imageRendering: "pixelated",
        }}
      />
      {venueDAilleurs && (
        <span
          data-venue-d-ailleurs
          aria-hidden
          title="prise dans un autre clip"
          className="absolute right-0 top-0 h-1.5 w-1.5 bg-signal"
        />
      )}
      {/* **Le liseré de ce qui s'écarte** (V3.03.1). Sur le bord gauche et non
          en pastille : il doit se lire d'un coup d'œil sur un ruban de trente
          vignettes, et une pastille de six pixels s'y perd. C'est le même
          liseré que la V3.03.2 reprendra pour dire ce qu'une recette posée en
          lot va écraser. */}
      {secarte && (
        <span
          data-liser-ecart
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-encre-3"
        />
      )}
      {(prise.dx !== 0 || prise.dy !== 0) && (
        <span
          data-poussee
          aria-hidden
          title="cette image a été poussée"
          className="mesure absolute bottom-0 left-0 bg-black/70 px-0.5 text-[7px] text-encre-sur-signal"
        >
          {prise.dx},{prise.dy}
        </span>
      )}
      {prise.main_apres_placement && <span data-main-sur-frame title="Cette frame porte une retouche à la main"
        className="absolute right-0 top-0 bg-carte px-[4px] text-[10.5px] text-signal">main</span>}
    </button>
  )
}

/** **Les quatre gestes qui montent le ruban** (V3.03.3) : retirer, dupliquer,
 *  et déplacer d'un cran dans un sens ou dans l'autre.
 *
 *  **Ils portent sur les images choisies**, comme les tables : un écran où
 *  certains gestes visent la sélection et d'autres une seule image ferait
 *  deviner lequel est lequel à chaque clic. C'est aussi ce qui les met à l'abri
 *  du lecteur — la sélection ne bouge pas pendant que l'animation tourne, à la
 *  différence de l'image affichée.
 *
 *  ⚠️ **Retirer se ferme quand tout est choisi**, et dupliquer quand le ruban
 *  atteindrait le plafond du serveur. Les deux portent leur raison : un bouton
 *  éteint sans raison se lit comme un bouton cassé. */
function MontageDuRuban({
  choisies,
  compte,
  place,
  restants,
  plafond,
  onRetirer,
  onDupliquer,
  onDeplacer,
}: {
  /** Combien d'images les gestes emportent. */
  choisies: number
  /** Combien le ruban en porte. */
  compte: number
  /** Où les images choisies se tiennent dans ce qui resterait sans elles. */
  place: number
  /** Combien d'images resteraient — les bornes des deux flèches. */
  restants: number
  plafond: number
  onRetirer: () => void
  onDupliquer: () => void
  onDeplacer: (ou: number) => void
}) {
  const tout = choisies >= compte
  const deborde = compte + choisies > plafond
  const mot = choisies > 1 ? `les ${choisies} images` : "cette image"
  return (
    <div
      data-montage-du-ruban
      className="flex shrink-0 flex-col gap-[4px]"
    >
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onRetirer}
          disabled={tout}
          aria-label={`Retirer ${mot} du ruban`}
          className="mesure border border-trait px-1.5 py-0.5 text-[10px] text-encre-3 hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          retirer
        </button>
        <button
          type="button"
          onClick={onDupliquer}
          disabled={deborde}
          aria-label={`Dupliquer ${mot}`}
          className="mesure border border-trait px-1.5 py-0.5 text-[10px] text-encre-3 hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          dupliquer
        </button>
        <span className="mesure ml-auto text-[10px] text-encre-3">déplacer</span>
        <button
          type="button"
          onClick={() => onDeplacer(place - 1)}
          disabled={place <= 0}
          aria-label={`Déplacer ${mot} vers la gauche`}
          className="h-[22px] w-[22px] border border-trait text-[10px] text-encre-2 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onDeplacer(place + 1)}
          disabled={place >= restants}
          aria-label={`Déplacer ${mot} vers la droite`}
          className="h-[22px] w-[22px] border border-trait text-[10px] text-encre-2 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
      {(tout || deborde) && <p className="text-[12px] leading-relaxed text-encre-3">
        {tout ? (
          <>
            Toutes les images sont choisies :{" "}
            <b className="text-encre-2">une animation en garde au moins une</b>,
            et il n'y a rien à retirer.
          </>
        ) : deborde ? (
          <>
            Une animation porte au plus{" "}
            <b className="text-encre-2">{plafond} images</b> — dupliquer les{" "}
            {choisies} ferait déborder ce ruban.
          </>
        ) : (
          <>
            L'ordre du ruban est{" "}
            <b className="text-encre-2">l'ordre de l'export</b>. Une image
            retirée part au chutier avec sa recette, une copie garde la sienne,
            et rien n'est écrit tant que vous n'avez pas enregistré.
          </>
        )}
      </p>}
    </div>
  )
}

/** **Le chutier — la réserve de la bande** (V3.03.3).
 *
 *  Les images retirées du ruban et celles qu'on est allé chercher dans le clip,
 *  pas encore posées. Chacune se remet dans la bande **avant ou après l'image
 *  choisie** — deux boutons plutôt qu'un glissement, parce que la position doit
 *  être dite et pas visée, et parce qu'un glissement ne se fait pas au clavier.
 *
 *  ⚠️ **Il se garde avec la bande.** Ce qu'on a mis de côté est une intention
 *  qui survit à la fermeture de l'atelier : sans ça, il faudrait retrouver
 *  l'image dans la pellicule à chaque visite — c'est-à-dire refaire le geste
 *  qu'il existe pour éviter. */
function LeChutier({
  chutier,
  clipDeLaBande,
  contact,
  imagesParClip,
  ancre,
  plein,
  onInserer,
  onVider,
  onAllerAuClip,
}: {
  chutier: Prise[]
  clipDeLaBande: string
  contact: { cote: number; colonnes: number }
  imagesParClip: Record<string, number>
  /** Le rang, à partir de 1, de l'image auprès de laquelle on pose. */
  ancre: number
  /** Le ruban est au plafond : poser une image de plus le ferait déborder. */
  plein: boolean
  onInserer: (rang: number, ou: "avant" | "apres") => void
  onVider: (rang: number) => void
  onAllerAuClip: () => void
}) {
  return (
    <div
      data-chutier={chutier.length}
      className="flex shrink-0 flex-col gap-1 border-t border-trait p-2"
    >
      <div className="flex items-baseline gap-2">
        <Libelle aide="bande.chutier">le chutier</Libelle>
        <button
          type="button"
          onClick={onAllerAuClip}
          className="mesure ml-auto text-[10px] text-signal hover:text-encre"
        >
          prendre des images dans le clip ›
        </button>
      </div>

      {chutier.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-encre-3">
          Vide. Ce que vous retirez du ruban vient ici, avec sa recette, et se
          repose où vous voulez — <b className="text-encre-2">retirer n'est pas
          jeter</b>.
        </p>
      ) : (
        <>
          <ul className="defile flex max-h-[132px] flex-col gap-1 overflow-y-auto">
            {chutier.map((prise, rang) => {
              const venue = prise.clip || clipDeLaBande
              const combien = imagesParClip[venue] ?? 0
              return (
                <li
                  key={`${venue}-${prise.numero}-${rang}`}
                  data-au-chutier={prise.numero}
                  className="flex items-center gap-1.5 border border-trait bg-carte p-1"
                >
                  <CaseDuContact
                    clip={venue}
                    numero={prise.numero}
                    images={combien}
                    contact={contact}
                    cote={32}
                  />
                  <span className="mesure text-[10px] text-encre-3">
                    image {prise.numero}
                    {prise.recette && (
                      <b
                        data-recette-au-chutier
                        title="elle garde la recette qu'elle avait dans l'animation"
                        className="ml-1 text-encre-2"
                      >
                        · sa recette
                      </b>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onInserer(rang, "avant")}
                    disabled={plein}
                    aria-label={`Poser l'image ${prise.numero} avant l'image ${ancre}`}
                    className="mesure ml-auto border border-trait px-1 py-0.5 text-[10px] text-encre-3 hover:border-signal hover:text-signal disabled:opacity-40"
                  >
                    avant
                  </button>
                  <button
                    type="button"
                    onClick={() => onInserer(rang, "apres")}
                    disabled={plein}
                    aria-label={`Poser l'image ${prise.numero} après l'image ${ancre}`}
                    className="mesure border border-trait px-1 py-0.5 text-[10px] text-encre-3 hover:border-signal hover:text-signal disabled:opacity-40"
                  >
                    après
                  </button>
                  <button
                    type="button"
                    onClick={() => onVider(rang)}
                    aria-label={`Laisser tomber l'image ${prise.numero} du chutier`}
                    title="elle reste dans le clip, on peut la reprendre"
                    className="mesure px-1 text-[10px] text-encre-3 hover:text-signal"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mesure text-[10px] leading-4 text-encre-3">
            Elles se posent <b className="text-encre-2">avant ou après l'image{" "}
            {ancre}</b>, celle que les tables règlent — pas celle qui passe à
            l'écran.
          </p>
        </>
      )}
    </div>
  )
}

/** Une case de la planche contact d'un clip — **une seule image pour cent
 *  vingt**.
 *
 *  Le serveur assemble toutes les images du clip en une grille et la garde ; on
 *  n'en montre qu'une case en décalant le fond. Servir cent vingt images de
 *  480 pixels pour dessiner des vignettes de trente-deux ferait payer vingt
 *  mégaoctets à chaque ouverture. */
function CaseDuContact({
  clip,
  numero,
  images,
  contact,
  cote,
}: {
  clip: string
  numero: number
  images: number
  contact: { cote: number; colonnes: number }
  cote: number
}) {
  const facteur = cote / contact.cote
  const lignes = Math.max(1, Math.ceil(images / contact.colonnes))
  return (
    <span
      aria-hidden
      className="block shrink-0 border border-trait bg-pourtour"
      style={{
        width: cote,
        height: cote,
        backgroundImage: `url(${api.contactDuClip(clip)})`,
        backgroundSize: `${contact.colonnes * contact.cote * facteur}px ${
          lignes * contact.cote * facteur
        }px`,
        backgroundPosition: `-${(numero % contact.colonnes) * cote}px -${
          Math.floor(numero / contact.colonnes) * cote
        }px`,
        imageRendering: "pixelated",
      }}
    />
  )
}

/** **Toute la pellicule du clip** (V3.03.3) — *comme le montage, sans le
 *  montage*.
 *
 *  On y prend une ou plusieurs images d'un geste, et elles entrent au chutier.
 *  Rien du ruban ne bouge : aller chercher une image n'est pas la poser.
 *
 *  ⚠️ **Elle ne rejoue pas le montage.** Pas de boucle, pas de propositions, pas
 *  de fenêtre commune : ouvrir l'écran de montage mesure la fenêtre du clip et
 *  coûte une vingtaine de secondes, pour répondre à une autre question. Ce qu'on
 *  vient faire ici est *« il me manque une image »*, et ça se répond en la
 *  regardant.
 *
 *  Les images que la bande porte déjà, et celles qui sont au chutier, sont
 *  marquées : sans marque, on redemande deux fois la même. */
function PelliculeDuClip({
  clip,
  images,
  contact,
  deja,
  onPrendre,
  onFermer,
}: {
  clip: string
  images: number
  contact: { cote: number; colonnes: number }
  /** Les numéros déjà dans la bande ou au chutier. */
  deja: number[]
  onPrendre: (numeros: number[]) => void
  onFermer: () => void
}) {
  const [choisies, setChoisies] = useState<number[]>([])
  const basculer = (numero: number) =>
    setChoisies((avant) =>
      avant.includes(numero)
        ? avant.filter((autre) => autre !== numero)
        : [...avant, numero].sort((a, b) => a - b),
    )
  return (
    <div
      data-pellicule-du-clip={clip}
      className="flex min-h-0 flex-col gap-3 p-4"
    >
      <div className="flex items-baseline gap-2">
        <EnTetePanneau>les images du clip</EnTetePanneau>
        <span className="mesure text-[10px] text-encre-3">
          {images} images
        </span>
        <button
          type="button"
          onClick={onFermer}
          className="mesure ml-auto text-[10px] text-encre-3 hover:text-signal"
        >
          Fermer
        </button>
      </div>

      <p className="mesure max-w-[70ch] text-[10px] leading-4 text-encre-3">
        Prenez ce qui vous manque : les images choisies entrent{" "}
        <b className="text-encre-2">au chutier</b>, et rien du ruban ne bouge.
        Le clip est payé — en reprendre une image ne coûte rien.
      </p>

      <div className="defile flex min-h-0 flex-wrap content-start gap-1 overflow-y-auto">
        {Array.from({ length: images }, (_, numero) => {
          const dedans = deja.includes(numero)
          const prise = choisies.includes(numero)
          return (
            <button
              key={numero}
              type="button"
              onClick={() => basculer(numero)}
              data-image-du-clip={numero}
              data-prise={prise ? "" : undefined}
              aria-pressed={prise}
              aria-label={`l'image ${numero} du clip${
                dedans ? ", déjà dans l'animation ou au chutier" : ""
              }`}
              title={
                dedans
                  ? `image ${numero} — déjà dans l'animation ou au chutier`
                  : `image ${numero}`
              }
              className={`relative border ${
                prise
                  ? "border-signal"
                  : "border-trait hover:border-encre-4"
              } ${dedans ? "opacity-50" : ""}`}
            >
              <CaseDuContact
                clip={clip}
                numero={numero}
                images={images}
                contact={contact}
                cote={48}
              />
              {dedans && (
                <span
                  data-deja-dedans
                  aria-hidden
                  className="absolute bottom-0 left-0 h-1 w-full bg-encre-4"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={choisies.length === 0}
          onClick={() => onPrendre(choisies)}
          className="mesure border border-signal px-2 py-1 text-[10px] text-signal hover:bg-signal hover:text-encre-sur-signal disabled:border-trait disabled:text-encre-3"
        >
          {choisies.length === 0
            ? "choisissez au moins une image"
            : `Prendre ${choisies.length} image${
                choisies.length > 1 ? "s" : ""
              } ›`}
        </button>
      </div>
    </div>
  )
}

/** **Reprendre le montage de cette animation** (V3.03.3).
 *
 *  > ### ⚠️ Le montage repartait toujours des réglages du jeu
 *  >
 *  > C'est le cul-de-sac d'`A7` par l'autre bout : on savait tailler une
 *  > animation dans un clip et **pas revenir sur ce découpage**. Ajouter une
 *  > image demandait de refaire la bande entière, et de repayer de mémoire tous
 *  > les réglages posés depuis.
 *
 *  Le bouton est **fermé sur une animation mêlée**, avec sa raison : le montage
 *  ne montre qu'un clip, et y reprendre le découpage laisserait tomber les
 *  images empruntées à l'autre. Il est fermé aussi tant que des corrections
 *  attendent — le montage écrit sur la bande, et le faire par-dessus des
 *  réglages en cours les perdrait. */
function RepriseDuMontage({
  melangee,
  bloquee,
  onReprendre,
}: {
  melangee: boolean
  bloquee: boolean
  onReprendre: () => void
}) {
  return (
    <div data-reprise-du-montage className="flex flex-col gap-1">
      <Libelle aide="bande.montage">le découpage</Libelle>
      <button
        type="button"
        disabled={melangee || bloquee}
        onClick={onReprendre}
        className="mesure self-start border border-trait px-2 py-1 text-[10px] text-encre-3 hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reprendre le montage ›
      </button>
      <p className="mesure text-[10px] leading-4 text-encre-3">
        {melangee ? (
          <>
            Cette animation prend ses images dans{" "}
            <b className="text-encre-2">plusieurs clips</b>, et le montage n'en
            montre qu'un : y reprendre le découpage laisserait tomber celles de
            l'autre.
          </>
        ) : bloquee ? (
          /* ⚠️ **Deux gestes de cet écran écrivent sans passer par
              « Enregistrer »** — celui-ci et « Reprendre la fenêtre » —, et les
              deux se ferment tant que des corrections attendent. Leurs phrases
              ne se recopient pas : elles nomment chacune **ce qu'on perdrait**,
              et deux ouvertures identiques à trois centimètres l'une de l'autre
              se lisent comme une seule répétée — le défaut trouvé au navigateur
              le 5 septembre 2026, sur la V3.03.2. */
          <>
            <b className="text-encre-2">Des corrections attendent</b>, et le
            montage écrit sur l'animation : les enregistrer d'abord évite de les
            perdre en chemin.
          </>
        ) : (
          <>
            La pellicule du clip, avec{" "}
            <b className="text-encre-2">les images déjà retenues</b> et la
            vitesse de cette animation. Ce que vous gardez revient ici, recettes
            comprises ; ce que vous laissez tombe au chutier.
          </>
        )}
      </p>
    </div>
  )
}

/** Les arrêts du zoom de la frame, **en facteurs entiers**. Serrés là où l'on
 *  corrige au pixel, lâches là où l'on regarde la pose : personne ne travaille
 *  à 7× plutôt qu'à 8×, et un pas de un demanderait quinze clics pour traverser
 *  la plage. */
const ARRETS_DU_ZOOM = [1, 2, 3, 4, 6, 8, 12, 16, 24] as const

/** Le zoom de la frame — reculer, avancer, revenir à l'ajusté.
 *
 *  **`ajusté` n'est pas un arrêt** : c'est le facteur qui fait tenir la pose
 *  entière, et il change avec la taille de la case. C'est l'état d'ouverture, et
 *  le bouton qui y revient le dit plutôt que d'obliger à retrouver le chiffre. */
function ZoomDeLaFrame({
  facteur,
  ajuste,
  surMesure,
  onZoom,
}: {
  facteur: number
  ajuste: number
  /** L'auteur a-t-il posé un facteur, ou regarde-t-il l'ajusté ? */
  surMesure: boolean
  onZoom: (facteur: number | null) => void
}) {
  const reculer = [...ARRETS_DU_ZOOM].reverse().find((a) => a < facteur)
  const avancer = ARRETS_DU_ZOOM.find((a) => a > facteur)
  return (
    <div
      data-zoom-de-la-frame={facteur}
      className="mesure flex w-full shrink-0 items-center justify-end gap-1 text-[10px] text-encre-3"
    >
      <button
        type="button"
        aria-label="Reculer"
        title="Reculer"
        disabled={reculer === undefined}
        onClick={() => reculer !== undefined && onZoom(reculer)}
        className="h-[22px] w-[22px] border border-trait text-encre-2 hover:text-signal disabled:cursor-not-allowed disabled:text-encre-3"
      >
        −
      </button>
      <span aria-live="polite" className="w-[52px] text-center text-encre-2">
        {facteur}×{surMesure ? "" : " ajusté"}
      </span>
      <button
        type="button"
        aria-label="Avancer"
        title="Avancer"
        disabled={avancer === undefined}
        onClick={() => avancer !== undefined && onZoom(avancer)}
        className="h-[22px] w-[22px] border border-trait text-encre-2 hover:text-signal disabled:cursor-not-allowed disabled:text-encre-3"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onZoom(null)}
        disabled={!surMesure}
        title={`revenir au facteur qui fait tenir la pose entière — ${ajuste}×`}
        className="border border-trait px-1.5 py-0.5 hover:text-encre disabled:opacity-40"
      >
        adapter
      </button>
    </div>
  )
}

/** Le lecteur — **sous les images, pas ailleurs**. C'est là qu'on les regarde,
 *  donc c'est là qu'on les met en marche. */
function Lecteur({
  joue,
  onJoue,
  cadence,
  onCadence,
  rang,
  compte,
}: {
  joue: boolean
  onJoue: (v: boolean) => void
  cadence: number
  onCadence: (v: number) => void
  rang: number
  compte: number
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-[14px] border-b border-trait pb-[8px]">
        <button
          type="button"
          onClick={() => onJoue(!joue)}
          aria-label={joue ? "arrêter l'animation" : "faire tourner l'animation"}
          className="h-[30px] rounded-7 border border-trait bg-carte px-[14px] text-[12px] text-encre-2 hover:border-signal hover:text-signal"
        >
          {joue ? "⏸ pause" : "▶ jouer"}
        </button>
        <span className="text-[12px] text-encre-3">
          {rang + 1} / {compte}
        </span>
        <label className="ml-auto flex items-center gap-[8px] text-[12px] text-encre-3">Cadence
          <input type="number" aria-label="Cadence, en chiffres" min={1} max={30} value={cadence} onChange={(event) => { const valeur = Number(event.target.value); if (Number.isFinite(valeur) && valeur >= 1 && valeur <= 30) onCadence(valeur) }} className="h-[30px] w-[70px] rounded-7 border border-trait bg-carte px-[8px] text-encre" />
          images/s
        </label>
    </div>
  )
}

/** Une table dans la colonne, avec son nom. **Le nom est ce qui les sépare** :
 *  six panneaux à la file sans titre feraient une seule longue liste de
 *  réglages, ce que la refonte des tables avait justement défait. */
function TableDeLaFrame({
  nom,
  separe,
  children,
}: {
  nom: string
  /** **Les images choisies n'ont pas la même valeur ici** (V3.03.2). Le mot est
   *  posé sur le titre de la table, pas dans une phrase du haut : c'est là qu'on
   *  regarde au moment de toucher un curseur, et une phrase à quarante lignes
   *  au-dessus ne se relit pas. Ce que les curseurs montrent alors est la valeur
   *  de l'image des tables ; **poser en écrit une seule sur les autres**, celle
   *  qu'on vient de toucher, et rien de plus. */
  separe?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      data-table-de-la-frame={nom}
      data-separe={separe ? "" : undefined}
      className="flex flex-col gap-2 border-t border-trait pt-2"
    >
      <div className="flex items-baseline gap-2">
        <EnTetePanneau>{nom}</EnTetePanneau>
        {separe && (
          <span
            title="les images choisies n'ont pas la même valeur ici"
            className="mesure text-[10px] text-signal"
          >
            séparé
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

/** **La recette de l'image qu'on regarde** (V3.03.1) — celle de la frame quand
 *  elle en a une, celle de la bande sinon.
 *
 *  Le titre dit lequel des deux, et c'est tout ce qui sépare les deux états :
 *  les mêmes curseurs règlent l'une ou l'autre, et le premier geste fait passer
 *  de la seconde à la première. Une recette individuelle **part d'une copie de
 *  celle de la bande** à cet instant — rien ne se remet à zéro, on continue de
 *  régler ce qu'on avait sous les yeux.
 *
 *  ⚠️ **Ce qui s'écarte est nommé par le serveur, pas ici.** Les places d'une
 *  recette ont déjà un mot français ailleurs ; les réécrire donnerait deux
 *  vocabulaires de la même chose, et celui de l'écran finirait par mentir. */
function ReglagesDeLaFrame({
  table,
  poste,
  sienne,
  ancre,
  choisies,
  siennes,
  separes,
  ecart,
  onReprendre,
}: {
  table: Table
  /** Ce que les postes attendent, ou rien tant que la recette n'est pas lue. */
  poste: Poste | null
  /** L'image a-t-elle sa recette à elle ? Le titre et le bouton en dépendent. */
  sienne: boolean
  /** Le rang, à partir de 1, de l'image dont les tables montrent les valeurs. */
  ancre: number
  /** Combien d'images les tables règlent (V3.03.2). */
  choisies: number
  /** Combien d'entre elles ont déjà leur recette à elles. */
  siennes: number
  /** Les places sur lesquelles les images choisies ne s'accordent pas. */
  separes: string[]
  ecart?: { places: string[]; fenetre_davant: boolean }
  onReprendre: () => void
}) {
  if (!poste) return null
  if (table === "main") return null
  const plusieurs = choisies > 1
  const separe = (nom: string) => separes.includes(nom)
  return (
    <div
      data-recette-de-la-frame={sienne ? "sienne" : "de-la-bande"}
      data-images-choisies={choisies}
      className="flex flex-col gap-3 border-t border-trait pt-2"
    >
      <Libelle aide="bande.recette">
        {plusieurs
          ? `la recette de ces ${choisies} images`
          : sienne
            ? "la recette de cette image"
            : "la recette de l'animation"}
      </Libelle>

      {/* **Ce qui parle de la frame entière est au-dessus des tables**, pas
          sous elles. Six panneaux empilés font une colonne qui défile sur deux
          écrans : l'écart et le bouton qui rend la frame au défaut se seraient
          trouvés là où personne ne descend, alors qu'ils disent ce qu'il faut
          savoir *avant* de toucher un réglage. */}
      {(sienne || siennes > 0) && (
        <div className="flex flex-col gap-1.5">
          {!plusieurs && ecart && ecart.places.length > 0 && (
            <p
              data-ecart-de-la-frame
              className="mesure text-[10px] leading-4 text-encre-3"
            >
              S'écarte de l'animation :{" "}
              <b className="text-encre-2">{ecart.places.join(", ")}</b>.
            </p>
          )}

          {/* ⚠️ **Ce qui va être écrasé se dit une fois pour le lot**, et à un
              seul endroit — la règle de `G12`, écrite ici pour le ruban. Le
              compte des recettes qu'une recette nommée remplacera vit **sous le
              menu qui la pose**, au plus près du geste ; cette phrase-ci dit
              l'autre moitié, celle que rien ne laisse deviner : *un curseur ne
              déplace que la valeur qu'on touche*. Les deux ont un temps vécu
              côte à côte et se répétaient presque mot pour mot — vu au
              navigateur le 5 septembre 2026. */}
          {plusieurs && separes.length > 0 && (
            <p
              data-separes-du-lot
              className="mesure text-[10px] leading-4 text-encre-3"
            >
              Séparé sur <b className="text-encre-2">{separes.join(", ")}</b> —
              les curseurs montrent la valeur de l'image {ancre}, et un réglage
              ne pose <b className="text-encre-2">que la valeur touchée</b> : ce
              que les autres ne partagent pas est gardé.
            </p>
          )}

          {/* ⚠️ **La fenêtre commune est mesurée avec la recette de la bande**,
              et ne se remesure pas frame par frame : les vingt secondes ne se
              paient pas à chaque cran de curseur. Une frame qui s'en écarte peut
              donc déborder, et c'est la phrase « d'avant » qui le dit — la même
              que sous la fenêtre elle-même, parce que c'est le même fait. */}
          {!plusieurs && ecart?.fenetre_davant && (
            <p
              data-fenetre-davant-sur-la-frame
              className="mesure text-[10px] leading-4 text-signal"
            >
              La fenêtre commune a été mesurée avec la recette de l'animation.
              Elle n'est pas fausse, elle est d'avant : cette image peut dépasser
              d'un côté.
            </p>
          )}

          <button
            type="button"
            onClick={onReprendre}
            className="mesure self-start border border-trait px-2 py-1 text-[10px] text-encre-3 hover:text-encre"
          >
            {plusieurs
              ? `Reprendre la recette de l'animation sur ${siennes} image${
                  siennes > 1 ? "s" : ""
                }`
              : "Reprendre la recette de l'animation"}
          </button>
        </div>
      )}

      {/* **Les tables, dans l'ordre du traitement.** C'est le même ordre
          qu'`TABLES` tient pour l'établi, et il n'est pas décoratif : trois des
          places n'ont pas de sens avant celle qui les précède. Elles sont
          empilées plutôt que rangées derrière une barre — tranché avec l'auteur
          le 5 septembre 2026 : on corrige une pose en regardant deux réglages à
          la fois, et une barre en cacherait toujours l'un des deux.

          **La main n'y est pas** : elle arrive en V3.03.4. Une table vide qui
          annoncerait sa place ferait attendre un geste qui n'existe pas. */}
      <div hidden={table !== "detourage"}><TableDeLaFrame nom="détourage" separe={separe("détourage")}>
        {/* ⚠️ **Une recette de jeu peut n'avoir aucune passe**, et l'écran
            n'offrait alors aucun moyen d'en ajouter : le fond restait, et il
            n'y avait rien à régler. Signalé par l'auteur le 4 septembre 2026.
            Le bouton « + une passe » du panneau y répond ; la phrase dit
            pourquoi il est seul, ce qu'un panneau vide ne dit pas. */}
        {poste.recette.passes.length === 0 && (
          <p className="mesure text-[10px] leading-4 text-encre-3">
            Cette animation ne détoure rien : le fond du clip part dans les
            sprites tel quel.
          </p>
        )}
        <ReglagesDuDetourage {...poste} />
        <p className="mesure text-[10px] leading-4 text-encre-3">
          {plusieurs
            ? `Ce qui change ici se pose sur les ${choisies} images choisies.`
            : "Ce qui change ici ne vaut que pour l'image regardée."}
        </p>
      </TableDeLaFrame></div>
      <div hidden={table !== "recadrage"}><TableDeLaFrame nom="recadrage" separe={separe("recadrage")}>
        <ReglagesDuRecadrage {...poste} />
      </TableDeLaFrame></div>
      <div hidden={table !== "grille"}><TableDeLaFrame nom="grille" separe={separe("grille")}>
        {/* L'ancrage est rendu à droite, avec la vitesse et le sens : il tient
            de la bande entière, et un ancrage par image ferait sauter le sujet
            d'une frame à l'autre. */}
        <ReglagesDeLaGrille {...poste} sansAncrage />
      </TableDeLaFrame></div>
      <div hidden={table !== "quantification"}><TableDeLaFrame nom="quantification" separe={separe("quantification")}>
        <ReglagesDesCouleurs {...poste} />
      </TableDeLaFrame></div>
      <div hidden={table !== "bords"}><TableDeLaFrame nom="bords" separe={separe("bords")}>
        <ReglagesDuNettoyage {...poste} />
      </TableDeLaFrame></div>
      <div hidden={table !== "contours"}><TableDeLaFrame nom="contours" separe={separe("contours")}>
        <ReglagesDuContour {...poste} />
      </TableDeLaFrame></div>

      {/* ⚠️ **La table de la main n'est pas ici, et sa phrase non plus.**
          Le plan la veut grisée avec sa raison sur une sélection de plusieurs
          images — *une coordonnée ne voyage pas* (lot `U`) —, mais la table
          arrive en V3.03.4 et aucun écran ne pose de main sur une frame
          aujourd'hui. Une phrase qui expliquerait pourquoi un geste absent est
          indisponible ferait attendre ce geste. Ce qui est tenu dès maintenant
          l'est dans le code, au seul endroit atteignable :
          `sansToucherALaMain`. */}
    </div>
  )
}

/** **Ce qui appartient à l'animation entière, et à rien d'autre** : le sens de
 *  lecture.
 *
 *  ⚠️ La recette n'y est plus (V3.03.1). Elle a longtemps vécu ici parce qu'une
 *  bande n'avait qu'une recette pour toutes ses images ; depuis que chaque frame
 *  peut porter la sienne, laisser les curseurs de recette sous le titre *« la
 *  recette de l'animation »* aurait fait croire qu'on règle les douze images
 *  alors qu'on n'en règle qu'une. Ils sont passés dans `ReglagesDeLaFrame`, qui
 *  dit de quoi il parle.
 *
 *  ⚠️ **La vitesse n'y est plus non plus**, et c'est la mise en page qui l'a
 *  décidé : le lecteur en porte déjà une, et les deux se sont retrouvées à trois
 *  centimètres l'une de l'autre en passant à droite. Deux curseurs voisins qui
 *  règlent le même chiffre se lisent comme deux réglages différents, et l'un des
 *  deux paraît cassé dès qu'on bouge l'autre. Vu à l'écran le 5 septembre 2026. */
function ReglagesDeLaBande({
  sens,
  onSens,
}: {
  sens: "boucle" | "aller-retour"
  onSens: (v: "boucle" | "aller-retour") => void
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-trait pt-2">
      <Libelle aide="bande.recette">ce qui vaut pour l'animation</Libelle>
      <div className="mt-1 flex items-center gap-2">
        <span className="mesure text-[10px] text-encre-3">Boucler</span>
        {(["boucle", "aller-retour"] as const).map((choix) => (
          <button
            key={choix}
            type="button"
            onClick={() => onSens(choix)}
            aria-pressed={sens === choix}
            className={`mesure border px-1.5 py-0.5 text-[10px] ${
              sens === choix
                ? "border-signal text-signal"
                : "border-trait text-encre-3 hover:text-encre"
            }`}
          >
            {choix}
          </button>
        ))}
      </div>
    </div>
  )
}

/** La fenêtre commune : son rectangle, d'où il vient, et s'il est d'avant.
 *
 *  **Une fenêtre mesurée avec un autre détourage n'est pas fausse : elle est
 *  d'avant.** La reprendre coûte une vingtaine de secondes, et personne ne doit
 *  les payer sans raison — c'est donc un bouton, jamais un rattrapage
 *  automatique.
 *
 *  Il se ferme tant que des corrections attendent, et la phrase le dit : mesurer
 *  avec la recette du disque puis écrire par-dessus des réglages en cours
 *  laisserait la bande à moitié neuve. */
function FenetreDeLaBande({
  cadre,
  etat,
  enCours,
  bloquee,
  onReprendre,
}: {
  cadre: CadrePose
  etat: { choix: string; a_jour: boolean; mesuree_le: number | null }
  enCours: boolean
  bloquee: boolean
  onReprendre: () => void
}) {
  const gauche = cadre.gauche ?? 0
  const sommet = cadre.sommet ?? 0
  const droite = cadre.droite ?? 0
  const bas = cadre.bas ?? 0
  const pose = droite > gauche && bas > sommet
  return (
    <div data-fenetre className="flex flex-col gap-1 border-t border-trait pt-2">
      <Libelle aide="bande.cadre">la fenêtre commune</Libelle>
      <p className="mesure text-[10px] leading-4 text-encre-3">
        {pose ? (
          <>
            <b className="text-encre-2">
              {droite - gauche + 1} × {bas - sommet + 1}
            </b>{" "}
            pixels, {MOT_DU_CADRE[etat.choix] ?? MOT_DU_CADRE.clip}.
          </>
        ) : (
          <>Aucun rectangle posé — chaque image se recadre sur elle-même.</>
        )}
      </p>

      {!etat.a_jour && (
        <p data-fenetre-davant className="mesure text-[10px] leading-4 text-signal">
          Elle a été mesurée avec un autre détourage. Elle n'est pas fausse, elle
          est d'avant : le sujet peut dépasser d'un côté.
        </p>
      )}

      <button
        type="button"
        disabled={enCours || bloquee}
        onClick={onReprendre}
        className="mesure self-start border border-trait px-2 py-1 text-[10px] text-encre-3 hover:text-encre disabled:opacity-40"
      >
        {enCours ? "on remesure…" : "Reprendre la fenêtre"}
      </button>
      <p className="mesure text-[10px] leading-4 text-encre-3">
        {bloquee
          ? "Enregistrez d'abord : reprendre la fenêtre écrit sur l'animation, et le faire par-dessus des réglages en cours la laisserait à moitié neuve."
          : "Une vingtaine de secondes — toutes les images sont redétourées et remesurées. Rien n'est dépensé."}
      </p>
    </div>
  )
}

/** Une recette enregistrée, appliquée **aux images choisies**.
 *
 *  Demandé par l'auteur le 4 septembre 2026, étendu à une sélection en V3.03.2.
 *  Ce qu'il fallait trancher : **appliquer une recette enregistrée n'écrit rien
 *  tout de suite**, comme tout le reste de cet écran — elle remplace les
 *  réglages en cours, l'aperçu se refait, et « Annuler » ramène ceux d'avant.
 *  Une recette nommée qui écrirait d'office serait le seul geste de l'écran à ne
 *  pas s'annuler.
 *
 *  Elle **remplace tout**, pas seulement le détourage : une recette est un
 *  ensemble, et en prendre la moitié rendrait une image que personne n'a jamais
 *  jugée (`A7` bis ②). C'est ce qui la sépare d'un curseur des tables, qui ne
 *  fait voyager que la valeur touchée — et c'est aussi pourquoi elle est le seul
 *  geste de l'écran qui ait besoin de dire *ce qu'il va écraser*. */
function RecetteEnregistree({
  recettes,
  choisies,
  siennes,
  toutes,
  onRecette,
}: {
  recettes: Record<string, Recette>
  /** Combien d'images la recette va remplacer. */
  choisies: number
  /** Combien d'entre elles avaient leur recette à elles. */
  siennes: number
  /** Toute la bande est choisie — la recette devient celle de l'animation. */
  toutes: boolean
  onRecette: (r: Recette) => void
}) {
  const noms = Object.keys(recettes).sort((a, b) => a.localeCompare(b, "fr"))
  if (noms.length === 0) return null
  const plusieurs = choisies > 1
  return (
    <label className="mesure flex flex-col gap-1 border-t border-trait pt-2 text-[10px] text-encre-3">
      <Libelle aide="fiche.recettes">une recette enregistrée</Libelle>
      <select
        value=""
        onChange={(evenement) => {
          const choisie = recettes[evenement.target.value]
          if (choisie) onRecette(choisie)
        }}
        // **Le libellé dit la portée, et la portée a changé** (V3.03.2). Il
        // disait « à cette animation » quand la recette nommée était le seul
        // geste de l'écran qui touchait la bande entière ; elle suit désormais
        // la sélection, comme les tables. Un libellé qui promettrait encore
        // l'animation entière serait faux onze fois sur douze.
        aria-label="appliquer une recette enregistrée aux images choisies"
        className="border border-trait bg-carte px-1 py-0.5 text-encre"
      >
        <option value="">— en appliquer une —</option>
        {noms.map((nom) => (
          <option key={nom} value={nom}>
            {nom}
          </option>
        ))}
      </select>
      <span className="leading-4">
        Elle remplace <b className="text-encre-2">tous</b> les réglages{" "}
        {toutes
          ? "de l'animation"
          : plusieurs
            ? `des ${choisies} images choisies`
            : "de l'image choisie"}
        , et rien n'est écrit tant que vous n'avez pas enregistré.
        {/* **Une fois pour le lot** — jamais une phrase par image. Elle ne
            paraît que quand il y a vraiment quelque chose à écraser : annoncer
            « 0 recette individuelle sera remplacée » ferait craindre une perte
            là où il n'y en a aucune. */}
        {siennes > 0 && (
          <>
            {" "}
            <b data-recettes-ecrasees={siennes} className="text-signal">
              {plusieurs ? `${siennes} des ${choisies} images choisies ` : ""}
              {siennes > 1
                ? "ont leur recette à elles"
                : plusieurs
                  ? "a sa recette à elle"
                  : "Cette image a sa recette à elle"}{" "}
              : elle {siennes > 1 ? "les" : "la"} remplacera.
            </b>
          </>
        )}
      </span>
    </label>
  )
}

/** Les neuf points, en carré. **La forme dit la chose** : un menu déroulant de
 *  neuf noms obligerait à traduire « bas-droite » en un endroit de l'image ;
 *  un carré de neuf cases le montre. */
function ChoixDeLAncrage({
  ancrage,
  onAncrage,
}: {
  ancrage: Ancrage
  onAncrage: (point: Ancrage) => void
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-trait pt-2">
      <Libelle aide="grille.ancrage">par où l'animation tient</Libelle>
      <div
        data-ancrages
        role="radiogroup"
        aria-label="par où l'animation tient dans sa case"
        className="grid w-[72px] grid-cols-3 gap-px border border-trait bg-trait"
      >
        {ANCRAGES.flat().map((point) => (
          <button
            key={point}
            type="button"
            role="radio"
            aria-checked={ancrage === point}
            aria-label={MOT_DE_L_ANCRAGE[point]}
            title={MOT_DE_L_ANCRAGE[point]}
            onClick={() => onAncrage(point)}
            className={`h-5 w-5 ${
              ancrage === point ? "bg-signal" : "bg-carte hover:bg-papier-cote"
            }`}
          />
        ))}
      </div>
      <p className="mesure text-[10px] leading-4 text-encre-3">
        {MOT_DE_L_ANCRAGE[ancrage] ?? MOT_DE_L_ANCRAGE.bas}. Un personnage tient
        par ses pieds, une bannière par son haut, une porte par son côté.
      </p>
    </div>
  )
}
