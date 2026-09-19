// **L'onglet « Sons » de la fiche d'un sujet** (SN6 ; maquette
// `docs/maquettes-atelier-unifie/03-son.html`, vue « Le pèlerin · Sons ») :
// les emplacements que sa famille propose, remplis ou vides, et ceux qu'on
// nomme à la main. Un emplacement vide lance une série déjà décrite par le
// sujet ; garder un tirage le range dans le jeu de l'emplacement. La demande,
// la série et le jeu sont ceux de « Un son », sans rien de réécrit.
import { useCallback, useEffect, useState } from "react"
import { jeuxDeVariantes, type FamilleSon, type JeuVariantes } from "../api-series-son"
import { sonsDuSujet, type Emplacement, type Proposition, type SonsDuSujet as Vue } from "../api-sons-du-sujet"
import { UnSon } from "./FabricationAudio"
import { JeuDeVariantes } from "./JeuDeVariantes"
import { SonRetro } from "./SonRetro"

const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const CHAMP = "min-h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
const ATTENTION = "rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[12px] text-encre-attention"
const message = (e: unknown) => e instanceof Error ? e.message : "Les sons de ce sujet n’ont pas pu être lus."

export const NOMS_FAMILLES: Record<FamilleSon, string> = { bruitage: "Bruitage", interface: "Interface et rétro", ambiance: "Ambiance", musique: "Musique", jingle: "Jingle", chanson: "Chanson", voix: "Voix" }
/** Les voix arrivent avec SN11 : l'emplacement existe, il ne se fabrique pas encore. */
const A_VENIR: FamilleSon[] = ["voix"]

function etat(e: Emplacement) {
  const c = e.contenu
  if (!e.rempli || !c) return e.series.length ? "une série, rien de gardé" : "vide"
  return c.nature === "jeu" ? (c.sons.length > 1 ? `${c.sons.length} variantes` : "1 son") : "1 son"
}

export function SonsDuSujet({ projet, sujet, nomSujet, onRegler }: {
  projet: string; sujet: string; nomSujet: string; onRegler?: (son: string) => void
}) {
  const [vue, setVue] = useState<Vue | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [erreur, setErreur] = useState("")
  const [ajout, setAjout] = useState(false)
  const [nom, setNom] = useState("")
  const [famille, setFamille] = useState<FamilleSon>("bruitage")
  const [occupe, setOccupe] = useState(false)

  const relire = useCallback(() => sonsDuSujet.lire(projet, sujet).then(setVue).catch((e) => setErreur(message(e))), [projet, sujet])
  useEffect(() => { setVue(null); setOuvert(null); void relire() }, [relire])

  const faire = async (geste: () => Promise<unknown>) => {
    setOccupe(true); setErreur("")
    try { await geste() } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  const emplacement = vue?.emplacements.find((e) => e.cle === ouvert) ?? null
  if (emplacement) return <EmplacementOuvert key={emplacement.cle} projet={projet} sujet={sujet} nomSujet={nomSujet} emplacement={emplacement}
    onRetour={() => { setOuvert(null); void relire() }} onChange={() => void relire()} onRegler={onRegler} />

  return <section aria-label="Sons" className="grid gap-[14px]">
    <div className="flex items-baseline justify-between gap-[14px]">
      <h2 className="font-serif text-[25px]">Sons</h2>
      {vue && <span className="font-mono text-[12px] text-encre-3">{vue.remplis} sur {vue.total} remplis</span>}
    </div>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!vue && !erreur && <p className="text-[13px] text-encre-3">Lecture des sons…</p>}
    {vue && vue.total === 0 && <p className="text-[13px] text-encre-3">Cette famille de sujets n’a pas d’emplacement proposé. Nommez-en un.</p>}
    {vue && <ul className="grid gap-[8px]">
      {vue.emplacements.map((e) => {
        const aVenir = A_VENIR.includes(e.famille)
        return <li key={e.cle} aria-label={e.nom} className="flex flex-wrap items-center gap-[14px] rounded-8 border border-trait bg-carte p-[14px]">
          <div className="grid min-w-[128px]"><strong className="text-[13px]">{e.nom}</strong><span className="text-[12px] text-encre-3">{NOMS_FAMILLES[e.famille]}</span></div>
          <div className="grid min-w-0 flex-1 gap-[4px]">
            <span className={`text-[13px] ${e.rempli ? "text-encre" : "text-encre-3"}`}>{etat(e)}</span>
            {e.rempli && <span className="font-mono text-[12px] text-encre-3">{e.nom_stable}</span>}
            {e.contenu?.signalements.map((s, i) => <span key={i} className={ATTENTION}>{s.signal}</span>)}
          </div>
          <div className="flex flex-wrap gap-[8px]">
            {aVenir && !e.rempli
              ? <button type="button" className={BOUTON} disabled>Fabriquer · à venir</button>
              : <button type="button" className={BOUTON} onClick={() => setOuvert(e.cle)}>{e.rempli ? "Ouvrir" : e.series.length ? "Reprendre la série" : "Fabriquer"}</button>}
            {e.libre && !e.rempli && <button type="button" className={PETIT} disabled={occupe} aria-label={`Retirer l’emplacement ${e.nom}`}
              onClick={() => void faire(async () => setVue(await sonsDuSujet.retirer(projet, sujet, e.cle)))}>Retirer</button>}
          </div>
        </li>
      })}
    </ul>}
    {vue && (ajout
      ? <form className="flex flex-wrap items-center gap-[8px]" onSubmit={(ev) => {
          ev.preventDefault()
          if (!nom.trim()) return
          void faire(async () => { setVue(await sonsDuSujet.ajouter(projet, sujet, { nom: nom.trim(), famille })); setNom(""); setAjout(false) })
        }}>
          <input aria-label="Nom de l’emplacement" placeholder="Ex. : saut" className={CHAMP} value={nom} onChange={(ev) => setNom(ev.target.value)} autoFocus />
          <select aria-label="Famille" className={CHAMP} value={famille} onChange={(ev) => setFamille(ev.target.value as FamilleSon)}>
            {(Object.keys(NOMS_FAMILLES) as FamilleSon[]).map((f) => <option key={f} value={f}>{NOMS_FAMILLES[f]}</option>)}
          </select>
          <button type="submit" className={BOUTON} disabled={occupe || !nom.trim()}>Ajouter</button>
          <button type="button" className={PETIT} onClick={() => { setAjout(false); setNom("") }}>Annuler</button>
        </form>
      : <div><button type="button" className={PETIT} onClick={() => setAjout(true)}>+ Ajouter un emplacement</button></div>)}
  </section>
}

/** Un emplacement ouvert : la demande (déjà décrite par le sujet), ses séries,
 *  et ce qui le remplit. Interface et rétro passe par sfxr. */
function EmplacementOuvert({ projet, sujet, nomSujet, emplacement: e, onRetour, onChange, onRegler }: {
  projet: string; sujet: string; nomSujet: string; emplacement: Emplacement
  onRetour: () => void; onChange: () => void; onRegler?: (son: string) => void
}) {
  const [proposition, setProposition] = useState<Proposition | null>(null)
  const [jeu, setJeu] = useState<JeuVariantes | null>(null)
  const [erreur, setErreur] = useState("")
  const c = e.contenu
  useEffect(() => {
    let vivant = true
    if (!e.par_sfxr) sonsDuSujet.proposer(projet, sujet, e.cle).then((p) => { if (vivant) setProposition(p) }).catch((x) => vivant && setErreur(message(x)))
    return () => { vivant = false }
  }, [projet, sujet, e.cle, e.par_sfxr])
  // Ce qui remplit l'emplacement se montre quand aucune série ne le montre déjà.
  const idJeu = c?.nature === "jeu" && c.existe ? c.identifiant : null
  useEffect(() => {
    let vivant = true
    if (idJeu) jeuxDeVariantes.lire(projet, idJeu).then((j) => { if (vivant) setJeu(j) }).catch(() => {})
    else setJeu(null)
    return () => { vivant = false }
  }, [projet, idJeu])
  const vider = async () => {
    setErreur("")
    try { await sonsDuSujet.vider(projet, sujet, e.cle); onChange() } catch (x) { setErreur(message(x)) }
  }
  const poserJeu = (j: JeuVariantes) => {
    if (j.identifiant === idJeu) return
    sonsDuSujet.poser(projet, sujet, e.cle, { jeu: j.identifiant }).then(onChange).catch((x) => setErreur(message(x)))
  }

  return <section aria-label={`${e.nom} · ${nomSujet}`} className="grid gap-[14px]">
    <div className="flex flex-wrap items-center justify-between gap-[14px]">
      <div><h2 className="font-serif text-[25px]">{e.nom} · {nomSujet}</h2><p className="text-[12px] text-encre-3">{NOMS_FAMILLES[e.famille]}</p></div>
      <button type="button" className={BOUTON} onClick={onRetour}>‹ {nomSujet}</button>
    </div>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    <div className="flex flex-wrap items-center gap-[14px] text-[13px]">
      <span>Dans <strong>{nomSujet} › {e.nom}</strong></span>
      <span className="font-mono text-[12px] text-encre-3">{e.nom_stable}</span>
      {c && <button type="button" className={PETIT} onClick={() => void vider()}>Vider l’emplacement</button>}
      {c?.nature === "son" && c.existe && onRegler && <button type="button" className={PETIT} onClick={() => onRegler(c.identifiant)}>Régler {c.nom ?? "ce son"}</button>}
    </div>
    {jeu && !e.series.length && <JeuDeVariantes projet={projet} jeu={jeu} onJeu={setJeu} onRegler={onRegler} />}
    {e.par_sfxr
      ? <div className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
          <SonRetro projet={projet} departInitial={e.cle} nomDuJeu={e.nom_stable} onJeu={poserJeu} onRegler={onRegler} />
        </div>
      : proposition
        ? <UnSon projet={projet} onSon={onRegler} emplacement={{
            cle: `${sujet}:${e.cle}`, famille: e.famille, texte: proposition.prompt, nom: proposition.nom,
            series: e.series,
            preparer: async (corps) => { const s = await sonsDuSujet.preparer(projet, sujet, e.cle, corps); onChange(); return s },
          }} />
        : !erreur && <p className="text-[13px] text-encre-3">Lecture de la demande…</p>}
  </section>
}
