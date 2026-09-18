import { appeler, type ApercuLivraison } from "./api"

/** Les familles gagnées par SN4 : `mono`, `cible_lufs` (niveau perçu, appliqué
 *  comme un gain, crête vraie plafonnée à −1 dBTP), `hauteur_demi_tons`,
 *  `boucle_zero` (recaler les repères sur un passage par zéro) et
 *  `boucle_fondu_ms` (fondu enchaîné de la boucle) s'ajoutent aux réglages
 *  d'AU14 ; une recette ancienne les vaut tous à leur valeur inerte. */
export type RecetteSon = {
  debut: number; fin: number | null; rogner_silence: boolean; seuil_silence_db: number; marge_silence_ms: number
  fondu_entree_ms: number; fondu_sortie_ms: number; normaliser: boolean; cible_db: number; gain_db: number
  taux: number | null; boucle: boolean; boucle_debut: number; boucle_fin: number | null
  boucle_zero: boolean; boucle_fondu_ms: number
  mono: boolean; cible_lufs: number | null; hauteur_demi_tons: number; hauteur_garde_duree: boolean
}
export type MesuresSon = {
  duree: number; taux: number; canaux: number; echantillons: number
  crete_db: number | null; rms_db: number | null; silencieux: boolean; ecretes: number
  lufs?: number | null; crete_vraie_db?: number | null
  niveau?: { cible_lufs: number | null; applique: boolean; gain_db: number; plafonne: boolean; lufs_avant?: number; raison: string } | null
  boucle?: {
    active: boolean; debut: number; fin: number
    recale_zero?: boolean; fondu_ms?: number
    ecart_raccord: number | null; ecart_rms_db?: number | null; verdict?: "raccord net" | "le raccord claque" | null
  }
}
export type JugementSon = "a-juger" | "retenue" | "ecartee"
/** Les sept familles du jeu (archi-son §3) ; `null` : un son sans famille,
 *  qui se livre encore à l'ancienne (AU14, PCM dans le `.tres`). */
export type FamilleSon = "bruitage" | "interface" | "ambiance" | "musique" | "chanson" | "jingle" | "voix"
/** Le niveau perçu (LUFS) n'a de sens que sur ces familles-là : trop court
 *  pour un bruitage ou un son d'interface, qui se règlent sur leur crête.
 *  Doit rester aligné sur les familles dont `cible_lufs` n'est pas `None`
 *  côté serveur (`atelier/domaine/son.py`, `FAMILLES`). */
export const FAMILLES_AVEC_LUFS: readonly FamilleSon[] = ["ambiance", "musique", "chanson", "jingle", "voix"]
export const NOMS_FAMILLES_SON: Record<FamilleSon, string> = {
  bruitage: "Bruitage", interface: "Interface et rétro", ambiance: "Ambiance",
  musique: "Musique", chanson: "Chanson", jingle: "Jingle", voix: "Voix",
}
export type Son = {
  identifiant: string; projet: string; nom: string; revision: number; revision_courante: number
  pret: boolean; etat: string; raison: string; jugement: JugementSon
  source: { nom: string; empreinte: string; octets: number; mesures?: MesuresSon }
  provenance: Record<string, unknown>; recette: RecetteSon; mesures: MesuresSon | null
  famille: FamilleSon | null; avertissements: string[]
  /** La recette de la famille posée par-dessus la recette courante — proposée,
   *  jamais imposée : c'est le geste « Appliquer les réglages de la famille »
   *  qui la prend. `null` sans famille. */
  recette_proposee: RecetteSon | null
  versions: { revision: number; nom: string; pret: boolean; jugement: JugementSon; mesures: MesuresSon | null; famille?: FamilleSon | null; avertissements?: string[] }[]
}
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
  /** Pose (ou change) la famille du son ; `appliquerReglages` prend en même
   *  temps les réglages qu'elle propose (route `PUT …/family`, SN4). */
  classer: (s: Son, famille: FamilleSon | null, appliquerReglages = false) =>
    appeler<Son>(chemin(s.projet, s.identifiant) + "/family", { method: "PUT", body: JSON.stringify({ revision: s.revision_courante, famille, appliquer_reglages: appliquerReglages }) }),
  onde: (s: Son, brut = false) => appeler<OndeSon>(chemin(s.projet, s.identifiant) + `/waveform?revision=${s.revision}&brut=${brut}`),
  audio: (s: Son, brut = false) => "/api" + chemin(s.projet, s.identifiant) + `/preview.wav?revision=${s.revision}&brut=${brut}`,
  /** Les deux secondes autour du point de boucle, fin puis début, exactement
   *  dans l'ordre où Godot les joue au saut : « Écouter le raccord ». */
  raccord: (s: Son) => "/api" + chemin(s.projet, s.identifiant) + `/loop-splice.wav?revision=${s.revision}`,
  source: (s: Son) => "/api" + chemin(s.projet, s.identifiant) + "/source",
  archive: (s: Son) => "/api" + chemin(s.projet, s.identifiant) + `/export.zip?revision=${s.revision}`,
  livraison: (s: Son) => appeler<ApercuLivraison>(chemin(s.projet, s.identifiant) + "/delivery/preview", { method: "POST", body: JSON.stringify({ revision: s.revision }) }),
}
