import type { EtatDuMoteur } from "../api"

/** Une taille telle qu'elle s'écrit en français : la virgule, jamais le point.
 *  Partagé depuis ici — `Clip.tsx` et `Installation.tsx` la reprenaient chacun
 *  de son côté avant RV2. */
export function gigas(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Go`
}

const AVERTISSEMENT =
  "rounded-[5px] border border-trait-attention bg-fond-attention px-2 py-1.5 text-[12px] leading-4 text-encre"

/** **La carte graphique prévient avant de lancer** (RV2) — un seul petit
 *  composant, aux deux endroits qui préparent un calcul local : l'écran
 *  « Faire une vidéo » (`Clip.tsx`) et la fenêtre « Préparer une
 *  fabrication » quand le modèle choisi est local (`FabricationSuivie.tsx`,
 *  `FabricationVideoLibre.tsx`).
 *
 *  **Ce qu'il montre, et ce qu'il tait.** La mémoire libre en clair — jamais
 *  l'identifiant technique du pilote que `etat.carte` porte encore (« cuda:0
 *  NVIDIA … : cudaMallocAsync »), lu au 21 septembre sans traduction. Sous le
 *  besoin mesuré du modèle, un avertissement nomme l'écart et le remède ; un
 *  modèle dont le besoin n'est pas mesuré ne reçoit aucun avertissement —
 *  inventer un chiffre serait pire que se taire. ComfyUI déjà occupé par un
 *  autre calcul se dit à côté, avant le lancement. **Les deux préviennent,
 *  aucun ne bloque** : le bouton reste actif, comme le veut RV2.
 */
export function MemoireLocale({ etat }: { etat: EtatDuMoteur | null }) {
  if (!etat || !etat.allume || !etat.carte) return null
  const manque = etat.besoin_go != null && etat.memoire_libre_go < etat.besoin_go
  return (
    <div className="flex flex-col gap-1.5">
      <p className="mesure text-[10.5px] leading-4 text-encre-3">
        Mémoire libre : {gigas(etat.memoire_libre_go)}
      </p>
      {manque && (
        <p role="status" className={AVERTISSEMENT}>
          Ce modèle demande environ {gigas(etat.besoin_go!)}. ComfyUI
          libérera de lui-même les modèles qu'il garde en mémoire ; si le
          calcul échoue quand même, ferme les autres programmes qui utilisent
          ta carte graphique.
        </p>
      )}
      {etat.occupe && (
        <p role="status" className={AVERTISSEMENT}>
          ComfyUI est déjà occupé par un autre calcul : le tien attendra son
          tour.
        </p>
      )}
    </div>
  )
}
