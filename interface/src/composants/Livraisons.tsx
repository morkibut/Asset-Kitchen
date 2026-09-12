import { useEffect, useMemo, useRef, useState } from "react"
import { api, Refus, type ApercuLivraison, type Bande, type LivraisonGodot, type Personnage } from "../api"
import { BandeQuiTourne } from "./Apercu"
import { Sortie } from "./Sortie"
import { ImagesALivrer } from "./ImagesALivrer"

const champ = "rounded-7 border border-contour bg-carte px-[8px] py-[8px] text-[13px] text-encre"
const bouton = "rounded-7 border border-contour px-[14px] py-[8px] text-[13px] text-encre-controle disabled:opacity-50"

/** Le paquet Godot se relit ici ; les exports existants gardent leur accès. */
export function Livraisons({ projet, onFerme, onErreur }: {
  projet: string | null; onFerme: () => void; onErreur?: (refus: Refus) => void
}) {
  const [onglet, setOnglet] = useState<"godot" | "fichiers">("godot")
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center gap-[8px] border-b border-trait px-[30px] py-[8px]" aria-label="Type de livraison">
      <button className={bouton} aria-pressed={onglet === "godot"} onClick={() => setOnglet("godot")}>Livrer dans Godot</button>
      <button className={bouton} aria-pressed={onglet === "fichiers"} onClick={() => setOnglet("fichiers")}>Exporter des fichiers</button>
    </div>
    {onglet === "fichiers" ? <Sortie projet={projet} onFerme={onFerme} onErreur={onErreur} />
      : projet ? <LivraisonDuJeu key={projet} projet={projet} onFerme={onFerme} />
      : <p className="p-[30px]">Ouvre un jeu pour préparer sa livraison.</p>}
  </div>
}

function LivraisonDuJeu({ projet, onFerme }: { projet: string; onFerme: () => void }) {
  const [sujets, setSujets] = useState<Personnage[]>([])
  const [sujetId, setSujetId] = useState("")
  const [choisies, setChoisies] = useState<string[]>([])
  const [nature, setNature] = useState<"animation" | "image">("animation")
  const [boucles, setBoucles] = useState<Record<string, boolean>>({})
  const [dossier, setDossier] = useState("")
  const [sousDossier, setSousDossier] = useState("assets/asset-kitchen")
  const [associe, setAssocie] = useState(false)
  const [pivot, setPivot] = useState({ x: "", y: "" })
  const [apercu, setApercu] = useState<ApercuLivraison | null>(null)
  const [historique, setHistorique] = useState<LivraisonGodot[]>([])
  const [message, setMessage] = useState("")
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [charge, setCharge] = useState(false)
  const requete = useRef(0)
  const sujet = sujets.find(s => s.identifiant === sujetId)
  const bandes = useMemo(() => {
    const uniques = new Map<string, Bande>()
    for (const c of sujet?.cases ?? []) for (const b of c.bandes ?? [])
      if (!b.supprime && b.compte > 0) uniques.set(b.identifiant, b)
    return [...uniques.values()]
  }, [sujet])

  useEffect(() => {
    let actif = true
    Promise.all([api.production(), api.liaisonGodot(projet), api.livraisonsGodot(projet)])
      .then(([production, liaison, livraisons]) => {
        if (!actif) return
        setSujets(production.personnages)
        setSujetId(production.personnages[0]?.identifiant ?? "")
        if (liaison) { setDossier(liaison.dossier); setSousDossier(liaison.sous_dossier); setAssocie(true) }
        setHistorique(livraisons.livraisons)
        setCharge(true)
      }).catch(e => { if (actif) setErreur(e.message) })
    return () => { actif = false; requete.current++ }
  }, [projet])

  function invalider() { requete.current++; setApercu(null); setMessage(""); setErreur("") }
  async function agir(geste: () => Promise<void>) {
    setOccupe(true); setErreur(""); setMessage("")
    try { await geste() } catch (e) { setErreur(e instanceof Error ? e.message : "La livraison n’a pas abouti.") }
    finally { setOccupe(false) }
  }
  async function prevoir() {
    const numero = ++requete.current
    await agir(async () => {
      const lu = await api.prevoirLivraison(projet, {
        personnage: sujetId, bandes: choisies, boucles,
        ...(pivot.x !== "" ? { pivot_x: Number(pivot.x) } : {}),
        ...(pivot.y !== "" ? { pivot_y: Number(pivot.y) } : {}),
      })
      if (numero === requete.current) setApercu(lu)
    })
  }

  return <section className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[30px]" aria-label="Livraison Godot">
    <header className="flex items-start justify-between gap-[14px]">
      <div><h1 className="font-serif text-[38px] text-encre">Livrer au jeu</h1><p className="text-[13px] text-encre-3">Choisis les versions, relis les fichiers, puis retrouve-les dans Godot.</p></div>
      <button className={bouton} onClick={onFerme}>Retour à l’atelier</button>
    </header>
    {erreur && <p role="alert" className="rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur}</p>}
    {message && <p role="status" className="rounded-7 border border-trait-ok bg-fond-ok p-[14px] text-encre-ok">{message}</p>}
    {!charge && !erreur && <p role="status">Lecture du jeu et de ses livraisons…</p>}
    <fieldset disabled={occupe} className="flex flex-col gap-[8px] rounded-10 border border-trait bg-carte p-[14px]">
      <legend className="font-serif text-[25px]">1 · Le projet Godot</legend>
      <label className="flex flex-col gap-[4px] text-[13px]">Dossier contenant project.godot
        <input className={champ} value={dossier} placeholder="C:\Jeux\Mon jeu" onChange={e => { invalider(); setDossier(e.target.value); setAssocie(false) }} />
      </label>
      <label className="flex flex-col gap-[4px] text-[13px]">Sous-dossier des assets
        <input className={champ} value={sousDossier} onChange={e => { invalider(); setSousDossier(e.target.value); setAssocie(false) }} />
      </label>
      <div className="flex items-center gap-[14px]"><button className={bouton} disabled={!dossier.trim() || associe} onClick={() => agir(async () => {
        await api.associerGodot(projet, { dossier, sous_dossier: sousDossier }); setAssocie(true); setMessage("Projet Godot associé. Tu peux préparer la livraison.")
      })}>{associe ? "Projet associé" : "Associer ce projet"}</button><p className="text-[11.5px] text-encre-3">L’association est conservée. Les fichiers sont écrits après relecture.</p></div>
    </fieldset>
    <fieldset disabled={occupe} className="flex flex-col gap-[14px] rounded-10 border border-trait bg-carte p-[14px]">
      <legend className="font-serif text-[25px]">2 · Les versions à livrer</legend>
      <label className="flex items-center gap-[14px] text-[13px]">Asset<select className={champ} value={sujetId} onChange={e => { invalider(); setSujetId(e.target.value); setChoisies([]); setBoucles({}) }}>
        {!sujets.length && <option value="">Aucun asset créé</option>}
        {sujets.map(s => <option key={s.identifiant} value={s.identifiant}>{s.nom}</option>)}
      </select></label>
      <div className="flex gap-[8px]" aria-label="Nature des versions"><button className={bouton} aria-pressed={nature === "animation"} onClick={() => { invalider(); setNature("animation") }}>Animations</button><button className={bouton} aria-pressed={nature === "image"} onClick={() => { invalider(); setNature("image") }}>Images fixes</button></div>
      {nature === "image" ? sujetId && <ImagesALivrer key={sujetId} projet={projet} personnage={sujetId} associe={associe} onApercu={setApercu} onInvalider={invalider} onOccupation={setOccupe} /> : <>
      {!bandes.length && <p className="text-[13px] text-encre-3">Cet asset n’a pas encore d’animation. Crée ou importe un clip, puis garde une bande dans le montage.</p>}
      <div className="flex flex-col gap-[8px]">
        {bandes.map(b => <div key={b.identifiant} className="flex flex-wrap items-center gap-[14px] rounded-7 border border-trait p-[8px]">
          <label className="flex min-w-0 flex-1 items-center gap-[14px]"><input type="checkbox" checked={choisies.includes(b.identifiant)} onChange={e => { invalider(); setChoisies(c => e.target.checked ? [...c, b.identifiant] : c.filter(id => id !== b.identifiant)) }} />
            <BandeQuiTourne bande={b} cote={54} /><span><strong className="block text-[13px]">{b.nom}</strong><span className="text-[11.5px] text-encre-3">{b.pose} · {b.direction || "Sans direction"} · {b.compte} frames · {b.cadence} i/s{b.favori ? " · Retenue" : ""}</span></span>
          </label>
          <label className="flex items-center gap-[8px] text-[11.5px]"><input type="checkbox" checked={boucles[b.identifiant] ?? true} onChange={e => { invalider(); setBoucles(c => ({ ...c, [b.identifiant]: e.target.checked })) }} />Jouer en boucle</label>
        </div>)}
      </div>
      <details><summary className="cursor-pointer text-[13px]">Repère du personnage dans Godot</summary><p className="py-[8px] text-[11.5px] text-encre-3">En pixels de l’image exportée. Vide : le centre du pied. Le même repère s’applique aux animations sélectionnées.</p>
        <div className="flex gap-[14px]">{(["x", "y"] as const).map(axe => <label key={axe} className="text-[13px]">{axe.toUpperCase()} <input type="number" className={`${champ} w-[70px]`} value={pivot[axe]} onChange={e => { invalider(); setPivot(p => ({ ...p, [axe]: e.target.value })) }} /></label>)}</div>
      </details>
      <button className={`${bouton} self-start`} disabled={!associe || !choisies.length} onClick={prevoir}>Relire {choisies.length || "les"} animation{choisies.length !== 1 ? "s" : ""} à livrer</button>
      </>}
    </fieldset>
    {apercu && <section className="flex flex-col gap-[14px] rounded-10 border border-trait bg-carte p-[14px]" aria-label="Fichiers relus">
      <h2 className="font-serif text-[25px]">3 · Ce qui va être écrit</h2>
      <p className="break-all text-[11.5px] text-encre-3">{apercu.dossier}</p>
      {apercu.pivot && <p className="text-[13px]">Repère relu : X {apercu.pivot.x} · Y {apercu.pivot.y} pixels.</p>}
      <p className="text-[11.5px] text-encre-3">La scène de l’asset garde la même adresse dans le jeu. Les anciennes révisions restent conservées.</p>
      {apercu.ressource && <p className="break-all text-[12px] text-encre-3">Texture à utiliser directement : {apercu.ressource}</p>}
      <ul className="flex flex-col gap-[8px]">{apercu.fichiers.map(f => <li key={f.chemin} className="flex items-center justify-between gap-[14px] text-[12px]"><span className="min-w-0 break-all font-mono">{f.chemin}</span><span className="shrink-0 text-encre-3">{({ inchange: "inchangé", nouveau: "nouveau", remplace: "remplacé", conflit: "conflit" } as Record<string, string>)[f.etat] ?? f.etat} · {Math.ceil(f.octets / 1024)} ko</span></li>)}</ul>
      {apercu.conflits.map((c, i) => <p key={i} role="alert" className="text-[13px] text-echec">{c.chemin} — {c.raison}</p>)}
      <button className={`${bouton} self-start bg-signal text-encre-sur-signal`} disabled={occupe || !apercu.pret} onClick={() => agir(async () => {
        const livraison = await api.livrerGodot(projet, apercu.jeton)
        setMessage(`Livraison enregistrée. Ouvre ${livraison.scene || apercu.scene} dans Godot.`)
        setApercu(null)
        setHistorique((await api.livraisonsGodot(projet)).livraisons)
      })}>{occupe ? "Livraison en cours…" : "Livrer ces versions dans Godot"}</button>
    </section>}
    {!!historique.length && <section aria-label="Livraisons conservées"><h2 className="font-serif text-[25px]">Les livraisons conservées</h2>
      <ul className="flex flex-col gap-[8px] pt-[8px]">{historique.map((l, i) => <li key={l.jeton || l.revision || i} className="rounded-7 border border-trait bg-carte p-[14px] text-[13px]">
        <p>{l.nom ? `${l.nom} · ` : ""}{l.nature === "image" ? "Image fixe · " : ""}Révision {l.revision.slice(0, 8)} · {({ preparee: "À relire", en_cours: "En cours", interrompue: "Interrompue", terminee: "Livrée" })[l.etat ?? "preparee"]}</p>
        <p className="break-all text-[11.5px] text-encre-3">Scène à utiliser dans le jeu : {l.scene}</p>
        <button className={`${bouton} mt-[8px]`} disabled={occupe} onClick={() => agir(async () => {
          const lu = l.etat === "terminee" ? await api.reprendreLivraison(projet, l.jeton) : l
          setSujetId(lu.personnage ?? "")
          setNature(lu.nature === "image" ? "image" : "animation")
          setChoisies(lu.animations.map(a => a.bande || a.identifiant || "").filter(Boolean))
          setBoucles(Object.fromEntries(lu.animations.map(a => [a.bande || a.identifiant || "", a.boucle ?? true])))
          if (lu.pivot) setPivot({ x: String(lu.pivot.x), y: String(lu.pivot.y) })
          setApercu(lu)
        })}>{l.etat === "terminee" ? "Reprendre cette révision" : "Reprendre la livraison"}</button>
      </li>)}</ul>
    </section>}
  </section>
}
