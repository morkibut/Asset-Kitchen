// MO3 · La section « Vidéo » de la page « Moteurs ».
//
// Wan (la carte de la maison), les modèles vidéo d'OpenRouter et les workflows
// vidéo importés par l'auteur, **tels que le catalogue commun les rend**
// (`ServiceAnimation.catalogue`, `GET /clips/models`) — la même liste que
// « Faire une vidéo libre » et « 4. Le clip » lisent par `ChoixModeleVideo`.
// Cette section ne recopie aucun nom, aucune capacité, aucun état : elle lit
// `source`, `capacites`, `cout` et `etat`, que le serveur écrit pour les trois
// sources dans la même forme.
//
// **Ce que la page montre n'est pas le grisé d'une demande.** Le catalogue se
// lit avec la demande par défaut d'un clip, mais une durée qu'un moteur ne fait
// pas ne le rend pas « indisponible » : la carte lit `etat`, qui ne dépend
// d'aucune demande, et laisse `grise` aux écrans qui commandent.
//
// Dans son propre fichier, et montée d'une ligne au bas de `PageDesMoteurs` :
// les sections de la page (image par MO2, son par MO4…) s'ajoutent sans se
// toucher.

import { useEffect, useState } from "react"
import { api, Refus, type EtatMoteurVideo, type ModeleVideo } from "../api"
import { surCetteMachine } from "./ChoixModeleVideo"
import { Badge, BOUTON, CAPACITE, type EtatBadge } from "./Moteurs"

const BADGE_VIDEO: Record<EtatMoteurVideo, EtatBadge> = {
  pret: "installe",
  a_installer: "a-installer",
  cle_manquante: "cle-manquante",
  indisponible: "indisponible",
}

/** Une durée lisible en français : 1 s, 1,5 s. */
const secondes = (s: number) => `${String(s).replace(".", ",")} s`

export function SectionMoteursVideo({ onInstallation }: { onInstallation?: () => void }) {
  const [modeles, setModeles] = useState<ModeleVideo[] | null>(null)
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    let vivant = true
    // La demande par défaut d'un clip, celle que « 4. Le clip » ouvre : seul
    // l'ordre et le prix en dépendent, jamais ce que la carte montre.
    api
      .modelesVideo(1.5, "480p", "1:1")
      .then((r) => vivant && setModeles(r.modeles))
      .catch((e) => vivant && setErreur(e instanceof Refus || e instanceof Error ? e.message : "La liste n’a pas pu être lue."))
    return () => {
      vivant = false
    }
  }, [])

  return (
    <section aria-label="Vidéo" className="space-y-[8px]">
      <h3 className="font-serif text-[25px]">Vidéo</h3>
      <p className="text-[12px] text-encre-3">
        Chaque moteur vidéo part d’une image de départ, toujours. Wan tourne sur la carte de cette machine, un workflow importé passe par ComfyUI, et les
        modèles en ligne arrivent de leur fournisseur. « Faire une vidéo libre » et « 4. Le clip » proposent cette même liste.
      </p>
      {erreur && <p className="text-[13px] text-encre-3">La liste des moteurs vidéo n’a pas pu être lue : {erreur}</p>}
      {!modeles && !erreur && <p className="text-[13px] text-encre-3">Lecture des moteurs vidéo…</p>}
      {modeles && modeles.length === 0 && <p className="text-[13px] text-encre-3">Aucun moteur vidéo au catalogue pour l’instant.</p>}
      {modeles && modeles.length > 0 && (
        <div className="grid gap-[8px]">
          {modeles.map((m) => (
            <CarteMoteurVideo key={m.identifiant} modele={m} onInstallation={onInstallation} />
          ))}
        </div>
      )}
    </section>
  )
}

function CarteMoteurVideo({ modele, onInstallation }: { modele: ModeleVideo; onInstallation?: () => void }) {
  const etat = modele.etat ?? { code: "pret" as const, raison: null }
  const finit = modele.capacites?.image_de_fin ?? modele.accepte_une_image_de_fin ?? false
  const durees = modele.capacites?.durees ?? modele.durees
  const ou =
    modele.source === "workflow" ? "Workflow importé, sur cette machine" : surCetteMachine(modele) ? "Sur cette machine" : "En ligne"
  const cout = modele.de_la_maison ? "calcul local, gratuit — le temps s’annonce avant chaque clip" : "payant — le prix s’annonce avant chaque clip"
  return (
    <article data-moteur-carte={modele.identifiant} className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">
          <span className="text-encre-3">{modele.fournisseur} · </span>
          {modele.nom}
        </h4>
        <Badge etat={BADGE_VIDEO[etat.code]} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Animer une image</span>
        {finit && <span className={CAPACITE}>{finit === "obligatoire" ? "Finit toujours sur une image" : "Finir sur une image"}</span>}
      </div>
      <p className="text-[12px] text-encre-3">
        {ou} · {durees.length ? durees.map(secondes).join(", ") : "durées non déclarées"} · {cout}
      </p>
      {etat.raison && <p className="text-[12px] text-encre-attention">{etat.raison}</p>}
      {etat.code === "a_installer" && onInstallation && (
        <div>
          <button type="button" className={BOUTON} onClick={onInstallation}>
            Ouvrir l’installation
          </button>
        </div>
      )}
      {etat.code === "cle_manquante" && <p className="text-[12px] text-encre-3">Une clé se branche plus haut, dans « Les fournisseurs ».</p>}
    </article>
  )
}
