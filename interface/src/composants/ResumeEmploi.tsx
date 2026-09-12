import { useEffect, useState } from "react"
import { apiCalques, type CiblesEmploi } from "../api-calques"
import { equipements, type CouvertureEquipement } from "../api-travaux-equipement"
import { libelleDEmploi, type EmploiResolu } from "../api"

/** Les anciennes matrices restent historiques ; cette ligne compte les cibles réelles. */
export function ResumeEmploi({ projet, piece, emploi, onOuvrir }: { projet: string; piece: string; emploi: EmploiResolu; onOuvrir: () => void }) {
  const [vue, setVue] = useState<CiblesEmploi | null>(null)
  const [couverture, setCouverture] = useState<CouvertureEquipement | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let vivant = true
    const chemin = { projet, piece, emploi: emploi.identifiant }
    Promise.all([apiCalques.cibles(chemin), equipements.couverture(chemin)]).then(([v, c]) => { if (vivant) { setVue(v); setCouverture(c) } }).catch(e => { if (vivant) setErreur(e.message) })
    return () => { vivant = false }
  }, [projet, piece, emploi.identifiant])
  const variantes = vue?.variantes ?? []
  const vignette = variantes.find(v => v.utilisable) ?? variantes.find(v => v.role === "calque") ?? variantes.at(-1)
  const cadres = vue?.cibles.filter(c => c.cible.nature === "frame").length ?? 0
  const images = (vue?.cibles.length ?? 0) - cadres
  const pretes = variantes.filter(v => v.utilisable).length
  const aExtraire = variantes.filter(v => v.etat === "a-extraire").length
  const aRevoir = variantes.filter(v => v.etat === "a-revoir" || v.etat === "a-verifier").length
  return <button className="flex items-center gap-[14px] rounded-8 p-[14px] text-left hover:bg-papier" data-emploi={emploi.identifiant} onClick={onOuvrir}>
    {vignette ? <img src={apiCalques.image({ projet, piece, emploi: emploi.identifiant }, vignette)} alt={`Aperçu de ${libelleDEmploi(emploi)}`} className="damier-papier h-[54px] w-[54px] shrink-0 object-contain" style={{ imageRendering: "pixelated" }} /> : <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-7 border border-trait text-[11px] text-encre-3">À créer</span>}
    <span className="min-w-0 flex-1"><span className="text-[14px] text-encre">{libelleDEmploi(emploi)}</span><span className="mt-[4px] block text-[12px] text-encre-3">{emploi.emplacement_nom || "Emplacement à choisir dans cet emploi"} · placement et masques par frame</span>{vue && <span className="mt-[8px] block text-[12px] text-encre-3">{images} images fixes · {cadres} frames de corps disponibles · {pretes} calques vérifiés{aExtraire ? ` · ${aExtraire} images à extraire` : ""}{aRevoir ? ` · ${aRevoir} variantes à revoir` : ""}</span>}{couverture && <span className="mt-[4px] block text-[12px] text-encre-3">{couverture.images.bases_a_choisir + couverture.animations.bases_a_choisir > 0 ? "Choisissez les versions du corps pour lire leurs manques." : couverture.prete ? "Les cibles demandées sont prêtes." : `${couverture.images.absente + couverture.animations.absente} calques manquants sur les versions choisies.`}{couverture.images.bases_absentes + couverture.animations.bases_absentes > 0 ? " Des corps restent à produire." : ""}</span>}{erreur && <span className="mt-[8px] block text-[12px] text-echec">{erreur}</span>}</span><span className="text-[12px] text-encre-3">Ouvrir →</span>
  </button>
}
