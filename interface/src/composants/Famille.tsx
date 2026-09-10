/**
 * La grille d'une famille — B9.4 à B9.6 : la surface centrale (et son volet de
 * droite) quand on ouvre « Les personnages », « Les objets », « Les décors » ou
 * « L'interface » depuis le carnet.
 *
 * `docs/pistes-2026-09-04/carnet/Famille.dc.html`. Le carnet (300px, à gauche)
 * et ses cibles de dépôt propres appartiennent à `Carnet.tsx` — branché par
 * ailleurs — et ne sont **pas** dans ce fichier ; le volet (380px, à droite)
 * l'est, lui, parce que c'est ici qu'on sait ce qui est choisi.
 *
 * **Le filtre, la recherche et la collection ouverte partent au serveur, jamais
 * recalculés ici** (`api.familleDeSujets`) : les trois comptes de `filtres`
 * portent sur la famille entière, la page n'en montre qu'une partie. `complet`
 * ne regarde que les images ; les poses et les animations se lisent à côté,
 * telles quelles.
 *
 * **Un chiffre est en chasse fixe par la classe `mesure`**, la seule que
 * `index.css` déclare pour ça. Une classe inventée ne lève aucune erreur —
 * Tailwind ne produit rien pour un utilitaire inconnu, et le nombre s'affiche
 * simplement dans la chasse du texte, ce que personne ne voit.
 *
 * **Le glisser-déposer** suit le patron de `AtelierDeBande.tsx` : attraper une
 * carte qui n'est pas dans la sélection en fait une sélection à elle seule.
 * Les cibles sont les puces du panneau « Les ranger » — rien d'autre dans cet
 * écran n'accepte un dépôt. ⚠️ `getData` est vide pendant `dragover` ; le
 * compte projeté (« déjà + arrivants ») se calcule donc **au `dragstart`** et
 * part au parent avec la sélection — l'autre cible de dépôt vit dans le carnet,
 * qui n'a pas les sujets de la page pour le calculer lui-même. **Une collection
 * additionne, elle ne déplace rien** : ranger un sujet ne le retire d'aucune
 * autre collection.
 *
 * **Aucune couleur d'alerte sur un manque** — ni sur une carte à `0 / N`, ni
 * dans le tableau des poses, ni dans le panneau « Ce qui leur manque » : c'est
 * la règle déjà tenue par `TableauDeBord.tsx` (E2), et le cahier des charges
 * l'impose explicitement pour la vue « Les poses ». La maquette, elle, teinte
 * ces chiffres en rouille — **contradiction assumée** : le rouille du système
 * ne sert qu'au bouton qui lance et au chiffre qui coûte
 * (`interface/src/index.css`), et un manque n'est ni l'un ni l'autre. C'est
 * assumé, pas oublié.
 *
 * ⚠️ Le fantôme du glisser est un unique rectangle penché portant le compte —
 * pas la pile de deux ou trois cartes de la maquette : construire proprement
 * une pile aurait demandé plus de temps que ce panneau n'en valait, et un
 * fantôme simplifié mais fonctionnel vaut mieux qu'un fantôme à moitié fait.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  api,
  Refus,
  type FiltreDeFamille,
  type GrilleDeFamille,
  type GroupeDeRangement,
  type SujetDeLaGrille,
} from "../api"

/** Le type MIME du glisser d'un ou plusieurs sujets — le parent en a besoin
 *  pour ses propres cibles de dépôt (le carnet). */
export const GLISSE_DES_SUJETS = "application/x-sujets-atelier"

// ── Les mots de chaque famille ───────────────────────────────────────────────

const MOTS_DE_FAMILLE: Record<string, { pluriel: string; singulier: string }> = {
  personnages: { pluriel: "personnages", singulier: "personnage" },
  objets: { pluriel: "objets", singulier: "objet" },
  decors: { pluriel: "décors", singulier: "décor" },
  interface: { pluriel: "éléments d'interface", singulier: "élément d'interface" },
}

function motsDe(famille: string): { pluriel: string; singulier: string } {
  return MOTS_DE_FAMILLE[famille] ?? { pluriel: famille, singulier: famille }
}

/** Les trois onglets à zéro — ce qu'on montre pendant le chargement et après un
 *  refus, plutôt qu'un chiffre gardé d'une famille précédente. */
const AUCUN_COMPTE: Record<FiltreDeFamille, number> = {
  tous: 0,
  incomplets: 0,
  "sans-description": 0,
}

// ── Ce qu'une collection contient déjà, et ce qui arriverait ────────────────

function estDansCollection(sujet: SujetDeLaGrille, collection: string): boolean {
  return sujet.collections.some((c) => c.identifiant === collection)
}

/** Parmi `ids`, combien sont déjà dans `collection` — cherché dans les sujets
 *  de la page en mémoire, jamais dans `GroupeDeRangement.sujets` qui compte
 *  tout le jeu. */
function dejaParmi(
  sujets: readonly SujetDeLaGrille[],
  ids: readonly string[],
  collection: string,
): number {
  return ids.filter((id) => {
    const sujet = sujets.find((s) => s.identifiant === id)
    return sujet != null && estDansCollection(sujet, collection)
  }).length
}

/** Parmi `ids`, ceux qui n'y sont **pas** déjà — jamais le nombre choisi tout
 *  court : ranger ce qui est déjà rangé serait sans effet, et l'annoncer
 *  mentirait. */
function arrivantsParmi(
  sujets: readonly SujetDeLaGrille[],
  ids: readonly string[],
  collection: string,
): string[] {
  return ids.filter((id) => {
    const sujet = sujets.find((s) => s.identifiant === id)
    return sujet == null || !estDansCollection(sujet, collection)
  })
}

// ── Les pièces ────────────────────────────────────────────────────────────

function Onglet({
  actif,
  onClic,
  children,
}: {
  actif: boolean
  onClic: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClic}
      className={[
        "flex h-[26px] items-center rounded-7 px-[14px] text-[13px] transition-colors duration-120",
        actif ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

/** La vignette d'un sujet — un cadre `bg-pourtour`, une image en `lazy` par
 *  dessus, ou rien quand `vignette` est `null` : **jamais l'image entière**,
 *  seulement la réduite (`docs/audit-design-post-v21.html` défaut n° 06). */
function Vignette({
  sujet,
  cote,
  className,
}: {
  sujet: SujetDeLaGrille
  cote: number
  className: string
}) {
  return (
    <span className={`overflow-hidden rounded-5 bg-pourtour ${className}`}>
      {sujet.vignette && (
        <img
          src={api.vignette(sujet.vignette.identifiant, sujet.vignette.empreinte, cote)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </span>
  )
}

function CarteDeGrille({
  sujet,
  choisi,
  onChoisir,
  onPrendreEnMain,
  onFinDeGlissement,
}: {
  sujet: SujetDeLaGrille
  choisi: boolean
  onChoisir: () => void
  onPrendreEnMain: (e: React.DragEvent<HTMLButtonElement>) => void
  onFinDeGlissement: () => void
}) {
  const { poses, images } = sujet.compte
  const pct = poses.attendu > 0 ? Math.round((poses.fait / poses.attendu) * 100) : 0
  return (
    <button
      type="button"
      draggable
      onDragStart={onPrendreEnMain}
      onDragEnd={onFinDeGlissement}
      onClick={onChoisir}
      aria-pressed={choisi}
      aria-label={`${sujet.nom}, ${poses.fait} sur ${poses.attendu} poses`}
      data-carte-de-sujet={sujet.identifiant}
      className={[
        "relative flex flex-col gap-[8px] rounded-8 border bg-carte p-[8px] text-left transition-colors duration-120",
        choisi ? "border-signal ring-2 ring-signal/20" : "border-trait hover:border-contour",
      ].join(" ")}
    >
      {choisi && (
        <span
          aria-hidden
          className="absolute right-[8px] top-[8px] flex h-[14px] w-[14px] items-center justify-center rounded-full bg-encre"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--color-carte)" strokeWidth="3.4">
            <path d="M5 12l5 5 9-9" />
          </svg>
        </span>
      )}
      <Vignette sujet={sujet} cote={128} className="aspect-square" />
      <span className="line-clamp-2 min-h-0 text-[12.5px] font-medium leading-[1.25] text-encre">
        {sujet.nom}
      </span>
      <span className="block h-[4px] overflow-hidden rounded-5 bg-papier-cote">
        <span className="block h-full rounded-5 bg-ok" style={{ width: `${pct}%` }} />
      </span>
      <span className="flex items-center justify-between text-[10.5px] text-encre-3">
        <span className="mesure">
          {poses.fait} / {poses.attendu}
        </span>
        <span className="mesure">{images.fait === 0 ? "—" : `${images.fait} im.`}</span>
      </span>
    </button>
  )
}

function LigneDeListe({
  sujet,
  choisi,
  onChoisir,
  onPrendreEnMain,
  onFinDeGlissement,
}: {
  sujet: SujetDeLaGrille
  choisi: boolean
  onChoisir: () => void
  onPrendreEnMain: (e: React.DragEvent<HTMLButtonElement>) => void
  onFinDeGlissement: () => void
}) {
  const { poses, images } = sujet.compte
  return (
    <button
      type="button"
      draggable
      onDragStart={onPrendreEnMain}
      onDragEnd={onFinDeGlissement}
      onClick={onChoisir}
      aria-pressed={choisi}
      data-ligne-de-sujet={sujet.identifiant}
      className={[
        "flex w-full shrink-0 items-center gap-[14px] rounded-8 border bg-carte px-[14px] py-[8px] text-left transition-colors duration-120",
        choisi ? "border-signal" : "border-trait hover:border-contour",
      ].join(" ")}
    >
      <Vignette sujet={sujet} cote={34} className="h-[34px] w-[34px] shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-encre">{sujet.nom}</span>
      <span className="shrink-0 truncate text-[12px] text-encre-3">{sujet.type || "—"}</span>
      <span className="flex shrink-0 flex-wrap gap-[4px]">
        {sujet.collections.map((c) => (
          <span
            key={c.identifiant}
            className="rounded-full border border-trait px-[8px] text-[10.5px] text-encre-2"
          >
            {c.nom}
          </span>
        ))}
      </span>
      <span className="mesure shrink-0 text-[11px] text-encre-3">
        {poses.fait} / {poses.attendu}
      </span>
      <span className="mesure shrink-0 text-[11px] text-encre-3">
        {images.fait === 0 ? "—" : `${images.fait} im.`}
      </span>
    </button>
  )
}

/** L'union des poses de la page, dans l'ordre où elles apparaissent — jamais
 *  triée, jamais recalculée : c'est `compte.detail` qui les nomme. */
function colonnesDesPoses(
  sujets: readonly SujetDeLaGrille[],
): { identifiant: string; nom: string }[] {
  const vues = new Map<string, string>()
  for (const sujet of sujets)
    for (const d of sujet.compte.detail) if (!vues.has(d.identifiant)) vues.set(d.identifiant, d.nom)
  return [...vues.entries()].map(([identifiant, nom]) => ({ identifiant, nom }))
}

function TableauDesPoses({ sujets }: { sujets: readonly SujetDeLaGrille[] }) {
  const colonnes = colonnesDesPoses(sujets)
  return (
    <div
      data-tableau-des-poses
      className="defile min-h-0 flex-1 overflow-auto rounded-8 border border-trait bg-carte"
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] whitespace-nowrap bg-carte px-[14px] py-[8px] text-left text-encre-3">
              Sujet
            </th>
            {colonnes.map((c) => (
              <th
                key={c.identifiant}
                className="whitespace-nowrap px-[14px] py-[8px] text-left text-encre-3"
              >
                {c.nom}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sujets.map((sujet) => {
            const parPose = new Map(sujet.compte.detail.map((d) => [d.identifiant, d]))
            return (
              <tr key={sujet.identifiant} className="border-t border-trait-faible">
                <td className="sticky left-0 whitespace-nowrap bg-carte px-[14px] py-[8px] text-encre">
                  {sujet.nom}
                </td>
                {colonnes.map((c) => {
                  const d = parPose.get(c.identifiant)
                  if (!d)
                    return (
                      <td
                        key={c.identifiant}
                        className="mesure px-[14px] py-[8px] text-center text-encre-4"
                        aria-label={`${sujet.nom}, ${c.nom} : sans objet`}
                      >
                        ·
                      </td>
                    )
                  const teinte =
                    d.attendu > 0 && d.fait >= d.attendu
                      ? "text-encre"
                      : d.fait > 0
                        ? "text-encre-2"
                        : "text-encre-4"
                  return (
                    <td key={c.identifiant} className={`mesure px-[14px] py-[8px] ${teinte}`}>
                      {d.fait} / {d.attendu}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ChipDeRangement({
  groupe,
  deja,
  survolee,
  arrivants,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  groupe: GroupeDeRangement
  deja: number
  survolee: boolean
  arrivants: number
  onDragOver: (e: React.DragEvent<HTMLSpanElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLSpanElement>) => void
  onDrop: (e: React.DragEvent<HTMLSpanElement>) => void
}) {
  return (
    <span
      data-puce-de-rangement={groupe.identifiant}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "inline-flex h-[26px] items-center gap-[4px] rounded-full px-[14px] text-[12.5px]",
        survolee
          ? "border border-dashed border-signal bg-etiquette-fond-echec font-medium text-echec"
          : "bg-trait-faible text-encre-2",
      ].join(" ")}
    >
      <span>{groupe.nom}</span>
      <span className="mesure">{survolee ? `${deja} + ${arrivants}` : deja}</span>
    </span>
  )
}

/** Le champ qui nomme une collection.
 *
 *  **Il n'y en a qu'un à la fois dans l'écran** : dans le volet quand des
 *  sujets sont choisis — la collection naît pleine —, sous la barre d'outils
 *  sinon, puisque le volet n'existe pas alors et que le carnet, lui, sait
 *  demander une collection sans rien avoir choisi. */
function ChampDeCollection({
  nom,
  onNom,
  onCreer,
  onAbandon,
}: {
  nom: string
  onNom: (texte: string) => void
  onCreer: () => void
  onAbandon: () => void
}) {
  return (
    <span className="inline-flex h-[26px] items-center gap-[4px] rounded-full border border-contour px-[8px]">
      <input
        autoFocus
        value={nom}
        onChange={(e) => onNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreer()
          if (e.key === "Escape") onAbandon()
        }}
        placeholder="Nom de la collection"
        aria-label="Nom de la nouvelle collection"
        className="bg-transparent text-[12.5px] text-encre outline-none"
      />
      <button type="button" onClick={onCreer} className="text-[12.5px] font-medium text-encre">
        Créer
      </button>
    </span>
  )
}

// ── L'écran ───────────────────────────────────────────────────────────────

export function EcranFamille({
  famille,
  nom,
  jeu,
  collection,
  glisses,
  surGlisser,
  surGroupes,
  rafraichi,
  creerUnGroupe,
  surRange,
  surReglages,
  surAjouter,
  surErreur,
  onOuvrir,
}: {
  /** La clé de la famille : "personnages", "objets", "decors", "interface". */
  famille: string
  /** Son nom dans le carnet — « Les personnages ». */
  nom: string
  /** L'identifiant du jeu ouvert. Il part avec chaque rangement : un sujet
   *  n'est unique que par jeu. */
  jeu: string
  /** La collection ouverte sous la famille dans le carnet, ou `null` pour toute
   *  la famille. **Elle part au serveur** : restreindre ici, sur la page en
   *  mémoire, ferait mentir les trois comptes de filtre et le « x des y ». */
  collection: string | null
  /** Ce qu'on traîne en ce moment, ou `null`. Tenu par le parent parce que les
   *  cibles de dépôt du carnet, elles, ne sont pas dans cet écran. */
  glisses: readonly string[] | null
  /** Ce qu'on traîne, et **ce que chaque collection gagnerait si on lâchait
   *  là** — le second argument, parce que le carnet en a besoin pour écrire
   *  « 10 + 3 » et qu'il ne connaît pas les sujets de la page. */
  surGlisser: (
    sujets: readonly string[] | null,
    arrivants?: Record<string, number>,
  ) => void
  /** Les collections où l'on peut ranger, remontées au parent pour que le
   *  carnet puisse les montrer. Appelé dans le `.then` du chargement, jamais
   *  pendant le rendu. */
  surGroupes: (groupes: GroupeDeRangement[]) => void
  /** Un compteur que le parent incrémente quand il a rangé quelque chose
   *  ailleurs (une ligne du carnet) : la grille se relit. */
  rafraichi: number
  /** Le « ＋ Nouvelle collection » du carnet. **Un compteur, pas un booléen** :
   *  deux clics de suite doivent rouvrir le champ, et un booléen déjà à vrai ne
   *  redéclencherait rien. Ignoré à zéro, sinon le champ volerait le curseur à
   *  chaque ouverture de famille. */
  creerUnGroupe: number
  /** À appeler après un rangement fait ici, pour que le parent relise l'arbre. */
  surRange: () => void
  surReglages: () => void
  surAjouter: () => void
  surErreur: (raison: string) => void
  /** Ouvrir la fiche du sujet — ce que le clic fait par défaut, hors du mode
   *  sélection. */
  onOuvrir: (identifiant: string) => void
}) {
  const mots = motsDe(famille)

  const [recherche, setRecherche] = useState("")
  const [filtre, setFiltre] = useState<FiltreDeFamille>("tous")
  const [limite, setLimite] = useState(120)
  const [vue, setVue] = useState<"grille" | "liste" | "poses">("grille")
  /** **Le clic ouvre par défaut.** Ranger est un geste choisi, pas la
   *  réponse au premier clic sur une carte : sans ce bouton, un clic pour
   *  regarder un sujet le sélectionnait à la place de l'ouvrir. Couper le
   *  mode vide la sélection — une sélection qu'on ne voit plus n'a plus de
   *  sens. */
  const [modeSelection, setModeSelection] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [donnee, setDonnee] = useState<GrilleDeFamille | null>(null)
  const [version, setVersion] = useState(0)
  const [survolee, setSurvolee] = useState<string | null>(null)
  const [rangerOuvert, setRangerOuvert] = useState(false)
  const [nouvelleOuverte, setNouvelleOuverte] = useState(false)
  const [nomNouvelle, setNomNouvelle] = useState("")
  const fantomeRef = useRef<HTMLDivElement | null>(null)

  // **La limite repart à 120 dès qu'on change de famille ou de collection** —
  // jamais héritée d'une autre grille qu'on aurait laissée déroulée.
  //
  // ⚠️ Remise pendant le rendu, pas dans un `useEffect`. Mesuré au navigateur :
  // en effet, la grille partait chercher la collection neuve **avec l'ancienne
  // limite**, puis repartait la chercher à 120 — deux allers-retours, et le
  // premier était le gros (360 sujets pour rien). Écrire l'état pendant le
  // rendu relance la passe avant que le chargement ne parte, si bien qu'un seul
  // appel sort.
  const cleDeLaGrille = `${famille} / ${collection ?? ""}`
  const [cleVue, setCleVue] = useState(cleDeLaGrille)
  if (cleVue !== cleDeLaGrille) {
    setCleVue(cleDeLaGrille)
    setLimite(120)
  }

  // **Le « ＋ Nouvelle collection » du carnet ouvre le champ d'ici**, pour qu'il
  // n'y ait qu'un seul endroit au monde où l'on nomme une collection.
  useEffect(() => {
    if (creerUnGroupe <= 0) return
    setNouvelleOuverte(true)
  }, [creerUnGroupe])

  useEffect(() => {
    let vivant = true
    setDonnee(null)
    api
      .familleDeSujets(famille, {
        recherche: recherche.trim() || undefined,
        filtre,
        collection,
        limite,
      })
      .then((recu) => {
        if (!vivant) return
        // **Une réponse se lit, elle ne se croit pas.** Le double de `fetch`
        // des essais d'écran rend `{}` pour une route qu'il ne connaît pas, et
        // `groupes` remonterait alors `undefined` au carnet — qui le tranche.
        setDonnee({
          personnages: recu.personnages ?? [],
          groupes: recu.groupes ?? [],
          filtres: recu.filtres ?? AUCUN_COMPTE,
          total: recu.total ?? 0,
        })
        surGroupes(recu.groupes ?? [])
      })
      .catch((erreur: unknown) => {
        if (!vivant) return
        setDonnee({ personnages: [], groupes: [], filtres: AUCUN_COMPTE, total: 0 })
        surGroupes([])
        surErreur(erreur instanceof Refus ? erreur.message : "la famille n'a pas pu être lue")
      })
    return () => {
      vivant = false
    }
    // surGroupes et surErreur sont des rappels du parent, pas des données à
    // relire : les inclure ferait recharger la grille à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famille, collection, recherche, filtre, limite, rafraichi, version])

  const sujets = donnee?.personnages ?? []
  const groupes = donnee?.groupes ?? []
  const total = donnee?.total ?? 0
  const filtres = donnee?.filtres ?? AUCUN_COMPTE
  const groupeOuvert = groupes.find((g) => g.identifiant === collection) ?? null

  const choisirCollection = useCallback((f: FiltreDeFamille) => {
    setFiltre(f)
    setLimite(120)
  }, [])

  const chercher = useCallback((texte: string) => {
    setRecherche(texte)
    setLimite(120)
  }, [])

  const basculerChoix = useCallback((identifiant: string) => {
    setSelection((avant) =>
      avant.includes(identifiant) ? avant.filter((id) => id !== identifiant) : [...avant, identifiant],
    )
  }, [])

  /** Couper le mode sélection referme aussi le panneau « Ranger dans… » et
   *  vide ce qui était choisi — rouvrir le mode repart d'une page blanche. */
  const basculerModeSelection = useCallback(() => {
    setModeSelection((v) => !v)
    setSelection([])
    setRangerOuvert(false)
  }, [])

  /** Le clic sur une carte : ouvrir le sujet hors du mode sélection, le
   *  choisir dedans. Un seul geste, deux sens selon le mode — jamais les
   *  deux à la fois. */
  const surClicDeCarte = useCallback(
    (identifiant: string) => {
      if (modeSelection) basculerChoix(identifiant)
      else onOuvrir(identifiant)
    },
    [modeSelection, basculerChoix, onOuvrir],
  )

  /** Ce que chaque collection du jeu gagnerait si on lâchait `ids` dessus.
   *
   *  **Calculé au `dragstart`, pas au survol** : `getData` est vide pendant un
   *  `dragover`, et le carnet — qui est l'autre cible de dépôt — n'a pas les
   *  sujets de la page pour le savoir lui-même. */
  const arrivantsParGroupe = useCallback(
    (ids: readonly string[]): Record<string, number> =>
      Object.fromEntries(
        groupes.map((g) => [g.identifiant, arrivantsParmi(sujets, ids, g.identifiant).length]),
      ),
    [groupes, sujets],
  )

  const prendreEnMain = useCallback(
    (identifiant: string) => (evenement: React.DragEvent<HTMLButtonElement>) => {
      const cible = selection.includes(identifiant) ? selection : [identifiant]
      if (cible !== selection) setSelection(cible)
      evenement.dataTransfer.setData(GLISSE_DES_SUJETS, cible.join("\n"))
      evenement.dataTransfer.effectAllowed = "move"
      surGlisser(cible, arrivantsParGroupe(cible))
      if (fantomeRef.current && typeof evenement.dataTransfer.setDragImage === "function") {
        fantomeRef.current.textContent =
          cible.length === 1 ? `1 ${mots.singulier}` : `${cible.length} ${mots.pluriel}`
        evenement.dataTransfer.setDragImage(fantomeRef.current, 16, 16)
      }
    },
    [selection, surGlisser, arrivantsParGroupe, mots.singulier, mots.pluriel],
  )

  const finDeGlissement = useCallback(() => {
    surGlisser(null)
  }, [surGlisser])

  const rangerDans = useCallback(
    async (collection: string, ids: readonly string[]) => {
      if (ids.length === 0) return
      try {
        for (const sujet of ids) await api.rangerSujet(collection, jeu, sujet)
        setVersion((n) => n + 1)
        surRange()
      } catch (erreur) {
        surErreur(erreur instanceof Refus ? erreur.message : "le rangement a été refusé")
      }
    },
    [jeu, surRange, surErreur],
  )

  const deposerSur = useCallback(
    (collection: string) => {
      const arrivants = arrivantsParmi(sujets, glisses ?? [], collection)
      void rangerDans(collection, arrivants)
    },
    [sujets, glisses, rangerDans],
  )

  /** Nommer une collection, et y ranger ce qui est choisi — **s'il y a quelque
   *  chose de choisi**. Sans sélection, elle naît vide, et c'est justement le
   *  cas où le carnet doit l'apprendre tout de suite : une collection vide
   *  n'apparaît sur la carte d'aucun sujet. */
  const creerEtRanger = useCallback(async () => {
    const nomSaisi = nomNouvelle.trim()
    if (!nomSaisi) return
    try {
      const { collection: nee } = await api.creerCollection(nomSaisi, jeu)
      setNomNouvelle("")
      setNouvelleOuverte(false)
      for (const sujet of selection) await api.rangerSujet(nee.identifiant, jeu, sujet)
      setVersion((n) => n + 1)
      surRange()
    } catch (erreur) {
      surErreur(erreur instanceof Refus ? erreur.message : "la collection n'a pas pu être créée")
    }
  }, [nomNouvelle, jeu, selection, surRange, surErreur])

  const totalIncomplets = filtres.incomplets
  const montres = sujets.length
  const resteAChanger = montres < total
  const choisis = sujets.filter((s) => selection.includes(s.identifiant))

  // « Les 1 personnages » ne se dit pas, et une collection d'un seul sujet est
  // le cas ordinaire le jour où on la crée.
  const titre =
    total === 0 ? (
      nom
    ) : total === 1 ? (
      <>
        <span className="mesure">1</span> {mots.singulier}
      </>
    ) : (
      <>
        Les <span className="mesure">{total}</span> {mots.pluriel}
      </>
    )

  return (
    // `bg-papier` sur la racine, comme `TableauDeBord.tsx` : le châssis autour
    // est encore sombre, et un écran de la V4 qui ne pose pas son fond se
    // retrouve à dessiner des cartes claires sur le noir de l'ancien atelier.
    <main
      data-ecran-famille
      aria-label={`La famille ${nom}`}
      className="flex min-h-0 flex-1 overflow-hidden bg-papier"
    >
      {/* Le fantôme du glisser — hors écran, son contenu est écrit à la main au
          moment du `dragstart` (le rendu React n'a pas le temps de se refaire
          avant que le navigateur ne capture l'image). */}
      <div
        ref={fantomeRef}
        aria-hidden
        className="pointer-events-none fixed left-[-1000px] top-[-1000px] flex items-center gap-[8px] rounded-8 border border-signal bg-carte px-[14px] py-[8px] text-[12px] text-encre"
      />

      <section className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        {/* ── Le fil, le titre, les actions ─────────────────────────────── */}
        <div className="flex items-baseline gap-[8px] text-[12.5px] text-encre-3">
          <span>{nom}</span>
          <span aria-hidden>›</span>
          {/* Tant que la grille charge, `groupes` est vide et le nom de la
              collection reste inconnu : on n'écrit rien plutôt qu'« Tous »,
              qui serait faux. */}
          <span className="text-encre">
            {collection === null ? "Tous" : (groupeOuvert?.nom ?? "")}
          </span>
        </div>

        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">{titre}</h1>
            <p className="text-[13px] text-encre-2">
              {groupes.length > 0
                ? `Rangés dans ${groupes.length} collections. Un même ${mots.singulier} peut être dans plusieurs.`
                : "Aucune collection encore. Une collection range sans contraindre."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            <button
              type="button"
              onClick={surReglages}
              className="flex h-[34px] items-center gap-[4px] rounded-7 border border-trait bg-carte px-[14px] text-[13px] text-encre transition-colors duration-120 hover:border-contour"
            >
              <span>Réglages de la famille</span>
              <span aria-hidden className="text-encre-4">
                ›
              </span>
            </button>
            <button
              type="button"
              onClick={surAjouter}
              className="h-[34px] rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec"
            >
              Ajouter un {mots.singulier}
            </button>
          </div>
        </div>

        {/* ── La barre d'outils ──────────────────────────────────────────── */}
        <div className="flex items-center gap-[8px]">
          <span className="flex h-[34px] shrink-0 items-center gap-[8px] rounded-7 border border-trait bg-carte px-[14px]">
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-encre-4)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              type="text"
              value={recherche}
              onChange={(e) => chercher(e.target.value)}
              placeholder="Chercher…"
              aria-label={`Chercher un ${mots.singulier}`}
              className="w-full bg-transparent text-[13px] text-encre outline-none placeholder:text-encre-4"
            />
          </span>

          <div role="tablist" aria-label="La vue" className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            <Onglet actif={vue === "grille"} onClic={() => setVue("grille")}>
              La grille
            </Onglet>
            <Onglet actif={vue === "liste"} onClic={() => setVue("liste")}>
              La liste
            </Onglet>
            <Onglet actif={vue === "poses"} onClic={() => setVue("poses")}>
              Les poses
            </Onglet>
          </div>

          <div role="tablist" aria-label="Le filtre" className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            <Onglet actif={filtre === "tous"} onClic={() => choisirCollection("tous")}>
              Tous
            </Onglet>
            <Onglet actif={filtre === "incomplets"} onClic={() => choisirCollection("incomplets")}>
              Incomplets <span className="mesure ml-[4px]">{filtres.incomplets}</span>
            </Onglet>
            <Onglet
              actif={filtre === "sans-description"}
              onClic={() => choisirCollection("sans-description")}
            >
              Sans description <span className="mesure ml-[4px]">{filtres["sans-description"]}</span>
            </Onglet>
          </div>

          <button
            type="button"
            aria-pressed={modeSelection}
            onClick={basculerModeSelection}
            className={[
              "ml-auto flex h-[34px] shrink-0 items-center gap-[4px] rounded-7 border px-[14px] text-[13px] transition-colors duration-120",
              modeSelection
                ? "border-signal bg-ligne-ouverte text-signal"
                : "border-trait bg-carte text-encre hover:border-contour",
            ].join(" ")}
          >
            Sélection
          </button>
        </div>

        {/* ── Nommer une collection sans rien avoir choisi ────────────────── */}
        {nouvelleOuverte && selection.length === 0 && (
          <div
            data-nouvelle-collection
            className="flex items-center gap-[8px] rounded-8 border border-trait bg-carte px-[14px] py-[8px]"
          >
            <span className="text-[12.5px] text-encre-2">
              Une collection de plus dans {nom.toLowerCase()} :
            </span>
            <ChampDeCollection
              nom={nomNouvelle}
              onNom={setNomNouvelle}
              onCreer={() => void creerEtRanger()}
              onAbandon={() => setNouvelleOuverte(false)}
            />
            <button
              type="button"
              onClick={() => setNouvelleOuverte(false)}
              className="ml-auto h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 hover:text-encre"
            >
              Laisser tomber
            </button>
          </div>
        )}

        {/* ── La barre de masse ──────────────────────────────────────────── */}
        {selection.length > 0 && (
          <div
            data-barre-de-masse
            className="flex items-center gap-[8px] rounded-8 border border-trait-echec bg-fond-echec px-[14px] py-[8px]"
          >
            <span className="whitespace-nowrap text-[13px] font-medium text-echec">
              <span className="mesure">{selection.length}</span>{" "}
              {selection.length > 1 ? "choisis" : "choisi"}
            </span>
            <span className="whitespace-nowrap text-[12.5px] text-encre-3">
              glisse-les sur une collection, ou :
            </span>
            <button
              type="button"
              onClick={() => setRangerOuvert((v) => !v)}
              className="h-[26px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre"
            >
              Ranger dans…
            </button>
            <button
              type="button"
              onClick={() => setSelection([])}
              className="ml-auto h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 hover:text-encre"
            >
              Ne rien choisir
            </button>
          </div>
        )}

        {rangerOuvert && selection.length > 0 && (
          <div className="flex flex-wrap gap-[8px] rounded-8 border border-trait bg-carte p-[8px]">
            {groupes.length === 0 && (
              <span className="text-[12.5px] text-encre-3">aucune collection encore</span>
            )}
            {groupes.map((groupe) => (
              <button
                key={groupe.identifiant}
                type="button"
                onClick={() => {
                  void rangerDans(groupe.identifiant, selection)
                  setRangerOuvert(false)
                }}
                className="rounded-full bg-trait-faible px-[14px] text-[12.5px] text-encre-2 hover:bg-ligne-ouverte"
              >
                {groupe.nom}
              </button>
            ))}
          </div>
        )}

        {/* ── Les trois vues ──────────────────────────────────────────────── */}
        {vue === "grille" && (
          <div
            data-grille-de-sujets
            className="defile min-h-0 flex-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-[8px] overflow-y-auto"
          >
            {sujets.map((sujet) => (
              <CarteDeGrille
                key={sujet.identifiant}
                sujet={sujet}
                choisi={selection.includes(sujet.identifiant)}
                onChoisir={() => surClicDeCarte(sujet.identifiant)}
                onPrendreEnMain={prendreEnMain(sujet.identifiant)}
                onFinDeGlissement={finDeGlissement}
              />
            ))}
          </div>
        )}

        {vue === "liste" && (
          <div
            data-liste-de-sujets
            className="defile min-h-0 flex-1 flex flex-col gap-[4px] overflow-y-auto"
          >
            {sujets.map((sujet) => (
              <LigneDeListe
                key={sujet.identifiant}
                sujet={sujet}
                choisi={selection.includes(sujet.identifiant)}
                onChoisir={() => surClicDeCarte(sujet.identifiant)}
                onPrendreEnMain={prendreEnMain(sujet.identifiant)}
                onFinDeGlissement={finDeGlissement}
              />
            ))}
          </div>
        )}

        {vue === "poses" && <TableauDesPoses sujets={sujets} />}

        {/* ── Le pied de grille ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-[22px] border-t border-trait py-[8px] text-[12.5px] text-encre-3">
          <div className="flex flex-wrap items-center gap-[8px]">
            <span>
              <span className="mesure">{montres}</span> des <span className="mesure">{total}</span> affichés.
            </span>
            {resteAChanger && (
              <button
                type="button"
                onClick={() => setLimite((l) => l + 120)}
                className="h-[26px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre"
              >
                Charger la suite
              </button>
            )}
            {totalIncomplets > 0 && (
              <span className="text-encre">
                {totalIncomplets === 1 ? (
                  <>
                    <span className="mesure">1</span> {mots.singulier} a une pose manquante.
                  </>
                ) : (
                  <>
                    <span className="mesure">{totalIncomplets}</span> {mots.pluriel} ont des poses
                    manquantes.
                  </>
                )}
              </span>
            )}
          </div>
          {totalIncomplets > 0 && filtre !== "incomplets" && (
            <button
              type="button"
              onClick={() => choisirCollection("incomplets")}
              className="whitespace-nowrap text-[12.5px] text-encre-2 underline"
            >
              Voir seulement ce qui manque ›
            </button>
          )}
        </div>
      </section>

      {/* ── Le volet ──────────────────────────────────────────────────────── */}
      {selection.length > 0 && (
        <aside
          data-volet-de-selection
          aria-label="La sélection"
          className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
        >
          <div className="flex flex-col gap-[4px]">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              {selection.length === 1 ? (
                "Le sujet choisi"
              ) : (
                <>
                  Les <span className="mesure">{selection.length}</span> choisis
                </>
              )}
            </p>
            <p className="text-[13px] leading-[1.45] text-encre-2">
              Ce que tu fais ici s'applique aux <span className="mesure">{selection.length}</span> d'un
              coup.
            </p>
          </div>

          <div className="flex flex-col gap-[4px] rounded-8 border border-trait bg-carte p-[8px]">
            {choisis.map((sujet) => (
              <div key={sujet.identifiant} className="flex items-center gap-[8px] rounded-5 p-[4px]">
                <Vignette sujet={sujet} cote={34} className="h-[34px] w-[34px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-encre">{sujet.nom}</p>
                  <p className="truncate text-[11.5px] text-encre-4">
                    {sujet.collections[0]?.nom ?? sujet.type} ·{" "}
                    <span className="mesure">
                      {sujet.compte.poses.fait} / {sujet.compte.poses.attendu}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => basculerChoix(sujet.identifiant)}
                  aria-label={`Retirer ${sujet.nom} de la sélection`}
                  className="text-[13px] text-encre-4 hover:text-encre"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
            <p className="text-[13px] font-medium text-encre">Les ranger</p>
            <div className="flex flex-wrap gap-[8px]">
              {groupes.map((groupe) => {
                const cetteSurvolee = survolee === groupe.identifiant
                return (
                  <ChipDeRangement
                    key={groupe.identifiant}
                    groupe={groupe}
                    deja={dejaParmi(sujets, selection, groupe.identifiant)}
                    survolee={cetteSurvolee}
                    arrivants={arrivantsParmi(sujets, glisses ?? [], groupe.identifiant).length}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes(GLISSE_DES_SUJETS)) return
                      e.preventDefault()
                      setSurvolee(groupe.identifiant)
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return
                      setSurvolee((c) => (c === groupe.identifiant ? null : c))
                    }}
                    onDrop={(e) => {
                      if (!e.dataTransfer.types.includes(GLISSE_DES_SUJETS)) return
                      e.preventDefault()
                      setSurvolee(null)
                      deposerSur(groupe.identifiant)
                    }}
                  />
                )
              })}
              {nouvelleOuverte ? (
                <ChampDeCollection
                  nom={nomNouvelle}
                  onNom={setNomNouvelle}
                  onCreer={() => void creerEtRanger()}
                  onAbandon={() => setNouvelleOuverte(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNouvelleOuverte(true)}
                  className="inline-flex h-[26px] items-center rounded-full border border-contour px-[14px] text-[12.5px] text-encre-4"
                >
                  + nouvelle
                </button>
              )}
            </div>
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              Une collection ne déplace rien et n'efface rien : elle range. Un sujet peut être dans
              autant de collections qu'on veut.
            </p>
          </div>

          <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
            <p className="text-[13px] font-medium text-encre">Ce qui leur manque</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-[4px] text-[12.5px]">
              <span className="text-encre-2">Poses manquantes</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => s.compte.poses.fait < s.compte.poses.attendu).length}
              </span>
              <span className="text-encre-2">Sans description</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => !s.description.trim()).length}
              </span>
              <span className="text-encre-2">Sans animation</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => s.compte.bandes.fait === 0).length}
              </span>
            </div>
          </div>

          <div className="rounded-8 border border-contour bg-fond-attention p-[14px]">
            <p className="mb-[4px] text-[13px] font-medium text-encre">Une collection n'est pas une famille</p>
            <p className="text-[12px] leading-[1.5] text-encre-2">
              La famille — personnages, objets, terrains — est posée par l'atelier et décide des outils.
              La collection, c'est toi qui la crées, et elle ne sert qu'à retrouver.
            </p>
          </div>
        </aside>
      )}
    </main>
  )
}
