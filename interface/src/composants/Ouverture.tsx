/**
 * L'ouverture — sur quel jeu travaille-t-on (B4).
 *
 * `docs/archive/pistes-2026-09-04/carnet/Ouverture.dc.html`. Le premier écran de
 * l'atelier, et **le seul où aucun jeu n'est ouvert** : une carte par jeu, ce
 * qu'il contient, ce qu'il a coûté, quand on l'a touché. Comme le parcours de
 * création, elle prend la fenêtre entière — le carnet n'a rien à montrer tant
 * qu'aucun jeu n'est choisi.
 *
 * **Deux bugs de bascule que cette tranche répare, ailleurs que dans ce
 * fichier** : changer de jeu ne rechargeait que la bibliothèque, jamais
 * l'univers (`App.tsx`, l'effet sur `bibliotheque.courant`) ; et le chantier
 * d'un jeu continuait de s'afficher après en avoir changé (`App.tsx`,
 * `entrees`). Ici, on ne fait qu'ouvrir un jeu — on ne raconte pas comment le
 * reste de l'écran suit.
 *
 * **Les puces d'une carte lisent l'univers du jeu, pas seulement le sien** :
 * `Projet.en_json()` porte l'univers de chaque jeu, ouvert ou non — c'est
 * l'arbre entier qui le sert, aucun aller-retour de plus. Seule la carte du
 * jeu **ouvert** ajoute une fraction d'avancement (RV10) : elle seule peut lire
 * `GET /dashboard`, qui ne parle que du jeu déjà choisi.
 */

import { useEffect, useState, type ReactNode } from "react"
import {
  api,
  dollars,
  Refus,
  AUCUNE_CIBLE,
  type Bibliotheque,
  type FractionAvancement,
  type Projet,
} from "../api"

const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" })

/** Ce qu'une carte de jeu montre de son avancement (RV10) : le même compte
 *  que la carte du Codex, la fiche et l'objectif — jamais recalculé ici,
 *  seulement sommé sur les familles que `GET /dashboard` rend déjà. */
function sommerLesFamilles(familles: readonly { images: FractionAvancement; animations: FractionAvancement }[]) {
  const sommer = (lire: (f: { images: FractionAvancement; animations: FractionAvancement }) => number) =>
    familles.reduce((n, f) => n + lire(f), 0)
  return {
    images: { pretes: sommer((f) => f.images.pretes), demandees: sommer((f) => f.images.demandees) },
    animations: { pretes: sommer((f) => f.animations.pretes), demandees: sommer((f) => f.animations.demandees) },
  }
}

function Puce({ children, vide }: { children: ReactNode; vide?: boolean }) {
  return (
    <span
      className={[
        "mesure inline-flex h-[22px] items-center rounded-5 border px-[8px] text-[11.5px]",
        vide
          ? "border-dashed border-pointille text-encre-4"
          : "border-trait bg-papier text-encre-2",
      ].join(" ")}
    >
      {children}
    </span>
  )
}

function BandeDePalette({ palette }: { palette: readonly string[] }) {
  if (palette.length === 0) {
    return (
      <div className="flex h-[54px] items-center justify-center border-b border-dashed border-pointille bg-papier-cote">
        <span className="text-[11.5px] text-encre-4">pas encore de palette</span>
      </div>
    )
  }
  return (
    <div className="flex h-[54px]">
      {palette.map((couleur, rang) => (
        <i
          key={rang}
          aria-hidden
          className="block flex-1"
          style={{ background: couleur }}
        />
      ))}
    </div>
  )
}

function CarteDuJeu({
  projet,
  ouvert,
  avancement,
  onOuvrir,
  onSupprimer,
  confirmerSuppression,
  surConfirmerSuppression,
}: {
  projet: Projet
  ouvert: boolean
  avancement: { images: { pretes: number; demandees: number }; animations: { pretes: number; demandees: number } } | null
  onOuvrir: () => void
  onSupprimer: () => void
  confirmerSuppression: boolean
  surConfirmerSuppression: (confirmer: boolean) => void
}) {
  const univers = projet.univers
  const taille =
    univers.style === "dessin"
      ? `finesse ${univers.cible_px}`
      : univers.cible_px !== AUCUNE_CIBLE
        ? `${univers.cible_px} px`
        : null

  return (
    <div
      data-carte-de-jeu
      className={[
        "flex flex-col overflow-hidden rounded-8 border bg-carte",
        ouvert ? "border-2 border-signal" : "border-trait",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onOuvrir}
        className="flex flex-1 flex-col text-left"
      >
        <BandeDePalette palette={univers.palette} />
        <div className="flex flex-1 flex-col gap-[8px] p-[14px]">
          <span className="truncate font-serif text-[25px] leading-[1.1] text-encre">
            {projet.nom}
          </span>
          <span className="mesure text-[12px] text-encre-3">
            {projet.assets === 0
              ? "aucune image · rien dépensé"
              : `${projet.assets} image${projet.assets > 1 ? "s" : ""} · ${dollars(projet.total_usd)}`}
            {avancement && avancement.animations.demandees + avancement.images.demandees > 0
              ? ` · ${avancement.animations.pretes}/${avancement.animations.demandees} anim. · ${avancement.images.pretes}/${avancement.images.demandees} im.`
              : ""}
          </span>
          <div className="flex flex-wrap gap-[8px]">
            <Puce>{univers.style === "dessin" ? "dessin" : "pixel art"}</Puce>
            {taille && <Puce>{taille}</Puce>}
            <Puce>{univers.couleurs} couleurs</Puce>
          </div>
          <div className="flex flex-wrap gap-[8px]">
            {univers.vue.trim() ? (
              <Puce>{univers.vue}</Puce>
            ) : (
              <Puce vide>aucune vue choisie</Puce>
            )}
          </div>
          {projet.pieces.length > 0 && (
            <span className="text-[12px] leading-[1.4] text-encre-3">
              {projet.pieces.length} pièce{projet.pieces.length > 1 ? "s" : ""} d'équipement
            </span>
          )}
        </div>
      </button>
      <div className="mt-auto flex items-baseline justify-between gap-[8px] border-t border-trait-faible px-[14px] py-[8px] text-[11.5px] text-encre-4">
        {ouvert ? (
          <span className="font-medium text-signal">ouvert la dernière fois</span>
        ) : (
          <span>{JOUR.format(new Date(projet.dernier_travail_le * 1000))}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            surConfirmerSuppression(true)
          }}
          className="text-encre-4 underline-offset-2 hover:text-echec hover:underline"
        >
          supprimer
        </button>
      </div>
      {confirmerSuppression && (
        <div className="flex items-center justify-between gap-[8px] border-t border-trait-echec bg-fond-echec px-[14px] py-[8px] text-[11.5px]">
          <span className="text-echec">
            {projet.assets === 0
              ? "aucune image — rien à détacher"
              : `${projet.assets} image${projet.assets > 1 ? "s" : ""} seront détachées, pas détruites`}
          </span>
          <div className="flex shrink-0 gap-[14px]">
            <button
              type="button"
              onClick={onSupprimer}
              className="text-echec underline-offset-2 hover:underline"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => surConfirmerSuppression(false)}
              className="text-encre-3 hover:text-encre-2"
            >
              Garder
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Ouverture({
  bibliotheque,
  onOuvrir,
  onCommencer,
  onSupprimer,
  onReconstruire,
  onFermer,
  onGuide,
  onInstallation,
  onErreur,
}: {
  bibliotheque: Bibliotheque
  onOuvrir: (identifiant: string) => void
  /** Ouvrir le parcours des règles du jeu, en mode création (`B14`). C'est lui
   *  qui demande le nom, et lui qui crée : cet écran-ci ne fait que choisir
   *  parmi les jeux qui existent. */
  onCommencer: () => void
  onSupprimer: (identifiant: string) => Promise<void>
  onReconstruire: () => Promise<void>
  onFermer: () => void
  onGuide: () => void
  onInstallation: () => void
  onErreur: (raison: string) => void
}) {
  const [recherche, setRecherche] = useState("")
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [reconstruction, setReconstruction] = useState(false)

  // **La fraction d'avancement du jeu ouvert** (RV10) — le même compte que la
  // carte du Codex, la fiche et l'objectif, jamais recalculé ici. Un seul
  // aller-retour, et seulement pour celui déjà choisi : les autres jeux n'ont
  // pas de fraction sur leur carte, et ce n'est pas cet écran qui doit les
  // rouvrir un par un pour l'obtenir.
  const [avancementDuJeuOuvert, setAvancementDuJeuOuvert] = useState<ReturnType<typeof sommerLesFamilles> | null>(null)
  useEffect(() => {
    let actif = true
    setAvancementDuJeuOuvert(null)
    if (!bibliotheque.courant) return
    api.bilanDuJeu().then((bilan) => {
      if (actif) setAvancementDuJeuOuvert(sommerLesFamilles(bilan.familles))
    }).catch(() => { /* la carte se contente alors de ce qu'elle sait déjà */ })
    return () => { actif = false }
  }, [bibliotheque.courant])

  const echouer = (erreur: unknown, defaut: string) =>
    onErreur(erreur instanceof Refus ? erreur.message : defaut)

  // **Échap ferme l'écran.** Il n'y a plus rien qui s'ouvre par-dessus depuis
  // que le champ de création est parti dans le parcours (`B14`). Toujours un
  // jeu ouvert dessous : fermer l'ouverture sans en choisir un ramène à celui
  // qu'on avait déjà, jamais nulle part.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape" || evenement.defaultPrevented) return
      evenement.stopPropagation()
      onFermer()
    }
    window.addEventListener("keydown", surTouche, true)
    return () => window.removeEventListener("keydown", surTouche, true)
  }, [onFermer])

  const supprimer = async (identifiant: string) => {
    setASupprimer(null)
    try {
      await onSupprimer(identifiant)
    } catch (erreur) {
      echouer(erreur, "suppression refusée")
    }
  }

  const reconstruire = async () => {
    setReconstruction(true)
    try {
      await onReconstruire()
    } catch (erreur) {
      echouer(erreur, "reconstruction refusée")
    } finally {
      setReconstruction(false)
    }
  }

  const propre = recherche.trim().toLowerCase()
  const projets = propre
    ? bibliotheque.projets.filter((p) => p.nom.toLowerCase().includes(propre))
    : bibliotheque.projets

  const totalImages =
    bibliotheque.projets.reduce((s, p) => s + p.assets, 0) + bibliotheque.sans_projet.assets

  return (
    <main
      data-ouverture
      aria-label="Sur quel jeu travaille-t-on"
      className="flex h-full flex-col overflow-hidden bg-papier p-[30px]"
    >
      <div className="flex items-end justify-between gap-[34px] border-b-2 border-encre pb-[14px]">
        <div className="flex flex-col gap-[8px]">
          <div className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
            Asset Kitchen
          </div>
          <h1 className="font-serif text-[52px] leading-[1] text-encre">
            Sur quel jeu travaille-t-on&nbsp;?
          </h1>
        </div>
        <div className="flex items-center gap-[14px]">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="chercher un jeu"
            className="h-[34px] w-full max-w-[380px] rounded-7 border border-contour bg-carte px-[14px] text-[13.5px] text-encre placeholder:text-encre-4"
          />
          <button
            type="button"
            onClick={onCommencer}
            className="h-[34px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] font-medium text-encre-2 transition-colors duration-120 hover:border-signal hover:text-signal"
          >
            + Commencer un jeu
          </button>
        </div>
      </div>

      <div className="defile min-h-0 flex-1 overflow-y-auto py-[22px]">
        <div className="grid grid-cols-4 items-stretch gap-[22px]">
          {projets.map((projet) => (
            <CarteDuJeu
              key={projet.identifiant}
              projet={projet}
              ouvert={projet.identifiant === bibliotheque.courant}
              avancement={projet.identifiant === bibliotheque.courant ? avancementDuJeuOuvert : null}
              onOuvrir={() => onOuvrir(projet.identifiant)}
              onSupprimer={() => void supprimer(projet.identifiant)}
              confirmerSuppression={aSupprimer === projet.identifiant}
              surConfirmerSuppression={(confirmer) =>
                setASupprimer(confirmer ? projet.identifiant : null)
              }
            />
          ))}

          {/* ── Commencer un jeu ─────────────────────────────────────────── */}
          {/* **Elle n'ouvre plus un champ, elle ouvre le parcours** (`B14`).
              Le champ en ligne qui vivait ici était l'étape du nom, en
              plus petit et à un autre endroit : deux façons de nommer un jeu,
              dont une seule montrait le dossier qu'on ne reprend pas. */}
          <button
            type="button"
            onClick={onCommencer}
            className="flex flex-col items-center justify-center gap-[8px] rounded-8 border border-dashed border-pointille p-[22px] text-center"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-5 border border-pointille text-[15px] font-light text-encre-4">
              +
            </span>
            <span className="text-[15px] font-medium text-encre-2">
              Commencer un jeu
            </span>
            <span className="text-[12.5px] leading-[1.4] text-encre-4">
              Quatre étapes, et chacune se saute. Rien n'est obligatoire, et
              rien ne coûte.
            </span>
          </button>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-[30px] border-t border-contour pt-[14px]">
        <span className="text-[13px] text-encre-2">
          <span className="font-medium">
            {bibliotheque.projets.length} jeu{bibliotheque.projets.length > 1 ? "x" : ""}
          </span>
          {` · ${totalImages} image${totalImages > 1 ? "s" : ""} · `}
          <span className="mesure">{dollars(bibliotheque.total_usd)}</span>
          {" dépensés en tout"}
        </span>
        <div className="flex items-center gap-[22px] text-[12.5px] text-encre-3">
          <button
            type="button"
            onClick={() => void reconstruire()}
            disabled={reconstruction}
            className="hover:text-encre-2 disabled:opacity-50"
          >
            {reconstruction ? "reconstruction…" : "reconstruire la bibliothèque"}
          </button>
          <button type="button" onClick={onGuide} className="hover:text-encre-2">
            <span className="mesure rounded-5 border border-contour px-[4px] text-[10.5px]">
              ?
            </span>{" "}
            Le guide et les touches
          </button>
          <button type="button" onClick={onInstallation} className="hover:text-encre-2">
            l'installation
          </button>
        </div>
      </div>
    </main>
  )
}
