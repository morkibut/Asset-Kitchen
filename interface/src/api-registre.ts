// Le registre du contenu (RC1) : ce qu'on montre à l'auteur, ce qu'il en
// décide, ce que les agents relèvent. Les routes : `atelier/api/registre.py` ;
// les règles : `atelier/domaine/registre.py`.
import { appeler } from "./api"

export type EtatEntree =
  | "a-trancher" | "reprise-demandee" | "en-cours" | "validee" | "integree"
  | "reference" | "en-pause" | "ecartee" | "retiree" | "remplacee"

export type Media = {
  code: string; genre: "image" | "video" | "audio" | "texte"
  fichier?: string; asset?: string; legende?: string; defauts?: string; conseil?: boolean
  provenance?: string; sous_titres?: string; texte?: string
}

export type Porte = { cle: string; nom: string; passee: boolean }

export type LigneEntree = {
  identifiant: string; type: string; nom_type: string; titre: string; resume: string
  rayon: string | null; groupe: string | null; auteur: string; choix: boolean
  cree_le: number; maj_le: number; version: number; versions: number
  nouveau: boolean; mis_a_jour: boolean; vignette: Media | null; medias: number
  etat: EtatEntree; nom_etat: string; hors_vue: boolean
  porte: string | null; nom_porte: string | null; portes: Porte[]
  pris: string[] | null; reprise: string | null; attend: string | null; remplacee_par: string | null
}

export type Evenement = {
  repere: string; le: number; qui: string; genre: string; entree: string
  geste?: string; porte?: string | null; mot?: string | null; codes?: string[]; texte?: string
  sorte?: string; cible?: string | null; version?: number; change?: string | null; statut?: string
  annulable?: boolean
}

export type Remarque = {
  repere: string; le: number; qui: string; texte: string; sorte: string; cible: string | null
  version: number | null; etat: string; nom_etat: string
  reponses: { repere: string; le: number; qui: string; texte: string; etat: string | null }[]
}

export type Entree = LigneEntree & {
  corps: string; change: string | null; propositions: Media[]
  histoire: { numero: number; le: number; change: string | null; corps: string; medias: Media[]; dit: Evenement[] }[]
  remarques: Remarque[]; journal: Evenement[]; deja?: boolean
}

export type Reglages = {
  types: { cle: string; nom: string; portes: { cle: string; nom: string }[] }[]
  rayons: { cle: string; nom: string }[]
}

export type Accueil = {
  projet: string; a_trancher: LigneEntree[]; nouveautes: LigneEntree[]
  par_rayon: { rayon: string | null; nom: string; entrees: LigneEntree[] }[]
  hors_vue: LigneEntree[]; depots_refuses: { dossier: string; raison: string; le: number }[]
  reglages: Reglages; total: number; boite_de_depot: string
}

const base = (p: string) => `/projects/${encodeURIComponent(p)}/register`
const une = (p: string, e: string) => `${base(p)}/entries/${encodeURIComponent(e)}`
const poster = (corps: unknown) => ({ method: "POST", body: JSON.stringify(corps) })

export const registre = {
  accueil: (p: string) => appeler<Accueil>(base(p)),
  lire: (p: string, e: string) => appeler<Entree>(une(p, e)),
  decider: (p: string, e: string, geste: string, extra: { porte?: string; mot?: string } = {}) =>
    appeler<Entree>(`${une(p, e)}/decision`, poster({ geste, ...extra })),
  prendre: (p: string, e: string, codes: string[]) =>
    appeler<Entree>(`${une(p, e)}/choice`, { method: "PUT", body: JSON.stringify({ codes }) }),
  remarquer: (p: string, e: string, texte: string, sorte = "remarque", cible: string | null = null) =>
    appeler<Entree>(`${une(p, e)}/remarks`, poster({ texte, sorte, cible })),
  annuler: (p: string, repere: string) => appeler<Entree>(`${base(p)}/events/${encodeURIComponent(repere)}/cancel`, { method: "POST" }),
  vu: (p: string, entrees?: string[]) => appeler<{ vu: number }>(`${base(p)}/seen`, poster(entrees ? { entrees } : {})),
  televerser: async (p: string, fichier: File) => {
    const reponse = await fetch(`/api${base(p)}/uploads?nom=${encodeURIComponent(fichier.name)}`, { method: "POST", body: fichier })
    const charge = await reponse.json()
    if (!reponse.ok) throw new Error(charge?.raison ?? `l'atelier a répondu ${reponse.status}`)
    return charge as { fichier: string; nom: string }
  },
  creer: (p: string, corps: Record<string, unknown>) => appeler<Entree>(`${base(p)}/entries`, poster(corps)),
}

/** L'adresse d'un média : un fichier copié dans l'entrée, ou un asset de la bibliothèque, par référence. */
export const adresseDuMedia = (p: string, e: string, m: Media): string | null =>
  m.asset ? `/api/assets/${encodeURIComponent(m.asset)}/image`
    : m.fichier ? `/api${une(p, e)}/media/${encodeURIComponent(m.fichier.split("/").pop() ?? "")}` : null

export const adresseDesSousTitres = (p: string, e: string, m: Media): string | null =>
  m.sous_titres ? `/api${une(p, e)}/media/${encodeURIComponent(m.sous_titres.split("/").pop() ?? "")}` : null

/** Le flux d'évènements annonce chaque geste du registre (`atelier:registre`). */
export const EVENEMENT_REGISTRE = "atelier:registre"
