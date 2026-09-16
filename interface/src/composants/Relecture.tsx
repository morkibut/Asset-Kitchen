// **Relire avant l'envoi — une seule fenêtre, quel que soit le type** (RP4).
//
// Le produit en avait six : une vraie — `EcranEnvoi` —, et cinq vues internes
// qui redisaient chacune à leur façon le modèle, ce qui part, le prix, le
// message rouge et le bouton qui paie. Cinq fois la même fenêtre, cinq fois les
// mêmes mots écrits autrement, et cinq occasions d'en oublier un.
//
// **Ce fichier ne compose rien.** Il dessine le cadre, le résumé en trois
// cases, la ligne rouge et le pied qui paie ; ce qui part, chaque type le lit
// sur l'objet que l'envoi emprunte — la réponse de `/api/outgoing` pour une
// image fixe, le travail préparé pour un clip, un son ou un rendu 3D. C'est
// l'invariant de la tranche : **le texte montré avant de payer est demandé par
// le chemin même que l'envoi emprunte.**

import type { ReactNode } from "react"
import type { TypeDeResultat } from "../fabrication"

const BOUTON =
  "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"

export type ResumeDeLEnvoi = {
  /** Le champ du modèle — `CHAMP_DU_MODELE`, écrit une fois pour les quatre
   *  types : qui sert le modèle, et lequel c'est. */
  modele: ReactNode
  /** Ce qui est demandé, en une ligne : format, durée, nombre de résultats. */
  resultat: ReactNode
  /** Ce que ça prend, **déjà écrit par `prix()`** — la seule écriture du
   *  produit. */
  consommation: ReactNode
  /** D'où vient le chiffre. Une moyenne relevée n'est pas un tarif annoncé, et
   *  sans cette phrase elle se lirait comme une facture. */
  mesure?: ReactNode
}

/** La fenêtre unique de relecture.
 *
 *  Elle ne sait rien des quatre types sinon leur nom : `data-type` le porte,
 *  pour que les essais puissent dire *laquelle des quatre* est à l'écran sans
 *  que l'écran ait à le raconter à l'auteur. */
export function RelireAvantEnvoi({
  type,
  sousTitre,
  resume,
  attente,
  modification,
  onFermer,
  fermetureBloquee,
  refus,
  echec,
  etat,
  pied,
  avantLeBouton,
  paiement,
  enfants,
}: {
  type: TypeDeResultat
  sousTitre: ReactNode
  /** `null` tant que rien n'est composé : le corps cède la place à `attente`. */
  resume: ResumeDeLEnvoi | null
  attente?: ReactNode
  /** Le bouton qui déverrouille les champs, quand le type sait les rouvrir. */
  modification?: { active: boolean; onBasculer: () => void; bloquee?: boolean }
  onFermer: () => void
  /** Ce qui retient encore ici : l'envoi parti, et rien d'autre. */
  fermetureBloquee?: boolean
  refus?: ReactNode
  echec?: ReactNode
  /** La ligne sous le prix : *actualisation*, *envoi en cours*, ou la promesse
   *  que rien ne part avant le bouton. */
  etat?: ReactNode
  /** Ce que le type ajoute sous la ligne de prix. */
  pied?: ReactNode
  /** Ce que le type pose juste avant le bouton, à sa hauteur. */
  avantLeBouton?: ReactNode
  paiement: {
    /** Le mot du bouton, déjà complet — il dit s'il paie ou s'il lance. */
    libelle: string
    onPayer: () => void
    /** Le prix écrit, répété au pied parce qu'on décide là. */
    prix: ReactNode
    empeche?: boolean
  }
  enfants: ReactNode
}) {
  return (
    <main
      data-envoi
      data-relecture
      data-type={type}
      aria-label="Relire avant l’envoi"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier text-[13px]"
    >
      <header className="flex shrink-0 items-start justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
        <div>
          <h1 className="font-serif text-[38px]">Relire avant l’envoi</h1>
          <p className="mt-[8px] text-encre-3">{sousTitre}</p>
        </div>
        <div className="flex shrink-0 gap-[8px]">
          {modification && (
            <button
              className={BOUTON}
              aria-pressed={modification.active}
              onClick={modification.onBasculer}
              disabled={modification.bloquee}
            >
              {modification.active ? "Terminer les modifications" : "Modifier l’envoi"}
            </button>
          )}
          {/* **Revenir n'est jamais empêché par ce qui empêche de payer.** Un
              prix qu'on ne sait pas encore, un refus, une actualisation en
              cours : rien de tout ça n'est une raison de retenir l'auteur ici.
              Seul l'envoi en cours l'est, parce qu'il est déjà parti. */}
          <button className={BOUTON} onClick={onFermer} disabled={fermetureBloquee}>
            Revenir à la préparation
          </button>
        </div>
      </header>
      {!resume ? (
        <p role="status" className="p-[30px] text-encre-3">
          {attente ?? "Composition de l’envoi…"}
        </p>
      ) : (
        <div className="defile min-h-0 flex-1 overflow-y-auto p-[30px]">
          {/* **Le résumé en trois cases** — le même pour les quatre types, et
              c'est lui qui fait qu'on reconnaît la fenêtre quoi qu'on prépare. */}
          <section
            aria-label="Modèle et réglages de l’envoi"
            className="mb-[22px] grid grid-cols-3 gap-[22px] rounded-7 border border-trait bg-carte p-[22px]"
          >
            <div>
              <p className="text-encre-3">Fournisseur et modèle</p>
              <p className="mt-[8px] font-medium">{resume.modele}</p>
            </div>
            <div>
              <p className="text-encre-3">Résultat demandé</p>
              <div className="mt-[8px]">{resume.resultat}</div>
            </div>
            <div>
              <p className="text-encre-3">Consommation estimée</p>
              <p className="mt-[8px] font-medium">{resume.consommation}</p>
              {resume.mesure}
            </div>
          </section>
          {enfants}
        </div>
      )}
      <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]">
        <div>
          {echec && (
            <p role="alert" className="text-echec">
              {echec}
            </p>
          )}
          {refus && <p className="text-echec">{refus}</p>}
          <p>{paiement.prix}</p>
          {etat && <p className="mt-[4px] text-encre-3">{etat}</p>}
          {pied}
        </div>
        {avantLeBouton}
        <button
          className="h-[42px] shrink-0 rounded-7 bg-signal px-[22px] text-encre-sur-signal disabled:opacity-50"
          disabled={paiement.empeche}
          onClick={paiement.onPayer}
        >
          {paiement.libelle}
        </button>
      </footer>
    </main>
  )
}
