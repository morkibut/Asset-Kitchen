import { type Generation, type Personnage } from "../api"
import { SuiviDesTravaux } from "./FabricationSuivie"
import { ProfilsWorkflow } from "./WorkflowsLocaux"
import type { CibleCalque } from "../api-calques"
import type { TypeDeResultat } from "../fabrication"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"

// **RV9 — une seule liste de fabrications.** Trois listes vivaient ici :
// « Créer et suivre les fabrications », « Les calculs locaux » et le journal
// des appels avec sa recherche. `SuiviDesTravaux` (`FabricationSuivie.tsx`)
// les porte maintenant toutes les trois, fusionnées et dédoublonnées ; cet
// écran ne fait plus que l'ouvrir, avec le seul bouton de départ qui reste.
export function Fabrications({ projet, chantier, clips, personnages, onCreer, onPreparer, onGalerie, onClip, onBande, onSujet, onDepenses, onAsset, onToile, onSon, onCalqueEquipement }: {
  projet: string | null
  chantier: readonly Generation[]
  clips: readonly Generation[]
  personnages: readonly Personnage[]
  onCreer: () => void
  /** **Ouvrir la fenêtre unique de préparation sur un type** (RP4). Cet écran
   *  posait trois fenêtres de plus — l'image locale, la vidéo libre, le son ;
   *  il ne fait plus que dire par quel type on entre. */
  onPreparer: (type: TypeDeResultat, modele?: string, avecQuoi?: "catalogue" | "workflow") => void
  onGalerie: () => void
  onClip: (id: string) => void
  onBande?: (id: string) => void
  onSujet: (id: string) => void
  onDepenses: () => void
  onAsset?: (id: string) => void
  onToile?: (id: string) => void
  onSon?: (id: string) => void
  onCalqueEquipement?: (piece: string, emploi: string, cible: CibleCalque, variante?: string) => void
}) {
  return <main aria-label="Fabrications" className="defile min-h-0 flex-1 overflow-y-auto bg-papier p-[30px]">
    <header className="flex items-start justify-between gap-[22px]"><div><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Fabrications</h1><p className="mt-[8px] text-[14px] text-encre-3">Préparer une demande, suivre ce qui tourne et retrouver les résultats du jeu.</p></div><div className="flex shrink-0 gap-[8px]"><button className={BOUTON} onClick={onDepenses}>Consommation</button><button onClick={onCreer} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal hover:bg-echec">Nouvelle fabrication</button></div></header>
    <SuiviDesTravaux projet={projet} personnages={personnages} chantier={chantier} clips={clips} onClip={onClip} onBande={onBande} onGalerie={onGalerie} onSujet={onSujet} onCalqueEquipement={onCalqueEquipement} onAsset={onAsset} onToile={onToile} onSon={onSon} />
    <details className="mt-[22px] rounded-8 border border-trait bg-papier-cote p-[22px]"><summary className="cursor-pointer text-[14px]">Mes méthodes locales · importer, vérifier ou choisir un workflow</summary><div className="mt-[22px]"><ProfilsWorkflow onAudio={projet ? (modele) => onPreparer("son", modele) : undefined} onImage={projet ? (modele) => onPreparer("image", modele, "workflow") : undefined} onVideo={projet ? (modele) => onPreparer("clip", modele) : undefined} /></div></details>
  </main>
}
