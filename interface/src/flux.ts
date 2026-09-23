// Le flux d'événements — ce que l'atelier dit de lui-même, et où ça se pose.
//
// Il vivait en clair dans `App.tsx`. `C4` l'en sort pour la même raison que la
// galerie : deux cents lignes de branchement au milieu de l'écran cachaient
// l'écran. Rien n'y change de comportement — le crochet est appelé une fois,
// ses dépendances sont vides, et tout ce qu'il lit passe par `vivant`, le
// miroir toujours frais que `App` tient pour lui.

import { useEffect } from "react"
import {
  ecouter,
  UNIVERS_VIDE,
  type Asset,
  type Bibliotheque,
  type Carte,
  type EmplacementCorps,
  type Etat,
  type Filtre,
  type Generation,
  type Lien,
  type Personnage,
  type Piece,
  type Pose,
  type Teinte,
  type Univers,
} from "./api"
import type { Repli } from "./composants/BarreEtat"
import { annoncerUneFabrication } from "./retours"

type Pose_<T> = React.Dispatch<React.SetStateAction<T>>

/** Le miroir de ce que `App` tient de vivant, relu à chaque rendu.
 *
 *  Le flux se branche une seule fois : lire un état directement dans sa
 *  fermeture le figerait au premier rendu. Tout ce qu'il a besoin de savoir
 *  passe donc par ce `ref`, que `App` rafraîchit. */
export type Vivant = {
  filtre: Filtre
  courant: string | null
  relireCatalogue: () => Promise<void>
  relireGrille: () => Promise<void>
  relireEtat: () => Promise<void>
  fondrePersonnage: (recu: Personnage & { supprime?: boolean }) => void
  relireProduction: () => Promise<void>
  relireLeVestiaire: () => Promise<void>
  personnages: Personnage[]
}

/** Ce que le flux a le droit de poser. */
export type BranchementDuFlux = {
  vivant: { current: Vivant }
  empreinteUnivers: { current: string }
  projetDeLUnivers: { current: string | null }
  setBibliotheque: Pose_<Bibliotheque>
  setCartes: Pose_<Carte[]>
  setCatalogueRepli: Pose_<Repli>
  setChantier: Pose_<Generation[]>
  setEmplacements: Pose_<EmplacementCorps[]>
  setEtat: Pose_<Etat | null>
  setGrille: Pose_<Asset[]>
  setLiaison: Pose_<boolean>
  setLiens: Pose_<Lien[]>
  setPanne: Pose_<string | null>
  setPieces: Pose_<Piece[]>
  setPlan: Pose_<Pose[]>
  setTeintes: Pose_<Record<string, Teinte>>
  setUnivers: Pose_<Univers>
}

/** Poser une génération dans la liste **sans jamais la doubler**.
 *
 *  Deux chemins amènent la même génération à l'écran, et ils se croisent : la
 *  réponse du POST, et l'annonce du flux — que le serveur publie dès qu'il a
 *  enregistré, donc *avant* que le POST ne soit revenu. Insérer sans regarder
 *  d'un côté et fondre de l'autre laissait deux copies de tout ce qui était
 *  lancé depuis cet onglet. Elles restaient jumelles — la mise à jour les
 *  touchait toutes les deux — mais la clé React devenait double, et une clé
 *  double laisse des tuiles orphelines que le rendu suivant ne retire plus.
 *
 *  Le défaut ne survivait à aucun rechargement : le message d'état remplace la
 *  liste entière par celle du serveur, qui, lui, n'a jamais rien doublé. C'est
 *  ce qui l'a rendu invisible jusqu'à une séance faite au navigateur.
 */
/** Fondre un asset annoncé dans la grille — et l'en **retirer** quand il l'a
 *  quittée.
 *
 *  Trois façons de la quitter, et elles se lisent toutes sur l'objet reçu : il
 *  est supprimé, il a changé de projet, ou il ne répond plus au filtre posé.
 *  Le manque de la troisième s'est vu tout de suite au navigateur — supprimer un
 *  projet détache ses assets, chaque détachement est annoncé, et les trois
 *  détachés venaient s'installer dans la grille du projet **ouvert**, qui n'est
 *  pas le leur.
 *
 *  Ce que cette fonction refuse de trancher, c'est **la recherche** : elle vit
 *  sur le serveur, et la rejouer ici ferait dire à la grille autre chose qu'à la
 *  bibliothèque. Sous recherche, un asset inconnu n'entre pas — on redemande. */
export function fondreAsset(
  liste: Asset[],
  recu: Asset,
  filtre: Filtre,
  courant: string | null,
): Asset[] {
  const dehors =
    recu.supprime_le !== null ||
    recu.projet !== courant ||
    (filtre.collection !== null && recu.collection !== filtre.collection) ||
    (filtre.favoris && !recu.favori)
  if (dehors) return liste.filter((a) => a.identifiant !== recu.identifiant)
  if (liste.some((a) => a.identifiant === recu.identifiant))
    return liste.map((a) => (a.identifiant === recu.identifiant ? recu : a))
  if (filtre.recherche.trim()) return liste
  return [recu, ...liste].sort((a, b) => b.cree_le - a.cree_le || a.rang - b.rang)
}

export const fondre = (liste: Generation[], recue: Generation): Generation[] =>
  liste.some((g) => g.identifiant === recue.identifiant)
    ? liste.map((g) => (g.identifiant === recue.identifiant ? recue : g))
    : [recue, ...liste]


export function useFlux({
  vivant,
  empreinteUnivers,
  projetDeLUnivers,
  setBibliotheque,
  setCartes,
  setCatalogueRepli,
  setChantier,
  setEmplacements,
  setEtat,
  setGrille,
  setLiaison,
  setLiens,
  setPanne,
  setPieces,
  setPlan,
  setTeintes,
  setUnivers,
}: BranchementDuFlux) {
// ── Le flux d'événements ──────────────────────────────────────────────────
//
// Plus aucun sondage. On se branche une fois, on écoute, et l'atelier dit ce
// qu'il fait au moment où il le fait. Le premier message est l'état complet :
// c'est lui qui fait qu'un onglet rouvert retrouve les images produites
// pendant son absence — et `EventSource` se rebranche seul, donc une veille
// de machine ou un redémarrage du serveur se rattrapent sans rien recharger.

useEffect(() => {
  return ecouter({
    etat: (recu) => {
      setEtat(recu)
      // **L'atelier neuf ouvrait l'assistant** (E19) — retiré par `C2` avec
      // lui. Le premier lancement a déjà son écran depuis `B15` : le tour du
      // propriétaire (`Installation` en mode « première »), qui prend la
      // fenêtre entière et que le serveur n'annonce que sur un atelier qui
      // n'a rien produit. Deux écrans qui s'ouvrent seuls à la même minute
      // étaient un de trop.
      setBibliotheque(recu.bibliotheque)
      setUnivers(recu.univers ?? UNIVERS_VIDE)
      projetDeLUnivers.current = recu.bibliotheque.courant
      empreinteUnivers.current = JSON.stringify(recu.univers ?? UNIVERS_VIDE)
      if (recu.generations) setChantier(recu.generations)
      if (recu.assets) setGrille(recu.assets)
      // Ce message part **une fois par abonnement**, donc à chaque
      // rebranchement. Son catalogue fait autorité sur celui que l'onglet
      // gardait : sans ça, un serveur redémarré pendant une veille laisse la
      // barre d'état dater une photo qui n'existe plus.
      setCatalogueRepli(recu.catalogue)
      // Et son arrivée **prouve** que l'atelier répond : une panne posée
      // pendant son absence est un fait périmé.
      setPanne(null)
    },
    // **Scopé au jeu ouvert, comme l'asset juste au-dessus** (B4). Une
    // génération qui tourne dans un autre projet — un autre onglet, ou
    // l'agent — arrive sur le même flux : elle n'a rien à faire dans le
    // chantier qu'on regarde, ni à y rester si on vient de changer de jeu.
    generation: (recue) => {
      setChantier((liste) =>
        recue.projet === vivant.current.courant
          ? fondre(liste, recue)
          : liste.filter((g) => g.identifiant !== recue.identifiant),
      )
      // **RV7** : une image qui vise une case part, arrive ou échoue — la
      // case « en cours » de son sujet se relit.
      if (recue.personnage) annoncerUneFabrication({ genre: "generation", projet: recue.projet ?? null, personnage: recue.personnage })
    },
    asset: (recu) => {
      setGrille((liste) =>
        fondreAsset(liste, recu, vivant.current.filtre, vivant.current.courant),
      )
      // **Une image qui porte une case peut la remplir ou la vider**, et les
      // cases se calculent sur les assets — que cet onglet ne tient pas : il
      // n'en a qu'une page, filtrée sur autre chose. On redemande donc, et
      // seulement pour les images qui **concernent** une case : celle qui en
      // porte une, et celle qui vient d'en quitter une, reconnue parce que la
      // matrice la montre encore.
      const concerne =
        recu.personnage ||
        vivant.current.personnages.some((p) =>
          p.cases.some((c) =>
            c.images.some((i) => i.identifiant === recu.identifiant),
          ),
        )
      if (concerne) void vivant.current.relireProduction()
    },
    bibliotheque: setBibliotheque,
    // **Une carte se fond par identifiant, jamais ne s'empile.** Elle arrive
    // par deux chemins qui se croisent — la réponse du POST et l'annonce du
    // flux —, exactement comme une génération en T1. Et comme un asset, elle
    // doit être confrontée à ce qu'on regarde : une carte d'un autre projet
    // n'entre pas dans le tableau du projet ouvert.
    carte: (recue) =>
      setCartes((liste) => {
        if (recue.projet !== vivant.current.courant)
          return liste.filter((c) => c.identifiant !== recue.identifiant)
        if (recue.oubliee)
          return liste.filter((c) => c.identifiant !== recue.identifiant)
        return liste.some((c) => c.identifiant === recue.identifiant)
          ? liste.map((c) => (c.identifiant === recue.identifiant ? recue : c))
          : [recue, ...liste]
      }),
    // **Un lien est né, a été nommé, ou coupé.** Il se fond par identifiant,
    // jamais ne s'empile : il arrive par deux chemins qui se croisent — la
    // réponse du POST et l'annonce du flux —, exactement comme une génération
    // en T1 et comme une carte en T4. Un lien coupé porte `coupe`, et un lien
    // dont une extrémité a disparu arrive par ce message-là, coupé : c'est le
    // serveur qui tient la règle, l'écran ne la rejoue jamais.
    lien: (recu) =>
      setLiens((liste) => {
        if (recu.projet !== vivant.current.courant)
          return liste.filter((un) => un.identifiant !== recu.identifiant)
        if (recu.coupe)
          return liste.filter((un) => un.identifiant !== recu.identifiant)
        return liste.some((un) => un.identifiant === recu.identifiant)
          ? liste.map((un) => (un.identifiant === recu.identifiant ? recu : un))
          : [...liste, recu]
      }),
    // **Un personnage se fond par identifiant, jamais ne s'empile** — même
    // règle que la carte et le lien, et pour la même raison : il arrive par
    // deux chemins qui se croisent, la réponse de l'appel et l'annonce du
    // flux. Un personnage supprimé porte `supprime`, et il est confronté au
    // projet ouvert comme tout ce qui appartient à un projet.
    personnage: (recu) => vivant.current.fondrePersonnage(recu),
    // Ce que le projet n'envoie plus. Un genre à lui : `univers` fait
    // redemander l'état *et* le catalogue depuis T4, et une case décochée n'a
    // aucune raison de coûter deux appels réseau.
    references: (recu) => {
      if (recu.projet !== vivant.current.courant) return
      void vivant.current.relireCatalogue()
    },
    // **Le plan arrive entier**, et il remplace : il est court, et une pose
    // retirée ne se devinerait pas d'un message qui ne porterait que les
    // ajouts. Une pose ajoutée fait paraître une case chez chaque personnage
    // sans qu'aucun personnage soit annoncé — c'est ce que « le plan décide,
    // le personnage soustrait » veut dire, vu du flux.
    //
    // **Et depuis E9, ce que chaque chose réclame est calculé par le
    // serveur** : le type décide de la liste, la chose la complète, et la
    // règle a quatre branches. L'écran ne la rejoue pas — il redemande la
    // production, qui rend le plan et les choses **en un seul aller-retour**,
    // exactement comme au premier chargement. Poser le plan seul aurait
    // laissé les choses avec la liste d'avant, et une attitude neuve ne
    // serait apparue nulle part.
    plan: (recu) => {
      if (recu.projet !== vivant.current.courant) return
      setPlan(recu.plan)
      void vivant.current.relireProduction()
    },
    // **Les directions arrivent entières**, comme le plan et pour les mêmes
    // deux raisons : la liste est courte, et une direction retirée ne se
    // devinerait pas d'un message qui ne porterait que les ajouts. Les cases
    // se redemandent avec, parce qu'une case est une pose *dans une
    // direction* : poser la liste seule aurait laissé les rangées d'avant.
    directions: (recu) => {
      if (recu.projet !== vivant.current.courant) return
      void vivant.current.relireProduction()
    },
    // **Le vestiaire arrive entier**, et il remplace — même règle que le plan,
    // et pour les mêmes deux raisons : il est court, et une pièce retirée ne se
    // devinerait pas d'un message qui ne porterait que les ajouts. Un genre à
    // lui plutôt qu'un champ sur `univers`, qui fait redemander l'état *et* le
    // catalogue depuis T4 : renommer une pièce n'a aucune raison de coûter deux
    // appels réseau.
    vestiaire: (recu) => {
      if (recu.projet !== vivant.current.courant) return
      setEmplacements(recu.emplacements)
      setPieces(recu.pieces)
      // **Et le vestiaire résolu avec** (`B19`) : une pièce ajoutée depuis la
      // fiche d'un sujet arrive par ce message-là, et sans cette relecture sa
      // page ne la verrait qu'au prochain changement de jeu. On redemande
      // plutôt que de recomposer ici : le compte d'un emploi se lit sur les
      // calques, et l'écran ne les a pas.
      void vivant.current.relireLeVestiaire()
    },
    // **Une bande a bougé, et une case du calque animé change avec** (A12).
    //
    // On ne pose pas la bande ici : ce que l'écran lit sont les **cases**, et
    // c'est le serveur qui les compose — recopier la bande dans la bonne case
    // à la main serait un second calcul de la matrice, celui-là même que le
    // dépôt refuse partout ailleurs. On redemande donc le plan, comme les
    // directions le font juste au-dessus et pour la même raison.
    //
    // **Une bande sans personnage ne concerne aucune matrice** : un brouillon
    // gardé dans la galerie n'a pas à faire travailler le codex.
    bande: (recu) => {
      if (!recu.personnage) return
      void vivant.current.relireProduction()
    },
    // Un seul message pour un lot entier : palette recalculée, réglage posé,
    // ou balayage terminé. La grille se redemande alors — c'est le troisième
    // et dernier appel que l'interface refait d'elle-même, et il porte sur des
    // rendus dont l'empreinte vient de changer.
    univers: (recu) => {
      if (recu.projet !== vivant.current.courant) return
      setUnivers(recu.univers)
      projetDeLUnivers.current = recu.projet
      setTeintes(recu.teintes)
      // Un balayage a changé des recettes, donc des empreintes, donc les
      // adresses des rendus : la grille se redemande une fois, pour le lot.
      if (recu.realignes) void vivant.current.relireGrille()
      // **Deux appels réseau, et seulement si l'univers a vraiment changé.**
      // Ce message porte désormais aussi les teintes d'îlot (T9), qui ne sont
      // pas dans l'univers et ne changent ni le grisé ni ce qui partira :
      // colorer un îlot aurait redemandé l'état *et* le catalogue pour une
      // couleur. La règle des deux lignes ci-dessous n'a pas bougé — c'est sa
      // condition qui manquait, parce que jusqu'ici « un message `univers` est
      // arrivé » et « l'univers a changé » étaient la même chose.
      const signature = JSON.stringify(recu.univers)
      if (signature === empreinteUnivers.current) return
      empreinteUnivers.current = signature
      // Et le grisé de la quantification suit la palette : c'est le serveur
      // qui l'écrit, l'écran ne rejoue jamais la règle.
      void vivant.current.relireEtat()
      // **Et le catalogue, parce que promouvoir change ce qui partira.**
      // Trouvé en ouvrant l'atelier, pas au banc : le bloc « Ce qui part »
      // annonçait zéro référence alors que le serveur en comptait une, et il
      // ne se corrigeait qu'au premier changement de sujet. La règle de T1
      // n'avait pas bougé — « le catalogue se redemande parce que le grisé de
      // chaque modèle dépend de la demande en cours » —, c'est la demande qui
      // a gagné une composante que l'écran ne pilote pas.
      void vivant.current.relireCatalogue()
    },
    catalogue: (recu) => {
      setCatalogueRepli(recu)
      // Le repli change ce que chaque modèle peut honorer : la liste, elle,
      // se redemande — c'est le serveur qui écrit les raisons du grisé.
      void vivant.current.relireCatalogue()
    },
    // **Le cadre de l'agent bouge sans que l'écran ait rien fait** : c'est
    // l'agent qui dépense, et c'est un autre onglet qui a peut-être relevé le
    // plafond. Rien d'autre à redemander — la charge porte le cadre entier et
    // sa consommation, et rien ici ne les recalcule.
    agent: (agent) => setEtat((e) => (e ? { ...e, agent } : e)),
    // **RV7** : un travail a bougé. Rien ne se pose ici — on le dit aux
    // écrans qui montrent sa case (`retours.ts`), qui relisent au serveur.
    travail: (annonce) => annoncerUneFabrication({ genre: "travail", annonce }),
    liaison: setLiaison,
  })
}, [])
}
