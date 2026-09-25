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
  "tuiles",
  "jeu-de-tuiles",
  "livraison-de-tuiles",
  "son",
  "un-son",
  // `GU15` (1/2) — les quatre écrans que les genres orphelins réclamaient :
  // la racine `fabrications`, *Relire avant l'envoi*, *Sur la grille du jeu*
  // et *Deux côte à côte*. Leurs quatre essais ci-dessous ont été rouges
  // entre les deux moitiés de `GU15`, comme ceux des tuiles entre celles de
  // `GU13` : `GU15` (2/2) a écrit les résumés, et ils sont verts.
  "fabrications",
  "envoi",
  "grille",
  "comparer",
] as const satisfies readonly Explication["ou"][]

// `"partout"` (CM8) n'est l'écran de rien — aucun écran ne le calcule pour
// `ecranDuGuide` — donc il n'entre jamais dans `scope` et n'a pas de résumé à
// lui : l'exclure ici, explicitement, plutôt que de l'ajouter à `TOUS_LES_OU`
// avec un résumé qui ne se montrerait jamais.
type ValeurDeOuManquante = Exclude<Explication["ou"], (typeof TOUS_LES_OU)[number] | "partout">
// Si cette ligne ne compile plus, une valeur a été ajoutée à `Explication["ou"]`
// sans être ajoutée à `TOUS_LES_OU` ci-dessus (ou exclue explicitement, comme
// `"partout"` ci-dessus).
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
// un choix documenté dans le code : `bibliotheque` et `famille` → `codex`,
// `piece`/`emploi`/`calques-animes` → `equipement`, `retouche` → `tables`.
// `univers` et `carte` héritent du côté par défaut de l'univers
// (`coteUnivers`, `App.tsx`, vaut `"inspiration"` au départ ; l'autre côté
// possible est `"ambiances"`, jamais `"jeu"` — § *Le grand constat* du relevé).
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
// **Les trois genres de tuiles ont le leur depuis `GU13`** (1/2), et ils
// portent leur propre nom : `tuiles` → `"tuiles"`, `jeu-de-tuiles` →
// `"jeu-de-tuiles"`, `livraison-de-tuiles` → `"livraison-de-tuiles"`. Ce n'est
// plus un héritage mais trois valeurs neuves d'`Explication["ou"]`, testées au
// même rang que la sortie dans `ecranDuGuide` (`App.tsx`) — c'est la décision
// d'architecture n°5 du plan appliquée : la liste des `ou` suit les genres.
//
// **`GU15` (1/2) a tranché les douze derniers, genre par genre**, et la table
// ne porte plus une seule chaîne vide. Quatre genres ont reçu un écran à eux —
// `fabrications`, `envoi`, `grille`, `comparer` —, parce qu'ils montrent un
// contenu, des réglages et des gestes qu'aucun autre écran ne porte. Sept
// gardent un héritage, mais **décidé et écrit** : la branche d'`ecranDuGuide`
// nomme le genre, et un commentaire dit pourquoi c'est un état.
//
// - `bibliotheque` et `famille` → `codex` : les trois montent le même
//   composant, `EcranFamille` (`Famille.tsx`), dont le `<h1>` est *Les sujets*.
// - `travail` → `fabrications` : le lieu monte `FenetreDuTravail`, la fenêtre
//   que `Fabrications.tsx` rend déjà en place ; six des neuf fiches de cet
//   écran la décrivent.
// - `emploi` et `calques-animes` → `equipement` : les deux fiches de cet écran
//   viennent de `CalquesDeLEmploi.tsx`, la page d'un emploi.
// - `carte` → `inspiration` : découper une carte prend la place du tableau sans
//   quitter ce côté-là de l'univers.
// - `montage-de-bande` → `montage` **et non plus `bande`** : il monte
//   `EcranMontage` en mode reprise, pas l'atelier d'une bande. C'est la
//   quatrième réparation de routage du chantier, après `GU7`, `GU12` et `GU13`.
//
// Une chaîne vide dirait que le genre n'a **aucun écran de guide**, ni le sien
// ni hérité — et c'est exactement ce que cet essai refuse.
//
// `Record<Genre, string>` force la table à couvrir chaque membre de `Genre` :
// un genre ajouté à `lieux.ts` sans être ajouté ici casse `tsc -b`.
const GENRE_VERS_OU: Record<Genre, string> = {
  "tableau-de-bord": "tableau-de-bord",
  bibliotheque: "codex",
  fabrications: "fabrications",
  galerie: "galerie",
  univers: "inspiration",
  codex: "codex",
  depenses: "depenses",
  carte: "inspiration",
  famille: "codex",
  regles: "jeu",
  travail: "fabrications",
  installation: "reglages",
  sortie: "sortie",
  piece: "equipement",
  emploi: "equipement",
  "calques-animes": "equipement",
  sujet: "sujet",
  grille: "grille",
  comparer: "comparer",
  retouche: "tables",
  tuiles: "tuiles",
  "jeu-de-tuiles": "jeu-de-tuiles",
  "livraison-de-tuiles": "livraison-de-tuiles",
  // Les sons (`RT8`) : un genre de plus depuis que l'atelier des sons a quitté
  // le dialogue plein écran pour un lieu de la pile, comme les tuiles.
  sons: "son",
  montage: "montage",
  bande: "bande",
  "montage-de-bande": "montage",
  envoi: "envoi",
}

describe("GU3 — chaque genre de lieu a un écran de guide", () => {
  test.each(Object.entries(GENRE_VERS_OU))(
    'le genre "%s" a un écran de guide (`ou`) déclaré, dédié ou hérité',
    (genre, ou) => {
      expect(ou, `le genre "${genre}" n'a aucun écran de guide, ni le sien ni hérité`).not.toBe("")
    },
  )
})
