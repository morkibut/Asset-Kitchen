import { useRef, useState } from "react"
import { FAMILLES_AVEC_LUFS, sons, type FamilleSon, type MesuresSon, type RecetteSon, type Son } from "../api-sons"

const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]"
const virgule = (n: number, d = 2) => n.toFixed(d).replace(".", ",")

function Curseur({ nom, valeur, min, max, step = 1, disabled, onChange }: { nom: string; valeur: number; min: number; max: number; step?: number; disabled?: boolean; onChange: (n: number) => void }) {
  return <div className="flex flex-col gap-[8px] text-[13px]">
    <span>{nom}</span>
    <span className="flex gap-[8px]">
      <input type="range" className="min-w-0 flex-1" aria-label={`${nom} · curseur`} min={min} max={max} step={step} value={valeur} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />
      <input type="number" aria-label={nom} className={`${CHAMP} w-[128px]`} min={min} max={max} step={step} value={valeur} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />
    </span>
  </div>
}

/** Les fondus de 5 ms que pose l’atelier par défaut ne comptent pas comme un réglage. */
const FONDU_PAR_DEFAUT = 5
const fonduRegle = (ms: number) => ms !== FONDU_PAR_DEFAUT

function resumeCoupe(r: RecetteSon, duree: number) {
  const aucune = r.debut < 0.005 && (r.fin == null || r.fin > duree - 0.005) && !fonduRegle(r.fondu_entree_ms) && !fonduRegle(r.fondu_sortie_ms) && !r.rogner_silence
  if (aucune) return "aucune"
  return `${virgule(r.debut, 2)} → ${r.fin != null ? virgule(r.fin, 2) : virgule(duree, 2)} s`
}
function resumeBoucle(r: RecetteSon, duree: number) {
  if (!r.boucle) return "non"
  return `${virgule(r.boucle_debut, 1)} → ${virgule(r.boucle_fin ?? duree, 1)} s`
}
function resumeNiveau(r: RecetteSon, avecLufs: boolean) {
  const parts = [r.mono ? "mono" : null, avecLufs && r.cible_lufs != null ? `${r.cible_lufs} LUFS` : null, r.gain_db ? `gain ${r.gain_db > 0 ? "+" : ""}${r.gain_db} dB` : null]
  const texte = parts.filter(Boolean).join(" · ")
  return texte || "aucun"
}

/** Les réglages d'un son, en trois blocs repliés (maquette 03-son) : coupe et
 *  fondus, boucle (avec « Écouter le raccord »), niveau. Un bloc qui contient
 *  déjà un réglage non par défaut s'ouvre seul ; les autres restent repliés. */
export function ReglagesSon({ son, recette, mesures, famille, occupe, onChange }: {
  son: Son; recette: RecetteSon; mesures: MesuresSon | null; famille: FamilleSon | null; occupe?: boolean
  onChange: <K extends keyof RecetteSon>(cle: K, valeur: RecetteSon[K]) => void
}) {
  const duree = son.source.mesures?.duree ?? 0
  const dureeRendue = son.mesures?.duree ?? 0
  const avecLufs = famille != null && FAMILLES_AVEC_LUFS.includes(famille)
  const lecteurRaccord = useRef<HTMLAudioElement>(null)
  const [raccordJoue, setRaccordJoue] = useState(false)
  const verdict = mesures?.boucle?.active ? mesures.boucle.verdict : null

  const coupeOuverte = recette.debut > 0 || recette.fin != null || fonduRegle(recette.fondu_entree_ms) || fonduRegle(recette.fondu_sortie_ms) || recette.rogner_silence
  const niveauOuvert = recette.mono || recette.cible_lufs != null || !!recette.hauteur_demi_tons || !!recette.gain_db || recette.normaliser

  const basculerRaccord = () => {
    const a = lecteurRaccord.current
    if (!a) return
    if (raccordJoue) { a.pause(); setRaccordJoue(false) } else { void a.play(); setRaccordJoue(true) }
  }

  return <div className="space-y-[8px]">
    <details className="rounded-7 border border-trait p-[8px]" open={coupeOuverte}>
      <summary className="flex cursor-pointer justify-between gap-[14px] text-[13.5px]"><span>Coupe et fondus</span><span className="text-encre-3">{resumeCoupe(recette, duree)}</span></summary>
      <div className="mt-[8px] space-y-[8px] pl-[14px]">
        <Curseur nom="Début de coupe (s)" valeur={recette.debut} min={0} max={duree} step={0.001} disabled={occupe} onChange={v => onChange("debut", v)} />
        <Curseur nom="Fin de coupe (s)" valeur={recette.fin ?? duree} min={0} max={duree} step={0.001} disabled={occupe} onChange={v => onChange("fin", v)} />
        <label className="block text-[13px]"><input type="checkbox" checked={recette.rogner_silence} disabled={occupe} onChange={e => onChange("rogner_silence", e.target.checked)} /> Rogner le silence aux extrémités</label>
        <Curseur nom="Fondu d’entrée (ms)" valeur={recette.fondu_entree_ms} min={0} max={Math.max(1000, duree * 1000)} disabled={occupe} onChange={v => onChange("fondu_entree_ms", v)} />
        <Curseur nom="Fondu de sortie (ms)" valeur={recette.fondu_sortie_ms} min={0} max={Math.max(1000, duree * 1000)} disabled={occupe} onChange={v => onChange("fondu_sortie_ms", v)} />
      </div>
    </details>

    <details className="rounded-7 border border-trait p-[8px]" open={recette.boucle}>
      <summary className="flex cursor-pointer justify-between gap-[14px] text-[13.5px]"><span>Boucle</span><span className="text-encre-3">{resumeBoucle(recette, dureeRendue)}</span></summary>
      <div className="mt-[8px] space-y-[8px] pl-[14px]">
        <label className="block text-[13px]"><input type="checkbox" checked={recette.boucle} disabled={occupe} onChange={e => onChange("boucle", e.target.checked)} /> Jouer en boucle</label>
        {recette.boucle && <>
          <Curseur nom="Début de boucle (s)" valeur={recette.boucle_debut} min={0} max={dureeRendue} step={0.001} disabled={occupe} onChange={v => onChange("boucle_debut", v)} />
          <Curseur nom="Fin de boucle (s)" valeur={recette.boucle_fin ?? dureeRendue} min={0} max={dureeRendue} step={0.001} disabled={occupe} onChange={v => onChange("boucle_fin", v)} />
          <label className="block text-[13px]"><input type="checkbox" checked={recette.boucle_zero} disabled={occupe} onChange={e => onChange("boucle_zero", e.target.checked)} /> Recaler les repères sur un passage par zéro</label>
          <Curseur nom="Fondu enchaîné (ms)" valeur={recette.boucle_fondu_ms} min={0} max={2000} step={5} disabled={occupe} onChange={v => onChange("boucle_fondu_ms", v)} />
          <div className="flex items-center gap-[8px] text-[13px]">
            <span className={verdict === "le raccord claque" ? "text-echec" : "text-encre-ok"}>{verdict ?? "Conservez une version pour mesurer le raccord."}</span>
          </div>
          <audio ref={lecteurRaccord} loop preload="none" src={sons.raccord(son)} onEnded={() => setRaccordJoue(false)} />
          <button type="button" className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12.5px]" disabled={occupe || !mesures?.boucle?.active} onClick={basculerRaccord}>
            {raccordJoue ? "■ Arrêter" : "▶ Écouter le raccord"}
          </button>
        </>}
      </div>
    </details>

    <details className="rounded-7 border border-trait p-[8px]" open={niveauOuvert}>
      <summary className="flex cursor-pointer justify-between gap-[14px] text-[13.5px]"><span>Niveau</span><span className="text-encre-3">{resumeNiveau(recette, avecLufs)}</span></summary>
      <div className="mt-[8px] space-y-[8px] pl-[14px]">
        <label className="block text-[13px]"><input type="checkbox" checked={recette.mono} disabled={occupe} onChange={e => onChange("mono", e.target.checked)} /> En mono</label>
        {avecLufs
          ? <Curseur nom="Niveau visé (LUFS)" valeur={recette.cible_lufs ?? -18} min={-40} max={-6} step={0.5} disabled={occupe} onChange={v => onChange("cible_lufs", v)} />
          : <>
              <label className="block text-[13px]"><input type="checkbox" checked={recette.normaliser} disabled={occupe} onChange={e => onChange("normaliser", e.target.checked)} /> Normaliser le niveau</label>
              {recette.normaliser && <Curseur nom="Crête cible (dBFS)" valeur={recette.cible_db} min={-60} max={0} step={0.1} disabled={occupe} onChange={v => onChange("cible_db", v)} />}
            </>}
        <Curseur nom="Hauteur (demi-tons)" valeur={recette.hauteur_demi_tons} min={-24} max={24} step={0.5} disabled={occupe} onChange={v => onChange("hauteur_demi_tons", v)} />
        <Curseur nom="Gain (dB)" valeur={recette.gain_db} min={-60} max={24} step={0.1} disabled={occupe} onChange={v => onChange("gain_db", v)} />
      </div>
    </details>
  </div>
}
