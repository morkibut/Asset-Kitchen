// Le repli général (RV23) : une vignette qui n'a jamais appelé `useVisee`
// doit quand même répondre à Espace. Trois essais, dans l'esprit du plan —
// des vignettes qui ne déclarent rien (dont le bloc *Ses références* d'un
// sujet, monté tel quel), un champ de saisie qui garde sa touche, une visée
// déclarée qui garde la priorité. Aucun essai ne coûte un centime : rien
// n'appelle `fetch` ici, le repli ne lit que le DOM.
//
// `document.elementsFromPoint` manque à jsdom (le repli s'en tait, voir
// `Apercu.tsx`) : chaque essai le fournit lui-même par un double.

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import type { ReactNode } from "react"

import { Apercu, fermerApercu, reinitialiserApercu, useApercu, useVisee, type Sujet } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"
import { SesReferencesParUsage } from "./ImagesDuSujet"
import {
  RECETTE_VIDE,
  type Asset,
  type Case,
  type CaseDirection,
  type Personnage,
  type ReferenceDeLaChose,
  type ReferencesDeLaChose,
} from "../api"

afterEach(() => {
  cleanup()
  reinitialiserApercu()
  vi.restoreAllMocks()
  delete (document as { elementsFromPoint?: unknown }).elementsFromPoint
})

/** Monte l'aperçu au-dessus de ses enfants — le même branchement qu'`App.tsx`
 *  (« L'aperçu est branché ici, et une seule fois »). */
function HoteDeLApercu({ children }: { children: ReactNode }) {
  const sujet = useApercu()
  return (
    <>
      {children}
      {sujet && <Apercu sujet={sujet} onFermer={fermerApercu} />}
    </>
  )
}

/** Pose le dernier point connu du pointeur, et fait répondre
 *  `document.elementsFromPoint` par la pile qu'on lui donne — jsdom ne
 *  l'implémente pas du tout (vérifié : `document.elementsFromPoint is not a
 *  function`), et le repli s'en tait déjà pour cette raison en production. */
function survoler(pile: Element[]) {
  // jsdom ne définit pas `elementsFromPoint` du tout (vérifié : la propriété
  // n'existe pas sur `document`) — `vi.spyOn` exige qu'elle existe déjà, donc
  // on la pose nous-mêmes plutôt que de l'espionner.
  ;(document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint =
    () => pile
  fireEvent.pointerMove(window, { clientX: 10, clientY: 10 })
}

/** La taille affichée d'un élément — jsdom ne mesure jamais rien tout seul. */
function tailleAffichee(element: Element, cote: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    width: cote,
    height: cote,
    top: 0,
    left: 0,
    right: cote,
    bottom: cote,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

function image(surplus: Partial<Asset> & { identifiant: string }): Asset {
  return {
    generation: "gen-1", rang: 0, largeur: 1024, hauteur: 1024, type_media: "image/png",
    label: `image ${surplus.identifiant}`, recette: RECETTE_VIDE, rendu_largeur: 64, rendu_hauteur: 64,
    cout_usd: 0.019, consomme: 0.019, unite: "usd", provenance: "auteur", modele: "gpt-image-2",
    personnage: "pelerin", pose: "repos", direction: "sud", piece: null, calque: null, lot: null,
    personnage_supprime: false, epingle: false, matiere: false, projet: "le-marais", collection: null,
    parent: null, parent_supprime: false, favori: false, supprime_le: null, traite: true, empreinte: "e1",
    cree_le: 1, ...surplus,
  }
}

const CASE_VIDE: Case = {
  pose: "repos", demandees: 1, images: [], bandes: [], bandes_ecartees: [], bandes_demandees: 1,
  calques: {}, retenus: {}, corps: null, origine: "type", directions: [], directions_rangees: [], sans_direction: [],
}

const DIRECTION_SUD: CaseDirection = {
  identifiant: "sud", nom: "sud", consigne: "", demandees: 1, a_confirmer: 0,
  images: [], bandes: [], bandes_ecartees: [],
}

function unSujet(cases: Case[]): Personnage {
  return {
    identifiant: "pelerin", projet: "le-marais", nom: "Le pèlerin", pieces: [], description: "",
    ecartees: [], concept_arts: [], references_ecartees: [], cree_le: 1, cases,
    plan: [{ identifiant: "repos", nom: "repos", images: 1, consigne: "", ecartees: [], images_avant: 0 }],
    type: "personnage", ambiance: "", prend: "tout", textes: {}, eteints: [], references: [], ajoutees: [],
    directions_ecartees: {}, hors_calibrage: [], famille: "personnages", equipable: true,
  }
}

function ligneReference(
  surplus: Partial<ReferenceDeLaChose> & { reference: string; usage: string },
): ReferenceDeLaChose {
  return {
    genre: "asset", provenance: "image promue", detail: "fabriquée puis retenue comme référence",
    ecartee: false, usage_nom: surplus.usage,
    montre: { sorte: "asset", asset: image({ identifiant: surplus.reference }) },
    ...surplus,
  }
}

describe("le repli général (RV23)", () => {
  test("une vignette qui ne déclare rien — dont « Ses références » — s'ouvre au repli, sur son adresse affichée", async () => {
    const references: ReferencesDeLaChose = {
      personnage: "pelerin",
      lignes: [ligneReference({ reference: "d", usage: "direction:sud" })],
      propositions: [],
      disponibles: 1,
    }
    render(
      <HoteDeLApercu>
        {/* Le bloc « Ses références », monté tel quel : aucune de ses
            vignettes n'appelle `useVisee` — le bug relevé par l'auteur. */}
        <SesReferencesParUsage
          personnage={unSujet([{ ...CASE_VIDE, pose: "repos", directions: [DIRECTION_SUD] }])}
          references={references}
          erreurs={{}}
          onChangerUsage={() => {}}
          onUtiliserPourDirection={() => {}}
        />
      </HoteDeLApercu>,
    )

    const vignette = document.querySelector('img[alt=""]') as HTMLImageElement
    expect(vignette).toBeTruthy()
    tailleAffichee(vignette, 34) // la taille réelle de `SelecteurDUsage` — au-dessus du plancher des icônes
    survoler([vignette])

    fireEvent.keyDown(window, { key: " " })

    await waitFor(() => expect(document.querySelector("[data-apercu-scene]")).toBeTruthy())
    const grande = document.querySelector("[data-apercu-scene] img") as HTMLImageElement
    expect(grande.src).toBe(vignette.src)
    expect(grande.src).toContain("/vignette?cote=68")
  })

  test("une icône minuscule sous le pointeur n'ouvre rien", async () => {
    render(<HoteDeLApercu><img alt="" src="/icone.png" /></HoteDeLApercu>)
    const icone = document.querySelector("img") as HTMLImageElement
    tailleAffichee(icone, 18) // sous le plancher (28)
    survoler([icone])

    fireEvent.keyDown(window, { key: " " })

    expect(document.querySelector("[data-apercu-scene]")).toBeNull()
  })

  test("Espace n'ouvre rien pendant qu'on écrit dans un champ", async () => {
    render(
      <HoteDeLApercu>
        <input aria-label="un champ" />
        <img alt="" src="/photo.png" />
      </HoteDeLApercu>,
    )
    const champ = document.querySelector("input") as HTMLInputElement
    const photo = document.querySelector("img") as HTMLImageElement
    tailleAffichee(photo, 96)
    survoler([photo])

    champ.focus()
    fireEvent.keyDown(champ, { key: "a" }) // écrire, avant Espace
    fireEvent.keyDown(champ, { key: " " })

    expect(document.querySelector("[data-apercu-scene]")).toBeNull()
  })

  test("une visée déclarée garde la priorité sur le repli", async () => {
    const declare: Sujet = {
      cle: "declare", src: "/declare.png", titre: "déclaré", largeur: 40, hauteur: 40, pixelise: false,
    }
    function Declaree() {
      const visee = useVisee(declare)
      // React fabrique `pointerenter`/`pointerleave` depuis `pointerover` /
      // `pointerout` — un `pointerenter` envoyé à la main n'atteint aucun
      // gestionnaire (même règle que `App.test.tsx`, section de l'aperçu).
      return <span data-declaree onPointerEnter={visee.entrer} onPointerLeave={visee.sortir} />
    }
    render(
      <HoteDeLApercu>
        <Declaree />
        <img alt="" src="/autre.png" />
      </HoteDeLApercu>,
    )
    const declaree = document.querySelector("[data-declaree]") as HTMLElement
    const autre = document.querySelector("img") as HTMLImageElement
    tailleAffichee(autre, 96)
    // Le pointeur vise l'image du repli, mais la surface déclarée a la main :
    // c'est elle qui doit s'ouvrir.
    fireEvent.pointerOver(declaree)
    survoler([autre])

    fireEvent.keyDown(window, { key: " " })

    await waitFor(() => expect(document.querySelector("[data-apercu-scene]")).toBeTruthy())
    const grande = document.querySelector("[data-apercu-scene] img") as HTMLImageElement
    expect(grande.src).toContain("/declare.png")
  })
})

// ── RV26 — l'agrandissement d'Espace passe devant les fenêtres ─────────────
//
// **La cause** : `CadreDialogue` ouvre ses fenêtres par `showModal()`, qui les
// pose dans la couche du dessus du navigateur — un `fixed z-50` de la page
// ordinaire ne passe jamais devant elle, quel que soit son `z-index`. jsdom ne
// simule pas la couche du dessus (`docs/PIEGES.md` ne le liste même pas, faute
// d'implémentation) : ce qu'un essai *peut* vérifier ici, c'est que l'aperçu
// est désormais **lui aussi** un `<dialog>` ouvert par `showModal()` — la
// mesure au navigateur, elle, est faite à part (voir le compte rendu).
describe("RV26 — l'agrandissement passe devant une fenêtre ouverte", () => {
  function FenetreAvecVignette({ onFermer }: { onFermer: () => void }) {
    return (
      <CadreDialogue titre="Une fenêtre" onFermer={onFermer} enfants={<img alt="" src="/vignette.png" />}>
      </CadreDialogue>
    )
  }

  test("ouvert depuis une fenêtre, l'aperçu est un <dialog> monté par showModal — il tombe sans le correctif", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal")
    const onFermerFenetre = vi.fn()
    render(
      <HoteDeLApercu>
        <FenetreAvecVignette onFermer={onFermerFenetre} />
      </HoteDeLApercu>,
    )
    const fenetre = document.querySelector('dialog[aria-label="Une fenêtre"]') as HTMLElement
    expect(fenetre).toBeTruthy()
    const vignette = document.querySelector("img") as HTMLImageElement
    tailleAffichee(vignette, 96)
    survoler([vignette])

    fireEvent.keyDown(window, { key: " " })

    await waitFor(() => expect(document.querySelector("[data-apercu-scene]")).toBeTruthy())
    // **Le cœur du correctif** : sans lui, l'aperçu reste un `<div>` — cette
    // ligne tombe si on le défait. Avec lui, c'est un second `<dialog>`,
    // ouvert par `showModal()` comme celui de la fenêtre : la même couche.
    const apercu = document.querySelector('dialog[aria-label="Aperçu"]')
    expect(apercu?.tagName).toBe("DIALOG")
    expect(showModal).toHaveBeenCalledWith()
    // Posé **après** la fenêtre dans le document : le dernier ouvert passe
    // devant, et les deux vivent hors de tout conteneur qui pourrait le
    // rogner (portés au corps du document, comme `CadreDialogue`).
    expect(apercu?.parentElement).toBe(document.body)
    expect(fenetre.parentElement).toBe(document.body)
    expect(
      fenetre.compareDocumentPosition(apercu!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  test("Échap ferme l'aperçu seul — la fenêtre en dessous reste ouverte, et son onFermer n'est jamais appelé", async () => {
    const onFermerFenetre = vi.fn()
    render(
      <HoteDeLApercu>
        <FenetreAvecVignette onFermer={onFermerFenetre} />
      </HoteDeLApercu>,
    )
    const vignette = document.querySelector("img") as HTMLImageElement
    tailleAffichee(vignette, 96)
    survoler([vignette])
    fireEvent.keyDown(window, { key: " " })
    await waitFor(() => expect(document.querySelector("[data-apercu-scene]")).toBeTruthy())

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() => expect(document.querySelector("[data-apercu-scene]")).toBeNull())
    // La fenêtre est intacte, et son propre geste d'Échap (l'événement natif
    // « cancel » de son `<dialog>`) n'a **pas** tourné en même temps — sans
    // quoi ce serait les deux surfaces qui se referment pour une pression.
    expect(document.querySelector('dialog[aria-label="Une fenêtre"]')).toBeTruthy()
    expect(onFermerFenetre).not.toHaveBeenCalled()
  })
})
