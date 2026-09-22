// La fiche d'un asset — le bouton « Poser sur la toile » (US-540, AU2).
//
// **Monté seul, sans `App`.** La preuve d'écran de la réutilisation complète —
// cliquer, poser, retrouver la carte en réserve — appartient à `App.test.tsx`,
// où la galerie entière tourne avec son serveur doublé. Elle ne peut
// malheureusement pas s'y écrire aujourd'hui : la sélection de la galerie
// (`useGalerie`, `Galerie.tsx`) ne survit pas au clic qui ouvre une fiche dans
// l'arbre actuel — un défaut préexistant, présent avant cette tranche et sur
// le dernier commit, qui empêche toute fiche de s'ouvrir depuis la galerie
// dans les essais (`« découper part de la fiche »` et une vingtaine d'autres
// essais déjà en échec pour la même raison). Ce fichier isole donc la preuve
// qui reste possible sans dépendre de ce défaut : le bouton lui-même, sa
// présence conditionnée par la porte qu'`App` lui donne, et le geste qu'il
// déclenche.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api, Refus, UNIVERS_VIDE, type Asset, type Generation, type Recette } from "../api"
import { matieres } from "../api-tuiles"
import { Fiche } from "./Fiche"

const RECETTE_VIDE: Recette = {
  passes: [],
  difference: null,
  recadrage: null,
  grille: null,
  quantification: null,
  bords: null,
  contours: null,
  retournement: null,
  main: null,
  veille: [],
  nom: null,
}

const UN_ASSET: Asset = {
  identifiant: "aaaa1111-0",
  generation: "aaaa1111",
  rang: 0,
  largeur: 1024,
  hauteur: 1024,
  type_media: "image/png",
  label: "un tonneau",
  recette: RECETTE_VIDE,
  rendu_largeur: 0,
  rendu_hauteur: 0,
  cree_le: 1_787_800_100,
  cout_usd: 0.0245,
  consomme: 0.0245,
  unite: "usd",
  provenance: "auteur",
  modele: "google/gemini-2.5-flash-image",
  personnage: null,
  pose: null,
  direction: null,
  piece: null,
  calque: null,
  lot: null,
  personnage_supprime: false,
  epingle: false,
  matiere: false,
  projet: "bac-a-sable",
  collection: null,
  parent: null,
  parent_supprime: false,
  favori: false,
  supprime_le: null,
  traite: false,
  empreinte: "abc123",
}

function monterLaFiche(onPoserSurLaToile?: () => void) {
  return render(
    <Fiche
      asset={UN_ASSET}
      univers={UNIVERS_VIDE}
      plan={[]}
      personnages={[]}
      onFermer={() => {}}
      onErreur={() => {}}
      onReinjecter={() => {}}
      onReglages={() => {}}
      onSupprimer={() => {}}
      onRetoucher={() => {}}
      onPoserSurLaToile={onPoserSurLaToile}
      onOuvrir={() => {}}
    />,
  )
}

describe("la fiche — « Poser sur la toile » (US-540)", () => {
  beforeEach(() => {
    // Les deux effets de la fiche (l'imposé du projet, la génération d'origine)
    // appellent le serveur ; ce test ne regarde ni l'un ni l'autre, et un
    // réseau qui échoue est déjà le chemin que la fiche sait montrer — elle met
    // `impose` et `generation` à `null` et continue. Le doubler en échec évite
    // simplement un vrai appel réseau pendant l'essai.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test("le bouton pose l'asset sur la toile, sans passer par un générateur", () => {
    // Critère AU2 : « La galerie [...] permet l'ouverture et la réutilisation
    // sur la toile sans nouvelle fabrication (US-540). » Ici : le bouton
    // n'appelle que le geste qu'on lui donne — jamais une route de génération.
    const onPoserSurLaToile = vi.fn()
    monterLaFiche(onPoserSurLaToile)

    const bouton = screen.getByRole("button", { name: "Poser sur la toile" })
    fireEvent.click(bouton)

    expect(onPoserSurLaToile).toHaveBeenCalledTimes(1)
  })

  test("absent quand la fiche n'a pas de toile à côté d'elle", () => {
    // Même règle que les deux portes voisines (« Reprendre dans l'établi »,
    // « La retoucher ») : un rappel facultatif absent n'affiche rien, plutôt
    // qu'un bouton grisé sans explication.
    monterLaFiche(undefined)
    expect(screen.queryByRole("button", { name: "Poser sur la toile" })).toBeNull()
  })
})

describe("la fiche — la graine d'une image locale (défaut 6 de la relecture du 18/09/2026)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("la graine de son emplacement se lit sur la fiche, quand le serveur la rend", async () => {
    // `GET /api/generations/{id}` rend déjà `emplacements[].graine` — c'est
    // `api.ts` qui ne le déclare pas encore (occupé). Lue par l'extension de
    // type `EmplacementAvecGraine`, comme les autres champs de style local.
    const generation = {
      identifiant: "aaaa1111",
      modele: "ComfyUI:zimage-pixel@v1",
      demande: { prompt: "un tonneau", prompt_negatif: "", proportions: "1:1", resolution: null, variations: 1, references: 0, options: {} },
      parametres_resolus: {},
      ecartees: [],
      emplacements: [
        { rang: 0, statut: "reussie", consomme: 0, unite: "jeton", cout_usd: 0, duree_s: 24, resultat: null, raison: null, demarre_le: null, duree_attendue_s: 24, graine: 918273645 },
      ],
      cree_le: 1_787_800_100,
      projet: "bac-a-sable",
      references: [],
      hors_plafond: [],
      parent: null,
      statut: "reussie",
      cout_usd: 0,
      consomme: 0,
      unite: "jeton",
      reussies: 1,
    } as unknown as Generation
    vi.spyOn(api, "generation").mockResolvedValue(generation)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))

    monterLaFiche()

    expect(await screen.findByText("graine 918273645")).toBeInTheDocument()
  })

  test("rien ne paraît quand le serveur ne rend pas de graine — un modèle distant, par exemple", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))))
    monterLaFiche()
    // Laisse l'effet qui lit la génération se résoudre (en échec, ici).
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(/^graine /)).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})

describe("la fiche — ranger l'image dans les matières du jeu (RG6)", () => {
  const PHRASE = "Cette image est rangée dans un sujet : sors-la de son sujet d'abord."
  const RANGER = { name: "Ranger dans les matières" }
  const RETIRER = { name: "Retirer des matières" }

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const fiche = (asset: Asset, onErreur: (r: string) => void = () => {}) => (
    <Fiche
      asset={asset}
      univers={UNIVERS_VIDE}
      plan={[]}
      personnages={[]}
      onFermer={() => {}}
      onErreur={onErreur}
      onReinjecter={() => {}}
      onReglages={() => {}}
      onSupprimer={() => {}}
      onRetoucher={() => {}}
      onOuvrir={() => {}}
    />
  )
  const reponse = { identifiant: "aaaa1111-0", nom: "un tonneau", largeur: 8, hauteur: 8, apercu: "", cadrage: "", cree_le: 1, collections: [], detouree: false, refaisable: false }

  test("une image ordinaire du jeu se range en un geste, et le geste inverse prend la place du libellé", async () => {
    const declarer = vi.spyOn(matieres, "declarer").mockResolvedValue(reponse)
    render(fiche(UN_ASSET))
    expect(screen.queryByRole("button", RETIRER)).toBeNull()

    fireEvent.click(screen.getByRole("button", RANGER))
    // Le PUT part avec le projet de l'image, son identifiant, et la valeur voulue.
    await waitFor(() => expect(declarer).toHaveBeenCalledWith("bac-a-sable", "aaaa1111-0", true))
    expect(await screen.findByRole("button", RETIRER)).toBeInTheDocument()
    expect(screen.queryByRole("button", RANGER)).toBeNull()

    fireEvent.click(screen.getByRole("button", RETIRER))
    await waitFor(() => expect(declarer).toHaveBeenLastCalledWith("bac-a-sable", "aaaa1111-0", false))
    expect(await screen.findByRole("button", RANGER)).toBeInTheDocument()
    expect(declarer).toHaveBeenCalledTimes(2)
  })

  test("le libellé suit l'image quand le flux la change ailleurs", () => {
    const vue = render(fiche(UN_ASSET))
    expect(screen.getByRole("button", RANGER)).toBeInTheDocument()
    vue.rerender(fiche({ ...UN_ASSET, matiere: true }))
    expect(screen.getByRole("button", RETIRER)).toBeInTheDocument()
    vue.rerender(fiche({ ...UN_ASSET, matiere: false }))
    expect(screen.getByRole("button", RANGER)).toBeInTheDocument()
  })

  test("une image rangée dans un sujet ne propose pas le geste : elle dit pourquoi, et rien ne part", () => {
    const declarer = vi.spyOn(matieres, "declarer")
    render(fiche({ ...UN_ASSET, personnage: "pelerin" }))
    expect(screen.getByText(PHRASE)).toBeInTheDocument()
    const bouton = screen.getByRole("button", RANGER)
    expect(bouton).toBeDisabled()
    fireEvent.click(bouton)
    expect(declarer).not.toHaveBeenCalled()
  })

  test("une image déjà marquée peut toujours retirer sa marque, même si elle porte un sujet", async () => {
    // Née avant RG5, ou marquée par un ancien chemin : la sortie reste ouverte.
    const declarer = vi.spyOn(matieres, "declarer").mockResolvedValue(reponse)
    render(fiche({ ...UN_ASSET, personnage: "pelerin", matiere: true }))
    expect(screen.queryByText(PHRASE)).toBeNull()
    fireEvent.click(screen.getByRole("button", RETIRER))
    await waitFor(() => expect(declarer).toHaveBeenCalledWith("bac-a-sable", "aaaa1111-0", false))
  })

  test("une image hors projet n'a ni le geste ni la phrase", () => {
    render(fiche({ ...UN_ASSET, projet: null }))
    expect(screen.queryByRole("button", RANGER)).toBeNull()
    expect(screen.queryByRole("button", RETIRER)).toBeNull()
    expect(screen.queryByText(PHRASE)).toBeNull()
  })

  test("un refus du serveur se lit avec sa phrase, et le libellé ne change pas", async () => {
    const refus = "Cette image est rangée dans un sujet : sors-la de son sujet d'abord, ou génère la matière depuis l'écran des tuiles."
    vi.spyOn(matieres, "declarer").mockRejectedValue(new Refus(refus, "rangement_refuse"))
    const onErreur = vi.fn()
    render(fiche(UN_ASSET, onErreur))
    fireEvent.click(screen.getByRole("button", RANGER))
    await waitFor(() => expect(onErreur).toHaveBeenCalledWith(refus))
    expect(screen.getByRole("button", RANGER)).toBeInTheDocument()
    expect(screen.getByRole("button", RANGER)).toBeEnabled()
  })
})

describe("la fiche — une matière née détourée (RG8)", () => {
  const TITRE = "Détourée comme un personnage"
  const REFAIRE = { name: "La refaire comme une matière" }
  const UNE_MATIERE: Asset = { ...UN_ASSET, matiere: true }
  const ligne = (detouree: boolean, refaisable: boolean) => ({
    identifiant: "aaaa1111-0", nom: "un tonneau", largeur: 8, hauteur: 8, apercu: "", cadrage: "surface", cree_le: 1, collections: [], detouree, refaisable,
  })

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("essai : aucun serveur"))))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const fiche = (asset: Asset, onErreur: (r: string) => void = () => {}) => (
    <Fiche
      asset={asset}
      univers={UNIVERS_VIDE}
      plan={[]}
      personnages={[]}
      onFermer={() => {}}
      onErreur={onErreur}
      onReinjecter={() => {}}
      onReglages={() => {}}
      onSupprimer={() => {}}
      onRetoucher={() => {}}
      onOuvrir={() => {}}
    />
  )

  test("détourée avec son image d'origine : elle le dit, dit ce que ça change, et propose un seul bouton", async () => {
    const lire = vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    render(fiche(UNE_MATIERE))

    expect(await screen.findByText(TITRE)).toBeInTheDocument()
    expect(lire).toHaveBeenCalledWith("bac-a-sable", "aaaa1111-0")
    expect(screen.getByText(/celle-ci a été découpée et recadrée/)).toBeInTheDocument()
    // Ce que ça change, dit avant le clic : rien à regénérer ni à payer, l'image actuelle est remplacée.
    expect(screen.getByText(/sans rien regénérer, et sans rien payer/)).toBeInTheDocument()
    expect(screen.getByText(/L'image actuelle est remplacée/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", REFAIRE)).toHaveLength(1)
    expect(screen.queryByText(/il faut la regénérer/)).toBeNull()
  })

  test("le bouton ne part jamais tout seul : ni au montage, ni à la relecture", async () => {
    const lire = vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    const refaire = vi.spyOn(matieres, "refaire").mockResolvedValue(ligne(false, false))
    const vue = render(fiche(UNE_MATIERE))
    await screen.findByRole("button", REFAIRE)
    // La recette de l'image change (une retouche, le flux) : l'état est relu, rien n'est refait.
    vue.rerender(fiche({ ...UNE_MATIERE, empreinte: "autre" }))
    await waitFor(() => expect(lire).toHaveBeenCalledTimes(2))
    expect(refaire).not.toHaveBeenCalled()
  })

  test("le clic appelle le bon geste, avec le jeu et l'image, puis la fiche se tait", async () => {
    vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    const refaire = vi.spyOn(matieres, "refaire").mockResolvedValue(ligne(false, false))
    render(fiche(UNE_MATIERE))

    fireEvent.click(await screen.findByRole("button", REFAIRE))

    await waitFor(() => expect(refaire).toHaveBeenCalledTimes(1))
    expect(refaire).toHaveBeenCalledWith("bac-a-sable", "aaaa1111-0")
    await waitFor(() => expect(screen.queryByText(TITRE)).toBeNull())
    expect(screen.queryByRole("button", REFAIRE)).toBeNull()
  })

  test("le bouton se grise pendant le geste : un double clic n'envoie qu'un appel", async () => {
    vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    let finir: (m: ReturnType<typeof ligne>) => void = () => {}
    const refaire = vi.spyOn(matieres, "refaire").mockImplementation(() => new Promise((r) => { finir = r }))
    render(fiche(UNE_MATIERE))

    const bouton = await screen.findByRole("button", REFAIRE)
    fireEvent.click(bouton)
    await waitFor(() => expect(bouton).toBeDisabled())
    fireEvent.click(bouton)
    expect(refaire).toHaveBeenCalledTimes(1)
    finir(ligne(false, false))
    await waitFor(() => expect(screen.queryByText(TITRE)).toBeNull())
  })

  test("un refus du serveur se lit avec sa phrase, et la proposition reste", async () => {
    const refus = "l'image d'origine n'est plus sur le disque : la seule façon de refaire cette matière est de la regénérer"
    vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    vi.spyOn(matieres, "refaire").mockRejectedValue(new Refus(refus, "recette_refusee"))
    const onErreur = vi.fn()
    render(fiche(UNE_MATIERE, onErreur))

    fireEvent.click(await screen.findByRole("button", REFAIRE))

    await waitFor(() => expect(onErreur).toHaveBeenCalledWith(refus))
    expect(screen.getByRole("button", REFAIRE)).toBeEnabled()
  })

  test("détourée sans son image d'origine : la phrase dit qu'il faut la regénérer, sans bouton", async () => {
    vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, false))
    const refaire = vi.spyOn(matieres, "refaire")
    render(fiche(UNE_MATIERE))

    expect(await screen.findByText(TITRE)).toBeInTheDocument()
    expect(screen.getByText(/Son image d'origine n'est plus sur le disque : il faut la regénérer/)).toBeInTheDocument()
    expect(screen.queryByRole("button", REFAIRE)).toBeNull()
    expect(screen.queryByText(/sans rien regénérer/)).toBeNull()
    expect(refaire).not.toHaveBeenCalled()
  })

  test("une matière saine n'a ni phrase ni bouton", async () => {
    const lire = vi.spyOn(matieres, "lire").mockResolvedValue(ligne(false, false))
    render(fiche(UNE_MATIERE))
    await waitFor(() => expect(lire).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITRE)).toBeNull()
    expect(screen.queryByRole("button", REFAIRE)).toBeNull()
  })

  test("une image qui n'est pas une matière, ou hors jeu, n'interroge même pas le serveur", async () => {
    const lire = vi.spyOn(matieres, "lire").mockResolvedValue(ligne(true, true))
    const vue = render(fiche(UN_ASSET))
    vue.rerender(fiche({ ...UNE_MATIERE, projet: null }))
    await new Promise((r) => setTimeout(r, 0))
    expect(lire).not.toHaveBeenCalled()
    expect(screen.queryByText(TITRE)).toBeNull()
  })

  test("un serveur qui ne répond pas ne fait rien dire à la fiche : mieux vaut se taire", async () => {
    vi.spyOn(matieres, "lire").mockRejectedValue(new Error("l'atelier ne répond pas"))
    render(fiche(UNE_MATIERE))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITRE)).toBeNull()
    expect(screen.queryByRole("button", REFAIRE)).toBeNull()
  })

  test("en changeant de fiche, l'état de la précédente ne reste pas affiché", async () => {
    const lire = vi.spyOn(matieres, "lire").mockImplementation(async (_p, id) => ligne(id === "aaaa1111-0", true))
    const vue = render(fiche(UNE_MATIERE))
    await screen.findByText(TITRE)
    vue.rerender(fiche({ ...UNE_MATIERE, identifiant: "bbbb2222-0" }))
    await waitFor(() => expect(lire).toHaveBeenCalledWith("bac-a-sable", "bbbb2222-0"))
    await waitFor(() => expect(screen.queryByText(TITRE)).toBeNull())
  })
})

// ── « C'est la référence » (TS3) ────────────────────────────────────────────
//
// Montré seulement sur une planche faite en première planche —
// `generation.demande.premiere_planche` — puisque c'est le seul signe que la
// fiche sait lire sans redemander les usages du sujet.
describe("la fiche — « C'est la référence » (TS3)", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const GENERATION_PLANCHE = {
    identifiant: "aaaa1111",
    modele: "google/gemini-2.5-flash-image",
    demande: {
      prompt: "le pèlerin",
      prompt_negatif: "",
      proportions: "1:1",
      resolution: null,
      variations: 1,
      references: 1,
      options: {},
      premiere_planche: true,
    },
    parametres_resolus: {},
    ecartees: [],
    emplacements: [],
    cree_le: 1_787_800_100,
    projet: "bac-a-sable",
    references: [],
    hors_plafond: [],
    parent: null,
    statut: "reussie",
    cout_usd: 0,
    consomme: 0,
    unite: "usd",
    reussies: 1,
  } as unknown as Generation

  function monter(surplus: Partial<Parameters<typeof Fiche>[0]> = {}) {
    return render(
      <Fiche
        asset={UN_ASSET}
        univers={UNIVERS_VIDE}
        plan={[]}
        personnages={[]}
        onFermer={() => {}}
        onErreur={() => {}}
        onReinjecter={() => {}}
        onReglages={() => {}}
        onSupprimer={() => {}}
        onRetoucher={() => {}}
        onOuvrir={() => {}}
        {...surplus}
      />,
    )
  }

  test("absent sur une image ordinaire — sa génération n'est pas une première planche", async () => {
    vi.spyOn(api, "generation").mockResolvedValue({
      ...GENERATION_PLANCHE,
      demande: { ...GENERATION_PLANCHE.demande, premiere_planche: undefined },
    } as unknown as Generation)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    const onChoisirLaPlanche = vi.fn()
    monter({ onChoisirLaPlanche })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole("button", { name: "C'est la référence" })).toBeNull()
  })

  test("paraît sur une planche faite en première planche, et appelle le geste au clic", async () => {
    vi.spyOn(api, "generation").mockResolvedValue(GENERATION_PLANCHE)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    const onChoisirLaPlanche = vi.fn()
    monter({ onChoisirLaPlanche })

    const bouton = await screen.findByRole("button", { name: "C'est la référence" })
    fireEvent.click(bouton)
    expect(onChoisirLaPlanche).toHaveBeenCalledTimes(1)
  })

  test("celle qui est déjà la planche se grise avec sa raison", async () => {
    vi.spyOn(api, "generation").mockResolvedValue(GENERATION_PLANCHE)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    monter({ onChoisirLaPlanche: () => {}, estLaPlanche: true })

    expect(await screen.findByText("c'est déjà la planche de ce sujet")).toBeInTheDocument()
  })

  test("un refus du serveur s'affiche en clair, à côté du bouton", async () => {
    vi.spyOn(api, "generation").mockResolvedValue(GENERATION_PLANCHE)
    vi.spyOn(api, "imposeSurAsset").mockRejectedValue(new Error("essai : aucun serveur"))
    monter({
      onChoisirLaPlanche: () => {},
      erreurPlanche: "image d'un autre sujet",
    })

    expect(await screen.findByText("image d'un autre sujet")).toBeInTheDocument()
  })
})
