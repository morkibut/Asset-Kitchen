/**
 * **Animer plusieurs cases d'un coup** — toutes celles d'un sujet, ou toutes les
 * directions d'une pose. Demandé le 16 septembre 2026 : lancer quatre clips
 * d'affilée pour quatre directions, remplir la file, et revenir plus tard.
 *
 * Ce qui part est exactement ce que l'écran d'un clip enverrait pour chaque
 * case, avec ses réglages par défaut (1,5 s, carré, petit format), **un clip
 * par case**, et chacun est monté à l'arrivée : il devient une animation à
 * juger, qu'on retouche ensuite dans l'atelier.
 *
 * **Ce qui est déjà fait ne repart pas.** Une case dont l'animation est retenue
 * est écartée d'office, comme une case dont un clip est déjà en route. Une case
 * qui a déjà une animation à juger est proposée décochée : on la coche si l'on
 * veut une autre version.
 */

import { useEffect, useMemo, useState } from "react"
import { api, type Bande, type Generation, type ModeleVideo, type Personnage, type Pose } from "../api"
import { CadreDialogue } from "./CadreDialogue"

/** Une attente en mots — la même rédaction que l'écran d'un clip. */
function duree(secondes: number): string {
  if (secondes < 60) return `${Math.round(secondes)} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste ? `${heures} h ${reste} min` : `${heures} h`
}

/** Les réglages de l'écran d'un clip — le même défaut, écrit une fois de plus
 *  parce qu'ici rien ne se règle : c'est ce qui fait qu'un lot rend les mêmes
 *  clips qu'une commande à la main. */
const SECONDES = 1.5
const RESOLUTION = "480p"
const PROPORTIONS = "1:1"
const MODELE_PAR_DEFAUT = "maison/wan-2.2-i2v-14b-pixel"

export type EtatDeCase = "retenue" | "en-route" | "a-juger" | "vide"

export type CaseAAnimer = {
  pose: string
  poseNom: string
  direction: string | null
  directionNom: string | null
  etat: EtatDeCase
}

const enRoute = (g: Generation) =>
  g.statut === "en_attente" || g.statut === "en_cours"

/** Les clips de ce sujet **pas encore montés** : en route, ou arrivés sans
 *  animation taillée dedans. Ce sont eux que la rangée montre en vignette. */
export function clipsNonMontes(
  clips: readonly Generation[],
  personnage: Personnage,
): Generation[] {
  const montes = new Set<string>()
  for (const sienne of personnage.cases) {
    const bandes: Bande[] = [
      ...sienne.bandes,
      ...sienne.bandes_ecartees,
      ...sienne.directions.flatMap((d) => [...d.bandes, ...d.bandes_ecartees]),
    ]
    for (const b of bandes) montes.add(b.clip)
  }
  return clips.filter(
    (g) =>
      g.personnage === personnage.identifiant &&
      g.clip &&
      !g.clip.jete &&
      (!g.clip.nature || g.clip.nature === "video") &&
      (enRoute(g) || (g.statut === "reussie" && !montes.has(g.identifiant))),
  )
}

/** L'état d'une case pour un lot : ce qui décide si elle repart. */
export function etatDeLaCase(
  rangee: { pose: string; direction: string | null; retenue: Bande | null; compte: number },
  nonMontes: readonly Generation[],
): EtatDeCase {
  if (rangee.retenue) return "retenue"
  const siens = nonMontes.filter(
    (g) => g.pose === rangee.pose && (g.direction ?? null) === rangee.direction,
  )
  if (siens.some(enRoute)) return "en-route"
  if (rangee.compte > 0 || siens.length > 0) return "a-juger"
  return "vide"
}

const MOT: Record<EtatDeCase, string> = {
  retenue: "déjà retenue — ignorée",
  "en-route": "un clip est déjà en route — ignorée",
  "a-juger": "a déjà une animation à juger",
  vide: "à fabriquer",
}

export function AnimerEnLot({
  personnage,
  plan,
  cases,
  titre,
  onFermer,
  onCommande,
}: {
  personnage: Personnage
  plan: readonly Pose[]
  cases: readonly CaseAAnimer[]
  titre: string
  onFermer: () => void
  /** Les clips partis, **à mesure** : la file se remplit pendant l'envoi. */
  onCommande: (clips: Generation[]) => void
}) {
  const cle = (c: CaseAAnimer) => `${c.pose}/${c.direction ?? "—"}`
  const [cochees, setCochees] = useState<Set<string>>(
    () => new Set(cases.filter((c) => c.etat === "vide").map(cle)),
  )
  const [modeles, setModeles] = useState<ModeleVideo[] | null>(null)
  const [modele, setModele] = useState<string | null>(null)
  const [refusCatalogue, setRefusCatalogue] = useState("")
  const [envoi, setEnvoi] = useState<{ faits: number; total: number; refus: string[]; fini: boolean } | null>(null)

  useEffect(() => {
    let vivant = true
    api
      .modelesVideo(SECONDES, RESOLUTION, PROPORTIONS)
      .then((recu) => {
        if (!vivant) return
        const possibles = recu.modeles.filter((m) => m.grise === null)
        setModeles(possibles)
        setModele(
          possibles.some((m) => m.identifiant === MODELE_PAR_DEFAUT)
            ? MODELE_PAR_DEFAUT
            : possibles[0]?.identifiant ?? null,
        )
        if (!possibles.length) setRefusCatalogue(recu.raison ?? "aucun modèle vidéo ne peut partir")
      })
      .catch((erreur) => vivant && setRefusCatalogue(erreur instanceof Error ? erreur.message : "le catalogue vidéo ne répond pas"))
    return () => {
      vivant = false
    }
  }, [])

  const choisies = cases.filter((c) => cochees.has(cle(c)))
  const choisi = modeles?.find((m) => m.identifiant === modele) ?? null
  const annonce = useMemo(() => {
    if (!choisi || choisies.length === 0) return ""
    if (choisi.de_la_maison) {
      const a = choisi.attente
      const secondes = a ? a.secondes + (choisies.length - 1) * (a.secondes_suivant || a.secondes) : null
      return `gratuit${secondes ? ` · environ ${duree(secondes)} au total` : ""}`
    }
    const montant = choisi.prix.montant
    return montant === null ? "prix inconnu" : `${(montant * choisies.length).toLocaleString("fr-FR", { style: "currency", currency: "USD" })} au total`
  }, [choisi, choisies.length])

  async function lancer() {
    if (!choisi || choisies.length === 0 || envoi) return
    const refus: string[] = []
    setEnvoi({ faits: 0, total: choisies.length, refus, fini: false })
    for (const [rang, c] of choisies.entries()) {
      const nom = `${c.poseNom}${c.directionNom ? ` · ${c.directionNom}` : ""}`
      try {
        const depart = await api.imageDeDepart(personnage.identifiant, c.pose, c.direction)
        if (!depart.asset) throw new Error("aucune image de départ")
        const mouvement = await api.mouvementDeLaPose(c.pose, personnage.projet)
        if (!mouvement.mouvement && !mouvement.texte.trim()) throw new Error("aucun mouvement pour cette pose")
        const { clips } = await api.commanderClips({
          modele: choisi.identifiant,
          asset: depart.asset.identifiant,
          mouvement: mouvement.mouvement?.identifiant ?? null,
          prompt: mouvement.mouvement ? undefined : mouvement.texte,
          secondes: SECONDES,
          resolution: RESOLUTION,
          proportions: PROPORTIONS,
          nombre: 1,
          personnage: personnage.identifiant,
          pose: c.pose,
          direction: c.direction,
          monter_auto: true,
        })
        onCommande(clips)
      } catch (erreur) {
        refus.push(`${nom} : ${erreur instanceof Error ? erreur.message : "refusé"}`)
      }
      setEnvoi({ faits: rang + 1, total: choisies.length, refus: [...refus], fini: rang + 1 === choisies.length })
    }
  }

  const nomDePose = (pose: string) => plan.find((p) => p.identifiant === pose)?.nom ?? pose
  const poses = [...new Set(cases.map((c) => c.pose))]

  return (
    <CadreDialogue
      titre={titre}
      format="preparation"
      onFermer={onFermer}
      enfants={
        <div data-animer-en-lot className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
            <div>
              <h1 className="font-serif text-[25px]">{titre}</h1>
              <p className="mt-[8px] text-[13px] text-encre-3">
                Un clip par case coché, envoyés à la suite dans la file. Chacun arrive déjà monté, à juger.
              </p>
            </div>
            <button type="button" onClick={onFermer} disabled={!!envoi && !envoi.fini} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50">
              Fermer
            </button>
          </header>

          <div className="defile min-h-0 space-y-[14px] overflow-y-auto p-[30px] text-[13px]">
            {poses.map((pose) => (
              <fieldset key={pose} className="flex flex-col gap-[4px]">
                <legend className="mb-[4px] font-medium">{nomDePose(pose)}</legend>
                {cases.filter((c) => c.pose === pose).map((c) => {
                  const ignoree = c.etat === "retenue" || c.etat === "en-route"
                  return (
                    <label key={cle(c)} className={`flex items-center gap-[8px] ${ignoree ? "text-encre-4" : ""}`}>
                      <input
                        type="checkbox"
                        disabled={ignoree || !!envoi}
                        checked={cochees.has(cle(c))}
                        onChange={(e) =>
                          setCochees((avant) => {
                            const suite = new Set(avant)
                            if (e.target.checked) suite.add(cle(c))
                            else suite.delete(cle(c))
                            return suite
                          })
                        }
                      />
                      <span>{c.directionNom ?? "toutes directions"}</span>
                      <span className="text-[12px] text-encre-3">— {MOT[c.etat]}</span>
                    </label>
                  )
                })}
              </fieldset>
            ))}
            {refusCatalogue && <p role="alert" className="text-echec">{refusCatalogue}</p>}
            {modeles && modeles.length > 1 && (
              <label className="flex flex-col gap-[4px]">
                Modèle
                <select className="min-h-[34px] rounded-7 border border-contour bg-carte px-[14px]" value={modele ?? ""} disabled={!!envoi} onChange={(e) => setModele(e.target.value)}>
                  {modeles.map((m) => (
                    <option key={m.identifiant} value={m.identifiant}>{m.nom}</option>
                  ))}
                </select>
              </label>
            )}
            {envoi && envoi.refus.length > 0 && (
              <ul role="alert" className="text-echec">
                {envoi.refus.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]">
            <p role="status" className="text-[13px] text-encre">
              {envoi
                ? envoi.fini
                  ? `✓ ${envoi.total - envoi.refus.length} clip${envoi.total - envoi.refus.length > 1 ? "s" : ""} dans la file${envoi.refus.length ? ` · ${envoi.refus.length} refusé${envoi.refus.length > 1 ? "s" : ""}` : ""}.`
                  : `Envoi ${envoi.faits} / ${envoi.total}…`
                : choisies.length === 0
                  ? "Aucune case cochée."
                  : `${choisies.length} clip${choisies.length > 1 ? "s" : ""}${choisi ? ` · ${choisi.nom}` : ""}${annonce ? ` · ${annonce}` : ""}`}
            </p>
            {envoi?.fini ? (
              <button type="button" onClick={onFermer} className="h-[34px] rounded-7 border border-contour bg-carte px-[22px] text-[13px] text-encre-controle">
                Fermer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void lancer()}
                disabled={!!envoi || !choisi || choisies.length === 0}
                className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50"
              >
                {choisies.length > 0 && choisi && !choisi.de_la_maison && annonce ? `Lancer · ${annonce.replace(" au total", "")}` : `Lancer ${choisies.length || ""} clip${choisies.length > 1 ? "s" : ""}`}
              </button>
            )}
          </footer>
        </div>
      }
    />
  )
}
