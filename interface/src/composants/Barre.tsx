/**
 * La barre — **on l'appelle au clavier, elle ne paie jamais** (B6).
 *
 * `docs/archive/pistes-2026-09-04/carnet/Barre.dc.html`. Deux choses, et pas une
 * troisième : *chercher un sujet*, et *lancer un geste qui n'est nulle part à
 * l'écran*. La troisième zone du châssis — par-dessus le carnet et la surface,
 * jamais à côté d'eux.
 *
 * **Elle n'a aucune liste d'actions à elle.** Ce qu'elle propose vient de
 * `GET /api/actions`, qui sert les outils de l'agent avec, sur chacun, ce que
 * la barre a besoin de savoir en plus. Une fonction ajoutée au serveur y paraît
 * sans qu'on touche à ce fichier — c'est toute la tranche, et
 * `tests/test_b6.py` le tient.
 *
 * **Elle ne peut pas payer, et ce n'est pas une précaution : c'est une
 * impossibilité.** Une action qui coûte arrive sans route. Il n'y a rien à
 * appeler, donc `activer` ne peut qu'ouvrir l'écran d'envoi. Le jour où
 * quelqu'un réécrira cet écran, la règle tiendra encore — elle n'est pas
 * gardée ici.
 *
 * **On ne tape pas un prompt ici.** La barre cherche des *noms* : personnages,
 * pièces, images, générations, gestes. Le texte qui part à l'IA s'écrit sur
 * l'écran d'envoi, où le prix est sous les yeux.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  dollars,
  type Action,
  type Asset,
  type Generation,
  type Personnage,
  type Piece,
  type Pose,
  type Verbe,
} from "../api"

// ── Ouvrir la barre depuis n'importe où ─────────────────────────────────────
//
// Le patron du guide, et pour la même raison : elle s'appelle au clavier depuis
// n'importe quel écran, et on ne fait pas descendre un rappel à travers quatre
// étages pour un écran qui se pose par-dessus tout.

let ouverte = false
const abonnes = new Set<() => void>()

function prevenir() {
  abonnes.forEach((f) => f())
}

export function ouvrirBarre() {
  ouverte = true
  prevenir()
}

export function fermerBarre() {
  if (!ouverte) return
  ouverte = false
  prevenir()
}

export function useBarre() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    () => ouverte,
    () => false,
  )
}

/** Ce qui ouvre la barre, **écrit comme la machine le dit**.
 *
 *  Le pied du carnet l'annonçait `⌘K` depuis `B0`, sur toutes les machines. Or
 *  l'atelier tourne sur celle de l'auteur, et sur Windows cette touche-là
 *  n'existe pas : la barre y répond à `Ctrl`. Une touche annoncée qui ne répond
 *  pas est pire que pas d'annonce du tout — on la cherche.
 *
 *  **Les deux fonctionnent partout** : `App.tsx` écoute `ctrlKey` et `metaKey`
 *  sans distinction. Ce qui change ici est seulement ce qui est écrit. */
export const TOUCHE_DE_LA_BARRE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘K"
    : "Ctrl K"

/** Remettre la barre à zéro — les essais d'écran, comme pour le guide. */
export function reinitialiserBarre() {
  ouverte = false
  prevenir()
}

// ── Les six verbes ──────────────────────────────────────────────────────────
//
// **Leur ordre vient du serveur**, qui trie déjà avec. Ce qui est écrit ici
// n'est que leur nom d'affichage : la barre groupe ce qu'elle reçoit dans
// l'ordre où elle le reçoit, sans jamais le retrier.

const TITRES: Record<Verbe, string> = {
  aller: "Aller à",
  creer: "Créer",
  generer: "Générer — à confirmer sur l'écran suivant",
  travailler: "Travailler",
  sortir: "Sortir",
  regler: "Régler",
}

// ── Ce que la barre trouve ──────────────────────────────────────────────────

/** Un résultat, quelle que soit sa nature — un sujet trouvé ou un geste servi.
 *
 *  Les deux se rendent de la même façon, et c'est ce qui fait que la barre se
 *  parcourt d'une seule flèche : le clavier ne connaît qu'une liste. */
type Resultat = {
  cle: string
  verbe: Verbe
  titre: string
  /** Le contexte : de quel sujet, quelle pose, quelle génération. Sans lui, un
   *  résultat « aller à » ne dit pas où il mène. */
  sous: string
  /** Ce qui s'affiche à droite : « gratuit », un prix, ou rien. */
  prix: string
  /** Vrai pour une action payante — la seule qui porte la marque rouille. */
  aConfirmer: boolean
  faire: () => void
}

/** Sans accent et sans casse — on cherche « epee » et on trouve « épée ». */
function aplati(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function contient(texte: string, cherche: string): boolean {
  return aplati(texte).includes(cherche)
}

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" })

// ── L'écran ─────────────────────────────────────────────────────────────────

export function Barre({
  actions,
  personnages,
  pieces,
  images,
  chantier,
  plan,
  surUnPersonnage,
  surUnePiece,
  surUneImage,
  surUneGeneration,
  surUnLieu,
  surEnvoi,
  surJouer,
  onFermer,
}: {
  /** Ce que le serveur sait faire, déjà filtré et déjà trié par lui. */
  actions: readonly Action[]
  personnages: readonly Personnage[]
  pieces: readonly Piece[]
  images: readonly Asset[]
  chantier: readonly Generation[]
  plan: readonly Pose[]
  surUnPersonnage: (identifiant: string) => void
  surUnePiece: (identifiant: string) => void
  surUneImage: (identifiant: string) => void
  surUneGeneration: (identifiant: string) => void
  /** Le lieu du carnet où une action mène — `galerie`, `codex`, `univers`… */
  surUnLieu: (ou: string) => void
  /** Une action qui coûte : l'écran d'envoi s'ouvre, déjà rempli. **Rien n'est
   *  lancé ni payé ici**, et la barre n'aurait pas de quoi le faire. */
  surEnvoi: (action: Action) => void
  /** Un geste gratuit qui se fait sur place, par la route que le serveur a
   *  servie — la barre n'en connaît aucune par cœur. */
  surJouer: (action: Action) => void
  onFermer: () => void
}) {
  const [tape, setTape] = useState("")
  const [choisi, setChoisi] = useState(0)
  const champ = useRef<HTMLInputElement>(null)
  const liste = useRef<HTMLDivElement>(null)

  useEffect(() => {
    champ.current?.focus()
  }, [])

  const cherche = aplati(tape.trim())

  /** Le nom d'une pose, pour le contexte d'une image. Le plan est déjà en
   *  mémoire : on ne redemande rien pour écrire une ligne de sous-titre. */
  const nomDeLaPose = useMemo(() => {
    const noms = new Map(plan.map((p) => [p.identifiant, p.nom]))
    return (identifiant: string | null) => (identifiant ? (noms.get(identifiant) ?? identifiant) : "")
  }, [plan])

  const nomDuPersonnage = useMemo(() => {
    const noms = new Map(personnages.map((p) => [p.identifiant, p.nom]))
    return (identifiant: string | null) => (identifiant ? (noms.get(identifiant) ?? "") : "")
  }, [personnages])

  /** Ce qu'on trouve, dans l'ordre où le carnet le range : les sujets d'abord —
   *  c'est ce qu'on cherche neuf fois sur dix —, puis les images, puis ce qui
   *  est en train de se fabriquer.
   *
   *  **Six par nature, et pas davantage.** Une barre qui déroule quarante
   *  personnages n'est plus une barre, c'est une grille mal faite ; la grille
   *  d'une famille est à un clic, et elle est faite pour ça. */
  const trouves: Resultat[] = useMemo(() => {
    if (cherche.length < 2) return []
    const sortie: Resultat[] = []

    for (const p of personnages) {
      if (sortie.length >= 6) break
      if (!contient(p.nom, cherche) && !contient(p.description, cherche)) continue
      const tenues = p.cases.filter((c) => c.images.length > 0).length
      sortie.push({
        cle: `personnage:${p.identifiant}`,
        verbe: "aller",
        titre: `Le personnage ${p.nom}`,
        sous: `${tenues} poses sur ${p.cases.length} · ${p.description}`,
        prix: "gratuit",
        aConfirmer: false,
        faire: () => surUnPersonnage(p.identifiant),
      })
    }

    const avantPieces = sortie.length
    for (const piece of pieces) {
      if (sortie.length - avantPieces >= 6) break
      if (!contient(piece.nom, cherche) && !contient(piece.description, cherche)) continue
      sortie.push({
        cle: `piece:${piece.identifiant}`,
        verbe: "aller",
        titre: `La pièce ${piece.nom}`,
        sous: [piece.emplacement, piece.description].filter(Boolean).join(" · "),
        prix: "gratuit",
        aConfirmer: false,
        faire: () => surUnePiece(piece.identifiant),
      })
    }

    const avantImages = sortie.length
    for (const image of images) {
      if (sortie.length - avantImages >= 6) break
      if (!contient(image.label, cherche)) continue
      sortie.push({
        cle: `image:${image.identifiant}`,
        verbe: "aller",
        titre: `L'image ${image.label}`,
        // Le contexte que le critère réclame : de quel sujet, quelle pose.
        sous: [
          nomDuPersonnage(image.personnage),
          nomDeLaPose(image.pose),
          `${image.rendu_largeur} × ${image.rendu_hauteur}`,
          image.favori ? "gardée" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        prix: "gratuit",
        aConfirmer: false,
        faire: () => surUneImage(image.identifiant),
      })
    }

    const avantGenerations = sortie.length
    for (const generation of chantier) {
      if (sortie.length - avantGenerations >= 6) break
      if (!contient(generation.demande.prompt, cherche)) continue
      sortie.push({
        cle: `generation:${generation.identifiant}`,
        verbe: "aller",
        titre: "La génération qui l'a fabriquée",
        sous: [
          JOUR.format(new Date(generation.cree_le * 1000)),
          generation.cout_usd > 0 ? dollars(generation.cout_usd) : "gratuit",
          generation.modele,
        ]
          .filter(Boolean)
          .join(" · "),
        prix: "gratuit",
        aConfirmer: false,
        faire: () => surUneGeneration(generation.identifiant),
      })
    }

    return sortie
  }, [
    cherche,
    personnages,
    pieces,
    images,
    chantier,
    nomDeLaPose,
    nomDuPersonnage,
    surUnPersonnage,
    surUnePiece,
    surUneImage,
    surUneGeneration,
  ])

  /** Les gestes servis, filtrés sur ce qu'on tape — et **jamais retriés** : le
   *  serveur a déjà décidé de l'ordre des verbes. */
  const gestes: Resultat[] = useMemo(
    () =>
      actions
        .filter((a) => !cherche || contient(a.titre, cherche) || contient(a.phrase, cherche))
        .map((action) => ({
          cle: `action:${action.outil}`,
          verbe: action.verbe,
          titre: action.titre,
          sous: action.phrase,
          prix: action.paiement === "a-confirmer" ? "" : "gratuit",
          aConfirmer: action.paiement === "a-confirmer",
          faire: () => {
            // **Les trois seuls chemins possibles**, et le premier est le seul
            // qui appelle quoi que ce soit. Une action à confirmer n'a pas de
            // route : elle ne peut pas prendre cette branche.
            if (action.route && action.ou === "ici") surJouer(action)
            else if (action.ou === "envoi") surEnvoi(action)
            else surUnLieu(action.ou)
          },
        })),
    [actions, cherche, surJouer, surEnvoi, surUnLieu],
  )

  const tout = useMemo(() => [...trouves, ...gestes], [trouves, gestes])

  // Ce qu'on tape change ce qu'on voit : la sélection revient en tête, sinon
  // elle désignerait une ligne qui n'est plus là.
  useEffect(() => {
    setChoisi(0)
  }, [tape])

  const activer = (rang: number) => {
    const resultat = tout[rang]
    if (!resultat) return
    onFermer()
    resultat.faire()
  }

  const surTouche = (evenement: React.KeyboardEvent) => {
    if (evenement.key === "Escape") {
      evenement.preventDefault()
      onFermer()
      return
    }
    if (evenement.key === "ArrowDown") {
      evenement.preventDefault()
      setChoisi((rang) => Math.min(rang + 1, Math.max(tout.length - 1, 0)))
      return
    }
    if (evenement.key === "ArrowUp") {
      evenement.preventDefault()
      setChoisi((rang) => Math.max(rang - 1, 0))
      return
    }
    if (evenement.key === "Enter") {
      evenement.preventDefault()
      activer(choisi)
    }
  }

  // La ligne choisie reste visible quand on descend au clavier.
  useEffect(() => {
    liste.current?.querySelector('[data-choisi="oui"]')?.scrollIntoView({ block: "nearest" })
  }, [choisi])

  // **Les groupes se déduisent de l'ordre, ils ne le refont pas.** Un titre
  // paraît quand le verbe change — c'est le serveur qui a rangé.
  let precedent: Verbe | null = null

  return (
    <div
      className="fixed inset-0 z-50 bg-papier/85"
      onMouseDown={onFermer}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="La barre"
        data-barre
        className="mx-auto mt-[9%] flex max-w-[880px] flex-col overflow-hidden rounded-10 border border-contour bg-carte"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={surTouche}
      >
        {/* ── Ce qu'on tape ────────────────────────────────────────────── */}
        <div className="flex h-[54px] items-center gap-[14px] border-b border-trait-faible px-[22px]">
          <span aria-hidden className="text-[15px] text-encre-4">
            ⌕
          </span>
          <input
            ref={champ}
            value={tape}
            onChange={(e) => setTape(e.target.value)}
            placeholder="Un nom, ou un geste"
            aria-label="Chercher un sujet ou un geste"
            // **Pas de cadre de mise au point ici, et c'est le seul du
            // produit.** La règle générale d'`index.css` — un liseré rouille
            // sur ce qui a la main — vaut pour un écran où la main se déplace ;
            // ce champ-ci l'a en naissant et ne la rend jamais, si bien que le
            // liseré ne signalerait rien et vaudrait un second rouille à
            // l'écran, à côté de « à confirmer ». C'est le curseur qui le
            // porte, comme sur la planche. La règle hors couche d'`index.css`
            // bat toute classe utilitaire : l'exception y est écrite, sur
            // `[data-barre] input`.
            className="font-serif caret-signal h-[34px] min-w-0 flex-1 bg-carte text-[25px] text-encre outline-none placeholder:text-encre-4"
          />
        </div>

        {/* ── Ce qu'on trouve ──────────────────────────────────────────── */}
        <div ref={liste} className="defile max-h-[60vh] overflow-y-auto py-[4px]">
          {tout.length === 0 && (
            <p className="px-[22px] py-[22px] text-[13px] text-encre-3">
              {cherche.length === 1
                ? "Encore une lettre."
                : "Rien de ce nom-là dans ce jeu."}
            </p>
          )}
          {tout.map((resultat, rang) => {
            const titre = resultat.verbe !== precedent ? TITRES[resultat.verbe] : null
            precedent = resultat.verbe
            return (
              <div key={resultat.cle}>
                {titre && (
                  <div
                    data-groupe={resultat.verbe}
                    className="mesure px-[22px] pt-[14px] pb-[4px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
                    {titre}
                  </div>
                )}
                <button
                  type="button"
                  data-choisi={rang === choisi ? "oui" : "non"}
                  onMouseEnter={() => setChoisi(rang)}
                  onClick={() => activer(rang)}
                  className={[
                    "flex w-full items-center gap-[14px] px-[22px] py-[8px] text-left transition-colors duration-120",
                    rang === choisi ? "bg-ligne-ouverte" : "bg-carte",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-encre">
                      {resultat.titre}
                    </span>
                    {resultat.sous && (
                      <span className="block truncate text-[12.5px] text-encre-3">
                        {resultat.sous}
                      </span>
                    )}
                  </span>
                  {resultat.aConfirmer ? (
                    // **La seule marque rouille de l'écran**, et elle ne lance
                    // rien : elle annonce l'écran suivant.
                    <span className="mesure shrink-0 rounded-5 border border-trait px-[8px] text-[12px] text-signal">
                      à confirmer
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12.5px] text-encre-4">
                      {resultat.prix}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Le pied ──────────────────────────────────────────────────── */}
        <div className="flex h-[34px] items-center justify-between gap-[22px] border-t border-trait-faible bg-papier px-[22px]">
          <span className="flex items-center gap-[14px] text-[12px] text-encre-3">
            <span>↵ y aller</span>
            <span>↑ ↓ choisir</span>
            <span>échap refermer</span>
          </span>
          <span className="text-[12px] text-encre-3">
            {actions.length} action{actions.length > 1 ? "s" : ""} disponible
            {actions.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}
