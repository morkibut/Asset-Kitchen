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
    prompt: string
    prompt_negatif: string
    proportions: string
    resolution: string | null
    variations: number
    references: number
    options: Record<string, unknown>
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
// Une recette, c'est cinq places nommées dans un ordre fixe : détourage,
// recadrage, grille, quantification, bords. Ce n'est pas une liste que l'auteur
// ordonne — trois des cinq étapes n'ont aucun sens avant celle qui les précède.
// `null` veut dire « place vide », et une recette dont les cinq places sont
// vides ne produit aucun rendu : le brut suffit.

export type Passe = {
  moteur: "bord" | "modele"
  tolerance: number
  seuil_alpha: number
  durcissement: number
}

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
  recadrage: Recadrage | null
  grille: Grille | null
  quantification: Quantification | null
  bords: Bords | null
  nom: string | null
}

export const RECETTE_VIDE: Recette = {
  passes: [],
  recadrage: null,
  grille: null,
  quantification: null,
  bords: null,
  nom: null,
}

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
}

export type Champ = { nom: string; texte: string; actif: boolean }

/** Ce que l'auteur lit d'un champ de bible. La clé voyage sans accent. */
export const NOM_CHAMP: Record<string, string> = {
  monde: "monde",
  epoque: "époque",
  trait: "trait",
  eclairage: "éclairage",
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

export type Univers = {
  bible: Champ[]
  bareme: Echelle[]
  cible_px: number
  couleurs: number
  /** Déduite par calcul des artworks officiels, jamais saisie (US-54). */
  palette: string[]
  palette_empreinte: string
  modeles: Partial<Record<Famille, string>>
  /** Ni bible qui parle, ni palette. Un état normal, pas une configuration
   *  manquante : « un univers vide ne contraint rien » (US-57). */
  vide: boolean
}

export const UNIVERS_VIDE: Univers = {
  bible: [],
  bareme: [],
  cible_px: 64,
  couleurs: 24,
  palette: [],
  palette_empreinte: "",
  modeles: {},
  vide: true,
}

/** Combien d'images partiront, et d'où elles viennent (US-52).
 *
 *  **Calculé par le serveur.** L'écran tient les réinjections que l'auteur a
 *  posées, mais pas les artworks — c'est l'application qui les choisit — ni le
 *  dédoublonnage entre les deux. Deux comptes calculés à deux endroits
 *  finiraient par se contredire, et celui qui compte est celui qui part. */
export type CompteReferences = {
  total: number
  manuelles: number
  artworks: number
  famille: Famille | null
}

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
  modeles: (proportions: string, references = 0, echelle = "") =>
    appeler<EtatCatalogue>(
      `/models?proportions=${encodeURIComponent(proportions)}` +
        `&references=${references}&echelle=${encodeURIComponent(echelle)}`,
    ),

  rafraichirCatalogue: () =>
    appeler<{ modeles: number; recu_le: number; repli: boolean; raison: string | null }>(
      "/models/refresh",
      { method: "POST" },
    ),

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
    variations: number
    options: Record<string, unknown>
    identifiant: string
    references: Reinjection[]
    /** Ce que l'auteur fabrique, nommé dans le barème du projet. */
    echelle: string
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

  // ── Le tableau d'inspiration ──────────────────────────────────────────────
  // Une seule de ces routes touche le réseau : celle qui va chercher l'image
  // d'une adresse collée. Toutes les autres marchent hors ligne.

  tableau: () => appeler<{ projet: string; cartes: Carte[]; groupes: string[] }>("/board"),

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

  collerTexte: (texte: string) =>
    appeler<Carte>("/board/text", {
      method: "POST",
      body: JSON.stringify({ texte }),
    }),

  /** Réessayer une récupération qui a échoué (US-43). Un geste de l'auteur,
   *  jamais une reprise automatique. */
  reessayerCarte: (carte: string) =>
    appeler<Carte>(`/board/${carte}/retry`, { method: "POST" }),

  reglerCarte: (
    carte: string,
    reglage: { groupe?: string; note?: string; taille?: 1 | 2 | 4 },
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

  // ── L'univers du projet ───────────────────────────────────────────────────

  univers: () =>
    appeler<{ projet: string; univers: Univers; artworks: Carte[] }>("/universe"),

  /** Tout est facultatif : ce qu'on n'envoie pas ne bouge pas. Un `PUT` qui
   *  exigerait l'univers entier obligerait l'écran à en tenir une copie. */
  reglerUnivers: (reglage: {
    bible?: Champ[]
    bareme?: Echelle[]
    cible_px?: number
    couleurs?: number
    modeles?: Partial<Record<Famille, string>>
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

  telechargementAsset: (identifiant: string, brut = false) =>
    `/api/assets/${identifiant}/download?brut=${brut}`,
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
  /** L'univers d'un projet a changé : palette recalculée, réglage posé, ou
   *  balayage de réalignement terminé. Un **seul** message pour un lot entier —
   *  la diffusion garde soixante-quatre messages par abonné, et un événement
   *  par asset en perdrait les plus anciens sur un projet un peu fourni. */
  univers: (charge: {
    projet: string
    nom: string
    univers: Univers
    realignes: number
    conserves: number
  }) => void
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
  lire<Parameters<Ecoute["univers"]>[0]>("univers", ecoute.univers)

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
