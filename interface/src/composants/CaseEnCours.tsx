// **RV7** — la case de ce qui est parti, la même dans les rangées des images
// et dans celles des animations. Voir `retours.ts`.

import { NOM_DE_LA_PHASE, type Retour } from "../api-travaux"
import { tempsDuRetour } from "../retours"

/** **La case de ce qui est parti** (RV7) — remontée par le serveur
 *  (`atelier/services/retours.py`), jamais poussée par l'écran : elle survit
 *  donc à un rechargement. En cours, elle dit son étape et son temps ; finie,
 *  elle s'efface et la bande prend sa place ; ratée, elle dit pourquoi et
 *  propose « Relancer », qui rouvre la fenêtre remplie à l'identique — rien
 *  ne part sans le clic de cette fenêtre-là. */
export function CaseEnCours({ retour, maintenant, onRelancer, onReprendre }: {
  retour: Retour; maintenant: number; onRelancer?: () => void; onReprendre?: () => void
}) {
  if (retour.etat === "ratee")
    return (
      <span className="flex w-[81px] shrink-0 flex-col gap-[4px]" data-case-en-cours={retour.travail ?? retour.generation ?? ""} data-etat="ratee">
        <span title={retour.raison ?? undefined} className="flex h-[81px] w-[81px] flex-col items-center justify-center gap-[4px] rounded-7 border-2 border-dashed border-trait-echec bg-fond-echec px-[4px] text-center text-[10.5px] leading-[1.2] text-echec">
          <span className="font-medium">ratée</span>
          <span className="line-clamp-3">{retour.raison || "la fabrication n’a pas abouti"}</span>
        </span>
        <button type="button" onClick={onRelancer} disabled={!onRelancer}
          className="h-[22px] rounded-5 border border-trait bg-carte text-[10.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:opacity-50">
          Relancer
        </button>
      </span>
    )
  if (retour.etat === "interrompue")
    return (
      <span className="flex w-[81px] shrink-0 flex-col gap-[4px]" data-case-en-cours={retour.travail ?? ""} data-etat="interrompue">
        <span title={retour.raison ?? undefined} className="flex h-[81px] w-[81px] flex-col items-center justify-center gap-[4px] rounded-7 border-2 border-dashed border-trait-attention bg-fond-attention px-[4px] text-center text-[10.5px] leading-[1.2] text-encre-attention">
          <span className="font-medium">interrompue</span>
          <span className="line-clamp-3">{retour.raison || "le suivi s’est arrêté"}</span>
        </span>
        <button type="button" onClick={onReprendre} disabled={!onReprendre}
          className="h-[22px] rounded-5 border border-trait bg-carte text-[10.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:opacity-50">
          Reprendre
        </button>
      </span>
    )
  return (
    <span className="flex w-[81px] shrink-0 flex-col gap-[4px]" data-case-en-cours={retour.travail ?? retour.generation ?? ""} data-etat="en_cours">
      <span role="status" aria-label={`En cours : ${NOM_DE_LA_PHASE[retour.phase]}`}
        className="flex h-[81px] w-[81px] flex-col items-center justify-center gap-[4px] rounded-7 border-2 border-dashed border-signal bg-carte px-[4px] text-center text-[10.5px] leading-[1.2] text-encre-2">
        <span aria-hidden className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-[1.5px] border-encre-4 border-t-signal" />
        <span>{NOM_DE_LA_PHASE[retour.phase]}</span>
      </span>
      <span className="mesure text-center text-[10.5px] leading-none text-signal">{tempsDuRetour(retour.lance_le, retour.attendu_s, maintenant) || "en cours"}</span>
    </span>
  )
}
