// Ce qu'une fabrication produit — **la liste fermée des quatre types** (RP4).
//
// Avant cette tranche, le type de résultat n'était écrit nulle part : il se
// déduisait du bouton pressé, et huit fenêtres se le partageaient sans jamais
// le nommer. Trois préparaient une image fixe, trois un clip ; aucune n'était
// atteignable depuis une autre.
//
// **Fermée** veut dire ce que ça veut dire dans `docs/DESIGN.md` : rien d'autre
// ne s'écrit. Un cinquième type ne s'ajoute pas à un écran, il s'ajoute ici.

import type { CaseSerie, DemandeTravail } from "./api-travaux"
import type { Generation } from "./api"

export const TYPES_DE_RESULTAT = ["image", "clip", "son", "rendu-3d"] as const

export type TypeDeResultat = (typeof TYPES_DE_RESULTAT)[number]

/** Le nom montré, un seul par type, dans tout le produit. */
export const NOM_DU_TYPE: Record<TypeDeResultat, string> = {
  image: "Image fixe",
  clip: "Clip",
  son: "Son",
  "rendu-3d": "Rendu 3D",
}

/** **Le champ du modèle, et son seul nom** (RP4, `docs/vocabulaire.html`).
 *
 *  Le produit lui donnait huit noms — *Modèle · fournisseur*, *Modèle*, *Modèle
 *  vidéo*, *Fournisseur et modèle vidéo*, *Fournisseur et modèle*, *Méthode
 *  locale*, *Workflow et version*, *Moteur du modèle*. Celui-ci tient pour les
 *  quatre types, et il dit les deux moitiés qu'un modèle porte : **qui le sert**
 *  et **lequel c'est**. *Moyen de fabrication*, le mot de la maquette, était
 *  déjà pris — c'est le choix entre une planche et un appel par image. */
export const CHAMP_DU_MODELE = "Fournisseur et modèle"

/** **Le bouton qui mène à la relecture, et son seul nom** (RP4).
 *
 *  Cinq fenêtres l'écrivaient autrement — *Relire les envois*, *Relire l'envoi
 *  vidéo*, *Relire avant envoi*, *Relire avant de générer le son*, *Relire cette
 *  étape avant de lancer*. Un seul geste, une seule fenêtre au bout, un seul
 *  mot. */
export const VERS_LA_RELECTURE = "Relire avant l’envoi"

/** **Ce qu'une porte de plus qu'une simple case peut apporter à l'animation
 *  qu'elle ouvre** (RV6) — onze portes, une seule fenêtre. Partagé entre
 *  `AnimationsDuSujet.tsx` (qui les calcule) et `App.tsx` (qui les pose sur
 *  `cibleInitiale`) : un écran du carnet n'emprunte pas sa logique à un
 *  autre écran (`essais/essai_imports.py`), donc ce type et les fonctions qui
 *  le remplissent vivent ici, hors de `composants/`. */
export type OptionsAnimer = {
  /** **D'autres cases cochées en plus de celle visée** — un travail par
   *  case, lancés dans la même série. Pose *et* direction, pas seulement la
   *  direction : « Tout animer » (RV6) peut cocher des cases de poses
   *  différentes, et le serveur les accepte telles quelles
   *  (`preparer_serie`, `CaseSerie[]`) — une série n'est plus bornée à une
   *  seule pose. */
  cases?: CaseSerie[]
  /** L'image de départ à proposer d'emblée, plutôt que la repropose du
   *  serveur — une variante part de celle du clip d'origine. */
  referenceAsset?: string | null
  /** La demande d'un travail raté, reprise à l'identique (E14) : « Relancer »
   *  n'ouvre pas une saisie neuve. */
  relance?: DemandeTravail
}

/** **La demande d'un travail raté, reprise mot pour mot** (RV1 → RV6).
 *
 *  « Relancer » n'est pas une nouvelle saisie : c'est le même texte, les
 *  mêmes réglages qui repartent — seule la clé change, puisque c'est un
 *  nouvel envoi. Les champs que l'ancien envoi direct (`commanderClips`) ne
 *  connaissait pas — nombre d'images, cadence, sens de lecture — reprennent
 *  le défaut de la fenêtre unique : rien ne les avait réglés autrement. */
export function demandeDeRelance(clip: Generation, imageDepart: string | null): DemandeTravail {
  return {
    cle: crypto.randomUUID(),
    personnage: clip.personnage ?? "",
    pose: clip.pose ?? "",
    direction: clip.direction ?? "",
    reference_asset: imageDepart,
    modele_video: clip.modele,
    mouvement: clip.demande?.mouvement ?? null,
    prompt_video: clip.demande?.mouvement ? "" : (clip.demande?.prompt ?? ""),
    secondes: clip.clip?.secondes ?? 1.5,
    resolution: clip.clip?.resolution ?? "480p",
    proportions: clip.clip?.proportions ?? "1:1",
    nombre_images: 8,
    cadence: 8,
    sens: "boucle",
  }
}
