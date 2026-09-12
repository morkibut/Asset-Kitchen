// Les médias qui ne sont pas des images dans la galerie.
//
// La bibliothèque d'images continue d'être servie et filtrée par `/assets`.
// Les bandes, les sources 3D et les sons ont leurs propres contrats : cette
// surface les rend ensemble sans prétendre que l'un de leurs catalogues est une
// page partielle d'un autre.

import { useEffect, useMemo, useRef, useState } from "react"
import { api, type AnimationDeLivraison, type Bande, type Filtre, type Generation } from "../api"
import { sources3d, type Source3D } from "../api-3d"
import { sons, type Son } from "../api-sons"
import { BandeQuiTourne } from "./Apercu"
import { useEtatDuParcours } from "./MemoireDuParcours"
import type { Entree } from "./Tuile"

export type SorteDeMedia = "images" | "animations" | "videos" | "modeles-3d" | "sons"

const SORTES: { valeur: SorteDeMedia; nom: string }[] = [
  { valeur: "images", nom: "Images" },
  { valeur: "animations", nom: "Animations" },
  { valeur: "videos", nom: "Vidéos" },
  { valeur: "modeles-3d", nom: "Modèles 3D" },
  { valeur: "sons", nom: "Sons" },
]

const PAR_PAGE = 24

export function GalerieMedias({
  filtre,
  onRecherche,
  clips,
  projet,
  onChanger,
  onBande,
  onSon,
  onSource3D,
  children,
}: {
  filtre: Filtre
  onRecherche: (recherche: string) => void
  entrees: Entree[]
  /** Les clips persistants ne passent pas par `/assets` : une recherche sur
   * les images ne doit donc jamais les faire disparaître des autres médias. */
  clips: Generation[]
  projet: string | null
  onChanger: (sorte: SorteDeMedia) => void
  onBande: (identifiant: string) => void
  /** Les raccords sont fournis par App quand l'atelier concerné est monté. */
  onSon?: (identifiant: string) => void
  onSource3D?: (source: Source3D) => void
  children: (sorte: SorteDeMedia, videos: Entree[]) => React.ReactNode
}) {
  const cleMemoire = `galerie:${projet ?? "sans-projet"}`
  const [sorte, setSorte] = useEtatDuParcours<SorteDeMedia>(`${cleMemoire}:media`, "images")
  const [page, setPage] = useEtatDuParcours(`${cleMemoire}:page`, 0)
  const [animationsLues, setAnimationsLues] = useState<AnimationDeLivraison[] | null>(null)
  const [sources, setSources] = useState<Source3D[] | null>(null)
  const [listeSons, setListeSons] = useState<Son[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [tentative, setTentative] = useState(0)
  const [etatLecture, setEtatLecture] = useState<"en-cours" | "pret" | "erreur">("pret")
  const [mediaLu, setMediaLu] = useState<SorteDeMedia | null>(null)

  const clipsVivants = useMemo(() => clips.filter((clip) => !clip.clip?.jete), [clips])

  const dernierChoix = useRef({ cleMemoire, sorte, recherche: filtre.recherche.trim() })
  useEffect(() => {
    const recherche = filtre.recherche.trim()
    const choix = dernierChoix.current
    if (choix.cleMemoire === cleMemoire && (choix.sorte !== sorte || choix.recherche !== recherche)) setPage(0)
    dernierChoix.current = { cleMemoire, sorte, recherche }
    onChanger(sorte)
  }, [cleMemoire, filtre.recherche, onChanger, setPage, sorte])

  useEffect(() => {
    if (sorte !== "animations") return
    if (!projet) {
      setAnimationsLues([])
      return
    }
    let vivant = true
    setEtatLecture("en-cours")
    setAnimationsLues(null)
    setErreur(null)
    void api.animationsDeLivraison(projet)
      .then((lues) => { if (vivant) { setAnimationsLues(lues); setMediaLu("animations"); setEtatLecture("pret") } })
      .catch(() => { if (vivant) { setAnimationsLues([]); setEtatLecture("erreur"); setErreur("Les animations ne peuvent pas être relues.") } })
    return () => { vivant = false }
  }, [projet, sorte, tentative])

  useEffect(() => {
    if (!projet || (sorte !== "modeles-3d" && sorte !== "sons")) return
    let vivant = true
    setEtatLecture("en-cours")
    setErreur(null)
    if (sorte === "modeles-3d") {
      setSources(null)
      void sources3d.lister(projet)
        .then(({ sources: lues }) => { if (vivant) { setSources(lues); setMediaLu("modeles-3d"); setEtatLecture("pret") } })
        .catch(() => { if (vivant) { setSources([]); setEtatLecture("erreur"); setErreur("Les sources 3D ne peuvent pas être relues.") } })
    } else {
      setListeSons(null)
      void sons.lister(projet)
        .then((lus) => { if (vivant) { setListeSons(lus); setMediaLu("sons"); setEtatLecture("pret") } })
        .catch(() => { if (vivant) { setListeSons([]); setEtatLecture("erreur"); setErreur("Les sons ne peuvent pas être relus.") } })
    }
    return () => { vivant = false }
  }, [projet, sorte, tentative])

  const recherche = filtre.recherche.trim().toLocaleLowerCase("fr")
  const contient = (texte: string) => !recherche || texte.toLocaleLowerCase("fr").includes(recherche)
  const animations = (mediaLu === "animations" ? animationsLues ?? [] : []).filter((bande) => contient(`${bande.nom} ${bande.pose ?? ""} ${bande.direction ?? ""}`))
  const videos = clipsVivants
    .filter((clip) => contient(clip.demande.prompt))
    .map((generation) => ({ cle: generation.identifiant, date: generation.cree_le, rang: 0, sorte: "clip" as const, generation }))
  const modeles = (mediaLu === "modeles-3d" ? sources ?? [] : []).filter((source) => contient(`${source.nom} ${source.origine}`))
  const sonsFiltres = (mediaLu === "sons" ? listeSons ?? [] : []).filter((son) => contient(`${son.nom} ${son.etat}`))
  const actuel = sorte === "animations" ? animations : sorte === "modeles-3d" ? modeles : sorte === "sons" ? sonsFiltres : []
  const pages = Math.max(1, Math.ceil(actuel.length / PAR_PAGE))
  const pageSure = Math.min(page, pages - 1)
  const visibles = actuel.slice(pageSure * PAR_PAGE, (pageSure + 1) * PAR_PAGE)

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-[14px] border-b border-trait bg-papier px-[30px] pt-[22px] pb-[14px]">
        <div>
          <h1 className="font-serif text-[38px] leading-none text-encre">Galerie</h1>
          <p className="mt-[4px] text-[13px] text-encre-3">Chaque résultat conservé, quel que soit son média.</p>
        </div>
        <label className="flex min-w-[240px] flex-1 flex-col gap-[4px] text-[12px] text-encre-3 sm:max-w-[380px]">
          Rechercher dans les résultats
          <input
            type="search"
            value={filtre.recherche}
            onChange={(event) => onRecherche(event.target.value)}
            placeholder="Nom, rôle ou état…"
            className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre placeholder:text-encre-4"
          />
        </label>
      </header>
      <nav aria-label="Type de média" className="flex shrink-0 gap-[4px] overflow-x-auto border-b border-trait bg-papier px-[30px] py-[8px]">
        {SORTES.map(({ valeur, nom }) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={sorte === valeur}
            onClick={() => setSorte(valeur)}
            className={`h-[30px] shrink-0 rounded-7 border px-[14px] text-[12px] ${sorte === valeur ? "border-signal bg-ligne-ouverte text-signal" : "border-trait bg-carte text-encre-2 hover:bg-papier-cote"}`}
          >
            {nom}
          </button>
        ))}
      </nav>
      {sorte === "images" || sorte === "videos" ? children(sorte, videos) : (
        <section aria-label={SORTES.find((item) => item.valeur === sorte)?.nom} className="min-h-0 flex-1 overflow-y-auto px-[30px] py-[22px]">
          {erreur && <p role="alert" className="mb-[14px] text-[13px] text-echec">{erreur}</p>}
          {erreur && projet && <button type="button" onClick={() => setTentative((fois) => fois + 1)} className="mb-[14px] text-[12px] text-signal hover:opacity-70">Réessayer la lecture</button>}
          {(!projet && (sorte === "animations" || sorte === "modeles-3d" || sorte === "sons")) ? (
            <EtatVide texte="Ouvrez un jeu pour relire ses médias." />
          ) : (
            <>
              {etatLecture === "en-cours" && sorte === "animations" && <p role="status" className="text-[13px] text-encre-3">Lecture des animations conservées…</p>}
              {etatLecture === "en-cours" && sorte === "modeles-3d" && <p role="status" className="text-[13px] text-encre-3">Lecture des sources 3D…</p>}
              {etatLecture === "en-cours" && sorte === "sons" && <p role="status" className="text-[13px] text-encre-3">Lecture des sons…</p>}
              {actuel.length > 0 && <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-[14px]">
                {sorte === "animations" && (visibles as AnimationDeLivraison[]).map((bande) => <CarteBande key={bande.identifiant} bande={bande} onOuvrir={onBande} />)}
                {sorte === "modeles-3d" && (visibles as Source3D[]).map((source) => <Carte3D key={source.identifiant} source={source} onOuvrir={onSource3D} />)}
                {sorte === "sons" && (visibles as Son[]).map((son) => <CarteSon key={son.identifiant} son={son} onOuvrir={onSon} />)}
              </div>}
              {etatLecture === "pret" && mediaLu === sorte && actuel.length === 0 && <EtatVide texte="Aucun résultat pour ces filtres." />}
              {actuel.length > PAR_PAGE && <Pagination page={pageSure} pages={pages} onPage={setPage} />}
            </>
          )}
        </section>
      )}
    </>
  )
}

function CarteBande({ bande, onOuvrir }: { bande: AnimationDeLivraison; onOuvrir: (identifiant: string) => void }) {
  const [complete, setComplete] = useState<Bande | null>(null)
  const [erreur, setErreur] = useState(false)
  const [tentative, setTentative] = useState(0)
  const [joue, setJoue] = useState(false)
  useEffect(() => {
    let vivant = true
    setComplete(null)
    setErreur(false)
    void api.ouvrirLaBande(bande.identifiant).then((lue) => vivant && setComplete(lue.bande)).catch(() => vivant && setErreur(true))
    return () => { vivant = false }
  }, [bande.identifiant, tentative])
  return <article className="flex min-w-0 flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
    <div onPointerEnter={() => setJoue(true)} onPointerLeave={() => setJoue(false)} className="flex justify-center bg-pourtour p-[8px]">{complete ? <BandeQuiTourne bande={complete} cote={128} titre={bande.nom} joue={joue} /> : erreur ? <div className="flex h-[128px] w-[128px] flex-col items-center justify-center gap-[8px] text-center text-[12px] text-encre-sur-signal"><span>Vignette indisponible</span><button type="button" onClick={() => setTentative((fois) => fois + 1)} className="text-encre-sur-signal underline hover:opacity-70">Réessayer la vignette</button></div> : <span className="flex h-[128px] w-[128px] items-center justify-center text-[12px] text-encre-sur-signal">Vignette en lecture…</span>}</div>
    <div className="min-w-0"><h2 className="truncate text-[14px] font-medium text-encre" title={bande.nom}>{bande.nom}</h2><p className="mt-[4px] text-[12px] text-encre-3">{bande.compte} frames · {bande.cadence} i/s{bande.pose ? ` · ${bande.pose}` : ""}</p></div>
    <button type="button" onClick={() => onOuvrir(bande.identifiant)} className="self-start text-[12px] text-signal hover:opacity-70">Ouvrir l’animation ›</button>
  </article>
}

function Carte3D({ source, onOuvrir }: { source: Source3D; onOuvrir?: (source: Source3D) => void }) {
  const apercu = "frame-0000.png" in source.fichiers ? sources3d.fichier(source, "frame-0000.png") : null
  return <article className="flex min-w-0 flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
    <div className="flex h-[128px] items-center justify-center overflow-hidden bg-pourtour">
      {apercu ? <img src={apercu} alt={`Première frame de ${source.nom}`} loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated]" /> : <span className="text-[12px] text-encre-sur-signal">Aperçu image indisponible</span>}
    </div>
    <div className="min-w-0"><h2 className="truncate text-[14px] font-medium text-encre" title={source.nom}>{source.nom}</h2><p className="mt-[4px] text-[12px] text-encre-3">{source.images} frames · {source.largeur} × {source.hauteur} px · {source.cadence} i/s</p></div>
    <button type="button" disabled={!onOuvrir} onClick={() => onOuvrir?.(source)} className="self-start text-[12px] text-signal disabled:text-eteint">Ouvrir la source 3D ›</button>
  </article>
}

function CarteSon({ son, onOuvrir }: { son: Son; onOuvrir?: (identifiant: string) => void }) {
  return <article className="flex min-w-0 flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
    <ApercuOnde son={son} />
    <div className="min-w-0"><h2 className="truncate text-[14px] font-medium text-encre" title={son.nom}>{son.nom}</h2><p className="mt-[4px] text-[12px] text-encre-3">{son.mesures ? `${son.mesures.duree.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s · ${son.mesures.canaux} canal${son.mesures.canaux > 1 ? "x" : ""}` : son.raison}</p></div>
    <button type="button" disabled={!onOuvrir} onClick={() => onOuvrir?.(son.identifiant)} className="self-start text-[12px] text-signal disabled:text-eteint">Ouvrir le son ›</button>
  </article>
}

function ApercuOnde({ son }: { son: Son }) {
  const [onde, setOnde] = useState<{ minimum: number[]; maximum: number[] } | null>(null)
  useEffect(() => {
    let vivant = true
    void sons.onde(son).then((lue) => vivant && setOnde(lue.canaux_ondes[0] ?? null)).catch(() => vivant && setOnde(null))
    return () => { vivant = false }
  }, [son])
  const points = onde ? onde.maximum.map((maximum, index) => `${(index / Math.max(onde.maximum.length - 1, 1)) * 100},${50 - Math.max(-1, Math.min(1, maximum)) * 42}`).join(" ") : ""
  return <div className="flex h-[128px] items-center border border-trait bg-pourtour px-[8px]">
    {points ? <svg aria-label={`Forme d’onde de ${son.nom}`} viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full"><polyline points={points} fill="none" stroke="var(--papier)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg> : <span className="text-[12px] text-encre-sur-signal">Forme d’onde indisponible</span>}
  </div>
}

function EtatVide({ texte }: { texte: string }) {
  return <div className="rounded-8 border border-dashed border-contour p-[22px]"><p className="text-[13px] text-encre-3">{texte}</p></div>
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return <div className="mt-[22px] flex items-center gap-[14px] text-[12px] text-encre-3"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="text-encre-controle disabled:text-eteint">Précédent</button><span className="mesure">Page {page + 1} / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} className="text-encre-controle disabled:text-eteint">Suivant</button></div>
}
