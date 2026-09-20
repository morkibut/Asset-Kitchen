import { useEffect, useMemo, useState } from "react"
import { api, Refus, type Appel, type Generation, type Personnage, type Statut } from "../api"
import { SuiviDesTravaux } from "./FabricationSuivie"
import { FileDesCalculsLocaux } from "./FileDesCalculsLocaux"
import { ProfilsWorkflow } from "./WorkflowsLocaux"
import type { CibleCalque } from "../api-calques"
import type { TypeDeResultat } from "../fabrication"

const ETATS: Record<Statut, string> = { en_attente: "En attente", en_cours: "En cours", reussie: "Terminé", echouee: "Échec", interrompue: "Interrompu" }
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"

/** Le journal est relu sur disque, le chantier le complète pendant les appels.
 * Les identifiants les fusionnent : un même appel ne devient jamais deux lignes. */
export function Fabrications({ projet, chantier, clips, personnages, onCreer, onPreparer, onGalerie, onClip, onBande, onSujet, onDepenses, onAsset, onToile, onSon, onCalqueEquipement }: {
  projet: string | null
  chantier: readonly Generation[]
  clips: readonly Generation[]
  personnages: readonly Personnage[]
  onCreer: () => void
  /** **Ouvrir la fenêtre unique de préparation sur un type** (RP4). Cet écran
   *  posait trois fenêtres de plus — l'image locale, la vidéo libre, le son ;
   *  il ne fait plus que dire par quel type on entre. */
  onPreparer: (type: TypeDeResultat, modele?: string, avecQuoi?: "catalogue" | "workflow") => void
  onGalerie: () => void
  onClip: (id: string) => void
  onBande?: (id: string) => void
  onSujet: (id: string) => void
  onDepenses: () => void
  onAsset?: (id: string) => void
  onToile?: (id: string) => void
  onSon?: (id: string) => void
  onCalqueEquipement?: (piece: string, emploi: string, cible: CibleCalque, variante?: string) => void
}) {
  const [appels, setAppels] = useState<Appel[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [relecture, setRelecture] = useState(0)
  const [filtre, setFiltre] = useState("")
  const [recherche, setRecherche] = useState("")
  const [charge, setCharge] = useState(false)
  const empreinte = chantier.map((g) => `${g.identifiant}:${g.statut}`).join("|")
  useEffect(() => {
    let vivant = true
    setErreur(null); setCharge(false)
    api.journal(projet).then((j) => { if (vivant) setAppels(j.appels) }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Refus ? e.message : "Le journal des fabrications ne répond pas.") }).finally(() => { if (vivant) setCharge(true) })
    return () => { vivant = false }
  }, [projet, empreinte, relecture])
  const lignes = useMemo(() => {
    const resultat = new Map<string, { appel: Appel; generation?: Generation }>()
    appels.forEach((appel) => resultat.set(appel.identifiant, { appel }))
    ;[...clips, ...chantier].filter((g) => g.projet === projet).forEach((g) => resultat.set(g.identifiant, { generation: g, appel: { identifiant: g.identifiant, modele: g.modele, prompt: g.demande.prompt, cree_le: g.cree_le, cout_usd: g.cout_usd, statut: g.statut, reussies: g.reussies, rates: [] } }))
    return [...resultat.values()].sort((a, b) => b.appel.cree_le - a.appel.cree_le)
  }, [appels, clips, chantier, projet])
  const visibles = lignes.filter(({ appel: a }) => (!filtre || (filtre === "actives" ? a.statut === "en_cours" || a.statut === "en_attente" : filtre === "revoir" ? a.statut === "echouee" || a.statut === "interrompue" : a.statut === filtre)) && `${a.prompt} ${a.modele}`.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr")))

  return <main aria-label="Fabrications" className="defile min-h-0 flex-1 overflow-y-auto bg-papier p-[30px]">
    <header className="flex items-start justify-between gap-[22px]"><div><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Fabrications</h1><p className="mt-[8px] text-[14px] text-encre-3">Préparer une demande, suivre ce qui tourne et retrouver les résultats du jeu.</p></div><button onClick={onCreer} className="h-[34px] shrink-0 rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal hover:bg-echec">Nouvelle fabrication</button></header>
    {projet && <SuiviDesTravaux projet={projet} personnages={personnages} onClip={onClip} onBande={onBande} onCalqueEquipement={onCalqueEquipement} onAsset={onAsset} onToile={onToile} onSon={onSon} onPreparer={onPreparer} />}
    <FileDesCalculsLocaux projet={projet} />
    <section aria-label="Commencer une fabrication" className="mt-[22px] grid grid-cols-2 gap-[14px]">
      <div className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px] text-encre">Une image libre</h2><p className="mt-[8px] text-[13px] text-encre-3">Choisissez le modèle, écrivez votre demande et ajoutez les références. Vous relirez l’envoi avant de lancer.</p><button className={`${BOUTON} mt-[14px]`} onClick={onCreer}>Préparer une image</button></div>
      <div className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px] text-encre">Animer un sujet</h2><p className="mt-[8px] text-[13px] text-encre-3">Partez de sa fiche pour choisir le mouvement, la direction et l’image de départ du clip.</p><label className="mt-[14px] flex items-center gap-[8px] text-[12px] text-encre-3">Sujet<select aria-label="Sujet à animer" defaultValue="" onChange={(e) => { if (e.target.value) onSujet(e.target.value) }} className={`${BOUTON} min-w-0 flex-1`}><option value="">Choisir un sujet…</option>{personnages.map((p) => <option value={p.identifiant} key={p.identifiant}>{p.nom}</option>)}</select></label>{!personnages.length && <p className="mt-[8px] text-[12px] text-encre-3">Créez d’abord un personnage depuis Codex.</p>}</div>
    </section>
    {projet && <div className="mt-[14px] rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Une vidéo libre</h2><p className="mt-[8px] text-[13px] text-encre-3">Choisissez ou fabriquez son image de départ, puis écrivez le mouvement. Vous pourrez classer ses frames dans un sujet au montage.</p><button className={`${BOUTON} mt-[14px]`} onClick={() => onPreparer("clip")}>Préparer une vidéo</button></div>}
    {projet && <div className="mt-[14px] rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Un son</h2><p className="mt-[8px] text-[13px] text-encre-3">Décrivez un effet, une ambiance ou une musique. Le résultat rejoint l’atelier son pour l’écouter, le couper, régler sa boucle et le livrer dans Godot.</p><button className={`${BOUTON} mt-[14px]`} onClick={() => onPreparer("son")}>Préparer un son</button></div>}
    <details className="mt-[22px] rounded-8 border border-trait bg-papier-cote p-[22px]"><summary className="cursor-pointer text-[14px]">Mes méthodes locales · importer, vérifier ou choisir un workflow</summary><div className="mt-[22px]"><ProfilsWorkflow onAudio={projet ? (modele) => onPreparer("son", modele) : undefined} onImage={projet ? (modele) => onPreparer("image", modele, "workflow") : undefined} onVideo={projet ? (modele) => onPreparer("clip", modele) : undefined} /></div></details>
    <div className="mt-[22px] flex items-end gap-[14px]"><label className="flex flex-1 flex-col gap-[4px] text-[12px] text-encre-3">Rechercher une fabrication<input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Demande ou modèle…" className={BOUTON} /></label><label className="flex flex-col gap-[4px] text-[12px] text-encre-3">État<select value={filtre} onChange={(e) => setFiltre(e.target.value)} className={BOUTON}><option value="">Toutes</option><option value="actives">En attente ou en cours</option><option value="reussie">Terminées</option><option value="revoir">À reprendre</option></select></label><button className={BOUTON} onClick={() => setRelecture((n) => n + 1)}>Actualiser</button><button className={BOUTON} onClick={onDepenses}>Consommation</button></div>
    {erreur && <p role="alert" className="mt-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur}</p>}
    {!charge && <p role="status" className="mt-[14px] text-[13px] text-encre-3">Lecture des fabrications…</p>}
    <div className="mt-[22px] flex flex-col gap-[8px]">{visibles.map(({ appel: a, generation: g }) => <article key={a.identifiant} className="rounded-8 border border-trait bg-carte p-[14px]"><div className="flex items-center justify-between gap-[14px]"><span className="mesure text-[11px] text-encre-3">{new Date(a.cree_le * 1000).toLocaleString("fr-FR")} · {g?.clip ? "Vidéo" : "Images"}</span><span className={`rounded-5 border px-[8px] py-[4px] text-[12px] ${a.statut === "echouee" || a.statut === "interrompue" ? "border-trait-echec bg-fond-echec text-echec" : "border-trait text-encre-3"}`}>{ETATS[a.statut]}</span></div><h2 className="mt-[8px] line-clamp-2 text-[14px] text-encre">{a.prompt || "Demande sans texte"}</h2><p className="mesure mt-[8px] text-[11px] text-encre-3">{a.modele}</p>{a.rates.filter((r) => r.raison).map((r) => <p key={r.rang} className="mt-[8px] text-[12px] text-echec">{r.raison}</p>)}<div className="mt-[14px] flex gap-[8px]">{a.statut === "reussie" && <button className={BOUTON} onClick={() => g?.clip ? onClip(g.identifiant) : onGalerie()}>{g?.clip ? "Ouvrir le montage du clip" : "Voir les résultats dans la galerie"}</button>}{g?.personnage && <button className={BOUTON} onClick={() => onSujet(g.personnage!)}>Ouvrir le sujet</button>}{(a.statut === "echouee" || a.statut === "interrompue") && <button className={BOUTON} onClick={onGalerie}>Reprendre depuis la galerie</button>}</div></article>)}</div>
    {charge && !visibles.length && <p className="mt-[22px] rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">Aucune fabrication pour ces filtres.</p>}
  </main>
}
