import { useEffect, useState } from "react"
import { api, Refus } from "../api"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { workflows, type DemandeImageLocale, type ProfilWorkflow, type TravailImageLocale, type DiagnosticWorkflow } from "../api-workflows"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { Libelle } from "./pieces"

const CHAMP = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle"
const BOUTON = `${CHAMP} hover:border-encre-3 disabled:opacity-50`
const SURFACE = "rounded-8 border border-trait bg-carte p-[22px]"
const ETATS: Record<TravailImageLocale["etat"], string> = { prepare: "Prête à lancer", en_cours: "En cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "Acceptation à vérifier", termine: "Terminée", annule: "Annulée" }
const message = (e: unknown) => e instanceof Refus || e instanceof Error ? e.message : "L’opération n’a pas abouti. Réessayez."

export function ProfilsWorkflow({ onImage, onVideo, onAudio }: { onImage?: (modele: string) => void; onVideo?: (modele: string) => void; onAudio?: (modele: string) => void }) {
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [erreur, setErreur] = useState("")
  const [chargement, setChargement] = useState(true)
  const [occuppe, setOccupe] = useState(false)
  const [editeur, setEditeur] = useState(false)
  const [contenu, setContenu] = useState("")
  const [diagnostics, setDiagnostics] = useState<Record<string, DiagnosticWorkflow>>({})
  const [confirmation, setConfirmation] = useState("")
  async function relire() { setChargement(true); try { setProfils((await workflows.lister()).profils) } catch (e) { setErreur(message(e)) } finally { setChargement(false) } }
  useEffect(() => { void relire() }, [])
  async function garder(brut: unknown) {
    setOccupe(true); setErreur(""); setConfirmation("")
    try {
      const p = await workflows.importer(brut)
      await relire(); setEditeur(false); setContenu("")
      setConfirmation(`« ${p.nom} » enregistré. Vérifiez ses prérequis avant de le choisir.`)
    } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  async function verifier(p: ProfilWorkflow) {
    setOccupe(true); setErreur("")
    try { const d = await workflows.diagnostiquer(p.identifiant, p.version); setDiagnostics(v => ({ ...v, [p.modele]: d })) }
    catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  return <section aria-label="Workflows locaux" className="space-y-[22px] text-encre">
    <header><h2 className="font-serif text-[38px]">Les workflows locaux</h2><p className="mt-[8px] text-[13px] text-encre-3">Nommez une méthode une fois, puis utilisez ses réglages dans vos fabrications. ComfyUI reste installé et lancé séparément.</p></header>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}{confirmation && <p role="status" className="text-[13px] text-ok">{confirmation}</p>}
    <div className="flex flex-wrap gap-[8px]"><button className={BOUTON} onClick={() => setEditeur(v => !v)}>Ajouter un workflow</button><button className={BOUTON} onClick={() => void relire()} disabled={chargement}>Actualiser les profils</button></div>
    {editeur && <div className={`${SURFACE} space-y-[14px]`}><h3 className="font-serif text-[25px]">Importer et nommer une méthode</h3><p className="text-[13px] text-encre-3">Un profil existant contient déjà ses réglages. Pour un graphe ComfyUI seul, exportez son format API et reliez ses entrées ci-dessous.</p>
      <label className="block text-[13px]">Fichier JSON du profil ou du graphe<input type="file" accept=".json,application/json" disabled={occuppe} className="mt-[8px] block" onChange={e => { const f = e.target.files?.[0]; if (f) void f.text().then(setContenu).catch(er => setErreur(message(er))) }} /></label>
      <details><summary className="text-[13px]">Coller ou modifier le document JSON</summary><textarea aria-label="Document du workflow" className={`${CHAMP} mt-[8px] min-h-[128px] w-full font-mono`} value={contenu} onChange={e => setContenu(e.target.value)} /></details>
      {contenu && <ConfigurerGraphe contenu={contenu} occupe={occuppe} garder={garder} />}
    </div>}
    <p className="text-[12px] text-encre-3"><Libelle aide="workflow.version">Chaque version reste conservée</Libelle> · L’import et la vérification ne lancent pas de calcul et n’installent rien.</p>
    {chargement ? <p role="status">Lecture des profils…</p> : profils.length === 0 ? <p className={SURFACE}>Aucun workflow importé. Les moteurs déjà disponibles restent accessibles dans les fabrications.</p> : <div className="grid grid-cols-2 gap-[14px]">{profils.map(p => {
      const d = diagnostics[p.modele] || p.diagnostic
      return <article key={p.modele} className={`${SURFACE} space-y-[14px]`}><div><h3 className="font-serif text-[25px]">{p.nom}</h3><p className="text-[12px] text-encre-3">{p.nature === "image" ? "Image" : p.nature === "audio" ? "Son" : "Vidéo"} · {p.references_min} référence{p.references_min > 1 ? "s" : ""} obligatoire{p.references_min > 1 ? "s" : ""} · version du {new Date(p.cree_le * 1000).toLocaleString("fr-FR")}</p></div>
        {p.description && <p className="text-[13px]">{p.description}</p>}<p className="text-[12px] text-encre-3">{p.formats.map(f => `${f.largeur} × ${f.hauteur}`).join(" · ")}{p.nature === "video" ? ` · ${p.durees.join(" / ")} s · ${p.cadence} images/s` : p.nature === "audio" ? `${p.durees.join(" / ")} s de son` : ""}</p>
        {d ? <div className="text-[13px]"><p className={d.disponible ? "text-ok" : "text-echec"}>{d.disponible ? "Prérequis présents" : "Prérequis à compléter"}</p>{d.problemes.map(r => <p key={r} className="mt-[4px] text-encre-3">{r}</p>)}<p className="mt-[4px] text-[12px] text-encre-3">{d.limite}</p></div> : <p className="text-[13px] text-encre-3">Installation à vérifier.</p>}
        <div className="flex flex-wrap gap-[8px]"><button className={BOUTON} disabled={occuppe} onClick={() => void verifier(p)}>Vérifier les prérequis</button>{(p.nature === "image" ? onImage : p.nature === "audio" ? onAudio : onVideo) && <button className={BOUTON} disabled={!d?.disponible} onClick={() => p.nature === "image" ? onImage?.(p.modele) : p.nature === "audio" ? onAudio?.(p.modele) : onVideo?.(p.modele)}>Utiliser ce workflow</button>}<button className={BOUTON} onClick={() => { setContenu(JSON.stringify(p, null, 2)); setEditeur(true) }}>Préparer une nouvelle version</button></div>
      </article>
    })}</div>}
  </section>
}

function ConfigurerGraphe({ contenu, garder, occupe }: { contenu: string; garder: (profil: unknown) => Promise<void>; occupe: boolean }) {
  const [nom, setNom] = useState("")
  const [nature, setNature] = useState<"image" | "video" | "audio">("image")
  const [prompt, setPrompt] = useState("")
  const [reference, setReference] = useState("")
  const [sortie, setSortie] = useState("")
  const [largeur, setLargeur] = useState(512)
  const [hauteur, setHauteur] = useState(512)
  const [secondes, setSecondes] = useState(5)
  const [cadence, setCadence] = useState(8)
  let lu: Record<string, unknown>
  try { lu = JSON.parse(contenu) as Record<string, unknown> } catch { return <p role="alert" className="text-[13px] text-echec">Ce document n’est pas un JSON valide.</p> }
  if (lu && lu.graphe && lu.liaisons) return <button className={BOUTON} disabled={occupe} onClick={() => void garder(lu)}>Enregistrer cette version de profil</button>
  if (!lu || Array.isArray(lu) || lu.nodes || !Object.values(lu).every(n => typeof n === "object" && n !== null && "class_type" in n && "inputs" in n)) return <p role="alert" className="text-[13px] text-echec">Choisissez l’export « format API » de ComfyUI. Le fichier qui décrit seulement la disposition des nœuds ne suffit pas.</p>
  const graphe = lu as ProfilWorkflow["graphe"]
  const entrees = Object.entries(graphe).flatMap(([id, n]) => Object.entries(n.inputs).filter(([, v]) => !Array.isArray(v)).map(([champ]) => ({ valeur: `${id}/${champ}`, nom: `${n.class_type} · ${id} · ${champ}` })))
  const lien = (v: string) => { const [noeud, champ] = v.split("/"); return [{ noeud, champ }] }
  const choisir = (titre: string, value: string, changer: (v: string) => void) => <label className="flex flex-col gap-[8px] text-[13px]">{titre}<select className={CHAMP} value={value} onChange={e => changer(e.target.value)}><option value="">Choisir le champ</option>{entrees.map(e => <option key={e.valeur} value={e.valeur}>{e.nom}</option>)}</select></label>
  return <fieldset disabled={occupe} className="space-y-[14px]"><div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px] text-[13px]">Nom du workflow<input className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} /></label><label className="flex flex-col gap-[8px] text-[13px]">Ce qu’il produit<select className={CHAMP} value={nature} onChange={e => setNature(e.target.value as "image" | "video" | "audio")}><option value="image">Une image</option><option value="video">Un clip vidéo</option><option value="audio">Un son</option></select></label>{choisir("Champ recevant le prompt", prompt, setPrompt)}{nature !== "audio" && choisir(nature === "video" ? "Champ recevant l’image de départ" : "Champ recevant une référence (facultatif)", reference, setReference)}<label className="flex flex-col gap-[8px] text-[13px]">Nœud qui enregistre le résultat<select className={CHAMP} value={sortie} onChange={e => setSortie(e.target.value)}><option value="">Choisir la sortie</option>{Object.entries(graphe).map(([id, n]) => <option key={id} value={id}>{n.class_type} · {id}</option>)}</select></label>{nature !== "audio" && <div className="grid grid-cols-2 gap-[8px]"><label className="text-[13px]">Largeur fixe<input type="number" min={8} max={8192} className={`${CHAMP} mt-[8px] w-full`} value={largeur} onChange={e => setLargeur(Number(e.target.value))} /></label><label className="text-[13px]">Hauteur fixe<input type="number" min={8} max={8192} className={`${CHAMP} mt-[8px] w-full`} value={hauteur} onChange={e => setHauteur(Number(e.target.value))} /></label></div>}</div>
    {nature !== "image" && <div className="grid grid-cols-2 gap-[14px]"><label className="text-[13px]">Durée du graphe (s)<input type="number" min={nature === "audio" ? 0.1 : 1} max={nature === "audio" ? 600 : 120} step={nature === "audio" ? 0.1 : 1} value={secondes} className={`${CHAMP} ml-[8px]`} onChange={e => setSecondes(Number(e.target.value))} /></label>{nature === "video" && <label className="text-[13px]">Cadence du graphe<input type="number" min={1} max={120} value={cadence} className={`${CHAMP} ml-[8px]`} onChange={e => setCadence(Number(e.target.value))} /></label>}</div>}
    <p className="text-[12px] text-encre-3">Ces dimensions et durées doivent correspondre au graphe importé. Ce premier profil conserve ses autres réglages fixes. Importez un profil complet pour exposer plusieurs formats, références ou paramètres.</p>
    <button className={BOUTON} disabled={!nom.trim() || !prompt || !sortie || (nature === "video" && !reference)} onClick={() => void garder({ nom, nature, graphe, liaisons: { prompt: lien(prompt), ...(nature !== "audio" && reference ? { "reference:0": lien(reference) } : {}) }, parametres: {}, formats: nature === "audio" ? [] : [{ resolution: nature === "video" ? `${hauteur}p` : String(hauteur), proportions: largeur === hauteur ? "1:1" : `${largeur}:${hauteur}`, largeur, hauteur }], durees: nature !== "image" ? [secondes] : [], cadence, sortie: { noeud: sortie, champ: nature === "image" ? "images" : nature === "audio" ? "audio" : "gifs" } })}>Enregistrer le profil</button>
  </fieldset>
}

export function FabricationImageLocale({ projet, identifiantInitial, modeleInitial, personnage, onAsset, onToile, onFermer, autonome = true }: {
  projet: string; identifiantInitial?: string; modeleInitial?: string; personnage?: string
  onAsset?: (id: string) => void; onToile?: (id: string) => void; onFermer?: () => void
  /** **Sa propre fenêtre, ou le corps d'une autre** (RP4). */
  autonome?: boolean
}) {
  const [initiale] = useState<DemandeImageLocale>(() => ({ cle: crypto.randomUUID(), modele: modeleInitial || "", prompt: "", references: [], options: {}, repris: false, personnage }))
  const [demande, setDemande] = useState(initiale)
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [travail, setTravail] = useState<TravailImageLocale | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [bibliotheque, setBibliotheque] = useState(false)
  const [edition, setEdition] = useState(!identifiantInitial)
  const [diagnostic, setDiagnostic] = useState<DiagnosticWorkflow | null>(null)
  const brouillon = useBrouillonLocal({ cle: `image-locale:${projet}:${personnage || "libre"}`, pret: !identifiantInitial, reference: initiale, etat: demande, appliquer: setDemande,
    ecran: "Une image locale", quoi: demande.prompt || "Sans texte" })
  useEffect(() => {
    let vivant = true
    workflows.lister().then(r => { if (vivant) setProfils(r.profils.filter(p => p.nature === "image")) }).catch(e => vivant && setErreur(message(e))).finally(() => vivant && setChargement(false))
    if (identifiantInitial) workflows.lireImage(projet, identifiantInitial).then(t => { if (vivant) { setTravail(t); setDemande(t.demande) } }).catch(e => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, identifiantInitial])
  const profil = profils.find(p => p.modele === demande.modele)
  useEffect(() => {
    if (!profil) return
    setDemande(d => ({ ...d, resolution: d.resolution || profil.formats[0].resolution,
      proportions: d.proportions || profil.formats[0].proportions,
      options: { ...Object.fromEntries(Object.entries(profil.parametres).map(([n, p]) => [n, p.defaut])), ...d.options } }))
  }, [profil?.modele])
  useEffect(() => { let vivant = true; setDiagnostic(null); if (profil) workflows.diagnostiquer(profil.identifiant, profil.version).then(d => vivant && setDiagnostic(d)).catch(e => vivant && setErreur(message(e))); return () => { vivant = false } }, [profil?.modele])
  useEffect(() => {
    if (!travail || travail.etat !== "en_cours") return
    const timer = window.setInterval(() => { void workflows.lireImage(projet, travail.identifiant).then(setTravail).catch(e => setErreur(message(e))) }, 1500)
    return () => window.clearInterval(timer)
  }, [projet, travail?.identifiant, travail?.etat])
  function changer(champs: Partial<DemandeImageLocale>) { setDemande(d => ({ ...d, ...champs })); setErreur("") }
  async function action(geste: () => Promise<TravailImageLocale>) { setOccupe(true); setErreur(""); try { const t = await geste(); setTravail(t); setEdition(false) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) } }
  const refs = demande.references || []
  const bloque = !profil ? "Choisissez un workflow image." : !diagnostic?.disponible ? "Vérifiez les prérequis du workflow." : refs.length !== profil.references_min ? `Ce workflow demande exactement ${profil.references_min} référence(s).` : !demande.prompt.trim() ? "Décrivez l’image à fabriquer." : ""
  if (bibliotheque) return <BibliothequePourImage retour="Workflows locaux" onFermer={() => setBibliotheque(false)} onChoisir={a => { changer({ references: [...refs, a.identifiant] }); setBibliotheque(false) }} />
  return <section aria-label="Fabriquer une image locale" className="space-y-[22px] p-[22px] text-encre">
    <header className="flex items-start justify-between gap-[14px]"><div>{autonome && <h2 className="font-serif text-[38px]">Fabriquer une image locale</h2>}<p className="mt-[8px] text-[13px] text-encre-3">Le résultat rejoint la galerie et reste disponible pour vos assets et votre univers.</p></div>{autonome && onFermer && <button className={BOUTON} onClick={onFermer}>Fermer</button>}</header>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}<AvisBrouillon brouillon={brouillon} />
    {edition ? <form className="space-y-[22px]" onSubmit={e => { e.preventDefault(); void action(() => workflows.preparerImage(projet, { ...demande, cle: travail ? crypto.randomUUID() : demande.cle })) }}>
      <fieldset disabled={occupe} className={`${SURFACE} space-y-[14px]`}><label className="flex flex-col gap-[8px] text-[13px]">{CHAMP_DU_MODELE}<select className={CHAMP} value={demande.modele} onChange={e => { const p = profils.find(p => p.modele === e.target.value); changer({ modele: e.target.value, resolution: p?.formats[0].resolution, proportions: p?.formats[0].proportions, options: Object.fromEntries(Object.entries(p?.parametres || {}).map(([n, v]) => [n, v.defaut])) }) }}><option value="">{chargement ? "Lecture des workflows…" : "Choisir une méthode"}</option>{profils.map(p => <option key={p.modele} value={p.modele}>{p.nom} · {new Date(p.cree_le * 1000).toLocaleString("fr-FR")}</option>)}</select></label>
        {diagnostic && <p className={`text-[12px] ${diagnostic.disponible ? "text-ok" : "text-echec"}`}>{diagnostic.disponible ? "Prérequis présents · calcul local gratuit" : diagnostic.problemes.join(" · ")}</p>}
        <label className="flex flex-col gap-[8px] text-[13px]">L’image à fabriquer<textarea className={`${CHAMP} min-h-[128px]`} value={demande.prompt} onChange={e => changer({ prompt: e.target.value })} /></label><label className="text-[13px]"><input type="checkbox" checked={!demande.repris} onChange={e => changer({ repris: !e.target.checked })} /> Ajouter les règles de l’univers au texte</label>
        {profil?.liaisons.prompt_negatif && <label className="flex flex-col gap-[8px] text-[13px]">Ce qu’il faut éviter<textarea className={CHAMP} value={demande.prompt_negatif || ""} onChange={e => changer({ prompt_negatif: e.target.value })} /></label>}
        {profil && <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px] text-[13px]">Format<select className={CHAMP} value={JSON.stringify([demande.resolution || profil.formats[0].resolution, demande.proportions || profil.formats[0].proportions])} onChange={e => { const [resolution, proportions] = JSON.parse(e.target.value) as [string, string]; changer({ resolution, proportions }) }}>{profil.formats.map(f => <option key={JSON.stringify([f.resolution, f.proportions])} value={JSON.stringify([f.resolution, f.proportions])}>{f.largeur} × {f.hauteur} · {f.proportions}</option>)}</select></label>{Object.entries(profil.parametres).map(([n, p]) => <label key={n} className="flex flex-col gap-[8px] text-[13px]">{p.nom || n}{p.genre === "choix" ? <select className={CHAMP} value={String(demande.options?.[n] ?? p.defaut)} onChange={e => changer({ options: { ...demande.options, [n]: e.target.value } })}>{p.valeurs?.map(v => <option key={v}>{v}</option>)}</select> : p.genre === "booleen" ? <input type="checkbox" checked={Boolean(demande.options?.[n] ?? p.defaut)} onChange={e => changer({ options: { ...demande.options, [n]: e.target.checked } })} /> : <input type="number" className={CHAMP} min={p.minimum ?? undefined} max={p.maximum ?? undefined} value={Number(demande.options?.[n] ?? p.defaut)} onChange={e => changer({ options: { ...demande.options, [n]: Number(e.target.value) } })} />}</label>)}</div>}
      </fieldset>
      <section className={`${SURFACE} space-y-[14px]`}><h3 className="font-serif text-[25px]">Les images envoyées</h3><p className="text-[12px] text-encre-3">{profil ? `${profil.references_min} référence(s) obligatoire(s), dans cet ordre.` : "Le workflow choisi détermine les références nécessaires."}</p><div className="flex flex-wrap gap-[14px]">{refs.map((id, i) => <div key={`${id}-${i}`}><img src={api.fichier(id)} alt={`Référence ${i + 1}`} className="damier-papier h-[128px] w-[128px] object-contain" /><button type="button" className="mt-[4px] text-[12px]" onClick={() => changer({ references: refs.filter((_, r) => i !== r) })}>Retirer la référence {i + 1}</button></div>)}</div><button type="button" className={BOUTON} disabled={occupe || !profil || refs.length >= profil.references_max} onClick={() => setBibliotheque(true)}>Choisir dans la bibliothèque</button></section>
      <div className="flex items-center gap-[14px]"><button className={BOUTON} disabled={occupe || !!bloque}>{VERS_LA_RELECTURE}</button>{bloque && <p className="text-[12px] text-encre-3">{bloque}</p>}</div>
    </form> : travail && <div className="space-y-[22px]"><section className={`${SURFACE} space-y-[14px]`}><div className="flex items-start justify-between gap-[14px]"><h3 className="font-serif text-[25px]">{ETATS[travail.etat]}</h3><button className={BOUTON} disabled={occupe || travail.etat === "en_cours"} onClick={() => { setDemande({ ...travail.demande, cle: crypto.randomUUID() }); setEdition(true) }}>Modifier une nouvelle demande</button></div><p className="break-all text-[12px] text-encre-3">{profils.find(p => p.modele === travail.demande.modele)?.nom || travail.demande.modele}</p><p className="text-[13px]">Une génération locale · 0 $</p><p className="text-[12px] text-encre-3">{travail.annonce.locale.raison}</p><p className="whitespace-pre-wrap rounded-7 border border-trait bg-papier p-[14px] text-[13px]">{travail.envoi_image?.prompt}</p><div className="flex flex-wrap gap-[14px]">{travail.references.map((r, i) => <img key={r.nom} src={r.url} alt={`Référence envoyée ${i + 1}`} className="damier-papier h-[128px] w-[128px] object-contain" />)}</div><dl className="grid grid-cols-2 gap-[8px] text-[12px]"><dt>Format</dt><dd>{travail.envoi_image?.resolution} · {travail.envoi_image?.proportions}</dd>{Object.entries(travail.envoi_image?.options || {}).map(([n, v]) => <div key={n} className="contents"><dt>{n}</dt><dd>{String(v)}</dd></div>)}</dl>{travail.raison && <p className="text-[13px] text-encre-3">{travail.raison}</p>}
        <div className="flex flex-wrap gap-[8px]">{travail.etat === "prepare" && <button className={BOUTON} disabled={occupe} onClick={() => void action(() => workflows.demarrerImage(projet, travail.identifiant))}>Lancer cette image locale</button>}{["a_reprendre", "a_verifier"].includes(travail.etat) && <button className={BOUTON} disabled={occupe} onClick={() => void action(() => workflows.reprendreImage(projet, travail.identifiant))}>Reprendre le suivi conservé</button>}<button className={BOUTON} disabled={occupe} onClick={() => void action(() => workflows.lireImage(projet, travail.identifiant))}>Actualiser le suivi</button></div></section>
      {travail.reference_asset && <section className={`${SURFACE} space-y-[14px]`}><h3 className="font-serif text-[25px]">L’image est dans la galerie</h3><img src={api.fichier(travail.reference_asset)} alt="Image produite par le workflow" className="damier-papier h-[300px] w-full object-contain" /><div className="flex gap-[8px]">{onAsset && <button className={BOUTON} onClick={() => onAsset(travail.reference_asset!)}>Ouvrir et retoucher</button>}{onToile && <button className={BOUTON} onClick={() => onToile(travail.reference_asset!)}>Poser sur la toile</button>}</div></section>}
    </div>}
  </section>
}
