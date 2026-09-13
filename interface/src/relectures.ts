// Ce que l'écran redemande au serveur, et quand.
//
// Les clips gardés, le tableau d'inspiration, le plan et les personnages, le
// vestiaire, les calques d'animation, l'univers, l'état. Chacun se redemande
// **au changement de jeu et seulement alors** — le reste arrive par le flux.
//
// Ce bloc vivait en clair dans `App.tsx` ; `C4` l'en sort avec la galerie, sans
// rien y changer : mêmes appels, mêmes dépendances, mêmes silences.

import { useCallback, useEffect, useRef } from "react"
import {
  api,
  type Bibliotheque,
  type Carte,
  type EmplacementCorps,
  type Etat,
  type Fabrique,
  type Generation,
  type Lien,
  type MatriceDesCalquesAnimes,
  type Personnage,
  type Piece,
  type Pose,
  type Teinte,
  type Univers,
  type VestiaireDuJeu,
} from "./api"
import type { Vivant } from "./flux"

type Pose_<T> = React.Dispatch<React.SetStateAction<T>>

export type CeQuOnRelit = {
  bibliotheque: Bibliotheque
  /** L'étage « calques animés » de la pile, ou rien : la matrice ne se demande
   *  que quand l'écran est ouvert. */
  calquesAnimesLieu: { piece: string; porteur: string } | null | undefined
  echouer: (erreur: unknown, defaut: string) => void
  setCalquesAnimes: Pose_<MatriceDesCalquesAnimes | null>
  setCartes: Pose_<Carte[]>
  setClipsDuJeu: Pose_<Generation[]>
  setEmplacements: Pose_<EmplacementCorps[]>
  setEtat: Pose_<Etat | null>
  setFabriques: Pose_<Record<string, Fabrique>>
  setLiens: Pose_<Lien[]>
  setPersonnages: Pose_<Personnage[]>
  setPieces: Pose_<Piece[]>
  setPlan: Pose_<Pose[]>
  setTeintes: Pose_<Record<string, Teinte>>
  setUnivers: Pose_<Univers>
  setVestiaireDuJeu: Pose_<VestiaireDuJeu | null>
  vivant: { current: Vivant }
}

export function useRelectures({
  bibliotheque,
  calquesAnimesLieu,
  echouer,
  setCalquesAnimes,
  setCartes,
  setClipsDuJeu,
  setEmplacements,
  setEtat,
  setFabriques,
  setLiens,
  setPersonnages,
  setPieces,
  setPlan,
  setTeintes,
  setUnivers,
  setVestiaireDuJeu,
  vivant,
}: CeQuOnRelit) {
  // ── Les clips gardés, relus depuis le dépôt (B22) ─────────────────────────
  //
  // Comme la grille, elle se redemande au changement de jeu et **seulement**
  // alors : un clip payé ne change jamais une fois arrivé, et le rejouer à
  // chaque rendu ferait un aller-retour pour rien. Sans jeu ouvert, il n'y a
  // rien à demander — la galerie d'aucun jeu ne montre les clips de tous.

  const relireClipsDuJeu = useCallback(async () => {
    if (!bibliotheque.courant) {
      setClipsDuJeu([])
      return
    }
    try {
      // **Une réponse se lit, elle ne se croit pas.** Le double de `fetch` des
      // essais d'écran rend `{}` pour une route qu'il ne connaît pas encore —
      // `clips` y vaudrait `undefined`, et `clipsDuJeu` doit rester une liste
      // quoi qu'il arrive : `entrees` la parcourt sans se demander si elle
      // existe.
      const recu = await api.clips(bibliotheque.courant)
      setClipsDuJeu(recu.clips ?? [])
    } catch (erreur) {
      echouer(erreur, "les clips du jeu ne répondent pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireClipsDuJeu()
  }, [relireClipsDuJeu])

  // ── Le tableau d'inspiration ──────────────────────────────────────────────
  //
  // Il se redemande quand le projet ouvert change, et **seulement** alors : le
  // tableau appartient à son projet, et un tableau tenu en mémoire pendant qu'on
  // change d'univers montrerait les inspirations d'un autre jeu.

  // **Les groupes ne se tiennent pas à côté des cartes.** La route les rend, et
  // c'est juste au chargement ; mais depuis T8 composer *écrit* un groupe à
  // chaque glissement, et une liste posée une fois serait fausse avant la fin du
  // premier geste. Elle se lit donc sur les cartes que l'écran tient — mêmes
  // cartes, même règle, une seule liste (`Tableau.tsx` § `groupesDe`).
  const relireTableau = useCallback(async () => {
    try {
      const toile = await api.tableau()
      setCartes(toile.cartes)
      setLiens(toile.liens)
      setTeintes(toile.teintes)
      setFabriques(toile.fabriques ?? {})
    } catch (erreur) {
      echouer(erreur, "le tableau ne répond pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireTableau()
  }, [relireTableau])

  /** **Un personnage se fond par identifiant, jamais ne s'empile.**
   *
   *  Il arrive par deux chemins qui se croisent — la réponse de l'appel et
   *  l'annonce du flux —, comme une génération en T1 et une carte en T4. Une
   *  seule fonte, appelée des deux côtés : deux fusions écrites à deux endroits
   *  finiraient par ne plus traiter le même cas (`docs/PIEGES.md`). */
  const fondrePersonnage = useCallback(
    (recu: Personnage & { supprime?: boolean }) =>
      setPersonnages((liste) => {
        if (recu.projet !== vivant.current.courant)
          return liste.filter((p) => p.identifiant !== recu.identifiant)
        if (recu.supprime)
          return liste.filter((p) => p.identifiant !== recu.identifiant)
        return liste.some((p) => p.identifiant === recu.identifiant)
          ? liste.map((p) => (p.identifiant === recu.identifiant ? recu : p))
          : [...liste, recu]
      }),
    [],
  )

  // ── Le plan et les personnages ────────────────────────────────────────────
  //
  // Redemandés quand le projet ouvert change, et **seulement** alors — comme le
  // tableau : un plan appartient à son jeu, et celui d'un autre univers n'a rien
  // à faire à l'écran. Les deux arrivent **en un seul aller-retour** : une
  // colonne de cases n'existe que par le plan qui la nomme.
  const relireProduction = useCallback(async () => {
    try {
      const production = await api.production()
      setPlan(production.plan)
      setPersonnages(production.personnages)
      setEmplacements(production.emplacements)
      setPieces(production.pieces)
    } catch (erreur) {
      echouer(erreur, "les personnages ne répondent pas")
    }
  }, [bibliotheque.courant])

  /** Relire le vestiaire résolu (`B19`).
   *
   *  **Un second aller-retour, et il est assumé** : il balaie les calques du
   *  jeu pour retrouver qui porte les pièces d'avant la tranche, et le coller à
   *  `production()` aurait fait payer ce balayage à chaque ouverture de page.
   *  Il se redemande au changement de jeu et après chaque geste sur un emploi —
   *  jamais en continu. */
  const relireLeVestiaire = useCallback(async () => {
    try {
      setVestiaireDuJeu(await api.emploisDuJeu())
    } catch (erreur) {
      echouer(erreur, "le vestiaire ne répond pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireLeVestiaire()
  }, [relireLeVestiaire])

  /** La matrice des calques d'animation (`B20`), **demandée seulement quand
   *  l'écran est ouvert**.
   *
   *  Elle lit les bandes et les calques d'un porteur ; la charger au démarrage
   *  ferait payer ce balayage à tout le produit pour un écran que presque
   *  personne n'ouvre. C'est le même partage que `vestiaire` et
   *  `vestiaire_du_jeu` côté serveur, et pour la même raison. */
  const relireLesCalquesAnimes = useCallback(async () => {
    if (!calquesAnimesLieu) {
      setCalquesAnimes(null)
      return
    }
    try {
      setCalquesAnimes(
        await api.calquesAnimes(
          calquesAnimesLieu.piece,
          calquesAnimesLieu.porteur,
        ),
      )
    } catch (erreur) {
      echouer(erreur, "les calques d'animation ne répondent pas")
    }
  }, [calquesAnimesLieu?.piece, calquesAnimesLieu?.porteur])

  useEffect(() => {
    void relireLesCalquesAnimes()
  }, [relireLesCalquesAnimes])

  useEffect(() => {
    void relireProduction()
  }, [relireProduction])

  // ── L'univers, redemandé au changement de jeu (B4) ────────────────────────
  //
  // **Le bug de bascule que l'ouverture devait réparer.** `univers` — la
  // bible, la taille de pixel, la palette, les grisés qui en dérivent — ne
  // vivait que du premier message du flux et de l'événement `univers` posé
  // par un réglage : changer de jeu (`ouvrirProjet`) rechargeait la
  // bibliothèque, jamais lui. L'écran gardait donc la bible et la taille de
  // pixel du jeu précédent jusqu'à ce que le flux se rebranche — un
  // rechargement de page, en pratique.
  //
  // **De quel jeu `univers` parle en ce moment** — pas un `bibliotheque.courant`
  // d'avant, un vrai ref posé par les deux messages qui remplissent `univers` :
  // le premier message du flux et l'événement `univers` d'un réglage. Sans lui,
  // l'effet du dessous relirait l'univers à *chaque* montage — y compris le
  // tout premier, où le flux vient tout juste de le servir — et un double de
  // test qui ne sait répondre qu'un univers par défaut à `GET /universe`
  // écraserait alors ce que le premier message venait d'installer.
  const projetDeLUnivers = useRef<string | null>(null)

  const relireUnivers = useCallback(async () => {
    try {
      const recu = await api.univers()
      // **Une réponse qui arrive après qu'on ait changé une seconde fois de
      // jeu est une réponse périmée** — même piège que la carte et l'asset
      // qui se fondent par identifiant : elle porte le projet qu'elle
      // visait, pas celui qu'on regarde maintenant. `""` est la forme que le
      // serveur donne à « sans projet » ici, faute d'un identifiant à
      // renvoyer.
      if ((recu.projet || null) !== vivant.current.courant) return
      setUnivers(recu.univers)
      projetDeLUnivers.current = recu.projet || null
    } catch {
      // Muet, comme `relireEtat` : l'univers vrai revient de toute façon au
      // prochain rebranchement du flux.
    }
  }, [])

  useEffect(() => {
    if (projetDeLUnivers.current === bibliotheque.courant) return
    void relireUnivers()
  }, [relireUnivers, bibliotheque.courant])

  /** Redemander ce que le serveur grise — et lui seul.
   *
   *  La quantification s'allume quand une palette existe (US-65), et c'est le
   *  serveur qui écrit cette phrase-là. L'écran pourrait la déduire de
   *  `univers.palette` ; il ne le fait pas, parce que « l'interface affiche la
   *  raison qu'elle reçoit, elle ne rejoue jamais la règle de son côté ». */
  const relireEtat = useCallback(async () => {
    try {
      setEtat(await api.etat())
    } catch {
      // Muet : l'état complet revient de toute façon au prochain rebranchement
      // du flux, et une panne a déjà sa phrase ailleurs.
    }
  }, [])

  return {
    fondrePersonnage,
    relireClipsDuJeu,
    projetDeLUnivers,
    relireEtat,
    relireLeVestiaire,
    relireLesCalquesAnimes,
    relireProduction,
    relireTableau,
  }
}
