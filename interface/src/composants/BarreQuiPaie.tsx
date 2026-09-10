// La barre qui paie — **une seule dans tout le produit** (E2).
//
// **Elle vivait en clair dans `App.tsx`** (`D5`) : le repli des réglages de
// l'appel, la cible, les réinjections et le coût attendu y tenaient cent
// cinquante lignes au milieu de l'écran, invisibles au banc de
// `essais/essai_jetons.py`. Elle est désormais un fichier, comme la galerie
// l'est devenue en `C4`.
//
// Elle appartient au châssis, sert les deux lieux d'où l'argent part —
// l'établi d'une chose et le repos de l'onglet Créer —, et **elle se retire
// de tout écran incapable de dépenser**. C'est ce qui donne à la galerie son
// métier propre : on y juge, on n'y paie jamais.

import type {
  Asset,
  CompteReferences,
  Modele,
  Personnage,
  Pose,
  Reinjection,
  Reserve,
  Role,
  Univers,
} from "../api"
import { usePli } from "./pieces"
import { nomDuModele } from "./Fiche"
import { Cible, Reinjections } from "./Galerie"
import { ChampPrompt, type EnVol } from "./ChampPrompt"
import { CoutAttendu, PanneauReglages } from "./PanneauReglages"

export function BarreQuiPaie({
  modeles,
  modele,
  onChoisirModele,
  proportions,
  onProportions,
  variations,
  onVariations,
  options,
  onOptions,
  reinjections,
  grille,
  onRetirerReinjection,
  onRoleReinjection,
  projetNom,
  univers,
  echelle,
  onEchelle,
  compteReferences,
  cout,
  reserve,
  cases,
  personnageCible,
  posesCible,
  onRetirerPose,
  onDesarmer,
  ecarteesGeneration,
  onEcarterGeneration,
  onErreur,
  prompt,
  onPrompt,
  promptNegatif,
  onPromptNegatif,
  repris,
  onRendre,
  refus,
  ouAller,
  onAller,
  revers,
  provenance,
  onDefaireProvenance,
  onGenerer,
  enPaiement,
  echec,
  enVol,
}: {
  modeles: Modele[]
  modele: Modele | null
  onChoisirModele: (identifiant: string) => void
  proportions: string
  onProportions: (v: string) => void
  variations: number
  onVariations: (v: number) => void
  options: Record<string, string>
  onOptions: (o: Record<string, string>) => void
  reinjections: Reinjection[]
  grille: Asset[]
  onRetirerReinjection: (asset: string) => void
  onRoleReinjection: (asset: string, role: Role) => void
  /** Le projet ouvert, déjà réduit à son nom : c'est tout ce que le panneau
   *  des réglages en lit (US-2). */
  projetNom: string | null
  univers: Univers
  echelle: string
  onEchelle: (nom: string) => void
  compteReferences: CompteReferences | null
  /** Ce qu'une image du modèle choisi a coûté, en médiane (US-121). Calculé
   *  une fois ici, plutôt que deux fois — au panneau des réglages et au pied
   *  de la barre — pour la même raison que E2 l'a écrit : deux calculs à deux
   *  endroits ont un jour annoncé deux prix pour le même appel. */
  cout: number | null
  reserve: Reserve | null
  /** Combien de cases le lot armé demande, ou zéro pour une génération
   *  ordinaire (C2, US-129). */
  cases: number
  personnageCible: Personnage | null
  posesCible: Pose[]
  onRetirerPose: (pose: Pose) => void
  onDesarmer: () => void
  ecarteesGeneration: string[] | null
  onEcarterGeneration: (ecartees: string[] | null) => void
  onErreur: (raison: string) => void
  prompt: string
  onPrompt: (texte: string) => void
  promptNegatif: string
  onPromptNegatif: (v: string) => void
  repris: boolean
  onRendre: () => void
  refus: string | null
  ouAller?: string
  onAller?: () => void
  revers?: { texte: string; enCours: boolean; onReessayer: () => void } | null
  provenance: string | null
  onDefaireProvenance: () => void
  onGenerer: () => void
  enPaiement?: boolean
  echec?: string | null
  enVol?: EnVol | null
}) {
  // **Le repli des réglages de l'appel vit dans le registre du châssis** (E4,
  // A-25) : c'est le même besoin que le prompt négatif — « fermer le panneau
  // remet exactement où l'on était » (US-37) — et le registre est déjà
  // global, déjà remis à zéro par les essais, déjà abonné.
  const [reglagesOuverts, basculerReglages] = usePli("barre.reglages")

  return (
    <div className="flex shrink-0 flex-col">
      {/* **Les réglages de l'appel suivent la barre qui paie** (E4, A-25). Ils
          tenaient une colonne de 300 px ouverte en permanence dans la galerie,
          *même quand on n'y touchait pas* — et sur l'écran dont le métier est
          de juger. Ils se replient maintenant sur une ligne qui dit ce qu'ils
          valent, à côté du champ qui paie.

          **La colonne ne disparaît pas encore, elle se replie**, et la nuance
          est écrite en A-25 : les réglages hérités d'une chose du jeu arrivent
          en E12, l'écran de confirmation qui les montre avant de payer en E14.
          D'ici là, les retirer retirerait le seul endroit où l'on choisit un
          modèle. */}
      {reglagesOuverts && (
        <PanneauReglages
          modeles={modeles}
          choisi={modele}
          onChoisir={onChoisirModele}
          proportions={proportions}
          onProportions={onProportions}
          variations={variations}
          onVariations={onVariations}
          options={options}
          onOptions={onOptions}
          references={reinjections.length}
          projet={projetNom}
          univers={univers}
          echelle={echelle}
          onEchelle={onEchelle}
          compte={compteReferences}
          cout={cout}
          reserve={reserve}
          // Combien de cases le lot armé demande, ou zéro. Le panneau en tire
          // deux choses : ce que le lot coûte — **un appel, pas N** — et ce
          // qu'un compte faux coûterait.
          cases={cases}
          cible={personnageCible}
          ecarteesGeneration={ecarteesGeneration}
          onEcarterGeneration={onEcarterGeneration}
          onErreur={onErreur}
        />
      )}
      <Cible
        personnage={personnageCible}
        poses={posesCible}
        onRetirer={onRetirerPose}
        onDesarmer={onDesarmer}
      />
      <Reinjections
        reinjections={reinjections}
        grille={grille}
        onRetirer={onRetirerReinjection}
        onRole={onRoleReinjection}
      />
      {/* La ligne qui ouvre les réglages, et qui **dit ce qu'ils valent quand
          ils sont fermés** — c'est la règle du bloc repliable, appliquée au
          plus gros panneau du produit. */}
      <button
        type="button"
        onClick={basculerReglages}
        aria-expanded={reglagesOuverts}
        className="mesure flex h-[26px] shrink-0 items-center gap-2 border-b border-trait bg-carte px-4 text-left text-[10px] text-encre-4 hover:text-encre-3"
      >
        <span aria-hidden>{reglagesOuverts ? "−" : "+"}</span>
        <span>réglages de l'appel</span>
        <span className="text-encre-3">
          {modele ? nomDuModele(modele.identifiant) : "aucun modèle"} · {proportions} ·{" "}
          {variations} variation{variations > 1 ? "s" : ""}
        </span>
      </button>

      {/* **Ce que ça va coûter, au pied de ce qui paie** (E2). Le chiffre
          vivait dans la colonne de réglages de 300 px, qui n'existe que dans la
          galerie — et la galerie ne paie plus. Il suit donc la barre, parce que
          le prix se lit au moment où l'on décide, jamais deux écrans plus
          loin. */}
      <dl className="mesure grid grid-cols-[auto_1fr] gap-x-3 border-b border-trait bg-carte px-4 pt-3 text-[10px]">
        <CoutAttendu
          cout={cout}
          cases={cases}
          variations={variations}
          unite={modele?.unite}
          reserve={reserve}
        />
      </dl>
      <ChampPrompt
        prompt={prompt}
        onPrompt={onPrompt}
        promptNegatif={promptNegatif}
        onPromptNegatif={onPromptNegatif}
        repris={repris}
        /* Rendre la main : le champ redevient le sujet seul. **Il ne se vide
           pas** — on ne perd pas ce qui a été écrit —, et l'atelier reprend son
           habillage par-dessus. Reprendre, lui, s'est déplacé avec le texte
           assemblé : il vit dans l'écran de confirmation, sous ce qui part mot
           pour mot (E14). */
        onRendre={onRendre}
        refus={refus}
        ouAller={ouAller}
        onAller={onAller}
        revers={revers}
        provenance={
          provenance
            ? {
                texte: provenance,
                // **Se défaire ne change rien au réglage durable** : c'est le
                // texte de cet appel-ci qui s'efface, pas la consigne de la
                // pose ni le signalement de la chose.
                onDefaire: onDefaireProvenance,
              }
            : null
        }
        onGenerer={onGenerer}
        /* **Le raccourci porte le même verrou** (U1). Quand la série est
           sautée, ce bouton-ci paie sans passer par l'écran de confirmation :
           il doit donc dire qu'il paie et refuser le second clic exactement
           comme l'autre. */
        enPaiement={enPaiement}
        /* **Et le raccourci a besoin du même retour** : quand la série est
           sautée, il n'y a pas d'écran de confirmation où lire l'échec. */
        echec={echec}
        variations={variations}
        /* **Ce qui est parti se voit là où l'on a payé.** Le chantier ne
           paraissait que dans la grille de la galerie ; le codex et l'établi,
           d'où l'on paie aussi, ne montraient rien du tout. */
        enVol={enVol}
      />
    </div>
  )
}
