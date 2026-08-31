// Le seul endroit de l'interface qui connaisse l'API. Les charges utiles sont
// en français : c'est l'interface qui les lit, et l'interface est française.

export type Statut =
  | "en_attente"
  | "en_cours"
  | "reussie"
  | "echouee"
  | "interrompue"

export type Option = {
  nom: string
  genre: "choix" | "intervalle" | "booleen"
  valeurs: string[]
  minimum: number | null
  maximum: number | null
}

export type Modele = {
  identifiant: string
  nom: string
  references_max: number
  proportions: string[]
  resolutions: string[]
  variations_max: number
  options: Record<string, Option>
  /** La raison du grisé, écrite par le domaine. L'interface l'affiche, elle ne
   *  la recalcule jamais : la règle « indisponible avec sa raison » vit côté
   *  serveur, en un seul endroit. */
  refus: string | null
}

export type Resultat = {
  fichier: string
  largeur: number
  hauteur: number
  type_media: string
  octets: number
}

export type Emplacement = {
  rang: number
  statut: Statut
  cout_usd: number
  duree_s: number
  resultat: Resultat | null
  raison: string | null
  /** Quand l'appel est parti, en secondes epoch. Null tant qu'il n'est pas parti.
   *  Avec `duree_attendue_s`, c'est tout ce qu'il faut pour une jauge déterminée
   *  — aucun avancement n'est enregistré côté serveur, parce qu'aucun
   *  fournisseur d'image n'en rend un. */
  demarre_le: number | null
  /** Ce que ce modèle a mis, en médiane, à ses derniers appels réussis. */
  duree_attendue_s: number
}

// ── La réinjection ──────────────────────────────────────────────────────────
//
// « Un asset se réinjecte dans le générateur dans ses quatre rôles » (US-12).
// Trois envoient une image ; le quatrième — **jeu de réglages** — n'envoie
// rien : il repeuple le générateur avec les paramètres d'une génération passée,
// et ne laisse donc aucune trace dans celle qui part.

export type Role = "reference" | "edition" | "style"

export type Reinjection = { asset: string; role: Role }

export const ROLES: { role: Role; libelle: string; explique: string }[] = [
  { role: "reference", libelle: "référence", explique: "elle inspire" },
  { role: "edition", libelle: "source d'édition", explique: "elle engendre" },
  { role: "style", libelle: "guide de style", explique: "elle donne la manière" },
]

export type Generation = {
  identifiant: string
  modele: string
  demande: {
    /** **Le prompt tel qu'il est parti** — bible repliée en tête et consignes
     *  de planche en queue comprises. Ce n'est pas ce que l'auteur avait tapé :
     *  c'est ce que le modèle a lu, et c'est le seul texte qui explique
     *  l'image des mois plus tard. */
    prompt: string
    prompt_negatif: string
    proportions: string
    resolution: string | null
    variations: number
    references: number
    options: Record<string, unknown>
    /** Ce prompt-là est celui que l'auteur a écrit, pas celui que l'atelier a
     *  composé (US-160). Absent des générations d'avant R2. */
    repris?: boolean
  }
  parametres_resolus: Record<string, unknown>
  ecartees: string[]
  emplacements: Emplacement[]
  cree_le: number
  projet: string | null
  references: Reinjection[]
  /** L'asset dont ce lot descend — la réinjection marquée « edition ». Déduit
   *  par le serveur, jamais enregistré deux fois. */
  parent: string | null
  statut: Statut
  cout_usd: number
  reussies: number
}

// ── Le post-traitement ──────────────────────────────────────────────────────
//
// Une recette, c'est six places nommées dans un ordre fixe : détourage,
// différence, recadrage, grille, quantification, bords. Ce n'est pas une liste
// que l'auteur ordonne — cinq des six étapes n'ont aucun sens avant celle qui
// les précède. `null` veut dire « place vide », et une recette dont les six
// places sont vides ne produit aucun rendu : le brut suffit.

export type Passe = {
  moteur: "bord" | "modele"
  tolerance: number
  seuil_alpha: number
  durcissement: number
}

/** La seconde place — celle qui fait d'une image un **calque** (C3).
 *
 *  `base` est l'asset du corps qui était dans cette case quand la planche est
 *  partie : un identifiant, jamais des octets, et le corps n'est jamais
 *  modifié. `zone` est le masque rectangle (US-144), **inclusif aux deux
 *  bouts** comme tout rectangle du produit depuis T5 et exprimé en pixels de
 *  l'image rendue ; `null` cherche la différence sur toute la case, et c'est le
 *  défaut — le produit ne devine aucune zone.
 *
 *  Le déplacer ne redemande **aucune image** : le calque se recalcule, et le
 *  journal du projet ne bouge pas d'un centime (US-145).
 *
 *  **Deux couches de plus depuis C4, et elles ne se touchent jamais** (US-153) :
 *  `affinage` est ce que la main dit du masque — elle restreint ce que la
 *  différence a le droit de garder —, `retouche` ce qu'elle dit du calque
 *  lui-même — elle ôte ce qui est en trop et **ramène ce que la mesure n'a pas
 *  vu**. Poser l'une n'écrit jamais dans l'autre : ce sont deux champs. */
export type Difference = {
  base: string
  zone: number[] | null
  seuil: number
  affinage: Trait[]
  retouche: Trait[]
}

/** Un passage de la main — ce qu'un geste a gardé, ou ôté (C4).
 *
 *  **Un chemin et un rayon, jamais un masque en octets** : ce qui est
 *  enregistré est le calcul, pas l'image qu'il produit. Les points sont en
 *  pixels de l'image rendue, et un point hors du cadre se borne.
 *
 *  **Rayon 0, c'est le pixel** : les deux échelles d'US-149 — à main levée,
 *  puis au pixel — sont les deux bouts d'un seul réglage, et non deux outils. */
export type Trait = {
  garde: boolean
  rayon: number
  points: [number, number][]
  /** **Portée par le passage, pas par le calque** (E5). Un calque n'est donc
   *  pas monochrome. Vide partout où le passage décide d'un masque : les deux
   *  couches d'un calque d'équipement, et l'opacité de la septième place. */
  couleur: string
}

/** La sixième place — le trait de bord, retracé (E5, US-205).
 *
 *  `epaisseur` est en pixels de **l'image rendue** : une fois la grille posée,
 *  l'image rendue *est* la case, et un pixel y est un bloc du sprite.
 *
 *  `position` est le seul réglage du produit qui change les dimensions du rendu
 *  sans qu'on le lui ait demandé — d'où US-206, qui exige que l'écran l'écrive
 *  au moment du choix. */
export type Contour = {
  epaisseur: number
  couleur: string
  position: "externe" | "interne" | "centre"
  trous: "cercles" | "laisses"
}

/** Un calque de dessin — de la matière posée par-dessus (US-208). */
export type CalqueDessin = { nom: string; visible: boolean; passages: Trait[] }

/** Comment deux images ont été posées l'une sur l'autre (E6).
 *
 *  **Hors de la recette, et c'est le critère qui l'a rangée là** : une recette
 *  décrit comment *une* image se rend, et celle-ci nomme un second asset. Le
 *  dessus se déplace, le dessous est le sol : on ne le manipule jamais.
 *
 *  `rectangle` sert deux fois — il isole la pièce pour qu'on voie le corps
 *  dessous pendant qu'on cale, et **ce qu'il masque à l'écran, il le masque
 *  aussi à la sortie**. `main` porte les passages posés sur le dessus *avant la
 *  comparaison* : ils ne sont vrais que de cette superposition-ci, donc
 *  l'image du dessus n'est jamais modifiée. */
export type Superposition = {
  dessus: string
  dessous: string
  echelle: number
  dx: number
  dy: number
  rectangle: number[] | null
  seuil: number
  main: Trait[]
  sortie: "calque" | "aplat"
}

/** Ce qu'on reprendra la prochaine fois qu'on superpose sur cette image-là.
 *  Attachés à l'image de **référence**, jamais au calque — et sans les
 *  passages de la main, qui sont dessinés sur une pièce précise. */
export type ReglagesGardes = {
  depuis: string
  le: number
  echelle: number
  dx: number
  dy: number
  rectangle: number[] | null
  seuil: number
}

/** L'état de départ de l'outil, en un appel. */
export type OuvertureSuperposition = {
  dessus: Asset
  dessous: Asset | null
  pose: Superposition
  /** D'où vient le préremplissage, ou `null` quand rien n'est repris. */
  repris: ReglagesGardes | null
  passes_dessus: number
  passes_dessous: number
  /** **Le fait que l'alerte nomme** : sans alpha sur le dessus, le calque
   *  prendrait tout le fond. Le produit constate ; il ne refuse pas. */
  sans_alpha: boolean
}

/** Les deux sorties et les cinq mesures, sans rien écrire. Les images arrivent
 *  en `data:` — un aperçu n'existe nulle part sur le disque. */
export type ApercuSuperposition = {
  calque: string
  aplat: string
  mesures: MesuresCalque
}

/** Une manière de regarder le monde, et ce qu'elle impose (E8).
 *
 *  **Ce choix ne décide pas de l'apparence du jeu. Il décide de combien
 *  d'images il faut par pose** — un personnage qui marche vu de côté, c'est
 *  deux images ; le même vu de dessus, c'est quatre ou huit. C'est le chiffre
 *  qui multiplie toute la production, donc tout ce qu'on paiera. */
export type VueDuJeu = {
  identifiant: string
  libelle: string
  exemples: string
  images: number
  /** Ce que le choix écrit dans la case `vue` de la bible. */
  phrase: string
  directions: { nom: string; consigne: string }[]
}

export type TailleDImage = { cible: number; quoi: string }

export type VuesEtTailles = { vues: VueDuJeu[]; tailles: TailleDImage[] }

/** Une paire : un libellé qu'on clique, et le texte anglais qui part vraiment.
 *
 *  **La base appartient à l'atelier, pas à un jeu** : elle naît vide, personne
 *  ne l'écrit à la place de l'auteur, et elle grandit de chaque étiquette
 *  fabriquée dans n'importe quel projet. */
export type Etiquette = {
  identifiant: string
  libelle: string
  texte: string
  case: string
  emplois: number
}

/** Ce qu'un changement de réglage casserait, **avec les vrais chiffres**.
 *  Rien n'est jamais grisé dans l'assistant : la ligne dit le compte et le
 *  coût, puis laisse décider. */
export type Consequences = {
  images: number
  cout_usd: number
  cible: number
  poses: number
  images_de_pose: number
}

export const POSE_VIDE: Superposition = {
  dessus: "",
  dessous: "",
  echelle: 1,
  dx: 0,
  dy: 0,
  rectangle: null,
  seuil: 32,
  main: [],
  sortie: "calque",
}

/** La septième place : un sol, et ce qu'on empile dessus.
 *
 *  `opacite` est le sol de la pile — elle ne pose aucune couleur, elle décide
 *  de ce qui est là. Elle est un champ à part plutôt qu'un calque marqué, et
 *  c'est ce qui rend « elle ne se supprime pas et ne se déplace pas » vrai par
 *  construction.
 *
 *  `calques` est rangé **du dessous vers le dessus**, comme dans le domaine :
 *  l'ordre est celui de l'application. L'écran le renverse pour montrer une
 *  pile, et ce renversement est écrit là où il se fait. */
export type Main = { opacite: Trait[]; calques: CalqueDessin[] }

/** Les deux couches de la main, par leur nom de domaine (C4).
 *
 *  Les valeurs traversent le port telles quelles, comme la portée d'une pièce :
 *  une valeur traduite au passage est une valeur qu'on peut traduire de
 *  travers. */
export type Couche = "affinage" | "retouche"

export type Recadrage = { marge: number; boite: number[] | null }
export type Grille = { cible: number; occupation: number; ancrage: "bas" | "centre" }
export type Quantification = {
  couleurs: number
  palette: string[]
  tramage: "aucun" | "floyd"
}
export type Bords = { aire_min: number }

export type Recette = {
  passes: Passe[]
  difference: Difference | null
  recadrage: Recadrage | null
  grille: Grille | null
  quantification: Quantification | null
  bords: Bords | null
  contours: Contour | null
  main: Main | null
  nom: string | null
}

export const RECETTE_VIDE: Recette = {
  passes: [],
  difference: null,
  recadrage: null,
  grille: null,
  quantification: null,
  bords: null,
  contours: null,
  main: null,
  nom: null,
}

/** Ce qu'une place vaut quand on l'allume — le défaut du produit, écrit une
 *  fois. Le contour naît **externe**, parce qu'agrandir est réversible et
 *  manger le sujet ne l'est pas ; la main naît avec sa seule opacité, parce
 *  qu'un calque de dessin se crée exprès. */
export const CONTOUR_PAR_DEFAUT: Contour = {
  epaisseur: 1,
  couleur: "#000000",
  position: "externe",
  trous: "cercles",
}

export const MAIN_VIDE: Main = { opacite: [], calques: [] }

export const PASSE_PAR_DEFAUT: Passe = {
  moteur: "bord",
  tolerance: 28,
  seuil_alpha: 128,
  durcissement: 0,
}

export type Asset = {
  identifiant: string
  generation: string
  rang: number
  largeur: number
  hauteur: number
  type_media: string
  label: string
  recette: Recette
  rendu_largeur: number
  rendu_hauteur: number
  cree_le: number
  /** Ce que l'appel a facturé pour cette image-là. Une copie prise à la
   *  naissance : le total d'un projet, lui, se calcule sur les générations, qui
   *  sont les seules à connaître les appels ratés. */
  cout_usd: number
  /** Qui a demandé l'appel — `auteur` ou `agent` (US-39). Hérité de la
   *  génération à la naissance, jamais recalculé ici : retoucher une image de
   *  l'agent ne la fait pas devenir celle de l'auteur, et une découpe appartient
   *  à qui a demandé la planche. */
  provenance: "auteur" | "agent"
  /** **Le modèle qui a rendu cette image** (US-123). L'identifiant exact du
   *  fournisseur — c'est lui qu'on redemande —, `import` pour une image
   *  importée, et le vide pour une image dont la génération a disparu du
   *  disque. Une information de provenance au même titre que le prompt et le
   *  coût : elle se lit, elle ne se règle pas. */
  modele: string
  /** **De quel personnage, et de quelle pose** (C1). C'est l'image qui dit sa
   *  case, jamais le personnage qui tient la liste de ses images : la matrice
   *  se calcule là-dessus, et il n'existe nulle part un état à remettre
   *  d'accord avec le disque. Vides pour la plupart des images — la
   *  bibliothèque est faite d'images qui n'appartiennent à personne. */
  personnage: string | null
  pose: string | null
  /** **Et de quelle pièce** (C3, US-140). Le second axe de la matrice : la pose
   *  dit la ligne, la pièce dit la colonne. Vide pour un corps — c'est la
   *  colonne de gauche, et c'est le cas courant.
   *
   *  **Elle ne dit pas ce que l'image est**, seulement de quoi elle parle : un
   *  calque et un corps habillé portent la même pièce, et c'est `recette.
   *  difference` qui les distingue. Un drapeau de plus aurait été une seconde
   *  vérité sur une question à laquelle la recette répond déjà. */
  piece: string | null
  /** **Ce que la différence a mesuré sur ce calque-là** (C3, US-147). Cinq
   *  nombres, et **aucun ne refuse** : le compte d'images reste le seul refus
   *  automatique du produit. Portées aussi par un corps habillé — c'est là
   *  qu'on lit l'échelle qui a fait renoncer au calque (US-148). */
  calque: MesuresCalque | null
  /** **Ce que le lot a mesuré sur cette case-là** (C2, US-135). Vide pour toute
   *  image qui n'est pas sortie d'une planche pliée — c'est-à-dire pour
   *  l'immense majorité d'entre elles.
   *
   *  Une copie prise à la naissance, comme le coût et le modèle : la ligne de
   *  la matrice les porte, et aller chercher la génération pour trois nombres
   *  serait un aller-retour par case affichée.
   *
   *  **Elles n'empêchent rien.** Le compte d'images est le seul refus
   *  automatique du produit ; celles-ci s'affichent et laissent décider. */
  lot: MesuresLot | null
  /** Posé à l'instant où le personnage part, comme `parent_supprime` : jamais
   *  de cascade, l'image reste, et elle sait seulement de qui elle n'est plus. */
  personnage_supprime: boolean
  /** Toucher une recette à la main épingle l'asset. Relu en T4, quand un
   *  changement de palette de projet devra sauter ce qui a été réglé ici. */
  epingle: boolean
  projet: string | null
  collection: string | null
  parent: string | null
  /** Posé à l'instant où le parent part. Jamais de cascade : l'enfant reste, il
   *  sait seulement d'où il ne vient plus (US-29). */
  parent_supprime: boolean
  favori: boolean
  /** Hors bibliothèque. Le temps que dure l'annulation, l'asset existe encore
   *  sur le disque — mais plus rien ne le montre ni ne le compte. */
  supprime_le: number | null
  /** Vrai dès qu'une place de la recette est remplie — donc dès qu'il y a un
   *  rendu à montrer plutôt que le brut. */
  traite: boolean
  /** L'empreinte de la recette, calculée par le serveur. Elle voyage dans l'URL
   *  de l'image : le rendu change sous la même adresse à chaque cran de curseur,
   *  et sans elle le navigateur resservirait celui d'avant. Jamais recalculée
   *  ici — deux empreintes calculées à deux endroits finiraient par diverger. */
  empreinte: string
}

/** Ce qu'un lot plié a mesuré sur une de ses cases (C2, US-135).
 *
 *  Deux nombres, et pas un de plus. **Aucun seuil** : le produit montre le
 *  chiffre et son jumeau, et l'auteur décide — un seuil serait un nombre
 *  inventé sur un corpus de vingt-quatre planches. Pour mémoire, sur ce
 *  corpus : les deux planches qui répétaient une pose ressortaient à 0,999 et
 *  1,000, les vingt-deux autres plafonnaient à 0,897. */
export type MesuresLot = {
  /** Sa place dans la planche, en ordre de lecture. */
  case: number
  cases: number
  /** Le pas de pixel sur lequel le modèle a peint cette case. */
  grille_px: number
  /** Le plus fort recouvrement de silhouette avec une autre case du lot. */
  ressemblance: number
  /** Laquelle, ou `-1`. Les jumelles se désignent l'une l'autre. */
  jumeau: number
  /** La dérive de grille du lot entier — le rapport du plus grand pas au plus
   *  petit. Un fait sur le lot, recopié sur chaque case qui doit le dire. */
  derive: number
}

/** Ce que la différence a lu d'un calque (C3, US-147).
 *
 *  Leur définition vient de `essais/essai_silhouette.py`, étalonné le 28 août
 *  2026 sur six modèles et deux jets — c'est ce banc qui a décidé de la méthode.
 *  **Aucune ne refuse** : elles s'affichent, se comparent d'une case à l'autre,
 *  et laissent l'auteur juger. */
export type MesuresCalque = {
  /** Ce qui reste du corps de départ, au meilleur recalage. À 0,99, le modèle a
   *  gardé la forme. */
  silhouette: number
  /** La part du corps dont la couleur a changé, **hors de l'empreinte de la
   *  pièce**. C'est la colonne qui décide : un casque n'a aucune raison de
   *  changer les bottes. */
  repeint: number
  /** Ce qui est apparu, en part du corps — l'empreinte de la pièce. */
  ajout: number
  /** La taille du sujet au retour, rapportée à celle qui est partie. 1,00 : il
   *  n'a pas bougé. 0,62 : le modèle a dézoomé pour faire tenir la pièce, et il
   *  n'y a plus de différence à calculer. */
  echelle: number
  /** La part de la différence qui tient dans sa plus grosse tache. Proche de
   *  1 : un objet. Proche de 0 : une poussière semée sur tout le corps,
   *  c'est-à-dire un repeint déguisé. */
  compacite: number
  /** **Le nom de la mesure la plus défavorable** (C4, US-152) — celle qui
   *  décide de la place de ce calque dans ce qui reste à regarder.
   *
   *  Déduit par le serveur, jamais relu du disque : un second barème écrit à
   *  l'écran aurait donné deux listes triées différemment sur les mêmes cinq
   *  nombres. */
  pire: string
  /** À quel point elle est défavorable — 0 va bien, 1 va mal. Quatre mesures y
   *  entrent, `ajout` n'en est pas : elle n'a pas de bon côté connu. */
  gravite: number
}

// ── Le vestiaire — les emplacements et les pièces ───────────────────────────
//
// C3. Le second axe de la matrice, porté par le **projet** comme le plan de
// poses, et pour la même raison : ce sont des listes de production, elles
// n'imposent rien à une image qui rentre.

/** Un endroit du corps, et son rang dans l'ordre où l'auteur les pense.
 *  **Ordonné, jamais trié** : la tête vient avant les jambes parce que c'est
 *  ainsi qu'on habille quelqu'un.
 *
 *  **`Corps` dans le nom parce qu'un mot sert déjà deux fois** : `Emplacement`,
 *  plus haut, est la place d'une variation dans un appel. Le serveur les tient
 *  dans deux modules et n'a pas eu à trancher ; ici tout vit dans un fichier, et
 *  la précision est du côté du nouveau — c'est lui qui doit s'expliquer. */
export type EmplacementCorps = { identifiant: string; nom: string; rang: number }

/** Ce qui se pose sur un emplacement, décrit **une seule fois** (US-137).
 *
 *  `portee` est **déclarée par l'auteur, jamais devinée** (US-139) : elle décide
 *  si l'atelier peut fabriquer un calque ou seulement des corps habillés.
 *  Défaut « contenue » — c'est celle qui marche, mesurée sur cinq pièces sur six
 *  le 28 août 2026. */
export type Piece = {
  identifiant: string
  nom: string
  description: string
  /** L'identifiant de son emplacement, ou le vide — une pièce qu'on vient de
   *  nommer et qu'on n'a pas encore rangée. */
  emplacement: string
  portee: Portee
  concept_arts: string[]
}

export type Portee = "contenue" | "agrandit"

// ── Le plan de poses et les personnages ─────────────────────────────────────
//
// C1. Un jeu porte **une** liste d'attitudes — repos, marche, mort — et chacun
// de ses personnages coche celles qu'il tient. Ce ne sont pas des images : ce
// sont les cases à remplir, et c'est ce qui permet de voir ce qui manque sans
// tenir la liste dans sa tête.

/** Ce que chaque type d'objet réclame, type par type (E9). */
export type PosesDesTypes = {
  types: {
    nom: string
    /** `écrite` — l'auteur a posé la sienne. `connue` — c'est celle que le
     *  produit propose. `projet` — ce type suit le plan du jeu. */
    origine: "écrite" | "connue" | "projet"
    poses: Pose[]
    /** Ce qu'un « revenir à la liste proposée » remettrait. Envoyé à côté pour
     *  que l'écran n'ait pas à le deviner. */
    connues: Pose[]
  }[]
  /** Le plan du jeu — ce que suivent les types qui n'ont rien écrit. */
  plan: Pose[]
}

export type Pose = {
  identifiant: string
  nom: string
  /** Combien d'images cette pose demande — une pour la plupart, quatre ou huit
   *  pour un cycle. C'est l'auteur qui le décide, jamais le produit. */
  images: number
}

/** Une case de la matrice : ce qu'une attitude demande, et ce qui la remplit.
 *
 *  **Rien de tout ceci n'est enregistré côté serveur** : une case est pleine
 *  parce qu'une image la porte (`asset.personnage` et `asset.pose`), et non
 *  parce qu'une liste de cases pleines serait tenue quelque part. Supprimer une
 *  image vide sa case toute seule.
 *
 *  Elle porte l'**asset entier**, pas un résumé : l'adresse d'une image d'asset
 *  n'a qu'un seul endroit où elle s'écrit dans tout le produit, et un objet à
 *  moitié aurait forcé un second calcul à tenir d'accord avec le premier. */
export type Case = {
  pose: string
  /** Combien d'images cette attitude demande. La case est faite quand elle en a
   *  autant — le compte se lit, il ne refuse rien. */
  demandees: number
  /** Les **corps** de cette attitude : les images qui ne portent aucune pièce.
   *  Un calque en porte une, et il est rangé plus bas — sans ce partage, un
   *  casque posé sur six poses ferait paraître six corps de plus. */
  images: Asset[]
  /** **Le second axe** (C3, US-140), pièce par pièce. Calques ou corps
   *  habillés : c'est `recette.difference` qui les distingue, jamais un drapeau
   *  de plus. Vide pour l'immense majorité des cases. */
  calques: Record<string, Asset[]>
  /** **Le corps que cette attitude enverrait en planche d'équipement**, ou rien
   *  — et c'est ce « rien » qui la rend visiblement inéligible (US-141). Le
   *  favori d'abord, sinon la plus récente : la règle est calculée par le
   *  serveur, celui-là même qui composera la planche, pour que l'écran montre
   *  exactement ce qui partira. */
  corps: string | null
  /** **D'où vient cette pose** (E9) : `type` quand c'est le type d'objet qui la
   *  réclame, `ici` quand cette chose-là se l'est ajoutée. La fiche l'écrit,
   *  pour qu'on sache toujours qui la reproposera demain. */
  origine: "type" | "ici"
}

export type Personnage = {
  identifiant: string
  projet: string
  nom: string
  /** Elle part avec chaque génération de pose, et ne se retape jamais (US-115). */
  description: string
  /** Ce que le **fichier** garde : les poses du plan que ce personnage ne tient
   *  pas. L'écran, lui, coche les tenues — c'est le complément qui est rangé,
   *  pour qu'une pose ajoutée au plan paraisse chez tout le monde sans que rien
   *  ne soit réécrit, et donc sans qu'aucun personnage soit annoncé.
   *
   *  Les tenues se déduisent d'ici et du plan (`posesTenues`), et **le serveur
   *  ne les envoie pas** : une liste envoyée avec le personnage serait périmée
   *  à l'ajout de pose suivant. */
  ecartees: string[]
  /** Des cartes du tableau d'inspiration, désignées (US-124). Elles restent où
   *  elles sont — aucune copie, aucun second rangement. */
  concept_arts: string[]
  /** Ce qui ne doit plus partir avec ce personnage-là (US-126) — la portée du
   *  milieu, entre la génération et le projet. */
  references_ecartees: string[]
  cree_le: number
  /** Ses cases, dans l'ordre du plan et **calculées par le serveur**. L'écran ne
   *  saurait pas les calculer : il ne tient qu'une page de la grille, filtrée
   *  sur autre chose, et compterait faux dès la première image hors de vue. */
  cases: Case[]
  /** **Ce que cette chose-là réclame** (E9) — la liste de son type, puis ce
   *  qu'elle s'est ajoutée. Ce n'est plus le plan du jeu : un coffre réclame
   *  *fermé, ouvert, vidé* et une tuile ne réclame rien. Le serveur la calcule,
   *  parce que la règle qui la compose a quatre branches et qu'un second calcul
   *  à l'écran aurait divergé au premier type qui écrit la sienne. */
  plan: Pose[]
  /** Le type d'objet de cette chose. Vide, elle suit le plan du jeu — c'est
   *  l'état d'avant E9, et c'est ce qui reprend les jeux existants sans perte. */
  type: string
  /** L'ambiance qu'elle désigne, ou rien — et rien veut dire « le jeu ». */
  ambiance: string
  /** Ce qu'elle prend à cette ambiance. */
  prend: string
  /** Ce qu'elle s'est ajouté pour elle seule. Elles viennent après celles du
   *  type, jamais mêlées. */
  ajoutees: Pose[]
}

/** Le plan et les personnages d'un projet, **en un seul aller-retour** : une
 *  colonne de cases n'existe que par le plan qui la nomme. */
export type Production = {
  projet: string
  plan: Pose[]
  personnages: Personnage[]
  /** **Le vestiaire, dans le même aller-retour** (C3) — et pour la raison
   *  exacte : les emplacements et les pièces sont l'autre axe de la même
   *  matrice, et une colonne n'existe que par la pièce qui la nomme. */
  emplacements: EmplacementCorps[]
  pieces: Piece[]
}

/** Une fiche du descriptif d'une sortie (C5) — ce qu'un fichier posé dans le
 *  dossier du jeu **est**. L'écran n'en lit qu'une poignée de champs ; le
 *  descriptif écrit à côté des images, lui, les porte tous, parce que c'est lui
 *  qu'on rouvrira dans six mois sans l'atelier sous la main. */
export type FichierSorti = {
  /** Le chemin **absolu** du fichier posé. C'est ce qu'on colle dans un moteur
   *  de jeu, et c'est le dépôt qui le rend — jamais l'écran qui le recompose. */
  chemin: string
  fichier: string
  /** **Trois rôles, et le troisième est celui qu'on oublie** : `corps` est un
   *  corps, `calque` s'empile sur celui de sa pose, et `corps_habille` est un
   *  corps entier portant déjà la pièce — il **remplace** le corps au lieu de
   *  s'empiler (US-148). C'est la recette qui tranche, jamais un drapeau. */
  role: "corps" | "calque" | "corps_habille"
  pose: { identifiant: string; nom: string }
  piece: { identifiant: string; nom: string } | null
}

/** Ce qu'une sortie vient de poser dans le dossier du jeu (US-154). */
export type Sortie = {
  dossier: string
  fichiers: FichierSorti[]
  /** Le descriptif, posé **dans le dossier** à côté des images. */
  descriptif: string
  compte: number
}

/** Ce que les six gestes du vestiaire rendent : l'objet touché, **et le
 *  vestiaire entier avec**. Même forme que l'annonce du flux, pour que l'écran
 *  fonde ce qui lui arrive par les deux chemins avec le même code. */
export type Vestiaire = {
  projet: string
  emplacements: EmplacementCorps[]
  pieces: Piece[]
}

// ── Le tableau d'inspiration et l'univers ───────────────────────────────────
//
// La deuxième famille d'images du produit. Une carte ne s'exporte jamais, ne
// compte pas dans la bibliothèque, n'a ni recette ni rendu : elle rassemble.

export type Famille = "personnages" | "objets" | "decors" | "interface" | "tous"

export const FAMILLES: readonly Famille[] = [
  "personnages",
  "objets",
  "decors",
  "interface",
  "tous",
]

/** Ce que l'auteur lit. La famille voyage sans accent — elle traverse du JSON
 *  et des chemins — mais ce qui s'affiche est français, comme tout l'écran. */
export const NOM_FAMILLE: Record<Famille, string> = {
  personnages: "personnages",
  objets: "objets",
  decors: "décors",
  interface: "interface",
  tous: "tous",
}

/** Les dix, et il n'y en a pas une onzième — `docs/DESIGN.md` § Les teintes
 *  d'îlot. Le vide **est** une valeur : un îlot sans teinte porte celle du
 *  châssis, ce qui est exactement ce que ce document dit qu'il est.
 *
 *  **Six jusqu'au 28 août 2026**, dix depuis : les quatre neuves subdivisent les
 *  arcs déjà occupés, les deux arcs des sémantiques restant fermés. L'ordre est
 *  celui de la roue, pas celui de l'alphabet. */
export type Teinte =
  | ""
  | "ardoise"
  | "pervenche"
  | "iris"
  | "lavande"
  | "prune"
  | "mauve"
  | "bruyere"
  | "mousse"
  | "lichen"
  | "paille"

export const TEINTES = [
  "ardoise",
  "pervenche",
  "iris",
  "lavande",
  "prune",
  "mauve",
  "bruyere",
  "mousse",
  "lichen",
  "paille",
] as const satisfies readonly Exclude<Teinte, "">[]

/** Ce que chaque teinte vaut — **par son token, jamais par sa valeur**.
 *
 *  `src/index.css` porte tous les tokens de `docs/DESIGN.md`, et aucune couleur
 *  n'est écrite ailleurs : ce tableau ne contient donc que des renvois. Écrire
 *  `#7086A0` ici en aurait fait un second endroit où la palette du châssis vit,
 *  et le jour où le document déplace une teinte d'un point, l'un des deux
 *  l'aurait suivie sans l'autre.
 *
 *  Un tableau plutôt que des classes Tailwind parce que la teinte arrive du
 *  serveur : `bg-ilot-${teinte}` ne se compile pas — Tailwind lit des classes
 *  écrites en toutes lettres, et une classe composée à l'exécution n'existe
 *  dans aucune feuille. */
export const COULEUR_TEINTE: Record<Exclude<Teinte, "">, string> = {
  ardoise: "var(--color-ilot-ardoise)",
  pervenche: "var(--color-ilot-pervenche)",
  iris: "var(--color-ilot-iris)",
  lavande: "var(--color-ilot-lavande)",
  prune: "var(--color-ilot-prune)",
  mauve: "var(--color-ilot-mauve)",
  bruyere: "var(--color-ilot-bruyere)",
  mousse: "var(--color-ilot-mousse)",
  lichen: "var(--color-ilot-lichen)",
  paille: "var(--color-ilot-paille)",
}

/** Ce que l'auteur lit d'une teinte. Sans accent dans le JSON, accentué à
 *  l'écran — la règle du produit depuis les familles. */
export const NOM_TEINTE: Record<Exclude<Teinte, "">, string> = {
  ardoise: "ardoise",
  pervenche: "pervenche",
  iris: "iris",
  lavande: "lavande",
  prune: "prune",
  mauve: "mauve",
  bruyere: "bruyère",
  mousse: "mousse",
  lichen: "lichen",
  paille: "paille",
}

/** Une extrémité de lien.
 *
 *  **Deux espaces de noms, donc deux champs** : une carte se nomme par son
 *  identifiant, un îlot par son nom de groupe — parce qu'un îlot *est* le
 *  groupe et n'a pas d'identité propre. Aplatis dans un seul champ, le lien vers
 *  un îlot qui s'appellerait comme une carte n'aurait plus dit lequel des deux
 *  il désigne. */
export type Bout = { genre: "carte" | "ilot"; valeur: string }

/** Un trait entre deux objets de la toile — **le seul objet neuf du modèle
 *  depuis T4**.
 *
 *  Il naît muet : ni mot, ni pointe. Un trait nu dit déjà « ceci a rapport avec
 *  cela », et c'est le cas courant — *le défaut est muet, l'exception
 *  s'exprime*. Il ne survit pas à ses extrémités, et c'est le serveur qui le
 *  tient : un trait vers rien ne représente rien. */
export type Lien = {
  identifiant: string
  projet: string
  de: Bout
  vers: Bout
  mot: string
  pointe: boolean
  cree_le: number
}

/** ── Le côté Ambiances et couleurs (E11) ───────────────────────────────────
 *
 *  **Deux objets, et ce qui les distingue.** Une palette est une liste de
 *  couleurs qui porte un nom, tirée d'un paquet d'images : elle ne dit rien du
 *  style en mots. Une ambiance est un lot de style tout prêt, réutilisable sur
 *  plusieurs choses du jeu, et elle porte trois choses et trois seulement —
 *  une palette, des images de référence, trois cases de texte.
 *
 *  **Le projet est l'ambiance générale du jeu** : même objet en plus grand. Il
 *  n'y a donc pas deux notions à apprendre. */

/** Ce dans quoi les couleurs d'une palette se lisent. */
export type SourceDePalette = {
  /** `images` — un paquet du tableau d'inspiration. `officiels` — les images
   *  officielles du jeu, la source de la palette du projet depuis toujours.
   *  `palette` — une autre palette, ce qui permet d'assembler à partir de ce
   *  qui existe déjà. */
  genre: "images" | "officiels" | "palette"
  /** Le nom du paquet, ou l'identifiant de l'autre palette. Vide pour les
   *  officiels : ils sont déjà désignés par leur propre marque. */
  reference: string
}

/** Un geste de la main sur la palette rendue, **rangé et non fondu**.
 *
 *  Chacun s'annule seul, chacun se voit, et le tout se rejoue si une source
 *  change — c'est ce qui préserve la propagation d'une image promue jusqu'en
 *  bas, même à travers une ambiance retouchée. */
export type RetoucheDePalette = {
  geste: "retirer" | "ajouter" | "remplacer"
  couleur: string
  remplacement: string
}

/** Une couleur de la palette rendue, **et d'où elle vient**.
 *
 *  C'est la seule façon de comprendre ce qu'on regarde : sans ces marques, on
 *  ne saurait pas si un gris vient du jeu, donc si le changer ici serait une
 *  exception ou une redite. Une couleur retirée reste dans la liste, marquée —
 *  **montrée barrée, jamais cachée**. */
export type Pastille = {
  couleur: string
  venue: "jeu" | "ambiance" | "main"
  /** `retirer` quand une retouche l'a écartée, vide sinon. */
  retiree: string
}

export type PaletteNommee = {
  identifiant: string
  nom: string
  sources: SourceDePalette[]
  couleurs: number
  /** Combien des couleurs viennent de la **première** source. Le reste vient
   *  des suivantes, réduit puis attiré. */
  du_jeu: number
  /** De combien les autres se rapprochent, de 0 à 1. */
  attraction: number
  retouches: RetoucheDePalette[]
  rendue: string[]
  pastilles: Pastille[]
  empreinte: string
  /** **Ce que ce curseur ne ferait pas**, dit en clair plutôt que laissé à
   *  essayer : à « tout du jeu », il ne reste aucune couleur d'ambiance à tirer,
   *  et les cinq valeurs rendent le même fichier. Mesuré au banc d'essai avant
   *  que la tranche soit écrite. */
  attraction_inerte: boolean
  /** Les sources qui ne rendent plus rien — un paquet du tableau rangé, une
   *  palette supprimée. La palette **garde ses couleurs** et le dit. */
  sources_perdues: string[]
  emplois: number
  cree_le: number
}

export type AmbianceDuJeu = {
  identifiant: string
  nom: string
  palette: string
  references: string[]
  monde: string
  eclairage: string
  trait: string
  /** Qui s'en sert, **et ce que chacun lui prend**. Lu des choses du jeu et de
   *  nulle part ailleurs. */
  emplois: { identifiant: string; nom: string; prend: string }[]
  cree_le: number
}

/** Les deux listes, **en un seul aller-retour** : elles n'existent pas l'une
 *  sans l'autre. */
export type CoteAmbiances = {
  projet: string
  palettes: PaletteNommee[]
  ambiances: AmbianceDuJeu[]
  /** La palette du jeu — c'en est une comme les autres. */
  du_jeu: string[]
}

/** La palette posée sur de vraies images du jeu, côte à côte. */
export type ApercuDePalette = {
  palette: string
  couleurs: string[]
  images: { asset: string; nom: string; du_jeu: string; de_la_palette: string }[]
  /** Les couleurs qui servent vraiment sur ces images-là. Le produit constate ;
   *  il ne conseille pas de retirer les autres. */
  employees: string[]
}

/** Ce qu'une chose du jeu prend à l'ambiance qu'elle désigne. */
export const CE_QU_ON_PREND = ["tout", "couleurs", "sans-images"] as const
export const NOM_DE_CE_QU_ON_PREND: Record<string, string> = {
  tout: "tout",
  couleurs: "les couleurs seulement",
  "sans-images": "tout sauf les images",
}

export type Carte = {
  identifiant: string
  projet: string
  genre: "image" | "texte"
  texte: string
  /** `attente` tant que l'image d'une adresse n'est pas arrivée, `echouee` si
   *  elle n'arrive pas — et la carte garde alors son adresse et sa raison. */
  statut: "attente" | "prete" | "echouee"
  raison: string | null
  source: string
  cree_le: number
  groupe: string
  note: string
  taille: 1 | 2 | 4
  /** Sa place sur la toile, ou rien — et rien veut dire « pas encore posée ».
   *  Elle ne se confond pas avec `groupe` : l'un dit *où*, l'autre *avec qui*. */
  position: [number, number] | null
  /** La largeur qu'elle occupe sur le plan. **Ce n'est pas `taille`** : la
   *  taille est le cran que lit la grille, celle-ci est une place occupée sur
   *  une toile, et aucune des deux ne ment sur l'autre. */
  largeur_libre: number | null
  /** Sa teinte, **si c'est une note**. Une carte image n'en porte jamais :
   *  colorier chaque carte reconstruirait un second rangement, invisible dans la
   *  grille et concurrent du groupe. Le refus vient du serveur. */
  teinte: Teinte
  officiel: boolean
  famille: Famille
  empreinte: string
  largeur: number
  hauteur: number
  type_media: string
  octets: number
  /** Y a-t-il quelque chose à afficher à la place de l'attente ? */
  montrable: boolean
  /** Une image promue et arrivée. Un texte n'en est jamais un. */
  artwork: boolean
  /** Ni classée, ni posée — donc elle attend. **La règle de l'écran Toile tient
   *  dans ce champ**, et elle est calculée par le serveur pour qu'il n'y ait
   *  qu'un endroit où elle s'écrive : la toile montre ce qui est classé, la
   *  réserve contient ce qui reste à classer. */
  en_reserve: boolean
}

export type Champ = { nom: string; texte: string; actif: boolean }

/** Ce que l'auteur lit d'un champ de bible. La clé voyage sans accent.
 *
 *  **Sept depuis R2** (US-161, US-162). `rendu` et `vue` sont exactement les
 *  deux décisions d'apparence que l'auteur reposait dans chaque prompt sans
 *  avoir où les écrire ; la liste reste close, c'est le dosage qui fait sa
 *  valeur. L'ordre est celui du domaine — il décide de l'écran comme du
 *  prompt —, et il n'est pas recopié ici : cet objet ne porte que les mots
 *  français, la bible arrive déjà rangée. */
export const NOM_CHAMP: Record<string, string> = {
  monde: "monde",
  epoque: "époque",
  rendu: "technique de rendu",
  trait: "trait",
  eclairage: "éclairage",
  vue: "vue et cadrage",
  technique: "contraintes techniques",
}

/** Une nature de sujet : la part de case qu'elle occupe, et sa famille.
 *
 *  **Un seul contrôle au générateur.** Dire « c'est un objet tenu en main »,
 *  c'est du même coup dire quelle part de case il occupe et quels artworks
 *  partent en référence. Deux taxonomies se paieraient deux fois par
 *  génération. */
export type Echelle = {
  nom: string
  famille: Famille
  occupation: number
  /** Un décor n'a pas de contour : l'enfermer dans une case carrée lui
   *  ajouterait des bandes que personne n'a demandées. */
  silhouette: boolean
}

/** Pas de taille de pixel imposée : ce que le modèle a rendu entre tel quel
 *  (US-163). **Une valeur, pas un trou** — un jeu qui n'est pas en pixel art
 *  n'a rien à gagner à la remise sur grille, et c'était la seule étape que le
 *  projet imposait sans échappatoire. */
export const AUCUNE_CIBLE = 0

export type Univers = {
  bible: Champ[]
  bareme: Echelle[]
  /** Le côté de case imposé à ce qui rentre — ou `AUCUNE_CIBLE`. */
  cible_px: number
  /** **La vue du jeu** (E8) : un choix unique qui remplit le réglage *et* la
   *  phrase de la case `vue`. Vide est une valeur — un jeu qui ne dit pas d'où
   *  il regarde ne contraint rien. */
  vue: string
  couleurs: number
  /** Déduite par calcul des artworks officiels, jamais saisie (US-54). */
  palette: string[]
  palette_empreinte: string
  modeles: Partial<Record<Famille, string>>
  /** **Les deux modèles d'appel** (C2). Ils ne sont pas dans `modeles`, qui est
   *  indexé par famille de *sujet* : ceux-ci répondent à une autre question —
   *  quelle sorte d'appel on fait. Produire une planche et éditer un corps ne se
   *  jouent pas chez le même modèle, mesuré le 28 août. Vides, la famille du
   *  sujet puis le catalogue reprennent la main. */
  modele_planche: string
  modele_edition: string
  /** Ni bible qui parle, ni palette. Un état normal, pas une configuration
   *  manquante : « un univers vide ne contraint rien » (US-57). */
  vide: boolean
}

export const UNIVERS_VIDE: Univers = {
  bible: [],
  bareme: [],
  cible_px: 64,
  vue: "",
  couleurs: 24,
  palette: [],
  palette_empreinte: "",
  modeles: {},
  modele_planche: "",
  modele_edition: "",
  vide: true,
}

/** Combien d'images partiront, et d'où elles viennent (US-52).
 *
 *  **Calculé par le serveur.** L'écran tient les réinjections que l'auteur a
 *  posées, mais pas les artworks — c'est l'application qui les choisit — ni le
 *  dédoublonnage entre les deux. Deux comptes calculés à deux endroits
 *  finiraient par se contredire, et celui qui compte est celui qui part. */
/** Une image qui partira — ou qui ne partira pas, et qui dit alors ce qui
 *  l'écarte (US-126, US-127).
 *
 *  **La ligne écartée reste dans la liste**, et c'est la décision : une ligne
 *  qui disparaîtrait ne laisserait aucun moyen de la remettre. */
export type LigneReference = {
  asset: string
  role: Role
  /** `asset` — une image de la bibliothèque ; `carte` — une image du tableau. */
  origine: "asset" | "carte"
  /** D'où elle vient, **nommée par le serveur** : « comprendre pourquoi elle
   *  part avant de décider de la retirer ». L'écran affiche la phrase qu'il
   *  reçoit, il ne la reconstitue pas. */
  provenance: "artwork officiel" | "concept art" | "réinjection"
  /** La portée **durable** qui l'écarte, ou rien. Celle de la génération ne
   *  s'écrit nulle part : elle vit dans l'onglet et part avec l'appel. */
  ecartee_par: "projet" | "personnage" | null
}

export type CompteReferences = {
  /** Ce qui part **vraiment** — donc ce qui décide du grisé du modèle. Les
   *  écartées n'y sont pas comptées. */
  total: number
  manuelles: number
  artworks: number
  concepts: number
  famille: Famille | null
  /** **Le gabarit du lot, quand il y en a un** (C2). Une image qui part
   *  vraiment : elle occupe une place dans le plafond du modèle et elle coûte
   *  chez ceux qui facturent au token. Elle n'est **pas** dans `lignes` —
   *  celle-ci est faite d'images qu'on peut décocher, et décocher le gabarit
   *  reviendrait à demander une planche sans dire à quoi elle ressemble. */
  gabarit: number
  lignes: LigneReference[]
}

export type PorteeDurable = "personnage" | "projet"

// ── La bibliothèque ─────────────────────────────────────────────────────────

export type Projet = {
  identifiant: string
  nom: string
  cree_le: number
  assets: number
  total_usd: number
}

export type Collection = {
  identifiant: string
  nom: string
  projet: string | null
  cree_le: number
  assets: number
}

/** L'arbre, compté et totalisé **par le serveur**. Une somme faite ici, sur les
 *  deux cents assets que la grille a en mémoire, dirait un chiffre faux dès que
 *  la bibliothèque dépasse ce qu'elle sert. */
export type Bibliotheque = {
  courant: string | null
  projets: Projet[]
  collections: Collection[]
  sans_projet: { assets: number; total_usd: number }
  total_usd: number
}

export type Rate = {
  rang: number
  statut: Statut
  raison: string | null
  cout_usd: number
}

export type Appel = {
  identifiant: string
  modele: string
  prompt: string
  cree_le: number
  cout_usd: number
  statut: Statut
  reussies: number
  rates: Rate[]
}

/** Le journal d'un projet : ses appels, **ratés compris** (US-24). C'est ici que
 *  vit ce qui n'entre jamais dans la grille. */
export type Journal = {
  projet: string | null
  total_usd: number
  rates: number
  cout_rate_usd: number
  appels: Appel[]
}

// ── Les dépenses ────────────────────────────────────────────────────────────
//
// « Il faut pouvoir expliquer une facture. » Le journal ci-dessus tenait cette
// promesse **pour un cas sur trois** — il ne montrait que les appels ratés, et
// mesuré, ce sont ceux qui n'ont jamais rien coûté. L'écran des dépenses (E18)
// les montre tous, avec ce que chacun a coûté et ce qu'il a donné.

/** Une ligne de l'écran des dépenses : **un appel, jamais une image**. C'est
 *  l'appel qui est facturé — une demande de quatre variations est une ligne à
 *  quatre images, parce que c'est ainsi qu'elle a été payée. */
export type Depense = {
  identifiant: string
  modele: string
  /** Le texte envoyé. Il n'est **pas** dans la ligne : il fait 1 690 signes et
   *  il est presque le même à chaque appel — le style y pèse 53 %, le sujet 2 %.
   *  Il vit dans la colonne de droite, pour l'appel qu'on a choisi. */
  prompt: string
  cree_le: number
  cout_usd: number
  projet: string | null
  projet_nom: string | null
  provenance: string
  /** Le sujet de la ligne : la chose du jeu visée, ou rien. */
  personnage: string | null
  pose: string | null
  /** Ce que l'appel a **demandé**, pas ce qu'il a rendu. */
  variations: number
  /** Les trois issues, comptées en emplacements : un appel à quatre variations
   *  peut en garder deux, en perdre une et s'en faire refuser une. */
  garde: number
  perdu: number
  refuse: number
  raison: string | null
  /** Ce qui est resté. La liste n'en montre aucune vignette — une par ligne
   *  ferait de cet écran une seconde galerie. */
  assets: string[]
  /** La rafale à laquelle il appartient, ou rien. */
  rafale: string | null
}

/** Des appels consécutifs sur un même sujet. « Six relances en trente-deux
 *  minutes ont coûté le quart de tout l'argent jamais dépensé, et rien ne le
 *  disait. » */
export type Rafale = {
  identifiant: string
  appels: number
  cout_usd: number
  debut: number
  fin: number
  prompt: string
}

export type Depenses = {
  total_usd: number
  /** Ce qui a été dépensé sans qu'aucun jeu soit ouvert — les onze pour cent
   *  qu'aucun écran ne montrait. */
  sans_projet_usd: number
  par_projet: { projet: string; nom: string; cout_usd: number }[]
  par_modele: { modele: string; cout_usd: number; appels: number }[]
  appels: Depense[]
  rafales: Rafale[]
}

// ── Ce qu'une table sait de l'image ─────────────────────────────────────────

/** Une tache opaque de l'image détourée. `boite` est en pixels de cette
 *  image-là, coins inclus — la convention de rectangle du produit. */
export type Tache = {
  aire: number
  boite: [number, number, number, number]
  couleur: string
}

/** Trois mesures, et aucune n'est un réglage : elles décrivent ce que l'image
 *  contient, et c'est l'auteur qui décide. */
export type TachesDeLAsset = {
  /** De la plus petite à la plus grande — l'ordre du seuil. */
  taches: Tache[]
  /** Combien la liste en a coupé. **Dit, jamais tu en silence.** */
  coupees: number
  /** Le fond que le sujet enferme, de la plus grande à la plus petite. */
  poches: Tache[]
  /** Les valeurs d'occupation où l'image change vraiment. */
  crans_occupation: number[]
  /** Aucun pixel transparent — donc **aucun bord de sujet à tracer**. C'est le
   *  seul cas où la table des contours est indisponible. */
  opaque: boolean
  /** Ce que chaque couche de la septième place change (E5) — des **pixels
   *  touchés** sur l'opacité, des **pixels posés** sur un calque de dessin.
   *  `null` quand la place est vide : l'écran se tait alors, plutôt que
   *  d'écrire des zéros pour une table qu'on n'a pas ouverte. */
  main: { opacite: number; calques: number[] } | null
}

export type Filiation = {
  parent: Asset | null
  parent_identifiant: string | null
  parent_supprime: boolean
  enfants: Asset[]
}

// ── La découpe d'une planche ────────────────────────────────────────────────

/** Un rectangle de la planche, **inclusif aux deux bouts** et exprimé dans les
 *  pixels de l'image **brute** — jamais du rendu, qui peut être un sprite de
 *  64 px là où la planche en fait 1024. Une seule convention de rectangle dans
 *  tout le produit, celle du serveur. */
export type Boite = [number, number, number, number]

export type ModeDecoupe = "auto" | "grille"

/** Ce que le serveur propose de découper — rien n'est créé tant qu'on ne l'a pas
 *  demandé. `raison` est le grisé du produit : une détection qui ne trouve rien
 *  dit pourquoi, elle ne se tait pas. */
export type Proposition = {
  asset: string
  label: string
  largeur: number
  hauteur: number
  mode: ModeDecoupe
  boites: Boite[]
  raison: string | null
}

export type Filtre = {
  collection: string | null
  favoris: boolean
  recherche: string
}

export const FILTRE_VIDE: Filtre = { collection: null, favoris: false, recherche: "" }

export const filtreActif = (filtre: Filtre) =>
  filtre.collection !== null || filtre.favoris || filtre.recherche.trim() !== ""

/** Ce qui partira chez le modèle, **bloc par bloc et dans l'ordre d'envoi**
 *  (US-158).
 *
 *  Trois origines, et une quatrième qui les remplace toutes : `repris`, quand
 *  l'auteur a pris la main sur l'ensemble du texte. Le découper alors aurait
 *  été une reconstitution, pas une lecture. */
export type PartiePrompt = {
  origine: "bible" | "sujet" | "planche" | "repris"
  texte: string
}

export type ApercuPrompt = {
  /** Les parties jointes — **exactement** ce que le modèle lira. */
  texte: string
  parties: PartiePrompt[]
}

/** Ce que le projet impose à une image donnée, aujourd'hui (US-164).
 *
 *  `impose` est `null` quand la génération n'est plus sur le disque : le
 *  produit dit qu'il ne sait pas plutôt que de répondre « rien d'imposé », qui
 *  est une réponse différente et fausse. */
export type Impose = {
  impose: Recette | null
  /** Ce que l'auteur avait dit fabriquer — c'est elle qui décide de
   *  l'occupation, et « 40 % » ne s'explique qu'avec « objet tenu » à côté. */
  echelle: string
}

/** Ce que le post-traitement peut faire **sur cette machine**, et ce qu'il ne
 *  peut pas. Chaque raison est écrite par le serveur : l'interface l'affiche,
 *  elle ne rejoue jamais la règle de son côté. */
export type EtatTraitement = {
  moteurs: { nom: Passe["moteur"]; raison: string | null }[]
  quantification: { raison: string | null }
  recettes: string[]
}

export type EtatCle = {
  presente: boolean
  origine: string
  apercu: string
  raison: string | null
}

/** Le cadre de l'agent — ce que l'auteur lui a laissé faire (US-91).
 *
 *  Chaque garde-fou porte **son interrupteur et sa valeur séparément** : les
 *  désactiver ne perd pas le réglage qu'on y avait posé, sans quoi rallumer
 *  demanderait de le retrouver. */
export type GardeFous = {
  plafond_actif: boolean
  plafond: number
  modele_actif: boolean
  modele: string
  options: Record<string, string>
  dossier_jeu: string
}

/** Ce que l'agent a consommé **depuis l'ouverture de l'atelier** (US-90).
 *
 *  Calculé par le serveur, jamais ici : le refus opposé à l'agent et le chiffre
 *  lu par l'auteur doivent être le même calcul, sinon ils finiront par se
 *  contredire au moment précis où l'on cherche à comprendre. */
export type ConsommationAgent = {
  generations: number
  depense_usd: number
  plafond_actif: boolean
  plafond: number
  /** Ce qui reste avant le plafond, ou `null` quand il est éteint. */
  reste: number | null
  depuis: number
}

export type EtatAgent = {
  garde_fous: GardeFous
  consommation: ConsommationAgent
}

export type EtatCatalogue = {
  recu_le: number
  repli: boolean
  raison: string | null
  /** Par quoi commencer une séance. Décidé par le serveur — le banc du 26 août
   *  a tranché, et depuis T4 c'est l'univers du projet qui le porte, famille
   *  par famille (US-58). Sans réglage pour cette famille-là, le défaut du
   *  catalogue reprend la main. */
  defaut: { modele: string | null; options: Record<string, string> }
  /** Ce qui partira vraiment, artworks compris et dédoublonné (US-52). */
  references: CompteReferences
  /** Ce qu'une image a coûté chez chaque modèle, en médiane des derniers appels
   *  réussis **sur cette machine** (US-121). Une mesure, jamais un tarif : le
   *  produit ne porte aucun prix de catalogue, et un modèle jamais appelé n'y
   *  figure pas — il dit qu'il ne sait pas plutôt que d'inventer. */
  couts: Record<string, number>
  modeles: Modele[]
}

export type EtatCatalogueCourt = {
  modeles: number
  recu_le: number
  repli: boolean
  raison: string | null
}

export type Etat = {
  cle: EtatCle
  catalogue: EtatCatalogueCourt
  couts: { total_usd: number }
  traitement: EtatTraitement
  bibliotheque: Bibliotheque
  /** L'univers du projet ouvert — bible, barème, palette, défauts. Servi à
   *  l'ouverture pour que l'écran dessine « ce qui part » sans un second appel. */
  univers: Univers
  /** Le cadre de l'agent et ce qu'il a consommé. Servi à l'ouverture et
   *  republié sur l'événement `agent` : la barre d'état le montre, l'écran
   *  Réglages le règle, et ni l'un ni l'autre ne le recalcule. */
  agent: EtatAgent
  /** Combien de temps dure l'annulation d'une suppression. Le serveur le dit,
   *  l'écran le décompte : deux délais écrits à deux endroits finiraient par se
   *  contredire, et c'est le serveur qui refuse. */
  annulation_s: number
  /** Présents sur le premier message du flux, absents des suivants.
   *
   *  `generations` ne porte que **le chantier** — ce qui tourne encore ou qu'un
   *  redémarrage a coupé. Ce qui a réussi est dans `assets`, ce qui a échoué est
   *  au journal du projet. `assets` est la grille du projet ouvert, servie
   *  d'avance pour qu'un onglet qui s'ouvre la dessine sans un second appel. */
  generations?: Generation[]
  assets?: Asset[]
}

export class Refus extends Error {
  code: string
  ou_aller: string | null
  constructor(raison: string, code = "erreur", ou_aller: string | null = null) {
    super(raison)
    this.code = code
    this.ou_aller = ou_aller
  }
}

async function appeler<T>(chemin: string, init?: RequestInit): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(`/api${chemin}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    })
  } catch {
    // L'atelier tourne en local : s'il ne répond pas, il est arrêté.
    throw new Refus("l'atelier ne répond pas", "atelier_arrete")
  }
  if (!reponse.ok) {
    const charge = await reponse.json().catch(() => null)
    throw new Refus(
      charge?.raison ?? `l'atelier a répondu ${reponse.status}`,
      charge?.code ?? "erreur",
      charge?.ou_aller ?? null,
    )
  }
  return reponse.json() as Promise<T>
}

export const api = {
  etat: () => appeler<Etat>("/status"),

  /** Le catalogue, le grisé de chaque modèle, **et le compte de références**.
   *
   *  `echelle` est ce que l'auteur fabrique. Le serveur en tire la famille,
   *  ajoute les artworks qui partiront, dédoublonne avec les réinjections
   *  posées à la main, et rend le total — c'est ce total-là qui décide du
   *  grisé, et c'est lui qu'on affiche. */
  modeles: (
    proportions: string,
    references = 0,
    echelle = "",
    personnage = "",
    /** Combien de cases le lot armé demande, ou zéro. Il décide de deux choses
     *  au serveur : le gabarit compte dans le plafond du modèle, et le défaut
     *  devient le modèle de planche du projet plutôt que celui de la famille. */
    cases = 0,
    /** La pièce armée, ou le vide. Elle décide de deux choses au serveur : les
     *  concept arts qu'elle désigne partent avec l'appel, et le défaut devient
     *  le modèle d'**édition** du projet — habiller un corps est une édition,
     *  pas une création de planche. */
    piece = "",
  ) =>
    appeler<EtatCatalogue>(
      `/models?proportions=${encodeURIComponent(proportions)}` +
        `&references=${references}&echelle=${encodeURIComponent(echelle)}` +
        `&personnage=${encodeURIComponent(personnage)}&cases=${cases}` +
        `&piece=${encodeURIComponent(piece)}`,
    ),

  rafraichirCatalogue: () =>
    appeler<{ modeles: number; recu_le: number; repli: boolean; raison: string | null }>(
      "/models/refresh",
      { method: "POST" },
    ),

  agent: () => appeler<EtatAgent>("/settings/agent"),
  /** **Champ par champ** : ce qui n'est pas envoyé ne change pas. L'écran
   *  bascule un interrupteur à la fois, et poster l'objet entier depuis un
   *  formulaire partiel effacerait ce qu'un autre onglet vient de poser. */
  reglerAgent: (champs: Partial<GardeFous>) =>
    appeler<EtatAgent>("/settings/agent", {
      method: "PUT",
      body: JSON.stringify(champs),
    }),
  deposerCle: (cle: string) =>
    appeler<EtatCle>("/settings/key", {
      method: "PUT",
      body: JSON.stringify({ cle }),
    }),

  generer: (corps: {
    modele: string
    prompt: string
    prompt_negatif: string
    proportions: string
    /** La case que cet appel vise (US-120). Absente pour une génération
     *  ordinaire, qui est le cas courant. */
    personnage?: string | null
    pose?: string | null
    /** **Les cases d'un lot plié** (C2, US-128). Deux poses ou plus, et l'appel
     *  part en une seule planche que l'atelier dépliera lui-même. La même route
     *  que tout le reste : il n'existe qu'un seul endroit d'où l'on paie. */
    poses?: string[] | null
    /** **La pièce que cet appel pose** (C3, US-140). Présente, la planche part
     *  *pleine* des corps que `poses` désigne, et ce qui revient est comparé
     *  case par case à ce qui est parti : N calques pour un appel. Absente,
     *  c'est une planche de création, et il n'y a rien à comparer. */
    piece?: string | null
    /** Ce que **cette génération-ci** n'envoie pas (US-126). Absent, les deux
     *  portées durables s'appliquent ; présent, il décide seul — c'est la
     *  portée la plus étroite. */
    references_ecartees?: string[] | null
    variations: number
    options: Record<string, unknown>
    identifiant: string
    references: Reinjection[]
    /** Ce que l'auteur fabrique, nommé dans le barème du projet. */
    echelle: string
    /** **Le texte part mot pour mot** (US-159, US-160). L'auteur a vu ce qui
     *  partait et l'a repris : la bible ne se replie plus en tête, les
     *  consignes de planche ne s'ajoutent plus en queue — elles sont déjà dans
     *  ce qu'il a écrit. Rien d'autre ne change : l'échelle décide toujours des
     *  artworks, du modèle par défaut et de l'occupation. */
    repris: boolean
  }) =>
    appeler<Generation>("/generations", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  relancer: (identifiant: string, rang: number) =>
    appeler<Generation>(`/generations/${identifiant}/slots/${rang}/retry`, {
      method: "POST",
    }),

  /** Les paramètres d'une génération passée — le quatrième rôle de la
   *  réinjection, celui qui n'envoie aucune image (US-12). */
  generation: (identifiant: string) =>
    appeler<Generation>(`/generations/${identifiant}`),

  /** **Le texte exact qui partira**, avant de lancer (US-158).
   *
   *  Composé par le serveur, jamais ici : c'est le même chemin que la
   *  soumission emprunte, et deux compositions écrites à deux endroits
   *  finiraient par diverger — celle qui compte étant celle qui part. Rien
   *  n'est facturé, rien n'est enregistré, et l'appel ne sort pas de la
   *  machine. */
  apercuPrompt: (corps: {
    prompt: string
    projet?: string | null
    personnage?: string | null
    poses?: string[] | null
    piece?: string | null
    repris?: boolean
  }) =>
    appeler<ApercuPrompt>("/prompt/preview", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  // ── Le post-traitement ────────────────────────────────────────────────────
  // Aucun de ces appels ne touche le réseau côté serveur, et aucun ne coûte un
  // centime : tout se passe sur le disque et le processeur de la machine.

  poserRecette: (identifiant: string, recette: Recette) =>
    appeler<Asset>(`/assets/${identifiant}/recipe`, {
      method: "PUT",
      body: JSON.stringify(recette),
    }),

  revenirAuBrut: (identifiant: string) =>
    appeler<Asset>(`/assets/${identifiant}/reset`, { method: "POST" }),

  /** **Faire entrer une image depuis l'écran** (US-167, US-168).
   *
   *  Les octets sont le corps de la requête, bruts — pas de `multipart`, comme
   *  au tableau d'inspiration : il demanderait une dépendance d'exécution de
   *  plus pour transporter ce qu'un `POST` transporte déjà.
   *
   *  **Une image par appel** : douze fichiers déposés font douze réponses, donc
   *  onze assets et un refus qui nomme le douzième (US-169), et les onze
   *  premiers entrent sans attendre que le douzième soit lu.
   *
   *  L'un des deux champs rendus est toujours nul. Un doublon **n'est pas un
   *  refus** : il porte l'asset existant, de quoi faire le lien, et rappeler
   *  avec `forcer` fait entrer quand même. */
  televerser: (
    octets: Blob,
    {
      nom = "",
      /** Le traitement du projet s'applique-t-il ? **Faux par défaut** — une
       *  référence de 2048 pixels n'a rien à faire ramenée à 64 (US-170). */
      traiter = false,
      forcer = false,
    }: { nom?: string; traiter?: boolean; forcer?: boolean } = {},
  ) =>
    appeler<{ asset: Asset | null; doublon: Asset | null }>(
      `/assets/upload?nom=${encodeURIComponent(
        nom || (octets instanceof File ? octets.name : ""),
      )}&traiter=${traiter}&forcer=${forcer}`,
      { method: "POST", body: octets, headers: {} },
    ),

  /** Ce que le projet impose à cette image-là, **maintenant** (US-164).
   *
   *  À part de l'asset, et c'est la grille qui le décide : la charge d'un asset
   *  part deux cents fois par relecture, celle-ci une fois par fiche ouverte. */
  imposeSurAsset: (identifiant: string) =>
    appeler<Impose>(`/assets/${identifiant}/imposed`),

  nommerRecette: (nom: string, recette: Recette) =>
    appeler<{ recettes: Record<string, Recette> }>(
      `/recipes/${encodeURIComponent(nom)}`,
      { method: "PUT", body: JSON.stringify(recette) },
    ),

  appliquerRecette: (identifiant: string, nom: string) =>
    appeler<Asset>(`/assets/${identifiant}/apply/${encodeURIComponent(nom)}`, {
      method: "POST",
    }),

  // ── La bibliothèque ───────────────────────────────────────────────────────
  // Rien ici ne touche le réseau non plus : retrouver, ranger, marquer,
  // supprimer et reconstruire fonctionnent réseau coupé (US-92).

  /** La grille. **La seule du produit** : mêmes filtres, même recherche, même
   *  sélection, qu'on cherche à réutiliser ou à organiser (US-31). Le filtrage
   *  est fait par le serveur — la recherche doit porter sur toute la
   *  bibliothèque, pas sur ce que le navigateur a en mémoire. */
  assets: (filtre: Partial<Filtre> & { sansProjet?: boolean } = {}) => {
    const parametres = new URLSearchParams()
    if (filtre.sansProjet) parametres.set("sans_projet", "true")
    if (filtre.collection) parametres.set("collection", filtre.collection)
    if (filtre.favoris) parametres.set("favoris", "true")
    if (filtre.recherche?.trim()) parametres.set("recherche", filtre.recherche.trim())
    const suite = parametres.toString()
    return appeler<{ assets: Asset[] }>(`/assets${suite ? `?${suite}` : ""}`)
  },

  arbre: () => appeler<Bibliotheque>("/library"),

  reconstruire: () =>
    appeler<{ reconstruit: Record<string, number>; bibliotheque: Bibliotheque }>(
      "/library/rebuild",
      { method: "POST" },
    ),

  journal: (projet: string | null) =>
    appeler<Journal>(
      projet === null
        ? "/journal?sans_projet=true"
        : `/journal?projet=${encodeURIComponent(projet)}`,
    ),

  depenses: () => appeler<Depenses>("/spending"),

  /** Un asset, par son identifiant. L'écran des dépenses en a besoin pour la
   *  seule chose qu'il montre en image — ce qui est revenu de l'appel choisi —
   *  et il n'en tient aucune liste : une vignette par ligne ferait de lui une
   *  seconde galerie. */
  lireAsset: (identifiant: string) => appeler<Asset>(`/assets/${identifiant}`),

  /** Ce qu'une table a besoin de savoir de l'image. Demandé au serveur, qui est
   *  le seul à avoir les pixels — et qui porte déjà le remplissage par plages
   *  que le découpage emploie. */
  taches: (identifiant: string) =>
    appeler<TachesDeLAsset>(`/assets/${identifiant}/spots`),

  creerProjet: (nom: string) =>
    appeler<{ projet: Projet; bibliotheque: Bibliotheque }>("/projects", {
      method: "POST",
      body: JSON.stringify({ nom }),
    }),

  ouvrirProjet: (projet: string | null) =>
    appeler<Bibliotheque>("/projects/current", {
      method: "PUT",
      body: JSON.stringify({ projet }),
    }),

  supprimerProjet: (identifiant: string) =>
    appeler<{ assets: number; appels: number; bibliotheque: Bibliotheque }>(
      `/projects/${encodeURIComponent(identifiant)}`,
      { method: "DELETE" },
    ),

  creerCollection: (nom: string, projet: string | null) =>
    appeler<{ collection: Collection; bibliotheque: Bibliotheque }>("/collections", {
      method: "POST",
      body: JSON.stringify({ nom, projet }),
    }),

  supprimerCollection: (identifiant: string) =>
    appeler<{ assets: number; bibliotheque: Bibliotheque }>(
      `/collections/${encodeURIComponent(identifiant)}`,
      { method: "DELETE" },
    ),

  ranger: (
    identifiants: string[],
    rangement: { projet?: string | null; collection?: string | null },
  ) =>
    appeler<{ assets: Asset[]; bibliotheque: Bibliotheque }>("/assets/arrangement", {
      method: "PUT",
      body: JSON.stringify({ identifiants, ...rangement }),
    }),

  favori: (identifiants: string[], favori: boolean) =>
    appeler<{ assets: Asset[] }>("/assets/favorite", {
      method: "PUT",
      body: JSON.stringify({ identifiants, favori }),
    }),

  supprimerAssets: (identifiants: string[]) =>
    appeler<{ supprimes: string[]; annulation_s: number; expire_le: number }>(
      "/assets/delete",
      { method: "POST", body: JSON.stringify({ identifiants }) },
    ),

  restaurer: (identifiants: string[]) =>
    appeler<{ assets: Asset[] }>("/assets/restore", {
      method: "POST",
      body: JSON.stringify({ identifiants }),
    }),

  filiation: (identifiant: string) =>
    appeler<Filiation>(`/assets/${identifiant}/lineage`),

  // ── Le slicer ─────────────────────────────────────────────────────────────
  //
  // **Deux appels, parce que ce sont deux gestes.** Proposer ne crée rien et se
  // redemande à chaque cran de réglage ; découper crée des assets et ne se
  // redemande jamais. Ce qui part à la découpe est la liste que l'auteur a sous
  // les yeux, corrections comprises — pas un mode que le serveur rejouerait de
  // son côté (US-73).

  decoupeProposee: (
    identifiant: string,
    reglage: {
      mode?: ModeDecoupe
      colonnes?: number
      lignes?: number
      cote_min?: number
    } = {},
  ) => {
    const parametres = new URLSearchParams()
    for (const [nom, valeur] of Object.entries(reglage))
      if (valeur !== undefined) parametres.set(nom, String(valeur))
    return appeler<Proposition>(`/assets/${identifiant}/slices?${parametres}`)
  },

  decouper: (identifiant: string, boites: Boite[]) =>
    appeler<{ planche: string; decoupes: Asset[] }>(`/assets/${identifiant}/slices`, {
      method: "POST",
      body: JSON.stringify({ boites }),
    }),

  // ── La superposition — la seconde fabrique (E6) ────────────────────────────
  //
  // **Aucune de ces routes ne coûte un centime**, et c'est tout leur intérêt :
  // les deux images sont déjà payées. La coupure est celle du slicer — ce qui
  // ne crée rien se redemande à chaque cran de réglage, ce qui crée des assets
  // ne se redemande jamais.

  // ── L'assistant de démarrage (E8) ─────────────────────────────────────────

  /** Les deux listes fermées — huit vues, neuf tailles. Servies par le serveur
   *  parce que c'est lui qui écrit les phrases qu'elles commandent. */
  vuesEtTailles: () => appeler<VuesEtTailles>("/universe/views"),

  /** Ce qu'un changement casserait, avant de le faire. */
  consequences: (cible_px: number) =>
    appeler<Consequences>(`/universe/consequences?cible_px=${cible_px}`),

  etiquettes: () => appeler<{ etiquettes: Etiquette[] }>("/labels"),

  fabriquerEtiquette: (libelle: string, texte: string, casee: string) =>
    appeler<{ etiquettes: Etiquette[] }>("/labels", {
      method: "POST",
      body: JSON.stringify({ libelle, texte, case: casee }),
    }),

  /** Compter un emploi — c'est lui qui met les plus employées en premier. */
  etiquetteServie: (identifiant: string) =>
    appeler<{ etiquettes: Etiquette[] }>(`/labels/${identifiant}/used`, {
      method: "POST",
    }),

  oublierEtiquette: (identifiant: string) =>
    appeler<{ etiquettes: Etiquette[] }>(`/labels/${identifiant}`, { method: "DELETE" }),

  /** Le nom change, **l'identifiant jamais** : c'est ce qui permet à
   *  l'assistant de renommer le « Bac à sable » plutôt que d'en créer un
   *  second. */
  renommerProjet: (identifiant: string, nom: string) =>
    appeler<{ projet: Projet; bibliotheque: Bibliotheque }>(`/projects/${identifiant}`, {
      method: "PUT",
      body: JSON.stringify({ nom }),
    }),

  ouvrirSuperposition: (dessus: string, dessous?: string) =>
    appeler<OuvertureSuperposition>(
      `/assets/${dessus}/overlay${dessous ? `?dessous=${encodeURIComponent(dessous)}` : ""}`,
    ),

  recalerSuperposition: (dessus: string, dessous: string) =>
    appeler<{ echelle: number; dx: number; dy: number; couverture: number }>(
      `/assets/${dessus}/overlay/fit?dessous=${encodeURIComponent(dessous)}`,
    ),

  heriterDetourage: (dessus: string, dessous: string) =>
    appeler<Asset>(
      `/assets/${dessus}/overlay/inherit?dessous=${encodeURIComponent(dessous)}`,
      { method: "POST" },
    ),

  apercuSuperposition: (pose: Superposition) =>
    appeler<ApercuSuperposition>("/overlay/preview", {
      method: "POST",
      body: JSON.stringify(pose),
    }),

  fabriquerSuperposition: (pose: Superposition, sorties: string[], garder: boolean) =>
    appeler<{ superpositions: Asset[] }>("/overlay", {
      method: "POST",
      body: JSON.stringify({ pose, sorties, garder }),
    }),

  rejouerSuperposition: (identifiant: string, pose: Superposition) =>
    appeler<Asset>(`/assets/${identifiant}/overlay`, {
      method: "PUT",
      body: JSON.stringify(pose),
    }),

  oublierReglagesSuperposition: (dessous: string) =>
    appeler<Asset>(`/assets/${dessous}/overlay/saved`, { method: "DELETE" }),

  // ── Le tableau d'inspiration ──────────────────────────────────────────────
  // Une seule de ces routes touche le réseau : celle qui va chercher l'image
  // d'une adresse collée. Toutes les autres marchent hors ligne.

  /** La toile en un aller-retour : les cartes, les groupes, les traits et les
   *  teintes. Une seconde route pour les liens aurait fait paraître les cartes
   *  avant eux — donc un instant, à chaque ouverture, où la toile montre des
   *  objets sans ce qu'on en avait dit. */
  tableau: () =>
    appeler<{
      projet: string
      cartes: Carte[]
      groupes: string[]
      liens: Lien[]
      teintes: Record<string, Teinte>
    }>("/board"),

  /** Coller **une** image. Les octets sont le corps, bruts — pas de
   *  `multipart`, qui demanderait une dépendance de plus au serveur.
   *
   *  Une image par appel, et c'est ce que US-45 demande : « savoir lequel des
   *  douze fichiers déposés pose problème ». Douze appels rendent douze
   *  réponses, dont onze cartes et un refus qui nomme le fichier — et les onze
   *  premières paraissent sans attendre que la douzième soit lue. */
  collerImage: (octets: Blob, nom: string, forcer = false) =>
    appeler<{ carte: Carte | null; doublon: Carte | null }>(
      `/board/paste?nom=${encodeURIComponent(nom)}&forcer=${forcer}`,
      { method: "POST", body: octets, headers: {} },
    ),

  /** Coller une adresse — la carte paraît **avant** que l'image n'arrive. La
   *  route rend la main tout de suite ; l'issue arrive par le flux. */
  collerAdresse: (adresse: string) =>
    appeler<Carte>("/board/url", {
      method: "POST",
      body: JSON.stringify({ adresse }),
    }),

  /** Un texte devient une carte texte — et depuis T9 il peut naître **posé**.
   *
   *  La place voyage avec le texte, et n'ouvre pas de second appel : créer puis
   *  déplacer aurait fait paraître la note en réserve, à l'autre bout de l'écran
   *  de l'endroit qu'on vient de désigner, et rendu possible l'état où elle
   *  existe sans avoir jamais été posée. C'est la règle de la carte tirée dans
   *  un îlot, appliquée à sa naissance. */
  collerTexte: (
    texte: string,
    sur?: { position?: [number, number]; groupe?: string; teinte?: Teinte },
  ) =>
    appeler<Carte>("/board/text", {
      method: "POST",
      body: JSON.stringify({ texte, ...sur }),
    }),

  /** Réessayer une récupération qui a échoué (US-43). Un geste de l'auteur,
   *  jamais une reprise automatique. */
  reessayerCarte: (carte: string) =>
    appeler<Carte>(`/board/${carte}/retry`, { method: "POST" }),

  /** Grouper, annoter, régler la taille — et poser sur la toile.
   *
   *  **Une seule route pour les cinq, et T8 n'en a pas ouvert de seconde.**
   *  Tirer une carte dans un îlot écrit sa position *et* son groupe : deux
   *  appels rendraient possible un état où l'un est écrit et l'autre non,
   *  c'est-à-dire la divergence que toute la tranche est là pour empêcher.
   *
   *  **Le vide efface, l'absence ne touche pas.** `groupe: ""` sort la carte de
   *  son îlot, `position: []` la sort du plan ; les deux ensemble la ramènent en
   *  réserve, en un appel. */
  reglerCarte: (
    carte: string,
    reglage: {
      groupe?: string
      note?: string
      taille?: 1 | 2 | 4
      position?: [number, number] | []
      largeur_libre?: number
      /** Le texte d'une **note**, corrigé en place. Sans lui, réparer une faute
       *  demanderait de retirer la note et de la recoller — donc de perdre sa
       *  place, sa teinte et les liens qui y aboutissent. */
      texte?: string
      /** La teinte d'une **note**. `""` la retire ; une carte image la refuse,
       *  et c'est le serveur qui le dit. */
      teinte?: Teinte
    },
  ) =>
    appeler<Carte>(`/board/${carte}`, {
      method: "PUT",
      body: JSON.stringify(reglage),
    }),

  /** Promouvoir une carte en artwork officiel, et lui donner sa famille.
   *  Rend l'univers avec : la palette se recalcule dans le même geste. */
  promouvoir: (carte: string, officiel: boolean, famille: Famille = "tous") =>
    appeler<{ carte: Carte; univers: Univers }>(`/board/${carte}/official`, {
      method: "PUT",
      body: JSON.stringify({ officiel, famille }),
    }),

  oublierCarte: (carte: string) =>
    appeler<{ carte: Carte; univers: Univers }>(`/board/${carte}`, {
      method: "DELETE",
    }),

  imageCarte: (carte: string, version: string) =>
    `/api/board/${carte}/image?v=${encodeURIComponent(version)}`,

  // ── Les liens de la toile ─────────────────────────────────────────────────
  // Aucune ne touche le réseau extérieur : toute la tranche est du dire.

  /** Tirer un trait d'un objet à un autre — **il naît muet**.
   *
   *  `dit` n'existe que pour l'annulation : défaire une coupe, c'est reposer le
   *  lien **tel qu'il était**, en un seul appel. Tirer un trait ne l'envoie
   *  jamais, et c'est cette ligne-ci qui tient « il naît muet ». */
  lier: (de: Bout, vers: Bout, dit?: { mot?: string; pointe?: boolean }) =>
    appeler<Lien>("/board/links", {
      method: "POST",
      body: JSON.stringify({ de, vers, ...dit }),
    }),

  /** Le mot et la pointe, ensemble : ils se posent sur la même petite surface.
   *  `undefined` ne touche pas, `""` efface — la convention du produit depuis
   *  `groupe`. */
  reglerLien: (lien: string, reglage: { mot?: string; pointe?: boolean }) =>
    appeler<Lien>(`/board/links/${lien}`, {
      method: "PUT",
      body: JSON.stringify(reglage),
    }),

  couperLien: (lien: string) =>
    appeler<Lien>(`/board/links/${lien}`, { method: "DELETE" }),

  /** La teinte d'un îlot. **Le groupe est dans le corps, pas dans le chemin** :
   *  un nom de groupe est du texte libre, et un îlot nommé « nord/sud » aurait
   *  fabriqué une adresse que personne n'atteint. */
  teinterIlot: (groupe: string, teinte: Teinte) =>
    appeler<{ projet: string; teintes: Record<string, Teinte> }>("/board/groups/tint", {
      method: "PUT",
      body: JSON.stringify({ groupe, teinte }),
    }),

  /** Déplacer un îlot entier — **un seul appel, parce que c'est un seul geste**.
   *
   *  Un îlot n'a pas de position à lui : il *est* le groupe, et le déplacer,
   *  c'est déplacer ses cartes. Un appel par carte rendrait donc possible l'état
   *  où sept ont bougé et cinq sont restées — un îlot déchiré en deux moitiés
   *  que personne n'a demandé. C'est la règle de T8, « deux appels pour un geste
   *  sont un état de trop », appliquée à un geste qui en aurait demandé douze.
   *
   *  **Les places sont absolues, et toutes.** Absolues parce qu'une carte groupée
   *  avant T8 n'a pas de position écrite — un écart n'aurait rien eu à quoi
   *  s'ajouter pour elle. Toutes parce que le serveur refuse un îlot déplacé à
   *  moitié, et il a raison de le refuser. */
  deplacerIlot: (groupe: string, places: Record<string, [number, number]>) =>
    appeler<{ projet: string; cartes: Carte[] }>("/board/groups/move", {
      method: "PUT",
      body: JSON.stringify({ groupe, places }),
    }),

  // ── Le plan de poses et les personnages ───────────────────────────────────

  production: () => appeler<Production>("/characters"),

  creerPersonnage: (nom: string, description = "") =>
    appeler<{ personnage: Personnage }>("/characters", {
      method: "POST",
      body: JSON.stringify({ nom, description }),
    }),

  /** **En un seul geste** : les champs se remplissent ensemble à l'écran, et un
   *  appel par champ ferait autant d'allers-retours qu'il y a de cases. Ce
   *  qu'on n'envoie pas ne bouge pas. `poses` part en **positif** — ce que
   *  l'auteur a coché. */
  reglerPersonnage: (
    personnage: string,
    champs: {
      nom?: string
      description?: string
      poses?: string[]
      concept_arts?: string[]
      /** Le type d'objet, qui décide de la liste des poses (E9). */
      type?: string
      /** **Ajouter et retirer sont deux gestes**, et non une liste entière : une
       *  liste envoyée en bloc ferait perdre la pose qu'un autre onglet vient
       *  de poser. Le nom suffit à créer — « nommer, c'est créer ». */
      ajouter?: string
      retirer_ajoutee?: string
      /** L'ambiance que cette chose désigne (E11) — **sur sa fiche, jamais par
       *  la collection où elle est rangée** : une collection reste un dossier
       *  qui ne décide de rien. Le vide la retire, et la chose retombe sur le
       *  jeu. */
      ambiance?: string
      /** Ce qu'elle lui prend : tout, les couleurs seulement, ou tout sauf les
       *  images. Une ambiance ne s'impose pas — on la désigne, puis on choisit. */
      prend?: string
    },
  ) =>
    appeler<{ personnage: Personnage }>(`/characters/${personnage}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** Ce que chaque type d'objet réclame, et **d'où sa liste lui vient** (E9).
   *
   *  `origine` dit `écrite` quand l'auteur a posé la sienne, `connue` quand
   *  c'est celle que le produit propose pour ce type-là, et `projet` quand le
   *  type suit le plan du jeu. Sans cette phrase, une liste héritée aurait
   *  l'air d'une liste choisie. */
  posesDesTypes: () => appeler<PosesDesTypes>("/characters/types"),

  /** Écrire la liste d'un type — **et de lui seul**. On envoie ce qui reste,
   *  pas une pose à la fois : à l'écran on range et on dérange plusieurs lignes
   *  avant de regarder ailleurs, et un appel par ligne écrirait le fichier du
   *  projet autant de fois qu'il y a de cases cochées. */
  poserPosesDuType: (type: string, poses: Pose[]) =>
    appeler<PosesDesTypes>(
      `/characters/types/${encodeURIComponent(type)}/poses`,
      { method: "PUT", body: JSON.stringify({ poses }) },
    ),

  /** Ce type revient à la liste qu'on lui proposait — il n'écrit plus la
   *  sienne. Vider et oublier ne sont pas le même geste : vider est une
   *  décision qui tient, oublier est un retour en arrière. */
  oublierPosesDuType: (type: string) =>
    appeler<PosesDesTypes>(
      `/characters/types/${encodeURIComponent(type)}/poses`,
      { method: "DELETE" },
    ),

  // ── Le côté Ambiances et couleurs (E11) ──────────────────────────────────
  //
  // **Aucun de ces appels ne coûte un centime** : la fusion de deux palettes et
  // l'attraction des couleurs se font sur la machine, en millisecondes. C'est
  // un critère d'acceptation de la tranche.
  //
  // Les six gestes rendent **le côté entier**, comme les trois gestes du plan
  // rendent le plan entier : une palette qui change peut en changer une autre —
  // celle qui l'a prise pour source —, et l'écran n'a pas à deviner laquelle.

  coteAmbiances: () => appeler<CoteAmbiances>("/moods"),

  creerPalette: (nom: string, sources: SourceDePalette[] = []) =>
    appeler<CoteAmbiances>("/palettes", {
      method: "POST",
      body: JSON.stringify({ nom, sources }),
    }),

  reglerPalette: (
    identifiant: string,
    champs: {
      nom?: string
      sources?: SourceDePalette[]
      couleurs?: number
      du_jeu?: number
      attraction?: number
      retouches?: RetoucheDePalette[]
    },
  ) =>
    appeler<CoteAmbiances>(`/palettes/${identifiant}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  supprimerPalette: (identifiant: string) =>
    appeler<CoteAmbiances>(`/palettes/${identifiant}`, { method: "DELETE" }),

  /** La palette posée sur de vraies images du jeu — **rien n'est écrit**. */
  apercuDePalette: (identifiant: string) =>
    appeler<ApercuDePalette>(`/palettes/${identifiant}/preview`),

  creerAmbiance: (nom: string, palette = "") =>
    appeler<CoteAmbiances>("/moods", {
      method: "POST",
      body: JSON.stringify({ nom, palette }),
    }),

  reglerAmbiance: (
    identifiant: string,
    champs: {
      nom?: string
      palette?: string
      references?: string[]
      monde?: string
      eclairage?: string
      trait?: string
    },
  ) =>
    appeler<CoteAmbiances>(`/moods/${identifiant}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** Une ambiance part, **et aucune image ne bouge** : ce qui s'en servait
   *  retombe sur le jeu, et la réponse dit combien. */
  supprimerAmbiance: (identifiant: string) =>
    appeler<CoteAmbiances & { retombees: number }>(`/moods/${identifiant}`, {
      method: "DELETE",
    }),

  /** Cette image **est** le corps de cette case (US-122) — ou ne l'est plus,
   *  les deux vides ensemble. Le corps naît dans l'atelier et nulle part
   *  ailleurs : ce geste ne fabrique rien, il dit seulement où l'image va. */
  designer: (asset: string, personnage: string | null, pose: string | null) =>
    appeler<Asset>(`/assets/${asset}/character`, {
      method: "PUT",
      body: JSON.stringify({ personnage, pose }),
    }),

  /** Le sujet qu'une case demande au modèle — **composé par le serveur**.
   *
   *  L'écran l'écrivait lui-même jusqu'en C5 ; l'agent arme les mêmes cases, et
   *  deux compositions à deux endroits auraient fini par demander deux choses
   *  différentes pour la même case. Ce n'est pas l'aperçu : la bible et les
   *  consignes de planche s'ajoutent plus tard, et c'est `apercuPrompt` qui les
   *  montre. Rien n'est écrit, rien n'est payé. */
  sujetDeCase: (corps: {
    personnage: string
    poses?: string[]
    piece?: string | null
    projet?: string | null
  }) =>
    appeler<{ sujet: string }>("/characters/subject", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  /** Un personnage complet part dans le dossier du jeu (US-154, US-155).
   *
   *  **Aucun octet ne revient** : les fichiers sont écrits sur la machine, et ce
   *  qu'on reçoit est la liste de leurs chemins — la même que l'agent reçoit,
   *  de la même sortie. Sans `dossier`, c'est celui des Réglages ; absent lui
   *  aussi, le refus dit où le poser. */
  sortirPersonnage: (personnage: string, dossier?: string) =>
    appeler<Sortie>(`/characters/${personnage}/export`, {
      method: "POST",
      body: JSON.stringify(dossier ? { dossier } : {}),
    }),

  /** Le personnage part, **ses images restent** — chacune marquée « personnage
   *  supprimé ». La réponse dit combien. */
  supprimerPersonnage: (personnage: string) =>
    appeler<{ personnage: Personnage; images: number }>(
      `/characters/${personnage}`,
      { method: "DELETE" },
    ),

  /** Les trois gestes du plan rendent **le plan entier** avec la pose touchée
   *  — la même forme que l'annonce du flux. L'écran fond alors ce qui lui
   *  arrive par les deux chemins avec le même code, et n'a jamais à deviner si
   *  une pose vient d'être ajoutée, renommée ou retirée. */
  // ── Le vestiaire (C3) ─────────────────────────────────────────────────────
  //
  // Les six gestes rendent **le vestiaire entier** avec l'objet touché — la même
  // forme que l'annonce du flux, comme les trois gestes du plan juste en
  // dessous. Aucun ne touche le réseau côté serveur, et aucun ne coûte un
  // centime : écrire une pièce ne demande rien à personne.

  /** **Nommer, c'est créer** (US-138) : un emplacement de plus, en queue. */
  ajouterEmplacement: (nom: string) =>
    appeler<{ emplacement: EmplacementCorps } & Vestiaire>("/characters/slots", {
      method: "POST",
      body: JSON.stringify({ nom }),
    }),

  /** Renommer un emplacement, ou le déplacer dans l'ordre. **L'identifiant ne
   *  bouge pas** : les pièces rangées là le portent. */
  reglerEmplacement: (identifiant: string, champs: { nom?: string; rang?: number }) =>
    appeler<{ emplacement: EmplacementCorps } & Vestiaire>(
      `/characters/slots/${identifiant}`,
      { method: "PUT", body: JSON.stringify(champs) },
    ),

  /** L'emplacement part, **les pièces restent** — sans emplacement, comme au
   *  jour où on les a nommées. Jamais de cascade. */
  retirerEmplacement: (identifiant: string) =>
    appeler<{ emplacement: EmplacementCorps } & Vestiaire>(
      `/characters/slots/${identifiant}`,
      { method: "DELETE" },
    ),

  /** Une pièce décrite **une seule fois** (US-137). L'emplacement se donne par
   *  son identifiant ou par son nom, et il est créé s'il n'existe pas : nommer
   *  « casque · tête » ne doit pas demander d'avoir créé la tête d'abord. */
  ajouterPiece: (corps: {
    nom: string
    description?: string
    emplacement?: string
    portee?: Portee
  }) =>
    appeler<{ piece: Piece } & Vestiaire>("/characters/pieces", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  /** Tout ce qui se règle sur une pièce, **en un seul geste** — la portée
   *  comprise, et elle n'est jamais devinée (US-139). */
  reglerPiece: (
    identifiant: string,
    champs: {
      nom?: string
      description?: string
      emplacement?: string
      portee?: Portee
      concept_arts?: string[]
    },
  ) =>
    appeler<{ piece: Piece } & Vestiaire>(`/characters/pieces/${identifiant}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** La pièce part, **ses calques restent** — jamais de cascade. */
  retirerPiece: (identifiant: string) =>
    appeler<{ piece: Piece } & Vestiaire>(`/characters/pieces/${identifiant}`, {
      method: "DELETE",
    }),

  /** Poser, déplacer ou retirer le masque rectangle d'un calque (US-145).
   *
   *  **Le journal du projet ne bouge pas d'un centime** : ce chemin ne touche
   *  jamais le fournisseur. `null` retire le masque — revenir à la différence
   *  brute est un geste unique, et c'est celui-ci. */
  borner: (identifiant: string, zone: number[] | null) =>
    appeler<Asset>(`/assets/${identifiant}/layer`, {
      method: "PUT",
      body: JSON.stringify({ zone }),
    }),

  /** Poser une couche de la main sur un calque (C4, US-149, US-150, US-153).
   *
   *  **La liste est entière, jamais un ajout**, et **vide elle annule la
   *  couche** — c'est le geste unique du retour en arrière, celui de « Sans
   *  zone » un cran plus haut. Deux onglets qui empileraient des deltas ne
   *  convergeraient jamais.
   *
   *  Une couche n'écrit jamais dans l'autre : le serveur remplace un champ de
   *  la différence, et laisse l'autre où il est. */
  affiner: (identifiant: string, couche: Couche, traits: Trait[]) =>
    appeler<Asset>(`/assets/${identifiant}/hand`, {
      method: "PUT",
      body: JSON.stringify({ couche, traits }),
    }),

  /** Rejouer le recalage de la planche dont cette image est sortie (US-173, R5).
   *
   *  **Rien ne naît, rien ne meurt** : les images déjà là gardent leur
   *  identifiant et leur place, et seule leur matière change — d'où une liste
   *  d'assets *rejoués*, jamais d'assets neufs. Le journal du projet ne bouge
   *  pas d'un centime : la planche a été payée une fois, la remesurer est
   *  gratuit. */
  recaler: (identifiant: string) =>
    appeler<{ assets: Asset[] }>(`/assets/${identifiant}/realign`, {
      method: "POST",
    }),

  ajouterPose: (nom: string, images = 1) =>
    appeler<{ pose: Pose; plan: Pose[] }>("/characters/poses", {
      method: "POST",
      body: JSON.stringify({ nom, images }),
    }),

  /** Renommer, ou changer ce que la pose demande. **L'identifiant ne bouge
   *  pas** : les images déjà faites le portent. */
  reglerPose: (pose: string, champs: { nom?: string; images?: number }) =>
    appeler<{ pose: Pose; plan: Pose[] }>(`/characters/poses/${pose}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** Poser ce qui ne partira plus, à l'une des **deux portées durables**
   *  (US-126). La troisième — cette génération — ne passe pas par ici : elle ne
   *  s'écrit nulle part et part avec l'appel.
   *
   *  La liste est **entière**, jamais un ajout : deux onglets qui cocheraient
   *  et décocheraient la même ligne par deltas ne convergeraient jamais. */
  ecarter: (portee: PorteeDurable, ecartees: string[], personnage?: string) =>
    appeler<{ portee: PorteeDurable; ecartees: string[] }>("/references", {
      method: "PUT",
      body: JSON.stringify({ portee, ecartees, personnage: personnage ?? null }),
    }),

  retirerPose: (pose: string) =>
    appeler<{ pose: Pose; plan: Pose[] }>(`/characters/poses/${pose}`, {
      method: "DELETE",
    }),

  // ── L'univers du projet ───────────────────────────────────────────────────

  univers: () =>
    appeler<{ projet: string; univers: Univers; artworks: Carte[] }>("/universe"),

  /** Tout est facultatif : ce qu'on n'envoie pas ne bouge pas. Un `PUT` qui
   *  exigerait l'univers entier obligerait l'écran à en tenir une copie. */
  reglerUnivers: (reglage: {
    vue?: string
    bible?: Champ[]
    bareme?: Echelle[]
    cible_px?: number
    couleurs?: number
    modeles?: Partial<Record<Famille, string>>
    modele_planche?: string
    modele_edition?: string
  }) =>
    appeler<{ projet: string; univers: Univers }>("/universe", {
      method: "PUT",
      body: JSON.stringify(reglage),
    }),

  /** Réappliquer la palette et la grille du projet — **sans un appel payant**.
   *  Sans identifiants, tout le projet en sautant les épinglés ; avec, cette
   *  sélection-là, épinglés compris (US-67, US-68, US-69). */
  realigner: (identifiants?: string[]) =>
    appeler<{
      projet: string
      realignes: number
      conserves: number
      assets: string[]
      /** Faux quand le projet n'impose aucune taille de pixel : le balayage
       *  n'a rééchantillonné personne, et l'écran le dit avec le compte
       *  (US-163). Sans cette ligne, « 12 remis à jour » se lirait comme une
       *  remise sur grille qui n'a pas eu lieu. */
      sur_grille: boolean
    }>("/universe/realign", {
      method: "POST",
      body: JSON.stringify({ identifiants: identifiants ?? null }),
    }),

  // ── Les adresses d'images ─────────────────────────────────────────────────

  image: (identifiant: string, rang: number) =>
    `/api/generations/${identifiant}/slots/${rang}/image`,

  telechargement: (identifiant: string, rang: number) =>
    `/api/generations/${identifiant}/slots/${rang}/download`,

  // Le rendu change sous la même adresse à chaque cran de curseur : `version`
  // porte l'empreinte de la recette pour que le navigateur cherche une image
  // neuve au lieu de resservir celle d'avant.
  rendu: (identifiant: string, version: string, brut = false) =>
    `/api/assets/${identifiant}/image?brut=${brut}&v=${encodeURIComponent(version)}`,

  /** Le calque **avant que la main y passe** (C4, US-151) — l'autre moitié de
   *  la comparaison d'un seul geste.
   *
   *  Une adresse à part et non un troisième état de `rendu` : l'avant n'est pas
   *  un cran de la bascule rendu/brut, il ne se garde nulle part, et rien
   *  d'autre dans le produit ne le montre. Le serveur ne l'écrit pas non plus —
   *  c'est un calcul, pas un fichier. */
  avant: (identifiant: string, version: string) =>
    `/api/assets/${identifiant}/image?avant=true&v=${encodeURIComponent(version)}`,

  telechargementAsset: (identifiant: string, brut = false) =>
    `/api/assets/${identifiant}/download?brut=${brut}`,

  /** L'archive d'une sélection (US-76) — **le seul appel qui ne rende pas du
   *  JSON**, d'où son chemin à part.
   *
   *  Un `POST` parce qu'une sélection de deux cents identifiants ne tient pas
   *  dans une adresse, et un lien `download` ne sait pas poster. Le refus, lui,
   *  revient en JSON comme partout ailleurs : c'est le même `Refus` que le
   *  reste de l'interface affiche, et l'export ne s'invente pas de message.
   *
   *  Le nom du fichier vient du serveur, jamais d'ici : deux endroits qui
   *  nommeraient la même archive finiraient par ne plus dire la même date. */
  exporter: async (identifiants: string[]): Promise<Archive> => {
    let reponse: Response
    try {
      reponse = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiants }),
      })
    } catch {
      throw new Refus("l'atelier ne répond pas", "atelier_arrete")
    }
    if (!reponse.ok) {
      const charge = await reponse.json().catch(() => null)
      throw new Refus(
        charge?.raison ?? `l'atelier a répondu ${reponse.status}`,
        charge?.code ?? "erreur",
        charge?.ou_aller ?? null,
      )
    }
    return {
      nom: nomDeFichier(reponse.headers.get("Content-Disposition")),
      octets: await reponse.blob(),
    }
  },
}

export type Archive = { nom: string; octets: Blob }

/** Le nom que le serveur a posé dans `Content-Disposition`.
 *
 *  Le repli n'est pas une seconde règle de nommage : c'est le nom qu'un
 *  navigateur donnerait de toute façon à une archive sans nom. Il n'arrive que
 *  si l'en-tête manque, et alors le fichier est quand même sauvé. */
function nomDeFichier(disposition: string | null): string {
  const trouve = /filename="([^"]+)"/.exec(disposition ?? "")
  return trouve ? trouve[1] : "atelier.zip"
}

/** Poser un fichier reçu dans les téléchargements, sans passer par une adresse.
 *
 *  Un `<a download>` suffit pour une image seule — elle a une adresse, et
 *  `Tuile` comme `Fiche` s'en servent. Une archive, elle, n'en a pas : elle est
 *  fabriquée pour cette sélection-là, à cet instant-là. On lui en donne une le
 *  temps d'un clic, et on la reprend aussitôt — une adresse d'objet non révoquée
 *  retient les octets de l'archive en mémoire jusqu'à la fermeture de l'onglet. */
export function poserLeFichier({ nom, octets }: Archive): void {
  const adresse = URL.createObjectURL(octets)
  const lien = document.createElement("a")
  lien.href = adresse
  lien.download = nom
  document.body.append(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(adresse)
}

// ── Le flux d'événements ────────────────────────────────────────────────────
//
// L'interface ne redemande plus rien : elle écoute. Un onglet ouvert apprend au
// moment où ça se produit, un onglet fermé ne coûte rien, et le serveur, lui,
// travaille de la même façon dans les deux cas.
//
// `EventSource` se reconnecte seul, et **chaque reconnexion redonne l'état
// complet** — c'est ce qui fait qu'un onglet rouvert, ou une veille de machine,
// retrouve ses images sans que personne ait à recharger la page.

export type Ecoute = {
  /** L'état complet. Arrive au branchement, et à chaque rebranchement. */
  etat: (etat: Etat) => void
  /** Une génération a changé — un emplacement part, une image arrive, un appel
   *  échoue. La charge porte toujours la génération **entière**. */
  generation: (generation: Generation) => void
  /** Le catalogue a été relu : entrée en repli, ou sortie de repli. */
  catalogue: (catalogue: EtatCatalogueCourt) => void
  /** Un asset est né, sa recette a changé, il s'est rangé, ou il est parti. La
   *  charge porte l'asset entier. */
  asset: (asset: Asset) => void
  /** L'arbre a changé — un projet, une collection, un rangement, un compte. */
  bibliotheque: (bibliotheque: Bibliotheque) => void
  /** Une carte est entrée, a été réglée, promue, récupérée — ou elle est
   *  partie, et elle porte alors `oubliee`. La charge est la carte entière. */
  carte: (carte: Carte & { oubliee?: boolean }) => void
  /** Un lien a été tiré, nommé, ou coupé — et il porte alors `coupe`. La charge
   *  est le lien entier, comme pour une carte. Un lien dont une extrémité
   *  disparaît arrive par ce message-là, coupé : c'est le serveur qui le tient,
   *  l'écran ne rejoue jamais la règle. */
  lien: (lien: Lien & { coupe?: boolean }) => void
  /** L'univers d'un projet a changé : palette recalculée, réglage posé, ou
   *  balayage de réalignement terminé. Un **seul** message pour un lot entier —
   *  la diffusion garde soixante-quatre messages par abonné, et un événement
   *  par asset en perdrait les plus anciens sur un projet un peu fourni. */
  univers: (charge: {
    projet: string
    nom: string
    univers: Univers
    /** Les teintes des îlots. **Dans l'enveloppe, pas dans l'univers** :
     *  `Univers` est « ce que le projet impose à ce qui rentre, et ce qu'il
     *  envoie avec », et une teinte d'îlot n'impose rien et ne part nulle
     *  part. */
    teintes: Record<string, Teinte>
    realignes: number
    conserves: number
  }) => void
  /** Un personnage a été créé, décrit, coché — ou il est parti, et il porte
   *  alors `supprime`. La charge est le personnage entier, comme pour une carte.
   *  **Son propre genre, jamais un champ de plus sur `univers`** : un message
   *  qui gagne un champ gagne aussi des lecteurs qui ne le concernent pas, et
   *  `univers` fait redemander l'état *et* le catalogue depuis T4. */
  personnage: (personnage: Personnage & { supprime?: boolean }) => void
  /** Le plan de poses du projet a changé — une pose ajoutée, renommée, retirée.
   *  La charge porte le plan **entier** : il est court, et un message par pose
   *  ferait un ordre à reconstituer à l'arrivée. */
  plan: (charge: { projet: string; plan: Pose[] }) => void
  /** Ce que le projet n'envoie plus a changé (US-126). **Son propre genre** :
   *  `univers` fait redemander l'état et le catalogue depuis T4, et une case
   *  décochée n'a aucune raison de coûter deux appels réseau. */
  references: (charge: { projet: string; ecartees: string[] }) => void
  /** Le vestiaire du projet a changé — un emplacement ou une pièce ajouté,
   *  réglé, retiré (C3). La charge porte les deux listes **entières**, comme le
   *  plan et pour les mêmes raisons : elles sont courtes, et un retrait ne se
   *  devinerait pas d'un message qui ne porterait que les ajouts. */
  vestiaire: (charge: Vestiaire) => void
  /** Le cadre de l'agent ou sa consommation a changé (US-90, US-91). Un
   *  garde-fou posé depuis un autre onglet arrive par là, et le compteur bouge
   *  au moment où l'agent dépense — l'auteur n'a rien à recharger. */
  agent: (agent: EtatAgent) => void
  /** Vrai quand la liaison est vivante, faux quand elle est rompue. */
  liaison: (vivante: boolean) => void
}

export function ecouter(ecoute: Ecoute): () => void {
  const source = new EventSource("/api/events")

  const lire = <T,>(genre: string, recevoir: (charge: T) => void) =>
    source.addEventListener(genre, (message) =>
      recevoir(JSON.parse((message as MessageEvent<string>).data) as T),
    )

  lire<Etat>("etat", ecoute.etat)
  lire<Generation>("generation", ecoute.generation)
  lire<EtatCatalogueCourt>("catalogue", ecoute.catalogue)
  lire<Asset>("asset", ecoute.asset)
  lire<Bibliotheque>("bibliotheque", ecoute.bibliotheque)
  lire<Carte & { oubliee?: boolean }>("carte", ecoute.carte)
  lire<Lien & { coupe?: boolean }>("lien", ecoute.lien)
  lire<Parameters<Ecoute["univers"]>[0]>("univers", ecoute.univers)
  lire<Personnage & { supprime?: boolean }>("personnage", ecoute.personnage)
  lire<Parameters<Ecoute["plan"]>[0]>("plan", ecoute.plan)
  lire<Parameters<Ecoute["references"]>[0]>("references", ecoute.references)
  lire<Vestiaire>("vestiaire", ecoute.vestiaire)
  lire<EtatAgent>("agent", ecoute.agent)

  source.onopen = () => ecoute.liaison(true)
  source.onerror = () => ecoute.liaison(false)

  return () => source.close()
}

// ── Mise en forme des mesures ───────────────────────────────────────────────
// Virgule décimale, espace fine avant l'unité. `docs/DESIGN.md` § Typography.

export const dollars = (montant: number) =>
  `$${montant.toFixed(4).replace(".", ",")}`

// `00:08` — deux chiffres des deux côtés, chiffres de largeur fixe : le
// compteur ne doit pas changer de largeur pendant qu'on le regarde.
export const secondes = (duree: number) =>
  `${String(Math.floor(duree / 60)).padStart(2, "0")}:${String(
    Math.floor(duree % 60),
  ).padStart(2, "0")}`

export const heure = (horodatage: number) =>
  new Date(horodatage * 1000).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
