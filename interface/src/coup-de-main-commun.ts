// Ce que les trois gestes du coup de main partagent à l'écran (relecture croisée
// du 25 septembre 2026, `docs/PLAN-assistant.md`) : la marque « EN »
// (`CoupDeMain.tsx`, CM3/CM7), la ligne de question (`DemanderIci.tsx`, CM4) et
// « pourquoi › » (`pieces.tsx`, CM5).
//
// Les trois tranches avaient chacune recopié les deux mêmes choses, **à dessein**
// pour ne pas se marcher dessus pendant qu'elles avançaient en parallèle. Assemblées,
// les copies se composaient mal :
//
// - **Un appel par champ.** Chaque marque lisait `GET /api/assist` à son montage :
//   un écran de vingt champs de prompt en faisait vingt, pour la même réponse. Et une
//   marque qui apprenait « plafond atteint » se taisait seule : ses voisines restaient
//   à l'écran, et chacune décevait à son tour (décision 6).
// - **Un Échap pour tout.** Chacune écoutait Échap sur `window`, en capture, et
//   l'arrêtait par `stopPropagation` — qui n'arrête pas les autres écoutes posées
//   sur le **même** `window`. Une proposition ouverte sous une ligne de question :
//   un seul Échap refermait les deux.
//
// **CM8** (décision de l'auteur, 25 septembre 2026) : le silence de la décision 6
// se scinde en deux. Au plafond du mois, la marque « EN » laisse une trace — une
// ligne grise, sans fenêtre — là où elle serait apparue ; sans clé ou réseau coupé,
// le silence reste entier. `useMotifDIndisponibilite`, ci-dessous, dit lequel des
// deux, partagé comme `useDisponibilite`, une seule lecture pour tout l'écran.

import { useEffect, useRef, useState } from "react"
import { coupDeMain } from "./api-coup-de-main"

// ── La disponibilité : lue une fois pour tout l'écran ────────────────────────

type Motif = "plafond" | "indisponible" | null

let enCours: Promise<{ disponible: boolean; motif: Motif }> | null = null
const abonnes = new Set<(dispo: boolean) => void>()
let dernierMotif: Motif = null
const abonnesMotif = new Set<(motif: Motif) => void>()

/** Une seule lecture à la fois : les vingt champs qui montent ensemble partagent
 *  la même. **Rien n'est gardé une fois la réponse rendue** — un montage plus
 *  tardif relit, comme avant : un plafond relevé entre-temps se voit. */
function lire(): Promise<{ disponible: boolean; motif: Motif }> {
  if (!enCours) {
    enCours = coupDeMain.etat()
      .then((e) => ({ disponible: e.disponible === true, motif: e.disponible ? null : e.motif }))
      .catch(() => ({ disponible: false, motif: null as Motif }))
      .finally(() => { enCours = null })
  }
  return enCours
}

/** Dit à **toutes** les marques montées ce qu'une seule vient d'apprendre. */
export function annoncerDisponibilite(dispo: boolean): void {
  abonnes.forEach((f) => f(dispo))
}

/** Dit à **toutes** les lignes du plafond (CM8) ce qu'une seule vient
 *  d'apprendre. Un échec de flux, isolé, n'apporte aucun motif : il ne fait
 *  jamais croire au plafond, il retombe sur le silence ordinaire. */
function annoncerMotif(motif: Motif): void {
  dernierMotif = motif
  abonnesMotif.forEach((f) => f(motif))
}

/** Relit la disponibilité et l'annonce partout — après un plafond relevé, par
 *  exemple, pour que les marques reviennent sans rouvrir l'écran. */
export function relireDisponibilite(): Promise<void> {
  return lire().then((e) => {
    annoncerDisponibilite(e.disponible)
    annoncerMotif(e.motif)
  })
}

/** La marque paraît-elle ? Tout échec vaut « non » (décision 6). Le second
 *  élément annonce à toutes les marques, pas seulement à celle-ci. */
export function useDisponibilite(): [boolean, (dispo: boolean) => void] {
  const [dispo, setDispo] = useState(false)
  useEffect(() => {
    let vivant = true
    const recevoir = (v: boolean) => { if (vivant) setDispo(v) }
    abonnes.add(recevoir)
    void lire().then((e) => {
      recevoir(e.disponible)
      annoncerMotif(e.motif)
    })
    return () => { vivant = false; abonnes.delete(recevoir) }
  }, [])
  return [dispo, annoncerDisponibilite]
}

/** CM8 — pourquoi le coup de main se tait, quand il se tait : `"plafond"`
 *  (une ligne grise le dit, là où la marque « EN » paraîtrait) ou
 *  `"indisponible"` (pas de clé, réseau coupé — le silence total de la
 *  décision 6). `null` tant que le coup de main répond, ou qu'on ne sait pas
 *  encore. Partage la même lecture que `useDisponibilite`. */
export function useMotifDIndisponibilite(): Motif {
  const [motif, setMotif] = useState<Motif>(dernierMotif)
  useEffect(() => {
    let vivant = true
    const recevoir = (m: Motif) => { if (vivant) setMotif(m) }
    abonnesMotif.add(recevoir)
    void lire().then((e) => recevoir(e.motif))
    return () => { vivant = false; abonnesMotif.delete(recevoir) }
  }, [])
  return motif
}

// ── Échap : un appui referme **le dernier** ouvert, et lui seul ─────────────

const pile: { fermer: () => void }[] = []
let ecoute: ((e: KeyboardEvent) => void) | null = null

function surEchap(e: KeyboardEvent) {
  if (e.key !== "Escape" || pile.length === 0) return
  // `stopImmediatePropagation` et pas seulement `stopPropagation` : les autres
  // écoutes posées sur `window` ne doivent pas refermer l'écran autour.
  e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation()
  pile[pile.length - 1].fermer()
}

/** Pose `fermer` au sommet de la pile d'Échap ; rend de quoi l'en retirer. Une
 *  seule écoute sur `window`, en capture, tant que la pile n'est pas vide. */
export function empilerEchap(fermer: () => void): () => void {
  const entree = { fermer }
  pile.push(entree)
  if (!ecoute) {
    ecoute = surEchap
    window.addEventListener("keydown", ecoute, true)
  }
  return () => {
    const rang = pile.indexOf(entree)
    if (rang >= 0) pile.splice(rang, 1)
    if (pile.length === 0 && ecoute) {
      window.removeEventListener("keydown", ecoute, true)
      ecoute = null
    }
  }
}

/** Tant que `ouvert`, Échap appelle `fermer` — si rien n'a été ouvert après. */
export function useEchap(ouvert: boolean, fermer: () => void): void {
  const derniere = useRef(fermer)
  derniere.current = fermer
  useEffect(() => {
    if (!ouvert) return
    return empilerEchap(() => derniere.current())
  }, [ouvert])
}
