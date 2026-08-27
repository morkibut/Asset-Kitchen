// Les règles de la toile, **sans écran**.
//
// `App.test.tsx` reste le seul endroit du dépôt où l'interface est montée et
// pilotée ; ce fichier-ci ne monte rien. Il existe parce que la toile a une
// géométrie, et qu'une géométrie ne se vérifie pas en cliquant : où une carte se
// pose quand elle n'a jamais été posée, jusqu'où un îlot s'étend, et lequel
// attrape une carte lâchée à un endroit donné.
//
// **C'est aussi le seul endroit où ces règles *peuvent* être vérifiées.** jsdom
// ne met rien en page : tout rectangle y vaut zéro, donc un essai qui tirerait
// une carte à l'écran classerait toujours dans le même îlot — celui de la boîte
// vide qui contient l'origine. Les fonctions sont pures pour cette raison-là,
// et le glissement lui-même se vérifie au navigateur, comme toute mise en page
// dans ce dépôt.

import { describe, expect, test } from "vitest"

import type { Carte } from "../api"
import { aimanter, disposer, ilotSous, ilotsDe, type Crans } from "./Toile"

/** Les trois crans, tels que la grille les rendrait sur une colonne de 160 px :
 *  160, puis 160×2 + 9, puis 160×4 + 9×3. Ils sont écrits ici parce qu'un essai
 *  doit décider de la mesure ; à l'écran, ils se **mesurent**. */
const CRANS: Crans = { 1: 160, 2: 329, 4: 667 }

const carte = (identifiant: string, sur: Partial<Carte> = {}): Carte => {
  const objet: Carte = {
    identifiant,
    projet: "bac-a-sable",
    genre: "image",
    texte: "",
    statut: "prete",
    raison: null,
    source: "",
    cree_le: 1_787_800_100,
    groupe: "",
    note: "",
    taille: 1,
    position: null,
    largeur_libre: null,
    officiel: false,
    famille: "tous",
    empreinte: "cafe1234",
    largeur: 512,
    hauteur: 512,
    type_media: "image/png",
    octets: 4096,
    montrable: true,
    artwork: false,
    en_reserve: true,
    ...sur,
  }
  // La règle du serveur, rejouée pour fabriquer un état cohérent : un essai qui
  // pourrait poser `en_reserve` à côté d'un groupe prouverait quelque chose de
  // faux.
  return { ...objet, en_reserve: !objet.groupe && !objet.position }
}

describe("ce que la toile montre", () => {
  test("ce qui n'a ni groupe ni place n'est pas sur le plan", () => {
    const cartes = [carte("a"), carte("b", { groupe: "marais" })]
    const places = disposer(cartes, CRANS)

    expect(places.has("a")).toBe(false)
    expect(places.has("b")).toBe(true)
    expect(ilotsDe(cartes, places, CRANS).map((i) => i.nom)).toEqual(["marais"])
  })

  test("une carte qui porte sa place la garde, exactement", () => {
    const places = disposer([carte("a", { position: [317, -42] })], CRANS)
    expect(places.get("a")).toEqual({ x: 317, y: -42 })
  })

  test("trois groupes font trois îlots nommés et peuplés, sans qu'on ait rien fait", () => {
    // Le critère de la tranche, et il porte sur des cartes **groupées avant la
    // toile** : elles n'ont aucune position, et l'ouverture les pose dans leur
    // îlot sans rien écrire.
    const cartes = [
      carte("a", { groupe: "marais" }),
      carte("b", { groupe: "marais" }),
      carte("c", { groupe: "nord" }),
      carte("d", { groupe: "trait" }),
      carte("e"),
    ]
    const places = disposer(cartes, CRANS)
    const ilots = ilotsDe(cartes, places, CRANS)

    expect(ilots.map((i) => i.nom)).toEqual(["marais", "nord", "trait"])
    expect(ilots.map((i) => i.membres)).toEqual([2, 1, 1])

    // Chaque îlot englobe ses membres, et rien d'autre : les trois ne se
    // recouvrent pas.
    for (const [premier, second] of [
      [ilots[0], ilots[1]],
      [ilots[1], ilots[2]],
      [ilots[0], ilots[2]],
    ])
      expect(
        premier.boite.y + premier.boite.h <= second.boite.y ||
          second.boite.y + second.boite.h <= premier.boite.y ||
          premier.boite.x + premier.boite.l <= second.boite.x ||
          second.boite.x + second.boite.l <= premier.boite.x,
        `${premier.nom} et ${second.nom} se chevauchent`,
      ).toBe(true)
  })

  test("un îlot vide n'existe pas — un groupe sans carte n'a nulle part où être écrit", () => {
    // « La contrepartie est assumée » (`docs/ARCHITECTURE.md` §5). Le dernier
    // membre qui sort emporte l'îlot, et il n'y a rien à nettoyer : il n'a
    // jamais existé ailleurs que dans ses membres.
    const cartes = [carte("a", { groupe: "marais" })]
    const sortie = [carte("a")]
    expect(ilotsDe(cartes, disposer(cartes, CRANS), CRANS)).toHaveLength(1)
    expect(ilotsDe(sortie, disposer(sortie, CRANS), CRANS)).toHaveLength(0)
  })

  test("deux ouvertures donnent la même toile", () => {
    // **Le calcul est déterministe, et c'est ce qui fait tenir « rouvrir rend la
    // toile telle qu'elle a été laissée » pour un tableau hérité de T4** : ces
    // cartes-là n'ont pas de place écrite, donc c'est le calcul qui *est* leur
    // place — et un calcul qui varierait les déplacerait à chaque ouverture.
    const cartes = [
      carte("a", { groupe: "marais" }),
      carte("b", { groupe: "nord", taille: 4 }),
      carte("c", { groupe: "marais", position: [80, 80] }),
    ]
    expect([...disposer(cartes, CRANS)]).toEqual([...disposer(cartes, CRANS)])
  })

  test("ce qu'on compose se pose sous ce qui a déjà une place", () => {
    // Une carte posée à la main ne se fait pas recouvrir par un rangement
    // qu'elle n'a pas demandé.
    const cartes = [
      carte("posee", { position: [0, 0] }),
      carte("a", { groupe: "marais" }),
    ]
    const places = disposer(cartes, CRANS)
    expect(places.get("a")!.y).toBeGreaterThan(places.get("posee")!.y + CRANS[1])
  })

  test("un îlot neuf ne rentre pas dans un îlot entamé qui s'est étendu", () => {
    // **Vu sur un vrai tableau, pas au banc.** « nord » n'a qu'une carte posée
    // et deux à poser : il grandit vers le bas en les accueillant. Un socle
    // mesuré avant ce placement aurait calé « marais » sous la seule carte
    // d'origine — donc au milieu de « nord ».
    const cartes = [
      carte("ancre", { groupe: "nord", position: [0, 0] }),
      carte("n2", { groupe: "nord" }),
      carte("n3", { groupe: "nord" }),
      carte("m1", { groupe: "marais" }),
      carte("m2", { groupe: "marais" }),
    ]
    const places = disposer(cartes, CRANS)
    const [marais, nord] = ["marais", "nord"].map(
      (nom) => ilotsDe(cartes, places, CRANS).find((i) => i.nom === nom)!.boite,
    )
    expect(marais.y).toBeGreaterThanOrEqual(nord.y + nord.h)
  })

  test("un îlot déjà entamé accueille la suite à sa droite", () => {
    const cartes = [
      carte("ancre", { groupe: "marais", position: [500, 300] }),
      carte("suite", { groupe: "marais" }),
    ]
    const places = disposer(cartes, CRANS)
    expect(places.get("ancre")).toEqual({ x: 500, y: 300 })
    expect(places.get("suite")!.x).toBeGreaterThan(500)
    expect(places.get("suite")!.y).toBe(300)
  })
})

describe("ce qu'une carte occupe", () => {
  test("la largeur libre prime sur le cran, et la hauteur suit le rapport de l'image", () => {
    const cartes = [
      carte("carree", { groupe: "g", largeur_libre: 200 }),
      carte("haute", { groupe: "g", largeur_libre: 200, largeur: 512, hauteur: 1024 }),
    ]
    const places = disposer(cartes, CRANS)
    const ilot = ilotsDe(cartes, places, CRANS)[0]

    // Les deux font 200 de large ; la seconde est deux fois plus haute, au pied
    // près. L'îlot, qui les englobe, en prend la mesure.
    expect(places.get("haute")!.x - places.get("carree")!.x).toBe(200 + 9)
    expect(ilot.boite.h).toBeGreaterThan(200 * 2)
  })

  test("sans rapport mesuré, une carte prend le carré", () => {
    // Une carte texte, une carte en attente : « une mesure ne s'affiche que si
    // elle a été prise » vaut aussi pour une forme.
    const cartes = [
      carte("note", { groupe: "g", genre: "texte", largeur: 0, hauteur: 0 }),
    ]
    const ilot = ilotsDe(cartes, disposer(cartes, CRANS), CRANS)[0]
    // Le carré du cran, plus le pied, plus la marge et la bande de l'îlot.
    expect(ilot.boite.h - ilot.boite.l).toBe(21 + 20)
  })
})

describe("l'aimant de la largeur libre", () => {
  test("le cran est un repère, pas une prison", () => {
    // On s'arrête dessus quand on passe à côté…
    expect(aimanter(CRANS, CRANS[1], 8)).toBe(CRANS[1])
    expect(aimanter(CRANS, CRANS[1], 176)).toBe(CRANS[2])
    expect(aimanter(CRANS, CRANS[2], 330)).toBe(CRANS[4])
    // …et on le dépasse quand on le veut : c'est **la seule mesure continue du
    // produit**, et l'aimant est ce qui l'empêche d'être arbitraire, pas ce qui
    // l'empêche d'exister.
    expect(aimanter(CRANS, CRANS[1], 60)).toBe(220)
    expect(aimanter(CRANS, 508, 100)).toBe(608)
  })

  test("la largeur reste dans ses bornes, et sans mesure elle n'est attirée par rien", () => {
    // Les mêmes bornes que le serveur : la poignée s'arrête d'elle-même plutôt
    // que d'aller chercher un refus qu'on connaît déjà.
    expect(aimanter(CRANS, CRANS[1], -9000)).toBe(48)
    expect(aimanter(CRANS, CRANS[1], 9000)).toBe(2048)
    // Sans crans mesurés, pas d'aimant — et surtout pas un aimant vers zéro.
    expect(aimanter(null, CRANS[1], 4)).toBe(164)
  })
})

describe("quel îlot attrape une carte lâchée", () => {
  const cartes = [
    carte("a", { groupe: "marais", position: [0, 0] }),
    carte("b", { groupe: "nord", position: [1000, 0] }),
  ]
  const ilots = ilotsDe(cartes, disposer(cartes, CRANS), CRANS)

  test("le centre dans l'étendue classe, à côté ne classe pas", () => {
    const marais = ilots.find((i) => i.nom === "marais")!
    const dedans = {
      x: marais.boite.x + marais.boite.l / 2,
      y: marais.boite.y + marais.boite.h / 2,
    }
    expect(ilotSous(dedans, ilots)).toBe("marais")
    // Lâchée sur le plan nu : posée, jamais classée. C'est le brouillon, et
    // c'est un état, pas un raté.
    expect(ilotSous({ x: 600, y: 600 }, ilots)).toBe("")
  })

  test("deux étendues qui se recouvrent donnent la plus serrée", () => {
    // Rien ne s'aligne tout seul sur cette toile : deux îlots peuvent se
    // chevaucher, et c'est celui qu'on visait — le plus petit — qui prend.
    const large = { nom: "large", membres: 9, boite: { x: 0, y: 0, l: 900, h: 900 } }
    const serre = { nom: "serré", membres: 1, boite: { x: 100, y: 100, l: 200, h: 200 } }
    expect(ilotSous({ x: 150, y: 150 }, [large, serre])).toBe("serré")
    expect(ilotSous({ x: 800, y: 800 }, [large, serre])).toBe("large")
  })
})
