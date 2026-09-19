// SN9 · « Écrire la partition » de YuE2, seule (le premier étage). « Jouer
// cette partition » n'a pas d'appel à elle : c'est un son ordinaire
// (`travauxAudio.preparer`, `api-travaux-audio.ts`), avec `partition` posé à
// la valeur relue et le modèle du profil « yue2-partition-jouee » (lu dans
// `workflows.lister()`). Route : `atelier/api/partition_son.py`.
import { appeler } from "./api"

export type PartitionSon = {
  identifiant: string; projet: string; prompt: string | null; texte_compose: string
  paroles: string; partition: string; cree_le: number; tempo?: number | null
  /** La demande de « Jouer cette partition » : le style et les paroles qui l'ont
   *  écrite (absente d'une partition écrite avant le 19 septembre 2026). */
  pour_jouer?: { famille: "chanson"; modele: string | null; prompt: string | null; texte_relu: string; paroles: string; partition: string }
}
const base = (p: string) => `/projects/${encodeURIComponent(p)}`
export const partitionSon = {
  /** Bloquant : attend la réponse de YuE2 (plus court qu'une chanson entière, le second étage n'est pas lancé). */
  ecrire: (p: string, corps: { prompt: string; paroles?: string; tempo?: number }) =>
    appeler<PartitionSon>(`${base(p)}/sound-script/write`, { method: "POST", body: JSON.stringify(corps) }),
  lire: (p: string, id: string) => appeler<PartitionSon>(`${base(p)}/sound-script/${encodeURIComponent(id)}`),
}
