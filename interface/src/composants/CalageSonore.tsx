// **Caler un son sur une animation** (SN7 ; maquette
// `docs/maquettes-atelier-unifie/03-son.html`, « Caler sur une animation »
// sous un emplacement rempli). On choisit une animation du sujet, on clique
// une image de sa bande : « image 3 : pas ». « Jouer » fait tourner la bande
// à sa cadence et fait entendre le son à chaque passage sur l'image.
//
// Le repère tient à l'image, pas à un temps : changer la cadence ici change
// celle de la bande (la même que dans son atelier), et le repère reste sur
// son image.
import { useEffect, useMemo, useRef, useState } from "react"
import { api, dureeImageMs, type Bande, type Personnage, type Pose } from "../api"
import { imagesTraversees, reperesSonores, type ReperesSonores } from "../api-reperes-sonores"
import { rangDeLaBande } from "./Apercu"
import { bandeQuiSortirait } from "./EssaiDuSujet"

const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const CHAMP = "min-h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
const ATTENTION = "rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[12px] text-encre-attention"
const CADENCES = [6, 8, 12]
const ZOOM = 3

export type AnimationDuSujet = { bande: Bande; nom: string }

/** Les animations du sujet, une par mouvement et direction : celle qui
 *  sortirait dans le jeu (la même règle que la salle d'essai). */
export function animationsDuSujet(personnage: Personnage, plan: readonly Pose[] = []): AnimationDuSujet[] {
  const vues: AnimationDuSujet[] = []
  for (const c of personnage.cases) {
    const pose = plan.find((p) => p.identifiant === c.pose)?.nom ?? c.pose
    const directions = c.directions.length ? c.directions.map((d) => ({ id: d.identifiant as string | null, nom: d.nom })) : [{ id: null, nom: "" }]
    for (const d of directions) {
      const bande = bandeQuiSortirait(personnage.cases, c.pose, d.id)
      if (bande && !vues.some((v) => v.bande.identifiant === bande.identifiant))
        vues.push({ bande, nom: d.nom ? `${pose} · ${d.nom.toLowerCase()}` : pose })
    }
  }
  return vues
}

/** Le texte « Calé sur … » d'un emplacement, pour sa carte. */
export function texteDuCalage(vue: ReperesSonores | null, cle: string, animations: AnimationDuSujet[]): string {
  const parBande = new Map<string, number[]>()
  for (const r of vue?.reperes ?? []) if (r.cle === cle) parBande.set(r.bande, [...(parBande.get(r.bande) ?? []), r.image])
  return [...parBande].map(([bande, images]) => {
    const nom = animations.find((a) => a.bande.identifiant === bande)?.nom ?? vue?.reperes.find((r) => r.bande === bande)?.nom_bande ?? "une animation"
    return `${nom.toLowerCase()}, image${images.length > 1 ? "s" : ""} ${images.join(" et ")}`
  }).join(" · ")
}

export function CalageSonore({ projet, sujet, cle, nom, animations, vue, onVue, onJouer }: {
  projet: string; sujet: string; cle: string; nom: string
  animations: AnimationDuSujet[]
  vue: ReperesSonores | null
  onVue: (v: ReperesSonores) => void
  /** Faire entendre l'emplacement (une variante, jamais deux fois la même de suite). */
  onJouer: (cle: string) => void
}) {
  const mot = nom.toLowerCase()
  const depart = useMemo(() => {
    const deja = animations.find((a) => vue?.reperes.some((r) => r.cle === cle && r.bande === a.bande.identifiant))
    const marcheSud = animations.find((a) => a.bande.pose === "marche" && a.bande.direction === "sud")
    return (deja ?? marcheSud ?? animations[0])?.bande.identifiant ?? ""
  }, [animations, vue, cle])
  const [choisie, setChoisie] = useState<string | null>(null)
  const id = choisie ?? depart
  const animation = animations.find((a) => a.bande.identifiant === id) ?? null
  // La cadence changée ici vaut tout de suite, sans attendre que la fiche se relise.
  const [cadences, setCadences] = useState<Record<string, number>>({})
  const bande = animation ? { ...animation.bande, cadence: cadences[animation.bande.identifiant] ?? animation.bande.cadence } : null
  const images = useMemo(() => (vue?.reperes ?? []).filter((r) => r.cle === cle && r.bande === id).map((r) => r.image).sort((a, b) => a - b), [vue, cle, id])
  const signaux = (vue?.reperes ?? []).filter((r) => r.cle === cle && r.bande === id && r.signal)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)

  // « Jouer » : la bande tourne à sa cadence (le pas exact de l'export), et le
  // son part à chaque passage sur une image repérée.
  const [joue, setJoue] = useState(false)
  const [pas, setPas] = useState(0)
  const pasMs = bande ? dureeImageMs(bande.cadence) : 0
  useEffect(() => {
    if (!joue || pasMs <= 0) return
    let depuis = performance.now()
    const minuteur = window.setInterval(() => {
      const avances = Math.floor((performance.now() - depuis) / pasMs)
      if (avances > 0) { depuis += avances * pasMs; setPas((p) => p + avances) }
    }, pasMs)
    return () => window.clearInterval(minuteur)
  }, [joue, pasMs])
  const dernier = useRef<number | null>(null)
  useEffect(() => {
    if (!joue || !bande) { dernier.current = null; return }
    const avant = dernier.current
    dernier.current = pas
    const rang = (p: number) => rangDeLaBande(p, bande.compte, bande.sens)
    const vues = avant === null ? [rang(pas) + 1] : imagesTraversees(avant, pas, rang)
    for (const image of vues) if (images.includes(image)) onJouer(cle)
  }, [pas, joue]) // eslint-disable-line react-hooks/exhaustive-deps -- un pas, un geste
  const courante = joue && bande ? rangDeLaBande(pas, bande.compte, bande.sens) + 1 : null

  const basculer = async (image: number) => {
    if (!bande) return
    setOccupe(true); setErreur("")
    try {
      onVue(await (images.includes(image) ? reperesSonores.retirer : reperesSonores.poser)(projet, sujet, bande.identifiant, image, cle))
    } catch (e) { setErreur(e instanceof Error ? e.message : "Le repère n’a pas pu être posé.") } finally { setOccupe(false) }
  }
  const changerCadence = async (cadence: number) => {
    if (!bande) return
    setErreur("")
    try {
      await api.corrigerLaBande(bande.identifiant, { cadence })
      setCadences((c) => ({ ...c, [bande.identifiant]: cadence }))
    } catch (e) { setErreur(e instanceof Error ? e.message : "La cadence n’a pas changé.") }
  }

  if (!animations.length) return <p className="text-[13px] text-encre-3">Ce sujet n’a pas encore d’animation où caler ce son.</p>
  return <div aria-label={`Calage de ${mot}`} className="grid w-full gap-[8px] rounded-8 border border-trait bg-papier-cote p-[14px]">
    <div className="flex flex-wrap items-center gap-[8px]">
      <label className="flex items-center gap-[8px] text-[12px] text-encre-3">Animation
        <select aria-label="Animation" className={CHAMP} value={id} onChange={(e) => { setChoisie(e.target.value); setJoue(false) }}>
          {animations.map((a) => <option key={a.bande.identifiant} value={a.bande.identifiant}>{a.nom}</option>)}
        </select>
      </label>
      {bande && <label className="flex items-center gap-[8px] text-[12px] text-encre-3">Cadence
        <select aria-label="Cadence" className={CHAMP} value={bande.cadence} onChange={(e) => void changerCadence(Number(e.target.value))}>
          {[...new Set([...CADENCES, bande.cadence])].sort((a, b) => a - b).map((c) => <option key={c} value={c}>{c} images/s</option>)}
        </select>
      </label>}
      <button type="button" className={PETIT} disabled={!bande || bande.compte < 2} onClick={() => { setPas(0); setJoue((j) => !j) }}>{joue ? "■ Arrêter" : "▶ Jouer"}</button>
    </div>
    {bande && <div className="flex flex-wrap gap-[4px]">
      {Array.from({ length: bande.compte }, (_, k) => {
        const image = k + 1
        const pose = images.includes(image)
        return <button key={image} type="button" aria-label={`Image ${image}`} aria-pressed={pose} disabled={occupe}
          onClick={() => void basculer(image)}
          className={`grid justify-items-center gap-[4px] rounded-7 border p-[4px] ${courante === image ? "border-encre" : pose ? "border-encre-3" : "border-contour"} ${pose ? "bg-carte" : ""}`}>
          <span aria-hidden="true" style={{
            display: "block", width: bande.case_largeur * ZOOM, height: bande.case_hauteur * ZOOM,
            backgroundImage: `url(${api.plancheDeLaBande(bande.identifiant)})`,
            backgroundSize: `${bande.case_largeur * bande.compte * ZOOM}px ${bande.case_hauteur * ZOOM}px`,
            backgroundPosition: `-${k * bande.case_largeur * ZOOM}px 0`, imageRendering: "pixelated",
          }} />
          <span className="font-mono text-[12px] text-encre-3">{image}</span>
          <span className="text-[12px] text-encre">{pose ? mot : " "}</span>
        </button>
      })}
    </div>}
    <p className="text-[12px] text-encre-3">
      Clique une image pour y poser « {mot} ». {images.length ? images.map((k) => `Image ${k} : ${mot}.`).join(" ") : "Aucun repère sur cette animation."}
    </p>
    {signaux.map((r, i) => <span key={i} className={ATTENTION}>Image {r.image} : {r.signal}</span>)}
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
  </div>
}
