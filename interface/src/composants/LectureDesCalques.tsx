/**
 * AU16 · **Vérifier les calques en mouvement.** La bande se lit avec ses
 * calques posés, frame par frame, sans rien fabriquer.
 *
 * `docs/maquettes-atelier-unifie/equipements.js`, « Vérifier les calques en
 * mouvement » : une bande à choisir, un cadre, trois boutons de lecture, l'état
 * de la frame courante, et la frame à corriger d'un clic.
 *
 * **Rien n'est calculé ici.** L'état de chaque cible, son calque courant, ses
 * corrections et sa source viennent de la couverture
 * (`atelier/services/couverture_equipement.py`) ; l'écran les lit et les nomme.
 *
 * **Ce qu'on ferme pendant la lecture se retrouve.** La bande choisie, la frame
 * affichée et la lecture elle-même vivent dans le stockage de séance, à côté de
 * la sélection de `CouvertureDeLEmploi`. Les sources et les corrections, elles,
 * sont sur le disque du serveur : les relire suffit.
 *
 * ⚠️ **Aucun appel payant.** La lecture n'affiche que des images déjà rendues.
 */
import { useEffect, useState } from "react"
import { apiCalques, cleCible, type CheminEmploi, type CibleCalque, type VarianteCalque } from "../api-calques"
import { ETATS_EQUIPEMENT, type CibleCouverte, type CouvertureEquipement, type OuvrirCalque } from "../api-travaux-equipement"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"

/** Ce qui se lit : une version de base, ses images dans l'ordre, sa cadence. */
type Bande = { resultat: string; nom: string; cadence: number; images: CibleCouverte[] }

export function bandesLisibles(vue: CouvertureEquipement): Bande[] {
  const bandes: Bande[] = []
  for (const c of vue.cases)
    for (const v of c.versions)
      if (v.images.length)
        bandes.push({
          resultat: v.resultat,
          nom: `${c.nom_pose} → ${c.nom_direction || "sans direction"} · ${v.nom}`,
          cadence: Math.max(1, Math.round(v.cadence || 8)),
          images: [...v.images].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0)),
        })
  return bandes
}

/** Le calque qui sort sur cette frame — celui que la couverture désigne, jamais
 *  le premier de la liste. Sans lui, c'est le corps nu qui se montre. */
function calqueDe(image: CibleCouverte): VarianteCalque | undefined {
  return (image.variantes ?? []).find((v) => v.identifiant === image.variante)
}

/** Ce que la correction de cette frame dit, en clair et sans jargon. */
export function motsDeLaCorrection(calque: VarianteCalque | undefined): string {
  if (!calque) return "aucun calque sur cette frame"
  const p = calque.placement
  const morceaux = [
    p.dx || p.dy ? `décalé de ${p.dx}, ${p.dy} px` : "sans décalage",
    p.echelle === 1 ? "à sa taille" : `à ${Math.round(p.echelle * 100)} %`,
    p.devant ? "au-dessus du corps" : "sous le corps",
  ]
  if (calque.masques.derriere.length) morceaux.push("une partie peinte passe de l’autre côté")
  return morceaux.join(" · ")
}

export function LectureDesCalques({ chemin, vue, selection, onCalque, onFermer }: {
  chemin: CheminEmploi
  vue: CouvertureEquipement
  selection: readonly CibleCalque[]
  onCalque: OuvrirCalque
  onFermer: () => void
}) {
  const bandes = bandesLisibles(vue)
  const cle = `atelier-equipement-lecture:${chemin.projet}:${chemin.piece}:${chemin.emploi}`
  const [etat, poser] = useState<{ resultat: string; rang: number; joue: boolean; cadence: number }>(() => {
    try {
      const relu = JSON.parse(sessionStorage.getItem(cle) ?? "null")
      if (relu && bandes.some((b) => b.resultat === relu.resultat)) return relu
    } catch { /* stockage de séance indisponible */ }
    // Une bande de la sélection d'abord : c'est celle qu'on vient de choisir.
    const choisie = bandes.find((b) => b.images.some((i) => selection.some((s) => cleCible(s) === cleCible(i.cible)))) ?? bandes[0]
    return { resultat: choisie?.resultat ?? "", rang: 0, joue: false, cadence: choisie?.cadence ?? 8 }
  })
  useEffect(() => { try { sessionStorage.setItem(cle, JSON.stringify(etat)) } catch { /* idem */ } }, [cle, etat])

  const bande = bandes.find((b) => b.resultat === etat.resultat) ?? bandes[0]
  const compte = bande?.images.length ?? 0
  const rang = compte ? Math.min(etat.rang, compte - 1) : 0
  const image = bande?.images[rang]
  const calque = image && calqueDe(image)

  useEffect(() => {
    if (!etat.joue || compte < 2 || etat.cadence <= 0) return
    const minuteur = window.setInterval(() => poser((e) => ({ ...e, rang: (e.rang + 1) % compte })), 1000 / etat.cadence)
    return () => window.clearInterval(minuteur)
  }, [etat.joue, etat.cadence, compte])

  if (!bande || !image) return <section aria-label="Vérifier les calques en mouvement" className="mt-[22px] rounded-10 border border-trait bg-carte p-[22px]">
    <div className="flex items-center justify-between gap-[14px]"><h3 className="font-serif text-[25px]">Vérifier les calques en mouvement</h3><button className={BOUTON} onClick={onFermer}>Fermer la lecture</button></div>
    <p className="mt-[8px] text-[13px] text-encre-3">Aucune image de base n’est disponible pour cet emploi. Produisez ou choisissez d’abord une version du corps.</p>
  </section>

  const dansLaSelection = selection.some((s) => cleCible(s) === cleCible(image.cible))
  const aller = (pas: number) => poser((e) => ({ ...e, joue: false, rang: (rang + pas + compte) % compte }))

  return <section aria-label="Vérifier les calques en mouvement" data-lecture-des-calques className="mt-[22px] rounded-10 border border-trait bg-carte p-[22px]">
    <div className="flex flex-wrap items-center justify-between gap-[14px]">
      <h3 className="font-serif text-[25px]">Vérifier les calques en mouvement</h3>
      <button className={BOUTON} onClick={onFermer}>Fermer la lecture</button>
    </div>
    <p className="mt-[8px] max-w-prose text-[13px] text-encre-3">Les calques extraits apparaissent même s’ils ne sont pas encore retenus. La lecture garde le cadre de toute la bande et ne fabrique aucune image.</p>
    <div className="mt-[14px] flex flex-wrap items-end gap-[14px]">
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Bande ou image à vérifier<select aria-label="Bande ou image à vérifier" className={BOUTON} value={bande.resultat} onChange={(e) => poser((v) => ({ ...v, resultat: e.target.value, rang: 0, joue: false, cadence: bandes.find((b) => b.resultat === e.target.value)?.cadence ?? v.cadence }))}>{bandes.map((b) => <option key={b.resultat} value={b.resultat}>{b.nom} · {b.images.length > 1 ? `${b.images.length} frames` : "image fixe"}</option>)}</select></label>
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Images par seconde<input aria-label="Images par seconde" type="number" min={1} max={60} value={etat.cadence} onChange={(e) => poser((v) => ({ ...v, cadence: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))} className={`${BOUTON} w-[54px]`} /></label>
    </div>
    <div className="mt-[14px] flex flex-wrap gap-[22px]">
      <img className="damier-papier h-[300px] w-[300px] shrink-0 object-contain" style={{ imageRendering: "pixelated" }} alt={`Frame ${rang + 1} de ${bande.nom}`} src={calque ? apiCalques.image(chemin, calque) : apiCalques.imageCible(chemin, image.cible)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
        <div className="flex flex-wrap gap-[8px]">
          <button className={BOUTON} disabled={compte < 2} onClick={() => aller(-1)}>Frame précédente</button>
          <button className={BOUTON} disabled={compte < 2} onClick={() => poser((e) => ({ ...e, joue: !e.joue }))}>{etat.joue ? "Mettre en pause" : "Lire la bande"}</button>
          <button className={BOUTON} disabled={compte < 2} onClick={() => aller(1)}>Frame suivante</button>
        </div>
        <p role="status" className="text-[13px] text-encre">{image.cible.nature === "frame" ? `Frame ${rang + 1} / ${compte}` : "Image fixe"} · {ETATS_EQUIPEMENT[image.etat]}{dansLaSelection ? "" : " · hors sélection"}</p>
        <p className="text-[12px] text-encre-3">Corrections de cette frame : {motsDeLaCorrection(calque)}.</p>
        <p className="text-[12px] text-encre-3">Source : {calque ? `${calque.source_fiche?.label || calque.source} · ${calque.role === "calque" ? "calque transparent" : calque.role === "source-equipee" ? "personnage équipé à extraire" : "référence d’apparence"}` : "le corps nu de cette frame"}</p>
        {image.raison && <p className="text-[12px] text-encre-3">{image.raison}</p>}
        <button className={`${BOUTON} self-start`} onClick={() => onCalque(image.cible, image.variante ?? undefined)}>Corriger cette frame</button>
      </div>
    </div>
    <div className="defile mt-[14px] flex gap-[8px] overflow-x-auto">{bande.images.map((i, n) => <button key={cleCible(i.cible)} aria-label={`Examiner la frame ${n + 1}`} aria-pressed={n === rang} onClick={() => poser((e) => ({ ...e, joue: false, rang: n }))} className={`w-[128px] shrink-0 rounded-7 border p-[4px] text-left ${n === rang ? "border-signal bg-ligne-ouverte" : "border-trait"}`}><img className="damier-papier h-[128px] w-full object-contain" loading="lazy" alt="" src={apiCalques.imageCible(chemin, i.cible)} /><span className="mt-[4px] block text-[11px] text-encre">{i.cible.nature === "frame" ? `Frame ${n + 1}` : "Image fixe"}</span><span className="block text-[11px] text-encre-3">{ETATS_EQUIPEMENT[i.etat]}</span></button>)}</div>
  </section>
}
