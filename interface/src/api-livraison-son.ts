// L'aperçu de livraison d'un son seul ou d'un jeu de variantes : la même
// forme (`ApercuLivraison`), deux routes différentes (SN3, SN4). Ce module ne
// connaît des jeux de variantes que ce qu'il faut pour les livrer : le reste
// (séries, grille d'écoute) vit dans un autre module de ce chantier.
import { appeler, type ApercuLivraison } from "./api"
import { type Son, sons } from "./api-sons"

/** Le nécessaire d'un jeu de variantes pour son aperçu de livraison — un
 *  sous-ensemble de ce que `GET …/sound-variants/{jeu}` renvoie. */
export type JeuVariantesSon = {
  identifiant: string; projet: string; nom: string; famille: string | null
  membres: { son: string }[]
  signalements: { son: string; statut: string; signal: string }[]
}

const cheminJeu = (projet: string, jeu: string) => `/projects/${encodeURIComponent(projet)}/sound-variants/${encodeURIComponent(jeu)}`

export const livraisonSon = {
  /** L'aperçu de livraison d'un son seul (déjà `sons.livraison`, repris ici
   *  pour que le composant d'aperçu n'ait qu'un seul module à connaître). */
  deSon: (s: Son) => sons.livraison(s),
  /** L'aperçu de livraison d'un jeu de variantes : ses sons livrables, sous
   *  des noms stables numérotés, rassemblés dans un `AudioStreamRandomizer`. */
  deJeu: (projet: string, jeu: string) => appeler<ApercuLivraison>(cheminJeu(projet, jeu) + "/delivery/preview", { method: "POST" }),
}
