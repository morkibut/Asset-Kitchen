import { useEffect, useState } from "react"
import { apiCalques, cleCible, type CheminEmploi, type CibleCalque } from "../api-calques"
import { equipements, ETATS_EQUIPEMENT, type CouvertureEquipement, type OuvrirCalque, type TravailEquipement } from "../api-travaux-equipement"
import { RelectureEquipement } from "./RelectureEquipement"
import { CadreDialogue } from "./CadreDialogue"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"

export function CouvertureDeLEmploi({ chemin, onCalque }: { chemin: CheminEmploi; onCalque: OuvrirCalque }) {
  const [vue, setVue] = useState<CouvertureEquipement | null>(null)
  const [travaux, setTravaux] = useState<TravailEquipement[]>([])
  const [versions, setVersions] = useState<string[] | undefined>()
  const cleSelection = `atelier-equipement-selection:${chemin.projet}:${chemin.piece}:${chemin.emploi}`
  const [selection, setSelection] = useState<CibleCalque[]>(() => {
    try { const choix = JSON.parse(sessionStorage.getItem(cleSelection) ?? "[]"); return Array.isArray(choix) ? choix : [] }
    catch { return [] }
  })
  const [filtre, setFiltre] = useState("")
  const [rafraichi, setRafraichi] = useState(0)
  const [erreur, setErreur] = useState("")
  const [relecture, setRelecture] = useState<{ cibles?: CibleCalque[]; initiale?: TravailEquipement } | null>(null)
  const [reemploi, setReemploi] = useState(false)
  const [source, setSource] = useState("")
  const [copierPlacement, setCopierPlacement] = useState(true)
  const [copierMasques, setCopierMasques] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  useEffect(() => { try { sessionStorage.setItem(cleSelection, JSON.stringify(selection)) } catch { /* stockage de séance indisponible */ } }, [cleSelection, selection])
  useEffect(() => {
    let vivant = true
    equipements.couverture(chemin, versions).then((r) => { if (vivant) setVue(r) }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire la couverture.") })
    equipements.lister(chemin).then((r) => { if (vivant) setTravaux(r) }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire les travaux.") })
    return () => { vivant = false }
  }, [chemin, versions, rafraichi])
  const basculer = (c: CibleCalque) => setSelection((s) => s.some((a) => cleCible(a) === cleCible(c)) ? s.filter((a) => cleCible(a) !== cleCible(c)) : [...s, c])
  const choisirVersion = (caseId: string, resultat: string) => {
    if (!vue) return
    setVersions([...vue.cases.filter((c) => c.identifiant !== caseId).flatMap((c) => c.versions.filter((v) => v.choisie).map((v) => v.resultat)), resultat])
  }
  const manques = vue?.cases.flatMap((c) => c.versions.filter((v) => v.choisie).flatMap((v) => v.images.filter((i) => i.fabricable).map((i) => i.cible))) ?? []
  const calques = [...new Map((vue?.cibles ?? []).flatMap((c) => c.variantes ?? []).filter((v) => v.role === "calque").map((v) => [v.identifiant, v])).values()]
  const origine = calques.find((v) => v.identifiant === source)
  const reutiliser = async () => {
    setOccupe(true); setErreur("")
    try { const variantes = await apiCalques.reutiliser(chemin, source, selection, copierPlacement, copierMasques); setConfirmation(`${variantes.length} variantes indépendantes créées. Vérifiez chaque frame avant de retenir ces calques.`); setReemploi(false); setRafraichi((n) => n + 1) }
    catch (e) { setErreur(e instanceof Error ? e.message : "Le réemploi n’a pas pu être enregistré.") }
    finally { setOccupe(false) }
  }
  return <div className="defile min-h-0 flex-1 overflow-y-auto p-[30px]" aria-label="Couverture de l’équipement">
    <div className="flex flex-wrap items-center justify-between gap-[14px]"><div><h2 className="font-serif text-[25px]">Ce qui reste à équiper</h2><p className="mt-[8px] text-[13px] text-encre-3">Les objectifs comptent les versions de base choisies. Les autres restent disponibles pour fabriquer ou comparer.</p></div><div className="flex gap-[8px]"><button className={BOUTON} onClick={() => { setVersions(undefined); setRafraichi((n) => n + 1); setErreur("") }}>Relire les versions retenues</button><button className={BOUTON} disabled={!manques.length} onClick={() => setRelecture({ cibles: manques })}>Fabriquer les {manques.length} manques</button></div></div>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    {confirmation && <p role="status" className="mt-[14px] text-[13px] text-encre-3">{confirmation}</p>}
    {!vue && <p role="status" className="mt-[22px] text-[13px]">Lecture des bases et des calques…</p>}
    {vue && <>
      <div className="mt-[22px] grid grid-cols-2 gap-[14px]">{([["Images fixes", vue.images], ["Animations", vue.animations]] as const).map(([nom, compte]) => <section key={nom} className="rounded-10 border border-trait bg-carte p-[22px]"><h3 className="font-serif text-[25px]">{nom}</h3><p className="mt-[8px] text-[13px]">{compte.images_connues} images connues · {compte.prete} calques prêts</p>{compte.bases_absentes > 0 && <p className="mt-[8px] text-[12px] text-encre-3">{compte.bases_absentes} {nom === "Animations" ? "animations à produire — leur nombre de frames n’est pas encore connu" : "images de base à produire"}.</p>}{compte.bases_a_choisir > 0 && <p className="mt-[8px] text-[12px] text-encre-3">{compte.bases_a_choisir} versions de base à choisir.</p>}<div className="mt-[14px] flex flex-wrap gap-[14px]">{Object.entries(ETATS_EQUIPEMENT).map(([etat, label]) => <span key={etat} className="text-[12px] text-encre-3">{label} : {compte[etat as keyof typeof ETATS_EQUIPEMENT]}</span>)}</div></section>)}</div>
      <div className="mt-[22px] flex flex-wrap items-center gap-[14px]"><label className="flex items-center gap-[8px] text-[13px]">Afficher<select className={BOUTON} value={filtre} onChange={(e) => setFiltre(e.target.value)}><option value="">Tous les états</option>{Object.entries(ETATS_EQUIPEMENT).map(([etat, label]) => <option key={etat} value={etat}>{label}</option>)}</select></label><span className="text-[12px] text-encre-3">{selection.length} images sélectionnées</span><button className={BOUTON} disabled={!selection.length} onClick={() => setRelecture({ cibles: selection })}>Fabriquer la sélection</button>{selection.length > 0 && <button className={BOUTON} onClick={() => setSelection([])}>Vider la sélection</button>}</div>
      <div className="mt-[14px] flex flex-col gap-[8px]">{vue.cases.map((c) => <details key={c.identifiant} open={c.demandee} className="rounded-10 border border-trait bg-carte p-[14px]"><summary className="cursor-pointer font-serif text-[25px]">{c.nom_pose} → {c.nom_direction || "sans direction"} <span className="font-sans text-[12px] text-encre-3">· {c.nature === "animation" ? "animations" : "images fixes"} · {c.demandee ? c.prete ? "prêt" : "demandé" : "non demandé"}</span></summary>{c.raison && <p className="mt-[14px] text-[13px] text-encre-3">{c.raison}</p>}{c.versions.map((v) => <details key={v.resultat} open={v.choisie} className="mt-[14px] border-t border-trait pt-[14px]"><summary className="cursor-pointer text-[13px]">{v.nom} · {v.choisie ? "base choisie" : v.etat === "retenue" ? "retenue" : v.etat === "ecartee" ? "écartée" : "à juger"}</summary>{!v.choisie && c.demandee && v.etat !== "ecartee" && <button className={`${BOUTON} mt-[8px]`} disabled={v.a_confirmer} onClick={() => choisirVersion(c.identifiant, v.resultat)}>{v.a_confirmer ? "Direction de base à confirmer" : "Équiper cette version"}</button>}<div className="mt-[14px] flex flex-wrap gap-[14px]">{v.images.filter((i) => !filtre || i.etat === filtre).map((i) => <div key={cleCible(i.cible)} className="w-[128px] rounded-7 border border-trait p-[8px]"><label className="flex items-center gap-[8px] text-[12px]"><input type="checkbox" aria-label={`Sélectionner ${v.nom} ${i.cible.nature === "frame" ? `frame ${(i.rang ?? 0) + 1}` : "image"}`} checked={selection.some((s) => cleCible(s) === cleCible(i.cible))} onChange={() => basculer(i.cible)} />{i.cible.nature === "frame" ? `Frame ${(i.rang ?? 0) + 1}` : "Image"}</label><button onClick={() => onCalque(i.cible, i.variante ?? undefined)} className="mt-[8px] w-full text-left"><img className="damier-papier h-[128px] w-full object-contain" src={apiCalques.imageCible(chemin, i.cible)} alt="" loading="lazy" /><span className="mt-[8px] block text-[12px] text-encre">{ETATS_EQUIPEMENT[i.etat]} · ouvrir</span></button>{i.raison && <p className="mt-[4px] text-[11px] text-encre-3">{i.raison}</p>}</div>)}</div></details>)}</details>)}</div>
    </>}
    {travaux.length > 0 && <section className="mt-[22px]"><h2 className="font-serif text-[25px]">Fabrications conservées</h2><div className="mt-[14px] flex flex-col gap-[8px]">{travaux.map((t) => <button key={t.identifiant} className={`${BOUTON} flex items-center justify-between gap-[14px] text-left`} onClick={() => setRelecture({ initiale: t })}><span>{new Date(t.cree_le * 1000).toLocaleString("fr")} · {t.annonce.images_ciblees} images · {t.annonce.appels} appels</span><span>{t.etat === "termine" ? "Images reçues — extraire les calques" : t.etat === "prepare" ? "Prête à relire" : t.etat === "en_cours" ? "En cours" : t.etat === "annule" ? "Arrêtée" : "À vérifier"}</span></button>)}</div></section>}
    {relecture && <RelectureEquipement chemin={chemin} {...relecture} nomPiece={vue?.piece.nom} onFermer={() => { setRelecture(null); setRafraichi((n) => n + 1) }} onCalque={(c, v) => { setRelecture(null); onCalque(c, v) }} />}
    {selection.length > 0 && calques.length > 0 && <button className={`${BOUTON} mt-[22px]`} onClick={() => { setSource(calques[0].identifiant); setReemploi(true) }}>Réemployer un calque sur la sélection</button>}
    {reemploi && <CadreDialogue titre="Réemployer un calque" onFermer={() => setReemploi(false)} enfants={<div className="defile flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto p-[30px]"><header className="flex items-center justify-between"><h2 className="font-serif text-[38px]">Réemployer un calque</h2><button className={BOUTON} onClick={() => setReemploi(false)}>Fermer</button></header><p className="max-w-prose text-[13px] text-encre-3">La sélection contient {selection.length} cibles. Chaque copie devient une variante indépendante, à vérifier ; les calques retenus et leurs corrections restent conservés.</p><label className="flex flex-col gap-[8px] text-[13px]">Calque à reprendre<select className={BOUTON} value={source} onChange={(e) => setSource(e.target.value)}>{calques.map((v) => <option key={v.identifiant} value={v.identifiant}>{v.base.pose} · {v.base.direction || "sans direction"} · {v.retenue ? "retenue" : "variante"} · {v.identifiant.slice(0, 8)}</option>)}</select></label>{origine && <img className="damier-papier h-[300px] max-w-full object-contain" src={apiCalques.image(chemin, origine, "calque")} alt="Calque choisi pour le réemploi" />}<label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={copierPlacement} onChange={(e) => setCopierPlacement(e.target.checked)} />Copier la position, l’échelle et l’ordre</label><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={copierMasques} onChange={(e) => setCopierMasques(e.target.checked)} />Copier les masques peints du calque, du corps et des parties derrière</label><p className="max-w-prose text-[12px] text-encre-3">Ces positions et ces masques utilisent les coordonnées de la base d’origine. Une pose ou une direction différente peut demander une correction. Aucun ajustement ne vaut validation.</p>{erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}<button className={BOUTON} disabled={occupe || !source} onClick={() => void reutiliser()}>{occupe ? "Enregistrement…" : `Créer ${selection.length} variantes à vérifier · sans génération`}</button></div>} />}
  </div>
}
