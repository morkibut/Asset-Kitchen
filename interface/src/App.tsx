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
  type Asset,
  type Envoi,
  type LigneQuiPart,
  type Tri,
  type Bibliotheque,
  type Etat,
  type Filtre,
  type Bande,
  type Generation,
  type Modele,
  type Reinjection,
  type Reserve,
  type Role,
  type Carte,
  type Lien,
  type Fabrique,
  type Teinte,
  type CompteReferences,
  type Emplacement,
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
  vignetteAsset,
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
import {
  CRANS,
  Libelle,
  Point,
  usePli,
  ZOOMS,
  type Zoom,
} from "./composants/chassis"
import { ChampPrompt, type EnVol } from "./composants/ChampPrompt"
import { EcranClip, type CibleDuClip } from "./composants/Clip"
import { EcranDecoupe } from "./composants/Decoupe"
import { EcranDepenses } from "./composants/Depenses"
import { EcranEnvoi, TRI_VIDE } from "./composants/Envoi"
import {
  EcranCodex,
  NOM_DE_LA_RUBRIQUE,
  type Rubrique,
} from "./composants/Codex"
import { EcranEtabli } from "./composants/Personnages"
import { EcranReglages } from "./composants/EcranReglages"
import { BlocPasse, Fiche, nomDuModele } from "./composants/Fiche"
import { FicheDuClip } from "./composants/FicheDuClip"
import { EcranTables, TABLES, type Table } from "./composants/Tables"
import { EcranDepliage } from "./composants/Depliage"
import { EcranAtelierDeBande } from "./composants/AtelierDeBande"
import { EcranMontage } from "./composants/Montage"
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

// **Le temps qu'on laisse à la frappe de se poser** (M3). Corriger une ligne de
// la fenêtre de confirmation écrit dans le tri, et le tri commande la demande
// qui dit ce qui part : sans repos, un mot de dix lettres partait en dix
// allers-retours enchaînés. Ce n'est pas un nouveau réglage — 200 ms est déjà ce
// que le produit appelle *« la main s'est arrêtée »*, à l'infobulle comme à la
// table d'inspiration.
//
// **Il ne s'applique jamais à l'ouverture** : on ouvre la fenêtre pour voir ce
// qui part, et la faire attendre un cinquième de seconde pour rien serait payer
// la réparation avec la chose qu'elle répare.
const REPOS_FRAPPE = 200

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
  // **Ce qui reste chez chaque fournisseur** (F2), tel que `/models` le rend.
  // Gardé par nom de fournisseur : un modèle dit le sien, et c'est ainsi que
  // l'écran où l'on choisit et celui qui confirme montrent le même chiffre.
  const [reserves, setReserves] = useState<Record<string, Reserve>>({})
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
  // **L'échec d'un appel n'est pas une panne de l'atelier** (U1). Les deux
  // vivaient dans le même état, et une génération refusée grisait donc le
  // bouton qui paie jusqu'à ce qu'un autre geste relise le catalogue : le seul
  // moment où l'on veut recliquer était précisément celui où l'on ne pouvait
  // plus. Une panne dit *l'atelier ne répond pas* et empêche de partir ; un
  // échec dit *cet appel-là n'est pas passé* et invite à recommencer. Il se
  // vide à chaque nouvelle tentative et à chaque ouverture de l'écran de
  // confirmation.
  const [echecDuPaiement, setEchecDuPaiement] = useState<string | null>(null)
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

  /** **Commander un clip est une profondeur, pas un quatrième onglet** (A9).
   *
   *  Il s'ouvre depuis une case de l'établi — *animer celle-ci* — et recouvre
   *  le produit comme l'écran de confirmation, pour la même raison : c'est le
   *  dernier écran avant que l'argent parte, et il porte le montant sur son
   *  bouton.
   *
   *  Il tient **la case visée**, jamais un booléen : l'image de départ
   *  proposée, le mouvement proposé et le titre en dépendent tous les trois. */
  const [clipOuvert, setClipOuvert] = useState<CibleDuClip | null>(null)

  /** **Le clip qu'on est en train de découper** (A10) — l'identifiant de sa
   *  génération, ou rien.
   *
   *  Il prend la place de la grille dans la galerie, comme l'écran du choix
   *  d'une planche : c'est la profondeur suivante du même endroit, et on y va
   *  depuis la tuile du clip, là où on le regarde. **Il ne recouvre pas le
   *  produit** — contrairement aux trois écrans qui paient —, parce qu'il ne
   *  dépense rien : le clip est déjà payé, et découper se refait autant de fois
   *  qu'on veut. */
  const [montageOuvert, setMontageOuvert] = useState<string | null>(null)

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
  // **L'atelier d'une animation gardée** (A7). Il prend la place de la
  // matrice, comme le montage prend celle de la galerie : on y entre depuis
  // la vignette de l'animation, et rien n'y dépense.
  const [bandeOuverte, setBandeOuverte] = useState<string | null>(null)
  /** **Le montage rouvert sur une animation gardée** (V3.03.3) — pour en
   *  changer les images retenues.
   *
   *  Il prend la place de l'atelier de l'animation, comme l'atelier prend celle
   *  de la matrice : c'est la profondeur suivante du même endroit, et les deux
   *  ne peuvent pas être à l'écran ensemble. L'animation entière est gardée ici
   *  plutôt que son seul identifiant, parce que le montage a besoin de ses
   *  prises — ce qu'on garde retrouve sa recette — et qu'un second aller-retour
   *  au serveur pour ce qu'on vient de lire serait un état de plus à tenir. */
  const [montageDeLaBande, setMontageDeLaBande] = useState<Bande | null>(null)
  /** Ouvrir — ou refermer — l'atelier d'une animation. **Une seule porte**, et
   *  elle referme le montage au passage : sans elle, ouvrir une seconde
   *  animation pendant qu'on remonte la première montrerait le montage de
   *  celle qu'on vient de quitter. */
  const ouvrirLAtelierDeBande = useCallback((identifiant: string | null) => {
    setMontageDeLaBande(null)
    setBandeOuverte(identifiant)
  }, [])

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

  // ── L'écran de confirmation, entre le bouton et la dépense (E14) ──────────
  //
  // **Il s'intercale, il ne remplace pas.** Le bouton reste celui de la barre
  // qui paie, il n'y a toujours qu'un seul endroit d'où l'argent part, et rien
  // n'est dépensé tant que le bouton *de cet écran-là* n'est pas pressé.
  const [envoiOuvert, setEnvoiOuvert] = useState(false)
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  // **Vrai tant que la fenêtre vient de s'ouvrir** (M3) : c'est ce qui fait
  // partir la première demande sans attendre, alors que toutes les suivantes
  // laissent à la frappe le temps de se poser. Une référence plutôt qu'un état :
  // elle change pendant l'effet, et un état y déclencherait un second rendu — et
  // donc un second appel — pour ne rien dire de neuf à l'écran.
  const ouverture = useRef(true)
  // **Le tri ne porte que des écarts, jamais un état complet**, et il ne
  // s'enregistre nulle part : une correction faite ici vaut pour cet appel
  // seulement, et le prochain repart des réglages.
  const [tri, setTri] = useState<Tri>(TRI_VIDE)
  // **De quel appel ces corrections-là sont les corrections** (M5).
  //
  // La règle disait *le tri repart de rien à chaque ouverture*, et elle visait
  // un vrai danger : un réglage qui traînerait d'un appel au suivant. Elle
  // reste. Ce qui change est **ce qu'elle appelle un autre appel** — sortir
  // chercher une image et revenir n'en est pas un.
  //
  // Le défaut n'était l'oubli de personne : trois décisions justes se
  // rencontraient. La fenêtre de confirmation recouvre tout le produit, donc il
  // n'existe aucun chemin vers une image sans la refermer ; *réinjecter* va où
  // son effet se voit, donc ajouter une référence force un changement d'onglet ;
  // et le tri repartait de rien à chaque ouverture. L'auteur se retrouvait
  // devant un choix que personne n'avait voulu lui imposer — garder ses
  // corrections, ou ajouter l'image dont il venait de voir qu'elle manquait — au
  // seul endroit du produit qui montre quelles références partent, donc le seul
  // où l'on s'aperçoit qu'il en manque une.
  //
  // `null` veut dire « aucune correction en réserve ».
  const [triDe, setTriDe] = useState<string | null>(null)
  // **La grille du produit, ouverte par-dessus la fenêtre de confirmation**
  // (M5). Dans cette fenêtre on pouvait *décocher* une image jointe ; on ne
  // pouvait jamais en ajouter une — et c'est pourtant le seul endroit du produit
  // qui montre lesquelles partent, donc le seul où l'on s'aperçoit qu'il en
  // manque une.
  const [choixDeReference, setChoixDeReference] = useState(false)
  // **La série qu'on a choisi de ne plus relire.** Une chose et une pose : dès
  // qu'on change de l'une ou de l'autre, l'écran revient. Il n'existe aucune
  // case « pour toujours » — on la cocherait le premier jour, quand on ne sait
  // pas encore qu'on en aura besoin.
  const [serieSautee, setSerieSautee] = useState<string | null>(null)

  // ── Le verrou de l'argent (U1) ────────────────────────────────────────────
  //
  // **L'appel est parti, on ne repaie pas.** Cinq clics rapides sur *Payer et
  // lancer* lançaient cinq appels payants, en silence — signalé par l'auteur le
  // 31 août 2026, sur sa machine et sur son argent. Le garde-fou existait
  // pourtant côté serveur depuis T1 : une génération porte un identifiant, et
  // `preparer` rend *déjà soumise* sans rien facturer quand il revoit le même.
  // **C'est l'écran qui le jetait**, en fabriquant un identifiant neuf à chaque
  // clic : chaque clic était donc une intention neuve, et chacune se payait.
  //
  // Deux verrous, et il en faut deux. Le **drapeau d'état** dit à l'écran que
  // ça paie et grise le bouton ; il ne suffit pas, parce que deux clics dans la
  // même image de rendu partent tous les deux avant que React ait redessiné
  // quoi que ce soit. Le **repère** ci-dessous, lui, est lu et écrit dans le
  // même tour de boucle : c'est lui qui arrête le second clic.
  const [enPaiement, setEnPaiement] = useState(false)
  const paiementEnCours = useRef(false)
  // **Un identifiant par intention, pas un par clic.** Il se refait quand ce
  // qui part change — c'est `signatureEnvoi` qui le dit — et quand un appel est
  // réellement parti : le réemployer après coup ferait rendre *déjà soumise*
  // par le serveur, c'est-à-dire refuserait en silence une seconde image
  // volontairement identique.
  const intention = useRef<{ signature: string; identifiant: string } | null>(null)

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
  // **Ce que chaque paquet a produit** (U7) — sa palette, son ambiance. Même
  // route, même raison : un îlot qui montrerait sa marque un aller-retour après
  // les cartes aurait un instant où il paraît n'avoir rien fabriqué.
  const [fabriques, setFabriques] = useState<Record<string, Fabrique>>({})
  /** La carte qu'on est en train de découper, ou rien.
   *
   *  **Tenue ici et pas dans l'écran Univers**, pour une seule raison : c'est un
   *  étage, et un étage se dit dans le fil d'Ariane. La découpe d'une planche a
   *  le sien depuis E3 ; celle d'une carte l'aurait perdu, et *Échap* aurait été
   *  la seule porte de sortie d'un écran plein cadre. */
  const [carteDecoupee, setCarteDecoupee] = useState<Carte | null>(null)

  /** Ce que la toile demande d'ouvrir côté Ambiances, ou rien (U7).
   *
   *  **L'objet fabriqué vit dans un autre côté de l'onglet**, et c'est très
   *  exactement ce que la séance a relevé : le geste partait sans retour, vers
   *  un endroit qu'il ne montrait pas. Le chemin passe donc par ici, qui est le
   *  seul point commun entre la toile et le côté Ambiances. */
  const [cibleAmbiances, setCibleAmbiances] = useState<{
    genre: "palette" | "ambiance"
    identifiant: string
  } | null>(null)
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
  // `tablesOuvertes` pour la même raison, depuis le 31 août 2026 : la galerie
  // se démonte aussi quand une table s'ouvre par-dessus elle, et la mesure
  // doit se reprendre au retour. L'identifiant plutôt que l'asset trouvé —
  // celui-ci change d'identité à chaque relecture de grille, et ferait courir
  // la mesure pour rien.
  useLayoutEffect(mesurerCentre, [
    mesurerCentre,
    replies.arbre,
    fiche,
    onglet,
    tablesOuvertes,
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
      setReserves(
        Object.fromEntries(
          (catalogue.fournisseurs ?? [])
            .filter((f) => f.reserve)
            .map((f) => [f.nom, f.reserve as Reserve]),
        ),
      )
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

  // ── Ce qui partira : ce n'est plus un dépliant, c'est un écran (E14) ──────
  //
  // « Avant de lancer, le texte exact qui partira s'affiche » (US-158) tient
  // toujours, et sa surface a grandi pour rester vraie. Le dépliant montrait le
  // texte assemblé sans qu'on puisse rien y toucher ; l'écran de confirmation
  // montre chaque texte et chaque image sur sa ligne, avec un interrupteur.
  // C'est une mesure qui l'a fait basculer, pas un goût : sur le plus long appel
  // payé du dépôt, le style pèse 53 % de ce qui part et le sujet 2 %, et un bloc
  // replié qui résume 53 % de l'appel n'est pas un résumé, c'est un angle mort.
  //
  // La composition n'a pas bougé d'un mot : elle est **demandée**, jamais
  // recomposée ici, et c'est le chemin que la soumission emprunte.

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
      setFabriques(toile.fabriques ?? {})
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
      // **Une bande a bougé, et une case du calque animé change avec** (A12).
      //
      // On ne pose pas la bande ici : ce que l'écran lit sont les **cases**, et
      // c'est le serveur qui les compose — recopier la bande dans la bonne case
      // à la main serait un second calcul de la matrice, celui-là même que le
      // dépôt refuse partout ailleurs. On redemande donc le plan, comme les
      // directions le font juste au-dessus et pour la même raison.
      //
      // **Une bande sans personnage ne concerne aucune matrice** : un brouillon
      // gardé dans la galerie n'a pas à faire travailler le codex.
      bande: (recu) => {
        if (!recu.personnage) return
        void vivant.current.relireProduction()
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

  // **Ce qui fait qu'un appel est le même, et rien de plus** (M5).
  //
  // Ce que l'auteur **vise et écrit** : le texte, ce qu'il interdit, le modèle,
  // l'échelle, le nombre de variations, le jeu, et la case du monde qu'il
  // remplit. Changer l'un de ceux-là, c'est demander autre chose — et les
  // corrections de la demande d'avant n'ont plus de sens.
  //
  // **Ce qui n'y entre pas est aussi une décision.** Les images jointes n'y sont
  // pas : en ajouter une, ou en décocher une, est une correction *de cet
  // appel-ci* et non un appel neuf — c'est très exactement le geste que la
  // tranche rend possible, et l'y mettre viderait le tri au moment de s'en
  // servir. La bible du jeu n'y est pas non plus : elle change ce qui part, elle
  // ne change pas ce qu'on demande.
  //
  // Le séparateur est un caractère qu'aucun de ces champs ne peut porter : sans
  // lui, deux repères mis bout à bout feraient deux appels différents lus comme
  // un seul.
  const signatureDeLAppel = [
    prompt,
    promptNegatif,
    modele?.identifiant ?? "",
    echelle,
    String(variations),
    bibliotheque.courant ?? "",
    String(repris),
    cible?.personnage ?? "",
    cible?.piece ?? "",
    cible?.direction ?? "",
    posesCible.map((p) => p.identifiant).join("·"),
    directionsCible.join("·"),
  ].join("␟")

  // ── Ce que la grille montre ───────────────────────────────────────────────

  const entrees = useMemo<Entree[]>(() => {
    const parCle = new Map<string, Entree>()
    // Le chantier d'abord : il tient sa place **avant** que l'image n'existe.
    // Il ne paraît pas quand un filtre est posé — un lot qui n'est pas encore
    // arrivé n'a rien à quoi un filtre puisse s'appliquer, et le faire
    // apparaître dans une recherche mentirait sur ce qu'elle a trouvé.
    if (!filtreActif(filtre)) {
      for (const generation of chantier) {
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
    if (modeles.length === 0)
      return { texte: "le catalogue n'a jamais été reçu", geste: "Réessayer" }
    if (!modele) return { texte: "aucun modèle choisi" }
    // **Ce qui manque appartient au modèle choisi, plus au produit** (F1).
    // Jusqu'à la V2.2, l'absence de clé éteignait le bouton quel que soit le
    // modèle : il n'y avait qu'un fournisseur, et c'était juste. Un fournisseur
    // ne demande désormais ni compte ni clé — refuser au nom de la clé d'un
    // autre serait un refus faux, et un refus faux est ce qui fait douter de
    // tous les autres. La phrase du fournisseur arrive donc dans `refus`, écrite
    // par le serveur, comme toutes les raisons de grisé depuis T1.
    if (modele.refus)
      return {
        texte: modele.refus.startsWith("aucune clé")
          ? modele.refus
          : `${modele.nom} ${modele.refus}`,
        geste: modele.refus.startsWith("aucune clé") ? "Réglages" : undefined,
      }
    if (!prompt.trim()) return { texte: "aucun prompt" }
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95).
    return null
  }, [panne, liaison, modeles, modele, prompt])

  // ── Générer ───────────────────────────────────────────────────────────────

  /** La série qu'on est en train de refaire — **une chose et une pose**.
   *
   *  C'est elle que la case « ne plus me le montrer » retient. Dès qu'on change
   *  de l'une ou de l'autre, l'écran revient : relire dix fois la même chose est
   *  une punition, relire la première d'une série ne l'est pas.
   *
   *  **`null` quand aucune case n'est visée, et c'est un bug payé en argent
   *  réel** (signalé le 31 août 2026). Sans chose du jeu, les trois morceaux
   *  sont vides : *toutes* les générations libres partageaient donc la même clé,
   *  dans tous les jeux. Cocher la case une seule fois éteignait l'écran de
   *  confirmation pour chacune d'elles jusqu'au rechargement de l'onglet — et le
   *  clic suivant sur Générer partait droit à la dépense, sans rien montrer.
   *  C'était très exactement la case « pour toujours » que le produit s'interdit,
   *  atteinte par accident. Une série est une *répétition* ; un texte écrit à la
   *  main n'en est pas une, donc il n'y a rien à sauter. */
  const serie = cible
    ? [cible.personnage, cible.poses.join("·"), cible.piece ?? ""].join("|")
    : null

  /** Le bouton de la barre qui paie — **il n'envoie plus, il fait relire** (E14).
   *
   *  L'écran de confirmation s'intercale entre le bouton et la dépense. Il se
   *  saute pour la série en cours, et seulement pour elle : une case définitive
   *  éteindrait le seul écran qui montre ce qui part, et on la cocherait le
   *  premier jour, quand on ne sait pas encore qu'on en aura besoin. */
  /** Ce qui est **payé et pas encore arrivé**, tous lots confondus.
   *
   *  Le chantier tenait déjà sa place dans la grille de la galerie, avant même
   *  que l'image existe. Mais on paie aussi depuis le codex et depuis l'établi,
   *  et là rien ne bougeait : l'auteur dépensait, l'écran restait immobile, et
   *  il recliquait — ce qui repayait. Deux endroits le disent maintenant, et ils
   *  se partagent le travail : le **bloc en route** prend la place du bouton là
   *  où l'on vient de payer, la **pastille de l'onglet Galerie** suit d'un lieu
   *  à l'autre.
   *
   *  Les échecs n'y sont pas : ils ont leur propre locataire dans la fente, le
   *  revers, et deux tenants à la fois est ce que la fente s'interdit. */
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

  const enRoute = chantier.flatMap((generation) =>
    generation.emplacements.filter(
      (e) => e.statut === "en_attente" || e.statut === "en_cours",
    ),
  )

  /** Le plus ancien départ encore en route — `null` tant que tout attend en
   *  file chez le fournisseur.
   *
   *  **C'est lui que la jauge mesure, et c'est le bon.** Les emplacements d'un
   *  lot partent *ensemble* — `atelier/services/generation.py`, « un
   *  emplacement, un appel, tous en parallèle » —, donc ils partagent leur
   *  attente et le plus ancien est celui dont on attend la fin. Quand deux lots
   *  se chevauchent, la barre suit le premier ; il arrive, et elle passe au
   *  suivant sans jamais reculer. */
  const plusAncien = enRoute.reduce<Emplacement | null>(
    (ancien, emplacement) =>
      emplacement.demarre_le !== null &&
      (ancien === null ||
        ancien.demarre_le === null ||
        emplacement.demarre_le < ancien.demarre_le)
        ? emplacement
        : ancien,
    null,
  )

  const enVol: EnVol | null =
    enRoute.length === 0
      ? null
      : {
          images: enRoute.length,
          demarreLe: plusAncien?.demarre_le ?? null,
          attendue: plusAncien?.duree_attendue_s ?? 0,
        }

  /** **Ce qui part, réduit à une chaîne** (U1). Deux appels qui rendraient la
   *  même chaîne sont la même intention, et se partagent donc un identifiant ;
   *  dès qu'un caractère change, l'intention est neuve et l'identifiant l'est
   *  aussi. C'est la liste exacte du corps envoyé par `payer` — un champ oublié
   *  ici ferait passer deux appels différents pour un seul, et le serveur
   *  refuserait le second sans rien dire.
   *
   *  **Ce n'est pas un `useMemo`** : elle se lit dans `payer`, une fois, au
   *  moment du clic. La mémoriser à chaque rendu coûterait un `JSON.stringify`
   *  par frappe dans le champ de prompt, pour une valeur qu'on ne regarde qu'en
   *  payant. */
  const signatureEnvoi = () =>
    JSON.stringify([
      cible?.personnage ?? null,
      !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
      cases ? null : (cible?.direction ?? null),
      enPlanche ? directionsCible : null,
      cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
      cible?.piece ?? null,
      ecarteesGeneration,
      modele?.identifiant ?? null,
      prompt.trim(),
      promptNegatif.trim(),
      proportions,
      cases ? 1 : variations,
      options,
      reinjections,
      echelle,
      repris,
      tri,
    ])

  /** L'identifiant de l'intention courante — le même tant que rien de ce qui
   *  part n'a changé, et **c'est lui qui empêche le second clic de payer**. */
  const identifiantDeLIntention = () => {
    const signature = signatureEnvoi()
    if (intention.current?.signature !== signature)
      intention.current = {
        signature,
        identifiant: crypto.randomUUID().replace(/-/g, ""),
      }
    return intention.current.identifiant
  }

  /** Refermer la fenêtre de confirmation, **et ce qui s'est posé par-dessus**
   *  (M5).
   *
   *  Le choix d'une référence est un état de cette fenêtre-là, pas du produit :
   *  le laisser derrière rouvrirait la grille à la prochaine ouverture, devant
   *  un appel qui n'a rien demandé. Les quatre façons de sortir passent donc
   *  ici — le bouton, Échap, l'onglet, et reprendre le texte à la main. */
  const fermerCeQuiPart = () => {
    setEnvoiOuvert(false)
    setChoixDeReference(false)
  }

  const generer = () => {
    if (refus || !modele) return
    // L'échec d'avant appartenait à l'appel d'avant.
    setEchecDuPaiement(null)
    // **Pas de série, pas de saut.** `serie` vaut `null` quand aucune case n'est
    // visée, et `serieSautee` vaut `null` quand rien n'a été sauté : les
    // comparer sans ce garde-fou rendait vrai « rien saute rien », et l'écran
    // disparaissait pour toutes les générations libres.
    if (serie !== null && serieSautee === serie) {
      void payer()
      return
    }
    // **Le tri repart de rien dès que l'appel change** (M5, révisant E14).
    //
    // La règle disait *à chaque ouverture*, et elle visait un vrai danger : un
    // réglage qui traînerait d'un appel au suivant. Elle reste. Ce qui change
    // est **ce qu'elle appelle un autre appel** — sortir chercher une image et
    // revenir n'en est pas un. Ce qu'on a éteint pour *cet* appel-ci vaut
    // encore pour lui ; ce qu'on avait éteint pour un autre ne le suit pas.
    if (triDe !== signatureDeLAppel) {
      setTri(TRI_VIDE)
      setTriDe(signatureDeLAppel)
    }
    setEnvoiOuvert(true)
  }

  const payer = async () => {
    if (refus || !modele) return
    // **Le verrou qui arrête le second clic** (U1). Lu et écrit dans le même
    // tour de boucle, avant tout `await` : c'est la seule façon d'arrêter deux
    // clics partis dans la même image de rendu, que le drapeau d'état
    // n'attraperait pas — il n'est vrai qu'au rendu suivant.
    if (paiementEnCours.current) return
    paiementEnCours.current = true
    setEnPaiement(true)
    setEchecDuPaiement(null)
    // **Un identifiant par intention** : le même pour deux clics sur le même
    // envoi, neuf dès que ce qui part change. C'est lui qui empêche une double
    // soumission de facturer deux fois — le serveur rend *déjà soumise* et ne
    // facture rien quand il le revoit.
    const identifiant = identifiantDeLIntention()
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
        // **Ce que l'écran de confirmation a trié** (E14). Il ne remonte nulle
        // part : le prochain appel repart des réglages, comme si de rien
        // n'était.
        tri,
        // **La palette en image**, quand la case est cochée : une bande de
        // pastilles qui occupe une des places de référence du modèle.
        palette: tri.allumes.includes("options.palette"),
      })
      // Le flux l'a peut-être déjà annoncée — on fond, on n'empile pas.
      setChantier((liste) => fondre(liste, generation))
      // L'avis de cette génération-là est parti avec elle : le suivant se
      // reprend aux portées durables, comme au premier prompt de la séance.
      setEcarteesGeneration(null)
      // L'écran de confirmation se referme avec l'appel qu'il a relu, et le tri
      // part avec lui. **Ici il part pour de bon** (M5) : l'appel est parti,
      // donc il n'y a plus d'appel dont ces corrections-là seraient les
      // corrections. C'est la différence avec un aller-retour.
      fermerCeQuiPart()
      setTri(TRI_VIDE)
      setTriDe(null)
      // **La cible se désarme dès que l'appel est parti.** C'est une intention
      // qui vaut pour *cette* génération : la garder enverrait l'image suivante
      // — un tonneau, un décor — dans la case d'un personnage, sans que rien
      // ne l'ait demandé. On réarme d'un clic depuis la matrice.
      setCible(null)
      // **L'intention est consommée** (U1). Le même identifiant réemployé après
      // un appel parti ferait rendre *déjà soumise* par le serveur : deux images
      // volontairement identiques, demandées deux fois de suite, n'en feraient
      // qu'une, et rien ne le dirait.
      intention.current = null
    } catch (erreur) {
      // **L'identifiant reste**, et c'est voulu : rien n'a été enregistré côté
      // serveur, donc réessayer est la *même* intention. Le bouton redevient
      // cliquable — c'est le seul cas où il le redevient.
      setEchecDuPaiement(
        erreur instanceof Refus ? erreur.message : "génération refusée",
      )
    } finally {
      paiementEnCours.current = false
      setEnPaiement(false)
    }
  }

  // ── Ce que l'écran de confirmation montre ─────────────────────────────────
  //
  // **Un aller-retour, et il porte le texte et le prix ensemble.** Un écran qui
  // demanderait son texte à une route et son prix à une autre finirait par
  // afficher un texte d'avant à côté d'un prix d'après. Rien n'est facturé, rien
  // n'est enregistré, et l'appel ne sort pas de la machine.
  //
  // **Et la demande attend que la frappe se pose** (M3). Corriger une ligne
  // écrit dans le tri, qui est une dépendance d'ici : un mot de dix lettres
  // partait en dix allers-retours enchaînés. Le repos vaut pour tout ce qui
  // change pendant que la fenêtre est ouverte, et pour rien à l'ouverture — la
  // première demande part sur-le-champ.
  useEffect(() => {
    if (!envoiOuvert || !modele) {
      // Fenêtre fermée : la prochaine ouverture repart sans attendre.
      ouverture.current = true
      return
    }
    let vivant = true
    const attente = ouverture.current ? 0 : REPOS_FRAPPE
    ouverture.current = false
    const minuterie = window.setTimeout(() => {
      void api
        .envoi({
          prompt: prompt.trim(),
          modele: modele.identifiant,
          projet: bibliotheque.courant,
          echelle,
          personnage: cible?.personnage ?? null,
          pose: !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
          direction: cases ? null : (cible?.direction ?? null),
          directions: enPlanche ? directionsCible : null,
          poses:
            cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
          piece: cible?.piece ?? null,
          references: reinjections,
          references_ecartees: ecarteesGeneration,
          variations: cases ? 1 : variations,
          repris,
          tri,
          // **Ce que l'auteur interdit de sa main** (D3) : le fond du jeu s'y
          // ajoute, et sans lui l'écran montrerait l'interdiction du produit
          // seule là où l'appel en enverra deux.
          prompt_negatif: promptNegatif.trim(),
        })
        .then((recu) => {
          if (!vivant) return
          setEnvoi(recu)
        })
        .catch((erreur) => {
          if (!vivant) return
          setEnvoi(null)
          echouer(erreur, "l'atelier ne dit pas ce qui partirait")
        })
    }, attente)
    return () => {
      vivant = false
      window.clearTimeout(minuterie)
    }
    // Les poses et les directions **jointes** et non les tableaux : ils se
    // refabriquent à chaque rendu, et deux appels de même taille sur des cases
    // différentes n'enverraient pas les mêmes consignes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    envoiOuvert,
    modele?.identifiant,
    prompt,
    repris,
    echelle,
    variations,
    bibliotheque.courant,
    cible?.personnage,
    cible?.piece,
    cible?.direction,
    cible?.poses.join("·"),
    directionsCible.join("·"),
    enPlanche,
    cases,
    reinjections,
    ecarteesGeneration,
    tri,
    promptNegatif,
    univers,
  ])

  /** **Garder une correction sur la chose du jeu — le second geste** (E14).
   *
   *  Corriger vaut pour cet appel ; garder est écrit, séparé, et il passe par la
   *  fiche de la chose, qui est le seul endroit où un texte durable s'écrit.
   *  Sans cette séparation, la dixième image d'un personnage serait fabriquée
   *  avec les réglages du neuvième essai, sans que personne l'ait décidé. */
  const garderLeTexte = async (ligne: LigneQuiPart) => {
    if (!cible?.personnage || !ligne.gardable) return
    try {
      if (ligne.groupe === "sujet") {
        await api.reglerPersonnage(cible.personnage, { description: ligne.texte })
      } else {
        await api.reglerPersonnage(cible.personnage, {
          textes: { [ligne.nom]: ligne.texte },
        })
      }
      // La correction est désormais dans la fiche : la garder aussi dans le tri
      // en ferait une seconde vérité, et l'écran montrerait « corrigé pour cet
      // appel » sur un texte qui est devenu celui de la chose.
      setTri((deja) => {
        const restant = { ...deja.textes }
        delete restant[ligne.clef]
        return { ...deja, textes: restant }
      })
      await relireProduction()
    } catch (erreur) {
      echouer(erreur, "le texte n'a pas pu être gardé")
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
    // **Le champ reçoit le signalement, et lui seul** — écrit par le serveur
    // depuis C5, réduit à ce qu'on dessine depuis E14. La consigne de l'attitude
    // et celle de l'angle sont une ligne à part, composée par le chemin de
    // l'envoi, avec leur propre origine et leur propre interrupteur : les coller
    // ici aurait obligé l'écran de confirmation à deviner où finit le
    // signalement et où commence la pose.
    //
    // **Un refus n'empêche pas d'armer.** La case est visée, l'atelier est
    // ouvert, et le champ reste à écrire : c'est un geste local et gratuit, pas
    // une dépense — le vider et laisser la main est moins coûteux que de
    // renvoyer l'auteur d'où il vient.
    try {
      const recu = await api.sujetDeCase({
        personnage: personnage.identifiant,
        piece: piece?.identifiant ?? null,
        projet: bibliotheque.courant,
      })
      setPrompt(recu.sujet)
      // **Ce qui est devinable est prérempli avec sa provenance**, et se défait
      // d'un clic (E2). Le revers de la règle du grisé, qui dit sa raison
      // depuis T1 : un champ prérempli n'est pas un champ décidé.
      setProvenance(
        piece
          ? "proposé, d'après la description de la pièce · modifiable"
          : angles
            ? `proposé, d'après son signalement · les consignes des ${angles.length} directions partent case par case · modifiable`
            : poses.length > 1
              ? `proposé, d'après son signalement · les consignes des ${poses.length} poses partent case par case · modifiable`
              : "proposé, d'après son signalement · la consigne de l'attitude part à côté · modifiable",
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

  /** **Échap referme le choix, et lui seul** (M5).
   *
   *  La fenêtre de confirmation écoute Échap pour se fermer, et elle reste
   *  montée derrière : sans ce garde, une seule pression aurait refermé les
   *  deux, ramenant l'auteur au prompt alors qu'il renonçait seulement à
   *  joindre une image. En capture, et il arrête ce qu'il consomme.
   *
   *  ⚠️ **Et il rend la main à ce qui est encore au-dessus.** L'aperçu écoute
   *  Échap de la même façon, sur la même fenêtre : *arrêter la propagation* ne
   *  suffit pas entre deux écouteurs posés sur le même endroit — les deux se
   *  déclenchent, et une seule pression refermait l'image en grand **et** la
   *  grille. La marque qu'il laisse, elle, se voit : une touche déjà consommée
   *  ne se reprend pas. On regarde une image en grand avant de la choisir ; ce
   *  qu'on referme d'abord est donc l'image. */
  useEffect(() => {
    if (!choixDeReference) return
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape" || evenement.defaultPrevented) return
      evenement.stopPropagation()
      setChoixDeReference(false)
    }
    window.addEventListener("keydown", touche, true)
    return () => window.removeEventListener("keydown", touche, true)
  }, [choixDeReference])

  /** **Ajouter une référence sans quitter la fenêtre de confirmation** (M5).
   *
   *  C'est `reinjecter` **moins le changement d'onglet**, et l'écart tient à la
   *  règle qui l'avait imposé : *le geste va où son effet se voit*. Depuis la
   *  fiche d'une image de la galerie, l'effet est ailleurs — d'où le
   *  déplacement. Ici, l'effet est **sous les yeux** : l'image entre dans la
   *  liste des images jointes qu'on est en train de lire, le compte monte d'une,
   *  et le prix suit. Il n'y a rien à aller voir.
   *
   *  **Elle entre en *référence***, c'est-à-dire *le même sujet, déjà dessiné* :
   *  c'est ce qu'on veut dans le cas qui a fait la tranche — on lit ce qui part,
   *  on s'aperçoit qu'une image manque. Le rôle se change là où il se change
   *  déjà, dans la bande *Repart avec* au pied du codex, et ce détour-là ne
   *  coûte plus rien depuis que les corrections survivent à la sortie. */
  const ajouterUneReference = (asset: string) => {
    setReinjections((deja) => [
      ...deja.filter((r) => r.asset !== asset),
      { asset, role: "reference" as Role },
    ])
    setChoixDeReference(false)
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
    `${fiche || ficheClip ? 380 : 0}px`,
  ].join(" ")

  const ouverte = fiche ? grille.find((a) => a.identifiant === fiche) : undefined
  const planche = decoupeOuverte
    ? grille.find((a) => a.identifiant === decoupeOuverte)
    : undefined

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
    : // **Découper une carte du tableau.** Le même fil que la découpe d'une
      // planche, à un mot près : *Inspiration* au lieu de *Galerie*, parce que
      // ce ne sont pas les mêmes images et que le produit ne les confond nulle
      // part. Le dernier segment ne ramène nulle part — c'est l'étage où l'on
      // est.
      carteDecoupee
      ? [
          {
            libelle: projetCourant?.nom ?? "sans projet",
            onAller: () => setCarteDecoupee(null),
          },
          { libelle: "Inspiration", onAller: () => setCarteDecoupee(null) },
          {
            // Le groupe d'une carte est le seul nom qu'elle porte ; sans
            // groupe, son identifiant, qui en est un aussi.
            libelle: carteDecoupee.groupe || carteDecoupee.identifiant,
            onAller: () => setCarteDecoupee(null),
          },
          { libelle: "Découpage" },
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
          reserve={modele ? (reserves[modele.fournisseur] ?? null) : null}
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
          unite={modele?.unite}
          reserve={modele ? (reserves[modele.fournisseur] ?? null) : null}
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
        repris={repris}
        /* Rendre la main : le champ redevient le sujet seul. **Il ne se vide
           pas** — on ne perd pas ce qui a été écrit —, et l'atelier reprend son
           habillage par-dessus. Reprendre, lui, s'est déplacé avec le texte
           assemblé : il vit dans l'écran de confirmation, sous ce qui part mot
           pour mot (E14). */
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
        /* **Le raccourci porte le même verrou** (U1). Quand la série est
           sautée, ce bouton-ci paie sans passer par l'écran de confirmation :
           il doit donc dire qu'il paie et refuser le second clic exactement
           comme l'autre. */
        enPaiement={enPaiement}
        /* **Et le raccourci a besoin du même retour** : quand la série est
           sautée, il n'y a pas d'écran de confirmation où lire l'échec. */
        echec={echecDuPaiement}
        variations={variations}
        /* **Ce qui est parti se voit là où l'on a payé.** Le chantier ne
           paraissait que dans la grille de la galerie ; le codex et l'établi,
           d'où l'on paie aussi, ne montraient rien du tout. */
        enVol={enVol}
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
          //
          // **L'écran de confirmation manquait à la liste** (U1). Cliquer
          // *Galerie* changeait le fil d'Ariane et le laissait en place : on
          // était enfermé dans un écran qu'aucun onglet ne pouvait fermer.
          //
          // **Le tri, lui, ne part plus avec lui** (M5). Il partait, et c'est ce
          // qui mettait l'auteur devant un choix que personne n'avait voulu lui
          // imposer : garder ses corrections, ou sortir chercher l'image dont il
          // venait de voir qu'elle manquait. Sortir n'est pas demander autre
          // chose — c'est `signatureDeLAppel` qui dit ce qu'est un autre appel,
          // et elle est relue à la réouverture.
          setDecoupeOuverte(null)
          setCarteDecoupee(null)
          setDepensesOuvertes(false)
          setClipOuvert(null)
          fermerCeQuiPart()
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
        // **Avec quoi on peut produire** (F3), et non plus *ce qui manque* :
        // la barre lit le tiroir entier, un fournisseur par place, et elle ne
        // dit « aucune clé » que si aucun n'est utilisable — ce qui n'arrive
        // plus, puisqu'il en reste toujours un.
        tiroirs={etat?.secrets ?? null}
        // **Trois portes, une seule pièce** : ce mot-ci, l'étape « Les
        // fournisseurs » de l'assistant, et le bouton qui paie éteint mènent
        // tous les trois au champ où la clé habite.
        onReglagesCle={() => setReglagesOuverts(true)}
        bascules={depensesOuvertes ? [] : bascules}
        onBasculer={(cle) => setReplies((r) => ({ ...r, [cle]: !r[cle] }))}
        fente={fente}
        onReglages={() => setReglagesOuverts(true)}
        onGuide={() => ouvrirGuide()}
        // **La moitié du retour qui traverse les onglets.** Le bloc en route
        // vit dans la barre de prompt, donc sur la galerie seule ; celle-ci est
        // rendue partout, et c'est loin du champ qu'on doute le plus.
        enVol={enVol?.images ?? 0}
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
      {depensesOuvertes && !envoiOuvert && !clipOuvert && (
        <EcranDepenses
          projetCourant={bibliotheque.courant}
          onErreur={setPanne}
          onFermer={() => setDepensesOuvertes(false)}
        />
      )}

      {/* ── Commander un clip, entre la case et la dépense (A9) ────────────
          **La troisième surface d'où l'argent part**, et la V3 l'assume : on ne
          commande pas une animation depuis une barre de saisie faite pour des
          images, parce qu'on n'y choisit ni durée, ni format, ni image de
          départ obligatoire. Ce qui tenait derrière la règle tient toujours —
          l'argent ne part jamais sans un écran qui recouvre le produit, montre
          ce qui va partir et porte le montant sur son bouton.

          Il prend la même ligne que les dépenses et la confirmation : il
          n'appartient à aucun des trois onglets. */}
      {clipOuvert && !envoiOuvert && (
        <EcranClip
          cible={clipOuvert}
          onFermer={() => setClipOuvert(null)}
          /* **Les clips partis se regardent arriver dans la galerie.** Ils y
             tiennent leur place comme n'importe quel appel — le flux les y
             pose, un par un, et chacun se voit dès son arrivée. L'écran se
             referme : ce qu'on voulait faire est fait. */
          onCommande={(clips) => {
            setClipOuvert(null)
            setOnglet("galerie")
            setChantier((liste) =>
              clips.reduce((tenue, clip) => fondre(tenue, clip), liste),
            )
          }}
        />
      )}

      {/* ── Ce qui part, entre le bouton et la dépense (E14) ──────────────
          **Il s'intercale, il ne remplace rien.** Il prend la ligne du milieu,
          comme les dépenses, parce qu'il n'appartient à aucun des trois onglets :
          il paraît partout où l'on paie. Il n'a pas besoin de la barre qui paie
          sous lui — c'est lui qui porte le bouton, cette fois, et il n'y a
          toujours qu'un seul endroit d'où l'argent part. */}
      {envoiOuvert && (
        <EcranEnvoi
          envoi={envoi}
          tri={tri}
          onTri={setTri}
          onImage={(asset, cochee) =>
            setEcarteesGeneration((deja) => {
              // **La portée de cette génération-là décide seule quand elle a un
              // avis** (US-126). La première coche la fabrique à partir de ce
              // que le serveur écarte déjà, sinon décocher une image
              // rallumerait toutes celles que les portées durables retiennent.
              const base =
                deja ??
                (envoi?.images.lignes ?? [])
                  .filter((l) => !l.cochee)
                  .map((l) => l.asset)
              return cochee
                ? [...base.filter((a) => a !== asset), asset]
                : base.filter((a) => a !== asset)
            })
          }
          onPayer={() => void payer()}
          /* **Le bouton dit qu'il paie, et n'accepte pas de second clic** (U1).
             Il ne redevient cliquable que si l'appel échoue : quand il réussit,
             l'écran se referme avec lui. */
          enPaiement={enPaiement}
          /* **L'appel qui n'est pas passé se lit là où on a cliqué** (U1), et
             il ne grise pas le bouton : ce qu'on veut faire d'un appel raté est
             le refaire. */
          echec={echecDuPaiement}
          onFermer={fermerCeQuiPart}
          onGarder={(ligne) => void garderLeTexte(ligne)}
          onSauter={
            serie === null
              ? null
              : (saute: boolean) => setSerieSautee(saute ? serie : null)
          }
          /* **Reprendre pose le texte exact, et referme l'écran** : le champ
             *est* désormais ce qui partira, et le relire ligne par ligne
             n'aurait plus de lignes à montrer — il n'y a plus de bible d'un côté
             et de sujet de l'autre, il y a un texte. */
          onReprendre={(texte) => {
            setPrompt(texte)
            setRepris(true)
            fermerCeQuiPart()
          }}
          refus={refus?.texte ?? null}
          /* **L'adresse de l'image que la planche joint** (M4). Elle se compose
             ici et pas dans l'écran, parce que c'est ici que vivent les repères
             de l'appel — le même endroit qui les envoie déjà à la confirmation.
             Elle décrit donc exactement l'appel qui vient d'être composé. */
          plancheJointe={
            envoi?.images.jointe && modele
              ? api.plancheJointe({
                  modele: modele.identifiant,
                  projet: bibliotheque.courant,
                  personnage: cible?.personnage ?? null,
                  pose:
                    !cases || enPlanche
                      ? (posesCible[0]?.identifiant ?? null)
                      : null,
                  piece: cible?.piece ?? null,
                  poses:
                    cases && !enPlanche
                      ? posesCible.map((p) => p.identifiant)
                      : null,
                  directions: enPlanche ? directionsCible : null,
                })
              : null
          }
          /* **Ajouter une référence sans refermer** (M5). Le geste vit dans la
             section des images jointes, là où l'on vient de voir qu'il en
             manquait une. */
          onAjouterUneReference={() => setChoixDeReference(true)}
        />
      )}

      {/* ── Choisir une image de référence, par-dessus la confirmation ──────
          **C'est la grille du produit, réemployée telle quelle.** L'invariant
          dit *une seule grille d'assets dans tout l'atelier* : celle qui s'ouvre
          ici **est** celle-là, avec ses tuiles, son dépôt de fichier et son
          filtre. En dessiner une neuvième aurait été une neuvième façon de
          choisir une image.

          **Elle se pose par-dessus, elle ne remplace pas.** La fenêtre de
          confirmation reste montée derrière — c'est ce qui fait que les
          corrections en cours ne bougent pas d'un caractère pendant l'ajout, et
          c'est tout le sujet de la tranche.

          Sous l'aperçu, jamais au-dessus : on regarde une image en grand
          **avant** de la choisir, et l'aperçu est ce qui sert à ça. */}
      {envoiOuvert && choixDeReference && (
        <div
          data-choix-reference
          role="dialog"
          aria-label="Choisir une image de référence"
          /* **Dans le cadre, pas par-dessus le cadre.** La barre du châssis en
             haut et la barre d'état en bas appartiennent au produit entier et
             ne s'effacent nulle part — la fenêtre de confirmation elle-même les
             laisse. Une surface qui les recouvrirait dirait qu'on a quitté
             l'atelier, alors qu'on est au milieu d'un geste. */
          className="fixed inset-x-0 bottom-[26px] top-[44px] z-40 flex flex-col bg-fond-0"
        >
          <div className="flex items-baseline gap-3 border-b border-bord px-4 py-3">
            <Libelle>choisir une image de référence</Libelle>
            <span className="mesure text-[9.5px] leading-4 text-texte-3">
              elle entre en <span className="text-texte-2">référence</span> —
              *le même sujet, déjà dessiné* — et rien de ce que tu viens de
              corriger ne bouge. Aucun appel ne part d'ici.
            </span>
            {/* **Le seul réglage de cette surface, et c'est celui de la
                galerie** : la recherche du filtre, la même. Sans elle, choisir
                dans une bibliothèque de deux cents images reviendrait à faire
                défiler ; avec un second filtre à elle, la surface cesserait
                d'être la grille du produit. */}
            <input
              value={filtre.recherche}
              onChange={(e) =>
                setFiltre((f) => ({ ...f, recherche: e.target.value }))
              }
              aria-label="Chercher une image à joindre"
              placeholder="Chercher"
              className="mesure ml-auto h-[24px] w-[220px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte placeholder:text-texte-3"
            />
            <button
              type="button"
              onClick={() => setChoixDeReference(false)}
              title="Échap revient à ce qui part"
              className="mesure px-1 text-[10px] text-texte-3 hover:text-texte"
            >
              ‹ revenir
            </button>
          </div>
          <Grille
            entrees={entrees}
            selection={selection}
            filtre={filtre}
            zoom={zoomRendu}
            entree={entree}
            onRelancer={relancer}
            onChoisir={(generation, rang) => setDepliage({ generation, rang })}
            /* **Un clic choisit, il n'ouvre pas de fiche.** C'est le seul
               endroit où la grille sert à désigner plutôt qu'à juger, et une
               entrée qui n'est pas encore une image n'a rien à joindre : le
               clic ne fait alors rien, plutôt que de joindre un identifiant
               d'emplacement que le serveur ne saurait pas relire. */
            onOuvrir={(identifiant) => {
              if (grille.some((a) => a.identifiant === identifiant))
                ajouterUneReference(identifiant)
            }}
            onRetirerFiltre={() => setFiltre(FILTRE_VIDE)}
          />
        </div>
      )}

      {/* **Les tables, à la profondeur de la galerie.** Une image qui
          n'appartient à aucune chose du jeu n'a pas d'établi ; elle a quand
          même une recette, et il faut un endroit pour la régler. Ses sœurs sont
          alors les voisines de la grille, ce que la maquette du châssis prévoit
          en toutes lettres. */}
      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "galerie" && imageDesTables && etat && (
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
              sujet={{
                famille: "planche",
                planche: imageDesTables,
                onDecoupe: (decoupes) => {
                  setTable("detourage")
                  if (decoupes.length > 0)
                    setSelection([decoupes[0].identifiant])
                },
              }}
              onFermer={() => setTable("detourage")}
              onFente={setFente}
            />
          }
          onErreur={setPanne}
          onUnivers={setUnivers}
          BlocPasse={BlocPasse}
        />
      )}

      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "galerie" && !imageDesTables && planche && (
        <EcranDecoupe
          sujet={{
            famille: "planche",
            planche,
            onDecoupe: (decoupes) => {
              setDecoupeOuverte(null)
              if (decoupes.length > 0) setSelection([decoupes[0].identifiant])
            },
          }}
          onFermer={() => setDecoupeOuverte(null)}
          onFente={setFente}
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
      {/* **Et elle se retire quand une table s'ouvre** — corrigé le 31 août
          2026. Elle restait montée sous la table de retouche : invisible, mais
          vivante. Mesuré au navigateur — 152 commandes atteignables à la
          Tabulation, dont 83 hors de l'écran, appartenant toutes à la grille du
          dessous, « Supprimer la sélection » comprise : on la traversait à
          l'aveugle. Et les 54 px dont la page débordait faisaient reparaître sa
          barre tout en bas de la table, ce que la règle « un panneau est borné
          par l'écran, jamais par son contenu » interdit. La retirer répare les
          deux d'un coup, et elle ne perd rien en partant : ce qu'elle tient vit
          dans `App`, pas dans son montage. */}
      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "galerie" && !planche &&
        !imageDesTables && (
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
                setOnglet("codex")
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
      )}

      {/* **Les deux autres onglets, dans la même case de grille.** Ils ne
          couvrent plus rien : ils occupent la ligne du milieu, entre la barre du
          châssis et la barre d'état, exactement comme la galerie. C'est ce qui
          leur retire leur en-tête de 44 px — il y en avait trois, un par écran,
          et il n'y en a plus qu'un — et leur fente de refus, désormais
          partagée. */}
      {/* **`etat` garde l'écran** depuis D2 : l'assistant a besoin de savoir
          quelles façons de réduire cette machine-ci sait faire, et cette liste
          vient du serveur. Même garde que la galerie deux cents lignes plus
          haut — on ne rend pas un écran avant d'avoir de quoi le remplir. */}
      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "univers" && etat && (
        <EcranUnivers
          univers={univers}
          modeles={modeles}
          traitement={etat.traitement}
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
          // **Le même geste que dans la fenêtre des réglages, parce que c'est
          // le même dépôt** (F3) : l'état pour la barre du haut, le catalogue
          // pour le grisé des modèles du fournisseur qu'on vient de servir.
          onDeposee={async () => {
            await relireEtat()
            await relireCatalogue()
          }}
          vue={vueUnivers}
          onVue={setVueUnivers}
          replies={{ univers: replies.univers, reserve: replies.reserve }}
          onFente={setFente}
          onUnivers={setUnivers}
          onRelire={relireTableau}
          fabriques={fabriques}
          // **Aller voir ce qu'on vient de fabriquer** (U7) : le côté change et
          // l'objet s'ouvre, en un geste. La cible est consommée par le côté
          // Ambiances, qui la rend ensuite — sans quoi rouvrir l'onglet
          // rouvrirait toujours la même palette.
          onAllerAuxAmbiances={(cible) => {
            setCoteUnivers("ambiances")
            setCibleAmbiances(cible)
          }}
          cibleAmbiances={cibleAmbiances}
          onCibleVue={() => setCibleAmbiances(null)}
          // **Découper une carte, depuis son menu** (06bis). L'état monte jusqu'ici
          // parce que le fil d'Ariane le nomme ; l'écran, lui, se rend en bas,
          // à la place du tableau.
          carteDecoupee={carteDecoupee}
          onDecouperCarte={setCarteDecoupee}
        />
      )}

      {/* **Le codex, et sa profondeur.** Une chose du jeu ouverte remplace le
          codex par son établi — c'est le même endroit vu de plus près, et le
          fil d'Ariane le dit. Les deux portent la barre qui paie, parce qu'ils
          sont les deux lieux d'où l'argent part. */}
      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "codex" && !choseOuverte && (
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

      {/* **L'atelier d'une animation gardée** (A7) — il passe avant la
          matrice pour la raison du montage : les deux ne peuvent pas être
          ouverts ensemble, on ne corrige pas une animation depuis un écran
          qui en montre douze. */}
      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "codex" && bandeOuverte && etat ? (
        montageDeLaBande ? (
        /* **Le montage rouvert sur cette animation** (V3.03.3). Il prend la
           place de l'atelier, comme l'atelier prend celle de la matrice : ce
           n'est pas une fenêtre par-dessus, c'est la profondeur suivante du
           même endroit. Revenir refait naître l'atelier, qui relit donc
           l'animation sur le disque — y compris ce que le montage vient d'y
           écrire. */
        <EcranMontage
          clip={montageDeLaBande.clip}
          reprise={{
            bande: montageDeLaBande,
            onRepris: () => {
              setMontageDeLaBande(null)
              void relireProduction()
            },
          }}
          onFermer={() => setMontageDeLaBande(null)}
          onErreur={(raison) => setPanne(raison)}
        />
        ) : (
        <EcranAtelierDeBande
          identifiant={bandeOuverte}
          // **Les tables de l'établi, posées sur une frame** (V3.03.1). Elles
          // ont besoin de ce que l'établi leur donne : la palette du jeu, et ce
          // que la machine sait faire — quels moteurs de détourage répondent,
          // quelles réductions sont disponibles. Les deux vivent déjà ici, et
          // les redemander depuis l'atelier serait un second état de la même
          // chose, qui finirait par griser autre chose que l'établi.
          univers={univers}
          traitement={etat.traitement}
          onFermer={() => ouvrirLAtelierDeBande(null)}
          onErreur={(raison) => setPanne(raison)}
          // La planche a changé sur le disque, et la matrice l'affiche
          // aussi : une vignette qui montrerait l'ancienne serait un
          // mensonge silencieux.
          onChangee={() => void relireProduction()}
          onReprendreLeMontage={setMontageDeLaBande}
        />
        )
      ) : null}

      {!depensesOuvertes && !envoiOuvert && !clipOuvert && onglet === "codex" && choseOuverte && !bandeOuverte && (
        <EcranEtabli
          ouvert={choseOuverte}
          plan={plan}
          onPersonnage={fondrePersonnage}
          emplacements={emplacements}
          pieces={pieces}
          onArmer={armer}
          /* **Animer une case ouvre l'écran du clip** (A9). La matrice désigne,
             cet écran-là paie — exactement le partage que `onArmer` tient déjà
             avec la barre qui paie, sauf que le guichet n'est pas le même : on
             y commande une vidéo, pas une image. */
          onAnimer={(personnage, pose, direction) =>
            setClipOuvert({ personnage, pose, direction: direction ?? null })
          }
          onFente={setFente}
          // **La barre de prompt se retire quand l'outil s'ouvre** : on
          // retouche, on ne paie pas — et un écran incapable de dépenser ne
          // porte pas le champ qui dépense.
          barreQuiPaie={imageOuverte ? null : barreQuiPaie}
          onOuvrirCase={setCaseOuverte}
          /* **Une case animée se remonte jusqu'à son clip** (A12), et le clip
             se découpe dans la galerie : deux gestes en un, comme la
             superposition juste en dessous. C'est écrit ici parce que seul
             `App` sait qu'il existe des onglets — la matrice, elle, ne fait
             que nommer un clip. */
          onMonterLaBande={(clip) => {
            setOnglet("galerie")
            setMontageOuvert(clip)
          }}
          /* **Et la vignette, elle, ouvre l'animation** (A7) — sans changer
             d'onglet : on la retravaille là où on la regarde. */
          onOuvrirLaBande={ouvrirLAtelierDeBande}
          // **Deux gestes en un, et l'ordre compte** (G16) : l'image s'ouvre
          // dans les tables, et la table ouverte est la superposition. Écrit
          // ici parce que la table ouverte est un état de l'établi — la
          // matrice, elle, n'a pas à savoir qu'il existe des tables.
          onSuperposition={(identifiant) => {
            setCaseOuverte(identifiant)
            setTable("superposition")
          }}
          // **Jeter depuis la matrice passe par le même geste que la galerie**
          // (US-505) : un seul chemin de suppression dans tout le produit.
          //
          // **Mais le geste rendait dans le vide, et c'est le navigateur qui
          // l'a dit** (4 septembre 2026) : le bandeau *annuler* vit dans la
          // barre d'outils de la galerie, et cet écran-ci ne la montre pas. On
          // supprimait donc depuis un endroit d'où l'on ne pouvait pas défaire,
          // alors que l'infobulle du bouton promettait le contraire. Le compte
          // rendu part dans la fente du châssis — la place des comptes rendus —
          // **avec le geste qui rend**, et non un simple mot.
          onSupprimer={(identifiants) => {
            void supprimer(identifiants).then((jetes) => {
              if (!jetes) return
              setFente({
                ton: "ok",
                texte: (
                  <>
                    l'image est à la corbeille —{" "}
                    <button
                      type="button"
                      onClick={() => {
                        void rendre(jetes)
                        setFente(null)
                      }}
                      className="underline underline-offset-2 hover:text-texte"
                    >
                      la rendre
                    </button>
                  </>
                ),
              })
            })
          }}
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
                    sujet={{
                      famille: "planche",
                      planche: imageOuverte,
                      onDecoupe: (decoupes) => {
                        setTable("detourage")
                        if (decoupes.length > 0)
                          setSelection([decoupes[0].identifiant])
                      },
                    }}
                    onFermer={() => setTable("detourage")}
                    onFente={setFente}
                  />
                }
                onErreur={setPanne}
                onUnivers={setUnivers}
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
          tiroirs={etat.secrets}
          agent={etat.agent}
          // **Le catalogue entier, filtré par l'écran** (F6). Le garde-fou du
          // modèle d'exploration ne propose que des gratuits, et c'est lui qui
          // porte cette règle : la filtrer ici en ferait deux endroits à tenir
          // d'accord.
          modeles={modeles}
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
  if (entree.sorte !== "emplacement") return 0
  const lot = entree.generation.clip?.lot
  if (!lot) return 0
  return entrees.filter(
    (autre) =>
      autre.sorte === "emplacement" &&
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
