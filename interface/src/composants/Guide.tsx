/**
 * Le guide — un volet depuis `B7`, plus un écran.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Guide.dc.html`. Avant cette tranche, ouvrir
 * le guide recouvrait tout l'atelier et montrait les 157 entrées du corpus à
 * la file, groupées par les neuf écrans de la V1 — dont six avaient disparu
 * depuis longtemps. **Il montre maintenant ce qui concerne l'écran ouvert,
 * et rien d'autre** : un volet de 380 px, posé à droite, qui ne cache jamais
 * ce qu'il documente.
 *
 * **Il n'a aucune liste à lui.** Ce qu'il affiche vient de `entree.ou` — le
 * même champ que `pieces.tsx` et chaque bulle lisent déjà pour `nom`/`quoi` —
 * et de l'écran que `App.tsx` calcule depuis la pile de lieux. Ajouter une
 * entrée au corpus avec le bon `ou` la fait paraître ici sans toucher ce
 * fichier.
 *
 * **Il ne porte pas de fente de refus**, pour la même raison qu'avant : il ne
 * demande rien au serveur, ne dépense rien, ne peut pas échouer.
 *
 * **Depuis `GU2`, il se parcourt au lieu de se lire** : l'écran se présente en
 * trois lignes tout en haut quand il a son résumé, les réglages se rangent
 * sous le titre de leur zone, et chaque fiche est repliée sur son nom et ce
 * que c'est. Un clic ouvre ce que ça change, d'où ça sort et l'« à savoir ».
 * Les textes, eux, n'ont pas bougé : c'est le travail de `GU4` à `GU15`.
 *
 * **Ce qui ne fait pas le voyage depuis l'écran d'avant** : les six pas de
 * « Le geste » et les quatre visites d'écran (« L'univers », « Le codex »,
 * « La galerie », « L'établi ») — une prose longue, écrite pour une colonne de
 * 540 px et pour des noms d'écrans que le carnet a en partie remplacés.
 * Aucun des six critères de `B7` ne la réclame, et la retailler de force dans
 * 380 px lui aurait fait dire autre chose. Elle reste lisible dans l'historique
 * Git (`git show HEAD~1:interface/src/composants/Guide.tsx`) si elle doit un
 * jour redevenir un vrai parcours d'accueil.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { AIDE, RESUMES, SANS_ENTREE, type Explication } from "../aide"

// ── Ouvrir le guide depuis n'importe où ─────────────────────────────────────
//
// Le patron de la barre, et pour la même raison : il s'appelle au clavier
// depuis n'importe quel écran, et on ne fait pas descendre un rappel à
// travers quatre étages pour un volet qui se pose par-dessus tout.

let ouvert = false
let ancre: string | null = null
const abonnes = new Set<() => void>()

function prevenir() {
  abonnes.forEach((f) => f())
}

/** `cle`, s'il est donné, force l'écran du volet à celui de cette entrée-là —
 *  c'est le lien « Le guide › » d'une bulle, et il doit toujours retomber
 *  juste, même si on le clique depuis un écran que l'entrée ne concerne pas. */
export function ouvrirGuide(cle?: string) {
  ouvert = true
  ancre = cle ?? null
  prevenir()
}

export function fermerGuide() {
  if (!ouvert) return
  ouvert = false
  ancre = null
  prevenir()
}

export function useGuide() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    () => ouvert,
    () => false,
  )
}

/** Remettre le guide à zéro — les essais d'écran, comme pour la barre. */
export function reinitialiserGuide() {
  ouvert = false
  ancre = null
  prevenir()
}

// ── Sous un dialogue modal, le volet entre dans le dialogue ───────────────
//
// **`GU16` (1/2), vérifié au navigateur.** `CadreDialogue` ouvre son
// `<dialog>` par `showModal()` : le navigateur le pose dans sa *couche
// supérieure*, qui passe au-dessus de tout élément ordinaire quel que soit son
// `z-index`, et rend inerte tout ce qui n'est pas dans le dialogue. Sur les
// écrans posés en dialogue (la préparation d'une fabrication, l'éditeur de
// pixels… — les sons en faisaient partie, avant que `RT8` n'en fasse une
// surface comme les tuiles), presser `?` ouvrait bien l'état du guide — et le
// volet restait **derrière**, invisible, et n'aurait pas répondu au clic s'il
// avait été visible. Un `popover` aurait réglé la vue et laissé l'inertie.
//
// Le volet se pose donc **dans** le dialogue modal le plus haut, quand il y
// en a un : il est alors dans la couche supérieure avec lui, et il reste
// cliquable. Sans dialogue, il reste où `App.tsx` le rend, comme avant.

/** Le dialogue ouvert le plus récent — celui qui est au-dessus des autres : les
 *  dialogues du produit se posent à la fin du `body` dans l'ordre où ils
 *  s'ouvrent, et leur `showModal()` suit ce même ordre. */
function dialogueLePlusHaut(): HTMLElement | null {
  const ouverts = document.querySelectorAll<HTMLElement>("dialog[open]")
  return ouverts.length > 0 ? ouverts[ouverts.length - 1] : null
}

/** Suit les dialogues qui s'ouvrent et se ferment pendant que le volet est là :
 *  on peut presser `?` puis ouvrir une fenêtre, ou l'inverse. Deux observateurs
 *  et non un seul sur tout le sous-arbre : les dialogues se posent directement
 *  dans `body`, et l'attribut `open` est le seul qui compte dedans — écouter
 *  chaque mutation de l'atelier pour ça serait payer beaucoup pour rien. */
function useDialogueLePlusHaut(): HTMLElement | null {
  const [hote, setHote] = useState<HTMLElement | null>(dialogueLePlusHaut)
  useEffect(() => {
    const relire = () => setHote(dialogueLePlusHaut())
    const posees = new MutationObserver(relire)
    posees.observe(document.body, { childList: true })
    const ouvertes = new MutationObserver(relire)
    ouvertes.observe(document.body, { attributes: true, attributeFilter: ["open"], subtree: true })
    relire()
    return () => {
      posees.disconnect()
      ouvertes.disconnect()
    }
  }, [])
  return hote
}

// ── Il ne recouvre pas ce qu'il documente ─────────────────────────────────
//
// **`GU16` (1/2), vu au navigateur** : le volet est `fixed`, donc il *passait
// sur* la colonne de droite des écrans qui en ont une — la fiche d'une image
// ou d'un clip dans la galerie, « Le résultat » de l'atelier d'une animation —,
// c'est-à-dire sur ce qu'il explique. Il faut donc qu'il **prenne sa place**
// au lieu de la couvrir : tant qu'il est ouvert, l'écran dessous se rétrécit
// de sa largeur, du côté droit.
//
// L'écran, c'est `#atelier` — ou le dialogue modal qui porte le volet, dont
// la couche supérieure passe par-dessus `#atelier` et ne le rétrécirait pas.
// On mesure jusqu'où l'hôte s'étend à droite : plein écran, il cède les 380 px
// entiers ; un dialogue centré de 880 px n'en cède que ce qui déborde sous le
// volet. **Sous 1100 px de large, on ne rétrécit rien** : il ne resterait plus
// assez d'écran pour ce qu'il documente, et le volet recouvre alors, comme
// avant.
const LARGEUR_DU_VOLET = 380
const LARGEUR_MINIMALE_POUR_RETRECIR = 1100

function useLaPlaceDuVolet(hote: HTMLElement | null) {
  useLayoutEffect(() => {
    const cible = hote ?? document.getElementById("atelier")
    if (!cible) return
    const poser = () => {
      if (window.innerWidth < LARGEUR_MINIMALE_POUR_RETRECIR) {
        cible.style.paddingRight = ""
        return
      }
      const debord = cible.getBoundingClientRect().right - (window.innerWidth - LARGEUR_DU_VOLET)
      cible.style.paddingRight = debord > 0 ? `${Math.round(debord)}px` : ""
    }
    poser()
    window.addEventListener("resize", poser)
    return () => {
      window.removeEventListener("resize", poser)
      cible.style.paddingRight = ""
    }
  }, [hote])
}

// Échap referme le volet, et lui seul. Sans cette marque, la même touche
// fermerait aussi le dialogue dessous : l'écouteur du volet passe avant
// l'événement `cancel` du dialogue, qui ne voit plus de guide ouvert.
let echapDuGuide = Number.NEGATIVE_INFINITY

/** Vrai si une touche Échap vient de fermer le volet — `CadreDialogue` s'en sert
 *  pour ne pas se fermer avec lui. */
export function echapVientDeFermerLeGuide(): boolean {
  return performance.now() - echapDuGuide < 150
}

/** Vrai si le volet est ouvert, à l'instant où on le demande — pas une
 *  souscription comme `useGuide`, une simple lecture. Sert à un écran qui a
 *  son propre Échap (le détail d'une carte ou d'un îlot sur la toile, TS15)
 *  pour se taire pendant que le volet est par-dessus lui : contrairement à
 *  `echapVientDeFermerLeGuide`, ça ne dépend pas de l'ordre d'enregistrement
 *  des deux écouteurs `keydown` sur `window` (relecture du 24 septembre 2026,
 *  défaut 5). */
export function guideEstOuvert(): boolean {
  return ouvert
}

// ── L'écran, en toutes lettres ───────────────────────────────────────────────

/** Comment un écran se nomme dans l'en-tête du volet. Fermée : ajouter un
 *  membre à `Explication["ou"]` sans l'ajouter ici est une erreur de type,
 *  pas un oubli silencieux.
 *
 *  ⚠️ **`jeu` et `reglages` ne nomment pas ce qu'on croit, et `GU7` l'a
 *  réparé.** `jeu` est le titre que `ReglesDuJeu.tsx` affiche en mode reprise
 *  — littéralement *Réglages* —, c'est-à-dire l'onglet *Univers* de
 *  `Reglages.tsx` : le nom du jeu, son allure, sa vue, son monde. `reglages`,
 *  lui, ne porte plus « L'installation » : il sert **deux écrans à la fois**
 *  depuis `GU7` — l'installation de la machine (`Installation.tsx`) et les
 *  trois autres onglets des réglages, *Moteurs & workflows*, *Agent MCP*,
 *  *Consommations*. Aucun des deux ne parle d'un jeu, et les deux partagent
 *  des blocs (`BlocSecrets`), d'où un seul écran de guide pour les deux.
 *
 *  **Les trois noms des tuiles sont les `<h1>` de leurs écrans** (`GU13`) —
 *  *Les tuiles du jeu* pour la liste, *Livrer à Godot* pour la livraison. Le
 *  deuxième est le seul des seize qui ne recopie pas un titre : `jeu-de-tuiles`
 *  sert deux écrans, le choix de la sorte (*Quelle sorte de tuiles ?*) et
 *  l'atelier ouvert, dont le titre est le nom du jeu qu'on est en train de
 *  taper. Un nom vivant n'entre pas dans une table figée, et *Quelle sorte de
 *  tuiles ?* nommerait l'écran qu'on quitte au premier clic. */
const NOM_DE_LECRAN: Record<Explication["ou"], string> = {
  "tableau-de-bord": "Le jeu",
  codex: "Codex",
  sujet: "La fiche d'un sujet",
  galerie: "Galerie",
  case: "La fiche d'une image",
  clip: "Un clip",
  bande: "Une animation",
  montage: "Le montage d'un clip",
  tables: "Les tables",
  depenses: "Les dépenses",
  inspiration: "Univers & toile",
  jeu: "Réglages",
  ambiances: "Ambiances et couleurs",
  reglages: "L'atelier et sa machine",
  equipement: "Les équipements",
  sortie: "Livrer au jeu",
  tuiles: "Les tuiles du jeu",
  "jeu-de-tuiles": "Un jeu de tuiles",
  "livraison-de-tuiles": "Livrer à Godot",
  son: "Les sons",
  "un-son": "Un son",
  // `GU15` (1/2). Les quatre noms sont recopiés du `<h1>` de leur écran :
  // *Fabrications* (`Fabrications.tsx`), *Relire avant l'envoi*
  // (`Relecture.tsx`, le cadre commun aux quatre types), *Sur la grille du
  // jeu* (`GrilleDuJeu.tsx`) et *Deux côte à côte* (`Comparer.tsx` — son titre
  // change avec ce qu'on compare ; celui-ci est le cas général).
  fabrications: "Fabrications",
  envoi: "Relire avant l’envoi",
  grille: "Sur la grille du jeu",
  comparer: "Deux côte à côte",
}

// ── Le panneau des touches ────────────────────────────────────────────────
//
// **Rien n'y entre sans avoir été vérifié dans le code qui la lit** — c'est
// le critère qui commande la tranche. Une touche qui ne répond plus un jour
// doit sortir d'ici le même jour.
//
// **Les tables n'y sont pas.** `Ctrl Z` défait un trait de pinceau, mais
// seulement sur la place « la main » — une des huit — et cette place vit
// dans un état propre à la retouche (`interface/src/recette.ts`, `useEtatMain`),
// jamais remonté jusqu'ici. L'annoncer pour tout l'écran des tables la
// rendrait fausse sur les sept autres.
const CTRL_Z = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘Z" : "Ctrl Z"

const TOUCHES: Partial<Record<Explication["ou"], readonly { touche: string; quoi: string }[]>> = {
  inspiration: [
    { touche: "suppr", quoi: "retire le rectangle de découpe choisi" },
    { touche: CTRL_Z, quoi: "défait le dernier geste de composition sur la toile" },
  ],
  montage: [
    { touche: "← →", quoi: "déplace le curseur sur le ruban du clip" },
    { touche: "espace", quoi: "prend ou laisse l'image visée" },
  ],
  bande: [
    { touche: "↑ ↓ ← →", quoi: "déplace la case choisie d'un pixel" },
    { touche: "maj + flèche", quoi: "déplace de cinq pixels" },
  ],
  // Les touches de `GrilleEcoute.tsx` : elles vivent dans la grille des
  // tirages, donc sur *Un son* — l'atelier des sons n'en a aucune.
  "un-son": [
    { touche: "← →", quoi: "passe au tirage suivant, et l'écoute" },
    { touche: "espace", quoi: "écoute le tirage choisi, ou l'arrête" },
    { touche: "G", quoi: "garde le tirage choisi, ou le retire du jeu" },
  ],
}

// ── Les groupes ──────────────────────────────────────────────────────────

/** Le titre que prennent les fiches qui n'ont pas encore de `groupe`, sur un
 *  écran où d'autres en ont déjà un. */
const RESTE = "Le reste de cet écran"

type Groupe = { titre: string | null; fiches: [string, Explication][] }

/**
 * Les fiches d'un écran, rangées sous le titre de leur zone.
 *
 * Deux choix, et ils tiennent pendant tout le remplissage de `GU4` à `GU15`,
 * où un écran aura des fiches rangées et des fiches qui ne le sont pas encore :
 *
 * 1. **On ne retrie rien.** L'ordre des groupes est celui de leur première
 *    apparition dans le fichier, et l'ordre des fiches dans un groupe reste
 *    celui du fichier. Deux fiches éloignées qui portent le même `groupe` se
 *    rejoignent sous un seul titre, plutôt que d'en fabriquer deux identiques
 *    parce qu'une troisième s'était glissée entre elles.
 * 2. **Les fiches sans `groupe` finissent ensemble, à la fin.** Tant qu'aucune
 *    fiche de l'écran n'est rangée — le cas de tous les écrans aujourd'hui —
 *    elles paraissent sans titre du tout, exactement comme avant. Dès qu'une
 *    seule est rangée, les autres passent sous « Le reste de cet écran » : un
 *    titre honnête, qui dit où en est le chantier au lieu de le cacher.
 */
function grouper(entrees: [string, Explication][]): Groupe[] {
  const ranges: Groupe[] = []
  const sansGroupe: [string, Explication][] = []

  for (const fiche of entrees) {
    const titre = fiche[1].groupe
    if (!titre) {
      sansGroupe.push(fiche)
      continue
    }
    const deja = ranges.find((g) => g.titre === titre)
    if (deja) deja.fiches.push(fiche)
    else ranges.push({ titre, fiches: [fiche] })
  }

  if (sansGroupe.length === 0) return ranges
  return [...ranges, { titre: ranges.length > 0 ? RESTE : null, fiches: sansGroupe }]
}

// ── Le volet ─────────────────────────────────────────────────────────────

export function VoletGuide({
  onFermer,
  ecran,
}: {
  onFermer: () => void
  /** L'écran ouvert, calculé par `App.tsx` depuis la pile de lieux — ou
   *  `null` sur un parcours qui n'en a pas encore (l'ouverture, par exemple). */
  ecran: Explication["ou"] | null
}) {
  const corps = useRef<HTMLDivElement | null>(null)
  const hote = useDialogueLePlusHaut()
  useLaPlaceDuVolet(hote)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      echapDuGuide = performance.now()
      // Un dialogue dessous ne doit pas se fermer avec le volet (voir plus haut).
      e.preventDefault()
      onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  // Un lien de bulle force l'écran de sa propre entrée : ouvrir « Le guide › »
  // depuis un réglage retombe toujours sur ce réglage, jamais sur un groupe
  // vide parce que l'écran calculé aurait divergé d'un rendu à l'autre.
  const cible = ancre && AIDE[ancre] ? AIDE[ancre] : null
  const scope = cible?.ou ?? ecran
  // Lu pendant le rendu, comme `ancre` juste au-dessus : le volet ne se rend
  // que parce que `useGuide` a prévenu, donc la valeur est toujours fraîche.
  const visee = cible ? ancre : null

  useEffect(() => {
    if (!visee) return
    const noeud = corps.current?.querySelector(`#reglage-${visee.replace(/\W/g, "-")}`)
    noeud?.scrollIntoView({ block: "start" })
  }, [visee])

  const entrees = scope ? Object.entries(AIDE).filter(([, e]) => e.ou === scope) : []
  const groupes = grouper(entrees)
  const resume = scope ? RESUMES[scope] : undefined
  const touches = scope ? TOUCHES[scope] : undefined
  const rien = entrees.length === 0 && !touches && !resume

  const volet = (
    <div
      data-volet-du-guide
      aria-label="Le guide"
      className="fixed inset-y-0 right-0 z-10 flex w-[380px] shrink-0 flex-col border-l border-trait bg-carte"
    >
      <header className="flex h-[54px] shrink-0 items-center gap-[8px] border-b border-trait px-[14px]">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[15px] leading-none text-encre">Guide</h1>
          {scope && (
            <p className="mesure mt-[4px] truncate text-[11px] text-encre-4">
              {NOM_DE_LECRAN[scope]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="mesure h-[26px] shrink-0 rounded-5 border border-contour px-[8px] text-[10.5px] text-encre-3 transition-colors duration-120 hover:bg-papier"
        >
          fermer · Échap
        </button>
      </header>

      <div ref={corps} className="defile min-h-0 flex-1 overflow-y-auto p-[22px]">
        {rien && (
          <p className="text-[12px] leading-[1.5] text-encre-3">
            Rien à expliquer ici pour l'instant.
          </p>
        )}

        {/* L'encadré de tête : à quoi sert la page, et les trois gestes qu'on
            y fait. Avant tout réglage, parce qu'on vient ici quand on ne sait
            pas encore quel réglage chercher. */}
        {resume && (
          <div className="mb-[22px] rounded-8 border border-trait bg-papier p-[14px]">
            <p className="text-[12px] leading-[1.5] text-encre">{resume.aQuoi}</p>
            {resume.gestes.length > 0 && (
              <ul className="mt-[8px] flex flex-col gap-[4px]">
                {resume.gestes.map((geste) => (
                  <li
                    key={geste}
                    className="flex items-baseline gap-[8px] text-[12px] leading-[1.5] text-encre-2"
                  >
                    <span aria-hidden className="shrink-0 text-encre-4">
                      ·
                    </span>
                    <span>{geste}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {touches && touches.length > 0 && (
          <div className="mb-[22px] rounded-8 border border-trait bg-papier p-[14px]">
            <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Les touches de cet écran
            </h2>
            <ul className="flex flex-col gap-[8px]">
              {touches.map((t) => (
                <li key={t.touche} className="flex items-baseline gap-[8px] text-[12px] text-encre-2">
                  <span className="mesure shrink-0 rounded-5 border border-contour px-[4px] py-px text-[10.5px] text-encre-3">
                    {t.touche}
                  </span>
                  <span>{t.quoi}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {groupes.map((groupe, i) => (
          <section key={groupe.titre ?? "sans-groupe"} className={i > 0 ? "mt-[22px]" : undefined}>
            {groupe.titre && (
              <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                {groupe.titre}
              </h2>
            )}
            {groupe.fiches.map(([cle, entree]) => (
              <Reglage key={cle} cle={cle} entree={entree} deplieeAuDepart={cle === visee} />
            ))}
          </section>
        ))}

        {SANS_ENTREE.length > 0 && (
          <div className="mt-[34px] border-t border-trait pt-[14px]">
            <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Ce qui n'est pas encore écrit
            </h2>
            <ul className="flex flex-col gap-[4px] text-[11px] text-encre-4">
              {SANS_ENTREE.map((nom) => (
                <li key={nom}>{nom}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )

  // Sous un dialogue modal, le volet entre dans le dialogue (voir plus haut).
  return hote ? createPortal(volet, hote) : volet
}

/**
 * Une entrée du corpus — **le même texte que la bulle**, jamais recopié.
 *
 * **Repliée au départ** : on montre le nom et ce que c'est, et rien d'autre.
 * Sur un écran qui porte soixante-treize réglages, c'est la seule façon de
 * parcourir sans lire. Un clic ouvre ce que ça change, d'où ça sort, et le
 * « à savoir » quand il y en a un.
 *
 * Le titre reste un `h3` et le bouton se pose dedans, pas l'inverse : la
 * liste des réglages se parcourt au clavier comme un sommaire, et le nom
 * garde son rang de titre.
 */
function Reglage({
  cle,
  entree,
  deplieeAuDepart,
}: {
  cle: string
  entree: Explication
  /** Le lien « Le guide › » d'une bulle vise cette fiche-là : elle s'ouvre
   *  dépliée, sinon on aurait fait défiler jusqu'à une ligne fermée. */
  deplieeAuDepart: boolean
}) {
  const [depliee, setDepliee] = useState(deplieeAuDepart)

  // Le volet peut déjà être ouvert quand une bulle vise une autre fiche : on
  // déplie la nouvelle visée sans refermer celles que le lecteur avait ouvertes.
  useEffect(() => {
    if (deplieeAuDepart) setDepliee(true)
  }, [deplieeAuDepart])

  return (
    <section id={`reglage-${cle.replace(/\W/g, "-")}`} className="mt-[22px] first:mt-0">
      <h3 className="text-[13px] font-medium text-encre">
        <button
          type="button"
          aria-expanded={depliee}
          onClick={() => setDepliee((d) => !d)}
          className="w-full text-left transition-colors duration-120 hover:text-signal"
        >
          {entree.nom}
        </button>
      </h3>
      <p className="mt-[4px] text-[12px] leading-[1.5] text-encre">{entree.quoi}</p>

      {depliee && (
        <>
          <p className="mt-[4px] text-[12px] leading-[1.5] text-encre-2">{entree.change}</p>
          <p className="mesure mt-[8px] text-[10.5px] text-encre-4">{entree.origine}</p>
          {entree.long
            ?.split("\n\n")
            .map((para, i) => (
              <p key={i} className="mt-[8px] text-[12px] leading-[1.5] text-encre-2">
                {para}
              </p>
            ))}
        </>
      )}
    </section>
  )
}
