// **Interface et rétro** (SN8) : pas de phrase. On part d'un départ (clic,
// saut, pièce…), sfxr calcule ici, en un instant, sans ComfyUI ; on tire des
// variantes, on les écoute dans la même grille, on garde — « Garder » écrit
// tout de suite, comme pour une série : le premier gardé forme le jeu.
import { useEffect, useState } from "react"
import type { Son } from "../api-sons"
import type { JeuVariantes } from "../api-series-son"
import { formerJeuSfxr, graineAuHasard, sfxr } from "../api-sfxr"
import { GrilleEcoute, tuileDeSon, type TuileSon } from "./GrilleEcoute"
import { JeuDeVariantes, useGarde } from "./JeuDeVariantes"

const PUCE = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle aria-pressed:border-encre-3 aria-pressed:bg-ligne-ouverte aria-pressed:text-encre disabled:opacity-50"
const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const PRINCIPAL = "min-h-[30px] rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal disabled:opacity-50"
const message = (e: unknown) => e instanceof Error ? e.message : "sfxr n’a pas pu calculer ce son."

/** Les départs de sfxr, en mots. L'ordre est celui de la maquette ; un départ
 *  que le serveur ajouterait se montre à la fin, sous son nom. */
const DEPARTS: [string, string][] = [["clic", "Clic"], ["survol", "Survol"], ["validation", "Validation"], ["erreur", "Erreur"], ["jump", "Saut"], ["pickup_coin", "Pièce"], ["explosion", "Explosion"],
  ["blip_select", "Sélection"], ["power_up", "Bonus"], ["hit_hurt", "Coup reçu"], ["laser_shoot", "Tir laser"]]
const nomDuDepart = (id: string) => DEPARTS.find(([i]) => i === id)?.[1] ?? id
const NOMBRES = [4, 8, 12]

export function SonRetro({ projet, onRegler }: { projet: string; onRegler?: (son: string) => void }) {
  const [departs, setDeparts] = useState<string[]>([])
  const [depart, setDepart] = useState("clic")
  const [nombre, setNombre] = useState(8)
  const [sons, setSons] = useState<Son[]>([])
  const [jeu, setJeu] = useState<JeuVariantes | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    sfxr.departs(projet).then((d) => {
      if (!vivant) return
      const connus = DEPARTS.map(([i]) => i).filter((i) => d.includes(i))
      setDeparts([...connus, ...d.filter((i) => !connus.includes(i))])
      setDepart((x) => d.includes(x) ? x : connus[0] ?? d[0] ?? x)
    }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet])

  const garde = useGarde({ projet, jeu, onJeu: setJeu, former: (son) => formerJeuSfxr(projet, son, nomDuDepart(depart)) })
  const tirer = async (geste: () => Promise<Son[]>, bouton: HTMLButtonElement) => {
    // Le bouton rend le focus : Espace écoute ensuite le tirage choisi, il ne retire pas.
    bouton.blur()
    setOccupe(true); setErreur("")
    try { const neufs = await geste(); setSons(neufs); setJeu(null) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  // Un son seul se décline à partir de ses propres réglages ; sinon on part du départ.
  const seul = sons.length === 1 ? sons[0] : null
  const reglagesDuSeul = seul?.provenance && typeof seul.provenance === "object" ? (seul.provenance as { parametres?: Record<string, unknown> }).parametres : undefined
  const unSon = (b: HTMLButtonElement) => tirer(async () => [await sfxr.fabriquer(projet, { depart, graine: graineAuHasard(), nom: nomDuDepart(depart) })], b)
  const variantes = (b: HTMLButtonElement) => tirer(() => reglagesDuSeul
    ? sfxr.variantes(projet, { parametres: reglagesDuSeul, graine: graineAuHasard(), nombre, nom: seul!.nom })
    : sfxr.variantes(projet, { depart, graine: graineAuHasard(), nombre, nom: nomDuDepart(depart) }), b)
  const gardes = new Set(sons.flatMap((s, i) => garde.garde(s.identifiant) ? [i + 1] : []))
  const basculer = (rang: number) => { const s = sons[rang - 1]; if (s) garde.basculer(s.identifiant) }
  // Un son gardé a reçu les réglages de sa famille : la grille montre sa version gardée.
  const membre = (id: string) => jeu?.membres.find((m) => m.son === id)
  const tuiles = sons.map((s, i): TuileSon => {
    const t = tuileDeSon(s, i + 1)
    const m = membre(s.identifiant)
    return m?.revision != null && m.mesures && t.son ? { ...t, son: { ...t.son, revision: m.revision, mesures: m.mesures, sature: m.sature, silencieux: m.mesures.silencieux } } : t
  })

  return <>
    <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Départ">
      <span className="min-w-[54px] text-[12px] text-encre-3">Départ</span>
      {departs.map((d) => <button key={d} type="button" className={PUCE} aria-pressed={d === depart} disabled={occupe} onClick={() => setDepart(d)}>{nomDuDepart(d)}</button>)}
    </div>
    <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Nombre de variantes">
      <span className="min-w-[54px] text-[12px] text-encre-3">Variantes</span>
      {NOMBRES.map((n) => <button key={n} type="button" className={PUCE} aria-pressed={n === nombre} onClick={() => setNombre(n)}>{n}</button>)}
    </div>
    <p className="text-[12px] text-encre-3">Aucun texte ne part : sfxr part du départ choisi. Le calcul se fait ici, en un instant.</p>
    <div className="flex flex-wrap items-center justify-end gap-[8px] pt-[4px]">
      <button type="button" className={BOUTON} disabled={occupe || !departs.length} onClick={(e) => void unSon(e.currentTarget)}>Un son</button>
      <button type="button" className={PRINCIPAL} disabled={occupe || !departs.length} onClick={(e) => void variantes(e.currentTarget)}>{reglagesDuSeul ? `Tirer ${nombre} variantes de ce son` : `Tirer ${nombre} variantes`}</button>
    </div>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {garde.erreur && <p role="alert" className="text-[13px] text-echec">{garde.erreur}</p>}
    {sons.length > 0 && <section aria-label="Les sons rétro" className="mt-[14px]">
      <GrilleEcoute projet={projet} tuiles={tuiles} gardes={gardes} onGarder={basculer} onRegler={onRegler} />
      {gardes.size === 0 && <p className="mt-[14px] text-[12px] text-encre-3">Gardez un ou plusieurs sons. Les autres restent dans la galerie.</p>}
      {jeu && jeu.membres.length > 0 && <div className="mt-[14px]"><JeuDeVariantes projet={projet} jeu={jeu} onJeu={setJeu} onRegler={onRegler} /></div>}
    </section>}
  </>
}
