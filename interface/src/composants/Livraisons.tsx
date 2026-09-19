import { useEffect, useMemo, useRef, useState } from "react"
import { api, Refus, type ApercuLivraison, type Bande, type DecisionSurConflit, type LivraisonGodot, type Personnage } from "../api"
import { BandeQuiTourne } from "./Apercu"
import { Sortie } from "./Sortie"
import { ImagesALivrer } from "./ImagesALivrer"
import { SonsALivrer, SonsDuSujetALivrer } from "./SonsALivrer"

const champ = "rounded-7 border border-contour bg-carte px-[8px] py-[8px] text-[13px] text-encre"
const bouton = "rounded-7 border border-contour px-[14px] py-[8px] text-[13px] text-encre-controle disabled:opacity-50"

/** Les trois décisions de `RP10`, et ce que chacune fait — **dit avant d'être
 *  prise**, pas après : un conflit se décide une fois, et le fichier du jeu ne
 *  revient pas. Les mots sont ceux de la maquette. */
const DECISIONS: { cle: DecisionSurConflit; nom: string; fait: string }[] = [
  { cle: "conserver", nom: "Conserver", fait: "Le fichier du jeu reste. L’atelier n’écrit rien ici." },
  { cle: "copier", nom: "Copier à côté", fait: "L’atelier écrit le sien sous le même nom suivi de .copie-atelier. Le fichier du jeu ne bouge pas." },
  { cle: "remplacer", nom: "Remplacer", fait: "L’atelier écrit par-dessus. Ce que contient le fichier du jeu est perdu." },
]

/** Ce que la ligne du fichier dit de sa décision, dans la liste de ce qui va être écrit. */
function decide(decision: DecisionSurConflit | null | undefined) {
  const mots: Record<DecisionSurConflit, string> = { conserver: "conservé", copier: "copié à côté", remplacer: "remplacé" }
  return decision ? mots[decision] : "à décider"
}

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
  const [nature, setNature] = useState<"animation" | "image" | "son">("animation")
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
  // Un brouillon ne vise aucune case : son nom dans le jeu serait son
  // identifiant, et il changerait le jour où on le range. Il est mis de côté
  // ici et refusé par le serveur — le même garde-fou que les tuiles et les sons.
  const [bandes, brouillons] = useMemo(() => {
    const uniques = new Map<string, Bande>()
    const sansCase = new Map<string, Bande>()
    for (const c of sujet?.cases ?? []) for (const b of c.bandes ?? [])
      if (!b.supprime && b.compte > 0) (b.brouillon ? sansCase : uniques).set(b.identifiant, b)
    return [[...uniques.values()], [...sansCase.values()]] as const
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

  // Ce qui reste à décider : `pret` est désormais « chacun a sa décision »,
  // plus « aucun conflit » (`RP10`).
  const aDecider = apercu?.conflits.filter(c => !c.decision).length ?? 0

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
      <button className={bouton} onClick={onFerme}>‹ Livrer au jeu</button>
    </header>
    {erreur && <p role="alert" className="rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur}</p>}
    {message && <p role="status" className="rounded-7 border border-trait-ok bg-fond-ok p-[14px] text-encre-ok">{message}</p>}
    {!charge && !erreur && <p role="status">Lecture du jeu et de ses livraisons…</p>}
    <fieldset disabled={occupe} className="flex flex-col gap-[8px] rounded-10 border border-trait bg-carte p-[14px]">
      <legend className="font-serif text-[25px]">1 · Le jeu Godot</legend>
      <label className="flex flex-col gap-[4px] text-[13px]">Dossier contenant project.godot
        <input className={champ} value={dossier} placeholder="C:\Jeux\Mon jeu" onChange={e => { invalider(); setDossier(e.target.value); setAssocie(false) }} />
      </label>
      <label className="flex flex-col gap-[4px] text-[13px]">Sous-dossier des images
        <input className={champ} value={sousDossier} onChange={e => { invalider(); setSousDossier(e.target.value); setAssocie(false) }} />
      </label>
      <div className="flex items-center gap-[14px]"><button className={bouton} disabled={!dossier.trim() || associe} onClick={() => agir(async () => {
        await api.associerGodot(projet, { dossier, sous_dossier: sousDossier }); setAssocie(true); setMessage("Jeu Godot associé. Tu peux préparer la livraison.")
      })}>{associe ? "Jeu associé" : "Associer ce jeu"}</button><p className="text-[11.5px] text-encre-3">L’association est conservée. Les fichiers sont écrits après relecture.</p></div>
    </fieldset>
    <fieldset disabled={occupe} className="flex flex-col gap-[14px] rounded-10 border border-trait bg-carte p-[14px]">
      <legend className="font-serif text-[25px]">2 · Les versions à livrer</legend>
      <label className="flex items-center gap-[14px] text-[13px]">Sujet<select className={champ} value={sujetId} onChange={e => { invalider(); setSujetId(e.target.value); setChoisies([]); setBoucles({}) }}>
        {!sujets.length && <option value="">Aucun sujet créé</option>}
        {sujets.map(s => <option key={s.identifiant} value={s.identifiant}>{s.nom}</option>)}
      </select></label>
      <div className="flex gap-[8px]" aria-label="Nature des versions"><button className={bouton} aria-pressed={nature === "animation"} onClick={() => { invalider(); setNature("animation") }}>Animations</button><button className={bouton} aria-pressed={nature === "image"} onClick={() => { invalider(); setNature("image") }}>Images fixes</button><button className={bouton} aria-pressed={nature === "son"} onClick={() => { invalider(); setNature("son") }}>Sons</button></div>
      {nature === "son" ? <SonsALivrer projet={projet} /> : nature === "image" ? sujetId && <ImagesALivrer key={sujetId} projet={projet} personnage={sujetId} associe={associe} onApercu={setApercu} onInvalider={invalider} onOccupation={setOccupe} /> : <>
      {sujetId && <SonsDuSujetALivrer projet={projet} sujet={sujetId} />}
      {!bandes.length && <p className="text-[13px] text-encre-3">Ce sujet n’a pas encore d’animation. Crée ou importe un clip, puis garde une bande dans le montage.</p>}
      {!!brouillons.length && <p role="status" className="rounded-7 border border-trait bg-papier-cote p-[8px] text-[11.5px] text-encre-3">
        {brouillons.length} brouillon{brouillons.length > 1 ? "s" : ""} mis de côté : {brouillons.map(b => b.nom).join(", ")}. Donne-leur leur mouvement et leur direction pour pouvoir les livrer — sans case visée, leur nom dans le jeu changerait le jour où on les range.
      </p>}
      {bandes.length > 1 && <div className="flex flex-wrap items-center gap-[8px]">
        <button className={bouton} disabled={choisies.length === bandes.length} onClick={() => { invalider(); setChoisies(bandes.map(b => b.identifiant)) }}>Tout sélectionner</button>
        <button className={bouton} disabled={!choisies.length} onClick={() => { invalider(); setChoisies([]) }}>Tout décocher</button>
        <span className="text-[11.5px] text-encre-3">{choisies.length} sur {bandes.length}</span>
      </div>}
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
      <p className="text-[11.5px] text-encre-3">La scène du sujet garde la même adresse dans le jeu. Les anciennes révisions restent conservées.</p>
      {apercu.ressource && <p className="break-all text-[12px] text-encre-3">Texture à utiliser directement : {apercu.ressource}</p>}
      <ul className="flex flex-col gap-[8px]">{apercu.fichiers.map(f => <li key={f.chemin} className="flex items-center justify-between gap-[14px] text-[12px]"><span className="min-w-0 break-all font-mono">{f.chemin}</span><span className="shrink-0 text-encre-3">{({ inchange: "inchangé", nouveau: "nouveau", remplace: "remplacé", conflit: "conflit" } as Record<string, string>)[f.etat] ?? f.etat}{f.etat === "conflit" && ` · ${decide(apercu.conflits.find(c => c.chemin === f.chemin)?.decision)}`} · {Math.ceil(f.octets / 1024)} ko</span></li>)}</ul>
      {!!apercu.conflits.length && <div className="flex flex-col gap-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px]" aria-label="Conflits à décider">
        <p role="alert" className="text-[13px] text-echec">{aDecider ? `${aDecider} fichier${aDecider > 1 ? "s" : ""} à décider avant de livrer.` : "Chaque conflit a sa décision. La livraison peut partir."} Le jeu contient déjà {apercu.conflits.length === 1 ? "ce fichier" : "ces fichiers"}, et l’atelier ne {apercu.conflits.length === 1 ? "l’a" : "les a"} pas écrit{apercu.conflits.length > 1 ? "s" : ""}.</p>
        {apercu.conflits.map(c => <div key={c.chemin} className="flex flex-col gap-[8px] border-t border-trait pt-[14px] first:border-0 first:pt-0">
          <p className="min-w-0 break-all font-mono text-[12px]">{c.chemin}</p>
          <p className="text-[11.5px] text-encre-3">{c.raison}</p>
          <ul className="flex flex-col gap-[4px]" aria-label={`Décider de ${c.chemin}`}>{DECISIONS.map(d => <li key={d.cle} className="flex flex-wrap items-center gap-[8px]">
            <button className={`${bouton} ${c.decision === d.cle ? "border-encre-4 font-medium text-encre" : ""}`} aria-pressed={c.decision === d.cle} disabled={occupe} onClick={() => agir(async () => {
              setApercu(await api.deciderConflit(projet, apercu.jeton, c.chemin, d.cle))
            })}>{d.nom}</button>
            <span className="min-w-0 flex-1 text-[11.5px] text-encre-3">{d.fait}</span>
          </li>)}</ul>
          {c.voisin && <p className="break-all text-[11.5px] text-encre-3">La copie s’écrira dans {c.voisin}.</p>}
        </div>)}
      </div>}
      <button className={`${bouton} self-start bg-signal text-encre-sur-signal`} disabled={occupe || !apercu.pret} onClick={() => agir(async () => {
        const livraison = await api.livrerGodot(projet, apercu.jeton)
        setMessage(`Livraison enregistrée. Ouvre ${livraison.scene || apercu.scene} dans Godot.`)
        setApercu(null)
        setHistorique((await api.livraisonsGodot(projet)).livraisons)
      })}>{occupe ? "Livraison en cours…" : "Livrer ces versions dans Godot"}</button>
    </section>}
    {!!historique.length && <section aria-label="Historique"><h2 className="font-serif text-[25px]">Historique</h2>
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
        })}>Relire cette livraison</button>
      </li>)}</ul>
    </section>}
  </section>
}
