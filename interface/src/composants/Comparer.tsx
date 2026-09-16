/**
 * Comparer — B13. **Deux sujets côte à côte, même pose, même fond, même
 * zoom, avec l'écart chiffré et l'action qui le corrige.**
 *
 * `docs/archive/pistes-2026-09-04/carnet/Comparer.dc.html`. Une profondeur de plus de
 * la page d'un sujet (`interface/src/lieux.ts`, genre `"comparer"`), ouverte
 * depuis son bandeau d'onglets, à côté de *Voir la grille du jeu*.
 *
 * **Quatre écarts chiffrés, jamais cinq.** La hauteur et la largeur rendues
 * (`Asset.rendu_hauteur`/`rendu_largeur`), le contour tracé
 * (`recette.contours`), le palier de couleurs demandé
 * (`recette.quantification.couleurs`) sont des nombres que le produit calcule
 * déjà. **Aucune mesure de l'ombre n'existe** — la ligne que la planche
 * dessine n'a rien derrière, et elle n'est donc pas construite ici.
 *
 * **Choisir deux fois le même sujet compare deux de ses images**, la pose
 * restant la même : c'est le second sujet du sélecteur qui décide du mode, pas
 * un bouton à part.
 *
 * Elle ne fabrique rien, ne modifie rien, ne coûte rien. Les actions
 * correctives sont des portes vers ce qui existe déjà — retoucher une image
 * (`case`), ou revoir la page d'un sujet pour en régénérer une — jamais un
 * geste qui écrit depuis cet écran-ci.
 *
 * ── Un troisième mode : deux animations, même temps (RP12) ──────────────────
 *
 * Choisir « ses animations » dans la même liste compare **deux animations du
 * même mouvement et de la même direction**. La règle du temps commun est écrite
 * dans `docs/PLAN-remise-a-plat.md` § RP12 ; en trois phrases :
 *
 * - l'écran ne tient qu'un nombre, les millisecondes écoulées, et chaque côté en
 *   tire son image tout seul — aucune des deux ne donne le tempo à l'autre ;
 * - un cran « image par image » avance du **plus court** des deux temps d'image,
 *   donc la plus rapide change pendant que la plus lente tient la sienne ;
 * - boucle contre aller-retour, rien ne se convertit : chacune parcourt son
 *   cycle depuis la même origine, et *Remettre au début* est le seul geste qui
 *   les remet en phase.
 *
 * ⚠️ **Ce mode-ci écrit, et c'est la seule exception à l'alinéa ci-dessus.**
 * *Choisir pour le jeu* retient une animation et éteint ses sœurs — il change
 * **laquelle** sort, jamais comment elle joue. Comparer deux images, lui,
 * continue de n'écrire rien du tout.
 *
 * ⚠️ **Le métronome n'est pas celui de `BandeQuiTourne`** (`Apercu.tsx`), et
 * c'est voulu : celui-là est à chaque vignette, parce que des vignettes qui
 * montrent *ce qui est fait et ce qui manque* n'ont aucune raison d'être en
 * phase. Ici on compare deux versions d'un même mouvement, donc l'horloge est
 * unique — et elle compte en `dureeImageMs` (`B12`), pas en `1000 / cadence`.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import {
  api,
  dureeImageMs,
  prix,
  type Asset,
  type Bande,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"
import { imageAsset, rangDeLaBande } from "./Apercu"

const ZOOMS = [1, 2, 4, 8] as const
type Zoom = (typeof ZOOMS)[number]

/** Les trois ralentis. **Ils multiplient l'horloge commune, pas la cadence** :
 *  ce qui sort à l'export ne les connaît pas, et le nombre d'images par seconde
 *  écrit sous chaque côté reste celui de l'animation. */
const VITESSES = [0.5, 1, 2] as const
type Vitesse = (typeof VITESSES)[number]

/** Le battement du métronome commun, en millisecondes. **Il ne fixe aucun
 *  rythme** : à chaque battement le temps se relit sur l'horloge de la machine,
 *  donc un battement en retard ne décale rien — sans quoi une animation à 62 ms
 *  jouerait au pas du métronome et plus au sien. */
const BATTEMENT = 16

/** Ce que porte le second choix quand ce sont deux animations qu'on compare.
 *  Ni un identifiant de sujet ni une chaîne vide : les deux sont déjà pris. */
export const SES_ANIMATIONS = "·ses-animations"

const jour = (quand: number) =>
  new Date(quand * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/** Les poses d'un sujet qui portent au moins une image. */
function posesAvecImages(personnage: Personnage, plan: Pose[]): Pose[] {
  const parPose = new Map(personnage.cases.map((c) => [c.pose, c]))
  return (personnage.plan ?? plan).filter(
    (p) => (parPose.get(p.identifiant)?.images.length ?? 0) > 0,
  )
}

/** Les poses d'un sujet qui portent au moins deux images — celles qu'on peut
 *  comparer à elle-même (« choisir deux fois le même sujet »). */
function posesAvecDeuxImages(personnage: Personnage, plan: Pose[]): Pose[] {
  const parPose = new Map(personnage.cases.map((c) => [c.pose, c]))
  return (personnage.plan ?? plan).filter(
    (p) => (parPose.get(p.identifiant)?.images.length ?? 0) >= 2,
  )
}

function imagesDeLaPose(personnage: Personnage, poseId: string): Asset[] {
  return personnage.cases.find((c) => c.pose === poseId)?.images ?? []
}

/** La retenue, sinon la plus récente — la même règle que `portraitDe`
 *  (`FicheDuSujet.tsx`), reprise pour une pose choisie plutôt que déduite. */
function imageDeReference(images: Asset[]): Asset | null {
  if (!images.length) return null
  const favori = images.find((i) => i.favori)
  if (favori) return favori
  return images.reduce((a, b) => (b.cree_le > a.cree_le ? b : a))
}

// ── La règle du temps commun (RP12) ─────────────────────────────────────────

/** À quelle image **cette** animation-ci en est, au temps commun.
 *
 *  Le temps est commun, les cadences ne le sont pas : chaque côté divise le même
 *  nombre de millisecondes par **son** temps d'image, puis lit sa place dans son
 *  cycle — `rangDeLaBande` (`Apercu.tsx`), la même règle de cycle que partout
 *  ailleurs, boucle et aller-retour compris.
 *
 *  ⚠️ **Le temps d'une image est `dureeImageMs`, pas `1000 / cadence`** (`B12`,
 *  `tests/test_b12.py`) : c'est le nombre entier que le descriptif d'export
 *  écrit. Le regarder jouer autrement ferait juger un rythme que rien ne livre —
 *  83,33 ms au lieu des 83 du fichier, à 12 images par seconde. */
export function rangSurLeTempsCommun(bande: Bande, tempsMs: number): number {
  const duree = dureeImageMs(bande.cadence)
  if (duree <= 0 || bande.compte <= 1) return 0
  const pas = Math.floor(Math.max(0, tempsMs) / duree)
  return rangDeLaBande(pas, bande.compte, bande.sens)
}

/** Le pas d'un cran « image par image » : **le plus court des deux temps
 *  d'image**.
 *
 *  La plus rapide change alors d'image pendant que la plus lente tient la
 *  sienne, et c'est la seule valeur qui ne saute **aucune** image, d'aucun des
 *  deux côtés : un pas plus long que le temps d'image d'un côté lui ferait
 *  enjamber des images qu'on est précisément là pour regarder. */
export function pasDuTempsCommun(bandes: readonly (Bande | null)[]): number {
  const durees = bandes
    .filter((b): b is Bande => b != null)
    .map((b) => dureeImageMs(b.cadence))
    .filter((d) => d > 0)
  return durees.length ? Math.min(...durees) : 0
}

/** Une case comparable : un mouvement, une direction, et ce qu'elle porte. */
export type GroupeDAnimations = {
  cle: string
  pose: string
  direction: string | null
  /** *Marche · sud*, ou *Marche* seul quand le jeu ne déclare pas de direction. */
  nom: string
  /** De la plus récente à la plus ancienne, **les écartées comprises** : c'est
   *  souvent contre une écartée qu'on juge celle qu'on garde. Leur état se lit
   *  sous leur panneau. */
  bandes: Bande[]
}

/** Les cases qui portent **au moins deux animations du même mouvement et de la
 *  même direction** — les seules qui se comparent.
 *
 *  Une case sans direction déclarée fait un groupe à elle seule, exactement
 *  comme `rangeesDeLaCase` (`AnimationsDuSujet.tsx`) la range : les deux lisent
 *  `directions` d'abord, et ne retombent sur `bandes` que si la liste est vide.
 *  ⚠️ Lire les deux ferait compter chaque animation deux fois. */
export function groupesDAnimations(
  personnage: Personnage,
  plan: Pose[],
): GroupeDAnimations[] {
  const nomDeLaPose = new Map(
    (personnage.plan ?? plan).map((p) => [p.identifiant, p.nom] as const),
  )
  const groupes: GroupeDAnimations[] = []
  for (const sienne of personnage.cases) {
    const pose = nomDeLaPose.get(sienne.pose) ?? sienne.pose
    const paquets: { direction: string | null; nom: string; bandes: Bande[] }[] =
      sienne.directions.length === 0
        ? [
            {
              direction: null,
              nom: pose,
              bandes: [...sienne.bandes, ...sienne.bandes_ecartees],
            },
          ]
        : sienne.directions.map((d) => ({
            direction: d.identifiant,
            nom: `${pose} · ${d.nom}`,
            bandes: [...d.bandes, ...d.bandes_ecartees],
          }))
    for (const paquet of paquets) {
      if (paquet.bandes.length < 2) continue
      groupes.push({
        cle: `${sienne.pose}/${paquet.direction ?? "—"}`,
        pose: sienne.pose,
        direction: paquet.direction,
        nom: paquet.nom,
        bandes: paquet.bandes.sort((a, b) => b.cree_le - a.cree_le || b.rang - a.rang),
      })
    }
  }
  return groupes
}

/** Combien de crans fait un tour complet — `compte` en boucle, deux fois moins
 *  deux en aller-retour, puisque les deux bouts ne se rejouent pas
 *  (`ordre_des_images`, `atelier/domaine/aseprite.py`). C'est ce nombre-là qui
 *  explique pourquoi deux animations ne se recroisent qu'au début. */
function cransDuTour(bande: Bande): number {
  if (bande.compte <= 1) return Math.max(bande.compte, 0)
  return bande.sens === "aller-retour" ? (bande.compte - 1) * 2 : bande.compte
}

/** La durée d'un tour, en secondes, **comptée sur le temps d'image de l'export**
 *  et non sur la cadence brute. */
function secondesDuTour(bande: Bande): string {
  return ((cransDuTour(bande) * dureeImageMs(bande.cadence)) / 1000).toFixed(2)
}

/** Ce qu'une animation vaut aujourd'hui, en un mot — la liste fermée de `RP12` :
 *  *Non jugé · Retenu · Écarté*. */
function jugementDe(bande: Bande): "Non jugé" | "Retenu" | "Écarté" {
  if (bande.supprime) return "Écarté"
  return bande.favori ? "Retenu" : "Non jugé"
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

function Prix({ image }: { image: Asset | null }) {
  if (!image || image.cout_usd <= 0)
    return <span className="mesure text-encre-3">gratuite</span>
  // **Le point décimal était le dernier du produit** (RP4) : `$0.0143` ici,
  // `$0,0143` partout ailleurs, pour le même montant. C'est `prix()` qui
  // l'écrit maintenant, comme les six autres endroits qui annoncent un prix.
  return <span className="mesure text-signal">{prix(image.cout_usd, image.unite)}</span>
}

export function Comparer({
  personnage,
  personnages,
  plan,
  univers,
  onFermer,
  onGrille,
  onOuvrirCase,
  onOuvrirLaBande,
}: {
  personnage: Personnage
  /** Tous les sujets du jeu ouvert — déjà chargés par `App.tsx`, comme
   *  `Vitrine.tsx` les reçoit déjà pour la même raison. */
  personnages: Personnage[]
  plan: Pose[]
  univers: Univers
  onFermer: () => void
  onGrille: () => void
  /** Ouvre l'outil de retouche sur cette image précise — la même profondeur
   *  que celle que `ImagesDuSujet.tsx` ouvre par « La retoucher ».
   *
   *  **Porte aussi le sujet propriétaire**, pas seulement l'image : l'image
   *  visée peut être celle du second sujet, jamais celui dont la page est
   *  affichée, et l'appelant en a besoin pour y basculer avant d'ouvrir la
   *  case — sans quoi l'outil chercherait l'image dans le mauvais sujet. */
  onOuvrirCase: (sujet: string, asset: string) => void
  /** Ouvre l'atelier d'une animation — *La retoucher*, du côté des animations
   *  (RP12). Facultatif : sans lui le bouton ne paraît pas, et l'écran reste
   *  montable seul dans un essai. */
  onOuvrirLaBande?: (bande: string) => void
}) {
  const autres = personnages.filter((p) => p.identifiant !== personnage.identifiant)
  const [sujetBId, setSujetBId] = useState(
    autres[0]?.identifiant ?? personnage.identifiant,
  )
  const sujetB =
    personnages.find((p) => p.identifiant === sujetBId) ?? personnage
  const modeImages = sujetBId === personnage.identifiant
  const modeAnimations = sujetBId === SES_ANIMATIONS

  const posesA = modeImages
    ? posesAvecDeuxImages(personnage, plan)
    : posesAvecImages(personnage, plan)
  const [poseId, setPoseId] = useState(posesA[0]?.identifiant ?? "")

  useEffect(() => {
    if (!posesA.some((p) => p.identifiant === poseId)) {
      setPoseId(posesA[0]?.identifiant ?? "")
    }
    // Changer de second sujet, ou de mode, remet la pose à la première
    // disponible : une pose choisie dans l'autre mode peut ne plus exister.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujetBId, modeImages])

  const imagesDeLaPoseA = poseId ? imagesDeLaPose(personnage, poseId) : []
  const [imageAId, setImageAId] = useState<string>("")
  const [imageBId, setImageBId] = useState<string>("")

  useEffect(() => {
    if (!modeImages || !poseId) return
    const triees = [...imagesDeLaPoseA].sort((a, b) => b.cree_le - a.cree_le)
    const premiere = imageDeReference(triees) ?? triees[0] ?? null
    const seconde = triees.find((i) => i.identifiant !== premiere?.identifiant) ?? null
    setImageAId(premiere?.identifiant ?? "")
    setImageBId(seconde?.identifiant ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeImages, poseId, personnage.identifiant])

  // ── Deux animations, un seul temps (RP12) ─────────────────────────────────

  const groupes = useMemo(() => groupesDAnimations(personnage, plan), [personnage, plan])
  const [groupeCle, setGroupeCle] = useState("")
  const groupe = groupes.find((g) => g.cle === groupeCle) ?? groupes[0] ?? null
  const [bandeAId, setBandeAId] = useState("")
  const [bandeBId, setBandeBId] = useState("")

  useEffect(() => {
    if (!modeAnimations || !groupe) return
    // La retenue d'abord, sinon la plus récente — le même départage que
    // `rangerLaLigne` (`AnimationsDuSujet.tsx`), la liste étant déjà triée du
    // plus récent au plus ancien.
    const premiere = groupe.bandes.find((b) => b.favori) ?? groupe.bandes[0] ?? null
    const seconde =
      groupe.bandes.find((b) => b.identifiant !== premiere?.identifiant) ?? null
    setBandeAId(premiere?.identifiant ?? "")
    setBandeBId(seconde?.identifiant ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeAnimations, groupe?.cle])

  const bandeA = groupe?.bandes.find((b) => b.identifiant === bandeAId) ?? null
  const bandeB = groupe?.bandes.find((b) => b.identifiant === bandeBId) ?? null
  const pasCommun = pasDuTempsCommun([bandeA, bandeB])
  const cadencesDifferent = !!bandeA && !!bandeB && bandeA.cadence !== bandeB.cadence
  const sensDifferent = !!bandeA && !!bandeB && bandeA.sens !== bandeB.sens

  /** L'horloge commune, en millisecondes. **C'est le seul état de la lecture** :
   *  ni l'une ni l'autre des deux animations ne porte de compteur à elle. */
  const [tempsMs, setTempsMs] = useState(0)
  const tempsRef = useRef(0)
  const poser = (t: number) => {
    tempsRef.current = Math.max(0, t)
    setTempsMs(tempsRef.current)
  }
  // L'écran s'ouvre en jouant — comme l'atelier d'une animation, et pour la
  // même raison : ce qu'on vient juger, c'est le mouvement.
  const [joue, setJoue] = useState(true)
  const [vitesse, setVitesse] = useState<Vitesse>(1)

  useEffect(() => {
    if (!modeAnimations || !joue) return
    // Le temps se relit sur l'horloge de la machine à chaque battement, jamais
    // « + un battement » : un battement en retard décalerait alors les deux
    // côtés de la même quantité, mais plus au bon instant.
    const base = tempsRef.current
    const depart = Date.now()
    const minuteur = window.setInterval(() => {
      poser(base + (Date.now() - depart) * vitesse)
    }, BATTEMENT)
    return () => window.clearInterval(minuteur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeAnimations, joue, vitesse])

  /** Un cran, en avant ou en arrière — et la lecture s'arrête, sans quoi le
   *  cran serait repris par le métronome avant d'être vu. */
  const avancerDUnCran = (sens: 1 | -1) => {
    setJoue(false)
    poser(tempsRef.current + sens * pasCommun)
  }

  const [probleme, setProbleme] = useState<string | null>(null)

  /** Retenir celle-ci **et éteindre ses sœurs** — le serveur écrit le champ et
   *  ne démote personne (`docs/PIEGES.md`), donc c'est ici, exactement comme
   *  dans *Ses animations*. Il ne touche qu'à `favori` d'une animation : le
   *  favori d'une image est un autre objet, et cet écran ne l'écrit jamais. */
  const choisirPourLeJeu = async (cible: Bande) => {
    if (!groupe) return
    const soeurs = groupe.bandes
      .filter((b) => b.favori && b.identifiant !== cible.identifiant)
      .map((b) => b.identifiant)
    try {
      setProbleme(null)
      if (soeurs.length > 0) await api.favoriBande(soeurs, false)
      await api.favoriBande([cible.identifiant], true)
    } catch {
      setProbleme("Le choix pour le jeu a été refusé.")
    }
  }

  const [zoom, setZoom] = useState<Zoom>(4)
  const [fond, setFond] = useState<"neutre" | "jeu">("neutre")
  const [superposes, setSuperposes] = useState(false)

  const imageA = modeImages
    ? imagesDeLaPoseA.find((i) => i.identifiant === imageAId) ?? null
    : imageDeReference(poseId ? imagesDeLaPose(personnage, poseId) : [])
  const imageB = modeImages
    ? imagesDeLaPoseA.find((i) => i.identifiant === imageBId) ?? null
    : imageDeReference(poseId ? imagesDeLaPose(sujetB, poseId) : [])

  const cible = univers.cible_px || 64
  const echelleA = univers.bareme.find((e) => e.nom === personnage.type) ?? null
  const echelleB = univers.bareme.find((e) => e.nom === sujetB.type) ?? null

  const hauteurA = imageA ? imageA.rendu_hauteur || imageA.hauteur : null
  const hauteurB = imageB ? imageB.rendu_hauteur || imageB.hauteur : null
  const largeurA = imageA ? imageA.rendu_largeur || imageA.largeur : null
  const largeurB = imageB ? imageB.rendu_largeur || imageB.largeur : null

  const hauteurAHorsCase =
    hauteurA !== null && hauteurA > cible && (echelleA?.occupation ?? 100) <= 100
  const hauteurBHorsCase =
    hauteurB !== null && hauteurB > cible && (echelleB?.occupation ?? 100) <= 100

  const contourA = imageA?.recette.contours ?? null
  const contourB = imageB?.recette.contours ?? null
  // **L'une détourée et l'autre non compte comme un écart** — pas seulement
  // deux traits qui different entre eux. Un `&&` qui exigeait les deux non
  // nuls laissait passer en silence le cas le plus courant : une image
  // retouchée avec un contour contre une qui ne l'a jamais été. Trouvé au
  // navigateur sur l'atelier jetable de `B13`, pas par un essai.
  const contoursDiffere =
    (contourA === null) !== (contourB === null) ||
    (contourA !== null &&
      contourB !== null &&
      (contourA.epaisseur !== contourB.epaisseur || contourA.couleur !== contourB.couleur))

  const couleursA = imageA?.recette.quantification?.couleurs ?? null
  const couleursB = imageB?.recette.quantification?.couleurs ?? null
  const couleursHorsNorme =
    (couleursA !== null && univers.couleurs > 0 && couleursA > univers.couleurs) ||
    (couleursB !== null && univers.couleurs > 0 && couleursB > univers.couleurs)

  const echelleMax = 320 / Math.max(1, cible) // garde la scène lisible même à ×8
  const facteur = Math.min(zoom, Math.max(1, Math.floor(echelleMax)))

  const fondStyle =
    fond === "jeu" && univers.fond ? { background: univers.fond } : undefined

  return (
    <main
      data-comparer
      aria-label={`Comparer ${personnage.nom}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            ‹ {personnage.nom}
          </button>
          <button
            type="button"
            onClick={onGrille}
            className="h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
          >
            Voir la grille du jeu
          </button>
        </div>

        <div className="flex flex-col gap-[4px]">
          <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
            {modeAnimations
              ? "Deux animations, même temps"
              : modeImages
                ? "Le même, deux fois"
                : "Deux côte à côte"}
          </h1>
          <p className="text-[13px] text-encre-2">
            {modeAnimations
              ? "Même mouvement, même direction, une seule horloge. Chacune tourne à sa cadence — celle qui sortira à l'export."
              : modeImages
                ? "Même sujet, même pose, deux images. Ce qui diffère saute aux yeux — et se lit chiffré en dessous."
                : "Même pose, même fond, même zoom. Ce qui diffère saute aux yeux — et se lit chiffré en dessous."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[14px]">
          <span className="text-[13px] text-encre">{personnage.nom}</span>
          <span className="text-[12.5px] text-encre-4">contre</span>
          <select
            aria-label="Comparer avec"
            value={sujetBId}
            onChange={(e) => setSujetBId(e.target.value)}
            className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
          >
            <option value={personnage.identifiant}>{personnage.nom} — ses images</option>
            <option value={SES_ANIMATIONS}>{personnage.nom} — ses animations</option>
            {autres.map((p) => (
              <option key={p.identifiant} value={p.identifiant}>
                {p.nom}
              </option>
            ))}
          </select>

          <span className="mx-[8px] h-[22px] w-px bg-trait" aria-hidden />

          {modeAnimations ? (
            <>
              <select
                aria-label="Le mouvement comparé"
                value={groupe?.cle ?? ""}
                onChange={(e) => setGroupeCle(e.target.value)}
                disabled={groupes.length === 0}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre disabled:text-eteint"
              >
                {groupes.length === 0 ? (
                  <option value="">aucun mouvement comparable</option>
                ) : (
                  groupes.map((g) => (
                    <option key={g.cle} value={g.cle}>
                      {g.nom}
                    </option>
                  ))
                )}
              </select>
              <select
                aria-label="La première animation"
                value={bandeAId}
                onChange={(e) => setBandeAId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {(groupe?.bandes ?? []).map((b) => (
                  <option key={b.identifiant} value={b.identifiant}>
                    {jour(b.cree_le)} · {b.cadence} i/s
                  </option>
                ))}
              </select>
              <span className="text-[12.5px] text-encre-4">contre</span>
              <select
                aria-label="La seconde animation"
                value={bandeBId}
                onChange={(e) => setBandeBId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {(groupe?.bandes ?? []).map((b) => (
                  <option key={b.identifiant} value={b.identifiant}>
                    {jour(b.cree_le)} · {b.cadence} i/s
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              aria-label="La pose comparée"
              value={poseId}
              onChange={(e) => setPoseId(e.target.value)}
              disabled={posesA.length === 0}
              className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre disabled:text-eteint"
            >
              {posesA.length === 0 ? (
                <option value="">aucune pose comparable</option>
              ) : (
                posesA.map((p) => (
                  <option key={p.identifiant} value={p.identifiant}>
                    {p.nom}
                  </option>
                ))
              )}
            </select>
          )}

          {modeImages && (
            <>
              <select
                aria-label="La première image"
                value={imageAId}
                onChange={(e) => setImageAId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {imagesDeLaPoseA.map((i) => (
                  <option key={i.identifiant} value={i.identifiant}>
                    {jour(i.cree_le)}
                  </option>
                ))}
              </select>
              <span className="text-[12.5px] text-encre-4">contre</span>
              <select
                aria-label="La seconde image"
                value={imageBId}
                onChange={(e) => setImageBId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {imagesDeLaPoseA.map((i) => (
                  <option key={i.identifiant} value={i.identifiant}>
                    {jour(i.cree_le)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {(["neutre", "jeu"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={fond === f}
                onClick={() => setFond(f)}
                className={[
                  "flex h-[26px] items-center justify-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                  fond === f
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                {f === "neutre" ? "Fond neutre" : "Fond du jeu"}
              </button>
            ))}
          </div>
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => setZoom(z)}
                className={[
                  "flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                  zoom === z
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                ×{z}
              </button>
            ))}
          </div>
          {modeAnimations ? (
            /* ── Les commandes, communes aux deux (RP12) ─────────────────────
               Il n'y en a qu'un jeu : une commande par côté laisserait les deux
               dériver, et c'est exactement ce que la comparaison ne doit pas
               faire. */
            <>
              <button
                type="button"
                onClick={() => setJoue((v) => !v)}
                disabled={pasCommun === 0}
                className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:text-eteint"
              >
                {joue ? "Pause synchronisée" : "Lire ensemble"}
              </button>
              <button
                type="button"
                onClick={() => poser(0)}
                className="h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
              >
                Remettre au début
              </button>
              <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                <button
                  type="button"
                  aria-label="L'image d'avant"
                  onClick={() => avancerDUnCran(-1)}
                  disabled={pasCommun === 0}
                  className="flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:text-eteint"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="L'image d'après"
                  onClick={() => avancerDUnCran(1)}
                  disabled={pasCommun === 0}
                  className="flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:text-eteint"
                >
                  ›
                </button>
              </div>
              <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                {VITESSES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={vitesse === v}
                    onClick={() => setVitesse(v)}
                    className={[
                      "flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                      vitesse === v
                        ? "bg-carte font-medium text-encre"
                        : "text-encre-3 hover:text-encre",
                    ].join(" ")}
                  >
                    ×{v}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
              {([false, true] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={superposes === v}
                  onClick={() => setSuperposes(v)}
                  className={[
                    "flex h-[26px] items-center justify-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                    superposes === v
                      ? "bg-carte font-medium text-encre"
                      : "text-encre-3 hover:text-encre",
                  ].join(" ")}
                >
                  {v ? "Superposés" : "Alignés au sol"}
                </button>
              ))}
            </div>
          )}
        </div>

        {modeAnimations ? (
          /* ── Deux animations sur le même temps (RP12) ────────────────────── */
          <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col gap-[14px] overflow-y-auto pb-[14px]">
              {groupe === null ? (
                <p className="text-[12.5px] leading-[1.5] text-encre-2">
                  Aucun mouvement de {personnage.nom} ne porte deux animations. Il en faut
                  deux, du même mouvement et de la même direction, pour les départager.
                </p>
              ) : (
                <>
                  <div className="grid min-h-[300px] grid-cols-2 overflow-hidden rounded-8 border border-trait">
                    <PanneauDeBande
                      bande={bandeA}
                      tempsMs={tempsMs}
                      nom={bandeA ? jour(bandeA.cree_le) : "—"}
                      facteur={facteur}
                      style={fondStyle}
                    />
                    <PanneauDeBande
                      bande={bandeB}
                      tempsMs={tempsMs}
                      nom={bandeB ? jour(bandeB.cree_le) : "—"}
                      facteur={facteur}
                      style={fondStyle}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-[14px]">
                    <CoteDeLAnimation
                      bande={bandeA}
                      onChoisir={() => bandeA && void choisirPourLeJeu(bandeA)}
                      onRetoucher={
                        onOuvrirLaBande && bandeA
                          ? () => onOuvrirLaBande(bandeA.identifiant)
                          : undefined
                      }
                    />
                    <CoteDeLAnimation
                      bande={bandeB}
                      onChoisir={() => bandeB && void choisirPourLeJeu(bandeB)}
                      onRetoucher={
                        onOuvrirLaBande && bandeB
                          ? () => onOuvrirLaBande(bandeB.identifiant)
                          : undefined
                      }
                    />
                  </div>

                  {probleme && <p className="text-[12.5px] text-echec">{probleme}</p>}

                  {/* ── Les écarts, chiffrés ─────────────────────────────── */}
                  <div className="flex flex-col gap-[8px]">
                    <Etiquette>Les écarts, chiffrés</Etiquette>
                    <div className="flex flex-col gap-[4px] rounded-8 border border-trait bg-carte p-[8px] text-[12.5px]">
                      <Ecart
                        mot="Ses frames"
                        a={bandeA ? String(bandeA.compte) : "—"}
                        b={bandeB ? String(bandeB.compte) : "—"}
                        ecart={
                          bandeA && bandeB
                            ? bandeA.compte === bandeB.compte
                              ? "le même nombre"
                              : `${bandeB.compte - bandeA.compte >= 0 ? "+" : ""}${bandeB.compte - bandeA.compte}`
                            : "—"
                        }
                        horsNorme={!!bandeA && !!bandeB && bandeA.compte !== bandeB.compte}
                      />
                      <Ecart
                        mot="Sa cadence"
                        a={bandeA ? `${bandeA.cadence} i/s` : "—"}
                        b={bandeB ? `${bandeB.cadence} i/s` : "—"}
                        ecart={cadencesDifferent ? "deux cadences" : "la même"}
                        horsNorme={cadencesDifferent}
                      />
                      <Ecart
                        mot="Son temps d'image"
                        a={bandeA ? `${dureeImageMs(bandeA.cadence)} ms` : "—"}
                        b={bandeB ? `${dureeImageMs(bandeB.cadence)} ms` : "—"}
                        ecart={pasCommun > 0 ? `un cran = ${pasCommun} ms` : "—"}
                      />
                      <Ecart
                        mot="Son sens"
                        a={bandeA ? (bandeA.sens === "boucle" ? "en boucle" : "aller-retour") : "—"}
                        b={bandeB ? (bandeB.sens === "boucle" ? "en boucle" : "aller-retour") : "—"}
                        ecart={sensDifferent ? "deux sens" : "le même"}
                        horsNorme={sensDifferent}
                      />
                      <Ecart
                        mot="Son tour"
                        a={bandeA ? `${secondesDuTour(bandeA)} s` : "—"}
                        b={bandeB ? `${secondesDuTour(bandeB)} s` : "—"}
                        ecart={
                          bandeA && bandeB && secondesDuTour(bandeA) === secondesDuTour(bandeB)
                            ? "elles restent en phase"
                            : "en phase au début seulement"
                        }
                      />
                    </div>
                  </div>

                  <p className="text-[12.5px] text-encre-3">
                    Regarder ne change rien à ce qui sortira : la cadence, le sens et le
                    temps d'une image se lisent ici tels que l'export les écrit. Le ralenti
                    ne vaut que pour l'écran. Seul « Choisir pour le jeu » écrit, et il ne
                    dit que laquelle sort.
                  </p>
                </>
              )}
            </div>

            <aside
              data-ce-qui-les-separe
              aria-label="Ce qui les sépare"
              className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
            >
              <Etiquette>Ce qui les sépare</Etiquette>
              {!bandeA || !bandeB ? (
                <p className="text-[12.5px] leading-[1.5] text-encre-2">
                  Choisissez deux animations du même mouvement.
                </p>
              ) : !cadencesDifferent && !sensDifferent && bandeA.compte === bandeB.compte ? (
                <p className="text-[12.5px] leading-[1.5] text-encre-2">
                  Elles jouent pareil : même nombre de frames, même cadence, même sens. Ce
                  qui les sépare est ce qui est dessiné dedans.
                </p>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  {cadencesDifferent && (
                    <Difference
                      titre="Elles ne tournent pas à la même cadence"
                      quoi={`${bandeA.cadence} contre ${bandeB.cadence} images par seconde. Le temps est commun, les cadences non : chacune avance à la sienne, et c'est cet écart-là que le jeu montrera.`}
                    />
                  )}
                  {sensDifferent && (
                    <Difference
                      titre="L'une boucle, l'autre fait l'aller-retour"
                      quoi={`Leurs tours ne durent pas pareil — ${secondesDuTour(bandeA)} s contre ${secondesDuTour(bandeB)} s —, donc elles ne sont en phase qu'au départ. « Remettre au début » les y ramène.`}
                    />
                  )}
                  {bandeA.compte !== bandeB.compte && (
                    <Difference
                      titre="Elles n'ont pas le même nombre de frames"
                      quoi={`${bandeA.compte} contre ${bandeB.compte}. À cadence égale, la plus fournie dure plus longtemps ; c'est ce que dit la ligne « Son tour ».`}
                    />
                  )}
                </div>
              )}
            </aside>
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-[14px] overflow-y-auto pb-[14px]">
            {/* ── La scène ──────────────────────────────────────────────── */}
            <div
              className={[
                "grid min-h-[300px] overflow-hidden rounded-8 border border-trait",
                superposes ? "grid-cols-1" : "grid-cols-2",
              ].join(" ")}
            >
              <Panneau
                image={imageA}
                nom={modeImages ? jour(imageA?.cree_le ?? 0) : personnage.nom}
                facteur={facteur}
                style={fondStyle}
                calque={superposes ? imageB : null}
                calqueFacteur={facteur}
              />
              {!superposes && (
                <Panneau
                  image={imageB}
                  nom={modeImages ? jour(imageB?.cree_le ?? 0) : sujetB.nom}
                  facteur={facteur}
                  style={fondStyle}
                  calque={null}
                  calqueFacteur={facteur}
                />
              )}
            </div>

            {/* ── Les écarts, chiffrés ──────────────────────────────────── */}
            <div className="flex flex-col gap-[8px]">
              <Etiquette>Les écarts, chiffrés</Etiquette>
              <div className="flex flex-col gap-[4px] rounded-8 border border-trait bg-carte p-[8px] text-[12.5px]">
                <Ecart
                  mot="Sa hauteur"
                  a={hauteurA !== null ? `${hauteurA} px` : "—"}
                  b={hauteurB !== null ? `${hauteurB} px` : "—"}
                  ecart={
                    hauteurA !== null && hauteurB !== null
                      ? `${hauteurB - hauteurA >= 0 ? "+" : ""}${hauteurB - hauteurA} px`
                      : "—"
                  }
                  horsNorme={hauteurAHorsCase || hauteurBHorsCase}
                />
                <Ecart
                  mot="Sa largeur"
                  a={largeurA !== null ? `${largeurA} px` : "—"}
                  b={largeurB !== null ? `${largeurB} px` : "—"}
                  ecart={
                    largeurA !== null && largeurB !== null
                      ? `${largeurB - largeurA >= 0 ? "+" : ""}${largeurB - largeurA} px`
                      : "—"
                  }
                />
                <Ecart
                  mot="Son contour"
                  a={contourA ? `${contourA.epaisseur} px` : "aucun"}
                  b={contourB ? `${contourB.epaisseur} px` : "aucun"}
                  ecart={contoursDiffere ? "deux traits différents" : "le même"}
                  horsNorme={contoursDiffere}
                />
                <Ecart
                  mot="Ses couleurs"
                  a={couleursA !== null ? String(couleursA) : "—"}
                  b={couleursB !== null ? String(couleursB) : "—"}
                  ecart={
                    couleursHorsNorme
                      ? `au-delà des ${univers.couleurs} du jeu`
                      : "sous la limite du jeu"
                  }
                  horsNorme={couleursHorsNorme}
                />
              </div>
            </div>

            <p className="text-[12.5px] text-encre-3">
              Comparer ne modifie rien. Corriger un écart, c'est retoucher une image ou
              en régénérer une.
            </p>
          </div>

          {/* ── Ce qui ne va pas ensemble ───────────────────────────────── */}
          <aside
            data-ce-qui-ne-va-pas-ensemble
            aria-label="Ce qui ne va pas ensemble"
            className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
          >
            <Etiquette>Ce qui ne va pas ensemble</Etiquette>

            {!hauteurAHorsCase && !hauteurBHorsCase && !contoursDiffere && !couleursHorsNorme ? (
              <p className="text-[12.5px] leading-[1.5] text-encre-2">
                Rien ne dépasse ici : les deux tiennent dans leur case, et leur contour
                comme leurs couleurs s'accordent.
              </p>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {hauteurAHorsCase && imageA && (
                  <Correction
                    titre={`${personnage.nom} dépasse sa case`}
                    quoi={`${hauteurA} px pour une case de ${cible} : sa tête mord sur la case du dessus.`}
                    action="La retoucher"
                    onAction={() => onOuvrirCase(personnage.identifiant, imageA.identifiant)}
                  />
                )}
                {hauteurBHorsCase && imageB && (
                  <Correction
                    titre={`${modeImages ? "La seconde image" : sujetB.nom} dépasse sa case`}
                    quoi={`${hauteurB} px pour une case de ${cible} : sa tête mord sur la case du dessus.`}
                    action="La retoucher"
                    onAction={() => onOuvrirCase(sujetB.identifiant, imageB.identifiant)}
                  />
                )}
                {contoursDiffere && (
                  <Correction
                    titre="Son contour n'est pas le même"
                    quoi="Deux traits différents pour la même pose. Une régénération applique le même détourage aux deux."
                    prix={<Prix image={imageB} />}
                  />
                )}
                {couleursHorsNorme && (
                  <Correction
                    titre="Une des deux dépasse la palette du jeu"
                    quoi={`Le jeu déclare ${univers.couleurs} couleurs au plus ; une régénération la ramène dans la limite.`}
                    prix={
                      <Prix
                        image={
                          couleursA !== null && couleursA > univers.couleurs
                            ? imageA
                            : imageB
                        }
                      />
                    }
                  />
                )}
              </div>
            )}
          </aside>
        </div>
        )}
      </div>
    </main>
  )
}

/** Un côté de la comparaison d'animations — **sa planche, décalée à l'image que
 *  le temps commun désigne**.
 *
 *  Le rang est calculé ici et nulle part ailleurs, sur `tempsMs` : un compteur
 *  par panneau ferait deux horloges, et deux horloges dérivent. La planche
 *  entière est chargée une fois et décalée, comme `BandeQuiTourne` le fait —
 *  on regarde exactement les pixels que l'export écrira. */
function PanneauDeBande({
  bande,
  tempsMs,
  nom,
  facteur,
  style,
}: {
  bande: Bande | null
  tempsMs: number
  nom: string
  facteur: number
  style?: CSSProperties
}) {
  const montrable =
    bande !== null && bande.compte > 0 && bande.case_largeur > 0 && bande.case_hauteur > 0
  const rang = montrable ? rangSurLeTempsCommun(bande, tempsMs) : 0
  return (
    <div
      className="relative flex min-h-[300px] items-end justify-center bg-pourtour p-[14px]"
      style={style}
    >
      {montrable ? (
        <span
          data-animation-comparee={bande.identifiant}
          data-frame={rang}
          style={{
            display: "block",
            width: bande.case_largeur * facteur,
            height: bande.case_hauteur * facteur,
            backgroundImage: `url(${api.plancheDeLaBande(bande.identifiant)})`,
            backgroundSize: `${bande.case_largeur * bande.compte * facteur}px ${
              bande.case_hauteur * facteur
            }px`,
            backgroundPosition: `-${rang * bande.case_largeur * facteur}px 0`,
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span className="text-[12.5px] text-carte">aucune animation ici</span>
      )}
      <span className="mesure absolute left-[8px] top-[8px] text-[10.5px] text-carte">
        {nom}
      </span>
    </div>
  )
}

/** Ce qu'un côté dit de lui-même, et les deux gestes qu'on peut lui faire.
 *
 *  **Le jugement et le choix pour le jeu sont le même champ pour une animation**
 *  (`Bande.favori`, `B11`) : une animation n'a pas d'étoile à part. C'est
 *  pourquoi *Retenu* s'écrit ici comme état, et *Choisir pour le jeu* comme
 *  geste — deux faces d'une seule chose, et jamais le favori d'une image. */
function CoteDeLAnimation({
  bande,
  onChoisir,
  onRetoucher,
}: {
  bande: Bande | null
  onChoisir: () => void
  onRetoucher?: () => void
}) {
  if (!bande)
    return (
      <div className="rounded-8 border border-trait bg-carte p-[14px] text-[12.5px] text-encre-3">
        aucune animation choisie
      </div>
    )
  const jugement = jugementDe(bande)
  return (
    <div
      data-cote-de-l-animation={bande.identifiant}
      className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]"
    >
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-[13px] text-encre">{bande.nom || jour(bande.cree_le)}</span>
        <span
          className={[
            "mesure text-[10.5px]",
            jugement === "Retenu"
              ? "text-ok"
              : jugement === "Écarté"
                ? "text-echec"
                : "text-encre-3",
          ].join(" ")}
        >
          {jugement}
        </span>
      </div>
      <p className="mesure text-[12.5px] text-encre-3">
        {bande.compte} frames · {bande.cadence} i/s · {dureeImageMs(bande.cadence)} ms ·{" "}
        {bande.sens === "boucle" ? "en boucle" : "aller-retour"}
      </p>
      <div className="flex flex-wrap gap-[8px]">
        {onRetoucher && (
          <button
            type="button"
            onClick={onRetoucher}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            La retoucher
          </button>
        )}
        <button
          type="button"
          onClick={onChoisir}
          aria-pressed={jugement === "Retenu"}
          disabled={jugement === "Retenu"}
          className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:text-eteint"
        >
          Choisir pour le jeu
        </button>
      </div>
    </div>
  )
}

/** Un écart entre deux animations — **ce n'est pas une faute**, et ça ne se
 *  peint donc pas en rouge comme `Correction`. Deux cadences différentes sont
 *  souvent ce qu'on est venu départager. */
function Difference({ titre, quoi }: { titre: string; quoi: string }) {
  return (
    <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <p className="text-[13px] font-medium text-encre">{titre}</p>
      <p className="text-[12.5px] leading-[1.5] text-encre-2">{quoi}</p>
    </div>
  )
}

function Panneau({
  image,
  nom,
  facteur,
  style,
  calque,
  calqueFacteur,
}: {
  image: Asset | null
  nom: string
  facteur: number
  style?: CSSProperties
  calque: Asset | null
  calqueFacteur: number
}) {
  return (
    <div
      className="relative flex min-h-[300px] items-end justify-center bg-pourtour p-[14px]"
      style={style}
    >
      {image ? (
        <img
          src={imageAsset(image)}
          alt={nom}
          width={Math.round((image.rendu_largeur || image.largeur) * facteur)}
          height={Math.round((image.rendu_hauteur || image.hauteur) * facteur)}
          style={{ imageRendering: "pixelated" }}
          className="block"
        />
      ) : (
        <span className="text-[12.5px] text-carte">aucune image pour cette pose</span>
      )}
      {calque && (
        <img
          src={imageAsset(calque)}
          alt=""
          aria-hidden
          width={Math.round((calque.rendu_largeur || calque.largeur) * calqueFacteur)}
          height={Math.round((calque.rendu_hauteur || calque.hauteur) * calqueFacteur)}
          style={{ imageRendering: "pixelated", opacity: 0.5 }}
          className="absolute bottom-[14px] block"
        />
      )}
      <span className="mesure absolute left-[8px] top-[8px] text-[10.5px] text-carte">
        {nom}
      </span>
    </div>
  )
}

function Ecart({
  mot,
  a,
  b,
  ecart,
  horsNorme,
}: {
  mot: string
  a: string
  b: string
  ecart: string
  horsNorme?: boolean
}) {
  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[8px] rounded-5 px-[8px] py-[4px]",
        horsNorme ? "bg-fond-echec" : "",
      ].join(" ")}
    >
      <span className="text-encre-3">{mot}</span>
      <span className="mesure">{a}</span>
      <span className="mesure">{b}</span>
      <span className={`mesure text-right ${horsNorme ? "text-echec" : "text-encre-3"}`}>
        {ecart}
      </span>
    </div>
  )
}

function Correction({
  titre,
  quoi,
  action,
  onAction,
  prix,
}: {
  titre: string
  quoi: string
  action?: string
  onAction?: () => void
  prix?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-8 border border-trait-echec bg-fond-echec p-[14px]">
      <p className="text-[13px] font-medium text-echec">{titre}</p>
      <p className="text-[12.5px] leading-[1.5] text-encre-2">{quoi}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-[30px] rounded-7 border border-contour bg-carte text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
        >
          {action}
        </button>
      )}
      {prix && (
        <div className="flex items-center justify-between gap-[8px] text-[12.5px]">
          <span className="text-encre-3">sa dernière génération a coûté</span>
          {prix}
        </div>
      )}
    </div>
  )
}
