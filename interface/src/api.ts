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
   *  a tranché, et en T4 c'est l'univers du projet qui le portera. */
  defaut: { modele: string | null; options: Record<string, string> }
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

  modeles: (proportions: string, references = 0) =>
    appeler<EtatCatalogue>(
      `/models?proportions=${encodeURIComponent(proportions)}&references=${references}`,
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
