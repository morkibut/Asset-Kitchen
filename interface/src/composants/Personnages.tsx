// L'écran Personnages — qui il y a dans ce jeu, ce que chacun réclame, et ce
// qui manque.
//
// « Savoir d'un coup d'œil ce qui est fait et ce qui ne l'est pas, afin de
// savoir quoi lancer sans tenir la liste dans ma tête » (US-119). C'est la
// contrepartie de l'Atelier, une fois de plus : l'Atelier fabrique une image,
// celui-ci dit **combien il en manque**.
//
// **Deux colonnes, `380px · 1fr`** — les personnages et le plan à gauche, les
// cases à droite (`docs/DESIGN.md` § Layout). Aucune largeur nouvelle : la 380
// est celle de la fiche asset et de l'écran Univers, réemployée pour ce qu'elle
// nomme déjà, la colonne de ce qu'on manipule.
//
// **Ce n'est pas une grille d'assets, et c'est ce qui préserve l'invariant** :
// ni recherche, ni filtres, ni sélection multiple (`docs/PLAN.md` C1). La
// réserve de T8 avait tenu la même règle par le même moyen — une privation
// assumée, pas un manque à combler.
//
// **C2 y ajoute une case à cocher, et elle ne rompt pas cet invariant** — ce qui
// se coche est une **attitude**, c'est-à-dire une ligne du plan du jeu, jamais
// une image. On ne sélectionne toujours aucun asset ici : les vignettes d'une
// case ne se cochent pas, ne se glissent pas, ne se comptent pas. La différence
// n'est pas un détail de vocabulaire — c'est elle qui empêche cet écran de
// redevenir une seconde planche contact, et le jour où l'on cochera une image,
// l'invariant sera tombé.
//
// **Il couvre l'atelier, donc il porte sa propre fente de refus** : une raison
// envoyée derrière lui serait invisible au moment précis où elle compte.

import { useEffect, useRef, useState } from "react"
import { api, type Case, type Personnage, type Pose } from "../api"
import { sujetAsset } from "./Apercu"
import { Bouton, EnTetePanneau, Libelle } from "./chassis"

/** Les poses qu'un personnage tient, dans l'ordre du plan.
 *
 *  **Déduit, jamais reçu.** Le disque garde ce que le personnage *écarte* : une
 *  liste de tenues envoyée avec lui serait périmée dès la pose suivante ajoutée
 *  au plan, puisqu'un ajout n'écrit — et donc n'annonce — aucun personnage.
 *  C'est la même règle que les îlots du tableau, qui se lisent sur les cartes.
 */
export const posesTenues = (plan: Pose[], personnage: Personnage): Pose[] =>
  plan.filter((p) => !personnage.ecartees.includes(p.identifiant))

export function EcranPersonnages({
  projet,
  plan,
  personnages,
  onPersonnage,
  onPlan,
  onArmer,
  onFermer,
}: {
  projet: { identifiant: string; nom: string } | null
  /** Le plan du jeu et ses personnages, tenus par `App` — comme le tableau.
   *  **Un seul endroit écoute le flux**, pour toute la vie de l'onglet. */
  plan: Pose[]
  personnages: Personnage[]
  /** **Ce que l'appel vient de rendre, posé par le même chemin que le flux.**
   *  Les deux se croisent — le serveur annonce avant que l'appel ne revienne —,
   *  et c'est la fonte par identifiant qui les tient (`docs/PIEGES.md`).
   *  L'écran ne garde donc aucune copie à lui : il écrit, et il reçoit. */
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onPlan: (plan: Pose[]) => void
  /** **La matrice arme, l'atelier tire.** Cliquer une case vide ne dépense
   *  rien : ça remplit le prompt de l'atelier avec le signalement du
   *  personnage et le nom de l'attitude, ça retient la case visée, et ça rend
   *  la main. C'est le bouton Générer de l'atelier qui paie — « le corps naît
   *  dans l'atelier et nulle part ailleurs » reste vrai au pied de la lettre,
   *  et il n'existe qu'un seul endroit d'où l'on paie.
   *
   *  **Une attitude, ou N depuis C2** (US-128). Le geste est le même — armer —,
   *  et c'est le compte qui décide si l'appel se plie. En faire deux gestes
   *  aurait donné deux façons de dire la même intention, qui se seraient
   *  contredites au premier désarmement. */
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  onFermer: () => void
}) {
  const [choisi, setChoisir] = useState<string | null>(null)
  const [refus, setRefus] = useState<string>("")

  // Le personnage ouvert **est** la sélection quand elle vaut un : deux états
  // pour la même chose se sont déjà contredits une fois dans ce produit, et le
  // second clic effaçait le premier (`docs/PIEGES.md`).
  const ouvert =
    personnages.find((p) => p.identifiant === choisi) ?? personnages[0] ?? null

  const echouer = (erreur: unknown, defaut: string) =>
    setRefus(erreur instanceof Error ? erreur.message : defaut)

  return (
    // `data-univers` marque ce que cet écran couvre, comme l'écran Univers : un
    // garde de saisie doit pouvoir distinguer un champ qu'on écrit **ici** du
    // champ de prompt de l'atelier, resté focalisé derrière depuis le démarrage.
    <div data-univers className="fixed inset-0 z-10 flex flex-col bg-fond-0">
      <header className="flex h-[44px] shrink-0 items-center gap-4 border-b border-bord bg-fond-1 px-4">
        <h1 className="font-serif text-[17px] leading-none text-texte">Personnages</h1>
        <span className="mesure text-[10px] text-texte-2">
          {projet ? projet.nom : "sans projet"}
        </span>
        {personnages.length === 0 && (
          <span className="mesure text-[10px] text-texte-3">
            aucun personnage — le plan du jeu, lui, est déjà là
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {refus && (
            <span className="mesure flex items-center gap-1.5 text-[10px] text-echec">
              <span aria-hidden className="inline-block h-px w-2 bg-echec" />
              {refus}
            </span>
          )}
          <Bouton onClick={onFermer} enfants="Retour à l'atelier" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <PanneauGauche
          plan={plan}
          personnages={personnages}
          choisi={ouvert?.identifiant ?? null}
          onChoisir={setChoisir}
          onPersonnage={onPersonnage}
          onPlan={onPlan}
          onErreur={echouer}
        />
        <Fiche
          plan={plan}
          personnage={ouvert}
          onPersonnage={onPersonnage}
          onArmer={onArmer}
          onErreur={echouer}
        />
      </div>
    </div>
  )
}

// ── La colonne de gauche — qui il y a, et ce que le jeu réclame ──────────────

function PanneauGauche({
  plan,
  personnages,
  choisi,
  onChoisir,
  onPersonnage,
  onPlan,
  onErreur,
}: {
  plan: Pose[]
  personnages: Personnage[]
  choisi: string | null
  onChoisir: (identifiant: string) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onPlan: (plan: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  return (
    <aside className="flex min-h-0 w-[380px] shrink-0 flex-col border-r border-bord bg-fond-1">
      <EnTetePanneau>Le jeu</EnTetePanneau>
      <div className="defile flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-2">
        <ListePersonnages
          personnages={personnages}
          plan={plan}
          choisi={choisi}
          onChoisir={onChoisir}
          onPersonnage={onPersonnage}
          onErreur={onErreur}
        />
        <PlanDuJeu plan={plan} onPlan={onPlan} onErreur={onErreur} />
      </div>
    </aside>
  )
}

/** Les personnages du projet, et le geste qui en ajoute un.
 *
 *  **Une liste, pas une grille** : pas de vignette, pas de sélection multiple,
 *  pas de recherche. Un jeu a des personnages, pas des centaines. */
function ListePersonnages({
  personnages,
  plan,
  choisi,
  onChoisir,
  onPersonnage,
  onErreur,
}: {
  personnages: Personnage[]
  plan: Pose[]
  choisi: string | null
  onChoisir: (identifiant: string) => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")

  const creer = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      const { personnage } = await api.creerPersonnage(propre)
      setNom("")
      onPersonnage(personnage)
      onChoisir(personnage.identifiant)
    } catch (erreur) {
      onErreur(erreur, "personnage refusé")
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>Personnages</Libelle>

      {personnages.length === 0 ? (
        // Une rubrique vide **dit ce qu'elle fera**, elle ne montre pas un
        // cadre mort : c'est le reproche qui a fait écarter la maquette.
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Un personnage est un nom, une description, et les attitudes qu'il
          réclame. Son corps, lui, naît dans l'atelier — on écrit un sujet, on
          génère, et c'est l'image obtenue qu'on désigne.
        </p>
      ) : (
        <ul className="flex flex-col">
          {personnages.map((personnage) => {
            const tenues = posesTenues(plan, personnage).length
            return (
              <li key={personnage.identifiant}>
                <button
                  type="button"
                  onClick={() => onChoisir(personnage.identifiant)}
                  aria-pressed={personnage.identifiant === choisi}
                  className={[
                    "flex h-[26px] w-full items-center gap-2 rounded-[2px] px-1 text-left transition-colors duration-[80ms]",
                    personnage.identifiant === choisi
                      ? "bg-fond-3 text-texte"
                      : "text-texte-2 hover:bg-fond-2",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1 truncate text-[11.5px]">
                    {personnage.nom}
                  </span>
                  <span className="mesure shrink-0 text-[9.5px] text-texte-3">
                    {tenues} pose{tenues > 1 ? "s" : ""}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void creer()
          }}
          placeholder="nommer un personnage"
          aria-label="Nom du personnage à créer"
          className="mesure h-8 min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          inactif={!nom.trim()}
          onClick={() => void creer()}
          enfants="Ajouter un personnage"
        />
      </div>
    </section>
  )
}

/** Le plan du jeu — la liste des attitudes que chaque personnage se voit
 *  proposer (US-116, US-118).
 *
 *  **Nommer, c'est créer** : écrire un nom qui n'existe pas encore l'ajoute
 *  sur-le-champ, sans écran de gestion. Et l'ajout ne lance **aucune
 *  génération** — il ajoute une case vide chez chacun, ce qui ne coûte rien. */
function PlanDuJeu({
  plan,
  onPlan,
  onErreur,
}: {
  plan: Pose[]
  onPlan: (plan: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState("")

  const ajouter = async () => {
    const propre = nom.trim()
    if (!propre) return
    try {
      onPlan((await api.ajouterPose(propre)).plan)
      setNom("")
    } catch (erreur) {
      onErreur(erreur, "attitude refusée")
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <Libelle>Les attitudes du jeu</Libelle>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        Écrite une fois pour le jeu entier — c'est elle qui permet de comparer
        deux personnages ligne à ligne. Ajouter une attitude ajoute une case
        vide à chacun, jamais une génération.
      </p>

      {plan.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Le plan est vide : aucun personnage n'a de case à remplir.
        </p>
      ) : (
        <ul className="flex flex-col">
          {plan.map((pose) => (
            <LignePose
              key={pose.identifiant}
              pose={pose}
              onPlan={onPlan}
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
          placeholder="nommer une attitude"
          aria-label="Nom de l'attitude à ajouter"
          className="mesure h-8 min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          inactif={!nom.trim()}
          onClick={() => void ajouter()}
          enfants="Ajouter une attitude"
        />
      </div>
    </section>
  )
}

/** Une attitude du plan : son nom, ce qu'elle demande, et son retrait.
 *
 *  Le nom se corrige **en place** — l'identifiant, lui, ne bouge pas, et c'est
 *  ce qui laisse leur case aux images déjà faites (US-118). */
function LignePose({
  pose,
  onPlan,
  onErreur,
}: {
  pose: Pose
  onPlan: (plan: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(pose.nom)

  // Une pose renommée ailleurs — un autre onglet, l'agent — arrive par le flux.
  // Sans ça, le champ garderait le nom d'avant et le réécrirait au premier
  // départ du focus.
  useEffect(() => setNom(pose.nom), [pose.nom])

  const renommer = async () => {
    const propre = nom.trim()
    if (!propre || propre === pose.nom) {
      setNom(pose.nom)
      return
    }
    try {
      onPlan((await api.reglerPose(pose.identifiant, { nom: propre })).plan)
    } catch (erreur) {
      setNom(pose.nom)
      onErreur(erreur, "renommage refusé")
    }
  }

  const regler = async (images: number) => {
    try {
      onPlan((await api.reglerPose(pose.identifiant, { images })).plan)
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <li className="flex h-[26px] items-center gap-2">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => void renommer()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        }}
        aria-label={`Nom de l'attitude ${pose.nom}`}
        className="mesure h-[22px] min-w-0 flex-1 rounded-[2px] border border-transparent bg-transparent px-1 text-[11px] text-texte-2 hover:border-bord focus:border-bord-fort focus:bg-fond-2"
      />
      <input
        type="number"
        min={1}
        max={64}
        value={pose.images}
        onChange={(e) => void regler(Number(e.target.value))}
        aria-label={`Images demandées pour ${pose.nom}`}
        className="mesure h-[22px] w-[46px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte-2"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            onPlan((await api.retirerPose(pose.identifiant)).plan)
          } catch (erreur) {
            onErreur(erreur, "retrait refusé")
          }
        }}
        aria-label={`Retirer l'attitude ${pose.nom}`}
        title="les images déjà faites restent"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
      >
        ×
      </button>
    </li>
  )
}

// ── La colonne de droite — ce personnage-là ──────────────────────────────────

function Fiche({
  plan,
  personnage,
  onPersonnage,
  onArmer,
  onErreur,
}: {
  plan: Pose[]
  personnage: Personnage | null
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  if (!personnage) {
    return (
      // L'état vide en serif, comme la bibliothèque et le tableau : c'est une
      // invitation, et le troisième emploi du display (`docs/DESIGN.md`
      // § Typography, règle 1). **Rien de plus** — la colonne de gauche porte
      // déjà le champ et l'explication, et les redire ici en ferait un doublon.
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Ce jeu n'a encore personne. <em className="text-texte-2">Nomme le premier.</em>
        </p>
      </div>
    )
  }

  return (
    <div className="defile flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <Identite
        personnage={personnage}
        onPersonnage={onPersonnage}
        onErreur={onErreur}
      />
      <Cases
        plan={plan}
        personnage={personnage}
        onPersonnage={onPersonnage}
        onArmer={onArmer}
        onErreur={onErreur}
      />
    </div>
  )
}

/** Le nom et la description — écrits **une fois** (US-115).
 *
 *  La description part avec chaque génération de pose : c'est très exactement
 *  le signalement qu'on ne veut plus retaper à chaque prompt. */
function Identite({
  personnage,
  onPersonnage,
  onErreur,
}: {
  personnage: Personnage
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(personnage.nom)
  const [description, setDescription] = useState(personnage.description)
  const dernier = useRef(personnage.identifiant)

  // Changer de personnage remet les champs sur celui-là. Sans ça, le panneau
  // garderait le texte du précédent et on croirait l'avoir écrit ici — c'est
  // le geste de la fiche asset, et la même panne.
  useEffect(() => {
    if (dernier.current === personnage.identifiant) return
    dernier.current = personnage.identifiant
    setNom(personnage.nom)
    setDescription(personnage.description)
  }, [personnage])

  const poser = async (champs: { nom?: string; description?: string }) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
      onPersonnage(rendu.personnage)
    } catch (erreur) {
      setNom(personnage.nom)
      setDescription(personnage.description)
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => {
            if (nom.trim() && nom !== personnage.nom) void poser({ nom: nom.trim() })
            else setNom(personnage.nom)
          }}
          aria-label="Nom du personnage"
          className="min-w-0 flex-1 rounded-[2px] border border-transparent bg-transparent px-1 text-[15px] leading-none text-texte hover:border-bord focus:border-bord-fort focus:bg-fond-1"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              const parti = await api.supprimerPersonnage(personnage.identifiant)
              onPersonnage({ ...parti.personnage, supprime: true })
            } catch (erreur) {
              onErreur(erreur, "suppression refusée")
            }
          }}
          title="ses images restent, marquées « personnage supprimé »"
          className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
        >
          Supprimer
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Libelle>Description</Libelle>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== personnage.description)
              void poser({ description })
          }}
          rows={3}
          placeholder="ce qu'il faut redire au modèle à chaque image de ce personnage"
          aria-label="Description du personnage"
          className="mesure w-full resize-y rounded-[2px] border border-bord bg-fond-1 p-2 text-[11px] leading-5 text-texte placeholder:text-texte-3"
        />
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Elle part avec chaque image de ce personnage. Écrite ici une fois,
          elle ne se retape jamais dans un prompt.
        </p>
      </div>
    </section>
  )
}

/** Les cases de ce personnage — ce qui est fait, ce qui manque (US-117, US-119).
 *
 *  **Une ligne par attitude tenue**, et les attitudes écartées reléguées à une
 *  ligne en bas : un figurant ne réclame pas les images d'un héros, et sa
 *  colonne ne doit pas montrer cinq cases qu'il n'aura jamais. */
function Cases({
  plan,
  personnage,
  onPersonnage,
  onArmer,
  onErreur,
}: {
  plan: Pose[]
  personnage: Personnage
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const tenues = posesTenues(plan, personnage)
  const ecartees = plan.filter((p) => personnage.ecartees.includes(p.identifiant))
  // **Les attitudes cochées pour partir ensemble** (US-128). Elles vivent dans
  // l'onglet et nulle part ailleurs : c'est une intention qui vaut pour le
  // prochain appel, exactement comme la case visée de C1, et l'enregistrer en
  // ferait un état à remettre d'accord avec le plan à chaque ajout de pose.
  //
  // **Ce qui se coche est une attitude, jamais une image** — c'est ce qui garde
  // vrai « la matrice n'offre pas de sélection multiple » : on ne sélectionne
  // toujours aucun asset ici.
  const [cochees, setCochees] = useState<string[]>([])
  // Une pose décochée du plan, ou retirée au personnage, sort d'elle-même : on
  // ne retient que des identifiants, et on les relit dans le plan vivant.
  const lot = tenues.filter((p) => cochees.includes(p.identifiant))
  // Les cases viennent du **serveur** : elles se déduisent des assets, que cet
  // écran ne tient pas. Rangées par pose pour être lues ligne à ligne.
  const cases = Object.fromEntries(personnage.cases.map((c) => [c.pose, c]))

  /** Retirer une image de sa case. L'image reste en bibliothèque — c'est la
   *  désignation qu'on défait, pas l'image qu'on jette.
   *
   *  **Rien à recharger ici** : l'asset change, le serveur l'annonce, et les
   *  cases se redemandent d'elles-mêmes (`App`). Un rechargement écrit ici
   *  serait un second chemin vers le même état. */
  const designer = async (asset: string) => {
    try {
      await api.designer(asset, null, null)
    } catch (erreur) {
      onErreur(erreur, "désignation refusée")
    }
  }

  const cocher = async (pose: string, tenue: boolean) => {
    const suivantes = tenue
      ? [...tenues.map((p) => p.identifiant), pose]
      : tenues.map((p) => p.identifiant).filter((p) => p !== pose)
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, {
        poses: suivantes,
      })
      onPersonnage(rendu.personnage)
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <Libelle>Ce qu'il lui faut</Libelle>

      {plan.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Le plan du jeu est vide — il n'y a aucune case à remplir. Une attitude
          s'écrit à gauche.
        </p>
      ) : (
        <ul className="flex flex-col gap-px">
          {tenues.map((pose) => (
            <LigneCase
              key={pose.identifiant}
              pose={pose}
              case_={cases[pose.identifiant]}
              cochee={cochees.includes(pose.identifiant)}
              onCocher={(veut) =>
                // La forme fonctionnelle, jamais la valeur du rendu : deux
                // clics rapprochés partagent le même rendu, donc la même liste
                // périmée, et le second effacerait le premier
                // (`docs/PIEGES.md`, payé en T3).
                setCochees((precedentes) =>
                  veut
                    ? [...precedentes, pose.identifiant]
                    : precedentes.filter((p) => p !== pose.identifiant),
                )
              }
              onArmer={() => onArmer(personnage, [pose])}
              onRetirer={() => void cocher(pose.identifiant, false)}
              onDesigner={(asset) => void designer(asset)}
            />
          ))}
        </ul>
      )}

      {/* **Le geste du lot, et il n'existe que quand il a un objet.** Sans deux
          attitudes cochées, `Fabriquer ensemble` ne désigne rien : il est
          absent, et non grisé avec sa raison. Le § Le grisé porte sa raison
          suppose une chose indisponible ; ici il n'y a pas de chose — c'est la
          bascule de `+ personnage`, et celle de la réserve avant elle.

          Ce qu'il dit, il le dit en clair : **N attitudes, un seul appel**. Le
          prix, lui, se lit dans l'atelier, à côté du bouton qui paie — et c'est
          là qu'on lit aussi ce qu'un compte faux coûterait. */}
      {lot.length >= 2 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="mesure text-[10px] text-texte-3">
            {lot.length} attitudes, un seul appel
          </span>
          <button
            type="button"
            onClick={() => {
              onArmer(personnage, lot)
              setCochees([])
            }}
            title="prépare la planche dans l'atelier — rien n'est dépensé ici"
            className="mesure ml-auto px-1 text-[10px] text-signal hover:text-signal-clair"
          >
            Fabriquer ensemble ›
          </button>
        </div>
      )}

      {ecartees.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            pas pour lui
          </span>
          {ecartees.map((pose) => (
            <button
              key={pose.identifiant}
              type="button"
              onClick={() => void cocher(pose.identifiant, true)}
              title="lui rendre cette attitude"
              className="mesure h-[22px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte-3 hover:bg-fond-2 hover:text-texte-2"
            >
              {pose.nom}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** Une attitude tenue : ce qu'elle demande, ce qui la remplit, et le geste qui
 *  arme l'atelier quand elle manque (US-119, US-120).
 *
 *  **La case vide est une case, pas un trou** : elle occupe la même hauteur que
 *  les autres et dit ce qu'elle attend. C'est très exactement ce que la matrice
 *  sert à voir — « savoir quoi lancer sans tenir la liste dans ma tête ». */
function LigneCase({
  pose,
  case_,
  cochee,
  onCocher,
  onArmer,
  onRetirer,
  onDesigner,
}: {
  pose: Pose
  case_: Case | undefined
  /** **Cochée pour partir avec les autres** (US-128). C'est l'attitude qu'on
   *  coche, pas ses images : la case reste une ligne du plan du jeu. */
  cochee: boolean
  onCocher: (veut: boolean) => void
  onArmer: () => void
  onRetirer: () => void
  onDesigner: (asset: string) => void
}) {
  const images = case_?.images ?? []
  const faite = images.length >= pose.images

  return (
    <li className="flex min-h-[52px] items-center gap-3 border-b border-bord px-1 py-1">
      <input
        type="checkbox"
        checked={cochee}
        onChange={(e) => onCocher(e.target.checked)}
        aria-label={`Faire partir ${pose.nom} avec les autres`}
        title="cochées ensemble, elles partent en une seule planche"
        className="shrink-0 accent-signal"
      />
      <span className="w-[110px] shrink-0 truncate text-[11.5px] text-texte-2">
        {pose.nom}
      </span>

      {/* Les vignettes de cette case. **La même image que la grille, servie par
          la même route** — `sujetAsset` est le seul endroit du produit qui
          nomme l'adresse de l'image d'un asset. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {images.map((asset) => {
          const sujet = sujetAsset(asset)
          return (
            <span key={asset.identifiant} className="group relative">
              <img
                src={sujet.src}
                alt={asset.label}
                title={asset.label}
                className="damier h-[44px] w-[44px] object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <button
                type="button"
                onClick={() => onDesigner(asset.identifiant)}
                aria-label={`Retirer cette image de la case ${pose.nom}`}
                title="l'image reste en bibliothèque — c'est la case qu'on vide"
                className="mesure absolute top-0 right-0 hidden bg-fond-0/80 px-1 text-[10px] text-texte-3 group-hover:block hover:text-echec"
              >
                ×
              </button>
            </span>
          )
        })}
        {images.length === 0 && (
          <span className="mesure text-[10px] text-texte-3">rien encore</span>
        )}
      </div>

      {/* **Ce que le lot a mesuré sur cette case-là** (US-135). Elles
          s'affichent et n'empêchent rien : le compte d'images est le seul refus
          automatique du produit. Le chiffre et son jumeau, **jamais un seuil** —
          un seuil serait un nombre inventé sur un corpus de vingt-quatre
          planches, et le produit n'en écrit pas qui ne mesure rien. Sur ce
          corpus, les deux planches qui répétaient une pose ressortaient à 0,999
          et 1,000 quand les vingt-deux autres plafonnaient à 0,897 : l'écart se
          lit sans qu'on ait à le trancher. */}
      <MesuresDuLot case_={case_} />

      <span
        className={[
          "mesure shrink-0 text-[9.5px]",
          faite ? "text-ok" : "text-texte-3",
        ].join(" ")}
      >
        {images.length} / {pose.images}
      </span>

      {/* **Armer, pas payer.** Ce bouton remplit le prompt de l'atelier et rend
          la main : c'est là-bas qu'on relit et qu'on dépense. */}
      <button
        type="button"
        onClick={onArmer}
        aria-label={`Fabriquer ${pose.nom}`}
        title="prépare le prompt dans l'atelier — rien n'est dépensé ici"
        className="mesure shrink-0 px-1 text-[10px] text-signal hover:text-signal-clair"
      >
        Fabriquer ›
      </button>

      <button
        type="button"
        onClick={onRetirer}
        aria-label={`Retirer ${pose.nom} de ce personnage`}
        title="ce personnage n'a pas besoin de cette attitude"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
      >
        ×
      </button>
    </li>
  )
}


/** Ressemblance et dérive, quand l'image de cette case est sortie d'une planche.
 *
 *  **Elle ne paraît que s'il y a quelque chose à dire** : la quasi-totalité des
 *  images du produit ne sortent d'aucun lot, et une colonne vide en permanence
 *  serait du cadrage affiché — le reproche qui a fait écarter la maquette.
 *
 *  Le jumeau est nommé, pas seulement compté : « ressemble à la case 3 » se
 *  vérifie d'un coup d'œil, « 0,98 » tout seul demande de chercher à quoi. */
function MesuresDuLot({ case_ }: { case_: Case | undefined }) {
  const lot = case_?.images.find((a) => a.lot)?.lot
  if (!lot) return null
  return (
    <span
      className="mesure shrink-0 text-right text-[9.5px] text-texte-3"
      title="mesuré au dépliage du lot — ces chiffres n'empêchent jamais de garder"
    >
      <span className="block">
        ressemblance {lot.ressemblance.toFixed(2)}
        {lot.jumeau >= 0 ? ` · case ${lot.jumeau + 1}` : ""}
      </span>
      <span className="block">
        grille {lot.grille_px || "—"} px · dérive {lot.derive.toFixed(2)}×
      </span>
    </span>
  )
}
