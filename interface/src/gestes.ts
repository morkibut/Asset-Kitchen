// Les gestes qui arment l'appel suivant, sans rien dépenser.
//
// Armer une case, garder une correction sur la chose du jeu, réinjecter une
// image dans l'un de ses rôles, reprendre les réglages d'une génération, joindre
// une référence sans quitter la fenêtre de confirmation. **Aucun ne paie** :
// tous préparent ce qui partira, et c'est la barre qui paie qui le fait partir.
//
// Ils vivaient en clair dans `App.tsx` ; `C4` les en sort avec la galerie.

import { useEffect } from "react"
import {
  api,
  type Asset,
  type Bibliotheque,
  type LigneQuiPart,
  type Personnage,
  type Piece,
  type Pose,
  type Reinjection,
  type Role,
  type Tri,
} from "./api"
import type { Racine } from "./lieux"
import type { CibleDeLAppel } from "./paiement"

type Pose_<T> = React.Dispatch<React.SetStateAction<T>>

export type CeQueLesGestesLisent = {
  bibliotheque: Bibliotheque
  choixDeReference: boolean
  cible: CibleDeLAppel | null
  echouer: (erreur: unknown, defaut: string) => void
  relireProduction: () => Promise<void>
  setChoixDeReference: (ouvert: boolean) => void
  setCible: Pose_<CibleDeLAppel | null>
  setModeleChoisi: Pose_<string | null>
  poserLaRacine: (prochaine: Racine) => void
  setOptions: Pose_<Record<string, string>>
  setPrompt: Pose_<string>
  setPromptNegatif: Pose_<string>
  setProportions: Pose_<string>
  setProvenance: Pose_<string | null>
  setReinjections: Pose_<Reinjection[]>
  setRepris: Pose_<boolean>
  setTri: Pose_<Tri>
  setVariations: Pose_<number>
}

export function useGestes({
  bibliotheque,
  choixDeReference,
  cible,
  echouer,
  relireProduction,
  setChoixDeReference,
  setCible,
  setModeleChoisi,
  poserLaRacine,
  setOptions,
  setPrompt,
  setPromptNegatif,
  setProportions,
  setProvenance,
  setReinjections,
  setRepris,
  setTri,
  setVariations,
}: CeQueLesGestesLisent) {
  /** **Garder une correction sur la chose du jeu — le second geste** (E14).
   *
   *  Corriger vaut pour cet appel ; garder est écrit, séparé, et il passe par la
   *  fiche de la chose, qui est le seul endroit où un texte durable s'écrit.
   *  Sans cette séparation, la dixième image d'un personnage serait fabriquée
   *  avec les réglages du neuvième essai, sans que personne l'ait décidé. */
  const garderLeTexte = async (ligne: LigneQuiPart) => {
    if (!cible?.personnage || !ligne.gardable) return
    try {
      if (ligne.groupe === "sujet") {
        await api.reglerPersonnage(cible.personnage, { description: ligne.texte })
      } else {
        await api.reglerPersonnage(cible.personnage, {
          textes: { [ligne.nom]: ligne.texte },
        })
      }
      // La correction est désormais dans la fiche : la garder aussi dans le tri
      // en ferait une seconde vérité, et l'écran montrerait « corrigé pour cet
      // appel » sur un texte qui est devenu celui de la chose.
      setTri((deja) => {
        const restant = { ...deja.textes }
        delete restant[ligne.clef]
        return { ...deja, textes: restant }
      })
      await relireProduction()
    } catch (erreur) {
      echouer(erreur, "le texte n'a pas pu être gardé")
    }
  }

  /** Armer l'atelier sur une case (US-120).
   *
   *  **Rien n'est dépensé ici.** Le prompt reçoit le signalement du personnage
   *  et le nom de l'attitude — c'est très exactement ce qu'on ne veut plus
   *  retaper (US-115) —, la case est retenue, et l'écran rend la main. C'est le
   *  bouton Générer de l'atelier qui paie.
   *
   *  Le prompt est **remplacé**, pas complété : cliquer « Fabriquer » sur une
   *  case est sans ambiguïté, et laisser dessous un début de phrase écrit pour
   *  autre chose ferait partir les deux ensemble.
   *
   *  Le **sujet**, lui, n'est pas touché : c'est le choix de l'auteur, et le
   *  produit ne devine pas à sa place — il n'y a pas de famille « personnages »
   *  imposée dans un barème qu'il a pu renommer.
   */
  const armer = async (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    directions?: string[] | null,
  ) => {
    if (poses.length === 0) return
    // **Une planche de pose vise N angles d'une seule attitude** (E13). Deux ou
    // plus, et l'appel se plie ; une seule, et c'est la case de C1 — que
    // `direction` désigne, et qui n'a jamais changé.
    const angles = directions && directions.length >= 2 ? directions : null
    setCible({
      personnage: personnage.identifiant,
      poses: poses.map((p) => p.identifiant),
      piece: piece?.identifiant ?? null,
      // **Et sous quel angle** (E10) : la case visée est une pose *dans une
      // direction*, et c'est elle que l'appel remplira.
      direction: angles ? null : (direction ?? null),
      directions: angles,
    })
    // **Le champ reçoit le signalement, et lui seul** — écrit par le serveur
    // depuis C5, réduit à ce qu'on dessine depuis E14. La consigne de l'attitude
    // et celle de l'angle sont une ligne à part, composée par le chemin de
    // l'envoi, avec leur propre origine et leur propre interrupteur : les coller
    // ici aurait obligé l'écran de confirmation à deviner où finit le
    // signalement et où commence la pose.
    //
    // **Un refus n'empêche pas d'armer.** La case est visée, l'atelier est
    // ouvert, et le champ reste à écrire : c'est un geste local et gratuit, pas
    // une dépense — le vider et laisser la main est moins coûteux que de
    // renvoyer l'auteur d'où il vient.
    try {
      const recu = await api.sujetDeCase({
        personnage: personnage.identifiant,
        piece: piece?.identifiant ?? null,
        projet: bibliotheque.courant,
      })
      setPrompt(recu.sujet)
      // **Ce qui est devinable est prérempli avec sa provenance**, et se défait
      // d'un clic (E2). Le revers de la règle du grisé, qui dit sa raison
      // depuis T1 : un champ prérempli n'est pas un champ décidé.
      setProvenance(
        piece
          ? "proposé, d'après la description de la pièce · modifiable"
          : angles
            ? `proposé, d'après son signalement · les consignes des ${angles.length} directions partent case par case · modifiable`
            : poses.length > 1
              ? `proposé, d'après son signalement · les consignes des ${poses.length} poses partent case par case · modifiable`
              : "proposé, d'après son signalement · la consigne de l'attitude part à côté · modifiable",
      )
    } catch {
      setPrompt("")
      setProvenance(null)
    }
    // **Armer rend la main à l'atelier.** Ce qui vient d'être posé dans le
    // champ est un *sujet*, pas un texte complet : le laisser en mode repris
    // ferait partir un signalement de personnage sans la bible ni les
    // consignes de planche — c'est-à-dire sans rien de ce que la matrice
    // arme.
    setRepris(false)
    // **Armer ne déplace plus personne.** Le geste dit « pour cette case-là »,
    // et la barre qui paie est déjà sous la main : elle est au pied de
    // l'établi, à quelques pixels de la case qu'on vient d'armer. Jusqu'en E2
    // il fallait retourner à la galerie, seul endroit qui portait un champ.
  }


  // ── Réinjecter ────────────────────────────────────────────────────────────

  /** Faire repartir une image avec le prochain appel.
   *
   *  **Le geste va où son effet se voit** (E2). La bande *Repart avec* et le
   *  champ de prompt vivent au pied du codex et de l'établi, et plus dans la
   *  galerie — qui juge et ne paie jamais. Réinjecter depuis la fiche d'une
   *  image sans changer d'onglet laisserait l'auteur devant un geste dont rien
   *  n'a bougé à l'écran, ce que le produit refuse partout ailleurs. */
  const reinjecter = (asset: string, role: Role) => {
    setReinjections((deja) => [
      ...deja.filter((r) => r.asset !== asset),
      { asset, role },
    ])
    poserLaRacine("codex")
  }

  /** **Échap referme le choix, et lui seul** (M5).
   *
   *  La fenêtre de confirmation écoute Échap pour se fermer, et elle reste
   *  montée derrière : sans ce garde, une seule pression aurait refermé les
   *  deux, ramenant l'auteur au prompt alors qu'il renonçait seulement à
   *  joindre une image. En capture, et il arrête ce qu'il consomme.
   *
   *  ⚠️ **Et il rend la main à ce qui est encore au-dessus.** L'aperçu écoute
   *  Échap de la même façon, sur la même fenêtre : *arrêter la propagation* ne
   *  suffit pas entre deux écouteurs posés sur le même endroit — les deux se
   *  déclenchent, et une seule pression refermait l'image en grand **et** la
   *  grille. La marque qu'il laisse, elle, se voit : une touche déjà consommée
   *  ne se reprend pas. On regarde une image en grand avant de la choisir ; ce
   *  qu'on referme d'abord est donc l'image. */
  useEffect(() => {
    if (!choixDeReference) return
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape" || evenement.defaultPrevented) return
      evenement.stopPropagation()
      setChoixDeReference(false)
    }
    window.addEventListener("keydown", touche, true)
    return () => window.removeEventListener("keydown", touche, true)
  }, [choixDeReference])

  /** **Ajouter une référence sans quitter la fenêtre de confirmation** (M5).
   *
   *  C'est `reinjecter` **moins le changement d'onglet**, et l'écart tient à la
   *  règle qui l'avait imposé : *le geste va où son effet se voit*. Depuis la
   *  fiche d'une image de la galerie, l'effet est ailleurs — d'où le
   *  déplacement. Ici, l'effet est **sous les yeux** : l'image entre dans la
   *  liste des images jointes qu'on est en train de lire, le compte monte d'une,
   *  et le prix suit. Il n'y a rien à aller voir.
   *
   *  **Elle entre en *référence***, c'est-à-dire *le même sujet, déjà dessiné* :
   *  c'est ce qu'on veut dans le cas qui a fait la tranche — on lit ce qui part,
   *  on s'aperçoit qu'une image manque. Le rôle se change là où il se change
   *  déjà, dans la bande *Repart avec* au pied du codex, et ce détour-là ne
   *  coûte plus rien depuis que les corrections survivent à la sortie. */
  const ajouterUneReference = (asset: string) => {
    setReinjections((deja) => [
      ...deja.filter((r) => r.asset !== asset),
      { asset, role: "reference" as Role },
    ])
    setChoixDeReference(false)
  }

  /** Le quatrième rôle : reprendre les réglages, sans envoyer d'image.
   *
   *  **Le texte revient repris, quoi qu'il ait été** (US-160). `demande.prompt`
   *  est le prompt tel qu'il *est parti* — bible repliée en tête et consignes
   *  de planche en queue comprises. Le reposer en mode atelier le ferait
   *  rhabiller une seconde fois : la bible partirait en double, et la planche
   *  demanderait deux grilles. Ce que l'auteur reprend, c'est l'appel — donc il
   *  repart identique. */
  const reprendreReglages = async (asset: Asset) => {
    try {
      const generation = await api.generation(asset.generation)
      setPrompt(generation.demande.prompt)
      setRepris(true)
      setPromptNegatif(generation.demande.prompt_negatif)
      setProportions(generation.demande.proportions)
      setVariations(generation.demande.variations)
      setModeleChoisi(generation.modele)
      setOptions(
        Object.fromEntries(
          Object.entries(generation.demande.options).map(([n, v]) => [n, String(v)]),
        ),
      )
      // Même règle que la réinjection : le texte repris se lit dans le champ,
      // et le champ n'est pas ici.
      poserLaRacine("codex")
    } catch (erreur) {
      echouer(erreur, "réglages illisibles")
    }
  }


  return {
    ajouterUneReference,
    armer,
    garderLeTexte,
    reinjecter,
    reprendreReglages,
  }
}
