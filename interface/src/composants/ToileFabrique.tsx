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
  type Bout,
  type Carte,
  type Envoi,
  type EtatCatalogue,
  type Generation,
  type Modele,
  type PhraseDeCarte,
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

/** Les deux tailles que la barre propose (TS4) — **le catalogue décide**, la
 *  barre ne fait que reconnaître ces deux mots parmi les résolutions qu'un
 *  modèle déclare. 512 par défaut : la toile essaie, elle ne livre pas. */
export const TAILLES = ["512", "1024"] as const
export type Taille = (typeof TAILLES)[number]

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

/** La taille est-elle possible pour ce modèle, et sinon pourquoi (TS4) —
 *  **le catalogue décide**. Un modèle qui ne déclare aucune résolution n'a pas
 *  cette notion : on ne peut pas dire qu'il refuse une taille qu'il ne
 *  connaît pas, donc rien n'est grisé — la demande part, et c'est le modèle
 *  qui répond de la sienne. Un modèle qui en déclare grise celles qu'il
 *  n'a pas, avec le nom qui manque. */
export function refusDeLaTaille(modele: Modele | null, taille: Taille): string | null {
  if (!modele) return null
  if (!modele.resolutions.length) return null
  if (modele.resolutions.includes(taille)) return null
  return `${modele.nom} ne rend pas ${taille}`
}

/** La taille retenue : celle qu'on visait si elle tient encore, sinon la
 *  première que le modèle rend, sinon celle qu'on visait quand même — un
 *  modèle qui n'a jamais fini de charger ne doit pas empêcher de choisir. */
export function tailleRetenue(modele: Modele | null, visee: Taille): Taille {
  if (!refusDeLaTaille(modele, visee)) return visee
  const libre = TAILLES.find((t) => !refusDeLaTaille(modele, t))
  return libre ?? visee
}

/** Le morceau de la vitesse déclarée qui parle de cette taille-ci — « ≈ 12
 *  secondes en 512, ≈ 16 en 1024 » ne doit annoncer que la moitié qui compte
 *  (TS4). Aucune clause reconnue : la phrase entière, plutôt qu'un silence. */
function vitessePourLaTaille(vitesse: string | null, taille: Taille): string | null {
  if (!vitesse) return null
  const clause = vitesse.split(",").find((bout) => bout.includes(taille))
  return (clause ?? vitesse).trim()
}

/** Ce que le bouton annonce pour un lot réparti sur `appels` appels, à la
 *  `taille` choisie (TS9).
 *
 *  **Un modèle local annonce un temps, et ce temps ne se multiplie pas** (8ter)
 *  : le premier tirage charge le modèle, les suivants non — `appels` ne
 *  compte donc pour rien ici. Un modèle payant annonce le prix d'un appel,
 *  **multiplié par le nombre d'appels** que ce choix demande (point 8
 *  d'AGENTS.md : « une planche coûte le prix d'un appel, quel que soit ce
 *  qu'elle porte » — deux versions qu'un seul appel rend tiennent dans un
 *  seul prix, trois qu'un modèle ne rend qu'une par appel en payent trois) —
 *  ou « Coût inconnu » quand il n'a jamais été appelé ici. **Le prix ne
 *  dépend pas de la taille** — seul le temps d'un modèle local en dépend.
 *
 *  **Deux sources pour ce temps, et elles ne savent pas la même chose**
 *  (défaut 6 de la relecture du 24 septembre 2026). Tant qu'aucun tirage n'a
 *  réussi ici, `vitesse` est la phrase déclarée par le style sc-clone, qui
 *  distingue déjà 512 et 1024 (« ≈ 12 s en 512, ≈ 16 en 1024 ») —
 *  `vitessePourLaTaille` en garde la bonne moitié. **Une fois mesuré**,
 *  `temps.secondes` est la médiane de *tous* les tirages faits ici, 512 et
 *  1024 confondus : la file locale (`atelier/services/file_locale.py`) ne
 *  garde pas la taille de chaque étape, seulement sa durée — corriger ça
 *  touche le service qui prépare l'appel (`atelier/services/generation.py`),
 *  hors de cette tranche-ci. Le bouton le dit plutôt que de laisser croire à
 *  une mesure par taille qu'il n'a pas. */
export function annonce(
  modele: Modele | null,
  couts: Record<string, number>,
  appels: number,
  taille: Taille = "512",
): string {
  if (!modele) return "aucun modèle"
  if (modele.locale) {
    const temps = (modele as Modele & ModeleAvecReference).temps
    if (temps?.secondes != null) {
      const mesure = tempsParImage(temps)
      return mesure ? `${mesure}, moyenne toutes tailles` : "temps non mesuré"
    }
    return vitessePourLaTaille(temps?.vitesse ?? null, taille) ?? "temps non mesuré"
  }
  const unitaire = couts[modele.identifiant]
  return prix(unitaire === undefined ? null : unitaire * appels, modele.unite)
}

/** Les cartes prises comme référence — **le bouton prend, la sélection ne
 *  décide plus rien en silence** (TS6, retour de l'auteur du 23 septembre :
 *  « à partir de 1 image » sans qu'il sache pourquoi). `prises` est la liste
 *  explicite qu'écrit « Prendre comme référence », dans l'ordre où on les a
 *  prises. **Seules les images arrivées partent** : une note, une adresse
 *  encore en attente, ou une carte prise puis renvoyée en réserve n'ont pas
 *  d'image à envoyer — elle disparaît alors de la barre sans qu'il y ait de
 *  croix à cliquer, l'absence dans la vignette est la seule chose qui reste à
 *  lire. */
export function referencesPrises(cartes: readonly Carte[], prises: readonly string[]): Carte[] {
  const parIdentifiant = new Map(cartes.map((c) => [c.identifiant, c]))
  const vues = new Set<string>()
  const sortie: Carte[] = []
  for (const identifiant of prises) {
    if (vues.has(identifiant)) continue
    vues.add(identifiant)
    const carte = parIdentifiant.get(identifiant)
    if (carte && carte.genre === "image" && carte.statut === "prete") sortie.push(carte)
  }
  return sortie
}

/** « Développer ce sujet » (TS10) : la carte à relier au moment du clic sur
 *  Fabriquer, **si elle est toujours parmi ce qui part**. Vérifié à cet
 *  instant précis, et non juste mémorisé au clic sur « Développer » : une
 *  croix sur sa vignette entre les deux doit annuler la liaison comme elle
 *  annule déjà la référence — sinon le résultat se relierait à une image que
 *  la barre elle-même dit ne plus envoyer. */
export function origineDeLiaison(
  origineDeveloppement: string | null,
  references: readonly Carte[],
): string[] | undefined {
  if (!origineDeveloppement) return undefined
  return references.some((c) => c.identifiant === origineDeveloppement)
    ? [origineDeveloppement]
    : undefined
}

/** Le plafond d'un modèle **ne cède jamais devant ce que l'auteur a joint**
 *  (AGENTS.md, point 4) : si les références prises dépassent ce que le
 *  modèle choisi accepte, la barre le dit au lieu de lancer — elle ne rogne
 *  jamais la liste en silence pour faire tenir l'appel. */
export function refusDesReferences(modele: Modele | null, nombre: number): string | null {
  if (!modele || nombre <= modele.references_max) return null
  return `${modele.nom} accepte au plus ${modele.references_max} image${modele.references_max > 1 ? "s" : ""} en référence, ${nombre} sont prises`
}

/** **Le rôle des cartes jointes : l'image qu'on modifie** (`edition`). La
 *  demande est « à partir d'une image » — la reprendre, pas s'en inspirer de
 *  loin. Une carte ne donne aucune filiation (la bibliothèque ne la connaît
 *  pas), donc rien d'autre ne change côté serveur. */
export const ROLE_DES_CARTES = "edition" as const

/** « Développer ce sujet » (TS10) : trois amorces, tirées au hasard à chaque
 *  déclenchement — elles montrent *quoi* écrire sans imposer *quoi*, un champ
 *  vide avec un exemple grisé plutôt qu'une phrase toute faite qu'on efface. */
export const EXEMPLES_DEVELOPPEMENT = [
  "une variante plus sombre",
  "la même de dos",
  "sans la cape",
] as const

/** « Combiner » (TS7) : même motif que `EXEMPLES_DEVELOPPEMENT`, pour
 *  plusieurs cartes prises à la fois plutôt qu'une seule. */
export const EXEMPLES_COMBINAISON = [
  "le personnage avec cette tenue",
  "les deux dans la même scène",
  "l'un à côté de l'autre",
] as const

/** Ce que « Développer ce sujet » envoie à la barre : vider le champ, y
 *  remettre le curseur, montrer un exemple. Même motif que `Reprise` — une
 *  `cle` qui change à chaque clic, pour que développer deux fois la même
 *  image de suite redéclenche l'effet la seconde fois aussi. */
export type Developpement = { cle: string; exemple: string }

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
  /** « Développer ce sujet » (TS10) : les cartes dont ce fantôme, une fois
   *  posé, doit être relié — un lien de la toile par identifiant, tiré une
   *  fois l'asset devenu une carte. Vide pour une fabrication ordinaire. */
  origines?: string[]
}

const SONDE_MS = 1500

/** La fabrication elle-même : lancer, suivre, poser.
 *
 *  **On sonde la génération, on n'écoute pas le flux.** Le flux d'événements
 *  vit dans `App` et nourrit le chantier de toutes les générations ; le brancher
 *  jusqu'ici aurait traversé trois écrans pour une seule question — *cet
 *  emplacement-là est-il revenu ?* — que `GET /generations/{id}` pose seul.
 *  Plusieurs fabrications tournent en même temps : chacune a ses fantômes.
 *
 *  `lier` est **la même route que l'écran** (`Toile.tsx`, `tirer`) : « Développer
 *  ce sujet » (TS10) la passe pour que chaque image posée se relie à celle
 *  dont elle est partie, sans que ce fichier invente une seconde façon de
 *  tirer un trait — et TS7 la réutilisera pour « Combiner » et « Encore ». */
export function useFabricationSurToile(
  onErreur: (raison: string) => void,
  lier?: (de: Bout, vers: Bout) => void,
) {
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
      const { carte } = await api.poserAssetSurToile(projet, `${generation.identifiant}-${rang}`, [
        fantome.place.x,
        fantome.place.y,
      ])
      // **La liaison ne remet pas la pose en cause.** L'image est arrivée et
      // posée ; si le trait ne se tire pas (un bout disparu entre-temps, par
      // exemple), la carte reste — elle n'a rien coûté de plus à garder sans
      // son lien, alors que la faire disparaître aurait perdu une image payée.
      if (carte?.identifiant && fantome.origines?.length) {
        for (const origine of fantome.origines) {
          if (origine !== carte.identifiant)
            lier?.({ genre: "carte", valeur: origine }, { genre: "carte", valeur: carte.identifiant })
        }
      }
      if (vivant.current) changer((liste) => liste.filter((f) => f.cle !== fantome.cle))
    } catch (erreur) {
      const raison = erreur instanceof Refus ? erreur.message : "l'image n'a pas pu être posée"
      if (vivant.current)
        changer((liste) => liste.map((f) => (f.cle === fantome.cle ? { ...f, raison } : f)))
    }
  }

  /** Lancer, pour **un seul appel** — jusqu'à `places.length` images, jamais
   *  plus que ce que le modèle rend en un coup. Chaque appel a son propre
   *  lot de fantômes, son propre suivi, et son propre échec : c'est ce qui
   *  fait qu'un appel raté n'efface pas les fantômes des autres (TS9). */
  const appeler = useCallback(
    async (demande: {
      prompt: string
      modele: string
      proportions: string
      taille: Taille | ""
      references: Reinjection[]
      repris: boolean
      places: Place[]
      /** TS10 : les cartes à relier une fois chaque place posée. */
      origines?: string[]
    }) => {
      const lot = crypto.randomUUID().replace(/-/g, "")
      const nes: Fantome[] = demande.places.map((place, rang) => ({
        cle: `${lot}-${rang}`,
        place,
        generation: null,
        rang,
        raison: null,
        origines: demande.origines,
      }))
      changer((liste) => [...liste, ...nes])
      try {
        const generation = await api.generer({
          modele: demande.modele,
          prompt: demande.prompt,
          prompt_negatif: "",
          proportions: demande.proportions,
          resolution: demande.taille || null,
          variations: demande.places.length,
          options: {},
          identifiant: lot,
          references: demande.references,
          echelle: "",
          repris: demande.repris,
          // **La toile est l'endroit où l'on essaie** (TS4) : ce qui en sort
          // n'est pas encore une chose du jeu — aucun modèle, à la différence
          // de `repris`, ne peut désactiver ce drapeau.
          brut: true,
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

  /** Lancer une fabrication entière — **autant d'appels qu'il en faut** au
   *  plafond du modèle (TS9, retour de l'auteur du 23 septembre : « 3 » ne
   *  faisait qu'une image avec un style local qui ne rend qu'une variation
   *  par appel, en silence). `places` porte toutes les images voulues ;
   *  découpées en lots d'au plus `variations_max`, chacun part dans son
   *  propre appel, suivi et posé pour son propre compte.
   *
   *  **Un appel à la fois, décidé ici** : la file ComfyUI d'un modèle local
   *  sérialise de toute façon les appels simultanés, et les envoyer l'un
   *  après l'autre est ce qu'il y a de plus simple à suivre sans rien
   *  perdre — un échec sur l'un n'empêche pas les suivants de partir. */
  const lancer = useCallback(
    async (demande: {
      prompt: string
      modele: string
      proportions: string
      /** Vide quand le modèle ne connaît pas la notion (`refusDeLaTaille`) —
       *  la demande part alors sans, comme avant TS4. */
      taille: Taille | ""
      /** Ce qu'un seul appel de ce modèle sait rendre — le catalogue le dit
       *  (`Modele.variations_max`). Jamais 0 : un modèle qui ne le déclare
       *  pas rend une image par appel. */
      variations_max: number
      references: Reinjection[]
      /** **Le texte tapé part seul par défaut** — la case « avec le style du
       *  jeu » de la barre la fait passer à `false` (US-159/US-160 réemployés :
       *  `repris` décide déjà de ne pas replier la bible en tête). */
      repris: boolean
      places: Place[]
      /** TS10 : reconduites à chaque appel du lot — chaque variante relie à
       *  la même carte d'origine. */
      origines?: string[]
    }) => {
      const max = Math.max(1, demande.variations_max)
      for (let i = 0; i < demande.places.length; i += max) {
        await appeler({
          prompt: demande.prompt,
          modele: demande.modele,
          proportions: demande.proportions,
          taille: demande.taille,
          references: demande.references,
          repris: demande.repris,
          places: demande.places.slice(i, i + max),
          origines: demande.origines,
        })
      }
    },
    [appeler],
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

type Memoire = { modele?: string; versions?: number; taille?: string; avecStyle?: boolean }

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

/** **Ce qui part, relu avant de cliquer** (TS4) — « comme partout ailleurs » :
 *  le texte exact, la taille, les références. Rien n'est recomposé ici :
 *  `api.envoi` est l'aperçu que le serveur sait déjà rendre pour l'écran de
 *  confirmation (E14), et c'est le même qu'on rouvre en petit — deux
 *  compositions du même texte auraient fini par diverger.
 *
 *  Fermé par défaut, pour ne pas payer un aller-retour à chaque frappe : il ne
 *  se demande que quand on l'ouvre, et se redemande tant qu'il reste ouvert et
 *  que la demande change sous lui. */
function RepliCeQuiPart({
  prompt,
  modele,
  taille,
  repris,
  references,
}: {
  prompt: string
  modele: Modele | null
  taille: Taille
  repris: boolean
  references: Carte[]
}) {
  const [ouvert, setOuvert] = useState(false)
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const propre = prompt.trim()

  useEffect(() => {
    if (!ouvert || !modele || !propre) {
      setEnvoi(null)
      return
    }
    let vivant = true
    setErreur(null)
    api
      .envoi({
        prompt: propre,
        modele: modele.identifiant,
        repris,
        variations: 1,
        references: references.map((c) => ({
          asset: c.identifiant,
          role: ROLE_DES_CARTES,
          origine: "carte",
        })),
      })
      .then((recu) => vivant && setEnvoi(recu))
      .catch(() => vivant && setErreur("ce qui part ne se relit pas pour l'instant"))
    return () => {
      vivant = false
    }
  }, [ouvert, modele, propre, repris, references])

  return (
    <div className="mesure text-[10.5px] text-encre-3">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="hover:text-encre"
      >
        {ouvert ? "▾" : "▸"} Ce qui part
      </button>
      {ouvert && (
        <div className="mt-1 flex flex-col gap-1 rounded-5 border border-trait bg-papier-cote p-[8px]">
          {!propre && <p className="text-encre-4">Rien à fabriquer — le champ est vide.</p>}
          {propre && erreur && <p className="text-echec">{erreur}</p>}
          {propre && !erreur && !envoi && <p className="text-encre-4">…</p>}
          {propre && envoi && (
            <>
              <p className="whitespace-pre-wrap text-encre">{envoi.texte}</p>
              <p>
                {taille} px
                {references.length > 0 &&
                  ` · ${references.length === 1 ? "1 image jointe" : `${references.length} images jointes`}`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Ce que « Reprendre ce texte » (TS5) envoie à la barre — la phrase d'une
 *  carte, plus une `cle` qui change à chaque clic. Sans elle, reprendre deux
 *  fois la même carte à la file ne rejouerait rien : l'effet qui applique la
 *  reprise se déclenche sur un changement, et le second clic porterait la
 *  même phrase que le premier. */
export type Reprise = PhraseDeCarte & { cle: string }

/** Ce que la barre transmet pour lancer une fabrication (TS9). `variations`
 *  est le nombre total d'images voulues, **jamais rogné en silence** ; c'est
 *  Toile qui le découpe en autant d'appels que `variations_max` — ce qu'un
 *  seul appel du modèle choisi sait rendre — l'exige. */
export type DemandeFabrication = {
  prompt: string
  modele: string
  proportions: string
  taille: Taille
  variations: number
  variations_max: number
  references: Reinjection[]
  repris: boolean
}

/** La barre flottante, en bas au centre du plan : une phrase, 1/2/3, le
 *  modèle, et le bouton qui porte ce que ça coûte. Entrée lance. */
export function BarreDeFabrication({
  references,
  onRetirerReference,
  onLancer,
  champ,
  reprise,
  developpement,
}: {
  references: Carte[]
  /** Retirer **une seule** référence prise — la croix de sa vignette. */
  onRetirerReference: (identifiant: string) => void
  onLancer: (demande: DemandeFabrication) => void
  champ: React.RefObject<HTMLInputElement | null>
  /** « Reprendre ce texte » (TS5) : la phrase, le modèle et la taille d'une
   *  carte reviennent dans la barre, prêts à corriger et relancer. `null` au
   *  repos — la barre ne réagit qu'au changement de `cle`. */
  reprise?: Reprise | null
  /** « Développer ce sujet » (TS10) : vide le champ, y remet le curseur, et
   *  montre un exemple grisé. `null` au repos — même règle de `cle` que
   *  `reprise`, pour que développer deux fois de suite redéclenche l'effet. */
  developpement?: Developpement | null
}) {
  const [catalogue, setCatalogue] = useState<EtatCatalogue | null>(null)
  const [prompt, setPrompt] = useState("")
  const [choix, setChoix] = useState<string | null>(() => lireMemoire().modele ?? null)
  const [versions, setVersions] = useState<number>(() => {
    const v = lireMemoire().versions
    return VERSIONS.includes(v as Versions) ? (v as number) : 1
  })
  const [taille, setTaille] = useState<Taille>(() => {
    const t = lireMemoire().taille
    return (TAILLES as readonly string[]).includes(t ?? "") ? (t as Taille) : "512"
  })
  // **Décochée par défaut** (TS4, décision « à trancher ») : le texte tapé
  // part seul, sans la bible du jeu repliée en tête ni ses consignes de
  // planche — c'est la même chose que « reprendre le texte » (US-159/US-160),
  // pour une raison qui n'a rien à voir avec la reprise : on **essaie**.
  const [avecStyle, setAvecStyle] = useState<boolean>(() => lireMemoire().avecStyle ?? false)

  // **« Reprendre ce texte »** (TS5) : la phrase, le modèle et la taille d'une
  // carte remplacent ceux de la barre. Sur `reprise.cle`, jamais sur les
  // champs eux-mêmes — sinon reprendre deux fois la même carte ne
  // déclencherait rien la seconde fois, `cle` seule change à chaque clic.
  // **La case « avec le style du jeu » suit aussi** : reprendre veut dire
  // relancer *exactement* la même demande pour la corriger, pas la moitié
  // d'entre elle.
  useEffect(() => {
    if (!reprise) return
    setPrompt(reprise.texte)
    setChoix(reprise.modele)
    if ((TAILLES as readonly string[]).includes(reprise.resolution ?? ""))
      setTaille(reprise.resolution as Taille)
    setAvecStyle(!reprise.repris)
    champ.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprise?.cle])

  // **« Développer ce sujet »** (TS10) : le champ se vide, le curseur s'y
  // pose, et un exemple grisé dit quoi écrire — sur `developpement.cle`, pour
  // la même raison que `reprise.cle` : développer deux fois la même image de
  // suite doit redéclencher l'effet la seconde fois aussi.
  const [exemple, setExemple] = useState<string | null>(null)
  useEffect(() => {
    if (!developpement) return
    setPrompt("")
    setExemple(developpement.exemple)
    champ.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developpement?.cle])

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
  // **Le nombre voulu n'est plus rogné en silence** (TS9, retour de l'auteur
  // du 23 septembre : « 3 » ne faisait qu'une image avec un style local qui
  // ne rend qu'une variation par appel). `n` est ce que l'auteur a demandé ;
  // `appels` est ce que ça coûte de coups de fil, arrondi au-dessus — c'est
  // lui, et seulement lui, qui multiplie le prix (point 8 d'AGENTS.md).
  const n = versions
  const variationsMax = Math.max(1, modele?.variations_max ?? n)
  const appels = Math.max(1, Math.ceil(n / variationsMax))
  const tailleRetenu = tailleRetenue(modele, taille)
  // **Le plafond ne cède jamais devant ce que l'auteur a joint** (point 4) :
  // trop de références prises pour ce modèle refuse de partir, et le dit au
  // lieu de lancer un appel qui aurait rogné la liste en silence.
  const refusReferences = refusDesReferences(modele, references.length)
  const pret = !!modele && prompt.trim().length > 0 && !refusReferences

  const lancer = () => {
    if (!pret || !modele) return
    onLancer({
      prompt: prompt.trim(),
      modele: modele.identifiant,
      proportions: modele.proportions.includes(PROPORTIONS)
        ? PROPORTIONS
        : (modele.proportions[0] ?? PROPORTIONS),
      taille: tailleRetenu,
      variations: n,
      variations_max: variationsMax,
      references: references.map((c) => ({
        asset: c.identifiant,
        role: ROLE_DES_CARTES,
        origine: "carte",
      })),
      repris: !avecStyle,
    })
    setPrompt("")
  }

  return (
    <div
      data-fabrique
      onDoubleClick={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-[14px] left-1/2 z-10 flex w-[min(640px,calc(100%-28px))] -translate-x-1/2 flex-col gap-1.5 rounded-8 border border-contour bg-carte px-[8px] py-[8px] shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
    >
      {/* **Les références prises, en vignettes** (TS6) — ce qui part se voit
          avant de cliquer, chacune avec sa croix : plus de liste qui décide
          en silence depuis la sélection de la toile, seul ce qui a été
          explicitement pris paraît ici. */}
      {references.length > 0 && (
        <div
          aria-label={`${references.length === 1 ? "1 image prise en référence" : `${references.length} images prises en référence`}`}
          className="mesure flex flex-wrap items-center gap-1.5"
        >
          {references.map((carte) => (
            <div
              key={carte.identifiant}
              className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-5 border border-trait bg-pourtour"
            >
              <img
                src={api.imageCarte(carte.identifiant, carte.empreinte)}
                alt={carte.note || "référence"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="Retirer cette référence"
                onClick={() => onRetirerReference(carte.identifiant)}
                className="absolute top-0 right-0 flex h-[14px] w-[14px] items-center justify-center rounded-bl-5 bg-carte leading-none text-encre-4 hover:text-signal"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {refusReferences && (
        <p className="mesure text-[10.5px] leading-snug text-echec">{refusReferences}</p>
      )}
      <div className="flex items-center gap-2">
        <Libelle aide="toile.fabriquer">Fabriquer</Libelle>
        <input
          ref={champ}
          aria-label="Décris une image"
          placeholder={exemple ?? "Décris une image…"}
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
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Nombre de versions" className="flex gap-0.5">
          {VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={versions === v}
              onClick={() => {
                setVersions(v)
                ecrireMemoire({ modele: choix ?? undefined, versions: v, taille, avecStyle })
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
        <div role="group" aria-label="Taille" className="flex gap-0.5">
          {TAILLES.map((t) => {
            const refus = refusDeLaTaille(modele, t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={tailleRetenu === t}
                disabled={!!refus}
                title={refus ?? undefined}
                onClick={() => {
                  setTaille(t)
                  ecrireMemoire({ modele: choix ?? undefined, versions, taille: t, avecStyle })
                }}
                className={[
                  "mesure h-[30px] rounded-5 border px-[8px] text-[11px] disabled:opacity-40",
                  tailleRetenu === t
                    ? "border-signal bg-carte text-signal"
                    : "border-trait bg-carte text-encre-3 hover:border-encre-3",
                ].join(" ")}
              >
                {t}
              </button>
            )
          })}
        </div>
        <select
          aria-label="Modèle"
          value={retenu ?? ""}
          onChange={(e) => {
            setChoix(e.target.value)
            ecrireMemoire({ modele: e.target.value, versions, taille, avecStyle })
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
        <label className="mesure flex shrink-0 items-center gap-1 text-[10.5px] text-encre-3">
          <input
            type="checkbox"
            checked={avecStyle}
            onChange={(e) => {
              setAvecStyle(e.target.checked)
              ecrireMemoire({ modele: choix ?? undefined, versions, taille, avecStyle: e.target.checked })
            }}
          />
          avec le style du jeu
        </label>
        <button
          type="button"
          disabled={!pret}
          title={refusReferences ?? undefined}
          onClick={lancer}
          className="mesure h-[30px] shrink-0 rounded-7 bg-signal px-[14px] text-[11.5px] text-encre-sur-signal disabled:opacity-50"
        >
          {refusReferences
            ? "Trop de références pour ce modèle"
            : `Fabriquer ${n > 1 ? `${n} ` : ""}· ${annonce(modele, catalogue?.couts ?? {}, appels, tailleRetenu)}`}
        </button>
      </div>
      <RepliCeQuiPart
        prompt={prompt}
        modele={modele}
        taille={tailleRetenu}
        repris={!avecStyle}
        references={references}
      />
    </div>
  )
}
