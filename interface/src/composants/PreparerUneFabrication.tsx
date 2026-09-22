// **Préparer une fabrication — une seule fenêtre** (RP4).
//
// Le produit en avait huit, plus une d'aiguillage. Trois préparaient une image
// fixe, trois un clip, et **aucune n'était atteignable depuis une autre** : le
// type de résultat était décidé par le bouton pressé, pas dans la fenêtre. Qui
// voulait passer d'une image à un clip fermait tout et recommençait.
//
// Ici, le type de résultat est le **premier choix**, et c'est une liste fermée
// de quatre — `fabrication.ts`. Le corps change avec lui ; la fenêtre, non.
//
// **Ce fichier ne prépare rien lui-même.** Chaque corps est la fenêtre d'avant,
// sans son cadre ni son titre : elles n'ont perdu aucun geste, seulement leur
// encadrement. C'est ce qui garde l'invariant de l'argent intact — le chemin
// qu'emprunte l'envoi n'a pas bougé d'une ligne.

import { useEffect, useState, type ReactNode } from "react"
import type { Personnage, Pose } from "../api"
import { NOM_DU_TYPE, TYPES_DE_RESULTAT, type OptionsAnimer, type TypeDeResultat } from "../fabrication"
import { CadreDialogue } from "./CadreDialogue"
import { FabricationAudio } from "./FabricationAudio"
import { FabricationSuivie } from "./FabricationSuivie"
import { FabricationVideoLibre } from "./FabricationVideoLibre"
import { FabricationImageLocale } from "./WorkflowsLocaux"
import { Parcours3D } from "./Fabrication3D"

const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px]"

/** Pourquoi un type ne se prépare pas d'ici — **le grisé porte sa raison**,
 *  jamais une infobulle. C'est la règle du produit depuis `T1`. */
function refusDuType(
  type: TypeDeResultat,
  projet: string | null,
  sujet: Personnage | null,
): string | null {
  if (!projet && type !== "image") return "aucun jeu ouvert"
  if (type === "rendu-3d" && !sujet) return "un rendu 3D part d’un sujet ; ouvre-le d’abord"
  return null
}

export function PreparerUneFabrication({
  projet,
  sujet,
  plan,
  personnages,
  typeInitial = "image",
  onType,
  poseInitiale = "",
  directionInitiale = "",
  clipInitial,
  posesVisees = [],
  sujetVise = null,
  modeleInitial,
  avecQuoiInitial = "catalogue",
  preparationImage,
  onViser,
  onObjectif,
  onClip,
  onBande,
  onAsset,
  onToile,
  onSon,
  onLivraisons,
  onFermer,
}: {
  projet: string | null
  /** Le sujet visé, quand on vient de sa fiche. `null` pour une fabrication
   *  libre : le type *Rendu 3D* est alors grisé, avec sa raison. */
  sujet: Personnage | null
  plan: Pose[]
  personnages: readonly Personnage[]
  typeInitial?: TypeDeResultat
  /** Prévient l'appelant du type montré, à l'ouverture et à chaque changement :
   *  le guide (`ecranDuGuide`, `App.tsx`) doit savoir si l'on est sur *Un son*. */
  onType?: (type: TypeDeResultat) => void
  poseInitiale?: string
  directionInitiale?: string
  /** **RV6** : ce qu'une porte de clip apporte en plus d'une case — d'autres
   *  directions cochées, l'image de départ d'un clip d'origine, ou la
   *  reprise à l'identique d'un travail raté. Transmis tel quel à
   *  `FabricationSuivie.cibleInitiale`. */
  clipInitial?: OptionsAnimer
  /** Les attitudes que le lot armé vise — une, ou N pour une planche. La
   *  fenêtre les nomme toutes sous son titre : c'est ce qu'on paie. */
  posesVisees?: Pose[]
  /** Le sujet **armé** — celui dont la case sera remplie. Il disparaît quand
   *  l'appel part ; le sujet ouvert derrière, lui, reste. */
  sujetVise?: Personnage | null
  /** Un workflow importé choisi d'avance, depuis *Mes méthodes locales*. */
  modeleInitial?: string
  avecQuoiInitial?: "catalogue" | "workflow"
  /** Le corps d'une image fixe du catalogue : la barre qui paie, telle que
   *  l'atelier la monte. **Elle n'est pas reconstruite ici** — c'est le seul
   *  endroit d'où l'argent part pour une image, et il n'en naît pas un second
   *  (E2). */
  preparationImage: ReactNode
  /** Le sujet et la case que l'image fixe remplira. La fenêtre les choisit ;
   *  l'atelier les arme. Un sujet sans pose rattache l'image sans la ranger ;
   *  aucun sujet, c'est une image libre. */
  onViser: (personnage: Personnage | null, pose: Pose | null, direction: string | null) => void
  onObjectif?: () => void
  onClip: (id: string) => void
  onBande?: (id: string) => void
  onAsset?: (id: string) => void
  onToile?: (id: string) => void
  onSon?: (id: string) => void
  onLivraisons?: () => void
  onFermer: () => void
}) {
  const [type, setType] = useState<TypeDeResultat>(typeInitial)
  useEffect(() => { onType?.(type) }, [type]) // eslint-disable-line react-hooks/exhaustive-deps -- `onType` est un setter, stable ; seul le type déclenche.
  const [avecQuoi, setAvecQuoi] = useState(avecQuoiInitial)
  const [pour, setPour] = useState<"sujet" | "libre">(sujet ? "sujet" : "libre")
  // **Le sujet auquel l'image fixe sera rattachée**, pose ou pas. Venu d'une
  // fiche, il est déjà choisi : une image fabriquée depuis Champy est à Champy,
  // même sans case visée — sinon elle retombe dans la galerie, sans maître.
  const [entite, setEntite] = useState(sujetVise?.identifiant ?? sujet?.identifiant ?? "")
  // Le sujet ouvert est toujours proposable, même absent de la liste reçue.
  const sujets = [
    ...[sujetVise, sujet].filter(
      (s, i, tous): s is Personnage =>
        !!s &&
        !personnages.some((p) => p.identifiant === s.identifiant) &&
        tous.findIndex((t) => t?.identifiant === s.identifiant) === i,
    ),
    ...personnages,
  ]
  const porteur = sujets.find((p) => p.identifiant === entite) ?? null

  // **Les poses qu'on peut viser**, dans l'ordre que l'aiguillage employait :
  // celles que l'objectif réclame d'abord, les autres ensuite.
  const objectifs = porteur?.objectif?.sorties.filter((s) => s.quantite > 0) ?? []
  const parIdentifiant = new Map<string, Pose>()
  objectifs.forEach((s) => {
    const pose = plan.find((p) => p.identifiant === s.pose)
    if (pose) parIdentifiant.set(pose.identifiant, pose)
  })
  plan
    .filter((p) => porteur?.cases.some((c) => c.pose === p.identifiant))
    .forEach((p) => parIdentifiant.set(p.identifiant, p))
  const poses = [...parIdentifiant.values()]
  const dansLObjectif = poses.filter((p) => objectifs.some((s) => s.pose === p.identifiant))
  const autresPoses = poses.filter((p) => !objectifs.some((s) => s.pose === p.identifiant))

  // **La liste montre ce qui partira.** Sans case armée, l'appel ne vise
  // aucune pose : la liste dit donc « Sans case visée », et non la première
  // pose de l'objectif, qui ne partirait pas.
  const [pose, setPose] = useState(poseInitiale)
  const [direction, setDirection] = useState(
    directionInitiale ||
      objectifs.find((s) => s.pose === (poseInitiale || undefined))?.direction ||
      "",
  )
  const directions = porteur?.cases.find((c) => c.pose === pose)?.directions ?? []

  // **La case visée ne se réarme qu'au geste.** Armer repose le champ avec le
  // signalement du sujet (`gestes.ts`) : le faire à l'ouverture effacerait ce
  // que l'auteur vient d'écrire, et le faire à chaque rendu l'effacerait à
  // chaque frappe. La fenêtre arme donc quand on change la pose ou la
  // direction, et jamais autrement.
  const viser = (prochainePose: string, prochaineDirection: string) => {
    setPose(prochainePose)
    setDirection(prochaineDirection)
    onViser(
      porteur,
      poses.find((p) => p.identifiant === prochainePose) ?? null,
      prochaineDirection || null,
    )
  }

  // **Changer de sujet repart sans case** : les poses de l'un ne sont pas
  // celles de l'autre.
  const rattacher = (identifiant: string) => {
    setEntite(identifiant)
    setPose("")
    setDirection("")
    onViser(sujets.find((p) => p.identifiant === identifiant) ?? null, null, null)
  }

  // **Venu d'une fiche sans case armée, l'image est déjà à ce sujet.** Une
  // seule fois, à l'ouverture, et sans toucher au champ : rattacher ne réécrit
  // pas le prompt, seul viser une case le fait.
  useEffect(() => {
    if (!sujetVise && porteur) onViser(porteur, null, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // **Ce que la fenêtre dit viser**, et c'est le lot entier quand il y en a un :
  // une planche vise N attitudes, et n'en nommer qu'une ferait croire qu'on paie
  // pour une case.
  const nomDeLaDirection =
    directions.find((d) => d.identifiant === direction)?.nom ?? direction
  // **Et c'est la case *armée* qu'elle nomme, pas le sujet ouvert derrière.**
  // Quand l'appel est parti, la cible se désarme : la fenêtre doit le dire, même
  // si la fiche du sujet est restée ouverte dessous.
  const cible = sujetVise
    ? `${sujetVise.nom}${posesVisees.length ? ` · ${posesVisees.map((p) => p.nom).join(", ")}` : ""}${direction ? ` · ${nomDeLaDirection}` : ""}`
    : type === "image"
      ? "Image libre"
      : "Sans sujet"

  const corps = () => {
    if (type === "image")
      return avecQuoi === "workflow" && projet ? (
        <div className="defile min-h-0 flex-1 overflow-y-auto">
          <FabricationImageLocale
            autonome={false}
            projet={projet}
            modeleInitial={modeleInitial}
            personnage={porteur?.identifiant}
            onAsset={onAsset}
            onToile={onToile}
          />
        </div>
      ) : (
        preparationImage
      )
    if (type === "clip" && projet)
      return pour === "sujet" && sujet ? (
        <FabricationSuivie
          autonome={false}
          projet={projet}
          personnages={personnages}
          cibleInitiale={{ personnage: sujet.identifiant, pose, direction, ...clipInitial }}
          modeleInitial={modeleInitial}
          onClip={onClip}
          onBande={onBande}
          onLivraisons={onLivraisons}
          onFermer={onFermer}
        />
      ) : (
        <div className="defile min-h-0 flex-1 overflow-y-auto">
          <FabricationVideoLibre
            autonome={false}
            projet={projet}
            modeleInitial={modeleInitial}
            onClip={onClip}
            onFermer={onFermer}
          />
        </div>
      )
    if (type === "son" && projet)
      return (
        <FabricationAudio
          autonome={false}
          projet={projet}
          modeleInitial={modeleInitial}
          onSon={onSon}
          onFermer={onFermer}
        />
      )
    if (type === "rendu-3d" && sujet)
      return (
        <div className="defile min-h-0 flex-1 overflow-y-auto px-[30px]">
          <Parcours3D autonome={false} personnage={sujet} onBande={onBande} />
        </div>
      )
    return (
      <p className="p-[30px] text-[13px] text-encre-3">
        {refusDuType(type, projet, sujet) ?? "Rien à préparer pour ce type."}
      </p>
    )
  }

  return (
    <CadreDialogue
      titre="Préparer une fabrication"
      format="preparation"
      onFermer={onFermer}
      enfants={
        <>
          <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
            <div>
              <h1 className="font-serif text-[25px]">Préparer une fabrication</h1>
              <p className="mt-[8px] text-[13px] text-encre-3">{cible}</p>
            </div>
            <button className={CHAMP} onClick={onFermer}>
              Fermer
            </button>
          </header>
          {/* **Le premier choix, et il n'y en a que quatre.** Le bouton pressé
              ne décide plus de rien : il ouvre cette fenêtre-ci sur un type, et
              le type se change ici. */}
          <div className="flex shrink-0 flex-wrap items-end gap-[14px] border-b border-trait px-[30px] py-[14px] text-[13px]">
            <label className="flex flex-col gap-[4px]">
              Type de résultat
              <select
                aria-label="Type de résultat"
                className={CHAMP}
                value={type}
                onChange={(e) => setType(e.target.value as TypeDeResultat)}
              >
                {TYPES_DE_RESULTAT.map((t) => {
                  const refus = refusDuType(t, projet, sujet)
                  return (
                    <option key={t} value={t} disabled={!!refus}>
                      {NOM_DU_TYPE[t]}
                      {refus ? ` — ${refus}` : ""}
                    </option>
                  )
                })}
              </select>
            </label>
            {type === "image" && (
              <label className="flex flex-col gap-[4px]">
                Avec quoi
                <select
                  aria-label="Avec quoi"
                  className={CHAMP}
                  value={avecQuoi}
                  onChange={(e) => setAvecQuoi(e.target.value as "catalogue" | "workflow")}
                >
                  <option value="catalogue">Le catalogue de modèles</option>
                  <option value="workflow" disabled={!projet}>
                    Un workflow importé{projet ? "" : " — aucun jeu ouvert"}
                  </option>
                </select>
              </label>
            )}
            {type === "clip" && sujet && (
              <label className="flex flex-col gap-[4px]">
                Pour
                <select
                  aria-label="Pour"
                  className={CHAMP}
                  value={pour}
                  onChange={(e) => setPour(e.target.value as "sujet" | "libre")}
                >
                  <option value="sujet">{sujet.nom}</option>
                  <option value="libre">Sans sujet</option>
                </select>
              </label>
            )}
            {/* **La pose et la direction, une seule fois.** Pour un clip elles
                se choisissent dans le corps, avec le sujet ; pour un rendu 3D
                dans ses propres champs ; un son n'a pas de case. Ne restait
                que l'image fixe, dont le corps sait montrer la case visée sans
                savoir la choisir : c'est ce que l'écran d'aiguillage servait à
                faire, et c'est tout ce qu'il faisait. */}
            {type === "image" && sujets.length > 0 && (
              <label className="flex flex-col gap-[4px]">
                Pour
                <select
                  aria-label="Sujet de l’image"
                  className={CHAMP}
                  value={entite}
                  onChange={(e) => rattacher(e.target.value)}
                >
                  <option value="">Aucun sujet — image libre</option>
                  {sujets.map((p) => (
                    <option key={p.identifiant} value={p.identifiant}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {type === "image" && porteur && (
              <>
                <label className="flex flex-col gap-[4px]">
                  Mouvement ou pose
                  <select
                    aria-label="Mouvement ou pose"
                    className={CHAMP}
                    value={pose}
                    onChange={(e) =>
                      viser(
                        e.target.value,
                        objectifs.find((s) => s.pose === e.target.value)?.direction ?? "",
                      )
                    }
                  >
                    <option value="">Sans case visée</option>
                    {/* **Les deux groupes de l'aiguillage sont gardés** : ce
                        que l'objectif réclame d'abord, le reste du plan
                        ensuite. C'est la seule chose qui distinguait une pose
                        qu'il faut produire d'une pose déjà tenue. */}
                    {dansLObjectif.length > 0 && (
                      <optgroup label="Dans l’objectif">
                        {dansLObjectif.map((p) => (
                          <option key={p.identifiant} value={p.identifiant}>
                            {p.nom}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {autresPoses.length > 0 && (
                      <optgroup label="Autres poses du plan">
                        {autresPoses.map((p) => (
                          <option key={p.identifiant} value={p.identifiant}>
                            {p.nom}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {directions.length > 0 && (
                  <label className="flex flex-col gap-[4px]">
                    Direction
                    <select
                      aria-label="Direction"
                      className={CHAMP}
                      value={direction}
                      onChange={(e) => viser(pose, e.target.value)}
                    >
                      <option value="">Direction par défaut de cette pose</option>
                      {directions.map((d) => (
                        <option key={d.identifiant} value={d.identifiant}>
                          {d.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!poses.length && onObjectif && (
                  <button
                    type="button"
                    className="pb-[8px] text-[13px] underline hover:text-encre"
                    onClick={onObjectif}
                  >
                    Ajouter un mouvement dans Objectif &amp; règles
                  </button>
                )}
              </>
            )}
          </div>
          {corps()}
        </>
      }
    />
  )
}
