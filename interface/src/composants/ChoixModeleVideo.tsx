// MO3 · Le choix d'un moteur vidéo — le même dans « Faire une vidéo libre » et
// dans « 4. Le clip ».
//
// Les deux écrans lisaient déjà la même route (`GET /clips/models`), mais
// chacun peignait sa liste à sa façon : l'un montrait l'identifiant brut
// (`maison/wan-2.2-i2v-14b-pixel`), l'autre le fournisseur et le nom. Un moteur
// qui porte deux noms selon l'écran est exactement ce que le chantier range
// (`docs/PLAN-catalogue-des-moteurs.md` § Ce que c'est : « son nom, le même dans
// tous les écrans »). Ce composant est donc **la seule façon d'écrire une ligne
// de cette liste** : même nom (`libelleModele`), mêmes groupes que la page
// « Moteurs » (sur cette machine, en ligne), même suffixe (le grisé et sa raison,
// « local », ou le prix).
//
// **L'ordre n'est pas décidé ici** : il vient du serveur (`ServiceAnimation.
// catalogue`), et les deux groupes le gardent tel quel. Un `<select>` natif,
// comme avant dans les deux écrans : chaque ligne porte un prix qui change
// avec la durée, et `ChoixModele` (l'image) ne sait pas le montrer.

import { prix, type ModeleVideo } from "../api"
import { libelleModele } from "./pieces"

/** Sur cette machine (Wan, un workflow importé) ou en ligne. Retombe sur
 *  `de_la_maison` quand le serveur ne dit pas encore la source. */
export function surCetteMachine(modele: ModeleVideo): boolean {
  return (modele.source ?? (modele.de_la_maison ? "maison" : "en_ligne")) !== "en_ligne"
}

/** La ligne d'un moteur vidéo, telle que tout écran l'écrit. */
export function libelleModeleVideo(modele: ModeleVideo): string {
  const suffixe = modele.grise ? ` — ${modele.grise}` : modele.de_la_maison ? " · local" : ` · ${prix(modele.prix.montant)}`
  return libelleModele(modele) + suffixe
}

export function ChoixModeleVideo({
  modeles,
  valeur,
  onChange,
  vide,
  absent,
  className,
}: {
  modeles: readonly ModeleVideo[]
  valeur: string
  onChange: (identifiant: string) => void
  /** La première ligne, qui ne choisit rien. */
  vide: string
  /** Ce qu'écrit la ligne d'un modèle choisi qui n'est plus dans la liste
   *  (« modèle indisponible ») — sans elle, le `<select>` afficherait en
   *  silence la ligne vide alors qu'un modèle est gardé dans la demande. */
  absent?: string
  className?: string
}) {
  const machine = modeles.filter(surCetteMachine)
  const enLigne = modeles.filter((m) => !surCetteMachine(m))
  const ligne = (m: ModeleVideo) => (
    <option key={m.identifiant} value={m.identifiant} disabled={!!m.grise}>
      {libelleModeleVideo(m)}
    </option>
  )
  return (
    <select className={className} value={valeur} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vide}</option>
      {absent && valeur && !modeles.some((m) => m.identifiant === valeur) && (
        <option value={valeur} disabled>
          {absent}
        </option>
      )}
      {machine.length > 0 && <optgroup label="Sur cette machine">{machine.map(ligne)}</optgroup>}
      {enLigne.length > 0 && <optgroup label="En ligne">{enLigne.map(ligne)}</optgroup>}
    </select>
  )
}
