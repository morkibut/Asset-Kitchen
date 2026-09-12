import { useEffect, useState } from "react"
import { api, dollars, type Asset, type Modele, type Piece } from "../api"
import { apiCalques, type CheminEmploi, type CibleCalque } from "../api-calques"
import { equipements, type DemandeEquipement, type OuvrirCalque, type TravailEquipement } from "../api-travaux-equipement"
import { vignetteAsset } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const ACTION = "h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50"
const ETATS = { prepare: "À relire", en_cours: "Fabrication en cours", a_reprendre: "Suivi interrompu", a_verifier: "Résultats à vérifier", externe_inconnu: "Acceptation à vérifier", termine: "Images équipées reçues", annule: "Fabrication arrêtée" }
const message = (e: unknown) => e instanceof Error ? e.message : "Impossible de relire cette fabrication."
const montant = (n: number | null, unite: string | null) => n === null ? "Consommation encore non mesurée" : !unite || unite === "usd" ? dollars(n) : `${n} ${unite}`

/** La relecture est l'envoi enregistré ; rééditer crée une nouvelle demande.
 * Fermer le dialogue ne ferme pas le suivi du serveur. */
export function RelectureEquipement({ chemin, initiale, cibles, nomPiece, piece, onFermer, onCalque }: {
  chemin: CheminEmploi; initiale?: TravailEquipement; cibles?: CibleCalque[]; nomPiece?: string
  /** La pièce commune telle que la couverture l'a lue. Elle sert à **montrer
   *  ses références avant l'envoi** : le serveur les joint de lui-même
   *  (`atelier/services/travaux_equipement.py`), et l'écran ne les proposait
   *  qu'après la préparation — soit une fois le texte déjà composé. */
  piece?: Piece
  onFermer: () => void; onCalque?: OuvrirCalque
}) {
  const [travail, setTravail] = useState<TravailEquipement | null>(initiale ?? null)
  const [demande, setDemande] = useState<DemandeEquipement>(initiale?.demande ?? { cle: crypto.randomUUID(), modele: "", cibles: cibles ?? null, methode: "planches", cases_par_planche: 4, occupation: .75, prompt: "", repris: false, references: [], options: {}, proportions: "1:1" })
  const [edition, setEdition] = useState(!initiale)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [images, setImages] = useState<Asset[]>([])
  const [chercher, setChercher] = useState(false)
  const [recherche, setRecherche] = useState("")
  const [favoris, setFavoris] = useState(false)
  const [limite, setLimite] = useState(48)
  const [total, setTotal] = useState(0)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [annulation, setAnnulation] = useState(false)
  const [fichesCommunes, setFichesCommunes] = useState<Asset[]>([])
  const modele = modeles.find((m) => m.identifiant === demande.modele)
  const changer = (champs: Partial<DemandeEquipement>) => { setDemande((d) => ({ ...d, ...champs })); setErreur("") }
  const refs = demande.references ?? []
  const ecartees = demande.references_ecartees ?? []
  // **Les références de la pièce, telles qu'elles partiront.** `piece_fiche`
  // les porte dès qu'un travail existe ; avant lui, la couverture les passe.
  // Sans cette liste l'écran annonçait « 0 référence » sur une pièce qui en
  // joignait deux, et l'auteur ne le découvrait qu'après la préparation.
  const communes = (travail?.piece_fiche.references ?? piece?.references ?? []) as readonly string[]
  const cleCommunes = communes.join("|")
  useEffect(() => {
    if (!edition || !cleCommunes) return
    let vivant = true
    Promise.all(cleCommunes.split("|").map((id) => api.lireAsset(id)))
      .then((r) => { if (vivant) setFichesCommunes(r) })
      // La vignette peut manquer ; l'identifiant et la case suffisent à décider.
      .catch(() => { /* la liste reste sans vignette */ })
    return () => { vivant = false }
  }, [edition, cleCommunes])
  useEffect(() => {
    if (!edition) return
    let vivant = true
    api.modeles("1:1", 1 + refs.length).then((r) => { if (vivant) setModeles(r.modeles) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    return () => { vivant = false }
  }, [edition, refs.length])
  useEffect(() => {
    if (!chercher) return
    let vivant = true
    const timer = window.setTimeout(() => { void api.assets({ recherche, favoris, limite }).then((r) => { if (vivant) { setImages(r.assets); setTotal(r.total) } }).catch((e: unknown) => { if (vivant) setErreur(message(e)) }) }, recherche ? 180 : 0)
    return () => { vivant = false; window.clearTimeout(timer) }
  }, [chercher, recherche, favoris, limite])
  useEffect(() => {
    if (!travail || travail.etat !== "en_cours") return
    let vivant = true
    const timer = window.setInterval(() => { void equipements.lire(chemin, travail.identifiant).then((t) => { if (vivant) setTravail(t) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) }) }, 2000)
    return () => { vivant = false; window.clearInterval(timer) }
  }, [chemin, travail?.identifiant, travail?.etat])
  async function agir(geste: () => Promise<TravailEquipement>) {
    setOccupe(true); setErreur("")
    try { const t = await geste(); setTravail(t); setEdition(false) }
    catch (e) { setErreur(message(e)) }
    finally { setOccupe(false) }
  }
  const reedition = () => {
    if (!travail) return
    const corps = travail.demande
    // Le contrat interne de suivi peut ajouter un champ qui n'est pas un réglage.
    const d = { ...corps } as DemandeEquipement & { livrer_provisoire?: boolean }
    delete d.livrer_provisoire
    setDemande({ ...d, cle: crypto.randomUUID(), textes_appels: Object.fromEntries(travail.appels.map((a) => [String(a.numero), a.snapshot.prompt])) }); setEdition(true); setAnnulation(false)
  }
  const titre = `Images équipées · ${nomPiece ?? travail?.piece_fiche.nom ?? "cet équipement"}`
  return <CadreDialogue titre={titre} onFermer={onFermer} enfants={<>
    <header className="flex shrink-0 items-center justify-between gap-[14px] border-b border-trait px-[30px] py-[14px]"><div><h1 className="font-serif text-[38px]">{titre}</h1><p className="mt-[4px] text-[13px] text-encre-3">{edition ? "Préparer l’envoi" : travail ? ETATS[travail.etat] : "Relire avant envoi"} · une pièce, aucune combinaison à générer</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    {erreur && <p role="alert" className="border-b border-trait px-[30px] py-[8px] text-[13px] text-echec">{erreur}</p>}
    <div className="defile min-h-0 flex-1 overflow-y-auto p-[30px]">
      {edition ? <div className="grid grid-cols-2 items-start gap-[22px]">
        <section className="rounded-10 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Les images à équiper</h2><p className="mt-[8px] text-[13px] text-encre-3">{demande.cibles ? `${demande.cibles.length} images sélectionnées` : "Les calques absents sur les versions de base choisies"}. Les corrections existantes seront conservées.</p>
          {demande.cibles && <div className="mt-[14px] flex flex-wrap gap-[8px]">{demande.cibles.map((c, i) => <figure key={`${c.resultat}:${c.prise}`} className="w-[128px]"><img className="damier-papier h-[128px] w-full object-contain" src={apiCalques.imageCible(chemin, c)} alt={`Base ${i + 1}`} /><figcaption className="mt-[4px] text-[11px] text-encre-3">{c.nature === "frame" ? "Frame" : "Image"} {i + 1}</figcaption></figure>)}</div>}
          <label className="mt-[22px] flex flex-col gap-[4px] text-[13px]">Moyen de fabrication<select className={CHAMP} value={demande.methode} onChange={(e) => changer({ methode: e.target.value as "images" | "planches" })}><option value="planches">Plier plusieurs bases dans une planche</option><option value="images">Un appel distinct par image</option></select></label>
          {demande.methode === "planches" && <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Cases par planche<input className={CHAMP} type="number" min="1" step="1" value={demande.cases_par_planche ?? 4} onChange={(e) => changer({ cases_par_planche: Number(e.target.value) })} /></label>}
          <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Place occupée par le corps (%)<input className={CHAMP} type="number" min="1" max="100" value={Math.round((demande.occupation ?? .75) * 100)} onChange={(e) => changer({ occupation: Number(e.target.value) / 100 })} /></label><p className="mt-[8px] text-[12px] text-encre-3">L’espace autour du corps permet à la pièce de dépasser. Le retour sera replacé dans le cadre exact de chaque base.</p>
          <p className="mt-[22px] text-[12px] text-encre-3">Les frames issues d’une vidéo ou d’un modèle 3D passent par ce même pliage 2D. Une graine identique ne garantit pas une vidéo identique.</p>
        </section>
        <section className="rounded-10 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">La méthode et sa demande</h2>
          <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Fournisseur et modèle<select className={CHAMP} value={demande.modele} onChange={(e) => changer({ modele: e.target.value, resolution: null, options: {} })}><option value="">Choisir une méthode</option>{modeles.map((m) => <option key={m.identifiant} value={m.identifiant} disabled={!!m.refus || m.references_max < 1}>{m.identifiant}{m.refus ? ` — ${m.refus}` : m.references_max < 1 ? " — sans image d’entrée" : ""}</option>)}</select></label>
          <p className="mt-[8px] text-[12px] text-encre-3">Format carré 1:1 · une planche de bases obligatoire par appel{modele ? ` · ${modele.references_max} références maximum` : ""}.</p>
          {modele && modele.resolutions.length > 0 && <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Résolution<select className={CHAMP} value={demande.resolution ?? ""} onChange={(e) => changer({ resolution: e.target.value || null })}><option value="">Celle du modèle</option>{modele.resolutions.map((r) => <option key={r}>{r}</option>)}</select></label>}
          {modele && Object.entries(modele.options).map(([cle, o]) => <label key={cle} className="mt-[14px] flex flex-col gap-[4px] text-[13px]">{o.nom}{o.genre === "choix" ? <select className={CHAMP} value={String(demande.options?.[cle] ?? "")} onChange={(e) => changer({ options: { ...demande.options, [cle]: e.target.value } })}><option value="">Réglage du modèle</option>{o.valeurs.map((v) => <option key={v}>{v}</option>)}</select> : o.genre === "booleen" ? <input type="checkbox" checked={!!demande.options?.[cle]} onChange={(e) => changer({ options: { ...demande.options, [cle]: e.target.checked } })} /> : <input className={CHAMP} type="number" min={o.minimum ?? undefined} max={o.maximum ?? undefined} value={String(demande.options?.[cle] ?? "")} onChange={(e) => changer({ options: { ...demande.options, [cle]: Number(e.target.value) } })} />}</label>)}
          {Object.entries(demande.textes_appels ?? {}).map(([n, texte]) => <label key={n} className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Texte exact de l’appel {Number(n) + 1}<textarea className="min-h-[128px] w-full rounded-7 border border-contour bg-papier p-[14px] text-[13px]" value={texte} onChange={(e) => changer({ textes_appels: { ...demande.textes_appels, [n]: e.target.value } })} /></label>)}
          {Object.keys(demande.textes_appels ?? {}).length > 0 && <button className={`${CHAMP} mt-[8px]`} onClick={() => changer({ textes_appels: {} })}>Recomposer les textes depuis la description</button>}
          <label className="mt-[22px] flex flex-col gap-[4px] text-[13px]">Ce qu’il faut ajouter<textarea className="min-h-[128px] w-full rounded-7 border border-contour bg-papier p-[14px] text-[13px]" value={demande.prompt ?? ""} placeholder="Vide : reprendre la description de la pièce et de cet emploi" onChange={(e) => changer({ prompt: e.target.value })} /></label>
          <label className="mt-[8px] flex items-center gap-[8px] text-[12px]"><input type="checkbox" checked={!!demande.repris} onChange={(e) => changer({ repris: e.target.checked })} />Envoyer ce texte exactement, sans composition automatique</label>
          <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">À éviter<input className={CHAMP} value={demande.prompt_negatif ?? ""} onChange={(e) => changer({ prompt_negatif: e.target.value })} /></label>
          <label className="mt-[14px] flex flex-col gap-[4px] text-[13px]">Réservation par appel en dollars<input className={CHAMP} type="number" min="0" step="0.01" placeholder="Utiliser le coût mesuré" value={demande.reservation_par_appel_usd ?? ""} onChange={(e) => changer({ reservation_par_appel_usd: e.target.value === "" ? null : Number(e.target.value) })} /></label><p className="mt-[4px] text-[11px] text-encre-3">Nécessaire au premier appel payant si aucun coût n’est encore mesuré. Ce montant réserve un budget ; il ne plafonne pas la facture du fournisseur.</p>
          {travail && <section className="mt-[22px]"><h3 className="text-[13px]">Images de la relecture précédente</h3><p className="mt-[4px] text-[12px] text-encre-3">Décochez une référence pour la retirer du prochain envoi. Chaque planche de bases reste obligatoire.</p><div className="mt-[8px] flex flex-wrap gap-[14px]">{Array.from(new Map(travail.appels.flatMap((a) => a.references).filter((r) => r.reference && r.reference.role !== "edition").map((r) => [r.reference!.asset, r])).values()).map((r, i) => { const id = r.reference!.asset; return <label key={id} className="w-[128px] text-[12px]"><img src={r.url} alt={`Référence modifiable ${i + 1}`} className="damier-papier h-[128px] w-full object-contain" /><span className="mt-[8px] flex items-center gap-[8px]"><input type="checkbox" aria-label={`Référence ${i + 1}`} checked={!(demande.references_ecartees ?? []).includes(id)} onChange={(e) => changer({ references_ecartees: e.target.checked ? (demande.references_ecartees ?? []).filter((v) => v !== id) : [...(demande.references_ecartees ?? []), id], references: e.target.checked ? (travail.demande.references ?? []).includes(id) ? [...new Set([...refs, id])] : refs : refs.filter((v) => v !== id) })} />Référence {i + 1}</span></label> })}</div></section>}
          {communes.length > 0 && <section className="mt-[22px]"><h3 className="text-[13px]">Références communes de {nomPiece ?? travail?.piece_fiche.nom ?? "la pièce"} ({communes.length})</h3><p className="mt-[4px] text-[12px] text-encre-3">Elles partent avec cet envoi, en plus de la planche de bases. Décocher n’en retire aucune de la fiche de la pièce.</p><div className="mt-[8px] flex flex-wrap gap-[14px]">{communes.map((id, i) => {
            const fiche = fichesCommunes.find((a) => a.identifiant === id)
            return <label key={id} className="w-[128px] text-[12px]">{fiche
              ? <img src={vignetteAsset(fiche, 128)} alt={fiche.label || `Référence commune ${i + 1}`} className="damier-papier h-[128px] w-full object-contain" />
              : <span className="damier-papier flex h-[128px] w-full items-center justify-center px-[8px] text-center text-[11px] text-encre-3">Vignette non relue</span>}
              <span className="mt-[8px] flex items-center gap-[8px]"><input type="checkbox" aria-label={`Référence commune ${i + 1}`} checked={!ecartees.includes(id)} onChange={(e) => changer({ references_ecartees: e.target.checked ? ecartees.filter((v) => v !== id) : [...new Set([...ecartees, id])] })} />{fiche?.label || `Référence commune ${i + 1}`}</span>
            </label>
          })}</div></section>}
          <h3 className="mt-[22px] text-[13px]">Références ajoutées à cet envoi ({refs.length})</h3><div className="mt-[8px] flex flex-wrap gap-[8px]">{refs.map((id, i) => <button key={id} className={CHAMP} onClick={() => changer({ references: refs.filter((r) => r !== id) })}>Retirer la référence {i + 1}</button>)}<button className={CHAMP} onClick={() => setChercher(!chercher)}>Choisir des références avec aperçu</button></div>
          {chercher && <div className="mt-[14px] rounded-7 border border-trait bg-papier p-[14px]"><input aria-label="Rechercher une référence" className={`${CHAMP} w-full`} value={recherche} onChange={(e) => { setRecherche(e.target.value); setLimite(48) }} /><label className="mt-[8px] flex items-center gap-[8px] text-[12px]"><input type="checkbox" checked={favoris} onChange={(e) => setFavoris(e.target.checked)} />Favorites seulement</label><div className="mt-[14px] grid grid-cols-3 gap-[8px]">{images.map((a) => <button key={a.identifiant} aria-pressed={refs.includes(a.identifiant)} className={`rounded-7 border p-[8px] text-left ${refs.includes(a.identifiant) ? "border-signal bg-ligne-ouverte" : "border-trait bg-carte"}`} onClick={() => changer({ references: refs.includes(a.identifiant) ? refs.filter((r) => r !== a.identifiant) : [...refs, a.identifiant] })}><img src={vignetteAsset(a, 108)} alt={a.label} className="damier-papier h-[54px] w-full object-contain" /><span className="mt-[4px] block truncate text-[11px]">{a.label}</span></button>)}</div>{total > images.length && <button className={`${CHAMP} mt-[8px]`} onClick={() => setLimite(limite + 48)}>Afficher plus d’images</button>}</div>}
        </section>
      </div> : travail && <>
        <div className="grid grid-cols-3 gap-[14px]">{[[travail.annonce.images_ciblees, "images ciblées"], [travail.annonce.planches, "planches de bases"], [travail.annonce.appels, "appels distincts"]].map(([n, titre]) => <div key={titre} className="rounded-10 border border-trait bg-carte p-[22px]"><strong className="font-serif text-[38px] font-normal">{n}</strong><span className="ml-[14px] text-[13px] text-encre-3">{titre}</span></div>)}</div>
        <section className="mt-[22px] rounded-10 border border-trait bg-carte p-[22px]"><div className="flex items-start justify-between gap-[14px]"><div><h2 className="font-serif text-[25px]">{travail.catalogue.modele}</h2><p className="mt-[8px] text-[13px]">Réservation totale : {dollars(travail.annonce.reservation_usd)}</p></div><button className={CHAMP} disabled={occupe || travail.etat === "en_cours" || travail.etat === "externe_inconnu"} onClick={reedition}>{travail.etat === "prepare" ? "Passer en édition" : "Préparer une autre demande"}</button></div><p className="mt-[8px] text-[12px] text-encre-3">{travail.annonce.limite}</p><p className="mt-[4px] text-[12px] text-encre-3">{travail.catalogue.capacite_explication}</p></section>
        {travail.raison && <p role="status" className="mt-[14px] text-[13px] text-encre-3">{travail.raison}</p>}
        {travail.appels.map((appel) => <section key={appel.numero} className="mt-[22px] rounded-10 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Appel {appel.numero + 1} · {appel.cibles.length} images · {appel.etat === "termine" ? "reçu et découpé" : appel.etat === "a-verifier" ? "découpe à vérifier" : appel.etat === "echoue" ? "échoué" : appel.etat === "soumis" ? "soumis" : "préparé"}</h2><p className="mt-[8px] text-[13px]">{montant(appel.consommation_annoncee.montant, appel.consommation_annoncee.unite)} · réservation {dollars(appel.reservation_usd)} · {appel.snapshot.resolution ?? "résolution du modèle"} · {appel.snapshot.proportions}</p>
          {appel.temps_local && <div className="mt-[8px] text-[12px] text-encre-3"><p>Calcul local · aucun achat. Les durées de chargement et les suivants ne se multiplient pas comme un prix.</p>{appel.temps_local.mesures.map((m, i) => <p key={i}>{m.temperature} : {m.mediane_s.toFixed(1)} s mesurées sur {m.mesures} calculs</p>)}{appel.temps_local.raison && <p>{appel.temps_local.raison}</p>}</div>}
          <h3 className="mt-[14px] text-[13px]">Bases exactes et cibles du retour</h3><div className="mt-[8px] flex flex-wrap gap-[14px]">{appel.cibles.map((index) => { const c = travail.cibles[index]; return <figure key={index} className="w-[128px]"><img src={c.url} alt={`Base ${index + 1}`} className="damier-papier h-[128px] w-full object-contain" /><figcaption className="mt-[4px] text-[12px]">{c.base.pose} · {c.base.direction || "sans direction"}{c.cible.nature === "frame" ? ` · frame cible ${index + 1}` : ""}</figcaption>{c.variante && onCalque && <button className={`${CHAMP} mt-[8px] w-full px-[4px] text-[11px]`} onClick={() => onCalque(c.cible, c.variante!)}>Extraire / corriger</button>}</figure> })}</div>
          <h3 className="mt-[22px] text-[13px]">Ce qui part vraiment : {appel.references.length} images</h3><div className="mt-[8px] flex flex-wrap gap-[14px]">{appel.references.map((r, i) => <figure className="w-[128px]" key={r.url}><a href={r.url} target="_blank" rel="noreferrer"><img src={r.url} alt={`Référence envoyée ${i + 1}`} className="damier-papier h-[128px] w-full object-contain" /></a><figcaption className="mt-[4px] text-[12px]">{r.reference?.role === "edition" ? "Planche à équiper" : `Référence ${i + 1}`}</figcaption></figure>)}</div>
          {appel.hors_plafond.length > 0 && <p className="mt-[8px] text-[12px] text-encre-3">{appel.hors_plafond.length} références automatiques non envoyées en raison du plafond du modèle.</p>}
          <details open className="mt-[22px]"><summary className="cursor-pointer text-[13px]">Texte final envoyé</summary><pre className="mt-[8px] whitespace-pre-wrap rounded-7 border border-trait bg-papier p-[14px] font-sans text-[13px] leading-[1.5]">{appel.snapshot.prompt}</pre>{appel.snapshot.prompt_negatif && <p className="mt-[8px] whitespace-pre-wrap text-[12px] text-encre-3">À éviter : {appel.snapshot.prompt_negatif}</p>}<dl className="mt-[8px] text-[12px] text-encre-3">{Object.entries(appel.snapshot.options).map(([k, v]) => <div key={k} className="flex gap-[8px]"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></details>
          {appel.retour_url && <figure className="mt-[22px]"><figcaption className="mb-[8px] text-[13px]">Planche réellement reçue — à contrôler avant extraction</figcaption><a href={appel.retour_url} target="_blank" rel="noreferrer"><img className="damier-papier max-h-[380px] max-w-full object-contain" src={appel.retour_url} alt={`Planche reçue de l’appel ${appel.numero + 1}`} /></a></figure>}
          {appel.raison && <p className="mt-[14px] text-[13px] text-echec">{appel.raison}</p>}{appel.pliage.attend_un_choix && <button className={`${CHAMP} mt-[8px]`} disabled={occupe} onClick={() => void agir(() => equipements.confirmer(chemin, travail.identifiant, appel.numero))}>J’ai vérifié la planche : garder toutes ses cases</button>}
        </section>)}
        {travail.consommations.length > 0 && <section className="mt-[22px] rounded-10 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Consommation enregistrée</h2>{travail.consommations.map((c, i) => <p className="mt-[8px] text-[13px]" key={i}>{c.modele} · {montant(c.consomme, c.unite)}</p>)}</section>}
      </>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte px-[30px] py-[14px]"><p className="max-w-prose text-[12px] text-encre-3">{edition ? "La prochaine étape montre l’envoi exact, sans appeler le fournisseur." : "Les retours restent à extraire et à vérifier. Fermer conserve le suivi et les résultats."}</p><div className="flex gap-[8px]">
      {edition ? <button className={ACTION} disabled={occupe || !demande.modele || !!modele?.refus} onClick={() => void agir(() => equipements.preparer(chemin, demande))}>{occupe ? "Préparation…" : "Relire avant envoi"}</button> : travail && <>
        {!["termine", "annule"].includes(travail.etat) && <button className={CHAMP} disabled={occupe || annulation} onClick={() => { setAnnulation(true); void agir(() => equipements.annuler(chemin, travail.identifiant)) }}>{annulation ? "Arrêt demandé" : "Arrêter les appels restants"}</button>}
        {travail.etat === "prepare" && <button className={ACTION} disabled={occupe} onClick={() => void agir(() => equipements.demarrer(chemin, travail.identifiant))}>Lancer {travail.annonce.appels} appel{travail.annonce.appels > 1 ? "s" : ""} · {dollars(travail.annonce.reservation_usd)} réservés</button>}
        {["a_verifier", "a_reprendre"].includes(travail.etat) && <button className={ACTION} disabled={occupe} onClick={() => void agir(() => equipements.demarrer(chemin, travail.identifiant, true))}>Reprendre les résultats conservés</button>}
        <button className={CHAMP} disabled={occupe} onClick={() => void agir(() => equipements.lire(chemin, travail.identifiant))}>Actualiser le suivi</button>
      </>}
    </div></footer>
  </>} />
}
