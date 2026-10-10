import { useEffect, useRef, useState } from "react"
import { ApercuLivraisonSon } from "./ApercuLivraisonSon"
import { ReglagesSon } from "./ReglagesSon"
import { moteursSonores, type MoteurSonore } from "../api-workflows"
import { FAMILLES_AVEC_LUFS, NOMS_FAMILLES_SON, sons, type FamilleSon, type JugementSon, type OndeSon, type RecetteSon, type Son } from "../api-sons"
import { dureeEnClair } from "../api"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]"
const FAMILLES: FamilleSon[] = ["bruitage", "interface", "ambiance", "musique", "chanson", "jingle", "voix"]
const erreurDe = (e: unknown) => e instanceof Error ? e.message : "Le son n’a pas pu être conservé."

type ProvenanceLisible = { moteur: string | null; graine: string | null; texte: string | null; serie: string | null }

/** Le nom en clair d'un moteur sonore par son identifiant, lu sur le même
 *  catalogue que la page « Moteurs » (`GET /workflow-profiles/sound-engines`,
 *  MO4) — jamais une table écrite ici (MO7). Un moteur qui a disparu du
 *  catalogue depuis (une provenance ancienne) replie sur son identifiant brut,
 *  plutôt qu'un nom introuvable. */
function nomMoteurSonore(catalogue: MoteurSonore[], identifiant: string): string {
  return catalogue.find((m) => m.identifiant === identifiant)?.nom ?? identifiant
}

/** Ce que la provenance brute d'un son dit à un auteur, en clair : le moteur
 *  qui l'a fabriqué, sa graine, le texte parti, la série dont il vient — pas
 *  une clé hachée (`sfxr:<sha256>:graine`) ni un identifiant de série. Le
 *  document complet reste replié à côté, pour qui en a vraiment besoin. */
function provenanceLisible(brut: Record<string, unknown>, catalogueSon: MoteurSonore[]): ProvenanceLisible {
  const envoi = brut.envoi && typeof brut.envoi === "object" ? brut.envoi as Record<string, unknown> : {}
  const composition = brut.composition && typeof brut.composition === "object" ? brut.composition as Record<string, unknown> : {}
  const serie = brut.serie && typeof brut.serie === "object" ? brut.serie as Record<string, unknown> : null
  let moteur: string | null = null
  if (brut.nature === "sfxr") moteur = "sfxr, calculé sans IA"
  else if (brut.nature === "import") moteur = "Son importé"
  else if (typeof brut.modele === "string" && brut.modele.includes("@")) moteur = nomMoteurSonore(catalogueSon, brut.modele.replace(/^ComfyUI:/, "").split("@")[0])
  const graineBrute = envoi.graine ?? brut.graine
  const texteBrut = envoi.prompt ?? composition.texte
  return {
    moteur,
    graine: graineBrute != null ? String(graineBrute) : null,
    texte: typeof texteBrut === "string" && texteBrut ? texteBrut : null,
    serie: serie ? `série ${String(serie.identifiant ?? "")}${serie.rang != null ? `, tirage ${serie.rang}` : ""}` : null,
  }
}

/** Coupe un nom sur un mot entier plutôt qu'en plein milieu — jamais la
 *  demande entière en titre (RV13). Le nom complet reste lisible au survol
 *  (`title`) et dans le champ « Nom » plus bas. */
function nomCourt(nom: string): string {
  const t = nom.trim()
  if (t.length <= 42) return t
  const coupe = t.slice(0, 42)
  const dernierEspace = coupe.lastIndexOf(" ")
  return (dernierEspace > 20 ? coupe.slice(0, dernierEspace) : coupe).trimEnd() + "…"
}

/** Le titre court d'un son ouvert (RV13) — « Musique · mine des nains » : la
 *  famille, quand elle est posée, se lit devant le nom coupé. Sans famille, le
 *  nom coupé seul — la liste des sons, elle, montre déjà la famille sur sa
 *  ligne de mesures, et la répéter dans le titre de chaque carte serait la
 *  dire deux fois. */
function titreCourtSon(s: { nom: string; famille: FamilleSon | null }): string {
  const court = nomCourt(s.nom)
  return s.famille ? `${NOMS_FAMILLES_SON[s.famille]} · ${court}` : court
}

/** Le lecteur joue le WAV de la version conservée, celui qui sera livré. */
// **Un seul bouton rouille par écran** (`docs/DESIGN.md`), et ce fichier porte
// deux écrans qui ne s'affichent jamais ensemble : le jeu sans aucun son, dont
// le geste est « Fabriquer un son », et un son ouvert, dont le geste est de
// conserver ses réglages. Une seule déclaration pour les deux.
const ROUILLE = "border-signal bg-signal text-encre-sur-signal"

export function AtelierSon({ projet, identifiantInitial, onLivraisons, onFabriquer }: {
  projet: string; identifiantInitial?: string
  /** Vers l'écran unique « Livrer au jeu » (`RV8`), filtré sur le son ouvert
   *  quand il y en a un. */
  onLivraisons?: (son?: string) => void
  onFabriquer?: () => void
}) {
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
  // MO4/MO7 : le nom d'un moteur sonore vient du catalogue (`GET
  // /workflow-profiles/sound-engines`), jamais d'une table écrite ici.
  const [catalogueSon, setCatalogueSon] = useState<MoteurSonore[]>([])
  const lecteur = useRef<HTMLAudioElement>(null)
  const modifie = !!son && !!recette && (nom !== son.nom || JSON.stringify(recette) !== JSON.stringify(son.recette))
  const installer = (s: Son) => { setSon(s); setRecette(s.recette); setNom(s.nom); setPosition(0); setChoisirFamille(false); setAfficherLivraison(false) }
  const faire = async (action: () => Promise<void>) => { setOccupe(true); setErreur(""); try { await action() } catch (e) { setErreur(erreurDe(e)) } finally { setOccupe(false) } }
  useEffect(() => { let actif = true; setSon(null); sons.lister(projet).then(v => { if (actif) setListe(v) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); if (identifiantInitial) sons.lire(projet, identifiantInitial).then(s => { if (actif) installer(s) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); return () => { actif = false } }, [projet, identifiantInitial])
  useEffect(() => { let actif = true; moteursSonores.lister().then(r => { if (actif) setCatalogueSon(r.moteurs) }).catch(() => {}); return () => { actif = false } }, [])
  useEffect(() => { let actif = true; setOnde(null); if (son?.mesures) sons.onde(son, brut).then(o => { if (actif) setOnde(o) }).catch(e => { if (actif) setErreur(erreurDe(e)) }); return () => { actif = false } }, [son, brut])
  // **L'avertissement d'abandon ne couvre plus la sortie du lieu** (RT8, 20
  // septembre 2026). Il tenait à un bouton « Fermer » du dialogue plein écran ;
  // depuis que *Les sons* est une surface normale, on en sort par la navigation
  // de gauche, qui n'appartient pas à cet écran et ne lui demande rien. Le
  // garde-fou subsiste où il est encore atteignable : « Tous les sons », l'ouverture
  // d'un autre son, l'import, et le rechargement de la page ci-dessous.
  // Le reprendre sur la navigation demanderait un garde global au parent —
  // une capacité, pas une correction : c'est écrit dans le critère de RT8.
  useEffect(() => { if (!modifie) return; const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload", avertir); return () => window.removeEventListener("beforeunload", avertir) }, [modifie])
  const changer = <K extends keyof RecetteSon>(cle: K, valeur: RecetteSon[K]) => { setRecette(r => r && { ...r, [cle]: valeur }) }
  const rafraichir = async (s: Son) => { installer(s); setListe(await sons.lister(projet)) }
  const ouvrir = (s: Son) => { if (!modifie || window.confirm("Abandonner les réglages non conservés de ce son ?")) installer(s) }
  const poserFamille = (famille: FamilleSon) => { if (!son) return; void faire(async () => rafraichir(await sons.classer(son, famille))) }
  const appliquerReglagesFamille = () => { if (!son || !son.famille) return; void faire(async () => rafraichir(await sons.classer(son, son.famille, true))) }
  const recetteProposeeDiffere = !!son?.recette_proposee && !!recette && JSON.stringify(son.recette_proposee) !== JSON.stringify(recette)
  // **Le titre court, et ce qu'il ne montre plus** (RV13). Le titre d'écran
  // ne doit jamais être la demande entière ; ce qui manque — le nom coupé, ou
  // une demande anglaise différente du nom — doit rester lisible juste en
  // dessous. **Jamais pour la seule famille ajoutée devant** : elle ne cache
  // rien, le nom reste entier derrière elle, et répéter « Épée » sous
  // « Bruitage · Épée » ne dirait rien de plus.
  //
  // `provenanceLisible` a déjà replié la demande anglaise une fois, pour
  // « Source et provenance » plus bas dans l'écran (`texte`, l'envoi tel
  // qu'il est vraiment parti) : elle prime quand elle diffère du nom — un son
  // renommé peut dire autre chose que ce qui est vraiment parti au moteur.
  // Sans elle, le nom sert de repli, et seulement s'il a été tronqué.
  const titreAffiche = son ? titreCourtSon(son) : "Les sons"
  const provenanceTexte = son ? provenanceLisible(son.provenance, catalogueSon).texte : null
  const demandeVisible = !son ? null
    : provenanceTexte && provenanceTexte !== son.nom ? provenanceTexte
    : nomCourt(son.nom) !== son.nom ? son.nom
    : null
  return <main data-etabli aria-label="Les sons" className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier">
    {/* **Les mêmes marges que les autres pages** (RV13, `docs/DESIGN.md` §
        Spacing) : 30 de marge, 22 de haut et de bas. L'écran n'avait aucun
        padding et collait au bord du châssis — la seule page du produit dans
        ce cas, mesuré en relisant `PageDuSujet.tsx`, qui pose exactement ce
        gabarit pour la même forme d'écran (« une page », `docs/DESIGN.md` §
        Layout). */}
    <div className="defile flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-[30px] pt-[22px] pb-[22px]">
    <header className="flex items-start justify-between gap-[14px]"><div><h1 className="font-serif text-[38px]" title={son ? son.nom : undefined}>{titreAffiche}</h1>{demandeVisible && <p className="mt-[4px] text-[12px] text-encre-4">{demandeVisible}</p>}<p className="mt-[8px] text-[13px] text-encre-3">Écouter, ajuster et conserver les sons du jeu. La source reste toujours disponible.</p></div><div className="flex gap-[8px]"><label className={`${BOUTON} inline-flex items-center cursor-pointer`}>Importer un son<input aria-label="Importer un son" type="file" accept="audio/*,.wav,.ogg,.mp3" hidden disabled={occupe} onChange={e => { const f = e.target.files?.[0]; if (f && (!modifie || window.confirm("Abandonner les réglages non conservés ?"))) void faire(async () => rafraichir(await sons.importer(projet, f))); e.target.value = "" }} /></label></div></header>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!son ? (liste.length
      ? <div className="grid grid-cols-2 gap-[14px]">{liste.map(s => <button key={s.identifiant} className="rounded-8 border border-trait bg-carte p-[22px] text-left" onClick={() => ouvrir(s)}><span className="font-serif text-[25px]" title={s.nom}>{nomCourt(s.nom)}</span><span className="mt-[8px] block text-[13px] text-encre-3">{s.mesures ? `${dureeEnClair(s.mesures.duree)} · ${s.mesures.canaux === 2 ? "stéréo" : "mono"}` : "Source à vérifier"} · {s.versions.length} version{s.versions.length > 1 ? "s" : ""}{s.famille ? ` · ${NOMS_FAMILLES_SON[s.famille]}` : ""}</span>{s.raison && <span className="mt-[8px] block text-[12px] text-echec">{s.raison}</span>}</button>)}</div>
      // **Le vide se déclare** (`RT8`) : ce jeu n'a encore aucun son, et
      // plutôt qu'une grille sans rien dedans — la panne signalée le 20
      // septembre, « une fenêtre immense sans menu ni rien autour » — une
      // phrase courte dit l'absence et les deux gestes possibles.
      // Le 21 septembre, l'auteur a demandé mieux qu'une phrase : le geste de
      // fabrication, au centre, là où l'œil tombe sur un écran vide.
      : <div className="flex flex-col items-center gap-[14px] rounded-8 border border-trait bg-carte px-[22px] py-[54px] text-center"><p className="text-[13px] text-encre-3">Ce jeu n’a encore aucun son.</p>{onFabriquer && <button className={`${BOUTON} ${ROUILLE}`} onClick={onFabriquer}>Fabriquer un son</button>}<p className="text-[12px] text-encre-3">ou importez un fichier audio avec le bouton en haut à droite.</p></div>
    ) : recette && <>
      <div className="flex flex-wrap items-center gap-[14px]"><button className={BOUTON} onClick={() => { if (!modifie || window.confirm("Abandonner les réglages non conservés ?")) setSon(null) }}>Tous les sons</button><label className="text-[13px]">Version <select aria-label="Version du son" className={CHAMP} value={son.revision} disabled={occupe || modifie} onChange={e => void faire(async () => installer(await sons.lire(projet, son.identifiant, Number(e.target.value))))}>{son.versions.map(v => <option key={v.revision} value={v.revision}>Version {v.revision} · {v.jugement === "retenue" ? "retenue" : v.jugement === "ecartee" ? "écartée" : "à juger"}</option>)}</select></label><select aria-label="Jugement du son" className={CHAMP} value={son.jugement} disabled={occupe || modifie} onChange={e => void faire(async () => rafraichir(await sons.juger(son, e.target.value as JugementSon)))}><option value="a-juger">À juger</option><option value="retenue" disabled={!son.pret}>Retenue</option><option value="ecartee">Écartée</option></select>{son.revision !== son.revision_courante && <button className={BOUTON} disabled={occupe} onClick={() => void faire(async () => rafraichir(await sons.restaurer(son)))}>Restaurer dans une nouvelle version</button>}</div>
      {son.raison && <p className="rounded-8 border border-trait bg-carte p-[14px] text-[13px] text-echec">{son.raison}</p>}
      {son.avertissements.length > 0 && <ul className="space-y-[4px] rounded-8 border border-trait bg-carte p-[14px] text-[13px] text-encre-attention">{son.avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      <div className="flex flex-wrap items-center gap-[8px] text-[13px]">
        <span className="text-encre-3">Famille</span>
        {son.famille ? <span className="rounded-7 border border-trait bg-carte px-[8px] py-[4px]">{NOMS_FAMILLES_SON[son.famille]}</span> : <span className="text-encre-3">aucune — choisis-en une pour qu’il se livre en fichier prêt pour le jeu.</span>}
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
          <p className="text-[12px] text-encre-3">{modifie ? "Réglages modifiés : conserve une version pour entendre le nouveau rendu." : "Tu écoutes la version conservée. Le WAV livré contient exactement ce signal."}</p>
          <label className="flex flex-col gap-[8px] text-[13px]">Nom<input className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} /></label>
          <details className="text-[13px]"><summary className="cursor-pointer">Source et provenance</summary><p className="mt-[8px]">{son.source.nom} · {(son.source.octets / 1024).toFixed(1)} Ko</p>
            {(() => { const p = provenanceLisible(son.provenance, catalogueSon); const rien = !p.moteur && !p.graine && !p.texte && !p.serie
              return rien ? null : <dl className="mt-[8px] grid grid-cols-[max-content_1fr] gap-x-[8px] gap-y-[4px] text-[12px] text-encre-3">
                {p.moteur && <><dt>Moteur</dt><dd>{p.moteur}</dd></>}
                {p.graine && <><dt>Graine</dt><dd>{p.graine}</dd></>}
                {p.texte && <><dt>Texte parti</dt><dd className="whitespace-pre-wrap">{p.texte}</dd></>}
                {p.serie && <><dt>Série</dt><dd>{p.serie}</dd></>}
              </dl> })()}
            <details className="mt-[8px]"><summary className="cursor-pointer text-[12px] text-encre-3">Document brut</summary><pre className="mt-[8px] overflow-auto whitespace-pre-wrap text-[12px]">{JSON.stringify(son.provenance, null, 2)}</pre></details>
            <a className="mt-[8px] block underline" href={sons.source(son)} download>Télécharger la source intacte</a></details>
        </div>
        <aside className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
          <h2 className="font-serif text-[25px]">Régler</h2>
          <ReglagesSon son={son} recette={recette} mesures={son.mesures} famille={son.famille} occupe={occupe} onChange={changer} />
        </aside>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center gap-[14px] border-t border-trait bg-papier py-[14px]"><button className={`${BOUTON} ${ROUILLE}`} disabled={occupe || !modifie || son.revision !== son.revision_courante} onClick={() => void faire(async () => rafraichir(await sons.regler(son, recette, nom)))}>Conserver une version</button>{modifie && <button className={BOUTON} onClick={() => installer(son)}>Abandonner les réglages</button>}<button className={BOUTON} disabled={occupe || modifie || !son.pret || son.jugement === "ecartee"} onClick={() => setAfficherLivraison(v => !v)}>Relire la livraison Godot</button>{son.pret && !modifie && <a href={sons.archive(son)} className="text-[13px] underline" download>Télécharger WAV et scène</a>}{onLivraisons && <button className={BOUTON} onClick={() => onLivraisons(son.identifiant)}>Livrer au jeu</button>}</footer>
      {afficherLivraison && <ApercuLivraisonSon projet={projet} son={son} onLivraisons={onLivraisons} />}
    </>}
    </div>
  </main>
}
