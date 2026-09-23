// Fabriquer sur la toile — une barre, un bouton, et les images qui arrivent là
// où on les attendait.
//
// **La demande de l'auteur, telle quelle** : fabriquer des images à la volée sur
// l'univers, à partir de rien ou d'une image déjà posée, en 1, 2 ou 3 versions,
// « sans menu de validation ». Le bouton porte ce que ça coûte — c'est l'annonce
// que le produit doit toujours faire avant de dépenser (`AGENTS.md`, points 8 et
// 8ter) —, et rien d'autre ne s'interpose entre la phrase et l'appel.
//
// **Tout ce qui revient entre en bibliothèque de lui-même**, comme partout : la
// toile ne fait que poser une copie de chaque image revenue à l'endroit où son
// fantôme attendait. Rien de ce fichier n'invente un second chemin de paiement —
// c'est `api.generer`, la seule route qui paie.

import { useCallback, useEffect, useRef, useState } from "react"
import type { NodeProps } from "@xyflow/react"

import {
  api,
  prix,
  Refus,
  type Carte,
  type EtatCatalogue,
  type Generation,
  type Modele,
  type Reinjection,
} from "../api"
import { tempsParImage, type ModeleAvecReference } from "../api-workflows"
import { Libelle, libelleModele } from "./pieces"

type Place = { x: number; y: number }

/** Les nombres de versions que la barre propose d'un coup. */
export const VERSIONS = [1, 2, 3] as const
export type Versions = (typeof VERSIONS)[number]

/** Le style que la barre prend d'elle-même : le Qwen rapide des styles locaux.
 *  **Un fragment, pas une chaîne complète** — le catalogue décide de la version
 *  et du fournisseur, la barre ne fait que le reconnaître. */
const PREFERE = "qwen21-rapide"

/** Le format des images fabriquées ici. La barre n'en propose pas d'autre : un
 *  réglage de plus serait le premier pas vers la préparation complète, qui
 *  existe déjà ailleurs. Un modèle qui ne le fait pas prend son premier. */
const PROPORTIONS = "1:1"

const MEMOIRE = "atelier.toile.fabrique"

/** Le modèle par défaut : le premier Qwen rapide disponible, sinon le premier
 *  modèle disponible, sinon rien. Un modèle grisé n'est jamais choisi. */
export function modeleParDefaut(modeles: readonly Modele[]): string | null {
  const libres = modeles.filter((m) => !m.refus)
  return (
    libres.find((m) => m.identifiant.includes(PREFERE))?.identifiant ??
    libres[0]?.identifiant ??
    null
  )
}

/** Ce que le bouton annonce pour `n` versions.
 *
 *  **Un modèle local annonce un temps, et ce temps ne se multiplie pas** (8ter)
 *  : le premier tirage charge le modèle, les suivants non. Un modèle payant
 *  annonce le prix mesuré sur cette machine, multiplié par le nombre d'images —
 *  ou « Coût inconnu » quand il n'a jamais été appelé ici. */
export function annonce(
  modele: Modele | null,
  couts: Record<string, number>,
  n: number,
): string {
  if (!modele) return "aucun modèle"
  if (modele.locale) {
    const temps = (modele as Modele & ModeleAvecReference).temps
    return tempsParImage(temps) ?? "temps non mesuré"
  }
  const unitaire = couts[modele.identifiant]
  return prix(unitaire === undefined ? null : unitaire * n, modele.unite)
}

/** Les cartes qui partent en référence : celle qu'on a demandé de varier, puis
 *  la sélection de la toile (ou la carte choisie, qui est la sélection à un).
 *  **Seules les images arrivées partent** : une note ou une adresse encore en
 *  attente n'ont pas d'image à envoyer. */
export function referencesDeLaToile(
  cartes: readonly Carte[],
  selection: readonly string[],
  choisie: string | null,
  variee: string | null,
): Carte[] {
  const voulues = [
    ...(variee ? [variee] : []),
    ...(selection.length ? selection : choisie ? [choisie] : []),
  ]
  const vues = new Set<string>()
  const sortie: Carte[] = []
  for (const identifiant of voulues) {
    if (vues.has(identifiant)) continue
    vues.add(identifiant)
    const carte = cartes.find((c) => c.identifiant === identifiant)
    if (carte && carte.genre === "image" && carte.statut === "prete") sortie.push(carte)
  }
  return sortie
}

/** **Le rôle des cartes jointes : l'image qu'on modifie** (`edition`). La
 *  demande est « à partir d'une image » — la reprendre, pas s'en inspirer de
 *  loin. Une carte ne donne aucune filiation (la bibliothèque ne la connaît
 *  pas), donc rien d'autre ne change côté serveur. */
export const ROLE_DES_CARTES = "edition" as const

// ── Les fantômes ────────────────────────────────────────────────────────────

/** Une image attendue, posée sur le plan avant d'exister. */
export type Fantome = {
  cle: string
  place: Place
  /** Nul tant que le POST n'est pas revenu. */
  generation: string | null
  /** Le rang de l'emplacement que ce fantôme attend, dans la génération. */
  rang: number
  raison: string | null
}

const SONDE_MS = 1500

/** La fabrication elle-même : lancer, suivre, poser.
 *
 *  **On sonde la génération, on n'écoute pas le flux.** Le flux d'événements
 *  vit dans `App` et nourrit le chantier de toutes les générations ; le brancher
 *  jusqu'ici aurait traversé trois écrans pour une seule question — *cet
 *  emplacement-là est-il revenu ?* — que `GET /generations/{id}` pose seul.
 *  Plusieurs fabrications tournent en même temps : chacune a ses fantômes. */
export function useFabricationSurToile(onErreur: (raison: string) => void) {
  const [fantomes, setFantomes] = useState<Fantome[]>([])
  // Le miroir que la sonde lit : elle vit hors du rendu, et lirait sinon la
  // liste figée au moment où elle est partie.
  const miroir = useRef<Fantome[]>([])
  const changer = (f: (liste: Fantome[]) => Fantome[]) => {
    miroir.current = f(miroir.current)
    setFantomes(miroir.current)
  }
  const vivant = useRef(true)
  const minuteurs = useRef(new Set<number>())
  useEffect(() => {
    vivant.current = true
    const actifs = minuteurs.current
    return () => {
      vivant.current = false
      for (const m of actifs) window.clearTimeout(m)
      actifs.clear()
    }
  }, [])

  const plus_tard = (f: () => void, ms: number) => {
    const m = window.setTimeout(() => {
      minuteurs.current.delete(m)
      if (vivant.current) f()
    }, ms)
    minuteurs.current.add(m)
  }

  const suivre = useCallback((identifiant: string, poses: Set<number>) => {
    const tour = async () => {
      let generation: Generation
      try {
        generation = await api.generation(identifiant)
      } catch {
        plus_tard(() => void tour(), SONDE_MS)
        return
      }
      if (!vivant.current) return
      let restants = 0
      for (const emplacement of generation.emplacements) {
        if (poses.has(emplacement.rang)) continue
        if (emplacement.statut === "reussie") {
          poses.add(emplacement.rang)
          void poser(generation, emplacement.rang)
        } else if (emplacement.statut === "echouee" || emplacement.statut === "interrompue") {
          poses.add(emplacement.rang)
          const raison = emplacement.raison || "l'image n'est pas revenue"
          changer((liste) =>
            liste.map((f) =>
              f.generation === identifiant && f.rang === emplacement.rang ? { ...f, raison } : f,
            ),
          )
        } else restants += 1
      }
      if (restants > 0) plus_tard(() => void tour(), SONDE_MS)
    }
    void tour()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Poser l'image revenue **à la place de son fantôme**, puis l'effacer. */
  const poser = async (generation: Generation, rang: number) => {
    const fantome = miroir.current.find(
      (f) => f.generation === generation.identifiant && f.rang === rang,
    )
    const projet = generation.projet
    if (!fantome || !projet) return
    try {
      await api.poserAssetSurToile(projet, `${generation.identifiant}-${rang}`, [
        fantome.place.x,
        fantome.place.y,
      ])
      if (vivant.current) changer((liste) => liste.filter((f) => f.cle !== fantome.cle))
    } catch (erreur) {
      const raison = erreur instanceof Refus ? erreur.message : "l'image n'a pas pu être posée"
      if (vivant.current)
        changer((liste) => liste.map((f) => (f.cle === fantome.cle ? { ...f, raison } : f)))
    }
  }

  const lancer = useCallback(
    async (demande: {
      prompt: string
      modele: string
      proportions: string
      variations: number
      references: Reinjection[]
      places: Place[]
    }) => {
      const lot = crypto.randomUUID().replace(/-/g, "")
      const nes: Fantome[] = demande.places.map((place, rang) => ({
        cle: `${lot}-${rang}`,
        place,
        generation: null,
        rang,
        raison: null,
      }))
      changer((liste) => [...liste, ...nes])
      try {
        const generation = await api.generer({
          modele: demande.modele,
          prompt: demande.prompt,
          prompt_negatif: "",
          proportions: demande.proportions,
          variations: demande.variations,
          options: {},
          identifiant: lot,
          references: demande.references,
          echelle: "",
          repris: false,
        })
        if (!vivant.current) return
        // Les fantômes prennent les rangs que le serveur a vraiment donnés, dans
        // l'ordre : c'est eux que les assets porteront.
        const rangs = generation.emplacements.map((e) => e.rang).sort((a, b) => a - b)
        changer((liste) =>
          liste.map((f) => {
            const i = nes.findIndex((n) => n.cle === f.cle)
            return i < 0 ? f : { ...f, generation: generation.identifiant, rang: rangs[i] ?? i }
          }),
        )
        suivre(generation.identifiant, new Set())
      } catch (erreur) {
        const raison = erreur instanceof Refus ? erreur.message : "la fabrication n'est pas partie"
        onErreur(raison)
        if (vivant.current)
          changer((liste) =>
            liste.map((f) => (nes.some((n) => n.cle === f.cle) ? { ...f, raison } : f)),
          )
      }
    },
    [onErreur, suivre],
  )

  const retirer = useCallback(
    (cle: string) => changer((liste) => liste.filter((f) => f.cle !== cle)),
    [],
  )

  return { fantomes, lancer, retirer }
}

/** Un fantôme sur le plan : il pulse tant qu'il attend, il dit l'échec sinon. */
export function NoeudFantome({ data }: NodeProps) {
  const { fantome, onRetirer } = data as unknown as {
    fantome: Fantome
    onRetirer: (cle: string) => void
  }
  if (fantome.raison)
    return (
      <div
        data-fantome="echec"
        className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-5 border border-dashed border-trait-echec bg-carte p-3 text-center"
      >
        <p className="text-[11.5px] leading-snug text-echec">{fantome.raison}</p>
        <button
          type="button"
          aria-label="Retirer cet emplacement"
          onClick={() => onRetirer(fantome.cle)}
          className="nodrag nopan absolute top-1 right-1 h-[22px] w-[22px] rounded-5 text-[12px] leading-none text-encre-3 hover:text-signal"
        >
          ×
        </button>
      </div>
    )
  return (
    <div
      data-fantome="attente"
      aria-label="image en fabrication"
      className="flex h-full w-full animate-pulse items-center justify-center rounded-5 border border-dashed border-contour bg-papier-cote"
    >
      <span
        aria-hidden
        className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-[1.5px] border-encre-4 border-t-signal"
      />
    </div>
  )
}

// ── La barre ────────────────────────────────────────────────────────────────

type Memoire = { modele?: string; versions?: number }

function lireMemoire(): Memoire {
  try {
    const brut = window.localStorage.getItem(MEMOIRE)
    return brut ? (JSON.parse(brut) as Memoire) : {}
  } catch {
    return {}
  }
}

function ecrireMemoire(memoire: Memoire) {
  try {
    window.localStorage.setItem(MEMOIRE, JSON.stringify(memoire))
  } catch {
    // Un navigateur qui refuse le stockage garde simplement les défauts.
  }
}

/** La barre flottante, en bas au centre du plan : une phrase, 1/2/3, le
 *  modèle, et le bouton qui porte ce que ça coûte. Entrée lance. */
export function BarreDeFabrication({
  references,
  onOublierReferences,
  onLancer,
  champ,
}: {
  references: Carte[]
  onOublierReferences: () => void
  onLancer: (demande: {
    prompt: string
    modele: string
    proportions: string
    variations: number
    references: Reinjection[]
  }) => void
  champ: React.RefObject<HTMLInputElement | null>
}) {
  const [catalogue, setCatalogue] = useState<EtatCatalogue | null>(null)
  const [prompt, setPrompt] = useState("")
  const [choix, setChoix] = useState<string | null>(() => lireMemoire().modele ?? null)
  const [versions, setVersions] = useState<number>(() => {
    const v = lireMemoire().versions
    return VERSIONS.includes(v as Versions) ? (v as number) : 1
  })

  // Le catalogue dépend du nombre d'images jointes : un modèle qui n'en prend
  // aucune se grise avec sa raison dès qu'on en joint une.
  const nombre = references.length
  useEffect(() => {
    let vivant = true
    api
      .modeles(PROPORTIONS, nombre)
      .then((recu) => vivant && setCatalogue(recu))
      .catch(() => vivant && setCatalogue(null))
    return () => {
      vivant = false
    }
  }, [nombre])

  const modeles = catalogue?.modeles ?? []
  const retenu =
    modeles.find((m) => m.identifiant === choix && !m.refus)?.identifiant ??
    modeleParDefaut(modeles)
  const modele = modeles.find((m) => m.identifiant === retenu) ?? null
  const n = Math.min(versions, modele?.variations_max ?? versions)
  const pret = !!modele && prompt.trim().length > 0

  const lancer = () => {
    if (!pret || !modele) return
    onLancer({
      prompt: prompt.trim(),
      modele: modele.identifiant,
      proportions: modele.proportions.includes(PROPORTIONS)
        ? PROPORTIONS
        : (modele.proportions[0] ?? PROPORTIONS),
      variations: n,
      references: references.map((c) => ({
        asset: c.identifiant,
        role: ROLE_DES_CARTES,
        origine: "carte",
      })),
    })
    setPrompt("")
  }

  return (
    <div
      data-fabrique
      onDoubleClick={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-[14px] left-1/2 z-10 flex w-[min(640px,calc(100%-28px))] -translate-x-1/2 flex-col gap-1.5 rounded-8 border border-contour bg-carte px-[8px] py-[8px] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
    >
      {references.length > 0 && (
        <div className="mesure flex items-center gap-1.5 text-[10.5px] text-encre-3">
          <span>
            à partir de {references.length === 1 ? "1 image" : `${references.length} images`}
          </span>
          <button
            type="button"
            aria-label="Ne pas partir des images choisies"
            onClick={onOublierReferences}
            className="h-[22px] w-[22px] rounded-5 leading-none text-encre-4 hover:text-signal"
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Libelle aide="toile.fabriquer">Fabriquer</Libelle>
        <input
          ref={champ}
          aria-label="Décris une image"
          placeholder="Décris une image…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              lancer()
            }
          }}
          className="h-[30px] min-w-0 flex-1 rounded-7 border border-trait bg-papier px-[8px] text-[13px] text-encre placeholder:text-encre-4"
        />
      </div>
      {/* Les réglages sous la phrase : sur une toile étroite (réserve ouverte),
          une seule rangée écrasait le champ jusqu'à le rendre inutilisable. */}
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Nombre de versions" className="flex gap-0.5">
          {VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={versions === v}
              onClick={() => {
                setVersions(v)
                ecrireMemoire({ modele: choix ?? undefined, versions: v })
              }}
              className={[
                "mesure h-[30px] w-[30px] rounded-5 border text-[11px]",
                versions === v
                  ? "border-signal bg-carte text-signal"
                  : "border-trait bg-carte text-encre-3 hover:border-encre-3",
              ].join(" ")}
            >
              {v}
            </button>
          ))}
        </div>
        <select
          aria-label="Modèle"
          value={retenu ?? ""}
          onChange={(e) => {
            setChoix(e.target.value)
            ecrireMemoire({ modele: e.target.value, versions })
          }}
          className="h-[30px] max-w-[240px] min-w-0 flex-1 rounded-7 border border-trait bg-carte px-[8px] text-[11.5px] text-encre-controle"
        >
          {!modeles.length && <option value="">…</option>}
          {modeles.map((m) => (
            <option
              key={m.identifiant}
              value={m.identifiant}
              disabled={!!m.refus}
              title={m.refus ?? undefined}
            >
              {libelleModele(m)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pret}
          onClick={lancer}
          className="mesure h-[30px] shrink-0 rounded-7 bg-signal px-[14px] text-[11.5px] text-encre-sur-signal disabled:opacity-50"
        >
          {`Fabriquer ${n > 1 ? `${n} ` : ""}· ${annonce(modele, catalogue?.couts ?? {}, n)}`}
        </button>
      </div>
    </div>
  )
}
