import { appeler, type AttenteVideo, type PrixVideo, type ObjectifProduction } from "./api"

export type CadreDelegation = {
  autoriser_local: boolean; autoriser_payant: boolean
  modeles_image: string[]; modeles_video: string[]
  plafond_appels: number; plafond_usd: number; livraison_provisoire: boolean
  origine?: string
}
export type DemandeTravail = {
  cle: string; personnage: string; pose: string; direction: string
  reference_asset?: string | null; modele_image?: string | null; prompt_image?: string
  references_image?: string[]; references_image_ecartees?: string[]; repris_image?: boolean
  options_image?: Record<string, unknown>; options_video?: Record<string, unknown>
  proportions_image?: string; resolution_image?: string | null; prompt_negatif_image?: string
  modele_video: string; prompt_video: string; secondes: number; resolution: string; proportions: string
  nombre_images: number; cadence: number; sens: "boucle" | "aller-retour"
  livrer_provisoire?: boolean; plafond_image_usd?: number | null
}
export type Travail = {
  identifiant: string; projet: string; cle: string; acteur: "auteur" | "agent"
  etat: "prepare" | "en_cours" | "a_reprendre" | "a_verifier" | "externe_inconnu" | "termine" | "annule"
  etape_locale?: string | null
  etape: string; demande: DemandeTravail; cree_le: number; modifie_le?: number
  reference_asset: string | null; clip: string | null; bandes: string[]
  references: { asset?: string | null; nom: string; url: string; empreinte: string }[]
  entree_video?: { url: string; empreinte: string }
  envoi_image?: { prompt: string; prompt_negatif?: string; options: Record<string, unknown>; proportions: string; resolution?: string | null }
  objectif: ObjectifProduction
  annonce: { image_usd: number; video: PrixVideo; temps_local: AttenteVideo | null
    reservation_usd: number; appels: number; limite: string; video_locale: boolean }
  consommations: { generation: string; modele: string; consomme: number; unite: string; cout_usd: number }[]
  raison?: string; prochaine_action: string; livraison?: string | null
}
const chemin = (projet: string) => `/projects/${encodeURIComponent(projet)}`
const travail = (projet: string, id: string) => `${chemin(projet)}/production-jobs/${encodeURIComponent(id)}`
export const travaux = {
  cadre: (projet: string) => appeler<CadreDelegation>(`${chemin(projet)}/delegation`),
  reglerCadre: (projet: string, cadre: CadreDelegation) => {
    const { origine: _origine, ...reglages } = cadre
    return appeler<CadreDelegation>(`${chemin(projet)}/delegation`, { method: "PUT", body: JSON.stringify(reglages) })
  },
  lister: (projet: string) => appeler<Travail[]>(`${chemin(projet)}/production-jobs`),
  preparer: (projet: string, demande: DemandeTravail) => appeler<Travail>(`${chemin(projet)}/production-jobs/preview`, { method: "POST", body: JSON.stringify(demande) }),
  lire: (projet: string, id: string) => appeler<Travail>(travail(projet, id)),
  demarrer: (projet: string, id: string) => appeler<Travail>(`${travail(projet, id)}/start`, { method: "POST" }),
  reprendre: (projet: string, id: string) => appeler<Travail>(`${travail(projet, id)}/resume`, { method: "POST" }),
}
