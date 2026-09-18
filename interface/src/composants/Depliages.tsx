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
//
// **P2 (V3.5) ajoute trois choses** : sur une planche à plusieurs objets,
// chaque case dit l'objet qu'elle porte ; une case à vérifier se voit avec sa
// raison et se refait seule, prix annoncé avant l'accord ; et une image sortie
// d'une telle planche peut dire « ce n'est pas le bon objet ».

import { useEffect, useState } from "react"
import {
  api,
  estArgent,
  prix as ecrirePrix,
  Refus,
  type Asset,
  type Depliages as EtatDepliages,
  type Envoi,
} from "../api"
import { Bloc } from "./pieces"
import { EcranDecoupe } from "./Decoupe"
import type { Fente } from "./EnTeteDeSurface"
import { RelireAvantEnvoi, type ResumeDeLEnvoi } from "./Relecture"

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
    return (
      <RappelDeLaPlanche
        asset={asset}
        onErreur={onErreur}
        onOuvrir={onOuvrir}
        onChangee={onChangee}
      />
    )
  }

  return <BlocDesDecoupages asset={asset} onErreur={onErreur} onChangee={onChangee} />
}

/** Le rappel d'une ligne vers la planche, et — sur une planche à plusieurs
 *  objets (P2) — « ce n'est pas le bon objet ». Une seule requête, la même que
 *  la fiche de la planche relit déjà : `plusieurs` ne se recalcule pas ici. */
function RappelDeLaPlanche({
  asset,
  onErreur,
  onOuvrir,
  onChangee,
}: {
  asset: Asset
  onErreur: (raison: string) => void
  onOuvrir: (identifiant: string) => void
  onChangee: () => void
}) {
  const numero = numeroDuDepliage(asset.depliage)
  const [plusieurs, setPlusieurs] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    let vivant = true
    setPlusieurs(false)
    setFait(false)
    void api
      .depliagesDe(asset.planche!)
      .then((lu) => vivant && setPlusieurs(lu.plusieurs))
      .catch(() => vivant && setPlusieurs(false))
    return () => {
      vivant = false
    }
  }, [asset.planche])

  const signaler = async () => {
    setEnCours(true)
    try {
      await api.pasLeBonSujet(asset.identifiant)
      setFait(true)
      onChangee()
    } catch (erreur) {
      onErreur(
        erreur instanceof Refus ? erreur.message : "le signalement a été refusé",
      )
    } finally {
      setEnCours(false)
    }
  }

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
      {plusieurs && (
        <div className="mt-2">
          {fait ? (
            <p className="text-[10.5px] leading-4 text-encre-4">
              signalé — sa case est passée à vérifier
            </p>
          ) : (
            <button
              type="button"
              data-pas-le-bon-objet
              disabled={enCours}
              onClick={() => void signaler()}
              className="mesure text-[10.5px] text-signal hover:opacity-70 disabled:opacity-50"
            >
              {enCours ? "signalement en cours…" : "Ce n'est pas le bon objet"}
            </button>
          )}
        </div>
      )}
    </Bloc>
  )
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
  // **La case qu'on refait seule** (P2) : son indice, tant que la fenêtre de
  // prix n'est pas fermée. `null` = fermée.
  const [caseARefaire, setCaseARefaire] = useState<number | null>(null)

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
        {/* **Chaque case dit son objet** (P2) — seulement sur une planche à
            plusieurs objets ; ailleurs, la liste ne dirait rien de plus que
            le texte déjà lu ligne au-dessus. */}
        {etat.plusieurs && etat.cases_de_la_planche.length > 0 && (
          <ul className="flex flex-col gap-[2px] border-b border-trait pb-[8px] text-[10.5px] text-encre-3">
            {etat.cases_de_la_planche.map((c) => (
              <li key={c.indice}>
                case {c.indice + 1} · {c.texte}
              </li>
            ))}
          </ul>
        )}

        <ul className="flex flex-col gap-[6px]">
          {etat.depliages.map((decoupage) => (
            <li key={decoupage.numero} className="flex flex-col gap-[4px]">
              <div className="flex items-center justify-between gap-[8px] text-[11px] text-encre-2">
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
              </div>

              {/* **Les cases à vérifier, avec leur raison en clair** (P2) : le
                  signalement les y a mises, ou le découpage n'a pas trouvé le
                  bon compte pour cette case. */}
              {decoupage.a_verifier && decoupage.a_verifier.length > 0 && (
                <ul className="flex flex-col gap-[4px] pl-[8px]">
                  {decoupage.a_verifier.map((v) => (
                    <li
                      key={v.case}
                      data-a-verifier
                      className="flex items-center justify-between gap-[8px] text-[10.5px] leading-4 text-encre-attention"
                    >
                      <span>
                        case {v.case + 1} à vérifier · {v.raison}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCaseARefaire(v.case)}
                        className="mesure shrink-0 text-encre-4 hover:text-signal"
                      >
                        refaire cette case seule
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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

      {caseARefaire !== null && (
        <ConfirmerRefaireCase
          identifiant={asset.identifiant}
          caseIndex={caseARefaire}
          onFermer={() => setCaseARefaire(null)}
          onEnvoyee={() => {
            setCaseARefaire(null)
            relire()
            onChangee()
          }}
          onErreur={onErreur}
        />
      )}
    </Bloc>
  )
}

/** « Refaire cette case seule » (P2, décision 1) : prépare une image simple,
 *  **montre son prix avant tout**, et n'appelle `POST /generations` qu'après
 *  l'accord explicite du bouton. Réutilise la fenêtre unique de relecture
 *  (`RelireAvantEnvoi`, RP4) — le même cadre que toute confirmation d'envoi. */
function ConfirmerRefaireCase({
  identifiant,
  caseIndex,
  onFermer,
  onEnvoyee,
  onErreur,
}: {
  identifiant: string
  caseIndex: number
  onFermer: () => void
  onEnvoyee: () => void
  onErreur: (raison: string) => void
}) {
  const [prepare, setPrepare] = useState<{
    demande: {
      modele: string
      prompt: string
      projet: string | null
      personnage: string | null
      pose: string | null
      direction: string | null
    }
    envoi: Envoi
  } | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [enPaiement, setEnPaiement] = useState(false)

  useEffect(() => {
    let vivant = true
    setPrepare(null)
    setRefus(null)
    api
      .refaireUneCase(identifiant, caseIndex)
      .then((lu) => vivant && setPrepare(lu))
      .catch((erreur) => {
        if (!vivant) return
        setRefus(erreur instanceof Refus ? erreur.message : "la préparation a été refusée")
      })
    return () => {
      vivant = false
    }
  }, [identifiant, caseIndex])

  const envoi = prepare?.envoi ?? null
  const prixEcrit = ecrirePrix(envoi?.prix.total ?? null, envoi?.prix.mesure.unite)
  const resume: ResumeDeLEnvoi | null = !envoi
    ? null
    : {
        modele: envoi.modele.nom,
        resultat: <p>case {caseIndex + 1} · image simple · 1 génération</p>,
        consommation: prixEcrit,
      }

  const payer = async () => {
    if (!prepare) return
    setEnPaiement(true)
    try {
      await api.generer({
        modele: prepare.demande.modele,
        prompt: prepare.demande.prompt,
        prompt_negatif: "",
        proportions: "",
        personnage: prepare.demande.personnage,
        pose: prepare.demande.pose,
        direction: prepare.demande.direction,
        variations: 1,
        options: {},
        identifiant: crypto.randomUUID(),
        references: [],
        echelle: "",
        repris: false,
      })
      onEnvoyee()
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "l'envoi a été refusé")
    } finally {
      setEnPaiement(false)
    }
  }

  return (
    <div data-refaire-case className="fixed inset-0 z-50 flex flex-col bg-papier">
      <RelireAvantEnvoi
        type="image"
        sousTitre="Refaire cette case seule, sans repayer les autres."
        resume={resume}
        onFermer={onFermer}
        fermetureBloquee={enPaiement}
        refus={refus}
        etat={enPaiement ? "L'envoi est en cours." : "Aucune génération avant de lancer."}
        paiement={{
          libelle: enPaiement
            ? "Envoi en cours…"
            : envoi && estArgent(envoi.prix.mesure.unite)
              ? `Payer et lancer${prixEcrit ? ` ${prixEcrit}` : ""}`
              : "Lancer la fabrication",
          onPayer: () => void payer(),
          prix: <>{prixEcrit}</>,
          empeche: !!refus || !envoi || enPaiement,
        }}
        enfants={null}
      />
    </div>
  )
}
