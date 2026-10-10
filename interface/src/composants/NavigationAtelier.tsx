import type { ReactNode } from "react"

/** Les six destinations de la maquette validée. Les familles et collections
 * appartiennent à la bibliothèque ; elles ne deviennent pas des lieux globaux. */
export type DestinationAtelier = "jeu" | "univers" | "assets" | "galerie" | "fabrications" | "livraison" | "reglages"

const PORTES: { cle: DestinationAtelier; nom: string; court: string }[] = [
  { cle: "jeu", nom: "Le jeu", court: "Jeu" },
  { cle: "univers", nom: "Univers & toile", court: "Toile" },
  { cle: "assets", nom: "Codex", court: "Codex" },
  { cle: "galerie", nom: "Galerie", court: "Galerie" },
  { cle: "fabrications", nom: "Fabrications", court: "File" },
  { cle: "livraison", nom: "Livrer au jeu", court: "Livrer" },
]

export function NavigationAtelier({ jeu, descriptionJeu, actif, travauxEnCours = 0, brouillons = 0, replie, onReplier,
  onAller, onChangerJeu, onGuide, onRecherche, onBrouillons, etatAtelier, suivi }: {
  jeu: string; descriptionJeu?: string; actif: DestinationAtelier | null
  /** **Toutes les fabrications encore en cours** (`RP16`) — les emplacements
   *  d'images de la galerie *et* les travaux du serveur, toutes familles
   *  confondues : animations, équipements, images locales, vidéos libres, 3D,
   *  sons. Il ne comptait que la première. */
  travauxEnCours?: number
  /** Ce qui a été commencé sans être enregistré ni envoyé (`RP16`). */
  brouillons?: number
  replie: boolean; onReplier: (replie: boolean) => void
  onAller: (destination: DestinationAtelier) => void; onChangerJeu: () => void
  onGuide: () => void; onRecherche: () => void; onBrouillons?: () => void; etatAtelier?: ReactNode
  /** Ce qui tourne et ce qui est arrivé (`SuiviDuCarnet.tsx`) — posé en tête
   *  du pied, au-dessus des brouillons : ce n'est pas une porte non plus. */
  suivi?: ReactNode
}) {
  const ligne = "flex min-h-[34px] w-full items-center rounded-7 px-[14px] py-[4px] text-left text-[14px] transition-colors duration-120 hover:bg-papier"
  return <aside aria-label="Navigation du jeu" data-navigation-atelier className={`flex h-full min-h-0 shrink-0 flex-col overflow-y-auto border-r border-trait bg-papier-cote ${replie ? 'w-navigation-repliee gap-[8px] p-[8px]' : 'w-navigation-atelier gap-[14px] p-[14px]'}`}>
    <div className={`flex items-center gap-[8px] ${replie ? 'justify-center' : 'justify-between'}`}>
      {!replie && <span className="whitespace-nowrap font-serif text-[25px]">Asset Kitchen</span>}
      <button type="button" className="flex h-[34px] w-[30px] shrink-0 items-center justify-center rounded-7 border border-contour bg-carte text-[14px] hover:border-encre-3" onClick={() => onReplier(!replie)} aria-label={replie ? 'Déplier la navigation' : 'Replier la navigation'} aria-expanded={!replie} title={replie ? 'Déplier la navigation' : 'Replier la navigation'}>{replie ? '☰' : '‹'}</button>
    </div>
    {!replie && <div className="border-y border-trait py-[8px]">
      <div className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3">Le jeu ouvert</div>
      <button type="button" title="Changer de jeu" aria-label={`Changer de jeu · ${jeu}`} onClick={onChangerJeu} className="my-[4px] block w-full text-left font-serif text-[25px] leading-tight text-encre hover:text-signal"><span className="block truncate">{jeu}</span></button>
      {descriptionJeu && <p className="text-[12px] text-encre-3">{descriptionJeu}</p>}
    </div>}
    <nav aria-label="Atelier" className="flex flex-col gap-[4px]">{PORTES.map(p => <button key={p.cle} type="button" onClick={() => onAller(p.cle)} aria-current={actif === p.cle ? 'page' : undefined} aria-label={p.nom} title={replie ? p.nom : undefined}
      className={`${ligne} ${actif === p.cle ? 'bg-ligne-ouverte text-encre' : 'text-encre-controle'} ${replie ? 'justify-center px-[4px] text-[11px]' : ''}`}>
      <span>{replie ? p.court : p.nom}</span>{p.cle === 'fabrications' && travauxEnCours > 0 && <span className={`mesure text-[11px] text-encre-3 ${replie ? 'ml-[4px]' : 'ml-auto'}`} aria-label={`${travauxEnCours} fabrication${travauxEnCours > 1 ? 's' : ''} en cours`}>{travauxEnCours}</span>}
    </button>)}</nav>
    <nav aria-label="Préférences" className="flex flex-col gap-[4px] border-t border-trait pt-[14px]">
      <button type="button" onClick={() => onAller('reglages')} aria-current={actif === 'reglages' ? 'page' : undefined} aria-label="Réglages" title={replie ? 'Réglages' : undefined} className={`${ligne} ${actif === 'reglages' ? 'bg-ligne-ouverte' : ''} ${replie ? 'justify-center px-[4px] text-[11px]' : ''}`}>{replie ? 'Régl.' : 'Réglages'}</button>
      <button type="button" onClick={onGuide} aria-label="Guide" title={replie ? 'Guide' : undefined} className={`${ligne} ${replie ? 'justify-center px-[4px] text-[11px]' : ''}`}>{replie ? '?' : 'Guide'}</button>
    </nav>
    {/* **Le pied de la colonne** — c'est là que la maquette pose le tiroir des
        brouillons, et ce n'est pas une neuvième porte : la liste fermée des
        huit portes (`docs/vocabulaire.html`) reste celle des deux `nav`
        ci-dessus. Aucune couleur d'alerte, aucun rappel : un brouillon attend,
        il ne réclame pas (E2). */}
    <div className="mt-auto border-t border-trait pt-[14px]">
      {suivi}
      {onBrouillons && <button type="button" onClick={onBrouillons} title="Brouillons à reprendre" aria-label={`Brouillons à reprendre · ${brouillons}`} className={`${ligne} ${replie ? 'justify-center px-[4px] text-[11px]' : 'text-[12px]'}`}>
        <span>{replie ? `Brou. ${brouillons}` : `Brouillons · ${brouillons}`}</span>
      </button>}
      {!replie && onBrouillons && <p className="px-[14px] text-[12px] text-encre-3">Conservés dans ce navigateur.</p>}
      <button type="button" onClick={onRecherche} title="Rechercher ou lancer un geste · Ctrl K" aria-label="Rechercher ou lancer un geste" className={`${ligne} ${replie ? 'justify-center px-[4px] text-[11px]' : 'justify-between text-[12px]'}`}><span>{replie ? '⌕' : 'Rechercher un geste'}</span>{!replie && <kbd className="mesure text-[11px] text-encre-3">Ctrl K</kbd>}</button>
      {!replie && etatAtelier && <div role="status" className="mt-[8px] text-[12px] text-encre-3">{etatAtelier}</div>}
    </div>
  </aside>
}
