// Les nombres du son, écrits comme la maquette les écrit (`docs/maquettes-atelier-unifie/son.js`) :
// virgule décimale, vrai signe moins, le temps en mots.

const MOINS = "−"
export const virgule = (n: number, d = 2) => n.toFixed(d).replace(".", ",")

/** 0,48 s · 1,5 s · 30 s · 1 min 05 */
export function dureeTexte(s: number): string {
  if (s < 10) return virgule(s, s < 1 ? 2 : 1) + " s"
  if (s < 60) return Math.round(s) + " s"
  const m = Math.floor(s / 60), r = Math.round(s - m * 60)
  return `${m} min ${String(r).padStart(2, "0")}`
}

/** Une durée demandée, sans décimale inutile : 0,5 s · 1 s · 30 s */
export const secondesTexte = (s: number) => virgule(s, s % 1 ? 1 : 0) + " s"

/** −1,2 */
export const decibels = (n: number) => (n < -0.05 ? MOINS : "") + virgule(Math.abs(n), 1)

/** Le temps de calcul annoncé, arrondi comme on le dit. */
export function tempsTexte(s: number): string {
  if (s <= 1) return "un instant"
  if (s < 60) return `environ ${Math.max(5, Math.ceil(s / 5) * 5)} s`
  const m = s / 60
  if (m < 3) { const h = Math.round(m * 2) / 2; return `environ ${Math.floor(h)} min${h % 1 ? " 30" : ""}` }
  return `environ ${Math.round(m)} min`
}

/** « durée · crête · niveau perçu » sous une forme d'onde. */
export function mesuresTexte(m: { duree: number; crete_db: number | null; lufs?: number | null } | null | undefined): string {
  if (!m) return ""
  const parties = [dureeTexte(m.duree)]
  if (m.crete_db != null) parties.push(`crête ${decibels(m.crete_db)} dB`)
  if (m.lufs != null) parties.push(`${m.lufs < -0.5 ? MOINS : ""}${Math.round(Math.abs(m.lufs))} LUFS`)
  return parties.join(" · ")
}
