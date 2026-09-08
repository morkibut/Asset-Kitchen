/**
 * Les emplois d'une pièce — B19. **Une pièce d'équipement, et les façons dont
 * elle sert.**
 *
 * `docs/pistes-2026-09-04/carnet/Emplois.dc.html`. C'est la surface centrale du
 * genre `"piece"` de `interface/src/lieux.ts` — un genre à part de `"sujet"`,
 * et il le fallait : une pièce n'a ni pose, ni direction, ni case, et le produit
 * interdit d'en générer une image sur fond vide. Sous elle, le genre `"emploi"`
 * ouvre la matrice d'un emploi ; c'est là que les images vivent.
 *
 * **L'écran ne parle jamais au serveur.** Ouvrir un emploi, en ajouter un,
 * retirer la pièce : les trois remontent au parent, qui appelle l'API et relit.
 * `onErreur` ne sert donc qu'aux refus d'ici — « choisis d'abord un porteur ».
 * Même partage que `GrilleDuJeu.tsx`, et pour la même raison : un écran sans
 * réseau s'essaie sans double de `fetch`.
 *
 * **Aucun chiffre neuf ne s'y calcule.** `fait`, `attendu`, `porteur_nom`,
 * `emplacement_nom` arrivent résolus dans `EmploiResolu` (`api.emploisDuJeu`) ;
 * le repli « l'emplacement de la pièce quand l'emploi n'en cite aucun » est déjà
 * fait côté serveur, et le refaire ici l'aurait fait diverger.
 *
 * ── Ce que la planche montre et qui n'est pas là, et pourquoi ────────────────
 *
 * **Le devis (« Ce que l'épée coûterait, en entier », « Générer les 44 ≈ $0,15 »)
 * n'y est pas** : aucun prix n'entre dans cet écran. `PieceEtSesEmplois` porte
 * `fait` et `attendu`, rien de plus, et il n'existe au contrat aucun geste qui
 * lance la production d'une pièce entière. Inventer le chiffre l'aurait rendu
 * faux le jour où le barème bouge — et le rouille du système est justement
 * réservé au bouton qui lance et au chiffre qui coûte.
 *
 * **Aucune vignette sur les lignes.** La planche en pose une par emploi ; c'est
 * précisément la confusion que le genre `"piece"` évite. `EmploiResolu` ne porte
 * d'ailleurs aucun asset : la montrer aurait demandé une lecture de plus.
 *
 * **Pas de jauge de remplissage.** La liste fermée de `docs/DESIGN.md` ne donne
 * pas de teinte pour un fond de barre qui ne soit ni le rouille ni un gris, et
 * `{fait} / {attendu}` suivi du mot d'état dit déjà la même chose en clair.
 *
 * **Aucune couleur d'alerte sur un manque** — même règle que `Famille.tsx` et
 * `TableauDeBord.tsx` : « 18 manquent » se lit en encre, pas en rouge. Le seul
 * rouge de l'écran dit qu'une chose est cassée (un porteur disparu) ou qu'une
 * action retire (« La retirer du jeu »).
 *
 * **« Exporter tous ses calques… » et « La dupliquer en… »** attendent des
 * gestes qui n'existent pas encore au contrat.
 */

import { useMemo, useState } from "react"
import {
  libelleDEmploi,
  type EmploiResolu,
  type GenreDEmploi,
  type PieceEtSesEmplois,
} from "../api"

// ── Les mots des trois genres ───────────────────────────────────────────────

/** Le nom que porte un genre quand l'auteur n'a rien écrit. La liste est close,
 *  comme `GenreDEmploi` : trois genres, et un seul fabrique. */
const NOM_DU_GENRE: Record<GenreDEmploi, string> = {
  porte: "Porté par quelqu'un",
  "a-part": "Une image à part",
  "mise-en-scene": "Une mise en scène",
}

const GENRES = ["porte", "a-part", "mise-en-scene"] as const

/** Le libellé d'un emploi — **la règle vit dans `api.ts`**, pas ici.
 *
 *  Trois endroits nomment un emploi : cette liste, la page d'un emploi et le
 *  fil d'Ariane. La première écriture de la tranche en avait fait trois copies,
 *  et elles divergeaient déjà sur le cas du porteur disparu. */

/** La seconde ligne : où elle se pose pour un emploi porté, sa description
 *  sinon. Un emploi porté n'a pas de description à montrer ici — c'est
 *  l'emplacement qui dit la chose utile. */
function secondeLigne(emploi: EmploiResolu): string {
  if (emploi.genre !== "porte") return emploi.description
  return [emploi.emplacement_nom, emploi.devant ? "devant le corps" : "derrière le corps"]
    .filter(Boolean)
    .join(" · ")
}

/** Trois états, et pas un de plus. `attendu` à zéro n'est pas « complet » : une
 *  colonne qui n'attend rien n'a rien fini.
 *
 *  **Le singulier s'accorde**, comme sur la page d'un emploi (`Emploi.tsx`) :
 *  « 1 manquent » est la lettre de la maquette et une faute de français, et deux
 *  écrans de la même tranche qui l'écriraient différemment se contrediraient à
 *  un clic d'intervalle. */
export function etatDuCompte(fait: number, attendu: number): string {
  if (attendu > 0 && fait >= attendu) return "complet"
  if (fait === 0) return "rien"
  const manque = attendu - fait
  return `${manque} ${manque === 1 ? "manque" : "manquent"}`
}

// ── Les pièces de l'écran ───────────────────────────────────────────────────

function Intertitre({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">{children}</h2>
  )
}

function LigneDEmploi({
  emploi,
  onOuvrir,
}: {
  emploi: EmploiResolu
  onOuvrir: () => void
}) {
  const seconde = secondeLigne(emploi)
  return (
    <button
      type="button"
      onClick={onOuvrir}
      data-emploi={emploi.identifiant}
      className="flex items-center gap-[14px] rounded-8 px-[14px] py-[8px] text-left transition-colors duration-120 hover:bg-papier"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span className="flex flex-wrap items-baseline gap-[8px]">
          <span className="text-[13.5px] font-medium text-encre">
            {libelleDEmploi(emploi)}
          </span>
          {emploi.deduit && (
            <span className="text-[10.5px] text-encre-4">lu sur ses images</span>
          )}
          {emploi.orphelin && (
            <span className="text-[10.5px] text-ancien-echec">
              ce porteur n'est plus dans le jeu
            </span>
          )}
        </span>
        {seconde && <span className="text-[11.5px] text-encre-4">{seconde}</span>}
      </span>
      <span className="mesure shrink-0 text-[11.5px] text-encre-3">
        {emploi.fait} / {emploi.attendu}
      </span>
      <span className="shrink-0 text-[12px] text-encre-3">
        {etatDuCompte(emploi.fait, emploi.attendu)}
      </span>
    </button>
  )
}

/** Le formulaire d'ajout — **en place, jamais une fenêtre flottante**. Il n'y a
 *  que deux choses à dire (le genre, puis un porteur ou un nom), et une fenêtre
 *  qui recouvre la liste ferait perdre de vue ce qu'on est en train de compléter. */
function AjoutDUnEmploi({
  libres,
  onAjouter,
  onFermer,
  onErreur,
}: {
  libres: readonly { identifiant: string; nom: string }[]
  onAjouter: (corps: { genre: GenreDEmploi; porteur?: string; nom?: string }) => void
  onFermer: () => void
  onErreur: (raison: string) => void
}) {
  const [genre, setGenre] = useState<GenreDEmploi>("porte")
  const [porteur, setPorteur] = useState("")
  const [nom, setNom] = useState("")

  const valider = () => {
    if (genre === "porte") {
      // Le seul refus que cet écran prononce lui-même : le reste part au
      // serveur, qui sait ce qu'il accepte.
      if (!porteur) {
        onErreur("choisis d'abord un porteur")
        return
      }
      onAjouter({ genre, porteur })
    } else {
      // Un nom vide n'est pas envoyé : le serveur nomme alors l'emploi de son
      // genre, exactement comme cet écran le compose à l'affichage.
      const propre = nom.trim()
      onAjouter(propre ? { genre, nom: propre } : { genre })
    }
    onFermer()
  }

  return (
    <div
      data-ajout-d-emploi
      className="flex flex-col gap-[8px] rounded-8 border border-contour bg-papier p-[14px]"
    >
      <div role="radiogroup" aria-label="Le genre de l'emploi" className="flex flex-wrap gap-[4px]">
        {GENRES.map((cle) => (
          <button
            key={cle}
            type="button"
            role="radio"
            aria-checked={genre === cle}
            onClick={() => setGenre(cle)}
            className={[
              "h-[26px] rounded-full border px-[14px] text-[12.5px] transition-colors duration-120",
              genre === cle
                ? "border-contour bg-ligne-ouverte text-encre"
                : "border-trait text-encre-3 hover:text-encre",
            ].join(" ")}
          >
            {NOM_DU_GENRE[cle]}
          </button>
        ))}
      </div>

      {genre === "porte" ? (
        libres.length === 0 ? (
          <p className="text-[12.5px] text-encre-3">
            Tous ceux qui peuvent la porter la portent déjà.
          </p>
        ) : (
          <select
            aria-label="Le porteur"
            value={porteur}
            onChange={(e) => setPorteur(e.target.value)}
            className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
          >
            <option value="">Choisir un porteur…</option>
            {libres.map((p) => (
              <option key={p.identifiant} value={p.identifiant}>
                {p.nom}
              </option>
            ))}
          </select>
        )
      ) : (
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          aria-label="Le nom de l'emploi"
          placeholder="Posée au sol, son icône d'inventaire…"
          className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre placeholder:text-encre-4"
        />
      )}

      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          onClick={valider}
          className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] font-medium text-encre transition-colors duration-120 hover:border-encre-4"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onFermer}
          className="h-[30px] rounded-7 px-[14px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
        >
          Laisser tomber
        </button>
      </div>
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export function Emplois({
  pieceEtSesEmplois,
  porteurs,
  onEmploi,
  onAjouterEmploi,
  onRetirerLaPiece,
  onErreur,
}: {
  pieceEtSesEmplois: PieceEtSesEmplois
  porteurs: readonly { identifiant: string; nom: string }[]
  onEmploi: (emploi: string) => void
  /** Ajouter un emploi. Le parent appelle l'API et relit ; l'écran n'appelle
   *  jamais le réseau lui-même. */
  onAjouterEmploi: (corps: { genre: GenreDEmploi; porteur?: string; nom?: string }) => void
  onRetirerLaPiece: () => void
  onErreur: (raison: string) => void
}) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false)

  const { piece, declare, emplois, fait, attendu } = pieceEtSesEmplois

  // **On ne propose jamais quelqu'un qui la porte déjà** : deux emplois portés
  // pour un même porteur feraient deux colonnes d'images du même geste, et le
  // produit n'a aucun moyen de les départager ensuite.
  const libres = useMemo(() => {
    const pris = new Set(
      emplois.filter((e) => e.genre === "porte" && e.porteur).map((e) => e.porteur),
    )
    return porteurs.filter((p) => !pris.has(p.identifiant))
  }, [emplois, porteurs])

  const portes = emplois.filter((e) => e.genre === "porte").length

  const sousTitre =
    emplois.length === 0
      ? "Aucun emploi encore. Chaque emploi aura ses propres images."
      : emplois.length === 1
        ? "Une seule façon de servir, pour l'instant. Chaque emploi a ses propres images."
        : `La même pièce, ${emplois.length} façons de servir. Chaque emploi a ses propres images.`

  const titreDeLaListe =
    emplois.length === 0
      ? "Ses emplois"
      : emplois.length === 1
        ? "Son emploi"
        : `Ses ${emplois.length} emplois`

  return (
    <main
      data-emplois
      aria-label={`Les emplois de ${piece.nom}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="defile flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-[30px] pt-[22px] pb-[22px]">
        {/* ── L'entête ──────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">{piece.nom}</h1>
            <p className="text-[13px] text-encre-2">{sousTitre}</p>
          </div>
          <button
            type="button"
            onClick={() => setAjoutOuvert(true)}
            className="h-[34px] shrink-0 rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120"
          >
            Nouvel emploi
          </button>
        </div>

        {/* ── Sa description ────────────────────────────────────────────────
            La planche pose ici une vignette ; il n'y en a pas, et c'est le
            sujet même de l'écran : ce texte est tout ce que la pièce possède
            en propre, et c'est lui qui part avec chacun de ses emplois. */}
        <section className="flex flex-col gap-[8px]">
          <Intertitre>Son image de référence</Intertitre>
          <p className="text-[12.5px] leading-[1.5] text-encre-2">
            {piece.description.trim()
              ? `« ${piece.description} »`
              : "Aucune description encore."}
          </p>
          <p className="text-[11.5px] leading-[1.45] text-encre-4">
            Une pièce n'a pas d'image à elle : ce texte part avec chaque emploi, et ce sont
            les emplois qui portent les images.
          </p>
        </section>

        {/* ── Ses emplois ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-[8px]">
          <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
            <Intertitre>{titreDeLaListe}</Intertitre>
            <span data-compte-de-la-piece className="text-[12px] text-encre-3">
              <span className="mesure">{fait}</span> images sur{" "}
              <span className="mesure">{attendu}</span> · l'emploi qu'on ouvre montre sa
              matrice
            </span>
          </div>

          {/* `declare` à faux veut dire que rien n'est encore écrit sur le
              disque : le dire ici évite de faire croire que ces lignes sont
              des choix de l'auteur. */}
          {!declare && emplois.length > 0 && (
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              Rien n'est encore déclaré pour cette pièce : tout ce qui suit est lu sur ses
              calques.
            </p>
          )}

          <div className="flex flex-col gap-[4px] rounded-10 border border-trait bg-carte p-[4px]">
            {emplois.length === 0 && (
              <p className="px-[14px] py-[8px] text-[12.5px] text-encre-3">
                Personne ne s'en sert encore.
              </p>
            )}
            {emplois.map((emploi) => (
              <LigneDEmploi
                key={emploi.identifiant}
                emploi={emploi}
                onOuvrir={() => onEmploi(emploi.identifiant)}
              />
            ))}

            {ajoutOuvert ? (
              <AjoutDUnEmploi
                libres={libres}
                onAjouter={onAjouterEmploi}
                onFermer={() => setAjoutOuvert(false)}
                onErreur={onErreur}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAjoutOuvert(true)}
                data-ouvrir-l-ajout
                className="flex flex-wrap items-baseline gap-[14px] rounded-8 px-[14px] py-[8px] text-left text-encre-3 transition-colors duration-120 hover:bg-papier"
              >
                <span className="text-[13.5px]">+ Ajouter un emploi</span>
                <span className="text-[12px] text-encre-4">
                  porté par quelqu'un · une image à part · une mise en scène
                </span>
              </button>
            )}
          </div>
        </section>

        {/* Le seul texte d'explication de l'écran, et il ne paraît que quand il
            a quelque chose à expliquer : deux porteurs ou plus. */}
        {portes > 1 && (
          <section className="flex flex-col gap-[4px] rounded-8 border border-contour bg-carte p-[14px]">
            <p className="text-[13.5px] font-medium text-encre">
              Pourquoi {portes} porteurs font {portes} jeux d'images
            </p>
            <p className="text-[12.5px] leading-[1.55] text-encre-2">
              Chacun la tient à sa façon, et à sa taille. Une même image ne peut pas servir
              aux {portes} : chaque emploi est redessiné pose par pose et direction par
              direction.
            </p>
          </section>
        )}
      </div>

      {/* ── Le pied ─────────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between gap-[22px] border-t border-trait px-[30px] py-[14px]">
        <span className="text-[12.5px] text-encre-3">
          La retirer du jeu ne supprime pas ses calques : ils restent dans la galerie,
          détachés.
        </span>
        <button
          type="button"
          onClick={onRetirerLaPiece}
          className="h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-ancien-echec transition-colors duration-120 hover:border-encre-4"
        >
          La retirer du jeu
        </button>
      </footer>
    </main>
  )
}
