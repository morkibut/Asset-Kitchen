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
  /** **Le nom complet : qui le propose, et son nom chez lui.** Deux fournisseurs
   *  peuvent offrir un modèle du même nom — un nom seul ne dirait plus lequel a
   *  fait l'image. C'est cet identifiant-là qu'on choisit, qu'on envoie et qu'on
   *  relit sur une génération (F1). */
  identifiant: string
  nom: string
  /** Qui le propose, tel qu'on l'écrit à l'écran. Vide pour un modèle relu
   *  d'une photo de catalogue antérieure à la V2.2 — le seul cas. */
  fournisseur: string
  /** Son nom chez lui. L'écran ne s'en sert pas ; il est là pour que la fiche
   *  d'un modèle soit complète sans aller ouvrir un fichier. */
  chez_lui: string
  references_max: number
  proportions: string[]
  resolutions: string[]
  variations_max: number
  options: Record<string, Option>
  /** La raison du grisé, écrite par le domaine. L'interface l'affiche, elle ne
   *  la recalcule jamais : la règle « indisponible avec sa raison » vit côté
   *  serveur, en un seul endroit. */
  refus: string | null
  /** **D'où vient cette fiche** (F1) : `false` — relue chez le fournisseur à
   *  l'instant ; `true` — relevée ici, et `recu_le` dit quand. La règle du
   *  catalogue de T1 n'a de sens que si l'on sait de quand date ce qu'on lit. */
  repli: boolean
  /** Quand cette fiche a été reçue, en secondes epoch. Zéro : jamais reçue. */
  recu_le: number
  /** **Dans quoi ce modèle-là se paie** (F2) : `usd` pour ce qui facture,
   *  `jeton` pour ce qui consomme sans facturer. Dérivée de son fournisseur,
   *  jamais enregistrée sur la fiche. Sans elle, l'estimation affichée à côté
   *  du nom d'un modèle gratuit s'écrirait « $0,0000 » — et se lirait *sans
   *  limite* là où il faut lire *sans prix*. */
  unite: string
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
  /** Ce que cet appel-là a consommé, et en quoi (F2). `cout_usd` juste en
   *  dessous en est la part en argent — zéro dès que l'unité n'en est pas une. */
  consomme: number
  unite: string
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
  /** **Ce que le plafond du modèle a laissé au sol** (F6). Ce que le produit
   *  ajoute de lui-même — artworks du jeu, concept arts, images d'ambiance —
   *  cède devant un modèle qui n'a pas la place ; ce que l'auteur a joint ne
   *  cède jamais.
   *
   *  Vide dans l'immense majorité des appels, et vide pour tout ce qui a été
   *  fait avant F6 : l'appel était alors refusé tout entier. C'est la fiche de
   *  l'image qui le lit, des mois plus tard — sans lui, une image faite sans le
   *  style du jeu et une image faite dans un jeu sans style se liraient pareil. */
  hors_plafond: Reinjection[]
  /** L'asset dont ce lot descend — la réinjection marquée « edition ». Déduit
   *  par le serveur, jamais enregistré deux fois. */
  parent: string | null
  statut: Statut
  cout_usd: number
  /** Ce que l'appel entier a consommé, et dans quelle unité (F2). Une
   *  génération part chez un seul modèle, donc chez un seul fournisseur : il
   *  n'y a jamais deux unités à mélanger. */
  consomme: number
  unite: string
  reussies: number
  /** **Le lot de style que cet appel-là a écouté** (E14), par son nom lisible.
   *  Vide quand la chose n'en désignait aucun — le cas courant.
   *
   *  Sans lui, « ce qui est montré est ce qui part » cesserait d'être vrai en
   *  relisant une vieille image : le réglage durable de la chose aura changé, le
   *  lot de style aura été retouché, et le prompt enregistré porte le texte sans
   *  dire d'où chaque morceau venait. Absent des générations d'avant E14, et
   *  c'est la vérité — elles n'en savaient rien. */
  ambiance?: string | null
  /** Ce que cet appel-là lui a **réellement** pris, parmi `couleurs`,
   *  `references` et `textes`. Ce n'est pas le mode durable de la chose : l'écran
   *  de confirmation éteint ligne par ligne, donc un appel peut avoir pris le
   *  monde sans l'éclairage — ce qu'aucun mode ne décrit. */
  pris?: string[]
  /** **Une planche, quand l'appel en était une** (C2) — N images demandées d'un
   *  seul coup. Vide pour l'immense majorité des appels, qui visent une image.
   *
   *  C'est lui que la galerie lit pour savoir qu'une planche arrivée attend un
   *  regard : sans lui, sa tuile disparaîtrait à l'arrivée sans que rien entre
   *  en bibliothèque, et l'appel payé se perdrait sous les yeux de l'auteur. */
  pliage?: Pliage | null
  /** **Un clip, quand l'appel en était un** (A9). Vide pour tout le reste.
   *
   *  La galerie le lit pour la raison même qui lui fait lire `pliage` : un clip
   *  arrivé n'entre pas en bibliothèque — ce n'est pas une image —, et sans ce
   *  champ sa tuile disparaîtrait à l'arrivée sans que rien la remplace. */
  clip?: Clip | null
  /** La direction visée, quand l'appel en visait une. */
  direction?: string | null
  /** La chose du jeu visée, quand l'appel en visait une. */
  personnage?: string | null
  pose?: string | null
}

// ── Le post-traitement ──────────────────────────────────────────────────────
//
// Une recette, c'est six places nommées dans un ordre fixe : détourage,
// différence, recadrage, grille, quantification, bords. Ce n'est pas une liste
// que l'auteur ordonne — cinq des six étapes n'ont aucun sens avant celle qui
// les précède. `null` veut dire « place vide », et une recette dont les six
// places sont vides ne produit aucun rendu : le brut suffit.

export type Passe = {
  moteur: "bord" | "couleur" | "modele" | "trace"
  tolerance: number
  seuil_alpha: number
  durcissement: number
  /** La pipette : le pixel visé, en pixels de l'image **brute**, `[x, y]`.
   *
   *  **Un point, jamais une tache** — l'arbitrage de E3. Une tache est une zone
   *  retrouvée à chaque rendu : son rang et sa boîte bougent dès qu'une passe
   *  précédente change d'un cran, et la recette désignerait alors autre chose
   *  sans le dire. Un point ne bouge pas, parce que les passes ne font que
   *  fermer de l'alpha et que le recadrage vient après.
   *
   *  `null` tant qu'on n'a pas visé — et une pipette non visée ne retire rien. */
  point: [number, number] | null
  /** La pipette : cette zone-là, ou toutes celles de sa couleur. */
  portee: "tache" | "partout"
  /** Retirée du calcul **le temps qu'on regarde** (U10).
   *
   *  Plusieurs passes s'enchaînent et l'on ne voit que leur somme : impossible
   *  de savoir laquelle a mangé quoi. Masquer n'est pas retirer — c'est le
   *  geste de la veille d'une table (U4), un cran plus bas, et la même règle :
   *  ce qu'on éteint garde tous ses réglages, et la rallumer rend exactement
   *  l'état d'avant. */
  masquee: boolean
  /** La sélection magique : la forme entourée à main levée autour du sujet, en
   *  pixels de l'image **brute** (U12).
   *
   *  **Elle borne la recherche, elle ne la lance pas.** Le trait qu'on fait ne
   *  devient jamais le contour du sprite : l'atelier va chercher le bord du
   *  sujet *à l'intérieur* de ce qu'on a entouré, et ne touche à rien au-dehors.
   *  C'est pour ça qu'on peut trembler.
   *
   *  Vide tant qu'on n'a rien entouré — et une passe sans forme ne retire rien,
   *  comme une pipette sans point. Elle **ne voyage pas** : une coordonnée ne
   *  voyage pas, et une suite de coordonnées encore moins. */
  trace: [number, number][]
  /** Quel modèle de silhouette, quand le moteur est `modele` (U13).
   *
   *  **Vide veut dire *le défaut du produit*** — le plus rapide —, et c'est ce
   *  qui fait qu'une recette écrite avant ce champ rend exactement ce qu'elle
   *  rendait. Le catalogue vit au serveur : la recette porte le choix, elle ne
   *  tient pas la liste. */
  modele: string
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
  /** **Lire le dessus tel qu'il est arrivé du modèle**, et non tel qu'il est
   *  rangé (G16). Les deux ne diffèrent que sur un vêtement : son brut rangé
   *  est la case *déjà mise à l'échelle et calée sur son corps*, et refaire le
   *  calage en partant de là reviendrait à repartir du résultat qu'on défait.
   *  Sur toute autre image, c'est le même fichier. */
  dessus_arrivee: boolean
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
  /** Y a-t-il une case arrivée qu'on saurait retrouver pour ce dessus ? (G16)
   *  Faux sur tout ce qui n'est pas un vêtement sorti d'une planche, et faux
   *  aussi quand la planche a quitté le disque — **l'écran ne propose pas un
   *  geste qui échouera**. */
  arrivee_possible: boolean
}

/** Comment le dessus est entré dans le cadre du dessous (M1).
 *
 *  **Le cadre du dessous fait loi**, et un dessus plus grand que lui y entre
 *  entier, réduit pour tenir — il était coupé à son coin haut-gauche jusqu'au
 *  4 septembre 2026. Les quatre premières valeurs sont en pixels du cadre :
 *  c'est ce qui permet au cadre de travail de dessiner exactement l'image sur
 *  laquelle le serveur a calculé. */
export type Cadrage = {
  /** Faux dans le cas courant — deux images de même taille, ou un dessus plus
   *  petit : rien n'a été touché. */
  ramene: boolean
  facteur: number
  gauche: number
  sommet: number
  largeur: number
  hauteur: number
  source_largeur: number
  source_hauteur: number
}

/** Les deux sorties et les cinq mesures, sans rien écrire. Les images arrivent
 *  en `data:` — un aperçu n'existe nulle part sur le disque. */
export type ApercuSuperposition = {
  calque: string
  aplat: string
  mesures: MesuresCalque
  /** **Ce que l'écran a besoin de dire et de dessiner** (M1) : de combien le
   *  dessus a été réduit pour entrer, et où il se pose. Il arrive avec
   *  l'aperçu, et non à l'ouverture, parce que la bascule *telle qu'arrivée*
   *  change la taille du dessus. */
  cadrage: Cadrage
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
  directions: Direction[]
}

/** Un angle sous lequel le jeu regarde une chose (E10).
 *
 *  **Deux textes, et un seul part** : le nom se lit, la consigne part au modèle.
 *  Les confondre faisait partir « sud » au milieu d'une phrase anglaise.
 *
 *  L'identifiant ne bouge pas quand le nom change : les images faites le
 *  portent, exactement comme pour une pose. */
export type Direction = {
  identifiant: string
  nom: string
  /** Ce qui part au modèle, en anglais. Vide pour une direction qu'on vient
   *  d'ajouter : le produit ne traduit pas à la place de l'auteur. */
  consigne: string
}

/** Les directions d'un jeu, **et d'où la liste lui vient**.
 *
 *  `vue` — la liste est celle que la vue du jeu propose, et elle suivra un
 *  changement de vue. `ici` — l'auteur a renommé, retiré ou ajouté, et elle ne
 *  suit plus. Le codex écrit l'un ou l'autre : ce ne sont pas la même
 *  promesse. */
export type DirectionsDuJeu = {
  directions: Direction[]
  origine: "vue" | "ici"
  vue: string
  vue_libelle: string
  /** Ce qu'un « revenir à ce que la vue propose » remettrait. */
  proposees: Direction[]
}

/** Ce que déclarer des directions coûterait, et ce que le produit propose
 *  (US-243). **Sans elle, déclarer quatre directions ferait passer un
 *  personnage de douze cases à quarante-huit d'un coup.** */
export type PropositionDeBaisse = {
  directions: number
  poses: { pose: string; nom: string; images: number; portee: string }[]
  /** La phrase écrite, qui cite la bible quand elle porte encore le nombre. */
  raison: string
  cases_avant: number
  cases_apres: number
  /** Ce qu'un clic rendrait — vide quand il n'y a rien à défaire. */
  defaite: { pose: string; nom: string; images_avant: number }[]
}

export type TailleDImage = { cible: number; quoi: string }

export type VuesEtTailles = {
  vues: VueDuJeu[]
  /** Les tailles d'un jeu **en pixel art** — un nombre de carrés, de 8 à 512. */
  tailles: TailleDImage[]
  /** Les finesses d'un jeu **en dessin** — combien de détail garder, de 256 à
   *  2048. Deux listes et non une, parce que la même case pose deux questions :
   *  8 carrés n'a pas plus de sens pour un dessin que 2048 n'en a pour du pixel
   *  art (D2). */
  finesses: TailleDImage[]
}

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
  /** **D'où elle vient**, et l'écran s'en sert pour une seule chose : marquer en
   *  `--epingle` ce que l'auteur a nommé lui-même, comme partout ailleurs dans
   *  le produit. Une livrée arrive avec l'atelier — soixante-dix, cinq cases —
   *  et est la même chez tout le monde.
   *
   *  Elle ne change rien à ce qui part : cliquer l'une ou l'autre écrit le même
   *  texte anglais. */
  livree: boolean
  /** Une livrée retirée laisse une pierre — sans quoi le catalogue la rendrait
   *  à la lecture suivante. Elle ne sort jamais du serveur ; ce champ n'est là
   *  que parce que la forme est celle du fichier. */
  oubliee: boolean
}

/** Un mouvement de l'atelier — **ce que la même pose dit quand on l'anime** (A6).
 *
 *  Le produit savait déjà dire une pose : `walking posture, full body`. C'est
 *  une **posture figée**, juste pour une image et fausse pour un clip. Ce qui
 *  manquait n'est pas une liste de plus, c'est cette moitié-là : un cycle qui
 *  boucle, une cadence, et les directions où le mouvement existe.
 *
 *  **Il appartient à l'atelier, pas à un jeu** — comme une étiquette, et pour
 *  la même raison : il se réfléchit une fois et sert tous les jeux suivants. */
export type Mouvement = {
  /** **Il ne bouge pas quand le nom change**, comme pour une pose : c'est lui
   *  qui accroche le mouvement à la case du plan. */
  identifiant: string
  /** Le nom français — ce qu'on lit. */
  nom: string
  /** Le texte anglais — ce qui part. Les séparer est le partage de `E10`. */
  texte: string
  /** Les images par seconde de la bande. Elle voyage jusqu'au descriptif de
   *  l'export : deux réglages séparés finiraient par se contredire. */
  cadence: number
  /** Les directions où ce mouvement a un sens — **vide veut dire toutes**.
   *  Ça propose, ça n'interdit jamais : un mouvement de l'atelier ne connaît
   *  pas les directions qu'un jeu déclare. */
  directions: string[]
  /** Livré avec l'atelier, ou nommé ici. Même marque que pour une étiquette. */
  livre: boolean
  /** Masqué. Ne sort du serveur que dans la seconde liste, celle qui rend le
   *  masquage réversible. */
  masque: boolean
}

/** La bibliothèque de mouvements telle que le serveur la sert : ceux qu'on
 *  voit, et ceux qu'on a masqués et qu'on peut remontrer. */
export type BaseMouvements = {
  mouvements: Mouvement[]
  masques: Mouvement[]
}

/** Ce qui partira pour animer une case du plan, **et d'où le texte vient**.
 *
 *  La règle vit sur le serveur et **nulle part ailleurs** : l'écran ne rejoue
 *  jamais la correspondance pose ↔ mouvement de son côté. Deux endroits qui
 *  l'appareillent finiraient par ne plus s'accorder. */
export type MouvementDeLaPose = {
  pose: string
  mouvement: Mouvement | null
  texte: string
  /** `mouvement` : la case est animée par un mouvement connu. `pose` : on
   *  retombe sur la consigne figée du plan — moins bonne, mais en anglais et
   *  juste sur l'attitude. `aucun` : le produit ne sait rien dire de cette
   *  case-là, et il le dit plutôt que d'inventer un texte qui partira dans un
   *  appel payé. */
  origine: "mouvement" | "pose" | "aucun"
}

// ── L'animation par la vidéo (A9) ───────────────────────────────────────────
//
// **Un clip est une génération**, avec un emplacement unique et un champ
// `clip`. Ce n'est pas une commodité : c'est ce qui met sa dépense dans la
// barre de tête, dans le total du projet et dans l'écran des dépenses, sans
// qu'aucun des endroits qui comptent l'argent ait à apprendre qu'il existe des
// vidéos.

/** Ce qu'un modèle vidéo coûterait pour ce qu'on demande, **et d'où le chiffre
 *  sort**.
 *
 *  Un prix vidéo se *calcule* — hauteur × largeur × images par seconde × durée
 *  — au lieu de se lire dans une grille. La formule voyage donc avec le
 *  montant : un prix qu'on ne peut pas vérifier n'est pas un prix. */
export type PrixVideo = {
  /** `null` quand le tarif n'a pas pu être relu chez le fournisseur. Le modèle
   *  est alors grisé, avec sa raison — on ne propose pas ce qu'on ne sait pas
   *  chiffrer. */
  montant: number | null
  formule: string
  /** `estimation` avant l'envoi. Ce qui s'enregistre après est le montant
   *  facturé, et l'écart mesuré va jusqu'à moitié moins. */
  nature: string
  releve_le: number | null
}

/** Ce que coûte un clip quand ce qu'il coûte n'est pas de l'argent, mais du
 *  temps sur la carte graphique de la maison (A11).
 *
 *  **Ce n'est pas un prix déguisé en secondes.** Un prix s'additionne, se
 *  compare à un budget, se retrouve dans le journal des dépenses ; une attente
 *  ne fait rien de tout ça. Lui donner sa propre forme empêche l'écran de la
 *  traiter comme un montant par accident. */
export type AttenteVideo = {
  secondes: number
  /** Ce que prendra **chacun des clips d'après**, modèle déjà chargé. Il est là
   *  parce qu'on peut en lancer plusieurs d'un coup : annoncer la valeur du
   *  premier pour un lot de quatre annoncerait le tiers de l'attente réelle, et
   *  l'écran ne peut pas la déduire — ce sont deux mesures, pas un rapport. */
  secondes_suivant: number
  /** Le premier clip charge le modèle en mémoire, les suivants non — et l'écart
   *  se compte en minutes. Annoncer la valeur des suivants au premier ferait
   *  attendre le double de ce qui a été promis. */
  premier: boolean
  images: number
  /** Sur quelle machine ç'a été mesuré. Une attente sans sa machine ne veut
   *  rien dire : une autre carte ne donnera pas ce chiffre. */
  mesure: string
  nature: string
}

/** Un modèle vidéo au catalogue, tel que l'écran de commande le montre. */
export type ModeleVideo = {
  identifiant: string
  nom: string
  fournisseur: string
  durees: number[]
  resolutions: string[]
  proportions: string[]
  // ── Ce qu'`A11` ajoute, et qui vaut zéro ou vide chez un modèle payant ─────
  //
  // Écrit pour tous plutôt que pour le seul moteur de la maison : un champ qui
  // n'existe que sur certains modèles oblige l'écran à savoir lesquels, et c'est
  // un savoir qui se périme.
  /** Vrai pour le moteur qui tourne sur la machine de l'auteur. Ce qu'il change
   *  à l'écran : un temps à la place d'un prix, et un panneau qui dit ce qui
   *  manque au lieu d'une clé à déposer. */
  de_la_maison: boolean
  images_par_seconde: number
  /** La durée que ce dépôt conseille, et **la raison qui va avec**. Zéro veut
   *  dire *la question ne se pose pas pour celui-ci*. */
  duree_conseillee: number
  raison_de_la_duree: string
  /** Le nombre d'images réel pour chaque durée offerte, **calculé au serveur**.
   *  Le moteur n'accepte que certains comptes ; la règle est une contrainte du
   *  modèle et n'a rien à faire dans une interface — deux endroits qui la
   *  calculent finiraient par ne plus donner le même nombre. */
  images_par_duree: Record<string, number>
  /** **Ce que ce dépôt a mesuré de lui, et rien d'autre.** Vide veut dire *on
   *  n'en sait rien*, et l'écran l'écrit plutôt que de laisser croire qu'un
   *  modèle proposé a été éprouvé. Aucun des trois n'atteint la barre des huit
   *  tirages : ce sont des propositions étayées, pas un arbitrage clos. */
  mesure: string
  prix: PrixVideo
  /** L'attente annoncée, ou `null` chez un payant — et `null` n'est pas un
   *  trou : ce qu'un modèle payant coûte est de l'argent, et une attente
   *  inventée serait pire qu'aucune. */
  attente: AttenteVideo | null
  /** La phrase qui dit pourquoi ce modèle ne peut pas honorer la demande
   *  courante, ou `null`. **Le produit ne propose jamais pour rejeter
   *  ensuite** : ce qui est impossible se voit avant d'être choisi. */
  grise: string | null
}

/** Ce qui manque à la machine pour animer sans payer, **avec sa taille et sa
 *  licence**, avant que rien ne parte. Vingt-six gigaoctets ne se descendent pas
 *  dans le dos de quelqu'un. */
export type FichierDeModele = {
  nom: string
  famille: string
  go: number
  licence: string
  obligatoire: boolean
}

/** Ce que la carte de la maison peut faire aujourd'hui — **en trois absences
 *  qui ne se ressemblent pas** (A11).
 *
 *  1. L'application qui fait tourner le moteur n'est pas ouverte : le modèle est
 *     grisé, parce que rien ne peut partir.
 *  2. Des fichiers manquent : le modèle **reste choisissable**, et l'atelier
 *     propose de les rapatrier. Refuser obligerait à sortir pour un
 *     téléchargement que l'atelier sait faire.
 *  3. Le greffon qui garde les gros pixels manque : simple avertissement — le
 *     clip sortira, il sortira lissé. Un clip lissé se juge ; un refus non. */
export type EtatDuMoteur = {
  allume: boolean
  /** La phrase qui grise le modèle, ou `null`. **Seule la première absence la
   *  remplit** : les deux autres se disent sans empêcher. */
  grise: string | null
  /** Ce qu'il faut rapatrier, ou vide. */
  manquants: FichierDeModele[]
  go_a_telecharger: number
  greffon_absent: boolean
  /** La carte graphique telle qu'elle se nomme, et ce qui lui reste de mémoire
   *  libre. Vide quand l'application n'est pas ouverte. */
  carte: string
  memoire_libre_go: number
  /** Ce qu'il y a à dire, déjà écrit — ou la chaîne vide quand il n'y a rien à
   *  dire. Rien à dire est une réponse. */
  phrase: string
}

/** Le catalogue vidéo pour un réglage donné. Le prix dépend de ce qu'on
 *  demande : il se recalcule à chaque changement de durée ou de format. */
export type BaseModelesVideo = {
  modeles: ModeleVideo[]
  recu_le: number | null
  raison: string | null
  manque: string | null
  /** Ce qui manque pour découper un clip en images, ou `null` quand le
   *  décodeur est là. Un clip s'achète quand même sans lui — il ne se découpe
   *  pas, et il reste payé. */
  decodeur: string | null
  /** Ce qui manque à **chaque** animateur, séparément (A11). Une clé absente
   *  chez le payant ne dit rien du moteur de la maison, et une seule phrase pour
   *  les deux ferait chercher la panne du mauvais côté. */
  moteurs: {
    nom: string
    manque: string | null
    /** Rempli par les animateurs qui ont plus à dire que *disponible ou non*.
     *  C'est le cas du moteur de la maison, dont les trois absences ne se
     *  réparent pas de la même façon. */
    moteur?: EtatDuMoteur
  }[]
  demande: { secondes: number; resolution: string; proportions: string }
}

/** L'image qu'un clip prendrait au départ, **et pourquoi celle-là**.
 *
 *  Une proposition, jamais une contrainte : l'auteur en change d'un clic pour
 *  n'importe quelle image de la bibliothèque. */
export type ImageDeDepart = {
  asset: Asset | null
  /** `case` : l'image de la case visée, dont l'attitude et l'angle ont déjà été
   *  validés. `portrait` : ce que le personnage montre de lui — sa première
   *  référence promue, sinon le corps retenu de sa première attitude.
   *  `aucune` : il n'y a rien, et la raison le dit. */
  origine: "case" | "portrait" | "aucune"
  raison: string
}

/** Ce qu'une génération porte quand c'est un clip. Absent partout ailleurs —
 *  et c'est ce champ, jamais le nom du modèle, qui dit qu'un appel est vidéo. */
export type Clip = {
  /** Le numéro du travail chez le fournisseur, écrit **avant** la première
   *  attente. Sans lui, un clip payé pendant qu'on fermait l'atelier est un
   *  clip qu'on repaie. */
  travail: string
  secondes: number
  proportions: string
  resolution: string
  prix_annonce: number | null
  prix_formule: string
  /** Combien d'images le clip porte, et à quelle cadence — **mesurées sur le
   *  fichier**, jamais déduites de ce qui a été demandé. Zéro tant que rien
   *  n'est extrait, et zéro pour toujours si le décodeur manque. */
  images: number
  cadence: number
  extraction_refus: string | null
  montant_relu: boolean
  recupere: boolean
  /** Écarté d'un lot. **Il quitte la galerie, pas le journal** : ce qui a été
   *  payé reste payé, et rien n'expire — le geste se défait quand on veut. */
  jete: boolean
  /** **Le geste qui l'a lancé**, partagé par tous les clips du même lot.
   *  Écrit au serveur, jamais déduit : rapprocher quatre clips sur leur texte
   *  et leur minute marcherait presque toujours, et se tromperait le jour où
   *  l'auteur relance exactement la même chose. Vide pour les clips d'avant. */
  lot: string
  /** La phrase que l'écran écrit à côté du montant. Écrite une fois, au
   *  serveur : deux rédactions finiraient par dire deux choses. */
  montant_dit: string
}

// ── Le montage (A10) ────────────────────────────────────────────────────────
//
// **Rien de ce bloc ne dépense.** Le clip est payé, ses images sont sur le
// disque depuis son arrivée, et découper est un geste qu'on refait autant de
// fois qu'on veut. C'est ce que le pied de l'écran annonce, et c'est vrai
// jusque dans les imports du service qui répond.

/** Le rectangle sur lequel toutes les images d'une bande se recadrent.
 *
 *  Il porte **d'où il vient** en plus de ses quatre nombres : *du clip* est le
 *  défaut, et c'est le seul qui donne à toutes les bandes d'un clip la même
 *  assise — sans lui, un personnage grandit de 10 % en passant du repos à la
 *  marche (mesuré en `A2`). Les deux autres existent parce qu'un cadrage
 *  automatique se trompe parfois. */
export type Cadre = {
  choix: "clip" | "bande" | "main"
  gauche: number
  sommet: number
  droite: number
  bas: number
  largeur: number
  hauteur: number
  /** La phrase qui dit ce que ce choix-là implique. Écrite au serveur, comme
   *  toutes celles que deux endroits pourraient rédiger deux fois. */
  mot: string
}

/** Le cadre **tel qu'on l'envoie** : le choix, et les quatre nombres seulement
 *  quand l'auteur les a posés lui-même. Les envoyer toujours obligerait l'écran
 *  à connaître le rectangle du clip avant de demander quoi que ce soit, et
 *  c'est le serveur qui le mesure. */
export type CadrePose = {
  choix: string
  gauche?: number
  sommet?: number
  droite?: number
  bas?: number
}

/** La fenêtre commune, telle que le serveur l'a mesurée sur le clip entier. */
export type FenetreDuClip = {
  gauche: number
  sommet: number
  droite: number
  bas: number
  largeur: number
  hauteur: number
  /** Sur combien d'images elle a été prise. **Écrit plutôt que déduit** :
   *  l'écran doit pouvoir dire *prise sur le clip entier* ou *sur la bande*. */
  images: number
  taches_ecartees: number
}

/** Un endroit du clip que l'atelier a remarqué. **Jamais un verdict.**
 *
 *  La détection propose, l'auteur juge : c'est la règle déjà écrite de l'écran
 *  de découpe, et c'est elle qui fait qu'une machine qui s'est trompée ne
 *  bloque personne. Deux au plus, et parfois zéro — ne rien proposer est une
 *  réponse. */
export type PropositionDeRythme = {
  quoi: "repos" | "boucle"
  debut: number
  fin: number
  images: number[]
  mot: string
  mesure: number
  longueur: number
}

/** Une animation taillée dans un clip, et gardée.
 *
 *  **Ce qu'elle garde est une intention, pas des pixels** : les numéros
 *  d'image, la fenêtre et la recette. Sa planche de sprites se recalcule à
 *  partir de ça, et le fichier n'est qu'un cache. */
export type Bande = {
  identifiant: string
  clip: string
  nom: string
  /** Dans l'ordre où elles se jouent. **Rien n'oblige à ce qu'elles soient
   *  régulièrement espacées** — un pas de marche demande deux images serrées au
   *  contact et une seule pendant la glisse. */
  images: number[]
  cadence: number
  sens: "boucle" | "aller-retour"
  cadre: Cadre
  recette: Recette
  projet: string | null
  personnage: string | null
  pose: string | null
  direction: string | null
  planche: string | null
  case_largeur: number
  case_hauteur: number
  cree_le: number
  compte: number
  secondes: number
  /** Aucune case visée. Elle existe, elle sert, **elle ne bloque rien**. */
  brouillon: boolean
}

/** Tout ce que l'écran de montage reçoit à l'ouverture, **en une seule fois**.
 *
 *  Un écran qui s'ouvre en tournant déjà en boucle n'a pas le temps de poser
 *  quatre questions. */
export type Montage = {
  clip: {
    identifiant: string
    images: number
    cadence: number
    largeur: number
    hauteur: number
    secondes: number
    commande_secondes: number
    montant_dit: string
    consomme: number
    unite: string
    mouvement: string
    texte: string
    projet: string | null
    personnage: string | null
    pose: string | null
    direction: string | null
  }
  /** La géométrie de la planche contact — l'image unique où toutes les images
   *  du clip tiennent, et dont l'écran tire sa pellicule **et** sa loupe. */
  contact: { cote: number; colonnes: number; lignes: number }
  recette_du_jeu: Recette
  fenetre: FenetreDuClip | null
  propositions: PropositionDeRythme[]
  bandes: Bande[]
  /** Ce que coûte une bande utilisable de ce clip, **et il baisse à chaque
   *  bande gardée**. C'est ici que se prend le chiffre qui manque à la
   *  version : combien de clips pour une bande utilisable. */
  prix: {
    clip: number
    unite: string
    bandes: number
    par_bande: number
    si_une_de_plus: number
  }
  images_max: number
}

/** La bande montée, telle qu'elle sortira. **Une planche de sprites**, pas une
 *  liste d'images : l'écran l'anime en la décalant, l'export l'écrira telle
 *  quelle, et *ce qui sort est exactement ce que l'aperçu montrait* devient
 *  vrai par construction. */
export type ApercuDeBande = {
  planche: string
  case_largeur: number
  case_hauteur: number
  compte: number
  largeur: number
  hauteur: number
  fenetre: FenetreDuClip | null
  cadre: Cadre
  /** Ce que cette recette change à celle du jeu, **une phrase par réglage**.
   *  Vide quand la bande n'a rien changé. */
  ecarts: string[]
  /** La **première image seule**, détourée, sans cadre autour d'elle, en
   *  `data:`. Elle sert à ce que la planche ne peut pas faire : montrer le
   *  cadre **pendant qu'on le tire**. Avec le sujet en main, l'écran repose
   *  lui-même le rectangle autour de lui et n'attend le serveur qu'au
   *  relâchement ; sans lui, il faudrait une demande par pixel de glissement. */
  sujet: string | null
  sujet_largeur: number
  sujet_hauteur: number
  /** Où le sujet se pose dans son cadre : sur ses pieds, ou au milieu. **Écrit
   *  au serveur**, parce que la même règle décide du rectangle qu'on tire et de
   *  la bande qui en sortira — la poser deux fois les ferait dériver. */
  ancrage?: string
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
  dessus_arrivee: false,
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
export type Grille = {
  cible: number
  occupation: number
  ancrage: "bas" | "centre"
  /** Le décalage horizontal, en pixels de la case (E17). **Une coordonnée, pas
   *  un réglage** : il rattrape la dérive de *cette* silhouette dans sa case, il
   *  est écrit par le calibrage seul, et il ne part pas dans une recette nommée
   *  — même règle que la différence d'un calque. Zéro par défaut, de sorte
   *  qu'une recette sans calibrage rend exactement l'image d'avant. */
  decalage: number
  /** Comment on passe de mille pixels à `cible` carrés (D2).
   *
   *  **Un choix de style, pas un classement** : les quatre méthodes rendent des
   *  images franchement différentes, et c'est l'auteur qui tranche laquelle
   *  ressemble à son jeu. Le projet donne le départ (`Univers.methode_pixels`),
   *  l'image garde le dernier mot.
   *
   *  `proche` est le défaut du champ, et c'est ce que l'atelier faisait avant
   *  la tranche : une recette enregistrée avant D2 rend ainsi la même image
   *  qu'au jour où elle a été validée. */
  methode: Methode
}

/** Les deux styles graphiques d'un jeu (D2).
 *
 *  **En pixel art, la taille *est* le dessin** : 64 veut dire soixante-quatre
 *  carrés de couleur, et un personnage de 32 et un de 128 sont deux dessins,
 *  pas la même image en deux tailles. **En dessin, elle n'est qu'une finesse**
 *  — combien de détail le fichier garde —, et la réduction qui y mène n'a rien
 *  de destructeur puisqu'il n'y a aucune grille à écraser.
 *
 *  Les valeurs traversent le port telles quelles. */
export type Style = "pixel" | "dessin"

export const NOM_DU_STYLE: Record<Style, string> = {
  pixel: "en pixel art",
  dessin: "en dessin",
}

/** Les quatre façons de réduire (D2), du plus soigné au plus brut.
 *
 *  Les valeurs traversent le port telles quelles : une valeur traduite au
 *  passage est une valeur qu'on peut traduire de travers. */
export type Methode = "vote" | "pixeloe" | "lanczos" | "proche"

/** Le nom court de chaque méthode. **La même table vit dans
 *  `atelier/domaine/recette.py`**, et les deux sont tenues ensemble par un
 *  essai — comme `MOTEUR` et `DURCISSEMENT_LIVRE` avant elles.
 *
 *  **Elle double `traitement.reductions`, et c'est assumé** : celui-ci arrive du
 *  serveur et ne porte que les méthodes de *cette* machine, ce qui suffit à un
 *  choix mais pas à relire une recette. Une recette peut nommer une méthode que
 *  la machine n'a pas — écrite ailleurs, ou installée puis retirée —, et une
 *  fiche qui afficherait alors `pixeloe` en clair aurait perdu le seul mot que
 *  l'auteur comprend. */
export const NOM_DE_LA_METHODE: Record<Methode, string> = {
  vote: "vote en deux temps",
  pixeloe: "traits épaissis",
  lanczos: "réduction douce",
  proche: "au plus proche",
}

/** Ce que chaque méthode rend, en une ligne. **Le libellé vient du serveur**
 *  (`traitement.reductions`) ; ceci décrit le parti pris, ce qu'un libellé de
 *  trois mots ne peut pas porter. */
export const CE_QUE_LA_METHODE_REND: Record<Methode, string> = {
  vote: "contour net et intérieur lisible — un sprite calme",
  pixeloe: "garde les traits d'un pixel, contour plus agité",
  lanczos: "silhouette lisse, intérieur mou — proche d'un dessin réduit",
  proche: "brut : un pixel sur N gardé, les autres jetés",
}

/** Les six paliers de couleurs, et le plafond est **le côté du sprite** (D2).
 *
 *  Mesuré le 3 septembre 2026 : au-delà, l'image ne contient plus assez de
 *  teintes distinctes pour remplir la palette demandée — 32 carrés rendent 30
 *  couleurs quand on en demande 32, et 229 quand on en demande 256. */
export const PALIERS_DE_COULEURS = [8, 16, 32, 64, 128, 256] as const

export function paliersDeCouleurs(cible: number): number[] {
  const tenus = PALIERS_DE_COULEURS.filter((p) => p <= cible)
  // Jamais vide : une liste morte laisserait l'auteur sans savoir si c'est un
  // bug ou une règle.
  return tenus.length > 0 ? [...tenus] : [PALIERS_DE_COULEURS[0]]
}

// ── La hauteur d'un sujet, et le plafond levé (tranche des tailles) ──────────
//
// **Jusqu'ici rien ne pouvait être plus grand qu'un personnage.** L'occupation
// dit la part de la case que le sujet remplit, et elle était bornée à 100 % en
// douze endroits — dont ce curseur-ci. Un moulin, un arbre, une tour : le produit
// n'avait aucune façon de les demander.
//
// **Le carré ne change jamais de taille**, c'est la règle des vrais jeux 2D : ce
// qui change entre un personnage et un bâtiment est le *nombre* de carrés qu'il
// couvre. Deux tailles de pixel dans une même scène — des « mixels » — se voient
// immédiatement. Donc 300 % se lit « trois personnages », et la case grandit.
//
// Ces trois fonctions doublent celles du serveur (`atelier/domaine/recette.py`),
// et un essai les tient d'accord — l'écran a besoin de dessiner l'échantillon
// avant d'avoir posé quoi que ce soit, donc avant d'avoir une réponse.
export const CANEVAS_MAX = 2048
export const PERSONNAGES_MAX = 8

export function occupationMax(cible: number): number {
  const parLeCanevas = Math.round((CANEVAS_MAX / Math.max(1, cible)) * 100)
  return Math.max(100, Math.min(100 * PERSONNAGES_MAX, parLeCanevas))
}

export function coteDuSujet(cible: number, occupation: number): number {
  return Math.max(
    1,
    Math.round((Math.max(1, cible) * Math.max(1, occupation)) / 100),
  )
}

export function coteDuCanevas(cible: number, occupation: number): number {
  return Math.max(Math.max(1, cible), coteDuSujet(cible, occupation))
}
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
  /** Les places en veille : elles gardent leurs réglages et cessent d'agir sur
   *  l'image (U4). **Éteinte et vide sont deux états** — vider une place efface
   *  ce qu'on y avait posé, l'éteindre le garde. La liste est vide dans
   *  l'immense majorité des recettes, et le serveur la rend toujours triée pour
   *  que l'ordre des clics n'entre pas dans l'empreinte du rendu. */
  veille: Place[]
  nom: string | null
}

/** Les noms que la veille accepte — ceux des places du traitement.
 *
 *  **Ce ne sont pas les clés des tables** : la barre en compte neuf, dont deux
 *  fabriques qui n'ont pas de place dans la recette, et elle nomme le détourage
 *  `detourage` là où la recette l'écrit `passes`. Les deux listes se ressemblent
 *  assez pour qu'on soit tenté de n'en garder qu'une, et diffèrent assez pour
 *  que ce soit faux. */
export type Place =
  | "detourage"
  | "difference"
  | "recadrage"
  | "grille"
  | "quantification"
  | "bords"
  | "contours"
  | "main"

export const RECETTE_VIDE: Recette = {
  passes: [],
  difference: null,
  recadrage: null,
  grille: null,
  quantification: null,
  bords: null,
  contours: null,
  main: null,
  veille: [],
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
  point: null,
  portee: "tache",
  masquee: false,
  trace: [],
  modele: "",
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
  /** Ce que l'appel a consommé pour cette image-là, et en quoi (F2). La tuile
   *  et la fiche lisent ces deux-là plutôt que `cout_usd` seul : une image
   *  faite chez un fournisseur gratuit dit « gratuit », jamais « $0,0000 ». */
  consomme: number
  unite: string
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
  /** **Sous quel angle cette image montre sa pose** (E10). Vide n'est pas le
   *  sud : c'est une image faite avant que le jeu ne déclare ses directions, et
   *  le produit ne devine pas la sienne — elle se range dans la première avec la
   *  marque « à confirmer ». */
  direction: string | null
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
 *  **Presque aucun seuil** : le produit montre le chiffre et son jumeau, et
 *  l'auteur décide — un seuil serait un nombre inventé sur un corpus de
 *  vingt-quatre planches. Pour mémoire, sur ce corpus : les deux planches qui
 *  répétaient une pose ressortaient à 0,999 et 1,000, les vingt-deux autres
 *  plafonnaient à 0,897.
 *
 *  `remplissage` est l'exception, et il en est une parce qu'il a été mesuré
 *  (R6) : sur les 135 planches des deux bancs, une planche saine remplit sa
 *  boîte de 0,34 à 0,77 et une planche au quadrillage redessiné de 0,99 à 1,00.
 *  Rien entre les deux. */
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
  /** La part de la boîte qui reste opaque, entre 0 et 1 (R6, US-368).
   *  Absent des images d'avant R6, et c'est la vérité : personne ne l'avait
   *  mesurée. */
  remplissage?: number
  /** Où ce sujet a été pris dans sa planche — `[x0, y0, x1, y1]`, en pixels de
   *  la planche, bornes comprises. C'est ce qui permet à l'écran du choix de
   *  découper les sujets lui-même, dans l'image de la planche. */
  boite?: [number, number, number, number]
  /** Ce sujet remplit presque toute sa boîte : c'est une case, pas un
   *  personnage. Déduit par le serveur du seuil qu'il a mesuré — l'écran ne le
   *  recalcule pas, sans quoi le seuil vivrait à deux endroits. */
  pleine?: boolean
}

/** Ce qu'un appel plié a demandé, et ce que son arrivée a trouvé (C2, R6).
 *
 *  **Deux états à ne pas confondre.** `ecartees: null` veut dire *personne n'a
 *  encore regardé* ; `ecartees: []` veut dire *j'ai regardé et je garde tout*.
 *  C'est cette différence qui fait qu'une planche aux cases pleines ne peut pas
 *  entrer en silence — il faut que quelqu'un l'ait dit. */
export type Pliage = {
  nombre: number
  colonnes: number
  lignes: number
  /** La raison d'un refus, en français. Depuis R6, il n'en reste qu'un : il
   *  manque des sujets, et aucun choix ne les fabriquera. */
  refus: string | null
  /** Combien de sujets la planche portait vraiment. Zéro tant qu'elle n'est
   *  pas arrivée. */
  trouvees: number
  /** Ce que chacun mesure — dans l'ordre de lecture de la planche, et pour
   *  **tous** ceux qu'elle portait, écartés compris. */
  mesures: MesuresLot[]
  ecartees: number[] | null
  /** Combien de sujets de trop restent une fois les écartés retirés. */
  surplus: number
  /** Les numéros de ceux qui remplissent presque toute leur boîte. */
  pleines: number[]
  /** La planche est là, quelque chose cloche, et personne n'a tranché. Rien
   *  n'est entré en bibliothèque tant que c'est vrai. */
  attend_un_choix: boolean
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
   *  pour un cycle. C'est l'auteur qui le décide, jamais le produit.
   *
   *  **Son sens a changé en E10** : il ne compte plus les angles — ça, c'est la
   *  liste des directions —, mais les étapes d'un mouvement, direction par
   *  direction. */
  images: number
  /** Ce que cette attitude dit au modèle, en anglais (E10). Vide, c'est le nom
   *  qui part, comme avant — et la ligne le dit. */
  consigne: string
  /** Les directions que cette pose ne tient pas, **pour tout le jeu** : une mort
   *  n'a qu'un angle quel que soit le personnage. */
  ecartees: string[]
  /** Ce que la pose demandait avant la proposition de baisse. Zéro : rien à
   *  défaire. */
  images_avant: number
}

/** Une case dans une direction : ce qu'elle demande, et ce qui la remplit. */
export type CaseDirection = Direction & {
  images: Asset[]
  demandees: number
  /** Le compte des images faites **avant** que le jeu ne déclare ses directions.
   *  Elles se rangent dans la première, et la marque dit que c'est un rangement
   *  et non une déduction (US-242). */
  a_confirmer: number
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
  /** **Le calque que cette case sortirait dans le jeu**, pièce par pièce — la
   *  même règle que `corps`, calculée au même endroit. Une case qui n'a qu'un
   *  calque le désigne quand même : ce qui se voit n'est pas *« il y a un
   *  choix »*, c'est *« voici lequel part »*. */
  retenus: Record<string, string>
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
  /** **Le second axe de la case** (E10) : une entrée par direction tenue, avec
   *  ce qui la remplit. Vide pour un jeu qui n'a pas déclaré de directions — le
   *  mot ne paraît alors nulle part. */
  directions: CaseDirection[]
  /** Ce qui est rangé reste montré, avec sa portée : `jeu` quand c'est la pose
   *  qui le range pour tout le monde, `ici` quand c'est cette chose seule. */
  directions_rangees: (Direction & { portee: "jeu" | "ici" })[]
  /** Une image dont la direction n'existe plus. Jamais de cascade : l'orphelin
   *  se voit au lieu de retomber en silence dans la première colonne venue. */
  sans_direction: Asset[]
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
  /** Les textes qu'elle écrit pour elle seule, et ceux qu'elle éteint (E12). */
  textes: Record<string, string>
  eteints: string[]
  /** Les images fabriquées qu'elle a promues en référence permanente. */
  references: string[]
  /** Ce qu'elle s'est ajouté pour elle seule. Elles viennent après celles du
   *  type, jamais mêlées. */
  ajoutees: Pose[]
  /** Les directions qu'elle ne tient pas, pose par pose (E10) — **la portée
   *  étroite** : le dragon n'attaque que vers le sud, les autres continuent. */
  directions_ecartees: Record<string, string[]>
  /** Les poses que le calage commun laisse de côté (E17). **Ni un écart ni un
   *  rangement** : la case existe, elle se remplit, elle se compte. */
  hors_calibrage: string[]
  /** **Sa famille, lue dans son type** (E15) — et non gardée sur elle : deux
   *  vérités sur la même question auraient fini par ranger un meuble dans les
   *  décors. Le codex s'en sert pour la classer. */
  famille: "personnages" | "objets" | "decors" | "interface"
  /** Cette chose-là peut-elle porter une pièce ? Faux pour un décor et pour un
   *  bouton, et leur établi ne dessine alors **aucune** colonne d'équipement —
   *  pas une colonne grisée : ce qu'une famille ne peut pas avoir n'existe pas
   *  dans son établi. */
  equipable: boolean
}

/** Une case de la planche (E13) — une pose dans une direction.
 *
 *  **Elle sait où son image ira avant de partir**, et c'est ce qui répare la
 *  mesure du 30 août 2026 : neuf appels de personnage sur treize ne disaient pas
 *  leur pose, et le rangement se faisait à la main après coup. Une case ne peut
 *  pas exister sans dire quelle pose et quelle direction elle remplit. */
export type CaseDePlanche = {
  direction: string
  nom: string
  /** Ce qui est écrit dans cette case-là, **composé par le chemin de l'envoi**.
   *  Deux textes anglais, écrits chacun à un seul endroit : l'attitude sur la
   *  pose, l'angle sur la direction. */
  texte: string
  images: Asset[]
  pleine: boolean
  /** Sa place dans la grille — écrite par l'atelier, montrée, non modifiable :
   *  c'est elle qui permet de savoir quel morceau de l'image revenue va dans
   *  quelle direction. */
  colonne: number
  ligne: number
}

/** La grille que l'atelier posera (E13).
 *
 *  **Déduite du nombre de cases, jamais choisie** : deux planches du même compte
 *  ont la même géométrie, et la changer à la main casserait le rangement de ce
 *  qui revient. */
export type GeometrieDePlanche = {
  cases: number
  colonnes: number
  lignes: number
  /** Le côté de la feuille que le modèle rend. */
  cote_px: number
  /** Ce qu'un sujet y fait de côté, une fois découpé. */
  sujet_px: number
  /** La taille de case que le jeu impose, ou zéro. */
  cible_px: number
  /** Combien de fois la cible — le chiffre qui dit que plier ne coûte pas de
   *  qualité. */
  fois_la_cible: number
}

/** Une façon de remplir ce qui manque, et ce qu'elle coûte (E13).
 *
 *  **Le prix est celui des appels, pas celui des cases.** Trois cases et six
 *  cases ont coûté exactement le même prix le 31 août 2026 ; cinq cases en ont
 *  coûté quatre fois plus sur un appel dont rien ne distinguait le résultat. Un
 *  prix par nombre de cases montrerait du bruit comme si c'était une structure. */
export type ChoixDePlanche = {
  clef: "refaire" | "completer" | "unite"
  quoi: string
  cases: number
  appels: number
  prix: number
  par_image: number
  mesure: boolean
  /** Pourquoi ce choix-là est indisponible. Vide quand il l'est. */
  refus: string
}

/** Ce qu'un appel a coûté — une valeur, un écart, et un compte d'appels (E13).
 *
 *  **L'écart n'est pas décoratif** : c'est lui qui dit pourquoi il n'y a qu'un
 *  prix ici plutôt qu'un par nombre de cases. */
export type PrixDunAppel = {
  prix: number
  bas: number
  haut: number
  appels: number
  mesure: boolean
  /** D'où vient le chiffre. `ici` — ce que ce modèle a réellement facturé sur
   *  cette machine, la même source que la barre qui paie. `banc` — les appels
   *  payés du dépôt, quand ce modèle n'a encore rien facturé ici. Vide quand
   *  rien n'est mesuré : l'écran dit alors qu'il ne sait pas. */
  origine: "ici" | "banc" | ""
}

/** La planche d'une pose — ce qu'on achète, vu avant de payer (E13). */
export type Planche = {
  personnage: string
  personnage_nom: string
  pose: string
  pose_nom: string
  cases: CaseDePlanche[]
  geometrie: GeometrieDePlanche
  choix: ChoixDePlanche[]
  prix: PrixDunAppel
  /** Les directions déjà pleines. Les refaire ne les efface pas — elles restent
   *  en bibliothèque avec leur prix payé —, mais on aura payé deux fois pour une
   *  case, et l'écran l'écrit avant de lancer. */
  deja_pleines: string[]
  /** Ce que les bancs payés du dépôt ont trouvé — **toujours rendu**, même quand
   *  le prix affiché vient du journal de la machine. C'est le banc qui a établi
   *  que le prix ne dépend pas du nombre de cases, et cette phrase a besoin des
   *  chiffres qui la portent : deux appels d'un même modèle peuvent avoir coûté
   *  le même prix ici sans que la variance ait disparu. */
  banc: PrixDunAppel
  /** **Ce qui part en référence avec l'appel**, compté par le serveur — l'écran
   *  ne connaît ni les artworks du jeu, ni les concept arts de la chose, ni le
   *  dédoublonnage entre les trois. Le gabarit de la grille en fait partie : il
   *  part, il occupe une place dans le plafond du modèle, et il coûte. */
  jointes: CompteReferences
  /** Le modèle que ce prix chiffre — celui que le jeu désigne pour ses planches.
   *  La barre qui paie, elle, garde celui que l'auteur a choisi : sans ce nom,
   *  les deux annonceraient deux prix sans dire que ce ne sont pas les mêmes
   *  appels. Vide quand le jeu n'en désigne aucun. */
  modele: string
}

/** Une pose dans le calibrage (E17) — ce qu'elle mesure et ce qu'on lui pose.
 *
 *  **Le pourcentage est ce qu'on écrit, les pixels sont ce qu'on obtient**, et
 *  les deux ne disent pas la même chose : c'est la même règle que dans la table
 *  grille, où un pourcentage seul ment aux petites cases. */
export type PoseCalee = {
  pose: string
  asset: string
  /** La boîte du sujet, telle que la mise sur grille la regarde — après le
   *  détourage, avant la case. */
  boite: { largeur: number; hauteur: number }
  occupation: number
  /** Le décalage horizontal, en pixels de la case. **Écrit par le calibrage
   *  seul** : jamais à la main dans la table grille, jamais dans une recette
   *  nommée. */
  decalage: number
  /** L'empreinte de la recette — ce qui fait chercher une image neuve après
   *  chaque cran. */
  empreinte: string
  /** La hauteur que cette pose rend aujourd'hui. */
  rendue: number
  /** La plus haute qu'elle puisse atteindre sans sortir de sa case. C'est la
   *  plus basse de toutes qui décide de la hauteur commune. */
  plafond: number
  /** **L'occupation que le bouton écrirait sur cette pose** (R9) — calculée par
   *  le service, jamais ici : elle passe par deux bornes que l'écran aurait dû
   *  recopier, et qui auraient divergé. Une pose mise de côté garde la sienne. */
  visee: number
  /** **La hauteur qu'elle rendrait alors** (R9) — ce que dessine l'empilement
   *  « après ». Elle n'est pas toujours la hauteur commune, et c'est voulu :
   *  l'inverse d'un arrondi dépasse, et une borne du domaine peut mordre. Le
   *  dessin montre ce qu'on obtient, pas ce qu'on vise. */
  apres: number
  /** Par le bas ou au milieu — **le point autour duquel la silhouette grandit**
   *  (R9). L'agrandir autour du mauvais point la ferait flotter au-dessus du
   *  sol. */
  ancrage: "bas" | "centre"
  de_cote: boolean
}

/** Toutes les poses d'une chose, empilées dans la même case (E17).
 *
 *  **L'outil propose, il ne décide pas** : il n'existe pas de repère automatique
 *  fiable, et la reprise à la main est la moitié du travail. */
export type Calibrage = {
  personnage: string
  cible: number
  poses: PoseCalee[]
  /** La hauteur que toutes les poses retenues peuvent atteindre ensemble. */
  commune: number
  /** La pose qui l'a limitée — et limiter n'est pas s'écarter. */
  limite: string
  /** Ce que la cohérence coûte, en pixels de la case qui ne servent pas. */
  perdus: number
  /** **L'échelle déclarée par l'ensemble des poses**, en pour cent, jamais moins
   *  de 100 (tranche des tailles). Un géant déclaré à 300 % a des poses qui
   *  rendent trois fois la case, et son plafond suit. Le service la rendait
   *  déjà ; elle n'était simplement pas déclarée ici. */
  haute: number
  /** **Combien de poses le bouton changerait vraiment** (R9), et c'est la seule
   *  chose qui décide s'il s'allume. Zéro veut dire *elles y sont déjà*, et le
   *  bouton s'éteint avec sa raison — il restait allumé, invitant à un geste
   *  sans effet. */
  a_faire: number
  /** La pose que l'outil **propose** de mettre de côté, ou rien. Une seule,
   *  jamais une cascade : écarter la plus basse fait de la suivante la plus
   *  basse, et reproposer finirait par ne garder qu'une pose. */
  de_cote: string
}

/** Sur quels personnages une pièce d'équipement est posée (E15, US-284).
 *
 *  **Une pièce n'a pas d'image à elle** — le produit interdit de générer un
 *  casque sur fond vide, parce qu'un casque n'existe qu'apparu sur un corps. Son
 *  établi montre donc ce qui la porte, et ce qui manque se lit comme partout
 *  ailleurs : *posée sur 1 personnage sur 3*. */
export type PorteeDeLaPiece = {
  piece: Piece
  portee: { personnage: string; nom: string; poses: string[] }[]
  posee: number
  candidats: number
}

/** Le plan et les personnages d'un projet, **en un seul aller-retour** : une
 *  colonne de cases n'existe que par le plan qui la nomme. */
export type Production = DirectionsDuJeu & {
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

/** Ce qu'un paquet du tableau a produit (U7) — sa palette, son ambiance.
 *
 *  **Lu par le serveur dans les palettes, jamais rangé sur le paquet.** Un
 *  paquet n'a pas d'identité à lui : c'est un nom de groupe écrit sur des
 *  cartes, et il disparaît avec sa dernière carte. C'est la palette qui dit de
 *  quel paquet elle est la lecture, et l'atelier retourne la liste.
 *
 *  Les deux champs sont absents quand rien n'a été fait — un paquet qui n'a
 *  rien produit n'a pas d'entrée du tout. */
export type Fabrique = { palette?: string; ambiance?: string }

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

/** ── La fiche d'une chose du jeu (E12) ─────────────────────────────────────
 *
 *  **Le codex dit ce qui manque, la fiche dit tout le reste.** Un résumé ne dit
 *  pas ce qui part : l'établi écrivait « hérité de la bible » et cachait sept
 *  textes. Ici chacun porte son origine. */

/** Un des sept textes de style, **et d'où il vient**. */
export type ChampHabille = {
  nom: string
  /** Ce qui part vraiment — vide quand le champ est éteint. */
  texte: string
  /** `jeu` — rien n'a été changé pour cette chose. `ambiance` — le lot de style
   *  désigné fournit ce texte. `ici` — un texte propre à cette chose. `eteint` —
   *  un refus écrit, pas une case vide. `verrouille` — le réglage s'impose. */
  origine: "jeu" | "ambiance" | "ici" | "eteint" | "verrouille"
  /** Le texte que celui-ci écarte, montré barré en dessous : on doit pouvoir
   *  lire ce à quoi on a renoncé sans aller le chercher ailleurs. */
  remplace: string
  /** Le nom de l'ambiance qui donne ce texte, quand c'est elle. */
  ambiance: string
  /** Une ambiance peut-elle remplacer ce champ ? Les quatre fermées décrivent la
   *  mécanique du jeu, pas son atmosphère. */
  ouvert: boolean
  /** Les tailles de grille que ce texte annonce en toutes lettres. */
  annonce: number[]
}

export type Habillage = {
  personnage: string
  champs: ChampHabille[]
  ambiance: AmbianceDuJeu | null
  prend: string
  /** La taille de pixel que le projet impose — elle ne se change pas ici. */
  cible_px: number
  /** Les champs dont le texte annonce une autre grille que celle qui
   *  s'applique. Vide est la réponse ordinaire ; non vide est une faute que
   *  personne n'avait vue en vingt-huit appels. */
  desaccord: string[]
  palette: { nom: string; couleurs: number } | null
  /** Combien de champs sont posés sur cette chose seule — l'écart, compté. */
  poses_ici: number
  de_l_ambiance: number
}

/** Une image de référence disponible pour une chose du jeu. */
export type ReferenceDeLaChose = {
  reference: string
  /** `carte` — une carte du tableau. `asset` — une image fabriquée, promue. */
  genre: "carte" | "asset"
  provenance: string
  detail: string
  ecartee: boolean
  /** De quoi la montrer — **l'objet entier, pas une adresse** (R8). La fiche
   *  listait ses images d'exemple en lignes de texte : on les retenait ou on
   *  les retirait sans les regarder, ce qui est le contraire du geste que la
   *  section demande. C'est la même forme que sur l'écran de confirmation, et
   *  elle vient de la même fonction côté serveur.
   *
   *  `null` quand l'image a disparu entre la composition de la ligne et sa
   *  lecture : la ligne reste, elle n'a simplement pas de vignette. */
  montre:
    | { sorte: "asset"; asset: Asset }
    | { sorte: "carte"; carte: Carte }
    | null
}

export type ReferencesDeLaChose = {
  personnage: string
  lignes: ReferenceDeLaChose[]
  /** Ce que l'atelier propose de promouvoir, avec sa provenance. Il propose, il
   *  ne décide pas — et une proposition se refuse d'un clic. */
  propositions: ReferenceDeLaChose[]
  disponibles: number
}

/** ── La vitrine (E16) ──────────────────────────────────────────────────────
 *
 *  **Le codex compte des cases, la vitrine montre des images finies.** Elle ne
 *  fabrique rien, ne modifie rien, ne coûte rien — elle marque ce qu'elle voit,
 *  et une marque n'est pas un compte. */
export type Vitrine = {
  personnage: string
  /** Les fonds sur lesquels juger. **Aucune couleur libre** : ils viennent de ce
   *  que le projet possède déjà — sa bible et sa palette —, plus le damier, qui
   *  est le fond de repérage du produit et non un fond de jugement. */
  fonds: { genre: "damier" | "noir" | "palette"; couleur: string; raison: string }[]
  images: {
    asset: string
    pose: string
    /** Le nom de la chose à qui cette image appartient — c'est lui qu'on lit à
     *  la portée du monde. */
    chose: string
    largeur: number
    hauteur: number
    /** Cette image-là sort à une autre taille que ses sœurs. La couleur des
     *  écarts, jamais celle d'un échec : un jeu en cours de fabrication
     *  n'échoue pas. */
    hors_taille: boolean
  }[]
  /** La taille que la plupart des images rendent — celle qui fait référence. */
  taille_commune: number
  /** La place du mouvement, **réservée et grisée avec sa raison** plutôt
   *  qu'occupée par un lecteur posé sur zéro image. */
  mouvement: { possible: boolean; raison: string }
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

/** La case contre laquelle une hauteur se juge **quand le jeu n'en impose
 *  aucune** (tranche des tailles). Un jeu en dessin n'a pas de grille, et son
 *  barème garde pourtant des hauteurs : il faut bien un mètre pour les dessiner
 *  et pour les borner. C'est celui du serveur, `CIBLE_PAR_DEFAUT`. */
export const CIBLE_DE_REFERENCE = 64

export type Univers = {
  bible: Champ[]
  bareme: Echelle[]
  /** **Le style graphique du jeu** (D2) — la question qui commande toutes les
   *  autres. Elle décide de ce que `cible_px` veut dire : un nombre de carrés
   *  en pixel art, une finesse en dessin. Jusqu'en D2 elle n'existait pas, et
   *  se déduisait de `cible_px === AUCUNE_CIBLE` — donc d'un réglage qu'elle
   *  aurait dû commander. */
  style: Style
  /** Le côté de case imposé à ce qui rentre — ou `AUCUNE_CIBLE`.
   *
   *  **Une case, deux questions** : *combien de carrés* en pixel art, *quelle
   *  finesse* en dessin. Voir `style` juste au-dessus. */
  cible_px: number
  /** **La vue du jeu** (E8) : un choix unique qui remplit le réglage *et* la
   *  phrase de la case `vue`. Vide est une valeur — un jeu qui ne dit pas d'où
   *  il regarde ne contraint rien. */
  vue: string
  /** Combien de couleurs le pixel art du projet emploie.
   *
   *  **Il sert deux fois, et c'est voulu** : combien de teintes lire dans les
   *  artworks officiels pour en tirer la palette, et combien en garder quand il
   *  n'y a pas d'artwork du tout. Avant D2 il ne servait que la première fois —
   *  un projet sans artwork ne réduisait aucune couleur, en silence. */
  couleurs: number
  /** **La méthode de pixelisation du projet** (D2) — le départ de toute recette
   *  fabriquée à neuf. En changer ne rejoue aucune image déjà rendue, exactement
   *  comme la taille de case ou le détourage par défaut. */
  methode_pixels: Methode
  /** Déduite par calcul des artworks officiels, jamais saisie (US-54). */
  palette: string[]
  palette_empreinte: string
  /** **La couleur de fond du jeu** (D3) — celle sur laquelle on demande que le
   *  sujet soit posé, et celle que le découpage aura à retirer.
   *
   *  **Vide est une valeur, et c'est celle d'avant la tranche** : le produit
   *  demande alors *un fond plat* sans dire lequel, le modèle rend un gris
   *  clair, et le découpage mange ce qui lui ressemble — une joue grise. Une
   *  couleur franche que rien dans le jeu ne contient rend le découpage presque
   *  gratuit.
   *
   *  **Un réglage, jamais un calcul** : l'atelier *propose* — voir
   *  `fond_propose` —, l'auteur tranche. */
  fond: string
  modeles: Partial<Record<Famille, string>>
  /** **Les deux modèles d'appel** (C2). Ils ne sont pas dans `modeles`, qui est
   *  indexé par famille de *sujet* : ceux-ci répondent à une autre question —
   *  quelle sorte d'appel on fait. Produire une planche et éditer un corps ne se
   *  jouent pas chez le même modèle, mesuré le 28 août. Vides, la famille du
   *  sujet puis le catalogue reprennent la main. */
  modele_planche: string
  modele_edition: string
  /** **Le détourage par défaut, par nature d'image puis par famille** (D1).
   *
   *  Même rangement que `modeles` juste au-dessus, et ce n'est pas une
   *  coïncidence : le produit range déjà par famille le modèle par défaut d'un
   *  univers, et la recette suit le même rangement plutôt que d'inventer un
   *  vocabulaire.
   *
   *  **`null` n'est pas une passe vide**, et l'écart porte tout : *jamais
   *  réglé* laisse décider le produit — c'est ce qui fait qu'un univers écrit
   *  avant D1 rend exactement ce qu'il rendait — quand *réglé* impose ce qui est
   *  écrit. Une famille absente hérite de sa nature ; une famille présente
   *  décide, et l'écran dit d'où vient ce qui s'applique. */
  detourage_image: Passe | null
  detourage_planche: Passe | null
  detourages: Partial<Record<Famille, Passe>>
  /** Ni bible qui parle, ni palette, ni vue. Un état normal, pas une
   *  configuration manquante : « un univers vide ne contraint rien » (US-57). */
  vide: boolean
  /** **Ce que l'atelier dit de lui-même, case par case** — la grille et le
   *  calage viennent de la taille, le cadrage vient de la vue.
   *
   *  **Calculé à chaque lecture, rangé nulle part.** Ces phrases vivaient dans
   *  le texte de la case jusqu'au 1ᵉʳ septembre 2026 ; y ajouter un mot faisait
   *  de la case « du texte d'auteur », et le serveur s'interdisant d'y toucher,
   *  la phrase cessait de suivre le réglage. Une seule étiquette cliquée gelait
   *  donc la grille sur une taille qu'on venait de quitter.
   *
   *  L'écran des réglages les montre **en `--epingle`, au-dessus du texte de
   *  l'auteur et hors de son champ de saisie** : on lit ce qui part sans l'avoir
   *  tapé, et on sait lequel des deux on corrige. Une case sans phrase n'a pas
   *  d'entrée — jamais une chaîne vide, qui ferait dessiner un cadre autour de
   *  rien. */
  phrases: Partial<Record<string, string>>
}

export const UNIVERS_VIDE: Univers = {
  bible: [],
  bareme: [],
  // **`pixel` et non `dessin`** : c'est l'univers *vide* qu'on affiche avant
  // d'avoir lu le serveur, et le pixel art est le défaut historique du produit
  // — « le pixel art est le défaut, plus une limite ».
  style: "pixel",
  cible_px: 64,
  vue: "",
  couleurs: 32,
  // **`proche` et non `vote`**, et l'écart est le même que pour le détourage :
  // ceci est l'univers *vide* qu'on affiche avant d'avoir lu le serveur, pas
  // l'univers d'un projet neuf. Y mettre le défaut du produit ferait clignoter
  // l'écran sur un réglage qu'un vieux projet n'a pas.
  methode_pixels: "proche",
  palette: [],
  palette_empreinte: "",
  // **Aucun fond posé, et c'est l'état d'avant D3** : la phrase qui part est
  // celle qui partait, au caractère près.
  fond: "",
  modeles: {},
  modele_planche: "",
  modele_edition: "",
  // **Aucun détourage réglé, et c'est l'état d'un univers vide** (D1) : le
  // produit décide, avec exactement les valeurs qu'il décidait avant la tranche.
  detourage_image: null,
  detourage_planche: null,
  detourages: {},
  vide: true,
  phrases: {},
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
  provenance:
    | "artwork officiel"
    | "concept art"
    | "réinjection"
    | "image promue"
    /** **Cinquième provenance depuis E14** : une image que l'ambiance apporte.
     *  Ni un artwork du jeu — elle ne concerne que ce coin-là — ni un concept
     *  art épinglé sur la chose : la corriger là-bas la corrige pour tout ce
     *  qui s'en sert. */
    | "image de son ambiance"
  /** La portée qui l'écarte, ou rien. **Durable** — le projet, le personnage,
   *  le mode de son ambiance — ou celle de cet appel-ci, qui ne s'écrit nulle
   *  part : elle vit dans l'onglet et part avec l'appel. */
  ecartee_par: string | null
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
  /** **La bande de couleurs, quand la case est cochée** (E14). Elle compte
   *  comme le gabarit — une place dans le plafond du modèle, un coût chez ceux
   *  qui facturent au token — mais elle se décoche, elle : c'est une option de
   *  l'écran de confirmation, pas une condition de l'appel. */
  palette?: number
  /** Les images que l'ambiance de la chose apporte (E14). */
  ambiance?: number
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
  /** Ce que ce raté-là a consommé, et en quoi (F2). Un refus qui a brûlé un
   *  jeton l'a brûlé pour de bon. */
  consomme: number
  unite: string
}

/** Ce qui reste chez un fournisseur — **et d'où le chiffre vient** (F2).
 *
 *  `reste` vaut `null` quand le fournisseur n'annonce **aucune** allocation, et
 *  ce n'est pas zéro : zéro veut dire « la réserve est vide, attends demain »,
 *  `null` veut dire « ce fournisseur ne limite pas le nombre d'images ». C'est
 *  le cas des deux fournisseurs du produit aujourd'hui, mesuré par le relevé du
 *  31 août 2026 — Pollinations limite une **cadence**, pas un quota. */
export type Reserve = {
  fournisseur: string
  unite: string
  /** Ce qui est parti depuis `depuis`, dans l'unité ci-dessus. */
  consomme: number
  plafond: number | null
  reste: number | null
  /** `ici` — compté sur les appels partis de cette machine, donc un minimum ;
   *  `fournisseur` — relevé chez lui, donc un fait. L'écran l'écrit toujours. */
  source: "ici" | "fournisseur"
  /** L'heure à laquelle le compte repart, en clair. Vide : rien ne se renouvelle. */
  renouvellement: string
  /** Le délai minimal entre deux appels, en secondes. Zéro : aucun. */
  cadence_s: number
  /** L'instant depuis lequel `consomme` compte. Zéro : depuis toujours. */
  depuis: number
  /** Ce que l'appel qu'on s'apprête à lancer consommerait — posé par l'écran
   *  qui confirme seulement, et `null` sans mesure. */
  besoin?: number | null
  /** Ce qui manquerait pour le finir, ou `null` quand rien ne manque. */
  manque?: number | null
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
  /** Ce que l'appel a consommé, et en quoi (F2). En argent c'est le même
   *  chiffre que `cout_usd` ; autrement c'est le seul des deux qui dise
   *  quelque chose. */
  consomme: number
  unite: string
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
  /** Ce que la rafale a consommé, et en quoi. Six relances gratuites brûlent
   *  six jetons : c'est là que cette marque est le plus utile. */
  consomme: number
  unite: string
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
  par_modele: {
    modele: string
    cout_usd: number
    consomme: number
    unite: string
    appels: number
  }[]
  /** Ce qui s'est consommé **sans argent**, une ligne par unité (F2). Jamais
   *  ajouté au total : *un total en argent ne compte que de l'argent*. Vide
   *  tant qu'aucun appel gratuit n'est parti. */
  par_unite: { unite: string; quantite: number; appels: number }[]
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
  /** Un pixel **qui appartient vraiment à la zone**, `[x, y]`. Le centre de la
   *  boîte n'y est pas dès qu'elle est courbe : un croissant de fond entre un
   *  bras et un torse a son centre géométrique dans le bras, et une pipette
   *  visée là retirerait le sujet. */
  point: [number, number]
}

/** **Le pas sur lequel le modèle a peint — ou la raison de renoncer** (D2).
 *
 *  `pas` vaut zéro quand la détection renonce, et `raison` dit alors pourquoi,
 *  en français et à l'auteur. Les deux ne se contredisent jamais : il n'y a
 *  qu'une lecture à faire, `pas >= 2 && raison === null`.
 *
 *  `nettete` dit à quel point le profil de l'image se répète ; `peigne` dit si
 *  ce qui se répète tombe bien sur les multiples du pas. Une netteté haute avec
 *  un peigne bas est le portrait exact d'une peinture — et c'est l'état que la
 *  mesure d'avant prenait pour une grille.
 *
 *  `carres` est le côté de l'image compté en cases de ce pas-là : c'est la
 *  lecture dont l'auteur a besoin, puisque la taille se règle en carrés et non
 *  en pixels de l'image reçue. */
export type GrilleDuModele = {
  pas: number
  nettete: number
  peigne: number
  carres: number
  /** **Où la grille commence**, `[ligne, colonne]` (D4). Le pas seul ne suffit
   *  pas à poser un trait dessus : une grille de modèle ne commence jamais au
   *  pixel zéro, et un contour calé au mauvais départ tombe à cheval sur deux
   *  blocs. Deux nombres et non un — rien ne garantit que les deux directions
   *  commencent au même endroit. `[0, 0]` quand la détection renonce, ce qui est
   *  sans conséquence : on ne s'en sert pas. */
  phase: [number, number]
  raison: string | null
}

/** **Ce que l'atelier proposerait comme fond à ce jeu-là** (D3).
 *
 *  `couleur` vide veut dire *aucun candidat sûr*, et `raison` dit alors
 *  pourquoi. Il n'y a qu'une lecture à faire : `couleur !== "" && raison ===
 *  null`.
 *
 *  `ecart` est la distance du candidat à la couleur du jeu la plus proche, dans
 *  la distance du détourage — celle qui décide si un pixel est mangé avec le
 *  fond. Il ne sert pas à décider, il sert à comprendre : 200 dit *hors de tout
 *  danger*, 90 dit *ça passe de justesse*. `voisine` est cette couleur-là. */
export type FondPropose = {
  couleur: string
  nom: string
  ecart: number
  voisine: string
  raison: string | null
}

/** **Ce qu'une image revenue dit du fond sur lequel elle a été demandée** (D3).
 *
 *  `fond` est la couleur **telle qu'elle est revenue**, lue sur les bordures —
 *  jamais celle qu'on avait demandée : comparer la couleur demandée à elle-même
 *  n'aurait rien mesuré.
 *
 *  `frange` compte les pixels à demi transparents que le détourage a laissés —
 *  ce qui fabrique un halo. `colles` compte les pixels **gardés** encore à
 *  portée de tolérance du fond : ceux qu'un cran de plus aurait mangés, donc le
 *  prix exact d'un fond mal choisi. `part_collee` les rapporte au sujet, parce
 *  que six cents pixels ne disent pas la même chose sur un sprite de 64 et sur
 *  une image de 1024. */
export type MesuresDuFond = {
  fond: string
  sujet: number
  bord: number
  frange: number
  colles: number
  part_collee: number
}

/** Sept mesures, et aucune n'est un réglage : elles décrivent ce que l'image
 *  contient, et c'est l'auteur qui décide. */
export type TachesDeLAsset = {
  /** De la plus petite à la plus grande — l'ordre du seuil. */
  taches: Tache[]
  /** Combien la liste en a coupé. **Dit, jamais tu en silence.** */
  coupees: number
  /** **Le fond que le sujet enferme et qu'aucune tolérance n'atteint**, de la
   *  plus grande à la plus petite — donc encore *opaque* dans l'image. C'est ce
   *  que la pipette existe pour retirer. Coupée court : le détourage n'en fait
   *  pas un inventaire, il en propose une. */
  poches: Tache[]
  /** Combien il y en avait en tout. **Ce qui est coupé se dit** — une image
   *  bruitée en porte des milliers d'un pixel. */
  poches_total: number
  /** Les **trous de la silhouette** — le transparent que le sujet entoure, donc
   *  l'exact inverse des poches. C'est ce que le contour longe, ou pas. */
  trous: Tache[]
  /** Les valeurs d'occupation où l'image change vraiment. */
  crans_occupation: number[]
  /** **Les deux lectures d'une même hauteur**, et le plafond de cette case-là
   *  (tranche des tailles). L'auteur les a demandées ensemble : un nombre de
   *  carrés est ce que réclament les moteurs de jeu, un nombre de personnages
   *  est ce qui se lit quand on décrit un monde. `sujet` est la hauteur du
   *  sujet, `carres` celle de la case — elles se séparent en dessous de 100 %,
   *  où un objet tenu occupe 26 carrés dans une case de 64. */
  hauteur: {
    carres: number
    personnages: number
    max: number
    sujet: number
  }
  /** **La grille sur laquelle le modèle a peint**, mesurée sur l'image détourée
   *  et avant toute mise sur grille (D2). Elle répond à la question que la
   *  table posait sans pouvoir y répondre : *sur quoi est-ce que je travaille ?* */
  grille_du_modele: GrilleDuModele
  /** **Les deux mesures d'acceptation du fond** (D3) — celles qui ont remplacé
   *  le banc de la tranche, tranché par l'auteur le 2 septembre 2026. */
  fond: MesuresDuFond
  /** Aucun pixel transparent — donc **aucun bord de sujet à tracer**. C'est le
   *  seul cas où la table des contours est indisponible. */
  opaque: boolean
  /** Ce que chaque couche de la septième place change (E5) — des **pixels
   *  touchés** sur l'opacité, des **pixels posés** sur un calque de dessin.
   *  `null` quand la place est vide : l'écran se tait alors, plutôt que
   *  d'écrire des zéros pour une table qu'on n'a pas ouverte. */
  main: { opacite: number; calques: number[] } | null
  /** La couleur sous le point de chaque pipette, **une case par passe**, dans
   *  l'ordre des passes. `null` là où la passe n'est pas une pipette ou n'a pas
   *  encore été visée.
   *
   *  Elle est mesurée et non rangée dans la recette : une couleur écrite à côté
   *  du point qui la porte est une copie que plus rien ne met à jour. */
  visees: (string | null)[]
  /** Ce que la table de recadrage lit sur l'image (U2). */
  recadrage: MesuresRecadrage
}

/** Ce que le recadrage garde et ce qu'il jette — **cinq lectures, aucun
 *  réglage** (U2).
 *
 *  La table portait un curseur de marge et rien d'autre : le rectangle tracé
 *  existait dans le modèle depuis T2 sans qu'aucun écran l'écrive, et rien ne
 *  disait ce que le cadrage gardait. C'est ce que ces mesures rendent. */
export type MesuresRecadrage = {
  /** La taille de l'image d'origine, `[largeur, hauteur]`. */
  origine: [number, number]
  /** **La boîte du sujet, mesurée sur l'alpha** — le plus petit rectangle qui
   *  contient tout ce qui n'est pas transparent. Elle se recalcule à chaque
   *  fois que le détourage change, et c'est ce qu'on veut. `null` quand il ne
   *  reste rien d'opaque. */
  sujet: [number, number, number, number] | null
  /** **La boîte tracée à la main**, figée dans le repère de l'image d'origine,
   *  ou `null`. Elle ne bouge plus, même si le détourage change. */
  tracee: [number, number, number, number] | null
  /** **Ce qui est réellement gardé** — la boîte de départ élargie de la marge
   *  et rognée sur les bords de l'image. C'est le rectangle que le rendu
   *  entoure, et il n'est pas toujours celui qu'on a tracé. */
  obtenue: [number, number, number, number] | null
  /** La part de l'image d'origine qui ne contient pas le sujet, de 0 à 1.
   *  **C'est la mesure utile de cette table** : elle explique pourquoi un
   *  sprite paraît flou après la grille. */
  jete: number
  /** Les bords de l'image d'origine que le sujet touche — *le modèle l'a peint
   *  coupé*, et la marge vaudra zéro de ce côté-là. */
  bords: string[]
  /** Ce qu'une boîte tracée retire du sujet, côté par côté, en pixels. Vide
   *  quand elle est plus large que lui : **une boîte n'agit que quand elle
   *  coupe**. */
  coupe: Record<string, number>
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

/** Ce qu'une proposition de découpe a de commun aux deux familles d'images —
 *  et **c'est tout ce que l'écran en lit**. Il montre les rectangles et la
 *  raison ; d'où vient l'image, il le sait déjà par le sujet qu'on lui a donné.
 *
 *  `raison` est le grisé du produit : une détection qui ne trouve rien dit
 *  pourquoi, elle ne se tait pas. */
export type Decoupable = {
  boites: Boite[]
  raison: string | null
}

/** Ce que le serveur propose de découper d'une planche — rien n'est créé tant
 *  qu'on ne l'a pas demandé. */
export type Proposition = Decoupable & {
  asset: string
  label: string
  largeur: number
  hauteur: number
  mode: ModeDecoupe
}

/** La même chose d'une carte du tableau d'inspiration. **`carte` et non
 *  `asset`, et le mot compte** : les deux familles d'images ne se confondent
 *  pas, et un morceau de carte est une carte. */
export type PropositionDeCarte = Decoupable & {
  carte: string
  largeur: number
  hauteur: number
  mode: ModeDecoupe
}

/** Ce que la palette lit d'une carte promue.
 *
 *  **`entiere` n'est pas un détail** : quand le détourage a tout mangé — une
 *  matière plein cadre, une texture sans bord franc —, la palette reprend
 *  l'image entière. Écrire « 0 % » serait alors faux au sens exactement
 *  inverse de ce qui se passe. */
export type LectureDePalette = {
  carte: string
  part: number
  entiere: boolean
  largeur: number
  hauteur: number
}

export type Filtre = {
  collection: string | null
  favoris: boolean
  recherche: string
}

export const FILTRE_VIDE: Filtre = { collection: null, favoris: false, recherche: "" }

export const filtreActif = (filtre: Filtre) =>
  filtre.collection !== null || filtre.favoris || filtre.recherche.trim() !== ""


// ── Ce qui part, ligne par ligne — l'écran de confirmation (E14) ────────────
//
// Il s'intercale entre le bouton et la dépense. Il ne montre pas un résumé : le
// texte exact, mot pour mot, et chaque image jointe, chacun sur sa ligne, avec
// un interrupteur. Ce qui est éteint ne part pas ; ce qu'on corrige **ne vaut
// que pour cet appel** et ne remonte nulle part.

/** Une chose qui part — un texte du jeu, un texte de son ambiance, le sujet, la
 *  consigne de la case, les consignes d'une planche.
 *
 *  **`allumee` est calculé, jamais stocké.** Une ligne s'éteint parce qu'on l'a
 *  éteinte, ou parce qu'une couche plus haute a gagné — et c'est ce qui fait
 *  qu'éteindre les trois lignes d'une ambiance rallume les textes du jeu *d'eux-
 *  mêmes* : ils redeviennent la couche la plus haute qui reste. */
export type LigneQuiPart = {
  /** `groupe.nom` — unique dans tout l'écran. Deux couches peuvent porter le
   *  même champ, et ce sont deux lignes avec deux interrupteurs. */
  clef: string
  groupe: "jeu" | "ambiance" | "sujet" | "planche" | "jointes" | "cadrage"
  nom: string
  texte: string
  /** Ce qui précède le texte dans le prompt — `Lighting`, `World`. Vide pour le
   *  sujet et pour les consignes de planche, qui n'en portent pas. */
  intitule?: string
  /** D'où il vient, pour savoir où aller le corriger **durablement**. */
  origine: string
  allumee: boolean
  eteignable: boolean
  /** Pourquoi une ligne ne s'éteint pas. **Le carré n'est pas absent** : ce qui
   *  est indisponible se montre avec sa raison, il ne se cache pas. */
  raison?: string
  /** Ce que ce texte-là écarte, montré barré en dessous. */
  remplace: string
  /** La clef de la ligne qui l'a supplantée — vide quand elle est simplement
   *  éteinte. Les deux se lisent différemment : *remplacé* dit qu'il y a mieux
   *  au-dessus, *éteint* dit qu'on n'en veut pas. */
  remplacee_par: string
  corrigee: boolean
  /** Cette correction a-t-elle une case où se garder durablement ? Le texte
   *  d'une ambiance sert plusieurs choses du jeu : le garder « sur cette
   *  chose-là » n'aurait pas de destination. */
  gardable: boolean
  /** La taille que le texte annonce contre celle qui s'applique — écrit **sur
   *  la ligne**, jamais en bandeau. */
  avertissement?: string
}

export type ImageQuiPart = LigneReference & {
  cochee: boolean
  /** Cochée au-delà du plafond du modèle : grisée avec son compte, jamais
   *  retirée — on choisit lesquelles enlever. */
  hors_plafond: boolean
  /** Le numéro que le texte donne à cette image (R7) : le prompt écrit
   *  « Image 3 — STYLE REFERENCE », et la ligne porte le même 3. `null` quand
   *  l'image ne part pas — décochée, ou au-delà du plafond du modèle : elle n'a
   *  alors pas de numéro dans le texte non plus. */
  rang: number | null
  /** Ce que cette image ajoute au prix de l'appel, **mesuré sur ce que cette
   *  machine a payé**. `null` quand la machine n'a pas de quoi le mesurer : le
   *  produit dit alors qu'il ne sait pas. */
  prix: number | null
  /** De quoi la montrer — **l'objet entier, pas une adresse** (U9).
   *
   *  L'écran qui décide de ce qui part ne montrait aucune image : les
   *  références y étaient des lignes de texte avec un prix. Il reçoit désormais
   *  l'asset ou la carte, et nomme l'adresse avec les fonctions qu'il a déjà —
   *  `sujetAsset`, `sujetCarte`, `vignetteAsset`. Une adresse toute faite
   *  envoyée par le serveur aurait posé un second vocabulaire d'adresses, que
   *  la première empreinte ajoutée ferait diverger.
   *
   *  `null` quand l'image a disparu entre la composition de la ligne et sa
   *  lecture. La ligne reste — elle dit ce qui partirait —, elle n'a
   *  simplement pas de vignette. */
  montre: { sorte: "asset"; asset: Asset } | { sorte: "carte"; carte: Carte } | null
  /** **Le morceau de légende qui parle d'elle** (M4), recopié tel qu'il part.
   *
   *  Le bloc *« Image 1 — …, Image 2 — … »* est du texte qui va au modèle : il
   *  se lit donc en entier, en haut, dans l'ordre où il est assemblé. Il est
   *  **recopié** sous chaque image, jamais déménagé — l'écran promet de montrer
   *  ce qui part mot pour mot. En haut *ce qui part*, en bas *ce que ça décrit*.
   *
   *  Vide pour une image qui ne part pas : elle n'a pas de rang, donc pas de
   *  ligne dans la légende. */
  legende: string
}

/** **La troisième image d'une planche, et laquelle des deux c'est** (M4).
 *
 *  Elle ne vient pas de la bibliothèque : le produit la redessine à chaque
 *  appel. Deux sortes, et elles demandent l'inverse l'une de l'autre — un
 *  *gabarit* est une grille vide où le modèle posera des sujets, une *planche*
 *  est la feuille déjà dessinée qu'on lui redonne à modifier.
 *
 *  **Le rôle vient du serveur.** L'écran ne recevait qu'un nombre, il a donc
 *  gardé les mots du plus ancien des deux cas, et il annonçait un gabarit à
 *  remplir à quelques centimètres d'un texte qui demandait de modifier la
 *  planche existante — au moment précis où l'on décide de payer. */
export type PlancheQuiPart = {
  role: "gabarit" | "planche"
  /** Le numéro que le texte lui donne, comme aux autres images. */
  rang: number
  /** Ce qu'elle est, en français : *la planche du corps, que le modèle doit
   *  modifier*, ou *le gabarit de la grille, qui dit au modèle où poser les N
   *  sujets*. Écrit par le serveur, qui est le seul à savoir laquelle c'est. */
  nom: string
  /** Pourquoi elle n'a pas de case à cocher. **Une ligne sans case, pas une
   *  case grisée** : une case grisée aurait demandé de comprendre pourquoi elle
   *  l'est ; une ligne sans case dit qu'il n'y a rien à décider. */
  raison: string
  legende: string
  prix: number | null
}

export type OptionQuiPart = {
  clef: string
  nom: string
  texte: string
  detail: string
  allumee: boolean
  /** Grisée avec sa raison, jamais absente — l'absence n'apprend rien. */
  refus: string
}

export type PrixDeLEnvoi = {
  total: number | null
  /** Combien d'appels celui-ci demandera. */
  appels: number
  /** Ce que les cases cochées pèsent dans le total. */
  images: number | null
  /** La mesure, **rendue à côté du prix et jamais fondue dedans** : une phrase
   *  se cite avec les nombres qui la portent. `mesure.appels` dit sur combien
   *  d'appels payés le prix repose. */
  mesure: {
    /** **Dans quoi tous les chiffres de ce bloc sont écrits** (F2). `usd`
     *  partout où le fournisseur facture ; autre chose quand il consomme sans
     *  facturer, et alors `total` n'est pas un prix mais une quantité. */
    unite: string
    prix: number | null
    bas: number
    haut: number
    appels: number
    base: number | null
    par_image: number | null
    sur_base: number
    sur_jointes: number
  }
}

/** Une des trois parties du texte qui part (R7) — le contexte, les références,
 *  la demande.
 *
 *  `titre` est le mot que le fournisseur reçoit, en majuscules et en anglais
 *  (`CONTEXT`, `REFERENCES`, `REQUEST`) ; `nom` et `propos` sont ce que l'écran
 *  écrit en français. `texte` est le contenu **sans** son titre : le texte
 *  entier est leur jonction, titres compris, et il est rendu à part.
 *
 *  Une partie vide n'est pas rendue du tout. Un texte repris à la main n'en
 *  fait qu'une, sans titre : il part mot pour mot. */
export type PartieQuiPart = {
  clef: "contexte" | "references" | "demande"
  titre: string
  nom: string
  propos: string
  texte: string
  repris: boolean
}

export type Envoi = {
  texte: string
  parties: PartieQuiPart[]
  lignes: LigneQuiPart[]
  groupes: {
    clef: string
    nom: string
    /** La partie du texte où ce groupe atterrit (R7). **Absente pour les deux
     *  groupes qui ne sont pas du texte** — les images et les options : ils se
     *  lisent sous le sommaire des parties, là où ils ont toujours été. */
    partie?: "contexte" | "references" | "demande"
    allumees: number
    total: number
  }[]
  images: {
    lignes: ImageQuiPart[]
    places: number
    cochees: number
    /** Le numéro que le texte donne au gabarit et à la bande de couleurs (R7).
     *  `null` quand l'image ne part pas — elle n'a alors pas de numéro dans le
     *  texte non plus. */
    rang_gabarit: number | null
    rang_palette: number | null
    /** L'image que la planche joint, décrite comme les deux autres (M4).
     *  `null` quand l'appel n'en joint aucune. */
    jointe: PlancheQuiPart | null
    /** Combien partiront vraiment (F6). Égal à `cochees` sauf chez un modèle
     *  qui n'a pas assez de places : ce que le jeu ajoute de lui-même cède
     *  alors, et le sommaire des groupes lit ce chiffre-ci. Calculé par le
     *  serveur, comme le prix et la réserve qui le lisent aussi. */
    partent: number
    gabarit: number
    palette: number
    prix: number | null
    avertissements: { clef: string; texte: string }[]
  }
  options: OptionQuiPart[]
  /** Ce qui agira **au retour**, en gris : rien de tout ça ne part au modèle et
   *  rien ne coûte un centime — mais l'image qu'on verra n'est pas celle que le
   *  modèle envoie. */
  retour: { nom: string; detail: string }[]
  avertissements: { clef: string; texte: string }[]
  prix: PrixDeLEnvoi
  /** Ce qui reste chez le fournisseur de ce modèle-là, **avant de partir**
   *  (F2). `null` quand il compte en argent : l'argent a la barre de tête et la
   *  ligne de prix, et une seconde réserve en dollars serait un second endroit
   *  à tenir d'accord. `manque` porte ce qui manquerait pour finir ce lot-ci. */
  reserve: Reserve | null
  modele: {
    identifiant: string
    nom: string
    references_max: number
    fournisseur?: string
  }
  ambiance: {
    nom: string
    prend: string
    textes: boolean
    references: boolean
    couleurs: boolean
  } | null
  cases: number
  caracteres: { total: number; sujet: number; eteints: number }
  corrections: number
  /** **Le fond de cet appel-ci, et ce qu'il interdit** (D3).
   *
   *  `couleur` est celle sur laquelle l'appel part — celle du jeu, ou celle
   *  qu'on vient de corriger ici. Elle est **déjà** dans le texte, dans la case
   *  `technique` : ce champ ne la double pas, il la nomme, pour que l'écran
   *  puisse en dessiner la pastille sans relire de l'anglais.
   *
   *  `interdiction` est le second texte qui part — celui du champ que les
   *  adaptateurs replient sous *« Do not include: »*. C'est le seul morceau de
   *  ce qui part que le texte ne contient pas ; sans lui, l'écran qui promet de
   *  tout montrer aurait un angle mort.
   *
   *  `corrige` dit si la couleur vient d'ici plutôt que du jeu — **et la
   *  correction ne remonte nulle part** : la poser durablement est un second
   *  geste, qui passe par le codex. */
  fond: {
    couleur: string
    interdiction: string
    du_jeu: string
    corrige: boolean
    propose: FondPropose
  }
}

/** Ce que l'écran de confirmation renvoie — **et qui ne vaut que pour cet
 *  appel**. Il ne porte que des écarts : les lignes éteintes à la main, celles
 *  rallumées, les textes corrigés. Tout le reste se recalcule. */
export type Tri = {
  eteints: string[]
  allumes: string[]
  textes: Record<string, string>
  /** **La couleur de fond corrigée pour cet appel-ci** (D3).
   *
   *  **Un quatrième écart, et il ne se range pas dans `textes`** : le fond n'est
   *  pas une ligne du texte, c'est un réglage qui en *fabrique* une — la phrase
   *  de calage — et qui fabrique en plus la phrase d'interdiction, laquelle part
   *  dans un autre champ de la demande. Le corriger en tapant dans la ligne
   *  aurait changé l'une sans l'autre, et l'appel serait parti en demandant un
   *  fond magenta tout en interdisant le cyan.
   *
   *  `null` — ou absent — laisse le fond du jeu ; `""` le retire pour cet
   *  appel, ce qui est un geste légitime quand on veut comparer avec ce que le
   *  jeu rendait avant. */
  fond?: string | null
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
  /** **Comment l'image est venue** (D1) : toute seule, ou dans une planche
   *  qu'on a découpée. C'est ce qui décide lequel des deux défauts de détourage
   *  s'est appliqué. Vide quand la génération n'est plus sur le disque. */
  nature: Nature | ""
  /** **Le défaut de détourage qui s'applique, et d'où il vient** (US-410).
   *
   *  `null` quand le projet n'impose rien du tout — sans projet, ou pour une
   *  image entrée « telle quelle » : il n'y a alors pas de défaut à montrer, et
   *  afficher celui du produit ferait croire qu'il s'applique. */
  detourage: {
    passe: Passe
    origine: Origine
    /** La famille du sujet, quand l'échelle en nommait une. */
    famille: string
  } | null
}

/** **Comment une image est venue** (D1). Deux, et deux seulement : ce qui
 *  arrive tout seul, et ce qui arrive dans une planche qu'on découpe.
 *
 *  Ce n'est pas un axe de rangement à côté de la famille — la famille dit *ce
 *  que l'image montre*, la nature dit *comment elle est venue*. Une même
 *  créature détourée depuis une planche de huit attitudes et détourée seule
 *  sont la même famille et deux natures. */
/** Les quatre façons de désigner ce qu'on retire. Nommées à part parce que
 *  plusieurs écrans en parlent — les tables, et depuis D1 les défauts de
 *  l'univers — et qu'écrire l'union deux fois, c'est la voir diverger. */
export type Moteur = Passe["moteur"]

export type Nature = "image" | "planche"

export const NOM_DE_LA_NATURE: Record<Nature, string> = {
  image: "une image seule",
  planche: "un morceau de planche",
}

/** D'où vient le défaut qui s'applique (D1). **Trois niveaux, et le produit
 *  ferme la marche** : il n'y a jamais de trou, seulement un réglage qu'on n'a
 *  pas posé — la phrase exacte du modèle par famille (US-58). */
export type Origine = "famille" | "nature" | "produit"

/** Ce qu'on envoie pour poser un détourage par défaut (D1).
 *
 *  **Ce n'est pas une `Passe` entière**, et l'écart est la décision : une passe
 *  porte en plus le point de la pipette, le tracé à main levée et le masquage,
 *  qui vivent dans les pixels d'une image précise. Un défaut s'applique à la
 *  première image venue ; les lui laisser porter n'aurait aucun sens. Le
 *  serveur les retire déjà à la relecture — les tenir absents d'ici rend la
 *  chose impossible à écrire plutôt qu'à nettoyer. */
export type DefautDetourage = {
  moteur: Passe["moteur"]
  tolerance: number
  seuil_alpha: number
  durcissement: number
  /** Quel modèle de silhouette, quand le moteur est `modele` (U13). Celui-là est
   *  bien un défaut : il ne désigne rien dans l'image, il nomme l'outil. */
  modele: string
}

/** Ce que le post-traitement peut faire **sur cette machine**, et ce qu'il ne
 *  peut pas. Chaque raison est écrite par le serveur : l'interface l'affiche,
 *  elle ne rejoue jamais la règle de son côté. */
/** Un modèle de silhouette du catalogue (U13).
 *
 *  **Le catalogue décide, jamais une liste en dur** — la règle du dépôt pour les
 *  modèles d'image, appliquée ici pour la même raison. L'écran le lit, il ne le
 *  recompose pas.
 *
 *  `raison` et `descendu` disent **deux absences différentes**, et c'est tout
 *  l'arbitrage : un moteur *pas installé du tout* porte une `raison` et se
 *  grise ; un modèle *pas encore descendu* reste choisissable et annonce ce
 *  qu'il va rapatrier. Griser les deux aurait obligé à sortir de l'atelier pour
 *  un téléchargement que l'atelier sait faire. */
export type Silhouette = {
  nom: string
  titre: string
  octets: number
  lent: boolean
  note: string
  /** **Le côté auquel le modèle infère** (D4), et il ne se confond pas avec la
   *  taille de l'image qu'on lui donne. `u2net` ramène tout à 320 × 320,
   *  calcule là-dessus, puis réagrandit son masque en Lanczos : sur une image de
   *  1024, c'est une carte de 320 étirée trois fois — ce qui est plus fin que
   *  trois pixels disparaît, et le rebond fabrique des demi-transparences *à
   *  l'intérieur* du sujet. Les autres infèrent à 1024. Ce nombre-là décide de
   *  ce qu'un modèle peut rendre, et il n'était nulle part. */
  entree: number
  /** La licence du modèle, pas celle de `rembg`. Écrite parce que la question
   *  s'est posée une fois et se reposera. */
  licence: string
  defaut: boolean
  descendu: boolean
  raison: string | null
}

export type EtatTraitement = {
  moteurs: { nom: Passe["moteur"]; raison: string | null }[]
  silhouettes: Silhouette[]
  /** **`raison` ne vaut plus jamais autre chose que `null`** depuis D2, et la
   *  clé est gardée parce qu'elle est l'endroit où le grisé se rallumerait.
   *
   *  `note` l'a remplacée, et la différence porte tout : le grisé *interdisait*
   *  — sans artwork officiel, un projet ne réduisait aucune couleur et rendait
   *  des sprites à dix mille teintes sans un mot. La note *annonce* : le
   *  traitement a bien lieu, mais les couleurs viennent de chaque image et non
   *  de la palette du jeu. `null` dès qu'une palette existe. */
  quantification: { raison: string | null; note: string | null }
  /** Les quatre façons de réduire, avec leur raison de grisé (D2). Trois ne
   *  demandent rien ; « traits épaissis » tire une bibliothèque lourde et se
   *  grise quand elle manque — jamais proposée puis refusée. */
  reductions: { nom: Methode; libelle: string; raison: string | null }[]
  recettes: string[]
}

/** Une place à remplir chez un fournisseur (F3).
 *
 *  **Jamais la valeur** : `apercu` porte les six derniers caractères, et c'est
 *  tout ce qui sort du serveur depuis T1. */
export type EtatSecret = {
  /** Le nom d'environnement — c'est lui qu'on passe pour déposer ou retirer. */
  nom: string
  /** Comment on en parle, article compris : « la clé », « le jeton ». */
  libelle: string
  /** Où on l'obtient, en clair. Vide quand il n'y a rien à dire. */
  ou: string
  presente: boolean
  /** `environnement` | `fichier` | `absente`. */
  origine: string
  apercu: string
  /** Peut-on l'enlever d'ici ? Non pour une valeur venue de l'environnement :
   *  le produit n'écrit pas dans l'environnement de la machine, et un bouton
   *  qui semblerait retirer sans rien retirer serait pire que pas de bouton. */
  retirable: boolean
}

/** Les places d'**un** fournisseur, et ce qui lui manque (F3).
 *
 *  Un fournisseur qui ne demande rien y paraît avec un tiroir vide : « celui-ci
 *  ne demande rien » est un renseignement, et c'est le premier que l'auteur
 *  cherche sur une machine neuve. */
export type Tiroir = {
  fournisseur: string
  secrets: EtatSecret[]
  /** La même phrase que le grisé de ses modèles, ou `null`. Elle vient du
   *  serveur : l'écran l'affiche, il ne la recalcule jamais. */
  manque: string | null
  pret: boolean
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
  /** Ce qu'il a consommé **sans argent**, une ligne par unité (F2). À côté de
   *  la dépense, jamais dedans : une séance entière passée chez un fournisseur
   *  gratuit se lisait « $0,0000 », c'est-à-dire comme une séance sans un seul
   *  appel. Vide tant qu'il n'a travaillé que chez un fournisseur qui facture. */
  consomme: { unite: string; quantite: number }[]
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

/** L'état d'**un** fournisseur (F1).
 *
 *  Il y en a deux depuis la V2.2, et couper la liaison de l'un ne doit rien
 *  faire à l'autre : la barre du haut continue de dire « il y a du repli », et
 *  c'est ici qu'on lit *lequel*, et de quand date sa photo.
 */
export type EtatFournisseur = {
  nom: string
  /** Combien de modèles il apporte à la liste. */
  modeles: number
  recu_le: number
  repli: boolean
  /** Pourquoi sa photo sert à la place de sa réponse. */
  raison: string | null
  /** Ce qui lui manque pour travailler — une clé, aujourd'hui. */
  indisponible: string | null
  /** La phrase qui grise ses modèles, ou `null`. **Ce n'est pas la même chose
   *  que `raison`** : ce qui manque grise, une liaison coupée non — l'échec
   *  survient au moment où on génère, jamais à l'ouverture (US-95). */
  grise: string | null
  /** Ce qui lui reste, et d'où le chiffre vient (F2). `null` pour un
   *  fournisseur qui compte en argent : ce qu'il a coûté se lit dans la barre
   *  de tête, qui est faite pour ça. */
  reserve: Reserve | null
}

export type EtatCatalogue = {
  recu_le: number
  repli: boolean
  raison: string | null
  /** Un état par fournisseur (F1) — voir `EtatFournisseur`. */
  fournisseurs: EtatFournisseur[]
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
  /** Un état par fournisseur (F1). Sert la même chose que dans `EtatCatalogue`,
   *  et arrive par le même tuyau : la barre du haut n'ouvre pas de liaison de
   *  plus pour savoir lequel des deux est coupé. */
  fournisseurs: EtatFournisseur[]
}

export type Etat = {
  /** **Le tiroir à secrets, une place par fournisseur** (F3). Il remplace
   *  `cle`, qui ne pouvait décrire qu'un monde à un fournisseur : la barre de
   *  tête y lit *avec quoi on peut produire* plutôt que *ce qui manque*, et
   *  il en reste toujours un. */
  secrets: Tiroir[]
  /** **L'atelier n'a encore rien** (E19) : aucune image, un seul jeu, et il
   *  porte encore le nom que le produit lui a donné. C'est là que l'assistant
   *  s'ouvre — la seule minute que personne ne revoit jamais.
   *
   *  Un fait, jamais un drapeau : il cesse d'être vrai au premier geste, et
   *  c'est exactement quand la porte doit se refermer. */
  premier_lancement: boolean
  catalogue: EtatCatalogueCourt
  /** **Le total ne compte que de l'argent, et l'étiquette le dit** (F2). Ce
   *  qui se consomme sans argent est à côté, une réserve par fournisseur. */
  couts: { total_usd: number; reserves: Reserve[] }
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
    appeler<EtatCatalogueCourt>("/models/refresh", { method: "POST" }),

  agent: () => appeler<EtatAgent>("/settings/agent"),
  /** **Champ par champ** : ce qui n'est pas envoyé ne change pas. L'écran
   *  bascule un interrupteur à la fois, et poster l'objet entier depuis un
   *  formulaire partiel effacerait ce qu'un autre onglet vient de poser. */
  reglerAgent: (champs: Partial<GardeFous>) =>
    appeler<EtatAgent>("/settings/agent", {
      method: "PUT",
      body: JSON.stringify(champs),
    }),
  /** Déposer une valeur dans **une place nommée** (F3) — et ne toucher à aucune
   *  autre. `nom` est le nom d'environnement que le tiroir donne ; le serveur
   *  refuse tout nom qu'aucun fournisseur ne demande. */
  deposerSecret: (nom: string, valeur: string) =>
    appeler<{ tiroirs: Tiroir[] }>(`/settings/keys/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify({ valeur }),
    }),
  /** Retirer une valeur — **et rien d'autre** : ses modèles se grisent, ses
   *  images et ses lignes de dépense restent. */
  retirerSecret: (nom: string) =>
    appeler<{ tiroirs: Tiroir[] }>(`/settings/keys/${encodeURIComponent(nom)}`, {
      method: "DELETE",
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
    /** **Sous quel angle** (E10). L'image qui reviendra tombe dans la case *et*
     *  dans la direction, sans que personne ait à l'y ranger. */
    direction?: string | null
    /** **Les cases d'un lot plié** (C2, US-128). Deux poses ou plus, et l'appel
     *  part en une seule planche que l'atelier dépliera lui-même. La même route
     *  que tout le reste : il n'existe qu'un seul endroit d'où l'on paie. */
    /** **Les directions d'une planche de pose** (E13). Deux ou plus, et l'appel
     *  part en une planche dont chaque case sait déjà où son image se rangera —
     *  le rangement cesse d'être un geste séparé qu'on peut oublier. */
    directions?: string[] | null
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
    /** **Ce que l'écran de confirmation a trié** (E14). Il ne vaut que pour cet
     *  appel et ne remonte nulle part : garder une correction sur la chose du
     *  jeu est un second geste, qui passe par sa fiche. */
    tri?: Tri | null
    /** **La palette en image** (E14) : une bande de pastilles qui occupe une
     *  des places de référence du modèle. */
    palette?: boolean
  }) =>
    appeler<Generation>("/generations", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  relancer: (identifiant: string, rang: number) =>
    appeler<Generation>(`/generations/${identifiant}/slots/${rang}/retry`, {
      method: "POST",
    }),

  /** L'auteur tranche sur une planche qui attend, et elle se déplie (R6).
   *
   *  **Elle ne dépense rien** — c'est la même image, recoupée autrement. Une
   *  liste vide est une réponse, pas une absence de réponse : elle dit « je les
   *  garde tous », ce qui est exactement ce que demande une planche dont les
   *  cases sont pleines. */
  deplierPlanche: (identifiant: string, rang: number, ecartees: number[]) =>
    appeler<Generation>(`/generations/${identifiant}/slots/${rang}/unfold`, {
      method: "POST",
      body: JSON.stringify({ ecartees }),
    }),

  /** Les paramètres d'une génération passée — le quatrième rôle de la
   *  réinjection, celui qui n'envoie aucune image (US-12). */
  generation: (identifiant: string) =>
    appeler<Generation>(`/generations/${identifiant}`),

  /** **Tout ce que l'écran de confirmation montre, en un aller-retour** (E14).
   *
   *  Un écran qui demanderait son texte à une route et son prix à une autre
   *  finirait par afficher un texte d'avant à côté d'un prix d'après. Rien n'est
   *  facturé, rien n'est enregistré, aucun appel ne sort de la machine : l'écran
   *  arme, c'est la barre qui paie qui appelle. */
  envoi: (corps: {
    prompt: string
    modele: string
    projet?: string | null
    echelle?: string
    personnage?: string | null
    pose?: string | null
    direction?: string | null
    poses?: string[] | null
    directions?: string[] | null
    piece?: string | null
    references?: Reinjection[]
    references_ecartees?: string[] | null
    variations?: number
    repris?: boolean
    tri?: Tri | null
    /** **Ce que l'auteur interdit de sa main** (D3). Il entre ici parce que le
     *  fond du jeu s'y ajoute : sans lui, l'écran montrerait l'interdiction du
     *  produit seule et l'appel en enverrait deux. */
    prompt_negatif?: string
  }) =>
    appeler<Envoi>("/outgoing", {
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

  // ── Ce qui voyage d'une image à l'autre (U5) ──────────────────────────────
  //
  // **Trois portes pour une seule règle** — *un réglage voyage, une coordonnée
  // ne voyage pas* —, et la règle vit côté serveur. L'écran envoie la recette
  // qu'il a sous les yeux, entière ; c'est le serveur qui coupe et qui **rend
  // ce qu'il a laissé**, en clair, pour que l'écran n'ait qu'à le répéter. Un
  // second découpage écrit ici aurait fini par diverger, et l'auteur aurait
  // appris que coller et rappeler ne font pas tout à fait la même chose.

  recettesNommees: () => appeler<{ recettes: Record<string, Recette> }>("/recipes"),

  nommerRecette: (nom: string, recette: Recette) =>
    appeler<{ recettes: Record<string, Recette>; laisse: string[] }>(
      `/recipes/${encodeURIComponent(nom)}`,
      { method: "PUT", body: JSON.stringify(recette) },
    ),

  oublierRecette: (nom: string) =>
    appeler<{ recettes: Record<string, Recette> }>(
      `/recipes/${encodeURIComponent(nom)}`,
      { method: "DELETE" },
    ),

  appliquerRecette: (identifiant: string, nom: string) =>
    appeler<{ asset: Asset; laisse: string[] }>(
      `/assets/${identifiant}/apply/${encodeURIComponent(nom)}`,
      { method: "POST" },
    ),

  /** Coller sur cette image les réglages copiés sur une autre.
   *
   *  **Une route à part de `poserRecette`**, et la différence est le contrat :
   *  celle-ci coupe ce qui ne voyage pas et le dit, l'autre pose exactement ce
   *  qu'on lui donne. Les confondre aurait fait de chaque réglage posé un
   *  collage — et un cadre tracé serait tombé au premier envoi de la table de
   *  recadrage. */
  collerRecette: (identifiant: string, recette: Recette) =>
    appeler<{ asset: Asset; laisse: string[] }>(`/assets/${identifiant}/paste`, {
      method: "POST",
      body: JSON.stringify(recette),
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

  // ── Les mouvements (A6) ───────────────────────────────────────────────────
  //
  // **Aucune de ces routes ne coûte et aucune n'appelle personne** : c'est du
  // vocabulaire, il s'écrit sur le disque, et tout y marche réseau coupé.

  mouvements: () => appeler<BaseMouvements>("/movements"),

  /** Ce qui partira pour animer cette case du plan. **La règle est au serveur**
   *  et l'écran ne la rejoue jamais : deux endroits qui apparient une pose et
   *  un mouvement finiraient par ne plus s'accorder. */
  mouvementDeLaPose: (pose: string, projet?: string) =>
    appeler<MouvementDeLaPose>(
      `/movements/for-pose/${encodeURIComponent(pose)}` +
        (projet ? `?projet=${encodeURIComponent(projet)}` : ""),
    ),

  fabriquerMouvement: (
    nom: string,
    texte: string,
    cadence?: number,
    directions?: string[],
  ) =>
    appeler<BaseMouvements>("/movements", {
      method: "POST",
      body: JSON.stringify({ nom, texte, cadence, directions }),
    }),

  /** Renommer, retoucher le texte, changer la cadence. **Ce que ce mouvement a
   *  déjà fait partir ne bouge pas** : jamais de cascade. */
  reglerMouvement: (
    identifiant: string,
    champs: { nom?: string; texte?: string; cadence?: number; directions?: string[] },
  ) =>
    appeler<BaseMouvements>(`/movements/${identifiant}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** Un livré laisse une pierre, un fabriqué s'en va pour de bon. */
  masquerMouvement: (identifiant: string) =>
    appeler<BaseMouvements>(`/movements/${identifiant}`, { method: "DELETE" }),

  montrerMouvement: (identifiant: string) =>
    appeler<BaseMouvements>(`/movements/${identifiant}/show`, { method: "POST" }),

  // ── Les clips (A9) ────────────────────────────────────────────────────────
  //
  // **Une seule de ces routes dépense** — `commanderClips`. Toutes les autres
  // lisent, rangent ou rendent, et aucune ne rappelle le fournisseur : même
  // `rendreClips`, qui remontre un clip écarté, ne fait que défaire une marque
  // sur le disque.

  /** Les modèles vidéo et **le prix du jour pour ce réglage-là**.
   *
   *  Le prix se recalcule à chaque changement de durée ou de format : une
   *  seconde de plus n'est pas le même prix, et un catalogue chiffré une fois
   *  au démarrage annoncerait le prix d'autre chose. */
  modelesVideo: (secondes: number, resolution: string, proportions: string) =>
    appeler<BaseModelesVideo>(
      `/clips/models?secondes=${secondes}` +
        `&resolution=${encodeURIComponent(resolution)}` +
        `&proportions=${encodeURIComponent(proportions)}`,
    ),

  /** Ce que la carte de la maison peut faire aujourd'hui (A11).
   *
   *  **Le relevé se refait à chaque appel**, et c'est délibéré : l'auteur qui
   *  vient d'ouvrir l'application du moteur doit voir le grisé tomber sans
   *  redémarrer son atelier. Rien ici ne coûte — on demande à une application
   *  locale ce qu'elle a sur son disque. */
  etatDuMoteur: () => appeler<EtatDuMoteur>("/clips/engine"),

  /** Rapatrie les fichiers qui manquent au moteur de la maison.
   *
   *  **La seule route du produit qui télécharge**, et il n'y en a pas de version
   *  automatique : c'est un geste que l'auteur demande, après avoir lu la liste
   *  avec les tailles et les licences. ⚠️ Un téléchargement coupé se reprend au
   *  même appel — un fichier tronqué ressemble à un fichier absent. */
  telechargerLesModeles: () =>
    appeler<EtatDuMoteur & { descendus: string[] }>("/clips/engine/download", {
      method: "POST",
    }),

  /** Ce qu'un clip prendrait au départ, **et pourquoi celle-là**. Une
   *  proposition : l'écran la montre, l'auteur en change d'un clic. */
  imageDeDepart: (
    personnage: string,
    pose?: string | null,
    direction?: string | null,
  ) =>
    appeler<ImageDeDepart>(
      `/clips/start-image?personnage=${encodeURIComponent(personnage)}` +
        (pose ? `&pose=${encodeURIComponent(pose)}` : "") +
        (direction ? `&direction=${encodeURIComponent(direction)}` : ""),
    ),

  /** **La seule route de ce bloc qui dépense**, et elle dépense `nombre` fois.
   *
   *  L'écran envoie le **mouvement**, pas le texte qu'il vient d'afficher :
   *  deux chemins vers le même texte anglais finiraient par en envoyer un
   *  troisième, et c'est un appel payé qui le dirait. */
  commanderClips: (corps: {
    modele: string
    asset: string
    mouvement?: string | null
    prompt?: string
    secondes?: number
    resolution?: string
    proportions?: string
    nombre?: number
    personnage?: string | null
    pose?: string | null
    direction?: string | null
  }) =>
    appeler<{ clips: Generation[] }>("/clips", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  clips: () => appeler<{ clips: Generation[] }>("/clips"),

  /** Ceux qui sont payés — ou peut-être payés — et attendent un geste. **La
   *  liste ne récupère rien** : elle dit ce qu'il y a à récupérer. */
  clipsEnSouffrance: () => appeler<{ clips: Generation[] }>("/clips/pending"),

  /** Rapatrie un clip **déjà payé**. Ne commande rien, ne repaie rien. */
  recupererClip: (identifiant: string) =>
    appeler<Generation>(`/clips/${identifiant}/recover`, { method: "POST" }),

  /** Garder celui-là, écarter les autres — **un seul geste**, et il se défait.
   *  Ce qui a été payé reste au journal : un clip écarté quitte la galerie, pas
   *  les dépenses. */
  garderClip: (garde: string, jette: string[]) =>
    appeler<{ garde: Generation; jetes: Generation[] }>("/clips/keep", {
      method: "POST",
      body: JSON.stringify({ garde, jette }),
    }),

  /** L'annulation du geste ci-dessus. Rien n'expire : elle marche toujours. */
  rendreClips: (clips: string[]) =>
    appeler<{ clips: Generation[] }>("/clips/restore", {
      method: "POST",
      body: JSON.stringify({ clips }),
    }),

  // ── Le montage (A10) ──────────────────────────────────────────────────────
  //
  // **Aucune de ces routes ne dépense.** Le clip est payé. On découpe, on
  // garde, on efface, on recommence, et le total du projet ne bouge pas d'un
  // centime.

  /** Tout ce que l'écran demande à l'ouverture, en un seul aller-retour. */
  ouvrirLeMontage: (clip: string) => appeler<Montage>(`/montage/${clip}`),

  /** La bande montée, **sans rien écrire**. La planche revient en `data:` :
   *  un aperçu n'existe nulle part sur le disque, et lui donner une adresse
   *  obligerait à ranger un brouillon — donc à le nettoyer. */
  apercuDeBande: (corps: {
    clip: string
    images: number[]
    recette?: Recette | null
    cadre?: CadrePose | null
  }) =>
    appeler<ApercuDeBande>("/montage/preview", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  /** La fenêtre commune, remesurée sur **toutes** les images du clip.
   *
   *  **Un geste que l'auteur demande**, et il coûte une vingtaine de secondes :
   *  le faire à chaque cran de curseur rendrait l'écran inutilisable, le faire
   *  dans son dos ferait attendre sans dire pourquoi. */
  reprendreLeCadre: (clip: string, recette?: Recette | null) =>
    appeler<{
      fenetre: FenetreDuClip | null
      propositions: PropositionDeRythme[]
      a_jour: boolean
    }>(`/montage/${clip}/frame`, {
      method: "POST",
      body: JSON.stringify({ clip, recette: recette ?? null }),
    }),

  bandesDuClip: (clip: string) =>
    appeler<{ bandes: Bande[] }>(`/strips?clip=${encodeURIComponent(clip)}`),

  /** Une bande de plus, taillée dans ce clip. **Rien n'est dépensé.** */
  garderLaBande: (corps: {
    clip: string
    nom: string
    images: number[]
    cadence?: number
    sens?: string
    recette?: Recette | null
    cadre?: CadrePose | null
    pose?: string | null
    direction?: string | null
  }) =>
    appeler<Bande>("/strips", { method: "POST", body: JSON.stringify(corps) }),

  /** La case du plan de poses que cette bande remplit — **ou plus aucune** :
   *  les deux vides la retirent de sa case sans la supprimer. */
  affecterLaBande: (
    identifiant: string,
    pose: string | null,
    direction: string | null = null,
  ) =>
    appeler<Bande>(`/strips/${identifiant}/case`, {
      method: "PUT",
      body: JSON.stringify({ pose, direction }),
    }),

  renommerLaBande: (identifiant: string, nom: string) =>
    appeler<Bande>(`/strips/${identifiant}/name`, {
      method: "PUT",
      body: JSON.stringify({ nom }),
    }),

  /** La bande s'en va, **le clip et ses images restent**. Un découpage raté ne
   *  coûte rien : c'est toute la différence avec l'autre moitié de l'atelier. */
  oublierLaBande: (identifiant: string) =>
    appeler<Bande>(`/strips/${identifiant}`, { method: "DELETE" }),

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

  recalerSuperposition: (dessus: string, dessous: string, arrivee = false) =>
    appeler<{ echelle: number; dx: number; dy: number; couverture: number }>(
      `/assets/${dessus}/overlay/fit?dessous=${encodeURIComponent(dessous)}` +
        (arrivee ? "&arrivee=true" : ""),
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

  /** La toile en un aller-retour : les cartes, les groupes, les traits, les
   *  teintes et **ce que chaque paquet a produit**. Une seconde route pour les
   *  liens aurait fait paraître les cartes avant eux — donc un instant, à chaque
   *  ouverture, où la toile montre des objets sans ce qu'on en avait dit ; une
   *  seconde route pour les fabriques ferait la même chose à la marque d'un
   *  îlot (U7). */
  tableau: () =>
    appeler<{
      projet: string
      cartes: Carte[]
      groupes: string[]
      liens: Lien[]
      teintes: Record<string, Teinte>
      fabriques: Record<string, Fabrique>
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

  // ── Découper une carte, et voir ce que la palette y lit ────────────────────
  //
  // **Le même verbe et le même nom que pour une planche**, parce que c'est le
  // même geste : ce qui ne crée rien se redemande à chaque cran de réglage, ce
  // qui crée des choses ne se redemande jamais. Ce qui change est la famille de
  // ce qui en sort — des cartes, jamais des assets.

  decoupeDeCarteProposee: (
    carte: string,
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
    return appeler<PropositionDeCarte>(`/board/${carte}/slices?${parametres}`)
  },

  /** Chaque rectangle devient une carte du même tableau.
   *
   *  `remplacer` n'a de sens qu'avec **un seul** rectangle, et c'est alors un
   *  recadrage : le morceau prend tout ce qui faisait l'originale, et
   *  l'originale s'en va. Rend l'univers avec, parce que remplacer un artwork
   *  officiel refait la palette. */
  decouperCarte: (carte: string, boites: Boite[], remplacer = false) =>
    appeler<{
      carte: string
      morceaux: Carte[]
      retiree: Carte | null
      univers: Univers
    }>(`/board/${carte}/slices`, {
      method: "POST",
      body: JSON.stringify({ boites, remplacer }),
    }),

  /** Quelle part de cette carte nourrit la palette du jeu. */
  lectureDePalette: (carte: string) =>
    appeler<LectureDePalette>(`/board/${carte}/palette`),

  /** L'image d'une carte, avec en magenta ce que la palette en écarte.
   *
   *  **Ce n'est pas l'image de la carte** : c'est un instrument, il ne
   *  s'enregistre pas, et il ne remplace jamais l'image sous son propre nom.
   *
   *  Nommée d'après ce qu'elle montre — *la lecture* — et non d'après la
   *  palette : `apercuDePalette` existe déjà, et il rend tout autre chose,
   *  une palette d'ambiance posée sur de vraies images du jeu. */
  apercuDeLaLecture: (carte: string, version: string) =>
    `/api/board/${carte}/palette/image?v=${encodeURIComponent(version)}`,

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

  // ── La planche d'une pose (E13) ──────────────────────────────────────────
  //
  // **Une lecture, et elle ne facture rien.** Elle compose pourtant ses cases
  // par le chemin de l'envoi : ce qui est montré est ce qui part.

  /** Ce que la planche de cette pose enverrait, et ce qu'elle coûterait. */
  planche: (personnage: string, pose: string) =>
    appeler<Planche>(
      `/characters/${personnage}/sheet?pose=${encodeURIComponent(pose)}`,
    ),

  // ── Le calibrage (E17) ───────────────────────────────────────────────────
  //
  // **Rien ici ne coûte un centime** : il change le rendu de poses qui existent
  // déjà, et un rendu est un cache — on recalcule, on ne repaie pas.

  /** Toutes les poses d'une chose, leur boîte, et la hauteur commune proposée. */
  calibrage: (personnage: string) =>
    appeler<Calibrage>(`/characters/${personnage}/calibration`),

  /** Poser la hauteur commune sur toutes les poses retenues. **Un point de
   *  départ, pas un verdict.** */
  calibrer: (personnage: string) =>
    appeler<Calibrage>(`/characters/${personnage}/calibration`, {
      method: "POST",
    }),

  /** La reprise à la main, pose par pose. `undefined` ne touche pas. */
  reglerLeCalage: (
    personnage: string,
    pose: string,
    champs: { occupation?: number; decalage?: number },
  ) =>
    appeler<Calibrage>(
      `/characters/${personnage}/calibration/${encodeURIComponent(pose)}`,
      { method: "PUT", body: JSON.stringify(champs) },
    ),

  /** Sortir une pose du calage commun, ou l'y faire rentrer. Sa case existe
   *  toujours — seul le calage commun l'ignore. */
  mettreDeCote: (personnage: string, pose: string, de_cote: boolean) =>
    appeler<Calibrage>(
      `/characters/${personnage}/calibration/${encodeURIComponent(pose)}/aside`,
      { method: "PUT", body: JSON.stringify({ de_cote }) },
    ),

  /** **Sur quels personnages cette pièce est posée** (E15). Elle n'a pas d'image
   *  à elle : son établi montre ce qui la porte, et ce qui manque se lit comme
   *  partout ailleurs. Gratuit, et rien n'est enregistré — une pièce posée se
   *  déduit des images, comme une case pleine. */
  porteeDeLaPiece: (piece: string) =>
    appeler<PorteeDeLaPiece>(
      `/characters/pieces/${encodeURIComponent(piece)}/wearers`,
    ),

  /** **Nommer, c'est créer** — et dans la famille où l'on nomme (E15). C'est le
   *  type qui porte la famille, et c'est le serveur qui le pose : l'écran dit où
   *  l'on tape, il n'invente pas de type. */
  creerPersonnage: (nom: string, description = "", famille = "") =>
    appeler<{ personnage: Personnage }>("/characters", {
      method: "POST",
      body: JSON.stringify({ nom, description, famille: famille || null }),
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
      /** Les textes qu'elle écrit pour elle seule (E12). Un texte vidé rend la
       *  case au jeu ; éteindre écrit un refus — ce ne sont pas le même geste. */
      textes?: Record<string, string>
      eteindre?: string
      rallumer?: string
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

  /** Les sept textes qui habillent une chose, **et d'où chacun vient** (E12). */
  habillage: (personnage: string) =>
    appeler<Habillage>(`/characters/${personnage}/style`),

  /** Ses images de référence — **ce qui est disponible, pas ce qui part**. */
  referencesDeLaChose: (personnage: string) =>
    appeler<ReferencesDeLaChose>(`/characters/${personnage}/references`),

  /** Une image fabriquée devient — ou cesse d'être — une référence permanente.
   *  Elle repart alors avec chaque appel suivant, et c'est ce qui fait qu'une
   *  chose se ressemble d'une pose à l'autre. */
  promouvoirReference: (personnage: string, asset: string, promue = true) =>
    appeler<{ personnage: Personnage; references: ReferencesDeLaChose }>(
      `/characters/${personnage}/references`,
      { method: "PUT", body: JSON.stringify({ asset, promue }) },
    ),

  /** De quoi regarder une chose finie : les fonds du projet, et la taille
   *  commune de ses images (E16). Rien n'est fabriqué, rien n'est modifié. */
  vitrine: (personnage = "") =>
    appeler<Vitrine>(
      personnage ? `/characters/${personnage}/showcase` : "/characters/showcase",
    ),

  /** Cette image **est** le corps de cette case (US-122) — ou ne l'est plus,
   *  les deux vides ensemble. Le corps naît dans l'atelier et nulle part
   *  ailleurs : ce geste ne fabrique rien, il dit seulement où l'image va. */
  designer: (
    asset: string,
    personnage: string | null,
    pose: string | null,
    direction?: string | null,
  ) =>
    appeler<Asset>(`/assets/${asset}/character`, {
      method: "PUT",
      // **`undefined` ne touche pas** : désigner la case et confirmer la
      // direction sont deux gestes, et `JSON.stringify` retire le champ absent
      // plutôt que de l'envoyer à `null` — ce qui effacerait la direction à
      // chaque désignation.
      body: JSON.stringify({ personnage, pose, direction }),
    }),

  /** Le sujet qu'une chose demande au modèle — **composé par le serveur**.
   *
   *  L'écran l'écrivait lui-même jusqu'en C5 ; l'agent arme les mêmes cases, et
   *  deux compositions à deux endroits auraient fini par demander deux choses
   *  différentes pour la même case.
   *
   *  **Depuis E14, c'est le signalement seul.** La consigne de l'attitude et
   *  celle de l'angle sont ajoutées par le composeur du prompt, où elles font
   *  leur propre ligne avec leur propre origine : le champ porte ce qu'on
   *  dessine, la case dit sous quel angle. Rien n'est écrit, rien n'est payé. */
  sujetDeCase: (corps: {
    personnage: string
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

  /** **Les six que l'atelier propose, posés d'un geste** — le dos, le corps, les
   *  jambes, le torse, les mains, la tête, dans l'ordre de l'empilement.
   *
   *  **Le vestiaire naît toujours vide**, et ceci est un geste de l'auteur, pas
   *  un effet de bord : rien n'est écrit derrière son dos. Ce que ça répare est
   *  mesuré — l'étape « Emplacements » montrait une liste vide sous une
   *  demi-phrase qui
   *  énonçait une règle sur un ordre que rien ne permettait de changer.
   *
   *  Rappelée deux fois, elle n'ajoute que ce qui manque. */
  poserLesEmplacementsProposes: () =>
    appeler<Vestiaire>("/characters/slots/suggested", {
      method: "POST",
      body: JSON.stringify({}),
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

  ajouterPose: (nom: string, images = 1, consigne = "") =>
    appeler<{ pose: Pose; plan: Pose[] }>("/characters/poses", {
      method: "POST",
      body: JSON.stringify({ nom, images, consigne }),
    }),

  /** Renommer, corriger ce qu'elle dit au modèle, ou changer ce qu'elle
   *  demande. **L'identifiant ne bouge pas** : les images déjà faites le
   *  portent. Ce qu'on n'envoie pas ne bouge pas non plus — la pose porte quatre
   *  choses de plus que son nom depuis E10. */
  reglerPose: (
    pose: string,
    champs: { nom?: string; images?: number; consigne?: string },
  ) =>
    appeler<{ pose: Pose; plan: Pose[] }>(`/characters/poses/${pose}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  // ── Les directions du jeu (E10) ──────────────────────────────────────────

  /** Les directions de ce jeu, et d'où la liste lui vient. */
  directions: () => appeler<DirectionsDuJeu>("/characters/directions"),

  /** Une direction de plus. **Nommer, c'est créer**, et rien ne coûte. */
  ajouterDirection: (nom: string, consigne = "") =>
    appeler<DirectionsDuJeu>("/characters/directions", {
      method: "POST",
      body: JSON.stringify({ nom, consigne }),
    }),

  /** Renommer une direction, ou corriger ce qu'elle dit — **une seule fois**,
   *  pour toutes les poses du jeu. */
  reglerDirection: (
    direction: string,
    champs: { nom?: string; consigne?: string },
  ) =>
    appeler<DirectionsDuJeu>(`/characters/directions/${direction}`, {
      method: "PUT",
      body: JSON.stringify(champs),
    }),

  /** Une direction quitte le jeu. Les images faites restent, avec son
   *  identifiant : la remettre les remet dans leur case. */
  retirerDirection: (direction: string) =>
    appeler<DirectionsDuJeu>(`/characters/directions/${direction}`, {
      method: "DELETE",
    }),

  /** La liste **revient à ce que la vue du jeu propose**. */
  oublierLesDirections: () =>
    appeler<DirectionsDuJeu>("/characters/directions/reset", { method: "POST" }),

  /** Ranger — ou déranger — une direction pour une pose. Sans personnage, la
   *  portée est celle où la pose est déclarée ; avec, cette chose seule. */
  rangerDirection: (
    pose: string,
    direction: string,
    rangee: boolean,
    personnage?: string,
  ) =>
    appeler<{ portee: string; personnage?: Personnage }>(
      `/characters/poses/${pose}/directions/${direction}`,
      { method: "PUT", body: JSON.stringify({ rangee, personnage }) },
    ),

  /** Ce que déclarer des directions coûterait, et ce qu'on propose. */
  propositionDeBaisse: () =>
    appeler<PropositionDeBaisse>("/characters/directions/proposal"),

  /** Ramener à une image les poses que la proposition nomme. */
  baisserLesImages: () =>
    appeler<PropositionDeBaisse>("/characters/directions/proposal", {
      method: "POST",
    }),

  /** **Le clic qui défait** : chaque pose retrouve ce qu'elle demandait. */
  defaireLaBaisse: () =>
    appeler<PropositionDeBaisse>("/characters/directions/proposal", {
      method: "DELETE",
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
    appeler<{
      projet: string
      univers: Univers
      /** **Ce que l'atelier proposerait comme fond à ce jeu-là** (D3), calculé
       *  par le serveur : la distance qui décide de la sûreté d'un fond est
       *  celle du détourage, et une seconde arithmétique ici aurait fini par
       *  proposer une couleur que le découpage mange. */
      fond_propose: FondPropose
      artworks: Carte[]
    }>("/universe"),

  /** Tout est facultatif : ce qu'on n'envoie pas ne bouge pas. Un `PUT` qui
   *  exigerait l'univers entier obligerait l'écran à en tenir une copie. */
  reglerUnivers: (reglage: {
    vue?: string
    bible?: Champ[]
    bareme?: Echelle[]
    /** **Le style graphique** (D2). Il se pose avant la taille, et le service
     *  les traite dans cet ordre quand le même message porte les deux :
     *  changer de style déplace la taille quand elle n'a plus de sens. */
    style?: Style
    cible_px?: number
    couleurs?: number
    /** **La méthode de pixelisation du projet** (D2). Elle ne descend que dans
     *  les recettes fabriquées à neuf : en changer ne rejoue aucune image. */
    methode_pixels?: Methode
    /** **La couleur de fond du jeu** (D3). La chaîne vide la retire et rend le
     *  comportement d'avant la tranche ; ne pas envoyer le champ ne touche à
     *  rien, comme partout ailleurs dans ce message. */
    fond?: string
    modeles?: Partial<Record<Famille, string>>
    modele_planche?: string
    modele_edition?: string
    /** **Le détourage par défaut** (D1), et la seule exception à la phrase
     *  ci-dessus : ici `null` ne veut pas dire « ne touche pas », il veut dire
     *  **remets-le au produit**. Sans une valeur qui dise *je n'en veux plus*,
     *  un réglage posé une fois ne pourrait jamais être retiré, seulement
     *  remplacé. « Ne touche pas » redevient alors ce qu'il est partout
     *  ailleurs : ne pas envoyer le champ du tout. */
    detourage_image?: DefautDetourage | null
    detourage_planche?: DefautDetourage | null
    detourages?: Partial<Record<Famille, DefautDetourage>> | null
  }) =>
    appeler<{ projet: string; univers: Univers; fond_propose: FondPropose }>(
      "/universe",
      { method: "PUT", body: JSON.stringify(reglage) },
    ),

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

  /** **La case telle qu'elle est arrivée du modèle** (G16) — l'autre sens du
   *  mot *brut*. Sur un vêtement, `rendu(…, brut)` sert la case déjà mise à
   *  l'échelle et calée sur son corps ; celle-ci sert ce que le modèle a
   *  vraiment renvoyé. Elle se recalcule de la planche à chaque demande et ne
   *  range rien — pas d'empreinte à faire voyager, donc, et pas de cache. */
  arrivee: (identifiant: string) => `/api/assets/${identifiant}/incoming`,

  /** Une image prélevée dans un clip, par son numéro (A9). C'est ce que la
   *  galerie sert pour montrer un clip — jamais une tuile en erreur —, et ce
   *  que le montage servira cent fois de suite en faisant glisser sa fenêtre.
   *  Les images sont sur le disque depuis l'arrivée du clip : rien n'est
   *  décodé à la demande. */
  imageDuClip: (identifiant: string, numero: number) =>
    `/api/clips/${identifiant}/frames/${numero}`,

  /** Le fichier tel qu'il est arrivé. Le brut, jamais un rendu. */
  videoDuClip: (identifiant: string) => `/api/clips/${identifiant}/video`,

  /** **Toutes les images du clip en une seule** (A10), rangées en grille.
   *
   *  L'écran de montage en tire deux choses du même fichier : la pellicule, en
   *  prenant une tranche au centre de chaque case, et la loupe, en montrant la
   *  case entière. Servir cent vingt images de 480 pixels pour dessiner un
   *  ruban de sept pixels de large ferait payer des mégaoctets à un survol. */
  contactDuClip: (identifiant: string) => `/api/montage/${identifiant}/contact`,

  /** La planche de sprites d'une bande gardée. **Elle change sous la même
   *  adresse** quand la recette de la bande change — l'exact contraire d'un
   *  clip, qui ne change jamais —, donc le navigateur ne la garde pas. */
  plancheDeLaBande: (identifiant: string) => `/api/strips/${identifiant}/sheet`,

  // Le rendu change sous la même adresse à chaque cran de curseur : `version`
  // porte l'empreinte de la recette pour que le navigateur cherche une image
  // neuve au lieu de resservir celle d'avant.
  rendu: (identifiant: string, version: string, brut = false) =>
    `/api/assets/${identifiant}/image?brut=${brut}&v=${encodeURIComponent(version)}`,

  /** **Le fichier d'un asset, sans empreinte à faire voyager.**
   *
   *  Elle sert la même chose que `rendu` quand la recette est vide — le brut,
   *  puisqu'il n'y a rien à rendre — mais **sans `v`**, et c'est délibéré : une
   *  recette vide a bien une empreinte, et elle ne change *jamais*. La faire
   *  voyager ferait garder un an une image qu'un rejeu de superposition réécrit
   *  sous le même nom. Sans `v`, le serveur répond `no-store`, exactement comme
   *  l'ancienne adresse d'emplacement qu'elle remplace. */
  fichier: (identifiant: string, brut = false) =>
    `/api/assets/${identifiant}/image?brut=${brut}`,

  /** **L'image réduite pour une case de grille**, jamais le fichier entier.
   *
   *  Mesuré le 31 août 2026 : la galerie téléchargeait 25,5 Mo pour en afficher
   *  0,5 — 318 Ko en moyenne par vignette de 145 px, et jusqu'à deux mégaoctets
   *  pour la plus lourde.
   *
   *  `cote` est **le cran de la grille et non la largeur rendue** : trois crans
   *  font trois adresses par image, une largeur de fenêtre en ferait une par
   *  fenêtre, et le navigateur ne resservirait jamais deux fois la même. Le
   *  `v=` porte l'empreinte de la recette, ce qui rend la mise en cache sûre —
   *  l'adresse change dès que l'image change. */
  vignette: (identifiant: string, version: string, cote: number) =>
    `/api/assets/${identifiant}/vignette?cote=${cote}&v=${encodeURIComponent(version)}`,

  /** Le calque **avant que la main y passe** (C4, US-151) — l'autre moitié de
   *  la comparaison d'un seul geste.
   *
   *  Une adresse à part et non un troisième état de `rendu` : l'avant n'est pas
   *  un cran de la bascule rendu/brut, il ne se garde nulle part, et rien
   *  d'autre dans le produit ne le montre. Le serveur ne l'écrit pas non plus —
   *  c'est un calcul, pas un fichier. */
  avant: (identifiant: string, version: string) =>
    `/api/assets/${identifiant}/image?avant=true&v=${encodeURIComponent(version)}`,

  /** **L'image que la planche joint, telle qu'elle partira** (M4).
   *
   *  Elle ne vient pas de la bibliothèque : le produit la redessine du geste à
   *  chaque appel, et elle ne s'écrit jamais sur le disque. Elle n'a donc ni
   *  identifiant ni empreinte — son adresse porte l'appel lui-même, ce qui est
   *  aussi ce qui la fait changer quand l'appel change.
   *
   *  Elle ne coûte rien et n'enregistre rien : la demander, c'est refaire
   *  gratuitement ce que la soumission refera. */
  plancheJointe: (appel: {
    modele: string
    projet?: string | null
    personnage?: string | null
    pose?: string | null
    piece?: string | null
    poses?: string[] | null
    directions?: string[] | null
  }) => {
    const parametres = new URLSearchParams({ modele: appel.modele })
    for (const [nom, valeur] of [
      ["projet", appel.projet],
      ["personnage", appel.personnage],
      ["pose", appel.pose],
      ["piece", appel.piece],
    ] as const)
      if (valeur) parametres.append(nom, valeur)
    for (const pose of appel.poses ?? []) parametres.append("poses", pose)
    for (const angle of appel.directions ?? [])
      parametres.append("directions", angle)
    return `/api/outgoing/sheet?${parametres.toString()}`
  },

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
  /** Les directions du jeu ont changé — une direction ajoutée, renommée,
   *  retirée, ou la liste rendue à ce que la vue propose (E10). La charge porte
   *  la liste **entière** et son origine, comme le plan et pour les mêmes
   *  raisons. **Son propre genre**, jamais un champ sur `univers` : renommer une
   *  direction n'a aucune raison de coûter deux appels réseau. */
  directions: (charge: DirectionsDuJeu & { projet: string }) => void
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
  lire<Parameters<Ecoute["directions"]>[0]>("directions", ecoute.directions)
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

/** L'unité de l'argent — la seule que le produit ait connue avant la V2.2. */
export const ARGENT = "usd"

/** Cette unité-là se paie-t-elle en argent ? Une unité absente en est (F2). */
export const estArgent = (unite?: string | null) => (unite ?? ARGENT) === ARGENT

/** Une quantité **avec son mot** : `$0,0245`, `1 jeton`, `3 jetons`.
 *
 *  Le pluriel se fait sur le mot que le serveur envoie, sans table de
 *  traduction : les unités du produit sont des noms français ordinaires, et le
 *  jour où l'une ne l'est pas, elle arrivera écrite comme elle doit se lire. */
export const quantite = (valeur: number, unite?: string | null) => {
  if (estArgent(unite)) return dollars(valeur)
  const arrondi = Math.round(valeur * 100) / 100
  const ecrit = Number.isInteger(arrondi)
    ? String(arrondi)
    : String(arrondi).replace(".", ",")
  return `${ecrit} ${unite}${arrondi >= 2 ? "s" : ""}`
}

/** Ce qu'un appel a coûté, **du point de vue de l'argent** : un montant, ou le
 *  mot `gratuit`.
 *
 *  C'est la phrase que F2 existe pour écrire. « 0,00 $ » sur un appel sans prix
 *  se lit *sans limite* là où il faut lire *sans prix* — et l'auteur brûlerait
 *  la réserve du jour sans que rien ne le lui dise. Ce qui a été consommé
 *  s'écrit à côté, avec `quantite`, jamais à la place. */
export const depense = (valeur: number, unite?: string | null) =>
  estArgent(unite) ? dollars(valeur) : "gratuit"

/** Un poids de fichier, en mégaoctets — **jamais arrondi vers le bas** (U13).
 *
 *  Le seul endroit du produit qui annonce un téléchargement à venir, et le
 *  chiffre qu'il donne est celui du serveur : « 928 Mo » est ce qu'on va
 *  attendre, et un « ~900 » aurait été le genre d'estimation qu'on croit avant
 *  de lancer plusieurs minutes de patience. */
export const megaoctets = (octets: number) =>
  `${Math.round(octets / 1_048_576)} Mo`

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
