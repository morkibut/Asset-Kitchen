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
import { toutReplier } from "./composants/pieces"
import { reinitialiserGuide } from "./composants/Guide"
import { reinitialiserPressePapier } from "./recette"
import { AIDE, SANS_ENTREE, type Explication } from "./aide"
import { POSE_VIDE } from "./api"
import { COULEUR_TEINTE, NOM_TEINTE, PASSE_PAR_DEFAUT, RECETTE_VIDE, TEINTES } from "./api"
import { UNIVERS_VIDE } from "./api"
import type {
  Envoi,
  Tri,
  Asset,
  BilanDuJeu,
  Bibliotheque,
  Boite,
  Cadrage,
  Carte,
  Case,
  LectureDePalette,
  Direction,
  DirectionsDuJeu,
  Calibrage,
  PoseCalee,
  PorteeDeLaPiece,
  PropositionDeBaisse,
  Depenses,
  Etat,
  Etiquette,
  BaseMouvements,
  BaseStyles,
  StyleDuPersonnage,
  BaseModelesVideo,
  EtatDuMoteur,
  EtatInstallation,
  ImageDeDepart,
  ApercuDeBande,
  AtelierDeBande,
  Prise,
  Stabilite,
  Bande,
  Montage,
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
  Projet,
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
  son: UNIVERS_VIDE.son,
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
    // **Ce qu'il porte** (`B19`) — vide par défaut : un sujet ne porte rien
    // tant qu'on ne le dit pas, et c'est le critère de la tranche.
    pieces: [],
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
      dernier_travail_le: 1_787_800_000,
      assets: 0,
      total_usd: 0,
      univers: UNIVERS_VIDE,
      pieces: [],
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

// ── Les mouvements livrés (A6) ───────────────────────────────────────────────
//
// **Trois des sept, et c'est assez.** Ce que l'écran doit montrer est une liste
// de mouvements livrés, la marque de ce qui a été nommé ici, et le texte anglais
// qui part — pas le catalogue entier. Recopier les sept ferait de cet essai un
// second endroit à corriger le jour où l'on en livre un huitième.
const MOUVEMENTS: BaseMouvements["mouvements"] = [
  {
    identifiant: "repos",
    nom: "repos",
    texte: "idle breathing loop, standing still, looping seamlessly",
    cadence: 8,
    directions: [],
    livre: true,
    masque: false,
  },
  {
    identifiant: "marche",
    nom: "marche",
    texte: "walking cycle, full body, walking in place, looping seamlessly",
    cadence: 12,
    directions: [],
    livre: true,
    masque: false,
  },
  {
    identifiant: "mort",
    nom: "mort",
    texte: "death, collapsing to the ground, then lying still",
    cadence: 10,
    directions: ["sud"],
    livre: true,
    masque: false,
  },
]

// ── Les styles de combat livrés (SC1, SC4) ──────────────────────────────────
//
// **Un seul, et c'est assez** — même raison que `MOUVEMENTS` ci-dessus : ce
// que l'écran doit montrer est une liste, un texte par mouvement, et la marque
// de ce qui a été nommé ici.
const STYLES: BaseStyles["styles"] = [
  {
    identifiant: "baton",
    nom: "bâton à deux mains",
    tient: "a long wooden staff held in both hands",
    textes: {
      marche: "a two-handed staff carried while walking, staying in place",
    },
    livre: true,
    masque: false,
  },
]

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
  // **Ce que le serveur désigne, pièce par pièce** (US-504) : sans calque, il
  // n'y a rien à désigner, et la marque du retenu ne paraît nulle part.
  retenus: {},
  corps: null,
  origine: "type",
  directions: [],
  directions_rangees: [],
  sans_direction: [],
  // **Et le calque animé, vide** (A12) — l'état d'un jeu qui n'a encore rien
  // animé, c'est-à-dire l'immense majorité des essais. `bandes_demandees` vaut
  // un et non `demandees` : une attitude réclame **une animation par
  // direction**, pas autant d'animations que d'images.
  bandes: [],
  // **Ce qui a été écarté, vide** (B11) — l'état d'un jeu qui n'a encore rien
  // écarté, c'est-à-dire l'immense majorité des essais.
  bandes_ecartees: [],
  bandes_demandees: 1,
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
// **RG2** (`docs/PLAN-rangement.md`) — `capacites` et `se_decoupe` rendus par
// `GET /characters/types` depuis cette tranche. Les quatre types ci-dessous
// reprennent la table de D1 au mot près.
const CAPACITES_PLEINES = { directions: true, anime: true, sons: true, matiere: false }
const TYPES: PosesDesTypes["types"] = [
  { nom: "personnage", origine: "projet", poses: PLAN, connues: PLAN, capacites: CAPACITES_PLEINES, se_decoupe: true },
  { nom: "créature", origine: "projet", poses: PLAN, connues: PLAN, capacites: CAPACITES_PLEINES, se_decoupe: true },
  {
    nom: "meuble",
    origine: "connue",
    poses: POSES_DU_MEUBLE,
    connues: POSES_DU_MEUBLE,
    capacites: { directions: false, anime: true, sons: true, matiere: false },
    se_decoupe: true,
  },
  {
    nom: "tuile",
    origine: "connue",
    poses: [],
    connues: [],
    capacites: { directions: false, anime: true, sons: false, matiere: false },
    se_decoupe: false,
  },
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
      retournement: null,
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

// ── Le catalogue vidéo, et ce qu'un clip rend (A9) ───────────────────────────
//
// **Trois modèles, dont un grisé et un local.** Ce que l'écran doit prouver est
// qu'il en propose un avec son prix *et sa formule*, qu'il refuse l'autre **avec
// sa raison** plutôt que de le cacher, qu'il écrit à côté de chacun ce que ce
// dépôt a mesuré de lui — vide compris —, et depuis `A11` qu'il annonce **un
// temps là où le modèle ne coûte pas d'argent**.

/** Ce que vaut zéro chez un modèle payant. **Écrit une fois** : les champs
 *  d'`A11` existent sur tous les modèles, précisément pour que l'écran n'ait pas
 *  à savoir lesquels les portent. */
const SANS_MOTEUR_LOCAL = {
  de_la_maison: false,
  images_par_seconde: 0,
  duree_conseillee: 0,
  raison_de_la_duree: "",
  images_par_duree: {},
  attente: null,
} as const

const MODELES_VIDEO: BaseModelesVideo = {
  // **L'ordre est celui du serveur** (V3.01.2) : le moteur de la maison
  // d'abord — celui qui ne coûte rien —, puis les payants par prix croissant
  // pour la demande courante, et les modèles dont le prix n'a pas pu être relu
  // en fin de liste. L'écran n'a pas de règle de tri à lui.
  modeles: [
    {
      // **Le moteur de la maison, en tête de liste et dans la même liste**
      // (A11, V3.01.2). Son prix vaut zéro *et il le sait* : ce n'est pas un
      // tarif illisible, c'est une machine qui ne facture rien.
      identifiant: "maison/wan-2.2-i2v-14b-pixel",
      nom: "Wan 2.2 · sur votre machine",
      fournisseur: "Maison",
      durees: [1, 2, 3],
      resolutions: ["480p"],
      proportions: ["1:1", "16:9", "9:16"],
      mesure: "Mesuré le 3 septembre 2026 sur une RTX 3080 Laptop bridée à 100 W.",
      prix: {
        montant: 0,
        formule: "gratuit — la carte de la maison",
        nature: "certain",
        releve_le: null,
      },
      grise: null,
      de_la_maison: true,
      images_par_seconde: 16,
      duree_conseillee: 1,
      raison_de_la_duree:
        "Une seconde donne une bande nettement plus propre que deux. ⚠️ Aucune " +
        "mesure automatique ne voit cette dégradation — seul l'œil la voit.",
      images_par_duree: { "1": 17, "2": 33, "3": 49 },
      attente: {
        secondes: 129,
        secondes_suivant: 80,
        premier: true,
        images: 17,
        mesure: "7,6 s par image — premier tirage, le modèle se charge",
        nature: "attente",
      },
    },
    {
      identifiant: "bytedance/seedance-2.0-mini",
      nom: "Seedance 2.0 Mini",
      fournisseur: "openrouter",
      durees: [4, 5, 6],
      resolutions: ["480p", "720p"],
      proportions: ["1:1", "16:9"],
      mesure:
        "3 clips payés, 2 notés bons sur 2. Sous la barre des 8 tirages : " +
        "c'est une proposition étayée, pas un arbitrage clos.",
      prix: {
        montant: 0.0945,
        formule: "0,0000035 $ le jeton (video_tokens) × 480×480×24×5/1024 = 27 000 jetons",
        nature: "estimation",
        releve_le: null,
      },
      grise: null,
      ...SANS_MOTEUR_LOCAL,
    },
    {
      identifiant: "essai/sans-tarif",
      nom: "Aleph 2",
      fournisseur: "openrouter",
      durees: [5],
      resolutions: ["480p"],
      proportions: ["1:1"],
      mesure: "",
      prix: { montant: null, formule: "aucun tarif reconnu", nature: "estimation", releve_le: null },
      grise:
        "son prix n'a pas pu être relu chez le fournisseur — aucun tarif reconnu",
      ...SANS_MOTEUR_LOCAL,
    },
  ],
  recu_le: 1_787_800_000,
  raison: null,
  manque: null,
  decodeur: null,
  moteurs: [
    { nom: "openrouter", manque: null },
    {
      nom: "Maison",
      manque: null,
      moteur: {
        allume: true,
        grise: null,
        manquants: [],
        go_a_telecharger: 0,
        greffon_absent: false,
        carte: "cuda:0 NVIDIA GeForce RTX 3080 Laptop GPU",
        memoire_libre_go: 6.7,
        phrase: "",
      },
    },
  ],
  demande: { secondes: 5, resolution: "480p", proportions: "1:1" },
}

/** La machine en ordre : tout est là, il n'y a rien à dire — et **rien à dire
 *  est une réponse**, pas un trou. */
const MOTEUR_EN_ORDRE: EtatDuMoteur = {
  allume: true,
  grise: null,
  manquants: [],
  go_a_telecharger: 0,
  greffon_absent: false,
  carte: "cuda:0 NVIDIA GeForce RTX 3080 Laptop GPU",
  memoire_libre_go: 6.7,
  phrase: "",
}

/** Ce que le serveur propose comme image de départ. **Le portrait**, parce que
 *  c'est le cas par défaut : la case visée est vide dans la plupart des essais,
 *  et c'est celui que la règle traite en second. */
const DEPART_PROPOSE: ImageDeDepart = {
  asset: asset("aaaa1111-0", "le nain, de profil"),
  origine: "portrait",
  raison:
    "le portrait de Le nain — la première image qu'il montre de lui à chacun " +
    "de ses appels.",
}

/** Une génération de clip, telle que le serveur la rend. Elle est **réussie et
 *  arrivée** : c'est l'état où la galerie doit lui garder sa place et montrer
 *  une image prélevée dedans, jamais une tuile en erreur. */
function clipRendu(
  identifiant: string,
  jete: boolean,
  sur: Partial<Generation> = {},
): Generation {
  const gabarit = generation(identifiant, 1, "reussie")
  return {
    ...gabarit,
    ...sur,
    modele: "bytedance/seedance-2.0-mini",
    demande: {
      ...gabarit.demande,
      prompt: "walking cycle, walking in place",
      // **Le mouvement inscrit à la commande** (A6, V3.01.1) : c'est lui que la
      // fiche lit, et que le montage nomme pour ses bandes.
      mouvement: "marche",
    },
    cout_usd: 0.067,
    consomme: 0.067,
    emplacements: [{ ...gabarit.emplacements[0], statut: "reussie" }],
    clip: {
      travail: `travail-${identifiant}`,
      secondes: 5,
      proportions: "1:1",
      resolution: "480p",
      prix_annonce: 0.0945,
      prix_formule: "0,0000035 $ le jeton × 480×480×24×5/1024",
      images: 121,
      cadence: 24,
      extraction_refus: null,
      montant_relu: true,
      recupere: false,
      jete,
      lot: "lot-1",
      depart: "",
      montant_dit: "montant relu chez le fournisseur",
    },
  }
}


/** Ce que le serveur rend à l'ouverture d'un montage (A10).
 *
 *  **Deux propositions et une fenêtre**, parce que c'est l'état complet : un
 *  clip qui n'en aurait aucune est un cas à part, et le double du cas courant
 *  doit être le cas courant. Le clip fait 24 images pour que le compte reste
 *  lisible dans les assertions — le vrai en porte cent vingt. */
const MONTAGE_RENDU: Montage = {
  clip: {
    identifiant: "clip-a",
    images: 24,
    cadence: 24,
    largeur: 480,
    hauteur: 480,
    secondes: 1,
    commande_secondes: 5,
    montant_dit: "montant relu chez le fournisseur",
    consomme: 0.067,
    unite: "usd",
    mouvement: "marche",
    texte: "walking cycle, walking in place",
    projet: "jeu-1",
    personnage: "chose-1",
    pose: "marche",
    direction: "sud",
  },
  contact: { cote: 96, colonnes: 16, lignes: 2 },
  recette_du_jeu: {
    ...RECETTE_VIDE,
    passes: [{ ...PASSE_PAR_DEFAUT }],
    grille: {
      cible: 64,
      occupation: 80,
      ancrage: "bas",
      decalage: 0,
      methode: "proche",
    },
    quantification: { couleurs: 24, palette: [], tramage: "aucun" },
  },
  fenetre: {
    gauche: 0,
    sommet: 0,
    droite: 245,
    bas: 380,
    largeur: 246,
    hauteur: 381,
    images: 24,
    taches_ecartees: 3,
  },
  propositions: [
    {
      quoi: "repos",
      debut: 4,
      fin: 11,
      images: [4, 5, 6, 7, 8, 9, 10, 11],
      mot: "ici, il ne bouge presque pas — 8 images, images 4 à 11",
      mesure: 0.002,
      longueur: 8,
    },
    {
      quoi: "boucle",
      debut: 12,
      fin: 23,
      images: [12, 14, 16, 18, 20, 22],
      mot: "ici, la boucle se referme le mieux — 12 images, images 12 à 23",
      mesure: 0.31,
      longueur: 12,
    },
  ],
  bandes: [],
  prix: {
    clip: 0.067,
    unite: "usd",
    bandes: 0,
    par_bande: 0.067,
    si_une_de_plus: 0.0335,
  },
  images_max: 64,
}

/** La bande montée. **Une planche de sprites**, pas une liste d'images : c'est
 *  ce que l'écran anime et ce que l'export écrira. */
const APERCU_RENDU: ApercuDeBande = {
  planche: "data:image/png;base64,",
  case_largeur: 64,
  case_hauteur: 64,
  compte: 8,
  largeur: 512,
  hauteur: 64,
  fenetre: MONTAGE_RENDU.fenetre,
  cadre: {
    choix: "clip",
    gauche: 0,
    sommet: 0,
    droite: 245,
    bas: 380,
    largeur: 246,
    hauteur: 381,
    mot: "pris sur le clip entier — toutes ses bandes ont la même assise",
  },
  ecarts: [],
  // Le sujet seul, sans cadre autour de lui : c'est lui que l'écran repose dans
  // la boîte pendant qu'on la tire, sans redemander une image par pixel.
  sujet: "data:image/png;base64,",
  sujet_largeur: 200,
  sujet_hauteur: 340,
  ancrage: "bas",
  // Ce qui bouge entre les images (A5). Le chiffre qui compte est celui des
  // allers-retours : sur tout ce qui bouge, ce qui est revenu en arrière.
  stabilite: {
    images: 8,
    contour: 585,
    contour_mesure: 1982,
    part_du_contour: 0.295,
    allers_retours: 117,
    part_des_allers_retours: 0.2,
    couleurs: 24,
    couleurs_d_une_image: 3,
    part_des_couleurs: 0.125,
  },
}

function bandeRendue(nom: string, images: number[], prises?: Prise[]): Bande {
  // Sans correction, une prise n'est qu'un numéro — c'est très exactement ce
  // que les bandes d'`A10` voulaient dire, et ce que le serveur relit d'elles.
  const retenues =
    prises ?? images.map((numero) => ({ numero, clip: "", dx: 0, dy: 0 }))
  const venus = [...new Set(retenues.map((p) => p.clip || "clip-a"))]
  return {
    identifiant: `bande-${nom}`,
    clip: "clip-a",
    nom,
    images,
    prises: retenues,
    // **Le chutier naît vide** (V3.03.3), et c'est l'état de toute bande qu'on
    // vient de tailler : la réserve se remplit de ce qu'on retire du ruban et
    // de ce qu'on va chercher dans le clip.
    chutier: [],
    clips: venus,
    melangee: venus.length > 1,
    cadence: 8,
    sens: "boucle",
    cadre: APERCU_RENDU.cadre,
    pivot: null,
    recette: MONTAGE_RENDU.recette_du_jeu,
    projet: "jeu-1",
    personnage: "chose-1",
    pose: null,
    direction: null,
    planche: `generations/clip-a/bandes/bande-${nom}.png`,
    case_largeur: 64,
    case_hauteur: 64,
    cree_le: 1_787_800_000,
    compte: images.length,
    secondes: images.length / 8,
    brouillon: true,
    // **État par défaut d'une bande** (B11) : rien de retenu, rang neutre,
    // pas écartée — la même valeur que ce champ prend sur toute bande qui n'a
    // encore reçu aucun de ces trois gestes.
    favori: false,
    rang: 0,
    supprime_le: null,
    supprime: false,
    // **L'état d'une bande nue** (B20) : elle ne porte aucune pièce, et c'est
    // celui de toute bande d'avant la tranche — aucun fichier n'a été réécrit
    // pour lui donner ces cinq champs.
    piece: null,
    habillage: null,
    habillee: false,
    calages: [],
    calage_garde: null,
  }
}

/** L'animation que le double rend quand on rouvre (A7), et le rectangle qu'une
 *  remesure lui donne. Deux constantes plutôt que des nombres au fil des essais :
 *  ce qui compte est **qu'ils diffèrent**, et le dire une fois l'écrit une fois. */
const GARDEE_A7: Bande = {
  ...bandeRendue("marche", [12, 14, 16, 18]),
  cadence: 11,
  sens: "aller-retour",
}

/** Les clips où l'animation a le droit d'aller chercher une image — ceux du
 *  même personnage. Deux, parce qu'un seul ne serait pas un choix et que
 *  l'écran ne montre alors pas de liste. */
const VOISINS_A7 = [
  { identifiant: "clip-a", mouvement: "marche", images: 22, sien: true },
  { identifiant: "clip-b", mouvement: "course", images: 18, sien: false },
]

/** Ce que le serveur rend quand on rouvre une animation. **Une constante plutôt
 *  qu'un littéral par essai** : la charge s'est allongée deux fois — les écarts
 *  en V3.03.1, la planche contact et le plafond en V3.03.3 —, et chaque essai
 *  qui l'écrivait en entier a dû être repris à chaque fois. Ce qu'un essai veut
 *  poser, il le pose **par-dessus**. */
const ATELIER_RENDU: AtelierDeBande = {
  bande: GARDEE_A7,
  planche: "data:image/png;base64,AAAA",
  clips: { "clip-a": clipRendu("clip-a", false) },
  images_par_clip: { "clip-a": 22 },
  cadre: { choix: "clip", a_jour: true, mesuree_le: 1_787_800_000 },
  clips_voisins: VOISINS_A7,
  ecarts: GARDEE_A7.prises.map(() => ({ places: [], fenetre_davant: false })),
  // La géométrie de la planche contact (V3.03.3) : elle vient du serveur, qui
  // a écrit l'image avec — recopiée à l'écran, elle décalerait la pellicule
  // d'une case le jour où l'une des deux changerait.
  contact: { cote: 96, colonnes: 16 },
  images_max: 64,
}

/** Ce que chaque frame écarte de la recette de la bande (V3.03.1).
 *
 *  **Le double rejoue la règle du serveur, mots compris** —
 *  `ServiceMontage._ecarts_des_prises`. Un double qui rendrait une liste vide
 *  laisserait passer l'écran qui n'annonce rien, c'est-à-dire exactement le
 *  défaut que ces essais cherchent. Les vrais mots et le vrai partage vivent
 *  dans `tests/test_v303.py`, sur la vraie chaîne. */
const PLACES_DE_LA_RECETTE: readonly (readonly [keyof Recette, string])[] = [
  ["passes", "détourage"],
  ["recadrage", "recadrage"],
  ["grille", "grille"],
  ["quantification", "quantification"],
  ["bords", "bords"],
  ["contours", "contours"],
  ["retournement", "retournement"],
  ["main", "la main"],
]

function ecartsDesPrises(prises: Prise[], defaut: Recette | null) {
  return prises.map((prise) => {
    if (!prise.recette) return { places: [], fenetre_davant: false }
    const places = PLACES_DE_LA_RECETTE.filter(
      ([cle]) =>
        JSON.stringify(prise.recette?.[cle] ?? null) !==
        JSON.stringify(defaut?.[cle] ?? null),
    ).map(([, mot]) => mot)
    // Une recette individuelle égale à celle de la bande ne s'annonce pas :
    // rien n'a changé, et une phrase dirait le contraire.
    return { places, fenetre_davant: places.length > 0 }
  })
}

const CADRE_REMESURE = {
  ...APERCU_RENDU.cadre,
  choix: "clip" as const,
  gauche: 2,
  sommet: 2,
  droite: 61,
  bas: 61,
  largeur: 60,
  hauteur: 60,
}

/** L'atelier déjà installé — ce que `GET /install` rend le reste du temps.
 *
 *  Les essais de cette page n'installent rien : ils passent par l'écran des
 *  Réglages pour atteindre ce qui est derrière. Ce bloc-là leur suffit, et
 *  `Installation.test.tsx` garde les cas propres à l'installation. */
const INSTALLATION = {
  dossier: "C:\\atelier\\donnees",
  origine_du_dossier: "defaut",
  dossier_au_prochain_demarrage: "",
  disque: {
    postes: [
      { nom: "Les images et les clips reçus", octets: 4404019, mo: 4.2, recalculable: false },
      { nom: "Les rendus", octets: 12373196, mo: 11.8, recalculable: true },
    ],
    total_mo: 16,
    recalculable_mo: 11.8,
  },
  fichier_env: "C:\\atelier\\.env",
  comfy: "http://127.0.0.1:8188",
  origine_de_l_adresse: "defaut",
  premiere_ouverture: false,
  jeux: ["Bac à sable"],
} satisfies EtatInstallation

function serveurDouble(options: {
  assets?: Asset[]
  cartes?: Carte[]
  univers?: Univers
  /** Un catalogue à plusieurs modèles — ce qu'il faut pour qu'un filtre ait
   *  quelque chose à écarter. Par défaut, ceux du `CATALOGUE`. */
  modeles?: Modele[]
  /** L'animation que rend `GET /strips/{id}` (A7). Le double la garde ensuite
   *  entre deux appels : une correction enregistrée se relit. */
  atelierDeBande?: AtelierDeBande
  aPublier?: () => Generation
  /** Ce que la détection propose de découper. Le test le décide, comme le vrai
   *  serveur le déciderait sur l'image : c'est ce que l'écran affiche, et c'est
   *  ce que l'auteur corrige avant de découper (US-73). */
  boites?: [number, number, number, number][]
  raisonDecoupe?: string | null
  /** Ce que le serveur propose comme case pour le miroir d'une image (B1), et
   *  sa raison quand il n'y en a pas. **Le test le décide, comme le serveur le
   *  déciderait sur la direction de l'image** : les directions d'un jeu sont
   *  libres, et l'écran ne calcule jamais la paire lui-même. La clé est
   *  l'identifiant de l'image de départ. */
  miroirs?: Record<string, { propose: string | null; raison: string | null }>
  /** Ce que l'atelier répond à un export. Par défaut une archive ; le test peut
   *  demander un refus, parce que l'export est le seul appel de l'interface qui
   *  ne rende pas du JSON et que son chemin d'erreur est donc à lui. */
  refusExport?: string | null
  /** Le cadre de l'agent et sa consommation, quand le test veut autre chose que
   *  l'atelier neuf — un plafond entamé, un garde-fou éteint. */
  agent?: Etat["agent"]
  /** Ce que `GET /install` rend, quand le test veut autre chose que l'atelier
   *  déjà installé — une première ouverture, un autre dossier. */
  installation?: Partial<EtatInstallation>
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
  /** La case « Garder la mise en page de la référence » que portait la
   *  génération relue (RS4). Absent comme chez le vrai serveur, qui ne
   *  l'écrit que si elle était vraie (RS2). */
  garderMiseEnPageParti?: boolean
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
  /** La bibliothèque de mouvements (A6). **Pleine par défaut**, à l'inverse des
   *  étiquettes : l'atelier arrive avec sept mouvements livrés, et un écran qui
   *  les montrerait vides mesurerait le contraire du produit. */
  mouvements?: BaseMouvements
  /** La bibliothèque de styles de combat (SC1, SC4). **Vide par défaut** :
   *  la bibliothèque livrée est un détail du serveur (`tests/test_sc1_styles.py`),
   *  ce double-ci ne prouve que ce que l'écran affiche et envoie. */
  styles?: BaseStyles
  /** Le style résolu d'un personnage donné, par identifiant (SC2, SC4). */
  stylesDesPersonnages?: Record<string, StyleDuPersonnage>
  /** Le catalogue vidéo et le prix du jour (A9). **Deux modèles par défaut, et
   *  l'un des deux grisé** : ce que l'écran doit prouver est qu'il propose
   *  l'un, refuse l'autre avec sa raison, et n'en cache aucun. */
  modelesVideo?: BaseModelesVideo
  /** Ce que la carte de la maison peut faire (A11). **En ordre par défaut** :
   *  les trois absences se posent par cette porte, parce qu'elles ne dépendent
   *  d'aucune fenêtre ouverte sur la machine qui fait tourner les essais. */
  moteur?: EtatDuMoteur
  /** Ce que le moteur dit **après** le téléchargement. Sans lui le double rend
   *  le même état qu'avant, ce qui est ce qu'on veut la plupart du temps. */
  apresTelechargement?: EtatDuMoteur
  /** Ce qui bouge entre les images de la bande montée (A5). Posé à `undefined`
   *  explicitement, il écrit le cas d'une bande qui n'a rien à mesurer — une
   *  seule image, donc aucune paire. */
  stabilite?: Stabilite
  /** Ce que le serveur propose comme image de départ, et pourquoi celle-là. Le
   *  double le rend, comme le vrai serveur le déciderait sur la bibliothèque :
   *  la règle est **au serveur**, et le prouver demande qu'elle ne soit pas
   *  ici non plus. */
  imageDeDepart?: ImageDeDepart
  /** Ce que le serveur rend à l'ouverture d'un montage (A10). Le double le
   *  rend entier, comme le vrai serveur : l'écran s'ouvre en tournant déjà, et
   *  quatre appels séparés feraient quatre états d'attente pour un seul geste. */
  montage?: Montage
  /** **Une image du clip déjà mise de côté** (A13), par son numéro. Le serveur
   *  la signale comme doublon au lieu de la refaire entrer — un doublon n'est
   *  pas un refus —, et poser le cas ici évite à l'essai de deviner l'ordre des
   *  appels pour l'obtenir. */
  imageDejaPrise?: number
  /** Les clips payés qui attendent un geste (B2) — `GET /clips/pending`. Vide
   *  par défaut : le bandeau ne se montre que quand un essai en pose. */
  clipsEnSouffrance?: Generation[]
  /** **Les clips relus depuis le dépôt** (B22) — `GET /clips?projet=…`. C'est
   *  ce qui reste visible une fois le lot fermé, distinct du chantier qui ne
   *  voit que ce qui vient d'arriver. Vide par défaut : un jeu neuf n'a encore
   *  gardé aucun clip. */
  clipsDuJeu?: Generation[]
  /** Le bilan du tableau de bord (B5) — `GET /dashboard`. Vide par défaut :
   *  aucune famille peuplée, aucun manque, un lot à zéro — ce qu'un jeu neuf
   *  rend réellement. */
  bilan?: BilanDuJeu
  /** Ce que `POST /clips/{id}/recover` répond quand le fournisseur a expiré le
   *  lien, par identifiant — la route rend quand même 200, avec un emplacement
   *  échoué et sa raison, comme le vrai serveur le fait. */
  recuperationEchouee?: Record<string, string>
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
  /** Comment le dessus est entré dans le cadre du dessous (M1). **Rien par
   *  défaut** : deux images de même taille, le cas courant, où le serveur ne
   *  touche à rien. Un essai qui joue une case arrivée bien plus grande que le
   *  corps pose la sienne. */
  cadrage?: Cadrage
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

  // **L'animation qu'on rouvre** (A7), et elle vit entre deux appels. Le défaut
  // de la tranche était qu'une bande gardée ne se relisait pas : un double qui
  // rendrait toujours la bande de départ referait l'erreur sans la voir.
  let atelierEnCours: AtelierDeBande = options.atelierDeBande ?? ATELIER_RENDU

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
    // **Les trois routes qui rendent une archive**, et non plus une seule :
    // `A4` fait sortir les animations, en sélection et par personnage. Elles
    // répondent toutes de la même façon — c'est le même code au serveur —, et
    // le double n'a donc qu'une seule branche à tenir.
    if (url === "/api/exports" || url.endsWith("/strips/export")) {
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
      // **Trois noms distincts, parce que le serveur en rend trois.** Une
      // archive d'animations ne s'appelle pas comme une archive d'images, et
      // celle d'un personnage porte son nom : c'est ce qui permet à un essai de
      // dire *quelle* sortie a été prise, et non seulement qu'il y en a eu une.
      const nom =
        url === "/api/exports"
          ? "atelier-20260827-1743.zip"
          : url === "/api/strips/export"
            ? "atelier-animations-20260904-1743.zip"
            : "le-nain-animations-20260904-1743.zip"
      return {
        ok: true,
        status: 200,
        headers: {
          get: (entete: string) =>
            entete.toLowerCase() === "content-disposition"
              ? `attachment; filename="${nom}"`
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
    // ── L'installation, que l'écran des Réglages relit (`B15`) ───────────
    //
    // **Elle n'avait pas de route ici, et c'est ce qui faisait tomber l'écran
    // entier** : `Installation.tsx` rend la liste des jeux de la machine et le
    // poste de disque dès que `GET /install` a répondu, et le double répondait
    // un objet vide. Un objet vide est vrai, donc la section se montait, et
    // `jeux.map` levait. Le double sert donc l'installation comme le serveur la
    // sert, en un bloc.
    if (url === "/api/install" || url === "/api/install/done")
      return rendre({ ...INSTALLATION, ...(options.installation ?? {}) })
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
        // le rend : la couleur que l'atelier a calculée, ou celle que l'écran
        // vient de corriger pour cet appel — `tri.fond`, qui est un écart de
        // plus et non une ligne de texte.
        fond: {
          couleur: tri.fond ?? UNIVERS.fond,
          interdiction: "",
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
    // La bibliothèque de mouvements (A6). Le double la rend telle quelle quel
    // que soit le geste : ce qui se vérifie ici est **ce que l'écran affiche et
    // ce qu'il envoie**, pas ce que le serveur en fait — cette moitié-là est
    // tenue par `tests/test_a6.py`, sur le vrai service et sur le disque.
    // Ce qui animerait cette case-là (A6). **Avant la liste**, sinon l'adresse
    // la plus large gagne — le piège des routes à segments, payé au serveur et
    // qui se rejoue à l'identique dans un double.
    if (url.includes("/movements/for-pose/")) {
      const pose = url.split("/movements/for-pose/")[1].split("?")[0]
      const trouve = (options.mouvements?.mouvements ?? MOUVEMENTS).find(
        (m) => m.identifiant === pose,
      )
      return rendre({
        pose,
        mouvement: trouve ?? null,
        texte: trouve?.texte ?? "",
        origine: trouve ? "mouvement" : "aucun",
      })
    }
    if (url.includes("/movements"))
      return rendre(options.mouvements ?? { mouvements: MOUVEMENTS, masques: [] })

    // La bibliothèque de styles de combat (SC1, SC4). **Les adresses les plus
    // longues d'abord** — même piège que `/movements/for-pose/` ci-dessus :
    // `/styles/for-character/...` et `/styles/for-piece/...` seraient sinon
    // avalées par `url.includes("/styles")`.
    if (url.includes("/styles/for-character/")) {
      const personnage = url.split("/styles/for-character/")[1].split("?")[0]
      return rendre(
        options.stylesDesPersonnages?.[personnage] ?? {
          personnage,
          style: null,
          origine: "aucun",
          piece: null,
        },
      )
    }
    if (url.includes("/styles/for-piece/"))
      return rendre({ piece: url.split("/styles/for-piece/")[1].split("?")[0], style: null })
    if (url.includes("/styles"))
      return rendre(options.styles ?? { styles: [], masques: [] })

    // ── Les clips (A9) ───────────────────────────────────────────────────
    //
    // **Les adresses littérales d'abord**, pour la même raison que ci-dessus.
    // Le double ne fabrique aucune vidéo : ce qui se vérifie ici est ce que
    // l'écran affiche et ce qu'il envoie. Le reste — la dépense écrite avant le
    // fichier, le clip qui survit à la fermeture — est tenu par
    // `tests/test_a9.py`, sur le vrai service et sur le disque.
    // **Les clips relus depuis le dépôt** (B22) — jamais `/api/clips/quelque
    // chose`, seulement la route nue avec sa requête. Scopée comme le vrai
    // serveur : sans `projet` elle rend tout, avec elle ne rend que le sien —
    // c'est ce qui fait qu'un clip garde sa place une fois son lot fermé.
    if ((url === "/api/clips" || url.startsWith("/api/clips?")) && init?.method !== "POST") {
      const parametres = new URL(url, "http://x").searchParams
      const projet = parametres.get("projet")
      const clips = options.clipsDuJeu ?? []
      return rendre({
        clips: projet ? clips.filter((g) => g.projet === projet) : clips,
      })
    }
    if (url.startsWith("/api/clips/models"))
      return rendre(options.modelesVideo ?? MODELES_VIDEO)
    // Le moteur de la maison (A11). **Le relevé se refait à chaque appel** dans
    // le produit ; ici il rend ce que l'essai a posé, ce qui permet d'écrire les
    // trois absences sans dépendre d'une fenêtre ouverte sur la machine.
    if (url === "/api/clips/engine")
      return rendre(options.moteur ?? MOTEUR_EN_ORDRE)
    if (url === "/api/clips/engine/download") {
      appels.push({ url, corps })
      return rendre({ ...(options.apresTelechargement ?? MOTEUR_EN_ORDRE), descendus: [] })
    }
    if (url.startsWith("/api/clips/start-image"))
      return rendre(options.imageDeDepart ?? DEPART_PROPOSE)
    if (url === "/api/clips/keep") {
      const jete = (corps?.jette ?? []) as string[]
      return rendre({
        garde: clipRendu(String(corps?.garde ?? ""), false),
        jetes: jete.map((identifiant) => clipRendu(identifiant, true)),
      })
    }
    if (url === "/api/clips/restore")
      return rendre({
        clips: ((corps?.clips ?? []) as string[]).map((i) => clipRendu(i, false)),
      })
    // ── Le montage (A10) ─────────────────────────────────────────────────
    //
    // **Aucune de ces routes ne dépense**, et le double le rend visible : rien
    // n'y a de montant, rien n'y a de modèle. Ce qui se vérifie ici est ce que
    // l'écran montre et ce qu'il envoie ; les pixels, eux, sont tenus par
    // `tests/test_a10.py`, sur la vraie chaîne et sur le disque.
    if (url === "/api/montage/preview")
      return rendre({
        ...APERCU_RENDU,
        compte: ((corps?.images ?? []) as number[]).length,
        largeur: APERCU_RENDU.case_largeur * ((corps?.images ?? []) as number[]).length,
        // **L'aperçu dit les écarts** (V3.03.1) : c'est le seul appel qui
        // reparte à chaque geste, donc le seul qui puisse tenir le ruban à jour
        // entre deux enregistrements.
        ecarts_des_frames: ecartsDesPrises(
          (corps?.prises ?? []) as Prise[],
          (corps?.recette ?? null) as Recette | null,
        ),
        // La mesure d'`A5` se pose par essai : c'est un chiffre, et un chiffre
        // se lit sur un cas précis. Le `undefined` explicite existe pour écrire
        // le cas d'une bande qui n'en a pas.
        stabilite:
          "stabilite" in options ? options.stabilite : APERCU_RENDU.stabilite,
      })
    if (url.startsWith("/api/montage/") && url.endsWith("/frame"))
      return rendre({
        fenetre: options.montage?.fenetre ?? MONTAGE_RENDU.fenetre,
        propositions: options.montage?.propositions ?? MONTAGE_RENDU.propositions,
        a_jour: true,
      })
    if (url.startsWith("/api/montage/"))
      return rendre(options.montage ?? MONTAGE_RENDU)
    if (url.startsWith("/api/strips?"))
      return rendre({ bandes: options.montage?.bandes ?? [] })
    if (url === "/api/strips" && init?.method === "POST")
      return rendre(
        bandeRendue(String(corps?.nom ?? ""), (corps?.images ?? []) as number[]),
      )
    if (url.startsWith("/api/strips/") && init?.method === "DELETE")
      return rendre(bandeRendue("effacee", []))
    // ── Rouvrir et corriger une animation gardée (A7) ──────────────────────
    //
    // Le double **garde l'état entre deux appels**, et ce n'est pas du zèle :
    // le défaut de la tranche était qu'une animation gardée ne se relisait pas.
    // Un double qui rendrait toujours la même bande de départ referait
    // exactement l'erreur que ces essais cherchent, et passerait sans rien voir.
    if (url.startsWith("/api/strips/") && url.endsWith("/frame")) {
      atelierEnCours = {
        ...atelierEnCours,
        bande: { ...atelierEnCours.bande, cadre: CADRE_REMESURE },
        cadre: { choix: "clip", a_jour: true, mesuree_le: 1_787_800_900 },
      }
      return rendre(atelierEnCours.bande)
    }
    if (url.startsWith("/api/strips/") && init?.method === "PUT") {
      const bande = { ...atelierEnCours.bande }
      if (corps?.prises) bande.prises = corps.prises as Prise[]
      // **Une liste vide est un chutier vide, pas un champ absent** (V3.03.3) :
      // on vient de reposer la dernière image dans le ruban, et un double qui
      // l'ignorerait relirait une réserve que le serveur a effacée.
      if (corps?.chutier !== undefined) bande.chutier = corps.chutier as Prise[]
      if (corps?.recette) bande.recette = corps.recette as Recette
      if (corps?.cadence) bande.cadence = Number(corps.cadence)
      if (corps?.sens) bande.sens = String(corps.sens) as Bande["sens"]
      bande.images = bande.prises.map((p) => p.numero)
      atelierEnCours = {
        ...atelierEnCours,
        bande,
        // **Les écarts se recalculent à l'écriture** (V3.03.1), comme au
        // serveur : les garder tels quels ferait relire une animation dont le
        // ruban annoncerait l'état d'avant l'enregistrement — c'est-à-dire le
        // cul-de-sac d'`A7` déplacé d'un cran.
        ecarts: ecartsDesPrises(bande.prises, bande.recette),
        // Un détourage changé périme la fenêtre : c'est le serveur qui le dit,
        // et l'écran ne doit pas continuer à l'annoncer à jour.
        //
        // ⚠️ **Celle de la bande, pas celle d'une frame** (V3.03.1). La fenêtre
        // commune reste mesurée avec la recette de la bande : une frame qui
        // s'en écarte peut déborder — et c'est son propre `fenetre_davant` qui
        // le dit —, mais elle ne périme pas le rectangle des autres. Le double
        // comparait avant l'ancienne recette à rien du tout, et rendait donc la
        // fenêtre périmée dès qu'on touchait une seule image.
        cadre:
          corps?.recette &&
          JSON.stringify(corps.recette) !==
            JSON.stringify(atelierEnCours.bande.recette)
            ? { ...atelierEnCours.cadre, a_jour: false }
            : atelierEnCours.cadre,
      }
      return rendre(bande)
    }
    if (/^\/api\/strips\/[^/]+$/.test(url)) return rendre(atelierEnCours)
    // **La case d'une bande** (A12) — affectée, ou rendue au brouillon quand les
    // deux champs sont vides. Le double rend la bande, comme le serveur : ce que
    // l'écran en fait est de redemander le plan, sur l'annonce du flux.
    if (url.endsWith("/case") && init?.method === "PUT")
      return rendre({
        ...bandeRendue("detachee", []),
        pose: (corps?.pose ?? null) as string | null,
        direction: (corps?.direction ?? null) as string | null,
      })
    // **Prélever une image du clip** (A13) — elle entre en bibliothèque. Le
    // double rend la forme d'un import, l'un des deux toujours nul : un
    // prélèvement déjà fait n'est pas un refus, il est signalé. `imageDejaPrise`
    // permet à un essai de poser ce second cas sans deviner l'ordre des appels.
    if (url.includes("/frames/") && url.endsWith("/pick")) {
      const numero = Number(url.split("/frames/")[1].split("/")[0])
      if (options.imageDejaPrise === numero)
        return rendre({
          asset: null,
          doublon: asset("cccc3333-0", "marche — image 12"),
        })
      return rendre({
        asset: { ...asset(`prise-${numero}-0`, `marche — image ${numero}`), modele: "clip" },
        doublon: null,
      })
    }
    if (url === "/api/clips" && init?.method === "POST") {
      const combien = Number(corps?.nombre ?? 1)
      return rendre({
        clips: Array.from({ length: combien }, (_, rang) =>
          clipRendu(`clip-${rang}`, false),
        ),
      })
    }
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
        // **Le cadrage arrive avec l'aperçu** (M1) : c'est le serveur qui sait
        // s'il a dû réduire le dessus pour le faire entrer, et l'écran a besoin
        // de la réponse pour l'écrire *et* pour dessiner la même image que
        // celle sur laquelle le calcul a été fait.
        cadrage: options.cadrage ?? {
          ramene: false,
          facteur: 1,
          gauche: 0,
          sommet: 0,
          largeur: 64,
          hauteur: 64,
          source_largeur: 64,
          source_hauteur: 64,
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
    // ── La chaîne de retouche, **en brouillon** (`B24`) ───────────────────
    //
    // **Ces deux routes n'existaient pas ici, et l'écran tombait dessus.** La
    // retouche enregistrait chaque geste : un seul `PUT /recipe`, dont le corps
    // *était* la recette. Elle travaille maintenant en brouillon — chaque geste
    // demande un aperçu à `POST /recipe/preview`, et *Enregistrer* seul écrit.
    // Sans la route de l'aperçu, le double rendait la liste des assets ; la
    // recette relue valait alors `undefined`, et l'écran entier tombait sur
    // `recette.veille` — c'est-à-dire que les essais des tables ne mesuraient
    // plus une table, mais un écran blanc.
    //
    // Le double rend **la recette qu'on lui envoie**, comme le serveur rend
    // celle qu'il a normalisée : c'est ce qui permet à un essai de vérifier que
    // le réglage posé est bien celui qui part.
    if (url.includes("/recipe/preview")) {
      const demandee = (corps?.recette ?? RECETTE_VIDE) as Recette
      // **Le double coupe comme le serveur coupe** (U5) : un aperçu demandé
      // pour une recette *voyageuse* — collée, ou rappelée sous un nom — perd
      // les réglages qui ne voyagent pas, et dit lesquels. Un double qui
      // rendrait la recette telle quelle laisserait passer un écran muet.
      // **Une recette rappelée sous son nom vient du disque**, pas de l'écran :
      // l'aperçu porte le nom, et c'est le serveur qui va chercher ce qui est
      // enregistré — comme l'ancienne route `/apply/`. Le corps ne dit que
      // l'état courant, et s'en servir ferait voyager ce qu'on avait déjà.
      const nommee = corps?.nom ? etat.recettes[String(corps.nom)] : undefined
      const voyage = Boolean(corps?.voyageuse) || Boolean(corps?.nom)
      const [voyageable, laisse] = voyage
        ? voyageDouble(nommee ?? demandee)
        : [demandee, [] as string[]]
      return rendre({
        recette: corps?.nom ? { ...voyageable, nom: corps.nom } : voyageable,
        rendu: "data:image/png;base64,",
        largeur: 1024,
        hauteur: 1024,
        // `null` laisse l'écran garder les mesures enregistrées, que la route
        // `/spots` sert déjà — deux sources pour la même mesure finiraient par
        // se contredire.
        mesures: null,
        laisse,
      })
    }
    if (url.endsWith("/recipe") || url.includes("/recipe?")) {
      const identifiant = url.split("/assets/")[1]?.split("/")[0] ?? ""
      const connu =
        etat.assets.find((a) => a.identifiant === decodeURIComponent(identifiant)) ??
        asset(decodeURIComponent(identifiant))
      return rendre({ ...connu, recette: corps ?? connu.recette })
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
    if (url === "/api/clips/pending")
      return rendre({ clips: options.clipsEnSouffrance ?? [] })
    // ── Le bilan du tableau de bord (B5) ──────────────────────────────────
    if (url === "/api/dashboard")
      return rendre(
        options.bilan ?? { familles: [], manques: [], lot: { images: 0, feuilles: 0, cout_usd: 0 } },
      )
    if (url.match(/^\/api\/clips\/[^/]+\/recover$/) && init?.method === "POST") {
      const identifiant = url.split("/")[3]
      const trouve = (options.clipsEnSouffrance ?? []).find(
        (g) => g.identifiant === identifiant,
      )
      const raison = options.recuperationEchouee?.[identifiant]
      const gabarit = trouve ?? clipRendu(identifiant, false)
      return rendre({
        ...gabarit,
        emplacements: [
          {
            ...gabarit.emplacements[0],
            statut: raison ? "echouee" : "reussie",
            raison: raison ?? null,
          },
        ],
      })
    }
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
    // La porte Fabrications relit les travaux conservés. Un atelier neuf en
    // rend une liste vide : sans cette route, le double générique rendait un
    // objet et masquait le parcours sous un `liste.map` sans rapport.
    if (url.startsWith("/api/projects/") && url.endsWith("/production-jobs"))
      return rendre([])
    // **Le cadre de délégation d'un jeu** (`RP2`) — ce qui borne la dépense
    // d'un agent automatique. L'onglet *Agent MCP* le lit dès qu'il s'ouvre.
    // Un atelier neuf n'en a jamais posé : le serveur rend celui qu'il déduit
    // des garde-fous de séance, appels et argent à zéro.
    //
    // **L'écriture rend le cadre entier**, comme le vrai serveur : l'écran
    // repart de ce qui revient, il ne rejoue pas ce qu'il vient d'envoyer.
    if (url.startsWith("/api/projects/") && url.endsWith("/delegation")) {
      const defaut = {
        autoriser_local: true,
        autoriser_payant: false,
        modeles_image: [] as string[],
        modeles_video: [] as string[],
        modeles_audio: [] as string[],
        plafond_appels: 0,
        plafond_usd: 0,
        plafond_secondes_audio: 1800,
        livraison_provisoire: false,
      }
      if (init?.method === "PUT")
        return rendre({ ...defaut, ...(corps as object), origine: "explicite" })
      return rendre({ ...defaut, origine: "garde-fous-existants" })
    }
    // **Poser un asset déjà produit sur la toile, sans nouvelle fabrication**
    // (US-540). Le double range la carte comme le vrai serveur la rangerait :
    // en réserve — ni groupe ni place — puisque c'est à l'auteur de la classer.
    if (url.includes("/board/assets/") && init?.method === "POST") {
      const asset = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1))
      const deja = etat.cartes.find((c) => c.source === asset)
      if (deja) return rendre({ carte: deja, deja_presente: true })
      const carte = carteImage(`depuis-asset-${asset}`, { source: asset })
      etat.cartes = [carte, ...etat.cartes]
      FluxDouble.ouverts.at(-1)?.emettre("carte", carte)
      return rendre({ carte, deja_presente: false })
    }
    if (url === "/api/local-queue")
      return rendre({ etapes: [], regle: "Une étape à la fois.", mesures: [] })
    if (url === "/api/local-queue/engines") return rendre({ moteurs: [] })
    if (url === "/api/workflow-profiles") return rendre({ profils: [] })
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
            retournement: null,
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
    // ── Le miroir — la troisième fabrique (B1) ──────────────────────────────
    //
    // **Deux routes, et le double les sépare comme le serveur les sépare** :
    // `GET` propose une case et n'écrit rien, `POST` écrit un asset. Un double
    // qui répondrait la même chose aux deux laisserait passer un écran qui
    // fabrique en croyant demander.
    //
    // **Ce que l'asset neuf porte vient du service**, mot pour mot : la
    // filiation, la direction désignée, zéro consommé, et la place
    // `retournement` remplie dans sa recette — c'est elle, et rien d'autre, qui
    // dit que l'image est un miroir.
    if (url.startsWith("/api/assets/") && url.endsWith("/mirror")) {
      const identifiant = url.slice("/api/assets/".length, -"/mirror".length)
      const parent =
        etat.assets.find((a) => a.identifiant === identifiant) ??
        asset(identifiant)
      if (init?.method === "POST") {
        const ne: Asset = {
          ...parent,
          identifiant: `${identifiant}-miroir`,
          label: `${parent.label} · miroir`,
          parent: identifiant,
          direction: (corps?.direction as string | null) ?? null,
          consomme: 0,
          cout_usd: 0,
          recette: { ...parent.recette, retournement: { sens: "gauche-droite" } },
        }
        etat.assets = [ne, ...etat.assets]
        return rendre({ parent: identifiant, miroir: ne })
      }
      const dit = options.miroirs?.[identifiant]
      return rendre({
        asset: identifiant,
        direction: parent.direction,
        propose: dit?.propose ?? null,
        raison: dit?.raison ?? null,
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
          retournement: null,
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
      // **La même limite que le vrai serveur** (B3) : sans elle, le double
      // rendrait toujours tout et aucun essai ne pourrait voir la grille dire
      // qu'elle est coupée.
      const limite = Number(parametres.get("limite") ?? 200)
      const vivants = etat.assets.filter((a) => !etat.supprimes.includes(a.identifiant))
      const filtres = recherche
        ? vivants.filter((a) => a.label.toLowerCase().includes(recherche))
        : vivants
      return rendre({ assets: filtres.slice(0, limite), total: filtres.length })
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
    // ── La grille d'une famille (`B9`), depuis le carnet ──────────────────
    //
    // **Le double dérive la grille des personnages déjà connus** (`etat.
    // personnages`), comme le vrai serveur la dérive de la même table : ouvrir
    // une famille depuis le carnet ne demande pas un second jeu de données,
    // seulement un filtre sur le premier. Ajoutée en `C3`, quand `ouvrirLEtabli`
    // s'est mise à traverser cet écran-là plutôt que l'ancien codex.
    if (
      url.startsWith("/api/characters/families/") &&
      (!init?.method || init.method === "GET")
    ) {
      const [familleBrute, requete] = url
        .slice("/api/characters/families/".length)
        .split("?")
      const famille = decodeURIComponent(familleBrute)
      const params = new URLSearchParams(requete ?? "")
      const recherche = (params.get("recherche") ?? "").trim().toLowerCase()
      const tous = etat.personnages.filter(
        (p) => (p.famille || "personnages") === famille,
      )
      const filtres = recherche
        ? tous.filter((p) => p.nom.toLowerCase().includes(recherche))
        : tous
      const sujetDeLaGrille = (p: Personnage) => {
        const plan = p.plan ?? etat.plan
        const imagesFait = p.cases.reduce((s, c) => s + c.images.length, 0)
        const imagesAttendu = p.cases.reduce((s, c) => s + (c.demandees ?? 0), 0)
        const posesFait = p.cases.filter((c) => c.images.length > 0).length
        return {
          identifiant: p.identifiant,
          projet: p.projet,
          nom: p.nom,
          description: p.description,
          type: p.type,
          cree_le: p.cree_le,
          compte: {
            poses: { fait: posesFait, attendu: plan.length },
            images: { fait: imagesFait, attendu: imagesAttendu },
            bandes: { fait: 0, attendu: 0 },
            complet: plan.length > 0 && posesFait >= plan.length,
            detail: plan.map((pose) => ({
              identifiant: pose.identifiant,
              nom: pose.nom,
              fait: p.cases.find((c) => c.pose === pose.identifiant)?.images.length ?? 0,
              attendu:
                p.cases.find((c) => c.pose === pose.identifiant)?.demandees ?? pose.images,
            })),
          },
          collections: [],
          vignette: null,
        }
      }
      return rendre({
        personnages: filtres.map(sujetDeLaGrille),
        groupes: [],
        filtres: { tous: tous.length, incomplets: 0, "sans-description": 0 },
        total: filtres.length,
      })
    }
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
      // ── Le vestiaire résolu du jeu (B19) ──────────────────────────────────
      //
      // **Le segment littéral passe avant `{identifiant}`**, ici comme au
      // serveur : sans cette branche en tête, `GET .../pieces/uses` tombait
      // dans le vestiaire de `C3`, qui rend des pièces nues. L'écran lit alors
      // `p.piece.identifiant` sur une pièce sans `piece`, et toute la page
      // casse. C'est le même piège de rangement des routes, des deux côtés.
      //
      // La règle de résolution est celle du domaine : une pièce **déclarée**
      // rend ses emplois, une pièce jamais déclarée les déduit de ses calques.
      if (url === "/api/characters/pieces/uses" && (!init?.method || init.method === "GET")) {
        const porteursDeduits = (piece: string) =>
          etat.personnages
            .filter((p) =>
              p.cases.some((c) => (c.calques?.[piece] ?? []).length > 0),
            )
            .map((p) => p.identifiant)
        const comptes = (piece: string, porteur: string) => ({
          fait: (etat.personnages.find((p) => p.identifiant === porteur)?.cases ?? [])
            .filter((c) => (c.calques?.[piece] ?? []).length > 0).length,
          attendu: etat.plan.length,
        })
        const pieces = etat.pieces.map((piece) => {
          const declare = piece.emplois !== undefined && piece.emplois !== null
          const bruts = declare
            ? (piece.emplois ?? [])
            : porteursDeduits(piece.identifiant).map((porteur) => ({
                identifiant: `porte-${porteur}`,
                genre: "porte" as const,
                porteur,
                nom: "",
                emplacement: "",
                devant: true,
                description: "",
              }))
          const emplois = bruts.map((e) => {
            const porte = etat.personnages.find((p) => p.identifiant === e.porteur)
            return {
              ...e,
              deduit: !declare,
              orphelin: e.genre === "porte" && !porte,
              porteur_nom: porte?.nom ?? "",
              emplacement_nom:
                etat.emplacements.find(
                  (s) => s.identifiant === (e.emplacement || piece.emplacement),
                )?.nom ?? "",
              ...comptes(piece.identifiant, e.porteur),
            }
          })
          return {
            piece,
            declare,
            emplois,
            fait: emplois.reduce((somme, e) => somme + e.fait, 0),
            attendu: emplois.reduce((somme, e) => somme + e.attendu, 0),
          }
        })
        return rendre({ projet: "bac-a-sable", emplacements: etat.emplacements, pieces })
      }
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
      return rendre({
        projet: "bac-a-sable",
        univers: etat.univers,
        artworks: [],
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
          ...(options.garderMiseEnPageParti ? { garder_mise_en_page: true } : {}),
        },
      })
    }
    return rendre({})
  })

  return { fetchDouble, appels, etat }
}

/** Les recettes que l'écran a envoyées, dans l'ordre — **quelle que soit la
 *  route qui les a portées** (`B24`).
 *
 *  La retouche enregistrait chaque geste, et le corps du `PUT /recipe` *était*
 *  la recette. Elle travaille maintenant en brouillon : chaque geste demande un
 *  aperçu à `POST /recipe/preview`, qui porte la recette dans un champ, et
 *  *Enregistrer* seul écrit. Ce que les essais mesurent n'a pas changé — le
 *  réglage qui part est celui qu'on a posé —, et le lire une fois ici évite de
 *  l'écrire de quinze façons. */
function recettesEnvoyees(appels: { url: string; corps: unknown }[]): Recette[] {
  return appels
    .filter((a) => a.url.includes("/recipe"))
    .map((a) => {
      const corps = a.corps as Record<string, unknown> | undefined
      if (!corps || typeof corps !== "object") return null
      return (("recette" in corps ? corps.recette : corps) ?? null) as Recette | null
    })
    .filter((r): r is Recette => r !== null)
}

/** La dernière recette partie, ou `null` — personne n'a rien envoyé. */
const derniereRecetteEnvoyee = (appels: { url: string; corps: unknown }[]) =>
  recettesEnvoyees(appels).at(-1) ?? null

const tuiles = () => screen.queryAllByRole("button", { name: "Ouvrir le résultat" })

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
/** Le texte que le champ qui paie porte quand il est vide.
 *
 *  **Il a changé avec l'écran, pas avec le geste** : la barre permanente de la
 *  galerie disait « Décris ce que tu veux fabriquer. » ; l'écran *Préparer une
 *  image* — le seul guichet du produit depuis l'atelier unifié — dit ce qu'il
 *  attend. Le nommer une fois ici évite de le réécrire à chaque essai. */
const PLACEHOLDER_DU_PROMPT = "Décris le sujet, son apparence et l’image attendue…"

/** Le champ qui filtre la planche contact.
 *
 *  Il s'appelait « Chercher dans la bibliothèque » quand la galerie *était* la
 *  bibliothèque ; les deux sont maintenant deux lieux — on range dans « Les
 *  assets », on juge dans la galerie —, et le champ dit ce qu'il filtre. */
const CHAMP_DE_RECHERCHE = "Rechercher un résultat"

/** Le bouton qui ouvre la relecture, au pied du guichet.
 *
 *  Il s'appelait *Générer* quand il était au pied d'une barre ; il dit
 *  maintenant ce qu'il fait — relire avant d'envoyer —, et c'est l'écran de
 *  confirmation qui paie. Le partage des deux gestes, lui, n'a pas bougé. */
const BOUTON_DE_RELECTURE = /^Relire avant l’envoi/

async function champDePrompt() {
  const deja = screen.queryByPlaceholderText(PLACEHOLDER_DU_PROMPT)
  if (deja) return deja
  allerA("Créer")
  // La porte ne monte pas sa surface de façon synchrone : attendre la vraie
  // action de Fabrications évite de rappeler ce helper pendant le rendu.
  fireEvent.click(await screen.findByRole("button", { name: "Préparer une image" }))
  return await screen.findByPlaceholderText(PLACEHOLDER_DU_PROMPT)
}

/** Le guichet, **et borné à lui** : une assertion posée sur tout le document
 *  trouverait la navigation et l'écran resté monté dessous. */
function guichet() {
  return screen.getByRole("dialog", { name: "Préparer une fabrication" })
}

/** Ce que le guichet dit viser — « Le nain · marche », ou « Image libre ».
 *
 *  **C'est là que la case armée se lit maintenant.** Elle tenait une bande
 *  « Pour » au pied de la barre qui paie ; l'écran *Préparer une image* l'écrit
 *  sous son titre, au-dessus du texte qui part. Le fait vérifié ne change pas :
 *  on voit ce qu'on vise avant de payer, et on voit qu'on ne vise plus rien
 *  quand l'appel est parti. */
function cibleDuGuichet() {
  return guichet().querySelector("header p")?.textContent ?? ""
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
  // ⚠️ **On vient d'armer une case, donc le guichet est en train de s'ouvrir
  //     sur elle.** L'attendre est ce qui garde la cible : `champDePrompt`
  //     ouvrirait sinon un second guichet, libre, et la série disparaîtrait
  //     sans un mot — avec elle la case « ne plus me le montrer », qui n'existe
  //     que là où il y a une série.
  const champ = (await screen.findByPlaceholderText(
    PLACEHOLDER_DU_PROMPT,
  )) as HTMLTextAreaElement
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
  fireEvent.click(ceQuiLance())
  const bouton = (await screen.findByRole("button", {
    name: /^Payer et lancer/,
  })) as HTMLButtonElement
  // **L'écran se recompose avant de pouvoir payer** : tant que les textes, les
  // images et le coût s'actualisent, le bouton refuse le clic. Cliquer dedans
  // pendant ce temps-là ne lance rien, et l'essai attendrait un appel qui n'a
  // jamais été demandé.
  await waitFor(() => expect(bouton.disabled).toBe(false))
  fireEvent.click(bouton)
}

/** Ouvrir l'écran de confirmation, et s'y arrêter — pour ce qu'on y lit.
 *
 *  Rend l'écran **borné**, et non le document : la barre du châssis et la barre
 *  d'état restent rendues derrière, et une assertion posée sur tout le document
 *  les trouverait. */
async function relire() {
  fireEvent.click(ceQuiLance())
  await screen.findByRole("button", { name: /^Payer et lancer/ })
  return within(document.querySelector("[data-envoi]") as HTMLElement)
}

/** Le contrôle du guichet qui lance un envoi — **et il change de place, jamais
 *  de métier**.
 *
 *  Au repos, c'est le bouton *Relire avant envoi*. Pendant qu'un lot est en
 *  route, l'état de ce qui part a pris sa place — c'est toute la capacité du
 *  31 août 2026 : la chose qu'on recliquerait est devenue la chose qui dit que
 *  ça marche — et le geste redescend dans la fente, en lien *Générer encore*.
 *
 *  **Les deux font exactement la même chose**, et c'est pourquoi une seule
 *  fonction les rend : ils ouvrent l'écran de relecture, ou paient directement
 *  quand la série est sautée. Un essai qui viserait le bouton par son nom
 *  pendant qu'un lot est en route ne mesurerait plus sa garantie, il mesurerait
 *  l'absence du bloc. */
function ceQuiLance() {
  return (
    screen.queryByRole("button", { name: BOUTON_DE_RELECTURE }) ??
    screen.getByRole("button", { name: /^Générer encore/ })
  )
}

/** Le même contrôle, **attendu** : le guichet met un rendu à s'ouvrir après
 *  qu'une case vient d'être armée. */
async function attendreCeQuiLance() {
  return await waitFor(() => ceQuiLance())
}

/** Passer *Relire avant envoi* en modification.
 *
 *  ⚠️ **L'écran a deux lectures depuis l'atelier unifié**, et c'est le seul
 *  changement de fond : il s'ouvre en lecture — les trois parties du texte,
 *  telles qu'elles partent — et « Modifier l'envoi » descend à la ligne. Les
 *  interrupteurs, les corrections, le fond et « ajouter une référence » vivent
 *  dans cette seconde lecture. Rien n'a disparu : on nomme le geste avant de
 *  l'offrir, plutôt que de poser cinquante cases sous les yeux de qui vient
 *  seulement relire.
 *
 *  Le bouton porte son état (`aria-pressed`), donc l'appeler deux fois ne
 *  referme rien. */
async function modifierLEnvoi() {
  const bouton = screen.getByRole("button", { name: "Modifier l’envoi" })
  if (bouton.getAttribute("aria-pressed") !== "true") fireEvent.click(bouton)
  await screen.findByRole("button", { name: "Terminer les modifications" })
  return within(document.querySelector("[data-envoi]") as HTMLElement)
}

/** L'établi d'une chose du jeu — **derrière le carnet et la grille d'une
 *  famille depuis `C3`**, qui a retiré `Codex.tsx` sans équivalent de sa
 *  colonne des familles (le carnet la fait déjà) ni de sa grille (`Famille.tsx`
 *  la fait déjà).
 *
 *  Le cadre reste borné à l'écran ouvert, comme avant : une assertion posée sur
 *  tout le document trouverait la barre du châssis et la barre d'état.
 *
 *  ⚠️ **Un étage de plus depuis `B10`, et c'est tout ce qui change ici.**
 *  Cliquer un sujet ouvre désormais *sa page* — quatre onglets, la fiche
 *  d'abord —, et la matrice est devenue la profondeur suivante de cette page.
 *  Cette aide y descend donc d'elle-même, par le lien que la fiche en porte.
 *  C'est ce que les soixante essais qui l'appellent viennent chercher : ni la
 *  fiche ni les onglets ne sont ce qu'ils mesurent, et la même aide leur rend
 *  le même cadre qu'avant. Ceux qui visent la page neuve, eux, ont leurs
 *  propres essais, dans `PageDuSujet.test.tsx` et `ImagesDuSujet.test.tsx`. */
async function ouvrirLEtabli(nom?: string) {
  // La sixième porte a remplacé le carnet : elle ouvre la grille d'assets sur
  // toutes les familles, et cliquer une famille dans sa colonne la restreint —
  // **c'est le même écran depuis `RP7`**, plus un détour par « Ouvrir et
  // organiser ». Ce parcours reste celui de l'auteur avant la fiche.
  fireEvent.click(screen.getByRole("button", { name: "Codex" }))
  const bibliotheque = await screen.findByRole("main", { name: "Codex" })
  // Le nom accessible du bouton porte aussi le compte de la famille dès que la
  // grille a répondu (« Personnages 1 ») : une chaîne exacte gagne la course
  // tant que le compte n'est pas encore arrivé, et la perd sous charge.
  fireEvent.click(await within(bibliotheque).findByRole("button", { name: /^Personnages/ }))
  const cadre = await waitFor(() => {
    const c = document.querySelector("[data-ecran-famille], [data-etabli], [data-univers]")
    if (!c) throw new Error("aucune famille en profondeur n'est montée")
    return c as HTMLElement
  })
  // **La grille se charge de son côté** (`api.familleDeSujets`), contrairement
  // à l'ancien codex qui recevait `personnages` déjà en mémoire : on attend la
  // carte cherchée, ou la première venue sans nom donné.
  const premier = await waitFor(
    () => {
      const cartes = Array.from(
        cadre.querySelectorAll<HTMLElement>("[data-carte-de-sujet]"),
      )
      if (nom) {
        const trouvee = cartes.find((c) => c.textContent?.includes(nom))
        if (!trouvee) throw new Error(`la carte « ${nom} » n'est pas encore montée`)
        return trouvee
      }
      if (cartes.length === 0) throw new Error("aucune carte encore montée")
      return cartes[0]
    },
    { timeout: 300 },
  ).catch(() => null)
  if (premier) {
    fireEvent.click(premier)
    const page = await waitFor(() => {
      const etabli = document.querySelector("[data-etabli]")
      if (!etabli) throw new Error("l'établi ne s'est pas ouvert")
      return etabli as HTMLElement
    })
    // La porte de la matrice, sur la fiche du sujet. Absente quand un outil
    // occupe déjà la page — on y est alors descendu autrement.
    const porte = page.querySelector("[data-porte-de-la-matrice]")
    if (porte) {
      fireEvent.click(porte)
      await waitFor(() => {
        if (!document.querySelector("[data-matrice]"))
          throw new Error("la matrice ne s'est pas ouverte")
      })
    }
    return within(document.querySelector("[data-etabli]") as HTMLElement)
  }
  return within(cadre)
}

/** **Le calibrage vit dans « Autres outils »** de la page du sujet (16
 *  septembre 2026) : on remonte de la matrice à la page, puis on l'ouvre. */
async function ouvrirLeCalibrage(nom: string) {
  const etabli = await ouvrirLEtabli(nom)
  fireEvent.click(await etabli.findByRole("button", { name: `‹ ${nom}` }))
  const porte = await waitFor(() => {
    const trouvee = document.querySelector("[data-ouvrir-le-calibrage]")
    if (!trouvee) throw new Error("la page du sujet n'est pas revenue")
    return trouvee as HTMLElement
  })
  fireEvent.click(porte)
}

/** **Le nom d'une table à l'écran, depuis la clé que le domaine écrit** (`B25`).
 *
 *  La retouche porte le vocabulaire des planches — *Détourage*, *Nettoyage*,
 *  *Pixelisation* — là où l'ancien écran reprenait la clé de la recette. Les
 *  essais désignent la clé, qui ne bouge pas : c'est elle qui voyage dans la
 *  recette, et la traduire une fois ici évite de la réécrire à quarante
 *  endroits le jour où un nom d'écran change. */
const NOM_DE_LA_TABLE_A_L_ECRAN: Record<string, string> = {
  détourage: "Détourage",
  recadrage: "Recadrage",
  grille: "Pixelisation",
  quantification: "Couleurs",
  bords: "Nettoyage",
  contours: "Contour",
  retournement: "Retournement",
  "la main": "Main",
  découpage: "Découper",
  superposition: "Superposer",
}

const nomDeLaTable = (cle: string) => NOM_DE_LA_TABLE_A_L_ECRAN[cle] ?? cle

/** Les réglages de la génération, dépliés.
 *
 *  Ils tenaient une colonne de 300 px ouverte en permanence dans la galerie ;
 *  ils suivent la barre qui paie depuis E4, repliés sur une ligne qui dit ce
 *  qu'ils valent. Les ouvrir est un geste de plus dans chaque essai, et c'est
 *  le prix de ne plus les avoir sous les yeux quand on juge une image. */
async function ouvrirLesReglagesDeLAppel() {
  await champDePrompt()
  // L'écran *Préparer une image* les range dans un bloc dépliable nommé
  // « Réglages de l'univers et références héritées ». C'est le même contenu
  // qu'avant — `PanneauReglages` — derrière un `<details>` au lieu d'un bouton
  // qui portait son `aria-expanded`.
  const resume = await screen.findByText(/Réglages de l’univers et références héritées/)
  const bloc = resume.closest("details") as HTMLDetailsElement
  if (!bloc.open) {
    fireEvent.click(resume)
    // jsdom n'ouvre pas toujours un `<details>` au clic de son résumé ; ce
    // n'est pas ce que l'essai mesure, et le forcer ne remplace aucune
    // assertion — l'essai vérifie ce qu'on lit *dedans*.
    if (!bloc.open) bloc.open = true
  }
}

/** Les blocs de l'atelier — fournisseurs, agent, dossiers, mouvements.
 *
 *  **La fenêtre qui les portait a été dissoute** (`RP2`) : le mot *Réglages*
 *  ouvre l'écran à quatre onglets de la maquette, et les quatre blocs y sont
 *  rangés — « Les fournisseurs » sous *Moteurs & workflows*, les trois autres
 *  sous *Agent MCP*. Les essais qui les visent passent donc par ici plutôt que
 *  de réécrire deux clics chacun.
 *
 *  ⚠️ **Ce sont les seuls deux clics qui y mènent**, et c'est le sujet de la
 *  tranche : avant elle, la porte *Réglages* ouvrait l'installation de la
 *  machine, et ni les quatre règles du jeu ni le cadre de délégation n'avaient
 *  de chemin. */
async function ouvrirLePanneauDeLAtelier(
  onglet: "Univers" | "Moteurs & workflows" | "Agent MCP" = "Agent MCP",
) {
  fireEvent.click(screen.getByRole("button", { name: "Réglages" }))
  fireEvent.click(await screen.findByRole("button", { name: onglet }))
}

/**
 * ── L'aide de navigation — **le seul endroit du fichier qui sache comment on
 *    change de lieu** (B0) ──────────────────────────────────────────────────
 *
 * Ce fichier navigue soixante et une fois. Chacune écrivait
 * `leLieu(…)` en toutes lettres, c'est-à-dire
 * qu'elle disait **par quel dessin** on change de lieu au lieu de dire *où l'on
 * va*. La V4 remplace les trois onglets par le carnet ; sans cette aide, la
 * tranche qui les retire casserait soixante et un essais d'un coup, et il
 * faudrait relire chacun pour retrouver ce qu'il voulait vraiment vérifier.
 *
 * **Deux fonctions, et la première suffit aux deux emplois.** Trente-huit
 * appels naviguent, vingt-trois vérifient — l'onglet allumé, le nom qu'il
 * porte. Les uns cliquent le lieu, les autres le lisent : c'est le même
 * accesseur, et c'est pour ça qu'ils passent tous par lui.
 *
 * ⚠️ **Le nom de la galerie n'est pas toujours « Galerie » tout court** : tant
 * que des images sont en route, il porte leur compte. C'est délibéré — le champ
 * de prompt n'est rendu que sur la galerie, donc depuis l'Univers ou le Codex
 * cet onglet est le seul endroit qui dise qu'on a payé. Le piège tenait dans
 * chaque essai ; il tient maintenant ici, une fois.
 */
/** Les destinations historiques, traduites vers les portes du nouvel atelier.
 * « Créer » est une préparation modale qui part de Fabrications : elle ne
 * réintroduit pas de septième destination. */
const PORTE_DE_L_ATELIER: Record<string, RegExp> = {
  Galerie: /^Galerie$/,
  Univers: /^Univers & toile$/,
  Créer: /^Fabrications$/,
}

/** La clé de `PORTE_DE_L_ATELIER` que désigne un nom d'essai, ou `null` si ce
 * n'est pas une destination globale. Les anciens motifs de Galerie restent
 * admis afin que les essais de suivi gardent leur intention métier. */
function laRacineDite(nom: string | RegExp): string | null {
  if (typeof nom === "string") return nom in PORTE_DE_L_ATELIER ? nom : null
  return /galerie/i.test(nom.source) ? "Galerie" : null
}

function leLieu(nom: string | RegExp): HTMLElement {
  const cle = laRacineDite(nom)
  if (!cle) return screen.getByRole("tab", { name: nom })
  // **Borné à la navigation, et c'est indispensable** : « Galerie » est aussi
  // le nom d'une porte de la fiche d'une image, et deux boutons du même nom
  // dans la même fenêtre rendaient chaque `allerA` ambigu — l'erreur disait
  // *found multiple elements*, ce qui ne ressemble en rien à un changement
  // d'écran manqué.
  const portes = within(screen.getByRole("navigation", { name: "Atelier" }))
  return portes.getByRole("button", { name: PORTE_DE_L_ATELIER[cle] })
}

/**
 * Est-on ici ? — `"true"` ou `"false"`, comme l'`aria-selected` d'avant.
 *
 * Les portes déclarent directement la page active. Les onglets internes
 * (univers, fiche) gardent leur `aria-selected`.
 */
function ouverture(nom: string | RegExp): string {
  const cle = laRacineDite(nom)
  if (cle) return leLieu(nom).getAttribute("aria-current") === "page" ? "true" : "false"
  return leLieu(nom).getAttribute("aria-selected") ?? "false"
}

/** Aller quelque part. **C'est ce que trente-huit essais voulaient dire.** */
function allerA(nom: string | RegExp) {
  fireEvent.click(leLieu(nom))
}

/** La galerie, **sur ses vidéos**.
 *
 *  La galerie unifiée range les médias en onglets — Images, Animations, Vidéos,
 *  Modèles 3D, Sons — et la grille des images **exclut les clips** : un clip ne
 *  se voit, ne s'ouvre et ne se découpe que depuis l'onglet Vidéos. Les essais
 *  des clips y passent donc, comme l'auteur ; ils cherchaient jusqu'ici la
 *  tuile d'un clip dans la planche contact des images, où elle n'est plus. */
async function allerAuxMedias(sorte: "Images" | "Vidéos") {
  allerA("Galerie")
  const medias = within(
    await screen.findByRole("navigation", { name: "Type de média" }),
  )
  fireEvent.click(medias.getByRole("button", { name: sorte }))
}

const allerAuxVideos = () => allerAuxMedias("Vidéos")
/** La planche contact des images. **La galerie garde l'onglet ouvert** d'un
 *  passage à l'autre : revenir à la galerie ne revient pas aux images. */
const allerAuxImages = () => allerAuxMedias("Images")

async function cadreDuCodex() {
  return await waitFor(() => {
    const cadre = document.querySelector("[data-codex], [data-etabli], [data-univers]")
    if (!cadre) throw new Error("aucun onglet en profondeur n'est monté")
    return cadre as HTMLElement
  })
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
    allerA("Galerie")

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

    const bouton = await screen.findByRole("button", { name: BOUTON_DE_RELECTURE })
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
    fireEvent.change(screen.getByLabelText(CHAMP_DE_RECHERCHE), {
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

    allerA("Galerie")
    fireEvent.change(await screen.findByLabelText(CHAMP_DE_RECHERCHE), {
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
      (screen.getByLabelText(CHAMP_DE_RECHERCHE) as HTMLInputElement).value,
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
    // **La colonne qui range a changé d'écran, pas de nature.** La galerie
    // portait un arbre des collections repliable ; ranger vit maintenant dans
    // « Les assets », et la galerie est la planche contact — elle ne porte plus
    // de colonne du tout, ni celle des réglages, partie avec ce qui paie.
    // Ce qui se replie par choix devant cette grille-ci est la navigation de
    // l'atelier, et le fait mesuré est le même : replier n'est pas fermer.
    expect(screen.queryByRole("button", { name: "réglages" })).toBeNull()
    expect(screen.queryByRole("button", { name: "arbre" })).toBeNull()

    // Déployée d'emblée : l'écran large est la ressource du produit (US-97).
    const replier = screen.getByRole("button", { name: "Replier la navigation" })
    expect(replier.getAttribute("aria-expanded")).toBe("true")

    fireEvent.click(replier)
    const deplier = screen.getByRole("button", { name: "Déplier la navigation" })
    expect(deplier.getAttribute("aria-expanded")).toBe("false")
    // Replier n'est pas fermer : la grille n'a pas bougé de contenu, et les six
    // portes restent atteignables sous leur nom court.
    expect(tuiles()).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Galerie" })).toBeTruthy()

    fireEvent.click(deplier)
    expect(
      screen.getByRole("button", { name: "Replier la navigation" }).getAttribute("aria-expanded"),
    ).toBe("true")
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
    // **Deux endroits disent ce zéro**, et c'est le cas depuis le 16 septembre
    // 2026 : le compteur de la grille, et le pied de l'atelier, qui compte
    // maintenant des *images* et non des « assets » — le mot est sur la liste
    // noire de `docs/vocabulaire.html`.
    expect(screen.getAllByText("0 image")).toHaveLength(2)
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
    allerA("Univers")
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
    allerA("Univers")
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

  // ── T4 : le refus nomme le fichier ───────────────────────────────────────

  test("un fichier qui n'est pas une image est refusé en le nommant", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    allerA("Univers")
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
    allerA("Univers")
    await screen.findByText("Le tableau est vide.")

    // L'écoute est posée sur la fenêtre : elle voit passer aussi les collages
    // qui ne lui sont pas adressés. Celui-ci remplit une case — le nom d'une
    // ambiance, celui d'un groupe, le mot d'un lien — et le tableau n'en sait
    // rien.
    //
    // **Le champ pris est celui du côté Ambiances**, et il l'est par
    // élimination : la galerie ne se rend plus derrière l'Univers depuis qu'ils
    // sont deux onglets (E1), un champ démonté ne reçoit aucun collage, et le
    // côté Réglages est parti avec l'assistant (`C2`). Ce que l'essai prouve ne
    // change pas d'un pouce — le collage arrive dans un champ de saisie de
    // l'écran ouvert, et le tableau l'ignore.
    allerA("Ambiances et couleurs")
    const champ = await screen.findByLabelText("Nouvelle ambiance")
    fireEvent.paste(champ, { clipboardData: { files: [], getData: () => "héros" } })

    expect(fetchDouble.mock.calls.some(([url]) => String(url).includes("/api/board/text"))).toBe(
      false,
    )
    // On revient regarder : le tableau vit du côté Inspiration, et il est resté
    // vide — c'est ce que l'essai vient prouver.
    allerA("Inspiration")
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

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
    // **`Découper` a quitté la fiche** (E3, E4) : c'est une fabrique de la
    // retouche, et la fiche y mène par sa seconde porte.
    fireEvent.click(await screen.findByRole("button", { name: "La retoucher" }))
    fireEvent.click(await screen.findByRole("button", { name: "Découper" }))
    return double
  }

  test("découper part de la fiche, montre ce qui sortira, et se corrige à la main", async () => {
    const { appels } = await ouvrirLaDecoupe()

    // **On est descendu d'un étage dans la galerie**, et le fil le dit — *La
    // retouche* depuis `B25` : les trois genres de lieu de cet écran n'en font
    // plus qu'un, et la table ouverte est un état de l'écran, pas une
    // profondeur de la pile. La fabrique, elle, se lit sur sa puce enfoncée.
    expect((await screen.findAllByText("La retouche")).length).toBeGreaterThan(0)
    expect(
      screen.getByRole("button", { name: "Découper" }).getAttribute("aria-pressed"),
    ).toBe("true")
    expect(screen.getByText("2 zones")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Extraire 2 images" })).toBeTruthy()

    // **Corriger n'a pas besoin de convaincre la détection.** On retire un
    // rectangle, et ce qui partira suit — c'est la liste de l'auteur qui compte.
    fireEvent.click(screen.getByRole("button", { name: "Retirer le rectangle 2" }))
    expect(screen.getByRole("button", { name: "Extraire 1 image" })).toBeTruthy()

    // La relecture montre ce qui va sortir avant de créer quoi que ce soit.
    fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
    fireEvent.click(await screen.findByRole("button", { name: "Créer ces résultats" }))

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
    expect(screen.getByRole("button", { name: /^Extraire 0/ })).toBeDisabled()
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

  test("« Guide », dans la barre de tête, ouvre le volet", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))

    expect(await screen.findByRole("heading", { name: "Guide", level: 1 })).toBeTruthy()
    expect(document.querySelector("[data-volet-du-guide]")).toBeTruthy()
  })

  test("le bouton Guide de la navigation ouvre le même volet", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    const navigation = screen.getByRole("complementary", { name: "Navigation du jeu" })
    fireEvent.click(within(navigation).getByRole("button", { name: "Guide" }))

    expect(await screen.findByRole("heading", { name: "Guide", level: 1 })).toBeTruthy()
  })

  test("« Livrer au jeu » ouvre le guide sur l'écran de sortie, pas sur la racine du dessous", async () => {
    // `sortieOuverte` n'était testé nulle part dans `ecranDuGuide` (`App.tsx`) :
    // la panne que `GU7` (1/2) avait réparée pour `ou: "jeu"`, restée entière
    // ici jusqu'à `GU12` (2/2). Ouvrir *Livrer au jeu* montrait le guide de la
    // galerie, la racine du dessous.
    const { fetchDouble } = serveurDouble()
    // `LivraisonDuJeu` (`Livraisons.tsx`) lit deux routes que le double
    // commun ne sert pas — l'association Godot et l'historique des
    // livraisons — pour l'écran qui s'ouvre derrière le volet. Sans elles il
    // ne s'agit que de laisser l'écran se monter ; le guide, lui, ne regarde
    // aucune de ces deux réponses.
    const fetchAvecGodot = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.endsWith("/godot-link"))
        return Promise.resolve({ ok: true, status: 200, json: async () => null } as Response)
      if (typeof url === "string" && url.endsWith("/deliveries"))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ livraisons: [] }) } as Response)
      return fetchDouble(url, init)
    })
    await monter(fetchAvecGodot)

    const navigation = screen.getByRole("complementary", { name: "Navigation du jeu" })
    fireEvent.click(within(navigation).getByRole("button", { name: "Livrer au jeu" }))
    fireEvent.click(within(navigation).getByRole("button", { name: "Guide" }))

    await screen.findByRole("heading", { name: "Guide", level: 1 })
    const volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Livrer au jeu — ce qui en sort vers Godot")
    expect(volet.textContent).not.toContain("La galerie — chaque résultat conservé dans le jeu")
  })

  test("les sons : le guide suit l'atelier des sons, posé par-dessus la racine", async () => {
    // **`GU14`, puis `RT8`.** `sonsOuverts` est devenu un lieu de la pile
    // (`RT8` : l'atelier des sons quitte le dialogue plein écran pour une
    // surface, comme les tuiles) ; avant `GU14`, `ecranDuGuide` ne le testait
    // pas du tout, et ouvrir *Les sons* montrait le guide de la racine du
    // dessous — le codex, qui ne dit rien d'une coupe ni d'une boucle.
    const { fetchDouble } = serveurDouble()
    // Le double commun ne sert pas la liste des sons : un jeu sans aucun son.
    const fetchAvecSons = vi.fn((url: string, init?: RequestInit) =>
      typeof url === "string" && url.endsWith("/sounds")
        ? Promise.resolve({ ok: true, status: 200, json: async () => [] } as Response)
        : fetchDouble(url, init),
    )
    await monter(fetchAvecSons)

    fireEvent.click(screen.getByRole("button", { name: "Codex" }))
    const bibliotheque = await screen.findByRole("main", { name: "Codex" })
    fireEvent.click(within(bibliotheque).getByRole("button", { name: "Les sons" }))
    await screen.findByLabelText("Atelier sonore")

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    const volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Les sons — chaque son du jeu s'écoute")
    expect(volet.textContent).toContain("Jouer en boucle")
    expect(volet.textContent).not.toContain("Le codex — l'inventaire")
  })

  test("la fenêtre de préparation, une fois son type passé à Son, ouvre le guide sur Un son", async () => {
    // **`GU14`.** La fenêtre s'ouvre sur un type, mais le type se change
    // dedans : `App` l'apprend par `onType`. Sur Image, le guide reste celui
    // de la racine ; sur Son, c'est celui du formulaire qu'on voit.
    const { fetchDouble } = serveurDouble()
    // Le formulaire lit les moteurs par famille : aucun moteur, ici.
    const fetchAvecMoteurs = vi.fn((url: string, init?: RequestInit) =>
      typeof url === "string" && url.includes("/workflow-profiles/sound-defaults")
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ familles: {} }) } as Response)
        : fetchDouble(url, init),
    )
    await monter(fetchAvecMoteurs)
    await champDePrompt()

    const type = within(guichet()).getByRole("combobox", { name: "Type de résultat" })
    fireEvent.change(type, { target: { value: "son" } })
    await screen.findByLabelText("Ce qu’on doit entendre")

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    const volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Un son — on décrit ce qu'on veut entendre")
    expect(volet.textContent).not.toContain("La galerie — chaque résultat conservé")
  })

  // ── `GU15` (1/2) — les quatre écrans neufs, et le routage qu'ils réparent ──
  //
  // Les quatre n'ont pas encore de résumé : c'est `GU15` (2/2) qui les écrit.
  // Ce qu'on mesure ici est donc le nom de l'écran dans l'en-tête du volet —
  // `NOM_DE_LECRAN`, `Guide.tsx` — et **l'absence** du résumé de l'écran dont
  // chacun héritait à tort. La seconde moitié ajoutera la phrase attendue.

  test("une fiche de clip laissée ouverte dans la galerie ne suit pas dans les autres écrans", async () => {
    // `GU16`, vu au navigateur : `ficheClip` est l'état de la colonne de droite
    // de la galerie, et il survit quand on la quitte. Avant la garde
    // `surface === "galerie"`, *Les sujets* et *Fabrications* — tout ce qui
    // vient après lui dans `ecranDuGuide` — montraient « Un clip ».
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, generations: [clipRendu("clip-a", false)] })
    await allerAuxVideos()
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir le résultat" }))
    await waitFor(() => expect(document.querySelector("[data-fiche-clip]")).toBeTruthy())

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    let volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Un clip") // sur la galerie, c'est bien lui
    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Guide", level: 1 })).toBeNull(),
    )

    fireEvent.click(screen.getByRole("button", { name: "Fabrications" }))
    await screen.findByRole("main", { name: "Fabrications" })
    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.querySelector("header p")?.textContent).toBe("Fabrications")
    expect(volet.textContent).not.toContain("Le clip — l'image de départ choisie")
  })

  test("les fabrications : le guide sert l'écran du même nom, plus celui d'un clip", async () => {
    // Les neuf fiches de cet écran logeaient sous `ou: "clip"`, faute d'une
    // valeur à lui : ouvrir *Fabrications* montrait le guide d'un clip.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Fabrications" }))
    await screen.findByRole("main", { name: "Fabrications" })

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    const volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Fabrications")
    // Les neuf fiches sont bien ici…
    expect(volet.textContent).toContain("État des fabrications")
    expect(volet.textContent).toContain("Le suivi des calculs locaux")
    // …et le résumé du clip ne s'y invite plus.
    expect(volet.textContent).not.toContain("Le clip — l'image de départ choisie")
  })

  test("relire avant l'envoi : le guide suit l'écran qui paie, pas la racine du dessous", async () => {
    // Le seul écran d'où l'argent part, et `ecranDuGuide` ne le testait nulle
    // part : on y voyait le guide de la galerie.
    const double = serveurDouble({ personnages: [] })
    await monter(double.fetchDouble)

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
    await screen.findByRole("button", { name: /^Payer et lancer/ })

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    const volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Relire avant l’envoi")
    expect(volet.textContent).not.toContain("La galerie — chaque résultat conservé")
    // Rien n'est parti : ouvrir le guide ne paie pas.
    expect(double.appels.filter((a) => a.url === "/api/generations")).toHaveLength(0)
  })

  test("la grille du jeu et comparer ont leur écran, et plus celui de la page d'un sujet", async () => {
    // Les deux **prennent la place** de la page d'un sujet : ni établi, ni
    // onglets, ni fabrication. Le résumé de `sujet` n'y était vrai d'aucune de
    // ses trois lignes.
    // Les deux portes sont grisées tant que le sujet n'a pas une image : le
    // double en pose une sur sa case *repos*.
    const nain = personnage("Le nain")
    const avecImage = {
      ...nain,
      cases: nain.cases.map((c) =>
        c.pose === "repos" ? { ...c, images: [asset("bbbb2222-0", "le nain, au repos")] } : c,
      ),
    }
    const { fetchDouble } = serveurDouble({ personnages: [avecImage] })
    await monter(fetchDouble)

    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(await etabli.findByRole("button", { name: "‹ Le nain" }))
    // Les deux portes vivent dans le repli « Autres outils » de la page, comme
    // le calibrage : on les atteint par leur libellé, sans déplier.
    fireEvent.click(await screen.findByText("Voir la grille du jeu"))
    await screen.findByRole("heading", { name: "Sur la grille du jeu", level: 1 })

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    let volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Sur la grille du jeu")
    expect(volet.textContent).not.toContain("La page d'un sujet du jeu")

    fireEvent.keyDown(window, { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: "Comparer ›" }))
    await screen.findByRole("heading", { name: /^(Deux côte à côte|Le même, deux fois)$/, level: 1 })

    fireEvent.keyDown(window, { key: "?" })
    await screen.findByRole("heading", { name: "Guide", level: 1 })
    volet = document.querySelector("[data-volet-du-guide]") as HTMLElement
    expect(volet.textContent).toContain("Deux côte à côte")
    expect(volet.textContent).not.toContain("La page d'un sujet du jeu")
  })

  test("? ouvre le volet depuis n'importe où, et Échap le referme", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.keyDown(window, { key: "?" })
    expect(await screen.findByRole("heading", { name: "Guide", level: 1 })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Guide", level: 1 })).toBeNull(),
    )
  })

  test("le volet ne recouvre plus l'atelier — la grille reste dessous, cliquable", async () => {
    // **La règle qui a donné son nom à la tranche.** L'ancien Guide posait
    // `fixed inset-0` : plus une tuile n'était sous la main tant qu'il était
    // ouvert. Le volet est étroit et posé à droite ; le reste de l'écran ne
    // bouge pas.
    const images = [asset("aaaa1111-0")]
    const double = serveurDouble({ assets: images })
    await monter(double.fetchDouble, { ...ETAT, assets: images })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    await screen.findByRole("heading", { name: "Guide", level: 1 })

    expect(tuiles()).toHaveLength(1)
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
    // Le volet rend les entrées d'un écran à la file, et le nom est le titre
    // de chacune. Deux « famille » sur le même écran — celle d'une carte et
    // celle d'une échelle — et le lecteur ne sait plus laquelle il lit. C'est
    // la seule collision qu'un regroupement par écran ne rattrape pas.
    const vus = new Map<string, string>()
    for (const [cle, entree] of Object.entries(AIDE)) {
      const empreinte = `${entree.ou} · ${entree.nom.toLowerCase()}`
      expect(vus.get(empreinte), `${cle} et ${vus.get(empreinte)} — même nom, même écran`)
        .toBeUndefined()
      vus.set(empreinte, cle)
    }
  })

  test("chaque entrée reste adressée à un écran connu à mesure que le corpus grandit", () => {
    // **Le critère qui commande la tranche (B7).** Fermé côté type
    // (`Explication["ou"]`, qui n'accepte à la compilation que ces valeurs-là),
    // et retenu ici aussi : un `ou` qui ne serait dans aucun des deux serait
    // une entrée qui ne paraît plus nulle part, en silence.
    const LIEUX_FERMES = new Set<Explication["ou"]>([
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
      // Les trois écrans des tuiles (`GU13`, 1/2) : ils n'ont pas encore de
      // fiche, et la boucle ci-dessous ne les verra donc pas — la liste les
      // porte quand même, sans quoi la première fiche écrite par `GU13` (2/2)
      // ferait rougir cet essai-ci au lieu d'être simplement rangée.
      "tuiles",
      "jeu-de-tuiles",
      "livraison-de-tuiles",
      // Le son (`GU14`) : l'atelier des sons et le formulaire *Un son*. Deux
      // dialogues, pas deux lieux de la pile — `ecranDuGuide` les produit avant tout.
      "son",
      "un-son",
      // Les quatre écrans de `GU15` (1/2). `fabrications` porte déjà ses neuf
      // fiches, venues de `ou: "clip"` où aucune n'était à sa place ; les trois
      // autres sont vides jusqu'à `GU15` (2/2), et la liste les porte quand même
      // pour la raison dite plus haut sur les tuiles.
      "fabrications",
      "envoi",
      "grille",
      "comparer",
    ])
    // Le corpus a grandi avec les écrans unifiés. Son volume n'est pas un
    // contrat : l'adresse de chaque entrée et l'unicité testée ci-dessus le
    // sont. Le seuil protège seulement contre une disparition massive.
    expect(Object.keys(AIDE).length).toBeGreaterThan(183)
    for (const [cle, entree] of Object.entries(AIDE)) {
      expect(LIEUX_FERMES.has(entree.ou), `${cle} → ou: "${entree.ou}"`).toBe(true)
    }
  })

  test("le corpus ne nomme plus un écran de la V1, et ne compte plus les places à cinq", () => {
    // Le tour d'écran qui vivait dans l'ancien Guide plein écran ne fait pas
    // le voyage vers le volet (B7, cf. l'en-tête de `Guide.tsx`) — mais le
    // corpus, lui, reste juste par lui-même : c'est lui que la bulle et
    // `EnTeteDeSection` lisent à longueur de journée, avec ou sans volet.
    const corpus = Object.values(AIDE)
      .map((e) => `${e.quoi} ${e.change} ${e.long ?? ""}`)
      .join(" ")
    expect(corpus).not.toMatch(/cinq places|cinq étapes/)
    expect(corpus).not.toMatch(/l'Atelier/)
    expect(corpus).not.toMatch(/l'écran Univers/)
    expect(corpus).not.toMatch(/dépliant/)
  })

  test("un réglage sans explication n'a pas de trait sous son nom, et le guide le dit", async () => {
    // **Le trou est visible dans le guide, jamais dans le travail.** Aucune
    // bulle vide, aucun « à documenter » dans un panneau : on voit seulement
    // qu'il n'y a rien à survoler.
    expect(AIDE["reglage.qui.nexiste.pas"]).toBeUndefined()
    // Et le guide, lui, tient la liste de ce qu'il ne dit pas — quel que soit
    // l'écran ouvert au moment où on l'ouvre.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    await screen.findByRole("heading", { name: "Guide", level: 1 })

    expect(
      screen.getByRole("heading", { name: "Ce qui n'est pas encore écrit" }),
    ).toBeTruthy()
    for (const manque of SANS_ENTREE) {
      expect(screen.getByText(manque)).toBeTruthy()
    }
  })

  test("le titre du volet reste seul en serif", async () => {
    // **Aucun quatrième emploi du serif.** Le titre d'écran en est un ; le nom
    // d'une entrée du corpus (`h3`) n'en est jamais un.
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    fireEvent.click(screen.getByRole("button", { name: "Guide" }))

    const titre = await screen.findByRole("heading", { name: "Guide", level: 1 })
    expect(titre.className).toContain("font-serif")

    const nomsDentree = [...document.querySelectorAll("[data-volet-du-guide] h3")]
    expect(nomsDentree.length).toBeGreaterThan(0)
    for (const n of nomsDentree) expect(n.className).not.toContain("font-serif")
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

    await ouvrirLePanneauDeLAtelier()

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
  //
  // `RP2` a remplacé la fenêtre par un écran à quatre onglets. La règle ne
  // change pas : Échap referme, et le bouton de sortie le dit.

  test("Échap ferme les Réglages, et la sortie annonce le raccourci", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    await ouvrirLePanneauDeLAtelier()
    expect(
      await screen.findByRole("button", { name: "Fermer les réglages — Échap" }),
    ).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Fermer les réglages — Échap" }),
      ).toBeNull(),
    )
  })

  test("fournisseurs, garde-fous et dossiers se règlent depuis un seul écran", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    // **Un seul écran, deux de ses quatre onglets** (US-96, rangé par `RP2`) :
    // les clés sont là où l'on branche les moteurs, les garde-fous là où l'on
    // borne l'agent. Ce que la tranche garantit est qu'aucun des trois blocs
    // n'a de porte à lui.
    await ouvrirLePanneauDeLAtelier("Moteurs & workflows")
    expect(
      await screen.findByRole("heading", { name: "Les fournisseurs" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Agent MCP" }))
    expect(await screen.findByRole("heading", { name: "L'agent" })).toBeTruthy()
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

  // ── Les mouvements (A6) ───────────────────────────────────────────────────
  //
  // **Dans l'onglet Univers depuis le 18 septembre 2026**, et propres au jeu
  // ouvert : chaque appel porte `?projet=…`. On l'écrit ici, on le **choisit**
  // ailleurs.

  const ouvrirLesMouvements = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble(options)
    await monter(double.fetchDouble)
    await ouvrirLePanneauDeLAtelier("Univers")
    await screen.findByRole("heading", { name: "Les mouvements" })
    return double
  }

  test("l'atelier arrive avec ses mouvements, et le texte qui part se lit sans déplier", async () => {
    await ouvrirLesMouvements()

    // **Ce que l'auteur vient vérifier ici est le texte anglais** : c'est lui
    // qui part, et c'est la seule chose qu'une liste de noms ne dirait pas.
    expect(screen.getByRole("button", { name: "marche" })).toBeTruthy()
    expect(
      screen.getByText(
        "walking cycle, full body, walking in place, looping seamlessly",
      ),
    ).toBeTruthy()

    // La cadence et les directions se lisent sur la ligne. **Vide veut dire
    // toutes** : seule la mort en déclare une, et c'est un fait sur le monde.
    expect(screen.getByText("10 i/s · sud")).toBeTruthy()
    expect(screen.getByText("12 i/s")).toBeTruthy()
  })

  test("un mouvement nommé ici porte sa marque, un livré n'en porte aucune", async () => {
    await ouvrirLesMouvements({
      mouvements: {
        mouvements: [
          ...MOUVEMENTS,
          {
            identifiant: "nage",
            nom: "nage",
            texte: "swimming cycle, arms stroking, looping seamlessly",
            cadence: 12,
            directions: [],
            livre: false,
            masque: false,
          },
        ],
        masques: [],
      },
    })

    // La même marque que partout ailleurs dans le produit : un livré est le
    // même chez tout le monde, un fabriqué n'existe que dans cet atelier-ci.
    expect(screen.getAllByText("nommé ici")).toHaveLength(1)
  })

  test("nommer un mouvement envoie ses deux textes, et rien avant qu'ils soient là", async () => {
    const { appels } = await ouvrirLesMouvements()

    fireEvent.click(screen.getByRole("button", { name: "Nommer un mouvement" }))
    const nom = screen.getByPlaceholderText("nage")
    const texte = screen.getByPlaceholderText(
      "swimming cycle, arms stroking, looping seamlessly",
    )

    // **Les deux textes sont la définition**, et le bouton le dit avant que le
    // serveur ait à le refuser : un mouvement sans texte anglais ne fait rien
    // partir, un mouvement sans nom ne se clique pas.
    fireEvent.change(nom, { target: { value: "nage" } })
    expect(screen.getByRole("button", { name: "Nommer" })).toBeDisabled()

    fireEvent.change(texte, { target: { value: "swimming cycle" } })
    fireEvent.click(screen.getByRole("button", { name: "Nommer" }))

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url.startsWith("/api/movements?projet=") &&
            JSON.stringify(a.corps) ===
              JSON.stringify({ nom: "nage", texte: "swimming cycle" }),
        ),
      ).toBe(true),
    )
  })

  test("masquer dit ce qu'il fait, et ce n'est pas la même chose des deux côtés", async () => {
    await ouvrirLesMouvements({
      mouvements: {
        mouvements: [
          MOUVEMENTS[1],
          {
            identifiant: "nage",
            nom: "nage",
            texte: "swimming cycle",
            cadence: 12,
            directions: [],
            livre: false,
            masque: false,
          },
        ],
        masques: [],
      },
    })

    // **Un livré laisse une pierre, un fabriqué s'en va pour de bon**, et
    // l'écran ne promet pas la même chose dans les deux cas : le catalogue des
    // livrés se relit à chaque lecture, donc effacer un livré le ferait revenir.
    fireEvent.click(screen.getByRole("button", { name: "marche" }))
    expect(screen.getByText("masquer — il se remontre")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "nage" }))
    await waitFor(() => expect(screen.getByText("masquer — il s'en va")).toBeTruthy())
  })

  test("un livré masqué se remontre d'un clic", async () => {
    const { appels } = await ouvrirLesMouvements({
      mouvements: {
        mouvements: [MOUVEMENTS[0]],
        masques: [{ ...MOUVEMENTS[1], masque: true }],
      },
    })

    // Sans cette liste, masquer serait irréversible — et un geste irréversible
    // sur du vocabulaire livré n'a aucune raison d'être.
    fireEvent.click(screen.getByRole("button", { name: "marche · remontrer" }))
    await waitFor(() =>
      expect(
        appels.some((a) => a.url.startsWith("/api/movements/marche/show?projet=")),
      ).toBe(true),
    )
  })

  test("les trois réglages d'un mouvement portent leur explication", async () => {
    await ouvrirLesMouvements()

    for (const cle of ["mouvement.nom", "mouvement.texte", "mouvement.cadence"]) {
      expect(AIDE[cle], `${cle} — absent du corpus`).toBeTruthy()
      // Passées sous `ou: "jeu"` en `GU10` : ces trois réglages sont montés
      // dans l'onglet Univers de `Reglages.tsx` depuis le 18 septembre 2026,
      // pas dans l'onglet Agent MCP.
      expect(AIDE[cle].ou).toBe("jeu")
    }

    // Et elles sont **atteignables depuis le réglage** : le pointillé ne paraît
    // que sur un libellé dont le corpus porte l'entrée.
    fireEvent.click(screen.getByRole("button", { name: "marche" }))
    const marque = (nom: string) =>
      [...document.querySelectorAll("span")].some(
        (e) => e.textContent === nom && e.className.includes("decoration-dotted"),
      )
    await waitFor(() => expect(marque("Ce qui part au modèle")).toBe(true))
    expect(marque("Cadence")).toBe(true)
  })

  // ── Les styles de combat (SC4) ─────────────────────────────────────────────

  test("l'atelier arrive avec ses styles, et le texte d'un mouvement se lit en dépliant", async () => {
    await ouvrirLesMouvements({ styles: { styles: STYLES, masques: [] } })

    await screen.findByRole("heading", { name: "Les styles de combat" })
    expect(screen.getByRole("button", { name: "bâton à deux mains" })).toBeTruthy()
    // Ce qu'il tient se lit sans déplier.
    expect(screen.getByText("a long wooden staff held in both hands")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "bâton à deux mains" }))
    expect(
      screen.getByRole("textbox", { name: "bâton à deux mains — marche" }),
    ).toHaveValue("a two-handed staff carried while walking, staying in place")
  })

  test("corriger le texte d'un mouvement pour un style l'envoie fusionné aux autres", async () => {
    const { appels } = await ouvrirLesMouvements({ styles: { styles: STYLES, masques: [] } })
    await screen.findByRole("heading", { name: "Les styles de combat" })

    fireEvent.click(screen.getByRole("button", { name: "bâton à deux mains" }))
    fireEvent.change(screen.getByRole("textbox", { name: "bâton à deux mains — marche" }), {
      target: { value: "a two-handed staff carried while walking, then a low guard" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Poser" }))
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url.startsWith("/api/styles/baton?projet=") &&
            (a.corps as { textes?: Record<string, string> } | undefined)?.textes?.marche ===
              "a two-handed staff carried while walking, then a low guard",
        ),
      ).toBe(true),
    )
  })

  test("nommer un style envoie son texte, et rien avant qu'il soit là", async () => {
    const { appels } = await ouvrirLesMouvements({ styles: { styles: [], masques: [] } })
    await screen.findByRole("heading", { name: "Les styles de combat" })

    fireEvent.click(screen.getByRole("button", { name: "Nommer un style" }))
    const nom = screen.getByPlaceholderText("bâton à deux mains")
    fireEvent.change(nom, { target: { value: "lance" } })
    const bouton = screen.getByRole("button", { name: "Nommer" })
    expect(bouton).toBeDisabled()

    fireEvent.change(screen.getByRole("textbox", { name: "marche" }), {
      target: { value: "a spear carried while walking, staying in place" },
    })
    expect(bouton).not.toBeDisabled()
    fireEvent.click(bouton)
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url.startsWith("/api/styles?projet=") &&
            (a.corps as { nom?: string } | undefined)?.nom === "lance",
        ),
      ).toBe(true),
    )
  })

  test("la phrase d'animation d'une direction se lit en gris et se corrige pour le jeu", async () => {
    // **Demandé le 18 septembre 2026** : l'auteur tapait « shown from behind »
    // à la main pour chaque course vers le nord.
    const livree = "The character is seen from behind, its back to the viewer."
    const { appels } = await ouvrirLesMouvements({
      directions: {
        ...SANS_DIRECTIONS,
        directions: [{ identifiant: "nord", nom: "nord", consigne: "facing north" }],
        phrases_livrees: { nord: livree },
      },
    })

    await screen.findByRole("heading", { name: "Les directions en animation" })
    const champ = screen.getByRole("textbox", { name: "Phrase d'animation — nord" })
    expect(champ.getAttribute("placeholder")).toBe(livree)

    fireEvent.change(champ, { target: { value: "Back view, running away." } })
    fireEvent.click(screen.getByRole("button", { name: "Poser" }))
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/characters/directions/nord" &&
            JSON.stringify(a.corps) === JSON.stringify({ animation: "Back view, running away." }),
        ),
      ).toBe(true),
    )
  })

  test("les trois réglages de l'agent portent leur explication", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLePanneauDeLAtelier()

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
    allerA("Univers")
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

  test("un clip posé sur la toile s'y rejoue, avec sa première image en affiche", async () => {
    // **AU18.** La carte ne garde aucune copie de la vidéo : elle porte la
    // vignette du clip, et son lecteur va chercher le fichier là où il vit —
    // c'est ce que dit `source`, et c'est la seule chose qui la distingue
    // d'une carte image à l'écran.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({
      cartes: [
        carteImage("clip-pose", {
          genre: "video",
          source: "clip:video-1",
          position: [600, 400],
          type_media: "image/png",
        }),
      ],
    })
    await monter(fetchDouble)
    await ouvrirLaToile()

    const lecteur = await screen.findByLabelText("clip:video-1")
    expect(lecteur.tagName).toBe("VIDEO")
    expect(lecteur).toHaveAttribute("src", "/api/clips/video-1/video")
    // L'affiche est la vignette de la carte, servie par la route des cartes.
    expect(lecteur.getAttribute("poster")).toContain("/api/board/clip-pose/image")
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
    allerA("Univers")

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

    allerA("Galerie")
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

  test("fermer l'univers puis le rouvrir retrouve images, note, îlot et lien à la même place", async () => {
    // Critère AU2 : « L'univers garde un accès direct à sa toile existante :
    // images, textes, notes, îlots et liens ; modifier une composition puis la
    // rouvrir retrouve son contenu et sa disposition. » L'écran ne tient rien
    // lui-même — ni la place d'une carte, ni le nom d'un îlot, ni un lien — donc
    // « rouvrir » n'est jamais qu'un remontage sur ce que le disque dit encore.
    // Les cinq objets du critère sont ici à la fois : deux images groupées (donc
    // un îlot), une note et un lien entre les deux images.
    doublerLaGrille(160)
    const cartes = [
      carteImage("m1", { groupe: "marais", position: [40, 20] }),
      carteImage("m2", { groupe: "marais", position: [240, 20] }),
      carteImage("note", { genre: "texte", texte: "trois pierres, pas quatre", position: [40, 320] }),
    ]
    const { fetchDouble } = serveurDouble({
      cartes,
      liens: [{ ...LIEN, mot: "vient de" }],
    })
    await monter(fetchDouble)
    await ouvrirLaToile()

    const noeud = (id: string) =>
      document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null

    await waitFor(() => expect(noeud("m1")).toBeTruthy())
    expect(await screen.findByText("trois pierres, pas quatre")).toBeTruthy()
    expect(await screen.findByRole("button", { name: "marais" })).toBeTruthy()
    expect(await screen.findByRole("button", { name: "vient de" })).toBeTruthy()

    // La disposition, prise avant de fermer : ce que la librairie a rendu à
    // partir de la position de chaque carte.
    const avant = {
      m1: noeud("m1")!.style.transform,
      m2: noeud("m2")!.style.transform,
      note: noeud("note")!.style.transform,
    }
    expect(avant.m1).not.toBe("")

    // Fermer l'écran — ici, quitter vers un autre onglet — puis le rouvrir.
    allerA("Galerie")
    await ouvrirLaToile()

    await waitFor(() => expect(noeud("m1")).toBeTruthy())
    expect(noeud("m1")!.style.transform).toBe(avant.m1)
    expect(noeud("m2")!.style.transform).toBe(avant.m2)
    expect(noeud("note")!.style.transform).toBe(avant.note)
    expect(await screen.findByText("trois pierres, pas quatre")).toBeTruthy()
    expect(await screen.findByRole("button", { name: "marais" })).toBeTruthy()
    expect(await screen.findByRole("button", { name: "vient de" })).toBeTruthy()
  })

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
    allerA("Univers")

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
    allerA("Univers")

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
    allerA("Univers")

    const carte = () => screen.getByRole("button", { name: "Ouvrir la note" }).closest("article")!

    await waitFor(() => expect(carte().getAttribute("style")).toContain("--color-ilot-prune"))
    // Au repos, la teinte prend aussi le bord.
    expect(carte().getAttribute("style")).toContain("border-color")

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la note" }))
    // `border-signal` depuis `D2` : sur le papier, l'anneau de la chose
    // choisie est le rouille — `--lumiere` était le jeton du châssis sombre.
    await waitFor(() => expect(carte().className).toContain("border-signal"))
    // Choisie : le bord est à l'anneau, **le fond garde sa teinte**.
    expect(carte().getAttribute("style")).toContain("--color-ilot-prune")
    expect(carte().getAttribute("style")).not.toContain("border-color")
  })

  // ── RP9 : la toile donne du travail ───────────────────────────────────────
  //
  // L'arithmétique de la sélection — ce qui en sort quand une carte disparaît,
  // ce qu'un lot emporte, ce qui partirait — vit dans `composants/Toile.test.tsx`,
  // où elle est pure. Ce qui se vérifie **ici** est ce que la sélection *fait* :
  // l'anneau, le menu qui se retire, les trois gestes, et la préparation qui
  // s'ouvre avec les cartes cochées d'avance.

  /** Les cartes posées sur le plan, et elles seules. **La réserve en rend
   *  d'autres, avec le même nom accessible** : une requête posée sur tout le
   *  document les compterait ensemble, et l'essai prouverait autre chose. */
  const plan = () => document.querySelector("[data-plan]") as HTMLElement
  const cartesDuPlan = () =>
    within(plan()).getAllByRole("button", { name: "Ouvrir la carte" })
  const anneaux = () => plan().querySelectorAll("[data-choisie]")

  test("Ctrl et un clic font un lot, et un lot n'ouvre le menu d'aucune carte", async () => {
    // **Choisir une carte est la sélection à un**, et c'est déjà la grammaire
    // de la galerie. L'anneau ne change donc pas de sens : il dit *celle-ci est
    // choisie*, et plusieurs choisies font un lot. Ce qui se retire, c'est le
    // menu — il règle **une** carte, et ce qu'on fait de plusieurs se lit
    // au-dessus de la toile.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await waitFor(() => expect(cartesDuPlan()).toHaveLength(2))

    fireEvent.click(cartesDuPlan()[0])
    await waitFor(() => expect(anneaux()).toHaveLength(1))
    // Une seule : son menu est ouvert, comme avant la sélection.
    expect(screen.getByText("Îlot")).toBeTruthy()

    fireEvent.click(cartesDuPlan()[1], { ctrlKey: true })
    await waitFor(() => expect(anneaux()).toHaveLength(2))
    expect(screen.getByText("2 choisies")).toBeTruthy()
    expect(screen.queryByText("Îlot")).toBeNull()

    // Et *Effacer la sélection* rend tout — sans rien supprimer : le voisin
    // qui supprime s'appelle *Retirer*, et il vit dans le menu d'une carte.
    fireEvent.click(screen.getByRole("button", { name: "Effacer la sélection" }))
    await waitFor(() => expect(anneaux()).toHaveLength(0))
    expect(screen.queryByText("2 choisies")).toBeNull()
  })

  test("« Mettre en réserve » renvoie tout le lot, et un seul Ctrl+Z le repose", async () => {
    // **Un lot est un geste, donc une entrée de pile** — le même argument que
    // pour un îlot déplacé : deux cartes renvoyées d'un clic demanderaient
    // sinon deux Ctrl+Z, c'est-à-dire le contraire de ce que la pile promet.
    doublerLaGrille(160)
    const { fetchDouble, appels } = serveurDouble({ cartes: compose9() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await waitFor(() => expect(cartesDuPlan()).toHaveLength(2))

    fireEvent.click(cartesDuPlan()[0])
    fireEvent.click(cartesDuPlan()[1], { ctrlKey: true })
    await waitFor(() => expect(anneaux()).toHaveLength(2))

    const ecritures = (carte: string) =>
      appels.filter((a) => a.url === `/api/board/${carte}` && a.corps)

    fireEvent.click(screen.getByRole("button", { name: "Mettre en réserve" }))
    await waitFor(() => expect(ecritures("m1")).toHaveLength(1))
    await waitFor(() => expect(ecritures("m2")).toHaveLength(1))
    expect(ecritures("m1")[0].corps).toEqual({ groupe: "", position: [] })
    expect(ecritures("m2")[0].corps).toEqual({ groupe: "", position: [] })
    // Les trois attendent ensemble, et la sélection est retombée avec elles :
    // ce qui a été rangé n'est plus l'ensemble sous les yeux.
    await waitFor(() => expect(screen.getByText("3 à classer")).toBeTruthy())
    expect(screen.queryByText("2 choisies")).toBeNull()

    // **Un seul** Ctrl+Z, et les deux reviennent où elles étaient.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(ecritures("m1")).toHaveLength(2))
    await waitFor(() => expect(ecritures("m2")).toHaveLength(2))
    expect(ecritures("m1")[1].corps).toEqual({ groupe: "marais", position: [0, 0] })
    expect(ecritures("m2")[1].corps).toEqual({ groupe: "marais", position: [200, 0] })
    await waitFor(() => expect(screen.getByText("1 à classer")).toBeTruthy())
  })

  /** Une image et une note, toutes deux posées sur le plan. */
  const composeAvecUneNote = () => [
    carteImage("m1", { groupe: "marais", position: [0, 0] }),
    carteImage("note", {
      genre: "texte",
      texte: "des tons de tourbe",
      position: [400, 0],
    }),
  ]

  const choisirLesDeux = async () => {
    fireEvent.click(within(plan()).getByRole("button", { name: "Ouvrir la carte" }))
    fireEvent.click(within(plan()).getByRole("button", { name: "Ouvrir la note" }), {
      ctrlKey: true,
    })
    await waitFor(() => expect(anneaux()).toHaveLength(2))
  }

  test("« Fabriquer depuis la sélection » ouvre la préparation, images cochées, notes non", async () => {
    // **Les deux moitiés du critère, ensemble** : l'image de la carte est déjà
    // jointe quand la fenêtre s'ouvre, et le texte de la note n'est nulle part
    // — on ne l'a pas dit.
    //
    // **Et rien ne paie ici** : le geste ouvre la préparation qui existe, pas
    // un troisième endroit d'où l'argent part (E2).
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: composeAvecUneNote() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await choisirLesDeux()
    expect(screen.getByText("joindre 1 note")).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Fabriquer depuis la sélection" }),
    )

    const bande = await screen.findByRole("region", { name: "Références jointes" })
    const vignettes = bande.querySelectorAll("img")
    expect(vignettes).toHaveLength(1)
    // **L'image vient de la route des cartes**, pas de celle des assets : une
    // carte n'est pas dans la bibliothèque, et lui demander une vignette
    // d'asset ferait un trou là où l'auteur croit avoir joint quelque chose.
    expect(vignettes[0].getAttribute("src")).toContain("/api/board/m1/image")
    // **Et elle ne se met pas en source d'édition** : la filiation qui en
    // descendrait n'aurait nulle part où s'écrire. Le rôle n'est pas grisé, il
    // n'est pas proposé.
    const roles = [...bande.querySelectorAll("option")].map((o) => o.textContent)
    expect(roles).not.toContain("Image à modifier")

    expect(
      (screen.getByPlaceholderText(PLACEHOLDER_DU_PROMPT) as HTMLTextAreaElement).value,
    ).not.toContain("des tons de tourbe")
  })

  test("une note ne part en consigne que si la case le dit", async () => {
    // L'autre bout du même critère. La case est tout ce qui reste de la fenêtre
    // « Choisir ce qui part de la toile » : ses trois autres décisions — l'asset
    // visé, le type de résultat, le modèle — appartiennent à la fenêtre unique
    // de RP4, et les reconstruire ici ferait deux endroits à défaire.
    doublerLaGrille(160)
    const { fetchDouble } = serveurDouble({ cartes: composeAvecUneNote() })
    await monter(fetchDouble)
    await ouvrirLaToile()
    await choisirLesDeux()

    fireEvent.click(screen.getByText("joindre 1 note").querySelector("input")!)
    fireEvent.click(
      screen.getByRole("button", { name: "Fabriquer depuis la sélection" }),
    )

    const champ = (await screen.findByPlaceholderText(
      PLACEHOLDER_DU_PROMPT,
    )) as HTMLTextAreaElement
    expect(champ.value).toContain("des tons de tourbe")
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
    //
    // **L'adresse a changé le 4 septembre 2026**, et ce que l'essai tient n'a
    // pas bougé : elle nomme toujours le même asset. Elle passait par
    // l'emplacement de la génération, ce qui n'était vrai que des images de C1 —
    // tout ce qui naît d'un dépliage, d'une découpe ou d'une superposition a un
    // rang qui n'est l'emplacement de rien, et recevait un 400.
    expect(apercu()).toBeTruthy()
    expect(image().getAttribute("src")).toBe("/api/assets/aaaa1111-0/image?brut=false")
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
    allerA("Univers")

    const carte = await waitFor(() => document.querySelector("article")!)
    survoler(carte)
    espace()
    expect(apercu()).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(apercu()).toBeNull()
    // L'onglet est resté ouvert derrière : une pression, un geste.
    expect(
      ouverture("Univers"),
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
    allerA("Univers")
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
    // **L'essai se joue dans la galerie depuis l'atelier unifié**, et c'est là
    // qu'il a le plus de sens : le champ qui paie vit maintenant dans un
    // guichet qui couvre l'écran, donc plus aucune vignette n'est à côté de
    // lui. Le garde, lui, n'a jamais regardé *quel* champ : il regarde s'il y
    // en a un où l'on peut écrire, et si la dernière chose faite a été d'y
    // écrire. La recherche de la galerie est un champ comme un autre, et elle
    // est à quelques pixels des vignettes qu'on juge.
    const image = asset("bbbb2222-0", "le nain, au repos")
    const { fetchDouble } = serveurDouble({ assets: [image] })
    await monter(fetchDouble, { ...ETAT, assets: [image] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    const vignette = tuiles()[0].closest("figure")!

    // Le pointeur se pose : la touche est à l'image.
    survoler(vignette)
    espace()
    expect(apercu()).toBeTruthy()
    espace()

    // On tape un signe dans la recherche, la souris toujours posée sur la
    // vignette : la barre d'espace redevient une espace, et rien ne s'ouvre.
    const champ = screen.getByLabelText("Rechercher un résultat")
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

    // La bande « Repart avec » de la barre qui paie est devenue la section
    // « Références jointes » du guichet ; ce qu'elle doit tenir n'a pas changé.
    const bande = await screen.findByRole("region", { name: "Références jointes" })
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

    survoler(vignette.closest("figure")!)
    espace()
    expect(apercu()).toBeTruthy()
  })
})

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

  // ⚠️ **L'essai sur le plan de poses global est parti avec `Codex.tsx`
  // (`C3`)** : « Leurs poses » vivait dans sa colonne des rubriques, sans
  // équivalent neuf — la seule liste de poses qui reste éditable vit par
  // nature dans `ReglagesDeFamille.tsx` (`les poses par type d'objet`,
  // plus bas).
  //
  // ⚠️ **L'essai sur l'absence de recherche dans le codex est parti aussi** :
  // `Famille.tsx` (`B9`) a depuis ajouté une recherche à sa grille, ce que
  // l'ancien codex n'avait pas — l'invariant qu'il vérifiait n'est donc plus
  // vrai par construction, et pas à cause de cette tranche.

  // ── « Un personnage se crée avec un nom et une description ; sa description
  //     part avec chaque génération de pose, sans être retapée » (US-115) ──────

  test("un personnage se crée d'un nom, et se décrit une fois", async () => {
    const { fetchDouble } = await ouvrir()
    // **Écrire un nom crée la chose**, sur-le-champ : Entrée suffit, et il n'y
    // a pas de bouton *Ajouter* — un formulaire pour une déclaration aurait
    // fait deux gestes pour un.
    const nommer = await screen.findByLabelText("Nom du sujet du jeu à créer")
    fireEvent.change(nommer, { target: { value: "Le nain" } })
    fireEvent.keyDown(nommer, { key: "Enter" })

    // La chose créée s'ouvre directement sur sa fiche : on la nomme pour la
    // décrire, pas pour la ranger. **Le champ a changé d'écran en `B10`, pas de
    // rôle** : la description s'écrivait dans la colonne d'identité de la
    // matrice, elle est maintenant sur la fiche du sujet, qui est la première
    // chose qu'on voit en l'ouvrant — sans détour par ses cases. C'est ce que
    // la tranche livre ; ce que cet essai mesure — *elle s'écrit une fois et
    // part avec chaque génération* — est inchangé.
    // **Le champ s'ouvre à la demande depuis `B15`** : la fiche montre ce
    // qu'elle sait et garde ses champs derrière *Modifier la fiche*, et c'est
    // *Garder la fiche* qui écrit — le départ du champ ne conserve plus rien.
    fireEvent.click(await screen.findByRole("button", { name: "Modifier la fiche" }))
    const description = await screen.findByLabelText("Description du sujet")
    fireEvent.change(description, {
      target: { value: "un forgeron nain à la barbe tressée" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Garder la fiche" }))

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

  // ⚠️ **L'essai « ajouter une attitude » (le plan de poses global) est parti
  // avec `Codex.tsx` (`C3`)** — voir la note plus haut.

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

    // **Armer ne déplace plus personne** (E2) : le guichet s'ouvre par-dessus
    // l'établi et nomme la case qu'on vient d'armer. Il fallait retourner à la
    // galerie tant qu'elle était le seul écran à porter un champ ; c'est fini,
    // et la navigation ne bouge pas.
    await waitFor(() => expect(cibleDuGuichet()).toBe("Le nain · marche"))
    expect(ouverture("Créer")).toBe("false")
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
    // Et la case visée se **voit** au-dessus du texte qui part — le nom de la
    // chose *et* l'attitude, vérifiés dans le guichet et non dans tout l'écran :
    // le fil d'Ariane porte lui aussi le nom de la chose, et c'est sa place —
    // dire où l'on est.
    expect(cibleDuGuichet()).toContain("Le nain")
    expect(cibleDuGuichet()).toContain("marche")
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
    await waitFor(() => expect(cibleDuGuichet()).toBe("Le nain · repos"))
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
    // Le guichet le dit à la place de la bande « Pour » : il ne vise plus une
    // case, il vise une image libre.
    await waitFor(() => expect(cibleDuGuichet()).toBe("Image libre"))
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

    await waitFor(() => expect(cibleDuGuichet()).toContain("Le nain"))

    // **Le prompt reçoit le sujet, jamais la grille** : les attitudes partent
    // case par case dans les consignes de planche, repliées côté serveur.
    const champ = await champDePrompt() as HTMLTextAreaElement
    expect(champ.value).toBe("un forgeron nain à la barbe tressée")

    // Les deux attitudes se lisent au-dessus du texte qui part, et le lot dit
    // ce qu'il est — **une planche, une génération** — avant qu'on paie.
    expect(cibleDuGuichet()).toContain("repos")
    expect(cibleDuGuichet()).toContain("marche")
    expect(
      within(guichet()).getByText(
        "2 cases réunies sur une planche · une génération pour la planche.",
      ),
    ).toBeTruthy()

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
    await waitFor(() => expect(cibleDuGuichet()).toContain("Le nain"))

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

  // **Un lot se corrige sans se défaire.** La bande « Pour » — `Cible`,
  // `composants/Galerie.tsx` — est montée sous le titre du guichet *Préparer
  // une image* : un « × » par attitude, et un « tout retirer » dès qu'il y en a
  // deux. Ce sont **deux gestes différents**, et c'est tout l'objet de l'essai :
  // retirer une attitude laisse le lot armé avec ce qui reste dedans ; désarmer
  // éteint la cible entière. Sans le premier, corriger un lot demandait de
  // fermer le guichet et de recocher les cases une à une.
  test("une attitude se retire du lot sans le défaire", async () => {
    const { ecran } = await ouvrir({
      personnages: [personnage("Le nain", { description: "un forgeron" })],
    })

    fireEvent.click(ecran.getByLabelText("Faire partir repos avec les autres"))
    fireEvent.click(ecran.getByLabelText("Faire partir marche avec les autres"))
    fireEvent.click(await ecran.findByRole("button", { name: "Fabriquer ensemble ›" }))
    await waitFor(() => expect(cibleDuGuichet()).toContain("Le nain"))

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
    await waitFor(() => expect(cibleDuGuichet()).toContain("Le nain"))

    // **Le coût d'un lot est celui d'un appel, pas de N** — c'est la promesse
    // de la tranche, et c'est le même chiffre qu'un compte faux ferait repayer.
    // Le guichet et la matrice restée derrière le disent tous les deux ; c'est
    // celui du guichet qui compte — c'est de là que l'argent part.
    // **Le pied du guichet est l'endroit où l'on lit ce que ça coûte**, juste
    // au-dessus du bouton qui fait relire. Le même compte se retrouve dans le
    // dépliant « Réglages de l'univers », replié : c'est le panneau des
    // réglages, monté là entier, et il n'est pas ce que l'auteur regarde en
    // décidant de payer.
    const paie = within(guichet().querySelector("footer") as HTMLElement)
    await paie.findByText("un compte faux")
    expect(paie.getByText("≈ $0,0245 · 2 cases")).toBeTruthy()
    expect(paie.getByText("≈ $0,0245 à repayer")).toBeTruthy()

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

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
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

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
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
    expect((await screen.findAllByText("jamais généré"))[0]).toBeTruthy()
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
  const NOM_DE_LA_PARTIE: Record<string, string[]> = {
    contexte: ["le contexte"],
    references: ["les références"],
    // Reprise à la main, la demande porte le nom de ce qu'elle est devenue.
    demande: ["la demande", "ton texte"],
  }

  /** ⚠️ **Le pavé n'a plus de poignée à lui** : *Relire avant envoi* range les
   *  trois parties en sections titrées par leur nom, et le texte qui part —
   *  titre du fournisseur compris — est le paragraphe de la section. On le
   *  cherche donc par ce nom, comme un lecteur le trouverait. */
  const partieQuiPart = (clef: string) => {
    const poignee = document.querySelector(`[data-partie-qui-part="${clef}"]`)
    if (poignee) return poignee.textContent
    const noms = NOM_DE_LA_PARTIE[clef] ?? []
    for (const titre of Array.from(
      document.querySelectorAll("[data-envoi] h3"),
    )) {
      if (!noms.includes(titre.textContent?.trim() ?? "")) continue
      return titre.parentElement?.querySelector("p")?.textContent ?? null
    }
    return null
  }

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
    // Les lignes — celles qu'on éteint et qu'on corrige — vivent dans la
    // seconde lecture de l'écran ; l'ordre d'assemblage se lit là.
    await modifierLEnvoi()
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

  // ── « Le texte repris à la main part mot pour mot » · « Reprendre le texte
  //     n'écrit rien dans l'univers » ──────────────────────────────────────────

  test("reprendre le texte pose le texte exact et le fait partir mot pour mot", async () => {
    const { fetchDouble, appels } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await relire()
    await attendreCeQuiPart("un tonneau")

    // **Reprendre vit dans la seconde lecture de l'écran** — celle où l'on
    // modifie —, et il s'appelle par ce qu'il fait : modifier le texte complet
    // à la main.
    await modifierLEnvoi()
    fireEvent.click(
      screen.getByRole("button", { name: "Modifier le texte complet à la main" }),
    )

    // Le champ **est** désormais ce qui partira, bible comprise. Il ne change
    // pas de gabarit, il change de nom : « Texte complet à envoyer », et le
    // guichet dit sous lui que ce texte part mot pour mot.
    const libre = (await screen.findByLabelText(
      "Texte complet à envoyer",
    )) as HTMLTextAreaElement
    expect(screen.getByText(/Ce texte part mot pour mot/)).toBeTruthy()
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
    await modifierLEnvoi()
    fireEvent.click(
      screen.getByRole("button", { name: "Modifier le texte complet à la main" }),
    )
    await screen.findByLabelText("Texte complet à envoyer")

    // Rendre la main s'appelle par ce qu'il rétablit.
    fireEvent.click(
      screen.getByRole("button", { name: "Rétablir les consignes de l’univers" }),
    )

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
    await relire()
    await waitFor(() =>
      expect(partieQuiPart("contexte")).toBe(`CONTEXT\n\n${BIBLE_PARTIE}`),
    )
    expect(partieQuiPart("demande")).toBe(
      `REQUEST\n\n${texteEntier("un tonneau")}`,
    )
    // Et la bible est de nouveau une ligne, avec son propre interrupteur — ce
    // qui se lit dans la seconde lecture, celle qui range des lignes.
    const envoi = await modifierLEnvoi()
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
    fireEvent.click(screen.getByRole("button", { name: "reprendre ses réglages" }))

    const libre = (await screen.findByLabelText(
      "Texte complet à envoyer",
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
        retournement: null,
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
          retournement: null,
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

    // Replié, le bloc porte déjà la taille, les couleurs et le compte des
    // reprises à la main — c'est ce qui permet de lire la fiche entière sans
    // rien ouvrir (RG3, le bloc fusionné « Ce que le jeu lui a fait »).
    const entete = await screen.findByRole("button", { name: /^Ce que le jeu lui a fait/ })
    expect(entete.textContent).toContain("64 px · toutes les couleurs · 1 à la main")

    fireEvent.click(entete)
    const bloc = within(entete.closest("section") as HTMLElement)
    // La cible diffère : réglée à la main. L'occupation, elle, est celle du
    // projet, et son silence le dit — plus de mot « appliqué » qui répétait
    // la même chose sur chaque ligne sans rien apprendre.
    const lignes = bloc.getAllByRole("listitem").map((li) => li.textContent)
    expect(lignes[0]).toContain("réglé à la main")
    expect(lignes[1]).toContain("40 %")
    expect(lignes[1]).toContain("un objet tenu")
    expect(lignes[1]).not.toContain("réglé à la main")
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
    // produit l'avoue plutôt que de répondre « rien n'est posé », qui serait
    // une réponse différente et fausse.
    expect(
      await screen.findByRole("button", { name: /^Ce que le jeu lui a faiton ne sait pas/ }),
    ).toBeTruthy()
  })

  // ── « Taille de pixel "aucune" » — la moitié écran ─────────────────────────
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
    allerA("Galerie")
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
    expect(screen.getByRole("button", { name: BOUTON_DE_RELECTURE })).not.toBeDisabled()
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

  test("la fiche : le panneau se déclare, et sa poignée est dedans", async () => {
    const images = [asset("aaaa1111-0")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // **La poignée que la fiche garde après E4, et RG3 l'a renommée.** Les
    // cinq places sont parties dans les tables ; ce qui reste est ce que
    // l'image *est*, et le bloc fusionné le lit sans s'y régler.
    const marque = poignee("Ce que le jeu lui a fait")
    expect(marque).toBeTruthy()
    expect(marque!.closest("[data-panneau]")).toBeTruthy()
  })

  test("les réglages : le panneau posé sur l'atelier se déclare aussi", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    await ouvrirLePanneauDeLAtelier()

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
    // ⚠️ **jsdom n'a pas la capture du pointeur**, et la carte du calque
    //     l'appelle dès le premier appui (`Calque.tsx`, `commencer`) : sans
    //     cette doublure, le geste s'interrompt sur un `TypeError` avant
    //     d'avoir tracé quoi que ce soit, et l'essai lit une absence d'appel
    //     là où le produit, lui, en fait un. Elle ne fait rien de plus
    //     qu'exister — jsdom livre de toute façon chaque événement à sa cible
    //     — et trois autres écrans de ce fichier la posent déjà.
    Element.prototype.setPointerCapture = () => {}
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.releasePointerCapture = () => {}
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
        // Le serveur désigne le calque qui partirait ; en essai, c'est le
        // premier de la liste, comme la plus récente l'est au serveur.
        retenus: (p.identifiant === "repos" && calques.length
          ? { casque: calques[0].identifiant }
          : {}) as Record<string, string>,
        corps: p.identifiant === "repos" ? corps.identifiant : null,
        origine: "type" as const,
        directions: [],
        directions_rangees: [],
        sans_direction: [],
        bandes: [],
        bandes_ecartees: [],
        bandes_demandees: 1,
      })),
    })

  // ⚠️ **Les deux essais du vestiaire du jeu — création avec emplacement,
  // portée d'une pièce — sont partis avec `Codex.tsx` (`C3`).** Ce n'est pas
  // une perte sèche : `VestiaireDuSujet.tsx` (`B19`) crée déjà une pièce
  // depuis la fiche de qui la porte, avec son propre essai
  // (`VestiaireDuSujet.test.tsx`). La portée d'une pièce, elle, n'a pas encore
  // d'écran neuf — à rouvrir si le besoin s'en fait sentir.

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
    // **Chacune nomme son asset**, et c'est tout ce que l'essai a jamais voulu
    // tenir : le corps dessous, le calque dessus, et pas deux fois la même
    // image. Un seul endroit du produit compose cette adresse
    // (`Apercu.imageAsset`) ; l'essai vérifie l'identité, pas la forme, parce
    // que la forme a déjà changé une fois — le 4 septembre 2026, quand
    // l'adresse d'emplacement s'est révélée fausse pour tout ce qui naît d'un
    // dépliage.
    expect(images[0].getAttribute("src")).toContain("/api/assets/aaaa1111-0/image")
    expect(images[1].getAttribute("src")).toContain("/api/assets/bbbb2222-100/image")
  })

  // ── « Deux images pour une case : laquelle part » (M6, US-504, US-505) ─────
  //
  // **La règle décidait déjà, et personne ne pouvait la voir.** `corps_retenu`
  // — *le favori d'abord, sinon la plus récente* — sert la planche
  // d'équipement, l'export et le calibrage depuis C2. Ce qui manquait tenait
  // à l'écran : la matrice ne disait pas laquelle des deux images gagnait, et
  // n'offrait pas la marque qui en décide. Relevé par l'auteur le 4 septembre
  // 2026, en regardant deux calques d'une même pose.

  /** Une pose « repos » avec deux calques de casque, et le second retenu. */
  const deuxCalques = (corps: Asset, retenu: string) => {
    const chose = avecCorps(corps, [
      calque("bbbb2222-100", corps.identifiant),
      calque("cccc3333-100", corps.identifiant),
    ])
    return {
      ...chose,
      cases: chose.cases.map((c) =>
        c.pose === "repos" ? { ...c, retenus: { casque: retenu } } : c,
      ),
    }
  }

  test("des deux calques d'une case, celui qui part porte la marque", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [deuxCalques(corps, "cccc3333-100")],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    // **Le liseré est sur le retenu, et sur lui seul.** Sans marque, l'écran
    // montrait deux vignettes identiques et laissait deviner.
    const vignettes = ecran.getAllByRole("button", { name: "Ouvrir casque · repos" })
    expect(vignettes).toHaveLength(2)
    const marquees = vignettes.filter((v) => v.className.includes("outline-signal"))
    expect(marquees).toHaveLength(1)
  })

  test("un seul calque ne porte aucune marque — il n'y a pas de question", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [avecCorps(corps, [calque("bbbb2222-100", corps.identifiant)])],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    // **La marque répond à une question ; sans concurrence il n'y en a pas.**
    // Un liseré sur chaque vignette du produit aurait fait un ornement.
    expect(
      ecran
        .getByRole("button", { name: "Ouvrir casque · repos" })
        .className.includes("outline-signal"),
    ).toBe(false)
  })

  test("le coin garde l'image, et c'est le favori qui part au serveur", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [deuxCalques(corps, "cccc3333-100")],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    // Le premier des deux coins : celui du calque qui **ne** part pas.
    fireEvent.click(
      ecran.getAllByRole("button", { name: "Garder casque · repos" })[0],
    )

    // **C'est le favori, et rien d'autre** — la même marque que la galerie, et
    // la seule que le serveur lit pour désigner ce qui part.
    await waitFor(() => {
      const marque = appels.find((a) => a.url === "/api/assets/favorite")
      expect(marque).toBeTruthy()
      expect(marque!.corps).toEqual({
        identifiants: ["bbbb2222-100"],
        favori: true,
      })
    })
  })

  test("les mesures de la rangée sont celles du calque retenu", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const chose = deuxCalques(corps, "cccc3333-100")
    // Deux calques que tout distingue à la lecture : la rangée doit décrire le
    // second, qui est le retenu, et non le premier de la liste.
    const cases = chose.cases.map((c) =>
      c.pose === "repos"
        ? {
            ...c,
            calques: {
              casque: [
                {
                  ...c.calques.casque[0],
                  calque: { ...c.calques.casque[0].calque!, repeint: 0.111 },
                },
                {
                  ...c.calques.casque[1],
                  calque: { ...c.calques.casque[1].calque!, repeint: 0.777 },
                },
              ],
            } as Record<string, Asset[]>,
          }
        : c,
    )
    const { ecran } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [{ ...chose, cases }],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))

    // **Elles décrivaient `calques[0]`** — la plus récente, donc le retenu tant
    // que personne ne marquait de favori. Un favori plus ancien posé, la rangée
    // décrivait un calque et l'export en sortait un autre.
    expect(ecran.getByText(/repeint 77,7 %/)).toBeTruthy()
    expect(ecran.queryByText(/repeint 11,1 %/)).toBeNull()
  })

  test("la carte du calque dit lequel part, et offre de jeter l'autre", async () => {
    const corps = asset("aaaa1111-0", "un nain au repos")
    const { ecran, appels } = await ouvrir({
      emplacements: [TETE],
      pieces: [CASQUE],
      personnages: [deuxCalques(corps, "cccc3333-100")],
    })

    fireEvent.click(ecran.getByRole("button", { name: "casque" }))
    // Le premier des deux : celui qui **ne** part pas.
    fireEvent.click(
      ecran.getAllByRole("button", { name: "Ouvrir casque · repos" })[0],
    )

    // **La phrase dit la réponse avant que les boutons ne proposent le geste** :
    // la question de l'auteur était « lequel part ? », pas « que puis-je faire ».
    expect(ecran.getByText(/un autre calque de cette case part dans le jeu/)).toBeTruthy()

    fireEvent.click(ecran.getByRole("button", { name: "Supprimer cette image" }))
    await waitFor(() =>
      expect(
        appels.find((a) => a.url === "/api/assets/delete"),
      ).toBeTruthy(),
    )

    // **Et le geste qui rend suit l'image**, dans la fente du châssis. Le
    // bandeau *annuler* vit dans la barre d'outils de la galerie, que cet
    // écran-ci ne montre pas : sans cette ligne, on supprimait depuis un
    // endroit d'où l'on ne pouvait pas défaire. Constaté au navigateur le
    // 4 septembre 2026, pas par un essai — d'où celui-ci.
    const rendre = await screen.findByRole("button", { name: "la rendre" })
    fireEvent.click(rendre)
    await waitFor(() =>
      expect(appels.find((a) => a.url === "/api/assets/restore")).toBeTruthy(),
    )
  })

  test("un corps concurrent porte la même marque, et le même clic", async () => {
    const premier = asset("aaaa1111-0", "un nain au repos")
    const second = asset("aaaa1111-1", "un nain au repos, encore")
    const chose = avecCorps(premier)
    const { ecran, appels } = await ouvrir({
      personnages: [
        {
          ...chose,
          cases: chose.cases.map((c) =>
            c.pose === "repos"
              ? { ...c, images: [premier, second], corps: second.identifiant }
              : c,
          ),
        },
      ],
    })

    // **« Et en vrai c'est pareil pour les poses de base »** — la remarque le
    // disait, et le serveur le faisait déjà : seul l'écran manquait.
    const vignettes = ecran.getAllByRole("button", {
      name: /Ouvrir un nain au repos/,
    })
    expect(
      vignettes.filter((v) => v.querySelector("img.outline-signal")),
    ).toHaveLength(1)

    fireEvent.click(ecran.getByRole("button", { name: "Garder un nain au repos" }))
    await waitFor(() => {
      const marque = appels.find((a) => a.url === "/api/assets/favorite")
      expect((marque?.corps as { identifiants: string[] }).identifiants).toEqual([
        "aaaa1111-0",
      ])
    })
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
            retenus: (() => {
              const sien = { repos: doux, marche: pire, course: fait }[
                p.identifiant
              ]
              return (sien ? { casque: sien.identifiant } : {}) as Record<
                string,
                string
              >
            })(),
            directions: [],
            directions_rangees: [],
            sans_direction: [],
            bandes: [],
            bandes_ecartees: [],
            bandes_demandees: 1,
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

  // ── La sortie vers le jeu ───────────────────────────────────────────────
  //
  // ⚠️ **Elle n'est plus sur la fiche du sujet** (`RP17`, 16 septembre 2026).
  // Le bouton *Poser dans le dossier du jeu* écrivait tout de suite, sans dire
  // quels fichiers partaient ni lesquels il écrasait, à côté d'un écran qui,
  // lui, le montre. Les trois essais qui le tenaient sont partis avec lui : ce
  // que la fiche porte maintenant est *Livrer…*, qui ouvre la sortie, et c'est
  // `Sortie.test.tsx` qui l'éprouve — le choix du sujet compris.

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

  const onglet = (nom: string) => leLieu(nom)
  const allume = (nom: string) => ouverture(nom) === "true"

  // ── « Trois onglets, et un seul allumé à la fois ; aucun écran ne se
  //     superpose à un autre » ────────────────────────────────────────────────

  test("les trois anciennes racines se traduisent vers les portes de l'atelier", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // Ce qui porte encore le rôle `tab` est un bandeau *dans* un écran — les
    // côtés de l'univers, les quatre volets de la page d'un sujet —, et aucun
    // d'eux n'est monté sur la galerie au repos.
    expect(screen.queryAllByRole("tab")).toHaveLength(0)
    for (const nom of ["Univers", "Créer", "Galerie"])
      expect(leLieu(nom).closest("[data-navigation-atelier]")).toBeTruthy()

    // La galerie est la racine de repos : c'est l'écran qu'on regardait déjà en
    // arrivant, et un produit ne change pas d'accueil pour se réorganiser.
    expect(allume("Galerie")).toBe(true)
    expect(allume("Univers")).toBe(false)
    expect(allume("Créer")).toBe(false)
  })

  test("allumer un onglet éteint le précédent, et rien ne se rend par-dessus", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // La preuve du non-recouvrement se prend sur ce que chaque onglet est seul
    // à avoir. Tant qu'ils se rendaient les uns **derrière** les autres, tout
    // restait dans le document — et c'est exactement ce que sept surfaces
    // empilées voulaient dire.
    expect(await screen.findByLabelText(CHAMP_DE_RECHERCHE)).toBeTruthy()

    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(allume("Univers")).toBe(true)
    expect(allume("Galerie")).toBe(false)
    expect(screen.queryByLabelText(CHAMP_DE_RECHERCHE)).toBeNull()

    fireEvent.click(onglet("Créer"))
    await waitFor(() => expect(allume("Créer")).toBe(true))
    expect(allume("Univers")).toBe(false)
    // Un seul cadre en profondeur est monté à la fois, jamais deux empilés :
    // celui de l'univers est parti avec son onglet.
    expect(document.querySelector("[data-univers]")).toBeNull()
    // **Le guichet qui paie s'ouvre d'ici, et de nulle part ailleurs** (E2).
    // La barre permanente a laissé la place à une porte nommée ; ce qui n'a
    // pas changé est qu'il n'y a qu'un endroit d'où l'argent part.
    expect(
      await screen.findByRole("button", { name: "Préparer une image" }),
    ).toBeTruthy()

    fireEvent.click(onglet("Galerie"))
    expect(await screen.findByLabelText(CHAMP_DE_RECHERCHE)).toBeTruthy()
    expect(document.querySelector("[data-univers]")).toBeNull()
    // **La porte qui paie disparaît de tout écran incapable de dépenser.** La
    // galerie juge, elle ne paie jamais.
    expect(screen.queryByRole("button", { name: "Préparer une image" })).toBeNull()
  })

  // ── « Descendre dans une chose du jeu remplace le nom de l'onglet par un
  //     fil, et chaque segment du fil ramène à son étage » ────────────────────

  test("descendre pose un fil d'Ariane, et chaque segment ramène à son étage", async () => {
    const planche = asset("aaaa1111-0", "tonneau-cerclé-02")
    const { fetchDouble } = serveurDouble({ assets: [planche] })
    await monter(fetchDouble, { ...ETAT, assets: [planche] })

    // **Au repos, le fil dit déjà où l'on est** (18 septembre 2026) : le jeu,
    // puis la galerie, qui est l'étage courant et ne ramène nulle part.
    expect(dernierEtageDuFil()).toBe("Galerie")

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "La retoucher" }))

    const fil = within(await screen.findByRole("navigation", { name: "Où l'on est" }))
    // Quatre segments : le jeu, l'onglet, l'image, l'écran. C'est la forme
    // courte — celle d'une image atteinte par la galerie, qui n'appartient pas
    // forcément à une chose du jeu et n'a traversé aucune famille.
    //
    // **Le dernier segment est *La retouche* et non la table ouverte** (`B25`) :
    // les trois genres de lieu de cet écran n'en font plus qu'un, et la table
    // est un état de l'écran, pas une profondeur de la pile.
    expect(fil.getByText("Bac à sable")).toBeTruthy()
    expect(fil.getByText("Galerie")).toBeTruthy()
    expect(fil.getByText("tonneau-cerclé-02")).toBeTruthy()
    expect(fil.getByText("La retouche")).toBeTruthy()

    // **Le dernier segment ne ramène nulle part** : c'est l'étage où l'on est,
    // et c'est ce qui le rend lisible comme la fin du fil.
    expect(fil.queryByRole("button", { name: "La retouche" })).toBeNull()
    expect(fil.getByText("La retouche").getAttribute("aria-current")).toBe("page")

    // Les autres ramènent. Celui de la galerie remonte d'un étage, et le fil
    // redevient celui du repos.
    fireEvent.click(fil.getByRole("button", { name: "Galerie" }))
    expect(await screen.findByLabelText(CHAMP_DE_RECHERCHE)).toBeTruthy()
    expect(dernierEtageDuFil()).toBe("Galerie")
  })

  test("changer d'onglet remonte de toute profondeur", async () => {
    const planche = asset("aaaa1111-0", "tonneau-cerclé-02")
    const { fetchDouble } = serveurDouble({ assets: [planche] })
    await monter(fetchDouble, { ...ETAT, assets: [planche] })

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "La retoucher" }))
    await screen.findByRole("navigation", { name: "Où l'on est" })

    // Cliquer un onglet est le geste qui dit « ailleurs ». Laisser la découpe
    // ouverte derrière rendrait le produit à ce qu'il vient de quitter — un
    // écran par-dessus un autre, ce que la tranche supprime.
    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(dernierEtageDuFil()).toBe("Univers & toile")

    fireEvent.click(onglet("Galerie"))
    expect(await screen.findByLabelText(CHAMP_DE_RECHERCHE)).toBeTruthy()
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

    fireEvent.click((await screen.findAllByRole("button", { name: "Ouvrir le résultat" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "La retoucher" }))
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

    // **La colonne du carnet est devenue la navigation de l'atelier** : elle
    // ne se replie plus depuis l'en-tête de la surface — elle a sa propre
    // poignée dans la barre de gauche —, et la galerie n'annonce donc plus de
    // bascule. Ce que l'essai garde est la règle qui a fait naître les
    // bascules nommées : jamais un mot unique pour quatre écrans.
    expect(screen.getByRole("navigation", { name: "Atelier" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "arbre" })).toBeNull()
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
    fireEvent.click(onglet("Créer"))
    await waitFor(() => expect(allume("Créer")).toBe(true))
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
    // Le groupe est devenu vertical avec la barre : le trait qui le sépare du
    // travail est au-dessus de lui, et plus à sa gauche. Il porte son nom, ce
    // qui est la garantie — on sait que ces deux-là ne sont pas du travail.
    const groupe = reglages.parentElement as HTMLElement
    expect(groupe.contains(guide)).toBe(true)
    expect(groupe.getAttribute("aria-label")).toBe("Préférences")
    expect(groupe.className).toContain("border-t")

    // Et rien de ce qui touche au travail n'est dedans : les trois racines
    // vivent dans le carnet, et plus dans la bande (`C9`).
    for (const nom of ["Univers", "Créer", "Galerie"])
      expect(groupe.contains(leLieu(nom))).toBe(false)
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

  test("l'en-tête de la surface fait 34, et les rangs de la navigation aussi", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    const classes = (e: Element) => e.className
    // **34 et plus 44** (`C9`) : la bande ne porte plus les trois onglets, donc
    // plus rien qui demande la hauteur d'un contrôle plein. 44 n'était d'ailleurs
    // dans aucune des listes fermées de `docs/DESIGN.md` § Spacing.
    expect(classes(document.querySelector("header") as Element)).toContain("h-[34px]")
    // **Les portes ont quitté la bande pour la colonne** : ce ne sont plus les
    // rangs couchés de 30 px du carnet, ce sont des rangs de navigation, à la
    // hauteur d'un contrôle plein — 34, la même que l'en-tête. Réglages et
    // Guide portent exactement le même rang : ils sont séparés par un trait et
    // un nom, jamais par une taille moindre.
    expect(classes(leLieu("Galerie"))).toContain("min-h-[34px]")
    expect(classes(screen.getByRole("button", { name: "Réglages" }))).toContain(
      "min-h-[34px]",
    )
    // Et l'en-tête de la surface n'a plus de bascule à replier sur la galerie.
    expect(screen.queryByRole("button", { name: "arbre" })).toBeNull()

    // Le champ de saisie est une zone de saisie sur plusieurs lignes et non une
    // bande : il part du rang plein et grandit avec ses cinq lignes.
    const champ = await champDePrompt()
    expect(classes(champ)).toContain("min-h-[34px]")
    expect((champ as HTMLTextAreaElement).rows).toBe(5)
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

  const ouvrir = async (
    reste: Partial<Parameters<typeof serveurDouble>[0]> = {},
  ) => {
    const double = serveurDouble({ depenses: DEPENSES, ...reste })
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
    expect(await ecran.findByText("2 générations d'affilée sur ce sujet")).toBeTruthy()
    expect(ecran.getByText(/5 min · \$0,0320/)).toBeTruthy()
  })

  // ── « La liste n'est pas une grille d'assets : ni recherche, ni filtres, ni
  //     sélection multiple » ────────────────────────────────────────────────────

  test("la liste ne porte aucune vignette et aucune sélection multiple", async () => {
    const { ecran } = await ouvrir()

    // **C'est l'absence de vignette qui tient la règle**, pas l'absence de
    // filtre : une vignette par ligne ferait de cet écran une seconde galerie,
    // et la galerie fait déjà ça mieux. Les filtres, eux, portent sur des
    // appels et non sur des images (A-24 de `docs/archive/v21-arbitrages.md`).
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
      ouverture("Galerie"),
    ).toBe("true")
  })

  test("le fil ramène d'où l'on vient, et l'onglet ne change pas", async () => {
    await ouvrir()

    // L'écran est une profondeur, pas un quatrième onglet : les trois restent
    // là, et celui d'où l'on vient reste allumé.
    expect(
      ouverture("Galerie"),
    ).toBe("true")

    const fil = within(screen.getByRole("navigation", { name: "Où l'on est" }))
    fireEvent.click(fil.getByRole("button", { name: "Bac à sable" }))
    expect(await champDePrompt())
      .toBeTruthy()
  })

  // ── « Un clip payé chez le fournisseur mais jamais rapatrié se voit, et se
  //     récupère sans repayer » (B2) ──────────────────────────────────────────

  describe("les clips payés qui attendent", () => {
    // **En souffrance** veut dire : le travail est connu, l'emplacement n'a
    // pas abouti — c'est `Statut.ECHOUEE` ici, comme un téléchargement qui a
    // manqué pendant que l'atelier était fermé.
    const base = clipRendu("clip-attend", false, {
      personnage: "balthazar",
      pose: "marche",
      cout_usd: 0.067,
      consomme: 0.067,
    })
    const EN_SOUFFRANCE: Generation = {
      ...base,
      emplacements: [{ ...base.emplacements[0], statut: "echouee" }],
    }

    // **Le bandeau se cherche à chaque fois par sa marque `data-*`, jamais
    // sur le `ecran` rendu par `ouvrir()`.** Ouvrir les dépenses déclenche un
    // second rendu de `EcranDepenses` pendant que ses données arrivent, et le
    // `cadre` capturé au tout début reste attaché à l'instantané d'avant : les
    // libellés statiques de la colonne de gauche s'y lisent encore, mais un
    // bloc qui n'existe qu'une fois les clips en souffrance reçus n'y paraît
    // jamais. C'est le bandeau lui-même qu'on interroge, pas l'écran d'origine.
    const bandeau = () =>
      within(document.querySelector("[data-clips-en-souffrance]") as HTMLElement)

    test("s'il n'y en a aucun, aucun bandeau ne s'affiche", async () => {
      await ouvrir()
      expect(document.querySelector("[data-clips-en-souffrance]")).toBeNull()
    })

    test("un clip en souffrance se voit, avec son montant", async () => {
      await ouvrir({ clipsEnSouffrance: [EN_SOUFFRANCE] })
      await waitFor(() =>
        expect(document.querySelector("[data-clips-en-souffrance]")).toBeTruthy(),
      )
      // La phrase traverse un `<strong>` : `getByText` ne concatène que le
      // texte propre d'un nœud, jamais celui de ses enfants — on vérifie donc
      // le compte et la phrase séparément, de part et d'autre de la balise.
      expect(bandeau().getByText("1 clip payé")).toBeTruthy()
      expect(bandeau().getByText(/attend d'être récupéré/)).toBeTruthy()
      expect(bandeau().getByText(/\$0,0670/)).toBeTruthy()
      expect(bandeau().getByText(/balthazar/)).toBeTruthy()
    })

    test("récupérer ne repaie pas, et retire le clip du bandeau", async () => {
      const { appels } = await ouvrir({ clipsEnSouffrance: [EN_SOUFFRANCE] })
      await waitFor(() =>
        expect(document.querySelector("[data-clips-en-souffrance]")).toBeTruthy(),
      )

      fireEvent.click(bandeau().getByRole("button", { name: "Récupérer sans repayer" }))

      await waitFor(() =>
        expect(document.querySelector("[data-clips-en-souffrance]")).toBeNull(),
      )
      // Un seul appel de récupération, et rien d'autre écrit : aucune dépense
      // n'est jamais commandée depuis ce geste.
      expect(
        appels.some((a) => a.url === "/api/clips/clip-attend/recover"),
      ).toBe(true)
      expect(appels.some((a) => a.url === "/api/clips" && Boolean(a.corps))).toBe(
        false,
      )
    })

    test("le fournisseur a expiré le lien : la raison se lit, rien n'est facturé", async () => {
      const { appels } = await ouvrir({
        clipsEnSouffrance: [EN_SOUFFRANCE],
        recuperationEchouee: { "clip-attend": "le lien a expiré chez le fournisseur" },
      })
      await waitFor(() =>
        expect(document.querySelector("[data-clips-en-souffrance]")).toBeTruthy(),
      )

      fireEvent.click(bandeau().getByRole("button", { name: "Récupérer sans repayer" }))

      expect(
        await bandeau().findByText("le lien a expiré chez le fournisseur"),
      ).toBeTruthy()
      // Le clip reste annoncé, et le geste reste proposable — sous un nom qui
      // dit que c'est une seconde tentative, pas la même offre qu'avant.
      expect(bandeau().getByText(/balthazar/)).toBeTruthy()
      expect(bandeau().getByRole("button", { name: "Réessayer" })).toBeTruthy()
      // Rien n'est facturé : un seul appel de récupération est parti, et
      // aucune commande neuve n'a été envoyée derrière l'échec.
      expect(
        appels.filter((a) => a.url === "/api/clips/clip-attend/recover"),
      ).toHaveLength(1)
      expect(appels.some((a) => a.url === "/api/clips" && Boolean(a.corps))).toBe(
        false,
      )
    })
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

  const cote = (nom: string) => leLieu(nom)
  const survoler = (element: Element) => fireEvent.pointerOver(element)
  const espace = () => fireEvent.keyDown(window, { key: " ", code: "Space" })

  const ouvrir = async (options: Parameters<typeof serveurDouble>[0] = {}) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble)
    allerA("Univers")
    await screen.findByRole("tab", { name: "Inspiration" })
    return { ...double, flux }
  }

  // ── « Un seul côté allumé, et il occupe tout l'écran sous une barre de
  //     38 px » ────────────────────────────────────────────────────────────────
  //
  // **Ils étaient trois, ils sont deux depuis `C2`** : le côté *Réglages* était
  // `Assistant.tsx`, doublon vrai du parcours des règles du jeu, et il est
  // parti avec lui.

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

  // ── « Les deux côtés qui portent une liste emploient la colonne de 240 px » ─

  // ── « Un seul côté allumé, et il occupe tout l'écran sous une barre de
  //     38 px » ────────────────────────────────────────────────────────────────
  //
  // **Ils étaient trois, ils sont deux depuis `C2`** : le côté *Réglages* était
  // `Assistant.tsx`, doublon vrai du parcours des règles du jeu, et il est
  // parti avec lui.

  test("deux côtés, un seul allumé, sous une seule barre de 34 px", async () => {
    await ouvrir()

    expect(
      screen
        .getByRole("tablist", { name: "Les deux côtés de l'univers" })
        .textContent,
    ).toBe("InspirationAmbiances et couleurs")

    // Inspiration est le côté de repos : on regarde des images avant de régler.
    expect(cote("Inspiration").getAttribute("aria-selected")).toBe("true")
    expect(cote("Ambiances et couleurs").getAttribute("aria-selected")).toBe("false")

    // **Une seule bande au-dessus du travail.** Elle fait 34 px depuis `D2` —
    // la hauteur de contrôle du carnet, celle de toute barre d'outils du
    // produit ; la barre du châssis sombre qui la surmontait est partie en
    // `C9`. On remonte jusqu'à la bande qui la porte, en lisant la classe
    // plutôt qu'en écrivant un sélecteur : les crochets de Tailwind doivent
    // être échappés en CSS, et cet échappement-là s'est déjà perdu une fois.
    let barre: HTMLElement | null = cote("Inspiration")
    while (barre && !barre.className.includes("h-[34px]")) barre = barre.parentElement
    expect(barre).toBeTruthy()

    fireEvent.click(cote("Ambiances et couleurs"))
    await waitFor(() =>
      expect(cote("Ambiances et couleurs").getAttribute("aria-selected")).toBe("true"),
    )
    expect(cote("Inspiration").getAttribute("aria-selected")).toBe("false")
    // Le côté allumé prend tout l'écran : le tableau n'est plus là.
    expect(screen.queryByText("Le tableau est vide.")).toBeNull()
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
    /** Le cadre que le flux annonce. Il ne sert qu'aux essais qui regardent ce
     *  que le jeu **avait déjà** posé — promouvoir un détourage renvoie le
     *  dossier entier, et un dossier vide ne prouverait pas qu'il le renvoie. */
    etat: Etat = ETAT,
  ) => {
    const double = serveurDouble({ personnages: [AVEC_IMAGE(images)], ...options })
    await monter(double.fetchDouble, etat)
    await ouvrirLEtabli("Le nain")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${images[0].label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  // ⚠️ **Nom exact, pas un préfixe.** Depuis que la fabrique de découpe
  // s'appelle « Découper une image », un préfixe seul confondrait cette
  // fabrique-là avec la place « Découper » de la barre.
  const puce = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre.getByRole("button", { name: new RegExp(`^${nomDeLaTable(nom)}$`) })

  // ── M7 · Promouvoir un détourage en défaut du jeu ─────────────────────────
  //
  // **Le geste inverse de l'étape des réglages du jeu.** Celle-ci demande de
  // choisir un détourage de départ **avant d'avoir fabriqué la moindre image**,
  // alors qu'on ne sait ce qui convient qu'après en avoir vu quelques-unes. Ici
  // on règle, on regarde le résultat, et l'on dit *garde ça* — l'étape devient
  // la relecture de ce qu'on a promu.

  /** Une image qui porte déjà un détourage : sans passe, il n'y a rien à
   *  promouvoir, et le geste ne se propose pas. */
  const PASSE_POSEE = {
    moteur: "modele" as const,
    tolerance: 28,
    seuil_alpha: 128,
    durcissement: 2,
    point: null,
    portee: "tache" as const,
    masquee: false,
    trace: [],
    modele: "",
  }

  const imageDetouree = (label = "le nain, au repos") => {
    const image = asset("bbbb2222-0", label)
    return { ...image, recette: { ...image.recette, passes: [PASSE_POSEE] } }
  }

  test("le détourage d'une image se promeut en défaut, et la portée se choisit", async () => {
    const { cadre, appels } = await ouvrirUneTable(
      {
        impose: {
          impose: null,
          echelle: "personnage",
          nature: "image",
          detourage: {
            passe: PASSE_POSEE,
            origine: "produit",
            famille: "personnages",
          },
        },
      },
      [imageDetouree()],
    )

    fireEvent.click(
      await cadre.findByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    )

    // **Les deux portées que le produit connaît, nommées par ce qu'elles
    // couvrent** — et aucune supposée : promouvoir dans la mauvaise se voit à
    // la dixième image, pas à la première.
    expect(cadre.getByRole("button", { name: /pour une image seule/ })).toBeTruthy()
    const parFamille = cadre.getByRole("button", {
      name: /pour tout ce que tu ranges dans personnages/,
    })

    // **Et ce que le geste ne fait pas est écrit avant de le faire.**
    expect(cadre.getByText(/aucune image déjà faite n'est retouchée/)).toBeTruthy()

    fireEvent.click(parFamille)

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      expect(pose).toBeTruthy()
      const envoyees = (pose!.corps as Record<string, Record<string, unknown>>)
        .detourages
      // Le point visé et le tracé ne partent pas : un défaut n'a pas d'image où
      // viser, et c'est le domaine qui le décide.
      expect(envoyees.personnages).toEqual({
        moteur: "modele",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 2,
        modele: "",
      })
    })

    // **Le geste dit où relire son effet** : il vit dans un autre écran, et un
    // geste dont l'effet est ailleurs doit nommer cet ailleurs.
    expect(
      await cadre.findByText(/Le détourage de départ/),
    ).toBeTruthy()
  })

  test("promouvoir par nature écrit la nature, pas la famille", async () => {
    const { cadre, appels } = await ouvrirUneTable({}, [imageDetouree()])

    fireEvent.click(
      await cadre.findByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    )
    fireEvent.click(cadre.getByRole("button", { name: /pour une image seule/ }))

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      expect((pose!.corps as Record<string, unknown>).detourage_image).toEqual({
        moteur: "modele",
        tolerance: 28,
        seuil_alpha: 128,
        durcissement: 2,
        modele: "",
      })
    })
  })

  test("sans famille, la portée par famille n'est pas proposée", async () => {
    // **Pas un bouton grisé** : une image dont le barème du jeu ne nommait pas
    // la famille n'a pas de famille où promouvoir, et un grisé demanderait de
    // comprendre pourquoi. Le double rend une image sans famille, comme le
    // serveur le fait pour un texte écrit à la main.
    const { cadre } = await ouvrirUneTable({}, [imageDetouree()])

    fireEvent.click(
      await cadre.findByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    )

    expect(cadre.queryByRole("button", { name: /pour tout ce que tu ranges/ })).toBeNull()
    expect(cadre.getByText(/cette image n'a pas de famille/)).toBeTruthy()
  })

  test("sans détourage posé, il n'y a rien à promouvoir", async () => {
    // Le geste ne se propose pas plutôt que de proposer de promouvoir le vide :
    // « pas de contrôle » vaut mieux qu'un contrôle qui ne fait rien.
    const { cadre } = await ouvrirUneTable()

    await cadre.findByRole("button", { name: "Une passe de plus" })
    expect(
      cadre.queryByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    ).toBeNull()
  })

  test("promouvoir pour une famille ne perd pas les familles déjà réglées", async () => {
    // ⚠️ **Le serveur lit ce champ comme la liste complète des familles
    // réglées.** N'envoyer que celle qu'on vient de poser effacerait les
    // autres, sans un mot, et le jeu perdrait un réglage à chaque promotion.
    // C'est la convention des modèles par famille, et elle vaut ici.
    const deja = {
      moteur: "bord" as const,
      tolerance: 40,
      seuil_alpha: 90,
      durcissement: 0,
      point: null,
      portee: "tache" as const,
      masquee: false,
      trace: [],
      modele: "",
    }
    const { cadre, appels } = await ouvrirUneTable(
      {
        impose: {
          impose: null,
          echelle: "personnage",
          nature: "image",
          detourage: {
            passe: PASSE_POSEE,
            origine: "produit",
            famille: "personnages",
          },
        },
      },
      [imageDetouree()],
      { ...ETAT, univers: { ...UNIVERS, detourages: { objets: deja } } },
    )

    fireEvent.click(
      await cadre.findByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    )
    fireEvent.click(
      cadre.getByRole("button", { name: /pour tout ce que tu ranges dans personnages/ }),
    )

    await waitFor(() => {
      const pose = appels.filter((a) => a.url === "/api/universe").at(-1)
      const envoyees = (pose!.corps as Record<string, Record<string, unknown>>)
        .detourages
      expect(Object.keys(envoyees).sort()).toEqual(["objets", "personnages"])
      // Celle d'avant repart telle quelle, réduite à ce qu'un défaut retient.
      expect(envoyees.objets).toEqual({
        moteur: "bord",
        tolerance: 40,
        seuil_alpha: 90,
        durcissement: 0,
        modele: "",
      })
    })
  })

  test("promouvoir ne fait partir aucun appel au fournisseur", async () => {
    const { cadre, appels } = await ouvrirUneTable({}, [imageDetouree()])

    fireEvent.click(
      await cadre.findByRole("button", {
        name: /enregistrer ce réglage comme défaut du jeu/,
      }),
    )
    fireEvent.click(cadre.getByRole("button", { name: /pour une image seule/ }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/universe" && a.corps)).toBe(true),
    )
    expect(appels.filter((a) => a.url === "/api/generations")).toEqual([])
  })

  // ── « La barre montre les huit places dans l'ordre où elles s'appliquent, et
  //     l'ordre ne se change pas » et « le trait sépare les huit places des deux
  //     fabriques » ───────────────────────────────────────────────────────────

  test("les huit places sont dans l'ordre du traitement, puis les deux fabriques", async () => {
    await ouvrirUneTable()

    // L'ordre est celui du domaine. Le lire autrement serait mentir sur ce que
    // l'image a subi.
    // ⚠️ **Scopé à la barre des tables elle-même** (`data-barre-des-tables`) :
    // depuis que la fabrique de découpe s'appelle « Découper une image »,
    // `cadre.getAllByRole` verrait aussi ce bouton-là, et « Découper » — la
    // place de la barre — s'y confondrait par préfixe.
    const barreDesTables = document.querySelector("[data-barre-des-tables]")
    if (!barreDesTables) throw new Error("la barre des tables ne s'est pas ouverte")
    const barre = within(barreDesTables as HTMLElement)
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
    const rangs = [
      "détourage",
      "recadrage",
      "grille",
      "quantification",
      "bords",
      "contours",
      // **En queue et avant la main** (B1) : le plan a tranché pour la fin de
      // la chaîne, et le domaine déclare la place au même rang.
      "retournement",
      "la main",
      "découpage",
      "superposition",
      // Les clés du domaine, traduites une fois au vocabulaire des planches
      // (`B25`) : c'est l'ordre qu'on mesure, pas les mots.
    ].map((nom) => barre.findIndex((t) => t.startsWith(nomDeLaTable(nom))))
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
    expect(
      cadre.getByRole("button", { name: "Adapter" }).getAttribute("aria-pressed"),
    ).toBe("true")

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

    // **L'image porte le zoom, et elle seule** : tout ce qui se rend au milieu
    // suit le même facteur — l'image seule, les deux côte à côte, la surface
    // qui se peint —, donc aucune de ces trois surfaces n'a son propre calcul.
    // **L'image de la scène, et non la vignette d'une sœur** : les deux portent
    // le même libellé, et seule la première porte le grossissement.
    const image = () =>
      document.querySelector(
        "[data-scene-de-retouche] img",
      ) as HTMLImageElement

    fireEvent.click(cadre.getByRole("button", { name: "100 %" }))
    expect(image().getAttribute("width")).toBe("1024")
    expect(image().getAttribute("height")).toBe("1024")

    // Le pour cent s'écrit à la main, et il agit.
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "37" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    await waitFor(() => expect(image().getAttribute("width")).toBe("379"))
  })

  test("un pour cent hors bornes est ramené, jamais refusé", async () => {
    // **Ramener plutôt que refuser.** Un champ qui rejette une frappe oblige à
    // deviner ce qu'il accepte ; un champ qui ramène le dit en affichant la
    // valeur retenue.
    const { cadre } = await ouvrirUneTable()
    const champ = cadre.getByLabelText(
      "Pour cent d'agrandissement",
    ) as HTMLInputElement

    // **Le plafond est monté à 1 600 %** avec la chaîne redessinée : on y
    // compte des pixels à la main, et 250 % n'y suffisait pas. Ce que l'essai
    // mesure est le geste, pas le chiffre — au-delà du plafond, la valeur
    // retenue s'affiche.
    fireEvent.change(champ, { target: { value: "9000" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    expect(champ.value).toBe("1600")

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

  // ⚠️ **Le PNG de l'état courant est parti avec l'ancien écran** (`B25`). Sa
  // bande portait un lien *PNG ↓* qui téléchargeait ce qu'on regardait — le
  // rendu, ou le brut quand on travaillait dessus. La chaîne redessinée n'en a
  // pas, et la tuile de la galerie redevient le seul endroit d'où l'on
  // télécharge. Noté dans `docs/PLAN-carnet.md` § `B27`.

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

    // Le recadrage n'a pas de valeur à montrer : pastille creuse.
    expect(puce(cadre, "recadrage").getAttribute("data-etat")).toBe("vide")
    // Les bords en ont une : pastille pleine, et la valeur se lit sous le nom
    // de la table une fois qu'on l'ouvre (`B25`).
    expect(puce(cadre, "bords").getAttribute("data-etat")).toBe("posee")
    fireEvent.click(puce(cadre, "bords"))
    expect(await cadre.findByText(/tache 4 px/)).toBeTruthy()
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
    // **La pile des calques a son panneau à elle** dans la chaîne redessinée
    // (`B25`) ; la table de la main porte ses réglages de peinture. Ce que cet
    // essai mesure n'a pas bougé : la table s'ouvre sur des réglages, jamais
    // sur une raison de refus.
    expect(await cadre.findByText("le sens")).toBeTruthy()
    expect(cadre.getByText("le pinceau")).toBeTruthy()
    expect(cadre.queryByText(/entièrement opaque/)).toBeNull()
    // Et la pile, elle, est à un clic — dans le panneau qui la porte.
    fireEvent.click(cadre.getByRole("button", { name: "Calques" }))
    expect(await cadre.findByText("les calques")).toBeTruthy()
  })

  test("une fabrique n'a pas de carré, et les deux s'ouvrent en plein cadre", async () => {
    const { cadre } = await ouvrirUneTable()

    // **Les deux gestes de droite n'ont pas de pastille** : ils ne posent rien
    // sur l'image courante, ils en fabriquent d'autres.
    expect(puce(cadre, "découpage").querySelector("[data-pastille]")).toBeNull()
    expect(puce(cadre, "superposition").querySelector("[data-pastille]")).toBeNull()

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
    // ⚠️ **Les deux étiquettes « sur » et « témoin » ne sont pas écrites**
    // dans la chaîne redessinée (`B25`) : ce sont deux groupes de boutons
    // voisins, et chacun porte sa valeur allumée.
    expect(document.querySelector("[data-travail]")).toBeTruthy()
    expect(document.querySelector("[data-temoin]")).toBeTruthy()
    for (const nom of ["Brut", "Rendu", "Aucun", "À côté", "Par-dessus"]) {
      expect(cadre.getByRole("button", { name: nom }), nom).toBeTruthy()
    }

    // Au repos, rien n'est écrit : c'est le rendu, et le dire serait du bruit.
    expect(cadre.queryByText(/on travaille sur le brut/)).toBeNull()

    // **Le seul état durable qui change ce qu'un outil touche** se dit en
    // ambre. Le témoin, lui, ne se redit pas : son contrôle porte déjà sa
    // valeur, et la répéter serait du bruit.
    fireEvent.click(cadre.getByRole("button", { name: "Brut" }))
    expect(await cadre.findByText("on travaille sur le brut")).toBeTruthy()

    fireEvent.click(cadre.getByRole("button", { name: "À côté" }))
    expect(cadre.queryByText(/on regarde/)).toBeNull()

    // Et revenir au rendu fait taire la phrase : un état durable qu'on oublie
    // est le danger ; le dire est ce qui autorise à le rendre durable.
    fireEvent.click(cadre.getByRole("button", { name: "Rendu" }))
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

    for (const temoin of ["À côté", "Par-dessus"]) {
      fireEvent.click(cadre.getByRole("button", { name: temoin }))
      await waitFor(() => expect(surface(), temoin).toBeTruthy())
    }

    // **Le témoin par-dessus est un calque de lecture** : le curseur le
    // traverse, et le geste tombe sur l'image de travail. Une image posée
    // par-dessus qui intercepte les clics serait le défaut d'hier déguisé.
    //
    // On le mesure sur une table sans surface — quand une surface est posée,
    // c'est elle qui prend la place de l'image, et le calque n'a plus d'image à
    // doubler.
    fireEvent.click(puce(cadre, "bords"))
    const dessus = await cadre.findByAltText(/témoin/)
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
    expect(await cadre.findByText("taille de case")).toBeTruthy()

    // On change d'image dans la colonne des sœurs…
    fireEvent.click(cadre.getByRole("button", { name: "le nain, de dos" }))
    // …et la table est toujours celle qu'on avait ouverte. C'est le geste qui
    // distingue une table d'un panneau : on règle la même place sur six images.
    expect(await cadre.findByText("taille de case")).toBeTruthy()
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
    // ⚠️ **Le pied de colonne qui vide une seule place est parti avec l'ancien
    // écran** (`B25`) : *Sans bords ›*, et ses huit sœurs. Endormir une place
    // existe dans la chaîne redessinée — son interrupteur —, la **vider** n'y
    // existe nulle part, et les deux gestes ne sont pas le même. Noté dans
    // `docs/PLAN-carnet.md` § `B27`.
    await cadre.findByText("tache minimale")

    // Vider la recette entière, elle, est toujours là : au pied de la colonne.
    // **Elle passe par le brouillon depuis `B24`** — le geste vide la recette
    // et demande l'aperçu de l'image nue, et c'est *Enregistrer* qui écrit ;
    // elle appelait `/reset` directement quand chaque geste s'enregistrait. Ce
    // que l'essai tient est plus fort qu'avant : la recette qui part est vide,
    // et le geste se déclare comme une remise à zéro.
    fireEvent.click(cadre.getByRole("button", { name: "Tout remettre à zéro" }))
    await waitFor(() => {
      const vidange = appels.filter((a) => a.url.includes("/recipe")).pop()
      expect((vidange?.corps as { reinitialiser?: boolean })?.reinitialiser).toBe(true)
      expect(derniereRecetteEnvoyee(appels)).toEqual(RECETTE_VIDE)
    })
  })

  // ── « La quantification atteint les couleurs déduites d'une image et le
  //     tramage, tous deux déjà portés par le modèle » ─────────────────────────

  test("la quantification atteint enfin les couleurs de l'image et le tramage", async () => {
    // Le double annonce « aucune palette » dans son état de départ, ce qui rend
    // la table indisponible : on lui donne un traitement qui marche, puisque
    // c'est la table qu'on regarde et non son grisé.
    const { cadre, appels } = await monterAvecQuantification()

    fireEvent.click(puce(cadre, "quantification"))
    // ✅ **Le choix de la source des couleurs — *la palette du jeu* ou
    // *l'image* — est rattrapé** (`B26`, 9 septembre 2026). Il avait quitté
    // l'écran avec l'ancien châssis en `B25` : une palette vide veut dire
    // « déduite de l'image elle-même » côté domaine, l'écran neuf lisait déjà
    // ce fait — c'est lui qui grise l'algorithme — et aucun poste ne le
    // **posait**. `ReglagesDesCouleurs` (`Retouche.tsx`) porte maintenant
    // *couleurs de — le jeu / l'image*, et pose `palette: []` sur *l'image*
    // comme `PanneauQuantification` le faisait. L'essai est dans
    // `Retouche.test.tsx`.
    //
    // Le tramage, lui, est là : sans lui un dégradé réduit à seize couleurs se
    // pose en bandes.
    fireEvent.click(await cadre.findByRole("button", { name: "diffusion" }))
    await waitFor(() => {
      expect(derniereRecetteEnvoyee(appels)!.quantification!.tramage).toBe("floyd")
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
    // ⚠️ **Zéro, pas trois** (B16). Cet essai figeait un défaut : le panneau
    // lisait `?? 3` pour une place *non posée*, donc il annonçait deux taches
    // effacées pendant que l'image n'avait pas bougé d'un pixel et que le carré
    // de la barre restait creux. Le domaine dit zéro (`Bords.aire_min = 0`), et
    // `PanneauContours` lisait déjà zéro pour la même absence. *Un chiffre
    // affiché est un chiffre compté* : rien de posé, rien d'effacé.
    expect(
      await cadre.findByText("zéro n'efface rien — 3 taches détachées sur cette image"),
    ).toBeTruthy()
    // ⚠️ **La liste des taches n'a pas déménagé** (`B25`) : l'ancien panneau
    // les listait, triées de la plus petite à la plus grande, et disait
    // combien étaient coupées de la liste. La chaîne redessinée n'écrit que le
    // compte. Noté dans `docs/PLAN-carnet.md` § `B27`.
  })

  test("un seuil posé coupe la liste là où il tombe", async () => {
    // L'autre moitié de l'essai précédent : ce qui était vérifié sur un seuil
    // supposé se vérifie maintenant sur un seuil **posé**.
    const { cadre } = await ouvrirUneTable(
      {
        mesures: {
          taches: [
            { aire: 1, boite: [3, 3, 3, 3], couleur: "#112233", point: [3, 3] },
            { aire: 2, boite: [8, 8, 9, 9], couleur: "#445566", point: [8, 8] },
            { aire: 900, boite: [0, 0, 63, 63], couleur: "#778899", point: [0, 0] },
          ],
          coupees: 0,
          poches: [],
          crans_occupation: [],
        },
      },
      [
        {
          ...asset("bbbb2222-0", "le nain, au repos"),
          recette: { ...RECETTE_VIDE, bords: { aire_min: 3 } },
        },
      ],
    )

    fireEvent.click(puce(cadre, "bords"))
    expect(await cadre.findByText("2 taches effacées sur 3")).toBeTruthy()
  })

  // ── « Le détourage propose les poches de fond enfermées, cerclées et
  //     comptées, et n'en efface aucune de lui-même » ─────────────────────────

  // ⚠️ **Les poches de fond proposées une par une sont parties avec l'ancien
  // écran** (`B25`). Son détourage les cerclait, les comptait, et offrait *la
  // retirer ›* sur chacune — un geste qui posait une passe pipette de plus, sur
  // un pixel de la poche. La chaîne redessinée les compte, sous la table
  // *Nettoyer*, et les rebouche en bloc par un seuil ; elle ne les désigne
  // plus une par une. Noté dans `docs/PLAN-carnet.md` § `B27`.


  // ── « Le curseur d'occupation ne s'arrête que là où l'image change, et dit
  //     sur combien de pixels il tombe » ──────────────────────────────────────

  // ✅ **L'échantillon de la hauteur est rattrapé** (`B26`, 9 septembre 2026).
  // Il était parti avec l'ancien écran en `B25` ; `EchantillonDeLaHauteur`
  // (`Retouche.tsx`) reprend `EchantillonDeHauteur` (`pieces.tsx`) au calcul
  // près — le sujet dessiné dans sa case, la hauteur d'un personnage en
  // pointillé dès qu'on la dépasse, et les deux lectures (« 3 personnages de
  // haut », « l'image revient en 192 carrés de côté »). Seules les couleurs
  // passent au papier, et la case fait 34 — un écart déclaré — là où l'ancien
  // écrivait 56 sans l'avoir déclaré nulle part. L'essai est dans
  // `Retouche.test.tsx`.
  //
  // ⚠️ **Le compte des crans qui changent l'image, lui, reste perdu** :
  // `mesures.crans_occupation` n'est lu par aucun écran. Noté dans
  // `docs/PLAN-carnet.md` § `B27`.



  // ── « L'écran montre le pas retrouvé, et laisse l'imposer à la main quand la
  //     détection renonce » (D2, seconde moitié) ──────────────────────────────

  // ⚠️ **La grille retrouvée du modèle est partie avec l'ancien écran**
  // (`B25`) : *carrés de 8 pixels · 128 de côté*, et la phrase du serveur quand
  // la détection renonce sur une peinture. Le serveur la mesure toujours
  // (`mesures.grille_du_modele`), et plus aucun écran ne la lit. Noté dans
  // `docs/PLAN-carnet.md` § `B27`.



  // ── « Le rectangle de recadrage se pose sur l'image » ──────────────────────

  test("le rectangle de recadrage se glisse sur l'image, et se lit dans la table", async () => {
    const { cadre, appels } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "recadrage"))
    // Sans rectangle tracé, c'est la boîte du sujet qui décide, et la table
    // écrit ses coordonnées avec leur provenance — un constat, pas un réglage.
    expect(await cadre.findByText(/mesurée sur l'alpha/)).toBeTruthy()

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
      // 512 px d'écran pour 1 024 px d'image : le facteur est deux.
      expect(derniereRecetteEnvoyee(appels)!.recadrage!.boite).toEqual([128, 128, 512, 640])
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
        const lu = derniereRecetteEnvoyee(appels)?.recadrage?.boite
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
      const passe = derniereRecetteEnvoyee(appels)!.passes[0]
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
      const passe = derniereRecetteEnvoyee(appels)!.passes[0] as unknown as Record<string, unknown>
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
    expect(tache.getAttribute("aria-pressed")).toBe("true")
    expect(
      cadre.getByRole("button", { name: "partout" }).getAttribute("aria-pressed"),
    ).toBe("false")
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
    // **Sans changer de lieu** : la fabrique est la profondeur suivante de la
    // table, et la navigation reste sur la famille d'où l'on vient.
    expect(ouverture("Créer")).toBe("false")
    expect(
      within(screen.getByRole("navigation", { name: "Atelier" }))
        .getByRole("button", { name: "Codex" })
        .getAttribute("aria-current"),
    ).toBe("page")
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

  // ✅ **Masquer une passe est rattrapé** (`B26`, 9 septembre 2026). Le geste
  // était parti avec l'ancien écran en `B25`, et avec lui quatre essais.
  // `ReglagesDuDetourage` (`Retouche.tsx`) porte maintenant l'interrupteur par
  // passe — `role="switch"`, `aria-checked`, le libellé *passe N — masquée* /
  // *visible* —, garde ses réglages lisibles et grisés plutôt que cachés, et
  // tient la règle U10 : toucher un réglage remontre la passe, `masquee`
  // repartant à `false` avec la valeur touchée. Les essais sont dans
  // `Retouche.test.tsx`.





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
      const passe = derniereRecetteEnvoyee(appels)?.passes[0]
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

  // ✅ **Le catalogue des modèles de détourage est rattrapé** (`B26`,
  // 9 septembre 2026). Il était parti avec l'ancien écran en `B25`, et avec
  // lui quatre essais. `ReglagesDuDetourage` (`Retouche.tsx`) reprend les
  // mêmes phrases que `BlocPasse` : le titre de chaque modèle et sa note, le
  // côté auquel il infère avec sa licence (`D4`), le poids annoncé avant le
  // téléchargement, et le défaut du serveur quand rien n'est écrit. Choisir un
  // modèle pose `{ modele }` dans la passe — `Passe.modele` ne part plus
  // vide. L'essai est dans `Retouche.test.tsx`.




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
    //
    // **Le carnet fait 300 px lui aussi, et il est là en permanence** (B0) :
    // la question n'est donc plus « y a-t-il une colonne de 300 px ? » mais
    // « y en a-t-il une autre que le carnet ? ». Ce que l'essai vérifie n'a
    // pas bougé — c'est l'absence des réglages de la génération dans la galerie.
    expect(document.querySelector(".w-\\[300px\\]:not([data-carnet])")).toBeNull()
    // Et aucun curseur de retouche : la recette se lit ici, elle se règle dans
    // les tables — sur l'image en grand, ce que 380 px de colonne ne
    // permettaient pas.
    expect(screen.queryByRole("slider")).toBeNull()
  })

  // ── « Le pied de l'écran dit qu'aucune génération ne part d'ici » ──────────

  test("le pied de la galerie dit qu'aucune génération ne part d'ici", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // De quoi savoir d'un coup d'œil dans quelle moitié du produit on se
    // trouve : ici on juge et on range, on ne paie jamais.
    expect(
      await screen.findByText(/aucune génération ne part d'ici/),
    ).toBeTruthy()
  })

  // ── « La fiche d'une image porte deux portes : l'établi de sa chose, et les
  //     tables » ─────────────────────────────────────────────────────────────

  test("la fiche porte une seule porte vers la retouche, et la découpe à côté", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0"))

    // **Plus de « Reprendre dans l'établi »** (18 septembre 2026) : il ouvrait
    // la même retouche après un détour, et deux boutons pour un écran se
    // lisaient comme deux écrans.
    expect(screen.queryByRole("button", { name: "Reprendre dans l'établi" })).toBeNull()
    expect(screen.getByRole("button", { name: "Découper" })).toBeTruthy()

    // La seconde ouvre la retouche, sur n'importe quelle image, sans quitter
    // la galerie.
    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    expect(await screen.findByRole("button", { name: /^Détourage/ })).toBeTruthy()
    expect(
      ouverture("Galerie"),
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

    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    await screen.findByRole("button", { name: /^Détourage/ })

    // Ni à l'œil, ni au clavier : la surface n'existe plus tant que la table
    // est ouverte. Rien n'est perdu en partant — ce que la grille tient vit
    // dans `App`, pas dans son montage.
    expect(screen.queryByRole("region", { name: "Grille des images" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Supprimer la sélection" })).toBeNull()

    // Et elle revient telle quelle quand la table se referme.
    allerA("Galerie")
    expect(
      await screen.findByRole("region", { name: "Grille des images" }),
    ).toBeTruthy()
  })

  test("« Découper » ouvre la découpe de l'image, sans quitter la galerie", async () => {
    await ouvrirLaFiche(asset("aaaa1111-0"))
    fireEvent.click(screen.getByRole("button", { name: "Découper" }))
    expect(await screen.findByRole("button", { name: /^Détourage/ })).toBeTruthy()
    expect(ouverture("Galerie")).toBe("true")
  })

  // ── « Ouvrir un résultat depuis la galerie, et le reposer sur la toile sans
  //     nouvelle fabrication » (US-540) ────────────────────────────────────────
  //
  // **C'est cet essai-ci qui a trouvé le défaut** : la sélection posée par le
  // clic était effacée au rendu suivant, et la fiche ne s'ouvrait donc jamais —
  // ni depuis la galerie, ni ailleurs. Il tient les deux bouts du parcours :
  // la tuile ouvre bien la fiche de *ce* résultat, et le geste de la fiche
  // pose l'image telle quelle. Aucun appel de génération ne part : c'est
  // l'invariant du produit, et il se compte plutôt qu'il ne se raconte.

  test("une tuile ouvre sa fiche, et la fiche pose l'image sur la toile sans fabriquer", async () => {
    const image = asset("aaaa1111-0", "un tonneau")
    const double = await ouvrirLaFiche(image)

    // La fiche est bien celle de la tuile cliquée, et pas d'un voisin.
    const fiche = within(
      screen.getByLabelText("Fermer la fiche").closest("aside") as HTMLElement,
    )
    expect(fiche.getAllByText("un tonneau").length).toBeGreaterThan(0)

    fireEvent.click(
      await screen.findByRole("button", { name: "Poser sur la toile" }),
    )
    expect(await screen.findByText("Posée sur la toile.")).toBeTruthy()

    // La carte est rangée en réserve par la route de la toile — et **rien** n'a
    // été fabriqué pour ça.
    expect(
      double.appels.filter(({ url }) => url.includes("/board/assets/")),
    ).toHaveLength(1)
    expect(
      double.appels.filter(({ url }) => url.endsWith("/api/generations")),
    ).toHaveLength(0)
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

    // « Sujet » (« Corps de » avant RG3) : le geste qui rattache une image à
    // une chose du jeu. Il existait déjà en C1 ; ce que E4 ajoute est qu'il
    // est le seul chemin vers l'établi pour une image qui n'appartient à
    // personne.
    expect(await screen.findByText("Sujet")).toBeTruthy()
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

    const filtre = screen.getByLabelText("Ne montrer qu'une famille, ou les clips")
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

    // Elle se **lit** : la fiche dit ce que l'image est. « Sa recette » a
    // rejoint le bloc fusionné de RG3, « Ce que le jeu lui a fait » — ses
    // places n'existent plus qu'ouvert, chacune devenue une ligne.
    const entete = await screen.findByRole("button", { name: /^Ce que le jeu lui a fait/ })
    fireEvent.click(entete)
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
    fireEvent.click(screen.getByRole("button", { name: "La retoucher" }))
    expect(await screen.findByRole("button", { name: /^Nettoyage/ })).toBeTruthy()
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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const puce = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre.getByRole("button", { name: new RegExp(`^${nomDeLaTable(nom)}$`) })

  const ouvrir = async (cadre: ReturnType<typeof within>, nom: string) => {
    fireEvent.click(puce(cadre, nom))
    await waitFor(() => expect(cadre.queryByText(/^cette image est/)).toBeNull())
  }

  /** La pile des calques de la main, **dans le panneau qui la porte** (`B25`).
   *
   *  La table de la main portait ses réglages de peinture *et* la pile ; la
   *  chaîne redessinée les sépare en deux panneaux, *Retouche* et *Calques*.
   *  Ce que la pile fait — se lire du dessus au dessous, garder un calque
   *  masqué, se réordonner dès qu'il y a deux choses à ordonner — n'a pas
   *  changé de règle, seulement de panneau. */
  const ouvrirLesCalques = async (cadre: ReturnType<typeof within>) => {
    fireEvent.click(cadre.getByRole("button", { name: "Calques" }))
    await cadre.findByText("les calques")
  }

  // ── « Le contour se règle en épaisseur, en couleur et en position » ────────

  test("les quatre réglages du contour sont là, et la barre les résume", async () => {
    const { cadre, appels } = await ouvrirUneTable()
    await ouvrir(cadre, "contours")

    expect(cadre.getByText("épaisseur")).toBeTruthy()
    expect(cadre.getByText("couleur")).toBeTruthy()
    expect(cadre.getByText("position")).toBeTruthy()
    expect(cadre.getByText("les trous")).toBeTruthy()

    // Poser une position pose la place : l'écran l'écrit, et le serveur la
    // reçoit — c'est la même valeur des deux côtés.
    //
    // **Le résumé se lit sous le nom de la table ouverte** (`B25`), et non plus
    // sur sa puce : la retouche écrit la valeur une fois, là où on la règle.
    // Le cran, lui, s'appelle *dedans* au papier ; la recette, elle, dit
    // toujours `interne` — c'est la clé, et elle ne bouge pas.
    fireEvent.click(cadre.getByRole("button", { name: "dedans" }))
    await waitFor(() =>
      expect(
        (document.querySelector("[data-reglages-de-la-table]") as HTMLElement)
          .textContent,
      ).toContain("· interne"),
    )

    const pose = derniereRecetteEnvoyee(appels)
    expect(pose).toBeTruthy()
    expect(pose!.contours!.position).toBe("interne")
  })

  // ✅ **Les deux essais du contour partis avec l'ancien écran** (`B25`) **ont
  // retrouvé ce qu'ils mesuraient** (`B26`, 9 septembre 2026) :
  //
  // - *« la position dit ce qu'elle fait aux dimensions »* — le poste du
  //   contour écrit la croissance **avec case posée comme sans** : « la case du
  //   jeu fait 64 px, le fichier qui sort en fera 66 » d'un côté, « la
  //   silhouette grandit de 2 px sur chaque dimension » / « la boîte ne bouge
  //   pas — le sujet est mangé de l'épaisseur » de l'autre.
  // - *« la palette se propose, et une couleur hors palette se marque »* — la
  //   couleur du contour passe par `ChoixDeCouleur` (`Retouche.tsx`), la pièce
  //   que les autres postes emploient déjà : les pastilles de la palette
  //   entière, le champ hexadécimal, la marque `dans la palette` /
  //   `hors palette`, et *proposé, d'après ta palette · la plus sombre* tant
  //   que rien n'est posé.
  //
  // ⚠️ **Trois critères déjà cochés de `D4` ne tenaient plus que par l'ancien
  // panneau** — le choix de couleur entier, la marque *hors palette*, l'unité
  // de l'épaisseur. `tests/test_d4.py` les mesure maintenant sur
  // `Retouche.tsx`, et les essais de comportement sont dans
  // `Retouche.test.tsx`.

  // ── « Les passages s'empilent en calques nommables, masquables et
  //     réordonnables » ──────────────────────────────────────────────────────

  test("la pile se lit du dessus au dessous, et l'opacité est son sol", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")
    await ouvrirLesCalques(cadre)

    expect(cadre.getByText("les calques")).toBeTruthy()
    expect(cadre.getByText(/est le sol de la pile/)).toBeTruthy()
    // **Elle ne se supprime pas et ne se déplace pas** — vrai par construction,
    // puisqu'elle n'est pas dans la liste des calques.
    expect(cadre.queryByLabelText("Supprimer l'opacité")).toBeNull()
    expect(cadre.queryByLabelText("Monter l'opacité")).toBeNull()

    fireEvent.click(cadre.getByRole("button", { name: "Un calque de dessin de plus" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())

    // Un second calque, et le premier gagne de quoi monter : la pile se
    // réordonne dès qu'il y a deux choses à ordonner.
    fireEvent.click(cadre.getByRole("button", { name: "Un calque de dessin de plus" }))
    await waitFor(() => expect(cadre.getByLabelText(/Monter calque 1/)).toBeTruthy())
  })

  test("masquer un calque n'efface rien, et le serveur le sait", async () => {
    const { cadre, appels } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")
    await ouvrirLesCalques(cadre)

    fireEvent.click(cadre.getByRole("button", { name: "Un calque de dessin de plus" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())
    fireEvent.click(cadre.getByLabelText(/Masquer calque 1/))

    await waitFor(() => {
      const main = derniereRecetteEnvoyee(appels)!.main as Main
      // Le calque est **toujours là** : masqué, pas supprimé.
      expect(main.calques).toHaveLength(1)
      expect(main.calques[0].visible).toBe(false)
    })
  })

  test("le carré de la main reste creux tant qu'aucun passage n'est posé", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")
    await ouvrirLesCalques(cadre)

    fireEvent.click(cadre.getByRole("button", { name: "Un calque de dessin de plus" }))
    await waitFor(() => expect(cadre.getByLabelText(/Masquer calque 1/)).toBeTruthy())

    // **La pastille se remplit quand la place change l'image, pas quand elle
    // figure dans la recette** : trois calques vides ne changent rien. La barre
    // des tables vit dans l'onglet « Retouche » du panneau : on y revient.
    fireEvent.click(cadre.getByRole("button", { name: "Retouche" }))
    expect(puce(cadre, "la main").getAttribute("data-etat")).toBe("vide")
  })

  // ── « Une table qui se peint force le rendu » ─────────────────────────────

  test("la main garde ses deux côtés et ses trois témoins", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    // **Les trois témoins lui sont ouverts.** Ils lui étaient tous grisés dans
    // l'ancien écran, et c'est la table où comparer sert le plus : on peint un
    // masque, on veut voir ce qu'il enlève pendant qu'on peint.
    //
    // ⚠️ **Et le brut ne se grise plus non plus** (`B25`). L'ancien écran
    // l'éteignait sur cette table-là, avec sa raison dans le panneau et un
    // *Avant ›* pour compenser ; la chaîne redessinée ne grise ni l'un ni
    // l'autre, et ne porte aucun des deux textes. Ce qui reste mesurable ici,
    // c'est que les cinq contrôles sont bien tous atteignables.
    for (const bouton of ["Brut", "Rendu", "Aucun", "À côté", "Par-dessus"]) {
      expect(cadre.getByRole("button", { name: bouton }), bouton).not.toBeDisabled()
    }
    fireEvent.click(cadre.getByRole("button", { name: "Par-dessus" }))
    await waitFor(() =>
      expect(document.querySelector("[data-toile-main]")).toBeTruthy(),
    )
  })

  // ── Le pinceau, et les deux bouts d'un seul réglage ───────────────────────

  test("le pinceau ne rend que des impairs, et le cran de 1 px est le pixel", async () => {
    const { cadre } = await ouvrirUneTable()
    await ouvrir(cadre, "la main")

    const curseur = cadre.getByLabelText("diamètre du pinceau")
    expect(curseur.getAttribute("min")).toBe("1")
    expect(curseur.getAttribute("max")).toBe("129")

    // **L'impair est rendu par la glissière et non par un pas de deux**
    // (`B25`) : un cran pair est ramené sur son voisin impair, ce qui se lit
    // sous le curseur.
    fireEvent.change(curseur, { target: { value: "4" } })
    await waitFor(() => expect(cadre.getByText(/^5 px du rendu/)).toBeTruthy())

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
    // **Le calque se pose dans le panneau *Calques*, le sens se lit dans
    // *Retouche*** : deux panneaux depuis `B25`, et le calque choisi les
    // traverse — c'est très exactement ce que cet essai mesure.
    await ouvrirLesCalques(cadre)
    fireEvent.click(cadre.getByRole("button", { name: "Un calque de dessin de plus" }))
    fireEvent.click(cadre.getByRole("button", { name: "Retouche" }))
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
  const ouvrirLaFabrique = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const dessus = asset("bbbb2222-0", "le nain, au repos")
    const dessous = asset("bbbb2222-1", "le nain, casqué")
    const { cadre, ...reste } = await ouvrirUneTable({
      assets: [dessus, dessous],
      ...options,
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
    // mesure ne la soutient (`docs/archive/v21-arbitrages.md` A-12).
    const { cadre } = await ouvrirLaFabrique()

    expect(cadre.queryByText(/autre pose/i)).toBeNull()
    expect(cadre.queryByText(/toutes les poses/i)).toBeNull()
    expect(cadre.queryByRole("button", { name: /reposer/i })).toBeNull()
  })

  test("la fabrique dit qu'aucun appel n'en part", async () => {
    // Le pendant de « la galerie ne paie pas » : ici non plus, et l'écran le
    // dit avant qu'on ait lu.
    const { cadre } = await ouvrirLaFabrique()
    expect(cadre.getByText("aucune génération ne part d'ici")).toBeTruthy()
  })

  // ── M1 : le dessus ramené au cadre, dit et dessiné ────────────────────────

  /** Une case arrivée quatre fois plus grande que le cadre du corps — le cas
   *  des deux casques de *balthazar-2*, transposé sur les images du double, qui
   *  font 1 024 de côté. Le dessus n'est pas carré, pour que le centrage ait
   *  quelque chose à dire. */
  const RAMENE = {
    ramene: true,
    facteur: 0.25,
    gauche: 0,
    sommet: 128,
    largeur: 1024,
    hauteur: 768,
    source_largeur: 4096,
    source_hauteur: 3072,
  }

  test("l'écran dit quand le dessus a été ramené au cadre, et se tait sinon", async () => {
    // **La phrase existe pour l'échelle** : sans elle on lit « × 1,00 » et on
    // croit que l'image part de sa taille d'arrivée, alors qu'elle a déjà été
    // réduite au quart pour entrer.
    const { cadre } = await ouvrirLaFabrique({ cadrage: RAMENE })

    expect(await cadre.findByText(/ramené au cadre/)).toBeTruthy()
    expect(cadre.getByText(/4096×3072/)).toBeTruthy()
    expect(cadre.getByText(/25 %/)).toBeTruthy()
  })

  test("rien n'est dit quand deux images de même taille se posent", async () => {
    // **Une marque qui paraîtrait partout cesserait d'être une réponse** —
    // c'est la règle du liseré de `M6`, et elle vaut ici.
    const { cadre } = await ouvrirLaFabrique()
    await cadre.findByText("le calage du dessus")

    expect(cadre.queryByText(/ramené au cadre/)).toBeNull()
  })

  test("le cadre de travail pose le dessus là où le serveur le pose", async () => {
    // **La même image des deux côtés.** Un `object-contain` seul mentait des
    // deux côtés à la fois : il réduisait ce que le serveur coupait, et il
    // agrandissait ce que le serveur laissait dans son coin.
    await ouvrirLaFabrique({ cadrage: RAMENE })

    const image = await waitFor(() => {
      const trouve = document.querySelector("[data-dessus-cadre]") as HTMLElement | null
      if (!trouve || !trouve.style.width) throw new Error("le dessus n'est pas cadré")
      return trouve
    })

    // Le cadre du dessous fait 1 024 de côté ; le dessus y entre à 1 024 × 768,
    // centré verticalement — donc pleine largeur, trois quarts de hauteur, et
    // un huitième d'écart en haut. Ce sont les chiffres du serveur, repris tels
    // quels et non recalculés à l'écran.
    expect(image.style.left).toBe("0%")
    expect(image.style.top).toBe("12.5%")
    expect(image.style.width).toBe("100%")
    expect(image.style.height).toBe("75%")
    // **Lissé quand l'image a été réduite** : le serveur réduit en moyenne de
    // surface, et le plus proche voisin montrerait un autre dessin.
    expect(image.style.imageRendering).toBe("auto")
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
    expect(ecran.getByText("rangé — pas pour ce sujet")).toBeTruthy()

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

  // ── Une matière n'est plus un sujet (rangement, D4) ────────────────────────

  const NATURE_MATIERE: PosesDesTypes["types"][number] = {
    nom: "matière",
    origine: "connue",
    poses: [],
    connues: [],
    capacites: { directions: false, anime: false, sons: false, matiere: true },
    se_decoupe: false,
  }

  test("le choix du type ne propose plus « matière » pour un sujet", async () => {
    await ouvrir({
      personnages: [personnage("La chose")],
      types: [...TYPES, NATURE_MATIERE],
    })
    const ecran = await ouvrirLEtabli("La chose")

    await ecran.findByRole("option", { name: /^meuble/ })
    expect(ecran.queryByRole("option", { name: /^matière/ })).toBeNull()
  })

  test("un ancien sujet de nature « matière » la garde affichée", async () => {
    await ouvrir({
      personnages: [chose("Vieux pavés", "matière", [])],
      types: [...TYPES, NATURE_MATIERE],
    })
    const ecran = await ouvrirLEtabli("Vieux pavés")

    expect(await ecran.findByRole("option", { name: /^matière/ })).toBeTruthy()
    expect((await ecran.findByLabelText("Type d'objet") as HTMLSelectElement).value).toBe("matière")
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
    allerA("Univers")
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

  // ⚠️ **L'essai sur l'ambiance affichée carte par carte est parti avec
  // `Codex.tsx` (`C3`)** : c'était sa colonne des choses (`ListeDesChoses`),
  // qui n'a pas d'équivalent sur ce point dans `Famille.tsx` — à rouvrir si le
  // besoin s'en fait sentir.

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
// E12 · La fiche d'une chose du jeu — fondue dans la fiche courte par RP8
// ─────────────────────────────────────────────────────────────────────────────
//
// **La fiche longue vivait ici**, ouverte depuis la matrice par « sa fiche › ».
// RP8 la fond dans la fiche courte de `PageDuSujet.tsx`, atteinte en ouvrant le
// sujet plutôt que sous « Cases, planches et calibrage » : ses essais vivent
// donc maintenant dans `PageDuSujet.test.tsx`, à côté de ceux de la fiche
// courte, plutôt qu'ici à côté de ceux de la matrice — les monter aux deux
// endroits ferait dire deux choses du même écran. Deux parties n'ont pas
// suivi — « ce que le jeu réclame » et « ce qui est fait », pose par pose — et
// c'est délibéré : elles redisaient l'onglet *Objectif & règles* et les
// onglets *Images fixes* / *Animations* de la même page, à un clic d'ici. Le
// calibrage et la vitrine restent des gestes directs de la matrice, ci-dessous.
// Ce qui se calcule côté serveur — les trois couches, l'empreinte, ce que le
// fichier garde — vit toujours dans `tests/test_e12.py`.

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

  // ── « Un établi ne montre aucune rangée sans objet » ──────────────────────
  //
  // ⚠️ **Les essais sur la colonne des familles et sur la création par famille
  // sont partis avec `Codex.tsx` (`C3`)** : sa colonne des familles était le
  // carnet, sa grille des choses était `Famille.tsx` — les deux ont leurs
  // propres essais (`App.test.tsx § B0`, `Famille.test.tsx`). Ne reste ici que
  // ce que l'établi lui-même montre ou ne montre pas selon la famille.

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
    await ouvrirLeCalibrage("Balthazar")
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
    await ouvrirLeCalibrage("Balthazar")

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


  // ── « Le compte des écrans obligatoires est zéro » ────────────────────────

  test("sur une installation neuve, on atteint un prompt actif sans répondre à rien", async () => {
    // Le critère de réussite du produit, mesuré de bout en bout : de la seconde
    // zéro au champ qui paie, sans qu'une seule question ait reçu de réponse.
    const { fetchDouble } = await ouvrir(NEUF)

    // **Plus rien ne prend l'écran sur un atelier neuf** (`C2`) : l'assistant
    // qui s'ouvrait ici est parti avec le côté Réglages de l'Univers, et le
    // tour du propriétaire (`B15`) ne s'ouvre que lorsque le serveur annonce
    // une première ouverture. Deux écrans qui s'ouvraient seuls à la même
    // minute étaient un de trop.
    expect(document.querySelector("[data-assistant]")).toBeNull()

    // **Nommer une chose se fait dans sa famille**, où la bibliothèque mène en
    // deux clics — aucune question posée, aucun formulaire, et le champ est
    // vide et actif au bout.
    fireEvent.click(screen.getByRole("button", { name: "Codex" }))
    const bibliotheque = await screen.findByRole("main", {
      name: "Codex",
    })
    // Le nom accessible du bouton porte aussi le compte de la famille dès que
    // la grille a répondu (« Personnages 0 ») : une chaîne exacte gagne la
    // course tant que le compte n'est pas encore arrivé, et la perd sous charge.
    fireEvent.click(
      await within(bibliotheque).findByRole("button", { name: /^Personnages/ }),
    )
    const champ = await screen.findByLabelText("Nom du sujet du jeu à créer")
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
    // La chose entre dans la bibliothèque, et l'atelier mène au champ qui paie
    // sans qu'une seule question ait reçu de réponse. **Le champ n'est plus une
    // barre permanente** : il vit dans le guichet *Préparer une image*, le seul
    // endroit d'où l'argent part.
    const etabli = await ouvrirLEtabli("un tonneau cerclé de fer")
    expect(etabli).toBeTruthy()
    const prompt = (await champDePrompt()) as HTMLTextAreaElement
    expect(prompt.disabled).toBe(false)
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
              bandes: [],
              bandes_ecartees: [],
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

    expect(ecran.getByText("partent avec la génération")).toBeTruthy()
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

  // ── « La feuille entre en bibliothèque avec le prix de la génération, ses
  //     morceaux à côté » ──────────────────────────────────────────────────────

  test("l'écran dit que la feuille entre en bibliothèque, avec le prix de la génération", async () => {
    // **La phrase disait le contraire, et elle a tenu un jour** (M4). Elle
    // affirmait *la planche n'y entre pas — c'est une ruse pour payer moins,
    // pas un format de livraison*, ce qui était vrai jusqu'à la livraison de
    // `G16`, le 3 septembre 2026 à 23 h 45. Depuis, la planche entre : elle se
    // regarde, se met en favori, s'exporte. L'écran, lui, n'avait pas été
    // rouvert — c'est la dixième phrase du genre de celles de `G1`, et la V3.1
    // avait écrit noir sur blanc que rien n'empêchait la dixième.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/y entre/)).toBeTruthy()
    expect(ecran.getByText(/le prix de la génération/)).toBeTruthy()
    expect(ecran.getByText(/4 morceaux entrent à côté/)).toBeTruthy()
    // Et l'ancienne phrase n'est plus nulle part.
    expect(ecran.queryByText(/ruse pour payer moins/)).toBeNull()
  })

  test("l'écran dit ce qu'un compte faux fait, et ce n'est plus la même chose dans les deux sens", async () => {
    // **Trouvée en relisant l'écran en entier** (M4). Elle disait *un compte de
    // cases faux ne fait rien entrer*, ce qui n'est plus vrai que d'une moitié
    // depuis `R6` : un sujet qui manque refuse encore, un sujet de trop ne jette
    // plus rien — quatre planches sur treize du banc d'animation étaient
    // refusées pour un sujet en trop.
    const { ecran } = await ouvrir()

    expect(ecran.getByText(/de sujets que de\s+cases, rien n'entre/)).toBeTruthy()
    expect(ecran.getByText(/rien n'est jeté/)).toBeTruthy()
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
    expect(refaire.textContent).toContain("1 génération")
    expect(refaire.textContent).toContain("$0,0128")

    const unite = ecran.getByRole("button", {
      name: /Compléter les 3 — un appel chacune/,
    })
    expect(unite.textContent).toContain("3 générations")
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

    expect(ecran.getByText(/Les bancs du dépôt ont payé 18 générations/)).toBeTruthy()
    expect(ecran.getByText(/payées par les bancs du dépôt/)).toBeTruthy()
    // **Le modèle chiffré est nommé** : la barre qui paie garde celui que
    // l'auteur y a choisi, et deux modèles n'ont pas le même prix.
    expect(ecran.getByText("google/gemini-3.1-flash-lite-image")).toBeTruthy()
    expect(
      ecran.getByText(
        /deux générations identiques s'écartent plus que deux tailles/,
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
    const { ecran } = await ouvrir()

    // **Le champ qui paie n'est plus une barre posée sous l'écran** : c'est le
    // guichet *Préparer une image*, et ce qui compte n'a pas bougé — il
    // s'ouvre depuis la planche, et la planche reste dessous. Sans cela il
    // aurait fallu remonter d'un cran pour payer, c'est-à-dire perdre de vue
    // ce qu'on venait de regarder.
    fireEvent.click(ecran.getByRole("button", { name: /Armer la planche — 4 cases/ }))

    const champ = (await screen.findByPlaceholderText(
      PLACEHOLDER_DU_PROMPT,
    )) as HTMLTextAreaElement
    expect(champ.disabled).toBe(false)
    expect(cibleDuGuichet()).toContain("Balthazar")
    expect(document.querySelector("[data-planche]")).toBeTruthy()
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
          // Le morceau de légende qui parle d'elle (M4), recopié tel qu'il part.
          legende:
            "Image 1 — STYLE REFERENCE (an official artwork of this game): follow "
            + "its colours, outfit, proportions and drawing style.",
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
          // Décochée : pas de rang dans le texte, donc pas de légende.
          legende: "",
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
      jointe: null,
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
    await relire()
    // Les essais de cet écran-ci regardent les lignes, leurs interrupteurs et
    // leurs corrections : ils descendent donc dans la modification, là où ces
    // gestes vivent désormais.
    const ecran = await modifierLEnvoi()
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
    await relire()
    const ecran = await modifierLEnvoi()
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

    const choix = await ecran.findByLabelText("Couleur du fond, pour cette génération")

    expect(ecran.getByText(/aucun fond/)).toBeTruthy()
    expect(choix.parentElement?.className).toContain("damier")
  })

  test("corriger le fond ne part que dans le tri de cet appel", async () => {
    // **La correction habille l'appel et disparaît**, comme tout ce que cet
    // écran renvoie. Poser le fond durablement est un second geste, qui passe
    // par le codex.
    const { ecran, appels } = await ouvrir()

    fireEvent.change(await ecran.findByLabelText("Couleur du fond, pour cette génération"), {
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
    expect(await ecran.findByText("corrigé pour cette génération")).toBeTruthy()
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
    await relire()
    const ecran = await modifierLEnvoi()

    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText("Corriger monde"), {
      target: { value: "marais de rouille" },
    })

    // **Il va sur la fiche de la chose visée** — c'est la case où ce texte-là
    // vivra durablement, et c'est ce que le bouton dit en toutes lettres.
    fireEvent.click(await ecran.findByRole("button", { name: /garder sur le sujet/ }))

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

    await ecran.findByText("corrigé pour cette génération")
    expect(ecran.queryByRole("button", { name: /garder sur le sujet/ })).toBeNull()
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
    // (C5 : `Envoi.tsx` est passé aux jetons du papier — `text-epingle` y est
    // devenu `text-encre-attention`, `text-texte-3` `text-encre-4`.)
    expect(prix[0].className).toContain("text-encre-attention")
    expect(prix[1].className).toContain("text-encre-4")
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

    // Le bloc des images le dit en toutes lettres — c'est là qu'on lit ce qui
    // part —, et il ne dit surtout pas « aucune image jointe » au-dessus d'un
    // compte de 1.
    expect(ecran.getByText("La palette du jeu est jointe en image.")).toBeTruthy()
    // Et elle se décoche là où elle se coche — une chose est réglée à un seul
    // endroit.
    expect(ecran.getByLabelText("Cocher palette")).toBeTruthy()
    expect(ecran.queryByText(/Aucune image jointe/)).toBeNull()
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

  test("le compte des images dit ce qui part, pas la capacité du modèle", async () => {
    // **« 1 sur 0 » se lisait comme une contradiction.** Le compte disait
    // « cochées sur places du modèle », c'est-à-dire un compte sur une
    // capacité.
    //
    // **La colonne des groupes est partie avec l'ancien écran** ; le même
    // compte se lit maintenant en tête du bloc des images, et il porte la
    // même garantie : ce qui est annoncé est ce qui part, les places du
    // modèle sont écrites à côté et n'entrent pas dans le compte. Une image
    // cochée mais hors plafond n'y paraît donc pas.
    const { ecran } = await ouvrir({ envoi: SANS_PLACES })

    const entete = ecran.getByText(/places$/)
    expect(entete.textContent).toBe("0 image · 0 places")
    // Et jamais le compte des cochées à la place de celui des partantes.
    expect(entete.textContent).not.toContain("1 image")
  })

  // ── « L'en-tête du groupe dit ce que les cases cochées pèsent dans le total
  //     de l'appel » ──────────────────────────────────────────────────────────

  // **Le groupe s'appelle « Images envoyées » depuis la refonte** ; la
  // garantie, elle, n'a pas bougé : son en-tête dit ce que ses lignes cochées
  // pèsent dans le total de l'appel.
  test("l'en-tête des images dit ce que les cases cochées pèsent dans le total", async () => {
    // **Une part, pas un nombre nu** : « $0,0080 » seul ne dit pas s'il s'agit de
    // la moitié de l'appel ou d'un vingtième.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    // **Dans l'en-tête du groupe**, et pas ailleurs sur l'écran : la mesure du
    // pas d'une image jointe porte le même nombre, et ce n'est pas la même
    // phrase.
    const entete = ecran.getByText("Images envoyées").parentElement as HTMLElement
    expect(within(entete).getByText(/1 cochée/)).toBeTruthy()
    expect(within(entete).getByText("$0,0080")).toBeTruthy()
    expect(within(entete).getByText(/des \$0,0143/)).toBeTruthy()
  })

  // ── « Un avertissement s'écrit sur la ligne fautive, avec des chiffres,
  //     jamais en bandeau » ───────────────────────────────────────────────────

  // **La moitié de cette garantie tournait un temps à côté**, sous le nom
  // « … pas en bandeau », pendant que le compte manquait. Le compte est revenu
  // près du bouton qui paie : l'essai entier reprend, et le demi-essai s'en va
  // — deux essais pour une garantie finissent par se contredire.
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

    // Le bloc s'appelle maintenant par ce qu'il contient, et il dit **où** ces
    // traitements se font — « sur la machine » —, ce qui est la même chose que
    // « ils ne coûtent pas un centime » dite par son fait plutôt que par son
    // prix. Les deux lignes, elles, sont les mêmes.
    const bloc = ecran
      .getByText(/Traitements appliqués au retour · sur la machine/)
      .closest("details") as HTMLElement
    expect(within(bloc).getByText(/détourage/)).toBeTruthy()
    expect(within(bloc).getByText(/ramené à 32 px/)).toBeTruthy()
    expect(within(bloc).getByText(/Les originaux sont conservés/)).toBeTruthy()
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

    // La fenêtre de relecture se ferme par le même bouton, qu'on paie ou pas :
    // rien n'est consommé en passant.
    fireEvent.click(ecran.getByRole("button", { name: "Fermer" }))
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
    fireEvent.click(ceQuiLance())
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
    fireEvent.click(ceQuiLance())

    await screen.findByRole("button", { name: /^Payer et lancer/ })
    expect(appels.filter((a) => a.url === "/api/generations" && a.corps)).toHaveLength(1)
  })

  test("l'écran dit lui-même qu'aucune case ne l'éteint pour toujours", async () => {
    const { ecran } = await ouvrirUneSerie()

    expect(ecran.getByText(/Il n'y a pas de case « pour toujours »/)).toBeTruthy()
  })

  // ── Le prix, et la mesure qui le porte ──────────────────────────────────

  // **La mesure vit sous le prix, dans la carte « Consommation estimée »** :
  // sur combien d'appels payés il est mesuré, ce que chaque image jointe y
  // ajoute — mesuré à part, sur ses propres appels — et la phrase qui empêche
  // de lire une moyenne comme un tarif (T1/E13).
  test("le prix porte sa mesure à côté de lui, jamais fondue dedans", async () => {
    // **Une mesure, jamais un tarif** (T1), et E13 y a ajouté sa moitié : une
    // moyenne n'est le prix de personne. Le pas d'une image jointe est mesuré à
    // part, sur ses propres appels.
    const { ecran } = await ouvrir({ envoi: ENVOI })

    expect(ecran.getByRole("button", { name: "Payer et lancer $0,0143" })).toBeTruthy()
    expect(ecran.getByText(/mesuré sur 9 générations payées/)).toBeTruthy()
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

    // Le nouvel écran le dit avec ses mots — « aucune mesure », et non un zéro
    // qui passerait pour un prix —, et le bouton reste muet sur le montant.
    expect(ecran.getByText("Aucune mesure disponible pour ce modèle.")).toBeTruthy()
    expect(ecran.getAllByText("Coût inconnu").length).toBeGreaterThan(0)
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

    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))

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
    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
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
    fireEvent.click(ceQuiLance())

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
    // **Le bouton s'appelle *Relire avant envoi* depuis l'atelier unifié** — il
    // s'appelait *Générer* le jour où cet essai a été écrit, et c'est le seul
    // mot qui a changé : la garantie tenue est qu'un bouton plein existe avant,
    // et qu'il est remplacé ensuite par l'état de ce qui part.
    expect(screen.getByRole("button", { name: BOUTON_DE_RELECTURE })).toBeTruthy()
    expect(screen.getByText("Ctrl + Entrée")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))

    // Le bloc a pris la place du bouton, et il porte le compte.
    const enRoute = await screen.findByRole("status")
    expect(enRoute.textContent).toContain("1 image en route")

    // **Le bouton plein n'est plus là** : le geste est descendu dans la fente,
    // en lien. Il reste à portée — on a le droit de lancer une seconde série —
    // mais il a cessé d'être ce qui saute aux yeux.
    expect(screen.queryByRole("button", { name: BOUTON_DE_RELECTURE })).toBeNull()
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
    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
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
    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
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

    // Au repos, la porte ne porte que son nom.
    expect(leLieu("Galerie")).toBeTruthy()
    expect(
      screen.queryByLabelText(/fabrications en cours/),
    ).toBeNull()

    const champ = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(champ, { target: { value: "un petit voyageur, de face" } })
    await waitFor(() => expect(champ.value).toBe("un petit voyageur, de face"))
    fireEvent.click(screen.getByRole("button", { name: BOUTON_DE_RELECTURE }))
    fireEvent.click(await screen.findByRole("button", { name: /^Payer et lancer/ }))

    // **Le compte a changé de porte, pas de métier** : il était sur l'onglet
    // *Galerie*, il est sur la porte *Fabrications* — c'est-à-dire à côté de la
    // file où ce qui part est suivi. Ce que l'essai tient est le même : depuis
    // un écran qui ne paie pas, la navigation est le seul témoin de ce qui est
    // en route.
    const pastille = await screen.findByLabelText("1 fabrication en cours")
    expect(pastille.textContent).toContain("1")

    // On part à l'Univers : le guichet n'y est pas, donc son compte non plus.
    // La pastille, elle, est dans la navigation — rendue partout.
    allerA("Univers")
    expect(screen.getByLabelText("1 fabrication en cours")).toBeTruthy()
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

  // ── M3 · « Corriger un texte cesse de figer l'écran » ─────────────────────
  //
  // **Trois défauts vécus comme un seul.** L'auteur les a dits en trois mots —
  // *« ça freeze »* — et ils se cachaient l'un l'autre : la composition relisait
  // le projet jusqu'à quarante-deux fois par demande (mesuré côté serveur, dans
  // `tests/test_m3.py`), chaque lettre déclenchait un aller-retour, et le champ
  // de correction n'avait aucune mémoire à lui. Les deux derniers se voient ici.

  const corrigerLeMonde = async () => {
    const ouvert = await ouvrir()
    fireEvent.click(ouvert.ecran.getAllByRole("button", { name: "corriger" })[0])
    const champ = (await ouvert.ecran.findByLabelText(
      "Corriger monde",
    )) as HTMLTextAreaElement
    return { ...ouvert, champ }
  }

  const demandes = (appels: { url: string }[]) =>
    appels.filter((a) => a.url === "/api/outgoing").length

  test("un mot tapé dans une correction ne part pas lettre par lettre", async () => {
    // **Une lettre écrivait dans le tri, et le tri commande la demande.** Un mot
    // de dix lettres, dix allers-retours enchaînés — et chacun relisait le
    // projet quinze à quarante-deux fois. La demande attend maintenant que la
    // frappe se pose ; l'appel, lui, n'est pas coupé en deux : il rapporte
    // toujours le texte et le prix ensemble, et cette règle-là ne bouge pas.
    const { champ, appels } = await corrigerLeMonde()
    const avant = demandes(appels)

    // **Les lettres sont espacées pour de vrai**, trente millisecondes — la
    // frappe d'un dactylo pressé. Six `fireEvent` d'affilée, sans attente, ne
    // prouveraient rien : rien ne peut se déclencher entre deux instructions
    // d'une même bouffée, et l'essai passerait même sans repos du tout.
    for (const mot of ["m", "ma", "mar", "mara", "marai", "marais"]) {
      fireEvent.change(champ, { target: { value: mot } })
      await new Promise((suite) => setTimeout(suite, 30))
    }

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/outgoing" &&
            JSON.stringify(a.corps).includes('"marais"'),
        ),
      ).toBe(true),
    )
    expect(demandes(appels) - avant).toBe(1)
  })

  test("la fenêtre qui s'ouvre demande sur-le-champ, sans attendre", async () => {
    // **Le repos ne s'applique qu'à ce qui change pendant qu'on est dedans.** On
    // ouvre cet écran pour voir ce qui part : le faire attendre un cinquième de
    // seconde pour rien serait payer la réparation avec la chose qu'elle répare.
    const { appels } = await ouvrir()

    expect(demandes(appels)).toBe(1)
  })

  test("le champ montre ce qui vient d'être tapé, jamais un texte en retard", async () => {
    // **Le champ n'avait aucune mémoire à lui** : ce qu'il affichait venait de
    // la dernière réponse du serveur. À chaque lettre, l'écran se redessinait
    // *avant* la réponse — donc avec le texte d'avant la lettre.
    const { champ } = await corrigerLeMonde()

    fireEvent.change(champ, { target: { value: "marais de rouille" } })

    expect(champ.value).toBe("marais de rouille")
  })

  test("le curseur reste où l'auteur l'a mis, au milieu d'une ligne", async () => {
    // **C'est le défaut qui rendait la correction du milieu impraticable**,
    // quand les deux autres ne la rendaient que lente : le navigateur, à qui
    // l'on réécrit le contenu d'un champ, replace le curseur à la fin. Taper à
    // la fin le masquait, la fin étant là où le curseur atterrit.
    const { champ, appels } = await corrigerLeMonde()
    const avant = demandes(appels)

    // On écrit *gris* au milieu, et le curseur se pose derrière, comme le
    // navigateur le ferait.
    fireEvent.change(champ, { target: { value: "marais gris de fer" } })
    champ.setSelectionRange(11, 11)

    // Et la demande part, revient, redessine l'écran — c'est là que le curseur
    // sautait la seconde fois.
    await waitFor(() => expect(demandes(appels)).toBe(avant + 1))
    await waitFor(() => expect(champ.value).toBe("marais gris de fer"))

    expect(champ.selectionStart).toBe(11)
  })

  test("remettre efface le brouillon avec la correction", async () => {
    // Sans quoi le champ continuerait de montrer ce qu'on vient de reprendre
    // alors que le texte qui part est revenu à l'original — **le champ mentirait
    // sur ce qui part**, ce que cet écran existe précisément pour interdire.
    const { ecran, champ } = await corrigerLeMonde()

    fireEvent.change(champ, { target: { value: "marais de rouille" } })
    fireEvent.click(await ecran.findByRole("button", { name: "remettre" }))

    await waitFor(() => expect(champ.value).toBe("marais de fer"))
  })

  // ── M4 · « L'écran nommait une image autrement que le texte qui part » ────
  //
  // **Les deux phrases s'affichaient ensemble, à quelques centimètres l'une de
  // l'autre.** Le texte qui part disait *voici la planche existante, n'y change
  // que ce qu'on demande* ; l'écran, plus bas, *voici une grille vide, place les
  // sujets dedans*. Deux demandes opposées pour une seule image, au moment où
  // l'on décide de payer — l'auteur cherchait un gabarit qu'il aurait validé,
  // c'était son propre corps, redessiné à la volée.
  //
  // Le serveur savait très bien laquelle des deux c'était : il ne rendait qu'un
  // **nombre**, sans le rôle, et l'écran a gardé les mots du plus ancien des
  // deux cas.

  /** Ce que le serveur rend pour la troisième image d'une planche
   *  d'équipement — celle qu'on redonne au modèle pour qu'il la modifie. */
  const PLANCHE_JOINTE = {
    role: "planche" as const,
    rang: 2,
    nom: "la planche du corps, que le modèle doit modifier",
    raison:
      "elle ne se décoche pas — sans elle, il n'y aurait rien à modifier — " +
      "et elle compte dans les places",
    legende:
      "Image 2 — THE SPRITE SHEET TO CHANGE: 4 sprites of the same character, " +
      "already drawn. Keep every cell where it is and change only what the " +
      "request below asks for.",
    prix: 0.008,
  }

  const GABARIT_JOINT = {
    ...PLANCHE_JOINTE,
    role: "gabarit" as const,
    nom: "le gabarit de la grille, qui dit au modèle où poser les 4 sujets",
    raison:
      "il ne se décoche pas — une planche sans lui ne dit pas à quoi elle " +
      "ressemble — et il compte dans les places",
    legende: "Image 2 — EMPTY LAYOUT GRID: 4 cells. Do NOT draw the grid lines.",
  }

  const avecJointe = (jointe: typeof PLANCHE_JOINTE | typeof GABARIT_JOINT) => ({
    ...ENVOI,
    images: { ...ENVOI.images, gabarit: 1, rang_gabarit: 2, jointe },
  })

  test("la planche d'un équipement est nommée pour ce qu'elle est", async () => {
    // **Le mot vient du serveur**, qui est le seul à savoir laquelle des deux
    // images c'est. L'écran ne le devine plus depuis un nombre.
    const { ecran } = await ouvrir({ envoi: avecJointe(PLANCHE_JOINTE) })

    expect(
      await ecran.findByText(/la planche du corps, que le modèle doit modifier/),
    ).toBeTruthy()
    expect(ecran.queryByText(/le gabarit de la grille/)).toBeNull()
  })

  test("une grille vide garde les mots qu'elle avait", async () => {
    // La réparation ne change rien au cas qui était juste : c'est la moitié qui
    // compte d'une correction de vocabulaire.
    const { ecran } = await ouvrir({ envoi: avecJointe(GABARIT_JOINT) })

    expect(
      await ecran.findByText(/le gabarit de la grille, qui dit au modèle/),
    ).toBeTruthy()
  })

  test("la troisième image a sa vignette, et elle s'ouvre en grand", async () => {
    // **Qu'elle ne se décoche pas était écrit et reste vrai ; qu'on ne puisse
    // pas la voir n'avait jamais été décidé.** Elle était un paragraphe sous la
    // liste, sans image.
    const { ecran } = await ouvrir({ envoi: avecJointe(PLANCHE_JOINTE) })

    const vignette = (await ecran.findByText(/la planche du corps/))
      .closest("li")!
      .querySelector("[data-planche-jointe] img") as HTMLImageElement
    expect(vignette.getAttribute("src")).toContain("/api/outgoing/sheet")

    // Et le geste de l'aperçu, celui qui existe déjà partout ailleurs.
    fireEvent.pointerOver(vignette.closest("li")!)
    fireEvent.keyDown(window, { key: " ", code: "Space" })
    const apercu = screen.getByRole("dialog", { name: "Aperçu" })
    expect(apercu.querySelector("img")!.getAttribute("src")).toContain(
      "/api/outgoing/sheet",
    )
  })

  test("la troisième image n'a pas de case à cocher, et sa raison est écrite", async () => {
    // **Une ligne sans case, pas une case grisée** : une case grisée aurait
    // demandé de comprendre pourquoi elle l'est ; une ligne sans case dit qu'il
    // n'y a rien à décider.
    const { ecran } = await ouvrir({ envoi: avecJointe(PLANCHE_JOINTE) })

    const ligne = (await ecran.findByText(/la planche du corps/)).closest("li")!
    expect(ligne.querySelector("button")).toBeNull()
    expect(ligne.textContent).toContain("ne se décoche pas")
  })

  test("chaque image porte, sous elle, le morceau de légende qui la concerne", async () => {
    // **Recopiée, jamais déménagée.** Le bloc entier est du texte qui part : il
    // se lit en haut, mot pour mot, dans l'ordre où il s'assemble.
    const { ecran } = await ouvrir({ envoi: avecJointe(PLANCHE_JOINTE) })

    const ligne = (await ecran.findByText(/la planche du corps/)).closest("li")!
    expect(ligne.textContent).toContain("THE SPRITE SHEET TO CHANGE")

    const artwork = ecran.getByText("artwork officiel").closest("li")!
    expect(artwork.textContent).toContain("Image 1 — STYLE REFERENCE")

    // Une image décochée n'a pas de rang dans le texte : elle n'a donc pas de
    // légende non plus.
    const concept = ecran.getByText("concept art").closest("li")!
    expect(concept.textContent).not.toContain("Image ")
  })

  // ── M5 · Les corrections survivent à la sortie, et l'on joint sans sortir ──
  //
  // **Deux moitiés d'un seul geste.** L'auteur lit ce qui part, s'aperçoit
  // qu'une image manque, va la chercher — et retrouvait ses corrections
  // effacées. Réparer la perte sans donner le chemin court aurait laissé le
  // détour ; donner le chemin court sans réparer la perte l'aurait rendu
  // inutile. Les deux essais qui suivent tiennent la charnière : ce qui compte
  // comme *le même appel*, et ce qu'un ajout n'a pas le droit de bouger.

  /** Fermer la fenêtre de confirmation par son bouton, et attendre qu'elle
   *  soit vraiment partie — sans quoi l'ouverture suivante retrouverait celle
   *  d'avant et l'essai passerait sans rien avoir mesuré. */
  const revenirSansPayer = async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer" }),
    )
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
  }

  /** Éteindre le monde et réécrire le sujet — **les deux sortes d'écart**, une
   *  ligne qui ne part plus et une ligne qui part autrement. Un essai qui n'en
   *  tiendrait qu'une laisserait l'autre libre de se perdre. */
  const corrigerDeuxFois = async (ecran: ReturnType<typeof within>) => {
    fireEvent.click(await ecran.findByLabelText("Éteindre monde"))
    await ecran.findByLabelText("Allumer monde")
    const ligne = ecran.getByText("sujet").closest("li")!
    fireEvent.click(within(ligne).getByText("corriger"))
    fireEvent.change(ecran.getByLabelText("Corriger sujet"), {
      target: { value: "un forgeron nain, barbe tressée" },
    })
    await ecran.findByDisplayValue("un forgeron nain, barbe tressée")
  }

  test("sortir et revenir pour le même appel rend les corrections intactes", async () => {
    // ⚠️ **Le geste que la règle d'avant rendait impossible.** *Le tri repart
    // de rien à chaque ouverture* (E14) ne distinguait pas l'appel suivant de
    // l'appel qu'on venait de quitter : sortir chercher une image effaçait, en
    // silence, tout ce qu'on venait de régler.
    const { ecran } = await ouvrir()
    await corrigerDeuxFois(ecran)

    await revenirSansPayer()
    await relire()
    const revenu = await modifierLEnvoi()

    // Éteinte comme on l'avait laissée, réécrite comme on l'avait réécrite —
    // et c'est le serveur qui le rend, depuis le tri qu'on lui renvoie.
    expect(await revenu.findByLabelText("Allumer monde")).toBeTruthy()
    const sujet = revenu.getByText("sujet").closest("li")!
    expect(sujet.textContent).toContain("un forgeron nain, barbe tressée")
    // Et le texte assemblé dit la même chose que la ligne : c'est la promesse
    // de l'écran, et elle vaut aussi au retour. Il se lit dans la première
    // lecture — celle qui montre les parties telles qu'elles partent —, donc
    // on remonte la modification pour le vérifier.
    fireEvent.click(screen.getByRole("button", { name: "Terminer les modifications" }))
    const lecture = within(document.querySelector("[data-envoi]") as HTMLElement)
    expect(await lecture.findByText(/barbe tressée/)).toBeTruthy()
  })

  test("un appel qui a changé repart d'un tri vide", async () => {
    // **L'autre moitié de la charnière**, et elle vaut autant : un réglage qui
    // traînerait d'un appel au suivant est le danger que la règle d'avant
    // visait, et il n'est pas levé. Changer le sujet fait un autre appel.
    const { ecran } = await ouvrir()
    await corrigerDeuxFois(ecran)
    await revenirSansPayer()

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un forgeron gobelin" } })

    await relire()
    const revenu = await modifierLEnvoi()
    expect(await revenu.findByLabelText("Éteindre monde")).toBeTruthy()
    expect(revenu.queryAllByText(/barbe tressée/)).toEqual([])
  })

  test("ajouter une référence joint l'image sans rien bouger de ce qu'on corrige", async () => {
    // **C'est la grille du produit qui s'ouvre, et elle se pose par-dessus.**
    // L'invariant dit *une seule grille d'assets dans tout l'atelier* ; la
    // confirmation reste montée derrière, ce qui est précisément ce qui garde
    // les corrections en place.
    const { ecran, appels } = await ouvrir({
      assets: [asset("tonneau-0", "un tonneau"), asset("lanterne-0", "une lanterne")],
    })
    await corrigerDeuxFois(ecran)

    // **Le choix a changé de surface** : c'est le cadre de dialogue du produit
    // — « Choisir une référence » — et non plus la grille posée à l'intérieur
    // de la confirmation. Ce qui compte n'a pas bougé : elle se pose
    // par-dessus, la confirmation reste montée derrière, et rien de ce qu'on
    // corrige ne bouge.
    fireEvent.click(ecran.getByRole("button", { name: "Ajouter une référence" }))
    const choix = within(
      await screen.findByRole("dialog", { name: "Choisir une référence" }),
    )
    expect(document.querySelector("[data-envoi]")).toBeTruthy()
    const tuiles = await choix.findAllByRole("button", { name: /^Choisir / })
    expect(tuiles.length).toBe(2)

    fireEvent.click(tuiles[0])

    // L'image entre avec son rôle, **et le tri part avec elle inchangé** : même
    // ligne éteinte, même texte réécrit, dans la même demande.
    await waitFor(() => {
      const dernier = appels.filter((a) => a.url === "/api/outgoing").at(-1)!
      const corps = JSON.stringify(dernier.corps)
      expect(corps).toContain('"role":"reference"')
      expect(corps).toContain('"eteints":["jeu.monde"]')
      expect(corps).toContain("un forgeron nain, barbe tressée")
    })

    // Le choix se referme sur ce qu'on lisait — l'effet est là, sous les yeux.
    expect(screen.queryByRole("dialog", { name: "Choisir une référence" })).toBeNull()
    expect(document.querySelector("[data-envoi]")).toBeTruthy()
    expect(ecran.getByLabelText("Allumer monde")).toBeTruthy()

    // **Aucun appel au fournisseur, aucun centime** : choisir une image n'a
    // jamais rien dépensé, et ce chemin-ci ne fait pas exception.
    expect(appels.filter((a) => a.url === "/api/generations")).toEqual([])
  })

  test("Échap referme le choix, et lui seul", async () => {
    // Sans le garde, une seule pression refermait les deux : l'auteur
    // renonçait à joindre une image et se retrouvait devant son prompt.
    const { ecran } = await ouvrir({ assets: [asset("tonneau-0", "un tonneau")] })

    fireEvent.click(ecran.getByRole("button", { name: "Ajouter une référence" }))
    const cadre = await screen.findByRole("dialog", { name: "Choisir une référence" })

    // **Le choix est désormais un dialogue natif**, et c'est le navigateur qui
    // porte Échap jusqu'à lui : il annonce l'annulation, le produit la reçoit
    // et referme *ce* cadre-là. La garantie est la même — une pression, une
    // surface —, elle se mesure sur l'événement que le navigateur envoie.
    fireEvent(cadre, new Event("cancel", { bubbles: false, cancelable: true }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Choisir une référence" })).toBeNull(),
    )
    expect(document.querySelector("[data-envoi]")).toBeTruthy()

    // Et la seconde pression, elle, revient bien au prompt.
    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
  })

  // **On regarde une image en grand avant de la choisir.** Le choix d'une
  // référence se fait dans le cadre de dialogue commun
  // (`BibliothequePourImage`), et ses tuiles portent la visée du reste du
  // produit : le pointeur vise, Espace ouvre. Sans elle, on choisissait sur une
  // vignette de 128 px sans pouvoir l'ouvrir.
  test("l'aperçu passe avant la grille, et la grille avant la confirmation", async () => {
    // **Trois surfaces empilées, et Échap n'en prend qu'une à la fois.** On
    // regarde une image en grand *avant* de la choisir : c'est l'aperçu qui
    // sert à ça, et il doit donc se refermer le premier.
    const { ecran } = await ouvrir({ assets: [asset("tonneau-0", "un tonneau")] })
    fireEvent.click(ecran.getByRole("button", { name: "Ajouter une référence" }))
    // La grille de choix est le cadre de dialogue du produit — c'est par son
    // nom qu'on la tient, comme les deux essais au-dessus.
    const choix = await screen.findByRole("dialog", { name: "Choisir une référence" })

    const tuile = (await within(choix).findAllByRole("button", { name: /^Choisir / }))[0]
    fireEvent.pointerOver(tuile)
    fireEvent.keyDown(window, { key: " ", code: "Space" })
    expect(screen.getByRole("dialog", { name: "Aperçu" })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Aperçu" })).toBeNull(),
    )
    // La grille est encore là — l'aperçu seul est parti.
    expect(screen.getByRole("dialog", { name: "Choisir une référence" })).toBeTruthy()
    expect(document.querySelector("[data-envoi]")).toBeTruthy()
  })

  test("sortir la grille ouverte ne la rouvre pas à l'appel suivant", async () => {
    // **Le choix est un état de cette fenêtre-là, pas du produit.** Sortir en
    // le laissant derrière aurait posé la grille par-dessus la confirmation
    // suivante, devant un appel qui n'a rien demandé.
    const { ecran } = await ouvrir({ assets: [asset("tonneau-0", "un tonneau")] })
    fireEvent.click(await ecran.findByLabelText("Éteindre monde"))
    await ecran.findByLabelText("Allumer monde")

    fireEvent.click(ecran.getByRole("button", { name: "Ajouter une référence" }))
    expect(await screen.findByRole("dialog", { name: "Choisir une référence" })).toBeTruthy()

    // On sort par l'onglet, qui est la sortie qu'aucun des deux écrans ne voit
    // venir — celle qui remonte de toute profondeur.
    allerA("Galerie")
    await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())

    await champDePrompt()
    await relire()
    const revenu = await modifierLEnvoi()
    expect(screen.queryByRole("dialog", { name: "Choisir une référence" })).toBeNull()
    // L'onglet non plus n'est pas un autre appel : le tri traverse aussi cette
    // sortie-là, qui est celle que l'auteur prenait pour aller chercher son
    // image.
    expect(await revenu.findByLabelText("Allumer monde")).toBeTruthy()
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

    // Le mot du bouton change avec son état — « Envoi en cours… » —, parce
    // qu'un bouton grisé qui garde son libellé se lit comme un refus.
    const bouton = (await ecran.findByRole("button", {
      name: /Envoi en cours/,
    })) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    // Et la sortie ne ment plus : la dépense est partie, elle ne se rattrape
    // pas — le bouton qui ferme la fenêtre refuse le clic.
    const revenir = ecran.getByRole("button", {
      name: "Fermer",
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
    await ecran.findByRole("button", { name: /Envoi en cours/ })
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
    // non plus. Les lignes vivent derrière « Modifier l'envoi », qui est la
    // seconde lecture de l'écran depuis l'atelier unifié.
    await modifierLEnvoi()
    fireEvent.click(ecran.getAllByRole("button", { name: "corriger" })[0])
    fireEvent.change(await ecran.findByLabelText(/^Corriger /), {
      target: { value: "marais de rouille" },
    })
    await waitFor(() => expect(ecran.getByText("corrigé pour cette génération")).toBeTruthy())

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
    // **Le second écran se recompose avant de pouvoir payer** : le bouton reste
    // grisé tant que les textes, les images et le coût n'ont pas été
    // réactualisés. Cliquer dedans pendant ce temps-là ne lance rien — et
    // l'essai croirait à un verrou qui aurait avalé un appel voulu.
    const bouton = encore.getByRole("button", {
      name: /^Payer et lancer/,
    }) as HTMLButtonElement
    await waitFor(() => expect(bouton.disabled).toBe(false))
    fireEvent.click(bouton)
    await waitFor(() => expect(double.retenu()).toBe(true))
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

    // On réarme la même case : l'écran se saute, et le geste du guichet paie
    // directement. **Ce geste change de place quand un lot est en route** — le
    // bloc d'état prend celle du bouton, et le lien *Générer encore* le reçoit
    // dans la fente —, mais il ne change pas de métier : c'est lui qui porte le
    // verrou, où qu'il soit. Viser le bouton par son nom mesurerait l'absence
    // du bloc, pas le verrou.
    const encore = await ouvrirLEtabli("Le nain")
    fireEvent.click(encore.getByRole("button", { name: "Fabriquer repos" }))
    const bouton = await attendreCeQuiLance()
    act(() => {
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      bouton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(partis(double.fetchDouble)).toHaveLength(2)

    // Et il le dit, là aussi.
    expect(await screen.findByRole("button", { name: /envoi en cours/i })).toBeTruthy()
    await double.repondre()
    expect(partis(double.fetchDouble)).toHaveLength(2)
  })

  // ── « Changer d'onglet ferme l'écran de confirmation, sans rien dépenser » ─

  test("les trois onglets ferment l'écran de confirmation", async () => {
    // **On était enfermé.** Cliquer *Galerie* changeait le fil d'Ariane et
    // laissait l'écran en place — un écran qu'aucun onglet ne pouvait fermer.
    // Changer d'onglet remonte de toute profondeur : c'était déjà vrai de la
    // découpe, des dépenses, de l'établi et des tables.
    for (const onglet of ["Galerie", "Univers", "Créer"]) {
      const double = serveurDouble()
      await monter(double.fetchDouble)
      const champ = (await champDePrompt()) as HTMLTextAreaElement
      fireEvent.change(champ, { target: { value: "un forgeron nain" } })
      await relire()

      allerA(onglet)
      await waitFor(() => expect(document.querySelector("[data-envoi]")).toBeNull())
      expect(ouverture(onglet)).toBe(
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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  // ⚠️ **Les trois essais du grossissement sont partis d'ici** (`B25`). Ils
  // mesuraient la mise en page de l'ancien écran — le cadre parent de la boîte —
  // que la chaîne redessinée ne mesure pas pareil : elle mesure sa scène
  // (`[data-scene-de-retouche]`) et pose le facteur sur la figure. Le pour cent
  // libre entre 1 et 250, l'ajusté sous cent, le champ qui dit le pour cent
  // appliqué **et la molette** sont mesurés sur l'écran neuf par
  // `Retouche.test.tsx` § *le grossissement libre entre 1 et 250 %* — neuf
  // essais, contre trois ici. La molette y garde le point visé sous le
  // pointeur, comme ici, et arrête le défilement de la page.

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
          // **La sixième lecture du serveur** (B16) : la marge est-elle avalée
          // par la mise en case ? Ces images-là n'ont pas de grille posée.
          marge_sans_effet: false,
        },
      },
    })

    fireEvent.click(
      cadre.getByRole("button", { name: /^Recadrage/ }),
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
          marge_sans_effet: false,
        },
      },
    })

    fireEvent.click(cadre.getByRole("button", { name: /^Recadrage/ }))

    // Les deux valeurs, et la seconde indisponible tant que rien n'est tracé :
    // on ne la choisit pas dans la colonne, on trace et le segment bascule.
    expect(await cadre.findByRole("button", { name: "la boîte du sujet" })).toBeTruthy()
    const tracee = cadre.getByRole("button", {
      name: "une boîte tracée",
    }) as HTMLButtonElement
    expect(tracee.disabled).toBe(true)

    // Les coordonnées, avec leur provenance.
    expect(cadre.getByText(/mesurée sur l'alpha · 356, 0, 667, 823/)).toBeTruthy()
    // ⚠️ **Deux lectures du serveur ne sont pas reprises par l'écran neuf**
    // (`B25`) : la part jetée avec le couple avant/après (« 1024×1024 →
    // 312×824, 76 % de l'image d'origine est jeté ») et les bords que le sujet
    // touche. Les deux sont notées dans `docs/PLAN-carnet.md` § `B27` — le
    // serveur les mesure toujours, `tests/test_u2.py` les tient, et personne ne
    // les affiche plus.
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
            marge_sans_effet: false,
          },
        },
      },
      [image],
    )

    fireEvent.click(cadre.getByRole("button", { name: /^Recadrage/ }))
    // La provenance passe du constat au tracé, et elle dit les quatre nombres.
    expect(await cadre.findByText(/tracée à la main · 10, 10, 900, 900/)).toBeTruthy()
    // ⚠️ **La phrase « plus large que le sujet · sans effet sur le rendu » n'a
    // pas déménagé** (`B25`) : l'ancien panneau la portait, la chaîne
    // redessinée ne l'écrit nulle part. Notée dans `docs/PLAN-carnet.md`
    // § `B27` — la mesurer ici aurait demandé de mesurer une phrase que
    // personne n'affiche.
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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    fireEvent.click(cadre.getByRole("button", { name: /^Main/ }))
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
    const main = derniereRecetteEnvoyee(appels)?.main as
      | { opacite?: { points: number[][] }[] }
      | undefined
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
// U3 · Un curseur prend un chiffre — **déménagé d'ici en `B25`**
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ Les six essais de cette étape éprouvaient `Curseur` (`pieces.tsx`) à
// travers la table du détourage de l'ancien écran : le champ où la valeur
// s'écrit, Entrée, Échap, la valeur ramenée dans ses bornes, et le chiffre
// tapé pendant qu'on tient la glissière.
//
// **Les six sont sur l'écran neuf**, dans `Retouche.test.tsx` § *un curseur
// prend un chiffre* : sa `Glissiere` porte le champ depuis le 9 septembre 2026,
// avec le comportement de `Curseur`, repris et non réinventé. `Curseur` reste
// employé par ailleurs — la fiche d'une image, la fabrique de superposition,
// l'atelier d'une bande —, et `Places.test.tsx` le tient là-bas.


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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    return { ...double, cadre }
  }

  const recettesPosees = (appels: { url: string; corps: unknown }[]) =>
    appels
      .filter((a) => a.url.includes("/recipe"))
      .map((a) => recettesEnvoyees([a])[0])
      .filter((r) => !!r)

  /** **L'interrupteur de la table ouverte** (`B25`). L'ancien écran portait un
   *  carré par table dans sa barre ; la chaîne redessinée porte une pastille qui
   *  *dit* l'état — posée, vide, endormie — et **un** interrupteur, dans le
   *  panneau de la table qu'on règle. Une place s'éteint là où on la voit. */
  const ouvrirLaTable = async (cadre: ReturnType<typeof within>, nom: string) => {
    fireEvent.click(cadre.getByRole("button", { name: new RegExp(`^${nomDeLaTable(nom)}$`) }))
    return cadre
  }

  const interrupteur = (cadre: ReturnType<typeof within>) =>
    cadre.getByRole("button", { name: /L'endormir|La réveiller/ })

  /** L'état que la pastille d'une table annonce — `posee`, `vide`, `endormie`
   *  ou `rien`. C'est le successeur des trois carrés de l'ancienne barre. */
  const etatDe = (cadre: ReturnType<typeof within>, nom: string) =>
    cadre
      .getByRole("button", { name: new RegExp(`^${nomDeLaTable(nom)}`) })
      .getAttribute("data-etat")

  // ── « La façon de réduire se change image par image » (D2) ─────────────────

  test("la façon de réduire se change sur une image, et part dans sa recette", async () => {
    // *« Je veux qu'on puisse choisir entre les 4 et changer en cours de route
    // dans l'atelier »* — l'auteur, 3 septembre 2026. Les quatre méthodes
    // rendent des sprites franchement différents ; le choix est un parti pris
    // de style, et il appartient à l'image autant qu'au projet.
    const { cadre, appels } = await ouvrirLesTables()
    fireEvent.click(cadre.getByRole("button", { name: /^Pixelisation/ }))

    fireEvent.click(await cadre.findByRole("button", { name: "vote en deux temps" }))

    await waitFor(() =>
      expect(recettesPosees(appels).at(-1)?.grille?.methode).toBe("vote"),
    )
    // ✅ **Ce que chaque méthode rend est réécrit sous les segments** (`B26`,
    // 9 septembre 2026). La phrase était partie avec l'ancien écran en `B25` ;
    // `CE_QUE_LA_METHODE_REND` est rendu sous les crans de *façon de réduire*
    // dans `ReglagesDeLaGrille` (`Retouche.tsx`) — « un pixel sur N gardé »,
    // « contour net et intérieur lisible ». Un libellé de trois mots ne dit pas
    // ce qu'on gagne et ce qu'on perd, et c'est ce qui départage les quatre.
    // L'essai est dans `Retouche.test.tsx`.
  })

  // ── « L'interrupteur l'éteint ; recliquer la rallume » ─────────────────────

  test("l'interrupteur éteint la place, et la rallume", async () => {
    const { cadre, appels } = await ouvrirLesTables()
    await ouvrirLaTable(cadre, "détourage")

    // Allumée au départ : la pastille le dit, et elle ne le dit qu'une fois.
    expect(etatDe(cadre, "détourage")).toBe("posee")
    expect(interrupteur(cadre).getAttribute("aria-pressed")).toBe("false")

    fireEvent.click(interrupteur(cadre))
    await waitFor(() =>
      expect(recettesPosees(appels).at(-1)?.veille).toEqual(["detourage"]),
    )
    await waitFor(() => expect(etatDe(cadre, "détourage")).toBe("endormie"))

    fireEvent.click(interrupteur(cadre))
    await waitFor(() => expect(recettesPosees(appels).at(-1)?.veille).toEqual([]))
    await waitFor(() => expect(etatDe(cadre, "détourage")).toBe("posee"))
  })

  test("éteindre garde les réglages, et n'éteint que la place visée", async () => {
    // **C'est toute la différence avec *Sans cette table ›***, qui vide la
    // place. Une passe qu'on a réglée pendant dix minutes ne doit pas être le
    // prix à payer pour regarder l'image sans elle.
    const { cadre, appels } = await ouvrirLesTables()
    await ouvrirLaTable(cadre, "détourage")

    fireEvent.click(interrupteur(cadre))
    const posee = await waitFor(() => {
      const derniere = recettesPosees(appels).at(-1)
      if (!derniere?.veille.length) throw new Error("rien n'a été endormi")
      return derniere
    })

    expect(posee.passes).toEqual([PASSE])
    expect(posee.grille?.cible).toBe(64)
    // La grille dort-elle aussi ? Non : on n'a touché qu'une place.
    expect(posee.veille).toEqual(["detourage"])
    expect(etatDe(cadre, "grille")).toBe("posee")
  })

  // ── « Éteinte et vide sont deux états, pas un » ────────────────────────────

  test("la pastille d'une place éteinte se distingue d'une pastille creuse", async () => {
    const { cadre } = await ouvrirLesTables(["detourage"])

    expect(etatDe(cadre, "détourage")).toBe("endormie")
    // Nettoyer n'a rien : sa pastille est creuse.
    expect(etatDe(cadre, "bords")).toBe("vide")
    // Et la grille, qui agit, porte le troisième état.
    expect(etatDe(cadre, "grille")).toBe("posee")

    // **Une fabrique n'a pas d'interrupteur** : elle n'a pas de place à
    // éteindre, elle fabrique d'autres fichiers.
    await ouvrirLaTable(cadre, "superposition")
    await waitFor(() =>
      expect(cadre.queryByRole("button", { name: /L'endormir|La réveiller/ })).toBeNull(),
    )
  })

  test("une place éteinte garde sa valeur sous les yeux", async () => {
    // **Cacher la valeur pendant qu'elle dort la ferait croire perdue**, et
    // c'est exactement ce que la veille promet de ne pas faire. Elle se lit sous
    // le nom de la table ouverte, à côté de son état.
    //
    // ⚠️ **Elle n'est plus barrée** (`B25`) : l'ancien écran rayait la valeur
    // d'une place endormie, le neuf écrit « endormie, réglages gardés » devant.
    const { cadre } = await ouvrirLesTables(["grille"])
    await ouvrirLaTable(cadre, "grille")
    const dit = await cadre.findByText(/endormie, réglages gardés · 64 px · 100 %/)
    expect(dit).toBeTruthy()
  })

  // ── « Ouvrir une table éteinte montre une colonne éteinte » ────────────────

  test("ouvrir une table éteinte le dit, avec le geste pour la rallumer", async () => {
    const { cadre, appels } = await ouvrirLesTables(["grille"])

    await ouvrirLaTable(cadre, "grille")
    const panneau = await waitFor(() => {
      const trouve = document.querySelector("[data-reglages-de-la-table]")
      if (!trouve) throw new Error("le panneau ne s'est pas ouvert")
      return trouve as HTMLElement
    })
    await waitFor(() =>
      expect(panneau.textContent).toContain("ses réglages sont gardés"),
    )

    fireEvent.click(within(panneau).getByRole("button", { name: "La réveiller" }))
    await waitFor(() => expect(recettesPosees(appels).at(-1)?.veille).toEqual([]))
    await waitFor(() =>
      expect(panneau.textContent).not.toContain("ses réglages sont gardés"),
    )
  })

  // ⚠️ **« Toucher un réglage la rallume » est parti avec l'ancien écran**
  // (`B25`). Il portait deux essais : le réglage qui réveille en un seul envoi,
  // et l'annonce (`[data-table-reveillee]`) qui s'efface au changement de table.
  // La chaîne redessinée remplace les réglages d'une table endormie par la
  // phrase « endormie : ses réglages sont gardés » — il n'y a donc plus de
  // réglage à toucher, et le réveil passe par l'interrupteur. Noté dans
  // `docs/PLAN-carnet.md` § `B27`.
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
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
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
    const bouton = cadre.getByRole("button", { name: /[Rr]ecettes/ })
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
      expect(document.querySelector("[data-retouche]")).not.toBeNull(),
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

    // **Le collage passe par l'aperçu depuis `B24`** — il se déclare
    // *voyageuse* et c'est *Enregistrer* qui écrit, là où il appelait `/paste`
    // directement.
    const collage = await waitFor(() => {
      const trouve = appels
        .filter((a) => a.url.includes("/recipe/preview"))
        .filter((a) => (a.corps as { voyageuse?: boolean })?.voyageuse)
        .pop()
      if (!trouve) throw new Error("rien n'a été collé")
      return trouve
    })
    // **L'écran envoie ce qu'il a sous les yeux, entier.** C'est le serveur qui
    // coupe : deux découpages auraient fini par diverger.
    expect(
      (collage.corps as { recette: Recette }).recette.passes[0].tolerance,
    ).toBe(28)
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
    // Et ce qui a voyagé est arrivé dans la barre : la table du pixel s'allume.
    // **Son résumé se lit sous son nom, et non plus sur la puce** (`B25`) : la
    // retouche écrit la valeur de la table ouverte, une fois, à l'endroit où on
    // la règle. La barre vit dans l'onglet « Retouche » du panneau, à côté de
    // l'onglet « Recettes » : on y passe pour la lire.
    fireEvent.click(cadre.getByRole("button", { name: "Retouche" }))
    await waitFor(() =>
      expect(
        cadre.getByRole("button", { name: /^Pixelisation/ }).getAttribute("data-etat"),
      ).toBe("posee"),
    )
    fireEvent.click(cadre.getByRole("button", { name: /^Pixelisation/ }))
    expect(await cadre.findByText(/32 px · 100 %/)).toBeTruthy()
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
    allerA("Univers")
    fireEvent.click(await screen.findByRole("tab", { name: "Ambiances et couleurs" }))
    fireEvent.click(await screen.findByRole("button", { name: /marais/ }))
    await screen.findByText(/l'aperçu/)
    return double
  }

  const apercus = (appels: { url: string }[]) =>
    appels.filter((a) => a.url.includes("/preview")).length

  const laJauge = () => document.querySelector("[data-attente-palette] span.bg-trait-faible")

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
    allerA("Univers")
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

    fireEvent.click(bouton(/faire une palette de cet îlot/))

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
      expect(leLieu("Ambiances et couleurs")
        .getAttribute("aria-selected")).toBe("true"),
    )
    expect(await screen.findByText(/l'aperçu/)).toBeTruthy()
  })

  test("faire une ambiance fait de même, et l'ambiance porte la palette du paquet", async () => {
    const { appels, etat } = await ouvrirLeMenuDeLIlot()

    fireEvent.click(bouton(/faire une ambiance de cet îlot/))

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

    fireEvent.click(bouton(/faire une palette de cet îlot/))

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
    expect(screen.queryByRole("button", { name: /faire une palette de cet îlot/ })).toBeNull()

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
    allerA("Univers")
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

    fireEvent.click(bouton(/faire une palette de cet îlot/))

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
    const generer = await screen.findByRole("button", { name: BOUTON_DE_RELECTURE })
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
    const generer = await screen.findByRole("button", { name: BOUTON_DE_RELECTURE })
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
    expect(document.body.textContent).toContain("une génération toutes les 15 secondes")
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

// ── RP2 · Rendre les quatre règles du jeu ───────────────────────────────────
//
// **Deux écrans existaient et ne s'ouvraient plus.** Les quatre réglages qui
// partent dans chaque demande d'image — le nom du jeu, son allure, sa vue, son
// monde — ne se réglaient qu'à la création. Et le cadre qui borne la dépense
// d'un agent automatique — plafond d'appels, plafond en argent, droit de payer,
// modèles autorisés — n'avait aucune porte : **rien ne la bornait depuis
// l'écran.** Le mot *Réglages* de la colonne, lui, ouvrait la machine.
//
// Ces essais tiennent la porte, pas les écrans : chacun d'eux a déjà les siens.

describe("RP2 · une seule porte vers les réglages", () => {
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

  test("« Réglages » ouvre quatre onglets, et le premier rouvre les quatre règles", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // Les quatre onglets de la maquette, dans son ordre.
    for (const nom of [
      "Univers",
      "Moteurs & workflows",
      "Agent MCP",
      "Consommations",
    ])
      expect(await screen.findByRole("button", { name: nom })).toBeTruthy()

    // Et l'onglet ouvert est le premier : les quatre questions du jeu, celles
    // qui partent avec chaque demande d'image. C'est le même écran qu'à la
    // création, dans son autre mode — elles ne sont écrites qu'une fois.
    expect(
      await screen.findByRole("heading", { name: "Réglages" }),
    ).toBeTruthy()
    for (const etape of ["Son nom", "Son allure", "Sa vue", "Son monde"])
      expect(
        screen.getAllByRole("button", { name: new RegExp(etape) }).length,
      ).toBeGreaterThan(0)
  })

  test("l'onglet Agent MCP rouvre le cadre de délégation, et ce qu'on y pose part", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))
    fireEvent.click(await screen.findByRole("button", { name: "Agent MCP" }))

    // Les cinq bornes de l'agent, et elles ne sont nulle part ailleurs.
    expect(
      await screen.findByRole("spinbutton", { name: "Nombre total de générations autorisées" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("spinbutton", { name: "Budget total en dollars" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("checkbox", { name: /Autoriser les générations payantes/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole("checkbox", { name: /Autoriser la vidéo locale/ }),
    ).toBeTruthy()
    // Les modèles autorisés, par type de résultat.
    expect(screen.getByRole("combobox", { name: "Image de référence" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Clip vidéo" })).toBeTruthy()

    // **Ce qui est réglé là part vraiment**, et rien d'autre ne part avec.
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Budget total en dollars" }),
      { target: { value: "2.5" } },
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le cadre du jeu" }),
    )
    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url.endsWith("/delegation") &&
            (a.corps as { plafond_usd?: number } | undefined)?.plafond_usd === 2.5,
        ),
      ).toBe(true),
    )
  })

  test("les deux autres onglets mènent aux écrans qui existaient déjà", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // *Moteurs & workflows* — les clés, la porte de la machine, les méthodes
    // locales. L'installation garde son écran : on y va, on en revient.
    fireEvent.click(await screen.findByRole("button", { name: "Moteurs & workflows" }))
    expect(
      await screen.findByRole("heading", { name: "Les fournisseurs" }),
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Les workflows locaux" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'installation" }))
    expect(
      await screen.findByRole("heading", { name: "L'installation" }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }))
    expect(
      await screen.findByRole("heading", { name: "Les fournisseurs" }),
    ).toBeTruthy()

    // *Consommations* — l'écran des dépenses, tel quel.
    fireEvent.click(screen.getByRole("button", { name: "Consommations" }))
    await waitFor(() => expect(document.querySelector("[data-depenses]")).toBeTruthy())
  })
})

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
    await ouvrirLePanneauDeLAtelier("Moteurs & workflows")
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
    await ouvrirLePanneauDeLAtelier()
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
    allerA("Univers")
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
    expect(fil().textContent).toContain("Univers & toile")
    expect(fil().textContent).toContain("trouvailles")
    expect(fil().textContent).toContain("Découpage")

    // Chaque segment ramène à son étage : *Univers & toile* rend le tableau.
    fireEvent.click(within(fil()).getByRole("button", { name: "Univers & toile" }))
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

    expect(await screen.findByRole("button", { name: "Supprimer" })).toBeTruthy()
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

    // Les deux rectangles proposés sont là avant qu'on ait touché un réglage.
    expect(
      await screen.findByRole("button", { name: "Extraire 2 images" }),
    ).toBeTruthy()

    // La relecture montre ce qui va sortir avant de créer quoi que ce soit.
    fireEvent.click(screen.getByRole("button", { name: "Extraire 2 images" }))
    fireEvent.click(await screen.findByRole("button", { name: "Créer ces résultats" }))

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
    await screen.findByRole("button", { name: "Extraire 2 images" })

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

    fireEvent.click(screen.getByRole("button", { name: "Extraire 1 image" }))
    fireEvent.click(await screen.findByRole("button", { name: "Créer ces résultats" }))
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

    allerA("Galerie")
    allerA("Univers")

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
    allerA("Galerie")

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
    allerA("Galerie")
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
    allerA("Galerie")
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
    allerA("Galerie")
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
    allerA("Galerie")
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
    allerA("Galerie")

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
    allerA("Galerie")
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
    allerA("Galerie")
    await ouvrirLeChoix(attendue)

    fireEvent.click(sujets()[8])
    fireEvent.click(garder())

    await waitFor(() => expect(sujets()).toHaveLength(0))
    expect(screen.queryByText("Ce que la planche a rendu")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  A9 — commander un clip, et l'attendre
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ce que ces essais mesurent, et ce qu'ils ne mesurent pas.** Ils mesurent ce
// que l'écran montre et ce qu'il envoie : l'image de départ proposée, le texte
// anglais lu avant l'envoi, le prix du lot, ce qui est grisé et pourquoi. Ils
// ne mesurent rien de ce qui se passe après le clic — la dépense écrite avant
// le fichier, le clip qui survit à la fermeture de l'atelier, le montant relu
// chez le fournisseur : cette moitié-là est tenue par `tests/test_a9.py`, sur
// le vrai service et sur le disque, et la rejouer ici sur un double ne
// prouverait que la qualité du double.

describe("A9 — commander un clip", () => {
  // Le même montage que le reste du fichier. **Ce bloc est un frère, pas un
  // fils** : il ne parle d'aucun des trois onglets, il parle d'un écran qui les
  // recouvre — et il pose donc lui-même le double du flux et la mesure.
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

  /** Ouvrir l'écran du clip depuis une case de l'établi.
   *
   *  **C'est la seule porte, et c'est voulu** : on anime *une case*, et la case
   *  est ce qui décide de l'image de départ proposée. Une porte posée ailleurs
   *  aurait ouvert l'écran sans savoir ce qu'on anime. */
  const ouvrirLeClip = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    bouton = "Animer marche",
  ) => {
    const double = serveurDouble({
      personnages: [personnage("Le nain", { description: "un forgeron nain" })],
      ...options,
    })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli()
    fireEvent.click(ecran.getByRole("button", { name: bouton }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-clip]")
      if (!cadre) throw new Error("l'écran du clip ne s'est pas ouvert")
      return cadre as HTMLElement
    })
    return { ...double, panneau: within(panneau) }
  }

  // ── « L'écran de commande existe » ────────────────────────────────────────

  test("l'écran porte l'image de départ, le mouvement, les modèles et le montant", async () => {
    const { panneau } = await ouvrirLeClip()

    // L'image de départ, avec la raison de ce choix-là — jamais un cadre muet.
    expect(await panneau.findByAltText("le nain, de profil")).toBeTruthy()
    expect(panneau.getByText(/la première image qu'il montre de lui/)).toBeTruthy()

    // Le modèle gratuit est en tête et présélectionné (V3.01.2) : le bouton
    // porte son temps avant qu'on ait rien choisi.
    expect(await panneau.findByText("Wan 2.2 · sur votre machine")).toBeTruthy()
    expect(
      panneau.getByRole("button", { name: /Commander ce clip · ≈ 2 min/ }),
    ).toBeTruthy()

    // Choisir un payant, et son prix **et la formule qui le produit** se
    // déplient d'un geste à eux.
    fireEvent.click(panneau.getByRole("button", { name: "Choisir Seedance 2.0 Mini" }))
    fireEvent.click(
      panneau.getByRole("button", {
        name: "déplier ce qu'on sait de Seedance 2.0 Mini",
      }),
    )
    await panneau.findByText("Seedance 2.0 Mini")
    expect(panneau.getByText(/27 000 jetons/)).toBeTruthy()

    // Et le bouton porte le montant, pas seulement le verbe.
    expect(panneau.getByRole("button", { name: /Commander ce clip · ≈ \$0,0945/ })).toBeTruthy()
  })

  // ── « Un modèle proposé sans avoir été assez mesuré le dit » (US-440) ─────

  test("la mesure de chaque modèle se déplie là où on le choisit", async () => {
    const { panneau } = await ouvrirLeClip()

    // La mesure de Seedance vit dans le pli de sa carte (V3.01.2) : repliée,
    // la carte ne montre que le nom et l'estimation, et le pli se déplie d'un
    // geste à lui — le même geste que partout ailleurs dans le produit.
    fireEvent.click(
      panneau.getByRole("button", {
        name: "déplier ce qu'on sait de Seedance 2.0 Mini",
      }),
    )
    expect(
      await panneau.findByText(/Sous la barre des 8 tirages/),
    ).toBeTruthy()

    // Et celui dont on ne sait rien l'écrit dans son pli aussi, plutôt que de
    // laisser un blanc qui se lirait comme une absence de réserve. Il est
    // grisé — donc masqué par le filtre, allumé par défaut — et il faut
    // l'éteindre pour le revoir, avec sa raison.
    fireEvent.click(panneau.getByRole("button", { name: /seulement ce qui peut partir/ }))
    fireEvent.click(
      panneau.getByRole("button", { name: "déplier ce qu'on sait de Aleph 2" }),
    )
    expect(
      panneau.getByText(/ce dépôt n'a encore rien mesuré de ce modèle/),
    ).toBeTruthy()
  })

  test("le filtre masque les modèles qui ne peuvent pas partir, et l'éteindre les rend à lire", async () => {
    // **Le cas d'école du filtre** (V3.01.2) : un atelier sans clé a vingt-huit
    // cartes grisées qui avalteraient la liste. Allumé, il ne montre que ce
    // qui peut partir — rien de plus, et le compte des masqués se lit sur le
    // bouton même.
    const { panneau } = await ouvrirLeClip()

    const filtre = panneau.getByRole("button", { name: /seulement ce qui peut partir/ })
    expect(filtre.getAttribute("aria-pressed")).toBe("true")
    expect(panneau.getByText(/1 masqué/)).toBeTruthy()
    expect(panneau.queryByRole("button", { name: "Choisir Aleph 2" })).toBeNull()

    // Éteint, il reparaît — **grisé, avec sa raison** : ce qui est impossible
    // se voit avant d'être choisi, et le dépliage de sa carte est resté
    // possible là où le choix est interdit.
    fireEvent.click(filtre)
    expect(filtre.getAttribute("aria-pressed")).toBe("false")
    const aleph = panneau.getByRole("button", { name: "Choisir Aleph 2" })
    expect((aleph as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(
      panneau.getByRole("button", { name: "déplier ce qu'on sait de Aleph 2" }),
    )
    expect(panneau.getByText(/son prix n'a pas pu être relu/)).toBeTruthy()
  })

  // ── « Le mouvement se choisit dans la liste d'A6, et le texte qui part se
  //     lit avant l'envoi » ──────────────────────────────────────────────────

  test("le texte anglais se lit avant l'envoi, et c'est celui de la bibliothèque", async () => {
    const { panneau } = await ouvrirLeClip()

    // La case visée est *marche* : c'est le mouvement du même nom qui est
    // proposé, sans qu'on ait relié quoi que ce soit.
    await waitFor(() =>
      expect(
        (panneau.getByLabelText("Le mouvement") as HTMLSelectElement).value,
      ).toBe("marche"),
    )
    const texte = document.querySelector("[data-texte-du-clip]")
    expect(texte?.textContent).toBe(
      "walking cycle, full body, walking in place, looping seamlessly",
    )
  })

  test("l'écran envoie le mouvement, pas le texte qu'il vient d'afficher", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    await panneau.findByText("Seedance 2.0 Mini")
    fireEvent.click(
      panneau.getByRole("button", { name: /Commander ce clip/ }),
    )
    // **Le tiroir de relecture s'intercale (V3.01.1).** C'est son bouton qui
    // part, pas celui de l'écran de commande, et l'auteur le traverse comme
    // l'écran de confirmation du début de l'atelier.
    const tiroir = await waitFor(() => {
      const cadre = document.querySelector("[data-confirmation-clip]")
      if (!cadre) throw new Error("le tiroir ne s'est pas ouvert")
      return within(cadre as HTMLElement)
    })
    fireEvent.click(tiroir.getByRole("button", { name: /Commander ce clip/ }))

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/clips")?.corps as
        | { mouvement?: string; asset?: string; prompt?: string }
        | undefined
      // **Le mouvement, et l'image de départ.** Le texte anglais, lui, n'est
      // écrit qu'à un seul endroit — la bibliothèque de mouvements —, et le
      // serveur va l'y chercher. Deux chemins vers le même texte finiraient
      // par en envoyer un troisième, et c'est un appel payé qui le dirait.
      expect(parti?.mouvement).toBe("marche")
      expect(parti?.asset).toBe("aaaa1111-0")
      expect(parti?.prompt).toBeUndefined()
    })
  })

  // ── « Le nombre de clips se choisit à chaque fois — un est le défaut —, et
  //     le prix du lot s'annonce avant » ─────────────────────────────────────

  test("le prix annoncé est celui du lot, et le lot part en autant de clips", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    // Le gratuit est présélectionné ; on choisit le payant pour lire le
    // montant, comme l'auteur le ferait.
    await panneau.findByText("Wan 2.2 · sur votre machine")
    fireEvent.click(panneau.getByRole("button", { name: "Choisir Seedance 2.0 Mini" }))
    // Un par défaut, sans qu'on ait rien réglé.
    await waitFor(() =>
      expect(
        panneau.getByRole("button", { name: /Commander ce clip · ≈ \$0,0945/ }),
      ).toBeTruthy(),
    )

    fireEvent.click(panneau.getByRole("button", { name: "4" }))

    // Quatre fois le prix, annoncé **avant** l'envoi — et le tiroir le
    // re-dit, parce que c'est lui qui part.
    await waitFor(() =>
      expect(
        panneau.getByRole("button", { name: /Commander ces 4 clips · ≈ \$0,3780/ }),
      ).toBeTruthy(),
    )
    fireEvent.click(panneau.getByRole("button", { name: /Commander ces 4 clips/ }))
    const tiroir = await waitFor(() => {
      const cadre = document.querySelector("[data-confirmation-clip]")
      if (!cadre) throw new Error("le tiroir ne s'est pas ouvert")
      return within(cadre as HTMLElement)
    })
    expect(
      tiroir.getByRole("button", { name: /Commander ces 4 clips · ≈ \$0,3780/ }),
    ).toBeTruthy()
    expect(tiroir.getByText(/chacun se paie/)).toBeTruthy()
    fireEvent.click(tiroir.getByRole("button", { name: /Commander ces 4 clips/ }))
    await waitFor(() =>
      expect(
        (appels.find((a) => a.url === "/api/clips")?.corps as { nombre?: number })
          ?.nombre,
      ).toBe(4),
    )
  })

  test("le prix se recalcule quand le format change, et il ne se garde pas", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    await panneau.findByText("Seedance 2.0 Mini")
    fireEvent.click(panneau.getByRole("button", { name: "grand format" }))

    // **Le catalogue se redemande avec le réglage courant** : un prix vidéo
    // dépend de la surface, et un catalogue chiffré une fois annoncerait le
    // prix d'autre chose que ce qu'on va demander.
    await waitFor(() =>
      expect(
        appels.some((a) => a.url.includes("/clips/models") && a.url.includes("720p")),
      ).toBe(true),
    )
  })

  // ── « L'image de départ se propose et se change » ─────────────────────────

  test("n'importe quelle image de la bibliothèque remplace la proposition, d'un clic", async () => {
    const autre = asset("bbbb2222-0", "un nain accroupi")
    const { panneau, appels } = await ouvrirLeClip({ assets: [autre] })

    await panneau.findByAltText("le nain, de profil")
    fireEvent.click(panneau.getByRole("button", { name: "changer d'image ›" }))
    fireEvent.click(await panneau.findByRole("button", { name: "un nain accroupi" }))

    // Ce que l'écran dit change avec ce qu'il montre : la raison du serveur ne
    // décrit plus l'image qu'on regarde, donc elle cède la place.
    expect(await panneau.findByText(/choisie à la main/)).toBeTruthy()

    fireEvent.click(panneau.getByRole("button", { name: /Commander ce clip/ }))
    const tiroir = await waitFor(() => {
      const cadre = document.querySelector("[data-confirmation-clip]")
      if (!cadre) throw new Error("le tiroir ne s'est pas ouvert")
      return within(cadre as HTMLElement)
    })
    fireEvent.click(tiroir.getByRole("button", { name: /Commander ce clip/ }))
    await waitFor(() =>
      expect(
        (appels.find((a) => a.url === "/api/clips")?.corps as { asset?: string })
          ?.asset,
      ).toBe("bbbb2222-0"),
    )
  })

  test("un personnage sans la moindre image dit pourquoi, et le bouton reste fermé", async () => {
    const { panneau } = await ouvrirLeClip({
      imageDeDepart: {
        asset: null,
        origine: "aucune",
        raison:
          "« Le nain » n'a encore aucune image. Choisissez-en une dans la " +
          "bibliothèque : un clip part toujours d'une image.",
      },
    })

    expect(await panneau.findByText(/n'a encore aucune image/)).toBeTruthy()
    expect(panneau.getByText("aucune image")).toBeTruthy()
    await waitFor(() =>
      expect(
        (panneau.getByRole("button", { name: /Commander/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    )
    // Le grisé porte sa raison, comme partout — et c'est celle du serveur,
    // qui nomme le personnage, pas une phrase réécrite ici.
    expect(
      panneau.getAllByText(/un clip part toujours d'une image/).length,
    ).toBeGreaterThan(0)
  })

  // ── Rien ne part tant qu'on n'a pas appuyé ────────────────────────────────

  test("ouvrir l'écran ne dépense rien, et Échap le referme sans rien envoyer", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    await panneau.findByText("Seedance 2.0 Mini")
    expect(appels.some((a) => a.url === "/api/clips")).toBe(false)

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(document.querySelector("[data-clip]")).toBeNull())
    expect(appels.some((a) => a.url === "/api/clips")).toBe(false)
  })

  // ── V3.01.1 — le tiroir « ce qui part avec ce clip » ──────────────────────
  //
  // **Ce que ces essais mesurent, et ce qu'ils ne mesurent pas.** Ils mesurent
  // l'entre-deux que la tranche instaure : le bouton de l'écran de commande
  // n'envoie plus, le tiroir s'intercale, sa relecture montre ce qui part et
  // permet de le corriger — et c'est son bouton qui paie. La résolution
  // serveur — le texte corrigé prime, le mouvement reste inscrit — est tenue
  // par `tests/test_v301.py`, sur le vrai service.

  /** Ouvrir le tiroir depuis l'écran du clip, et y revenir. */
  const ouvrirLeTiroir = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = await ouvrirLeClip(options)
    const { panneau } = double
    // Le gratuit est présélectionné ; on demande le payant pour que le tiroir
    // porte un montant, et l'on revient sur une carte repliée.
    await panneau.findByText("Wan 2.2 · sur votre machine")
    fireEvent.click(panneau.getByRole("button", { name: "Choisir Seedance 2.0 Mini" }))
    fireEvent.click(panneau.getByRole("button", { name: /Commander ce clip/ }))
    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-confirmation-clip]")
      if (!trouve) throw new Error("le tiroir ne s'est pas ouvert")
      return trouve as HTMLElement
    })
    return { ...double, tiroir: within(cadre) }
  }

  test("le bouton ouvre le tiroir au lieu d'envoyer, et rien ne part dans l'attente", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    await panneau.findByText("Wan 2.2 · sur votre machine")
    const appelsAvant = appels.length
    fireEvent.click(panneau.getByRole("button", { name: /Commander ce clip/ }))

    // Le tiroir est là, l'écran de commande a cédé la place, et **aucun appel
    // n'est parti** : c'est le bouton du tiroir qui paie, pas celui-ci.
    const tiroir = await waitFor(() => {
      const cadre = document.querySelector("[data-confirmation-clip]")
      if (!cadre) throw new Error("le tiroir ne s'est pas ouvert")
      return within(cadre as HTMLElement)
    })
    expect(document.querySelector("[data-clip]")).toBeNull()
    // ⚠️ Et pas un seul appel nouveau, même sans dépenser : le tiroir est fait
    // de ce que l'écran avait déjà relu — c'est la version *réseau coupé* de ce
    // qui se vérifie ici.
    expect(appels.length).toBe(appelsAvant)
    // Le modèle présélectionné — le gratuit — porte son temps jusque dans le
    // tiroir : la même annonce doit se lire au-dessus et ici.
    expect(
      tiroir.getByRole("button", { name: /Commander ce clip · ≈ 2 min/ }),
    ).toBeTruthy()
  })

  test("le tiroir montre le texte mot pour mot, et l'image qui ne se retire pas", async () => {
    const { tiroir } = await ouvrirLeTiroir()

    // Le texte exact, mot pour mot — celui que le serveur enverra.
    const pavé = tiroir.getByText(
      "walking cycle, full body, walking in place, looping seamlessly",
    )
    expect(pavé).toBeTruthy()
    // L'image de départ est là, avec la raison « obligatoire » en toutes
    // lettres — et **aucun interrupteur pour la retirer** : un modèle vidéo
    // n'en accepte qu'une, et proposer un interrupteur qui ne voudrait rien
    // dire serait un mensonge de forme.
    expect(tiroir.getByText(/elle est obligatoire et ne cède jamais/)).toBeTruthy()
    expect(tiroir.queryByRole("button", { name: /Éteindre/ })).toBeNull()
    expect(tiroir.queryByRole("button", { name: /ne pas l'envoyer/ })).toBeNull()
    // Elle se change, en revanche, depuis le tiroir même.
    expect(tiroir.getByRole("button", { name: "changer d'image ›" })).toBeTruthy()
  })

  test("corriger le texte vaut pour cet appel et rien d'autre", async () => {
    const { tiroir, appels } = await ouvrirLeTiroir()

    fireEvent.click(tiroir.getByRole("button", { name: "corriger" }))
    const corrige =
      "marcher sur place, en boucle, sans traverser le cadre — plus lentement."
    fireEvent.change(tiroir.getByLabelText("Corriger le texte du clip, pour cette génération"), {
      target: { value: corrige },
    })
    // Le tiroir le dit : la correction ne remonte nulle part.
    expect(tiroir.getByText(/corrigé pour cette génération seulement/)).toBeTruthy()

    fireEvent.click(tiroir.getByRole("button", { name: /Commander ce clip/ }))
    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/clips")?.corps as
        | { prompt?: string; mouvement?: string }
        | undefined
      // **Le texte corrigé part, et le mouvement avec** : le serveur inscrit
      // la filiation que le montage lira, texte corrigé ou non.
      expect(parti?.prompt).toBe(corrige)
      expect(parti?.mouvement).toBe("marche")
    })
  })

  test("remettre le texte du mouvement le redonne intact, et seul le mouvement part", async () => {
    const { tiroir, appels } = await ouvrirLeTiroir()

    fireEvent.click(tiroir.getByRole("button", { name: "corriger" }))
    fireEvent.change(tiroir.getByLabelText("Corriger le texte du clip, pour cette génération"), {
      target: { value: "un texte corrigé, qu'on rejette ensuite" },
    })
    fireEvent.click(tiroir.getByRole("button", { name: "remettre le texte du mouvement" }))

    // Le pavé est revenu au texte de la bibliothèque — rien de la correction
    // ne traîne.
    expect(
      tiroir.getByText("walking cycle, full body, walking in place, looping seamlessly"),
    ).toBeTruthy()
    expect(tiroir.queryByText(/corrigé pour cette génération/)).toBeNull()

    fireEvent.click(tiroir.getByRole("button", { name: /Commander ce clip/ }))
    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/clips")?.corps as
        | { prompt?: string; mouvement?: string }
        | undefined
      // **Sans correction, le serveur relit le mouvement** (A6) : le texte
      // anglais n'a qu'un seul endroit où il s'écrit.
      expect(parti?.prompt).toBeUndefined()
      expect(parti?.mouvement).toBe("marche")
    })
  })

  test("vider la correction éteint le bouton du tiroir, avec sa raison", async () => {
    const { tiroir, appels } = await ouvrirLeTiroir()

    fireEvent.click(tiroir.getByRole("button", { name: "corriger" }))
    fireEvent.change(tiroir.getByLabelText("Corriger le texte du clip, pour cette génération"), {
      target: { value: "" },
    })

    await waitFor(() =>
      expect(
        (tiroir.getByRole("button", { name: /Commander ce clip/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    )
    // Et la raison est celle du produit : un clip part d'un texte.
    expect(tiroir.getByText(/part d'un texte/)).toBeTruthy()
    expect(appels.some((a) => a.url === "/api/clips")).toBe(false)
  })

  test("Échap referme le tiroir, rend l'écran de commande, et ne dépense rien", async () => {
    const { tiroir, appels } = await ouvrirLeTiroir()

    // Le tiroir est ouvert (le bouton qui part s'y trouve, pas dans l'écran
    // de commande) avant qu'Échap ne le referme.
    expect(tiroir.getByRole("button", { name: /Commander ce clip · ≈ \$0,0945/ })).toBeTruthy()

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(document.querySelector("[data-confirmation-clip]")).toBeNull())
    // L'écran de commande est revenu — Échap n'a refermé qu'un niveau.
    expect(document.querySelector("[data-clip]")).toBeTruthy()
    expect(appels.some((a) => a.url === "/api/clips")).toBe(false)
  })

  // ── « La galerie montre un clip par une image prélevée dedans » ───────────

  test("un clip arrivé garde sa place dans la galerie et montre une image prise dedans", async () => {
    const { fetchDouble } = serveurDouble({
      personnages: [personnage("Le nain")],
    })
    const flux = await monter(fetchDouble)
    // **La galerie range les médias en onglets** : un clip vit sous *Vidéos*,
    // et la grille des images ne le montre plus. Ce qu'il garde est sa place
    // dans la galerie, pas dans la planche contact des images.
    await allerAuxVideos()

    flux.emettre("generation", clipRendu("clip-a", false))

    // **Il garde sa place** : un clip n'entre pas en bibliothèque, donc aucun
    // asset ne viendrait le remplacer, et sans cette place sa tuile
    // disparaîtrait à la seconde où il arrive.
    const image = await screen.findByRole("img", {
      name: "walking cycle, walking in place",
    })
    // B22 : la tuile demande la couverture fabriquée par le serveur — une
    // frame réduite, jamais le fichier entier — et non plus une frame à
    // résolution native.
    expect(image.getAttribute("src")).toBe("/api/clips/clip-a/cover?cote=256")
    // Et il dit ce qu'il porte et ce qu'il a coûté.
    expect(screen.getByText("121 images · 24 i/s")).toBeTruthy()
    expect(screen.getByText("$0,0670")).toBeTruthy()
  })

  // ── « B22 — un clip reste un habitant de la galerie, pas un feu de paille
  //     du chantier » ──────────────────────────────────────────────────────

  test("un clip relu depuis le dépôt garde sa place même quand le chantier ne le voit plus, et n'y télécharge aucune vidéo", async () => {
    const image = asset("aaaa1111-0", "une image")
    const { fetchDouble, appels } = serveurDouble({
      assets: [image],
      // **Relu, pas vu arriver** : aucun événement « generation » n'est émis
      // dans cet essai — c'est exactement ce qui se passe une fois le lot
      // fermé, quand le chantier ne tient plus rien et que seul
      // `GET /api/clips` en parle encore.
      clipsDuJeu: [clipRendu("clip-a", false)],
    })
    await monter(fetchDouble, { ...ETAT, assets: [image] })
    allerA("Galerie")

    // Les images d'un côté : le clip n'y est pas, et c'est l'onglet qui le dit.
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    expect(screen.queryByRole("img", { name: "walking cycle, walking in place" })).toBeNull()

    // Le clip de l'autre, **et il y est** : c'est ce que cet essai mesure.
    await allerAuxVideos()
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    expect(
      await screen.findByRole("img", { name: "walking cycle, walking in place" }),
    ).toBeTruthy()

    // **Aucune vidéo ne part à l'ouverture de la galerie** — seule la
    // couverture, réduite, a été demandée (vérifié plus haut sur son `src`).
    expect(appels.some((a) => a.url.includes("/video"))).toBe(false)
  })

  test("le filtre « clips » isole les clips des images de la bibliothèque, et distinctement des familles", async () => {
    const image = asset("aaaa1111-0", "une image")
    const { fetchDouble } = serveurDouble({
      assets: [image],
      clipsDuJeu: [clipRendu("clip-a", false)],
    })
    await monter(fetchDouble, { ...ETAT, assets: [image] })
    allerA("Galerie")

    // **L'isolement est devenu structurel** : les clips ont leur onglet, et la
    // grille des images n'en montre aucun. Ce que le filtre « clips » faisait à
    // la main, l'onglet le fait par construction — et le fait mesuré est le
    // même : on ne juge jamais un clip au milieu des images.
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    expect(screen.getByRole("img", { name: "une image" })).toBeTruthy()
    expect(screen.queryByRole("img", { name: "walking cycle, walking in place" })).toBeNull()

    await allerAuxVideos()
    await waitFor(() => expect(tuiles()).toHaveLength(1))
    expect(screen.getByRole("img", { name: "walking cycle, walking in place" })).toBeTruthy()
    expect(screen.queryByRole("img", { name: "une image" })).toBeNull()

    // **Et les familles restent distinctes des médias** : côté images, le
    // filtre par famille écarte ce qui n'est pas d'elle, et il ne décide rien
    // des clips — qui n'appartiennent à aucune famille.
    await allerAuxImages()
    const filtre = screen.getByLabelText("Ne montrer qu'une famille, ou les clips")
    fireEvent.change(filtre, { target: { value: "personnages" } })
    await waitFor(() => expect(tuiles()).toHaveLength(0))

    await allerAuxVideos()
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    await allerAuxImages()
    fireEvent.change(
      screen.getByLabelText("Ne montrer qu'une famille, ou les clips"),
      { target: { value: "" } },
    )
    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })

  test("garder un clip et jeter les autres est un seul geste, et il s'annule", async () => {
    const { fetchDouble, appels } = serveurDouble({
      personnages: [personnage("Le nain")],
    })
    const flux = await monter(fetchDouble)
    await allerAuxVideos()

    flux.emettre("generation", clipRendu("clip-a", false))
    flux.emettre("generation", clipRendu("clip-b", false))
    flux.emettre("generation", clipRendu("clip-c", false))

    // Le bouton dit combien il jette, et il ne paraît que s'il y a de quoi.
    const garder = await screen.findAllByRole("button", {
      name: "Garder celui-ci · jeter 2 autres",
    })
    expect(garder).toHaveLength(3)
    fireEvent.click(garder[0])

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/clips/keep")?.corps as
        | { garde?: string; jette?: string[] }
        | undefined
      // **Un gardé, les deux autres écartés** — et lequel dépend de la tuile
      // cliquée, pas de l'ordre où le flux les a posés. Écrire un identifiant
      // en dur ferait passer l'ordre de la grille pour une règle.
      expect(parti?.jette).toHaveLength(2)
      expect([parti?.garde, ...(parti?.jette ?? [])].sort()).toEqual([
        "clip-a",
        "clip-b",
        "clip-c",
      ])
    })

    // **Et le compte rendu porte le geste qui rend**, avec la phrase qui dit où
    // l'argent est resté.
    const rendre = await screen.findByRole("button", { name: "les rendre" })
    expect(screen.getByText(/restent au journal des dépenses/)).toBeTruthy()
    fireEvent.click(rendre)
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/clips/restore")).toBe(true),
    )
  })

  test("un clip jeté quitte la galerie, et un clip seul ne propose pas de jeter", async () => {
    const { fetchDouble } = serveurDouble({
      personnages: [personnage("Le nain")],
    })
    const flux = await monter(fetchDouble)
    await allerAuxVideos()

    flux.emettre("generation", clipRendu("clip-a", false))
    await screen.findByText("121 images · 24 i/s")
    // Seul de son lot, il n'a rien à jeter : le bouton ne paraît pas.
    expect(
      screen.queryByRole("button", { name: /Garder celui-ci/ }),
    ).toBeNull()

    flux.emettre("generation", clipRendu("clip-a", true))
    await waitFor(() =>
      expect(screen.queryByText("121 images · 24 i/s")).toBeNull(),
    )
  })
})

describe("A10 — découper un clip en bandes", () => {
  // Même montage que le bloc d'`A9`, et pour la même raison : cet écran-ci ne
  // parle d'aucun des trois onglets. Il prend la place de la grille dans la
  // galerie, comme l'écran du choix d'une planche.
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

  /** Ouvrir le montage depuis la tuile du clip, **la seule porte**.
   *
   *  Un clip se découpe là où on le regarde. Une entrée de menu ou un quatrième
   *  onglet auraient ouvert l'écran sans savoir quel clip, et auraient demandé
   *  de le rechoisir dans une liste. */
  const ouvrirLeMontage = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({
      personnages: [personnage("Le nain")],
      ...options,
    })
    const flux = await monter(double.fetchDouble)
    await allerAuxVideos()
    flux.emettre("generation", clipRendu("clip-a", false))
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-montage]")
      if (!cadre) throw new Error("l'écran de montage ne s'est pas ouvert")
      return cadre as HTMLElement
    })
    return { ...double, flux, panneau: within(panneau) }
  }

  // ── « Un clip s'ouvre déjà en train de tourner » ──────────────────────────

  test("l'écran s'ouvre en posant une proposition, sans qu'on règle quoi que ce soit", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    // Un seul aller-retour pour tout ce que l'écran montre.
    expect(
      appels.filter((a) => a.url === "/api/montage/clip-a"),
    ).toHaveLength(1)

    // Et il tourne déjà : la première proposition est posée, donc huit images
    // sont retenues avant le moindre clic. Le montage est brut depuis V3.03 :
    // aucune demande d'aperçu traité ne part de lui.
    expect(await panneau.findByText("8 frames retenues")).toBeTruthy()
    expect(appels.filter((a) => a.url === "/api/montage/preview")).toHaveLength(0)
  })

  test("les deux boucles regardent le brut : le mouvement et les images retenues", async () => {
    const { panneau } = await ouvrirLeMontage()
    expect(await panneau.findByText("le mouvement est-il bon ?")).toBeTruthy()
    expect(panneau.getByText("sont-elles les bonnes ?")).toBeTruthy()
    // À gauche l'image telle que le modèle l'a rendue, fond compris ; à droite
    // la même — rien n'est traité dans le montage (V3.03).
    const brutes = await panneau.findAllByAltText(/^Image \d+ du clip$/)
    expect(brutes.length).toBe(2)
    expect(brutes[0].getAttribute("src")).toMatch(
      /^\/api\/clips\/clip-a\/frames\/\d+$/,
    )
    await waitFor(() =>
      expect(document.querySelector("[data-case-de-la-planche]")).toBeNull(),
    )
  })

  // ── « Les deux propositions ne décident de rien » ─────────────────────────

  test("les propositions s'affichent avec leur phrase, et posent un découpage sans le figer", async () => {
    const { panneau } = await ouvrirLeMontage()

    expect(await panneau.findByText(/il ne bouge presque pas/)).toBeTruthy()
    fireEvent.click(panneau.getByText(/la boucle se referme le mieux/))

    // Ce que la proposition pose se lit sur la pellicule — et le montage ne
    // demande aucune aperçu traité (V3.03).
    await waitFor(() =>
      expect(panneau.getAllByRole("button", { name: /— retenue$/ })).toHaveLength(6),
    )
    expect(panneau.getByText(/Elles ne décident de rien/)).toBeTruthy()
  })

  test("repartir de zéro ne garde aucune image, et le dit", async () => {
    const { panneau } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")
    fireEvent.click(panneau.getByText(/ne garder aucune image/))
    expect(await panneau.findByText(/aucune frame retenue/)).toBeTruthy()
  })

  // ── « Chaque image se prend ou se laisse d'un clic » ──────────────────────

  test("un clic sur la pellicule prend une image, un second la laisse", async () => {
    const { panneau } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")

    // L'image 0 n'est pas dans la proposition : le clic l'ajoute. La sélection
    // se lit sur la pellicule — le montage est brut, il ne demande pas d'aperçu.
    fireEvent.click(panneau.getByRole("button", { name: "Image 0" }))
    await waitFor(() =>
      expect(panneau.getAllByRole("button", { name: /— retenue$/ })).toHaveLength(9),
    )

    // Et l'image 4, qui y est, en sort.
    fireEvent.click(panneau.getByRole("button", { name: "Image 4 — retenue" }))
    await waitFor(() =>
      expect(panneau.getAllByRole("button", { name: /— retenue$/ })).toHaveLength(8),
    )
  })

  test("les images retenues se voient dans l'ordre et se retirent de là", async () => {
    const { panneau } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")
    fireEvent.click(await panneau.findByRole("button", { name: "Retirer l'image 6" }))
    await waitFor(() =>
      expect(panneau.getAllByRole("button", { name: /— retenue$/ })).toHaveLength(7),
    )
  })

  test("la pellicule et la loupe tiennent dans une seule image", async () => {
    const { panneau, appels } = await ouvrirLeMontage()
    const case3 = await panneau.findByRole("button", { name: "Image 3" })
    // La pellicule ne charge pas cent vingt images : elle décale la planche
    // contact, qui est **une seule adresse**.
    expect(case3.querySelector("span")?.getAttribute("style")).toContain(
      "/api/montage/clip-a/contact",
    )
    fireEvent.mouseEnter(case3)
    const loupe = await waitFor(() => {
      const vu = document.querySelector("[data-loupe]")
      if (!vu) throw new Error("la loupe ne paraît pas")
      return vu as HTMLElement
    })
    expect(loupe.getAttribute("style")).toContain("/api/montage/clip-a/contact")
    // Et rien de tout ça n'a demandé les images du clip une par une.
    expect(appels.filter((a) => a.url.includes("/frames/"))).toHaveLength(0)
  })

  // ── « Le cadrage se reprend à la main, et l'écran dit lequel est en usage » ─

  test("le cadre par défaut vient du clip entier, et l'écran dit ce que ça implique", async () => {
    const { panneau } = await ouvrirLeMontage()
    expect(await panneau.findByText(/pris sur le clip entier/)).toBeTruthy()
    expect(
      await panneau.findByText((texte) =>
        texte.startsWith("246 × 381, pris sur"),
      ),
    ).toBeTruthy()
  })

  test("reprendre le cadre est un geste demandé, et il dit ce qu'il coûte", async () => {
    const { panneau, appels } = await ouvrirLeMontage()
    const bouton = await panneau.findByText(/reprendre le cadre sur tout le clip/)
    expect(panneau.getByText(/une vingtaine de secondes/)).toBeTruthy()
    // **Rien ne l'a déclenché tout seul** : c'est le fond de la décision.
    expect(appels.some((a) => a.url.endsWith("/frame"))).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/montage/clip-a/frame")).toBe(true),
    )
  })

  // ── « La recette part de celle du jeu, tout écart est écrit en clair » ────

  test("le traitement a quitté le montage : ni la boucle traitée, ni la recette", async () => {
    const { panneau } = await ouvrirLeMontage()
    // La recette du découpage ne se règle plus ici — le montage taille le
    // mouvement, et le traitement se règle dans l'atelier d'une animation,
    // frame par frame (V3.03).
    expect(
      panneau.queryByLabelText("Taille du pixel, en chiffres"),
    ).toBeNull()
    expect(panneau.queryByText(/Ce que vous changez ici s'écrit/)).toBeNull()
    // La vitesse réglée ici est **toujours** celle qui part dans le jeu.
    const vitesse = panneau
      .getAllByRole("slider")
      .find((rail) => rail.getAttribute("max") === "24")
    expect(vitesse).toBeTruthy()
  })

  test("la vitesse réglée ici est celle qui part", async () => {
    const { panneau, appels } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")
    const vitesse = panneau
      .getAllByRole("slider")
      .find((rail) => rail.getAttribute("max") === "24")
    fireEvent.change(vitesse as HTMLElement, { target: { value: "12" } })
    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "marche" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « marche »/ }))
    await waitFor(() => {
      const parti = appels
        .filter((a) => a.url === "/api/strips")
        .at(-1)?.corps as { cadence?: number } | undefined
      expect(parti?.cadence).toBe(12)
    })
  })

  // ── « Plusieurs bandes se gardent depuis le même clip » ───────────────────

  test("garder une bande la range dans la liste du clip, et rien n'est dépensé", async () => {
    const { panneau, appels } = await ouvrirLeMontage()
    fireEvent.change(await panneau.findByLabelText("Le nom de l'animation"), {
      target: { value: "repos" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « repos »/ }))

    expect(await panneau.findByText("repos")).toBeTruthy()
    expect(panneau.getByText(/Rien sur cet écran ne dépense/)).toBeTruthy()
    // **Aucun appel de génération n'est parti** : c'est ce que la phrase promet.
    expect(appels.filter((a) => a.url === "/api/generations")).toHaveLength(0)
  })

  test("une bande se garde sous un nom, et le bouton dit ce qui manque", async () => {
    const { panneau } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")
    // Le nom arrive proposé — celui du mouvement demandé —, et on peut l'effacer.
    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "" },
    })
    expect(
      panneau.getByRole("button", { name: "nommez cette animation" }),
    ).toBeTruthy()
  })

  test("une bande sans case reste un brouillon, et le dit", async () => {
    const { panneau } = await ouvrirLeMontage({
      montage: {
        ...MONTAGE_RENDU,
        clip: { ...MONTAGE_RENDU.clip, pose: null, direction: null },
      },
    })
    expect(await panneau.findByText(/un brouillon ne bloque rien/)).toBeTruthy()
  })

  // ── « Le prix par bande baisse à chaque bande gardée » ────────────────────

  test("le prix par bande se lit à l'écran, avec ce que la suivante ferait", async () => {
    const { panneau } = await ouvrirLeMontage()
    expect(await panneau.findByText("$0,0670")).toBeTruthy()
    expect(
      panneau.getByText(/Une de plus ferait tomber ce prix à \$0,0335/),
    ).toBeTruthy()
  })

  // ── « Le cadre se règle à la main, ou ne se propose plus » (RP15) ─────────

  /** **À la main veut dire à la main**, pas *noté et sans effet*.
   *
   *  Avant RP15, choisir *à la main* semait le rectangle du clip et
   *  n'offrait ensuite aucun moyen de le corriger : le choix promettait un
   *  réglage qu'aucun contrôle ne tenait. Les quatre champs sont ce qui
   *  manquait — et le mot « du clip » disparaît dès qu'on passe à la main,
   *  pour ne pas dire deux choses à la fois. */
  test("« à la main » sème la fenêtre du clip, et quatre champs la corrigent au clavier", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    fireEvent.click(panneau.getByRole("button", { name: "à la main" }))

    // Semé sur la fenêtre du clip, comme avant RP15 — mais réglable.
    expect(panneau.getByLabelText("Gauche du cadre, en pixels")).toHaveValue(0)
    expect(panneau.getByLabelText("Haut du cadre, en pixels")).toHaveValue(0)
    expect(panneau.getByLabelText("Largeur du cadre, en pixels")).toHaveValue(246)
    expect(panneau.getByLabelText("Hauteur du cadre, en pixels")).toHaveValue(381)
    // La phrase du clip ne paraît plus : elle ne décrit pas ce cadre-ci.
    expect(panneau.queryByText(/pris sur le clip entier/)).toBeNull()

    fireEvent.change(panneau.getByLabelText("Largeur du cadre, en pixels"), {
      target: { value: "300" },
    })
    fireEvent.change(panneau.getByLabelText("Gauche du cadre, en pixels"), {
      target: { value: "10" },
    })

    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "marche" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « marche »/ }))
    await waitFor(() => {
      const parti = appels
        .filter((a) => a.url === "/api/strips")
        .at(-1)?.corps as { cadre?: Record<string, number | string> } | undefined
      // Gauche déplacé à 10 en gardant la largeur qu'on venait de poser (300) :
      // droite suit à 309. C'est ce rectangle-ci, et pas un aperçu, qui part.
      expect(parti?.cadre).toEqual({
        choix: "main", gauche: 10, sommet: 0, droite: 309, bas: 380,
      })
    })
  })

  /** **La mesure automatique ne doit pas effacer un réglage à la main**
   *  (RP15, critère d'acceptation) : remesurer rafraîchit la fenêtre du clip
   *  pour les choix « du clip » et « de l'animation », mais le rectangle posé à
   *  la main reste celui qui sortira, et l'écran continue de le dire. */
  test("remesurer le clip ne touche pas au rectangle posé à la main", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    fireEvent.click(panneau.getByRole("button", { name: "à la main" }))
    fireEvent.change(panneau.getByLabelText("Largeur du cadre, en pixels"), {
      target: { value: "500" },
    })
    expect(panneau.getByLabelText("Largeur du cadre, en pixels")).toHaveValue(500)

    fireEvent.click(await panneau.findByText(/reprendre le cadre sur tout le clip/))
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/montage/clip-a/frame")).toBe(true),
    )

    // La remesure a répondu, mais le champ posé à la main n'en a pas bougé —
    // c'est le critère de la tranche : la mesure automatique ne l'efface pas.
    expect(panneau.getByLabelText("Largeur du cadre, en pixels")).toHaveValue(500)
    expect(panneau.getByText(/C'est ce rectangle qui sort à l'export/)).toBeTruthy()

    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "marche" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « marche »/ }))
    await waitFor(() => {
      const parti = appels
        .filter((a) => a.url === "/api/strips")
        .at(-1)?.corps as { cadre?: Record<string, number | string> } | undefined
      expect(parti?.cadre).toEqual({
        choix: "main", gauche: 0, sommet: 0, droite: 499, bas: 380,
      })
    })
  })

  // ── « Deux champs règlent le pivot » (RP15) ───────────────────────────────

  test("le pivot ne part pas tant que l'auteur n'y a pas touché", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    expect(panneau.getByLabelText("Pivot horizontal, en pixels")).toHaveValue(null)
    expect(panneau.getByText(/l'animation garde le repère de son mouvement/)).toBeTruthy()

    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "marche" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « marche »/ }))
    await waitFor(() => {
      const parti = appels
        .filter((a) => a.url === "/api/strips")
        .at(-1)?.corps as { pivot?: unknown } | undefined
      expect(parti?.pivot).toBeNull()
    })
  })

  test("réglé à la main, le pivot part avec la demande de bande", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    fireEvent.change(panneau.getByLabelText("Pivot horizontal, en pixels"), {
      target: { value: "12" },
    })
    fireEvent.change(panneau.getByLabelText("Pivot vertical, en pixels"), {
      target: { value: "60" },
    })
    expect(panneau.getByText(/posé à la main — gardé avec cette animation/)).toBeTruthy()

    fireEvent.change(panneau.getByLabelText("Le nom de l'animation"), {
      target: { value: "marche" },
    })
    fireEvent.click(panneau.getByRole("button", { name: /Garder « marche »/ }))
    await waitFor(() => {
      const parti = appels
        .filter((a) => a.url === "/api/strips")
        .at(-1)?.corps as { pivot?: { x: number; y: number } } | undefined
      expect(parti?.pivot).toEqual({ x: 12, y: 60 })
    })
  })

  // ── Ce que seul le navigateur avait vu ────────────────────────────────────

  /** **Une couleur qui n'existe pas ne fait pas d'erreur : elle ne fait rien.**
   *
   *  Trouvé en mesurant l'écran dans un vrai navigateur, le 4 septembre 2026 :
   *  les images retenues s'écrivaient `1px solid var(--signal)` et le nom court
   *  n'existe pas — la feuille de style déclare `--color-signal`. L'encadré ne
   *  s'était donc **jamais** dessiné, et le liseré qui dit quelle image retenue
   *  passe en ce moment non plus. Rien n'avait échoué nulle part : ni la
   *  compilation, ni les types, ni les treize essais d'écran, parce que le
   *  navigateur d'essai ne résout pas les variables de couleur.
   *
   *  Ce que cet essai garde n'est donc pas une couleur, c'est **la forme du
   *  nom** : tout ce que l'écran de montage pose en clair dans un style doit
   *  citer une variable qui commence par `--color-`, la seule famille que le
   *  thème déclare. */
  test("aucune couleur de l'écran ne cite un nom que le thème ne déclare pas", async () => {
    const { panneau } = await ouvrirLeMontage()
    const cadre = panneau.getByText("le mouvement est-il bon ?").closest("[data-montage]")
    const inventees: string[] = []
    for (const noeud of (cadre as HTMLElement).querySelectorAll<HTMLElement>(
      "[style]",
    )) {
      for (const [, nom] of noeud.getAttribute("style")!.matchAll(
        /var\(--([a-z0-9-]+)\)/g,
      )) {
        if (!nom.startsWith("color-")) inventees.push(nom)
      }
    }
    expect(inventees).toEqual([])
  })

  /** **La pellicule est un seul arrêt de tabulation, pas cent vingt et un.**
   *
   *  Mesuré au navigateur le même jour : chaque cellule du ruban était dans
   *  l'ordre de tabulation, et rejoindre le bouton *Garder* au clavier demandait
   *  autant de pressions que le clip a d'images. Le clavier de cet écran est
   *  fait autrement — on entre dans la pellicule, les flèches déplacent le
   *  curseur, l'espace prend ou laisse —, et cet essai garde la porte à une
   *  seule battante. */
  test("la pellicule n'occupe qu'un seul arrêt de tabulation", async () => {
    const { panneau } = await ouvrirLeMontage()
    const ruban = await waitFor(() => {
      const trouve = document.querySelector("[data-pellicule]")
      if (!trouve) throw new Error("la pellicule ne s'est pas affichée")
      return trouve as HTMLElement
    })
    const cellules = [...ruban.querySelectorAll("button")]
    expect(cellules.length).toBe(24)
    expect(cellules.filter((c) => c.tabIndex === 0)).toHaveLength(1)
    // Et l'arrêt est là où le curseur est, pour qu'on reprenne où on regardait.
    expect(cellules.findIndex((c) => c.tabIndex === 0)).toBe(0)
    // Le reste de l'écran, lui, se rejoint : le bouton qui garde est atteignable
    // dès la tabulation suivante.
    expect(panneau.getByRole("button", { name: /^Garder « / })).toBeTruthy()
  })

  // ── A5 : ce qui bouge entre les images ───────────────────────────────────
  //
  // **La mesure ne vit plus dans le montage** (V3.03) : avec le panneau de
  // recette, la boucle traitée et le chiffre qui l'accompagnait sont partis —
  // le montage juge le mouvement, le traitement (et la stabilité qui s'y
  // mettait à côté de l'aperçu) vit dans l'atelier d'une animation. Ces essais
  // gardent la forme du nom, et ils tiennent l'absence.

  test("aucune mesure de stabilité ne paraît plus dans le montage", async () => {
    const { panneau } = await ouvrirLeMontage()
    await panneau.findByText("8 frames retenues")
    expect(document.querySelector("[data-stabilite]")).toBeNull()
    expect(panneau.queryByText(/Ce qui bouge entre les images/)).toBeNull()
    expect(panneau.queryByText(/un balancement — ou du grésil/)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  A11 — animer sans payer, sur la machine de l'auteur
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ce que ces essais mesurent.** Ce que l'écran montre et ce qu'il envoie quand
// un des modèles de la liste tourne sur la machine : un temps à la place d'un
// montant, les trois absences qui ne se ressemblent pas, la liste de ce qu'il y
// a à rapatrier avec sa taille et sa licence, et le téléchargement qui part
// **quand on clique dessus et pas avant**.
//
// ⚠️ **Et surtout : ils cliquent.** C'est la leçon qu'`A10` a écrite dans
// `docs/status/etat.md` — *les essais ne demandent jamais ce qu'un bouton fait ;
// ils vérifient qu'il paraît, qu'il porte le bon mot, qu'il est allumé*. C'est
// ainsi qu'un mode entier avait pu s'afficher sans rien ouvrir. Ici le bouton du
// téléchargement est cliqué, et ce qui est vérifié est l'appel qui en sort.
//
// Ce qu'ils ne mesurent pas : rien de ce qui se passe côté machine. Le montage
// envoyé, les trois absences relevées sur un vrai disque, un téléchargement
// repris après une coupure — tout ça est tenu par `tests/test_a11.py`, sur
// l'adaptateur réel et un serveur doublé.

describe("A11 — le moteur de la maison", () => {
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

  /** Le même chemin qu'`A9` : on anime une case, et c'est la seule porte. */
  const ouvrirLeClip = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({
      personnages: [personnage("Le nain", { description: "un forgeron nain" })],
      ...options,
    })
    await monter(double.fetchDouble)
    const ecran = await ouvrirLEtabli()
    fireEvent.click(ecran.getByRole("button", { name: "Animer marche" }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-clip]")
      if (!cadre) throw new Error("l'écran du clip ne s'est pas ouvert")
      return cadre as HTMLElement
    })
    return { ...double, panneau: within(panneau) }
  }

  /** Le catalogue avec le seul modèle local — c'est celui-là qui est choisi
   *  d'office, et l'écran bascule donc en entier sur le temps. */
  const SEUL_LE_LOCAL: BaseModelesVideo = {
    ...MODELES_VIDEO,
    modeles: MODELES_VIDEO.modeles.filter((m) => m.de_la_maison),
  }

  // ── « Dans la même liste, avec le même geste » ────────────────────────────

  test("le modèle local est une carte de la même liste, pas un réglage à part", async () => {
    const { panneau } = await ouvrirLeClip()

    // Trois cartes, dans un seul endroit : celles qui coûtent et celle qui ne
    // coûte pas. Une liste séparée en aurait fait une option.
    expect(await panneau.findByText("Seedance 2.0 Mini")).toBeTruthy()
    expect(panneau.getByText("Wan 2.2 · sur votre machine")).toBeTruthy()
  })

  // ── « Le coût affiché est une attente, pas un prix » ──────────────────────

  test("le modèle local annonce un temps mesuré, et jamais un montant", async () => {
    const { panneau } = await ouvrirLeClip()

    const carte = await panneau.findByRole("button", {
      name: "Choisir Wan 2.2 · sur votre machine",
    })
    const dedans = within(carte)
    // Un temps, avec le mot qui dit que c'en est un coût — « ≈ 2 min » tout
    // seul se lirait comme un délai de livraison.
    expect(dedans.getByText(/≈ 2 min/)).toBeTruthy()
    expect(dedans.getByText(/sur votre carte · gratuit/)).toBeTruthy()
    // Et aucun dollar sur cette carte-là : zéro dollar affiché « ≈ $0,0000 »
    // serait exact et illisible.
    expect(carte.textContent).not.toMatch(/\$/)
  })

  test("le bouton porte l'attente là où il portait le montant", async () => {
    const { panneau } = await ouvrirLeClip({ modelesVideo: SEUL_LE_LOCAL })

    expect(
      await panneau.findByRole("button", { name: /Commander ce clip · ≈ 2 min/ }),
    ).toBeTruthy()
    // **L'invariant n'a pas changé, il a changé d'unité** : rien ne part sans
    // que ce que ça coûte soit écrit sur le bouton qui l'envoie.
    expect(panneau.queryByRole("button", { name: /Commander ce clip · ≈ \$/ })).toBeNull()
  })

  test("un lot n'additionne pas la même attente : le premier charge le modèle, pas les suivants", async () => {
    const { panneau } = await ouvrirLeClip({ modelesVideo: SEUL_LE_LOCAL })

    await panneau.findByRole("button", { name: /Commander ce clip · ≈ 2 min/ })
    fireEvent.click(panneau.getByRole("button", { name: "4" }))

    // 129 s pour le premier, 80 s pour chacun des trois suivants = 369 s.
    // Multiplier le premier par quatre aurait annoncé 9 minutes : c'est la même
    // faute que d'annoncer un prix trop bas, dans l'autre sens.
    expect(
      await panneau.findByRole("button", { name: /Commander ces 4 clips · ≈ 6 min/ }),
    ).toBeTruthy()
  })

  test("le temps se dit aussi là où l'écran décrit ce qui va se passer", async () => {
    const { panneau } = await ouvrirLeClip({ modelesVideo: SEUL_LE_LOCAL })

    // ⚠️ Et il ne recopie pas la phrase du payant : un clip payé se fabrique
    // ailleurs, celui-ci se fabrique ici. Laisser « vous pouvez fermer
    // l'atelier » sans dire quelle fenêtre travaille serait mentir.
    expect(await panneau.findByText(/dans la fenêtre du moteur/)).toBeTruthy()
    expect(panneau.getByText(/le reste de l'ordinateur rame/)).toBeTruthy()
  })

  // ── « L'écran annonce le nombre d'images réel » ───────────────────────────

  test("l'écran écrit le nombre d'images que le moteur rendra, pas celui qu'on a demandé", async () => {
    const { panneau } = await ouvrirLeClip({ modelesVideo: SEUL_LE_LOCAL })

    // Une seconde à seize images par seconde ne fait pas seize images : le
    // moteur n'accepte que certains comptes, et il prend celui du dessus.
    fireEvent.click(await panneau.findByRole("button", { name: "1 s" }))
    expect(await panneau.findByText("17 images")).toBeTruthy()
    fireEvent.click(panneau.getByRole("button", { name: "2 s" }))
    expect(await panneau.findByText("33 images")).toBeTruthy()
  })

  test("la durée conseillée se lit là où l'on choisit, avec la raison qui va avec", async () => {
    const { panneau } = await ouvrirLeClip()

    // Elle vit dans le pli de la carte (V3.01.2) : repliée, on ne lit que le
    // nom et l'estimation, et le pli se déplie d'un geste à lui.
    fireEvent.click(
      panneau.getByRole("button", {
        name: "déplier ce qu'on sait de Wan 2.2 · sur votre machine",
      }),
    )
    // ⚠️ Ce que cette raison dit — la bande se dégrade au-delà d'une seconde, et
    // aucune mesure automatique ne le voit — se perdrait dans un document.
    expect(await panneau.findByText(/conseillé : 1 seconde/)).toBeTruthy()
    expect(panneau.getByText(/seul l'œil la voit/)).toBeTruthy()
  })

  // ── « Trois absences, trois phrases, et une seule grise » ─────────────────

  test("la machine en ordre ne dit rien, et n'écrit aucun panneau d'alerte", async () => {
    await ouvrirLeClip()

    const moteur = await waitFor(() => {
      const trouve = document.querySelector("[data-moteur]")
      if (!trouve) throw new Error("le panneau du moteur ne s'est pas affiché")
      return trouve as HTMLElement
    })
    // Il dit ce qu'est la carte — une attente sans sa machine ne veut rien dire.
    expect(within(moteur).getByText(/RTX 3080/)).toBeTruthy()
    // Et rien d'autre : **rien à dire est une réponse**.
    expect(moteur.querySelector("[data-moteur-phrase]")).toBeNull()
    expect(within(moteur).queryByRole("button", { name: /Télécharger/ })).toBeNull()
  })

  test("l'application éteinte grise le modèle et dit d'ouvrir la fenêtre", async () => {
    const { panneau } = await ouvrirLeClip({
      moteur: {
        ...MOTEUR_EN_ORDRE,
        allume: false,
        carte: "",
        memoire_libre_go: 0,
        grise: "ComfyUI n'est pas allumé",
        phrase:
          "ComfyUI n'est pas allumé. Ouvrez-le, puis revenez : le grisé tombera " +
          "tout seul.",
      },
      modelesVideo: {
        ...MODELES_VIDEO,
        modeles: MODELES_VIDEO.modeles.map((m) =>
          m.de_la_maison ? { ...m, grise: "ComfyUI n'est pas allumé" } : m,
        ),
      },
    })

// La seule des trois qui empêche : l'atelier ne sait pas ouvrir une fenêtre
    // à la place de l'auteur, et rien ne peut partir. **Le filtre allumé la
    // masque** (V3.01.2) — le mot du grisé est fait pour être lu, pas la carte
    // pleine de texte —, on l'éteint pour la revoir, et son pli porte la raison.
    fireEvent.click(panneau.getByRole("button", { name: /seulement ce qui peut partir/ }))
    const carte = await panneau.findByRole("button", {
      name: "Choisir Wan 2.2 · sur votre machine",
    })
    expect((carte as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(
      panneau.getByRole("button", {
        name: "déplier ce qu'on sait de Wan 2.2 · sur votre machine",
      }),
    )
    expect(panneau.getByText("ComfyUI n'est pas allumé")).toBeTruthy()
    expect(await panneau.findByText(/le grisé tombera tout seul/)).toBeTruthy()
  })

  test("des fichiers manquants ne grisent rien, et se lisent avec leur taille et leur licence", async () => {
    const { panneau } = await ouvrirLeClip({
      moteur: {
        ...MOTEUR_EN_ORDRE,
        manquants: [
          {
            nom: "wan_2.1_vae.safetensors",
            famille: "vae",
            go: 0.3,
            licence: "Apache 2.0",
            obligatoire: true,
          },
        ],
        go_a_telecharger: 0.3,
        phrase: "il manque 1 fichier au moteur, soit 0,3 Go à télécharger.",
      },
    })

    // **Le modèle reste choisissable** : refuser obligerait à sortir de
    // l'atelier pour un téléchargement que l'atelier sait faire.
    const carte = await panneau.findByRole("button", {
      name: "Choisir Wan 2.2 · sur votre machine",
    })
    expect((carte as HTMLButtonElement).disabled).toBe(false)

    // Et la liste est là **avant** le bouton : la licence est une question qu'on
    // se pose avant de télécharger, jamais après.
    expect(await panneau.findByText("wan_2.1_vae.safetensors")).toBeTruthy()
    expect(panneau.getByText(/0,3 Go · Apache 2\.0/)).toBeTruthy()
  })

  test("le greffon absent avertit sans empêcher, et dit ce que le clip perdra", async () => {
    const { panneau } = await ouvrirLeClip({
      moteur: {
        ...MOTEUR_EN_ORDRE,
        greffon_absent: true,
        phrase:
          "le greffon des gros pixels manque : le clip sortira, il sortira lissé.",
      },
    })

    const carte = await panneau.findByRole("button", {
      name: "Choisir Wan 2.2 · sur votre machine",
    })
    expect((carte as HTMLButtonElement).disabled).toBe(false)
    expect(await panneau.findByText(/il sortira lissé/)).toBeTruthy()
    // Un avertissement n'ouvre pas de téléchargement : ce greffon n'est pas
    // obligatoire, et le proposer avec les fichiers obligatoires mélangerait
    // « il manque » et « ce serait mieux ».
    expect(panneau.queryByRole("button", { name: /Télécharger/ })).toBeNull()
  })

  // ── « Le téléchargement part d'un geste, jamais tout seul » ───────────────

  test("rien ne se télécharge tant que personne n'a cliqué, et le clic envoie l'appel", async () => {
    const { panneau, appels } = await ouvrirLeClip({
      moteur: {
        ...MOTEUR_EN_ORDRE,
        manquants: [
          {
            nom: "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
            famille: "diffusion_models",
            go: 9.1,
            licence: "Apache 2.0",
            obligatoire: true,
          },
        ],
        go_a_telecharger: 9.1,
        phrase: "il manque 1 fichier au moteur, soit 9,1 Go à télécharger.",
      },
    })

    const bouton = await panneau.findByRole("button", { name: /Télécharger · 9,1 Go/ })
    // **Rien n'est parti** : neuf gigaoctets ne se descendent pas dans le dos de
    // quelqu'un, et il n'existe aucune version automatique de ce geste.
    expect(appels.some((a) => a.url === "/api/clips/engine/download")).toBe(false)

    // ⚠️ Et on clique. Un essai qui s'arrêterait à « le bouton est là » laisserait
    // passer un bouton qui n'appelle rien — c'est exactement ce qui est arrivé
    // à un mode entier en `A10`.
    fireEvent.click(bouton)
    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/clips/engine/download")).toBe(true),
    )
  })

  test("ce qui vient d'arriver fait relire le catalogue, sans que personne le demande", async () => {
    const { panneau, appels } = await ouvrirLeClip({
      moteur: {
        ...MOTEUR_EN_ORDRE,
        manquants: [
          {
            nom: "wan_2.1_vae.safetensors",
            famille: "vae",
            go: 0.3,
            licence: "Apache 2.0",
            obligatoire: true,
          },
        ],
        go_a_telecharger: 0.3,
        phrase: "il manque 1 fichier au moteur, soit 0,3 Go à télécharger.",
      },
    })

    fireEvent.click(await panneau.findByRole("button", { name: /Télécharger/ }))
    // Ce qui vient d'arriver peut faire tomber le grisé. L'auteur ne devrait pas
    // avoir à changer de durée pour s'en apercevoir.
    await waitFor(() =>
      expect(
        appels.filter((a) => a.url.startsWith("/api/clips/models")).length,
      ).toBeGreaterThan(1),
    )
    // Et la liste disparaît quand il n'y a plus rien à descendre.
    await waitFor(() =>
      expect(panneau.queryByText("wan_2.1_vae.safetensors")).toBeNull(),
    )
  })

  test("un atelier sans moteur local n'affiche pas le panneau du tout", async () => {
    const { panneau } = await ouvrirLeClip({
      modelesVideo: {
        ...MODELES_VIDEO,
        modeles: MODELES_VIDEO.modeles.filter((m) => !m.de_la_maison),
        moteurs: [{ nom: "openrouter", manque: null }],
      },
    })

    await panneau.findByText("Seedance 2.0 Mini")
    // Un panneau vide qui parlerait d'une carte graphique absente serait pire
    // qu'aucun panneau.
    expect(document.querySelector("[data-moteur]")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  A12 — toutes les poses, en animation
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ce que ces essais mesurent.** La matrice sur deux calques : la bascule qui
// porte les deux jauges, ce qu'une case animée montre, ce qu'elle dit de son
// clip, et les deux gestes qui la remplissent et la vident.
//
// ⚠️ **Ils cliquent**, comme ceux d'`A11` — c'est la leçon qu'`A10` a écrite
// dans `docs/status/etat.md` : un essai qui demande si un bouton *paraît* laisse
// passer un mode entier qui s'affiche sans rien ouvrir. Le retrait d'une bande
// est cliqué et c'est l'appel qui en sort qui est vérifié ; le retour au clip
// est cliqué et c'est l'écran de montage qui est cherché.
//
// Ce qu'ils ne mesurent pas : la composition des cases, qui est le travail du
// serveur, et qui est tenue par `tests/test_a12.py`.

describe("A12 — la matrice sur deux calques", () => {
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

  /** Une bande rangée dans une case, telle que le serveur la compose. */
  const uneBande = (nom: string, pose: string, direction: string | null = null) => ({
    ...bandeRendue(nom, [0, 2, 4, 6]),
    pose,
    direction,
    brouillon: false,
  })

  /** Une chose du jeu **dessinée sur une pose et animée sur une autre** — le
   *  seul décor où l'écart entre les deux calques se lit. */
  const LE_NAIN = personnage("Le nain", {
    cases: PLAN.map((p) => ({
      pose: p.identifiant,
      demandees: p.images,
      images:
        p.identifiant === "repos" ? [asset("bbbb2222-0", "le nain, au repos")] : [],
      ...VIDE_C3,
      bandes: p.identifiant === "marche" ? [uneBande("marche", "marche")] : [],
    })),
  })

  const ouvrirLaMatrice = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({ personnages: [LE_NAIN], ...options })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Le nain")
    return { ...double, etabli }
  }

  /** Passer sur le calque animé — **un geste**, et c'est le critère. */
  const surLeCalqueAnime = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const rendu = await ouvrirLaMatrice(options)
    fireEvent.click(
      await rendu.etabli.findByRole("button", { name: /^animations / }),
    )
    return rendu
  }

  // ── « On passe de l'un à l'autre d'un geste, et chacun porte sa jauge » ───

  test("les deux calques portent chacun sa jauge, et un clic passe de l'un à l'autre", async () => {
    const { etabli } = await ouvrirLaMatrice()

    // Une pose dessinée sur six, une pose animée sur six : **c'est l'écart que
    // la tranche existe pour montrer**, et il se lit sans changer d'écran.
    expect(await etabli.findByRole("button", { name: "images 1 / 6" })).toBeTruthy()
    expect(etabli.getByRole("button", { name: "animations 1 / 6" })).toBeTruthy()

    // Le calque des images est celui qu'on ouvre : un projet qui n'a jamais rien
    // animé retrouve son écran d'avant.
    expect(etabli.getAllByRole("button", { name: /^Fabriquer / }).length).toBeGreaterThan(0)
    expect(etabli.getByText(/dont toutes les images sont faites/)).toBeTruthy()

    fireEvent.click(etabli.getByRole("button", { name: "animations 1 / 6" }))

    // Et de l'autre côté, plus aucun bouton de fabrication : on ne dessine pas
    // sur le calque animé.
    expect(etabli.queryAllByRole("button", { name: /^Fabriquer / })).toHaveLength(0)
    expect(etabli.getByText(/une animation par direction/)).toBeTruthy()
  })

  test("une image faite ne remplit pas la case du calque animé", async () => {
    // ⚠️ **La décision de la tranche.** Le repos est dessiné, la marche est
    // animée : sur le calque animé, le repos doit se lire comme vide.
    const { etabli } = await surLeCalqueAnime()

    const lignes = etabli.getAllByRole("listitem")
    const repos = lignes.find((l) => within(l).queryByText("repos"))
    expect(repos).toBeTruthy()
    expect(within(repos!).getByText("rien ne bouge encore")).toBeTruthy()
    expect(within(repos!).getByText("0 / 1")).toBeTruthy()
  })

  // ── « Une bande affectée s'y voit en train de tourner » ───────────────────

  test("la bande d'une case tourne à la taille de la vignette, sur sa propre planche", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await surLeCalqueAnime()

    const vignette = await waitFor(() => {
      const trouve = document.querySelector("[data-bande-qui-tourne]")
      if (!trouve) throw new Error("aucune bande ne tourne dans la matrice")
      return trouve as HTMLElement
    })
    expect(vignette.getAttribute("data-bande-qui-tourne")).toBe("bande-marche")

    // **La planche entière est chargée une fois et décalée** — jamais une image
    // par cran : c'est le même geste que l'écran de montage, donc exactement
    // les pixels que l'export écrira. Elle est posée **à la taille de la
    // vignette** et non à celle du fichier : quatre cases côte à côte, donc
    // une largeur exactement quadruple de la hauteur, quelle que soit la place
    // que la case a dans la matrice.
    const defile = vignette.querySelector("span") as HTMLElement
    expect(defile.style.backgroundImage).toContain("/api/strips/bande-marche/sheet")
    const [large, haut] = defile.style.backgroundSize
      .split(" ")
      .map((n) => Number.parseFloat(n))
    expect(haut).toBeGreaterThan(0)
    expect(large).toBe(haut * 4)
    const depart = defile.style.backgroundPosition

    // ⚠️ **Et elle tourne pour de vrai.** Une vignette figée montrerait la
    // première image et rien d'autre : on ne verrait pas la différence entre une
    // animation juste et une dont l'ordre des images est faux — ce qu'on vient
    // précisément regarder ici. Huit images par seconde : un cran à 130 ms.
    await act(async () => {
      vi.advanceTimersByTime(130)
    })
    expect(defile.style.backgroundPosition).not.toBe(depart)
    vi.useRealTimers()
  })

  // ── « Une case animée dit de quel clip sa bande vient, et s'y remonte » ───

  test("le nom de la bande remonte au clip qui l'a fournie, dans son écran de montage", async () => {
    const { etabli } = await surLeCalqueAnime()

    fireEvent.click(
      await etabli.findByRole("button", { name: "Ouvrir le clip dont vient marche" }),
    )

    await waitFor(() => {
      const montage = document.querySelector("[data-montage]")
      if (!montage) throw new Error("le montage du clip ne s'est pas ouvert")
      return montage
    })
    // Et c'est bien **ce clip-là** qu'on est allé chercher.
    expect(ouverture(/^Galerie/)).toBe("true")
  })

  // ── « Retirer une bande ne supprime ni la bande, ni le clip » ─────────────

  test("retirer une bande de sa case vide la case, et rien d'autre", async () => {
    const { etabli, appels } = await surLeCalqueAnime()

    fireEvent.click(
      await etabli.findByRole("button", {
        name: "Retirer cette animation de la case marche",
      }),
    )

    // **Les deux champs vides**, et rien d'autre : c'est la désignation qu'on
    // défait. Aucun DELETE ne part — ni sur la bande, ni sur le clip.
    await waitFor(() => {
      const appel = appels.find((a) => a.url === "/api/strips/bande-marche/case")
      expect(appel?.corps).toEqual({ pose: null, direction: null })
    })
    // La route qui **efface** une bande est `/api/strips/{id}`, sans suffixe :
    // elle n'a pas été appelée, et c'est ça qu'on vient vérifier.
    expect(appels.some((a) => a.url === "/api/strips/bande-marche")).toBe(false)
    expect(appels.some((a) => a.url.startsWith("/api/clips/clip-a/delete"))).toBe(false)
  })

  // ── « Commander le clip qui la remplira est un geste » ────────────────────

  test("une case vide du calque animé commande son clip, sans passer par la barre qui paie", async () => {
    const { etabli } = await surLeCalqueAnime()

    const lignes = etabli.getAllByRole("listitem")
    const repos = lignes.find((l) => within(l).queryByText("repos"))!
    fireEvent.click(within(repos).getByRole("button", { name: "Animer repos" }))

    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-clip]")
      if (!trouve) throw new Error("l'écran du clip ne s'est pas ouvert")
      return trouve as HTMLElement
    })
    // Et l'image de départ y est **déjà proposée** — c'est `A9` qui la pose, et
    // le calque animé ne fait que désigner la case.
    expect(await within(cadre).findByText(/la première image qu'il montre de lui/)).toBeTruthy()
  })

  // ── « Une pose écartée n'apparaît sur aucun des deux calques » ────────────

  test("une pose écartée ne paraît sur aucun des deux calques", async () => {
    const { etabli } = await ouvrirLaMatrice({
      personnages: [
        personnage("Le nain", {
          ecartees: ["mort"],
          cases: PLAN.filter((p) => p.identifiant !== "mort").map((p) => ({
            pose: p.identifiant,
            demandees: p.images,
            images: [],
            ...VIDE_C3,
          })),
        }),
      ],
    })

    // **Les deux jauges comptent cinq attitudes**, pas six : ce qui est écarté
    // ne compte nulle part.
    expect(await etabli.findByRole("button", { name: "images 0 / 5" })).toBeTruthy()
    expect(etabli.getByRole("button", { name: "animations 0 / 5" })).toBeTruthy()

    // Elle n'a de rangée sur aucun des deux. Elle reste montrée **sous le
    // trait**, barrée, comme E9 la relègue — un clic la rend, et c'est vrai des
    // deux côtés puisque la ligne du plan est la même.
    const rangees = () =>
      etabli
        .getAllByRole("listitem")
        .filter((l) => within(l).queryByText("mort"))
    expect(rangees()).toHaveLength(0)
    expect(etabli.getByRole("button", { name: "mort" })).toBeTruthy()

    fireEvent.click(etabli.getByRole("button", { name: "animations 0 / 5" }))
    expect(rangees()).toHaveLength(0)
  })

  // ── « Un projet sans aucune animation se comporte comme aujourd'hui » ─────

  test("sans une seule animation, le calque animé le dit — et celui des images ne bouge pas", async () => {
    const { etabli } = await ouvrirLaMatrice({
      personnages: [personnage("Le nain")],
    })

    expect(await etabli.findByRole("button", { name: "animations 0 / 6" })).toBeTruthy()
    fireEvent.click(etabli.getByRole("button", { name: "animations 0 / 6" }))

    expect(etabli.getAllByText("rien ne bouge encore")).toHaveLength(6)
    expect(document.querySelector("[data-bande-qui-tourne]")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  A13 — l'image attrapée au vol
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ce que ces essais mesurent.** Le second geste de la pellicule : où il vit,
// ce qu'il envoie, ce qu'il ne touche pas, et ce que l'écran dit après.
//
// ⚠️ **Ils cliquent**, comme ceux d'`A11` et d'`A12`. Le bouton est cliqué et
// c'est l'appel qui en sort qui est vérifié ; le découpage en cours est relu
// après, parce que *sans toucher aux images retenues* est un critère qu'aucun
// affichage ne prouve.
//
// Ce qu'ils ne mesurent pas : la filiation écrite sur le disque, la chaîne du
// jeu appliquée, l'image brute gardée. Tout ça est tenu par `tests/test_a13.py`,
// sur un vrai clip et un vrai disque.

describe("A13 — l'image attrapée au vol", () => {
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

  /** Le même chemin qu'`A10` : on ouvre le montage depuis la tuile du clip. */
  const ouvrirLeMontage = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({
      personnages: [personnage("Le nain")],
      ...options,
    })
    const flux = await monter(double.fetchDouble)
    await allerAuxVideos()
    flux.emettre("generation", clipRendu("clip-a", false))
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-montage]")
      if (!cadre) throw new Error("l'écran de montage ne s'est pas ouvert")
      return cadre as HTMLElement
    })
    return { ...double, flux, panneau: within(panneau) }
  }

  /** Viser une image, puis la mettre de côté. **Deux gestes distincts**, et
   *  c'est le sujet : viser passe par la pellicule, prélever par la loupe. */
  const mettreDeCote = async (
    panneau: ReturnType<typeof within>,
    numero: number,
  ) => {
    // ⚠️ **Le nom de la cellule porte son état** — *retenue*, *mise de côté* —,
    // et une image peut être les deux. On vise donc le début du nom, sinon
    // l'essai ne trouverait la cellule que dans l'état où on l'imaginait.
    fireEvent.mouseEnter(
      panneau.getByRole("button", { name: new RegExp(`^Image ${numero}(?: —|$)`) }),
    )
    fireEvent.click(
      await panneau.findByRole("button", { name: `Mettre la frame ${numero} de côté` }),
    )
  }

  // ── « Un second geste sur une image de la pellicule la met de côté » ──────

  test("la loupe porte le geste, et elle ne s'efface pas quand le pointeur la quitte", async () => {
    const { panneau } = await ouvrirLeMontage()

    // ⚠️ **La loupe est là avant le premier survol.** Sans cible, elle n'aurait
    // pas de geste à porter ; elle montre l'image du curseur, c'est-à-dire la
    // première. On lit *à côté de la loupe* et non dans tout l'écran : le pied
    // du ruban porte aussi les mots « frame 0 », qui nomment son extrémité
    // gauche et non ce qu'on regarde.
    const aCoteDeLaLoupe = () =>
      within(document.querySelector("[data-loupe]")!.parentElement!)
    await waitFor(() => expect(document.querySelector("[data-loupe]")).toBeTruthy())
    expect(aCoteDeLaLoupe().getByText("frame 0")).toBeTruthy()

    fireEvent.mouseEnter(
      panneau.getByRole("button", { name: /^Image 12(?: —|$)/ }),
    )
    expect(aCoteDeLaLoupe().getByText("frame 12")).toBeTruthy()

    // Le pointeur quitte le ruban : **la loupe reste sur la dernière image
    // regardée**, et c'est ce qui rend son bouton atteignable. Avant `A13`, le
    // ruban relâchait le survol en partant et la loupe disparaissait au moment
    // précis où l'on allait cliquer dessus.
    fireEvent.mouseLeave(document.querySelector("[data-pellicule]")!)
    expect(aCoteDeLaLoupe().getByText("frame 12")).toBeTruthy()
    expect(
      panneau.getByRole("button", { name: "Mettre la frame 12 de côté" }),
    ).toBeTruthy()
  })

  test("mettre une image de côté part sur la route du clip, et rien d'autre ne part", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    await mettreDeCote(panneau, 12)

    await waitFor(() =>
      expect(
        appels.some((a) => a.url === "/api/clips/clip-a/frames/12/pick"),
      ).toBe(true),
    )
    // **Rien ne dépense** : aucune commande de clip ne part de ce geste.
    expect(appels.some((a) => a.url === "/api/clips" && a.corps)).toBe(false)
  })

  test("prélever ne touche pas aux images retenues pour la bande", async () => {
    // ⚠️ **Le critère qu'aucun affichage ne prouve.** Les deux gestes vivent sur
    // la même pellicule ; on pose un découpage, on prélève, et on relit.
    const { panneau } = await ouvrirLeMontage()
    fireEvent.click(await panneau.findByText(/la boucle se referme le mieux/))
    const avant = await panneau.findByText(/\d+ frames retenues/)
    const compte = avant.textContent

    await mettreDeCote(panneau, 3)

    expect(panneau.getByText(compte!)).toBeTruthy()
  })

  // ── « Sans quitter l'écran de montage » ──────────────────────────────────

  test("l'écran de montage reste ouvert, et dit où l'image est partie", async () => {
    const { panneau } = await ouvrirLeMontage()

    await mettreDeCote(panneau, 12)

    expect(document.querySelector("[data-montage]")).toBeTruthy()
    expect(
      await panneau.findByText(/l'image 12 est en bibliothèque/),
    ).toBeTruthy()
    // **Et la phrase dit que le rangement est un second geste, facultatif.**
    expect(panneau.getByText(/dans une case ou sur un objet/)).toBeTruthy()
  })

  test("une image déjà prise se signale, et ce n'est pas un refus", async () => {
    const { panneau } = await ouvrirLeMontage({ imageDejaPrise: 12 })

    await mettreDeCote(panneau, 12)

    expect(
      await panneau.findByText(/l'image 12 était déjà en bibliothèque/),
    ).toBeTruthy()
    // Aucun bandeau de refus : le produit signale ce dont il est certain.
    expect(panneau.queryByText(/ne se prélève pas/)).toBeNull()
  })

  // ── « Prélever plusieurs images d'affilée » ──────────────────────────────

  test("ce qui est déjà pris se marque sur le ruban, et l'on enchaîne sans recommencer", async () => {
    const { panneau, appels } = await ouvrirLeMontage()

    await mettreDeCote(panneau, 10)
    await waitFor(() =>
      expect(document.querySelector("[data-mise-de-cote='10']")).toBeTruthy(),
    )
    await mettreDeCote(panneau, 14)
    await waitFor(() =>
      expect(document.querySelector("[data-mise-de-cote='14']")).toBeTruthy(),
    )

    // Deux appels, deux images — et la cellule le dit d'elle-même, pour qu'on
    // ne redemande pas deux fois la même en glissant le long du clip.
    expect(
      appels.filter((a) => a.url.includes("/frames/") && a.url.endsWith("/pick")),
    ).toHaveLength(2)
    expect(
      panneau.getByRole("button", { name: /^Image 10 —.*mise de côté$/ }),
    ).toBeTruthy()
  })

  // ── « Le clavier fait ce que la souris fait » ────────────────────────────

  test("les flèches reprennent la main sur le survol, et la loupe les suit", async () => {
    const { panneau } = await ouvrirLeMontage()

    const aCoteDeLaLoupe = () =>
      within(document.querySelector("[data-loupe]")!.parentElement!)
    fireEvent.mouseEnter(
      panneau.getByRole("button", { name: /^Image 12(?: —|$)/ }),
    )
    expect(aCoteDeLaLoupe().getByText("frame 12")).toBeTruthy()

    // ⚠️ Sans cette reprise, un survol laissé derrière figerait la loupe pendant
    // que les flèches déplacent le curseur ailleurs — et le geste porterait sur
    // une image qu'on ne regarde plus.
    fireEvent.keyDown(window, { key: "ArrowRight" })
    await waitFor(() =>
      expect(aCoteDeLaLoupe().getByText("frame 1")).toBeTruthy(),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  A4 — la bande sort de l'atelier
// ═══════════════════════════════════════════════════════════════════════════
//
// **Ce que ces essais mesurent.** Les deux endroits d'où une animation sort, et
// ce qui part quand on clique : l'appel, et le nom sous lequel le fichier est
// posé.
//
// Ce qu'ils ne mesurent pas : ce qu'il y a dans l'archive. Les trois fichiers,
// leurs clés, les pixels de l'image animée et sa cadence sont tenus par
// `tests/test_a4.py`, qui ouvre le zip et compare case par case. Ici on vérifie
// que le geste existe, qu'il est au bon endroit, et qu'il ne part pas ailleurs.

describe("A4 — la bande sort de l'atelier", () => {
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

  /** Doubler les deux choses que jsdom n'a pas : l'adresse d'objet et le clic
   *  d'un lien fabriqué. Ce qu'on garde est **le nom sous lequel le fichier est
   *  posé** — il vient du serveur, et c'est ce qui distingue les trois
   *  sorties. */
  const guetterLesFichiers = () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:essai",
      revokeObjectURL: () => {},
    })
    const poses: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      poses.push(this.download)
    })
    return poses
  }

  /** Une bande gardée dans ce clip, telle que le montage la relit. */
  const GARDEE = { ...bandeRendue("marche", [12, 14, 16, 18]), pose: null }

  const ouvrirLeMontage = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({
      personnages: [personnage("Le nain")],
      montage: { ...MONTAGE_RENDU, bandes: [GARDEE] },
      ...options,
    })
    const flux = await monter(double.fetchDouble)
    await allerAuxVideos()
    flux.emettre("generation", clipRendu("clip-a", false))
    fireEvent.click(await screen.findByRole("button", { name: "Découper ›" }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-montage]")
      if (!cadre) throw new Error("l'écran de montage ne s'est pas ouvert")
      return cadre as HTMLElement
    })
    return { ...double, panneau: within(panneau) }
  }

  // ── Depuis l'écran qui vient de la tailler ────────────────────────────────

  test("une bande gardée sort depuis sa ligne, sans quitter le clip ouvert", async () => {
    const poses = guetterLesFichiers()
    const { panneau, appels } = await ouvrirLeMontage()

    fireEvent.click(
      await panneau.findByRole("button", { name: "Sortir l'animation marche" }),
    )

    await waitFor(() => expect(poses).toEqual(["atelier-animations-20260904-1743.zip"]))
    const envoi = appels.find((a) => a.url === "/api/strips/export")
    expect((envoi?.corps as { identifiants: string[] }).identifiants).toEqual([
      "bande-marche",
    ])
    // **Le clip reste ouvert** : on vient de découper, on va recommencer, et un
    // écran qui se refermerait pour poser un fichier ferait tout reprendre.
    expect(document.querySelector("[data-montage]")).toBeTruthy()
  })

  test("faire sortir une animation ne commande aucun clip", async () => {
    guetterLesFichiers()
    const { panneau, appels } = await ouvrirLeMontage()

    fireEvent.click(
      await panneau.findByRole("button", { name: "Sortir l'animation marche" }),
    )

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/strips/export")).toBe(true),
    )
    // *Rien sur cet écran ne dépense* — la phrase du pied reste vraie après ce
    // geste-ci comme après les autres.
    expect(appels.some((a) => a.url === "/api/clips" && a.corps)).toBe(false)
  })

  test("un refus dit la phrase du serveur, et aucun fichier n'est posé", async () => {
    const poses = guetterLesFichiers()
    const { panneau } = await ouvrirLeMontage({
      refusExport: "« bande-marche » n'est plus dans l'atelier",
    })

    fireEvent.click(
      await panneau.findByRole("button", { name: "Sortir l'animation marche" }),
    )

    expect(
      await panneau.findByText(/n'est plus dans l'atelier/),
    ).toBeTruthy()
    expect(poses).toEqual([])
  })

  // ── Depuis la matrice, pour tout un personnage ────────────────────────────

  /** Un personnage dont deux attitudes portent une animation. */
  const LE_NAIN = personnage("Le nain", {
    cases: PLAN.map((p) => ({
      pose: p.identifiant,
      demandees: p.images,
      images: [],
      ...VIDE_C3,
      bandes: ["marche", "repos"].includes(p.identifiant)
        ? [
            {
              ...bandeRendue(p.identifiant, [0, 2, 4, 6]),
              pose: p.identifiant,
              direction: null,
              brouillon: false,
            },
          ]
        : [],
    })),
  })

  const surLeCalqueAnime = async (
    quelPersonnage: Personnage = LE_NAIN,
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const double = serveurDouble({ personnages: [quelPersonnage], ...options })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(await etabli.findByRole("button", { name: /^animations / }))
    return { ...double, etabli }
  }

  test("toutes les animations d'un personnage sortent en une archive à son nom", async () => {
    const poses = guetterLesFichiers()
    const { etabli, appels } = await surLeCalqueAnime()

    fireEvent.click(
      await etabli.findByRole("button", { name: "Sortir ses animations ›" }),
    )

    await waitFor(() =>
      expect(poses).toEqual(["le-nain-animations-20260904-1743.zip"]),
    )
    // **L'écran ne dresse pas la liste des bandes** : il nomme le personnage, et
    // le serveur rassemble. Une liste montée ici serait une seconde écriture de
    // « les animations de ce personnage », et elle divergerait de la jauge.
    const envoi = appels.find((a) => a.url.endsWith("/strips/export"))
    expect(envoi?.url).toBe(`/api/characters/${LE_NAIN.identifiant}/strips/export`)
    expect(envoi?.corps).not.toHaveProperty("identifiants")
  })

  test("la sortie ne vit que sur le calque animé", async () => {
    const { etabli } = await surLeCalqueAnime()

    expect(
      etabli.getByRole("button", { name: "Sortir ses animations ›" }),
    ).toBeTruthy()

    // De retour sur les images fixes, plus rien : ce qui sort ici est une
    // animation, et les images ont déjà leur sortie, dans la galerie.
    fireEvent.click(etabli.getByRole("button", { name: /^images / }))
    expect(
      etabli.queryByRole("button", { name: "Sortir ses animations ›" }),
    ).toBeNull()
  })

  test("un personnage sans aucune animation n'a rien à faire sortir", async () => {
    // **Rien plutôt qu'un bouton grisé** : il n'y a pas de geste à préparer,
    // et un bouton éteint promettrait qu'il suffit de revenir. Ce qui manque
    // est une animation, et la ligne au-dessus dit déjà laquelle.
    const { etabli } = await surLeCalqueAnime(
      personnage("Le nain", {
        cases: PLAN.map((p) => ({
          pose: p.identifiant,
          demandees: p.images,
          images: [],
          ...VIDE_C3,
          bandes: [],
        })),
      }),
    )

    expect(
      etabli.queryByRole("button", { name: "Sortir ses animations ›" }),
    ).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// A7 · L'atelier d'une animation gardée
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ **Le défaut de la tranche, et il a été trouvé à l'usage.** Le produit
// savait garder une animation avec tous ses réglages et **ne savait pas la
// rouvrir** : la vignette de la matrice remontait au clip, l'écran repartait
// des réglages du jeu, et corriger une virgule demandait de tout refaire de
// mémoire.
//
// *Un objet qu'on sait écrire et qu'on ne sait pas relire n'est pas fini*, et
// l'essai qui l'aurait vu est celui qui **referme avant de regarder**. Ceux
// d'ici le font tous : ils ouvrent l'atelier et lisent ce qui s'y affiche,
// jamais ce qu'ils viennent d'envoyer.

describe("A7 · l'atelier d'une animation", () => {
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

  /** Un personnage dont la marche porte une animation gardée. */
  const AVEC_UNE_MARCHE = personnage("Le nain", {
    cases: PLAN.map((p) => ({
      pose: p.identifiant,
      demandees: p.images,
      images: [],
      ...VIDE_C3,
      bandes:
        p.identifiant === "marche"
          ? [{ ...GARDEE_A7, pose: "marche", direction: null, brouillon: false }]
          : [],
    })),
  })

  /** Ouvrir l'atelier **par la porte de l'auteur** : le codex, le calque animé,
   *  la vignette. C'est le chemin qui manquait — un essai qui monterait l'écran
   *  à la main ne tiendrait pas ce que la tranche répare.
   *
   *  Le lecteur est arrêté d'emblée : il tourne à l'ouverture, et une image qui
   *  change onze fois par seconde rend la suite illisible. */
  const ouvrirLAtelier = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    arreter = true,
  ) => {
    const double = serveurDouble({ personnages: [AVEC_UNE_MARCHE], ...options })
    await monter(double.fetchDouble)
    const etabli = await ouvrirLEtabli("Le nain")
    fireEvent.click(await etabli.findByRole("button", { name: /^animations / }))
    fireEvent.click(
      await etabli.findByRole("button", {
        name: "Retravailler l'animation marche",
      }),
    )
    const cadre = await waitFor(() => {
      const trouve = document.querySelector("[data-atelier-de-bande]")
      if (!trouve) throw new Error("l'atelier de l'animation ne s'est pas ouvert")
      return trouve as HTMLElement
    })
    const atelier = within(cadre)
    if (arreter)
      fireEvent.click(
        await atelier.findByRole("button", { name: "arrêter l'animation" }),
      )
    return { ...double, atelier, cadre }
  }

  /** Pousser l'image choisie d'un pixel, par la porte du clavier. */
  const pousserDUnPixel = (cadre: HTMLElement) => {
    const toile = cadre.querySelector("[data-case-en-grand]") as HTMLElement
    toile.focus()
    fireEvent.keyDown(window, { key: "ArrowRight" })
  }

  /** Attendre que le lecteur en marche regarde la n-ième image de l'animation.
   *
   *  **L'atelier écrivait « image 2 sur 4 » sous le lecteur** ; la colonne des
   *  images porte maintenant le rang dans le nom de chaque ligne — « l'image
   *  14, 2ᵉ de l'animation » — et `aria-current` dit laquelle est regardée.
   *  C'est le même fait, et c'est lui que ces essais attendent avant de pousser
   *  une flèche : le lecteur doit tourner pour que le défaut d'`A7` puisse se
   *  produire, donc l'essai doit savoir *où* il en est. */
  const attendreLImage = async (
    atelier: ReturnType<typeof within>,
    rang: number,
  ) =>
    waitFor(
      () => {
        const ligne = atelier.getByLabelText(
          new RegExp(`, ${rang}ᵉ de l'animation`),
        )
        expect(ligne.getAttribute("aria-current")).toBe("true")
      },
      { timeout: 3000 },
    )

  test("rouvrir une animation rend les réglages qu'on y avait mis", async () => {
    // ⚠️ **L'essai qui aurait vu le défaut.** La bande gardée tourne à onze
    // images par seconde en aller-retour ; le jeu, lui, dit huit et boucle. Ce
    // qui s'affiche doit être celui de la bande.
    const { atelier } = await ouvrirLAtelier()

    expect(await atelier.findByText(/11 par seconde/)).toBeTruthy()
    expect(
      atelier
        .getByRole("button", { name: "aller-retour" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("la vignette ouvre l'animation, son nom remonte au clip", async () => {
    // **Deux portes, et elles ne mènent pas au même endroit.** Avant `A7` il n'y
    // avait que la seconde, et c'était tout le défaut.
    const { atelier } = await ouvrirLAtelier()

    fireEvent.click(atelier.getByRole("button", { name: "‹ Animations" }))

    await waitFor(() =>
      expect(document.querySelector("[data-atelier-de-bande]")).toBeNull(),
    )
  })

  test("une image se pousse au clavier, et rien n'est écrit avant d'enregistrer", async () => {
    const { atelier, cadre, appels } = await ouvrirLAtelier()

    pousserDUnPixel(cadre)

    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
    // *Rien n'est écrit tant qu'on n'a pas enregistré* — la phrase de l'écran
    // est vraie, et c'est le compte des envois qui le dit.
    expect(
      appels.some((a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps)),
    ).toBe(false)
  })

  test("la poussée se voit sur l'image choisie, en pixels du sprite", async () => {
    const { atelier, cadre } = await ouvrirLAtelier()

    pousserDUnPixel(cadre)

    // Le chiffre plutôt qu'un état invisible : une correction au pixel ne se
    // lit pas sur une vignette de 64 px, elle se lit écrite.
    expect(
      await atelier.findByText(/remettre cette image droite/),
    ).toBeTruthy()
  })

  test("les flèches corrigent l'image qu'on regarde, pas la première", async () => {
    // ⚠️ **Trouvé à l'écran le 5 septembre 2026, et pas par un essai.**
    // L'animation tourne à l'ouverture : la première flèche arrive donc
    // pendant que les images défilent. Elle poussait la *première* image de la
    // bande — celle que l'auteur ne regardait pas —, l'animation s'arrêtait
    // ailleurs, et la correction se voyait sur une pose au hasard.
    //
    // **Le lecteur doit tourner pour que l'essai tienne quelque chose** :
    // arrêté, l'image regardée est déjà l'image choisie, et le défaut ne peut
    // pas se produire. Deux images par seconde laissent la marge qu'il faut
    // entre la lecture de la ligne et la flèche.
    const { atelier, cadre } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: { ...GARDEE_A7, cadence: 2, sens: "boucle" },
        },
      },
      false,
    )
    await attendreLImage(atelier, 2)

    pousserDUnPixel(cadre)

    // La deuxième, et elle seule : celle qui était à l'écran.
    expect(
      cadre.querySelectorAll("[data-poussee]"),
    ).toHaveLength(1)
    expect(
      cadre.querySelector('[data-image-de-la-bande="1"] [data-poussee]'),
    ).toBeTruthy()
  })

  test("une image se prend dans un autre clip, sans quitter l'écran", async () => {
    // C'est ce qui reste de l'ancienne `A3` : **quand deux clips sont chacun
    // bons à moitié**, on prend une image dans l'un et une dans l'autre. La
    // liste ne montre que les clips du même personnage — un clip d'ailleurs
    // donnerait une animation où le sujet change au milieu.
    const { atelier, cadre, appels } = await ouvrirLAtelier()

    const choix = await atelier.findByLabelText(
      "prendre cette image dans un autre clip",
    )
    fireEvent.change(choix, { target: { value: "clip-b" } })

    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
    fireEvent.click(atelier.getByRole("button", { name: "Enregistrer ›" }))
    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    const envoi = appels.find(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )
    expect(
      (envoi?.corps as { prises: Prise[] }).prises.some(
        (p) => p.clip === "clip-b",
      ),
    ).toBe(true)
    // **Rien n'a été commandé** : le clip est payé, en reprendre une image ne
    // coûte rien. C'est toute la différence avec l'autre moitié de l'atelier.
    expect(appels.some((a) => a.url === "/api/clips" && Boolean(a.corps))).toBe(
      false,
    )
    expect(cadre).toBeTruthy()
  })

  test("un seul clip ne montre aucune liste de clips", async () => {
    // **Un menu à un seul choix n'est pas un choix**, et il ferait croire qu'il
    // y a quelque part un autre clip à trouver.
    const { atelier } = await ouvrirLAtelier({
      atelierDeBande: { ...ATELIER_RENDU, clips_voisins: [VOISINS_A7[0]] },
    })

    await atelier.findByText(/en pixels du sprite/)
    expect(
      atelier.queryByLabelText("prendre cette image dans un autre clip"),
    ).toBeNull()
  })

  test("le détourage se règle finement, moteur compris", async () => {
    // ⚠️ **L'écran n'offrait qu'un curseur de tolérance**, et il ne sert à rien
    // sur trois moteurs sur quatre. Demandé par l'auteur après avoir découpé son
    // pèlerin.
    const { atelier } = await ouvrirLAtelier()

    // **Cinq moteurs et non quatre depuis `B26`**, et c'est le gain de la
    // tranche : l'atelier d'une animation montait un panneau de l'ancien
    // châssis où la palette du jeu (`B18`) n'était jamais arrivée. Il règle
    // maintenant les mêmes moteurs que la retouche.
    const moteurs = await atelier.findAllByRole("button", {
      name: /^(bord|pipette|modèle|sélection|palette du jeu)$/,
    })
    expect(moteurs).toHaveLength(5)
    // La tolérance est là tant que le moteur la lit.
    expect(atelier.getByLabelText(/tolérance de la passe 1, en chiffres/)).toBeTruthy()

    fireEvent.click(atelier.getByRole("button", { name: "modèle" }))

    // **Le modèle ne lit aucune tolérance**, et l'écran le dit plutôt que de
    // laisser un curseur qui ne fait rien — ou, ce qui revient au même, de le
    // faire disparaître sans un mot (`AGENTS.md`, 8nonies).
    await waitFor(() =>
      expect(atelier.queryByLabelText(/tolérance de la passe 1, en chiffres/)).toBeNull(),
    )
  })

  test("la pipette et la sélection se posent vraiment sur la frame", async () => {
    // ⚠️ **Deux moteurs demandent un geste sur l'image brute.** L'atelier
    // d'une animation n'en avait aucune à offrir : il montrait la planche déjà
    // traitée, les deux boutons s'absentaient et une phrase disait où le geste
    // se faisait. **`B26` a donné la surface à cet écran-là aussi** : la frame
    // choisie *est* l'image sur laquelle on vise. Ce qui reste garanti est la
    // même chose qu'avant, prise par l'autre bout — aucun de ces deux moteurs
    // n'offre un bouton qui ne fait rien (`AGENTS.md`, 8nonies).
    const { atelier } = await ouvrirLAtelier()

    fireEvent.click(await atelier.findByRole("button", { name: "pipette" }))
    // **La surface n'est pas là avant d'armer** : sans quoi tout regard sur la
    // bande serait un risque de clic.
    expect(atelier.queryByText(/Source de la frame/)).toBeNull()
    fireEvent.click(await atelier.findByRole("button", { name: /viser dans l'image/ }))

    // La frame cède la place à son image d'origine, et le bandeau dit quel
    // geste est attendu — c'est là que la pipette se pose.
    expect(await atelier.findByText(/Source de la frame · viser une couleur/)).toBeTruthy()
    expect(
      atelier.getByRole("button", { name: "clique dans l'image" }).getAttribute("aria-pressed"),
    ).toBe("true")

    // Le geste se termine aussi sans viser : la frame revient.
    fireEvent.click(atelier.getByRole("button", { name: "‹ La frame" }))
    await waitFor(() => expect(atelier.queryByText(/Source de la frame/)).toBeNull())

    fireEvent.click(atelier.getByRole("button", { name: "sélection" }))
    fireEvent.click(await atelier.findByRole("button", { name: /entourer dans l'image/ }))
    expect(await atelier.findByText(/Source de la frame · entourer le sujet/)).toBeTruthy()
    expect(
      atelier
        .getByRole("button", { name: "entoure le sujet dans l'image" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
  })

  test("changer de moteur emporte son durcissement", async () => {
    // C'est la mesure de `D1` : à moteur égal la nature de l'image ne décide
    // presque rien, et laisser le durcissement du moteur d'avant est ce que
    // l'auteur a dû retaper trente-neuf fois sur quarante.
    // **Ce qui est vérifié est ce qui part**, pas ce qui s'affiche : le
    // durcissement se choisit désormais par segments, et un segment ne porte
    // que sa valeur — le lire obligerait à interroger une classe CSS. L'aperçu,
    // lui, repart à chaque geste avec la recette entière.
    const { atelier, appels } = await ouvrirLAtelier()
    await atelier.findByLabelText(/tolérance de la passe 1, en chiffres/)

    fireEvent.click(atelier.getByRole("button", { name: "modèle" }))

    await waitFor(() => {
      const dernier = [...appels]
        .reverse()
        .find((a) => a.url === "/api/montage/preview")
      const prises = (dernier?.corps as { prises?: Prise[] })?.prises ?? []
      const ecartee = prises.find((p) => p.recette)
      expect(ecartee?.recette?.passes[0]?.moteur).toBe("modele")
      expect(ecartee?.recette?.passes[0]?.durcissement).toBe(2)
    })
  })

  test("une recette de jeu sans passe se voit, et on peut en ajouter une", async () => {
    // ⚠️ **Une recette de jeu peut n'avoir aucune passe**, et l'écran n'offrait
    // alors aucun moyen d'en ajouter : le fond restait, et il n'y avait rien à
    // régler.
    const { atelier } = await ouvrirLAtelier({
      atelierDeBande: {
        ...ATELIER_RENDU,
        bande: { ...GARDEE_A7, recette: { ...GARDEE_A7.recette, passes: [] } },
      },
    })

    expect(await atelier.findByText(/ne détoure rien/)).toBeTruthy()
    fireEvent.click(atelier.getByRole("button", { name: "Une passe de plus" }))

    expect(await atelier.findByLabelText(/tolérance de la passe 1, en chiffres/)).toBeTruthy()
    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
  })

  test("une recette enregistrée s'applique à l'animation entière", async () => {
    const { atelier, appels } = await ouvrirLAtelier({
      recettes: {
        "mon pixel art": {
          ...RECETTE_VIDE,
          passes: [{ ...PASSE_PAR_DEFAUT, tolerance: 61 }],
        },
      },
    })

    // « toutes », depuis la V3.03.2 : la recette nommée suit la sélection.
    fireEvent.click(await atelier.findByRole("tab", { name: /Toute l’animation/ }))
    const choix = await atelier.findByLabelText(
      "appliquer une recette enregistrée aux images choisies",
    )
    fireEvent.change(choix, { target: { value: "mon pixel art" } })

    // Elle remplace les réglages en cours, et **n'écrit rien** : c'est la règle
    // de tout l'écran, et une recette nommée serait sinon le seul geste qui ne
    // s'annule pas.
    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
    expect(
      (atelier.getByLabelText(/tolérance de la passe 1, en chiffres/) as HTMLInputElement).value,
    ).toBe("61")
    expect(
      appels.some((a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps)),
    ).toBe(false)
  })

  test("sans recette enregistrée, aucune liste ne paraît", async () => {
    // Un menu vide promettrait qu'il y a quelque part des recettes à trouver.
    const { atelier } = await ouvrirLAtelier({ recettes: {} })

    await atelier.findByText(/en pixels du sprite/)
    expect(
      atelier.queryByLabelText(
        "appliquer une recette enregistrée aux images choisies",
      ),
    ).toBeNull()
  })

  test("annuler ramène exactement l'état d'ouverture", async () => {
    const { atelier, cadre } = await ouvrirLAtelier()
    pousserDUnPixel(cadre)
    pousserDUnPixel(cadre)
    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()

    fireEvent.click(atelier.getByRole("button", { name: "Annuler" }))

    // **Comparé au départ, jamais compté au fil de l'eau** : ce qui revient à
    // l'état d'ouverture ne laisse rien à enregistrer, et la ligne s'en va.
    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
  })

  test("enregistrer relit ce que le serveur a vraiment écrit", async () => {
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    pousserDUnPixel(cadre)
    await atelier.findByText(/des corrections attendent/)

    fireEvent.click(atelier.getByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    const surLaBande = appels.filter((a) => a.url === "/api/strips/bande-marche")
    expect(surLaBande.some((a) => Boolean(a.corps))).toBe(true)
    // **Une relecture derrière l'écriture** : on repart de ce que le serveur a
    // écrit, pas de ce qu'on croyait envoyer — la poussée est bornée là-bas, et
    // une correction poussée hors de la case revient corrigée.
    expect(surLaBande.filter((a) => !a.corps).length).toBeGreaterThan(1)
  })

  test("la pelure d'oignon est éteinte au départ", async () => {
    // Allumée d'office, elle ferait croire à un défaut de rendu sur la première
    // ouverture : on verrait deux personnages là où il n'y en a qu'un.
    const { atelier, cadre } = await ouvrirLAtelier()

    const champ = (await atelier.findByLabelText(
      /L'image d'avant, en transparence, en chiffres/,
    )) as HTMLInputElement
    expect(champ.value).toBe("0 %")
    expect(cadre.querySelector("[data-pelure]")).toBeNull()
  })

  test("le lecteur s'arrête dès qu'on touche une image", async () => {
    // Une animation qui continuerait de tourner pendant qu'on corrige une pose
    // rendrait la correction invisible : on ne verrait jamais l'image visée.
    const { atelier, cadre } = await ouvrirLAtelier()
    fireEvent.click(
      atelier.getByRole("button", { name: "faire tourner l'animation" }),
    )

    pousserDUnPixel(cadre)

    expect(
      await atelier.findByRole("button", { name: "faire tourner l'animation" }),
    ).toBeTruthy()
  })

  test("les neuf points d'ancrage sont là, et un seul est pris", async () => {
    const { atelier } = await ouvrirLAtelier()

    const points = await atelier.findAllByRole("radio")
    expect(points).toHaveLength(9)
    expect(
      points.filter((p) => p.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1)
  })

  test("une fenêtre mesurée avec un autre détourage se dit d'avant", async () => {
    // *Elle n'est pas fausse, elle est d'avant* — et c'est cette nuance-là qui
    // décide de qui paie les vingt secondes de la remesure.
    //
    // ⚠️ **Ce qui périme la fenêtre est la recette de la bande** (V3.03.1), et
    // c'est ce que l'essai pose ici : une recette nommée posée sur **toutes**
    // les images remplace celle de l'animation. Régler la tolérance ne le ferait
    // plus — depuis la tranche, ce geste-là écarte *une frame*, et la fenêtre
    // commune reste mesurée avec la recette de la bande. Sa phrase à elle est
    // vérifiée par « une frame qui s'écarte dit que la fenêtre commune est
    // d'avant ».
    //
    // **Et « toutes » n'est pas décoratif ici** (V3.03.2) : la recette nommée
    // suit la sélection comme les tables, et la sélection d'ouverture est *une*
    // image. Sans ce clic, elle écarterait la première frame et laisserait la
    // fenêtre commune parfaitement à jour.
    const { atelier, cadre } = await ouvrirLAtelier({
      recettes: {
        "mon pixel art": {
          ...RECETTE_VIDE,
          passes: [{ ...PASSE_PAR_DEFAUT, tolerance: 61 }],
        },
      },
    })
    expect(cadre.querySelector("[data-fenetre-davant]")).toBeNull()

    fireEvent.click(await atelier.findByRole("tab", { name: /Toute l’animation/ }))
    fireEvent.change(
      await atelier.findByLabelText(
        "appliquer une recette enregistrée aux images choisies",
      ),
      { target: { value: "mon pixel art" } },
    )
    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(cadre.querySelector("[data-fenetre-davant]")).toBeTruthy(),
    )
  })

  test("reprendre la fenêtre est fermé tant que des corrections attendent", async () => {
    // **Le seul geste de cet écran qui écrit sans passer par « Enregistrer ».**
    // Mesurer avec la recette du disque puis écrire par-dessus des réglages en
    // cours laisserait la bande à moitié neuve — ce que le critère interdit.
    const { atelier, cadre } = await ouvrirLAtelier()
    const bouton = await atelier.findByRole("button", {
      name: "Reprendre la fenêtre",
    })
    expect(bouton.hasAttribute("disabled")).toBe(false)

    pousserDUnPixel(cadre)

    await waitFor(() => expect(bouton.hasAttribute("disabled")).toBe(true))
    expect(await atelier.findByText(/Enregistrez d'abord/)).toBeTruthy()
  })

  test("reprendre la fenêtre refait le rectangle et la planche d'un seul geste", async () => {
    const { atelier, appels } = await ouvrirLAtelier()

    fireEvent.click(
      await atelier.findByRole("button", { name: "Reprendre la fenêtre" }),
    )

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/strips/bande-marche/frame")).toBe(
        true,
      ),
    )
    // La relecture qui suit est ce qui empêche l'écran de montrer un rectangle
    // neuf sur des pixels d'avant.
    await waitFor(() =>
      expect(
        appels.filter((a) => a.url === "/api/strips/bande-marche" && !a.corps)
          .length,
      ).toBeGreaterThan(1),
    )
  })

  test("rien de cet écran ne commande de clip", async () => {
    // *Rien ici ne dépense* — le dernier critère, compté plutôt que supposé.
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    pousserDUnPixel(cadre)
    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    expect(appels.some((a) => a.url === "/api/clips" && Boolean(a.corps))).toBe(
      false,
    )
    expect(
      appels.some((a) => a.url === "/api/generations" && Boolean(a.corps)),
    ).toBe(false)
  })

  // ── V3.03.1 · chaque frame porte sa recette ──────────────────────────────
  //
  // **Le défaut de forme que ces essais évitent.** Une bande n'avait qu'une
  // recette pour toutes ses images ; depuis la V3.03.1 chaque frame peut porter
  // la sienne, et le geste qui la fait naître est *toucher un réglage*. Un essai
  // qui poserait la recette dans l'état de départ du double ne verrait donc
  // jamais la naissance — c'est-à-dire tout ce que la tranche ajoute. Ceux d'ici
  // partent tous d'une bande sans aucune recette individuelle et **la font
  // naître par l'écran**.

  /** Régler la tolérance du détourage de l'image regardée, par le champ où le
   *  chiffre s'écrit.
   *
   *  **C'est le geste le plus court qui donne à une frame sa recette**, et il
   *  passe par la table de détourage — celle de l'établi depuis la V3.03.1, pas
   *  les trois curseurs sans nom d'avant. La place qui s'écarte s'appelle donc
   *  « détourage », et c'est le serveur qui la nomme. */
  const reglerLaTolerance = async (
    atelier: ReturnType<typeof within>,
    valeur: number,
  ) => {
    const champ = await atelier.findByLabelText(/tolérance de la passe 1, en chiffres/)
    fireEvent.change(champ, { target: { value: String(valeur) } })
    fireEvent.keyDown(champ, { key: "Enter" })
  }

  test("une bande d'avant se rouvre telle quelle — rien ne migre", async () => {
    // Le premier critère de la tranche, et le seul qui se casserait en silence :
    // une migration qui donnerait sa recette à chaque frame rendrait la même
    // image, et ne se verrait qu'au moment de vouloir en écarter une seule.
    const { atelier, cadre } = await ouvrirLAtelier()

    await atelier.findByText(/en pixels du sprite/)
    expect(cadre.querySelectorAll("[data-secarte]")).toHaveLength(0)
    expect(
      cadre.querySelector("[data-recette-de-la-frame]")?.getAttribute(
        "data-recette-de-la-frame",
      ),
    ).toBe("de-la-bande")
  })

  test("toucher un réglage donne à l'image sa recette, copiée de la bande", async () => {
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)

    await reglerLaTolerance(atelier, 61)

    // Le panneau change de titre : c'est ce qui distingue *je règle les quatre
    // images* de *je règle celle-ci*.
    await waitFor(() =>
      expect(
        cadre
          .querySelector("[data-recette-de-la-frame]")
          ?.getAttribute("data-recette-de-la-frame"),
      ).toBe("sienne"),
    )
    // **Une copie, pas une remise à zéro** — et c'est ce qui part qu'on
    // vérifie, pas ce qui s'affiche : la grille et les couleurs se choisissent
    // par segments, qui ne portent que leur valeur. La recette de la frame doit
    // être celle de la bande **plus** le réglage touché ; sans la copie,
    // écarter une frame sur son détourage lui ferait perdre tout le reste en
    // silence.
    await waitFor(() => {
      const dernier = [...appels]
        .reverse()
        .find((a) => a.url === "/api/montage/preview")
      const prises = (dernier?.corps as { prises?: Prise[] })?.prises ?? []
      const sienne = prises[0]?.recette
      expect(sienne?.passes[0]?.tolerance).toBe(61)
      expect(sienne?.grille).toEqual(GARDEE_A7.recette?.grille)
      expect(sienne?.quantification).toEqual(GARDEE_A7.recette?.quantification)
    })
    // Et le ruban l'écrit, avec les mots du serveur.
    await waitFor(() =>
      expect(
        cadre.querySelector('[data-image-de-la-bande="0"][data-secarte]'),
      ).toBeTruthy(),
    )
    const dit = await atelier.findByText(/S'écarte de l'animation/)
    expect(dit.textContent).toContain("détourage")
  })

  test("une frame qui s'écarte dit que la fenêtre commune est d'avant", async () => {
    // La fenêtre ne change pas de camp : elle reste mesurée avec la recette de
    // la bande, et les vingt secondes de remesure ne se paient pas à chaque
    // cran de curseur. Ce qui reste à faire est de le **dire**.
    const { atelier, cadre } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)

    await reglerLaTolerance(atelier, 61)

    await waitFor(() =>
      expect(
        cadre.querySelector("[data-fenetre-davant-sur-la-frame]"),
      ).toBeTruthy(),
    )
  })

  test("« reprendre la recette de l'animation » rend la frame au défaut", async () => {
    const { atelier, cadre } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)
    await reglerLaTolerance(atelier, 61)
    await waitFor(() =>
      expect(cadre.querySelector("[data-secarte]")).toBeTruthy(),
    )

    fireEvent.click(
      await atelier.findByRole("button", {
        name: "Reprendre la recette de l'animation",
      }),
    )

    await waitFor(() =>
      expect(
        cadre
          .querySelector("[data-recette-de-la-frame]")
          ?.getAttribute("data-recette-de-la-frame"),
      ).toBe("de-la-bande"),
    )
    // **Le ruban suit l'aperçu, pas le clic** : le liseré s'en va quand l'image
    // refaite arrive, pas avant. Les deux bougent ensemble, et c'est voulu —
    // un liseré qui partirait avant que l'image ne change dirait que c'est fait
    // alors qu'on regarde encore l'ancien rendu.
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-secarte]")).toHaveLength(0),
    )
  })

  test("écarter une frame puis annuler ramène l'état d'ouverture", async () => {
    // *C'est un geste annulable comme les autres* — le critère le demande, et
    // rien ne le rendrait vrai tout seul : la recette d'une frame vit dans les
    // prises, et « Annuler » les repose telles qu'elles étaient.
    const { atelier, cadre } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)
    await reglerLaTolerance(atelier, 61)
    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
    // **On vérifie d'abord que la frame s'est bien écartée**, sinon l'essai
    // passerait aussi bien sur un réglage posé sur la bande entière : « Annuler »
    // efface les deux, et l'essai ne dirait alors rien de la tranche.
    await waitFor(() =>
      expect(cadre.querySelector("[data-secarte]")).toBeTruthy(),
    )

    fireEvent.click(atelier.getByRole("button", { name: "Annuler" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-secarte]")).toHaveLength(0),
    )
  })

  test("les tables ne battent pas quand le lecteur tourne", async () => {
    // ⚠️ **L'essai qui met les choses au calme supprime le défaut qu'il
    // cherche** (`AGENTS.md`, 8octies) : arrêté, le panneau ne peut pas battre.
    // Le lecteur tourne donc, **ralenti**.
    //
    // > Le défaut, vu au navigateur le 5 septembre 2026 : les tables suivaient
    // > l'image *affichée*, et le titre, la phrase d'écart et le bouton
    // > « reprendre la recette » clignotaient à la cadence de l'animation. On
    // > ne clique pas un bouton qui s'en va.
    //
    // Les tables suivent donc la frame **choisie** — le mot du plan —, qui ne
    // change que sur un clic dans le ruban. Les flèches, elles, continuent de
    // corriger l'image qu'on regarde : c'est la règle d'`A7`, et son essai est
    // « les flèches corrigent l'image qu'on regarde, pas la première ».
    // ⚠️ **La deuxième image porte déjà sa recette.** Sans une frame qui
    // s'écarte, il n'y a rien qui *puisse* clignoter et l'essai passerait sur
    // un écran cassé — c'est la moitié du travail de cet essai-ci.
    const prisesEcartees = GARDEE_A7.prises.map((prise, rang) =>
      rang === 1
        ? {
            ...prise,
            recette: {
              ...GARDEE_A7.recette,
              passes: [{ ...PASSE_PAR_DEFAUT, tolerance: 61 }],
            },
          }
        : prise,
    )
    const bandeEcartee = {
      ...GARDEE_A7,
      cadence: 2,
      sens: "boucle" as const,
      prises: prisesEcartees,
    }
    const { atelier, cadre } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: bandeEcartee,
          ecarts: ecartsDesPrises(prisesEcartees, GARDEE_A7.recette),
        },
      },
      false,
    )
    await attendreLImage(atelier, 2)
    // L'écart existe bien : le ruban le porte.
    expect(cadre.querySelector('[data-image-de-la-bande="1"][data-secarte]')).toBeTruthy()

    // Le lecteur tourne : on relit le panneau plusieurs fois de suite, à cheval
    // sur au moins un tour complet. Il doit dire la même chose à chaque fois.
    const lu = new Set<string>()
    for (let i = 0; i < 8; i += 1) {
      lu.add(
        String(
          cadre
            .querySelector("[data-recette-de-la-frame]")
            ?.getAttribute("data-recette-de-la-frame"),
        ),
      )
      await new Promise((tenir) => setTimeout(tenir, 120))
    }
    expect(atelier.getByRole("button", { name: "arrêter l'animation" })).toBeTruthy()
    expect([...lu]).toEqual(["de-la-bande"])
  })

  test("un réglage tombe sur la frame choisie, lecteur en marche", async () => {
    // Le pendant du précédent : le panneau ne bat pas **et** ce qu'on règle va
    // bien là où le panneau le dit. On choisit la deuxième image dans le ruban
    // — ce qui arrête le lecteur —, on le relance, puis on règle : c'est la
    // deuxième qui reçoit la recette, pas celle qui passe à l'écran.
    const { atelier, cadre } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: { ...GARDEE_A7, cadence: 2, sens: "boucle" },
        },
      },
      false,
    )
    await attendreLImage(atelier, 2)

    // On choisit la troisième dans le ruban — le clic arrête le lecteur —, puis
    // on le relance. Le panneau reste sur la troisième pendant que les images
    // défilent, et c'est elle que le réglage doit trouver.
    fireEvent.click(
      atelier.getByRole("button", { name: /l'image 16, 3ᵉ de l'animation/ }),
    )
    fireEvent.click(
      await atelier.findByRole("button", { name: "faire tourner l'animation" }),
    )
    await attendreLImage(atelier, 1)

    await reglerLaTolerance(atelier, 61)

    // La troisième, et elle seule — celle qu'on avait choisie, pas celle qui
    // passait à l'écran au moment du geste.
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-secarte]")).toHaveLength(1),
    )
    expect(
      cadre.querySelector('[data-image-de-la-bande="2"][data-secarte]'),
    ).toBeTruthy()
  })

  test("une garde se referme et se rouvre avec ses recettes individuelles", async () => {
    // ⚠️ **Le piège d'`A7`, un cran plus loin** (`AGENTS.md`, 8septies) : les
    // essais gardaient puis vérifiaient la réponse du `POST`, c'est-à-dire ce
    // qu'ils venaient d'envoyer. Celui-ci **relit l'écran** après que
    // l'enregistrement a rouvert l'animation — ce que le serveur a écrit, pas
    // ce qu'on croyait lui dire. Et il garde avec un réglage qui n'est pas
    // celui du défaut : 12 couleurs là où le jeu en dit 24.
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)
    await reglerLaTolerance(atelier, 61)
    await waitFor(() =>
      expect(cadre.querySelector("[data-secarte]")).toBeTruthy(),
    )

    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    // La recette est partie sur la prise, et pas sur la bande.
    const ecrit = appels.find(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )
    const envoyees = (ecrit?.corps as { prises: Prise[] }).prises
    expect(envoyees[0].recette?.passes[0]?.tolerance).toBe(61)
    expect(envoyees[1].recette ?? null).toBeNull()
    // Et l'écran rouvert la porte encore : c'est la relecture qui compte.
    await waitFor(() =>
      expect(
        cadre.querySelector('[data-image-de-la-bande="0"][data-secarte]'),
      ).toBeTruthy(),
    )
    expect(
      (
        (await atelier.findByLabelText(/tolérance de la passe 1, en chiffres/)) as HTMLInputElement
      ).value,
    ).toBe("61")
  })

  // ── V3.03.2 · les tables sur une sélection ───────────────────────────────
  //
  // **Le défaut de forme que ces essais évitent, et qu'aucune revue ne verrait.**
  // Les tables rendent une recette *entière* à chaque geste : bouger un curseur
  // renvoie toute la recette de l'image qu'on regarde. L'écrire telle quelle sur
  // les images choisies leur donnerait aussi les valeurs qu'elles ne
  // partageaient pas — **sans un mot**, et ça ne se voit qu'à la fin, sur une
  // planche. Un essai qui poserait un réglage sur un lot *déjà d'accord* ne
  // pourrait pas le voir : ceux d'ici partent tous d'un lot **qui n'est pas
  // d'accord**, et vérifient ce que les valeurs non touchées sont devenues.

  /** Quatre images dont deux portent déjà leur recette, et pas la même :
   *  la deuxième s'écarte sur le détourage, la troisième sur les couleurs. */
  const PRISES_SEPAREES: Prise[] = GARDEE_A7.prises.map((prise, rang) =>
    rang === 1
      ? {
          ...prise,
          recette: {
            ...GARDEE_A7.recette,
            passes: [{ ...PASSE_PAR_DEFAUT, tolerance: 61 }],
          },
        }
      : rang === 2
        ? {
            ...prise,
            recette: {
              ...GARDEE_A7.recette,
              quantification: { couleurs: 12, palette: [], tramage: "aucun" },
            },
          }
        : prise,
  )

  /** Une recette enregistrée, et **elle ne porte aucune main** — c'est le
   *  serveur qui l'a voulu, pas l'essai : `voyage` la lui retire à
   *  l'enregistrement (`U5`, `US-342`). Une recette nommée avec une main serait
   *  un état que le produit ne sait pas fabriquer, et l'essai qui s'en servirait
   *  prouverait quelque chose sur rien. */
  const RECETTES_NOMMEES: Record<string, Recette> = {
    "mon pixel art": {
      ...RECETTE_VIDE,
      passes: [{ ...PASSE_PAR_DEFAUT, tolerance: 61 }],
      quantification: { couleurs: 48, palette: [], tramage: "aucun" },
    },
  }

  /** Une retouche posée sur une image de la bande.
   *
   *  ⚠️ **Aucun écran ne la pose encore** — la table de la main arrive en
   *  V3.03.4 —, mais **la route qui écrit une bande l'accepte déjà** sur une
   *  prise, et c'est ce qui rend cet état atteignable aujourd'hui : par l'agent,
   *  par un appel direct, et demain par l'écran. */
  const UNE_MAIN: Recette["main"] = {
    opacite: [],
    calques: [
      {
        nom: "retouche",
        visible: true,
        passages: [{ garde: false, rayon: 2, points: [[8, 9]], couleur: "" }],
      },
    ],
  }

  const ouvrirSeparee = (prises: Prise[] = PRISES_SEPAREES) => {
    const bande = { ...GARDEE_A7, prises }
    return ouvrirLAtelier({
      recettes: RECETTES_NOMMEES,
      atelierDeBande: {
        ...ATELIER_RENDU,
        bande,
        ecarts: ecartsDesPrises(prises, GARDEE_A7.recette),
      },
    })
  }

  /** Le ruban, par son rang — les essais parlent de la 1ʳᵉ, la 2ᵉ, la 3ᵉ. */
  const vignette = (cadre: HTMLElement, rang: number) =>
    cadre.querySelector(
      `[data-image-de-la-bande="${rang}"]`,
    ) as HTMLButtonElement

  /** Les prises du dernier aperçu — ce que l'écran **enverrait**, et non ce
   *  qu'il affiche : une valeur posée sur un lot se lit là, pas dans un champ. */
  const dernieresPrises = (appels: { url: string; corps: unknown }[]) =>
    ((
      [...appels].reverse().find((a) => a.url === "/api/montage/preview")
        ?.corps as { prises?: Prise[] }
    )?.prises ?? []) as Prise[]

  test("le ruban se sélectionne au clic et s'étend", async () => {
    const { atelier, cadre } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    // À l'ouverture, une seule image est choisie — c'est ce qui fait tenir la
    // règle de la V3.03.1 : *toucher un réglage donne à cette image sa recette*.
    expect(cadre.querySelectorAll("[data-choisie]")).toHaveLength(1)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(vignette(cadre, 3), { shiftKey: true })

    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-choisie]")).toHaveLength(3),
    )
    expect(vignette(cadre, 0).getAttribute("aria-pressed")).toBe("false")

    // Ctrl retire celle du milieu — l'intervalle n'est pas une prison.
    fireEvent.click(vignette(cadre, 2), { ctrlKey: true })
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-choisie]")).toHaveLength(2),
    )
  })

  test("la sélection porte un geste : rien ne l'enregistre", async () => {
    // **Elle n'est pas un état de la bande.** Une sélection gardée sur le disque
    // serait à ranger, à rouvrir et à expliquer, pour un choix qui ne survit pas
    // à la question suivante. L'essai regarde ce qui part : le corps de
    // l'aperçu et celui de l'enregistrement.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    await reglerLaTolerance(atelier, 33)
    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    const partis = appels
      .filter((a) => Boolean(a.corps))
      .map((a) => JSON.stringify(a.corps))
    expect(partis.some((corps) => /selection|choisie/i.test(corps))).toBe(false)
  })

  test("une valeur se pose sur toute la sélection, et rien d'autre ne voyage", async () => {
    // **Le cœur de la tranche.** Trois images choisies, deux d'accord sur les
    // couleurs et une non ; on touche la tolérance. Les trois doivent la
    // recevoir, et **la troisième doit garder ses douze couleurs** — c'est la
    // ligne qui tombe si l'écran repose la recette entière au lieu de la valeur.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    await reglerLaTolerance(atelier, 33)

    await waitFor(() => {
      const prises = dernieresPrises(appels)
      expect(prises[0]?.recette?.passes[0]?.tolerance).toBe(33)
      expect(prises[1]?.recette?.passes[0]?.tolerance).toBe(33)
      expect(prises[2]?.recette?.passes[0]?.tolerance).toBe(33)
    })
    const prises = dernieresPrises(appels)
    // Ce qui n'a pas été touché est resté ce qu'il était, image par image.
    expect(prises[2]?.recette?.quantification?.couleurs).toBe(12)
    expect(prises[0]?.recette?.quantification?.couleurs).toBe(24)
    // Et la quatrième, non choisie, n'a toujours aucune recette à elle.
    expect(prises[3]?.recette ?? null).toBeNull()
  })

  test("une table dit « séparé » quand les images choisies ne s'accordent pas", async () => {
    const { atelier, cadre } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })

    await waitFor(() =>
      expect(
        cadre.querySelector('[data-table-de-la-frame="détourage"][data-separe]'),
      ).toBeTruthy(),
    )
    expect(
      cadre.querySelector(
        '[data-table-de-la-frame="quantification"][data-separe]',
      ),
    ).toBeTruthy()
    // **Ce sur quoi elles sont d'accord ne s'annonce pas** : un « séparé » posé
    // partout ne séparerait plus rien.
    expect(
      cadre.querySelector('[data-table-de-la-frame="bords"][data-separe]'),
    ).toBeNull()
    // Et une seule phrase le résume pour le lot, pas une par image.
    expect(cadre.querySelectorAll("[data-separes-du-lot]")).toHaveLength(1)
  })

  test("ce qui va être écrasé se dit une fois pour le lot", async () => {
    // La règle de `G12`, écrite ici pour le ruban : *ce qui n'a pas voyagé se
    // dit une fois pour le lot*, pas trente fois.
    const { atelier, cadre } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })

    // **Une fois, et à un seul endroit** : sous le menu qui pose la recette,
    // au plus près du geste qui écrase.
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-recettes-ecrasees]")).toHaveLength(1),
    )
    // Deux des trois choisies portent leur recette, et c'est ce nombre-là que
    // l'écran annonce — celui du lot, pas celui de la bande.
    expect(
      cadre
        .querySelector("[data-recettes-ecrasees]")
        ?.getAttribute("data-recettes-ecrasees"),
    ).toBe("2")
    // Le liseré montre lesquelles, et il n'en montre pas une de plus.
    expect(cadre.querySelectorAll("[data-liser-ecart]")).toHaveLength(2)
  })

  test("une recette enregistrée remplace tout l'ensemble des images choisies", async () => {
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    fireEvent.change(
      await atelier.findByLabelText(
        "appliquer une recette enregistrée aux images choisies",
      ),
      { target: { value: "mon pixel art" } },
    )

    await waitFor(() => {
      const prises = dernieresPrises(appels)
      expect(prises[1]?.recette?.passes[0]?.tolerance).toBe(61)
      expect(prises[2]?.recette?.passes[0]?.tolerance).toBe(61)
    })
    const prises = dernieresPrises(appels)
    // **Elle remplace, elle ne reporte pas** : les douze couleurs de la
    // troisième s'en vont avec le reste — *une recette est un ensemble, en
    // prendre la moitié rendrait une image que personne n'a jamais jugée*.
    expect(prises[2]?.recette?.quantification?.couleurs).toBe(48)
    // Les non choisies n'ont rien reçu, et rien n'est écrit.
    expect(prises[0]?.recette ?? null).toBeNull()
    expect(prises[3]?.recette ?? null).toBeNull()
    expect(
      appels.some((a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps)),
    ).toBe(false)
    expect(await atelier.findByText(/des corrections attendent/)).toBeTruthy()
  })

  test("une recette enregistrée ne jette pas la main d'une image", async () => {
    // ⚠️ **Le risque va dans l'autre sens que celui qu'on attend.** Une recette
    // nommée ne *propage* pas de retouche — le serveur lui retire sa main à
    // l'enregistrement (`U5`) — mais « remplacer tout l'ensemble » remplacerait
    // par du vide celle que l'image avait, sans un mot. *Rien ne se réécrit en
    // silence*, et une retouche perdue ne se refait pas : elle se redessine.
    const avecUneMain = PRISES_SEPAREES.map((prise, rang) =>
      rang === 1
        ? { ...prise, recette: { ...prise.recette!, main: UNE_MAIN } }
        : prise,
    )
    const { atelier, cadre, appels } = await ouvrirSeparee(avecUneMain)
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    fireEvent.change(
      await atelier.findByLabelText(
        "appliquer une recette enregistrée aux images choisies",
      ),
      { target: { value: "mon pixel art" } },
    )

    // ⚠️ **Attendre `couleurs`, pas `tolerance`.** `tolerance` vaut déjà 61 sur
    // la 2ᵉ image *avant même* que la recette nommée s'applique — `PRISES_SEPAREES`
    // le pose ainsi pour un autre essai — donc l'attendre ne prouve rien : le
    // premier aperçu (celui d'avant le clic, encore en vol à cause du délai de
    // l'aperçu) le satisfait déjà, et l'essai lisait alors un aperçu du passé.
    // `couleurs` ne vaut 48 qu'une fois la recette vraiment appliquée : c'est le
    // seul des trois champs vérifiés ici qui change entre les deux états.
    await waitFor(() => {
      const prises = dernieresPrises(appels)
      expect(prises[1]?.recette?.quantification?.couleurs).toBe(48)
    })
    const prises = dernieresPrises(appels)
    // Tout le reste a bien été remplacé — la recette est un ensemble.
    expect(prises[1]?.recette?.passes[0]?.tolerance).toBe(61)
    // Mais la retouche est encore là.
    expect(prises[1]?.recette?.main?.calques[0]?.passages).toHaveLength(1)
    // Et l'image d'à côté, qui n'en avait pas, n'en reçoit pas une.
    expect(prises[2]?.recette?.main ?? null).toBeNull()
  })

  test("« reprendre la recette de l'animation » s'applique à la sélection", async () => {
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    fireEvent.click(
      await atelier.findByRole("button", {
        name: "Reprendre la recette de l'animation sur 2 images",
      }),
    )

    await waitFor(() => {
      const prises = dernieresPrises(appels)
      expect(prises[1]?.recette ?? null).toBeNull()
      expect(prises[2]?.recette ?? null).toBeNull()
    })
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-liser-ecart]")).toHaveLength(0),
    )
  })

  test("toute la bande choisie se règle sur la bande, pas image par image", async () => {
    // ⚠️ **Douze recettes individuelles identiques annonceraient douze écarts**
    // là où il n'y en a aucun : le ruban se couvrirait de liserés, et
    // « reprendre la recette de l'animation » n'aurait plus rien à reprendre.
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(await atelier.findByRole("tab", { name: /Toute l’animation/ }))
    await reglerLaTolerance(atelier, 44)

    await waitFor(() => {
      const dernier = [...appels]
        .reverse()
        .find((a) => a.url === "/api/montage/preview")
      const corps = dernier?.corps as { recette?: Recette; prises?: Prise[] }
      expect(corps?.recette?.passes[0]?.tolerance).toBe(44)
      expect(corps?.prises?.every((prise) => !prise.recette)).toBe(true)
    })
    expect(cadre.querySelectorAll("[data-liser-ecart]")).toHaveLength(0)
  })

  test("cliquer une vignette en mode « toute l'animation » ne change pas la portée", async () => {
    // ⚠️ Avant, ce clic ramenait les tables à une seule frame sans rien dire :
    // l'auteur croyait régler l'animation et ne réglait qu'une image. Signalé
    // le 16 septembre 2026.
    const { atelier, cadre, appels } = await ouvrirLAtelier()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(await atelier.findByRole("tab", { name: /Toute l’animation/ }))
    fireEvent.click(vignette(cadre, 2))
    expect(
      atelier.getAllByRole("tab", { name: /Toute l’animation/ })[0],
    ).toHaveAttribute("aria-selected", "true")
    await reglerLaTolerance(atelier, 44)

    await waitFor(() => {
      const corps = [...appels]
        .reverse()
        .find((a) => a.url === "/api/montage/preview")?.corps as { recette?: Recette; prises?: Prise[] }
      expect(corps?.recette?.passes[0]?.tolerance).toBe(44)
      expect(corps?.prises?.every((prise) => !prise.recette)).toBe(true)
    })

    // Et l'onglet « frame seule » ramène la portée à l'image qu'on regarde.
    fireEvent.click(atelier.getAllByRole("tab", { name: /Frame 3 seule/ })[0])
    expect(
      atelier.getAllByRole("tab", { name: /Frame 3 seule/ })[0],
    ).toHaveAttribute("aria-selected", "true")
    expect(atelier.getByText(/à la frame 3 seulement/)).toBeInTheDocument()
  })

  test("une valeur posée sur toutes suit aussi les recettes individuelles", async () => {
    // Le pendant du précédent, et il tombe tout seul si on l'oublie : un curseur
    // posé sur les quatre n'en bougerait que deux, et les deux qui s'écartaient
    // l'ignoreraient sans un mot — *un curseur qui bouge sans que l'image change
    // ne se distingue pas d'un curseur cassé* (`AGENTS.md`, 8nonies).
    const { atelier, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(await atelier.findByRole("tab", { name: /Toute l’animation/ }))
    await reglerLaTolerance(atelier, 44)

    await waitFor(() => {
      const corps = [...appels]
        .reverse()
        .find((a) => a.url === "/api/montage/preview")?.corps as {
        recette?: Recette
        prises?: Prise[]
      }
      expect(corps?.recette?.passes[0]?.tolerance).toBe(44)
      expect(corps?.prises?.[1]?.recette?.passes[0]?.tolerance).toBe(44)
      expect(corps?.prises?.[2]?.recette?.passes[0]?.tolerance).toBe(44)
    })
    // Et la troisième garde ses douze couleurs : la valeur voyage, pas la recette.
    expect(dernieresPrises(appels)[2]?.recette?.quantification?.couleurs).toBe(12)
  })

  test("une route prend la liste, et la garde se rouvre avec les recettes du lot", async () => {
    // Deux critères en un, parce qu'ils se prouvent du même geste : *une route
    // serveur prend une liste — pas trente appels pour trente frames*, et *la
    // garde se referme et se rouvre avec les recettes posées en lot* (8septies).
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    // **Trois des quatre**, et pas les quatre : choisir toute la bande règle la
    // bande, ce qui est l'objet de l'essai d'à côté. Ici on veut un vrai lot de
    // recettes individuelles à relire.
    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(vignette(cadre, 2), { shiftKey: true })
    await reglerLaTolerance(atelier, 33)
    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    const ecritures = appels.filter(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )
    expect(ecritures).toHaveLength(1)
    expect((ecritures[0].corps as { prises: Prise[] }).prises).toHaveLength(4)

    // **On relit l'écran après réouverture**, pas la réponse du `PUT` : c'est ce
    // que le serveur a écrit qui compte, et le double le garde entre deux appels.
    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-liser-ecart]")).toHaveLength(3),
    )
    expect(
      (
        (await atelier.findByLabelText(/tolérance de la passe 1, en chiffres/)) as HTMLInputElement
      ).value,
    ).toBe("33")
  })

  // ── V3.03.3 · la bande se monte ─────────────────────────────────────────
  //
  // **Une bande gardée n'est pas un tirage figé.** On retire, on duplique, on
  // déplace, on va chercher une image de plus dans le clip — et ce qu'on retire
  // tombe au **chutier**, avec sa recette, au lieu de disparaître.
  //
  // ⚠️ **Le défaut de forme que ces essais cherchent est celui de la V3.03.1,
  // d'un cran plus loin** : les gestes du ruban doivent porter sur l'image
  // **choisie**, jamais sur celle qui passe. Le lecteur tourne pendant qu'on
  // travaille, et une insertion qui viserait l'image affichée tomberait à un
  // rang tiré au sort par le métronome. L'essai de l'insertion laisse donc
  // l'animation **en marche, ralentie** (8octies).

  /** Le chutier, entrée par entrée — les essais parlent du numéro d'image. */
  const auChutier = (cadre: HTMLElement, numero: number) =>
    cadre.querySelector(`[data-au-chutier="${numero}"]`) as HTMLElement | null

  test("retirer une image la met au chutier, avec sa recette", async () => {
    // **Retirer n'est pas jeter.** L'image part au chutier *entière* : sans ça,
    // « retirer puis remettre » serait une façon silencieuse d'effacer les
    // réglages posés dessus.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    // La deuxième porte sa recette à elle — c'est celle qu'on retire.
    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(atelier.getByRole("button", { name: /^Retirer / }))

    await waitFor(() =>
      expect(cadre.querySelectorAll("[data-image-de-la-bande]")).toHaveLength(3),
    )
    expect(auChutier(cadre, 14)).toBeTruthy()
    expect(cadre.querySelector("[data-recette-au-chutier]")).toBeTruthy()

    // Et ce qui part à l'aperçu est le ruban sans elle, dans l'ordre.
    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([12, 16, 18]),
    )
  })

  test("dupliquer pose la copie juste après, et elle emporte la même recette", async () => {
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(atelier.getByRole("button", { name: /^Dupliquer / }))

    // ⚠️ **Ici, et pas après le `waitFor`.** L'aperçu répond cent vingt
    // millisecondes plus tard avec les écarts recalculés par le serveur, et il
    // efface la trace de ce qu'on vérifie : que **l'écart voyage avec sa
    // prise**. Sans ce transport, le liseré de la deuxième image glisse d'un
    // cran pendant qu'on regarde le résultat de son geste — trois vignettes
    // marquées deviennent deux, puis trois à nouveau. Une assertion posée après
    // l'aperçu passe des deux côtés.
    expect(cadre.querySelectorAll("[data-liser-ecart]")).toHaveLength(3)
    // La copie est ce qu'on vient de faire : c'est elle qui reste choisie.
    expect(vignette(cadre, 2).getAttribute("aria-pressed")).toBe("true")

    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([
        12, 14, 14, 16, 18,
      ]),
    )
    const prises = dernieresPrises(appels)
    // **C'est la même image** : la copie porte la recette de la source, sans
    // quoi dupliquer rendrait une seconde image que personne n'a réglée.
    expect(prises[2]?.recette?.passes[0]?.tolerance).toBe(61)
    expect(prises[1]?.recette?.passes[0]?.tolerance).toBe(61)
  })

  test("déplacer une image change l'ordre, et c'est cet ordre qui part", async () => {
    // *L'ordre du ruban est l'ordre de l'export* — vérifié sur ce qui part,
    // pas sur ce qui s'affiche.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 0))
    fireEvent.click(
      atelier.getByRole("button", { name: /^Déplacer .* vers la droite/ }),
    )

    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([
        14, 12, 16, 18,
      ]),
    )
    // Elle reste choisie là où elle est tombée — un choix qui resterait sur le
    // rang d'avant désignerait l'image du voisin.
    expect(vignette(cadre, 1).getAttribute("aria-pressed")).toBe("true")
  })

  test("une image se glisse à la place d'une autre", async () => {
    // Le même geste à la souris. Il ne remplace pas les boutons : *tout se fait
    // au clavier autant qu'à la souris*, et un glissement ne se fait pas au
    // clavier.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.dragStart(vignette(cadre, 3))
    fireEvent.drop(vignette(cadre, 1))

    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([
        12, 18, 14, 16,
      ]),
    )
  })

  test("retirer se ferme avec sa raison quand toute la bande est choisie", async () => {
    // **Une animation garde au moins une image**, et le serveur le refuserait
    // de toute façon : le dire ici évite de découvrir le refus après une minute
    // de travail. *Le grisé porte sa raison.*
    const { atelier, cadre } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(atelier.getAllByRole("tab", { name: /Toute l’animation/ })[0])

    await waitFor(() =>
      expect(
        atelier
          .getByRole("button", { name: /^Retirer / })
          .hasAttribute("disabled"),
      ).toBe(true),
    )
    expect(await atelier.findByText(/en garde au moins une/)).toBeTruthy()
    void cadre
  })

  test("on va chercher une image dans le clip, et elle entre au chutier", async () => {
    // *« Aller chercher une frame en plus depuis le clip si il m'en manque
    // une »* — la demande de l'auteur, mot pour mot. La pellicule prend la
    // place de l'image en grand : c'est la profondeur suivante du même endroit.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(
      atelier.getByRole("button", { name: "prendre des images dans le clip ›" }),
    )
    const pellicule = await waitFor(() => {
      const trouve = cadre.querySelector("[data-pellicule-du-clip]")
      if (!trouve) throw new Error("la pellicule du clip ne s'est pas ouverte")
      return trouve as HTMLElement
    })

    // Les images que la bande porte déjà sont marquées : sans marque, on
    // redemande deux fois la même.
    expect(
      pellicule.querySelector('[data-image-du-clip="12"] [data-deja-dedans]'),
    ).toBeTruthy()
    expect(
      pellicule.querySelector('[data-image-du-clip="5"] [data-deja-dedans]'),
    ).toBeNull()

    fireEvent.click(
      pellicule.querySelector('[data-image-du-clip="5"]') as HTMLElement,
    )
    fireEvent.click(
      pellicule.querySelector('[data-image-du-clip="9"]') as HTMLElement,
    )
    fireEvent.click(within(pellicule).getByRole("button", { name: /^Prendre 2 / }))

    await waitFor(() => expect(auChutier(cadre, 5)).toBeTruthy())
    expect(auChutier(cadre, 9)).toBeTruthy()
    // **Rien du ruban n'a bougé** : aller chercher une image n'est pas la poser.
    expect(cadre.querySelectorAll("[data-image-de-la-bande]")).toHaveLength(4)
    expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([12, 14, 16, 18])
  })

  test("une image du chutier se pose près de l'image choisie, lecteur en marche", async () => {
    // ⚠️ **L'essai qui verrait le défaut** (8octies). L'animation tourne à deux
    // images par seconde et l'écran en affiche une troisième ; l'image du
    // chutier doit tomber **après l'image choisie** — la première, celle que les
    // tables règlent —, pas après celle qui passe. Arrêter le lecteur d'abord
    // supprimerait le défaut avant de le chercher : à l'arrêt, l'image regardée
    // *est* l'image choisie.
    const prises = PRISES_SEPAREES
    const { atelier, cadre, appels } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: {
            ...GARDEE_A7,
            cadence: 2,
            sens: "boucle",
            prises,
            chutier: [{ numero: 7, clip: "", dx: 0, dy: 0 }],
          },
          ecarts: ecartsDesPrises(prises, GARDEE_A7.recette),
        },
      },
      false,
    )

    await attendreLImage(atelier, 3)

    fireEvent.click(
      atelier.getByRole("button", { name: "Poser l'image 7 après l'image 1" }),
    )

    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.numero)).toEqual([
        12, 7, 14, 16, 18,
      ]),
    )
    // Elle quitte le chutier : une image est dans la bande ou au chutier,
    // jamais dans les deux.
    expect(auChutier(cadre, 7)).toBeNull()
  })

  test("le chutier part avec l'enregistrement et se relit après", async () => {
    // *Le chutier se garde avec la bande et se rouvre* (8septies). On relit
    // l'écran **après réouverture**, pas la réponse du `PUT` : une réserve qui
    // partirait bien et s'écrirait mal rendrait la même réponse.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    fireEvent.click(atelier.getByRole("button", { name: /^Retirer / }))
    fireEvent.click(await atelier.findByRole("button", { name: "Enregistrer ›" }))

    await waitFor(() =>
      expect(atelier.queryByText(/des corrections attendent/)).toBeNull(),
    )
    const ecriture = appels.find(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )
    const parti = ecriture?.corps as { prises: Prise[]; chutier: Prise[] }
    expect(parti.prises.map((p) => p.numero)).toEqual([12, 16, 18])
    expect(parti.chutier.map((p) => p.numero)).toEqual([14])
    expect(parti.chutier[0].recette?.passes[0]?.tolerance).toBe(61)

    await waitFor(() => expect(auChutier(cadre, 14)).toBeTruthy())
  })

  test("remplacer une image lui retire sa recette, et l'écran le dit avant", async () => {
    // ⚠️ **Une retouche mentirait sur une autre image** : un point de pipette ou
    // un cadre tracé désigne un endroit de *celle-là*. La frame revient donc à
    // la recette de l'animation — et *rien ne se réécrit en silence* veut dire
    // que l'écran l'annonce **sous le contrôle qui le fera**.
    const { atelier, cadre, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(vignette(cadre, 1))
    expect(
      await atelier.findByText(/la remplacer la rend à la recette de l'animation/),
    ).toBeTruthy()

    fireEvent.change(
      await atelier.findByLabelText("remplacer par une autre image du clip"),
      { target: { value: "9" } },
    )

    await waitFor(() => {
      const prises = dernieresPrises(appels)
      expect(prises[1]?.numero).toBe(9)
      expect(prises[1]?.recette ?? null).toBeNull()
    })
    // Les autres ne bougent pas : la troisième garde la sienne.
    expect(dernieresPrises(appels)[2]?.recette?.quantification?.couleurs).toBe(12)
  })

  test("la fiche décrit l'image choisie et la remplace, lecteur en marche", async () => {
    // ⚠️ **L'essai qui verrait le défaut** (8octies). La fiche passait par le
    // même chemin que les flèches, et suivait donc l'image *qui passe* : on
    // choisissait la troisième, la fiche décrivait la première, et taper un
    // numéro remplaçait la première. La phrase « cette image a sa recette à
    // elle » désignait, elle aussi, une image au hasard.
    //
    // Arrêter le lecteur d'abord effacerait le défaut avant de le chercher : à
    // l'arrêt, l'image regardée *est* l'image choisie. Il tourne donc, ralenti à
    // deux images par seconde — assez lent pour que l'essai sache laquelle passe
    // au moment du geste, assez vivant pour que l'écart se produise.
    const prises = PRISES_SEPAREES
    const { atelier, cadre, appels } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: { ...GARDEE_A7, cadence: 2, sens: "boucle", prises },
          ecarts: ecartsDesPrises(prises, GARDEE_A7.recette),
        },
      },
      false,
    )
    await attendreLImage(atelier, 2)

    // La troisième — celle qui porte ses douze couleurs. Le clic arrête le
    // lecteur ; on le relance aussitôt, et on attend qu'une *autre* image passe.
    fireEvent.click(
      atelier.getByRole("button", { name: /l'image 16, 3ᵉ de l'animation/ }),
    )
    fireEvent.click(
      await atelier.findByRole("button", { name: "faire tourner l'animation" }),
    )
    await attendreLImage(atelier, 1)

    // ⚠️ **Tout de suite, avant le cran suivant du lecteur.** La première image
    // est à l'écran ; la fiche doit tenir sur la troisième, et annoncer ce
    // qu'elle va lui faire perdre.
    const champ = atelier.getByLabelText(
      "remplacer par une autre image du clip",
    ) as HTMLInputElement
    expect(champ.value).toBe("16")
    expect(
      atelier.getByText(/la remplacer la rend à la recette de l'animation/),
    ).toBeTruthy()

    fireEvent.change(champ, { target: { value: "9" } })

    await waitFor(() => {
      const parties = dernieresPrises(appels)
      expect(parties.map((p) => p.numero)).toEqual([12, 14, 9, 18])
      expect(parties[2]?.recette ?? null).toBeNull()
    })
    // Celle qui passait à l'écran n'a rien perdu — ni son numéro, ni sa recette.
    expect(dernieresPrises(appels)[1]?.recette?.passes[0]?.tolerance).toBe(61)
    expect(cadre.querySelectorAll("[data-image-de-la-bande]")).toHaveLength(4)
  })

  test("une flèche choisit l'image qu'elle pousse, lecteur en marche", async () => {
    // Le pendant du précédent, et l'autre moitié de la règle : **la flèche garde
    // celle d'`A7`** — elle tombe sur ce que l'œil regardait —, mais elle emmène
    // le ruban avec elle. Sans quoi les tables réglaient une image, la fiche en
    // montrait une deuxième et le liseré du ruban en marquait une troisième.
    const prises = PRISES_SEPAREES
    const { atelier, cadre, appels } = await ouvrirLAtelier(
      {
        atelierDeBande: {
          ...ATELIER_RENDU,
          bande: { ...GARDEE_A7, cadence: 2, sens: "boucle", prises },
          ecarts: ecartsDesPrises(prises, GARDEE_A7.recette),
        },
      },
      false,
    )
    await attendreLImage(atelier, 3)

    const toile = atelier.getByRole("application", {
      name: /les flèches la déplacent d'un pixel/,
    })
    toile.focus()
    fireEvent.keyDown(window, { key: "ArrowRight" })

    // La troisième a reçu la poussée — c'est elle qu'on regardait —, et c'est
    // elle que la fiche décrit maintenant : les deux se sont rejointes.
    await waitFor(() =>
      expect(dernieresPrises(appels).map((p) => p.dx)).toEqual([0, 0, 1, 0]),
    )
    expect(
      (
        atelier.getByLabelText(
          "remplacer par une autre image du clip",
        ) as HTMLInputElement
      ).value,
    ).toBe("16")
    expect(
      cadre.querySelector('[data-image-de-la-bande="2"][aria-pressed="true"]'),
    ).toBeTruthy()
  })

  test("« Reprendre le montage » rouvre le montage sur cette animation", async () => {
    // **Le cul-de-sac d'`A7` par l'autre bout.** Le montage repartait toujours
    // des réglages du jeu : ajouter une image demandait de refaire la bande
    // entière. Il s'ouvre désormais sur *son* découpage et *sa* vitesse — celle
    // de l'animation, onze, et non les huit du mouvement.
    const { atelier } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(atelier.getByRole("button", { name: "Reprendre le montage ›" }))

    const montage = await waitFor(() => {
      const trouve = document.querySelector("[data-montage]")
      if (!trouve) throw new Error("le montage ne s'est pas rouvert")
      return trouve as HTMLElement
    })
    const dedans = within(montage)
    // Par sa poignée, pas par son nom : le mouvement du clip s'appelle « marche »
    // lui aussi, et l'en-tête le porte à trois centimètres de là.
    expect(montage.querySelector("[data-on-remonte]")?.textContent).toBe("marche")
    // Ses quatre images, pas la proposition du clip — poser une proposition
    // par-dessus effacerait le travail au moment de le reprendre.
    expect(
      dedans.getByRole("button", { name: /Reprendre « marche » · 4 images/ }),
    ).toBeTruthy()
    // Onze, celle de l'animation — et non les huit que le mouvement propose :
    // une bande a le droit d'être plus lente que la moyenne de son espèce.
    expect(
      (dedans.getByLabelText(/Cadence, en chiffres/) as HTMLInputElement).value,
    ).toBe("11 images / s")
    // Le cadre s'y lit et ne s'y règle pas : le changer d'ici ne referait pas
    // ses quatre nombres mesurés.
    expect(montage.querySelector("[data-cadre-en-lecture]")).toBeTruthy()
  })

  test("reprendre le montage écrit sur l'animation, sans en garder une de plus", async () => {
    const { atelier, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(atelier.getByRole("button", { name: "Reprendre le montage ›" }))
    const montage = await waitFor(() => {
      const trouve = document.querySelector("[data-montage]")
      if (!trouve) throw new Error("le montage ne s'est pas rouvert")
      return trouve as HTMLElement
    })

    // Le curseur du montage part de l'image 0 : la barre d'espace la prend.
    fireEvent.keyDown(window, { key: " " })
    fireEvent.click(
      within(montage).getByRole("button", { name: /Reprendre « marche » · 5 images/ }),
    )

    await waitFor(() =>
      expect(document.querySelector("[data-atelier-de-bande]")).toBeTruthy(),
    )
    // **Une correction, pas une bande de plus.** Un `POST /api/strips` ici
    // laisserait deux animations là où l'auteur en corrigeait une.
    expect(
      appels.some((a) => a.url === "/api/strips" && Boolean(a.corps)),
    ).toBe(false)
    const parti = appels.find(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )?.corps as { prises: Prise[]; chutier: Prise[] }
    // L'image ajoutée se pose **au bout**, et pas à son rang de numéro : sur une
    // reprise, l'ordre du ruban vient de l'auteur, et la ranger le défairait.
    expect(parti.prises.map((p) => p.numero)).toEqual([12, 14, 16, 18, 0])
    // ⚠️ **Une recette individuelle voyage avec sa prise** : les images gardées
    // retrouvent la leur, l'image neuve n'en a aucune.
    expect(parti.prises[1].recette?.passes[0]?.tolerance).toBe(61)
    expect(parti.prises[4].recette ?? null).toBeNull()
    expect(parti.chutier).toEqual([])
  })

  test("reprendre le montage envoie au chutier ce qu'on y laisse tomber", async () => {
    // *Ce que vous laissez tombe au chutier, pas à la corbeille* : changer
    // d'avis sur une image ne doit pas effacer ce qu'on avait réglé dessus.
    const { atelier, appels } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    fireEvent.click(atelier.getByRole("button", { name: "Reprendre le montage ›" }))
    const montage = await waitFor(() => {
      const trouve = document.querySelector("[data-montage]")
      if (!trouve) throw new Error("le montage ne s'est pas rouvert")
      return trouve as HTMLElement
    })

    // Le curseur va sur la deuxième image retenue — celle qui porte sa recette
    // — et la barre d'espace la laisse.
    for (let pas = 0; pas < 14; pas += 1)
      fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: " " })
    fireEvent.click(
      within(montage).getByRole("button", { name: /Reprendre « marche » · 3 images/ }),
    )

    await waitFor(() =>
      expect(document.querySelector("[data-atelier-de-bande]")).toBeTruthy(),
    )
    const parti = appels.find(
      (a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps),
    )?.corps as { prises: Prise[]; chutier: Prise[] }
    expect(parti.prises.map((p) => p.numero)).toEqual([12, 16, 18])
    expect(parti.chutier.map((p) => p.numero)).toEqual([14])
    expect(parti.chutier[0].recette?.passes[0]?.tolerance).toBe(61)
  })

  const ouvrirLaReprise = async (bande: Partial<Bande>) => {
    const { atelier, appels } = await ouvrirLAtelier({
      atelierDeBande: { ...ATELIER_RENDU, bande: { ...GARDEE_A7, ...bande } },
    })
    await atelier.findByText(/en pixels du sprite/)
    fireEvent.click(atelier.getByRole("button", { name: "Reprendre le montage ›" }))
    const montage = await waitFor(() => {
      const trouve = document.querySelector("[data-montage]")
      if (!trouve) throw new Error("le montage ne s'est pas rouvert")
      return trouve as HTMLElement
    })
    return { atelier, appels, montage, dedans: within(montage) }
  }

  /** Ce que la reprise a écrit sur l'animation — prises et chutier. */
  const cePartiParLaReprise = (appels: { url: string; corps: unknown }[]) =>
    appels.find((a) => a.url === "/api/strips/bande-marche" && Boolean(a.corps))
      ?.corps as { prises: Prise[]; chutier: Prise[] }

  test("reprendre le montage ne retrie pas le ruban", async () => {
    // ⚠️ **L'ordre du ruban est l'ordre de l'export**, et une reprise n'a pas le
    // droit de le défaire. Le montage rangeait toute image ajoutée par numéro —
    // ce qui est juste sur un montage neuf, où il n'y a pas d'autre ordre, et
    // faux ici : celui-là vient de l'auteur, qui a déplacé ses images à la main.
    // Une animation reprise pour y ajouter une seule image revenait rangée par
    // numéro. Vu au navigateur le 5 septembre 2026.
    const prises = [
      GARDEE_A7.prises[0],
      GARDEE_A7.prises[3],
      GARDEE_A7.prises[1],
      GARDEE_A7.prises[2],
    ]
    const { appels, dedans } = await ouvrirLaReprise({ prises })

    // Elle s'ouvre sur l'ordre de l'animation, pas sur celui du clip.
    fireEvent.click(dedans.getByRole("button", { name: "Image 9" }))
    fireEvent.click(
      dedans.getByRole("button", { name: /Reprendre « marche » · 5 images/ }),
    )

    await waitFor(() =>
      expect(document.querySelector("[data-atelier-de-bande]")).toBeTruthy(),
    )
    // L'image ajoutée se pose **au bout** — on la déplacera dans l'atelier —, et
    // les quatre autres n'ont pas bougé d'un rang.
    expect(cePartiParLaReprise(appels).prises.map((p) => p.numero)).toEqual([
      12, 18, 14, 16, 9,
    ])
  })

  test("une image du chutier reprise au montage quitte le chutier", async () => {
    // *Une image est dans la bande, ou au chutier, jamais dans les deux.* Une
    // image mise de côté que le montage reprend était dans les deux à la fois :
    // le ruban la jouait, et le chutier proposait encore de la poser.
    const { appels, dedans } = await ouvrirLaReprise({
      chutier: [{ numero: 9, clip: "", dx: 3, dy: 0 }],
    })

    // On la reprend sur la pellicule, comme n'importe quelle image du clip : le
    // chutier est une réserve de l'atelier, le montage ne connaît que le clip.
    fireEvent.click(dedans.getByRole("button", { name: "Image 9" }))
    fireEvent.click(
      dedans.getByRole("button", { name: /Reprendre « marche » · 5 images/ }),
    )

    await waitFor(() =>
      expect(document.querySelector("[data-atelier-de-bande]")).toBeTruthy(),
    )
    const parti = cePartiParLaReprise(appels)
    expect(parti.prises.map((p) => p.numero)).toEqual([12, 14, 16, 18, 9])
    // Et elle retrouve sa poussée : c'est **sa** prise qui remonte, pas une neuve.
    expect(parti.prises[4]?.dx).toBe(3)
    expect(parti.chutier).toEqual([])
  })

  test("« Reprendre le montage » est fermé avec sa raison sur une animation mêlée", async () => {
    // **Le montage ne montre qu'un clip.** Y reprendre le découpage d'une
    // animation qui puise dans deux laisserait tomber les images de l'autre —
    // sans un mot, et c'est très exactement ce que la version interdit.
    const prises: Prise[] = [
      ...GARDEE_A7.prises.slice(0, 3),
      { numero: 4, clip: "clip-b", dx: 0, dy: 0 },
    ]
    const { atelier } = await ouvrirLAtelier({
      atelierDeBande: {
        ...ATELIER_RENDU,
        bande: { ...GARDEE_A7, prises, clips: ["clip-a", "clip-b"], melangee: true },
        images_par_clip: { "clip-a": 22, "clip-b": 18 },
        ecarts: prises.map(() => ({ places: [], fenetre_davant: false })),
      },
    })
    await atelier.findByText(/en pixels du sprite/)

    expect(
      atelier
        .getByRole("button", { name: "Reprendre le montage ›" })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(await atelier.findByText(/laisserait tomber celles de l'autre/)).toBeTruthy()
  })

  test("« Reprendre le montage » attend que les corrections soient enregistrées", async () => {
    const { atelier, cadre } = await ouvrirSeparee()
    await atelier.findByText(/en pixels du sprite/)

    pousserDUnPixel(cadre)

    const bouton = await atelier.findByRole("button", {
      name: "Reprendre le montage ›",
    })
    await waitFor(() => expect(bouton.hasAttribute("disabled")).toBe(true))
    expect(await atelier.findByText(/Des corrections attendent/)).toBeTruthy()
  })
})

// ── V3.02 — la fiche d'un clip ──────────────────────────────────────────────
//
// « La vignette d'un clip ne s'ouvre nulle part — le bouton *Ouvrir le résultat*
// est là, désactivé. » Depuis cette tranche, un clip se regarde comme une
// image : un clic ouvre la même colonne de droite, la vidéo tourne en boucle
// avec jeu et pause, ce que le clip porte et ce qu'il a produit se lisent, et
// *Découper* reste la porte du montage.
//
// **Rien ici ne dépense**, et l'ouvrir ne réclame rien au serveur : la fiche se
// bâtit de ce que la galerie avait déjà relu — la seule demande de l'ouverture
// est la liste des bandes du clip, une énumération que la galerie ne tient pas.

describe("V3.02 — la fiche d'un clip", () => {
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

  /** Ouvrir le résultat d'un clip arrivé, **la seule porte** : le clic de sa
   *  vignette, exactement le geste qui ouvre la fiche d'une image. */
  const ouvrirLeClip = async (
    options: Parameters<typeof serveurDouble>[0] = {},
    etat: Partial<Etat> = {},
  ) => {
    const double = serveurDouble(options)
    const flux = await monter(double.fetchDouble, {
      ...ETAT,
      generations: [clipRendu("clip-a", false)],
      ...etat,
    })
    await allerAuxVideos()
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir le résultat" }))
    const panneau = await waitFor(() => {
      const cadre = document.querySelector("[data-fiche-clip]")
      if (!cadre) throw new Error("la fiche du clip ne s'est pas ouverte")
      return cadre as HTMLElement
    })
    return { ...double, flux, panneau: within(panneau) }
  }

  test("un clip s'ouvre comme une image : la vidéo tourne, ce qu'il porte se lit", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    // **La vidéo, pas une image prélevée** : la vignette du clip, c'est la
    // vidéo elle-même — son rythme, ses fondus — et la barre de lecture du
    // lecteur se déplace parce que la route répond aux demandes de plage.
    const video = document.querySelector("video")
    expect(video?.getAttribute("src")).toBe("/api/clips/clip-a/video")
    expect(video?.getAttribute("loop")).not.toBeNull()

    // Ce qu'il porte, mesuré sur le fichier et jamais déduit.
    expect(
      panneau.getByText("121 images · 24 i/s · 5 s demandées · 1:1 · 480p"),
    ).toBeTruthy()
    // Le montant de la facture, et la phrase qui dit s'il a été relu.
    expect(panneau.getByText("$0,0670")).toBeTruthy()
    expect(panneau.getByText("montant relu chez le fournisseur")).toBeTruthy()
    // Le texte qui l'a fait, mot pour mot — corrigé ou non par le tiroir.
    expect(panneau.getByText("walking cycle, walking in place")).toBeTruthy()

    // **Rien ici ne dépense**, et la phrase le dit comme au pied du montage.
    expect(panneau.getByText(/rien ici ne dépense/)).toBeTruthy()
    // La fiche n'a pas ouvert le montage : la seule demande de l'ouverture est
    // la liste des bandes, et tout le reste venait déjà de la galerie.
    expect(appels.some((a) => a.url.startsWith("/api/montage/"))).toBe(false)
    expect(appels.some((a) => a.url.startsWith("/api/strips?"))).toBe(true)
  })

  test("la fiche nomme ce que le clip anime, et se ferme sur la grille où elle était", async () => {
    const anime = clipRendu("clip-a", false, {
      personnage: "le-nain",
      pose: "marche",
      direction: "sud",
    })
    const { panneau } = await ouvrirLeClip(
      { personnages: [personnage("Le nain")] },
      { generations: [anime] },
    )

    // La case résolue en noms — comme la fiche d'une image résout les siens —
    // et le mouvement inscrit à la commande, que le montage relit aussi.
    expect(panneau.getByText("Le nain · marche · sud")).toBeTruthy()
    expect(panneau.getByText("mouvement : marche")).toBeTruthy()

    fireEvent.click(panneau.getByLabelText("Fermer la fiche"))
    await waitFor(() => expect(document.querySelector("[data-fiche-clip]")).toBeNull())
    // La grille est toujours là, et la tuile du clip reste à découper.
    expect(screen.getByRole("button", { name: "Découper ›" })).toBeTruthy()
  })

  test("les bandes du clip s'y listent, et chacune s'ouvre dans l'atelier d'une animation", async () => {
    const { panneau, appels } = await ouvrirLeClip({
      montage: {
        ...MONTAGE_RENDU,
        bandes: [bandeRendue("repos", [4, 5, 6])],
      },
    })

    const bande = await panneau.findByRole("button", { name: /^repos/ })
    expect(bande).toBeTruthy()
    fireEvent.click(bande)

    // **Chacune s'ouvre dans l'atelier d'une animation** (A7) — c'est l'autre
    // porte d'un clip : on retravaille ce qui est gardé, on ne refait pas le
    // montage, et la fiche se referme dans le voyage.
    await waitFor(() => {
      expect(document.querySelector("[data-atelier-de-bande]")).toBeTruthy()
    })
    expect(appels.some((a) => a.url === "/api/strips/bande-repos")).toBe(true)
    expect(document.querySelector("[data-fiche-clip]")).toBeNull()
  })

  test("un clip qui n'a rien produit le dit simplement", async () => {
    const { panneau } = await ouvrirLeClip()
    expect(await panneau.findByText(/aucune bande gardée/)).toBeTruthy()
  })

  test("découper se prend depuis la fiche, et ouvre le montage", async () => {
    const { panneau, appels } = await ouvrirLeClip()

    fireEvent.click(panneau.getByRole("button", { name: "Découper ›" }))
    await waitFor(() => {
      expect(document.querySelector("[data-montage]")).toBeTruthy()
    })
    expect(appels.some((a) => a.url === "/api/montage/clip-a")).toBe(true)
  })

  test("le sprite dont le clip est parti se lit, et sa fiche s'ouvre comme une image", async () => {
    const departeur = asset("effe-0", "le voyageur")
    const avecDepart = clipRendu("clip-a", false)
    avecDepart.clip = {
      ...(avecDepart.clip as NonNullable<typeof avecDepart.clip>),
      depart: "effe-0",
    }
    // Plus récent que l'image qu'il a animée : sa tuile vient en premier.
    avecDepart.cree_le = 2_000_000_000

    // **L'asset au double comme au flux** : la galerie relit sa grille au
    // montage, et un double qui répondrait *il n'y a pas d'image* effacerait
    // la tuile de l'asset sous la fiche — ce que le premier essai de la
    // tranche a payé en course, avant de passer l'asset aux deux endroits.
    const double = serveurDouble({ assets: [departeur] })
    const flux = await monter(double.fetchDouble, {
      ...ETAT,
      generations: [avecDepart],
      assets: [departeur],
    })
    // **Les deux tuiles ne sont plus côte à côte** : le clip est sous *Vidéos*,
    // l'image qu'il a animée sous *Images*. C'est justement ce que la fiche du
    // clip existe pour rattraper — le lien vers son sprite de départ traverse
    // les deux onglets.
    allerA("Galerie")
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Ouvrir le résultat" }),
      ).toHaveLength(1),
    )
    await allerAuxVideos()
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Ouvrir le résultat" }),
      ).toHaveLength(1),
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Ouvrir le résultat" })[0])
    // Le sprite de départ se lit dans la fiche — par sa poignée unique, pas par
    // son nom : le même nom vit aussi sur la tuile de l'image.
    const depart = await screen.findByLabelText(
      "l'image dont ce clip est parti — ouvrir sa fiche",
    )
    expect(depart).toBeTruthy()
    fireEvent.click(depart)

    // La fiche du clip cède la place à celle de l'image — la même colonne, et
    // la porte de l'établi qui n'appartient qu'aux images.
    await waitFor(() => {
      expect(document.querySelector("[data-fiche-clip]")).toBeNull()
      expect(
        screen.getByRole("button", { name: "La retoucher" }),
      ).toBeTruthy()
    })
    void flux
  })

  test("un clip corrigé au tiroir se relit avec son texte, et un clip jeté referme la fiche", async () => {
    const corrige = clipRendu("clip-a", false)
    corrige.demande = {
      ...corrige.demande,
      prompt: "Marche lente, en place — corrigé dans le tiroir.",
    }
    const { panneau, flux } = await ouvrirLeClip({}, { generations: [corrige] })

    // Le texte qui est parti, pas celui du mouvement — 8septies, refermé du
    // disque avec son texte à lui.
    expect(
      panneau.getByText("Marche lente, en place — corrigé dans le tiroir."),
    ).toBeTruthy()

    // **Un clip jeté quitte la grille, et sa fiche se referme avec sa tuile.**
    // Une colonne ouverte sur ce qui n'existe plus serait une porte sur un mur.
    flux.emettre("generation", {
      ...corrige,
      clip: { ...(corrige.clip as NonNullable<typeof corrige.clip>), jete: true },
    })
    await waitFor(() => {
      expect(document.querySelector("[data-fiche-clip]")).toBeNull()
    })
  })
})

// ── B1 : le miroir — la septième place, et la troisième fabrique ─────────────
//
// **La panne se compte en dollars.** Un personnage vu de dessus se dessine dans
// quatre directions ; celui qui marche vers l'ouest est le miroir exact de celui
// qui marche vers l'est. Le produit n'avait aucune façon de le dire, donc les
// deux se payaient.
//
// Ce qui se mesure sur des pixels — que retourner deux fois rende l'image de
// départ, que la palette ne bouge pas, que l'empreinte des recettes déjà écrites
// ne change pas — est tenu par `tests/test_b1.py`. Ce qui vit ici est ce que
// l'écran montre, et surtout **ce qu'il refuse de deviner** : la paire de
// directions vient du serveur, jamais d'une table écrite à l'écran.

describe("B1 — le miroir", () => {
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

  const IMAGE = asset("bbbb2222-0", "le pèlerin, au repos")

  const ouvrirLeRetournement = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const nain = personnage("Le pèlerin")
    const double = serveurDouble({
      assets: [IMAGE],
      personnages: [
        {
          ...nain,
          cases: nain.cases.map((c) =>
            c.pose === "repos" ? { ...c, images: [IMAGE] } : c,
          ),
        },
      ],
      ...options,
    })
    await monter(double.fetchDouble)
    await ouvrirLEtabli("Le pèlerin")
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Ouvrir ${IMAGE.label} dans son outil`,
      }),
    )
    const cadre = within(
      await waitFor(() => {
        const ecran = document.querySelector("[data-retouche]")
        if (!ecran) throw new Error("la retouche ne s'est pas ouverte")
        return ecran as HTMLElement
      }),
    )
    fireEvent.click(cadre.getByRole("button", { name: /^Retournement/ }))
    return { ...double, cadre }
  }

  // ── « Le retournement est une place de la recette, en queue et avant la
  //     main » ────────────────────────────────────────────────────────────────

  /** Ce que la colonne de réglages écrit sous le nom de la table ouverte —
   *  l'état, puis la valeur. **C'est là que le résumé se lit depuis `B25`**, et
   *  non plus sur la puce de la barre : la retouche écrit la valeur une fois,
   *  là où on la règle. */
  const ceQueLaColonneDit = () =>
    (document.querySelector("[data-reglages-de-la-table]") as HTMLElement).textContent ?? ""

  test("le sens pose la place, et la colonne la résume", async () => {
    const { cadre, appels } = await ouvrirLeRetournement()

    fireEvent.click(cadre.getByRole("button", { name: "miroir gauche-droite" }))

    // Le résumé est la valeur, jamais le fait qu'il y en ait une.
    await waitFor(() => expect(ceQueLaColonneDit()).toContain("miroir gauche-droite"))

    const pose = derniereRecetteEnvoyee(appels)
    expect(pose).toBeTruthy()
    expect(pose!.retournement!.sens).toBe("gauche-droite")
  })

  test("les neuf autres moteurs sont cliquables, et posent la place (B18)", async () => {
    // **Ils paraissaient grisés jusqu'à B18** — c'était ce qui disait ce que
    // l'atelier saurait faire. Depuis, ce sont de vrais réglages : les cacher à
    // nouveau, ou les laisser grisés, referait croire que le miroir
    // gauche-droite est tout ce qu'on puisse vouloir.
    const { cadre, appels } = await ouvrirLeRetournement()

    fireEvent.click(cadre.getByRole("button", { name: "miroir haut-bas" }))

    await waitFor(() => expect(ceQueLaColonneDit()).toContain("miroir haut-bas"))
    expect(derniereRecetteEnvoyee(appels)!.retournement!.sens).toBe("haut-bas")

    fireEvent.click(cadre.getByRole("button", { name: "miroir, sauf ici" }))
    await waitFor(() => expect(ceQueLaColonneDit()).toContain("miroir, sauf ici"))
  })

  // ⚠️ **Quatre essais de `B1` sont partis avec l'ancien écran** (`B25`), et
  // ce sont deux pièces entières que la chaîne redessinée ne reprend pas :
  //
  // - **le pied de colonne qui vide une place** — *Sans retournement ›*, et ses
  //   huit sœurs sur les huit autres tables. Endormir une place existe dans
  //   l'écran neuf (son interrupteur) ; la **vider** n'y existe nulle part, et
  //   les deux gestes sont différents — c'est l'invariant du lot U.
  // - **la fabrique du miroir** — *ça se range en …* puis *Retourner ›*, qui
  //   écrit une image de plus dans la case d'en face
  //   (`POST /api/assets/<id>/mirror`), avec la direction proposée par le
  //   serveur et sa raison quand il ne sait pas. Elle n'existe que dans
  //   `Places.tsx`, et `B25` la rend injoignable en retirant la porte qui y
  //   menait.
  //
  // Les deux sont notées dans `docs/PLAN-carnet.md` § `B27`. Le serveur, lui,
  // n'a pas bougé : `tests/test_b1.py` tient la route du miroir.

  // ── « L'image retournée se range dans la direction qu'on lui désigne, et la
  //     case se remplit » ──────────────────────────────────────────────────────

  /** Une chose à quatre directions dont **une seule** est dessinée — le cas
   *  mesuré du dépôt : michel porte 25 images en `droite` et aucune en
   *  `gauche`. */
  const casesAvecUneSeuleDirection = (remplie: string, images: Asset[]) =>
    PLAN.map((p) => ({
      pose: p.identifiant,
      demandees: p.images * QUATRE.length,
      images: p.identifiant === "repos" ? images : [],
      ...VIDE_C3,
      bandes_demandees: QUATRE.length,
      directions: QUATRE.map((d) => ({
        ...d,
        demandees: p.images,
        images: p.identifiant === "repos" && d.identifiant === remplie ? images : [],
        a_confirmer: 0,
        bandes: [],
        bandes_ecartees: [],
      })),
      directions_rangees: [],
    }))

  const VUE_A_QUATRE: DirectionsDuJeu = {
    directions: QUATRE,
    origine: "vue",
    vue: "vue-dessus-34",
    vue_libelle: "De dessus, 3/4",
    proposees: QUATRE,
  }

  const ouvrirLaMatrice = async (
    options: Parameters<typeof serveurDouble>[0] = {},
  ) => {
    const image = asset("cccc3333-0", "le pèlerin vers l'est")
    const double = serveurDouble({
      directions: VUE_A_QUATRE,
      personnages: [
        personnage("Balthazar", {
          cases: casesAvecUneSeuleDirection("est", [image]),
        }),
      ],
      ...options,
    })
    await monter(double.fetchDouble)
    return { ...double, etabli: await ouvrirLEtabli("Balthazar"), image }
  }

  test("la case vide d'en face gagne un geste gratuit, et lui seul", async () => {
    // **Il ne paraît que s'il y a de quoi retourner.** Un bouton grisé sur les
    // cases où le miroir ne s'applique pas serait une colonne de refus — et le
    // nord, qu'un miroir gauche-droite ne fabrique pas, n'en a pas.
    const { etabli } = await ouvrirLaMatrice({
      miroirs: { "cccc3333-0": { propose: "ouest", raison: null } },
    })

    expect(
      await etabli.findByRole("button", { name: "Retourner vers ouest pour repos" }),
    ).toBeTruthy()
    for (const nom of ["sud", "nord", "est"])
      expect(
        etabli.queryByRole("button", { name: `Retourner vers ${nom} pour repos` }),
      ).toBeNull()
  })

  test("le geste appelle la fabrique avec la case qu'il remplit", async () => {
    const { etabli, appels } = await ouvrirLaMatrice({
      miroirs: { "cccc3333-0": { propose: "ouest", raison: null } },
    })

    fireEvent.click(
      await etabli.findByRole("button", { name: "Retourner vers ouest pour repos" }),
    )

    await waitFor(() => {
      const parti = appels.find(
        (a) => a.url === "/api/assets/cccc3333-0/mirror" && a.corps,
      )
      expect(parti).toBeTruthy()
      expect((parti!.corps as { direction: string }).direction).toBe("ouest")
    })
  })

  test("sans paire connue, aucune case ne propose de retourner", async () => {
    // **La table du domaine ne connaît que les identifiants que le produit
    // livre, et elle n'invente rien.** L'auteur nomme ses directions ; deviner
    // qu'un mot français en désigne un autre serait la déduction que le produit
    // refuse ailleurs.
    const { etabli } = await ouvrirLaMatrice()

    await etabli.findByRole("button", { name: "Fabriquer repos vers ouest" })
    for (const nom of ["sud", "nord", "est", "ouest"])
      expect(
        etabli.queryByRole("button", { name: `Retourner vers ${nom} pour repos` }),
      ).toBeNull()
  })

  // ── « Une image retournée porte sa provenance, distincte d'une image
  //     générée » ──────────────────────────────────────────────────────────────

  test("la tuile d'un miroir dit d'où elle vient, à la place d'un prix", async () => {
    // **Il n'y a pas de durée sur une étiquette de tuile, et on n'en invente
    // pas** : aucun composant n'en lit une sur un asset. Ce qui distingue les
    // deux images est le prix — l'une en a un, l'autre n'a rien coûté.
    const miroir: Asset = {
      ...asset("bbbb2222-1", "le pèlerin · miroir ouest"),
      parent: "bbbb2222-0",
      direction: "ouest",
      consomme: 0,
      cout_usd: 0,
      recette: { ...RECETTE_VIDE, retournement: { sens: "gauche-droite" } },
    }
    const { fetchDouble } = serveurDouble({ assets: [miroir, IMAGE] })
    await monter(fetchDouble, { ...ETAT, assets: [miroir, IMAGE] })
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // À la taille de repos, le mot seul — la ligne dispose de 120 px, et
    // « gratuit » y prendrait la place des dimensions.
    expect(screen.getByText("miroir")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "2×" }))
    await waitFor(() => expect(screen.getByText("miroir · gratuit")).toBeTruthy())

    // Et l'image de départ garde son prix : l'étiquette dit ce qui a été payé.
    expect(screen.getByText("$0,0245")).toBeTruthy()
  })

  test("une image générée sur laquelle on pose un miroir garde son prix", async () => {
    // **Les deux faits ensemble, jamais l'un sans l'autre** — la recette dit
    // *miroir*, la dépense dit *payé*. L'étiquette dit ce qui a été payé.
    const retouchee: Asset = {
      ...asset("bbbb2222-2", "le pèlerin, retourné à la table"),
      recette: { ...RECETTE_VIDE, retournement: { sens: "gauche-droite" } },
    }
    const { fetchDouble } = serveurDouble({ assets: [retouchee] })
    await monter(fetchDouble, { ...ETAT, assets: [retouchee] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.click(screen.getByRole("button", { name: "2×" }))
    await waitFor(() => expect(screen.getByText("$0,0245")).toBeTruthy())
    expect(screen.queryByText("miroir · gratuit")).toBeNull()
  })

  test("une place endormie ne fait pas d'une image un miroir", async () => {
    // **Endormie, la place ne compte pas** : l'image sort telle qu'elle est
    // entrée, et une étiquette qui dirait « miroir » devant une image non
    // retournée serait un effet resté en travers.
    const endormi: Asset = {
      ...asset("bbbb2222-3", "le pèlerin, retournement éteint"),
      consomme: 0,
      cout_usd: 0,
      recette: {
        ...RECETTE_VIDE,
        retournement: { sens: "gauche-droite" },
        veille: ["retournement"],
      },
    }
    const { fetchDouble } = serveurDouble({ assets: [endormi] })
    await monter(fetchDouble, { ...ETAT, assets: [endormi] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    fireEvent.click(screen.getByRole("button", { name: "2×" }))
    await waitFor(() =>
      expect(
        document.querySelector("[data-mesures]")?.textContent,
      ).toContain("$0,0000"),
    )
    expect(screen.queryByText("miroir · gratuit")).toBeNull()
    expect(screen.queryByText("miroir")).toBeNull()
  })

  // ── « Un écran neuf doit une ligne au guide » ──────────────────────────────

  test("la table du retournement est expliquée", () => {
    // Le guide est un volet scopé à l'écran ouvert depuis B7 : l'ouvrir sans
    // être sur les tables ne prouverait plus rien. Ce qui comptait déjà avant
    // B7 — un écran neuf doit une ligne au corpus — se vérifie directement.
    //
    // **`retournement.direction` a quitté le corpus en `GU5`** : la question
    // a déménagé dans la fenêtre *Enregistrer sous…*, qui porte déjà
    // `enregistrer-sous.case`. Ce qui reste posé dans la table elle-même, et
    // qui doit donc rester expliqué ici, c'est le sens du retournement.
    for (const cle of ["etape.retournement", "retournement.sens"]) {
      expect(AIDE[cle], `${cle} — absent du corpus`).toBeTruthy()
    }
  })
})

// ── B3 : les huit états — la grille dit ce qu'elle ne montre pas ────────────
//
// **Trois pertes silencieuses** (`docs/PLAN-carnet.md` § B3) : le décalage
// horizontal que le serveur jetait à chaque réglage voisin et l'import qui
// perd un fichier sans le dire sont tenus ailleurs — `tests/test_b3.py` pour
// le premier, R3 pour le second, déjà en place. Ce fichier ne tient que la
// troisième, la seule des trois qui vit à l'écran : la grille s'arrêtait à
// 200 images sans le dire, et l'auteur croyait avoir tout vu.

describe("B3 — la grille dit ce qu'elle ne montre pas", () => {
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

  const beaucoupDassets = (compte: number) =>
    Array.from({ length: compte }, (_, i) => asset(`zzzz${i}-0`, `sujet ${i}`))

  test("au-delà du plafond, elle dit combien elle en cache et charge la suite sur demande", async () => {
    const tous = beaucoupDassets(205)
    const { fetchDouble, appels } = serveurDouble({ assets: tous })
    // **Le premier message du flux est déjà coupé à 200** dans le vrai serveur
    // (`atelier.bibliotheque.grille_courante`, `atelier/api/routes.py`) : le
    // double doit reproduire cette coupe pour ne pas fabriquer une course que
    // le produit n'a pas — sans quoi la grille afficherait un instant les 205
    // avant que `GET /assets` ne la ramène à 200.
    await monter(fetchDouble, { ...ETAT, assets: tous.slice(0, 200) })

    await waitFor(() => expect(tuiles()).toHaveLength(200))
    expect(screen.getByText("200 montrées sur 205")).toBeTruthy()

    // **On laisse le premier message du flux se poser** avant de charger la
    // suite : il fait passer le projet ouvert de « inconnu » à « bac à
    // sable », ce qui redemande déjà la grille une fois de son côté — cliquer
    // pendant cette course ferait lire un plafond remis à zéro par ce
    // second appel, jamais celui que le clic vient de poser.
    await waitFor(() =>
      expect(
        appels.filter((a) => a.url.startsWith("/api/assets")).length,
      ).toBeGreaterThanOrEqual(2),
    )

    fireEvent.click(screen.getByRole("button", { name: "Charger la suite ›" }))

    // **La même requête, plus large** — jamais un second appel qui
    // s'additionnerait à la première page.
    await waitFor(() => expect(tuiles()).toHaveLength(205))
    expect(screen.queryByText(/montrées sur/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Charger la suite ›" })).toBeNull()

    const dernier = [...appels].reverse().find((a) => a.url.startsWith("/api/assets?"))
    expect(new URL(dernier!.url, "http://x").searchParams.get("limite")).toBe("400")
  })

  test("en dessous du plafond, la grille ne dit rien", async () => {
    const tous = beaucoupDassets(3)
    const { fetchDouble } = serveurDouble({ assets: tous })
    await monter(fetchDouble, { ...ETAT, assets: tous })

    await waitFor(() => expect(tuiles()).toHaveLength(3))
    expect(screen.queryByText(/montrées sur/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Charger la suite ›" })).toBeNull()
  })
})

// ── B0 · La navigation de l'atelier ─────────────────────────────────────────
//
// **Le châssis neuf, avec un seul lieu réellement branché : le tableau de bord
// du jeu.** C'est la balle traçante — si le carnet, la pile de lieux et l'aide
// de navigation tiennent sur un lieu, ils tiendront sur vingt. Tout le reste
// continue de s'ouvrir comme avant, à l'intérieur de la surface, et c'est ce
// que le dernier essai de ce bloc vérifie.

describe("B0 — la navigation de l'atelier", () => {
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

  const navigation = () => screen.getByRole("complementary", { name: "Navigation du jeu" })

  // ── « Le carnet ne se ferme jamais tout seul, même pendant une génération »

  test("la navigation reste à l'écran quel que soit le lieu où l'on va", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // Aucun écran de travail ne prend la fenêtre entière : les six portes
    // restent disponibles pour aller voir ailleurs et revenir.
    expect(navigation()).toBeTruthy()
    allerA("Créer")
    expect(navigation()).toBeTruthy()
    allerA("Univers")
    expect(navigation()).toBeTruthy()
    allerA("Galerie")
    expect(navigation()).toBeTruthy()
  })

  test("il reste ouvert pendant qu'une image est en route", async () => {
    const { fetchDouble } = serveurDouble()
    const flux = await monter(fetchDouble)

    // Une génération annoncée par le flux : c'est le moment où l'ancien produit
    // enfermait — un écran par-dessus, et plus de sortie.
    flux.emettre("generation", generation("gggg1111", 1, "en_cours"))

    expect(navigation()).toBeTruthy()
    // Et l'on va effectivement ailleurs pendant qu'elle tourne.
    allerA("Créer")
    expect(navigation()).toBeTruthy()
  })

  test("les six portes de la maquette sont présentes une fois chacune", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    const atelier = within(navigation()).getByRole("navigation", { name: "Atelier" })
    expect(within(atelier).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Le jeu", "Univers & toile", "Codex", "Galerie", "Fabrications", "Livrer au jeu",
    ])
  })

  test("une seule porte est active à la fois", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)
    const atelier = within(navigation()).getByRole("navigation", { name: "Atelier" })
    fireEvent.click(within(atelier).getByRole("button", { name: "Univers & toile" }))
    expect(within(atelier).getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1)
    expect(within(atelier).getByRole("button", { name: "Univers & toile" }).getAttribute("aria-current")).toBe("page")
  })

  test("le fil se lit depuis la pile, et remonter coupe la profondeur", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // Les dépenses ne sont pas une porte : le total de l'en-tête les ajoute à
    // la pile au-dessus de la Galerie qui reste active.
    fireEvent.click(screen.getByTitle("Ouvrir les dépenses"))
    const fil = within(await screen.findByRole("navigation", { name: "Où l'on est" }))
    expect(fil.getByText("Les dépenses")).toBeTruthy()
    expect(ouverture("Galerie")).toBe("true")

    // Revenir par l'étage parent enlève cette profondeur au lieu de changer
    // d'onglet ou de laisser l'écran des dépenses caché sous la galerie.
    fireEvent.click(fil.getByRole("button", { name: "Bac à sable" }))
    await waitFor(() => expect(dernierEtageDuFil()).toBe("Galerie"))
    expect(await screen.findByRole("region", { name: "Grille des images" })).toBeTruthy()
    expect(ouverture("Galerie")).toBe("true")
  })

  // ── « Le tableau de bord du jeu s'ouvre » ─────────────────────────────────

  test("le nom du jeu ouvre le tableau de bord, et c'est le seul retour", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))

    const tableau = await screen.findByRole("main", {
      name: "Le jeu",
    })
    expect(tableau).toBeTruthy()
    // Il prend la surface, jamais la fenêtre : les portes restent là.
    expect(navigation()).toBeTruthy()
    // Et la grille des images n'est plus dessous — une seule surface à la fois.
    expect(screen.queryByRole("region", { name: "Grille des images" })).toBeNull()
  })

  test("le bouton principal du tableau de bord crée l'asset sans payer", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))
    const bouton = await screen.findByRole("button", { name: "Créer un sujet" })

    // *Cliquer ne coûte jamais* : l'asset est nommé avant toute fabrication,
    // aucune génération ne part depuis le tableau de bord.
    const paye = () => appels.filter((a) => a.url.startsWith("/api/generations"))
    const avant = paye().length
    fireEvent.click(bouton)
    expect(paye().length).toBe(avant)
    expect(await screen.findByRole("heading", { name: "Créer un sujet" })).toBeTruthy()
  })

  // ── B5 — la barre de complétude, les manques, et la feuille en attente ────

  /** Une planche arrivée qui attend un choix — le pendant minimal de celle de
   *  `R6`, faite ici pour ne pas dépendre d'un `describe` qui ne l'exporte
   *  pas : cinq images trouvées pour quatre demandées, ce qui suffit à
   *  déclencher `attend_un_choix`. */
  function pancheEnAttente(): Generation {
    const lot = generation("pppp0000", 1, "reussie")
    return {
      ...lot,
      pliage: {
        nombre: 4,
        colonnes: 2,
        lignes: 2,
        refus: null,
        trouvees: 5,
        mesures: [],
        ecartees: null,
        surplus: 1,
        pleines: [],
        attend_un_choix: true,
      },
    }
  }

  test("la barre et le manque d'une famille viennent du bilan servi par le serveur", async () => {
    const bilan: BilanDuJeu = {
      familles: [
        { cle: "personnages", compte: 1, complet: 0.5, manque_texte: "1 poses faites sur 2." },
      ],
      manques: [
        {
          quantite: 1,
          phrase: "« Le pèlerin » n'a pas 1 pose.",
          famille: "personnages",
          sujet: "le-pelerin",
          cout_usd: 0.02,
        },
      ],
      lot: { images: 1, feuilles: 1, cout_usd: 0.02 },
    }
    const { fetchDouble } = serveurDouble({ bilan })
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))
    const tableau = await screen.findByRole("main", {
      name: "Le jeu",
    })

    // La phrase de manque, sous la carte de famille — jamais recalculée à
    // l'écran, exactement ce que le serveur a rendu.
    expect(await within(tableau).findByText("1 poses faites sur 2.")).toBeTruthy()

    // « Ce qui manque le plus » : la ligne, son coût, et le total du lot —
    // annoncé avant de cliquer.
    expect(within(tableau).getByText("« Le pèlerin » n'a pas 1 pose.")).toBeTruthy()
    expect(within(tableau).getByText(/Pour les images fixes/)).toBeTruthy()
  })

  test("un manque gratuit s'affiche « rien », sans couleur d'alerte ni prix", async () => {
    const bilan: BilanDuJeu = {
      familles: [],
      manques: [
        {
          quantite: 1,
          phrase: "La septième ligne de la bible est vide.",
          famille: "personnages",
          sujet: "le-monde",
          cout_usd: 0,
        },
      ],
      lot: { images: 1, feuilles: 1, cout_usd: 0 },
    }
    const { fetchDouble } = serveurDouble({ bilan })
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))
    const tableau = await screen.findByRole("main", {
      name: "Le jeu",
    })
    expect(await within(tableau).findByText("rien")).toBeTruthy()
  })

  test("une feuille en attente montre son bandeau, puis disparaît une fois découpée", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble, { ...ETAT, generations: [pancheEnAttente()] })

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))
    const tableau = await screen.findByRole("main", {
      name: "Le jeu",
    })
    expect(
      await within(tableau).findByText("Une feuille attend d'être découpée"),
    ).toBeTruthy()

    // Cliquer mène à l'écran qui la montre déjà — la galerie — sans ouvrir de
    // lieu de plus.
    fireEvent.click(within(tableau).getByRole("button", { name: "Aller la découper" }))
    expect(
      await screen.findByRole("region", { name: "Grille des images" }),
    ).toBeTruthy()
  })

  test("sans planche en attente, le bandeau ne paraît pas", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Le jeu" }))
    await screen.findByRole("main", { name: "Le jeu" })
    expect(screen.queryByText("Une feuille attend d'être découpée")).toBeNull()
  })

  test("les portes de travail ouvrent leurs surfaces", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    allerA("Univers")
    expect(await cadreDuCodex()).toBeTruthy()
    allerA("Galerie")
    expect(
      await screen.findByRole("region", { name: "Grille des images" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Univers & toile" }))
    expect(await cadreDuCodex()).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Galerie" }))
    expect(
      await screen.findByRole("region", { name: "Grille des images" }),
    ).toBeTruthy()
  })

  test("changer de porte remplace la surface sans dupliquer la navigation", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Fabrications" }))
    expect(await screen.findByRole("main", { name: "Fabrications" })).toBeTruthy()
    expect(screen.getAllByRole("complementary", { name: "Navigation du jeu" })).toHaveLength(1)
  })
})

// ── B4 · L'ouverture ─────────────────────────────────────────────────────────
//
// Le point dur de la tranche : changer de jeu ne rechargeait que la
// bibliothèque, jamais l'univers — la bible, la taille de pixel et les
// grisés restaient ceux du jeu précédent jusqu'à reconnexion du flux. Ce
// qu'on mesure ici est que **l'univers suit**, sans recharger la page ; les
// grisés en dérivent au rendu, dans le même état, donc les suivre revient à
// suivre `univers` lui-même. Le tri par jeu et le chantier scopé ont leurs
// essais côté serveur, dans `tests/test_b4.py`.

describe("B4 — l'ouverture", () => {
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

  /** Un second jeu, avec un univers qu'on ne confond pas avec celui de « Bac
   *  à sable » : une autre taille de pixel, une autre palette, une bible qui
   *  porte un mot. */
  const UNIVERS_FORET: Univers = {
    ...UNIVERS,
    cible_px: 32,
    palette: ["#102030", "#a1b2c3"],
    bible: UNIVERS.bible.map((champ) =>
      champ.nom === "monde" ? { ...champ, texte: "forêt dense" } : champ,
    ),
    vide: false,
  }

  const PROJET_FORET: Projet = {
    identifiant: "foret",
    nom: "Forêt",
    cree_le: 1_787_900_000,
    dernier_travail_le: 1_787_900_000,
    assets: 3,
    total_usd: 0.5,
    univers: UNIVERS_FORET,
    pieces: [],
  }

  const DEUX_JEUX: Bibliotheque = {
    ...BIBLIOTHEQUE,
    projets: [BIBLIOTHEQUE.projets[0], PROJET_FORET],
  }

  /** Un double qui répond sur `PUT /api/projects/current` — ce que le socle
   *  `serveurDouble` ne tient pas, faute d'un essai qui en ait eu besoin
   *  avant cette tranche — et sur `GET /api/universe` selon le jeu ouvert.
   *  Le socle tient le reste, sans rien savoir de la bascule. */
  function doubleAvecDeuxJeux() {
    let courant = "bac-a-sable"
    const socle = serveurDouble()
    const fetchDouble = vi.fn(async (chemin: string, init?: RequestInit) => {
      const url = String(chemin)
      if (url === "/api/projects/current" && init?.method === "PUT") {
        const corps = JSON.parse(String(init.body)) as { projet: string | null }
        courant = corps.projet ?? "bac-a-sable"
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...DEUX_JEUX, courant }),
        } as Response
      }
      if (url.startsWith("/api/universe") && init?.method === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projet: courant,
            univers: courant === "foret" ? UNIVERS_FORET : UNIVERS,
            artworks: [],
          }),
        } as Response
      }
      return socle.fetchDouble(chemin, init)
    })
    return { fetchDouble }
  }

  test("changer de jeu depuis la navigation recharge l'univers, sans recharger la page", async () => {
    const { fetchDouble } = doubleAvecDeuxJeux()
    await monter(fetchDouble, { ...ETAT, bibliotheque: DEUX_JEUX })

    fireEvent.click(screen.getByRole("button", { name: /Changer de jeu/ }))
    fireEvent.click(await screen.findByText("Forêt"))

    // La bascule part par la route dédiée — pas par un rechargement.
    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(
          ([u, i]) =>
            String(u) === "/api/projects/current" &&
            (i as RequestInit | undefined)?.method === "PUT",
        ),
      ).toBe(true),
    )

    // Et l'univers du jeu qu'on vient d'ouvrir se lit — la bible, la taille
    // de pixel, la palette —, dans le même panneau que T4 (`App.test.tsx`
    // ligne ~4174) : « Ce qui part » n'a jamais deux vérités, ouvrir un jeu
    // ou reprendre un onglet mesurent la même chose.
    await ouvrirLesReglagesDeLAppel()
    const bloc = (await screen.findByText("Ce qui part")).parentElement!
    await waitFor(() => expect(bloc.textContent).toContain("32 px"))
    expect(bloc.textContent).toContain("2 couleurs")
    expect(bloc.textContent).toContain("1 champs")
  })

  test("choisir un jeu depuis l'écran d'ouverture l'ouvre, et referme l'écran", async () => {
    const { fetchDouble } = doubleAvecDeuxJeux()
    await monter(fetchDouble, { ...ETAT, bibliotheque: DEUX_JEUX })

    fireEvent.click(screen.getByRole("button", { name: /Changer de jeu/ }))

    const ecran = await screen.findByRole("main", {
      name: "Sur quel jeu travaille-t-on",
    })
    expect(within(ecran).getByText("Forêt")).toBeTruthy()
    expect(within(ecran).getByText("ouvert la dernière fois")).toBeTruthy()

    fireEvent.click(within(ecran).getByText("Forêt"))

    // L'écran se referme au clic, sans attendre la réponse du serveur — un
    // choix ne reste pas en suspens le temps d'un aller-retour réseau.
    await waitFor(() =>
      expect(
        screen.queryByRole("main", { name: "Sur quel jeu travaille-t-on" }),
      ).toBeNull(),
    )
    await waitFor(() =>
      expect(
        fetchDouble.mock.calls.some(([u, i]) => {
          if (String(u) !== "/api/projects/current") return false
          const corps = JSON.parse(String((i as RequestInit | undefined)?.body ?? "{}"))
          return corps.projet === "foret"
        }),
      ).toBe(true),
    )
  })
})

// ── RS2 · Refaire une planche ────────────────────────────────────────────────
//
// La case *Garder la mise en page de la référence* vit dans la préparation
// d'une image fixe. Elle part dans le corps de la relecture et dans celui qui
// paie, et retombe dès que l'appel est parti — comme la cible.
describe("refaire une planche (RS2)", () => {
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

  const CASE = "Garder la mise en page de la référence"

  test("la case part avec la relecture et avec l'appel, puis retombe", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "le personnage tient un bâton" } })
    const coche = screen.getByRole("checkbox", { name: new RegExp(CASE) }) as HTMLInputElement
    expect(coche.checked).toBe(false)
    expect(screen.getByText("Refait la planche jointe avec ta modification, vue par vue.")).toBeTruthy()
    fireEvent.click(coche)
    expect(coche.checked).toBe(true)

    await payer()

    await waitFor(() => {
      const relue = appels.find((a) => a.url === "/api/outgoing" && a.corps)
      expect(relue?.corps).toMatchObject({ garder_mise_en_page: true })
      const parti = appels.find((a) => a.url === "/api/generations" && a.corps)
      expect(parti?.corps).toMatchObject({
        prompt: "le personnage tient un bâton",
        garder_mise_en_page: true,
      })
    })

    // **L'intention est consommée** : l'appel suivant repart d'un sprite seul.
    const rouverte = (await champDePrompt()) as HTMLTextAreaElement
    fireEvent.change(rouverte, { target: { value: "un tonneau" } })
    await waitFor(() =>
      expect(
        (screen.getByRole("checkbox", { name: new RegExp(CASE) }) as HTMLInputElement).checked,
      ).toBe(false),
    )
  })

  test("sans la case, le corps d'un appel ordinaire ne change pas", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await payer()

    await waitFor(() => {
      const parti = appels.find((a) => a.url === "/api/generations" && a.corps)
      expect(parti?.corps).toBeTruthy()
      expect(parti?.corps).not.toHaveProperty("garder_mise_en_page")
    })
  })
})

// ── « Reprendre les réglages » recoche la case, quand la génération l'avait
//    (RS4) ───────────────────────────────────────────────────────────────────

describe("reprendre les réglages recoche la case (RS4)", () => {
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

  const CASE = "Garder la mise en page de la référence"

  test("la génération reprise portait la case cochée : elle revient cochée", async () => {
    const images = [asset("eeee5555-0")]
    const { fetchDouble } = serveurDouble({
      assets: images,
      garderMiseEnPageParti: true,
    })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    fireEvent.click(screen.getByRole("button", { name: "reprendre ses réglages" }))

    await waitFor(() =>
      expect(
        (screen.getByRole("checkbox", { name: new RegExp(CASE) }) as HTMLInputElement).checked,
      ).toBe(true),
    )
  })

  test("la génération reprise ne la portait pas : elle revient décochée", async () => {
    const images = [asset("eeee5555-0")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    fireEvent.click(screen.getByRole("button", { name: "reprendre ses réglages" }))

    await champDePrompt()
    expect(
      (screen.getByRole("checkbox", { name: new RegExp(CASE) }) as HTMLInputElement).checked,
    ).toBe(false)
  })
})

/** Le nom de l'étage où l'on est — le dernier du fil d'Ariane. */
function dernierEtageDuFil(): string | null {
  const fil = screen.queryByRole("navigation", { name: "Où l'on est" })
  return fil?.querySelector("[aria-current='page']")?.textContent ?? null
}
