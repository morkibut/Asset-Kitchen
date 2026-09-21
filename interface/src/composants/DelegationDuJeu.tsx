import { useEffect, useState } from "react"
import { api, dollars, Refus } from "../api"
import { travaux, type CadreDelegation, type TravailSuivi } from "../api-travaux"
import { workflows } from "../api-workflows"
import { nomMoteurSonore } from "./WorkflowsLocaux"
import { Libelle } from "./pieces"

const CHAMP = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle"
const BOUTON = `${CHAMP} hover:border-encre-3 disabled:opacity-50`
const ETATS: Record<TravailSuivi["etat"], string> = {
  prepare: "Préparée", en_cours: "En cours", a_reprendre: "À reprendre", a_verifier: "À vérifier",
  externe_inconnu: "Acceptation externe inconnue", termine: "Terminée", annule: "Annulée",
}
/** `titre` : ce qu'on lit, quand l'identifiant n'est pas lisible (un moteur sonore et sa version). */
type Methode = { identifiant: string; titre?: string; detail: string; indisponible?: string | null }
const message = (erreur: unknown) => erreur instanceof Refus ? erreur.message : "Impossible de relire le cadre de ce jeu. Réessayez."

export function DelegationDuJeu(props: {
  projet: string; onAtelier: () => void; onTravail?: (travail: TravailSuivi) => void
}) {
  return <CadreDuJeu key={props.projet} {...props} />
}

function CadreDuJeu({ projet, onAtelier, onTravail }: {
  projet: string; onAtelier: () => void; onTravail?: (travail: TravailSuivi) => void
}) {
  const [cadre, setCadre] = useState<CadreDelegation | null>(null)
  const [sauve, setSauve] = useState("")
  const [images, setImages] = useState<Methode[]>([])
  const [videos, setVideos] = useState<Methode[]>([])
  const [sons, setSons] = useState<Methode[]>([])
  const [choisirImages, setChoisirImages] = useState(false)
  const [choisirVideos, setChoisirVideos] = useState(false)
  const [choisirSons, setChoisirSons] = useState(false)
  const [demandes, setDemandes] = useState<TravailSuivi[]>([])
  const [erreur, setErreur] = useState("")
  const [catalogueAbsent, setCatalogueAbsent] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [suiviOccupe, setSuiviOccupe] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [chargement, setChargement] = useState(0)
  const [toutVoir, setToutVoir] = useState(false)

  useEffect(() => {
    let vivant = true
    setErreur("")
    Promise.all([travaux.cadre(projet), travaux.lister(projet)]).then(([c, liste]) => {
      if (!vivant) return
      setCadre(c); setSauve(JSON.stringify(c)); setDemandes(liste.filter(t => t.acteur === "agent"))
      setChoisirImages(c.modeles_image.length > 0); setChoisirVideos(c.modeles_video.length > 0)
      setChoisirSons((c.modeles_audio ?? []).length > 0)
    }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    Promise.allSettled([api.modeles("1:1"), api.modelesVideo(5, "480p", "1:1"), workflows.lister()]).then(([i, v, s]) => {
      if (!vivant) return
      if (i.status === "fulfilled") setImages(i.value.modeles.map(m => ({ identifiant: m.identifiant,
        detail: `${m.references_max} référence${m.references_max > 1 ? "s" : ""} au maximum · ${m.unite === "usd" ? "facturé en dollars" : "autre unité : " + m.unite}`, indisponible: m.refus })))
      if (v.status === "fulfilled") setVideos(v.value.modeles.map(m => ({ identifiant: m.identifiant,
        detail: m.de_la_maison ? "Sur cette machine" : "Fournisseur distant", indisponible: m.grise })))
      if (s.status === "fulfilled") setSons([
        // sfxr n'a pas de profil installé : c'est un algorithme du code, pas
        // un moteur ComfyUI à retrouver — il se propose toujours.
        { identifiant: "sfxr", titre: "sfxr", detail: "Sons rétro calculés sur place, en un instant, sans carte graphique." },
        // Une seule ligne par moteur : sa version la plus récente.
        ...s.value.profils.filter(p => p.nature === "audio")
          .filter((p, _, tous) => !tous.some(q => q.identifiant === p.identifiant && q.cree_le > p.cree_le))
          .map(p => ({ identifiant: p.modele, titre: p.nom || nomMoteurSonore(p.identifiant), detail: "Calcul sur cette machine" }))])
      setCatalogueAbsent(i.status === "rejected" || v.status === "rejected" ? "Une partie du catalogue est indisponible. Les modèles déjà autorisés sont conservés." : "")
    })
    return () => { vivant = false }
  }, [projet, chargement])

  function changer(champs: Partial<CadreDelegation>) {
    setCadre(c => c ? { ...c, ...champs } : c)
    setConfirmation(""); setErreur("")
  }
  async function enregistrer() {
    if (!cadre) return
    if ((choisirImages && !cadre.modeles_image.length) || (choisirVideos && !cadre.modeles_video.length) || (choisirSons && !cadre.modeles_audio.length)) {
      setErreur("Choisis au moins un modèle dans chaque sélection, ou reviens à « Toutes les méthodes compatibles ».")
      return
    }
    if (!Number.isFinite(cadre.plafond_usd) || cadre.plafond_usd < 0 || !Number.isInteger(cadre.plafond_appels) || cadre.plafond_appels < 0) {
      setErreur("Les limites doivent être positives ou nulles ; le nombre de générations doit être entier.")
      return
    }
    if (!Number.isFinite(cadre.plafond_secondes_audio) || cadre.plafond_secondes_audio < 0) {
      setErreur("Le plafond de temps de calcul sonore doit être un nombre de secondes positif ou nul.")
      return
    }
    setOccupe(true); setErreur(""); setConfirmation("")
    try {
      const c = await travaux.reglerCadre(projet, cadre)
      setCadre(c); setSauve(JSON.stringify(c)); setConfirmation("Cadre enregistré pour ce jeu. Il sera relu avant chaque nouvelle génération.")
    } catch (e) { setErreur(message(e)) }
    finally { setOccupe(false) }
  }
  async function actualiser() {
    setSuiviOccupe(true); setErreur("")
    try { setDemandes((await travaux.lister(projet)).filter(t => t.acteur === "agent")) }
    catch (e) { setErreur(message(e)) }
    finally { setSuiviOccupe(false) }
  }

  const change = !!cadre && (JSON.stringify(cadre) !== sauve || (choisirImages && !cadre.modeles_image.length) || (choisirVideos && !cadre.modeles_video.length) || (choisirSons && !cadre.modeles_audio.length))
  const cout = demandes.reduce((s, t) => s + t.consommations.reduce((total, c) => total + c.cout_usd, 0), 0)
  const enCours = demandes.filter(t => !["termine", "prepare", "annule"].includes(t.etat)).length
  return <section aria-label="Délégation de ce jeu" className="space-y-[22px] text-encre">
    <header><h2 className="font-serif text-[38px]">Déléguer à l’agent</h2><p className="mt-[8px] max-w-[880px] text-[13px] text-encre-3">L’agent qui développe le jeu dans Godot peut demander une animation complète. Tu fixes ici ce qu’il peut fabriquer et livrer de lui-même.</p></header>
    {erreur && <div role="alert" className="rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-[13px] text-echec">{erreur}{!cadre && <button className={`${BOUTON} ml-[14px]`} onClick={() => setChargement(n => n + 1)}>Réessayer</button>}</div>}
    {!cadre ? <p className="text-[13px] text-encre-3">Lecture du cadre…</p> : <form onSubmit={e => { e.preventDefault(); void enregistrer() }} className="space-y-[22px]">
      {cadre.origine === "garde-fous-existants" && <p className="text-[13px] text-encre-3">Ce jeu reprend pour l’instant le modèle d’image et le plafond de l’ancien cadre. La vidéo locale est permise ; les générations payantes restent désactivées. Enregistrer lui donne son propre cadre durable.</p>}
      <fieldset disabled={occupe} className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">Ce qui est permis</legend><div className="grid grid-cols-2 gap-[22px]">
        <label className="flex items-start gap-[8px] text-[13px]"><input type="checkbox" className="mt-[4px] accent-ok" checked={cadre.autoriser_local} onChange={e => changer({ autoriser_local: e.target.checked })} /><span>Autoriser la vidéo locale<span className="mt-[4px] block text-[12px] text-encre-3">Utilise la carte graphique. Le temps mesuré reste distinct des dollars ; les modèles et moteurs doivent déjà être disponibles.</span></span></label>
        <label className="flex items-start gap-[8px] text-[13px]"><input type="checkbox" className="mt-[4px] accent-ok" checked={cadre.autoriser_payant} onChange={e => changer({ autoriser_payant: e.target.checked })} /><span>Autoriser les générations payantes<span className="mt-[4px] block text-[12px] text-encre-3">Pour la référence et la vidéo, dans les limites ci-dessous. Activer cette option ne lance aucune génération.</span></span></label>
      </div></fieldset>
      <fieldset disabled={occupe} className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">Les limites du jeu</legend><div className="grid grid-cols-2 gap-[22px]">
        <label className="flex flex-col gap-[8px] text-[13px]">Nombre total de générations autorisées<input type="number" min={0} step={1} className={CHAMP} value={cadre.plafond_appels} onChange={e => changer({ plafond_appels: Number(e.target.value) })} /></label>
        <label className="flex flex-col gap-[8px] text-[13px]">Budget total en dollars<input type="number" min={0} step="0.01" className={CHAMP} value={cadre.plafond_usd} onChange={e => changer({ plafond_usd: Number(e.target.value) })} /></label>
        <label className="flex flex-col gap-[8px] text-[13px]">Temps de calcul sonore autorisé, en secondes<input type="number" min={0} step={30} className={CHAMP} value={cadre.plafond_secondes_audio} onChange={e => changer({ plafond_secondes_audio: Number(e.target.value) })} /></label>
      </div><div className="mt-[14px] text-[12px] text-encre-3"><Libelle aide="agent.cadre-durable">Le budget est réservé avant les générations</Libelle><p className="mt-[8px]">Une nouvelle référence puis un clip demandent deux générations. Deux demandes simultanées partagent les mêmes limites. Les prix annoncés sont estimés : une facture plus élevée reste comptée et peut bloquer la suite.</p><p className="mt-[8px]">Ce total couvre les demandes complètes de l’agent conservées dans ce jeu, même après fermeture. Modifier la limite n’efface pas leur consommation. Une acceptation inconnue garde sa réservation.</p><p className="mt-[8px]">Le temps de calcul sonore n’est pas de l’argent — c’est la carte graphique de la machine, occupée. Il est estimé avant chaque série d’après les calculs déjà faits sur cette machine, et compté sur ce qui a vraiment tourné.</p></div>
      {!cadre.autoriser_payant && <p className="mt-[8px] text-[12px] text-encre-3">Les générations payantes sont désactivées ; le montant reste mémorisé.</p>}</fieldset>
      <fieldset disabled={occupe} className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">Les méthodes autorisées</legend>
        {catalogueAbsent && <p className="mb-[14px] text-[13px] text-encre-3">{catalogueAbsent}</p>}
        <div className="grid grid-cols-2 gap-[22px]"><ChoixMethodes nom="Image de référence" methodes={images} selection={cadre.modeles_image} restreint={choisirImages} onMode={v => { setChoisirImages(v); if (!v) changer({ modeles_image: [] }); else setConfirmation("") }} onSelection={v => changer({ modeles_image: v })} />
          <ChoixMethodes nom="Clip vidéo" methodes={videos} selection={cadre.modeles_video} restreint={choisirVideos} onMode={v => { setChoisirVideos(v); if (!v) changer({ modeles_video: [] }); else setConfirmation("") }} onSelection={v => changer({ modeles_video: v })} />
          <ChoixMethodes nom="Son" methodes={sonsSansVersion(sons, cadre.modeles_audio)} selection={cadre.modeles_audio} restreint={choisirSons} onMode={v => { setChoisirSons(v); if (!v) changer({ modeles_audio: [] }); else setConfirmation("") }} onSelection={v => changer({ modeles_audio: v })} /></div>
        <p className="mt-[14px] text-[12px] text-encre-3">Autoriser un modèle ne suffit pas à le rendre utilisable : ses références, son format, ses réglages et sa disponibilité sont vérifiés pour chaque demande. Aucun autre fournisseur ne le remplace en silence.</p>
      </fieldset>
      <fieldset disabled={occupe} className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">Livrer dans Godot</legend><label className="flex items-start gap-[8px] text-[13px]"><input type="checkbox" className="mt-[4px] accent-ok" checked={cadre.livraison_provisoire} onChange={e => changer({ livraison_provisoire: e.target.checked })} /><span>Permettre une livraison provisoire automatique<span className="mt-[4px] block text-[12px] text-encre-3">L’agent peut la demander pour tester le jeu tout de suite. Le dossier Godot doit être associé dans Livraisons. Une animation livrée reste disponible pour être jugée ou remplacée.</span></span></label></fieldset>
      <div className="flex items-center gap-[14px]"><button type="submit" className={BOUTON} disabled={occupe || (!change && cadre.origine === "explicite")}>{occupe ? "Enregistrement…" : "Enregistrer le cadre du jeu"}</button>{change && <span className="text-[12px] text-encre-3">Modifications non enregistrées</span>}{confirmation && <p role="status" className="text-[13px] text-ok">{confirmation}</p>}</div>
    </form>}
    <section className="rounded-8 border border-trait bg-carte p-[22px]" aria-label="Travaux de l’agent"><div className="flex items-center justify-between gap-[14px]"><h3 className="font-serif text-[25px]">Ce que l’agent a demandé</h3><button className={BOUTON} disabled={suiviOccupe} onClick={() => void actualiser()}>{suiviOccupe ? "Actualisation…" : "Actualiser le suivi"}</button></div>
      <p className="mt-[8px] text-[13px] text-encre-3">{demandes.length} demande{demandes.length > 1 ? "s" : ""} conservée{demandes.length > 1 ? "s" : ""} · {enCours} en cours ou à résoudre · {dollars(cout)} de dépenses reçues</p>
      {!demandes.length ? <p className="mt-[14px] text-[13px] text-encre-3">Aucune demande complète de l’agent pour ce jeu. Tes fabrications manuelles restent dans le journal général.</p> : <ul className="mt-[14px] space-y-[14px]">{(toutVoir ? demandes : demandes.slice(0, 6)).map(t => <li key={t.identifiant} className="flex items-start justify-between gap-[14px] text-[13px]"><div><p>{t.nature === "audio" ? `Son · ${t.demande.nom || t.demande.prompt}` : t.nature === "3d" ? `3D · ${t.demande.nom || t.demande.personnage || t.modele}` : t.nature === "equipement" ? `${t.piece_fiche.nom} · ${t.personnage} · ${t.annonce.images_ciblees} images` : t.nature === "image-locale" ? `Image locale · ${t.demande.prompt}` : t.nature === "video-libre" ? `Vidéo libre · ${t.demande.prompt_video}` : `${t.demande.personnage} · ${t.demande.pose} · ${t.demande.direction || "toutes directions"}`}</p><p className="mt-[4px] text-[12px] text-encre-3">{ETATS[t.etat]} · {t.nature === "3d" ? t.modele : t.nature === "equipement" || t.nature === "image-locale" || t.nature === "audio" ? t.demande.modele : t.demande.modele_video}</p>{t.raison && <p className="mt-[4px] max-w-full text-[12px] text-echec">{t.raison}</p>}</div>{onTravail && <button className={`${BOUTON} shrink-0`} onClick={() => onTravail(t)}>Ouvrir la demande</button>}</li>)}</ul>}
      {demandes.length > 6 && <button className={`${BOUTON} mt-[14px]`} onClick={() => setToutVoir(v => !v)}>{toutVoir ? "Voir seulement les plus récentes" : "Voir toutes les demandes"}</button>}
    </section>
    <footer className="text-[13px] text-encre-3"><p>Les clés de fournisseurs et les anciens garde-fous par séance restent dans les réglages de l’atelier. Ces derniers encadrent les anciens outils MCP d’image ; leur compteur est séparé de celui des demandes complètes ci-dessus.</p><button className={`${BOUTON} mt-[14px]`} onClick={onAtelier}>Clés et anciens garde-fous de séance</button></footer>
  </section>
}

// Le serveur permet un moteur sonore par son nom, sans la version : une
// autorisation donnée avant une réinstallation reste cochée sur la ligne
// du moteur réinstallé, au lieu de paraître perdue.
function sonsSansVersion(methodes: Methode[], selection: string[]): Methode[] {
  const nom = (id: string) => id.split("@")[0]
  return methodes.map(m => selection.includes(m.identifiant) ? m
    : { ...m, identifiant: selection.find(id => nom(id) === nom(m.identifiant)) ?? m.identifiant })
}

function ChoixMethodes({ nom, methodes, selection, restreint, onMode, onSelection }: {
  nom: string; methodes: Methode[]; selection: string[]; restreint: boolean
  onMode: (restreint: boolean) => void; onSelection: (selection: string[]) => void
}) {
  const [recherche, setRecherche] = useState("")
  const liste: Methode[] = [...methodes, ...selection.filter(id => !methodes.some(m => m.identifiant === id)).map(identifiant => ({ identifiant, detail: "Absent du catalogue actuel — autorisation conservée", indisponible: null }))]
  return <div className="min-w-0 space-y-[8px]"><label className="flex flex-col gap-[8px] text-[13px]">{nom}<select className={CHAMP} value={restreint ? "selection" : "tous"} onChange={e => onMode(e.target.value === "selection")}><option value="tous">Toutes les méthodes compatibles</option><option value="selection">Choisir les méthodes autorisées</option></select></label>
    {restreint && <><input aria-label={`Rechercher un modèle · ${nom}`} type="search" className={`${CHAMP} w-full`} placeholder="Fournisseur ou modèle…" value={recherche} onChange={e => setRecherche(e.target.value)} /><div className="max-h-[300px] space-y-[14px] overflow-y-auto py-[8px]" role="group" aria-label={`Modèles autorisés · ${nom}`}>{liste.filter(m => `${m.titre ?? ""} ${m.identifiant}`.toLocaleLowerCase().includes(recherche.toLocaleLowerCase())).map(m => <label key={m.identifiant} className="flex items-start gap-[8px] text-[12px]"><input type="checkbox" className="mt-[4px] accent-ok" checked={selection.includes(m.identifiant)} onChange={e => onSelection(e.target.checked ? [...selection, m.identifiant] : selection.filter(id => id !== m.identifiant))} /><span className="min-w-0 break-words">{m.titre ?? m.identifiant}<span className="mt-[4px] block text-encre-3">{m.detail}</span>{m.indisponible && <span className="mt-[4px] block text-encre-3">Disponibilité selon la demande : {m.indisponible}</span>}</span></label>)}</div><p className="text-[12px] text-encre-3">{selection.length} modèle{selection.length > 1 ? "s" : ""} autorisé{selection.length > 1 ? "s" : ""}{!selection.length ? " · choisis au moins une méthode" : ""}</p></>}
  </div>
}
