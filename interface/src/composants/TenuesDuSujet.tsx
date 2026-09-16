import { useEffect, useMemo, useState } from "react"
import { api, type Asset, type Bande, type LivraisonGodot, type Personnage, type VestiaireDuJeu } from "../api"
import { apiCalques, cleCible, type CibleCalque, type VarianteCalque } from "../api-calques"
import { tenues, type DemandeTenue, type SortieTenue, type Tenue } from "../api-tenues"
import { BandeQuiTourne, vignetteAsset } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre"
const message = (e: unknown) => e instanceof Error ? e.message : "Impossible de conserver la tenue."
type OuvrirEmploi = (piece: string, emploi: string, cible?: CibleCalque, variante?: string) => void
type Resultat = { nature: "image" | "animation"; identifiant: string; pose: string; direction: string; nom: string; image?: Asset; bande?: Bande }

function resultatsDu(personnage: Personnage): Resultat[] {
  const uniques = new Map<string, Resultat>()
  for (const c of personnage.cases) {
    for (const b of c.bandes ?? []) if (!b.piece && !b.supprime && b.compte) uniques.set("animation:" + b.identifiant, { nature: "animation", identifiant: b.identifiant, pose: b.pose || c.pose, direction: b.direction || "", nom: b.nom, bande: b })
    for (const i of c.images) if (!i.piece && !i.supprime_le) uniques.set("image:" + i.identifiant, { nature: "image", identifiant: i.identifiant, pose: i.pose || c.pose, direction: i.direction || "", nom: i.identifiant, image: i })
  }
  return [...uniques.values()]
}

function Vignette({ resultat }: { resultat: Resultat }) {
  const [survol, setSurvol] = useState(false)
  return <span className="inline-flex shrink-0" onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}>{resultat.bande ? <BandeQuiTourne bande={resultat.bande} cote={54} joue={survol} titre={resultat.nom} /> : resultat.image && <img className="h-[54px] w-[54px] object-contain" style={{ imageRendering: "pixelated" }} src={vignetteAsset(resultat.image, 54)} alt={resultat.nom} />}</span>
}

/** La bibliothèque est conservée ; seules les combinaisons changent ici. */
export function TenuesDuSujet({ personnage, vestiaire, onEmploi, onLivraisons }: { personnage: Personnage; vestiaire?: VestiaireDuJeu | null; onEmploi?: OuvrirEmploi; onLivraisons?: () => void }) {
  const [liste, setListe] = useState<Tenue[]>([])
  const [ouverte, setOuverte] = useState<Tenue | "nouvelle" | null>(null)
  const [erreur, setErreur] = useState("")
  const [charge, setCharge] = useState(false)
  useEffect(() => {
    let actif = true
    tenues.lister(personnage.projet, personnage.identifiant).then(l => { if (actif) { setListe(l); setCharge(true) } }).catch(e => { if (actif) setErreur(message(e)) })
    return () => { actif = false }
  }, [personnage.projet, personnage.identifiant])
  const garder = (t: Tenue) => { setListe(l => [t, ...l.filter(v => v.identifiant !== t.identifiant)]); setOuverte(t) }
  return <section className="mt-[22px] rounded-8 border border-trait bg-carte p-[22px]" aria-label="Tenues du personnage">
    <div className="flex items-start justify-between gap-[14px]"><div><h2 className="font-serif text-[25px]">Ses tenues</h2><p className="mt-[8px] text-[13px] text-encre-3">Combinez casque, sac et arme avec leurs calques. Aucune nouvelle génération pour changer de combinaison.</p></div><button className={BOUTON} onClick={() => setOuverte("nouvelle")}>Composer une tenue</button></div>
    {erreur && <p role="alert" className="mt-[14px] text-echec">{erreur}</p>}
    {charge && !liste.length && <p className="mt-[14px] text-[13px] text-encre-3">Aucune tenue conservée. Le corps seul peut aussi être enregistré et exporté.</p>}
    <div className="mt-[14px] grid grid-cols-2 gap-[14px]">{liste.map(t => <button key={t.identifiant} className="flex items-center gap-[14px] rounded-7 border border-trait p-[14px] text-left hover:border-contour" onClick={() => setOuverte(t)}><img src={tenues.image(t, t.sorties[0].cle, 0, t.emplois.filter(e => e.actif).map(e => e.piece))} alt="" className="h-[54px] w-[54px] object-contain" style={{ imageRendering: "pixelated" }} /><span><span className="text-[14px]">{t.nom}</span><span className="mt-[4px] block text-[12px] text-encre-3">Révision {t.revision} · {t.sorties.length} poses / animations · {t.couverture.prete ? "prête à assembler" : "à compléter ou revoir"}</span></span></button>)}</div>
    {ouverte && <EditeurTenue key={ouverte === "nouvelle" ? "nouvelle" : ouverte.identifiant} personnage={personnage} vestiaire={vestiaire} initiale={ouverte === "nouvelle" ? null : ouverte} onChange={garder} onFermer={() => setOuverte(null)} onEmploi={onEmploi} onLivraisons={onLivraisons} />}
  </section>
}

function EditeurTenue({ personnage, vestiaire, initiale, onChange, onFermer, onEmploi, onLivraisons }: { personnage: Personnage; vestiaire?: VestiaireDuJeu | null; initiale: Tenue | null; onChange: (t: Tenue) => void; onFermer: () => void; onEmploi?: OuvrirEmploi; onLivraisons?: () => void }) {
  const liens = useMemo(() => (vestiaire?.pieces ?? []).flatMap(p => p.emplois.filter(e => e.genre === "porte" && e.porteur === personnage.identifiant).map(e => ({ piece: p.piece.identifiant, emploi: e.identifiant, actif: true, priorite: 0, nom: p.piece.nom }))), [vestiaire, personnage.identifiant])
  const resultats = useMemo(() => resultatsDu(personnage), [personnage])
  const [tenue, setTenue] = useState(initiale)
  const [demande, setDemande] = useState<DemandeTenue>(initiale ? { ...initiale.demande, emplois: initiale.emplois, pivot: initiale.pivot } : { nom: "", resultats: [], emplois: liens.map((e, i) => ({ ...e, priorite: i })), choix: {} })
  const [edition, setEdition] = useState(!initiale)
  const [sortieId, setSortieId] = useState(initiale?.sorties[0]?.cle ?? "")
  const [frame, setFrame] = useState(0)
  const [occupe, setOccupe] = useState(false)
  const [sale, setSale] = useState(false)
  const [erreur, setErreur] = useState("")
  const [notice, setNotice] = useState("")
  const [livraison, setLivraison] = useState<LivraisonGodot | null>(null)
  const [choisir, setChoisir] = useState<{ piece: string; emploi: string; variantes: VarianteCalque[] } | null>(null)
  const sortie = tenue?.sorties.find(s => s.cle === sortieId) ?? tenue?.sorties[0]
  const vueFrame = sortie?.frames[frame]
  const changer = (d: Partial<DemandeTenue>) => { setDemande(v => ({ ...v, ...d })); setSale(true); setLivraison(null); setNotice("") }
  const agir = async (action: () => Promise<void>) => { setOccupe(true); setErreur(""); try { await action() } catch (e) { setErreur(message(e)) } finally { setOccupe(false) } }
  const recevoir = (t: Tenue, courant = true) => { setTenue(t); setDemande({ ...t.demande, emplois: t.emplois, pivot: t.pivot }); setSale(false); setEdition(false); setLivraison(null); if (courant) onChange(t); setSortieId(s => t.sorties.some(v => v.cle === s) ? s : t.sorties[0].cle) }
  const fermer = () => { if (sale) { setErreur("Conservez les changements ou utilisez Abandonner les changements avant de fermer."); return }; onFermer() }
  useEffect(() => { const quitter = (e: BeforeUnloadEvent) => { if (sale) { e.preventDefault(); e.returnValue = "" } }; window.addEventListener("beforeunload", quitter); return () => window.removeEventListener("beforeunload", quitter) }, [sale])
  useEffect(() => { setFrame(0) }, [sortieId])
  const historique = !!tenue && tenue.revision !== Math.max(...tenue.revisions)
  const actifs = demande.emplois.filter(e => e.actif).map(e => e.piece)
  const groupes = [...new Set(resultats.map(r => `${r.nature}:${r.pose}:${r.direction}`))]
  const sauvegarder = () => void agir(async () => { recevoir(tenue ? await tenues.regler(tenue, demande) : await tenues.creer(personnage.projet, personnage.identifiant, demande)); setNotice("La tenue et ses choix précis sont conservés.") })
  return <CadreDialogue titre="Composer une tenue" onFermer={fermer} enfants={<>
    <header className="flex items-start justify-between gap-[22px] border-b border-trait px-[30px] py-[14px]"><div><p className="text-[12px] text-encre-3">{personnage.nom} · tenue {tenue ? `conservée · révision ${tenue.revision}` : "à composer"}</p><h1 className="font-serif text-[38px]">{demande.nom || "Composer une tenue"}</h1></div><button className={BOUTON} onClick={fermer}>Fermer</button></header>
    <main className="defile min-h-0 flex-1 overflow-y-auto p-[30px]">
      {erreur && <p role="alert" className="mb-[14px] text-echec">{erreur}</p>}{notice && <p role="status" className="mb-[14px] text-ok">{notice}</p>}
      <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-[22px]">
        <aside className="space-y-[14px]"><label className="block text-[13px]">Nom de la tenue<input className={`${CHAMP} mt-[4px] w-full`} value={demande.nom} onChange={e => changer({ nom: e.target.value })} /></label>
          <fieldset disabled={occupe} className="space-y-[8px]"><legend className="mb-[8px] font-serif text-[25px]">Les pièces</legend><p className="text-[12px] text-encre-3">Cochez pour essayer. La priorité départage les pièces qui se recouvrent ; leurs masques décident des pixels devant et derrière le corps.</p>
            {liens.map(lien => { const e = demande.emplois.find(v => v.piece === lien.piece); return <div key={lien.piece} className="rounded-7 border border-trait bg-carte p-[14px]"><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={!!e?.actif} onChange={ev => changer({ emplois: e ? demande.emplois.map(v => v.piece === e.piece ? { ...v, actif: ev.target.checked } : v) : [...demande.emplois, { ...lien, actif: ev.target.checked }] })} />{lien.nom}</label>{e && <label className="mt-[8px] flex items-center justify-between gap-[8px] text-[12px]">Priorité<input aria-label={`Priorité de ${lien.nom}`} className={`${CHAMP} w-[70px]`} type="number" min={-1000} max={1000} value={e.priorite} onChange={ev => changer({ emplois: demande.emplois.map(v => v.piece === e.piece ? { ...v, priorite: Number(ev.target.value) } : v) })} /></label>}{onEmploi && <button className="mt-[8px] text-[12px] underline" disabled={sale} onClick={() => { onFermer(); onEmploi(lien.piece, lien.emploi, vueFrame?.cible) }}>Voir les calques de cet emploi</button>}</div> })}
            {!liens.length && <p className="text-[13px] text-encre-3">Aucun équipement attribué à ce personnage. Vous pouvez conserver le corps seul, puis ajouter ses pièces depuis son vestiaire.</p>}
            <button className={BOUTON} onClick={() => changer({ emplois: demande.emplois.map(e => ({ ...e, actif: false })) })}>Essayer le corps seul</button>
          </fieldset>
          <fieldset disabled={occupe} className="rounded-7 border border-trait p-[14px]"><legend className="text-[13px]">Pivot commun, en pixels</legend><div className="flex gap-[8px]">{(["x", "y"] as const).map(axe => <label key={axe} className="text-[12px]">{axe.toUpperCase()}<input aria-label={`Pivot ${axe}`} className={`${CHAMP} mt-[4px] w-full`} type="number" min={-8192} max={8192} step="any" value={demande.pivot?.[axe] ?? ""} onChange={e => changer({ pivot: { x: demande.pivot?.x ?? tenue?.pivot.x ?? 0, y: demande.pivot?.y ?? tenue?.pivot.y ?? 0, [axe]: Number(e.target.value) } })} /></label>)}</div><p className="mt-[8px] text-[12px] text-encre-3">Sans valeur, reprend le repère de la première pose. Toutes les couches l’utilisent.</p></fieldset>
        </aside>
        <div className="min-w-0 space-y-[14px]">
          <div className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px]">Poses et animations</h2><button className={BOUTON} onClick={() => setEdition(v => !v)}>{edition ? "‹ L’aperçu" : "Choisir les versions"}</button></div>
          {edition && <div className="space-y-[8px]">{!resultats.length && <p className="text-[13px] text-encre-3">Le personnage n’a encore aucune pose ni animation nue à combiner. Créez ou importez son corps, puis revenez ici.</p>}{groupes.map(g => { const versions = resultats.filter(r => `${r.nature}:${r.pose}:${r.direction}` === g); const premier = versions[0]; const choisie = demande.resultats.find(s => versions.some(v => v.identifiant === s.identifiant && v.nature === s.nature)); const r = versions.find(v => v.identifiant === choisie?.identifiant); return <div key={g} className="flex items-center gap-[14px] rounded-7 border border-trait bg-carte p-[14px]">{r && <Vignette resultat={r} />}<label className="min-w-0 flex-1 text-[13px]">{personnage.plan.find(p => p.identifiant === premier.pose)?.nom ?? premier.pose} · {premier.direction || "sans direction"} · {premier.nature === "animation" ? "animation" : "image fixe"}<select aria-label={`Version ${g}`} className={`${CHAMP} mt-[4px] w-full`} value={choisie?.identifiant ?? ""} onChange={e => changer({ resultats: [...demande.resultats.filter(s => !versions.some(v => v.identifiant === s.identifiant && v.nature === s.nature)), ...(e.target.value ? [{ nature: premier.nature, identifiant: e.target.value, boucle: true }] : [])] })}><option value="">Ne pas inclure</option>{versions.map(v => <option key={v.identifiant} value={v.identifiant}>{v.nom} · {v.bande?.favori || v.image?.favori ? "retenue" : "autre version"}</option>)}</select></label>{choisie && premier.nature === "animation" && <label className="flex items-center gap-[8px] text-[12px]"><input type="checkbox" checked={choisie.boucle !== false} onChange={e => changer({ resultats: demande.resultats.map(s => s.identifiant === choisie.identifiant ? { ...s, boucle: e.target.checked } : s) })} />En boucle</label>}</div> })}</div>}
          {tenue && sortie && <><label className="block text-[13px]">Aperçu de la version conservée<select className={`${CHAMP} ml-[14px]`} value={sortie.cle} onChange={e => setSortieId(e.target.value)}>{tenue.sorties.map(s => <option key={s.cle} value={s.cle}>{s.titre} · {s.direction || "sans direction"}</option>)}</select></label><LecteurTenue tenue={tenue} sortie={sortie} actifs={actifs} priorites={Object.fromEntries(demande.emplois.map(e => [e.piece, e.priorite]))} frame={frame} onFrame={setFrame} />
            {(sortie.a_revoir || vueFrame?.a_revoir) && <p role="status" className="rounded-7 border border-trait p-[14px] text-[13px]">{vueFrame?.a_revoir || sortie.a_revoir} L’aperçu garde les anciens pixels.</p>}
            <section className="rounded-7 border border-trait bg-carte p-[14px]"><h3 className="font-serif text-[25px]">Calques de la frame {frame + 1}</h3><p className="mt-[4px] text-[12px] text-encre-3">Ces versions sont figées. Retenir une autre variante dans l’emploi ne les remplace pas.</p>{vueFrame?.calques.map(c => <div key={c.piece} className="mt-[14px] flex items-center justify-between gap-[14px] text-[13px]"><span>{tenue.emplois.find(e => e.piece === c.piece)?.nom ?? c.piece}<span className="mt-[4px] block text-[12px] text-encre-3">{c.a_revoir || c.raison || `Variante ${c.variante?.slice(0, 8)} · révision ${c.revision}`}</span></span><div className="flex gap-[8px]"><button className={BOUTON} disabled={occupe} onClick={() => void agir(async () => { const donnees = await apiCalques.cibles({ projet: tenue.projet, piece: c.piece, emploi: c.emploi }); setChoisir({ piece: c.piece, emploi: c.emploi, variantes: donnees.variantes.filter(v => v.role === "calque" && cleCible(v.cible) === cleCible(vueFrame.cible)) }) })}>Changer la variante</button>{onEmploi && <button className={BOUTON} disabled={sale} onClick={() => { onFermer(); onEmploi(c.piece, c.emploi, vueFrame.cible, c.variante ?? undefined) }}>Corriger</button>}</div></div>)}</section>
            {choisir && vueFrame && <div className="rounded-7 border border-contour bg-carte p-[14px]"><h3 className="font-serif text-[25px]">Choisir pour cette frame seulement</h3><div className="mt-[14px] flex flex-wrap gap-[14px]">{choisir.variantes.map(v => <button key={v.identifiant} className={`${BOUTON} h-auto p-[8px]`} disabled={occupe} onClick={() => { changer({ choix: { ...demande.choix, [vueFrame.cle]: { ...demande.choix?.[vueFrame.cle], [choisir.piece]: v.identifiant } } }); setChoisir(null) }}><img className="h-[54px] w-[54px] object-contain" src={apiCalques.image({ projet: tenue.projet, piece: choisir.piece, emploi: choisir.emploi }, v)} alt={`Variante ${v.identifiant.slice(0, 8)}`} /><span className="block text-[12px]">{v.etat} · r{v.revision}</span></button>)}</div>{!choisir.variantes.length && <p className="mt-[8px] text-[13px]">Aucun calque pour cette cible exacte. Ouvrez l’emploi pour le fabriquer.</p>}<button className={`${BOUTON} mt-[14px]`} onClick={() => setChoisir(null)}>Annuler ce choix</button></div>}
          </>}
          {!tenue && <p className="rounded-7 border border-trait bg-carte p-[22px] text-[13px]">Choisissez les versions du corps et les pièces, puis conservez la tenue pour lire ses combinaisons. Les manques seront nommés ; aucune image ne sera générée.</p>}
          {tenue && <div className="rounded-7 border border-trait p-[14px]"><p className="text-[13px]">{tenue.couverture.images} images · {tenue.couverture.toutes_couches_pretes ? "toutes les couches sont prêtes" : `${tenue.couverture.difficultes.length} points à compléter ou revoir`}</p><div className="mt-[14px] flex flex-wrap gap-[8px]"><button className={BOUTON} disabled={occupe || sale || historique} onClick={() => void agir(async () => { recevoir(await tenues.actualiser(tenue)); setNotice("Nouvelle révision créée depuis les corps et calques retenus actuels. L’ancienne reste conservée.") })}>Actualiser depuis les calques retenus</button><label className="text-[12px]">Relire une révision<select aria-label="Révision de la tenue" className={`${CHAMP} ml-[8px]`} value={tenue.revision} disabled={sale || occupe} onChange={e => void agir(async () => recevoir(await tenues.lire(tenue.projet, tenue.personnage, tenue.identifiant, Number(e.target.value)), false))}>{tenue.revisions.map(r => <option key={r} value={r}>Révision {r}</option>)}</select></label>{historique && <button className={BOUTON} disabled={sale || occupe} onClick={() => void agir(async () => recevoir(await tenues.restaurer(tenue)))}>Restaurer cette révision comme tenue courante</button>}</div></div>}
        </div>
      </div>
      {tenue && <section className="mt-[22px] rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Livrer la tenue</h2><p className="mt-[8px] text-[13px] text-encre-3">Les couches permettent au jeu d’équiper et retirer chaque pièce. L’assemblage donne les images de la combinaison conservée. Le cadre, le pivot et la cadence restent communs.</p><div className="mt-[14px] flex flex-wrap gap-[8px]">{(["couches", "assemble"] as const).map(mode => { const pret = mode === "couches" ? tenue.couverture.toutes_couches_pretes : tenue.couverture.prete; return <div key={mode} className="flex gap-[8px]">{!sale && pret ? <a className={`${BOUTON} inline-flex items-center`} href={tenues.archive(tenue, mode)}>Télécharger {mode === "couches" ? "les couches" : "l’assemblage"}</a> : <button className={BOUTON} disabled>Télécharger {mode === "couches" ? "les couches" : "l’assemblage"}</button>}<button className={BOUTON} disabled={occupe || sale || !pret} onClick={() => void agir(async () => setLivraison(await tenues.livraison(tenue, mode)))}>Relire {mode === "couches" ? "les couches" : "l’assemblage"} pour Godot</button></div> })}{onLivraisons && <button className={BOUTON} disabled={sale} onClick={() => { onFermer(); onLivraisons() }}>Dossier Godot et historique</button>}</div>{sale && <p className="mt-[8px] text-[12px] text-encre-3">Conservez les changements avant de livrer cette combinaison.</p>}
        {livraison && <div className="mt-[22px] border-t border-trait pt-[14px]"><p className="text-[13px]">Dossier : {livraison.dossier}</p><p className="mt-[8px] text-[13px]">{livraison.fichiers.length} fichiers · {livraison.pret ? "aucun conflit" : `${livraison.conflits.length} conflits : aucun fichier inconnu ne sera remplacé`}</p><details className="mt-[14px] text-[12px]"><summary>Voir les fichiers et leurs rôles</summary><ul className="mt-[8px] space-y-[4px]">{livraison.fichiers.map(f => <li key={f.chemin}>{f.role} · {f.chemin}</li>)}</ul></details>{livraison.etat === "terminee" ? <p role="status" className="mt-[14px] text-ok">Tenue livrée : {livraison.scene}</p> : <button className={`${BOUTON} mt-[14px]`} disabled={occupe || !livraison.pret} onClick={() => void agir(async () => setLivraison(await api.livrerGodot(tenue.projet, livraison.jeton)))}>Livrer ces fichiers dans Godot</button>}</div>}
      </section>}
    </main><footer className="flex items-center justify-between gap-[14px] border-t border-trait bg-carte px-[30px] py-[14px]"><p className="text-[12px] text-encre-3">{sale ? "Changements non conservés" : "Les sources et les anciennes révisions sont préservées."}</p><div className="flex gap-[8px]">{sale && <button className={BOUTON} disabled={occupe} onClick={() => { setSale(false); if (tenue) { setDemande({ ...tenue.demande, emplois: tenue.emplois, pivot: tenue.pivot }); setErreur("") } else onFermer() }}>Abandonner les changements</button>}<button className={BOUTON} disabled={occupe || historique || !demande.nom.trim() || !demande.resultats.length || (!!tenue && !sale)} onClick={sauvegarder}>{occupe ? "En cours…" : "Conserver la tenue"}</button></div></footer>
  </>} />
}

function LecteurTenue({ tenue, sortie, actifs, priorites, frame, onFrame }: { tenue: Tenue; sortie: SortieTenue; actifs: string[]; priorites: Record<string, number>; frame: number; onFrame: (n: number) => void }) {
  const [joue, setJoue] = useState(true)
  const [zoom, setZoom] = useState(4)
  const [images, setImages] = useState<{ cle: string; urls: string[] }>({ cle: "", urls: [] })
  const [erreur, setErreur] = useState("")
  const cle = JSON.stringify([tenue.identifiant, tenue.revision, sortie.cle, actifs, priorites])
  useEffect(() => {
    const controle = new AbortController(); const urls: string[] = []; setErreur("")
    Promise.all(sortie.frames.map((_, i) => fetch(tenues.image(tenue, sortie.cle, i, actifs, priorites), { signal: controle.signal }).then(async r => { if (!r.ok) throw new Error("Une image de la tenue ne peut pas être relue."); const b = await r.blob(); if (controle.signal.aborted) return ""; const url = URL.createObjectURL(b); urls.push(url); return url }))).then(l => { if (!controle.signal.aborted) setImages({ cle, urls: l }) }).catch(e => { if (!controle.signal.aborted) setErreur(message(e)) })
    return () => { controle.abort(); urls.forEach(URL.revokeObjectURL) }
    // Une nouvelle combinaison charge ensemble ses frames avant la lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])
  useEffect(() => {
    if (!joue || images.cle !== cle || sortie.ordre.length < 2) return
    let pas = sortie.ordre.indexOf(frame)
    const intervalle = window.setInterval(() => { if (!sortie.boucle && pas >= sortie.ordre.length - 1) { setJoue(false); return }; pas = (pas + 1) % sortie.ordre.length; onFrame(sortie.ordre[pas]) }, Math.max(1, Math.round(1000 / sortie.cadence)))
    return () => window.clearInterval(intervalle)
    // Le lecteur tient son pas : le remonter à chaque frame casse l'aller-retour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joue, cle, images.cle, sortie.cle])
  return <div className="rounded-8 border border-trait bg-papier-cote p-[14px]"><div className="flex flex-wrap items-center gap-[8px]"><button className={BOUTON} onClick={() => { if (!joue && frame === sortie.ordre.at(-1)) onFrame(sortie.ordre[0]); setJoue(v => !v) }}>{joue ? "Pause" : "Lire"}</button><label className="text-[12px]">Frame<input aria-label="Frame de la tenue" type="range" min={0} max={sortie.frames.length - 1} value={frame} onChange={e => { setJoue(false); onFrame(Number(e.target.value)) }} className="mx-[8px] align-middle" />{frame + 1} / {sortie.frames.length}</label><label className="ml-auto text-[12px]">Zoom<select className={`${CHAMP} ml-[8px]`} value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n * 100} %</option>)}</select></label></div><div className="mt-[14px] flex h-[300px] items-center justify-center overflow-auto rounded-7 border border-trait bg-carte">{erreur ? <p role="alert">{erreur}</p> : images.cle !== cle ? <p role="status" className="text-[13px] text-encre-3">Préparation de cette combinaison…</p> : <img src={images.urls[frame]} alt={`Tenue ${tenue.nom}, frame ${frame + 1}`} style={{ width: sortie.frames[frame]?.base.cadre.largeur * zoom, height: sortie.frames[frame]?.base.cadre.hauteur * zoom, imageRendering: "pixelated", maxWidth: "none" }} />}</div></div>
}
