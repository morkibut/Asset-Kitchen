/**
 * Le prochain geste d'un sujet — TS8.
 *
 * Le 23 septembre 2026, à l'usage : « je crée le personnage, j'arrive dans
 * l'onglet Objectifs, rien ne me dit ce que je dois faire ». Le bouton de
 * `TS3` (« Faire la planche des directions ») existait déjà — enterré tout
 * en bas de l'onglet *Images*, section *Ses références*, bloc *Planche*, à
 * la place de « rien encore ». Un sujet neuf n'a jamais de raison d'y aller
 * en premier.
 *
 * **Une seule règle d'arrivée pour tout sujet neuf** (réglée avec `RV15`,
 * qui ouvre le sujet neuf sur l'onglet *Images* : ce bandeau y apparaît
 * donc tout de suite, sans second geste). Elle se lit sur ce que le sujet a
 * déjà, jamais sur la façon dont il est né :
 *
 * 1. **Rien nulle part** → « Fabriquer sa première image ». Le geste le
 *    plus simple pour le cas le plus dépourvu : ni concept art, ni image.
 * 2. **Un concept art (ou un portrait) et une image déjà posée, mais aucune
 *    planche choisie** → « C'est la référence ». Une planche vaut aussi
 *    pour un jeu à une seule vue (`TS3`, décision 3) : même une image seule
 *    en est une valable, et la choisir est plus urgent que d'en refaire
 *    une — sans ça, un double clic sur « Faire la planche » repaierait un
 *    appel pour rien.
 * 3. **Un concept art (ou un portrait) et rien de posé encore** → « Faire
 *    la planche des directions » (`TS3`), l'image qui servira à côté.
 * 4. **Une planche déjà choisie** → ce bandeau n'a plus rien à imposer : le
 *    sujet est autonome, et le bouton *Fabriquer…* du haut de la page reste
 *    la porte du geste suivant (une pose, une animation) — proposé un à un,
 *    comme il l'a toujours fait. Un second bouton ici aurait dit deux fois
 *    la même chose.
 *
 * **Ne réécrit aucun geste existant** : « Faire la planche » et
 * « C'est la référence » appellent les mêmes routes que le bloc *Planche*
 * de `ImagesDuSujet.tsx` (`api.premierePlanche`, `api.choisirLaPlanche`) —
 * la même résolution, montrée à deux endroits, jamais une seconde règle.
 * Le bloc du bas continue de servir qui préfère ne pas quitter l'onglet
 * *Images* ; les deux relisent le même sujet et retombent silencieusement
 * dès qu'un geste depuis l'autre l'a déjà fait.
 */
import { useEffect, useState } from "react"
import {
  api,
  Refus,
  type Asset,
  type Personnage,
  type PremierePlanche,
  type ReferencesDeLaChose,
} from "../api"
import { rangerLaLigne } from "./ImagesDuSujet"

const CARTE =
  "flex flex-col gap-[14px] rounded-10 border border-trait bg-carte p-[22px] sm:flex-row sm:items-center sm:justify-between"
// **34 px** : la même vignette de référence que `SelecteurDUsage`
// (`ImagesDuSujet.tsx`) — la liste fermée des hauteurs de contrôle
// (`docs/DESIGN.md` § Spacing) ne porte que 34 · 30 · 26 · 22, et une
// vignette de front à 128 (§ Largeurs de colonne) est pensée pour un portrait
// plein cadre, pas pour ce bandeau.
const VIGNETTE =
  "h-[34px] w-[34px] shrink-0 overflow-hidden rounded-7 bg-pourtour"
const GRAND_BOUTON =
  "h-[34px] shrink-0 self-start rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal hover:bg-echec disabled:opacity-50 sm:self-auto"

/** La candidate à promouvoir planche — la retenue, sinon la plus récente,
 *  toutes cases confondues. Le seul état que ce bandeau lit sur les images
 *  du sujet : y en a-t-il au moins une, et laquelle proposer. */
function imageCandidate(personnage: Personnage): Asset | null {
  const toutes = personnage.cases.flatMap((c) => c.images)
  if (toutes.length === 0) return null
  const { retenue, gardees } = rangerLaLigne(toutes)
  return retenue ?? gardees.at(-1) ?? null
}

type Geste =
  | { genre: "premiere-image" }
  | { genre: "planche-a-choisir"; candidat: Asset }
  | { genre: "planche-a-faire" }

/** **La règle, en une phrase par cas** — voir l'en-tête du fichier. `null` :
 *  rien à proposer ici, le bandeau ne se montre pas. */
export function calculerLeGeste(
  personnage: Personnage,
  references: ReferencesDeLaChose | null,
): Geste | null {
  const planchePromue = (references?.lignes ?? []).some((l) => l.usage === "planche")
  if (planchePromue) return null

  const aUneSource = personnage.concept_arts.length > 0 || Boolean(personnage.image_de_reference)
  if (aUneSource) {
    const candidat = imageCandidate(personnage)
    return candidat ? { genre: "planche-a-choisir", candidat } : { genre: "planche-a-faire" }
  }

  return personnage.cases.some((c) => c.images.length > 0) ? null : { genre: "premiere-image" }
}

/** L'image qui servira de design — la carte de concept art, montrée telle
 *  qu'elle est déjà composée par `references_de_la_chose` (`montre`, une
 *  carte ou un asset selon d'où elle vient). `null` sans concept art connu :
 *  le portrait seul n'a alors rien à montrer ici sans un second appel. */
function vignetteDeLaSource(references: ReferencesDeLaChose | null): string | null {
  const ligne = (references?.lignes ?? []).find((l) => l.provenance === "concept art")
  if (!ligne?.montre) return null
  return ligne.montre.sorte === "carte"
    ? api.imageCarte(ligne.montre.carte.identifiant, ligne.montre.carte.empreinte)
    : api.vignette(ligne.montre.asset.identifiant, ligne.montre.asset.empreinte, 68)
}

export function ProchainGeste({
  personnage,
  onPersonnage,
  onPremierePlanche,
  onAllerALaToile,
  onFabriquerLaPremiereImage,
  onErreur,
}: {
  personnage: Personnage
  onPersonnage?: (personnage: Personnage) => void
  /** **Faire la planche des directions** (`TS3`) : arme l'atelier avec ce
   *  que le serveur a rendu. Sans lui, cet état du bandeau ne se montre
   *  pas — comme le bouton du bloc *Planche*. */
  onPremierePlanche?: (personnage: Personnage, reponse: PremierePlanche) => void
  onAllerALaToile?: () => void
  /** « Fabriquer sa première image » (`RV15`) : le même geste que le bouton
   *  *Fabriquer…* du haut de la page — passé ici plutôt que recalculé, pour
   *  qu'il n'existe qu'un seul endroit qui choisisse la première pose. */
  onFabriquerLaPremiereImage: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [references, setReferences] = useState<ReferencesDeLaChose | null>(null)
  useEffect(() => {
    let vivant = true
    void api
      .referencesDeLaChose(personnage.identifiant)
      .then((recu) => { if (vivant) setReferences(recu ?? null) })
      .catch(() => { if (vivant) setReferences(null) })
    return () => { vivant = false }
    // **`references.join` et non le tableau** : le même repère que
    // `ImagesDuSujet.tsx` — promouvoir depuis l'autre volet de la même
    // fiche change la liste sans changer l'identité du sujet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnage.identifiant, personnage.references.join(",")])

  const [preparant, setPreparant] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const [choisissant, setChoisissant] = useState(false)

  // **Tant que la première lecture des références n'est pas revenue, rien ne
  // se montre** : sans cette garde, un sujet qui a déjà sa planche verrait
  // le bandeau clignoter une fraction de seconde avant de disparaître.
  if (!references) return null

  const geste = calculerLeGeste(personnage, references)
  if (!geste) return null

  const demanderLaPlanche = async () => {
    setPreparant(true)
    setRefus(null)
    try {
      const reponse = await api.premierePlanche(personnage.identifiant)
      onPremierePlanche?.(personnage, reponse)
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "rien à reproduire pour ce sujet")
    } finally {
      setPreparant(false)
    }
  }

  const choisirLaPlanche = async (asset: string) => {
    setChoisissant(true)
    try {
      const rendu = await api.choisirLaPlanche(personnage.identifiant, asset)
      onPersonnage?.(rendu.personnage)
      setReferences(rendu.references)
    } catch (erreur) {
      onErreur(erreur, "la référence a été refusée")
    } finally {
      setChoisissant(false)
    }
  }

  if (geste.genre === "premiere-image")
    return (
      <div data-prochain-geste="premiere-image" className={CARTE}>
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Prochain geste</p>
          <h2 className="mt-[4px] font-serif text-[25px] leading-[1.15] text-encre">
            Fabriquer sa première image
          </h2>
          <p className="mt-[4px] text-[13px] text-encre-3">
            Rien encore sur ce sujet : une image, et il y a quelque chose à regarder.
          </p>
        </div>
        <button type="button" className={GRAND_BOUTON} onClick={onFabriquerLaPremiereImage}>
          Fabriquer sa première image
        </button>
      </div>
    )

  // **Comme le bloc *Planche* de `ImagesDuSujet.tsx`** : sans `onPremierePlanche`,
  // le geste n'a nulle part où s'armer — il ne se montre pas plutôt que de
  // tourner pour rien.
  if (geste.genre === "planche-a-faire" && !onPremierePlanche) return null

  if (geste.genre === "planche-a-faire") {
    const source = vignetteDeLaSource(references)
    if (refus)
      return (
        <div data-prochain-geste="planche-refusee" className={CARTE}>
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Prochain geste</p>
            <p className="mt-[4px] text-[13px] text-encre-3">{refus}</p>
          </div>
          {onAllerALaToile && (
            <button
              type="button"
              onClick={onAllerALaToile}
              className="self-start text-[12.5px] text-signal hover:opacity-70"
            >
              Aller à la toile ›
            </button>
          )}
        </div>
      )
    return (
      <div data-prochain-geste="planche-a-faire" className={CARTE}>
        <div className="flex items-center gap-[14px]">
          {source && (
            <span className={VIGNETTE}>
              <img src={source} alt="" className="h-full w-full object-contain" />
            </span>
          )}
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Prochain geste</p>
            <h2 className="mt-[4px] font-serif text-[25px] leading-[1.15] text-encre">
              Faire la planche des directions
            </h2>
            <p className="mt-[4px] text-[13px] text-encre-3">
              Sa pose de repos, dans les directions du jeu, d'après son concept art — rien n'est
              payé ici.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={preparant}
          onClick={() => void demanderLaPlanche()}
          className={GRAND_BOUTON}
        >
          {preparant ? "Ça se prépare…" : "Faire la planche des directions"}
        </button>
      </div>
    )
  }

  // geste.genre === "planche-a-choisir"
  return (
    <div data-prochain-geste="planche-a-choisir" className={CARTE}>
      <div className="flex items-center gap-[14px]">
        <span className={VIGNETTE}>
          <img
            src={api.vignette(geste.candidat.identifiant, geste.candidat.empreinte, 68)}
            alt=""
            className="h-full w-full object-contain"
          />
        </span>
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Prochain geste</p>
          <h2 className="mt-[4px] font-serif text-[25px] leading-[1.15] text-encre">
            Sa planche est arrivée
          </h2>
          <p className="mt-[4px] text-[13px] text-encre-3">
            Choisis-la : ses vues se rangent dans les directions du sujet.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={choisissant}
        onClick={() => void choisirLaPlanche(geste.candidat.identifiant)}
        className={GRAND_BOUTON}
      >
        C'est la référence
      </button>
    </div>
  )
}
