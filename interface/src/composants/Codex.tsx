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

import { useEffect, useState } from "react"
import {
  api,
  type EmplacementCorps,
  type AmbianceDuJeu,
  type Personnage,
  type Piece,
  type Pose,
  type Vestiaire,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { Bouton, EnTetePanneau, Raison } from "./chassis"
import { PANNEAU } from "./Infobulle"
import { EcranVitrine } from "./Vitrine"
import { PlanDuJeu, Vestiaire as PanneauVestiaire, posesTenues } from "./Personnages"

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
const FAMILLES = [
  { cle: "personnages", nom: "Personnages" },
  { cle: "decors", nom: "Décors" },
  { cle: "objets", nom: "Objets" },
  { cle: "interface", nom: "Interface" },
  { cle: "equipement", nom: "Équipement" },
] as const

type Rubrique = (typeof FAMILLES)[number]["cle"] | "directions" | "poses"

export function EcranCodex({
  plan,
  personnages,
  emplacements,
  pieces,
  choisi,
  onChoisir,
  onOuvrir,
  onPersonnage,
  onPlan,
  onVestiaire,
  onArmer,
  replies,
  barreQuiPaie,
  onErreur,
}: {
  plan: Pose[]
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
  onVestiaire: (vestiaire: Vestiaire) => void
  /** Armer ce qui manque à une chose : le même geste que la matrice, vu du
   *  codex. Rien ne part — la barre qui paie annonce le prix, et c'est elle
   *  qu'on clique ensuite. */
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  replies: { familles: boolean; fiche: boolean }
  barreQuiPaie: React.ReactNode
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [rubrique, setRubrique] = useState<Rubrique>("personnages")
  // **Le cinquième verbe du codex : il montre** (E16). Il rangeait, déclarait,
  // comptait, lançait — et aucun de ces quatre ne peut voir à quoi ressemble ce
  // qui est rangé. La vitrine ouverte d'ici montre le monde entier, une image
  // par chose : trois nains côte à côte disent tout de suite s'ils viennent du
  // même monde.
  const [vitrineOuverte, setVitrineOuverte] = useState(false)

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
            rubrique={rubrique}
            onRubrique={setRubrique}
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
            <PasEncore
              titre="Les directions se lisent dans la vue du jeu."
              raison="La vue du jeu se règle dans l'onglet Univers, et les directions s'en déduisent. Ni l'une ni l'autre n'existent encore : ce qui les tiendra est une étape plus loin."
            />
          ) : rubrique === "personnages" ? (
            <ListeDesChoses
              personnages={personnages}
              plan={plan}
              pieces={pieces}
              choisi={choisi}
              onChoisir={onChoisir}
              onOuvrir={onOuvrir}
              onPersonnage={onPersonnage}
              onVitrine={() => setVitrineOuverte(true)}
              onErreur={onErreur}
            />
          ) : (
            <PasEncore
              titre={`Rien dans ${FAMILLES.find((f) => f.cle === rubrique)?.nom.toLowerCase()}.`}
              raison="Seuls les personnages sont des choses du jeu de plein droit pour l'instant. Les trois autres familles en deviendront, avec leur compte de ce qui leur manque."
            />
          )}
          {barreQuiPaie}
        </div>

        <div className="flex min-h-0 overflow-hidden">
          <FicheDeLaChose
            personnage={ouvert}
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
  rubrique,
  onRubrique,
}: {
  personnages: Personnage[]
  pieces: Piece[]
  plan: Pose[]
  rubrique: Rubrique
  onRubrique: (rubrique: Rubrique) => void
}) {
  const combien: Record<string, number> = {
    personnages: personnages.length,
    decors: 0,
    objets: 0,
    interface: 0,
    equipement: pieces.length,
  }
  const incomplets = personnages.filter((p) => manque(p, plan, pieces) > 0).length

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
        <Rangee
          nom="Les directions"
          valeur="pas encore"
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
        {personnages.length} personnage{personnages.length > 1 ? "s" : ""}
        {personnages.length > 0 && ` · ${incomplets} incomplet${incomplets > 1 ? "s" : ""}`}
        <br />0 décor, 0 objet, 0 élément d'interface
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
  const tenues = posesTenues(plan, personnage)
  const corps = tenues.reduce((somme, pose) => {
    const case_ = personnage.cases.find((c) => c.pose === pose.identifiant)
    return somme + Math.max(0, pose.images - (case_?.images.length ?? 0))
  }, 0)
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
  personnages,
  plan,
  pieces,
  choisi,
  onChoisir,
  onOuvrir,
  onPersonnage,
  onVitrine,
  onErreur,
}: {
  personnages: Personnage[]
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
  // **Les ambiances du jeu, demandées une fois pour toute la liste** (E11) :
  // une par carte aurait fait autant d'appels qu'il y a de choses. Elles ne
  // servent qu'à nommer — la désignation, elle, se fait sur la fiche.
  const [ambiances, setAmbiances] = useState<AmbianceDuJeu[]>([])

  useEffect(() => {
    void api
      .coteAmbiances()
      .then((recu) => setAmbiances(recu?.ambiances ?? []))
      .catch(() => setAmbiances([]))
  }, [])
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
          Ce jeu n'a encore personne.{" "}
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
  onCree,
  onErreur,
}: {
  auMilieu: boolean
  onCree: (personnage: Personnage) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")

  const creer = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      const { personnage } = await api.creerPersonnage(propre)
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
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void creer()
        }}
        placeholder="nommer une chose du jeu"
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
  plan,
  pieces,
  onOuvrir,
  onFabriquerCeQuiManque,
  onFermer,
}: {
  personnage: Personnage | null
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

  const tenues = posesTenues(plan, personnage)
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
          <Ligne
            nom="poses du type personnage"
            valeur={`${tenues.length} sur ${plan.length}`}
            complet={tenues.length === plan.length}
          />
          <Ligne
            nom="pièces d'équipement"
            valeur={`${pieces.length} sur ${pieces.length}`}
            complet
          />
        </section>

        <section className="flex flex-col">
          <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Son ambiance
          </p>
          <Raison texte="les ambiances n'ont pas encore d'écran où vivre" />
        </section>

        <section className="flex flex-col">
          <p className="mesure mb-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Ce qui manque
          </p>
          {tenues.map((pose) => {
            const case_ = personnage.cases.find((c) => c.pose === pose.identifiant)
            const faites = case_?.images.length ?? 0
            return (
              <Ligne
                key={pose.identifiant}
                nom={pose.nom}
                valeur={`${faites} / ${pose.images}`}
                complet={faites >= pose.images}
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

/** Ce qui n'existe pas encore — **avec sa raison, et à sa place**. Le produit
 *  n'a pas le droit de cacher ce qui existera : une rubrique qui apparaîtrait
 *  le jour où elle se remplit serait une surprise au moment précis où l'on
 *  cherche à savoir ce que le monde contient. */
function PasEncore({ titre, raison }: { titre: string; raison: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-[504px] flex-col items-center gap-3 text-center">
        <p className="font-serif text-[32px] leading-tight text-texte-3">{titre}</p>
        <p className="mesure text-[10px] leading-relaxed text-texte-3">{raison}</p>
      </div>
    </div>
  )
}
