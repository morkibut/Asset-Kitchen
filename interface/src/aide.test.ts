// GU3 du guide (`docs/PLAN-guide.md`) — les garde-fous qui empêchent le
// corpus de redevenir pompeux.
//
// Cinq limites, toutes déjà écrites dans le plan : la longueur de `quoi`, la
// présence d'un `groupe`, la longueur d'un « à savoir », un résumé par écran
// du guide, un écran de guide par genre de lieu. Ce fichier ne les invente
// pas, il les fait tenir.
//
// **Ces essais sont rouges à l'écriture, et c'est voulu** (`docs/PLAN-guide.md`
// § `GU3`) : 229 fiches ne tiennent pas encore ces limites. Ils passent au
// vert écran par écran, de `GU4` à `GU15` — c'est la mesure d'avancement du
// chantier. Ne pas assouplir une limite ni exclure une fiche pour faire
// passer un essai ici : ce serait effacer la mesure, pas la tenir.
//
// **`test.each` partout, jamais un essai qui additionne.** Un seul essai qui
// comptait les 229 fiches d'un coup dirait « une fiche est trop longue » sans
// dire laquelle. Ici, chaque fiche (ou chaque écran, ou chaque genre) est un
// essai à son nom : le rapport de `npm run test` liste les clés fautives une
// par une, et un écran corrigé voit ses essais passer au vert sans toucher
// aux autres.
//
// Ne coûte rien : ce fichier ne lit que `aide.ts` et `lieux.ts`, n'appelle
// aucune route serveur et ne dépense rien.

import { describe, expect, test } from "vitest"

import { AIDE, RESUMES, type Explication } from "./aide"
import type { Genre } from "./lieux"

const LIMITE_QUOI = 140
const LIMITE_LONG = 400

const fiches = Object.entries(AIDE)

describe("GU3 — « quoi » tient en une phrase courte", () => {
  test.each(fiches)('"%s" : « quoi » ne dépasse pas 140 signes', (cle, entree) => {
    expect(
      entree.quoi.length,
      `"${cle}" : « quoi » fait ${entree.quoi.length} signes, la limite est ${LIMITE_QUOI} — texte actuel : "${entree.quoi}"`,
    ).toBeLessThanOrEqual(LIMITE_QUOI)
  })
})

describe("GU3 — chaque fiche a un groupe", () => {
  test.each(fiches)('"%s" : porte un `groupe`', (cle, entree) => {
    expect(
      entree.groupe,
      `"${cle}" n'a pas de \`groupe\` — la zone de l'écran où le réglage se trouve`,
    ).toBeTruthy()
  })
})

describe("GU3 — le « à savoir » tient en 400 signes", () => {
  // Seules les fiches qui portent un `long` sont concernées : ce champ est
  // facultatif, et une fiche sans « à savoir » ne peut pas le dépasser.
  const avecLong = fiches.filter((fiche): fiche is [string, Explication & { long: string }] => {
    return fiche[1].long !== undefined
  })

  test.each(avecLong)('"%s" : le « à savoir » ne dépasse pas 400 signes', (cle, entree) => {
    expect(
      entree.long.length,
      `"${cle}" : le « à savoir » fait ${entree.long.length} signes, la limite est ${LIMITE_LONG}`,
    ).toBeLessThanOrEqual(LIMITE_LONG)
  })
})

// ── Chaque écran du guide a son résumé ──────────────────────────────────────
//
// `Explication["ou"]` est un type fermé : la liste ci-dessous le recopie une
// fois, pour que chaque valeur devienne un essai à elle. Un membre ajouté au
// type sans être ajouté à `TOUS_LES_OU` casse `tsc -b`, pas seulement cet
// essai — c'est la vérification juste en dessous.
const TOUS_LES_OU = [
  "tableau-de-bord",
  "codex",
  "sujet",
  "galerie",
  "case",
  "clip",
  "bande",
  "montage",
  "tables",
  "depenses",
  "inspiration",
  "jeu",
  "ambiances",
  "reglages",
  "equipement",
  "sortie",
] as const satisfies readonly Explication["ou"][]

type ValeurDeOuManquante = Exclude<Explication["ou"], (typeof TOUS_LES_OU)[number]>
// Si cette ligne ne compile plus, une valeur a été ajoutée à `Explication["ou"]`
// sans être ajoutée à `TOUS_LES_OU` ci-dessus.
const _toutesLesValeursDeOuSontCouvertes: ValeurDeOuManquante extends never
  ? true
  : "il manque une valeur de `ou` dans TOUS_LES_OU, voir aide.test.ts" = true
void _toutesLesValeursDeOuSontCouvertes

describe("GU3 — chaque écran du guide a son résumé", () => {
  test.each(TOUS_LES_OU)('l\'écran "%s" a un résumé dans RESUMES', (ou) => {
    expect(RESUMES[ou], `l'écran "${ou}" n'a pas de résumé dans RESUMES`).toBeDefined()
  })
})

// ── Chaque genre de lieu a un écran de guide ────────────────────────────────
//
// La table vient du relevé de `GU1` (`docs/releves/guide-2026-09-20.md`) :
// pour chaque genre de `Lieu` (`interface/src/lieux.ts`), l'écran du guide
// qui le sert aujourd'hui — le sien, ou celui d'un genre parent quand c'est
// un choix documenté dans le code : `bibliotheque` → `codex`, `fabrications`
// → `clip`, `famille` → `codex` (la grille d'une famille se pose sur le
// codex), `piece`/`emploi`/
// `calques-animes` → `equipement`, `sujet`/`grille`/`comparer` → `sujet`,
// `retouche` → `tables`, `montage-de-bande` → `bande`. `univers` et `carte`
// héritent du côté par défaut de l'univers (`coteUnivers`, `App.tsx:829`,
// vaut `"inspiration"` au départ ; l'autre côté possible est `"ambiances"`,
// jamais `"jeu"` — § *Le grand constat* du relevé).
//
// **Deux lignes ont changé en `GU7`**, et c'est la correction de routage que
// le relevé réclamait :
//
// - `regles` sert `"jeu"`, plus `"reglages"`. Le lieu porte quatre onglets ;
//   le premier — *Univers*, celui sur lequel il s'ouvre — monte
//   `ReglesDuJeu` en mode reprise, l'écran qui affiche vraiment le titre
//   *Réglages*. Les trois autres servent toujours `"reglages"` : cette table
//   range un genre, pas un état d'écran, et elle note celui qu'on voit en
//   arrivant.
// - `installation` n'était testée nulle part dans `ecranDuGuide` : l'ouvrir
//   montrait le guide de la racine du dessous. Elle sert maintenant
//   `"reglages"`, qu'elle partage avec l'onglet *Moteurs & workflows* — les
//   deux écrans montent les mêmes blocs.
//
// Une chaîne vide dit que le genre n'a **aujourd'hui aucun écran de guide**,
// ni le sien ni hérité : c'est le cas de `travail`, `envoi`
// et des trois genres de tuiles (`tuiles`, `jeu-de-tuiles`,
// `livraison-de-tuiles`), et c'est exactement ce que cet essai doit refuser.
//
// `Record<Genre, string>` force la table à couvrir chaque membre de `Genre` :
// un genre ajouté à `lieux.ts` sans être ajouté ici casse `tsc -b`.
const GENRE_VERS_OU: Record<Genre, string> = {
  "tableau-de-bord": "tableau-de-bord",
  bibliotheque: "codex",
  fabrications: "clip",
  galerie: "galerie",
  univers: "inspiration",
  codex: "codex",
  depenses: "depenses",
  carte: "inspiration",
  famille: "codex",
  regles: "jeu",
  travail: "",
  installation: "reglages",
  sortie: "sortie",
  piece: "equipement",
  emploi: "equipement",
  "calques-animes": "equipement",
  sujet: "sujet",
  grille: "sujet",
  comparer: "sujet",
  retouche: "tables",
  tuiles: "",
  "jeu-de-tuiles": "",
  "livraison-de-tuiles": "",
  clip: "clip",
  montage: "montage",
  bande: "bande",
  "montage-de-bande": "bande",
  envoi: "",
}

describe("GU3 — chaque genre de lieu a un écran de guide", () => {
  test.each(Object.entries(GENRE_VERS_OU))(
    'le genre "%s" a un écran de guide (`ou`) déclaré, dédié ou hérité',
    (genre, ou) => {
      expect(ou, `le genre "${genre}" n'a aucun écran de guide, ni le sien ni hérité`).not.toBe("")
    },
  )
})
