// Ce qui reste de l'écran de la sortie après `RV8` : les pièces réutilisées
// par l'écran unique (`Livraisons.tsx`) pour la forme « fichiers » — l'arbre
// de ce qui va être écrit, ses trois marques, ses quatre comptes, « pas prêt »
// et « la dernière sortie ». Elles ne sont plus assemblées en écran ici :
// c'est `Livraisons.test.tsx` qui les monte, dans leur vrai contexte.
//
// **Les listes ne sont pas écrites dans l'écran**, elles arrivent du serveur :
// les essais vérifient donc que ces pièces affichent *ce qu'on leur a donné*,
// jamais ce qu'elles auraient pu deviner.
//
// ⚠️ **jsdom ne met rien en page** : aucun de ces essais ne voit une largeur
// ni un débordement. Ça se vérifie au navigateur, sur `essais/atelier_jetable_*.py`.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { ArbreDeSortie, DerniereSortie, MOTS, PasPretDeSortie, parDossier, poids, quand } from "./Sortie"
import type { ApercuDeSortie, FichierDeSortie } from "../api"

function fichier(surplus: Partial<FichierDeSortie> & { chemin: string }): FichierDeSortie {
  return {
    octets: 2048,
    empreinte: "e1",
    marque: "nouveau",
    role: "corps",
    sujet: "le-pelerin",
    source: "asset-1",
    largeur: 66,
    hauteur: 66,
    images: 0,
    ...surplus,
  }
}

const APERCU: ApercuDeSortie = {
  dossier: "D:\\jeux\\marais\\assets",
  fichiers: [
    fichier({ chemin: "personnages/pelerin-repos-est.png", marque: "remplace" }),
    fichier({ chemin: "personnages/pelerin-marche-est.png", marque: "nouveau" }),
    fichier({ chemin: "personnages/pelerin-course-est.png", marque: "inchange" }),
    fichier({
      chemin: "descriptif.json",
      marque: "nouveau",
      role: "descriptif",
      largeur: 0,
      hauteur: 0,
    }),
  ],
  restes: [
    fichier({
      chemin: "personnages/pelerin-mort-est.png",
      marque: "reste",
      largeur: 0,
      hauteur: 0,
    }),
  ],
  pas_prets: [
    {
      genre: "sans_image",
      phrase: "ils seront sautés — aucune de leurs poses n'a d'image",
      compte: 2,
      sujets: [
        { identifiant: "le-passeur", nom: "le passeur", quoi: "aucune image" },
        { identifiant: "le-chaudron", nom: "le chaudron", quoi: "aucune image" },
      ],
    },
  ],
  precedente: null,
  reglage: {
    projet: "le-marais",
    lot: "tout",
    dossier: "D:\\jeux\\marais\\assets",
    rangement: "a_plat",
    collision: "remplacer",
    moteur: "aucun",
    sujet: "",
  },
  compte: 4,
  octets: 8192,
  comptes: { nouveau: 2, remplace: 1, inchange: 1, reste: 1 },
  refus: "",
}

afterEach(cleanup)

// ── L'arbre, ses marques et ses comptes ─────────────────────────────────────

describe("ArbreDeSortie", () => {
  test("chaque fichier porte sa marque", () => {
    render(<ArbreDeSortie apercu={APERCU} filtre="tout" onFiltre={() => {}} />)
    const arbre = screen.getByText("personnages/")

    const dans = (chemin: string) =>
      document.querySelector(`[data-fichier="${chemin}"]`) as HTMLElement

    expect(arbre).toBeTruthy()
    expect(within(dans("personnages/pelerin-repos-est.png")).getByText("remplace")).toBeTruthy()
    expect(within(dans("personnages/pelerin-marche-est.png")).getByText("nouveau")).toBeTruthy()
    expect(within(dans("personnages/pelerin-course-est.png")).getByText("inchangé")).toBeTruthy()
    expect(within(dans("personnages/pelerin-mort-est.png")).getByText("à effacer")).toBeTruthy()
  })

  test("un reste porte son chemin entier, jamais son seul nom", () => {
    render(<ArbreDeSortie apercu={{
      ...APERCU,
      fichiers: [fichier({ chemin: "pelerin-mort-est.png", marque: "nouveau" })],
      restes: [fichier({ chemin: "personnages/pelerin-mort-est.png", marque: "reste" })],
    }} filtre="tout" onFiltre={() => {}} />)

    expect(screen.getByText("personnages/pelerin-mort-est.png")).toBeTruthy()
    // Et le fichier prévu, lui, garde son nom court : il est sous sa racine.
    expect(screen.getByText("pelerin-mort-est.png")).toBeTruthy()
  })

  test("un fichier sans dimensions n'en affiche aucune", () => {
    render(<ArbreDeSortie apercu={APERCU} filtre="tout" onFiltre={() => {}} />)
    screen.getByText("personnages/")

    const ligne = document.querySelector('[data-fichier="descriptif.json"]')
    expect(ligne?.textContent).not.toContain("0×0")
    expect(ligne?.textContent).toContain("descriptif.json")
  })

  test("le filtre « ce qui a changé » retire les inchangés", () => {
    function Test() {
      const [f, setF] = useState<"change" | "tout">("tout")
      return <ArbreDeSortie apercu={APERCU} filtre={f} onFiltre={setF} />
    }
    render(<Test />)
    expect(document.querySelector('[data-fichier="personnages/pelerin-course-est.png"]')).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "ce qui a changé" }))

    expect(document.querySelector('[data-fichier="personnages/pelerin-course-est.png"]')).toBeNull()
    expect(document.querySelector('[data-fichier="personnages/pelerin-repos-est.png"]')).toBeTruthy()
  })

  test("les quatre comptes se lisent sous l'arbre", () => {
    render(<ArbreDeSortie apercu={APERCU} filtre="tout" onFiltre={() => {}} />)
    screen.getByText("personnages/")

    const comptes = within(document.querySelector("[data-comptes]") as HTMLElement)
    for (const [chiffre, mot] of [
      ["2", "nouveaux"],
      ["1", "remplacés"],
      ["1", "inchangés"],
      ["1", "à effacer"],
    ]) {
      expect(comptes.getByText(mot)).toBeTruthy()
      expect(comptes.getAllByText(chiffre).length).toBeGreaterThan(0)
    }
  })
})

// ── Ce qui n'est pas prêt ───────────────────────────────────────────────────

describe("PasPretDeSortie", () => {
  test("le panneau nomme les sujets et accorde son titre", () => {
    render(<PasPretDeSortie apercu={APERCU} />)

    expect(screen.getByText("2 sujets n'ont aucune image qui sort")).toBeTruthy()
    expect(screen.getByText("le passeur")).toBeTruthy()
    expect(screen.getByText("le chaudron")).toBeTruthy()
    expect(screen.getByText("ils seront sautés — aucune de leurs poses n'a d'image")).toBeTruthy()
  })

  test("quand tout est prêt, il le dit plutôt que de disparaître", () => {
    render(<PasPretDeSortie apercu={{ ...APERCU, pas_prets: [] }} />)

    expect(screen.getByText("Tout ce que ce lot contient a de quoi sortir.")).toBeTruthy()
  })
})

// ── La fois d'avant ─────────────────────────────────────────────────────────

describe("DerniereSortie", () => {
  test("jamais sortie, elle le dit", () => {
    render(<DerniereSortie apercu={APERCU} />)
    expect(screen.getByText("Ce jeu n'est jamais sorti. Tout sera nouveau.")).toBeTruthy()
  })

  test("déjà sortie, elle donne la date, le compte et le poids", () => {
    render(<DerniereSortie apercu={{
      ...APERCU,
      precedente: { le: 1_757_000_400, dossier: "D:\\jeux\\marais\\assets", compte: 726, chemins: [], octets: 14_260_000 },
    }} />)

    expect(screen.getByText("726 fichiers · 13,6 Mo")).toBeTruthy()
  })
})

// ── Le petit outillage, essayé seul ─────────────────────────────────────────

describe("poids", () => {
  test("il met la virgule, jamais le point", () => {
    expect(poids(14_260_000)).toBe("13,6 Mo")
    expect(poids(2048)).toBe("2 ko")
    expect(poids(12)).toBe("12 o")
  })
})

describe("parDossier", () => {
  test("il plie l'arbre, et la racine passe en dernier", () => {
    const groupes = parDossier([
      fichier({ chemin: "descriptif.json" }),
      fichier({ chemin: "personnages/un.png" }),
      fichier({ chemin: "animations/deux.png" }),
      fichier({ chemin: "personnages/trois.png" }),
    ])

    expect(groupes.map((g) => g.dossier)).toEqual(["animations", "personnages", ""])
    expect(groupes[1].fichiers).toHaveLength(2)
  })
})

describe("quand", () => {
  test("elle se lit en français", () => {
    expect(quand(1_757_000_400)).toContain("septembre")
    expect(quand(1_757_000_400)).toContain(" h ")
  })
})

describe("MOTS", () => {
  test("le catalogue « godot » n'est plus un mot de l'écran des fichiers", () => {
    // **RV8, §3.** La référence Godot est le paquet AU1 ; la forme « fichiers »
    // garde son mot pour Unity et Phaser, mais son propre catalogue Godot n'a
    // jamais été fidèle à `_sprite_frames` — il reste servi à l'API, jamais
    // proposé à l'écran (`ReglagesFichiersReplies` filtre « godot »).
    expect(MOTS.godot).toBe("Godot")
  })
})
