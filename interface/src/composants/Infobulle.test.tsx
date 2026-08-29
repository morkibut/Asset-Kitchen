// Où l'infobulle se pose — **sans écran** (R4).
//
// `App.test.tsx` reste le seul endroit du dépôt où l'interface est montée et
// pilotée ; ce fichier-ci ne monte rien. Il existe pour la raison de
// `Toile.test.tsx` : jsdom ne met rien en page, donc tout rectangle y vaut
// zéro. Un essai qui monterait l'écran Univers et mesurerait le recouvrement
// lirait des rectangles nuls et passerait **quoi qu'on fasse** — y compris
// avant la correction.
//
// La règle se vérifie donc ici, sur de vrais rectangles ; **et l'écran prouve
// de son côté ce que jsdom sait voir** : que chaque panneau de réglages se
// déclare, sans quoi la règle ne s'appliquerait à personne. Les deux moitiés
// sont nécessaires, aucune ne suffit.

import { describe, expect, test } from "vitest"

import { placer, type Cadre } from "./Infobulle"

/** La largeur de la bulle, écrite dans `Infobulle.tsx`. Recopiée ici parce
 *  qu'un essai qui importerait la constante vérifierait la constante contre
 *  elle-même : ce qui compte est que la bulle de 280 px tombe hors du panneau,
 *  pas qu'elle fasse la largeur qu'on lui a donnée. */
const LARGEUR = 280

const cadre = (left: number, right: number, top = 0): Cadre => ({ left, right, top })

/** L'écran large du produit, et le plus étroit qu'il vise. */
const LARGE = { largeur: 1920, hauteur: 1080 }
const ETROIT = { largeur: 1280, hauteur: 720 }

/** La bulle recouvre-t-elle le panneau ? La question de la tranche, posée une
 *  fois pour tous les cas. */
const recouvre = (x: number, panneau: Cadre) =>
  x < panneau.right && x + LARGEUR > panneau.left

describe("l'infobulle sort du panneau qui porte son ancre", () => {
  // ── « Une infobulle ouverte depuis un panneau de réglages ne recouvre aucun
  //     contrôle de ce panneau, à l'univers, aux réglages et dans la fiche » ──

  test.each([
    // L'univers : 380 px collés à gauche, sous une barre de tête.
    ["l'univers", cadre(0, 380), ETROIT],
    // La fiche : 380 px collés à droite.
    ["la fiche", cadre(ETROIT.largeur - 380, ETROIT.largeur), ETROIT],
    // Les réglages : 520 px posés au milieu, donc de la place des deux côtés.
    ["les réglages", cadre(380, 900), ETROIT],
    // La colonne de réglages de l'atelier : 300 px, après l'arbre de 240.
    ["l'atelier", cadre(240, 540), ETROIT],
    // Les mêmes, sur l'écran large.
    ["l'univers, écran large", cadre(0, 380), LARGE],
    ["la fiche, écran large", cadre(LARGE.largeur - 380, LARGE.largeur), LARGE],
  ])("%s : la bulle ne recouvre pas le panneau", (_, panneau, fenetre) => {
    // L'ancre est **dans** le panneau, comme à l'écran : c'est très exactement
    // le cas où la règle d'avant se trompait, puisqu'elle regardait le milieu
    // de la fenêtre et non le panneau.
    const ancre = cadre(panneau.left + 16, panneau.left + 120, 200)
    const { x } = placer(panneau, ancre, fenetre, 180)

    expect(recouvre(x, panneau)).toBe(false)
    // Et elle reste entièrement dans l'écran.
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + LARGEUR).toBeLessThanOrEqual(fenetre.largeur)
  })

  test("la règle d'avant se trompait, et cet essai le montre", () => {
    // Le panneau des réglages, posé au milieu : une ancre dans sa moitié
    // gauche est **à gauche du milieu de la fenêtre**, donc l'ancienne règle
    // ouvrait la bulle vers la droite… c'est-à-dire sur le panneau lui-même.
    const panneau = cadre(380, 900)
    const ancre = cadre(400, 500, 200)

    const avant = ancre.right + 10 // ce que la règle d'avant calculait
    expect(recouvre(avant, panneau)).toBe(true)

    const { x } = placer(panneau, ancre, ETROIT, 180)
    expect(recouvre(x, panneau)).toBe(false)
  })

  // ── « Un panneau plus large que la place restante fait sortir la bulle du
  //     panneau, jamais dessus, et elle reste entièrement dans l'écran » ──────

  test("le côté le plus large gagne, même quand les deux sont serrés", () => {
    // Un panneau qui laisse 300 px à gauche et 100 à droite : la bulle part à
    // gauche, où elle tient, et pas du côté où elle chevaucherait.
    const panneau = cadre(300, 1180)
    const { x } = placer(panneau, cadre(320, 420, 100), ETROIT, 180)

    expect(recouvre(x, panneau)).toBe(false)
    expect(x + LARGEUR).toBeLessThanOrEqual(panneau.left)
  })

  test("elle reste dans l'écran quand aucun côté ne l'accepte entière", () => {
    // Un cas que le produit n'a pas — un panneau qui déborde presque l'écran —
    // et qui dit ce qui l'emporte alors : **rester atteignable**. Une bulle
    // posée hors de l'écran n'explique plus rien du tout.
    const panneau = cadre(40, 1240)
    const { x } = placer(panneau, cadre(60, 160, 100), ETROIT, 180)

    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + LARGEUR).toBeLessThanOrEqual(ETROIT.largeur)
  })

  // ── « Sans panneau déclaré, le calcul retombe sur ce qu'il faisait » ───────

  test("sans panneau, c'est l'ancre qui décide — la barre d'outils, le prompt", () => {
    // L'appelant passe alors l'ancre en guise de cadre : une ancre à gauche
    // ouvre à droite, une ancre à droite ouvre à gauche. C'est la règle de
    // l'atelier, inchangée là où elle était juste.
    const aGauche = cadre(100, 200, 40)
    expect(placer(aGauche, aGauche, ETROIT).x).toBe(210)

    const aDroite = cadre(1100, 1200, 40)
    expect(placer(aDroite, aDroite, ETROIT).x).toBe(810)
  })

  // ── La verticale : elle suit l'ancre, pas le panneau ──────────────────────

  test("elle s'aligne sur ce qu'elle explique, pas sur le haut du panneau", () => {
    const panneau = cadre(0, 380, 0)
    const ancre = cadre(16, 120, 600)

    expect(placer(panneau, ancre, LARGE, 100).y).toBe(596)
  })

  test("elle remonte plutôt que de sortir par le bas, et jamais au-dessus du bord", () => {
    const panneau = cadre(0, 380, 0)

    // Une ancre en bas d'écran : la bulle remonte pour tenir entière.
    const bas = placer(panneau, cadre(16, 120, 690), ETROIT, 200)
    expect(bas.y + 200).toBeLessThanOrEqual(ETROIT.hauteur)

    // Une bulle plus haute que l'écran : elle se colle en haut et se borne —
    // « sans plancher, exprès : un plancher la rendrait plus haute que la
    // place offerte, donc rognée, donc son pied inatteignable ».
    const geante = placer(panneau, cadre(16, 120, 400), ETROIT, 2000)
    expect(geante.y).toBe(8)
    expect(geante.hauteurMax).toBe(ETROIT.hauteur - 16)
  })
})
