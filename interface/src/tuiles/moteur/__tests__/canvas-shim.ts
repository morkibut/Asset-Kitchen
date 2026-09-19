// Bouchon minimal de canvas pour les essais du moteur de tuiles.
//
// `renderLogical` (vendor/tileset-engine.js) et `peintreCanvas` (tile-scene.js) font
// `canvas.getContext('2d').createImageData(...)` puis `.putImageData(...)` — rien de plus.
// Sous jsdom (l'environnement de l'interface), `document.createElement('canvas')` rend un
// vrai `HTMLCanvasElement`, mais `getContext('2d')` y renvoie `null` : jsdom n'implémente
// pas de vrai rendu 2D sans la dépendance native `canvas`. Les essais originaux de
// sc-clone (`node:test`, sans jsdom) posaient tout un `document` fabriqué à la main —
// impossible ici, jsdom pose déjà le sien. On patche donc seulement
// `HTMLCanvasElement.prototype.getContext('2d')`, en pur JS, sans dépendance npm
// supplémentaire (voir docs/PLAN-tuiles.md, TU1 : « n'ajoute une dépendance npm que si
// c'est indispensable, et dis-le » — ça ne l'est pas ici).
//
// `putImageData` pose l'image sur le canevas lui-même, sous `.imageData` — exactement la
// convention que les essais de sc-clone lisaient déjà (`renderLogical(s).imageData`).

interface ImageDataLike {
  width: number
  height: number
  data: Uint8ClampedArray
}

let installe = false

export function installerBouchonCanvas(): void {
  if (installe) return
  installe = true
  const original = HTMLCanvasElement.prototype.getContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement & { imageData?: ImageDataLike }, type: string, ...reste: unknown[]) {
    if (type !== '2d') return original.apply(this, [type, ...reste] as never)
    const canvas = this
    return {
      createImageData: (w: number, h: number): ImageDataLike => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img: ImageDataLike) => {
        canvas.imageData = img
      },
      // Rien d'autre du contexte 2D n'est appelé par le moteur ou par tile-scene.js —
      // un ajout ici doit rester justifié par un vrai appel, jamais par prudence.
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
