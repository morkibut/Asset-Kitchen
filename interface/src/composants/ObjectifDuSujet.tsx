/** AU2 — définir ce qui sera livré, indépendamment des références et des variantes. */
import { useEffect, useMemo, useState } from "react"
import { api, type Personnage, type ObjectifProduction, type ObjectifDuPersonnage } from "../api"

type Props = {
  personnage: Personnage
  projet: string
  onChange?: () => void
}

const champ = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre outline-none focus:border-encre-4 disabled:text-eteint"
const bouton = "rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[12.5px] text-encre-controle hover:border-encre-4 disabled:text-eteint"

export function ObjectifDuSujet({ personnage, projet, onChange }: Props) {
  const [lecture, setLecture] = useState<ObjectifDuPersonnage | null>(null)
  const [brouillon, setBrouillon] = useState<ObjectifProduction | null>(null)
  const [edition, setEdition] = useState(false)
  const [travaille, setTravaille] = useState(false)
  const [erreur, setErreur] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let actif = true
    setLecture(null)
    setBrouillon(null)
    setEdition(false)
    setErreur("")
    api.objectifPersonnage(personnage.identifiant, projet).then((lu) => {
      if (!actif) return
      setLecture(lu)
      setBrouillon(structuredClone(lu.objectif))
    }).catch((e: Error) => { if (actif) setErreur(e.message) })
    return () => { actif = false }
  }, [personnage.identifiant, projet])

  const mouvements = useMemo(() => {
    const parPose = new Map<string, { nom: string; directions: { id: string; nom: string }[] }>()
    for (const case_ of lecture?.couverture.cases ?? []) {
      if (!parPose.has(case_.pose)) parPose.set(case_.pose, { nom: case_.nom_pose, directions: [] })
      const mouvement = parPose.get(case_.pose)!
      if (!mouvement.directions.some((d) => d.id === case_.direction)) {
        mouvement.directions.push({ id: case_.direction, nom: case_.nom_direction })
      }
    }
    return [...parPose].map(([id, mouvement]) => ({ id, ...mouvement }))
  }, [lecture])

  function demander(nature: "image" | "animation", pose: string, direction: string, quantite: number) {
    setBrouillon((ancien) => {
      if (!ancien) return ancien
      const sorties = ancien.sorties.filter((s) => !(s.nature === nature && s.pose === pose && s.direction === direction))
      if (quantite > 0) sorties.push({ nature, pose, direction, quantite })
      return { ...ancien, sorties }
    })
  }

  function regler(changements: Partial<ObjectifProduction>) {
    setBrouillon((ancien) => ancien ? { ...ancien, ...changements } : ancien)
  }

  async function enregistrer() {
    if (!brouillon) return
    setTravaille(true)
    setErreur("")
    try {
      const lu = await api.definirObjectifPersonnage(personnage.identifiant, brouillon, projet)
      setLecture(lu)
      setBrouillon(structuredClone(lu.objectif))
      setEdition(false)
      setMessage("Objectif enregistré. Les résultats existants restent disponibles.")
      onChange?.()
    } catch (e) { setErreur((e as Error).message) }
    finally { setTravaille(false) }
  }

  if (!lecture || !brouillon) return <section aria-label="Objectif du personnage">
    {erreur ? <p role="alert" className="text-echec">{erreur}</p> : <p role="status">Lecture de l’objectif…</p>}
  </section>

  const images = lecture.couverture.images
  const animations = lecture.couverture.animations
  const demande = brouillon.sorties.reduce((n, s) => n + s.quantite, 0)

  return <section aria-labelledby="objectif-titre" className="space-y-[22px]">
    <div className="flex items-start justify-between gap-[22px]">
      <div>
        <h2 id="objectif-titre" className="font-serif text-[25px] text-encre">Ce qu’il faut pour le jeu</h2>
        <p className="mt-[8px] text-[13px] text-encre-4">Choisissez les mouvements et les directions utiles. Une référence aide à fabriquer ; elle ne remplace pas une animation.</p>
      </div>
      {!edition && <button type="button" className={bouton} onClick={() => { setEdition(true); setMessage("") }}>Modifier l’objectif</button>}
    </div>

    <div className="flex flex-wrap gap-[14px]" aria-label="Couverture enregistrée">
      {[{ nom: "Animations", compte: animations }, { nom: "Images fixes", compte: images }].map(({ nom, compte }) =>
        <div key={nom} className="min-w-[128px] rounded-10 border border-contour bg-carte p-[14px]">
          <p className="text-[13px] text-encre-4">{nom}</p>
          <p className="mt-[8px] font-serif text-[25px] text-encre">{compte.demande ? `${compte.produit} / ${compte.demande} produites` : "Non demandées"}</p>
          {compte.demande > 0 && <p className="mt-[8px] text-[12px] text-encre-4">{compte.retenu} retenues pour le jeu · {compte.manquant} à produire</p>}
        </div>)}
    </div>

    {lecture.origine === "plan-existant" && !edition && <p className="text-[12px] text-encre-4">Ce personnage suit son plan de poses existant. Vous pouvez maintenant choisir seulement les sorties utiles.</p>}

    {!edition ? <div className="space-y-[8px]">
      {mouvements.filter((m) => lecture.couverture.cases.some((c) => c.pose === m.id && c.demande > 0)).map((m) =>
        <details key={m.id} className="rounded-10 border border-contour bg-carte p-[14px]" open>
          <summary className="cursor-pointer font-serif text-[25px] text-encre">{m.nom}</summary>
          <ul className="mt-[8px] space-y-[8px] text-[13px] text-encre-3">
            {lecture.couverture.cases.filter((c) => c.pose === m.id && c.demande > 0).map((c) => <li key={c.identifiant}>
              {c.nom_direction} · {c.nature === "animation" ? "Animation" : "Image fixe"} · {c.produit}/{c.demande} produites · {c.retenu} retenues
            </li>)}
          </ul>
        </details>)}
      {!demande && <p className="text-[13px] text-encre-4">Aucune sortie demandée pour le moment. Ses sources et ses résultats restent accessibles dans les autres onglets.</p>}
    </div> : <form onSubmit={(e) => { e.preventDefault(); void enregistrer() }} className="space-y-[22px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <button type="button" className={bouton} onClick={() => {
          const marche = mouvements.find((m) => m.id === "marche") ?? mouvements[0]
          if (marche) regler({ sorties: [{ nature: "animation", pose: marche.id, direction: marche.directions[0]?.id ?? "", quantite: 1 }] })
        }}>Commencer par une animation</button>
        <button type="button" className={bouton} onClick={() => regler({ sorties: [] })}>Ne rien demander</button>
        <span className="text-[12px] text-encre-4">{demande} sortie{demande > 1 ? "s" : ""} demandée{demande > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-[8px]">
        {mouvements.map((m) => <details key={m.id} open={brouillon.sorties.some((s) => s.pose === m.id)} className="rounded-10 border border-contour bg-carte p-[14px]">
          <summary className="cursor-pointer font-serif text-[25px] text-encre">{m.nom}</summary>
          <div className="mt-[8px] space-y-[8px]">
            {m.directions.map((direction) => {
              const animation = brouillon.sorties.some((s) => s.pose === m.id && s.direction === direction.id && s.nature === "animation")
              const nombre = brouillon.sorties.find((s) => s.pose === m.id && s.direction === direction.id && s.nature === "image")?.quantite ?? 0
              return <div key={direction.id} className="flex flex-wrap items-center gap-[22px] border-t border-contour pt-[8px]">
                <span className="w-[128px] text-[13px] text-encre">{direction.nom}</span>
                <label className="flex items-center gap-[8px] text-[13px] text-encre">
                  <input type="checkbox" checked={animation} onChange={(e) => demander("animation", m.id, direction.id, e.target.checked ? 1 : 0)} aria-label={`${m.nom} · ${direction.nom} · animation`} /> Animation
                </label>
                <label className="flex items-center gap-[8px] text-[13px] text-encre-4">Images fixes
                  <input type="number" className={`${champ} w-[70px]`} min={0} max={64} step={1} value={nombre} aria-label={`${m.nom} · ${direction.nom} · images fixes`} onChange={(e) => demander("image", m.id, direction.id, Number(e.target.value))} />
                </label>
              </div>
            })}
          </div>
        </details>)}
      </div>
      <fieldset className="rounded-10 border border-contour p-[14px]">
        <legend className="px-[8px] text-[13px] text-encre">Format attendu dans le jeu</legend>
        <div className="flex flex-wrap gap-[14px]">
          {(["largeur", "hauteur", "cadence"] as const).map((cle) => <label key={cle} className="flex flex-col gap-[8px] text-[12px] text-encre-4">
            {cle === "largeur" ? "Largeur (px)" : cle === "hauteur" ? "Hauteur (px)" : "Cadence (images/s)"}
            <input type="number" required className={`${champ} w-[128px]`} min={cle === "cadence" ? 0.1 : 1} max={cle === "cadence" ? 240 : 8192} step={cle === "cadence" ? 0.1 : 1} value={brouillon[cle]} onChange={(e) => regler({ [cle]: Number(e.target.value) })} />
          </label>)}
          <label className="flex items-center gap-[8px] text-[13px] text-encre"><input type="checkbox" checked={brouillon.boucle} onChange={(e) => regler({ boucle: e.target.checked })} /> Rejouer en boucle</label>
        </div>
        <div className="mt-[14px] flex flex-wrap items-end gap-[14px]">
          {(["x", "y"] as const).map((axe) => <label key={axe} className="flex flex-col gap-[8px] text-[12px] text-encre-4">Repère {axe.toUpperCase()} (px)
            <input type="number" required min={-8192} max={8192} step={0.5} className={`${champ} w-[128px]`} value={brouillon.repere[axe]} onChange={(e) => regler({ repere: { ...brouillon.repere, [axe]: Number(e.target.value) } })} />
          </label>)}
          <p className="max-w-[380px] text-[12px] text-encre-4">Le repère est le point placé à la position du personnage dans le jeu, souvent au sol entre ses pieds. Les coordonnées partent du coin supérieur gauche.</p>
        </div>
        <p className="mt-[14px] text-[12px] text-encre-4">Ces réglages décrivent les prochaines sorties. Les animations déjà fabriquées gardent leurs réglages jusqu’à leur modification.</p>
      </fieldset>
      <div className="flex gap-[8px]">
        <button type="submit" disabled={travaille} className={bouton}>{travaille ? "Enregistrement…" : "Enregistrer l’objectif"}</button>
        <button type="button" disabled={travaille} className={bouton} onClick={() => { setEdition(false); setBrouillon(structuredClone(lecture.objectif)); setErreur("") }}>Annuler</button>
      </div>
    </form>}
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {message && <p role="status" className="text-[13px] text-encre-3">{message}</p>}
  </section>
}
