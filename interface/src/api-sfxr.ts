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
  variantes: (p: string, depuis: Depuis & { graine: number; nombre: number; nom?: string }) => appeler<Son[]>(`${base(p)}/variants`, poster(depuis)),
}

/** Le premier son rétro gardé forme le jeu de variantes (famille interface),
 *  avec les réglages de la famille posés en nouvelle version — le même chemin
 *  qu'une série. Tirer ne range aucun jeu : seul « Garder » en forme un.
 *  `avecSonExistant` : un son seul déjà posé sur l'emplacement (pas encore un
 *  jeu) devient le premier du jeu, comme `garder_depuis_serie` le fait pour
 *  une série ordinaire — sinon il resterait orphelin, remplacé en silence. */
export const formerJeuSfxr = (projet: string, son: string, nom: string, avecSonExistant?: string): Promise<JeuVariantes> =>
  jeuxDeVariantes.creer(projet, {
    nom, famille: "interface", appliquer_reglages: true,
    sons: avecSonExistant && avecSonExistant !== son ? [avecSonExistant, son] : [son],
  })
