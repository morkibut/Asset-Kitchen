// Le tableau d'inspiration — la grille de cartes de l'écran Univers.
//
// **Le collage est le geste principal** (`docs/ARCHITECTURE.md` §6.1 : « entrée
// par collage (Ctrl+V, le geste principal) »). Tout le reste — le glisser-
// déposer, l'adresse, le texte — arrive par le même chemin : on colle, et
// l'atelier devine ce que c'est et le dit.
//
// **Ce n'est pas la grille d'assets, et ça se voit.** Une tuile d'asset a le
// rayon 0 et se lit comme une planche contact ; une carte a le rayon 2 du
// châssis, parce qu'elle *est* du châssis — de la matière rassemblée, pas un
// produit du travail. C'est la seule différence de forme, et elle suffit : « une
// seule grille d'assets dans tout le produit » reste vraie, celle-ci n'en est
// pas une.
//
// Pas de toile libre : grille seulement (`docs/PRD.md` § Hors périmètre). Les
// vignettes 1× / 2× / 4× sont les mêmes crans que le zoom de la grille
// d'assets — un seul vocabulaire de taille dans tout le produit.

import { useEffect, useRef, useState } from "react"
import {
  api,
  FAMILLES,
  NOM_FAMILLE,
  Refus,
  type Carte,
  type Famille,
} from "../api"
import { Bouton, Libelle, Raison, Segments } from "./chassis"

const SPAN: Record<number, string> = { 1: "span 1", 2: "span 2", 4: "span 4" }

/** Ce que le pied d'une carte porte quand elle n'a ni famille ni groupe.
 *
 *  **Une mesure ne s'affiche que si elle a été prise.** Une carte d'adresse qui
 *  n'a pas abouti annonçait `0×0` — un fait mesuré sur une image qui n'existe
 *  pas. Vu en ouvrant l'atelier : le produit dit partout « les dimensions
 *  mesurées font foi », et zéro n'est pas une dimension mesurée, c'est
 *  l'absence de mesure. */
const pied = (carte: Carte) => {
  if (carte.genre === "texte") return "note"
  if (!carte.montrable) return carte.statut === "echouee" ? "sans image" : "en route"
  return `${carte.largeur}×${carte.hauteur}`
}

export function Tableau({
  cartes,
  groupes,
  choisie,
  onChoisir,
  onErreur,
  onRafraichir,
}: {
  cartes: Carte[]
  groupes: string[]
  choisie: string | null
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  /** Ce qui arrive par le flux suffit à tenir la grille à jour ; ce rappel
   *  n'existe que pour les gestes dont l'issue n'est pas un événement — un
   *  doublon proposé, un refus nommé. */
  onRafraichir: () => void
}) {
  const [doublon, setDoublon] = useState<{ nom: string; carte: Carte } | null>(null)
  const [survole, setSurvole] = useState(false)
  const zone = useRef<HTMLDivElement>(null)

  // ── Coller ────────────────────────────────────────────────────────────────
  //
  // **Le collage devine et le dit** (`docs/PRD.md` § Ce qui entre par la main) :
  // des octets d'image font une carte image, une adresse fait une carte en
  // attente, le reste fait une carte texte. Il n'y a aucun menu à traverser
  // avant de coller.

  const collerFichier = async (fichier: File, forcer = false) => {
    try {
      const rendue = await api.collerImage(fichier, fichier.name || "l'image collée", forcer)
      if (rendue.doublon) setDoublon({ nom: fichier.name, carte: rendue.doublon })
      else onRafraichir()
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "collage refusé")
    }
  }

  const collerTexte = async (texte: string) => {
    const propre = texte.trim()
    if (!propre) return
    try {
      // Une adresse est une adresse ; tout le reste est une intention. La
      // règle est ici parce que c'est un geste d'écran, mais le serveur la
      // rejoue et refuse ce qui n'est pas du http(s) : l'écran devine, il ne
      // décide pas.
      if (/^https?:\/\/\S+$/i.test(propre)) await api.collerAdresse(propre)
      else await api.collerTexte(propre)
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "collage refusé")
    }
  }

  useEffect(() => {
    const surColle = (evenement: ClipboardEvent) => {
      const presse = evenement.clipboardData
      if (!presse) return
      const fichiers = Array.from(presse.files)
      if (fichiers.length) {
        evenement.preventDefault()
        // **Un appel par fichier, et chacun répond pour lui-même** : « savoir
        // lequel des douze fichiers déposés pose problème » (US-45). Les onze
        // premières cartes paraissent sans attendre que la douzième soit lue.
        fichiers.forEach((fichier) => void collerFichier(fichier))
        return
      }
      const texte = presse.getData("text/plain")
      if (texte.trim()) {
        evenement.preventDefault()
        void collerTexte(texte)
      }
    }
    window.addEventListener("paste", surColle)
    return () => window.removeEventListener("paste", surColle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deposer = (evenement: React.DragEvent) => {
    evenement.preventDefault()
    setSurvole(false)
    Array.from(evenement.dataTransfer.files).forEach((f) => void collerFichier(f))
    const texte = evenement.dataTransfer.getData("text/plain")
    if (!evenement.dataTransfer.files.length && texte) void collerTexte(texte)
  }

  return (
    <section
      ref={zone}
      onDragOver={(e) => {
        e.preventDefault()
        setSurvole(true)
      }}
      onDragLeave={() => setSurvole(false)}
      onDrop={deposer}
      className={[
        "flex min-h-0 flex-1 flex-col border-l border-bord",
        survole ? "bg-fond-2" : "bg-fond-0",
      ].join(" ")}
    >
      <BarreTableau cartes={cartes} groupes={groupes} />

      {doublon && (
        <div className="mesure flex h-[38px] shrink-0 items-center gap-2 border-b border-bord bg-fond-1 px-4 text-[10px] text-epingle">
          <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
          <span>« {doublon.nom} » est déjà sur le tableau</span>
          <button
            type="button"
            onClick={() => {
              onChoisir(doublon.carte.identifiant)
              setDoublon(null)
            }}
            className="text-signal hover:text-signal-clair"
          >
            La voir ›
          </button>
          <span className="text-texte-3">·</span>
          <button
            type="button"
            onClick={() => {
              const nom = doublon.nom
              setDoublon(null)
              onErreur("")
              void (async () => {
                // Réimporter demande les octets ; on les redemande à la carte
                // existante plutôt que de garder le fichier collé en mémoire.
                const reponse = await fetch(
                  api.imageCarte(doublon.carte.identifiant, doublon.carte.empreinte),
                )
                await collerFichier(
                  new File([await reponse.blob()], nom, { type: "image/png" }),
                  true,
                )
              })()
            }}
            className="text-signal hover:text-signal-clair"
          >
            Importer quand même ›
          </button>
        </div>
      )}

      {cartes.length === 0 ? (
        <Vide />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div
            className="grid gap-[9px]"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}
          >
            {cartes.map((carte) => (
              <CarteTuile
                key={carte.identifiant}
                carte={carte}
                choisie={carte.identifiant === choisie}
                onChoisir={() =>
                  onChoisir(carte.identifiant === choisie ? null : carte.identifiant)
                }
                onErreur={onErreur}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function BarreTableau({ cartes, groupes }: { cartes: Carte[]; groupes: string[] }) {
  const artworks = cartes.filter((c) => c.artwork).length
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-bord bg-fond-1 px-4">
      <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Tableau
      </span>
      <span className="mesure text-[10px] text-texte-2">
        {cartes.length} carte{cartes.length > 1 ? "s" : ""}
      </span>
      {artworks > 0 && (
        <span className="mesure text-[10px] text-signal">
          {artworks} artwork{artworks > 1 ? "s" : ""} officiel{artworks > 1 ? "s" : ""}
        </span>
      )}
      {groupes.length > 0 && (
        <span className="mesure truncate text-[10px] text-texte-3">
          {groupes.join(" · ")}
        </span>
      )}
      <span className="mesure ml-auto text-[10px] text-texte-3">
        Ctrl + V pour coller — image, adresse ou texte
      </span>
    </div>
  )
}

/** L'état vide. En serif, parce que c'est une invitation et non un message
 *  d'erreur — `docs/DESIGN.md` § Typography, règle 1. */
function Vide() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="font-serif text-[32px] leading-tight text-texte-2">
        Le tableau est vide. <span className="italic text-texte">Colle.</span>
      </p>
      <p className="mesure max-w-[420px] text-center text-[10px] leading-relaxed text-texte-3">
        Une image devient une carte. Une adresse fait paraître une carte en
        attente, et l'image arrive ensuite. Un texte devient une note au milieu
        des images.
      </p>
    </div>
  )
}

// ── Une carte ───────────────────────────────────────────────────────────────

function CarteTuile({
  carte,
  choisie,
  onChoisir,
  onErreur,
}: {
  carte: Carte
  choisie: boolean
  onChoisir: () => void
  onErreur: (raison: string) => void
}) {
  return (
    <article
      style={{ gridColumn: SPAN[carte.taille] ?? "span 1" }}
      className={[
        "flex flex-col overflow-hidden rounded-[2px] border bg-fond-2 transition-colors duration-[80ms]",
        choisie ? "border-lumiere shadow-[0_0_0_2px_var(--color-lumiere)]" : "border-bord",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onChoisir}
        aria-label={carte.genre === "texte" ? "Ouvrir la note" : "Ouvrir la carte"}
        className="relative block w-full"
      >
        {carte.genre === "texte" ? (
          <p className="min-h-[92px] p-3 text-left text-[12.5px] leading-relaxed text-texte">
            {carte.texte}
          </p>
        ) : carte.montrable ? (
          <img
            src={api.imageCarte(carte.identifiant, carte.empreinte)}
            alt={carte.note || carte.source || "carte"}
            className="damier aspect-square w-full object-contain"
          />
        ) : (
          <Attente carte={carte} />
        )}

        {/* La seule marque visuelle, comme le coin favori d'une tuile : ce que
            l'auteur pose est une forme, ce que le système constate est un mot. */}
        {carte.artwork && (
          <span
            aria-label="artwork officiel"
            className="absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-t-signal border-l-transparent"
          />
        )}
      </button>

      <div className="mesure flex items-center gap-1.5 border-t border-bord px-1.5 py-1 text-[9.5px] text-texte-3">
        {carte.artwork ? (
          <span className="text-signal">{NOM_FAMILLE[carte.famille]}</span>
        ) : carte.groupe ? (
          <span className="truncate">{carte.groupe}</span>
        ) : (
          <span className="truncate">{pied(carte)}</span>
        )}
        <span className="ml-auto">{carte.taille}×</span>
      </div>

      {choisie && <Reglages carte={carte} onErreur={onErreur} />}
    </article>
  )
}

/** Une carte d'adresse qui n'a pas encore son image — ou qui ne l'aura pas.
 *
 *  Elle garde son adresse et sa raison (US-43), et elle ne se retente pas toute
 *  seule : « rien n'est jamais relancé automatiquement » vaut ici comme pour une
 *  génération coupée. */
function Attente({ carte }: { carte: Carte }) {
  const echouee = carte.statut === "echouee"
  return (
    <div
      className={[
        "flex aspect-square w-full flex-col justify-center gap-1.5 p-3 text-left",
        echouee ? "bg-echec/5" : "bg-fond-2",
      ].join(" ")}
    >
      <span
        className={["mesure text-[10px]", echouee ? "text-echec" : "text-epingle"].join(" ")}
      >
        {echouee ? "pas arrivée" : "en attente…"}
      </span>
      <span className="mesure break-all text-[9.5px] leading-snug text-texte-3">
        {carte.source}
      </span>
      {carte.raison && (
        <span className="mesure text-[9.5px] leading-snug text-echec">{carte.raison}</span>
      )}
    </div>
  )
}

/** Ce qu'on règle sur une carte : son groupe, sa note, sa taille, sa promotion.
 *
 *  Dans la carte et non dans un panneau : une carte porte quatre réglages, un
 *  asset en porte quinze. Ouvrir un panneau pour quatre champs ferait perdre le
 *  tableau, qui est exactement ce qu'on regarde en les posant. */
function Reglages({ carte, onErreur }: { carte: Carte; onErreur: (r: string) => void }) {
  const [groupe, setGroupe] = useState(carte.groupe)
  const [note, setNote] = useState(carte.note)

  useEffect(() => {
    setGroupe(carte.groupe)
    setNote(carte.note)
  }, [carte.identifiant])

  const echouer = (erreur: unknown, defaut: string) =>
    onErreur(erreur instanceof Refus ? erreur.message : defaut)

  const regler = async (reglage: Parameters<typeof api.reglerCarte>[1]) => {
    try {
      await api.reglerCarte(carte.identifiant, reglage)
    } catch (erreur) {
      echouer(erreur, "réglage refusé")
    }
  }

  const promouvoir = async (officiel: boolean, famille = carte.famille) => {
    try {
      await api.promouvoir(carte.identifiant, officiel, famille)
    } catch (erreur) {
      echouer(erreur, "promotion refusée")
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-bord bg-fond-1 p-2">
      <input
        value={groupe}
        placeholder="groupe"
        onChange={(e) => setGroupe(e.target.value)}
        onBlur={() => groupe !== carte.groupe && void regler({ groupe })}
        className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
      />
      <textarea
        value={note}
        placeholder="note"
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== carte.note && void regler({ note })}
        className="resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11.5px] leading-snug text-texte placeholder:text-texte-3"
      />

      <div className="flex items-center justify-between">
        <Libelle>Taille</Libelle>
        <Segments
          valeurs={[1, 2, 4] as const}
          valeur={carte.taille}
          onChange={(taille) => void regler({ taille })}
        />
      </div>

      {carte.genre === "image" && (
        <div className="flex flex-col gap-1.5 border-t border-bord pt-2">
          <div className="flex items-center justify-between">
            <Libelle>Artwork officiel</Libelle>
            <button
              type="button"
              onClick={() => void promouvoir(!carte.officiel)}
              disabled={carte.statut !== "prete"}
              aria-pressed={carte.officiel}
              className={[
                "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
                carte.statut !== "prete"
                  ? "border-bord bg-fond-2 text-texte-3"
                  : carte.officiel
                    ? "border-signal bg-signal/13 text-signal"
                    : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
              ].join(" ")}
            >
              {carte.officiel ? "promue" : "promouvoir"}
            </button>
          </div>
          {carte.statut !== "prete" && (
            <Raison texte="cette image n'est pas encore arrivée" />
          )}
          {carte.officiel && (
            <>
              <Libelle>Famille</Libelle>
              <div className="flex flex-wrap gap-1">
                {FAMILLES.map((famille) => (
                  <button
                    key={famille}
                    type="button"
                    onClick={() => void promouvoir(true, famille as Famille)}
                    className={[
                      "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
                      carte.famille === famille
                        ? "border-signal bg-signal/13 text-signal"
                        : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
                    ].join(" ")}
                  >
                    {NOM_FAMILLE[famille]}
                  </button>
                ))}
              </div>
              <p className="mesure text-[9.5px] leading-snug text-texte-3">
                {carte.famille === "tous"
                  ? "part avec toutes les générations"
                  : `ne part qu'avec les sujets de la famille ${NOM_FAMILLE[carte.famille]}`}
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-bord pt-2">
        {carte.source && carte.statut === "echouee" && (
          <button
            type="button"
            onClick={() =>
              void api
                .reessayerCarte(carte.identifiant)
                .catch((e) => echouer(e, "récupération refusée"))
            }
            className="mesure text-[10px] text-signal hover:text-signal-clair"
          >
            Réessayer ›
          </button>
        )}
        {carte.source && carte.statut === "prete" && (
          <a
            href={carte.source}
            target="_blank"
            rel="noreferrer"
            className="mesure truncate text-[10px] text-texte-3 hover:text-signal"
            title={carte.source}
          >
            {carte.source}
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            void api
              .oublierCarte(carte.identifiant)
              .catch((e) => echouer(e, "suppression refusée"))
          }
          className="mesure ml-auto text-[10px] text-texte-3 hover:text-echec"
        >
          Retirer
        </button>
      </div>
    </div>
  )
}

export { Bouton }
