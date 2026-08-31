// Le codex — ce que le monde contient, et ce qui lui manque.
//
// **La distinction qui fait tout tenir** : une image est un résultat, une chose
// du jeu est une chose du jeu. Balthazar existe dans le codex avant d'avoir la
// moindre image — et c'est ce qui permet au produit de dire ce qui lui manque.
//
// **La frontière avec l'onglet Univers se dit en une phrase** : l'univers tient
// le **style**, ce à quoi le jeu ressemble ; le codex tient la **structure**, la
// liste des choses que le jeu contient et de ce qu'elles réclament. L'univers
// dit qu'un personnage a six poses ; le codex dit lesquelles Balthazar a déjà et
// lesquelles il lui manque.
//
// **Trois colonnes** — `240px · 1fr · 380px`. À gauche ce que le monde contient
// et ce que le jeu réclame de tous ; au milieu les choses de la famille ouverte,
// chacune avec ce qui lui manque ; à droite la chose choisie. Aucune largeur
// neuve : ce sont les trois de `docs/DESIGN.md` § Largeurs de colonne.
//
// **Ce qu'il absorbe.** L'écran Personnages d'aujourd'hui, et les deux listes
// qui traînaient dans sa colonne de gauche : le plan de poses et le vestiaire.
// Elles s'imposent à plusieurs choses du jeu, donc elles n'appartenaient pas à
// la colonne d'un seul.
//
// **Ce qui monte, ce qui reste.** L'établi d'une chose est une *profondeur* du
// codex, pas un onglet : on y arrive en cliquant son nom, et le fil d'Ariane
// remplace le nom de l'onglet. Il vit dans `Personnages.tsx`, qui le portait
// déjà sous le nom de fiche.

import { useEffect, useRef, useState } from "react"
import {
  api,
  type Direction,
  type DirectionsDuJeu,
  type PropositionDeBaisse,
  type EmplacementCorps,
  type AmbianceDuJeu,
  type Personnage,
  type Piece,
  type Pose,
  type Vestiaire,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { Bouton, EnTetePanneau, Libelle, Raison } from "./chassis"
import { PANNEAU } from "./Infobulle"
import { EcranVitrine } from "./Vitrine"
import {
  PlanDuJeu,
  Vestiaire as PanneauVestiaire,
  faitesDeLaCase,
  posesTenues,
} from "./Personnages"

// ── Ce que le monde contient ────────────────────────────────────────────────

/**
 * Les cinq familles, et les deux listes que le jeu impose à plusieurs.
 *
 * **Quatre familles du produit, plus le vestiaire.** Le vocabulaire est celui
 * du dépôt — personnages · objets · décors · interface —, et il décide déjà de
 * quelque chose : quand on génère un personnage, seuls les artworks officiels
 * de la famille *personnages* partent en référence. Un second vocabulaire
 * aurait fini par diverger du premier.
 *
 * **L'équipement est une famille comme les autres, et non un réglage** : une
 * pièce a un nom, une description, un emplacement sur le corps et une portée.
 * C'est une chose du monde.
 */
export const FAMILLES = [
  { cle: "personnages", nom: "Personnages" },
  { cle: "decors", nom: "Décors" },
  { cle: "objets", nom: "Objets" },
  { cle: "interface", nom: "Interface" },
  { cle: "equipement", nom: "Équipement" },
] as const

export type Rubrique =
  | (typeof FAMILLES)[number]["cle"]
  | "directions"
  | "poses"

/** Le nom d'une rubrique, pour le fil d'Ariane (E15).
 *
 *  **Le fil dit où l'on est, et il y a maintenant cinq endroits.** Il disait
 *  *Personnages* quoi qu'on regarde, ce qui était vrai tant que c'était la seule
 *  famille qui portait des choses. */
export const NOM_DE_LA_RUBRIQUE: Record<string, string> = {
  ...Object.fromEntries(FAMILLES.map((f) => [f.cle, f.nom])),
  directions: "Les directions",
  poses: "Leurs poses",
}

/** Ce qu'un monde vide dit, famille par famille (E15).
 *
 *  **Une phrase par famille, parce qu'elles ne se remplissent pas pareil.** « Ce
 *  jeu n'a encore personne » sous *Décors* aurait été faux — un décor n'est
 *  personne. Le produit ne réclame rien : ce sont des états, pas des reproches. */
const VIDE_DE_LA_FAMILLE: Record<string, string> = {
  personnages: "Ce jeu n'a encore personne.",
  decors: "Ce jeu n'a encore aucun lieu.",
  objets: "Ce jeu n'a encore aucun objet.",
  interface: "Ce jeu n'a encore aucun élément d'écran.",
}

/** L'exemple que porte le champ qui nomme, famille par famille. **Un exemple,
 *  pas une étiquette** — c'est la leçon de la séance du 29 août 2026 sur
 *  l'emplacement d'une pièce : deux endroits du corps disent de quoi on parle
 *  sans une ligne de plus. */
const PLACEHOLDER_DE_LA_FAMILLE: Record<string, string> = {
  personnages: "nommer une chose du jeu",
  decors: "les cavernes du nord, une salle du trône…",
  objets: "un tonneau cerclé de fer, un coffre…",
  interface: "un bouton, un cadre, une jauge…",
}

/** Les choses d'une famille (E15).
 *
 *  **La famille est calculée par le serveur**, qui la lit dans le type de la
 *  chose : deux vérités sur la même question auraient fini par ranger un meuble
 *  dans les décors. L'écran ne fait que trier ce qu'il reçoit. */
const deLaFamille = (personnages: Personnage[], famille: string) =>
  personnages.filter((p) => (p.famille || "personnages") === famille)

export function EcranCodex({
  plan,
  directions,
  rubrique,
  onRubrique,
  nommer,
  personnages,
  emplacements,
  pieces,
  choisi,
  onChoisir,
  onOuvrir,
  onPersonnage,
  onPlan,
  onDirections,
  onVestiaire,
  onArmer,
  replies,
  barreQuiPaie,
  onErreur,
}: {
  plan: Pose[]
  /** Les directions du jeu, et d'où la liste vient (E10). Tenues par l'App, qui
   *  est le seul endroit qui écoute le flux pour toute la vie de l'onglet. */
  directions: DirectionsDuJeu
  /** La rubrique ouverte — **tenue par l'App depuis E15**, parce que le fil
   *  d'Ariane la nomme : cinq familles portent des choses, et un fil qui dirait
   *  toujours *Personnages* mentirait dans quatre cas sur cinq. */
  rubrique: Rubrique
  onRubrique: (rubrique: Rubrique) => void
  /** **Allumer le champ qui nomme** (E19) — il change de valeur quand on sort
   *  de l'assistant. Un compteur plutôt qu'un drapeau : deux sorties de suite
   *  doivent l'allumer deux fois, et un booléen déjà à vrai ne redéclencherait
   *  rien. */
  nommer: number
  personnages: Personnage[]
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  /** La chose du jeu **désignée**, dont la colonne de droite parle. Ce n'est
   *  pas la même que la chose **ouverte** : désigner se fait d'un clic sur une
   *  carte, ouvrir se fait sur son nom et descend d'un étage. */
  choisi: string | null
  onChoisir: (identifiant: string | null) => void
  /** Descendre dans l'établi de cette chose — la profondeur du codex. */
  onOuvrir: (identifiant: string) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onPlan: (plan: Pose[]) => void
  onDirections: (directions: DirectionsDuJeu) => void
  onVestiaire: (vestiaire: Vestiaire) => void
  /** Armer ce qui manque à une chose : le même geste que la matrice, vu du
   *  codex. Rien ne part — la barre qui paie annonce le prix, et c'est elle
   *  qu'on clique ensuite. */
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  replies: { familles: boolean; fiche: boolean }
  barreQuiPaie: React.ReactNode
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  // **Le cinquième verbe du codex : il montre** (E16). Il rangeait, déclarait,
  // comptait, lançait — et aucun de ces quatre ne peut voir à quoi ressemble ce
  // qui est rangé. La vitrine ouverte d'ici montre le monde entier, une image
  // par chose : trois nains côte à côte disent tout de suite s'ils viennent du
  // même monde.
  const [vitrineOuverte, setVitrineOuverte] = useState(false)
  // **Les ambiances du jeu, demandées une fois pour tout l'écran** (E11). Les
  // deux colonnes s'en servent — la liste pour nommer celle d'une carte, la
  // fiche pour dire laquelle une chose désigne.
  const [ambiances, setAmbiances] = useState<AmbianceDuJeu[]>([])

  useEffect(() => {
    void api
      .coteAmbiances()
      .then((recu) => setAmbiances(recu?.ambiances ?? []))
      .catch(() => setAmbiances([]))
  }, [])

  const ouvert = personnages.find((p) => p.identifiant === choisi) ?? null

  // Les trois colonnes du § Layout, avec la case qui tombe à zéro quand on
  // replie. **Replier n'est pas fermer** : le panneau reste monté sous elle.
  const colonnes = [
    `${replies.familles ? 0 : 240}px`,
    "minmax(0,1fr)",
    `${replies.fiche ? 0 : 380}px`,
  ].join(" ")

  // **La vitrine remplace le codex en plein cadre**, comme un outil remplace la
  // matrice : c'est la même profondeur du même endroit, et elle retire la barre
  // qui paie — elle ne fabrique rien.
  if (vitrineOuverte)
    return (
      <div data-codex className="flex min-h-0 flex-col bg-fond-0">
        <EcranVitrine
          personnage={null}
          personnages={personnages}
          plan={plan}
          onFermer={() => setVitrineOuverte(false)}
          onErreur={onErreur}
        />
      </div>
    )

  return (
    <div data-codex className="flex min-h-0 flex-col bg-fond-0">
      <div
        data-colonnes
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: colonnes,
          transition: "grid-template-columns 160ms ease-in-out",
        }}
      >
        <div className="flex min-h-0 overflow-hidden">
          <ColonneDesFamilles
            personnages={personnages}
            pieces={pieces}
            plan={plan}
            directions={directions}
            rubrique={rubrique}
            onRubrique={onRubrique}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          {rubrique === "poses" ? (
            <div className="defile min-h-0 flex-1 overflow-y-auto p-4">
              <PlanDuJeu plan={plan} onPlan={onPlan} onErreur={onErreur} />
            </div>
          ) : rubrique === "equipement" ? (
            <div className="defile min-h-0 flex-1 overflow-y-auto p-4">
              <PanneauVestiaire
                emplacements={emplacements}
                pieces={pieces}
                onVestiaire={onVestiaire}
                onErreur={onErreur}
              />
            </div>
          ) : rubrique === "directions" ? (
            <div className="defile min-h-0 flex-1 overflow-y-auto p-4">
              <LesDirections
                directions={directions}
                onDirections={onDirections}
                onErreur={onErreur}
              />
            </div>
          ) : (
            // **Les cinq familles, et le même écran pour chacune** (E15). Un
            // décor est une chose du jeu au même titre qu'un personnage : le
            // codex ne connaît plus de famille de seconde classe.
            <ListeDesChoses
              famille={rubrique}
              nommer={nommer}
              personnages={deLaFamille(personnages, rubrique)}
              ambiances={ambiances}
              plan={plan}
              pieces={pieces}
              choisi={choisi}
              onChoisir={onChoisir}
              onOuvrir={onOuvrir}
              onPersonnage={onPersonnage}
              onVitrine={() => setVitrineOuverte(true)}
              onErreur={onErreur}
            />
          )}
          {barreQuiPaie}
        </div>

        <div className="flex min-h-0 overflow-hidden">
          <FicheDeLaChose
            personnage={ouvert}
            ambiances={ambiances}
            plan={plan}
            pieces={pieces}
            onOuvrir={onOuvrir}
            onFabriquerCeQuiManque={onArmer}
            onFermer={() => onChoisir(null)}
          />
        </div>
      </div>
    </div>
  )
}

// ── La colonne des familles ─────────────────────────────────────────────────

function ColonneDesFamilles({
  personnages,
  pieces,
  plan,
  directions,
  rubrique,
  onRubrique,
}: {
  personnages: Personnage[]
  pieces: Piece[]
  plan: Pose[]
  directions: DirectionsDuJeu
  rubrique: Rubrique
  onRubrique: (rubrique: Rubrique) => void
}) {
  // **Les cinq familles portent des entités de plein droit** (E15) : elles
  // avaient une ligne et un compte à zéro, elles ont maintenant leurs choses.
  const combien: Record<string, number> = {
    personnages: deLaFamille(personnages, "personnages").length,
    decors: deLaFamille(personnages, "decors").length,
    objets: deLaFamille(personnages, "objets").length,
    interface: deLaFamille(personnages, "interface").length,
    equipement: pieces.length,
  }
  // **Le compte des incomplets suit la phrase qui le porte** : elle dit « 3
  // personnages · 2 incomplets », donc il porte sur les personnages.
  const incomplets = deLaFamille(personnages, "personnages").filter(
    (p) => manque(p, plan, pieces) > 0,
  ).length

  return (
    <aside
      {...PANNEAU}
      className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
    >
      <EnTetePanneau>Ce que le monde contient</EnTetePanneau>
      <div className="defile min-h-0 flex-1 overflow-y-auto p-2">
        {FAMILLES.map(({ cle, nom }) => (
          <Rangee
            key={cle}
            nom={nom}
            compte={combien[cle]}
            allumee={rubrique === cle}
            onChoisir={() => onRubrique(cle)}
          />
        ))}

        <div className="my-3 h-px bg-bord" />
        {/* **Ce que le jeu réclame de tous**, par opposition à ce qu'une famille
            réclame. Les directions se déduisent de la vue du jeu et s'imposent
            à toute chose qui en a — donc à personne en particulier. */}
        <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
          Ce que le jeu réclame de tous
        </p>
        {/* **`4 · lues`, et le mot compte** (E10) : la liste vient de la vue
            du jeu et suivra un changement de vue. Dès qu'on renomme, elle passe
            à `à vous` — ce n'est plus la même promesse, et le codex le dit
            plutôt que de laisser croire qu'elle suit encore. */}
        <Rangee
          nom="Les directions"
          compte={directions.directions.length}
          valeur={
            directions.directions.length === 0
              ? "aucune"
              : `${directions.directions.length} · ${
                  directions.origine === "vue" ? "lues" : "à vous"
                }`
          }
          allumee={rubrique === "directions"}
          onChoisir={() => onRubrique("directions")}
        />

        <div className="my-3 h-px bg-bord" />
        <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
          Ce que les personnages réclament
        </p>
        <Rangee
          nom="Leurs poses"
          compte={plan.length}
          allumee={rubrique === "poses"}
          onChoisir={() => onRubrique("poses")}
        />
      </div>

      {/* **Le compte du monde, en clair et sans couleur d'alerte.** Un monde
          vide n'est pas une erreur, c'est un état — et trois personnages
          incomplets non plus. Le produit ne réclame rien. */}
      <p className="mesure shrink-0 border-t border-bord p-2 text-[10px] leading-4 text-texte-3">
        {combien.personnages} personnage{combien.personnages > 1 ? "s" : ""}
        {personnages.length > 0 && ` · ${incomplets} incomplet${incomplets > 1 ? "s" : ""}`}
        {/* **Les trois autres familles se comptent pour de vrai** (E15) : cette
            ligne portait trois zéros écrits en dur, parce qu'aucune n'avait
            d'entité. Elles en ont. */}
        <br />
        {combien.decors} décor{combien.decors > 1 ? "s" : ""},{" "}
        {combien.objets} objet{combien.objets > 1 ? "s" : ""},{" "}
        {combien.interface} élément{combien.interface > 1 ? "s" : ""} d'interface
      </p>
    </aside>
  )
}

function Rangee({
  nom,
  compte,
  valeur,
  allumee,
  onChoisir,
}: {
  nom: string
  compte?: number
  valeur?: string
  allumee: boolean
  onChoisir: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={allumee}
      onClick={onChoisir}
      className={[
        "flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left transition-colors duration-[80ms]",
        allumee
          ? "bg-fond-3 text-texte"
          : compte === 0
            ? "text-texte-3 hover:bg-fond-2"
            : "text-texte-2 hover:bg-fond-2",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1 truncate text-[11.5px]">{nom}</span>
      <span className="mesure shrink-0 text-[9.5px] text-texte-3">
        {valeur ?? compte}
      </span>
    </button>
  )
}

// ── Le milieu : les choses de la famille ouverte ────────────────────────────

/** Ce qui manque à une chose du jeu — **le compte de ce qui lui manque, jamais
 *  celui de ce qu'elle tient**. C'est la question qu'on vient poser au codex :
 *  ce qu'elle a se lit à côté de la jauge, ce qui lui manque est le chiffre. */
function manque(personnage: Personnage, plan: Pose[], pieces: Piece[]): number {
  // **Ce que cette chose-là réclame, pas ce que le jeu réclame** (E9, vu en
  // E15). Le compte lisait le plan du projet ; tant que seuls des personnages
  // existaient, c'était le même. Un décor y gagnait douze cases manquantes
  // qu'aucun écran ne sait remplir — il n'a pas de poses du tout.
  const tenues = posesTenues(personnage.plan ?? plan, personnage)
  // **Le compte porte sur des cases — une pose dans une direction** (E10), et
  // c'est le serveur qui fait le produit : `demandees` vaut déjà *tant d'images
  // dans tant de directions*, et `faites` ne compte que ce qui remplit une case
  // que cette chose tient encore.
  const corps = tenues.reduce((somme, pose) => {
    const case_ = personnage.cases.find((c) => c.pose === pose.identifiant)
    return (
      somme +
      Math.max(0, (case_?.demandees ?? pose.images) - faitesDeLaCase(case_))
    )
  }, 0)
  // **Une chose qui ne porte rien ne compte aucune pièce** (E15). Un décor et
  // un bouton n'ont pas de vestiaire : leur compter des calques manquants
  // aurait fait dire au codex qu'il leur manque douze images qu'aucun écran ne
  // sait fabriquer.
  if (!personnage.equipable) return corps
  // Une pièce se compte **sur les corps** : elle est solidaire de la pose sur
  // laquelle elle est apparue, et il en faut une par corps existant.
  const habillables = tenues.filter((pose) =>
    personnage.cases.find((c) => c.pose === pose.identifiant && c.corps),
  ).length
  const habilles = pieces.reduce(
    (somme, piece) =>
      somme +
      personnage.cases.filter((c) => (c.calques[piece.identifiant] ?? []).length > 0)
        .length,
    0,
  )
  return corps + Math.max(0, habillables * pieces.length - habilles)
}

function ListeDesChoses({
  famille,
  nommer,
  personnages,
  ambiances,
  plan,
  pieces,
  choisi,
  onChoisir,
  onOuvrir,
  onPersonnage,
  onVitrine,
  onErreur,
}: {
  /** La famille ouverte (E15). **Nommer crée dans celle-ci** : « un tonneau
   *  cerclé de fer » tapé sous *Objets* y reste, parce que le serveur pose le
   *  premier type de cette famille-là. */
  famille: string
  /** Le signal qui allume le champ qui nomme (E19). */
  nommer: number
  personnages: Personnage[]
  /** Les ambiances du jeu, **demandées une fois pour tout l'écran** (E11) : une
   *  par carte aurait fait autant d'appels qu'il y a de choses. Elles ne servent
   *  qu'à nommer — la désignation, elle, se fait sur la fiche. */
  ambiances: AmbianceDuJeu[]
  plan: Pose[]
  pieces: Piece[]
  choisi: string | null
  onChoisir: (identifiant: string | null) => void
  onOuvrir: (identifiant: string) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  /** Ouvrir la vitrine sur le monde entier (E16) — le verbe qui manquait. */
  onVitrine: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const vide = personnages.length === 0
  return (
    <div
      className={[
        "defile flex min-h-0 flex-1 flex-col overflow-y-auto p-4",
        // **Le champ qui nomme est au milieu de l'écran quand le monde est
        // vide, en rangée sinon — et c'est le même champ.** Un monde vide n'a
        // qu'un geste à proposer, et c'est celui-là ; un monde plein l'a en bas
        // de sa liste, où il ne demande rien.
        vide ? "items-center justify-center gap-4" : "gap-2",
      ].join(" ")}
    >
      {vide && (
        <p className="max-w-[504px] text-center font-serif text-[32px] leading-tight text-texte-3">
          {VIDE_DE_LA_FAMILLE[famille] ?? "Ce jeu n'a encore rien ici."}{" "}
          <em className="text-texte-2">Nomme le premier.</em>
        </p>
      )}

      {/* **Voir ce que ça donne**, et c'est la mission qui manquait : le codex
          compte des cases, la vitrine montre des images finies. Absent quand le
          monde est vide — il n'y a pas de chose à griser, il n'y a rien. */}
      {!vide && (
        <button
          type="button"
          onClick={onVitrine}
          title="le monde entier, une image par chose — sur le fond que la bible décrit"
          className="mesure h-[26px] self-start px-1 text-[10px] text-signal hover:text-signal-clair"
        >
          voir tout le monde en grand ›
        </button>
      )}

      {personnages.map((personnage) => (
        <CarteDeLaChose
          key={personnage.identifiant}
          personnage={personnage}
          plan={plan}
          pieces={pieces}
          ambiances={ambiances}
          choisie={personnage.identifiant === choisi}
          onChoisir={() => onChoisir(personnage.identifiant)}
          onOuvrir={() => onOuvrir(personnage.identifiant)}
        />
      ))}

      <ChampQuiNomme
        auMilieu={vide}
        allumer={nommer}
        famille={famille}
        onCree={(personnage) => {
          onPersonnage(personnage)
          onChoisir(personnage.identifiant)
        }}
        onErreur={onErreur}
      />
    </div>
  )
}

/**
 * **Écrire un nom crée la chose**, sur-le-champ, sans formulaire et sans un
 * centime.
 *
 * Entrée suffit, et le champ le dit à côté de lui — un bouton *Ajouter* aurait
 * fait deux gestes pour un, et laissé croire qu'il y a un formulaire derrière.
 * Créer une chose du jeu ne lance aucune génération : c'est une déclaration, et
 * c'est ce qui permet à Balthazar d'exister avant d'avoir la moindre image.
 */
function ChampQuiNomme({
  auMilieu,
  allumer,
  famille,
  onCree,
  onErreur,
}: {
  auMilieu: boolean
  /** **Allumé en sortant de l'assistant** (E19). Il change de valeur à chaque
   *  sortie ; l'ignorer à zéro évite de voler le curseur à l'ouverture
   *  ordinaire du codex, où personne n'a demandé à nommer. */
  allumer: number
  /** **La chose naît dans la famille allumée** (E15). C'est le type qui la
   *  porte, et c'est le serveur qui le pose : l'écran dit où l'on tape, il
   *  n'invente pas de type. */
  famille: string
  onCree: (personnage: Personnage) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")
  const champ = useRef<HTMLInputElement>(null)

  // **Après tout le monde, et c'est voulu.** La barre qui paie monte dans la
  // même passe et prend le curseur sans condition — c'est le geste de l'atelier,
  // et il a raison partout ailleurs. Ici le geste demandé est de *nommer* : on
  // le réclame donc à la frame suivante, quand chacun a fini de se monter.
  useEffect(() => {
    if (allumer <= 0) return
    const trame = requestAnimationFrame(() => champ.current?.focus())
    return () => cancelAnimationFrame(trame)
  }, [allumer])

  const creer = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      const { personnage } = await api.creerPersonnage(propre, "", famille)
      setNom("")
      onCree(personnage)
    } catch (erreur) {
      onErreur(erreur, "personnage refusé")
    }
  }

  return (
    <div
      className={[
        "flex shrink-0 items-center gap-2",
        auMilieu ? "w-[380px]" : "w-full",
      ].join(" ")}
    >
      <input
        ref={champ}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void creer()
        }}
        placeholder={PLACEHOLDER_DE_LA_FAMILLE[famille] ?? "nommer une chose du jeu"}
        aria-label="Nom de la chose du jeu à créer"
        className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
      />
      <span className="mesure shrink-0 text-[10px] text-texte-3">Entrée le crée</span>
    </div>
  )
}

/** Une chose du jeu, dans la liste de sa famille.
 *
 *  **Le compte qu'elle porte est celui de ce qui lui manque** — pas de ce
 *  qu'elle tient. C'est la question qu'on vient poser au codex, et le produit
 *  n'a aucune couleur d'alerte pour un manque : le vert dit *complet*, son
 *  absence dit *pas encore*. */
function CarteDeLaChose({
  personnage,
  plan,
  pieces,
  ambiances,
  choisie,
  onChoisir,
  onOuvrir,
}: {
  personnage: Personnage
  plan: Pose[]
  pieces: Piece[]
  choisie: boolean
  onChoisir: () => void
  onOuvrir: () => void
  /** Les ambiances du jeu, pour nommer celle que cette chose porte. Passées
   *  plutôt que redemandées ici : une carte par chose ferait autant d'appels
   *  qu'il y a de choses. */
  ambiances: AmbianceDuJeu[]
}) {
  const restant = manque(personnage, plan, pieces)
  const premiere = personnage.cases.flatMap((c) => c.images)[0]
  const visee = useVisee(premiere ? sujetAsset(premiere) : null)

  return (
    <article
      onClick={onChoisir}
      className={[
        "flex shrink-0 cursor-pointer items-center gap-3 rounded-[2px] border p-2 transition-colors duration-[80ms]",
        choisie ? "border-lumiere bg-fond-2" : "border-bord hover:bg-fond-1",
      ].join(" ")}
    >
      {premiere ? (
        <img
          src={sujetAsset(premiere).src}
          alt={personnage.nom}
          onPointerEnter={visee.entrer}
          onPointerLeave={visee.sortir}
          className="damier h-[44px] w-[44px] shrink-0 object-contain"
        />
      ) : (
        // Une chose sans image n'en invente pas une : la case est vide, et
        // c'est exactement ce que le codex vient dire.
        <span
          aria-hidden
          className="h-[44px] w-[44px] shrink-0 rounded-[2px] border border-bord bg-fond-2"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={(evenement) => {
            evenement.stopPropagation()
            onOuvrir()
          }}
          className="truncate text-left text-[13px] text-texte hover:text-signal"
        >
          {personnage.nom}
        </button>
        <span className="mesure truncate text-[10px] text-texte-3">
          {personnage.description || "sans signalement"}
        </span>
      </div>

      {/* **Son ambiance, lue ici** (E11) — le second endroit où l'on répond à
          « qui utilise quoi ». Le panneau d'une ambiance dit qui s'en sert ; le
          codex dit, chose par chose, laquelle chacune porte, et **les trous se
          voient** : c'est déjà l'endroit où la liste de tout le jeu s'affiche,
          et aucun écran dense de plus n'est nécessaire.

          Ce qui n'en a pas ne se grise pas : « aucune » n'est pas un manque, et
          la marque est absente plutôt que barrée — une chose sans ambiance
          prend le style du jeu, ce qui est le cas courant. */}
      {personnage.ambiance && (
        <span
          title="son ambiance — elle se change sur sa fiche"
          className="mesure shrink-0 truncate rounded-[2px] border border-bord px-1.5 text-[9.5px] text-texte-3"
        >
          {nomDAmbiance(ambiances, personnage.ambiance)}
        </span>
      )}

      <span className="mesure shrink-0 text-right text-[10px]">
        {restant === 0 ? (
          <span className="text-ok">rien ne manque</span>
        ) : (
          <span className="text-texte-2">
            {restant} case{restant > 1 ? "s" : ""} manquante{restant > 1 ? "s" : ""}
          </span>
        )}
      </span>
    </article>
  )
}

/** Le nom d'une ambiance, ou son identifiant quand elle vient de partir : une
 *  chose qui désigne une ambiance supprimée est déjà retombée sur le jeu côté
 *  serveur, et cet écart ne dure que le temps d'un rendu. */
const nomDAmbiance = (ambiances: AmbianceDuJeu[], identifiant: string) =>
  ambiances.find((a) => a.identifiant === identifiant)?.nom ?? identifiant

// ── La colonne de droite : la chose choisie ─────────────────────────────────

function FicheDeLaChose({
  personnage,
  ambiances,
  plan,
  pieces,
  onOuvrir,
  onFabriquerCeQuiManque,
  onFermer,
}: {
  personnage: Personnage | null
  ambiances: AmbianceDuJeu[]
  plan: Pose[]
  pieces: Piece[]
  onOuvrir: (identifiant: string) => void
  onFabriquerCeQuiManque: (personnage: Personnage, poses: Pose[]) => void
  onFermer: () => void
}) {
  if (!personnage)
    return (
      <aside {...PANNEAU} className="flex min-h-0 flex-col border-l border-bord bg-fond-1">
        <EnTetePanneau>La chose choisie</EnTetePanneau>
        <p className="mesure p-2 text-[10px] leading-4 text-texte-3">
          choisis une chose du jeu — ce qu'elle réclame, ce qui lui manque et ce
          que ça coûtera se lisent ici. Son nom ouvre son établi.
        </p>
      </aside>
    )

  // **Ce que cette chose-là réclame** (E9, appliqué ici en E15) : un décor n'a
  // pas de poses, et lui montrer celles du jeu lui promettait douze cases
  // qu'aucun écran ne sait remplir.
  const reclame = personnage.plan ?? plan
  const tenues = posesTenues(reclame, personnage)
  const restant = manque(personnage, plan, pieces)
  /** Les poses dont le corps manque — c'est ce qu'un seul geste peut lancer.
   *  L'équipement, lui, se lance pièce par pièce : un calque est solidaire de
   *  la pose sur laquelle il est apparu, et le grouper avec des corps ferait un
   *  appel qui demande deux choses différentes. */
  const manquantes = tenues.filter((pose) => {
    const case_ = personnage.cases.find((c) => c.pose === pose.identifiant)
    return (case_?.images.length ?? 0) < pose.images
  })
  const images = manquantes.reduce(
    (somme, pose) =>
      somme +
      (pose.images -
        (personnage.cases.find((c) => c.pose === pose.identifiant)?.images.length ?? 0)),
    0,
  )

  return (
    <aside {...PANNEAU} className="flex min-h-0 flex-col border-l border-bord bg-fond-1">
      <EnTetePanneau>
        {personnage.nom}
        <button
          type="button"
          onClick={onFermer}
          aria-label="Ne plus regarder cette chose"
          className="ml-auto px-1 text-[12px] text-texte-3 hover:text-texte"
        >
          ×
        </button>
      </EnTetePanneau>

      <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        <section className="flex flex-col">
          <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Ce qu'elle réclame
          </p>
          {/* **Le nom du type, pas « personnage »** (E15) : cette ligne le
              disait en dur, ce qui était vrai tant que seuls des personnages
              existaient. Une chose sans type suit le plan du jeu, et la ligne
              le dit ainsi. */}
          <Ligne
            nom={
              reclame.length === 0
                ? `un ${personnage.type || "personnage"} n'a pas de poses`
                : `poses du type ${personnage.type || "personnage"}`
            }
            valeur={
              reclame.length === 0 ? "—" : `${tenues.length} sur ${reclame.length}`
            }
            complet={reclame.length > 0 && tenues.length === reclame.length}
          />
          {/* **Ce qu'une famille ne peut pas avoir n'est pas dessiné** : un
              décor n'a pas de vestiaire, et une ligne « 0 sur 2 » lui aurait
              promis un équipement qu'aucun écran ne sait lui poser. */}
          {personnage.equipable && pieces.length > 0 && (
            <Ligne
              nom="pièces d'équipement"
              valeur={`${pieces.length} sur ${pieces.length}`}
              complet
            />
          )}
        </section>

        <section className="flex flex-col">
          <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Son ambiance
          </p>
          {/* **Elles ont leur écran depuis E11** : cette ligne disait le
              contraire, et c'est le genre de phrase qui survit à ce qu'elle
              décrivait. Une chose sans ambiance retombe sur le jeu, et ce n'est
              pas un manque — c'est l'état ordinaire. */}
          <p className="mesure text-[10px] leading-4 text-texte-3">
            {personnage.ambiance
              ? (ambiances.find((a) => a.identifiant === personnage.ambiance)?.nom ??
                personnage.ambiance)
              : "aucune — elle suit le style du jeu"}
          </p>
        </section>

        <section className="flex flex-col">
          <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Ce qui manque
          </p>
          {tenues.length === 0 && (
            <p className="mesure text-[10px] leading-4 text-texte-3">
              Rien : cette chose ne réclame aucune attitude.
            </p>
          )}
          {tenues.map((pose) => {
            const case_ = personnage.cases.find((c) => c.pose === pose.identifiant)
            // **Le produit des deux** (E10) : `demandees` vaut déjà *tant
            // d'images dans tant de directions*, et le compte ne remonte pas la
            // multiplication à l'écran.
            const faites = faitesDeLaCase(case_)
            const demandees = case_?.demandees ?? pose.images
            return (
              <Ligne
                key={pose.identifiant}
                nom={pose.nom}
                valeur={`${faites} / ${demandees}`}
                complet={faites >= demandees}
              />
            )
          })}
        </section>

        {/* **Ce que ça va coûter se dit avant de payer, pas après.** Le
            geste annonce trois choses d'un coup : combien d'images, comment
            elles se groupent, et ce que le prix vaudra — plus ce qu'un compte
            faux coûterait, qui se lit au pied de la barre qui paie une fois le
            lot armé. Rien ne part de ce bouton : il **arme**. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-bord pt-2">
          {manquantes.length > 0 && (
            <p className="mesure text-[10px] leading-4 text-texte-3">
              {images} image{images > 1 ? "s" : ""} · {manquantes.length} planche
              {manquantes.length > 1 ? "s" : ""}, une par pose
            </p>
          )}
          <p className="mesure text-[10px] text-texte-3">
            {restant === 0
              ? "rien ne manque à cette chose"
              : `${restant} case${restant > 1 ? "s" : ""} à fabriquer`}
          </p>
          <Bouton
            inactif={manquantes.length === 0}
            onClick={() => onFabriquerCeQuiManque(personnage, manquantes)}
            enfants="Fabriquer ce qui manque"
          />
          <Raison
            texte={
              manquantes.length === 0
                ? "rien ne manque au corps de cette chose"
                : null
            }
          />
          <Bouton
            onClick={() => onOuvrir(personnage.identifiant)}
            enfants="Ouvrir son établi"
          />
        </div>
      </div>
    </aside>
  )
}

function Ligne({
  nom,
  valeur,
  complet,
}: {
  nom: string
  valeur: string
  complet: boolean
}) {
  return (
    <p className="mesure flex h-[26px] items-center gap-2 text-[10px]">
      <span className="min-w-0 flex-1 truncate text-texte-3">{nom}</span>
      {/* **Le manque n'a pas de couleur** : le vert dit *complet*, son absence
          dit *pas encore*. Aucune alerte, aucun message qui réclame. */}
      <span className={complet ? "text-ok" : "text-texte-2"}>{valeur}</span>
    </p>
  )
}

// ── Les directions du jeu (E10) ─────────────────────────────────────────────

/**
 * Ce que le jeu réclame de tout le monde : les angles sous lesquels il regarde.
 *
 * **La liste vient de la vue du jeu, et c'est une proposition.** Elle se
 * renomme, se retire et se complète ici ; dès qu'on y touche elle cesse de
 * suivre la vue, et le panneau le dit — ce ne sont pas la même promesse, et un
 * changement de vue qui effacerait des noms choisis à la main serait une perte
 * silencieuse.
 *
 * **Deux textes par direction, et un seul part** : le nom se lit, la consigne
 * part au modèle. Écrite ici une fois, elle n'est plus recopiée sur six poses —
 * et la corriger se fait une fois au lieu de six.
 */
function LesDirections({
  directions,
  onDirections,
  onErreur,
}: {
  directions: DirectionsDuJeu
  onDirections: (directions: DirectionsDuJeu) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")
  const [proposition, setProposition] = useState<PropositionDeBaisse | null>(null)

  // La proposition de baisse se redemande dès que la liste bouge : déclarer une
  // direction de plus change ce qu'elle propose, et une phrase périmée
  // proposerait de ramener des poses qui ne le demandent plus.
  useEffect(() => {
    let vivant = true
    void api
      .propositionDeBaisse()
      .then((recue) => vivant && setProposition(recue))
      .catch(() => vivant && setProposition(null))
    return () => {
      vivant = false
    }
  }, [directions])

  const ajouter = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      onDirections(await api.ajouterDirection(propre))
      setNom("")
    } catch (erreur) {
      onErreur(erreur, "direction refusée")
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>Les directions du jeu</Libelle>

      {/* **D'où la liste vient**, et ce que ça engage. Le revers de la règle du
          grisé : ce qui est devinable est prérempli avec sa provenance. */}
      <p className="mesure text-[10px] leading-4 text-texte-3">
        {directions.origine === "vue" ? (
          directions.vue_libelle ? (
            <>
              {directions.directions.length} direction
              {directions.directions.length > 1 ? "s" : ""} <b>lues</b> dans la
              vue du jeu « {directions.vue_libelle} », réglée dans l'Univers.
              Elles suivront un changement de vue tant qu'on n'y touche pas.
            </>
          ) : (
            <>
              Ce jeu n'a pas déclaré sa vue : il n'a donc aucune direction, et le
              mot ne paraît nulle part. La vue se choisit dans l'onglet Univers.
            </>
          )
        ) : (
          <>
            {directions.directions.length} direction
            {directions.directions.length > 1 ? "s" : ""} <b>écrites ici</b> :
            la liste ne suit plus la vue du jeu. Les images faites gardent leur
            direction, quoi qu'on renomme.
          </>
        )}
      </p>

      {directions.directions.length > 0 && (
        <ul className="flex flex-col">
          {directions.directions.map((direction) => (
            <LigneDirection
              key={direction.identifiant}
              direction={direction}
              onDirections={onDirections}
              onErreur={onErreur}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ajouter()
          }}
          placeholder="nommer une direction"
          aria-label="Nom de la direction à ajouter"
          className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          inactif={!nom.trim()}
          onClick={() => void ajouter()}
          enfants="Ajouter"
        />
      </div>

      {/* **Revenir à ce que la vue propose** — le clic qui défait. Sans lui, une
          liste retouchée ne pourrait jamais y revenir : il faudrait la retaper
          de mémoire, et la moindre faute de frappe ferait une colonne
          orpheline. */}
      {directions.origine === "ici" && directions.proposees.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            try {
              onDirections(await api.oublierLesDirections())
            } catch (erreur) {
              onErreur(erreur, "retour refusé")
            }
          }}
          className="mesure self-start px-1 text-[10px] text-signal hover:text-signal-clair"
        >
          revenir à ce que la vue propose —{" "}
          {directions.proposees.map((d) => d.nom).join(" · ")} ›
        </button>
      )}

      {proposition && <PropositionDeBaisseLigne
        proposition={proposition}
        onFait={setProposition}
        onErreur={onErreur}
      />}
    </section>
  )
}

/** Une direction : son nom, ce qu'elle dit au modèle, et le geste qui la retire.
 *
 *  **L'identifiant ne bouge pas quand le nom change**, ce qui laisse leur case
 *  aux images déjà faites — exactement comme pour une attitude. */
function LigneDirection({
  direction,
  onDirections,
  onErreur,
}: {
  direction: Direction
  onDirections: (directions: DirectionsDuJeu) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(direction.nom)
  const [consigne, setConsigne] = useState(direction.consigne)

  useEffect(() => setNom(direction.nom), [direction.nom])
  useEffect(() => setConsigne(direction.consigne), [direction.consigne])

  const poser = async (champs: { nom?: string; consigne?: string }) => {
    try {
      onDirections(await api.reglerDirection(direction.identifiant, champs))
    } catch (erreur) {
      setNom(direction.nom)
      setConsigne(direction.consigne)
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <li className="flex h-[26px] items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => {
          const propre = nom.trim()
          if (!propre || propre === direction.nom) return setNom(direction.nom)
          void poser({ nom: propre })
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        aria-label={`Nom de la direction ${direction.nom}`}
        className="mesure h-[24px] w-[110px] shrink-0 rounded-[2px] border border-transparent bg-transparent px-1 text-[11px] text-texte-2 hover:border-bord focus:border-bord-fort focus:bg-fond-2"
      />
      <input
        value={consigne}
        onChange={(e) => setConsigne(e.target.value)}
        onBlur={() => {
          if (consigne.trim() === direction.consigne) return
          void poser({ consigne: consigne.trim() })
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        placeholder="ce qui part au modèle, en anglais"
        aria-label={`Ce que « ${direction.nom} » dit au modèle`}
        title="écrit une fois ici, jamais recopié sur les attitudes — le corriger se fait une seule fois"
        className="champ h-[24px] min-w-0 flex-1 rounded-[2px] border border-transparent bg-transparent px-1 text-[11px] text-texte-3 hover:border-bord focus:border-bord-fort focus:bg-fond-2 focus:text-texte-2"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            onDirections(await api.retirerDirection(direction.identifiant))
          } catch (erreur) {
            onErreur(erreur, "retrait refusé")
          }
        }}
        aria-label={`Retirer la direction ${direction.nom}`}
        title="les images déjà faites restent, avec son identifiant"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
      >
        ×
      </button>
    </li>
  )
}

/** La proposition de ramener à une image les poses qui comptaient les
 *  directions (US-243).
 *
 *  **Sans elle, déclarer quatre directions ferait passer un personnage de douze
 *  cases à quarante-huit d'un coup**, et l'auteur découvrirait trente-six
 *  manques qu'il n'a pas demandés. Elle dit sa raison, montre les deux chiffres,
 *  et se défait d'un clic — le produit propose, il ne décide pas. */
function PropositionDeBaisseLigne({
  proposition,
  onFait,
  onErreur,
}: {
  proposition: PropositionDeBaisse
  onFait: (proposition: PropositionDeBaisse) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  if (proposition.defaite.length > 0)
    return (
      <p className="mesure flex flex-wrap items-baseline gap-x-2 border-t border-bord pt-2 text-[10px] leading-4 text-texte-3">
        <span>
          {proposition.defaite.map((p) => `« ${p.nom} »`).join(", ")}{" "}
          {proposition.defaite.length > 1 ? "sont ramenées" : "est ramenée"} à
          une image par direction.
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              onFait(await api.defaireLaBaisse())
            } catch (erreur) {
              onErreur(erreur, "retour refusé")
            }
          }}
          className="text-signal hover:text-signal-clair"
        >
          rendre {proposition.defaite.map((p) => p.images_avant).join(" et ")} ›
        </button>
      </p>
    )

  if (proposition.poses.length === 0) return null

  return (
    <p className="mesure flex flex-wrap items-baseline gap-x-2 border-t border-bord pt-2 text-[10px] leading-4 text-texte-3">
      <span>{proposition.raison}</span>
      <span className="text-texte-3">
        {proposition.cases_avant} cases → {proposition.cases_apres}
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            onFait(await api.baisserLesImages())
          } catch (erreur) {
            onErreur(erreur, "proposition refusée")
          }
        }}
        className="text-signal hover:text-signal-clair"
      >
        ramener à une image ›
      </button>
    </p>
  )
}

