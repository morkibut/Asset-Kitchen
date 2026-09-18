// Les découpages d'une planche — refaire, lister, supprimer (P1c, V3.5).
//
// **Un seul geste ordinaire ne change pas** : une planche qui revient bien se
// déplie toute seule, et cet écran ne se montre à personne ce jour-là. Il ne
// sert que le jour où le découpage tombe mal — l'auteur le refait, autant de
// fois qu'il veut, sans jamais perdre les images déjà sorties d'un dépliage
// précédent.
//
// **Deux visages, selon l'image ouverte** : la planche elle-même montre la
// liste de ses découpages, et une image sortie d'un découpage ne montre qu'un
// rappel d'une ligne vers sa planche. C'est `asset.planche` qui les distingue
// — jamais une seconde requête pour le savoir.
//
// Réutilise l'éditeur de rectangles de `Decoupe.tsx` par sa troisième famille
// (`famille: "depliage"`) plutôt que d'en recopier un : les mêmes gestes —
// déplacer, ajouter, retirer une coupe — y marchent à l'identique.

import { useEffect, useState } from "react"
import { api, Refus, type Asset, type Depliages as EtatDepliages } from "../api"
import { Bloc } from "./pieces"
import { EcranDecoupe } from "./Decoupe"
import type { Fente } from "./EnTeteDeSurface"

/** Le numéro écrit dans l'identifiant d'un dépliage — `{planche}-d{numero}`
 *  (`atelier/domaine/pliage.py`, `identifiant_de_depliage`). Un simple
 *  affichage : rien ne s'envoie à partir de ce nombre. */
function numeroDuDepliage(depliage: string | null | undefined): string | null {
  return depliage?.match(/-d(\d+)$/)?.[1] ?? null
}

export function LesDecoupagesDeLaPlanche({
  asset,
  onErreur,
  onOuvrir,
  onChangee,
}: {
  /** L'image ouverte — la planche, ou une image sortie d'elle. */
  asset: Asset
  onErreur: (raison: string) => void
  /** Ouvrir une autre fiche — la même porte que la filiation de `Fiche.tsx`. */
  onOuvrir: (identifiant: string) => void
  /** Un découpage refait ou supprimé change ce que la grille montre. */
  onChangee: () => void
}) {
  // **Une image sortie d'une planche** : un rappel d'une ligne, et rien de
  // plus — la liste complète se lit sur la fiche de la planche, pas ici.
  if (asset.planche) {
    const numero = numeroDuDepliage(asset.depliage)
    return (
      <Bloc cle="fiche.depliages" titre="Sa planche" aide="fiche.depliages" etat="une image découpée">
        <p className="text-[11px] leading-snug text-encre-2">
          De la planche{" "}
          <button
            type="button"
            onClick={() => onOuvrir(asset.planche!)}
            className="text-signal underline-offset-2 hover:underline"
          >
            {asset.planche}
          </button>
          {numero ? ` · découpage n°${numero}` : ""}
        </p>
      </Bloc>
    )
  }

  return <BlocDesDecoupages asset={asset} onErreur={onErreur} onChangee={onChangee} />
}

/** Séparé du rappel du dessus pour ne fetcher `unfoldings` que sur une image
 *  qui pourrait être une planche — jamais sur une des siennes. */
function BlocDesDecoupages({
  asset,
  onErreur,
  onChangee,
}: {
  asset: Asset
  onErreur: (raison: string) => void
  onChangee: () => void
}) {
  const [etat, setEtat] = useState<EtatDepliages | null>(null)
  const [editeurOuvert, setEditeurOuvert] = useState(false)
  // Le dernier découpage supprimé ici, et ses images : de quoi l'annuler
  // tant que le délai de la corbeille court.
  const [dernierSupprime, setDernierSupprime] = useState<{ numero: number; images: string[] } | null>(null)

  const relire = () => {
    void api
      .depliagesDe(asset.identifiant)
      .then(setEtat)
      .catch(() => setEtat(null))
  }

  useEffect(() => {
    let vivant = true
    setEtat(null)
    void api
      .depliagesDe(asset.identifiant)
      .then((lu) => vivant && setEtat(lu))
      .catch(() => vivant && setEtat(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant])

  // Ni une planche, ni une image sortie d'une planche : rien à montrer.
  if (!etat || etat.planche !== asset.identifiant) return null

  const supprimerDecoupage = async (numero: number) => {
    try {
      const rendu = await api.depliageSupprimer(asset.identifiant, numero)
      setDernierSupprime({ numero, images: rendu.supprimes })
      // Passé le délai de la corbeille, l'annulation serait refusée : le
      // bouton s'en va avec elle.
      window.setTimeout(
        () => setDernierSupprime((d) => (d?.numero === numero ? null : d)),
        rendu.annulation_s * 1000,
      )
      relire()
      onChangee()
    } catch (erreur) {
      onErreur(
        erreur instanceof Refus ? erreur.message : "la suppression du découpage a été refusée",
      )
    }
  }

  const annulerSuppression = async () => {
    if (!dernierSupprime) return
    try {
      await api.restaurer(dernierSupprime.images)
      setDernierSupprime(null)
      relire()
      onChangee()
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "l'annulation a été refusée")
    }
  }

  return (
    <Bloc
      cle="fiche.depliages"
      titre="Ses découpages"
      aide="fiche.depliages"
      etat={`${etat.depliages.length}`}
    >
      <div className="flex flex-col gap-[8px]">
        <ul className="flex flex-col gap-[6px]">
          {etat.depliages.map((decoupage) => (
            <li
              key={decoupage.numero}
              className="flex items-center justify-between gap-[8px] text-[11px] text-encre-2"
            >
              <span>
                Découpage n°{decoupage.numero} ·{" "}
                {decoupage.origine === "main" ? "à la main" : "auto"} ·{" "}
                {decoupage.images.length === 0 && (decoupage.supprime || decoupage.supprime_le)
                  ? "supprimé"
                  : `${decoupage.images.length} image${decoupage.images.length > 1 ? "s" : ""}`}
              </span>
              {decoupage.images.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void supprimerDecoupage(decoupage.numero)}
                  className="mesure shrink-0 text-[10.5px] text-encre-4 hover:text-echec"
                >
                  supprimer ce découpage
                </button>
              ) : dernierSupprime?.numero === decoupage.numero ? (
                <button
                  type="button"
                  onClick={() => void annulerSuppression()}
                  className="mesure shrink-0 text-[10.5px] text-signal hover:opacity-70"
                >
                  annuler
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {etat.refaisable ? (
          <button
            type="button"
            onClick={() => setEditeurOuvert(true)}
            className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
          >
            Refaire le découpage
          </button>
        ) : (
          <p className="mesure text-[10.5px] leading-snug text-encre-4">{etat.raison}</p>
        )}
      </div>

      {editeurOuvert && (
        <div data-refaire-decoupage className="fixed inset-0 z-50 flex flex-col bg-papier">
          <EcranDecoupe
            sujet={{
              famille: "depliage",
              planche: asset,
              onDecoupe: () => {
                setEditeurOuvert(false)
                relire()
                onChangee()
              },
            }}
            onFermer={() => setEditeurOuvert(false)}
            onFente={(fente: Fente) => {
              if (fente?.ton === "echec") onErreur(String(fente.texte))
            }}
          />
        </div>
      )}
    </Bloc>
  )
}
