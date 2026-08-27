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
  statut: Statut
  cout_usd: number
  reussies: number
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
  /** Présent sur le premier message du flux, absent des suivants : c'est lui qui
   *  fait qu'un onglet rouvert retrouve ce qui s'est produit pendant son
   *  absence, sans un seul sondage. */
  generations?: Generation[]
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
  }) =>
    appeler<Generation>("/generations", {
      method: "POST",
      body: JSON.stringify(corps),
    }),

  relancer: (identifiant: string, rang: number) =>
    appeler<Generation>(`/generations/${identifiant}/slots/${rang}/retry`, {
      method: "POST",
    }),

  image: (identifiant: string, rang: number) =>
    `/api/generations/${identifiant}/slots/${rang}/image`,

  telechargement: (identifiant: string, rang: number) =>
    `/api/generations/${identifiant}/slots/${rang}/download`,
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
