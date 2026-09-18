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

import { api } from "../api"
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
import {
  NOM_MOTEUR_LOCAL,
  NOM_REFERENCE,
  ORDRE_MOTEURS_LOCAUX,
  type ModeleAvecReference,
  tempsParImage,
} from "../api-workflows"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { usePli } from "./pieces"
import { nomDuModele } from "./Fiche"
import { Cible, Reinjections } from "./Galerie"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { ChampPrompt, EnRoute, type EnVol } from "./ChampPrompt"
import { CoutAttendu, PanneauReglages } from "./PanneauReglages"

export function BarreQuiPaie({
  presentation = "barre",
  onChoisirReference,
  modeles,
  modele,
  onChoisirModele,
  proportions,
  onProportions,
  variations,
  onVariations,
  garderMiseEnPage = false,
  onGarderMiseEnPage,
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
  sautLaRelecture = false,
  enPaiement,
  echec,
  enVol,
  onOuvrirMoteurs,
}: {
  presentation?: "barre" | "preparation"
  onChoisirReference?: () => void
  modeles: Modele[]
  modele: Modele | null
  onChoisirModele: (identifiant: string) => void
  proportions: string
  onProportions: (v: string) => void
  variations: number
  onVariations: (v: number) => void
  /** **Refaire une planche** (RS2) : la case de la préparation d'une image
   *  fixe. Sans `onGarderMiseEnPage`, elle n'est pas montrée. */
  garderMiseEnPage?: boolean
  onGarderMiseEnPage?: (v: boolean) => void
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
  /** **La série en cours a été sautée** : ce bouton-ci paie directement, sans
   *  l'écran de relecture. Le guichet cesse alors de promettre une relecture
   *  qui n'aura pas lieu — le bouton, lui, ne change pas de nom : c'est le même
   *  geste, avec un écran de moins. */
  sautLaRelecture?: boolean
  enPaiement?: boolean
  echec?: string | null
  enVol?: EnVol | null
  /** Ouvrir *Réglages › Moteurs & workflows* (ML5) — pour installer un style
   *  local de plus sans quitter la préparation. Absent tant que l'écran
   *  appelant ne sait pas encore y mener : le lien ne paraît alors pas. */
  onOuvrirMoteurs?: () => void
}) {
  // **Le repli des réglages de l'appel vit dans le registre du châssis** (E4,
  // A-25) : c'est le même besoin que le prompt négatif — « fermer le panneau
  // remet exactement où l'on était » (US-37) — et le registre est déjà
  // global, déjà remis à zéro par les essais, déjà abonné.
  const [reglagesOuverts, basculerReglages] = usePli("barre.reglages")

  // La préparation reprend les mêmes états et le même chemin d’envoi. Elle
  // s’ouvre sur demande ; aucun formulaire ne prend la place de l’asset.
  if (presentation === "preparation") {
    const champ = "min-h-[34px] w-full rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"
    const reglerOption = (cle: string, valeur: string) => {
      const prochaines = { ...options }
      if (valeur === "") delete prochaines[cle]
      else prochaines[cle] = valeur
      onOptions(prochaines)
    }
    // **Les styles locaux, groupés sous leur moteur** (ML5, décision 9) : la
    // liste les mettait à plat, sous un seul nom déjà pris par leur
    // fournisseur commun — « ComfyUI · Z-Image Turbo · … » ne dit pas sous
    // quel moteur ranger la ligne suivante. Les modèles distants gardent leur
    // place, en tête ; les locaux suivent, un `optgroup` par moteur.
    const modelesDistants = modeles.filter((m) => !m.locale)
    const modelesLocaux = new Map<string, Modele[]>()
    for (const m of modeles) {
      if (!m.locale) continue
      const cle = (m as unknown as ModeleAvecReference).famille ?? "autre"
      modelesLocaux.set(cle, [...(modelesLocaux.get(cle) ?? []), m])
    }
    const infosModele = modele ? (modele as unknown as ModeleAvecReference) : null
    // **`force` n'existe que quand elle agit** (règle 8nonies) : un style qui
    // *garde le sujet* (Klein) ne la lit pas, et un style *partir de cette
    // image* ne l'applique qu'à l'image jointe qu'on lui donne — sans elle, il
    // n'y a rien pour le KSampler à doser. Le reste des réglages du modèle
    // passe tel quel.
    const forceUtile = !!(
      modele?.locale &&
      infosModele?.reference === "depart" &&
      reinjections.length > 0
    )
    return <div className="flex min-h-0 flex-1 flex-col text-[13px]">
      <div className="defile min-h-0 flex-1 space-y-[22px] overflow-y-auto px-[30px] py-[22px]">
      {/* **Ce qui part, et de quoi le corriger** — la bande « Pour » de la
          barre qui paie, montée ici sous le titre qui la nomme. L'écran disait
          déjà pour quelles cases l'appel partait ; il n'offrait ni le « × »
          d'une attitude ni le « tout retirer », si bien que corriger un lot
          demandait de fermer le guichet et de recocher les cases une à une.

          **Retirer une attitude n'est pas désarmer** : le premier geste laisse
          le lot armé avec ce qui reste dedans, le second éteint la cible
          entière. Deux gestes, deux boutons — et c'est la même règle que
          partout ailleurs, éteindre n'est pas vider. */}
      <Cible personnage={personnageCible} poses={posesCible} onRetirer={onRetirerPose} onDesarmer={onDesarmer} presentation="preparation" />
      <div className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px]">Références jointes</h2>{onChoisirReference && <button type="button" className="h-[34px] rounded-7 border border-contour bg-carte px-[14px]" onClick={onChoisirReference}>Choisir dans la bibliothèque</button>}</div>
      <section aria-label="Références jointes" className="rounded-7 border border-trait bg-carte p-[22px]">
        {reinjections.length === 0 ? <p className="text-encre-3">Aucune image jointe à la main. Les références de l’univers et du sujet seront visibles à la relecture.</p> : <div className="grid grid-cols-3 gap-[14px]">{reinjections.map(({ asset, role, origine }, i) => <ReferenceJointe key={asset} asset={asset} role={role} origine={origine ?? "asset"} rang={i + 1} connu={grille.find((a) => a.identifiant === asset)} champ={champ} onRole={onRoleReinjection} onRetirer={onRetirerReinjection} />)}</div>}
      </section>
      <section className="space-y-[8px]">
        <label className="block font-medium" htmlFor="preparation-image-prompt">{repris ? "Texte complet à envoyer" : "Ce que tu veux fabriquer"}</label>
        <textarea id="preparation-image-prompt" autoFocus rows={5} className={`${champ} resize-y leading-relaxed`} value={prompt} placeholder="Décris le sujet, son apparence et l’image attendue…" onChange={(e) => onPrompt(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !refus && !enPaiement) { e.preventDefault(); onGenerer() } }} />
        {provenance && <p className="text-encre-3">{provenance} <button type="button" className="text-signal" onClick={onDefaireProvenance}>Effacer ce texte</button></p>}
        {repris ? <p className="text-signal">Ce texte part mot pour mot. <button type="button" className="underline" onClick={onRendre}>Rétablir les consignes de l’univers</button></p> : <p className="text-encre-3">Le style du jeu et la cible complètent cette description. Tu pourras relire et modifier le texte complet avant l’envoi.</p>}
      </section>
      <section className="grid grid-cols-2 gap-[14px] rounded-7 border border-trait bg-carte p-[22px]">
        <label className="col-span-2 space-y-[8px]">
          <span className="block font-medium">{CHAMP_DU_MODELE}</span>
          <select className={champ} value={modele?.identifiant ?? ""} onChange={(e) => onChoisirModele(e.target.value)}>
            <option value="" disabled>Choisir un modèle</option>
            {modelesDistants.map((m) => <option key={m.identifiant} value={m.identifiant} disabled={!!m.refus}>{m.fournisseur} · {m.nom}{m.refus ? ` — ${m.refus}` : ""}</option>)}
            {ORDRE_MOTEURS_LOCAUX.filter((f) => modelesLocaux.has(f)).map((f) => (
              <optgroup key={f} label={NOM_MOTEUR_LOCAL[f]}>
                {(modelesLocaux.get(f) ?? []).map((m) => <option key={m.identifiant} value={m.identifiant} disabled={!!m.refus}>{m.nom}{m.refus ? ` — ${m.refus}` : ""}</option>)}
              </optgroup>
            ))}
          </select>
          {/* **Ce qu'un style local prend, et le temps qu'il annonce**
              (ML5, règles 8ter et 8nonies) : un temps, jamais un prix, et le
              genre de référence — sous la liste qui vient de le choisir, pas
              une infobulle qu'il faudrait rouvrir pour relire. */}
          {modele?.locale && (
            <p className="text-encre-3">
              {tempsParImage(infosModele?.temps) ?? "Durée non encore mesurée pour ce workflow."}
              {infosModele?.reference && ` · ${NOM_REFERENCE[infosModele.reference]}`}
            </p>
          )}
          {onOuvrirMoteurs && (
            <button type="button" className="text-signal underline" onClick={onOuvrirMoteurs}>
              Installer d’autres styles depuis Réglages › Moteurs &amp; workflows
            </button>
          )}
        </label>
        <label className="space-y-[8px]"><span className="block font-medium">Format de l’image</span><select className={champ} value={proportions} disabled={!modele} onChange={(e) => onProportions(e.target.value)}>{!modele?.proportions.includes(proportions) && <option value={proportions} disabled>{proportions} — indisponible</option>}{modele?.proportions.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="space-y-[8px]"><span className="block font-medium">Variations</span><input type="number" className={champ} min={1} max={modele?.variations_max ?? 1} step={1} disabled={!!cases || !modele} value={cases ? 1 : variations} onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onVariations(Math.max(1, Math.min(modele?.variations_max ?? 1, Math.floor(v)))) }} /></label>
        {cases > 0 && <p className="col-span-2 text-encre-3">{cases} cases réunies sur une planche · une génération pour la planche.</p>}
        {/* **Refaire une planche** (RS2). Montrée seulement pour une image fixe
            qui ne vise aucune case : un lot a déjà sa grille, et une planche
            refaite ne se range pas dans une seule case — l'atelier refuserait. */}
        {onGarderMiseEnPage && cases === 0 && posesCible.length === 0 && <label className="col-span-2 flex items-start gap-[8px]"><input type="checkbox" className="mt-[3px]" checked={garderMiseEnPage} onChange={(e) => onGarderMiseEnPage(e.target.checked)} /><span><span className="block font-medium">Garder la mise en page de la référence</span><span className="block text-encre-3">Refait la planche jointe avec ta modification, vue par vue.</span></span></label>}
        {modele && Object.entries(modele.options)
          // **`force` a sa propre section, plus bas, et seulement quand elle
          // agit** (règle 8nonies) — cette liste-ci ne la redit pas.
          .filter(([cle]) => cle !== "force")
          .map(([cle, option]) => <label key={cle} className="space-y-[8px]"><span className="block font-medium">{option.nom}</span>{option.genre === "choix" ? <select className={champ} value={options[cle] ?? ""} onChange={(e) => reglerOption(cle, e.target.value)}><option value="">Défaut du modèle</option>{option.valeurs.map((v) => <option key={v}>{v}</option>)}</select> : option.genre === "booleen" ? <select className={champ} value={options[cle] ?? ""} onChange={(e) => reglerOption(cle, e.target.value)}><option value="">Défaut du modèle</option><option value="false">Désactivé</option><option value="true">Activé</option></select> : <input type="number" className={champ} min={option.minimum ?? undefined} max={option.maximum ?? undefined} value={options[cle] ?? ""} placeholder="Réglage du modèle" onChange={(e) => reglerOption(cle, e.target.value)} />}</label>)}
        {/* **La force d'un style « partir de cette image »** (ML3, ML5, règle
            8nonies) : un réglage inerte disparaît, donc elle ne paraît que
            pour un style qui repeint par-dessus une image effectivement
            jointe. Nommée en clair — ce n'est le mot d'aucun modèle distant. */}
        {forceUtile && modele?.options.force && (
          <label className="col-span-2 space-y-[8px]">
            <span className="block font-medium">Force de la transformation</span>
            <input
              type="range"
              min={modele.options.force.minimum ?? 0}
              max={modele.options.force.maximum ?? 1}
              step={0.05}
              value={Number(options.force ?? 0.55)}
              onChange={(e) => reglerOption("force", e.target.value)}
              className="w-full"
            />
            <span className="block text-encre-3">
              {Number(options.force ?? 0.55).toFixed(2)} · faible reste proche de
              l’image jointe, forte s’en éloigne
            </span>
          </label>
        )}
      </section>
      {(!modele?.locale || infosModele?.negatif_lu !== false) && (
        <details className="rounded-7 border border-trait bg-carte p-[22px]"><summary className="cursor-pointer font-medium">Prompt négatif{promptNegatif ? " · renseigné" : " · facultatif"}</summary><textarea aria-label="Prompt négatif" rows={2} className={`${champ} mt-[14px]`} value={promptNegatif} onChange={(e) => onPromptNegatif(e.target.value)} placeholder="Ce qui doit être évité…" /></details>
      )}
      <details className="rounded-7 border border-trait bg-carte p-[22px]"><summary className="cursor-pointer font-medium">Réglages de l’univers et références héritées</summary><div className="mt-[14px]"><PanneauReglages modeles={modeles} choisi={modele} onChoisir={onChoisirModele} proportions={proportions} onProportions={onProportions} variations={variations} onVariations={onVariations} options={options} onOptions={onOptions} references={reinjections.length} projet={projetNom} univers={univers} echelle={echelle} onEchelle={onEchelle} compte={compteReferences} cout={cout} reserve={reserve} cases={cases} cible={personnageCible} ecarteesGeneration={ecarteesGeneration} onEcarterGeneration={onEcarterGeneration} onErreur={onErreur} /></div></details>
      </div>
      <footer className="shrink-0 space-y-[14px] border-t border-trait bg-carte px-[30px] py-[14px]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-[8px]"><CoutAttendu cout={cout} cases={cases} variations={variations} unite={modele?.unite} reserve={reserve} modele={modele} /></dl>
        {echec && <p role="alert" className="text-echec">{echec}</p>}
        {revers && <p className="text-encre-3">{revers.texte} <button type="button" className="text-signal" disabled={revers.enCours} onClick={revers.onReessayer}>Réessayer</button></p>}
        <div className="flex items-center justify-between gap-[22px]">
          <p className="text-encre-3">{refus ?? (sautLaRelecture ? "Cette série saute la relecture : le bouton paie directement." : "Tu reliras les textes, les images jointes et le coût avant de lancer.")}{refus && onAller && ouAller && <> <button type="button" className="text-signal" onClick={onAller}>{ouAller}</button></>}</p>
          <div className="flex shrink-0 flex-col items-end gap-[4px]">
            {/* **Tant que quelque chose est en route, l'état prend la place du
                bouton**, et c'est l'inversion qui répare le défaut du 31 août
                2026 : un bouton qui revient identique, plein, disponible, dit
                « il ne s'est rien passé » plus fort que n'importe quelle ligne
                d'en dessous ne dit le contraire. La chose qu'on recliquerait
                devient donc la chose qui dit que ça marche — mêmes 34 px, le
                compte, le temps écoulé et la jauge. Voir `EnRoute`, dans
                `ChampPrompt.tsx`. */}
            {enVol && enVol.images > 0 ? (
              <EnRoute {...enVol} />
            ) : (
              <button type="button" disabled={!!refus || !!enPaiement} onClick={onGenerer} className="h-[42px] shrink-0 rounded-7 bg-signal px-[22px] text-encre-sur-signal disabled:opacity-50">{enPaiement ? "Envoi en cours…" : VERS_LA_RELECTURE}</button>
            )}
            {/* La fente, **jamais deux locataires à la fois**. Le geste ne
                disparaît pas pendant qu'un lot est en route — lancer une
                seconde série sans attendre la première est permis, et reste un
                geste de l'auteur : rien ne se relance tout seul. Il cesse
                seulement d'être ce qui saute aux yeux.

                **Et le refus l'emporte** : quand rien ne peut partir, un lien
                *Générer encore* mentirait sur le geste disponible — la raison
                est déjà écrite à gauche, avec son geste. Le bloc au-dessus, lui,
                continue de dire ce qui est en route : c'est un fait, pas une
                promesse, et les deux ne se disputent pas la même place. */}
            {refus || echec ? null : enVol && enVol.images > 0 ? (
              <button type="button" disabled={!!enPaiement} onClick={onGenerer} className="mesure text-[10px] text-signal hover:opacity-70 disabled:cursor-not-allowed disabled:text-encre-4">{enPaiement ? "envoi en cours…" : "Générer encore ›"}</button>
            ) : (
              <p className="mesure text-[10px] text-encre-4">Ctrl + Entrée</p>
            )}
          </div>
        </div>
      </footer>
    </div>
  }

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
        <span>réglages de la génération</span>
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
          modele={modele}
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

/** Une image jointe à la main, dans le guichet.
 *
 *  **Deux choses lui reviennent de la bande « Repart avec »**, et elles avaient
 *  été perdues en passant de la barre à l'écran :
 *
 *  - **l'adresse de la vignette, pas le fichier entier.** Corrigé une première
 *    fois le 31 août 2026 en même temps que la grille : un cadre de 128 px ne
 *    demande pas deux mégaoctets, et le cran de la grille au repos est déjà
 *    dans le cache du navigateur — la section ne coûte alors rien ;
 *  - **la visée de la barre d'espace.** Ce que le pointeur vise reste le
 *    fichier entier : ouvrir une référence en grand est exactement le geste de
 *    compter ses pixels avant de l'envoyer.
 *
 *  Un asset que la grille ne connaît pas — joint depuis un autre jeu, ou pas
 *  encore relu — garde son fichier comme image et n'a rien à viser. */
/** Une image jointe à la main, et **elle vient de deux familles depuis `RP9`**.
 *
 *  Une carte de la toile n'est pas un asset : son image se sert par la route du
 *  tableau, et **elle ne se met pas en source d'édition** — la bibliothèque ne
 *  connaît pas les cartes, donc la filiation qui descendrait d'elle n'aurait
 *  nulle part où s'écrire. Le rôle n'est pas grisé, il n'est pas proposé :
 *  *ne pas proposer ce qu'on refusera*. */
function ReferenceJointe({ asset, role, origine, rang, connu, champ, onRole, onRetirer }: {
  asset: string
  role: Role
  origine: "asset" | "carte"
  rang: number
  connu: Asset | undefined
  champ: string
  onRole: (asset: string, role: Role) => void
  onRetirer: (asset: string) => void
}) {
  const visee = useVisee(connu ? sujetAsset(connu) : null)
  const carte = origine === "carte"
  return (
    <figure className="min-w-0 space-y-[8px]" onPointerEnter={visee.entrer} onPointerLeave={visee.sortir}>
      <img src={carte ? api.imageCarte(asset, "") : connu ? vignetteAsset(connu, 256) : api.fichier(asset)} alt={`Référence ${rang}`} className="damier-papier h-[128px] w-full rounded-7 object-contain" />
      <select aria-label={`Rôle de la référence ${rang}`} className={champ} value={role} onChange={(e) => onRole(asset, e.target.value as Role)}><option value="reference">Référence visuelle</option>{!carte && <option value="edition">Image à modifier</option>}<option value="style">Guide de style</option></select>
      <button type="button" className="text-encre-3 hover:text-echec" onClick={() => onRetirer(asset)}>Retirer la référence {rang}</button>
    </figure>
  )
}
