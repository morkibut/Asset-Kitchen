/**
 * La pile de lieux — **où l'on est, et par où on y est arrivé.**
 *
 * Avant `B0`, « où l'on est » n'était écrit nulle part : il se *reconstruisait*
 * à chaque rendu, à partir de douze états d'ouverture d'`App.tsx` et d'une
 * chaîne de six ternaires longue de cent lignes. Deux conséquences, et les deux
 * ont coûté :
 *
 * - **Le fil d'Ariane mentait par omission.** Neuf des douze états n'y
 *   figuraient pas — le clip, l'envoi, le montage, l'atelier de bande, la
 *   fiche d'un clip —, si bien qu'on pouvait être trois écrans plus bas avec un
 *   fil vide.
 * - **Une branche était morte sans que rien ne le dise.** `decoupeOuverte`
 *   avait sept écritures, toutes à `null` : aucune porte ne l'ouvrait plus, et
 *   son écran comme son fil étaient injoignables depuis le 6 septembre 2026.
 *   Une chaîne de ternaires ne peut pas signaler ça ; une liste de genres, si.
 *
 * Ici, le lieu est **un état**, et le fil en est **dérivé**. Ce fichier ne
 * connaît ni React, ni le DOM, ni une seule couleur : il se lit et s'essaie
 * seul.
 *
 * ⚠️ **Ce qui n'est pas un lieu.** La pile dit ce que *la surface* montre. Une
 * colonne de droite (la fiche d'un asset, la fiche d'un clip), un côté d'un
 * écran (les trois côtés de l'univers), une table choisie dans l'écran des
 * tables, une sélection : ce sont des états de l'écran où l'on est, pas des
 * endroits où l'on va. Les mettre ici gonflerait la pile sans rien dire de
 * plus, et le fil se mettrait à annoncer des étages qu'on n'a pas descendus.
 */

import type { Bande, Carte } from "./api"
import type { CibleDuClip } from "./composants/Clip"

// ── Ce qu'un lieu est ───────────────────────────────────────────────────────

/**
 * Les quatre racines — ce sur quoi une pile repose toujours.
 *
 * Trois viennent des onglets d'avant, et **le tableau de bord est le seul lieu
 * neuf de `B0`** : c'est la balle traçante. Si le carnet, la pile et l'aide de
 * navigation des essais tiennent sur lui, ils tiendront sur les vingt autres.
 */
export type Racine = "tableau-de-bord" | "galerie" | "univers" | "codex"

export type Lieu =
  // Les racines.
  | { genre: "tableau-de-bord" }
  | { genre: "galerie" }
  | { genre: "univers" }
  | { genre: "codex" }
  // Ce qu'on ouvre par-dessus une racine.
  | { genre: "depenses" }
  | { genre: "carte"; carte: Carte }
  // La grille d'une famille (`B9`) — **elle se pose sur le codex**, elle n'en
  // est pas une cinquième racine : c'est le même endroit vu par une porte de
  // plus, et l'onglet *Codex* reste ce qui dit « ailleurs ». La clé de la
  // famille voyage ici plutôt que dans un état à côté, sans quoi deux portes
  // vers la même famille n'atterriraient pas au même endroit — c'est ce qui
  // arrivait avant, la pile disant `codex` et un `useState` disant laquelle.
  | { genre: "famille"; famille: string }
  // Les règles du jeu (`B14`) — **le parcours de création, rouvert**. Elle ne
  // porte aucune charge : les quatre étapes sont un état de l'écran, pas
  // quatre lieux (§ *Ce qui n'est pas un lieu*, en tête de ce fichier), et
  // l'étape ouverte se choisit d'un clic sans qu'on ait descendu un étage.
  //
  // **Elle se pose sur n'importe quelle racine**, comme `depenses` : les règles
  // sont celles du jeu ouvert, et on les rouvre d'où qu'on vienne. Le parcours
  // de *création*, lui, n'est pas ici — il prend la fenêtre entière, avant même
  // qu'un jeu soit ouvert, comme l'ouverture de `B4`.
  | { genre: "regles" }
  // L'installation de la machine (`B15`) — **le seul lieu qui ne parle d'aucun
  // jeu**. Les clés, ComfyUI, le dossier de travail : ce qu'on branche une fois
  // et qui vaut pour tous les jeux de cette machine.
  //
  // **Elle se pose sur n'importe quelle racine**, comme `depenses` et `regles` :
  // on la rouvre du pied du carnet, d'où qu'on vienne. Les quatre étapes ne sont
  // pas quatre lieux (§ *Ce qui n'est pas un lieu*, en tête de ce fichier) — on
  // ne les descend pas, on les choisit.
  //
  // ⚠️ **Le tour de première ouverture, lui, n'est pas ici** : il prend la
  // fenêtre entière avant même qu'un jeu soit ouvert, comme l'ouverture de `B4`
  // et le parcours de création de `B14`.
  | { genre: "installation" }
  // La sortie (`B21`) — **où les fichiers du jeu s'en vont**. Elle se pose sur
  // n'importe quelle racine, comme `depenses` et `regles` : on sort de partout,
  // et c'est le geste qu'on refait cinquante fois.
  //
  // ⚠️ **Elle appartient au jeu, pas à l'atelier**, et c'est ce qui la
  // distingue d'`installation` juste au-dessus : le dossier où l'on dépose est
  // gardé avec ce jeu-ci, et le lot qui sort est fait de ses sujets. Elle ne
  // porte pourtant aucune charge — les cinq réglages sont un état de l'écran,
  // pas cinq lieux (§ *Ce qui n'est pas un lieu*, en tête de ce fichier).
  | { genre: "sortie" }
  // Une pièce d'équipement et ses emplois (`B19`) — **elle se pose sur le
  // codex**, comme la grille d'une famille, et pour la même raison : c'est le
  // même endroit vu par une porte de plus. Le carnet la déplie sous *Les
  // équipements*, à la place des collections, qui ne veulent rien dire d'une
  // pièce.
  //
  // ⚠️ **Ce n'est pas un sujet.** Une pièce n'a pas d'image à elle — le produit
  // interdit d'en générer une sur fond vide —, et sa page ne montre donc pas des
  // images mais ses **emplois** : les façons dont elle sert. `sujet` et `piece`
  // sont deux genres, et les confondre aurait donné une page de sujet à quelque
  // chose qui n'a ni pose, ni direction, ni case.
  | { genre: "piece"; piece: string }
  // Un emploi de cette pièce-là (`B19`) — *portée par Le goliath*, *posée au
  // sol*, *son icône*. Une profondeur sous la pièce, atteinte depuis sa liste,
  // exactement comme la case d'un sujet se descend depuis sa matrice.
  //
  // **Il porte les deux identifiants**, pas seulement le sien : un emploi
  // n'existe que sur sa pièce, et le retrouver en cherchant dans toutes les
  // pièces du jeu aurait demandé au fil de savoir des choses qu'il n'a pas.
  | { genre: "emploi"; piece: string; emploi: string }
  // Les calques d'animation de cet emploi (`B20`) — *ses animations, image par
  // image*. Une profondeur sous l'emploi, et elle porte **le porteur en plus**
  // des deux identifiants de l'emploi.
  //
  // Pourquoi le porteur explicitement, alors que l'emploi le connaît : cet écran
  // range des **bandes**, et une bande appartient à un personnage. Le déduire de
  // l'emploi aurait marché pour un emploi porté et pour aucun autre — et un
  // emploi qui ne porte personne n'a pas d'animation à habiller du tout.
  | {
      genre: "calques-animes"
      piece: string
      emploi: string
      porteur: string
    }
  | { genre: "sujet"; sujet: string }
  // La grille du jeu, et comparer (`B13`) — **deux profondeurs de la page d'un
  // sujet**, atteintes depuis son bandeau d'onglets, comme la matrice l'était
  // déjà avant `B10`. Aucune des deux ne porte d'écriture : la grille montre le
  // sujet posé sur ses cases, comparer montre deux sujets — ou deux images d'un
  // même sujet — côte à côte. Le second sujet choisi dans le comparateur est un
  // état de l'écran, pas un second paramètre du lieu : revenir plus tard y
  // retrouve la page qu'on avait ouverte, pas la comparaison qu'on y faisait.
  | { genre: "grille"; sujet: string }
  | { genre: "comparer"; sujet: string }
  // La retouche (`B16`) — **la chaîne redessinée sur le papier du carnet** :
  // les huit tables dans leur ordre, le trait, les deux fabriques à droite de
  // lui, la colonne des sœurs.
  //
  // **Un seul genre pour cet écran, depuis `B25`.** Ils étaient trois —
  // `"case"` (une image ouverte dans la page d'un sujet), `"tables"` (une image
  // ouverte depuis la galerie) et celui-ci —, c'est-à-dire trois façons
  // d'arriver au même endroit et trois branches où oublier une condition. C'est
  // la panne exacte que `B0` a payée sur `decoupeOuverte` : sept écritures à
  // `null` et pas une porte. `App.tsx` n'a plus qu'**un seul chemin
  // d'écriture** pour lui — `ouvrirLaRetouche` — et les six portes du produit
  // passent toutes par là.
  //
  // ⚠️ **Il s'entre depuis les deux racines**, `galerie` comme `codex`. L'asset
  // suffit à le dire : une image de la galerie n'appartient à aucune chose du
  // jeu, et c'est la pile qui porte alors la racine — pas un second genre. Ce
  // qu'on affiche à sa place se relit dans les deux endroits, la charge du
  // sujet ouvert d'abord, la grille de la galerie ensuite.
  //
  // ⚠️ **La table ouverte n'est pas ici** (§ *Ce qui n'est pas un lieu*, en
  // tête de ce fichier) : c'est un état de l'écran, qu'on choisit sans avoir
  // descendu un étage.
  | { genre: "retouche"; asset: string }
  | { genre: "clip"; cible: CibleDuClip }
  | { genre: "montage"; clip: string }
  | { genre: "bande"; bande: string }
  | { genre: "montage-de-bande"; bande: Bande }
  | { genre: "envoi" }
  | { genre: "reference" }

export type Genre = Lieu["genre"]

/** La pile au démarrage.
 *
 *  **La galerie, et pas le tableau de bord.** C'est l'écran qu'on regardait
 *  déjà en revenant, et surtout : `B0` ajoute un lieu, elle n'en déplace aucun.
 *  Le jour où l'ouverture (`B4`) décidera par où l'on entre, c'est elle qui
 *  posera la première pile. */
export const PILE_INITIALE: readonly Lieu[] = [{ genre: "galerie" }]

// ── Lire la pile ────────────────────────────────────────────────────────────

/** La racine sur laquelle la pile repose. */
export function racine(pile: readonly Lieu[]): Racine {
  const bas = pile[0]?.genre
  return bas === "univers" || bas === "codex" || bas === "tableau-de-bord"
    ? bas
    : "galerie"
}

/** Le lieu d'un genre donné, ou `null`.
 *
 *  **On cherche dans toute la pile, pas seulement au sommet**, parce que
 *  plusieurs lieux se voient ensemble : la case d'un sujet se regarde *dans* le
 *  sujet, et les deux comptent. Le premier trouvé en partant du sommet gagne —
 *  un même genre ne s'empile pas deux fois. */
export function lieu<G extends Genre>(
  pile: readonly Lieu[],
  genre: G,
): Extract<Lieu, { genre: G }> | null {
  for (let rang = pile.length - 1; rang >= 0; rang -= 1) {
    if (pile[rang].genre === genre) {
      return pile[rang] as Extract<Lieu, { genre: G }>
    }
  }
  return null
}

/** Est-on quelque part, à n'importe quelle profondeur ? */
export function dans(pile: readonly Lieu[], genre: Genre): boolean {
  return pile.some((l) => l.genre === genre)
}

// ── Bouger dans la pile ─────────────────────────────────────────────────────

/**
 * Descendre d'un étage.
 *
 * **Un même genre ne s'empile jamais deux fois** : ouvrir une seconde image
 * depuis une image remplace la première au lieu de creuser. Sans cette règle,
 * le fil grandirait sans fin dans un écran qui permet d'aller d'une sœur à
 * l'autre, et « revenir » ne reviendrait nulle part.
 *
 * Descendre **coupe ce qui est plus profond que l'étage remplacé** : ouvrir un
 * autre sujet ferme la case qu'on regardait dans le précédent, sinon la case
 * d'un sujet s'afficherait sous le nom d'un autre.
 */
export function entrer(pile: readonly Lieu[], ou: Lieu): Lieu[] {
  const deja = pile.findIndex((l) => l.genre === ou.genre)
  if (deja === 0) return [ou]
  if (deja > 0) return [...pile.slice(0, deja), ou]
  return [...pile, ou]
}

/**
 * Reposer la pile sur une racine — c'est le geste « aller ailleurs ».
 *
 * **Il remonte de toute profondeur, et c'est voulu** : le fil dit où l'on est,
 * et désigner une racine est le geste qui dit « ailleurs ». Laisser une découpe
 * ouverte derrière une autre racine a déjà coûté une fois — un écran enfermé
 * qu'aucun onglet ne pouvait fermer.
 */
export function poser(ou: Racine): Lieu[] {
  return [{ genre: ou } as Lieu]
}

/** Refermer un étage, où qu'il soit, **et tout ce qui est au-dessus**.
 *
 *  Une racine ne se referme pas — on en change avec `poser`. Un genre absent
 *  rend la pile telle quelle, pour qu'un « fermer » de trop soit sans effet
 *  plutôt qu'une erreur. */
export function sortir(pile: readonly Lieu[], genre: Genre): Lieu[] {
  const rang = pile.findIndex((l) => l.genre === genre)
  return rang <= 0 ? [...pile] : pile.slice(0, rang)
}

/** Remonter à un étage de la pile, désigné par sa profondeur. */
export function remonterA(pile: readonly Lieu[], profondeur: number): Lieu[] {
  return pile.slice(0, Math.max(1, profondeur + 1))
}

// ── Le fil d'Ariane, dérivé ─────────────────────────────────────────────────

/** Un étage du fil. `profondeur` à `null` : c'est l'étage où l'on est, il ne
 *  ramène nulle part, et c'est ce qui le fait lire comme la fin du fil.
 *
 *  `de` et `rang` disent **quel lieu a donné cet étage, et lequel de ses noms
 *  c'était**. L'écran en a besoin pour les gestes qui accompagnent un retour :
 *  revenir par le nom d'une image la remet en sélection, revenir par le mot
 *  *Galerie* ne le fait pas, et les deux ramènent pourtant au même étage. Sans
 *  ça, il faudrait comparer des libellés — donc les traduire deux fois. */
export type Etage = {
  libelle: string
  profondeur: number | null
  de: Lieu | null
  rang: number
}

/**
 * Comment un lieu se nomme dans le fil.
 *
 * Les noms vivants — celui d'un sujet, le label d'une image, le groupe d'une
 * carte — ne sont pas gardés dans la pile : ils y vieilliraient, et un sujet
 * renommé garderait son ancien nom dans le fil jusqu'à ce qu'on remonte. La
 * pile ne porte que des identifiants ; c'est l'écran qui sait les lire, et il
 * passe cette fonction.
 */
export type Annuaire = (
  lieu: Lieu,
  profondeur: number,
  pile: readonly Lieu[],
) => string | readonly string[] | null

/**
 * Le fil d'Ariane, lu depuis la pile — **et de nulle part ailleurs.**
 *
 * Trois niveaux au plus après le nom du jeu, `Navigation.dc.html` § Le fil :
 * chaque bout se clique, sauf le dernier, qui est l'étage où l'on est.
 *
 * **Un lieu peut nommer plusieurs étages**, et c'est ce qui permet à la pile de
 * rester courte : l'écran des tables ouvert sur une image de la galerie dit
 * `Galerie › tonneau-02 › Détourage` à lui tout seul. Le dernier nom qu'un lieu
 * donne est *cet* étage ; ceux d'avant sont le chemin qui y mène, et ils
 * ramènent donc à l'étage du dessous. C'est exactement ce que faisaient les six
 * ternaires, écrit une fois au lieu de six.
 *
 * **Le nom du jeu n'est pas un lieu**, c'est le contexte : il ne paraît que
 * quand il y a un fil, et il ramène à la racine. Une racine au repos ne donne
 * donc aucun fil — c'est la barre qui porte alors le nom du jeu, comme avant.
 */
export function filDAriane(
  pile: readonly Lieu[],
  jeu: string,
  nommer: Annuaire,
): Etage[] {
  const etages: Etage[] = []

  pile.forEach((ou, profondeur) => {
    const dit = nommer(ou, profondeur, pile)
    if (!dit) return
    const noms = typeof dit === "string" ? [dit] : dit
    noms.forEach((libelle, rang) => {
      const dernier = rang === noms.length - 1
      etages.push({
        libelle,
        profondeur: dernier ? profondeur : Math.max(0, profondeur - 1),
        de: ou,
        rang,
      })
    })
  })

  if (etages.length === 0) return []

  // Le dernier étage est celui où l'on est : il ne ramène nulle part.
  etages[etages.length - 1] = { ...etages[etages.length - 1], profondeur: null }

  return [{ libelle: jeu, profondeur: 0, de: null, rang: 0 }, ...etages]
}
