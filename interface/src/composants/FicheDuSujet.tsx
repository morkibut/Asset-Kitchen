/** Fiche du sujet : résumé compact, et tous ses réglages sur demande (RP8).
 *
 *  **Une seule fiche, là où il y en avait deux.** Une fiche courte s'ouvrait
 *  avec la page du sujet — nom, description, collections — et une fiche
 *  longue vivait trois clics plus loin, sous un menu qui parle de calibrage :
 *  elle seule réglait le signalement, les sept textes de style et les images
 *  de référence — trois réglages qui partent pourtant dans chaque demande
 *  d'image. Cette fiche-ci porte les deux : le résumé s'ouvre avec le sujet,
 *  et « Modifier la fiche » tient tout ce que les deux savaient.
 *
 *  **Ce qui n'a pas suivi, et pourquoi.** La fiche longue montrait aussi
 *  « ce que le jeu réclame » et « ce qui est fait », pose par pose : c'est
 *  exactement l'onglet *Objectif & règles* et les onglets *Images fixes* /
 *  *Animations* de la même page, à un clic d'ici plutôt qu'enterrés sous
 *  *Cases, planches et calibrage*. Les redire ici aurait fait deux endroits à
 *  tenir d'accord pour la même information. Le calibrage et la vitrine, eux,
 *  restent à leur place : la matrice les porte déjà en gestes directs, sans
 *  passer par une fiche.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  api,
  CE_QU_ON_PREND,
  NOM_CHAMP,
  NOM_DE_CE_QU_ON_PREND,
  type AmbianceDuJeu,
  type PosesDesTypes,
  type Asset,
  type Case,
  type ChampHabille,
  type Collection,
  type GroupeDeRangement,
  type Habillage,
  type ObjectifDuPersonnage,
  type Personnage,
  type Pose,
  type ReferenceDeLaChose,
  type ReferencesDeLaChose,
  type StyleDeCombat,
  type StyleDuPersonnage,
} from "../api"
import { BandeQuiTourne, sujetAsset, sujetCarte, useVisee, vignetteAsset } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"
import { EnTeteDeSection } from "./pieces"
import { naturesChoisissables } from "../natures"

const BOUTON = "h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"

/** Ce que la chose a de fait — les poses que ce sujet tient, et celles qu'il a
 *  rangées, comptées à côté. Repris de la fiche longue, où c'était déjà
 *  l'unique définition du compte : la matrice s'y accorde. */
export function comptes(personnage: Personnage, plan: Pose[]) {
  const cases: Record<string, Case> = Object.fromEntries(
    personnage.cases.map((c) => [c.pose, c]),
  )
  const tenues = plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const faites = tenues.filter((p) => {
    const sienne = cases[p.identifiant]
    return (sienne?.images.length ?? 0) >= (sienne?.demandees ?? p.images)
  }).length
  return { cases, tenues, faites, rangees: plan.length - tenues.length }
}

/** Le portrait de la chose — **pris parmi ses images déjà faites**.
 *
 *  *« celle qu'on a marquée comme préférée, sinon la plus récente »* : la
 *  règle que le produit emploie déjà pour désigner le corps qui part en
 *  planche d'équipement, reprise telle quelle.
 *
 *  **Depuis RP19, l'auteur peut le choisir** : `image_de_reference` désigne
 *  une image fixe du sujet, et elle passe devant. Le choix est cherché parmi
 *  les images que la fiche a déjà sous la main — une image supprimée,
 *  écartée ou rattachée ailleurs ne s'y trouve plus, et la règle du dessous
 *  reprend la main sans erreur et sans rien demander. */
export function portraitDe(personnage: Personnage, plan: Pose[]): {
  asset: Asset
  pose: string
} | null {
  const { cases, tenues } = comptes(personnage, plan)
  if (personnage.image_de_reference)
    for (const pose of tenues) {
      const choisie = (cases[pose.identifiant]?.images ?? []).find(
        (i) => i.identifiant === personnage.image_de_reference,
      )
      if (choisie) return { asset: choisie, pose: pose.nom }
    }
  for (const pose of tenues) {
    const images = cases[pose.identifiant]?.images ?? []
    if (!images.length) continue
    const favori = images.find((i) => i.favori)
    const recente = images.reduce((a, b) => (b.cree_le > a.cree_le ? b : a))
    return { asset: favori ?? recente, pose: pose.nom }
  }
  return null
}

/** Résumé toujours visible ; les réglages n'apparaissent qu'à la demande. */
export function FicheDuSujet({ personnage, plan, collections, groupes, onRange, onPersonnage, onErreur, onImages, onObjectif }: {
  personnage: Personnage; plan: Pose[]; collections: Collection[] | null; groupes: GroupeDeRangement[];
  onRange: () => void; onPersonnage: (p: Personnage & { supprime?: boolean }) => void; onErreur: (e: unknown, defaut: string) => void;
  onImages: () => void; onObjectif: () => void;
}) {
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(personnage.nom)
  const [description, setDescription] = useState(personnage.description)
  const [objectif, setObjectif] = useState<ObjectifDuPersonnage | null>(null)
  // **Les deux réglages que seule la fiche longue portait** (RP8) : ils ne se
  // lisent qu'une fois la fiche ouverte, comme le reste de ce dialogue.
  const [habillage, setHabillage] = useState<Habillage | null>(null)
  const [references, setReferences] = useState<ReferencesDeLaChose | null>(null)
  // **Son style de combat** (SC4, 18 septembre 2026) — seuls les personnages
  // se battent : un décor ou un objet n'a rien à choisir ici.
  const [styleDuPersonnage, setStyleDuPersonnage] = useState<StyleDuPersonnage | null>(null)
  const [catalogueStyles, setCatalogueStyles] = useState<StyleDeCombat[]>([])
  // **Type d'objet et ambiance** (16 septembre 2026), venus de l'ancien écran
  // « Ses cases ». Chacun s'écrit dès qu'on le change, comme là-bas.
  const [types, setTypes] = useState<PosesDesTypes["types"]>([])
  const [ambiances, setAmbiances] = useState<AmbianceDuJeu[]>([])
  // **La recette de ses images** (RS6, 18 septembre 2026) : les recettes
  // nommées se lisent à l'ouverture de la fiche, comme les types.
  const [nommees, setNommees] = useState<string[]>([])
  const [occupe, setOccupe] = useState(false)
  const [survol, setSurvol] = useState(false)
  // **Changer la vignette en deux clics** (16 septembre 2026) : un bouton sur
  // le portrait ouvre ses images fixes, et un clic en fait la référence.
  const [choixDuPortrait, setChoixDuPortrait] = useState(false)
  const [collection, setCollection] = useState("")
  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])
  const images = [...new Map(personnage.cases.flatMap(c => c.images).filter(a => !a.piece && !a.supprime_le).map(a => [a.identifiant, a])).values()]
  const bandes = [...new Map(personnage.cases.flatMap(c => c.bandes ?? []).filter(b => !b.piece && !b.supprime).map(b => [b.identifiant, b])).values()]
  const bande = bandes.find(b => b.favori) ?? bandes[0]
  const modifie = nom !== personnage.nom || description !== personnage.description
  const ouvrir = () => { setNom(personnage.nom); setDescription(personnage.description); setEdition(true) }
  const fermer = () => { if (!modifie || window.confirm("Abandonner les modifications de la fiche ?")) setEdition(false) }
  useEffect(() => { setEdition(false) }, [personnage.identifiant])
  useEffect(() => {
    let vivant = true
    setObjectif(null)
    api.objectifPersonnage(personnage.identifiant, personnage.projet).then(o => { if (vivant && o.couverture) setObjectif(o) }).catch(e => { if (vivant) onErreur(e, "L’objectif ne peut pas être relu.") })
    return () => { vivant = false }
  }, [personnage, onErreur])
  useEffect(() => { if (!edition || !modifie) return; const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload", avertir); return () => window.removeEventListener("beforeunload", avertir) }, [edition, modifie])

  // **Le signalement, les textes de style et les images de référence** —
  // les trois réglages qui partent dans chaque demande d'image (RP8). Les
  // deux derniers se lisent dès que la fiche s'ouvre, et se relisent après
  // chaque écriture : le serveur y recalcule l'origine de chaque texte et ce
  // qui est proposé.
  const relireReglages = useCallback(() => {
    void api.habillage(personnage.identifiant).then((recu) => setHabillage(recu ?? null)).catch(() => setHabillage(null))
    void api.referencesDeLaChose(personnage.identifiant).then((recu) => setReferences(recu ?? null)).catch(() => setReferences(null))
  }, [personnage.identifiant])
  // **Son style de combat** (SC4) — seuls les personnages se battent. Relu
  // après chaque pose, comme les deux réglages ci-dessus : poser un choix
  // peut faire reparaître celui d'une pièce.
  const relireStyle = useCallback(() => {
    if (personnage.famille !== "personnages") { setStyleDuPersonnage(null); return }
    void api.styleDuPersonnage(personnage.identifiant, personnage.projet).then(setStyleDuPersonnage).catch(() => setStyleDuPersonnage(null))
  }, [personnage.identifiant, personnage.projet, personnage.famille])
  useEffect(() => {
    if (!edition) { setHabillage(null); setReferences(null); setStyleDuPersonnage(null); setCatalogueStyles([]); return }
    relireReglages()
    relireStyle()
    void api.posesDesTypes().then((recu) => setTypes(recu?.types ?? [])).catch(() => setTypes([]))
    void api.coteAmbiances().then((recu) => setAmbiances(recu?.ambiances ?? [])).catch(() => setAmbiances([]))
    void api.recettesNommees().then((recu) => setNommees(Object.keys(recu?.recettes ?? {}).sort())).catch(() => setNommees([]))
    if (personnage.famille === "personnages")
      void api.styles(personnage.projet).then((recu) => setCatalogueStyles(recu?.styles ?? [])).catch(() => setCatalogueStyles([]))
  }, [edition, relireReglages, relireStyle, personnage.projet, personnage.famille])
  const poserStyle = async (style: string | null) => {
    try {
      setStyleDuPersonnage(await api.choisirStyleDuPersonnage(personnage.identifiant, style, personnage.projet))
    } catch (erreur) { onErreur(erreur, "le style a été refusé") }
  }
  const poserHabillage = async (champs: Parameters<typeof api.reglerPersonnage>[1]) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
      onPersonnage(rendu.personnage)
      relireReglages()
    } catch (erreur) { onErreur(erreur, "réglage refusé") }
  }

  const poserRecette = async (recette: string | null) => {
    try {
      const rendu = await api.poserRecetteDuSujet(personnage.identifiant, recette, personnage.projet)
      onPersonnage(rendu.personnage)
    } catch (erreur) { onErreur(erreur, "la recette a été refusée") }
  }

  const garder = async () => {
    setOccupe(true)
    try { const resultat = await api.reglerPersonnage(personnage.identifiant, { nom: nom.trim(), description }); onPersonnage(resultat.personnage); setEdition(false) }
    catch (e) { onErreur(e, "La fiche n’a pas pu être conservée.") }
    finally { setOccupe(false) }
  }
  const ranger = async (id: string, retirer = false) => {
    setOccupe(true)
    try { if (retirer) await api.retirerSujet(id, personnage.projet, personnage.identifiant); else await api.rangerSujet(id, personnage.projet, personnage.identifiant); setCollection(""); onRange() }
    catch (e) { onErreur(e, "Le rangement n’a pas pu être conservé.") }
    finally { setOccupe(false) }
  }
  const choisirLePortrait = async (asset: string | null) => {
    try {
      const rendu = await api.poserImageDeReference(personnage.identifiant, asset)
      onPersonnage(rendu.personnage)
      setChoixDuPortrait(false)
    } catch (e) { onErreur(e, "L’image de référence a été refusée.") }
  }
  const retirer = async () => {
    if (!window.confirm(`Retirer « ${personnage.nom} » du jeu ? Ses fichiers restent conservés dans la bibliothèque.`)) return
    setOccupe(true)
    try { await api.supprimerPersonnage(personnage.identifiant); onPersonnage({ ...personnage, supprime: true }); setEdition(false) }
    catch (e) { onErreur(e, "Le sujet n’a pas pu être retiré.") }
    finally { setOccupe(false) }
  }
  return <>
    <section aria-label="Résumé du sujet" className="flex shrink-0 items-center gap-[22px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="group relative shrink-0">
      <button data-portrait-du-sujet className="damier-papier flex h-[128px] w-[128px] shrink-0 items-center justify-center overflow-hidden rounded-7" onClick={onImages} onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)} title="Voir ses images et références">
        {portrait ? <img src={vignetteAsset(portrait.asset, 256)} alt={`Référence de ${personnage.nom}`} className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} /> : bande ? <BandeQuiTourne bande={bande} cote={128} joue={survol} titre={`Animation de ${personnage.nom}`} /> : <span className="px-[14px] text-center text-[12px] text-encre-4">Référence à créer</span>}
      </button>
      {images.length > 0 && <button type="button" data-changer-le-portrait onClick={() => setChoixDuPortrait(true)} className="absolute bottom-[4px] right-[4px] rounded-5 border border-contour bg-carte/90 px-[8px] py-[2px] text-[11px] text-encre-controle opacity-0 transition-opacity duration-120 hover:border-encre-3 focus:opacity-100 group-hover:opacity-100">Changer</button>}
      </div>
      {choixDuPortrait && <CadreDialogue titre="Choisir la vignette" format="preparation" onFermer={() => setChoixDuPortrait(false)} enfants={<div data-choix-du-portrait className="flex min-h-0 flex-col">
        <header className="flex items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
          <div><h1 className="font-serif text-[25px]">Choisir la vignette</h1><p className="mt-[8px] text-[13px] text-encre-3">Clique une image : elle devient le portrait de {personnage.nom}. Rien n’est retenu pour le jeu.</p></div>
          <button type="button" className={BOUTON} onClick={() => setChoixDuPortrait(false)}>Fermer</button>
        </header>
        <div className="defile grid min-h-0 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-[8px] overflow-y-auto p-[30px]">
          {images.map((image) => { const actuel = portrait?.asset.identifiant === image.identifiant; return <button key={image.identifiant} type="button" aria-pressed={actuel} aria-label={`Prendre ${image.label} pour vignette`} onClick={() => void choisirLePortrait(image.identifiant)} className={`damier-papier flex aspect-square items-center justify-center overflow-hidden rounded-7 border-2 ${actuel ? "border-signal" : "border-transparent hover:border-contour"}`}><img src={vignetteAsset(image, 256)} alt="" className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} /></button> })}
        </div>
        {personnage.image_de_reference && <footer className="flex justify-end border-t border-trait px-[30px] py-[14px]"><button type="button" className={BOUTON} onClick={() => void choisirLePortrait(null)}>Reprendre le choix automatique</button></footer>}
      </div>} />}
      <div className="min-w-0 flex-1 space-y-[8px]">
        {/* **Une description absente se voit comme un manque**, pas comme un
            texte gris qu'on prend pour du contenu : c'est elle qui préremplit
            chaque génération de ce sujet, et sans elle le champ arrive vide. */}
        {personnage.description?.trim()
          ? <p className="line-clamp-2 whitespace-pre-line text-[13px] leading-relaxed text-encre-2">{personnage.description}</p>
          : <div data-description-manquante className="flex flex-wrap items-center gap-[10px] rounded-5 border border-trait-attention bg-fond-attention px-[10px] py-[6px] text-[13px] text-encre-attention">
              <span>Description manquante : les générations de {personnage.nom} partiront avec un texte vide. Décris sa silhouette, sa tenue et ce qui doit rester pareil d’une image à l’autre.</span>
              <button type="button" className={BOUTON} onClick={ouvrir}>L’écrire</button>
            </div>}
        <div className="flex flex-wrap items-center gap-[8px] text-[12px] text-encre-3"><span className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{images.length + bandes.length} résultat{images.length + bandes.length > 1 ? "s" : ""}</span>{collections?.map(c => <span key={c.identifiant} className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{c.nom}</span>)}<button className={BOUTON} onClick={ouvrir}>Modifier la fiche</button></div>
        {/* **Le seul compte d'avancement** (RV10) : la même fraction que le
            Codex et l'objectif, jamais plus « retenus pour le jeu » — la
            retenue n'a jamais été nécessaire pour partir dans le jeu (E2). Le
            manque reste en gris neutre. */}
        {objectif && <div className="flex flex-wrap items-center gap-[8px] text-[12px]">
          <span className="text-encre-3">
            Prêtes pour le jeu : {objectif.avancement.animations.pretes} animation{objectif.avancement.animations.pretes > 1 ? "s" : ""} sur {objectif.avancement.animations.demandees} · {objectif.avancement.images.pretes} image{objectif.avancement.images.pretes > 1 ? "s" : ""} fixe{objectif.avancement.images.pretes > 1 ? "s" : ""} sur {objectif.avancement.images.demandees}
          </span>
          {[
            objectif.avancement.animations.a_fabriquer ? `${objectif.avancement.animations.a_fabriquer} à fabriquer` : "",
            objectif.avancement.animations.a_departager ? `${objectif.avancement.animations.a_departager} à départager` : "",
            objectif.avancement.images.a_fabriquer ? `${objectif.avancement.images.a_fabriquer} images à fabriquer` : "",
          ].filter(Boolean).join(" · ") && <span className="text-encre-4">{[
            objectif.avancement.animations.a_fabriquer ? `${objectif.avancement.animations.a_fabriquer} à fabriquer` : "",
            objectif.avancement.animations.a_departager ? `${objectif.avancement.animations.a_departager} à départager` : "",
            objectif.avancement.images.a_fabriquer ? `${objectif.avancement.images.a_fabriquer} images à fabriquer` : "",
          ].filter(Boolean).join(" · ")}</span>}
          <button className="underline" onClick={onObjectif}>{objectif.objectif.sorties.length ? "Revoir l’objectif" : "Définir l’objectif"}</button>
        </div>}
      </div>
    </section>
    {edition && <CadreDialogue titre="La fiche du sujet" format="preparation" onFermer={fermer} enfants={<>
      <header className="flex items-center justify-between border-b border-trait p-[22px]"><h2 className="font-serif text-[25px]">La fiche du sujet</h2><button className={BOUTON} onClick={fermer}>Fermer</button></header>
      <div className="defile space-y-[22px] overflow-y-auto p-[22px]">
        <p className="text-[12px] text-encre-3">Ce qui est réglé ici part avec chaque demande de ce sujet, et se relit avant chaque envoi.</p>
        <label className="flex flex-col gap-[8px] text-[13px]">Nom<input aria-label="Nom du sujet" className="h-[34px] rounded-7 border border-contour bg-carte px-[14px]" value={nom} onChange={e => setNom(e.target.value)} /></label>

        <section className="flex flex-col gap-[8px]">
          <EnTeteDeSection aide="codex.chose.sujet" compte={`${description.length} lettres`} />
          <textarea
            aria-label="Description du sujet"
            placeholder="ce qu’il faut redire au modèle à chaque image de ce sujet"
            className="min-h-[128px] resize-y rounded-7 border border-contour bg-carte p-[14px] text-[13px]"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          {!personnage.description && <p className="text-[12px] text-encre-3">aucun signalement — chaque génération part sans dire de quoi il s’agit</p>}
        </section>

        <section data-type-et-ambiance className="grid grid-cols-2 gap-[14px]">
          <label className="flex flex-col gap-[8px] text-[13px]">Type d’objet
            <select aria-label="Type d'objet" className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={personnage.type ?? ""} onChange={(e) => void poserHabillage({ type: e.target.value })}>
              <option value="">aucun — suit le plan du jeu</option>
              {naturesChoisissables(types, personnage.type).map((type) => <option key={type.nom} value={type.nom}>{type.nom} — {type.poses.length === 0 ? "aucune pose" : `${type.poses.length} pose${type.poses.length > 1 ? "s" : ""}`}</option>)}
            </select>
            <span className="text-[12px] text-encre-3">Il décide des mouvements demandés. Aucune image ne bouge.</span>
          </label>
          <div className="flex flex-col gap-[8px] text-[13px]">
            <label className="flex flex-col gap-[8px]">Ambiance
              {ambiances.length === 0
                ? <span className="text-[12px] text-encre-3">Ce jeu n’a pas encore d’ambiance (onglet Univers).</span>
                : <select aria-label="Son ambiance" className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={personnage.ambiance ?? ""} onChange={(e) => void poserHabillage({ ambiance: e.target.value })}>
                    <option value="">aucune — le style du jeu</option>
                    {ambiances.map((a) => <option key={a.identifiant} value={a.identifiant}>{a.nom}</option>)}
                  </select>}
            </label>
            {personnage.ambiance && ambiances.length > 0 && <select aria-label="Ce qu'elle prend à son ambiance" className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={personnage.prend ?? "tout"} onChange={(e) => void poserHabillage({ prend: e.target.value })}>
              {CE_QU_ON_PREND.map((quoi) => <option key={quoi} value={quoi}>elle lui prend {NOM_DE_CE_QU_ON_PREND[quoi]}</option>)}
            </select>}
          </div>
        </section>

        {/* **La recette de ses images** (RS6) — en une ligne. Seules les
            images à naître la reçoivent ; un nom effacé depuis le choix reste
            affiché, et c'est alors la recette du jeu qui s'applique. */}
        <section data-recette-du-sujet className="flex flex-col gap-[4px]">
          <label className="flex items-center gap-[8px] text-[13px]">Recette de ses images :
            <select aria-label="Recette de ses images" className="h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={personnage.recette ?? ""} onChange={(e) => void poserRecette(e.target.value || null)}>
              <option value="">aucune (celle du jeu)</option>
              {personnage.recette && !nommees.includes(personnage.recette) && <option value={personnage.recette}>{personnage.recette} (effacée)</option>}
              {nommees.map((nom) => <option key={nom} value={nom}>{nom}</option>)}
            </select>
          </label>
          <span className="text-[12px] text-encre-3">Les images déjà faites ne changent pas.</span>
        </section>

        {/* **Seuls les personnages se battent** — un décor ou un objet n'a
            rien à choisir ici (18 septembre 2026, SC4). */}
        {personnage.famille === "personnages" && (
          <section data-style-de-combat className="flex flex-col gap-[8px]">
            <EnTeteDeSection aide="codex.chose.style_combat" />
            <SonStyleDeCombat
              resolu={styleDuPersonnage}
              catalogue={catalogueStyles}
              onPoser={poserStyle}
            />
          </section>
        )}

        <section className="flex flex-col gap-[8px]">
          <EnTeteDeSection aide="codex.chose.habillage" compte={habillage ? `${habillage.champs.length} textes · ${habillage.de_l_ambiance} de son ambiance` : "…"} />
          <CeQuiLHabille habillage={habillage} onPoser={poserHabillage} />
        </section>

        <section className="flex flex-col gap-[8px]">
          <EnTeteDeSection aide="codex.chose.exemples" compte={references ? `${references.disponibles} retenue${references.disponibles > 1 ? "s" : ""} · ${references.propositions.length} proposée${references.propositions.length > 1 ? "s" : ""}` : "…"} />
          <SesReferences
            references={references}
            onPromouvoir={(asset, promue) =>
              void api
                .promouvoirReference(personnage.identifiant, asset, promue)
                .then((recu) => { onPersonnage(recu.personnage); setReferences(recu.references) })
                .catch((erreur) => onErreur(erreur, "promotion refusée"))
            }
          />
        </section>

        <details className="text-[13px]"><summary className="cursor-pointer">Rangement et retrait du jeu</summary><p className="mt-[8px] text-[12px] text-encre-3">Type : {personnage.type || personnage.famille}. Retirer le sujet du jeu conserve ses fichiers et ses images.</p><button className={`${BOUTON} mt-[14px] text-echec`} disabled={occupe} onClick={() => void retirer()}>Le retirer du jeu</button></details>
        <section><h3 className="text-[13px] font-medium">Collections</h3><div className="mt-[8px] flex flex-wrap gap-[8px]">{collections?.map(c => <span key={c.identifiant} data-collection-du-sujet={c.identifiant} className="flex items-center gap-[8px] rounded-5 bg-papier-cote px-[8px] py-[4px] text-[13px]">{c.nom}<button disabled={occupe} aria-label={`Retirer de ${c.nom}`} onClick={() => void ranger(c.identifiant, true)}>×</button></span>)}</div><div className="mt-[14px] flex gap-[8px]"><select aria-label="Ajouter à une collection" className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={collection} onChange={e => setCollection(e.target.value)}><option value="">Choisir une collection</option>{groupes.filter(g => !collections?.some(c => c.identifiant === g.identifiant)).map(g => <option key={g.identifiant} value={g.identifiant}>{g.nom}</option>)}</select><button className={BOUTON} disabled={occupe || !collection} onClick={() => void ranger(collection)}>Ranger</button></div><p className="mt-[8px] text-[12px] text-encre-3">Le rangement est conservé immédiatement. Il ne change pas les règles de fabrication.</p></section>
      </div>
      <footer className="flex justify-end gap-[8px] border-t border-trait p-[14px]"><button className={BOUTON} onClick={fermer}>Annuler</button><button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50" disabled={occupe || !nom.trim() || !modifie} onClick={() => void garder()}>Garder la fiche</button></footer>
    </>} />}
  </>
}

// ── Son style de combat — un choix, et sa provenance dite en clair (SC4) ────

/** Une ligne : la liste déroulante, et une phrase qui dit d'où vient le
 *  style — jamais les deux à deviner l'un de l'autre. */
function SonStyleDeCombat({
  resolu,
  catalogue,
  onPoser,
}: {
  resolu: StyleDuPersonnage | null
  catalogue: StyleDeCombat[]
  onPoser: (style: string | null) => Promise<void>
}) {
  if (!resolu) return null

  const phrase =
    resolu.origine === "choisi"
      ? "choisi"
      : resolu.origine === "piece"
        ? `celui du ${resolu.piece?.nom ?? "?"}`
        : "aucun style — le texte du mouvement part seul"

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Son style de combat"
        className="mesure h-[34px] w-full max-w-[360px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
        value={resolu.style && resolu.origine === "choisi" ? resolu.style.identifiant : ""}
        onChange={(e) => void onPoser(e.target.value || null)}
      >
        {/* Sans choix, la ligne vide dit ce qui s'applique quand même :
            le style de la pièce portée, ou rien. */}
        <option value="">
          {resolu.origine === "piece" && resolu.style
            ? `pas de choix (${resolu.style.nom}, par la pièce)`
            : "aucun"}
        </option>
        {catalogue.map((style) => (
          <option key={style.identifiant} value={style.identifiant}>
            {style.nom}
          </option>
        ))}
      </select>
      <p className="mesure text-[11px] text-encre-4">{phrase}</p>
    </div>
  )
}

// ── Ce qui l'habille — les sept textes de style (repris de la fiche longue) ─

/** Les sept textes, **et d'où chacun vient**. */
function CeQuiLHabille({
  habillage,
  onPoser,
}: {
  habillage: Habillage | null
  onPoser: (champs: Parameters<typeof api.reglerPersonnage>[1]) => Promise<void>
}) {
  if (!habillage) return null

  return (
    <div className="flex flex-col gap-3">
      {habillage.ambiance && (
        <p className="mesure text-[10px] leading-4 text-encre-3">
          ambiance {habillage.ambiance.nom} — elle remplace le monde, l'éclairage
          et le trait ; le corriger là-bas le corrige pour tout ce qui s'en sert
        </p>
      )}

      {habillage.champs.map((champ) => (
        <ChampDeStyle key={champ.nom} champ={champ} onPoser={onPoser} />
      ))}

      {/* **La contradiction que seule la fiche met sous les yeux.** La taille de
          pixel s'impose — ni une ambiance ni une chose ne la change —, et deux
          champs de la bible écrivent la grille en toutes lettres. */}
      <div className="flex flex-col gap-1 border-t border-trait pt-3">
        <div className="mesure flex items-baseline gap-2 text-[10px]">
          <span className="w-[80px] shrink-0 text-encre-3">taille</span>
          <span className="text-encre-3">
            {habillage.cible_px
              ? `${habillage.cible_px} px de grille`
              : "aucune grille imposée"}
          </span>
          <span className="text-encre-4">verrouillé</span>
        </div>
        {habillage.desaccord.length > 0 && (
          <p className="mesure text-[10px] leading-4 text-echec">
            {habillage.desaccord.map((nom) => NOM_CHAMP[nom] ?? nom).join(" et ")}{" "}
            {habillage.desaccord.length > 1 ? "annoncent" : "annonce"} une autre
            grille dans le texte qui part — la bible se corrige dans l'Univers.
          </p>
        )}
      </div>

      {habillage.palette && (
        <div className="mesure flex items-baseline gap-2 text-[10px]">
          <span className="w-[80px] shrink-0 text-encre-3">palette</span>
          <span className="text-encre-3">
            {habillage.palette.nom} — {habillage.palette.couleurs} couleurs
          </span>
          <span className="text-encre-4">son ambiance</span>
        </div>
      )}
    </div>
  )
}

/** Un des sept textes, avec son origine et ce qu'il remplace. */
function ChampDeStyle({
  champ,
  onPoser,
}: {
  champ: ChampHabille
  onPoser: (champs: Parameters<typeof api.reglerPersonnage>[1]) => Promise<void>
}) {
  const [brouillon, setBrouillon] = useState(champ.texte)

  useEffect(() => setBrouillon(champ.texte), [champ.texte, champ.origine])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        {/* **Le nom d'un réglage n'est pas un grisé** (`docs/DESIGN.md` § Color) :
            le gris le plus sourd porte l'indisponible, la méta et la raison. */}
        <span className="mesure w-[80px] shrink-0 text-[10px] text-encre-3">
          {NOM_CHAMP[champ.nom] ?? champ.nom}
        </span>
        {/* **L'origine est lisible sans clic** : c'est le seul moyen de savoir
            si corriger ici serait une exception ou une redite. */}
        <span className="mesure text-[9.5px] text-encre-4">
          {ORIGINE[champ.origine]}
          {champ.ambiance ? ` · ${champ.ambiance}` : ""}
          {champ.ouvert ? "" : " · fermé aux ambiances"}
        </span>
        {champ.origine === "eteint" ? (
          <button
            type="button"
            onClick={() => void onPoser({ rallumer: champ.nom })}
            className="mesure ml-auto px-1 text-[9.5px] text-signal hover:opacity-70"
          >
            rallumer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onPoser({ eteindre: champ.nom })}
            title="ce champ ne partira plus pour ce sujet — un refus écrit, pas une case vide"
            className="mesure ml-auto px-1 text-[9.5px] text-encre-4 hover:text-echec"
          >
            éteindre
          </button>
        )}
      </div>

      {champ.origine === "eteint" ? (
        // Le texte qui serait parti, barré : on voit ce à quoi on a renoncé.
        <p className="mesure max-w-[720px] text-[11px] leading-5 text-encre-4 line-through">
          {champ.remplace || "—"}
        </p>
      ) : (
        <textarea
          value={brouillon}
          rows={2}
          aria-label={NOM_CHAMP[champ.nom] ?? champ.nom}
          placeholder="vide — ce que le jeu dit s'applique"
          onChange={(e) => setBrouillon(e.target.value)}
          onBlur={() => {
            if (brouillon !== champ.texte)
              void onPoser({ textes: { [champ.nom]: brouillon } })
          }}
          className="mesure w-full max-w-[720px] resize-y rounded-[2px] border border-trait bg-papier-cote p-2 text-[11px] leading-5 text-encre placeholder:text-encre-4"
        />
      )}

      {/* **Un texte écrit ici montre en dessous, barré, celui qu'il
          remplace** : on doit pouvoir lire ce à quoi on a renoncé sans aller
          le chercher ailleurs. */}
      {champ.origine === "ici" && champ.remplace && (
        <p className="mesure max-w-[720px] text-[10px] leading-4 text-encre-4 line-through">
          {champ.remplace}
        </p>
      )}
    </div>
  )
}

const ORIGINE: Record<string, string> = {
  jeu: "du jeu",
  ambiance: "son ambiance",
  ici: "écrit ici",
  eteint: "éteint",
  verrouille: "verrouillé",
}

// ── Ses images d'exemple — ce qui part joint à la demande ───────────────────

/** **Ce qui est disponible, pas ce qui part.** Ce qui part vraiment se coche
 *  juste avant de payer ; c'est ici que les images de référence d'une chose
 *  existent — on en promeut une, on en écarte une, et ça vaut pour toutes ses
 *  générations à venir. */
function SesReferences({
  references,
  onPromouvoir,
}: {
  references: ReferencesDeLaChose | null
  onPromouvoir: (asset: string, promue: boolean) => void
}) {
  if (!references) return null

  return (
    <div className="flex flex-col gap-3">
      {references.lignes.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-encre-3">
          Aucune encore. Dix-sept générations payées sur vingt-huit sont
          parties sans une seule image de référence, sur des modèles qui en
          acceptent quatorze.
        </p>
      ) : (
        <ul className="flex flex-col">
          {references.lignes.map((ligne) => (
            <LigneReference
              key={`${ligne.genre}-${ligne.reference}`}
              ligne={ligne}
              action={
                ligne.genre === "asset"
                  ? {
                      mot: "retirer",
                      ton: "gris",
                      faire: () => onPromouvoir(ligne.reference, false),
                    }
                  : null
              }
            />
          ))}
        </ul>
      )}

      {/* **L'atelier propose de lui-même**, et il ne décide pas : il propose,
          avec la provenance écrite, et une proposition se refuse d'un clic. */}
      {references.propositions.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-trait pt-2">
          <span className="mesure text-[9.5px] tracking-[.11em] text-encre-4 uppercase">
            proposées, d'après ce qui est fait
          </span>
          <ul className="flex flex-col">
            {references.propositions.map((proposition) => (
              <LigneReference
                key={proposition.reference}
                ligne={proposition}
                action={{
                  mot: "retenir ›",
                  ton: "signal",
                  faire: () => onPromouvoir(proposition.reference, true),
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Une image d'exemple : sa vignette, son nom, ce qu'elle est, et le geste. */
function LigneReference({
  ligne,
  action,
}: {
  ligne: ReferenceDeLaChose
  action: { mot: string; ton: "gris" | "signal"; faire: () => void } | null
}) {
  const sujet =
    ligne.montre?.sorte === "asset"
      ? sujetAsset(ligne.montre.asset)
      : ligne.montre?.sorte === "carte"
        ? sujetCarte(ligne.montre.carte)
        : null
  const visee = useVisee(sujet)
  const vignette =
    ligne.montre?.sorte === "asset"
      ? vignetteAsset(ligne.montre.asset, 128)
      : (sujet?.src ?? "")

  return (
    <li
      className="flex h-[38px] items-center gap-2.5 border-b border-trait last:border-b-0"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <span
        data-vignette-exemple
        className={[
          "damier-papier h-[30px] w-[30px] shrink-0 overflow-hidden rounded-[1px] border border-trait",
          ligne.ecartee ? "opacity-40" : "",
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
      <span className="mesure min-w-0 flex-1 truncate text-[11px] text-encre-3">
        {ligne.provenance}
      </span>
      <span className="mesure shrink-0 truncate text-[9.5px] text-encre-4">
        {ligne.detail}
      </span>
      {action && (
        <button
          type="button"
          aria-label={`${action.mot.replace(" ›", "")} ${ligne.provenance}`}
          onClick={action.faire}
          className={[
            "mesure shrink-0 px-1 text-[10px]",
            action.ton === "signal"
              ? "text-signal hover:opacity-70"
              : "text-encre-4 hover:text-echec",
          ].join(" ")}
        >
          {action.mot}
        </button>
      )}
    </li>
  )
}
