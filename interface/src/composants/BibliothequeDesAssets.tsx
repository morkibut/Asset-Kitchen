import { useEffect, useMemo, useState } from "react"
import { api, type GrilleDeFamille, type Piece, type Personnage, type GroupeDeRangement } from "../api"
import { vignetteAsset } from "./Apercu"
import { FAMILLES } from "./Carnet"
import { useEtatDuParcours } from "./MemoireDuParcours"

const FAMILLES_DE_SUJETS = FAMILLES.filter(f => f.cle !== "equipement")
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
type Vue = "liste" | "grille"
type TriAssets = "nom" | "nom-desc" | "resultats"

/** La hiérarchie appartient à cet écran. Le serveur recherche et trie avant
 * de paginer ; aucune page chargée ne se présente comme le jeu entier. */
export function BibliothequeDesAssets({ jeu, pieces, personnages = [], familleInitiale = "", rafraichi, onOuvrir, onPiece, onFamille, onGalerie, onCreer, onTuiles, onSons }: {
  jeu: string; pieces: readonly Piece[]; personnages?: readonly Personnage[]; familleInitiale?: string; rafraichi: number
  onOuvrir: (identifiant: string) => void; onPiece: (identifiant: string) => void; onFamille: (famille: string) => void
  onGalerie: () => void; onCreer?: (famille: string) => void; onTuiles?: () => void; onSons?: () => void
}) {
  const cle = `bibliotheque:${jeu}:${familleInitiale}`
  const [recherche, setRecherche] = useEtatDuParcours(`${cle}:recherche`, "")
  const [famille, setFamille] = useEtatDuParcours(`${cle}:famille`, familleInitiale)
  const [collection, setCollection] = useEtatDuParcours(`${cle}:collection`, "")
  const [rechercheCollection, setRechercheCollection] = useState("")
  const [filtre, setFiltre] = useEtatDuParcours<"tous" | "incomplets" | "sans-description">(`${cle}:filtre`, "tous")
  const [tri, setTri] = useEtatDuParcours<TriAssets>(`${cle}:tri`, "nom")
  const [vue, setVue] = useEtatDuParcours<Vue>(`${cle}:vue`, "liste")
  const [limite, setLimite] = useEtatDuParcours(`${cle}:limite`, 60)
  const [grilles, setGrilles] = useState<Record<string, GrilleDeFamille>>({})
  const [index, setIndex] = useState<Record<string, GrilleDeFamille>>({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [relecture, setRelecture] = useState(0)
  const [selection, setSelection] = useEtatDuParcours<string[]>(`${cle}:selection`, [])
  const [nomCollection, setNomCollection] = useState<string | null>(null)
  const [rangement, setRangement] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [retourRangement, setRetourRangement] = useState("")

  useEffect(() => {
    let vivant = true
    setChargement(true); setErreur(null)
    const timer = window.setTimeout(() => {
      const familles = FAMILLES_DE_SUJETS.filter(f => !famille || famille === f.cle)
      Promise.all(familles.map(async f => [f.cle, await api.familleDeSujets(f.cle, { recherche, filtre, limite, collection, tri })] as const))
        .then(lues => { if (vivant) {
          setGrilles(Object.fromEntries(lues))
          setIndex(i => ({ ...i, ...Object.fromEntries(lues.map(([k, g]) => [k, !recherche && !collection && filtre === "tous" ? g : { ...i[k], groupes: g.groupes }])) }))
        } })
        .catch((e: unknown) => { if (vivant) { setGrilles({}); setErreur(e instanceof Error ? e.message : "Impossible de relire les assets du jeu.") } })
        .finally(() => { if (vivant) setChargement(false) })
    }, recherche ? 180 : 0)
    return () => { vivant = false; window.clearTimeout(timer) }
  }, [jeu, recherche, famille, filtre, limite, rafraichi, relecture, collection, tri])

  const groupes = useMemo(() => [...new Map(Object.values(index).flatMap(g => g.groupes ?? []).map(g => [g.identifiant, g])).values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")), [index])
  const nomDuGroupe = groupes.find(g => g.identifiant === collection)?.nom
  const equipements = useMemo(() => pieces.filter(p => (!famille || famille === "equipement") && !collection &&
    `${p.nom} ${p.description}`.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr")) &&
    (filtre !== "sans-description" || !p.description.trim())), [pieces, recherche, famille, filtre, collection])
  const sujets = Object.entries(grilles).flatMap(([f, g]) => g.personnages.map(s => ({ ...s, famille: f }))).sort((a, b) =>
    tri === "resultats" ? (b.compte.images.fait+b.compte.bandes.fait)-(a.compte.images.fait+a.compte.bandes.fait) || a.nom.localeCompare(b.nom, "fr") :
      (tri === "nom-desc" ? -1 : 1)*a.nom.localeCompare(b.nom, "fr"))
  const totalSujets = Object.values(grilles).reduce((n, g) => n + g.total, 0)
  const encore = Object.values(grilles).some(g => g.total > g.personnages.length)
  const apercusDesPieces = new Map(pieces.map(piece => {
    const cases = personnages.flatMap(p => p.cases), calques = cases.flatMap(c => c.calques[piece.identifiant] ?? [])
    const retenus = new Set(cases.map(c => c.retenus[piece.identifiant]))
    const calque = calques.find(a => retenus.has(a.identifiant)) ?? calques[0]
    return [piece.identifiant, calque ? vignetteAsset(calque, 128) : piece.concept_arts[0] ? api.imageCarte(piece.concept_arts[0], "") : null]
  }))
  function choisirFamille(f: string, c = "") { setFamille(f); setCollection(c); setLimite(60); setSelection([]) }
  async function agir(f: () => Promise<void>) { setOccupe(true); setErreur(null); try { await f() } catch (e) { setErreur(e instanceof Error ? e.message : "Le rangement n’a pas pu être gardé.") } finally { setOccupe(false) } }
  async function ranger(groupe: string, ids = selection, retirer = false) {
    if (!ids.length) return
    await agir(async () => {
      const resultats = await Promise.allSettled(ids.map(id => retirer ? api.retirerSujet(groupe, jeu, id) : api.rangerSujet(groupe, jeu, id)))
      const refuses = ids.filter((_, i) => resultats[i].status === "rejected")
      setSelection(refuses); setRelecture(n => n+1)
      setRetourRangement(`${ids.length-refuses.length} asset(s) ${retirer ? "retiré(s) de la collection" : "rangé(s)"}. Les images restent conservées.`)
      if (refuses.length) throw new Error(`${refuses.length} rangement(s) n’ont pas abouti. Les assets concernés restent sélectionnés pour réessayer.`)
      setRangement(null)
    })
  }
  function deposer(ev: React.DragEvent, groupe: string) {
    ev.preventDefault()
    try { const ids: unknown = JSON.parse(ev.dataTransfer.getData("application/x-asset-kitchen-library-subjects")); if (Array.isArray(ids) && ids.every(id => typeof id === "string") && ids.every(id => sujets.some(s => s.identifiant === id))) void ranger(groupe, ids) } catch { setErreur("Le groupe d’assets glissé ne peut pas être relu.") }
  }
  const ligneCollection = (g: GroupeDeRangement, f: string) => <button type="button" key={g.identifiant} onClick={() => choisirFamille(f, g.identifiant)} onDragOver={ev => { if (ev.dataTransfer.types.includes("application/x-asset-kitchen-library-subjects")) ev.preventDefault() }} onDrop={ev => deposer(ev, g.identifiant)} aria-current={collection === g.identifiant && famille === f ? "page" : undefined} className={`flex min-h-[30px] w-full items-center justify-between gap-[8px] rounded-5 px-[8px] text-left text-[12px] hover:bg-papier-cote ${collection === g.identifiant && famille === f ? "bg-ligne-ouverte" : ""}`}><span className="truncate">{g.nom}</span><span className="mesure text-[11px] text-encre-3">{g.sujets}</span></button>

  return <main aria-label="Les sujets du jeu" data-bibliotheque-assets className="flex min-h-0 flex-1 flex-col overflow-hidden bg-papier">
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-[14px] px-[22px] pt-[22px] pb-[14px]">
      <div><h1 className="font-serif text-[38px] leading-tight text-encre">Les sujets</h1><p className="mt-[4px] text-[13px] text-encre-3">Les choses du jeu, rangées par famille et collection.</p></div>
      <div className="flex flex-wrap gap-[8px]"><button className={BOUTON} onClick={() => onCreer ? onCreer(famille || "personnages") : onFamille(famille || "personnages")}>Créer un asset</button><button className={BOUTON} onClick={() => setNomCollection("")}>Nouvelle collection</button></div>
    </header>
    <div className="flex min-h-0 flex-1 gap-[22px] px-[22px] pb-[22px]">
      <nav aria-label="Familles et collections" className="w-navigation-atelier shrink-0 overflow-y-auto border-r border-trait pr-[14px]">
        <label className="mb-[8px] flex flex-col gap-[4px] text-[12px] text-encre-3">Trouver une collection<input className={BOUTON} type="text" value={rechercheCollection} onChange={ev => setRechercheCollection(ev.target.value)} /></label>
        <button className={`${BOUTON} mb-[8px] w-full text-left`} aria-current={!famille && !collection ? "page" : undefined} onClick={() => choisirFamille("")}>Toutes les familles</button>
        {FAMILLES.map(f => <div className="mb-[8px]" key={f.cle}>
          <button type="button" className={`flex min-h-[34px] w-full items-center gap-[8px] rounded-7 px-[8px] text-left text-[14px] ${famille === f.cle ? "bg-ligne-ouverte" : "hover:bg-papier-cote"}`} aria-expanded={famille === f.cle} onClick={() => choisirFamille(f.cle)}><span aria-hidden="true">{famille === f.cle ? "▾" : "▸"}</span><span>{f.nom}</span><span className="mesure ml-auto text-[11px] text-encre-3">{f.cle === "equipement" ? pieces.length : index[f.cle]?.total ?? ""}</span></button>
          {(famille === f.cle || rechercheCollection) && f.cle !== "equipement" && <div className="ml-[14px] border-l border-trait pl-[8px]">
            <button className="min-h-[30px] w-full px-[8px] text-left text-[12px]" onClick={() => choisirFamille(f.cle)}>Tout voir</button>
            {groupes.filter(g => g.nom.toLocaleLowerCase("fr").includes(rechercheCollection.toLocaleLowerCase("fr"))).map(g => ligneCollection(g, f.cle))}
            <button className="min-h-[30px] w-full px-[8px] text-left text-[12px] text-signal" onClick={() => setNomCollection("")}>+ Collection</button>
          </div>}
        </div>)}
        {(onTuiles || onSons) && <div className="mt-[14px] space-y-[8px] border-t border-trait pt-[14px]">{onTuiles && <button className={`${BOUTON} w-full text-left`} onClick={onTuiles}>Les tuiles</button>}{onSons && <button className={`${BOUTON} w-full text-left`} onClick={onSons}>Les sons</button>}</div>}
        <button className="mt-[14px] min-h-[30px] text-left text-[12px] text-encre-3 underline" onClick={onGalerie}>Tous les résultats dans la galerie</button>
      </nav>
      <section className="min-w-0 flex-1 overflow-y-auto" aria-label="Catalogue des assets">
        <div className="mb-[14px] flex flex-wrap items-end gap-[14px]">
          <label className="flex min-w-[128px] flex-1 flex-col gap-[4px] text-[12px] text-encre-3">Rechercher un asset<input type="search" value={recherche} onChange={ev => { setRecherche(ev.target.value); setLimite(60) }} placeholder="Nom ou description…" className={BOUTON} /></label>
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">À faire<select value={filtre} onChange={ev => { setFiltre(ev.target.value as typeof filtre); setLimite(60) }} className={BOUTON}><option value="tous">Tous les assets</option><option value="incomplets">Images fixes à compléter</option><option value="sans-description">Description à écrire</option></select></label>
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Trier les assets<select value={tri} onChange={ev => setTri(ev.target.value as TriAssets)} className={BOUTON}><option value="nom">Nom A → Z</option><option value="nom-desc">Nom Z → A</option><option value="resultats">Plus de résultats</option></select></label>
          <div role="group" aria-label="Vue des assets" className="flex gap-[4px]">{(["liste", "grille"] as const).map(v => <button key={v} className={`${BOUTON} ${vue === v ? "bg-ligne-ouverte" : ""}`} aria-pressed={vue === v} onClick={() => setVue(v)}>{v === "liste" ? "Liste" : "Grille"}</button>)}</div>
        </div>
        {(famille || collection) && <div className="mb-[8px] flex flex-wrap items-center gap-[8px]"><h2 className="font-serif text-[25px]">{nomDuGroupe || FAMILLES.find(f => f.cle === famille)?.nom}</h2><button className={BOUTON} onClick={() => onFamille(famille || "personnages")}>Ouvrir et organiser</button></div>}
        {(recherche || filtre !== "tous" || collection) && <button className="mb-[8px] text-[12px] underline" onClick={() => { setRecherche(""); setFiltre("tous"); setCollection("") }}>Réinitialiser les filtres</button>}
        <div className="mb-[14px] flex flex-wrap items-center gap-[8px] border-y border-trait py-[8px] text-[12px]"><span className="mr-auto">{totalSujets} sujets · {equipements.length} équipement{equipements.length > 1 ? "s" : ""} · {selection.length} sélectionné(s)</span><button className={BOUTON} disabled={!sujets.length || occupe} onClick={() => setSelection(sujets.map(s => s.identifiant))}>Sélectionner les sujets affichés</button><button className={BOUTON} disabled={!selection.length || occupe} onClick={() => setRangement(groupes[0]?.identifiant || "")}>Ranger la sélection</button>{collection && <button className={BOUTON} disabled={!selection.length || occupe} onClick={() => void ranger(collection, selection, true)}>Retirer de cette collection</button>}<button className={BOUTON} disabled={!selection.length || occupe} onClick={() => setSelection([])}>Effacer la sélection</button></div>
        {nomCollection !== null && <form className="mb-[14px] flex flex-wrap items-center gap-[8px] rounded-7 border border-contour bg-carte p-[14px]" onSubmit={ev => { ev.preventDefault(); void agir(async () => { const r = await api.creerCollection(nomCollection, jeu); setNomCollection(null); setIndex(i => Object.fromEntries(Object.entries(i).map(([k, g]) => [k, { ...g, groupes: [...(g.groupes || []), { identifiant: r.collection.identifiant, nom: r.collection.nom, sujets: 0 }] }]))); setRelecture(n => n+1) }) }}><label>Nom de la collection <input className={BOUTON} value={nomCollection} onChange={ev => setNomCollection(ev.target.value)} autoFocus /></label><button className={BOUTON} disabled={occupe || !nomCollection.trim()} type="submit">Créer la collection</button><button type="button" className={BOUTON} onClick={() => setNomCollection(null)}>Annuler</button></form>}
        {rangement !== null && <div className="mb-[14px] flex flex-wrap items-center gap-[8px] rounded-7 border border-contour bg-carte p-[14px]"><label>Collection de destination <select className={BOUTON} value={rangement} onChange={ev => setRangement(ev.target.value)}><option value="">Choisissez une collection</option>{groupes.map(g => <option key={g.identifiant} value={g.identifiant}>{g.nom}</option>)}</select></label><button className={BOUTON} disabled={!rangement || occupe} onClick={() => void ranger(rangement)}>Garder le rangement</button><button className={BOUTON} onClick={() => setNomCollection("")}>Nouvelle collection</button><button className={BOUTON} onClick={() => setRangement(null)}>Fermer</button></div>}
        {retourRangement && <p role="status" className="mb-[8px] text-[12px] text-encre-ok">{retourRangement}</p>}
        {erreur && <div role="alert" className="mb-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur} <button onClick={() => setRelecture(n => n+1)} className="underline">Réessayer</button></div>}
        {chargement ? <p role="status" className="text-encre-3">Lecture de la bibliothèque…</p> : <>
          <ul className={vue === "grille" ? "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]" : "flex flex-col gap-[8px]"}>
            {sujets.map(s => <li key={s.identifiant} className={`flex items-start gap-[14px] rounded-8 border border-trait bg-carte p-[14px] ${vue === "grille" ? "flex-wrap" : ""}`} draggable onDragStart={ev => { const ids = selection.includes(s.identifiant) ? selection : [s.identifiant]; ev.dataTransfer.setData("application/x-asset-kitchen-library-subjects", JSON.stringify(ids)); ev.dataTransfer.effectAllowed = "copy" }}>
              <input className="mt-[8px] shrink-0" type="checkbox" aria-label={`Sélectionner ${s.nom}`} checked={selection.includes(s.identifiant)} onChange={ev => setSelection(ids => ev.target.checked ? [...ids, s.identifiant] : ids.filter(id => id !== s.identifiant))} />
              <button onClick={() => onOuvrir(s.identifiant)} className={`flex min-w-0 flex-1 gap-[14px] text-left ${vue === "grille" ? "flex-col" : "items-center"}`}>
                <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-5 bg-pourtour ${vue === "grille" ? "h-[128px] w-full" : "h-[54px] w-[54px]"}`}>{s.vignette ? <img alt="" loading="lazy" src={api.vignette(s.vignette.identifiant, s.vignette.empreinte, 128)} className="h-full w-full object-contain [image-rendering:pixelated]" /> : <span className="bg-carte p-[4px] text-[11px] text-encre-3">À créer</span>}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]"><span className="font-serif text-[25px] leading-tight">{s.nom}</span><span className="text-[12px] text-encre-3">{FAMILLES.find(f => f.cle === s.famille)?.nom} · {s.description || "Description à écrire"}</span><span className="text-[12px] text-encre-controle">Images {s.compte.images.fait}/{s.compte.images.attendu} · Animations {s.compte.bandes.fait}/{s.compte.bandes.attendu}</span><span className="text-[11px] text-encre-3">{s.collections.map(c => c.nom).join(" · ") || "Sans collection"}</span></span><span className="shrink-0 text-[12px]">Ouvrir →</span>
              </button>
            </li>)}
            {equipements.sort((a, b) => (tri === "nom-desc" ? -1 : 1)*a.nom.localeCompare(b.nom, "fr")).map(p => <li key={p.identifiant} className="rounded-8 border border-trait bg-carte p-[14px]"><button onClick={() => onPiece(p.identifiant)} className={`flex w-full items-center gap-[14px] text-left ${vue === "grille" ? "flex-col" : ""}`}><span className={`flex shrink-0 items-center justify-center rounded-5 bg-pourtour ${vue === "grille" ? "h-[128px] w-full" : "h-[54px] w-[54px]"}`}>{apercusDesPieces.get(p.identifiant) ? <img src={apercusDesPieces.get(p.identifiant)!} alt="" loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated]" /> : <span className="bg-carte p-[4px] text-[11px]">À créer</span>}</span><span className="flex flex-1 flex-col gap-[4px]"><span className="font-serif text-[25px]">{p.nom}</span><span className="text-[12px] text-encre-3">Équipement · {p.description || "Description à écrire"}</span><span className="text-[12px]">Voir les emplois →</span></span></button></li>)}
          </ul>
          {Object.values(grilles).filter(g => g.personnages.length < g.total).map((g, i) => <p key={i} className="mt-[8px] text-[12px] text-encre-3">{g.personnages.length} affichés sur {g.total}. La recherche porte sur toute la famille.</p>)}
          {encore && <button className={`${BOUTON} mt-[22px]`} disabled={limite >= 1000} onClick={() => setLimite(n => Math.min(1000, n+60))}>Afficher davantage d’assets</button>}
          {limite >= 1000 && encore && <p className="mt-[8px] text-[12px]">Précisez la famille, la collection ou la recherche pour retrouver les autres assets.</p>}
          {!totalSujets && !equipements.length && <div className="mt-[14px] rounded-8 border border-dashed border-contour p-[22px]"><h2 className="font-serif text-[25px]">Aucun asset pour ces filtres</h2><p className="mt-[8px] text-[13px] text-encre-3">Choisissez toutes les familles, une autre collection ou créez le premier asset.</p></div>}
          {famille === "equipement" && <p className="mt-[14px] text-[12px] text-encre-3">Les équipements se retrouvent par leur nom et leurs emplois. Le rangement en collection concerne ici les personnages, objets, décors et interfaces.</p>}
        </>}
      </section>
    </div>
  </main>
}
