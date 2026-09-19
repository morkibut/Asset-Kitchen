// TU1 — critère d'acceptation : « Un essai vitest calcule l'empreinte (SHA-256, après
// normalisation des fins de ligne et des lignes d'import) de chaque module et la compare
// à une liste figée relevée sur sc-clone f27f054 → toute modification de logique fait
// échouer. »
//
// La normalisation gomme exactement ce que le portage a le droit de changer : les fins de
// ligne (CRLF → LF, au cas où un éditeur Windows les réécrit) et le CHEMIN d'une ligne
// `import … from "…"` — jamais les noms importés, jamais le reste de la ligne. Toute autre
// différence, une seule ligne de logique changée y compris, fait bouger l'empreinte.
//
// Les empreintes ci-dessous ont été relevées sur ces mêmes fichiers, copiés le 19 septembre
// 2026 depuis `C:\STOCKAGE\PROJET\_DEV\sc-clone`, commit `f27f054` — voir LISEZMOI.md.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vitest'

const ICI = dirname(fileURLToPath(import.meta.url))
const MOTEUR = join(ICI, '..')

function normaliser(source: string): string {
  const lf = source.replace(/\r\n/g, '\n')
  const lignes = lf.split('\n').map((ligne) => {
    const nommee = ligne.match(/^(\s*import\s*\{[^}]*\}\s*from\s*)(["'])[^"']*\2(;?\s*)$/)
    if (nommee) return `${nommee[1]}"<chemin>"${nommee[3]}`
    const defaut = ligne.match(/^(\s*import\s+[A-Za-z0-9_$]+\s*from\s*)(["'])[^"']*\2(;?\s*)$/)
    if (defaut) return `${defaut[1]}"<chemin>"${defaut[3]}`
    return ligne
  })
  return lignes.join('\n')
}

function empreinte(cheminRelatif: string): string {
  const source = readFileSync(join(MOTEUR, cheminRelatif), 'utf8')
  return createHash('sha256').update(normaliser(source), 'utf8').digest('hex')
}

// Relevé sur sc-clone f27f054, le 19 septembre 2026 — voir le script de portage dans le
// compte rendu de TU1. Une entrée qui bouge après un simple déplacement de chemin
// d'import est un signe que la normalisation ci-dessus doit être étendue, pas que le
// module a changé de logique — vérifier `git diff` contre sc-clone avant de mettre à jour.
const EMPREINTES_F27F054: Record<string, string> = {
  'pixel-core.js': 'f80172a80f0d12545bc0d22609e17719bd4bc9d1372df2f1eb1577092dd0b0ae'.slice(0, 64),
  'tile-check.js': '1d71d15f1a3a0033048cc5399126c09cda7bfb72965897c799d6ffe94cb64975'.slice(0, 64),
  'tile-emplacements.js': 'a66b78030450a74eca73dcd463002253139792d42810a34756adc8373d962cd6'.slice(0, 64),
  'tile-ia-prompt.js': '7a3b41e907af62b84569ddf33860f88ed4d542e4996905992c290a65cc3e8fc5'.slice(0, 64),
  'tile-masks.js': 'a89755ca96c11cf584cfa81c342ecb5df0236c2495917de875a5c17cf892b294'.slice(0, 64),
  'tile-materials.js': 'ebbf6d540063fea17f0c4388ca8165a1066ac008e9af033d67dd280a08b753ae'.slice(0, 64),
  'tile-mesures.js': '43ce24026f3e0dfbbbfc566fd69bacc577c4da039b0c7e518f719eaa5eec82c9'.slice(0, 64),
  'tile-palette-lab.js': 'bb0c0ad4fb72827d898fdd5f00abf89d42323272ba4d4d9f772a7ca3418c8126'.slice(0, 64),
  'tile-palette.js': 'e434c5efe3b56f330c014f7f7d82e373e97aee86393e55b6cfbe01c63782be7f'.slice(0, 64),
  'tile-scene.js': '28de8f6787a3a6e3b8a1e582d064a42be80f8c88f3c29da4a68f58f71c4a4822'.slice(0, 64),
  'vendor/tileset-engine.js': 'dbd297aa9e6dca7c42fa734936183fc3f15d2154a20330366bb31fdfaa0a73b1'.slice(0, 64),
}


describe('empreinte de provenance — sc-clone f27f054', () => {
  for (const [fichier, attendue] of Object.entries(EMPREINTES_F27F054)) {
    test(`${fichier} n'a pas changé de logique depuis sc-clone`, () => {
      expect(empreinte(fichier)).toBe(attendue)
    })
  }
})
