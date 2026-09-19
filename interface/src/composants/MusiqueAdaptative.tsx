// SN10 · La musique qui s'adapte : composer une musique adaptative à partir
// de musiques déjà faites (jamais un tirage). Deux formes, qui peuvent
// coexister : des couches qu'on monte ou qu'on baisse (AudioStreamSynchronized),
// des morceaux qui s'enchaînent sur la mesure suivante (AudioStreamInteractive).
import { useEffect, useState } from "react"
import { api } from "../api"
import {
  musiqueAdaptative,
  type Arrivee,
  type Depart,
  type Fondu,
  type MusiqueAdaptative as ObjetMusiqueAdaptative,
} from "../api-musique-adaptative"
import { sons, type Son } from "../api-sons"
import { jeuxDeVariantes } from "../api-series-son"

const CHAMP = "min-h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
const FAMILLES_MUSICALES = new Set(["musique", "jingle", "chanson"])
const erreurDe = (e: unknown) => (e instanceof Error ? e.message : "Le geste n’a pas pu aboutir.")

const DEPARTS: { valeur: Depart; texte: string }[] = [
  { valeur: "immediat", texte: "immédiatement" },
  { valeur: "temps_suivant", texte: "au prochain temps" },
  { valeur: "mesure_suivante", texte: "à la mesure suivante" },
  { valeur: "fin", texte: "à la fin du morceau" },
]
const ARRIVEES: { valeur: Arrivee; texte: string }[] = [
  { valeur: "debut", texte: "reprend au début" },
  { valeur: "meme_position", texte: "reprend à la même position" },
  { valeur: "position_precedente", texte: "reprend où il en était" },
]
const FONDUS: { valeur: Fondu; texte: string }[] = [
  { valeur: "croise", texte: "fondu croisé" },
  { valeur: "entree", texte: "fondu entrant" },
  { valeur: "sortie", texte: "fondu sortant" },
  { valeur: "auto", texte: "fondu automatique" },
  { valeur: "aucun", texte: "aucun fondu" },
]

function nomSon(sonsMusicaux: Son[], identifiant: string): string {
  return sonsMusicaux.find(s => s.identifiant === identifiant)?.nom ?? identifiant
}

/** Une clé de clip lisible et stable, dérivée du nom du son choisi — jamais
 *  un numéro générique : c'est elle que Godot lira (`clip_N/name`). */
function slug(texte: string): string {
  const ascii = texte.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  const corps = ascii.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "")
  return corps.slice(0, 40) || "clip"
}

/** Deux musiques du même nom se distinguent par leur rang et leur durée. */
function nomDistinct(liste: Son[], i: number) {
  const s = liste[i]
  const memes = liste.filter(x => x.nom === s.nom)
  if (memes.length < 2) return s.nom
  const duree = s.mesures?.duree != null ? ` · ${Math.round(s.mesures.duree)} s` : ""
  return `${s.nom} · ${memes.indexOf(s) + 1}${duree}`
}

/** Un choix de son musical prêt (famille musique, jingle ou chanson). Vide
 *  au repos : rien ne part tant qu'on n'a pas choisi. */
function ChoixSon({ sonsMusicaux, valeur, onChoisi }: { sonsMusicaux: Son[]; valeur: string; onChoisi: (id: string) => void }) {
  return <select aria-label="Choisir un son" className={CHAMP} value={valeur} onChange={e => onChoisi(e.target.value)}>
    <option value="">— choisir un son —</option>
    {sonsMusicaux.map((s, i) => <option key={s.identifiant} value={s.identifiant}>{nomDistinct(sonsMusicaux, i)}</option>)}
  </select>
}

function LivraisonMusiqueAdaptative({ projet, identifiant }: { projet: string; identifiant: string }) {
  const [apercu, setApercu] = useState<Awaited<ReturnType<typeof musiqueAdaptative.previsualiserLivraison>> | null>(null)
  const [occupe, setOccupe] = useState(true)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let actif = true
    setApercu(null); setErreur(""); setOccupe(true)
    musiqueAdaptative.previsualiserLivraison(projet, identifiant)
      .then(v => { if (actif) setApercu(v) }).catch(e => { if (actif) setErreur(erreurDe(e)) }).finally(() => { if (actif) setOccupe(false) })
    return () => { actif = false }
  }, [projet, identifiant])
  const publier = async () => {
    if (!apercu) return
    setOccupe(true); setErreur("")
    try { setApercu(await api.livrerGodot(projet, apercu.jeton)) } catch (e) { setErreur(erreurDe(e)) } finally { setOccupe(false) }
  }
  return <div className="mt-[8px] space-y-[8px] rounded-7 border border-trait bg-carte p-[14px] text-[13px]">
    {occupe && !apercu && <p className="text-encre-3">Lecture de l’aperçu…</p>}
    {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    {apercu && <>
      <ul className="flex flex-wrap gap-[8px] font-mono text-[12px]">
        {apercu.fichiers.filter(f => /\.(ogg|tres)$/.test(f.chemin)).map(f => <li key={f.chemin} className="rounded-7 border border-trait px-[8px] py-[4px]">{f.chemin.split("/").at(-1)}</li>)}
      </ul>
      <p className="text-encre-3">Rien n’est écrit dans le jeu tant que vous n’avez pas livré.</p>
      <button type="button" className={`${BOUTON} border-signal bg-signal text-encre-sur-signal`}
        disabled={occupe || !apercu.pret} onClick={() => void publier()}>
        {"etat" in apercu && apercu.etat === "terminee" ? "Livraison terminée" : "Livrer cette version"}
      </button>
    </>}
  </div>
}

function EditeurMusiqueAdaptative({ projet, objet, sonsMusicaux, onChange, onSupprime }: {
  projet: string; objet: ObjetMusiqueAdaptative; sonsMusicaux: Son[]
  onChange: (o: ObjetMusiqueAdaptative) => void; onSupprime: () => void
}) {
  const [erreur, setErreur] = useState("")
  const [nouvelleCouche, setNouvelleCouche] = useState("")
  const [nouveauMorceau, setNouveauMorceau] = useState("")
  const [livrer, setLivrer] = useState(false)
  const cleLibre = (existantes: { cle: string }[], base: string) => {
    let candidate = base, n = 2
    while (existantes.some(e => e.cle === candidate)) { candidate = `${base}_${n}`; n += 1 }
    return candidate
  }
  const appliquer = async (patch: Parameters<typeof musiqueAdaptative.modifier>[2]) => {
    setErreur("")
    try { onChange(await musiqueAdaptative.modifier(projet, objet.identifiant, patch)) } catch (e) { setErreur(erreurDe(e)) }
  }
  const ajouterCouche = () => {
    if (!nouvelleCouche) return
    const cle = cleLibre(objet.couches, slug(nomSon(sonsMusicaux, nouvelleCouche)))
    void appliquer({ couches: [...objet.couches.map(c => ({ cle: c.cle, son: c.son, volume_db: c.volume_db })), { cle, son: nouvelleCouche, volume_db: objet.couches.length === 0 ? 0 : -80 }] })
    setNouvelleCouche("")
  }
  const retirerCouche = (cle: string) => void appliquer({ couches: objet.couches.filter(c => c.cle !== cle).map(c => ({ cle: c.cle, son: c.son, volume_db: c.volume_db })) })
  const changerVolume = (cle: string, volume_db: number) => void appliquer({ couches: objet.couches.map(c => c.cle === cle ? { cle: c.cle, son: c.son, volume_db } : { cle: c.cle, son: c.son, volume_db: c.volume_db }) })
  const ajouterMorceau = () => {
    if (!nouveauMorceau) return
    const cle = cleLibre(objet.morceaux, slug(nomSon(sonsMusicaux, nouveauMorceau)))
    void appliquer({ morceaux: [...objet.morceaux.map(m => ({ cle: m.cle, son: m.son, nom: m.nom ?? undefined })), { cle, son: nouveauMorceau }] })
    setNouveauMorceau("")
  }
  const retirerMorceau = (cle: string) => void appliquer({
    morceaux: objet.morceaux.filter(m => m.cle !== cle).map(m => ({ cle: m.cle, son: m.son, nom: m.nom ?? undefined })),
    transitions: objet.transitions.filter(t => t.de !== cle && t.vers !== cle),
  })
  const clesMorceaux = objet.morceaux.map(m => m.cle)
  const ajouterTransition = () => {
    if (clesMorceaux.length < 2) return
    const de = clesMorceaux[0], vers = clesMorceaux[1]
    if (objet.transitions.some(t => t.de === de && t.vers === vers)) return
    void appliquer({ transitions: [...objet.transitions, { de, vers }] })
  }
  const retirerTransition = (i: number) => void appliquer({ transitions: objet.transitions.filter((_, j) => j !== i) })
  const changerTransition = (i: number, champ: "depart" | "arrivee" | "fondu", valeur: string) =>
    void appliquer({ transitions: objet.transitions.map((t, j) => j === i ? { ...t, [champ]: valeur } : t) })
  /** Le nom lisible d'un morceau visé par une transition — jamais sa clé
   *  machine, et « n'importe quel morceau » pour le « * » que pose un agent. */
  const nomDuMorceau = (cle: string): string => {
    if (cle === "*") return "n’importe quel morceau"
    const m = objet.morceaux.find(x => x.cle === cle)
    return m ? (m.nom ?? nomSon(sonsMusicaux, m.son)) : cle
  }

  return <div className="space-y-[14px] rounded-8 border border-trait bg-carte p-[14px]">
    <div className="flex items-center justify-between gap-[8px]">
      <strong className="text-[14px]">{objet.nom}</strong>
      <button type="button" className={PETIT} onClick={onSupprime}>Défaire</button>
    </div>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {objet.ecarts.map(e => <p key={e} className="rounded-5 border border-trait-attention bg-fond-attention px-[8px] py-[4px] text-[12px] text-encre-attention">{e}</p>)}

    <section aria-label="Couches" className="space-y-[8px]">
      <h3 className="text-[13px] font-medium">Couches (jouées ensemble, montées ou baissées)</h3>
      <ul className="space-y-[8px]">{objet.couches.map(c => <li key={c.cle} className="flex flex-wrap items-center gap-[8px] text-[13px]">
        <span>{c.nom ?? "son supprimé"}</span>
        <label className="flex items-center gap-[4px] text-[12px] text-encre-3">Volume
          <input aria-label={`Volume de la couche ${c.cle}`} type="number" min={-80} max={6} step={1} value={c.volume_db}
            className={`${CHAMP} w-[70px]`} onChange={e => changerVolume(c.cle, Number(e.target.value))} /> dB
        </label>
        {c.signal && <span className="text-[12px] text-encre-attention">{c.signal}</span>}
        <button type="button" className={`${PETIT} ml-auto`} onClick={() => retirerCouche(c.cle)}>Retirer</button>
      </li>)}</ul>
      <div className="flex flex-wrap items-center gap-[8px]">
        <ChoixSon sonsMusicaux={sonsMusicaux} valeur={nouvelleCouche} onChoisi={setNouvelleCouche} />
        <button type="button" className={PETIT} disabled={!nouvelleCouche} onClick={ajouterCouche}>Ajouter une couche</button>
      </div>
    </section>

    <section aria-label="Morceaux" className="space-y-[8px]">
      <h3 className="text-[13px] font-medium">Morceaux (s’enchaînent d’un état à l’autre)</h3>
      <ul className="space-y-[8px]">{objet.morceaux.map(m => <li key={m.cle} className="flex flex-wrap items-center gap-[8px] text-[13px]">
        <span>{m.nom ?? nomSon(sonsMusicaux, m.son)}</span>
        {m.signal && <span className="text-[12px] text-encre-attention">{m.signal}</span>}
        <button type="button" className={`${PETIT} ml-auto`} onClick={() => retirerMorceau(m.cle)}>Retirer</button>
      </li>)}</ul>
      <div className="flex flex-wrap items-center gap-[8px]">
        <ChoixSon sonsMusicaux={sonsMusicaux} valeur={nouveauMorceau} onChoisi={setNouveauMorceau} />
        <button type="button" className={PETIT} disabled={!nouveauMorceau} onClick={ajouterMorceau}>Ajouter un morceau</button>
      </div>
    </section>

    {objet.morceaux.length >= 2 && <section aria-label="Transitions" className="space-y-[8px]">
      <h3 className="text-[13px] font-medium">Transitions</h3>
      <ul className="space-y-[8px]">{objet.transitions.map((t, i) => <li key={`${t.de}-${t.vers}-${i}`} className="flex flex-wrap items-center gap-[8px] text-[13px]">
        <span>{nomDuMorceau(t.de)} → {nomDuMorceau(t.vers)}</span>
        <select aria-label={`Départ de la transition ${nomDuMorceau(t.de)} vers ${nomDuMorceau(t.vers)}`} className={CHAMP} value={t.depart} onChange={e => changerTransition(i, "depart", e.target.value)}>
          {DEPARTS.map(d => <option key={d.valeur} value={d.valeur}>{d.texte}</option>)}
        </select>
        <select aria-label={`Arrivée de la transition ${nomDuMorceau(t.de)} vers ${nomDuMorceau(t.vers)}`} className={CHAMP} value={t.arrivee} onChange={e => changerTransition(i, "arrivee", e.target.value)}>
          {ARRIVEES.map(a => <option key={a.valeur} value={a.valeur}>{a.texte}</option>)}
        </select>
        <select aria-label={`Fondu de la transition ${nomDuMorceau(t.de)} vers ${nomDuMorceau(t.vers)}`} className={CHAMP} value={t.fondu} onChange={e => changerTransition(i, "fondu", e.target.value)}>
          {FONDUS.map(f => <option key={f.valeur} value={f.valeur}>{f.texte}</option>)}
        </select>
        <button type="button" className={`${PETIT} ml-auto`} onClick={() => retirerTransition(i)}>Retirer</button>
      </li>)}</ul>
      <button type="button" className={PETIT} onClick={ajouterTransition}>Ajouter une transition</button>
    </section>}

    <button type="button" className={`${PETIT} block`} aria-expanded={livrer} onClick={() => setLivrer(v => !v)}>Voir ce qui part au jeu</button>
    {livrer && objet.livrable && <LivraisonMusiqueAdaptative projet={projet} identifiant={objet.identifiant} />}
    {livrer && !objet.livrable && <p className="text-[13px] text-encre-3">Rien n’est encore livrable : ajoutez une couche ou un morceau prêt.</p>}
  </div>
}

/** L'écran de composition (SN10) : compose une musique adaptative à partir
 *  de musiques déjà faites, jamais un tirage. Deux gestes qui n'empêchent
 *  rien : les couches et les morceaux se composent l'un sans l'autre. */
export function MusiqueAdaptative({ projet }: { projet: string }) {
  const [sonsMusicaux, setSonsMusicaux] = useState<Son[]>([])
  const [objets, setObjets] = useState<ObjetMusiqueAdaptative[]>([])
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [nom, setNom] = useState("")
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    let actif = true
    setChargement(true)
    Promise.all([sons.lister(projet), musiqueAdaptative.lister(projet), jeuxDeVariantes.lister(projet).catch(() => [])])
      .then(([s, o, jeux]) => { if (!actif) return
        // Seules les musiques gardées : un tirage de série que personne n'a
        // gardé n'est pas proposé, comme dans « Livrer au jeu ».
        const gardes = new Set(jeux.flatMap(j => j.sons))
        setSonsMusicaux(s.filter(x => x.famille && FAMILLES_MUSICALES.has(x.famille) && x.pret && (!x.provenance?.serie || gardes.has(x.identifiant))))
        setObjets(o)
      })
      .catch(e => { if (actif) setErreur(erreurDe(e)) })
      .finally(() => { if (actif) setChargement(false) })
    return () => { actif = false }
  }, [projet])

  const objetOuvert = objets.find(o => o.identifiant === ouvert) ?? null

  const creer = async () => {
    if (!nom.trim() || sonsMusicaux.length === 0) return
    setErreur("")
    try {
      const premier = sonsMusicaux[0]
      const cree = await musiqueAdaptative.creer(projet, { nom: nom.trim(), morceaux: [{ cle: slug(premier.nom), son: premier.identifiant }] })
      setObjets(v => [cree, ...v]); setOuvert(cree.identifiant); setNom("")
    } catch (e) { setErreur(erreurDe(e)) }
  }
  const supprimer = async (identifiant: string) => {
    setErreur("")
    try { await musiqueAdaptative.supprimer(projet, identifiant); setObjets(v => v.filter(o => o.identifiant !== identifiant)); if (ouvert === identifiant) setOuvert(null) }
    catch (e) { setErreur(erreurDe(e)) }
  }

  return <section aria-label="Musique adaptative" className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
    <h2 className="font-serif text-[25px]">Musique adaptative</h2>
    <p className="text-[13px] text-encre-3">
      Compose une musique qui change avec le jeu, à partir de musiques déjà faites : des couches qu’on monte ou
      qu’on baisse, ou des morceaux qui s’enchaînent — sur la mesure suivante par défaut, sans coupure.
    </p>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {chargement && <p className="text-[13px] text-encre-3">Chargement…</p>}
    {!chargement && sonsMusicaux.length === 0 &&
      <p className="text-[13px] text-encre-attention">Aucune musique prête (famille musique, jingle ou chanson) : fabriquez-en une avant de composer.</p>}

    {!chargement && <>
      <ul className="space-y-[8px]">{objets.map(o => <li key={o.identifiant}>
        <button type="button" className={`${BOUTON} w-full justify-start text-left`} aria-expanded={ouvert === o.identifiant} onClick={() => setOuvert(ouvert === o.identifiant ? null : o.identifiant)}>
          {o.nom} · {o.couches.length} couche{o.couches.length > 1 ? "s" : ""}, {o.morceaux.length} morceau{o.morceaux.length > 1 ? "x" : ""}
        </button>
      </li>)}</ul>
      {sonsMusicaux.length > 0 && <div className="flex flex-wrap items-center gap-[8px]">
        <input aria-label="Nom de la nouvelle musique adaptative" className={CHAMP} value={nom} placeholder="Nom de la musique adaptative"
          onChange={e => setNom(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void creer() }} />
        <button type="button" className={BOUTON} disabled={!nom.trim()} onClick={() => void creer()}>Composer une musique adaptative</button>
      </div>}
    </>}
    {objetOuvert && <EditeurMusiqueAdaptative projet={projet} objet={objetOuvert} sonsMusicaux={sonsMusicaux}
      onChange={o => setObjets(v => v.map(x => x.identifiant === o.identifiant ? o : x))}
      onSupprime={() => void supprimer(objetOuvert.identifiant)} />}
  </section>
}
