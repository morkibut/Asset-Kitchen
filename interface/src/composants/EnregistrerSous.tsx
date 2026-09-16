import { useEffect, useState } from "react"
import {
  api,
  type EnregistrementFait,
  type EnregistrementPropose,
  type Prise,
  type Recette,
} from "../api"
import { CadreDialogue } from "./CadreDialogue"
import { Libelle } from "./pieces"

const CHAMP =
  "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"

/** La fenêtre du geste *Enregistrer sous…* (`RP20`) — **la même pour une image
 *  et pour une animation**.
 *
 *  Elle demande la case d'arrivée, préremplie par le serveur : avec un miroir
 *  gauche-droite dans la recette, la direction proposée est celle au miroir.
 *  Les trois listes viennent du serveur aussi — les poses sont celles de ce
 *  sujet-là, les directions celles du jeu —, parce que l'écran ne saurait pas
 *  les recalculer sans finir par diverger.
 *
 *  Rien n'est écrit tant qu'on n'a pas cliqué : la proposition ne crée rien. */
export function EnregistrerSous({
  quoi,
  identifiant,
  recette,
  prises,
  onFermer,
  onFait,
}: {
  quoi: "image" | "animation"
  identifiant: string
  /** La recette **en cours**, celle que l'écran tient — pas forcément celle du
   *  disque. C'est tout l'intérêt du geste : on enregistre un brouillon. */
  recette: Recette | null
  /** Le ruban tel que l'atelier le tient (animation seulement) : une image
   *  retirée ou dupliquée doit l'être dans ce qui sort. */
  prises?: Prise[]
  onFermer: () => void
  onFait?: (fait: EnregistrementFait) => void
}) {
  const [propose, setPropose] = useState<EnregistrementPropose | null>(null)
  const [sujet, setSujet] = useState("")
  const [pose, setPose] = useState("")
  const [direction, setDirection] = useState("")
  const [nom, setNom] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const [range, setRange] = useState("")

  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        const vu =
          quoi === "image"
            ? await api.enregistrementProposePourImage(identifiant, recette)
            : await api.enregistrementProposePourBande(identifiant, recette)
        if (!vivant) return
        setPropose(vu)
        setSujet(vu.sujet ?? "")
        setPose(vu.pose ?? "")
        setDirection(vu.direction ?? "")
        setNom(vu.nom)
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : "proposition refusée")
      }
    })()
    return () => {
      vivant = false
    }
    // La proposition se demande à l'ouverture de la fenêtre, une fois : la
    // recette ne bouge plus tant qu'elle est posée par-dessus l'atelier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoi, identifiant])

  async function enregistrer() {
    if (occupe) return
    setOccupe(true)
    setErreur("")
    try {
      const corps = { recette, sujet, pose, direction, nom: nom.trim() }
      const fait =
        quoi === "image"
          ? await api.enregistrerImageSous(identifiant, corps)
          : await api.enregistrerBandeSous(identifiant, { ...corps, prises })
      setRange(fait.range)
      onFait?.(fait)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "l’enregistrement n’a pas abouti")
    } finally {
      setOccupe(false)
    }
  }

  const quelle = quoi === "image" ? "l’image" : "l’animation"

  return (
    <CadreDialogue
      titre="Enregistrer sous"
      format="preparation"
      onFermer={onFermer}
      enfants={
        <form
          data-enregistrer-sous={quoi}
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            void enregistrer()
          }}
        >
          <header className="flex items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
            <div>
              <h1 className="font-serif text-[25px]">Enregistrer sous</h1>
              <p className="mt-[8px] text-[13px] text-encre-3">
                Le résultat devient une autre pose ou direction du même sujet.{" "}
                {quelle === "l’image"
                  ? "L’image d’origine ne bouge pas."
                  : "L’animation d’origine ne bouge pas."}
              </p>
            </div>
            <button type="button" className={CHAMP} onClick={onFermer} disabled={occupe}>
              Fermer
            </button>
          </header>

          <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[30px] text-[13px]">
            {propose?.miroir && (
              <p className="text-encre-3">
                La recette retourne {quelle} de gauche à droite
                {propose.direction_depart
                  ? ` : ${propose.direction_depart} devient ${propose.direction ?? "—"}.`
                  : "."}
              </p>
            )}
            <label className="flex flex-col gap-[8px]">
              Nom
              <input
                autoFocus
                className={CHAMP}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-[8px]">
              Sujet
              <select
                className={CHAMP}
                value={sujet}
                onChange={(e) => {
                  setSujet(e.target.value)
                  // Changer de sujet change la liste de ses poses : garder
                  // l'ancienne ferait envoyer une pose que le nouveau sujet ne
                  // tient pas, et le serveur la refuserait après coup.
                  if (e.target.value !== propose?.sujet) {
                    setPose("")
                    setDirection("")
                  }
                }}
              >
                <option value="">aucun — dans la bibliothèque</option>
                {(propose?.sujets ?? []).map((un) => (
                  <option key={un.identifiant} value={un.identifiant}>
                    {un.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[8px]">
              Pose
              <select
                className={CHAMP}
                value={pose}
                disabled={!sujet || sujet !== propose?.sujet}
                onChange={(e) => setPose(e.target.value)}
              >
                <option value="">aucune</option>
                {(propose?.poses ?? []).map((une) => (
                  <option key={une.identifiant} value={une.identifiant}>
                    {une.nom}
                  </option>
                ))}
              </select>
            </label>
            {/* **Une entrée de guide pour les trois champs** : ils posent la
                même question — *où ça va* — et le guide décrit un réglage, pas
                un écran (`interface/src/aide.ts`). */}
            <label className="flex flex-col gap-[8px]">
              <Libelle aide="enregistrer-sous.case">Direction</Libelle>
              <select
                className={CHAMP}
                value={direction}
                disabled={!pose}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="">aucune</option>
                {(propose?.directions ?? []).map((une) => (
                  <option key={une.identifiant} value={une.identifiant}>
                    {une.nom}
                  </option>
                ))}
              </select>
            </label>
            {sujet && sujet !== propose?.sujet && (
              <p className="text-encre-3">
                Les poses d’un autre sujet se choisissent depuis sa fiche. Ici,
                le résultat entre en bibliothèque sans case.
              </p>
            )}
            <p className="text-encre-3">
              La nouvelle case n’est pas retenue pour le jeu : la retenir est un
              second geste.
            </p>
            {/* **Ce que l'original a déjà donné.** La fiche d'une image le
                montre déjà par sa filiation ; une animation n'a pas de fiche où
                le lire, et un second enregistrement sous la même case se ferait
                sans rien savoir du premier. */}
            {!!propose?.derives.length && (
              <p data-deja-enregistre className="text-encre-3">
                Déjà enregistré sous :{" "}
                {propose.derives
                  .map((un) =>
                    [un.pose, un.direction].filter(Boolean).join(" · ") || un.nom,
                  )
                  .join(", ")}
                .
              </p>
            )}
            {range && (
              <p role="status" className="text-encre">
                C’est rangé : {range}.
              </p>
            )}
            {erreur && (
              <p role="alert" className="text-echec">
                {erreur}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]">
            <p className="text-[13px] text-encre-3">
              Aucune génération, rien n’est payé.
            </p>
            <button
              type="submit"
              disabled={occupe || !propose || !!propose.raison || !!range}
              className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50"
            >
              {occupe ? "Enregistrement…" : "Enregistrer sous"}
            </button>
          </footer>
        </form>
      }
    />
  )
}

/** La raison qui grise le geste, ou rien quand il est offert.
 *
 *  **Écrite ici et lue par les deux ateliers**, parce que c'est la même règle
 *  des deux côtés : sans retouche appliquée, enregistrer sous rangerait la même
 *  image dans une seconde case. Le serveur la redit avant d'écrire — cette
 *  phrase-ci est ce qui la met **devant** le clic plutôt qu'après. */
export function raisonDEnregistrerSous(recette: Recette | null): string | null {
  return recette && !recetteVide(recette)
    ? null
    : "aucune retouche n’est appliquée — enregistrer sous rangerait la même image dans une seconde case"
}

/** La recette ne fait-elle rien ? **La même liste de places que le domaine**
 *  (`Recette.vide`), et dans le même ordre : une place de plus ici qui manquerait
 *  là-bas rendrait le bouton vivant devant un serveur qui refuse. */
function recetteVide(recette: Recette): boolean {
  return !(
    recette.passes?.length ||
    recette.difference ||
    recette.recadrage ||
    recette.grille ||
    recette.quantification ||
    (recette.bords && recette.bords.aire_min > 0) ||
    recette.contours ||
    recette.retournement ||
    recette.main
  )
}
