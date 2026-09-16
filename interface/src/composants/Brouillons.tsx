import { useCallback, useEffect, useState } from "react"
import { CadreDialogue } from "./CadreDialogue"
import { brouillonsLaissesEnPlan, CHANGEMENT_DE_BROUILLON, jeterLeBrouillon, type LigneDeBrouillon } from "../brouillons"
import { ENCORE_EN_COURS, LAISSE_EN_PLAN, NOM_DE_L_ETAPE, NOM_DE_L_ETAT, nomDuTravail, travaux, type TravailSuivi } from "../api-travaux"
import type { Lieu } from "../lieux"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"

/** **Ce qu'on a laissé en plan, des deux côtés** (`RP16`).
 *
 *  Deux sources, une seule liste : les brouillons de ce navigateur, écrits par
 *  la porte commune (`BrouillonLocal.tsx`), et les travaux que le serveur donne
 *  pour non finis — un appel lancé avant un redémarrage est là, avec ce qu'il
 *  attendait. Aucune des deux ne copie l'autre.
 *
 *  ⚠️ **Le compteur n'est pas la liste.** Le carnet compte *toutes les
 *  fabrications encore en cours*, celle qui tourne comprise ; le tiroir ne
 *  montre que ce qui attend un geste. Un travail qui tourne n'a été laissé
 *  nulle part. */
export function useBrouillonsEnPlan(projet: string | null) {
  const [lignes, setLignes] = useState<LigneDeBrouillon[]>([])
  const [travauxLus, setTravauxLus] = useState<TravailSuivi[]>([])

  const relireLesBrouillons = useCallback(() => setLignes(brouillonsLaissesEnPlan()), [])
  useEffect(() => {
    relireLesBrouillons()
    window.addEventListener(CHANGEMENT_DE_BROUILLON, relireLesBrouillons)
    return () => window.removeEventListener(CHANGEMENT_DE_BROUILLON, relireLesBrouillons)
  }, [relireLesBrouillons])

  useEffect(() => {
    if (!projet) { setTravauxLus([]); return }
    let vivant = true
    const lire = () => void travaux.lister(projet).then((r) => { if (vivant) setTravauxLus(r) }).catch(() => { if (vivant) setTravauxLus([]) })
    lire()
    // Dix secondes : le carnet est une pastille, pas un écran de suivi. Celui
    // des fabrications relit toutes les cinq et reste le lieu où l'on regarde.
    const intervalle = window.setInterval(lire, 10000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet])

  const travauxEnPlan = travauxLus.filter((t) => LAISSE_EN_PLAN.includes(t.etat))
  const fabricationsEnCours = travauxLus.filter((t) => ENCORE_EN_COURS.includes(t.etat)).length
  return { lignes, travauxEnPlan, fabricationsEnCours, nombre: lignes.length + travauxEnPlan.length, relireLesBrouillons }
}

/** Une ligne du tiroir. **Les deux boutons portent le nom de ce qu'ils visent**
 *  dans leur libellé lu à voix haute : « Reprendre » seul, répété dix fois, ne
 *  dit pas lequel. */
function Ligne({ titre, detail, reprendre, jeter }: {
  titre: string; detail: string; reprendre: () => void; jeter?: () => void
}) {
  return <div className="rounded-7 border border-trait bg-carte p-[14px]">
    <p className="text-[13px] text-encre">{titre}</p>
    <p className="mt-[4px] text-[12px] text-encre-3">{detail}</p>
    <div className="mt-[8px] flex flex-wrap gap-[8px]">
      <button type="button" className={BOUTON} aria-label={`Reprendre ${titre}`} onClick={reprendre}>Reprendre</button>
      {jeter && <button type="button" className={BOUTON} aria-label={`Jeter le brouillon de ${titre}`} onClick={jeter}>Jeter le brouillon</button>}
    </div>
  </div>
}

/** Le tiroir lui-même — une fenêtre, pas un lieu : on l'ouvre du pied du
 *  carnet, on y reprend un travail, et il se referme sur cet écran-là. */
export function TiroirDesBrouillons({ lignes, travauxEnPlan, sujets, onReprendre, onTravail, onFermer, onChangement }: {
  lignes: readonly LigneDeBrouillon[]
  travauxEnPlan: readonly TravailSuivi[]
  sujets: readonly { identifiant: string; nom: string }[]
  /** Reposer la pile de lieux d'un brouillon, telle qu'il l'a gardée. */
  onReprendre: (retour: Lieu[]) => void
  /** Rouvrir un travail du serveur, par son identifiant. */
  onTravail: (identifiant: string) => void
  onFermer: () => void
  onChangement: () => void
}) {
  const ecrans = [...new Set(lignes.map((l) => l.ecran))]
  const vide = lignes.length === 0 && travauxEnPlan.length === 0
  return <CadreDialogue titre="Brouillons à reprendre" format="preparation" onFermer={onFermer} enfants={
    <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[30px]">
      <header className="flex items-start justify-between gap-[22px]">
        <div>
          <h1 className="font-serif text-[25px]">Brouillons à reprendre</h1>
          <p className="mt-[8px] text-[13px] text-encre-3">Ce qui a été commencé sans être enregistré ni envoyé. Les versions enregistrées restent intactes.</p>
        </div>
        <button type="button" className={BOUTON} onClick={onFermer}>Fermer</button>
      </header>

      {vide && <p className="rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">Rien n’attend. Un travail quitté sans être enregistré revient ici tout seul.</p>}

      {ecrans.map((ecran) => <section key={ecran} aria-label={ecran} className="space-y-[8px]">
        <h2 className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3">{ecran}</h2>
        {lignes.filter((l) => l.ecran === ecran).map((l) => <Ligne
          key={l.cle}
          titre={l.quoi || ecran}
          detail={`Laissé le ${new Date(l.modifie).toLocaleString("fr-FR")} · conservé dans ce navigateur`}
          reprendre={() => { onFermer(); onReprendre(l.retour) }}
          jeter={() => { jeterLeBrouillon(l.cle); onChangement() }}
        />)}
      </section>)}

      {travauxEnPlan.length > 0 && <section aria-label="Fabrications interrompues" className="space-y-[8px]">
        <h2 className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3">Fabrications interrompues</h2>
        {/* **Ceux-là vivent sur le disque, pas ici** : le tiroir les lit chez le
            serveur et n'en garde aucune copie. Un atelier redémarré pendant un
            appel les retrouve donc entiers, avec l'étape qu'ils attendaient. */}
        {travauxEnPlan.map((t) => <Ligne
          key={t.identifiant}
          titre={nomDuTravail(t, sujets)}
          detail={`${NOM_DE_L_ETAT[t.etat]} · attendait : ${NOM_DE_L_ETAPE[t.etape] ?? t.etape}`}
          reprendre={() => { onFermer(); onTravail(t.identifiant) }}
        />)}
      </section>}
    </div>
  } />
}
