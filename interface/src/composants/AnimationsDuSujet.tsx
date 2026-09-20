/**
 * Ses animations — B11, l'onglet qui range les bandes comme B10 range les images.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Animations.dc.html`. Une ligne dépliable par pose,
 * une rangée par direction dedans, **la retenue en tête** puis les gardées de la
 * plus ancienne à la plus récente — au mot près le rangement d'`ImagesDuSujet.tsx`,
 * pour les bandes plutôt que pour les images.
 *
 * **Le vrai travail de la tranche était au serveur, pas ici** : `favori`, `rang`
 * et `supprime_le` n'existaient pas sur `Bande` avant `B11` — ils existent sur
 * `Asset` depuis `T3`. `atelier/domaine/bande.py` les porte maintenant, sans
 * colonne SQL dédiée : une case de ce produit ne porte jamais plus qu'une
 * poignée de bandes, et `ServiceMontage.purger` relit `contenu` en Python plutôt
 * que d'interroger une colonne indexée — voir sa docstring.
 *
 * ⚠️ **Retenir démote à la main, exactement comme pour les images.**
 * `PUT /strips/favorite` (`atelier/services/montage.py`, `marquer_favori`)
 * écrit `bande.favori` et rien d'autre — le serveur ne tient pas l'unicité de
 * la retenue, il ne la lit même pas encore ailleurs (aucune règle d'export ne
 * regarde ce champ pour l'instant). Deux retenues dans une case sont donc
 * possibles, et retenir ici éteint les autres de la même rangée avant
 * d'allumer celle-ci — le même choix que `B10`, pour que les deux tuiles ne se
 * comportent pas différemment devant le même geste.
 *
 * ⚠️ **Écarter la retenue promeut la plus récente des gardées, et c'est un
 * geste que les images n'ont pas besoin de faire.** Une image écartée sort de
 * `assets_du_personnage` (`supprime_le IS NULL` en SQL) : le serveur
 * redépartage tout seul au prochain rendu, par `corps_retenu`. Une bande n'a
 * pas encore ce départage automatique — rien ne le lui demande —, donc c'est
 * ici, au moment même de l'écart, qu'on pousse `favori` sur la suivante :
 * sans ce geste, une case avec trois bandes gardées et une retenue écartée se
 * retrouverait sans aucune retenue, ce que le critère d'acceptation refuse
 * («la plus récente des gardées prend sa place»).
 *
 * **Les écartées sont visibles ici, et ce n'est pas la règle d'`ImagesDuSujet`.**
 * `bandes_ecartees` (`atelier/services/production.py`, `cases`) porte les
 * bandes dont `supprime_le` est posé, séparément de `bandes` — qui, lui, les
 * exclut, comme `assets_du_personnage` le fait pour les images. La différence
 * avec les images : leur planche `Images.dc.html` dessinait un chip « N
 * écartées » qui n'aurait jamais rien montré, puisque le serveur ne renvoie
 * pas les images supprimées ; `B11` demande explicitement que la bande
 * écartée reste visible, repliée, derrière une flèche — donc le serveur la
 * renvoie à part plutôt que de la taire.
 *
 * **Deux onglets, pas trois.** La planche dessine `toutes / à départager /
 * sans retenue`, mais une case à une seule bande non retenue n'est déjà pas
 * signalée par `ceQuiCloche` (même règle que les images : « il n'y a rien à
 * départager »), donc `sans retenue` désignerait exactement le même ensemble
 * qu'« à départager ». Un onglet qui ne peut jamais isoler un cas de plus
 * qu'un autre est une ligne morte ; il n'est pas construit.
 *
 * **La case « + générer » est la troisième colonne de la grille, pas le
 * dernier élément de la piste** : même construction qu'`ImagesDuSujet.tsx`.
 */

import { useCallback, useMemo, useState } from "react"
import { api, type Bande, type Case, type Generation, type Personnage, type Pose } from "../api"
import { BandeQuiTourne, sujetVideo, useVisee } from "./Apercu"
import { AnimerEnLot, clipsNonMontes, etatDeLaCase, type CaseAAnimer } from "./AnimerEnLot"
import { useEtatDuParcours } from "./MemoireDuParcours"

/** Le côté d'une vignette de rangée, en pixels d'écran. */
const COTE = 81

/** Ce qu'une rangée montre — **une direction, ou l'absence de direction**. */
export type Rangee = {
  cle: string
  pose: string
  direction: string | null
  nom: string
  /** Le nom de l'angle, même quand la rangée ne l'écrit pas — pour ce qui vise
   *  la direction et non la rangée : générer, par exemple. */
  angle: string | null
  retenue: Bande | null
  gardees: Bande[]
  /** Repliées derrière la flèche — dans le même ordre chronologique que les
   *  gardées, en transparence. */
  ecartees: Bande[]
  /** Ce que cette rangée porte, retenue et gardées — **les écartées n'y
   *  comptent pas**, comme une image supprimée ne compte plus dans sa case. */
  compte: number
  /** Une sortie d'animation explicite vise cette direction. Ce n'est pas le
   *  plan historique : lui reste visible seulement lorsqu'il conserve déjà
   *  une bande. */
  demandee?: boolean
}

/** La retenue, puis les gardées de la plus ancienne à la plus récente.
 *
 *  **Le même départage que `rangerLaLigne` d'`ImagesDuSujet.tsx`**, au mot
 *  près : `favori`, puis la plus récente en cas d'égalité. Il ne regarde que
 *  les bandes vivantes — les écartées sont fournies à part et n'entrent
 *  jamais dans ce calcul. */
export function rangerLaLigne(bandes: readonly Bande[]): {
  retenue: Bande | null
  gardees: Bande[]
} {
  const chronologiques = [...bandes].sort(
    (a, b) => a.cree_le - b.cree_le || a.rang - b.rang,
  )
  const retenue = chronologiques.filter((b) => b.favori).at(-1) ?? null
  return {
    retenue,
    gardees: chronologiques.filter((b) => b !== retenue),
  }
}

/** Les rangées d'une pose — une par direction tenue, ou une seule sans
 *  direction déclarée.
 *
 *  `avecDirections` faux (une nature qui n'a pas de directions, D1) : une seule
 *  rangée, qui garde toutes les animations de la pose, même rangées d'ancienne
 *  date sous une direction — elles restent visibles au lieu de disparaître. */
export function rangeesDeLaCase(sienne: Case, avecDirections = true): Rangee[] {
  const composer = (
    direction: string | null,
    nom: string,
    bandes: readonly Bande[],
    ecartees: readonly Bande[],
    angle: string | null = null,
  ): Rangee => ({
    cle: `${sienne.pose}/${direction ?? "—"}`,
    pose: sienne.pose,
    direction,
    nom,
    angle,
    compte: bandes.length,
    ecartees: [...ecartees].sort(
      (a, b) => a.cree_le - b.cree_le || a.rang - b.rang,
    ),
    ...rangerLaLigne(bandes),
  })

  // `Case.bandes` et `Case.bandes_ecartees` sont déjà **toutes** les bandes de la
  // pose, directions confondues (le serveur les répartit ensuite dans
  // `directions`) : rien à additionner.
  if (!avecDirections || sienne.directions.length === 0)
    return [composer(null, "toutes", sienne.bandes, sienne.bandes_ecartees)]

  return sienne.directions.map((d) =>
    composer(d.identifiant, d.nom, d.bandes, d.bandes_ecartees, d.nom),
  )
}

/** Ce qu'une pose a d'inachevé, dit en un mot — ou rien.
 *
 *  Même construction que le pendant d'`ImagesDuSujet.tsx`, moins « à confirmer » :
 *  une bande sans direction se range déjà dans la première (même repli qu'une
 *  image), mais aucune règle de ce dépôt ne compte encore les bandes qui
 *  l'attendent — ce compte n'existe pas côté serveur pour les animations, et
 *  l'inventer à l'écran aurait affiché un nombre que personne d'autre ne peut
 *  vérifier. */
function ceQuiCloche(rangees: readonly Rangee[], objectifExplicite: boolean): string | null {
  const manquantes = rangees.filter((r) => r.demandee && r.compte === 0).length
  if (manquantes > 0)
    return manquantes === 1 ? "1 à fabriquer" : `${manquantes} à fabriquer`
  if (!objectifExplicite && rangees.every((r) => r.compte === 0)) return "rien"
  const aDepartager = rangees.filter((r) => r.compte > 1 && !r.retenue).length
  if (aDepartager > 0)
    return aDepartager === 1 ? "1 à départager" : `${aDepartager} à départager`
  const vides = rangees.filter((r) => r.compte === 0 && r.direction !== null).length
  if (vides > 0) return vides === 1 ? "1 direction vide" : `${vides} directions vides`
  return null
}

// ── Les pièces ──────────────────────────────────────────────────────────────

/** La vignette d'une bande — **sa planche qui tourne**, pas une image fixe :
 *  `BandeQuiTourne` (`Apercu.tsx`) est déjà ce que la galerie et l'atelier de
 *  bande affichent, et en écrire une seconde ici aurait fini par ne plus
 *  rendre les mêmes pixels au même rythme. */
function VignetteDeBande({
  bande,
  etat,
  choisie,
  onChoisir,
  cote = COTE,
  galerie = false,
}: {
  bande: Bande
  etat: "retenue" | "gardee" | "ecartee"
  choisie: boolean
  onChoisir: () => void
  cote?: number
  galerie?: boolean
}) {
  const [survol, setSurvol] = useState(false)
  const [focus, setFocus] = useState(false)
  return (
    <button
      type="button"
      onClick={onChoisir}
      onPointerEnter={() => setSurvol(true)} onPointerLeave={() => setSurvol(false)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      aria-current={choisie}
      aria-label={`${galerie ? "Retoucher " : ""}${bande.nom || "une animation"}${etat === "retenue" ? ", la retenue" : ""}${etat === "ecartee" ? ", écartée" : ""}`}
      data-vignette-de-bande={bande.identifiant}
      className={[
        "relative block shrink-0 overflow-hidden rounded-7",
        etat === "retenue" ? "ring-2 ring-ok" : "",
        etat === "ecartee" ? "opacity-45" : "",
        choisie && etat !== "retenue" ? "ring-1 ring-encre-4" : "",
      ].join(" ")}
    >
      <BandeQuiTourne bande={bande} cote={cote} joue={survol || focus} />
    </button>
  )
}

/** Les trois marques d'une bande gardée — retenue, gardée, écartée. Même
 *  patron qu'`ImagesDuSujet.tsx` : trois boutons, jamais une bascule, pour que
 *  l'état courant se voie sans avoir à se rappeler ce que le clic ferait. */
function Marques({
  retenue,
  contexte = "",
  onRetenir,
  onGarder,
  onEcarter,
}: {
  retenue: boolean
  contexte?: string
  onRetenir: () => void
  onGarder: () => void
  onEcarter: () => void
}) {
  const commun =
    "flex h-[14px] flex-1 items-center justify-center text-[10.5px] transition-colors duration-120"
  return (
    <span className="flex overflow-hidden rounded-5 border border-trait bg-carte">
      <button
        type="button"
        onClick={onRetenir}
        aria-pressed={retenue}
        aria-label={`Choisir pour le jeu${contexte}`}
        className={`${commun} border-r border-trait-faible ${
          retenue ? "bg-ok text-encre-sur-signal" : "text-eteint hover:text-encre"
        }`}
      >
        ●
      </button>
      <button
        type="button"
        onClick={onGarder}
        aria-pressed={!retenue}
        aria-label={`La garder seulement${contexte}`}
        className={`${commun} border-r border-trait-faible ${
          retenue ? "text-eteint hover:text-encre" : "bg-ligne-ouverte text-encre-controle"
        }`}
      >
        ○
      </button>
      <button
        type="button"
        onClick={onEcarter}
        aria-label={`L'écarter${contexte}`}
        className={`${commun} text-eteint hover:text-echec`}
      >
        ⊘
      </button>
    </span>
  )
}

const heure = (quand: number) =>
  new Date(quand * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })

const jour = (quand: number) =>
  new Date(quand * 1000).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  })

function CaseDeGeneration({ onArmer, quoi }: { onArmer: () => void; quoi: string }) {
  return (
    <button
      type="button"
      onClick={onArmer}
      aria-label={`Générer ${quoi}`}
      data-case-de-generation
      className="flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center gap-[4px] rounded-7 border border-dashed border-pointille text-encre-4 transition-colors duration-120 hover:border-contour hover:text-encre-2"
    >
      <span aria-hidden className="text-[15px] leading-none">
        +
      </span>
      <span className="text-[10.5px] leading-none">générer</span>
    </button>
  )
}

// ── Les rangées d'une pose ──────────────────────────────────────────────────

/** **Un clip pas encore monté**, dans sa rangée : en route, ou arrivé sans
 *  animation. Un cadre en pointillés couleur signal le distingue des
 *  animations ; cliquer un clip arrivé ouvre son montage.
 *
 *  **Au survol, la vidéo entière se lit** — pas une sélection d'images : rien
 *  n'est encore taillé dedans, et c'est justement ce qu'on vient regarder. Au
 *  repos, la couverture seule, pour ne télécharger aucune vidéo. */
function VignetteDeClip({ clip, onMonter }: { clip: Generation; onMonter?: (clip: string) => void }) {
  const arrive = clip.statut === "reussie"
  const [survol, setSurvol] = useState(false)
  const visee = useVisee(arrive ? sujetVideo(clip.identifiant, clip.demande.prompt || "clip") : null)
  return (
    <span className="flex w-[81px] shrink-0 flex-col gap-[4px]">
      <button
        type="button"
        data-clip-non-monte={clip.identifiant}
        disabled={!arrive || !onMonter}
        onClick={() => onMonter?.(clip.identifiant)}
        onPointerEnter={() => { setSurvol(true); visee.entrer() }}
        onPointerLeave={() => { setSurvol(false); visee.sortir() }}
        aria-label={arrive ? "Monter ce clip" : "Clip en route"}
        title={arrive ? "Clip arrivé, pas encore monté — cliquer pour le monter" : "Clip en route"}
        className="relative flex h-[81px] w-[81px] items-center justify-center overflow-hidden rounded-7 border-2 border-dashed border-signal bg-pourtour"
      >
        {arrive && survol ? (
          <video
            src={api.videoDuClip(clip.identifiant)}
            autoPlay
            loop
            muted
            playsInline
            poster={api.couvertureDuClip(clip.identifiant, COTE * 2)}
            className="h-full w-full object-contain [image-rendering:pixelated]"
          />
        ) : arrive ? (
          <img alt="" src={api.couvertureDuClip(clip.identifiant, COTE * 2)} className="h-full w-full object-contain [image-rendering:pixelated]" />
        ) : (
          <span aria-hidden className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-[1.5px] border-encre-4 border-t-signal" />
        )}
      </button>
      <span className="text-center text-[10.5px] leading-none text-signal">{arrive ? "à monter" : "en route"}</span>
    </span>
  )
}

function LigneDeRangee({
  rangee,
  enAttente,
  onMonter,
  cleMemoire,
  choisie,
  onChoisir,
  onRetenir,
  onGarder,
  onEcarter,
  onRestaurer,
  onGenerer,
}: {
  rangee: Rangee
  enAttente: Generation[]
  onMonter?: (clip: string) => void
  cleMemoire: string
  choisie: string | null
  onChoisir: (bande: Bande) => void
  onRetenir: (bande: Bande, rangee: Rangee) => void
  onGarder: (bande: Bande) => void
  onEcarter: (bande: Bande, rangee: Rangee) => void
  onRestaurer: (bande: Bande) => void
  onGenerer: (rangee: Rangee) => void
}) {
  const [ecarteesOuvertes, setEcarteesOuvertes] = useEtatDuParcours(`${cleMemoire}:ecartees`, true)

  const vignette = (bande: Bande, etat: "retenue" | "gardee") => (
    <span key={bande.identifiant} className="flex w-[81px] shrink-0 flex-col gap-[4px]">
      <VignetteDeBande
        bande={bande}
        etat={etat}
        choisie={choisie === bande.identifiant}
        onChoisir={() => onChoisir(bande)}
      />
      <span className="flex justify-center text-[10.5px] leading-none">
        {etat === "retenue" ? (
          <span className="text-ok">la retenue</span>
        ) : (
          <span className="mesure text-encre-4">{heure(bande.cree_le)}</span>
        )}
      </span>
      <Marques
        retenue={etat === "retenue"}
        onRetenir={() => onRetenir(bande, rangee)}
        onGarder={() => onGarder(bande)}
        onEcarter={() => onEcarter(bande, rangee)}
      />
    </span>
  )

  return (
    <div
      data-rangee={rangee.cle}
      className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-start gap-[8px] border-t border-trait-faible py-[8px]"
    >
      <span className="flex flex-col gap-[4px] pt-[14px]">
        <span className="text-[12.5px] leading-[1.2] text-encre">{rangee.nom}</span>
        <span className="mesure text-[10.5px] text-encre-4">
          {rangee.compte === 0 ? "—" : rangee.compte}
        </span>
      </span>

      <span className="min-w-0">
        {rangee.compte === 0 && rangee.ecartees.length === 0 && enAttente.length === 0 ? (
          <span className="flex h-[81px] items-center text-[12px] text-eteint">
            {rangee.demandee
              ? "aucun clip encore — à fabriquer"
              : "rien encore — aucun clip pour cette direction"}
          </span>
        ) : (
          <span className="defile flex items-start gap-[8px] overflow-x-auto overflow-y-hidden py-[4px]">
            {rangee.retenue ? (
              vignette(rangee.retenue, "retenue")
            ) : (
              // **Le seul rouge de la rangée** : plusieurs bandes, et aucune
              // ne sort dans le jeu.
              rangee.compte > 0 && (
                <span className="flex h-[81px] w-[81px] shrink-0 items-center justify-center rounded-7 border border-dashed border-trait-echec bg-fond-echec px-[4px] text-center text-[10.5px] leading-[1.2] text-echec">
                  aucune retenue
                </span>
              )
            )}
            {(rangee.retenue || rangee.compte > 1) && rangee.gardees.length > 0 && (
              <span aria-hidden className="w-px self-stretch bg-pointille" />
            )}
            {rangee.gardees.map((bande) => vignette(bande, "gardee"))}

            {rangee.ecartees.length > 0 && (
              <>
                <span aria-hidden className="w-px self-stretch bg-pointille" />
                <span className="flex shrink-0 flex-col items-start gap-[4px] pt-[14px]">
                  <button
                    type="button"
                    onClick={() => setEcarteesOuvertes((v) => !v)}
                    aria-expanded={ecarteesOuvertes}
                    className="inline-flex h-[26px] items-center gap-[5px] whitespace-nowrap rounded-full border border-contour bg-carte px-[14px] text-[11.5px] text-encre-2"
                  >
                    <span aria-hidden>{ecarteesOuvertes ? "▾" : "▸"}</span>
                    <span className="mesure">{rangee.ecartees.length}</span>{" "}
                    {rangee.ecartees.length > 1 ? "écartées" : "écartée"}
                  </button>
                  {ecarteesOuvertes && (
                    <span className="flex items-start gap-[8px]">
                      {rangee.ecartees.map((bande) => (
                        <span
                          key={bande.identifiant}
                          className="flex w-[81px] shrink-0 flex-col gap-[4px]"
                        >
                          <VignetteDeBande
                            bande={bande}
                            etat="ecartee"
                            choisie={choisie === bande.identifiant}
                            onChoisir={() => onChoisir(bande)}
                          />
                          <button
                            type="button"
                            onClick={() => onRestaurer(bande)}
                            aria-label={`Restaurer ${bande.nom || "cette animation"}`}
                            className="h-[22px] rounded-5 border border-trait bg-carte text-[10.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
                          >
                            restaurer
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </>
            )}
          </span>
        )}
      </span>

      {/* **Les clips pas encore montés, tout à droite, juste avant « générer »**
          (demandé le 18 septembre 2026) : hors de la piste qui défile, ils
          restent en vue quelle que soit la longueur de la rangée. */}
      <span className="flex shrink-0 items-start gap-[8px]">
        {enAttente.map((clip) => <VignetteDeClip key={clip.identifiant} clip={clip} onMonter={onMonter} />)}
        <CaseDeGeneration
          onArmer={() => onGenerer(rangee)}
          quoi={rangee.angle ?? "cette pose"}
        />
      </span>
    </div>
  )
}

// ── L'onglet ────────────────────────────────────────────────────────────────

type Filtre = "toutes" | "a-departager"

export function AnimationsDuSujet({
  personnage,
  plan,
  onAnimer,
  onOuvrirLaBande,
  onErreur,
  clips = [],
  onMonterLeClip,
  onClipsCommandes,
  avecDirections = true,
}: {
  personnage: Personnage
  /** Ce que cette chose-là réclame — sa liste, pas celle du jeu. */
  plan: Pose[]
  /** Sa nature a-t-elle des directions ? (`capacites.directions`, D1.) Faux :
   *  pas de filtre « Direction », pas de rangée par direction. **Vrai par
   *  défaut** : tant que la nature n'est pas connue, un personnage ne perd
   *  rien. */
  avecDirections?: boolean
  /** **Animer cette attitude** (A9) — l'écran qui commande un clip, déjà
   *  porté par `PageDuSujet`. Il ne dépense rien ici : c'est le bouton de cet
   *  écran-là qui paie. */
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  /** **Retravailler une animation gardée** (A7) — l'autre porte de la
   *  vignette, déjà portée par `PageDuSujet`. */
  onOuvrirLaBande: (bande: string) => void
  onErreur: (erreur: unknown, defaut: string) => void
  /** Les clips du jeu — ceux de ce sujet pas encore montés paraissent dans
   *  leur rangée, et un lot ne relance pas une case dont un clip est en route. */
  clips?: readonly Generation[]
  onMonterLeClip?: (clip: string) => void
  /** Des clips viennent de partir d'un lot : la liste est à relire. */
  onClipsCommandes?: (clips: Generation[]) => void
}) {
  const nonMontes = useMemo(() => clipsNonMontes(clips, personnage), [clips, personnage])
  const [lot, setLot] = useState<{ titre: string; cases: CaseAAnimer[] } | null>(null)
  const nomDePose = useMemo(
    () => new Map(plan.map((p) => [p.identifiant, p.nom])),
    [plan],
  )

  const objectifExplicite = personnage.objectif != null
  const animationsDemandees = personnage.objectif?.sorties.filter(
    (sortie) => sortie.nature === "animation" && sortie.quantite > 0,
  ) ?? []
  const cle = `animations:${personnage.projet}:${personnage.identifiant}`
  const [poseOuverte, setPoseOuverte] = useEtatDuParcours<string | null>(
    `${cle}:pose`,
    animationsDemandees[0]?.pose ?? personnage.cases[0]?.pose ?? null,
  )
  const [filtre, setFiltre] = useEtatDuParcours<Filtre>(`${cle}:filtre`, "toutes")
  const [choisie, setChoisie] = useEtatDuParcours<string | null>(`${cle}:choisie`, null)
  const [galeriePose, setGaleriePose] = useEtatDuParcours(`${cle}:galerie-pose`, "")
  const [galerieDirection, setGalerieDirection] = useEtatDuParcours(`${cle}:galerie-direction`, "")
  const [galerieStatut, setGalerieStatut] = useEtatDuParcours(`${cle}:galerie-statut`, "")

  const parPose = useMemo(() => {
    const estDemandee = (rangee: Rangee) => animationsDemandees.some(
      (sortie) => sortie.pose === rangee.pose && sortie.direction === (rangee.direction ?? ""),
    )
    return personnage.cases
      .map((sienne) => ({
        sienne,
        nom: nomDePose.get(sienne.pose) ?? sienne.pose,
        rangees: rangeesDeLaCase(sienne, avecDirections)
          .map((rangee) => ({ ...rangee, demandee: estDemandee(rangee) }))
          // Une ligne sans sortie demandée reste utile uniquement si elle porte
          // une bande ancienne, active ou écartée. La matrice historique ne se
          // transforme donc pas en liste de fabrications à faire.
          .filter((rangee) => !objectifExplicite || rangee.demandee || rangee.compte > 0 || rangee.ecartees.length > 0),
      }))
      .filter(({ rangees }) => rangees.length > 0)
  }, [personnage.cases, nomDePose, animationsDemandees, objectifExplicite, avecDirections])

  const casesDe = (quelles: typeof parPose): CaseAAnimer[] =>
    quelles.flatMap(({ sienne, nom, rangees }) =>
      rangees.map((r) => ({
        pose: sienne.pose,
        poseNom: nom,
        direction: r.direction,
        directionNom: r.direction ? r.angle ?? r.nom : null,
        etat: etatDeLaCase(r, nonMontes),
      })),
    )
  const ouvrirLot = (titre: string, cases: CaseAAnimer[]) => setLot({ titre, cases })
  const enAttenteDe = (r: Rangee) =>
    nonMontes.filter((g) => g.pose === r.pose && (g.direction ?? null) === r.direction)

  // **Déplacer l'animation choisie vers une autre case** — demandé le
  // 16 septembre 2026, pour une animation enregistrée sur la mauvaise pose.
  const [destPose, setDestPose] = useState("")
  const [destDirection, setDestDirection] = useState("")
  const deplacer = useCallback(
    async (cible: Bande, pose: string, direction: string) => {
      try {
        await api.affecterLaBande(cible.identifiant, pose, direction || null)
      } catch (erreur) {
        onErreur(erreur, "l'animation n'a pas pu changer de case")
      }
    },
    [onErreur],
  )

  const poses = parPose.filter(({ rangees }) => {
    if (filtre === "toutes") return true
    return rangees.some((r) => r.compte > 1 && !r.retenue)
  })
  const galerie = parPose.flatMap(({ nom, rangees }) => rangees.flatMap((rangee) => [
    ...(rangee.retenue ? [{ bande: rangee.retenue, statut: "retenue" as const, rangee, nom }] : []),
    ...rangee.gardees.map((bande) => ({ bande, statut: "gardee" as const, rangee, nom })),
    ...rangee.ecartees.map((bande) => ({ bande, statut: "ecartee" as const, rangee, nom })),
  ]))
  const galerieFiltree = galerie.filter((item) => (!galeriePose || item.rangee.pose === galeriePose) && (!galerieDirection || item.rangee.direction === galerieDirection) && (!galerieStatut || item.statut === galerieStatut))
  const directionsGalerie = [...new Map(parPose.flatMap(({ rangees }) => rangees.filter((r) => r.direction).map((r) => [r.direction!, r.angle ?? r.nom] as const))).entries()]

  /** La bande du volet, ouvert à la demande. Relue dans les cases à chaque rendu, comme pour
   *  les images : gardée en objet, elle serait celle d'avant le dernier
   *  changement de favori. */
  const bande = useMemo(() => {
    const toutes = parPose.flatMap((p) => p.rangees.flatMap((r) => [...(r.retenue ? [r.retenue] : []), ...r.gardees, ...r.ecartees]))
    return (
      toutes.find((b) => b.identifiant === choisie) ??
      null
    )
  }, [personnage.cases, choisie, parPose, poseOuverte])

  /** La rangée de la bande du volet — pour dire ses sœurs et son angle. */
  const rangeeChoisie = useMemo(() => {
    if (!bande) return null
    for (const { rangees } of parPose)
      for (const r of rangees)
        if (
          r.retenue?.identifiant === bande.identifiant ||
          r.gardees.some((g) => g.identifiant === bande.identifiant) ||
          r.ecartees.some((e) => e.identifiant === bande.identifiant)
        )
          return r
    return null
  }, [bande, parPose])

  const poseDe = useCallback(
    (identifiant: string): Pose | null =>
      plan.find((p) => p.identifiant === identifiant) ?? null,
    [plan],
  )

  /** Retenir celle-ci, **et éteindre les autres de sa rangée** — même garde
   *  que `retenir` d'`ImagesDuSujet.tsx`, pour la même raison : le serveur
   *  écrit le champ et ne démote personne (`docs/PIEGES.md`). */
  const retenir = useCallback(
    async (cible: Bande, rangee: Rangee) => {
      const autres = [rangee.retenue, ...rangee.gardees]
        .filter((b): b is Bande => b != null && b.favori && b !== cible)
        .map((b) => b.identifiant)
      try {
        if (autres.length > 0) await api.favoriBande(autres, false)
        await api.favoriBande([cible.identifiant], true)
      } catch (erreur) {
        onErreur(erreur, "la retenue a été refusée")
      }
    },
    [onErreur],
  )

  const garder = useCallback(
    async (cible: Bande) => {
      if (!cible.favori) return
      try {
        await api.favoriBande([cible.identifiant], false)
      } catch (erreur) {
        onErreur(erreur, "la retenue a été refusée")
      }
    },
    [onErreur],
  )

  /** Écarter, **et promouvoir la plus récente des gardées si c'était la
   *  retenue** — le geste que les critères d'acceptation demandent, et que le
   *  serveur ne fait pas tout seul pour une bande (voir l'en-tête du fichier).
   *  L'écart part en premier : un échec de la promotion laisse une case sans
   *  retenue plutôt que d'en écarter une par erreur. */
  const ecarter = useCallback(
    async (cible: Bande, rangee: Rangee) => {
      const etaitRetenue = rangee.retenue?.identifiant === cible.identifiant
      try {
        await api.ecarterBandes([cible.identifiant])
        if (etaitRetenue) {
          const suivante = rangee.gardees.at(-1)
          if (suivante) await api.favoriBande([suivante.identifiant], true)
        }
      } catch (erreur) {
        onErreur(erreur, "l'écart a été refusé")
      }
    },
    [onErreur],
  )

  const restaurer = useCallback(
    async (cible: Bande) => {
      try {
        await api.restaurerBandes([cible.identifiant])
      } catch (erreur) {
        onErreur(erreur, "la restauration a été refusée")
      }
    },
    [onErreur],
  )

  return (
    <div data-onglet-animations className="flex items-start" onDoubleClick={e => {
      const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-vignette-de-bande]")?.dataset.vignetteDeBande
      if (cible) { setChoisie(null); onOuvrirLaBande(cible) }
    }}>
      {/* `min-w-0` : sans lui, la surface pousse le volet hors de la fenêtre —
          voir la note d'`ImagesDuSujet.tsx`. */}
      <section className="flex min-w-0 flex-1 flex-col gap-[14px]">
        <div className="flex items-center justify-between gap-[14px]">
          <p className="text-[13px] text-encre-2">
            {objectifExplicite
              ? "L’objectif montre les animations attendues. Les bandes déjà conservées hors objectif restent accessibles."
              : "Une rangée par direction — la retenue à gauche, les versions à juger ensuite, les clips pas encore montés tout à droite. Survolez pour lire, Espace pour voir en grand."}
          </p>
          <button
            type="button"
            data-tout-animer
            disabled={parPose.length === 0}
            onClick={() => ouvrirLot(`Animer ${personnage.nom}`, casesDe(parPose))}
            className="h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle hover:border-encre-4 disabled:opacity-50"
          >
            Tout animer
          </button>
          <div
            role="tablist"
            aria-label="Ce qu'on regarde"
            className="flex shrink-0 gap-[4px] rounded-8 bg-papier-cote p-[4px]"
          >
            {(
              [
                ["toutes", "toutes"],
                ["a-departager", "à départager"],
              ] as const
            ).map(([clef, mot]) => (
              <button
                key={clef}
                type="button"
                role="tab"
                aria-selected={filtre === clef}
                onClick={() => setFiltre(clef)}
                className={[
                  "flex h-[26px] items-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                  filtre === clef
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                {mot}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          {poses.length === 0 && (
            <p className="text-[13px] text-encre-3">
              {personnage.cases.length === 0
                ? "Ce type d'objet ne réclame aucune pose."
                : "Rien de ce genre-là dans ses poses."}
            </p>
          )}
          {poses.map(({ sienne, nom, rangees }) => {
            const ouverte = poseOuverte === sienne.pose
            const animations = rangees.reduce((somme, r) => somme + r.compte, 0)
            const cloche = ceQuiCloche(rangees, objectifExplicite)
            return (
              <div
                key={sienne.pose}
                data-pose-de-rangement={sienne.pose}
                className="flex flex-col rounded-10 border border-trait bg-carte px-[14px]"
              >
                <div className="flex items-center gap-[8px]">
                <button
                  type="button"
                  aria-expanded={ouverte}
                  onClick={() => setPoseOuverte(ouverte ? null : sienne.pose)}
                  className="flex min-w-0 flex-1 items-baseline gap-[8px] py-[8px] text-left"
                >
                  <span aria-hidden className="text-[12px] text-encre-4">
                    {ouverte ? "▾" : "▸"}
                  </span>
                  <span className="font-serif text-[25px] leading-[1.15] text-encre">{nom}</span>
                  <span className="text-[12px] text-encre-3">
                    {animations === 0 ? (
                      "aucune animation"
                    ) : (
                      <>
                        {avecDirections && (
                          <>
                            <span className="mesure">{rangees.length}</span>{" "}
                            {rangees.length > 1 ? "directions" : "direction"} ·{" "}
                          </>
                        )}
                        <span className="mesure">{animations}</span>{" "}
                        {animations > 1 ? "animations" : "animation"}
                      </>
                    )}
                  </span>
                  {objectifExplicite && rangees.every((rangee) => !rangee.demandee) && (
                    <span className="rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-attention">
                      hors objectif
                    </span>
                  )}
                  {cloche && (
                    <span
                      className={[
                        "ml-auto rounded-5 border px-[8px] text-[10.5px] uppercase tracking-[0.14em]",
                        cloche.includes("départager")
                          ? "border-trait-echec bg-fond-echec text-echec"
                          : "border-trait-attention bg-fond-attention text-encre-attention",
                      ].join(" ")}
                    >
                      {cloche}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  data-animer-la-pose={sienne.pose}
                  onClick={() => ouvrirLot(`Animer « ${nom} »`, casesDe([{ sienne, nom, rangees }]))}
                  className="h-[26px] shrink-0 rounded-7 border border-contour bg-carte px-[8px] text-[11.5px] text-encre-controle hover:border-encre-4"
                >
                  {rangees.length > 1 ? "Animer les directions" : "Animer"}
                </button>
                </div>
                {ouverte && (
                  <div className="flex flex-col pb-[8px]">
                    {rangees.map((rangee) => (
                      <LigneDeRangee
                        key={rangee.cle}
                        cleMemoire={`${cle}:${rangee.cle}`}
                        rangee={rangee}
                        enAttente={enAttenteDe(rangee)}
                        onMonter={onMonterLeClip}
                        choisie={bande?.identifiant ?? null}
                        onChoisir={(cible) => setChoisie(cible.identifiant)}
                        onRetenir={(cible, sa) => void retenir(cible, sa)}
                        onGarder={(cible) => void garder(cible)}
                        onEcarter={(cible, sa) => void ecarter(cible, sa)}
                        onRestaurer={(cible) => void restaurer(cible)}
                        onGenerer={(sa) => {
                          const pose = poseDe(sa.pose)
                          if (pose)
                            onAnimer(
                              personnage,
                              pose,
                              sa.direction ? { identifiant: sa.direction, nom: sa.angle ?? sa.nom } : null,
                            )
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <section aria-label="Galerie des animations" className="mt-[22px] flex flex-col gap-[14px] border-t border-trait pt-[14px]">
            <h2 className="font-serif text-[25px]">Galerie des animations</h2>
            <div className="flex flex-wrap gap-[8px] text-[12px]">
              <label>Mouvement / pose <select aria-label="Mouvement de la galerie" value={galeriePose} onChange={(e) => setGaleriePose(e.target.value)} className="rounded-7 border border-trait bg-carte p-[8px]"><option value="">Tous</option>{parPose.map((p) => <option key={p.sienne.pose} value={p.sienne.pose}>{p.nom}</option>)}</select></label>
              {avecDirections && <label>Direction <select aria-label="Direction de la galerie" value={galerieDirection} onChange={(e) => setGalerieDirection(e.target.value)} className="rounded-7 border border-trait bg-carte p-[8px]"><option value="">Toutes</option>{directionsGalerie.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}</select></label>}
              <label>Jugement <select aria-label="Jugement de la galerie" value={galerieStatut} onChange={(e) => setGalerieStatut(e.target.value)} className="rounded-7 border border-trait bg-carte p-[8px]"><option value="">Tous</option><option value="retenue">Retenu</option><option value="gardee">Non jugé</option><option value="ecartee">Écarté</option></select></label>
            </div>
            <p role="status" className="text-[12px] text-encre-3">{galerieFiltree.length} animation{galerieFiltree.length > 1 ? "s" : ""}</p>
            <div className="grid grid-cols-2 gap-[14px]">
              {galerieFiltree.map(({ bande: cible, statut, rangee, nom }) => <article key={cible.identifiant} data-carte-animation={cible.identifiant} className="flex min-w-0 flex-col gap-[8px] rounded-10 border border-trait bg-carte p-[14px]">
                <div className="flex justify-center"><VignetteDeBande bande={cible} galerie cote={192} etat={statut} choisie={choisie === cible.identifiant} onChoisir={() => { setChoisie(null); onOuvrirLaBande(cible.identifiant) }} /></div>
                <p className="truncate text-[13px]">{nom} · {rangee.angle ?? "sans direction"}</p>
                <p className="text-[11px] text-encre-3">{statut === "gardee" ? "Non jugé" : statut === "retenue" ? "Retenu" : "Écarté"} · {cible.compte} frames · {cible.cadence} i/s</p>
                {statut === "ecartee" ? <button type="button" onClick={() => void restaurer(cible)}>Remettre à juger</button> : <Marques contexte={` dans la galerie : ${cible.nom}`} retenue={statut === "retenue"} onRetenir={() => void retenir(cible, rangee)} onGarder={() => void garder(cible)} onEcarter={() => void ecarter(cible, rangee)} />}
                <button type="button" onClick={() => { setChoisie(null); onOuvrirLaBande(cible.identifiant) }} className="rounded-7 border border-trait px-[8px] py-[4px] text-[12px]">Retoucher</button>
              </article>)}
            </div>
            {galerieFiltree.length === 0 && <p className="text-[12px] text-encre-3">Aucune animation pour ces filtres.</p>}
          </section>
        </div>
      </section>

      {/* ── Le volet de la bande choisie ─────────────────────────────────── */}
      {bande ? (
        <aside
          data-volet-de-la-bande
          aria-label="L'animation choisie"
          className="volet volet-colle defile flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
        >
          <button type="button" onClick={() => setChoisie(null)} className="h-[30px] self-end rounded-7 border border-contour bg-carte px-[14px] text-[13px]">Fermer les détails</button>
          <div className="flex items-baseline justify-between gap-[8px]">
            <span className="font-serif text-[25px] leading-[1.15] text-encre">
              {bande.favori ? "L'animation retenue" : "L'animation choisie"}
            </span>
            {bande.favori && (
              <span className="rounded-5 border border-trait-ok bg-fond-ok px-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-ok">
                retenue
              </span>
            )}
          </div>

          <p className="text-[13px] text-encre-2">
            {personnage.nom}, {nomDePose.get(bande.pose ?? "") ?? "sans pose"}
            {bande.direction ? `, vers ${bande.direction}` : ""} — {bande.supprime ? "version écartée" : bande.favori ? "retenue pour le jeu" : "version à juger"}.
          </p>

          <span className="flex h-[300px] items-center justify-center overflow-hidden rounded-8 bg-pourtour">
            <BandeQuiTourne bande={bande} cote={200} titre={bande.nom} />
          </span>

          <dl className="flex flex-col gap-[4px] border-t border-trait pt-[8px] text-[12.5px]">
            {(
              [
                [
                  "Ses images",
                  bande.compte === 0
                    ? "aucune"
                    : `${bande.compte}, de la ${Math.min(...bande.images)} à la ${Math.max(...bande.images)}`,
                ],
                ["Sa vitesse", `${bande.cadence} par seconde — ${bande.secondes} s`],
                ["Son sens", bande.sens === "boucle" ? "en boucle" : "aller-retour"],
                ["Faite le", `${jour(bande.cree_le)} · ${heure(bande.cree_le)}`],
              ] as const
            ).map(([mot, valeur]) => (
              <div key={mot} className="flex justify-between gap-[14px]">
                <dt className="text-encre-3">{mot}</dt>
                <dd className="text-right text-encre">{valeur}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-[14px]">
              <dt className="text-encre-3">Taillée dans</dt>
              <dd className="text-right">
                <button
                  type="button"
                  onClick={() => { setChoisie(null); onOuvrirLaBande(bande.identifiant) }}
                  className="text-encre-controle underline underline-offset-2 hover:text-encre"
                >
                  le clip
                </button>
              </dd>
            </div>
            <div className="flex justify-between gap-[14px]">
              <dt className="text-encre-3">Ce qu'elle a coûté</dt>
              <dd className="text-right text-ok">rien — le clip était payé</dd>
            </div>
            {rangeeChoisie && (
              <div className="flex justify-between gap-[14px]">
                <dt className="text-encre-3">Ses sœurs</dt>
                <dd className="text-right text-encre">
                  {rangeeChoisie.compte - 1 > 0
                    ? `${rangeeChoisie.compte - 1} autre${rangeeChoisie.compte - 1 > 1 ? "s" : ""} essai${rangeeChoisie.compte - 1 > 1 ? "s" : ""}`
                    : "aucune"}
                  {rangeeChoisie.ecartees.length > 0
                    ? `, ${rangeeChoisie.ecartees.length} écartée${rangeeChoisie.ecartees.length > 1 ? "s" : ""}`
                    : ""}
                </dd>
              </div>
            )}
          </dl>

          {(() => {
            const pose = destPose || bande.pose || ""
            const directions = avecDirections ? personnage.cases.find((c) => c.pose === pose)?.directions ?? [] : []
            const direction = directions.some((d) => d.identifiant === destDirection)
              ? destDirection
              : pose === bande.pose && directions.some((d) => d.identifiant === bande.direction)
                ? bande.direction ?? ""
                : directions[0]?.identifiant ?? ""
            const inchangee = pose === (bande.pose ?? "") && direction === (bande.direction ?? "")
            return (
              <div data-deplacer-l-animation className="flex flex-col gap-[8px] border-t border-trait pt-[8px] text-[12.5px]">
                <span className="text-encre-3">Changer de pose ou de direction</span>
                <div className="flex flex-wrap items-center gap-[8px]">
                  <select aria-label="Pose de destination" value={pose} onChange={(e) => { setDestPose(e.target.value); setDestDirection("") }} className="h-[30px] rounded-7 border border-contour bg-carte px-[8px]">
                    {personnage.cases.map((c) => <option key={c.pose} value={c.pose}>{nomDePose.get(c.pose) ?? c.pose}</option>)}
                  </select>
                  {directions.length > 0 && (
                    <select aria-label="Direction de destination" value={direction} onChange={(e) => setDestDirection(e.target.value)} className="h-[30px] rounded-7 border border-contour bg-carte px-[8px]">
                      {directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={inchangee || !pose}
                    onClick={() => { void deplacer(bande, pose, direction); setDestPose(""); setDestDirection("") }}
                    className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-encre-controle disabled:opacity-50"
                  >
                    Déplacer
                  </button>
                </div>
              </div>
            )
          })()}

          <div className="mt-auto flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={() => { setChoisie(null); onOuvrirLaBande(bande.identifiant) }}
              className="h-[34px] rounded-7 bg-signal text-[13px] font-medium text-encre-sur-signal transition-colors duration-120 hover:opacity-90"
            >
              L'ouvrir dans l'atelier
            </button>
            <button
              type="button"
              onClick={() => {
                const pose = bande.pose ? poseDe(bande.pose) : null
                if (pose)
                  onAnimer(
                    personnage,
                    pose,
                    bande.direction ? { identifiant: bande.direction, nom: bande.direction } : null,
                  )
              }}
              className="h-[34px] rounded-7 border border-contour bg-carte text-[13px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
            >
              En générer une variante
            </button>
            {!bande.supprime && (
              <button
                type="button"
                onClick={() => {
                  if (rangeeChoisie) void ecarter(bande, rangeeChoisie)
                  setChoisie(null)
                }}
                className="h-[30px] rounded-7 text-[12.5px] text-echec transition-colors duration-120 hover:bg-fond-echec"
              >
                L'écarter
              </button>
            )}
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              L'écarter ne l'efface pas : elle passe derrière la flèche, avec les
              autres écartées, et la plus récente des gardées prend sa place.
            </p>
          </div>
        </aside>
      ) : null}
      {lot && (
        <AnimerEnLot
          personnage={personnage}
          plan={plan}
          titre={lot.titre}
          cases={lot.cases}
          onFermer={() => setLot(null)}
          onCommande={(partis) => onClipsCommandes?.(partis)}
        />
      )}
    </div>
  )
}
