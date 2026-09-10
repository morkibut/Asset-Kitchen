// Le vocabulaire de la recette — les faits du domaine, sans un écran autour.
//
// **Une vérité par fait.** Ces constantes, ces fonctions pures et ces crochets
// vivaient dans `Places.tsx` et `Tables.tsx`, c'est-à-dire dans deux fichiers
// d'écran que `B26` retire. Ils n'ont jamais été du balisage : la liste des
// cibles, le nom d'un moteur, l'ordre des places, ce qu'une place vaut. Les
// laisser tomber avec l'ancien châssis aurait obligé à les réécrire dans
// l'écran neuf, et deux définitions d'un même fait finissent toujours par
// diverger — la leçon que `B18` a payée sur `palette.py`.
//
// **Ce fichier n'importe aucun écran** : ni `pieces.tsx`, ni un composant, ni
// React autrement que pour ses trois crochets. C'est ce qui le rend lisible par
// l'atelier d'une animation comme par la retouche, sans traîner l'un chez
// l'autre.

import { useEffect, useRef, useState } from "react"
import {
  api,
  CURSEUR_MAX,
  CURSEUR_MIN,
  FORCE_TRAMAGE_LIVREE,
  MAIN_VIDE,
  RECETTE_VIDE,
  TEINTE_MAX,
  TEINTE_MIN,
  type Asset,
  type Bords,
  type Contour,
  type DefautDetourage,
  type Echange,
  type EtatTraitement,
  type Grille,
  type Main,
  type Passe,
  type Place,
  type Quantification,
  type Recadrage,
  type Recette,
  type Retournement,
  type TachesDeLAsset,
  type Trait,
  type Univers,
} from "./api"

// ── Les listes fermées, et les mots que l'auteur lit ────────────────────────

/** Les cibles proposées. Reprises de `MySpriteAi`, où elles ont servi pour de
 *  vrai — 16 pour une tuile, 64 pour un sprite, 128 pour un décor.
 *
 *  **Les neuf sont celles du domaine, et c'est une correction.** La table n'en
 *  acceptait que sept, 16 à 128 ; l'assistant de démarrage et l'univers en
 *  proposent neuf depuis le 30 août 2026, 8 et 256 compris
 *  (`atelier/domaine/vue.py`, `TAILLES`). **Un jeu réglé sur 8 ou sur 256
 *  n'avait donc aucun outil pour appliquer sa propre taille** — le réglage du
 *  projet nommait une case que la table ne savait pas poser. Signalé par
 *  l'auteur le 31 août 2026, et déjà arbitré dans le croquis de l'écran
 *  (`docs/maquettes-v2.1/13-table-grille.html`, première annotation).
 *
 *  Les deux listes sont tenues ensemble par `tests/test_e8.py` : elles disent le
 *  même fait, et deux listes pour un fait finissent toujours par diverger — la
 *  divergence de sept contre neuf en est la preuve. */
// **512 est entré en D2**, avec le pixel art haute résolution que l'auteur a
//  demandé le 3 septembre 2026 : *« il faut ajouter le 256 et 512 pour le pixel
//  art haute résolution car c'est un style intéressant »*. Dix valeurs, donc, et
//  `tests/test_e8.py` tient toujours les deux listes ensemble.
export const CIBLES = [8, 16, 24, 32, 48, 64, 96, 128, 256, 512] as const

/** **Les finesses d'un jeu en dessin** (`atelier/domaine/vue.py`, `FINESSES`).
 *
 *  La même panne que ci-dessus, un cran plus haut : la table ne proposait que
 *  les dix tailles du pixel art, donc **un jeu en dessin réglé sur 1024 ou 2048
 *  n'avait aucun outil pour appliquer sa propre finesse**. La route la refusait
 *  d'ailleurs aussi — son plafond était écrit `512` à la main, à côté des 2048
 *  du service (`B16`, contradiction du plafond).
 *
 *  Deux listes et non une : 8 carrés n'a pas plus de sens pour un dessin que
 *  2048 n'en a pour du pixel art. `tests/test_b16.py` tient celle-ci contre le
 *  domaine, comme `tests/test_e8.py` tient l'autre. */
export const FINESSES = [256, 512, 1024, 2048] as const

export const MOTEUR: Record<Passe["moteur"], string> = {
  bord: "bord",
  couleur: "pipette",
  modele: "modèle",
  trace: "sélection",
  palette: "palette du jeu",
}

/** **Ce que chaque moteur ronge de bord sans que personne l'ait posé** (D1).
 *
 *  Comptée le 3 septembre 2026 sur les 123 passes de détourage écrites à la
 *  main dans ce dépôt : le bord laisse le durcissement à zéro 78 fois sur 100,
 *  la pipette ne le laisse jamais à zéro et y met 1 le plus souvent, le modèle
 *  ne le laisse jamais à zéro et y met 2 quatre fois sur cinq. À moteur égal, la
 *  nature de l'image ne décide presque plus rien — c'est le moteur qui décide.
 *
 *  La raison tient en une phrase : le bord **ne produit aucun pixel à demi
 *  transparent**, il est net par construction, donc il n'y a pas de frange à
 *  ronger ; le modèle en produit sur presque tout le sujet.
 *
 *  **La même table vit dans `atelier/domaine/recette.py`**, et les deux sont
 *  tenues ensemble par un essai — comme les crans de cible et le nom des
 *  moteurs avant elles. */
export const DURCISSEMENT_LIVRE: Record<Passe["moteur"], number> = {
  bord: 0,
  couleur: 1,
  modele: 2,
  trace: 0,
  // **`palette` suit `bord`** (B18) : même remplissage par plages depuis les
  // bordures, même bord binaire — rien ne dit qu'il fabrique une frange que
  // `bord` ne fabrique pas.
  palette: 0,
}

/** Ce qu'une place posée dit d'elle-même quand elle est repliée
 *  (`docs/design-motifs.md` § Le bloc repliable). Une ligne, en mono, à droite du
 *  titre — c'est ce qui permet de lire la recette entière sans rien ouvrir.
 *
 *  Le résumé est **la valeur, jamais le fait qu'il y en ait une** : « 2 passes »
 *  n'apprend rien de plus qu'un carré plein, alors que « bord · 28 » dit ce que
 *  l'image a subi. La seule exception est le pluriel, où la valeur ne tient
 *  plus : deux passes ont deux moteurs, et c'est le nombre qui devient le fait. */
/** Combien des quatre curseurs de `B17` sont hors de leur neutre.
 *
 *  **Écrit une fois, lu par le résumé et par le carré de la barre** : deux
 *  comptes séparés auraient fini par ne pas remplir le carré de la même table
 *  que le résumé décrit. */
export const curseursPoses = (q: Quantification): number =>
  [q.luminosite, q.contraste, q.saturation, q.teinte].filter((v) => (v ?? 0) !== 0).length

/** Les échanges qui font quelque chose — ceux qui nomment leurs deux couleurs.
 *  **Une paire vide est gardée mais ne compte pas** : c'est la règle d'une passe
 *  de détourage sans point, un cran plus bas. */
export const echangesVifs = (q: Quantification): Echange[] =>
  (q.echanges ?? []).filter((e) => e.depuis && e.vers)

export const RESUME = {
  detourage: (recette: Recette) =>
    recette.passes.length === 1
      ? `${MOTEUR[recette.passes[0].moteur]} · ${recette.passes[0].tolerance}`
      : `${recette.passes.length} passes`,
  /** **Ce qui agit, et rien d'autre** (U2). Un recadrage porte deux réglages
   *  indépendants — une boîte tracée, une marge —, et le résumé disait toujours
   *  la marge, y compris quand elle valait zéro à côté d'un rectangle qui,
   *  lui, coupait. Il dit maintenant ce qui change l'image, dans l'ordre où ça
   *  compte. */
  recadrage: (r: Recadrage) =>
    [
      r.boite ? `tracé ${r.boite[2] - r.boite[0] + 1}×${r.boite[3] - r.boite[1] + 1}` : null,
      r.marge > 0 ? `marge ${r.marge} px` : null,
    ]
      .filter(Boolean)
      .join(" · ") || `marge ${r.marge} px`,
  grille: (g: Grille) => `${g.cible} px · ${g.occupation} %`,
  /** **Ce qui agit, et rien d'autre** (U2), pour les six réglages de `B17`
   *  aussi : un curseur à zéro ne se lit pas, un échange sans couleurs non plus.
   *  Le résumé dit ce que l'image a subi. */
  quantification: (q: Quantification) =>
    [
      `${q.couleurs} couleurs`,
      curseursPoses(q) ? `${curseursPoses(q)} curseur${curseursPoses(q) > 1 ? "s" : ""}` : null,
      echangesVifs(q).length
        ? `${echangesVifs(q).length} échange${echangesVifs(q).length > 1 ? "s" : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  bords: (b: Bords) =>
    [
      b.aire_min > 0 ? `tache ${b.aire_min} px` : null,
      b.grain_min ? `grain ${b.grain_min}` : null,
      b.lissage ? `lissage ${b.lissage}` : null,
      b.garder ? `garder ${b.garder}` : null,
      b.boucher_jusqua ? `boucher ${b.boucher_jusqua} px` : null,
      b.reboucher_jusqua ? `reboucher ${b.reboucher_jusqua} px` : null,
      b.ronger_regonfler ? `ouverture ${b.ronger_regonfler} px` : null,
      b.regonfler_ronger ? `fermeture ${b.regonfler_ronger} px` : null,
      b.vote_voisins ? `vote ${b.vote_voisins}` : null,
      b.designations?.length ? `${b.designations.length} désignée${b.designations.length > 1 ? "s" : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || `tache ${b.aire_min} px`,
  contours: (c: Contour) => `${c.epaisseur} px · ${POSITIONS[c.position]}`,
  retournement: (r: Retournement) => SENS_DU_RETOURNEMENT[r.sens],
  /** **Le compte des passages, pas celui des calques.** Trois calques vides ne
   *  changent rien à l'image, et le résumé d'une place dit ce que l'image a
   *  subi — c'est la même règle que « 2 passes » plutôt que « détourage ». */
  main: (m: Main) => {
    const passages = m.opacite.length + m.calques.reduce((n, c) => n + c.passages.length, 0)
    return `${passages} passage${passages > 1 ? "s" : ""}`
  },
}

export const POSITIONS: Record<Contour["position"], string> = {
  externe: "externe",
  interne: "interne",
  centre: "centré",
}

export const TROUS: Record<Contour["trous"], string> = {
  cercles: "cerclés",
  laisses: "laissés",
}

/** Les dix sens que l'atelier sait appliquer — un seul en B1, neuf de plus en
 *  B18.
 *
 *  **La même liste vit dans `atelier/domaine/recette.py`** (`SENS`), et les deux
 *  sont tenues ensemble par un essai, comme `MOTEUR` et `DURCISSEMENT_LIVRE`
 *  avant elles. Ce qui figure dans une recette enregistrée est ce que le
 *  traitement sait appliquer, et pas un cran de plus. */
export const SENS_DU_RETOURNEMENT: Record<Retournement["sens"], string> = {
  "gauche-droite": "miroir gauche-droite",
  "haut-bas": "miroir haut-bas",
  "quart-droite": "quart de tour à droite",
  "quart-gauche": "quart de tour à gauche",
  "demi-tour": "demi-tour",
  diagonale: "miroir sur la diagonale",
  repli: "miroir sur soi",
  "sauf-zones": "miroir, sauf ici",
  "angle-libre": "rotation libre, au plus proche",
  rotsprite: "rotation libre, méthode pixel art",
}

/** Les crans que la table propose — **les clés de la liste ci-dessus, et rien
 *  d'autre**. Un littéral recopié à côté du segment se serait tu le jour où un
 *  sens s'ajoute des deux côtés, et l'essai n'aurait rien vu. */
export const SENS_LIVRES = Object.keys(SENS_DU_RETOURNEMENT) as readonly Retournement["sens"][]

/** Les deux moitiés d'un repli — les mêmes mots que l'ancrage. */
export const MOITIES_DU_REPLI: Record<"gauche" | "droite", string> = {
  gauche: "gauche",
  droite: "droite",
}

/** Ce qu'une position fait aux dimensions du rendu, en pixels et par côté.
 *
 *  **Écrit une fois, et c'est la même arithmétique que le serveur** : à cheval,
 *  la moitié qui ne tombe pas juste va vers l'extérieur — agrandir est
 *  réversible, manger le sujet ne l'est pas. Un second calcul écrit à l'écran
 *  aurait fini par annoncer autre chose que ce que l'image fait.
 *
 *  **`reserver` prime sur `position`** (B18), comme dans `Contour.parts` côté
 *  domaine : la case ne doit plus jamais grandir, quel que soit le choix. */
export function debord(contour: Contour): number {
  if (contour.reserver) return 0
  if (contour.position === "interne") return 0
  if (contour.position === "centre") return Math.ceil(contour.epaisseur / 2)
  return contour.epaisseur
}

export const defautGrille = (): Grille => ({
  cible: 64,
  occupation: 100,
  ancrage: "bas",
  // **Zéro** (E17) : le décalage n'est écrit que par le calibrage, et une
  // recette qu'il n'a pas touchée rend exactement l'image d'avant.
  decalage: 0,
  // **`proche` et non le défaut du produit** (D2). Ceci complète une recette
  // qui n'avait pas de grille du tout ; le vote en deux temps est ce qu'un
  // *projet neuf* met dans ses recettes, et il arrive alors du serveur. Écrire
  // le défaut du produit ici changerait l'image d'une recette ancienne au
  // premier réglage posé, sans que personne l'ait demandé.
  methode: "proche",
})
// ── La machine qui pose une recette ─────────────────────────────────────────

/**
 * Tenir la recette d'une image, et l'envoyer au serveur.
 *
 * **Deux gestes, pas un.** `regler` bouge la valeur à l'écran et ne demande
 * rien ; `poser` l'envoie. Un segment fait les deux d'un coup — c'est un choix,
 * il part. Un curseur ne pose qu'au relâchement : la valeur suit la main, le
 * rendu suit la main lâchée.
 *
 * **L'attente s'apprend au lieu d'être écrite.** Mesuré au navigateur le 27 août
 * 2026 : un cran de tolérance coûte 1 492 ms, le moteur modèle 2 255, là où
 * l'occupation en coûte 29. Le serveur ne publie pas de durée attendue pour une
 * retouche comme il le fait pour une génération ; on garde donc ce que la
 * dernière du même genre a mis, sur cette machine et sur cette image.
 */
export function useRecette(asset: Asset, onErreur: (raison: string) => void) {
  const [recette, setRecette] = useState<Recette>(asset.recette)
  const attentes = useRef({ detourage: 1.5, queue: 0.05 })
  const envoyee = useRef<Recette>(asset.recette)
  const envols = useRef(0)
  const [enVol, setEnVol] = useState<{ depuis: number; attendue: number } | null>(null)

  // Changer d'image remet la recette sur celle-là. Sans ça, l'écran garderait
  // les réglages de la précédente et on croirait les avoir posés.
  //
  // **Sur l'identifiant seul, jamais sur la recette.** Chaque retouche revient
  // par le flux d'événements ; se resynchroniser dessus ferait reculer un
  // curseur qu'on est en train de faire glisser, au rythme des allers-retours.
  // C'est l'écran qui mène la recette tant qu'il est ouvert, et le serveur qui
  // tranche quand il refuse — `poser` remet alors l'état d'avant.
  useEffect(() => {
    setRecette(asset.recette)
    envoyee.current = asset.recette
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])

  const regler = (suivante: Recette) => setRecette(suivante)

  const poser = async (suivante: Recette) => {
    setRecette(suivante)

    // Rien à envoyer si c'est déjà ce qui est posé — un relâchement de curseur
    // qui n'a rien déplacé. Le serveur sérialise les retouches : un appel pour
    // rien, c'est une seconde et demie de file pour rien.
    if (JSON.stringify(suivante) === JSON.stringify(envoyee.current)) return

    const lourde =
      JSON.stringify(suivante.passes) !== JSON.stringify(envoyee.current.passes)
    envoyee.current = suivante

    const depart = Date.now() / 1000
    envols.current += 1
    // La jauge garde le **premier** départ : le serveur sérialise, donc deux
    // retouches lancées coup sur coup sont une seule attente, pas deux.
    setEnVol(
      (deja) =>
        deja ?? {
          depuis: depart,
          attendue: lourde ? attentes.current.detourage : attentes.current.queue,
        },
    )

    try {
      await api.poserRecette(asset.identifiant, suivante)
      const mise = Date.now() / 1000 - depart
      attentes.current = lourde
        ? { ...attentes.current, detourage: mise }
        : { ...attentes.current, queue: mise }
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "retouche refusée")
      setRecette(asset.recette) // l'écran ne garde pas un réglage que le serveur refuse
      envoyee.current = asset.recette
    } finally {
      envols.current -= 1
      if (envols.current === 0) setEnVol(null)
    }
  }

  const revenirAuBrut = async () => {
    try {
      await api.revenirAuBrut(asset.identifiant)
      setRecette(RECETTE_VIDE)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "retour au brut refusé")
    }
  }

  return { recette, setRecette, regler, poser, revenirAuBrut, enVol }
}
/**
 * Demander au serveur ce qu'une table a besoin de savoir de l'image.
 *
 * **Une lecture à part de l'asset**, comme `impose` : un remplissage par plages
 * sur mille pixels de côté n'a rien à faire dans la charge que la grille relit
 * deux cents fois. Elle se redemande quand la recette **posée** change, parce
 * que c'est ce qui change les taches — pas à chaque cran de curseur.
 */
export function useMesures(asset: Asset) {
  const [mesures, setMesures] = useState<TachesDeLAsset | null>(null)
  useEffect(() => {
    let vivant = true
    setMesures(null)
    api
      .taches(asset.identifiant)
      .then((recu) => vivant && setMesures(recu))
      // Une image disparue pendant qu'on la regardait : il n'y a rien à dire de
      // plus ici qu'« on ne sait pas », et c'est ce que `null` veut dire.
      .catch(() => vivant && setMesures(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant, asset.empreinte])
  return mesures
}
// ── Les couleurs ────────────────────────────────────────────────────────────

/** Ce que la table *Couleurs* vaut aujourd'hui, avec ses neutres.
 *
 *  **Une seule lecture pour tout l'écran** — les six réglages de `B17` et les
 *  six de `B18` n'arrivent sur le fil que posés (règle de `B1`), et les lire
 *  chacun de son côté avec son propre repli aurait fini par en oublier un.
 *
 *  **Le neutre de `force_tramage` est cent**, seul de la liste à ne pas être la
 *  valeur vide : le tramage d'aujourd'hui est plein, et lire son absence comme
 *  un zéro éteindrait le semis de toute recette tramée. */
export const quantificationDe = (
  recette: Recette,
  univers: Univers,
): Quantification => ({
  couleurs: recette.quantification?.couleurs ?? univers.couleurs,
  palette: recette.quantification?.palette ?? univers.palette,
  tramage: recette.quantification?.tramage ?? "aucun",
  luminosite: recette.quantification?.luminosite ?? 0,
  contraste: recette.quantification?.contraste ?? 0,
  saturation: recette.quantification?.saturation ?? 0,
  teinte: recette.quantification?.teinte ?? 0,
  echanges: recette.quantification?.echanges ?? [],
  algorithme: recette.quantification?.algorithme ?? "mediane",
  graine: recette.quantification?.graine ?? 0,
  force_tramage: recette.quantification?.force_tramage ?? FORCE_TRAMAGE_LIVREE,
  distance: recette.quantification?.distance ?? "brute",
  visibles_seuls: recette.quantification?.visibles_seuls ?? false,
  gardees: recette.quantification?.gardees ?? [],
})
/** Une paire qui ne nomme encore aucune couleur. Elle vit dans le panneau, pas
 *  dans la recette : voir `TableDEchange`. Exportée : `Retouche.tsx` pose la
 *  même table dans son propre vocabulaire, et une seconde définition aurait
 *  fini par diverger de celle-ci sur un détail. */
export const PAIRE_VIDE: Echange = { depuis: "", vers: "", tolerance: 0 }

/** Jusqu'où le curseur de tolérance d'une paire monte **à l'écran**. Le domaine
 *  en accepte davantage ; au-delà d'une soixantaine de crans, une paire attrape
 *  déjà des couleurs que personne n'appellerait voisines, et le curseur cesse
 *  de servir à ce pour quoi il est là. */
export const TOLERANCE_D_UNE_PAIRE_MAX = 64

/** Les quatre curseurs, dans l'ordre où le traitement les applique. Écrits une
 *  fois : trois boucles auraient fini par ne plus les nommer pareil — et
 *  exportés pour la même raison, puisque `Retouche.tsx` les affiche aussi. */
export const CURSEURS = [
  { cle: "luminosite", nom: "luminosité", min: CURSEUR_MIN, max: CURSEUR_MAX, unite: " %" },
  { cle: "contraste", nom: "contraste", min: CURSEUR_MIN, max: CURSEUR_MAX, unite: " %" },
  { cle: "saturation", nom: "saturation", min: CURSEUR_MIN, max: CURSEUR_MAX, unite: " %" },
  { cle: "teinte", nom: "teinte", min: TEINTE_MIN, max: TEINTE_MAX, unite: "°" },
] as const

// ── Le contour ──────────────────────────────────────────────────────────────

/** La plus sombre de la palette du projet — ce que la table propose à
 *  l'ouverture, et la seule chose qu'elle devine. */
export function laPlusSombre(palette: string[]): string | null {
  if (palette.length === 0) return null
  const clarte = (hexa: string) => {
    const n = parseInt(hexa.replace("#", ""), 16)
    if (Number.isNaN(n)) return 255
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114
  }
  return palette.reduce((a, b) => (clarte(b) < clarte(a) ? b : a))
}

/** **Dans quelle unité l'épaisseur du trait se compte** (D4) — et il y en a deux.
 *
 *  Une fois la case du projet posée, l'image rendue *est* la case : un pixel y
 *  est un bloc du sprite, et le trait était déjà juste. **Sans case**, l'image
 *  fait encore mille pixels de côté, un trait d'un pixel y est un cheveu
 *  invisible, et il ne longe pas la frontière du sprite mais les dentelures que
 *  le modèle a peintes à l'intérieur d'un bloc. Le trait se pose alors sur la
 *  maille que le modèle a employée, quand la mesure la trouve.
 *
 *  **Et quand elle se tait, c'est une peinture** : il n'y a pas de maille, la
 *  seule frontière est celle de l'image telle qu'elle est, et la phrase le dit
 *  au lieu de promettre une grille qui n'existe pas.
 */
export function uniteDuTrait(
  epaisseur: number,
  recette: Recette,
  mesures?: TachesDeLAsset | null,
): string {
  // **Une place endormie est sautée, et la question posée ici est *agit-elle ?*
  // et non *est-elle écrite ?*** C'est la même lecture que le serveur fait dans
  // `queue` ; une seconde façon de la poser aurait fini par répondre autrement.
  const surCase = recette.grille !== null && !(recette.veille ?? []).includes("grille")
  if (surCase) {
    return `${epaisseur} px de l'image rendue — celle qui part dans le jeu`
  }
  const pas = mesures?.grille_du_modele?.pas ?? 0
  if (pas > 1) {
    return `${epaisseur} bloc${epaisseur > 1 ? "s" : ""} de ${pas} px — la maille sur laquelle le modèle a peint, pas les pixels du fichier`
  }
  return `${epaisseur} px de l'image telle qu'elle est — aucune case posée, et le modèle n'a peint aucune grille où caler le trait`
}
// ── La main ─────────────────────────────────────────────────────────────────
//
// **Trois décisions gardent la porte ouverte** : un passage est un vecteur, la
// couleur est portée par le passage, et l'opacité est un calque de la pile
// plutôt qu'un mode à part.

/** Le sol de la pile. **Il ne se supprime pas et ne se déplace pas** — c'est
 *  vrai par construction, puisqu'il n'est pas dans la liste. */
export const OPACITE = -1

export const mainDe = (recette: Recette): Main => recette.main ?? MAIN_VIDE

/** Ce que la pile change, tous calques confondus. */
export const passagesDe = (main: Main): number =>
  main.opacite.length + main.calques.reduce((n, c) => n + c.passages.length, 0)

/** Le rayon d'un diamètre. **C'est le diamètre qui s'affiche** — la largeur du
 *  trait est ce que la main voit, le rayon est ce que le calcul veut — et il
 *  n'est qu'impair, parce qu'un pinceau a un centre. */
export const rayonDe = (diametre: number): number => Math.max(0, (diametre - 1) / 2)

/** Poser un passage sur la couche active, ou en retirer le dernier.
 *
 *  **Écrites ici, appelées par le panneau et par la surface** : la table et
 *  l'image font le même geste vu de deux endroits, et deux compositions
 *  écrites séparément auraient fini par ranger le passage à deux places. */
export function avecPassage(main: Main, actif: number, trait: Trait): Main {
  if (actif === OPACITE) return { ...main, opacite: [...main.opacite, trait] }
  return {
    ...main,
    calques: main.calques.map((c, i) =>
      i === actif ? { ...c, passages: [...c.passages, trait] } : c,
    ),
  }
}

export function sansLeDernier(main: Main, actif: number): Main {
  if (actif === OPACITE) return { ...main, opacite: main.opacite.slice(0, -1) }
  return {
    ...main,
    calques: main.calques.map((c, i) =>
      i === actif ? { ...c, passages: c.passages.slice(0, -1) } : c,
    ),
  }
}

/** Ce que l'écran tient de la main, et que la recette n'a pas à porter.
 *
 *  Le calque actif, le sens du geste, le diamètre et la couleur ne décrivent
 *  pas l'image : ils décrivent la **main**. Les écrire dans la recette les
 *  aurait fait entrer dans l'empreinte, donc changer de pinceau aurait
 *  recalculé un rendu identique.
 */
export type EtatMain = ReturnType<typeof useEtatMain>

export function useEtatMain(univers: Univers) {
  const [actif, choisir] = useState<number>(OPACITE)
  const [sens, setSens] = useState(true)
  const [diametre, setDiametre] = useState(5)
  const [couleur, setCouleur] = useState(univers.palette[0] ?? "#ffffff")
  return { actif, choisir, sens, setSens, diametre, setDiametre, couleur, setCouleur }
}
// ── L'ordre, et il ne se change pas ─────────────────────────────────────────

export type Table =
  | "detourage"
  | "recadrage"
  | "grille"
  | "quantification"
  | "bords"
  | "contours"
  | "retournement"
  | "main"
  | "decoupage"
  | "superposition"

/** Les huit places, puis le trait, puis les deux fabriques.
 *
 *  **L'ordre est celui du traitement**, et il est écrit une fois — ici. Le
 *  domaine l'applique dans cet ordre-là ; deux listes ordonnées de la même
 *  chose finiraient par diverger, et celle de l'écran mentirait alors sur ce
 *  que l'image a subi.
 *
 *  Les deux places qui manquent — **le contour** et **la main** — occupent déjà
 *  leur rang : elles arrivent en E5, et une place qui apparaîtrait le jour où
 *  elle existe déplacerait tout ce qui la suit sous les yeux de quelqu'un qui
 *  a appris l'ordre. */
export const TABLES: readonly { cle: Table; nom: string; fabrique?: true }[] = [
  { cle: "detourage", nom: "détourage" },
  { cle: "recadrage", nom: "recadrage" },
  { cle: "grille", nom: "grille" },
  { cle: "quantification", nom: "quantification" },
  { cle: "bords", nom: "bords" },
  { cle: "contours", nom: "contours" },
  // **En queue et avant la main** (B1). Les deux planches ne la plaçaient pas au
  // même endroit ; le plan a tranché pour la fin de la chaîne, et le domaine la
  // déclare au même rang — l'ordre du fichier est l'ordre d'exécution des deux
  // côtés.
  { cle: "retournement", nom: "retournement" },
  { cle: "main", nom: "la main" },
  { cle: "decoupage", nom: "découpage", fabrique: true },
  { cle: "superposition", nom: "superposition", fabrique: true },
]

/** Ce qu'une place vaut, ou rien.
 *
 *  **Le carré se remplit quand la place change l'image, pas quand elle figure
 *  dans la recette.** Les deux ont longtemps coïncidé, et le recadrage a montré
 *  qu'elles ne coïncident pas toujours : il est posé dès la naissance de tout
 *  asset qui a une silhouette, et une marge de zéro ne change rien. */
export function valeur(table: Table, recette: Recette): string | null {
  switch (table) {
    case "detourage":
      return recette.passes.length > 0 ? RESUME.detourage(recette) : null
    case "recadrage":
      return recette.recadrage &&
        (recette.recadrage.marge > 0 || recette.recadrage.boite !== null)
        ? RESUME.recadrage(recette.recadrage)
        : null
    case "grille":
      return recette.grille ? RESUME.grille(recette.grille) : null
    case "quantification":
      return recette.quantification ? RESUME.quantification(recette.quantification) : null
    // **Trois moteurs depuis B17, et le carré se remplit sur n'importe lequel**
    // — le grain de couleur et l'escalier agissent sans qu'aucune tache ne
    // parte. Ne regarder que `aire_min` aurait laissé la barre annoncer une
    // table creuse pendant que l'image change sous les yeux.
    case "bords":
      return recette.bords &&
        (recette.bords.aire_min > 0 ||
          (recette.bords.grain_min ?? 0) > 0 ||
          (recette.bords.lissage ?? 0) > 0)
        ? RESUME.bords(recette.bords)
        : null
    case "contours":
      return recette.contours ? RESUME.contours(recette.contours) : null
    // Le carré se remplit dès que la place est là : un retournement n'a pas de
    // valeur neutre — le seul sens qu'il porte retourne l'image.
    case "retournement":
      return recette.retournement ? RESUME.retournement(recette.retournement) : null
    // **Une pile de calques vides ne change pas l'image**, donc son carré reste
    // creux : le carré se remplit quand la place *change l'image*, pas quand
    // elle figure dans la recette. Le calque, lui, est gardé — on l'a créé.
    case "main":
      return recette.main && passagesDe(recette.main) > 0
        ? RESUME.main(recette.main)
        : null
    default:
      return null
  }
}

/** Pourquoi une place est indisponible, ou rien.
 *
 *  **Une table indisponible s'ouvre quand même**, et son panneau porte la
 *  raison en clair à la place de ses réglages, avec ce qu'il faut faire pour
 *  l'allumer. C'est la règle de T1 — *le grisé porte sa raison* — qui change
 *  d'endroit, pas qui disparaît : une puce n'a pas la place d'une phrase. */
export function indisponible(
  table: Table,
  traitement: EtatTraitement,
  mesures: TachesDeLAsset | null,
): string | null {
  if (table === "quantification") return traitement.quantification.raison
  // **Le seul cas du contour, et il est franc.** Une image entièrement opaque
  // n'a pas de silhouette : tracer un contour dessus reviendrait à encadrer
  // l'image entière — un rectangle sur les quatre bords, qui n'est jamais ce
  // qu'on voulait. La seconde phrase compte autant que la première : elle dit
  // quoi faire, et le détourage est la première de la barre.
  if (table === "contours" && mesures?.opaque)
    return "cette image est entièrement opaque : il n'y a pas de bord de sujet à tracer, seulement les quatre bords du cadre. Détoure-la d'abord — c'est la première table de la barre."
  // **Le retournement n'est jamais indisponible non plus** (B1), et ce n'est
  // pas définitif : la planche demande qu'il se grise sur la famille interface
  // — des lettres retournées sont illisibles — et sur les décors, dont l'ombre
  // change de côté. Les deux refus supposent de lire la famille de l'image, ce
  // que cette table ne fait pas encore ; ils viennent avec les neuf autres sens.
  //
  // **La main n'est jamais indisponible**, et c'est l'exacte symétrie du
  // contour : toute image se retouche, y compris une image entièrement opaque
  // — *ôter* y crée de la transparence, et un calque de dessin s'y pose comme
  // partout. Son carré est donc toujours là. La superposition non plus : elle
  // marche sur n'importe quelles deux images de la bibliothèque, et c'est très
  // exactement ce qui l'a sortie de la recette — la place `Difference` était
  // grisée sur presque toute la bibliothèque, faute de savoir *par rapport à
  // quoi*.
  return null
}

// ── La veille : quelle table occupe quelle place ────────────────────────────

/** La place de la recette qu'une table règle — ou rien, pour une fabrique.
 *
 *  **Deux listes qui se ressemblent, et il fallait les relier quelque part.**
 *  La barre compte dix tables, la recette huit places : les deux fabriques
 *  écrivent d'autres fichiers et ne posent rien sur celle-ci, donc elles n'ont
 *  rien à éteindre. Écrit ici, au même endroit que l'ordre des tables, pour que
 *  la correspondance se relise d'un coup d'œil le jour où une place bouge. */
export function placeDe(table: Table): Place | null {
  return table === "decoupage" || table === "superposition" ? null : table
}

/** Cette table dort-elle ? **La seule lecture de la veille dans l'écran.** */
export function dort(recette: Recette, table: Table): boolean {
  const place = placeDe(table)
  return place !== null && recette.veille.includes(place)
}

/** La même recette, cette place-ci endormie ou réveillée.
 *
 *  Triée à l'écriture comme le serveur la trie à la lecture : éteindre la
 *  grille puis la palette doit donner exactement le même rendu que l'inverse,
 *  et l'empreinte se calcule sur le texte de la recette. */
export function avecVeille(recette: Recette, table: Table, dort: boolean): Recette {
  const place = placeDe(table)
  if (place === null) return recette
  const restantes = recette.veille.filter((p) => p !== place)
  return {
    ...recette,
    veille: (dort ? [...restantes, place] : restantes).sort(),
  }
}
// ── Le presse-papier de la séance ───────────────────────────────────────────

// **Le presse-papiers vit hors de React, et c'est délibéré.** Copier sur une
// image et coller sur une autre suppose de survivre au démontage de l'écran :
// on change d'image, donc de composant. Le tenir dans un état de React aurait
// demandé de le remonter jusqu'à l'ancêtre commun de toutes les images, qui est
// l'application entière — une variable de séance de plus dans le composant qui
// en a déjà le plus, pour un usage qui ne concerne que cette barre-ci.
//
// **Il ne survit pas au rechargement de la page**, et c'est le contrat : « pour
// la séance en cours ». Ce qui survit à la séance a un autre nom et un autre
// geste — les recettes nommées, juste en dessous.
let copiee: Recette | null = null

/** Oublier ce qui a été copié. **N'existe que pour les essais** : deux essais
 *  qui partageraient un presse-papiers se raconteraient l'un l'autre. */
export function reinitialiserPressePapier(): void {
  copiee = null
}

/** Copier une recette dans le presse-papiers de séance (`B24`).
 *
 *  **Exportée pour que `Retouche.tsx` partage le même presse-papiers**, et
 *  non un second : copier dans un écran et coller dans l'autre doit rester le
 *  même geste tant que les deux écrans coexistent. */
export function copierDansLePressePapier(recette: Recette): void {
  copiee = recette
}

/** Ce qui est dans le presse-papiers, ou `null`. Voir `copierDansLePressePapier`. */
export function lireLePressePapier(): Recette | null {
  return copiee
}
// ── Le grossissement ────────────────────────────────────────────────────────
//
// **Libre entre 1 et 250 %, et le pas entier reste le défaut** (U2, rendu en
// `B24`) : à ×1,5 un pixel du jeu n'est plus un carré.

export const ZOOM_MIN = 1
export const ZOOM_MAX = 250

/** Les arrêts de *plus* et *moins*.
 *
 *  **Une échelle, pas un pas fixe.** Un pas de dix pour cent demanderait vingt
 *  clics pour traverser la plage, et un pas multiplicatif rendrait des nombres
 *  que personne n'écrirait — 141 %, 199 %. La liste ci-dessous est serrée là où
 *  l'on règle et lâche là où l'on regarde de loin, et elle contient 100, qui
 *  est le seul arrêt qui ait un sens propre. */
export const ARRETS_ZOOM = [
  1, 3, 6, 12, 25, 33, 50, 66, 75, 100, 125, 150, 175, 200, 225, 250,
] as const

/** `ajusté` n'est pas un arrêt : c'est **le pour cent qui fait tenir l'image
 *  entière dans le cadre**, recalculé quand le cadre change. Il est l'état
 *  d'ouverture, et il peut descendre sous cent — c'était tout le défaut. */
export type ZoomTable = number | "ajuste"

export const borner = (pour_cent: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(pour_cent)))
// ── Le détourage promu en défaut du projet ──────────────────────────────────

/** Ce qu'un défaut retient d'une passe posée sur une image.
 *
 *  **Le point de la pipette et le tracé n'en sont pas**, et c'est le domaine qui
 *  le décide : un défaut n'a pas d'image où viser. Les reconstruire ici serait
 *  une seconde vérité sur ce qu'est un détourage par défaut. */
export function defautDeLaPasse(passe: Passe): DefautDetourage {
  return {
    moteur: passe.moteur,
    tolerance: passe.tolerance,
    seuil_alpha: passe.seuil_alpha,
    durcissement: passe.durcissement,
    modele: passe.modele,
  }
}
