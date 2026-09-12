import { appeler } from "./api"
import type { DemandeTravail, Travail } from "./api-travaux"

export type DemandeVideoLibre = Omit<DemandeTravail, "personnage" | "pose" | "direction"> & {
  personnage?: null; pose?: null; direction?: null
}
export type TravailVideoLibre = Omit<Travail, "nature" | "demande" | "objectif"> & {
  nature: "video-libre"; demande: DemandeVideoLibre; objectif: null
}
const travail = (p: string, id: string) => `/projects/${encodeURIComponent(p)}/production-jobs/${encodeURIComponent(id)}`
export const videoLibre = {
  preparer: (p: string, demande: DemandeVideoLibre) => appeler<TravailVideoLibre>(`/projects/${encodeURIComponent(p)}/free-video-jobs/prepare`, { method: "POST", body: JSON.stringify(demande) }),
  lire: (p: string, id: string) => appeler<TravailVideoLibre>(travail(p, id)),
  demarrer: (p: string, id: string) => appeler<TravailVideoLibre>(`${travail(p, id)}/start`, { method: "POST" }),
  reprendre: (p: string, id: string) => appeler<TravailVideoLibre>(`${travail(p, id)}/resume`, { method: "POST" }),
}
