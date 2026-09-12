import { appeler, type Asset, type Piece } from "./api"
import type { CheminEmploi, CibleCalque, ImageCible, VarianteCalque } from "./api-calques"

export type EtatCouverture = "absente" | "a-extraire" | "a-verifier" | "prete" | "a-revoir"
export const ETATS_EQUIPEMENT: Record<EtatCouverture, string> = { absente: "Absente", "a-extraire": "À extraire", "a-verifier": "À vérifier", prete: "Prête", "a-revoir": "À revoir" }
export type CibleCouverte = ImageCible & { etat: EtatCouverture; variante: string | null; fabricable: boolean; raison: string; variantes?: VarianteCalque[] }
type Compte = Record<EtatCouverture, number> & { bases_attendues: number; bases_absentes: number; bases_a_choisir: number; images_connues: number }
export type CouvertureEquipement = {
  piece: Piece; images: Compte; animations: Compte; prete: boolean; cibles: CibleCouverte[]
  cases: { identifiant: string; nature: "image" | "animation"; pose: string; nom_pose: string; direction: string; nom_direction: string
    demandee: boolean; bases_attendues: number; bases_absentes: number; bases_a_choisir: number; raison: string; prete: boolean
    versions: { resultat: string; nom: string; choisie: boolean; etat: string; a_confirmer: boolean; images: CibleCouverte[] }[] }[]
}
export type DemandeEquipement = {
  cle: string; modele: string; cibles?: CibleCalque[] | null; resultats?: string[] | null
  methode?: "planches" | "images"; cases_par_planche?: number; prompt?: string; prompt_negatif?: string; repris?: boolean
  resolution?: string | null; proportions?: string; options?: Record<string, unknown>; references?: string[]
  references_ecartees?: string[]; tri?: unknown; reservation_par_appel_usd?: number | null; occupation?: number; textes_appels?: Record<string, string>
}
export type TravailEquipement = {
  nature: "equipement"; identifiant: string; projet: string; piece: string; emploi: string; personnage: string
  acteur: "auteur" | "agent"; cle: string; cree_le: number; etape: string
  etat: "prepare" | "en_cours" | "a_reprendre" | "a_verifier" | "externe_inconnu" | "termine" | "annule"
  demande: DemandeEquipement; piece_fiche: Piece; variantes: string[]; raison?: string
  cibles: { cible: CibleCalque; base: { pose: string; direction: string }; url: string; variante: string | null }[]
  catalogue: { modele: string; fournisseur: string; references_max: number; capacite_cases_max: number | null; capacite_explication: string }
  appels: { numero: number; generation: string; cibles: number[]; etat: string; raison?: string; retour_url?: string
    snapshot: { prompt: string; prompt_negatif: string; proportions: string; resolution: string | null; options: Record<string, unknown> }
    references: { url: string; reference: { asset: string; role: string } | null }[]
    hors_plafond: { asset: string; role: string }[]; reservation_usd: number
    pliage: { occupation: number; colonnes: number; lignes: number; attend_un_choix: boolean }
    consommation_annoncee: { montant: number | null; unite: string | null; mesuree: boolean }
    temps_local?: { raison?: string; mesures: { temperature: string; mediane_s: number; mesures: number }[] } | null }[]
  annonce: { images_ciblees: number; planches: number; appels: number; reservation_usd: number; limite: string; origine: string }
  consommations: { generation: string; modele: string; consomme: number; unite: string; cout_usd: number }[]
}
const prefixe = (c: CheminEmploi) => `/projects/${encodeURIComponent(c.projet)}/equipment/${encodeURIComponent(c.piece)}/uses/${encodeURIComponent(c.emploi)}`
const suivi = (c: CheminEmploi, id: string) => `/projects/${encodeURIComponent(c.projet)}/production-jobs/${encodeURIComponent(id)}`
const post = (body?: unknown) => ({ method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) })
export const equipements = {
  couverture: (c: CheminEmploi, resultats?: string[]) => appeler<CouvertureEquipement>(`${prefixe(c)}/coverage${resultats ? `?${new URLSearchParams(resultats.map((r) => ["resultats", r]))}` : ""}`),
  preparer: (c: CheminEmploi, d: DemandeEquipement) => appeler<TravailEquipement>(`${prefixe(c)}/jobs/preview`, post(d)),
  lister: async (c: CheminEmploi) => (await appeler<TravailEquipement[]>(`/projects/${encodeURIComponent(c.projet)}/production-jobs`)).filter((t) => t.nature === "equipement" && t.piece === c.piece && t.emploi === c.emploi),
  lire: (c: CheminEmploi, id: string) => appeler<TravailEquipement>(suivi(c, id)),
  demarrer: (c: CheminEmploi, id: string, reprise = false) => appeler<TravailEquipement>(`${suivi(c, id)}/${reprise ? "resume" : "start"}`, post()),
  annuler: (c: CheminEmploi, id: string) => appeler<TravailEquipement>(`${prefixe(c)}/jobs/${encodeURIComponent(id)}/cancel`, post()),
  confirmer: (c: CheminEmploi, id: string, appel: number) => appeler<TravailEquipement>(`${prefixe(c)}/jobs/${encodeURIComponent(id)}/sheets/${appel}/confirm`, post()),
}
export type OuvrirCalque = (cible: CibleCalque, variante?: string) => void
export type ReferenceEquipement = Pick<Asset, "identifiant" | "label" | "empreinte">
export type { VarianteCalque }
