// L'Atelier — l'écran du travail quotidien.
//
// Quatre colonnes depuis T3, et c'est la grille de `docs/DESIGN.md` § Layout :
// `240px · 300px · minmax(0,1fr) · 380px` — arbre · réglages · prompt + grille ·
// fiche. Chacune se replie **par choix**, pour voir la grille en grand, jamais
// par contrainte de place (US-97). Écran large uniquement : aucun point de
// rupture, aucun menu escamoté, aucune mise en page de repli à écrire.
//
// **Une seule grille dans tout le produit** (US-31). Celle qui sert à réutiliser
// est exactement celle qui sert à organiser : mêmes filtres, même recherche,
// même sélection multiple. Elle est faite d'assets — la bibliothèque —, et un
// emplacement qui n'a pas encore donné son asset y tient sa place sous la même
// clé, donc à la même place. L'image ne se glisse pas à côté de son attente :
// elle la remplace.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  api,
  dollars,
  ecouter,
  filtreActif,
  FILTRE_VIDE,
  heure,
  poserLeFichier,
  Refus,
  type ApercuPrompt,
  type Asset,
  type Bibliotheque,
  type Etat,
  type Filtre,
  type Generation,
  type Modele,
  type Reinjection,
  type Role,
  type Carte,
  type Lien,
  type Teinte,
  type CompteReferences,
  type EmplacementCorps,
  type Personnage,
  type Piece,
  type DirectionsDuJeu,
  type Pose,
  type Univers,
  UNIVERS_VIDE,
} from "./api"
import {
  Apercu,
  fermerApercu,
  sujetAsset,
  useApercu,
  useVisee,
} from "./composants/Apercu"
import { Arbre } from "./composants/Arbre"
import {
  BarreChassis,
  type Bascule,
  type Fente,
  type Onglet,
  type Segment,
} from "./composants/BarreChassis"
import { BarreOutils, type Annulation } from "./composants/BarreOutils"
import { CRANS, Point, usePli, ZOOMS, type Zoom } from "./composants/chassis"
import { ChampPrompt } from "./composants/ChampPrompt"
import { EcranDecoupe } from "./composants/Decoupe"
import { EcranDepenses } from "./composants/Depenses"
import {
  EcranCodex,
  NOM_DE_LA_RUBRIQUE,
  type Rubrique,
} from "./composants/Codex"
import { EcranEtabli } from "./composants/Personnages"
import { EcranReglages } from "./composants/EcranReglages"
import { BlocPasse, Fiche, nomDuModele } from "./composants/Fiche"
import { EcranTables, TABLES, type Table } from "./composants/Tables"
import { CeQuiNEstPasEntre, useImport, type Import } from "./composants/Import"
import { EcranGuide, fermerGuide, ouvrirGuide, useGuide } from "./composants/Guide"
import { CoutAttendu, PanneauReglages } from "./composants/PanneauReglages"
import { Tuile, type Entree } from "./composants/Tuile"
import { EcranUnivers, type Cote } from "./composants/Univers"
import { useDepot, type Vue as VueUnivers } from "./composants/Tableau"

type Repli = { repli: boolean; raison: string | null; recu_le: number }
type Geste = "Réglages" | "Réessayer"

const BIBLIOTHEQUE_VIDE: Bibliotheque = {
  courant: null,
  projets: [],
  collections: [],
  sans_projet: { assets: 0, total_usd: 0 },
  total_usd: 0,
}

/** Poser une génération dans la liste **sans jamais la doubler**.
 *
 *  Deux chemins amènent la même génération à l'écran, et ils se croisent : la
 *  réponse du POST, et l'annonce du flux — que le serveur publie dès qu'il a
 *  enregistré, donc *avant* que le POST ne soit revenu. Insérer sans regarder
 *  d'un côté et fondre de l'autre laissait deux copies de tout ce qui était
 *  lancé depuis cet onglet. Elles restaient jumelles — la mise à jour les
 *  touchait toutes les deux — mais la clé React devenait double, et une clé
 *  double laisse des tuiles orphelines que le rendu suivant ne retire plus.
 *
 *  Le défaut ne survivait à aucun rechargement : le message d'état remplace la
 *  liste entière par celle du serveur, qui, lui, n'a jamais rien doublé. C'est
 *  ce qui l'a rendu invisible jusqu'à une séance faite au navigateur.
 */
const fondre = (liste: Generation[], recue: Generation): Generation[] =>
  liste.some((g) => g.identifiant === recue.identifiant)
    ? liste.map((g) => (g.identifiant === recue.identifiant ? recue : g))
    : [recue, ...liste]

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

export function App() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [catalogueRepli, setCatalogueRepli] = useState<Repli>({
    repli: false,
    raison: null,
    recu_le: 0,
  })
  // Ce qu'une image a coûté chez chaque modèle, mesuré sur les derniers appels
  // (US-121). Une mesure, jamais un tarif — le produit ne porte aucun prix de
  // catalogue, et il dit « jamais appelé » plutôt que d'inventer.
  const [couts, setCouts] = useState<Record<string, number>>({})
  const [compteReferences, setCompteReferences] = useState<CompteReferences | null>(
    null,
  )
  const [defaut, setDefaut] = useState<{
    modele: string | null
    options: Record<string, string>
  }>({ modele: null, options: {} })

  // Le chantier : ce qui tourne, et ce qu'un redémarrage a coupé. Ce qui a
  // réussi est en bibliothèque, ce qui a échoué est au journal du projet.
  const [chantier, setChantier] = useState<Generation[]>([])
  // La bibliothèque telle que le serveur l'a filtrée. C'est **lui** qui filtre :
  // la recherche doit porter sur tout, pas sur ce que cet onglet a en mémoire.
  const [grille, setGrille] = useState<Asset[]>([])
  const [bibliotheque, setBibliotheque] = useState<Bibliotheque>(BIBLIOTHEQUE_VIDE)
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE)
  /** La famille qu'on regarde dans la galerie, `""` pour toutes, `"aucune"`
   *  pour ce qui n'appartient à aucune chose du jeu (E4). */
  const [famille, setFamille] = useState("")
  const [selection, setSelection] = useState<string[]>([])
  const [annulation, setAnnulation] = useState<Annulation | null>(null)
  // **Le seul geste du produit dont le résultat n'arrive pas par le flux** :
  // une archive ne s'annonce pas, elle se télécharge. Ce drapeau ne sert
  // qu'à empêcher un second clic pendant que le premier fabrique le ZIP —
  // deux archives identiques dans les téléchargements pour un double-clic.
  const [exportEnCours, setExportEnCours] = useState(false)
  const [panne, setPanne] = useState<string | null>(null)
  const [liaison, setLiaison] = useState(true)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const [relecture, setRelecture] = useState(false)

  // ── Les trois onglets (E1) ────────────────────────────────────────────────
  //
  // **Un seul allumé à la fois, et rien ne se superpose.** Avant la V2.1, quatre
  // booléens indépendants — `universOuvert`, `personnagesOuverts`, et deux
  // autres — décidaient chacun de couvrir l'atelier : rien n'empêchait deux
  // écrans d'être « ouverts » ensemble, et le dessous était celui qui avait été
  // monté en dernier. Un seul état à trois valeurs rend cette question
  // impossible à poser.
  //
  // La galerie est l'onglet de départ : c'est l'écran qu'on regardait déjà en
  // arrivant, et un produit ne change pas d'accueil pour se réorganiser.
  const [onglet, setOnglet] = useState<Onglet>("galerie")

  // **L'écran des dépenses est une profondeur, pas un quatrième onglet** (E18).
  // Il s'ouvre depuis le total de la barre de tête, et le fil dit d'où l'on
  // vient : `Cœur de pierre › Les dépenses`. Il n'a pas de lieu à lui parce
  // qu'il ne parle d'aucun des trois — il parle de l'atelier entier.
  const [depensesOuvertes, setDepensesOuvertes] = useState(false)

  // **Chaque écran replie ses colonnes, et les nomme.** Une seule table pour
  // les trois : c'est la barre du châssis qui rend les bascules, et elle ne
  // rend que celles de l'onglet où l'on est. Les deux mots uniques d'avant —
  // `arbre` et `réglages` — servaient les quatre écrans et mentaient sur trois.
  const [replies, setReplies] = useState<Record<string, boolean>>({
    arbre: false,
    reglages: false,
    univers: false,
    reserve: false,
    familles: false,
    fiche: false,
  })

  // Ce que l'écran actif a à dire au moment du geste : un refus, ou le compte
  // rendu d'un balayage. **Une seule fente pour les trois onglets** — tant que
  // chaque écran couvrait les autres, chacun devait porter la sienne.
  const [fente, setFente] = useState<Fente>(null)

  // ── T4 : le tableau et l'univers ──────────────────────────────────────────
  //
  // Tenus ici, comme la grille et l'arbre, parce que **l'onglet n'a qu'un
  // abonnement** et qu'il vit ici. L'écran Univers les reçoit en propriétés : un
  // second abonnement ouvert à son ouverture se rebrancherait à chaque
  // aller-retour vers l'atelier.
  const [univers, setUnivers] = useState<Univers>(UNIVERS_VIDE)
  // ── Le plan de poses et les personnages du projet (C1) ────────────────────
  //
  // Tenus ici comme les cartes, et pour la même raison : **un seul endroit
  // écoute le flux**, pour toute la vie de l'onglet. Un second abonnement ouvert
  // à l'ouverture de l'écran Personnages se rebrancherait à chaque aller-retour
  // vers l'atelier, et le serveur renverrait l'état complet à chaque fois.
  const [plan, setPlan] = useState<Pose[]>([])
  // **Les directions du jeu** (E10) — l'autre liste que le jeu impose à tout le
  // monde, tenue ici pour la raison du plan : un seul endroit écoute le flux,
  // pour toute la vie de l'onglet. Elle arrive dans le même aller-retour, parce
  // qu'une case n'existe que par la direction qui la nomme.
  // **La rubrique ouverte du codex** (E15) — tenue ici parce que le fil
  // d'Ariane la nomme : cinq familles portent des choses, et un fil qui dirait
  // toujours *Personnages* mentirait dans quatre cas sur cinq.
  const [rubrique, setRubrique] = useState<Rubrique>("personnages")
  // **On ne rouvre l'assistant qu'une fois** (E19) : le message d'état repart à
  // chaque rebranchement du flux, et une porte qui se rouvre sous les doigts de
  // quelqu'un qui travaille n'est plus une porte.
  const premierLancementVu = useRef(false)
  // **Le champ qui nomme s'allume quand on sort de l'assistant** (E19). Un
  // compteur plutôt qu'un drapeau : deux sorties de suite doivent l'allumer deux
  // fois, et un booléen déjà à vrai ne redéclencherait rien.
  const [nommer, setNommer] = useState(0)
  const [directions, setDirections] = useState<DirectionsDuJeu>({
    directions: [],
    origine: "vue",
    vue: "",
    vue_libelle: "",
    proposees: [],
  })
  const [personnages, setPersonnages] = useState<Personnage[]>([])
  // **Le vestiaire du projet** (C3) — l'autre axe de la même matrice, tenu ici
  // pour la raison du plan : un seul endroit écoute le flux, pour toute la vie
  // de l'onglet. Il arrive dans le même aller-retour que le plan et les
  // personnages, parce qu'une colonne n'existe que par la pièce qui la nomme.
  const [emplacements, setEmplacements] = useState<EmplacementCorps[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  // **La case que le prochain appel remplira** (US-120). Armée depuis la
  // matrice, désarmée dès que l'appel est parti : c'est une intention qui vaut
  // pour *cette* génération, et une intention qui survivrait à son geste
  // enverrait la suivante dans une case que personne ne vise plus.
  // **Des identifiants, jamais des copies.** Une cible qui garderait l'objet
  // du moment où on l'a armée porterait un personnage périmé dès la première
  // description écrite : le nom affiché, ce qu'il écarte, ses concept arts —
  // tout cela continue de vivre ailleurs. On retient donc *lequel*, et on le
  // relit dans la liste que le flux tient à jour.
  //
  // **Une cible porte N cases depuis C2**, jamais une seule. Un lot est la même
  // intention que la case unique de C1 — *ce que le prochain appel remplira* —,
  // et en faire un second état aurait donné deux façons de dire la même chose,
  // qui se seraient contredites au premier désarmement. Une case armée est un
  // lot d'une case ; c'est le compte qui décide si l'appel se plie.
  //
  // **Et une pièce depuis C3**, quand ce qui est armé n'est plus « fabriquer ces
  // corps » mais « habiller ceux qui existent ». Le troisième champ du même état
  // plutôt qu'un état de plus : c'est la même intention — *ce que le prochain
  // appel remplira* —, et un second état se serait contredit avec celui-ci au
  // premier désarmement, comme le lot l'aurait fait avec la case unique.
  const [cible, setCible] = useState<{
    personnage: string
    poses: string[]
    piece?: string | null
    /** **La direction que cet appel remplira** (E10). Une case est une pose
     *  dans une direction, et c'est elle qui part avec la génération. */
    direction?: string | null
    /** **Les directions d'une planche de pose** (E13). Deux ou plus, et l'appel
     *  part en une planche d'une seule attitude vue sous N angles — la plus
     *  petite planche qui vaille la peine d'exister, et la plus courante : un
     *  jeu vu de dessus réclame quatre directions par pose.
     *
     *  Le quatrième champ du même état plutôt qu'un état de plus, pour la raison
     *  qui a déjà décidé des trois premiers : c'est la même intention — *ce que
     *  le prochain appel remplira* —, et un second état se serait contredit avec
     *  celui-ci au premier désarmement. */
    directions?: string[] | null
  } | null>(null)
  // **Ce que cette génération-ci n'envoie pas** (US-126). `null` — aucun avis,
  // donc les deux portées durables s'appliquent telles que le serveur les rend.
  // Il ne s'écrit nulle part : c'est la portée la plus étroite, elle vit dans
  // l'onglet et part avec l'appel — comme la pile d'annulation de la toile.
  const [ecarteesGeneration, setEcarteesGeneration] = useState<string[] | null>(null)

  // La case visée, relue dans ce que le flux tient à jour. Ni l'une ni l'autre
  // ne survit à sa disparition : un personnage supprimé, une pose retirée du
  // plan, et la bande s'efface — la case n'existe plus.
  const personnageCible =
    personnages.find((p) => p.identifiant === cible?.personnage) ?? null
  // **Dans l'ordre du plan, pas dans celui des clics.** C'est cet ordre-là que
  // la planche portera case par case, et c'est celui que l'auteur a sous les
  // yeux dans la matrice : deux ordres pour la même chose se contrediraient au
  // moment où l'on compare la planche à la colonne.
  const posesCible = plan.filter((p) => cible?.poses.includes(p.identifiant))
  // Deux ou plus, et l'appel se plie. En dessous, c'est la génération de C1 :
  // plier une seule case ferait payer un gabarit et une consigne de grille pour
  // une image que le produit sait déjà demander.
  //
  // **Sauf pour une pièce, où une seule case est déjà une planche** (C3). Il n'y
  // a pas d'autre chemin : un calque ne se fabrique que par une planche, fût-elle
  // d'une case, et l'image qu'elle porte est le corps — pas un gabarit vide.
  const pieceCible = cible?.piece ? (pieces.find((p) => p.identifiant === cible.piece) ?? null) : null
  // **La planche d'une pose** (E13) : une attitude, N directions. Deux ou plus,
  // et l'appel se plie exactement comme un lot de poses — c'est le *nombre de
  // cases* qui décide de plier, jamais ce qui les distingue les unes des autres.
  const directionsCible = cible?.directions ?? []
  const enPlanche = pieceCible === null && directionsCible.length >= 2
  const cases =
    pieceCible !== null
      ? posesCible.length
      : enPlanche
        ? directionsCible.length
        : posesCible.length >= 2
          ? posesCible.length
          : 0
  const [cartes, setCartes] = useState<Carte[]>([])
  // **Les traits et les teintes voyagent avec les cartes**, parce qu'ils
  // viennent de la même route : une toile se lit en un aller-retour. Tenus ici
  // et non dans l'écran Univers, comme les cartes elles-mêmes — un seul endroit
  // écoute le flux, pour toute la vie de l'onglet.
  const [liens, setLiens] = useState<Lien[]>([])
  const [teintes, setTeintes] = useState<Record<string, Teinte>>({})
  // Lequel des trois côtés de l'onglet Univers est allumé. **Monté ici avec la
  // V2.1** : la barre du châssis doit savoir quelles colonnes l'écran replie, et
  // la réserve n'a de colonne qu'en vue toile. Un état de navigation qui décide
  // du contenu d'une bande partagée ne peut plus vivre sous cette bande.
  const [vueUnivers, setVueUnivers] = useState<VueUnivers>("grille")
  // **Lequel des trois côtés de l'Univers est allumé** (E7). Monté ici pour la
  // même raison que la vue : la barre du châssis rend les bascules de repli de
  // l'écran actif, et il n'y en a qu'au côté Inspiration, en vue toile.
  const [coteUnivers, setCoteUnivers] = useState<Cote>("inspiration")

  // ── Le codex et sa profondeur (E2) ────────────────────────────────────────
  //
  // **Deux états, et ils ne disent pas la même chose.** *Choisie* est la chose
  // dont la colonne de droite parle — un clic sur sa carte. *Ouverte* est la
  // chose dans l'établi de laquelle on est descendu — un clic sur son nom, et le
  // fil d'Ariane s'allonge. Les confondre ferait descendre d'un étage au premier
  // regard porté sur une carte.
  //
  // **Des identifiants, jamais des objets** (`docs/PIEGES.md`) : un personnage
  // arrive par le flux à chaque image produite, et une copie gardée ici serait
  // celle d'avant.
  const [choseChoisie, setChoseChoisie] = useState<string | null>(null)
  const [choseOuverteId, setChoseOuverte] = useState<string | null>(null)
  /** L'image dont l'outil est ouvert **en plein cadre dans l'établi** (E2). Un
   *  identifiant, jamais l'objet : l'image continue d'arriver par le flux à
   *  chaque retouche, et une copie gardée ici serait celle d'avant. */
  const [caseOuverte, setCaseOuverte] = useState<string | null>(null)
  /** Quelle table est ouverte. **Elle survit au changement d'image** : on règle
   *  la même place sur six attitudes à la file, et refermer la table à chaque
   *  voisine ferait du geste six gestes. */
  const [table, setTable] = useState<Table>("detourage")
  /** L'image dont les tables sont ouvertes **depuis la galerie** (E4). C'est la
   *  seconde des deux portes de la fiche, et la seule qu'une image sans chose
   *  du jeu possède : les tables s'ouvrent sur n'importe quelle image. */
  const [tablesOuvertes, setTablesOuvertes] = useState<string | null>(null)
  /** Les réglages de l'appel, repliés au pied de la barre qui paie. Le repli
   *  vit dans le registre du châssis comme tous les autres : il survit au
   *  changement d'onglet, qui démonte l'écran (E1). */
  const [reglagesOuvertsDansLaBarre, setReglagesDansLaBarre] = usePli("barre.reglages")
  /** D'où vient ce qui est écrit dans le champ, quand ce n'est pas l'auteur.
   *  Posée en armant une case vide, effacée dès qu'on écrit dedans : un texte
   *  qu'on a repris à la main n'est plus une proposition. */
  const [provenance, setProvenance] = useState<string | null>(null)

  /** La chose ouverte, **relue dans la liste vivante**. Un personnage supprimé
   *  ou renommé ferme donc l'établi, ou l'y suit, sans qu'on écrive un mot. */
  const choseOuverte =
    personnages.find((p) => p.identifiant === choseOuverteId) ?? null

  /** L'image dont l'outil est ouvert, **relue dans les cases de la chose**. Une
   *  image retirée de sa case referme donc l'outil, et une image retouchée s'y
   *  montre à jour : la matrice est la seule vérité de cet écran. */
  /** L'image dont les tables sont ouvertes depuis la galerie, relue dans la
   *  grille — la seule vérité de cet onglet. */
  const imageDesTables =
    grille.find((a) => a.identifiant === tablesOuvertes) ?? null

  const imageOuverte =
    choseOuverte?.cases
      .flatMap((c) => [...c.images, ...Object.values(c.calques).flat()])
      .find((a) => a.identifiant === caseOuverte) ?? null

  // ── T5 : la découpe ───────────────────────────────────────────────────────
  //
  // **L'identifiant, jamais l'objet.** L'asset ouvert dans l'écran de découpe
  // continue d'arriver par le flux — une retouche, un rangement, un
  // réalignement de lot. Gardé en copie, il serait celui d'avant ; gardé en
  // identifiant, il se relit dans la grille, qui est la seule vérité de cet
  // onglet. Même règle que la fiche, et pour la même raison.
  const [decoupeOuverte, setDecoupeOuverte] = useState<string | null>(null)

  /** Le zoom de la grille — 1× / 2× / 4×, `docs/DESIGN.md` § Layout. Il n'est
   *  ni sauvegardé ni partagé : c'est un réglage de coup d'œil, pas une
   *  propriété de la bibliothèque. */
  const [zoom, setZoom] = useState<Zoom>(1)
  /** La largeur de la colonne centrale, **mesurée**. C'est elle qui décide
   *  quels crans de zoom tiennent. Zéro veut dire « pas encore mesurée » et non
   *  « nulle » : rien n'est grisé tant qu'on n'a pas regardé. */
  const [largeurCentre, setLargeurCentre] = useState(0)
  const centre = useRef<HTMLElement>(null)

  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [promptNegatif, setPromptNegatif] = useState("")
  /** **Le champ porte le texte entier, et il part mot pour mot** (US-159).
   *
   *  Deux états du même champ, pas deux champs : reprendre le texte, c'est
   *  continuer à écrire là où on écrivait — un second éditeur à côté aurait
   *  demandé de choisir lequel des deux part. */
  const [repris, setRepris] = useState(false)
  /** Ce qui partira, tel que le serveur le compose (US-158). `null` tant qu'il
   *  n'a pas répondu : le dépliant dit qu'il ne sait pas encore, jamais un
   *  texte deviné à l'écran. */
  const [apercuPrompt, setApercuPrompt] = useState<ApercuPrompt | null>(null)
  const [apercuRefus, setApercuRefus] = useState<string | null>(null)
  const [proportions, setProportions] = useState("1:1")
  const [variations, setVariations] = useState(1)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [reinjections, setReinjections] = useState<Reinjection[]>([])
  /** **Ce que l'auteur fabrique**, nommé dans le barème de son projet. Un seul
   *  contrôle, et il décide de trois choses : quels artworks partent en
   *  référence, quel modèle est le défaut, et quelle part de la case le sujet
   *  occupera. Vide est permis — un univers vide ne contraint rien (US-57). */
  const [echelle, setEchelle] = useState("")

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

  // **Le guide s'ouvre sur `?`**, et se ferme sur Échap comme tout écran du
  // produit. Jamais quand on est en train d'écrire : le champ de prompt et les
  // notes de carte prennent la touche avant lui.
  const guideOuvert = useGuide()

  // **L'aperçu est branché ici, et une seule fois.** Il se pose au-dessus de
  // tout — l'atelier, l'Univers, la Découpe, le Guide —, donc son écoute de
  // touche vit au-dessus de tous les écrans. Ce qu'il montre lui vient des
  // vignettes elles-mêmes, sans traverser cet étage : le pointeur dit ce qu'il
  // vise, personne n'a à le faire descendre.
  const apercu = useApercu()

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return
      const cible = e.target as HTMLElement | null
      const saisie =
        cible?.tagName === "INPUT" ||
        cible?.tagName === "TEXTAREA" ||
        cible?.isContentEditable
      if (saisie) return
      e.preventDefault()
      ouvrirGuide()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [])

  // **Ce que le flux a besoin de savoir, sans le faire se rebrancher.**
  //
  // L'abonnement est ouvert **une fois par onglet**, et il le reste : c'est la
  // promesse de T1, « on se branche une fois, on écoute ». Mettre le filtre, le
  // projet ouvert ou les proportions dans les dépendances de l'effet aurait
  // fermé la liaison et en aurait rouvert une à chaque changement — donc à
  // chaque frappe dans le champ de recherche —, et le serveur aurait renvoyé
  // l'état complet à chaque fois. Un ref porte donc ce qui bouge, et l'effet ne
  // dépend de rien.
  const vivant = useRef({
    filtre: FILTRE_VIDE,
    courant: null as string | null,
    relireCatalogue: async () => {},
    relireGrille: async () => {},
    relireEtat: async () => {},
    fondrePersonnage: (_recu: Personnage & { supprime?: boolean }) => {},
    relireProduction: async () => {},
    personnages: [] as Personnage[],
  })

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

  // **Et à chaque geste qui change la largeur.** Le repli d'un panneau et
  // l'ouverture de la fiche déplacent les colonnes ; la transition de 160 ms
  // fait que la mesure prise ici est celle d'**avant**, et c'est
  // `onTransitionEnd` qui pose la bonne. Les deux servent : sans celle-ci, un
  // onglet où les transitions ne s'exécutent pas ne remesurerait jamais.
  // `onglet` en dépendance parce que la galerie se **démonte** quand un autre
  // onglet est allumé (E1) : sans cette ligne, la largeur mesurée resterait
  // celle d'avant le départ, et le grisé du zoom mentirait au retour.
  useLayoutEffect(mesurerCentre, [
    mesurerCentre,
    replies.arbre,
    fiche,
    onglet,
  ])

  const echouer = (erreur: unknown, defaut_: string) =>
    setPanne(erreur instanceof Refus ? erreur.message : defaut_)

  // ── Ce que l'atelier sait de lui-même ─────────────────────────────────────

  // Le catalogue est le seul appel que l'interface refait d'elle-même : la
  // liste des modèles dépend de la demande en cours — les proportions, le
  // **nombre d'images réinjectées**, et depuis T4 **le sujet**, qui décide des
  // artworks qui partent —, et c'est le serveur qui décide du grisé de chacun.
  // Tout le reste arrive par le flux.
  const relireCatalogue = useCallback(async () => {
    try {
      const catalogue = await api.modeles(
        proportions,
        reinjections.length,
        echelle,
        // **Le personnage visé décide de ce qui part** : ses concept arts
        // rejoignent les artworks, et ce qu'il écarte s'applique. Le compte
        // vient donc du serveur avec la case sous les yeux.
        cible?.personnage ?? "",
        // **Le lot armé décide de deux choses au serveur** : le gabarit compte
        // dans le plafond du modèle — c'est une image qui part vraiment —, et
        // le défaut devient le modèle de planche du projet plutôt que celui de
        // la famille du sujet.
        cases,
        // **Et la pièce armée** : ses concept arts partent avec l'appel, et le
        // défaut devient le modèle d'édition du projet — habiller un corps est
        // une édition, pas une création de planche.
        cible?.piece ?? "",
      )
      setModeles(catalogue.modeles)
      setDefaut(catalogue.defaut)
      // Le compte qui partira vraiment, artworks compris et dédoublonné. Il
      // vient d'ici et jamais d'une addition faite à l'écran : l'écran ne
      // connaît pas les artworks, et deux comptes finiraient par diverger.
      setCompteReferences(catalogue.references)
      setCouts(catalogue.couts ?? {})
      setCatalogueRepli({
        repli: catalogue.repli,
        raison: catalogue.raison,
        recu_le: catalogue.recu_le,
      })
      setPanne(null)
    } catch (erreur) {
      echouer(erreur, "l'atelier ne répond pas")
    }
  }, [proportions, reinjections.length, echelle, cible?.personnage, cases])

  useEffect(() => {
    void relireCatalogue()
  }, [relireCatalogue])

  // ── Ce qui partira, tel que le serveur le compose ─────────────────────────
  //
  // « Avant de lancer, le texte exact qui partira s'affiche » (US-158). Il est
  // **demandé**, jamais recomposé ici : la bible se replie en tête et les
  // consignes de planche en queue à un seul endroit du dépôt, et c'est celui
  // que la soumission emprunte. Un aperçu écrit à l'écran aurait été une
  // seconde vérité sur ce qui part, et « celle qui compte est celle qui part ».
  //
  // **Attendu 140 ms, et c'est la frappe qui le veut.** Le catalogue se
  // redemande sur des choix — un modèle, des proportions, une case — qui ne
  // partent jamais lettre par lettre ; celui-ci suit un champ de texte. L'appel
  // ne sort pas de la machine et n'écrit rien, mais un aller-retour par
  // caractère ferait clignoter le dépliant sous la main.
  //
  // Il ne tourne **pas** quand le texte est repris : le champ *est* alors ce qui
  // partira, et demander au serveur de composer ce qu'on est en train d'écrire
  // n'aurait rien à rendre de plus.
  useEffect(() => {
    if (repris) {
      setApercuPrompt({ texte: prompt, parties: [{ origine: "repris", texte: prompt }] })
      setApercuRefus(null)
      return
    }
    let vivant = true
    const minuterie = window.setTimeout(async () => {
      try {
        const recu = await api.apercuPrompt({
          prompt,
          projet: bibliotheque.courant,
          personnage: cible?.personnage ?? null,
          poses:
            cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
          piece: cible?.piece ?? null,
          // **La planche d'une pose passe par le même pliage que l'envoi**
          // (E13) : l'aperçu montre alors les consignes de case, une par
          // direction, exactement celles qui partiront.
          pose: enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
          directions: enPlanche ? directionsCible : null,
        })
        if (!vivant) return
        setApercuPrompt(recu)
        setApercuRefus(null)
      } catch (erreur) {
        if (!vivant) return
        // **Le refus va dans le dépliant, jamais dans la fente du bas.** Une
        // case de lot qui a disparu se dit là où on regarde le texte ; la
        // fente, elle, porte ce qui empêche de générer, et le bouton a sa
        // propre raison.
        setApercuRefus(
          erreur instanceof Refus ? erreur.message : "l'atelier ne répond pas",
        )
      }
    }, 140)
    return () => {
      vivant = false
      window.clearTimeout(minuterie)
    }
    // `univers` n'est pas lu ici, mais il est **la** dépendance qui compte : un
    // champ de bible décoché change ce qui part sans toucher au prompt, et il
    // arrive par le flux (R1). Sans lui, décocher ne se verrait pas dans
    // l'aperçu — le défaut exact que R1 vient de corriger, un cran plus loin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Les poses **jointes** et non le tableau : `posesCible` se refabrique à
    // chaque rendu, et deux lots de même taille sur des cases différentes
    // n'enverraient pas les mêmes noms dans les consignes de planche.
  }, [
    prompt,
    repris,
    bibliotheque.courant,
    cible?.personnage,
    cible?.poses.join("·"),
    // Les directions **jointes** et non le tableau, pour la raison exacte qui
    // vaut pour les poses : il se refabrique à chaque rendu, et deux planches de
    // même taille sur des angles différents n'enverraient pas les mêmes
    // consignes de case.
    directionsCible.join("·"),
    enPlanche,
    cases,
    univers,
  ])

  // ── La grille ─────────────────────────────────────────────────────────────
  //
  // Elle se redemande quand le filtre change, et **seulement** alors. Le
  // filtrage vit côté serveur : le rejouer ici sur les deux cents assets que cet
  // onglet a en mémoire ferait dire à la recherche autre chose qu'à la
  // bibliothèque, et c'est exactement la divergence relevée chez SpriteCook.

  const relireGrille = useCallback(async () => {
    try {
      const { assets } = await api.assets({
        ...filtre,
        sansProjet: bibliotheque.courant === null,
      })
      setGrille(assets)
    } catch (erreur) {
      echouer(erreur, "la bibliothèque ne répond pas")
    }
  }, [filtre, bibliotheque.courant])

  useEffect(() => {
    void relireGrille()
  }, [relireGrille])

  // ── Le tableau d'inspiration ──────────────────────────────────────────────
  //
  // Il se redemande quand le projet ouvert change, et **seulement** alors : le
  // tableau appartient à son projet, et un tableau tenu en mémoire pendant qu'on
  // change d'univers montrerait les inspirations d'un autre jeu.

  // **Les groupes ne se tiennent pas à côté des cartes.** La route les rend, et
  // c'est juste au chargement ; mais depuis T8 composer *écrit* un groupe à
  // chaque glissement, et une liste posée une fois serait fausse avant la fin du
  // premier geste. Elle se lit donc sur les cartes que l'écran tient — mêmes
  // cartes, même règle, une seule liste (`Tableau.tsx` § `groupesDe`).
  const relireTableau = useCallback(async () => {
    try {
      const toile = await api.tableau()
      setCartes(toile.cartes)
      setLiens(toile.liens)
      setTeintes(toile.teintes)
    } catch (erreur) {
      echouer(erreur, "le tableau ne répond pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireTableau()
  }, [relireTableau])

  /** **Un personnage se fond par identifiant, jamais ne s'empile.**
   *
   *  Il arrive par deux chemins qui se croisent — la réponse de l'appel et
   *  l'annonce du flux —, comme une génération en T1 et une carte en T4. Une
   *  seule fonte, appelée des deux côtés : deux fusions écrites à deux endroits
   *  finiraient par ne plus traiter le même cas (`docs/PIEGES.md`). */
  const fondrePersonnage = useCallback(
    (recu: Personnage & { supprime?: boolean }) =>
      setPersonnages((liste) => {
        if (recu.projet !== vivant.current.courant)
          return liste.filter((p) => p.identifiant !== recu.identifiant)
        if (recu.supprime)
          return liste.filter((p) => p.identifiant !== recu.identifiant)
        return liste.some((p) => p.identifiant === recu.identifiant)
          ? liste.map((p) => (p.identifiant === recu.identifiant ? recu : p))
          : [...liste, recu]
      }),
    [],
  )

  // ── Le plan et les personnages ────────────────────────────────────────────
  //
  // Redemandés quand le projet ouvert change, et **seulement** alors — comme le
  // tableau : un plan appartient à son jeu, et celui d'un autre univers n'a rien
  // à faire à l'écran. Les deux arrivent **en un seul aller-retour** : une
  // colonne de cases n'existe que par le plan qui la nomme.
  const relireProduction = useCallback(async () => {
    try {
      const production = await api.production()
      setPlan(production.plan)
      setDirections({
        directions: production.directions,
        origine: production.origine,
        vue: production.vue,
        vue_libelle: production.vue_libelle,
        proposees: production.proposees,
      })
      setPersonnages(production.personnages)
      setEmplacements(production.emplacements)
      setPieces(production.pieces)
    } catch (erreur) {
      echouer(erreur, "les personnages ne répondent pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireProduction()
  }, [relireProduction])

  /** Redemander ce que le serveur grise — et lui seul.
   *
   *  La quantification s'allume quand une palette existe (US-65), et c'est le
   *  serveur qui écrit cette phrase-là. L'écran pourrait la déduire de
   *  `univers.palette` ; il ne le fait pas, parce que « l'interface affiche la
   *  raison qu'elle reçoit, elle ne rejoue jamais la règle de son côté ». */
  const relireEtat = useCallback(async () => {
    try {
      setEtat(await api.etat())
    } catch {
      // Muet : l'état complet revient de toute façon au prochain rebranchement
      // du flux, et une panne a déjà sa phrase ailleurs.
    }
  }, [])

  /** L'univers tel que l'onglet le tient, en une chaîne. Un `ref` et non un
   *  état : il ne rend rien, il ne sert qu'à répondre « est-ce que ce message
   *  change quelque chose ? » au moment où le message arrive. */
  const empreinteUnivers = useRef("")

  // Posé à chaque rendu, lu par le flux : le seul but est de tenir l'abonnement
  // ouvert pendant que ce qu'il consulte, lui, change. Écrit **après** les
  // fonctions qu'il porte — une constante lue avant sa déclaration lève.
  vivant.current = {
    filtre,
    courant: bibliotheque.courant,
    relireCatalogue,
    relireGrille,
    relireEtat,
    fondrePersonnage,
    relireProduction,
    personnages,
  }

  // ── Le flux d'événements ──────────────────────────────────────────────────
  //
  // Plus aucun sondage. On se branche une fois, on écoute, et l'atelier dit ce
  // qu'il fait au moment où il le fait. Le premier message est l'état complet :
  // c'est lui qui fait qu'un onglet rouvert retrouve les images produites
  // pendant son absence — et `EventSource` se rebranche seul, donc une veille
  // de machine ou un redémarrage du serveur se rattrapent sans rien recharger.

  useEffect(() => {
    return ecouter({
      etat: (recu) => {
        setEtat(recu)
        // **L'atelier neuf ouvre l'assistant** (E19) — la seule minute que
        // personne ne revoit jamais. Une seule fois par onglet : ce message
        // repart à chaque rebranchement du flux, et rouvrir l'assistant sous
        // les doigts de quelqu'un qui travaille serait une porte qui se referme
        // sur lui. Le serveur, lui, dit un fait — *l'atelier n'a encore rien* —
        // et il cesse d'être vrai au premier geste.
        if (recu.premier_lancement && !premierLancementVu.current) {
          premierLancementVu.current = true
          setOnglet("univers")
          setCoteUnivers("reglages")
        }
        setBibliotheque(recu.bibliotheque)
        setUnivers(recu.univers ?? UNIVERS_VIDE)
        empreinteUnivers.current = JSON.stringify(recu.univers ?? UNIVERS_VIDE)
        if (recu.generations) setChantier(recu.generations)
        if (recu.assets) setGrille(recu.assets)
        // Ce message part **une fois par abonnement**, donc à chaque
        // rebranchement. Son catalogue fait autorité sur celui que l'onglet
        // gardait : sans ça, un serveur redémarré pendant une veille laisse la
        // barre d'état dater une photo qui n'existe plus.
        setCatalogueRepli(recu.catalogue)
        // Et son arrivée **prouve** que l'atelier répond : une panne posée
        // pendant son absence est un fait périmé.
        setPanne(null)
      },
      generation: (recue) => setChantier((liste) => fondre(liste, recue)),
      asset: (recu) => {
        setGrille((liste) =>
          fondreAsset(liste, recu, vivant.current.filtre, vivant.current.courant),
        )
        // **Une image qui porte une case peut la remplir ou la vider**, et les
        // cases se calculent sur les assets — que cet onglet ne tient pas : il
        // n'en a qu'une page, filtrée sur autre chose. On redemande donc, et
        // seulement pour les images qui **concernent** une case : celle qui en
        // porte une, et celle qui vient d'en quitter une, reconnue parce que la
        // matrice la montre encore.
        const concerne =
          recu.personnage ||
          vivant.current.personnages.some((p) =>
            p.cases.some((c) =>
              c.images.some((i) => i.identifiant === recu.identifiant),
            ),
          )
        if (concerne) void vivant.current.relireProduction()
      },
      bibliotheque: setBibliotheque,
      // **Une carte se fond par identifiant, jamais ne s'empile.** Elle arrive
      // par deux chemins qui se croisent — la réponse du POST et l'annonce du
      // flux —, exactement comme une génération en T1. Et comme un asset, elle
      // doit être confrontée à ce qu'on regarde : une carte d'un autre projet
      // n'entre pas dans le tableau du projet ouvert.
      carte: (recue) =>
        setCartes((liste) => {
          if (recue.projet !== vivant.current.courant)
            return liste.filter((c) => c.identifiant !== recue.identifiant)
          if (recue.oubliee)
            return liste.filter((c) => c.identifiant !== recue.identifiant)
          return liste.some((c) => c.identifiant === recue.identifiant)
            ? liste.map((c) => (c.identifiant === recue.identifiant ? recue : c))
            : [recue, ...liste]
        }),
      // **Un lien est né, a été nommé, ou coupé.** Il se fond par identifiant,
      // jamais ne s'empile : il arrive par deux chemins qui se croisent — la
      // réponse du POST et l'annonce du flux —, exactement comme une génération
      // en T1 et comme une carte en T4. Un lien coupé porte `coupe`, et un lien
      // dont une extrémité a disparu arrive par ce message-là, coupé : c'est le
      // serveur qui tient la règle, l'écran ne la rejoue jamais.
      lien: (recu) =>
        setLiens((liste) => {
          if (recu.projet !== vivant.current.courant)
            return liste.filter((un) => un.identifiant !== recu.identifiant)
          if (recu.coupe)
            return liste.filter((un) => un.identifiant !== recu.identifiant)
          return liste.some((un) => un.identifiant === recu.identifiant)
            ? liste.map((un) => (un.identifiant === recu.identifiant ? recu : un))
            : [...liste, recu]
        }),
      // **Un personnage se fond par identifiant, jamais ne s'empile** — même
      // règle que la carte et le lien, et pour la même raison : il arrive par
      // deux chemins qui se croisent, la réponse de l'appel et l'annonce du
      // flux. Un personnage supprimé porte `supprime`, et il est confronté au
      // projet ouvert comme tout ce qui appartient à un projet.
      personnage: (recu) => vivant.current.fondrePersonnage(recu),
      // Ce que le projet n'envoie plus. Un genre à lui : `univers` fait
      // redemander l'état *et* le catalogue depuis T4, et une case décochée n'a
      // aucune raison de coûter deux appels réseau.
      references: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        void vivant.current.relireCatalogue()
      },
      // **Le plan arrive entier**, et il remplace : il est court, et une pose
      // retirée ne se devinerait pas d'un message qui ne porterait que les
      // ajouts. Une pose ajoutée fait paraître une case chez chaque personnage
      // sans qu'aucun personnage soit annoncé — c'est ce que « le plan décide,
      // le personnage soustrait » veut dire, vu du flux.
      //
      // **Et depuis E9, ce que chaque chose réclame est calculé par le
      // serveur** : le type décide de la liste, la chose la complète, et la
      // règle a quatre branches. L'écran ne la rejoue pas — il redemande la
      // production, qui rend le plan et les choses **en un seul aller-retour**,
      // exactement comme au premier chargement. Poser le plan seul aurait
      // laissé les choses avec la liste d'avant, et une attitude neuve ne
      // serait apparue nulle part.
      plan: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        setPlan(recu.plan)
        void vivant.current.relireProduction()
      },
      // **Les directions arrivent entières**, comme le plan et pour les mêmes
      // deux raisons : la liste est courte, et une direction retirée ne se
      // devinerait pas d'un message qui ne porterait que les ajouts. Les cases
      // se redemandent avec, parce qu'une case est une pose *dans une
      // direction* : poser la liste seule aurait laissé les rangées d'avant.
      directions: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        setDirections({
          directions: recu.directions,
          origine: recu.origine,
          vue: recu.vue,
          vue_libelle: recu.vue_libelle,
          proposees: recu.proposees,
        })
        void vivant.current.relireProduction()
      },
      // **Le vestiaire arrive entier**, et il remplace — même règle que le plan,
      // et pour les mêmes deux raisons : il est court, et une pièce retirée ne se
      // devinerait pas d'un message qui ne porterait que les ajouts. Un genre à
      // lui plutôt qu'un champ sur `univers`, qui fait redemander l'état *et* le
      // catalogue depuis T4 : renommer une pièce n'a aucune raison de coûter deux
      // appels réseau.
      vestiaire: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        setEmplacements(recu.emplacements)
        setPieces(recu.pieces)
      },
      // Un seul message pour un lot entier : palette recalculée, réglage posé,
      // ou balayage terminé. La grille se redemande alors — c'est le troisième
      // et dernier appel que l'interface refait d'elle-même, et il porte sur des
      // rendus dont l'empreinte vient de changer.
      univers: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        setUnivers(recu.univers)
        setTeintes(recu.teintes)
        // Un balayage a changé des recettes, donc des empreintes, donc les
        // adresses des rendus : la grille se redemande une fois, pour le lot.
        if (recu.realignes) void vivant.current.relireGrille()
        // **Deux appels réseau, et seulement si l'univers a vraiment changé.**
        // Ce message porte désormais aussi les teintes d'îlot (T9), qui ne sont
        // pas dans l'univers et ne changent ni le grisé ni ce qui partira :
        // colorer un îlot aurait redemandé l'état *et* le catalogue pour une
        // couleur. La règle des deux lignes ci-dessous n'a pas bougé — c'est sa
        // condition qui manquait, parce que jusqu'ici « un message `univers` est
        // arrivé » et « l'univers a changé » étaient la même chose.
        const signature = JSON.stringify(recu.univers)
        if (signature === empreinteUnivers.current) return
        empreinteUnivers.current = signature
        // Et le grisé de la quantification suit la palette : c'est le serveur
        // qui l'écrit, l'écran ne rejoue jamais la règle.
        void vivant.current.relireEtat()
        // **Et le catalogue, parce que promouvoir change ce qui partira.**
        // Trouvé en ouvrant l'atelier, pas au banc : le bloc « Ce qui part »
        // annonçait zéro référence alors que le serveur en comptait une, et il
        // ne se corrigeait qu'au premier changement de sujet. La règle de T1
        // n'avait pas bougé — « le catalogue se redemande parce que le grisé de
        // chaque modèle dépend de la demande en cours » —, c'est la demande qui
        // a gagné une composante que l'écran ne pilote pas.
        void vivant.current.relireCatalogue()
      },
      catalogue: (recu) => {
        setCatalogueRepli(recu)
        // Le repli change ce que chaque modèle peut honorer : la liste, elle,
        // se redemande — c'est le serveur qui écrit les raisons du grisé.
        void vivant.current.relireCatalogue()
      },
      // **Le cadre de l'agent bouge sans que l'écran ait rien fait** : c'est
      // l'agent qui dépense, et c'est un autre onglet qui a peut-être relevé le
      // plafond. Rien d'autre à redemander — la charge porte le cadre entier et
      // sa consommation, et rien ici ne les recalcule.
      agent: (agent) => setEtat((e) => (e ? { ...e, agent } : e)),
      liaison: setLiaison,
    })
  }, [])

  // ── Le modèle choisi reste choisi ─────────────────────────────────────────
  // Même devenu invalide : c'est générer qui devient inactif, avec sa raison.
  // Aucune substitution silencieuse (US-9).

  const modele = useMemo(
    () => modeles.find((m) => m.identifiant === modeleChoisi) ?? null,
    [modeles, modeleChoisi],
  )

  useEffect(() => {
    if (modeleChoisi || !defaut.modele) return
    setModeleChoisi(defaut.modele)
    setOptions((precedentes) => ({ ...defaut.options, ...precedentes }))
  }, [defaut, modeleChoisi])

  // ── Ce que la grille montre ───────────────────────────────────────────────

  const entrees = useMemo<Entree[]>(() => {
    const parCle = new Map<string, Entree>()
    // Le chantier d'abord : il tient sa place **avant** que l'image n'existe.
    // Il ne paraît pas quand un filtre est posé — un lot qui n'est pas encore
    // arrivé n'a rien à quoi un filtre puisse s'appliquer, et le faire
    // apparaître dans une recherche mentirait sur ce qu'elle a trouvé.
    if (!filtreActif(filtre)) {
      for (const generation of chantier) {
        for (const emplacement of generation.emplacements) {
          if (emplacement.statut === "reussie") continue
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
    // à la même clé et donc à la même place.
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
    return [...parCle.values()].sort(
      (a, b) => b.date - a.date || a.rang - b.rang,
    )
  }, [chantier, grille, filtre, famille])

  // ── La raison qui rend générer inactif ────────────────────────────────────

  // Le refus porte **son geste** : chaque raison sait où elle mène, quand il y
  // a un endroit où aller. « Le grisé porte sa raison — jamais une infobulle. »
  const refus = useMemo<{ texte: string; geste?: Geste } | null>(() => {
    if (panne) return { texte: panne }
    if (!liaison) return { texte: "l'atelier ne répond pas" }
    if (!etat?.cle.presente)
      return {
        texte: etat?.cle.raison ?? "aucune clé OpenRouter",
        geste: "Réglages",
      }
    if (modeles.length === 0)
      return { texte: "le catalogue n'a jamais été reçu", geste: "Réessayer" }
    if (!modele) return { texte: "aucun modèle choisi" }
    if (modele.refus) return { texte: `${modele.nom} ${modele.refus}` }
    if (!prompt.trim()) return { texte: "aucun prompt" }
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95).
    return null
  }, [panne, liaison, etat, modeles, modele, prompt])

  // ── Générer ───────────────────────────────────────────────────────────────

  const generer = async () => {
    if (refus || !modele) return
    // L'identifiant est fabriqué ici : c'est lui qui empêche une double
    // soumission de facturer deux fois, même si le clic part deux fois.
    const identifiant = crypto.randomUUID().replace(/-/g, "")
    const retenues = Object.fromEntries(
      Object.entries(options).filter(([nom]) => nom in modele.options),
    )
    try {
      const generation = await api.generer({
        // **La case visée, quand la matrice a armé** (US-120). L'image qui
        // reviendra y tombera d'elle-même : personne n'a à la ranger, et une
        // relance de cet appel visera toujours la même case.
        personnage: cible?.personnage ?? null,
        // **Une case ou N, et la même route** (US-128). Il n'existe qu'un seul
        // endroit d'où l'on paie dans tout le produit : une seconde route pour
        // les lots en aurait fait deux, et l'invariant de C1 serait tombé le
        // jour où elle serait apparue. C'est le compte qui décide, pas l'écran.
        // **Une planche de pose garde sa pose** : c'est elle qui porte
        // l'attitude commune aux N cases, et les directions qui les
        // distinguent partent à côté.
        pose:
          !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
        // **Et sous quel angle** (E10). L'image qui reviendra tombe dans la
        // case *et* dans la direction, sans que personne ait à l'y ranger. Vide
        // pour un lot, qui vise N cases : c'est `poses` qui les nomme.
        direction: cases ? null : (cible?.direction ?? null),
        // **Les angles d'une planche de pose** (E13). Chaque case sait déjà
        // dans quelle direction son image se rangera — le rangement cesse
        // d'être un geste séparé qu'on peut oublier, puisque c'est une
        // condition de l'appel.
        directions: enPlanche ? directionsCible : null,
        poses:
          cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
        // **La pièce que cet appel pose** (C3, US-140). Elle fait de la planche
        // une planche d'*équipement* : elle part pleine des corps que `poses`
        // désigne, et ce qui revient est comparé case par case à ce qui est
        // parti. Sans elle, la même route crée des corps — c'est C2.
        piece: cible?.piece ?? null,
        // **Ce que cette génération-ci écarte.** `null` laisse parler les deux
        // portées durables — c'est ce que reçoit un agent, qui n'a pas de
        // panneau devant lui.
        references_ecartees: ecarteesGeneration,
        modele: modele.identifiant,
        prompt: prompt.trim(),
        prompt_negatif: promptNegatif.trim(),
        proportions,
        // **Un lot part en un seul appel, et l'écran envoie ce qu'il affiche.**
        // Le segment est éteint quand un lot est armé, mais la valeur d'avant
        // vit encore dans l'état : sans cette ligne, un « 4 » choisi puis un lot
        // coché enverraient 4 pendant que l'écran montre 1 — et le refus
        // arriverait après le clic qui paie, ce que le grisé existe pour éviter.
        variations: cases ? 1 : variations,
        options: retenues,
        identifiant,
        references: reinjections,
        // Le sujet : c'est lui qui décide des artworks qui partent, du modèle
        // par défaut et de la part de case que l'image occupera.
        echelle,
        // **Le texte part mot pour mot** (US-160). Il ne touche qu'au texte :
        // l'échelle ci-dessus décide toujours des artworks, du modèle par
        // défaut et de l'occupation, et le gabarit d'un lot part toujours.
        repris,
      })
      // Le flux l'a peut-être déjà annoncée — on fond, on n'empile pas.
      setChantier((liste) => fondre(liste, generation))
      // L'avis de cette génération-là est parti avec elle : le suivant se
      // reprend aux portées durables, comme au premier prompt de la séance.
      setEcarteesGeneration(null)
      // **La cible se désarme dès que l'appel est parti.** C'est une intention
      // qui vaut pour *cette* génération : la garder enverrait l'image suivante
      // — un tonneau, un décor — dans la case d'un personnage, sans que rien
      // ne l'ait demandé. On réarme d'un clic depuis la matrice.
      setCible(null)
    } catch (erreur) {
      echouer(erreur, "génération refusée")
    }
  }

  /** Armer l'atelier sur une case (US-120).
   *
   *  **Rien n'est dépensé ici.** Le prompt reçoit le signalement du personnage
   *  et le nom de l'attitude — c'est très exactement ce qu'on ne veut plus
   *  retaper (US-115) —, la case est retenue, et l'écran rend la main. C'est le
   *  bouton Générer de l'atelier qui paie.
   *
   *  Le prompt est **remplacé**, pas complété : cliquer « Fabriquer » sur une
   *  case est sans ambiguïté, et laisser dessous un début de phrase écrit pour
   *  autre chose ferait partir les deux ensemble.
   *
   *  Le **sujet**, lui, n'est pas touché : c'est le choix de l'auteur, et le
   *  produit ne devine pas à sa place — il n'y a pas de famille « personnages »
   *  imposée dans un barème qu'il a pu renommer.
   */
  const armer = async (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    directions?: string[] | null,
  ) => {
    if (poses.length === 0) return
    // **Une planche de pose vise N angles d'une seule attitude** (E13). Deux ou
    // plus, et l'appel se plie ; une seule, et c'est la case de C1 — que
    // `direction` désigne, et qui n'a jamais changé.
    const angles = directions && directions.length >= 2 ? directions : null
    setCible({
      personnage: personnage.identifiant,
      poses: poses.map((p) => p.identifiant),
      piece: piece?.identifiant ?? null,
      // **Et sous quel angle** (E10) : la case visée est une pose *dans une
      // direction*, et c'est elle que l'appel remplira.
      direction: angles ? null : (direction ?? null),
      directions: angles,
    })
    // **Le prompt reçoit le sujet, jamais la grille** — et c'est le serveur qui
    // l'écrit depuis C5. Les trois règles (une case : le signalement et
    // l'attitude ; un lot : le signalement seul, les attitudes partant dans les
    // consignes de planche ; une pièce : sa description seule, parce que le
    // corps est *dans l'image* qui part) vivent dans le service, où l'agent les
    // lit aussi. Deux compositions à deux endroits auraient fini par demander
    // deux choses différentes pour la même case, sans que rien ne le signale.
    //
    // **Un refus n'empêche pas d'armer.** La case est visée, l'atelier est
    // ouvert, et le champ reste à écrire : c'est un geste local et gratuit, pas
    // une dépense — le vider et laisser la main est moins coûteux que de
    // renvoyer l'auteur d'où il vient.
    try {
      const recu = await api.sujetDeCase({
        personnage: personnage.identifiant,
        poses: poses.map((p) => p.identifiant),
        piece: piece?.identifiant ?? null,
        direction: angles ? null : (direction ?? null),
        // Deux ou plus, et le sujet redevient le signalement seul : les
        // attitudes et les angles partent case par case dans les consignes de
        // planche, et les écrire aussi ici les dirait deux fois.
        directions: angles ?? [],
        projet: bibliotheque.courant,
      })
      setPrompt(recu.sujet)
      // **Ce qui est devinable est prérempli avec sa provenance**, et se défait
      // d'un clic (E2). Le revers de la règle du grisé, qui dit sa raison
      // depuis T1 : un champ prérempli n'est pas un champ décidé.
      setProvenance(
        angles
          ? `proposé, d'après son signalement · les consignes des ${angles.length} directions partent case par case · modifiable`
          : poses.length > 1
            ? `proposé, d'après son signalement et les consignes de ${poses.length} poses · modifiable`
            : `proposé, d'après son signalement et la consigne de la pose · modifiable`,
      )
    } catch {
      setPrompt("")
      setProvenance(null)
    }
    // **Armer rend la main à l'atelier.** Ce qui vient d'être posé dans le
    // champ est un *sujet*, pas un texte complet : le laisser en mode repris
    // ferait partir un signalement de personnage sans la bible ni les
    // consignes de planche — c'est-à-dire sans rien de ce que la matrice
    // arme.
    setRepris(false)
    // **Armer ne déplace plus personne.** Le geste dit « pour cette case-là »,
    // et la barre qui paie est déjà sous la main : elle est au pied de
    // l'établi, à quelques pixels de la case qu'on vient d'armer. Jusqu'en E2
    // il fallait retourner à la galerie, seul endroit qui portait un champ.
  }

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

  const supprimer = async (identifiants: string[]) => {
    if (identifiants.length === 0) return
    try {
      const rendu = await api.supprimerAssets(identifiants)
      setAnnulation({ identifiants: rendu.supprimes, expireLe: rendu.expire_le })
      setSelection([])
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "suppression refusée")
    }
  }

  const annuler = async () => {
    if (!annulation) return
    try {
      await api.restaurer(annulation.identifiants)
      setAnnulation(null)
      await relireGrille()
    } catch (erreur) {
      setAnnulation(null)
      echouer(erreur, "annulation refusée")
    }
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

  // ── Réinjecter ────────────────────────────────────────────────────────────

  /** Faire repartir une image avec le prochain appel.
   *
   *  **Le geste va où son effet se voit** (E2). La bande *Repart avec* et le
   *  champ de prompt vivent au pied du codex et de l'établi, et plus dans la
   *  galerie — qui juge et ne paie jamais. Réinjecter depuis la fiche d'une
   *  image sans changer d'onglet laisserait l'auteur devant un geste dont rien
   *  n'a bougé à l'écran, ce que le produit refuse partout ailleurs. */
  const reinjecter = (asset: string, role: Role) => {
    setReinjections((deja) => [
      ...deja.filter((r) => r.asset !== asset),
      { asset, role },
    ])
    setOnglet("codex")
  }

  /** Le quatrième rôle : reprendre les réglages, sans envoyer d'image.
   *
   *  **Le texte revient repris, quoi qu'il ait été** (US-160). `demande.prompt`
   *  est le prompt tel qu'il *est parti* — bible repliée en tête et consignes
   *  de planche en queue comprises. Le reposer en mode atelier le ferait
   *  rhabiller une seconde fois : la bible partirait en double, et la planche
   *  demanderait deux grilles. Ce que l'auteur reprend, c'est l'appel — donc il
   *  repart identique. */
  const reprendreReglages = async (asset: Asset) => {
    try {
      const generation = await api.generation(asset.generation)
      setPrompt(generation.demande.prompt)
      setRepris(true)
      setPromptNegatif(generation.demande.prompt_negatif)
      setProportions(generation.demande.proportions)
      setVariations(generation.demande.variations)
      setModeleChoisi(generation.modele)
      setOptions(
        Object.fromEntries(
          Object.entries(generation.demande.options).map(([n, v]) => [n, String(v)]),
        ),
      )
      // Même règle que la réinjection : le texte repris se lit dans le champ,
      // et le champ n'est pas ici.
      setOnglet("codex")
    } catch (erreur) {
      echouer(erreur, "réglages illisibles")
    }
  }

  // ── L'écran ───────────────────────────────────────────────────────────────

  const redemanderCatalogue = async () => {
    setRelecture(true)
    try {
      await api.rafraichirCatalogue()
    } catch (erreur) {
      echouer(erreur, "l'atelier ne répond pas")
    } finally {
      setRelecture(false)
    }
  }

  const revers =
    catalogueRepli.repli && catalogueRepli.recu_le > 0
      ? {
          texte: "seul générer échouera",
          enCours: relecture,
          onReessayer: redemanderCatalogue,
        }
      : null

  // **Trois colonnes depuis E4** — `240px · 1fr · 380px` : où ça se range, la
  // grille d'assets, la fiche d'une image. C'est l'ancien atelier **moins sa
  // colonne de réglages de 300 px**, qui suit la barre qui paie : la galerie ne
  // paie plus, donc elle n'a rien à régler avant de payer.
  const colonnes = [
    `${replies.arbre ? 0 : 240}px`,
    "minmax(0,1fr)",
    `${fiche ? 380 : 0}px`,
  ].join(" ")

  const ouverte = fiche ? grille.find((a) => a.identifiant === fiche) : undefined
  const planche = decoupeOuverte
    ? grille.find((a) => a.identifiant === decoupeOuverte)
    : undefined

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

  // ── Ce que la barre du châssis lit de l'onglet ouvert ─────────────────────

  const projetCourant =
    bibliotheque.projets.find((p) => p.identifiant === bibliotheque.courant) ?? null

  /** Les colonnes que l'écran actif peut replier, **nommées par lui**. La
   *  réserve n'a de bascule qu'en vue toile : sans elle il n'y a pas de
   *  colonne, et une bascule pour une colonne absente mentirait sur ce que
   *  l'écran contient (`docs/DESIGN.md` § Layout). */
  const bascules: Bascule[] =
    onglet === "codex" && !choseOuverteId
      ? [
          { cle: "familles", nom: "familles", repliee: replies.familles },
          { cle: "fiche", nom: "fiche", repliee: replies.fiche },
        ]
      : onglet === "galerie"
      ? // **Une seule colonne repliable depuis E4** : celle de l'arbre. Celle
        // des réglages est partie avec ce qui paie, et une bascule pour une
        // colonne absente mentirait sur ce que l'écran contient.
        [{ cle: "arbre", nom: "arbre", repliee: replies.arbre }]
      : onglet === "univers"
        ? // **La colonne de l'univers n'existe plus** (E7) : ses cinq réglages
          // ont un côté à eux, qui prend l'écran entier. Ne reste que la
          // réserve, et seulement en vue toile — sans elle il n'y a pas de
          // colonne, et une bascule pour une colonne absente mentirait.
          coteUnivers === "inspiration" && vueUnivers === "toile"
          ? [{ cle: "reserve", nom: "réserve", repliee: replies.reserve }]
          : []
        : []

  /** Le fil d'Ariane, ou rien. **C'est la porte d'entrée qui le décide**, pas
   *  l'écran d'arrivée : la découpe atteinte depuis la fiche d'une image porte
   *  le fil court de la galerie — le jeu, l'onglet, l'image, l'outil — et le
   *  même écran atteint plus tard depuis l'établi d'une chose portera le fil
   *  long, qui nommera la famille et l'entité traversées (E3).
   *
   *  Chaque segment ramène à son étage, sauf le dernier, qui est l'étage où
   *  l'on est. */
  const chemin: Segment[] = depensesOuvertes
    ? [
        {
          libelle: projetCourant?.nom ?? "sans projet",
          onAller: () => setDepensesOuvertes(false),
        },
        { libelle: "Les dépenses" },
      ]
    : // **La profondeur du codex.** Une chose du jeu ouverte allonge le fil
      // d'un étage : `Cœur de pierre › Personnages › Balthazar`. C'est le même
      // endroit vu de plus près, et chaque segment ramène au sien.
      choseOuverte
      ? [
          {
            libelle: projetCourant?.nom ?? "sans projet",
            onAller: () => {
              setCaseOuverte(null)
              setChoseOuverte(null)
            },
          },
          {
            // **La famille de la chose ouverte, pas la rubrique** : on peut
            // ouvrir un décor puis changer de rubrique, et le fil doit dire d'où
            // vient ce qu'on regarde.
            libelle:
              NOM_DE_LA_RUBRIQUE[choseOuverte.famille ?? "personnages"] ??
              "Personnages",
            onAller: () => {
              setCaseOuverte(null)
              setChoseOuverte(null)
            },
          },
          {
            libelle: choseOuverte.nom,
            onAller: () => setCaseOuverte(null),
          },
          // L'outil ouvert est un étage de plus, et il ne l'est que quand il
          // est ouvert : un fil qui montrerait toujours cinq segments dirait
          // une profondeur où l'on n'est pas.
          ...(imageOuverte ? [{ libelle: imageOuverte.label }] : []),
        ]
      : onglet === "codex"
        ? [
            {
              libelle: projetCourant?.nom ?? "sans projet",
              onAller: () => setChoseOuverte(null),
            },
            { libelle: NOM_DE_LA_RUBRIQUE[rubrique] ?? "Personnages" },
          ]
        : imageDesTables
          ? [
              {
                libelle: projetCourant?.nom ?? "sans projet",
                onAller: () => setTablesOuvertes(null),
              },
              { libelle: "Galerie", onAller: () => setTablesOuvertes(null) },
              {
                libelle: imageDesTables.label || imageDesTables.identifiant,
                onAller: () => {
                  setTablesOuvertes(null)
                  setSelection([imageDesTables.identifiant])
                },
              },
              { libelle: TABLES.find((t) => t.cle === table)?.nom ?? "" },
            ]
          : planche
      ? [
          {
            libelle: projetCourant?.nom ?? "sans projet",
            onAller: () => setDecoupeOuverte(null),
          },
          { libelle: "Galerie", onAller: () => setDecoupeOuverte(null) },
          {
            libelle: planche.label || planche.identifiant,
            onAller: () => {
              setDecoupeOuverte(null)
              setSelection([planche.identifiant])
            },
          },
          { libelle: "Découpage" },
        ]
      : []

  /**
   * La barre qui paie — **une seule dans tout le produit** (E2).
   *
   * Elle vivait au-dessus de la grille de la galerie, parce que la galerie
   * *était* l'atelier. La V2.1 la décolle de cet écran-là : elle appartient au
   * châssis, elle sert les deux lieux d'où l'argent part — l'établi d'une chose
   * et le codex —, et **elle se retire de tout écran incapable de dépenser**.
   *
   * C'est ce qui donne à la galerie son métier propre : on y juge, on n'y paie
   * jamais. Deux champs de saisie auraient fini par accepter deux textes
   * différents pour la même intention.
   */
  const barreQuiPaie = (
    <div className="flex shrink-0 flex-col">
      {/* **Les réglages de l'appel suivent la barre qui paie** (E4, A-25). Ils
          tenaient une colonne de 300 px ouverte en permanence dans la galerie,
          *même quand on n'y touchait pas* — et sur l'écran dont le métier est
          de juger. Ils se replient maintenant sur une ligne qui dit ce qu'ils
          valent, à côté du champ qui paie.

          **La colonne ne disparaît pas encore, elle se replie**, et la nuance
          est écrite en A-25 : les réglages hérités d'une chose du jeu arrivent
          en E12, l'écran de confirmation qui les montre avant de payer en E14.
          D'ici là, les retirer retirerait le seul endroit où l'on choisit un
          modèle. */}
      {reglagesOuvertsDansLaBarre && (
        <PanneauReglages
          modeles={modeles}
          choisi={modele}
          onChoisir={setModeleChoisi}
          proportions={proportions}
          onProportions={setProportions}
          variations={variations}
          onVariations={setVariations}
          options={options}
          onOptions={setOptions}
          references={reinjections.length}
          projet={projetCourant?.nom ?? null}
          univers={univers}
          echelle={echelle}
          onEchelle={setEchelle}
          compte={compteReferences}
          cout={modele ? (couts[modele.identifiant] ?? null) : null}
          // Combien de cases le lot armé demande, ou zéro. Le panneau en tire
          // deux choses : ce que le lot coûte — **un appel, pas N** — et ce
          // qu'un compte faux coûterait.
          cases={cases}
          cible={personnageCible}
          ecarteesGeneration={ecarteesGeneration}
          onEcarterGeneration={setEcarteesGeneration}
          onErreur={setPanne}
        />
      )}
      <Cible
        personnage={personnageCible}
        poses={posesCible}
        onRetirer={(pose) =>
          setCible((precedente) => {
            // La forme fonctionnelle, jamais la valeur du rendu : deux retraits
            // rapprochés partagent le même rendu, donc la même liste périmée,
            // et le second effacerait le premier.
            const restantes =
              precedente?.poses.filter((p) => p !== pose.identifiant) ?? []
            return restantes.length && precedente
              ? { ...precedente, poses: restantes }
              : null
          })
        }
        onDesarmer={() => setCible(null)}
      />
      <Reinjections
        reinjections={reinjections}
        grille={grille}
        onRetirer={(asset) =>
          setReinjections((deja) => deja.filter((r) => r.asset !== asset))
        }
        onRole={(asset, role) => reinjecter(asset, role)}
      />
      {/* La ligne qui ouvre les réglages, et qui **dit ce qu'ils valent quand
          ils sont fermés** — c'est la règle du bloc repliable, appliquée au
          plus gros panneau du produit. */}
      <button
        type="button"
        onClick={setReglagesDansLaBarre}
        aria-expanded={reglagesOuvertsDansLaBarre}
        className="mesure flex h-[26px] shrink-0 items-center gap-2 border-b border-bord bg-fond-1 px-4 text-left text-[10px] text-texte-3 hover:text-texte-2"
      >
        <span aria-hidden>{reglagesOuvertsDansLaBarre ? "−" : "+"}</span>
        <span>réglages de l'appel</span>
        <span className="text-texte-2">
          {modele ? nomDuModele(modele.identifiant) : "aucun modèle"} · {proportions} ·{" "}
          {variations} variation{variations > 1 ? "s" : ""}
        </span>
      </button>

      {/* **Ce que ça va coûter, au pied de ce qui paie** (E2). Le chiffre
          vivait dans la colonne de réglages de 300 px, qui n'existe que dans la
          galerie — et la galerie ne paie plus. Il suit donc la barre, parce que
          le prix se lit au moment où l'on décide, jamais deux écrans plus
          loin. */}
      <dl className="mesure grid grid-cols-[auto_1fr] gap-x-3 border-b border-bord bg-fond-1 px-4 pt-3 text-[10px]">
        <CoutAttendu
          cout={modele ? (couts[modele.identifiant] ?? null) : null}
          cases={cases}
          variations={variations}
        />
      </dl>
      <ChampPrompt
        prompt={prompt}
        onPrompt={(texte) => {
          setPrompt(texte)
          // Écrire dedans en fait le texte de l'auteur : la provenance ne
          // décrit plus rien, et la garder mentirait sur qui l'a écrit.
          setProvenance(null)
        }}
        promptNegatif={promptNegatif}
        onPromptNegatif={setPromptNegatif}
        apercu={apercuPrompt}
        apercuRefus={apercuRefus}
        repris={repris}
        /* **Reprendre pose le texte exact, et rien d'autre.** L'univers n'est
           pas touché : rouvrir l'onglet Univers montre la bible inchangée
           (US-159). C'est la différence entre corriger une formulation et
           démonter son projet. */
        onReprendre={() => {
          if (!apercuPrompt) return
          setPrompt(apercuPrompt.texte)
          setRepris(true)
        }}
        /* Rendre la main : le champ redevient le sujet seul. **Il ne se vide
           pas** — on ne perd pas ce qui a été écrit —, et l'atelier reprend son
           habillage par-dessus. */
        onRendre={() => setRepris(false)}
        refus={refus?.texte ?? null}
        ouAller={refus?.geste}
        onAller={
          refus?.geste === "Réessayer"
            ? redemanderCatalogue
            : () => setReglagesOuverts(true)
        }
        revers={revers}
        provenance={
          provenance
            ? {
                texte: provenance,
                // **Se défaire ne change rien au réglage durable** : c'est le
                // texte de cet appel-ci qui s'efface, pas la consigne de la
                // pose ni le signalement de la chose.
                onDefaire: () => {
                  setPrompt("")
                  setProvenance(null)
                },
              }
            : null
        }
        onGenerer={generer}
        variations={variations}
      />
    </div>
  )

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)_26px] bg-fond-0">
      <BarreChassis
        onglet={onglet}
        onOnglet={(prochain) => {
          // **Changer d'onglet remonte de toute profondeur.** Le fil dit où
          // l'on est ; cliquer un onglet est le geste qui dit « ailleurs ».
          // Laisser la découpe ouverte derrière un autre onglet rendrait le
          // produit à ce qu'il vient de quitter — un écran par-dessus un autre.
          setDecoupeOuverte(null)
          setDepensesOuvertes(false)
          setChoseOuverte(null)
          setCaseOuverte(null)
          setTablesOuvertes(null)
          setFente(null)
          setOnglet(prochain)
        }}
        chemin={chemin}
        // **Le nom du jeu ne s'écrit qu'une fois dans la bande.** Déployé, le
        // fil le porte à son premier étage ; sans fil, c'est le total qui le
        // porte. C'est la différence entre les deux croquis de
        // `docs/maquettes-v2.1/01-structure.html` — celui de la galerie et
        // celui de l'établi.
        nomDuJeu={chemin.length ? null : (projetCourant?.nom ?? "sans projet")}
        montant={dollars(
          projetCourant ? projetCourant.total_usd : bibliotheque.sans_projet.total_usd,
        )}
        // **Le total ouvre l'écran qui l'explique.** Il portait sa raison de
        // grisé tant que cet écran n'existait pas ; il l'a perdue en E18, qui
        // est très exactement l'endroit où elle devait disparaître.
        onDepenses={() => {
          setDecoupeOuverte(null)
          setFente(null)
          setDepensesOuvertes(true)
        }}
        // **L'état de la clé, dès la première seconde** (E19). Il vivait dans
        // la barre du bas ; il monte ici, et il n'y est écrit **qu'une fois** —
        // la même valeur à deux endroits est deux endroits à tenir d'accord.
        cle={etat ? { presente: etat.cle.presente, apercu: etat.cle.apercu } : null}
        // **Trois portes, une seule pièce** : ce mot-ci, l'étape 10 de
        // l'assistant, et le bouton qui paie éteint mènent tous les trois au
        // champ où la clé habite.
        onReglagesCle={() => setReglagesOuverts(true)}
        bascules={depensesOuvertes ? [] : bascules}
        onBasculer={(cle) => setReplies((r) => ({ ...r, [cle]: !r[cle] }))}
        fente={fente}
        onReglages={() => setReglagesOuverts(true)}
        onGuide={() => ouvrirGuide()}
      />

      {/* **La découpe est une profondeur de la galerie, pas un écran posé
          dessus.** Elle occupait tout l'écran ; elle occupe maintenant la même
          case que la grille, et c'est le fil d'Ariane qui dit qu'on est
          descendu — `Cœur de pierre › Galerie › tonneau-cerclé-02 ›
          Découpage`. Elle disparaîtra en E3, quand le découpage deviendra la
          première des deux fabriques de la barre des tables ; d'ici là elle
          garde sa porte, celle de la fiche. */}
      {/* **Une profondeur de l'onglet où l'on se trouve, quel qu'il soit.** Il
          s'ouvre depuis le total de la barre de tête, qui est sur les trois ;
          il n'a donc pas de lieu à lui, parce qu'il ne parle d'aucun des
          trois — il parle de l'atelier entier. */}
      {depensesOuvertes && (
        <EcranDepenses
          projetCourant={bibliotheque.courant}
          onErreur={setPanne}
        />
      )}

      {/* **Les tables, à la profondeur de la galerie.** Une image qui
          n'appartient à aucune chose du jeu n'a pas d'établi ; elle a quand
          même une recette, et il faut un endroit pour la régler. Ses sœurs sont
          alors les voisines de la grille, ce que la maquette du châssis prévoit
          en toutes lettres. */}
      {!depensesOuvertes && onglet === "galerie" && imageDesTables && etat && (
        <EcranTables
          asset={imageDesTables}
          soeurs={grille}
          traitement={etat.traitement}
          univers={univers}
          ouverte={table}
          onOuvrir={setTable}
          onSoeur={setTablesOuvertes}
          decoupe={
            <EcranDecoupe
              planche={imageDesTables}
              onFermer={() => setTable("detourage")}
              onFente={setFente}
              onDecoupe={(decoupes) => {
                setTable("detourage")
                if (decoupes.length > 0) setSelection([decoupes[0].identifiant])
              }}
            />
          }
          onErreur={setPanne}
          BlocPasse={BlocPasse}
        />
      )}

      {!depensesOuvertes && onglet === "galerie" && !imageDesTables && planche && (
        <EcranDecoupe
          planche={planche}
          onFermer={() => setDecoupeOuverte(null)}
          onFente={setFente}
          onDecoupe={(decoupes) => {
            setDecoupeOuverte(null)
            if (decoupes.length > 0) setSelection([decoupes[0].identifiant])
          }}
        />
      )}

      {/* Quatre colonnes, largeurs absolues, et 160 ms sur la largeur quand
          l'une se replie ou que la fiche s'ouvre — `docs/DESIGN.md` § Motion,
          « tu n'as pas perdu ta place ». Les panneaux restent montés : replier
          n'est pas fermer, et retrouver un panneau où on l'avait laissé fait
          partie de ce que le mouvement promet.

          **Chaque case est `flex`, et c'est ce qui borne le panneau qu'elle
          porte** — `docs/DESIGN.md` § Un panneau est borné par l'écran. Une case
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
          vit de toute façon dans `App`, et lui survit. */}
      {!depensesOuvertes && onglet === "galerie" && !planche && (
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
          <Grille
            entrees={entrees}
            selection={selection}
            filtre={filtre}
            zoom={zoomRendu}
            entree={entree}
            onRelancer={relancer}
            onOuvrir={ouvrir}
            onRetirerFiltre={() => setFiltre(FILTRE_VIDE)}
          />

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
              // chose —, et les tables, qui s'ouvrent sur n'importe quelle
              // image sans quitter la galerie.
              onOuvrirLEtabli={() => {
                if (!ouverte.personnage) return
                setChoseOuverte(ouverte.personnage)
                setChoseChoisie(ouverte.personnage)
                setCaseOuverte(ouverte.identifiant)
                setOnglet("codex")
              }}
              onOuvrirLesTables={() => setTablesOuvertes(ouverte.identifiant)}
              onOuvrir={(identifiant) => setSelection([identifiant])}
            />
          )}
        </div>
      </main>
      )}

      {/* **Les deux autres onglets, dans la même case de grille.** Ils ne
          couvrent plus rien : ils occupent la ligne du milieu, entre la barre du
          châssis et la barre d'état, exactement comme la galerie. C'est ce qui
          leur retire leur en-tête de 44 px — il y en avait trois, un par écran,
          et il n'y en a plus qu'un — et leur fente de refus, désormais
          partagée. */}
      {!depensesOuvertes && onglet === "univers" && (
        <EcranUnivers
          univers={univers}
          modeles={modeles}
          cartes={cartes}
          liens={liens}
          teintes={teintes}
          personnages={personnages}
          cote={coteUnivers}
          onCote={setCoteUnivers}
          // **On sort de l'assistant à n'importe quelle étape** (E19), et l'on
          // tombe dans le codex, champ qui nomme allumé. Pas dans la galerie :
          // elle ne montre que des images produites, et il n'y en a aucune.
          onSortirDeLAssistant={() => {
            setOnglet("codex")
            setRubrique("personnages")
            setNommer((n) => n + 1)
          }}
          vue={vueUnivers}
          onVue={setVueUnivers}
          replies={{ univers: replies.univers, reserve: replies.reserve }}
          onFente={setFente}
          onUnivers={setUnivers}
          onRelire={relireTableau}
        />
      )}

      {/* **Le codex, et sa profondeur.** Une chose du jeu ouverte remplace le
          codex par son établi — c'est le même endroit vu de plus près, et le
          fil d'Ariane le dit. Les deux portent la barre qui paie, parce qu'ils
          sont les deux lieux d'où l'argent part. */}
      {!depensesOuvertes && onglet === "codex" && !choseOuverte && (
        <EcranCodex
          plan={plan}
          personnages={personnages}
          emplacements={emplacements}
          pieces={pieces}
          choisi={choseChoisie}
          onChoisir={setChoseChoisie}
          onOuvrir={(identifiant) => {
            setChoseOuverte(identifiant)
            setChoseChoisie(identifiant)
          }}
          onPersonnage={fondrePersonnage}
          directions={directions}
          onDirections={setDirections}
          rubrique={rubrique}
          onRubrique={setRubrique}
          nommer={nommer}
          onPlan={(recu) => {
            // Le plan touché **et les choses avec** (E9) : la liste d'une chose
            // dépend du plan, et le serveur seul sait laquelle. Le plan est posé
            // tout de suite pour que la liste qui vient d'être écrite s'affiche
            // sans attendre, et la production suit.
            setPlan(recu)
            void relireProduction()
          }}
          onVestiaire={(recu) => {
            setEmplacements(recu.emplacements)
            setPieces(recu.pieces)
          }}
          onArmer={(personnage, poses) => void armer(personnage, poses)}
          replies={{ familles: replies.familles, fiche: replies.fiche }}
          barreQuiPaie={barreQuiPaie}
          onErreur={(erreur, defaut) => echouer(erreur, defaut)}
        />
      )}

      {!depensesOuvertes && onglet === "codex" && choseOuverte && (
        <EcranEtabli
          ouvert={choseOuverte}
          plan={plan}
          onPersonnage={fondrePersonnage}
          emplacements={emplacements}
          pieces={pieces}
          onArmer={armer}
          onFente={setFente}
          // **La barre de prompt se retire quand l'outil s'ouvre** : on
          // retouche, on ne paie pas — et un écran incapable de dépenser ne
          // porte pas le champ qui dépense.
          barreQuiPaie={imageOuverte ? null : barreQuiPaie}
          onOuvrirCase={setCaseOuverte}
          outil={
            imageOuverte && etat ? (
              <EcranTables
                asset={imageOuverte}
                // **Les sœurs d'une image sont les autres images de la chose**
                // — ses attitudes. On passe de l'une à l'autre sans que la
                // table ouverte se referme, et c'est le geste qui distingue une
                // table d'un panneau : on règle la même chose sur six images.
                soeurs={(choseOuverte?.cases ?? []).flatMap((c) => c.images)}
                traitement={etat.traitement}
                univers={univers}
                ouverte={table}
                onOuvrir={setTable}
                onSoeur={setCaseOuverte}
                // **Le découpage est là, dans le cadre de la table** : on ne
                // le cherche plus, et l'écran Découpe cesse d'être un endroit
                // où aller. Il reste atteignable depuis la fiche d'une image
                // tant que la galerie porte un bouton pour lui (E4).
                decoupe={
                  <EcranDecoupe
                    planche={imageOuverte}
                    onFermer={() => setTable("detourage")}
                    onFente={setFente}
                    onDecoupe={(decoupes) => {
                      setTable("detourage")
                      if (decoupes.length > 0)
                        setSelection([decoupes[0].identifiant])
                    }}
                  />
                }
                onErreur={setPanne}
                BlocPasse={BlocPasse}
              />
            ) : null
          }
          // **Le dossier du jeu, tenu par les Réglages et lu ici** (C5). L'écran
          // ne s'en sert que pour griser avec sa raison : le geste, lui, le
          // redemande au serveur, qui en est le seul dépositaire. Il arrive par
          // le flux comme le reste du cadre de l'agent, donc le bouton
          // s'allume à l'instant où l'auteur pose le dossier dans l'autre écran.
          dossierJeu={etat?.agent.garde_fous.dossier_jeu ?? ""}
        />
      )}

      <BarreEtat
        etat={etat}
        catalogue={catalogueRepli}
        panne={panne}
        liaison={liaison}
        bibliotheque={bibliotheque}
        onRelireCatalogue={redemanderCatalogue}
      />

      {/* **Le Guide couvre l'atelier**, comme Univers et Découpe — on l'ouvre
          quand on ne sait pas, on le ferme quand on sait. Il ne porte pas de
          fente de refus : il ne demande rien au serveur, ne dépense rien, ne
          peut pas échouer. On ne pose pas une fente vide pour la symétrie. */}
      {guideOuvert && <EcranGuide onFermer={fermerGuide} />}

      {reglagesOuverts && etat && (
        <EcranReglages
          etat={etat.cle}
          agent={etat.agent}
          onDeposee={async () => {
            setEtat(await api.etat().catch(() => etat))
            await relireCatalogue()
          }}
          // **Ce que le serveur vient de rendre, posé tel quel.** Le PUT rend
          // le cadre entier et sa consommation ; recalculer l'un des deux ici
          // ferait deux vérités sur le même chiffre — et l'événement `agent`
          // arrive de toute façon derrière.
          onAgent={(agent) => setEtat((e) => (e ? { ...e, agent } : e))}
          onFermer={() => setReglagesOuverts(false)}
        />
      )}

      {/* **L'aperçu couvre tout, y compris les écrans qui couvrent l'atelier**
          — c'est le seul du produit dans ce cas, et c'est ce que son geste
          demande : on le tient une seconde au-dessus de ce qu'on faisait, on le
          referme, et on n'a rien quitté. Il ne porte pas de fente de refus,
          pour la même raison que le Guide : il ne demande rien au serveur. */}
      {apercu && <Apercu sujet={apercu} onFermer={fermerApercu} />}
    </div>
  )
}

/** Fondre un asset annoncé dans la grille — et l'en **retirer** quand il l'a
 *  quittée.
 *
 *  Trois façons de la quitter, et elles se lisent toutes sur l'objet reçu : il
 *  est supprimé, il a changé de projet, ou il ne répond plus au filtre posé.
 *  Le manque de la troisième s'est vu tout de suite au navigateur — supprimer un
 *  projet détache ses assets, chaque détachement est annoncé, et les trois
 *  détachés venaient s'installer dans la grille du projet **ouvert**, qui n'est
 *  pas le leur.
 *
 *  Ce que cette fonction refuse de trancher, c'est **la recherche** : elle vit
 *  sur le serveur, et la rejouer ici ferait dire à la grille autre chose qu'à la
 *  bibliothèque. Sous recherche, un asset inconnu n'entre pas — on redemande. */
function fondreAsset(
  liste: Asset[],
  recu: Asset,
  filtre: Filtre,
  courant: string | null,
): Asset[] {
  const dehors =
    recu.supprime_le !== null ||
    recu.projet !== courant ||
    (filtre.collection !== null && recu.collection !== filtre.collection) ||
    (filtre.favoris && !recu.favori)
  if (dehors) return liste.filter((a) => a.identifiant !== recu.identifiant)
  if (liste.some((a) => a.identifiant === recu.identifiant))
    return liste.map((a) => (a.identifiant === recu.identifiant ? recu : a))
  if (filtre.recherche.trim()) return liste
  return [recu, ...liste].sort((a, b) => b.cree_le - a.cree_le || a.rang - b.rang)
}

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
function Cible({
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
      <span className="flex flex-wrap items-center gap-1.5 rounded-[2px] border border-signal bg-signal/13 py-1 pr-1 pl-2">
        <span className="text-[11.5px] text-texte">{personnage.nom}</span>
        {poses.map((pose) => (
          <span key={pose.identifiant} className="flex items-center">
            <span className="mesure text-[10px] text-signal">{pose.nom}</span>
            <button
              type="button"
              onClick={() => onRetirer(pose)}
              aria-label={`Retirer ${pose.nom} de ce qui part`}
              className="mesure px-1 text-[10px] text-texte-3 hover:text-echec"
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
          className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-echec"
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
function Reinjections({
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
          src={sujetAsset(connu).src}
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
        className="mesure px-1 text-[10px] text-texte-3 hover:text-echec"
      >
        ×
      </button>
    </span>
  )
}

// ── La grille ───────────────────────────────────────────────────────────────

function Grille({
  entrees,
  selection,
  filtre,
  zoom,
  entree,
  onRelancer,
  onOuvrir,
  onRetirerFiltre,
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
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRetirerFiltre: () => void
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
          className="mesure text-[11px] text-signal hover:text-signal-clair"
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
            onRelancer={onRelancer}
            onOuvrir={onOuvrir}
          />
        ))}
      </div>
    </div>
  )
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
  survole ? "outline outline-1 -outline-offset-1 outline-signal" : ""

/** La grille se nomme, dans ses trois états.
 *
 *  **Parce qu'elle reçoit un dépôt** : une surface où l'on peut lâcher un
 *  fichier doit pouvoir être désignée autrement que par la vue — c'est la même
 *  raison qui a nommé le dépliant du prompt. Le nom est le même pour les trois
 *  états, parce que c'est la même surface : pleine, filtrée à vide, ou vide. */
const NOMMEE = { role: "region", "aria-label": "Grille des images" } as const

// ── La barre d'état ─────────────────────────────────────────────────────────

function BarreEtat({
  etat,
  catalogue,
  panne,
  liaison,
  bibliotheque,
  onRelireCatalogue,
}: {
  etat: Etat | null
  catalogue: Repli
  panne: string | null
  liaison: boolean
  bibliotheque: Bibliotheque
  /** **Le geste vient rejoindre l'état qu'il change.** La barre de tête portait
   *  un bouton `Catalogue` de même poids que les onglets, alors qu'il ne
   *  changeait rien de ce qu'on regarde : il redemandait la liste des modèles.
   *  La V2.1 lui retire cette place — trois onglets, pas cinq boutons — et le
   *  pose ici, sur le compte de modèles, qui est déjà l'endroit du produit qui
   *  dit ce que le catalogue contient et de quand il date. */
  onRelireCatalogue: () => void
}) {
  // Trois choses différentes, et il ne faut pas les confondre : l'atelier est
  // arrêté (liaison rompue), le fournisseur est injoignable (repli), ou tout
  // va bien. La première l'emporte — sans serveur, le reste ne veut rien dire.
  const [couleur, texte] = !liaison
    ? ["var(--color-echec)", "l'atelier ne répond pas"]
    : panne
      ? ["var(--color-echec)", panne]
      : catalogue.repli
        ? ["var(--color-epingle)", "hors ligne"]
        : ["var(--color-ok)", "en ligne"]

  const assets =
    bibliotheque.projets.reduce((somme, p) => somme + p.assets, 0) +
    bibliotheque.sans_projet.assets

  // Deux altitudes, deux métiers : le pied porte **l'état du monde** — et
  // pourquoi, quand le port a su le dire en français. Il ne prédit jamais ce
  // qui va casser : ça, c'est la fente sous le bouton Générer.
  return (
    <footer className="mesure flex items-center gap-4 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
      <span className="flex items-center gap-1.5">
        <Point couleur={couleur} />
        {texte}
      </span>
      {catalogue.repli && catalogue.recu_le > 0 && (
        <span className="text-epingle">catalogue du {heure(catalogue.recu_le)}</span>
      )}
      {catalogue.repli && catalogue.raison && <span>{catalogue.raison}</span>}
      <button
        type="button"
        onClick={onRelireCatalogue}
        title="Redemander le catalogue des modèles"
        className="transition-colors duration-[80ms] hover:text-texte-2"
      >
        {etat?.catalogue.modeles ?? 0} modèles
      </button>
      {/* **La clé est montée dans la barre du haut** (E19), et elle n'est plus
          ici : elle est le seul préalable dur du produit, elle se lit dès la
          première seconde, et la même valeur à deux endroits serait deux
          endroits à tenir d'accord. */}
      <span className="ml-auto">
        {assets} asset{assets > 1 ? "s" : ""}
      </span>
    </footer>
  )
}
