/** La scène d'une vue — le rôdeur dans un petit décor, à l'étape « Sa vue »
 *  des réglages d'un jeu (RV18, 23 septembre 2026).
 *
 *  **Ce que ça remplace.** La vignette d'avant montrait le rôdeur seul sur
 *  fond gris, huit fois de suite — un instrument de comparaison entre
 *  caméras, pas une idée de ce que le jeu ressemblerait. L'auteur l'a dit
 *  après le test du 20 septembre : « une vignette du rôdeur seul […] ne fait
 *  pas comprendre quel jeu on pourra construire. »
 *
 *  **Ce qui est dessiné ici ne coûte rien et n'appelle personne.** Le sol,
 *  le mur ou l'obstacle et l'objet de chaque carte sont des formes CSS aux
 *  couleurs du système de design (`index.css`), pas des images générées — un
 *  écran de réglages ne dépense jamais un centime. Le seul pixel qui vient
 *  d'ailleurs est le rôdeur, recadré une fois pour toutes par
 *  `essais/decouper_sujets_de_vue.py` depuis les huit vignettes existantes.
 *
 *  **Trois mouvements, un par nombre de directions que la vue propose** —
 *  la règle tranchée par l'auteur pour RV18 : sans direction (une image que
 *  le jeu fait pivoter, comme « De dessus, verticale » et maintenant
 *  « De dessus, stricte »), deux (un aller-retour, avec retournement) ou
 *  quatre (une marche en boucle sur le sol, dans la projection de la vue).
 *  Aucune vue du catalogue n'en propose huit — RV18 l'a vérifié —, donc ces
 *  trois cas suffisent à toutes.
 *
 *  **Le survol déclenche, `prefers-reduced-motion` coupe.** Les classes
 *  `scene-vue-*` d'`index.css` ne s'appliquent que sous la requête média
 *  `no-preference` ; ici on ne fait que les poser ou les retirer selon que
 *  la carte est survolée. Sans préférence de réduction, la scène reste
 *  fixe — ce que le critère de RV18 demande explicitement. */
import { type CSSProperties, useState } from "react"

type Mouvement = "pivote" | "va-et-vient" | "boucle"

type Point = { left: number; top: number }

type ConfigScene = {
  /** Le sol, en polygone CSS (pourcentages du cadre). */
  sol: string
  /** Un mur ou obstacle, puis un objet — les deux couleurs du décor. */
  decor: { style: CSSProperties }[]
  /** Où le rôdeur se tient au repos — le point que ses pieds touchent. */
  ancre: Point
  /** Sa largeur, en pourcentage du cadre ; la hauteur suit l'image. */
  largeur: number
  mouvement: Mouvement
  /** « va-et-vient » : le second point (le premier est `ancre`). */
  jusqua?: Point
  /** « boucle » : les trois points suivants (le premier est `ancre`). */
  boucle?: [Point, Point, Point]
}

const HERBE = "var(--color-apercu-herbe)"
const PIERRE = "var(--color-apercu-pierre)"
const OBJET = "var(--color-ilot-paille)"

/** Un décor simple : un bloc (mur, plateforme, obstacle) et un objet, tous
 *  deux des rectangles arrondis — la forme la moins chère à lire d'un coup
 *  d'œil, et celle qu'`index.css` sait déjà arrondir (`rounded-5`, en style
 *  inline ici puisque chaque carte a sa propre géométrie). */
function bloc(gauche: number, haut: number, largeur: number, hauteur: number, couleur: string): { style: CSSProperties } {
  return {
    style: {
      left: `${gauche}%`,
      top: `${haut}%`,
      width: `${largeur}%`,
      height: `${hauteur}%`,
      backgroundColor: couleur,
      borderRadius: "3px",
    },
  }
}

// ── Les huit scènes, une par vue de `atelier/domaine/vue.py` ────────────────
//
// **Chaque sol reprend la forme que sa vignette de production dessine déjà**
// (`docs/archive/vignettes-vues.md`, « FLOOR TILE » de chaque bloc) : un
// trait fin vu de profil, un carré plein vu d'aplomb, un rectangle large
// pour la vue stricte, un parallélogramme pour l'oblique, un losange pour
// l'isométrique. Ce n'est pas une texture réaliste ; c'est la même
// projection que la caméra de la vue impose au modèle, tenue une seconde
// fois en CSS.
const SCENES: Record<string, ConfigScene> = {
  "vue-face-fixe": {
    sol: "polygon(4% 82%, 96% 82%, 96% 88%, 4% 88%)",
    decor: [bloc(8, 10, 84, 60, PIERRE), bloc(70, 66, 18, 16, OBJET)],
    ancre: { left: 38, top: 82 },
    largeur: 40,
    mouvement: "pivote",
  },
  "vue-dessus-verticale": {
    sol: "polygon(12% 26%, 88% 26%, 88% 92%, 12% 92%)",
    decor: [bloc(56, 32, 20, 20, PIERRE), bloc(18, 70, 12, 12, OBJET)],
    ancre: { left: 50, top: 62 },
    largeur: 30,
    mouvement: "pivote",
  },
  "vue-cote-plateforme": {
    sol: "polygon(0% 84%, 100% 84%, 100% 90%, 0% 90%)",
    decor: [bloc(55, 58, 26, 26, PIERRE), bloc(63, 44, 9, 9, OBJET)],
    ancre: { left: 16, top: 84 },
    largeur: 30,
    mouvement: "va-et-vient",
    jusqua: { left: 60, top: 84 },
  },
  "vue-cote-defilement": {
    sol: "polygon(0% 84%, 100% 84%, 100% 90%, 0% 90%)",
    decor: [bloc(72, 40, 10, 44, PIERRE), bloc(20, 62, 14, 14, OBJET)],
    ancre: { left: 14, top: 84 },
    largeur: 26,
    mouvement: "va-et-vient",
    jusqua: { left: 55, top: 84 },
  },
  "vue-dessus-stricte": {
    sol: "polygon(10% 55%, 90% 55%, 90% 80%, 10% 80%)",
    decor: [bloc(62, 40, 18, 14, PIERRE), bloc(20, 60, 10, 10, OBJET)],
    ancre: { left: 50, top: 78 },
    largeur: 38,
    mouvement: "pivote",
  },
  "vue-dessus-34": {
    sol: "polygon(15% 40%, 85% 40%, 85% 88%, 15% 88%)",
    decor: [bloc(15, 22, 70, 20, PIERRE), bloc(55, 62, 14, 14, OBJET)],
    ancre: { left: 30, top: 80 },
    largeur: 34,
    mouvement: "boucle",
    boucle: [
      { left: 70, top: 80 },
      { left: 70, top: 50 },
      { left: 30, top: 50 },
    ],
  },
  "vue-oblique": {
    sol: "polygon(20% 88%, 85% 88%, 67% 58%, 2% 58%)",
    decor: [bloc(55, 45, 16, 16, PIERRE), bloc(25, 75, 10, 10, OBJET)],
    ancre: { left: 30, top: 84 },
    largeur: 30,
    mouvement: "boucle",
    boucle: [
      { left: 70, top: 84 },
      { left: 58, top: 66 },
      { left: 18, top: 66 },
    ],
  },
  "vue-isometrique": {
    sol: "polygon(50% 54%, 88% 72%, 50% 90%, 12% 72%)",
    decor: [bloc(60, 46, 16, 20, PIERRE), bloc(25, 64, 10, 10, OBJET)],
    ancre: { left: 50, top: 84 },
    largeur: 30,
    mouvement: "boucle",
    boucle: [
      { left: 72, top: 72 },
      { left: 50, top: 60 },
      { left: 28, top: 72 },
    ],
  },
}

/** Le rôdeur, positionné et animé sur son décor. Un `<span>` porte la
 *  position (statique ou animée par `left`/`top`) et l'ancrage au sol
 *  (`translate` constant, jamais touché par une image-clé) ; l'image à
 *  l'intérieur ne porte que ce qui lui est propre — la rotation, ou le
 *  retournement — pour que les deux animations ne se recouvrent jamais sur
 *  la même propriété `transform`. */
function Sujet({ identifiant, config, joue }: { identifiant: string; config: ConfigScene; joue: boolean }) {
  const { ancre, mouvement, largeur } = config
  // **Des variables CSS, pas des propriétés React** : `CSSProperties` ne
  // déclare aucune propriété perso, donc on les porte à part et on les
  // fusionne au moment de construire le style, casté une seule fois.
  const variables: Record<string, string> = {}
  let classeGroupe = ""
  let classeImage = ""
  if (mouvement === "va-et-vient" && config.jusqua) {
    variables["--scene-x0"] = `${ancre.left}%`
    variables["--scene-x1"] = `${config.jusqua.left}%`
    classeGroupe = joue ? "scene-vue-va-et-vient" : ""
    classeImage = joue ? "scene-vue-va-et-vient-retourne" : ""
  } else if (mouvement === "boucle" && config.boucle) {
    const [p1, p2, p3] = config.boucle
    variables["--scene-x0"] = `${ancre.left}%`
    variables["--scene-y0"] = `${ancre.top}%`
    variables["--scene-x1"] = `${p1.left}%`
    variables["--scene-y1"] = `${p1.top}%`
    variables["--scene-x2"] = `${p2.left}%`
    variables["--scene-y2"] = `${p2.top}%`
    variables["--scene-x3"] = `${p3.left}%`
    variables["--scene-y3"] = `${p3.top}%`
    classeGroupe = joue ? "scene-vue-boucle" : ""
  } else {
    classeImage = joue ? "scene-vue-pivote" : ""
  }
  const style: CSSProperties = {
    left: `${ancre.left}%`,
    top: `${ancre.top}%`,
    width: `${largeur}%`,
    transform: "translate(-50%, -92%)",
    ...variables,
  }
  return (
    <span className={["absolute", classeGroupe].filter(Boolean).join(" ")} style={style}>
      <img
        src={`/vignettes/${identifiant}-sujet.png`}
        alt=""
        className={["block w-full", classeImage].filter(Boolean).join(" ")}
        style={{ imageRendering: "pixelated", transformOrigin: "50% 88%" }}
      />
    </span>
  )
}

/** La carte de scène elle-même — appelée à la place de l'ancienne
 *  `Vignette` dans `ReglesDuJeu.tsx`, étape « Sa vue ». Absente de scène
 *  connue pour cet identifiant (un jeu qui garde un ancien réglage, par
 *  exemple), elle ne rend rien plutôt que de dessiner un décor inventé. */
export function SceneDeVue({ identifiant }: { identifiant: string }) {
  const [survole, setSurvole] = useState(false)
  const config = SCENES[identifiant]
  if (!config) return null
  return (
    <span
      data-scene-de-vue={identifiant}
      onPointerEnter={() => setSurvole(true)}
      onPointerLeave={() => setSurvole(false)}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-5 bg-papier-cote"
    >
      <span className="absolute inset-0" style={{ clipPath: config.sol, backgroundColor: HERBE }} />
      {config.decor.map((d, i) => (
        <span key={i} className="absolute" style={d.style} />
      ))}
      <Sujet identifiant={identifiant} config={config} joue={survole} />
    </span>
  )
}
