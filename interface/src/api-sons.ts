import { appeler, type ApercuLivraison } from "./api"

export type RecetteSon = { debut: number; fin: number | null; rogner_silence: boolean; seuil_silence_db: number; marge_silence_ms: number; fondu_entree_ms: number; fondu_sortie_ms: number; normaliser: boolean; cible_db: number; gain_db: number; taux: number | null; boucle: boolean; boucle_debut: number; boucle_fin: number | null }
export type MesuresSon = { duree: number; taux: number; canaux: number; echantillons: number; crete_db: number | null; rms_db: number | null; silencieux: boolean; ecretes: number; boucle?: { active: boolean; debut: number; fin: number; ecart_raccord: number | null } }
export type JugementSon = "a-juger" | "retenue" | "ecartee"
export type Son = { identifiant: string; projet: string; nom: string; revision: number; revision_courante: number; pret: boolean; etat: string; raison: string; jugement: JugementSon; source: { nom: string; empreinte: string; octets: number; mesures?: MesuresSon }; provenance: Record<string, unknown>; recette: RecetteSon; mesures: MesuresSon | null; versions: { revision: number; nom: string; pret: boolean; jugement: JugementSon; mesures: MesuresSon | null }[] }
export type OndeSon = { duree: number; taux: number; canaux: number; canaux_ondes: { minimum: number[]; maximum: number[] }[] }
const chemin = (p: string, id = "") => `/projects/${encodeURIComponent(p)}/sounds${id ? `/${encodeURIComponent(id)}` : ""}`
export const sons = {
  lister: (p: string) => appeler<Son[]>(chemin(p)),
  lire: (p: string, id: string, revision?: number) => appeler<Son>(chemin(p, id) + (revision ? `?revision=${revision}` : "")),
  importer: async (p: string, fichier: File) => {
    const reponse = await fetch("/api" + chemin(p) + "/import?" + new URLSearchParams({ nom: fichier.name }), { method: "POST", body: fichier, headers: { "Content-Type": "application/octet-stream" } })
    const valeur = await reponse.json()
    if (!reponse.ok) throw new Error(valeur.raison || "L’import du son a échoué.")
    return valeur as Son
  },
  regler: (s: Son, recette: RecetteSon, nom: string) => appeler<Son>(chemin(s.projet, s.identifiant), { method: "PUT", body: JSON.stringify({ revision: s.revision_courante, recette, nom }) }),
  juger: (s: Son, jugement: JugementSon) => appeler<Son>(chemin(s.projet, s.identifiant) + "/judgment", { method: "POST", body: JSON.stringify({ revision: s.revision, jugement }) }),
  restaurer: (s: Son) => appeler<Son>(chemin(s.projet, s.identifiant) + "/restore", { method: "POST", body: JSON.stringify({ revision: s.revision_courante, depuis: s.revision }) }),
  onde: (s: Son, brut = false) => appeler<OndeSon>(chemin(s.projet, s.identifiant) + `/waveform?revision=${s.revision}&brut=${brut}`),
  audio: (s: Son, brut = false) => "/api" + chemin(s.projet, s.identifiant) + `/preview.wav?revision=${s.revision}&brut=${brut}`,
  source: (s: Son) => "/api" + chemin(s.projet, s.identifiant) + "/source",
  archive: (s: Son) => "/api" + chemin(s.projet, s.identifiant) + `/export.zip?revision=${s.revision}`,
  livraison: (s: Son) => appeler<ApercuLivraison>(chemin(s.projet, s.identifiant) + "/delivery/preview", { method: "POST", body: JSON.stringify({ revision: s.revision }) }),
}
