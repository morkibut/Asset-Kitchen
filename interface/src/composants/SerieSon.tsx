// **Une série de tirages** (SN3) : elle arrive tirage par tirage, s'écoute en
// grille et se garde. « Garder » écrit tout de suite : le premier tirage gardé
// forme le jeu de variantes de la série, les suivants s'y ajoutent ou en
// sortent (maquette `03-son.html`). Une série coupée se reprend par un geste —
// jamais toute seule, et un tirage rendu n'est jamais relancé.
import { useEffect, useRef, useState } from "react"
import { jeuxDeVariantes, seriesSon, type JeuVariantes, type SerieSon as Serie } from "../api-series-son"
import { tempsTexte } from "../son-textes"
import { GrilleEcoute, tuileDeTirage } from "./GrilleEcoute"
import { JeuDeVariantes, useGarde } from "./JeuDeVariantes"

const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const NOMS: Record<string, string> = { bruitage: "Bruitage", interface: "Interface et rétro", ambiance: "Ambiance", musique: "Musique", jingle: "Jingle", chanson: "Chanson", voix: "Voix" }
const message = (e: unknown) => e instanceof Error ? e.message : "La série ne peut pas être relue."
const EN_ROUTE = new Set(["en_cours", "en_attente"])
/** Le jeu que « Garder » ajuste : le plus récent de la série. */
const plusRecent = (jeux: JeuVariantes[]) => jeux.reduce<JeuVariantes | null>((a, j) => !a || j.cree_le > a.cree_le ? j : a, null)

export function SerieSon({ projet, identifiant, initiale, titre = "Série", onRegler }: {
  projet: string; identifiant: string; initiale?: Serie; titre?: string
  onRegler?: (son: string) => void
}) {
  const [serie, setSerie] = useState<Serie | null>(initiale ?? null)
  const [jeux, setJeux] = useState<JeuVariantes[]>([])
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const derniere = useRef(serie)
  derniere.current = serie

  useEffect(() => {
    let vivant = true
    // Une série fraîchement lancée arrive d'abord préparée, puis démarrée : l'écran suit la plus récente.
    if (initiale) setSerie(initiale)
    else seriesSon.lire(projet, identifiant).then((s) => { if (vivant) setSerie(s) }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, identifiant, initiale])

  // Les jeux déjà formés depuis cette série : ils se rouvrent avec elle, et
  // les tirages du plus récent se montrent gardés.
  const idsJeux = (serie?.jeux ?? []).join(",")
  useEffect(() => {
    if (!idsJeux) return
    let vivant = true
    Promise.all(idsJeux.split(",").map((j) => jeuxDeVariantes.lire(projet, j))).then((lus) => {
      // Une lecture partie avant un « Garder » ne revient pas en arrière : la version la plus récente l'emporte.
      if (vivant) setJeux((js) => [...lus.map((l) => { const x = js.find((j) => j.identifiant === l.identifiant); return x && x.revision > l.revision ? x : l }),
        ...js.filter((j) => !lus.some((l) => l.identifiant === j.identifiant))])
    }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, idsJeux])

  const actif = plusRecent(jeux)
  const ranger = (j: JeuVariantes) => setJeux((js) => [j, ...js.filter((x) => x.identifiant !== j.identifiant)])
  const garde = useGarde({
    projet, jeu: actif, onJeu: ranger,
    // Le premier gardé forme le jeu de la série (route `keep`, qui pose les
    // réglages de la famille). Un jeu déjà formé ailleurs et pas encore relu
    // ici reçoit le son, plutôt que d'en former un second.
    former: async (son) => {
      const ids = derniere.current?.jeux ?? []
      if (!ids.length) return seriesSon.garder(projet, identifiant, { sons: [son] })
      const lu = plusRecent(await Promise.all(ids.map((j) => jeuxDeVariantes.lire(projet, j))))!
      return lu.membres.some((m) => m.son === son) ? lu : jeuxDeVariantes.ajouter(projet, lu.identifiant, son, true)
    },
    // Le son gardé a une nouvelle version (les réglages de sa famille) : la grille la relit.
    apres: () => seriesSon.lire(projet, identifiant).then(setSerie).catch(() => {}),
  })

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
  if (!serie) return <section className="mt-[22px]">{erreur ? <p role="alert" className="text-[13px] text-echec">{erreur}</p> : <p className="text-[13px] text-encre-3">Lecture de la série…</p>}</section>

  const restants = serie.tirages.filter((t) => !["rendu", "annule", "termine"].includes(t.etat)).length
  const aReprendre = serie.etat === "a_reprendre" || (serie.etat === "externe_inconnu" && serie.tirages.some((t) => t.prochaine_action === "reprendre"))
  // Le bouton porte le temps qu'il reste à calculer, jamais un prix.
  const temps = serie.reste?.temps_s != null && serie.reste.temps_s > 0 ? ` · ${tempsTexte(serie.reste.temps_s)}` : ""
  const sonDuRang = new Map(serie.tirages.flatMap((t) => t.son ? [[t.rang, t.son.identifiant] as const] : []))
  const gardes = new Set([...sonDuRang].filter(([, son]) => garde.garde(son)).map(([rang]) => rang))
  const basculer = (rang: number) => { const son = sonDuRang.get(rang); if (son) garde.basculer(son) }
  const longue = serie.famille === "musique" || serie.famille === "chanson"
  const montres = jeux.filter((j) => j.membres.length > 0).sort((a, b) => b.cree_le - a.cree_le)

  return <section aria-label={titre} className="mt-[22px]">
    <div className="mb-[8px] flex flex-wrap items-end justify-between gap-[14px]">
      <div><h2 className="font-serif text-[25px]">{titre}</h2><p className="text-[12px] text-encre-3">{[serie.famille ? NOMS[serie.famille] : null, `${serie.nombre} tirages`, serie.nom].filter(Boolean).join(" · ")}</p></div>
      {aReprendre && <button type="button" className={BOUTON} disabled={occupe} onClick={(e) => { e.currentTarget.blur(); void agir(() => seriesSon.reprendre(projet, serie.identifiant)) }}>Reprendre{temps}</button>}
      {serie.etat === "preparee" && <button type="button" className={BOUTON} disabled={occupe} onClick={(e) => { e.currentTarget.blur(); void agir(() => seriesSon.demarrer(projet, serie.identifiant)) }}>Lancer {serie.nombre} tirages{temps}</button>}
    </div>
    <p role="status" className="mb-[8px] min-h-[22px] text-[12.5px] text-encre-3">
      {restants > 0 && serie.etat === "en_cours" && `Il reste ${serie.reste.temps_s != null ? `${tempsTexte(serie.reste.temps_s)} · ` : ""}${restants} tirage${restants > 1 ? "s" : ""} à venir`}
      {aReprendre && `${restants} tirage${restants > 1 ? "s" : ""} arrêté${restants > 1 ? "s" : ""}. Les tirages déjà rendus ne seront pas refaits.`}
    </p>
    {erreur && <p role="alert" className="mb-[8px] text-[13px] text-echec">{erreur}</p>}
    {garde.erreur && <p role="alert" className="mb-[8px] text-[13px] text-echec">{garde.erreur}</p>}
    {!!serie.refus?.length && <ul className="mb-[8px] text-[13px] text-echec">{serie.refus.map((r) => <li key={r.rang}>Tirage {r.rang} : {r.raison}</li>)}</ul>}
    {!!serie.laisses?.length && <ul className="mb-[8px] text-[13px] text-encre-3">{serie.laisses.map((r) => <li key={r.rang}>Tirage {r.rang} : {r.raison || "laissé à son suivi"}</li>)}</ul>}
    <GrilleEcoute projet={projet} tuiles={serie.tirages.map(tuileDeTirage)} gardes={gardes} onGarder={basculer} onRegler={onRegler} longue={longue} />
    {gardes.size === 0 && serie.tirages.some((t) => t.son) && <p className="mt-[14px] text-[12px] text-encre-3">Garde un ou plusieurs tirages. Les autres restent dans la série.</p>}
    <div className="mt-[14px] space-y-[14px]">
      {montres.map((j) => <JeuDeVariantes key={j.identifiant} projet={projet} jeu={j} onJeu={ranger} onRegler={onRegler} />)}
    </div>
  </section>
}
