import { useEffect, useState } from "react"
import { travauxAudio, type DemandeAudio, type TravailAudio } from "../api-travaux-audio"
import { workflows, type ProfilWorkflow } from "../api-workflows"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle disabled:opacity-50"
const ETATS = { prepare: "À relire", en_cours: "Calcul en cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "Acceptation à retrouver", termine: "Son reçu", annule: "Annulée" }
const message = (e: unknown) => e instanceof Error ? e.message : "Le bruitage ne peut pas être relu. Les résultats conservés restent disponibles."

export function FabricationAudio({ projet, modeleInitial = "", identifiantInitial, onSon, onFermer }: {
  projet: string; modeleInitial?: string; identifiantInitial?: string; onSon?: (id: string) => void; onFermer: () => void
}) {
  const [depart] = useState<DemandeAudio>({ cle: crypto.randomUUID(), modele: modeleInitial, prompt: "", secondes: 2, options: {} })
  const [d, setD] = useState(depart)
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [t, setT] = useState<TravailAudio | null>(null)
  const [edition, setEdition] = useState(!identifiantInitial)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const p = profils.find((p) => p.modele === d.modele)
  const brouillon = useBrouillonLocal({ cle: `audio:${projet}`, pret: !identifiantInitial, reference: depart, etat: d, appliquer: setD, signature: ({ cle: _cle, ...reste }) => JSON.stringify(reste) })
  useEffect(() => {
    let vivant = true
    workflows.lister().then(({ profils }) => { if (!vivant) return; setProfils(profils.filter((p) => p.nature === "audio")); const p = profils.find((p) => p.modele === modeleInitial); if (p && !identifiantInitial) setD((d) => ({ ...d, secondes: p.durees[0], options: Object.fromEntries(Object.entries(p.parametres).map(([n, p]) => [n, p.defaut])) })) }).catch((e) => vivant && setErreur(message(e)))
    if (identifiantInitial) travauxAudio.lire(projet, identifiantInitial).then((t) => { if (vivant) { setT(t); setD(t.demande) } }).catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, identifiantInitial, modeleInitial])
  useEffect(() => {
    if (t?.etat !== "en_cours") return
    const minuterie = window.setInterval(() => void travauxAudio.lire(projet, t.identifiant).then(setT).catch((e) => setErreur(message(e))), 2000)
    return () => window.clearInterval(minuterie)
  }, [t?.etat, t?.identifiant, projet])
  const changer = (v: Partial<DemandeAudio>) => setD((d) => ({ ...d, ...v, cle: crypto.randomUUID() }))
  const agir = async (fonction: () => Promise<TravailAudio>) => {
    setOccupe(true); setErreur("")
    try { setT(await fonction()); setEdition(false); brouillon.effacer() } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  return <CadreDialogue titre="Fabriquer un bruitage" onFermer={onFermer} enfants={<>
    <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait p-[22px]"><div><h1 className="font-serif text-[38px]">Fabriquer un bruitage</h1><p className="mt-[8px] text-[13px] text-encre-3">Décrire, écouter, ajuster, puis livrer au jeu.</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    <div className="defile min-h-0 flex-1 space-y-[22px] overflow-y-auto p-[30px]">
      {erreur && <p role="alert" className="text-echec">{erreur}</p>}
      {edition ? <><AvisBrouillon brouillon={brouillon} /><fieldset disabled={occupe} className="space-y-[14px]">
        <label className="flex flex-col gap-[4px] text-[13px]">Nom du son<input aria-label="Nom du bruitage" className={CHAMP} value={d.nom || ""} onChange={(e) => changer({ nom: e.target.value })} /></label>
        <label className="flex flex-col gap-[4px] text-[13px]">Méthode locale<select aria-label="Workflow sonore" className={CHAMP} value={d.modele} onChange={(e) => { const p = profils.find((p) => p.modele === e.target.value); changer({ modele: e.target.value, secondes: p?.durees[0] || 2, options: Object.fromEntries(Object.entries(p?.parametres || {}).map(([n, p]) => [n, p.defaut])) }) }}><option value="">Choisir un workflow sonore…</option>{profils.map((p) => <option key={p.modele} value={p.modele} disabled={p.diagnostic?.disponible === false}>{p.nom} · {p.diagnostic?.disponible === false ? p.diagnostic.problemes.join(" · ") : `version du ${new Date(p.cree_le * 1000).toLocaleDateString("fr-FR")}`}</option>)}</select></label>
        {!profils.length && <p className="text-[13px] text-encre-3">Ajoutez un workflow sonore dans Fabrications → Mes méthodes locales. Vous pouvez déjà importer et retoucher un fichier dans la bibliothèque des sons.</p>}
        <label className="flex flex-col gap-[4px] text-[13px]">Description sonore<textarea aria-label="Description sonore exacte" className={`${CHAMP} min-h-[128px]`} placeholder="Exemple : une épée sort lentement d’un fourreau de cuir, son sec, sans musique, pour un univers médiéval." value={d.prompt} onChange={(e) => changer({ prompt: e.target.value })} /></label><p className="text-[12px] text-encre-3">Ce texte part tel quel. Décrivez aussi l’ambiance de votre univers ; aucune instruction visuelle n’est ajoutée au son.</p>
        {p?.liaisons.prompt_negatif && <label className="flex flex-col gap-[4px] text-[13px]">À éviter<input aria-label="Son à éviter" className={CHAMP} value={d.prompt_negatif || ""} onChange={(e) => changer({ prompt_negatif: e.target.value })} /></label>}
        {p && <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[4px] text-[13px]">Durée du son<select aria-label="Durée du bruitage" className={CHAMP} value={d.secondes} onChange={(e) => changer({ secondes: Number(e.target.value) })}>{p.durees.map((s) => <option key={s} value={s}>{s} s</option>)}</select></label>{Object.entries(p.parametres).map(([n, option]) => <label key={n} className="flex flex-col gap-[4px] text-[13px]">{option.nom || n}{option.genre === "choix" ? <select className={CHAMP} value={String(d.options[n] ?? option.defaut)} onChange={(e) => changer({ options: { ...d.options, [n]: e.target.value } })}>{option.valeurs?.map((v) => <option key={v}>{v}</option>)}</select> : option.genre === "booleen" ? <input type="checkbox" checked={Boolean(d.options[n] ?? option.defaut)} onChange={(e) => changer({ options: { ...d.options, [n]: e.target.checked } })} /> : <input className={CHAMP} type="number" min={option.minimum ?? undefined} max={option.maximum ?? undefined} value={Number(d.options[n] ?? option.defaut)} onChange={(e) => changer({ options: { ...d.options, [n]: Number(e.target.value) } })} />}</label>)}</div>}
      </fieldset></> : t && <><h2 className="font-serif text-[25px]">{ETATS[t.etat]} · {t.demande.nom || "Bruitages"}</h2><div className="rounded-8 border border-trait bg-carte p-[22px]"><p className="break-all text-[13px]">{t.demande.modele}</p><p className="mt-[8px] text-[13px]">{t.annonce.limite}</p><p className="mt-[8px] text-[13px]">{t.snapshot_audio.secondes} secondes de son · {t.annonce.appels} appel</p>{t.annonce.mesures.length ? t.annonce.mesures.map((m, i) => <p key={i} className="mt-[8px] text-[12px] text-encre-3">{Math.round(m.mediane_s)} s de calcul mesurées · {m.temperature} · {m.mesures} essais</p>) : <p className="mt-[8px] text-[12px] text-encre-3">Temps de calcul encore inconnu pour ce workflow sur cette machine.</p>}</div>
        <section className="rounded-8 border border-trait bg-carte p-[22px]"><h3 className="font-serif text-[25px]">Texte exact et réglages envoyés</h3><p className="mt-[14px] whitespace-pre-wrap text-[14px]">{t.snapshot_audio.prompt}</p>{t.snapshot_audio.prompt_negatif && <p className="mt-[8px] text-[13px]">À éviter : {t.snapshot_audio.prompt_negatif}</p>}<dl className="mt-[14px] space-y-[8px] text-[13px]">{Object.entries(t.snapshot_audio.options).map(([k, v]) => <div key={k} className="flex justify-between"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></section>
        {t.raison && <p role="status" className="text-[13px] text-encre-3">{t.raison}</p>}{t.son && onSon && <button className={CHAMP} onClick={() => { onFermer(); onSon(t.son!) }}>Écouter et retoucher le son reçu</button>}{t.consommations.map((c, i) => <p key={i} className="text-[12px] text-encre-3">{Math.round(c.consomme)} {c.unite} mesurées · coût fournisseur en argent : 0</p>)}
      </>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte p-[22px]"><p className="text-[12px] text-encre-3">Fermer garde le brouillon, le travail et ses résultats.</p>{edition ? <button className={CHAMP} disabled={occupe || !p || p.diagnostic?.disponible === false || !d.prompt.trim()} onClick={() => void agir(() => travauxAudio.preparer(projet, d))}>Relire avant de générer le son</button> : t && <div className="flex gap-[8px]"><button className={CHAMP} onClick={() => { changer({}); setEdition(true) }}>{t.etat === "prepare" ? "Modifier cet envoi" : "Préparer un autre son"}</button>{["prepare", "a_reprendre", "a_verifier"].includes(t.etat) && !t.son && <button className={CHAMP} disabled={occupe} onClick={() => void agir(() => travauxAudio.lancer(t))}>{t.etat === "prepare" ? "Lancer ce calcul local" : "Reprendre le suivi sonore"}</button>}</div>}</footer>
  </>} />
}
