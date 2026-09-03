// Le tiroir à secrets — **une place par fournisseur** (F3).
//
// « Trois portes, une seule pièce » : la fenêtre des réglages et l'étape « Les
// fournisseurs » de l'assistant rendent **ce composant-ci**, et déposer d'un côté écrit au même
// endroit que de l'autre. C'était déjà la promesse du premier lancement quand
// il n'y avait qu'une clé ; elle gagne des portes sans gagner de pièce.
//
// **Ce qui a changé de forme en F3** : le tiroir cesse d'être « la clé ». Il y a
// plusieurs fournisseurs depuis F1, l'un n'en demande aucune, et il en existe
// qui en demandent deux — Cloudflare veut un identifiant de compte *et* un
// jeton, et un tiroir qui n'en accepterait qu'un les découvrirait en F4.
//
// **Un fournisseur qui ne demande rien paraît quand même**, avec un tiroir
// vide : *« celui-ci ne demande rien »* est un renseignement, et c'est le
// premier que l'auteur cherche sur une machine neuve.

import { useState } from "react"
import { api, type EtatSecret, type Tiroir } from "../api"
import { Bouton, Raison } from "./chassis"

/** Le tiroir entier, tel que les deux écrans le rendent.
 *
 *  `compact` resserre les marges pour l'étape de l'assistant, qui vit dans une
 *  colonne étroite. **Rien d'autre ne les distingue** : deux rendus qui
 *  divergeraient sur autre chose que la densité finiraient par diverger sur ce
 *  qu'ils écrivent. */
export function TiroirDesSecrets({
  tiroirs,
  onChange,
  compact = false,
}: {
  tiroirs: Tiroir[]
  /** Appelé après chaque dépôt et chaque retrait, avec le tiroir que le serveur
   *  vient de rendre. L'écran ne recalcule jamais l'état lui-même : une clé
   *  déposée peut être masquée par une variable d'environnement, et seul le
   *  serveur le sait. */
  onChange: (tiroirs: Tiroir[]) => void
  compact?: boolean
}) {
  return (
    <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
      {tiroirs.map((tiroir) => (
        <PlaceDunFournisseur
          key={tiroir.fournisseur}
          tiroir={tiroir}
          onChange={onChange}
          compact={compact}
        />
      ))}
    </div>
  )
}

function PlaceDunFournisseur({
  tiroir,
  onChange,
  compact,
}: {
  tiroir: Tiroir
  onChange: (tiroirs: Tiroir[]) => void
  compact: boolean
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[12.5px] text-texte">{tiroir.fournisseur}</span>
        <span
          className={[
            "mesure text-[10px]",
            tiroir.pret ? "text-ok" : "text-texte-3",
          ].join(" ")}
        >
          {tiroir.pret ? "prêt" : "en attente"}
        </span>
      </div>

      {/* **Un tiroir vide se dit, il ne se cache pas.** Sans cette ligne, un
          fournisseur sans secret paraîtrait comme un fournisseur mal réglé. */}
      {tiroir.secrets.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-texte-3">
          Ce fournisseur ne demande rien — ni compte, ni clé. Il est utilisable
          tel quel.
        </p>
      ) : (
        <>
          {/* **La phrase vient du serveur** : c'est la même que celle qui grise
              ses modèles, et deux rédactions finiraient par dire deux choses.
              Quand il en manque deux, elle dit lesquelles. */}
          {tiroir.manque && <Raison texte={tiroir.manque} />}
          {tiroir.secrets.map((secret) => (
            <UnePlace
              key={secret.nom}
              secret={secret}
              onChange={onChange}
              compact={compact}
            />
          ))}
        </>
      )}
    </section>
  )
}

function UnePlace({
  secret,
  onChange,
  compact,
}: {
  secret: EtatSecret
  onChange: (tiroirs: Tiroir[]) => void
  compact: boolean
}) {
  const [saisie, setSaisie] = useState("")
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const agir = async (quoi: () => Promise<{ tiroirs: Tiroir[] }>) => {
    setEnCours(true)
    setRefus(null)
    try {
      onChange((await quoi()).tiroirs)
      setSaisie("")
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="mesure flex flex-wrap items-baseline gap-x-2 text-[10px]">
        <span className="text-texte-2">{secret.libelle}</span>
        {secret.presente ? (
          <span className="text-texte-3">
            …{secret.apercu} · {secret.origine}
          </span>
        ) : (
          secret.ou && <span className="text-texte-3">{secret.ou}</span>
        )}
      </div>

      <div className="flex items-start gap-2">
        <input
          type="password"
          value={saisie}
          aria-label={secret.libelle}
          placeholder={secret.presente ? "remplacer…" : "…"}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            saisie.trim().length >= 8 &&
            void agir(() => api.deposerSecret(secret.nom, saisie.trim()))
          }
          className={[
            "mesure min-w-0 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-texte placeholder:text-texte-3",
            compact ? "h-[34px] text-[10px]" : "h-[34px] px-3 text-[11px]",
          ].join(" ")}
        />
        <Bouton
          principal
          inactif={saisie.trim().length < 8 || enCours}
          onClick={() => void agir(() => api.deposerSecret(secret.nom, saisie.trim()))}
          enfants={secret.presente ? "Remplacer" : "Déposer"}
        />
        {/* **Retirer ne se propose que si ça retire vraiment.** Une valeur venue
            de l'environnement de la machine ne s'enlève pas d'ici, et un bouton
            qui semblerait le faire serait pire que pas de bouton du tout. */}
        {secret.retirable && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => void agir(() => api.retirerSecret(secret.nom))}
            title="ses modèles se grisent — ses images et ses lignes de dépense restent"
            className="mesure h-[34px] shrink-0 rounded-[2px] border border-bord px-2 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-echec disabled:cursor-not-allowed"
          >
            retirer
          </button>
        )}
      </div>
      <Raison texte={refus} />
    </div>
  )
}
