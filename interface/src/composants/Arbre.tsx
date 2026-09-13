// L'arbre — 300 px, la colonne du carnet de `docs/DESIGN.md` § Largeurs de
// colonne.
//
// Elle naît avec la bibliothèque (T3). L'afficher plus tôt aurait montré du
// cadrage au lieu de servir le geste — c'est exactement ce qui a fait écarter
// `docs/archive/maquette-atelier.html`.
//
// Elle porte trois choses, et c'est le même sujet vu de trois hauteurs : **où
// ça se range** (projets, collections), **ce que ça coûte** (le total du projet
// ouvert), et **ce qui a raté** (le journal). Le journal est ici et pas dans la
// grille parce qu'un appel raté a coûté de l'argent sans produire d'image :
// dans la grille il salirait ce qu'on peut réutiliser (US-23), nulle part il
// empêcherait d'expliquer une facture (US-24).
//
// **Portée au papier le 11 septembre 2026 (`D4`)**, avec `BarreOutils.tsx` :
// aucune planche ne la dessine — `Galerie.dc.html` (`D3`) ne couvre que la
// grille, la tuile, la fiche et le pied. Le porche reste donc celui d'avant :
// mêmes rangées, même structure, le vocabulaire papier de `pieces.tsx` et les
// listes fermées de `docs/DESIGN.md`. Sa largeur passe de 240 à **300** — la
// colonne « le carnet », fixe, toujours là.
//
// Rangée de 26 px, compteur en mono, aucune couleur de plus : `--signal` pour
// l'élément ouvert, `--echec` pour un raté, `--encre-attention` pour un
// interrompu.

import { useEffect, useState } from "react"
import {
  api,
  depense,
  dollars,
  heure,
  Refus,
  type Bibliotheque,
  type Journal,
} from "../api"
import { EnTetePanneau, Raison } from "./pieces"

export function Arbre({
  bibliotheque,
  collection,
  onCollection,
  onErreur,
  onRelancer,
}: {
  bibliotheque: Bibliotheque
  /** Le filtre de collection, à l'intérieur du projet ouvert. */
  collection: string | null
  onCollection: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  onRelancer: (generation: string, rang: number) => void
}) {
  const [nouveau, setNouveau] = useState<"projet" | "collection" | null>(null)
  const [nom, setNom] = useState("")
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const courant = bibliotheque.courant
  const collections = bibliotheque.collections.filter(
    (c) => c.projet === null || c.projet === courant,
  )

  const echouer = (erreur: unknown, defaut: string) =>
    onErreur(erreur instanceof Refus ? erreur.message : defaut)

  const creer = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      if (nouveau === "projet") await api.creerProjet(propre)
      else await api.creerCollection(propre, courant)
      setNom("")
      setNouveau(null)
    } catch (erreur) {
      echouer(erreur, "création refusée")
    }
  }

  const ouvrir = async (projet: string | null) => {
    onCollection(null)
    try {
      await api.ouvrirProjet(projet)
    } catch (erreur) {
      echouer(erreur, "ce projet ne s'ouvre pas")
    }
  }

  const supprimer = async (identifiant: string) => {
    setASupprimer(null)
    try {
      await api.supprimerProjet(identifiant)
    } catch (erreur) {
      echouer(erreur, "suppression refusée")
    }
  }

  return (
    <aside
      data-carnet
      className="flex min-h-0 w-[300px] shrink-0 flex-col border-r border-trait bg-papier-cote"
    >
      <EnTetePanneau>
        <span>Projet</span>
        <span className="mesure ml-auto text-encre-4">
          {dollars(bibliotheque.total_usd)}
        </span>
      </EnTetePanneau>

      <div className="defile flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section
          titre="Projets"
          onAjouter={() => {
            setNouveau("projet")
            setNom("")
          }}
        >
          {bibliotheque.projets.map((projet) => (
            <div key={projet.identifiant} className="flex flex-col">
              <Rangee
                nom={projet.nom}
                compte={projet.assets}
                mesure={dollars(projet.total_usd)}
                ouverte={courant === projet.identifiant && collection === null}
                onOuvrir={() => void ouvrir(projet.identifiant)}
                onSupprimer={() => setASupprimer(projet.identifiant)}
              />
              {/* « Supprimer un projet annonce le nombre d'assets concernés »
                  (US-30). Annoncé **avant**, en ligne, sans fenêtre par-dessus :
                  ce produit n'a aucune surface modale, et le compte vient de
                  l'arbre — que le serveur a compté. */}
              {aSupprimer === projet.identifiant && (
                <div className="flex flex-col gap-1 border-l-2 border-trait-echec bg-fond-echec px-2 py-1.5">
                  <p className="mesure text-[10.5px] leading-4 text-encre-3">
                    {projet.assets === 0
                      ? "aucun asset — rien à détacher"
                      : `${projet.assets} asset${projet.assets > 1 ? "s" : ""} seront détachés, pas détruits`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void supprimer(projet.identifiant)}
                      className="mesure text-[10.5px] text-echec hover:text-encre"
                    >
                      Supprimer ›
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer(null)}
                      className="mesure text-[10.5px] text-encre-4 hover:text-encre-2"
                    >
                      Garder
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* Ce qu'une suppression de projet a détaché. La rangée n'existe que
              s'il y a quelque chose dedans : une ligne « Sans projet » toujours
              présente et toujours vide serait du cadrage affiché. */}
          {bibliotheque.sans_projet.assets > 0 && (
            <Rangee
              nom="Sans projet"
              compte={bibliotheque.sans_projet.assets}
              mesure={dollars(bibliotheque.sans_projet.total_usd)}
              ouverte={courant === null && collection === null}
              onOuvrir={() => void ouvrir(null)}
            />
          )}
        </Section>

        <Section
          titre="Collections"
          onAjouter={() => {
            setNouveau("collection")
            setNom("")
          }}
        >
          {collections.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-encre-4">
              rien encore — une collection regroupe sans contraindre
            </p>
          ) : (
            collections.map((c) => (
              <Rangee
                key={c.identifiant}
                nom={c.nom}
                compte={c.sujets}
                ouverte={collection === c.identifiant}
                onOuvrir={() =>
                  onCollection(collection === c.identifiant ? null : c.identifiant)
                }
                onSupprimer={async () => {
                  try {
                    await api.supprimerCollection(c.identifiant)
                    if (collection === c.identifiant) onCollection(null)
                  } catch (erreur) {
                    echouer(erreur, "suppression refusée")
                  }
                }}
              />
            ))
          )}
        </Section>

        {nouveau && (
          <div className="flex flex-col gap-1 px-2 pb-2">
            <input
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void creer()
                if (e.key === "Escape") setNouveau(null)
              }}
              placeholder={nouveau === "projet" ? "nom du projet" : "nom de la collection"}
              className="h-[34px] rounded-5 border border-contour bg-carte px-2 text-[12px] text-encre placeholder:text-encre-4"
            />
            <Raison texte="Entrée pour créer, Échap pour renoncer" />
          </div>
        )}

        <JournalDuProjet projet={courant} onErreur={onErreur} onRelancer={onRelancer} />
      </div>
    </aside>
  )
}

// ── Une rangée ──────────────────────────────────────────────────────────────

function Rangee({
  nom,
  compte,
  mesure,
  ouverte,
  onOuvrir,
  onSupprimer,
}: {
  nom: string
  compte: number
  mesure?: string
  ouverte: boolean
  onOuvrir: () => void
  onSupprimer?: () => void
}) {
  return (
    <div
      className={[
        "group flex h-[26px] items-center gap-2 border-l-2 pr-1 pl-2",
        ouverte ? "border-signal bg-carte" : "border-transparent",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onOuvrir}
        className={[
          "min-w-0 flex-1 truncate text-left text-[12px]",
          ouverte ? "text-encre" : "text-encre-2 hover:text-encre",
        ].join(" ")}
      >
        {nom}
      </button>
      {mesure && (
        <span className="mesure hidden text-[10.5px] text-encre-4 group-hover:inline">
          {mesure}
        </span>
      )}
      <span className="mesure w-6 shrink-0 text-right text-[10.5px] text-encre-4">
        {compte}
      </span>
      {onSupprimer && (
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Supprimer ${nom}`}
          className="mesure w-3 shrink-0 text-[10.5px] text-transparent group-hover:text-encre-4 hover:!text-echec"
        >
          ×
        </button>
      )}
    </div>
  )
}

function Section({
  titre,
  onAjouter,
  children,
}: {
  titre: string
  onAjouter: () => void
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col border-b border-trait py-1">
      <div className="mesure flex h-[26px] items-center px-2 text-[10.5px] tracking-[.11em] text-encre-4 uppercase">
        <span>{titre}</span>
        <button
          type="button"
          onClick={onAjouter}
          aria-label={`Nouvelle entrée dans ${titre}`}
          className="ml-auto text-[12px] text-encre-4 hover:text-signal"
        >
          +
        </button>
      </div>
      {children}
    </section>
  )
}

// ── Le journal ──────────────────────────────────────────────────────────────

function JournalDuProjet({
  projet,
  onErreur,
  onRelancer,
}: {
  projet: string | null
  onErreur: (raison: string) => void
  onRelancer: (generation: string, rang: number) => void
}) {
  const [journal, setJournal] = useState<Journal | null>(null)

  // Le journal se relit quand le projet change **et quand un appel rate** —
  // c'est l'écran qui le demande, parce que c'est le seul endroit du produit
  // dont le contenu ne tient pas dans un événement : il agrège des générations.
  useEffect(() => {
    let vivant = true
    api
      .journal(projet)
      .then((lu) => vivant && setJournal(lu))
      .catch((erreur) =>
        onErreur(erreur instanceof Refus ? erreur.message : "journal illisible"),
      )
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projet])

  if (!journal || journal.rates === 0) return null

  const rates = journal.appels.filter((appel) => appel.rates.length > 0)

  return (
    <section className="flex flex-col py-1">
      <div className="mesure flex h-[26px] items-center gap-2 px-2 text-[10.5px] tracking-[.11em] text-encre-4 uppercase">
        <span>Journal</span>
        <span className="ml-auto normal-case tracking-normal">
          {journal.rates} raté{journal.rates > 1 ? "s" : ""} ·{" "}
          {dollars(journal.cout_rate_usd)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 px-2 pb-2">
        {rates.slice(0, 12).map((appel) =>
          appel.rates.map((rate) => (
            <div
              key={`${appel.identifiant}-${rate.rang}`}
              className="flex flex-col gap-[2px] border-l border-trait pl-2"
            >
              <span className="truncate text-[11px] text-encre-2" title={appel.prompt}>
                {appel.prompt}
              </span>
              <span
                className={[
                  "mesure text-[10.5px] leading-4",
                  rate.statut === "interrompue" ? "text-encre-attention" : "text-echec",
                ].join(" ")}
              >
                {rate.raison ?? "échec sans raison connue"}
              </span>
              <span className="mesure flex items-center gap-2 text-[10.5px] text-encre-4">
                <span>{heure(appel.cree_le)}</span>
                {/* « gratuit », jamais « $0,0000 » (F2) — même règle que sur
                    la tuile et dans les dépenses. */}
                <span>{depense(rate.cout_usd, rate.unite)}</span>
                <button
                  type="button"
                  onClick={() => onRelancer(appel.identifiant, rate.rang)}
                  className="ml-auto text-signal hover:opacity-70"
                >
                  Relancer ›
                </button>
              </span>
            </div>
          )),
        )}
      </div>
    </section>
  )
}
