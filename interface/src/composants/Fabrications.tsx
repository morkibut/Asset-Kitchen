import { type Generation, type Personnage } from "../api"
import { SuiviDesTravaux } from "./FabricationSuivie"
import type { CibleCalque } from "../api-calques"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"

// **RV9 — une seule liste de fabrications.** Trois listes vivaient ici :
// « Créer et suivre les fabrications », « Les calculs locaux » et le journal
// des appels avec sa recherche. `SuiviDesTravaux` (`FabricationSuivie.tsx`)
// les porte maintenant toutes les trois, fusionnées et dédoublonnées ; cet
// écran ne fait plus que l'ouvrir, avec le seul bouton de départ qui reste.
//
// **RV11 — les méthodes locales n'ont qu'une place.** Cet écran portait sa
// propre gestion complète des workflows importés (`ProfilsWorkflow`, en
// double de Réglages › Moteurs & workflows) — deux pages pour gérer la même
// chose, l'une d'elles finissant forcément par diverger de l'autre. Il n'y a
// plus ici qu'un lien vers Réglages, déjà ouvert sur cet onglet.
export function Fabrications({ projet, chantier, clips, personnages, onCreer, onMethodesLocales, onGalerie, onClip, onBande, onSujet, onDepenses, onAsset, onToile, onSon, onCalqueEquipement }: {
  projet: string | null
  chantier: readonly Generation[]
  clips: readonly Generation[]
  personnages: readonly Personnage[]
  onCreer: () => void
  /** **RV11** : ouvre Réglages, déjà sur l'onglet « Moteurs & workflows » —
   *  la seule page qui gère les méthodes locales. */
  onMethodesLocales: () => void
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
    <p className="mt-[22px] text-[13px] text-encre-3">
      <button type="button" className="text-signal hover:opacity-70" onClick={onMethodesLocales}>Mes méthodes locales ›</button>
      {" "}— importer, vérifier ou choisir un workflow, dans Réglages.
    </p>
  </main>
}
