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
  NOM_CHAMP,
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
} from "../api"
import { BandeQuiTourne, sujetAsset, sujetCarte, useVisee, vignetteAsset } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"
import { EnTeteDeSection } from "./pieces"

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
  const [occupe, setOccupe] = useState(false)
  const [survol, setSurvol] = useState(false)
  const [collection, setCollection] = useState("")
  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])
  const images = [...new Map(personnage.cases.flatMap(c => c.images).filter(a => !a.piece && !a.supprime_le).map(a => [a.identifiant, a])).values()]
  const bandes = [...new Map(personnage.cases.flatMap(c => c.bandes ?? []).filter(b => !b.piece && !b.supprime).map(b => [b.identifiant, b])).values()]
  const bande = bandes.find(b => b.favori) ?? bandes[0]
  const retenus = images.filter(a => a.favori).length + bandes.filter(b => b.favori).length
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
  useEffect(() => {
    if (!edition) { setHabillage(null); setReferences(null); return }
    relireReglages()
  }, [edition, relireReglages])
  const poserHabillage = async (champs: Parameters<typeof api.reglerPersonnage>[1]) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
      onPersonnage(rendu.personnage)
      relireReglages()
    } catch (erreur) { onErreur(erreur, "réglage refusé") }
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
  const retirer = async () => {
    if (!window.confirm(`Retirer « ${personnage.nom} » du jeu ? Ses fichiers restent conservés dans la bibliothèque.`)) return
    setOccupe(true)
    try { await api.supprimerPersonnage(personnage.identifiant); onPersonnage({ ...personnage, supprime: true }); setEdition(false) }
    catch (e) { onErreur(e, "Le sujet n’a pas pu être retiré.") }
    finally { setOccupe(false) }
  }
  return <>
    <section aria-label="Résumé du sujet" className="flex shrink-0 items-center gap-[22px] rounded-8 border border-trait bg-carte p-[14px]">
      <button data-portrait-du-sujet className="damier-papier flex h-[128px] w-[128px] shrink-0 items-center justify-center overflow-hidden rounded-7" onClick={onImages} onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)} title="Voir ses images et références">
        {portrait ? <img src={vignetteAsset(portrait.asset, 256)} alt={`Référence de ${personnage.nom}`} className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} /> : bande ? <BandeQuiTourne bande={bande} cote={128} joue={survol} titre={`Animation de ${personnage.nom}`} /> : <span className="px-[14px] text-center text-[12px] text-encre-4">Référence à créer</span>}
      </button>
      <div className="min-w-0 flex-1 space-y-[8px]">
        <p className="line-clamp-2 whitespace-pre-line text-[13px] leading-relaxed text-encre-2">{personnage.description || "Décrivez sa silhouette, son rôle et les détails à conserver d’une fabrication à l’autre."}</p>
        <div className="flex flex-wrap items-center gap-[8px] text-[12px] text-encre-3"><span className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{images.length + bandes.length} résultat{images.length + bandes.length > 1 ? "s" : ""}</span><span className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{retenus} retenu{retenus > 1 ? "s" : ""} pour le jeu</span>{collections?.map(c => <span key={c.identifiant} className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{c.nom}</span>)}<button className={BOUTON} onClick={ouvrir}>Modifier la fiche</button></div>
        {objectif && <div className="flex flex-wrap items-center gap-[8px] text-[12px] text-encre-3">{([['animations', 'animation', 'animations'], ['images', 'image fixe', 'images fixes']] as const).map(([cle, singulier, pluriel]) => { const c = objectif.couverture[cle]; return c.demande > 0 && <span key={cle}>{c.retenu} / {c.demande} {c.demande > 1 ? pluriel : singulier} retenue{c.demande > 1 ? "s" : ""}{c.manquant ? ` · ${c.manquant} à fabriquer` : c.a_retenir ? ` · ${c.a_retenir} à juger` : ""}</span> })}<button className="underline" onClick={onObjectif}>{objectif.objectif.sorties.length ? "Revoir l’objectif" : "Définir l’objectif"}</button></div>}
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
