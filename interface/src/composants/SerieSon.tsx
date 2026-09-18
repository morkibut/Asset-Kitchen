// **Une série de tirages** (SN3) : elle arrive tirage par tirage, s'écoute en
// grille et se garde en jeu de variantes. Une série coupée se reprend par un
// geste — jamais toute seule, et un tirage rendu n'est jamais relancé.
import { useEffect, useState } from "react"
import { jeuxDeVariantes, seriesSon, type JeuVariantes, type SerieSon as Serie } from "../api-series-son"
import { tempsTexte } from "../son-textes"
import { GrilleEcoute, tuileDeTirage } from "./GrilleEcoute"
import { JeuDeVariantes } from "./JeuDeVariantes"

const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const NOMS: Record<string, string> = { bruitage: "Bruitage", interface: "Interface et rétro", ambiance: "Ambiance", musique: "Musique", jingle: "Jingle", chanson: "Chanson", voix: "Voix" }
const message = (e: unknown) => e instanceof Error ? e.message : "La série ne peut pas être relue."
const EN_ROUTE = new Set(["en_cours", "en_attente"])
const memeEnsemble = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x))

export function SerieSon({ projet, identifiant, initiale, titre = "Série", onRegler }: {
  projet: string; identifiant: string; initiale?: Serie; titre?: string
  onRegler?: (son: string) => void
}) {
  const [serie, setSerie] = useState<Serie | null>(initiale ?? null)
  const [jeux, setJeux] = useState<JeuVariantes[]>([])
  const [gardes, setGardes] = useState<Set<number>>(new Set())
  const [nom, setNom] = useState("")
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    // Une série fraîchement lancée arrive d'abord préparée, puis démarrée : l'écran suit la plus récente.
    if (initiale) setSerie(initiale)
    else seriesSon.lire(projet, identifiant).then((s) => { if (vivant) setSerie(s) }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, identifiant, initiale])

  // Les jeux déjà formés depuis cette série : ils se rouvrent avec elle, et
  // leurs tirages se montrent gardés.
  const idsJeux = (serie?.jeux ?? []).join(",")
  useEffect(() => {
    if (!idsJeux) return
    let vivant = true
    Promise.all(idsJeux.split(",").map((j) => jeuxDeVariantes.lire(projet, j))).then((lus) => {
      if (!vivant) return
      setJeux(lus)
      setGardes((g) => new Set([...g, ...lus.flatMap((j) => j.membres.map((m) => m.rang).filter((r): r is number => r != null))]))
    }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, idsJeux])

  // Le suivi : un sondage tant qu'un tirage calcule, comme un son seul.
  const enRoute = !!serie && serie.tirages.some((t) => EN_ROUTE.has(t.etat))
  useEffect(() => {
    if (!enRoute) return
    const minuterie = window.setInterval(() => void seriesSon.lire(projet, identifiant).then(setSerie).catch((e) => setErreur(message(e))), 2000)
    return () => window.clearInterval(minuterie)
  }, [enRoute, projet, identifiant])

  const agir = async (geste: () => Promise<Serie>) => {
    setOccupe(true); setErreur("")
    try { setSerie(await geste()) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  const basculer = (rang: number) => setGardes((g) => { const n = new Set(g); if (n.has(rang)) n.delete(rang); else n.add(rang); return n })
  const garder = async () => {
    if (!serie) return
    const rangs = [...gardes].sort((a, b) => a - b)
    setOccupe(true); setErreur("")
    try {
      const jeu = await seriesSon.garder(projet, serie.identifiant, { rangs, nom: nom.trim() || undefined, cle: `garder:${serie.identifiant}:${rangs.join(",")}` })
      setJeux((js) => [jeu, ...js.filter((j) => j.identifiant !== jeu.identifiant)])
      setSerie(await seriesSon.lire(projet, serie.identifiant))
    } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }

  if (!serie) return <section className="mt-[22px]">{erreur ? <p role="alert" className="text-[13px] text-echec">{erreur}</p> : <p className="text-[13px] text-encre-3">Lecture de la série…</p>}</section>

  const restants = serie.tirages.filter((t) => !["rendu", "annule", "termine"].includes(t.etat)).length
  const aReprendre = serie.etat === "a_reprendre" || (serie.etat === "externe_inconnu" && serie.tirages.some((t) => t.prochaine_action === "reprendre"))
  const rangsGardes = [...gardes].sort((a, b) => a - b)
  const dejaForme = jeux.find((j) => memeEnsemble(j.membres.map((m) => m.rang ?? -1), rangsGardes))
  const longue = serie.famille === "musique" || serie.famille === "chanson"

  return <section aria-label={titre} className="mt-[22px]">
    <div className="mb-[8px] flex flex-wrap items-end justify-between gap-[14px]">
      <div><h2 className="font-serif text-[25px]">{titre}</h2><p className="text-[12px] text-encre-3">{[serie.famille ? NOMS[serie.famille] : null, `${serie.nombre} tirages`, serie.nom].filter(Boolean).join(" · ")}</p></div>
      {aReprendre && <button type="button" className={BOUTON} disabled={occupe} onClick={() => void agir(() => seriesSon.reprendre(projet, serie.identifiant))}>Reprendre</button>}
      {serie.etat === "preparee" && <button type="button" className={BOUTON} disabled={occupe} onClick={() => void agir(() => seriesSon.demarrer(projet, serie.identifiant))}>Lancer {serie.nombre} tirages</button>}
    </div>
    <p role="status" className="mb-[8px] min-h-[22px] text-[12.5px] text-encre-3">
      {restants > 0 && serie.etat === "en_cours" && `Il reste ${serie.reste.temps_s != null ? `${tempsTexte(serie.reste.temps_s)} · ` : ""}${restants} tirage${restants > 1 ? "s" : ""} à venir`}
      {aReprendre && `${restants} tirage${restants > 1 ? "s" : ""} arrêté${restants > 1 ? "s" : ""}. Les tirages déjà rendus ne seront pas refaits.`}
    </p>
    {erreur && <p role="alert" className="mb-[8px] text-[13px] text-echec">{erreur}</p>}
    {!!serie.refus?.length && <ul className="mb-[8px] text-[13px] text-echec">{serie.refus.map((r) => <li key={r.rang}>Tirage {r.rang} : {r.raison}</li>)}</ul>}
    {!!serie.laisses?.length && <ul className="mb-[8px] text-[13px] text-encre-3">{serie.laisses.map((r) => <li key={r.rang}>Tirage {r.rang} : {r.raison || "laissé à son suivi"}</li>)}</ul>}
    <GrilleEcoute projet={projet} tuiles={serie.tirages.map(tuileDeTirage)} gardes={gardes} onGarder={basculer} onRegler={onRegler} longue={longue} />
    {rangsGardes.length > 0 && !dejaForme && <div className="sticky bottom-0 z-[2] mt-[14px] flex flex-wrap items-center gap-[14px] border-t border-trait bg-papier py-[14px]">
      <strong className="text-[13px]">{rangsGardes.length} gardé{rangsGardes.length > 1 ? "s" : ""}</strong>
      <label className="flex items-center gap-[8px] text-[12px]">Nom du jeu
        <input aria-label="Nom du jeu de variantes" className="min-h-[30px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" placeholder={serie.nom} value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <button type="button" className={`${BOUTON} ml-auto`} disabled={occupe} onClick={() => void garder()}>Ranger en jeu de variantes</button>
    </div>}
    {rangsGardes.length === 0 && !jeux.length && serie.tirages.some((t) => t.son) && <p className="mt-[14px] text-[12px] text-encre-3">Gardez un ou plusieurs tirages. Les autres restent dans la série.</p>}
    <div className="mt-[14px] space-y-[14px]">
      {jeux.map((j) => <JeuDeVariantes key={j.identifiant} projet={projet} jeu={j} onJeu={(n) => setJeux((js) => js.map((x) => x.identifiant === n.identifiant ? n : x))} onRegler={onRegler} />)}
    </div>
  </section>
}
