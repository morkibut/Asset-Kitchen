/**
 * Un PNG écrit à partir de pixels RGBA, **sans passer par un canevas**.
 *
 * Pourquoi pas `canvas.toDataURL()` : un canevas garde ses pixels en alpha
 * prémultiplié, et relire une case à demi transparente peut décaler sa couleur
 * d'un cran. L'atlas d'un jeu de tuiles doit sortir **au pixel près** tel que le
 * moteur l'a calculé (`docs/PLAN-tuiles.md`, décision 2) — et deux rendus de la
 * même recette doivent donner les mêmes octets, dans le navigateur comme dans
 * les essais. Les pixels viennent donc du moteur, et le fichier se compose ici.
 *
 * La compression passe par `CompressionStream("deflate")` quand il existe (tous
 * les navigateurs récents, Node 18+) ; sinon, des blocs « stockés » — plus gros,
 * aussi valides.
 */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(octets: Uint8Array, depart = 0xffffffff): number {
  let c = depart
  for (let i = 0; i < octets.length; i += 1) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8)
  return c
}

function adler32(octets: Uint8Array): number {
  let a = 1, b = 0
  for (let i = 0; i < octets.length; i += 1) {
    a = (a + octets[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function morceau(type: string, donnees: Uint8Array): Uint8Array {
  const sortie = new Uint8Array(12 + donnees.length)
  const vue = new DataView(sortie.buffer)
  vue.setUint32(0, donnees.length)
  for (let i = 0; i < 4; i += 1) sortie[4 + i] = type.charCodeAt(i)
  sortie.set(donnees, 8)
  vue.setUint32(8 + donnees.length, (crc32(sortie.subarray(4, 8 + donnees.length)) ^ 0xffffffff) >>> 0)
  return sortie
}

/** zlib sans compression : un en-tête, des blocs stockés de 65 535 octets, l'adler. */
function zlibStocke(brut: Uint8Array): Uint8Array {
  const blocs = Math.max(1, Math.ceil(brut.length / 65535))
  const sortie = new Uint8Array(2 + blocs * 5 + brut.length + 4)
  sortie[0] = 0x78
  sortie[1] = 0x01
  let o = 2
  for (let b = 0; b < blocs; b += 1) {
    const debut = b * 65535
    const n = Math.min(65535, brut.length - debut)
    sortie[o] = b === blocs - 1 ? 1 : 0
    sortie[o + 1] = n & 0xff
    sortie[o + 2] = n >>> 8
    sortie[o + 3] = ~n & 0xff
    sortie[o + 4] = (~n >>> 8) & 0xff
    sortie.set(brut.subarray(debut, debut + n), o + 5)
    o += 5 + n
  }
  new DataView(sortie.buffer).setUint32(o, adler32(brut))
  return sortie
}

async function zlib(brut: Uint8Array): Promise<Uint8Array> {
  const Flux = (globalThis as { CompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream
  if (!Flux || typeof Response === "undefined" || typeof Blob === "undefined") return zlibStocke(brut)
  try {
    const flux = new Blob([brut as BlobPart]).stream().pipeThrough(new Flux("deflate"))
    return new Uint8Array(await new Response(flux).arrayBuffer())
  } catch {
    return zlibStocke(brut)
  }
}

/** Les octets d'un PNG RGBA 8 bits, lignes non filtrées. */
export async function encoderPng(image: { width: number; height: number; data: Uint8ClampedArray | Uint8Array }): Promise<Uint8Array> {
  const { width: l, height: h, data } = image
  const brut = new Uint8Array((l * 4 + 1) * h)
  for (let y = 0; y < h; y += 1) {
    brut[y * (l * 4 + 1)] = 0
    brut.set(data.subarray(y * l * 4, (y + 1) * l * 4), y * (l * 4 + 1) + 1)
  }
  const tete = new Uint8Array(13)
  const vue = new DataView(tete.buffer)
  vue.setUint32(0, l)
  vue.setUint32(4, h)
  tete[8] = 8 // 8 bits par canal
  tete[9] = 6 // RGBA
  const parties = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    morceau("IHDR", tete),
    morceau("IDAT", await zlib(brut)),
    morceau("IEND", new Uint8Array(0)),
  ]
  const sortie = new Uint8Array(parties.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parties) { sortie.set(p, o); o += p.length }
  return sortie
}

export function enBase64(octets: Uint8Array): string {
  let texte = ""
  for (let i = 0; i < octets.length; i += 0x8000) texte += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  return btoa(texte)
}
