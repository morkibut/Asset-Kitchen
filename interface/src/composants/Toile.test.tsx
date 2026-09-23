// Les règles de la toile, **sans écran**.
//
// `App.test.tsx` reste le seul endroit du dépôt où l'interface est montée et
// pilotée ; ce fichier-ci ne monte rien. Il existe parce que la toile a une
// géométrie, et qu'une géométrie ne se vérifie pas en cliquant : où une carte se
// pose quand elle n'a jamais été posée, jusqu'où un îlot s'étend, et lequel
// attrape une carte lâchée à un endroit donné.
//
// **Et un essai d'écran garde ce que celui-ci ne peut pas voir** : sans les
// `handles` déclarées sur chaque nœud, `@xyflow/react` refuse de résoudre une
// arête et **aucun trait ne paraît** — sans un mot. Les essais de lien de
// `App.test.tsx` tombent alors, ce qui est exactement leur travail : la règle
// est ici, la preuve qu'elle est branchée est là-bas.
//
// **C'est aussi le seul endroit où ces règles *peuvent* être vérifiées.** jsdom
// ne met rien en page : tout rectangle y vaut zéro, donc un essai qui tirerait
// une carte à l'écran classerait toujours dans le même îlot — celui de la boîte
// vide qui contient l'origine. Les fonctions sont pures pour cette raison-là,
// et le glissement lui-même se vérifie au navigateur, comme toute mise en page
// dans ce dépôt.

import { describe, expect, test } from "vitest"

import type { Carte, Lien, PhraseDeCarte, Teinte } from "../api"
import {
  aimanter,
  ancrer,
  basculerLaSelection,
  carteSous,
  cequiPartDeLaToile,
  classer,
  departDeFabrication,
  disposer,
  ilotPerdu,
  ilotSous,
  ilotsDe,
  ilotsPerdusParLeLot,
  menaceDe,
  originesReliees,
  placeLibre,
  referencesDEncore,
  selectionVive,
  texteACorriger,
  type Crans,
} from "./Toile"
import { origineDeLiaison } from "./ToileFabrique"

/** Un trait entre deux objets, tel que le serveur le rend. */
const lien = (identifiant: string, de: Lien["de"], vers: Lien["de"]): Lien => ({
  identifiant,
  projet: "bac-a-sable",
  de,
  vers,
  mot: "",
  pointe: false,
  cree_le: 1_787_800_200,
})

const surCarte = (identifiant: string): Lien["de"] => ({
  genre: "carte",
  valeur: identifiant,
})
const surIlot = (nom: string): Lien["de"] => ({ genre: "ilot", valeur: nom })

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
    teinte: "",
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

// ── La toile révisée du 28 août 2026 ────────────────────────────────────────
//
// Deux règles neuves, et les deux sont de la géométrie : elles se vérifient donc
// ici. Le reste de la révision — le bandeau en teinte pleine, les trois prises,
// les deux échelles — est du dessin, et le dessin se juge au navigateur.

describe("on entre par le centre, on sort par le tout", () => {
  const marais = { nom: "marais", membres: 3, boite: { x: 0, y: 0, l: 400, h: 300 } }

  test("le centre dedans fait entrer, même en venant de nulle part", () => {
    expect(classer({ x: 150, y: 100, l: 100, h: 100 }, "", [marais])).toBe("marais")
  })

  test("le centre dehors ne fait pas sortir tant qu'on touche encore", () => {
    // Le défaut que cette règle corrige : il suffisait d'en passer la moitié
    // par-dessus la bordure pour qu'un groupe s'efface, c'est-à-dire qu'un îlot
    // lâchait une carte qui était encore visiblement dedans.
    const sortante = { x: 360, y: 100, l: 100, h: 100 }
    expect(sortante.x + sortante.l / 2).toBeGreaterThan(marais.boite.l)
    expect(classer(sortante, "marais", [marais])).toBe("marais")
    // **Et le seuil d'entrée reste le seuil d'entrée** : la même carte, venue du
    // dehors, n'entre pas. C'est ça, l'hystérésis — deux seuils, pas un.
    expect(classer(sortante, "", [marais])).toBe("")
  })

  test("ne plus rien toucher fait sortir", () => {
    expect(classer({ x: 401, y: 100, l: 100, h: 100 }, "marais", [marais])).toBe("")
  })

  test("entrer l'emporte sur rester", () => {
    // Deux îlots voisins peuvent tenir la même carte — l'un parce qu'elle le
    // touche encore, l'autre parce que son centre y est déjà —, et une carte n'a
    // qu'un groupe. Sans ordre fixe, le classement dépendrait de l'ordre de la
    // liste, ce qui est la manière la plus discrète de n'avoir aucune règle.
    const petit = { nom: "marais", membres: 1, boite: { x: 0, y: 0, l: 200, h: 200 } }
    const voisin = { nom: "nord", membres: 1, boite: { x: 210, y: 0, l: 200, h: 200 } }
    const carte = { x: 180, y: 50, l: 100, h: 100 }

    // Elle touche encore « marais » — et c'est pourtant « nord » qui prend.
    expect(carte.x).toBeLessThan(petit.boite.l)
    expect(classer(carte, "marais", [petit, voisin])).toBe("nord")
    expect(classer(carte, "marais", [voisin, petit])).toBe("nord")
  })

  test("un îlot qui n'existe plus ne retient rien", () => {
    // Le dernier membre sorti emporte l'îlot : le groupe d'avant ne désigne plus
    // rien, et « rester » n'a plus de sujet.
    expect(classer({ x: 900, y: 900, l: 100, h: 100 }, "atlantide", [marais])).toBe("")
  })
})

describe("ce qui arrive de la réserve ne se pose jamais sur une carte", () => {
  const taille = { l: 100, h: 100 }
  const occupee = [{ x: 0, y: 0, l: 100, h: 100 }]

  test("une place libre est rendue telle quelle", () => {
    expect(placeLibre({ x: 300, y: 0 }, taille, occupee, 1000)).toEqual({ x: 300, y: 0 })
    // Bord à bord n'est pas l'un sur l'autre : le seuil de recouvrement est
    // strict, celui du classement ne l'est pas — et les deux mots le disent.
    expect(placeLibre({ x: 100, y: 0 }, taille, occupee, 1000)).toEqual({ x: 100, y: 0 })
  })

  test("elle glisse d'une largeur et d'une gouttière vers la droite", () => {
    expect(placeLibre({ x: 0, y: 0 }, taille, occupee, 1000)).toEqual({ x: 109, y: 0 })
  })

  test("au bord elle passe à la ligne, et repart de la colonne du départ", () => {
    // La borne est le bord de l'îlot où l'on tombe : on ne pousse jamais une
    // carte au-delà de ce que la toile occupe déjà.
    expect(placeLibre({ x: 0, y: 0 }, taille, occupee, 100)).toEqual({ x: 0, y: 109 })
  })

  test("elle traverse une rangée pleine sans s'y arrêter", () => {
    const rangee = [
      { x: 0, y: 0, l: 100, h: 100 },
      { x: 109, y: 0, l: 100, h: 100 },
      { x: 218, y: 0, l: 100, h: 100 },
    ]
    expect(placeLibre({ x: 0, y: 0 }, taille, rangee, 318)).toEqual({ x: 0, y: 109 })
  })
})

// ── T9 : les liens et les notes ─────────────────────────────────────────────
//
// **Trois règles neuves, et les trois sont de la géométrie ou de l'arithmétique
// — donc les trois se vérifient ici.** Où un trait rencontre ce qu'il joint, ce
// qu'un point du plan désigne, et ce qu'un îlot emporte en disparaissant. Ce qui
// reste — tirer le trait lui-même — passe par la gestion de pointeur de la
// librairie, qui ne démarre pas sur des événements synthétisés : ça se vérifie
// au navigateur, et `docs/PLAN.md` le dit plutôt que de le laisser croire
// couvert.

describe("où un trait rencontre ce qu'il joint", () => {
  test("il part du côté qui fait face, et rien n'est stocké", () => {
    // Deux boîtes côte à côte : le trait sort par le bord droit de la première
    // et entre par le bord gauche de la seconde, à mi-hauteur des deux.
    const gauche = { x: 0, y: 0, l: 100, h: 100 }
    const droite = { x: 300, y: 0, l: 100, h: 100 }
    const [un, deux] = ancrer(gauche, droite)

    expect(un).toEqual({ x: 100, y: 50 })
    expect(deux).toEqual({ x: 300, y: 50 })
  })

  test("le côté change avec la direction, sans qu'on ait rien à lui dire", () => {
    // C'est toute la raison d'être de la fonction : un ancrage **calculé** ne
    // demande pas que l'objet ait une identité où le ranger — et c'est ce qui
    // permet à un îlot, qui n'en a pas, d'être une extrémité.
    const haut = { x: 0, y: 0, l: 100, h: 100 }
    const bas = { x: 0, y: 300, l: 100, h: 100 }
    const [un, deux] = ancrer(haut, bas)

    expect(un).toEqual({ x: 50, y: 100 })
    expect(deux).toEqual({ x: 50, y: 300 })
  })

  test("deux boîtes concentriques n'ont pas de côté qui se fasse face", () => {
    // Le trait a alors une longueur nulle : il ne se voit pas, ce qui est
    // exactement ce qu'il y a à montrer de deux objets posés l'un sur l'autre.
    const boite = { x: 10, y: 10, l: 80, h: 40 }
    expect(ancrer(boite, boite)).toEqual([
      { x: 50, y: 30 },
      { x: 50, y: 30 },
    ])
  })
})

describe("ce qu'un point du plan désigne", () => {
  const cartes = [
    carte("a", { groupe: "marais", position: [0, 0] }),
    carte("b", { groupe: "nord", position: [1000, 0] }),
  ]
  const places = disposer(cartes, CRANS)

  test("une carte d'abord, un îlot ensuite — l'ordre de ce que l'œil voit", () => {
    // Les `zIndex` posent la carte à 1 et l'îlot à 0 ; `carteSous` se demande
    // donc avant `ilotSous`. Un point sur la carte « a » est **sur la carte**,
    // même s'il est aussi dans l'étendue de l'îlot « marais » qui l'englobe.
    const surA = { x: 10, y: 10 }
    expect(carteSous(surA, cartes, places, CRANS)).toBe("a")
    expect(ilotSous(surA, ilotsDe(cartes, places, CRANS))).toBe("marais")
  })

  test("à côté de tout, il ne désigne rien — et un trait lâché là n'est pas un refus", () => {
    expect(carteSous({ x: 600, y: 600 }, cartes, places, CRANS)).toBe("")
  })

  test("une carte en réserve n'est pas sur le plan, donc rien ne la désigne", () => {
    const rangee = [carte("z")]
    expect(carteSous({ x: 0, y: 0 }, rangee, disposer(rangee, CRANS), CRANS)).toBe("")
  })
})

describe("ce qu'un îlot emporte en disparaissant", () => {
  const teintes: Record<string, Teinte> = { marais: "lichen" }

  test("le dernier membre qui sort emporte la teinte et les traits de l'îlot", () => {
    // **La moitié de l'annulation que le serveur ne peut pas tenir.** Il efface
    // à juste titre les liens et la teinte d'un îlot qui n'existe plus ; mais
    // Ctrl+Z, qui rend son groupe à la carte, ferait alors reparaître un îlot
    // **nu** — la couleur et les traits perdus en silence. L'écran a la toile
    // sous les yeux au moment du geste : il retient de quoi les reposer.
    const sortante = carte("seul", { groupe: "marais", position: [0, 0] })
    const liens = [
      lien("l1", surCarte("note"), surIlot("marais")),
      lien("l2", surCarte("note"), surCarte("ailleurs")),
    ]

    const perdu = ilotPerdu(sortante, [sortante], liens, teintes)
    expect(perdu).toEqual({
      nom: "marais",
      teinte: "lichen",
      liens: [liens[0]],
    })
  })

  test("tant qu'il reste un membre, rien ne se perd", () => {
    const sortante = carte("un", { groupe: "marais", position: [0, 0] })
    const reste = carte("deux", { groupe: "marais", position: [200, 0] })
    expect(
      ilotPerdu(sortante, [sortante, reste], [lien("l1", surCarte("n"), surIlot("marais"))], teintes),
    ).toBeUndefined()
  })

  test("passer d'un îlot à un autre emporte le premier, s'il était le dernier membre", () => {
    // **Le cas que « le groupe devient vide » ratait.** Tirer l'unique membre
    // d'un îlot droit dans un autre écrit un groupe **non vide** ; le premier
    // îlot disparaît quand même, avec son trait et sa couleur. La règle est donc
    // « le groupe change », pas « le groupe se vide ».
    const sortante = carte("seul", { groupe: "marais", position: [0, 0] })
    const voisine = carte("autre", { groupe: "nord", position: [500, 0] })
    const liens = [lien("l1", surIlot("marais"), surCarte("autre"))]
    expect(ilotPerdu(sortante, [sortante, voisine], liens, { marais: "iris" })).toEqual({
      nom: "marais",
      teinte: "iris",
      liens,
    })
  })

  test("une carte qui n'était dans aucun îlot n'emporte rien", () => {
    const posee = carte("libre", { position: [10, 10] })
    expect(ilotPerdu(posee, [posee], [], teintes)).toBeUndefined()
  })

  test("un îlot sans teinte emporte quand même ses traits", () => {
    // Le vide **est** une valeur : un îlot sans teinte porte celle du châssis.
    // Ce qui se repose est donc « pas de teinte », et ça ne doit pas empêcher
    // les traits de revenir.
    const sortante = carte("seul", { groupe: "nord", position: [0, 0] })
    const liens = [lien("l1", surIlot("nord"), surCarte("note"))]
    expect(ilotPerdu(sortante, [sortante], liens, {})).toEqual({
      nom: "nord",
      teinte: "",
      liens,
    })
  })
})

describe("ce qu'un glissement en cours menace", () => {
  // **La même vérité que ci-dessus, dite avant le geste au lieu d'après.** Ce qui
  // s'ajoute ici est une seule question : *où la carte tomberait-elle si on la
  // lâchait maintenant ?* — et l'écran la pose exactement comme au relâchement,
  // sans quoi l'avertissement mentirait la moitié du temps.
  const teintes: Record<string, Teinte> = { marais: "lichen" }
  const traits = [lien("l1", surCarte("note"), surIlot("marais"))]

  test("une carte qui reste dans son îlot ne menace rien", () => {
    // Le geste le plus courant de la toile : ranger une carte *dans* son îlot.
    // Il ne coûte jamais rien, et l'écran ne doit donc rien annoncer.
    const seule = carte("seule", { groupe: "marais", position: [0, 0] })
    expect(menaceDe(seule, "marais", [seule], traits, teintes)).toBeNull()
  })

  test("le dernier membre tiré dehors menace son îlot, avec ses traits", () => {
    const seule = carte("seule", { groupe: "marais", position: [0, 0] })
    expect(menaceDe(seule, "", [seule], traits, teintes)).toEqual({
      nom: "marais",
      teinte: "lichen",
      liens: traits,
    })
  })

  test("le dernier membre tiré dans un autre îlot menace le sien quand même", () => {
    // Tomber dans « nord » écrit un groupe **non vide**, et vide pourtant
    // « marais » : c'est le cas que « le groupe devient vide » ratait, et il se
    // voit maintenant pendant le geste.
    const seule = carte("seule", { groupe: "marais", position: [0, 0] })
    const voisine = carte("voisine", { groupe: "nord", position: [500, 0] })
    expect(menaceDe(seule, "nord", [seule, voisine], traits, teintes)?.nom).toBe("marais")
  })

  test("une carte parmi d'autres ne menace pas son îlot", () => {
    const une = carte("une", { groupe: "marais", position: [0, 0] })
    const deux = carte("deux", { groupe: "marais", position: [200, 0] })
    expect(menaceDe(une, "", [une, deux], traits, teintes)).toBeNull()
  })

  test("une carte sans groupe ne menace rien, où qu'elle aille", () => {
    // Elle n'a pas d'îlot à vider : la poser dans un îlot en **remplit** un.
    const libre = carte("libre", { position: [10, 10] })
    expect(menaceDe(libre, "marais", [libre], traits, teintes)).toBeNull()
    expect(menaceDe(libre, "", [libre], traits, teintes)).toBeNull()
  })
})

// ── RP9 : ce que porte la sélection ─────────────────────────────────────────
//
// La sélection est une liste d'identifiants, et **rien d'autre ne voyage** : ce
// qui suit est toute l'arithmétique qui en découle, et elle se vérifie sans
// écran. Ce que la sélection *fait* — l'anneau, les trois boutons, la
// préparation qui s'ouvre — se vérifie dans `App.test.tsx`.

describe("ce qui reste choisi", () => {
  test("une carte supprimée sort de la sélection d'elle-même", () => {
    // Rien ne nettoie la liste : ce qui est sélectionné est ce que la toile
    // montre **et** que l'auteur a choisi, lu à chaque fois.
    const une = carte("une", { position: [0, 0] })
    expect(selectionVive([une], ["une", "partie"])).toEqual(["une"])
  })

  test("une carte renvoyée en réserve sort par la même règle", () => {
    // Elle existe toujours, mais la toile ne la montre plus — donc elle n'est
    // plus dans l'ensemble qui est sous les yeux.
    const rangee = carte("rangee")
    expect(rangee.en_reserve).toBe(true)
    expect(selectionVive([rangee], ["rangee"])).toEqual([])
  })

  test("une carte déplacée y reste : déplacer n'est pas choisir", () => {
    const bougee = carte("bougee", { position: [900, 900] })
    expect(selectionVive([bougee], ["bougee"])).toEqual(["bougee"])
  })

  test("l'ordre est celui où l'auteur les a prises", () => {
    const une = carte("une", { position: [0, 0] })
    const deux = carte("deux", { position: [200, 0] })
    expect(selectionVive([une, deux], ["deux", "une"])).toEqual(["deux", "une"])
  })
})

describe("le clic, et ce qu'il fait de la sélection", () => {
  test("un clic nu remplace", () => {
    expect(basculerLaSelection(["une", "deux"], "trois", false)).toEqual(["trois"])
  })

  test("recliquer la carte seule la lâche", () => {
    // Le clic faisait déjà ça avant la sélection, et il continue.
    expect(basculerLaSelection(["une"], "une", false)).toEqual([])
  })

  test("recliquer une carte d'un lot ramène le lot à elle", () => {
    // Pas un lâcher : elle n'était pas seule, donc le clic nu *remplace*.
    expect(basculerLaSelection(["une", "deux"], "une", false)).toEqual(["une"])
  })

  test("Ctrl ajoute, puis retire", () => {
    const deux = basculerLaSelection(["une"], "deux", true)
    expect(deux).toEqual(["une", "deux"])
    expect(basculerLaSelection(deux, "une", true)).toEqual(["deux"])
  })

  test("le plan nu efface tout, avec ou sans modificateur", () => {
    expect(basculerLaSelection(["une", "deux"], null, false)).toEqual([])
    expect(basculerLaSelection(["une", "deux"], null, true)).toEqual([])
  })
})

describe("ce que la sélection donnerait à la préparation", () => {
  test("les images d'un côté, les notes de l'autre", () => {
    // **Tout le critère tient là** : les deux ne se mêlent pas, donc l'écran
    // peut joindre les unes d'avance et pas les autres.
    const image = carte("image", { position: [0, 0] })
    const note = carte("note", {
      genre: "texte",
      texte: "des tons de tourbe",
      position: [200, 0],
    })
    expect(cequiPartDeLaToile([image, note], ["image", "note"])).toEqual({
      images: ["image"],
      notes: ["des tons de tourbe"],
    })
  })

  test("une image qui n'est pas arrivée n'entre pas", () => {
    // Joindre une adresse qui n'a rien rendu ferait payer un appel à qui il
    // manque exactement ça.
    const attente = carte("attente", {
      statut: "attente",
      montrable: false,
      position: [0, 0],
    })
    const echouee = carte("echouee", { statut: "echouee", position: [200, 0] })
    expect(
      cequiPartDeLaToile([attente, echouee], ["attente", "echouee"]).images,
    ).toEqual([])
  })

  test("un clip posé sur la toile part comme une image", () => {
    // Sa vignette est la première image du clip, servie par la route des
    // cartes : du point de vue de ce qui part, c'est une image.
    const clip = carte("clip", {
      genre: "video",
      source: "clip:video-1",
      position: [0, 0],
    })
    expect(cequiPartDeLaToile([clip], ["clip"]).images).toEqual(["clip"])
  })

  test("une note vide ne devient pas une consigne vide", () => {
    const blanche = carte("blanche", { genre: "texte", texte: "   ", position: [0, 0] })
    expect(cequiPartDeLaToile([blanche], ["blanche"]).notes).toEqual([])
  })

  test("ce que la toile ne montre plus ne part pas", () => {
    const rangee = carte("rangee")
    expect(cequiPartDeLaToile([rangee], ["rangee"])).toEqual({
      images: [],
      notes: [],
    })
  })
})

describe("ce qu'un lot emporte en partant", () => {
  // **Ce n'est pas `ilotPerdu` répété**, et c'est la raison d'être de la
  // fonction : cinq cartes du même groupe, prises une à une, laissent chacune
  // quatre survivantes et ne perdent donc rien — alors que le lot vide le
  // groupe.
  const teintes: Record<string, Teinte> = { marais: "lichen", nord: "prune" }
  const traits = [lien("l1", surCarte("dehors"), surIlot("marais"))]

  test("le lot qui vide un groupe emporte sa teinte et ses traits", () => {
    const une = carte("une", { groupe: "marais", position: [0, 0] })
    const deux = carte("deux", { groupe: "marais", position: [200, 0] })
    expect(ilotsPerdusParLeLot(["une", "deux"], [une, deux], traits, teintes)).toEqual([
      { nom: "marais", teinte: "lichen", liens: traits },
    ])
  })

  test("une carte par carte, le même lot ne perdrait rien", () => {
    // La preuve du piège, écrite : c'est la même toile, et la réponse change
    // selon qu'on pose la question sur la carte ou sur le lot.
    const une = carte("une", { groupe: "marais", position: [0, 0] })
    const deux = carte("deux", { groupe: "marais", position: [200, 0] })
    expect(ilotPerdu(une, [une, deux], traits, teintes)).toBeUndefined()
    expect(ilotPerdu(deux, [une, deux], traits, teintes)).toBeUndefined()
  })

  test("un groupe qui garde un membre hors du lot survit", () => {
    const une = carte("une", { groupe: "marais", position: [0, 0] })
    const deux = carte("deux", { groupe: "marais", position: [200, 0] })
    expect(ilotsPerdusParLeLot(["une"], [une, deux], traits, teintes)).toEqual([])
  })

  test("deux groupes vidés d'un coup en font deux", () => {
    const une = carte("une", { groupe: "marais", position: [0, 0] })
    const deux = carte("deux", { groupe: "nord", position: [500, 0] })
    const perdus = ilotsPerdusParLeLot(["une", "deux"], [une, deux], traits, teintes)
    expect(perdus.map((i) => i.nom).sort()).toEqual(["marais", "nord"])
  })

  test("des cartes sans groupe ne perdent aucun îlot", () => {
    const libre = carte("libre", { position: [10, 10] })
    expect(ilotsPerdusParLeLot(["libre"], [libre], traits, teintes)).toEqual([])
  })
})

describe("ce qu'un blur de correction doit écrire (RT7)", () => {
  test("un texte changé se corrige", () => {
    const note = carte("note", {
      genre: "texte",
      texte: "des tons de tourbe",
      position: [0, 0],
    })
    expect(texteACorriger(note, "des tons de tourbe froide")).toBe(
      "des tons de tourbe froide",
    )
  })

  test("les blancs qui l'entourent ne partent pas dans la comparaison ni dans l'écriture", () => {
    const note = carte("note", { genre: "texte", texte: "tourbe", position: [0, 0] })
    expect(texteACorriger(note, "  tourbe  ")).toBeNull()
    expect(texteACorriger(note, "  tourbe froide  ")).toBe("tourbe froide")
  })

  test("un champ vidé referme sans écrire — comme le brouillon d'une note neuve", () => {
    const note = carte("note", { genre: "texte", texte: "tourbe", position: [0, 0] })
    expect(texteACorriger(note, "   ")).toBeNull()
    expect(texteACorriger(note, "")).toBeNull()
  })

  test("relire sans corriger referme sans appel", () => {
    const note = carte("note", { genre: "texte", texte: "tourbe", position: [0, 0] })
    expect(texteACorriger(note, "tourbe")).toBeNull()
  })
})

// TS10 — « Développer ce sujet » : quelle carte relier au résultat, calculée
// au moment précis du clic sur Fabriquer, pas mémorisée au clic sur
// « Développer ».

describe("la carte à relier, quand on développe un sujet (TS10)", () => {
  test("sans développement en cours, rien à relier", () => {
    const heron = carte("heron", { position: [0, 0] })
    expect(origineDeLiaison(null, [heron])).toBeUndefined()
  })

  test("l'origine part tant qu'elle est toujours parmi ce qui part", () => {
    const heron = carte("heron", { position: [0, 0] })
    expect(origineDeLiaison("heron", [heron])).toEqual(["heron"])
  })

  test("une croix retirée entre les deux clics annule la liaison, pas seulement la vignette", () => {
    // « Développer » a mémorisé « heron », mais sa vignette a été retirée de
    // la barre avant qu'on clique sur Fabriquer : la référence prise, elle,
    // le sait déjà (elle ne l'envoie plus) — la liaison doit le savoir aussi.
    const renard = carte("renard", { position: [0, 0] })
    expect(origineDeLiaison("heron", [renard])).toBeUndefined()
    expect(origineDeLiaison("heron", [])).toBeUndefined()
  })
})

// TS7 — les trois gestes de Mixboard : Combiner, Encore, et le lien visible
// généralisé à toute fabrication avec des références (TS10 ne reliait qu'à
// l'origine d'un développement).

describe("le lien visible, généralisé à toute référence (TS7)", () => {
  test("sans rien de pris ni d'« Encore » en cours, rien à relier — le cas courant", () => {
    expect(originesReliees([], null, null)).toBeUndefined()
  })

  test("« Combiner » relie le résultat à chacune des cartes combinées, pas seulement à une", () => {
    // **C'est le cas que TS10 seul ne couvrait pas** : deux références sans
    // développement en cours (`origineDeveloppement: null`) ne donnaient
    // jamais de lien avant cette tranche — `origineDeLiaison(null, ...)` est
    // toujours `undefined`. Un essai qui neutraliserait `origineEncore` et
    // repasserait par `origineDeLiaison` seul tomberait ici (8octies).
    const heron = carte("heron", { position: [0, 0] })
    const renard = carte("renard", { position: [200, 0] })
    expect(originesReliees([heron, renard], null, null)?.sort()).toEqual(["heron", "renard"])
  })

  test("« Encore » relie au fabriqué d'origine, qui n'est pourtant pas une référence envoyée", () => {
    // L'original n'est jamais dans `references` — « Encore » ne le réinjecte
    // pas, il relance la même demande. Sans `origineEncore`, aucune des deux
    // autres sources (`references`, `origineDeLiaison`) ne le verrait.
    expect(originesReliees([], null, "le-heron-original")).toEqual(["le-heron-original"])
  })

  test("une référence prise à la main (TS6, sans Développer ni Encore) relie aussi désormais", () => {
    const renard = carte("renard", { position: [0, 0] })
    expect(originesReliees([renard], null, null)).toEqual(["renard"])
  })

  test("les trois sources se cumulent sans jamais doubler un identifiant", () => {
    const heron = carte("heron", { position: [0, 0] })
    expect(originesReliees([heron], "heron", "heron")).toEqual(["heron"])
  })
})

describe("où se pose une fabrication par rapport à ses références (Combiner, TS7)", () => {
  const boite = (x: number, y: number, l: number, h: number) => ({ x, y, l, h })

  test("sans référence posée sur le plan, rien à calculer ici — l'appelant retombe sur le centre de l'écran", () => {
    expect(departDeFabrication(null, 0, 60, 20)).toBeNull()
  })

  test("une seule référence : à côté, comme TS10 — inchangé", () => {
    const autour = boite(100, 40, 160, 160)
    expect(departDeFabrication(autour, 1, 60, 20)).toEqual({
      x: autour.x + autour.l + 27, // GOUTTIERE (9) × 3
      y: autour.y,
    })
  })

  test("« Combiner » — deux références ou plus : centré sur leur englobant, pas à côté", () => {
    // **Le cas que TS10 seul rendait faux** : avant cette tranche, tout
    // lancement se posait à droite des références, quel qu'en soit le
    // nombre — un essai qui repasserait par la seule branche « à côté »
    // tomberait ici (8octies).
    const autour = boite(100, 40, 160, 160)
    const depart = departDeFabrication(autour, 2, 60, 20)
    expect(depart).toEqual({
      x: autour.x + autour.l / 2 - 30,
      y: autour.y + autour.h / 2 - 10,
    })
    // Et ce n'est bien pas la formule « à côté » : le point calculé tombe à
    // l'intérieur de l'englobant, pas à sa droite.
    expect(depart!.x).toBeLessThan(autour.x + autour.l)
  })
})

describe("« Encore » : les références de l'appel d'origine, reconstituées (TS7)", () => {
  const phrase = (references: PhraseDeCarte["references"]): PhraseDeCarte => ({
    texte: "un héron",
    modele: "essai:rend-du-png",
    resolution: "512",
    repris: false,
    references,
  })

  test("aucune référence à l'origine : rien à reconstituer", () => {
    expect(referencesDEncore(phrase([]))).toEqual([])
  })

  test("une référence venue d'une carte du tableau se reconstitue", () => {
    expect(
      referencesDEncore(phrase([{ asset: "renard", role: "edition", origine: "carte" }])),
    ).toEqual(["renard"])
  })

  test("une référence venue de la bibliothèque (pas une carte) ne se reconstitue pas en prise", () => {
    // Une prise de la barre ne peut désigner qu'une carte du tableau
    // (`referencesPrises`) : une référence `origine: "asset"` — un artwork
    // promu, par exemple — n'a pas de vignette à rouvrir ici.
    expect(
      referencesDEncore(phrase([{ asset: "artwork-1", role: "reference", origine: "asset" }])),
    ).toEqual([])
  })
})
