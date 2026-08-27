// L'arbre — 240 px, la première colonne de `docs/DESIGN.md` § Layout.
//
// Elle naît avec la bibliothèque (T3). L'afficher plus tôt aurait montré du
// cadrage au lieu de servir le geste — c'est exactement ce qui a fait écarter
// `docs/maquette-atelier.html`.
//
// Elle porte trois choses, et c'est le même sujet vu de trois hauteurs : **où
// ça se range** (projets, collections), **ce que ça coûte** (le total du projet
// ouvert), et **ce qui a raté** (le journal). Le journal est ici et pas dans la
// grille parce qu'un appel raté a coûté de l'argent sans produire d'image :
// dans la grille il salirait ce qu'on peut réutiliser (US-23), nulle part il
// empêcherait d'expliquer une facture (US-24).
//
// Rangée de 26 px, compteur en mono, aucune couleur de plus : `--signal` pour
// l'élément ouvert, `--echec` pour un raté, `--epingle` pour un interrompu.

import { useEffect, useState } from "react"
import {
  api,
  dollars,
  heure,
  Refus,
  type Bibliotheque,
  type Journal,
} from "../api"
import { EnTetePanneau, Raison } from "./chassis"

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
    <aside className="flex min-h-0 w-[240px] shrink-0 flex-col border-r border-bord bg-fond-1">
      <EnTetePanneau>
        <span>Projet</span>
        <span className="mesure ml-auto text-texte-3">
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
                <div className="flex flex-col gap-1 border-l-2 border-echec bg-echec/5 px-2 py-1.5">
                  <p className="mesure text-[10px] leading-4 text-texte-2">
                    {projet.assets === 0
                      ? "aucun asset — rien à détacher"
                      : `${projet.assets} asset${projet.assets > 1 ? "s" : ""} seront détachés, pas détruits`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void supprimer(projet.identifiant)}
                      className="mesure text-[10px] text-echec hover:text-texte"
                    >
                      Supprimer ›
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer(null)}
                      className="mesure text-[10px] text-texte-3 hover:text-texte-2"
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
            <p className="px-2 py-1 text-[11px] text-texte-3">
              rien encore — une collection regroupe sans contraindre
            </p>
          ) : (
            collections.map((c) => (
              <Rangee
                key={c.identifiant}
                nom={c.nom}
                compte={c.assets}
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
              className="h-8 rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[12px] text-texte placeholder:text-texte-3"
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
        ouverte ? "border-signal bg-fond-2" : "border-transparent",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onOuvrir}
        className={[
          "min-w-0 flex-1 truncate text-left text-[12px]",
          ouverte ? "text-texte" : "text-texte-2 hover:text-texte",
        ].join(" ")}
      >
        {nom}
      </button>
      {mesure && (
        <span className="mesure hidden text-[9.5px] text-texte-3 group-hover:inline">
          {mesure}
        </span>
      )}
      <span className="mesure w-6 shrink-0 text-right text-[9.5px] text-texte-3">
        {compte}
      </span>
      {onSupprimer && (
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Supprimer ${nom}`}
          className="mesure w-3 shrink-0 text-[10px] text-transparent group-hover:text-texte-3 hover:!text-echec"
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
    <section className="flex flex-col border-b border-bord py-1">
      <div className="mesure flex h-[26px] items-center px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        <span>{titre}</span>
        <button
          type="button"
          onClick={onAjouter}
          aria-label={`Nouvelle entrée dans ${titre}`}
          className="ml-auto text-[12px] text-texte-3 hover:text-signal"
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
      <div className="mesure flex h-[26px] items-center gap-2 px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
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
              className="flex flex-col gap-[2px] border-l border-bord pl-2"
            >
              <span className="truncate text-[11px] text-texte-2" title={appel.prompt}>
                {appel.prompt}
              </span>
              <span
                className={[
                  "mesure text-[9.5px] leading-4",
                  rate.statut === "interrompue" ? "text-epingle" : "text-echec",
                ].join(" ")}
              >
                {rate.raison ?? "échec sans raison connue"}
              </span>
              <span className="mesure flex items-center gap-2 text-[9.5px] text-texte-3">
                <span>{heure(appel.cree_le)}</span>
                <span>{dollars(rate.cout_usd)}</span>
                <button
                  type="button"
                  onClick={() => onRelancer(appel.identifiant, rate.rang)}
                  className="ml-auto text-signal hover:text-signal-clair"
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
