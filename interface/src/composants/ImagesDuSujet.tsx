/**
 * Ses images — B10, l'onglet qui remplace la matrice de l'établi.
 *
 * `docs/pistes-2026-09-04/carnet/Images.dc.html`. Une ligne dépliable par pose,
 * une rangée par direction dedans, **la retenue en tête** puis les gardées de la
 * plus ancienne à la plus récente.
 *
 * **Rien de neuf au serveur, et la planche le dit d'elle-même** : les sept
 * champs dont ce rangement a besoin — `favori`, `supprime_le`, `cree_le`,
 * `pose`, `direction`, `rang`, `epingle` — sont sur l'image depuis longtemps
 * (`interface/src/api.ts`, type `Asset`). Ce fichier ne fait que les lire dans
 * l'autre sens.
 *
 * **Ce que la matrice ne pouvait pas montrer, et que la rangée montre seule** :
 * une image faite avant que le jeu ne déclare ses directions ne sait pas d'où
 * elle regarde. Le serveur la range dans la première direction et compte
 * combien (`CaseDirection.a_confirmer`) ; ici, une rangée dont **toutes** les
 * images sont dans ce cas se lit « à confirmer » et jamais « sud ». Un clic la
 * range, depuis le volet, où l'on sait de quelle image on parle.
 *
 * ⚠️ **Retenir démote à la main, parce que le serveur ne démote pas.**
 * `PUT /assets/favorite` (`atelier/services/bibliotheque.py:562`) écrit
 * `asset.favori` et rien d'autre — c'est la seule écriture de ce champ du
 * produit. Le serveur départage ensuite au lieu d'imposer l'unicité
 * (`corps_retenu`, `atelier/services/production.py:3005` : le maximum de
 * `(favori, cree_le, rang)`). Deux retenues dans une case sont donc possibles,
 * et c'est la plus récente qui sortirait dans le jeu. **Retenir ici éteint donc
 * les autres de la même rangée avant d'allumer celle-ci**, sans quoi le liseré
 * vert désignerait une image et l'export en écrirait une autre. Le tri de
 * `rangerLaLigne` suit la même règle, au même départage — pour dire ce qui part
 * et non ce qu'on aimerait qui parte.
 *
 * ⚠️ **Les écartées ne sont pas là, et ce n'est pas un oubli.** La planche
 * range les images à `supprime_le` derrière un chip « N écartées » en fin de
 * rangée ; la charge d'un personnage ne les porte pas —
 * `assets_du_personnage` filtre `supprime_le IS NULL`
 * (`atelier/depot/base.py:799`), et c'est ce qui fait qu'une image écartée vide
 * sa case toute seule. Un chip qui ne peut jamais rien montrer aurait été une
 * pièce qui ment. Écarter reste réversible : le geste passe par `App`, qui rend
 * le bandeau « la rendre » de toute la bibliothèque.
 *
 * **La case « + générer » est la troisième colonne de la grille, pas le dernier
 * élément de la piste** : la piste défile, la colonne ne défile pas. C'est le
 * critère tenu par construction plutôt que par une position calculée.
 */

import { useCallback, useEffect, useMemo } from "react"
import { useEtatDuParcours, useScrollDuParcours } from "./MemoireDuParcours"
import {
  api,
  type Asset,
  type Case,
  type CaseDirection,
  type Personnage,
  type Piece,
  type Pose,
  type Role,
  type Univers,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { Fiche } from "./Fiche"

/** Le côté d'une vignette de rangée, en pixels d'écran. Le double part au
 *  serveur : un écran à deux pixels par point rend l'image floue sinon. */
const COTE = 54

/** Ce qu'une rangée montre — **une direction, ou l'absence de direction**.
 *
 *  `direction` vaut `null` pour la rangée d'un jeu qui n'a jamais déclaré
 *  d'angles : il n'y a alors qu'une rangée, et le mot ne paraît nulle part. */
export type Rangee = {
  cle: string
  pose: string
  direction: string | null
  nom: string
  /** Le nom de l'angle, même quand la rangée ne l'écrit pas. Il sert à ce qui
   *  vise la direction et non la rangée — générer, par exemple, qui remplit
   *  bien un angle. */
  angle: string | null
  /** Toutes ses images sont sans direction — elle se lit « à confirmer », et le
   *  nom de la direction où le serveur les a rangées ne s'écrit pas. */
  aConfirmer: boolean
  retenue: Asset | null
  gardees: Asset[]
  /** Ce que cette rangée porte en tout, retenue comprise. */
  compte: number
}

/** La retenue, puis les gardées de la plus ancienne à la plus récente.
 *
 *  **Le départage est celui du serveur, repris au mot** : `corps_retenu` prend
 *  le maximum de `(favori, cree_le, rang)`, donc parmi plusieurs retenues c'est
 *  la plus récente qui part dans le jeu. Un second barème écrit ici aurait fini
 *  par verdir une image et en exporter une autre.
 *
 *  **Les gardées ne se réordonnent jamais** : retenir une image la sort de la
 *  file, elle ne mélange pas ce qui reste. */
export function rangerLaLigne(images: readonly Asset[]): {
  retenue: Asset | null
  gardees: Asset[]
} {
  const chronologiques = [...images].sort(
    (a, b) => a.cree_le - b.cree_le || a.rang - b.rang,
  )
  const retenue = chronologiques.filter((image) => image.favori).at(-1) ?? null
  return {
    retenue,
    gardees: chronologiques.filter((image) => image !== retenue),
  }
}

/** Les rangées d'une pose.
 *
 *  Trois cas, et le troisième est celui que la matrice cachait :
 *
 *  - **aucune direction déclarée** — une seule rangée, sans nom d'angle ;
 *  - **une direction tenue** — une rangée par direction, dans l'ordre du jeu ;
 *  - **une direction disparue** — les orphelines de `sans_direction` prennent
 *    leur propre rangée plutôt que de retomber en silence dans la première.
 */
export function rangeesDeLaCase(sienne: Case): Rangee[] {
  const composer = (
    direction: string | null,
    nom: string,
    images: readonly Asset[],
    angle: string | null = null,
    aConfirmer = false,
  ): Rangee => ({
    cle: `${sienne.pose}/${direction ?? "—"}`,
    pose: sienne.pose,
    direction,
    nom,
    angle,
    aConfirmer,
    compte: images.length,
    ...rangerLaLigne(images),
  })

  if (sienne.directions.length === 0)
    return [composer(null, "toutes", sienne.images)]

  const rangees = sienne.directions.map((d: CaseDirection) => {
    // Le serveur range les images sans direction dans la **première**, et dit
    // combien. Quand elles sont toutes dans ce cas, la rangée ne porte pas le
    // nom d'un angle qu'aucune image ne revendique : vide n'est pas le sud.
    const toutesAConfirmer = d.a_confirmer > 0 && d.a_confirmer >= d.images.length
    return composer(
      d.identifiant,
      toutesAConfirmer ? "à confirmer" : d.nom,
      d.images,
      d.nom,
      toutesAConfirmer,
    )
  })
  if (sienne.sans_direction.length > 0)
    rangees.push(composer(null, "à replacer", sienne.sans_direction, null, true))
  return rangees
}

/** Ce qu'une pose a d'inachevé, dit en un mot — ou rien.
 *
 *  **Une seule puce par pose, la plus urgente.** Trois puces côte à côte
 *  auraient demandé de lire pour savoir laquelle regarder, ce qui est
 *  exactement le travail que la ligne repliée doit épargner. */
function ceQuiCloche(rangees: readonly Rangee[]): string | null {
  if (rangees.every((r) => r.compte === 0)) return "rien"
  // **« À confirmer » passe avant « sans retenue », et l'ordre a été trouvé au
  // navigateur** : une pose dont toutes les images attendent leur angle
  // annonçait « 1 sans retenue », ce qui est vrai et inutile — on ne départage
  // pas des images dont on ne sait pas encore d'où elles regardent. Le geste à
  // faire d'abord est celui que la puce doit nommer.
  const aConfirmer = rangees.filter((r) => r.aConfirmer).length
  if (aConfirmer > 0) return "à confirmer"
  const sansRetenue = rangees.filter((r) => r.compte > 1 && !r.retenue).length
  if (sansRetenue > 0)
    return sansRetenue === 1 ? "1 sans retenue" : `${sansRetenue} sans retenue`
  // Une pose sans direction déclarée n'a qu'une rangée, et « vide » n'y veut
  // rien dire : il n'y a pas d'angle à remplir.
  const vides = rangees.filter((r) => r.compte === 0 && r.direction !== null).length
  if (vides > 0) return vides === 1 ? "1 direction vide" : `${vides} directions vides`
  return null
}

// ── Les pièces ──────────────────────────────────────────────────────────────

/** L'image d'une vignette, sur le gris neutre — **et jamais le fichier
 *  entier** : on en regarde quarante à cinquante-quatre pixels. Espace ouvre
 *  l'aperçu, qui, lui, charge l'image entière. */
function Vignette({
  image,
  etat,
  choisie,
  onChoisir,
}: {
  image: Asset
  etat: "retenue" | "gardee"
  /** Celle que le volet décrit. **Un liseré sourd, jamais le vert** : le vert
   *  dit *ce qui part dans le jeu*, et regarder une image ne la retient pas. */
  choisie: boolean
  onChoisir: () => void
}) {
  const visee = useVisee(sujetAsset(image))
  return (
    <button
      type="button"
      onClick={onChoisir}
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      aria-current={choisie}
      aria-label={`${image.label}${etat === "retenue" ? ", la retenue" : ""}`}
      data-vignette-de-rangee={image.identifiant}
      className={[
        "relative block h-[54px] w-[54px] shrink-0 overflow-hidden rounded-7 bg-pourtour",
        etat === "retenue" ? "border border-ok ring-2 ring-ok" : "border border-trait",
        choisie && etat !== "retenue" ? "ring-1 ring-encre-4" : "",
      ].join(" ")}
    >
      <img
        src={vignetteAsset(image, COTE * 2)}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain"
      />
      {/* La quatrième marque — celle que la main pose en touchant une recette.
          Elle se pose **en plus** des trois autres, jamais à leur place. */}
      {image.epingle && (
        <span
          aria-hidden
          title="réglée à la main"
          className="absolute right-[4px] top-[4px] h-[8px] w-[8px] rounded-full border border-contour bg-carte"
        />
      )}
    </button>
  )
}

/** Les trois marques qui s'excluent — retenue, gardée, écartée.
 *
 *  **Trois boutons et non une bascule** : l'état courant se voit sans avoir à
 *  se rappeler ce que le clic ferait, et passer de l'un à l'autre est toujours
 *  un seul geste. */
function Marques({
  retenue,
  onRetenir,
  onGarder,
  onEcarter,
}: {
  retenue: boolean
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
        aria-label="La retenir"
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
        aria-label="La garder seulement"
        className={`${commun} border-r border-trait-faible ${
          retenue ? "text-eteint hover:text-encre" : "bg-ligne-ouverte text-encre-controle"
        }`}
      >
        ○
      </button>
      <button
        type="button"
        onClick={onEcarter}
        aria-label="L'écarter"
        className={`${commun} text-eteint hover:text-echec`}
      >
        ⊘
      </button>
    </span>
  )
}

/** L'heure d'une image, la seule chose qui distingue deux vignettes voisines.
 *  Le jour ne s'écrit pas : une rangée est faite d'images de la même séance. */
const heure = (quand: number) =>
  new Date(quand * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
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

function LigneDeRangee({
  rangee,
  choisie,
  onChoisir,
  onRetenir,
  onGarder,
  onEcarter,
  onGenerer,
}: {
  rangee: Rangee
  choisie: string | null
  onChoisir: (image: Asset) => void
  onRetenir: (image: Asset, rangee: Rangee) => void
  onGarder: (image: Asset) => void
  onEcarter: (image: Asset) => void
  onGenerer: (rangee: Rangee) => void
}) {
  const vignette = (image: Asset, etat: "retenue" | "gardee") => (
    <span key={image.identifiant} className="flex w-[54px] shrink-0 flex-col gap-[4px]">
      <Vignette
        image={image}
        etat={etat}
        choisie={choisie === image.identifiant}
        onChoisir={() => onChoisir(image)}
      />
      <span className="flex justify-center text-[10.5px] leading-none">
        {etat === "retenue" ? (
          <span className="text-ok">la retenue</span>
        ) : (
          <span className="mesure text-encre-4">{heure(image.cree_le)}</span>
        )}
      </span>
      <Marques
        retenue={etat === "retenue"}
        onRetenir={() => onRetenir(image, rangee)}
        onGarder={() => onGarder(image)}
        onEcarter={() => onEcarter(image)}
      />
    </span>
  )

  return (
    <div
      data-rangee={rangee.cle}
      className="grid grid-cols-[54px_minmax(0,1fr)_54px] items-start gap-[8px] border-t border-trait-faible py-[8px]"
    >
      <span className="flex flex-col gap-[4px] pt-[14px]">
        <span
          className={`text-[12.5px] leading-[1.2] ${
            rangee.aConfirmer ? "text-encre-attention" : "text-encre"
          }`}
        >
          {rangee.nom}
        </span>
        <span className="mesure text-[10.5px] text-encre-4">
          {rangee.compte === 0 ? "—" : rangee.compte}
        </span>
      </span>

      <span className="min-w-0">
        {rangee.compte === 0 ? (
          <span className="flex h-[54px] items-center text-[12px] text-eteint">
            rien encore
          </span>
        ) : (
          <span className="defile flex items-start gap-[8px] overflow-x-auto">
            {rangee.retenue ? (
              vignette(rangee.retenue, "retenue")
            ) : (
              // **Le seul rouge de la rangée** : plusieurs images, et aucune
              // ne sort dans le jeu. Une case à une seule image ne le dit pas
              // — il n'y a rien à départager.
              rangee.compte > 1 && (
                <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-7 border border-dashed border-trait-echec bg-fond-echec px-[4px] text-center text-[10.5px] leading-[1.2] text-echec">
                  aucune retenue
                </span>
              )
            )}
            {(rangee.retenue || rangee.compte > 1) && rangee.gardees.length > 0 && (
              <span aria-hidden className="w-px self-stretch bg-pointille" />
            )}
            {rangee.gardees.map((image) => vignette(image, "gardee"))}
          </span>
        )}
      </span>

      {/* Hors de la piste qui défile : c'est ce qui la fait tenir en place
          quand la rangée déborde. Elle vise l'**angle**, même quand la rangée
          s'intitule « à confirmer » : c'est bien cette direction-là qu'on
          remplit. */}
      <CaseDeGeneration
        onArmer={() => onGenerer(rangee)}
        quoi={rangee.angle ?? "cette pose"}
      />
    </div>
  )
}

// ── L'onglet ────────────────────────────────────────────────────────────────

/** Ce que le segment du haut restreint. **Local, jamais servi** : tout ce que
 *  ces trois-là regardent est déjà dans la charge du personnage. */
type Filtre = "toutes" | "a-departager" | "a-confirmer"

export function ImagesDuSujet({
  personnage,
  plan,
  pieces,
  personnages,
  univers,
  onArmer,
  onOuvrirCase,
  onRegardee,
  onEcarter,
  onReinjecter,
  onReglages,
  onErreur,
}: {
  personnage: Personnage
  /** Ce que cette chose-là réclame — sa liste, pas celle du jeu (E9). */
  plan: Pose[]
  /** Le vestiaire du jeu, pour nommer les calques de l'image retenue. */
  pieces: Piece[]
  /** Les deux que la fiche d'une image lit (`C4`) : la liste vivante des sujets,
   *  pour dire de qui cette image est le corps, et l'univers du jeu, pour savoir
   *  sur quelle palette elle a été quantifiée. */
  personnages: Personnage[]
  univers: Univers
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    directions?: string[] | null,
  ) => void
  onOuvrirCase: (identifiant: string) => void
  /** **L'image du volet, dite à la page qui porte cet onglet** (`B25`) — celle
   *  qu'on regarde. Le bouton *La retouche ›* vit dans le bandeau, au-dessus
   *  des onglets, et il n'a aucun autre moyen de savoir laquelle des douze est
   *  sous les yeux. Optionnelle : cet onglet se rend seul dans ses essais. */
  onRegardee?: (identifiant: string | null) => void
  /** **Écarter passe par `App`**, comme dans la matrice d'avant : c'est lui qui
   *  rend le bandeau « la rendre », et un second chemin de mise à l'écart aurait
   *  été un second endroit d'où l'on jette sans pouvoir défaire. */
  onEcarter: (identifiants: string[]) => void
  /** Les deux rôles de la fiche qui arment l'appel suivant (`C4`) : renvoyer
   *  cette image au générateur, et reprendre les réglages de sa génération. Ni
   *  l'un ni l'autre ne dépense — la barre qui paie est au pied de la page. */
  onReinjecter: (asset: string, role: Role) => void
  onReglages: (asset: Asset) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const nomDePose = useMemo(
    () => new Map(plan.map((p) => [p.identifiant, p.nom])),
    [plan],
  )

  // **Une pose ouverte à la fois** — c'est ce qui permet d'en avoir douze sans
  // que l'écran devienne illisible, et c'est la même règle que la ligne du
  // carnet. La première ouverte, parce qu'un écran replié en entier n'a rien à
  // montrer de ce qu'on vient chercher.
  const cle = `images:${personnage.projet}:${personnage.identifiant}`
  const [poseOuverte, setPoseOuverte] = useEtatDuParcours<string | null>(`${cle}:pose`, personnage.cases[0]?.pose ?? null)
  const [filtre, setFiltre] = useEtatDuParcours<Filtre>(`${cle}:filtre`, "toutes")
  const [choisie, setChoisie] = useEtatDuParcours<string | null>(`${cle}:choisie`, null)
  const defilement = useScrollDuParcours(`${cle}:scroll`)

  const parPose = useMemo(
    () =>
      personnage.cases.map((sienne) => ({
        sienne,
        nom: nomDePose.get(sienne.pose) ?? sienne.pose,
        rangees: rangeesDeLaCase(sienne),
      })),
    [personnage.cases, nomDePose],
  )

  const poses = parPose.filter(({ rangees }) => {
    if (filtre === "toutes") return true
    if (filtre === "a-departager")
      return rangees.some((r) => r.compte > 1 && !r.retenue)
    return rangees.some((r) => r.aConfirmer)
  })

  /** Le volet ne s'ouvre qu'à la demande. L'image est relue dans les cases : gardée en objet,
   *  elle serait celle d'avant le dernier changement de favori. */
  const image = useMemo(() => {
    const toutes = personnage.cases.flatMap((c) => [
      ...c.images,
      ...Object.values(c.calques).flat(),
    ])
    return (
      toutes.find((a) => a.identifiant === choisie) ??
      null
    )
  }, [personnage.cases, choisie, parPose, poseOuverte])

  // **Ce que le volet montre monte d'un cran** (`B25`) — voir `onRegardee`.
  // Sur l'identifiant seul : l'objet change d'identité à chaque relecture de la
  // charge, et le dire à chaque rendu ferait courir la page pour rien.
  const vue = image?.identifiant ?? null
  useEffect(() => {
    onRegardee?.(vue)
  }, [vue, onRegardee])

  /** Les calques de **cette image-là**, jamais ceux de sa pose.
   *
   *  Un calque n'est pas une image à lui : c'est une différence posée sur
   *  celle-ci, et `recette.difference.base` dit sur laquelle. Retenir une autre
   *  image de la même case ne les lui donne donc pas — ils appartiennent à
   *  celle sur laquelle ils ont été calculés. */
  const calques = useMemo(() => {
    if (!image) return []
    const sienne = personnage.cases.find((c) => c.pose === image.pose)
    if (!sienne) return []
    return Object.entries(sienne.calques).flatMap(([piece, assets]) =>
      assets
        .filter((a) => a.recette.difference?.base === image.identifiant)
        .map((a) => ({
          asset: a,
          piece: pieces.find((p) => p.identifiant === piece)?.nom ?? piece,
        })),
    )
  }, [image, personnage.cases, pieces])

  const poseDe = useCallback(
    (identifiant: string): Pose | null =>
      plan.find((p) => p.identifiant === identifiant) ?? null,
    [plan],
  )

  /** Retenir celle-ci, **et éteindre les autres de sa rangée**.
   *
   *  ⚠️ `PUT /assets/favorite` écrit un champ et ne démote personne : le serveur
   *  ne tient pas l'unicité, il *départage* au rendu (`corps_retenu`, le maximum
   *  de `favori, cree_le, rang`). La démotion est donc à la charge de l'écran —
   *  `docs/PIEGES.md`, payé en relevé de `B10`.
   *
   *  Les deux appels partent dans cet ordre : la démotion d'abord, la promotion
   *  ensuite. Un échec au premier laisse donc l'état d'avant intact, au lieu de
   *  deux retenues dans la même case. */
  const retenir = useCallback(
    async (cible: Asset, rangee: Rangee) => {
      const autres = [rangee.retenue, ...rangee.gardees]
        .filter((a): a is Asset => a != null && a.favori && a !== cible)
        .map((a) => a.identifiant)
      try {
        if (autres.length > 0) await api.favori(autres, false)
        await api.favori([cible.identifiant], true)
      } catch (erreur) {
        onErreur(erreur, "la retenue a été refusée")
      }
    },
    [onErreur],
  )

  const garder = useCallback(
    async (cible: Asset) => {
      if (!cible.favori) return
      try {
        await api.favori([cible.identifiant], false)
      } catch (erreur) {
        onErreur(erreur, "la retenue a été refusée")
      }
    },
    [onErreur],
  )

  /** Dire sous quel angle cette image montre sa pose.
   *
   *  **Confirmer et déplacer sont le même geste** — celui qui écrit la
   *  direction —, donc il n'y en a qu'un. Le personnage et la pose repartent
   *  tels quels : une désignation partielle effacerait la case. */
  const confirmer = useCallback(
    async (cible: Asset, direction: string) => {
      try {
        await api.designer(cible.identifiant, personnage.identifiant, cible.pose, direction)
      } catch (erreur) {
        onErreur(erreur, "la direction a été refusée")
      }
    },
    [personnage.identifiant, onErreur],
  )

  const directionsDe = (pose: string) =>
    personnage.cases.find((c) => c.pose === pose)?.directions ?? []

  return (
    <div data-onglet-images className="flex min-h-0 flex-1 overflow-hidden" onDoubleClick={(e) => {
      const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-vignette-de-rangee]")?.dataset.vignetteDeRangee
      if (cible) { setChoisie(null); onOuvrirCase(cible) }
    }}>
      {/* ⚠️ `min-w-0` sur la surface, et c'est le volet qui en dépend. Une
          colonne de flex refuse par défaut de descendre sous la largeur de son
          contenu : sans lui, la surface poussait le volet de 380 px **hors de
          la fenêtre** dès qu'elle se resserrait, et le détail de l'image se
          coupait à droite. Vu au navigateur, à 1000 px de large — jamais par un
          essai d'écran, qui n'a pas de largeur. `docs/PIEGES.md`. */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-[14px] overflow-hidden">
        <div className="flex items-center justify-between gap-[14px]">
          <p className="text-[13px] text-encre-2">
            Une rangée par direction — la retenue à gauche, les autres dans l'ordre où
            elles sont arrivées.
          </p>
          <div
            role="tablist"
            aria-label="Ce qu'on regarde"
            className="flex shrink-0 gap-[4px] rounded-8 bg-papier-cote p-[4px]"
          >
            {(
              [
                ["toutes", "toutes"],
                ["a-departager", "à départager"],
                ["a-confirmer", "à confirmer"],
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

        <div {...defilement} className="defile flex min-h-0 flex-1 flex-col gap-[8px] overflow-y-auto">
          {poses.length === 0 && (
            <p className="text-[13px] text-encre-3">
              {personnage.cases.length === 0
                ? "Ce type d'objet ne réclame aucune pose."
                : "Rien de ce genre-là dans ses poses."}
            </p>
          )}
          {poses.map(({ sienne, nom, rangees }) => {
            const ouverte = poseOuverte === sienne.pose
            const images = rangees.reduce((somme, r) => somme + r.compte, 0)
            const cloche = ceQuiCloche(rangees)
            return (
              <div
                key={sienne.pose}
                data-pose-de-rangement={sienne.pose}
                className="flex flex-col rounded-10 border border-trait bg-carte px-[14px]"
              >
                <button
                  type="button"
                  aria-expanded={ouverte}
                  onClick={() => setPoseOuverte(ouverte ? null : sienne.pose)}
                  className="flex items-baseline gap-[8px] py-[8px] text-left"
                >
                  <span aria-hidden className="text-[12px] text-encre-4">
                    {ouverte ? "▾" : "▸"}
                  </span>
                  <span className="font-serif text-[25px] leading-[1.15] text-encre">{nom}</span>
                  <span className="text-[12px] text-encre-3">
                    {images === 0 ? (
                      "aucune image"
                    ) : (
                      <>
                        <span className="mesure">{rangees.length}</span>{" "}
                        {rangees.length > 1 ? "directions" : "direction"} ·{" "}
                        <span className="mesure">{images}</span>{" "}
                        {images > 1 ? "images" : "image"}
                      </>
                    )}
                  </span>
                  {cloche && (
                    <span className="ml-auto rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-attention">
                      {cloche}
                    </span>
                  )}
                </button>
                {ouverte && (
                  <div className="flex flex-col pb-[8px]">
                    {rangees.map((rangee) => (
                      <LigneDeRangee
                        key={rangee.cle}
                        rangee={rangee}
                        choisie={image?.identifiant ?? null}
                        onChoisir={(cible) => setChoisie(cible.identifiant)}
                        onRetenir={(cible, sa) => void retenir(cible, sa)}
                        onGarder={(cible) => void garder(cible)}
                        onEcarter={(cible) => onEcarter([cible.identifiant])}
                        onGenerer={(sa) => {
                          const pose = poseDe(sa.pose)
                          if (pose) onArmer(personnage, [pose], null, sa.direction)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Ses calques ────────────────────────────────────────────────── */}
        {image && calques.length > 0 && (
          <section
            data-calques-de-l-image
            className="flex shrink-0 flex-col gap-[8px] border-t border-trait pt-[8px]"
          >
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Ses <span className="mesure">{calques.length}</span> calques
            </p>
            <div className="flex flex-wrap gap-[14px]">
              {calques.map(({ asset, piece }) => (
                <span key={asset.identifiant} className="flex items-center gap-[8px]">
                  <span className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded-5 bg-pourtour">
                    <img
                      src={vignetteAsset(asset, 68)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="text-[12.5px] text-encre">{piece}</span>
                </span>
              ))}
            </div>
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              Un calque n'est pas une image à lui : c'est une différence posée sur
              celle-ci. Retenir une autre image de la même case ne les lui donne pas.
            </p>
          </section>
        )}
      </section>

      {/* ── La fiche de l'image choisie (`C4`) ─────────────────────────────
          **Il n'y a plus qu'un volet de fiche d'image dans le produit**, et
          c'est `Fiche.tsx`. Celui qui était écrit ici faisait le même métier sur
          une autre surface : même image en grand, mêmes lignes de provenance,
          même prix — en moins complet. Il ne savait ni la recette, ni la
          filiation, ni ce que le projet impose, ni renvoyer l'image au
          générateur. Ce qu'il savait et que la fiche ignorait est parti dans la
          fiche : de quelle case on parle, l'angle à confirmer, la variante,
          l'écart.

          ⚠️ **Une porte en moins, et c'est voulu** : *Reprendre dans l'établi*
          n'est pas passé, parce que cette page **est** l'établi. */}
      {image && (
        <Fiche
          asset={image}
          univers={univers}
          plan={plan}
          personnages={personnages}
          identite={`${personnage.nom}, ${
            nomDePose.get(image.pose ?? "") ?? "sans pose"
          }, ${image.direction ? `vers ${image.direction}` : "sans direction déclarée"}`}
          directionsAConfirmer={image.pose ? directionsDe(image.pose) : []}
          onDirection={(direction) => void confirmer(image, direction)}
          onVariante={() => {
            const pose = image.pose ? poseDe(image.pose) : null
            if (pose) onArmer(personnage, [pose], null, image.direction)
          }}
          onEcarter={() => {
            onEcarter([image.identifiant])
            setChoisie(null)
          }}
          onFermer={() => setChoisie(null)}
          onErreur={(raison) => onErreur(raison, raison)}
          onReinjecter={(role) => onReinjecter(image.identifiant, role)}
          onReglages={() => onReglages(image)}
          onSupprimer={() => {
            onEcarter([image.identifiant])
            setChoisie(null)
          }}
          onRetoucher={() => { setChoisie(null); onOuvrirCase(image.identifiant) }}
          onOuvrir={(identifiant) => setChoisie(identifiant)}
        />
      )}

    </div>
  )
}
