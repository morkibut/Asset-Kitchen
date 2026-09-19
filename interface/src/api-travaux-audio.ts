import { appeler } from "./api"
import type { Travail } from "./api-travaux"
import type { FamilleSon } from "./api-series-son"

export type DemandeAudio = {
  cle: string; modele: string; prompt: string; prompt_negatif?: string; secondes: number; nom?: string
  options: Record<string, string | number | boolean>
  /** Un son de famille, hors workflow collé (SN2) : `paroles` compose le texte, `partition`
   *  (SN9) part telle quelle, sans repasser par YuE2GenerateABC (« Jouer cette partition »). */
  famille?: FamilleSon; paroles?: string; partition?: string
}
export type TravailAudio = Omit<Travail, "nature" | "demande" | "annonce" | "objectif"> & {
  nature: "audio"; demande: DemandeAudio; son: string | null; snapshot_audio: Omit<DemandeAudio, "cle" | "modele" | "nom">
  annonce: { appels: number; reservation_usd: number; limite: string; mesures: { modele: string; mediane_s: number; temperature: string; mesures: number }[] }
  /** Un tirage d'une série (SN3) : la série et son rang. */
  serie?: { identifiant: string; rang: number }
}
const base = (p: string) => `/projects/${encodeURIComponent(p)}`
export const travauxAudio = {
  preparer: (p: string, d: DemandeAudio) => appeler<TravailAudio>(`${base(p)}/audio-jobs/prepare`, { method: "POST", body: JSON.stringify(d) }),
  lire: (p: string, id: string) => appeler<TravailAudio>(`${base(p)}/production-jobs/${encodeURIComponent(id)}`),
  lancer: (t: TravailAudio) => appeler<TravailAudio>(`${base(t.projet)}/production-jobs/${t.identifiant}/${t.etat === "prepare" ? "start" : "resume"}`, { method: "POST" }),
}
