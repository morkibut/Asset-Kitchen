// Comment un lieu se nomme dans le fil d'Ariane.
//
// C'est la seule chose que l'écran ajoute à la pile de `lieux.ts` : la pile dit
// *où* l'on est, cet annuaire dit *comment ça s'appelle*. Il vivait en clair
// dans `App.tsx` ; `C4` l'en sort tel quel — mêmes noms, même ordre, même
// relecture à chaque rendu.

import {
  libelleDEmploi,
  type Asset,
  type Generation,
  type GroupeDeRangement,
  type Personnage,
  type Piece,
  type VestiaireDuJeu,
} from "./api"
import { NOM_DE_LA_RUBRIQUE } from "./composants/Carnet"
import { racine, type Annuaire } from "./lieux"

/** Ce que l'annuaire relit à chaque rendu pour nommer un étage. */
export type CeQuOnNomme = {
  choseOuverte: Personnage | null | undefined
  /** Les clips du jeu — pour nommer celui qu'on découpe. Facultatif : sans
   *  eux, l'étage dit *Le clip*. */
  clips?: Generation[]
  collectionOuverte: string | null
  groupesDeLaFamille: GroupeDeRangement[]
  grille: Asset[]
  personnages: Personnage[]
  pieces: Piece[]
  vestiaireDuJeu: VestiaireDuJeu | null
  /** Le nom des jeux de tuiles, par identifiant — `""` pour le jeu neuf pas encore
   *  enregistré. C'est l'écran des tuiles qui les tient et les fait remonter. */
  nomsDesTuiles?: Record<string, string>
}

export function nommerLeLieu({
  choseOuverte,
  clips = [],
  collectionOuverte,
  groupesDeLaFamille,
  grille,
  personnages,
  pieces,
  vestiaireDuJeu,
  nomsDesTuiles = {},
}: CeQuOnNomme): Annuaire {

/**
 * Comment un lieu se nomme dans le fil — **la seule chose que l'écran ajoute
 * à la pile.**
 *
 * Avant `B0`, ce bloc faisait cent lignes et six ternaires imbriqués : il
 * *devinait* où l'on était en interrogeant dix états d'ouverture les uns
 * après les autres, dans un ordre de priorité qui n'était écrit nulle part.
 * Maintenant la pile dit où l'on est, et ceci dit seulement comment ça
 * s'écrit.
 *
 * **Un lieu peut nommer plusieurs étages**, et c'est ce qui garde la pile
 * courte : l'écran des tables ouvert sur une image de la galerie dit
 * `Galerie › tonneau-cerclé-02 › Détourage` à lui seul. Le dernier nom est
 * *cet* étage ; ceux d'avant sont le chemin qui y mène.
 *
 * **Les noms sont relus à chaque rendu, jamais gardés dans la pile** : un
 * sujet renommé garderait sinon son ancien nom dans le fil jusqu'à ce qu'on
 * remonte.
 */
return (ou, _profondeur, dedans) => {
  switch (ou.genre) {
    // Une racine au repos ne donne aucun fil : c'est la barre qui porte
    // alors le nom du jeu. **Depuis `C3`, le codex n'a plus de famille à
    // lui** : sa seule surface de repos est la barre qui paie, sans nom
    // propre. Il ne nomme donc plus que la chose ouverte au-dessus de lui,
    // quand il y en a une.
    case "codex": {
      // La grille d'une famille nomme déjà l'étage quand elle est ouverte —
      // deux noms pour un seul endroit feraient un fil qui se répète. La page
      // d'une pièce (`B19`) fait pareil : sans cette garde, le fil disait
      // « Personnages › Équipement › Epée », en annonçant un étage qu'on n'a
      // pas descendu.
      if (dedans.some((l) => l.genre === "famille" || l.genre === "piece"))
        return null
      const sujet = dedans.find((l) => l.genre === "sujet")
      const chose =
        sujet && sujet.genre === "sujet"
          ? personnages.find((p) => p.identifiant === sujet.sujet)
          : null
      return chose ? (NOM_DE_LA_RUBRIQUE[chose.famille ?? "personnages"] ?? "Personnages") : null
    }
    // La grille d'une famille (`B9`). Elle nomme l'étage à la place du codex
    // qui la porte : c'est elle qui sait *laquelle*, et le `case "codex"`
    // ci-dessus le devinait d'un état posé à côté de la pile. Le groupe
    // ouvert donne un second nom — « Les personnages › Les boss » —, parce
    // qu'un fil qui dirait toujours *Tous* mentirait dès qu'on ouvre un
    // groupe.
    case "famille": {
      const nom = NOM_DE_LA_RUBRIQUE[ou.famille] ?? ou.famille
      const groupe = groupesDeLaFamille.find(
        (g) => g.identifiant === collectionOuverte,
      )
      return groupe ? [nom, groupe.nom] : nom
    }

    // **Chaque racine se nomme, même au repos** (demande de l'auteur, 18
    // septembre 2026 : « le fil d'Ariane n'est pas partout »). Une racine
    // muette laissait le fil vide sur la galerie, puis le faisait commencer
    // au nom du jeu dès qu'on y descendait — sans dire qu'on venait de la
    // galerie. Les mots sont ceux des lignes du carnet.
    case "galerie":
      return "Galerie"
    case "univers":
      return "Univers & toile"
    case "tableau-de-bord":
      return "Le jeu"
    case "bibliotheque":
      return "Les sujets"
    case "fabrications":
      return "Fabrications"

    case "depenses":
      return "Les dépenses"

    // Les réglages (`B14`, à quatre onglets depuis `RP2`) — **un nom, pas
    // deux**. Ni les quatre étapes du jeu ni les quatre onglets ne sont des
    // étages : on ne les descend pas, on les choisit, et un fil qui les
    // annoncerait ferait croire à une profondeur qui n'existe pas.
    //
    // Le mot est celui de la porte, comme partout ailleurs : on ne clique pas
    // *Réglages* pour arriver sur autre chose.
    case "regles":
      return "Réglages"

    // L'installation (`B15`) — **un nom, pas quatre**, exactement pour la
    // raison ci-dessus. Et le nom du jeu la précède quand même dans le fil :
    // c'est le comportement des dépenses et des règles, qui s'ouvrent aussi
    // de partout. Changer l'un demanderait de changer les trois.
    case "installation":
      return "L'installation"

    // La sortie (`B21`) — même règle que les trois au-dessus : un nom, et le
    // nom du jeu le précède, parce qu'on l'ouvre de partout.
    case "sortie":
      return "Livrer au jeu"
    case "travail":
      return "La fabrication"

    // **Le mot de la porte, et une carte est un étage sous lui** (`RP9`, relevé
    // des désaccords du 15 septembre 2026). Il disait *Inspiration*, qui est le
    // nom d'un **côté** de l'onglet et non celui du lieu : le fil d'Ariane
    // nomme des lieux, et le lieu s'appelle *Univers & toile* dans la liste
    // fermée de `docs/vocabulaire.html`.
    // La racine *Univers & toile* se nomme elle-même désormais : la carte ne
    // la répète que posée sur une autre racine.
    case "carte":
      return racine(dedans) === "univers"
        ? [ou.carte.groupe || ou.carte.identifiant, "Découpage"]
        : ["Univers & toile", ou.carte.groupe || ou.carte.identifiant, "Découpage"]

    case "sujet": {
      const chose = personnages.find((p) => p.identifiant === ou.sujet)
      return chose ? chose.nom : null
    }

    // Une pièce d'équipement (`B19`) — **deux noms depuis un seul lieu**, comme
    // la grille d'une famille : *Les équipements › Epée*. Le codex qui la porte
    // ne nomme rien de son côté (voir sa garde ci-dessus) : deux noms pour un
    // seul endroit feraient un fil qui se répète.
    case "piece": {
      const sienne = pieces.find((p) => p.identifiant === ou.piece)
      return sienne ? [NOM_DE_LA_RUBRIQUE.equipement ?? "Équipement", sienne.nom] : null
    }
    // Un emploi de cette pièce-là (`B19`). Son libellé se compose comme à
    // l'écran quand l'auteur ne lui en a pas donné : un fil qui dirait
    // « porte-le-goliath » ne serait pas un fil.
    case "emploi": {
      const sien = vestiaireDuJeu?.pieces
        .find((p) => p.piece.identifiant === ou.piece)
        ?.emplois.find((e) => e.identifiant === ou.emploi)
      return sien ? sien.nom || libelleDEmploi(sien) : null
    }

    // Les calques d'animation d'un emploi (`B20`) — une profondeur de plus,
    // et son nom ne dépend d'aucune lecture : il dit ce que l'écran montre.
    case "calques-animes":
      return "Ses animations"

    // La grille du jeu, et comparer (`B13`) — deux profondeurs de plus de
    // la page d'un sujet, chacune avec son propre dernier nom.
    //
    // **Mais le sujet ne se nomme pas deux fois**, et c'est la même garde que
    // le codex ci-dessus : on descend ici *depuis* la page du sujet, qui a
    // déjà écrit son nom. Sans elle, le fil disait « Personnages › Le pèlerin
    // › Le pèlerin › Sur la grille du jeu » — vu à l'écran le 16 septembre
    // 2026. On ne garde alors que le dernier nom, celui de l'étage qu'on
    // vient de descendre ; la liste des deux noms reste pour le jour où l'on
    // ouvrirait ces écrans d'ailleurs que de la fiche.
    case "grille": {
      if (dedans.some((l) => l.genre === "sujet")) return "Sur la grille du jeu"
      const chose = personnages.find((p) => p.identifiant === ou.sujet)
      return chose ? [chose.nom, "Sur la grille du jeu"] : null
    }
    case "comparer": {
      if (dedans.some((l) => l.genre === "sujet")) return "Comparer"
      const chose = personnages.find((p) => p.identifiant === ou.sujet)
      return chose ? [chose.nom, "Comparer"] : null
    }

    // La retouche (`B16`) — le troisième de ces écrans, et le seul des trois
    // qui écrive. Son dernier nom est *La retouche* et non la table ouverte :
    // la table est un état de l'écran, pas une profondeur de la pile
    // (`lieux.ts`, « ce qui n'est pas un lieu »).
    //
    // **Deux noms depuis un sujet, trois depuis la galerie** (`B25`). Sous un
    // sujet, c'est lui qui nomme son étage — *Le goliath › tonneau-02 › La
    // retouche*. Sur la galerie, personne ne le fait au-dessus : le lieu porte
    // alors le mot *Galerie* lui-même, exactement ce que l'ancien genre
    // `"tables"` écrivait. **C'est la racine qui décide, pas l'endroit où
    // l'image a été trouvée** : une image née d'une découpe se relit dans la
    // grille tout en étant ouverte sous un sujet, et lui coller *Galerie*
    // annoncerait un étage qu'on n'a pas descendu.
    case "retouche": {
      const image =
        choseOuverte?.cases
          .flatMap((c) => [...c.images, ...Object.values(c.calques).flat()])
          .find((a) => a.identifiant === ou.asset) ??
        grille.find((a) => a.identifiant === ou.asset)
      const nom = image ? image.label || image.identifiant : ou.asset
      // La galerie se nomme elle-même désormais : plus besoin de l'écrire ici.
      return [nom, "La retouche"]
    }

    // **Ces écrans ont un fil aussi** (18 septembre 2026). Ils n'en avaient
    // pas, au motif qu'ils « recouvrent » le produit — et l'auteur s'y
    // retrouvait sans aucun moyen de voir d'où il venait ni d'y revenir.
    case "clip":
      return [ou.cible.personnage.nom, "Faire une vidéo"]
    case "envoi":
      return "L'envoi"
    case "montage": {
      const clip = clips.find((g) => g.identifiant === ou.clip)
      return clip?.demande?.mouvement || clip?.pose || "Le clip"
    }
    case "bande":
      return "L'animation"
    case "montage-de-bande":
      return "Le montage"

    // Les jeux de tuiles (`TU3`) : *Les tuiles › Herbe et terre › Livrer à Godot*.
    case "tuiles":
      return "Les tuiles"
    case "jeu-de-tuiles":
      if (ou.ecran === "sorte") return "Nouveau jeu de tuiles"
      if (ou.ecran === "image") return "À partir d’une image"
      return nomsDesTuiles[ou.jeu ?? ""] || "Jeu de tuiles"
    case "livraison-de-tuiles":
      return "Livrer à Godot"
  }
}
}
