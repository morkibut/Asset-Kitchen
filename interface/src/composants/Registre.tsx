/**
 * « Le registre » (RC1) — **ce qu'on montre à l'auteur, et ce qu'il en décide,
 * là où il le voit.**
 *
 * Trois vues, un seul écran :
 *
 * - **l'accueil** : *À trancher* en tête, dans l'ordre d'arrivée ; puis ce qui
 *   est neuf ou mis à jour depuis la dernière visite ; puis le reste par rayon.
 *   Ce qui est écarté ou remplacé sort de la vue courante, replié en bas ;
 * - **une entrée** : ses médias à leur taille, vus et entendus sur place ; ses
 *   propositions côte à côte avec « Je prends celle-ci » ; les gestes de la
 *   porte courante ; ses remarques et les réponses des agents ; son histoire ;
 * - **une décision à la fois** : les entrées à trancher, une par une, plein
 *   cadre, et « Suivante » — la règle « une question à la fois » mise à l'écran.
 *
 * **Une décision est un état, dit là où l'on a cliqué** : l'entrée change
 * d'apparence tout de suite, un second clic ne crée rien, et tout se reprend
 * depuis le journal de l'entrée (« Annuler »). Aucun geste de cet écran ne
 * dépense ni ne fabrique.
 */
import { useCallback, useEffect, useState } from "react"
import {
  adresseDesSousTitres,
  adresseDuMedia,
  EVENEMENT_REGISTRE,
  registre,
  type Accueil,
  type Entree,
  type LigneEntree,
  type Media,
} from "../api-registre"

const bouton = "rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const boutonFort = `${bouton} border-signal bg-signal text-encre-sur-signal hover:border-signal`
const pastille = "rounded-5 border border-trait px-[8px] py-[4px] text-[12px]"

const TON: Record<string, string> = {
  "a-trancher": "border-signal text-signal",
  "reprise-demandee": "border-trait-attention text-encre-attention",
  "en-cours": "border-trait text-encre-3",
  validee: "border-trait-ok text-encre-ok",
  integree: "border-trait-ok text-encre-ok",
  ecartee: "border-trait text-encre-4",
}

const date = (s: number) => new Date(s * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

export function Registre({ projet, onErreur }: { projet: string; onErreur?: (message: string) => void }) {
  const [accueil, setAccueil] = useState<Accueil | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [uneALaFois, setUneALaFois] = useState(false)
  const [creation, setCreation] = useState(false)
  const [erreur, setErreur] = useState("")

  const relire = useCallback(() => {
    registre.accueil(projet).then(setAccueil).catch((e: Error) => setErreur(e.message))
  }, [projet])
  useEffect(() => { relire() }, [relire])
  useEffect(() => {
    const ecoute = () => relire()
    window.addEventListener(EVENEMENT_REGISTRE, ecoute)
    return () => window.removeEventListener(EVENEMENT_REGISTRE, ecoute)
  }, [relire])

  const aTrancher = accueil?.a_trancher ?? []
  const signaler = (e: unknown) => {
    const message = e instanceof Error ? e.message : "Le geste n'a pas abouti."
    setErreur(message); onErreur?.(message)
  }

  if (uneALaFois) {
    const ici = aTrancher[0]
    return <section className="defile flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Le registre">
      <header className="flex items-center justify-between gap-[14px] px-[30px] pt-[22px]">
        <div>
          <h1 className="font-serif text-[38px] text-encre">Le registre</h1>
          <p className="text-[13px] text-encre-3">Une décision à la fois · {aTrancher.length} à trancher</p>
        </div>
        <button className={bouton} onClick={() => setUneALaFois(false)}>‹ Le registre</button>
      </header>
      {ici
        ? <FicheEntree key={ici.identifiant} projet={projet} identifiant={ici.identifiant} onChange={relire} onErreur={signaler}
            suivante={aTrancher.length > 1 ? () => { void registre.vu(projet, [ici.identifiant]); setAccueil((a) => a && { ...a, a_trancher: [...a.a_trancher.slice(1), a.a_trancher[0]] }) } : undefined} />
        : <p className="m-[30px] rounded-8 border border-dashed border-contour p-[34px] text-center text-encre-3">Rien n'attend ta décision. Les agents le verront en relevant le registre.</p>}
    </section>
  }

  if (ouverte) {
    return <section className="defile flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Le registre">
      <header className="flex items-center justify-between gap-[14px] px-[30px] pt-[22px]">
        <h1 className="font-serif text-[38px] text-encre">Le registre</h1>
        <button className={bouton} onClick={() => { setOuverte(null); relire() }}>‹ Le registre</button>
      </header>
      <FicheEntree projet={projet} identifiant={ouverte} onChange={relire} onErreur={signaler} />
    </section>
  }

  return <section className="defile flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Le registre">
    <header className="flex items-start justify-between gap-[14px] px-[30px] pt-[22px]">
      <div>
        <h1 className="font-serif text-[38px] text-encre">Le registre</h1>
        <p className="text-[13px] text-encre-3">Ce que les agents te montrent, à juger sur place. Ils relèvent tes décisions sans que tu les recopies.</p>
      </div>
      <div className="flex flex-wrap items-center gap-[8px]">
        <button className={boutonFort} disabled={!aTrancher.length} onClick={() => setUneALaFois(true)}>Une décision à la fois{aTrancher.length ? ` · ${aTrancher.length}` : ""}</button>
        <button className={bouton} onClick={() => registre.vu(projet).then(relire, signaler)}>Tout marquer vu</button>
        <button className={bouton} onClick={() => setCreation((c) => !c)}>Nouvelle entrée</button>
      </div>
    </header>
    {erreur && <p role="alert" className="mx-[30px] mt-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-[13px] text-echec">{erreur}</p>}
    {creation && accueil && <CreerUneEntree projet={projet} accueil={accueil} onCree={(id) => { setCreation(false); relire(); setOuverte(id) }} onErreur={signaler} />}
    {accueil && accueil.depots_refuses.length > 0 && <div role="status" className="mx-[30px] mt-[14px] rounded-7 border border-trait-attention bg-fond-attention p-[14px] text-[13px]">
      <p className="font-medium text-encre-attention">{accueil.depots_refuses.length} dépôt{accueil.depots_refuses.length > 1 ? "s" : ""} d'agent refusé{accueil.depots_refuses.length > 1 ? "s" : ""}, laissé{accueil.depots_refuses.length > 1 ? "s" : ""} dans la boîte de dépôt</p>
      <ul className="mt-[4px] flex flex-col gap-[4px]">{accueil.depots_refuses.map((d) => <li key={d.dossier}><span className="mesure">{d.dossier}</span> — {d.raison}</li>)}</ul>
    </div>}
    {!accueil
      ? <p className="p-[30px] text-[13px] text-encre-3">Lecture du registre…</p>
      : accueil.total === 0
        ? <div className="m-[30px] rounded-8 border border-dashed border-contour p-[34px] text-center">
            <p className="text-encre">Le registre de ce jeu est vide.</p>
            <p className="mt-[8px] text-[13px] text-encre-3">Un agent y dépose par l'outil <span className="mesure">submit_entry</span>, ou en posant un dossier dans <span className="mesure break-all">{accueil.boite_de_depot}</span>. Tu peux aussi créer une entrée toi-même.</p>
          </div>
        : <div className="flex flex-col gap-[30px] p-[30px]">
            <Rayon projet={projet} titre="À trancher" vide="Rien n'attend ta décision." entrees={aTrancher} onOuvrir={setOuverte} />
            {accueil.nouveautes.length > 0 && <Rayon projet={projet} titre="Nouveau ou mis à jour" entrees={accueil.nouveautes} onOuvrir={setOuverte} />}
            {accueil.par_rayon.map((r) => <Rayon key={r.rayon ?? "sans"} projet={projet} titre={r.nom} entrees={r.entrees} onOuvrir={setOuverte} />)}
            {accueil.hors_vue.length > 0 && <details>
              <summary className="cursor-pointer text-[13px] text-encre-3">Écartées, retirées ou remplacées · {accueil.hors_vue.length}</summary>
              <div className="mt-[14px]"><Rayon projet={projet} titre="" entrees={accueil.hors_vue} onOuvrir={setOuverte} /></div>
            </details>}
          </div>}
  </section>
}

function Rayon({ projet, titre, vide, entrees, onOuvrir }: { projet: string; titre: string; vide?: string; entrees: LigneEntree[]; onOuvrir: (id: string) => void }) {
  return <div>
    {titre && <h2 className="mb-[14px] font-serif text-[25px] text-encre">{titre} <span className="mesure text-[13px] text-encre-3">{entrees.length}</span></h2>}
    {entrees.length === 0
      ? <p className="text-[13px] text-encre-3">{vide}</p>
      : <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[14px]">
          {entrees.map((e) => <li key={e.identifiant}><CarteEntree projet={projet} entree={e} onOuvrir={() => onOuvrir(e.identifiant)} /></li>)}
        </ul>}
  </div>
}

function Vignette({ projet, entree, media }: { projet: string; entree: string; media: Media | null }) {
  const src = media ? adresseDuMedia(projet, entree, media) : null
  return <div className="damier-papier flex h-[150px] items-center justify-center overflow-hidden rounded-7">
    {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" /> : <span className="text-[12px] text-encre-3">sans image</span>}
  </div>
}

function CarteEntree({ projet, entree, onOuvrir }: { projet: string; entree: LigneEntree; onOuvrir: () => void }) {
  return <button type="button" onClick={onOuvrir} className="flex w-full flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px] text-left hover:border-encre-3">
    <Vignette projet={projet} entree={entree.identifiant} media={entree.vignette} />
    <div className="flex flex-wrap items-center gap-[4px]">
      <span className={`${pastille} ${TON[entree.etat] ?? "text-encre-3"}`}>{entree.nom_etat}{entree.etat === "a-trancher" && entree.portes.length > 1 && entree.nom_porte ? ` · ${entree.nom_porte}` : ""}</span>
      {entree.nouveau && <span className={`${pastille} border-signal text-signal`}>Nouveau</span>}
      {entree.mis_a_jour && <span className={`${pastille} border-signal text-signal`}>Mis à jour</span>}
      {entree.versions > 1 && <span className={`${pastille} text-encre-3`}>v{entree.version}</span>}
    </div>
    <span className="text-[14px] font-medium text-encre">{entree.titre}</span>
    {entree.resume && <span className="line-clamp-2 text-[12.5px] text-encre-3">{entree.resume}</span>}
    {entree.attend && <span className="text-[12px] text-encre-attention">Bloque : {entree.attend}</span>}
    <span className="text-[11.5px] text-encre-4">{entree.nom_type} · {entree.auteur} · {date(entree.maj_le)}</span>
  </button>
}

function FicheEntree({ projet, identifiant, onChange, onErreur, suivante }: {
  projet: string; identifiant: string; onChange: () => void; onErreur: (e: unknown) => void; suivante?: () => void
}) {
  const [entree, setEntree] = useState<Entree | null>(null)
  const [mot, setMot] = useState("")
  const [remarque, setRemarque] = useState("")
  const [cible, setCible] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [loupe, setLoupe] = useState<string | null>(null)
  const [dit, setDit] = useState("")

  const relire = useCallback(() => { registre.lire(projet, identifiant).then(setEntree).catch(onErreur) }, [projet, identifiant, onErreur])
  useEffect(() => { relire(); void registre.vu(projet, [identifiant]) }, [relire, projet, identifiant])
  useEffect(() => {
    const ecoute = (ev: Event) => { if ((ev as CustomEvent).detail?.entree === identifiant) relire() }
    window.addEventListener(EVENEMENT_REGISTRE, ecoute)
    return () => window.removeEventListener(EVENEMENT_REGISTRE, ecoute)
  }, [relire, identifiant])

  const agir = async (geste: () => Promise<Entree>, message?: string) => {
    setOccupe(true)
    try {
      const vue = await geste()
      setEntree(vue)
      setDit(vue.deja ? "C'était déjà fait : rien de neuf n'est écrit." : message ?? "")
      onChange()
    } catch (e) { onErreur(e) } finally { setOccupe(false) }
  }

  if (!entree) return <p className="p-[30px] text-[13px] text-encre-3">Lecture de l'entrée…</p>
  const pris = new Set(entree.pris ?? [])
  const prendre = (code: string) => {
    const codes = pris.has(code) ? [...pris].filter((c) => c !== code) : [...pris, code]
    void agir(() => registre.prendre(projet, identifiant, codes), pris.has(code) ? "Proposition reposée." : "C'est pris.")
  }

  return <article className="flex flex-col gap-[22px] p-[30px]" aria-label={entree.titre}>
    <div className="flex flex-wrap items-start justify-between gap-[14px]">
      <div className="max-w-[880px]">
        <div className="mb-[8px] flex flex-wrap items-center gap-[4px]">
          <span className={`${pastille} ${TON[entree.etat] ?? "text-encre-3"}`} data-etat={entree.etat}>{entree.nom_etat}</span>
          {entree.portes.length > 1 && entree.portes.map((p) => <span key={p.cle} className={`${pastille} ${p.passee ? "border-trait-ok text-encre-ok" : "text-encre-3"}`}>{p.passee ? "✓ " : ""}{p.nom}</span>)}
          <span className={`${pastille} text-encre-3`}>{entree.nom_type}</span>
          {entree.versions > 1 && <span className={`${pastille} text-encre-3`}>v{entree.version}</span>}
        </div>
        <h2 className="font-serif text-[25px] text-encre">{entree.titre}</h2>
        {entree.resume && <p className="mt-[4px] text-[14px] text-encre-2">{entree.resume}</p>}
        <p className="mt-[4px] text-[12px] text-encre-3">Déposée par {entree.auteur} · {date(entree.maj_le)}{entree.change ? ` · ce qui a changé : ${entree.change}` : ""}</p>
        {entree.attend && <p className="mt-[8px] text-[13px] text-encre-attention">Ce que ta décision débloque : {entree.attend}</p>}
        {entree.reprise && <p className="mt-[8px] text-[13px] text-encre-attention">Reprise demandée : « {entree.reprise} »</p>}
      </div>
      {suivante && <button className={bouton} onClick={suivante}>Suivante ›</button>}
    </div>

    <Gestes entree={entree} occupe={occupe} mot={mot} setMot={setMot}
      decider={(geste, extra, message) => agir(() => registre.decider(projet, identifiant, geste, extra), message)} />
    {dit && <p role="status" className="text-[13px] text-encre-3">{dit}</p>}

    {entree.propositions.length > 0 && <div className={entree.choix ? "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[14px]" : "flex flex-col gap-[14px]"}>
      {entree.propositions.map((m) => <PropositionVue key={m.code} projet={projet} entree={identifiant} media={m} choix={entree.choix}
        prise={pris.has(m.code)} unePrise={pris.size > 0} occupe={occupe} onPrendre={() => prendre(m.code)} onLoupe={setLoupe}
        onRemarquer={() => setCible(m.code)} />)}
    </div>}
    {entree.choix && <p className="text-[12px] text-encre-3">{pris.size ? `Pris : ${[...pris].join(", ")}.` : "Rien de pris pour l'instant."} « Conseillée » est l'avis de l'agent, pas le tien.</p>}

    {entree.corps && <div className="max-w-[880px] whitespace-pre-wrap rounded-8 border border-trait bg-carte p-[22px] text-[14px] leading-relaxed text-encre-2">{entree.corps}</div>}

    <section aria-label="Remarques" className="max-w-[880px]">
      <h3 className="mb-[8px] font-serif text-[25px] text-encre">Remarques</h3>
      <ul className="flex flex-col gap-[8px]">
        {entree.remarques.map((r) => <li key={r.repere} className="rounded-7 border border-trait bg-carte p-[14px] text-[13px]">
          <div className="flex justify-between gap-[8px] text-[12px] text-encre-3"><span>{r.sorte === "question" ? "Question" : r.sorte === "aime" ? "J'aime" : "Remarque"}{r.cible ? ` · sur ${r.cible}` : ""} · v{r.version} · {date(r.le)}</span><span className={pastille}>{r.nom_etat}</span></div>
          <p className="mt-[4px] text-encre">{r.texte}</p>
          {r.reponses.map((rep) => <p key={rep.repere} className="mt-[8px] border-l-2 border-trait pl-[8px] text-encre-2"><span className="text-encre-3">{rep.qui} :</span> {rep.texte || `« ${rep.etat} »`}</p>)}
        </li>)}
      </ul>
      <form className="mt-[8px] flex flex-col gap-[8px]" onSubmit={(ev) => {
        ev.preventDefault()
        if (!remarque.trim()) return
        void agir(() => registre.remarquer(projet, identifiant, remarque, "remarque", cible), "Remarque envoyée.").then(() => { setRemarque(""); setCible(null) })
      }}>
        <label className="text-[12px] text-encre-3" htmlFor={`remarque-${identifiant}`}>Une remarque{cible ? ` sur ${cible}` : " sur toute l'entrée"}{cible && <button type="button" className="ml-[8px] underline" onClick={() => setCible(null)}>sur toute l'entrée</button>}</label>
        <textarea id={`remarque-${identifiant}`} value={remarque} onChange={(ev) => setRemarque(ev.target.value)} className="min-h-[70px] rounded-7 border border-contour bg-carte p-[8px] text-[13px]" />
        <button className={`${bouton} self-start`} disabled={occupe || !remarque.trim()}>Envoyer la remarque</button>
      </form>
    </section>

    {entree.histoire.length > 0 && <details className="max-w-[880px]">
      <summary className="cursor-pointer text-[13px] text-encre-3">Les versions précédentes · {entree.histoire.length}</summary>
      <ul className="mt-[14px] flex flex-col gap-[14px]">{entree.histoire.map((v) => <li key={v.numero} className="rounded-8 border border-trait bg-carte p-[14px]">
        <p className="text-[13px] text-encre">v{v.numero} · {date(v.le)}{v.change ? ` · ${v.change}` : ""}</p>
        <div className="mt-[8px] flex flex-wrap gap-[8px]">{v.medias.filter((m) => m.genre === "image").map((m) => <img key={m.code} src={adresseDuMedia(projet, identifiant, m) ?? ""} alt={m.legende ?? m.code} className="h-[81px] rounded-5 object-contain [image-rendering:pixelated]" />)}</div>
        {v.dit.length > 0 && <ul className="mt-[8px] text-[12.5px] text-encre-2">{v.dit.map((e) => <li key={e.repere}>{date(e.le)} · {decrire(e)}</li>)}</ul>}
      </li>)}</ul>
    </details>}

    <details className="max-w-[880px]">
      <summary className="cursor-pointer text-[13px] text-encre-3">Le journal de l'entrée · {entree.journal.length}</summary>
      <ul className="mt-[8px] flex flex-col gap-[4px] text-[12.5px]">{entree.journal.map((e) => <li key={e.repere} className="flex items-center justify-between gap-[8px]">
        <span><span className="text-encre-3">{date(e.le)} · {e.qui === "auteur" ? "toi" : e.qui}</span> · {decrire(e)}</span>
        {e.annulable && <button className="text-[12px] text-encre-3 underline" disabled={occupe} onClick={() => void agir(() => registre.annuler(projet, e.repere), "Annulé.")}>Annuler</button>}
      </li>)}</ul>
    </details>

    {loupe && <div role="dialog" aria-label="La loupe" className="fixed inset-0 z-50 flex items-center justify-center bg-encre/70 p-[30px]" onClick={() => setLoupe(null)}>
      <img src={loupe} alt="" className="max-h-full max-w-full bg-carte object-contain [image-rendering:pixelated]" />
    </div>}
  </article>
}

function decrire(e: { genre: string; geste?: string; porte?: string | null; mot?: string | null; codes?: string[]; texte?: string; version?: number; change?: string | null; statut?: string }) {
  switch (e.genre) {
    case "depot": return `déposée (v${e.version})`
    case "version": return `nouvelle version v${e.version}${e.change ? ` — ${e.change}` : ""}`
    case "maj": return "légendes mises à jour"
    case "decision": return ({ valider: "validé", reprise: "reprise demandée", ecarter: "écartée", pause: "mise en pause", relancer: "relancée" } as Record<string, string>)[e.geste ?? ""] + (e.porte && e.porte !== "validation" ? ` (${e.porte})` : "") + (e.mot ? ` — « ${e.mot} »` : "")
    case "choix": return e.codes?.length ? `pris : ${e.codes.join(", ")}` : "aucune proposition prise"
    case "remarque": return `remarque — « ${e.texte} »`
    case "reponse": return `réponse — ${e.texte || ""}`
    case "statut": return `statut : ${e.statut}`
    case "attente": return e.texte ? `bloque : ${e.texte}` : "ne bloque plus rien"
    default: return e.genre
  }
}

function Gestes({ entree, occupe, mot, setMot, decider }: {
  entree: Entree; occupe: boolean; mot: string; setMot: (m: string) => void
  decider: (geste: string, extra?: { porte?: string; mot?: string }, message?: string) => Promise<void>
}) {
  const ferme = entree.etat === "ecartee" || entree.etat === "en-pause"
  const sansChoix = entree.choix && !(entree.pris && entree.pris.length)
  return <div className="flex flex-wrap items-center gap-[8px]" aria-label="Décider">
    {ferme
      ? <button className={boutonFort} disabled={occupe} onClick={() => void decider("relancer", {}, "Relancée : de nouveau à trancher.")}>Relancer</button>
      : <>
          {entree.porte && <button className={boutonFort} disabled={occupe || sansChoix} title={sansChoix ? "Prends d'abord une proposition" : undefined}
            onClick={() => void decider("valider", { porte: entree.porte! }, "Validé.")}>Valider{entree.portes.length > 1 ? ` ${entree.nom_porte?.toLowerCase()}` : ""}</button>}
          <input aria-label="Ce qu'il faut reprendre" placeholder="Ce qu'il faut reprendre…" value={mot} onChange={(ev) => setMot(ev.target.value)} className="min-h-[34px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" />
          <button className={bouton} disabled={occupe || !mot.trim()} onClick={() => void decider("reprise", { mot }, "Reprise demandée.").then(() => setMot(""))}>Demander une reprise</button>
          <button className={bouton} disabled={occupe} onClick={() => void decider("pause", {}, "Mise en pause.")}>Mettre en pause</button>
          <button className={bouton} disabled={occupe} onClick={() => void decider("ecarter", {}, "Écartée : elle sort de la vue, l'histoire la garde.")}>Écarter</button>
        </>}
  </div>
}

function PropositionVue({ projet, entree, media, choix, prise, unePrise, occupe, onPrendre, onLoupe, onRemarquer }: {
  projet: string; entree: string; media: Media; choix: boolean; prise: boolean; unePrise: boolean; occupe: boolean
  onPrendre: () => void; onLoupe: (src: string) => void; onRemarquer: () => void
}) {
  const src = adresseDuMedia(projet, entree, media)
  const sousTitres = adresseDesSousTitres(projet, entree, media)
  return <figure className={`flex flex-col gap-[8px] rounded-8 border bg-carte p-[14px] ${prise ? "border-encre" : "border-trait"}`} data-prise={prise || undefined}>
    {media.genre === "image" && src && <button type="button" className="damier-papier flex min-h-[240px] items-center justify-center overflow-hidden rounded-7" onClick={() => onLoupe(src)} aria-label={`Agrandir ${media.code}`}>
      <img src={src} alt={media.legende ?? media.code} className="max-h-[380px] max-w-full object-contain [image-rendering:pixelated]" />
    </button>}
    {media.genre === "video" && src && <video controls src={src} className="w-full rounded-7">{sousTitres && <track kind="subtitles" src={sousTitres} srcLang="fr" label="Français" default />}</video>}
    {media.genre === "audio" && src && <audio controls src={src} className="w-full" />}
    {media.genre === "texte" && <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap text-[13px] text-encre-2">{media.texte}</pre>}
    <figcaption className="flex flex-col gap-[4px] text-[13px]">
      <span className="flex flex-wrap items-center gap-[4px]"><span className="mesure text-encre-3">{media.code}</span>{media.conseil && <span className={`${pastille} text-encre-3`}>Conseillée par l'agent</span>}{prise && <span className={`${pastille} border-encre text-encre`}>Prise</span>}</span>
      {media.legende && <span className="text-encre">{media.legende}</span>}
      {media.defauts && <span className="text-[12px] text-encre-attention">Défauts relevés : {media.defauts}</span>}
    </figcaption>
    <div className="mt-auto flex flex-wrap gap-[8px]">
      {choix && <button className={prise || unePrise ? bouton : boutonFort} disabled={occupe} aria-pressed={prise} onClick={onPrendre}>{prise ? "Reposer" : unePrise ? "Je prends aussi celle-ci" : "Je prends celle-ci"}</button>}
      <button className={bouton} onClick={onRemarquer}>Une remarque ici</button>
    </div>
  </figure>
}

function CreerUneEntree({ projet, accueil, onCree, onErreur }: { projet: string; accueil: Accueil; onCree: (id: string) => void; onErreur: (e: unknown) => void }) {
  const [titre, setTitre] = useState("")
  const [type, setType] = useState(accueil.reglages.types[0]?.cle ?? "")
  const [rayon, setRayon] = useState("")
  const [resume, setResume] = useState("")
  const [fichiers, setFichiers] = useState<File[]>([])
  const [occupe, setOccupe] = useState(false)
  const choix = fichiers.length > 1
  const creer = async () => {
    setOccupe(true)
    try {
      const medias = []
      for (const f of fichiers) medias.push({ fichier: (await registre.televerser(projet, f)).fichier })
      const vue = await registre.creer(projet, { titre, type, resume, choix, medias, ...(rayon ? { rayon } : {}) })
      onCree(vue.identifiant)
    } catch (e) { onErreur(e) } finally { setOccupe(false) }
  }
  const champ = "min-h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]"
  return <form className="mx-[30px] mt-[14px] grid max-w-[880px] grid-cols-2 gap-[14px] rounded-8 border border-trait bg-carte p-[22px]" onSubmit={(ev) => { ev.preventDefault(); void creer() }} aria-label="Nouvelle entrée">
    <label className="col-span-2 flex flex-col gap-[4px] text-[12px] text-encre-3">Titre<input className={champ} value={titre} onChange={(ev) => setTitre(ev.target.value)} required /></label>
    <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Type<select className={champ} value={type} onChange={(ev) => setType(ev.target.value)}>{accueil.reglages.types.map((t) => <option key={t.cle} value={t.cle}>{t.nom}</option>)}</select></label>
    <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Rayon<select className={champ} value={rayon} onChange={(ev) => setRayon(ev.target.value)}><option value="">Sans rayon</option>{accueil.reglages.rayons.map((r) => <option key={r.cle} value={r.cle}>{r.nom}</option>)}</select></label>
    <label className="col-span-2 flex flex-col gap-[4px] text-[12px] text-encre-3">Résumé<textarea className={`${champ} min-h-[76px] py-[8px]`} value={resume} onChange={(ev) => setResume(ev.target.value)} /></label>
    <label className="col-span-2 flex flex-col gap-[4px] text-[12px] text-encre-3">Images, vidéos, sons ou textes{choix ? " · plusieurs fichiers : une entrée à choix" : ""}<input type="file" multiple onChange={(ev) => setFichiers([...(ev.target.files ?? [])])} /></label>
    <button className={`${boutonFort} col-span-2 justify-self-start`} disabled={occupe || !titre.trim()}>Créer l'entrée</button>
  </form>
}
