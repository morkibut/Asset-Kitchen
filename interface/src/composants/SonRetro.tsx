// **Interface et rétro** (SN8) : pas de phrase. On part d'un départ (clic,
// saut, pièce…), sfxr calcule ici, en un instant, sans ComfyUI ; on tire des
// variantes, on les écoute dans la même grille, on garde.
import { useEffect, useState } from "react"
import type { Son } from "../api-sons"
import type { JeuVariantes } from "../api-series-son"
import { garderSfxr, graineAuHasard, sfxr } from "../api-sfxr"
import { GrilleEcoute, tuileDeSon } from "./GrilleEcoute"
import { JeuDeVariantes } from "./JeuDeVariantes"

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
  const [gardes, setGardes] = useState<Set<number>>(new Set())
  const [jeu, setJeu] = useState<JeuVariantes | null>(null)
  const [nom, setNom] = useState("")
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

  const tirer = async (geste: () => Promise<Son[]>) => {
    setOccupe(true); setErreur("")
    try { setSons(await geste()); setGardes(new Set()); setJeu(null); setNom("") } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  // Un son seul se décline à partir de ses propres réglages ; sinon on part du départ.
  const seul = sons.length === 1 ? sons[0] : null
  const reglagesDuSeul = seul?.provenance && typeof seul.provenance === "object" ? (seul.provenance as { parametres?: Record<string, unknown> }).parametres : undefined
  const unSon = () => tirer(async () => [await sfxr.fabriquer(projet, { depart, graine: graineAuHasard(), nom: nomDuDepart(depart) })])
  const variantes = () => tirer(() => reglagesDuSeul
    ? sfxr.variantes(projet, { parametres: reglagesDuSeul, graine: graineAuHasard(), nombre, nom: seul!.nom })
    : sfxr.variantes(projet, { depart, graine: graineAuHasard(), nombre, nom: nomDuDepart(depart) }))
  const choixCourant = [...gardes].map((r) => sons[r - 1]?.identifiant).filter(Boolean)
  const memeChoix = !!jeu && jeu.sons.length === choixCourant.length && choixCourant.every((s) => jeu.sons.includes(s))
  const basculer = (rang: number) => setGardes((g) => { const n = new Set(g); if (n.has(rang)) n.delete(rang); else n.add(rang); return n })
  const garder = async () => {
    const choisis = [...gardes].sort((a, b) => a - b).map((r) => sons[r - 1].identifiant)
    setOccupe(true); setErreur("")
    try { setJeu(await garderSfxr(projet, sons.map((s) => s.identifiant), choisis, nom.trim() || jeu?.nom || nomDuDepart(depart), jeu)) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }

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
      <button type="button" className={BOUTON} disabled={occupe || !departs.length} onClick={() => void unSon()}>Un son</button>
      <button type="button" className={PRINCIPAL} disabled={occupe || !departs.length} onClick={() => void variantes()}>{reglagesDuSeul ? `Tirer ${nombre} variantes de ce son` : `Tirer ${nombre} variantes`}</button>
    </div>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {sons.length > 0 && <section aria-label="Les sons rétro" className="mt-[14px]">
      <GrilleEcoute projet={projet} tuiles={sons.map((s, i) => tuileDeSon(s, i + 1))} gardes={gardes} onGarder={basculer} onRegler={onRegler} />
      {gardes.size > 0 && !memeChoix && <div className="sticky bottom-0 z-[2] mt-[14px] flex flex-wrap items-center gap-[14px] border-t border-trait bg-papier py-[14px]">
        <strong className="text-[13px]">{gardes.size} gardé{gardes.size > 1 ? "s" : ""}</strong>
        <label className="flex items-center gap-[8px] text-[12px]">Nom du jeu
          <input aria-label="Nom du jeu de variantes" className="min-h-[30px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" placeholder={nomDuDepart(depart)} value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
        <button type="button" className={`${BOUTON} ml-auto`} disabled={occupe} onClick={() => void garder()}>Ranger en jeu de variantes</button>
      </div>}
      {jeu && <div className="mt-[14px]"><JeuDeVariantes projet={projet} jeu={jeu} onJeu={setJeu} onRegler={onRegler} /></div>}
    </section>}
  </>
}
