// Les deux tables que B17 étend — *Couleurs* et *Nettoyer*.
//
// **Le premier essai est le plus important du fichier**, et c'est la panne que
// le dépôt a déjà payée deux fois : *un message partiel traité comme un objet
// entier* (`docs/PIEGES.md`, et `decalage` en `E17`). Chacun des trois réglages
// d'avant `B17` réécrivait la quantification depuis zéro ; avec six champs de
// plus, toucher au nombre de couleurs aurait effacé la cape échangée à côté.
//
// Aucun de ces essais ne coûte un centime : les deux panneaux sont montés à la
// main avec leurs `poser`/`regler` doublés, sans serveur et sans réseau.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { PanneauBords, PanneauQuantification } from "./Places"
import {
  estMiroir,
  RECETTE_VIDE,
  UNIVERS_VIDE,
  LIT_DE_COULEUR,
  type EtatTraitement,
  type Recette,
  type Univers,
} from "../api"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const TRAITEMENT = {
  quantification: { disponible: true, raison: null },
} as unknown as EtatTraitement

const UNIVERS: Univers = {
  ...UNIVERS_VIDE,
  couleurs: 24,
  palette: ["#6B5A44", "#3A6BC4", "#2E8B3A"],
}

/** Monte une table et rend les deux doubles, pour qu'un essai lise ce qui est
 *  **posé** — la recette entière — plutôt que ce qui a été cliqué. */
function monter(
  Table: typeof PanneauQuantification,
  recette: Recette,
  univers: Univers = UNIVERS,
) {
  const poser = vi.fn()
  const regler = vi.fn()
  render(
    <Table
      recette={recette}
      univers={univers}
      traitement={TRAITEMENT}
      regler={regler}
      poser={poser}
      mesures={null}
    />,
  )
  return { poser, regler }
}

/** Le curseur d'un réglage, désigné par son nom.
 *
 *  **La glissière elle-même n'a pas de nom accessible** — c'est le champ où la
 *  valeur s'écrit qui le porte (`U3`, *« le nom descend jusqu'au contrôle »*).
 *  On passe donc par lui, et on prend la glissière qui l'accompagne : les deux
 *  sont les deux bouts d'un seul réglage. */
function curseur(nom: string): HTMLInputElement {
  const champ = screen.getByLabelText(`${nom}, en chiffres`)
  const glissiere = champ.parentElement!.querySelector('input[type="range"]')
  if (!glissiere) throw new Error(`aucune glissière pour « ${nom} »`)
  return glissiere as HTMLInputElement
}


/** Glisser un curseur **et le relâcher** — les deux gestes, comme une main.
 *
 *  **La valeur se redonne au relâchement**, et ce n'est pas une redite : le
 *  panneau est contrôlé par la recette, et un `regler` doublé ne remonte rien —
 *  React remet donc la valeur du prop dans le champ entre les deux événements.
 *  Sans ce second `target`, le relâchement poserait l'ancienne valeur, et
 *  l'essai mesurerait le double au lieu de l'écran. */
function glisser(nom: string, valeur: number) {
  const glissiere = curseur(nom)
  fireEvent.change(glissiere, { target: { value: String(valeur) } })
  fireEvent.keyUp(glissiere, { target: { value: String(valeur) } })
}

// ── La table Couleurs ───────────────────────────────────────────────────────

describe("la table Couleurs", () => {
  test("toucher le nombre de couleurs n'efface pas les six réglages d'à côté", () => {
    const recette: Recette = {
      ...RECETTE_VIDE,
      quantification: {
        couleurs: 32,
        palette: ["#6B5A44"],
        tramage: "aucun",
        luminosite: 12,
        contraste: -8,
        saturation: 5,
        teinte: -30,
        echanges: [{ depuis: "#6B5A44", vers: "#3A6BC4", tolerance: 4 }],
      },
    }
    const { poser } = monter(PanneauQuantification, recette)

    fireEvent.click(screen.getByRole("button", { name: "16" }))

    const pose = poser.mock.calls.at(-1)![0] as Recette
    expect(pose.quantification!.couleurs).toBe(16)
    expect(pose.quantification!.luminosite).toBe(12)
    expect(pose.quantification!.contraste).toBe(-8)
    expect(pose.quantification!.saturation).toBe(5)
    expect(pose.quantification!.teinte).toBe(-30)
    expect(pose.quantification!.echanges).toEqual([
      { depuis: "#6B5A44", vers: "#3A6BC4", tolerance: 4 },
    ])
  })

  test("les quatre curseurs sont là, et ils partent de zéro", () => {
    monter(PanneauQuantification, RECETTE_VIDE)
    for (const nom of ["luminosité", "contraste", "saturation", "teinte"]) {
      expect(curseur(nom)).toHaveValue("0")
    }
  })

  test("la table dit que les curseurs passent avant de réduire", () => {
    monter(PanneauQuantification, RECETTE_VIDE)
    expect(screen.getByText(/avant de réduire/i)).toBeTruthy()
  })

  test("la table dit que l'échange passe après la réduction", () => {
    monter(PanneauQuantification, RECETTE_VIDE)
    expect(screen.getByText(/après la réduction/i)).toBeTruthy()
  })

  test("bouger un curseur pose la table entière", () => {
    const { poser } = monter(PanneauQuantification, RECETTE_VIDE)
    glisser("luminosité", 25)
    const pose = poser.mock.calls.at(-1)![0] as Recette
    expect(pose.quantification!.luminosite).toBe(25)
    expect(pose.quantification!.couleurs).toBe(24)
  })

  test("le glissement règle sans poser — c'est le relâchement qui envoie", () => {
    const { poser, regler } = monter(PanneauQuantification, RECETTE_VIDE)
    fireEvent.change(curseur("saturation"), { target: { value: "40" } })
    expect(regler).toHaveBeenCalled()
    expect(poser).not.toHaveBeenCalled()
  })

  test("ajouter un échange n'envoie rien — la paire inachevée reste à l'écran", () => {
    // ⚠️ **L'essai d'avant figeait le défaut.** Il vérifiait que le bouton
    // *pose* une paire vide, ce qui semblait raisonnable côté écran — sauf que
    // le serveur refuse une paire sans ses deux couleurs, à juste titre. Les
    // deux moitiés étaient défendables et leur rencontre rendait la table
    // inutilisable : la ligne ne paraissait jamais, et une bannière de refus
    // s'affichait à la place. Trouvé au navigateur, pas ici.
    const { poser } = monter(PanneauQuantification, RECETTE_VIDE)
    fireEvent.click(screen.getByRole("button", { name: /Échanger une couleur/i }))

    expect(poser).not.toHaveBeenCalled()
    expect(screen.getByText(/il manque la couleur qui vient/i)).toBeTruthy()
    // Et on ne peut pas en ouvrir une seconde par-dessus.
    expect(
      screen.getByRole("button", { name: /Échanger une couleur/i }),
    ).toBeDisabled()
  })

  test("la paire rejoint la recette quand sa seconde couleur est nommée", () => {
    const { poser } = monter(PanneauQuantification, RECETTE_VIDE)
    fireEvent.click(screen.getByRole("button", { name: /Échanger une couleur/i }))
    // La première couleur est déjà celle de la palette ; il manque la seconde.
    fireEvent.click(screen.getAllByRole("button", { name: "Prendre #3A6BC4" })[1])

    const pose = poser.mock.calls.at(-1)![0] as Recette
    expect(pose.quantification!.echanges).toEqual([
      { depuis: "#6B5A44", vers: "#3A6BC4", tolerance: 0 },
    ])
  })

  test("retirer la paire en cours n'envoie rien du tout", () => {
    const { poser } = monter(PanneauQuantification, RECETTE_VIDE)
    fireEvent.click(screen.getByRole("button", { name: /Échanger une couleur/i }))
    fireEvent.click(screen.getByRole("button", { name: /Retirer cet échange/i }))

    expect(poser).not.toHaveBeenCalled()
    expect(screen.queryByText(/il manque la couleur/i)).toBeNull()
  })

  test("le nombre de couleurs montré est celui qui sera posé", () => {
    // ⚠️ Le jeu d'essai est réglé à **24** couleurs, qui n'est aucun des cinq
    // nombres de la colonne. L'écran se repliait sur 32 pendant que le geste
    // posait 24 : deux vérités pour un seul réglage, et c'est celle qu'on lit
    // qui était fausse.
    monter(PanneauQuantification, RECETTE_VIDE)
    const segment = screen.getByRole("button", { name: "24" })
    expect(segment).toBeTruthy()
    expect(segment.className).toMatch(/ancien-signal/)
  })

  test("un échange posé se retire, et lui seul", () => {
    const recette: Recette = {
      ...RECETTE_VIDE,
      quantification: {
        couleurs: 24,
        palette: [],
        tramage: "aucun",
        echanges: [
          { depuis: "#6B5A44", vers: "#3A6BC4", tolerance: 0 },
          { depuis: "#2E8B3A", vers: "#000000", tolerance: 2 },
        ],
      },
    }
    const { poser } = monter(PanneauQuantification, recette)
    fireEvent.click(screen.getAllByRole("button", { name: /Retirer cet échange/i })[0])
    const pose = poser.mock.calls.at(-1)![0] as Recette
    expect(pose.quantification!.echanges).toEqual([
      { depuis: "#2E8B3A", vers: "#000000", tolerance: 2 },
    ])
  })

  test("une recette venue du serveur sans les six clés se lit à son neutre", () => {
    // **Le serveur n'écrit une clé neuve que posée** (règle de `B1`) : une
    // recette d'avant la tranche arrive donc sans ces six clés-là, et les lire
    // avec leur neutre est la façon exacte de les lire — pas un filet.
    const recette = {
      ...RECETTE_VIDE,
      quantification: { couleurs: 32, palette: [], tramage: "aucun" },
    } as Recette
    monter(PanneauQuantification, recette)
    expect(curseur("teinte")).toHaveValue("0")
  })
})

// ── La table Nettoyer ───────────────────────────────────────────────────────

describe("la table Nettoyer", () => {
  test("les deux moteurs neufs sont à l'écran, éteints", () => {
    monter(PanneauBords as typeof PanneauQuantification, RECETTE_VIDE)
    expect(curseur("grain de couleur")).toHaveValue("0")
    expect(curseur("lissage")).toHaveValue("0")
  })

  test("toucher la tache minimale n'efface pas le grain ni le lissage", () => {
    const recette: Recette = {
      ...RECETTE_VIDE,
      bords: { aire_min: 3, grain_min: 2, lissage: 1 },
    }
    const { poser } = monter(PanneauBords as typeof PanneauQuantification, recette)
    glisser("tache minimale", 7)
    const pose = poser.mock.calls.at(-1)![0] as Recette
    // La table entière voyage — y compris les sept moteurs neufs de `B18`,
    // à leur neutre puisqu'ils n'ont pas été touchés.
    expect(pose.bords).toEqual({
      aire_min: 7,
      grain_min: 2,
      lissage: 1,
      garder: 0,
      boucher_jusqua: 0,
      reboucher_jusqua: 0,
      ronger_regonfler: 0,
      regonfler_ronger: 0,
      vote_voisins: 0,
      epargner_traits_fins: true,
      designations: [],
    })
  })

  test("le grain éteint dit qu'il ne fait rien, plutôt que de se taire", () => {
    monter(PanneauBords as typeof PanneauQuantification, RECETTE_VIDE)
    expect(screen.getByText(/un pixel isolé au milieu d'un aplat reste où il est/i)).toBeTruthy()
  })

  test("le grain posé dit ce qu'il emporte, et ce qu'il ne touche jamais", () => {
    const recette: Recette = { ...RECETTE_VIDE, bords: { aire_min: 0, grain_min: 1 } }
    monter(PanneauBords as typeof PanneauQuantification, recette)
    expect(screen.getByText(/le bord du sujet n'est jamais touché/i)).toBeTruthy()
  })

  test("trois passes de lissage préviennent de ce qu'elles coûtent", () => {
    const recette: Recette = { ...RECETTE_VIDE, bords: { aire_min: 0, lissage: 3 } }
    monter(PanneauBords as typeof PanneauQuantification, recette)
    expect(screen.getByText(/perd ses angles vifs/i)).toBeTruthy()
  })

  test("une recette d'avant la tranche se lit sans ses deux clés neuves", () => {
    const recette = { ...RECETTE_VIDE, bords: { aire_min: 4 } } as Recette
    const { poser } = monter(PanneauBords as typeof PanneauQuantification, recette)
    glisser("lissage", 2)
    const pose = poser.mock.calls.at(-1)![0] as Recette
    // Même chose pour une recette d'avant `B18` : ses sept clés absentes se
    // lisent à leur neutre, et voyagent avec le reste de la table.
    expect(pose.bords).toEqual({
      aire_min: 4,
      grain_min: 0,
      lissage: 2,
      garder: 0,
      boucher_jusqua: 0,
      reboucher_jusqua: 0,
      ronger_regonfler: 0,
      regonfler_ronger: 0,
      vote_voisins: 0,
      epargner_traits_fins: true,
      designations: [],
    })
  })
})

// ── Le lit de couleur : dit, et non réglé ───────────────────────────────────

describe("le lit de couleur", () => {
  test("l'écran annonce le même nombre de pixels que le traitement en pose", () => {
    // Il n'est le réglage de personne, donc il n'a pas de curseur — mais un
    // traitement qui agit sans se voir nulle part est très exactement ce que le
    // relevé reproche au reste de la chaîne.
    expect(LIT_DE_COULEUR).toBe(3)
  })
})

// ── Une clé absente n'est pas une place remplie ─────────────────────────────

describe("une clé que le serveur omet", () => {
  test("une recette sans retournement n'est pas un miroir", () => {
    // **Le défaut trouvé au navigateur pendant `B17`, et il datait de `B1`.**
    // La règle du serveur est que la clé neuve ne s'écrit que remplie : une
    // recette sans retournement arrive **sans la clé**, donc `undefined`. Le
    // test strict `!== null` répondait *vrai*, et toute image gratuite du
    // produit s'affichait « miroir · gratuit » — y compris une image importée
    // que rien n'a jamais retournée.
    const sansLaCle = { ...RECETTE_VIDE } as Record<string, unknown>
    delete sansLaCle.retournement
    expect(estMiroir(sansLaCle as Recette)).toBe(false)
  })

  test("une recette qui porte un retournement en est bien un", () => {
    expect(estMiroir({ ...RECETTE_VIDE, retournement: { sens: "gauche-droite" } })).toBe(true)
  })

  test("un retournement endormi n'est pas un miroir", () => {
    expect(
      estMiroir({
        ...RECETTE_VIDE,
        retournement: { sens: "gauche-droite" },
        veille: ["retournement"],
      }),
    ).toBe(false)
  })
})
