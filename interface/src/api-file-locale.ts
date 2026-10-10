import { appeler } from "./api"

export type EtapeLocale = {
  identifiant: string; cle: string; projet: string | null; acteur: "auteur" | "agent"
  nature: "image" | "video" | "modele3d" | "rig" | "rendu3d" | "audio"
  moteur: string; modele: string
  etat: "en_attente" | "en_cours" | "a_reprendre" | "externe_inconnu" | "termine" | "echoue" | "annule"
  travail_externe: string | null; raison: string; soumission_engagee: boolean
  cree_le: number; demarre_le: number | null; termine_le: number | null; duree_s: number | null
  temperature: "froid" | "chaud" | "inconnue"
}
export type MoteurLocal = {
  identifiant: string; nom: string; etat: "disponible" | "occupe" | "inconnu"
  raison?: string; travaux: unknown[]; observe_le: number; annulation_ciblee: boolean
}
export type MesureLocale = { moteur: string; modele: string; temperature: EtapeLocale["temperature"]; mesures: number; mediane_s: number }
// La veille de la file (10 octobre 2026) : présente seulement quand la file
// n'a pas avancé depuis trop longtemps — une phrase qui nomme l'étape qui la tient.
export type AlerteFileLocale = { phrase: string; etape: string; depuis_s: number; seuil_s: number }
export type FileLocale = { etapes: EtapeLocale[]; regle: string; mesures: MesureLocale[]; alerte?: AlerteFileLocale | null; retard_boucle_s?: number }
export const fileLocale = {
  lire: () => appeler<FileLocale>("/local-queue"),
  moteurs: () => appeler<{ moteurs: MoteurLocal[] }>("/local-queue/engines"),
  reprendre: (id: string) => appeler<EtapeLocale>(`/local-queue/${encodeURIComponent(id)}/resume`, { method: "POST" }),
  annuler: (id: string) => appeler<EtapeLocale>(`/local-queue/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
}
