// Le montage des essais d'écran — chargé avant chaque fichier de test.
// `toBeDisabled`, `toHaveTextContent` et les autres viennent d'ici.
import "@testing-library/jest-dom/vitest"

// jsdom ne possède pas la couche modale native. Les essais montent le contenu ;
// le focus, Échap et l’inertie de l’arrière-plan se vérifient au navigateur.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }
}

// ── Ce que jsdom n'a pas, et que le plan de la toile appelle ────────────────
//
// **Ce ne sont pas des doubles du produit, ce sont des trous du navigateur.**
// La différence compte : `tests/conftest.py` double le fournisseur et
// `App.test.tsx` double le flux parce que ce sont des dépendances *du produit*
// qu'un essai doit tenir. Ici, `ResizeObserver` et `DOMMatrixReadOnly` sont des
// APIs de navigateur que jsdom n'implémente pas — `@xyflow/react` les appelle au
// montage, et sans elles le plan lève avant d'avoir rendu un seul nœud.
//
// Ils ne rendent rien de faux : l'observateur n'observe pas, parce que jsdom ne
// met rien en page — c'est déjà la raison pour laquelle « zéro n'est pas une
// largeur » a fallu doubler `getBoundingClientRect`. Ce qui dépend d'une vraie
// mise en page se vérifie au navigateur, jamais ici, et les essais qui le
// touchent le disent.

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// **Un doublon posé en R8, retiré le même jour** : la fiche d'une chose suivait
// le défilement de ses cinq sections avec un `IntersectionObserver`, et il a
// fallu ce doublon pour que jsdom monte l'écran. Il n'y en a plus besoin — la
// fiche lit les positions **à la demande**, sur l'événement de défilement, parce
// qu'un guetteur ne livre rien à un onglet qui ne compose pas ses images. C'est
// le piège déjà payé du `ResizeObserver` juste au-dessus, retrouvé un cran plus
// loin ; `docs/PIEGES.md` le dit, et sa garde était déjà la bonne.

if (!("DOMMatrixReadOnly" in globalThis)) {
  globalThis.DOMMatrixReadOnly = class {
    m22 = 1
    constructor(transform?: string) {
      const echelle = transform?.match(/scale\(([\d.]+)\)/)
      if (echelle) this.m22 = Number.parseFloat(echelle[1])
    }
  } as unknown as typeof DOMMatrixReadOnly
}

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
