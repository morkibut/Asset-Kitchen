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
// **Trois colonnes, aucune largeur neuve** — `240px · 1fr · 380px`. Ranger à
// gauche, lire au milieu, détailler à droite : la forme de la galerie, réemployée
// pour ce qu'elle sait faire (`docs/maquettes-v2.1/30-les-depenses.html`, au
// paragraphe « L'écran »).
//
// **Ce n'est pas une grille d'assets, et une seule chose le garantit** : aucune
// vignette dans la liste. Une par ligne ferait de cet écran une seconde galerie,
// et la galerie fait déjà ça mieux — l'image est à droite, pour l'appel qu'on a
// choisi. Les filtres, eux, y sont : ils portent sur des **appels**, pas sur des
// images, et chacun répond à une question qu'on se pose vraiment devant une
// facture. C'est l'arbitrage A-24 de `docs/v21-arbitrages.md`, pris en
// construisant : le document du produit disait le contraire, et c'est lui qui a
// été corrigé.
//
// **Rien ne se paie ni ne s'efface depuis cet écran.** C'est le seul du produit
// dont c'est vrai des deux côtés à la fois, et son pied le dit.

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
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { EnTetePanneau } from "./chassis"
import { PANNEAU } from "./Infobulle"

// ── Ce qu'un appel a donné ──────────────────────────────────────────────────

type Issue = "garde" | "perdu" | "refuse"

/** Trois états, trois marques **déjà connues du produit** : le carré plein, le
 *  carré creux, le trait. Aucun glyphe neuf n'entre ici — c'est le vocabulaire
 *  d'état des places de recette, et il dit la même chose : plein, ça a donné
 *  quelque chose ; creux, c'est posé et ça n'a rien donné ; le trait, ça n'a pas
 *  eu lieu. */
const MARQUES: Record<Issue, { nom: string; explication: string }> = {
  garde: { nom: "gardé", explication: "l'image est en bibliothèque" },
  perdu: {
    nom: "payé pour rien",
    explication: "l'appel a réussi, il a été facturé, rien n'en est resté",
  },
  refuse: { nom: "refusé", explication: "l'appel a échoué avant de rendre une image" },
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
  const commun = "inline-block h-[9px] w-[9px] shrink-0"
  if (pour === "garde") return <span aria-hidden className={`${commun} bg-ok`} />
  if (pour === "perdu")
    return <span aria-hidden className={`${commun} border border-epingle`} />
  return <span aria-hidden className="inline-block h-px w-[9px] shrink-0 bg-texte-3" />
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
  /** **La sortie, et elle manquait** — ajoutée le 31 août 2026. Cet écran
   *  s'ouvre par-dessus les trois onglets et n'appartient à aucun ; il n'avait
   *  pourtant ni bouton de fermeture ni touche Échap, et sa seule sortie était
   *  de recliquer un onglet du haut — c'est-à-dire d'aller ailleurs, pas de
   *  revenir d'où l'on venait. */
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

  // **Échap ramène d'où l'on venait** — le geste du Guide et de la vitrine,
  // que cet écran-ci n'avait pas. Rien ne s'y saisit qui doive prendre la
  // touche avant lui : le champ de recherche filtre une liste, il ne compose
  // aucun texte qu'on puisse perdre.
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
    <div data-depenses className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)_380px]">
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

      <section className="flex min-h-0 min-w-0 flex-col border-r border-bord">
        <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-bord px-2">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un sujet…"
            aria-label="Chercher un sujet dans les dépenses"
            className="mesure h-[26px] w-[160px] shrink rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
          />
          {/* `ce jeu`, et non le nom du projet : le nom est déjà dans le fil
              d'Ariane à deux bandes d'ici, et il fait vingt signes qui poussent
              le reste de la barre dehors. Mesuré au navigateur le 31 août 2026
              sur 1 280 px, où le compte de droite passait à la ligne. */}
          <Bascule
            valeurs={[
              { cle: "jeu", nom: "ce jeu" },
              { cle: "tout", nom: "tous les jeux" },
            ]}
            valeur={portee}
            onChange={(v) => setPortee(v as Portee)}
          />
          <span aria-hidden className="h-4 w-px shrink-0 bg-bord" />
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
          <span className="mesure ml-auto shrink-0 whitespace-nowrap text-[10px] text-texte-3">
            {retenus.length} appel{retenus.length > 1 ? "s" : ""} ·{" "}
            {dollars(retenus.reduce((somme, a) => somme + a.cout_usd, 0))}
            {sansArgent(retenus).map((ligne) => (
              <span key={ligne.unite}> · {quantite(ligne.quantite, ligne.unite)}</span>
            ))}
          </span>
          {/* La sortie, écrite avec sa touche — la forme qu'ont déjà le Guide
              et la vitrine. Aucune hauteur neuve : elle prend la fente qui
              existe, au bout de la barre de 38 px. */}
          <button
            type="button"
            onClick={onFermer}
            className="mesure h-[26px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte-2 transition-colors duration-[80ms] hover:bg-fond-3"
          >
            Fermer — Échap
          </button>
        </div>

        <div className="defile min-h-0 flex-1 overflow-y-auto">
          {tout === null && (
            <p className="mesure p-4 text-[10px] text-texte-3">on relit la base…</p>
          )}
          {tout !== null && retenus.length === 0 && (
            <p className="mesure p-4 text-[10px] text-texte-3">
              rien à cet endroit-là — les filtres de gauche disent ce qu'il y a ailleurs
            </p>
          )}
          {jours.map((paquet) => (
            <div key={paquet.jour}>
              <div className="mesure flex h-[26px] items-center gap-2 border-b border-bord bg-fond-1 px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
                <span>{paquet.jour}</span>
                <span className="normal-case tracking-normal">
                  · {paquet.appels.length} appel{paquet.appels.length > 1 ? "s" : ""}
                </span>
                {/* **Le total du jour en argent, et ce qui est parti sans
                    argent à côté** (F2). Une journée dont tous les appels sont
                    gratuits affichait « $0,0000 » — le même mensonge par
                    omission que sur la ligne d'un appel, un cran plus haut. */}
                <span className="ml-auto normal-case tracking-normal text-texte-2">
                  {dollars(paquet.cout_usd)}
                  {sansArgent(paquet.appels).map((ligne) => (
                    <span key={ligne.unite} className="text-texte-3">
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

        {/* Le seul écran du produit qui ne dépense ni n'efface, et il le dit —
            de quoi savoir d'un coup d'œil dans quelle moitié du produit on se
            trouve, exactement comme le pied de la galerie. */}
        <div className="mesure flex h-[26px] shrink-0 items-center gap-4 border-t border-bord px-2 text-[10px] text-texte-3">
          <span>
            {appels.length} appel{appels.length > 1 ? "s" : ""} ·{" "}
            {appels.reduce((somme, a) => somme + a.garde, 0)} images gardées
          </span>
          <span className="ml-auto">rien ne se paie ni ne s'efface depuis cet écran</span>
        </div>
      </section>

      <FicheAppel appel={ouvert} depenses={tout} />
    </div>
  )
}

// ── La colonne de gauche ────────────────────────────────────────────────────

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
      className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
    >
      <EnTetePanneau>Ce qui a été dépensé</EnTetePanneau>
      <div className="defile min-h-0 flex-1 overflow-y-auto p-2">
        {/* **Le total de l'atelier entier**, et c'est la seule chose qu'on
            vient chercher ici et qu'on ne trouve nulle part ailleurs. La barre
            de tête, elle, ne porte que celui du jeu ouvert. */}
        <Total
          nom="l'atelier, en tout"
          montant={tout?.total_usd ?? 0}
          gros
        />
        {(tout?.par_projet ?? []).map((p) => (
          <Total key={p.projet} nom={p.nom} montant={p.cout_usd} />
        ))}
        {/* **Les onze pour cent qu'aucun écran ne montrait** : ce qui a été
            dépensé sans qu'aucun jeu soit ouvert. Ce n'est pas une erreur, c'est
            un fait sur la façon dont l'atelier sert. */}
        <Total nom="hors jeu" montant={tout?.sans_projet_usd ?? 0} epingle />

        {/* **Ce qui s'est consommé sans argent, sous le total et non dedans**
            (F2). *Un total en argent ne compte que de l'argent* : ajouter des
            jetons à des dollars ferait un chiffre qui n'est celui de rien.
            Absent tant qu'aucun appel gratuit n'est parti. */}
        {(tout?.par_unite ?? []).map((u) => (
          <Total
            key={u.unite}
            nom={`et, sans argent, ${u.appels} appel${u.appels > 1 ? "s" : ""}`}
            texte={quantite(u.quantite, u.unite)}
          />
        ))}

        <div className="my-3 h-px bg-bord" />

        <EnTeteRubrique>Par modèle</EnTeteRubrique>
        {(tout?.par_modele ?? []).map((m) => (
          <Total
            key={m.modele}
            nom={court(m.modele)}
            montant={m.cout_usd}
            texte={
              estArgent(m.unite) ? undefined : quantite(m.consomme, m.unite)
            }
          />
        ))}

        <div className="my-3 h-px bg-bord" />

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

        <div className="my-3 h-px bg-bord" />

        {/* « Qu'est-ce que l'agent a dépensé sans moi ? » C'est exactement ce
            que compte le chiffre de la fenêtre des réglages — ici il est à sa
            place, à côté des autres. */}
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
    <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
      {children}
    </p>
  )
}

function Total({
  nom,
  montant,
  texte,
  gros = false,
  epingle = false,
}: {
  nom: string
  /** Le montant en argent. Ignoré quand `texte` est donné. */
  montant?: number
  /** Ce qu'on écrit à droite quand ce n'est pas de l'argent — « 7 jetons »
   *  (F2). La colonne reste alignée : ce qu'on parcourt du regard est la même
   *  colonne, et elle porte parfois un mot au lieu d'un chiffre. */
  texte?: string
  gros?: boolean
  epingle?: boolean
}) {
  return (
    <p className="mesure flex h-[26px] items-center gap-2 text-[10px]">
      <span className={epingle ? "text-epingle" : gros ? "text-texte" : "text-texte-2"}>
        {nom}
      </span>
      {/* Aligné à droite, chiffres de même largeur, quatre décimales : c'est la
          colonne qu'on parcourt du regard en descendant, et des montants alignés
          se comparent sans être lus. */}
      <span
        className={[
          "ml-auto tabular-nums",
          epingle ? "text-epingle" : gros ? "text-texte" : "text-texte-2",
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
        "mesure flex h-[26px] w-full items-center gap-2 rounded-[2px] px-1 text-[10px] transition-colors duration-[80ms]",
        allume ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
      ].join(" ")}
    >
      {marque && <Marque pour={marque} />}
      <span>{nom}</span>
      <span className="ml-auto tabular-nums text-texte-3">{compte}</span>
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
    <div className="flex shrink-0 items-center gap-1">
      {valeurs.map(({ cle, nom }) => (
        <button
          key={cle}
          type="button"
          onClick={() => onChange(cle)}
          aria-pressed={valeur === cle}
          className={[
            "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
            valeur === cle
              ? "border-bord-fort bg-fond-3 text-texte"
              : "border-bord bg-fond-2 text-texte-3 hover:text-texte-2",
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
        "px-2",
        appel.rafale ? "border-l-2 border-l-epingle" : "border-l-2 border-l-transparent",
        rafaleDebut ? "pt-1" : "",
        rafaleFin ? "pb-1" : "",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onChoisir}
        aria-pressed={choisi}
        className={[
          "mesure flex h-[26px] w-full items-center gap-3 rounded-[2px] px-1 text-[10px] transition-colors duration-[80ms]",
          choisi ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
        ].join(" ")}
      >
        <span className="w-[34px] shrink-0 tabular-nums text-texte-3">
          {HEURE.format(new Date(appel.cree_le * 1000))}
        </span>
        {/* Ce que ça a donné, lu en premier : c'est la seule chose qui distingue
            une dépense utile d'une dépense perdue. */}
        <Marque pour={quoi} />
        <span className="min-w-0 flex-1 truncate text-left">
          {appel.personnage ? (
            <>
              {nom}
              {precision && <span className="text-texte-3"> · {precision}</span>}
            </>
          ) : (
            <span className="text-texte-3">{nom}</span>
          )}
        </span>
        <span className="w-[140px] shrink-0 truncate text-left text-texte-3">
          {court(appel.modele)}
        </span>
        <span className="w-[48px] shrink-0 text-right text-texte-3">
          {appel.variations} img
        </span>
        {/* **« gratuit », jamais « $0,0000 »** (F2) : c'est le mensonge par
            omission que cet écran a été construit pour arrêter, un cran plus
            bas. Ce que l'appel a consommé se lit dans la colonne de droite,
            avec son mot. */}
        <span
          className={[
            "w-[64px] shrink-0 text-right tabular-nums",
            appel.consomme > 0 ? "text-texte-2" : "text-texte-3",
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
      <aside {...PANNEAU} className="flex min-h-0 flex-col bg-fond-1">
        <EnTetePanneau>L'appel choisi</EnTetePanneau>
        <p className="mesure p-2 text-[10px] text-texte-3">
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
    <aside {...PANNEAU} className="flex min-h-0 flex-col bg-fond-1">
      <EnTetePanneau>
        L'appel de {HEURE.format(new Date(appel.cree_le * 1000))}
      </EnTetePanneau>
      <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">
          <Rangee cle_="sujet" valeur={sujet(appel).nom} />
          <Rangee
            cle_="demandé par"
            valeur={appel.provenance === "agent" ? "l'agent" : "l'auteur"}
          />
          <Rangee cle_="modèle" valeur={appel.modele} />
          <Rangee cle_="jeu" valeur={appel.projet_nom ?? "hors jeu"} />
        </div>

        <Bloc titre="Ce que l'appel a consommé">
          <Rangee cle_="payé" valeur={depense(appel.cout_usd, appel.unite)} />
          {/* **Ce qu'il a consommé, avec son mot** (F2). La ligne n'apparaît
              que chez un fournisseur qui ne facture pas : chez les autres, elle
              redirait en dollars ce que « payé » vient de dire. */}
          {!estArgent(appel.unite) && (
            <Rangee
              cle_="consommé"
              valeur={quantite(appel.consomme, appel.unite)}
            />
          )}
          <Rangee cle_="images demandées" valeur={String(appel.variations)} />
        </Bloc>

        <Bloc titre="Ce qui est revenu">
          <p className="mesure flex items-center gap-2 text-[10px]">
            <Marque pour={quoi} />
            <span className={quoi === "garde" ? "text-ok" : "text-texte-2"}>
              {MARQUES[quoi].nom}
            </span>
            <span className="text-texte-3">— {MARQUES[quoi].explication}</span>
          </p>
          {appel.raison && (
            <p className="mesure mt-1 flex items-start gap-1.5 text-[10px] text-texte-3">
              <span aria-hidden className="mt-1.5 inline-block h-px w-2 shrink-0 bg-texte-3" />
              <span>{appel.raison}</span>
            </p>
          )}
          {appel.assets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {appel.assets.map((identifiant) => (
                <VignetteDeDepense key={identifiant} identifiant={identifiant} />
              ))}
            </div>
          )}
        </Bloc>

        {/* **Ce qui est parti**, en entier et sans rien de masqué. C'est la
            seule place du produit où le texte d'un appel passé se relit tel
            qu'il est parti — la ligne, elle, ne le montre pas, parce qu'il est
            presque le même partout. */}
        <Bloc titre={`Ce qui est parti · ${appel.prompt.length} caractères`}>
          <p className="mesure text-[10px] leading-relaxed break-words text-texte-2">
            {appel.prompt || "—"}
          </p>
        </Bloc>

        {(rafale || surLeSujet > 0) && (
          <div className="border-l-2 border-epingle pl-2">
            <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-epingle uppercase">
              Ce que la liste dit de cet appel
            </p>
            {rafale && (
              <Rangee
                cle_={`${rafale.appels} appels d'affilée sur ce sujet`}
                valeur={`${Math.max(1, Math.round((rafale.fin - rafale.debut) / 60))} min · ${
                  estArgent(rafale.unite)
                    ? dollars(rafale.cout_usd)
                    : quantite(rafale.consomme, rafale.unite)
                }`}
                epingle
              />
            )}
            {appel.personnage && (
              <Rangee
                cle_={`parti sur ${appel.personnage}`}
                valeur={quantite(surLeSujet, appel.unite)}
                epingle
              />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

/** Une vignette de ce qui est revenu. **La barre d'espace l'ouvre en grand**,
 *  comme toute miniature du produit depuis E0 — c'est la règle, et cet écran
 *  n'a aucune raison d'en être l'exception.
 *
 *  L'asset est relu à la demande plutôt que servi avec la liste : l'adresse
 *  d'une image traitée dépend de son empreinte, et `sujetAsset` est le seul
 *  endroit du produit qui la nomme. Les faire voyager dans la liste ferait
 *  descendre des centaines d'objets pour n'en montrer qu'un. */
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
      className="damier h-[44px] w-[44px] object-contain"
    />
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        {titre}
      </p>
      {children}
    </div>
  )
}

function Rangee({
  cle_,
  valeur,
  epingle = false,
}: {
  cle_: string
  valeur: string
  epingle?: boolean
}) {
  return (
    <p className="mesure flex h-[26px] items-center gap-2 text-[10px]">
      <span className={epingle ? "text-texte-2" : "text-texte-3"}>{cle_}</span>
      <span
        className={["ml-auto truncate", epingle ? "text-epingle" : "text-texte-2"].join(
          " ",
        )}
      >
        {valeur}
      </span>
    </p>
  )
}
