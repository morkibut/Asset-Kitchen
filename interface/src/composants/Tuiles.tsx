import { useEffect, useRef, useState } from "react"
import { api, type Asset, type ApercuLivraison } from "../api"
import { RACCORDS, reglesTuiles, tuiles, type CelluleTuile, type EnsembleTuiles, type ReglesTuiles } from "../api-tuiles"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { FabricationImageLocale } from "./WorkflowsLocaux"
import { Libelle } from "./pieces"

const CHAMP = "rounded-7 border border-contour bg-carte px-[8px] py-[8px] text-[13px] text-encre-controle"
const BOUTON = `${CHAMP} disabled:opacity-50`
const message = (e: unknown) => e instanceof Error ? e.message : "Impossible de garder cet ensemble."

function VignetteTuile({ ensemble, cellule, cote = 54 }: { ensemble: EnsembleTuiles; cellule: Pick<CelluleTuile, "x" | "y">; cote?: number }) {
  const g = ensemble.grille, d = ensemble.source.dimensions, facteur = cote / g.taille
  return <span aria-hidden="true" className="inline-block shrink-0 bg-papier-cote" style={{ width: cote, height: cote, imageRendering: "pixelated", backgroundImage: `url("${ensemble.atlas_url}")`,
    backgroundSize: `${d.largeur*facteur}px ${d.hauteur*facteur}px`, backgroundPosition: `${-(g.marge+cellule.x*(g.taille+g.espacement))*facteur}px ${-(g.marge+cellule.y*(g.taille+g.espacement))*facteur}px` }} />
}

/** Atlas du jeu et carte révisée. La fabrication, la retouche et la livraison
 * restent les gestes ordinaires de l’atelier, avec leurs sources conservées. */
export function Tuiles({ projet, onAsset, onLivraisons }: { projet: string; onAsset?: (a: Asset) => void; onLivraisons?: () => void }) {
  const [liste, setListe] = useState<EnsembleTuiles[]>([])
  const [ouverte, setOuverte] = useState<EnsembleTuiles | null>(null)
  const [nouveau, setNouveau] = useState(false)
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState("")
  useEffect(() => { let vivant = true; setCharge(false); setOuverte(null); setNouveau(false)
    tuiles.lister(projet).then(l => { if (vivant) { setListe(l); setCharge(true) } }).catch(e => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet])
  const garder = (e: EnsembleTuiles) => { setListe(l => [e, ...l.filter(x => x.identifiant !== e.identifiant)]); setOuverte(e); setNouveau(false) }
  return <section className="flex h-full min-h-0 flex-col overflow-auto bg-papier p-[22px] text-encre">
    <div className="flex flex-wrap items-start justify-between gap-[14px]"><div><h1 className="font-serif text-[38px]">Les tuiles</h1><p className="text-[13px] text-encre-3">Un atlas, des terrains et une carte d’essai pour les assembler dans Godot.</p></div><button className={BOUTON} onClick={() => { setNouveau(true); setOuverte(null) }}>Nouvel ensemble</button></div>
    {erreur && <p role="alert" className="mt-[14px] text-echec">{erreur}</p>}
    <div className="my-[14px] flex flex-wrap gap-[8px]">{liste.map(e => <button key={e.identifiant} className={`${BOUTON} ${ouverte?.identifiant === e.identifiant ? "border-encre" : ""}`} onClick={() => { setOuverte(e); setNouveau(false) }}>{e.nom} · {e.retenues} tuiles · r{e.revision}</button>)}</div>
    {!charge && !erreur && <p role="status">Lecture des ensembles…</p>}
    {charge && !liste.length && !nouveau && <p className="text-[13px]">Commencez par importer ou fabriquer une image d’atlas. Choisissez ensuite les tuiles utiles et peignez une carte pour vérifier leurs raccords.</p>}
    {nouveau && <NouvelEnsemble projet={projet} onGarder={garder} onFermer={() => setNouveau(false)} />}
    {ouverte && <EditeurTuiles key={ouverte.identifiant} ensemble={ouverte} onGarder={garder} onAsset={onAsset} onLivraisons={onLivraisons} />}
  </section>
}

function NouvelEnsemble({ projet, onGarder, onFermer }: { projet: string; onGarder: (e: EnsembleTuiles) => void; onFermer: () => void }) {
  const [nom, setNom] = useState("")
  const [image, setImage] = useState<Asset | null>(null)
  const [grille, setGrille] = useState({ taille: 16, marge: 0, espacement: 0 })
  const [bibliotheque, setBibliotheque] = useState(false)
  const [fabriquer, setFabriquer] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const fichier = useRef<HTMLInputElement>(null)
  const choisir = (a: Asset) => { if (a.projet !== projet) { setErreur("Choisissez une image de ce jeu."); return }; setImage(a); setBibliotheque(false); setFabriquer(false); setErreur("") }
  async function agir(f: () => Promise<void>) { setOccupe(true); setErreur(""); try { await f() } catch (e) { setErreur(message(e)) } finally { setOccupe(false) } }
  return <div className="rounded-8 border border-trait bg-carte p-[22px]">
    <h2 className="font-serif text-[25px]">Préparer l’atlas</h2><p className="my-[8px] text-[13px] text-encre-3">Tuiles carrées en vue orthogonale. La grille reste fixe dans cet ensemble ; un atlas de dimensions différentes mérite un nouvel ensemble.</p>
    {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    <fieldset disabled={occupe} className="flex flex-wrap items-start gap-[14px]">
      <label className="flex flex-col gap-[4px]">Nom de l’ensemble<input className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} placeholder="Sous-bois, ruines…" /></label>
      <div className="flex flex-wrap gap-[8px]"><button className={BOUTON} onClick={() => fichier.current?.click()}>Importer un atlas</button><button className={BOUTON} onClick={() => setBibliotheque(true)}>Choisir en bibliothèque</button><button className={BOUTON} onClick={() => setFabriquer(true)}>Fabriquer un atlas par IA</button></div>
      <input ref={fichier} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void agir(async () => { const r = await api.televerser(f, { traiter: false }); const a = r.asset || r.doublon; if (a) choisir(a) }); e.target.value = "" }} />
      {image && <div className="flex items-start gap-[14px]"><img src={api.fichier(image.identifiant)} alt="Atlas choisi" className="h-[128px] w-[128px] object-contain" style={{ imageRendering: "pixelated" }} /><p className="text-[12px]">{image.largeur} × {image.hauteur} px<br />L’image reste conservée en bibliothèque.</p></div>}
      <div className="flex flex-wrap gap-[14px]">{([['taille', 'Taille de tuile'], ['marge', 'Marge extérieure'], ['espacement', 'Espacement']] as const).map(([cle, titre]) => <label key={cle} className="flex flex-col gap-[4px]">{titre} · px<input type="number" className={`${CHAMP} w-[128px]`} min={cle === 'taille' ? 2 : 0} max={cle === 'taille' ? 512 : cle === 'marge' ? 1024 : 256} value={grille[cle]} onChange={e => setGrille(g => ({ ...g, [cle]: Number(e.target.value) }))} /></label>)}</div>
      <button disabled={!image || !nom.trim()} className={BOUTON} onClick={() => void agir(async () => { if (image) onGarder(await tuiles.creer(projet, { nom, image: image.identifiant, grille })) })}>Créer l’ensemble</button><button className={BOUTON} onClick={onFermer}>Fermer</button>
    </fieldset>
    {bibliotheque && <BibliothequePourImage onChoisir={choisir} onFermer={() => setBibliotheque(false)} />}
    {fabriquer && <FabricationImageLocale projet={projet} onAsset={id => void agir(async () => choisir(await api.lireAsset(id)))} onFermer={() => setFabriquer(false)} />}
  </div>
}

function EditeurTuiles({ ensemble: e, onGarder, onAsset, onLivraisons }: { ensemble: EnsembleTuiles; onGarder: (e: EnsembleTuiles) => void; onAsset?: (a: Asset) => void; onLivraisons?: () => void }) {
  const [regles, setRegles] = useState<ReglesTuiles>(() => reglesTuiles(e))
  const [selection, setSelection] = useState(0)
  const [filtre, setFiltre] = useState("")
  const [nomTerrain, setNomTerrain] = useState("")
  const [couleur, setCouleur] = useState(() => getComputedStyle(document.documentElement).getPropertyValue("--color-apercu-herbe").trim())
  const [gomme, setGomme] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [bibliotheque, setBibliotheque] = useState(false)
  const [revision, setRevision] = useState(e.revision)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [livraison, setLivraison] = useState<ApercuLivraison | null>(null)
  const [publie, setPublie] = useState(false)
  const [extraite, setExtraite] = useState<Asset | null>(null)
  const cellule = regles.cellules[selection] || regles.cellules[0]
  const modifie = JSON.stringify(regles) !== JSON.stringify(reglesTuiles(e))
  const brouillon = useBrouillonLocal({ cle: `tuiles:${e.projet}:${e.identifiant}`, pret: true, reference: reglesTuiles(e), etat: regles, appliquer: setRegles })
  useEffect(() => { setRegles(reglesTuiles(e)); setRevision(e.revision); setLivraison(null); setPublie(false) }, [e])
  function changer(r: ReglesTuiles) { setRegles(r); setLivraison(null); setPublie(false) }
  const changerCellule = (r: Partial<CelluleTuile>) => changer({ ...regles, cellules: regles.cellules.map((c, i) => i === selection ? { ...c, ...r } : c) })
  async function agir(f: () => Promise<void>) { setOccupe(true); setErreur(""); try { await f() } catch (er) { setErreur(message(er)) } finally { setOccupe(false) } }
  function peindre(x: number, y: number) {
    const cases = regles.carte.cases.filter(c => c.x !== x || c.y !== y)
    if (!gomme) cases.push({ x, y, tuile_x: cellule.x, tuile_y: cellule.y })
    changer({ ...regles, carte: { ...regles.carte, cases } })
  }
  function dimension(cle: 'largeur' | 'hauteur', v: number) {
    const carte = { ...regles.carte, [cle]: Math.max(1, Math.min(64, Math.round(v || 1))) }
    carte.cases = carte.cases.filter(c => c.x < carte.largeur && c.y < carte.hauteur)
    changer({ ...regles, carte })
  }
  return <div className="flex flex-col gap-[14px]">
    <AvisBrouillon brouillon={brouillon} />
    <div className="flex flex-wrap items-center gap-[8px]"><input aria-label="Nom de l’ensemble" className={CHAMP} value={regles.nom} onChange={ev => changer({ ...regles, nom: ev.target.value })} /><span className="text-[12px] text-encre-3">Révision {e.revision} · {e.grille.taille} px · {regles.cellules.filter(c => c.retenue).length} retenues</span><button className={BOUTON} disabled={occupe || !modifie} onClick={() => void agir(async () => onGarder(await tuiles.garder(e.projet, e.identifiant, e.revision, regles)))}>Garder les changements</button>
      <button className={BOUTON} disabled={occupe || modifie} onClick={() => void agir(async () => onGarder(await tuiles.garder(e.projet, e.identifiant, e.revision, regles, true)))}>Actualiser les images retouchées</button>
      <label className="text-[12px]">Révision à retrouver <select className={CHAMP} value={revision} onChange={ev => setRevision(Number(ev.target.value))}>{e.historique.map(r => <option key={r} value={r}>r{r}</option>)}</select></label><button className={BOUTON} disabled={occupe || modifie || revision === e.revision} onClick={() => void agir(async () => onGarder(await tuiles.restaurer(e.projet, e.identifiant, e.revision, revision)))}>Restaurer</button>
    </div>
    {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    <div className="grid grid-cols-2 items-start gap-[22px]">
      <section className="min-w-0 rounded-8 border border-trait bg-carte p-[14px]">
        <h2 className="font-serif text-[25px]">Les tuiles de l’atlas</h2><p className="my-[8px] text-[12px] text-encre-3">Choisissez une tuile pour la nommer, définir ses raccords et la peindre sur la carte.</p>
        <div className="mb-[14px] flex gap-[8px]"><input className={CHAMP} placeholder="Filtrer les tuiles…" aria-label="Filtrer les tuiles" value={filtre} onChange={ev => setFiltre(ev.target.value)} /><button className={BOUTON} onClick={() => changer({ ...regles, cellules: regles.cellules.map(c => ({ ...c, retenue: true })) })}>Tout retenir</button></div>
        <div className="flex max-h-[300px] flex-wrap gap-[8px] overflow-auto">{regles.cellules.map((c, i) => c.nom.toLowerCase().includes(filtre.toLowerCase()) && <button key={`${c.x},${c.y}`} className={`flex flex-col items-center gap-[4px] rounded-7 border p-[8px] text-[11px] ${selection === i ? 'border-encre bg-papier-cote' : 'border-trait'}`} aria-pressed={selection === i} onClick={() => { setSelection(i); setExtraite(null) }}><VignetteTuile ensemble={e} cellule={c} /><span>{c.nom}</span><span>{c.retenue ? 'Retenue' : 'À juger'}{c.correction ? ' · retouchée' : ''}</span></button>)}</div>
        <div className="mt-[14px] flex flex-wrap gap-[8px]"><input aria-label="Nom de la tuile" className={CHAMP} value={cellule.nom} onChange={ev => changerCellule({ nom: ev.target.value })} /><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={cellule.retenue} onChange={ev => changerCellule({ retenue: ev.target.checked })} />Retenir cette tuile</label></div>
        <div className="mt-[14px] flex flex-wrap gap-[8px]"><button className={BOUTON} disabled={occupe || modifie} onClick={() => void agir(async () => { const r = await tuiles.extraire(e.projet, e.identifiant, cellule.x, cellule.y, e.revision); setExtraite(r.asset) })}>Extraire pour retoucher</button><button className={BOUTON} disabled={occupe} onClick={() => setBibliotheque(true)}>Choisir une correction</button>{cellule.correction && <button className={BOUTON} onClick={() => changerCellule({ correction: null })}>Retrouver la tuile d’origine</button>}</div>
        {extraite && <div className="mt-[8px] flex flex-wrap items-center gap-[8px] text-[12px]"><p>Copie créée dans la bibliothèque.</p>{onAsset && <button className={BOUTON} onClick={() => onAsset(extraite)}>Ouvrir la retouche</button>}<button className={BOUTON} onClick={() => { changerCellule({ correction: extraite.identifiant }); setExtraite(null) }}>Utiliser cette image comme correction</button></div>}
        <p className="mt-[8px] text-[12px] text-encre-3">Une correction doit garder {e.grille.taille} × {e.grille.taille} pixels. Après une retouche, « Actualiser les images retouchées » crée une nouvelle révision ; les précédentes restent intactes.</p>
        <h3 className="mt-[22px] font-serif text-[25px]"><Libelle aide="tuiles.terrains">Terrains et raccords</Libelle></h3>
        <div className="my-[8px] flex flex-wrap gap-[8px]"><input className={CHAMP} aria-label="Nom du terrain" placeholder="Nom du terrain…" value={nomTerrain} onChange={ev => setNomTerrain(ev.target.value)} /><input type="color" aria-label="Couleur du terrain" value={couleur} onChange={ev => setCouleur(ev.target.value)} /><button className={BOUTON} disabled={!nomTerrain.trim() || regles.terrains.length >= 32} onClick={() => { changer({ ...regles, terrains: [...regles.terrains, { identifiant: `terrain-${crypto.randomUUID()}`, nom: nomTerrain.trim(), couleur }] }); setNomTerrain('') }}>Ajouter le terrain</button></div>
        <div className="grid grid-cols-3 gap-[8px]">{(['centre', ...RACCORDS] as const).map(r => <label key={r} className="flex flex-col gap-[4px] text-[12px]">{r}<select className={CHAMP} value={(r === 'centre' ? cellule.terrain : cellule.raccords[r]) || ''} onChange={ev => r === 'centre' ? changerCellule({ terrain: ev.target.value || null }) : changerCellule({ raccords: { ...cellule.raccords, [r]: ev.target.value || null } })}><option value="">Vide / sans terrain</option>{regles.terrains.map(t => <option value={t.identifiant} key={t.identifiant}>{t.nom}</option>)}</select></label>)}</div>
        <button className={`${BOUTON} mt-[8px]`} onClick={() => changerCellule({ raccords: Object.fromEntries(RACCORDS.map(r => [r, cellule.terrain])) as CelluleTuile['raccords'] })}>Même terrain sur tous les raccords</button>
      </section>
      <section className="min-w-0 rounded-8 border border-trait bg-carte p-[14px]">
        <h2 className="font-serif text-[25px]">La carte d’essai</h2><p className="my-[8px] text-[12px] text-encre-3">Cliquez ou faites glisser pour peindre la tuile choisie. Vérifiez les répétitions, les coins et la transparence avant de livrer.</p>
        <div className="mb-[14px] flex flex-wrap items-center gap-[8px]">{(['largeur', 'hauteur'] as const).map(c => <label className="text-[12px]" key={c}>{c}<input className={`${CHAMP} ml-[4px] w-[54px]`} type="number" min={1} max={64} value={regles.carte[c]} onChange={ev => dimension(c, Number(ev.target.value))} /></label>)}<button className={BOUTON} aria-pressed={gomme} onClick={() => setGomme(v => !v)}>{gomme ? 'Gomme active' : 'Gommer'}</button><label className="text-[12px]">Zoom<select className={CHAMP} value={zoom} onChange={ev => setZoom(Number(ev.target.value))}>{[0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v*100} %</option>)}</select></label></div>
        <div className="max-h-[300px] overflow-auto bg-papier-cote"><div className="grid w-max select-none" style={{ gridTemplateColumns: `repeat(${regles.carte.largeur}, ${Math.max(8, e.grille.taille)*zoom}px)` }} onDragStart={ev => ev.preventDefault()}>{Array.from({ length: regles.carte.largeur*regles.carte.hauteur }, (_, i) => { const x = i % regles.carte.largeur, y = Math.floor(i / regles.carte.largeur), caseCarte = regles.carte.cases.find(c => c.x === x && c.y === y); return <button key={i} type="button" aria-label={`Case ${x+1}, ${y+1}${caseCarte ? ' peinte' : ' vide'}`} className="flex overflow-hidden border border-trait focus-visible:outline focus-visible:outline-encre" style={{ width: Math.max(8, e.grille.taille)*zoom, height: Math.max(8, e.grille.taille)*zoom }} onClick={() => peindre(x, y)} onPointerEnter={ev => { if (ev.buttons === 1) peindre(x, y) }}>{caseCarte && <VignetteTuile ensemble={e} cellule={{ x: caseCarte.tuile_x, y: caseCarte.tuile_y }} cote={Math.max(8, e.grille.taille)*zoom} />}</button> })}</div></div>
        <p className="mt-[14px] text-[12px] text-encre-3">{modifie ? 'Gardez les changements pour calculer le diagnostic et exporter cette carte.' : e.diagnostic.limite}</p>
        {!modifie && <><ul className="mt-[8px] list-inside list-disc text-[12px] text-encre-attention">{e.diagnostic.problemes.map(p => <li key={p}>{p}</li>)}</ul>{e.diagnostic.pret && <p className="mt-[8px] text-[13px] text-ok">Les tuiles retenues et les raccords déclarés sont cohérents.</p>}{e.diagnostic.raccords.map((r, i) => <p key={i} className="text-[12px] text-encre-attention">Case {r.x+1}, {r.y+1} vers {r.vers} : {r.raison}</p>)}</>}
        <div className="mt-[22px] flex flex-wrap gap-[8px]">{!modifie && e.diagnostic.pret && <a className={BOUTON} href={tuiles.archive(e.projet, e.identifiant, e.revision)}>Télécharger le paquet Godot</a>}<button className={BOUTON} disabled={occupe || modifie || !e.diagnostic.pret} onClick={() => void agir(async () => { setLivraison(await tuiles.prevoir(e.projet, e.identifiant, e.revision)); setPublie(false) })}>Relire la livraison Godot</button>{onLivraisons && <button className={BOUTON} onClick={onLivraisons}>Projet Godot et historique</button>}</div>
        <p className="mt-[8px] text-[12px] text-encre-3">Godot 4.3 ou plus récent : atlas PNG, TileSet avec terrains, carte TileMapLayer et provenance. Aucun appel IA pour exporter ou changer de carte.</p>
        {livraison && <div className="mt-[14px] rounded-7 border border-contour p-[14px]"><h3 className="font-serif text-[25px]">Relire les fichiers</h3><p className="break-all text-[12px]">{livraison.dossier}</p><ul className="my-[8px] space-y-[4px] text-[12px]">{livraison.fichiers.map(f => <li key={f.chemin} className="break-all">{f.role} · {f.etat}<br />{f.chemin}</li>)}</ul>{livraison.conflits.map(c => <p key={c.chemin} className="text-[12px] text-echec">{c.chemin} : {c.raison}</p>)}{publie ? <p role="status" className="break-all text-[13px]">Livraison terminée. Ouvrez {livraison.scene} dans Godot.</p> : <button className={BOUTON} disabled={occupe || !livraison.pret} onClick={() => void agir(async () => { await api.livrerGodot(e.projet, livraison.jeton); setPublie(true) })}>Déposer ces fichiers dans Godot</button>}</div>}
      </section>
    </div>
    {bibliotheque && <BibliothequePourImage onFermer={() => setBibliotheque(false)} onChoisir={a => { if (a.projet !== e.projet) { setErreur('Choisissez une image de ce jeu.'); return }; changerCellule({ correction: a.identifiant }); setBibliotheque(false) }} />}
  </div>
}
