// Les sons d'interface et rétro, par sfxr (SN8) : sans ComfyUI, en un instant.
// Routes : `atelier/api/sfxr.py`. Un son rendu est un son ordinaire (`api-sons.ts`).
import { appeler } from "./api"
import type { Son } from "./api-sons"
import { jeuxDeVariantes, type JeuVariantes } from "./api-series-son"

const base = (p: string) => `/projects/${encodeURIComponent(p)}/sounds/sfxr`
const poster = (corps: unknown) => ({ method: "POST", body: JSON.stringify(corps) })

/** Une graine au hasard : le serveur l'exige, et deux clics donnent deux sons. */
export const graineAuHasard = () => Math.floor(Math.random() * 2_147_483_647)

type Depuis = { depart: string; parametres?: undefined } | { parametres: Record<string, unknown>; depart?: undefined }

export const sfxr = {
  departs: (p: string) => appeler<string[]>(`${base(p)}/starts`),
  fabriquer: (p: string, depuis: Depuis & { graine: number; nom?: string }) => appeler<Son>(base(p), poster(depuis)),
  /** Le serveur range aussi un jeu de variantes qui les liste toutes (famille interface). */
  variantes: (p: string, depuis: Depuis & { graine: number; nombre: number; nom?: string }) => appeler<Son[]>(`${base(p)}/variants`, poster(depuis)),
}

/** **Garder** des sons sfxr. Tirer des variantes range déjà, côté serveur, un
 *  jeu qui les contient toutes : on le ramène aux sons gardés (et à son nom)
 *  plutôt que d'en créer un second à côté. Sans ce jeu (un son seul), on en crée un.
 *  `deja` : le jeu formé par un premier « garder » ; on l'ajuste au nouveau choix. */
export async function garderSfxr(projet: string, tous: string[], gardes: string[], nom: string, deja?: JeuVariantes | null): Promise<JeuVariantes> {
  let jeu = deja ?? null
  if (!jeu) {
    const candidats = tous.length ? await jeuxDeVariantes.lister(projet, tous[0]) : []
    jeu = candidats.find((j) => (j.cle ?? "").startsWith("sfxr-variantes:") && j.sons.length === tous.length && tous.every((s) => j.sons.includes(s))) ?? null
  }
  if (!jeu) return jeuxDeVariantes.creer(projet, { nom, sons: gardes, famille: "interface" })
  for (const s of gardes.filter((s) => !jeu!.sons.includes(s))) jeu = await jeuxDeVariantes.ajouter(projet, jeu.identifiant, s)
  for (const s of jeu.sons.filter((s) => !gardes.includes(s))) jeu = await jeuxDeVariantes.retirer(projet, jeu.identifiant, s)
  if (nom.trim() && nom.trim() !== jeu.nom) jeu = await jeuxDeVariantes.renommer(projet, jeu.identifiant, nom.trim())
  return jeu
}
