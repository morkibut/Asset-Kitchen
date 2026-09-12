import { appeler } from "./api"

export type Camera3D = { azimut: number; elevation: number }
export type Plage3D = { debut: number; fin: number }

export type Personnage3D = { identifiant: string; photo: string; complet: boolean; indisponible_parce_que: string | null; animations_posees: string[] }
export type Corrections3D = {
  adresse: string
  os: { cle: string; libelle: string; aide: string; axes: { nom: string; libelle: string; aide: string }[] }[]
  bornes: { minimum: number; maximum: number; defaut: number; pas: number; unite: string }
  corrections: Record<string, Record<string, number>>; modifie_le: number | string | null
  apercus_perimes?: number; apercus_refaits?: string[]; message?: string
}
export type Rendu3D = { identifiant: string; actif: boolean; etat: string; images: string[]; moteur?: string; reglages: Record<string, string | number | boolean>; message_echec?: string | null; secondes_ecoulees?: number; camera?: Camera3D; plage?: Plage3D }
export type Source3D = { identifiant: string; projet: string; personnage: string | null; nom: string; origine: string; provenance: { adresse: string; personnage: string; rendu: string; reglages: Rendu3D["reglages"]; camera?: Camera3D; plage?: Plage3D; rig_origine?: string; corrections?: Corrections3D["corrections"] }; fichiers: Record<string, string>; images: number; largeur: number; hauteur: number; cadence: number; bandes: string[]; cree_le: number }
export type Catalogue3D = { moteurs_3d: { valeur: string; libelle: string }[]; moteur_3d_defaut: string; animations: string[]; defaut: string; angles: { valeur: string; libelle: string; azimut?: number; elevation?: number }[]; angle_defaut: string; eclairages: { valeur: string; libelle: string }[]; eclairage_defaut: string; styles: { valeur: string; libelle: string }[]; style_defaut: string; bornes: { nom: string; libelle: string; minimum: number; maximum: number; defaut: number; pas: number; entier: boolean; aide: string }[]; camera_libre?: Record<keyof Camera3D, { minimum: number; maximum: number; pas: number }>; plage_animation?: { minimum: number; maximum: number; unite: string } }
export type Demande3D = { cle: string; etape: "modele_3d" | "rig" | "rendu"; personnage?: string; personnage_externe?: string; reference_asset?: string; pose?: string; direction?: string; nom?: string; cadence: number; reglages: Record<string, string | number | boolean>; camera?: Camera3D; plage?: Plage3D }
export type Travail3D = {
  nature: "3d"; identifiant: string; projet: string; acteur: "auteur" | "agent"; demande: Demande3D; modele: string; adresse: string; cree_le: number
  etat: "prepare" | "en_cours" | "a_reprendre" | "a_verifier" | "externe_inconnu" | "termine" | "annule"; etape: Demande3D["etape"]; raison?: string
  apercu_3d: { reglages: Demande3D["reglages"]; etapes_reutilisees?: string[]; parametres_actifs?: string[]; prerequis: { disponible: boolean; raisons: string[]; poids_verifies?: boolean }; camera?: Camera3D; plage?: Plage3D; corrections?: Corrections3D["corrections"]; sortie?: { largeur: number; hauteur: number; cadre: string; fond: string } }
  resultat_3d?: { identifiant: string; personnage: string; etat: string }; fichiers_3d: Record<string, string>; bandes: string[]; etape_locale?: string
  references: { nom: string; url: string; empreinte: string }[]
  annonce: { appels: number; reservation_usd: number; limite: string; mesures: { temperature: string; mediane_s: number; mesures: number }[] }
  consommations: { modele: string; consomme: number; unite: string; cout_usd: number }[]
}
export const sources3d = {
  connexion: () => appeler<{ adresse: string; configure: boolean }>("/3d/connection"),
  configurer: (adresse: string) => appeler<{ adresse: string; configure: boolean }>("/3d/connection", { method: "PUT", body: JSON.stringify({ adresse }) }),
  catalogue: () => appeler<Catalogue3D>("/3d/catalogue"),
  preparer: (projet: string, demande: Demande3D) => appeler<Travail3D>(`/projects/${encodeURIComponent(projet)}/3d/jobs/prepare`, { method: "POST", body: JSON.stringify(demande) }),
  travail: (projet: string, id: string) => appeler<Travail3D>(`/projects/${encodeURIComponent(projet)}/production-jobs/${id}`),
  lancer: (t: Travail3D) => appeler<Travail3D>(`/projects/${encodeURIComponent(t.projet)}/production-jobs/${t.identifiant}/${t.etat === "prepare" ? "start" : "resume"}`, { method: "POST" }),
  reconcilier: (t: Travail3D) => appeler<Travail3D>(`/projects/${encodeURIComponent(t.projet)}/3d/jobs/${t.identifiant}/reconcile`, { method: "POST" }),
  fichierTravail: (t: Travail3D, nom: string) => `/api/projects/${encodeURIComponent(t.projet)}/3d/jobs/${t.identifiant}/files/${encodeURIComponent(nom)}`,
  personnages: () => appeler<{ personnages: Personnage3D[] }>("/3d/characters"),
  corrections: (id: string) => appeler<Corrections3D>(`/3d/characters/${encodeURIComponent(id)}/corrections`),
  poserCorrections: (id: string, corrections: Corrections3D["corrections"], animation?: string) => appeler<Corrections3D>(`/3d/characters/${encodeURIComponent(id)}/corrections`, { method: "PUT", body: JSON.stringify({ corrections, animation }) }),
  rig: (id: string, animation: string, revision: number) => `/api/3d/characters/${encodeURIComponent(id)}/rig?animation=${encodeURIComponent(animation)}&revision=${revision}`,
  rendus: (id: string) => appeler<{ rendus: Rendu3D[] }>(`/3d/characters/${encodeURIComponent(id)}/renders`),
  lister: (projet: string, personnage?: string) => appeler<{ sources: Source3D[] }>(`/projects/${encodeURIComponent(projet)}/3d/sources${personnage ? `?personnage=${encodeURIComponent(personnage)}` : ""}`),
  importer: (projet: string, demande: { personnage_externe: string; rendu: string; personnage?: string; pose?: string; direction?: string; nom: string; cadence: number }) => appeler<Source3D>(`/projects/${encodeURIComponent(projet)}/3d/import`, { method: "POST", body: JSON.stringify(demande) }),
  fichier: (s: Source3D, nom: string) => `/api/projects/${encodeURIComponent(s.projet)}/3d/sources/${s.identifiant}/files/${encodeURIComponent(nom)}`,
  photo: (id: string) => `/api/3d/characters/${encodeURIComponent(id)}/preview`,
}
