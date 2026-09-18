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

  /** **Un mouvement de plus au plan du jeu** (RP13). La route existe depuis
   *  E9 (`api.ajouterPose`) — elle ne coûte rien et ne sert qu'à cette chose
   *  ; ce qui manquait était de la brancher ici, là où on regarde ce qu'il
   *  faut produire. On ne touche qu'à `lecture` : le brouillon en cours, avec
   *  ses cases déjà cochées, ne bouge pas. */
  async function ajouterMouvement(nom: string) {
    setErreur("")
    try {
      await api.ajouterPose(nom)
      setLecture(await api.objectifPersonnage(personnage.identifiant, projet))
      onChange?.()
    } catch (e) { setErreur((e as Error).message) }
  }

  /** **Retirer un mouvement de ce sujet, ou le lui rendre** (16 septembre
   *  2026), venu de l'ancien écran « Ses cases ». Ses images restent en
   *  bibliothèque ; le rendre les remet dans leurs cases. */
  const [ecartees, setEcartees] = useState<string[]>(personnage.ecartees ?? [])
  useEffect(() => { setEcartees(personnage.ecartees ?? []) }, [personnage.ecartees])
  async function tenir(pose: string, tenu: boolean) {
    setErreur("")
    const plan = (personnage.plan ?? []).map((p) => p.identifiant)
    const suivantes = plan.filter((id) => (id === pose ? tenu : !ecartees.includes(id)))
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, { poses: suivantes })
      setEcartees(rendu.personnage.ecartees ?? [])
      if (!tenu) setBrouillon((ancien) => ancien ? { ...ancien, sorties: ancien.sorties.filter((s) => s.pose !== pose) } : ancien)
      setLecture(await api.objectifPersonnage(personnage.identifiant, projet))
      onChange?.()
    } catch (e) { setErreur((e as Error).message) }
  }

  /** **Une direction de plus, pour tout le jeu** (RP13, E10). Déclarée depuis
   *  une rangée parce que c'est là qu'elle manque à l'œil, mais
   *  `api.ajouterDirection` vaut pour toutes les poses — une case vide paraît
   *  chez chacune. */
  async function ajouterDirection(nom: string) {
    setErreur("")
    try {
      await api.ajouterDirection(nom)
      setLecture(await api.objectifPersonnage(personnage.identifiant, projet))
      onChange?.()
    } catch (e) { setErreur((e as Error).message) }
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
        <h2 id="objectif-titre" className="font-serif text-[25px] text-encre">Ce qui doit exister dans le jeu</h2>
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
      <AjoutDeMouvement onAjouter={ajouterMouvement} />
      {ecartees.length > 0 && <div data-mouvements-retires className="flex flex-wrap items-center gap-[8px] text-[13px] text-encre-3">
        <span>Retirés de ce sujet :</span>
        {ecartees.map((id) => <button key={id} type="button" className={bouton} title="Le lui rendre" onClick={() => void tenir(id, true)}>{(personnage.plan ?? []).find((p) => p.identifiant === id)?.nom ?? id} · remettre</button>)}
      </div>}
      <div className="space-y-[8px]">
        {mouvements.map((m) => <details key={m.id} open={brouillon.sorties.some((s) => s.pose === m.id)} className="rounded-10 border border-contour bg-carte p-[14px]">
          <summary className="flex cursor-pointer items-center justify-between gap-[14px] font-serif text-[25px] text-encre"><span>{m.nom}</span><button type="button" className={bouton} aria-label={`Retirer le mouvement ${m.nom}`} onClick={(e) => { e.preventDefault(); void tenir(m.id, false) }}>Retirer ce mouvement</button></summary>
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
            <AjoutDeDirection mouvement={m.nom} onAjouter={ajouterDirection} />
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

/** **Un mouvement de plus** (RP13) : le champ crée en validant, comme
 *  l'attitude de la matrice (`EtabliDuSujet.tsx`, `AjoutDePose`) — sans
 *  formulaire, sans rien payer. */
function AjoutDeMouvement({ onAjouter }: { onAjouter: (nom: string) => void }) {
  const [nom, setNom] = useState("")
  const valider = () => {
    const propre = nom.trim()
    if (!propre) return
    onAjouter(propre)
    setNom("")
  }
  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); valider() } }}
        placeholder="un mouvement de plus…"
        aria-label="Ajouter un mouvement"
        className={`${champ} flex-1`}
      />
      <button type="button" className={bouton} onClick={valider}>Ajouter</button>
      <span className="text-[12px] text-encre-4">crée une rangée vide — rien n’est fabriqué</span>
    </div>
  )
}

/** **Une direction manquante, déclarée depuis la rangée où elle manque**
 *  (RP13) — mais `api.ajouterDirection` vaut pour tout le jeu : la case
 *  vide paraît chez chaque mouvement, pas seulement celui-ci. */
function AjoutDeDirection({ mouvement, onAjouter }: { mouvement: string; onAjouter: (nom: string) => void }) {
  const [nom, setNom] = useState("")
  const valider = () => {
    const propre = nom.trim()
    if (!propre) return
    onAjouter(propre)
    setNom("")
  }
  return (
    <div className="flex flex-wrap items-center gap-[8px] border-t border-contour pt-[8px]">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); valider() } }}
        placeholder="une direction manquante…"
        aria-label={`${mouvement} · ajouter une direction`}
        className={`${champ} flex-1`}
      />
      <button type="button" className={bouton} onClick={valider}>Ajouter</button>
      <span className="text-[12px] text-encre-4">vaut pour tout le jeu — rien n’est fabriqué</span>
    </div>
  )
}
