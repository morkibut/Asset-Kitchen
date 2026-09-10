// La barre d'état — le pied du châssis (`docs/DESIGN.md` § Layout).
//
// Elle vivait en clair dans `App.tsx` ; `C4` l'en sort avec la galerie, parce
// qu'elle n'est pas la galerie : elle est le pied de l'ancien châssis, et le
// jour où celui-ci tombe, elle tombe avec lui — d'un fichier, pas d'un bloc
// perdu au milieu de six mille lignes.

import { heure, type Bibliotheque, type Etat } from "../api"
import { Point } from "./chassis"

/** Ce que l'atelier sait du catalogue des modèles : est-il en repli, pourquoi,
 *  et de quand date ce qu'il montre. */
export type Repli = { repli: boolean; raison: string | null; recu_le: number }


// ── La barre d'état ─────────────────────────────────────────────────────────

export function BarreEtat({
  etat,
  catalogue,
  panne,
  liaison,
  bibliotheque,
  onRelireCatalogue,
}: {
  etat: Etat | null
  catalogue: Repli
  panne: string | null
  liaison: boolean
  bibliotheque: Bibliotheque
  /** **Le geste vient rejoindre l'état qu'il change.** La barre de tête portait
   *  un bouton `Catalogue` de même poids que les onglets, alors qu'il ne
   *  changeait rien de ce qu'on regarde : il redemandait la liste des modèles.
   *  La V2.1 lui retire cette place — trois onglets, pas cinq boutons — et le
   *  pose ici, sur le compte de modèles, qui est déjà l'endroit du produit qui
   *  dit ce que le catalogue contient et de quand il date. */
  onRelireCatalogue: () => void
}) {
  // Trois choses différentes, et il ne faut pas les confondre : l'atelier est
  // arrêté (liaison rompue), le fournisseur est injoignable (repli), ou tout
  // va bien. La première l'emporte — sans serveur, le reste ne veut rien dire.
  const [couleur, texte] = !liaison
    ? ["var(--color-echec-froid)", "l'atelier ne répond pas"]
    : panne
      ? ["var(--color-echec-froid)", panne]
      : catalogue.repli
        ? ["var(--color-epingle)", "hors ligne"]
        : ["var(--color-ok-froid)", "en ligne"]

  const assets =
    bibliotheque.projets.reduce((somme, p) => somme + p.assets, 0) +
    bibliotheque.sans_projet.assets

  // Deux altitudes, deux métiers : le pied porte **l'état du monde** — et
  // pourquoi, quand le port a su le dire en français. Il ne prédit jamais ce
  // qui va casser : ça, c'est la fente sous le bouton Générer.
  return (
    <footer className="mesure flex items-center gap-4 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
      <span className="flex items-center gap-1.5">
        <Point couleur={couleur} />
        {texte}
      </span>
      {catalogue.repli && catalogue.recu_le > 0 && (
        <span className="text-epingle">catalogue du {heure(catalogue.recu_le)}</span>
      )}
      {catalogue.repli && catalogue.raison && <span>{catalogue.raison}</span>}
      <button
        type="button"
        onClick={onRelireCatalogue}
        title="Redemander le catalogue des modèles"
        className="transition-colors duration-[80ms] hover:text-texte-2"
      >
        {etat?.catalogue.modeles ?? 0} modèles
      </button>
      {/* **La clé est montée dans la barre du haut** (E19), et elle n'est plus
          ici : elle est le seul préalable dur du produit, elle se lit dès la
          première seconde, et la même valeur à deux endroits serait deux
          endroits à tenir d'accord. */}
      <span className="ml-auto">
        {assets} asset{assets > 1 ? "s" : ""}
      </span>
    </footer>
  )
}
