// Les gestes du vestiaire et des calques d'animation (`B19`, `B20`).
//
// Nommer une pièce, l'attribuer, la retirer ; poser un calque sur une bande, le
// régler, le retirer. **Aucun ne dépense** : tout se fait sur la machine.
//
// Ils vivaient en clair dans `App.tsx` ; `C4` les en sort avec la galerie.

import { api, type GenreDEmploi, type TenueDuCalque } from "./api"

export type CeQueLeVestiaireLit = {
  calquesAnimesLieu: { piece: string; porteur: string } | null | undefined
  echouer: (erreur: unknown, defaut: string) => void
  emploiOuvertLieu: { emploi: string } | null | undefined
  ouvrirLEmploi: (emploi: string | null) => void
  ouvrirLaPiece: (piece: string | null) => void
  relireLeVestiaire: () => Promise<void>
  relireLesCalquesAnimes: () => Promise<void>
  relireProduction: () => Promise<void>
}

export function useVestiaire({
  calquesAnimesLieu,
  echouer,
  emploiOuvertLieu,
  ouvrirLEmploi,
  ouvrirLaPiece,
  relireLeVestiaire,
  relireLesCalquesAnimes,
  relireProduction,
}: CeQueLeVestiaireLit) {
  // ── Les gestes du vestiaire (`B19`) ───────────────────────────────────────
  //
  // **Les écrans ne parlent pas au serveur.** `Emplois`, `Emploi` et le
  // vestiaire d'une fiche remontent leurs gestes ici, comme `GrilleDuJeu` le
  // fait déjà : un écran qui appelle lui-même finit par relire lui-même, et deux
  // relectures ne rendent pas le même instant.
  //
  // **Chacun relit les deux** — le vestiaire résolu *et* la production. Un
  // emploi qui change modifie ce qu'un sujet porte (`Personnage.pieces`), et
  // ne relire que le vestiaire aurait laissé la fiche du porteur avec la liste
  // d'avant jusqu'au prochain changement de jeu.
  const apresUnGesteDuVestiaire = async () => {
    await relireLeVestiaire()
    await relireProduction()
  }

  // ── Les gestes des calques d'animation (`B20`) ───────────────────────────
  //
  // Même règle que ci-dessus : l'écran ne parle pas au serveur, il remonte. Les
  // trois relisent **la matrice seule** — habiller ne change ni le vestiaire ni
  // la production, puisque aucun calque n'est créé et aucune pièce n'est
  // attribuée. Relire les trois aurait fait payer deux balayages pour rien.

  const habillerUneBande = async (bande: string, tenue: TenueDuCalque) => {
    try {
      await api.habillerLaBande(
        bande,
        calquesAnimesLieu?.piece ?? "",
        tenue,
      )
      await relireLesCalquesAnimes()
    } catch (erreur) {
      echouer(erreur, "le calque n'a pas pu être posé")
    }
  }

  const reglerUnCalqueAnime = async (
    habillee: string,
    tenue: TenueDuCalque,
  ) => {
    try {
      await api.reglerLeCalqueAnime(habillee, tenue)
      await relireLesCalquesAnimes()
    } catch (erreur) {
      echouer(erreur, "la façon de suivre a été refusée")
    }
  }

  const deshabillerUneBande = async (habillee: string) => {
    try {
      await api.deshabillerLaBande(habillee)
      await relireLesCalquesAnimes()
    } catch (erreur) {
      echouer(erreur, "le calque n'a pas pu être retiré")
    }
  }

  const ajouterUnEmploi = async (
    piece: string,
    corps: { genre: GenreDEmploi; porteur?: string; nom?: string },
  ) => {
    try {
      await api.ajouterEmploi(piece, corps)
      await apresUnGesteDuVestiaire()
    } catch (erreur) {
      echouer(erreur, "l'emploi a été refusé")
    }
  }

  const reglerUnEmploi = async (
    piece: string,
    emploi: string,
    champs: {
      nom?: string
      emplacement?: string
      devant?: boolean
      description?: string
    },
  ) => {
    try {
      await api.reglerEmploi(piece, emploi, champs)
      await apresUnGesteDuVestiaire()
    } catch (erreur) {
      echouer(erreur, "le réglage a été refusé")
    }
  }

  const retirerUnEmploi = async (piece: string, emploi: string) => {
    try {
      await api.retirerEmploi(piece, emploi)
      // **On referme l'emploi si c'est celui qu'on regardait** — sinon l'écran
      // resterait ouvert sur quelque chose qui n'existe plus, et le fil le
      // nommerait encore.
      if (emploiOuvertLieu?.emploi === emploi) ouvrirLEmploi(null)
      await apresUnGesteDuVestiaire()
    } catch (erreur) {
      echouer(erreur, "le retrait a été refusé")
    }
  }

  /** **Nommer une pièce depuis la fiche de qui la porte l'attribue d'emblée** —
   *  le premier critère de la tranche, en un seul aller-retour. */
  const donnerUnePiece = async (nom: string, porteur: string) => {
    try {
      await api.ajouterPiece({ nom, porteur })
      await apresUnGesteDuVestiaire()
    } catch (erreur) {
      echouer(erreur, "la pièce a été refusée")
    }
  }

  const retirerLaPiece = async (piece: string) => {
    try {
      await api.retirerPiece(piece)
      ouvrirLaPiece(null)
      await apresUnGesteDuVestiaire()
    } catch (erreur) {
      echouer(erreur, "le retrait a été refusé")
    }
  }

  return {
    ajouterUnEmploi,
    deshabillerUneBande,
    donnerUnePiece,
    habillerUneBande,
    reglerUnCalqueAnime,
    reglerUnEmploi,
    retirerLaPiece,
    retirerUnEmploi,
  }
}
