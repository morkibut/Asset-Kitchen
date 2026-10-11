// Les séries de tirages sonores (SN3), le texte qui part (SN2) et les jeux de
// variantes. Les routes : `atelier/api/texte_son.py`, `atelier/api/variantes_son.py`,
// `atelier/api/workflows.py` (`sound-defaults`) ; les ondes et l'écoute sont
// celles d'un son ordinaire (`atelier/api/sons.py`).
import { appeler } from "./api"
import type { MesuresSon, OndeSon } from "./api-sons"

/** Les sept familles du serveur (`atelier.domaine.projet.FAMILLES_SON`). */
export type FamilleSon = "bruitage" | "interface" | "ambiance" | "musique" | "jingle" | "chanson" | "voix"

/** Un morceau du texte composé, et d'où il vient. */
export type MorceauTexte = { texte: string; source: "description" | "univers" | "gabarit" | "demande" | "profil" | "relu" | "moteur"; champ?: string }
export type Composition = {
  famille: FamilleSon; moteur: string | null; gabarit: string | null
  compose: boolean; raison?: string; erreur?: string; avertissement?: string
  texte?: string; texte_compose?: string; morceaux?: MorceauTexte[]
  texte_negatif?: string; morceaux_negatif?: MorceauTexte[]
  secondes?: number; secondes_demandees?: number; source_secondes?: string
  mesures?: { demandees: number; marge: number; total: number; source: string } | null
  parametres?: Record<string, { valeur: string | number; source: string }>
  langue?: { non_anglais: boolean; indices: string[] }
  source_moteur?: string; modele?: string | null; relu?: boolean
  /** Parmi paroles, tempo, tonalité et mesure : ceux que ce moteur reçoit pour
   *  cette famille. L'écran n'envoie que ceux-là (un réglage qui ne part
   *  nulle part est refusé) et grise les autres. */
  reglages_recus?: ReglageMusique[]
  /** L'usage de bande originale retenu (titre, village…), s'il y en a un. */
  usage?: UsageMusique
  /** Ce qui menace une musique : mots de nappe, interdits de la bande originale. */
  alertes?: string[]
  /** Une reprise : le son de départ (sa durée devient celle du tirage) et la force retenue. */
  source?: { son: string; nom: string; revision: number; secondes: number }
  force?: number
}
export type ReglageMusique = "paroles" | "tempo" | "tonalite" | "mesure"
/** Les usages de bande originale (`atelier.audio.texte.USAGES`). */
export type UsageMusique = "titre" | "village" | "exploration" | "danger" | "jingle" | "chanson"
export type Gabarits = { usages: Record<UsageMusique, { nom: string; description: string; structure: string; tempo: number; mesure: number; mesures: number }> }

/** Ce qu'une demande de son dit — le corps commun à compose, estimate et prepare. */
export type DemandeSon = {
  famille: FamilleSon; prompt: string; modele?: string
  secondes?: number; mesures?: number
  tempo?: number; tonalite?: string; mesure?: number; paroles?: string
  texte_relu?: string
  usage?: UsageMusique
  /** Les réglages propres au moteur (compositeur, température…), par leur clé de profil. */
  options?: Record<string, string | number | boolean>
  /** La graine du premier tirage ; les suivants prennent la suivante. */
  graine?: number
  /** **La reprise d'un son** : l'identifiant d'un son prêt du jeu, rejoué
   *  avec ce texte (même mélodie, même durée). `force` : à quel point le
   *  suivre, de 0,1 à 0,95 (0,6 si absente). */
  source?: string
  force?: number
}
/** `repli` : aucune mesure de ce moteur ici, le temps est l'estimation de
 *  repli par durée de son (ACE-Step 1.5), pas une mesure. */
export type AnnonceTemps = { temps_s: number | null; mesures: number; cout_usd: number; phrase: string; repli?: boolean }
export type Annonce = { nombre: number; famille: FamilleSon | null; modele: string; graine_par_tirage: boolean; annonce: AnnonceTemps; composition: Composition | null }

export type SonDuTirage = {
  identifiant: string; existe: boolean; nom?: string; revision?: number; famille?: string | null
  pret?: boolean; raison?: string; jugement?: string; mesures?: (MesuresSon & { lufs?: number | null }) | null
  sature?: boolean; silencieux?: boolean
}
export type EtatTirage = "a_preparer" | "prepare" | "en_attente" | "en_cours" | "a_reprendre" | "a_verifier" | "externe_inconnu" | "rendu" | "termine" | "annule"
export type TirageSerie = { rang: number; travail: string | null; graine: number | null; etat: EtatTirage; raison: string; prochaine_action: string; son: SonDuTirage | null }
export type SerieSon = {
  identifiant: string; projet: string; cle: string; nom: string; famille: FamilleSon | null; modele: string
  nombre: number; demande: DemandeSon; cree_le: number
  tirages: TirageSerie[]; compte: Record<string, number>
  etat: "terminee" | "en_cours" | "preparee" | "a_reprendre" | "externe_inconnu"
  prochaine_action: string; reste: AnnonceTemps; jeux: string[]
  refus?: { rang: number; raison: string }[]
  relances?: number[]; laisses?: { rang: number; etat: string; raison: string }[]
  /** SN6 : la série part de l'emplacement d'un sujet ; « Garder » range dans son jeu. */
  emplacement?: { sujet: string; cle: string; nom_sujet: string | null; nom: string | null; famille: FamilleSon | null }
}

export type MembreJeu = {
  son: string; rang: number | null; ajoute_le: number
  statut: "present" | "ecarte" | "illisible" | "silencieux" | "supprime"; a_livrer: boolean; signal: string; sature: boolean
  nom: string | null; revision: number | null; famille: string | null; pret: boolean; raison: string
  mesures: (MesuresSon & { lufs?: number | null }) | null
}
export type JeuVariantes = {
  identifiant: string; projet: string; nom: string; famille: FamilleSon | null; serie: string | null; cle: string | null
  membres: MembreJeu[]; sons: string[]; a_livrer: string[]
  signalements: { son: string; statut: string; signal: string }[]; vide: boolean; revision: number; cree_le: number
}

/** `possibles` : les moteurs que l'écran propose pour cette famille, dans
 *  l'ordre du serveur (`atelier/audio/graphes.py`, `POSSIBLES`). */
export type MoteurDeFamille = { famille: FamilleSon; modele: string | null; moteur: string | null; raison?: string; possibles?: string[] }

const base = (p: string) => `/projects/${encodeURIComponent(p)}`
const serie = (p: string, id: string) => `${base(p)}/audio-series/${encodeURIComponent(id)}`
const jeu = (p: string, id: string) => `${base(p)}/sound-variants/${encodeURIComponent(id)}`
const son = (p: string, id: string) => `${base(p)}/sounds/${encodeURIComponent(id)}`
const poster = (corps: unknown) => ({ method: "POST", body: JSON.stringify(corps) })

export const texteSon = {
  /** Ce qui partira, sans rien lancer ni écrire. */
  composer: (p: string, d: DemandeSon) => appeler<Composition>(`${base(p)}/audio-jobs/compose`, poster(d)),
  /** Le moteur par défaut de chaque famille pour ce jeu, ou pourquoi il n'y en a pas. */
  moteurs: (p: string) => appeler<{ familles: Record<FamilleSon, MoteurDeFamille> }>(`/workflow-profiles/sound-defaults?projet=${encodeURIComponent(p)}`),
  /** Les gabarits livrés : les usages de bande originale, leurs structures et leurs exemples. */
  gabarits: () => appeler<Gabarits>(`/sound-templates`),
}

export const seriesSon = {
  annoncer: (p: string, d: DemandeSon & { nombre: number }) => appeler<Annonce>(`${base(p)}/audio-series/estimate`, poster(d)),
  preparer: (p: string, d: DemandeSon & { cle: string; nombre: number; nom?: string }) => appeler<SerieSon>(`${base(p)}/audio-series/prepare`, poster(d)),
  lire: (p: string, id: string) => appeler<SerieSon>(serie(p, id)),
  /** Toutes les séries du jeu, la plus récente d'abord. */
  lister: (p: string) => appeler<SerieSon[]>(`${base(p)}/audio-series`),
  demarrer: (p: string, id: string) => appeler<SerieSon>(`${serie(p, id)}/start`, { method: "POST" }),
  reprendre: (p: string, id: string) => appeler<SerieSon>(`${serie(p, id)}/resume`, { method: "POST" }),
  /** Le premier « Garder » d'une série : forme son jeu de variantes et pose
   *  sur chaque son les réglages de sa famille, en nouvelle version. */
  garder: (p: string, id: string, corps: ({ rangs: number[] } | { sons: string[] }) & { nom?: string; cle?: string }) => appeler<JeuVariantes>(`${serie(p, id)}/keep`, poster(corps)),
}

export const jeuxDeVariantes = {
  lire: (p: string, id: string) => appeler<JeuVariantes>(jeu(p, id)),
  lister: (p: string, sonId?: string) => appeler<JeuVariantes[]>(`${base(p)}/sound-variants${sonId ? `?son=${encodeURIComponent(sonId)}` : ""}`),
  /** `appliquer_reglages` : chaque son reçoit les réglages de la famille du jeu, comme « Garder ». */
  creer: (p: string, corps: { nom: string; sons: string[]; famille?: FamilleSon; appliquer_reglages?: boolean }) => appeler<JeuVariantes>(`${base(p)}/sound-variants`, poster(corps)),
  renommer: (p: string, id: string, nom: string) => appeler<JeuVariantes>(jeu(p, id), { method: "PATCH", body: JSON.stringify({ nom }) }),
  ajouter: (p: string, id: string, sonId: string, appliquerReglages = false) =>
    appeler<JeuVariantes>(`${jeu(p, id)}/sounds`, poster(appliquerReglages ? { son: sonId, appliquer_reglages: true } : { son: sonId })),
  retirer: (p: string, id: string, sonId: string) => appeler<JeuVariantes>(`${jeu(p, id)}/sounds/${encodeURIComponent(sonId)}`, { method: "DELETE" }),
}

/** L'onde et l'écoute d'un son, par son identifiant et sa version. */
export const ecoute = {
  onde: (p: string, id: string, revision: number) => appeler<OndeSon>(`${son(p, id)}/waveform?revision=${revision}&brut=false`),
  adresse: (p: string, id: string, revision: number) => `/api${son(p, id)}/preview.wav?revision=${revision}&brut=false`,
}
