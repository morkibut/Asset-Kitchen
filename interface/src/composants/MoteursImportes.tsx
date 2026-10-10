// MO6 · La section « Les workflows importés » de la page « Moteurs ».
//
// « Un workflow importé devient un moteur comme les autres : ses capacités se
// déduisent de ce qu'il sait recevoir (une zone, une image de fin, une durée),
// et il apparaît dans tous les outils qui peuvent s'en servir. Il apparaît sur
// la page « Moteurs », avec son diagnostic. » (`docs/PLAN-catalogue-des-
// moteurs.md` § MO6.)
//
// **Ce que la carte lit, et rien d'autre** (`GET /workflow-profiles/imported`,
// `atelier/services/profils_workflow.py`, `importes`) : ce qu'il sait faire, lu
// sur ses liaisons ; ce que son graphe saurait recevoir en plus (`a_relier`,
// `atelier/domaine/lecture_graphe.py`) ; et ce qui lui manque pour tourner,
// élément par élément (`diagnostic.a_completer`) — pas seulement « prêt / pas
// prêt ». Les styles de sc-clone et les moteurs sonores n'y sont jamais : ils
// ont leur propre section, sous leur propre nom.
//
// Un workflow vidéo importé reste aussi dans « Vidéo » : c'est la liste que les
// deux écrans qui font un clip proposent. Ici, c'est ce que l'auteur a apporté,
// et ce qu'il lui faut encore.

import { useEffect, useState } from "react"
import { api, Refus } from "../api"
import { workflowsImportes, type CapaciteImportee, type MoteurImporte } from "../api-workflows"
import { Badge, BOUTON, CAPACITE, type EtatBadge } from "./Moteurs"

const message = (e: unknown) => (e instanceof Refus || e instanceof Error ? e.message : "L’opération n’a pas abouti. Réessayez.")

const LIBELLE: Record<CapaciteImportee, string> = {
  creer_image: "Créer une image",
  repeindre_zone: "Repeindre une zone",
  animer: "Animer une image",
  finir_sur_image: "Finir sur une image",
  faire_un_son: "Faire un son",
}

/** Où l'auteur le retrouve, d'après ce qu'il sait faire — le chemin depuis un
 *  écran (AGENTS 8nonies), pas un bouton de plus. */
const OU: Record<CapaciteImportee, string> = {
  creer_image: "se choisit dans « Une image locale »",
  repeindre_zone: "se choisit dans « Repeindre »",
  animer: "se choisit dans « Faire une vidéo libre » et « 4. Le clip »",
  finir_sur_image: "« Fin de l’animation » s’y offre",
  faire_un_son: "se choisit dans « Fabriquer un son »",
}

const NATURE: Record<MoteurImporte["nature"], string> = { image: "Image", video: "Vidéo", audio: "Son" }

export function SectionWorkflowsImportes({ actualiserSur, onRelie }: {
  /** Change de valeur : relit la section (une version vient d'être importée
   *  plus bas, dans « Les workflows locaux »). */
  actualiserSur?: number
  /** Une version neuve vient d'être écrite d'ici : l'appelant relit « Les
   *  workflows locaux » à son tour. */
  onRelie?: () => void
}) {
  const [moteurs, setMoteurs] = useState<MoteurImporte[] | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState<string | null>(null)

  async function relire() {
    setErreur("")
    try {
      setMoteurs((await workflowsImportes.lister()).moteurs)
    } catch (e) {
      setErreur(message(e))
    }
  }
  useEffect(() => {
    void relire()
  }, [actualiserSur])

  async function relier(m: MoteurImporte) {
    setOccupe(m.identifiant)
    setErreur("")
    try {
      await workflowsImportes.relier(m.identifiant, m.version)
      await api.rafraichirCatalogue()
      await relire()
      onRelie?.()
    } catch (e) {
      setErreur(message(e))
    } finally {
      setOccupe(null)
    }
  }

  async function verifier(identifiant: string) {
    setOccupe(identifiant)
    try {
      await relire()
    } finally {
      setOccupe(null)
    }
  }

  return (
    <section aria-label="Les workflows importés" className="space-y-[8px]">
      <h3 className="font-serif text-[25px]">Les workflows importés</h3>
      <p className="text-[12px] text-encre-3">
        Les graphes ComfyUI que tu as importés toi-même, plus bas dans « Les workflows locaux ». Ce que chacun sait faire se lit sur ce que son graphe
        reçoit — une zone, une image de fin, un nombre d’images —, et il apparaît de lui-même dans les outils qui peuvent s’en servir.
      </p>
      {erreur && (
        <p role="alert" className="text-[13px] text-echec">
          {erreur}
        </p>
      )}
      {!moteurs && !erreur && (
        <p role="status" className="text-[13px] text-encre-3">
          Lecture des workflows importés…
        </p>
      )}
      {moteurs && moteurs.length === 0 && (
        <p className="text-[13px] text-encre-3">Aucun workflow importé pour l’instant — « Ajouter un workflow », plus bas, en importe un.</p>
      )}
      {moteurs && moteurs.length > 0 && (
        <div className="grid gap-[8px]">
          {moteurs.map((m) => (
            <CarteWorkflowImporte key={m.identifiant} moteur={m} occupe={occupe} onRelier={relier} onVerifier={verifier} />
          ))}
        </div>
      )}
    </section>
  )
}

function CarteWorkflowImporte({ moteur: m, occupe, onRelier, onVerifier }: {
  moteur: MoteurImporte
  occupe: string | null
  onRelier: (m: MoteurImporte) => void
  onVerifier: (identifiant: string) => void
}) {
  const d = m.diagnostic
  const elements = d.a_completer ?? []
  const eteint = elements.some((e) => e.genre === "comfyui")
  const etat: EtatBadge = d.disponible ? "installe" : eteint ? "indisponible" : "a-completer"
  const reliable = m.a_relier.some((r) => r.reliable)
  const finObligatoire = d.fin_libre === false
  return (
    <article data-moteur-carte={`workflow:${m.identifiant}`} className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">{m.nom}</h4>
        <Badge etat={etat} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        {m.capacites.map((c) => (
          <span key={c} className={CAPACITE}>
            {c === "finir_sur_image" && finObligatoire ? "Finit toujours sur une image" : LIBELLE[c]}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-encre-3">
        {NATURE[m.nature]} · workflow importé, sur cette machine
        {m.nature === "video" && m.durees.length > 0 && ` · ${m.durees.map((s) => `${s} s`).join(", ")}`}
        {m.references_min > 0 && ` · ${m.references_min} image${m.references_min > 1 ? "s" : ""} en entrée`}
        {` · version du ${new Date(m.cree_le * 1000).toLocaleString("fr-FR")}`}
        {m.versions > 1 && ` (${m.versions} versions gardées)`}
      </p>
      {d.disponible && <p className="text-[12px] text-encre-3">Prêt : {m.capacites.map((c) => OU[c]).join(" ; ")}.</p>}
      {!d.disponible && (
        <div className="space-y-[4px]">
          <p className="text-[13px] text-encre-attention">Ce qui lui manque pour tourner :</p>
          <ul className="space-y-[4px] text-[12px] text-encre-3">
            {(elements.length > 0 ? elements.map((e) => e.texte) : d.problemes).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {(d.remarques ?? []).map((r) => (
        <p key={r} className="text-[12px] text-encre-3">
          {r}
        </p>
      ))}
      {m.a_relier.length > 0 && (
        <div className="space-y-[4px] border-t border-trait pt-[8px]">
          {m.a_relier.map((r) => (
            <p key={r.capacite} className="text-[12px] text-encre-2">
              {r.texte}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-[8px]">
        {reliable && (
          <button type="button" className={BOUTON} disabled={occupe !== null} onClick={() => onRelier(m)}>
            {occupe === m.identifiant ? "Nouvelle version…" : "Relier ce que son graphe reçoit"}
          </button>
        )}
        <button type="button" className={BOUTON} disabled={occupe !== null} onClick={() => onVerifier(m.identifiant)}>
          Vérifier de nouveau
        </button>
      </div>
    </article>
  )
}
