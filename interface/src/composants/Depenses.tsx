// L'écran des dépenses — où est passé l'argent, et ce que chaque appel a donné.
//
// **Ce qu'il remplace, et pourquoi il fallait le remplacer.** La colonne de
// gauche de la galerie portait un journal des appels ratés. Il tenait une
// promesse juste — *il faut pouvoir expliquer une facture* — pour **un cas sur
// trois**, et mesuré sur la base du dépôt, celui qui n'a jamais rien coûté. Un
// appel qui réussit, qu'on paie, et dont on ne garde rien n'apparaissait nulle
// part : ni dans la galerie, qui montre ce qu'on a gardé, ni dans le journal,
// qui montrait ce qui avait échoué. C'est pourtant le seul cas où l'argent est
// vraiment perdu.
//
// **Trois colonnes, `300px · 1fr · 380px`.** Ranger à gauche, lire au milieu,
// détailler à droite — la forme du carnet et de la galerie, réemployée pour ce
// qu'elle sait faire (`docs/archive/maquettes-v2.1/30-les-depenses.html`).
//
// **Ce n'est pas une grille d'assets, et une seule chose le garantit** : aucune
// vignette dans la liste. Une par ligne ferait de cet écran une seconde galerie,
// et la galerie fait déjà ça mieux — l'image est à droite, pour l'appel qu'on a
// choisi. Les filtres, eux, y sont : ils portent sur des **appels**, pas sur des
// images, et chacun répond à une question qu'on se pose vraiment devant une
// facture. C'est l'arbitrage A-24 de `docs/archive/v21-arbitrages.md`, pris en
// construisant : le document du produit disait le contraire, et c'est lui qui a
// été corrigé.
//
// **Rien ne se paie ni ne s'efface depuis cet écran.** C'est le seul du produit
// dont c'est vrai des deux côtés à la fois, et son pied le dit.
//
// **Passé au papier en `C8`.** Le carnet le monte depuis « Les dépenses », et
// c'est ce qui a changé — le journal, les filtres et la fiche d'un appel
// restent ceux d'avant, seuls les jetons ont bougé.

import { useEffect, useMemo, useState } from "react"
import {
  api,
  depense,
  dollars,
  estArgent,
  quantite,
  type Asset,
  type Depense,
  type Depenses,
  type Generation,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { PANNEAU } from "./Infobulle"

// ── Ce qu'un appel a donné ──────────────────────────────────────────────────

type Issue = "garde" | "perdu" | "refuse"

/** Trois états, trois marques — la même pastille que la place de recette
 *  (`Retouche.tsx`) : pleine quand ça a donné quelque chose, un anneau quand
 *  c'est parti sans rien rendre, un trait quand ça n'a pas eu lieu du tout. */
const MARQUES: Record<Issue, { nom: string; explication: string }> = {
  garde: { nom: "gardé", explication: "l'image est en bibliothèque" },
  perdu: {
    nom: "payé pour rien",
    explication: "la génération a réussi, elle a été facturée, rien n'en est resté",
  },
  refuse: { nom: "refusé", explication: "la génération a échoué avant de rendre une image" },
}

/** L'issue d'un appel entier, déduite de ses emplacements.
 *
 *  **Un appel qui a gardé quelque chose est gardé**, même s'il a perdu le reste :
 *  c'est la lecture de la ligne, et la colonne de droite dit le détail. La
 *  hiérarchie suit ce qu'on vient chercher — d'abord *ai-je quelque chose*,
 *  ensuite *ai-je payé pour rien*, enfin *a-t-on refusé*. */
function issue(appel: Depense): Issue {
  if (appel.garde > 0) return "garde"
  if (appel.perdu > 0) return "perdu"
  return "refuse"
}

function Marque({ pour }: { pour: Issue }) {
  const commun = "inline-block h-[8px] w-[8px] shrink-0 rounded-5"
  if (pour === "garde") return <span aria-hidden className={`${commun} bg-ok`} />
  if (pour === "perdu")
    return <span aria-hidden className={`${commun} border border-echec bg-transparent`} />
  return <span aria-hidden className={`${commun} border border-trait bg-transparent`} />
}

// ── Ce qu'on lit d'une ligne ────────────────────────────────────────────────

const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" })

/** Le nom court du modèle — **le fournisseur reste, l'éditeur part**.
 *
 *  `OpenRouter:openai/gpt-image-2` devient `OpenRouter · gpt-image-2`. La règle
 *  d'avant la V2.2 était de tout couper avant la barre oblique, et sa raison
 *  était écrite : *le fournisseur est le même pour tous, il ne distingue rien*.
 *  Elle a cessé d'être vraie en F1. Ce qui est coupé est l'éditeur du modèle —
 *  `openai`, `google` —, qui ne distingue toujours rien puisque le nom qui suit
 *  est déjà unique chez son fournisseur ; ce qui reste est celui à qui l'appel
 *  a été payé, et c'est la question que cet écran pose. */
const court = (modele: string) => {
  const coupe = modele.indexOf(":")
  const chezLui = modele.slice(coupe + 1)
  const sansEditeur = chezLui.split("/").pop() ?? chezLui
  return coupe < 0 ? sansEditeur : `${modele.slice(0, coupe)} · ${sansEditeur}`
}

/** Le sujet d'un appel — **la chose du jeu, jamais le texte envoyé**. */
function sujet(appel: Depense): { nom: string; precision: string | null } {
  if (!appel.personnage)
    return { nom: appel.projet ? "aucun personnage" : "hors jeu", precision: null }
  return { nom: appel.personnage, precision: appel.pose ?? "sans pose" }
}

// ── L'écran ─────────────────────────────────────────────────────────────────

type Portee = "jeu" | "tout"
type Periode = "semaine" | "tout"

const SEMAINE_S = 7 * 24 * 3600

export function EcranDepenses({
  projetCourant,
  onErreur,
  onFermer,
}: {
  projetCourant: string | null
  onErreur: (raison: string) => void
  /** La sortie — le fil d'Ariane du carnet ramène ici, et Échap fait la même
   *  chose. */
  onFermer: () => void
}) {
  const [tout, setTout] = useState<Depenses | null>(null)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [recherche, setRecherche] = useState("")
  const [portee, setPortee] = useState<Portee>("jeu")
  const [periode, setPeriode] = useState<Periode>("semaine")
  const [issueVoulue, setIssueVoulue] = useState<Issue | null>(null)
  const [agentSeul, setAgentSeul] = useState(false)

  // **Un seul aller-retour, à l'ouverture.** L'écran ne s'abonne à rien : une
  // dépense est un fait passé, et rien de ce qu'on y fait ne la change. Le seul
  // événement qui pourrait la bouger — une image supprimée — se produit dans la
  // galerie, qu'on a quittée pour venir ici.
  useEffect(() => {
    let vivant = true
    api
      .depenses()
      .then((recu) => vivant && setTout(recu))
      .catch(() => vivant && onErreur("les dépenses n'ont pas pu être lues"))
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // **Échap ramène d'où l'on venait.**
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  const appels = tout?.appels ?? []

  /** Ce que les quatre filtres laissent passer.
   *
   *  **Quatre, et pas un de plus.** Chacun répond à une question qu'on se pose
   *  vraiment devant une facture ; tout le reste se lit en descendant la liste.
   *  Le modèle n'en est pas un — filtrer par modèle répond à *lequel coûte le
   *  plus*, et le total de gauche y répond mieux en un coup d'œil. */
  const retenus = useMemo(() => {
    const mot = recherche.trim().toLowerCase()
    // Le plus récent d'abord : c'est l'ordre de la liste, et la borne de la
    // période se prend sur lui plutôt que sur l'horloge — un atelier laissé
    // trois jours ne doit pas s'ouvrir sur une liste vide.
    const dernier = appels.length ? appels[0].cree_le : 0
    return appels.filter((appel) => {
      if (portee === "jeu" && appel.projet !== projetCourant) return false
      if (periode === "semaine" && dernier - appel.cree_le > SEMAINE_S) return false
      if (issueVoulue && issue(appel) !== issueVoulue) return false
      if (agentSeul && appel.provenance !== "agent") return false
      if (mot) {
        // **La recherche cherche le sujet, pas le texte envoyé.** Taper un mot
        // du texte de style les retrouverait tous, puisque ce texte est presque
        // le même partout — et une recherche qui rend tout n'est pas une
        // recherche.
        const dans = `${appel.personnage ?? ""} ${appel.pose ?? ""} ${court(appel.modele)}`
        if (!dans.toLowerCase().includes(mot)) return false
      }
      return true
    })
  }, [appels, recherche, portee, periode, issueVoulue, agentSeul, projetCourant])

  /** Les appels groupés par jour, avec le total du jour. Le jour est écrit une
   *  fois en tête du groupe ; l'heure suffit ensuite, et c'est elle qui rend une
   *  rafale visible — quatre appels entre 10 h 02 et 10 h 13 se voient sans
   *  rien calculer. */
  const jours = useMemo(() => {
    const paquets: { jour: string; appels: Depense[]; cout_usd: number }[] = []
    for (const appel of retenus) {
      const jour = JOUR.format(new Date(appel.cree_le * 1000))
      const dernier = paquets[paquets.length - 1]
      if (dernier && dernier.jour === jour) {
        dernier.appels.push(appel)
        dernier.cout_usd += appel.cout_usd
      } else {
        paquets.push({ jour, appels: [appel], cout_usd: appel.cout_usd })
      }
    }
    return paquets
  }, [retenus])

  const comptes = useMemo(() => {
    const par: Record<Issue, number> = { garde: 0, perdu: 0, refuse: 0 }
    for (const appel of appels) par[issue(appel)] += 1
    return par
  }, [appels])

  const ouvert = appels.find((a) => a.identifiant === choisi) ?? null

  return (
    <div data-depenses className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)_380px] bg-papier">
      <ColonneTotaux
        tout={tout}
        comptes={comptes}
        issueVoulue={issueVoulue}
        onIssue={setIssueVoulue}
        agentSeul={agentSeul}
        onAgentSeul={setAgentSeul}
        appels={appels.length}
        parAgent={appels.filter((a) => a.provenance === "agent").length}
      />

      <section className="flex min-h-0 min-w-0 flex-col border-r border-trait">
        <div className="flex h-[34px] shrink-0 items-center gap-[8px] border-b border-trait px-[8px]">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un sujet…"
            aria-label="Chercher un sujet dans les dépenses"
            className="mesure h-[26px] w-[128px] shrink rounded-5 border border-trait bg-carte px-[8px] text-[11px] text-encre placeholder:text-encre-4 outline-none focus:border-encre-4"
          />
          {/* `ce jeu`, et non le nom du projet : le nom est déjà dans le fil
              d'Ariane à deux bandes d'ici, et il fait vingt signes qui poussent
              le reste de la barre dehors. */}
          <Bascule
            valeurs={[
              { cle: "jeu", nom: "ce jeu" },
              { cle: "tout", nom: "tous les jeux" },
            ]}
            valeur={portee}
            onChange={(v) => setPortee(v as Portee)}
          />
          <span aria-hidden className="h-[14px] w-px shrink-0 bg-trait" />
          <Bascule
            valeurs={[
              { cle: "semaine", nom: "7 derniers jours" },
              { cle: "tout", nom: "tout" },
            ]}
            valeur={periode}
            onChange={(v) => setPeriode(v as Periode)}
          />
          {/* **Le total en argent, et ce qui est parti sans argent à côté**
              (F2). Jamais additionnés : un total en dollars reste un total en
              dollars, et une quantité de jetons ne s'y fond pas. */}
          <span className="mesure ml-auto shrink-0 whitespace-nowrap text-[10.5px] text-encre-3">
            {retenus.length} génération{retenus.length > 1 ? "s" : ""} ·{" "}
            {dollars(retenus.reduce((somme, a) => somme + a.cout_usd, 0))}
            {sansArgent(retenus).map((ligne) => (
              <span key={ligne.unite}> · {quantite(ligne.quantite, ligne.unite)}</span>
            ))}
          </span>
          <button
            type="button"
            onClick={onFermer}
            className="mesure h-[26px] shrink-0 rounded-5 border border-trait bg-carte px-[8px] text-[10.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
          >
            Fermer — Échap
          </button>
        </div>

        <BandeauClipsEnSouffrance />

        <div className="defile min-h-0 flex-1 overflow-y-auto">
          {tout === null && (
            <p className="mesure p-[14px] text-[10.5px] text-encre-3">on relit la base…</p>
          )}
          {tout !== null && retenus.length === 0 && (
            <p className="mesure p-[14px] text-[10.5px] text-encre-3">
              rien à cet endroit-là — les filtres de gauche disent ce qu'il y a ailleurs
            </p>
          )}
          {jours.map((paquet) => (
            <div key={paquet.jour}>
              <div className="mesure flex h-[26px] items-center gap-[8px] border-b border-trait bg-papier-cote px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
                <span>{paquet.jour}</span>
                <span className="normal-case tracking-normal">
                  · {paquet.appels.length} génération{paquet.appels.length > 1 ? "s" : ""}
                </span>
                {/* Le total du jour en argent, et ce qui est parti sans argent
                    à côté (F2). */}
                <span className="ml-auto normal-case tracking-normal text-encre-2">
                  {dollars(paquet.cout_usd)}
                  {sansArgent(paquet.appels).map((ligne) => (
                    <span key={ligne.unite} className="text-encre-3">
                      {" "}
                      · {quantite(ligne.quantite, ligne.unite)}
                    </span>
                  ))}
                </span>
              </div>
              {paquet.appels.map((appel, rang) => (
                <Ligne
                  key={appel.identifiant}
                  appel={appel}
                  choisi={appel.identifiant === choisi}
                  onChoisir={() => setChoisi(appel.identifiant)}
                  /* Le crochet d'une rafale se dessine sur les lignes qui la
                     composent, et il se ferme quand la suivante n'en est plus.
                     Il n'ajoute aucune rangée : une rafale n'est pas un objet
                     qu'on ouvre, c'est une forme qu'on remarque. */
                  rafaleDebut={
                    appel.rafale !== null &&
                    appel.rafale !== paquet.appels[rang - 1]?.rafale
                  }
                  rafaleFin={
                    appel.rafale !== null &&
                    appel.rafale !== paquet.appels[rang + 1]?.rafale
                  }
                />
              ))}
            </div>
          ))}
        </div>

        {/* Le seul écran du produit qui ne dépense ni n'efface, et il le dit. */}
        <div className="mesure flex h-[26px] shrink-0 items-center gap-[14px] border-t border-trait px-[8px] text-[10.5px] text-encre-3">
          <span>
            {appels.length} génération{appels.length > 1 ? "s" : ""} ·{" "}
            {appels.reduce((somme, a) => somme + a.garde, 0)} images gardées
          </span>
          <span className="ml-auto">rien ne se paie ni ne s'efface depuis cet écran</span>
        </div>
      </section>

      <FicheAppel appel={ouvert} depenses={tout} />
    </div>
  )
}

// ── Les clips payés qui attendent (B2) ──────────────────────────────────────
//
// **De l'argent déjà dépensé qui dort.** `GET /clips/pending` et
// `POST /clips/{id}/recover` existent depuis le 4 septembre — un clip payé
// chez le fournisseur mais jamais rapatrié se récupère sans repayer — et
// aucun écran ne le montrait. C'est le seul geste de tout le produit qui
// rende de l'argent déjà parti, et sa place est ici, au-dessus du journal.
//
// **Le bandeau n'existe pas s'il n'y a rien à montrer** : pas de bloc vide.

function BandeauClipsEnSouffrance() {
  const [clips, setClips] = useState<Generation[] | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [echoues, setEchoues] = useState<Record<string, string>>({})

  useEffect(() => {
    let vivant = true
    api
      .clipsEnSouffrance()
      .then((recu) => vivant && setClips(recu.clips))
      .catch(() => vivant && setClips([]))
    return () => {
      vivant = false
    }
  }, [])

  async function recuperer(identifiant: string) {
    setEnCours(identifiant)
    try {
      const rendu = await api.recupererClip(identifiant)
      const emplacement = rendu.emplacements[0]
      // **Le fournisseur a pu expirer le lien.** La route répond quand même
      // 200 — ce n'est pas la requête qui a échoué, c'est le rapatriement —
      // et l'échec se lit sur l'emplacement, avec sa raison écrite par le
      // serveur. Rien n'est facturé dans les deux cas.
      if (emplacement.statut === "echouee" || emplacement.statut === "interrompue") {
        setEchoues((e) => ({
          ...e,
          [identifiant]: emplacement.raison ?? "le clip n'a pas pu être récupéré",
        }))
      } else {
        setClips((c) => (c ?? []).filter((g) => g.identifiant !== identifiant))
      }
    } catch {
      setEchoues((e) => ({
        ...e,
        [identifiant]: "le clip n'a pas pu être récupéré",
      }))
    } finally {
      setEnCours(null)
    }
  }

  if (clips === null || clips.length === 0) return null

  const total = clips.reduce((somme, g) => somme + g.cout_usd, 0)

  return (
    <div
      data-clips-en-souffrance
      className="mesure flex shrink-0 flex-col gap-[8px] border-b border-trait bg-papier-cote px-[14px] py-[8px]"
    >
      <p className="text-[10.5px] text-encre-2">
        <strong className="font-semibold text-encre">
          {clips.length} clip{clips.length > 1 ? "s" : ""} payé
          {clips.length > 1 ? "s" : ""}
        </strong>{" "}
        {clips.length > 1 ? "attendent" : "attend"} d'être récupéré
        {clips.length > 1 ? "s" : ""} · {dollars(total)}
      </p>
      <div className="flex flex-col gap-[6px]">
        {clips.map((clip) => (
          <div key={clip.identifiant} className="flex items-center gap-[8px] text-[10.5px]">
            <span className="min-w-0 flex-1 truncate text-encre-2">
              {clip.personnage ?? "sans personnage"}
              {clip.pose && <span className="text-encre-3"> · {clip.pose}</span>}
            </span>
            {/* **Le geste reste proposable après un échec** — le lien peut
                avoir expiré une fois et pas la suivante, et rien n'oblige à
                refermer l'écran pour réessayer. */}
            {echoues[clip.identifiant] && (
              <span className="shrink-0 text-echec">{echoues[clip.identifiant]}</span>
            )}
            <button
              type="button"
              onClick={() => recuperer(clip.identifiant)}
              disabled={enCours === clip.identifiant}
              className="mesure h-[22px] shrink-0 rounded-5 border border-trait bg-carte px-[8px] text-[10.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:opacity-55"
            >
              {enCours === clip.identifiant
                ? "récupération…"
                : echoues[clip.identifiant]
                  ? "Réessayer"
                  : "Récupérer sans repayer"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── La colonne de gauche ────────────────────────────────────────────────────

function EnTete({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
      {children}
    </div>
  )
}

function ColonneTotaux({
  tout,
  comptes,
  issueVoulue,
  onIssue,
  agentSeul,
  onAgentSeul,
  appels,
  parAgent,
}: {
  tout: Depenses | null
  comptes: Record<Issue, number>
  issueVoulue: Issue | null
  onIssue: (issue: Issue | null) => void
  agentSeul: boolean
  onAgentSeul: (seul: boolean) => void
  appels: number
  parAgent: number
}) {
  return (
    <aside
      {...PANNEAU}
      className="flex min-h-0 flex-col border-r border-trait bg-papier-cote"
    >
      <EnTete>Ce qui a été dépensé</EnTete>
      <div className="defile min-h-0 flex-1 overflow-y-auto p-[8px]">
        {/* **Le total de l'atelier entier**, et c'est la seule chose qu'on
            vient chercher ici et qu'on ne trouve nulle part ailleurs. */}
        <Total nom="l'atelier, en tout" montant={tout?.total_usd ?? 0} gros />
        {(tout?.par_projet ?? []).map((p) => (
          <Total key={p.projet} nom={p.nom} montant={p.cout_usd} />
        ))}
        {/* **Les onze pour cent qu'aucun écran ne montrait** : ce qui a été
            dépensé sans qu'aucun jeu soit ouvert. */}
        <Total nom="hors jeu" montant={tout?.sans_projet_usd ?? 0} signale />

        {/* **Ce qui s'est consommé sans argent, sous le total et non dedans**
            (F2). Absent tant qu'aucun appel gratuit n'est parti. */}
        {(tout?.par_unite ?? []).map((u) => (
          <Total
            key={u.unite}
            nom={`et, sans argent, ${u.appels} génération${u.appels > 1 ? "s" : ""}`}
            texte={quantite(u.quantite, u.unite)}
          />
        ))}

        <div className="my-[14px] h-px bg-trait" />

        <EnTeteRubrique>Par modèle</EnTeteRubrique>
        {(tout?.par_modele ?? []).map((m) => (
          <Total
            key={m.modele}
            nom={court(m.modele)}
            montant={m.cout_usd}
            texte={estArgent(m.unite) ? undefined : quantite(m.consomme, m.unite)}
          />
        ))}

        <div className="my-[14px] h-px bg-trait" />

        <EnTeteRubrique>Ne montrer que</EnTeteRubrique>
        <Choix
          nom="tout"
          compte={appels}
          allume={issueVoulue === null && !agentSeul}
          onChoisir={() => {
            onIssue(null)
            onAgentSeul(false)
          }}
        />
        {(["garde", "perdu", "refuse"] as const).map((cle) => (
          <Choix
            key={cle}
            nom={MARQUES[cle].nom}
            marque={cle}
            compte={comptes[cle]}
            allume={issueVoulue === cle}
            onChoisir={() => onIssue(issueVoulue === cle ? null : cle)}
          />
        ))}

        <div className="my-[14px] h-px bg-trait" />

        {/* « Qu'est-ce que l'agent a dépensé sans moi ? » */}
        <Choix
          nom="demandé par l'agent"
          compte={parAgent}
          allume={agentSeul}
          onChoisir={() => onAgentSeul(!agentSeul)}
        />
      </div>
    </aside>
  )
}

function EnTeteRubrique({ children }: { children: React.ReactNode }) {
  return (
    <p className="mesure mb-[4px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
      {children}
    </p>
  )
}

function Total({
  nom,
  montant,
  texte,
  gros = false,
  signale = false,
}: {
  nom: string
  /** Le montant en argent. Ignoré quand `texte` est donné. */
  montant?: number
  /** Ce qu'on écrit à droite quand ce n'est pas de l'argent — « 7 jetons »
   *  (F2). La colonne reste alignée. */
  texte?: string
  gros?: boolean
  /** **Le rouille ne sert qu'à deux choses : le bouton qui lance, et le
   *  chiffre qui coûte.** Une seule ligne de cette colonne le porte — le
   *  compte hors jeu, le seul que le produit cachait tout à fait. */
  signale?: boolean
}) {
  return (
    <p className="mesure flex h-[26px] items-center gap-[8px] text-[11px]">
      <span className={signale ? "text-signal" : gros ? "text-encre" : "text-encre-2"}>
        {nom}
      </span>
      {/* Aligné à droite, chiffres de même largeur : c'est la colonne qu'on
          parcourt du regard en descendant, et des montants alignés se
          comparent sans être lus. */}
      <span
        className={[
          "ml-auto tabular-nums",
          signale ? "text-signal" : gros ? "text-encre" : "text-encre-2",
        ].join(" ")}
      >
        {texte ?? dollars(montant ?? 0)}
      </span>
    </p>
  )
}

/** Ce qui s'est consommé **sans argent** dans ce lot d'appels, par unité (F2).
 *
 *  Calculé ici et non côté serveur : la barre du haut compte ce que les filtres
 *  ont retenu, et le serveur ne connaît pas les filtres. Le total de gauche,
 *  lui, vient du serveur et compte tout. */
function sansArgent(appels: Depense[]): { unite: string; quantite: number }[] {
  const comptes = new Map<string, number>()
  for (const appel of appels) {
    if (estArgent(appel.unite) || !appel.consomme) continue
    comptes.set(appel.unite, (comptes.get(appel.unite) ?? 0) + appel.consomme)
  }
  return [...comptes.entries()]
    .map(([unite, quantite]) => ({ unite, quantite }))
    .sort((a, b) => a.unite.localeCompare(b.unite))
}

function Choix({
  nom,
  marque,
  compte,
  allume,
  onChoisir,
}: {
  nom: string
  marque?: Issue
  compte: number
  allume: boolean
  onChoisir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={allume}
      className={[
        "mesure flex h-[26px] w-full items-center gap-[8px] rounded-5 px-[4px] text-[11px] transition-colors duration-120",
        allume ? "bg-ligne-ouverte text-encre" : "text-encre-2 hover:bg-papier",
      ].join(" ")}
    >
      {marque && <Marque pour={marque} />}
      <span>{nom}</span>
      <span className="ml-auto tabular-nums text-encre-4">{compte}</span>
    </button>
  )
}

// ── Une ligne ───────────────────────────────────────────────────────────────

function Bascule({
  valeurs,
  valeur,
  onChange,
}: {
  valeurs: { cle: string; nom: string }[]
  valeur: string
  onChange: (cle: string) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-[4px]">
      {valeurs.map(({ cle, nom }) => (
        <button
          key={cle}
          type="button"
          onClick={() => onChange(cle)}
          aria-pressed={valeur === cle}
          className={[
            "mesure h-[26px] rounded-5 border px-[8px] text-[10.5px] transition-colors duration-120",
            valeur === cle
              ? "border-encre-4 bg-carte text-encre"
              : "border-trait bg-papier text-encre-3 hover:text-encre-2",
          ].join(" ")}
        >
          {nom}
        </button>
      ))}
    </div>
  )
}

function Ligne({
  appel,
  choisi,
  onChoisir,
  rafaleDebut,
  rafaleFin,
}: {
  appel: Depense
  choisi: boolean
  onChoisir: () => void
  rafaleDebut: boolean
  rafaleFin: boolean
}) {
  const quoi = issue(appel)
  const { nom, precision } = sujet(appel)
  return (
    <div
      className={[
        "px-[8px]",
        appel.rafale ? "border-l-2 border-l-encre-4" : "border-l-2 border-l-transparent",
        rafaleDebut ? "pt-[4px]" : "",
        rafaleFin ? "pb-[4px]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onChoisir}
        aria-pressed={choisi}
        className={[
          "mesure flex h-[26px] w-full items-center gap-[14px] rounded-5 px-[4px] text-[11px] transition-colors duration-120",
          choisi ? "bg-ligne-ouverte text-encre" : "text-encre-2 hover:bg-papier",
        ].join(" ")}
      >
        <span className="w-[34px] shrink-0 tabular-nums text-encre-3">
          {HEURE.format(new Date(appel.cree_le * 1000))}
        </span>
        {/* Ce que ça a donné, lu en premier : c'est la seule chose qui distingue
            une dépense utile d'une dépense perdue. */}
        <Marque pour={quoi} />
        <span className="min-w-0 flex-1 truncate text-left">
          {appel.personnage ? (
            <>
              {nom}
              {precision && <span className="text-encre-3"> · {precision}</span>}
            </>
          ) : (
            <span className="text-encre-3">{nom}</span>
          )}
        </span>
        <span className="w-[128px] shrink-0 truncate text-left text-encre-3">
          {court(appel.modele)}
        </span>
        <span className="w-[54px] shrink-0 text-right text-encre-3">
          {appel.variations} img
        </span>
        {/* **« gratuit », jamais « $0,0000 »** (F2) : c'est le mensonge par
            omission que cet écran a été construit pour arrêter. */}
        <span
          className={[
            "w-[70px] shrink-0 text-right tabular-nums",
            appel.consomme > 0 ? "text-encre-2" : "text-encre-3",
          ].join(" ")}
        >
          {depense(appel.cout_usd, appel.unite)}
        </span>
      </button>
    </div>
  )
}

// ── La colonne de droite ────────────────────────────────────────────────────

function FicheAppel({
  appel,
  depenses,
}: {
  appel: Depense | null
  depenses: Depenses | null
}) {
  if (!appel)
    return (
      <aside {...PANNEAU} className="flex min-h-0 flex-col bg-papier-cote">
        <EnTete>La génération choisie</EnTete>
        <p className="mesure p-[8px] text-[10.5px] text-encre-3">
          choisis une ligne — le texte envoyé, l'image revenue et le détail du prix
          sont ici, et pas dans la liste
        </p>
      </aside>
    )

  const quoi = issue(appel)
  const rafale = depenses?.rafales.find((r) => r.identifiant === appel.rafale) ?? null
  // **Dans l'unité de l'appel qu'on regarde** (F2). Sommer les dollars d'un
  // sujet fabriqué gratuitement rendrait zéro, et la ligne disparaîtrait au
  // moment précis où elle a quelque chose à apprendre.
  const surLeSujet = (depenses?.appels ?? [])
    .filter(
      (a) =>
        appel.personnage &&
        a.personnage === appel.personnage &&
        a.unite === appel.unite,
    )
    .reduce((somme, a) => somme + a.consomme, 0)

  return (
    <aside {...PANNEAU} className="flex min-h-0 flex-col bg-papier-cote">
      <EnTete>La génération de {HEURE.format(new Date(appel.cree_le * 1000))}</EnTete>
      <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[8px]">
        <div className="flex flex-col gap-[4px]">
          <Rangee cle_="sujet" valeur={sujet(appel).nom} />
          <Rangee
            cle_="demandé par"
            valeur={appel.provenance === "agent" ? "l'agent" : "l'auteur"}
          />
          <Rangee cle_="modèle" valeur={appel.modele} />
          <Rangee cle_="jeu" valeur={appel.projet_nom ?? "hors jeu"} />
        </div>

        <Bloc titre="Ce que la génération a consommé">
          <Rangee cle_="payé" valeur={depense(appel.cout_usd, appel.unite)} />
          {/* **Ce qu'il a consommé, avec son mot** (F2). */}
          {!estArgent(appel.unite) && (
            <Rangee cle_="consommé" valeur={quantite(appel.consomme, appel.unite)} />
          )}
          <Rangee cle_="images demandées" valeur={String(appel.variations)} />
        </Bloc>

        <Bloc titre="Ce qui est revenu">
          <p className="mesure flex items-center gap-[8px] text-[11px]">
            <Marque pour={quoi} />
            <span className={quoi === "garde" ? "text-ok" : "text-encre-2"}>
              {MARQUES[quoi].nom}
            </span>
            <span className="text-encre-3">— {MARQUES[quoi].explication}</span>
          </p>
          {appel.raison && (
            <p className="mesure mt-[4px] flex items-start gap-[8px] text-[10.5px] text-encre-3">
              <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
              <span>{appel.raison}</span>
            </p>
          )}
          {appel.assets.length > 0 && (
            <div className="mt-[8px] flex flex-wrap gap-[4px]">
              {appel.assets.map((identifiant) => (
                <VignetteDeDepense key={identifiant} identifiant={identifiant} />
              ))}
            </div>
          )}
        </Bloc>

        {/* **Ce qui est parti**, en entier et sans rien de masqué. */}
        <Bloc titre={`Ce qui est parti · ${appel.prompt.length} caractères`}>
          <p className="mesure text-[10.5px] leading-relaxed break-words text-encre-2">
            {appel.prompt || "—"}
          </p>
        </Bloc>

        {(rafale || surLeSujet > 0) && (
          <div className="border-l-2 border-signal pl-[8px]">
            <p className="mesure mb-[4px] text-[10.5px] tracking-[0.14em] text-signal uppercase">
              Ce que la liste dit de cette génération
            </p>
            {rafale && (
              <Rangee
                cle_={`${rafale.appels} générations d'affilée sur ce sujet`}
                valeur={`${Math.max(1, Math.round((rafale.fin - rafale.debut) / 60))} min · ${
                  estArgent(rafale.unite)
                    ? dollars(rafale.cout_usd)
                    : quantite(rafale.consomme, rafale.unite)
                }`}
                signale
              />
            )}
            {appel.personnage && (
              <Rangee
                cle_={`parti sur ${appel.personnage}`}
                valeur={quantite(surLeSujet, appel.unite)}
                signale
              />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

/** Une vignette de ce qui est revenu. */
function VignetteDeDepense({ identifiant }: { identifiant: string }) {
  const [asset, setAsset] = useState<Asset | null>(null)
  useEffect(() => {
    let vivant = true
    api
      .lireAsset(identifiant)
      .then((recu) => vivant && setAsset(recu))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [identifiant])
  const sujet = asset ? sujetAsset(asset) : null
  const visee = useVisee(sujet)
  if (!sujet) return null
  return (
    <img
      src={sujet.src}
      alt={sujet.titre}
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      className="damier-papier h-[54px] w-[54px] object-contain"
    />
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="mesure mb-[4px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
        {titre}
      </p>
      {children}
    </div>
  )
}

function Rangee({
  cle_,
  valeur,
  signale = false,
}: {
  cle_: string
  valeur: string
  signale?: boolean
}) {
  return (
    <p className="mesure flex h-[26px] items-center gap-[8px] text-[11px]">
      <span className={signale ? "text-encre-2" : "text-encre-3"}>{cle_}</span>
      <span
        className={["ml-auto truncate", signale ? "text-signal" : "text-encre-2"].join(" ")}
      >
        {valeur}
      </span>
    </p>
  )
}
