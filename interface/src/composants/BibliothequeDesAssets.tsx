import { useEffect, useMemo, useState } from "react"
import { api, Refus, type GrilleDeFamille, type Piece, type SujetDeLaGrille, type Personnage } from "../api"
import { vignetteAsset } from "./Apercu"
import { FAMILLES } from "./Carnet"

const FAMILLES_DE_SUJETS = FAMILLES.filter((f) => f.cle !== "equipement")
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"

/** La recherche traverse les familles côté serveur. Une page chargée n'est
 * jamais présentée comme toute la bibliothèque ; chaque famille garde son total. */
export function BibliothequeDesAssets({ jeu, pieces, personnages = [], familleInitiale = "", rafraichi, onOuvrir, onPiece, onFamille, onGalerie }: {
  jeu: string
  pieces: readonly Piece[]
  personnages?: readonly Personnage[]
  familleInitiale?: string
  rafraichi: number
  onOuvrir: (identifiant: string) => void
  onPiece: (identifiant: string) => void
  onFamille: (famille: string) => void
  onGalerie: () => void
}) {
  const [recherche, setRecherche] = useState("")
  const [famille, setFamille] = useState(familleInitiale)
  const [filtre, setFiltre] = useState<"tous" | "incomplets" | "sans-description">("tous")
  const [limite, setLimite] = useState(60)
  const [grilles, setGrilles] = useState<Record<string, GrilleDeFamille>>({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [relecture, setRelecture] = useState(0)

  useEffect(() => {
    let vivant = true
    setChargement(true)
    setErreur(null)
    const timer = window.setTimeout(() => {
      const familles = FAMILLES_DE_SUJETS.filter((f) => !famille || famille === f.cle)
      Promise.all(familles.map(async (f) => [f.cle, await api.familleDeSujets(f.cle, { recherche, filtre, limite })] as const))
        .then((lues) => { if (vivant) setGrilles(Object.fromEntries(lues)) })
        .catch((e: unknown) => { if (vivant) { setGrilles({}); setErreur(e instanceof Refus ? e.message : "Impossible de relire les assets du jeu.") } })
        .finally(() => { if (vivant) setChargement(false) })
    }, recherche ? 180 : 0)
    return () => { vivant = false; window.clearTimeout(timer) }
  }, [jeu, recherche, famille, filtre, limite, rafraichi, relecture])

  const equipements = useMemo(() => pieces.filter((p) => {
    const trouve = `${p.nom} ${p.description}`.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr"))
    return (!famille || famille === "equipement") && trouve && (filtre !== "sans-description" || !p.description.trim())
  }), [pieces, recherche, famille, filtre])
  const totalSujets = Object.values(grilles).reduce((n, g) => n + g.total, 0)
  const encore = Object.values(grilles).some((g) => g.total > g.personnages.length)
  const apercusDesPieces = new Map(pieces.map((piece) => {
    const cases = personnages.flatMap((p) => p.cases)
    const calques = cases.flatMap((c) => c.calques[piece.identifiant] ?? [])
    const retenus = new Set(cases.map((c) => c.retenus[piece.identifiant]))
    const calque = calques.find((a) => retenus.has(a.identifiant)) ?? calques[0]
    return [piece.identifiant, calque ? vignetteAsset(calque, 128) : piece.concept_arts[0] ? api.imageCarte(piece.concept_arts[0], "") : null]
  }))

  return <main aria-label="Les assets du jeu" data-bibliotheque-assets className="defile min-h-0 flex-1 overflow-y-auto bg-papier p-[30px]">
    <header className="flex items-start justify-between gap-[22px]">
      <div><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Les assets</h1><p className="mt-[8px] text-[14px] text-encre-3">Les choses du jeu, rangées par famille et par collection. La galerie conserve tous leurs résultats.</p></div>
      <button className={BOUTON} onClick={onGalerie}>Ouvrir la galerie</button>
    </header>
    <div className="mt-[22px] flex flex-wrap items-end gap-[14px]">
      <label className="flex min-w-[128px] flex-1 flex-col gap-[4px] text-[12px] text-encre-3">Rechercher dans les assets<input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setLimite(60) }} placeholder="Nom ou description…" className={BOUTON} /></label>
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Famille<select value={famille} onChange={(e) => { setFamille(e.target.value); setLimite(60) }} className={BOUTON}><option value="">Toutes les familles</option>{FAMILLES.map((f) => <option key={f.cle} value={f.cle}>{f.nom}</option>)}</select></label>
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Afficher<select value={filtre} onChange={(e) => { setFiltre(e.target.value as typeof filtre); setLimite(60) }} className={BOUTON}><option value="tous">Tous les assets</option><option value="incomplets">Images fixes à compléter</option><option value="sans-description">Description à écrire</option></select></label>
    </div>
    {erreur && <div role="alert" className="mt-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur} <button onClick={() => setRelecture((n) => n + 1)} className="underline">Réessayer</button></div>}
    {chargement ? <p role="status" className="mt-[22px] text-encre-3">Lecture de la bibliothèque…</p> : <>
      <p role="status" className="mesure mt-[14px] text-[11px] text-encre-4">{totalSujets} sujet{totalSujets > 1 ? "s" : ""} · {equipements.length} équipement{equipements.length > 1 ? "s" : ""}</p>
      {FAMILLES_DE_SUJETS.filter((f) => !famille || famille === f.cle).map((f) => {
        const g = grilles[f.cle]
        if (!g || (!g.total && recherche)) return null
        return <section key={f.cle} aria-label={f.nom} className="mt-[22px]">
          <div className="mb-[14px] flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">{f.nom} <span className="mesure text-[12px] text-encre-4">{g.total}</span></h2><button onClick={() => onFamille(f.cle)} className={BOUTON}>Ouvrir et organiser</button></div>
          {!g.total ? <div className="rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">Cette famille est encore vide. <button className="underline" onClick={() => onFamille(f.cle)}>Créer le premier asset</button></div> : <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-[14px]">{g.personnages.map((s) => <CarteDeSujet key={s.identifiant} sujet={s} onOuvrir={() => onOuvrir(s.identifiant)} />)}</ul>}
          {g.personnages.length < g.total && <p className="mt-[8px] text-[12px] text-encre-3">{g.personnages.length} affichés sur {g.total}. La recherche porte sur toute la famille.</p>}
        </section>
      })}
      {(!famille || famille === "equipement") && <section aria-label="Équipements" className="mt-[22px]"><div className="mb-[14px] flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">Équipements</h2><button className={BOUTON} onClick={() => onFamille("equipement")}>Ouvrir les équipements</button></div><p className="mb-[14px] text-[12px] text-encre-3">Une pièce commune au jeu, puis ses emplois adaptés à chaque personnage. La couverture des calques se vérifie dans chaque emploi.</p><ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-[14px]">{equipements.map((p) => <li key={p.identifiant}><button className="flex h-full w-full flex-col rounded-8 border border-trait bg-carte p-[14px] text-left hover:border-contour" onClick={() => onPiece(p.identifiant)}><span className="mb-[14px] flex h-[128px] w-full items-center justify-center rounded-5 bg-pourtour">{apercusDesPieces.get(p.identifiant) ? <img src={apercusDesPieces.get(p.identifiant)!} alt="" loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated]" /> : <span className="rounded-5 bg-carte px-[8px] py-[4px] text-[11px] text-encre-3">Calque à créer</span>}</span><span className="font-serif text-[25px] text-encre">{p.nom}</span><span className="mt-[8px] line-clamp-2 text-[12px] text-encre-3">{p.description || "Description à écrire"}</span><span className="mt-[14px] text-[12px] text-encre-controle">Voir les emplois →</span></button></li>)}</ul>{!equipements.length && <p className="text-[13px] text-encre-3">Aucun équipement pour cette recherche.</p>}</section>}
      {encore && <button className={`${BOUTON} mt-[22px]`} onClick={() => setLimite((n) => n + 60)}>Afficher davantage d’assets</button>}
      {!totalSujets && !equipements.length && recherche && <div className="mt-[22px] rounded-8 border border-trait p-[22px]"><h2 className="font-serif text-[25px] text-encre">Aucun asset trouvé</h2><p className="mt-[8px] text-[13px] text-encre-3">Modifiez les filtres ou cherchez un autre mot.</p><button className={`${BOUTON} mt-[14px]`} onClick={() => { setRecherche(""); setFamille(""); setFiltre("tous") }}>Effacer les filtres</button></div>}
    </>}
  </main>
}

function CarteDeSujet({ sujet: s, onOuvrir }: { sujet: SujetDeLaGrille; onOuvrir: () => void }) {
  return <li><button onClick={onOuvrir} className="flex h-full w-full flex-col overflow-hidden rounded-8 border border-trait bg-carte text-left hover:border-contour">
    <span className="flex h-[128px] w-full items-center justify-center bg-pourtour">{s.vignette ? <img alt="" loading="lazy" src={api.vignette(s.vignette.identifiant, s.vignette.empreinte, 192)} className="h-full w-full object-contain [image-rendering:pixelated]" /> : <span className="rounded-5 bg-carte px-[8px] py-[4px] text-[11px] text-encre-3">Image à créer</span>}</span>
    <span className="flex flex-1 flex-col gap-[8px] p-[14px]"><span className="font-serif text-[25px] leading-[1.1] text-encre">{s.nom}</span><span className="line-clamp-2 text-[12px] text-encre-3">{s.description || "Description à écrire"}</span><span className="mesure text-[11px] text-encre-3">Images {s.compte.images.fait}/{s.compte.images.attendu} · Animations {s.compte.bandes.fait}/{s.compte.bandes.attendu}</span>{s.collections.length > 0 && <span className="truncate text-[11px] text-encre-4">{s.collections.map((c) => c.nom).join(" · ")}</span>}</span>
  </button></li>
}
