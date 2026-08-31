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
import { AIDE, SANS_ENTREE } from "./aide"
import { COULEUR_TEINTE, NOM_TEINTE, RECETTE_VIDE, TEINTES } from "./api"
import type {
  ApercuPrompt,
  Asset,
  Bibliotheque,
  Carte,
  Depenses,
  Etat,
  TachesDeLAsset,
  CompteReferences,
  EtatCatalogue,
  Generation,
  EmplacementCorps,
  Impose,
  Lien,
  Personnage,
  Piece,
  Pose,
  Teinte,
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
  identifiant: "essai/modele",
  nom: "Essai : Modèle",
  references_max: 4,
  proportions: ["1:1", "3:2", "2:3", "16:9"],
  resolutions: [],
  variations_max: 4,
  options: {},
  refus: null,
}

const CATALOGUE: EtatCatalogue = {
  recu_le: 1_787_800_000,
  repli: false,
  raison: null,
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
  vide: true,
}

/** Le plan d'un projet neuf — six attitudes, une image chacune. Le vrai serveur
 *  en donne autant sans qu'aucune ligne n'ait été écrite (US-116). */
const PLAN: Pose[] = [
  { identifiant: "repos", nom: "repos", images: 1 },
  { identifiant: "marche", nom: "marche", images: 1 },
  { identifiant: "course", nom: "course", images: 1 },
  { identifiant: "attaque", nom: "attaque", images: 1 },
  { identifiant: "degats", nom: "dégâts", images: 1 },
  { identifiant: "mort", nom: "mort", images: 1 },
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

const ETAT: Etat = {
  cle: { presente: true, origine: "fichier", apercu: "abcdef", raison: null },
  catalogue: { modeles: 1, recu_le: CATALOGUE.recu_le, repli: false, raison: null },
  couts: { total_usd: 0 },
  traitement: {
    moteurs: [{ nom: "bord", raison: null }],
    quantification: { raison: "aucune palette" },
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
  emplacements: Array.from({ length: variations }, (_, rang) => ({
    rang,
    statut,
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
  reussies: 0,
})

const VIDE_C3 = { calques: {}, corps: null } as const

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
      nom: null,
    },
    rendu_largeur: 0,
    rendu_hauteur: 0,
    cree_le: 1_787_800_100,
    cout_usd: 0.0245,
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
function serveurDouble(options: {
  assets?: Asset[]
  cartes?: Carte[]
  univers?: Univers
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
  /** Ce que le serveur dit qui partira — **ligne par ligne** (US-127). Le
   *  compte et les lignes viennent de lui : l'écran ne connaît ni les artworks
   *  ni les concept arts, et deux comptes divergeraient. */
  references?: CompteReferences
  /** Ce qu'une image a coûté chez chaque modèle — **mesuré**, jamais un tarif. */
  couts?: Record<string, number>
  /** Ce que le projet impose à l'image ouverte dans la fiche (US-164). Calculé
   *  par le serveur, qui est le seul à savoir sur quelle échelle l'image est
   *  née — l'écran ne le devine jamais. */
  impose?: Impose
  /** Le texte exact qui partira (US-158). Composé par le serveur, par le chemin
   *  même que la soumission emprunte : le double le rend donc lui aussi, plutôt
   *  que de laisser l'écran le recomposer, ce que le produit refuse. */
  apercu?: ApercuPrompt
  /** Le prompt **tel qu'il est parti** que porte une génération relue — bible
   *  repliée en tête comprise. C'est ce que « reprendre les réglages » doit
   *  faire repartir mot pour mot (US-160). */
  promptParti?: string
  /** Ce que le serveur rend sur `/api/spending` — les appels payés, leurs trois
   *  issues, et les rafales. Vide par défaut : l'écran des dépenses n'est
   *  ouvert que par les essais qui le demandent. */
  depenses?: Depenses
  /** Ce qu'une table sait de l'image — les taches, les poches, les crans
   *  d'occupation. Vide par défaut : une image d'essai n'a rien à montrer. */
  mesures?: TachesDeLAsset
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
        ...CATALOGUE,
        references: options.references ?? CATALOGUE.references,
        couts: options.couts ?? CATALOGUE.couts,
      })
    // ── Ce qui partira (US-158) ──────────────────────────────────────────
    //
    // **Le double compose, comme le serveur compose** : c'est très exactement
    // ce que la tranche interdit à l'écran de faire, et le seul moyen de
    // vérifier qu'il ne le fait pas est de mettre la composition ailleurs que
    // chez lui. Il lit la bible de `etat.univers`, donc décocher un champ
    // change ce qu'il rend — ce que l'essai regarde.
    if (url === "/api/prompt/preview") {
      if (options.apercu) return rendre(options.apercu)
      const sujet = String(corps?.prompt ?? "").trim()
      if (corps?.repris)
        return rendre({
          texte: sujet,
          parties: [{ origine: "repris", texte: sujet }],
        })
      const parties: { origine: string; texte: string }[] = []
      const bible = etat.univers.bible
        .filter((c) => c.actif && c.texte.trim())
        .map((c) => `${INTITULE[c.nom] ?? c.nom}: ${c.texte.trim()}`)
        .join("\n")
      if (bible) parties.push({ origine: "bible", texte: bible })
      if (sujet) parties.push({ origine: "sujet", texte: sujet })
      const poses = (corps?.poses ?? null) as string[] | null
      if (poses && poses.length >= 2)
        parties.push({
          origine: "planche",
          texte: `Render this as a sprite sheet of ${poses.length} sprites of the SAME subject.`,
        })
      return rendre({
        texte: parties.map((p) => p.texte).join("\n\n"),
        parties,
      })
    }
    if (url === "/api/status") return rendre({ ...ETAT, agent: etat.agent })
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
    if (url.includes("/spots"))
      return rendre(
        options.mesures ?? {
          taches: [],
          coupees: 0,
          poches: [],
          crans_occupation: [],
        },
      )
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
            grille: { cible: 64, occupation: 100, ancrage: "bas" },
            quantification: null,
            bords: null,
            nom: null,
          },
          echelle: "",
        },
      )
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
              ? { cible: 64, occupation: 100, ancrage: "bas" as const }
              : null,
          quantification: null,
          bords: null,
          nom: null,
        },
      }
      etat.importes.push({ nom, asset: ne })
      etat.assets = [ne, ...etat.assets]
      return rendre({ asset: ne, doublon: null })
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
      })
    // **Le plan et les personnages arrivent ensemble**, comme la toile : le
    // double rend ce que le vrai serveur rend, sans les poses tenues — elles se
    // déduisent du plan, et les envoyer ferait une copie qui se périme.
    if (url === "/api/characters" && (!init?.method || init.method === "GET"))
      return rendre({
        projet: "bac-a-sable",
        plan: etat.plan,
        personnages: etat.personnages,
        emplacements: etat.emplacements,
        pieces: etat.pieces,
      })
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
        const visees = etat.plan.filter((p) =>
          (corps.poses ?? []).includes(p.identifiant),
        )
        const sujet = quoi
          ? quoi.description.trim() || quoi.nom
          : visees.length === 1
            ? [qui?.description.trim(), visees[0].nom].filter(Boolean).join(", ")
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
        const pose: Pose = {
          identifiant: String(corps.nom).toLowerCase().replace(/\s+/g, "-"),
          nom: String(corps.nom),
          images: Number(corps.images ?? 1),
        }
        etat.plan = [...etat.plan, pose]
        // La case neuve paraît chez chacun sans qu'aucun personnage soit
        // réécrit : c'est le plan qui décide, le personnage ne fait que
        // soustraire. Le double le rejoue, sinon l'essai prouverait un contrat
        // qui n'est pas celui du serveur.
        etat.personnages = etat.personnages.map((p) => ({
          ...p,
          cases: [
            ...p.cases,
            { pose: pose.identifiant, demandees: pose.images, images: [], ...VIDE_C3 },
          ],
        }))
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
      return rendre({ projet: "bac-a-sable", univers: etat.univers, artworks: [] })
    }
    if (url === "/api/generations" && init?.method === "POST") {
      const g = options.aPublier?.() ?? generation("zzzz0000", 1, "en_cours")
      FluxDouble.ouverts.at(-1)?.emettre("generation", g)
      return rendre(g)
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

/** Revenir à la galerie — là où ce qui a été produit se regarde. */
function laGalerie() {
  fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
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
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

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
      asset("eeee5555-0", "un tonneau", "auteur", "essai/rend-du-png"),
      asset("eeee5555-1", "un voisin", "auteur", "import"),
    ]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // L'identifiant exact du fournisseur, pas le nom du catalogue : c'est lui
    // qu'on redemande, et il reste vrai quand le catalogue est hors ligne.
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")
    expect(screen.getByText("essai/rend-du-png")).toBeTruthy()

    // Une image importée n'a pas de modèle, et son absence est une réponse.
    fireEvent.click(screen.getByLabelText("Fermer la fiche"))
    await waitFor(() => expect(screen.queryByLabelText("Fermer la fiche")).toBeNull())
    fireEvent.click(tuiles()[1])
    await screen.findByLabelText("Fermer la fiche")
    expect(screen.getByText("importé")).toBeTruthy()
    expect(screen.queryByText("import")).toBeNull()
  })

  // ── T3 : « replier un panneau est un choix, jamais une contrainte » ────────

  test("les trois panneaux et la grille tiennent ensemble, et chacun se replie par choix", async () => {
    const { fetchDouble } = serveurDouble({ assets: [asset("ffff6666-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("ffff6666-0")] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    const arbre = screen.getByRole("button", { name: "arbre" })
    const reglages = screen.getByRole("button", { name: "réglages" })

    // Déployés d'emblée : l'écran large est la ressource du produit (US-97).
    expect(arbre.getAttribute("aria-pressed")).toBe("true")
    expect(reglages.getAttribute("aria-pressed")).toBe("true")

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
    await ouvrirLesReglagesDuJeu("La palette du jeu")

    // Les blocs de l'univers arrivent repliés — on pose ces réglages une fois,
    // et l'en-tête dit déjà leur état (`docs/design-motifs.md` § Le bloc repliable).
    fireEvent.click(await screen.findByRole("button", { name: /^Palette/ }))

    // Sans artwork, la palette n'est pas une pièce manquante : c'est un état,
    // et il porte sa raison — « le grisé porte sa raison, jamais une infobulle ».
    expect(
      await screen.findByText("aucun artwork officiel — promeus une carte du tableau"),
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
    expect(screen.getByText("3 couleurs · 0 artwork")).toBeTruthy()

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
    fireEvent.click(await screen.findByRole("button", { name: "La bible du style" }))
    fireEvent.click(await screen.findByRole("button", { name: /^Bible/ }))
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

    // Le bloc « Ce qui part » répond d'avance à *qu'est-ce qui part avec ?*
    const bloc = (await screen.findByText("Ce qui part")).parentElement!
    expect(bloc.textContent).toContain("palette")
    expect(bloc.textContent).toContain("2 couleurs")
    expect(bloc.textContent).toContain("48 px")

    // Et le sujet est le seul geste qui reste : promouvoir a déjà tout décidé.
    expect(screen.getByRole("button", { name: "personnage" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "objet tenu" })).toBeTruthy()
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
    fireEvent.click(await screen.findByRole("button", { name: /Découper/ }))
    return double
  }

  test("découper part de la fiche, montre ce qui sortira, et se corrige à la main", async () => {
    const { appels } = await ouvrirLaDecoupe()

    // **On est descendu d'un étage dans la galerie**, et le fil le dit. Il n'y
    // a plus de titre d'écran à chercher : le nom de l'outil est le dernier
    // segment du fil, et l'écran n'en porte pas d'autre.
    expect(await screen.findByText("Découpage")).toBeTruthy()
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
    await waitFor(() => expect(screen.queryByText("Découpage")).toBeNull())
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

  test("une étape grisée s'explique quand même, et sa raison reste dans sa fente", async () => {
    // « Une explication sur un contrôle grisé. Elle existe — le libellé garde
    // son pointillé — mais elle ne remplace ni ne déplace la raison, qui reste
    // dans sa fente, permanente » (`docs/DESIGN.md` § Ce qui est écarté). Les
    // deux cohabitent parce qu'elles ne disent pas la même chose : *pourquoi
    // c'est fermé* n'est pas *à quoi ça sert*.
    const { fetchDouble } = serveurDouble({ assets: [asset("dddd1111-0")] })
    await monter(fetchDouble, { ...ETAT, assets: [asset("dddd1111-0")] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])

    // L'univers du double n'a aucune palette : l'étape est grisée avec sa
    // raison, et la raison est écrite — jamais au survol.
    const etape = await screen.findByRole("button", { name: "Quantification" })
    expect(etape.getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByText("aucune palette")).toBeTruthy()

    // Et elle s'explique. `aria-disabled` plutôt que `disabled` est ce qui le
    // permet : un `<button disabled>` ne dispatche aucun événement de souris,
    // pas même sur ses enfants.
    fireEvent.mouseOver(etape)
    const bulle = await screen.findByRole("tooltip")
    expect(bulle.textContent).toContain("La quatrième place")
    // La bulle explique, elle n'excuse jamais : la raison n'y entre pas.
    expect(bulle.textContent).not.toContain("aucune palette")

    // Cliquer une étape grisée ne la pose pas quand même.
    fireEvent.click(etape)
    expect(
      fetchDouble.mock.calls.some((appel) => String(appel[0]).includes("/recette")),
    ).toBe(false)
  })

  test("le guide range les réglages par écran, découpe comprise", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Guide" }))
    for (const groupe of [
      "Dans l'univers",
      "Dans l'atelier",
      "Dans la retouche",
      "Dans la découpe",
    ]) {
      expect(await screen.findByRole("heading", { name: groupe }), groupe).toBeTruthy()
    }

    // Les six manques d'hier sont comblés : le barème, les champs de la bible,
    // la palette de l'univers, la tache minimale, les lignes et colonnes de la
    // découpe. Le seul restant est celui que personne ne peut écrire d'avance.
    expect(screen.getByRole("heading", { name: "Barème d'échelles" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "contraintes techniques" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "tache minimale" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "lignes" })).toBeTruthy()
    expect(SANS_ENTREE).toHaveLength(1)
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

  test("clé, garde-fous et dossiers se règlent depuis un seul écran", async () => {
    const { fetchDouble, appels } = serveurDouble()
    await monter(fetchDouble)

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }))

    // Les trois blocs, dans un seul panneau (US-96).
    expect(await screen.findByRole("heading", { name: "La clé" })).toBeTruthy()
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
    // cours » (`docs/PLAN.md` T8). La pile meurt avec l'écran, et un Ctrl+Z au
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
    // échec** » (`docs/PLAN.md` T9). La seconde moitié de ce critère est un
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

    // **L'aperçu est la vignette en grand, et rien d'autre** : la même adresse,
    // pas une seconde décision sur « rendu ou brut ».
    expect(apercu()).toBeTruthy()
    expect(image().getAttribute("src")).toBe(
      vignette.querySelector("img")!.getAttribute("src"),
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
    expect(vignette.getAttribute("src")).toBe(adresse)

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

  /** Un bloc de l'univers, en-tête comprise.
   *
   *  Les segments de deux blocs portent les mêmes nombres — 16, 24, 32 et 48
   *  sont à la fois des couleurs et des tailles de pixel. On cherche donc *dans*
   *  le bloc, jamais dans l'écran entier. */
  const bloc = (titre: string) =>
    within(
      screen
        .getByRole("button", { name: new RegExp(`^${titre}`) })
        .closest("section") as HTMLElement,
    )

  /** L'étape du côté Réglages qui porte ce bloc-là.
   *
   *  Depuis E7 les cinq réglages du jeu ne sont plus empilés dans une colonne
   *  de 380 px : la liste de gauche en montre un à la fois, et il faut donc
   *  aller le chercher avant de le déplier. Les deux gestes sont distincts et
   *  le restent — **choisir une étape** n'est pas **déplier un bloc**. */
  const ETAPE_DU_BLOC: Record<string, string> = {
    Bible: "La bible du style",
    Palette: "La palette du jeu",
    "Taille de pixel": "La taille de pixel",
    "Barème d'échelles": "Le barème d'échelles",
    "Modèle par défaut": "Les modèles par défaut",
  }

  /** Ouvrir un bloc — son côté, son étape, puis son en-tête — et rendre son
   *  contenu. Les trois gestes restent distincts dans le produit ; le raccourci
   *  ne les confond que pour les essais qui visent le réglage, pas le chemin. */
  const ouvrir = async (titre: string) => {
    const etape = Object.entries(ETAPE_DU_BLOC).find(([bloc]) =>
      bloc.startsWith(titre),
    )?.[1]
    if (etape) {
      const cote = screen.queryByRole("tab", { name: "Réglages" })
      if (cote && cote.getAttribute("aria-selected") !== "true") fireEvent.click(cote)
      fireEvent.click(await screen.findByRole("button", { name: etape }))
    }
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${titre}`) }))
    return bloc(titre)
  }

  /** Replier un bloc : **replié, l'en-tête porte sa valeur** (`docs/design-motifs.md`
   *  § Le bloc repliable). C'est la façon la plus directe de lire ce que
   *  l'écran tient d'un réglage, sans passer par une classe CSS. */
  const replier = (titre: string) =>
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${titre}`) }))

  /** L'en-tête repliée qui porte cette valeur-là.
   *
   *  Le titre et la valeur sont deux `span` **collés** — le nom accessible du
   *  bouton est donc « Bible1 champ », sans espace. On l'écrit une fois ici
   *  plutôt que de le subir à six endroits. */
  const replie = (titre: string, valeur: string) =>
    screen.getByRole("button", { name: `${titre}${valeur}` })

  /** L'écran Univers, ouvert sur cet univers-là.
   *
   *  **L'onglet tient son univers du flux**, pas de la route : c'est le premier
   *  message de l'abonnement qui le pose (« un abonné qui arrive en retard
   *  demande l'état complet »). Le double et l'état de départ doivent donc dire
   *  la même chose, sans quoi l'écran montrerait l'un et réglerait l'autre. */
  const ouvrirLUnivers = async (univers: Univers = UNIVERS) => {
    const double = serveurDouble({ univers })
    const flux = await monter(double.fetchDouble, { ...ETAT, univers })
    await ouvrirLesReglagesDuJeu("La bible du style")
    await screen.findByRole("button", { name: /^Bible/ })
    return { ...double, flux }
  }

  test("la bible posée survit à la fermeture de l'écran, sans rechargement", async () => {
    await ouvrirLUnivers()
    const bible = await ouvrir("Bible")

    const monde = bible.getByPlaceholderText(/royaume de tourbe/)
    fireEvent.change(monde, { target: { value: "marais de fer" } })
    fireEvent.blur(monde)

    // **On referme et on rouvre**, parce que la bible est le seul bloc qui
    // tienne un brouillon : le texte encore à l'écran ne prouverait que le
    // brouillon. Remonté, il naît de ce que l'onglet tient de l'univers — donc
    // de la réponse posée. C'est « rouvrir montre la même valeur », vu d'ici.
    fireEvent.click(screen.getByRole("tab", { name: "Galerie" }))
    await ouvrirLesReglagesDuJeu("La bible du style")
    // Le repli des blocs vit dans le châssis et survit au démontage : la bible
    // est déjà ouverte au retour, et la rouvrir la refermerait.
    await screen.findByRole("button", { name: /^Bible/ })

    await waitFor(() =>
      expect(
        (bloc("Bible").getByPlaceholderText(/royaume de tourbe/) as HTMLTextAreaElement)
          .value,
      ).toBe("marais de fer"),
    )
    replier("Bible")
    expect(replie("Bible", "1 champ")).toBeTruthy()
  })

  test("le nombre de couleurs demandé est celui qui vient d'être posé", async () => {
    // La palette n'offre son réglage que lorsqu'elle existe : sans artwork, le
    // bloc porte sa raison, pas un contrôle mort.
    await ouvrirLUnivers({ ...UNIVERS, palette: ["#3d2b2d", "#b59b72"], vide: false })
    const palette = await ouvrir("Palette")

    // 8 et 12 n'appartiennent qu'aux couleurs ; 96 et 128 qu'aux tailles de
    // pixel. On règle sur ce qui ne peut pas être l'autre.
    fireEvent.click(palette.getByRole("button", { name: "12" }))

    await waitFor(() =>
      expect(palette.getByRole("button", { name: "12" }).className).toContain(
        "border-signal",
      ),
    )
    expect(palette.getByRole("button", { name: "24" }).className).not.toContain(
      "border-signal",
    )
  })

  test("la taille de pixel posée s'affiche, sans rechargement", async () => {
    const { appels } = await ouvrirLUnivers()
    const grille = await ouvrir("Taille de pixel")

    const avant = appels.length
    fireEvent.click(grille.getByRole("button", { name: "96" }))
    await waitFor(() =>
      expect(grille.getByRole("button", { name: "96" }).className).toContain(
        "border-signal",
      ),
    )

    // Replié, l'en-tête porte sa valeur — et c'est elle qu'on lit.
    replier("Taille de pixel")
    expect(replie("Taille de pixel", "96 px")).toBeTruthy()

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

  test("le barème posé se relit sur la ligne qu'on a réglée", async () => {
    await ouvrirLUnivers()
    const bareme = await ouvrir("Barème")

    // La silhouette est le seul réglage du barème qui se dise en toutes
    // lettres : c'est donc lui qu'on lit après.
    fireEvent.click(bareme.getAllByRole("button", { name: /se détoure/ })[0])

    expect(
      await bareme.findByRole("button", { name: "plein cadre, aucun détourage" }),
    ).toBeTruthy()
    expect(bareme.getAllByRole("button", { name: /se détoure/ })).toHaveLength(1)
  })

  test("le modèle par défaut d'une famille tient, et l'en-tête la compte", async () => {
    await ouvrirLUnivers()
    const defauts = await ouvrir("Modèle par défaut")

    const personnages = defauts.getAllByRole("combobox")[0]
    fireEvent.change(personnages, { target: { value: "essai/modele" } })

    await waitFor(() =>
      expect((defauts.getAllByRole("combobox")[0] as HTMLSelectElement).value).toBe(
        "essai/modele",
      ),
    )
    replier("Modèle par défaut")
    expect(replie("Modèle par défaut", "1 famille réglée")).toBeTruthy()
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
    const grille = await ouvrir("Taille de pixel")

    fireEvent.click(grille.getByRole("button", { name: "96" }))

    expect(
      await screen.findByText("la taille de pixel cible va de 8 à 512 pixels"),
    ).toBeTruthy()
    // La valeur d'avant, jamais la valeur tentée.
    replier("Taille de pixel")
    expect(replie("Taille de pixel", "64 px")).toBeTruthy()
  })

  test("le flux d'un second onglet pose le même réglage, sans qu'on ait rien fait ici", async () => {
    const { flux } = await ouvrirLUnivers()
    await ouvrir("Taille de pixel")

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
        screen.getByRole("button", { name: "128" }).className,
      ).toContain("border-signal"),
    )
    replier("Taille de pixel")
    expect(replie("Taille de pixel", "128 px")).toBeTruthy()
  })
})

// ── C1 · L'écran des personnages ────────────────────────────────────────────
//
// Ce que le serveur ne peut pas tenir : qu'un plan neuf soit là sans qu'on ait
// rien écrit, qu'une attitude ajoutée paraisse chez chacun, et surtout **que
// cet écran ne soit pas une grille d'assets** — ni recherche, ni filtres, ni
// sélection multiple. C'est cette privation qui préserve « une seule grille
// dans tout le produit » (`docs/PLAN.md` C1), et elle ne se vérifie qu'ici.

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
    // plus retaper (US-115).
    const champ = await champDePrompt() as HTMLTextAreaElement
    expect(champ.value).toBe("un forgeron nain à la barbe tressée, marche")
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
    fireEvent.click(screen.getByRole("button", { name: "Générer" }))

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

    fireEvent.click(screen.getByRole("button", { name: "Générer" }))
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
    expect(screen.getByText("≈ $0,0245 · 2 attitudes")).toBeTruthy()
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
    fireEvent.click(screen.getByRole("button", { name: "Générer" }))

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
    expect(await screen.findByText("jamais appelé")).toBeTruthy()
    cleanup()

    // Mesuré : la médiane de ce que ce modèle a réellement facturé.
    FluxDouble.ouverts = []
    const mesure = serveurDouble({ references: REFERENCES, couts: { [MODELE.identifiant]: 0.0245 } })
    await monter(mesure.fetchDouble)
    expect(await screen.findByText("≈ $0,0245")).toBeTruthy()
  })

  test("sans case visée, la portée « ce personnage » n'est pas proposée", async () => {
    const { fetchDouble } = serveurDouble({ references: REFERENCES })
    await monter(fetchDouble)

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

  /** Déplier, et rendre le dépliant lui-même. **On cherche dedans, jamais dans
   *  l'écran entier** : le champ de prompt porte le même texte que le bloc
   *  « sujet », et les deux se ressembleraient dans une requête globale. */
  const deplier = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /ce qui partira/ }))
    return within(await screen.findByRole("region", { name: "Ce qui partira" }))
  }

  // ── « Avant de lancer, le texte exact qui partira s'affiche : bible active,
  //     sujet, consignes de pliage — dans l'ordre d'envoi » ──────────────────

  test("le dépliant montre la bible puis le sujet, dans l'ordre d'envoi", async () => {
    const { fetchDouble } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau cerclé" } })
    const depliant = await deplier()

    // Les deux blocs sont là, et **dans cet ordre** : la bible se replie en
    // tête, le sujet suit. L'ordre est celui du prompt, pas une préférence
    // d'affichage — on le lit donc sur la position, pas sur la présence.
    await depliant.findByText(BIBLE_PARTIE, brut)
    const rendus = depliant
      .getAllByText(/marais de fer|un tonneau cerclé/, brut)
      .map((n) => n.textContent)
    expect(rendus).toEqual([BIBLE_PARTIE, "un tonneau cerclé"])
  })

  test("l'aperçu se demande au serveur — il n'est jamais recomposé à l'écran", async () => {
    // **La preuve tient dans l'appel**, pas dans le rendu : si l'écran savait
    // composer, il n'aurait aucune raison d'appeler. C'est ce que la tranche
    // interdit — « deux compositions écrites à deux endroits finiraient par
    // diverger, et celle qui compte est celle qui part ».
    const { fetchDouble, appels } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })

    await waitFor(() =>
      expect(
        appels.some(
          (a) =>
            a.url === "/api/prompt/preview" &&
            (a.corps as { prompt?: string } | undefined)?.prompt === "un tonneau",
        ),
      ).toBe(true),
    )
  })

  // ── « Ce texte suit ce qu'on tape et ce qu'on décoche : décocher un champ de
  //     bible le retire de l'aperçu à l'instant » ─────────────────────────────

  test("décocher un champ de bible le retire de l'aperçu", async () => {
    const { fetchDouble } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    await (await deplier()).findByText(BIBLE_PARTIE, brut)

    // **Par le vrai chemin, et pas par un message fabriqué** : on décoche à
    // l'écran Univers, le serveur écrit et rend l'univers entier, l'écran le
    // pose (R1) — et l'aperçu, qui n'a jamais rien composé lui-même, redemande
    // ce qui part.
    await ouvrirLesReglagesDuJeu("La bible du style")
    fireEvent.click(await screen.findByRole("button", { name: /^Bible/ }))
    fireEvent.click(
      await screen.findByRole("button", { name: "technique de rendu — actif" }),
    )
    await screen.findByRole("button", { name: "technique de rendu — inactif" })
    // On revient là où l'on paie — c'est là que le dépliant vit, avec le champ.
    fireEvent.click(screen.getByRole("tab", { name: "Codex" }))

    const depliant = within(
      await screen.findByRole("region", { name: "Ce qui partira" }),
    )
    await waitFor(() => expect(depliant.queryByText(/Rendering technique/)).toBeNull())
    expect(depliant.getByText(/World: marais de fer/)).toBeTruthy()
  })

  // ── « Le texte repris à la main part mot pour mot » · « Reprendre le texte
  //     n'écrit rien dans l'univers » ──────────────────────────────────────────

  test("reprendre le texte pose le texte exact et le fait partir mot pour mot", async () => {
    const { fetchDouble, appels } = serveurDouble({ univers: AVEC_BIBLE })
    await monter(fetchDouble, { ...ETAT, univers: AVEC_BIBLE })

    const champ = await champDePrompt()
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    const depliant = await deplier()
    await depliant.findByText(BIBLE_PARTIE, brut)

    fireEvent.click(screen.getByRole("button", { name: /Reprendre le texte/ }))

    // Le champ **est** désormais ce qui partira, bible comprise.
    const libre = (await screen.findByPlaceholderText(
      "Le texte part exactement tel qu'il est écrit ici.",
    )) as HTMLTextAreaElement
    expect(libre.value).toBe(`${BIBLE_PARTIE}\n\nun tonneau`)

    fireEvent.change(libre, { target: { value: "a plain wooden barrel, painterly" } })
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

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
    const depliant = await deplier()
    await depliant.findByText(BIBLE_PARTIE, brut)
    fireEvent.click(screen.getByRole("button", { name: /Reprendre le texte/ }))
    await screen.findByPlaceholderText("Le texte part exactement tel qu'il est écrit ici.")

    fireEvent.click(screen.getByRole("button", { name: /Rendre la main/ }))

    // Le champ redevient le champ de sujet, et il garde ce qu'on y avait mis :
    // on ne perd pas du texte en changeant d'avis.
    const revenu = (await champDePrompt()) as HTMLTextAreaElement
    expect(revenu.value).toContain("un tonneau")
    // Et l'habillage est de retour — la bible reparaît comme un bloc à part.
    await waitFor(() => expect(depliant.getByText(BIBLE_PARTIE, brut)).toBeTruthy())
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

    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))
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
        grille: { cible: 32, occupation: 40, ancrage: "bas" as const },
        quantification: null,
        bords: null,
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
          grille: { cible: 64, occupation: 40, ancrage: "bas" },
          quantification: null,
          bords: null,
          nom: null,
        },
        echelle: "objet tenu",
      },
    })
    await monter(fetchDouble, { ...ETAT, assets: [image] })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    // Replié, le bloc porte déjà les trois valeurs du projet — c'est ce qui
    // permet de lire la fiche entière sans rien ouvrir.
    const entete = await screen.findByRole("button", { name: /^Imposé par le projet/ })
    expect(entete.textContent).toContain("64 px · 40 % · aucune")

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
      impose: { impose: null, echelle: "" },
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
    await ouvrirLesReglagesDuJeu("La taille de pixel")

    const entete = await screen.findByRole("button", { name: /^Taille de pixel/ })
    expect(entete.textContent).toContain("aucune")

    fireEvent.click(entete)
    const bloc = within(entete.closest("section") as HTMLElement)
    expect(
      bloc.getByText(
        /aucune remise sur grille — le détourage, le recadrage et la palette/,
      ),
    ).toBeTruthy()

    // Et le barème dit son inaction plutôt que de laisser croire qu'il agit.
    // Il est une étape plus loin dans la liste depuis E7 : les cinq réglages
    // ne sont plus empilés dans une colonne, on en lit un à la fois.
    fireEvent.click(screen.getByRole("button", { name: "Le barème d'échelles" }))
    const bareme = await screen.findByRole("button", { name: /^Barème d'échelles/ })
    fireEvent.click(bareme)
    expect(
      within(bareme.closest("section") as HTMLElement).getByText(
        /sans taille de pixel, l'occupation ne s'applique pas/,
      ),
    ).toBeTruthy()
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
    await ouvrirLesReglagesDuJeu("La bible du style")

    await screen.findByRole("button", { name: /^Bible/ })
    const marque = poignee("Bible")
    expect(marque).toBeTruthy()
    expect(marque!.closest("[data-panneau]")).toBeTruthy()
  })

  test("la fiche : le panneau se déclare, et sa poignée est dedans", async () => {
    const images = [asset("aaaa1111-0")]
    const { fetchDouble } = serveurDouble({ assets: images })
    await monter(fetchDouble, { ...ETAT, assets: images })

    await waitFor(() => expect(tuiles()).toHaveLength(1))
    fireEvent.click(tuiles()[0])
    await screen.findByLabelText("Fermer la fiche")

    const marque = poignee("Détourage")
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
      { garde: true, rayon: 2, points: [[4, 4]] },
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
      { garde: false, rayon: 2, points: [[1, 1]] },
    ]
    deux.recette.difference!.retouche = [
      { garde: true, rayon: 0, points: [[4, 4]] },
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
          { garde: true, rayon: 0, points: [[1, 1]] },
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
            calques: { repos: [doux], marche: [pire], course: [fait] }[
              p.identifiant
            ]
              ? ({
                  casque: { repos: [doux], marche: [pire], course: [fait] }[
                    p.identifiant
                  ]!,
                } as Record<string, Asset[]>)
              : ({} as Record<string, Asset[]>),
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
      ?.corps as { personnage: string; poses: string[] }
    expect(envoye.personnage).toBe("le-nain")
    expect(envoye.poses).toEqual(["marche"])

    const champ = await champDePrompt() as HTMLTextAreaElement
    await waitFor(() =>
      expect(champ.value).toBe("un forgeron nain à la barbe tressée, marche"),
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
    fireEvent.click(await screen.findByRole("button", { name: /Découper/ }))

    const fil = within(await screen.findByRole("navigation", { name: "Où l'on est" }))
    // Quatre segments : le jeu, l'onglet, l'image, l'outil. C'est la forme
    // courte — celle d'une image atteinte par la galerie, qui n'appartient pas
    // forcément à une chose du jeu et n'a traversé aucune famille.
    expect(fil.getByText("Bac à sable")).toBeTruthy()
    expect(fil.getByText("Galerie")).toBeTruthy()
    expect(fil.getByText("tonneau-cerclé-02")).toBeTruthy()
    expect(fil.getByText("Découpage")).toBeTruthy()

    // **Le dernier segment ne ramène nulle part** : c'est l'étage où l'on est,
    // et c'est ce qui le rend lisible comme la fin du fil.
    expect(fil.queryByRole("button", { name: "Découpage" })).toBeNull()
    expect(fil.getByText("Découpage").getAttribute("aria-current")).toBe("page")

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
    fireEvent.click(await screen.findByRole("button", { name: /Découper/ }))
    await screen.findByRole("navigation", { name: "Où l'on est" })

    // Cliquer un onglet est le geste qui dit « ailleurs ». Laisser la découpe
    // ouverte derrière rendrait le produit à ce qu'il vient de quitter — un
    // écran par-dessus un autre, ce que la tranche supprime.
    fireEvent.click(onglet("Univers"))
    await screen.findByText("Le tableau est vide.")
    expect(screen.queryByRole("navigation", { name: "Où l'on est" })).toBeNull()

    fireEvent.click(onglet("Galerie"))
    expect(await screen.findByLabelText("Chercher dans la bibliothèque")).toBeTruthy()
    expect(screen.queryByText("Découpage")).toBeNull()
  })

  // ── « Le total de la barre de tête porte le nom de ce qu'il compte, et un
  //     clic ouvre l'écran qui l'explique — grisé avec sa raison tant que cet
  //     écran n'existe pas » ──────────────────────────────────────────────────

  test("le total porte son étiquette, et un clic ouvre l'écran qui l'explique", async () => {
    const { fetchDouble } = serveurDouble()
    await monter(fetchDouble)

    // `ce jeu $0,0000`, jamais un montant nu : un montant affiché est une
    // question posée, et un chiffre qui laisse deviner sa portée finit par être
    // lu comme le total de tout, ce qu'il n'est pas.
    expect(screen.getByText("ce jeu")).toBeTruthy()
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
    fireEvent.click(await screen.findByRole("button", { name: /Découper/ }))
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
    expect(screen.getByRole("button", { name: "réglages" })).toBeTruthy()
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
      { modele: "openai/gpt-image-2", cout_usd: 0.2935, appels: 2 },
      { modele: "google/gemini-3.1-flash-lite", cout_usd: 0.0684, appels: 1 },
    ],
    appels: [
      {
        identifiant: "aaaa1111",
        modele: "openai/gpt-image-2",
        prompt: "un tonneau cerclé de fer",
        cree_le: 1_787_800_000,
        cout_usd: 0.016,
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
    expect(within(document.querySelector("header") as HTMLElement).getByText("ce jeu"))
      .toBeTruthy()
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
    expect(corps.className).toContain("overflow-hidden")
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
    // entier lui est donné.
    expect(await screen.findByRole("button", { name: /^Bible/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Barème/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Le barème d'échelles" }))
    expect(await screen.findByRole("button", { name: /^Barème/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Bible/ })).toBeNull()
  })

  // ── « Le menu d'un paquet propose de fabriquer une palette et une ambiance,
  //     grisés avec leur raison » ───────────────────────────────────────────────

  test("le troisième côté existe, vide, et dit pourquoi", async () => {
    await ouvrir()
    fireEvent.click(cote("Ambiances et couleurs"))

    // Un côté qui apparaîtrait le jour où il se remplit serait une surprise au
    // moment précis où l'on cherche où les choses se règlent.
    expect(await screen.findByText("Rien n'est encore fabriqué ici.")).toBeTruthy()
    expect(
      screen.getByText(/Les deux gestes qui les créent existent déjà/),
    ).toBeTruthy()
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
      expect(champ.value).toBe("un forgeron nain à la barbe tressée, marche"),
    )

    // **La règle jumelle du grisé.** *Ce qui est indisponible est grisé avec sa
    // raison* avait besoin de son revers : ce qui est devinable est prérempli
    // **avec sa provenance**. Un champ prérempli n'est pas un champ décidé.
    expect(screen.getByText(/proposé, d'après son signalement/)).toBeTruthy()

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
        quantification: { raison: null },
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
    const { cadre } = await ouvrirUneTable()

    // Elle est cliquable — c'est le wrapper qui porte la raison, pas la puce.
    fireEvent.click(puce(cadre, "contours"))
    expect(
      await cadre.findByText(/le tracé de contour n'est pas encore construit/),
    ).toBeTruthy()
    // **À la place des réglages, jamais à côté d'eux** : aucun curseur mort
    // sous la raison.
    expect(cadre.queryByRole("slider")).toBeNull()
  })

  test("une fabrique n'a pas de carré, et la superposition dit qu'elle n'existe pas encore", async () => {
    const { cadre } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "superposition"))
    expect(await cadre.findByText(/la superposition n'est pas encore construite/)).toBeTruthy()
  })

  // ── « L'image brute et l'image rendue se comparent côte à côte et
  //     superposées, et le mode est écrit dès que ce n'est pas le rendu » ──────

  test("les quatre modes de comparaison, et le mode s'écrit dès que ce n'est pas le rendu", async () => {
    const { cadre } = await ouvrirUneTable()

    // Au repos, rien n'est écrit : c'est le rendu, et le dire serait du bruit.
    expect(cadre.queryByText(/on regarde/)).toBeNull()

    for (const [bouton, dit] of [
      ["brut", "on regarde : brut"],
      ["côte à côte", "on regarde : côte à côte"],
      ["superposé", "on regarde : superposé"],
    ] as const) {
      fireEvent.click(cadre.getByRole("button", { name: bouton }))
      expect(await cadre.findByText(dit)).toBeTruthy()
    }

    // Et revenir au rendu fait taire la phrase : un mode durable qu'on oublie
    // est le danger ; le dire est ce qui autorise à le rendre durable.
    fireEvent.click(cadre.getByRole("button", { name: "rendu" }))
    await waitFor(() => expect(cadre.queryByText(/on regarde/)).toBeNull())
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
          { aire: 1, boite: [3, 3, 3, 3], couleur: "#112233" },
          { aire: 2, boite: [8, 8, 9, 9], couleur: "#445566" },
          { aire: 900, boite: [0, 0, 63, 63], couleur: "#778899" },
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
    const { cadre } = await ouvrirUneTable({
      mesures: {
        taches: [],
        coupees: 0,
        poches: [
          { aire: 42, boite: [10, 10, 19, 19], couleur: "#203040" },
          { aire: 4, boite: [30, 30, 31, 31], couleur: "#405060" },
        ],
        crans_occupation: [],
      },
    })

    expect(await cadre.findByText(/2 poches de fond enfermées/)).toBeTruthy()
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
    // **Un pour cent n'est pas une mesure** : ce que l'occupation décide est un
    // nombre de pixels dans la case, et c'est ce nombre qu'on compare.
    expect(
      await cadre.findByText(/64 px dans la case · 10 crans changent l'image/),
    ).toBeTruthy()
  })

  // ── « Le rectangle de recadrage se pose sur l'image » ──────────────────────

  test("le rectangle de recadrage se glisse sur l'image, et se lit dans la table", async () => {
    const { cadre, appels } = await ouvrirUneTable()

    fireEvent.click(puce(cadre, "recadrage"))
    // Sans rectangle, la table le dit — et dit comment en poser un.
    expect(
      await cadre.findByText(/glisse un rectangle sur l'image/),
    ).toBeTruthy()

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
})
