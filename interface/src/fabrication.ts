// Ce qu'une fabrication produit — **la liste fermée des quatre types** (RP4).
//
// Avant cette tranche, le type de résultat n'était écrit nulle part : il se
// déduisait du bouton pressé, et huit fenêtres se le partageaient sans jamais
// le nommer. Trois préparaient une image fixe, trois un clip ; aucune n'était
// atteignable depuis une autre.
//
// **Fermée** veut dire ce que ça veut dire dans `docs/DESIGN.md` : rien d'autre
// ne s'écrit. Un cinquième type ne s'ajoute pas à un écran, il s'ajoute ici.

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
