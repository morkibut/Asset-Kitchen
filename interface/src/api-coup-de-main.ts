// Le coup de main, côté écran (CM3) — trois routes, `docs/PLAN-assistant.md`.
//
// `demander` lit la réponse **au fil de l'eau** : une ligne JSON par morceau
// (`application/x-ndjson`), `texte` plusieurs fois, puis un seul `fin` ou un seul
// `indisponible`. Couper le `signal` (Échap) referme la lecture, donc la liaison
// avec l'atelier, qui raccroche à son tour chez le fournisseur (CM1).
import { appeler } from "./api"

export type EtatCoupDeMain = { disponible: boolean; raison: string | null; modele: string }

/** Ce qui part, en quatre morceaux dont les deux messages sont faits, au caractère près. */
export type CeQuiPart = {
  morceaux: { titre: string; texte: string }[]
  systeme: string
  message: string
  jamais: string
}

export type Fin = {
  genre: "fin"; issue: "repondu" | "echoue" | "abandonne" | "interrompu"
  raison: string | null; consomme: number; unite: string; cout_usd: number; cout_inconnu: boolean
}
export type Morceau = { genre: "texte"; texte: string } | { genre: "indisponible"; raison: string | null } | Fin

/** Ce que l'écran envoie : le texte, le champ qu'il remplit, et le jeu. Jamais une consigne. */
export type Demande = { texte: string; champ: string; projet?: string }

async function lireLeFlux(corps: ReadableStream<Uint8Array>, onMorceau: (m: Morceau) => void): Promise<Morceau | null> {
  const lecteur = corps.getReader()
  const decodeur = new TextDecoder()
  let reste = ""
  let dernier: Morceau | null = null
  const traiter = (ligne: string) => {
    if (!ligne.trim()) return
    let m: Morceau
    try { m = JSON.parse(ligne) as Morceau } catch { return }
    dernier = m
    onMorceau(m)
  }
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    reste += decodeur.decode(value, { stream: true })
    const lignes = reste.split("\n")
    reste = lignes.pop() ?? ""
    lignes.forEach(traiter)
  }
  traiter(reste + decodeur.decode())
  return dernier
}

export const coupDeMain = {
  etat: () => appeler<EtatCoupDeMain>("/assist"),
  ceQuiPart: (metier: string, d: Demande) =>
    appeler<CeQuiPart>(`/assist/${encodeURIComponent(metier)}/preview`, { method: "POST", body: JSON.stringify(d) }),
  /** Le dernier morceau (`fin` ou `indisponible`), ou `null` si le flux s'est tu sans lui.
   *  Lève si l'atelier refuse la demande ou si le `signal` est coupé. */
  demander: async (metier: string, d: Demande, onMorceau: (m: Morceau) => void, signal?: AbortSignal): Promise<Morceau | null> => {
    const reponse = await fetch(`/api/assist/${encodeURIComponent(metier)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d), signal,
    })
    if (!reponse.ok || !reponse.body) throw new Error(`refusé (${reponse.status})`)
    return lireLeFlux(reponse.body, onMorceau)
  },
}

/** Ce que « Garder » met dans le champ : une ligne, sans les guillemets qu'un modèle
 *  ajoute parfois malgré la consigne. Rien d'autre n'est retouché. */
export function nettoyer(texte: string): string {
  let t = texte.replace(/\s+/g, " ").trim()
  const paires: [string, string][] = [["\"", "\""], ["«", "»"], ["“", "”"], ["'", "'"]]
  for (const [a, b] of paires)
    if (t.length >= 2 && t.startsWith(a) && t.endsWith(b)) { t = t.slice(a.length, t.length - b.length).trim(); break }
  return t
}
