// Ce qui part — le dernier écran avant que l'argent parte (E14).
//
// **Demander une image coûte de l'argent à chaque fois, et l'image qui revient
// n'est jamais deux fois la même** : on ne peut donc pas rejouer un appel raté
// sans le repayer. Cet écran-ci est là pour qu'on relise, une dernière fois, ce
// qui va vraiment partir — et pour qu'on puisse encore le changer.
//
// **Il ne montre pas un résumé.** Le texte exact, mot pour mot, et chaque image
// jointe, chacun sur sa ligne, avec un interrupteur. Ce qui est éteint ne part
// pas. Ce qu'on corrige ici **ne vaut que pour cet appel** et ne remonte nulle
// part : le réglage durable se fait sur la fiche de la chose, dans l'ambiance ou
// dans l'assistant, et garder une correction est un second geste, écrit.
//
// **L'invariant a été amendé le 1ᵉʳ septembre 2026 (U9), et il l'est aux trois
// endroits où il vit** — ici, dans `docs/carte-du-depot.md` et dans
// `docs/archive/maquettes-v2.1/08bis-ecran-de-confirmation.html`. Corrigé à un seul, il
// serait devenu une contradiction. Il disait *sans coupure et sans résumé*, et
// la séance a montré la limite : le texte réellement employé dans ce dépôt fait
// plus de mille deux cents caractères, et un écran qu'on doit parcourir d'un
// coup d'œil avant de payer ne le fait pas quand une seule ligne l'occupe tout
// entier. Ce qui le remplace est plus fort que lui : **rien n'est résumé, rien
// n'est réécrit, et tout est atteignable en un clic depuis l'endroit où on le
// lit.** Un long texte se replie, le bouton du pli dit combien de caractères il
// cache, et le déplier rend le texte entier — ce n'est pas une troncature
// muette, c'est un pli qu'on ouvre. Et chaque image jointe porte **sa
// vignette** : la barre d'espace l'ouvre en grand, du même geste que partout
// ailleurs dans le produit.
//
// **Ce qui l'a fait basculer d'un dépliant à un écran est une mesure.** Sur le
// plus long appel payé du dépôt, le style pèse 890 caractères sur 1 690 et le
// sujet 40 — 53 % contre 2 %. Un bloc replié qui résume 53 % de ce qui part
// n'est pas un résumé, c'est un angle mort.
//
// **Aucun glyphe neuf, aucune largeur neuve.** L'interrupteur est le carré plein
// et le carré creux que le produit emploie déjà dans la barre des tables et dans
// le codex, où ils disent « cette place est prise » et « cette place est vide ».
// Ici ils disent « cette chose part » et « cette chose ne part pas ». Le sens est
// le même : une place occupée ou non.

import { useEffect, useRef, useState } from "react"
import {
  dollars,
  estArgent,
  prix,
  quantite,
  type Envoi,
  type ImageQuiPart,
  type LigneQuiPart,
  type OptionQuiPart,
  type PlancheQuiPart,
  type Tri,
} from "../api"
import type { EnvoiAvecLocal } from "../api-workflows"
import { Bouton, Libelle, LigneReserve, Raison } from "./pieces"
import { sujetAsset, sujetCarte, useVisee, vignetteAsset } from "./Apercu"
import { RelireAvantEnvoi, type ResumeDeLEnvoi } from "./Relecture"

/** Le tri de départ — **rien**. Il ne porte que des écarts, jamais un état
 *  complet : c'est ce qui fait qu'éteindre les trois lignes d'une ambiance
 *  rallume les textes du jeu d'eux-mêmes. */
export { TRI_VIDE } from "../envoi"

/** Le nom français d'un groupe de lignes.
 *
 *  **Deux manquaient** — `jointes` et `cadrage`, rendus depuis le
 *  1ᵉʳ septembre 2026 : leurs sections s'affichaient sans titre, et personne ne
 *  l'avait vu parce que le titre absent ne laisse pas de trou, il laisse un
 *  blanc. Trouvé en construisant R7, en cherchant où poser les parties. */
const NOM_DU_GROUPE: Record<string, string> = {
  jeu: "les textes du jeu",
  ambiance: "son ambiance",
  sujet: "le sujet",
  planche: "la planche",
  jointes: "ce que les images disent",
  cadrage: "la caméra",
}

/** Les groupes de chaque partie, **dans l'ordre où le texte les assemble** (R7).
 *
 *  C'est la table `DE_LA_PARTIE` du domaine, lue à l'envers : là-bas un groupe
 *  dit sa partie, ici une partie dit ses groupes. Elle est recopiée plutôt
 *  qu'appelée parce que l'écran n'a pas de serveur sous la main pour dessiner
 *  ses sections — et chaque ligne rendue porte, elle, la partie que le serveur
 *  lui a donnée : si les deux divergeaient, une section resterait vide et ça se
 *  verrait au premier coup d'œil. */
const GROUPES_DE_LA_PARTIE: Record<string, readonly string[]> = {
  contexte: ["jeu", "ambiance"],
  references: ["jointes"],
  demande: ["sujet", "planche", "cadrage"],
}

export function EcranEnvoi({
  presentation = "historique",
  reglages,
  actualisation = false,
  envoi,
  tri,
  onTri,
  onImage,
  onPayer,
  enPaiement = false,
  echec = null,
  onFermer,
  onGarder,
  onSauter,
  onReprendre,
  refus,
  plancheJointe,
  onAjouterUneReference,
}: {
  presentation?: "historique" | "atelier"
  actualisation?: boolean
  reglages?: { proportions: string; variations: number; options: Record<string, string> }
  /** Ce que le serveur rend, `null` tant qu'il n'a pas répondu. L'écran dit
   *  alors qu'il ne sait pas encore, jamais un texte deviné. */
  envoi: Envoi | null
  tri: Tri
  onTri: (tri: Tri) => void
  /** **Une image se décoche par la portée de cette génération-là**, pas par le
   *  tri : cette portée existe depuis C1, elle décide seule quand elle a un
   *  avis, et deux listes qui écartent les mêmes images auraient fini par se
   *  contredire. */
  onImage: (asset: string, cochee: boolean) => void
  onPayer: () => void
  /** **L'appel est parti, on attend** (U1). Le bouton le dit et cesse d'être
   *  cliquable ; il ne le redevient que si l'appel échoue, puisqu'une réussite
   *  referme l'écran. Cinq clics rapides lançaient cinq appels payants. */
  enPaiement?: boolean
  /** **Ce que le dernier appel a répondu quand il n'est pas passé** (U1).
   *  Distinct de `refus`, qui empêche de partir : celui-ci dit qu'on est parti
   *  et qu'on est revenu sans image, et le bouton reste vivant — ce qu'on veut
   *  faire d'un appel raté est le refaire. */
  echec?: string | null
  onFermer: () => void
  /** **Le second geste, nommé** : il écrit dans la fiche de la chose du jeu.
   *  Garder est possible ; ce n'est jamais un effet de bord. */
  onGarder: (ligne: LigneQuiPart) => void
  /** Sauter cet écran **pour la série en cours**. Il revient dès qu'on change
   *  de chose ou de pose : une case définitive éteindrait le seul écran qui
   *  montre ce qui part, et on la cocherait le premier jour.
   *
   *  **`null` quand il n'y a pas de série** — un texte écrit à la main, sans
   *  chose du jeu visée, n'a pas de suivant qui lui ressemble. La case ne
   *  paraît alors pas du tout. */
  onSauter: ((saute: boolean) => void) | null
  /** **Reprendre le texte à la main** (R2, US-159, US-160) : le champ reçoit
   *  l'assemblé et il part mot pour mot. Il vit ici depuis E14, sous le texte
   *  qu'on reprendrait — on ne reprend pas un texte qu'on ne voit pas. */
  onReprendre: (texte: string) => void
  refus: string | null
  /** **L'adresse de l'image que la planche joint** (M4), ou rien quand l'appel
   *  n'en joint aucune. Elle est composée par l'atelier, qui tient les repères
   *  de l'appel : cet écran-ci ne les a pas, et les lui donner pour qu'il
   *  refasse l'adresse aurait été un second endroit où elle s'écrit. */
  plancheJointe: string | null
  /** **Le geste qui manquait ici** (M5) : ouvrir la grille du produit pour
   *  joindre une image de plus, sans refermer ce qu'on est en train de lire.
   *  Cet écran ne sait pas ouvrir une grille et n'a pas à l'apprendre — il dit
   *  seulement qu'on le demande, et l'atelier pose la grille par-dessus. */
  onAjouterUneReference: () => void
}) {
  const [edition, setEdition] = useState(false)
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      const cible = evenement.target
      if (cible instanceof Element && cible.closest("dialog[open]")) return
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

  const basculer = (clef: string, allumee: boolean) =>
    onTri({
      ...tri,
      eteints: allumee
        ? [...tri.eteints.filter((c) => c !== clef), clef]
        : tri.eteints.filter((c) => c !== clef),
      allumes: allumee
        ? tri.allumes.filter((c) => c !== clef)
        : [...tri.allumes.filter((c) => c !== clef), clef],
    })

  const corriger = (clef: string, texte: string) =>
    onTri({ ...tri, textes: { ...tri.textes, [clef]: texte } })

  const remettre = (clef: string) => {
    const restant = { ...tri.textes }
    delete restant[clef]
    onTri({ ...tri, textes: restant })
  }

  // **L'ordre est celui de l'assemblage**, et depuis R7 il se lit en trois
  // parties : le contexte, les références, la demande. On lit de haut en bas ce
  // qui part de gauche à droite, et les titres de l'écran sont ceux que le
  // fournisseur reçoit — traduits une fois, ici, comme les intitulés de la
  // bible.
  //
  // **Les parties viennent du serveur**, qui les compose en même temps que le
  // texte : l'écran ne fait que les afficher dans l'ordre où elles arrivent. Il
  // garde en revanche la table des groupes de chaque partie, parce que le
  // milieu de l'écran range des *lignes* — celles qu'on éteint et qu'on corrige
  // — et non des paragraphes.
  const parties = envoi?.parties ?? []

  // **Ce qu'un style local laisse voir en plus** (ML3, ML4, ML5). `api.ts`
  // ne porte pas encore ces trois champs — voir `../api-workflows` — donc on
  // les lit par une extension de type plutôt que d'attendre que ce fichier,
  // occupé par un autre travail au moment d'écrire ML5, les déclare.
  const local = envoi ? (envoi as unknown as EnvoiAvecLocal).local : null
  const referenceNom = envoi ? (envoi.modele as unknown as EnvoiAvecLocal["modele"]).reference_nom : null
  const negatifLu = envoi ? (envoi.fond as unknown as EnvoiAvecLocal["fond"]).negatif_lu : true
  // **Le temps qu'un style local annonce** (ML5, règle 8ter) : la mesure de
  // cette machine, ou la vitesse du style à défaut — jamais un prix, qui
  // resterait « inconnu » pour toujours (un appel local vaut `cout_usd = 0`).
  const tempsLocal = local?.temps ?? null
  const tempsEcrit = tempsLocal
    ? tempsLocal.secondes != null
      ? `≈ ${quantite(tempsLocal.secondes, "seconde")} par image`
      : (tempsLocal.vitesse ?? "Durée non encore mesurée pour ce workflow.")
    : null

  if (presentation === "atelier") {
    const bouton = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
    const prixEcrit = prix(envoi?.prix.total ?? null, envoi?.prix.mesure.unite)
    // **Le cadre, le résumé en trois cases et le pied qui paie ne sont plus
    // dessinés ici** (RP4) : ils appartiennent à la fenêtre unique de
    // relecture, celle que les quatre types partagent. Cet écran-ci n'écrit
    // plus que ce qu'une image fixe a de particulier — ses lignes de texte, ses
    // images jointes, son fond, ses consignes.
    const resume: ResumeDeLEnvoi | null = !envoi ? null : {
      // **Son nom, pas l'identifiant brut qu'il transporte** (ML5) : un style
      // local le porte sous une forme illisible — « ComfyUI:zimage-pixel@ca12…
      // » — que rien ne demande à l'écran de déchiffrer avant de payer.
      modele: <>{envoi.modele.nom}<span className="mt-[2px] block text-[11px] text-encre-4">{envoi.modele.identifiant}</span></>,
      resultat: <><p>{reglages?.proportions ?? "Format du modèle"} · {envoi.prix.appels} génération{envoi.prix.appels > 1 ? "s" : ""}{envoi.cases > 1 ? ` · ${envoi.cases} cases sur une planche` : ""}</p>{reglages && Object.entries(reglages.options).filter(([,v]) => v !== "").map(([k,v]) => <p key={k} className="mt-[4px] text-encre-3">{k} : {v}</p>)}</>,
      consommation: local ? (tempsEcrit ?? "Durée non encore mesurée pour ce workflow.") : prixEcrit,
      mesure: <>
          {/* **La mesure se lit à côté du prix, jamais fondue dedans** (T1, E13).
              Le chiffre au-dessus est une moyenne relevée sur les générations déjà
              payées à ce modèle-ci — pas un tarif annoncé par le fournisseur —,
              et le pas d'une image jointe est mesuré sur ses propres générations.
              Sans la phrase qui suit, la moyenne se lirait comme une facture. */}
          {envoi.prix.mesure.prix === null
            ? <p className="mt-[4px] text-encre-3">{envoi.prix.mesure.appels ? `Mesurée sur ${envoi.prix.mesure.appels} générations précédentes.` : "Aucune mesure disponible pour ce modèle."}</p>
            : <p className="mt-[4px] leading-relaxed text-encre-3">mesuré sur {envoi.prix.mesure.appels} génération{envoi.prix.mesure.appels > 1 ? "s" : ""} {estArgent(envoi.prix.mesure.unite) ? "payée" : "passée"}{envoi.prix.mesure.appels > 1 ? "s" : ""} à <span className="text-encre-2">{envoi.modele.nom}</span>.{envoi.prix.mesure.par_image !== null && envoi.prix.mesure.base !== null && <> Une génération sans image jointe a {estArgent(envoi.prix.mesure.unite) ? "coûté" : "pris"} {quantite(envoi.prix.mesure.base, envoi.prix.mesure.unite)} sur {envoi.prix.mesure.sur_base} générations ; chaque image jointe en ajoute <span className="text-encre-attention">{quantite(envoi.prix.mesure.par_image, envoi.prix.mesure.unite)}</span>, mesuré sur {envoi.prix.mesure.sur_jointes}. Une moyenne n'est le prix de personne : elle ne tombera juste sur aucune génération donnée.</>}{envoi.prix.mesure.par_image === null && <> Le pas d'une image jointe n'est pas mesurable ici — il y faudrait des générations à plusieurs comptes d'images. Le chiffre affiché est la médiane, images comprises.</>}</p>}
        </>,
    }
    return <RelireAvantEnvoi
      type="image"
      sousTitre={edition ? "Les modifications s’appliquent à cette génération. L’univers reste inchangé." : "Voici les textes et les images qui seront transmis au modèle."}
      resume={resume}
      modification={{ active: edition, onBasculer: () => setEdition(v => !v), bloquee: enPaiement }}
      onFermer={onFermer}
      fermetureBloquee={enPaiement}
      refus={refus}
      echec={echec}
      etat={actualisation ? "Actualisation des textes, des images et du coût…" : enPaiement ? "L’envoi est en cours." : "Aucune génération avant de lancer."}
      /* **Le compte des avertissements, à côté du prix** : on sait qu'il y en a
         sans être descendu jusqu'à eux, et l'on sait qu'ils ne retiennent pas
         l'appel. Chacun reste écrit là où il porte — sur la ligne du texte, ou
         dans le bloc des images —, jamais en bandeau : un bandeau dirait
         « attention » et laisserait chercher où. Le serveur rend la liste
         entière, lignes et images mêlées ; l'écran la compte, il ne la
         recompose pas. */
      pied={envoi && envoi.avertissements.length > 0 ? <p className="mt-[4px] text-encre-attention">{envoi.avertissements.length} avertissement{envoi.avertissements.length > 1 ? "s" : ""} — non bloquant{envoi.avertissements.length > 1 ? "s, écrits là où ils portent" : ", écrit là où il porte"}</p> : null}
      /* **Il s'évite, et jamais pour toujours.** Refaire dix fois la même chose
         et relire dix fois est une punition ; mais une case définitive
         éteindrait le seul écran qui montre ce qui part, et on la cocherait le
         premier jour. **Pas de case du tout sans série** : sans chose du jeu
         visée, chaque texte est écrit à la main, et l'offrir là reviendrait à
         éteindre l'écran pour toutes les générations libres à venir. */
      avantLeBouton={onSauter ? <div className="shrink-0"><label className="flex cursor-pointer items-center gap-[8px]"><input type="checkbox" className="h-[14px] w-[14px] accent-signal" onChange={(e) => onSauter(e.target.checked)} /><span>ne plus me le montrer pour cette série</span></label><p className="mt-[4px] text-encre-3">il revient dès qu'on change de sujet ou de pose. Il n'y a pas de case « pour toujours ».</p></div> : null}
      paiement={{
        // **Un style local se lance, il ne se paie pas** (règle 8ter) : rien
        // ne se facture sur la machine, et le mot du bouton doit le dire
        // plutôt que reprendre le mot générique des modèles gratuits.
        libelle: enPaiement
          ? "Envoi en cours…"
          : local
            ? "Lancer sur ma carte graphique"
            : envoi && estArgent(envoi.prix.mesure.unite)
              ? `Payer et lancer${envoi.prix.total != null ? ` ${prixEcrit}` : ""}`
              : "Lancer la fabrication",
        onPayer,
        prix: local ? <>{tempsEcrit}</> : <>{prixEcrit}{envoi?.prix.total !== null && envoi && " · estimation"}</>,
        empeche: !!refus || !envoi || enPaiement || actualisation,
      }}
      enfants={envoi && <>
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[22px]">
          <div className="space-y-[22px]">
            <section className="rounded-7 border border-trait bg-carte p-[22px]"><h2 className="mb-[14px] font-serif text-[25px]">Textes envoyés</h2>{edition ? <div className="space-y-[14px] [&_.mesure]:text-[12px]">{envoi.groupes.filter(g => envoi.lignes.some(l => l.groupe === g.clef)).map(g => <section key={g.clef}><h3 className="font-medium">{g.nom}</h3><ul>{envoi.lignes.filter(l => l.groupe === g.clef).map(l => <Ligne key={l.clef} ligne={l} onBasculer={() => basculer(l.clef, l.allumee)} onCorriger={t => corriger(l.clef, t)} onRemettre={() => remettre(l.clef)} onGarder={() => onGarder(l)} />)}</ul></section>)}</div> : local ? <TexteLocalQuiPart local={local} /> : <div className="space-y-[22px]">{parties.filter(p => p.texte.trim()).map(p => <section key={p.clef}><h3 className="mb-[8px] font-medium">{p.nom}</h3><p className="mesure whitespace-pre-wrap break-words rounded-7 border border-trait bg-papier p-[14px] text-[12px] leading-relaxed">{p.titre && `${p.titre}\n\n`}{p.texte}</p></section>)}{!envoi.texte && <p className="text-encre-3">Aucun texte à envoyer.</p>}</div>}{edition && <button className={`${bouton} mt-[14px]`} onClick={() => onReprendre(envoi.texte)} disabled={!envoi.texte}>Modifier le texte complet à la main</button>}</section>
            {!(local && !negatifLu) && <section className="rounded-7 border border-trait bg-carte p-[22px]"><h2 className="mb-[14px] font-serif text-[25px]">Fond et prompt négatif</h2>{edition ? <div className="[&_.mesure]:text-[12px]"><SectionFond fond={envoi.fond} onFond={couleur => onTri({ ...tri, fond: couleur })} /></div> : <><p>Fond : {envoi.fond.couleur || "aucun fond imposé"}</p><p className="mesure mt-[14px] whitespace-pre-wrap text-[12px] leading-relaxed">{envoi.fond.interdiction || "Aucune consigne négative."}</p></>}</section>}
            {envoi.retour.length > 0 && <details className="rounded-7 border border-trait bg-carte p-[22px]"><summary className="cursor-pointer font-medium">Traitements appliqués au retour · sur la machine</summary><ul className="mt-[14px] space-y-[8px]">{envoi.retour.map(r => <li key={r.nom}>{r.nom} · {r.detail}</li>)}</ul><p className="mt-[14px] text-encre-3">Les originaux sont conservés. Ces traitements se modifient dans la retouche.</p></details>}
          </div>
          <div className="space-y-[22px]">
            <section className="rounded-7 border border-trait bg-carte p-[22px]"><div><h2 className="font-serif text-[25px]">Images envoyées</h2><p className="mt-[8px] text-encre-3">{envoi.images.partent ?? envoi.images.cochees} image{(envoi.images.partent ?? envoi.images.cochees) > 1 ? "s" : ""} · {envoi.images.places} places</p>
              {/* **Ce qu'un style local fait d'une image jointe** (ML3, ML5) :
                  il la garde comme sujet, ou repeint par-dessus. C'est le
                  même mot pour toutes les images de cet appel — un style
                  local n'en change pas d'une image jointe à l'autre. */}
              {referenceNom && envoi.images.lignes.length > 0 && <p className="mt-[4px] text-encre-3">{referenceNom} — {envoi.images.lignes.length > 1 ? "chaque image jointe" : "l’image jointe"}</p>}
              {/* **Ce que les cases cochées pèsent dans le total**, et non un
                  nombre nu : « $0,0080 » seul ne dit pas si c'est la moitié de
                  l'appel ou un vingtième. Chez un fournisseur qui ne facture
                  pas, la part n'existe pas et la ligne ne paraît pas — elle ne
                  s'écrit jamais « $0,0000 », qui se lit *sans limite*. */}
              {envoi.prix.images !== null && <p className="mt-[4px] text-encre-3">{envoi.images.cochees} cochée{envoi.images.cochees > 1 ? "s" : ""} · <span className="text-encre-attention">{quantite(envoi.prix.images, envoi.prix.mesure.unite)}</span>{envoi.prix.total !== null && ` des ${quantite(envoi.prix.total, envoi.prix.mesure.unite)}`}</p>}
            </div>{edition &&<button className={`${bouton} mt-[14px]`} onClick={onAjouterUneReference}>Ajouter une référence</button>}<fieldset disabled={!edition || enPaiement} className="mt-[14px] [&_.mesure]:text-[12px]"><ul>{envoi.images.lignes.map(i => <LigneImage key={i.asset} image={i} places={envoi.images.places} onBasculer={() => onImage(i.asset, i.cochee)} />)}{envoi.images.jointe && <LigneJointe jointe={envoi.images.jointe} adresse={plancheJointe} />}</ul></fieldset>{!envoi.images.lignes.length && !envoi.images.jointe && !envoi.images.palette && <p className="mt-[14px] text-encre-3">Aucune image jointe.</p>}{envoi.images.palette > 0 && <p className="mt-[14px] text-encre-3">La palette du jeu est jointe en image.</p>}{envoi.images.avertissements.map(a => <p key={a.clef} className="mt-[14px] text-encre-attention">{a.texte}</p>)}</section>
            {envoi.options.length > 0 && <section className="rounded-7 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Consignes facultatives</h2><fieldset disabled={!edition || enPaiement} className="mt-[14px] [&_.mesure]:text-[12px]"><ul>{envoi.options.map(o => <LigneOption key={o.clef} option={o} onBasculer={() => basculer(o.clef, o.allumee)} />)}</ul></fieldset></section>}
          </div>
        </div>
      </>}
    />
  }

  return (
    <div
      data-envoi
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px] bg-papier"
    >
      {/* ── Les groupes, et ce que chacun pèse ─────────────────────────────
          « 4 sur 7 » se lit ici : on sait qu'il y a quelque chose d'éteint
          avant d'être descendu jusqu'à lui. */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-trait p-4">
        <div className="flex items-baseline gap-2">
          <Libelle>ce qui part</Libelle>
          <button
            type="button"
            onClick={onFermer}
            title="Échap revient sans rien dépenser"
            className="mesure ml-auto px-1 text-[10px] text-encre-4 hover:text-encre"
          >
            Fermer
          </button>
        </div>

        {refus && <Raison texte={refus} />}

        {envoi && (
          <>
            {/* **Le sommaire suit les trois parties** (R7) : on y lit d'abord
                à quoi sert ce qui part, puis d'où chaque morceau vient. Les
                groupes qu'aucune partie rendue ne réclame — il n'y en a pas
                aujourd'hui — resteraient invisibles, et c'est le seul cas où le
                sommaire mentirait ; le repli en fin de liste les rattrape. */}
            <ul className="flex flex-col">
              {parties.map((partie) => {
                const siens = envoi.groupes.filter(
                  (g) => g.partie === partie.clef,
                )
                if (!siens.length) return null
                return (
                  <li key={partie.clef} className="flex flex-col">
                    <span className="mesure mt-2 flex h-[22px] items-center text-[9.5px] tracking-[.11em] text-encre-4 uppercase first:mt-0">
                      {partie.nom}
                    </span>
                    <ul className="flex flex-col">
                      {siens.map((groupe) => (
                        <li
                          key={groupe.clef}
                          className="mesure flex h-[26px] items-center gap-2 pl-2 text-[10px]"
                        >
                          <span className="flex-1 truncate text-encre-3">
                            {groupe.nom}
                          </span>
                          <span className="text-encre">
                            {groupe.allumees} sur {groupe.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
              {envoi.groupes
                .filter(
                  (g) => !parties.some((p) => p.clef === g.partie),
                )
                .map((groupe) => (
                  <li
                    key={groupe.clef}
                    className="mesure flex h-[26px] items-center gap-2 text-[10px]"
                  >
                    <span className="flex-1 truncate text-encre-3">
                      {groupe.nom}
                    </span>
                    <span className="text-encre">
                      {groupe.allumees} sur {groupe.total}
                    </span>
                  </li>
                ))}
            </ul>

            {/* **Un compte qu'on voit sans descendre** : on a divergé, et de
                combien. */}
            {envoi.corrections > 0 && (
              <p className="mesure text-[10px] leading-4 text-encre-attention">
                {envoi.corrections} correction
                {envoi.corrections > 1 ? "s" : ""} pour cette génération
              </p>
            )}

            {/* ── Le sixième groupe, qui ne part pas ────────────────────────
                **Rien de tout ça ne part au modèle, et rien ne coûte un
                centime.** C'est montré parce que l'image qu'on verra revenir
                n'est pas celle que le modèle envoie, et qu'il vaut mieux le
                savoir avant que le savoir après. En gris, et c'est un mot du
                produit : *ce n'est pas de ça qu'on parle en ce moment*. */}
            {envoi.retour.length > 0 && (
              <section className="flex flex-col gap-1 border-t border-trait pt-4">
                <Libelle>ce qui se passe au retour</Libelle>
                <ul className="flex flex-col">
                  {envoi.retour.map((ligne) => (
                    <li
                      key={ligne.nom}
                      className="mesure flex h-[26px] items-center gap-2 text-[10px] text-encre-4"
                    >
                      <span className="flex-1 truncate">{ligne.nom}</span>
                      <span>{ligne.detail}</span>
                    </li>
                  ))}
                </ul>
                <p className="mesure text-[9.5px] leading-4 text-encre-4">
                  sur la machine, après coup, et sans un centime. Ces réglages-là
                  se font dans les tables — un sujet est réglé à un seul
                  endroit.
                </p>
              </section>
            )}
          </>
        )}
      </aside>

      {/* ── Une ligne par chose qui part ───────────────────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-5 overflow-y-auto p-5">
        {!envoi ? (
          <p className="mesure text-[10px] text-encre-4">…</p>
        ) : (
          parties.map((partie) => {
            const groupes = partie.repris
              ? ["sujet"]
              : (GROUPES_DE_LA_PARTIE[partie.clef] ?? [])
            const dedans = groupes.filter((groupe) =>
              envoi.lignes.some((l) => l.groupe === groupe),
            )
            if (!dedans.length) return null
            return (
              // **La partie porte son titre et son propos, puis ses groupes.**
              // Le titre est celui que le fournisseur reçoit, écrit en mono
              // juste après le nom français : c'est un fait sur ce qui part, pas
              // un libellé, et le produit écrit les faits dans la police des
              // chiffres.
              <section
                key={partie.clef}
                data-partie={partie.clef}
                className="flex flex-col gap-3 border-t border-contour pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <Libelle>{partie.nom}</Libelle>
                    {partie.titre && (
                      <span className="mesure text-[9.5px] text-encre-4">
                        part sous « {partie.titre} »
                      </span>
                    )}
                  </div>
                  <p className="mesure text-[10px] leading-4 text-encre-3">
                    {partie.propos}
                  </p>
                </div>
                {dedans.map((groupe) => {
                  const miennes = envoi.lignes.filter(
                    (l) => l.groupe === groupe,
                  )
                  return (
                    <div key={groupe} className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <Libelle>{NOM_DU_GROUPE[groupe] ?? groupe}</Libelle>
                        <span className="mesure text-[9.5px] text-encre-4">
                          {miennes.filter((l) => l.allumee).length} sur{" "}
                          {miennes.length}
                        </span>
                      </div>
                      <ul className="flex flex-col border-t border-trait">
                        {miennes.map((ligne) => (
                          <Ligne
                            key={ligne.clef}
                            ligne={ligne}
                            onBasculer={() => basculer(ligne.clef, ligne.allumee)}
                            onCorriger={(texte) => corriger(ligne.clef, texte)}
                            onRemettre={() => remettre(ligne.clef)}
                            onGarder={() => onGarder(ligne)}
                          />
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </section>
            )
          })
        )}

        {/* ── Les images jointes, et ce que chacune coûte ─────────────────── */}
        {envoi && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <Libelle>les images jointes</Libelle>
              <span className="mesure text-[9.5px] text-encre-4">
                {envoi.images.cochees} cochée
                {envoi.images.cochees > 1 ? "s" : ""}
                {/* **La part des images, dans l'unité de l'appel** (F2). Chez
                    un fournisseur qui ne facture pas, une image jointe n'ajoute
                    aucun dollar — mais l'écran ne doit pas pour autant écrire
                    « $0,0000 », qui se lit *sans limite*. */}
                {envoi.prix.images !== null && (
                  <>
                    {" · "}
                    <span className="text-encre-attention">
                      {quantite(envoi.prix.images, envoi.prix.mesure.unite)}
                    </span>
                    {envoi.prix.total !== null &&
                      ` des ${quantite(envoi.prix.total, envoi.prix.mesure.unite)}`}
                  </>
                )}
                {envoi.images.places > 0 &&
                  ` · ${envoi.images.places} places sur ce modèle`}
              </span>
              {/* **Le geste est ici parce que le manque se voit ici** (M5).
                  C'est en lisant cette liste, juste avant de payer, qu'on
                  s'aperçoit qu'une image manque ; jusqu'ici il fallait fermer
                  l'écran, aller la chercher dans la galerie, et retrouver ses
                  corrections effacées. Il ne part rien de ce bouton : il ouvre
                  une grille, et la grille ne paie jamais. */}
              <button
                type="button"
                onClick={onAjouterUneReference}
                data-ajouter-reference
                title="Choisir une image dans la galerie, sans quitter cet écran"
                className="mesure ml-auto shrink-0 rounded-[2px] border border-trait px-1.5 py-0.5 text-[9.5px] text-encre-3 hover:border-encre-4 hover:text-encre"
              >
                ajouter une référence ›
              </button>
            </div>
            {envoi.images.lignes.length === 0 &&
            !envoi.images.gabarit &&
            !envoi.images.palette ? (
              <p className="mesure text-[10px] leading-4 text-encre-4">
                aucune image ne part avec cette génération.
              </p>
            ) : (
              <ul className="flex flex-col border-t border-trait">
                {envoi.images.lignes.map((image) => (
                  <LigneImage
                    key={image.asset}
                    image={image}
                    places={envoi.images.places}
                    onBasculer={() => onImage(image.asset, image.cochee)}
                  />
                ))}
                {/* **La troisième image est une ligne comme les deux autres**
                    (M4). Elle était un paragraphe sous la liste : sans vignette,
                    sans moyen de l'ouvrir en grand, et nommée *gabarit* même
                    quand le texte qui part au même instant demandait de modifier
                    la planche existante. Le rôle vient du serveur, qui est le
                    seul à savoir laquelle des deux c'est. */}
                {envoi.images.jointe && (
                  <LigneJointe
                    jointe={envoi.images.jointe}
                    adresse={plancheJointe}
                  />
                )}
              </ul>
            )}
            {/* **La palette compte dans le total, elle doit donc se voir ici.**
                Sans cette ligne, l'en-tête annonçait « 1 cochée » au-dessus d'une
                liste vide : le compte était juste et l'image introuvable. Elle se
                décoche là où elle se coche, dans les options — une chose se règle
                à un seul endroit. */}
            {envoi.images.palette > 0 && (
              <p className="mesure text-[9.5px] leading-4 text-encre-4">
                {envoi.images.rang_palette !== null &&
                  `Image ${envoi.images.rang_palette} · `}
                la bande des couleurs du jeu, cochée dans les options plus bas.
                Elle compte dans les places du modèle, et dans le prix.
              </p>
            )}
            {/* **Ce que les images ont à dire, écrit là où elles sont** — et
                c'était un trou. L'en-tête de l'écran annonce « N avertissements,
                écrits sur la ligne concernée » ; les avertissements du bloc
                d'images n'ont pas de ligne de prompt à eux, et n'étaient donc
                **comptés nulle part visible**. On lisait « 1 avertissement » et
                l'on cherchait où. Trouvé en regardant l'écran chez un modèle
                sans places (F6) ; les deux autres — *aucune image jointe*, *14
                places pour 16 cochées* — l'attendaient depuis E14. */}
            {envoi.images.avertissements.map((a) => (
              <p
                key={a.clef}
                className="mesure text-[9.5px] leading-4 text-encre-attention"
              >
                ⚠ {a.texte}
              </p>
            ))}
          </section>
        )}

        {/* ── Les options que le modèle sait faire ─────────────────────────── */}
        {envoi && envoi.options.length > 0 && (
          <section className="flex flex-col gap-2">
            <Libelle>les options</Libelle>
            <ul className="flex flex-col border-t border-trait">
              {envoi.options.map((option) => (
                <LigneOption
                  key={option.clef}
                  option={option}
                  onBasculer={() => basculer(option.clef, option.allumee)}
                />
              ))}
            </ul>
          </section>
        )}

        {/* ── Le fond, corrigeable avant de payer ──────────────────────────── */}
        {envoi && (
          <SectionFond
            fond={envoi.fond}
            onFond={(couleur) => onTri({ ...tri, fond: couleur })}
          />
        )}
      </section>

      {/* ── Ce qui part, mot pour mot ──────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-trait p-4">
        <Libelle>ce qui part, mot pour mot</Libelle>
        {envoi && (
          <>
            {/* **Le pavé se coupe là où le texte se coupe** (R7). C'était un
                seul bloc de mille deux cents caractères ; ce sont maintenant
                trois blocs, chacun sous le titre que le fournisseur reçoit —
                et le titre est écrit **dans** le bloc, en tête, parce qu'il
                part avec. Rien n'est résumé, rien n'est réécrit, et recoller
                les blocs dans l'ordre rend exactement `envoi.texte`. */}
            {parties.every((p) => !p.texte.trim()) ? (
              <p className="mesure rounded-[2px] border border-trait bg-carte p-2 text-[10.5px] leading-[1.45] text-encre-4">
                rien encore — écris un sujet
              </p>
            ) : (
              parties
                .filter((partie) => partie.texte.trim())
                .map((partie) => (
                  <div key={partie.clef} className="flex flex-col gap-1">
                    <span className="mesure text-[9.5px] tracking-[.11em] text-encre-4 uppercase">
                      {partie.nom}
                    </span>
                    <p
                      data-partie-qui-part={partie.clef}
                      className="mesure whitespace-pre-wrap rounded-[2px] border border-trait bg-carte p-2 text-[10.5px] leading-[1.45] text-encre-3"
                    >
                      {partie.titre && (
                        <span className="text-encre-4">
                          {partie.titre}
                          {"\n\n"}
                        </span>
                      )}
                      {partie.texte}
                    </p>
                  </div>
                ))
            )}

            {/* **Reprendre pose le texte exact, et rien d'autre** (US-159) :
                l'univers n'est pas touché, la bible reste ce qu'elle est. C'est
                la différence entre corriger une formulation et démonter son
                projet. */}
            <button
              type="button"
              onClick={() => onReprendre(envoi.texte)}
              disabled={!envoi.texte}
              className="mesure h-[26px] self-start text-[10px] text-signal hover:opacity-70 disabled:text-encre-4"
            >
              Reprendre le texte ›
            </button>

            <p className="mesure text-[9.5px] leading-4 text-encre-4">
              {envoi.caracteres.total} caractères ·{" "}
              {envoi.images.cochees} image{envoi.images.cochees > 1 ? "s" : ""}{" "}
              jointe{envoi.images.cochees > 1 ? "s" : ""}
              {envoi.caracteres.total > 0 && (
                <>
                  <br />
                  le sujet pèse{" "}
                  <span className="text-encre-3">
                    {envoi.caracteres.sujet} car.
                  </span>
                  , soit{" "}
                  {Math.round(
                    (envoi.caracteres.sujet / envoi.caracteres.total) * 100,
                  )}{" "}
                  %
                </>
              )}
              {envoi.caracteres.eteints > 0 && (
                <>
                  <br />
                  {envoi.caracteres.eteints} caractères éteints à la main
                </>
              )}
            </p>

            {/* **Le compte des avertissements, repris ici** : on sait qu'il y en
                a même sans être descendu jusqu'à eux — et chacun est écrit sur
                sa ligne, jamais en bandeau. */}
            {envoi.avertissements.length > 0 && (
              <p className="mesure text-[9.5px] leading-4 text-encre-attention">
                {envoi.avertissements.length} avertissement
                {envoi.avertissements.length > 1 ? "s" : ""} — non bloquant
                {envoi.avertissements.length > 1 ? "s" : ""}, écrit
                {envoi.avertissements.length > 1 ? "s" : ""} sur la ligne
                concernée
              </p>
            )}

            {envoi.cases > 1 && (
              <p className="mesure text-[9.5px] leading-4 text-encre-4">
                {envoi.cases} cases sur 1 planche — un compte faux ne fait rien
                entrer, et la planche entière se relance au prix plein.
              </p>
            )}

            {/* ── Le prix, et la mesure qui le porte ───────────────────────── */}
            <section className="flex flex-col gap-1.5 border-t border-trait pt-4">
              {/* **Ce qui reste chez ce fournisseur, avant de partir** (F2).
                  Le même objet que l'écran où l'on choisit lit : deux calculs à
                  deux endroits ont déjà annoncé deux chiffres pour la même
                  génération, à trois centimètres l'un de l'autre (E13). */}
              {envoi.reserve && <LigneReserve reserve={envoi.reserve} />}

              {envoi.prix.mesure.prix === null ? (
                <p className="mesure text-[9.5px] leading-4 text-encre-4">
                  {estArgent(envoi.prix.mesure.unite)
                    ? "ce modèle n'a encore rien facturé sur cette machine — le prix reste inconnu plutôt que deviné."
                    : "ce modèle n'a encore rien consommé sur cette machine — ce qu'il prendra reste inconnu plutôt que deviné."}
                </p>
              ) : (
                <p className="mesure text-[9.5px] leading-4 text-encre-4">
                  mesuré sur {envoi.prix.mesure.appels} génération
                  {envoi.prix.mesure.appels > 1 ? "s" : ""}{" "}
                  {estArgent(envoi.prix.mesure.unite) ? "payée" : "passée"}
                  {envoi.prix.mesure.appels > 1 ? "s" : ""} à{" "}
                  <span className="text-encre-3">{envoi.modele.nom}</span>.
                  {envoi.prix.mesure.par_image !== null &&
                    envoi.prix.mesure.base !== null && (
                      <>
                        {" "}
                        Une génération sans image jointe a{" "}
                        {estArgent(envoi.prix.mesure.unite) ? "coûté" : "pris"}{" "}
                        {quantite(envoi.prix.mesure.base, envoi.prix.mesure.unite)}{" "}
                        sur {envoi.prix.mesure.sur_base} générations ; chaque image
                        jointe en ajoute{" "}
                        <span className="text-encre-attention">
                          {quantite(
                            envoi.prix.mesure.par_image,
                            envoi.prix.mesure.unite,
                          )}
                        </span>
                        , mesuré sur {envoi.prix.mesure.sur_jointes}. Une moyenne
                        n'est le prix de personne : elle ne tombera juste sur
                        aucune génération donnée.
                      </>
                    )}
                  {envoi.prix.mesure.par_image === null && (
                    <>
                      {" "}
                      Le pas d'une image jointe n'est pas mesurable ici — il y
                      faudrait des générations à plusieurs comptes d'images. Le
                      chiffre affiché est la médiane, images comprises.
                    </>
                  )}
                </p>
              )}

              {/* **L'appel raté se lit à l'endroit où l'on a cliqué**, et il ne
                  grise rien : c'est le seul état de l'écran d'où le bon geste
                  est de recommencer. */}
              {echec && (
                <p className="mesure text-[10px] leading-4 text-echec">
                  {echec} — rien n'a été facturé, on peut relancer.
                </p>
              )}
              {/* **Le bouton qui paie refuse le second clic** (U1). Le mot
                  change autant que l'état : un bouton grisé qui garde son
                  libellé se lit comme un refus, alors que c'est une attente. */}
              <Bouton
                principal
                inactif={Boolean(refus) || !envoi || enPaiement}
                onClick={onPayer}
                enfants={
                  refus
                    ? refus
                    : enPaiement
                      ? "Paiement en cours…"
                      : envoi.prix.total !== null
                        ? estArgent(envoi.prix.mesure.unite)
                          ? `Payer et lancer ${dollars(envoi.prix.total)}`
                          : `Lancer — gratuit, ${quantite(
                              envoi.prix.total,
                              envoi.prix.mesure.unite,
                            )}`
                        : estArgent(envoi.prix.mesure.unite)
                          ? "Payer et lancer"
                          : "Lancer — gratuit"
                }
              />
              <button
                type="button"
                onClick={onFermer}
                disabled={enPaiement}
                className="mesure h-[26px] text-[10px] text-encre-4 hover:text-encre-3 disabled:cursor-not-allowed disabled:hover:text-encre-4"
              >
                {enPaiement
                  ? "la génération est partie — elle ne se rattrape plus"
                  : "Revenir sans rien dépenser"}
              </button>
              <p className="mesure text-[9.5px] leading-4 text-encre-4">
                rien n'est consommé tant que le bouton n'est pas pressé.
              </p>

              {/* **Il s'évite, et jamais pour toujours.** Quand on refait dix
                  fois la même chose, relire dix fois est une punition ; mais une
                  case définitive éteindrait le seul écran qui montre ce qui
                  part, et on la cocherait le premier jour, quand on ne sait pas
                  encore qu'on en aura besoin.

                  **Et pas de case du tout quand il n'y a pas de série** —
                  corrigé le 31 août 2026, sur un bug signalé par l'auteur qui
                  coûtait de l'argent à chaque clic. Une série est *une chose et
                  une pose* ; sans chose du jeu, chaque texte est écrit à la main
                  et n'a rien à voir avec le précédent. Offrir la case là
                  revenait à proposer d'éteindre l'écran pour toutes les
                  générations libres à venir, dans tous les jeux — c'est-à-dire
                  exactement la case « pour toujours » que le produit refuse. */}
              {onSauter && (
                <>
                  <label className="mesure flex cursor-pointer items-center gap-2 pt-1 text-[10px] text-encre-4 hover:text-encre-3">
                    <input
                      type="checkbox"
                      onChange={(e) => onSauter(e.target.checked)}
                      className="h-3 w-3 accent-signal"
                    />
                    <span>ne plus me le montrer pour cette série</span>
                  </label>
                  <p className="mesure text-[9.5px] leading-4 text-encre-4">
                    il revient dès qu'on change de sujet ou de pose. Il n'y a pas
                    de case « pour toujours ».
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  )
}

/** **Le fond, et ce qu'il interdit — corrigeable jusqu'au dernier moment** (D3).
 *
 *  **Pourquoi une section et pas une ligne.** Tout le reste de cet écran est une
 *  ligne de texte avec son interrupteur ; le fond n'en est pas une. C'est un
 *  réglage du jeu qui *fabrique* une ligne — la phrase de calage, qu'on lit plus
 *  haut dans « les textes du jeu » — **et** qui fabrique en plus l'interdiction,
 *  laquelle part dans un autre champ de la demande. Le corriger en tapant dans
 *  la ligne aurait changé l'une sans l'autre : l'appel serait parti en demandant
 *  un fond magenta tout en interdisant le cyan, sans que rien ne le dise.
 *
 *  **L'interdiction est montrée ici parce qu'elle ne peut être montrée nulle
 *  part ailleurs.** Elle est le seul morceau de ce qui part que le texte ne
 *  contient pas — les adaptateurs la replient en fin de demande sous *« Do not
 *  include: »*. Sans ce bloc, l'écran qui promet de tout montrer aurait un angle
 *  mort, et ce serait celui que la tranche vient d'ouvrir.
 *
 *  **La correction ne remonte nulle part**, comme tout ce que cet écran renvoie.
 *  Poser le fond durablement est un second geste, qui passe par le codex — la
 *  même règle que « garder cette correction » sur une ligne de texte. */
function SectionFond({
  fond,
  onFond,
}: {
  fond: Envoi["fond"]
  onFond: (couleur: string | null) => void
}) {
  const propose = fond.propose
  return (
    <section className="flex flex-col gap-2">
      <Libelle>le fond</Libelle>
      <div className="flex flex-col gap-2 border-t border-trait pt-2">
        <div className="flex items-center gap-2">
          {/* ⚠️ **Le damier quand il n'y a pas de fond**, la même correction
              qu'au codex et pour la même raison : un `input type=color` n'a pas
              d'état vide, il portait donc une pastille magenta juste à côté des
              mots « aucun fond ». Le sélecteur reste dessous, transparent — sans
              lui, un appel sans fond ne pourrait plus en reprendre un. */}
          {fond.couleur ? (
            <input
              type="color"
              value={fond.couleur}
              aria-label="Couleur du fond, pour cette génération"
              onChange={(e) => onFond(e.target.value)}
              className="h-[26px] w-[34px] shrink-0 rounded-[2px] border border-trait bg-carte"
            />
          ) : (
            <span className="damier-papier relative h-[26px] w-[34px] shrink-0 overflow-hidden rounded-[2px] border border-trait">
              <input
                type="color"
                value={propose.couleur || "#FF00FF"}
                aria-label="Couleur du fond, pour cette génération"
                onChange={(e) => onFond(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
          )}
          <span className="mesure text-[10px] text-encre-3">
            {fond.couleur || "aucun fond — le modèle rendra ce qu'il voudra"}
          </span>
          {/* **Remettre celui du jeu, et retirer le fond, sont deux gestes** :
              l'un annule la correction, l'autre en est une. Les confondre aurait
              rendu « pas de fond pour cet essai » impossible à demander sur un
              jeu qui en a un. */}
          {fond.corrige && (
            <button
              type="button"
              onClick={() => onFond(null)}
              className="mesure h-[26px] text-[10px] text-encre-4 hover:text-encre"
            >
              Remettre celui du jeu
            </button>
          )}
          {!fond.corrige && fond.couleur !== "" && (
            <button
              type="button"
              onClick={() => onFond("")}
              className="mesure h-[26px] text-[10px] text-encre-4 hover:text-encre"
            >
              Sans fond
            </button>
          )}
        </div>

        {fond.corrige && (
          <Raison texte="corrigé pour cette génération seulement — le jeu garde le sien" />
        )}

        {/* **La proposition n'apparaît que si elle ajoute quelque chose** : la
            reproposer quand elle est déjà prise ferait cliquer sur ce qu'on a
            déjà. */}
        {propose.couleur && propose.couleur !== fond.couleur && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFond(propose.couleur)}
              style={{ background: propose.couleur }}
              aria-label={`Prendre ${propose.couleur}`}
              className="h-4 w-4 shrink-0 rounded-[2px] border border-trait"
            />
            <button
              type="button"
              onClick={() => onFond(propose.couleur)}
              className="mesure text-[10px] text-signal hover:opacity-70"
            >
              Prendre {propose.nom || propose.couleur}
            </button>
            <span className="mesure text-[10px] text-encre-4">
              à {propose.ecart} de {propose.voisine}
            </span>
          </div>
        )}

        {/* **Ce qui part dans l'autre champ**, mot pour mot et sans repli : il
            fait deux lignes, pas mille deux cents caractères. */}
        {fond.interdiction ? (
          <div className="flex flex-col gap-1">
            <span className="mesure text-[9.5px] tracking-[.11em] text-encre-4 uppercase">
              ce qui part en interdiction
            </span>
            <p className="mesure whitespace-pre-wrap rounded-[2px] border border-trait bg-carte p-2 text-[10.5px] leading-[1.45] text-encre-3">
              {fond.interdiction}
            </p>
          </div>
        ) : (
          <Raison texte="rien n'est interdit à ce modèle — pose un fond, et la couleur lui sera interdite sur le sujet" />
        )}
      </div>
    </section>
  )
}

/** Une chose qui part : son interrupteur, son nom, son texte, son origine.
 *
 *  **Toutes les lignes ont la même forme**, quel que soit ce qu'elles portent :
 *  c'est ce qui permet de descendre l'écran sans réapprendre à lire à chaque
 *  groupe. L'interrupteur est tout à gauche, donc tous alignés en colonne — on
 *  descend et on éteint, sans viser. */
function Ligne({
  ligne,
  onBasculer,
  onCorriger,
  onRemettre,
  onGarder,
}: {
  ligne: LigneQuiPart
  onBasculer: () => void
  onCorriger: (texte: string) => void
  onRemettre: () => void
  onGarder: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)
  // **Ce que le champ montre pendant qu'on écrit dedans** (M3).
  //
  // Il n'avait aucune mémoire à lui : sa valeur venait directement de la
  // dernière réponse du serveur. À chaque lettre, l'écran se redessinait
  // **avant** la réponse — donc avec le texte d'avant la lettre —, le navigateur
  // replaçait le curseur à la fin puisqu'on lui réécrivait le contenu d'un
  // champ, puis la réponse arrivait et le curseur repartait à la fin une seconde
  // fois. Deux sauts par lettre, et entre les deux un texte en retard d'une
  // frappe. Taper à la fin le masquait, la fin étant là où le curseur atterrit.
  //
  // Le brouillon fait donc autorité tant que le champ est ouvert, et il ne
  // remplace rien : la correction continue de partir dans le tri à chaque
  // lettre, c'est la *demande* qui attend que la frappe se pose. `null` veut
  // dire « rien tapé ici », et le champ montre alors ce que le serveur dit.
  const [brouillon, setBrouillon] = useState<string | null>(null)

  useEffect(() => {
    if (ouvert) champ.current?.focus()
  }, [ouvert])

  const remplacee = Boolean(ligne.remplacee_par)

  return (
    <li className="flex items-start gap-3 border-b border-trait py-2">
      {/* **Le carré, et aucun glyphe neuf.** Plein : cette chose part. Creux :
          elle ne part pas. Gris : elle part et ne se décoche pas. */}
      <button
        type="button"
        disabled={!ligne.eteignable}
        onClick={onBasculer}
        aria-pressed={ligne.allumee}
        aria-label={`${ligne.allumee ? "Éteindre" : "Allumer"} ${ligne.nom}`}
        title={
          ligne.eteignable
            ? ligne.allumee
              ? "cette chose part"
              : remplacee
                ? "remplacée par la ligne du dessous"
                : "cette chose ne part pas"
            : ligne.raison
        }
        className="mt-[3px] flex h-[9px] w-[9px] shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            !ligne.eteignable
              ? "border-encre-4 bg-encre-4"
              : ligne.allumee
                ? "border-signal bg-signal"
                : "border-contour",
          ].join(" ")}
        />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <div className="flex items-baseline gap-2">
          <span className="mesure text-[9.5px] uppercase tracking-[.11em] text-encre-4">
            {ligne.nom}
          </span>
          <span className="mesure text-[9.5px] text-encre-4">
            {ligne.corrigee ? "corrigé pour cette génération" : ligne.origine}
          </span>
          {remplacee && (
            <span className="mesure text-[9.5px] text-encre-4">remplacé ↓</span>
          )}
          {!ligne.eteignable && ligne.raison && (
            <span className="mesure text-[9.5px] text-encre-4">
              · {ligne.raison}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {ligne.corrigee && (
              <button
                type="button"
                onClick={() => {
                  // **Remettre efface le brouillon avec la correction.** Sans
                  // ça, le champ continuerait de montrer ce qu'on vient de
                  // reprendre alors que le texte qui part est revenu à
                  // l'original — le champ mentirait sur ce qui part.
                  setBrouillon(null)
                  onRemettre()
                }}
                className="mesure text-[10px] text-signal hover:opacity-70"
              >
                remettre
              </button>
            )}
            {/* **Garder est un second geste, écrit** — jamais un effet de
                bord. Il n'est proposé que là où il a une case où aller. */}
            {ligne.corrigee && ligne.gardable && (
              <button
                type="button"
                onClick={onGarder}
                className="mesure text-[10px] text-signal hover:opacity-70"
              >
                garder sur le sujet ›
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // Fermer le champ rend la main au serveur : la correction est
                // déjà dans le tri, et c'est lui qui dit désormais le texte.
                setBrouillon(null)
                setOuvert((o) => !o)
              }}
              className="mesure text-[10px] text-signal hover:opacity-70"
            >
              {ouvert ? "fermer" : "corriger"}
            </button>
          </span>
        </div>

        {ouvert ? (
          <textarea
            ref={champ}
            value={brouillon ?? ligne.texte}
            onChange={(e) => {
              setBrouillon(e.target.value)
              onCorriger(e.target.value)
            }}
            rows={2}
            aria-label={`Corriger ${ligne.nom}`}
            className="mesure min-h-[44px] resize-y rounded-[2px] border border-signal bg-carte px-2 py-1 text-[10.5px] leading-[1.45] text-encre"
          />
        ) : (
          <TexteQuiPart texte={ligne.texte} allumee={ligne.allumee} />
        )}

        {ligne.remplace && (
          <p className="mesure text-[9.5px] leading-4 text-encre-4 line-through">
            {ligne.remplace}
          </p>
        )}

        {/* **L'avertissement s'écrit sur la ligne fautive, pas en haut de
            l'écran.** Une bannière dirait « attention, deux problèmes » et
            laisserait chercher lesquels ; la ligne dit lequel, et le bouton pour
            le réparer est déjà à côté. */}
        {ligne.avertissement && (
          <p className="mesure text-[9.5px] leading-4 text-encre-attention">
            ⚠ {ligne.avertissement}
          </p>
        )}
      </div>
    </li>
  )
}

/** Le texte d'une ligne — **entier, jamais résumé, et replié quand il est long**
 *  (U9, 1ᵉʳ septembre 2026).
 *
 *  **L'invariant est amendé, et l'amendement est écrit.** La règle disait *mot
 *  pour mot, sans coupure et sans résumé — des points de suspension trahiraient
 *  la règle que cet écran existe pour tenir*. Elle tenait tant qu'un texte
 *  faisait quelques lignes ; le prompt réellement employé dans ce dépôt fait
 *  plus de mille deux cents caractères, et un écran qui doit se parcourir d'un
 *  coup d'œil avant de payer ne le fait pas quand une seule ligne occupe tout.
 *
 *  **Ce qui remplace la promesse est plus fort qu'elle** : *rien n'est résumé,
 *  rien n'est réécrit, et tout est atteignable en un clic depuis l'endroit où on
 *  le lit.* Le repli est visible, son bouton dit combien de caractères il cache,
 *  et il se referme. Ce n'est pas une troncature muette — c'est un pli qu'on
 *  ouvre. La phrase d'origine est réécrite aux trois endroits où elle vit : ici,
 *  dans `docs/carte-du-depot.md` et dans
 *  `docs/archive/maquettes-v2.1/08bis-ecran-de-confirmation.html`.
 */
const LONG = 320

function TexteQuiPart({ texte, allumee }: { texte: string; allumee: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const long = texte.length > LONG
  // **La coupure tombe sur une fin de mot**, jamais au milieu d'un : un pli qui
  // couperait « pixe » ferait douter de ce qu'il cache, et c'est exactement ce
  // que le pli ne doit pas faire.
  const coupe = long && !ouvert
  const debut = coupe
    ? texte.slice(0, texte.lastIndexOf(" ", LONG) > 0 ? texte.lastIndexOf(" ", LONG) : LONG)
    : texte

  return (
    <div className="flex flex-col gap-1">
      <p
        data-texte-qui-part
        className={[
          "mesure whitespace-pre-wrap text-[10.5px] leading-[1.45]",
          allumee ? "text-encre-3" : "text-encre-4 line-through",
        ].join(" ")}
      >
        {debut}
        {coupe && <span className="text-encre-4"> …</span>}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="mesure self-start text-[10px] text-signal hover:opacity-70"
        >
          {ouvert
            ? "replier"
            : `déplier — ${texte.length - debut.length} caractères de plus`}
        </button>
      )}
    </div>
  )
}

/** Une image jointe : son interrupteur, sa provenance, son prix.
 *
 *  **Le prix s'écrit sur la ligne où l'on coche**, en doré comme tout écart du
 *  produit. Une case éteinte le garde en gris : c'est ce qu'elle coûterait si on
 *  la rallumait. */
/**
 * Le texte envoyé à un style local (ML4, ML5) : **d'un bloc**, mot pour mot —
 * la même règle que pour un modèle distant (§ *Il ne montre pas un résumé*
 * en tête de ce fichier) —, avec ce qui a été retiré et pourquoi, et le
 * compte de jetons quand SDXL en tient un.
 */
function TexteLocalQuiPart({ local }: { local: NonNullable<import("../api-workflows").TexteLocal> }) {
  return <div className="space-y-[14px]">
    <p className="mesure whitespace-pre-wrap break-words rounded-7 border border-trait bg-papier p-[14px] text-[12px] leading-relaxed">{local.texte || "Aucun texte à envoyer."}</p>
    {local.limite !== null && <p className="text-[12px] text-encre-3" title={local.comptage}>{local.jetons} jeton{local.jetons > 1 ? "s" : ""} sur {local.limite} · {local.jetons > local.limite ? "au-delà, un second groupe est encodé à part et pèse moins" : "tient dans la tranche que ce moteur lit d’un coup"}</p>}
    {local.retires.length > 0 && <div><p className="text-[12px] font-medium">Ce qui n’est pas parti</p><ul className="mt-[4px] space-y-[4px]">{local.retires.map((r, i) => <li key={`${r.clef}-${i}`} className="text-[12px] text-encre-3">{r.nom || r.clef} — {r.raison}{r.texte && <span className="mesure block truncate text-encre-4">« {r.texte} »</span>}</li>)}</ul></div>}
  </div>
}

function LigneImage({
  image,
  places,
  onBasculer,
}: {
  image: ImageQuiPart
  /** Combien d'images ce modèle prend. **Zéro est un cas à part** (F6), et il
   *  a besoin d'autres mots : « au-delà des places du modèle » suppose qu'il y
   *  en a, et laisse croire qu'en décocher deux ferait passer la troisième. */
  places: number
  onBasculer: () => void
}) {
  // **Ce que l'image montre, et le geste qui l'ouvre en grand** (U9). L'écran
  // qui décide de ce qui part ne montrait aucune image : les références y
  // étaient des lignes de texte avec un prix. La barre d'espace ouvre celle que
  // le pointeur vise — le geste de l'aperçu, celui qui existe déjà partout
  // ailleurs dans le produit et qui n'a jamais de bouton pour l'annoncer.
  const sujet =
    image.montre?.sorte === "asset"
      ? sujetAsset(image.montre.asset)
      : image.montre?.sorte === "carte"
        ? sujetCarte(image.montre.carte)
        : null
  const visee = useVisee(sujet)
  const vignette =
    image.montre?.sorte === "asset"
      ? vignetteAsset(image.montre.asset, 128)
      : (sujet?.src ?? "")

  return (
    <li
      className="flex flex-col gap-1 border-b border-trait py-2"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBasculer}
        aria-pressed={image.cochee}
        aria-label={`${image.cochee ? "Décocher" : "Cocher"} ${image.provenance}`}
        className="flex h-[9px] w-[9px] shrink-0 items-center justify-center"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            image.cochee ? "border-signal bg-signal" : "border-contour",
          ].join(" ")}
        />
      </button>
      {/* **La vignette est le sujet de la ligne**, pas une décoration : c'est
          elle qu'on regarde pour décider de décocher. Une image décochée est
          grisée comme son prix — elle dit ce qui *ne* partira pas. */}
      <span
        data-vignette-jointe
        className={[
          "damier-papier h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[1px] border border-trait",
          image.cochee ? "" : "opacity-40",
        ].join(" ")}
      >
        {vignette && (
          <img
            src={vignette}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </span>
      {/* **Le numéro que le texte lui donne** (R7). Le prompt dit « Image 3 —
          STYLE REFERENCE » ; sans ce chiffre-là sur la ligne, on lit un texte
          qui parle d'images et on regarde une liste qui ne les numérote pas.
          Une image qui ne part pas n'en a pas — elle n'en a pas dans le texte
          non plus —, et la colonne garde sa largeur pour que les noms restent
          alignés. */}
      <span className="mesure w-[46px] shrink-0 text-[10px] text-encre-4">
        {image.rang === null ? "" : `Image ${image.rang}`}
      </span>
      <span className="mesure min-w-0 flex-1 truncate text-[10px] text-encre-3">
        {image.provenance}
        {image.ecartee_par && (
          <span className="text-encre-4"> · {image.ecartee_par}</span>
        )}
        {image.hors_plafond && (
          <span className="text-encre-attention">
            {" · "}
            {places > 0
              ? "au-delà des places du modèle"
              : "ce modèle n'en prend aucune"}
          </span>
        )}
      </span>
      {image.prix !== null && (
        <span
          className={[
            "mesure text-[10px]",
            image.cochee ? "text-encre-attention" : "text-encre-4",
          ].join(" ")}
        >
          +{dollars(image.prix)}
        </span>
      )}
      </div>
      {/* **Ce que le texte dit d'elle, sous elle** (M4) — recopié tel qu'il
          part, jamais traduit. La légende est du texte qui va au modèle : elle
          se lit en entier plus haut, dans l'ordre où elle est assemblée, et
          l'écran promet de montrer ce qui part mot pour mot. La déménager
          romprait la promesse ; la traduire ferait un second texte à tenir
          d'accord avec le premier. */}
      {image.legende && <Legende texte={image.legende} />}
    </li>
  )
}

/** Ce que le texte qui part dit d'une image, **posé sous elle**.
 *
 *  Écrit une fois parce que les deux sortes de lignes en portent une — les
 *  images qu'on coche et la planche qu'on ne coche pas — et que deux copies
 *  auraient divergé au premier changement de gris. */
function Legende({ texte }: { texte: string }) {
  return (
    <p className="mesure pl-[58px] text-[9.5px] leading-4 text-encre-4">
      {texte}
    </p>
  )
}

/** **L'image que la planche joint, et laquelle des deux c'est** (M4).
 *
 *  Elle vivait en paragraphe sous la liste : sans vignette, sans moyen de
 *  l'ouvrir en grand, et **nommée par le plus ancien des deux cas**. L'écran
 *  annonçait *un gabarit de grille où poser les sujets* pendant que le texte
 *  qui part, à quelques centimètres de là, demandait de *garder la planche et
 *  de n'y changer que ce qu'on demande* — deux demandes opposées pour une seule
 *  image, au moment précis où l'on décide de payer.
 *
 *  **Une ligne sans case, et pas une case grisée.** La décision d'origine ne
 *  bouge pas — la décocher reviendrait à demander une planche sans dire à quoi
 *  elle ressemble —, mais une case grisée aurait demandé de comprendre pourquoi
 *  elle l'est. Une ligne sans case dit qu'il n'y a rien à décider, et la raison
 *  est écrite à côté. La colonne de la case reste vide pour que les vignettes
 *  restent alignées avec celles du dessus. */
function LigneJointe({
  jointe,
  adresse,
}: {
  jointe: PlancheQuiPart
  adresse: string | null
}) {
  // **Le même geste que sur les autres images** : la barre d'espace ouvre en
  // grand ce que le pointeur vise. Elle se redessine du geste et ne se range
  // nulle part — pas d'empreinte, donc pas de dimensions connues, et l'aperçu
  // se tait alors sur le facteur, comme pour toute image qu'on n'a pas mesurée.
  const sujet = adresse
    ? {
        cle: adresse,
        src: adresse,
        titre: jointe.nom,
        largeur: 0,
        hauteur: 0,
        pixelise: true,
      }
    : null
  const visee = useVisee(sujet)

  return (
    <li
      className="flex flex-col gap-1 border-b border-trait py-2"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-[9px] w-[9px] shrink-0" />
        <span
          data-vignette-jointe
          data-planche-jointe
          className="damier-papier h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[1px] border border-trait"
        >
          {adresse && (
            <img
              src={adresse}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          )}
        </span>
        <span className="mesure w-[46px] shrink-0 text-[10px] text-encre-4">
          Image {jointe.rang}
        </span>
        <span className="mesure min-w-0 flex-1 text-[10px] text-encre-3">
          {jointe.nom}
          <span className="text-encre-4"> · {jointe.raison}</span>
        </span>
        {jointe.prix !== null && (
          <span className="mesure text-[10px] text-encre-attention">
            +{dollars(jointe.prix)}
          </span>
        )}
      </div>
      {jointe.legende && <Legende texte={jointe.legende} />}
    </li>
  )
}

/** Une option du modèle. **Grisée avec sa raison quand il ne sait pas la
 *  faire**, jamais absente : l'absence n'apprend rien, le grisé apprend
 *  pourquoi. */
function LigneOption({
  option,
  onBasculer,
}: {
  option: OptionQuiPart
  onBasculer: () => void
}) {
  return (
    <li
      className={[
        "flex items-start gap-3 border-b py-2",
        option.refus ? "border-dashed border-trait" : "border-trait",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={Boolean(option.refus)}
        onClick={onBasculer}
        aria-pressed={option.allumee}
        aria-label={`${option.allumee ? "Décocher" : "Cocher"} ${option.nom}`}
        className="mt-[3px] flex h-[9px] w-[9px] shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            option.refus
              ? "border-encre-4"
              : option.allumee
                ? "border-signal bg-signal"
                : "border-contour",
          ].join(" ")}
        />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <div className="flex items-baseline gap-2">
          <span className="mesure text-[9.5px] uppercase tracking-[.11em] text-encre-4">
            {option.nom}
          </span>
          <span className="mesure text-[9.5px] text-encre-4">
            {option.detail}
          </span>
        </div>
        <p className="mesure text-[10.5px] leading-[1.45] text-encre-3">
          {option.texte}
        </p>
        {option.refus && <Raison texte={`indisponible : ${option.refus}`} />}
      </div>
    </li>
  )
}
