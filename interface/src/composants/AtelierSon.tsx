import { useEffect, useRef, useState } from "react"
import { ApercuLivraisonSon } from "./ApercuLivraisonSon"
import { ReglagesSon } from "./ReglagesSon"
import { FAMILLES_AVEC_LUFS, NOMS_FAMILLES_SON, sons, type FamilleSon, type JugementSon, type OndeSon, type RecetteSon, type Son } from "../api-sons"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]"
const FAMILLES: FamilleSon[] = ["bruitage", "interface", "ambiance", "musique", "chanson", "jingle", "voix"]
const erreurDe = (e: unknown) => e instanceof Error ? e.message : "Le son n’a pas pu être conservé."

/** Le lecteur joue le WAV de la version conservée, celui qui sera livré. */
export function AtelierSon({ projet, identifiantInitial, onFermer, onLivraisons }: { projet: string; identifiantInitial?: string; onFermer?: () => void; onLivraisons?: () => void }) {
  const [liste, setListe] = useState<Son[]>([])
  const [son, setSon] = useState<Son | null>(null)
  const [recette, setRecette] = useState<RecetteSon | null>(null)
  const [nom, setNom] = useState("")
  const [onde, setOnde] = useState<OndeSon | null>(null)
  const [brut, setBrut] = useState(false)
  const [position, setPosition] = useState(0)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const [choisirFamille, setChoisirFamille] = useState(false)
  const [afficherLivraison, setAfficherLivraison] = useState(false)
  const lecteur = useRef<HTMLAudioElement>(null)
  const modifie = !!son && !!recette && (nom !== son.nom || JSON.stringify(recette) !== JSON.stringify(son.recette))
  const installer = (s: Son) => { setSon(s); setRecette(s.recette); setNom(s.nom); setPosition(0); setChoisirFamille(false); setAfficherLivraison(false) }
  const faire = async (action: () => Promise<void>) => { setOccupe(true); setErreur(""); try { await action() } catch (e) { setErreur(erreurDe(e)) } finally { setOccupe(false) } }
  useEffect(() => { let actif = true; setSon(null); sons.lister(projet).then(v => { if (actif) setListe(v) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); if (identifiantInitial) sons.lire(projet, identifiantInitial).then(s => { if (actif) installer(s) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); return () => { actif = false } }, [projet, identifiantInitial])
  useEffect(() => { let actif = true; setOnde(null); if (son?.mesures) sons.onde(son, brut).then(o => { if (actif) setOnde(o) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); return () => { actif = false } }, [son, brut])
  useEffect(() => { if (!modifie) return; const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload", avertir); return () => window.removeEventListener("beforeunload", avertir) }, [modifie])
  const changer = <K extends keyof RecetteSon>(cle: K, valeur: RecetteSon[K]) => { setRecette(r => r && { ...r, [cle]: valeur }) }
  const rafraichir = async (s: Son) => { installer(s); setListe(await sons.lister(projet)) }
  const ouvrir = (s: Son) => { if (!modifie || window.confirm("Abandonner les réglages non conservés de ce son ?")) installer(s) }
  const poserFamille = (famille: FamilleSon) => { if (!son) return; void faire(async () => rafraichir(await sons.classer(son, famille))) }
  const appliquerReglagesFamille = () => { if (!son || !son.famille) return; void faire(async () => rafraichir(await sons.classer(son, son.famille, true))) }
  const recetteProposeeDiffere = !!son?.recette_proposee && !!recette && JSON.stringify(son.recette_proposee) !== JSON.stringify(recette)
  return <section className="space-y-[22px]" aria-label="Atelier sonore">
    <header className="flex items-start justify-between gap-[14px]"><div><h1 className="font-serif text-[38px]">{son ? son.nom : "Les sons"}</h1><p className="mt-[8px] text-[13px] text-encre-3">Écouter, ajuster et conserver les sons du jeu. La source reste toujours disponible.</p></div><div className="flex gap-[8px]"><label className={`${BOUTON} inline-flex items-center cursor-pointer`}>Importer un son<input aria-label="Importer un son" type="file" accept="audio/*,.wav,.ogg,.mp3" hidden disabled={occupe} onChange={e => { const f = e.target.files?.[0]; if (f && (!modifie || window.confirm("Abandonner les réglages non conservés ?"))) void faire(async () => rafraichir(await sons.importer(projet, f))); e.target.value = "" }} /></label>{onFermer && <button className={BOUTON} onClick={() => { if (!modifie || window.confirm("Abandonner les réglages non conservés ?")) onFermer() }}>Fermer</button>}</div></header>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!son ? <div className="grid grid-cols-2 gap-[14px]">{liste.map(s => <button key={s.identifiant} className="rounded-8 border border-trait bg-carte p-[22px] text-left" onClick={() => ouvrir(s)}><span className="font-serif text-[25px]">{s.nom}</span><span className="mt-[8px] block text-[13px] text-encre-3">{s.mesures ? `${s.mesures.duree.toFixed(2)} s · ${s.mesures.canaux === 2 ? "stéréo" : "mono"}` : "Source à vérifier"} · {s.versions.length} versions{s.famille ? ` · ${NOMS_FAMILLES_SON[s.famille]}` : ""}</span>{s.raison && <span className="mt-[8px] block text-[12px] text-echec">{s.raison}</span>}</button>)}{!liste.length && <p className="text-[13px] text-encre-3">Importez un bruitage, une ambiance ou une musique ; la génération locale est aussi disponible dans Fabrications.</p>}</div> : recette && <>
      <div className="flex flex-wrap items-center gap-[14px]"><button className={BOUTON} onClick={() => { if (!modifie || window.confirm("Abandonner les réglages non conservés ?")) setSon(null) }}>Tous les sons</button><label className="text-[13px]">Version <select aria-label="Version du son" className={CHAMP} value={son.revision} disabled={occupe || modifie} onChange={e => void faire(async () => installer(await sons.lire(projet, son.identifiant, Number(e.target.value))))}>{son.versions.map(v => <option key={v.revision} value={v.revision}>Version {v.revision} · {v.jugement === "retenue" ? "retenue" : v.jugement === "ecartee" ? "écartée" : "à juger"}</option>)}</select></label><select aria-label="Jugement du son" className={CHAMP} value={son.jugement} disabled={occupe || modifie} onChange={e => void faire(async () => rafraichir(await sons.juger(son, e.target.value as JugementSon)))}><option value="a-juger">À juger</option><option value="retenue" disabled={!son.pret}>Retenue</option><option value="ecartee">Écartée</option></select>{son.revision !== son.revision_courante && <button className={BOUTON} disabled={occupe} onClick={() => void faire(async () => rafraichir(await sons.restaurer(son)))}>Restaurer dans une nouvelle version</button>}</div>
      {son.raison && <p className="rounded-8 border border-trait bg-carte p-[14px] text-[13px] text-echec">{son.raison}</p>}
      {son.avertissements.length > 0 && <ul className="space-y-[4px] rounded-8 border border-trait bg-carte p-[14px] text-[13px] text-encre-attention">{son.avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
        <span className="text-encre-3">Famille</span>
        {son.famille ? <span className="rounded-7 border border-trait bg-carte px-[8px] py-[4px]">{NOMS_FAMILLES_SON[son.famille]}</span> : <span className="text-encre-3">aucune — choisissez-en une pour qu’il se livre en fichier prêt pour le jeu.</span>}
        <button className={`${BOUTON} h-[26px] px-[8px]`} disabled={occupe} onClick={() => setChoisirFamille(v => !v)}>{son.famille ? "Changer" : "Poser une famille"}</button>
        {recetteProposeeDiffere && <button className={`${BOUTON} h-[26px] px-[8px]`} disabled={occupe} onClick={appliquerReglagesFamille}>Appliquer les réglages de la famille</button>}
      </div>
      {choisirFamille && <div className="flex flex-wrap gap-[8px]">{FAMILLES.map(f => <button key={f} className={`${BOUTON} h-[26px] px-[8px]`} aria-pressed={son.famille === f} disabled={occupe} onClick={() => poserFamille(f)}>{NOMS_FAMILLES_SON[f]}</button>)}</div>}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[22px]">
        <div className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
          <div className="flex justify-between gap-[14px]"><h2 className="font-serif text-[25px]">L’écoute</h2><label className="text-[13px]"><input type="checkbox" checked={brut} onChange={e => setBrut(e.target.checked)} /> Écouter la source</label></div>
          {onde && <div className="space-y-[8px]">{onde.canaux_ondes.map((c, i) => <svg key={i} role="img" aria-label={`Forme d’onde · canal ${i + 1}`} viewBox="0 0 1000 128" className="h-[128px] w-full rounded-7 bg-papier-cote text-signal" onClick={e => { const box = e.currentTarget.getBoundingClientRect(); if (lecteur.current) lecteur.current.currentTime = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * onde.duree }}><path fill="currentColor" opacity="0.6" d={`M ${c.maximum.map((v, j) => `${j * 1000 / c.maximum.length},${64-v*60}`).join(" L ")} L ${[...c.minimum].reverse().map((v, j) => `${(c.minimum.length - j - 1) * 1000 / c.minimum.length},${64-v*60}`).join(" L ")} Z`} /><line x1={position / onde.duree * 1000} x2={position / onde.duree * 1000} y1="0" y2="128" stroke="currentColor" strokeWidth="2" /></svg>)}</div>}
          {son.mesures && <audio key={`${son.identifiant}-${son.revision}-${brut}`} ref={lecteur} className="w-full" controls preload="metadata" src={sons.audio(son, brut)} onTimeUpdate={e => { const audio = e.currentTarget; const b = son.mesures?.boucle; if (!brut && b?.active && audio.currentTime >= b.fin / son.mesures!.taux) audio.currentTime = b.debut / son.mesures!.taux; setPosition(audio.currentTime) }} onEnded={e => { if (!brut && son.mesures?.boucle?.active) { e.currentTarget.currentTime = son.mesures.boucle.debut / son.mesures.taux; void e.currentTarget.play() } }} />}
          {son.mesures && <p className="text-[13px] text-encre-3">{son.mesures.duree.toFixed(3)} s · {son.mesures.taux.toLocaleString("fr")} Hz · {son.mesures.canaux === 2 ? "stéréo" : "mono"} · crête {son.mesures.crete_db?.toFixed(1) ?? "−∞"} dBFS{son.famille && FAMILLES_AVEC_LUFS.includes(son.famille) && son.mesures.lufs != null ? ` · ${son.mesures.lufs.toFixed(1)} LUFS` : ""}</p>}
          <p className="text-[12px] text-encre-3">{modifie ? "Réglages modifiés : conservez une version pour entendre le nouveau rendu." : "Vous écoutez la version conservée. Le WAV livré contient exactement ce signal."}</p>
          <label className="flex flex-col gap-[8px] text-[13px]">Nom<input className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} /></label>
          <details className="text-[13px]"><summary className="cursor-pointer">Source et provenance</summary><p className="mt-[8px]">{son.source.nom} · {(son.source.octets / 1024).toFixed(1)} Ko</p><pre className="mt-[8px] overflow-auto whitespace-pre-wrap text-[12px]">{JSON.stringify(son.provenance, null, 2)}</pre><a className="underline" href={sons.source(son)} download>Télécharger la source intacte</a></details>
        </div>
        <aside className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
          <h2 className="font-serif text-[25px]">Régler</h2>
          <ReglagesSon son={son} recette={recette} mesures={son.mesures} famille={son.famille} occupe={occupe} onChange={changer} />
        </aside>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center gap-[14px] border-t border-trait bg-papier py-[14px]"><button className={`${BOUTON} border-signal bg-signal text-encre-sur-signal`} disabled={occupe || !modifie || son.revision !== son.revision_courante} onClick={() => void faire(async () => rafraichir(await sons.regler(son, recette, nom)))}>Conserver une version</button>{modifie && <button className={BOUTON} onClick={() => installer(son)}>Abandonner les réglages</button>}<button className={BOUTON} disabled={occupe || modifie || !son.pret || son.jugement === "ecartee"} onClick={() => setAfficherLivraison(v => !v)}>Relire la livraison Godot</button>{son.pret && !modifie && <a href={sons.archive(son)} className="text-[13px] underline" download>Télécharger WAV et scène</a>}{onLivraisons && <button className={BOUTON} onClick={onLivraisons}>Livrer au jeu</button>}</footer>
      {afficherLivraison && <ApercuLivraisonSon projet={projet} son={son} onLivraisons={onLivraisons} />}
    </>}
  </section>
}
