// **Un son** (SN2, SN3, SN8 ; maquette `docs/maquettes-atelier-unifie/03-son.html`) :
// choisir la famille, écrire une phrase, relire ce qui part, lancer une série,
// l'écouter au clavier, garder en jeu de variantes. Interface et rétro passe
// par sfxr, sans phrase. Rouvert depuis le suivi, un tirage montre sa série ;
// un son préparé seul (avant les séries) garde sa fenêtre d'avant.
import { useEffect, useRef, useState } from "react"
import { travauxAudio, type TravailAudio } from "../api-travaux-audio"
import { seriesSon, texteSon, type Annonce, type Composition, type DemandeSon, type FamilleSon, type MoteurDeFamille, type SerieSon as Serie } from "../api-series-son"
import { workflows, type ProfilWorkflow } from "../api-workflows"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { dureeTexte, secondesTexte, tempsTexte, virgule } from "../son-textes"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { CadreDialogue } from "./CadreDialogue"
import { SerieSon } from "./SerieSon"
import { SonRetro } from "./SonRetro"

const CHAMP = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle disabled:opacity-50"
const PUCE = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle aria-pressed:border-encre-3 aria-pressed:bg-ligne-ouverte aria-pressed:text-encre disabled:cursor-not-allowed disabled:opacity-50"
const BASCULE = "min-h-[30px] rounded-7 px-[8px] text-[12.5px] text-encre-controle aria-expanded:bg-ligne-ouverte"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3"
const PRINCIPAL = "min-h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50"
const PETIT_CHAMP = "min-h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
const ATTENTION = "justify-self-start rounded-5 border border-trait-attention bg-fond-attention px-[8px] py-[4px] text-[12.5px] text-encre-attention"
const message = (e: unknown) => e instanceof Error ? e.message : "Le son ne peut pas être préparé. Les résultats conservés restent disponibles."

// ── Les familles de l'écran ─────────────────────────────────────────────────
// Six puces pour sept familles du serveur : « Chanson et jingle » en porte deux.

type FamilleEcran = "bruitage" | "interface" | "ambiance" | "musique" | "chanson" | "voix"
type Famille = { nom: string; durees?: number[]; duree?: number; tirages: number[]; exemple?: string; aVenir?: boolean }
const FAMILLES: Record<FamilleEcran, Famille> = {
  bruitage: { nom: "Bruitage", durees: [0.5, 1, 2, 4], duree: 1, tirages: [4, 8, 12], exemple: "Ex. : sword slides out of a leather sheath" },
  interface: { nom: "Interface et rétro", tirages: [4, 8, 12] },
  ambiance: { nom: "Ambiance", durees: [20, 30, 45, 60], duree: 30, tirages: [4, 8, 12], exemple: "Ex. : rain in a stone cave, slow drips, distant wind" },
  musique: { nom: "Musique", tirages: [2, 4, 6], exemple: "Ex. : exploration, calm forest path at dawn" },
  chanson: { nom: "Chanson et jingle", durees: [2, 4, 8], duree: 4, tirages: [2, 4, 6], exemple: "Ex. : victory fanfare, short and bright" },
  voix: { nom: "Voix", tirages: [2, 4, 8], aVenir: true },
}
const EXEMPLE_CHANSON = "Ex. : tavern drinking song, male voice, lively"
const PAROLES = "[Intro]\n\n[Verse]\n\n[Chorus]\n\n[Outro]"

// Les moteurs de chaque famille, dans l'ordre du serveur (`atelier/audio/graphes.py`, `FAMILLES`).
// La liste ne décide rien : le moteur par défaut vient de `sound-defaults`, et
// un moteur absent de cette machine est grisé avec sa raison.
const MOTEURS: Partial<Record<FamilleSon, string[]>> = {
  bruitage: ["sa3-small-sfx", "sa-open-1"], ambiance: ["sa3-small-sfx", "sa3-medium"],
  musique: ["ace-step-15-turbo", "sa3-medium"], jingle: ["ace-step-15-turbo", "sa3-medium"], chanson: ["yue2-int8"],
}
const NOM_MOTEUR: Record<string, string> = { "sa3-small-sfx": "Stable Audio 3 Small-SFX", "sa-open-1": "Stable Audio Open 1.0", "sa3-medium": "Stable Audio 3 Medium", "ace-step-15-turbo": "ACE-Step 1.5", "yue2-int8": "YuE2" }

const NOTES: [string, string][] = [["C", "do"], ["C#", "do♯"], ["D", "ré"], ["Eb", "mi♭"], ["E", "mi"], ["F", "fa"], ["F#", "fa♯"], ["G", "sol"], ["Ab", "la♭"], ["A", "la"], ["Bb", "si♭"], ["B", "si"]]
const TONALITES = (["minor", "major"] as const).flatMap((mode) => NOTES.map(([en, fr]) => [`${en} ${mode}`, `${fr} ${mode === "minor" ? "mineur" : "majeur"}`] as const))
const tonaliteFr = (t: string) => TONALITES.find(([en]) => en === t)?.[1] ?? t
const MESURES: [number, string][] = [[2, "2/4"], [3, "3/4"], [4, "4/4"], [6, "6/8"]]

type Demande = {
  famille: FamilleEcran; mode: "jingle" | "chanson"
  textes: Partial<Record<FamilleEcran, string>>; durees: Partial<Record<FamilleEcran, number>>; tirages: Partial<Record<FamilleEcran, number>>
  moteurs: Partial<Record<FamilleSon, string>>
  musique: { tempo: number | null; tonalite: string; mesure: number; mesures: number }
  paroles: string
  /** Le texte relu à la main, qui part à la place du texte composé. */
  manuel: string | null
}
const nouvelle = (modele?: string): Demande => ({ famille: "bruitage", mode: "jingle", textes: {}, durees: {}, tirages: {}, moteurs: modele ? { bruitage: modele } : {},
  musique: { tempo: null, tonalite: "", mesure: 4, mesures: 16 }, paroles: PAROLES, manuel: null })

const familleServeur = (d: Demande): FamilleSon => d.famille === "chanson" ? d.mode : d.famille
const texteDe = (d: Demande) => d.textes[d.famille] ?? ""
const dureeDe = (d: Demande) => d.durees[d.famille] ?? FAMILLES[d.famille].duree
const aDuree = (d: Demande) => !!FAMILLES[d.famille].durees && !(d.famille === "chanson" && d.mode === "chanson")
const nombreDe = (d: Demande) => d.tirages[d.famille] ?? (FAMILLES[d.famille].tirages[1])

function demandeSon(d: Demande, defaut: string | null): DemandeSon {
  const famille = familleServeur(d)
  const r: DemandeSon = { famille, prompt: texteDe(d).trim() }
  const choisi = d.moteurs[famille]
  if (choisi && choisi !== defaut) r.modele = choisi
  if (aDuree(d)) r.secondes = dureeDe(d)
  if (d.famille === "musique") {
    r.mesures = d.musique.mesures; r.mesure = d.musique.mesure
    if (d.musique.tempo) r.tempo = d.musique.tempo
    if (d.musique.tonalite) r.tonalite = d.musique.tonalite
  }
  if (famille === "chanson" && d.paroles.trim()) r.paroles = d.paroles
  if (d.manuel !== null && d.manuel.trim()) r.texte_relu = d.manuel
  return r
}

// ── La relecture ────────────────────────────────────────────────────────────

const gris = (source?: string) => source === "description" || source === "demande" || source === "relu" ? "text-encre" : "text-encre-4"
function joindre(morceaux: { texte: string }[]) {
  // Comme le serveur (`_joindre`) : après un point, un blanc ; sinon une virgule.
  let texte = ""
  return morceaux.map((m, i) => { const sep = i === 0 ? "" : texte.endsWith(".") ? " " : ", "; texte += sep + m.texte; return sep })
}
const NOMS_REGLAGES: Record<string, string> = { paroles: "Paroles", tempo: "Tempo", tonalite: "Tonalité", mesure: "Mesure" }
const valeurReglage = (cle: string, v: string | number) => cle === "tempo" ? `${v} BPM` : cle === "tonalite" ? `${tonaliteFr(String(v))} (${v})` : cle === "mesure" ? (MESURES.find(([n]) => n === Number(v))?.[1] ?? String(v)) : String(v)

function Relecture({ compo, manuel, onManuel }: { compo: Composition; manuel: string | null; onManuel: (t: string | null) => void }) {
  if (manuel !== null) return <div className="grid gap-[8px] rounded-7 bg-papier-cote p-[14px] text-[13px]">
    <p className="text-[12px] text-encre-3">Ce texte part à la place du texte composé, pour cette série seulement.</p>
    <textarea aria-label="Texte qui part" className="min-h-[128px] w-full rounded-7 border border-contour bg-carte p-[8px] font-mono text-[12px] leading-[1.6]" value={manuel} onChange={(e) => onManuel(e.target.value)} />
    <div><button type="button" className={PETIT} onClick={() => onManuel(null)}>Revenir au texte composé</button></div>
  </div>
  const morceaux = compo.morceaux ?? []
  const seps = joindre(morceaux)
  return <div className="grid gap-[8px] rounded-7 bg-papier-cote p-[14px] text-[13px]">
    <p className="text-[12px] text-encre-3">Le texte final tel qu’il sera envoyé.</p>
    <div aria-label="Texte composé" className="grid gap-[4px] whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6]">
      <div>{morceaux.map((m, i) => <span key={i}><span className="text-encre-4">{seps[i]}</span><span className={gris(m.source)} data-source={m.source}>{m.texte}</span></span>)}{compo.texte?.endsWith(".") && !morceaux.at(-1)?.texte.endsWith(".") && <span className="text-encre-4">.</span>}</div>
      {Object.entries(compo.parametres ?? {}).map(([cle, p]) => <div key={cle}><span className="text-encre-4">{NOMS_REGLAGES[cle] ?? cle} : </span><span className={gris(p.source)}>{valeurReglage(cle, p.valeur)}</span></div>)}
      {compo.secondes != null && <div><span className="text-encre-4">Durée : </span><span className={gris(compo.source_secondes)}>{virgule(compo.secondes, compo.secondes % 1 ? 2 : 0)} s</span>{compo.mesures && <span className="text-encre-4"> ({compo.mesures.demandees} mesures, plus {compo.mesures.marge} de marge pour couper la boucle)</span>}</div>}
      {compo.texte_negatif && <div><span className="text-encre-4">À éviter : </span><span className="text-encre-4">{compo.texte_negatif}</span></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-[8px]">
      <p className="text-[12px]"><span className="text-encre">en noir : votre texte</span> · <span className="text-encre-4">en gris : ajouté par l’univers et le moteur</span></p>
      {compo.texte && <button type="button" className={PETIT} onClick={() => onManuel(compo.texte ?? "")}>Éditer ce texte ›</button>}
    </div>
  </div>
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export function FabricationAudio({ projet, modeleInitial = "", identifiantInitial, onSon, onFermer, autonome = true }: {
  projet: string; modeleInitial?: string; identifiantInitial?: string; onSon?: (id: string) => void; onFermer: () => void
  /** **Sa propre fenêtre, ou le corps d'une autre** (RP4). */
  autonome?: boolean
}) {
  const [ouvert, setOuvert] = useState<TravailAudio | null>(null)
  const [erreurOuverture, setErreurOuverture] = useState("")
  useEffect(() => {
    if (!identifiantInitial) return
    let vivant = true
    travauxAudio.lire(projet, identifiantInitial).then((t) => { if (vivant) setOuvert(t) }).catch((e) => vivant && setErreurOuverture(message(e)))
    return () => { vivant = false }
  }, [projet, identifiantInitial])
  const [nouvelleDemande, setNouvelleDemande] = useState(!identifiantInitial)

  let corps
  if (nouvelleDemande) corps = <UnSon projet={projet} modeleInitial={modeleInitial} onSon={onSon} />
  else if (erreurOuverture) corps = <p role="alert" className="p-[30px] text-echec">{erreurOuverture}</p>
  else if (!ouvert) corps = <p className="p-[30px] text-[13px] text-encre-3">Lecture…</p>
  else if (ouvert.serie) corps = <div className="defile min-h-0 flex-1 overflow-y-auto px-[30px] pb-[30px]"><SerieSon projet={projet} identifiant={ouvert.serie.identifiant} titre={`Série · ${ouvert.demande.nom || "Un son"}`} onRegler={onSon} /></div>
  else corps = <TravailAudioSeul projet={projet} initial={ouvert} onSon={onSon} onFermer={onFermer} onAutre={() => setNouvelleDemande(true)} />

  const tout = <>
    {autonome
      ? <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait p-[22px]"><div><h1 className="font-serif text-[38px]">Un son</h1><p className="mt-[8px] text-[13px] text-encre-3">Décrire, écouter, garder, puis livrer au jeu.</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
      : null}
    {corps}
  </>
  return autonome ? <CadreDialogue titre="Un son" onFermer={onFermer} enfants={tout} /> : tout
}

function UnSon({ projet, modeleInitial, onSon }: { projet: string; modeleInitial?: string; onSon?: (id: string) => void }) {
  const [depart] = useState<Demande>(() => nouvelle(modeleInitial || undefined))
  const [d, setD] = useState(depart)
  const [panneau, setPanneau] = useState<"relire" | "reglages" | null>(null)
  const [defauts, setDefauts] = useState<Partial<Record<FamilleSon, MoteurDeFamille>>>({})
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [compo, setCompo] = useState<Composition | null>(null)
  const [annonce, setAnnonce] = useState<Annonce | null>(null)
  const [refus, setRefus] = useState("")
  const [relecture, setRelecture] = useState(false)
  const [series, setSeries] = useState<{ identifiant: string; initiale?: Serie }[]>([])
  const [courante, setCourante] = useState<string | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const brouillon = useBrouillonLocal({ cle: `son:${projet}`, pret: true, reference: depart, etat: d, appliquer: setD, ecran: "Un son", quoi: texteDe(d) || FAMILLES[d.famille].nom })

  useEffect(() => {
    let vivant = true
    texteSon.moteurs(projet).then((r) => { if (vivant) setDefauts(r.familles) }).catch(() => {})
    workflows.lister().then((r) => { if (vivant) setProfils(r.profils.filter((p) => p.nature === "audio")) }).catch(() => {})
    return () => { vivant = false }
  }, [projet])

  const fs = familleServeur(d)
  const defaut = defauts[fs]?.modele ?? null
  const corps = demandeSon(d, defaut)
  const n = nombreDe(d)
  const cleDemande = JSON.stringify({ ...corps, n })
  const texte = texteDe(d).trim()
  const sonore = d.famille !== "interface" && d.famille !== "voix"

  // La relecture et le temps annoncé suivent la demande, sans rien lancer.
  const tour = useRef(0)
  useEffect(() => {
    const moi = ++tour.current
    setRefus(""); setAnnonce(null)
    if (!sonore || !texte) { setCompo(null); setRelecture(false); return }
    setRelecture(true)
    const minuterie = window.setTimeout(async () => {
      try {
        const c = await texteSon.composer(projet, corps)
        if (moi !== tour.current) return
        setCompo(c)
        if (c.raison || c.erreur || !c.compose) return
        const a = await seriesSon.annoncer(projet, { ...corps, nombre: n })
        if (moi === tour.current) setAnnonce(a)
      } catch (e) { if (moi === tour.current) setRefus(message(e)) } finally { if (moi === tour.current) setRelecture(false) }
    }, 300)
    return () => window.clearTimeout(minuterie)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projet, cleDemande, sonore])

  const changer = (v: Partial<Demande>) => setD((x) => ({ ...x, ...v }))
  const raison = !texte ? "Écrivez d’abord ce qu’on doit entendre."
    : refus || compo?.erreur || (compo && !compo.compose ? compo.raison : "") || compo?.raison || ""

  const lancer = async () => {
    setOccupe(true); setErreur("")
    try {
      const s = await seriesSon.preparer(projet, { ...corps, cle: crypto.randomUUID(), nombre: n })
      setSeries((x) => [...x.map(({ identifiant }) => ({ identifiant })), { identifiant: s.identifiant, initiale: s }]); setCourante(s.identifiant)
      brouillon.effacer()
      try {
        const lancee = await seriesSon.demarrer(projet, s.identifiant)
        setSeries((x) => x.map((e) => e.identifiant === s.identifiant ? { identifiant: s.identifiant, initiale: lancee } : e))
      } catch (e) { setErreur(message(e)) }
    } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }

  // Le moteur : celui de la famille par défaut, ou un autre installé ; un moteur absent se grise avec sa raison.
  const plusRecent = (id: string) => profils.filter((p) => p.identifiant === id).sort((a, b) => b.cree_le - a.cree_le)[0]
  const options: { valeur: string; nom: string; raison: string }[] = (MOTEURS[fs] ?? []).map((id) => {
    const p = plusRecent(id)
    return p ? { valeur: p.modele, nom: NOM_MOTEUR[id] ?? p.nom, raison: p.diagnostic?.disponible === false ? p.diagnostic.problemes.join(" · ") : "" }
      : { valeur: `absent:${id}`, nom: NOM_MOTEUR[id] ?? id, raison: "pas installé sur cette machine" }
  })
  for (const m of [defaut, d.moteurs[fs]]) if (m && !options.some((o) => o.valeur === m)) options.unshift({ valeur: m, nom: profils.find((p) => p.modele === m)?.nom ?? m, raison: "" })
  const moteurChoisi = d.moteurs[fs] ?? defaut ?? ""

  const F = FAMILLES[d.famille]
  const resume = [d.famille === "musique" ? `${d.musique.mesures} mesures` : aDuree(d) ? secondesTexte(dureeDe(d)!) : null, `${n} tirages`].filter(Boolean).join(" · ")
  const tempoUnivers = compo?.parametres?.tempo && compo.parametres.tempo.source !== "demande" ? Number(compo.parametres.tempo.valeur) : null
  const tonUnivers = compo?.parametres?.tonalite && compo.parametres.tonalite.source !== "demande" ? String(compo.parametres.tonalite.valeur) : null
  const tempo = d.musique.tempo || tempoUnivers || 90
  const serieCourante = series.find((s) => s.identifiant === courante)
  const precedentes = series.filter((s) => s.identifiant !== courante)
  const temps = annonce?.annonce.temps_s

  return <div className="defile min-h-0 flex-1 space-y-[14px] overflow-y-auto p-[30px]">
    <AvisBrouillon brouillon={brouillon} />
    <section aria-label="La demande" className="grid max-w-[880px] gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Famille">
        {(Object.keys(FAMILLES) as FamilleEcran[]).map((id) => <button key={id} type="button" className={PUCE} aria-pressed={d.famille === id} disabled={FAMILLES[id].aVenir}
          onClick={() => { changer({ famille: id, manuel: null }); setPanneau(null) }}>{FAMILLES[id].nom}{FAMILLES[id].aVenir ? " · à venir" : ""}</button>)}
      </div>

      {d.famille === "interface" ? <SonRetro projet={projet} onRegler={onSon} /> : <>
        {d.famille === "chanson" && <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Jingle ou chanson">
          {([["jingle", "Jingle"], ["chanson", "Chanson"]] as const).map(([v, nom]) => <button key={v} type="button" className={PUCE} aria-pressed={d.mode === v} onClick={() => changer({ mode: v, manuel: null })}>{nom}</button>)}
        </div>}
        <textarea aria-label="Ce qu’on doit entendre" rows={2} className="min-h-[54px] w-full resize-y rounded-7 border border-contour bg-carte p-[14px] text-[15px] leading-[1.55] text-encre placeholder:text-eteint"
          placeholder={d.famille === "chanson" && d.mode === "chanson" ? EXEMPLE_CHANSON : F.exemple} value={texteDe(d)}
          onChange={(e) => changer({ textes: { ...d.textes, [d.famille]: e.target.value } })} />
        {d.famille === "chanson" && d.mode === "chanson" && <textarea aria-label="Paroles" className="min-h-[128px] w-full rounded-7 border border-contour bg-carte p-[14px] text-[13px] leading-[1.55]" value={d.paroles} onChange={(e) => changer({ paroles: e.target.value })} />}
        {d.manuel === null && compo?.langue?.non_anglais && <p className={ATTENTION}>Le moteur comprend l’anglais. Ce texte part tel quel, sans traduction.</p>}
        {compo?.avertissement && <p className={ATTENTION}>{compo.avertissement}</p>}
        {d.famille === "musique" && <div className="flex flex-wrap items-end gap-[14px] text-[12px] text-encre-3">
          <label className="grid gap-[4px]">Tempo<span className="flex items-center gap-[4px] text-encre-controle"><input aria-label="Tempo" type="number" min={40} max={200} className={`${PETIT_CHAMP} w-[70px]`} placeholder={String(tempoUnivers ?? 90)} value={d.musique.tempo ?? ""} onChange={(e) => changer({ musique: { ...d.musique, tempo: e.target.value ? Number(e.target.value) : null } })} /> BPM</span></label>
          <label className="grid gap-[4px]">Tonalité<select aria-label="Tonalité" className={PETIT_CHAMP} value={d.musique.tonalite} onChange={(e) => changer({ musique: { ...d.musique, tonalite: e.target.value } })}>
            <option value="">{tonUnivers ? `celle de l’univers (${tonaliteFr(tonUnivers)})` : "celle de l’univers"}</option>
            {TONALITES.map(([en, fr]) => <option key={en} value={en}>{fr}</option>)}
          </select></label>
          <label className="grid gap-[4px]">Mesure<select aria-label="Mesure" className={PETIT_CHAMP} value={d.musique.mesure} onChange={(e) => changer({ musique: { ...d.musique, mesure: Number(e.target.value) } })}>{MESURES.map(([v, nom]) => <option key={v} value={v}>{nom}</option>)}</select></label>
          <label className="grid gap-[4px]">Mesures<input aria-label="Nombre de mesures" type="number" min={1} max={999} className={`${PETIT_CHAMP} w-[70px]`} value={d.musique.mesures} onChange={(e) => changer({ musique: { ...d.musique, mesures: Math.max(1, Number(e.target.value) || 1) } })} /></label>
          <span className="grid gap-[4px]">Durée de la boucle<strong className="flex min-h-[30px] items-center font-mono text-[13px] font-normal text-encre">{dureeTexte(d.musique.mesures * d.musique.mesure * 60 / tempo)}</strong></span>
        </div>}

        <div className="flex flex-wrap items-center gap-[8px] pt-[4px]">
          <button type="button" className={BASCULE} aria-expanded={panneau === "relire"} onClick={() => setPanneau((p) => p === "relire" ? null : "relire")}>{VERS_LA_RELECTURE}{d.manuel !== null ? " · modifié à la main" : ""} {panneau === "relire" ? "▾" : "▸"}</button>
          <button type="button" className={BASCULE} aria-expanded={panneau === "reglages"} onClick={() => setPanneau((p) => p === "reglages" ? null : "reglages")}>Réglages · <span className="font-mono">{resume}</span> {panneau === "reglages" ? "▾" : "▸"}</button>
          <span className="ml-auto text-[12.5px] text-encre-3">{raison || (relecture ? "" : temps == null && annonce ? "Temps inconnu : le premier tirage le mesurera." : "")}</span>
          <button type="button" className={PRINCIPAL} disabled={!!raison || relecture || occupe || !annonce} onClick={() => void lancer()}>
            Lancer {n} tirages{temps != null && !raison ? ` · ${tempsTexte(temps)}` : ""}
          </button>
        </div>

        {panneau === "relire" && (compo && texte
          ? <Relecture compo={compo} manuel={d.manuel} onManuel={(t) => changer({ manuel: t })} />
          : <div className="rounded-7 bg-papier-cote p-[14px] text-[13px] text-encre-3">{raison || "Lecture du texte…"}</div>)}
        {panneau === "relire" && compo?.erreur && <p role="alert" className="text-[13px] text-echec">{compo.erreur}</p>}
        {panneau === "reglages" && <div className="grid gap-[8px] rounded-7 bg-papier-cote p-[14px] text-[13px]">
          {aDuree(d) && <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Durée"><span className="min-w-[54px] text-[12px] text-encre-3">Durée</span>
            {F.durees!.map((v) => <button key={v} type="button" className={PUCE} aria-pressed={v === dureeDe(d)} onClick={() => changer({ durees: { ...d.durees, [d.famille]: v } })}>{secondesTexte(v)}</button>)}</div>}
          <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label="Tirages"><span className="min-w-[54px] text-[12px] text-encre-3">Tirages</span>
            {F.tirages.map((v) => <button key={v} type="button" className={PUCE} aria-pressed={v === n} onClick={() => changer({ tirages: { ...d.tirages, [d.famille]: v } })}>{v}</button>)}</div>
          <label className="flex flex-wrap items-center gap-[8px] text-[12px]">{CHAMP_DU_MODELE}
            <select aria-label={CHAMP_DU_MODELE} className={PETIT_CHAMP} value={moteurChoisi} onChange={(e) => changer({ moteurs: { ...d.moteurs, [fs]: e.target.value } })}>
              {!moteurChoisi && <option value="">{defauts[fs]?.raison ?? "Aucun moteur installé"}</option>}
              {options.map((o) => <option key={o.valeur} value={o.valeur} disabled={!!o.raison}>Cette machine · {o.nom}{o.raison ? ` — ${o.raison}` : ""}</option>)}
            </select>
          </label>
        </div>}
      </>}
    </section>

    {sonore && erreur && <p role="alert" className="text-echec">{erreur}</p>}
    {sonore && (serieCourante
      ? <SerieSon key={serieCourante.identifiant} projet={projet} identifiant={serieCourante.identifiant} initiale={serieCourante.initiale} titre={`Série ${series.indexOf(serieCourante) + 1}`} onRegler={onSon} />
      : <div className="mt-[22px] rounded-8 border border-dashed border-pointille px-[22px] py-[34px] text-[13px] text-encre-3">Les tirages arrivent ici, à écouter et à garder.</div>)}
    {sonore && precedentes.length > 0 && <details className="mt-[14px] text-[13px]"><summary>Séries précédentes · {precedentes.length}</summary>
      {series.map((s, k) => s.identifiant === courante ? null : <div key={s.identifiant} className="flex items-center justify-between gap-[14px] py-[8px]"><span>Série {k + 1}</span>
        <button type="button" className={PETIT} onClick={() => { setSeries((x) => x.map(({ identifiant }) => ({ identifiant }))); setCourante(s.identifiant) }}>Rouvrir</button></div>)}
    </details>}
  </div>
}

// ── Un son préparé seul, avant les séries ──────────────────────────────────

const ETATS = { prepare: "À relire", en_cours: "Calcul en cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "Acceptation à retrouver", termine: "Son reçu", annule: "Annulée" }

function TravailAudioSeul({ projet, initial, onSon, onFermer, onAutre }: { projet: string; initial: TravailAudio; onSon?: (id: string) => void; onFermer: () => void; onAutre: () => void }) {
  const [t, setT] = useState(initial)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (t.etat !== "en_cours") return
    const minuterie = window.setInterval(() => void travauxAudio.lire(projet, t.identifiant).then(setT).catch((e) => setErreur(message(e))), 2000)
    return () => window.clearInterval(minuterie)
  }, [t.etat, t.identifiant, projet])
  const lancer = async () => {
    setOccupe(true); setErreur("")
    try { setT(await travauxAudio.lancer(t)) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  return <>
    <div className="defile min-h-0 flex-1 space-y-[22px] overflow-y-auto p-[30px]">
      {erreur && <p role="alert" className="text-echec">{erreur}</p>}
      <h2 className="font-serif text-[25px]">{ETATS[t.etat]} · {t.demande.nom || "Bruitages"}</h2>
      <div className="rounded-8 border border-trait bg-carte p-[22px]"><p className="break-all text-[13px]">{t.demande.modele}</p><p className="mt-[8px] text-[13px]">{t.annonce.limite}</p><p className="mt-[8px] text-[13px]">{t.snapshot_audio.secondes} secondes de son · {t.annonce.appels} génération</p>{t.annonce.mesures.length ? t.annonce.mesures.map((m, i) => <p key={i} className="mt-[8px] text-[12px] text-encre-3">{Math.round(m.mediane_s)} s de calcul mesurées · {m.temperature} · {m.mesures} essais</p>) : <p className="mt-[8px] text-[12px] text-encre-3">Temps de calcul encore inconnu pour ce workflow sur cette machine.</p>}</div>
      <section className="rounded-8 border border-trait bg-carte p-[22px]"><h3 className="font-serif text-[25px]">Texte exact et réglages envoyés</h3><p className="mt-[14px] whitespace-pre-wrap text-[14px]">{t.snapshot_audio.prompt}</p>{t.snapshot_audio.prompt_negatif && <p className="mt-[8px] text-[13px]">À éviter : {t.snapshot_audio.prompt_negatif}</p>}<dl className="mt-[14px] space-y-[8px] text-[13px]">{Object.entries(t.snapshot_audio.options).map(([k, v]) => <div key={k} className="flex justify-between"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></section>
      {t.raison && <p role="status" className="text-[13px] text-encre-3">{t.raison}</p>}
      {t.son && onSon && <button className={CHAMP} onClick={() => { onFermer(); onSon(t.son!) }}>Écouter et retoucher le son reçu</button>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte p-[22px]"><p className="text-[12px] text-encre-3">Fermer garde le travail et ses résultats.</p><div className="flex gap-[8px]">
      <button className={CHAMP} onClick={onAutre}>Préparer un autre son</button>
      {["prepare", "a_reprendre", "a_verifier"].includes(t.etat) && !t.son && <button className={CHAMP} disabled={occupe} onClick={() => void lancer()}>{t.etat === "prepare" ? "Lancer ce calcul local" : "Reprendre le suivi sonore"}</button>}
    </div></footer>
  </>
}
