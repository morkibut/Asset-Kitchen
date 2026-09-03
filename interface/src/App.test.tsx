/// <reference types="vite/client" />
// Le seul endroit du dépôt où l'interface est montée et pilotée.
//
// Il existe pour une raison précise, et elle est écrite dans `AGENTS.md`
// `docs/PIEGES.md` : **deux chemins amènent la même génération à l'écran, et ils
// se croisent.** La réponse du POST et l'annonce du flux portent le même objet,
// et le serveur publie *avant* que le POST ne soit revenu. Le défaut qui en est
// sorti — chaque génération lancée depuis l'onglet en double — n'a été vu ni par
// les tests du serveur, qui ne montent pas d'écran, ni par un rechargement, qui
// remplace la liste par celle du serveur. Il a fallu une séance au navigateur.
//
// Ce fichier reproduit **l'ordre réel** : on publie, puis on répond. Sans cet
// ordre-là, le test passerait avec le code fautif.
//
// T3 y ajoute les cinq critères d'acceptation qui ne se vérifient que devant
// l'écran : la fiche en panneau latéral qui se referme sur la position d'avant,
// les deux états vides, le repli des panneaux, et l'annulation d'une
// suppression. Les onze autres vivent dans `tests/test_t3.py`.
//
// Ni réseau ni serveur : `fetch` et `EventSource` sont doublés ici, comme
// `tests/conftest.py` double le fournisseur côté Python. Aucun centime.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import { App } from "./App"
import { reinitialiserApercu } from "./composants/Apercu"
import { toutReplier } from "./composants/chassis"
import { reinitialiserGuide } from "./composants/Guide"
import { reinitialiserPressePapier } from "./composants/Tables"
import { AIDE, SANS_ENTREE } from "./aide"
import { POSE_VIDE } from "./api"
import { COULEUR_TEINTE, NOM_TEINTE, RECETTE_VIDE, TEINTES } from "./api"
import type {
  Envoi,
  Tri,
  Asset,
  Bibliotheque,
  Boite,
  Carte,
  Case,
  LectureDePalette,
  Contour,
  Direction,
  DirectionsDuJeu,
  Calibrage,
  PoseCalee,
  PorteeDeLaPiece,
  PropositionDeBaisse,
  Depenses,
  Etat,
  Etiquette,
  FondPropose,
  Main,
  Modele,
  TachesDeLAsset,
  CompteReferences,
  EtatCatalogue,
  EtatSecret,
  Generation,
  Reserve,
  EmplacementCorps,
  Impose,
  Lien,
  AmbianceDuJeu,
  PaletteNommee,
  Personnage,
  Piece,
  Planche,
  Pose,
  PosesDesTypes,
  Recette,
  RetoucheDePalette,
  SourceDePalette,
  Teinte,
  Tiroir,
  Trait,
  Univers,
} from "./api"

// ── Le double du flux ────────────────────────────────────────────────────────
//
// `EventSource` n'existe pas hors navigateur. Celui-ci ne fait que ce dont le
// test a besoin : retenir les écoutes, et laisser le test décider *quand* un
// fait arrive. C'est ce contrôle du moment qui rend le croisement reproductible.

class FluxDouble {
  static ouverts: FluxDouble[] = []
  ecoutes = new Map<string, ((m: MessageEvent<string>) => void)[]>()
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  fermé = false

  constructor(public url: string) {
    FluxDouble.ouverts.push(this)
  }

  addEventListener(genre: string, ecoute: (m: MessageEvent<string>) => void) {
    const liste = this.ecoutes.get(genre) ?? []
    liste.push(ecoute)
    this.ecoutes.set(genre, liste)
  }

  close() {
    this.fermé = true
  }

  /** Ce que l'atelier annonce. */
  emettre(genre: string, charge: unknown) {
    for (const ecoute of this.ecoutes.get(genre) ?? [])
      ecoute({ data: JSON.stringify(charge) } as MessageEvent<string>)
  }
}

// ── La largeur de la colonne, doublée ───────────────────────────────────────
//
// jsdom ne met rien en page : `getBoundingClientRect` y rend des zéros. Or le
// grisé du zoom repose sur une **largeur mesurée** — « zéro n'est pas une
// largeur, c'est l'absence de mesure », donc rien n'y serait jamais grisé. On
// double donc la mesure, comme `FluxDouble` double le flux, et le test décide
// de la largeur qu'a la colonne centrale.

let largeurRendue = 0

function mesurer(largeur: number) {
  largeurRendue = largeur
  fireEvent(window, new Event("resize"))
}

/** La place que l'aperçu croit avoir. Même raison que la colonne centrale : son
 *  facteur d'ajustement est *calculé* sur une mesure, et sans mesure il se tait
 *  — « zéro n'est pas une dimension ». Le test décide donc de la scène, comme il
 *  décide de la largeur de la colonne. */
const SCENE = { l: 1000, h: 800 }

function doublerLaMesure() {
  largeurRendue = 0
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset.apercuScene !== undefined)
        return { ...VIDE, width: SCENE.l, height: SCENE.h } as DOMRect
      return { ...VIDE, width: this.tagName === "SECTION" ? largeurRendue : 0 } as DOMRect
    },
  )
}

const VIDE = {
  x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, height: 0, width: 0,
  toJSON: () => ({}),
}

// ── La colonne de la grille, doublée ────────────────────────────────────────
//
// Même raison que `doublerLaMesure`, et un cran plus loin. L'aimant de la
// largeur libre se règle sur la largeur **réelle** d'une colonne de la grille,
// lue dans `gridTemplateColumns` calculé : un navigateur y rend la valeur
// utilisée — « 169.5px 169.5px » —, jsdom y rend la règle telle qu'écrite,
// puisqu'il ne met rien en page. Sans mesure, pas d'aimant, et la toile ne se
// règle sur rien : c'est le comportement voulu au navigateur comme ici, mais il
// laisse le plan vide, donc rien à vérifier.
//
// On double donc la mesure, et **seulement pour la grille** : `getComputedStyle`
// sert aussi aux vérifications de visibilité de la bibliothèque d'essai, et lui
// rendre un objet inventé partout casserait ce qui n'a rien demandé.

function doublerLaGrille(colonne: number) {
  const vrai = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation(((
    element: Element,
    pseudo?: string | null,
  ) => {
    if (element instanceof HTMLElement && element.dataset.grille !== undefined)
      return {
        gridTemplateColumns: `${colonne}px ${colonne}px`,
        display: "grid",
        visibility: "visible",
        opacity: "1",
        getPropertyValue: () => "",
      } as unknown as CSSStyleDeclaration
    return vrai(element, pseudo)
  }) as typeof window.getComputedStyle)
}

// ── Ce que le serveur répond ─────────────────────────────────────────────────

const MODELE = {
  // **Le nom complet, fournisseur compris** (F1) : `essai:modele` se lit « le
  // modèle *modele* de chez *essai* ». C'est ce que le serveur rend depuis la
  // V2.2, et le double se construit sur ce que la route dit vraiment.
  identifiant: "essai:modele",
  nom: "Essai : Modèle",
  fournisseur: "essai",
  chez_lui: "modele",
  references_max: 4,
  proportions: ["1:1", "3:2", "2:3", "16:9"],
  resolutions: [],
  variations_max: 4,
  options: {},
  refus: null,
  // D'où vient cette fiche (F1) : relue chez le fournisseur, pas depuis une
  // photo. C'est le cas courant, et celui de tous les essais d'écran.
  repli: false,
  recu_le: 1_787_800_000,
  // Dans quoi ce modele se paie (F2). `usd` : c'est ce qu'etait tout le
  // produit avant la V2.2, et ce que la quasi-totalite des essais verifie.
  unite: "usd",
}

const CATALOGUE: EtatCatalogue = {
  recu_le: 1_787_800_000,
  repli: false,
  raison: null,
  // Un état par fournisseur (F1). Un seul ici : c'est ce que le produit était
  // avant la V2.2, et ce que la quasi-totalité des essais d'écran vérifie.
  fournisseurs: [
    {
      nom: "essai",
      modeles: 1,
      recu_le: 1_787_800_000,
      repli: false,
      raison: null,
      indisponible: null,
      grise: null,
      // Il compte en argent, donc aucune reserve (F2) : ce qu'il a coute se lit
      // dans la barre de tete.
      reserve: null,
    },
  ],
  defaut: { modele: MODELE.identifiant, options: {} },
  // Ce qui partira vraiment, artworks compris — calculé par le serveur (US-52),
  // et depuis C1 **ligne par ligne, avec sa provenance** (US-127).
  references: {
    total: 0,
    manuelles: 0,
    artworks: 0,
    concepts: 0,
    // **Le gabarit du lot** (C2). Zéro sans lot armé, et c'est ce que le
    // serveur rend — le double se construit sur ce que la route dit vraiment,
    // jamais sur ce qu'on voudrait qu'elle dise (`docs/PIEGES.md`, payé en C1).
    gabarit: 0,
    famille: null,
    lignes: [],
  },
  // Ce qu'une image a coûté chez chaque modèle, **mesuré** sur les derniers
  // appels (US-121). Vide : dans un atelier neuf, aucun modèle n'a rien
  // facturé, et le produit le dit plutôt que d'inventer un tarif.
  couts: {},
  modeles: [MODELE],
}

/** Un univers vide — l'état d'un projet neuf. « Un univers vide ne contraint
 *  rien » : c'est le cas normal, pas une configuration manquante. */
/** Sous quel intitulé anglais chaque champ de bible part (R2). **Le double le
 *  porte parce que le serveur le porte** : la composition du prompt vit là-bas,
 *  et le seul moyen de vérifier que l'écran ne la refait pas est de la mettre
 *  ailleurs que chez lui. */
const INTITULE: Record<string, string> = {
  monde: "World",
  epoque: "Era",
  rendu: "Rendering technique",
  trait: "Line and shading",
  eclairage: "Lighting",
  vue: "View and framing",
  technique: "Technical constraints",
}

const UNIVERS: Univers = {
  vue: "",
  style: "pixel",
  methode_pixels: "proche",
  // **Aucun fond posé** (D3) — l'état d'avant la tranche, celui d'un projet qui
  // n'a rien choisi : le produit demande *un fond plat* sans dire lequel.
  fond: "",
  detourage_image: null,
  detourage_planche: null,
  detourages: {},
  bible: [
    { nom: "monde", texte: "", actif: true },
    { nom: "epoque", texte: "", actif: true },
    { nom: "rendu", texte: "", actif: true },
    { nom: "trait", texte: "", actif: true },
    { nom: "eclairage", texte: "", actif: true },
    { nom: "vue", texte: "", actif: true },
    { nom: "technique", texte: "", actif: true },
  ],
  bareme: [
    { nom: "personnage", famille: "personnages", occupation: 100, silhouette: true },
    { nom: "objet tenu", famille: "objets", occupation: 40, silhouette: true },
  ],
  cible_px: 64,
  couleurs: 24,
  palette: [],
  palette_empreinte: "",
  modeles: {},
  // **Les deux modèles d'appel** (C2) — vides, la famille du sujet puis le
  // défaut du catalogue reprennent la main. C'est ce que le serveur rend d'un
  // projet neuf, et le double se construit sur ce que la route dit vraiment.
  modele_planche: "",
  modele_edition: "",
  // **Ce que l'atelier ecrit lui-meme**, case par case : la grille, le calage
  // et le cadrage se calculent depuis la taille et la vue, et ne vivent plus
  // dans le texte de la case. Vide ici, parce que cet univers est vide.
  phrases: {},
  vide: true,
}

/** Une attitude comme le serveur la rend depuis E10 : **deux textes, et un seul
 *  part** — le nom se lit, la consigne part au modèle. */
const pose = (identifiant: string, nom: string, consigne = "", images = 1): Pose => ({
  identifiant,
  nom,
  images,
  consigne,
  ecartees: [],
  images_avant: 0,
})

/** Le plan d'un projet neuf — six attitudes, une image chacune. Le vrai serveur
 *  en donne autant sans qu'aucune ligne n'ait été écrite (US-116). */
const PLAN: Pose[] = [
  pose("repos", "repos", "idle stance, full body"),
  pose("marche", "marche", "walking posture, full body"),
  pose("course", "course", "running posture, full body"),
  pose("attaque", "attaque", "attacking posture, full body"),
  pose("degats", "dégâts", "hurt reaction, recoiling, full body"),
  pose("mort", "mort", "dead, lying on the ground"),
]

/** Un jeu qui n'a pas déclaré de vue n'a **aucune direction**, et le mot ne
 *  paraît alors nulle part dans le produit. C'est l'état d'un projet neuf, et
 *  celui que la plupart des essais mesurent (E10). */
const SANS_DIRECTIONS: DirectionsDuJeu = {
  directions: [],
  origine: "vue",
  vue: "",
  vue_libelle: "",
  proposees: [],
}

/** Les quatre points cardinaux d'un jeu vu de dessus, tels que la vue les
 *  propose — nom français, consigne anglaise. */
/** Rien à proposer, rien à défaire : l'état d'un jeu qui n'a pas de directions,
 *  ou dont aucune pose ne compte les angles. */
const PROPOSITION_VIDE: PropositionDeBaisse = {
  directions: 0,
  poses: [],
  raison: "",
  cases_avant: 0,
  cases_apres: 0,
  defaite: [],
}

const QUATRE: Direction[] = [
  { identifiant: "sud", nom: "sud", consigne: "facing south, toward the viewer" },
  { identifiant: "nord", nom: "nord", consigne: "facing north, away from the viewer" },
  { identifiant: "est", nom: "est", consigne: "facing east, to the right" },
  { identifiant: "ouest", nom: "ouest", consigne: "facing west, to the left" },
]

const personnage = (nom: string, sur: Partial<Personnage> = {}): Personnage => {
  const ecartees = sur.ecartees ?? []
  return {
    identifiant: nom.toLowerCase().replace(/\s+/g, "-"),
    projet: "bac-a-sable",
    nom,
    description: "",
    concept_arts: [],
    references_ecartees: [],
    cree_le: 1_787_800_100,
    // Les cases viennent du serveur, qui les déduit du plan et des assets. Le
    // double les calcule de la même façon : un personnage neuf a autant de
    // cases vides que d'attitudes tenues.
    cases: PLAN.filter((p) => !ecartees.includes(p.identifiant)).map((p) => ({
      pose: p.identifiant,
      demandees: p.images,
      images: [],
      ...VIDE_C3,
    })),
    // **Ce que cette chose-là réclame** (E9). Le double rend le plan du jeu,
    // comme le serveur le fait pour une chose sans type : c'est l'état d'avant
    // la tranche, et c'est ce que la plupart des essais mesurent.
    plan: PLAN,
    type: "",
    ajoutees: [],
    // Aucune ambiance au départ : une chose du jeu retombe sur le jeu, et
    // c'est l'état d'un projet neuf (E11).
    ambiance: "",
    prend: "tout",
    // Rien d'écrit sur la chose, rien d'éteint, rien de promu : l'état des
    // trois personnages du vrai projet, faute d'écran qui les atteigne (E12).
    textes: {},
    eteints: [],
    references: [],
    // Aucune direction rangée : un jeu neuf n'en a pas déclaré (E10).
    directions_ecartees: {},
    // **Sa famille, lue dans son type par le serveur** (E15). Sans type, c'est
    // un personnage — l'état de toutes les choses d'avant E9, et celui que la
    // plupart des essais mesurent.
    famille: "personnages" as const,
    equipable: true,
    // Aucune pose mise de côté du calage commun (E17).
    hors_calibrage: [],
    ...sur,
    ecartees,
  }
}

const BIBLIOTHEQUE: Bibliotheque = {
  courant: "bac-a-sable",
  projets: [
    {
      identifiant: "bac-a-sable",
      nom: "Bac à sable",
      cree_le: 1_787_800_000,
      assets: 0,
      total_usd: 0,
    },
  ],
  collections: [],
  sans_projet: { assets: 0, total_usd: 0 },
  total_usd: 0,
}

/** La place d'un fournisseur qui demande une clé, remplie. */
const PLACE_PLEINE = {
  nom: "OPENROUTER_API_KEY",
  libelle: "la clé",
  ou: "openrouter.ai/settings/keys",
  presente: true,
  origine: "fichier",
  apercu: "abcdef",
  retirable: true,
}

/** La même, vide. */
const PLACE_VIDE = {
  ...PLACE_PLEINE,
  presente: false,
  origine: "absente",
  apercu: "",
  retirable: false,
}

/** **Le tiroir vide paraît quand même** : un fournisseur qui ne demande rien
 *  est un renseignement, et c'est le premier que l'auteur cherche. */
const SANS_SECRET = {
  fournisseur: "Pollinations",
  secrets: [],
  manque: null,
  pret: true,
}

const ETAT: Etat = {
  secrets: [
    { fournisseur: "OpenRouter", secrets: [PLACE_PLEINE], manque: null, pret: true },
    SANS_SECRET,
  ],
  // **L'atelier des essais n'est pas neuf** : il a un jeu nommé et des images.
  // Le premier lancement se mesure à part, dans le bloc de E19.
  premier_lancement: false,
  catalogue: {
    modeles: 1,
    recu_le: CATALOGUE.recu_le,
    repli: false,
    raison: null,
    fournisseurs: CATALOGUE.fournisseurs,
  },
  couts: { total_usd: 0, reserves: [] },
  traitement: {
    moteurs: [{ nom: "bord", raison: null }],
    // Le catalogue des modèles de silhouette, tel que le serveur le rend (U13)
    // — **deux absences différentes** : le lourd n'est pas descendu, et il reste
    // choisissable ; un moteur absent porterait une `raison` et se griserait.
    silhouettes: [
      {
        nom: "u2net",
        titre: "rapide",
        octets: 175_997_641,
        lent: false,
        note: "le plus rapide",
        // **Il calcule en 320 puis réagrandit son masque** (D4) : c'est le
        // nombre qui décide de ce qu'il peut rendre, et l'écran le dit.
        entree: 320,
        licence: "Apache-2.0",
        defaut: true,
        descendu: true,
        raison: null,
      },
      {
        nom: "birefnet-general",
        titre: "lourd",
        octets: 972_666_916,
        lent: true,
        note: "le meilleur sur les silhouettes difficiles",
        entree: 1024,
        licence: "MIT",
        defaut: false,
        descendu: false,
        raison: null,
      },
    ],
    quantification: {
      raison: null,
      note: "aucun artwork officiel — les couleurs se déduisent de chaque image",
    },
    reductions: [
      { nom: "vote", libelle: "vote en deux temps", raison: null },
      { nom: "pixeloe", libelle: "traits épaissis", raison: null },
      { nom: "lanczos", libelle: "réduction douce", raison: null },
      { nom: "proche", libelle: "au plus proche", raison: null },
    ],
    recettes: [],
  },
  bibliotheque: BIBLIOTHEQUE,
  univers: UNIVERS,
  agent: {
    garde_fous: {
      plafond_actif: true,
      plafond: 20,
      modele_actif: true,
      modele: "openai/gpt-image-2",
      options: { quality: "low" },
      dossier_jeu: "",
    },
    consommation: {
      generations: 0,
      depense_usd: 0,
      consomme: [],
      plafond_actif: true,
      plafond: 20,
      reste: 20,
      depuis: 1_787_800_000,
    },
  },
  annulation_s: 8,
  generations: [],
  assets: [],
}

const generation = (
  identifiant: string,
  variations: number,
  statut: Generation["statut"],
  raison: string | null = null,
): Generation => ({
  identifiant,
  modele: MODELE.identifiant,
  demande: {
    prompt: "un tonneau",
    prompt_negatif: "",
    proportions: "1:1",
    resolution: null,
    variations,
    references: 0,
    options: {},
  },
  parametres_resolus: {},
  ecartees: [],
  // **Rien n'a cédé devant le plafond du modèle** (F6) — le cas de presque tous
  // les appels, et le seul que la plupart des essais ont à jouer.
  hors_plafond: [],
  emplacements: Array.from({ length: variations }, (_, rang) => ({
    rang,
    statut,
    consomme: 0,
    unite: "usd",
    cout_usd: 0,
    duree_s: 0,
    resultat: null,
    raison,
    demarre_le: null,
    duree_attendue_s: 12,
  })),
  cree_le: 1_787_800_100,
  projet: "bac-a-sable",
  references: [],
  parent: null,
  statut,
  cout_usd: 0,
  consomme: 0,
  unite: "usd",
  reussies: 0,
})

// Ce qu'une case porte au-delà de ses images : le second axe de C3, vide, et
// **l'origine de sa pose** (E9) — venue du type, comme l'immense majorité.
// **Et le second axe de E10** : une case sans direction est celle d'un jeu qui
// n'en a pas déclaré — l'immense majorité des essais.
const VIDE_C3: Omit<Case, "pose" | "demandees" | "images"> = {
  calques: {},
  corps: null,
  origine: "type",
  directions: [],
  directions_rangees: [],
  sans_direction: [],
}

/** Une palette du double : quatre couleurs, chacune sachant d'où elle vient.
 *
 *  Les provenances ne sont pas décoratives — l'écran écrit une lettre par
 *  pastille, et un double qui les rendrait toutes pareilles ne prouverait pas
 *  que la marque suit la couleur. */
const paletteDouble = (nom: string): PaletteNommee => ({
  identifiant: nom.toLowerCase().replace(/\s+/g, "-"),
  nom,
  sources: [],
  couleurs: 4,
  du_jeu: 4,
  attraction: 0,
  retouches: [],
  rendue: ["#112233", "#445566", "#778899", "#aabbcc"],
  pastilles: [
    { couleur: "#112233", venue: "jeu", retiree: "" },
    { couleur: "#445566", venue: "jeu", retiree: "" },
    { couleur: "#778899", venue: "ambiance", retiree: "" },
    { couleur: "#aabbcc", venue: "main", retiree: "" },
  ],
  empreinte: "aaaabbbbccccdddd",
  attraction_inerte: true,
  sources_perdues: [],
  emplois: 0,
  cree_le: 1_787_800_200,
})

const ambianceDouble = (nom: string, palette = ""): AmbianceDuJeu => ({
  identifiant: nom.toLowerCase().replace(/\s+/g, "-"),
  nom,
  palette,
  references: [],
  monde: "",
  eclairage: "",
  trait: "",
  emplois: [],
  cree_le: 1_787_800_300,
})

const POSES_DU_MEUBLE: Pose[] = [
  pose("ferme", "fermé", "closed"),
  pose("ouvert", "ouvert", "open, lid raised"),
  pose("vide", "vidé", "open and empty, contents gone"),
]

/** Ce que le produit propose à chaque type d'objet, et d'où sa liste lui vient
 *  (E9). Deux qui suivent le plan du jeu, un qui n'a aucune attitude, un qui a
 *  la sienne : de quoi mesurer les trois origines sans en inventer une. */
const TYPES: PosesDesTypes["types"] = [
  { nom: "personnage", origine: "projet", poses: PLAN, connues: PLAN },
  { nom: "créature", origine: "projet", poses: PLAN, connues: PLAN },
  {
    nom: "meuble",
    origine: "connue",
    poses: POSES_DU_MEUBLE,
    connues: POSES_DU_MEUBLE,
  },
  { nom: "tuile", origine: "connue", poses: [], connues: [] },
]

const asset = (
  identifiant: string,
  label = "un tonneau",
  provenance: Asset["provenance"] = "auteur",
  modele = "google/gemini-2.5-flash-image",
): Asset => {
  const [gen, rang] = identifiant.split(/-(\d+)$/)
  return {
    identifiant,
    generation: gen,
    rang: Number(rang ?? 0),
    largeur: 1024,
    hauteur: 1024,
    type_media: "image/png",
    label,
    provenance,
    modele,
    personnage: null,
    pose: null,
    // **Vide n'est pas le sud** (E10) : une image sans direction est une image
    // faite avant que le jeu ne déclare les siennes, et le produit ne devine
    // pas la sienne.
    direction: null,
    // **Vide pour toute image qui n'est pas sortie d'une planche pliée** (C2) —
    // c'est-à-dire pour l'immense majorité d'entre elles, et pour toutes
    // celles-ci.
    lot: null,
    piece: null,
    calque: null,
    personnage_supprime: false,
    recette: {
      passes: [],
      difference: null,
      recadrage: null,
      grille: null,
      quantification: null,
      bords: null,
      contours: null,
      main: null,
      veille: [],
      nom: null,
    },
    rendu_largeur: 0,
    rendu_hauteur: 0,
    cree_le: 1_787_800_100,
    cout_usd: 0.0245,
    consomme: 0.0245,
    unite: "usd",
    epingle: false,
    projet: "bac-a-sable",
    collection: null,
    parent: null,
    parent_supprime: false,
    favori: false,
    supprime_le: null,
    traite: false,
    empreinte: "abc123",
  }
}

const carteImage = (identifiant: string, sur: Partial<Carte> = {}): Carte => {
  const carte: Carte = {
    identifiant,
    projet: "bac-a-sable",
    genre: "image",
    texte: "",
    statut: "prete",
    raison: null,
    source: "",
    cree_le: 1_787_800_100,
    groupe: "",
    note: "",
    taille: 1,
    position: null,
    largeur_libre: null,
    teinte: "",
    officiel: false,
    famille: "tous",
    empreinte: "cafe1234",
    largeur: 512,
    hauteur: 512,
    type_media: "image/png",
    octets: 4096,
    montrable: true,
    artwork: false,
    en_reserve: true,
    ...sur,
  }
  // **Recalculé après coup, comme le serveur le calcule** : ni classée, ni
  // posée. Un essai qui pourrait poser `en_reserve` à côté d'un groupe
  // fabriquerait un état que le produit ne sait pas produire, et prouverait
  // alors quelque chose de faux.
  return { ...carte, en_reserve: !carte.groupe && !carte.position }
}

/**
 * Le serveur double. Il tient une petite bibliothèque en mémoire, parce que
 * T3 fait aller et venir la grille : on filtre, on supprime, on annule, et
 * l'écran redemande à chaque fois — c'est le serveur qui filtre, l'écran ne
 * rejoue jamais la règle de son côté.
 *
 * Le POST de génération **publie avant de répondre** : l'ordre du vrai serveur,
 * qui enregistre, annonce, puis rend la main.
 */
/** La règle du voyage, rejouée par le double — *un réglage voyage, une
 *  coordonnée ne voyage pas* (U5).
 *
 *  **Elle est écrite deux fois dans le dépôt, ici et dans le domaine**, et
 *  c'est le prix ordinaire d'un double : il doit répondre comme le serveur
 *  répond, sans quoi l'essai mesure l'écran contre une fiction. Ce qu'elle rend
 *  n'est jamais comparé au serveur ici — c'est `tests/test_u5.py` qui tient la
 *  vraie règle, et c'est lui qui la vérifie place par place. */
function voyageDouble(recette: Recette): [Recette, string[]] {
  const laisse: string[] = []
  if (recette.difference) laisse.push("la différence du calque")
  const vises = recette.passes.filter((p) => p.point !== null).length
  if (vises) laisse.push(`${vises} point de pipette`)
  if (recette.recadrage?.boite) laisse.push("le cadre tracé à la main")
  if (recette.grille && recette.grille.decalage !== 0)
    laisse.push("le décalage du calibrage")
  if (recette.main && (recette.main.opacite.length || recette.main.calques.length))
    laisse.push("les passages de la main")
  return [
    {
      ...recette,
      passes: recette.passes.map((p) => ({ ...p, point: null })),
      difference: null,
      recadrage: recette.recadrage ? { ...recette.recadrage, boite: null } : null,
      grille: recette.grille ? { ...recette.grille, decalage: 0 } : null,
      main: null,
      nom: null,
    },
    laisse,
  ]
}

/** L'asset visé, où qu'il soit rangé — en galerie ou dans une case, **ou rien**
 *  s'il n'existe nulle part.
 *
 *  Cette forme-ci sert là où le serveur répond `null` plutôt que d'inventer :
 *  une ligne de référence peut nommer une image effacée depuis, et elle doit
 *  alors rester **sans vignette** (R8). */
function trouverAssetSiConnu(
  etat: { assets: Asset[]; personnages: Personnage[] },
  identifiant: string,
): Asset | null {
  const range = etat.personnages
    .flatMap((p) => p.cases)
    .flatMap((c) => [...c.images, ...Object.values(c.calques).flat()])
    .find((a) => a.identifiant === identifiant)
  return range ?? etat.assets.find((a) => a.identifiant === identifiant) ?? null
}

/** L'asset visé, où qu'il soit rangé — en galerie ou dans une case. */
function trouverAsset(
  etat: { assets: Asset[]; personnages: Personnage[] },
  identifiant: string,
): Asset {
  return (
    trouverAssetSiConnu(etat, identifiant) ?? asset(identifiant, "une image")
  )
}

function serveurDouble(options: {
  assets?: Asset[]
  cartes?: Carte[]
  univers?: Univers
  /** Ce que l'atelier propose comme fond, d'après la palette du jeu (D3). Le
   *  test le décide, comme le vrai serveur le déciderait sur les artworks : la
   *  réponse a deux branches — une couleur sûre, ou un refus qui dit de quelle
   *  couleur du jeu il s'approchait —, et l'écran ne se comporte pas pareil. */
  fondPropose?: FondPropose
  /** Un catalogue à plusieurs modèles — ce qu'il faut pour qu'un filtre ait
   *  quelque chose à écarter. Par défaut, ceux du `CATALOGUE`. */
  modeles?: Modele[]
  aPublier?: () => Generation
  /** Ce que la détection propose de découper. Le test le décide, comme le vrai
   *  serveur le déciderait sur l'image : c'est ce que l'écran affiche, et c'est
   *  ce que l'auteur corrige avant de découper (US-73). */
  boites?: [number, number, number, number][]
  raisonDecoupe?: string | null
  /** Ce que l'atelier répond à un export. Par défaut une archive ; le test peut
   *  demander un refus, parce que l'export est le seul appel de l'interface qui
   *  ne rende pas du JSON et que son chemin d'erreur est donc à lui. */
  refusExport?: string | null
  /** Le cadre de l'agent et sa consommation, quand le test veut autre chose que
   *  l'atelier neuf — un plafond entamé, un garde-fou éteint. */
  agent?: Etat["agent"]
  /** Les traits de la toile, et les teintes de ses îlots. Ils arrivent par la
   *  même route que les cartes, parce que le vrai serveur les rend ensemble :
   *  une toile se lit en un aller-retour. */
  liens?: Lien[]
  teintes?: Record<string, Teinte>
  /** Le plan du jeu et ses personnages. Ils arrivent par la même route, parce
   *  que le vrai serveur les rend ensemble : une colonne de cases n'existe que
   *  par le plan qui la nomme. */
  plan?: Pose[]
  personnages?: Personnage[]
  emplacements?: EmplacementCorps[]
  pieces?: Piece[]
  /** Les directions du jeu, et d'où la liste vient (E10). Elles arrivent par la
   *  même route que le plan : une case est une pose *dans une direction*, et
   *  deux appels rendraient possible l'instant où les cases sont là mais pas
   *  les angles qui les nomment. */
  directions?: DirectionsDuJeu
  /** Ce que le produit propose quand des directions viennent d'être déclarées
   *  (US-243). Le test le décide, comme le serveur le déciderait sur le plan. */
  proposition?: PropositionDeBaisse
  /** Sur qui chaque pièce d'équipement est posée (E15). Le serveur le déduit des
   *  images ; le double le rend, parce que ce que l'écran prouve est qu'il
   *  montre des porteurs et **aucune image**. */
  portees?: Record<string, PorteeDeLaPiece>
  /** Ce que le calibrage mesure sur les poses d'une chose (E17). Le test le
   *  décide, comme le serveur le déciderait sur les images. */
  calibrage?: Calibrage
  /** Ce que le calibrage refuse, quand il refuse — un jeu qui n'impose aucune
   *  taille de case n'a pas de hauteur commune à poser. */
  refusCalibrage?: string
  /** Ce que la planche d'une pose enverrait, et ce qu'elle coûterait (E13). Le
   *  double le rend, parce que le serveur compose les textes de case **par le
   *  chemin de l'envoi** : les recomposer à l'écran en aurait fait une seconde
   *  vérité sur ce qui part. */
  planche?: Planche
  /** Ce que le serveur dit qui partira — **ligne par ligne** (US-127). Le
   *  compte et les lignes viennent de lui : l'écran ne connaît ni les artworks
   *  ni les concept arts, et deux comptes divergeraient. */
  references?: CompteReferences
  /** Ce qu'une image a coûté chez chaque modèle — **mesuré**, jamais un tarif. */
  couts?: Record<string, number>
  /** Le catalogue entier, quand le test en veut un autre que celui à un seul
   *  fournisseur (F1). C'est le serveur qui décide de la liste, du grisé de
   *  chaque modèle et du défaut : le double le rend donc en bloc, plutôt que de
   *  laisser l'écran rejouer une règle qui vit là-bas. */
  catalogue?: EtatCatalogue
  /** Ce que le projet impose à l'image ouverte dans la fiche (US-164). Calculé
   *  par le serveur, qui est le seul à savoir sur quelle échelle l'image est
   *  née — l'écran ne le devine jamais. */
  impose?: Impose
  /** Tout ce que l'écran de confirmation montre (E14). Composé par le serveur,
   *  par le chemin même que la soumission emprunte : le double le rend donc lui
   *  aussi, plutôt que de laisser l'écran le recomposer, ce que le produit
   *  refuse. Absent, le double compose depuis la bible de `etat.univers`. */
  envoi?: Envoi
  /** Le prompt **tel qu'il est parti** que porte une génération relue — bible
   *  repliée en tête comprise. C'est ce que « reprendre les réglages » doit
   *  faire repartir mot pour mot (US-160). */
  promptParti?: string
  /** Ce que le serveur rend sur `/api/spending` — les appels payés, leurs trois
   *  issues, et les rafales. Vide par défaut : l'écran des dépenses n'est
   *  ouvert que par les essais qui le demandent. */
  depenses?: Depenses
  /** Ce qu'une table sait de l'image — les taches, les poches, les crans
   *  d'occupation, l'opacité pleine, ce que la main touche. Vide par défaut :
   *  une image d'essai n'a rien à montrer. **Partielle** : un essai ne nomme
   *  que la mesure qu'il regarde, et le double complète le reste — sans quoi
   *  chaque mesure ajoutée au produit ferait réécrire tous les essais qui ne
   *  la regardent pas. */
  mesures?: Partial<TachesDeLAsset>
  /** La base d'étiquettes (E8). **Vide par défaut**, comme sur un atelier neuf :
   *  personne ne l'écrit à la place de l'auteur. */
  etiquettes?: Etiquette[]
  /** Ce que chaque type d'objet réclame (E9). */
  types?: PosesDesTypes["types"]
  /** Les deux listes du côté Ambiances (E11). */
  palettes?: PaletteNommee[]
  ambiances?: AmbianceDuJeu[]
  /** Le tiroir à secrets, quand le test veut autre chose que celui d'`ETAT` —
   *  une place vide, ou un fournisseur qui en demande deux (F3). */
  secrets?: Tiroir[]
  /** Les recettes nommées déjà sur le disque (U5). Le double les tient comme le
   *  serveur les tient : enregistrer, rappeler et oublier agissent dessus. */
  recettes?: Record<string, Recette>
  /** Où la détection propose de couper **une carte** du tableau (06bis). Deux
   *  rectangles par défaut, comme une planche trouvée qui porte deux
   *  personnages. */
  boitesDeCarte?: Boite[]
  /** Ce que la palette lit d'une carte (06bis). Le tiers par défaut : un sujet sur
   *  un fond, ce que le détourage rend sur une image ordinaire. */
  lecture?: LectureDePalette
} = {}) {
  const etat = {
    assets: options.assets ?? [],
    supprimes: [] as string[],
    cartes: options.cartes ?? [],
    liens: options.liens ?? ([] as Lien[]),
    teintes: options.teintes ?? ({} as Record<string, Teinte>),
    univers: options.univers ?? UNIVERS,
    /** Ce que le double a déjà fait entrer, pour reconnaître un doublon —
     *  comme le serveur reconnaît les mêmes octets. */
    importes: [] as { nom: string; asset: Asset }[],
    agent: options.agent ?? ETAT.agent,
    plan: options.plan ?? PLAN,
    personnages: options.personnages ?? ([] as Personnage[]),
    // **Le vestiaire du projet** (C3) — l'autre axe de la même matrice, servi
    // dans le même aller-retour que le plan, exactement comme le serveur.
    emplacements: options.emplacements ?? ([] as EmplacementCorps[]),
    pieces: options.pieces ?? ([] as Piece[]),
    // **Ce que chaque type d'objet réclame** (E9). Le double part de l'état
    // d'avant la tranche : aucun type n'a écrit sa liste, et ceux qui suivent
    // le jeu la reçoivent de lui — c'est ce qui reprend les jeux existants.
    types: options.types ?? TYPES,
    // **Les deux listes du côté Ambiances** (E11). Vides par défaut, comme sur
    // un jeu neuf : le produit n'écrit ni palette ni ambiance à la place de
    // l'auteur.
    palettes: options.palettes ?? ([] as PaletteNommee[]),
    ambiances: options.ambiances ?? ([] as AmbianceDuJeu[]),
    // **Les directions du jeu** (E10). Aucune par défaut, comme un projet qui
    // n'a pas déclaré sa vue : le mot ne paraît alors nulle part, et c'est ce
    // que la plupart des essais mesurent.
    directions: options.directions ?? SANS_DIRECTIONS,
    proposition: options.proposition ?? PROPOSITION_VIDE,
    portees: options.portees ?? ({} as Record<string, PorteeDeLaPiece>),
    calibrage: options.calibrage,
    refusCalibrage: options.refusCalibrage,
    planche: options.planche,
    // **Les recettes nommées** (U5). Elles vivent sur le disque du vrai
    // serveur, donc dans l'état du double : les tenir dans le corps de la
    // requête aurait fait d'*enregistrer puis rappeler* deux gestes sans lien,
    // et c'est précisément le lien que l'étape ajoute.
    recettes: options.recettes ?? ({} as Record<string, Recette>),
    // **Le tiroir à secrets** (F3). Il vit dans `.env` chez le vrai serveur,
    // donc dans l'état du double : ce que la tranche vérifie est qu'un dépôt
    // **ne touche à aucune autre place**, et ça ne se voit que sur le tiroir
    // entier rendu après coup.
    secrets: options.secrets ?? ETAT.secrets,
  }

  const appels: { url: string; corps: unknown }[] = []

  const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
    const url = String(chemin)
    // **Tous les corps ne sont pas du JSON.** Depuis T4, coller une image
    // envoie ses octets bruts : `String(File)` rend « [object File] », et
    // `JSON.parse` levait alors avant même d'atteindre la route. Le double
    // rejoue ce que le vrai serveur fait — il lit le corps selon la route, pas
    // selon une supposition.
    const corps = (() => {
      if (!init?.body || typeof init.body !== "string") return undefined
      try {
        return JSON.parse(init.body)
      } catch {
        return undefined
      }
    })()
    appels.push({ url, corps })
    const rendre = (charge: unknown) =>
      ({ ok: true, status: 200, json: async () => charge }) as Response

    // **L'archive ne passe pas par `json()`** — c'est le seul appel du produit
    // dont la réponse est un fichier. Le double rend donc ce que le vrai
    // serveur rend : des octets, et le nom du fichier dans l'en-tête. Le refus,
    // lui, reste du JSON comme partout ailleurs.
    if (url === "/api/exports") {
      if (options.refusExport)
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "export_refuse",
            raison: options.refusExport,
            ou_aller: null,
          }),
        } as unknown as Response
      return {
        ok: true,
        status: 200,
        headers: {
          get: (nom: string) =>
            nom.toLowerCase() === "content-disposition"
              ? 'attachment; filename="atelier-20260827-1743.zip"'
              : null,
        },
        blob: async () => new Blob(["PK"], { type: "application/zip" }),
      } as unknown as Response
    }
    if (url.startsWith("/api/models"))
      return rendre({
        ...(options.catalogue ?? CATALOGUE),
        // **Plusieurs modèles quand le test en demande** : c'est ce qu'il faut
        // pour qu'un filtre ait quelque chose à écarter, et un catalogue d'un
        // seul modèle ne prouverait rien de l'épinglage.
        ...(options.modeles ? { modeles: options.modeles } : {}),
        references: options.references ?? CATALOGUE.references,
        couts: options.couts ?? CATALOGUE.couts,
      })
    // ── Ce qui part, ligne par ligne (E14) ───────────────────────────────
    //
    // **Le double compose, comme le serveur compose** : c'est très exactement
    // ce que la tranche interdit à l'écran de faire, et le seul moyen de
    // vérifier qu'il ne le fait pas est de mettre la composition ailleurs que
    // chez lui. Il lit la bible de `etat.univers`, donc décocher un champ
    // change ce qu'il rend — ce que l'essai regarde. Et il honore le tri :
    // éteindre une ligne la retire du texte assemblé, comme au serveur.
    if (url === "/api/outgoing") {
      if (options.envoi) return rendre(options.envoi)
      const sujet = String(corps?.prompt ?? "").trim()
      const tri = (corps?.tri ?? {
        eteints: [],
        allumes: [],
        textes: {},
      }) as {
        eteints: string[]
        allumes: string[]
        textes: Record<string, string>
        // **Le quatrième écart** (D3) : la couleur de fond corrigée pour cet
        // appel-ci. Absent laisse celle du jeu, `""` la retire.
        fond?: string | null
      }
      const vivante = (clef: string) =>
        tri.allumes.includes(clef) || !tri.eteints.includes(clef)
      const texteDe = (clef: string, defaut: string) => tri.textes[clef] ?? defaut
      const lignes: Record<string, unknown>[] = []
      if (corps?.repris) {
        lignes.push({
          clef: "sujet.repris",
          groupe: "sujet",
          nom: "ton texte",
          texte: sujet,
          origine: "ton texte",
          allumee: true,
          eteignable: false,
          raison: "le texte est repris à la main — il part mot pour mot",
          remplace: "",
          remplacee_par: "",
          corrigee: false,
          gardable: false,
        })
      } else {
        for (const champ of etat.univers.bible) {
          if (!champ.actif || !champ.texte.trim()) continue
          const clef = `jeu.${champ.nom}`
          lignes.push({
            clef,
            groupe: "jeu",
            nom: champ.nom,
            texte: texteDe(clef, champ.texte.trim()),
            intitule: INTITULE[champ.nom] ?? champ.nom,
            origine: "du jeu",
            allumee: vivante(clef),
            eteignable: true,
            remplace: "",
            remplacee_par: "",
            corrigee: clef in tri.textes,
            // « Garder ce texte » l'écrit sur la fiche de la chose visée : sans
            // chose, il n'y a pas de case où l'écrire, et le geste ne se propose
            // pas.
            gardable: Boolean(corps?.personnage),
          })
        }
        lignes.push({
          clef: "sujet.sujet",
          groupe: "sujet",
          nom: "sujet",
          texte: texteDe("sujet.sujet", sujet),
          origine: "écrit ici",
          allumee: true,
          eteignable: false,
          raison: "sans lui l'appel ne demande rien",
          remplace: "",
          remplacee_par: "",
          corrigee: "sujet.sujet" in tri.textes,
          gardable: Boolean(corps?.personnage),
        })
        const poses = (corps?.poses ?? null) as string[] | null
        const angles = (corps?.directions ?? null) as string[] | null
        const cases =
          angles && angles.length >= 2
            ? angles.length
            : poses && poses.length >= 2
              ? poses.length
              : 0
        if (cases)
          lignes.push({
            clef: "planche.cases",
            groupe: "planche",
            nom: "les cases",
            texte: `Render this as a sprite sheet of ${cases} sprites of the SAME subject.`,
            origine: "de la planche",
            allumee: true,
            eteignable: false,
            raison: "c'est elle qui permettra de découper le retour",
            remplace: "",
            remplacee_par: "",
            corrigee: false,
            gardable: false,
          })
      }
      const debout = lignes.filter((l) => l.allumee)
      // **Trois parties, comme le serveur les compose** (R7) : le contexte, les
      // références, la demande. Une partie vide n'est pas rendue ; un texte
      // repris n'en fait qu'une, sans titre, parce qu'il part mot pour mot.
      const contenu = (clef: string) =>
        clef === "contexte"
          ? [
              debout
                .filter((l) => l.groupe === "jeu")
                .map((l) => `${l.intitule}: ${l.texte}`)
                .join("\n"),
            ].filter(Boolean)
          : clef === "references"
            ? debout.filter((l) => l.groupe === "jointes").map((l) => String(l.texte))
            : [
                debout
                  .filter((l) => l.groupe === "sujet")
                  .map((l) => l.texte)
                  .join(", "),
                ...debout
                  .filter((l) => l.groupe === "planche")
                  .map((l) => String(l.texte)),
              ].filter(Boolean)
      const PROPOS: Record<string, string> = {
        contexte: "ce que ton jeu est, et qui ne change pas d'une image à l'autre",
        references:
          "ce que chaque image jointe est, dite dans l'ordre où elles partent",
        demande: "ce que tu veux cette fois-ci — et la caméra, qui ferme le texte",
      }
      const NOM_PARTIE: Record<string, string> = {
        contexte: "le contexte",
        references: "les références",
        demande: "la demande",
      }
      const parties = corps?.repris
        ? [
            {
              clef: "demande",
              titre: "",
              nom: "ton texte",
              propos: "repris à la main — il part mot pour mot, sans titre",
              texte: debout.map((l) => String(l.texte)).join("\n\n"),
              repris: true,
            },
          ]
        : // Les trois sont rendues même vides — l'écran range des lignes, et
          // une ligne éteinte reste à sa place. C'est le texte vide qui dit
          // qu'une partie ne part pas.
          ["contexte", "references", "demande"].map((clef) => ({
            clef,
            titre: { contexte: "CONTEXT", references: "REFERENCES", demande: "REQUEST" }[
              clef
            ]!,
            nom: NOM_PARTIE[clef],
            propos: PROPOS[clef],
            texte: contenu(clef).join("\n\n"),
            repris: false,
          }))
      const texte = parties
        .filter((p) => p.texte.trim())
        .map((p) => (p.titre ? `${p.titre}\n\n${p.texte}` : p.texte))
        .join("\n\n")
      const compte = options.references ?? CATALOGUE.references
      const ecartees = (corps?.references_ecartees ?? null) as string[] | null
      let rangImage = 0
      const images = compte.lignes.map((ligne) => {
        const cochee = ecartees
          ? !ecartees.includes(ligne.asset)
          : !ligne.ecartee_par
        if (cochee) rangImage += 1
        return {
          ...ligne,
          cochee,
          hors_plafond: false,
          // Le numéro que le texte lui donne (R7).
          rang: cochee ? rangImage : null,
          prix: 0.008,
        }
      })
      const cochees = images.filter((i) => i.cochee).length + compte.gabarit
      const PARTIE_DU_GROUPE: Record<string, "contexte" | "references" | "demande"> = {
        jeu: "contexte",
        ambiance: "contexte",
        jointes: "references",
        sujet: "demande",
        planche: "demande",
        cadrage: "demande",
      }
      const compter = (groupe: string, nom: string) => ({
        clef: groupe,
        nom,
        partie: PARTIE_DU_GROUPE[groupe],
        allumees: lignes.filter((l) => l.groupe === groupe && l.allumee).length,
        total: lignes.filter((l) => l.groupe === groupe).length,
      })
      return rendre({
        texte,
        parties,
        lignes,
        groupes: [
          compter("jeu", "les textes du jeu"),
          compter("sujet", "le sujet"),
          compter("planche", "la planche"),
          { clef: "images", nom: "les images", allumees: cochees, total: 14 },
        ].filter((g) => g.clef === "images" || g.total > 0),
        images: {
          lignes: images,
          places: 14,
          cochees,
          gabarit: compte.gabarit,
          palette: 0,
          rang_gabarit: compte.gabarit ? rangImage + 1 : null,
          rang_palette: null,
          prix: 0.008,
          avertissements: [],
        },
        options: [
          {
            clef: "options.palette",
            nom: "palette",
            texte: "envoyer la palette en référence",
            detail: "les couleurs du jeu",
            allumee: tri.allumes.includes("options.palette"),
            refus: "",
          },
        ],
        retour: [],
        avertissements: [],
        prix: {
          total: 0.0063 + 0.008 * cochees,
          appels: 1,
          images: 0.008 * cochees,
          mesure: {
            prix: 0.0139,
            bas: 0.0063,
            haut: 0.0232,
            appels: 9,
            base: 0.0063,
            par_image: 0.008,
            sur_base: 9,
            sur_jointes: 15,
          },
        },
        modele: {
          identifiant: "openai/gpt-image-2",
          nom: "GPT-Image-2",
          references_max: 14,
        },
        ambiance: null,
        cases: 0,
        caracteres: { total: texte.length, sujet: sujet.length, eteints: 0 },
        corrections: Object.keys(tri.textes).length,
        // **Le fond de cet appel-ci** (D3). Le double le rend comme le serveur
        // le rend : la couleur du jeu, ou celle que l'écran vient de corriger
        // pour cet appel — `tri.fond`, qui est un écart de plus et non une
        // ligne de texte.
        fond: {
          couleur: tri.fond ?? UNIVERS.fond,
          interdiction: "",
          du_jeu: UNIVERS.fond,
          corrige: tri.fond != null,
          propose: {
            couleur: "",
            nom: "",
            ecart: 0,
            voisine: "",
            raison: "ce jeu n'a pas encore de palette",
          },
        },
      })
    }
    if (url === "/api/status")
      return rendre({ ...ETAT, agent: etat.agent, secrets: etat.secrets })
    // **Déposer et retirer, une place à la fois** (F3). Les deux rendent le
    // tiroir entier, comme le vrai serveur : l'écran ne recalcule jamais l'état
    // lui-même — une valeur déposée peut être masquée par une variable
    // d'environnement, et seul le serveur le sait.
    if (url.startsWith("/api/settings/keys")) {
      const nom = decodeURIComponent(url.slice("/api/settings/keys/".length))
      const poser = (place: EtatSecret): EtatSecret =>
        place.nom !== nom
          ? place
          : init?.method === "DELETE"
            ? { ...place, presente: false, origine: "absente", apercu: "", retirable: false }
            : {
                ...place,
                presente: true,
                origine: "fichier",
                apercu: String((corps as { valeur?: string })?.valeur ?? "").slice(-6),
                retirable: true,
              }
      if (init?.method === "PUT" || init?.method === "DELETE")
        etat.secrets = etat.secrets.map((tiroir) => {
          const secrets = tiroir.secrets.map(poser)
          const vides = secrets.filter((p) => !p.presente)
          return {
            ...tiroir,
            secrets,
            // La phrase se recompose comme celle du serveur : elle **dit
            // lequel** manque dès qu'il y a plus d'une place.
            manque: !vides.length
              ? null
              : secrets.length === 1
                ? `aucune clé ${tiroir.fournisseur}`
                : `il manque, chez ${tiroir.fournisseur} : ${vides
                    .map((p) => p.libelle)
                    .join(", ")}`,
            pret: vides.length === 0,
          }
        })
      return rendre({ tiroirs: etat.secrets })
    }
    // Le cadre de l'agent. Le PUT rend **le cadre entier et sa consommation**,
    // comme le vrai serveur : l'écran pose un champ et reçoit tout, ce qui lui
    // évite d'en recalculer un seul — et c'est justement ce qu'on vérifie.
    if (url === "/api/settings/agent") {
      if (init?.method === "PUT") {
        const garde_fous = { ...etat.agent.garde_fous, ...corps }
        etat.agent = {
          garde_fous,
          consommation: {
            ...etat.agent.consommation,
            plafond_actif: garde_fous.plafond_actif,
            plafond: garde_fous.plafond,
            reste: garde_fous.plafond_actif
              ? Math.max(0, garde_fous.plafond - etat.agent.consommation.generations)
              : null,
          },
        }
      }
      return rendre(etat.agent)
    }
    // Ce qu'une table sait de l'image (E3) : les taches, les poches, les crans
    // d'occupation. Le double répond comme le serveur — une image d'essai n'a
    // ni tache ni poche, et c'est une réponse, pas un trou.
    // L'assistant (E8) : deux listes fermées et une base d'étiquettes qui part
    // vide — c'est ce que le serveur répond sur un atelier neuf.
    if (url.includes("/universe/views"))
      return rendre({
        vues: [
          {
            identifiant: "vue-dessus-34",
            libelle: "De dessus, 3/4",
            exemples: "Zelda A Link to the Past",
            images: 4,
            phrase: "3/4 top-down orthographic view",
            directions: [],
          },
        ],
        tailles: [8, 16, 24, 32, 48, 64, 96, 128, 256].map((cible) => ({
          cible,
          quoi: `des sujets de ${cible} pixels`,
        })),
      })
    if (url.includes("/universe/consequences"))
      return rendre({ images: 0, cout_usd: 0, cible: 128, poses: 0, images_de_pose: 0 })
    if (url.includes("/labels")) return rendre({ etiquettes: options.etiquettes ?? [] })
    // La seconde fabrique (E6) : ouvrir ne crée rien, et l'aperçu non plus.
    // Le double répond ce que le serveur répond — un dessous nul quand rien
    // n'est désigné, et deux images vides en `data:`.
    if (url.includes("/overlay/preview"))
      return rendre({
        calque: "data:image/png;base64,",
        aplat: "data:image/png;base64,",
        mesures: {
          silhouette: 0.99,
          repeint: 0.01,
          ajout: 0.08,
          echelle: 1,
          compacite: 0.94,
        },
      })
    if (url.includes("/overlay")) {
      const dessus = String(url).split("/assets/")[1]?.split("/")[0] ?? ""
      const nomme = new URL(String(url), "http://x").searchParams.get("dessous")
      // Sans dessous nommé, le serveur reprend celui que la superposition de
      // cette image désignait. Le double fait pareil, en prenant l'autre image
      // qu'on lui a donnée.
      const bas =
        (options.assets ?? []).find((a) => a.identifiant === (nomme ?? "")) ??
        (nomme ? null : ((options.assets ?? []).find((a) => a.identifiant !== dessus) ?? null))
      return rendre({
        dessus: (options.assets ?? []).find((a) => a.identifiant === dessus) ?? asset(dessus, dessus),
        dessous: bas,
        pose: { ...POSE_VIDE, dessus, dessous: bas?.identifiant ?? "" },
        repris: null,
        passes_dessus: 0,
        passes_dessous: bas ? 1 : 0,
        sans_alpha: true,
      })
    }
    if (url.includes("/spots"))
      return rendre({
        taches: [],
        coupees: 0,
        poches: [],
        crans_occupation: [],
        opaque: false,
        main: null,
        visees: [],
        poches_total: 0,
        trous: [],
        // **La grille sur laquelle le modèle a peint** (D2). Le double en
        // annonce une, parce que c'est le cas où la mesure a quelque chose à
        // dire ; les essais qui regardent le renoncement posent une raison à la
        // place, comme le serveur le fait sur une peinture.
        grille_du_modele: {
          pas: 8,
          nettete: 0.82,
          peigne: 0.71,
          carres: 128,
          raison: null,
        },
        // **Ce que la table de recadrage lit** (U2) — un sujet qui occupe le
        // quart central d'une image de 1 024, comme un modèle en rend un.
        recadrage: {
          origine: [1024, 1024],
          sujet: [256, 256, 768, 768],
          tracee: null,
          obtenue: [256, 256, 768, 768],
          jete: 0.7495,
          bords: [],
          coupe: {},
        },
        ...(options.mesures ?? {}),
      })
    if (url.startsWith("/api/spending"))
      return rendre(
        options.depenses ?? {
          total_usd: 0,
          sans_projet_usd: 0,
          par_projet: [],
          par_modele: [],
          appels: [],
          rafales: [],
        },
      )
    if (url.startsWith("/api/library")) return rendre(BIBLIOTHEQUE)
    if (url.startsWith("/api/journal"))
      return rendre({
        projet: "bac-a-sable",
        total_usd: 0,
        rates: 0,
        cout_rate_usd: 0,
        appels: [],
      })
    if (url.includes("/lineage"))
      return rendre({
        parent: null,
        parent_identifiant: null,
        parent_supprime: false,
        enfants: [],
      })
    // Ce que le projet impose à cette image-là (US-164). Le double rend la
    // recette d'un univers ordinaire — 64 px, 100 % d'occupation, sans palette
    // —, et `options.impose` la remplace pour les essais qui la regardent.
    if (url.includes("/imposed"))
      return rendre(
        options.impose ?? {
          impose: {
            passes: [],
            difference: null,
            recadrage: null,
            grille: { cible: 64, occupation: 100, ancrage: "bas", decalage: 0, methode: "proche" },
            quantification: null,
            bords: null,
            contours: null,
            main: null,
            veille: [],
            nom: null,
          },
          echelle: "",
          // **Le détourage de départ et sa provenance** (D1). Le double rend
          // celui du produit : c'est ce qu'un univers sans réglage applique.
          nature: "image",
          detourage: {
            passe: {
              moteur: "bord",
              tolerance: 28,
              seuil_alpha: 128,
              durcissement: 0,
              point: null,
              portee: "tache",
              masquee: false,
              trace: [],
              modele: "",
            },
            origine: "produit",
            famille: "",
          },
        },
      )
    // ── Découper une carte, et ce que la palette y lit (06bis) ────────────
    //
    // **Le double distingue les deux familles d'images, parce que le serveur
    // les distingue.** `/api/board/…/slices` rend des cartes, `/api/assets/…
    // /slices` rend des assets, et c'est tout le sujet de la tranche : un
    // morceau de carte est une carte. Un double qui répondrait la même chose
    // aux deux laisserait passer très exactement l'erreur qu'on veut interdire.
    if (url.startsWith("/api/board/") && url.includes("/palette")) {
      const identifiant = url.slice("/api/board/".length).split("/")[0]
      return rendre(
        options.lecture ?? {
          carte: identifiant,
          part: 33.4,
          entiere: false,
          largeur: 512,
          hauteur: 512,
        },
      )
    }
    if (url.startsWith("/api/board/") && url.includes("/slices")) {
      const identifiant = url.slice("/api/board/".length).split("/")[0]
      if (init?.method === "POST") {
        // Les morceaux arrivent **en réserve, non promus** : c'est ce que le
        // serveur en fait, et promouvoir reste un geste.
        const morceaux = (corps.boites as unknown[]).map((_, rang) =>
          carteImage(`${identifiant}-${rang + 1}`, { note: `morceau ${rang + 1}` }),
        )
        const retiree = corps.remplacer
          ? (etat.cartes.find((c) => c.identifiant === identifiant) ?? null)
          : null
        etat.cartes = [
          ...etat.cartes.filter((c) => !retiree || c.identifiant !== identifiant),
          ...morceaux,
        ]
        return rendre({
          carte: identifiant,
          morceaux,
          retiree,
          univers: etat.univers,
        })
      }
      return rendre({
        carte: identifiant,
        largeur: 512,
        hauteur: 512,
        mode: (corps?.mode as string) ?? "auto",
        boites: options.boitesDeCarte ?? [
          [10, 10, 200, 400],
          [300, 10, 500, 400],
        ],
        raison: null,
      })
    }
    if (url.includes("/slices")) {
      if (init?.method === "POST")
        return rendre({
          planche: "aaaa1111-0",
          decoupes: (corps.boites as unknown[]).map((_, rang) =>
            asset(`aaaa1111-${100 + rang}`, `un tonneau · ${rang + 1}/2`),
          ),
        })
      return rendre({
        asset: "aaaa1111-0",
        label: "un tonneau",
        largeur: 1024,
        hauteur: 1024,
        mode: "auto",
        boites: options.boites ?? [
          [0, 0, 400, 900],
          [500, 0, 900, 900],
        ],
        raison: options.raisonDecoupe ?? null,
      })
    }
    if (url === "/api/assets/delete") {
      etat.supprimes = corps.identifiants
      return rendre({
        supprimes: corps.identifiants,
        annulation_s: 8,
        expire_le: Date.now() / 1000 + 8,
      })
    }
    if (url === "/api/assets/restore") {
      etat.supprimes = []
      return rendre({ assets: [] })
    }
    // ── Faire entrer une image depuis l'écran (R3) ───────────────────────
    //
    // **Le double tient ce que le serveur tient** : ce qui n'est pas une image
    // est refusé en le nommant, et les mêmes octets déjà entrés reviennent en
    // doublon plutôt qu'en refus. Le nom du fichier lui suffit à jouer les
    // trois issues — c'est ce que l'écran voit, et l'écran ne regarde jamais
    // les octets lui-même.
    if (url.startsWith("/api/assets/upload")) {
      const parametres = new URL(url, "http://x").searchParams
      const nom = parametres.get("nom") ?? ""
      if (!/\.(png|jpe?g|webp|gif)$/i.test(nom))
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "import_refuse",
            raison: `« ${nom} » n'est pas une image`,
            ou_aller: null,
          }),
        } as unknown as Response
      const deja = etat.importes.find((i) => i.nom === nom)
      if (deja && parametres.get("forcer") !== "true")
        return rendre({ asset: null, doublon: deja.asset })
      const ne = {
        ...asset(`iiii${etat.importes.length}${etat.assets.length}-0`, nom, "auteur", "import"),
        // Le double porte le choix tel qu'il est arrivé : c'est la seule chose
        // que l'écran ait à décider, et c'est donc la seule qu'il faille voir.
        recette: {
          passes: [],
          difference: null,
          recadrage: null,
          grille:
            parametres.get("traiter") === "true"
              ? { cible: 64, occupation: 100, ancrage: "bas" as const, decalage: 0, methode: "proche" as const }
              : null,
          quantification: null,
          bords: null,
          contours: null,
          main: null,
          veille: [],
          nom: null,
        },
      }
      etat.importes.push({ nom, asset: ne })
      etat.assets = [ne, ...etat.assets]
      return rendre({ asset: ne, doublon: null })
    }
    // ── Ce qui voyage d'une image à l'autre (U5) ───────────────────────────
    //
    // **Le double coupe comme le serveur coupe**, et c'est indispensable : ce
    // que l'étape promet est qu'une coordonnée ne voyage pas et que ce qui est
    // laissé se dit. Un double qui rendrait la recette telle qu'elle est partie
    // laisserait passer un écran qui ne montre jamais l'annonce, et l'essai
    // dirait vert sur un produit muet.
    if (url === "/api/recipes" && init?.method === undefined)
      return rendre({ recettes: etat.recettes })

    if (url.startsWith("/api/recipes/")) {
      const nom = decodeURIComponent(url.slice("/api/recipes/".length))
      if (init?.method === "DELETE") {
        const restantes = { ...etat.recettes }
        delete restantes[nom]
        etat.recettes = restantes
        return rendre({ recettes: etat.recettes })
      }
      if (init?.method === "PUT") {
        const [voyageable, laisse] = voyageDouble(corps as Recette)
        etat.recettes = { ...etat.recettes, [nom]: voyageable }
        return rendre({ recettes: etat.recettes, laisse })
      }
    }

    if (url.endsWith("/paste") && init?.method === "POST") {
      const vise = url.split("/")[3]
      const [voyageable, laisse] = voyageDouble(corps as Recette)
      return rendre({
        asset: { ...trouverAsset(etat, vise), recette: voyageable },
        laisse,
      })
    }

    if (url.includes("/apply/") && init?.method === "POST") {
      const [vise, nom] = [url.split("/")[3], decodeURIComponent(url.split("/apply/")[1])]
      const enregistree = etat.recettes[nom]
      if (!enregistree)
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "recette_refusee",
            raison: `aucune recette nommée « ${nom} »`,
            ou_aller: null,
          }),
        } as unknown as Response
      // **Le voyage est refait au rappel**, comme le serveur le refait : le
      // disque porte des recettes écrites avant que la règle existe.
      const [voyageable, laisse] = voyageDouble(enregistree)
      return rendre({
        asset: { ...trouverAsset(etat, vise), recette: { ...voyageable, nom } },
        laisse,
      })
    }

    // ── La main sur un calque (C4) ─────────────────────────────────────────
    //
    // **Le double écrit, puis il annonce** — l'ordre du vrai serveur, celui dont
    // T1 a montré qu'il ne se devine pas. Il vaut ici plus qu'ailleurs : la
    // promesse « la liste est entière, jamais un ajout » ne se vérifie qu'en
    // envoyant deux passages de suite, et le second ne porte les deux que si le
    // premier est revenu dans la recette. Un double muet aurait laissé cette
    // promesse-là sans preuve.
    if (url.endsWith("/hand") && init?.method === "PUT") {
      const vise = url.split("/")[3]
      const charge = corps as { couche: "affinage" | "retouche"; traits: Trait[] }
      // **Rien n'est écrit en place.** Le vrai serveur réécrit l'asset et la
      // matrice se recalcule dessus ; un double qui muterait l'objet rendrait le
      // *même* tableau à la relecture, et React, qui compare les identités, ne
      // rendrait rien du tout. Le double refait donc la chaîne, comme le serveur
      // refait le fichier.
      let ecrit: Asset | null = null
      etat.personnages = etat.personnages.map((p) => ({
        ...p,
        cases: p.cases.map((c) => ({
          ...c,
          calques: Object.fromEntries(
            Object.entries(c.calques).map(([piece, liste]) => [
              piece,
              liste.map((a) => {
                if (a.identifiant !== vise || !a.recette.difference) return a
                ecrit = {
                  ...a,
                  recette: {
                    ...a.recette,
                    difference: {
                      ...a.recette.difference,
                      [charge.couche]: charge.traits,
                    },
                  },
                }
                return ecrit
              }),
            ]),
          ),
        })),
      }))
      if (!ecrit) return rendre({})
      FluxDouble.ouverts.at(-1)?.emettre("asset", ecrit)
      return rendre(ecrit)
    }
    if (url.startsWith("/api/assets")) {
      const parametres = new URL(url, "http://x").searchParams
      const recherche = parametres.get("recherche")?.toLowerCase() ?? ""
      const vivants = etat.assets.filter((a) => !etat.supprimes.includes(a.identifiant))
      return rendre({
        assets: recherche
          ? vivants.filter((a) => a.label.toLowerCase().includes(recherche))
          : vivants,
      })
    }
    if (url.startsWith("/api/board/paste")) {
      // Le serveur mesure les octets et refuse ce qui n'est pas une image, en
      // **nommant le fichier** (US-45). Le double rejoue la seule chose que
      // l'écran a besoin de voir : le refus, et la carte qui n'existe pas.
      const nom = new URL(url, "http://x").searchParams.get("nom") ?? ""
      if (!nom.endsWith(".png"))
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "carte_refusee",
            raison: `« ${nom} » n'est pas une image`,
            ou_aller: null,
          }),
        } as Response
      const carte = carteImage(`carte-${etat.cartes.length}`)
      etat.cartes = [carte, ...etat.cartes]
      return rendre({ carte, doublon: null })
    }
    // **Régler une carte écrit, puis annonce** — l'ordre du vrai serveur, et
    // celui dont T1 a montré qu'il ne se devine pas. Une seule route porte le
    // groupe et la position ensemble : c'est cette route-là que la toile appelle
    // au relâchement, et deux appels rendraient possible un état où l'un est
    // écrit et l'autre non.
    // ── Les liens de la toile (T9) ────────────────────────────────────────
    // Trois routes, et le double les tient comme le vrai serveur : **il écrit,
    // puis il annonce**. C'est l'ordre dont T1 a montré qu'il ne se devine pas,
    // et c'est lui qui rend le croisement des deux chemins reproductible.
    if (url.startsWith("/api/board/links")) {
      if (init?.method === "POST") {
        const ne = {
          identifiant: `lien-${etat.liens.length + 1}`,
          projet: "bac-a-sable",
          mot: "",
          pointe: false,
          cree_le: 1_787_800_300,
          ...(corps as Partial<Lien>),
        } as Lien
        etat.liens = [...etat.liens, ne]
        FluxDouble.ouverts.at(-1)?.emettre("lien", ne)
        return rendre(ne)
      }
      const identifiant = url.slice("/api/board/links/".length)
      const avant = etat.liens.find((un) => un.identifiant === identifiant)
      if (!avant) return rendre({})
      if (init?.method === "DELETE") {
        etat.liens = etat.liens.filter((un) => un.identifiant !== identifiant)
        FluxDouble.ouverts.at(-1)?.emettre("lien", { ...avant, coupe: true })
        return rendre(avant)
      }
      const apres = { ...avant, ...(corps as Partial<Lien>) }
      etat.liens = etat.liens.map((un) => (un.identifiant === identifiant ? apres : un))
      FluxDouble.ouverts.at(-1)?.emettre("lien", apres)
      return rendre(apres)
    }
    if (url === "/api/board/groups/tint" && init?.method === "PUT") {
      const { groupe, teinte } = corps as { groupe: string; teinte: Teinte }
      etat.teintes = { ...etat.teintes }
      if (teinte) etat.teintes[groupe] = teinte
      else delete etat.teintes[groupe]
      FluxDouble.ouverts.at(-1)?.emettre("univers", {
        projet: "bac-a-sable",
        nom: "Bac à sable",
        univers: etat.univers,
        teintes: etat.teintes,
        realignes: 0,
        conserves: 0,
      })
      return rendre({ projet: "bac-a-sable", teintes: etat.teintes })
    }
    if (url === "/api/board/text" && init?.method === "POST") {
      const { texte, position, groupe } = corps as {
        texte: string
        position?: [number, number]
        groupe?: string
      }
      const note = carteImage(`note-${etat.cartes.length}`, {
        genre: "texte",
        texte,
        position: position ?? null,
        groupe: groupe ?? "",
        largeur: 0,
        hauteur: 0,
      })
      etat.cartes = [note, ...etat.cartes]
      FluxDouble.ouverts.at(-1)?.emettre("carte", note)
      return rendre(note)
    }
    if (url.startsWith("/api/board/") && init?.method === "PUT" && !url.endsWith("/official")) {
      const identifiant = url.slice("/api/board/".length)
      const avant = etat.cartes.find((c) => c.identifiant === identifiant)
      if (!avant) return rendre({})
      const apres = carteImage(identifiant, {
        ...avant,
        ...(corps as Partial<Carte>),
        // `[]` efface la place, une paire la pose, l'absence ne touche pas —
        // la convention de `groupe: ""`, appliquée à une paire de nombres.
        position:
          corps && "position" in corps
            ? corps.position.length
              ? (corps.position as [number, number])
              : null
            : avant.position,
      })
      etat.cartes = etat.cartes.map((c) => (c.identifiant === identifiant ? apres : c))
      FluxDouble.ouverts.at(-1)?.emettre("carte", apres)
      return rendre(apres)
    }
    // **Le double rend ce que la route rend**, liens et teintes compris : une
    // toile se lit en un aller-retour, et un double qui n'en donnerait que la
    // moitié laisserait l'écran deviner l'autre — donc prouverait un contrat qui
    // n'est pas celui du serveur.
    if (url.startsWith("/api/board"))
      return rendre({
        projet: "bac-a-sable",
        cartes: etat.cartes,
        groupes: [...new Set(etat.cartes.map((c) => c.groupe).filter(Boolean))].sort(),
        liens: etat.liens,
        teintes: etat.teintes,
        // **Ce que chaque paquet a produit** (U7), lu dans les palettes comme le
        // serveur le lit : une palette dit de quel paquet elle est la lecture,
        // et on retourne la liste. Un double qui porterait un champ « sa
        // palette » sur le paquet prouverait un autre contrat — celui qu'on a
        // justement refusé, parce qu'un paquet n'a pas d'identité à lui.
        fabriques: Object.fromEntries(
          etat.palettes.flatMap((p) =>
            p.sources
              .filter((s) => s.genre === "images" && s.reference)
              .map((s) => [
                s.reference,
                {
                  palette: p.identifiant,
                  ...(etat.ambiances.find((a) => a.palette === p.identifiant)
                    ? {
                        ambiance: etat.ambiances.find(
                          (a) => a.palette === p.identifiant,
                        )!.identifiant,
                      }
                    : {}),
                },
              ]),
          ),
        ),
      })
    // **Le plan et les personnages arrivent ensemble**, comme la toile : le
    // double rend ce que le vrai serveur rend, sans les poses tenues — elles se
    // déduisent du plan, et les envoyer ferait une copie qui se périme.
    if (url === "/api/characters" && (!init?.method || init.method === "GET"))
      return rendre({
        projet: "bac-a-sable",
        plan: etat.plan,
        // **Les directions arrivent avec le plan**, comme le serveur les rend :
        // une case n'existe que par la direction qui la nomme (E10).
        ...etat.directions,
        personnages: etat.personnages,
        emplacements: etat.emplacements,
        pieces: etat.pieces,
      })

    // ── Les directions du jeu (E10) ───────────────────────────────────────
    //
    // **Le double rend la liste entière et son origine**, comme le serveur : ce
    // que l'écran prouve est qu'il montre d'où la liste vient et qu'il sait la
    // rendre à la vue.
    if (url === "/api/characters/directions/proposal")
      return rendre(etat.proposition ?? PROPOSITION_VIDE)
    if (url === "/api/characters/directions/reset" && init?.method === "POST") {
      etat.directions = { ...etat.directions, origine: "vue",
        directions: etat.directions.proposees }
      return rendre(etat.directions)
    }
    if (url === "/api/characters/directions" && init?.method === "POST") {
      etat.directions = {
        ...etat.directions,
        origine: "ici",
        directions: [
          ...etat.directions.directions,
          {
            identifiant: String(corps.nom).toLowerCase().replace(/\s+/g, "-"),
            nom: String(corps.nom),
            consigne: String(corps.consigne ?? ""),
          },
        ],
      }
      return rendre(etat.directions)
    }
    if (url.startsWith("/api/characters/directions/") && init?.method === "PUT") {
      const identifiant = url.slice("/api/characters/directions/".length)
      etat.directions = {
        ...etat.directions,
        origine: "ici",
        directions: etat.directions.directions.map((d) =>
          d.identifiant === identifiant ? { ...d, ...corps } : d,
        ),
      }
      return rendre(etat.directions)
    }
    if (url.startsWith("/api/characters/directions/") && init?.method === "DELETE") {
      const identifiant = url.slice("/api/characters/directions/".length)
      etat.directions = {
        ...etat.directions,
        origine: "ici",
        directions: etat.directions.directions.filter(
          (d) => d.identifiant !== identifiant,
        ),
      }
      return rendre(etat.directions)
    }
    if (url === "/api/characters/directions")
      return rendre(etat.directions)

    // ── La planche d'une pose (E13) ───────────────────────────────────────
    //
    // **Une lecture, et elle ne facture rien.** Le double rend ce que le serveur
    // rend — les cases, leur texte, la géométrie et les trois choix ; ce que
    // l'écran prouve est qu'il montre ce qu'il reçoit et qu'il arme les bonnes
    // directions dans la barre qui paie.
    if (url.includes("/sheet")) {
      if (!etat.planche)
        return {
          ok: false,
          status: 409,
          json: async () => ({
            raison: "cette chose ne tient pas cette pose",
            code: "refus",
          }),
        } as Response
      const pose = decodeURIComponent(url.split("pose=")[1] ?? "")
      return rendre({ ...etat.planche, pose, pose_nom: pose })
    }

    // ── Le calibrage (E17) ────────────────────────────────────────────────
    //
    // **Le double rend ce que le serveur rend** : les poses, leur boîte, la
    // hauteur commune et ce qu'elle coûte. Il ne rejoue pas le calcul — ce que
    // l'écran prouve est qu'il montre ce qu'il reçoit et qu'il envoie les bons
    // gestes.
    if (url.includes("/calibration")) {
      if (etat.refusCalibrage)
        return {
          ok: false,
          status: 409,
          json: async () => ({ raison: etat.refusCalibrage, code: "refus" }),
        } as Response
      const lu = etat.calibrage
      if (!lu) return rendre({ poses: [], commune: 0, cible: 64 })
      // Un `PUT` de mise de côté rend la liste avec la pose marquée : l'écran
      // fond ce qui lui arrive, comme partout.
      if (url.endsWith("/aside") && init?.method === "PUT") {
        const pose = url.slice(0, -"/aside".length).split("/").pop() ?? ""
        etat.calibrage = {
          ...lu,
          poses: lu.poses.map((p) =>
            p.pose === decodeURIComponent(pose)
              ? { ...p, de_cote: Boolean(corps.de_cote) }
              : p,
          ),
        }
        return rendre(etat.calibrage)
      }
      return rendre(lu)
    }

    // ── L'établi d'une pièce (E15) ────────────────────────────────────────
    if (url.endsWith("/wearers")) {
      const piece = decodeURIComponent(
        url.slice("/api/characters/pieces/".length, -"/wearers".length),
      )
      return rendre(
        etat.portees[piece] ?? {
          piece: etat.pieces.find((p) => p.identifiant === piece),
          portee: [],
          posee: 0,
          candidats: 0,
        },
      )
    }
    // ── La vitrine (E16) ──────────────────────────────────────────────────
    //
    // **Le double rend ce que le serveur rend** : les fonds du projet, les
    // images avec la taille qu'elles rendent vraiment, et la taille commune. Il
    // ne rejoue pas le calcul des couleurs — ce que l'écran prouve est qu'il
    // montre ce qu'il reçoit, aux multiples entiers et sans lissage.
    if (url.includes("/showcase")) {
      const seule = url !== "/api/characters/showcase"
      const identifiant = seule
        ? url.slice("/api/characters/".length, -"/showcase".length)
        : ""
      const choses = seule
        ? etat.personnages.filter((p) => p.identifiant === identifiant)
        : etat.personnages
      const images = choses.flatMap((chose) => {
        const tenues = chose.cases.flatMap((c) =>
          c.images.map((asset) => ({
            asset: asset.identifiant,
            pose: c.pose,
            chose: chose.nom,
            largeur: asset.rendu_largeur || asset.largeur,
            hauteur: asset.rendu_hauteur || asset.hauteur,
          })),
        )
        return seule ? tenues : tenues.slice(0, 1)
      })
      const commune = images.length
        ? images
            .map((i) => i.largeur)
            .sort(
              (a, b) =>
                images.filter((i) => i.largeur === b).length -
                images.filter((i) => i.largeur === a).length,
            )[0]
        : 0
      return rendre({
        personnage: identifiant,
        fonds: [
          {
            genre: "damier",
            couleur: "",
            raison:
              "ce qui est transparent — c'est le fond de la retouche, pas celui du jugement",
          },
          {
            genre: "noir",
            couleur: "#000000",
            raison: "proposé, d'après « surrounded by absolute blackness »",
          },
          {
            genre: "palette",
            couleur: "#c6b9a8",
            raison: "une couleur que le jeu emploie — le sujet s'y détache, ou non",
          },
        ],
        images: images.map((i) => ({ ...i, hors_taille: i.largeur !== commune })),
        taille_commune: commune,
        mouvement: {
          possible: false,
          raison: "aucune pose ne tient plus d'une image dans une direction",
        },
      })
    }
    // ── La fiche d'une chose du jeu (E12) ─────────────────────────────────
    //
    // **Le double compose l'habillage comme le serveur le compose** : les trois
    // couches dans l'ordre — le jeu, l'ambiance désignée, ce que la chose écrit
    // —, et le texte remplacé gardé à côté. Un double qui rendrait des origines
    // quelconques prouverait que l'écran affiche, jamais qu'il affiche juste.
    if (url.includes("/style") && url.startsWith("/api/characters/")) {
      const identifiant = url.slice("/api/characters/".length, -"/style".length)
      const chose = etat.personnages.find((p) => p.identifiant === identifiant)
      const ambiance = etat.ambiances.find((a) => a.identifiant === chose?.ambiance)
      const OUVERTS: Record<string, string> = {
        monde: "monde",
        eclairage: "eclairage",
        trait: "trait",
      }
      const champs = etat.univers.bible.map((c) => {
        const deLAmbiance = ambiance
          ? String((ambiance as unknown as Record<string, string>)[OUVERTS[c.nom]] ?? "")
          : ""
        const ecritIci = chose?.textes?.[c.nom] ?? ""
        const eteint = (chose?.eteints ?? []).includes(c.nom)
        const origine = eteint
          ? "eteint"
          : ecritIci
            ? "ici"
            : deLAmbiance
              ? "ambiance"
              : "jeu"
        return {
          nom: c.nom,
          texte: eteint ? "" : ecritIci || deLAmbiance || c.texte,
          origine,
          remplace:
            origine === "ici" || origine === "eteint"
              ? ecritIci && origine === "eteint"
                ? ecritIci
                : deLAmbiance || c.texte
              : "",
          ambiance: origine === "ambiance" ? (ambiance?.nom ?? "") : "",
          ouvert: c.nom in OUVERTS,
          annonce: /64x64/.test(c.texte) ? [64] : [],
        }
      })
      return rendre({
        personnage: identifiant,
        champs,
        ambiance: ambiance ?? null,
        prend: chose?.prend ?? "",
        cible_px: etat.univers.cible_px,
        desaccord: champs
          .filter((c) => c.annonce.some((t) => t !== etat.univers.cible_px))
          .map((c) => c.nom),
        palette: null,
        poses_ici: champs.filter(
          (c) => c.origine === "ici" || c.origine === "eteint",
        ).length,
        de_l_ambiance: champs.filter((c) => c.origine === "ambiance").length,
      })
    }
    if (url.includes("/references") && url.startsWith("/api/characters/")) {
      const identifiant = url.slice("/api/characters/".length, -"/references".length)
      const chose = etat.personnages.find((p) => p.identifiant === identifiant)
      if (init?.method === "PUT") {
        const promues = new Set(chose?.references ?? [])
        if (corps.promue === false) promues.delete(String(corps.asset))
        else promues.add(String(corps.asset))
        etat.personnages = etat.personnages.map((p) =>
          p.identifiant === identifiant ? { ...p, references: [...promues] } : p,
        )
      }
      const vive = etat.personnages.find((p) => p.identifiant === identifiant)
      // **De quoi montrer l'exemple** (R8). Le serveur joint l'objet entier à
      // la ligne — et `null` quand l'image a disparu du dépôt entre le moment
      // où la ligne a été composée et celui où on la regarde. Le double fait
      // les deux : une ligne orpheline reste, sans vignette.
      const deQuoiMontrer = (vise: string) => {
        const carte = etat.cartes.find((c) => c.identifiant === vise)
        if (carte) return { sorte: "carte", carte }
        const image = trouverAssetSiConnu(etat, vise)
        return image ? { sorte: "asset", asset: image } : null
      }
      const lignes = (vive?.references ?? []).map((reference) => ({
        reference,
        genre: "asset",
        provenance: "image promue",
        detail: "fabriquée puis retenue comme référence",
        ecartee: false,
        montre: deQuoiMontrer(reference),
      }))
      // **L'atelier propose le corps retenu de la première pose faite**, et
      // seulement s'il n'est pas déjà retenu : une proposition acceptée cesse
      // d'être une proposition.
      const corpsRetenu = (vive?.cases ?? []).find((c) => c.corps)?.corps ?? ""
      const propositions =
        corpsRetenu && !(vive?.references ?? []).includes(corpsRetenu)
          ? [
              {
                reference: corpsRetenu,
                genre: "asset",
                provenance: "le corps retenu de « repos »",
                detail: "ce à quoi il ressemble une fois passé par le style du jeu",
                ecartee: false,
                montre: deQuoiMontrer(corpsRetenu),
              },
            ]
          : []
      const references = {
        personnage: identifiant,
        lignes,
        propositions,
        disponibles: lignes.length,
      }
      // Le geste rend la chose **et** ses références : l'écran fond les deux
      // par le même chemin, comme partout ailleurs dans ce produit.
      return rendre(
        init?.method === "PUT" ? { personnage: vive, references } : references,
      )
    }
    // ── Le côté Ambiances et couleurs (E11) ───────────────────────────────
    //
    // **Le double rend le côté entier** à chaque geste, comme le vrai serveur :
    // une palette qui change peut en changer une autre — celle qui l'a prise
    // pour source —, et l'écran n'a pas à deviner laquelle. Un double qui n'en
    // rendrait que la moitié prouverait un autre contrat.
    if (url.startsWith("/api/moods") || url.startsWith("/api/palettes")) {
      const cote = () => ({
        projet: "bac-a-sable",
        palettes: etat.palettes,
        ambiances: etat.ambiances,
        du_jeu: etat.univers.palette,
      })
      if (url === "/api/moods" && (!init?.method || init.method === "GET"))
        return rendre(cote())
      if (url === "/api/moods" && init?.method === "POST") {
        etat.ambiances = [
          ...etat.ambiances,
          ambianceDouble(String(corps.nom), String(corps.palette ?? "")),
        ]
        return rendre(cote())
      }
      if (url === "/api/palettes" && init?.method === "POST") {
        // **Les sources sont gardées** : c'est par elles que le tableau sait de
        // quel paquet une palette est la lecture (U7). Un double qui les
        // jetterait rendrait une palette qui ne vient de nulle part, et l'îlot
        // qui l'a faite ne porterait jamais sa marque.
        etat.palettes = [
          ...etat.palettes,
          {
            ...paletteDouble(String(corps.nom)),
            sources: (corps.sources ?? []) as SourceDePalette[],
          },
        ]
        return rendre(cote())
      }
      // L'aperçu ne fabrique rien : deux images en `data:` et le compte de ce
      // qui sert. Le vrai serveur les calcule ; ce qui se prouve à l'écran est
      // qu'elles se montrent côte à côte.
      if (url.includes("/preview")) {
        const identifiant = url.slice("/api/palettes/".length, -"/preview".length)
        const palette = etat.palettes.find((p) => p.identifiant === identifiant)
        return rendre({
          palette: identifiant,
          couleurs: palette?.rendue ?? [],
          images: [
            {
              asset: "sujet",
              nom: "le nain",
              du_jeu: "data:image/png;base64,AAAA",
              de_la_palette: "data:image/png;base64,BBBB",
            },
          ],
          employees: (palette?.rendue ?? []).slice(0, 2),
        })
      }
      const identifiant = decodeURIComponent(
        url.slice(url.startsWith("/api/moods/") ? "/api/moods/".length : "/api/palettes/".length),
      ).split("?")[0]
      if (init?.method === "PUT" && url.startsWith("/api/moods/")) {
        etat.ambiances = etat.ambiances.map((a) =>
          a.identifiant === identifiant ? { ...a, ...corps } : a,
        )
        return rendre(cote())
      }
      if (init?.method === "PUT") {
        // **L'empreinte suit les couleurs, pas le nom** (U6). Le serveur la
        // fabrique de ce qui identifie les sources et des réglages ; renommer
        // ne la bouge pas, et c'est ce qui fait que l'aperçu ne se redemande
        // pas. Le double rejoue cette règle-là, sans quoi l'essai qui compte
        // les aperçus mesurerait une fiction.
        const touchePalette = ["sources", "couleurs", "du_jeu", "attraction", "retouches"]
          .some((champ) => champ in (corps as Record<string, unknown>))
        etat.palettes = etat.palettes.map((p) =>
          p.identifiant === identifiant
            ? {
                ...p,
                ...corps,
                empreinte: touchePalette
                  ? `${p.empreinte}+`
                  : p.empreinte,
                // Le serveur recalcule ; le double rejoue la seule règle que
                // l'écran lit — une pastille retirée reste dans la liste,
                // marquée, et sort du rendu.
                pastilles: p.pastilles.map((pastille) => ({
                  ...pastille,
                  retiree: ((corps.retouches ?? []) as RetoucheDePalette[]).some(
                    (r) => r.geste === "retirer" && r.couleur === pastille.couleur,
                  )
                    ? "retirer"
                    : "",
                })),
                attraction_inerte:
                  ((corps.sources ?? p.sources) as SourceDePalette[]).length < 2 ||
                  Number(corps.du_jeu ?? p.du_jeu) >= Number(corps.couleurs ?? p.couleurs),
              }
            : p,
        )
        return rendre(cote())
      }
      if (init?.method === "DELETE" && url.startsWith("/api/moods/")) {
        etat.ambiances = etat.ambiances.filter((a) => a.identifiant !== identifiant)
        return rendre({ ...cote(), retombees: 0 })
      }
      if (init?.method === "DELETE") {
        etat.palettes = etat.palettes.filter((p) => p.identifiant !== identifiant)
        etat.ambiances = etat.ambiances.map((a) =>
          a.palette === identifiant ? { ...a, palette: "" } : a,
        )
        return rendre(cote())
      }
    }
    // ── Ce que chaque type d'objet réclame (E9) ───────────────────────────
    //
    // **Le double rend la forme entière**, types et plan du jeu ensemble, comme
    // les trois gestes du plan juste en dessous : l'écran fond ce qui lui
    // arrive par les deux chemins avec le même code, et un double qui n'en
    // rendrait que la moitié prouverait un autre contrat.
    if (url.startsWith("/api/characters/types")) {
      const posesDesTypes = () => ({ types: etat.types, plan: etat.plan })
      if (!init?.method || init.method === "GET") return rendre(posesDesTypes())
      const nom = decodeURIComponent(
        url.slice("/api/characters/types/".length, -"/poses".length),
      )
      if (init.method === "PUT") {
        etat.types = etat.types.map((t: PosesDesTypes["types"][number]) =>
          t.nom === nom
            ? { ...t, poses: (corps.poses ?? []) as Pose[], origine: "écrite" }
            : t,
        )
        return rendre(posesDesTypes())
      }
      if (init.method === "DELETE") {
        // Oublier, c'est revenir à ce qu'on proposait — jamais vider.
        etat.types = etat.types.map((t: PosesDesTypes["types"][number]) =>
          t.nom === nom
            ? { ...t, poses: t.connues, origine: t.connues.length ? "connue" : "connue" }
            : t,
        )
        return rendre(posesDesTypes())
      }
    }
    if (url.startsWith("/api/characters")) {
      // ── Le vestiaire (C3) ─────────────────────────────────────────────────
      //
      // **Les six gestes rendent le vestiaire entier**, comme le vrai serveur :
      // l'écran fond ce qui lui arrive par les deux chemins avec le même code,
      // et un double qui n'en rendrait que la moitié prouverait un autre
      // contrat. C'est la leçon payée en C1, appliquée d'avance.
      const vestiaire = () => ({
        projet: "bac-a-sable",
        emplacements: etat.emplacements,
        pieces: etat.pieces,
      })
      if (url === "/api/characters/slots" && init?.method === "POST") {
        const emplacement: EmplacementCorps = {
          identifiant: String(corps.nom).toLowerCase().replace(/\s+/g, "-"),
          nom: String(corps.nom),
          rang: etat.emplacements.length,
        }
        etat.emplacements = [...etat.emplacements, emplacement]
        return rendre({ emplacement, ...vestiaire() })
      }
      if (url === "/api/characters/pieces" && init?.method === "POST") {
        // **Nommer, c'est créer — jusqu'au bout** : l'emplacement écrit ici est
        // créé s'il n'existe pas, comme le fait le serveur. Sans ça, l'essai
        // prouverait que l'écran envoie le nom, jamais que le nom suffit.
        const ou = String(corps.emplacement ?? "").trim()
        let emplacement = etat.emplacements.find(
          (e) => e.nom.toLowerCase() === ou.toLowerCase(),
        )
        if (ou && !emplacement) {
          emplacement = {
            identifiant: ou.toLowerCase().replace(/\s+/g, "-"),
            nom: ou,
            rang: etat.emplacements.length,
          }
          etat.emplacements = [...etat.emplacements, emplacement]
        }
        const piece: Piece = {
          identifiant: String(corps.nom).toLowerCase().replace(/\s+/g, "-"),
          nom: String(corps.nom),
          description: String(corps.description ?? ""),
          emplacement: emplacement?.identifiant ?? "",
          // **Le défaut est « contenue »**, et il vient du serveur : l'écran ne
          // l'écrit nulle part, et rien ne le devine du nom de la pièce.
          portee: (corps.portee as Piece["portee"]) ?? "contenue",
          concept_arts: [],
        }
        etat.pieces = [...etat.pieces, piece]
        return rendre({ piece, ...vestiaire() })
      }
      if (init?.method === "PUT" && url.startsWith("/api/characters/pieces/")) {
        const identifiant = url.slice("/api/characters/pieces/".length)
        etat.pieces = etat.pieces.map((p) =>
          p.identifiant === identifiant ? { ...p, ...corps } : p,
        )
        return rendre({
          piece: etat.pieces.find((p) => p.identifiant === identifiant),
          ...vestiaire(),
        })
      }
      if (init?.method === "DELETE" && url.startsWith("/api/characters/pieces/")) {
        const identifiant = url.slice("/api/characters/pieces/".length)
        const piece = etat.pieces.find((p) => p.identifiant === identifiant)
        etat.pieces = etat.pieces.filter((p) => p.identifiant !== identifiant)
        return rendre({ piece, ...vestiaire() })
      }
      if (url === "/api/characters" && init?.method === "POST") {
        const cree = personnage(String(corps.nom))
        etat.personnages = [...etat.personnages, cree]
        return rendre({ personnage: cree })
      }
      // **Le sujet qu'une case arme, composé par le serveur** (C5). Le double
      // rejoue ses trois règles, parce que c'est le contrat qu'il double : une
      // case porte le signalement et l'attitude, un lot le signalement seul, et
      // une pièce sa description seule. Un double qui rendrait un texte
      // quelconque prouverait que l'écran demande, jamais qu'il pose ce que le
      // serveur a écrit.
      if (url === "/api/characters/subject" && init?.method === "POST") {
        const qui = etat.personnages.find(
          (p) => p.identifiant === String(corps.personnage),
        )
        const quoi = etat.pieces.find((p) => p.identifiant === corps.piece)
        // **Le signalement, et lui seul** (E14). L'attitude et l'angle sont des
        // lignes à part, composées par le chemin de l'envoi, avec leur propre
        // origine et leur propre interrupteur : les coller ici obligerait
        // l'écran de confirmation à deviner où finit l'un et où commence
        // l'autre.
        const sujet = quoi
          ? quoi.description.trim() || quoi.nom
          : (qui?.description.trim() ?? "")
        return rendre({ sujet })
      }
      // **La sortie d'un personnage** (C5) : aucun octet ne revient, seulement
      // les chemins de ce qui vient d'être posé. Le double n'écrit rien — il
      // n'a pas de disque —, mais il rend la forme entière, parce que c'est
      // elle que l'écran affiche.
      if (init?.method === "POST" && url.endsWith("/export")) {
        const identifiant = url.slice(
          "/api/characters/".length,
          -"/export".length,
        )
        const qui = etat.personnages.find((p) => p.identifiant === identifiant)
        const remplies = (qui?.cases ?? []).filter((c) => c.corps)
        // Les deux refus du serveur, dans l'ordre où il les oppose : rien à
        // sortir d'abord, pas de dossier ensuite. L'écran grise avant d'en
        // arriver là — c'est justement ce qu'on vérifie —, mais un double qui
        // ne saurait pas refuser laisserait passer un écran qui n'a pas grisé.
        const dossier = etat.agent.garde_fous.dossier_jeu
        if (remplies.length === 0 || !dossier)
          return {
            ok: false,
            status: 409,
            json: async () => ({
              code: remplies.length === 0 ? "export_refuse" : "depot_refuse",
              raison:
                remplies.length === 0
                  ? `« ${qui?.nom} » n'a aucune pose remplie — il n'y a rien à sortir`
                  : "aucun dossier de jeu — nomme-le dans l'appel, ou pose-le une fois pour toutes dans l'atelier, écran Réglages, bloc « L'agent ».",
              ou_aller: remplies.length === 0 ? null : "reglages",
            }),
          } as unknown as Response
        const fichiers = remplies.map((c) => ({
          chemin: `${dossier}/${identifiant}-${c.pose}.png`,
          fichier: `${identifiant}-${c.pose}.png`,
          role: "corps" as const,
          pose: { identifiant: c.pose, nom: c.pose },
          piece: null,
        }))
        return rendre({
          dossier,
          fichiers,
          descriptif: `${dossier}/${identifiant}-descriptif.json`,
          compte: fichiers.length,
        })
      }
      if (url === "/api/characters/poses" && init?.method === "POST") {
        const neuve: Pose = pose(
          String(corps.nom).toLowerCase().replace(/\s+/g, "-"),
          String(corps.nom),
          String(corps.consigne ?? ""),
          Number(corps.images ?? 1),
        )
        etat.plan = [...etat.plan, neuve]
        // La case neuve paraît chez chacun sans qu'aucun personnage soit
        // réécrit : c'est le plan qui décide, le personnage ne fait que
        // soustraire. Le double le rejoue, sinon l'essai prouverait un contrat
        // qui n'est pas celui du serveur.
        // **Chez ceux qui suivent le jeu, et chez eux seuls** (E9) : une chose
        // qui porte un type a sa propre liste, et une attitude ajoutée au plan
        // du jeu ne doit pas y faire paraître de case vide.
        etat.personnages = etat.personnages.map((p) =>
          p.type
            ? p
            : {
                ...p,
                plan: [...p.plan, neuve],
                cases: [
                  ...p.cases,
                  {
                    pose: neuve.identifiant,
                    demandees: neuve.images,
                    images: [],
                    ...VIDE_C3,
                  },
                ],
              },
        )
        // **Le plan entier avec la pose**, comme le vrai serveur : l'écran fond
        // ce qui lui arrive par les deux chemins avec le même code, et un double
        // qui n'en rendrait que la moitié prouverait un autre contrat.
        return rendre({ pose, plan: etat.plan })
      }
      if (init?.method === "PUT" && url.startsWith("/api/characters/poses/")) {
        const identifiant = url.slice("/api/characters/poses/".length)
        etat.plan = etat.plan.map((p) =>
          p.identifiant === identifiant ? { ...p, ...corps } : p,
        )
        return rendre({
          pose: etat.plan.find((p) => p.identifiant === identifiant),
          plan: etat.plan,
        })
      }
      if (init?.method === "DELETE" && url.startsWith("/api/characters/poses/")) {
        const identifiant = url.slice("/api/characters/poses/".length)
        const pose = etat.plan.find((p) => p.identifiant === identifiant)
        etat.plan = etat.plan.filter((p) => p.identifiant !== identifiant)
        return rendre({ pose, plan: etat.plan })
      }
      if (init?.method === "PUT") {
        const identifiant = url.slice("/api/characters/".length)
        // Le serveur reçoit les poses **tenues** et range le complément : le
        // double fait la même chose, sinon l'essai prouverait un contrat qui
        // n'est pas celui du serveur.
        etat.personnages = etat.personnages.map((p) =>
          p.identifiant === identifiant
            ? {
                ...p,
                ...(corps.nom !== undefined ? { nom: String(corps.nom) } : {}),
                ...(corps.description !== undefined
                  ? { description: String(corps.description) }
                  : {}),
                ...(corps.poses !== undefined
                  ? {
                      ecartees: etat.plan
                        .map((pose) => pose.identifiant)
                        .filter((pose) => !corps.poses.includes(pose)),
                      cases: etat.plan
                        .filter((pose) => corps.poses.includes(pose.identifiant))
                        .map((pose) => ({
                          pose: pose.identifiant,
                          demandees: pose.images,
                          images:
                            p.cases.find((c) => c.pose === pose.identifiant)?.images ??
                            [],
                          ...VIDE_C3,
                        })),
                    }
                  : {}),
                ...(corps.concept_arts !== undefined
                  ? { concept_arts: corps.concept_arts }
                  : {}),
              }
            : p,
        )
        return rendre({
          personnage: etat.personnages.find((p) => p.identifiant === identifiant),
        })
      }
      if (init?.method === "DELETE") {
        const identifiant = url.slice("/api/characters/".length)
        const personnage = etat.personnages.find((p) => p.identifiant === identifiant)
        etat.personnages = etat.personnages.filter(
          (p) => p.identifiant !== identifiant,
        )
        return rendre({ personnage, images: 0 })
      }
    }
    // La case qu'une image remplit (US-122). Le double rend l'asset entier,
    // comme le vrai serveur — et il l'annonce, parce que c'est cette annonce qui
    // fait redemander les cases à l'écran.
    if (url.endsWith("/character") && init?.method === "PUT") {
      const identifiant = url.slice("/api/assets/".length, -"/character".length)
      const trouve = etat.assets.find((a) => a.identifiant === identifiant)
      const rendu = {
        ...(trouve ?? asset(identifiant)),
        personnage: corps.personnage ?? null,
        pose: corps.pose ?? null,
      }
      etat.assets = etat.assets.map((a) =>
        a.identifiant === identifiant ? rendu : a,
      )
      return rendre(rendu)
    }
    // **Le double pose ce qu'on lui règle, et rend l'univers entier** — comme
    // le vrai serveur, et comme le cadre de l'agent juste au-dessus. Un double
    // qui rendait toujours l'univers de départ laissait passer R1 : un essai
    // pouvait vérifier que l'écran avait bien appelé la route, jamais ce qu'il
    // affichait **après**. C'est exactement le trou par lequel le défaut est
    // arrivé jusqu'à l'usage.
    if (url.startsWith("/api/universe")) {
      if (init?.method === "PUT") {
        const pose = Object.fromEntries(
          Object.entries(corps ?? {}).filter(([, v]) => v !== undefined && v !== null),
        )
        etat.univers = { ...etat.univers, ...pose }
      }
      // **La proposition de fond voyage avec l'univers** (D3), en lecture et en
      // écriture : régler le fond doit rendre la proposition *à jour*, sans que
      // l'écran ait à redemander. Le double la rend donc sur les deux verbes,
      // comme la vraie route.
      return rendre({
        projet: "bac-a-sable",
        univers: etat.univers,
        artworks: [],
        fond_propose: options.fondPropose ?? {
          couleur: "#FF00FF",
          nom: "magenta",
          ecart: 192,
          voisine: "#C0C0C0",
          raison: null,
        },
      })
    }
    if (url === "/api/generations" && init?.method === "POST") {
      const g = options.aPublier?.() ?? generation("zzzz0000", 1, "en_cours")
      FluxDouble.ouverts.at(-1)?.emettre("generation", g)
      return rendre(g)
    }
    // **L'auteur tranche sur une planche qui attend, et elle se déplie** (R6).
    // Le double rend ce que le vrai serveur rend : la même génération, la
    // décision écrite, et la question refermée. Il ne repaie rien — et c'est
    // très exactement ce que les essais vérifient en comptant les appels.
    if (url.endsWith("/unfold") && init?.method === "POST") {
      const lot = options.aPublier?.() ?? generation("zzzz0000", 1, "reussie")
      return rendre({
        ...lot,
        pliage: lot.pliage
          ? {
              ...lot.pliage,
              ecartees: (corps?.ecartees as number[]) ?? [],
              attend_un_choix: false,
            }
          : null,
      })
    }
    // Une génération relue — le quatrième rôle de la réinjection, celui qui
    // n'envoie aucune image (US-12). Son `prompt` est **ce qui est parti** :
    // bible repliée en tête comprise, comme le vrai serveur l'enregistre.
    if (url.startsWith("/api/generations/") && init?.method === undefined) {
      const relue = options.aPublier?.() ?? generation("zzzz0000", 1, "reussie")
      return rendre({
        ...relue,
        demande: {
          ...relue.demande,
          prompt: options.promptParti ?? relue.demande.prompt,
        },
      })
    }
    return rendre({})
  })

  return { fetchDouble, appels, etat }
}

const tuiles = () => screen.queryAllByRole("button", { name: "Ouvrir la fiche" })

async function monter(fetchDouble: ReturnType<typeof vi.fn>, etat: Etat = ETAT) {
  vi.stubGlobal("fetch", fetchDouble)
  render(<App />)
  await waitFor(() => expect(FluxDouble.ouverts.length).toBe(1))
  FluxDouble.ouverts[0].emettre("etat", etat)
  return FluxDouble.ouverts[0]
}

/** Le cadre de l'onglet ouvert, **et borné à lui**.
 *
 *  Avant la V2.1, l'écran se prenait par son titre : chaque surface portait un
 *  en-tête de 44 px avec son nom dedans. Les trois onglets partagent une seule
 *  barre, et ces titres n'existent plus — le cadre se prend donc par la marque
 *  que l'onglet pose sur lui, `data-univers`, qui existait déjà pour que le
 *  garde de saisie sache dans quel champ on écrit.
 *
 *  Le bornage reste indispensable pour la raison inverse d'avant : la galerie
 *  ne se **rend** plus derrière, mais une assertion posée sur tout le document
 *  trouverait la barre du châssis et la barre d'état, qui sont à tout le monde. */
/** Le champ de prompt, **et l'écran d'où l'on paie**.
 *
 *  Depuis E2 il n'existe qu'un seul champ de saisie dans le produit, et il vit
 *  au pied des deux lieux d'où l'argent part : le codex et l'établi d'une
 *  chose. La galerie n'en a plus — on y juge, on n'y paie jamais. Le raccourci
 *  va donc le chercher là où il est, sans que chaque essai ait à savoir par
 *  quel onglet il passe. */
async function champDePrompt() {
  const deja = screen.queryByPlaceholderText("Décris ce que tu veux fabriquer.")
  if (deja) return deja
  fireEvent.click(screen.getByRole("tab", { name: "Codex" }))
  return await champDePrompt()
}

/** Écrire un sujet dans le champ qui paie, **après que l'atelier a fini de le
 *  remplir lui-même**.
 *
 *  Armer une case demande son signalement au serveur et le pose dans le champ.
 *  Une chose sans signalement y pose une chaîne vide — et si l'on tapait avant
 *  que la réponse revienne, elle écraserait ce qu'on vient d'écrire. On attend
 *  donc que le bouton soit revenu à son refus habituel, « aucun prompt », qui
 *  est la preuve que le champ a fini de bouger. */
async function ecrireLeSujet(texte: string) {
  const champ = (await champDePrompt()) as HTMLTextAreaElement
  // La provenance et le texte sont posés dans le même geste : la voir paraître
  // est la preuve que la réponse est arrivée, et donc que plus rien ne viendra
  // écraser ce qu'on va taper.
  await screen.findByText(/proposé, d'après/)
  fireEvent.change(champ, { target: { value: texte } })
  await waitFor(() => expect(champ.value).toBe(texte))
  return champ
}

/** Payer, du bouton jusqu'à la dépense — **deux gestes depuis E14**.
 *
 *  Le bouton de la barre qui paie ne dépense plus : il fait relire. L'écran de
 *  confirmation s'intercale, et c'est son bouton qui appelle. Les essais qui
 *  regardent ce qui part traversent donc les deux, comme l'auteur. */
async function payer() {
  fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
  const bouton = await screen.findByRole("button", { name: /^Payer et lancer/ })
  fireEvent.click(bouton)
}

/** Ouvrir l'écran de confirmation, et s'y arrêter — pour ce qu'on y lit.
 *
 *  Rend l'écran **borné**, et non le document : la barre du châssis et la barre
 *  d'état restent rendues derrière, et une assertion posée sur tout le document
 *  les trouverait. */
async function relire() {
  fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
  await screen.findByRole("button", { name: /^Payer et lancer/ })
  return within(document.querySelector("[data-envoi]") as HTMLElement)
}

/** L'établi d'une chose du jeu — **la profondeur du codex**.
 *
 *  Depuis E2, ouvrir le codex montre ce que le monde contient ; la matrice
 *  d'une chose est un étage plus bas, et l'on y descend en cliquant son nom.
 *  Sans nom, on reste au codex : c'est le cas d'un monde vide, et l'essai qui
 *  le vise n'a rien à ouvrir.
 *
 *  Le cadre reste borné à l'écran ouvert, comme avant : une assertion posée sur
 *  tout le document trouverait la barre du châssis et la barre d'état. */
async function ouvrirLEtabli(nom?: string) {
  fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
  // La rubrique ouverte survit d'un essai à l'autre dans un même écran : on
  // revient d'abord aux choses du jeu, sans quoi le nom cherché n'est pas
  // rendu.
  const familles = document.querySelector("[data-codex]")
  if (familles) {
    const rangee = within(familles as HTMLElement).queryByRole("button", {
      name: /^Personnages/,
    })
    if (rangee) fireEvent.click(rangee)
  }
  const cadre = await cadreDuCodex()
  const noms = within(cadre).queryAllByRole("button", { name: nom })
  const premier = nom
    ? noms[0]
    : within(cadre)
        .queryAllByRole("article")
        .map((a) => a.querySelector("button"))
        .filter(Boolean)[0]
  if (premier) {
    fireEvent.click(premier)
    return within(
      await waitFor(() => {
        const etabli = document.querySelector("[data-etabli]")
        if (!etabli) throw new Error("l'établi ne s'est pas ouvert")
        return etabli as HTMLElement
      }),
    )
  }
  return within(cadre)
}

/** Une rubrique de la colonne du codex — les poses, l'équipement, une famille.
 *
 *  Les deux listes que le jeu impose à plusieurs — le plan de poses, le
 *  vestiaire — vivaient dans la colonne de gauche de l'écran des personnages.
 *  Elles sont montées dans le codex avec E2, parce qu'elles ne sont la colonne
 *  de personne en particulier. */
async function ouvrirLaRubrique(nom: string) {
  fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
  const cadre = await cadreDuCodex()
  fireEvent.click(within(cadre).getByRole("button", { name: new RegExp(`^${nom}`) }))
  return within(cadre)
}

/** Les réglages de l'appel, dépliés.
 *
 *  Ils tenaient une colonne de 300 px ouverte en permanence dans la galerie ;
 *  ils suivent la barre qui paie depuis E4, repliés sur une ligne qui dit ce
 *  qu'ils valent. Les ouvrir est un geste de plus dans chaque essai, et c'est
 *  le prix de ne plus les avoir sous les yeux quand on juge une image. */
async function ouvrirLesReglagesDeLAppel() {
  await champDePrompt()
  const ligne = await screen.findByRole("button", { name: /réglages de l'appel/ })
  if (ligne.getAttribute("aria-expanded") !== "true") fireEvent.click(ligne)
}

/** Revenir à la galerie — là où ce qui a été produit se regarde.
 *
 *  **Le nom de l'onglet n'est pas toujours « Galerie » tout court** : tant que
 *  des images sont en route, il porte leur compte, et c'est délibéré — le champ
 *  de prompt n'est rendu que sur la galerie, donc depuis l'Univers ou le Codex
 *  cet onglet est le seul endroit qui dise qu'on a payé. */
function laGalerie() {
  fireEvent.click(screen.getByRole("tab", { name: /^Galerie/ }))
}

async function cadreDuCodex() {
  return await waitFor(() => {
    const cadre = document.querySelector("[data-codex], [data-etabli], [data-univers]")
    if (!cadre) throw new Error("aucun onglet en profondeur n'est monté")
    return cadre as HTMLElement
  })
}

/** Ouvrir l'onglet Univers **et son côté Réglages**.
 *
 *  Depuis E7, l'onglet a trois côtés et le premier est Inspiration : les cinq
 *  blocs de réglage du jeu ne sont plus sous la main dès qu'on ouvre l'onglet.
 *  Le raccourci existe pour ça, et il dit en un mot ce que chaque essai
 *  cherchait vraiment — non pas *l'onglet Univers*, mais *les réglages du jeu*.
 *
 *  Les deux « Réglages » du produit ne se confondent pas : celui du châssis est
 *  un bouton, celui-ci est un côté, donc un onglet. */
async function ouvrirLesReglagesDuJeu(etape: string) {
  fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
  fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
  fireEvent.click(await screen.findByRole("button", { name: etape }))
}


describe("l'écran de l'atelier", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    // Le repli des blocs vit dans le châssis, pas dans un écran — il survit
    // donc au démontage, ce qui est voulu d'une image à l'autre et faux d'un
    // essai à l'autre.
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── T1 : le croisement des deux chemins ───────────────────────────────────

  test("une génération annoncée par le flux **et** rendue par le POST n'apparaît qu'une fois", async () => {
    const lancee = generation("aaaa1111", 2, "en_cours")
    const { fetchDouble } = serveurDouble({ aPublier: () => lancee })
    await monter(fetchDouble)

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await payer()

    // **On paie d'un côté, on regarde de l'autre.** La galerie est la planche
    // contact du produit ; c'est là que ce qui sort se juge.
    laGalerie()

    // Deux emplacements, donc deux tuiles — jamais quatre.
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // Et les faits qui suivent ne rajoutent rien : ils remplacent.
    FluxDouble.ouverts[0].emettre("generation", generation("aaaa1111", 2, "reussie"))
    await waitFor(() => expect(tuiles()).toHaveLength(2))
  })

  test("le message d'état fait autorité sur la grille, il ne s'y ajoute pas", async () => {
    const { fetchDouble } = serveurDouble()
    const deja = asset("cccc3333-0")
    await monter(fetchDouble, { ...ETAT, assets: [deja] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    FluxDouble.ouverts[0].emettre("etat", { ...ETAT, assets: [deja] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })

  test("sans prompt, générer est inactif et dit pourquoi", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    // Le bouton qui paie vit là où l'on paie — au pied du codex, jamais dans
    // la galerie, où l'on juge (E2).
    await champDePrompt()

    const bouton = await screen.findByRole("button", { name: /^Générer/ })
    expect(bouton).toBeDisabled()
    expect(screen.getByText("aucun prompt")).toBeTruthy()
  })

  // ── T3 : « une bibliothèque vide invite à écrire un prompt » ───────────────

  test("une bibliothèque vide invite à écrire, un filtre sans résultat offre d'en sortir", async () => {
    const { fetchDouble, etat } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, assets: [] })

    // Bibliothèque vide : l'invitation, et rien d'autre (US-35).
    expect(await screen.findByText(/Rien n'est encore sorti d'ici/)).toBeTruthy()

    // Une image arrive : l'invitation cède la place.
    etat.assets.push(asset("dddd4444-0", "un coffre"))
    FluxDouble.ouverts[0].emettre("asset", asset("dddd4444-0", "un coffre"))
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // Un filtre qui ne trouve rien est une **impasse**, et une impasse porte le
    // geste qui en sort — sinon la grille est muette au moment où elle devrait
    // aider (US-34).
    fireEvent.change(screen.getByLabelText("Chercher dans la bibliothèque"), {
      target: { value: "dragon" },
    })
    await waitFor(() => expect(tuiles()).toHaveLength(0))
    expect(screen.getByText(/Rien ne répond à ce filtre/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Retirer le filtre/ }))
    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })

  // ── T3 : « la fiche s'ouvre en panneau latéral et se ferme sur la position,
  //     le filtre et le prompt d'avant » ──────────────────────────────────────

  test("la fiche s'ouvre en panneau et se referme sur le prompt et le filtre d'avant", async () => {
    const { fetchDouble } = serveurDouble({
      assets: [asset("eeee5555-0", "un tonneau"), asset("eeee5555-1", "un tonneau")],
    })
    await monter(fetchDouble, {
      ...ETAT,
      assets: [asset("eeee5555-0", "un tonneau"), asset("eeee5555-1", "un tonneau")],
    })

    // **Le prompt s'écrit là où l'on paie, la fiche s'ouvre là où l'on juge**
    // (E2) : les deux vivent désormais sur deux onglets. L'essai en devient
    // plus exigeant qu'avant — il faut que le texte survive à un aller-retour
    // entre les deux, alors qu'un onglet quitté se **démonte** depuis E1.
    fireEvent.change(await champDePrompt(), {
      target: { value: "un prompt en cours d'écriture" },
    })

    laGalerie()
    fireEvent.change(await screen.findByLabelText("Chercher dans la bibliothèque"), {
      target: { value: "tonneau" },
    })
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    fireEvent.click(tuiles()[0])
    const fermer = await screen.findByLabelText("Fermer la fiche")

    // Le panneau s'ajoute, il ne recouvre rien : la grille est toujours là.
    expect(tuiles()).toHaveLength(2)

    fireEvent.click(fermer)
    await waitFor(() =>
      expect(screen.queryByLabelText("Fermer la fiche")).toBeNull(),
    )

    // « Se retrouver exactement où l'on était » (US-37) : le filtre, la grille
    // qu'il donne, et le prompt de l'autre onglet.
    expect(
      (screen.getByLabelText("Chercher dans la bibliothèque") as HTMLInputElement).value,
    ).toBe("tonneau")
    expect(tuiles()).toHaveLength(2)
    expect(((await champDePrompt()) as HTMLTextAreaElement).value).toBe(
      "un prompt en cours d'écriture",
    )
  })

  // ── C1 : « la fiche de n'importe quel asset nomme le modèle qui l'a
  //     produit — le modèle exact pour une image générée, "importé" pour une
  //     image importée » (US-123) ─────────────────────────────────────────────

  test("la fiche nomme le modèle qui a produit l'image, et « importé » quand il n'y en a pas", async () => {
    const images = [
      asset("eeee5555-0", "un tonneau", "auteur", "essai:rend-du-png"),
      asset("eeee5555-1", "un voisin", "auteur", "import"),
    ]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // L'identifiant exact du fournisseur, pas le nom du catalogue : c'est lui
    // qu'on redemande, et il reste vrai quand le catalogue est hors ligne.
    //
    // **Le fournisseur y est, et il y reste** (F1) : le deux-points de
    // l'identifiant se lit comme un point médian, et la moitié gauche est très
    // exactement ce qui répond à *à qui redemander*. Le titre du champ, lui,
    // porte l'identifiant tel quel — celui qu'on retape.
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    expect(screen.getByText("essai · rend-du-png")).toBeTruthy()
    expect(screen.getByTitle("essai:rend-du-png")).toBeTruthy()

    // Une image importée n'a pas de modèle, et son absence est une réponse.
    fireEvent.click(screen.getByLabelText("Fermer la fiche"))
    await waitFor(() => expect(screen.queryByLabelText("Fermer la fiche")).toBeNull())
    fireEvent.click(tuiles()[1])
    await screen.findByLabelText("Fermer la fiche")
    expect(screen.getByText("importé")).toBeTruthy()
    expect(screen.queryByText("import")).toBeNull()
  })

  // ── T3 : « replier un panneau est un choix, jamais une contrainte » ────────

  test("la colonne qui range se replie par choix, et la grille ne bouge pas", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("ffff6666-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("ffff6666-0")] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    const arbre = screen.getByRole("button", { name: "arbre" })
    // **Une seule colonne repliable depuis E4** : celle des réglages est partie
    // avec ce qui paie, et la galerie ne paie plus.
    expect(screen.queryByRole("button", { name: "réglages" })).toBeNull()

    // Déployée d'emblée : l'écran large est la ressource du produit (US-97).
    expect(arbre.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(arbre)
    expect(arbre.getAttribute("aria-pressed")).toBe("false")
    // Replier n'est pas fermer : la grille n'a pas bougé de contenu.
    expect(tuiles()).toHaveLength(1)

    fireEvent.click(arbre)
    expect(arbre.getAttribute("aria-pressed")).toBe("true")
  })

  // ── T3 : « chaque suppression offre une annulation courte » ────────────────

  test("supprimer sort la tuile de la grille, et l'annulation l'y remet", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("9999aaaa-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("9999aaaa-0")] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])

    fireEvent.click(await screen.findByLabelText("Supprimer la sélection"))
    await waitFor(() => expect(tuiles()).toHaveLength(0))

    // L'annulation se pose dans la barre d'outils, dans la forme de la fente
    // sous Générer — jamais un bandeau en travers de la grille.
    const annuler = await screen.findByRole("button", { name: /Annuler/ })
    fireEvent.click(annuler)
    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })

  // ── T3 : un asset annoncé qui n'est plus d'ici quitte la grille ───────────

  test("un asset détaché de son projet quitte la grille du projet ouvert", async () => {
    // Vu au navigateur, pas au banc : supprimer un projet **détache** ses assets
    // (US-30), chaque détachement est annoncé sur le flux, et les détachés
    // venaient s'installer dans la grille du projet ouvert — qui n'est pas le
    // leur. La grille montrait alors plus d'images que la bibliothèque n'en
    // comptait, et l'arbre disait l'inverse de la grille.
    const { fetchDouble } = serveurDouble({ assets: [asset("8888bbbb-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("8888bbbb-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    FluxDouble.ouverts[0].emettre("asset", {
      ...asset("8888bbbb-0"),
      projet: null,
    })
    await waitFor(() => expect(tuiles()).toHaveLength(0))
  })

  // ── T3 : le chantier, et ce qui n'entre jamais en bibliothèque ─────────────

  test("un emplacement raté porte sa raison et son relancer, sans entrer en bibliothèque", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble, {
      ...ETAT,
      generations: [generation("bbbb2222", 1, "echouee", "crédit épuisé")],
      assets: [],
    })

    // Il tient sa place dans la grille — « l'échec atterrit à l'endroit précis
    // où le succès serait arrivé » — mais la bibliothèque, elle, reste vide.
    expect(await screen.findByText("crédit épuisé")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Relancer" })).toBeTruthy()
    expect(screen.getByText("0 image")).toBeTruthy()
  })

  // ── T4 : coller une adresse fait paraître une carte **avant** l'image ──────

  test("coller une adresse fait paraître une carte en attente, et on continue à coller", async () => {
    // Le critère dit « en moins d'une seconde, avant que l'image ne soit
    // récupérée, et on continue à coller pendant ce temps ». Ce que l'écran
    // doit tenir, ce n'est pas un délai — c'est que **rien n'attend le serveur
    // d'en face** : la carte est écrite et annoncée avant que la récupération
    // ne parte, et la suivante n'attend pas la première.
    const { fetchDouble } = serveurDouble()
    const flux = await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    expect(await screen.findByText("Le tableau est vide.")).toBeTruthy()

    flux.emettre(
      "carte",
      carteImage("url-1", {
        statut: "attente",
        montrable: false,
        source: "https://exemple.test/planche.png",
      }),
    )
    expect(await screen.findByText("en attente…")).toBeTruthy()
    expect(screen.getByText("https://exemple.test/planche.png")).toBeTruthy()

    // La seconde arrive sans que la première ait abouti : deux cartes, dont une
    // qui attend encore.
    flux.emettre(
      "carte",
      carteImage("url-2", {
        statut: "attente",
        montrable: false,
        source: "https://exemple.test/seconde.png",
      }),
    )
    await waitFor(() => expect(screen.getAllByText("en attente…")).toHaveLength(2))

    // Puis la première aboutit — et elle **remplace** la carte en attente, sous
    // la même clé. Elle ne s'ajoute pas à côté d'elle.
    flux.emettre("carte", carteImage("url-1", { source: "https://exemple.test/planche.png" }))
    await waitFor(() => expect(screen.getAllByText("en attente…")).toHaveLength(1))
  })

  test("une récupération qui échoue garde son adresse, sa raison, et son geste", async () => {
    const { fetchDouble } = serveurDouble()
    const flux = await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    await screen.findByText("Le tableau est vide.")

    flux.emettre(
      "carte",
      carteImage("url-3", {
        statut: "echouee",
        montrable: false,
        source: "https://exemple.test/absente.png",
        raison: "l'adresse a répondu 404",
      }),
    )
    expect(await screen.findByText("pas arrivée")).toBeTruthy()
    expect(screen.getByText("l'adresse a répondu 404")).toBeTruthy()
    expect(screen.getByText("https://exemple.test/absente.png")).toBeTruthy()

    // Le geste de réessayer est **dans la carte**, et il n'est proposé que là :
    // rien ne se relance tout seul.
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la carte" }))
    expect(await screen.findByRole("button", { name: "Réessayer ›" })).toBeTruthy()
  })

  // ── T4 : la palette se recalcule, et **le changement se voit** ─────────────

  test("promouvoir un artwork montre la palette, et la retirer la fait changer à l'œil", async () => {
    const { fetchDouble } = serveurDouble({ cartes: [carteImage("planche")] })
    const flux = await monter(fetchDouble)
    await ouvrirLesReglagesDuJeu("Références et couleurs")

    // **Une étape est un écran** : elle s'ouvre entière, et il n'y a plus rien
    // à déplier dedans. Le bloc repliable sert à ranger plusieurs réglages dans
    // une colonne étroite ; ici la colonne de gauche dit laquelle est ouverte.
    //
    // Sans artwork, la palette n'est pas une pièce manquante : c'est un état,
    // et il porte sa raison — « le grisé porte sa raison, jamais une infobulle ».
    //
    // **La phrase a changé en D2**, et le changement est le fond de l'affaire :
    // elle disait seulement qu'il manquait un artwork, ce qui laissait croire
    // qu'il ne se passait rien. Il se passait quelque chose de pire — aucune
    // couleur n'était réduite, et les sprites sortaient à dix mille teintes.
    // Elle dit maintenant ce qui a lieu, puis comment faire mieux.
    expect(
      await screen.findByText(
        /aucun artwork officiel — les couleurs se déduisent de chaque image/,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(/promeus une carte du tableau d'inspiration/),
    ).toBeTruthy()

    const univers: Univers = {
      ...UNIVERS,
      palette: ["#3d2b2d", "#7d5543", "#b59b72"],
      vide: false,
    }
    flux.emettre("univers", {
      projet: "bac-a-sable",
      nom: "Bac à sable",
      univers,
      realignes: 0,
      conserves: 0,
    })

    // Les couleurs se montrent — « je veux voir la palette extraite de mes
    // artworks officiels, afin de vérifier ce que la machine y a lu » (US-54).
    expect(await screen.findByTitle("#3d2b2d")).toBeTruthy()
    expect(screen.getByTitle("#7d5543")).toBeTruthy()
    expect(screen.getByText("3 couleurs · lues sur 0 artwork")).toBeTruthy()

    // On en retire un : la palette change, et ça se voit sans recharger.
    flux.emettre("univers", {
      projet: "bac-a-sable",
      nom: "Bac à sable",
      univers: { ...univers, palette: ["#1d131a", "#dfc1a6"] },
      realignes: 0,
      conserves: 0,
    })
    await waitFor(() => expect(screen.queryByTitle("#3d2b2d")).toBeNull())
    expect(screen.getByTitle("#dfc1a6")).toBeTruthy()
  })

  // ── T4 : le refus nomme le fichier ───────────────────────────────────────

  test("un fichier qui n'est pas une image est refusé en le nommant", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    await screen.findByText("Le tableau est vide.")

    // `DataTransfer` n'existe pas hors navigateur : on double ce que l'écran
    // lit de la presse-papiers, et rien de plus — comme `FluxDouble` double
    // d'`EventSource` les seules trois choses dont le test a besoin.
    const fichier = new File([new Uint8Array([1, 2, 3])], "notes.txt", {
      type: "text/plain",
    })
    fireEvent.paste(window, {
      clipboardData: { files: [fichier], getData: () => "" },
    })

    // La phrase nomme **le fichier**, pas le tampon mémoire de Pillow : « savoir
    // lequel des douze fichiers déposés pose problème ».
    expect(await screen.findByText(/« notes\.txt » n'est pas une image/)).toBeTruthy()
  })

  // ── Coller dans un champ, c'est coller dans le champ ─────────────────────

  test("un texte collé dans un champ de saisie ne fabrique pas de carte", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    await screen.findByText("Le tableau est vide.")

    // L'écoute est posée sur la fenêtre : elle voit passer aussi les collages
    // qui ne lui sont pas adressés. Celui-ci remplit une case — un champ de la
    // bible, le nom d'un groupe, le mot d'un lien — et le tableau n'en sait
    // rien.
    //
    // **Le champ pris est celui de la bible, et non plus la recherche de la
    // bibliothèque** : la galerie ne se rend plus derrière l'Univers depuis
    // qu'ils sont deux onglets (E1), et un champ démonté ne reçoit aucun
    // collage. Ce que l'essai prouve ne change pas d'un pouce — le collage
    // arrive dans un champ de saisie de l'écran ouvert, et le tableau
    // l'ignore ; il se contente de le prouver dans le seul écran monté.
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "L'allure" }))
    // Les sept questions s'ouvrent une à une : celle du monde est la première,
    // et c'est elle qui porte le champ de saisie.
    fireEvent.click(await screen.findByRole("button", { name: "Où ça se passe" }))
    const champ = await screen.findByPlaceholderText(
      "royaume de tourbe et de fer, marais au nord",
    )
    fireEvent.paste(champ, { clipboardData: { files: [], getData: () => "héros" } })

    expect(fetchDouble.mock.calls.some(([url]) => String(url).includes("/api/board/text"))).toBe(
      false,
    )
    // On revient regarder : le tableau vit du côté Inspiration, et il est resté
    // vide — c'est ce que l'essai vient prouver.
    fireEvent.click(screen.getByRole("tab", { name: "Inspiration" }))
    expect(await screen.findByText("Le tableau est vide.")).toBeTruthy()
  })

  // ── T4 : ce qui part avec la génération se lit avant de cliquer ───────────

  test("le nombre de références envoyées et l'univers sont lisibles au moment de générer", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble, {
      ...ETAT,
      univers: { ...UNIVERS, palette: ["#111111", "#222222"], cible_px: 48, vide: false },
    })
    await ouvrirLesReglagesDeLAppel()

    // Le bloc « Ce qui part » répond d'avance à *qu'est-ce qui part avec ?*
    const bloc = (await screen.findByText("Ce qui part")).parentElement!
    expect(bloc.textContent).toContain("palette")
    expect(bloc.textContent).toContain("2 couleurs")
    expect(bloc.textContent).toContain("48 px")

    // Et le sujet est le seul geste qui reste : promouvoir a déjà tout décidé.
    expect(screen.getByRole("button", { name: "personnage" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "objet tenu" })).toBeTruthy()
  })

  // ── Le filtre du catalogue ne fait pas disparaître ce qui va générer ──────
  //
  // Vu en séance le 27 août : filtrer écartait le modèle choisi de la liste, et
  // plus rien à l'écran ne disait avec quoi on allait générer — le modèle
  // manquait au bloc « Ce qui part », qui nommait pourtant tout le reste. Le
  // compteur, lui, continuait d'annoncer le catalogue entier au-dessus d'une
  // liste réduite. Deux fois la même faute : un affichage qui ne suit pas le
  // filtre posé juste au-dessus de lui.

  /** La liste des modèles, telle qu'elle est rendue — l'épinglé compris. */
  const listeModeles = () =>
    screen.getByPlaceholderText("filtrer").parentElement!.querySelector("ul")!

  /** ⚠️ **Le panneau est devenu un bloc repliable en V2.1**, et le registre du
   *  repli naît fermé : sans ce geste, la liste n'est pas montée du tout et les
   *  deux essais ci-dessous cherchent un compteur qui n'existe pas encore. */
  const ouvrirLesModeles = async () => {
    await ouvrirLesReglagesDeLAppel()
    const entete = await screen.findByRole("button", { name: /^Modèle/ })
    if (entete.getAttribute("aria-expanded") !== "true") fireEvent.click(entete)
  }

  test("un filtre qui écarte le modèle choisi le garde en tête, et le compteur suit", async () => {
    const { fetchDouble } = serveurDouble({
      modeles: [
        { ...MODELE, identifiant: "autre/rapide", nom: "Autre : Rapide" },
        MODELE,
        { ...MODELE, identifiant: "autre/lent", nom: "Autre : Lent" },
      ],
    })
    await monter(fetchDouble, {
      ...ETAT,
      catalogue: { ...ETAT.catalogue, modeles: 3 },
    })
    await ouvrirLesModeles()

    // Sans filtre : le compteur dit le catalogue entier, et le choisi garde sa
    // place dans l'ordre du serveur — épingler n'est pas réordonner.
    expect(await screen.findByText("3 au catalogue")).toBeTruthy()
    await waitFor(() => expect(listeModeles().children).toHaveLength(3))
    expect(listeModeles().children[0].textContent).toContain("Autre : Rapide")

    fireEvent.change(screen.getByPlaceholderText("filtrer"), {
      target: { value: "autre" },
    })

    // Le filtre l'écarte, donc il revient **en tête** : il ne quitte pas
    // l'écran, et il n'est pas une réponse au filtre.
    await waitFor(() =>
      expect(listeModeles().children[0].textContent).toContain("Essai : Modèle"),
    )
    expect(listeModeles().children).toHaveLength(3)

    // Le compteur compte ce que le filtre a trouvé — deux —, jamais les trois
    // du catalogue ni les trois lignes rendues.
    expect(screen.getByText("2 sur 3")).toBeTruthy()
    expect(screen.queryByText("3 au catalogue")).toBeNull()

    // Et « Ce qui part » le nomme de toute façon : c'est la place que ni le
    // filtre ni le défilement n'emportent.
    const bloc = screen.getByText("Ce qui part").parentElement!
    expect(bloc.textContent).toContain("modèle")
    expect(bloc.textContent).toContain("Essai : Modèle")
  })

  test("un filtre sans réponse garde le modèle choisi, et le dit", async () => {
    const { fetchDouble } = serveurDouble({
      modeles: [MODELE, { ...MODELE, identifiant: "autre/lent", nom: "Autre : Lent" }],
    })
    await monter(fetchDouble, {
      ...ETAT,
      catalogue: { ...ETAT.catalogue, modeles: 2 },
    })
    await ouvrirLesModeles()
    await screen.findByText("2 au catalogue")

    fireEvent.change(screen.getByPlaceholderText("filtrer"), {
      target: { value: "zzz" },
    })

    // Zéro trouvé, et l'écran le dit — mais le choix en cours reste lisible.
    await waitFor(() => expect(screen.getByText("0 sur 2")).toBeTruthy())
    expect(screen.getByText("aucun modèle ne porte ce nom")).toBeTruthy()
    expect(listeModeles().children[0].textContent).toContain("Essai : Modèle")
  })
})

// ── T5 : le slicer et le zoom ────────────────────────────────────────────────
//
// Trois critères de T5 ne se vérifient que devant l'écran : que le geste parte
// de la fiche, que la correction à la main soit possible **sur ce que la
// détection a proposé**, et que la découpe faite renvoie sur ce qu'elle a
// fabriqué. Les cinq critères du serveur, eux, vivent dans `tests/test_t5.py`.
//
// Le zoom de la grille y est aussi, et pour la même raison : « un niveau
// indisponible à la largeur courante est grisé, pas caché » est une phrase sur
// une largeur mesurée — aucun test de serveur ne peut la voir.

describe("le slicer et le zoom de la grille", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    // Le repli des blocs vit dans le châssis, pas dans un écran — il survit
    // donc au démontage, ce qui est voulu d'une image à l'autre et faux d'un
    // essai à l'autre.
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function ouvrirLaDecoupe(options: Parameters<typeof serveurDouble>[0] = {}) {
    const planche = asset("aaaa1111-0")
    const double = serveurDouble({ assets: [planche], ...options })
    await monter(double.fetchDouble, { ...ETAT, assets: [planche] })

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    // **`Découper` a quitté la fiche** (E3, E4) : c'est une fabrique de la
    // barre des tables, et la fiche y mène par sa seconde porte.
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir les tables" }))
    fireEvent.click(await screen.findByRole("button", { name: /^découpage/ }))
    return double
  }

  test("découper part de la fiche, montre ce qui sortira, et se corrige à la main", async () => {
    const { appels } = await ouvrirLaDecoupe()

    // **On est descendu d'un étage dans la galerie**, et le fil le dit. Il n'y
    // a plus de titre d'écran à chercher : le nom de l'outil est le dernier
    // segment du fil, et l'écran n'en porte pas d'autre.
    expect(
      (await screen.findAllByText("découpage")).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText("2 rectangles")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Découper en 2 assets" })).toBeTruthy()

    // **Corriger n'a pas besoin de convaincre la détection.** On retire un
    // rectangle, et ce qui partira suit — c'est la liste de l'auteur qui compte.
    fireEvent.click(screen.getByRole("button", { name: "Retirer le rectangle 2" }))
    expect(screen.getByRole("button", { name: "Découper en 1 asset" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Découper en 1 asset" }))

    // Ce qui est parti est **la liste corrigée**, pas la proposition.
    await waitFor(() => {
      const envoi = appels.find((a) => a.url.includes("/slices") && a.corps)
      expect((envoi?.corps as { boites: number[][] }).boites).toHaveLength(1)
    })

    // Et l'écran se referme sur ce qu'il vient de fabriquer : la fiche de la
    // première découpe, ouverte dans l'atelier.
    await waitFor(() => expect(screen.queryByText("Ce qui sortira")).toBeNull())
  })

  test("une détection qui ne trouve rien porte sa raison, et découper est grisé", async () => {
    await ouvrirLaDecoupe({ boites: [], raisonDecoupe: "le détourage n'a rien laissé d'opaque — corrige à la main" })

    expect(
      await screen.findByText("le détourage n'a rien laissé d'opaque — corrige à la main"),
    ).toBeTruthy()
    // Grisé **avec sa raison**, jamais proposé puis refusé.
    expect(screen.getByRole("button", { name: /^Découper en 0/ })).toBeDisabled()
    expect(screen.getByText("aucun rectangle — il n'y a rien à découper")).toBeTruthy()
  })

  test("un cran de zoom trop grand pour la colonne est grisé, pas caché", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await screen.findByRole("button", { name: "4×" })

    // Tant que rien n'a été mesuré, rien n'est grisé : zéro n'est pas une
    // largeur, c'est l'absence de mesure.
    expect(screen.getByRole("button", { name: "4×" })).not.toBeDisabled()

    // Une colonne large : les trois crans tiennent — 4× demande **deux**
    // colonnes de 512 px et leur gouttière, plus le padding de la zone.
    mesurer(1200)
    await waitFor(() => expect(screen.getByRole("button", { name: "4×" })).not.toBeDisabled())
    fireEvent.click(screen.getByRole("button", { name: "4×" }))

    // **Une colonne qui tient une seule tuile ne tient pas le cran.** Trouvé au
    // navigateur, sur une colonne de 1060 px : `minmax(512px, 1fr)` acceptait
    // une colonne unique et l'étirait à 1028 px — huit fois la taille de repos
    // pour un contrôle qui en annonce quatre. Le seuil est donc à deux colonnes,
    // et cette largeur-là est exactement celle qui l'a montré.
    mesurer(1060)
    await waitFor(() => expect(screen.getByRole("button", { name: "4×" })).toBeDisabled())
    expect(screen.getByRole("button", { name: "2×" })).not.toBeDisabled()
    expect(screen.getByText("4× ne tient pas ici — rendu en 2×")).toBeTruthy()

    // La colonne rétrécit — la fiche s'ouvre, un panneau se déplie, la fenêtre
    // change. Le cran reste **choisi**, il est grisé, et l'écran dit ce qu'il
    // rend à la place : aucune substitution silencieuse (US-9).
    mesurer(200)
    await waitFor(() => expect(screen.getByRole("button", { name: "4×" })).toBeDisabled())
    expect(screen.getByRole("button", { name: "2×" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "1×" })).not.toBeDisabled()
    expect(screen.getByText("4× ne tient pas ici — rendu en 1×")).toBeTruthy()
  })

  // ── T6 : l'export ─────────────────────────────────────────────────────────
  //
  // Les deux user stories de la tranche se jouent ici, et l'une des deux **ne
  // peut se vérifier nulle part ailleurs** : « l'export est grisé avec sa raison
  // quand la sélection est vide » (US-77) est une propriété de l'écran. Le
  // serveur, lui, ne voit jamais le cas — l'écran l'a arrêté avant.

  test("sélection vide : exporter est grisé et dit pourquoi, sans être caché", async () => {
    const { fetchDouble, appels } = serveurDouble({ assets: [asset("6666cccc-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("6666cccc-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // **Présent et grisé**, pas absent : l'absence n'apprend rien, le grisé
    // apprend pourquoi. Et la raison est écrite, jamais au survol.
    const bouton = screen.getByRole("button", { name: "Exporter la sélection" })
    expect(bouton).toBeDisabled()
    expect(screen.getByText("aucune image sélectionnée")).toBeTruthy()

    // Cliquer un contrôle grisé ne part pas quand même.
    fireEvent.click(bouton)
    expect(appels.some((a) => a.url === "/api/exports")).toBe(false)

    // Une image sélectionnée : le bouton s'ouvre, la raison s'en va, et il dit
    // ce qui va sortir.
    fireEvent.click(tuiles()[0])
    await waitFor(() => expect(bouton).not.toBeDisabled())
    expect(screen.queryByText("aucune image sélectionnée")).toBeNull()
    expect(bouton.textContent).toBe("Exporter 1")
  })

  test("exporter une sélection envoie ses identifiants et pose le fichier nommé par le serveur", async () => {
    const deux = [asset("6666cccc-0"), asset("7777dddd-0", "un fût")]
    const { fetchDouble, appels } = serveurDouble({ assets: deux })
    await monter(fetchDouble, { ...ETAT, assets: deux })
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // `URL.createObjectURL` n'existe pas dans jsdom, et le clic d'un lien
    // fabriqué n'y déclenche aucun téléchargement : on double les deux, comme
    // `FluxDouble` double le flux. Ce que le test regarde, c'est **le nom sous
    // lequel le fichier est posé** — il vient du serveur, et deux endroits qui
    // nommeraient la même archive finiraient par ne plus dire la même date.
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:essai", revokeObjectURL: () => {} })
    const poses: { nom: string; adresse: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      poses.push({ nom: this.download, adresse: this.href })
    })

    fireEvent.click(tuiles()[0])
    fireEvent.click(tuiles()[1], { ctrlKey: true })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Exporter la sélection" }).textContent).toBe(
        "Exporter 2",
      ),
    )
    fireEvent.click(screen.getByRole("button", { name: "Exporter la sélection" }))

    await waitFor(() => expect(poses).toHaveLength(1))
    expect(poses[0].nom).toBe("atelier-20260827-1743.zip")
    expect(poses[0].adresse).toContain("blob:essai")

    const envoi = appels.find((a) => a.url === "/api/exports")
    expect((envoi?.corps as { identifiants: string[] }).identifiants).toEqual([
      "6666cccc-0",
      "7777dddd-0",
    ])

    // **La sélection survit à l'export** : rien n'a changé dans la
    // bibliothèque, donc rien ne justifie de perdre ce qu'on avait sous la
    // main. On exporte souvent deux fois de suite.
    expect(screen.getByRole("button", { name: "Exporter la sélection" }).textContent).toBe(
      "Exporter 2",
    )
  })

  test("un export refusé dit la phrase du serveur, et ne pose aucun fichier", async () => {
    // L'export est le seul appel de l'interface dont la réponse n'est pas du
    // JSON. Son chemin d'erreur est donc à lui, et c'est exactement le genre
    // d'endroit où un message de bibliothèque en anglais finit à l'écran —
    // « All connection attempts failed » l'avait fait en T1.
    const { fetchDouble } = serveurDouble({
      assets: [asset("6666cccc-0")],
      refusExport: "« 6666cccc-0 » n'est plus dans la bibliothèque",
    })
    await monter(fetchDouble, { ...ETAT, assets: [asset("6666cccc-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    const poses: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      poses.push(this.download)
    })

    fireEvent.click(tuiles()[0])
    fireEvent.click(await screen.findByRole("button", { name: "Exporter la sélection" }))

    // Le pied porte l'état du monde, et c'est **la phrase du serveur** qu'il
    // porte — pas « l'atelier a répondu 409 », pas un message de bibliothèque.
    await waitFor(() =>
      expect(document.querySelector("footer")?.textContent).toContain(
        "« 6666cccc-0 » n'est plus dans la bibliothèque",
      ),
    )
    expect(poses).toHaveLength(0)
    // Et le bouton se rouvre : un refus n'est pas un état dont on ne sort pas.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Exporter la sélection" })).not.toBeDisabled(),
    )
  })
})


// ── L'infobulle et le guide ─────────────────────────────────────────────────
//
// « L'infobulle explique, elle n'excuse jamais » (`docs/DESIGN.md`). Ce qui se
// vérifie ici est le **test binaire** qui borne le motif — *son absence
// empêche-t-elle un geste ?* —, et la règle du gabarit qui le rend utile :
// aucune entrée ne saute la deuxième ligne.

describe("l'infobulle et le guide", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    // Le guide vit dans un magasin de module, comme le repli : il survit au
    // démontage, ce qui est voulu d'un écran à l'autre et faux d'un essai à
    // l'autre.
    reinitialiserGuide()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    // **Et on le referme en sortant**, pas seulement en entrant. Le magasin de
    // module survit au démontage : un essai qui laisse le guide ouvert le laisse
    // ouvert pour tous ceux qui suivent, et ils cherchent alors leur texte dans
    // une page de prose qui parle de tout.
    reinitialiserGuide()
  })

  test("aucune entrée du corpus ne saute la deuxième ligne", () => {
    // C'est le gabarit qui produit la réponse, pas la bonne volonté du
    // rédacteur : sans champ obligatoire, `groupe` aurait reçu trois phrases
    // sur le rangement, et la question de départ serait restée entière.
    for (const [cle, entree] of Object.entries(AIDE)) {
      expect(entree.quoi.trim(), `${cle} · ce que c'est`).not.toBe("")
      expect(entree.change.trim(), `${cle} · ce que ça change`).not.toBe("")
      expect(entree.origine.trim(), `${cle} · d'où ça sort`).not.toBe("")
    }
  })

  test("un champ qui n'agit pas le dit, son voisin qui coûte le dit aussi", () => {
    // Les deux champs qui ont provoqué le motif : voisins dans le même menu,
    // l'un inerte, l'autre décisif, et rien à l'écran ne les distinguait.
    expect(AIDE["carte.groupe"].change).toContain("Rien à la génération")
    expect(AIDE["carte.famille"].change).toContain("coût")
  })

  test("le pointillé ne paraît que sur un réglage documenté", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    const marque = (nom: string) =>
      [...document.querySelectorAll("span")].some(
        (e) => e.textContent === nom && e.className.includes("decoration-dotted"),
      )

    // Documentés — le nom du réglage devient sa propre poignée.
    await waitFor(() => expect(marque("Variations")).toBe(true))
    expect(marque("Proportions")).toBe(true)

    // Et rien d'autre ne se marque : un réglage sans entrée n'a pas de
    // pointillé, aucune bulle vide, rien qui casse.
    expect(marque("Ce qui part")).toBe(false)
  })

  test("la poignée n'est jamais plus large que son mot", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    // Trouvé à l'œil dans l'atelier lancé, pas ici : un `<span>` posé dans un
    // conteneur flexible est blockifié, et dans une **colonne** il s'étire sur
    // toute la largeur. « Proportions » réagissait donc 200 px à droite de son
    // mot, quand « Modèle » — même panneau, parent en rangée — ne réagissait
    // que sur ses 38 px. « Le libellé est la cible » ne tient que si la cible
    // *est* le libellé.
    //
    // jsdom ne met rien en page : ce qui se vérifie ici est la **règle**, pas
    // sa largeur. La largeur, elle, se mesure au navigateur, et c'est ce qui a
    // trouvé le défaut.
    await waitFor(() =>
      expect(
        [...document.querySelectorAll("span")].some((e) =>
          e.className.includes("decoration-dotted"),
        ),
      ).toBe(true),
    )
    for (const nom of ["Proportions", "Variations", "Modèle", "Sujet"]) {
      const poignee = [...document.querySelectorAll("span")].find(
        (e) => e.textContent === nom && e.className.includes("decoration-dotted"),
      )
      expect(poignee, `${nom} — poignée absente`).toBeTruthy()
      expect(poignee!.className, `${nom} — poignée étirable`).toContain("w-fit")
    }
  })

  test("le survol explique, et n'excuse jamais", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    const libelle = [...document.querySelectorAll("span")].find(
      (e) => e.textContent === "Variations" && e.className.includes("decoration-dotted"),
    )!
    expect(document.querySelector('[role="tooltip"]')).toBeNull()

    // 200 ms de repos : assez long pour traverser un panneau sans rien
    // déclencher, assez court pour battre le clic.
    fireEvent.mouseOver(libelle)
    const bulle = await screen.findByRole("tooltip")

    // Les trois lignes, dans l'ordre.
    expect(bulle.textContent).toContain("Combien d'images partent d'un seul clic")
    expect(bulle.textContent).toContain("4 fois le coût")
    expect(bulle.textContent).toContain("défaut 1")
    expect(bulle.textContent).toContain("Le guide ›")
  })

  test("le guide s'ouvre depuis la barre de tête et porte le corpus", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))

    // Les quatre parties, et la troisième est le corpus lui-même.
    expect(await screen.findByRole("heading", { name: "La boucle" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Ce qui n'est pas encore écrit" })).toBeTruthy()

    // La réponse à la question qui a lancé tout ce chantier.
    expect(screen.getByRole("heading", { name: "groupe" })).toBeTruthy()
    expect(
      screen.getAllByText(/Rien à la génération\. C'est un rangement pour l'œil\./).length,
    ).toBeGreaterThan(0)
  })

  test("toute clé branchée à l'écran a son entrée dans le corpus", () => {
    // **Le trou que ce motif peut avoir en silence.** Une clé mal tapée dans un
    // composant ne lève pas : `explication()` rend `undefined`, le pointillé ne
    // paraît pas, et le réglage redevient muet sans que rien ne le dise. C'est
    // exactement la panne que le corpus existe pour éviter, et elle ne se voit
    // qu'en confrontant ce que l'écran demande à ce que le corpus porte.
    const sources = import.meta.glob("./composants/*.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>

    const branchees = new Set<string>()
    for (const [fichier, code] of Object.entries(sources)) {
      if (fichier.endsWith("Infobulle.tsx") || fichier.endsWith("Guide.tsx")) continue
      for (const trouvee of code.matchAll(/aide="([\w.]+)"/g)) branchees.add(trouvee[1])
    }

    // De quoi prouver que le balayage a vraiment lu quelque chose : un test qui
    // ne trouve aucune clé passerait tout seul, et pour toujours.
    expect(branchees.size).toBeGreaterThan(20)
    for (const cle of branchees) {
      expect(AIDE[cle], `${cle} — branché à l'écran, absent du corpus`).toBeTruthy()
    }

    // Les cinq champs de la bible sont branchés par gabarit — `bible.${champ}` —
    // et aucun littéral ne les nomme. Ils se vérifient donc à part.
    for (const champ of ["monde", "epoque", "trait", "eclairage", "technique"]) {
      expect(AIDE[`bible.${champ}`], `bible.${champ}`).toBeTruthy()
    }
  })

  test("deux entrées du même écran ne portent pas le même nom", () => {
    // Le guide rend les entrées à la file, groupées par écran, et le nom est le
    // titre de chacune. Deux « famille » à la suite dans « Dans l'univers » —
    // celle d'une carte et celle d'une échelle — et le lecteur ne sait plus
    // laquelle il lit. C'est la seule collision que le regroupement ne rattrape
    // pas, puisqu'il est le regroupement.
    const vus = new Map<string, string>()
    for (const [cle, entree] of Object.entries(AIDE)) {
      const empreinte = `${entree.ou} · ${entree.nom.toLowerCase()}`
      expect(vus.get(empreinte), `${cle} et ${vus.get(empreinte)} — même nom, même écran`)
        .toBeUndefined()
      vus.set(empreinte, cle)
    }
  })

  test("une place grisée s'explique quand même, et sa raison reste dans sa fente", async () => {
    // **Le grisé porte sa raison, et l'explication reste possible.** Les deux
    // ne se disputent pas la même fente : la raison vit dans le panneau de la
    // table, l'explication dans une bulle qui sort du libellé.
    //
    // La place a changé d'endroit avec E3 — elle tenait un bloc replié dans la
    // fiche, elle tient une table à elle —, mais la règle est la même : une
    // table indisponible **s'ouvre**, et porte sa raison à la place de ses
    // réglages.
    //
    // **L'état grisé est construit ici, il n'est plus supposé** (D2). Ce test
    // se servait du grisé réel de la quantification, qui n'existe plus : sans
    // artwork officiel, elle réduit maintenant les couleurs de chaque image au
    // lieu de refuser. Ce qu'on vérifie est la règle du châssis, pas la règle
    // du produit — le double pose donc la raison dont le test a besoin.
    const images = [asset("aaaa1111-0")]
    const double = serveurDouble({ assets: images })
    await monter(double.fetchDouble, {
      ...ETAT,
      assets: images,
      traitement: {
        ...ETAT.traitement,
        quantification: { raison: "aucune palette", note: null },
      },
    })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir les tables" }))
    fireEvent.click(await screen.findByRole("button", { name: /^quantification/ }))

    // La table s'ouvre, et porte la raison à la place de ses réglages.
    expect(await screen.findByText("aucune palette")).toBeTruthy()
    // **À la place des réglages, jamais à côté d'eux** : aucun contrôle mort
    // sous la raison.
    expect(screen.queryByRole("slider")).toBeNull()
  })

  test("le guide range les explications par lieu, et par les lieux qui existent", async () => {
    // **Trois des cinq groupes portaient le nom d'un écran disparu** — l'Atelier,
    // la retouche, la Découpe —, et l'univers tenait tout seul un sac de vingt-
    // neuf entrées dont la moitié parlent de formulaires et l'autre d'images.
    // Neuf groupes depuis E20, et l'univers se coupe en ses trois côtés.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    await screen.findByRole("heading", { name: "La boucle" })
    for (const groupe of [
      "inspiration",
      "jeu",
      "ambiances",
      "codex",
      "etabli",
      "galerie",
      "tables",
      "fabriques",
      "reglages",
    ]) {
      const titre = document.querySelector(`#ou-${groupe}`)
      expect(titre, groupe).toBeTruthy()
      expect(titre?.textContent, groupe).toBeTruthy()
    }

    // **Et aucun ne porte plus le nom d'un écran qui n'existe pas.**
    for (const disparu of ["Dans l'atelier", "Dans la retouche", "Dans la découpe"]) {
      expect(screen.queryByRole("heading", { name: disparu }), disparu).toBeNull()
    }

    // Les manques d'hier restent comblés : le barème, les champs de la bible,
    // la tache minimale, les lignes de la découpe.
    expect(screen.getByRole("heading", { name: "Barème d'échelles" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "contraintes techniques" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "tache minimale" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "lignes" })).toBeTruthy()
    // Ce qui reste sans entrée est écrit, et chaque ligne dit ce qui manque.
    expect(SANS_ENTREE.length).toBeGreaterThan(0)
    expect(SANS_ENTREE[0]).toContain("catalogue")
  })

  test("Échap ferme le guide, comme tout écran du produit", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    expect(await screen.findByRole("heading", { name: "La boucle" })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("heading", { name: "La boucle" })).toBeNull())
  })

  // ── E20 · Le guide, refait sur les lieux qui existent ─────────────────────
  //
  // **Le seul écran qui parle de tous les autres**, donc le seul qui se périme à
  // chaque décision prise ailleurs. Il faisait visiter quatre pièces dont trois
  // avaient disparu ou changé de nom, sa boucle commençait par « écrire » alors
  // que le premier geste possible sur une machine neuve est de *nommer*, et sa
  // liste de manques annonçait une ligne quand onze sujets entiers n'étaient
  // expliqués nulle part.

  const ouvrirLeGuide = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    await screen.findByRole("heading", { name: "La boucle" })
  }

  test("le guide fait le tour des lieux qui existent, et dit lequel n'est pas un onglet", async () => {
    // **On ne visite pas des pièces que personne ne peut ouvrir.** L'écran qui
    // s'appelait l'Atelier n'existe plus, la Découpe est devenue une table parmi
    // les autres, et la Bibliothèque s'appelle la galerie.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    // **Par identifiant, et non par nom** : « Le codex » nomme aussi un groupe
    // de réglages plus bas, et c'est voulu — le lieu se visite, le groupe se
    // consulte. Deux titres du même nom dans deux parties différentes.
    for (const lieu of ["l-univers", "le-codex", "la-galerie", "l-etabli"]) {
      expect(document.querySelector(`#${lieu}`), lieu).toBeTruthy()
    }
    for (const parti of ["Atelier", "Découpe", "Bibliothèque"]) {
      expect(screen.queryByRole("heading", { name: parti }), parti).toBeNull()
    }

    // **Et il dit lequel n'est pas un onglet** : on n'arrive pas à l'établi par
    // la barre, on clique un nom dans le codex.
    const prose = screen
      .getByRole("heading", { name: "La boucle" })
      .closest("article")!.textContent!
    expect(prose).toMatch(/Une profondeur, pas un onglet/)
  })

  test("la boucle du produit commence par nommer", async () => {
    // Sur une machine neuve, c'est le **seul geste possible** : il n'y a pas
    // d'établi tant qu'il n'y a pas de chose.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    const temps = screen
      .getAllByRole("heading")
      .map((n) => n.textContent)
      .filter((t): t is string =>
        ["Nommer", "Écrire", "Générer", "Juger", "Garder"].includes(t ?? ""),
      )
    expect(temps).toEqual(["Nommer", "Écrire", "Générer", "Juger", "Garder"])
    // Et le mot est dans l'ouverture : « tu nommes, tu écris, tu génères… ».
    const prose = screen
      .getByRole("heading", { name: "La boucle" })
      .closest("article")!.textContent!
    expect(prose).toMatch(/Tu nommes, tu écris, tu génères/)
    expect(prose).toMatch(/on ne paie rien en nommant/)
  })

  test("un groupe sans explication affiche son zéro au lieu de disparaître", async () => {
    // **Un vide se voit, il ne se cache pas.** C'est la règle du produit partout
    // ailleurs, et le guide est le dernier endroit où l'on aurait le droit d'y
    // déroger — un manque du guide est un fait sur le guide.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    // **Chaque groupe porte son compte, et le compte est le vrai.** Un groupe
    // qui disparaîtrait quand il tombe à zéro rendrait le manque invisible ; un
    // compte écrit à la main au-dessus d'une liste vieillit à chaque ligne
    // ajoutée, et personne ne recompte.
    const sommaire = within(screen.getByRole("navigation", { name: "Le sommaire" }))
    const attendus: Record<string, string> = {
      Inspiration: "inspiration",
      "Réglages du jeu": "jeu",
      "Ambiances et couleurs": "ambiances",
      "Le codex": "codex",
      "L'établi": "etabli",
      "La galerie": "galerie",
      "Les tables": "tables",
      "Les fabriques": "fabriques",
      "Les réglages de l'atelier": "reglages",
    }
    // **Le nom seul ne suffit pas à désigner la rangée** : « Le codex » est aussi
    // un lieu qu'on visite, plus haut dans le même sommaire, et sa rangée-là ne
    // porte pas de compte. C'est le compte qui distingue les deux, et c'est très
    // exactement ce qu'on mesure.
    const rangees = sommaire
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
    for (const [nom, ou] of Object.entries(attendus)) {
      const compte = Object.values(AIDE).filter((e) => e.ou === ou).length
      expect(rangees, nom).toContain(`${nom}${compte}`)
    }

    // Et le corps rend le zéro pour un groupe vide plutôt que rien du tout.
    expect(
      Object.values(AIDE).filter((e) => e.ou === "codex").length,
    ).toBeGreaterThan(0)
  })

  test("les six phrases fausses sont corrigées, et aucune ne compte cinq places", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    // **Sept places, pas cinq** : les contours et la main s'y sont ajoutés.
    const prose = screen
      .getByRole("heading", { name: "La boucle" })
      .closest("article")!.textContent!
    expect(prose).toMatch(/Une recette a sept places/)
    expect(prose).not.toMatch(/cinq places/)
    // Le corpus non plus ne les compte plus à cinq, ni ne nomme un écran parti.
    const corpus = Object.values(AIDE)
      .map((e) => `${e.quoi} ${e.change} ${e.long ?? ""}`)
      .join(" ")
    expect(corpus).not.toMatch(/cinq places|cinq étapes/)
    expect(corpus).not.toMatch(/l'Atelier/)
    expect(corpus).not.toMatch(/l'écran Univers/)
    // Et le tiroir « ce qui partira », retiré en E14, n'est plus décrit comme
    // vivant sous le champ.
    expect(corpus).not.toMatch(/dépliant/)
  })

  test("les entrées qui manquaient sont là, dont la clé du fournisseur", async () => {
    // **Onze sujets entiers n'étaient expliqués nulle part**, et le plus coûteux
    // était la clé : le seul réglage qui empêche absolument tout tant qu'il est
    // vide.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    for (const nom of [
      "Le codex",
      "Écrire un nom",
      "La vitrine",
      "Une palette",
      "Une ambiance",
      "La planche de poses",
      "L'écran de confirmation",
      "Le calibrage",
      "Les contours",
      "La main",
      "La superposition",
      "Les dépenses",
      "Les fournisseurs, et ce qu'ils demandent",
      "L'assistant de démarrage",
    ]) {
      expect(
        screen.getAllByRole("heading", { name: nom }).length,
        nom,
      ).toBeGreaterThan(0)
    }
  })

  test("un réglage sans explication n'a pas de trait sous son nom", async () => {
    // **Le trou est visible dans le guide, jamais dans le travail.** Aucune
    // bulle vide, aucun « à documenter » dans un panneau : on voit seulement
    // qu'il n'y a rien à survoler.
    expect(AIDE["reglage.qui.nexiste.pas"]).toBeUndefined()
    // Et le guide, lui, tient la liste de ce qu'il ne dit pas.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    expect(
      screen.getByRole("heading", { name: "Ce qui n'est pas encore écrit" }),
    ).toBeTruthy()
    for (const manque of SANS_ENTREE) {
      expect(screen.getByText(manque)).toBeTruthy()
    }
  })

  test("le titre reste en serif, les titres de section en sans majuscules", async () => {
    // **Aucun quatrième emploi du serif**, et la colonne de prose reste bornée :
    // c'est la seule largeur maximale du produit.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLeGuide()

    const titre = screen.getByRole("heading", { name: "Guide", level: 1 })
    expect(titre.className).toContain("font-serif")

    const section = screen.getByRole("heading", { name: "Réglages du jeu" })
    expect(section.className).toContain("uppercase")
    expect(section.className).not.toContain("font-serif")

    const prose = screen.getByRole("heading", { name: "La boucle" }).closest("article")
    expect(prose?.className).toContain("max-w-[36em]")
    // **Et le `em` est celui de la prose, écrit sur le bloc qui porte la
    // borne.** Sans cette taille, `36em` se résout sur les 13 px hérités du
    // corps : 468 px au lieu de 540, soit 61 signes par ligne là où la règle en
    // vise 74. jsdom ne met rien en page — l'essai garde donc la *cause*, la
    // seule chose qu'il puisse tenir, et la mesure vit dans `docs/PIEGES.md`.
    expect(prose?.className).toContain("text-[15px]")
  })
})

// ── T7 : ce que l'agent produit, et le cadre qui le tient ───────────────────
//
// Trois des treize critères de T7 ne se vérifient qu'à l'écran : la pastille de
// provenance, le compteur lisible sans quitter l'atelier, et les trois réglages
// tenus au même endroit. Les dix autres vivent dans `tests/test_t7.py`.

describe("l'agent, vu de l'atelier", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test("une image de l'agent porte sa provenance dans la grille", async () => {
    const grille = [
      asset("aaaa1111-0", "un tonneau"),
      asset("bbbb2222-0", "une épée", "agent"),
    ]
    const { fetchDouble } = serveurDouble({ assets: grille })
    await monter(fetchDouble, { ...ETAT, assets: grille })

    await waitFor(() => expect(screen.getByTitle("une épée")).toBeTruthy())

    // **La pastille, et une seule.** « Savoir à qui parler quand quelque chose
    // me surprend » (US-39) : ce que le système constate est un mot, ce que
    // l'auteur pose est une forme.
    const marques = [...document.querySelectorAll("span")].filter(
      (e) => e.textContent === "agent",
    )
    expect(marques).toHaveLength(1)

    // Et la contrepartie, sans laquelle la marque ne distingue rien : ce que
    // l'auteur a produit ne porte rien.
    const tonneau = screen.getByTitle("un tonneau").closest("figure")!
    expect(tonneau.textContent).not.toContain("agent")
  })

  test("le compteur de l'agent se lit sans quitter l'atelier", async () => {
    const agent: Etat["agent"] = {
      garde_fous: { ...ETAT.agent.garde_fous },
      consommation: {
        ...ETAT.agent.consommation,
        generations: 12,
        depense_usd: 0.0812,
        reste: 8,
      },
    }
    const { fetchDouble } = serveurDouble({ agent })
    // **Le compteur arrive par le flux comme le reste de l'état.** C'est ce que
    // fait le vrai serveur : un onglet qui s'ouvre reçoit l'état complet, et
    // n'a rien à redemander.
    await monter(fetchDouble, { ...ETAT, agent })

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // Les deux chiffres qui décident de relever le plafond (US-90), et ils sont
    // **à côté du réglage qu'ils font relever**.
    const panneau = await screen.findByRole("heading", { name: "L'agent" })
    const section = panneau.closest("section")!
    expect(section.textContent).toContain("12 images")
    expect(section.textContent).toContain("8 avant le plafond")
    expect(section.textContent).toContain("$0,0812")
  })

  // ── « Échap ferme les Réglages » (31 août 2026) ───────────────────────────
  //
  // **Le panneau ne se fermait qu'en cliquant à côté** — un geste qui ne
  // s'annonce nulle part et qu'on ne devine pas. Le Guide et la vitrine
  // ferment sur Échap et l'écrivent sur leur bouton de sortie : c'est une règle
  // du produit, et ce panneau-ci était l'un des deux qui ne la tenaient pas.

  test("Échap ferme les Réglages, et le panneau se déclare comme une fenêtre", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))
    const panneau = await screen.findByRole("dialog", { name: "Réglages" })

    // Déclaré par-dessus : sans ces mots, un lecteur d'écran continue
    // d'annoncer la page du dessous comme si elle était atteignable.
    expect(panneau.getAttribute("aria-modal")).toBe("true")
    expect(screen.getByRole("button", { name: "Fermer — Échap" })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Réglages" })).toBeNull(),
    )
  })

  test("fournisseurs, garde-fous et dossiers se règlent depuis un seul écran", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // Les trois blocs, dans un seul panneau (US-96).
    expect(
      await screen.findByRole("heading", { name: "Les fournisseurs" }),
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "L'agent" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Les dossiers" })).toBeTruthy()

    // Éteindre un garde-fou n'envoie **que lui** : ce qui n'est pas dit ne
    // change pas, sinon un formulaire partiel effacerait ce qu'un autre onglet
    // vient de poser.
    fireEvent.click(
      screen.getByRole("button", { name: "Plafond de la séance — actif" }),
    )
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/settings/agent" &&
            JSON.stringify(a.corps) === JSON.stringify({ plafond_actif: false }),
        ),
      ).toBe(true),
    )

    // Et l'écran suit la réponse du serveur, sans rejouer la règle : le plafond
    // éteint, il n'y a plus de « reste » à annoncer.
    await waitFor(() => {
      const section = screen.getByRole("heading", { name: "L'agent" }).closest("section")!
      expect(section.textContent).not.toContain("avant le plafond")
    })
  })

  test("les trois réglages de l'agent portent leur explication", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // Le corpus documente ce que l'écran expose, et rien ne se marque sans
    // entrée : la panne que le corpus existe pour éviter est silencieuse.
    for (const cle of ["agent.plafond", "agent.modele", "agent.dossier"]) {
      expect(AIDE[cle], `${cle} — absent du corpus`).toBeTruthy()
      expect(AIDE[cle].ou).toBe("reglages")
    }
    const marque = (nom: string) =>
      [...document.querySelectorAll("span")].some(
        (e) => e.textContent === nom && e.className.includes("decoration-dotted"),
      )
    await waitFor(() => expect(marque("Dossier du jeu")).toBe(true))
    expect(marque("Plafond de la séance")).toBe(true)
    expect(marque("Modèle d'exploration")).toBe(true)
  })

  // ── T8 : la toile ─────────────────────────────────────────────────────────
  //
  // Six des treize critères de la tranche vivent ici, et pas ailleurs : ils
  // portent sur ce que l'écran montre, ou sur une pile qui n'existe que dans
  // l'onglet. La géométrie — où une carte se pose, quel îlot l'attrape — se
  // vérifie dans `composants/Toile.test.tsx`, où elle est pure ; **jsdom ne met
  // rien en page, donc tout rectangle y vaut zéro**, et un essai qui tirerait
  // une carte à travers le plan classerait toujours dans le même îlot.

  /** Un tableau composé : deux groupes peuplés, et deux cartes qui attendent. */
  const compose = () => [
    carteImage("m1", { groupe: "marais" }),
    carteImage("m2", { groupe: "marais", position: [200, 0] }),
    carteImage("n1", { groupe: "nord" }),
    carteImage("libre", { position: [600, 400] }),
    carteImage("r1"),
    carteImage("r2"),
  ]

  const ouvrirLaToile = async () => {
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("button", { name: "toile" }))
  }

  /** Les îlots dessinés, par leur nom.
   *
   *  Par le marqueur et non par le texte : le nom d'un groupe paraît **aussi**
   *  au pied de chacune de ses cartes, et chercher « marais » à l'écran en
   *  trouve donc trois. Ce qu'on veut savoir ici est combien d'îlots la toile a
   *  dessinés, ce qui est une autre question. */
  const ilots = () =>
    [...document.querySelectorAll("[data-ilot]")].map(
      (e) => (e as HTMLElement).dataset.ilot,
    )

  test("la toile s'ouvre sur les groupes déjà saisis, et le reste attend en réserve", async () => {
    // Deux critères d'un coup, parce qu'ils sont les deux moitiés de la même
    // phrase : « la toile montre ce qui est classé, la réserve contient ce qui
    // reste à classer ». Aucun geste n'est demandé — les îlots sont là à
    // l'ouverture, parce qu'un îlot *est* un groupe et que les groupes étaient
    // déjà écrits.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    const reserve = document.querySelector("[data-reserve]")!
    expect(reserve).toBeTruthy()
    expect(await screen.findByText("2 à classer")).toBeTruthy()

    // Les deux îlots portent leur nom et leur compte, et il n'y en a pas un
    // troisième : la carte posée sans groupe n'en fabrique aucun.
    await waitFor(() => expect(ilots()).toEqual(["marais", "nord"]))
    expect(screen.getByText("2 cartes")).toBeTruthy()

    // Les deux cartes à classer sont **dans la réserve**, pas sur le plan.
    expect(reserve.querySelectorAll("article")).toHaveLength(2)
  })

  test("côté Inspiration, aucun réglage n'est posé au-dessus du tableau", async () => {
    // **La règle a changé de forme sans changer de fond, en E7.** Elle disait
    // « les réglages restent visibles pendant qu'on compose », et la colonne de
    // gauche existait pour ça. Mesuré : cette colonne faisait 1 843 px de haut
    // dans 646 px visibles, et repoussait la première image d'inspiration à
    // 4 161 px de défilement — six écrans et demi avant de voir une image, sur
    // l'écran dont c'est le métier. Les réglages restent visibles, mais du côté
    // qui est à eux : les regarder ne demande plus de rogner le tableau.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    // La réserve est là — c'est la seule colonne du côté Inspiration.
    expect(await screen.findByText("Réserve")).toBeTruthy()
    // Les réglages du jeu, non : ils sont un côté plus loin.
    expect(screen.queryByRole("button", { name: /^Bible/ })).toBeNull()

    // **Aucune largeur nouvelle** : la réserve reprend la 380 de la fiche
    // asset, telle quelle, et elle est désormais la seule.
    const colonnes = [...document.querySelectorAll("aside")].filter((a) =>
      a.className.includes("w-[380px]"),
    )
    expect(colonnes).toHaveLength(1)
  })

  test("la réserve se replie, et la toile prend alors toute la largeur", async () => {
    // « Replier un panneau est un choix, jamais une contrainte de place »
    // (US-97). Il n'en reste qu'un à replier depuis E7, et c'est le seul qui
    // occupe encore une colonne à côté du tableau.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    const pistes = () =>
      (document.querySelector("[data-colonnes]") as HTMLElement).style.gridTemplateColumns
    const reserve = screen.getByRole("button", { name: "réserve" })

    // Déployée d'emblée : l'écran large est la ressource du produit.
    expect(reserve.getAttribute("aria-pressed")).toBe("true")
    expect(pistes()).toBe("minmax(0,1fr) 380px")

    fireEvent.click(reserve)
    expect(pistes()).toBe("minmax(0,1fr) 0px")

    // **Replier n'est pas fermer**, et c'est tout l'enjeu : le panneau est
    // toujours monté, avec ce qu'il portait, et il garde ses 380 px — c'est la
    // grille que l'aimant de la toile mesure.
    expect(
      document.querySelector("[data-reserve]")!.querySelectorAll("article"),
    ).toHaveLength(2)

    // En grille, la réserve n'a pas de colonne : elle n'a donc pas de bascule.
    fireEvent.click(screen.getByRole("button", { name: "grille" }))
    expect(screen.queryByRole("button", { name: "réserve" })).toBeNull()
    expect(pistes()).toBe("minmax(0,1fr)")
  })

  test("la grille du tableau est inchangée : on y revient telle qu'on l'a laissée", async () => {
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    // La grille montre **tout** le tableau — classé ou non : c'est ce pour quoi
    // elle est bonne, et la toile ne la remplace pas.
    const grille = () => screen.getAllByRole("button", { name: "Ouvrir la carte" })
    await waitFor(() => expect(grille()).toHaveLength(6))

    fireEvent.click(screen.getByRole("button", { name: "toile" }))
    await waitFor(() => expect(document.querySelector("[data-reserve]")).toBeTruthy())

    fireEvent.click(screen.getByRole("button", { name: "grille" }))
    await waitFor(() => expect(grille()).toHaveLength(6))
    expect(document.querySelector("[data-reserve]")).toBeNull()
  })

  test("coller pendant qu'on compose fait paraître une carte en réserve", async () => {
    // « Ce qui arrive arrive en réserve — jamais au milieu d'un îlot qu'on vient
    // de faire. » Rien n'est écrit pour ça : une carte neuve n'a ni groupe ni
    // place, donc la règle de la réserve la range toute seule.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose() })
    const flux = await monter(fetchDouble)
    await ouvrirLaToile()
    await screen.findByText("2 à classer")

    flux.emettre("carte", carteImage("neuve"))
    await waitFor(() => expect(screen.getByText("3 à classer")).toBeTruthy())

    // Et rien n'a bougé sur la toile : les deux îlots sont les mêmes.
    expect(ilots()).toEqual(["marais", "nord"])
  })

  test("ramener une carte en réserve vide son groupe, et Ctrl+Z le rend", async () => {
    // Le geste que la pile existe pour rattraper : « hors îlot, pas de groupe »
    // ferait autrement d'un glissement raté l'effacement d'un nom tapé à la
    // main. Ctrl+Z n'a **rien côté serveur** — annuler, c'est rappeler la même
    // route avec la valeur d'avant.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await screen.findByText("2 à classer")

    fireEvent.drop(document.querySelector("[data-reserve]")!, {
      dataTransfer: {
        types: ["application/x-carte-atelier"],
        getData: () => "m1",
        files: [],
      },
    })

    const reglages = () => appels.filter((a) => a.url === "/api/board/m1")
    await waitFor(() => expect(reglages()).toHaveLength(1))
    expect(reglages()[0].corps).toEqual({ groupe: "", position: [] })
    // Elle attend désormais avec les autres, et l'îlot a perdu un membre.
    await waitFor(() => expect(screen.getByText("3 à classer")).toBeTruthy())

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(reglages()).toHaveLength(2))
    // « Le champ retrouve sa valeur d'avant » — le nom tapé à la main est rendu.
    expect(reglages()[1].corps).toEqual({ groupe: "marais", position: [] })
    await waitFor(() => expect(screen.getByText("2 à classer")).toBeTruthy())
  })

  test("quitter l'écran vide la pile : au retour, ce qui est sur disque fait foi", async () => {
    // « Ce n'est pas de l'historique de projet, c'est le rattrapage du geste en
    // cours » (`docs/archive/plan-versions-tenues.md` T8). La pile meurt avec l'écran, et un Ctrl+Z au
    // retour ne défait rien du tout.
    //
    // **Il se lit avec celui d'au-dessus, et pas seul.** Celui-ci prouve qu'un
    // Ctrl+Z après un aller-retour ne défait rien ; c'est le précédent qui
    // prouve qu'il défait quelque chose quand l'écran n'a pas été quitté. La
    // différence entre les deux est exactement la vie de l'écran, et aucun des
    // deux ne dit ça tout seul.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await screen.findByText("2 à classer")

    fireEvent.drop(document.querySelector("[data-reserve]")!, {
      dataTransfer: {
        types: ["application/x-carte-atelier"],
        getData: () => "m1",
        files: [],
      },
    })
    const reglages = () => appels.filter((a) => a.url === "/api/board/m1")
    await waitFor(() => expect(reglages()).toHaveLength(1))

    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
    await ouvrirLaToile()
    await screen.findByText("3 à classer")

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    // Rien de plus n'est parti : la pile était vide, et le disque fait foi.
    await waitFor(() => expect(screen.getByText("3 à classer")).toBeTruthy())
    expect(reglages()).toHaveLength(1)
  })

  // ── T9 : les liens et les notes ───────────────────────────────────────────
  //
  // **Ce que l'écran seul peut tenir, et rien de plus.** Le serveur tient qui
  // est joint à qui (`tests/test_t9.py`) ; la géométrie du trait et ce qu'un
  // îlot emporte se vérifient purs, sans monter d'écran
  // (`composants/Toile.test.tsx`). Restent ici trois choses qui n'existent que
  // dans l'onglet : la pile d'annulation, le geste qui écrit une note, et
  // l'absence d'un contrôle sur une carte image.
  //
  // **Et une chose ne s'y vérifie pas : tirer le trait lui-même.** Il passe par
  // la gestion de pointeur de la librairie, qui ne démarre pas sur des
  // événements synthétisés (`AGENTS.md`, mesuré en T8 sur le glissement d'une
  // carte). Ce qui *suit* le tracé — l'appel, la pile, le pavé — est en
  // revanche le même code, et il est éprouvé ci-dessous par la coupe et son
  // annulation.

  /** Un tableau composé, plus un trait entre deux cartes du même îlot. */
  const compose9 = () => [
    carteImage("m1", { groupe: "marais", position: [0, 0] }),
    carteImage("m2", { groupe: "marais", position: [200, 0] }),
    carteImage("r1"),
  ]

  const LIEN = {
    identifiant: "l1",
    projet: "bac-a-sable",
    de: { genre: "carte" as const, valeur: "m1" },
    vers: { genre: "carte" as const, valeur: "m2" },
    mot: "",
    pointe: false,
    cree_le: 1_787_800_300,
  }

  test("une note s'écrit à même la toile, et c'est une carte texte", async () => {
    // « Créée là où elle s'applique plutôt qu'au bout d'une liste » (US-110).
    // **Un seul appel dit le texte et la place** : créer puis déplacer aurait
    // fait paraître la note en réserve, à l'autre bout de l'écran de l'endroit
    // qu'on vient de désigner.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    const plan = document.querySelector("[data-plan]")!
    fireEvent.doubleClick(plan)

    const champ = await waitFor(() => {
      const trouve = document.querySelector("[data-brouillon]") as HTMLTextAreaElement
      expect(trouve).toBeTruthy()
      return trouve
    })

    fireEvent.change(champ, { target: { value: "  trois pierres, pas quatre  " } })
    fireEvent.blur(champ)

    const poses = () => appels.filter((a) => a.url === "/api/board/text")
    await waitFor(() => expect(poses()).toHaveLength(1))
    const corps = poses()[0].corps as { texte: string; position: number[] }
    expect(corps.texte).toBe("trois pierres, pas quatre")
    expect(corps.position).toHaveLength(2)

    // Et le brouillon a disparu : il n'était pas la note, il était ce sur quoi
    // on écrit avant qu'elle existe.
    await waitFor(() => expect(document.querySelector("[data-brouillon]")).toBeNull())
  })

  test("un brouillon vide ne crée rien, et Échap l'abandonne", async () => {
    // Sans quoi le tableau se remplirait de notes vides qu'il faudrait ensuite
    // retirer une à une — et le double-clic cesserait d'être un geste qu'on peut
    // essayer sans rien casser.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    fireEvent.doubleClick(document.querySelector("[data-plan]")!)
    const champ = await waitFor(() => {
      const trouve = document.querySelector("[data-brouillon]") as HTMLTextAreaElement
      expect(trouve).toBeTruthy()
      return trouve
    })
    fireEvent.change(champ, { target: { value: "   " } })
    fireEvent.blur(champ)

    await waitFor(() => expect(document.querySelector("[data-brouillon]")).toBeNull())
    expect(appels.filter((a) => a.url === "/api/board/text")).toHaveLength(0)

    // Et Échap referme sans rien écrire non plus.
    fireEvent.doubleClick(document.querySelector("[data-plan]")!)
    const second = await waitFor(() => {
      const trouve = document.querySelector("[data-brouillon]") as HTMLTextAreaElement
      expect(trouve).toBeTruthy()
      return trouve
    })
    fireEvent.change(second, { target: { value: "une intention" } })
    fireEvent.keyDown(second, { key: "Escape" })
    await waitFor(() => expect(document.querySelector("[data-brouillon]")).toBeNull())
    expect(appels.filter((a) => a.url === "/api/board/text")).toHaveLength(0)
  })

  test("« + note » fait ce que la vue permet — en grille, la note naît en réserve", async () => {
    // Écrit le 28 août 2026 (`docs/design-motifs.md` § La toile révisée). T9
    // avait refusé un contrôle de barre, et l'argument était juste — *une note
    // se crée là où elle s'applique*. Il ne couvrait pas le vrai trou, qui est
    // en amont : **il n'existait aucun moyen d'écrire une note sans en avoir
    // d'abord le texte dans le presse-papier**, le double-clic n'existant que
    // sur le plan et la vue grille n'ayant pas de plan.
    //
    // En grille, la note naît donc **en réserve** — sans place et sans groupe,
    // ce que le serveur déduit des deux : le corps ne porte que le texte.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    fireEvent.click(await screen.findByRole("button", { name: "+ note" }))
    const champ = await waitFor(() => {
      const trouve = document.querySelector("[data-brouillon]") as HTMLTextAreaElement
      expect(trouve).toBeTruthy()
      return trouve
    })
    fireEvent.change(champ, { target: { value: "  la brume mange le bas  " } })
    fireEvent.blur(champ)

    const poses = () => appels.filter((a) => a.url === "/api/board/text")
    await waitFor(() => expect(poses()).toHaveLength(1))
    expect(poses()[0].corps).toEqual({ texte: "la brume mange le bas" })
    await waitFor(() => expect(document.querySelector("[data-brouillon]")).toBeNull())
  })

  test("« + note » en toile pose le brouillon sur le plan, et un champ vide ne crée rien", async () => {
    // L'autre moitié de la même règle : en toile, le brouillon paraît au centre
    // de ce que l'écran montre — au milieu de ce qu'on regarde, et non à sept
    // cents pixels de là. **Le double-clic ne bouge pas** : il reste le geste
    // précis, celui qui désigne l'endroit ; les deux ne se doublent pas, l'un
    // est découvrable et l'autre est rapide.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()

    fireEvent.click(await screen.findByRole("button", { name: "+ note" }))
    const champ = await waitFor(() => {
      const trouve = document.querySelector("[data-brouillon]") as HTMLTextAreaElement
      expect(trouve).toBeTruthy()
      return trouve
    })
    // Il est **sur le plan** : le brouillon de la toile est un nœud, pas une
    // surface flottante — un champ posé en pixels d'écran serait faux au premier
    // cran de zoom.
    expect(champ.closest(".react-flow__node")).toBeTruthy()

    // Et il s'essaie sans rien casser, exactement comme celui du double-clic.
    fireEvent.change(champ, { target: { value: "   " } })
    fireEvent.blur(champ)
    await waitFor(() => expect(document.querySelector("[data-brouillon]")).toBeNull())
    expect(appels.filter((a) => a.url === "/api/board/text")).toHaveLength(0)
  })

  test("couper un lien passe par sa route, et Ctrl+Z le repose tel qu'il était", async () => {
    // Le critère de la tranche : « Ctrl+Z annule la création comme la coupe d'un
    // lien ». **Reposer, c'est reposer le lien entier** — son mot et sa pointe
    // avec —, en un seul appel : une route qui ne saurait reposer qu'un trait nu
    // forcerait l'annulation à passer par un état où le geste est à moitié
    // défait.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({
      cartes: compose9(),
      liens: [{ ...LIEN, mot: "vient de", pointe: true }],
    })
    await monter(fetchDouble)
    await ouvrirLaToile()

    // Le mot du lien **est** sa poignée — « le libellé est la cible ».
    const poignee = await screen.findByRole("button", { name: "vient de" })
    fireEvent.click(poignee)

    fireEvent.click(await screen.findByRole("button", { name: "Couper" }))
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/board/links/l1")).toBe(true),
    )

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    const reposes = () => appels.filter((a) => a.url === "/api/board/links")
    await waitFor(() => expect(reposes()).toHaveLength(1))
    expect(reposes()[0].corps).toEqual({
      de: LIEN.de,
      vers: LIEN.vers,
      mot: "vient de",
      pointe: true,
    })
  })

  test("le mot et la pointe d'un lien partent par la même route", async () => {
    // « L'un et l'autre s'ajoutent après coup, et se retirent » (US-109). Ils se
    // posent sur la même petite surface, donc ils voyagent ensemble.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({
      cartes: compose9(),
      liens: [LIEN],
    })
    await monter(fetchDouble)
    await ouvrirLaToile()

    // Un lien **muet** n'a pas de mot à survoler : sa bande en tient lieu, et
    // c'est la contrepartie assumée du défaut muet.
    fireEvent.click(await screen.findByRole("button", { name: "Régler le lien" }))

    const champ = await screen.findByPlaceholderText("aucun")
    fireEvent.change(champ, { target: { value: "dérive de" } })
    fireEvent.blur(champ)

    const regles = () => appels.filter((a) => a.url === "/api/board/links/l1")
    await waitFor(() => expect(regles()).toHaveLength(1))
    expect(regles()[0].corps).toEqual({ mot: "dérive de" })

    // La pointe est un bouton qui **est la phrase de son état**.
    fireEvent.click(await screen.findByRole("button", { name: "sans pointe" }))
    await waitFor(() => expect(regles()).toHaveLength(2))
    expect(regles()[1].corps).toEqual({ pointe: true })
  })

  test("un lien dont une extrémité part disparaît, et rien ne reste à l'écran", async () => {
    // « Sans laisser de trait orphelin. » C'est le serveur qui l'emporte —
    // l'écran ne rejoue jamais la règle —, et il l'annonce sur le flux.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose9(), liens: [LIEN] })
    const flux = await monter(fetchDouble)
    await ouvrirLaToile()

    expect(await screen.findByRole("button", { name: "Régler le lien" })).toBeTruthy()

    flux.emettre("lien", { ...LIEN, coupe: true })
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Régler le lien" })).toBeNull(),
    )
  })

  test("une note porte une teinte, une carte image n'en porte aucune", async () => {
    // « Une carte image ne porte aucune couleur d'organisation » — critère
    // d'acceptation. **L'absence du contrôle est le critère** : rien n'est
    // grisé, parce qu'il n'y a pas de réglage à refuser.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({
      cartes: [
        carteImage("note", { genre: "texte", texte: "trois pierres", position: [0, 0] }),
        carteImage("img", { position: [400, 0] }),
      ],
    })
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    // Le menu d'une carte image : pas de rangée de teinte.
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir la carte" }))
    await waitFor(() => expect(screen.getByText("Artwork officiel")).toBeTruthy())
    expect(screen.queryByText("Teinte de la note")).toBeNull()

    // Le menu d'une note : la rangée est là, et pas le bloc d'artwork.
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la note" }))
    await waitFor(() => expect(screen.getByText("Teinte de la note")).toBeTruthy())
    expect(screen.queryByText("Artwork officiel")).toBeNull()

    // Sept pastilles : les six, et le châssis.
    const pastilles = ["ardoise", "iris", "prune", "bruyère", "lichen", "paille"].map(
      (nom) => screen.getByRole("button", { name: nom }),
    )
    expect(pastilles).toHaveLength(6)
    expect(screen.getByRole("button", { name: "sans teinte" })).toBeTruthy()

    fireEvent.click(pastilles[2])
    const regles = () => appels.filter((a) => a.url === "/api/board/note")
    await waitFor(() => expect(regles()).toHaveLength(1))
    expect(regles()[0].corps).toEqual({ teinte: "prune" })
  })

  test("teinter un îlot passe par son nom, et ne redemande pas le catalogue", async () => {
    // **Le nom fait poignée** : un îlot n'a pas d'identité, il a un nom, et
    // c'est le nom qui ouvre son menu. Et la teinte ne redemande **ni l'état ni
    // le catalogue** : ce message-là les redemandait parce que promouvoir un
    // artwork change ce qui partira, or une couleur ne change rien de tout ça —
    // la règle était juste, son déclencheur trop large.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await waitFor(() => expect(ilots()).toEqual(["marais"]))

    const avant = appels.filter((a) => a.url.startsWith("/api/images/models")).length

    fireEvent.click(await screen.findByRole("button", { name: "marais" }))
    fireEvent.click(await screen.findByRole("button", { name: "lichen" }))

    const teintes = () => appels.filter((a) => a.url === "/api/board/groups/tint")
    await waitFor(() => expect(teintes()).toHaveLength(1))
    expect(teintes()[0].corps).toEqual({ groupe: "marais", teinte: "lichen" })

    // Le message d'univers est revenu par le flux ; le catalogue n'a pas bougé.
    await waitFor(() =>
      expect(appels.filter((a) => a.url.startsWith("/api/images/models")).length).toBe(
        avant,
      ),
    )
  })

  test("la teinte d'une note se voit à l'instant où on la choisit", async () => {
    // **Trouvé à l'atelier lancé.** Le bord d'une carte choisie porte l'anneau
    // `--lumiere`, et *choisi* est un état qui l'emporte sur un rangement : la
    // première écriture faisait donc céder la teinte **entière** tant que la
    // carte restait choisie. Or on choisit une pastille depuis le menu de la
    // carte, qui n'est ouvert que parce qu'elle est choisie : on cliquait une
    // couleur et rien ne changeait, jusqu'à ce qu'on clique ailleurs.
    //
    // Les deux ne se disputent que le **bord**, et le bord suffit à dire
    // *choisi*. Le fond, lui, ne cède jamais.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({
      cartes: [
        carteImage("note", {
          genre: "texte",
          texte: "trois pierres",
          position: [0, 0],
          teinte: "prune",
        }),
      ],
    })
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    const carte = () => screen.getByRole("button", { name: "Ouvrir la note" }).closest("article")!

    await waitFor(() => expect(carte().getAttribute("style")).toContain("--color-ilot-prune"))
    // Au repos, la teinte prend aussi le bord.
    expect(carte().getAttribute("style")).toContain("border-color")

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la note" }))
    await waitFor(() => expect(carte().className).toContain("border-lumiere"))
    // Choisie : le bord est à l'anneau, **le fond garde sa teinte**.
    expect(carte().getAttribute("style")).toContain("--color-ilot-prune")
    expect(carte().getAttribute("style")).not.toContain("border-color")
  })

  test("les dix teintes sont les seules, et elles ne renvoient à aucun token sémantique", () => {
    // « Les teintes sont les seules disponibles, et aucune ne se confond avec
    // une couleur sémantique du produit — **vérifié à côté d'une carte en
    // échec** » (`docs/archive/plan-versions-tenues.md` T9). La seconde moitié de ce critère est un
    // constat d'œil, et il se fait au navigateur : deux valeurs peuvent être
    // distinctes et se confondre quand même.
    //
    // Ce qui se prouve **ici** est la première moitié, et elle est entière : la
    // liste est close, elle est la même des deux côtés du tuyau, et aucune de
    // ses entrées ne renvoie à un token qui, lui, dit quelque chose. Une
    // onzième teinte, ou une teinte qui pointerait vers `--color-echec`, fait
    // tomber ce test.
    //
    // **Six jusqu'au 28 août 2026, dix depuis, et c'est ce test qui a dû être
    // rouvert pour l'écrire** — ce qui est exactement son travail : le compte
    // ne se change pas par distraction. L'ordre est celui de la roue, pas celui
    // de l'alphabet, et il est le même à l'écran et sur le disque.
    expect(TEINTES).toEqual([
      "ardoise",
      "pervenche",
      "iris",
      "lavande",
      "prune",
      "mauve",
      "bruyere",
      "mousse",
      "lichen",
      "paille",
    ])
    expect(Object.keys(COULEUR_TEINTE).sort()).toEqual([...TEINTES].sort())
    expect(Object.keys(NOM_TEINTE).sort()).toEqual([...TEINTES].sort())

    const renvois = Object.values(COULEUR_TEINTE)
    expect(new Set(renvois).size, "deux teintes pour la même couleur").toBe(10)
    for (const renvoi of renvois) {
      expect(renvoi).toMatch(/^var\(--color-ilot-[a-z]+\)$/)
    }

    // Et la liste close du serveur est la même : deux listes dans deux langues
    // finiraient par ne plus dire la même chose, et c'est le refus d'un geste
    // qui l'apprendrait à l'auteur.
    for (const teinte of TEINTES) {
      expect(COULEUR_TEINTE[teinte], teinte).toBe(`var(--color-ilot-${teinte})`)
    }
  })

})

// ── L'aperçu — Espace, et l'image en grand ──────────────────────────────────
//
// **Ce qui se prouve ici, et ce qui ne s'y prouve pas.** La touche, ce qu'elle
// ouvre, l'adresse de l'image ouverte, la cohabitation avec les écrans qu'elle
// couvre et le facteur de zoom sont du produit et se vérifient ici. Le rendu de
// l'image — pixels au plus proche voisin, damier de 24 px, image centrée — est
// de la mise en page, et jsdom n'en met aucune : ça se regarde au navigateur, et
// **ça se dit** plutôt que de se laisser croire couvert.

describe("l'aperçu", () => {
  // jsdom ne connaît pas la capture de pointeur : trois surfaces du produit s'en
  // servent déjà — la poignée de largeur, la bande d'un îlot, le cadre de la
  // Découpe — et aucun essai ne les touche pour cette raison-là. On la double,
  // comme le flux et la mesure. Elle ne fait rien de plus qu'exister : jsdom
  // livre de toute façon chaque événement à sa cible.
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    reinitialiserApercu()
  })

  /** Le survol, tel que React l'entend. **Pas `pointerEnter`** : React ne
   *  l'écoute pas — il le fabrique depuis `pointerover` et `pointerout`, et un
   *  `pointerenter` envoyé à la main n'atteint donc aucun gestionnaire. */
  const survoler = (element: Element) => fireEvent.pointerOver(element)
  const quitter = (element: Element) => fireEvent.pointerOut(element)

  const espace = () => fireEvent.keyDown(window, { key: " ", code: "Space" })
  const apercu = () => screen.queryByRole("dialog", { name: "Aperçu" })
  const image = () => apercu()!.querySelector("img")!

  test("Espace sur une tuile survolée l'ouvre en grand, et Espace la referme", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0", "un tonneau")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0", "un tonneau")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // Rien sous le pointeur : la touche ne prend rien, et elle le prouve en
    // laissant l'événement passer — c'est ce qui permet à Espace de continuer à
    // défiler le guide.
    const seul = fireEvent.keyDown(window, { key: " ", code: "Space" })
    expect(seul, "Espace a été consommé sans rien sous le pointeur").toBe(true)
    expect(apercu()).toBeNull()

    const vignette = tuiles()[0].closest("figure")!
    survoler(vignette)
    espace()

    // **L'aperçu est la vignette en grand, et rien d'autre** : le même asset,
    // pas une seconde décision sur « rendu ou brut ».
    //
    // **Deux adresses depuis le 31 août 2026, et c'est le sujet de l'aperçu qui
    // l'impose.** La grille demande une image réduite — elle en montre cent à
    // cent quarante-cinq pixels, et recevait jusqu'à deux mégaoctets par
    // case —, l'aperçu demande le fichier entier, puisque l'ouvrir en grand est
    // exactement le geste de compter ses pixels. Ce qui ne doit pas changer,
    // et que cet essai tient, est qu'elles nomment **le même asset** : c'est de
    // la seconde décision sur « rendu ou brut » qu'on se garde.
    expect(apercu()).toBeTruthy()
    expect(image().getAttribute("src")).toBe("/api/generations/aaaa1111/slots/0/image")
    expect(vignette.querySelector("img")!.getAttribute("src")).toMatch(
      /^\/api\/assets\/aaaa1111-0\/vignette\?cote=256&v=/,
    )
    // Les dimensions mesurées, et le facteur qu'elles donnent dans cette scène :
    // 1024 px dans 1000 × 800 moins deux marges de 24 → 752 / 1024.
    expect(screen.getByText("1024×1024 · 73 %")).toBeTruthy()

    espace()
    expect(apercu()).toBeNull()
  })

  test("Échap ferme l'aperçu, et laisse ouvert l'écran qu'il couvrait", async () => {
    // **Une pression, un geste.** L'écran Univers ne porte pas d'Échap, mais la
    // Découpe et le Guide en portent un, et la toile écoute Ctrl+Z : l'aperçu
    // les couvre tous. Ce qu'il consomme s'arrête chez lui — sinon fermer une
    // image en fermerait deux.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: [carteImage("c1")] })
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    const carte = await waitFor(() => document.querySelector("article")!)
    survoler(carte)
    espace()
    expect(apercu()).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(apercu()).toBeNull()
    // L'onglet est resté ouvert derrière : une pression, un geste.
    expect(
      screen.getByRole("tab", { name: "Univers" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  test("une note s'ouvre en colonne de prose, et une note vide n'a rien à ouvrir", async () => {
    const { fetchDouble } = serveurDouble({
      cartes: [
        carteImage("n1", { genre: "texte", texte: "une intention, longuement écrite" }),
      ],
      assets: [asset("aaaa1111-0")],
    })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })

    // **La réponse a changé en E7, et par l'autre bout.** Tant que la carte
    // grandissait avec son texte, l'agrandir ne montrait rien de plus, et la
    // touche ne faisait rien. Depuis que la carte a la hauteur de son cran de
    // zoom, son texte est coupé — et il faut un endroit où le lire en entier.
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    const note = await waitFor(() => document.querySelector("article")!)
    survoler(note)
    espace()
    const ouvert = apercu()
    expect(ouvert).toBeTruthy()

    // **En colonne de prose bornée, pas en image** : c'est la seconde et
    // dernière surface du produit qui a droit à une largeur maximale, et elle
    // l'a pour la raison qui borne le Guide.
    const prose = ouvert!.querySelector("[data-apercu-prose] p") as HTMLElement
    expect(prose.textContent).toBe("une intention, longuement écrite")
    expect(prose.className).toContain("max-w-[504px]")
    // Elle ne zoome pas et ne se traîne pas : elle défile.
    expect(ouvert!.querySelector("[data-apercu-scene]")).toBeNull()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(apercu()).toBeNull()

    // Le pointeur repart : la touche n'a plus rien à ouvrir.
    quitter(note)
    espace()
    expect(apercu()).toBeNull()
  })

  test("écrire garde la barre d'espace, bouger la souris la rend à l'image", async () => {
    // **Le piège de T9, pris par l'autre bout.** *Le champ de prompt prend le
    // focus au démarrage et ne le rend jamais* : un garde qui n'interrogerait
    // que le focus rendrait Espace mort dans l'atelier, c'est-à-dire à
    // l'endroit exact où il sert. Vérifié en écrivant cet essai — la première
    // écriture du garde ne laissait pas l'aperçu s'ouvrir une seule fois.
    //
    // Le garde tient donc sur deux conditions : un champ où l'on peut écrire,
    // **et** que la dernière chose faite ait été d'y écrire.
    //
    // **L'essai se joue dans l'établi depuis E2**, et c'est là qu'il a le plus
    // de sens : c'est le seul écran du produit où une vignette et le champ où
    // l'on écrit sont côte à côte, à quelques pixels l'un de l'autre. La
    // galerie, elle, n'a plus de champ du tout — on y juge, on n'y paie jamais.
    const image = asset("bbbb2222-0", "le nain, au repos")
    const nain = personnage("Le nain")
    const { fetchDouble } = serveurDouble({
      personnages: [
        {
          ...nain,
          cases: nain.cases.map((c) =>
            c.pose === "repos" ? { ...c, images: [image] } : c,
          ),
        },
      ],
    })
    await monter(fetchDouble)
    await ouvrirLEtabli("Le nain")
    const vignette = (
      await screen.findByLabelText("Retirer cette image de la case repos")
    ).closest("span")!

    // Le pointeur se pose : la touche est à l'image.
    survoler(vignette)
    espace()
    expect(apercu()).toBeTruthy()
    espace()

    // On tape un signe dans le prompt, la souris toujours posée sur la
    // vignette : la barre d'espace redevient une espace, et rien ne s'ouvre.
    const champ = await champDePrompt()
    champ.focus()
    fireEvent.keyDown(champ, { key: "u" })
    const passe = fireEvent.keyDown(window, { key: " ", code: "Space" })
    expect(passe, "Espace a été volé au champ où l'on écrit").toBe(true)
    expect(apercu()).toBeNull()

    // La souris bouge sur une image : la touche lui revient, sans avoir eu
    // besoin de quitter le champ.
    survoler(vignette)
    espace()
    expect(apercu()).toBeTruthy()
  })

  test("la molette zoome autour du pointeur, et le facteur se lit", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    survoler(tuiles()[0].closest("figure")!)
    espace()
    expect(screen.getByText(/73 %/)).toBeTruthy()

    const scene = document.querySelector("[data-apercu-scene]")!
    const cran = (deltaY: number) =>
      fireEvent.wheel(scene, { deltaY, clientX: 500, clientY: 400 })

    // Un cran de souris rend `deltaY` ≈ 100, donc un facteur de 1,16 : 73 → 85.
    cran(-100)
    expect(screen.getByText(/85 %/)).toBeTruthy()

    // Et le dézoom revient à l'ajustement, sans le dépasser : l'image entière
    // est le plancher, une image qui tient déjà n'a rien à rapetisser.
    cran(400)
    expect(screen.getByText("1024×1024 · 73 %")).toBeTruthy()
  })

  test("un clic ferme l'aperçu, un glissement ne le ferme pas", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    survoler(tuiles()[0].closest("figure")!)
    espace()
    const scene = () => document.querySelector("[data-apercu-scene]")!

    // Un glissement : au-delà du seuil de trois pixels, c'est un déplacement, et
    // un déplacement ne ferme rien. Même seuil que la bande d'un îlot.
    fireEvent.pointerDown(scene(), { button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(scene(), { clientX: 460, clientY: 340 })
    fireEvent.pointerUp(scene(), { clientX: 460, clientY: 340 })
    expect(apercu()).toBeTruthy()

    // Un clic : rien ne bouge entre la pression et le relâchement, donc c'est
    // une sortie. L'aperçu ne porte aucun contrôle — rien d'autre ne peut être
    // voulu par un clic, et « à côté » est partout.
    fireEvent.pointerDown(scene(), { button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerUp(scene(), { clientX: 401, clientY: 300 })
    expect(apercu()).toBeNull()
  })

  // ── E0 · « La barre d'espace ouvre l'aperçu depuis **toute** vignette du
  //     produit, et la liste des endroits où elle sert n'a plus d'exception
  //     nommée » ────────────────────────────────────────────────────────────
  //
  // **Deux surfaces manquaient, et pour la même raison mécanique** : la visée
  // est un hook, un hook ne s'appelle pas dans une boucle, et les deux endroits
  // qui manquaient rendaient leurs vignettes dans un `map`. Le chantier des
  // maquettes les a trouvés en comptant les images de 44 px et de 24 px du
  // produit (D32, 30 août 2026).

  test("une vignette de la matrice s'ouvre en grand, comme une tuile", async () => {
    const image = asset("bbbb2222-0", "le nain, au repos")
    const nain = personnage("Le nain")
    const avecImage = {
      ...nain,
      cases: nain.cases.map((c) =>
        c.pose === "repos" ? { ...c, images: [image] } : c,
      ),
    }
    const { fetchDouble } = serveurDouble({ personnages: [avecImage] })
    await monter(fetchDouble)

    await ouvrirLEtabli("Le nain")
    const vignette = (
      await screen.findByLabelText("Retirer cette image de la case repos")
    ).closest("span")!

    survoler(vignette)
    espace()

    // Même règle que la tuile : l'aperçu est la vignette en grand, à la même
    // adresse. Un second endroit qui déciderait « rendu ou brut » finirait par
    // répondre autrement que la case.
    expect(apercu()).toBeTruthy()
    expect(apercu()!.querySelector("img")!.getAttribute("src")).toBe(
      vignette.querySelector("img")!.getAttribute("src"),
    )

    espace()
    expect(apercu()).toBeNull()
  })

  test("une image qui repart avec l'appel s'ouvre en grand, elle aussi", async () => {
    const seul = asset("cccc3333-0", "un tonneau cerclé")
    const { fetchDouble } = serveurDouble({ assets: [seul] })
    await monter(fetchDouble, { ...ETAT, assets: [seul] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.click(tuiles()[0])
    // L'adresse que la grille sert, lue **avant** de changer d'onglet : c'est
    // elle que la bande doit redonner.
    const adresse = tuiles()[0]
      .closest("figure")!
      .querySelector("img")!
      .getAttribute("src")
    fireEvent.click(await screen.findByRole("button", { name: "référence" }))

    const bande = (await screen.findByText("Repart avec")).parentElement!
    const vignette = bande.querySelector("img")!

    // **La bande demande son image par la même route que la grille.** Elle
    // appelait `rendu` en direct : sur un asset sans recette, cette adresse
    // n'existe pas, et la bande montrait un trou là où la grille montre
    // l'image. Corrigé avec la barre d'espace, et pour la même raison — une
    // seule adresse par asset dans tout le produit.
    //
    // **Et c'est la vignette réduite, depuis le 31 août 2026** : la bande
    // affiche vingt-quatre pixels de côté, et elle recevait le fichier entier.
    // Le cran demandé est celui de la grille au repos, ce qui la rend gratuite
    // — l'image est déjà dans le cache du navigateur quand la bande paraît.
    expect(vignette.getAttribute("src")).toBe(adresse)
    expect(adresse).toMatch(/^\/api\/assets\/cccc3333-0\/vignette\?cote=256&v=/)

    survoler(vignette.closest("span")!)
    espace()
    expect(apercu()).toBeTruthy()
  })
})

// ── R1 · Le réglage d'univers se voit à l'instant ────────────────────────────
//
// **Le trou par lequel le défaut est passé.** 122 essais d'écran, et aucun ne
// regardait *après* : on vérifiait que l'écran avait bien appelé la route, ce
// qui était vrai, pendant que l'écran restait sur la valeur d'avant. Ceux-ci
// regardent donc ce qui est affiché une fois le réglage posé, pour **chacun des
// cinq blocs** de l'univers — et le double, de son côté, pose ce qu'on lui règle
// au lieu de rendre éternellement l'univers de départ.

describe("le réglage d'univers se voit à l'instant", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Une étape ouverte de l'assistant, contenu compris.
   *
   *  Les segments de deux étapes portent les mêmes nombres — 16, 24, 32 et 48
   *  sont à la fois des couleurs et des tailles de pixel. On cherche donc *dans*
   *  l'étape, jamais dans l'écran entier. */
  const scene = (titre: string) =>
    within(document.querySelector(`[data-etape="${titre}"]`) as HTMLElement)

  /** Ouvrir une étape — son côté, puis sa rangée — et rendre son contenu.
   *
   *  **Une étape est un écran, plus un tiroir.** Les quatre étapes qui se
   *  construisaient avec le bloc repliable du châssis ne le font plus : ouverte,
   *  la plus vide d'entre elles rendait 26 points de contenu dans une scène de
   *  1 360 × 754, dont le seul mot était « Barème d'échelles ». Le second geste
   *  est parti avec le tiroir, et ce raccourci n'en fait donc plus qu'un. */
  const ouvrir = async (titre: string) => {
    const cote = screen.queryByRole("tab", { name: "Réglages" })
    if (cote && cote.getAttribute("aria-selected") !== "true") fireEvent.click(cote)
    fireEvent.click(await screen.findByRole("button", { name: titre }))
    await waitFor(() =>
      expect(document.querySelector(`[data-etape="${titre}"]`)).toBeTruthy(),
    )
    return scene(titre)
  }

  /** Ce que la colonne de gauche dit d'une étape.
   *
   *  **Elle se lit comme un récapitulatif** : chaque rangée porte la valeur de
   *  son étape, en mono, à droite de son nom. C'est ce que faisait l'en-tête
   *  d'un bloc replié — en mieux, puisqu'il n'y a rien à fermer pour la lire. */
  const rangee = (etape: string) => screen.getByRole("button", { name: etape })

  /** L'écran Univers, ouvert sur cet univers-là.
   *
   *  **L'onglet tient son univers du flux**, pas de la route : c'est le premier
   *  message de l'abonnement qui le pose (« un abonné qui arrive en retard
   *  demande l'état complet »). Le double et l'état de départ doivent donc dire
   *  la même chose, sans quoi l'écran montrerait l'un et réglerait l'autre. */
  const ouvrirLUnivers = async (
    univers: Univers = UNIVERS,
    /** **De quoi poser un état de traitement à soi** (D2). Les façons de réduire
     *  qu'une machine sait faire viennent du serveur ; un test qui vérifie le
     *  grisé doit pouvoir en retirer une, sans dépendre de ce qui est installé
     *  sur la machine qui fait tourner les essais. */
    etat: Partial<typeof ETAT> = {},
  ) => {
    const double = serveurDouble({ univers })
    const flux = await monter(double.fetchDouble, { ...ETAT, univers, ...etat })
    await ouvrirLesReglagesDuJeu("L'allure")
    await waitFor(() =>
      expect(document.querySelector(`[data-etape="L'allure"]`)).toBeTruthy(),
    )
    return { ...double, flux }
  }

  test("la bible posée survit à la fermeture de l'écran, sans rechargement", async () => {
    await ouvrirLUnivers()
    const allure = await ouvrir("L'allure")
    fireEvent.click(allure.getByRole("button", { name: "Où ça se passe" }))

    const monde = await allure.findByPlaceholderText(/royaume de tourbe/)
    fireEvent.change(monde, { target: { value: "marais de fer" } })
    fireEvent.blur(monde)

    // **On referme et on rouvre**, parce que la bible est le seul bloc qui
    // tienne un brouillon : le texte encore à l'écran ne prouverait que le
    // brouillon. Remonté, il naît de ce que l'onglet tient de l'univers — donc
    // de la réponse posée. C'est « rouvrir montre la même valeur », vu d'ici.
    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
    await ouvrirLesReglagesDuJeu("L'allure")

    // **Une rangée fermée dit ce qu'elle porte** — le début de son texte,
    // tronqué, en mono. On lit donc sa description sans rien rouvrir, ce que ni
    // le bloc replié ni les segments ne permettaient.
    await waitFor(() =>
      expect(
        scene("L'allure").getByRole("button", { name: "Où ça se passe" }).textContent,
      ).toContain("marais de fer"),
    )
    // Et la colonne compte les cases qui portent quelque chose, sans qu'on ait
    // à fermer quoi que ce soit pour le lire.
    expect(rangee("L'allure").textContent).toContain("1 sur 7")
  })

  test("le nombre de couleurs demandé est celui qui vient d'être posé", async () => {
    // **Le réglage s'offre même sans palette depuis D2** : sans artwork, les
    // couleurs se déduisent de chaque image au lieu de ne pas être réduites du
    // tout, et cacher le contrôle cachait précisément ce défaut-là. On part
    // quand même d'une palette ici, pour rester au plus près du test d'avant.
    await ouvrirLUnivers({ ...UNIVERS, palette: ["#3d2b2d", "#b59b72"], vide: false })
    const palette = await ouvrir("Références et couleurs")

    // **Les paliers ont changé en D2** — 8, 16, 32, 64 sur un sprite de 64 —, et
    // ils sont plafonnés par le côté du sprite. On règle sur deux d'entre eux.
    fireEvent.click(palette.getByRole("button", { name: "16" }))

    await waitFor(() =>
      expect(palette.getByRole("button", { name: "16" }).className).toContain(
        "border-signal",
      ),
    )
    expect(palette.getByRole("button", { name: "32" }).className).not.toContain(
      "border-signal",
    )
  })

  test("le style se choisit sur deux images, et il commande la suite", async () => {
    // *« On propose le choix du style de jeu ici et on met une image cliquable
    // pour chaque style qui permet de faire le choix »* — l'auteur, 3 septembre.
    const { appels } = await ouvrirLUnivers()
    fireEvent.click(screen.getByRole("button", { name: "Le style" }))

    const dessin = await screen.findByRole("button", { name: /En dessin/ })
    expect(screen.getByRole("button", { name: /En pixel art/ })).toBeTruthy()
    // Le choix dit **ce qu'il change ailleurs**, pas ce que le contrôle fait.
    expect(dessin.textContent).toContain("quelle finesse")

    fireEvent.click(dessin)
    await waitFor(() =>
      expect(
        appels.filter((a) => a.url.includes("/universe")).at(-1)?.corps,
      ).toMatchObject({ style: "dessin" }),
    )
  })

  test("en dessin, l'étape des tailles demande une finesse", async () => {
    // **La même étape, deux questions.** Ce ne sont ni les mêmes valeurs, ni le
    // même mot, ni la même conséquence — et les confondre est ce qui faisait
    // croire qu'un jeu en dessin n'a pas de taille du tout.
    await ouvrirLUnivers({ ...UNIVERS, style: "dessin", cible_px: 512, vide: false })
    // **La colonne dit le même mot que le titre.** Elle disait « La taille »
    // pendant que l'écran disait « La finesse » — deux noms pour une étape, à
    // 240 px l'un de l'autre —, et l'écran perdait du même coup sa ligne de
    // repère, faute de se retrouver dans la liste sous ce titre-là.
    expect(screen.queryByRole("button", { name: "La taille" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "La finesse" }))

    expect(await screen.findByRole("heading", { name: "La finesse" })).toBeTruthy()
    expect(screen.getByText("étape 4 · le jeu")).toBeTruthy()
    expect(screen.getByText(/ton jeu n'est pas en pixel art/)).toBeTruthy()
    // Et les couleurs cessent d'être un réglage : un dessin garde ses nuances.
    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))
    expect(
      await screen.findByText(/ce jeu est en dessin : les couleurs ne sont pas réduites/),
    ).toBeTruthy()
    // **L'absence d'artwork ne se raconte pas pareil selon le style.** La
    // phrase du pixel art — « les couleurs se déduisent de chaque image » —
    // promettrait ici une réduction qui n'a pas lieu, juste au-dessus de la
    // ligne qui dit qu'elle n'a pas lieu. Ce qui manque en dessin est une
    // palette de référence à joindre aux images, et c'est ce qu'elle dit.
    expect(screen.queryByText(/les couleurs se déduisent de chaque image/)).toBeNull()
    expect(
      screen.getByText(/le jeu n'a pas encore de palette à joindre en référence/),
    ).toBeTruthy()
  })

  test("le projet choisit sa façon de réduire, sous la taille", async () => {
    // **Sous la taille, parce que c'est la même question posée deux fois** : la
    // taille dit *combien de carrés*, la méthode dit *comment on y arrive*.
    const { appels } = await ouvrirLUnivers()
    fireEvent.click(screen.getByRole("button", { name: "La taille" }))

    fireEvent.click(await screen.findByRole("button", { name: "traits épaissis" }))

    await waitFor(() =>
      expect(
        appels.filter((a) => a.url.includes("/universe")).at(-1)?.corps,
      ).toMatchObject({ methode_pixels: "pixeloe" }),
    )
  })

  test("une façon de réduire non installée est annoncée, jamais tue", async () => {
    // « Ce qui est indisponible est grisé avec sa raison, jamais proposé puis
    // refusé » — et la taire serait pire qu'un grisé : l'auteur croirait que le
    // produit n'en propose que trois.
    await ouvrirLUnivers(UNIVERS, {
      traitement: {
        ...ETAT.traitement,
        reductions: [
          { nom: "vote" as const, libelle: "vote en deux temps", raison: null },
          {
            nom: "pixeloe" as const,
            libelle: "traits épaissis",
            raison: "la méthode « traits épaissis » n'est pas installée",
          },
        ],
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "La taille" }))

    // La raison se suffit à elle-même : elle nomme déjà la méthode, et la
    // préfixer du libellé le disait deux fois dans la même phrase.
    expect(
      await screen.findByText(/la méthode « traits épaissis » n'est pas installée/),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "traits épaissis" })).toBeNull()
  })

  test("sans remise sur grille, la façon de réduire disparaît", async () => {
    // Un réglage sans effet vaut mieux caché qu'expliqué : sans taille imposée
    // il n'y a aucune réduction à faire, donc rien à régler.
    await ouvrirLUnivers({ ...UNIVERS, cible_px: 0, vide: false })
    fireEvent.click(screen.getByRole("button", { name: "La taille" }))
    await screen.findByText(/l'image garde la taille que le modèle lui a donnée/)

    expect(screen.queryByRole("button", { name: "vote en deux temps" })).toBeNull()
  })

  test("les paliers de couleurs sont plafonnés par la taille du sprite", async () => {
    // *« On ne peut pas avoir du 128 couleurs sur du 32px »* — l'auteur,
    // 3 septembre 2026. Le plafond est le côté du sprite, et il est mesuré :
    // au-delà, l'image n'a plus assez de teintes distinctes pour remplir la
    // palette demandée.
    await ouvrirLUnivers({ ...UNIVERS, cible_px: 32, vide: false })
    const palette = await ouvrir("Références et couleurs")

    for (const tenu of ["8", "16", "32"]) {
      expect(palette.getByRole("button", { name: tenu })).toBeTruthy()
    }
    expect(palette.queryByRole("button", { name: "64" })).toBeNull()
    expect(palette.queryByRole("button", { name: "128" })).toBeNull()
    // Et la liste courte s'explique, pour qu'elle ne se lise pas comme un bug.
    expect(palette.getByText(/32 carrés de côté ne porte pas plus de 32/)).toBeTruthy()
  })

  test("la taille de pixel posée s'affiche, sans rechargement", async () => {
    const { appels } = await ouvrirLUnivers()
    fireEvent.click(screen.getByRole("button", { name: "La taille" }))
    await screen.findByRole("button", { name: "96 px" })

    const avant = appels.length
    fireEvent.click(screen.getByRole("button", { name: "96 px" }))
    // **La vignette allumée est le réglage** : il n'y a rien à replier, et la
    // valeur se lit là où on l'a posée.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "96 px" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    )

    // **Aucune relecture de l'univers** : ce qui manquait est une pose, pas un
    // aller-retour. Le réglage n'a fait qu'un appel sur cette route — le PUT
    // lui-même —, et rien n'est allé la redemander derrière.
    //
    // L'aperçu du prompt, lui, se redemande, et c'est une autre question : un
    // champ de bible décoché change *ce qui part* sans toucher au prompt écrit
    // (R2, US-158). Le compter comme une relecture de l'univers ferait choisir
    // entre les deux tranches ; elles ne se contredisent pas.
    const depuis = appels.slice(avant).map((a) => a.url)
    expect(depuis.filter((u) => u.startsWith("/api/universe"))).toEqual([
      "/api/universe",
    ])
    expect(depuis.every((u) => u.startsWith("/api/universe") || u === "/api/prompt/preview")).toBe(
      true,
    )
  })

  test("la découpe posée se relit sur la carte du type qu'on a réglé", async () => {
    await ouvrirLUnivers()
    const types = await ouvrir("Les types d'objets")

    // **Les huit tiennent côte à côte, et c'est le point** : l'échelle d'un
    // type ne veut rien dire toute seule — ce qui compte est que le tonneau
    // soit plus petit que le nain, et cela ne se voit que si les deux sont à
    // l'écran. L'ancienne mesure qui plaidait le repli — 92 px par ligne
    // dépliée, 644 pour sept types — était juste sur une colonne de 380 px, et
    // cette colonne n'existe plus depuis E7.
    const carte = within(types.getByText("personnage").closest("li") as HTMLElement)

    // La découpe est le seul des trois réglages qui se dise en toutes lettres :
    // c'est donc lui qu'on lit après.
    fireEvent.click(carte.getByRole("button", { name: "il se découpe" }))

    await waitFor(() =>
      expect(
        carte.getByRole("button", { name: "plein cadre, pas de découpe" }),
      ).toBeTruthy(),
    )
  })

  test("le modèle par défaut d'une famille tient, et la colonne la compte", async () => {
    await ouvrirLUnivers()
    const defauts = await ouvrir("Les IA à utiliser")

    const personnages = defauts.getAllByRole("combobox")[0]
    fireEvent.change(personnages, { target: { value: "essai:modele" } })

    await waitFor(() =>
      expect((defauts.getAllByRole("combobox")[0] as HTMLSelectElement).value).toBe(
        "essai:modele",
      ),
    )
    expect(rangee("Les IA à utiliser").textContent).toContain("1 sur 4")
  })

  test("un réglage refusé laisse l'écran sur la valeur d'avant, avec sa raison", async () => {
    const { fetchDouble } = serveurDouble()
    const vrai = fetchDouble.getMockImplementation()!
    // Le serveur refuse **l'écriture** de l'univers, et rien d'autre : la forme
    // exacte d'un refus du produit — un code, une raison, et où aller.
    fetchDouble.mockImplementation(async (chemin: string, init?: RequestInit) => {
      if (init?.method === "PUT" && String(chemin).startsWith("/api/universe"))
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "univers_refuse",
            raison: "la taille de pixel cible va de 8 à 512 pixels",
            ou_aller: null,
          }),
        } as unknown as Response
      return vrai(chemin, init)
    })

    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "La taille" }))
    fireEvent.click(await screen.findByRole("button", { name: "96 px" }))

    expect(
      await screen.findByText("la taille de pixel cible va de 8 à 512 pixels"),
    ).toBeTruthy()
    // La valeur d'avant, jamais la valeur tentée.
    expect(
      screen.getByRole("button", { name: "64 px" }).getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("le flux d'un second onglet pose le même réglage, sans qu'on ait rien fait ici", async () => {
    const { flux } = await ouvrirLUnivers()
    fireEvent.click(screen.getByRole("button", { name: "La taille" }))
    await screen.findByRole("button", { name: "128 px" })

    // Ce que le serveur annonce **à tout onglet ouvert sur le projet** depuis
    // R1 : un réglage posé s'annonce toujours, et plus seulement quand
    // l'empreinte de palette a bougé.
    flux.emettre("univers", {
      projet: "bac-a-sable",
      nom: "Bac à sable",
      univers: { ...UNIVERS, cible_px: 128, vide: false },
      teintes: {},
      realignes: 0,
      conserves: 0,
    })

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "128 px" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    )
  })
})

// ── C1 · L'écran des personnages ────────────────────────────────────────────
//
// Ce que le serveur ne peut pas tenir : qu'un plan neuf soit là sans qu'on ait
// rien écrit, qu'une attitude ajoutée paraisse chez chacun, et surtout **que
// cet écran ne soit pas une grille d'assets** — ni recherche, ni filtres, ni
// sélection multiple. C'est cette privation qui préserve « une seule grille
// dans tout le produit » (`docs/archive/plan-versions-tenues.md` C1), et elle ne se vérifie qu'ici.

describe("l'écran des personnages", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** L'écran ouvert, **et borné à lui**. L'atelier reste monté derrière — c'est
   *  ce que « il couvre » veut dire —, donc une assertion posée sur tout le
   *  document trouverait la barre d'outils de la bibliothèque et prouverait le
   *  contraire de ce qu'elle croit prouver. */
  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli()
    return { ...double, flux, ecran }
  }

  // ── « Un projet neuf porte un plan de poses utilisable sans qu'aucune ligne
  //     n'ait été écrite » (US-116) ────────────────────────────────────────────

  test("le plan du jeu est là au premier lancement, sans qu'on ait rien écrit", async () => {
    await ouvrir()
    const ecran = await ouvrirLaRubrique("Leurs poses")

    for (const attitude of ["repos", "marche", "course", "attaque", "dégâts", "mort"])
      expect(ecran.getByLabelText(`Nom de l'attitude ${attitude}`)).toBeTruthy()
  })

  // ── « La matrice n'offre ni recherche, ni filtres, ni sélection multiple — et
  //     la grille de la bibliothèque reste la seule grille d'assets du
  //     produit » ──────────────────────────────────────────────────────────────

  test("ni le codex ni l'établi n'offrent recherche, filtre ou sélection multiple", async () => {
    const { ecran } = await ouvrir({
      personnages: [personnage("Le nain"), personnage("La prêtresse")],
    })

    // **La barre d'outils de la bibliothèque n'est plus derrière, elle est
    // ailleurs** (E1) : les trois onglets ne se recouvrent plus. L'assertion
    // dit donc quelque chose de plus fort qu'avant — il n'y a qu'un endroit
    // dans le produit où l'on cherche, et il n'est pas ici.
    expect(screen.queryByLabelText("Chercher dans la bibliothèque")).toBeNull()
    expect(ecran.queryByRole("searchbox")).toBeNull()

    // Le codex non plus : ses cartes se choisissent une à une.
    const codex = within(await cadreDuCodex())
    expect(codex.queryByRole("searchbox")).toBeNull()

    // **Les cases à cocher de C2 portent des attitudes, jamais des images**, et
    // c'est très exactement ce qui garde l'invariant vrai : on ne sélectionne
    // toujours aucun asset ici. Le jour où l'une d'elles cochera une vignette,
    // cet essai tombera — et c'est son métier.
    const coches = ecran.getAllByRole("checkbox") as HTMLInputElement[]
    expect(coches.length).toBeGreaterThan(0)
    for (const coche of coches) {
      expect(coche.getAttribute("aria-label")).toMatch(
        /^Faire partir .+ avec les autres$/,
      )
    }
  })

  // ── « Un personnage se crée avec un nom et une description ; sa description
  //     part avec chaque génération de pose, sans être retapée » (US-115) ──────

  test("un personnage se crée d'un nom, et se décrit une fois", async () => {
    const { fetchDouble } = await ouvrir()
    // **Écrire un nom crée la chose**, sur-le-champ : Entrée suffit, et il n'y
    // a pas de bouton *Ajouter* — un formulaire pour une déclaration aurait
    // fait deux gestes pour un.
    const nommer = await screen.findByLabelText("Nom de la chose du jeu à créer")
    fireEvent.change(nommer, { target: { value: "Le nain" } })
    fireEvent.keyDown(nommer, { key: "Enter" })

    // La chose créée s'ouvre : on la nomme pour la décrire, pas pour la ranger.
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir son établi" }))
    const description = await screen.findByLabelText("Description du personnage")
    fireEvent.change(description, {
      target: { value: "un forgeron nain à la barbe tressée" },
    })
    fireEvent.blur(description)

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/le-nain" &&
            (init as RequestInit)?.method === "PUT" &&
            String((init as RequestInit)?.body).includes("barbe tressée"),
        ),
      ).toBe(true),
    )
  })

  // ── « Un personnage rattaché à six poses affiche six cases vides ; une pose
  //     générée en remplit une, et les cinq autres restent visiblement
  //     vides » ─────────────────────────────────────────────────────────────────

  test("un personnage qui tient six attitudes montre six cases, et elles sont vides", async () => {
    const { ecran } = await ouvrir({ personnages: [personnage("Le nain")] })

    const cases = ecran
      .getAllByRole("button", { name: /Retirer .* de ce personnage/ })
      .map((bouton) => bouton.getAttribute("aria-label"))
    expect(cases).toHaveLength(6)
    // Vides, et **visiblement** vides : la case dit ce qu'elle attend.
    expect(ecran.getAllByText("0 / 1")).toHaveLength(6)
  })

  // ── « Une pose s'ajoute […] ; ajouter une pose ajoute une case vide à chaque
  //     personnage qui porte ce plan, et ne lance AUCUNE génération » (US-118) ──

  test("ajouter une attitude ajoute une case à chaque personnage, sans rien générer", async () => {
    const { fetchDouble } = await ouvrir({
      personnages: [personnage("Le nain"), personnage("La prêtresse")],
    })
    const ecran = await ouvrirLaRubrique("Leurs poses")

    fireEvent.change(ecran.getByLabelText("Nom de l'attitude à ajouter"), {
      target: { value: "saut" },
    })
    fireEvent.click(ecran.getByRole("button", { name: "Ajouter une attitude" }))

    // **La case ajoutée se lit dans l'établi de chaque chose, pas dans la liste
    // qui la déclare** : ce sont deux étages, et la V2.1 les sépare — la liste
    // s'impose à tout le monde, l'établi montre ce qu'elle donne à une chose.
    await ouvrirLEtabli("Le nain")
    await screen.findByRole("button", { name: "Retirer saut de ce personnage" })

    // …et chez l'autre, sans qu'il ait été réécrit : c'est le plan qui décide.
    await ouvrirLEtabli("La prêtresse")
    await screen.findByRole("button", { name: "Retirer saut de ce personnage" })

    // « Ajouter une pose ajoute une case vide, jamais une génération. »
    expect(
      fetchDouble.mock.calls.some(([url]) => String(url).startsWith("/api/generations")),
    ).toBe(false)
  })

  // ── « Un personnage dit lesquelles de ses poses il tient » (US-117) ─────────

  test("un figurant écarte ce qu'il ne tient pas, et peut le reprendre", async () => {
    const { ecran } = await ouvrir({ personnages: [personnage("Le marchand")] })

    fireEvent.click(ecran.getByRole("button", { name: "Retirer mort de ce personnage" }))

    await waitFor(() =>
      expect(
        ecran.queryByRole("button", { name: "Retirer mort de ce personnage" }),
      ).toBeNull(),
    )
    // Écartée n'est pas perdue : elle reste offerte, sous « pas pour lui ».
    fireEvent.click(ecran.getByRole("button", { name: "mort" }))
    await screen.findByRole("button", { name: "Retirer mort de ce personnage" })
  })

  // ── « Un personnage rattaché à six poses affiche six cases vides ; une pose
  //     générée en remplit une, et les cinq autres restent visiblement
  //     vides » (US-119) ────────────────────────────────────────────────────────

  test("une case pleine montre sa vignette, les autres restent visiblement vides", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      personnages: [
        personnage("Le nain", {
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: p.identifiant === "repos" ? [corps] : [],
            ...VIDE_C3,
          })),
        }),
      ],
    })

    // Une seule case pleine, et elle le dit deux fois : par sa vignette et par
    // son compte.
    expect(ecran.getByAltText("un nain au repos")).toBeTruthy()
    expect(ecran.getAllByText("0 / 1")).toHaveLength(5)
    expect(ecran.getAllByText("1 / 1")).toHaveLength(1)
    // Les cinq vides le disent aussi, plutôt que de ne rien montrer.
    expect(ecran.getAllByText("rien encore")).toHaveLength(5)
  })

  // ── « On lance depuis là une pose à la fois » — la matrice arme, l'atelier
  //     tire (US-120) ─────────────────────────────────────────────────────────

  test("fabriquer une attitude arme l'atelier au lieu de payer", async () => {
    const { fetchDouble, ecran } = await ouvrir({
      personnages: [
        personnage("Le nain", { description: "un forgeron nain à la barbe tressée" }),
      ],
    })

    fireEvent.click(ecran.getByRole("button", { name: "Fabriquer marche" }))

    // **Armer ne déplace plus personne** (E2) : la barre qui paie est au pied
    // de l'établi, à quelques pixels de la case qu'on vient d'armer. Il fallait
    // retourner à la galerie tant qu'elle était le seul écran à porter un
    // champ ; c'est fini, et l'onglet ne bouge pas.
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )
    // Le signalement est écrit à la place de l'auteur — c'est ce qu'il ne veut
    // plus retaper (US-115). **Le signalement seul** : depuis E14, la consigne
    // de l'attitude est une ligne à part, avec sa propre origine et son propre
    // interrupteur sur l'écran de confirmation. La coller ici obligerait cet
    // écran à deviner où finit l'un et où commence l'autre.
    const champ = await champDePrompt() as HTMLTextAreaElement
    expect(champ.value).toBe("un forgeron nain à la barbe tressée")
    // Et l'auteur est prévenu que la consigne part quand même — sans quoi il
    // la retaperait, et elle partirait en double.
    expect(
      screen.getByText(/la consigne de l'attitude part à côté/),
    ).toBeTruthy()
    // Et la case visée se **voit**, à côté du bouton qui paie. On cherche dans
    // la bande « Pour » et non dans tout l'écran : le fil d'Ariane porte lui
    // aussi le nom de la chose, et c'est sa place — dire où l'on est.
    const pour = within(screen.getByText("Pour").parentElement as HTMLElement)
    expect(pour.getByText("Le nain")).toBeTruthy()
    expect(screen.getByLabelText("Retirer marche de ce qui part")).toBeTruthy()
    // Rien n'est parti.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      ),
    ).toBe(false)
  })

  test("générer envoie la case visée, puis désarme", async () => {
    const { fetchDouble, ecran } = await ouvrir({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })

    fireEvent.click(ecran.getByRole("button", { name: "Fabriquer repos" }))
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )
    await payer()

    await waitFor(() => {
      const envoi = fetchDouble.mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      )
      expect(envoi).toBeTruthy()
      const corps = JSON.parse(String((envoi![1] as RequestInit).body))
      expect(corps.personnage).toBe("le-nain")
      expect(corps.pose).toBe("repos")
    })

    // **La cible se désarme dès que l'appel est parti** : la garder enverrait
    // l'image suivante — un tonneau, un décor — dans la case d'un personnage.
    await waitFor(() =>
      expect(screen.queryByLabelText("Retirer repos de ce qui part")).toBeNull(),
    )
  })

  // ── C2 · « On coche les poses qu'on veut voir partir ensemble, et elles
  //     partent en **un seul appel** » (US-128, US-129) ───────────────────────

  test("cocher deux attitudes arme un lot, et le dit avant de payer", async () => {
    const { fetchDouble, ecran } = await ouvrir({
      personnages: [
        personnage("Le nain", { description: "un forgeron nain à la barbe tressée" }),
      ],
    })

    // **Ce qui se coche est une attitude, pas une image.** L'invariant de C1
    // tient : on ne sélectionne toujours aucun asset dans cet écran.
    fireEvent.click(ecran.getByLabelText("Faire partir repos avec les autres"))
    fireEvent.click(ecran.getByLabelText("Faire partir marche avec les autres"))

    // Le geste n'existe qu'à partir de deux : un bouton sans objet ne se grise
    // pas, il ne paraît pas.
    const ensemble = await ecran.findByRole("button", {
      name: "Fabriquer ensemble ›",
    })
    fireEvent.click(ensemble)

    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )

    // **Le prompt reçoit le sujet, jamais la grille** : les attitudes partent
    // case par case dans les consignes de planche, repliées côté serveur.
    const champ = await champDePrompt() as HTMLTextAreaElement
    expect(champ.value).toBe("un forgeron nain à la barbe tressée")

    // Les deux attitudes se lisent à côté du bouton qui paie, et le lot le dit.
    expect(screen.getByLabelText("Retirer repos de ce qui part")).toBeTruthy()
    expect(screen.getByLabelText("Retirer marche de ce qui part")).toBeTruthy()
    expect(screen.getAllByText("2 attitudes, un seul appel").length).toBeGreaterThan(0)

    // Rien n'est parti.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      ),
    ).toBe(false)
  })

  test("un lot part en poses, jamais en pose — et le catalogue le sait", async () => {
    const { fetchDouble, ecran } = await ouvrir({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })

    fireEvent.click(ecran.getByLabelText("Faire partir repos avec les autres"))
    fireEvent.click(ecran.getByLabelText("Faire partir course avec les autres"))
    fireEvent.click(await ecran.findByRole("button", { name: "Fabriquer ensemble ›" }))
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )

    // **Le catalogue apprend qu'un lot est armé** : le gabarit compte dans le
    // plafond du modèle, et le défaut devient celui de la planche.
    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(([url]) => String(url).includes("cases=2")),
      ).toBe(true),
    )

    await payer()
    await waitFor(() => {
      const envoi = fetchDouble.mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      )
      expect(envoi).toBeTruthy()
      const corps = JSON.parse(String((envoi![1] as RequestInit).body))
      expect(corps.poses).toEqual(["repos", "course"])
      // **Une case ou N, jamais les deux** : un lot ne vise pas *une* case.
      expect(corps.pose).toBeNull()
      // **Un lot part en un seul appel**, quoi que le segment ait porté avant :
      // l'écran envoie ce qu'il affiche, sinon le refus arriverait après le
      // clic qui paie — ce que le grisé existe pour éviter.
      expect(corps.variations).toBe(1)
    })
  })

  test("une attitude se retire du lot sans le défaire", async () => {
    const { ecran } = await ouvrir({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })

    fireEvent.click(ecran.getByLabelText("Faire partir repos avec les autres"))
    fireEvent.click(ecran.getByLabelText("Faire partir marche avec les autres"))
    fireEvent.click(await ecran.findByRole("button", { name: "Fabriquer ensemble ›" }))
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )

    fireEvent.click(screen.getByLabelText("Retirer marche de ce qui part"))

    // La bande reste, avec ce qui reste dedans — **armer n'est pas s'engager**,
    // et retirer une attitude n'est pas tout défaire.
    expect(screen.getByLabelText("Retirer repos de ce qui part")).toBeTruthy()
    expect(screen.queryByLabelText("Retirer marche de ce qui part")).toBeNull()
  })

  // ── C2 · « Deux poses trop semblables dans un même lot sont signalées case
  //     par case ; le lot n'est pas refusé » (US-135) ─────────────────────────

  test("une case sortie d'un lot porte ses mesures, et rien n'est refusé", async () => {
    const corps = {
      ...asset("aaaa1111-100", "repos"),
      lot: {
        case: 0,
        cases: 4,
        grille_px: 4,
        ressemblance: 1,
        jumeau: 1,
        derive: 1,
      },
    }
    const { ecran } = await ouvrir({
      personnages: [
        personnage("Le nain", {
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: p.identifiant === "repos" ? [corps] : [],
            ...VIDE_C3,
          })),
        }),
      ],
    })

    // Le chiffre **et son jumeau** : « 0,98 » tout seul demanderait de chercher
    // à quoi. Aucun seuil, aucune couleur d'alarme — l'image est là, gardée.
    expect(ecran.getByText(/ressemblance 1\.00 · case 2/)).toBeTruthy()
    expect(ecran.getByText(/grille 4 px · dérive 1\.00×/)).toBeTruthy()
    expect(ecran.getByAltText("repos")).toBeTruthy()
  })

  test("l'écran dit ce qu'un compte faux coûterait, sans annoncer de risque", async () => {
    const { ecran } = await ouvrir({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
      couts: { [MODELE.identifiant]: 0.0245 },
    })

    fireEvent.click(ecran.getByLabelText("Faire partir repos avec les autres"))
    fireEvent.click(ecran.getByLabelText("Faire partir marche avec les autres"))
    fireEvent.click(await ecran.findByRole("button", { name: "Fabriquer ensemble ›" }))
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )

    // **Le coût d'un lot est celui d'un appel, pas de N** — c'est la promesse
    // de la tranche, et c'est le même chiffre qu'un compte faux ferait repayer.
    await screen.findByText("un compte faux")
    expect(screen.getByText("≈ $0,0245 · 2 cases")).toBeTruthy()
    expect(screen.getByText("≈ $0,0245 à repayer")).toBeTruthy()

    // **Aucune probabilité, nulle part.** Le produit dit ce que ça coûterait,
    // jamais si ça arrivera : il n'en sait rien, et l'écrire serait un nombre
    // qui ne mesure rien.
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText(/risque/i)).toBeNull()
  })

  test("une case ordinaire n'affiche aucune mesure de lot", async () => {
    const { ecran } = await ouvrir({
      personnages: [
        personnage("Le nain", {
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: p.identifiant === "repos" ? [asset("aaaa1111-0", "repos")] : [],
            ...VIDE_C3,
          })),
        }),
      ],
    })
    expect(ecran.queryByText(/ressemblance/)).toBeNull()
  })

  // ── « Aucun écran de création de personnage avec son propre prompt n'existe :
  //     le corps se désigne depuis une image née dans l'atelier » (US-122) ──────

  test("le corps se désigne depuis la fiche d'une image de l'atelier", async () => {
    const images = [asset("aaaa1111-0", "un nain")]
    const { fetchDouble } = serveurDouble({
      assets: images,
      personnages: [personnage("Le nain")],
    })
    await monter(fetchDouble, { ...ETAT, assets: images })

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    await screen.findByLabelText("Fermer la fiche")

    // Deux listes, jamais une seule : l'attitude appartient au personnage.
    fireEvent.change(await screen.findByLabelText("Personnage de cette image"), {
      target: { value: "le-nain" },
    })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/assets/aaaa1111-0/character" &&
            (init as RequestInit)?.method === "PUT" &&
            String((init as RequestInit)?.body).includes("le-nain"),
        ),
      ).toBe(true),
    )
  })

  test("sans personnage, la fiche dit quoi faire au lieu de montrer deux listes vides", async () => {
    const images = [asset("aaaa1111-0", "un tonneau")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    await screen.findByLabelText("Fermer la fiche")

    expect(screen.queryByLabelText("Personnage de cette image")).toBeNull()
    expect(screen.getByText(/Aucun personnage dans ce jeu/)).toBeTruthy()
  })

  // ── « Avant de lancer, chaque référence envoyée est listée avec sa
  //     provenance nommée » ; « la règle de préséance est affichée à l'écran,
  //     pas déduite » (US-121, US-126, US-127) ──────────────────────────────────

  const REFERENCES: CompteReferences = {
    total: 2,
    manuelles: 0,
    artworks: 1,
    concepts: 1,
    famille: "personnages",
    gabarit: 0,
    lignes: [
      {
        asset: "carte-officielle",
        role: "style",
        origine: "carte",
        provenance: "artwork officiel",
        ecartee_par: null,
      },
      {
        asset: "carte-concept",
        role: "style",
        origine: "carte",
        provenance: "concept art",
        ecartee_par: null,
      },
    ],
  }

  test("chaque référence est listée avec sa provenance, et la préséance est écrite", async () => {
    const { fetchDouble } = serveurDouble({ references: REFERENCES })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    expect(await screen.findByText("artwork officiel")).toBeTruthy()
    expect(screen.getByText("concept art")).toBeTruthy()
    // La règle **est affichée**, elle ne se déduit pas — c'est le critère.
    expect(
      screen.getByText(/la portée la plus étroite l'emporte/),
    ).toBeTruthy()
  })

  test("décocher une référence l'écarte pour cette génération seule, et le dit", async () => {
    const { fetchDouble } = serveurDouble({ references: REFERENCES })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    fireEvent.click(await screen.findByLabelText("Écarter artwork officiel"))

    // La ligne **reste** — barrée —, et elle dit la portée retenue.
    expect(screen.getByText("artwork officiel")).toBeTruthy()
    expect(screen.getByText(/écartée · cette génération/)).toBeTruthy()

    // Et rien n'a été écrit côté serveur : cette portée-là ne s'écrit nulle part.
    expect(
      fetchDouble.mock.calls.some(([url]) => String(url) === "/api/references"),
    ).toBe(false)

    // Elle part avec l'appel, et avec lui seul.
    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await payer()

    await waitFor(() => {
      const envoi = fetchDouble.mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      )
      expect(envoi).toBeTruthy()
      expect(
        JSON.parse(String((envoi![1] as RequestInit).body)).references_ecartees,
      ).toEqual(["carte-officielle"])
    })
  })

  test("élargir la portée au projet s'écrit, et ne touche pas l'univers", async () => {
    const { fetchDouble } = serveurDouble({ references: REFERENCES })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    fireEvent.click(await screen.findByLabelText("Écarter concept art"))
    fireEvent.click(screen.getByRole("button", { name: "+ projet" }))

    await waitFor(() => {
      const envoi = fetchDouble.mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/references" && (init as RequestInit)?.method === "PUT",
      )
      expect(envoi).toBeTruthy()
      const corps = JSON.parse(String((envoi![1] as RequestInit).body))
      expect(corps).toEqual({
        portee: "projet",
        ecartees: ["carte-concept"],
        personnage: null,
      })
    })

    // « Décocher ne modifie ni l'univers, ni les artworks officiels. » Aucun
    // appel n'est parti vers l'un ou vers l'autre.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          (String(url).startsWith("/api/universe") ||
            String(url).includes("/official")) &&
          (init as RequestInit)?.method !== undefined,
      ),
    ).toBe(false)
  })

  test("le coût est annoncé, et il dit quand il ne sait pas", async () => {
    // Jamais appelé : le produit le dit plutôt que d'inventer un tarif.
    const vierge = serveurDouble({ references: REFERENCES })
    await monter(vierge.fetchDouble)
    await ouvrirLesReglagesDeLAppel()
    // Le coût se lit deux fois — une dans le panneau, une au pied de la barre
    // qui paie, où il est écrit depuis E2. Les deux disent la même chose, et
    // c'est le même composant : on n'en interroge qu'un.
    expect((await screen.findAllByText("jamais appelé"))[0]).toBeTruthy()
    cleanup()

    // Mesuré : la médiane de ce que ce modèle a réellement facturé.
    FluxDouble.ouverts = []
    const mesure = serveurDouble({ references: REFERENCES, couts: { [MODELE.identifiant]: 0.0245 } })
    await monter(mesure.fetchDouble)
    await ouvrirLesReglagesDeLAppel()
    expect((await screen.findAllByText("≈ $0,0245"))[0]).toBeTruthy()
  })

  test("sans case visée, la portée « ce personnage » n'est pas proposée", async () => {
    const { fetchDouble } = serveurDouble({ references: REFERENCES })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    fireEvent.click(await screen.findByLabelText("Écarter artwork officiel"))

    // Elle ne désignerait personne : elle n'est pas offerte, et « + projet »
    // l'est. L'absence de contrôle **est** la raison, comme la réserve de T8.
    expect(screen.queryByRole("button", { name: "+ personnage" })).toBeNull()
    expect(screen.getByRole("button", { name: "+ projet" })).toBeTruthy()
  })
})



// ── R2 · Ce qui décide de l'apparence se voit et se règle ────────────────────
//
// Les six critères de la tranche qui portent sur **ce que l'écran montre**. Le
// reste — le texte composé, la bible à sept champs, la cible « aucune », ce que
// le projet impose — est tenu par `tests/test_r2.py`, et ces essais-ci ne le
// rejouent pas : ils vérifient que l'écran affiche ce qu'on lui rend, ce qui est
// très exactement le trou par lequel R1 est passée.

describe("ce qui décide de l'apparence se voit et se règle", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Un univers qui dit quelque chose, pour que l'aperçu ait de quoi montrer. */
  const AVEC_BIBLE: Univers = {
    ...UNIVERS,
    bible: UNIVERS.bible.map((c) =>
      c.nom === "monde"
        ? { ...c, texte: "marais de fer" }
        : c.nom === "rendu"
          ? { ...c, texte: "pixel art 16 bits" }
          : c,
    ),
    vide: false,
  }

  /** Ce que la bible d'`AVEC_BIBLE` donne une fois repliée en tête du prompt.
   *  Écrit une fois : c'est le texte que le double compose, et celui que
   *  l'écran doit rendre sans y toucher. */
  const BIBLE_PARTIE =
    "World: marais de fer\nRendering technique: pixel art 16 bits"

  /** Chercher **sans normaliser les blancs**. Les retours à la ligne de la
   *  bible font partie de ce qui part : la normalisation par défaut de la
   *  bibliothèque d'essai les écraserait en espaces, et l'essai passerait sur
   *  un texte que le modèle ne recevrait pas. */
  const brut = { normalizer: (texte: string) => texte.trim() }

  /** Le contenu d'une des trois parties du texte qui part, **titre compris**
   *  (R7) — c'est ce que le fournisseur reçoit pour cette partie-là. Rend
   *  `null` quand la partie n'est pas rendue, ce qui est le cas d'une partie
   *  vide. */
  const partieQuiPart = (clef: string) =>
    document.querySelector(`[data-partie-qui-part="${clef}"]`)?.textContent ?? null

  /** Attendre que l'écran de confirmation ait posé ce qui part, et rendre le
   *  texte entier tel qu'il partirait — la jonction des parties, titres
   *  compris. C'est ce que « Reprendre le texte » met dans le champ. */
  const texteEntier = (sujet: string) =>
    `CONTEXT\n\n${BIBLE_PARTIE}\n\nREQUEST\n\n${sujet}`

  const attendreCeQuiPart = async (sujet: string) =>
    waitFor(() => {
      expect(partieQuiPart("contexte")).toBe(`CONTEXT\n\n${BIBLE_PARTIE}`)
      expect(partieQuiPart("demande")).toBe(`REQUEST\n\n${sujet}`)
    })

  // ── « Avant de lancer, le texte exact qui partira s'affiche : bible active,
  //     sujet, consignes de pliage — dans l'ordre d'envoi » ──────────────────

  test("l'écran de confirmation montre la bible puis le sujet, dans l'ordre d'envoi", async () => {
    const { fetchDouble } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau cerclé" } })
    await relire()

    // **Le texte assemblé se lit mot pour mot**, et c'est celui-là qui part :
    // l'écran ne le recompose pas, il le rend tel que le serveur l'a rendu.
    // **Depuis R7 il se lit en trois parties**, chacune sous le titre que le
    // fournisseur reçoit — et recoller les parties dans l'ordre rend le texte
    // entier, à la ligne vide près.
    await waitFor(() =>
      expect(partieQuiPart("contexte")).toBe(`CONTEXT\n\n${BIBLE_PARTIE}`),
    )
    expect(partieQuiPart("demande")).toBe("REQUEST\n\nun tonneau cerclé")

    // Et les lignes sont **dans cet ordre** : la bible se replie en tête, le
    // sujet suit. L'ordre est celui du prompt, pas une préférence d'affichage —
    // on le lit donc sur la position, pas sur la présence.
    // On lit les **lignes** du milieu de l'écran, celles qu'on éteint et qu'on
    // corrige : la colonne de droite montre les mêmes mots rangés en parties,
    // et les compter deux fois ne dirait rien de l'ordre d'assemblage.
    const rendus = Array.from(
      document.querySelectorAll("[data-envoi] [data-texte-qui-part]"),
    ).map((n) => n.textContent!.trim())
    expect(rendus).toEqual(["marais de fer", "pixel art 16 bits", "un tonneau cerclé"])
  })

  test("ce qui part se demande au serveur — il n'est jamais recomposé à l'écran", async () => {
    // **La preuve tient dans l'appel**, pas dans le rendu : si l'écran savait
    // composer, il n'aurait aucune raison d'appeler. C'est ce que la tranche
    // interdit — « deux compositions écrites à deux endroits finiraient par
    // diverger, et celle qui compte est celle qui part ».
    const { fetchDouble, appels } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await relire()

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            (a.corps as { prompt?: string } | undefined)?.prompt === "un tonneau",
        ),
      ).toBe(true),
    )
  })

  // ── « Ce texte suit ce qu'on tape et ce qu'on décoche : décocher un champ de
  //     bible le retire de ce qui part » ──────────────────────────────────────

  test("décocher un champ de bible le retire de ce qui part", async () => {
    const { fetchDouble } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await relire()
    await attendreCeQuiPart("un tonneau")
    // On referme sans rien dépenser : décocher se fait dans les réglages du
    // jeu, et l'écran de confirmation se relit après.
    fireEvent.click(screen.getByRole("button", { name: /Revenir sans rien dépenser/ }))

    // **Par le vrai chemin, et pas par un message fabriqué** : on décoche à
    // l'écran Univers, le serveur écrit et rend l'univers entier, l'écran le
    // pose (R1) — et ce qui part, qui n'a jamais rien composé lui-même, se
    // redemande.
    await ouvrirLesReglagesDuJeu("L'allure")
    // **L'interrupteur est descendu dans la rangée de sa question**, et il n'y
    // en a plus qu'un : la version d'avant réglait le même texte à deux
    // endroits — le bloc *Bible* et celui des étiquettes —, ce que son propre
    // commentaire s'interdisait.
    fireEvent.click(await screen.findByRole("button", { name: "Comment c'est dessiné" }))
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Comment c'est dessiné — part avec chaque génération",
      }),
    )
    await screen.findByRole("button", {
      name: "Comment c'est dessiné — ne part pas",
    })
    // On revient là où l'on paie — c'est de là que l'écran de confirmation
    // s'ouvre, avec le champ.
    fireEvent.click(screen.getByRole("tab", { name: "Codex" }))

    const envoi = await relire()
    // Ni dans le texte assemblé, ni comme ligne : le champ n'est plus actif, il
    // n'a donc plus rien à éteindre — il n'existe pas.
    await waitFor(() =>
      expect(envoi.queryByText(/pixel art 16 bits/, brut)).toBeNull(),
    )
    expect(partieQuiPart("contexte")).toBe("CONTEXT\n\nWorld: marais de fer")
    expect(partieQuiPart("demande")).toBe("REQUEST\n\nun tonneau")
  })

  // ── « Le texte repris à la main part mot pour mot » · « Reprendre le texte
  //     n'écrit rien dans l'univers » ──────────────────────────────────────────

  test("reprendre le texte pose le texte exact et le fait partir mot pour mot", async () => {
    const { fetchDouble, appels } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await relire()
    await attendreCeQuiPart("un tonneau")

    fireEvent.click(screen.getByRole("button", { name: /Reprendre le texte/ }))

    // Le champ **est** désormais ce qui partira, bible comprise.
    const libre = (await screen.findByPlaceholderText(
      "Le texte part exactement tel qu'il est écrit ici.",
    )) as HTMLTextAreaElement
    // **Le texte entier, titres compris** (R7) : reprendre rend ce qui part,
    // et ce qui part porte ses trois titres. Un champ qui recevrait le texte
    // sans eux ferait partir autre chose que ce qui était montré.
    expect(libre.value).toBe(texteEntier("un tonneau"))

    fireEvent.change(libre, { target: { value: "a plain wooden barrel, painterly" } })
    await payer()

    await waitFor(() => {
      const envoi = appels.find((a) => a.url === "/api/generations" && a.corps)
      expect(envoi?.corps).toMatchObject({
        prompt: "a plain wooden barrel, painterly",
        repris: true,
      })
    })

    // **Et l'univers n'a pas bougé** : reprendre corrige une formulation, ça ne
    // démonte pas la bible du projet (US-159).
    expect(appels.filter((a) => a.url.startsWith("/api/universe") && a.corps)).toEqual([])
  })

  test("rendre la main à l'atelier remet l'habillage, sans perdre ce qui est écrit", async () => {
    const { fetchDouble } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await relire()
    await attendreCeQuiPart("un tonneau")
    fireEvent.click(screen.getByRole("button", { name: /Reprendre le texte/ }))
    await screen.findByPlaceholderText("Le texte part exactement tel qu'il est écrit ici.")

    fireEvent.click(screen.getByRole("button", { name: /Rendre la main/ }))

    // Le champ redevient le champ de sujet, et il garde ce qu'on y avait mis :
    // on ne perd pas du texte en changeant d'avis.
    const revenu = (await champDePrompt()) as HTMLTextAreaElement
    expect(revenu.value).toContain("un tonneau")
    // Et l'habillage est de retour — la bible reparaît, ligne par ligne, avec
    // son propre interrupteur.
    //
    // **Le sujet, lui, est le texte repris tel quel** : rendre la main ne
    // défait pas ce que reprendre avait posé dans le champ, titres compris. La
    // demande le porte donc en entier, et le contexte est de nouveau là.
    const envoi = await relire()
    await waitFor(() =>
      expect(partieQuiPart("contexte")).toBe(`CONTEXT\n\n${BIBLE_PARTIE}`),
    )
    expect(partieQuiPart("demande")).toBe(
      `REQUEST\n\n${texteEntier("un tonneau")}`,
    )
    expect(envoi.getByText("marais de fer", brut)).toBeTruthy()
    expect(envoi.getByLabelText("Éteindre monde")).toBeTruthy()
  })

  // ── « Une génération relancée depuis un asset repart avec le texte qui était
  //     parti, repris compris » ────────────────────────────────────────────────

  test("reprendre les réglages d'un asset renvoie le texte qui était parti", async () => {
    // Ce que la génération a enregistré est le prompt **habillé**. Le reposer
    // en mode atelier le ferait rhabiller une seconde fois : la bible partirait
    // en double. Il revient donc repris.
    const parti = `${BIBLE_PARTIE}\n\nun tonneau cerclé`
    const images = [asset("eeee5555-0")]
    const { fetchDouble, appels } = serveurDouble({
      assets: images,
      univers: AVEC_BIBLE,
      promptParti: parti,
    })
    await monter(fetchDouble, { ...ETAT, assets: images, univers: AVEC_BIBLE })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    fireEvent.click(screen.getByRole("button", { name: "jeu de réglages" }))

    const libre = (await screen.findByPlaceholderText(
      "Le texte part exactement tel qu'il est écrit ici.",
    )) as HTMLTextAreaElement
    expect(libre.value).toBe(parti)

    await payer()
    await waitFor(() => {
      const envoi = appels.find((a) => a.url === "/api/generations" && a.corps)
      expect(envoi?.corps).toMatchObject({ prompt: parti, repris: true })
    })
  })

  // ── « La fiche d'un asset nomme le traitement que le projet lui a imposé —
  //     cible, occupation, palette — et le distingue de ce que l'auteur a réglé
  //     à la main » ────────────────────────────────────────────────────────────

  test("la fiche nomme ce que le projet a imposé, et ce qui a été réglé à la main", async () => {
    // L'asset porte une grille de 32 px là où le projet en impose 64 : c'est
    // l'écart exact que « réglé à la main » nomme.
    const image = {
      ...asset("eeee5555-0"),
      recette: {
        passes: [],
        difference: null,
        recadrage: null,
        grille: { cible: 32, occupation: 40, ancrage: "bas" as const, decalage: 0, methode: "proche" as const },
        quantification: null,
        bords: null,
        contours: null,
        main: null,
        veille: [],
        nom: null,
      },
    }
    const { fetchDouble } = serveurDouble({
      assets: [image],
      impose: {
        impose: {
          passes: [],
          difference: null,
          recadrage: null,
          grille: { cible: 64, occupation: 40, ancrage: "bas", decalage: 0, methode: "proche" },
          quantification: null,
          bords: null,
          contours: null,
          main: null,
          veille: [],
          nom: null,
        },
        echelle: "objet tenu",
        nature: "image",
        detourage: null,
      },
    })
    await monter(fetchDouble, { ...ETAT, assets: [image] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // Replié, le bloc porte déjà les trois valeurs du projet — c'est ce qui
    // permet de lire la fiche entière sans rien ouvrir.
    const entete = await screen.findByRole("button", { name: /^Imposé par le projet/ })
    // **Quatre valeurs depuis D2** : la façon de réduire s'ajoute aux trois
    // autres, parce qu'elle décide autant du rendu que la taille.
    expect(entete.textContent).toContain("64 px · 40 % · au plus proche · aucune")

    fireEvent.click(entete)
    const bloc = within(entete.closest("section") as HTMLElement)
    // La cible diffère : réglée à la main. L'occupation, elle, est celle du
    // projet, et le mot « appliqué » le dit.
    const lignes = bloc.getAllByRole("listitem").map((li) => li.textContent)
    expect(lignes[0]).toContain("réglé à la main")
    expect(lignes[1]).toContain("40 % · objet tenu")
    expect(lignes[1]).toContain("appliqué")
  })

  test("la fiche dit qu'elle ne sait pas quand la génération a disparu", async () => {
    const { fetchDouble } = serveurDouble({
      assets: [asset("eeee5555-0")],
      impose: { impose: null, echelle: "", nature: "", detourage: null },
    })
    await monter(fetchDouble, { ...ETAT, assets: [asset("eeee5555-0")] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // « Zéro n'est pas une dimension mesurée, c'est l'absence de mesure » : le
    // produit l'avoue plutôt que de répondre « rien d'imposé », qui serait une
    // réponse différente et fausse.
    expect(
      await screen.findByRole("button", { name: /^Imposé par le projeton ne sait pas/ }),
    ).toBeTruthy()
  })

  // ── « Taille de pixel "aucune" » — la moitié écran ─────────────────────────

  test("« aucune » se choisit, se lit repliée, et dit ce qui continue de s'appliquer", async () => {
    const sansCible: Univers = { ...UNIVERS, cible_px: 0 }
    const double = serveurDouble({ univers: sansCible })
    await monter(double.fetchDouble, { ...ETAT, univers: sansCible })
    await ouvrirLesReglagesDuJeu("La taille")

    // **« Aucune » est une valeur, pas un trou**, et elle est en tête : c'est la
    // première question — *ce jeu est-il en pixel art ?* — et non la dernière.
    const aucune = await screen.findByRole("button", { name: /^aucune/ })
    expect(aucune.getAttribute("aria-pressed")).toBe("true")
    // Et ce qui continue de s'appliquer est dit là où on l'a choisi : sans
    // cette ligne, « aucune » se lirait comme « plus aucun traitement ».
    expect(
      screen.getByText(
        /aucune remise sur grille — le détourage, le recadrage et la palette/,
      ),
    ).toBeTruthy()

    // Et les types disent leur inaction plutôt que de laisser croire qu'ils
    // agissent. Ils sont une étape plus loin dans la liste depuis E7 : les cinq
    // réglages ne sont plus empilés dans une colonne, on en lit un à la fois.
    //
    // **Et « barème d'échelles » a quitté l'écran** : le mot est juste, il est
    // même précis, et personne ne cherche un barème en créant un jeu. Il survit
    // dans l'aide, où il sert à retrouver le mot du code.
    fireEvent.click(screen.getByRole("button", { name: "Les types d'objets" }))
    expect(
      await within(
        document.querySelector(`[data-etape="Les types d'objets"]`) as HTMLElement,
      ).findByText(/sans taille de pixel, la hauteur ne s'applique pas/),
    ).toBeTruthy()
    expect(screen.queryByText("Barème d'échelles")).toBeNull()
  })
})

// ── R3 · Faire entrer une image depuis l'écran ───────────────────────────────
//
// Les cinq critères de la tranche qui portent sur **le geste**. Le reste — la
// route qui prend les octets, le doublon par projet, « telle quelle » qui
// survit à l'effacement de l'index — est tenu par `tests/test_r3.py`.
//
// **Un appel par fichier, et chacun répond pour lui-même** : c'est ce que ces
// essais regardent en premier, parce que c'est la décision de la tranche. Un
// dépôt de trois fichiers dont un mauvais doit faire entrer les deux autres.

describe("faire entrer une image depuis l'écran", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const fichier = (nom: string, taille = 12) =>
    new File([new Uint8Array(taille)], nom, { type: "image/png" })

  /** Déposer sur la grille. `dataTransfer` est doublé parce que jsdom n'en
   *  fabrique pas : ce qui compte est ce que l'écran en lit — la liste des
   *  fichiers, et les types qui disent que ce n'est pas une carte tirée de la
   *  réserve. */
  const deposer = (cible: HTMLElement, fichiers: File[]) =>
    fireEvent.drop(cible, {
      dataTransfer: { files: fichiers, types: [], getData: () => "" },
    })

  /** La grille, **nommée** : elle est la surface qui reçoit le dépôt, dans ses
   *  trois états — pleine, filtrée à vide, ou vide. */
  const laGrille = () => screen.getByRole("region", { name: "Grille des images" })

  const champImport = () =>
    screen.getByLabelText("Importer des images") as HTMLInputElement

  // ── « Un bouton d'import fait entrer un fichier choisi, et le déposer sur la
  //     grille fait la même chose » ───────────────────────────────────────────

  test("le bouton et le dépôt font entrer la même chose, par la même route", async () => {
    const { fetchDouble, appels } = serveurDouble({ assets: [asset("aaaa1111-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.change(champImport(), { target: { files: [fichier("epee.png")] } })
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    deposer(laGrille(), [fichier("bouclier.png")])
    await waitFor(() => expect(tuiles()).toHaveLength(3))

    // **La même route pour les deux**, et c'est la moitié du critère : un
    // bouton qui passerait ailleurs que le dépôt serait deux gestes.
    const envois = appels.filter((a) => a.url.startsWith("/api/assets/upload"))
    expect(envois).toHaveLength(2)
    expect(envois.map((a) => new URL(a.url, "http://x").searchParams.get("nom"))).toEqual([
      "epee.png",
      "bouclier.png",
    ])
  })

  // ── « Plusieurs fichiers déposés d'un coup entrent tous, chacun avec son
  //     propre sort » · « Ce qui n'est pas une image est refusé en le nommant,
  //     et les autres fichiers du même dépôt entrent quand même » ─────────────

  test("un dépôt mêlé fait entrer les images et nomme celui qui n'en est pas", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // Un prompt écrit **avant** le dépôt : sans lui, Générer est déjà grisé
    // faute de sujet, et l'essai ne prouverait rien de ce qu'il annonce.
    fireEvent.change(await champDePrompt(), {
      target: { value: "un tonneau" },
    })
    // Le dépôt se fait sur la grille, qui est dans la galerie : on paie d'un
    // côté, on fait entrer et l'on juge de l'autre.
    laGalerie()
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    deposer(laGrille(), [
      fichier("epee.png"),
      new File(["des notes"], "notes.txt", { type: "text/plain" }),
      fichier("bouclier.png"),
    ])

    // Les deux images entrent — le fichier refusé ne les a pas retenues.
    await waitFor(() => expect(tuiles()).toHaveLength(3))

    // Et le refus **nomme le fichier** : c'est tout ce qu'il doit apprendre,
    // et c'est ce qui permet de savoir lequel des douze pose problème.
    expect(await screen.findByText(/« notes.txt » n'est pas une image/)).toBeTruthy()

    // **Il ne va pas à la barre d'état**, où il griserait Générer : un import
    // refusé n'empêche pas de générer. Le bouton qui paie est au pied du codex
    // depuis E2 — la galerie n'en a plus, et c'est très exactement pourquoi le
    // refus ne peut pas l'atteindre.
    await champDePrompt()
    expect(screen.getByRole("button", { name: /^Générer/ })).not.toBeDisabled()
  })

  // ── « Un doublon est signalé avec le lien vers l'existant, et l'import forcé
  //     reste possible — comme au tableau d'inspiration » ────────────────────

  test("un doublon propose de voir l'existante ou d'importer quand même", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, assets: [] })

    fireEvent.change(champImport(), { target: { files: [fichier("epee.png")] } })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // Le même fichier une seconde fois : signalé, pas refusé.
    fireEvent.change(champImport(), { target: { files: [fichier("epee.png")] } })
    expect(
      await screen.findByText(/« epee.png » est déjà dans la bibliothèque/),
    ).toBeTruthy()
    // Rien n'est entré tant qu'on n'a pas tranché.
    expect(tuiles()).toHaveLength(1)

    // **Le lien vers l'existante** : elle s'ouvre dans la fiche.
    fireEvent.click(screen.getByRole("button", { name: "La voir ›" }))
    await screen.findByLabelText("Fermer la fiche")

    // Et l'import forcé reste possible.
    fireEvent.change(champImport(), { target: { files: [fichier("epee.png")] } })
    await screen.findByText(/« epee.png » est déjà dans la bibliothèque/)
    fireEvent.click(screen.getByRole("button", { name: "Importer quand même ›" }))
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    const force = appels
      .filter((a) => a.url.startsWith("/api/assets/upload"))
      .some((a) => new URL(a.url, "http://x").searchParams.get("forcer") === "true")
    expect(force).toBe(true)
  })

  // ── « Le choix "traitement du projet / telle quelle" est offert au moment de
  //     l'import, et le défaut est "telle quelle" » ──────────────────────────

  test("le choix est là, et le défaut est l'image brute", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, assets: [] })

    // **Le libellé dit ce qui se passera**, pas ce que le clic ferait : c'est
    // la forme du détourage d'une échelle dans le barème, et la seule qui se
    // lise sans avoir à l'essayer.
    const choix = await screen.findByRole("button", { name: "brute" })
    expect(choix.getAttribute("aria-pressed")).toBe("false")

    fireEvent.change(champImport(), { target: { files: [fichier("reference.png")] } })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    expect(
      new URL(appels.at(-1)!.url, "http://x").searchParams.get("traiter"),
    ).not.toBe("true")

    // Retourné, il envoie l'autre — et il le dit avant qu'on dépose.
    fireEvent.click(choix)
    const pose = await screen.findByRole("button", { name: "traitée" })
    expect(pose.getAttribute("aria-pressed")).toBe("true")

    fireEvent.change(champImport(), { target: { files: [fichier("sujet.png")] } })
    await waitFor(() => expect(tuiles()).toHaveLength(2))
    const dernier = appels.filter((a) => a.url.startsWith("/api/assets/upload")).at(-1)!
    expect(new URL(dernier.url, "http://x").searchParams.get("traiter")).toBe("true")
  })

  test("une bibliothèque vide accepte le dépôt — c'est là qu'il sert le plus", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, assets: [] })

    // L'état vide, et non la grille : c'est lui qui occupe la place quand il
    // n'y a rien, et une surface qui n'accepterait le dépôt qu'une fois pleine
    // serait fermée au moment où elle sert le plus.
    await screen.findByText(/Rien n'est encore sorti d'ici/)
    deposer(laGrille(), [fichier("premiere.png")])

    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })
})

// ── R4 · L'infobulle ne couvre plus le réglage ───────────────────────────────
//
// **La moitié que jsdom peut voir, et elle est nécessaire.** Où la bulle se
// pose est vérifié sur de vrais rectangles dans `Infobulle.test.tsx` — jsdom ne
// met rien en page, donc un essai qui mesurerait ici le recouvrement lirait des
// zéros et passerait avant comme après la correction.
//
// Ce qui se vérifie ici est l'autre moitié : **que chaque panneau de réglages
// se déclare**, et qu'une poignée d'infobulle vit bien dedans. Sans ça, la
// règle serait juste et ne s'appliquerait à personne.

describe("l'infobulle sort du panneau, sur les trois écrans", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Une poignée d'infobulle : le libellé souligné en pointillé. */
  const poignee = (nom: string) =>
    [...document.querySelectorAll("span")].find(
      (e) => e.textContent === nom && e.className.includes("decoration-dotted"),
    )

  test("l'atelier : la colonne des réglages se déclare, et sa poignée est dedans", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    await waitFor(() => expect(poignee("Variations")).toBeTruthy())
    // **Le panneau est l'ancêtre déclaré**, et c'est lui que la règle mesure.
    // À l'atelier, la bulle sortait déjà du bon côté — ce que R4 change est
    // qu'elle sort désormais de *la colonne* et non de la moitié d'écran, donc
    // qu'elle dégage aussi le réglage d'à côté.
    expect(poignee("Variations")!.closest("[data-panneau]")).toBeTruthy()
  })

  test("l'univers : le panneau se déclare, et sa poignée est dedans", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDuJeu("L'allure")

    // **La poignée ne monte pas sur le titre de l'étape** : un titre d'écran
    // fait 24 px en serif, et le pointillé est dessiné pour les 11 px d'un
    // libellé. Elle se pose sur la ligne de repère juste au-dessus, qui dit le
    // rang de l'étape et son groupe.
    const marque = await waitFor(() => {
      // **Sixième depuis D2** : le style graphique s'est glissé en deuxième.
      const trouvee = poignee("étape 6 · le style")
      expect(trouvee).toBeTruthy()
      return trouvee!
    })
    expect(marque.closest("[data-panneau]")).toBeTruthy()
  })

  test("la fiche : le panneau se déclare, et sa poignée est dedans", async () => {
    const images = [asset("aaaa1111-0")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // **La poignée que la fiche garde après E4.** Les cinq places sont parties
    // dans les tables ; ce qui reste est ce que l'image *est*, et sa recette
    // s'y lit sans s'y régler.
    const marque = poignee("Sa recette")
    expect(marque).toBeTruthy()
    expect(marque!.closest("[data-panneau]")).toBeTruthy()
  })

  test("les réglages : le panneau posé sur l'atelier se déclare aussi", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    const marque = await waitFor(() => {
      const trouvee = poignee("Plafond de la séance")
      expect(trouvee).toBeTruthy()
      return trouvee!
    })
    expect(marque.closest("[data-panneau]")).toBeTruthy()
  })

  test("la barre d'outils ne se déclare pas, et c'est voulu", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // Une barre traverse l'écran : « hors du panneau » n'y voudrait rien dire,
    // et la bulle y retombe sur la règle de l'ancre — celle d'avant R4, juste
    // là où elle l'était.
    const marque = await waitFor(() => {
      const trouvee = poignee("Importer")
      expect(trouvee).toBeTruthy()
      return trouvee!
    })
    expect(marque.closest("[data-panneau]")).toBeNull()
  })

  // ── « Pointer un autre élément referme la bulle non épinglée sans qu'il
  //     faille la chasser » · « une bulle épinglée reste, et Échap la lâche » ──

  test("la bulle non épinglée part quand on pointe ailleurs ; épinglée, elle reste", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    const marque = await waitFor(() => {
      const trouvee = poignee("Variations")
      expect(trouvee).toBeTruthy()
      return trouvee!
    })

    fireEvent.mouseEnter(marque)
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.getByRole("tooltip")).toBeTruthy()

    // Pointer ailleurs : elle part d'elle-même, sans qu'on ait à la chasser.
    fireEvent.mouseLeave(marque)
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByRole("tooltip")).toBeNull()

    // Épinglée, elle reste — et Échap la lâche. Inchangé par R4.
    fireEvent.mouseEnter(marque)
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    fireEvent.click(marque)
    fireEvent.mouseLeave(marque)
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(screen.getByRole("tooltip")).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull())
    vi.useRealTimers()
  })
})

// ── C3 — la pièce et le calque ───────────────────────────────────────────────
//
// **Ce qui est ici est ce que le serveur ne peut pas tenir.** Six des seize
// critères de C3 portent sur ce que l'écran montre — une pose inéligible qui
// porte sa raison, un calque posé sur son corps, une zone qu'on traîne — et
// aucun d'eux ne se prouve dans `tests/test_c3.py` : le serveur y refuse, il
// n'affiche pas. Les dix autres y sont, et ne sont pas redits ici.

describe("l'écran des personnages — la pièce et le calque", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli()
    return { ...double, flux, ecran }
  }

  const CASQUE: Piece = {
    identifiant: "casque",
    nom: "casque",
    description: "un casque de fer à cornes",
    emplacement: "tete",
    portee: "contenue",
    concept_arts: [],
  }
  const TETE: EmplacementCorps = { identifiant: "tete", nom: "tête", rang: 0 }

  /** Un calque : une image qui porte une pièce **et** une différence. C'est la
   *  recette qui dit ce qu'elle est — jamais un drapeau de plus. */
  const calque = (identifiant: string, base: string, sur: Partial<Asset> = {}): Asset => ({
    ...asset(identifiant, "casque · repos"),
    piece: "casque",
    pose: "repos",
    personnage: "le-nain",
    recette: {
      ...RECETTE_VIDE,
      difference: {
        base,
        zone: null,
        seuil: 32,
        // **Les deux couches de la main, vides** (C4) : un calque qui vient de
        // naître n'a été touché par personne, et c'est l'état qui décide de sa
        // place dans ce qui reste à regarder.
        affinage: [],
        retouche: [],
      },
    },
    calque: {
      silhouette: 0.995,
      repeint: 0.003,
      ajout: 0.061,
      echelle: 1,
      compacite: 0.98,
      // Déduits par le serveur, jamais recalculés à l'écran (C4, US-152) : ici
      // c'est la compacité qui est la moins bonne — 1 − 0,98.
      pire: "objet ou poussière",
      gravite: 0.02,
    },
    ...sur,
  })

  /** Un personnage dont la pose « repos » a un corps, et rien d'autre. */
  const avecCorps = (corps: Asset, calques: Asset[] = []) =>
    personnage("Le nain", {
      cases: PLAN.map((p) => ({
        pose: p.identifiant,
        demandees: p.images,
        images: p.identifiant === "repos" ? [corps] : [],
        calques: (p.identifiant === "repos" && calques.length
          ? { casque: calques }
          : {}) as Record<string, Asset[]>,
        corps: p.identifiant === "repos" ? corps.identifiant : null,
        origine: "type" as const,
        directions: [],
        directions_rangees: [],
        sans_direction: [],
      })),
    })

  // ── « Écrire un nom d'emplacement ou de pièce qui n'existe pas le crée
  //     sur-le-champ » (US-138) ────────────────────────────────────────────────

  test("nommer une pièce la crée, et crée son emplacement avec elle", async () => {
    const { appels } = await ouvrir()
    const ecran = await ouvrirLaRubrique("Équipement")

    fireEvent.change(ecran.getByLabelText("Nom de la pièce à ajouter"), {
      target: { value: "casque" },
    })
    fireEvent.change(
      ecran.getByLabelText("Emplacement de la pièce sur le corps — créé s'il n'existe pas"),
      { target: { value: "tête" } },
    )
    fireEvent.click(ecran.getByRole("button", { name: "Ajouter" }))

    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/characters/pieces"),
      ).toBe(true),
    )
    // **Ranger n'est jamais un préalable** : l'écran envoie le nom de
    // l'emplacement, il n'a pas eu à le créer d'abord.
    const envoye = appels.find((a) => a.url === "/api/characters/pieces")
      ?.corps as Record<string, unknown>
    expect(envoye.emplacement).toBe("tête")
    // Et l'emplacement paraît, avec sa pièce dessous.
    await waitFor(() => expect(ecran.getByText("tête")).toBeTruthy())
  })

  // ── « Une pièce déclare sa portée — contenue ou qui agrandit —, le défaut est
  //     « contenue », et rien ne la devine à la place de l'auteur » (US-139) ────

  test("la portée d'une pièce se déclare, et le défaut est « contenue »", async () => {
    const { appels } = await ouvrir({
      emplacements: [{ identifiant: "dos", nom: "dos", rang: 0 }],
      pieces: [
        {
          identifiant: "cape",
          nom: "cape",
          description: "une longue cape qui traîne au sol",
          emplacement: "dos",
          // **Rien ne lit le mot « cape »** : elle arrive contenue, comme tout
          // ce que l'auteur n'a pas déclaré.
          portee: "contenue",
          concept_arts: [],
        },
      ],
    })

    const ecran = await ouvrirLaRubrique("Équipement")
    const portee = ecran.getByLabelText("Portée de cape") as HTMLSelectElement
    expect(portee.value).toBe("contenue")

    fireEvent.change(portee, { target: { value: "agrandit" } })
    await waitFor(() =>
      expect(
        appels.find((a) => a.url === "/api/characters/pieces/cape")?.corps,
      ).toEqual({ portee: "agrandit" }),
    )
  })

  // ── « Une planche d'équipement où figurerait une pose sans corps est
  //     impossible à lancer : la pose est visiblement inéligible et porte sa
  //     raison » (US-141) ──────────────────────────────────────────────────────

  test("une pose sans corps est inéligible, porte sa raison, et ne se coche pas", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps)],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    // Celle qui a un corps s'arme.
    expect(ecran.getByRole("button", { name: "Habiller repos de casque" })).toBeTruthy()
    // Celle qui n'en a pas **porte sa raison**, et sa coche est éteinte.
    expect(ecran.getByText(/« marche » n'a pas encore de corps/)).toBeTruthy()
    expect(
      (ecran.getByLabelText("Habiller marche avec casque") as HTMLInputElement)
        .disabled,
    ).toBe(true)
    // Et rien ne propose de la lancer : il n'y a pas de chose indisponible, il
    // n'y a rien du tout.
    expect(ecran.queryByRole("button", { name: "Habiller marche de casque" })).toBeNull()
  })

  // ── « Chacun de ces calques s'affiche superposé au corps de sa pose »
  //     (US-143) ──────────────────────────────────────────────────────────────

  test("le calque s'affiche superposé au corps de sa pose", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    const vignette = ecran.getByRole("button", { name: "Ouvrir casque · repos" })

    // **Deux images dans le même cadre** : le corps dessous, le calque dessus.
    // Une seule aurait été un calque flottant, et l'auteur n'aurait rien à
    // juger — c'est très exactement ce que US-143 demande de voir.
    const images = Array.from(vignette.querySelectorAll("img"))
    expect(images.length).toBe(2)
    // L'adresse d'une image se lit sur sa génération et son rang — un seul
    // endroit du produit la nomme (`Apercu.imageAsset`), et l'essai la lit là où
    // elle est écrite plutôt que de la recomposer.
    expect(images[0].getAttribute("src")).toContain("aaaa1111/slots/0/image")
    expect(images[1].getAttribute("src")).toContain("bbbb2222/slots/100/image")
  })

  // ── « Les mesures s'affichent toutes, et aucune ne rend un calque impossible
  //     à garder » (US-147) ────────────────────────────────────────────────────

  test("les cinq mesures s'affichent, et aucune n'a de seuil ni de couleur d'alarme", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))

    for (const nom of [
      "silhouette retrouvée",
      "corps repeint",
      "part ajoutée",
      "échelle au retour",
      "objet ou poussière",
    ])
      expect(await ecran.findByText(nom)).toBeTruthy()

    // **Aucune ne refuse, et aucune ne s'alarme.** `--echec` veut dire *ce qui
    // échoue ou ce qui détruit*, et un calque gardé n'échoue pas.
    expect(
      document.querySelector("[data-univers] .text-echec"),
    ).toBeNull()
  })

  // ── « Le masque rectangle d'un calque déjà fabriqué se déplace et se
  //     retaille » (US-145) ────────────────────────────────────────────────────

  test("la zone se trace au glissement, et se retire d'un geste", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))

    const cadre = await ecran.findByRole("application", {
      name: "Zone du calque casque sur repos",
    })
    // jsdom ne met rien en page : le cadre mesure zéro, donc **tous les
    // pointeurs tombent au même pixel**. On borne donc l'essai à ce qu'il peut
    // honnêtement prouver — que le geste part au serveur, et qu'il en revient
    // sans zone quand il n'a pas glissé. La géométrie, elle, est une fonction
    // pure, et c'est `placer()` de l'infobulle qui a montré la voie.
    fireEvent.pointerDown(cadre, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(cadre, { clientX: 90, clientY: 90, pointerId: 1 })
    fireEvent.pointerUp(cadre, { clientX: 90, clientY: 90, pointerId: 1 })

    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/assets/bbbb2222-100/layer"),
      ).toBe(true),
    )
    // **Rien n'a été redemandé au fournisseur** : poser une zone ne passe par
    // aucune route de génération.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  // ── « Une pièce qui agrandit, revenue à une autre échelle, ne produit aucun
  //     calque : la dérive est nommée à l'écran » (US-148) ─────────────────────

  test("un corps habillé dit qu'il n'est pas un calque, et nomme la dérive", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const habille = calque("bbbb2222-100", corps.identifiant, {
      // **Aucune différence** : ce qui revient est gardé, mais il ne s'empile
      // pas. C'est la recette qui le dit, et rien d'autre.
      recette: RECETTE_VIDE,
      calque: {
        silhouette: 1,
        repeint: 0.235,
        ajout: 2.03,
        echelle: 0.62,
        compacite: 0.41,
        // L'écart d'échelle est rapporté à la tolérance du produit — 0,38 pour
        // 0,08 —, donc plafonné : au-delà, il n'y a plus de calque à graduer.
        pire: "échelle au retour",
        gravite: 1,
      },
    })
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [{ ...CASQUE, portee: "agrandit" }],
      personnages: [avecCorps(corps, [habille])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    expect(ecran.getByText(/corps habillé/)).toBeTruthy()

    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))
    // La dérive est **nommée**, avec le chiffre qui a décidé.
    expect(await ecran.findByText(/0,62× de la taille envoyée/)).toBeTruthy()
    expect(ecran.getByText(/il ne s'empile pas/)).toBeTruthy()
  })

  // ── « Le produit ne propose nulle part de reposer un calque sur une autre
  //     pose que la sienne » ───────────────────────────────────────────────────

  test("aucun geste ne propose de reposer un calque ailleurs", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    // La colonne du corps porte le geste qui vide une case ; celle d'une pièce,
    // non — **un calque est solidaire de sa pose**, et il n'y a donc rien à
    // défaire ni à reposer.
    expect(ecran.queryByLabelText(/Retirer cette image de la case/)).toBeNull()
    expect(ecran.queryByText(/reposer/i)).toBeNull()
  })

  // ── « La matrice n'offre ni recherche, ni filtres, ni sélection multiple »
  //     — reconduit en C3 ─────────────────────────────────────────────────────

  test("la colonne d'une pièce ne fait pas de la matrice une grille", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    // Ni recherche, ni filtre — l'invariant de C1, reconduit.
    expect(ecran.queryByRole("searchbox")).toBeNull()
    // **Et ce qui se coche reste une attitude**, jamais une vignette : chaque
    // case à cocher de cette colonne nomme une pose, et le jour où l'une d'elles
    // passera sur une image, cet essai tombera. C'est son métier.
    for (const coche of ecran.getAllByRole("checkbox"))
      expect(coche.getAttribute("aria-label")).toMatch(/^Habiller .+ avec casque$/)
  })

  // ── R5 · « Le recalage se rejoue depuis la planche, sans un centime »
  //     (US-173) ───────────────────────────────────────────────────────────────

  test("le calque se recale depuis sa planche, et rien n'est redemandé", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))

    fireEvent.click(
      await ecran.findByRole("button", { name: /Recaler depuis la planche/ }),
    )

    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/assets/bbbb2222-100/realign"),
      ).toBe(true),
    )
    // **Aucun centime**, et ça se vérifie ici comme au serveur : le rejeu ne
    // passe par aucune route de génération.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  test("un corps habillé porte le rejeu, parce que c'est lui qui en a besoin", async () => {
    // Le cas du 29 août 2026 : la dérive a été prononcée sur une échelle
    // inventée, et l'image est rangée comme un corps habillé. Le geste qui la
    // répare doit donc être **là aussi**, pas seulement sur les calques.
    const corps = asset("aaaa1111-0", "un nain au repos")
    const habille = calque("bbbb2222-100", corps.identifiant, {
      recette: RECETTE_VIDE,
    })
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [habille])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))

    expect(
      await ecran.findByRole("button", { name: /Recaler depuis la planche/ }),
    ).toBeTruthy()
  })

  // ══ C4 · La main ═══════════════════════════════════════════════════════════
  //
  // **Ce que jsdom peut honnêtement prouver, et rien de plus.** Il ne met rien
  // en page : le cadre mesure zéro, donc tous les pointeurs tombent au même
  // pixel. Ce qui se vérifie ici est donc *ce qui part* — la couche visée, le
  // rayon, le sens — et *ce qui paraît* : le corps sous la retouche, l'avant
  // sous l'appui, le tri de la colonne. La géométrie du pinceau, elle, est une
  // fonction pure, et elle s'éprouve au serveur (`tests/test_c4.py`).

  /** Ouvrir le panneau d'un calque, et rendre son cadre — le geste commun à
   *  tous les essais de C4. */
  const ouvrirCalque = async (ecran: ReturnType<typeof within>) => {
    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))
    return await ecran.findByRole("application", {
      name: "Zone du calque casque sur repos",
    })
  }

  const glisser = (cadre: HTMLElement) => {
    fireEvent.pointerDown(cadre, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(cadre, { clientX: 40, clientY: 60, pointerId: 1 })
    fireEvent.pointerUp(cadre, { clientX: 40, clientY: 60, pointerId: 1 })
  }

  const dernierAppel = (
    appels: { url: string; corps: unknown }[],
    url: string,
  ) => appels.filter((a) => a.url === url).at(-1)?.corps as
    | { couche: string; traits: { garde: boolean; rayon: number }[] }
    | undefined

  // ── « Un masque s'affine à main levée, puis au pixel, sans repayer
  //     d'image » (US-149) ─────────────────────────────────────────────────────

  test("le masque s'affine à main levée puis au pixel, et rien n'est repayé", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    const cadre = await ouvrirCalque(ecran)

    // **À main levée** — le rayon offert au repos, et la couche du masque.
    fireEvent.click(ecran.getByRole("button", { name: "masque" }))
    glisser(cadre)

    await waitFor(() =>
      expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")).toBeTruthy(),
    )
    const large = dernierAppel(appels, "/api/assets/bbbb2222-100/hand")!
    expect(large.couche).toBe("affinage")
    expect(large.traits.at(-1)!.rayon).toBeGreaterThan(0)

    // **Puis au pixel** — le même geste, le même envoi, un rayon de moins.
    // Les deux échelles sont les deux bouts d'un seul réglage.
    fireEvent.click(ecran.getByRole("button", { name: "1 px" }))
    glisser(cadre)

    await waitFor(() =>
      expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")!.traits).toHaveLength(2),
    )
    const fin = dernierAppel(appels, "/api/assets/bbbb2222-100/hand")!
    expect(fin.couche).toBe("affinage")
    expect(fin.traits.at(-1)!.rayon).toBe(0)
    // **La liste est entière, jamais un ajout** : le second envoi porte les deux
    // passages, et pas seulement le dernier.
    expect(fin.traits).toHaveLength(2)

    // Rien n'a été redemandé au fournisseur.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  // ── « Un calque se retouche au pixel avec le corps affiché en repère sous
  //     lui » (US-150) ─────────────────────────────────────────────────────────

  test("la retouche vise l'autre couche, et le corps reste en repère dessous", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    const cadre = await ouvrirCalque(ecran)
    fireEvent.click(ecran.getByRole("button", { name: "retouche" }))

    // **Le corps est là, sous le calque** : c'est lui le repère, et sans lui on
    // corrigerait sans savoir sur quoi ça se pose.
    const dessous = cadre.querySelector('img[alt=""]') as HTMLImageElement | null
    expect(dessous).toBeTruthy()
    expect(dessous!.getAttribute("src")).toContain(corps.generation)

    // **Ôter, au pixel** — la seconde couche, et le sens que le segment dit.
    fireEvent.click(ecran.getByRole("button", { name: "ôter" }))
    fireEvent.click(ecran.getByRole("button", { name: "1 px" }))
    glisser(cadre)

    await waitFor(() =>
      expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")).toBeTruthy(),
    )
    const pose = dernierAppel(appels, "/api/assets/bbbb2222-100/hand")!
    expect(pose.couche).toBe("retouche")
    expect(pose.traits.at(-1)).toMatchObject({ garde: false, rayon: 0 })
  })

  // ── « L'avant et l'après se comparent d'un seul geste » (US-151) ────────────

  test("tenir montre l'avant, et lâcher rend l'après", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    // Un calque que la main a déjà touché : sans ça il n'y a rien à comparer.
    const touche = calque("bbbb2222-100", corps.identifiant)
    touche.recette.difference!.retouche = [
      { garde: true, rayon: 2, points: [[4, 4]], couleur: "" },
    ]
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [touche])],
    })

    const cadre = await ouvrirCalque(ecran)
    const dessus = () =>
      (cadre.querySelector('img[alt="casque · repos"]') as HTMLImageElement).src

    const apres = dessus()
    expect(apres).not.toContain("avant=true")

    const bouton = ecran.getByRole("button", { name: "Voir le calque avant la main" })
    fireEvent.pointerDown(bouton)
    expect(dessus()).toContain("avant=true")

    // **Lâcher rend l'après.** Une bascule aurait laissé l'écran sur l'avant, et
    // la retouche suivante se serait faite sur une image qui n'est plus celle
    // qu'on modifie.
    fireEvent.pointerUp(bouton)
    expect(dessus()).toBe(apres)

    // Comparer ne redemande rien : c'est un calcul du serveur, pas un appel.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  test("sans main posée, il n'y a rien à comparer — et le geste est absent", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    await ouvrirCalque(ecran)
    // **Absent, pas grisé** — la bascule de `+ personnage` et du geste du lot :
    // le grisé suppose une chose indisponible, et ici il n'y a pas de chose.
    expect(
      ecran.queryByRole("button", { name: "Voir le calque avant la main" }),
    ).toBeNull()
  })

  // ── « Le masque et la retouche sont deux couches distinctes, et chacune
  //     s'annule » (US-153, C4) ────────────────────────────────────────────────

  test("chaque couche s'annule seule, et l'autre ne bouge pas", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const deux = calque("bbbb2222-100", corps.identifiant)
    deux.recette.difference!.affinage = [
      { garde: false, rayon: 2, points: [[1, 1]], couleur: "" },
    ]
    deux.recette.difference!.retouche = [
      { garde: true, rayon: 0, points: [[4, 4]], couleur: "" },
    ]
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [deux])],
    })

    await ouvrirCalque(ecran)

    fireEvent.click(ecran.getByRole("button", { name: "masque" }))
    fireEvent.click(ecran.getByRole("button", { name: /Sans passages/ }))
    await waitFor(() =>
      expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")).toBeTruthy(),
    )
    // **La couche visée est vidée, et elle seule** : l'envoi ne parle que d'elle.
    expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")).toEqual({
      couche: "affinage",
      traits: [],
    })

    fireEvent.click(ecran.getByRole("button", { name: "retouche" }))
    fireEvent.click(ecran.getByRole("button", { name: /Sans retouche/ }))
    await waitFor(() =>
      expect(dernierAppel(appels, "/api/assets/bbbb2222-100/hand")).toEqual({
        couche: "retouche",
        traits: [],
      }),
    )
  })

  test("les trois outils ne paraissent que sur un calque", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const habille = calque("bbbb2222-100", corps.identifiant, {
      recette: RECETTE_VIDE,
    })
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [{ ...CASQUE, portee: "agrandit" }],
      personnages: [avecCorps(corps, [habille])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    fireEvent.click(ecran.getByRole("button", { name: "Ouvrir casque · repos" }))

    // Un corps habillé n'a ni masque ni retouche : trois segments morts
    // au-dessus de son image seraient du cadrage affiché.
    await ecran.findByText(/il ne s'empile pas/)
    expect(ecran.queryByRole("button", { name: "masque" })).toBeNull()
    expect(ecran.queryByRole("button", { name: "retouche" })).toBeNull()
  })

  // ── « Les calques restant à regarder se trient par la mesure la plus
  //     défavorable, le pire en tête » (US-152) ────────────────────────────────

  test("la colonne se trie par le pire, et ce qui est fait descend", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    /** Un calque sur une pose donnée, avec la gravité que le serveur lui a
     *  calculée — l'écran ne la recalcule jamais. */
    const sur = (pose: string, gravite: number, main = false): Asset => {
      const un = calque(`bbbb2222-10${pose.length}`, corps.identifiant, {
        identifiant: `calque-${pose}`,
        label: `casque · ${pose}`,
        pose,
      })
      un.calque = { ...un.calque!, gravite, pire: "corps repeint" }
      if (main)
        un.recette.difference!.retouche = [
          { garde: true, rayon: 0, points: [[1, 1]], couleur: "" },
        ]
      return un
    }
    const doux = sur("repos", 0.04)
    const pire = sur("marche", 0.62)
    const fait = sur("course", 0.9, true)

    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [
        personnage("Le nain", {
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: [corps],
            corps: corps.identifiant,
            origine: "type" as const,
            calques: { repos: [doux], marche: [pire], course: [fait] }[
              p.identifiant
            ]
              ? ({
                  casque: { repos: [doux], marche: [pire], course: [fait] }[
                    p.identifiant
                  ]!,
                } as Record<string, Asset[]>)
              : ({} as Record<string, Asset[]>),
            directions: [],
            directions_rangees: [],
            sans_direction: [],
          })),
        }),
      ],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    /** L'ordre des attitudes tel qu'il est **rendu**, ligne à ligne. */
    const ordre = () =>
      Array.from(
        document.querySelectorAll("[data-univers] li .w-\\[110px\\]"),
      ).map((n) => n.textContent)

    // **Le plan reste le défaut** : c'est l'ordre de l'auteur, et le seul dans
    // lequel une case vide se lit.
    expect(ordre().slice(0, 3)).toEqual(["repos", "marche", "course"])

    fireEvent.click(ecran.getByRole("button", { name: "par le pire" }))

    // Le pire en tête, ce qui va mieux ensuite — et **ce dont on s'est déjà
    // occupé descend**, malgré la pire gravité des trois : « ce qui reste à
    // regarder » est un calque sur lequel la main n'est pas passée.
    const trie = ordre()
    expect(trie.indexOf("marche")).toBeLessThan(trie.indexOf("repos"))
    expect(trie.indexOf("repos")).toBeLessThan(trie.indexOf("course"))
    // Les attitudes sans calque ferment la marche : il n'y a rien à y regarder.
    expect(trie.slice(0, 3)).toEqual(["marche", "repos", "course"])

    // **La mesure qui décide est nommée sur la rangée**, et l'état de la main
    // avec — c'est ce que le tri ordonne, écrit là où on le lit.
    expect(ecran.getAllByText(/à regarder · corps repeint/).length).toBe(2)
    expect(ecran.getByText("main posée")).toBeTruthy()
  })

  test("la colonne du corps n'offre pas de tri : il n'y a rien à classer", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    // **Absent, pas grisé** : sur la colonne du corps il n'y a pas de mesure de
    // calque, donc pas de chose indisponible — il n'y a rien du tout.
    expect(ecran.queryByRole("button", { name: "par le pire" })).toBeNull()
    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    expect(ecran.getByRole("button", { name: "par le pire" })).toBeTruthy()
  })

  // ── La sortie vers le jeu (C5) ──────────────────────────────────────────

  /** Le cadre de l'agent avec un dossier de jeu posé — c'est là que le produit
   *  le range depuis T7, et l'écran des personnages ne fait que le lire. */
  const AVEC_DOSSIER: Etat["agent"] = {
    ...ETAT.agent,
    garde_fous: { ...ETAT.agent.garde_fous, dossier_jeu: "C:/jeux/mon-jeu/assets" },
  }

  test("sans attitude remplie, sortir est grisé et dit pourquoi", async () => {
    const { ecran, flux } = await ouvrir({
      agent: AVEC_DOSSIER,
      personnages: [personnage("Le nain")],
    })
    // Le dossier est posé : ce qui manque ici est ce qu'il y a à sortir, et
    // c'est cette raison-là qui doit s'afficher — celle qu'on peut corriger
    // sans quitter l'écran passe devant celle qui renvoie ailleurs.
    act(() => flux.emettre("agent", AVEC_DOSSIER))

    const bouton = ecran.getByRole("button", {
      name: "Poser dans le dossier du jeu",
    }) as HTMLButtonElement
    // **Grisé, jamais caché** : la chose existe — c'est un personnage —, et ce
    // qui manque est nommé (`docs/design-motifs.md` § Le grisé porte sa raison).
    expect(bouton.disabled).toBe(true)
    expect(
      ecran.getAllByText(/aucune attitude remplie/).length,
    ).toBeGreaterThan(0)
  })

  test("sans dossier de jeu, sortir est grisé et renvoie aux Réglages", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({ personnages: [avecCorps(corps)] })

    const bouton = ecran.getByRole("button", {
      name: "Poser dans le dossier du jeu",
    }) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    // Le réglage manquant n'est pas une panne : c'est un dossier que personne
    // n'a encore posé, et la raison dit où on le pose.
    expect(ecran.getAllByText(/aucun dossier de jeu/).length).toBeGreaterThan(0)
    expect(ecran.getAllByText(/Réglages/).length).toBeGreaterThan(0)
  })

  test("le personnage part, et l'écran dit combien de fichiers et où", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels, flux } = await ouvrir({
      agent: AVEC_DOSSIER,
      personnages: [avecCorps(corps)],
    })

    const bouton = ecran.getByRole("button", {
      name: "Poser dans le dossier du jeu",
    }) as HTMLButtonElement
    // **Posé dans l'autre écran, il s'allume ici à l'instant** : le cadre de
    // l'agent arrive par le flux, et c'est la leçon de R1 — un réglage qui ne
    // se voit qu'en rechargeant la page n'est pas un réglage.
    expect(bouton.disabled).toBe(true)
    act(() => flux.emettre("agent", AVEC_DOSSIER))
    expect(bouton.disabled).toBe(false)

    fireEvent.click(bouton)

    // **Le dossier n'est pas envoyé** : il vit dans les Réglages, et le serveur
    // en est le seul dépositaire. L'écran le lit pour griser, jamais pour le
    // redire.
    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/characters/le-nain/export"),
      ).toBe(true),
    )
    expect(
      appels.find((a) => a.url === "/api/characters/le-nain/export")?.corps,
    ).toEqual({})

    // Ce que l'auteur veut savoir après coup : combien, et où — c'est le chemin
    // qu'il collera dans son moteur.
    await waitFor(() =>
      expect(ecran.getAllByText(/1 fichiers posés dans/).length).toBeGreaterThan(0),
    )
    expect(ecran.getAllByText("C:/jeux/mon-jeu/assets").length).toBeGreaterThan(0)
  })

  test("armer demande le sujet au serveur au lieu de l'écrire", async () => {
    const { ecran, appels } = await ouvrir({
      personnages: [
        personnage("Le nain", { description: "un forgeron nain à la barbe tressée" }),
      ],
    })

    fireEvent.click(ecran.getByRole("button", { name: "Fabriquer marche" }))

    // **Une seule composition dans tout le produit** (C5) : l'écran et l'agent
    // arment la même case, et le texte vient du service qui l'écrit. Deux
    // compositions auraient fini par demander deux choses différentes.
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/characters/subject")).toBe(true),
    )
    const envoye = appels.find((a) => a.url === "/api/characters/subject")
      ?.corps as { personnage: string }
    expect(envoye.personnage).toBe("le-nain")

    // **Le signalement seul.** Depuis E14 la consigne de l'attitude est une
    // ligne à part, avec son origine et son interrupteur ; la demande ne porte
    // donc plus l'attitude, et le champ n'en porte plus le mot.
    const champ = await champDePrompt() as HTMLTextAreaElement
    await waitFor(() =>
      expect(champ.value).toBe("un forgeron nain à la barbe tressée"),
    )
  })
})

// ── E1 : trois onglets au lieu de sept surfaces ─────────────────────────────
//
// Les huit critères de la tranche portent tous sur le châssis, et aucun ne se
// vérifie ailleurs qu'ici : un onglet allumé, un fil d'Ariane, un total qui
// dit de quoi il est le total, des bascules qui nomment ce qu'elles replient.
// Le neuvième — « chaque écran d'avant est atteignable et fonctionne
// exactement comme avant » — n'a pas d'essai à lui : ce sont les cent
// quatre-vingt-cinq précédents, qui traversent tous le nouveau châssis.

describe("les trois onglets", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserGuide()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const onglet = (nom: string) => screen.getByRole("tab", { name: nom })
  const allume = (nom: string) => onglet(nom).getAttribute("aria-selected") === "true"

  // ── « Trois onglets, et un seul allumé à la fois ; aucun écran ne se
  //     superpose à un autre » ────────────────────────────────────────────────

  test("les trois onglets sont là dans l'ordre du travail, et un seul est allumé", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // L'ordre n'est ni alphabétique ni arbitraire : on pose ce qui s'applique à
    // tout, on déclare ce que le monde contient, on regarde ce qu'on a produit.
    expect(screen.getAllByRole("tab").map((o) => o.textContent)).toEqual([
      "Univers",
      "Codex",
      "Galerie",
    ])

    // La galerie est l'onglet de repos : c'est l'écran qu'on regardait déjà en
    // arrivant, et un produit ne change pas d'accueil pour se réorganiser.
    expect(allume("Galerie")).toBe(true)
    expect(allume("Univers")).toBe(false)
    expect(allume("Codex")).toBe(false)
  })

  test("allumer un onglet éteint le précédent, et rien ne se rend par-dessus", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // La preuve du non-recouvrement se prend sur ce que chaque onglet est seul
    // à avoir. Tant qu'ils se rendaient les uns **derrière** les autres, tout
    // restait dans le document — et c'est exactement ce que sept surfaces
    // empilées voulaient dire.
    expect(await screen.findByLabelText("Chercher dans la bibliothèque")).toBeTruthy()

    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(allume("Univers")).toBe(true)
    expect(allume("Galerie")).toBe(false)
    expect(screen.queryByLabelText("Chercher dans la bibliothèque")).toBeNull()

    fireEvent.click(onglet("Codex"))
    await waitFor(() => expect(allume("Codex")).toBe(true))
    expect(allume("Univers")).toBe(false)
    // Un seul cadre en profondeur est monté à la fois, jamais deux empilés.
    expect(document.querySelectorAll("[data-univers], [data-codex]")).toHaveLength(1)
    // **La barre qui paie est ici, et nulle part ailleurs** (E2) : c'est ce qui
    // fait du codex l'un des deux lieux d'où l'argent part.
    expect(
      screen.getByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeTruthy()

    fireEvent.click(onglet("Galerie"))
    expect(await screen.findByLabelText("Chercher dans la bibliothèque")).toBeTruthy()
    expect(document.querySelectorAll("[data-univers], [data-codex]")).toHaveLength(0)
    // **La barre qui paie disparaît de tout écran incapable de dépenser.** La
    // galerie juge, elle ne paie jamais.
    expect(screen.queryByPlaceholderText("Décris ce que tu veux fabriquer.")).toBeNull()
  })

  // ── « Descendre dans une chose du jeu remplace le nom de l'onglet par un
  //     fil, et chaque segment du fil ramène à son étage » ────────────────────

  test("descendre pose un fil d'Ariane, et chaque segment ramène à son étage", async () => {
    const planche = asset("aaaa1111-0", "tonneau-cerclé-02")
    const { fetchDouble } = serveurDouble({ assets: [planche] })
    await monter(fetchDouble, { ...ETAT, assets: [planche] })

    // Au repos, dans la galerie, pas de fil : on n'est descendu nulle part.
    // Le codex, lui, en porte un dès qu'il s'ouvre — son premier étage est le
    // jeu, son second la famille.
    expect(screen.queryByRole("navigation", { name: "Où l'on est" })).toBeNull()

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir les tables" }))

    const fil = within(await screen.findByRole("navigation", { name: "Où l'on est" }))
    // Quatre segments : le jeu, l'onglet, l'image, l'outil. C'est la forme
    // courte — celle d'une image atteinte par la galerie, qui n'appartient pas
    // forcément à une chose du jeu et n'a traversé aucune famille.
    expect(fil.getByText("Bac à sable")).toBeTruthy()
    expect(fil.getByText("Galerie")).toBeTruthy()
    expect(fil.getByText("tonneau-cerclé-02")).toBeTruthy()
    expect(fil.getByText("détourage")).toBeTruthy()

    // **Le dernier segment ne ramène nulle part** : c'est l'étage où l'on est,
    // et c'est ce qui le rend lisible comme la fin du fil.
    expect(fil.queryByRole("button", { name: "détourage" })).toBeNull()
    expect(fil.getByText("détourage").getAttribute("aria-current")).toBe("page")

    // Les autres ramènent. Celui de l'onglet remonte d'un étage — et la
    // galerie n'a pas de fil, parce qu'on n'y est descendu nulle part.
    fireEvent.click(fil.getByRole("button", { name: "Galerie" }))
    expect(await screen.findByLabelText("Chercher dans la bibliothèque")).toBeTruthy()
    expect(screen.queryByRole("navigation", { name: "Où l'on est" })).toBeNull()
  })

  test("changer d'onglet remonte de toute profondeur", async () => {
    const planche = asset("aaaa1111-0", "tonneau-cerclé-02")
    const { fetchDouble } = serveurDouble({ assets: [planche] })
    await monter(fetchDouble, { ...ETAT, assets: [planche] })

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir les tables" }))
    await screen.findByRole("navigation", { name: "Où l'on est" })

    // Cliquer un onglet est le geste qui dit « ailleurs ». Laisser la découpe
    // ouverte derrière rendrait le produit à ce qu'il vient de quitter — un
    // écran par-dessus un autre, ce que la tranche supprime.
    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(screen.queryByRole("navigation", { name: "Où l'on est" })).toBeNull()

    fireEvent.click(onglet("Galerie"))
    expect(await screen.findByLabelText("Chercher dans la bibliothèque")).toBeTruthy()
    expect(screen.queryByText("Ce qui sortira")).toBeNull()
  })

  // ── « Le total de la barre de tête porte le nom de ce qu'il compte, et un
  //     clic ouvre l'écran qui l'explique — grisé avec sa raison tant que cet
  //     écran n'existe pas » ──────────────────────────────────────────────────

  test("le total porte son étiquette, et un clic ouvre l'écran qui l'explique", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // `ce jeu, en argent $0,0000`, jamais un montant nu : un montant affiché
    // est une question posée, et un chiffre qui laisse deviner sa portée finit
    // par être lu comme le total de tout, ce qu'il n'est pas.
    //
    // **« en argent » est arrivé en F2** : le total ne compte que ce qui se
    // paie en argent, et depuis qu'un fournisseur consomme des jetons, il
    // fallait que l'étiquette le dise. Le reste vit dans l'écran des dépenses.
    expect(screen.getByText("ce jeu, en argent")).toBeTruthy()
    // **Et le second total est parti d'ici** : « $X en tout » vit maintenant
    // dans l'écran des dépenses, dont c'est la seule chose qu'on vient y
    // chercher. L'afficher aux deux endroits lui retirerait sa raison d'être.
    expect(screen.queryByText(/en tout/)).toBeNull()

    // Le total est la porte de l'écran qui l'explique — et il l'ouvre à sa
    // profondeur, sous un fil, sans quitter l'onglet où l'on était.
    fireEvent.click(screen.getByTitle("Ouvrir les dépenses"))
    const fil = within(await screen.findByRole("navigation", { name: "Où l'on est" }))
    expect(fil.getByText("Les dépenses")).toBeTruthy()
    expect(await screen.findByText("l'atelier, en tout")).toBeTruthy()
  })

  test("le nom du jeu ne s'écrit qu'une fois dans la bande", async () => {
    const planche = asset("aaaa1111-0", "tonneau-cerclé-02")
    const { fetchDouble } = serveurDouble({ assets: [planche] })
    await monter(fetchDouble, { ...ETAT, assets: [planche] })

    // Sans fil, c'est le total qui porte le nom du jeu. On regarde **dans la
    // bande** et pas dans tout le document : l'arbre des projets le porte lui
    // aussi, et c'est sa place.
    const bande = () => within(document.querySelector("header") as HTMLElement)
    expect(await bande().findByText("Bac à sable")).toBeTruthy()
    expect(bande().getAllByText("Bac à sable")).toHaveLength(1)

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir la fiche" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir les tables" }))
    await screen.findByRole("navigation", { name: "Où l'on est" })

    // Déployé, le fil le porte à son premier étage — et le total le lâche.
    // Deux fois le même nom dans la même bande de 44 px serait du cadrage.
    expect(bande().getAllByText("Bac à sable")).toHaveLength(1)
    const fil = within(screen.getByRole("navigation", { name: "Où l'on est" }))
    expect(fil.getByText("Bac à sable")).toBeTruthy()
  })

  // ── « Chaque bascule de repli nomme la colonne qu'elle replie sur l'écran
  //     courant » ──────────────────────────────────────────────────────────────

  test("les bascules nomment les colonnes de l'écran où l'on est", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // La galerie replie l'arbre et les réglages ; deux mots uniques servaient
    // les quatre écrans d'avant, et mentaient sur trois.
    expect(screen.getByRole("button", { name: "arbre" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "univers" })).toBeNull()

    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(screen.queryByRole("button", { name: "arbre" })).toBeNull()
    // **La réserve n'a de bascule qu'en toile.** Sans elle il n'y a pas de
    // colonne, et une bascule pour une colonne absente mentirait sur ce que
    // l'écran contient. Et depuis E7 c'est la **seule** colonne repliable de
    // cet onglet : les cinq réglages du jeu ont un côté à eux.
    expect(screen.queryByRole("button", { name: "réserve" })).toBeNull()
    expect(screen.queryByRole("button", { name: "univers" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "toile" }))
    expect(await screen.findByRole("button", { name: "réserve" })).toBeTruthy()

    // Le codex n'a pas de colonne repliable : il n'annonce donc aucune bascule.
    fireEvent.click(onglet("Codex"))
    await waitFor(() => expect(allume("Codex")).toBe(true))
    expect(screen.queryByRole("button", { name: "univers" })).toBeNull()
    expect(screen.queryByRole("button", { name: "arbre" })).toBeNull()
  })

  test("replier depuis la barre replie bien la colonne de l'onglet ouvert", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    fireEvent.click(screen.getByRole("button", { name: "toile" }))

    const colonnes = () =>
      (document.querySelector("[data-colonnes]") as HTMLElement).style.gridTemplateColumns

    expect(colonnes()).toBe("minmax(0,1fr) 380px")
    fireEvent.click(await screen.findByRole("button", { name: "réserve" }))
    // **Replier n'est pas fermer** : la case tombe à zéro, le panneau reste
    // monté sous elle.
    await waitFor(() => expect(colonnes()).toBe("minmax(0,1fr) 0px"))
  })

  // ── « Les réglages et le guide sont séparés visuellement de ce qui touche
  //     au travail » ───────────────────────────────────────────────────────────

  test("Réglages et Guide sont dits en toutes lettres, et séparés du travail", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    const reglages = screen.getByRole("button", { name: "Réglages" })
    const guide = screen.getByRole("button", { name: "Guide" })

    // Les deux vivent dans le même groupe, et ce groupe porte le trait qui le
    // sépare du reste de la barre. Les premiers croquis dessinaient une roue
    // dentée et un point d'interrogation ; ce sont les mots qui restent.
    const groupe = reglages.parentElement as HTMLElement
    expect(groupe.contains(guide)).toBe(true)
    expect(groupe.className).toContain("border-l")

    // Et rien de ce qui touche au travail n'est dedans : les trois onglets
    // vivent ailleurs dans la bande.
    for (const nom of ["Univers", "Codex", "Galerie"])
      expect(groupe.contains(onglet(nom))).toBe(false)
  })

  test("le catalogue se redemande depuis la barre d'état, où il se lit déjà", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    // La barre de tête portait un bouton `Catalogue` de même poids que les
    // onglets, alors qu'il ne changeait rien de ce qu'on regarde. Le geste
    // rejoint l'état qu'il change : le pied dit déjà ce que le catalogue
    // contient et de quand il date.
    fireEvent.click(await screen.findByRole("button", { name: /modèles$/ }))
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/models/refresh")).toBe(true),
    )
  })

  // ── « Aucune bande du produit ne porte une hauteur hors de 44 · 38 · 34 ·
  //     30 · 26, et les deux exceptions sont les seules » ─────────────────────

  test("la barre de tête fait 44, les onglets 26, les boutons 34", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    const classes = (e: Element) => e.className
    expect(classes(document.querySelector("header") as Element)).toContain("h-[44px]")
    expect(classes(onglet("Galerie"))).toContain("h-[26px]")
    expect(classes(screen.getByRole("button", { name: "Réglages" }))).toContain(
      "h-[34px]",
    )
    expect(classes(screen.getByRole("button", { name: "arbre" }))).toContain("h-[26px]")

    // Le champ de saisie est la première des deux exceptions nommées : 56 px,
    // parce que ce n'est pas une bande mais une zone de saisie sur plusieurs
    // lignes.
    const champ = await champDePrompt()
    expect(classes(champ)).toContain("min-h-[56px]")
  })
})

// ── E18 : les dépenses ──────────────────────────────────────────────────────
//
// Cinq des sept critères sont tenus par `tests/test_e18.py`, qui compte les
// trois issues et les rafales sur de vrais appels. Les deux qui restent portent
// sur ce que l'écran montre, et ne se vérifient qu'ici : les deux totaux du
// produit portent chacun son étiquette, et la liste n'est pas une grille
// d'assets.

describe("l'écran des dépenses", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Ce que le serveur rend sur `/api/spending`. Deux appels, dont une rafale de
   *  deux sur le même sujet, et un jeu ouvert. */
  const DEPENSES = {
    total_usd: 0.3619,
    sans_projet_usd: 0.0381,
    par_projet: [{ projet: "bac-a-sable", nom: "Bac à sable", cout_usd: 0.3238 }],
    par_modele: [
      {
        modele: "openai/gpt-image-2",
        cout_usd: 0.2935,
        consomme: 0.2935,
        unite: "usd",
        appels: 2,
      },
      {
        modele: "google/gemini-3.1-flash-lite",
        cout_usd: 0.0684,
        consomme: 0.0684,
        unite: "usd",
        appels: 1,
      },
    ],
    par_unite: [],
    appels: [
      {
        identifiant: "aaaa1111",
        modele: "openai/gpt-image-2",
        prompt: "un tonneau cerclé de fer",
        cree_le: 1_787_800_000,
        cout_usd: 0.016,
        consomme: 0.016,
        unite: "usd",
        projet: "bac-a-sable",
        projet_nom: "Bac à sable",
        provenance: "auteur",
        personnage: "balthazar",
        pose: null,
        variations: 1,
        garde: 1,
        perdu: 0,
        refuse: 0,
        raison: null,
        assets: [],
        rafale: "rafale-aaaa1111",
      },
      {
        identifiant: "bbbb2222",
        modele: "openai/gpt-image-2",
        prompt: "un tonneau cerclé de fer",
        cree_le: 1_787_799_700,
        cout_usd: 0.016,
        consomme: 0.016,
        unite: "usd",
        projet: "bac-a-sable",
        projet_nom: "Bac à sable",
        provenance: "auteur",
        personnage: "balthazar",
        pose: null,
        variations: 1,
        garde: 0,
        perdu: 1,
        refuse: 0,
        raison: null,
        assets: [],
        rafale: "rafale-aaaa1111",
      },
      {
        identifiant: "cccc3333",
        modele: "google/gemini-3.1-flash-lite",
        prompt: "une lanterne",
        cree_le: 1_787_700_000,
        cout_usd: 0,
        consomme: 0,
        unite: "usd",
        projet: "bac-a-sable",
        projet_nom: "Bac à sable",
        provenance: "agent",
        personnage: null,
        pose: null,
        variations: 1,
        garde: 0,
        perdu: 0,
        refuse: 1,
        raison: "refusé par le filtre de sécurité",
        assets: [],
        rafale: null,
      },
    ],
    rafales: [
      {
        identifiant: "rafale-aaaa1111",
        appels: 2,
        cout_usd: 0.032,
        consomme: 0.032,
        unite: "usd",
        debut: 1_787_799_700,
        fin: 1_787_800_000,
        prompt: "un tonneau cerclé de fer",
      },
    ],
  }

  const ouvrir = async () => {
    const double = serveurDouble({ depenses: DEPENSES })
    await monter(double.fetchDouble)
    fireEvent.click(screen.getByTitle("Ouvrir les dépenses"))
    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-depenses]")
      if (!trouve) throw new Error("l'écran des dépenses n'est pas monté")
      return trouve as HTMLElement
    })
    await screen.findByText("l'atelier, en tout")
    return { ...double, ecran: within(cadre) }
  }

  // ── « Les deux totaux du produit portent chacun son étiquette, et aucun
  //     montant n'est affiché nu » ─────────────────────────────────────────────

  test("les deux totaux portent chacun son étiquette, et la part hors jeu se lit", async () => {
    const { ecran } = await ouvrir()

    // Le total de l'atelier entier — la seule chose qu'on vient chercher ici et
    // qu'on ne trouve nulle part ailleurs.
    expect(ecran.getByText("l'atelier, en tout")).toBeTruthy()
    expect(ecran.getByText("$0,3619")).toBeTruthy()

    // **Les onze pour cent qu'aucun écran ne montrait** : ce qui a été dépensé
    // sans qu'aucun jeu soit ouvert.
    expect(ecran.getByText("hors jeu")).toBeTruthy()
    expect(ecran.getByText("$0,0381")).toBeTruthy()

    // Et celui du jeu ouvert reste dans la barre de tête, avec son étiquette.
    expect(
      within(document.querySelector("header") as HTMLElement).getByText(
        "ce jeu, en argent",
      ),
    ).toBeTruthy()
  })

  // ── « Les trois issues se distinguent : gardé, payé pour rien, refusé » ─────

  test("les trois issues se comptent et se filtrent", async () => {
    const { ecran } = await ouvrir()

    // Un appel par issue dans le jeu de départ : un gardé, un payé pour rien,
    // un refusé.
    for (const nom of ["gardé", "payé pour rien", "refusé"])
      expect(ecran.getByRole("button", { name: new RegExp(`^${nom}`) })).toBeTruthy()

    // Filtrer sur « payé pour rien » ne laisse que celui-là. C'est le filtre qui
    // remplace le journal des ratés, et il répond à une question qu'aucun écran
    // ne savait poser : qu'est-ce que j'ai payé pour rien ?
    fireEvent.click(ecran.getByRole("button", { name: /^payé pour rien/ }))
    await waitFor(() => expect(ecran.getAllByText("balthazar")).toHaveLength(1))
  })

  // ── « Les appels consécutifs sur un même sujet se repèrent sans lire les
  //     horodatages un par un » ─────────────────────────────────────────────────

  test("une rafale se lit sur la ligne, et son détail dans la colonne de droite", async () => {
    const { ecran } = await ouvrir()

    // Choisir un appel de la rafale : la colonne de droite dit combien ils
    // étaient, en combien de temps, et pour combien.
    fireEvent.click(ecran.getAllByRole("button", { name: /balthazar/ })[0])
    expect(await ecran.findByText("2 appels d'affilée sur ce sujet")).toBeTruthy()
    expect(ecran.getByText(/5 min · \$0,0320/)).toBeTruthy()
  })

  // ── « La liste n'est pas une grille d'assets : ni recherche, ni filtres, ni
  //     sélection multiple » ────────────────────────────────────────────────────

  test("la liste ne porte aucune vignette et aucune sélection multiple", async () => {
    const { ecran } = await ouvrir()

    // **C'est l'absence de vignette qui tient la règle**, pas l'absence de
    // filtre : une vignette par ligne ferait de cet écran une seconde galerie,
    // et la galerie fait déjà ça mieux. Les filtres, eux, portent sur des
    // appels et non sur des images (A-24 de `docs/v21-arbitrages.md`).
    const liste = ecran.getAllByRole("button", { name: /balthazar/ })
    for (const ligne of liste) expect(ligne.querySelector("img")).toBeNull()

    // Aucune case à cocher : on ne sélectionne pas plusieurs dépenses, il n'y a
    // rien à leur faire — rien ne se paie ni ne s'efface depuis cet écran.
    expect(ecran.queryAllByRole("checkbox")).toHaveLength(0)
    expect(ecran.getByText("rien ne se paie ni ne s'efface depuis cet écran"))
      .toBeTruthy()
  })

  // ── « Échap ramène d'où l'on vient » (31 août 2026) ───────────────────────
  //
  // **Cet écran n'avait aucune sortie à lui.** Ni bouton de fermeture, ni
  // touche : la seule façon d'en partir était de recliquer un onglet du haut —
  // c'est-à-dire d'aller ailleurs, pas de revenir. Le Guide et la vitrine
  // ferment sur Échap et l'écrivent sur leur bouton ; c'est une règle du
  // produit, et celui-ci était l'un des deux qui ne la tenaient pas.

  test("Échap ferme les dépenses, et le bouton dit la touche", async () => {
    const { ecran } = await ouvrir()

    expect(ecran.getByRole("button", { name: "Fermer — Échap" })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(document.querySelector("[data-depenses]")).toBeNull(),
    )
    // On retombe là d'où l'on venait, pas ailleurs : l'onglet n'a pas bougé.
    expect(
      screen.getByRole("tab", { name: "Galerie" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  test("le fil ramène d'où l'on vient, et l'onglet ne change pas", async () => {
    await ouvrir()

    // L'écran est une profondeur, pas un quatrième onglet : les trois restent
    // là, et celui d'où l'on vient reste allumé.
    expect(
      screen.getByRole("tab", { name: "Galerie" }).getAttribute("aria-selected"),
    ).toBe("true")

    const fil = within(screen.getByRole("navigation", { name: "Où l'on est" }))
    fireEvent.click(fil.getByRole("button", { name: "Bac à sable" }))
    expect(await champDePrompt())
      .toBeTruthy()
  })
})

// ── E7 : l'onglet Univers à trois côtés ─────────────────────────────────────
//
// L'onglet tenait quatre choses très différentes sur le même écran : deux qui
// servent à **chercher une idée**, deux à **remplir des réglages**. Ce ne sont
// pas les mêmes besoins, et les mettre côte à côte faisait perdre les deux —
// mesuré : la bande de réglages faisait 1 843 px de haut dans 646 px visibles,
// et la première image d'inspiration était à 4 161 px de défilement.

describe("les trois côtés de l'univers", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const cote = (nom: string) => screen.getByRole("tab", { name: nom })
  const survoler = (element: Element) => fireEvent.pointerOver(element)
  const espace = () => fireEvent.keyDown(window, { key: " ", code: "Space" })

  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    await screen.findByRole("tab", { name: "Inspiration" })
    return { ...double, flux }
  }

  // ── « Trois côtés, un seul allumé, et le côté allumé occupe tout l'écran
  //     sous une barre de 38 px » ───────────────────────────────────────────────

  test("trois côtés, un seul allumé, sous une seule barre de 38 px", async () => {
    await ouvrir()

    expect(
      screen
        .getByRole("tablist", { name: "Les trois côtés de l'univers" })
        .textContent,
    ).toBe("InspirationRéglagesAmbiances et couleurs")

    // Inspiration est le côté de repos : on regarde des images avant de régler.
    expect(cote("Inspiration").getAttribute("aria-selected")).toBe("true")
    expect(cote("Réglages").getAttribute("aria-selected")).toBe("false")

    // **Deux bandes au-dessus du travail, jamais trois.** Celle du châssis fait
    // 44 px, celle-ci 38, et les trois côtés vivent *dans* la seconde.
    const barre = cote("Inspiration").closest("div.h-\\[38px\\]")
    expect(barre).toBeTruthy()

    fireEvent.click(cote("Réglages"))
    await waitFor(() =>
      expect(cote("Réglages").getAttribute("aria-selected")).toBe("true"),
    )
    expect(cote("Inspiration").getAttribute("aria-selected")).toBe("false")
    // Le côté allumé prend tout l'écran : le tableau n'est plus là.
    expect(screen.queryByText("Le tableau est vide.")).toBeNull()
  })

  // ── « Côté Inspiration, aucun réglage n'est posé au-dessus du tableau » et
  //     « la première image est atteinte en moins d'un écran de défilement » ───

  test("le tableau est la première chose sous la barre, sans un réglage dessus", async () => {
    await ouvrir({ cartes: [carteImage("c1")] })

    // Aucun des cinq réglages du jeu n'est atteignable d'ici : c'est ce qui
    // rend la première image immédiate. Rien à faire défiler avant elle.
    for (const bloc of [/^Bible/, /^Palette/, /^Taille de pixel/, /^Barème/])
      expect(screen.queryByRole("button", { name: bloc })).toBeNull()

    // Et la grille des cartes est bien montée, elle.
    expect(await waitFor(() => document.querySelector("article"))).toBeTruthy()
  })

  // ── « Une carte de texte a la hauteur de son cran de zoom et dit en pied ce
  //     qui est coupé » ────────────────────────────────────────────────────────

  test("une carte de texte prend la mesure de ses voisines, et dit ce qui est coupé", async () => {
    const long = "un paragraphe. ".repeat(400)
    await ouvrir({
      cartes: [carteImage("n1", { genre: "texte", texte: long })],
    })

    const corps = await waitFor(
      () => document.querySelector("article p") as HTMLElement,
    )
    // **Aucune hauteur neuve** : la carte de texte prend celle que la colonne
    // donne déjà à une carte d'image du même cran. Elle grandissait avec son
    // texte jusqu'en E7, ce qui faisait du tableau une colonne de 6 726 px.
    expect(corps.className).toContain("aspect-square")

    // **Et ce qui dépasse est atteignable, depuis le 31 août 2026.** La carte
    // rognait en silence : elle écrivait en pied *1/6 visible* sans donner
    // aucun moyen d'aller voir les cinq autres sixièmes. Elle défile
    // maintenant — sans grandir d'un pixel, ce que la ligne au-dessus tient.
    expect(corps.className).toContain("overflow-y-auto")

    // **Les retours à la ligne sont rendus.** Une note porte parfois le
    // document de présentation du jeu, avec ses titres et ses paragraphes ;
    // l'affichage par défaut les effaçait et tout arrivait abouté en un bloc.
    expect(corps.className).toContain("whitespace-pre-wrap")
  })

  // ── « Une carte de texte ouverte en grand se pose en colonne de prose
  //     bornée, et défile » ────────────────────────────────────────────────────

  test("une note ouverte en grand se pose en colonne de prose, et défile", async () => {
    await ouvrir({
      cartes: [carteImage("n1", { genre: "texte", texte: "trois paragraphes" })],
    })

    const note = await waitFor(() => document.querySelector("article")!)
    survoler(note)
    espace()

    const colonne = document.querySelector("[data-apercu-prose]") as HTMLElement
    expect(colonne).toBeTruthy()
    // Elle défile — elle ne zoome pas et ne se traîne pas.
    expect(colonne.className).toContain("overflow-y-auto")
    // **Bornée en pixels, jamais en `ch`** : un `ch` vaut la largeur du chiffre
    // zéro, et `72ch` fait 637 px, où tiennent 107 lettres.
    expect((colonne.querySelector("p") as HTMLElement).className).toContain(
      "max-w-[504px]",
    )
  })

  // ── « Un bandeau permanent dit ce que l'univers envoie » ────────────────────

  test("le pied de la colonne dit ce que cet univers envoie, et ce qui n'agit qu'au retour", async () => {
    await ouvrir()
    fireEvent.click(cote("Réglages"))

    const bloc = within(
      (await screen.findByText("Ce que cet univers envoie")).parentElement as HTMLElement,
    )
    expect(bloc.getByText("cases de style")).toBeTruthy()
    expect(bloc.getByText("signes de texte")).toBeTruthy()
    expect(bloc.getByText("images officielles")).toBeTruthy()
    // **Ce qui n'agit qu'au retour**, dit à part : les mélanger ferait croire
    // qu'on peut demander au modèle de rendre du 64 px, ce qu'aucun ne fait.
    expect(
      bloc.getByText(/ne partent pas : ils s'appliquent à l'image qui revient/),
    ).toBeTruthy()
  })

  // ── « Les deux côtés qui portent une liste emploient la colonne de 240 px » ─

  test("le côté Réglages range ses étapes dans la colonne de 240 px", async () => {
    await ouvrir()
    fireEvent.click(cote("Réglages"))

    const pistes = await waitFor(() => {
      const grille = document.querySelector(
        "[data-univers] .grid-cols-\\[240px_minmax\\(0\\,1fr\\)\\]",
      )
      if (!grille) throw new Error("la colonne de 240 px n'est pas là")
      return grille
    })
    expect(pistes).toBeTruthy()

    // Une étape à la fois : la liste dit laquelle est ouverte, et l'écran
    // entier lui est donné. La première est le nom du jeu — sur une machine
    // neuve, c'est la première question.
    const scene = (titre: string) =>
      document.querySelector(`[data-etape="${titre}"]`)
    await waitFor(() => expect(scene("Le nom")).toBeTruthy())
    expect(scene("Les types d'objets")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Les types d'objets" }))
    await waitFor(() => expect(scene("Les types d'objets")).toBeTruthy())
    expect(scene("Le nom")).toBeNull()
  })

  // ── Le troisième côté, **rempli en E11** ─────────────────────────────────
  //
  // Il annonçait sa raison d'être en E7 — « ce côté tiendra deux listes » — et
  // la tient depuis E11. L'essai suit ce qu'il montre maintenant : un état vide
  // qui invite, et les deux listes qui se remplissent. Ce que les palettes et
  // les ambiances font vit plus bas, dans le bloc de E11.

  test("le troisième côté ouvre sur les deux listes", async () => {
    await ouvrir()
    fireEvent.click(cote("Ambiances et couleurs"))

    // Un côté qui apparaîtrait le jour où il se remplit serait une surprise au
    // moment précis où l'on cherche où les choses se règlent : il est là, vide,
    // et il dit à quoi il sert.
    expect(await screen.findByText("les ambiances")).toBeTruthy()
    expect(screen.getByText("les palettes")).toBeTruthy()
    expect(screen.getByText(/Un jeu n'a pas un seul style/)).toBeTruthy()
  })
})

// ── E2 : le codex et l'établi ───────────────────────────────────────────────
//
// Le cœur de la V2.1, et la seule étape qui vaut deux tranches ordinaires. Le
// codex montre ce que le monde contient, rangé par famille, avec pour chaque
// chose le compte de ce qui lui **manque** et non de ce qu'elle tient.
// L'établi s'ouvre sous une chose, à la profondeur du fil.
//
// Les onze critères de la tranche portent tous sur l'écran. Ceux qui touchent
// à la matrice elle-même — armer, cocher, mesurer un lot — sont tenus depuis
// C1 et C2 par les essais de `l'écran des personnages`, qui traversent
// désormais le codex pour y arriver.

describe("le codex et l'établi", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const codex = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Codex" }))
    const cadre = within(await cadreDuCodex())
    return { ...double, flux, cadre }
  }

  // ── « Le codex liste tout ce que le monde contient, rangé par famille, et
  //     chaque famille dit ce qu'elle réclame » ─────────────────────────────────

  test("les cinq familles se lisent avec leur compte, et les deux listes du jeu aussi", async () => {
    const { cadre } = await codex({
      personnages: [personnage("Le nain"), personnage("La prêtresse")],
    })

    // Quatre familles du produit, plus le vestiaire. Le vocabulaire est celui
    // du dépôt, et il décide déjà de ce qui part en référence.
    for (const famille of ["Personnages", "Décors", "Objets", "Interface", "Équipement"])
      expect(cadre.getByRole("button", { name: new RegExp(`^${famille}`) })).toBeTruthy()

    // **Ce que le jeu réclame de tous**, par opposition à ce qu'une famille
    // réclame : les directions s'imposent à toute chose qui en a.
    expect(cadre.getByText("Ce que le jeu réclame de tous")).toBeTruthy()
    expect(cadre.getByRole("button", { name: /^Les directions/ })).toBeTruthy()
    expect(cadre.getByRole("button", { name: /^Leurs poses/ })).toBeTruthy()
  })

  // ── « Une chose du jeu porte le compte de ce qui lui manque » et « aucune
  //     couleur d'alerte sur un manque » ───────────────────────────────────────

  test("une chose porte le compte de ce qui lui manque, sans couleur d'alerte", async () => {
    const { cadre } = await codex({ personnages: [personnage("Le nain")] })

    // Six poses, une image chacune sauf marche et course qui en veulent quatre
    // — le compte est celui du **manque**, jamais celui de ce qui est rangé.
    const carte = cadre.getByText("Le nain").closest("article") as HTMLElement
    expect(within(carte).getByText(/cases manquantes/)).toBeTruthy()

    // **Le manque n'a pas de couleur** : le vert dit *complet*, son absence dit
    // *pas encore*. Aucune alerte, aucun message qui réclame quoi que ce soit.
    const compte = within(carte).getByText(/cases manquantes/)
    expect(compte.className).not.toContain("echec")
    expect(compte.className).not.toContain("epingle")
    expect(cadre.queryByRole("alert")).toBeNull()
  })

  // ── « Écrire un nom crée la chose immédiatement, sans formulaire, sans appel
  //     et sans dépense » et « le champ qui nomme est au milieu de l'écran quand
  //     le monde est vide, en rangée sinon, et c'est le même champ » ────────────

  test("écrire un nom crée la chose, sans formulaire et sans un centime", async () => {
    const { fetchDouble, cadre } = await codex()

    // **Au milieu de l'écran quand le monde est vide** : c'est le seul geste
    // qu'un monde vide ait à proposer.
    expect(cadre.getByText(/Nomme le premier/)).toBeTruthy()
    const champ = cadre.getByLabelText("Nom de la chose du jeu à créer")

    // Entrée suffit — pas de bouton *Ajouter*, qui aurait fait deux gestes pour
    // une déclaration.
    expect(cadre.queryByRole("button", { name: /^Ajouter/ })).toBeNull()
    expect(cadre.getByText("Entrée le crée")).toBeTruthy()

    fireEvent.change(champ, { target: { value: "Balthazar" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(([url]) => String(url) === "/api/characters"),
      ).toBe(true),
    )
    // **Sans un centime** : créer une chose du jeu est une déclaration, pas un
    // appel. C'est ce qui permet à Balthazar d'exister avant sa première image.
    expect(
      fetchDouble.mock.calls.some(([url]) => String(url).startsWith("/api/generations")),
    ).toBe(false)
  })

  test("le champ qui nomme est le même, au milieu ou en rangée", async () => {
    const { cadre } = await codex({ personnages: [personnage("Le nain")] })

    // Le monde n'est plus vide : le même champ, la même étiquette, mais en
    // rangée au pied de la liste, où il ne demande rien.
    expect(cadre.getByLabelText("Nom de la chose du jeu à créer")).toBeTruthy()
    expect(cadre.queryByText(/Nomme le premier/)).toBeNull()
  })

  // ── « Il n'existe qu'un seul champ de saisie dans le produit ; il paraît au
  //     pied de l'établi et du codex, et nulle part ailleurs » ─────────────────

  test("un seul champ de saisie, au pied du codex et de l'établi", async () => {
    await codex({ personnages: [personnage("Le nain")] })
    const champ = () => screen.queryAllByPlaceholderText("Décris ce que tu veux fabriquer.")

    // Un seul, jamais deux : deux champs auraient fini par accepter deux textes
    // différents pour la même intention.
    expect(champ()).toHaveLength(1)

    await ouvrirLEtabli("Le nain")
    expect(champ()).toHaveLength(1)

    // **La barre qui paie disparaît sur tout écran incapable de dépenser.**
    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
    expect(champ()).toHaveLength(0)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    expect(champ()).toHaveLength(0)
  })

  // ── « Cliquer une case vide remplit le prompt avec ce que la chose et le jeu
  //     imposent, et chaque valeur préremplie porte sa provenance » et « ce qui
  //     est prérempli se défait d'un clic » ───────────────────────────────────

  test("armer une case vide préremplit le prompt, avec sa provenance, et ça se défait", async () => {
    const { fetchDouble } = await codex({
      personnages: [
        personnage("Le nain", { description: "un forgeron nain à la barbe tressée" }),
      ],
    })
    const ecran = await ouvrirLEtabli("Le nain")

    fireEvent.click(ecran.getByRole("button", { name: "Fabriquer marche" }))

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    await waitFor(() =>
      expect(champ.value).toBe("un forgeron nain à la barbe tressée"),
    )

    // **La règle jumelle du grisé.** *Ce qui est indisponible est grisé avec sa
    // raison* avait besoin de son revers : ce qui est devinable est prérempli
    // **avec sa provenance**. Un champ prérempli n'est pas un champ décidé.
    // Et la provenance dit aussi ce qui part **sans** être dans le champ : la
    // consigne de l'attitude, qui a sa propre ligne à l'écran de confirmation.
    expect(
      screen.getByText(
        /proposé, d'après son signalement · la consigne de l'attitude part à côté/,
      ),
    ).toBeTruthy()

    // Et ça se défait d'un clic. **Se défaire ne change rien au réglage
    // durable** : c'est le texte de cet appel-ci qui s'efface, pas le
    // signalement de la chose, qui reste là où il est écrit.
    const avant = fetchDouble.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "défaire ›" }))
    expect(champ.value).toBe("")
    expect(screen.queryByText(/proposé, d'après/)).toBeNull()
    expect(fetchDouble.mock.calls.length).toBe(avant)

    // Le signalement, lui, n'a pas bougé.
    const identite = screen.getByLabelText("Description du personnage") as HTMLTextAreaElement
    expect(identite.value).toBe("un forgeron nain à la barbe tressée")
  })

  // ── « Cliquer une case pleine ouvre son outil en plein cadre, et l'on revient
  //     à l'établi sans avoir changé d'onglet » ────────────────────────────────

  test("une case pleine ouvre son outil en plein cadre, et l'on revient sans changer d'onglet", async () => {
    const image = asset("bbbb2222-0", "le nain, au repos")
    const nain = personnage("Le nain")
    await codex({
      personnages: [
        {
          ...nain,
          cases: nain.cases.map((c) =>
            c.pose === "repos" ? { ...c, images: [image] } : c,
          ),
        },
      ],
    })
    await ouvrirLEtabli("Le nain")

    fireEvent.click(
      await screen.findByRole("button", { name: "Ouvrir le nain, au repos dans son outil" }),
    )

    // L'outil remplace la matrice, il ne se pose pas dessus : c'est la
    // profondeur suivante du même endroit, et le fil la dit.
    expect(await screen.findByRole("button", { name: /^détourage/ })).toBeTruthy()
    const fil = within(
      await screen.findByRole("navigation", { name: "Où l'on est" }),
    )
    expect(fil.getByText("le nain, au repos")).toBeTruthy()

    // **La barre de prompt se retire** : on retouche, on ne paie pas.
    expect(
      screen.queryByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeNull()

    // Et l'onglet n'a pas bougé — on revient à l'établi par le fil.
    expect(
      screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
    ).toBe("true")
    fireEvent.click(fil.getByRole("button", { name: "Le nain" }))
    expect(await screen.findByRole("button", { name: "Fabriquer marche" })).toBeTruthy()
    expect(await champDePrompt()).toBeTruthy()
  })

  // ── « Lancer tout ce qui manque à une chose annonce le nombre d'images, le
  //     groupement en planches, le prix, et ce qu'un compte faux coûterait —
  //     avant de payer » ───────────────────────────────────────────────────────

  test("fabriquer ce qui manque annonce les images, les planches et le prix avant de payer", async () => {
    const { fetchDouble, cadre } = await codex({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
      couts: { [MODELE.identifiant]: 0.0245 },
    })

    // **Choisir n'est pas ouvrir** : un clic sur la carte désigne la chose et
    // remplit la colonne de droite ; un clic sur son *nom* descend d'un étage.
    fireEvent.click(cadre.getByText("Le nain").closest("article") as HTMLElement)

    // Le compte se lit avant tout geste : combien d'images, combien de planches.
    // Le texte est coupé par les nombres qu'il porte — on interroge donc le
    // nœud entier, comme le produit l'affiche.
    expect(
      (await screen.findAllByText((_, noeud) =>
        /^\d+ images? · \d+ planches?, une par pose$/.test(noeud?.textContent ?? ""),
      ))[0],
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Fabriquer ce qui manque" }))

    // **Rien n'est parti** : le bouton arme, il ne paie pas.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/generations" && (init as RequestInit)?.method === "POST",
      ),
    ).toBe(false)

    // Et le prix se lit au pied de la barre qui paie, avec ce qu'un compte faux
    // coûterait — la seconde moitié de l'arbitrage.
    await screen.findByText("un compte faux")
    expect(screen.getByText(/à repayer$/)).toBeTruthy()
  })

  // ── « Une case de l'établi est prise dès qu'une image la porte, quelle que
  //     soit la qualité de l'image » ────────────────────────────────────────────

  test("une case est prise dès qu'une image la porte, sa qualité n'y change rien", async () => {
    // Une image dont toutes les mesures sont mauvaises tient quand même sa
    // case : « les mesures informent, seul le compte d'images refuse ».
    const mediocre = asset("bbbb2222-0", "un essai raté")
    const nain = personnage("Le nain")
    await codex({
      personnages: [
        {
          ...nain,
          cases: nain.cases.map((c) =>
            c.pose === "repos" ? { ...c, images: [mediocre] } : c,
          ),
        },
      ],
    })
    const ecran = await ouvrirLEtabli("Le nain")

    // La case *repos* n'en réclame qu'une : elle est faite, et le compte le dit.
    const rangee = ecran.getByText("repos").closest("li") as HTMLElement
    expect(within(rangee).getByText("1 / 1")).toBeTruthy()
  })
})

// ── E3 : le châssis des tables ──────────────────────────────────────────────
//
// L'endroit où l'on retouche. Onze des quatorze critères de la tranche portent
// sur ce que l'écran montre et vivent ici ; les trois qui restent sont des
// mesures sur les pixels et sont tenus par `tests/test_e3.py`.

describe("le châssis des tables", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
    // jsdom ne connaît pas la capture de pointeur, et la sélection magique s'en
    // sert comme la main et le cadre de recadrage : on la double ici plutôt que
    // de compter sur celle qu'un autre bloc d'essais a laissée derrière lui.
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  /** Une table ouverte sur une image d'une chose du jeu. */
  const ouvrirUneTable = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    images = [asset("bbbb2222-0", "le nain, au repos")],
  ) => {
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)], ...options })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  /** La même chose, avec une quantification **disponible** : le double annonce
   *  « aucune palette » dans son état de départ, ce qui grise la table. */
  const monterAvecQuantification = async () => {
    const images = [asset("bbbb2222-0", "le nain, au repos")]
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)] })
    await monter(double.fetchDouble, {
      ...ETAT,
      traitement: {
        ...ETAT.traitement,
        quantification: { raison: null, note: null },
      },
    })
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const puce = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre.getByRole("button", { name: new RegExp(`^${nom}`) })

  // ── « La barre montre les sept places dans l'ordre où elles s'appliquent, et
  //     l'ordre ne se change pas » et « le trait sépare les sept places des deux
  //     fabriques » ───────────────────────────────────────────────────────────

  test("les sept places sont dans l'ordre du traitement, puis les deux fabriques", async () => {
    const { cadre } = await ouvrirUneTable()

    // L'ordre est celui du domaine. Le lire autrement serait mentir sur ce que
    // l'image a subi.
    const barre = cadre.getAllByRole("button").map((b) => b.textContent ?? "")
    const rangs = [
      "détourage",
      "recadrage",
      "grille",
      "quantification",
      "bords",
      "contours",
      "la main",
      "découpage",
      "superposition",
    ].map((nom) => barre.findIndex((t) => t.startsWith(nom)))
    expect(rangs.every((r) => r >= 0)).toBe(true)
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs)
  })

  // ── « L'image s'ouvre à la taille du cadre » (31 août 2026) ────────────────
  //
  // **Le seul métier de cet écran est de montrer des pixels assez grands pour
  // qu'on les juge**, et il ne le tenait pas : l'image s'affichait un pixel
  // d'image pour un pixel d'écran, quelle que soit la table. Mesuré au
  // navigateur, un sprite de 96 × 96 occupait 1,9 % d'un cadre de 670 × 742, et
  // rien ne permettait d'y changer quoi que ce soit — ni bouton, ni molette
  // annoncée, ni raccourci. Le pire cas était *la main*, la table où l'on
  // repeint pixel par pixel.

  test("la table ouvre en ajusté, et le zoom est un pour cent libre", async () => {
    // **Réécrit en U2.** Les crans entiers — 1×, 2×, 4×, 8×, 16× — étaient la
    // règle de la vitrine appliquée à un outil, et c'est ce qui a cassé la
    // table de recadrage : le plancher à 1× empêchait de voir une image de
    // 1 024 px en entier dans un cadre de 606.
    const { cadre } = await ouvrirUneTable()

    // `ajusté` est l'état d'ouverture : c'est le seul réglage qui suive le
    // cadre, donc le seul qui puisse être juste avant qu'on ait regardé.
    expect(cadre.getByRole("button", { name: "ajusté" }).className).toContain(
      "border-signal",
    )

    // Quatre commandes, et chacune fait une seule chose.
    expect(cadre.getByRole("button", { name: "Approcher" })).toBeTruthy()
    expect(cadre.getByRole("button", { name: "Reculer" })).toBeTruthy()
    expect(cadre.getByRole("button", { name: "100 %" })).toBeTruthy()
    expect(cadre.getByLabelText("Pour cent d'agrandissement")).toBeTruthy()

    // Et plus aucun cran entier.
    for (const cran of ["1×", "2×", "4×", "8×", "16×"])
      expect(cadre.queryByRole("button", { name: cran })).toBeNull()
  })

  test("cent pour cent rend un pixel d'image pour un pixel d'écran", async () => {
    const { cadre } = await ouvrirUneTable()

    // La boîte porte le zoom, et elle seule : tout ce qui se rend au milieu la
    // remplit — l'image seule, les deux côte à côte, la surface qui se peint —,
    // donc aucune de ces trois surfaces n'a son propre calcul.
    const boite = () =>
      document.querySelector("[data-boite-image]") as HTMLElement

    fireEvent.click(cadre.getByRole("button", { name: "100 %" }))
    expect(boite().style.width).toBe("1024px")
    expect(boite().style.height).toBe("1024px")

    // Le pour cent s'écrit à la main, et il agit.
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "37" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    expect(boite().style.width).toBe("379px")
  })

  test("un pour cent hors bornes est ramené, jamais refusé", async () => {
    // **Ramener plutôt que refuser.** Un champ qui rejette une frappe oblige à
    // deviner ce qu'il accepte ; un champ qui ramène le dit en affichant la
    // valeur retenue.
    const { cadre } = await ouvrirUneTable()
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement

    fireEvent.change(champ, { target: { value: "900" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    expect(champ.value).toBe("250")

    fireEvent.change(champ, { target: { value: "0" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    expect(champ.value).toBe("1")
  })

  test("plus et moins parcourent la plage, chacun dans son sens", async () => {
    const { cadre } = await ouvrirUneTable()
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement

    fireEvent.click(cadre.getByRole("button", { name: "100 %" }))
    expect(champ.value).toBe("100")
    fireEvent.click(cadre.getByRole("button", { name: "Approcher" }))
    expect(Number(champ.value)).toBeGreaterThan(100)
    fireEvent.click(cadre.getByRole("button", { name: "Reculer" }))
    expect(champ.value).toBe("100")
    fireEvent.click(cadre.getByRole("button", { name: "Reculer" }))
    expect(Number(champ.value)).toBeLessThan(100)
  })

  test("le PNG de l'état courant se télécharge depuis la table", async () => {
    // **Il n'existait qu'un seul endroit pour télécharger une image**, la tuile
    // de la galerie, et on ne l'atteignait pas d'ici. Le fichier reçu est celui
    // qu'on voyait : le rendu quand on regarde le rendu, le brut sinon.
    const { cadre } = await ouvrirUneTable()

    const lien = cadre.getByRole("link", { name: /^PNG ↓$/ }) as HTMLAnchorElement
    expect(lien.getAttribute("href")).toContain("/download?brut=false")
    expect(lien.getAttribute("download")).toMatch(/\.png$/)
    // **Habillé en bouton, et c'est tout ce qui manquait.** Son libellé était
    // en JetBrains Mono 10 px dans `--texte-2` — l'habit exact des mesures de
    // la bande. Dans une bande où sept éléments sur huit sont des faits en
    // mono, un huitième fait en mono ne se lit pas comme un geste.
    expect(lien.className).toContain("text-[11.5px]")
    expect(lien.className).toContain("bg-fond-2")
    expect(lien.className).not.toContain("mesure")

    fireEvent.click(cadre.getByRole("button", { name: "brut" }))
    // **Le nom du bouton ne bouge plus** : c'est son infobulle qui nomme ce
    // qu'il emporte, parce qu'un geste dont le libellé change de longueur
    // décale tout ce qui est à côté de lui dans une bande qui ne grandit pas.
    const brut = cadre.getByRole("link", { name: /^PNG ↓$/ }) as HTMLAnchorElement
    expect(brut.getAttribute("href")).toContain("/download?brut=true")
    expect(brut.getAttribute("download")).toContain("-brut")
    expect(brut.getAttribute("title")).toContain("l'image d'origine")
  })

  // ── « Le carré d'une place est plein si et seulement si la place change
  //     l'image » ─────────────────────────────────────────────────────────────

  test("le carré se remplit quand la place change l'image, pas quand elle est posée", async () => {
    // Un recadrage de marge zéro **est** dans la recette et ne change rien :
    // c'est le cas qui a montré que « posée » et « agit » ne coïncident pas.
    const image = {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: {
        ...RECETTE_VIDE,
        recadrage: { marge: 0, boite: null },
        bords: { aire_min: 4 },
      },
    }
    const { cadre } = await ouvrirUneTable({}, [image])

    // Le recadrage n'a pas de valeur à montrer : carré creux.
    expect(puce(cadre, "recadrage").textContent).toBe("recadrage")
    // Les bords en ont une : carré plein, et la valeur avec.
    expect(puce(cadre, "bords").textContent).toContain("tache 4 px")
  })

  // ── « Une table indisponible s'ouvre, et son panneau porte la raison en
  //     clair, à la place des réglages » ───────────────────────────────────────

  test("une table indisponible s'ouvre quand même, et porte sa raison à la place des réglages", async () => {
    // **Le seul cas du contour, et il est franc** : une image entièrement
    // opaque n'a pas de bord de sujet, seulement les quatre bords du cadre.
    // C'est le serveur qui le mesure — l'écran ne le devine pas.
    const { cadre } = await ouvrirUneTable({ mesures: { opaque: true } })

    // Elle est cliquable — c'est le wrapper qui porte la raison, pas la puce.
    fireEvent.click(puce(cadre, "contours"))
    expect(
      await cadre.findByText(/cette image est entièrement opaque/),
    ).toBeTruthy()
    // **La seconde phrase compte autant que la première** : elle dit quoi
    // faire, et le détourage est la première table de la barre.
    expect(cadre.getByText(/Détoure-la d'abord/)).toBeTruthy()
    // **À la place des réglages, jamais à côté d'eux** : aucun curseur mort
    // sous la raison.
    expect(cadre.queryByRole("slider")).toBeNull()
  })

  test("la main n'est jamais indisponible, et c'est l'exacte symétrie du contour", async () => {
    // Toute image se retouche, y compris une image entièrement opaque : *ôter*
    // y crée de la transparence, et un calque de dessin s'y pose comme partout.
    const { cadre } = await ouvrirUneTable({ mesures: { opaque: true } })

    fireEvent.click(puce(cadre, "la main"))
    expect(await cadre.findByText("les calques")).toBeTruthy()
    expect(cadre.queryByText(/entièrement opaque/)).toBeNull()
  })

  test("une fabrique n'a pas de carré, et les deux s'ouvrent en plein cadre", async () => {
    const { cadre } = await ouvrirUneTable()

    // **Les deux gestes de droite n'ont pas de carré** : ils ne posent rien sur
    // l'image courante, ils en fabriquent d'autres.
    expect(puce(cadre, "découpage").textContent).toBe("découpage")
    expect(puce(cadre, "superposition").textContent).toBe("superposition")

    fireEvent.click(puce(cadre, "superposition"))
    expect(await cadre.findByText("les deux images")).toBeTruthy()
  })

  // ── « L'image brute et l'image rendue se comparent côte à côte et
  //     superposées, et le mode est écrit dès que ce n'est pas le rendu » ──────

  test("deux contrôles, deux questions — et le travail s'écrit dès que ce n'est pas le rendu", async () => {
    const { cadre } = await ouvrirUneTable()

    // **Un seul groupe de quatre mélangeait deux questions** — *quelle image je
    // regarde* et *combien d'images sont à l'écran*. Les quatre s'excluaient,
    // donc c'était un choix ; ils s'excluaient parce qu'on les avait mis
    // ensemble.
    // Les deux libellés sont courts — la bande fait 38 px et ne grandit pas —,
    // et ils partent avant les gestes quand la place manque.
    expect(cadre.getByText("sur")).toBeTruthy()
    expect(cadre.getByText("témoin")).toBeTruthy()
    for (const nom of ["brut", "rendu", "aucun", "à côté", "par-dessus"]) {
      expect(cadre.getByRole("button", { name: nom }), nom).toBeTruthy()
    }

    // Au repos, rien n'est écrit : c'est le rendu, et le dire serait du bruit.
    expect(cadre.queryByText(/on travaille sur le brut/)).toBeNull()

    // **Le seul état durable qui change ce qu'un outil touche** se dit en
    // ambre. Le témoin, lui, ne se redit pas : son contrôle porte déjà sa
    // valeur, et la répéter serait du bruit.
    fireEvent.click(cadre.getByRole("button", { name: "brut" }))
    expect(await cadre.findByText("on travaille sur le brut")).toBeTruthy()

    fireEvent.click(cadre.getByRole("button", { name: "à côté" }))
    expect(cadre.queryByText(/on regarde/)).toBeNull()

    // Et revenir au rendu fait taire la phrase : un état durable qu'on oublie
    // est le danger ; le dire est ce qui autorise à le rendre durable.
    fireEvent.click(cadre.getByRole("button", { name: "rendu" }))
    await waitFor(() =>
      expect(cadre.queryByText("on travaille sur le brut")).toBeNull(),
    )
  })

  // ── « Une comparaison ne retire jamais un geste ; elle pose un témoin à
  //     côté » ──────────────────────────────────────────────────────────────

  test("l'outil de la table reste là avec un témoin à côté, et par-dessus", async () => {
    // **C'est la panne que la séance a mesurée** : les quatre surfaces qui
    // portent un geste étaient gardées par la même condition, répétée quatre
    // fois. Choisir une comparaison rendait deux images et plus rien d'autre —
    // on pouvait changer un seuil dans le panneau, et plus désigner un point
    // sur l'image, c'est-à-dire faire ce pour quoi on avait ouvert les deux
    // vues côte à côte.
    const { cadre } = await ouvrirUneTable()
    fireEvent.click(puce(cadre, "recadrage"))
    const surface = () => document.querySelector("[data-cadre-recadrage]")
    await waitFor(() => expect(surface()).toBeTruthy())

    for (const temoin of ["à côté", "par-dessus"]) {
      fireEvent.click(cadre.getByRole("button", { name: temoin }))
      await waitFor(() => expect(surface(), temoin).toBeTruthy())
    }

    // **Le témoin par-dessus est un calque de lecture** : le curseur le
    // traverse, et le geste tombe sur l'image de travail. Une image posée
    // par-dessus qui intercepte les clics serait le défaut d'hier déguisé.
    const dessus = cadre.getByAltText(/témoin/)
    expect(dessus.className).toContain("pointer-events-none")
  })

  // ── « On passe à l'image voisine sans que la table ouverte se referme » ─────

  test("changer de sœur garde la table ouverte", async () => {
    const images = [
      asset("bbbb2222-0", "le nain, au repos"),
      asset("bbbb2222-1", "le nain, de dos"),
    ]
    const { cadre } = await ouvrirUneTable({}, images)

    fireEvent.click(puce(cadre, "grille"))
    expect(await cadre.findByText("cible")).toBeTruthy()

    // On change d'image dans la colonne des sœurs…
    fireEvent.click(cadre.getByRole("button", { name: "le nain, de dos" }))
    // …et la table est toujours celle qu'on avait ouverte. C'est le geste qui
    // distingue une table d'un panneau : on règle la même place sur six images.
    expect(await cadre.findByText("cible")).toBeTruthy()
  })

  // ── « Vider une place et vider la recette entière sont deux gestes distincts,
  //     à deux endroits distincts » ────────────────────────────────────────────

  test("vider une place et vider la recette sont deux gestes, à deux endroits", async () => {
    // Une image dont les bords sont posés : vider une place qui n'a rien
    // n'envoie rien, et c'est très bien — le serveur sérialise les retouches.
    const image = {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: { ...RECETTE_VIDE, bords: { aire_min: 4 } },
    }
    const { cadre, appels } = await ouvrirUneTable({}, [image])

    fireEvent.click(puce(cadre, "bords"))
    // Le pied de la table ne touche qu'elle.
    fireEvent.click(await cadre.findByRole("button", { name: "Sans bords ›" }))
    await waitFor(() =>
      expect(appels.some((a) => a.url.includes("/recipe"))).toBe(true),
    )

    // `tout défaire` vit au bout de la barre, pas dans l'en-tête d'une table :
    // il y mentait sur sa portée. Il passe par une autre route — celle du
    // retour au brut, qui vide la recette entière.
    fireEvent.click(cadre.getByRole("button", { name: /tout défaire/ }))
    await waitFor(() =>
      expect(appels.some((a) => a.url.includes("/reset"))).toBe(true),
    )
  })

  // ── « La quantification atteint les couleurs déduites d'une image et le
  //     tramage, tous deux déjà portés par le modèle » ─────────────────────────

  test("la quantification atteint enfin les couleurs de l'image et le tramage", async () => {
    // Le double annonce « aucune palette » dans son état de départ, ce qui rend
    // la table indisponible : on lui donne un traitement qui marche, puisque
    // c'est la table qu'on regarde et non son grisé.
    const { cadre, appels } = await monterAvecQuantification()

    fireEvent.click(puce(cadre, "quantification"))
    // **Deux sources de couleurs**, et le modèle les portait déjà : une palette
    // vide veut dire *déduite de l'image elle-même*, ce qu'aucun écran n'avait
    // jamais proposé.
    fireEvent.click(await cadre.findByRole("button", { name: "l'image" }))
    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      expect((envoi?.corps as { quantification: { palette: string[] } }).quantification
        .palette).toEqual([])
    })

    // Et le tramage, porté depuis T2 et jamais montré : sans lui un dégradé
    // réduit à seize couleurs se pose en bandes.
    fireEvent.click(cadre.getByRole("button", { name: "floyd" }))
    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      expect((envoi?.corps as { quantification: { tramage: string } }).quantification
        .tramage).toBe("floyd")
    })
  })

  // ── « L'aire minimale liste les taches qu'elle va effacer, triées, et la
  //     liste se coupe là où le seuil tombe » ─────────────────────────────────

  test("l'aire minimale liste les taches, triées, et dit combien partent", async () => {
    const { cadre } = await ouvrirUneTable({
      mesures: {
        taches: [
          { aire: 1, boite: [3, 3, 3, 3], couleur: "#112233", point: [3, 3] },
          { aire: 2, boite: [8, 8, 9, 9], couleur: "#445566", point: [8, 8] },
          { aire: 900, boite: [0, 0, 63, 63], couleur: "#778899", point: [0, 0] },
        ],
        coupees: 12,
        poches: [],
        crans_occupation: [],
      },
    })

    fireEvent.click(puce(cadre, "bords"))
    // Le seuil par défaut est 3 px : les deux petites partent, le sujet reste.
    expect(await cadre.findByText("2 taches effacées sur 3")).toBeTruthy()
    // Triées de la plus petite à la plus grande — l'ordre du seuil.
    const aires = within(cadre.getByRole("list")).getAllByText(/^\d+ px$/)
      .map((n) => n.textContent)
    expect(aires).toEqual(["1 px", "2 px", "900 px"])
    // **Ce qui est coupé se dit**, jamais tu en silence.
    expect(cadre.getByText(/12 taches de plus, non listées/)).toBeTruthy()
  })

  // ── « Le détourage propose les poches de fond enfermées, cerclées et
  //     comptées, et n'en efface aucune de lui-même » ─────────────────────────

  test("le détourage compte les poches enfermées, et dit qu'il n'en efface aucune", async () => {
    const { cadre, appels } = await ouvrirUneTable({
      mesures: {
        taches: [],
        coupees: 0,
        poches: [
          { aire: 42, boite: [10, 10, 19, 19], couleur: "#203040", point: [12, 10] },
          { aire: 4, boite: [30, 30, 31, 31], couleur: "#405060", point: [30, 30] },
        ],
        poches_total: 2,
        crans_occupation: [],
      },
    })

    expect(await cadre.findByText(/2 poches de fond enfermées/)).toBeTruthy()

    // **Le geste est une proposition, et elle vise un pixel de la poche** — pas
    // le centre de sa boîte, qui tombe dans le sujet dès que la zone est courbe.
    // Rien n'est effacé sans que la recette le dise : c'est une passe pipette
    // de plus, qui s'annule comme les autres.
    fireEvent.click(cadre.getAllByRole("button", { name: "la retirer ›" })[0])
    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      const passes = (envoi?.corps as { passes: Record<string, unknown>[] }).passes
      expect(passes[passes.length - 1]).toMatchObject({
        moteur: "couleur",
        point: [12, 10],
        portee: "tache",
        masquee: false,
        trace: [],
        modele: "",
      })
    })

    expect(
      cadre.getByText(/le produit n'en efface aucune/),
    ).toBeTruthy()
  })

  // ── « Le curseur d'occupation ne s'arrête que là où l'image change, et dit
  //     sur combien de pixels il tombe » ──────────────────────────────────────

  test("le curseur d'occupation dit ses crans et le nombre de pixels", async () => {
    const { cadre } = await ouvrirUneTable({
      mesures: {
        taches: [],
        coupees: 0,
        poches: [],
        crans_occupation: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      },
    })

    fireEvent.click(puce(cadre, "grille"))
    // **Un pour cent n'est pas une mesure** : ce que la hauteur décide est un
    // nombre de carrés, et c'est ce nombre qu'on compare. Il est passé du texte
    // des crans à l'échantillon, où il se lit à côté du dessin.
    expect(
      await cadre.findByText(/l'image revient en 64 carrés de côté/),
    ).toBeTruthy()
    expect(cadre.getByText(/100 % d'un personnage/)).toBeTruthy()
    // **Le curseur ne s'arrête que là où l'image change**, et le compte des
    // positions offertes suit maintenant le plafond de la case — 791 sur une
    // case de 64 carrés, depuis que la hauteur peut monter à huit personnages.
    expect(
      cadre.getByText(/10 crans changent l'image, sur les 791 du curseur/),
    ).toBeTruthy()
  })

  test("la hauteur d'une image peut dépasser le personnage, et le dit", async () => {
    // **C'est la tranche des tailles**, et c'est ce qui rend un bâtiment
    // fabricable : le curseur montait à 100 %, donc rien ne pouvait être plus
    // haut qu'un personnage. À 300 % l'image revient en 192 carrés, et
    // l'échantillon dit les deux lectures — trois personnages, 192 carrés.
    const moulin = asset("bbbb2222-0", "le moulin")
    const { cadre } = await ouvrirUneTable({}, [
      {
        ...moulin,
        recette: {
          ...moulin.recette,
          grille: {
            cible: 64,
            occupation: 300,
            ancrage: "bas" as const,
            decalage: 0,
            methode: "proche" as const,
          },
        },
      },
    ])

    fireEvent.click(puce(cadre, "grille"))
    expect(await cadre.findByText(/3 personnages de haut/)).toBeTruthy()
    expect(cadre.getByText(/l'image revient en 192 carrés de côté/)).toBeTruthy()
  })

  // ── « L'écran montre le pas retrouvé, et laisse l'imposer à la main quand la
  //     détection renonce » (D2, seconde moitié) ──────────────────────────────

  test("la table de grille dit sur quels carrés le modèle a peint", async () => {
    // **La table portait quatre réglages et ne disait pas sur quoi ils
    // travaillaient.** Un dessin peint sur des carrés de 8 pixels ne rendra
    // jamais 128 carrés propres, et rien à l'écran ne le disait. Le pas seul ne
    // suffirait pas : la taille se règle en carrés, donc la mesure les compte.
    const { cadre } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "grille"))
    expect(await cadre.findByText(/carrés de 8 pixels/)).toBeTruthy()
    expect(cadre.getByText(/128 de côté/)).toBeTruthy()
    expect(cadre.getByText(/plus de détail à récupérer/)).toBeTruthy()
  })

  test("sur une peinture, la table dit qu'elle renonce et la taille reste à la main", async () => {
    // **Renoncer n'est pas une panne, c'est la bonne réponse.** Sur une
    // peinture il n'y a aucune grille à retrouver, et la mesure d'avant
    // répondait « 2 » en y croyant. La phrase vient du serveur telle quelle :
    // c'est lui qui sait *pourquoi* il s'est tu.
    const renonce =
      "le modèle a peint une image lisse : il n'y a aucune grille à retrouver, " +
      "c'est la taille demandée qui décide des carrés"
    const { cadre } = await ouvrirUneTable({
      mesures: {
        grille_du_modele: {
          pas: 0,
          nettete: 0.94,
          peigne: 0.03,
          carres: 0,
          // **Zéro quand la détection renonce**, et c'est sans conséquence :
          // sans pas, personne ne lit la phase (D4).
          phase: [0, 0],
          raison: renonce,
        },
      },
    })

    fireEvent.click(puce(cadre, "grille"))
    expect(await cadre.findByText(renonce)).toBeTruthy()
    // Rien n'a disparu : les neuf crans de taille sont là, et c'est **la**
    // réponse quand la détection se tait — la cible est demandée, jamais
    // déduite de l'image reçue.
    expect(cadre.getByRole("button", { name: "64" })).toBeTruthy()
    expect(cadre.queryByText(/carrés de \d+ pixels/)).toBeNull()
  })

  // ── « Le rectangle de recadrage se pose sur l'image » ──────────────────────

  test("le rectangle de recadrage se glisse sur l'image, et se lit dans la table", async () => {
    const { cadre, appels } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "recadrage"))
    // Sans rectangle tracé, c'est la boîte du sujet qui décide, et la table
    // écrit ses coordonnées avec leur provenance — un constat, pas un réglage.
    const provenance = await cadre.findByText(/mesurée sur l'alpha/)
    expect(provenance.className).toContain("text-epingle")

    const toile = document.querySelector("[data-cadre-recadrage]") as HTMLElement
    expect(toile).toBeTruthy()
    // Le cadre **est** l'image : la mesure est doublée par l'essai, comme pour
    // la grille et l'aperçu.
    toile.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 512 }) as DOMRect

    fireEvent.pointerDown(toile, { button: 0, clientX: 64, clientY: 64, pointerId: 1 })
    fireEvent.pointerMove(toile, { clientX: 256, clientY: 320, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      // 512 px d'écran pour 1 024 px d'image : le facteur est deux.
      expect(
        (envoi?.corps as { recadrage: { boite: number[] } }).recadrage.boite,
      ).toEqual([128, 128, 512, 640])
    })
  })

  test("le même geste désigne les mêmes pixels à 37 % qu'à 100 %", async () => {
    // **Le critère de U2, pris à l'écran.** La surface reçoit le geste,
    // l'image est posée dedans en tenant dans le cadre : dès que les deux
    // proportions diffèrent d'un cheveu — un arrondi de zoom suffit —, l'image
    // est centrée avec des bandes vides de chaque côté. Un calcul qui mesure la
    // surface au lieu de l'image se décale de la largeur de la bande.
    const tracer = async (largeur: number, hauteur: number) => {
      const { cadre, appels } = await ouvrirUneTable()
      fireEvent.click(puce(cadre, "recadrage"))
      const toile = await waitFor(() => {
        const noeud = document.querySelector("[data-cadre-recadrage]")
        if (!noeud) throw new Error("pas de cadre de recadrage")
        return noeud as HTMLElement
      })
      // La surface est plus large que l'image ne l'occupe : c'est le cas que
      // l'arrondi du zoom fabrique, et celui qui décalait le tracé.
      toile.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: largeur, height: hauteur }) as DOMRect
      // On vise le quart et les trois quarts **de l'image**, pas de la surface.
      const echelle = Math.min(largeur / 1024, hauteur / 1024) * 1024
      const gauche = (largeur - echelle) / 2
      const haut = (hauteur - echelle) / 2
      fireEvent.pointerDown(toile, {
        button: 0,
        clientX: gauche + echelle * 0.25,
        clientY: haut + echelle * 0.25,
        pointerId: 1,
      })
      fireEvent.pointerMove(toile, {
        clientX: gauche + echelle * 0.75,
        clientY: haut + echelle * 0.75,
        pointerId: 1,
      })
      fireEvent.pointerUp(toile, { pointerId: 1 })
      const boite = await waitFor(() => {
        const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
        const lu = (envoi?.corps as { recadrage?: { boite?: number[] } })?.recadrage
          ?.boite
        if (!lu) throw new Error("aucun rectangle posé")
        return lu
      })
      cleanup()
      FluxDouble.ouverts = []
      return boite
    }

    // 1 024 px d'image dans une surface carrée de 1 024 : cent pour cent.
    expect(await tracer(1024, 1024)).toEqual([256, 256, 768, 768])
    // La même image à trente-sept pour cent, dans une surface qui n'a pas ses
    // proportions : les mêmes pixels, au pixel d'arrondi près.
    const a37 = await tracer(600, 379)
    expect(a37[0]).toBeGreaterThanOrEqual(253)
    expect(a37[0]).toBeLessThanOrEqual(259)
    expect(a37[2]).toBeGreaterThanOrEqual(765)
    expect(a37[2]).toBeLessThanOrEqual(771)
  })

  // ── « La pipette retire une tache, ou toutes les taches de sa couleur, au
  //     choix écrit » ────────────────────────────────────────────────────────
  //
  // Le dernier critère ouvert de l'étape, et il tenait sur un arbitrage : ce que
  // la recette retient d'un clic dans l'image. Un identifiant de tache se
  // recalcule à chaque rendu, donc il désigne autre chose dès qu'un réglage
  // au-dessus bouge ; un point ne bouge pas. C'est le point qui est retenu, et
  // ces essais-ci vérifient que c'est bien lui qui part au serveur.

  /** Une image dont la recette porte déjà une passe pipette, visée ou non. */
  const AVEC_PIPETTE = (point: [number, number] | null) => [
    {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: {
        ...RECETTE_VIDE,
        passes: [
          {
            moteur: "couleur" as const,
            tolerance: 28,
            seuil_alpha: 128,
            durcissement: 0,
            point,
            portee: "tache" as const,
            masquee: false as const,
            trace: [],
            modele: "",
          },
        ],
      },
    },
  ]

  test("la pipette pose un point dans l'image, et c'est le point qui part", async () => {
    const { cadre, appels } = await ouvrirUneTable(
      { mesures: { visees: [null] } },
      AVEC_PIPETTE(null),
    )

    // **Une pipette non visée ne retire rien, et elle le dit** — plutôt que de
    // laisser croire à une passe qui ne marche pas.
    expect(
      await cadre.findByText(/tant qu'aucun point n'est posé, cette passe ne retire rien/),
    ).toBeTruthy()

    // Viser arme la surface. Elle n'est pas là avant : une pipette permanente
    // ferait de chaque regard sur l'image un risque de clic.
    expect(document.querySelector("[data-pipette]")).toBeNull()
    fireEvent.click(cadre.getByRole("button", { name: "viser dans l'image ›" }))

    const toile = document.querySelector("[data-pipette]") as HTMLElement
    expect(toile).toBeTruthy()
    // Le cadre **est** l'image : la mesure est doublée, comme pour le rectangle
    // de recadrage.
    toile.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 512 }) as DOMRect

    fireEvent.click(toile, { clientX: 64, clientY: 128 })

    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      const passe = (envoi?.corps as { passes: { point: number[] }[] }).passes[0]
      // 512 px d'écran pour 1 024 px d'image : le facteur est deux.
      expect(passe.point).toEqual([128, 256])
    })
  })

  test("la couleur visée se lit dans les mesures, et n'est jamais dans la recette", async () => {
    const { cadre, appels } = await ouvrirUneTable(
      { mesures: { visees: ["#f2efe6"] } },
      AVEC_PIPETTE([120, 200]),
    )

    // Elle s'affiche telle que le serveur l'a mesurée sous le point.
    expect(await cadre.findByText("#f2efe6")).toBeTruthy()

    // Et changer un réglage de la passe ne la renvoie pas : ce qui part est le
    // point, jamais la couleur. Une couleur écrite à côté du point qui la porte
    // serait une copie que plus rien ne met à jour.
    fireEvent.click(cadre.getByRole("button", { name: "partout" }))
    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      const passe = (envoi?.corps as { passes: Record<string, unknown>[] }).passes[0]
      expect(passe.portee).toBe("partout")
      expect(passe.point).toEqual([120, 200])
      expect(passe.couleur).toBeUndefined()
    })
  })

  test("les deux portées sont écrites, et « cette tache » est celle qui est posée", async () => {
    const { cadre } = await ouvrirUneTable(
      { mesures: { visees: ["#f2efe6"] } },
      AVEC_PIPETTE([120, 200]),
    )

    // **Le choix est écrit, pas deviné** — le critère en toutes lettres. Et le
    // défaut est le geste pour lequel la pipette a été admise : retirer un creux
    // de fond sans toucher au reste.
    const tache = await cadre.findByRole("button", { name: "cette tache" })
    expect(tache.className).toContain("border-signal")
    expect(
      cadre.getByRole("button", { name: "partout" }).className,
    ).not.toContain("border-signal")
  })

  test("le clic désarme la visée : regarder l'image ne déplace pas le point", async () => {
    const { cadre } = await ouvrirUneTable(
      { mesures: { visees: [null] } },
      AVEC_PIPETTE(null),
    )

    fireEvent.click(await cadre.findByRole("button", { name: "viser dans l'image ›" }))
    const toile = document.querySelector("[data-pipette]") as HTMLElement
    toile.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 512, height: 512 }) as DOMRect
    fireEvent.click(toile, { clientX: 64, clientY: 128 })

    // Viser est un geste qui se termine. Une visée qui reste armée ferait du
    // prochain regard sur l'image un déplacement du point.
    await waitFor(() => expect(document.querySelector("[data-pipette]")).toBeNull())
  })

  // ── « Le découpage s'ouvre depuis la barre » ───────────────────────────────

  test("le découpage s'ouvre dans le cadre de la table, sans changer d'onglet", async () => {
    const { cadre } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "découpage"))
    // **On ne le cherche plus : il est là quand il sert.** La fabrique prend le
    // cadre entier — elle n'écrit rien sur l'image courante, et la montrer
    // entre deux colonnes de réglages mentirait sur ce qu'elle fait.
    expect(await screen.findByText("Ce qui sortira")).toBeTruthy()
    expect(
      screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  // ── U10 · Chaque passe dit ce qu'elle enlève ──────────────────────────────
  //
  // **Une recette de détourage porte plusieurs passes qui s'enchaînent, et l'on
  // ne voit que leur somme** : impossible de savoir laquelle a mangé quoi.
  // Chacune reçoit un interrupteur qui la retire du calcul le temps qu'on
  // regarde. Ce n'est pas la retirer — c'est le geste de la veille d'une table
  // (U4), un cran plus bas, et la même règle : ce qu'on éteint garde ses
  // réglages.
  //
  // Ce que le calcul en fait — la passe sautée, la case de la grille qui suit,
  // la pipette qui cesse de traverser ce qui est déjà effacé — vit dans
  // `tests/test_u10.py`, et le défaut de la pipette est reproduit et chiffré
  // dans le banc `essais/essai_pipette_seconde.py`.

  /** Une image dont la recette porte **deux** passes : un bord, puis une
   *  pipette visée. C'est l'enchaînement par lequel le défaut est passé. */
  const DEUX_PASSES = (masquee = false) => [
    {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: {
        ...RECETTE_VIDE,
        passes: [
          {
            moteur: "bord" as const,
            tolerance: 8,
            seuil_alpha: 128,
            durcissement: 0,
            point: null,
            portee: "tache" as const,
            masquee: false,
            trace: [],
            modele: "",
          },
          {
            moteur: "couleur" as const,
            tolerance: 20,
            seuil_alpha: 128,
            durcissement: 0,
            point: [16, 32] as [number, number],
            portee: "tache" as const,
            masquee,
            trace: [],
            modele: "",
          },
        ],
      },
    },
  ]

  const derniereRecette = (appels: { url: string; corps?: unknown }[]) =>
    (
      appels.filter((a) => a.url.includes("/recipe")).pop()?.corps as {
        passes: { masquee: boolean; tolerance: number }[]
      }
    )?.passes

  test("chaque passe porte un interrupteur, et le masquer part au serveur", async () => {
    const { cadre, appels } = await ouvrirUneTable(
      { mesures: { visees: [null, "#2a2a2a"] } },
      DEUX_PASSES(),
    )

    fireEvent.click(cadre.getByRole("switch", { name: "passe 2 — visible" }))

    await waitFor(() => {
      const passes = derniereRecette(appels)
      if (!passes) throw new Error("la recette n'est pas partie")
      // **Deux passes, toujours** : masquer n'en retire aucune. C'est le
      // serveur qui refait l'image sans elle, l'écran ne recalcule rien.
      expect(passes).toHaveLength(2)
      expect(passes[1].masquee).toBe(true)
      expect(passes[0].masquee).toBe(false)
    })
  })

  test("masquer n'est pas retirer, et la passe garde tous ses réglages", async () => {
    const { cadre } = await ouvrirUneTable(
      { mesures: { visees: [null, "#2a2a2a"] } },
      DEUX_PASSES(true),
    )

    // Le mot a changé de sens dans les deux directions : on remontre ce qu'on
    // avait masqué, et « retirer » est toujours là, à côté, pour l'autre geste.
    expect(
      await cadre.findByRole("switch", { name: "passe 2 — masquée" }),
    ).toBeTruthy()
    expect(cadre.getAllByRole("button", { name: "retirer" })).toHaveLength(2)
    expect(
      cadre.getByText(/retirée du calcul, elle garde tous ses réglages/),
    ).toBeTruthy()

    // **Et ses réglages sont sous les yeux, pas cachés** : les cacher rendrait
    // le masque impossible à défaire en connaissance de cause.
    const tolerances = cadre.getAllByLabelText(
      "tolérance, en chiffres",
    ) as HTMLInputElement[]
    expect(tolerances[1].value).toBe("20")
  })

  test("toucher un réglage d'une passe masquée la remontre", async () => {
    // **La règle de la veille d'une table, un cran plus bas** : poser une
    // valeur *dit* qu'on veut cette passe. Refuser le curseur obligerait à un
    // geste préalable pour avoir le droit de faire le geste qu'on voulait.
    const { cadre, appels } = await ouvrirUneTable(
      { mesures: { visees: [null, "#2a2a2a"] } },
      DEUX_PASSES(true),
    )

    const champ = (
      cadre.getAllByLabelText("tolérance, en chiffres") as HTMLInputElement[]
    )[1]
    fireEvent.change(champ, { target: { value: "40" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => {
      const passes = derniereRecette(appels)
      if (!passes) throw new Error("la recette n'est pas partie")
      expect(passes[1].tolerance).toBe(40)
      expect(passes[1].masquee).toBe(false)
    })
  })

  test("la table dit ce qu'une passe fait de celle qui la précède", async () => {
    // **Le comportement retenu est écrit là où la question se pose.** Elle se
    // pose sur la passe — c'est en en ajoutant une seconde qu'on se demande sur
    // quoi elle travaille —, donc le nom de la passe devient sa poignée.
    const { cadre } = await ouvrirUneTable(
      { mesures: { visees: [null, "#2a2a2a"] } },
      DEUX_PASSES(),
    )

    const nom = cadre.getByText("passe 2")
    expect(nom.className).toContain("decoration-dotted")

    // Et ce que la poignée ouvre répond à la question de la séance, en clair.
    expect(AIDE["detourage.masquee"].long).toContain("ne change pas sa couleur")
    expect(AIDE["detourage.masquee"].long).toContain("couloir invisible")
    expect(AIDE["detourage.portee"].long).toContain(
      "jamais elle ne traverse ce qu'une passe précédente a déjà effacé",
    )
  })

  // ── U12 · La sélection magique — tracer gros, ajuster au bord ─────────────
  //
  // **On entoure grossièrement ce qu'on veut garder, et l'atelier va chercher
  // le bord du sujet lui-même à l'intérieur.** Le trait qu'on fait ne devient
  // jamais le contour du sprite : il borne la recherche. C'est pour ça qu'on
  // peut trembler, et c'est ce qui la distingue de la retouche au pixel.
  //
  // **Elle vit avec le détourage, pas avec la main** — quatrième façon de
  // désigner ce qu'on retire, à côté du bord, de la pipette et du modèle, parce
  // qu'un seul endroit décide de ce qui est effacé. Ce que le calcul en fait —
  // le bord retrouvé, le dehors intact, l'ordre avant le recadrage — vit dans
  // `tests/test_u12.py`.

  /** Une image dont la recette porte une passe « sélection », déjà entourée ou
   *  non. Le brut fait 1 024 px : c'est dans ses pixels que la forme est
   *  exprimée, comme le point de la pipette. */
  const AVEC_SELECTION = (trace: [number, number][]) => [
    {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: {
        ...RECETTE_VIDE,
        passes: [
          {
            moteur: "trace" as const,
            tolerance: 20,
            seuil_alpha: 128,
            durcissement: 0,
            point: null,
            portee: "tache" as const,
            masquee: false,
            trace,
            modele: "",
          },
        ],
      },
    },
  ]

  /** Poser une surface **plus large que l'image ne l'occupe**, et rendre de quoi
   *  viser un pixel d'image donné — le même échafaudage que la table de la
   *  main (U11), parce que c'est le même piège : la surface et l'image ne sont
   *  pas le même rectangle. */
  const poserLaToile = (toile: HTMLElement, cote: number) => {
    toile.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 400 }) as DOMRect
    const rendue = 400
    const gauche = (600 - rendue) / 2
    return (x: number, y: number) => ({
      clientX: gauche + ((x + 0.5) / cote) * rendue,
      clientY: ((y + 0.5) / cote) * rendue,
      pointerId: 1,
    })
  }

  test("choisir la sélection ouvre la surface où l'on entoure", async () => {
    // **Choisir la sélection, c'est demander à entourer.** Le réglage n'a
    // aucune valeur tant qu'aucune forme n'est posée ; un second clic sur un
    // bouton pour avoir le droit de faire le seul geste possible serait une
    // porte devant une porte — la règle de la pipette, mot pour mot.
    const { cadre } = await ouvrirUneTable({}, AVEC_SELECTION([]))

    expect(
      await cadre.findByText(/tant qu'aucune forme n'est entourée/),
    ).toBeTruthy()
    expect(document.querySelector("[data-trace]")).toBeNull()

    fireEvent.click(cadre.getByRole("button", { name: "entourer dans l'image ›" }))

    expect(document.querySelector("[data-trace]")).toBeTruthy()
  })

  test("ce qu'on entoure part en pixels de l'image brute", async () => {
    const { cadre, appels } = await ouvrirUneTable({}, AVEC_SELECTION([]))
    fireEvent.click(cadre.getByRole("button", { name: "entourer dans l'image ›" }))
    const toile = document.querySelector("[data-trace]") as HTMLElement
    const viser = poserLaToile(toile, 1024)

    fireEvent.pointerDown(toile, { button: 0, ...viser(100, 100) })
    fireEvent.pointerMove(toile, viser(400, 100))
    fireEvent.pointerMove(toile, viser(400, 400))
    fireEvent.pointerMove(toile, viser(100, 400))
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => {
      const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
      const passe = (envoi?.corps as { passes: { trace: number[][] }[] })?.passes[0]
      if (!passe) throw new Error("la recette n'est pas partie")
      // Quatre points, dans les pixels du brut — et non dans ceux de la
      // surface, qui fait 600 de large pour une image dessinée en 400.
      expect(passe.trace).toEqual([
        [100, 100],
        [400, 100],
        [400, 400],
        [100, 400],
      ])
    })
  })

  test("la forme se voit pendant qu'on la trace, refermée", async () => {
    // **Le trait de fermeture se voit aussi**, et ce n'est pas un détail : le
    // geste est *entourer*, pas *dessiner une ligne*, et montrer la corde qui
    // manque évite de croire qu'on a laissé un trou.
    const { cadre } = await ouvrirUneTable({}, AVEC_SELECTION([]))
    fireEvent.click(cadre.getByRole("button", { name: "entourer dans l'image ›" }))
    const toile = document.querySelector("[data-trace]") as HTMLElement
    const viser = poserLaToile(toile, 1024)

    fireEvent.pointerDown(toile, { button: 0, ...viser(100, 100) })
    fireEvent.pointerMove(toile, viser(400, 100))

    const forme = toile.querySelector("polygon")
    expect(forme, "la forme en cours ne se voit pas").toBeTruthy()
    expect(forme!.getAttribute("points")).toBe("100.5,100.5 400.5,100.5")
  })

  test("un clic sans tracé ne pose pas de forme vide", async () => {
    // Un clic isolé n'est pas un geste raté : c'est un geste qu'on n'a pas
    // fait. On ne pose donc rien, plutôt qu'une forme qui n'effacerait rien en
    // silence.
    const { cadre, appels } = await ouvrirUneTable({}, AVEC_SELECTION([]))
    fireEvent.click(cadre.getByRole("button", { name: "entourer dans l'image ›" }))
    const toile = document.querySelector("[data-trace]") as HTMLElement
    const viser = poserLaToile(toile, 1024)

    const avant = appels.filter((a) => a.url.includes("/recipe")).length
    fireEvent.pointerDown(toile, { button: 0, ...viser(100, 100) })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    expect(appels.filter((a) => a.url.includes("/recipe"))).toHaveLength(avant)
  })

  test("une forme déjà posée se compte, et se retrace", async () => {
    const { cadre } = await ouvrirUneTable(
      {},
      AVEC_SELECTION([
        [10, 10],
        [40, 10],
        [40, 40],
      ]),
    )

    expect(
      await cadre.findByRole("button", { name: "3 points · entourer à nouveau ›" }),
    ).toBeTruthy()
    // Et la passe dit ce qu'elle fait, plutôt que de laisser deviner.
    expect(
      cadre.getByText(/le bord est cherché à l'intérieur de ce que tu as entouré/),
    ).toBeTruthy()
  })

  // ── U13 · Un second moteur de détourage, plus lourd et meilleur ───────────
  //
  // **Le catalogue décide, jamais une liste en dur.** Le moteur par modèle n'en
  // connaissait qu'un seul, écrit dans le code : on ne pouvait pas en essayer un
  // autre sans toucher au code. Le choix se fait maintenant passe par passe, et
  // le rapide reste ce qu'on obtient sans rien demander.
  //
  // **Deux absences, et elles ne se traitent pas pareil.** Un moteur pas
  // installé du tout est grisé avec sa raison ; un modèle installé mais pas
  // encore descendu reste choisissable et annonce ce qu'il va rapatrier. Ce que
  // les modèles valent l'un contre l'autre vit dans le banc gratuit
  // `essais/essai_moteurs_silhouette.py`.

  /** Une image dont la recette porte une passe « modèle », sur tel modèle. */
  const AVEC_MODELE = (modele: string) => [
    {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: {
        ...RECETTE_VIDE,
        passes: [
          {
            moteur: "modele" as const,
            tolerance: 28,
            seuil_alpha: 128,
            durcissement: 0,
            point: null,
            portee: "tache" as const,
            masquee: false,
            trace: [],
            modele,
          },
        ],
      },
    },
  ]

  test("le modèle se choisit dans le catalogue du serveur", async () => {
    // **L'écran ne tient aucune liste** : il rend celle qu'il reçoit, comme
    // pour les modèles d'image. Un catalogue recopié à l'écran aurait divergé du
    // serveur au premier modèle ajouté.
    const { cadre, appels } = await ouvrirUneTable({}, AVEC_MODELE(""))

    expect(await cadre.findByRole("button", { name: "rapide" })).toBeTruthy()
    fireEvent.click(cadre.getByRole("button", { name: "lourd" }))

    await waitFor(() => {
      const passes = derniereRecette(appels) as unknown as { modele: string }[]
      if (!passes) throw new Error("la recette n'est pas partie")
      expect(passes[0].modele).toBe("birefnet-general")
    })
  })

  test("le lourd dit ce qu'il coûte avant de partir, pas pendant", async () => {
    const { cadre } = await ouvrirUneTable({}, AVEC_MODELE("birefnet-general"))

    // Ce qu'il vaut et ce qu'il coûte, sur la ligne où on le choisit.
    expect(
      await cadre.findByText(/le meilleur sur les silhouettes difficiles/),
    ).toBeTruthy()
    // **Et le poids du téléchargement, parce qu'il n'est pas descendu.** C'est
    // la seconde absence : elle ne grise pas, elle prévient. Le chiffre vient du
    // serveur — 972 666 916 octets relevés, soit 928 Mo.
    const annonce = document.querySelector("[data-modele-a-descendre]")
    expect(annonce?.textContent).toContain("928 Mo")
    expect(annonce?.getAttribute("role")).toBe("status")
  })

  test("un modèle déjà là n'annonce aucun téléchargement", async () => {
    // Le rapide est descendu : il n'y a rien à annoncer, et une annonce qui
    // reste après coup serait une phrase qu'on apprend à ne plus lire.
    const { cadre } = await ouvrirUneTable({}, AVEC_MODELE("u2net"))

    expect(await cadre.findByRole("button", { name: "rapide" })).toBeTruthy()
    expect(document.querySelector("[data-modele-a-descendre]")).toBeNull()
  })

  test("sans modèle écrit, la passe montre le défaut du produit", async () => {
    // **Vide veut dire *le défaut*, et c'est le serveur qui dit lequel.** Une
    // recette écrite avant ce champ rend donc ce qu'elle rendait, et l'écran
    // n'invente aucun défaut de son côté.
    const { cadre } = await ouvrirUneTable({}, AVEC_MODELE(""))

    const rapide = await cadre.findByRole("button", { name: "rapide" })
    expect(rapide.className).toContain("border-signal")
    expect(cadre.getByRole("button", { name: "lourd" }).className).not.toContain(
      "border-signal",
    )
    expect(document.querySelector("[data-modele-a-descendre]")).toBeNull()
  })
})

// ── E4 : la galerie, dégraissée ─────────────────────────────────────────────
//
// L'écran dont le métier est de **juger** rend toute sa place aux images. Il
// perd ce qui n'a jamais été à lui : le champ de prompt, la colonne de réglages,
// le curseur de retouche. C'est le moins de travail des cinq écrans, et c'est la
// dernière de la chaîne — dégraisser avant que le geste soit rendu ailleurs,
// c'est retirer sans donner.

describe("la galerie dégraissée", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const ouvrirLaFiche = async (asset_: Asset) => {
    const double = serveurDouble({ assets: [asset_] })
    await monter(double.fetchDouble, { ...ETAT, assets: [asset_] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    return double
  }

  // ── « La galerie n'a ni champ de prompt, ni colonne de réglages, ni curseur
  //     de retouche » ────────────────────────────────────────────────────────

  test("la galerie n'a ni prompt, ni colonne de réglages, ni curseur de retouche", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0"))

    // Le champ est parti en E2, avec la barre qui paie.
    expect(screen.queryByPlaceholderText("Décris ce que tu veux fabriquer.")).toBeNull()
    // La colonne de 300 px est partie en E4 : elle suit ce qui paie.
    expect(document.querySelector(".w-\\[300px\\]")).toBeNull()
    // Et aucun curseur de retouche : la recette se lit ici, elle se règle dans
    // les tables — sur l'image en grand, ce que 380 px de colonne ne
    // permettaient pas.
    expect(screen.queryByRole("slider")).toBeNull()
  })

  // ── « Le pied de l'écran dit qu'aucun appel ne part d'ici » ────────────────

  test("le pied de la galerie dit qu'aucun appel ne part d'ici", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // De quoi savoir d'un coup d'œil dans quelle moitié du produit on se
    // trouve : ici on juge et on range, on ne paie jamais.
    expect(
      await screen.findByText(/aucun appel ne part d'ici/),
    ).toBeTruthy()
  })

  // ── « La fiche d'une image porte deux portes : l'établi de sa chose, et les
  //     tables » ─────────────────────────────────────────────────────────────

  test("la fiche porte deux portes, et celle de l'établi est grisée sans chose du jeu", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0"))

    // Une image qui n'appartient à personne n'a que la seconde porte — et le
    // grisé de la première porte sa raison, comme partout ailleurs.
    expect(
      screen.getByRole("button", { name: "Reprendre dans l'établi" }),
    ).toBeDisabled()
    expect(
      screen.getByText(/cette image n'appartient à aucune chose du jeu/),
    ).toBeTruthy()

    // La seconde ouvre les tables, sur n'importe quelle image, sans quitter la
    // galerie.
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les tables" }))
    expect(await screen.findByRole("button", { name: /^détourage/ })).toBeTruthy()
    expect(
      screen.getByRole("tab", { name: "Galerie" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  // ── « La galerie s'éteint sous la table » (31 août 2026) ──────────────────
  //
  // **Elle restait montée dessous : invisible, mais vivante.** Mesuré au
  // navigateur — 152 commandes atteignables à la Tabulation quand la table est
  // ouverte, dont 83 hors de l'écran, appartenant toutes à la grille du
  // dessous, « Supprimer la sélection » comprise : on la traversait à
  // l'aveugle. Et les 54 px dont la page débordait faisaient reparaître sa
  // barre tout en bas de la table, ce que la règle « un panneau est borné par
  // l'écran, jamais par son contenu » interdit.

  test("la grille se démonte quand une table s'ouvre par-dessus elle", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0"))
    expect(screen.getByRole("region", { name: "Grille des images" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les tables" }))
    await screen.findByRole("button", { name: /^détourage/ })

    // Ni à l'œil, ni au clavier : la surface n'existe plus tant que la table
    // est ouverte. Rien n'est perdu en partant — ce que la grille tient vit
    // dans `App`, pas dans son montage.
    expect(screen.queryByRole("region", { name: "Grille des images" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Supprimer la sélection" })).toBeNull()

    // Et elle revient telle quelle quand la table se referme.
    fireEvent.click(screen.getByRole("button", { name: "Galerie" }))
    expect(
      await screen.findByRole("region", { name: "Grille des images" }),
    ).toBeTruthy()
  })

  test("la fiche d'une image rattachée ouvre l'établi de sa chose", async () => {
    const image = { ...asset("aaaa1111-0"), personnage: "le-nain" }
    const double = serveurDouble({
      assets: [image],
      personnages: [personnage("Le nain")],
    })
    await monter(double.fetchDouble, { ...ETAT, assets: [image] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])

    fireEvent.click(
      await screen.findByRole("button", { name: "Reprendre dans l'établi" }),
    )
    // L'établi est un onglet plus loin, à la profondeur de la chose : le fil le
    // dit, et l'onglet a changé.
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )
    const fil = within(screen.getByRole("navigation", { name: "Où l'on est" }))
    expect(fil.getByText("Le nain")).toBeTruthy()
  })

  // ── « Une image sans chose du jeu propose de la rattacher, et le
  //     rattachement se défait » ─────────────────────────────────────────────

  test("une image sans chose du jeu propose de la rattacher", async () => {
    const double = serveurDouble({
      assets: [asset("aaaa1111-0")],
      personnages: [personnage("Le nain")],
    })
    await monter(double.fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])

    // « Corps de » : le geste qui rattache une image à une chose du jeu. Il
    // existait déjà en C1 ; ce que E4 ajoute est qu'il est le seul chemin vers
    // l'établi pour une image qui n'appartient à personne.
    expect(await screen.findByText("Corps de")).toBeTruthy()
    expect(screen.getByLabelText("Personnage de cette image")).toBeTruthy()
  })

  // ── « Le filtre par famille a une valeur pour ce qui n'appartient à aucune
  //     chose du jeu » ───────────────────────────────────────────────────────

  test("le filtre par famille a une valeur pour ce qui n'appartient à personne", async () => {
    const orpheline = asset("aaaa1111-0", "un essai")
    const rattachee = { ...asset("bbbb2222-0", "le nain"), personnage: "le-nain" }
    const { fetchDouble } = serveurDouble({ assets: [orpheline, rattachee] })
    await monter(fetchDouble, { ...ETAT, assets: [orpheline, rattachee] })
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    const filtre = screen.getByLabelText("Ne montrer que les images d'une famille")
    // **Neuf appels sur vingt-huit n'ont aucune chose du jeu** : un essai, une
    // texture, une image apportée. Les taire ferait de ces images-là des
    // introuvables, alors que la galerie est leur domicile.
    fireEvent.change(filtre, { target: { value: "aucune" } })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.change(filtre, { target: { value: "personnages" } })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.change(filtre, { target: { value: "" } })
    await waitFor(() => expect(tuiles()).toHaveLength(2))
  })

  // ── « Tout ce que l'écran d'avant permettait se fait encore, ailleurs, et la
  //     fiche dit où » ───────────────────────────────────────────────────────

  test("la recette se lit encore dans la fiche, et la fiche dit où elle se règle", async () => {
    const image = {
      ...asset("aaaa1111-0"),
      recette: { ...RECETTE_VIDE, bords: { aire_min: 4 } },
    }
    await ouvrirLaFiche(image)

    // Elle se **lit** : la fiche dit ce que l'image est.
    expect(await screen.findByText("Sa recette")).toBeTruthy()
    expect(screen.getByText("tache 4 px")).toBeTruthy()

    // Et elle dit où elle se règle : le geste n'a pas disparu, il a changé
    // d'endroit — c'est tout ce que « dégraisser » veut dire.
    //
    // **Par la porte, et par elle seule, depuis le 31 août 2026.** La rubrique
    // de la recette portait en plus un lien *La régler dans les tables ›* qui
    // appelait exactement la même chose que ce bouton-ci, douze lignes plus bas
    // dans le même panneau. Deux noms pour une destination, dans une colonne
    // qu'on lit d'un coup d'œil : le lecteur ne pouvait pas deviner que le
    // second ne menait nulle part de nouveau. La fiche porte **deux portes**,
    // et c'est ce que cet essai tient maintenant.
    expect(
      screen.queryByRole("button", { name: "La régler dans les tables ›" }),
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir les tables" }))
    expect(await screen.findByRole("button", { name: /^bords/ })).toBeTruthy()
  })
})

// ── E5 : les deux dernières places — le contour et la main ──────────────────
//
// Les deux seules capacités de traitement que la V2.1 ajoute. Ce qui se mesure
// sur des pixels — où le trait tombe, de combien il agrandit, qu'un passage se
// rejoue sur une image d'une autre taille — est tenu par `tests/test_e5.py` ;
// ce qui vit ici est ce que l'écran montre, et ce qu'il refuse de deviner.

describe("le contour et la main", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  /** Une table ouverte, sur un jeu qui a une palette — c'est elle que les deux
   *  places proposent sans jamais l'imposer. */
  const ouvrirUneTable = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    palette = ["#1a1420", "#7d5543", "#dfc1a6"],
  ) => {
    const images = [asset("bbbb2222-0", "le nain, au repos")]
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)], ...options })
    await monter(double.fetchDouble, {
      ...ETAT,
      univers: { ...UNIVERS, palette, vide: false },
    })
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const puce = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre.getByRole("button", { name: new RegExp(`^${nom}`) })

  const ouvrir = async (cadre: ReturnType<typeof within>, nom: string) => {
    fireEvent.click(puce(cadre, nom))
    await waitFor(() => expect(cadre.queryByText(/^cette image est/)).toBeNull())
  }

  // ── « Le contour se règle en épaisseur, en couleur et en position » ────────

  test("les quatre réglages du contour sont là, et la barre les résume", async () => {
    const { cadre, appels } = await ouvrirUneTable()
    await ouvrir(cadre, "contours")

    expect(cadre.getByText("épaisseur")).toBeTruthy()
    expect(cadre.getByText("couleur")).toBeTruthy()
    expect(cadre.getByText("position")).toBeTruthy()
    expect(cadre.getByText("les trous")).toBeTruthy()

    // Poser une position pose la place : la barre l'écrit, et le serveur la
    // reçoit — c'est la même valeur des deux côtés.
    fireEvent.click(cadre.getByRole("button", { name: "interne" }))
    await waitFor(() => expect(puce(cadre, "contours").textContent).toContain("interne"))

    const pose = [...appels].reverse().find((a) => a.url.includes("/recipe"))
    expect(pose).toBeTruthy()
    expect((pose!.corps as { contours: Contour }).contours.position).toBe("interne")
  })

  // ── « Choisir la position extérieure écrit que l'image s'agrandit, et de
  //     combien » ────────────────────────────────────────────────────────────

  test("la position dit ce qu'elle fait aux dimensions, au moment où on la choisit", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "contours")

    // Le défaut est externe, à une épaisseur de 1 : deux pixels de plus.
    expect(cadre.getByText(/la silhouette grandit de 2 px/)).toBeTruthy()

    // Interne ne bouge pas la boîte, et le dit autrement — une rangée qui
    // afficherait « + 0 » en permanence serait du cadrage montré.
    fireEvent.click(cadre.getByRole("button", { name: "interne" }))
    await waitFor(() => expect(cadre.getByText(/la boîte ne bouge pas/)).toBeTruthy())

    // **À cheval, le pixel impair va vers l'extérieur** : à trois d'épaisseur,
    // la croissance vaut quatre et non trois. L'annoncer autrement serait faux.
    fireEvent.click(cadre.getByRole("button", { name: "centré" }))
    fireEvent.change(cadre.getAllByRole("slider")[0], { target: { value: "3" } })
    await waitFor(() => expect(cadre.getByText(/grandit de 4 px/)).toBeTruthy())
  })

  // ── « La palette du jeu est proposée et jamais imposée ; une couleur hors
  //     palette est marquée, pas refusée » ───────────────────────────────────

  test("la palette se propose, et une couleur qui n'y est pas se marque", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "contours")

    // La plus sombre de la palette est proposée, et la provenance le dit.
    expect(cadre.getByText(/proposé, d'après ta palette/)).toBeTruthy()
    expect(cadre.getByText(/#1a1420 · dans la palette/)).toBeTruthy()

    // Une couleur libre entre, et elle est **marquée** — jamais refusée.
    fireEvent.change(cadre.getByLabelText("Couleur, en hexadécimal"), {
      target: { value: "#ff00ff" },
    })
    await waitFor(() => expect(cadre.getByText(/#ff00ff · hors palette/)).toBeTruthy())
  })

  // ── « Les passages s'empilent en calques nommables, masquables et
  //     réordonnables » ──────────────────────────────────────────────────────

  test("la pile se lit du dessus au dessous, et l'opacité est son sol", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    expect(cadre.getByText("les calques")).toBeTruthy()
    expect(cadre.getByText(/est le sol de la pile/)).toBeTruthy()
    // **Elle ne se supprime pas et ne se déplace pas** — vrai par construction,
    // puisqu'elle n'est pas dans la liste des calques.
    expect(cadre.queryByLabelText("Supprimer l'opacité")).toBeNull()
    expect(cadre.queryByLabelText("Monter l'opacité")).toBeNull()

    fireEvent.click(cadre.getByRole("button", { name: "+ calque de dessin" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())

    // Un second calque, et le premier gagne de quoi monter : la pile se
    // réordonne dès qu'il y a deux choses à ordonner.
    fireEvent.click(cadre.getByRole("button", { name: "+ calque de dessin" }))
    await waitFor(() => expect(cadre.getByLabelText(/Monter calque 1/)).toBeTruthy())
  })

  test("masquer un calque n'efface rien, et le serveur le sait", async () => {
    const { cadre, appels } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    fireEvent.click(cadre.getByRole("button", { name: "+ calque de dessin" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())
    fireEvent.click(cadre.getByLabelText(/Masquer calque 1/))

    await waitFor(() => {
      const derniere = [...appels].reverse().find((a) => a.url.includes("/recipe"))
      const main = (derniere!.corps as { main: Main }).main
      // Le calque est **toujours là** : masqué, pas supprimé.
      expect(main.calques).toHaveLength(1)
      expect(main.calques[0].visible).toBe(false)
    })
  })

  test("le carré de la main reste creux tant qu'aucun passage n'est posé", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    fireEvent.click(cadre.getByRole("button", { name: "+ calque de dessin" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())

    // **Le carré se remplit quand la place change l'image, pas quand elle
    // figure dans la recette** : trois calques vides ne changent rien.
    expect(puce(cadre, "la main").textContent).toBe("la main")
  })

  // ── « Une table qui se peint force le rendu » ─────────────────────────────

  test("la main ne grise plus que le brut, et gagne les trois témoins", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    // **Le pinceau écrit sur le résultat** : une image d'origine que la recette
    // réécrit derrière n'a rien à recevoir. C'est la seule chose que cette
    // table retire.
    expect(cadre.getByRole("button", { name: "brut" })).toBeDisabled()

    // **Et les trois témoins lui sont ouverts.** Ils lui étaient tous grisés,
    // et c'est la table où comparer sert le plus : on peint un masque, on veut
    // voir ce qu'il enlève pendant qu'on peint. Le grisé n'était pas une
    // décision, c'était la conséquence d'une scène qui ne savait rendre qu'une
    // chose à la fois.
    for (const temoin of ["aucun", "à côté", "par-dessus"]) {
      expect(cadre.getByRole("button", { name: temoin }), temoin).not.toBeDisabled()
    }
    fireEvent.click(cadre.getByRole("button", { name: "par-dessus" }))
    await waitFor(() =>
      expect(document.querySelector("[data-toile-main]")).toBeTruthy(),
    )

    // La raison du grisé vit dans le panneau : la bande de 38 px n'a pas la
    // place d'une phrase, et elle ne grandit pas.
    expect(cadre.getByText(/le brut s'éteint dans le comparateur/)).toBeTruthy()
    // **Avant › reste, et change de raison** : il ne compense plus rien, il est
    // simplement plus rapide que deux clics.
    expect(cadre.getByRole("button", { name: "Avant ›" })).toBeTruthy()
  })

  test("changer de table rend le brut, et la main le reprend", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")
    expect(cadre.getByRole("button", { name: "brut" })).toBeDisabled()

    await ouvrir(cadre, "bords")
    expect(cadre.getByRole("button", { name: "brut" })).not.toBeDisabled()
  })

  // ── Le pinceau, et les deux bouts d'un seul réglage ───────────────────────

  test("le pinceau ne rend que des impairs, et le cran de 1 px est le pixel", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    const curseur = cadre.getAllByRole("slider")[0]
    expect(curseur.getAttribute("step")).toBe("2")
    expect(curseur.getAttribute("min")).toBe("1")
    expect(curseur.getAttribute("max")).toBe("129")

    fireEvent.change(curseur, { target: { value: "1" } })
    await waitFor(() => expect(cadre.getByText(/c'est le pixel/)).toBeTruthy())
  })

  test("le sens change de nom avec le calque actif", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    // Sur l'opacité : elle décide de ce qui est là.
    expect(cadre.getByRole("button", { name: "remettre" })).toBeTruthy()
    expect(cadre.getByRole("button", { name: "ôter" })).toBeTruthy()
    expect(cadre.getByText(/l'opacité ne pose aucune couleur/)).toBeTruthy()

    // Sur un calque de dessin : il ajoute de la matière, et il a une couleur.
    fireEvent.click(cadre.getByRole("button", { name: "+ calque de dessin" }))
    await waitFor(() => expect(cadre.getByRole("button", { name: "poser" })).toBeTruthy())
    expect(cadre.getByRole("button", { name: "effacer" })).toBeTruthy()
    expect(cadre.getByText("la couleur")).toBeTruthy()
  })

  // ── E6 : la superposition, seconde fabrique ─────────────────────────────
  //
  // Ce qui se mesure sur des pixels — le calque, l'aplat, le recalage — est
  // tenu par `tests/test_e6.py`. Ce qui vit ici est ce que l'écran montre, et
  // surtout ce qu'il **ne propose pas**.

  /** La fabrique, ouverte sur **deux** images : c'est ce qu'elle demande, et
   *  sans la seconde tout ce qui suit serait grisé pour une autre raison que
   *  celle qu'on veut mesurer. */
  const ouvrirLaFabrique = async () => {
    const dessus = asset("bbbb2222-0", "le nain, au repos")
    const dessous = asset("bbbb2222-1", "le nain, casqué")
    const { cadre, ...reste } = await ouvrirUneTable({
      assets: [dessus, dessous],
    })
    fireEvent.click(puce(cadre, "superposition"))
    await cadre.findByText("les deux images")
    return { cadre, ...reste }
  }

  test("les deux images se choisissent, et s'intervertissent", async () => {
    const { cadre } = await ouvrirLaFabrique()

    // Le dessus se déplace, le dessous est le sol : on ne le manipule jamais.
    expect(cadre.getByText("DESSUS · SE DÉPLACE")).toBeTruthy()
    expect(cadre.getByRole("button", { name: "↕ échanger" })).toBeTruthy()
    // Chacune se change — sans quoi la fabrique ne marcherait que sur la paire
    // qu'un aller-retour d'équipement a préremplie.
    expect(cadre.getAllByRole("button", { name: "changer ›" }).length).toBeGreaterThan(0)
  })

  test("le calage se fait au rail, au champ et aux touches, après une proposition", async () => {
    const { cadre } = await ouvrirLaFabrique()

    // **Un bouton, pas un mode.**
    expect(cadre.getByRole("button", { name: "Recaler" })).toBeTruthy()

    for (const nom of ["échelle", "horizontal", "vertical"]) {
      expect(cadre.getByLabelText(nom)).toBeTruthy() // le rail
      expect(cadre.getByLabelText(`${nom}, en chiffres`)).toBeTruthy() // le champ
    }
    // Les touches suivent l'axe qu'elles commandent, et **elles sont aussi les
    // boutons** : une seule chose à l'écran enseigne et agit.
    expect(cadre.getByLabelText("horizontal — ←")).toBeTruthy()
    expect(cadre.getByLabelText("horizontal — →")).toBeTruthy()
    expect(cadre.getByLabelText("vertical — ↑")).toBeTruthy()
    expect(cadre.getByLabelText("échelle — +")).toBeTruthy()

    // Et le pas se corrige d'un cran, sans passer par le rail.
    fireEvent.click(cadre.getByLabelText("horizontal — →"))
    await waitFor(() =>
      expect(cadre.getByLabelText("horizontal, en chiffres")).toHaveValue(1),
    )
  })

  test("l'alerte du détourage nomme la conséquence et propose le geste", async () => {
    const { cadre } = await ouvrirLaFabrique()

    // **Le produit constate, il ne refuse pas** : le bouton de fabrique reste
    // vivant, et l'alerte dit ce qui arriverait.
    expect(await cadre.findByText(/le calque prendrait tout le fond/)).toBeTruthy()
    expect(cadre.getByRole("button", { name: /reprendre les .* passes du dessous/ }))
      .toBeTruthy()
    expect(cadre.getByRole("button", { name: /^Fabriquer/ })).not.toBeDisabled()
  })

  test("les trois vues sont là en même temps, et deux d'entre elles ne sortent pas", async () => {
    const { cadre } = await ouvrirLaFabrique()

    // Le travail au centre, le calque seul et le résultat à droite.
    expect(cadre.getByText("le calque seul")).toBeTruthy()
    expect(cadre.getByText("le résultat")).toBeTruthy()
    expect(cadre.getByRole("button", { name: "masquer le calque" })).toBeTruthy()
    // **Les blocs « voir » ne changent que l'affichage**, et l'en-tête le dit.
    expect(cadre.getByText(/ne change pas la sortie/)).toBeTruthy()
  })

  test("les deux sorties se cochent au lieu de s'exclure, et le bouton les compte", async () => {
    const { cadre } = await ouvrirLaFabrique()

    expect(cadre.getByRole("button", { name: /^Fabriquer — 1 image/ })).toBeTruthy()
    fireEvent.click(cadre.getByRole("checkbox", { name: /aplat/ }))
    await waitFor(() =>
      expect(cadre.getByRole("button", { name: /^Fabriquer — 2 images/ })).toBeTruthy(),
    )

    // Rien de coché : le bouton est grisé, il ne ment pas sur ce qu'il ferait.
    fireEvent.click(cadre.getByRole("checkbox", { name: /calque/ }))
    fireEvent.click(cadre.getByRole("checkbox", { name: /aplat/ }))
    await waitFor(() =>
      expect(cadre.getByRole("button", { name: /^Fabriquer/ })).toBeDisabled(),
    )
  })

  test("aucun écran ne propose de reposer un calque sur une autre pose", async () => {
    // **La promesse retirée deux fois, et gardée.** Un casque vu de face n'est
    // pas un casque vu de dos : un calque est solidaire de sa pose, et c'est le
    // pliage qui divise son prix. La maquette de la superposition rouvrait cette
    // promesse ; le sommaire du chantier la marque « à reprendre », et aucune
    // mesure ne la soutient (`docs/v21-arbitrages.md` A-12).
    const { cadre } = await ouvrirLaFabrique()

    expect(cadre.queryByText(/autre pose/i)).toBeNull()
    expect(cadre.queryByText(/toutes les poses/i)).toBeNull()
    expect(cadre.queryByRole("button", { name: /reposer/i })).toBeNull()
  })

  test("la fabrique dit qu'aucun appel n'en part", async () => {
    // Le pendant de « la galerie ne paie pas » : ici non plus, et l'écran le
    // dit avant qu'on ait lu.
    const { cadre } = await ouvrirLaFabrique()
    expect(cadre.getByText("aucun appel ne part d'ici")).toBeTruthy()
  })
})

// ── E8 : l'assistant de démarrage ──────────────────────────────────────────
//
// Ce qui se mesure sur le serveur — qu'un choix unique remplit le réglage *et*
// la phrase, que le produit ne réécrit jamais ce que l'auteur a tapé — est tenu
// par `tests/test_e8.py`. Ce qui vit ici est ce que l'écran montre : les dix
// étapes, leurs deux humeurs, et la colonne qui devient un récapitulatif.

describe("l'assistant de démarrage", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const ouvrirLAssistant = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    univers: Univers = UNIVERS,
  ) => {
    const double = serveurDouble({ univers, ...options })
    await monter(double.fetchDouble, { ...ETAT, univers })
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    await screen.findByRole("button", { name: "Le nom" })
    return double
  }

  // ── « Dix étapes en quatre groupes, et la colonne les range » ─────────────

  test("les douze étapes sont là, rangées en quatre groupes", async () => {
    await ouvrirLAssistant()

    for (const nom of [
      "Le nom",
      // **La deuxième, arrivée en D2** : le style graphique. Elle est si haut
      // parce qu'elle commande toutes les suivantes — la taille devient un
      // nombre de carrés ou une finesse selon ce qu'on y répond.
      "Le style",
      "La vue",
      "La taille",
      "Les types d'objets",
      "L'allure",
      "Références et couleurs",
      "Poses et états",
      "Emplacements",
      "Les IA à utiliser",
      // **La onzième, arrivée en D1**, et dans « la production » avec les deux
      // d'avant : comme elles, elle ne décide de rien de ce qui part au modèle,
      // seulement de ce que l'atelier fait de l'image au retour.
      "Le détourage de départ",
      "Les fournisseurs",
    ]) {
      expect(screen.getByRole("button", { name: nom })).toBeTruthy()
    }
    // Les quatre groupes : ce qu'on fabrique, comment ça doit avoir l'air,
    // combien d'images il faudra, ce qui vaut pour tous les jeux.
    for (const groupe of ["le jeu", "le style", "la production", "l'atelier"]) {
      expect(screen.getByText(groupe)).toBeTruthy()
    }
  })

  test("la colonne porte la valeur de chaque étape, et se lit comme un récapitulatif", async () => {
    // **Un jeu déjà réglé** : la colonne dit ce qu'il vaut, sans rien ouvrir.
    await ouvrirLAssistant({}, { ...UNIVERS, vue: "vue-dessus-34", vide: false })

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "La vue" }).textContent).toContain(
        "De dessus, 3/4",
      ),
    )
    expect(screen.getByRole("button", { name: "La taille" }).textContent).toContain("64")
    expect(
      screen.getByRole("button", { name: "Les types d'objets" }).textContent,
    ).toContain("types")
  })

  test("le pied a une seule humeur, et un jeu déjà réglé y a droit aussi", async () => {
    // **L'enchaînement n'existait que sur un univers vierge**, et il se perdait
    // au premier « j'ai fini pour l'instant » : l'auteur qui rouvrait ses
    // réglages n'avait plus rien pour avancer. Un jeu déjà réglé, donc.
    await ouvrirLAssistant({}, { ...UNIVERS, vue: "vue-dessus-34", vide: false })

    expect(await screen.findByText("étape 1 sur 12")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Continuer →" })).toBeTruthy()
    // **Et il y a un retour.** Il n'y en avait aucun : on avançait ou l'on
    // abandonnait, ce qui est la définition d'un tunnel — et le produit s'est
    // expressément interdit les tunnels en ouvrant cet écran.
    const retour = screen.getByRole("button", { name: "‹ Retour" })
    expect((retour as HTMLButtonElement).disabled).toBe(true)

    // Le geste qu'on répète dix fois est un bouton de 34 px, pas dix pixels de
    // mono : c'est la hauteur que l'échelle donne à ce qui doit être pressé.
    const continuer = screen.getByRole("button", { name: "Continuer →" })
    expect(continuer.className).toContain("h-[34px]")
    expect(continuer.className).toContain("bg-signal")
  })

  test("continuer avance d'une étape, retour recule, et l'étape ouverte est celle qu'on clique", async () => {
    await ouvrirLAssistant({}, { ...UNIVERS, vide: true })

    fireEvent.click(screen.getByRole("button", { name: "Continuer →" }))
    expect(await screen.findByText("étape 2 sur 12")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "‹ Retour" }))
    expect(await screen.findByText("étape 1 sur 12")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Les fournisseurs" }))
    expect(await screen.findByText("étape 12 sur 12")).toBeTruthy()
    // La dernière n'a pas de suivante, et le bouton le dit plutôt que de faire
    // semblant d'avancer.
    expect(
      (screen.getByRole("button", { name: "Continuer →" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  // ── « La vue et la taille se choisissent sur des vignettes » ──────────────

  test("la vue se choisit sur une vignette, et dit combien d'images elle demande", async () => {
    const { appels } = await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "La vue" }))

    const vue = await screen.findByRole("button", { name: /De dessus, 3\/4/ })
    // **C'est le chiffre qui multiplie toute la production**, donc tout ce
    // qu'on paiera : il se lit sur la vignette, avant de choisir.
    expect(vue.textContent).toContain("4 images par pose")

    fireEvent.click(vue)
    await waitFor(() => {
      const pose = [...appels].reverse().find((a) => a.url.includes("/universe"))
      expect((pose?.corps as { vue?: string })?.vue).toBe("vue-dessus-34")
    })
  })

  test("une vignette qui n'est pas encore dessinée le dit", async () => {
    // **Les dix-sept vignettes sont une production d'images, pas du code.**
    // Tant qu'une manque, la case le dit plutôt que de faire semblant — c'est
    // la règle du grisé qui porte sa raison, appliquée à une image absente.
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "La vue" }))

    const image = (await screen.findAllByAltText("De dessus, 3/4"))[0]
    fireEvent.error(image)
    expect(await screen.findByText("pas encore dessinée")).toBeTruthy()
  })

  // ── « Une étiquette porte son libellé et son texte anglais » ──────────────

  const BRUME = {
    identifiant: "eclairage-brume-basse-aaa111",
    libelle: "brume basse",
    texte: "thick low-lying fog, volumetric haze",
    case: "eclairage",
    emplois: 3,
    // **Fabriquee par l'auteur, pas livree avec l'atelier** : c'est ce que la
    // puce ambre distingue a l'ecran, et l'essai le pose explicitement plutot
    // que de le laisser au hasard d'un defaut.
    livree: false,
    oubliee: false,
  }
  const HACHURE = {
    identifiant: "trait-hachure-bbb222",
    libelle: "hachures serrées",
    texte: "tight cross-hatching",
    case: "trait",
    emplois: 0,
    livree: false,
    oubliee: false,
  }

  test("cliquer un libellé écrit le texte anglais dans la case", async () => {
    const { appels } = await ouvrirLAssistant({ etiquettes: [BRUME] })
    fireEvent.click(screen.getByRole("button", { name: "L'allure" }))
    // **Un nom de champ ne se répond pas ; une question, si.** C'est le seul
    // changement de vocabulaire de l'étape, et il ne coûte rien : l'intitulé
    // reste ce que la fiche d'une chose et l'écran de confirmation affichent.
    fireEvent.click(await screen.findByRole("button", { name: "La lumière" }))

    fireEvent.click(await screen.findByRole("button", { name: "brume basse" }))

    await waitFor(() => {
      const pose = [...appels].reverse().find(
        (a) => a.url.includes("/universe") && (a.corps as { bible?: unknown })?.bible,
      )
      const bible = (pose?.corps as { bible: { nom: string; texte: string }[] }).bible
      expect(bible.find((c) => c.nom === "eclairage")?.texte).toBe(BRUME.texte)
    })
  })

  test("la recherche ne montre que les étiquettes de la case où l'on est", async () => {
    await ouvrirLAssistant({ etiquettes: [BRUME, HACHURE] })
    fireEvent.click(screen.getByRole("button", { name: "L'allure" }))
    fireEvent.click(await screen.findByRole("button", { name: "La lumière" }))

    // **Une étiquette d'éclairage ne paraît pas dans la case du trait** : sans
    // ce filtre, la liste cesserait d'être une liste.
    expect(await screen.findByRole("button", { name: "brume basse" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "hachures serrées" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Le trait et les aplats" }))
    expect(await screen.findByRole("button", { name: "hachures serrées" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "brume basse" })).toBeNull()
  })

  test("la base vide le dit franchement plutôt que de faire semblant", async () => {
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "L'allure" }))
    fireEvent.click(await screen.findByRole("button", { name: "La lumière" }))

    // Soixante-dix paires arrivent avec l'atelier, mais une case peut n'en
    // avoir aucune qui reste — on les oublie une à une. La phrase dit alors
    // quoi faire, plutôt que de répéter l'absence sur trois lignes.
    expect(
      await screen.findByText(/rien dans la base pour cette case/),
    ).toBeTruthy()
  })

  // ── « Le texte à copier s'assemble, et ne déclenche aucun appel payant » ──

  test("le texte à copier reprend les réglages, et rien n'est payé", async () => {
    const univers: Univers = {
      ...UNIVERS,
      vue: "vue-dessus-34",
      bible: UNIVERS.bible.map((c) =>
        c.nom === "monde" ? { ...c, texte: "ruines naines" } : c,
      ),
      vide: false,
    }
    const { appels } = await ouvrirLAssistant({ univers }, univers)
    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))

    const avant = appels.length
    const texte = await screen.findByText(/I am designing a 2D game/)
    // **Ce qui vient des étapes, repris mot pour mot.**
    expect(texte.textContent).toContain("ruines naines")
    expect(texte.textContent).toContain("64 x 64 pixels")

    fireEvent.click(screen.getByRole("button", { name: "copier" }))
    // **Rien n'est payé par l'atelier** : copier n'appelle personne.
    expect(appels.length).toBe(avant)
  })

  // ── « Le fond du jeu se propose, il ne s'impose jamais » (D3) ─────────────

  test("sans fond posé, rien ne montre de couleur — et la proposition reste offerte", async () => {
    // ⚠️ **Un `input type=color` n'a pas d'état vide**, il *doit* porter une
    // couleur : il portait donc le magenta de la proposition juste à côté des
    // mots « aucun fond posé ». L'écran disait alors le contraire de ce qu'il
    // voulait dire, et c'est le piège déjà payé de la case qui ne change rien —
    // un contrôle qui montre un état qu'il n'a pas est pire qu'un contrôle
    // absent. Trouvé au navigateur, pas dans le code.
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))

    expect(await screen.findByText("aucun fond posé")).toBeTruthy()
    const choix = screen.getByLabelText("Couleur du fond")
    // Le damier est la réponse du produit à « pas de couleur » partout
    // ailleurs : c'est lui qui dit la transparence d'un sprite détouré.
    expect(choix.parentElement?.className).toContain("damier")
    // **Et le sélecteur reste dessous**, parce que le refus de proposer invite
    // lui-même à choisir à la main : un carré décoratif aurait fermé ce
    // chemin-là.
    expect(choix.tagName).toBe("INPUT")
  })

  test("prendre la couleur proposée l'écrit dans le jeu, et l'écart dit sur quoi", async () => {
    // **L'atelier propose, il n'impose jamais** : c'est l'arbitrage du
    // 2 septembre 2026, et c'est ce qui a retiré à la tranche son banc de huit
    // tirages — une mauvaise couleur se change en un geste.
    const { appels } = await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))

    // **L'écart est dit avec ce sur quoi il porte** : un « 192 » nu ne se lit
    // pas, « à 192 de #C0C0C0, la couleur de ton jeu la plus proche » se lit.
    expect(await screen.findByText(/à 192 de #C0C0C0/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Prendre magenta" }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url.startsWith("/api/universe") &&
            // **Le corps est facultatif sur cette route** : l'écran la lit aussi
            // sans rien envoyer, et un `JSON.stringify(undefined)` ne rend pas
            // une chaîne.
            (a.corps ? JSON.stringify(a.corps) : "").includes('"fond":"#FF00FF"'),
        ),
      ).toBe(true),
    )
  })

  test("quand aucune couleur n'est sûre, l'atelier le dit au lieu de choisir", async () => {
    // **Aucun candidat sûr est une réponse, pas une panne.** Elle arrive sur un
    // jeu dont la palette couvre la roue, et la bonne conduite est de laisser le
    // fond en place en disant ce qu'on achète si on en pose un quand même.
    await ouvrirLAssistant({
      fondPropose: {
        couleur: "",
        nom: "",
        ecart: 56,
        voisine: "#EC1CD0",
        raison:
          "aucune des couleurs franches que l'atelier connaît n'est assez loin de la palette de ce jeu",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))

    expect(await screen.findByText(/n'est assez loin de la palette/)).toBeTruthy()
    // Et surtout : aucun bouton ne propose de couleur, puisqu'aucune n'est sûre.
    expect(screen.queryByText(/^Prendre /)).toBeNull()
  })

  // ── « Une liste vide dit ce qui décidera à sa place » ─────────────────────

  test("une famille sans modèle dit ce qui sera employé à la place", async () => {
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Les IA à utiliser" }))

    // Ce n'est pas un réglage inutile : c'est un réglage que rien n'oblige à
    // toucher, et dont la valeur vide veut dire quelque chose.
    expect(
      (await screen.findAllByText(/aucun choisi — l'atelier emploiera/)).length,
    ).toBeGreaterThan(0)
  })

  // ── « L'assistant est le seul écran qui règle un jeu » ────────────────────

  test("les douze étapes couvrent tout ce qui se réglait ailleurs", async () => {
    await ouvrirLAssistant()

    // Les cinq réglages d'avant sont tous atteignables depuis une étape, et
    // aucun n'a d'autre porte : c'est ce que « il n'y a pas d'autre panneau de
    // réglages à côté » veut dire, vérifié sur ce qui existe.
    fireEvent.click(screen.getByRole("button", { name: "L'allure" }))
    expect(await screen.findByRole("button", { name: "Où ça se passe" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Références et couleurs" }))
    expect(await screen.findByText(/Les couleurs du jeu ne se saisissent jamais/))
      .toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Les types d'objets" }))
    expect(
      await screen.findByRole("combobox", { name: "Images de référence de personnage" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Les IA à utiliser" }))
    expect(
      await screen.findByRole("combobox", { name: "Modèle par défaut pour une planche" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "La taille" }))
    expect(await screen.findByRole("button", { name: "128 px" })).toBeTruthy()
  })

  // ── « Une étape est un écran, et plus un tiroir » ─────────────────────────

  test("aucune étape n'est repliable, et chacune est titrée", async () => {
    await ouvrirLAssistant()

    // **Quatre étapes sur dix n'étaient pas des étapes** : elles se
    // construisaient avec le bloc repliable du châssis, dont le registre naît
    // fermé. Ouverte, la plus vide rendait 26 points de contenu dans une scène
    // de 1 360 × 754, dont le seul mot était « Barème d'échelles ».
    for (const nom of [
      "Le nom",
      "Les types d'objets",
      "L'allure",
      "Références et couleurs",
      "Les IA à utiliser",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: nom }))
      const titre = await screen.findByRole("heading", { name: nom })
      // Le titre d'un écran est en serif — le deuxième des trois emplois que
      // le système accorde à la police de titrage.
      expect(titre.className, nom).toContain("font-serif")
      expect(titre.className, nom).toContain("text-[24px]")

      // **Une étape explique avant de demander**, en 14 px — la taille que
      // l'échelle réserve à la prose longue. Six étapes sur dix n'avaient
      // aucune conduite, et quatre n'avaient même pas de titre.
      const scene = document.querySelector(`[data-etape="${nom}"]`) as HTMLElement
      const conduite = [...scene.querySelectorAll("p")].find((e) =>
        e.className.includes("text-[14px]"),
      )
      expect(conduite, nom).toBeTruthy()
      expect(conduite!.textContent!.length, nom).toBeGreaterThan(60)
    }
  })

  // ── D1 · Le détourage de départ ──────────────────────────────────────────
  //
  // **La onzième étape**, et la seule dont le contenu livré vient d'un comptage
  // fait sur les recettes de l'auteur. Le plan demandait un défaut par nature
  // d'image ; la mesure a montré que ce qui décide vraiment du bord rongé est le
  // **moteur** — le bord découpe net et n'en a pas besoin, le modèle laisse une
  // frange et en demande deux pixels. La structure du plan est bâtie en entier ;
  // le contenu suit la mesure.

  test("l'étape range les deux natures d'image et les quatre familles", async () => {
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))

    await screen.findByText("selon comment l'image est venue")
    expect(screen.getByText("image seule")).toBeTruthy()
    expect(screen.getByText("morceau de planche")).toBeTruthy()

    // **« tous » n'est pas une famille de sujet** : c'est la clé du catalogue
    // qui dit *n'importe quel sujet*, et l'étape ne lui offre pas de rangée.
    expect(screen.getByText("ou selon ce que l'image montre — et alors ça l'emporte")).toBeTruthy()
    for (const famille of ["personnages", "objets", "décors", "interface"]) {
      expect(screen.getByText(famille)).toBeTruthy()
    }
  })

  test("une ligne sans réglage dit ce qui décidera à sa place", async () => {
    await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))
    await screen.findByText("selon comment l'image est venue")

    // **Une nature vide retombe sur le produit ; une famille vide retombe sur sa
    // nature.** Deux phrases différentes, parce que ce sont deux règles — et on
    // les apprend en lisant le réglage, sans avoir à les chercher ailleurs.
    expect(screen.getAllByText(/aucun réglage — le produit décide/)).toHaveLength(2)
    expect(
      screen.getAllByText(/aucun réglage — comme sa nature d'image/),
    ).toHaveLength(4)
  })

  test("choisir un moteur pose le défaut, et son bord rongé arrive avec lui", async () => {
    const { appels } = await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))

    const choix = await screen.findByLabelText(
      "Moteur de détourage pour morceau de planche",
    )
    fireEvent.change(choix, { target: { value: "modele" } })

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      expect(pose).toBeTruthy()
      // **Le bord rongé du modèle, sans que personne l'ait tapé.** C'est la
      // mesure de la tranche : l'auteur l'avait posé lui-même 39 fois sur 40.
      expect((pose!.corps as Record<string, unknown>).detourage_planche).toEqual({
        moteur: "modele",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 2,
        modele: "",
      })
    })
  })

  test("le bord du produit n'en ronge aucun, et c'est aussi une mesure", async () => {
    const { appels } = await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))

    fireEvent.change(
      await screen.findByLabelText("Moteur de détourage pour image seule"),
      { target: { value: "bord" } },
    )

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      const envoye = (pose!.corps as Record<string, { durcissement: number }>)
        .detourage_image
      // Le moteur du bord découpe net : il ne laisse aucune frange, donc il n'y
      // a rien à ronger. Zéro n'est pas une prudence, c'est ce que l'auteur a
      // laissé 56 fois sur 72.
      expect(envoye.durcissement).toBe(0)
    })
  })

  test("remettre le moteur à « — » retire le réglage au lieu d'en poser un", async () => {
    const { appels } = await ouvrirLAssistant({}, {
      ...UNIVERS,
      detourage_planche: {
        moteur: "modele",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 2,
        point: null,
        portee: "tache",
        masquee: false,
        trace: [],
        modele: "",
      },
    })
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))

    fireEvent.change(
      await screen.findByLabelText("Moteur de détourage pour morceau de planche"),
      { target: { value: "" } },
    )

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      // **`null` veut dire « remets-le au produit »**, et c'est un geste, pas
      // deux : un bouton de retrait en plus aurait fait deux façons de dire la
      // même chose.
      expect((pose!.corps as Record<string, unknown>).detourage_planche).toBeNull()
    })
  })

  test("une famille réglée l'emporte, et l'écran le dit avant qu'on génère", async () => {
    const { appels } = await ouvrirLAssistant()
    fireEvent.click(screen.getByRole("button", { name: "Le détourage de départ" }))

    fireEvent.change(
      await screen.findByLabelText("Moteur de détourage pour personnages"),
      { target: { value: "couleur" } },
    )

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      const envoyees = (pose!.corps as Record<string, Record<string, unknown>>)
        .detourages
      expect(envoyees.personnages).toEqual({
        moteur: "couleur",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 1,
        modele: "",
      })
    })
  })

  test("la fiche dit d'où vient le détourage qui s'est appliqué", async () => {
    const image = asset("aaaa1111-0")
    const { fetchDouble } = serveurDouble({
      assets: [image],
      impose: {
        impose: {
          passes: [
            {
              moteur: "modele",
              tolerance: 28,
              seuil_alpha: 128,
              durcissement: 2,
              point: null,
              portee: "tache",
              masquee: false,
              trace: [],
              modele: "",
            },
          ],
          difference: null,
          recadrage: null,
          grille: { cible: 64, occupation: 100, ancrage: "bas", decalage: 0, methode: "proche" },
          quantification: null,
          bords: null,
          contours: null,
          main: null,
          veille: [],
          nom: null,
        },
        echelle: "personnage",
        nature: "image",
        detourage: {
          passe: {
            moteur: "modele",
            tolerance: 28,
            seuil_alpha: 128,
            durcissement: 2,
            point: null,
            portee: "tache",
            masquee: false,
            trace: [],
            modele: "",
          },
          origine: "famille",
          famille: "personnages",
        },
      },
    })
    await monter(fetchDouble, { ...ETAT, assets: [image] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // Replié, le bloc porte déjà le moteur — c'est ce qui permet de lire la
    // fiche entière sans rien ouvrir. Le détourage ouvre la liste parce qu'il
    // est la première étape du traitement.
    const entete = await screen.findByRole("button", { name: /^Imposé par le projet/ })
    expect(entete.textContent).toContain("modèle · 64 px")

    fireEvent.click(entete)
    const bloc = within(entete.closest("section") as HTMLElement)
    // **La provenance compte autant que la valeur** : sans elle, on lit un
    // réglage qu'on n'a pas posé sans savoir lequel des trois niveaux l'a
    // décidé, donc sans savoir où aller le changer.
    expect(
      bloc.getAllByRole("listitem").map((li) => li.textContent),
    ).toContainEqual(
      expect.stringContaining("modèle · 2 px rongés · ton réglage pour cette famille"),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E9 · Les poses appartiennent au type d'objet
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Le type qui se choisit sur
// une chose, l'origine écrite sur la ligne, le rangé sous un trait — barré et
// pâle, dérangé d'un clic —, la tuile qui n'a pas de rangée de poses du tout, et
// l'étape de l'assistant qui règle la liste d'un type sans toucher celle des
// autres. Ce qui se calcule — quelle liste une chose reçoit, ce que le fichier
// garde — vit dans `tests/test_e9.py`.

describe("les poses par type d'objet", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le codex ouvert sur l'établi d'une chose — comme la matrice de C1. */
  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    return { ...double, flux }
  }

  /** Une chose du jeu qui porte un type, avec la liste que ce type réclame. */
  const chose = (nom: string, type: string, poses: Pose[]) =>
    personnage(nom, {
      type,
      plan: poses,
      cases: poses.map((p) => ({
        pose: p.identifiant,
        demandees: p.images,
        images: [],
        ...VIDE_C3,
      })),
    })

  // ── « La fiche d'une chose écrit l'origine de chaque pose » ────────────────

  test("une chose ajoute une attitude pour elle seule, et sa ligne dit d'où elle vient", async () => {
    const { fetchDouble } = await ouvrir({
      personnages: [chose("Le coffre", "meuble", POSES_DU_MEUBLE)],
    })
    const ecran = await ouvrirLEtabli("Le coffre")

    // Les trois du type, et rien d'autre : un coffre ne marche pas.
    expect(
      ecran.getAllByRole("button", { name: /Retirer .* de ce personnage/ }),
    ).toHaveLength(3)
    expect(ecran.queryByRole("button", { name: "Retirer marche de ce personnage" }))
      .toBeNull()

    fireEvent.change(ecran.getByLabelText("Ajouter une attitude à Le coffre"), {
      target: { value: "piégé" },
    })
    fireEvent.keyDown(ecran.getByLabelText("Ajouter une attitude à Le coffre"), {
      key: "Enter",
    })

    // **Le geste part sur cette chose-là**, pas sur le plan du jeu : c'est ce
    // qui garde les cases des autres coffres intactes.
    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/le-coffre" &&
            String((init as RequestInit)?.method) === "PUT" &&
            String((init as RequestInit)?.body).includes("ajouter"),
        ),
      ).toBe(true),
    )
  })

  test("effacer une attitude ajoutée ici n'est pas la ranger", async () => {
    // **Le × ne veut pas dire la même chose des deux côtés.** Une pose du type
    // se range — elle reviendra chez les autres. Une pose ajoutée ici s'efface :
    // la reléguer aurait laissé une ligne barrée que rien ne reproposera jamais.
    const ajoutee: Pose = pose("piege", "piégé")
    const { fetchDouble } = await ouvrir({
      personnages: [
        personnage("Le coffre", {
          type: "meuble",
          plan: [...POSES_DU_MEUBLE, ajoutee],
          ajoutees: [ajoutee],
          cases: [...POSES_DU_MEUBLE, ajoutee].map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: [],
            ...VIDE_C3,
            origine: (p.identifiant === "piege" ? "ici" : "type") as "ici" | "type",
          })),
        }),
      ],
    })
    const etabli = await ouvrirLEtabli("Le coffre")

    // Les deux gestes portent des noms différents, parce qu'ils ne font pas la
    // même chose.
    expect(etabli.getByRole("button", { name: "Retirer fermé de ce personnage" }))
      .toBeTruthy()
    fireEvent.click(
      etabli.getByRole("button", { name: "Effacer piégé, ajoutée ici" }),
    )

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/le-coffre" &&
            String((init as RequestInit)?.body).includes("retirer_ajoutee"),
        ),
      ).toBe(true),
    )
  })

  test("l'origine ne s'écrit que quand elle apprend quelque chose", async () => {
    // Une chose dont une pose vient du type et l'autre a été ajoutée ici.
    const ajoutee: Pose = pose("piege", "piégé")
    await ouvrir({
      personnages: [
        personnage("Le coffre", {
          type: "meuble",
          plan: [...POSES_DU_MEUBLE, ajoutee],
          ajoutees: [ajoutee],
          cases: [...POSES_DU_MEUBLE, ajoutee].map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: [],
            ...VIDE_C3,
            origine: (p.identifiant === "piege" ? "ici" : "type") as "ici" | "type",
          })),
        }),
      ],
    })
    const etabli = await ouvrirLEtabli("Le coffre")

    // **Une seule mention**, sur la pose ajoutée. La venue du type est le cas
    // ordinaire : l'écrire sur chaque ligne aurait fait quatre mentions
    // identiques que personne ne lit.
    expect(etabli.getAllByText("ajoutée ici")).toHaveLength(1)
  })

  // ── « Ce qui est rangé se relègue sous un trait, barré et pâle » ───────────

  test("ce qui est rangé passe sous un trait, barré et pâle, et se dérange d'un clic", async () => {
    const { fetchDouble } = await ouvrir({
      personnages: [personnage("Le nain", { ecartees: ["mort", "degats"] })],
    })
    const ecran = await ouvrirLEtabli("Le nain")

    // Le trait le sépare de ce qui reste à faire, et le titre dit ce que c'est.
    expect(ecran.getByText("rangé — pas pour cette chose")).toBeTruthy()

    const range = ecran.getByRole("button", { name: "mort" })
    expect(range.className).toContain("line-through")
    expect(range.className).toContain("opacity-60")

    // **Un clic le dérange** — et c'est la liste des tenues qui repart, celle-ci
    // en plus.
    fireEvent.click(range)
    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/le-nain" &&
            String((init as RequestInit)?.body).includes('"mort"'),
        ),
      ).toBe(true),
    )
  })

  // ── « Une tuile n'a pas de rangée de poses du tout » ───────────────────────

  test("une tuile n'a aucune rangée de poses, et l'écran dit pourquoi", async () => {
    await ouvrir({ personnages: [chose("Herbe", "tuile", [])] })
    const ecran = await ouvrirLEtabli("Herbe")

    expect(
      ecran.queryAllByRole("button", { name: /Retirer .* de ce personnage/ }),
    ).toHaveLength(0)
    // **Pas une rangée grisée** : une rangée grisée promet qu'elle en aura une
    // un jour, et une tuile n'en aura jamais.
    expect(ecran.getByText(/ne bouge pas, il se raccorde/)).toBeTruthy()
  })

  // ── « Chaque type porte sa propre liste » (l'assistant) ────────────────────

  const ouvrirLesPoses = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble({ univers: UNIVERS, ...options })
    await monter(double.fetchDouble, { ...ETAT, univers: UNIVERS })
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "Poses et états" }))
    return double
  }

  test("l'étape des poses range les types, et chacun dit d'où sa liste lui vient", async () => {
    await ouvrirLesPoses()

    // Le plan du jeu n'a pas disparu : c'est ce que suivent le personnage, la
    // créature, et les choses créées avant que les types aient leur liste.
    expect(await screen.findByText("Le plan du jeu")).toBeTruthy()

    const meuble = await screen.findByRole("button", { name: "meuble" })
    expect(meuble.textContent).toContain("3 poses")
    expect(meuble.textContent).toContain("proposée")
    expect(
      (await screen.findByRole("button", { name: "personnage" })).textContent,
    ).toContain("celle du jeu")
    // Une tuile le dit sur sa rangée, avant même qu'on l'ouvre.
    expect(
      (await screen.findByRole("button", { name: "tuile" })).textContent,
    ).toContain("aucune pose")
  })

  test("écrire la liste d'un type ne part que sur ce type-là", async () => {
    const { fetchDouble } = await ouvrirLesPoses()

    fireEvent.click(await screen.findByRole("button", { name: "meuble" }))
    // Le texte prévient avant qu'on écrive : cette liste va cesser d'être celle
    // qu'on proposait.
    expect(
      await screen.findByText(/l'écrire ici lui donnera la sienne/),
    ).toBeTruthy()

    const champ = screen.getAllByPlaceholderText("une pose de plus…")
    fireEvent.change(champ[champ.length - 1], { target: { value: "brûlé" } })
    fireEvent.keyDown(champ[champ.length - 1], { key: "Enter" })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/types/meuble/poses" &&
            String((init as RequestInit)?.method) === "PUT",
        ),
      ).toBe(true),
    )
    // **Et le plan du jeu n'a pas bougé** : aucun appel n'est parti vers lui.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/characters/poses" &&
          String((init as RequestInit)?.method) === "POST",
      ),
    ).toBe(false)
  })

  test("un type qui a écrit sa liste peut revenir à celle qu'on lui proposait", async () => {
    const { fetchDouble } = await ouvrirLesPoses({
      types: TYPES.map((t) =>
        t.nom === "meuble"
          ? { ...t, origine: "écrite" as const, poses: [POSES_DU_MEUBLE[0]] }
          : t,
      ),
    })

    fireEvent.click(await screen.findByRole("button", { name: "meuble" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "revenir à la liste proposée" }),
    )

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/types/meuble/poses" &&
            String((init as RequestInit)?.method) === "DELETE",
        ),
      ).toBe(true),
    )
  })

  // ── Le type se choisit sur la chose ────────────────────────────────────────

  test("la fiche d'une chose choisit son type, et dit que les images ne bougent pas", async () => {
    const { fetchDouble } = await ouvrir({
      personnages: [personnage("La chose")],
    })
    const ecran = await ouvrirLEtabli("La chose")

    const choix = await ecran.findByLabelText("Type d'objet")
    expect(ecran.getByText(/En changer ne déplace aucune image/)).toBeTruthy()

    fireEvent.change(choix, { target: { value: "meuble" } })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/la-chose" &&
            String((init as RequestInit)?.body).includes('"type":"meuble"'),
        ),
      ).toBe(true),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E10 · La vue du jeu, et les directions qu'elle donne
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. La liste des directions et
// d'où elle vient — lue dans la vue, ou écrite à la main —, la case qui devient
// une pose dans une direction, la jauge qui affiche le produit des deux, la
// direction qui manque nommée, le rangé sous un trait, et la marque « à
// confirmer » qui ne se fait pas passer pour une déduction. Ce qui se calcule —
// la composition de la consigne, la portée d'un rangement, la proposition de
// baisse — vit dans `tests/test_e10.py`.

describe("la vue du jeu et ses directions", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Un jeu vu de dessus : quatre directions, lues dans sa vue. */
  const VU_DE_DESSUS: DirectionsDuJeu = {
    directions: QUATRE,
    origine: "vue",
    vue: "vue-dessus-34",
    vue_libelle: "De dessus, 3/4",
    proposees: QUATRE,
  }

  /** Les cases d'une chose dans un jeu à quatre directions. `faites` dit
   *  combien d'images la première direction porte — le reste est vide, comme sur
   *  le vrai projet, où seul le sud a été dessiné. */
  const casesEnQuatre = (
    faites: Record<string, Asset[]> = {},
    rangees: Record<string, string[]> = {},
  ) =>
    PLAN.map((p) => {
      const tenues = QUATRE.filter(
        (d) => !(rangees[p.identifiant] ?? []).includes(d.identifiant),
      )
      return {
        pose: p.identifiant,
        demandees: p.images * Math.max(1, tenues.length),
        images: faites[p.identifiant] ?? [],
        ...VIDE_C3,
        directions: tenues.map((d, rang) => ({
          ...d,
          demandees: p.images,
          images: rang === 0 ? (faites[p.identifiant] ?? []) : [],
          a_confirmer: rang === 0 ? (faites[p.identifiant] ?? []).length : 0,
        })),
        directions_rangees: QUATRE.filter((d) =>
          (rangees[p.identifiant] ?? []).includes(d.identifiant),
        ).map((d) => ({ ...d, portee: "ici" as const })),
      }
    })

  const ouvrirLesDirections = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({ directions: VU_DE_DESSUS, ...options })
    await monter(double.fetchDouble)
    return { ...double, ecran: await ouvrirLaRubrique("Les directions") }
  }

  // ── « La liste des directions se déduit de la vue du jeu » ─────────────────

  test("la colonne dit combien de directions, et qu'elles sont lues", async () => {
    // **`4 · lues`, et le mot compte** : la liste vient de la vue et suivra un
    // changement de vue. C'est une promesse différente de « à vous », et le
    // codex l'écrit plutôt que de laisser deviner.
    const double = serveurDouble({ directions: VU_DE_DESSUS })
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()

    expect(
      within(cadre).getByRole("button", { name: /^Les directions/ }).textContent,
    ).toBe("Les directions4 · lues")
  })

  test("le panneau nomme la vue d'où la liste vient, et l'onglet qui la règle", async () => {
    const { ecran } = await ouvrirLesDirections()

    expect(await ecran.findByText(/De dessus, 3\/4/)).toBeTruthy()
    expect(ecran.getByText(/réglée dans l'Univers/)).toBeTruthy()
    for (const nom of ["sud", "nord", "est", "ouest"]) {
      expect(ecran.getByLabelText(`Nom de la direction ${nom}`)).toBeTruthy()
    }
  })

  test("un jeu sans vue n'a aucune direction, et le dit", async () => {
    // **Un jeu qui ne veut pas de directions ne les voit jamais.** Ce n'est pas
    // un réglage manquant, c'est une réponse.
    const double = serveurDouble()
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()

    expect(
      within(cadre).getByRole("button", { name: /^Les directions/ }).textContent,
    ).toBe("Les directionsaucune")
  })

  // ── « Elles se renomment, se retirent et s'ajoutent depuis le codex » ──────

  test("renommer une direction ne touche pas ce qu'elle dit au modèle", async () => {
    // **Deux textes, et un seul part.** Le nom se lit, la consigne part : les
    // confondre faisait partir « sud » au milieu d'une phrase anglaise.
    const { ecran, appels } = await ouvrirLesDirections()

    const champ = ecran.getByLabelText("Nom de la direction sud")
    fireEvent.change(champ, { target: { value: "vers le joueur" } })
    fireEvent.blur(champ)

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/directions/sud" &&
            JSON.stringify(a.corps).includes("vers le joueur"),
        ),
      ).toBe(true),
    )
    // La consigne n'était pas dans le message : ce qu'il ne dit pas, il ne
    // l'efface pas.
    const envoye = appels.find((a) => a.url === "/api/characters/directions/sud")
    expect(JSON.stringify(envoye?.corps)).not.toContain("facing south")
  })

  test("corriger la consigne d'une direction se fait à un seul endroit", async () => {
    const { ecran, appels } = await ouvrirLesDirections()

    const champ = ecran.getByLabelText("Ce que « sud » dit au modèle")
    expect((champ as HTMLInputElement).value).toBe("facing south, toward the viewer")
    fireEvent.change(champ, { target: { value: "facing the camera" } })
    fireEvent.blur(champ)

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/directions/sud" &&
            JSON.stringify(a.corps).includes("facing the camera"),
        ),
      ).toBe(true),
    )
  })

  test("ajouter une direction, et revenir à ce que la vue propose", async () => {
    const { ecran } = await ouvrirLesDirections()

    fireEvent.change(ecran.getByLabelText("Nom de la direction à ajouter"), {
      target: { value: "sud-est" },
    })
    fireEvent.click(ecran.getByRole("button", { name: "Ajouter" }))

    // La liste ne suit plus la vue — et c'est écrit, parce que ce n'est plus la
    // même promesse.
    expect(await ecran.findByText(/écrites ici/)).toBeTruthy()
    const retour = await ecran.findByRole("button", {
      name: /revenir à ce que la vue propose/,
    })
    expect(retour.textContent).toContain("sud · nord · est · ouest")
  })

  // ── « Une case du plan est une pose dans une direction » ───────────────────

  test("chaque attitude se découpe en une case par direction", async () => {
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [personnage("Balthazar", { cases: casesEnQuatre() })],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    // Quatre cases sous « repos », une par direction, chacune avec son geste.
    for (const nom of ["sud", "nord", "est", "ouest"]) {
      expect(
        etabli.getByRole("button", { name: `Fabriquer repos vers ${nom}` }),
      ).toBeTruthy()
    }
  })

  test("le produit nomme la direction qui manque", async () => {
    // **C'est très exactement ce qu'il ne savait pas dire avant E10.**
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [
        personnage("Balthazar", {
          cases: casesEnQuatre({ repos: [asset("balthazar-repos")] }),
        }),
      ],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    expect(await etabli.findByText("il manque nord, est, ouest")).toBeTruthy()
  })

  test("la jauge affiche le produit des deux, jamais les deux facteurs", async () => {
    // Une image faite sur quatre cases demandées : `1 / 4`, et non « 1 image ×
    // 4 directions », qui demanderait au lecteur de faire la multiplication.
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [
        personnage("Balthazar", {
          cases: casesEnQuatre({ repos: [asset("balthazar-repos")] }),
        }),
      ],
    })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Balthazar")

    const lignes = document.querySelectorAll("[data-etabli] li")
    const repos = Array.from(lignes).find((l) =>
      l.textContent?.startsWith("repos"),
    )
    expect(repos?.textContent).toContain("1 / 4")
    expect(repos?.textContent).not.toContain("× 4")
  })

  // ── « Les images antérieures se rangent dans la première direction » ───────

  test("une image faite avant les directions est marquée « à confirmer »", async () => {
    // **Un rangement par défaut ne se fait pas passer pour une déduction** : le
    // produit ne devine pas la direction d'une image faite avant, il la range
    // dans la première et le dit.
    const ancienne = asset("balthazar-repos")
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [
        personnage("Balthazar", { cases: casesEnQuatre({ repos: [ancienne] }) }),
      ],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    const choix = await etabli.findByLabelText(`Direction de ${ancienne.label}`)
    expect((choix as HTMLSelectElement).value).toBe("")
    expect(choix.textContent).toContain("à confirmer")

    // **Confirmer et déplacer sont le même geste**, et il n'y en a donc qu'un.
    fireEvent.change(choix, { target: { value: "nord" } })
    await waitFor(() =>
      expect(
        double.appels.some(
          (a) =>
            a.url === `/api/assets/${ancienne.identifiant}/character` &&
            JSON.stringify(a.corps).includes('"direction":"nord"'),
        ),
      ).toBe(true),
    )
  })

  // ── « Une direction se range pour une seule chose du jeu » ─────────────────

  test("une direction rangée reste montrée, barrée, et un clic la rend", async () => {
    // L'idiome de E9 repris tel quel : on relègue sous un trait plutôt que de
    // faire disparaître, pour défaire sans avoir à se rappeler.
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [
        personnage("Le dragon", {
          cases: casesEnQuatre({}, { attaque: ["nord", "est", "ouest"] }),
        }),
      ],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Le dragon")

    // Le dragon n'attaque que vers le sud.
    expect(
      etabli.getByRole("button", { name: "Fabriquer attaque vers sud" }),
    ).toBeTruthy()
    expect(
      etabli.queryByRole("button", { name: "Fabriquer attaque vers nord" }),
    ).toBeNull()

    const rangee = etabli.getByRole("button", { name: "Rendre nord à attaque" })
    expect(rangee.className).toContain("line-through")

    fireEvent.click(rangee)
    await waitFor(() =>
      expect(
        double.appels.some(
          (a) =>
            a.url === "/api/characters/poses/attaque/directions/nord" &&
            JSON.stringify(a.corps).includes('"rangee":false'),
        ),
      ).toBe(true),
    )
  })

  test("ranger une direction depuis l'établi ne vaut que pour cette chose", async () => {
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [personnage("Balthazar", { cases: casesEnQuatre() })],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    fireEvent.click(etabli.getByRole("button", { name: "Ranger nord pour repos" }))

    await waitFor(() =>
      expect(
        double.appels.some(
          (a) =>
            a.url === "/api/characters/poses/repos/directions/nord" &&
            JSON.stringify(a.corps).includes('"personnage":"balthazar"'),
        ),
      ).toBe(true),
    )
  })

  // ── « L'attitude s'écrit une fois, la direction une fois » ─────────────────

  test("armer une case fait partir la consigne de cette direction-là", async () => {
    // La consigne se compose de textes écrits chacun à un seul endroit : c'est
    // le serveur qui les met bout à bout, et l'écran lui dit seulement quelle
    // case il vise. Depuis E14 l'angle est une **ligne à part** — il n'est plus
    // collé au signalement, il voyage jusqu'à l'écran de confirmation avec sa
    // propre origine et son propre interrupteur.
    const double = serveurDouble({
      directions: VU_DE_DESSUS,
      personnages: [personnage("Balthazar", { cases: casesEnQuatre() })],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer repos vers est" }))
    // Ce Balthazar-là n'a pas de signalement : armer ne remplit donc rien, et
    // le sujet est à taper. **On attend que la demande de sujet soit revenue**
    // avant d'écrire : elle pose ce qu'elle a trouvé, et écraserait sinon ce
    // qu'on vient de taper.
    await ecrireLeSujet("Balthazar")
    await relire()

    await waitFor(() =>
      expect(
        double.appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            JSON.stringify(a.corps).includes('"direction":"est"'),
        ),
      ).toBe(true),
    )
  })

  test("l'attitude porte sa consigne anglaise, à côté de son nom français", async () => {
    // **Le nom se lit, la consigne part** (US-241). Jusqu'à E10 c'était le même
    // texte, et le nom français partait au milieu d'une phrase anglaise.
    const double = serveurDouble()
    await monter(double.fetchDouble)
    const ecran = await ouvrirLaRubrique("Leurs poses")

    const champ = ecran.getByLabelText("Ce que « marche » dit au modèle")
    expect((champ as HTMLInputElement).value).toBe("walking posture, full body")
  })

  // ── « La proposition se défait d'un clic » (US-243) ────────────────────────

  test("le produit propose de ramener à une image, avec sa raison", async () => {
    // **Sans elle, déclarer quatre directions ferait passer un personnage de
    // douze cases à quarante-huit d'un coup.**
    const { ecran, appels } = await ouvrirLesDirections({
      proposition: {
        directions: 4,
        poses: [
          { pose: "repos", nom: "repos", images: 4, portee: "jeu" },
          { pose: "marche", nom: "marche", images: 4, portee: "jeu" },
        ],
        raison:
          "proposé : ta bible dit « 4-directional orientation » et tes poses "
          + "« repos » et « marche » demandent 4 images, et ton jeu a maintenant "
          + "4 directions · se défait d'un clic",
        cases_avant: 48,
        cases_apres: 24,
        defaite: [],
      },
    })

    expect(await ecran.findByText(/4-directional orientation/)).toBeTruthy()
    expect(ecran.getByText("48 cases → 24")).toBeTruthy()

    fireEvent.click(ecran.getByRole("button", { name: /ramener à une image/ }))
    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/characters/directions/proposal"),
      ).toBe(true),
    )
  })

  test("une proposition prise se défait, et dit ce qu'elle rendrait", async () => {
    const { ecran } = await ouvrirLesDirections({
      proposition: {
        directions: 4,
        poses: [],
        raison: "",
        cases_avant: 24,
        cases_apres: 24,
        defaite: [{ pose: "repos", nom: "repos", images_avant: 4 }],
      },
    })

    expect(await ecran.findByText(/est ramenée à une image par direction/)).toBeTruthy()
    expect(ecran.getByRole("button", { name: "rendre 4 ›" })).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E11 · Les palettes et les ambiances
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Les deux listes et leur
// ordre, les pastilles qui disent d'où chaque couleur vient, la couleur retirée
// qui reste barrée et se remet d'un clic, les deux rangées d'aperçu, le curseur
// grisé avec sa raison, les trois cases d'une ambiance et les quatre qui lui
// sont fermées, et l'ambiance qui se désigne sur la fiche d'une chose. Ce qui se
// calcule — la fusion, l'empreinte, ce que le fichier garde — vit dans
// `tests/test_e11.py`.

describe("les palettes et les ambiances", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const ouvrirLeCote = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    await monter(double.fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Ambiances et couleurs" }))
    await screen.findByText("les ambiances")
    return double
  }

  // ── « Plusieurs palettes nommées coexistent » ──────────────────────────────

  test("les deux listes se lisent, les ambiances d'abord", async () => {
    await ouvrirLeCote({
      palettes: [paletteDouble("marais")],
      ambiances: [ambianceDouble("Marais de cendre", "marais")],
    })

    // Les ambiances d'abord, les palettes ensuite : les secondes servent les
    // premières, et l'ordre le dit.
    const listes = screen.getAllByText(/^les (ambiances|palettes)$/)
    expect(listes.map((l) => l.textContent)).toEqual([
      "les ambiances",
      "les palettes",
    ])

    expect(screen.getByRole("button", { name: /Marais de cendre/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /^marais/ })).toBeTruthy()
    // **Celle du jeu en est une comme les autres**, et elle est dans la liste.
    expect(screen.getByText("du jeu")).toBeTruthy()
  })

  test("nommer crée une palette, sans formulaire et sans rien payer", async () => {
    const { fetchDouble } = await ouvrirLeCote()

    const champ = screen.getByLabelText("Nouvelle palette")
    fireEvent.change(champ, { target: { value: "ombre" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/palettes" &&
            String((init as RequestInit)?.method) === "POST",
        ),
      ).toBe(true),
    )
    expect(
      fetchDouble.mock.calls.some(([url]) =>
        String(url).startsWith("/api/generations"),
      ),
    ).toBe(false)
  })

  // ── « Chaque couleur du résultat dit d'où elle vient » ─────────────────────

  test("chaque pastille dit d'où sa couleur vient", async () => {
    await ouvrirLeCote({ palettes: [paletteDouble("marais")] })

    fireEvent.click(screen.getByRole("button", { name: /^marais/ }))

    // Trois provenances, trois marques : sans elles on ne saurait pas si un
    // gris vient du jeu, donc si le changer serait une exception ou une redite.
    expect(
      await screen.findByRole("button", {
        name: /#112233 — venue de la première source/,
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /#778899 — venue des autres sources/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /#aabbcc — posée à la main/ }),
    ).toBeTruthy()
  })

  test("une couleur retirée reste montrée barrée, et se remet d'un clic", async () => {
    const { fetchDouble } = await ouvrirLeCote({ palettes: [paletteDouble("marais")] })
    fireEvent.click(screen.getByRole("button", { name: /^marais/ }))

    const pastille = await screen.findByRole("button", {
      name: /#445566 — venue de la première source$/,
    })
    fireEvent.click(pastille)

    // **Montrée, pas cachée** : c'est une décision qu'on a prise, on doit
    // pouvoir l'annuler d'un clic — donc la pastille est encore là, marquée.
    const barree = await screen.findByRole("button", {
      name: "#445566 — venue de la première source, retirée",
    })
    expect(barree.className).toContain("opacity-40")

    fireEvent.click(barree)
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "#445566 — venue de la première source, retirée",
        }),
      ).toBeNull(),
    )
    // Les deux gestes sont partis par la même route : une retouche est un
    // réglage de la palette, pas une entité de plus.
    expect(
      fetchDouble.mock.calls.filter(
        ([url, init]) =>
          String(url) === "/api/palettes/marais" &&
          String((init as RequestInit)?.method) === "PUT",
      ).length,
    ).toBe(2)
  })

  // ── « L'attraction est grisée avec sa raison » ─────────────────────────────

  test("l'attraction est grisée avec sa raison quand il ne reste rien à tirer", async () => {
    await ouvrirLeCote({ palettes: [paletteDouble("marais")] })

    fireEvent.click(screen.getByRole("button", { name: /^marais/ }))

    // Mesuré au banc d'essai avant que la tranche soit écrite : c'est le seul
    // endroit où le curseur ne changerait rien, et il le dit.
    expect(
      await screen.findByText(/il ne reste aucune couleur à rapprocher/),
    ).toBeTruthy()
    const rails = document.querySelectorAll('input[type="range"]')
    expect([...rails].some((r) => (r as HTMLInputElement).disabled)).toBe(true)
  })

  // ── « La palette se juge posée sur de vraies images » ──────────────────────

  test("l'aperçu pose la palette sur de vraies images, côte à côte", async () => {
    await ouvrirLeCote({ palettes: [paletteDouble("marais")] })

    fireEvent.click(screen.getByRole("button", { name: /^marais/ }))

    // Un mélange se voit sur un sprite, pas sur une bande de pastilles — et une
    // seule rangée ne dirait pas ce qui a changé.
    expect(
      await screen.findByAltText("le nain avec les couleurs du jeu"),
    ).toBeTruthy()
    expect(screen.getByAltText("le nain avec marais")).toBeTruthy()
    expect(screen.getByText(/ne servent à aucune/)).toBeTruthy()
  })

  // ── « Une ambiance porte trois choses, et rien d'autre » ───────────────────

  test("une ambiance porte trois cases, et dit ce qui lui est fermé", async () => {
    await ouvrirLeCote({ ambiances: [ambianceDouble("Marais de cendre")] })

    fireEvent.click(screen.getByRole("button", { name: /Marais de cendre/ }))
    fireEvent.click(await screen.findByRole("button", { name: /ses trois cases/ }))

    expect(await screen.findByLabelText("Le monde")).toBeTruthy()
    expect(screen.getByLabelText("L'éclairage")).toBeTruthy()
    expect(screen.getByLabelText("Le trait")).toBeTruthy()
    // Les quatre autres n'existent pas — et l'écran dit pourquoi plutôt que de
    // laisser chercher.
    expect(screen.queryByLabelText("La vue")).toBeNull()
    expect(screen.queryByLabelText("La technique")).toBeNull()
    expect(
      screen.getByText(/ne s'ouvrent pas à une ambiance/),
    ).toBeTruthy()
  })

  test("l'ambiance dit qui s'en sert et ce que chacun lui prend", async () => {
    await ouvrirLeCote({
      ambiances: [
        {
          ...ambianceDouble("Marais de cendre"),
          emplois: [
            { identifiant: "le-rodeur", nom: "Le rôdeur", prend: "tout" },
            { identifiant: "l-ombre", nom: "L'ombre", prend: "couleurs" },
          ],
        },
      ],
    })

    fireEvent.click(screen.getByRole("button", { name: /Marais de cendre/ }))
    fireEvent.click(await screen.findByRole("button", { name: /qui s'en sert/ }))

    expect(await screen.findByText(/Le rôdeur/)).toBeTruthy()
    expect(screen.getByText(/lui prend tout$/)).toBeTruthy()
    expect(screen.getByText(/lui prend les couleurs seulement/)).toBeTruthy()
  })

  test("supprimer une ambiance ne détruit aucune image", async () => {
    const { fetchDouble } = await ouvrirLeCote({
      ambiances: [ambianceDouble("Marais de cendre")],
    })
    fireEvent.click(screen.getByRole("button", { name: /Marais de cendre/ }))

    fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }))

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/moods/marais-de-cendre" &&
            String((init as RequestInit)?.method) === "DELETE",
        ),
      ).toBe(true),
    )
    // Aucun appel vers les images : ce qui s'en servait retombe sur le jeu, et
    // il n'y a rien à effacer.
    expect(
      fetchDouble.mock.calls.some(
        ([url, init]) =>
          String(url).startsWith("/api/assets") &&
          String((init as RequestInit)?.method) === "DELETE",
      ),
    ).toBe(false)
  })

  // ── « Une chose du jeu désigne son ambiance sur sa fiche » ─────────────────

  test("une chose du jeu désigne son ambiance sur sa fiche, et ce qu'elle lui prend", async () => {
    const double = serveurDouble({
      personnages: [personnage("Le nain")],
      ambiances: [ambianceDouble("Marais de cendre")],
    })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli("Le nain")

    const choix = await ecran.findByLabelText("Son ambiance")
    fireEvent.change(choix, { target: { value: "marais-de-cendre" } })

    await waitFor(() =>
      expect(
        double.fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/le-nain" &&
            String((init as RequestInit)?.body).includes("marais-de-cendre"),
        ),
      ).toBe(true),
    )
  })

  test("le codex écrit l'ambiance de chaque chose, et les trous se voient", async () => {
    // **Le second endroit où l'on répond à « qui utilise quoi ».** Le panneau
    // d'une ambiance dit qui s'en sert ; le codex dit, chose par chose, laquelle
    // chacune porte — c'est déjà l'endroit où la liste de tout le jeu s'affiche.
    const double = serveurDouble({
      personnages: [
        personnage("Le rôdeur", { ambiance: "marais-de-cendre" }),
        personnage("Le nain"),
      ],
      ambiances: [ambianceDouble("Marais de cendre")],
    })
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()

    expect(await within(cadre).findByText("Marais de cendre")).toBeTruthy()
    // **Ce qui n'en a pas ne se grise pas** : « aucune » n'est pas un manque —
    // une chose sans ambiance prend le style du jeu, ce qui est le cas courant.
    const cartes = within(cadre).getAllByRole("article")
    expect(cartes.length).toBe(2)
    expect(cartes[1].textContent).not.toContain("Marais de cendre")
  })

  test("sans ambiance dans le jeu, la fiche dit où en fabriquer", async () => {
    const double = serveurDouble({ personnages: [personnage("Le nain")] })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli("Le nain")

    // Il n'y a pas de chose à griser — c'est la bascule de « + personnage », et
    // non le grisé qui porte sa raison. L'endroit est nommé à la place.
    expect(
      await ecran.findByText(/côté Ambiances et couleurs/),
    ).toBeTruthy()
    expect(ecran.queryByLabelText("Son ambiance")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E12 · La fiche d'une chose du jeu
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Les trois colonnes et les
// cinq blocs, l'origine lisible sans clic à côté de chaque texte, le texte
// remplacé montré barré en dessous, le désaccord entre la grille annoncée et
// celle qui s'applique, la promotion d'une image en référence permanente, la
// matrice qui répond pendant qu'on règle, et la barre qui paie qui se retire.
// Ce qui se calcule — les trois couches, l'empreinte, ce que le fichier garde —
// vit dans `tests/test_e12.py`.

describe("la fiche d'une chose du jeu", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Les cinq parties, **nommées par le recueil** (R8) : l'écran ne les nomme
   *  plus lui-même, et l'essai les lit là où l'écran les lit. */
  const NOMS_DES_PARTIES = [
    "codex.chose.sujet",
    "codex.chose.habillage",
    "codex.chose.exemples",
    "codex.chose.poses",
    "codex.chose.faites",
  ].map((clef) => AIDE[clef].nom)

  /** L'établi d'une chose, puis sa fiche — les deux crans de la maquette. */
  const ouvrirLaFiche = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble({
      personnages: [personnage("Balthazar")],
      ...options,
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "sa fiche ›" }))
    const cadre = await waitFor(() => {
      const fiche = document.querySelector("[data-fiche]")
      if (!fiche) throw new Error("la fiche ne s'est pas ouverte")
      return fiche as HTMLElement
    })
    return { ...double, fiche: within(cadre) }
  }

  // ── « L'écran rassemble l'identité, l'équipement, les références… » ────────

  test("les cinq parties se lisent sans un clic, et le sommaire y mène", async () => {
    // **Elles étaient cinq onglets** (R8) : pour savoir si une chose était bien
    // réglée, il fallait cliquer cinq fois et se souvenir. Ce sont cinq
    // sections d'une seule page, et la colonne de gauche en est le sommaire.
    const { fiche } = await ouvrirLaFiche()

    for (const nom of NOMS_DES_PARTIES) {
      // Le titre de la section — présent d'emblée, sans qu'on ait rien ouvert.
      expect(fiche.getByRole("button", { name: nom })).toBeTruthy()
      // Et la ligne du sommaire qui y mène, qui porte un nom distinct.
      expect(fiche.getByRole("button", { name: `Aller à ${nom}` })).toBeTruthy()
    }
    // **La matrice reste affichée à droite** : c'est la seule raison pour
    // laquelle la fiche garde une colonne de 380 px au lieu de s'étaler.
    expect(fiche.getByRole("button", { name: "Sa matrice" })).toBeTruthy()
  })

  test("chaque partie porte son propos sous son titre, lu dans le recueil", async () => {
    // **Le troisième rendu du corpus** (R8) : la même entrée sert la bulle au
    // survol, le Guide, et cette ligne-ci écrite à demeure. Rien n'est retapé
    // dans l'écran — l'essai le vérifie en comparant au recueil, mot pour mot.
    const { fiche } = await ouvrirLaFiche()

    for (const clef of [
      "codex.chose.sujet",
      "codex.chose.habillage",
      "codex.chose.exemples",
      "codex.chose.poses",
      "codex.chose.faites",
      "codex.chose.matrice",
    ]) {
      const entree = AIDE[clef]
      expect(entree).toBeTruthy()
      expect(fiche.getByText(entree.quoi)).toBeTruthy()
      // Le titre aussi vient de l'entrée : renommer une partie se fait dans le
      // recueil, et le sommaire comme la section suivent.
      expect(fiche.getByRole("button", { name: entree.nom })).toBeTruthy()
    }
  })

  test("la fiche montre la chose, et porte son nom sur sa surface", async () => {
    // **Elle n'en montrait rien** : pas une image, et le nom ne vivait que dans
    // le fil du châssis. On ne savait pas de qui c'était la fiche.
    const { fiche } = await ouvrirLaFiche()

    expect(fiche.getByRole("heading", { name: "Balthazar" })).toBeTruthy()
    expect(
      document.querySelector("[data-fiche] [data-portrait]"),
    ).toBeTruthy()
  })

  test("les images faites remplacent le grand chiffre, et un vide occupe la même place", async () => {
    // **Le grand chiffre à empattements enfreignait deux règles à la fois** :
    // une mesure s'écrit dans la police des mesures, et un compte déjà écrit
    // ailleurs n'a pas besoin de trente-deux pixels. Ce qui le remplace est ce
    // qu'on venait voir : les images.
    //
    // **Une case vide occupe la même place qu'une case pleine** — le manque
    // prend autant de place que le fait, sinon on ne le voit plus.
    const { fiche } = await ouvrirLaFiche({
      personnages: [
        personnage("Balthazar", {
          cases: PLAN.map((p, rang) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: rang === 0 ? [asset("balthazar-corps")] : [],
            ...VIDE_C3,
          })),
        }),
      ],
    })

    const cases = Array.from(
      document.querySelectorAll("[data-fiche] [data-case-faite]"),
    )
    expect(cases).toHaveLength(PLAN.length)
    // Une seule porte une image ; les cinq autres sont là quand même, à la
    // même taille, en pointillé.
    expect(cases.filter((c) => c.querySelector("img"))).toHaveLength(1)
    expect(cases.filter((c) => c.className.includes("border-dashed"))).toHaveLength(
      PLAN.length - 1,
    )
    // Et l'étiquette de chaque case est le nom de sa pose : on sait laquelle
    // manque sans compter les positions.
    for (const pose of PLAN) {
      expect(fiche.getAllByText(pose.nom).length).toBeGreaterThan(0)
    }
  })

  test("aucune mesure n'est écrite dans la police à empattements", async () => {
    // `docs/DESIGN.md` § Typography, règle 2 : « Toute mesure est en JetBrains
    // Mono, partout. » La fiche écrivait le compte des cases en serif 32 px.
    // **Le serif revient au nom**, qui n'est pas une mesure.
    await ouvrirLaFiche()

    const serif = Array.from(
      document.querySelectorAll("[data-fiche] .font-serif"),
    )
    expect(serif).toHaveLength(1)
    expect(serif[0].textContent).toBe("Balthazar")
    expect(serif[0].textContent).not.toMatch(/\d/)
  })

  test("le nom d'un réglage n'est pas écrit dans le gris le plus sourd", async () => {
    // `docs/DESIGN.md` § Color : `--texte-3` porte le grisé, la méta et la
    // raison — trois choses qu'autre chose redit ailleurs. **Rien ne redit le
    // nom d'un champ de style**, il n'est donc pas un grisé.
    const { fiche } = await ouvrirLaFiche()

    const nom = await fiche.findByText("monde")
    expect(nom.className).toContain("text-texte-2")
    expect(nom.className).not.toContain("text-texte-3")
  })

  test("le compte des cases est calculé une fois, et tout ce qui l'écrit s'accorde", async () => {
    // **Il était écrit trois fois — et deux des trois ne comptaient pas
    // pareil** : l'un portait sur toutes les cases du plan, rangées comprises,
    // l'autre sur les seules poses tenues. Une chose dont on avait rangé deux
    // poses se lisait donc « sur 6 » à un endroit et « sur 4 » à l'autre.
    //
    // Le très gros chiffre du milieu est parti — c'est l'essai de la police à
    // empattements qui le tient. Les trois écritures qui restent sont chacune à
    // sa place — l'identité, la section, le tableau —, plus l'état du sommaire,
    // et **toutes lisent le même calcul**.
    const { fiche } = await ouvrirLaFiche({
      personnages: [personnage("Balthazar", { ecartees: ["mort", "degats"] })],
    })

    // Quatre poses tenues, deux rangées, aucune image faite : le piège est
    // qu'un compte pris sur le plan entier dirait « sur 6 ».
    expect(fiche.getAllByText(/0 case sur 4/)).toHaveLength(2)
    expect(fiche.getByRole("button", { name: /Aller à Ce qui est fait/ }).textContent)
      .toContain("0 sur 4")
    // Et le tableau écrit les rangées **à côté**, jamais fondues dedans : une
    // jauge pleine obtenue en rangeant doit se lire comme telle.
    expect(fiche.getByText("0 / 4 · 2 rangées")).toBeTruthy()
  })

  test("aucun résumé du sommaire ne se coupe au milieu d'un mot", async () => {
    // **« 7 champs · 0 de son ambi… »** : un résumé tronqué ne résume plus
    // rien. Un sommaire dit où aller, il ne résume pas ce qu'on y trouvera.
    const { fiche } = await ouvrirLaFiche()

    const etatDe = (nom: string) =>
      fiche
        .getByRole("button", { name: `Aller à ${nom}` })
        .textContent!.replace(nom, "")
        .trim()

    // Un « … » est un compte qui n'est pas encore revenu du serveur, pas un
    // résumé coupé : on attend qu'ils soient tous lus avant de les mesurer.
    await waitFor(() => {
      for (const nom of NOMS_DES_PARTIES) {
        if (etatDe(nom) === "…") throw new Error(`« ${nom} » compte encore`)
      }
    })

    for (const nom of NOMS_DES_PARTIES) {
      // Un mot ou deux, jamais une phrase : trois mots seraient déjà un résumé,
      // et un résumé de 240 px se coupe.
      expect(etatDe(nom).split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(3)
    }
  })

  test("la fente des refus ne porte plus une seule explication", async () => {
    // **Le produit a une place réservée pour dire pourquoi un bouton est
    // éteint** : une ligne grise sous le contrôle, précédée d'un tiret. La
    // fiche y écrivait ses explications — elles avaient donc l'air
    // d'avertissements, et l'œil apprenait à les sauter.
    const { fiche } = await ouvrirLaFiche()

    // Le motif de la fente est ce tiret de 8 px. Aucun dans la fiche.
    expect(
      document.querySelectorAll("[data-fiche] span.h-px.w-2"),
    ).toHaveLength(0)
    // Et ce qui s'y écrivait est maintenant le propos, lu dans le recueil.
    expect(fiche.getByText(AIDE["codex.chose.matrice"].quoi)).toBeTruthy()
  })

  test("la barre qui paie se retire quand la fiche s'ouvre", async () => {
    // Régler, ranger, désigner une référence n'appelle personne — et un écran
    // incapable de dépenser ne porte pas le champ qui dépense.
    await ouvrirLaFiche()

    expect(
      screen.queryByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeNull()
  })

  test("Échap rend l'établi, à l'endroit exact d'où l'on venait", async () => {
    await ouvrirLaFiche()

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() =>
      expect(document.querySelector("[data-fiche]")).toBeNull(),
    )
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
  })

  // ── « Chaque texte porte son origine parmi les cinq » ──────────────────────

  test("chaque texte porte son origine, et elle se lit sans clic", async () => {
    const { fiche } = await ouvrirLaFiche({
      univers: {
        ...UNIVERS,
        bible: UNIVERS.bible.map((c) =>
          c.nom === "monde" ? { ...c, texte: "des salles de forge" } : c,
        ),
      },
    })


    expect(await fiche.findByLabelText("monde")).toBeTruthy()
    // Le cas ordinaire, et il se dit : rien n'a été changé pour cette chose-là.
    expect(fiche.getAllByText(/du jeu/).length).toBeGreaterThan(0)
  })

  test("un texte écrit ici montre en dessous, barré, celui qu'il remplace", async () => {
    const { fiche, fetchDouble } = await ouvrirLaFiche({
      univers: {
        ...UNIVERS,
        bible: UNIVERS.bible.map((c) =>
          c.nom === "vue" ? { ...c, texte: "3/4 top-down" } : c,
        ),
      },
    })

    const champ = await fiche.findByLabelText("vue et cadrage")
    fireEvent.change(champ, { target: { value: "flat orthographic icon" } })
    fireEvent.blur(champ)

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/balthazar" &&
            String((init as RequestInit)?.body).includes("flat orthographic icon"),
        ),
      ).toBe(true),
    )
    // **On doit pouvoir lire ce à quoi on a renoncé sans aller le chercher** :
    // l'écran garde la place du texte remplacé, barrée, sous celui qui gagne.
    expect(fiche.getByLabelText("vue et cadrage")).toBeTruthy()
  })

  test("éteindre un texte écrit un refus, et rallumer le défait", async () => {
    const { fiche, fetchDouble } = await ouvrirLaFiche()

    const eteindre = (await fiche.findAllByRole("button", { name: "éteindre" }))[0]
    fireEvent.click(eteindre)

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(([, init]) =>
          String((init as RequestInit)?.body ?? "").includes("eteindre"),
        ),
      ).toBe(true),
    )
  })

  test("un texte éteint montre ce qui serait parti, et se rallume d'un clic", async () => {
    // **Un refus écrit se défait d'un clic** — sinon il serait indistinguable
    // d'un oubli, donc impossible à défaire.
    const { fiche } = await ouvrirLaFiche({
      personnages: [personnage("Balthazar", { eteints: ["technique"] })],
    })


    expect(await fiche.findByRole("button", { name: "rallumer" })).toBeTruthy()
    // Un seul champ éteint : l'origine est écrite à côté de son nom, et elle
    // ne paraît que là.
    expect(fiche.getAllByText(/éteint/).length).toBe(1)
  })

  // ── « La valeur imposée par le projet se lit sous le texte qui part » ──────

  test("le désaccord entre la grille annoncée et celle qui s'applique se voit", async () => {
    // **Mesuré sur le vrai projet** : la bible disait 64x64 en toutes lettres
    // pendant que le projet imposait 128, et aucun écran ne mettait les deux
    // côte à côte.
    const { fiche } = await ouvrirLaFiche({
      univers: {
        ...UNIVERS,
        cible_px: 128,
        bible: UNIVERS.bible.map((c) =>
          c.nom === "rendu" ? { ...c, texte: "2D pixel art on a 64x64 grid" } : c,
        ),
      },
    })


    expect(await fiche.findByText("128 px de grille")).toBeTruthy()
    expect(fiche.getByText(/annonce une autre grille dans le texte qui part/)).toBeTruthy()
  })

  // ── « Une image déjà fabriquée se promeut en référence permanente » ────────

  test("l'atelier propose le corps retenu, et une proposition se retient d'un clic", async () => {
    const corps = asset("corps-1")
    const { fiche, fetchDouble } = await ouvrirLaFiche({
      personnages: [
        personnage("Balthazar", {
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: p.identifiant === "repos" ? [corps] : [],
            ...VIDE_C3,
            corps: p.identifiant === "repos" ? corps.identifiant : null,
          })),
        }),
      ],
    })


    // **Il propose, il ne décide pas** — et la provenance est écrite dessous.
    expect(await fiche.findByText(/le corps retenu de/)).toBeTruthy()
    // **Le geste nomme l'image sur laquelle il porte** (R8) : les lignes se
    // ressemblent, et « retenir » seul ne dirait pas laquelle.
    fireEvent.click(await fiche.findByRole("button", { name: /^retenir le corps retenu de/ }))

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters/balthazar/references" &&
            String((init as RequestInit)?.method) === "PUT",
        ),
      ).toBe(true),
    )
    // Une proposition acceptée cesse d'être une proposition, et devient une
    // ligne de la liste.
    expect(await fiche.findByText("image promue")).toBeTruthy()
  })

  test("chaque image d'exemple porte sa vignette, retenue comme proposée", async () => {
    // **On retenait ou on retirait une image sans la voir** (R8) : la ligne ne
    // portait que du texte — une provenance, un détail, un geste —, et deux
    // images de la même chose s'y écrivaient avec les mêmes mots. Retenir une
    // image d'exemple est pourtant le geste le plus visuel de la fiche.
    const corps = asset("corps-1")
    const deja = asset("deja-0")
    const { fiche } = await ouvrirLaFiche({
      assets: [deja],
      personnages: [
        personnage("Balthazar", {
          references: [deja.identifiant],
          cases: PLAN.map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: p.identifiant === "repos" ? [corps] : [],
            ...VIDE_C3,
            corps: p.identifiant === "repos" ? corps.identifiant : null,
          })),
        }),
      ],
    })

    // Une retenue, et une proposée — les deux se jugent en regardant, et les
    // deux passent par la même ligne.
    await fiche.findByText("image promue")
    await fiche.findByText(/le corps retenu de/)
    const vignettes = Array.from(
      document.querySelectorAll("[data-fiche] [data-vignette-exemple]"),
    )
    expect(vignettes).toHaveLength(2)
    for (const vignette of vignettes) {
      expect(vignette.querySelector("img")).toBeTruthy()
    }
  })

  test("une image d'exemple disparue laisse sa ligne, sans vignette", async () => {
    // **`null`, jamais une erreur** : une référence peut nommer une image
    // effacée depuis. La ligne reste — elle dit ce qui partirait —, elle n'a
    // simplement rien à montrer, et la case damier reste à sa place pour que
    // la liste ne se déforme pas.
    const { fiche } = await ouvrirLaFiche({
      personnages: [
        personnage("Balthazar", { references: ["une-image-effacee-0"] }),
      ],
    })

    await fiche.findByText("image promue")
    const vignettes = Array.from(
      document.querySelectorAll("[data-fiche] [data-vignette-exemple]"),
    )
    expect(vignettes).toHaveLength(1)
    expect(vignettes[0].querySelector("img")).toBeNull()
  })

  test("sans référence, la fiche dit ce que ça coûte", async () => {
    const { fiche } = await ouvrirLaFiche()


    expect(
      await fiche.findByText(/Dix-sept appels payés sur vingt-huit/),
    ).toBeTruthy()
  })

  // ── « Une jauge ne compte que ce qu'on peut fabriquer maintenant » ─────────

  test("la matrice ne compte pas comme faite une pose qu'on a rangée", async () => {
    // **Le piège** : ranger fait monter la jauge sans qu'une image ait été
    // fabriquée. Ce qui le tient est que le compte des rangées est écrit à
    // côté, jamais fondu dedans.
    const { fiche } = await ouvrirLaFiche({
      personnages: [personnage("Balthazar", { ecartees: ["mort", "degats"] })],
    })

    expect((await fiche.findAllByText(/2 rangées/)).length).toBeGreaterThan(0)
    // Les quatre poses tenues sont là ; les deux rangées ne comptent ni comme
    // faites ni comme manquantes — elles sont comptées à côté.
    expect(fiche.getAllByText("0 / 1").length).toBe(4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E15 · Le codex généralisé — les cinq familles
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Les cinq lignes de la
// colonne avec leur compte vrai, la liste d'une famille qui ne montre que ses
// choses, le champ qui nomme dans la famille allumée, l'établi d'un décor qui ne
// dessine aucune colonne d'équipement — et pas une colonne grisée —, et
// l'établi d'une pièce qui montre sur qui elle est posée plutôt que des images.
// Ce qui se calcule — la famille lue dans le type, la portée d'une pièce — vit
// dans `tests/test_e15.py`.

describe("le codex généralisé", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const CASQUE: Piece = {
    identifiant: "casque",
    nom: "casque",
    description: "un casque de fer à cornes",
    emplacement: "tete",
    portee: "contenue",
    concept_arts: [],
  }
  const TETE: EmplacementCorps = { identifiant: "tete", nom: "tête", rang: 0 }

  /** Une chose du jeu d'une famille donnée, telle que le serveur la rend. */
  const chose = (
    nom: string,
    famille: Personnage["famille"],
    type: string,
    poses: Pose[],
  ) =>
    personnage(nom, {
      famille,
      equipable: famille === "personnages",
      type,
      plan: poses,
      cases: poses.map((p) => ({
        pose: p.identifiant,
        demandees: p.images,
        images: [],
        ...VIDE_C3,
      })),
    })

  const LE_MONDE = [
    personnage("Balthazar"),
    chose("les cavernes du nord", "decors", "décor", []),
    chose("un coffre", "objets", "meuble", POSES_DU_MEUBLE),
    chose("un bouton", "interface", "élément d'interface", []),
  ]

  // ── « Les cinq familles portent des entités de plein droit » ──────────────

  test("chaque famille compte ses choses, et plus zéro", async () => {
    // Les trois familles du milieu avaient une ligne et un compte à zéro : « ce
    // qu'on pourra faire occupe autant de place que ce qu'on fait ». Elles ont
    // maintenant leurs choses.
    const double = serveurDouble({ personnages: LE_MONDE })
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()

    const compte = (nom: string) =>
      within(cadre).getByRole("button", { name: new RegExp(`^${nom}`) }).textContent
    expect(compte("Personnages")).toBe("Personnages1")
    expect(compte("Décors")).toBe("Décors1")
    expect(compte("Objets")).toBe("Objets1")
    expect(compte("Interface")).toBe("Interface1")
  })

  test("une famille ne montre que ses choses", async () => {
    const double = serveurDouble({ personnages: LE_MONDE })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLaRubrique("Décors")

    expect(ecran.getByRole("button", { name: /les cavernes du nord/ })).toBeTruthy()
    expect(ecran.queryByRole("button", { name: /Balthazar/ })).toBeNull()
    expect(ecran.queryByRole("button", { name: /un coffre/ })).toBeNull()
  })

  test("nommer dans une famille y crée la chose", async () => {
    // **Nommer, c'est créer** — et dans la famille allumée. L'écran dit où l'on
    // tape ; c'est le serveur qui pose le type, parce que c'est le type qui
    // porte la famille.
    const double = serveurDouble({ personnages: LE_MONDE })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLaRubrique("Objets")

    fireEvent.change(ecran.getByLabelText("Nom de la chose du jeu à créer"), {
      target: { value: "un tonneau cerclé de fer" },
    })
    fireEvent.keyDown(ecran.getByLabelText("Nom de la chose du jeu à créer"), {
      key: "Enter",
    })

    await waitFor(() =>
      expect(
        double.appels.some(
          (a) =>
            a.url === "/api/characters" &&
            a.corps !== undefined &&
            JSON.stringify(a.corps).includes('"famille":"objets"'),
        ),
      ).toBe(true),
    )
  })

  test("une famille vide dit ce qui lui manque, dans ses mots", async () => {
    // « Ce jeu n'a encore personne » sous *Décors* aurait été faux : un décor
    // n'est personne. Le produit ne réclame rien — c'est un état.
    const double = serveurDouble({ personnages: [personnage("Balthazar")] })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLaRubrique("Décors")

    expect(ecran.getByText(/Ce jeu n'a encore aucun lieu/)).toBeTruthy()
  })

  // ── « Un établi ne montre aucune rangée sans objet » ──────────────────────

  test("l'établi d'un décor ne dessine aucune colonne d'équipement", async () => {
    // **Ce qu'une famille ne peut pas avoir n'existe pas dans son établi.** Ce
    // n'est pas un grisé : le grisé réserve la place de ce qui viendra.
    const double = serveurDouble({
      personnages: LE_MONDE,
      emplacements: [TETE],
      pieces: [CASQUE],
    })
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()
    fireEvent.click(within(cadre).getByRole("button", { name: /^Décors/ }))
    const liste = await cadreDuCodex()
    fireEvent.click(
      within(liste).getByRole("button", { name: /les cavernes du nord/ }),
    )

    const etabli = within(await cadreDuCodex())
    expect(etabli.queryByText("La colonne qu'on lit")).toBeNull()
    expect(etabli.queryByRole("button", { name: "casque" })).toBeNull()
  })

  test("l'établi d'un personnage garde la sienne", async () => {
    // Le revers du même essai : rien n'a été retiré à ce qui marchait.
    const double = serveurDouble({
      personnages: LE_MONDE,
      emplacements: [TETE],
      pieces: [CASQUE],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    expect(etabli.getByText("La colonne qu'on lit")).toBeTruthy()
    expect(etabli.getByRole("button", { name: "casque" })).toBeTruthy()
  })

  // ── « L'établi d'une pièce montre les personnages qui la portent » ────────

  test("une pièce dit sur qui elle est posée, et ne montre aucune image", async () => {
    const double = serveurDouble({
      personnages: LE_MONDE,
      emplacements: [TETE],
      pieces: [CASQUE],
      portees: {
        casque: {
          piece: CASQUE,
          portee: [
            { personnage: "balthazar", nom: "Balthazar", poses: ["repos"] },
            { personnage: "le-nain", nom: "Le nain", poses: [] },
          ],
          posee: 1,
          candidats: 2,
        },
      },
    })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLaRubrique("Équipement")

    expect(await ecran.findByText("Posée sur 1 personnage sur 2.")).toBeTruthy()
    expect(ecran.getByText("Le nain")).toBeTruthy()
    expect(ecran.getByText("pas encore posée")).toBeTruthy()
    // **Aucune image** : une chose qui n'en a pas ne fait pas semblant d'en
    // avoir. Le produit interdit de générer un casque sur fond vide.
    expect(document.querySelectorAll("[data-codex] img")).toHaveLength(0)
  })

  // ── « Aucun personnage existant ne perd quoi que ce soit » ────────────────

  test("une chose sans type reste un personnage entier", async () => {
    // La généralisation est une **lecture** : le type portait déjà la famille,
    // et il n'y avait rien à migrer.
    const double = serveurDouble({ personnages: [personnage("Balthazar")] })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    for (const attitude of ["repos", "marche", "course", "attaque", "dégâts", "mort"]) {
      expect(etabli.getByRole("button", { name: `Fabriquer ${attitude}` })).toBeTruthy()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E17 · Le calibrage
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Les poses empilées dans une
// seule case, la proposition qui dit ce qu'elle coûte et qui limite, la mise de
// côté proposée puis défaite, la reprise à la main pose par pose, et la barre
// qui paie qui se retire — cet écran ne fabrique rien. Ce qui se calcule — la
// hauteur commune, l'occupation à poser, le décalage — vit dans
// `tests/test_e17.py`.

describe("le calibrage", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le vrai défaut, mesuré le 30 août 2026 : trois poses, trois hauteurs.
   *
   *  **`apres` et `visee` viennent du serveur, comme le reste** (R9) : l'écran
   *  ne les recalcule pas, parce que deux bornes du domaine y entrent et que
   *  les recopier à l'écran serait poser une seconde vérité sur la même
   *  question. Le double les porte donc, sans rejouer le calcul — c'est déjà la
   *  règle de ce double pour la hauteur commune. */
  const pose = (
    nom: string,
    occupation: number,
    rendue: number,
    plafond: number,
    de_cote = false,
    apres = rendue,
  ): PoseCalee => ({
    pose: nom,
    asset: `${nom}-corps`,
    boite: { largeur: 64, hauteur: rendue },
    occupation,
    decalage: 0,
    empreinte: `e-${nom}`,
    rendue,
    plafond,
    visee: Math.max(1, Math.round((apres / Math.max(1, rendue)) * occupation)),
    apres,
    ancrage: "bas",
    de_cote,
  })

  const CALIBRAGE: Calibrage = {
    personnage: "balthazar",
    cible: 64,
    poses: [
      pose("repos", 100, 64, 64, false, 43),
      pose("attaque", 100, 53, 53, false, 43),
      pose("mort", 100, 43, 43, false, 43),
    ],
    commune: 43,
    limite: "mort",
    perdus: 21,
    haute: 100,
    // Deux des trois changeraient : la mort rend déjà la hauteur commune, c'est
    // elle qui la fixe.
    a_faire: 2,
    de_cote: "mort",
  }

  const ouvrir = async (calibrage: Calibrage = CALIBRAGE) => {
    const double = serveurDouble({
      calibrage,
      personnages: [personnage("Balthazar")],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "le calibrage ›" }))
    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-calibrage]")
      if (!trouve) throw new Error("le calibrage ne s'est pas ouvert")
      return trouve as HTMLElement
    })
    return { ...double, ecran: within(cadre) }
  }

  // ── « Toutes les poses d'une chose se superposent dans la même case » ─────

  test("les poses sont empilées dans une seule case, pas côte à côte", async () => {
    // **C'est la superposition qui fait voir le défaut** : six vignettes côte à
    // côte ne montrent pas qu'un personnage est plus petit qu'un autre, six
    // silhouettes empilées, si.
    const { ecran } = await ouvrir()

    const canevas = document.querySelector("[data-canevas]") as HTMLElement
    expect(canevas).toBeTruthy()
    for (const nom of ["repos", "attaque", "mort"]) {
      expect(within(canevas).getByAltText(nom)).toBeTruthy()
    }
    // À un multiple entier : agrandir d'une fois et demie fabriquerait des
    // pixels qui n'existent pas.
    expect(ecran.getByText(/case de 64 × 64 px, montrée ×\d+/)).toBeTruthy()
  })

  test("chaque silhouette porte l'empreinte de sa recette", async () => {
    // **Le rendu change sous la même adresse à chaque cran** : sans elle, on
    // réglerait l'occupation en regardant l'image d'avant.
    await ouvrir()

    const canevas = document.querySelector("[data-canevas]") as HTMLElement
    expect(
      within(canevas).getByAltText("repos").getAttribute("src"),
    ).toContain("v=e-repos")
  })

  // ── « Un bouton propose, nomme qui limite, et dit le coût » ───────────────

  test("la proposition dit la hauteur commune, qui limite, et ce que ça coûte", async () => {
    // **Une ligne par fait, et au-dessus du bouton** (R9) : c'était un
    // paragraphe de deux phrases, coupé par un retour à la ligne, écrit
    // **sous** le bouton qu'il justifie.
    const { ecran } = await ouvrir()

    const faits = Array.from(
      document.querySelectorAll("[data-calibrage] [data-fait]"),
    ).map((f) => f.textContent ?? "")
    expect(faits).toEqual([
      "hauteur commune43 px sur 64",
      "la pose qui limitemort",
      "résolution perdue21 px · 33 %",
    ])
    // **Le prix de la cohérence, en clair** — le produit le dit, il ne le cache
    // pas.
    expect(
      ecran.getByText(/c'est le prix de la cohérence/),
    ).toBeTruthy()
  })

  test("les faits se lisent avant le bouton, jamais après", async () => {
    // **On sait ce qu'on va obtenir et ce qu'on va perdre avant d'avoir la main
    // sur la souris** (R9). L'ordre du document est ce qui le tient : un fait
    // écrit sous le bouton se lit après l'avoir appuyé.
    const { ecran } = await ouvrir()

    const bouton = ecran.getByRole("button", { name: /^Mettre les/ })
    for (const fait of document.querySelectorAll("[data-calibrage] [data-fait]")) {
      expect(
        fait.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })

  test("le bouton annonce son résultat, et non son verbe", async () => {
    // **« Calibrer les 3 poses » était un verbe et un décompte** (R9) : rien ne
    // disait ce qu'on obtiendrait. Le bouton qui paie annonce ce qu'il va
    // coûter ; celui-ci annonce la hauteur qu'il pose.
    const { ecran } = await ouvrir()

    expect(ecran.getByRole("button", { name: "Mettre les 3 poses à 43 px" })).toBeTruthy()
    expect(ecran.queryByRole("button", { name: /^Calibrer/ })).toBeNull()
  })

  test("le compte du bouton est celui des poses qu'il touche, pas celui du plan", async () => {
    // **Cinq et non six** : c'est ce chiffre-là qu'on veut vérifier d'un coup
    // d'œil avant d'appuyer, et une pose mise de côté n'est pas touchée.
    const { ecran } = await ouvrir({
      ...CALIBRAGE,
      poses: [
        pose("repos", 100, 64, 64, false, 53),
        pose("attaque", 100, 53, 53),
        pose("mort", 100, 43, 43, true),
      ],
      commune: 53,
      limite: "attaque",
      perdus: 11,
      a_faire: 1,
    })

    expect(ecran.getByRole("button", { name: "Mettre les 2 poses à 53 px" })).toBeTruthy()
  })

  test("quand il n'y a rien à calibrer, le bouton s'éteint et dit pourquoi", async () => {
    // **Il restait allumé** (R9) : sur une chose déjà calée, il invitait à un
    // geste qui ne change rien. Le produit interdit de proposer puis de
    // refuser — un contrôle indisponible porte sa raison dans une petite ligne
    // permanente. La règle existait, l'écran ne l'appliquait pas ici.
    const { ecran } = await ouvrir({
      ...CALIBRAGE,
      poses: [pose("repos", 100, 64, 64), pose("marche", 100, 64, 64)],
      commune: 64,
      limite: "repos",
      perdus: 0,
      a_faire: 0,
      de_cote: "",
    })

    expect(ecran.getByRole("button", { name: "Mettre les 2 poses à 64 px" })).toBeDisabled()
    expect(ecran.getByText("elles y sont déjà — il n'y a rien à changer")).toBeTruthy()
  })

  test("sans rien à faire, la scène parle au lieu de doubler l'image", async () => {
    // **Répéter la pile à l'identique à droite serait un dessin qui ment sur
    // son propre propos** : la seconde case ne se dessine pas, et la place
    // revient à la phrase qui dit pourquoi il n'y a rien à faire.
    const { ecran } = await ouvrir({
      ...CALIBRAGE,
      poses: [pose("repos", 100, 64, 64), pose("marche", 100, 64, 64)],
      commune: 64,
      limite: "repos",
      perdus: 0,
      a_faire: 0,
      de_cote: "",
    })

    expect(document.querySelector("[data-canevas='apres']")).toBeNull()
    expect(document.querySelector("[data-canevas='aujourdhui']")).toBeTruthy()
    expect(ecran.getByText("Rien à calibrer.")).toBeTruthy()
  })

  test("l'empilement d'avant et celui d'après se voient côte à côte", async () => {
    // **C'est la réponse visuelle à « qu'est-ce que ce bouton va faire »**, et
    // elle se lit avant qu'on ait touché à quoi que ce soit.
    const { ecran } = await ouvrir()

    const avant = document.querySelector("[data-canevas='aujourdhui']") as HTMLElement
    const apres = document.querySelector("[data-canevas='apres']") as HTMLElement
    expect(avant).toBeTruthy()
    expect(apres).toBeTruthy()
    expect(ecran.getByText("aujourd'hui")).toBeTruthy()
    expect(ecran.getByText("après le calibrage")).toBeTruthy()

    // **Aucune image n'est fabriquée pour ce dessin** : c'est la même, agrandie
    // du rapport entre ce qu'elle rend et ce qu'elle rendrait.
    const repos = within(apres).getByAltText("repos")
    expect(repos.getAttribute("src")).toContain("v=e-repos")
    expect(repos.style.transform).toBe(`scale(${43 / 64})`)
    // Et elle grandit depuis le sol : l'agrandir autour du centre la ferait
    // décoller de la ligne qu'elle est censée toucher.
    expect(repos.style.transformOrigin).toBe("bottom center")
    // À gauche, rien n'est transformé — c'est l'état d'aujourd'hui.
    expect(within(avant).getByAltText("repos").style.transform).toBe("")
    // La hauteur commune n'est tracée que là où elle est visée.
    expect(avant.querySelector("[data-hauteur-commune]")).toBeNull()
    expect(apres.querySelector("[data-hauteur-commune]")).toBeTruthy()
  })

  test("calibrer pose la hauteur commune, et rien ne part chez le fournisseur", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(ecran.getByRole("button", { name: /^Mettre les/ }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration" &&
            a.corps === undefined,
        ),
      ).toBe(true),
    )
    // Aucun appel de génération : il change le rendu d'images déjà payées.
    expect(appels.some((a) => a.url.includes("/generations"))).toBe(false)
  })

  // ── « Une pose très différente est proposée comme mise de côté » ──────────

  test("la pose très en dehors est proposée, et la mise de côté se défait", async () => {
    const { ecran, appels } = await ouvrir()

    expect(ecran.getByText(/« mort » est très en dehors des autres/)).toBeTruthy()
    fireEvent.click(ecran.getByRole("button", { name: /la mettre de côté/ }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration/mort/aside" &&
            JSON.stringify(a.corps).includes('"de_cote":true'),
        ),
      ).toBe(true),
    )
  })

  test("une pose mise de côté reste montrée, barrée, et rentre d'un clic", async () => {
    // **Sortir du calage n'est pas disparaître** : sa case existe, elle se
    // remplit, elle se compte.
    const { ecran, appels } = await ouvrir({
      ...CALIBRAGE,
      poses: [
        pose("repos", 100, 64, 64, false, 53),
        pose("attaque", 100, 53, 53),
        pose("mort", 100, 43, 43, true),
      ],
      commune: 53,
      limite: "attaque",
      perdus: 11,
      a_faire: 1,
      de_cote: "",
    })

    expect(ecran.getByText("de côté")).toBeTruthy()
    expect(document.querySelector("[data-canevas]")).toBeTruthy()
    // Elle est toujours dans l'empilement, des deux côtés.
    for (const quand of ["aujourdhui", "apres"]) {
      expect(
        within(
          document.querySelector(`[data-canevas='${quand}']`) as HTMLElement,
        ).getByAltText("mort"),
      ).toBeTruthy()
    }
    // **Et elle ne bouge pas d'un côté à l'autre** : son après est son
    // aujourd'hui, ce que le sous-titre dit aussi en toutes lettres.
    expect(
      within(
        document.querySelector("[data-canevas='apres']") as HTMLElement,
      ).getByAltText("mort").style.transform,
    ).toBe("")
    expect(
      ecran.getByText(/la pose mise de côté reste où elle est/),
    ).toBeTruthy()

    // **Le geste est un mot, et il vit là où l'on règle la pose** (R9) : il
    // faut donc l'avoir choisie, ce qui est exactement le geste qu'on ferait.
    fireEvent.click(ecran.getByRole("button", { name: "mort" }))
    fireEvent.click(
      ecran.getByRole("button", { name: "la faire rentrer dans le calage" }),
    )
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration/mort/aside" &&
            JSON.stringify(a.corps).includes('"de_cote":false'),
        ),
      ).toBe(true),
    )
  })

  // ── « Les commandes sont des mots, pas des symboles » ─────────────────────

  test("« prendre comme référence » et « mettre de côté » sont des mots", async () => {
    // **Une marque dit un état, un mot fait un geste** (R9). L'encadré « réf »
    // et le rond plein étaient un vocabulaire à apprendre : leur sens ne vivait
    // que dans un `title` et un nom accessible.
    const { ecran, appels } = await ouvrir()

    // La ligne ne porte plus qu'une marque — sans encadré, sans clic — et une
    // seule pose la porte.
    const marques = Array.from(
      document.querySelectorAll("[data-calibrage] [data-marque-reference]"),
    )
    expect(marques).toHaveLength(3)
    expect(marques.filter((m) => m.textContent === "réf")).toHaveLength(1)
    for (const marque of marques) expect(marque.tagName).toBe("SPAN")

    // Les deux gestes sont écrits en toutes lettres, dans le bloc de la pose
    // qu'on règle.
    fireEvent.click(ecran.getByRole("button", { name: "attaque" }))
    fireEvent.click(ecran.getByRole("button", { name: "prendre comme référence" }))
    expect(
      within(
        document.querySelector("[data-canevas='aujourdhui']") as HTMLElement,
      ).getByAltText("attaque").className,
    ).toContain("opacity-100")

    fireEvent.click(ecran.getByRole("button", { name: "mettre de côté" }))
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration/attaque/aside" &&
            JSON.stringify(a.corps).includes('"de_cote":true'),
        ),
      ).toBe(true),
    )
  })

  test("chaque ligne de pose porte sa silhouette, et ses deux mesures ne se replient pas", async () => {
    // **La silhouette était au premier dessin et n'a jamais été construite**
    // (R9) : c'est elle qui fait voir d'un coup que l'attaque est large et
    // basse, sans lire un chiffre.
    await ouvrir()

    const silhouettes = Array.from(
      document.querySelectorAll("[data-calibrage] [data-silhouette] img"),
    )
    expect(silhouettes).toHaveLength(3)
    // La vignette, jamais le fichier entier : trois timbres-poste ne valent pas
    // trois images pleines.
    expect(silhouettes[0].getAttribute("src")).toContain("/vignette?cote=")
    expect(silhouettes[0].getAttribute("src")).toContain("v=e-repos")

    // **Deux colonnes, chacune insécable** : les deux mesures tenaient dans une
    // seule chaîne de 86 px, dont les quatre espaces étaient quatre points de
    // coupe — la ligne s'étalait sur trois.
    const ligne = document
      .querySelector("[data-calibrage] [data-silhouette]")!
      .closest("li") as HTMLElement
    const colonnes = Array.from(ligne.querySelectorAll("span")).filter((s) =>
      /^\d+ (%|px)$/.test(s.textContent ?? ""),
    )
    expect(colonnes.map((c) => c.textContent)).toEqual(["100 %", "64 px"])
    for (const colonne of colonnes) {
      expect(colonne.className).toContain("whitespace-nowrap")
    }
  })

  test("une légende nomme les trois traitements de silhouette", async () => {
    // **Le premier dessin assumait de ne rien écrire** ; à l'usage, personne ne
    // devine que la silhouette à demi effacée est celle qui sert de référence.
    const { ecran } = await ouvrir()

    const legende = Array.from(
      document.querySelectorAll("[data-calibrage] [data-legende]"),
    ).map((l) => l.textContent)
    expect(legende).toEqual([
      "celle qu'on règle — repos",
      "la référence — repos",
      "les autres poses",
    ])
    // Elle tombe à deux entrées quand on ne montre que deux silhouettes : une
    // légende qui nomme ce qui n'est pas là est une légende fausse.
    fireEvent.click(ecran.getByRole("button", { name: "celle-ci et la référence" }))
    expect(
      document.querySelectorAll("[data-calibrage] [data-legende]"),
    ).toHaveLength(2)
  })

  test("l'écran dit ce qu'il répare, et la phrase est lue dans le recueil", async () => {
    // **L'entrée existait depuis le 30 août 2026 et n'était accrochée à rien**
    // (R9) : aucun composant ne la citait, et l'écran ouvrait sur un décompte.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(AIDE["etabli.calibrage"].quoi)).toBeTruthy()
    // Le nom porte le pointillé, donc la version longue au survol.
    expect(ecran.getByRole("button", { name: "Le calibrage" })).toBeTruthy()
    // Et le défaut est mesuré **sur cette chose-ci** : les hauteurs citées sont
    // celles de ses poses, pas celles d'un souvenir.
    expect(ecran.getByText("64, 53, 43")).toBeTruthy()
  })

  test("les quatre entrées neuves s'ouvrent depuis ce qu'elles expliquent", async () => {
    // **Une explication écrite pour un réglage est atteignable depuis ce
    // réglage** — l'autre bout de la règle « une explication ne se recopie
    // jamais ». Vingt-trois entrées du corpus étaient écrites et accrochées à
    // rien ; en ajouter quatre de plus aurait été creuser le trou que `G3`
    // existe pour combler.
    const { ecran } = await ouvrir()

    // Deux sont des libellés de réglage : le nom devient sa propre poignée.
    for (const clef of ["calibrage.occupation", "calibrage.decalage"]) {
      expect(AIDE[clef]).toBeTruthy()
      expect(ecran.getByRole("button", { name: AIDE[clef].nom })).toBeTruthy()
    }

    // Les deux autres sont des **gestes**, et le mot du geste porte le
    // pointillé. Un élément focalisable imbriqué dans un bouton serait du HTML
    // invalide : c'est le bouton lui-même qui reçoit le survol.
    for (const clef of ["calibrage.reference", "calibrage.mise_de_cote"]) {
      expect(AIDE[clef]).toBeTruthy()
    }
    // La pose ouverte est déjà la référence : son geste dit alors l'état, pas
    // l'action. On en choisit une autre, ce qui est le geste qu'on ferait.
    fireEvent.click(ecran.getByRole("button", { name: "attaque" }))
    const geste = ecran.getByRole("button", { name: "prendre comme référence" })
    expect(geste.querySelector(".decoration-dotted")).toBeTruthy()
    fireEvent.mouseEnter(geste)
    expect(await screen.findByText(AIDE["calibrage.reference"].change)).toBeTruthy()
  })

  test("la colonne se déclare comme panneau, et les poignées sont dedans", async () => {
    // **Une bulle sort du panneau qui porte l'ancre**, pas de l'ancre seule :
    // sur 308 px, elle couvrirait sinon le réglage d'à côté — celui-là même
    // qu'on est en train de comparer. La colonne ne portait aucune poignée
    // avant `R9`, et la déclaration n'avait donc rien à faire.
    await ouvrir()

    const poignee = [...document.querySelectorAll("span")].find(
      (e) =>
        e.textContent === "occupation" && e.className.includes("decoration-dotted"),
    )
    expect(poignee).toBeTruthy()
    expect(poignee!.closest("[data-panneau]")).toBeTruthy()
  })

  // ── « La reprise à la main se fait pose par pose » ────────────────────────

  test("on reprend une pose à la main, et elle seule", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(ecran.getByRole("button", { name: "attaque" }))
    const champ = await ecran.findByLabelText("occupation de la pose réglée")
    fireEvent.change(champ, { target: { value: "80" } })

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration/attaque" &&
            JSON.stringify(a.corps).includes('"occupation":80'),
        ),
      ).toBe(true),
    )
  })

  test("le décalage se règle ici, et l'écran dit qu'il n'est écrit que là", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(ecran.getByLabelText("décalage — un de plus"))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/balthazar/calibration/repos" &&
            JSON.stringify(a.corps).includes('"decalage":1'),
        ),
      ).toBe(true),
    )
    // **Où ça s'écrit est dit par le recueil, pas par une phrase de l'écran**
    // (R9) : l'entrée du décalage porte son origine, et c'est elle qui le dit.
    expect(AIDE["calibrage.decalage"].origine).toContain(
      "il ne part jamais dans une recette qu'on nomme",
    )
  })

  // ── Ce que le calibrage ne fait pas ───────────────────────────────────────

  test("la barre qui paie se retire quand le calibrage s'ouvre", async () => {
    // Il ne fabrique rien, ne modifie aucune image payée, ne coûte rien — et la
    // barre absente le dit avant qu'on ait lu quoi que ce soit.
    await ouvrir()

    expect(
      screen.queryByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeNull()
  })

  test("Échap ferme le calibrage et rend l'établi", async () => {
    await ouvrir()

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() =>
      expect(document.querySelector("[data-calibrage]")).toBeNull(),
    )
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
  })

  test("un jeu sans taille de case le dit, plutôt que de calculer sur rien", async () => {
    const double = serveurDouble({
      personnages: [personnage("Balthazar")],
      refusCalibrage: "ce jeu n'impose aucune taille de case",
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "le calibrage ›" }))

    expect(
      await screen.findByText(/aucune taille de case/),
    ).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E19 · Le premier lancement
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : la seule minute que personne ne revoit jamais.
// L'assistant qui s'ouvre sur un atelier neuf et sur lui seul, la sortie à
// n'importe quelle étape qui dépose dans le codex avec le champ qui nomme
// allumé, la barre du haut qui dit *aucune clé* dès la première seconde, et le
// compte des écrans obligatoires — zéro. Ce qui se calcule — ce qui fait qu'un
// atelier est neuf, et ce qui referme la porte — vit dans `tests/test_e19.py`.

describe("le premier lancement", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** L'état d'un atelier qui n'a encore rien : aucune image, un seul jeu qui
   *  porte le nom que le produit lui a donné, et un fournisseur qui attend sa
   *  clé — **pas les deux**, depuis F1 : il en reste toujours un qui produit. */
  const NEUF: Etat = {
    ...ETAT,
    premier_lancement: true,
    secrets: [
      {
        fournisseur: "OpenRouter",
        secrets: [PLACE_VIDE],
        manque: "aucune clé OpenRouter",
        pret: false,
      },
      SANS_SECRET,
    ],
    assets: [],
    generations: [],
  }

  const ouvrir = async (etat: Etat) => {
    const double = serveurDouble({ personnages: [] })
    const flux = await monter(double.fetchDouble, etat)
    return { ...double, flux }
  }

  // ── « L'assistant s'ouvre à la première ouverture de l'atelier » ──────────

  test("un atelier neuf ouvre l'assistant, sur un jeu qui existe déjà", async () => {
    await ouvrir(NEUF)

    // L'onglet Univers, côté Réglages : c'est l'assistant, dans son humeur
    // première fois.
    await waitFor(() =>
      expect(document.querySelector("[data-assistant]")).toBeTruthy(),
    )
    expect(
      screen.getByRole("tab", { name: "Univers" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  test("un atelier déjà servi n'ouvre pas l'assistant", async () => {
    // **La porte se referme au premier geste**, et elle ne se rouvre pas sous
    // les doigts de quelqu'un qui travaille.
    await ouvrir(ETAT)

    expect(document.querySelector("[data-assistant]")).toBeNull()
    expect(
      screen.getByRole("tab", { name: "Galerie" }).getAttribute("aria-selected"),
    ).toBe("true")
  })

  test("un second message d'état ne rouvre pas l'assistant", async () => {
    // Ce message repart **une fois par abonnement**, donc à chaque
    // rebranchement du flux : le rejouer ne doit pas ramener l'écran de la
    // première minute par-dessus ce qu'on est en train de faire.
    const { flux } = await ouvrir(NEUF)
    await waitFor(() =>
      expect(document.querySelector("[data-assistant]")).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))

    await act(async () => {
      flux.emettre("etat", NEUF)
    })

    expect(document.querySelector("[data-assistant]")).toBeNull()
  })

  // ── « La barre du haut dit avec quoi on peut produire, dès la première
  //     seconde » (E19, réécrit en F3) ────────────────────────────────────────
  //
  // Elle disait *aucune clé*, et c'était juste tant qu'il n'y avait qu'un
  // fournisseur. Depuis F1 il y en a plusieurs et l'un ne demande rien : dire
  // *aucune clé* laisserait croire que rien ne peut produire alors qu'une image
  // part très bien.

  test("la barre du haut dit combien de fournisseurs sont prêts, et mène au tiroir", async () => {
    await ouvrir(NEUF)

    // Un attend sa clé, l'autre ne demande rien : **on peut produire**.
    const dit = await screen.findByRole("button", { name: "1 sur 2" })
    // **Ce qui est indisponible porte sa raison et le chemin vers son
    // réglage** — jamais un constat sans issue.
    expect(dit.getAttribute("title")).toContain("aucune clé OpenRouter")
    fireEvent.click(dit)
    await waitFor(() =>
      expect(document.querySelector("[data-reglages]")).toBeTruthy(),
    )
  })

  test("tout déposé, la barre du haut le constate et n'ouvre plus rien", async () => {
    await ouvrir(ETAT)

    expect(await screen.findByText("2 fournisseurs prêts")).toBeTruthy()
    // Une seule fois dans tout l'écran : la même valeur à deux endroits serait
    // deux endroits à tenir d'accord.
    expect(screen.getAllByText("2 fournisseurs prêts")).toHaveLength(1)
    // **Rien à réparer, donc pas de porte** : un bouton qui n'ouvre sur aucun
    // geste utile est un bouton de trop.
    expect(screen.queryByRole("button", { name: "2 fournisseurs prêts" })).toBeNull()
  })

  // ── « On en sort à n'importe quelle étape » ───────────────────────────────

  test("on sort de l'assistant dès la première étape, et l'on tombe dans le codex", async () => {
    await ouvrir(NEUF)
    await waitFor(() =>
      expect(document.querySelector("[data-assistant]")).toBeTruthy(),
    )

    fireEvent.click(screen.getByRole("button", { name: "j'ai fini pour l'instant" }))

    // **Pas dans la galerie** : elle ne montre que des images produites, et il
    // n'y en a aucune.
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Codex" }).getAttribute("aria-selected"),
      ).toBe("true"),
    )
    const champ = await screen.findByLabelText("Nom de la chose du jeu à créer")
    // **Le champ qui nomme est allumé** — c'est le seul geste que cet écran a à
    // proposer, et le curseur y va. À la frame suivante : la barre qui paie
    // monte dans la même passe et prend le curseur sans condition, et c'est le
    // geste demandé qui le lui reprend.
    await waitFor(() => expect(document.activeElement).toBe(champ))
  })

  // ── « Le compte des écrans obligatoires est zéro » ────────────────────────

  test("sur une installation neuve, on atteint un prompt actif sans répondre à rien", async () => {
    // Le critère de réussite du produit, mesuré de bout en bout : de la seconde
    // zéro au champ qui paie, sans qu'une seule question ait reçu de réponse.
    const { fetchDouble } = await ouvrir(NEUF)
    await waitFor(() =>
      expect(document.querySelector("[data-assistant]")).toBeTruthy(),
    )

    fireEvent.click(screen.getByRole("button", { name: "j'ai fini pour l'instant" }))
    const champ = await screen.findByLabelText("Nom de la chose du jeu à créer")
    fireEvent.change(champ, { target: { value: "un tonneau cerclé de fer" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/characters" &&
            (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    )
    // La chose entre dans le codex, et son établi porte le champ qui paie.
    const etabli = await ouvrirLEtabli("un tonneau cerclé de fer")
    expect(etabli).toBeTruthy()
    expect(
      await screen.findByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E16 · La vitrine
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre. Les quatre échelles et
// l'absence de lissage, le fond qui vient du projet et jamais d'un sélecteur
// libre, la place du mouvement grisée avec sa raison, les deux portes — le
// codex et l'établi — et ce que chacune montre. Ce qui se calcule — les fonds
// proposés, la taille commune — vit dans `tests/test_e16.py`.

describe("la vitrine", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Une chose qui tient une image, pour avoir quelque chose à regarder. */
  const avecUneImage = (nom: string, cote = 128) =>
    personnage(nom, {
      cases: PLAN.map((p, rang) => ({
        pose: p.identifiant,
        demandees: p.images,
        images:
          rang === 0
            ? [
                {
                  ...asset(`${nom.toLowerCase()}-corps`),
                  rendu_largeur: cote,
                  rendu_hauteur: cote,
                },
              ]
            : [],
        ...VIDE_C3,
      })),
    })

  const ouvrirDepuisLEtabli = async () => {
    const double = serveurDouble({ personnages: [avecUneImage("Balthazar")] })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "la vitrine ›" }))
    const cadre = await waitFor(() => {
      const vitrine = document.querySelector("[data-vitrine]")
      if (!vitrine) throw new Error("la vitrine ne s'est pas ouverte")
      return vitrine as HTMLElement
    })
    return { ...double, vitrine: within(cadre) }
  }

  // ── « Les échelles sont des multiples entiers » ────────────────────────────

  test("la vitrine n'offre que des multiples entiers, et dit pourquoi", async () => {
    const { vitrine } = await ouvrirDepuisLEtabli()

    for (const echelle of ["×1", "×2", "×4", "×8"]) {
      expect(vitrine.getByRole("button", { name: echelle })).toBeTruthy()
    }
    // Un sprite agrandi d'une fois et demie fabrique des pixels qui n'existent
    // pas : le défaut qu'on croirait voir n'existerait que dans la fenêtre.
    expect(vitrine.getByText(/multiples entiers seulement/)).toBeTruthy()
    expect(vitrine.queryByRole("button", { name: "×1,5" })).toBeNull()
  })

  test("aucune image n'est lissée, à aucune échelle", async () => {
    const { vitrine } = await ouvrirDepuisLEtabli()

    const image = await vitrine.findByAltText("repos")
    expect(image.getAttribute("style")).toContain("pixelated")
    // ×2 par défaut : un sprite de 128 px y occupe 256 px.
    expect(image.getAttribute("width")).toBe("256")

    fireEvent.click(vitrine.getByRole("button", { name: "×4" }))
    expect((await vitrine.findByAltText("repos")).getAttribute("width")).toBe("512")
  })

  // ── « L'intruse ne écrase plus la comparaison » (31 août 2026) ─────────────

  test("une image hors taille commune redescend à la taille commune, et le dit", async () => {
    // Trois poses à 128 px, une à 384. La taille commune est donc 128, et
    // c'est l'écart de la quatrième qui est le sujet de cet essai.
    const chose = personnage("Balthazar", {
      cases: PLAN.map((p, rang) => ({
        pose: p.identifiant,
        demandees: p.images,
        images:
          rang < 4
            ? [
                {
                  ...asset(`balthazar-${p.identifiant}`),
                  rendu_largeur: rang === 3 ? 384 : 128,
                  rendu_hauteur: rang === 3 ? 384 : 128,
                },
              ]
            : [],
        ...VIDE_C3,
      })),
    })
    const double = serveurDouble({ personnages: [chose] })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "la vitrine ›" }))
    const vitrine = within(
      await waitFor(() => {
        const cadre = document.querySelector("[data-vitrine]")
        if (!cadre) throw new Error("la vitrine ne s'est pas ouverte")
        return cadre as HTMLElement
      }),
    )

    // **Ce que la règle protège reste intact** : à ×2, une pose à la taille
    // commune occupe 256 px. C'est cette échelle partagée qui fait voir une
    // sœur sortie plus petite.
    expect((await vitrine.findByAltText("repos")).getAttribute("width")).toBe("256")

    // **Et l'intruse ne prend plus toute la page.** À ×2 elle aurait fait
    // 768 px — trois fois ses sœurs, et 67 % de la surface d'image de la page,
    // mesuré sur un vrai personnage. Elle redescend à la boîte commune.
    const intruse = await vitrine.findByAltText("attaque")
    expect(intruse.getAttribute("width")).toBe("256")
    expect(intruse.getAttribute("height")).toBe("256")

    // **Et l'écran ne ment pas sur ce qu'il montre.** « Toutes ses poses à la
    // même échelle » serait faux sans cette ligne : ce qui n'est pas à
    // l'échelle des autres le dit, sous l'image, dans la couleur des écarts.
    expect(
      vitrine.getByText(/ramenée à 128 px pour tenir dans la comparaison/),
    ).toBeTruthy()

    // Une pose à la taille commune, elle, ne porte aucune mention.
    expect(vitrine.queryAllByText(/ramenée à/)).toHaveLength(1)
  })

  // ── « Le fond de jugement vient du projet » ────────────────────────────────

  test("les fonds viennent du projet, et aucun sélecteur libre n'existe", async () => {
    const { vitrine } = await ouvrirDepuisLEtabli()

    expect(vitrine.getByRole("button", { name: "Fond damier" })).toBeTruthy()
    expect(vitrine.getByRole("button", { name: "Fond noir #000000" })).toBeTruthy()
    expect(vitrine.getByRole("button", { name: "Fond palette #c6b9a8" })).toBeTruthy()
    // **Aucune couleur libre** : un sélecteur transformerait cet écran en outil
    // de maquillage.
    expect(document.querySelector('[data-vitrine] input[type="color"]')).toBeNull()
  })

  test("le fond choisi porte la raison qui l'a fait proposer", async () => {
    const { vitrine } = await ouvrirDepuisLEtabli()

    fireEvent.click(vitrine.getByRole("button", { name: "Fond noir #000000" }))

    // Le produit n'invente pas un fond : il cite le texte du jeu qui l'a fait
    // proposer.
    expect(await vitrine.findByText(/absolute blackness/)).toBeTruthy()
  })

  // ── « La place du mouvement est réservée et grisée avec sa raison » ────────

  test("la place du mouvement est réservée, grisée, avec sa raison", async () => {
    const { vitrine } = await ouvrirDepuisLEtabli()

    const lire = vitrine.getByRole("button", { name: "lire le cycle" })
    expect((lire as HTMLButtonElement).disabled).toBe(true)
    expect(
      vitrine.getByText(/aucune pose ne tient plus d'une image dans une direction/),
    ).toBeTruthy()
  })

  // ── « L'écran s'ouvre depuis le codex et depuis une fiche » ────────────────

  test("le codex ouvre la vitrine sur le monde entier", async () => {
    // **Trois nains côte à côte disent tout de suite s'ils viennent du même
    // monde.** C'est le cinquième verbe du codex : il montre.
    const double = serveurDouble({
      personnages: [avecUneImage("Balthazar"), avecUneImage("Le nain")],
    })
    await monter(double.fetchDouble)
    fireEvent.click(await screen.findByRole("tab", { name: "Codex" }))
    const cadre = await cadreDuCodex()

    fireEvent.click(
      within(cadre).getByRole("button", { name: "voir tout le monde en grand ›" }),
    )

    const vitrine = within(
      await waitFor(() => {
        const trouvee = document.querySelector("[data-vitrine]")
        if (!trouvee) throw new Error("la vitrine ne s'est pas ouverte")
        return trouvee as HTMLElement
      }),
    )
    // Une image par chose, et c'est le nom de la chose qu'on lit.
    expect(await vitrine.findByAltText("Balthazar")).toBeTruthy()
    expect(vitrine.getByAltText("Le nain")).toBeTruthy()
  })

  test("la fiche ouvre la vitrine sur les poses de cette chose", async () => {
    const double = serveurDouble({ personnages: [avecUneImage("Balthazar")] })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(await etabli.findByRole("button", { name: "sa fiche ›" }))
    const fiche = within(
      await waitFor(() => {
        const trouvee = document.querySelector("[data-fiche]")
        if (!trouvee) throw new Error("la fiche ne s'est pas ouverte")
        return trouvee as HTMLElement
      }),
    )

    // **La porte est en tête, à côté du portrait** (R8) : c'est là qu'on est
    // quand on se demande à quoi la chose ressemble vraiment.
    fireEvent.click(await fiche.findByRole("button", { name: "la voir en grand ›" }))

    // On passe de la fiche à la vitrine sans repasser par l'établi.
    await waitFor(() =>
      expect(document.querySelector("[data-vitrine]")).toBeTruthy(),
    )
    expect(document.querySelector("[data-fiche]")).toBeNull()
  })

  test("Échap ferme la vitrine et rend l'établi", async () => {
    await ouvrirDepuisLEtabli()

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() =>
      expect(document.querySelector("[data-vitrine]")).toBeNull(),
    )
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
  })

  test("la barre qui paie se retire quand la vitrine s'ouvre", async () => {
    // Elle ne fabrique rien, ne modifie rien, ne coûte rien — et la barre
    // absente le dit avant qu'on ait lu quoi que ce soit.
    await ouvrirDepuisLEtabli()

    expect(
      screen.queryByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E13 · La planche d'une pose
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran montre avant de payer. Le nombre de
// cases et le texte de chacune, la géométrie écrite par l'atelier et non
// modifiable, le tableau des trois choix avec le nombre d'appels derrière chaque
// prix, ce que refaire coûte, la matrice qui change de pose sans refermer, et la
// barre qui paie qui **reste** — c'est le seul plein cadre de l'établi qui
// dépense. Ce qui se compose — les cases, leur direction, la géométrie, les
// prix — vit dans `tests/test_e13.py`.

describe("la planche d'une pose", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** La planche de « marche » sur le vrai projet : le sud est fait, les trois
   *  autres manquent. C'est le cas le plus courant, et celui que la décision de
   *  l'écran tranche. */
  const PLANCHE: Planche = {
    personnage: "balthazar",
    personnage_nom: "Balthazar",
    pose: "marche",
    pose_nom: "marche",
    cases: [
      {
        direction: "sud",
        nom: "sud",
        texte: "walking posture, full body, facing south, toward the viewer",
        images: [],
        pleine: true,
        colonne: 0,
        ligne: 0,
      },
      {
        direction: "nord",
        nom: "nord",
        texte: "walking posture, full body, facing north, away from the viewer",
        images: [],
        pleine: false,
        colonne: 1,
        ligne: 0,
      },
      {
        direction: "est",
        nom: "est",
        texte: "walking posture, full body, facing east, to the right",
        images: [],
        pleine: false,
        colonne: 0,
        ligne: 1,
      },
      {
        direction: "ouest",
        nom: "ouest",
        texte: "walking posture, full body, facing west, to the left",
        images: [],
        pleine: false,
        colonne: 1,
        ligne: 1,
      },
    ],
    geometrie: {
      cases: 4,
      colonnes: 2,
      lignes: 2,
      cote_px: 1024,
      sujet_px: 460,
      cible_px: 128,
      fois_la_cible: 3.6,
    },
    // Les trois prix, chacun avec le nombre d'appels derrière lui. Deux
    // planches coûtent le même prix — un appel — et c'est ce que la mesure du
    // 31 août 2026 a trouvé.
    choix: [
      {
        clef: "refaire",
        quoi: "Refaire les 4 — une planche",
        cases: 4,
        appels: 1,
        prix: 0.0128,
        par_image: 0.0032,
        mesure: true,
        refus: "",
      },
      {
        clef: "completer",
        quoi: "Compléter les 3 — une planche",
        cases: 3,
        appels: 1,
        prix: 0.0128,
        par_image: 0.004267,
        mesure: true,
        refus: "",
      },
      {
        clef: "unite",
        quoi: "Compléter les 3 — un appel chacune",
        cases: 3,
        appels: 3,
        prix: 0.0384,
        par_image: 0.0128,
        mesure: true,
        refus: "",
      },
    ],
    prix: {
      prix: 0.0128,
      bas: 0.0128,
      haut: 0.0534,
      appels: 18,
      mesure: true,
      // **Le banc**, parce que ce modèle-là n'a rien facturé sur cette machine.
      // Quand il l'a fait, c'est le journal qui parle — la même source que la
      // barre qui paie, sans quoi deux prix pour le même appel voisineraient.
      origine: "banc",
    },
    deja_pleines: ["sud"],
    // **Le banc, toujours à côté du prix affiché** : c'est lui qui porte les
    // chiffres de la phrase sur la variance, et le journal de la machine ne les
    // porte pas toujours.
    banc: {
      prix: 0.0128,
      bas: 0.0128,
      haut: 0.0534,
      appels: 18,
      mesure: true,
      origine: "banc",
    },
    modele: "google/gemini-3.1-flash-lite-image",
    // **Ce qui part en référence**, compté par le serveur. Le gabarit en fait
    // partie : il part, il occupe une place dans le plafond du modèle, et il
    // coûte chez ceux qui facturent au texte.
    jointes: {
      total: 3,
      manuelles: 1,
      artworks: 1,
      concepts: 0,
      famille: "personnages" as const,
      gabarit: 1,
      lignes: [],
    },
  }

  /** Un Balthazar dont la marche tient ses quatre directions — c'est la
   *  déclaration des directions qui crée la planche, et sans elle la porte
   *  n'existe pas. */
  const AVEC_DIRECTIONS = personnage("Balthazar", {
    cases: PLAN.map((p) => ({
      pose: p.identifiant,
      demandees: p.identifiant === "marche" ? 4 : 1,
      images: [],
      ...VIDE_C3,
      directions:
        p.identifiant === "marche"
          ? QUATRE.map((d) => ({
              ...d,
              images: [],
              demandees: 1,
              a_confirmer: 0,
            }))
          : [],
    })),
  })

  const ouvrir = async (planche: Planche = PLANCHE) => {
    const double = serveurDouble({
      planche,
      personnages: [AVEC_DIRECTIONS],
      directions: {
        directions: QUATRE,
        origine: "vue",
        vue: "vue-dessus-34",
        vue_libelle: "vue de dessus 3/4",
        proposees: QUATRE,
      },
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")
    fireEvent.click(
      await etabli.findByRole("button", { name: "Ouvrir la planche de marche" }),
    )
    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-planche]")
      if (!trouve) throw new Error("la planche ne s'est pas ouverte")
      return trouve as HTMLElement
    })
    return { ...double, ecran: within(cadre) }
  }

  // ── « Avant de payer, l'écran montre le nombre de cases, le texte de
  //     chacune, ce qui part en référence, et le prix » ──────────────────────

  test("le nombre de cases et le texte de chacune se lisent avant de payer", async () => {
    // **Une feuille cesse d'être un achat à l'aveugle.** C'est toute la raison
    // d'être de l'écran : la planche est l'unité de ce qu'on achète.
    const { ecran } = await ouvrir()

    expect(ecran.getByText("la planche de marche")).toBeTruthy()
    expect(ecran.getAllByText(/4 cases/).length).toBeGreaterThan(0)
    for (const attendu of [
      "walking posture, full body, facing north, away from the viewer",
      "walking posture, full body, facing east, to the right",
    ]) {
      expect(ecran.getByText(attendu)).toBeTruthy()
    }
  })

  test("ce qui part en référence se compte avant de payer", async () => {
    // **Compté par le serveur** : l'écran ne connaît ni les artworks du jeu, ni
    // les concept arts de la chose, ni le dédoublonnage entre les trois, et
    // deux comptes calculés à deux endroits auraient divergé.
    const { ecran } = await ouvrir()

    expect(ecran.getByText("partent avec l'appel")).toBeTruthy()
    expect(ecran.getByText(/1 gabarit de grille · 1 artwork du jeu/)).toBeTruthy()
  })

  test("chaque case dit sa direction et sa place dans la grille", async () => {
    // **La place est écrite par l'atelier**, et c'est elle qui permet de savoir
    // quel morceau de l'image revenue va dans quelle direction.
    const { ecran } = await ouvrir()

    expect(ecran.getByText("nord")).toBeTruthy()
    expect(ecran.getByText("L1 C1")).toBeTruthy()
    expect(ecran.getByText("L2 C2")).toBeTruthy()
  })

  // ── « La géométrie de la grille et la place de chaque case sont écrites par
  //     l'atelier, montrées, et non modifiables » ────────────────────────────

  test("la géométrie est montrée, et rien ne la règle", async () => {
    // Le motif du produit pour tout ce qui est indisponible : affiché, avec sa
    // raison. La changer casserait le rangement de ce qui revient.
    const { ecran } = await ouvrir()

    expect(ecran.getByText("2 × 2")).toBeTruthy()
    expect(ecran.getByText("460 px")).toBeTruthy()
    expect(ecran.getByText(/elle n'est pas\s+modifiable/)).toBeTruthy()
    // Aucun champ, aucun curseur, aucun segment dans la colonne des réglages.
    const reglages = document.querySelector("[data-planche] aside") as HTMLElement
    expect(within(reglages).queryAllByRole("textbox")).toHaveLength(0)
    expect(within(reglages).queryAllByRole("spinbutton")).toHaveLength(0)
  })

  test("l'écran dit que plier ne coûte pas de qualité, avec le chiffre", async () => {
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/3.6 fois plus\s+grand/)).toBeTruthy()
  })

  // ── « Une planche n'est jamais gardée en bibliothèque ; ses morceaux le
  //     sont » ────────────────────────────────────────────────────────────────

  test("l'écran dit que la feuille n'entre pas en bibliothèque, ses morceaux si", async () => {
    // **C'est une ruse pour payer moins, pas un format de livraison**, et il
    // vaut mieux le lire avant de payer qu'après avoir cherché la feuille.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/ses 4 morceaux, oui/)).toBeTruthy()
  })

  // ── « Refaire les quatre est proposé à côté de compléter les trois, avec les
  //     trois prix et le nombre d'appels derrière chacun » ────────────────────

  test("les trois choix portent chacun leur prix et leur nombre d'appels", async () => {
    // **Un gain annoncé sur une mesure unique est un gain encadré**, pas un
    // gain affirmé : le nombre d'appels est écrit à côté du prix, jamais
    // ailleurs.
    const { ecran } = await ouvrir()

    const refaire = ecran.getByRole("button", {
      name: /Refaire les 4 — une planche/,
    })
    expect(refaire.textContent).toContain("1 appel")
    expect(refaire.textContent).toContain("$0,0128")

    const unite = ecran.getByRole("button", {
      name: /Compléter les 3 — un appel chacune/,
    })
    expect(unite.textContent).toContain("3 appels")
    expect(unite.textContent).toContain("$0,0384")
  })

  test("refaire les quatre est le premier choix, et il est retenu d'entrée", async () => {
    // **Ce n'est pas un réglage caché** : c'est le premier choix de l'écran, et
    // il est posé sur une mesure — à prix d'appel égal, quatre cases peintes
    // ensemble se ressemblent.
    const { ecran } = await ouvrir()

    const refaire = ecran.getByRole("button", {
      name: /Refaire les 4 — une planche/,
    })
    expect(refaire.getAttribute("aria-pressed")).toBe("true")
  })

  test("l'écran écrit pourquoi il n'affiche pas un prix par nombre de cases", async () => {
    // **La seconde moitié de ce que la mesure dit**, et elle n'est pas un
    // détail : la variance entre deux appels identiques dépasse l'écart entre
    // deux tailles de planche.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/Les bancs du dépôt ont payé 18 appels/)).toBeTruthy()
    expect(ecran.getByText(/payés par les bancs du dépôt/)).toBeTruthy()
    // **Le modèle chiffré est nommé** : la barre qui paie garde celui que
    // l'auteur y a choisi, et deux modèles n'ont pas le même prix.
    expect(ecran.getByText("google/gemini-3.1-flash-lite-image")).toBeTruthy()
    expect(
      ecran.getByText(
        /deux appels identiques s'écartent plus que deux tailles/,
      ),
    ).toBeTruthy()
  })

  test("un choix indisponible est grisé avec sa raison", async () => {
    const { ecran } = await ouvrir({
      ...PLANCHE,
      deja_pleines: ["sud", "nord", "est", "ouest"],
      cases: PLANCHE.cases.map((c) => ({ ...c, pleine: true })),
      choix: [
        PLANCHE.choix[0],
        {
          clef: "unite",
          quoi: "Compléter — rien ne manque",
          cases: 0,
          appels: 0,
          prix: 0,
          par_image: 0,
          mesure: true,
          refus: "les 4 cases sont pleines",
        },
      ],
    })

    const rien = ecran.getByRole("button", { name: /Compléter — rien ne manque/ })
    expect((rien as HTMLButtonElement).disabled).toBe(true)
    expect(ecran.getByText("les 4 cases sont pleines")).toBeTruthy()
  })

  // ── Ce que refaire coûte, nommé avant de lancer ──────────────────────────

  test("l'écran écrit qu'on aura payé deux fois pour la case déjà pleine", async () => {
    // **On jette une image qu'on avait.** Elle ne disparaît pas — elle reste en
    // bibliothèque avec son prix payé — mais l'écran le dit avant de lancer,
    // pas après.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/payé deux fois pour cette case-là/)).toBeTruthy()
    expect(ecran.getByText(/sera refaite/)).toBeTruthy()
  })

  // ── Armer, jamais envoyer ────────────────────────────────────────────────

  /** Armer, écrire un sujet, et lire ce qui part. **Le sujet est à taper** :
   *  ce Balthazar-là n'a pas de signalement, et armer une case sans signalement
   *  ne remplit rien — c'est justement ce que le champ prérempli fait ailleurs.
   *  Depuis E14, les directions ne partent plus dans la demande de sujet : elles
   *  sont des lignes à part, et se lisent donc sur ce qui part vraiment. */
  const armerEtLire = async (bouton: RegExp, ecran: ReturnType<typeof within>) => {
    fireEvent.click(ecran.getByRole("button", { name: bouton }))
    await ecrireLeSujet("Balthazar")
    await payer()
  }

  test("armer la planche pose les quatre directions dans la barre qui paie", async () => {
    // **Il n'existe qu'un seul endroit d'où l'on paie dans tout le produit.**
    // L'écran arme ; la barre envoie.
    const { ecran, appels } = await ouvrir()

    await armerEtLire(/Armer la planche — 4 cases/, ecran)

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/generations" && a.corps)
      if (!parti) throw new Error("la planche n'est pas partie")
      expect((parti.corps as { directions: string[] }).directions).toEqual([
        "sud",
        "nord",
        "est",
        "ouest",
      ])
    })
  })

  test("compléter n'arme que les cases vides", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(
      ecran.getByRole("button", { name: /Compléter les 3 — une planche/ }),
    )
    await armerEtLire(/Armer la planche — 3 cases/, ecran)

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/generations" && a.corps)
      if (!parti) throw new Error("la planche n'est pas partie")
      expect((parti.corps as { directions: string[] }).directions).toEqual([
        "nord",
        "est",
        "ouest",
      ])
    })
  })

  // ── La barre qui paie reste — et c'est le seul plein cadre où elle reste ──

  test("la barre qui paie reste ouverte sur la planche", async () => {
    // Les quatre autres profondeurs de l'établi règlent, jugent ou recalculent :
    // aucune ne dépense. Celle-ci, si — et l'écarter de la barre aurait obligé à
    // remonter d'un cran pour payer, c'est-à-dire à perdre de vue ce qu'on
    // venait de regarder.
    await ouvrir()

    expect(
      screen.getByPlaceholderText("Décris ce que tu veux fabriquer."),
    ).toBeTruthy()
  })

  // ── On change de pose sans refermer ──────────────────────────────────────

  test("la matrice de droite change de pose sans refermer la planche", async () => {
    const { ecran } = await ouvrir()

    fireEvent.click(ecran.getByRole("button", { name: /^repos/ }))

    await waitFor(() =>
      expect(ecran.getByText("la planche de repos")).toBeTruthy(),
    )
    expect(document.querySelector("[data-planche]")).toBeTruthy()
  })

  test("la vitrine s'ouvre depuis la planche, sans repasser par l'établi", async () => {
    // **La quatrième porte de la vitrine** (E16), réservée à E13 par son propre
    // critère : *la porte s'y posera avec elle, l'écran ne bouge pas*. On
    // regarde ce qu'on a avant de repayer ce qu'on a.
    const { ecran } = await ouvrir()

    fireEvent.click(ecran.getByRole("button", { name: "la vitrine ›" }))

    await waitFor(() =>
      expect(document.querySelector("[data-vitrine]")).toBeTruthy(),
    )
    expect(document.querySelector("[data-planche]")).toBeNull()
  })

  test("la porte de la vitrine n'existe pas quand rien n'est fait", async () => {
    // Une porte qui ouvre sur le vide est pire qu'une porte absente.
    const { ecran } = await ouvrir({
      ...PLANCHE,
      deja_pleines: [],
      cases: PLANCHE.cases.map((c) => ({ ...c, pleine: false })),
    })

    expect(ecran.queryByRole("button", { name: "la vitrine ›" })).toBeNull()
  })

  test("Échap ferme la planche et rend l'établi", async () => {
    await ouvrir()

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() =>
      expect(document.querySelector("[data-planche]")).toBeNull(),
    )
    expect(document.querySelector("[data-etabli]")).toBeTruthy()
  })

  // ── Sans directions, il n'y a rien à plier ───────────────────────────────

  test("une pose sans directions n'ouvre aucune planche", async () => {
    // **C'est la déclaration des directions qui crée la planche.** Tant qu'une
    // pose vaut une image, il n'y a rien à montrer : une case, un appel, et la
    // barre de prompt suffisait.
    const double = serveurDouble({ personnages: [personnage("Balthazar")] })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Balthazar")

    expect(etabli.queryByRole("button", { name: /Ouvrir la planche/ })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E14 · L'écran de confirmation
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'auteur voit et fait entre le bouton et la
// dépense. Une ligne par chose qui part, avec son interrupteur ; ce qui ne
// s'éteint pas et pourquoi ; une correction qui ne vaut que pour cet appel, et
// le second geste qui la garde ; le prix de chaque image jointe sur sa propre
// ligne ; l'avertissement écrit là où il se répare ; ce qui n'agira qu'au
// retour, en gris ; et la case qui saute l'écran pour la série en cours
// seulement.
//
// **Ce qui se compose vit dans `tests/test_e14.py`** — l'ordre des couches, les
// origines, ce que le tri retient, ce qui s'enregistre avec l'appel. C'est la
// répartition ordinaire du dépôt : l'écran prouve qu'il montre et qu'il rend la
// main, jamais qu'il compose. Il ne compose pas, et c'est précisément ce qu'un
// des essais ci-dessous mesure.

describe("l'écran de confirmation", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    // Depuis U9, les images jointes s'ouvrent en grand : l'aperçu est un
    // magasin de module, et un essai qui le laisserait ouvert le passerait au
    // suivant.
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    reinitialiserApercu()
  })

  /** Un envoi entier, rendu par le serveur — **et non recomposé ici**.
   *
   *  Les essais qui regardent un détail que la bible d'essai ne produit pas —
   *  un avertissement, une ligne remplacée, ce qui agit au retour — le posent
   *  par cette fixture plutôt qu'en fabriquant un monde qui les provoque. Ce
   *  qu'ils mesurent est le rendu, pas la composition : celle-ci a ses propres
   *  essais, côté serveur, où elle est écrite. */
  const ENVOI: Envoi = {
    // **Le texte est la jonction des parties, titres compris** (R7) : recoller
    // `titre`, une ligne vide, `texte`, dans l'ordre, rend exactement ceci.
    texte:
      "CONTEXT\n\nWorld: marais de fer\nLighting: forge-lit from below\n\nREQUEST\n\nun forgeron nain, walking posture",
    parties: [
      {
        clef: "contexte",
        titre: "CONTEXT",
        nom: "le contexte",
        propos: "ce que ton jeu est, et qui ne change pas d'une image à l'autre",
        texte: "World: marais de fer\nLighting: forge-lit from below",
        repris: false,
      },
      {
        clef: "references",
        titre: "REFERENCES",
        nom: "les références",
        propos:
          "ce que chaque image jointe est, dite dans l'ordre où elles partent",
        // Vide : rendue quand même, et elle ne part pas.
        texte: "",
        repris: false,
      },
      {
        clef: "demande",
        titre: "REQUEST",
        nom: "la demande",
        propos: "ce que tu veux cette fois-ci — et la caméra, qui ferme le texte",
        texte: "un forgeron nain, walking posture",
        repris: false,
      },
    ],
    lignes: [
      {
        clef: "jeu.monde",
        groupe: "jeu",
        nom: "monde",
        texte: "marais de fer",
        intitule: "World",
        origine: "du jeu",
        allumee: true,
        eteignable: true,
        remplace: "",
        remplacee_par: "",
        corrigee: false,
        gardable: true,
      },
      {
        clef: "ambiance.eclairage",
        groupe: "ambiance",
        nom: "éclairage",
        texte: "forge-lit from below",
        intitule: "Lighting",
        origine: "de son ambiance",
        allumee: true,
        eteignable: true,
        remplace: "cold blue rim light",
        remplacee_par: "",
        corrigee: false,
        gardable: false,
      },
      {
        clef: "sujet.sujet",
        groupe: "sujet",
        nom: "sujet",
        texte: "un forgeron nain",
        origine: "écrit ici",
        allumee: true,
        eteignable: false,
        raison: "sans lui l'appel ne demande rien",
        remplace: "",
        remplacee_par: "",
        corrigee: false,
        gardable: true,
      },
      {
        clef: "sujet.pose",
        groupe: "sujet",
        nom: "attitude",
        texte: "walking posture, full body",
        origine: "de la pose",
        allumee: true,
        eteignable: false,
        raison: "c'est la case qu'on remplit",
        remplace: "",
        remplacee_par: "",
        corrigee: false,
        gardable: false,
        avertissement:
          "le texte annonce 64 px, la case en impose 32 — le modèle suivra le texte",
      },
    ],
    groupes: [
      { clef: "jeu", nom: "les textes du jeu", partie: "contexte", allumees: 1, total: 1 },
      { clef: "ambiance", nom: "son ambiance", partie: "contexte", allumees: 1, total: 1 },
      { clef: "sujet", nom: "le sujet", partie: "demande", allumees: 2, total: 2 },
      { clef: "images", nom: "les images", allumees: 1, total: 2 },
    ],
    images: {
      lignes: [
        {
          asset: "carte-officielle",
          role: "style",
          origine: "carte",
          // De quoi la montrer : l'objet entier, tel que le serveur l'envoie.
          montre: { sorte: "carte" as const, carte: carteImage("carte-officielle") },
          provenance: "artwork officiel",
          ecartee_par: null,
          cochee: true,
          hors_plafond: false,
          // Le numéro que le texte lui donne (R7). La seconde est décochée :
          // elle ne part pas, donc elle n'a pas de numéro.
          rang: 1,
          prix: 0.008,
        },
        {
          asset: "carte-concept",
          role: "style",
          origine: "carte",
          montre: { sorte: "carte" as const, carte: carteImage("carte-concept") },
          provenance: "concept art",
          ecartee_par: null,
          cochee: false,
          hors_plafond: false,
          rang: null,
          prix: 0.008,
        },
      ],
      places: 14,
      cochees: 1,
      partent: 1,
      gabarit: 0,
      palette: 0,
      rang_gabarit: null,
      rang_palette: null,
      prix: 0.008,
      avertissements: [],
    },
    options: [
      {
        clef: "options.palette",
        nom: "palette",
        texte: "envoyer la palette en référence",
        detail: "les couleurs du jeu",
        allumee: false,
        refus: "",
      },
    ],
    retour: [
      { nom: "détourage", detail: "fond retiré au bord" },
      { nom: "grille", detail: "ramené à 32 px" },
    ],
    avertissements: [
      {
        clef: "sujet.pose",
        texte:
          "le texte annonce 64 px, la case en impose 32 — le modèle suivra le texte",
      },
    ],
    prix: {
      total: 0.0143,
      appels: 1,
      images: 0.008,
      mesure: {
        unite: "usd",
        prix: 0.0139,
        bas: 0.0063,
        haut: 0.0232,
        appels: 9,
        base: 0.0063,
        par_image: 0.008,
        sur_base: 9,
        sur_jointes: 15,
      },
    },
    // Aucune reserve : ce modele-la compte en argent, et l'argent a la barre
    // de tete (F2). C'est le cas de la quasi-totalite des essais d'ecran.
    reserve: null,
    modele: {
      identifiant: "openai/gpt-image-2",
      nom: "GPT-Image-2",
      references_max: 14,
    },
    ambiance: {
      nom: "Forge des profondeurs",
      prend: "tout",
      textes: true,
      references: true,
      couleurs: true,
    },
    cases: 0,
    caracteres: { total: 96, sujet: 16, eteints: 0 },
    corrections: 0,
    // **Aucun fond posé** (D3) : la fixture décrit un jeu d'avant la tranche,
    // et l'écran doit donc rendre exactement ce qu'il rendait.
    fond: {
      couleur: "",
      interdiction: "",
      du_jeu: "",
      corrige: false,
      propose: {
        couleur: "",
        nom: "",
        ecart: 0,
        voisine: "",
        raison: "ce jeu n'a pas encore de palette",
      },
    },
  }

  /** Un monde qui a quelque chose à dire — sans quoi le groupe « les textes du
   *  jeu » serait vide, et il n'y aurait rien à éteindre. */
  const MONDE: Univers = {
    ...UNIVERS,
    bible: UNIVERS.bible.map((c) =>
      c.nom === "monde" ? { ...c, texte: "marais de fer" } : c,
    ),
    vide: false,
  }

  /** Monter l'atelier, écrire un sujet, et ouvrir l'écran de confirmation.
   *
   *  Sans `envoi`, le double **compose** depuis la bible du monde : c'est le
   *  chemin des essais qui font un geste et regardent ce qui part. Avec, il rend
   *  la fixture telle quelle : c'est celui des essais qui regardent un rendu que
   *  la bible d'essai ne produit pas. */
  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble({ univers: MONDE, ...options })
    await monter(double.fetchDouble, {
      ...ETAT,
      univers: options.univers ?? MONDE,
    })
    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un forgeron nain" } })
    const ecran = await relire()
    return { ...double, ecran }
  }

  /** La même chose, **avec une case armée** — donc avec une série.
   *
   *  La case « ne plus me le montrer » ne paraît que là : une série est une
   *  chose et une pose, et un texte écrit à la main sans chose visée n'a pas de
   *  suivant qui lui ressemble. Les essais qui regardent la case passent donc
   *  par ici, comme l'auteur. */
  const ouvrirUneSerie = async (nom = "Le nain") => {
    const double = serveurDouble({
      univers: MONDE,
      personnages: [personnage(nom, { description: "un forgeron" })],
    })
    await monter(double.fetchDouble, { ...ETAT, univers: MONDE })
    const etabli = await ouvrirLEtabli(nom)
    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer repos" }))
    await ecrireLeSujet("un forgeron nain")
    const ecran = await relire()
    return { ...double, ecran }
  }

  // ── « Chaque texte et chaque image qui part occupe sa propre ligne, avec un
  //     interrupteur » ────────────────────────────────────────────────────────

  test("chaque chose qui part a sa ligne et son interrupteur", async () => {
    // **C'est la forme de l'écran, et elle vaut sa promesse** : quatre textes et
    // deux images, donc six interrupteurs — un texte fondu dans un autre serait
    // un texte qu'on ne peut pas éteindre seul.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    for (const nom of ["monde", "éclairage", "sujet", "attitude"]) {
      expect(ecran.getByText(nom)).toBeTruthy()
    }
    expect(ecran.getByLabelText("Éteindre monde")).toBeTruthy()
    expect(ecran.getByLabelText("Éteindre éclairage")).toBeTruthy()
    expect(ecran.getByLabelText("Décocher artwork officiel")).toBeTruthy()
    expect(ecran.getByLabelText("Cocher concept art")).toBeTruthy()

    // **Le texte entier, sans coupure et sans résumé** : c'est l'écran qui
    // existe pour tenir « ce qui est montré est ce qui part », et des points de
    // suspension y trahiraient la règle qu'il porte.
    expect(ecran.getByText("forge-lit from below")).toBeTruthy()
  })

  // ── « Une ligne éteinte ne part pas, et l'extinction ne remonte nulle part »

  test("éteindre une ligne la retire de ce qui part, sans rien écrire", async () => {
    // **L'écart ne vaut que pour cet appel.** Éteindre le monde ici ne démonte
    // pas la bible du projet : c'est la différence entre corriger un envoi et
    // changer son jeu.
    const { ecran, appels } = await ouvrir()

    fireEvent.click(await ecran.findByLabelText("Éteindre monde"))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            JSON.stringify(a.corps).includes('"eteints":["jeu.monde"]'),
        ),
      ).toBe(true),
    )
    // Rien n'a été écrit — ni l'univers, ni la chose du jeu.
    expect(
      appels.filter((a) => a.url.startsWith("/api/universe") && a.corps),
    ).toEqual([])
  })

  // ── D3 · « Le fond se corrige à la main, avant de payer, pour cet appel
  //     seulement » ─────────────────────────────────────────────────────────

  test("le fond de l'appel se voit, avec l'interdiction qui part avec lui", async () => {
    // **L'interdiction est le seul morceau de ce qui part que le texte ne
    // contient pas** : les adaptateurs la replient en fin de demande, dans un
    // autre champ. Sans ce bloc, l'écran qui promet de tout montrer aurait un
    // angle mort — et ce serait celui que la tranche vient d'ouvrir.
    const { ecran } = await ouvrir({
      envoi: {
        ...ENVOI,
        fond: {
          couleur: "#FF00FF",
          interdiction:
            "the background colour #FF00FF magenta, or any shade close to it",
          du_jeu: "#FF00FF",
          corrige: false,
          propose: {
            couleur: "#FF00FF",
            nom: "magenta",
            ecart: 192,
            voisine: "#C0C0C0",
            raison: null,
          },
        },
      },
    })

    expect(ecran.getByText("le fond")).toBeTruthy()
    expect(ecran.getByText("#FF00FF")).toBeTruthy()
    expect(ecran.getByText(/or any shade close to it/)).toBeTruthy()
  })

  test("sans fond, la pastille est un damier et non une couleur", async () => {
    // ⚠️ **Un `input type=color` n'a pas d'état vide.** Il portait donc le
    // magenta de la proposition juste à côté des mots « aucun fond », ce qui
    // disait très exactement le contraire de ce que l'écran voulait dire. Vu au
    // navigateur le 3 septembre 2026, pas dans le code : le code se lit toujours
    // comme on l'a pensé, et c'est le piège déjà payé de la case qui ne change
    // rien — un contrôle qui montre un état qu'il n'a pas est pire qu'un
    // contrôle absent.
    //
    // **Et le sélecteur reste atteignable dessous.** Le supprimer aurait fermé
    // le seul chemin qui reste quand aucune couleur candidate n'est sûre : le
    // refus lui-même invite à en choisir une à la main.
    const { ecran } = await ouvrir()

    const choix = await ecran.findByLabelText("Couleur du fond, pour cet appel")

    expect(ecran.getByText(/aucun fond/)).toBeTruthy()
    expect(choix.parentElement?.className).toContain("damier")
  })

  test("corriger le fond ne part que dans le tri de cet appel", async () => {
    // **La correction habille l'appel et disparaît**, comme tout ce que cet
    // écran renvoie. Poser le fond durablement est un second geste, qui passe
    // par le codex.
    const { ecran, appels } = await ouvrir()

    fireEvent.change(await ecran.findByLabelText("Couleur du fond, pour cet appel"), {
      target: { value: "#00ffff" },
    })

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            JSON.stringify(a.corps).includes('"fond":"#00ffff"'),
        ),
      ).toBe(true),
    )
    // Rien n'a été écrit — ni l'univers, ni la chose du jeu.
    expect(
      appels.filter((a) => a.url.startsWith("/api/universe") && a.corps),
    ).toEqual([])
  })

  test("la ligne éteinte reste à sa place, barrée — elle ne disparaît pas", async () => {
    // **Une ligne qui s'en va emporterait la seule preuve qu'on l'a éteinte**, et
    // la ligne suivante remonterait sous le doigt. Elle reste, barrée, et son
    // interrupteur devient creux.
    const { ecran } = await ouvrir()

    fireEvent.click(await ecran.findByLabelText("Éteindre monde"))

    const rallumer = await ecran.findByLabelText("Allumer monde")
    expect(rallumer.getAttribute("aria-pressed")).toBe("false")
  })

  // ── « Le sujet et la pose demandée ne peuvent pas s'éteindre, et leur marque
  //     le dit » ──────────────────────────────────────────────────────────────

  test("ce qui ne s'éteint pas est montré avec sa raison, jamais caché", async () => {
    // Le motif du produit pour tout ce qui est indisponible : affiché, et avec
    // sa raison. Un interrupteur absent aurait laissé chercher pourquoi.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    const sujet = ecran.getByLabelText("Éteindre sujet") as HTMLButtonElement
    expect(sujet.disabled).toBe(true)
    expect(ecran.getByText(/sans lui l'appel ne demande rien/)).toBeTruthy()

    const pose = ecran.getByLabelText("Éteindre attitude") as HTMLButtonElement
    expect(pose.disabled).toBe(true)
    expect(ecran.getByText(/c'est la case qu'on remplit/)).toBeTruthy()
  })

  // ── « Une correction faite ici vaut pour cet appel seulement ; un second
  //     geste, nommé, la garde sur la chose du jeu » ──────────────────────────

  test("corriger une ligne ne vaut que pour cet appel, et se remet", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText("Corriger monde"), {
      target: { value: "marais de rouille" },
    })

    // Le texte corrigé part avec l'appel, et **rien n'a été écrit** : ni la
    // bible, ni la chose du jeu.
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            JSON.stringify(a.corps).includes("marais de rouille"),
        ),
      ).toBe(true),
    )
    expect(
      appels.filter((a) => a.url.startsWith("/api/universe") && a.corps),
    ).toEqual([])

    // Et la ligne dit qu'elle a divergé, avec de quoi revenir en arrière.
    expect(await ecran.findByText("corrigé pour cet appel")).toBeTruthy()
    expect(ecran.getByRole("button", { name: "remettre" })).toBeTruthy()
  })

  test("garder une correction est un second geste, nommé, et il écrit", async () => {
    // **Jamais un effet de bord.** Le premier geste corrige cet appel ; celui-ci
    // dit « et garde-le », et c'est le seul qui écrive quelque part.
    const double = serveurDouble({
      univers: MONDE,
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })
    await monter(double.fetchDouble, { ...ETAT, univers: MONDE })
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer repos" }))
    await ecrireLeSujet("un forgeron")
    const ecran = await relire()

    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText("Corriger monde"), {
      target: { value: "marais de rouille" },
    })

    // **Il va sur la fiche de la chose visée** — c'est la case où ce texte-là
    // vivra durablement, et c'est ce que le bouton dit en toutes lettres.
    fireEvent.click(await ecran.findByRole("button", { name: /garder sur la chose/ }))

    await waitFor(() => {
      const ecrit = double.appels.find(
        (a) => a.url === "/api/characters/le-nain" && a.corps,
      )
      expect(ecrit).toBeTruthy()
      expect((ecrit!.corps as { textes: Record<string, string> }).textes).toEqual({
        monde: "marais de rouille",
      })
    })
  })

  test("sans chose visée, garder n'est pas proposé — il n'aurait pas de case", async () => {
    // **Un geste offert qui ne ferait rien vaut moins que pas de geste.** Le
    // texte corrigé part quand même : ce qui manque est l'endroit où le garder,
    // pas la correction.
    const { ecran } = await ouvrir()

    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText("Corriger monde"), {
      target: { value: "marais de rouille" },
    })

    await ecran.findByText("corrigé pour cet appel")
    expect(ecran.queryByRole("button", { name: /garder sur la chose/ })).toBeNull()
  })

  // ── « Chaque image jointe porte son prix sur sa ligne ; une case éteinte
  //     garde le sien en gris » ────────────────────────────────────────────────

  test("chaque image jointe porte son prix, et la décochée le garde en gris", async () => {
    // **Le prix s'écrit là où l'on coche.** Le porter ailleurs obligerait à
    // faire la soustraction soi-même pour savoir ce qu'une case coûte.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    const prix = ecran.getAllByText("+$0,0080")
    expect(prix).toHaveLength(2)
    // La cochée est en doré — la couleur de tout écart du produit ; la décochée
    // garde son prix en gris : c'est ce qu'elle coûterait si on la rallumait.
    expect(prix[0].className).toContain("text-epingle")
    expect(prix[1].className).toContain("text-texte-3")
  })

  test("la palette cochée se compte dans les images, et le dit à leur place", async () => {
    // **Le compte annonçait « 1 cochée » au-dessus d'une liste vide** : juste, et
    // introuvable. La bande des couleurs n'est pas une image de la bibliothèque,
    // elle n'a donc pas de ligne à cocher — mais elle occupe une place et coûte
    // un pas, donc elle se dit là où on lit ce qui part.
    const { ecran } = await ouvrir({
      envoi: {
        ...ENVOI,
        images: { ...ENVOI.images, lignes: [], cochees: 1, palette: 1 },
      },
    })

    expect(ecran.getByText(/la bande des couleurs du jeu/)).toBeTruthy()
    // Et elle se décoche là où elle se coche — une chose est réglée à un seul
    // endroit.
    expect(ecran.getByLabelText("Cocher palette")).toBeTruthy()
    expect(ecran.queryByText(/aucune image ne part avec cet appel/)).toBeNull()
  })

  // ── Un modèle qui n'accepte aucune image (F6) ─────────────────────────────
  //
  // **Le cas n'existait pas avant F6** : un modèle sans places refusait l'appel
  // tout entier, et l'écran de confirmation ne s'ouvrait donc jamais sur lui.
  // Depuis que ce que le jeu ajoute de lui-même cède plutôt que de refuser, il
  // s'ouvre — et c'est ici, entre le clic et le paiement, que la surprise doit
  // être évitée.

  const SANS_PLACES: Envoi = {
    ...ENVOI,
    // Le sommaire vient du serveur, comme tout le reste de cet écran : il dit
    // **combien partent sur combien sont cochées**, et l'écran ne le recalcule
    // pas — c'est la règle de la tranche.
    groupes: ENVOI.groupes.map((g) =>
      g.clef === "images" ? { ...g, allumees: 0, total: 1 } : g,
    ),
    images: {
      ...ENVOI.images,
      places: 0,
      partent: 0,
      lignes: ENVOI.images.lignes.map((l) => ({
        ...l,
        hors_plafond: l.cochee,
        // Aucune ne part : aucune n'a de numéro dans le texte (R7).
        rang: null,
      })),
      avertissements: [
        {
          clef: "images.sans_images",
          texte:
            "ce modèle n'accepte aucune image · l'appel partira sans elle, sur le texte seul",
        },
      ],
    },
  }

  test("un modèle sans places le dit sur la ligne, avec ses mots à lui", async () => {
    const { ecran } = await ouvrir({ envoi: SANS_PLACES })

    // **« Au-delà des places du modèle » suppose qu'il y en a**, et laisserait
    // croire qu'en décocher une ferait passer l'autre. Il n'y en a aucune.
    expect(ecran.getByText(/ce modèle n'en prend aucune/)).toBeTruthy()
    expect(ecran.queryByText(/au-delà des places du modèle/)).toBeNull()
  })

  test("ce que les images ont à dire s'écrit là où elles sont", async () => {
    // **L'en-tête annonce « N avertissements, écrits sur la ligne concernée »**,
    // et les avertissements du bloc d'images n'ont pas de ligne de prompt à
    // eux : ils étaient comptés et affichés nulle part. On lisait « 1
    // avertissement » et l'on cherchait où. Trouvé en regardant l'écran chez un
    // modèle sans places ; les deux autres l'attendaient depuis E14.
    const { ecran } = await ouvrir({ envoi: SANS_PLACES })

    expect(
      ecran.getByText(/l'appel partira sans elle, sur le texte seul/),
    ).toBeTruthy()
  })

  test("le sommaire compte ce qui part, pas la capacité du modèle", async () => {
    // **« 1 sur 0 » se lisait comme une contradiction.** Les quatre autres
    // groupes disent « allumées sur disponibles » ; celui des images disait
    // « cochées sur places du modèle », c'est-à-dire un compte sur une
    // capacité. Les places restent écrites en tête du bloc, où elles
    // expliquent l'écart.
    const { ecran } = await ouvrir({ envoi: SANS_PLACES })

    const sommaire = ecran.getByText("les images").parentElement!
    expect(sommaire.textContent).toContain("0 sur 1")
  })

  // ── « L'en-tête du groupe dit ce que les cases cochées pèsent dans le total
  //     de l'appel » ──────────────────────────────────────────────────────────

  test("l'en-tête des images dit ce que les cases cochées pèsent dans le total", async () => {
    // **Une part, pas un nombre nu** : « $0,0080 » seul ne dit pas s'il s'agit de
    // la moitié de l'appel ou d'un vingtième.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    // **Dans l'en-tête du groupe**, et pas ailleurs sur l'écran : la mesure du
    // pas d'une image jointe porte le même nombre, et ce n'est pas la même
    // phrase.
    const entete = ecran.getByText("les images jointes").parentElement as HTMLElement
    expect(within(entete).getByText(/1 cochée/)).toBeTruthy()
    expect(within(entete).getByText("$0,0080")).toBeTruthy()
    expect(within(entete).getByText(/des \$0,0143/)).toBeTruthy()
  })

  // ── « Un avertissement s'écrit sur la ligne fautive, avec des chiffres,
  //     jamais en bandeau » ───────────────────────────────────────────────────

  test("l'avertissement est écrit sur la ligne fautive, avec ses chiffres", async () => {
    // **Un bandeau dirait « attention » et laisserait chercher où.** La ligne dit
    // laquelle, et le bouton pour la corriger est déjà à côté.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    const dit = ecran.getByText(/le texte annonce 64 px, la case en impose 32/)
    // Il vit **dans** la ligne de l'attitude, pas au-dessus de l'écran.
    const ligne = dit.closest("li") as HTMLElement
    expect(within(ligne).getByText("attitude")).toBeTruthy()

    // Le compte est repris à côté du prix — on sait qu'il y en a un sans être
    // descendu jusqu'à lui — et il dit qu'il ne bloque rien.
    expect(ecran.getByText(/1 avertissement — non bloquant/)).toBeTruthy()
  })

  // ── « Ce qui agira au retour se lit en gris, et se distingue de ce qui
  //     part » ────────────────────────────────────────────────────────────────

  test("ce qui n'agira qu'au retour se lit à part, et dit qu'il ne coûte rien", async () => {
    // **Rien de tout ça ne part au modèle et rien ne coûte un centime** — mais
    // l'image qu'on verra revenir n'est pas celle que le modèle envoie, et il
    // vaut mieux le savoir avant qu'après.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    const bloc = ecran.getByText("ce qui se passe au retour").parentElement as HTMLElement
    expect(within(bloc).getByText("détourage")).toBeTruthy()
    expect(within(bloc).getByText("ramené à 32 px")).toBeTruthy()
    expect(within(bloc).getByText(/sans un centime/)).toBeTruthy()
    // Et il n'a pas d'interrupteur : ces réglages-là se font dans les tables —
    // une chose est réglée à un seul endroit.
    expect(within(bloc).queryByRole("button")).toBeNull()
  })

  // ── « Le texte montré vient du même chemin que l'envoi » ────────────────────

  test("ce que l'écran a montré est ce qui part avec la dépense", async () => {
    // **La preuve du critère, prise à l'écran** : le tri qu'on vient de faire
    // voyage avec l'appel qui paie. Sans lui, le texte relu et le texte envoyé
    // seraient deux textes, et celui qui compte est celui qui part.
    const { ecran, appels } = await ouvrir()

    fireEvent.click(await ecran.findByLabelText("Éteindre monde"))
    await ecran.findByLabelText("Allumer monde")
    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/generations" && a.corps)
      expect(parti).toBeTruthy()
      expect((parti!.corps as { tri: Tri }).tri.eteints).toEqual(["jeu.monde"])
    })
  })

  // ── Revenir ne dépense rien ──────────────────────────────────────────────

  test("revenir sans rien dépenser ne dépense rien, et Échap fait pareil", async () => {
    const { ecran, appels } = await ouvrir()

    fireEvent.click(ecran.getByRole("button", { name: /Revenir sans rien dépenser/ }))
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
    expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toEqual([])

    // Et la même chose au clavier, comme partout ailleurs dans le produit.
    await relire()
    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
    expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toEqual([])
  })

  // ── « Une case saute l'écran pour la série en cours et se remet à chaque
  //     nouvelle série ; aucun réglage ne l'éteint définitivement » ────────────

  test("la case cochée saute l'écran pour la suite de la série", async () => {
    // **Relire dix fois la même chose est une punition** quand on refait dix
    // fois la même image. La case existe pour ça, et pour ça seulement — donc
    // seulement là où il y a une série, c'est-à-dire une case armée.
    const { ecran, appels } = await ouvrirUneSerie()

    fireEvent.click(ecran.getByLabelText("ne plus me le montrer pour cette série"))
    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toHaveLength(1),
    )

    // **On réarme la même case, et c'est le vrai geste** : payer désarme la
    // cible — une intention qui vaut pour *cette* génération-là —, donc refaire
    // la même image passe par la matrice. C'est la même série, et l'écran se
    // saute. L'essai d'avant ne réarmait pas : il ne vérifiait donc le saut que
    // sur le chemin sans chose du jeu, celui-là même qui n'aurait jamais dû
    // l'offrir.
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer repos" }))
    await ecrireLeSujet("un forgeron nain")

    // Le second envoi ne passe plus par l'écran : un clic, une dépense.
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toHaveLength(2),
    )
    expect(document.querySelector("[data-envoi]")).toBeNull()
  })

  test("changer de sujet remet l'écran — il n'y a pas de case « pour toujours »", async () => {
    // **On la cocherait le premier jour**, quand on ne sait pas encore qu'on en
    // aura besoin. Elle ne vaut donc que pour la série en cours.
    const { ecran, appels } = await ouvrirUneSerie()

    fireEvent.click(ecran.getByLabelText("ne plus me le montrer pour cette série"))
    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toHaveLength(1),
    )

    // On arme une autre case : c'est une autre série, et l'écran revient.
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer marche" }))
    await ecrireLeSujet("un forgeron")
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

    await screen.findByRole("button", { name: /^Payer et lancer/ })
    expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toHaveLength(1)
  })

  test("l'écran dit lui-même qu'aucune case ne l'éteint pour toujours", async () => {
    const { ecran } = await ouvrirUneSerie()

    expect(ecran.getByText(/Il n'y a pas de case « pour toujours »/)).toBeTruthy()
  })

  // ── Le prix, et la mesure qui le porte ──────────────────────────────────

  test("le prix porte sa mesure à côté de lui, jamais fondue dedans", async () => {
    // **Une mesure, jamais un tarif** (T1), et E13 y a ajouté sa moitié : une
    // moyenne n'est le prix de personne. Le pas d'une image jointe est mesuré à
    // part, sur ses propres appels.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    expect(ecran.getByRole("button", { name: "Payer et lancer $0,0143" })).toBeTruthy()
    expect(ecran.getByText(/mesuré sur 9 appels payés/)).toBeTruthy()
    expect(ecran.getByText(/chaque image jointe en ajoute/)).toBeTruthy()
    expect(ecran.getByText(/mesuré sur 15/)).toBeTruthy()
    expect(ecran.getByText(/n'est le prix de personne/)).toBeTruthy()
  })

  test("un modèle qui n'a rien facturé ici laisse le prix inconnu, jamais deviné", async () => {
    // « Zéro n'est pas une mesure, c'est l'absence de mesure » (`docs/PIEGES.md`).
    const { ecran } = await ouvrir({
      envoi: {
        ...ENVOI,
        prix: {
          total: null,
          appels: 1,
          images: null,
          mesure: {
            unite: "usd",
            prix: null,
            bas: 0,
            haut: 0,
            appels: 0,
            base: null,
            par_image: null,
            sur_base: 0,
            sur_jointes: 0,
          },
        },
      },
    })

    expect(ecran.getByText(/n'a encore rien facturé sur cette machine/)).toBeTruthy()
    expect(ecran.getByRole("button", { name: "Payer et lancer" })).toBeTruthy()
  })

  // ── « Ce qui a été pris de l'ambiance … se relit sur une vieille image » ────

  test("la fiche d'une vieille image dit ce que son ambiance lui avait donné", async () => {
    // **Sans elle, « ce qui est montré est ce qui part » cesserait d'être vrai en
    // relisant.** Le réglage de la chose aura changé, l'ambiance aura été
    // retouchée, et le texte enregistré porte les mots sans dire d'où chacun
    // venait.
    const vieille = generation("aaaa1111", 1, "reussie")
    const images = [asset("eeee5555-0")]
    const { fetchDouble } = serveurDouble({
      assets: images,
      aPublier: () => ({
        ...vieille,
        ambiance: "Forge des profondeurs",
        pris: ["textes", "couleurs"],
      }),
    })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    expect(
      await screen.findByText(
        /d'après « Forge des profondeurs » — ses textes, ses couleurs/,
      ),
    ).toBeTruthy()
  })

  test("une image sans ambiance n'affiche pas de ligne vide", async () => {
    // Une rubrique qui paraîtrait vide sur l'immense majorité des images serait
    // du cadrage : la ligne n'existe que là où elle a quelque chose à dire.
    const images = [asset("eeee5555-0")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    expect(screen.queryByText(/d'après «/)).toBeNull()
  })

  // ── « La barre qui paie ne dépense plus : elle fait relire » ──────────────
  //
  // **Le cas du monde vide, signalé par l'auteur et payé en vrai.** Le premier
  // parcours du produit — un jeu neuf, aucune chose dedans, un texte tapé au
  // pied du codex — est aussi celui où l'écran de confirmation compte le plus :
  // c'est la première fois qu'on dépense, et l'on ne sait pas encore ce qui
  // part. C'est là qu'il a manqué.

  test("un monde vide fait relire avant de payer, comme tous les autres", async () => {
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))

    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

    // L'écran s'ouvre…
    expect(
      await screen.findByRole("button", { name: /^Payer et lancer/ }),
    ).toBeTruthy()
    // …et **rien n'est parti** tant qu'on n'a pas relu. C'est l'assertion qui
    // compte : le reste de l'écran a ses propres essais, celle-ci dit que le
    // clic ne facture pas.
    expect(double.appels.filter((a) => a.url === "/api/generations")).toHaveLength(0)
  })

  test("sauter l'écran une fois ne le saute pas pour un autre sujet", async () => {
    // **Le bug signalé par l'auteur, et il coûtait de l'argent à chaque clic.**
    // « Ne plus me le montrer » vaut *pour la série en cours* — une chose et une
    // pose. Sans chose du jeu, il n'y a pas de série : chaque texte est écrit à
    // la main et n'a rien à voir avec le précédent. La clé de série valait
    // pourtant « rien, rien, rien » pour tous, donc cocher la case une seule
    // fois éteignait l'écran de confirmation pour **toutes** les générations
    // sans chose, dans tous les jeux, jusqu'à ce qu'on recharge l'onglet. Le
    // clic suivant partait droit à la dépense, en silence.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    await screen.findByRole("button", { name: /^Payer et lancer/ })

    // La case n'est **pas offerte** ici : il n'y a pas de série à sauter.
    expect(screen.queryByLabelText(/ne plus me le montrer/i)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /^Payer et lancer/ }))
    await waitFor(() =>
      expect(
        double.appels.filter((a) => a.url === "/api/generations"),
      ).toHaveLength(1),
    )

    // Un second sujet, sans rapport avec le premier : l'écran revient.
    const suivant = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(suivant, { target: { value: "un petit voyageur, de dos" } })
    await waitFor(() => expect(suivant.value).toBe("un petit voyageur, de dos"))
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

    expect(
      await screen.findByRole("button", { name: /^Payer et lancer/ }),
    ).toBeTruthy()
    expect(
      double.appels.filter((a) => a.url === "/api/generations"),
    ).toHaveLength(1)
  })

  test("le bouton qui paie devient l'état de ce qu'il a payé", async () => {
    // **Le cœur du remède**, écrit sur le second signalement de l'auteur : la
    // ligne posée dans la fente ne suffisait pas, parce que le bouton, lui, ne
    // changeait pas. On cliquait *Générer*, et *Générer* revenait identique,
    // plein, disponible — il disait « il ne s'est rien passé » plus fort que la
    // ligne d'en dessous ne disait le contraire. La chose qu'on recliquerait
    // devient donc la chose qui dit que ça marche.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))

    // Avant de payer : le bouton plein, et la fente à son locataire ordinaire.
    expect(screen.getByRole("button", { name: /^Générer$/ })).toBeTruthy()
    expect(screen.getByText("Ctrl + Entrée")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))

    // Le bloc a pris la place du bouton, et il porte le compte.
    const enRoute = await screen.findByRole("status")
    expect(enRoute.textContent).toContain("1 image en route")

    // **Générer n'est plus un bouton plein** : il est descendu dans la fente,
    // en lien. Il reste à portée — on a le droit de lancer une seconde série —
    // mais il a cessé d'être ce qui saute aux yeux.
    expect(screen.queryByRole("button", { name: /^Générer$/ })).toBeNull()
    expect(screen.getByRole("button", { name: /^Générer encore/ })).toBeTruthy()
    // **Jamais deux locataires à la fois** — la règle de la fente.
    expect(screen.queryByText("Ctrl + Entrée")).toBeNull()
  })

  test("le lien Générer encore relance vraiment, et repasse par l'écran", async () => {
    // Le bloc en route ne doit rien fermer : lancer une seconde série pendant
    // que la première court reste possible, et reste payant — donc il repasse
    // par l'écran qui fait relire.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))

    fireEvent.click(await screen.findByRole("button", { name: /^Générer encore/ }))

    expect(
      await screen.findByRole("button", { name: /^Payer et lancer/ }),
    ).toBeTruthy()
    // Relancer n'a rien payé de plus par lui-même : l'écran s'intercale.
    expect(
      double.appels.filter((a) => a.url === "/api/generations"),
    ).toHaveLength(1)
  })

  test("un refus l'emporte sur le lien, même pendant qu'un lot est en route", async () => {
    // La règle de la fente ne plie pas : quand rien ne peut partir, un lien
    // `Générer encore` mentirait sur le geste disponible. Le bloc au-dessus
    // continue de dire ce qui est en route — les deux ne disent pas la même
    // chose, et ils ne se disputent pas la même place.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))
    await screen.findByRole("status")

    // On vide le champ : il n'y a plus rien à envoyer. **Il faut le redemander**
    // — la barre de prompt est démontée pendant que l'écran de confirmation est
    // ouvert, donc le nœud d'avant le paiement n'est plus dans la page.
    const apres = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(apres, { target: { value: "" } })

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Générer encore/ })).toBeNull(),
    )
    // Ce qui est en route ne disparaît pas pour autant.
    expect(screen.getByRole("status").textContent).toContain("1 image en route")
  })

  test("l'onglet Galerie porte le compte, et il le porte depuis les autres onglets", async () => {
    // **La moitié qui traverse les onglets.** Le bloc en route vit dans la
    // barre de prompt, et cette barre suit les écrans qui paient — la galerie,
    // le codex, l'établi. Elle ne suit pas l'**Univers**, ni un établi dont
    // l'outil est ouvert, ni l'écran des dépenses : un écran qui ne peut pas
    // dépenser ne porte pas le champ qui dépense. C'est là qu'on croit que rien
    // ne s'est passé, puisque rien ne bouge — et c'est là que la pastille est
    // le seul témoin.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    // Au repos, l'onglet ne porte que son nom.
    expect(screen.getByRole("tab", { name: "Galerie" })).toBeTruthy()

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))

    const onglet = await screen.findByRole("tab", { name: /^Galerie · 1 image en route$/ })
    expect(onglet.textContent).toContain("1")

    // On part à l'Univers : la barre de prompt n'y est pas, donc le bloc en
    // route non plus. La pastille, elle, est dans la barre de tête — rendue sur
    // les trois lieux.
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
    expect(
      screen.getByRole("tab", { name: /^Galerie · 1 image en route$/ }),
    ).toBeTruthy()
  })

  // ── U9 · Il se lit d'un coup d'œil ────────────────────────────────────────
  //
  // **L'invariant est amendé, et l'amendement est mesuré ici.** L'écran promet
  // de montrer ce qui part *mot pour mot, sans coupure et sans résumé*, et la
  // séance du 1er septembre 2026 a montré la limite : le prompt réellement
  // employé dans ce dépôt fait plus de mille deux cents caractères, et un écran
  // qu'on doit parcourir d'un coup d'œil avant de payer ne le fait pas quand une
  // seule ligne l'occupe tout entier.
  //
  // Ce qui remplace la promesse est plus fort qu'elle : *rien n'est résumé, rien
  // n'est réécrit, et tout est atteignable en un clic depuis l'endroit où on le
  // lit.* Les deux essais du repli tiennent les deux moitiés — ce qui se cache
  // est annoncé, et ce qui se déplie est entier.

  /** Un texte de bible **plus long que le pli** — 320 caractères —, écrit comme
   *  ceux du dépôt : c'est celui du style, celui qui pèse 53 % de l'appel. */
  const LONG =
    "marais de fer, forge creusée sous la tourbe, brumes rousses au ras du sol, " +
    "lanternes de fonte accrochées aux poutres, escaliers de pierre noire luisants " +
    "d'humidité, enclumes tièdes, limaille en suspension dans l'air, palette de " +
    "vingt-quatre couleurs, contour sombre d'un pixel, éclairage rasant venu de la " +
    "gauche, fond uni, aucune perspective en fuite"

  const ENVOI_LONG: Envoi = {
    ...ENVOI,
    lignes: ENVOI.lignes.map((l) =>
      l.clef === "jeu.monde" ? { ...l, texte: LONG } : l,
    ),
  }

  /** Le cadre de l'écran ouvert. `within` ne rend que des requêtes ; ce qui se
   *  cherche par attribut a besoin du nœud lui-même. */
  const cadre = () => document.querySelector("[data-envoi]") as HTMLElement

  const textesQuiPartent = () =>
    Array.from(
      cadre().querySelectorAll("[data-texte-qui-part]"),
    ) as HTMLElement[]

  test("un texte long est replié, et son bouton dit ce qu'il cache", async () => {
    const { ecran } = await ouvrir({ envoi: ENVOI_LONG })

    const replie = textesQuiPartent().find((p) =>
      p.textContent!.startsWith("marais de fer"),
    )!
    // **Ce n'est pas une troncature muette** : le pli s'annonce, et il dit son
    // compte. Un « … » seul aurait été exactement ce que l'invariant interdit.
    expect(replie.textContent!.length).toBeLessThan(LONG.length)
    expect(replie.textContent).toContain("…")
    const bouton = ecran.getByRole("button", {
      name: /^déplier — \d+ caractères de plus$/,
    })
    const caches = Number(bouton.textContent!.match(/\d+/)![0])
    expect(caches).toBeGreaterThan(0)
    // La coupure tombe sur une fin de mot : le début replié est un préfixe
    // exact du texte, jamais un mot coupé en deux.
    const debut = replie.textContent!.replace(" …", "")
    expect(LONG.startsWith(debut)).toBe(true)
    expect(debut.length + caches).toBe(LONG.length)
  })

  test("déplié, le texte est entier — et le repli se referme", async () => {
    const { ecran } = await ouvrir({ envoi: ENVOI_LONG })

    fireEvent.click(
      ecran.getByRole("button", { name: /^déplier — \d+ caractères de plus$/ }),
    )

    // **Mot pour mot.** C'est la moitié de l'invariant qui n'a pas bougé : ce
    // qui se déplie est le texte du serveur, pas un résumé de lui.
    await waitFor(() =>
      expect(textesQuiPartent().some((p) => p.textContent === LONG)).toBe(true),
    )

    fireEvent.click(ecran.getByRole("button", { name: "replier" }))
    await waitFor(() =>
      expect(textesQuiPartent().some((p) => p.textContent === LONG)).toBe(false),
    )
  })

  test("chaque image jointe porte sa vignette, à côté de son prix", async () => {
    // L'écran qui décide de ce qui part ne montrait **aucune image** : les
    // références y étaient des lignes de texte avec un prix. On décochait de
    // mémoire.
    await ouvrir({ envoi: ENVOI })

    const vignettes = Array.from(
      cadre().querySelectorAll("[data-vignette-jointe]"),
    ) as HTMLElement[]
    expect(vignettes).toHaveLength(2)
    expect(
      vignettes[0].querySelector("img")!.getAttribute("src"),
    ).toContain("carte-officielle")
    // **Une image décochée est grisée comme son prix** — elle dit ce qui *ne*
    // partira pas, et son prix reste écrit : c'est ce qu'elle coûterait.
    expect(vignettes[0].className).not.toContain("opacity-40")
    expect(vignettes[1].className).toContain("opacity-40")
  })

  test("le pointeur sur une vignette et Espace l'ouvrent en grand", async () => {
    // **Le geste de l'aperçu, celui qui existe déjà partout ailleurs** et qui
    // n'a jamais de bouton pour l'annoncer. Aucun geste neuf n'est inventé ici.
    await ouvrir({ envoi: ENVOI })
    const ligne = cadre()
      .querySelector("[data-vignette-jointe]")!
      .closest("li")!

    fireEvent.pointerOver(ligne)
    fireEvent.keyDown(window, { key: " ", code: "Space" })

    const apercu = screen.getByRole("dialog", { name: "Aperçu" })
    expect(apercu.querySelector("img")!.getAttribute("src")).toContain(
      "carte-officielle",
    )

    fireEvent.keyDown(window, { key: " ", code: "Space" })
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Aperçu" })).toBeNull(),
    )

    // Et le pointeur sorti, la touche ne prend plus rien : elle ne garde pas la
    // dernière vignette survolée.
    fireEvent.pointerOut(ligne)
    fireEvent.keyDown(window, { key: " ", code: "Space" })
    expect(screen.queryByRole("dialog", { name: "Aperçu" })).toBeNull()
  })

  test("l'aperçu passe au-dessus de l'écran de confirmation", async () => {
    // **Comme au-dessus des autres écrans qui couvrent l'atelier.** Il ne le
    // remplace pas : on tient l'image une seconde, on la relâche, et l'écran
    // qu'on était en train de lire est intact, avec son bouton qui paie.
    const { ecran } = await ouvrir({ envoi: ENVOI })
    const ligne = cadre()
      .querySelector("[data-vignette-jointe]")!
      .closest("li")!

    fireEvent.pointerOver(ligne)
    fireEvent.keyDown(window, { key: " ", code: "Space" })

    const apercu = screen.getByRole("dialog", { name: "Aperçu" })
    // Il couvre la fenêtre entière et vit **hors** de l'écran de confirmation :
    // c'est ce qui fait qu'aucun défilement ni aucune colonne ne le rogne. La
    // mesure en pixels, elle, a été faite au navigateur — jsdom ne met rien en
    // page, donc tout rectangle y vaudrait zéro.
    expect(apercu.className).toContain("fixed")
    expect(apercu.className).toContain("inset-0")
    expect(apercu.className).toContain("z-50")
    const envoiOuvert = document.querySelector("[data-envoi]")!
    expect(envoiOuvert.contains(apercu)).toBe(false)
    expect(ecran.getByRole("button", { name: /^Payer et lancer/ })).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// U1 · L'argent ne part qu'une fois, et l'écran de confirmation se quitte
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : le seul défaut du lot des treize qui coûtait de
// l'argent réel. Cinq clics rapides sur *Payer et lancer* lançaient cinq appels
// payants, en silence. Le garde-fou existait pourtant côté serveur depuis T1 —
// une génération porte un identifiant, et le service rend *déjà soumise* sans
// rien facturer quand il revoit le même — mais **l'écran le jetait** : il
// fabriquait un identifiant neuf à chaque clic, donc chaque clic était une
// intention neuve, donc chacune se payait.
//
// Les essais ci-dessous mesurent les deux moitiés de la réparation : le verrou
// (un seul appel part, le bouton le dit, il ne redevient cliquable qu'en cas
// d'échec) et l'identifiant par intention (le même pour un appel retenté,
// différent dès que ce qui part change). Plus la seconde moitié de l'étape :
// l'écran de confirmation se quitte en changeant d'onglet.

describe("l'argent ne part qu'une fois", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Les corps réellement partis sur la route qui paie, dans l'ordre.
   *
   *  On les lit sur le double lui-même et non sur son journal `appels` : le
   *  journal est écrit *après* la porte ci-dessous, et un essai qui retient la
   *  réponse ne verrait rien tant qu'il ne l'a pas relâchée. Ce qu'on mesure
   *  est **combien de fois l'écran a appelé**, ce qui est la question. */
  const partis = (fetchDouble: ReturnType<typeof vi.fn>) =>
    fetchDouble.mock.calls
      .filter(
        ([url, init]) =>
          String(url) === "/api/generations" &&
          (init as RequestInit | undefined)?.method === "POST",
      )
      .map(([, init]) =>
        JSON.parse(String((init as RequestInit).body)),
      ) as { identifiant: string; prompt: string }[]

  /** Un double dont la route qui paie **ne répond que sur ordre**, et peut
   *  refuser une fois.
   *
   *  Sans lui, la réponse arrive dans le même tour de boucle que le clic et
   *  l'état « ça paie » ne dure pas assez pour être lu. Avec, l'attente est
   *  celle d'un vrai appel : plusieurs secondes, pendant lesquelles l'auteur a
   *  tout le temps de recliquer — c'est très exactement ce qu'il a fait. */
  const doubleQuiRetient = (
    options: Parameters<typeof serveurDouble>[0] = {},
    { refuseUneFois = false } = {},
  ) => {
    const socle = serveurDouble(options)
    let ouvrirLaPorte: (() => void) | null = null
    let dejaRefuse = false
    const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
      if (String(chemin) === "/api/generations" && init?.method === "POST") {
        await new Promise<void>((resoudre) => {
          ouvrirLaPorte = resoudre
        })
        if (refuseUneFois && !dejaRefuse) {
          dejaRefuse = true
          return {
            ok: false,
            status: 409,
            json: async () => ({
              code: "generation_refusee",
              raison: "le fournisseur n'a pas répondu",
              ou_aller: null,
            }),
          } as unknown as Response
        }
      }
      return socle.fetchDouble(chemin, init)
    })
    return {
      ...socle,
      fetchDouble,
      /** Laisser la réponse arriver, et attendre qu'elle soit traitée. */
      repondre: async () => {
        await act(async () => {
          ouvrirLaPorte?.()
          ouvrirLaPorte = null
          await Promise.resolve()
        })
      },
      /** Vrai tant que l'appel est en vol — la porte n'a pas encore été
       *  ouverte. */
      retenu: () => ouvrirLaPorte !== null,
    }
  }

  /** Monter l'atelier, écrire un sujet, ouvrir l'écran de confirmation. */
  const ouvrir = async (double: { fetchDouble: ReturnType<typeof vi.fn> }) => {
    await monter(double.fetchDouble)
    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un forgeron nain" } })
    await waitFor(() => expect(champ.value).toBe("un forgeron nain"))
    return await relire()
  }

  // ── « Cinq clics consécutifs ne produisent qu'un seul appel payé » ─────────

  test("cinq clics sur le bouton qui paie ne lancent qu'un seul appel", async () => {
    // **Le geste exact du relevé** : l'auteur a cliqué cinq fois parce que rien
    // ne bougeait, et il a payé cinq fois.
    const double = doubleQuiRetient()
    const ecran = await ouvrir(double)

    const bouton = ecran.getByRole("button", { name: /^Payer et lancer/ })
    for (let i = 0; i < 5; i++) fireEvent.click(bouton)

    expect(partis(double.fetchDouble)).toHaveLength(1)
    await double.repondre()
    expect(partis(double.fetchDouble)).toHaveLength(1)
  })

  test("deux clics dans la même image de rendu ne lancent qu'un seul appel", async () => {
    // **Le cas que le grisé ne rattrape pas.** Un bouton grisé l'est au rendu
    // *suivant* ; deux clics partis avant ce rendu-là traversent tous les deux
    // le gestionnaire. C'est le repère lu et écrit dans le même tour de boucle
    // qui arrête le second, et c'est lui que cet essai mesure — les deux
    // événements sont posés dans un seul `act`, donc sans rendu entre eux.
    const double = doubleQuiRetient()
    const ecran = await ouvrir(double)

    const bouton = ecran.getByRole("button", { name: /^Payer et lancer/ })
    act(() => {
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(partis(double.fetchDouble)).toHaveLength(1)
    await double.repondre()
    expect(partis(double.fetchDouble)).toHaveLength(1)
  })

  // ── « Pendant l'appel, le bouton dit qu'il paie et n'est plus cliquable » ──

  test("le bouton dit qu'il paie, et l'écran ne se quitte plus", async () => {
    const double = doubleQuiRetient()
    const ecran = await ouvrir(double)

    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))

    const bouton = (await ecran.findByRole("button", {
      name: /Paiement en cours/,
    })) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    // Et *revenir sans rien dépenser* ne ment plus : la dépense est partie.
    const revenir = ecran.getByRole("button", {
      name: /il ne se rattrape plus/,
    }) as HTMLButtonElement
    expect(revenir.disabled).toBe(true)

    // L'appel revient : l'écran se referme avec lui.
    await double.repondre()
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
  })

  test("un appel qui échoue rend le bouton, et garde la même intention", async () => {
    // **Les deux moitiés d'un même critère.** Le bouton ne redevient cliquable
    // que si l'appel échoue — c'est le seul cas où il y a quelque chose à
    // refaire. Et ce qu'on refait est la *même* intention : rien n'a été
    // enregistré, donc l'identifiant ne bouge pas.
    const double = doubleQuiRetient({}, { refuseUneFois: true })
    const ecran = await ouvrir(double)

    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await ecran.findByRole("button", { name: /Paiement en cours/ })
    await double.repondre()

    // Le bouton est rendu, et l'écran est resté : il n'y a rien à fermer.
    const bouton = await ecran.findByRole("button", { name: /^Payer et lancer/ })
    expect((bouton as HTMLButtonElement).disabled).toBe(false)
    expect(document.querySelector("[data-envoi]")).toBeTruthy()

    fireEvent.click(bouton)
    await double.repondre()

    const deux = partis(double.fetchDouble)
    expect(deux).toHaveLength(2)
    expect(deux[0].identifiant).toBe(deux[1].identifiant)
  })

  // ── « Deux appels réellement différents restent deux appels » ──────────────

  test("changer ce qui part refait l'identifiant", async () => {
    // **La contrepartie du verrou, et elle est indispensable.** Un identifiant
    // qui ne bougerait jamais ferait rendre *déjà soumise* par le serveur au
    // second appel : deux images voulues, une seule payée, et rien ne le dirait.
    const double = doubleQuiRetient({}, { refuseUneFois: true })
    const ecran = await ouvrir(double)

    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await double.repondre()
    await ecran.findByRole("button", { name: /^Payer et lancer/ })

    // On corrige une ligne : ce qui part n'est plus le même, donc l'intention
    // non plus.
    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText(/^Corriger /), {
      target: { value: "marais de rouille" },
    })
    await waitFor(() => expect(ecran.getByText("corrigé pour cet appel")).toBeTruthy())

    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await double.repondre()

    const deux = partis(double.fetchDouble)
    expect(deux).toHaveLength(2)
    expect(deux[0].identifiant).not.toBe(deux[1].identifiant)
  })

  test("deux fois la même demande sont deux appels, pas un", async () => {
    // **L'intention est consommée quand elle part.** Refaire exactement la même
    // image est un geste légitime — c'est même le geste courant, on cherche une
    // variante —, et le réemploi de l'identifiant l'aurait avalé en silence.
    const double = doubleQuiRetient()
    const ecran = await ouvrir(double)

    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await double.repondre()
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())

    const encore = await relire()
    fireEvent.click(encore.getByRole("button", { name: /^Payer et lancer/ }))
    await double.repondre()

    const deux = partis(double.fetchDouble)
    expect(deux).toHaveLength(2)
    expect(deux[0].prompt).toBe(deux[1].prompt)
    expect(deux[0].identifiant).not.toBe(deux[1].identifiant)
  })

  // ── « Le raccourci qui paie sans passer par l'écran porte le même verrou » ─

  test("le raccourci d'une série sautée porte le même verrou", async () => {
    // **Il paie directement**, sans écran entre le bouton et la dépense : le
    // verrou doit donc être là aussi, sinon on aurait réparé la moitié du
    // chemin et laissé l'autre ouverte.
    const double = doubleQuiRetient({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(etabli.getByRole("button", { name: "Fabriquer repos" }))
    await ecrireLeSujet("un forgeron nain")

    const ecran = await relire()
    fireEvent.click(ecran.getByLabelText("ne plus me le montrer pour cette série"))
    fireEvent.click(ecran.getByRole("button", { name: /^Payer et lancer/ }))
    await double.repondre()
    await waitFor(() => expect(partis(double.fetchDouble)).toHaveLength(1))

    // On réarme la même case : l'écran se saute, et le bouton qui lance paie
    // directement. Le premier appel étant encore en route, c'est *Générer
    // encore* qui porte le geste — l'état a pris la place du bouton.
    const encore = await ouvrirLEtabli("Le nain")
    fireEvent.click(encore.getByRole("button", { name: "Fabriquer repos" }))
    const bouton = await screen.findByRole("button", { name: /^Générer encore/ })
    act(() => {
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(partis(double.fetchDouble)).toHaveLength(2)

    // Et il le dit, là aussi.
    expect(await screen.findByRole("button", { name: /paiement en cours/i })).toBeTruthy()
    await double.repondre()
    expect(partis(double.fetchDouble)).toHaveLength(2)
  })

  // ── « Changer d'onglet ferme l'écran de confirmation, sans rien dépenser » ─

  test("les trois onglets ferment l'écran de confirmation", async () => {
    // **On était enfermé.** Cliquer *Galerie* changeait le fil d'Ariane et
    // laissait l'écran en place — un écran qu'aucun onglet ne pouvait fermer.
    // Changer d'onglet remonte de toute profondeur : c'était déjà vrai de la
    // découpe, des dépenses, de l'établi et des tables.
    for (const onglet of ["Galerie", "Univers", "Codex"]) {
      const double = serveurDouble()
      await monter(double.fetchDouble)
      const champ = (await champDePrompt()) as HTMLTextAreaElement
      fireEvent.change(champ, { target: { value: "un forgeron nain" } })
      await relire()

      fireEvent.click(screen.getByRole("tab", { name: onglet }))
      await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
      expect(screen.getByRole("tab", { name: onglet }).getAttribute("aria-selected")).toBe(
        "true",
      )
      expect(
        double.appels.filter((a) => a.url === "/api/generations" && a.corps),
      ).toEqual([])
      cleanup()
      FluxDouble.ouverts = []
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// U2 · Le zoom de l'atelier, et le recadrage qui en dépendait
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : la moitié de l'étape qui ne se voit qu'à l'écran.
// Que l'image s'ouvre entière quel que soit son format — c'est le défaut qui a
// fait croire que la table de recadrage était cassée : une image d'origine de
// 1 024 px dans un cadre de 606 × 626 ne pouvait pas descendre sous cent pour
// cent, on n'en voyait qu'un coin, et ce coin étant transparent, l'écran ne
// montrait que le damier. Que la molette approche et recule sans faire défiler
// la page. Et que la table de recadrage montre les deux rectangles ensemble —
// celui qu'on trace et celui que le rendu garde, marge comprise.
//
// **Ce qui se mesure vit côté serveur, dans `tests/test_u2.py`** : la boîte du
// sujet, le rectangle obtenu, la part jetée, les bords touchés et ce qu'une
// boîte tracée coupe. C'est la répartition ordinaire du dépôt — l'écran prouve
// qu'il montre, le serveur prouve qu'il mesure.

describe("le zoom de la table", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  const ouvrirUneTable = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    images = [asset("bbbb2222-0", "le nain, au repos")],
  ) => {
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)], ...options })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const boiteDeLImage = () =>
    document.querySelector("[data-boite-image]") as HTMLElement

  /** Le cadre qui défile — le parent de la boîte, et celui qui porte la
   *  molette. `jsdom` rend zéro pour toute mesure de mise en page : l'essai
   *  double donc les deux dimensions, comme il double déjà celles de la grille
   *  et de l'aperçu. */
  const poserLeCadre = (largeur: number, hauteur: number) => {
    const noeud = boiteDeLImage().parentElement as HTMLElement
    Object.defineProperty(noeud, "clientWidth", {
      value: largeur,
      configurable: true,
    })
    Object.defineProperty(noeud, "clientHeight", {
      value: hauteur,
      configurable: true,
    })
    fireEvent(window, new Event("resize"))
    return noeud
  }

  // ── « Une image de 1 024 px s'ouvre entière dans le cadre » ────────────────

  test("une image plus grande que le cadre s'ouvre entière", async () => {
    // **Les mesures sont celles de la machine de l'auteur** : l'image fait
    // 1 024 px de côté, le cadre en offre 606 sur 626, garde comprise. Le
    // calcul d'avant plafonnait à un plancher de cent pour cent, donc la boîte
    // faisait 1 024 px dans un cadre de 606 — on voyait un coin.
    await ouvrirUneTable()
    // 654 − 48 de garde = 606 ; 674 − 48 = 626.
    poserLeCadre(654, 674)

    // 606 / 1 024 fait 59 %, et 1 024 px à 59 % font 604 px : l'image entière
    // dans le cadre, ce que le plancher à cent pour cent interdisait.
    await waitFor(() => {
      expect(boiteDeLImage().style.width).toBe("604px")
    })
    expect(Number.parseInt(boiteDeLImage().style.width, 10)).toBeLessThanOrEqual(606)
    expect(Number.parseInt(boiteDeLImage().style.height, 10)).toBeLessThanOrEqual(626)
  })

  test("ajusté descend sous cent pour cent, et le dit", async () => {
    const { cadre } = await ouvrirUneTable()
    poserLeCadre(654, 674)

    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement
    // Le champ suit le zoom effectif, y compris en ajusté : un champ vide
    // pendant qu'on regarde une image à 59 % laisserait deviner le nombre.
    await waitFor(() => expect(Number(champ.value)).toBeLessThan(100))
    expect(Number(champ.value)).toBeGreaterThan(0)
  })

  // ── « La molette approche et recule, et ne fait plus défiler la page » ─────

  test("la molette approche, recule, et arrête le défilement de la page", async () => {
    const { cadre } = await ouvrirUneTable()
    const noeud = poserLeCadre(654, 674)
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement
    fireEvent.click(cadre.getByRole("button", { name: "100 %" }))
    expect(champ.value).toBe("100")

    // **Un écouteur natif, non passif.** React pose ses écouteurs de molette en
    // passif sur la racine : `preventDefault` y serait ignoré et la page
    // défilerait derrière le zoom.
    const approcher = new WheelEvent("wheel", {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    })
    noeud.dispatchEvent(approcher)
    expect(approcher.defaultPrevented).toBe(true)
    await waitFor(() => expect(Number(champ.value)).toBeGreaterThan(100))

    const reculer = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    })
    noeud.dispatchEvent(reculer)
    await waitFor(() => expect(Number(champ.value)).toBe(100))
  })

  // ── « Le rectangle tracé et le rectangle obtenu sont visibles ensemble » ───

  test("la marge s'ajoute à la boîte tracée, et les deux rectangles se voient", async () => {
    // **C'est le comportement voulu, et rien ne le montrait** : on dessinait un
    // rectangle, le rendu en gardait un autre, et aucun des deux n'était faux.
    const { cadre } = await ouvrirUneTable({
      mesures: {
        recadrage: {
          origine: [1024, 1024],
          sujet: [256, 256, 768, 768],
          tracee: [300, 300, 700, 700],
          obtenue: [288, 288, 712, 712],
          jete: 0.8283,
          bords: [],
          coupe: { gauche: 32, haut: 32, droite: 56, bas: 56 },
        },
      },
    })

    fireEvent.click(
      cadre.getByRole("button", { name: /^recadrage/ }),
    )
    await waitFor(() =>
      expect(document.querySelector("[data-cadre-recadrage]")).toBeTruthy(),
    )
    // Le rectangle obtenu est en pointillé, le tracé plein : les deux sont là.
    expect(document.querySelector("[data-boite-obtenue]")).toBeTruthy()
    const obtenue = document.querySelector("[data-boite-obtenue]") as HTMLElement
    expect(obtenue.style.left).toBe(`${(288 / 1024) * 100}%`)
    expect(obtenue.className).toContain("border-dashed")
  })

  test("la table écrit ce qu'elle garde, sa provenance et la part jetée", async () => {
    const { cadre } = await ouvrirUneTable({
      mesures: {
        recadrage: {
          origine: [1024, 1024],
          sujet: [356, 0, 667, 823],
          tracee: null,
          obtenue: [356, 0, 667, 823],
          jete: 0.7551,
          bords: ["haut"],
          coupe: {},
        },
      },
    })

    fireEvent.click(cadre.getByRole("button", { name: /^recadrage/ }))

    // Les deux valeurs, et la seconde indisponible tant que rien n'est tracé :
    // on ne la choisit pas dans la colonne, on trace et le segment bascule.
    expect(await cadre.findByRole("button", { name: "la boîte du sujet" })).toBeTruthy()
    const tracee = cadre.getByRole("button", {
      name: "une boîte tracée",
    }) as HTMLButtonElement
    expect(tracee.disabled).toBe(true)

    // Les coordonnées, avec leur provenance.
    expect(cadre.getByText(/mesurée sur l'alpha · 356,0 → 667,823/)).toBeTruthy()
    // La mesure utile de la table : ce que le fichier jette, à côté du couple
    // avant / après — une taille seule ne dit pas ce qu'on a enlevé.
    const mesure = cadre.getByText(/de l'image d'origine est jeté/)
    expect(mesure.textContent).toContain("1024×1024")
    expect(mesure.textContent).toContain("312×824")
    expect(mesure.textContent).toContain("76 %")
    // Et ce qu'elle a vu et qui n'est pas un réglage : le modèle a peint le
    // sujet contre le bord haut.
    expect(cadre.getByText(/le sujet touche le bord haut/)).toBeTruthy()
  })

  test("une boîte tracée plus large que le sujet le dit, au lieu de laisser croire", async () => {
    // **La phrase importante de la table.** Une boîte plus large que le sujet
    // est sans effet sur le rendu : la remise sur grille recherche elle-même la
    // boîte du sujet et rogne dessus. La dire évite de croire qu'on a réglé
    // quelque chose.
    const image = {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: { ...RECETTE_VIDE, recadrage: { marge: 0, boite: [10, 10, 900, 900] } },
    } as Asset
    const { cadre } = await ouvrirUneTable(
      {
        mesures: {
          recadrage: {
            origine: [1024, 1024],
            sujet: [256, 256, 768, 768],
            tracee: [10, 10, 900, 900],
            obtenue: [10, 10, 900, 900],
            jete: 0.2437,
            bords: [],
            coupe: {},
          },
        },
      },
      [image],
    )

    fireEvent.click(cadre.getByRole("button", { name: /^recadrage/ }))
    expect(
      await cadre.findByText(/plus large que le sujet · sans effet sur le rendu/),
    ).toBeTruthy()
    // Et la provenance passe du constat au tracé.
    expect(cadre.getByText(/tracée à la main/)).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// U11 · La main peint carré, et là où on la pose
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : la seconde moitié de l'étape, celle qui est une
// affaire de mise en page. Le trait tombait à quelques pixels de l'endroit visé,
// et l'auteur soupçonnait le recadrage.
//
// **La vérification a rendu une réponse plus simple que l'hypothèse, et elle
// est mesurée** — voir `docs/tranches/U.md`, U11. Deux mécanismes pouvaient
// décaler le geste, et un seul mordait vraiment sur cette machine :
//
// 1. *La surface qui ment sur l'image qu'elle porte.* Réel, et corrigé pour les
//    trois surfaces — le rectangle de recadrage, la pipette, le pinceau ; mais
//    **mesuré à un huitième de pixel** sur l'image de la séance, parce que
//    l'atelier tient ses mesures de rendu à jour. C'est un défaut qui attend son
//    heure, pas celui qu'on a vu.
// 2. *Le curseur qui suit le pointeur au lieu de la grille.* Celui-là mord tout
//    de suite : le carré peint est centré sur le pixel **plancher** du pointeur,
//    donc jusqu'à un demi-pixel d'image à gauche et en haut de là où le cercle
//    se dessinait — à seize fois, huit pixels d'écran. C'est le symptôme du
//    relevé, au mot près.
//
// Ce qui se mesure sur des pixels — la forme carrée, les bouts, les joints, le
// bord du cadre — est tenu par `tests/test_u11.py`.

describe("la main peint carré, et là où on la pose", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  /** La table de la main, ouverte sur une image dont le **rendu n'a pas les
   *  proportions du brut** — c'est ce qu'un recadrage fabrique, et c'est le cas
   *  où la surface et l'image cessent de coïncider. */
  const ouvrirLaMain = async (rendu = { largeur: 64, hauteur: 64 }) => {
    const image = {
      ...asset("bbbb2222-0", "le nain, au repos"),
      rendu_largeur: rendu.largeur,
      rendu_hauteur: rendu.hauteur,
    } as Asset
    const double = serveurDouble({ personnages: [AVEC_IMAGE([image])] })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${image.label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    fireEvent.click(cadre.getByRole("button", { name: /^la main/ }))
    const toile = await waitFor(() => {
      const noeud = document.querySelector("[data-toile-main]")
      if (!noeud) throw new Error("la toile de la main ne s'est pas ouverte")
      return noeud as HTMLElement
    })
    return { ...double, cadre, toile, rendu }
  }

  /** Poser une surface **plus large que l'image ne l'occupe**, et rendre de quoi
   *  viser un pixel d'image donné.
   *
   *  C'est la panne qu'on mesure : la surface est dimensionnée d'après les
   *  mesures que l'atelier garde ; l'image est posée dedans en *tenant dans le
   *  cadre*, donc centrée avec des bandes vides de chaque côté. */
  const poserLaSurface = (
    toile: HTMLElement,
    surface: { largeur: number; hauteur: number },
    image: { largeur: number; hauteur: number },
  ) => {
    toile.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: surface.largeur,
        height: surface.hauteur,
      }) as DOMRect
    const echelle = Math.min(
      surface.largeur / image.largeur,
      surface.hauteur / image.hauteur,
    )
    const rendue = { l: image.largeur * echelle, h: image.hauteur * echelle }
    const gauche = (surface.largeur - rendue.l) / 2
    const haut = (surface.hauteur - rendue.h) / 2
    /** Le centre à l'écran du pixel `(x, y)` de l'image. */
    return (x: number, y: number) => ({
      clientX: gauche + ((x + 0.5) / image.largeur) * rendue.l,
      clientY: haut + ((y + 0.5) / image.hauteur) * rendue.h,
    })
  }

  const dernierPassage = (appels: { url: string; corps: unknown }[]) => {
    const envoi = appels.filter((a) => a.url.includes("/recipe")).pop()
    const main = (envoi?.corps as { main?: { opacite?: { points: number[][] }[] } })
      ?.main
    return main?.opacite?.at(-1)?.points ?? null
  }

  // ── « L'écart est mesuré avant correction, puis après, et il vaut zéro » ───

  test("le trait tombe sur le pixel visé, même quand la surface ment", async () => {
    // **La surface fait 600 × 400 pour une image de 64 × 64.** L'image y est
    // donc dessinée en 400 × 400, centrée : cent pixels de bande vide à gauche
    // et autant à droite. L'ancien calcul mesurait la surface — il aurait rendu
    // `(clientX / 600) × 64`, soit **seize pixels d'image trop à droite** au
    // milieu du cadre. Le nouveau lit dans le rectangle de l'image.
    const { toile, appels } = await ouvrirLaMain()
    const viser = poserLaSurface(toile, { largeur: 600, hauteur: 400 }, { largeur: 64, hauteur: 64 })

    const { clientX, clientY } = viser(20, 30)
    fireEvent.pointerDown(toile, { button: 0, clientX, clientY, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })

    await waitFor(() => expect(dernierPassage(appels)).toEqual([[20, 30]]))

    // **Et l'écart de l'ancien calcul, mesuré sur les mêmes clics.** Il mesurait
    // la surface : `(clientX / 600) × 64` au lieu de `((clientX − 100) / 400) ×
    // 64`. L'écart est nul au centre et croît vers les bords, dans un sens à
    // gauche et dans l'autre à droite — quatre pixels d'image ici, dix au bord
    // droit. C'est ce qui rendait le défaut difficile à décrire : il ne se
    // comportait pas comme un décalage constant.
    expect(Math.floor((clientX / 600) * 64) - 20).toBe(4)
    const aDroite = viser(63, 30)
    expect(Math.floor((aDroite.clientX / 600) * 64) - 63).toBe(-10)
  })

  test("un clic au bord de l'image marque un pixel du bord, et non le voisin", async () => {
    const { toile, appels } = await ouvrirLaMain()
    const viser = poserLaSurface(toile, { largeur: 600, hauteur: 400 }, { largeur: 64, hauteur: 64 })

    const { clientX, clientY } = viser(63, 63)
    fireEvent.pointerDown(toile, { button: 0, clientX, clientY, pointerId: 1 })
    fireEvent.pointerUp(toile, { pointerId: 1 })
    await waitFor(() => expect(dernierPassage(appels)).toEqual([[63, 63]]))
  })

  test("le trait tombe juste quel que soit le zoom", async () => {
    // **Y compris sous cent pour cent**, que U2 vient d'ouvrir : le calcul ne
    // connaît pas le zoom, il lit le rectangle qu'il a sous les yeux, et c'est
    // précisément ce qui le rend indifférent à l'échelle.
    for (const cote of [37, 64, 512]) {
      const { toile, appels } = await ouvrirLaMain()
      const viser = poserLaSurface(
        toile,
        { largeur: cote, hauteur: Math.round(cote * 1.37) },
        { largeur: 64, hauteur: 64 },
      )
      const { clientX, clientY } = viser(11, 42)
      fireEvent.pointerDown(toile, { button: 0, clientX, clientY, pointerId: 1 })
      fireEvent.pointerUp(toile, { pointerId: 1 })
      await waitFor(() => expect(dernierPassage(appels)).toEqual([[11, 42]]))
      cleanup()
      FluxDouble.ouverts = []
    }
  })

  // ── « Le curseur est le carré exact que le prochain passage couvrira » ─────

  test("le curseur est un carré calé sur le pixel visé, pas un cercle sous le pointeur", async () => {
    // **C'est le mécanisme qui mordait vraiment.** Le cercle suivait le
    // pointeur ; le carré peint est centré sur le pixel plancher. À seize fois,
    // un demi-pixel d'image fait huit pixels d'écran, et le trait paraissait
    // tomber en haut à gauche de ce qu'on visait.
    const { toile } = await ouvrirLaMain()
    const viser = poserLaSurface(toile, { largeur: 640, hauteur: 640 }, { largeur: 64, hauteur: 64 })

    // On vise le pixel (20, 30), mais **en son coin bas-droit** — l'endroit où
    // le cercle et le carré divergeaient le plus.
    const bord = viser(20, 30)
    fireEvent.pointerMove(toile, {
      clientX: bord.clientX + 4,
      clientY: bord.clientY + 4,
      pointerId: 1,
    })

    const curseur = await waitFor(() => {
      const noeud = document.querySelector("[data-curseur-main]")
      if (!noeud) throw new Error("pas de curseur")
      return noeud as HTMLElement
    })
    // Carré, et non rond.
    expect(curseur.className).not.toContain("rounded-full")
    // **Calé sur la grille de l'image**, et centré sur le pixel visé : c'est la
    // promesse « le carré exact que le prochain passage couvrira ». Sa largeur
    // est impaire en pixels d'image, donc son centre tombe au milieu de la case
    // — et non sous le pointeur, qui est quatre pixels d'écran plus loin.
    const enPourCent = (valeur: string) => Number.parseFloat(valeur)
    const largeur = enPourCent(curseur.style.width)
    const centreX = enPourCent(curseur.style.left) + largeur / 2
    const centreY = enPourCent(curseur.style.top) + enPourCent(curseur.style.height) / 2
    expect(centreX).toBeCloseTo((20.5 / 64) * 100, 6)
    expect(centreY).toBeCloseTo((30.5 / 64) * 100, 6)
    // Et sa largeur est un nombre impair de pixels d'image — la forme du
    // pinceau, pas une approximation.
    expect(Math.round((largeur / 100) * 64) % 2).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// U3 · Un curseur prend un chiffre
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : le champ où la valeur d'un curseur s'écrit. Le
// geste d'origine reste le bon — on fait glisser, on regarde — mais il ne suffit
// pas quand on connaît déjà le nombre : refaire à la souris un réglage qu'on a
// noté sur l'image d'à côté est une punition, et aucun logiciel d'image ne
// l'impose.
//
// **Un seul composant les porte tous** — dix-sept emplois sur sept écrans —, et
// c'est pour cela que l'étape est courte : la correction se fait une fois et se
// voit partout. Les essais ci-dessous éprouvent donc le composant à travers deux
// de ses emplois, et non les dix-sept : ce qui se répète n'a pas à se mesurer
// dix-sept fois, il a à n'exister qu'une fois.

describe("un curseur prend un chiffre", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  /** La table du détourage, qui porte deux curseurs : la tolérance et le seuil
   *  alpha. C'est l'emploi le plus courant du composant, et celui où un envoi
   *  de trop coûte le plus cher — une passe de détourage se recalcule. */
  const ouvrirLeDetourage = async () => {
    const images = [
      {
        ...asset("bbbb2222-0", "le nain, au repos"),
        recette: {
          ...RECETTE_VIDE,
          passes: [
            {
              moteur: "bord" as const,
              tolerance: 28,
              seuil_alpha: 128,
              durcissement: 0,
              point: null,
              portee: "tache" as const,
              masquee: false as const,
              trace: [],
              modele: "",
            },
          ],
        },
      } as Asset,
    ]
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)] })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const recettesPosees = (appels: { url: string; corps: unknown }[]) =>
    appels.filter((a) => a.url.includes("/recipe"))

  // ── « Chaque réglage à curseur porte un champ, et les deux disent la même
  //     chose » ────────────────────────────────────────────────────────────────

  test("le champ porte la valeur du curseur, et il porte son nom", async () => {
    const { cadre } = await ouvrirLeDetourage()

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    // Le champ montre la valeur du curseur — il ne tient pas un second état.
    expect(champ.value).toBe("28")
    // Et il n'a pas fallu l'écrire dix-sept fois : le nom descend de la rangée
    // qui porte le réglage.
    expect(cadre.getByLabelText("seuil alpha, en chiffres")).toBeTruthy()
  })

  // ── « Un chiffre écrit produit un seul envoi, comme un relâchement » ───────

  test("un chiffre écrit vaut un relâchement — un seul envoi", async () => {
    // **La règle de T2, appliquée à l'autre façon de régler.** Un envoi par
    // frappe ferait trois appels pour « 128 », dont deux sur des valeurs que
    // personne n'a demandé à voir — et une passe de détourage coûte deux
    // secondes au serveur.
    const { cadre, appels } = await ouvrirLeDetourage()
    const avant = recettesPosees(appels).length

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "64" } })
    // Rien n'est parti pendant la frappe.
    expect(recettesPosees(appels).length).toBe(avant)

    fireEvent.keyDown(champ, { key: "Enter" })
    await waitFor(() => expect(recettesPosees(appels).length).toBe(avant + 1))
    const pose = recettesPosees(appels).at(-1)!.corps as {
      passes: { tolerance: number }[]
    }
    expect(pose.passes[0].tolerance).toBe(64)
    // Et le curseur a suivi : les deux disent toujours la même chose.
    await waitFor(() => expect(champ.value).toBe("64"))
  })

  // ── « Entrée valide, Échap rend la valeur d'avant, quitter vaut Entrée » ───

  test("Échap rend la valeur d'avant, sans rien envoyer", async () => {
    const { cadre, appels } = await ouvrirLeDetourage()
    const avant = recettesPosees(appels).length

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "7" } })
    fireEvent.keyDown(champ, { key: "Escape" })

    expect(champ.value).toBe("28")
    expect(recettesPosees(appels).length).toBe(avant)
  })

  test("quitter le champ vaut Entrée", async () => {
    // **Sans quoi une valeur tapée puis abandonnée resterait à l'écran sans
    // agir** : le champ dirait une chose et l'image en montrerait une autre.
    const { cadre, appels } = await ouvrirLeDetourage()
    const avant = recettesPosees(appels).length

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "12" } })
    fireEvent.blur(champ)

    await waitFor(() => expect(recettesPosees(appels).length).toBe(avant + 1))
    expect(
      (recettesPosees(appels).at(-1)!.corps as { passes: { tolerance: number }[] })
        .passes[0].tolerance,
    ).toBe(12)
  })

  // ── « Une valeur hors bornes est ramenée, et le dit » ──────────────────────

  test("une valeur hors bornes est ramenée dans les bornes, et la table le dit", async () => {
    // **Ramener plutôt que refuser.** Un champ qui rejette une frappe oblige à
    // deviner ce qu'il accepte ; un champ qui ramène le dit en affichant la
    // valeur retenue et ses bornes.
    const { cadre } = await ouvrirLeDetourage()

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "900" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    // La tolérance va de zéro à cent vingt : neuf cents devient cent vingt, et
    // la ligne dessous dit les deux bornes plutôt que la seule qu'on a touchée.
    expect(await cadre.findByText(/ramené à 120 — les bornes sont 0 et 120/)).toBeTruthy()
    await waitFor(() => expect(champ.value).toBe("120"))
  })

  // ── « Taper un chiffre pendant qu'on tient le curseur remplit le champ » ───

  test("taper un chiffre sur le curseur remplit le champ sans qu'on l'ait visé", async () => {
    // **Le geste des logiciels d'image.** La main est sur le curseur, l'œil est
    // sur l'image : viser un champ de quarante-six pixels pour écrire un nombre
    // qu'on connaît déjà casse le geste.
    const { cadre } = await ouvrirLeDetourage()

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    const glissiere = cadre.getAllByRole("slider")[0]
    fireEvent.keyDown(glissiere, { key: "9" })

    await waitFor(() => expect(champ.value).toBe("9"))
    // Les flèches, elles, continuent de faire vivre le curseur : on ne détourne
    // que les chiffres.
    fireEvent.keyDown(glissiere, { key: "ArrowRight" })
    expect(champ.value).toBe("9")
  })
})

// ── U4 · Une table s'éteint, et ça se voit ───────────────────────────────────
//
// **Le carré de la barre était une marque ; il devient un interrupteur.** Il
// disait déjà *cette place change l'image*, et rien ne permettait d'arrêter une
// place sans la vider — c'est-à-dire sans perdre ses réglages. Ce qui se mesure
// en pixels — *une place endormie sort identique à la même sans cette place du
// tout* — vit dans `tests/test_u4.py` ; ce qui se voit vit ici.
//
// Quatre choses, et ce sont les quatre premiers critères de l'étape : le clic
// qui éteint et rallume, les **trois** états du carré — posée, vide, éteinte —,
// la colonne visiblement éteinte avec son geste, et le réveil qui s'annonce.

describe("une table s'éteint, et ça se voit", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const AVEC_IMAGE = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  const PASSE = {
    moteur: "bord" as const,
    tolerance: 28,
    seuil_alpha: 128,
    durcissement: 0,
    point: null,
    portee: "tache" as const,
    masquee: false as const,
    trace: [],
    modele: "",
  }

  /** Une image dont **deux** places portent une valeur et une troisième non.
   *
   *  Le détourage et la grille, parce qu'il en faut deux pour vérifier qu'on
   *  n'éteint que celle qu'on a visée ; les bords vides, parce que le critère
   *  demande que *éteinte* et *vide* se distinguent, ce qui suppose d'avoir les
   *  deux sous les yeux en même temps. */
  const ouvrirLesTables = async (veille: Recette["veille"] = []) => {
    const images = [
      {
        ...asset("bbbb2222-0", "le nain, au repos"),
        recette: {
          ...RECETTE_VIDE,
          passes: [PASSE],
          grille: {
            cible: 64,
            occupation: 100,
            ancrage: "bas" as const,
            decalage: 0,
            methode: "proche" as const,
          },
          veille,
        },
      } as Asset,
    ]
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)] })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const recettesPosees = (appels: { url: string; corps: unknown }[]) =>
    appels
      .filter((a) => a.url.includes("/recipe"))
      .map((a) => a.corps as Recette)

  const carreDe = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre.getByRole("switch", { name: new RegExp(nom) })

  // ── « La façon de réduire se change image par image » (D2) ─────────────────

  test("la façon de réduire se change sur une image, et part dans sa recette", async () => {
    // *« Je veux qu'on puisse choisir entre les 4 et changer en cours de route
    // dans l'atelier »* — l'auteur, 3 septembre 2026. Les quatre méthodes
    // rendent des sprites franchement différents ; le choix est un parti pris
    // de style, et il appartient à l'image autant qu'au projet.
    const { cadre, appels } = await ouvrirLesTables()
    fireEvent.click(cadre.getByRole("button", { name: /^grille/ }))

    // Ce que la méthode posée rend est dit sous les segments : un libellé de
    // trois mots ne dit pas ce qu'on gagne et ce qu'on perd.
    expect(await cadre.findByText(/un pixel sur N gardé/)).toBeTruthy()

    fireEvent.click(await cadre.findByRole("button", { name: "vote en deux temps" }))

    await waitFor(() =>
      expect(recettesPosees(appels).at(-1)?.grille?.methode).toBe("vote"),
    )
    expect(cadre.getByText(/contour net et intérieur lisible/)).toBeTruthy()
  })

  // ── « Cliquer le carré l'éteint ; recliquer la rallume » ───────────────────

  test("le carré éteint la place, et la rallume", async () => {
    const { cadre, appels } = await ouvrirLesTables()

    // Allumée au départ : le carré le dit, et il ne le dit qu'une fois.
    expect(carreDe(cadre, "détourage").getAttribute("aria-checked")).toBe("true")

    fireEvent.click(carreDe(cadre, "détourage"))
    await waitFor(() =>
      expect(recettesPosees(appels).at(-1)?.veille).toEqual(["detourage"]),
    )
    await waitFor(() =>
      expect(carreDe(cadre, "détourage").getAttribute("aria-checked")).toBe("false"),
    )

    fireEvent.click(carreDe(cadre, "détourage"))
    await waitFor(() => expect(recettesPosees(appels).at(-1)?.veille).toEqual([]))
    await waitFor(() =>
      expect(carreDe(cadre, "détourage").getAttribute("aria-checked")).toBe("true"),
    )
  })

  test("éteindre garde les réglages, et n'éteint que la place visée", async () => {
    // **C'est toute la différence avec *Sans cette table ›***, qui vide la
    // place. Une passe qu'on a réglée pendant dix minutes ne doit pas être le
    // prix à payer pour regarder l'image sans elle.
    const { cadre, appels } = await ouvrirLesTables()

    fireEvent.click(carreDe(cadre, "détourage"))
    const posee = await waitFor(() => {
      const derniere = recettesPosees(appels).at(-1)
      if (!derniere?.veille.length) throw new Error("rien n'a été endormi")
      return derniere
    })

    expect(posee.passes).toEqual([PASSE])
    expect(posee.grille?.cible).toBe(64)
    // La grille dort-elle aussi ? Non : on n'a touché qu'un carré.
    expect(posee.veille).toEqual(["detourage"])
    expect(carreDe(cadre, "grille").getAttribute("aria-checked")).toBe("true")
  })

  // ── « Éteinte et vide sont deux états, pas un » ────────────────────────────

  test("le carré d'une place éteinte se distingue d'un carré creux", async () => {
    const { cadre } = await ouvrirLesTables(["detourage"])

    const eteint = carreDe(cadre, "détourage").querySelector("[data-carre]")
    expect(eteint?.getAttribute("data-carre")).toBe("eteinte")
    // Les bords n'ont rien : leur carré est creux, et il ne se clique pas —
    // il n'y a rien à éteindre.
    const bords = cadre.getByRole("button", { name: /^bords/ })
    expect(
      bords.parentElement?.querySelector("[data-carre]")?.getAttribute("data-carre"),
    ).toBe("vide")
    expect(cadre.queryByRole("switch", { name: /bords/ })).toBeNull()
    // Et la grille, qui agit, porte le troisième état.
    expect(
      carreDe(cadre, "grille").querySelector("[data-carre]")?.getAttribute("data-carre"),
    ).toBe("posee")
  })

  test("une place éteinte garde sa valeur sous les yeux, barrée", async () => {
    // **Cacher la valeur pendant qu'elle dort la ferait croire perdue**, et
    // c'est exactement ce que la veille promet de ne pas faire.
    const { cadre } = await ouvrirLesTables(["grille"])
    const valeur = cadre.getByText("64 px · 100 %")
    expect(valeur.className).toContain("line-through")
    expect(valeur.className).not.toContain("text-signal")
  })

  // ── « Ouvrir une table éteinte montre une colonne éteinte » ────────────────

  test("ouvrir une table éteinte le dit, avec le geste pour la rallumer", async () => {
    const { cadre, appels } = await ouvrirLesTables(["grille"])

    fireEvent.click(cadre.getByRole("button", { name: /^grille/ }))
    const bandeau = await waitFor(() => {
      const trouve = document.querySelector("[data-table-eteinte]")
      if (!trouve) throw new Error("la colonne ne dit pas qu'elle est éteinte")
      return trouve as HTMLElement
    })
    expect(bandeau.textContent).toContain("ses réglages sont gardés")

    fireEvent.click(within(bandeau).getByRole("button", { name: /rallumer/i }))
    await waitFor(() => expect(recettesPosees(appels).at(-1)?.veille).toEqual([]))
    await waitFor(() =>
      expect(document.querySelector("[data-table-eteinte]")).toBeNull(),
    )
  })

  // ── « Toucher un réglage la rallume, et l'annonce » ────────────────────────

  test("toucher un réglage d'une table éteinte la rallume et le dit", async () => {
    // **Réveiller plutôt que refuser** : bloquer un curseur parce que sa table
    // dort obligerait à faire un geste préalable pour avoir le droit de faire
    // le geste qu'on voulait. Ce qu'on doit à l'auteur, c'est de le dire.
    const { cadre, appels } = await ouvrirLesTables(["detourage"])

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "64" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    const posee = await waitFor(() => {
      const derniere = recettesPosees(appels).at(-1)
      if (derniere?.passes[0]?.tolerance !== 64) throw new Error("rien n'est parti")
      return derniere
    })
    // Le réglage est parti **et** la place s'est rallumée, en un seul envoi.
    expect(posee.veille).toEqual([])

    const annonce = await waitFor(() => {
      const trouve = document.querySelector("[data-table-reveillee]")
      if (!trouve) throw new Error("le réveil ne s'est pas annoncé")
      return trouve as HTMLElement
    })
    expect(annonce.textContent).toContain("s'est rallumée")
    expect(document.querySelector("[data-table-eteinte]")).toBeNull()
  })

  test("changer de table efface l'annonce du réveil", async () => {
    // Une phrase qui survivrait à la table qu'elle décrit se lirait comme une
    // annonce sur celle qu'on vient d'ouvrir.
    const { cadre } = await ouvrirLesTables(["detourage"])

    const champ = (await cadre.findByLabelText(
      "tolérance, en chiffres",
    )) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "64" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    await waitFor(() =>
      expect(document.querySelector("[data-table-reveillee]")).not.toBeNull(),
    )

    fireEvent.click(cadre.getByRole("button", { name: /^grille/ }))
    await waitFor(() =>
      expect(document.querySelector("[data-table-reveillee]")).toBeNull(),
    )
  })
})

// ── U5 · Les réglages voyagent d'une image à l'autre ─────────────────────────
//
// **Deux gestes, deux durées de vie.** Copier-coller sert la séance en cours ;
// les recettes nommées lui survivent. Ils répondent à la même question — *je
// veux ces réglages-là, ailleurs* — et vivent donc au même endroit, un panneau
// au bout de la barre des tables, à côté de `tout défaire` : les deux ont la
// portée de la recette entière.
//
// **La règle du voyage n'est pas vérifiée ici** : elle vit dans le domaine, et
// `tests/test_u5.py` la mesure place par place. Ce qui se vérifie ici est que
// l'écran envoie la recette entière, prend ce que le serveur a décidé, et
// **répète ce qu'il a laissé** — le critère « un collage annonce ce qu'il a
// posé, et ce qu'il n'a pas pu poser ».

describe("les réglages voyagent d'une image à l'autre", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
    reinitialiserPressePapier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const PASSE = {
    moteur: "bord" as const,
    tolerance: 28,
    seuil_alpha: 128,
    durcissement: 0,
    point: null,
    portee: "tache" as const,
    masquee: false as const,
    trace: [],
    modele: "",
  }

  const AVEC_IMAGES = (images: Asset[]) => {
    const nain = personnage("Le nain")
    return {
      ...nain,
      cases: nain.cases.map((c) => (c.pose === "repos" ? { ...c, images } : c)),
    }
  }

  /** Deux images sous la même case : celle qui porte les réglages, et la voisine
   *  vide sur laquelle on collera. La colonne *Ses sœurs* les met à un clic
   *  l'une de l'autre, ce qui est exactement le geste que l'étape sert. */
  const DEUX = (recette: Partial<Recette> = {}) => [
    {
      ...asset("bbbb2222-0", "le nain, au repos"),
      recette: { ...RECETTE_VIDE, passes: [PASSE], ...recette },
    } as Asset,
    { ...asset("bbbb2222-1", "le nain, au repos, encore") } as Asset,
  ]

  const ouvrirLesTables = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    images = DEUX(),
  ) => {
    const double = serveurDouble({ personnages: [AVEC_IMAGES(images)], ...options })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const tables = document.querySelector("[data-tables]")
        if (!tables) throw new Error("les tables ne se sont pas ouvertes")
        return tables as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  /** Le panneau des recettes, ouvert — et **laissé ouvert s'il l'était déjà**.
   *
   *  Il survit au passage à l'image voisine, et c'est délibéré : copier ici,
   *  aller là, coller est le geste que l'étape sert, et un panneau qui se
   *  refermerait au passage demanderait de le rouvrir au milieu du geste. */
  const ouvrirLePanneau = async (cadre: ReturnType<typeof within>) => {
    const bouton = cadre.getByRole("button", { name: /recettes/ })
    if (bouton.getAttribute("aria-expanded") !== "true") fireEvent.click(bouton)
    return within(
      await waitFor(() => {
        const panneau = document.querySelector("[data-recettes]")
        if (!panneau) throw new Error("le panneau des recettes ne s'est pas ouvert")
        return panneau as HTMLElement
      }),
    )
  }

  /** Passer à l'image voisine sans refermer la table — le geste de la colonne
   *  des sœurs, et celui que le collage suppose. */
  const passerALaSoeur = async (cadre: ReturnType<typeof within>, label: string) => {
    fireEvent.click(cadre.getByRole("button", { name: new RegExp(label) }))
    await waitFor(() =>
      expect(document.querySelector("[data-tables]")).not.toBeNull(),
    )
  }

  // ── « Copier puis coller donnent la même recette » ─────────────────────────

  test("copier ici, coller là — et la recette entière est envoyée", async () => {
    const { cadre, appels } = await ouvrirLesTables()

    const panneau = await ouvrirLePanneau(cadre)
    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    await passerALaSoeur(cadre, "le nain, au repos, encore")

    const second = await ouvrirLePanneau(cadre)
    fireEvent.click(second.getByRole("button", { name: "Coller" }))

    const collage = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.endsWith("/paste")).pop()
      if (!trouve) throw new Error("rien n'a été collé")
      return trouve
    })
    // **L'écran envoie ce qu'il a sous les yeux, entier.** C'est le serveur qui
    // coupe : deux découpages auraient fini par diverger.
    expect((collage.corps as Recette).passes[0].tolerance).toBe(28)
    expect(collage.url).toContain("bbbb2222-1")
  })

  test("tant que rien n'est copié, coller est inactif et dit pourquoi", async () => {
    const { cadre } = await ouvrirLesTables()
    const panneau = await ouvrirLePanneau(cadre)

    const coller = panneau.getByRole("button", { name: "Coller" }) as HTMLButtonElement
    expect(coller.disabled).toBe(true)
    expect(panneau.getByText(/rien de copié/)).toBeTruthy()

    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    await waitFor(() =>
      expect(
        (panneau.getByRole("button", { name: "Coller" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
  })

  // ── « Un collage annonce ce qu'il a posé, et ce qu'il n'a pas pu poser » ───

  test("un collage dit ce qui n'a pas voyagé, en le nommant", async () => {
    const { cadre } = await ouvrirLesTables(
      {},
      DEUX({ recadrage: { marge: 0, boite: [4, 4, 20, 20] } }),
    )

    const panneau = await ouvrirLePanneau(cadre)
    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    await passerALaSoeur(cadre, "le nain, au repos, encore")
    const second = await ouvrirLePanneau(cadre)
    fireEvent.click(second.getByRole("button", { name: "Coller" }))

    const annonce = await waitFor(() => {
      const trouve = document.querySelector("[data-recettes-annonce]")
      if (!trouve) throw new Error("le collage n'a rien annoncé")
      return trouve as HTMLElement
    })
    expect(annonce.textContent).toContain("cadre tracé")
    expect(annonce.textContent).toContain("un endroit de l'autre image")
  })

  test("un collage qui n'a rien laissé le dit aussi", async () => {
    // **Une liste vide et *rien du tout* ne disent pas la même chose.** La
    // première est la seule bonne nouvelle que le panneau ait à donner ; les
    // confondre l'aurait effacée.
    const { cadre } = await ouvrirLesTables()

    const panneau = await ouvrirLePanneau(cadre)
    fireEvent.click(panneau.getByRole("button", { name: "Copier les réglages" }))
    await passerALaSoeur(cadre, "le nain, au repos, encore")
    const second = await ouvrirLePanneau(cadre)
    fireEvent.click(second.getByRole("button", { name: "Coller" }))

    await waitFor(() => {
      const annonce = document.querySelector("[data-recettes-annonce]")
      expect(annonce?.textContent).toContain("tous les réglages ont voyagé")
    })
  })

  // ── « On enregistre, on applique, on oublie » ──────────────────────────────

  test("on enregistre la recette courante sous un nom depuis la barre", async () => {
    const { cadre, appels } = await ouvrirLesTables()
    const panneau = await ouvrirLePanneau(cadre)

    fireEvent.change(panneau.getByLabelText("le nom de la recette"), {
      target: { value: "sprite 32" },
    })
    fireEvent.click(panneau.getByRole("button", { name: "Enregistrer" }))

    const envoi = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.includes("/api/recipes/")).pop()
      if (!trouve) throw new Error("rien n'a été enregistré")
      return trouve
    })
    expect(decodeURIComponent(envoi.url)).toContain("sprite 32")
    // Et la liste s'est remplie sans qu'on ait rouvert le panneau : le serveur
    // rend la liste entière à chaque geste qui la change.
    expect(await panneau.findByText("sprite 32")).toBeTruthy()
  })

  test("un nom déjà pris propose de remplacer, et ne remplace pas au premier clic", async () => {
    const { cadre, appels } = await ouvrirLesTables({
      recettes: { "sprite 32": { ...RECETTE_VIDE, passes: [PASSE] } },
    })
    const panneau = await ouvrirLePanneau(cadre)

    fireEvent.change(panneau.getByLabelText("le nom de la recette"), {
      target: { value: "sprite 32" },
    })
    fireEvent.click(panneau.getByRole("button", { name: "Enregistrer" }))

    // Rien n'est parti — le bouton demande d'abord.
    expect(appels.filter((a) => a.url.includes("/api/recipes/")).length).toBe(0)
    expect(await panneau.findByText(/existe déjà/)).toBeTruthy()

    fireEvent.click(panneau.getByRole("button", { name: /Remplacer/ }))
    await waitFor(() =>
      expect(appels.filter((a) => a.url.includes("/api/recipes/")).length).toBe(1),
    )
  })

  test("appliquer une recette nommée pose ce qu'elle emporte, et dit le reste", async () => {
    const { cadre } = await ouvrirLesTables({
      recettes: {
        "d'avant": {
          ...RECETTE_VIDE,
          passes: [PASSE],
          recadrage: { marge: 6, boite: [4, 4, 20, 20] },
          grille: {
            cible: 32,
            occupation: 100,
            ancrage: "bas",
            decalage: 3,
            methode: "proche",
          },
        },
      },
    })
    const panneau = await ouvrirLePanneau(cadre)

    fireEvent.click(panneau.getByRole("button", { name: "appliquer" }))

    const annonce = await waitFor(() => {
      const trouve = document.querySelector("[data-recettes-annonce]")
      if (!trouve) throw new Error("le rappel n'a rien annoncé")
      return trouve as HTMLElement
    })
    expect(annonce.textContent).toContain("cadre tracé")
    expect(annonce.textContent).toContain("décalage")
    // Et ce qui a voyagé est arrivé dans la barre : la grille porte sa case.
    expect(await cadre.findByText("32 px · 100 %")).toBeTruthy()
  })

  test("oublier une recette la retire de la liste", async () => {
    const { cadre, appels } = await ouvrirLesTables({
      recettes: { "sprite 32": { ...RECETTE_VIDE, passes: [PASSE] } },
    })
    const panneau = await ouvrirLePanneau(cadre)

    fireEvent.click(panneau.getByRole("button", { name: /oublier « sprite 32 »/ }))

    await waitFor(() => expect(panneau.queryByText("sprite 32")).toBeNull())
    expect(
      appels.some(
        (a) => a.url.includes("/api/recipes/") && decodeURIComponent(a.url).includes("sprite 32"),
      ),
    ).toBe(true)
    expect(panneau.getByText(/aucune recette nommée/)).toBeTruthy()
  })
})

// ── U6 · La palette se règle sans faire attendre ─────────────────────────────
//
// **Ce qui rendait l'attente est parti côté serveur** — l'empreinte relisait le
// paquet d'images pour savoir s'il fallait le relire — et se mesure dans
// `tests/test_u6.py` et `essais/essai_palette_vive.py` : 11,5 secondes contre
// 25 millisecondes sur trois vraies cartes, mesuré le 1ᵉʳ septembre 2026.
//
// Restent les deux critères qui se voient : **l'attente se montre** avec la
// jauge du produit et son seuil de 240 ms, et **l'aperçu ne se redemande pas**
// tant que les couleurs n'ont pas bougé.

describe("la palette se règle sans faire attendre", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Une palette dont l'attraction agit — donc dont le curseur n'est pas grisé.
   *
   *  À une seule source, l'attraction est inerte et **se grise avec sa
   *  raison** : il ne reste aucune couleur à rapprocher. Deux sources, donc. */
  const MELANGEE = {
    ...paletteDouble("marais"),
    sources: [
      { genre: "officiels" as const, reference: "" },
      { genre: "images" as const, reference: "le paquet" },
    ],
    du_jeu: 2,
    attraction_inerte: false,
  }

  const ouvrirUnePalette = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    fetchDouble?: (chemin: string, init?: RequestInit) => Promise<Response>,
  ) => {
    const double = serveurDouble({ palettes: [MELANGEE], ...options })
    await monter(
      (fetchDouble ?? double.fetchDouble) as unknown as ReturnType<typeof vi.fn>,
    )
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Ambiances et couleurs" }))
    fireEvent.click(await screen.findByRole("button", { name: /marais/ }))
    await screen.findByText(/l'aperçu/)
    return double
  }

  const apercus = (appels: { url: string }[]) =>
    appels.filter((a) => a.url.includes("/preview")).length

  const laJauge = () => document.querySelector("[data-attente-palette] span.bg-bord")

  /** Poser l'attraction par son champ de nombre — un seul envoi, comme un
   *  relâchement de curseur (U3). Plus sûr qu'un `mouseUp` simulé, et c'est
   *  exactement le même chemin dans le produit. */
  const poserLAttraction = (valeur: number) => {
    const champ = screen.getByLabelText("l'attraction, en chiffres")
    fireEvent.change(champ, { target: { value: String(valeur) } })
    fireEvent.keyDown(champ, { key: "Enter" })
  }

  // ── « L'aperçu ne se redemande pas tant que rien n'a changé » ──────────────

  test("rouvrir la même palette ne redemande pas l'aperçu", async () => {
    // **C'est l'empreinte qui décide, pas la palette.** L'aperçu pose la
    // palette sur de vraies images et coûte des centaines de millisecondes ;
    // le redemander à chaque rendu du panneau — un clic dans la colonne, une
    // liste qui revient du serveur — l'aurait payé pour rien.
    const { appels } = await ouvrirUnePalette()
    const avant = apercus(appels)
    expect(avant).toBe(1)

    fireEvent.click(screen.getByRole("button", { name: /marais/ }))
    fireEvent.click(screen.getByRole("button", { name: /marais/ }))
    await waitFor(() => expect(screen.getByText(/l'aperçu/)).toBeTruthy())

    expect(apercus(appels)).toBe(avant)
  })

  test("bouger l'attraction, lui, redemande l'aperçu — les couleurs ont changé", async () => {
    // L'autre moitié du critère : *ne pas redemander* ne doit pas devenir *ne
    // jamais redemander*, sans quoi l'aperçu montrerait une palette qui n'est
    // plus celle qu'on règle.
    const { appels } = await ouvrirUnePalette()
    const avant = apercus(appels)

    poserLAttraction(60)

    await waitFor(() => expect(apercus(appels)).toBe(avant + 1))
  })

  // ── « Un calcul qui dépasse 240 ms montre la jauge, et elle part avec lui » ─

  test("une attente longue montre la jauge du produit, et elle disparaît avec elle", async () => {
    // **Une jauge, pas une neuve** : celle de la génération et de la retouche,
    // avec le seuil de 240 ms qui l'empêche de clignoter sur un geste court.
    let relacher: () => void = () => {}
    const lente = new Promise<void>((resoudre) => {
      relacher = resoudre
    })

    const double = serveurDouble({ palettes: [MELANGEE] })
    const freine = vi.fn(async (chemin: string, init?: RequestInit) => {
      if (String(chemin).startsWith("/api/palettes/") && init?.method === "PUT")
        await lente
      return double.fetchDouble(chemin, init)
    })
    await ouvrirUnePalette({}, freine as unknown as typeof double.fetchDouble)

    // Rien tant que rien n'attend.
    expect(laJauge()).toBeNull()

    const depart = Date.now()
    poserLAttraction(60)

    // Sous le seuil, elle ne paraît toujours pas : une jauge qui clignoterait
    // sur un geste court serait pire que pas de jauge du tout.
    expect(laJauge()).toBeNull()

    // L'horloge avance au-delà des 240 ms ; la jauge se rafraîchit d'elle-même
    // quatre fois par seconde, comme partout ailleurs dans le produit.
    vi.spyOn(Date, "now").mockImplementation(() => depart + 900)
    await waitFor(() => expect(laJauge()).not.toBeNull())

    relacher()
    await waitFor(() => expect(laJauge()).toBeNull())
  })
})

// ── U7 · La toile dit ce qu'elle a fabriqué ──────────────────────────────────
//
// Les deux boutons d'un îlot **partaient sans le moindre retour**. Le serveur
// répondait correctement et fabriquait bien la palette ; l'écran ne bougeait pas
// d'un pixel, ne disait rien, ne menait nulle part, et l'objet fabriqué vivait
// dans un autre côté de l'onglet. De l'endroit où l'on clique, cela ne se
// distinguait pas d'un bouton mort — et c'est ce que la séance a conclu.
//
// Ce que le serveur a appris à dire — *ce paquet a-t-il déjà produit quelque
// chose, et quoi ?* — se mesure dans `tests/test_u7.py`. Ici : le geste le dit,
// l'îlot porte sa marque, un second clic mène à l'existant.

describe("la toile dit ce qu'elle a fabriqué", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    doublerLaGrille(160)
    toutReplier()
    // La capture de pointeur n'existe pas dans jsdom, et le bandeau de l'îlot
    // s'en sert pour tenir le geste : on la double, comme le flux et la mesure.
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const CARTES = [
    carteImage("m1", { groupe: "marais" }),
    carteImage("m2", { groupe: "marais", position: [200, 0] }),
  ]

  /** La toile ouverte, et le menu de l'îlot déplié.
   *
   *  Le menu s'ouvre au clic sur le **nom** de l'îlot — c'est le seul endroit
   *  d'où un clic ouvre quelque chose sur cette bande, et le geste souris passe
   *  par le `pointerup` du bandeau, qui sait si le pointeur a tiré. */
  const ouvrirLeMenuDeLIlot = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({ cartes: CARTES, ...options })
    await monter(double.fetchDouble)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("button", { name: "toile" }))
    const bandeau = await waitFor(() => {
      const trouve = document.querySelector("[data-ilot='marais'] [data-nom-ilot]")
      if (!trouve) throw new Error("l'îlot du marais n'est pas dessiné")
      return trouve as HTMLElement
    })
    // **Le chemin du clavier**, et c'est le seul que jsdom sache jouer : un
    // clic de souris passe par le `pointerup` du bandeau, qui a besoin d'une
    // capture de pointeur et d'une distance parcourue. `fireEvent.click` pose
    // `detail` à zéro, ce que le bouton lit comme « ceci ne vient pas d'un
    // pointeur » — exactement ce que fait la touche Entrée.
    fireEvent.click(bandeau)
    return double
  }

  const bouton = (nom: RegExp) => screen.getByRole("button", { name: nom })

  // ── « Faire une palette le dit, nomme ce qui a été créé, et propose d'y
  //     aller » ─────────────────────────────────────────────────────────────

  test("faire une palette dit ce qui a été créé, et mène à l'objet", async () => {
    const { appels } = await ouvrirLeMenuDeLIlot()

    fireEvent.click(bouton(/faire une palette de ce paquet/))

    const dit = await waitFor(() => {
      const trouve = document.querySelector("[data-fabrique-faite]")
      if (!trouve) throw new Error("le geste n'a rien dit")
      return trouve as HTMLElement
    })
    // Il **nomme** ce qui a été créé : « la palette est faite » sans son nom
    // laisserait l'auteur chercher laquelle, parmi celles qu'il a déjà.
    expect(dit.textContent).toContain("marais")
    expect(dit.textContent).toContain("faite")
    expect(appels.some((a) => a.url === "/api/palettes")).toBe(true)

    // Et le chemin y mène : le côté change, l'objet s'ouvre.
    fireEvent.click(within(dit).getByRole("button", { name: /aller la voir/ }))
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Ambiances et couleurs" })
        .getAttribute("aria-selected")).toBe("true"),
    )
    expect(await screen.findByText(/l'aperçu/)).toBeTruthy()
  })

  test("faire une ambiance fait de même, et l'ambiance porte la palette du paquet", async () => {
    const { appels, etat } = await ouvrirLeMenuDeLIlot()

    fireEvent.click(bouton(/faire une ambiance de ce paquet/))

    const dit = await waitFor(() => {
      const trouve = document.querySelector("[data-fabrique-faite]")
      if (!trouve) throw new Error("le geste n'a rien dit")
      return trouve as HTMLElement
    })
    expect(dit.textContent).toContain("ambiance")
    expect(dit.textContent).toContain("marais")

    // **Les deux objets, et le lien entre eux.** Une ambiance qui ne porterait
    // pas la palette du paquet serait une ambiance vide portant son nom.
    expect(appels.some((a) => a.url === "/api/palettes")).toBe(true)
    expect(appels.some((a) => a.url === "/api/moods" && a.corps)).toBe(true)
    const nee = etat.ambiances.find((a) => a.nom === "marais")
    expect(nee?.palette).toBe(etat.palettes.find((p) => p.nom === "marais")?.identifiant)
  })

  // ── « Un îlot dont le paquet a une palette le montre sur la toile » ────────

  test("l'îlot porte la marque de ce qu'il a produit", async () => {
    // **Aucun glyphe neuf, aucune couleur dépensée** : le mot se pose là où
    // l'îlot parle déjà de lui-même, à côté de son compte de cartes.
    await ouvrirLeMenuDeLIlot()
    const bandeDeLIlot = () =>
      document.querySelector("[data-ilot='marais']")?.textContent ?? ""

    expect(bandeDeLIlot()).toContain("2 cartes")
    expect(bandeDeLIlot()).not.toContain("2 cartes · palette")

    fireEvent.click(bouton(/faire une palette de ce paquet/))

    await waitFor(() => expect(bandeDeLIlot()).toContain("2 cartes · palette"))
  })

  test("l'ambiance l'emporte sur la palette dans la marque", async () => {
    // Elle *contient* la palette du paquet : dire les deux serait redondant, et
    // dire la palette seule serait dire la moitié.
    await ouvrirLeMenuDeLIlot({
      palettes: [
        {
          ...paletteDouble("marais"),
          sources: [{ genre: "images", reference: "marais" }],
        },
      ],
      ambiances: [ambianceDouble("Marais de cendre", "marais")],
    })

    await waitFor(() =>
      expect(document.querySelector("[data-ilot='marais']")?.textContent).toContain(
        "2 cartes · ambiance",
      ),
    )
  })

  // ── « Refaire le geste ne crée pas de doublon et mène à l'existant » ───────

  test("un paquet déjà servi propose d'ouvrir ce qui existe, et ne refait rien", async () => {
    const { appels } = await ouvrirLeMenuDeLIlot({
      palettes: [
        {
          ...paletteDouble("marais"),
          sources: [{ genre: "images", reference: "marais" }],
        },
      ],
    })

    // Le bouton **le dit avant qu'on clique** plutôt que de s'excuser après.
    const ouvrir = await screen.findByRole("button", { name: /ouvrir sa palette/ })
    expect(screen.queryByRole("button", { name: /faire une palette de ce paquet/ })).toBeNull()

    const avant = appels.filter((a) => a.url === "/api/palettes").length
    fireEvent.click(ouvrir)

    // Rien n'a été fabriqué, et le chemin mène quand même à l'objet.
    expect(appels.filter((a) => a.url === "/api/palettes").length).toBe(avant)
    const dit = await waitFor(() => {
      const trouve = document.querySelector("[data-fabrique-faite]")
      if (!trouve) throw new Error("le geste n'a rien dit")
      return trouve as HTMLElement
    })
    expect(dit.textContent).toContain("existe déjà")
  })

  // ── « Un refus se lit à l'endroit où l'on a cliqué » ───────────────────────

  test("un refus du serveur se lit dans la bande du châssis, avec sa raison", async () => {
    // **Un refus est du même genre partout dans le produit**, et il part par le
    // même chemin : la fente du châssis. Lui inventer une seconde place dans le
    // menu aurait fait deux grammaires pour une mauvaise nouvelle.
    const double = serveurDouble({ cartes: CARTES })
    const refuse = vi.fn(async (chemin: string, init?: RequestInit) => {
      if (String(chemin) === "/api/palettes" && init?.method === "POST")
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: "ambiance_refusee",
            raison: "une palette « marais » existe déjà dans ce jeu",
            ou_aller: null,
          }),
        } as unknown as Response
      return double.fetchDouble(chemin, init)
    })
    await monter(refuse as unknown as ReturnType<typeof vi.fn>)
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("button", { name: "toile" }))
    const bandeau = await waitFor(() => {
      const trouve = document.querySelector("[data-ilot='marais'] [data-nom-ilot]")
      if (!trouve) throw new Error("l'îlot du marais n'est pas dessiné")
      return trouve as HTMLElement
    })
    // **Le chemin du clavier**, et c'est le seul que jsdom sache jouer : un
    // clic de souris passe par le `pointerup` du bandeau, qui a besoin d'une
    // capture de pointeur et d'une distance parcourue. `fireEvent.click` pose
    // `detail` à zéro, ce que le bouton lit comme « ceci ne vient pas d'un
    // pointeur » — exactement ce que fait la touche Entrée.
    fireEvent.click(bandeau)

    fireEvent.click(bouton(/faire une palette de ce paquet/))

    expect(await screen.findByText(/existe déjà dans ce jeu/)).toBeTruthy()
    expect(document.querySelector("[data-fabrique-faite]")).toBeNull()
  })
})

// ── U8 · La galerie rend le prompt, et son bouton rentre dans la vignette ────
//
// Deux points de la séance, et ils n'ont rien à voir l'un avec l'autre sinon
// l'écran où ils se voient.
//
// **Le prompt était enregistré depuis toujours et affiché nulle part.** La
// fiche ne montrait que le titre — les cinquante-six premiers caractères — et
// le seul moyen de lire le reste était *reprendre les réglages*, qui change
// d'onglet et remplit le champ de génération, c'est-à-dire qui fait tout autre
// chose que lire.
//
// **Et le lien PNG sortait de la tuile.** Mesuré au navigateur : à la taille de
// repos la vignette fait 132,6 px, la ligne des mesures en réclame 137, et le
// lien dépassait de 13,2 px sur la droite, posé sur la voisine.

describe("la galerie rend le prompt, et son bouton rentre dans la vignette", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le texte **tel qu'il est parti** : le sujet, plus ce que le jeu et
   *  l'ambiance y ont replié. C'est ce que le fichier de la génération porte,
   *  et c'est ce que la fiche doit rendre — pas le seul sujet du champ. */
  const PARTI =
    "un tonneau de chêne cerclé de fer — pixel art, palette de vingt-quatre " +
    "couleurs, fond uni, vue de trois quarts, éclairage rasant venu de la gauche"

  const ouvrirLaFiche = async (
    asset_: Asset,
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({ assets: [asset_], promptParti: PARTI, ...options })
    await monter(double.fetchDouble, { ...ETAT, assets: [asset_] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    return double
  }

  const blocDuTexte = () => screen.getByRole("button", { name: /^Son texte/ })

  // ── « La fiche montre le prompt qui l'a fabriquée, entier et replié » ──────

  test("le bloc du texte porte son début replié, et le texte entier ouvert", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0", "un tonneau"))

    // **Replié par défaut**, et il porte assez de texte pour reconnaître
    // l'image sans rien ouvrir.
    const bloc = await waitFor(() => {
      const trouve = screen.getByRole("button", { name: /^Son texte/ })
      if (trouve.getAttribute("aria-expanded") !== "false")
        throw new Error("le bloc devait être replié")
      return trouve
    })
    expect(bloc.textContent).toContain("un tonneau de chêne")
    expect(document.querySelector("[data-prompt-parti]")).toBeNull()

    fireEvent.click(bloc)

    // Ouvert, il porte le texte **entier** — celui du jeu et de l'ambiance
    // compris, pas le seul sujet écrit dans le champ.
    const texte = await waitFor(() => {
      const trouve = document.querySelector("[data-prompt-parti]")
      if (!trouve) throw new Error("le texte ne s'est pas déplié")
      return trouve as HTMLElement
    })
    expect(texte.textContent).toBe(PARTI)
    expect(texte.textContent).toContain("éclairage rasant")
  })

  test("on copie le texte sans quitter la fiche ni toucher au champ", async () => {
    const ecrit = vi.fn(() => Promise.resolve())
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: ecrit } })
    await ouvrirLaFiche(asset("aaaa1111-0", "un tonneau"))
    fireEvent.click(blocDuTexte())

    fireEvent.click(await screen.findByRole("button", { name: "copier le texte" }))

    await waitFor(() => expect(ecrit).toHaveBeenCalledWith(PARTI))
    // **La fiche est toujours là**, et le champ de génération n'a pas bougé :
    // *reprendre les réglages* fait déjà cela, et fait tout autre chose.
    expect(screen.getByLabelText("Fermer la fiche")).toBeTruthy()
    expect(await screen.findByText("copié")).toBeTruthy()
  })

  // ── « Une image sans prompt le dit » ──────────────────────────────────────

  test("une image importée dit qu'elle n'a pas de texte", async () => {
    await ouvrirLaFiche(
      { ...asset("aaaa1111-0", "épée.png", "auteur", "import") } as Asset,
      { promptParti: "" },
    )

    const bloc = blocDuTexte()
    expect(bloc.textContent).toContain("aucun texte")
    fireEvent.click(bloc)
    expect(await screen.findByText(/entrée par import/)).toBeTruthy()
    expect(document.querySelector("[data-prompt-parti]")).toBeNull()
  })

  // ── « Une image née d'une autre nomme sa parente et y mène » ───────────────

  test("une découpe renvoie à sa parente sans montrer son texte", async () => {
    // **Montrer le texte de la planche sur l'un de ses huit morceaux aurait
    // affiché sur une image un texte qui en décrit huit.**
    await ouvrirLaFiche({
      ...asset("aaaa1111-0", "un tonneau, morceau 1"),
      parent: "pppp0000-0",
    } as Asset)

    const bloc = blocDuTexte()
    expect(bloc.textContent).toContain("vient d'une autre image")
    fireEvent.click(bloc)

    expect(await screen.findByText(/née d'une autre/)).toBeTruthy()
    // Le texte de la planche n'est **pas** affiché ici.
    expect(document.querySelector("[data-prompt-parti]")).toBeNull()
    expect(screen.queryByText(new RegExp("éclairage rasant"))).toBeNull()
    // Et le chemin y mène.
    expect(screen.getByRole("button", { name: /aller la lire/ })).toBeTruthy()
  })

  // ── « Rien ne dépasse de la vignette, et le téléchargement reste là » ──────

  test("à la taille de repos le lien se réduit à sa flèche, et reste atteignable", async () => {
    // **Le mot part, pas la cible.** La planche contact ne perd pas une colonne
    // pour un bouton secondaire, et le nom complet reste dans le nom
    // accessible — pour qui lit l'écran autrement qu'avec les yeux.
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0", "un tonneau")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0", "un tonneau")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    const lien = () =>
      screen.getByRole("link", { name: "télécharger le PNG" }) as HTMLAnchorElement
    expect(lien().textContent).toBe("↓")
    expect(lien().getAttribute("href")).toContain("aaaa1111-0")

    // Aux deux autres crans, la place suffit et le mot revient.
    fireEvent.click(screen.getByRole("button", { name: "2×" }))
    await waitFor(() => expect(lien().textContent).toBe("PNG ↓"))
    fireEvent.click(screen.getByRole("button", { name: "4×" }))
    await waitFor(() => expect(lien().textContent).toBe("PNG ↓"))
  })

  test("la ligne des mesures ne pousse plus la tuile", async () => {
    // **C'est `min-w-0` qui répare le débordement**, et il se vérifie sur la
    // classe plutôt qu'à la mesure : jsdom ne met rien en page, donc tout
    // rectangle y vaut zéro et une assertion sur des pixels y serait vraie sans
    // rien prouver. La mesure, elle, a été faite au navigateur — c'est un
    // critère de l'étape, et elle est écrite dans `docs/tranches/U.md`.
    const { fetchDouble } = serveurDouble({ assets: [asset("aaaa1111-0", "un tonneau")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("aaaa1111-0", "un tonneau")] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    const tuile = tuiles()[0].closest("figure") as HTMLElement
    expect(tuile.className).toContain("min-w-0")
    const mesures = tuile.querySelector("[data-mesures]") as HTMLElement
    expect(mesures.className).toContain("min-w-0")
    // Le prix et le lien ne cèdent pas : ce sont les dimensions qui se coupent,
    // et elles sont redites en entier sur la fiche, à un clic.
    expect(mesures.querySelector(".truncate")?.textContent).toContain("×")
  })
})

// ── F1 · Le pluriel, et le fournisseur qui ne demande rien ───────────────────
//
// Les deux critères de la tranche que **seul l'écran** peut tenir : chaque
// modèle porte le nom de qui le propose, et le bouton qui paie cesse d'être
// éteint par une clé qui ne concerne pas le modèle choisi.
//
// Le reste des onze critères vit dans `tests/test_f1.py` : ils parlent de ce que
// le serveur décide — le grisé, la photo datée, le nom enregistré —, et l'écran
// n'a que le droit de l'afficher.

describe("plusieurs fournisseurs dans une seule liste", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** **Le même nom chez deux fournisseurs**, et c'est le cas qui casse tout si
   *  une ligne ne dit pas qui la propose : le relevé du 31 août a trouvé les
   *  modèles de Leonardo hébergés chez Cloudflare. */
  const PAYANT = {
    ...MODELE,
    identifiant: "payant:copie",
    nom: "Copie",
    fournisseur: "payant",
    chez_lui: "copie",
  }
  const LIBRE = {
    ...MODELE,
    identifiant: "libre:copie",
    nom: "Copie",
    fournisseur: "libre",
    chez_lui: "copie",
    references_max: 0,
    variations_max: 1,
  }

  /** La liste des modèles est **repliée par défaut** — c'est le cas d'école du
   *  bloc repliable (E4) : un choix déjà fait, qui se dit en une ligne. Les
   *  essais remettent le registre à zéro, donc il faut l'ouvrir pour voir les
   *  lignes plutôt que la seule valeur résumée. */
  const ouvrirLaListeDesModeles = async () => {
    await ouvrirLesReglagesDeLAppel()
    const entete = await screen.findByRole("button", { name: /^Modèle/ })
    if (entete.getAttribute("aria-expanded") !== "true") fireEvent.click(entete)
  }

  const catalogueADeux = (refusDuPayant: string | null = null): EtatCatalogue => ({
    ...CATALOGUE,
    defaut: { modele: refusDuPayant ? LIBRE.identifiant : PAYANT.identifiant, options: {} },
    fournisseurs: [
      { ...CATALOGUE.fournisseurs[0], nom: "payant", modeles: 1, grise: refusDuPayant },
      { ...CATALOGUE.fournisseurs[0], nom: "libre", modeles: 1 },
    ],
    modeles: [{ ...PAYANT, refus: refusDuPayant }, LIBRE],
  })

  // ── « Les modèles des deux paraissent dans la même liste, et chacun porte le
  //     nom de celui qui le propose » ───────────────────────────────────────

  test("deux modèles du même nom se distinguent par qui les propose", async () => {
    const { fetchDouble } = serveurDouble({ catalogue: catalogueADeux() })
    await monter(fetchDouble)
    await ouvrirLaListeDesModeles()

    // Deux lignes, un seul nom affiché — sans le fournisseur, le choix serait
    // un tirage au sort.
    const lignes = await screen.findAllByRole("button", { name: /Copie/ })
    expect(lignes).toHaveLength(2)
    expect(lignes[0].textContent).toContain("payant")
    expect(lignes[1].textContent).toContain("libre")
  })

  test("le filtre trouve un fournisseur par son nom", async () => {
    const { fetchDouble } = serveurDouble({ catalogue: catalogueADeux() })
    await monter(fetchDouble)
    await ouvrirLaListeDesModeles()

    await screen.findAllByRole("button", { name: /Copie/ })
    fireEvent.change(screen.getByPlaceholderText("filtrer"), {
      target: { value: "libre" },
    })

    // ⚠️ **Deux lignes et non une**, et c'est la correction du 27 août 2026
    // remise en place : le filtre écarte le modèle choisi — celui du payant —,
    // et il revient donc **en tête**, séparé du résultat par un liseré. Il ne
    // quitte jamais l'écran, sans quoi plus rien ne dirait avec quoi on génère.
    const restantes = screen.getAllByRole("button", { name: /Copie/ })
    expect(restantes).toHaveLength(2)
    expect(restantes[0].textContent).toContain("payant")
    expect(restantes[1].textContent).toContain("libre")

    // Et le compteur compte **ce que le filtre a trouvé**, jamais les lignes
    // rendues : l'épinglé n'est pas un résultat.
    expect(screen.getByText("1 sur 2")).toBeTruthy()
  })

  // ── « Sur une installation neuve, sans aucune clé, on écrit un nom puis un
  //     prompt et une image arrive » ─────────────────────────────────────────
  //
  // **Ce que l'écran doit tenir de ce critère est étroit et il compte** : ne
  // plus éteindre le bouton qui paie au nom d'une clé qui ne concerne pas le
  // modèle choisi. Avant la V2.2 c'était juste — il n'y avait qu'un
  // fournisseur. Un refus faux est ce qui fait douter de tous les autres.

  test("sans clé, le bouton qui paie reste actif sur un modèle qui n'en demande pas", async () => {
    const { fetchDouble } = serveurDouble({
      catalogue: catalogueADeux("aucune clé OpenRouter"),
    })
    await monter(fetchDouble, {
      ...ETAT,
      secrets: [
        {
          fournisseur: "OpenRouter",
          secrets: [PLACE_VIDE],
          manque: "aucune clé OpenRouter",
          pret: false,
        },
        SANS_SECRET,
      ],
    })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })

    // Le défaut a glissé vers celui qui ne demande rien, et générer est actif.
    const generer = await screen.findByRole("button", { name: "Générer" })
    await waitFor(() => expect(generer.hasAttribute("disabled")).toBe(false))
  })

  test("choisir le modèle du fournisseur qui manque éteint le bouton, avec sa phrase", async () => {
    const { fetchDouble } = serveurDouble({
      catalogue: catalogueADeux("aucune clé OpenRouter"),
    })
    await monter(fetchDouble, {
      ...ETAT,
      secrets: [
        {
          fournisseur: "OpenRouter",
          secrets: [PLACE_VIDE],
          manque: "aucune clé OpenRouter",
          pret: false,
        },
        SANS_SECRET,
      ],
    })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await ouvrirLaListeDesModeles()

    const lignes = await screen.findAllByRole("button", { name: /Copie/ })
    fireEvent.click(lignes[0]) // celui du fournisseur sans clé

    // **La phrase est celle du fournisseur, pas une phrase de l'écran** : elle
    // vient du serveur, comme toutes les raisons de grisé depuis T1.
    const generer = await screen.findByRole("button", { name: "Générer" })
    await waitFor(() => expect(generer.hasAttribute("disabled")).toBe(true))
    expect(document.body.textContent).toContain("aucune clé OpenRouter")
  })
})

// ── F2 · Ce qu'un appel consomme ─────────────────────────────────────────────
//
// **Deux critères de la tranche ne se tiennent qu'ici**, et ce sont les deux
// qu'elle existe pour tenir : *un appel sans prix affiche « gratuit » ; « 0,00 $ »
// n'apparaît nulle part pour lui*, et *ce qui reste chez un fournisseur se lit
// sur l'écran où l'on choisit comme sur celui qui confirme*.
//
// Le serveur, lui, ne connaît pas le mot « gratuit » : il donne une quantité et
// son unité, et c'est l'écran qui écrit la phrase. C'est la même répartition
// que pour les raisons de grisé depuis T1 — à ceci près qu'ici c'est l'inverse,
// et volontairement : une mise en forme n'est pas une règle.

describe("ce qu'un appel consomme", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le fournisseur qui ne facture pas — un jeton par image, **aucune réserve
   *  annoncée**, une cadence. C'est celui du produit, mesuré le 31 août 2026. */
  const SANS_RESERVE: Reserve = {
    fournisseur: "libre",
    unite: "jeton",
    consomme: 7,
    plafond: null,
    reste: null,
    source: "ici",
    renouvellement: "minuit",
    cadence_s: 15,
    depuis: 1_787_750_000,
  }

  /** Un fournisseur **qui annonce sa réserve**. Aucun n'en annonce une
   *  aujourd'hui ; celui-ci existe pour que la phrase « il reste » soit écrite
   *  et vérifiée avant que F4 ne l'utilise pour de bon. */
  const AVEC_RESERVE: Reserve = {
    ...SANS_RESERVE,
    plafond: 10,
    reste: 3,
  }

  const GRATUIT = {
    ...MODELE,
    identifiant: "libre:sana",
    nom: "Sana",
    fournisseur: "libre",
    chez_lui: "sana",
    references_max: 0,
    variations_max: 1,
    unite: "jeton",
  }

  const catalogueGratuit = (reserve: Reserve): EtatCatalogue => ({
    ...CATALOGUE,
    defaut: { modele: GRATUIT.identifiant, options: {} },
    fournisseurs: [{ ...CATALOGUE.fournisseurs[0], nom: "libre", reserve }],
    couts: { [GRATUIT.identifiant]: 1 },
    modeles: [GRATUIT],
  })

  // ── « Un appel sans prix affiche gratuit » ────────────────────────────────

  test("la tuile d'une image sans prix dit « gratuit », jamais « $0,0000 »", async () => {
    const image = {
      ...asset("g1-0", "un tonneau"),
      cout_usd: 0,
      consomme: 1,
      unite: "jeton",
    }
    const { fetchDouble } = serveurDouble({ assets: [image] })
    await monter(fetchDouble)

    const mesure = await screen.findByText("gratuit")
    // **Le mot remplace le montant**, il ne s'y ajoute pas : « gratuit $0,0000 »
    // laisserait le chiffre faire son travail de mensonge. Cherché sur la ligne
    // de la tuile, pas sur la page : la barre de tête porte son propre total en
    // dollars, et c'est très bien ainsi.
    expect(mesure.parentElement?.textContent).not.toContain("$0,0000")
  })

  test("une image payée zéro dollar garde son « $0,0000 »", async () => {
    // **Le contraire du précédent, et il compte autant** : une découpe de
    // planche n'a rien coûté seule, et elle a bel et bien été payée en amont.
    const image = {
      ...asset("g1-0", "une découpe"),
      cout_usd: 0,
      consomme: 0,
      unite: "usd",
    }
    const { fetchDouble } = serveurDouble({ assets: [image] })
    await monter(fetchDouble)

    expect((await screen.findAllByText("$0,0000")).length).toBeGreaterThan(0)
    expect(screen.queryByText("gratuit")).toBeNull()
  })

  // ── « Ce qui reste, et d'où le chiffre vient » ────────────────────────────

  test("l'écran où l'on choisit dit ce qui est parti et d'où le chiffre vient", async () => {
    const { fetchDouble } = serveurDouble({
      catalogue: catalogueGratuit(SANS_RESERVE),
    })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    // **« Aucune réserve » n'est pas « il reste zéro »** : le premier dit que
    // rien ne limite le nombre d'images, le second qu'il faut attendre demain.
    // Deux fois à l'écran : la barre qui paie et le panneau des réglages
    // lisent la même phrase, écrite à un seul endroit.
    expect(
      (await screen.findAllByText(/n'annonce aucune réserve/)).length,
    ).toBeGreaterThan(0)
    expect(document.body.textContent).toContain("7 jetons partis depuis minuit")
    // Et d'où vient le chiffre — un invariant de la version.
    expect(document.body.textContent).toContain("compté ici")
    expect(document.body.textContent).toContain("un appel toutes les 15 secondes")
  })

  test("un fournisseur qui annonce une réserve dit ce qui reste et quand ça revient", async () => {
    const { fetchDouble } = serveurDouble({
      catalogue: catalogueGratuit(AVEC_RESERVE),
    })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    expect(
      (await screen.findAllByText(/il reste 3 jetons sur 10/)).length,
    ).toBeGreaterThan(0)
    expect(document.body.textContent).toContain("renouvelés à minuit")
  })

  test("ce qu'un modèle gratuit prendra s'écrit en jetons, jamais en dollars", async () => {
    const { fetchDouble } = serveurDouble({
      catalogue: catalogueGratuit(SANS_RESERVE),
      // La médiane mesurée de ce modèle-là, dans son unité à lui : un jeton.
      couts: { [GRATUIT.identifiant]: 1 },
    })
    await monter(fetchDouble)
    await ouvrirLesReglagesDeLAppel()

    // L'estimation change de mot **et** d'unité : « coût attendu ≈ $1,0000 »
    // serait faux deux fois.
    expect((await screen.findAllByText("ce qu'il prendra"))[0]).toBeTruthy()
    expect(screen.getAllByText("≈ 1 jeton")[0]).toBeTruthy()
  })

  // ── « Le total de la barre de tête ne compte que de l'argent » ────────────

  test("le total de la barre dit qu'il ne compte que de l'argent", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    const barre = document.querySelector("header") as HTMLElement
    expect(within(barre).getByText("ce jeu, en argent")).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F3 · Les clés au pluriel
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran fait du tiroir. Une place par
// fournisseur, un fournisseur qui ne demande rien qui le dise, un fournisseur à
// deux places qui dise **lequel** manque, le retrait qui ne se propose que
// quand il retire vraiment, et les deux portes — les réglages, l'étape 11 de
// l'assistant — qui rendent le même tiroir. Ce qui se calcule — l'écriture du
// fichier, le refus d'un nom inconnu, la relecture à chaque appel — vit dans
// `tests/test_f3.py`.
//
// **Ce que la tranche a fermé, côté écran** : le produit avait *la* clé, un
// champ unique. Le relevé du 31 août a trouvé un fournisseur qui en demande
// deux, et un formulaire à un champ l'aurait découvert en F4, au pire moment.

describe("les clés au pluriel", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Un fournisseur qui demande **deux** places, la forme de Cloudflare. Elle
   *  arrive pour de bon en F4 ; l'écran doit savoir la tenir avant. */
  const A_DEUX_PLACES: Tiroir = {
    fournisseur: "Cloudflare",
    secrets: [
      {
        nom: "CLOUDFLARE_ACCOUNT_ID",
        libelle: "le compte",
        ou: "dash.cloudflare.com",
        presente: false,
        origine: "absente",
        apercu: "",
        retirable: false,
      },
      {
        nom: "CLOUDFLARE_API_TOKEN",
        libelle: "le jeton",
        ou: "dash.cloudflare.com/jetons",
        presente: false,
        origine: "absente",
        apercu: "",
        retirable: false,
      },
    ],
    manque: "il manque, chez Cloudflare : le compte, le jeton",
    pret: false,
  }

  const ouvrirLesReglages = async (secrets: Tiroir[] = ETAT.secrets) => {
    const double = serveurDouble({ secrets })
    await monter(double.fetchDouble, { ...ETAT, secrets })
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))
    await screen.findByRole("heading", { name: "Les fournisseurs" })
    return double
  }

  // ── « Chaque fournisseur a sa place à lui » ───────────────────────────────

  test("chaque fournisseur a sa place, et celui qui ne demande rien le dit", async () => {
    await ouvrirLesReglages()

    // **Un tiroir vide paraît quand même** : caché, il passerait pour un
    // fournisseur absent, et c'est le premier renseignement que l'auteur
    // cherche sur une machine neuve.
    expect(await screen.findByText("OpenRouter")).toBeTruthy()
    expect(screen.getByText("Pollinations")).toBeTruthy()
    expect(screen.getByText(/ne demande rien/)).toBeTruthy()

    // Celle qui est remplie ne montre que son aperçu, jamais sa valeur.
    expect(screen.getByText(/…abcdef/)).toBeTruthy()
  })

  test("un fournisseur qui demande deux places les demande toutes les deux", async () => {
    await ouvrirLesReglages([A_DEUX_PLACES])

    // Deux champs, deux étiquettes — et la phrase **dit lesquels** manquent,
    // pas seulement qu'il manque quelque chose.
    expect(await screen.findByLabelText("le compte")).toBeTruthy()
    expect(screen.getByLabelText("le jeton")).toBeTruthy()
    expect(screen.getByText(/le compte, le jeton/)).toBeTruthy()
  })

  // ── « Déposer une clé ne touche à aucune autre » ──────────────────────────

  test("déposer une place n'écrit que la sienne, et la phrase rétrécit", async () => {
    const { appels } = await ouvrirLesReglages([A_DEUX_PLACES])

    fireEvent.change(await screen.findByLabelText("le compte"), {
      target: { value: "compte-de-lessai" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Déposer" })[0])

    // **Un seul appel, sur un seul nom** : l'écran n'envoie jamais le tiroir
    // entier, sinon un formulaire partiel effacerait ce qu'un autre a posé.
    const envoi = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.includes("/settings/keys/")).pop()
      if (!trouve) throw new Error("rien n'a été déposé")
      return trouve
    })
    expect(envoi.url).toContain("CLOUDFLARE_ACCOUNT_ID")
    expect(envoi.corps).toEqual({ valeur: "compte-de-lessai" })

    // Et l'écran relit ce que le serveur rend : il ne recalcule rien lui-même.
    expect(
      await screen.findByText(/il manque, chez Cloudflare : le jeton/),
    ).toBeTruthy()
    expect(screen.queryByText(/le compte, le jeton/)).toBeNull()
  })

  // ── « Retirer une clé grise ses modèles » ─────────────────────────────────

  test("retirer ne se propose que là où ça retire vraiment", async () => {
    const { appels } = await ouvrirLesReglages([
      {
        fournisseur: "OpenRouter",
        secrets: [
          { ...PLACE_PLEINE, origine: "environnement", retirable: false },
          {
            ...PLACE_PLEINE,
            nom: "AUTRE_CLE",
            libelle: "l'autre clé",
            origine: "fichier",
            retirable: true,
          },
        ],
        manque: null,
        pret: true,
      },
    ])

    // **Une valeur venue de la machine ne s'enlève pas d'ici**, et un bouton
    // qui semblerait le faire serait pire que pas de bouton du tout.
    const retirer = await screen.findAllByRole("button", { name: "retirer" })
    expect(retirer).toHaveLength(1)

    fireEvent.click(retirer[0])
    const envoi = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.includes("/settings/keys/")).pop()
      if (!trouve) throw new Error("rien n'a été retiré")
      return trouve
    })
    expect(envoi.url).toContain("AUTRE_CLE")
  })

  // ── « L'étape de l'assistant reste une fenêtre sur le même tiroir » ───────

  test("l'assistant montre le même tiroir, et déposer là écrit au même endroit", async () => {
    const secrets = [A_DEUX_PLACES]
    const { appels, fetchDouble } = serveurDouble({ secrets, univers: UNIVERS })
    await monter(fetchDouble, { ...ETAT, secrets, univers: UNIVERS })
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "Les fournisseurs" }))

    // **Trois portes, une seule pièce** : c'est le composant des réglages qui
    // est rendu ici, et il envoie sur la même route.
    expect(
      await screen.findByRole("heading", { name: "Les fournisseurs" }),
    ).toBeTruthy()
    // **Seule dans son groupe, parce qu'elle ne dépend d'aucun jeu** — comme la
    // base d'étiquettes. La ligne de repère de l'étape le dit.
    expect(screen.getByText("étape 12 · l'atelier")).toBeTruthy()
    fireEvent.change(await screen.findByLabelText("le jeton"), {
      target: { value: "jeton-de-lessai" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Déposer" })[1])

    const envoi = await waitFor(() => {
      const trouve = appels.filter((a) => a.url.includes("/settings/keys/")).pop()
      if (!trouve) throw new Error("rien n'a été déposé")
      return trouve
    })
    expect(envoi.url).toContain("CLOUDFLARE_API_TOKEN")
  })

  // ── « Aucune clé ne s'affiche jamais en entier » ──────────────────────────

  test("une valeur déposée disparaît du champ, et seul son aperçu reste", async () => {
    await ouvrirLesReglages([A_DEUX_PLACES])

    const champ = (await screen.findByLabelText("le compte")) as HTMLInputElement
    // **Un champ de mot de passe** : la valeur ne se lit pas par-dessus
    // l'épaule pendant qu'on la colle.
    expect(champ.getAttribute("type")).toBe("password")

    fireEvent.change(champ, { target: { value: "compte-tres-secret-123456" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Déposer" })[0])

    await waitFor(() => expect(champ.value).toBe(""))
    expect(document.body.textContent).not.toContain("compte-tres-secret")
    expect(await screen.findByText(/…123456/)).toBeTruthy()
  })

  // ── La barre du haut suit ce qu'on vient de déposer ───────────────────────
  //
  // **Trouvé en vérifiant à la main, pas par un essai** : déposer depuis
  // l'assistant laissait la barre annoncer `1 sur 2` sur un atelier où les deux
  // fournisseurs étaient prêts. Le tiroir de l'étape se tenait à jour tout seul
  // et ne prévenait personne ; la fenêtre des réglages, elle, prévenait déjà.
  // C'est le même dépôt, donc c'est le même geste.

  test("déposer depuis l'assistant met la barre du haut d'accord", async () => {
    const secrets: Tiroir[] = [
      {
        fournisseur: "OpenRouter",
        secrets: [PLACE_VIDE],
        manque: "aucune clé OpenRouter",
        pret: false,
      },
      SANS_SECRET,
    ]
    const { fetchDouble } = serveurDouble({ secrets, univers: UNIVERS })
    await monter(fetchDouble, { ...ETAT, secrets, univers: UNIVERS })

    const barre = document.querySelector("header") as HTMLElement
    expect(await within(barre).findByText("1 sur 2")).toBeTruthy()

    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "Les fournisseurs" }))

    fireEvent.change(await screen.findByLabelText("la clé"), {
      target: { value: "sk-or-v1-depuis-lassistant" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Déposer" }))

    // **Et le grisé des modèles tombe avec**, par le même chemin : ce qu'on
    // vient de servir cesse d'être refusé.
    await waitFor(() =>
      expect(within(barre).getByText("2 fournisseurs prêts")).toBeTruthy(),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F6 · Le brouillon ne coûte plus rien
// ─────────────────────────────────────────────────────────────────────────────
//
// **Ce qui se mesure ici** : ce que l'écran fait du modèle d'exploration devenu
// gratuit. Le garde-fou ne propose que des modèles qui ne coûtent pas d'argent,
// il le dit quand il n'y en a aucun, et la fiche d'une image reconnaît celle qui
// est partie sans le style du jeu. Ce qui se calcule — le modèle imposé, le
// repli quand il disparaît, ce que le plafond du modèle laisse au sol — vit dans
// `tests/test_f6.py`.
//
// **Le trou que la tranche creuse elle-même.** Un modèle gratuit n'accepte
// aucune image d'entrée : le style du jeu ne part pas avec ces images-là. À
// multiplier les brouillons, on se retrouve des semaines plus tard avec des
// images qui ne ressemblent pas aux autres **sans savoir pourquoi** — et c'est
// le genre de question qu'on ne pose jamais deux fois : on jette et on
// recommence.

describe("le brouillon ne coûte plus rien", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Le modèle du fournisseur qui ne facture rien — un jeton par image, aucune
   *  image d'entrée. C'est la forme du seul gratuit mesuré. */
  const LIBRE = {
    ...MODELE,
    identifiant: "libre:sana",
    nom: "sana",
    fournisseur: "libre",
    chez_lui: "sana",
    references_max: 0,
    variations_max: 1,
    unite: "jeton",
  }

  const catalogueAvec = (modeles: typeof CATALOGUE.modeles) => ({
    ...CATALOGUE,
    modeles,
  })

  const ouvrirLesReglages = async (modeles: typeof CATALOGUE.modeles) => {
    const double = serveurDouble({ catalogue: catalogueAvec(modeles) })
    await monter(double.fetchDouble, ETAT)
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))
    await screen.findByRole("heading", { name: "L'agent" })
    return double
  }

  // ── « Il se choisit parmi les modèles qui ne coûtent pas d'argent » ───────

  test("le garde-fou ne propose que des modèles gratuits", async () => {
    await ouvrirLesReglages([MODELE, LIBRE])

    // **Pas un filtre d'affichage : c'est ce que le garde-fou est.** Un modèle
    // d'exploration qui pourrait être le plus cher du catalogue ne protégerait
    // de rien, et le seul moyen honnête de le dire est de ne pas le proposer.
    expect(await screen.findByRole("button", { name: /sana/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: new RegExp(MODELE.nom) })).toBeNull()
  })

  test("choisir un gratuit le pose, et n'envoie que lui", async () => {
    const { appels } = await ouvrirLesReglages([MODELE, LIBRE])

    fireEvent.click(await screen.findByRole("button", { name: /sana/ }))

    const envoi = await waitFor(() => {
      const trouve = appels
        .filter((a) => a.url === "/api/settings/agent" && a.corps)
        .pop()
      if (!trouve) throw new Error("rien n'a été posé")
      return trouve
    })
    // **Ce qui n'est pas dit ne change pas** : un formulaire partiel effacerait
    // le plafond que l'autre bloc vient de poser.
    expect(envoi.corps).toEqual({ modele: "libre:sana" })
  })

  test("un atelier sans modèle gratuit le dit, plutôt que de montrer un vide", async () => {
    await ouvrirLesReglages([MODELE])

    expect(await screen.findByText(/aucun modèle gratuit/)).toBeTruthy()
  })

  // ── « Une image faite sans les références de l'univers se reconnaît » ─────

  const ouvrirLaFicheDe = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const image = asset("aaaa1111-0")
    const double = serveurDouble({ assets: [image], ...options })
    await monter(double.fetchDouble, { ...ETAT, assets: [image] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    return double
  }

  test("la fiche dit qu'une image est partie sans le style du jeu", async () => {
    await ouvrirLaFicheDe({
      aPublier: () => ({
        ...generation("aaaa1111", 1, "reussie"),
        hors_plafond: [
          { asset: "carte-officielle", role: "style", origine: "carte" },
          { asset: "carte-concept", role: "style", origine: "carte" },
        ],
      }),
    })

    // **Le compte, pas un simple avertissement** : savoir combien d'images
    // n'ont pas suivi est la moitié du renseignement.
    expect(await screen.findByText(/partie sans le style du jeu/)).toBeTruthy()
    expect(screen.getByText(/2 images n'ont pas suivi/)).toBeTruthy()
  })

  test("une image faite avec tout ce qu'il fallait ne dit rien", async () => {
    await ouvrirLaFicheDe()

    // **Une ligne qui paraîtrait toujours ne dirait plus rien.** Elle ne
    // s'écrit que quand il y a quelque chose à dire — et une image d'avant F6
    // n'a rien laissé au sol, puisque l'appel était alors refusé tout entier.
    await waitFor(() =>
      expect(screen.queryByText(/sans le style du jeu/)).toBeNull(),
    )
  })
})


// ── 06bis : découper une carte du tableau, sans quitter l'inspiration ─────
//
// La première des quatre remarques mises de côté : « dans univers > toile,
// j'aimerais un mode édition sur une image posée — la découper en plusieurs, la
// recadrer ». Le cas réel est une planche trouvée qui porte trois personnages
// sur un même fond, dont l'auteur veut trois artworks séparés.
//
// **La moitié de la remarque était une hypothèse fausse, et elle a été mesurée
// avant qu'on construise quoi que ce soit** : « je ne veux pas que le fond serve
// de couleur ». Il ne sert déjà pas — l'atelier détoure avant de lire la
// palette, vérifié sur les six artworks du dépôt. Ce qui pollue, ce sont les
// voisins : un titre d'interface, une barre de vie, un second personnage dans le
// même cadre. D'où cette tranche : montrer *ce que la palette lit* à côté de la
// découpe, et pas un outil de gommage — le gommage n'aurait rien réparé.

describe("découper une carte du tableau", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
    reinitialiserApercu()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const CARTE = "planche-nains"

  /** Le menu d'une carte, ouvert par un clic. Le survol l'ouvre aussi, après
   *  200 ms de repos ; un essai n'a pas de pointeur qui se repose, et le clic
   *  l'épingle, ce qui est le même menu. */
  const ouvrirLeMenu = async (quoi = "Ouvrir la carte") => {
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))
    fireEvent.click(await screen.findByRole("button", { name: quoi }))
  }

  const fil = () =>
    document.querySelector("nav[aria-label=\"Où l'on est\"]") as HTMLElement

  const ecran = () => document.querySelector("[data-decoupe]")

  // ── « Découper est dans le menu de la carte, et mène à l'écran » ───────────

  test("le menu d'une carte image mène à la découpe, et le fil dit où l'on est", async () => {
    // **Le geste part d'où la carte est**, et pas d'un écran qu'il faudrait
    // aller chercher : c'est la remarque telle qu'elle a été écrite — « sans
    // sortir de la toile ».
    const { fetchDouble } = serveurDouble({
      cartes: [carteImage(CARTE, { groupe: "trouvailles" })],
    })
    await monter(fetchDouble)
    await ouvrirLeMenu()

    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))

    // L'écran a pris la place du tableau — il ne s'est pas posé dessus.
    await waitFor(() => expect(ecran()).toBeTruthy())

    // **Et il a son étage dans le fil d'Ariane**, comme la découpe d'une planche
    // depuis la galerie. Sans lui, *Échap* serait la seule sortie d'un écran
    // plein cadre.
    expect(fil().textContent).toContain("Inspiration")
    expect(fil().textContent).toContain("trouvailles")
    expect(fil().textContent).toContain("Découpage")

    // Chaque segment ramène à son étage : *Inspiration* rend le tableau.
    fireEvent.click(within(fil()).getByRole("button", { name: "Inspiration" }))
    await waitFor(() => expect(ecran()).toBeNull())
    expect(screen.getByRole("button", { name: "Ouvrir la carte" })).toBeTruthy()
  })

  test("une carte texte n'a rien à découper, et rien n'est grisé pour le dire", async () => {
    // **L'absence est le critère.** Une note ne porte pas d'image ; un
    // *Découper* grisé sur une note demanderait une raison, et la vraie réponse
    // est qu'il n'y a pas de geste à refuser.
    const { fetchDouble } = serveurDouble({
      cartes: [carteImage("une-note", { genre: "texte", texte: "le ton du jeu" })],
    })
    await monter(fetchDouble)
    await ouvrirLeMenu("Ouvrir la note")

    expect(await screen.findByRole("button", { name: "Retirer" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Découper ›" })).toBeNull()
  })

  // ── « Les morceaux sont des cartes, jamais des assets » ────────────────────

  test("découper envoie les rectangles au tableau, et retombe sur lui", async () => {
    // **La route est celle du tableau**, et pas celle de la bibliothèque. C'est
    // tout le sujet de la tranche : les deux familles d'images du produit ne se
    // touchent pas, et un morceau de carte est une carte.
    const { fetchDouble, appels } = serveurDouble({ cartes: [carteImage(CARTE)] })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))

    // Les deux rectangles proposés sont là avant qu'on ait touché un réglage —
    // et le mot compte : ce ne sont pas des assets.
    expect(
      await screen.findByRole("button", { name: "Découper en 2 cartes" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Découper en 2 cartes" }))

    await waitFor(() => {
      const envoi = appels.find(
        (a) => a.url === `/api/board/${CARTE}/slices` && a.corps,
      )
      if (!envoi) throw new Error("rien n'est parti au tableau")
      expect(envoi.corps).toEqual({
        boites: [
          [10, 10, 200, 400],
          [300, 10, 500, 400],
        ],
        remplacer: false,
      })
    })

    // **Rien à ouvrir derrière** : les morceaux arrivent en réserve, non promus,
    // et promouvoir reste un geste. On retombe sur le tableau, où ils sont.
    await waitFor(() => expect(ecran()).toBeNull())
  })

  // ── « Recadrer prend la place, et se demande » ─────────────────────────────

  test("remplacer l'originale ne se propose qu'à un seul rectangle", async () => {
    // **À plusieurs, la question n'a pas de réponse** : un morceau parmi
    // plusieurs ne peut pas prétendre être l'originale. La case n'est donc pas
    // grisée — elle n'est pas là.
    const { fetchDouble, appels } = serveurDouble({ cartes: [carteImage(CARTE)] })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))
    await screen.findByRole("button", { name: "Découper en 2 cartes" })

    expect(screen.queryByText(/prend la place de l'originale/)).toBeNull()

    // On retire un rectangle : la question devient posable, et elle est posée.
    fireEvent.click(screen.getAllByRole("button", { name: /^Retirer le rectangle/ })[0])
    const bascule = (
      await screen.findByText(/prend la place de l'originale/)
    ).closest("button")!

    // **Décochée par défaut, et c'est la moitié de la décision** : c'est le seul
    // endroit du produit où découper efface quelque chose.
    expect(bascule.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(bascule)
    expect(bascule.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Découper en 1 carte" }))
    await waitFor(() => {
      const envoi = appels.find(
        (a) => a.url === `/api/board/${CARTE}/slices` && a.corps,
      )
      if (!envoi) throw new Error("rien n'est parti")
      expect((envoi.corps as { remplacer: boolean }).remplacer).toBe(true)
    })
  })

  // ── « Ce que la palette y lit » ───────────────────────────────────────────

  test("le menu d'un artwork promu dit quelle part nourrit la palette", async () => {
    // **La réponse à la question qui revenait à chaque promotion** : « est-ce
    // que mon fond va polluer mes couleurs ? ». Non — et le chiffre le montre
    // au lieu de le promettre.
    const { fetchDouble, appels } = serveurDouble({
      cartes: [carteImage(CARTE, { officiel: true, famille: "personnages" })],
    })
    await monter(fetchDouble)
    await ouvrirLeMenu()

    // **Rien n'est parti tout seul.** Ce menu s'ouvre au survol ; une mesure qui
    // se lancerait sans qu'on la demande ferait travailler l'atelier chaque fois
    // que le pointeur traverse une carte promue.
    const lectures = () => appels.filter((a) => a.url === `/api/board/${CARTE}/palette`)
    expect(await screen.findByRole("button", { name: "regarder" })).toBeTruthy()
    expect(lectures()).toHaveLength(0)

    fireEvent.click(screen.getByRole("button", { name: "regarder" }))
    await waitFor(() => expect(lectures()).toHaveLength(1))
    expect(await screen.findByText("33.4 %")).toBeTruthy()
    expect(screen.getByText(/le fond — est écarté tout seul/)).toBeTruthy()
  })

  test("quand le détourage a tout mangé, on ne lit pas « 0 % »", async () => {
    // **Zéro n'est pas un trou, c'est un cas nommé.** Une matière plein cadre,
    // une texture sans bord franc : la palette reprend l'image entière. Écrire
    // « 0 % » dirait l'inverse exact de ce qui se passe.
    const { fetchDouble } = serveurDouble({
      cartes: [carteImage(CARTE, { officiel: true })],
      lecture: { carte: CARTE, part: 0, entiere: true, largeur: 512, hauteur: 512 },
    })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "regarder" }))

    expect(await screen.findByText(/l'image entière donne ses couleurs/)).toBeTruthy()
    expect(screen.queryByText("0 %")).toBeNull()
  })

  test("à 100 %, la carte ne parle pas d'un reste qui n'existe pas", async () => {
    // **La phrase se contredisait dans sa propre longueur** (G1) : « 100 % de
    // l'image donne ses couleurs au jeu. Le reste — le fond — est écarté tout
    // seul. » Il n'y a pas de reste. Mesuré le 3 septembre 2026 sur les dix
    // artworks officiels du dépôt : **trois** sont lus à 100,0 %, parce que le
    // détourage n'y trouve aucun fond à retirer.
    //
    // Ce n'est pas le cas de `entiere`, qui dit l'inverse — le détourage a tout
    // mangé et la palette reprend l'image entière. Les deux se ressemblent à
    // l'écran et n'ont pas la même cause.
    const { fetchDouble } = serveurDouble({
      cartes: [carteImage(CARTE, { officiel: true })],
      lecture: { carte: CARTE, part: 100, entiere: false, largeur: 512, hauteur: 512 },
    })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "regarder" }))

    expect(await screen.findByText("100 %")).toBeTruthy()
    expect(screen.getByText(/n'a trouvé aucun fond à retirer/)).toBeTruthy()
    expect(screen.queryByText(/le fond — est écarté tout seul/)).toBeNull()
    // Et rien n'envoie voir un magenta qui ne couvrirait aucun pixel.
    expect(screen.queryByText(/Découper le montre en magenta/)).toBeNull()
  })

  test("une carte non promue ne montre aucune lecture de palette", async () => {
    // Une carte qui n'est pas un artwork officiel ne nourrit aucune palette :
    // lui poser un chiffre à côté dirait qu'elle compte, ce qui est faux.
    const { fetchDouble } = serveurDouble({ cartes: [carteImage(CARTE)] })
    await monter(fetchDouble)
    await ouvrirLeMenu()

    expect(await screen.findByRole("button", { name: "Découper ›" })).toBeTruthy()
    expect(screen.queryByText("Ce que la palette y lit")).toBeNull()
  })

  test("l'écran de découpe montre en magenta ce que la palette écarte", async () => {
    // **C'est là que l'image vit, et pas dans le menu.** Mesuré à l'atelier
    // lancé : le menu d'une carte est borné par l'écran et tombe à 206 px de
    // haut sur une carte du bas de la grille — un aperçu de 240 px y défilait
    // dans un hublot plus petit que lui. Ici l'image prend la moitié gauche de
    // l'écran, et c'est l'endroit où l'on peut agir sur ce qu'elle montre.
    const { fetchDouble } = serveurDouble({
      cartes: [carteImage(CARTE, { officiel: true })],
    })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))

    // Demandée d'entrée : cet écran s'ouvre par un clic, pas par un survol, et
    // la détection part déjà toute seule.
    expect(await screen.findByText("33.4 %")).toBeTruthy()

    const image = () =>
      document.querySelector("[data-decoupe] img") as HTMLImageElement
    const bascule = () =>
      screen.getByText("me le montrer sur l'image").closest("button")!
    expect(image().getAttribute("src")).toContain(`/api/board/${CARTE}/image`)

    fireEvent.click(bascule())
    await waitFor(() =>
      expect(image().getAttribute("src")).toContain(
        `/api/board/${CARTE}/palette/image`,
      ),
    )

    // **Et ce n'est pas l'image de la carte** : c'est un instrument. On le
    // range, et la carte est rendue telle qu'elle est.
    fireEvent.click(bascule())
    await waitFor(() =>
      expect(image().getAttribute("src")).toContain(`/api/board/${CARTE}/image`),
    )
  })

  test("changer d'onglet remonte de la découpe, comme de toute profondeur", async () => {
    // **La règle vaut pour tout étage** (U1) : cliquer un onglet est le geste
    // qui dit « ailleurs ». Un écran qu'aucun onglet ne peut fermer est une
    // souricière, et le produit en a déjà payé une.
    const { fetchDouble } = serveurDouble({ cartes: [carteImage(CARTE)] })
    await monter(fetchDouble)
    await ouvrirLeMenu()
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))
    await waitFor(() => expect(ecran()).toBeTruthy())

    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
    fireEvent.click(screen.getByRole("tab", { name: "Univers" }))

    await waitFor(() => expect(ecran()).toBeNull())
    expect(await screen.findByRole("button", { name: "Ouvrir la carte" })).toBeTruthy()
  })
})

// ── R6 : la planche qui revient de travers ne se jette plus ─────────────────
//
// **Les deux critères de la tranche qui ne se vérifient que devant l'écran.**
// Le reste vit dans `tests/test_r6.py` : ce que la planche a rendu, ce qu'un
// choix fait entrer, ce qu'un refus garde au journal. Ici, une seule chose est
// en jeu, et elle est visuelle — **un appel payé ne doit pas s'évanouir**.
//
// Le défaut qu'ils attrapent est mécanique et invisible côté serveur : une
// planche en attente est *réussie*, donc sa tuile quittait le chantier ; et rien
// n'étant entré en bibliothèque, aucun asset ne prenait sa place. L'auteur
// voyait sa tuile disparaître et n'avait plus aucun chemin vers ce qu'il venait
// de payer.

describe("R6 — la planche qui attend un regard", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
    doublerLaMesure()
    toutReplier()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /** Une planche arrivée qui porte N sujets pour huit cases (R6).
   *
   *  Les boîtes sont posées sur une grille régulière : l'écran s'en sert pour
   *  découper les sujets dans l'image de la planche, et un essai qui les
   *  laisserait toutes à zéro ne prouverait rien du cadrage. */
  const planche = (
    trouvees: number,
    { pleines = [] as number[], demandees = 8 } = {},
  ): Generation => {
    const lot = generation("pppp0000", 1, "reussie")
    return {
      ...lot,
      pliage: {
        nombre: demandees,
        colonnes: 3,
        lignes: 3,
        refus: null,
        trouvees,
        mesures: Array.from({ length: trouvees }, (_, i) => ({
          case: i,
          cases: trouvees,
          grille_px: 4,
          ressemblance: 0.2,
          jumeau: -1,
          derive: 1,
          remplissage: pleines.includes(i) ? 1 : 0.55,
          boite: [
            40 + (i % 3) * 320,
            40 + Math.floor(i / 3) * 320,
            300 + (i % 3) * 320,
            300 + Math.floor(i / 3) * 320,
          ] as [number, number, number, number],
          pleine: pleines.includes(i),
        })),
        ecartees: null,
        surplus: Math.max(0, trouvees - demandees),
        pleines,
        attend_un_choix: trouvees > demandees || pleines.length > 0,
      },
    }
  }

  const sujets = () => screen.queryAllByRole("button", { name: /^sujet n° \d+/ })
  const garder = () => screen.getByRole("button", { name: /^Garder/ })

  async function ouvrirLeChoix(attendue: Generation) {
    act(() => FluxDouble.ouverts[0].emettre("generation", attendue))
    fireEvent.click(
      await screen.findByRole("button", { name: "Choisir ce qu'on garde" }),
    )
    await waitFor(() =>
      expect(sujets()).toHaveLength(attendue.pliage?.trouvees ?? 0),
    )
  }

  // ── « Une planche à neuf sujets pour huit demandés entre, avec le choix de
  //     la case à écarter » (US-367) ──────────────────────────────────────────

  test("une planche qui attend garde sa tuile au lieu de s'évanouir", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    laGalerie()

    act(() => FluxDouble.ouverts[0].emettre("generation", planche(9)))

    // Elle est **réussie** : sans la ligne que R6 ajoute à la grille, cette
    // tuile aurait disparu, et rien ne l'aurait remplacée — l'appel payé se
    // serait perdu sous les yeux de l'auteur.
    expect(
      await screen.findByRole("button", { name: "Choisir ce qu'on garde" }),
    ).toBeTruthy()
    // Et elle montre ce qu'on a acheté, pas un carré vide.
    expect(
      document.querySelector('img[src="/api/generations/pppp0000/slots/0/image"]'),
    ).toBeTruthy()
  })

  test("la tuile dit ce qui cloche, en clair, sans dire « échec »", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    laGalerie()
    act(() => FluxDouble.ouverts[0].emettre("generation", planche(9)))

    expect(await screen.findByText("9 sujets · 1 de trop")).toBeTruthy()
    // **Aucun mot d'échec**, et c'est le point : rien n'a raté, rien ne se
    // relance, et rien n'a été perdu.
    expect(screen.queryByRole("button", { name: "Relancer" })).toBeNull()
  })

  test("écarter un sujet arme le bouton, et ce qui part est le numéro cliqué", async () => {
    const attendue = planche(9)
    const { fetchDouble, appels } = serveurDouble({ aPublier: () => attendue })
    await monter(fetchDouble)
    laGalerie()
    // Neuf sujets à l'écran, découpés par la page dans l'image de la planche —
    // aucune vignette n'existe côté serveur, c'est tout l'enjeu de la tranche.
    await ouvrirLeChoix(attendue)

    // **Neuf gardés pour huit cases : le bouton est fermé**, et il dit pourquoi.
    expect((garder() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/il en reste 1 de trop/)).toBeTruthy()

    fireEvent.click(sujets()[2])
    await waitFor(() => expect((garder() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(garder())
    await waitFor(() => {
      const parti = appels.find((a) => a.url.endsWith("/unfold"))
      expect(parti?.corps).toEqual({ ecartees: [2] })
    })
  })

  test("écarter deux sujets de trop referme le bouton — le compte doit tomber juste", async () => {
    const attendue = planche(9)
    const { fetchDouble, appels } = serveurDouble({ aPublier: () => attendue })
    await monter(fetchDouble)
    laGalerie()
    await ouvrirLeChoix(attendue)

    fireEvent.click(sujets()[0])
    fireEvent.click(sujets()[1])

    await waitFor(() =>
      expect((garder() as HTMLButtonElement).disabled).toBe(true),
    )
    expect(screen.getByText(/il en manque 1/)).toBeTruthy()
    expect(appels.some((a) => a.url.endsWith("/unfold"))).toBe(false)
  })

  test("l'écran du choix n'appelle jamais le fournisseur", async () => {
    // **La phrase la plus importante de cet écran est une absence.** On y
    // regarde une planche déjà payée ; le seul geste qui coûterait — relancer —
    // n'y est pas, et aucun appel de génération n'en part.
    const attendue = planche(9)
    const { fetchDouble, appels } = serveurDouble({ aPublier: () => attendue })
    await monter(fetchDouble)
    laGalerie()
    await ouvrirLeChoix(attendue)

    fireEvent.click(sujets()[4])
    fireEvent.click(garder())

    await waitFor(() =>
      expect(appels.some((a) => a.url.endsWith("/unfold"))).toBe(true),
    )
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  // ── « Une planche au quadrillage redessiné est signalée en toutes lettres,
  //     jamais acceptée en silence » (US-368) ─────────────────────────────────

  test("huit cases pleines pour huit demandées arrêtent quand même la planche", async () => {
    // **Le compte tombe juste, et c'est tout le piège.** Rien dans
    // l'arithmétique ne distingue huit cases bordées de huit personnages.
    const quadrillee = planche(8, { pleines: [0, 1, 2, 3, 4, 5, 6, 7] })
    const { fetchDouble } = serveurDouble({ aPublier: () => quadrillee })
    await monter(fetchDouble)
    laGalerie()

    act(() => FluxDouble.ouverts[0].emettre("generation", quadrillee))
    expect(await screen.findByText("8 sujets · 8 cases pleines")).toBeTruthy()
    fireEvent.click(
      await screen.findByRole("button", { name: "Choisir ce qu'on garde" }),
    )

    expect(
      await screen.findByText(/c'est le quadrillage que le modèle a redessiné/),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "rien n'est entré en bibliothèque tant que vous n'avez pas tranché",
      ),
    ).toBeTruthy()
  })

  test("garder tout est une décision, et elle part comme telle", async () => {
    // La liste vide est une réponse, pas une absence de réponse : c'est ce qui
    // fait entrer huit carrés pleins **après** que quelqu'un les a vus.
    const quadrillee = planche(8, { pleines: [0, 1, 2, 3, 4, 5, 6, 7] })
    const { fetchDouble, appels } = serveurDouble({ aPublier: () => quadrillee })
    await monter(fetchDouble)
    laGalerie()
    await ouvrirLeChoix(quadrillee)

    // Huit gardés pour huit cases : le compte est juste d'emblée.
    expect((garder() as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(garder())
    await waitFor(() => {
      const parti = appels.find((a) => a.url.endsWith("/unfold"))
      expect(parti?.corps).toEqual({ ecartees: [] })
    })
  })

  test("le dépliage fait, l'écran se referme sans que personne le ferme", async () => {
    // Il ne tient pas de copie de la planche : il la relit dans le chantier. Le
    // lot revient sans `attend_un_choix`, et l'écran n'a plus de raison d'être.
    const attendue = planche(9)
    const { fetchDouble } = serveurDouble({ aPublier: () => attendue })
    await monter(fetchDouble)
    laGalerie()
    await ouvrirLeChoix(attendue)

    fireEvent.click(sujets()[8])
    fireEvent.click(garder())

    await waitFor(() => expect(sujets()).toHaveLength(0))
    expect(screen.queryByText("Ce que la planche a rendu")).toBeNull()
  })
})
