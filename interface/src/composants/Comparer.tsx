/**
 * Comparer — B13. **Deux sujets côte à côte, même pose, même fond, même
 * zoom, avec l'écart chiffré et l'action qui le corrige.**
 *
 * `docs/pistes-2026-09-04/carnet/Comparer.dc.html`. Une profondeur de plus de
 * la page d'un sujet (`interface/src/lieux.ts`, genre `"comparer"`), ouverte
 * depuis son bandeau d'onglets, à côté de *Voir la grille du jeu*.
 *
 * **Quatre écarts chiffrés, jamais cinq.** La hauteur et la largeur rendues
 * (`Asset.rendu_hauteur`/`rendu_largeur`), le contour tracé
 * (`recette.contours`), le palier de couleurs demandé
 * (`recette.quantification.couleurs`) sont des nombres que le produit calcule
 * déjà. **Aucune mesure de l'ombre n'existe** — la ligne que la planche
 * dessine n'a rien derrière, et elle n'est donc pas construite ici.
 *
 * **Choisir deux fois le même sujet compare deux de ses images**, la pose
 * restant la même : c'est le second sujet du sélecteur qui décide du mode, pas
 * un bouton à part.
 *
 * Elle ne fabrique rien, ne modifie rien, ne coûte rien. Les actions
 * correctives sont des portes vers ce qui existe déjà — retoucher une image
 * (`case`), ou revoir la page d'un sujet pour en régénérer une — jamais un
 * geste qui écrit depuis cet écran-ci.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { type Asset, type Personnage, type Pose, type Univers } from "../api"
import { imageAsset } from "./Apercu"

const ZOOMS = [1, 2, 4, 8] as const
type Zoom = (typeof ZOOMS)[number]

const jour = (quand: number) =>
  new Date(quand * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

/** Les poses d'un sujet qui portent au moins une image. */
function posesAvecImages(personnage: Personnage, plan: Pose[]): Pose[] {
  const parPose = new Map(personnage.cases.map((c) => [c.pose, c]))
  return (personnage.plan ?? plan).filter(
    (p) => (parPose.get(p.identifiant)?.images.length ?? 0) > 0,
  )
}

/** Les poses d'un sujet qui portent au moins deux images — celles qu'on peut
 *  comparer à elle-même (« choisir deux fois le même sujet »). */
function posesAvecDeuxImages(personnage: Personnage, plan: Pose[]): Pose[] {
  const parPose = new Map(personnage.cases.map((c) => [c.pose, c]))
  return (personnage.plan ?? plan).filter(
    (p) => (parPose.get(p.identifiant)?.images.length ?? 0) >= 2,
  )
}

function imagesDeLaPose(personnage: Personnage, poseId: string): Asset[] {
  return personnage.cases.find((c) => c.pose === poseId)?.images ?? []
}

/** La retenue, sinon la plus récente — la même règle que `portraitDe`
 *  (`FicheChose.tsx`), reprise pour une pose choisie plutôt que déduite. */
function imageDeReference(images: Asset[]): Asset | null {
  if (!images.length) return null
  const favori = images.find((i) => i.favori)
  if (favori) return favori
  return images.reduce((a, b) => (b.cree_le > a.cree_le ? b : a))
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

function Prix({ image }: { image: Asset | null }) {
  if (!image || image.cout_usd <= 0)
    return <span className="mesure text-encre-3">gratuite</span>
  return <span className="mesure text-signal">${image.cout_usd.toFixed(4)}</span>
}

export function Comparer({
  personnage,
  personnages,
  plan,
  univers,
  onFermer,
  onGrille,
  onOuvrirCase,
}: {
  personnage: Personnage
  /** Tous les sujets du jeu ouvert — déjà chargés par `App.tsx`, comme
   *  `Vitrine.tsx` les reçoit déjà pour la même raison. */
  personnages: Personnage[]
  plan: Pose[]
  univers: Univers
  onFermer: () => void
  onGrille: () => void
  /** Ouvre l'outil de retouche sur cette image précise — la même profondeur
   *  que celle que `ImagesDuSujet.tsx` ouvre par « La retoucher ».
   *
   *  **Porte aussi le sujet propriétaire**, pas seulement l'image : l'image
   *  visée peut être celle du second sujet, jamais celui dont la page est
   *  affichée, et l'appelant en a besoin pour y basculer avant d'ouvrir la
   *  case — sans quoi l'outil chercherait l'image dans le mauvais sujet. */
  onOuvrirCase: (sujet: string, asset: string) => void
}) {
  const autres = personnages.filter((p) => p.identifiant !== personnage.identifiant)
  const [sujetBId, setSujetBId] = useState(
    autres[0]?.identifiant ?? personnage.identifiant,
  )
  const sujetB =
    personnages.find((p) => p.identifiant === sujetBId) ?? personnage
  const modeImages = sujetBId === personnage.identifiant

  const posesA = modeImages
    ? posesAvecDeuxImages(personnage, plan)
    : posesAvecImages(personnage, plan)
  const [poseId, setPoseId] = useState(posesA[0]?.identifiant ?? "")

  useEffect(() => {
    if (!posesA.some((p) => p.identifiant === poseId)) {
      setPoseId(posesA[0]?.identifiant ?? "")
    }
    // Changer de second sujet, ou de mode, remet la pose à la première
    // disponible : une pose choisie dans l'autre mode peut ne plus exister.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujetBId, modeImages])

  const imagesDeLaPoseA = poseId ? imagesDeLaPose(personnage, poseId) : []
  const [imageAId, setImageAId] = useState<string>("")
  const [imageBId, setImageBId] = useState<string>("")

  useEffect(() => {
    if (!modeImages || !poseId) return
    const triees = [...imagesDeLaPoseA].sort((a, b) => b.cree_le - a.cree_le)
    const premiere = imageDeReference(triees) ?? triees[0] ?? null
    const seconde = triees.find((i) => i.identifiant !== premiere?.identifiant) ?? null
    setImageAId(premiere?.identifiant ?? "")
    setImageBId(seconde?.identifiant ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeImages, poseId, personnage.identifiant])

  const [zoom, setZoom] = useState<Zoom>(4)
  const [fond, setFond] = useState<"neutre" | "jeu">("neutre")
  const [superposes, setSuperposes] = useState(false)

  const imageA = modeImages
    ? imagesDeLaPoseA.find((i) => i.identifiant === imageAId) ?? null
    : imageDeReference(poseId ? imagesDeLaPose(personnage, poseId) : [])
  const imageB = modeImages
    ? imagesDeLaPoseA.find((i) => i.identifiant === imageBId) ?? null
    : imageDeReference(poseId ? imagesDeLaPose(sujetB, poseId) : [])

  const cible = univers.cible_px || 64
  const echelleA = univers.bareme.find((e) => e.nom === personnage.type) ?? null
  const echelleB = univers.bareme.find((e) => e.nom === sujetB.type) ?? null

  const hauteurA = imageA ? imageA.rendu_hauteur || imageA.hauteur : null
  const hauteurB = imageB ? imageB.rendu_hauteur || imageB.hauteur : null
  const largeurA = imageA ? imageA.rendu_largeur || imageA.largeur : null
  const largeurB = imageB ? imageB.rendu_largeur || imageB.largeur : null

  const hauteurAHorsCase =
    hauteurA !== null && hauteurA > cible && (echelleA?.occupation ?? 100) <= 100
  const hauteurBHorsCase =
    hauteurB !== null && hauteurB > cible && (echelleB?.occupation ?? 100) <= 100

  const contourA = imageA?.recette.contours ?? null
  const contourB = imageB?.recette.contours ?? null
  // **L'une détourée et l'autre non compte comme un écart** — pas seulement
  // deux traits qui different entre eux. Un `&&` qui exigeait les deux non
  // nuls laissait passer en silence le cas le plus courant : une image
  // retouchée avec un contour contre une qui ne l'a jamais été. Trouvé au
  // navigateur sur l'atelier jetable de `B13`, pas par un essai.
  const contoursDiffere =
    (contourA === null) !== (contourB === null) ||
    (contourA !== null &&
      contourB !== null &&
      (contourA.epaisseur !== contourB.epaisseur || contourA.couleur !== contourB.couleur))

  const couleursA = imageA?.recette.quantification?.couleurs ?? null
  const couleursB = imageB?.recette.quantification?.couleurs ?? null
  const couleursHorsNorme =
    (couleursA !== null && univers.couleurs > 0 && couleursA > univers.couleurs) ||
    (couleursB !== null && univers.couleurs > 0 && couleursB > univers.couleurs)

  const echelleMax = 320 / Math.max(1, cible) // garde la scène lisible même à ×8
  const facteur = Math.min(zoom, Math.max(1, Math.floor(echelleMax)))

  const fondStyle =
    fond === "jeu" && univers.fond ? { background: univers.fond } : undefined

  return (
    <main
      data-comparer
      aria-label={`Comparer ${personnage.nom}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            ‹ Sa page
          </button>
          <button
            type="button"
            onClick={onGrille}
            className="h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
          >
            Voir la grille du jeu
          </button>
        </div>

        <div className="flex flex-col gap-[4px]">
          <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
            {modeImages ? "Le même, deux fois" : "Deux côte à côte"}
          </h1>
          <p className="text-[13px] text-encre-2">
            {modeImages
              ? "Même sujet, même pose, deux images. Ce qui diffère saute aux yeux — et se lit chiffré en dessous."
              : "Même pose, même fond, même zoom. Ce qui diffère saute aux yeux — et se lit chiffré en dessous."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[14px]">
          <span className="text-[13px] text-encre">{personnage.nom}</span>
          <span className="text-[12.5px] text-encre-4">contre</span>
          <select
            aria-label="Comparer avec"
            value={sujetBId}
            onChange={(e) => setSujetBId(e.target.value)}
            className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
          >
            <option value={personnage.identifiant}>{personnage.nom} — ses images</option>
            {autres.map((p) => (
              <option key={p.identifiant} value={p.identifiant}>
                {p.nom}
              </option>
            ))}
          </select>

          <span className="mx-[8px] h-[22px] w-px bg-trait" aria-hidden />

          <select
            aria-label="La pose comparée"
            value={poseId}
            onChange={(e) => setPoseId(e.target.value)}
            disabled={posesA.length === 0}
            className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre disabled:text-eteint"
          >
            {posesA.length === 0 ? (
              <option value="">aucune pose comparable</option>
            ) : (
              posesA.map((p) => (
                <option key={p.identifiant} value={p.identifiant}>
                  {p.nom}
                </option>
              ))
            )}
          </select>

          {modeImages && (
            <>
              <select
                aria-label="La première image"
                value={imageAId}
                onChange={(e) => setImageAId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {imagesDeLaPoseA.map((i) => (
                  <option key={i.identifiant} value={i.identifiant}>
                    {jour(i.cree_le)}
                  </option>
                ))}
              </select>
              <span className="text-[12.5px] text-encre-4">contre</span>
              <select
                aria-label="La seconde image"
                value={imageBId}
                onChange={(e) => setImageBId(e.target.value)}
                className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre"
              >
                {imagesDeLaPoseA.map((i) => (
                  <option key={i.identifiant} value={i.identifiant}>
                    {jour(i.cree_le)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {(["neutre", "jeu"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={fond === f}
                onClick={() => setFond(f)}
                className={[
                  "flex h-[26px] items-center justify-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                  fond === f
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                {f === "neutre" ? "Fond neutre" : "Fond du jeu"}
              </button>
            ))}
          </div>
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => setZoom(z)}
                className={[
                  "flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                  zoom === z
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                ×{z}
              </button>
            ))}
          </div>
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={superposes === v}
                onClick={() => setSuperposes(v)}
                className={[
                  "flex h-[26px] items-center justify-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                  superposes === v
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                {v ? "Superposés" : "Alignés au sol"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-[14px] overflow-y-auto pb-[14px]">
            {/* ── La scène ──────────────────────────────────────────────── */}
            <div
              className={[
                "grid min-h-[300px] overflow-hidden rounded-8 border border-trait",
                superposes ? "grid-cols-1" : "grid-cols-2",
              ].join(" ")}
            >
              <Panneau
                image={imageA}
                nom={modeImages ? jour(imageA?.cree_le ?? 0) : personnage.nom}
                facteur={facteur}
                style={fondStyle}
                calque={superposes ? imageB : null}
                calqueFacteur={facteur}
              />
              {!superposes && (
                <Panneau
                  image={imageB}
                  nom={modeImages ? jour(imageB?.cree_le ?? 0) : sujetB.nom}
                  facteur={facteur}
                  style={fondStyle}
                  calque={null}
                  calqueFacteur={facteur}
                />
              )}
            </div>

            {/* ── Les écarts, chiffrés ──────────────────────────────────── */}
            <div className="flex flex-col gap-[8px]">
              <Etiquette>Les écarts, chiffrés</Etiquette>
              <div className="flex flex-col gap-[4px] rounded-8 border border-trait bg-carte p-[8px] text-[12.5px]">
                <Ecart
                  mot="Sa hauteur"
                  a={hauteurA !== null ? `${hauteurA} px` : "—"}
                  b={hauteurB !== null ? `${hauteurB} px` : "—"}
                  ecart={
                    hauteurA !== null && hauteurB !== null
                      ? `${hauteurB - hauteurA >= 0 ? "+" : ""}${hauteurB - hauteurA} px`
                      : "—"
                  }
                  horsNorme={hauteurAHorsCase || hauteurBHorsCase}
                />
                <Ecart
                  mot="Sa largeur"
                  a={largeurA !== null ? `${largeurA} px` : "—"}
                  b={largeurB !== null ? `${largeurB} px` : "—"}
                  ecart={
                    largeurA !== null && largeurB !== null
                      ? `${largeurB - largeurA >= 0 ? "+" : ""}${largeurB - largeurA} px`
                      : "—"
                  }
                />
                <Ecart
                  mot="Son contour"
                  a={contourA ? `${contourA.epaisseur} px` : "aucun"}
                  b={contourB ? `${contourB.epaisseur} px` : "aucun"}
                  ecart={contoursDiffere ? "deux traits différents" : "le même"}
                  horsNorme={contoursDiffere}
                />
                <Ecart
                  mot="Ses couleurs"
                  a={couleursA !== null ? String(couleursA) : "—"}
                  b={couleursB !== null ? String(couleursB) : "—"}
                  ecart={
                    couleursHorsNorme
                      ? `au-delà des ${univers.couleurs} du jeu`
                      : "sous la limite du jeu"
                  }
                  horsNorme={couleursHorsNorme}
                />
              </div>
            </div>

            <p className="text-[12.5px] text-encre-3">
              Comparer ne modifie rien. Corriger un écart, c'est retoucher une image ou
              en régénérer une.
            </p>
          </div>

          {/* ── Ce qui ne va pas ensemble ───────────────────────────────── */}
          <aside
            data-ce-qui-ne-va-pas-ensemble
            aria-label="Ce qui ne va pas ensemble"
            className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
          >
            <Etiquette>Ce qui ne va pas ensemble</Etiquette>

            {!hauteurAHorsCase && !hauteurBHorsCase && !contoursDiffere && !couleursHorsNorme ? (
              <p className="text-[12.5px] leading-[1.5] text-encre-2">
                Rien ne dépasse ici : les deux tiennent dans leur case, et leur contour
                comme leurs couleurs s'accordent.
              </p>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {hauteurAHorsCase && imageA && (
                  <Correction
                    titre={`${personnage.nom} dépasse sa case`}
                    quoi={`${hauteurA} px pour une case de ${cible} : sa tête mord sur la case du dessus.`}
                    action="La retoucher"
                    onAction={() => onOuvrirCase(personnage.identifiant, imageA.identifiant)}
                  />
                )}
                {hauteurBHorsCase && imageB && (
                  <Correction
                    titre={`${modeImages ? "La seconde image" : sujetB.nom} dépasse sa case`}
                    quoi={`${hauteurB} px pour une case de ${cible} : sa tête mord sur la case du dessus.`}
                    action="La retoucher"
                    onAction={() => onOuvrirCase(sujetB.identifiant, imageB.identifiant)}
                  />
                )}
                {contoursDiffere && (
                  <Correction
                    titre="Son contour n'est pas le même"
                    quoi="Deux traits différents pour la même pose. Une régénération applique le même détourage aux deux."
                    prix={<Prix image={imageB} />}
                  />
                )}
                {couleursHorsNorme && (
                  <Correction
                    titre="Une des deux dépasse la palette du jeu"
                    quoi={`Le jeu déclare ${univers.couleurs} couleurs au plus ; une régénération la ramène dans la limite.`}
                    prix={
                      <Prix
                        image={
                          couleursA !== null && couleursA > univers.couleurs
                            ? imageA
                            : imageB
                        }
                      />
                    }
                  />
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}

function Panneau({
  image,
  nom,
  facteur,
  style,
  calque,
  calqueFacteur,
}: {
  image: Asset | null
  nom: string
  facteur: number
  style?: CSSProperties
  calque: Asset | null
  calqueFacteur: number
}) {
  return (
    <div
      className="relative flex min-h-[300px] items-end justify-center bg-pourtour p-[14px]"
      style={style}
    >
      {image ? (
        <img
          src={imageAsset(image)}
          alt={nom}
          width={Math.round((image.rendu_largeur || image.largeur) * facteur)}
          height={Math.round((image.rendu_hauteur || image.hauteur) * facteur)}
          style={{ imageRendering: "pixelated" }}
          className="block"
        />
      ) : (
        <span className="text-[12.5px] text-carte">aucune image pour cette pose</span>
      )}
      {calque && (
        <img
          src={imageAsset(calque)}
          alt=""
          aria-hidden
          width={Math.round((calque.rendu_largeur || calque.largeur) * calqueFacteur)}
          height={Math.round((calque.rendu_hauteur || calque.hauteur) * calqueFacteur)}
          style={{ imageRendering: "pixelated", opacity: 0.5 }}
          className="absolute bottom-[14px] block"
        />
      )}
      <span className="mesure absolute left-[8px] top-[8px] text-[10.5px] text-carte">
        {nom}
      </span>
    </div>
  )
}

function Ecart({
  mot,
  a,
  b,
  ecart,
  horsNorme,
}: {
  mot: string
  a: string
  b: string
  ecart: string
  horsNorme?: boolean
}) {
  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[8px] rounded-5 px-[8px] py-[4px]",
        horsNorme ? "bg-fond-echec" : "",
      ].join(" ")}
    >
      <span className="text-encre-3">{mot}</span>
      <span className="mesure">{a}</span>
      <span className="mesure">{b}</span>
      <span className={`mesure text-right ${horsNorme ? "text-echec" : "text-encre-3"}`}>
        {ecart}
      </span>
    </div>
  )
}

function Correction({
  titre,
  quoi,
  action,
  onAction,
  prix,
}: {
  titre: string
  quoi: string
  action?: string
  onAction?: () => void
  prix?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-8 border border-trait-echec bg-fond-echec p-[14px]">
      <p className="text-[13px] font-medium text-echec">{titre}</p>
      <p className="text-[12.5px] leading-[1.5] text-encre-2">{quoi}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-[30px] rounded-7 border border-contour bg-carte text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
        >
          {action}
        </button>
      )}
      {prix && (
        <div className="flex items-center justify-between gap-[8px] text-[12.5px]">
          <span className="text-encre-3">sa dernière génération a coûté</span>
          {prix}
        </div>
      )}
    </div>
  )
}
