/** Fiche de l’asset : résumé compact, résultats et réglages sur demande. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, Refus, type Collection, type Echelle, type GroupeDeRangement, type Asset, type Personnage, type Piece, type Pose, type Role, type EmplacementCorps, type Univers, type VestiaireDuJeu, type Generation } from "../api"
import type { Fente } from "./EnTeteDeSurface"
import { portraitDe } from "./FicheChose"
import { EcranEtabli } from "./EtabliDuSujet"
import { ImagesDuSujet } from "./ImagesDuSujet"
import { AnimationsDuSujet } from "./AnimationsDuSujet"
import { EssaiDuSujet } from "./EssaiDuSujet"
import { VestiaireDuSujet } from "./VestiaireDuSujet"
import { TenuesDuSujet } from "./TenuesDuSujet"
import { ObjectifDuSujet } from "./ObjectifDuSujet"
import { SourcesDuSujet } from "./SourcesDuSujet"
import { EnAttenteDuSujet } from "./EnAttenteDuSujet"
import { ImporterIntelligemment } from "./ImporterIntelligemment"
import { FicheDuSujet } from "./FicheDuSujet"
import { useScrollDuParcours } from "./MemoireDuParcours"

export type Onglet = "fiche" | "images" | "animations" | "sources" | "attente" | "equipement" | "objectif" | "essai"
// **« Pas encore rangé » est entre les sources et l'équipement, et sa place dit
// ce qu'il est** (`AU20`) : le dernier des trois onglets qui montrent *ce qui
// existe pour ce sujet*, avant ceux qui décrivent ce qu'il doit devenir. Les
// trois premiers montrent des cases pleines ; celui-ci montre ce qui n'a pas
// encore de case, et sans lui ce qui n'est rangé nulle part n'est nulle part.
const ONGLETS: readonly { clef: Onglet; nom: string }[] = [
  { clef: "animations", nom: "Animations" },
  { clef: "images", nom: "Images fixes" },
  { clef: "sources", nom: "Sources & clips" },
  { clef: "attente", nom: "Pas encore rangé" },
  { clef: "equipement", nom: "Équipement" },
  { clef: "objectif", nom: "Objectif & règles" },
]
type CeQueLaFicheLit = { bareme: Echelle[]; siennes: Collection[] | null; groupes: GroupeDeRangement[] }
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const ongletInitial = (s: Personnage): Onglet => s.objectif
  ? s.objectif.sorties.some(o => o.nature === "animation" && o.quantite > 0) ? "animations" : "images"
  : s.cases.some(c => c.bandes?.length) || s.famille === "personnages" ? "animations" : "images"

export function PageDuSujet(proprietes: {
  ouvert: Personnage
  plan: Pose[]
  /** Tous les sujets du jeu — **pour en poser un à côté dans l'essai** (`B12`)
   *  et comparer les tailles en mouvement. Ils sont déjà chargés un cran
   *  au-dessus ; un appel de plus pour les relire ferait deux vérités. */
  personnages: Personnage[]
  /** Les règles du jeu, pour la case et la couleur de fond de la scène de
   *  l'essai (`B12`) — la même prop que `GrilleDuJeu` et `Comparer` reçoivent. */
  univers: Univers
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    directions?: string[] | null,
  ) => void
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  dossierJeu: string
  onFente: (fente: Fente) => void
  barreQuiPaie: ReactNode
  onOuvrirCase: (identifiant: string) => void
  onMonterLaBande: (clip: string) => void
  onOuvrirLaBande: (bande: string) => void
  onSuperposition: (identifiant: string) => void
  onSupprimer: (identifiants: string[]) => void
  /** Les deux rôles que la fiche d'une image porte (`C4`) : renvoyer l'image au
   *  générateur, et reprendre les réglages de sa génération. Ils traversent
   *  cette page parce que la fiche est montée dans *Ses images* depuis que le
   *  produit n'a plus qu'un seul volet de fiche d'image. */
  onReinjecter: (asset: string, role: Role) => void
  onReglages: (asset: Asset) => void
  /** Ouvre la grille du jeu pour ce sujet (`B13`) — une profondeur de plus de
   *  cette page, comme la matrice. */
  onGrille: () => void
  /** Et comparer, à côté — la même profondeur, l'autre écran. */
  onComparer: () => void
  /** Le vestiaire résolu du jeu (`B19`), ou `null` tant qu'on ne l'a pas lu.
   *  La fiche montre ce que **ce sujet-là** porte, jamais l'équipement du jeu
   *  entier — c'est le troisième grief que la tranche lève. */
  vestiaire: VestiaireDuJeu | null
  /** Ouvrir la page d'une pièce. */
  onPiece: (piece: string) => void
  onEmploiEquipement?: (piece: string, emploi: string, cible?: import("../api-calques").CibleCalque, variante?: string) => void
  /** Nommer une pièce **que ce sujet porte** — elle lui est attribuée
   *  d'emblée, en un seul aller-retour. */
  onCreerPiece: (nom: string) => void
  /** Il ne la porte plus. **Ses calques restent** — jamais de cascade. */
  onRetirerLEmploi: (piece: string, emploi: string) => void
  /** **La chaîne de retouche redessinée** (B16) — sur **l'image qu'on
   *  regarde** (`B25`), c'est-à-dire celle du volet de *Ses images*, et sur la
   *  référence du sujet seulement quand on n'en regarde aucune. Le bandeau
   *  prenait la référence dans tous les cas : c'était juste tant qu'il existait
   *  une seconde porte par image, et ce ne l'est plus depuis qu'il n'y en a
   *  qu'une. Optionnelle : la page se rend sans, et le bouton se grise alors
   *  comme les deux autres. */
  onRetoucher?: (regardee: string | null) => void
  /** **L'onglet ouvert, tenu un cran au-dessus** (`B25`).
   *
   *  Un onglet n'est pas un lieu — `lieux.ts` le dit, et il ne s'écrit pas dans
   *  la pile. Mais la retouche se monte maintenant **à la place** de cette page
   *  au lieu de s'ouvrir en volet dedans : sans ce relais, ouvrir une image de
   *  *Ses images* puis remonter d'un cran ramenait sur *Sa fiche*, et non là
   *  d'où l'on venait. Optionnel : sans lui, la page tient son onglet
   *  elle-même, comme avant. */
  onglet?: Onglet
  onOnglet?: (onglet: Onglet) => void
  /** **La matrice ouverte, tenue au même endroit que l'onglet** (`B25`) — et
   *  pour la même raison : la superposition d'un calque s'ouvre depuis elle, et
   *  remonter d'un cran y revient. */
  matrice?: boolean
  onMatriceOuverte?: (ouverte: boolean) => void
  /** **La colonne ouverte de la matrice, et le panneau d'un calque, tenus au
   *  même endroit** (`B27`) — le défaut laissé en aparté par `B25` : ces deux
   *  états vivaient dans `EcranEtabli`, que la retouche démonte en prenant sa
   *  place, si bien que remonter d'un cran depuis *la différence* d'un calque
   *  ramenait sur la matrice, colonne au corps, panneau fermé. Optionnels :
   *  sans eux, `EcranEtabli` les tient elle-même, comme avant. */
  colonne?: string | null
  onColonne?: (identifiant: string | null) => void
  calque?: string | null
  onCalque?: (identifiant: string | null) => void
  clips?: readonly Generation[]
  /** Une vidéo vient d'entrer : la liste des clips est à relire. */
  onClipsChange?: () => void
  onObjectifChange?: () => void
  onLivrer?: () => void
  onFabriquer?: () => void
  /** **Une case peut être visée** : ouvert depuis une rangée vide d'*Images
   *  fixes*, l'import arrive pointé sur cette pose-là. Sans cible, il s'ouvre
   *  sur la première pose du sujet, comme le bouton du haut. */
  onImporter?: (cible?: { pose: string; direction?: string }) => void
  onDecouper?: (asset: string) => void
  onExtraire?: (asset: string) => void
}) {
  const { ouvert, plan, onFente } = proprietes
  const [ongletTenuIci, setOngletTenuIci] = useState<Onglet>(() => ongletInitial(ouvert))
  const choixOnglet = proprietes.onglet ?? ongletTenuIci
  // L’ancien état « fiche » se relit sans réinstaller son formulaire permanent.
  const onglet = choixOnglet === "fiche" ? ongletInitial(ouvert) : choixOnglet
  const setOnglet = (choisi: Onglet) => {
    setOngletTenuIci(choisi)
    proprietes.onOnglet?.(choisi)
  }
  // **La position du défilement se retient ici**, parce que c'est ici qu'on
  // défile depuis qu'il n'y a plus qu'un bloc. Une position par onglet et par
  // sujet : revenir d'une retouche rend la page où on l'avait laissée.
  const defilement = useScrollDuParcours(`${onglet}:${ouvert.projet}:${ouvert.identifiant}`)
  // **B13** — la grille du jeu et comparer n'ont rien à montrer sans une
  // image. Les deux liens se grisent avec leur raison plutôt que de
  // disparaître, comme partout ailleurs dans ce fichier.
  const auMoinsUneImage = ouvert.cases.some((c) => c.images.length > 0)
  // La matrice, profondeur suivante de cette page — voir l'en-tête du fichier.
  const [matriceTenueIci, setMatriceTenueIci] = useState(false)
  const matriceOuverte = proprietes.matrice ?? matriceTenueIci
  const setMatriceOuverte = (ouverte: boolean) => {
    setMatriceTenueIci(ouverte)
    proprietes.onMatriceOuverte?.(ouverte)
  }
  // **La colonne de la matrice, et le panneau d'un calque — même relais, même
  // raison** (`B27`) : sans lui, ouvrir *la différence* d'un calque puis
  // remonter d'un cran ramenait sur la matrice, colonne au corps, panneau
  // fermé.
  const [colonneTenueIci, setColonneTenueIci] = useState<string | null>(null)
  const colonne = proprietes.colonne ?? colonneTenueIci
  const setColonne = (identifiant: string | null) => {
    setColonneTenueIci(identifiant)
    proprietes.onColonne?.(identifiant)
  }
  const [calqueTenuIci, setCalqueTenuIci] = useState<string | null>(null)
  const calque = proprietes.calque ?? calqueTenuIci
  const setCalque = (identifiant: string | null) => {
    setCalqueTenuIci(identifiant)
    proprietes.onCalque?.(identifiant)
  }
  /** L'image qu'on regarde dans *Ses images* — celle du volet (`B25`). Elle
   *  monte jusqu'ici parce que le bouton *La retouche ›* vit dans le bandeau,
   *  au-dessus des onglets, et qu'il n'a aucun autre moyen de savoir laquelle
   *  des douze est sous les yeux. `null` tant qu'on n'a pas ouvert l'onglet :
   *  le bandeau se rabat alors sur la référence du sujet. */
  const [regardee, setRegardee] = useState<string | null>(null)
  const [lu, setLu] = useState<CeQueLaFicheLit>({
    bareme: [],
    siennes: null,
    groupes: [],
  })
  const [range, setRange] = useState(0)

  // Changer de sujet rend la fiche et referme la matrice : les onglets décrivent
  // celui qu'on regardait, et rester sur « Ses images » du précédent ferait
  // croire qu'on regarde encore les siennes.
  // ⚠️ **Elle ne prévient pas le cran du dessus** : cet effet se rejoue à chaque
  // montage, et la page se remonte au retour de la retouche. Le lui dire
  // écraserait justement l'onglet qu'on cherche à retrouver. Celui qui tient
  // l'onglet pour nous tient aussi son remise à zéro, sur le même sujet ouvert.
  useEffect(() => {
    setOngletTenuIci(ongletInitial(ouvert))
    setMatriceTenueIci(false)
    setColonneTenueIci(null)
    setCalqueTenuIci(null)
    setRegardee(null)
  }, [ouvert.identifiant])

  // **Le barème du jeu, pour l'occupation de sa nature.** Lu une fois pour la
  // vie de la page : il ne change pas pendant qu'on regarde un sujet.
  useEffect(() => {
    let vivant = true
    void api
      .univers()
      .then((recu) => vivant && setLu((avant) => ({ ...avant, bareme: recu?.univers?.bareme ?? [] })))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  // **Les collections de ce sujet, et il faut aller les chercher loin.** Aucune
  // route ne dit « dans quelles collections est ce sujet » : la seule qui le
  // sache est celle de sa famille (B9), et elle répond par une page de sujets.
  // On l'interroge donc sur son nom, et on s'y retrouve par son identifiant.
  // Introuvable, la fiche ne ment pas — elle dit où l'on range.
  useEffect(() => {
    let vivant = true
    setLu((avant) => ({ ...avant, siennes: null, groupes: [] }))
    void api
      .familleDeSujets(ouvert.famille, { recherche: ouvert.nom })
      .then((recu) => {
        if (!vivant) return
        const sien = (recu?.personnages ?? []).find(
          (s) => s.identifiant === ouvert.identifiant,
        )
        setLu((avant) => ({
          ...avant,
          siennes: sien ? (sien.collections as Collection[]) : null,
          groupes: recu?.groupes ?? [],
        }))
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [ouvert.identifiant, ouvert.nom, ouvert.famille, range])

  const echouer = useCallback(
    (erreur: unknown, defaut: string) =>
      onFente({
        ton: "echec",
        texte: erreur instanceof Refus || erreur instanceof Error ? erreur.message : defaut,
      }),
    [onFente],
  )

  const sienPlan = ouvert.plan ?? plan
  const portrait = useMemo(() => portraitDe(ouvert, sienPlan), [ouvert, sienPlan])
  const imageCible = regardee ?? portrait?.asset.identifiant ?? null

  // **La matrice prend toute la page, la barre qui paie comprise** : elle est
  // l'un des deux lieux d'où l'argent part, et la lui retirer aurait obligé à
  // remonter d'un cran pour dépenser.
  if (matriceOuverte)
    return (
      <div data-etabli className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier">
        <div className="flex items-center gap-[8px] border-b border-trait bg-papier-cote px-[30px] py-[8px]">
          <button
            type="button"
            onClick={() => setMatriceOuverte(false)}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            ‹ {proprietes.ouvert.nom}
          </button>
          <span className="text-[12.5px] text-encre-3">
            Ses cases — le vestiaire, les planches, le calibrage et les animations
            vivent encore ici.
          </span>
        </div>
        <EcranEtabli
          {...proprietes}
          colonne={colonne}
          onColonne={setColonne}
          calque={calque}
          onCalque={setCalque}
        />
      </div>
    )

  return (
    <main data-etabli data-page-du-sujet aria-label={`La page de ${ouvert.nom}`} className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier">
      {/* **Un seul défilement pour toute la page** — le titre, la fiche, les
          onglets et la liste descendent ensemble. Avant, le haut restait figé
          et seule la liste bougeait : on lisait ses animations par une fente de
          quatre cents pixels. Les onglets sont donc de simples blocs en flux,
          sans hauteur à eux, et c'est ce conteneur-ci qui garde la position. */}
      <div {...defilement} className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[30px] pt-[22px] pb-[22px]">
        <header className="flex shrink-0 items-start justify-between gap-[22px]">
          <div><h1 className="font-serif text-[38px] leading-[1.05] text-encre">{ouvert.nom}</h1><p className="mt-[8px] text-[13px] text-encre-3">{ouvert.type || ouvert.famille} · {ouvert.objectif ? ouvert.objectif.sorties.some(s => s.nature === "animation" && s.quantite > 0) ? ouvert.objectif.sorties.some(s => s.nature === "image" && s.quantite > 0) ? "Images & animations" : "Animations" : "Images fixes" : "Images & animations"}</p></div>
          <div className="flex shrink-0 flex-wrap items-center gap-[8px]">
            {/* **Deux boutons, et la ligne entre eux est claire** (`AU21`) :
                *Importer…* prend un fichier qu'on a déjà et **devine ce que
                c'est** — vidéo, planche, image —, *Fabriquer…* commande au
                fournisseur et coûte de l'argent.

                Le découpage d'avant passait par la question *quel mouvement,
                quelle direction ?* posée à tout le monde, y compris pour une
                vidéo — à qui ça ne veut rien dire : une vidéo devient un clip,
                et c'est la bande qu'on y taille qui se range sur un mouvement.
                Une question qui n'a pas de sens pour un tiers des cas n'est pas
                une question, c'est un péage. */}
            <ImporterIntelligemment personnage={ouvert} classe={BOUTON}
              onDecouper={proprietes.onDecouper} onMonter={proprietes.onMonterLaBande}
              onChange={() => { setRange(n => n + 1); proprietes.onClipsChange?.() }} onErreur={echouer} />
            <button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal" onClick={() => {
              if (proprietes.onFabriquer) proprietes.onFabriquer()
              else { const pose = sienPlan.find(p => !ouvert.ecartees.includes(p.identifiant)); if (pose) onglet === "animations" ? proprietes.onAnimer(ouvert, pose) : proprietes.onArmer(ouvert, [pose]); else setOnglet("objectif") }
            }}>Fabriquer…</button>
            {proprietes.onLivrer && <button className={BOUTON} onClick={proprietes.onLivrer}>Livrer…</button>}
          </div>
        </header>

        <FicheDuSujet personnage={ouvert} plan={sienPlan} collections={lu.siennes} groupes={lu.groupes}
          onRange={() => setRange(n => n + 1)} onPersonnage={proprietes.onPersonnage} onErreur={echouer}
          onImages={() => setOnglet("images")} onObjectif={() => setOnglet("objectif")} />

        <nav role="tablist" aria-label="La page du sujet" className="flex shrink-0 flex-wrap gap-[4px] border-b border-trait pb-[8px]">
          {ONGLETS.filter(({ clef }) => clef !== "equipement" || ouvert.equipable).map(({ clef, nom }) => <button key={clef} type="button" role="tab" aria-selected={onglet === clef} onClick={() => setOnglet(clef)} className={`h-[34px] rounded-7 px-[14px] text-[13px] transition-colors duration-120 ${onglet === clef ? "bg-encre text-papier" : "text-encre-3 hover:bg-papier-cote hover:text-encre"}`}>{nom}</button>)}
        </nav>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-[14px]">
          <div className="flex items-center gap-[8px]">
            {proprietes.onDecouper && <button className={BOUTON} disabled={!imageCible} title={imageCible ? undefined : "Choisissez une image dans Images fixes."} onClick={() => imageCible && proprietes.onDecouper?.(imageCible)}>Découper une image</button>}
            {proprietes.onExtraire && <button className={BOUTON} disabled={!imageCible} title={imageCible ? undefined : "Choisissez une image dans Images fixes."} onClick={() => imageCible && proprietes.onExtraire?.(imageCible)}>Extraire un élément</button>}
            {onglet === "animations" && <button className={BOUTON} onClick={() => setOnglet("essai")}>Tester les animations</button>}
            {onglet === "essai" && <button className={BOUTON} onClick={() => setOnglet("animations")}>‹ Animations</button>}
          </div>
          <details className="relative">
            <summary className={`${BOUTON} flex cursor-pointer items-center`}>Autres outils</summary>
            <div className="absolute right-0 z-20 mt-[8px] flex w-[300px] flex-col gap-[8px] rounded-8 border border-contour bg-carte p-[14px]">
              <button className={BOUTON} onClick={proprietes.onGrille} disabled={!auMoinsUneImage} title={!auMoinsUneImage ? "Aucune image encore à poser sur la grille." : undefined}>Voir la grille du jeu</button>
              <button className={BOUTON} onClick={proprietes.onComparer} disabled={!auMoinsUneImage} title={!auMoinsUneImage ? "Aucune image encore à comparer." : undefined}>Comparer</button>
              <button className={BOUTON} disabled={!auMoinsUneImage || !proprietes.onRetoucher} onClick={() => proprietes.onRetoucher?.(regardee)}>Retoucher l’image</button>
              <button data-porte-de-la-matrice className={BOUTON} onClick={() => setMatriceOuverte(true)}>Cases, planches et calibrage</button>
            </div>
          </details>
        </div>

        {onglet === "images" && <ImagesDuSujet personnage={ouvert} plan={sienPlan} pieces={proprietes.pieces} personnages={proprietes.personnages}
          univers={proprietes.univers} onArmer={proprietes.onArmer} onOuvrirCase={proprietes.onOuvrirCase} onRegardee={setRegardee}
          onImporter={proprietes.onImporter}
          onEcarter={proprietes.onSupprimer} onReinjecter={proprietes.onReinjecter} onReglages={proprietes.onReglages} onErreur={echouer} />}

        {onglet === "animations" && <AnimationsDuSujet personnage={ouvert} plan={sienPlan} onAnimer={proprietes.onAnimer}
          onOuvrirLaBande={proprietes.onOuvrirLaBande} onErreur={echouer} />}

        {onglet === "essai" && <EssaiDuSujet personnage={ouvert} personnages={proprietes.personnages} plan={sienPlan} univers={proprietes.univers}
          onAnimer={proprietes.onAnimer} onAnimations={() => setOnglet("animations")} />}

        {onglet === "sources" && <SourcesDuSujet onBande={proprietes.onOuvrirLaBande} personnage={ouvert} clips={proprietes.clips ?? []}
          onClipsChange={proprietes.onClipsChange} onErreur={echouer}
          onMontage={proprietes.onMonterLaBande} onAnimer={(pose, direction) => proprietes.onAnimer(ouvert, pose, direction)} />}
        {onglet === "attente" && <EnAttenteDuSujet personnage={ouvert} plan={sienPlan}
          onOuvrir={proprietes.onOuvrirCase}
          onChange={() => setRange(n => n + 1)} onErreur={echouer} />}
        {onglet === "equipement" && <div><VestiaireDuSujet personnage={ouvert}
          vestiaire={proprietes.vestiaire} onPiece={proprietes.onPiece} onEmploi={proprietes.onEmploiEquipement} onCreerPiece={proprietes.onCreerPiece}
          onRetirerLEmploi={proprietes.onRetirerLEmploi} /><TenuesDuSujet personnage={ouvert} vestiaire={proprietes.vestiaire} onEmploi={proprietes.onEmploiEquipement} onLivraisons={proprietes.onLivrer} /></div>}
        {onglet === "objectif" && <div><ObjectifDuSujet personnage={ouvert} projet={ouvert.projet} onChange={proprietes.onObjectifChange} /></div>}
      </div>
    </main>
  )
}
