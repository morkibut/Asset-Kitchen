// Les tables — l'endroit où l'on retouche.
//
// **Ce que ça remplace.** Cinq blocs repliés dans une colonne de 380 px, à côté
// d'une image de 380 px de large, sous le bouton qui paie. On y réglait un
// détourage en regardant une vignette, et quatre réglages que le modèle porte
// depuis T2 n'avaient jamais eu d'écran du tout.
//
// **La barre de tables** montre les sept places de la recette **dans l'ordre où
// elles s'appliquent**, et cet ordre ne se change pas : c'est celui du domaine,
// et le lire autrement serait mentir sur ce que l'image a subi. Chaque place dit
// d'un carré si elle agit — plein quand elle **change l'image**, creux quand
// elle est vide, aucun carré quand elle est indisponible. Aucun mot, aucun
// glyphe neuf.
//
// **Deux fabriques après un trait.** Le découpage coupe une image en plusieurs,
// la superposition en pose deux l'une sur l'autre. Les deux **écrivent des
// fichiers** et ne posent rien sur l'image courante — c'est pour ça qu'elles
// n'ont pas de carré, et c'est le critère qui les range
// (`docs/maquettes-v2.1/03-chassis-des-tables.html`, au paragraphe « Le
// wrapper »).
//
// **Le wrapper** est `380px · 1fr · 380px` : la colonne de la table, l'image en
// grand, ses sœurs. C'est la grille de l'onglet Univers en vue toile, réemployée
// — aucune largeur neuve.

import { useEffect, useRef, useState } from "react"
import {
  api,
  type Asset,
  type EtatTraitement,
  type Recette,
  type TachesDeLAsset,
  type Trait,
  type Univers,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { EnTetePanneau, Raison, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"
import {
  avecPassage,
  mainDe,
  OPACITE,
  PanneauBords,
  PanneauContours,
  PanneauDetourage,
  PanneauGrille,
  PanneauMain,
  PanneauQuantification,
  PanneauRecadrage,
  passagesDe,
  rayonDe,
  RESUME,
  sansLeDernier,
  useEtatMain,
  useMesures,
  useRecette,
} from "./Places"

// ── L'ordre, et il ne se change pas ─────────────────────────────────────────

export type Table =
  | "detourage"
  | "recadrage"
  | "grille"
  | "quantification"
  | "bords"
  | "contours"
  | "main"
  | "decoupage"
  | "superposition"

/** Les sept places, puis le trait, puis les deux fabriques.
 *
 *  **L'ordre est celui du traitement**, et il est écrit une fois — ici. Le
 *  domaine l'applique dans cet ordre-là ; deux listes ordonnées de la même
 *  chose finiraient par diverger, et celle de l'écran mentirait alors sur ce
 *  que l'image a subi.
 *
 *  Les deux places qui manquent — **le contour** et **la main** — occupent déjà
 *  leur rang : elles arrivent en E5, et une place qui apparaîtrait le jour où
 *  elle existe déplacerait tout ce qui la suit sous les yeux de quelqu'un qui
 *  a appris l'ordre. */
export const TABLES: readonly { cle: Table; nom: string; fabrique?: true }[] = [
  { cle: "detourage", nom: "détourage" },
  { cle: "recadrage", nom: "recadrage" },
  { cle: "grille", nom: "grille" },
  { cle: "quantification", nom: "quantification" },
  { cle: "bords", nom: "bords" },
  { cle: "contours", nom: "contours" },
  { cle: "main", nom: "la main" },
  { cle: "decoupage", nom: "découpage", fabrique: true },
  { cle: "superposition", nom: "superposition", fabrique: true },
]

/** Ce qu'une place vaut, ou rien.
 *
 *  **Le carré se remplit quand la place change l'image, pas quand elle figure
 *  dans la recette.** Les deux ont longtemps coïncidé, et le recadrage a montré
 *  qu'elles ne coïncident pas toujours : il est posé dès la naissance de tout
 *  asset qui a une silhouette, et une marge de zéro ne change rien. */
function valeur(table: Table, recette: Recette): string | null {
  switch (table) {
    case "detourage":
      return recette.passes.length > 0 ? RESUME.detourage(recette) : null
    case "recadrage":
      return recette.recadrage &&
        (recette.recadrage.marge > 0 || recette.recadrage.boite !== null)
        ? RESUME.recadrage(recette.recadrage)
        : null
    case "grille":
      return recette.grille ? RESUME.grille(recette.grille) : null
    case "quantification":
      return recette.quantification ? RESUME.quantification(recette.quantification) : null
    case "bords":
      return recette.bords && recette.bords.aire_min > 0
        ? RESUME.bords(recette.bords)
        : null
    case "contours":
      return recette.contours ? RESUME.contours(recette.contours) : null
    // **Une pile de calques vides ne change pas l'image**, donc son carré reste
    // creux : le carré se remplit quand la place *change l'image*, pas quand
    // elle figure dans la recette. Le calque, lui, est gardé — on l'a créé.
    case "main":
      return recette.main && passagesDe(recette.main) > 0
        ? RESUME.main(recette.main)
        : null
    default:
      return null
  }
}

/** Pourquoi une place est indisponible, ou rien.
 *
 *  **Une table indisponible s'ouvre quand même**, et son panneau porte la
 *  raison en clair à la place de ses réglages, avec ce qu'il faut faire pour
 *  l'allumer. C'est la règle de T1 — *le grisé porte sa raison* — qui change
 *  d'endroit, pas qui disparaît : une puce n'a pas la place d'une phrase. */
function indisponible(
  table: Table,
  traitement: EtatTraitement,
  mesures: TachesDeLAsset | null,
): string | null {
  if (table === "quantification") return traitement.quantification.raison
  // **Le seul cas du contour, et il est franc.** Une image entièrement opaque
  // n'a pas de silhouette : tracer un contour dessus reviendrait à encadrer
  // l'image entière — un rectangle sur les quatre bords, qui n'est jamais ce
  // qu'on voulait. La seconde phrase compte autant que la première : elle dit
  // quoi faire, et le détourage est la première de la barre.
  if (table === "contours" && mesures?.opaque)
    return "cette image est entièrement opaque : il n'y a pas de bord de sujet à tracer, seulement les quatre bords du cadre. Détoure-la d'abord — c'est la première table de la barre."
  // **La main n'est jamais indisponible**, et c'est l'exacte symétrie du
  // contour : toute image se retouche, y compris une image entièrement opaque
  // — *ôter* y crée de la transparence, et un calque de dessin s'y pose comme
  // partout. Son carré est donc toujours là.
  if (table === "superposition")
    return "la superposition n'est pas encore construite — elle arrive avec sa fabrique"
  return null
}

// ── La barre ────────────────────────────────────────────────────────────────

function Carre({ plein }: { plein: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "inline-block h-[9px] w-[9px] shrink-0",
        plein ? "bg-signal" : "border border-texte-3",
      ].join(" ")}
    />
  )
}

export function BarreDesTables({
  recette,
  traitement,
  mesures,
  ouverte,
  onOuvrir,
  onToutDefaire,
}: {
  recette: Recette
  traitement: EtatTraitement
  /** Ce que le serveur a mesuré. Le contour s'y lit une seule chose — *cette
   *  image a-t-elle un bord de sujet ?* — et tant que la réponse n'est pas
   *  arrivée, la table n'est pas grisée : on ne grise pas sur une ignorance. */
  mesures: TachesDeLAsset | null
  ouverte: Table
  onOuvrir: (table: Table) => void
  onToutDefaire: () => void
}) {
  return (
    // **La bande ne grandit pas, et ce qui dépasse défile** — la règle du
    // panneau borné par l'écran (`docs/DESIGN.md`), appliquée à une bande.
    // Mesuré au navigateur en tenant E5 : à sept places qui portent chacune
    // leur valeur, la bande demande 1 323 px pour 1 280 offerts, et une bande
    // qui s'épaissirait mentirait sur la liste fermée des cinq hauteurs.
    //
    // **Ce qui défile, ce sont les places — jamais le geste qui les vide.**
    // `tout défaire` est hors de la zone qui défile : poussé dedans, il aurait
    // fallu faire glisser la bande pour l'atteindre, et un geste de portée
    // générale ne se cherche pas.
    <div className="flex h-[34px] shrink-0 items-center border-b border-bord bg-fond-1">
      <div className="defile flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-4">
      {TABLES.map(({ cle, nom, fabrique }, rang) => {
        const dehors = indisponible(cle, traitement, mesures)
        const vaut = valeur(cle, recette)
        return (
          <span key={cle} className="flex items-center gap-1">
            {/* Le trait qui sépare les sept places des deux fabriques. Il ne
                sépare pas deux groupes de contrôles : il sépare **ce qui pose
                sur cette image** de **ce qui écrit d'autres fichiers**. */}
            {fabrique && rang > 0 && !TABLES[rang - 1].fabrique && (
              <span aria-hidden className="mx-2 h-4 w-px bg-bord" />
            )}
            <button
              type="button"
              aria-pressed={ouverte === cle}
              onClick={() => onOuvrir(cle)}
              className={[
                // `whitespace-nowrap` : la bande fait 34 px et ne grandit pas.
                // Trouvé au navigateur en tenant E5 — dès que la sixième et la
                // septième places portent une valeur, `modèle · 28` et
                // `128 px · 100 %` se repliaient chacun sur deux lignes et
                // débordaient de la bande par le haut et par le bas.
                "mesure flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] px-2 text-[10px] transition-colors duration-[80ms]",
                ouverte === cle
                  ? "bg-fond-3 text-texte"
                  : dehors
                    ? "text-texte-3 hover:bg-fond-2"
                    : "text-texte-2 hover:bg-fond-2",
              ].join(" ")}
            >
              {/* Une fabrique n'a pas de carré : il n'y a pas de place à
                  remplir. Une place indisponible non plus, et pour la même
                  raison — le carré dit *qu'il y a une place ici*. */}
              {!fabrique && !dehors && <Carre plein={vaut !== null} />}
              <span>{nom}</span>
              {vaut && <span className="text-signal">{vaut}</span>}
            </button>
          </span>
        )
      })}
      </div>

      {/* **`tout défaire` vit au bout de la barre, pas dans l'en-tête d'une
          table.** Il y était posé en face du nom de la table, et il vidait la
          recette entière — donc il mentait sur sa portée. La barre *est* la
          recette : le geste qui la vide appartient à ce qui la représente. Le
          pied de chaque table garde son `Sans <table> ›`, qui ne touche qu'elle. */}
      <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-bord" />
      <button
        type="button"
        onClick={onToutDefaire}
        className="mesure flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2 pr-4 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-echec"
      >
        <span aria-hidden>×</span> tout défaire
      </button>
    </div>
  )
}

// ── Le comparateur ──────────────────────────────────────────────────────────

type Mode = "rendu" | "brut" | "cote" | "superpose"

const MODES: Record<Mode, string> = {
  rendu: "rendu",
  brut: "brut",
  cote: "côte à côte",
  superpose: "superposé",
}

/**
 * Sous l'image, sur toutes les tables.
 *
 * **Le mode se dit toujours** — écrit en clair à côté des segments dès que ce
 * n'est pas *rendu*. Un mode durable qu'on oublie est le danger que l'appui
 * *Avant ›* de C4 évitait ; le dire est ce qui autorise à le rendre durable.
 */
function Comparateur({
  asset,
  mode,
  onMode,
  opacite,
  onOpacite,
  peint,
  onAvant,
}: {
  asset: Asset
  mode: Mode
  onMode: (mode: Mode) => void
  opacite: number
  onOpacite: (opacite: number) => void
  /** La table ouverte se peint-elle ? **C'est la seule contrainte que le
   *  comparateur reçoive** : les trois autres vues se lisent alors en
   *  maintenant *Avant ›*, qui rend exactement ce qu'elles retiraient. */
  peint?: boolean
  onAvant?: (tenu: boolean) => void
}) {
  return (
    <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px]">
      <span className="whitespace-nowrap text-texte-3">
        {asset.largeur}×{asset.hauteur} · {asset.type_media}
      </span>
      {/* **Un seul groupe de quatre, et non deux de deux.** La maquette les
          dessine sur deux rangées, ce qui est de la mise en page ; en faire
          deux contrôles obligerait le second à montrer une valeur choisie
          quand le mode est *rendu* — c'est-à-dire à dire faux. Les quatre
          modes s'excluent, donc ils sont un choix. */}
      <Segments
        valeurs={["brut", "rendu", "cote", "superpose"] as const}
        valeur={mode}
        libelles={MODES}
        indisponibles={peint ? (["brut", "cote", "superpose"] as const) : []}
        onChange={(v) => onMode(v as Mode)}
      />
      {/* **La bande fait 38 px, et elle ne grandit pas.** Mesuré au navigateur
          en tenant E5 : la phrase qui expliquait le grisé la faisait passer sur
          trois lignes, repliait les segments avec elle et poussait le bouton
          hors de l'écran. **Elle est descendue dans le panneau**, qui a la
          place d'une phrase ; ici il ne reste que le geste.

          **Sa dernière maison.** L'appui récupère exactement ce que la
          contrainte retire, et c'est pour ça qu'elle est payable. */}
      {peint && (
        <button
          type="button"
          onPointerDown={() => onAvant?.(true)}
          onPointerUp={() => onAvant?.(false)}
          onPointerLeave={() => onAvant?.(false)}
          className="mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border border-bord-fort px-2 text-[10px] text-texte-2 hover:text-signal"
        >
          Avant ›
        </button>
      )}
      {mode === "superpose" && (
        <input
          type="range"
          min={0}
          max={100}
          value={opacite}
          aria-label="Opacité du brut par-dessus le rendu"
          onChange={(e) => onOpacite(Number(e.target.value))}
          className="w-[104px]"
        />
      )}
      {/* Le mode se dit dès que ce n'est pas le rendu. */}
      {mode !== "rendu" && (
        <span className="ml-auto text-epingle">on regarde : {MODES[mode]}</span>
      )}
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export function EcranTables({
  asset,
  soeurs,
  traitement,
  univers,
  ouverte,
  onOuvrir,
  onSoeur,
  decoupe,
  onErreur,
  BlocPasse,
}: {
  asset: Asset
  /** Les images voisines — les attitudes de la chose, ou les tuiles de la
   *  grille. **On passe à l'image voisine sans que la table ouverte se
   *  referme** : c'est le geste qui distingue une table d'un panneau. */
  soeurs: Asset[]
  traitement: EtatTraitement
  univers: Univers
  ouverte: Table
  onOuvrir: (table: Table) => void
  onSoeur: (identifiant: string) => void
  /** La fabrique du découpage, rendue **dans le cadre de la table** — pas
   *  ailleurs. « On ne le cherche plus : il est là quand il sert. » */
  decoupe: React.ReactNode
  onErreur: (raison: string) => void
  /** Le bloc d'une passe de détourage, rendu par la fiche depuis T2. Passé en
   *  paramètre plutôt qu'importé : il vit encore dans la fiche, et E4 le fera
   *  descendre ici avec le reste. */
  BlocPasse: React.ComponentType<any>
}) {
  const { recette, regler, poser, revenirAuBrut } = useRecette(asset, onErreur)
  const mesures = useMesures(asset)
  const [mode, setMode] = useState<Mode>("rendu")
  const [opacite, setOpacite] = useState(50)
  const etatMain = useEtatMain(univers)
  /** **Tenir montre l'avant** — un état d'appui, jamais une bascule : une
   *  bascule laisserait l'écran sur l'avant après le regard, et la retouche
   *  suivante se ferait sur une image qui n'est pas celle qu'on croit. */
  const [avant, setAvant] = useState(false)

  const dehors = indisponible(ouverte, traitement, mesures)
  const reglages = { recette, univers, traitement, regler, poser, mesures }

  /** **Une table qui se peint force le rendu.** Le cas qui a tranché est *côte
   *  à côte* : deux images à l'écran, et la main n'aurait pas su sur laquelle
   *  elle écrit. Un outil dont la cible est ambiguë détruit une fois sur deux
   *  — et l'appui *Avant ›* récupère exactement ce qu'on retire ici, ce qui est
   *  la raison pour laquelle il pouvait disparaître partout ailleurs. */
  const peint = ouverte === "main"
  useEffect(() => {
    if (peint) setMode("rendu")
  }, [peint])

  // Ctrl + Z retire le dernier passage de la couche active. La touche n'est
  // écoutée que dans la table de la main : ailleurs elle appartient à la toile
  // du tableau d'inspiration, et deux piles d'annulation sur la même touche
  // seraient une pile de trop.
  useEffect(() => {
    if (!peint) return
    const ecouter = (evenement: KeyboardEvent) => {
      if (!(evenement.ctrlKey || evenement.metaKey) || evenement.key !== "z") return
      const main = mainDe(recette)
      if (passagesDe(main) === 0) return
      evenement.preventDefault()
      void poser({ ...recette, main: sansLeDernier(main, etatMain.actif) })
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [peint, recette, etatMain.actif, poser])

  return (
    <div data-tables className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BarreDesTables
        recette={recette}
        traitement={traitement}
        mesures={mesures}
        ouverte={ouverte}
        onOuvrir={onOuvrir}
        onToutDefaire={() => void revenirAuBrut()}
      />

      {/* **La fabrique prend le cadre entier.** Elle ne pose rien sur l'image
          courante : elle en écrit d'autres, et le montrer entre une colonne de
          réglages et une colonne de sœurs mentirait sur ce qu'elle fait. */}
      {ouverte === "decoupage" ? (
        decoupe
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_380px]">
        {/* ── La colonne de la table ────────────────────────────────────── */}
        <aside
          {...PANNEAU}
          className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
        >
          <EnTetePanneau>{TABLES.find((t) => t.cle === ouverte)?.nom}</EnTetePanneau>
          <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {dehors ? (
              // **À la place des réglages, jamais à côté d'eux.** Une table
              // indisponible n'a rien à régler : montrer des contrôles morts
              // sous une raison serait proposer puis refuser.
              <Raison texte={dehors} />
            ) : ouverte === "detourage" ? (
              <PanneauDetourage {...reglages} BlocPasse={BlocPasse} />
            ) : ouverte === "recadrage" ? (
              <PanneauRecadrage {...reglages} />
            ) : ouverte === "grille" ? (
              <PanneauGrille {...reglages} />
            ) : ouverte === "quantification" ? (
              <PanneauQuantification {...reglages} />
            ) : ouverte === "bords" ? (
              <PanneauBords {...reglages} />
            ) : ouverte === "contours" ? (
              <PanneauContours {...reglages} />
            ) : ouverte === "main" ? (
              <PanneauMain {...reglages} etat={etatMain} />
            ) : null}
          </div>

          {/* **Le pied de chaque table ne touche qu'elle.** Deux échelles, deux
              endroits, et chacun dit lequel : `tout défaire` vide la recette au
              bout de la barre, `Sans <table>` vide cette place-ci. */}
          {!dehors && VIDER[ouverte] && (
            <button
              type="button"
              onClick={() => void poser(VIDER[ouverte]!(recette))}
              className="mesure h-[26px] shrink-0 border-t border-bord px-3 text-left text-[10px] text-texte-3 hover:text-signal"
            >
              Sans {TABLES.find((t) => t.cle === ouverte)?.nom} ›
            </button>
          )}
        </aside>

        {/* ── L'image, en grand ─────────────────────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center gap-4 p-6">
            {peint ? (
              // **La surface se peint, et elle est la seule.** Pas de poignée,
              // pas de rectangle, pas de cible : une cible de retaille au
              // milieu d'une surface qu'on peint est un piège à clic, et ici
              // toute la surface est peignable.
              <ToileDeLaMain
                asset={asset}
                avant={avant}
                etat={etatMain}
                onPassage={(trait) =>
                  void poser({
                    ...recette,
                    main: avecPassage(mainDe(recette), etatMain.actif, trait),
                  })
                }
              />
            ) : (mode === "rendu" || mode === "brut") && ouverte === "recadrage" ? (
              // **Le rectangle se pose sur l'image, jamais dans un champ.** Le
              // modèle le porte depuis T2 et aucun écran ne l'avait montré : on
              // ne dessine pas un cadrage en tapant quatre nombres, on le
              // dessine en regardant ce qu'il garde.
              <CadreDeRecadrage
                asset={asset}
                boite={
                  (recette.recadrage?.boite as
                    | [number, number, number, number]
                    | undefined) ?? null
                }
                onBoite={(boite) =>
                  void poser({
                    ...recette,
                    recadrage: { marge: recette.recadrage?.marge ?? 0, boite },
                  })
                }
              />
            ) : mode === "rendu" || mode === "brut" ? (
              <img
                src={api.rendu(asset.identifiant, asset.empreinte, mode === "brut")}
                alt={asset.label}
                className="damier max-h-full max-w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : null}
            {mode === "cote" && (
              <>
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte, true)}
                  alt={`${asset.label}, brut`}
                  className="damier max-h-full max-w-[50%] object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte)}
                  alt={`${asset.label}, rendu`}
                  className="damier max-h-full max-w-[50%] object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </>
            )}
            {mode === "superpose" && (
              <span className="relative flex max-h-full max-w-full">
                {/* Le rendu dessous, le brut par-dessus : c'est ce qu'on
                    compare — ce que la recette a retiré. */}
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte)}
                  alt={`${asset.label}, rendu`}
                  className="damier max-h-full max-w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte, true)}
                  alt={`${asset.label}, brut`}
                  style={{ imageRendering: "pixelated", opacity: opacite / 100 }}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </span>
            )}
          </div>
          <Comparateur
            asset={asset}
            mode={mode}
            onMode={setMode}
            opacite={opacite}
            onOpacite={setOpacite}
            peint={peint}
            onAvant={setAvant}
          />
        </div>

        {/* ── Ses sœurs ─────────────────────────────────────────────────── */}
        <aside
          {...PANNEAU}
          className="flex min-h-0 flex-col border-l border-bord bg-fond-1"
        >
          <EnTetePanneau>Ses sœurs</EnTetePanneau>
          <div className="defile flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto p-2">
            {soeurs.map((soeur) => (
              <Soeur
                key={soeur.identifiant}
                asset={soeur}
                courante={soeur.identifiant === asset.identifiant}
                onChoisir={() => onSoeur(soeur.identifiant)}
              />
            ))}
            {soeurs.length === 0 && (
              <p className="mesure text-[10px] text-texte-3">
                cette image n'a pas de voisine
              </p>
            )}
          </div>
        </aside>
      </div>
      )}
    </div>
  )
}

/** Vider une place — **et une seule**. `null` là où il n'y a rien à vider :
 *  une fabrique n'a pas de couche, et son pied de colonne disparaît avec. */
const VIDER: Partial<Record<Table, (r: Recette) => Recette>> = {
  detourage: (r) => ({ ...r, passes: [] }),
  recadrage: (r) => ({ ...r, recadrage: null }),
  grille: (r) => ({ ...r, grille: null }),
  quantification: (r) => ({ ...r, quantification: null }),
  bords: (r) => ({ ...r, bords: null }),
  contours: (r) => ({ ...r, contours: null }),
  // **La pile entière, calques compris.** « Sans la main › » vide la table :
  // garder les calques vidés de leurs passages laisserait une pile qui ne fait
  // rien et que rien n'explique.
  main: (r) => ({ ...r, main: null }),
}

function Soeur({
  asset,
  courante,
  onChoisir,
}: {
  asset: Asset
  courante: boolean
  onChoisir: () => void
}) {
  const visee = useVisee(sujetAsset(asset))
  return (
    <button
      type="button"
      onClick={onChoisir}
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      aria-pressed={courante}
      title={asset.label}
      className={[
        "rounded-[2px] border p-[2px] transition-colors duration-[80ms]",
        courante ? "border-lumiere" : "border-transparent hover:border-bord",
      ].join(" ")}
    >
      <img
        src={sujetAsset(asset).src}
        alt={asset.label}
        className="damier h-[44px] w-[44px] object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  )
}


// ── La surface où la main écrit ─────────────────────────────────────────────

/**
 * L'image en grand, et le passage qu'on y trace.
 *
 * **Les coordonnées sont celles de l'image rendue**, coins inclus — c'est sur
 * elle que la septième place s'applique, et c'est elle qui part dans le jeu.
 * Le cadre *est* l'image, mis à l'échelle par calcul : une boîte qui ment
 * décale ce qu'on pose dessus, et c'est la leçon du cadre de la Découpe.
 *
 * **Le trait se dessine à la largeur et à la couleur qu'il aura.** Sur un
 * calque de dessin, la couleur choisie ; sur l'opacité, `--signal` dans les
 * deux sens — garder et ôter sont deux gestes ordinaires, et `--echec`
 * voudrait dire *ça détruit*, ce qu'une gomme ne fait pas.
 *
 * **Le curseur est un cercle du diamètre choisi.** Il dit ce que le prochain
 * passage couvrira avant qu'on appuie : c'est la moitié du réglage, et sans lui
 * le curseur de diamètre serait un nombre abstrait.
 */
function ToileDeLaMain({
  asset,
  avant,
  etat,
  onPassage,
}: {
  asset: Asset
  avant: boolean
  etat: ReturnType<typeof useEtatMain>
  onPassage: (trait: Trait) => void
}) {
  const [trace, setTrace] = useState<[number, number][] | null>(null)
  const [pointeur, setPointeur] = useState<{ x: number; y: number } | null>(null)
  const cadre = useRef<HTMLDivElement | null>(null)

  // Les dimensions du **rendu** : c'est lui que la main touche. Une recette
  // vide n'en a pas — le rendu *est* le brut, et ce sont ses dimensions.
  const largeur = asset.rendu_largeur || asset.largeur
  const hauteur = asset.rendu_hauteur || asset.hauteur

  const surLOpacite = etat.actif === OPACITE
  const teinte = surLOpacite ? "var(--signal)" : etat.couleur

  /** Le point sous le pointeur, en pixels de l'image rendue. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const boite = evenement.currentTarget.getBoundingClientRect()
    const x = ((evenement.clientX - boite.left) / boite.width) * largeur
    const y = ((evenement.clientY - boite.top) / boite.height) * hauteur
    return [
      Math.max(0, Math.min(largeur - 1, Math.floor(x))),
      Math.max(0, Math.min(hauteur - 1, Math.floor(y))),
    ]
  }

  const terminer = () => {
    if (!trace) return
    setTrace(null)
    onPassage({
      garde: etat.sens,
      rayon: rayonDe(etat.diametre),
      points: trace,
      couleur: surLOpacite ? "" : etat.couleur,
    })
  }

  return (
    <div
      ref={cadre}
      data-toile-main
      style={{ aspectRatio: `${largeur} / ${hauteur}` }}
      className="relative max-h-full max-w-full cursor-none"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        setTrace([point(evenement)])
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        const boite = evenement.currentTarget.getBoundingClientRect()
        setPointeur({
          x: evenement.clientX - boite.left,
          y: evenement.clientY - boite.top,
        })
        if (!trace) return
        const [x, y] = point(evenement)
        const dernier = trace[trace.length - 1]
        // **Un point par pixel, pas un par événement.** Un pointeur envoie ce
        // qu'il peut ; garder les doublons gonflerait la recette sans rien
        // ajouter au tracé, que le serveur relie de toute façon.
        if (dernier[0] === x && dernier[1] === y) return
        setTrace([...trace, [x, y]])
      }}
      onPointerUp={terminer}
      onPointerLeave={() => {
        setPointeur(null)
        terminer()
      }}
    >
      <img
        src={
          avant
            ? api.avant(asset.identifiant, asset.empreinte)
            : api.rendu(asset.identifiant, asset.empreinte)
        }
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Le passage en cours, à sa vraie largeur : elle vaut (2 × rayon + 1)
          pixels d'image, mise à l'échelle du cadre. Zoomer l'épaissit ; c'est
          voulu, puisqu'elle mesure l'image et non le châssis. */}
      {trace && trace.length > 0 && (
        <svg
          aria-hidden
          viewBox={`0 0 ${largeur} ${hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polyline
            points={trace.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
            fill="none"
            stroke={etat.sens ? teinte : "var(--signal)"}
            strokeOpacity={etat.sens ? 1 : 0.45}
            strokeWidth={etat.diametre}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Le curseur : un cercle du diamètre choisi, bord `--signal`, fond à
          18 %. Il ne suit pas le zoom du châssis — il mesure l'image, et sa
          taille à l'écran est celle qu'il couvrira. */}
      {pointeur && cadre.current && (
        <span
          aria-hidden
          style={{
            left: pointeur.x,
            top: pointeur.y,
            width: (etat.diametre / largeur) * cadre.current.clientWidth,
            height: (etat.diametre / largeur) * cadre.current.clientWidth,
          }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal bg-signal/[.18]"
        />
      )}
    </div>
  )
}

// ── Le rectangle de recadrage, posé sur l'image ─────────────────────────────

/**
 * L'image, et le rectangle qu'on y glisse.
 *
 * **Le cadre *est* l'image**, mis à l'échelle par calcul : c'est la leçon du
 * cadre de la Découpe, qui dessine des rectangles depuis T5 — une boîte qui ment
 * décale ce qu'on pose dessus, et ici c'est le rectangle qui tomberait à côté.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, coins inclus : une
 * seule convention de rectangle dans tout le produit, celle du serveur. Le
 * recadrage s'applique avant la remise sur grille, donc c'est bien le brut qu'il
 * découpe.
 */
function CadreDeRecadrage({
  asset,
  boite,
  onBoite,
}: {
  asset: Asset
  boite: [number, number, number, number] | null
  onBoite: (boite: [number, number, number, number] | null) => void
}) {
  const [trace, setTrace] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  )

  /** Le point sous le pointeur, en pixels de l'image brute. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>) => {
    const cadre = evenement.currentTarget.getBoundingClientRect()
    const x = ((evenement.clientX - cadre.left) / cadre.width) * asset.largeur
    const y = ((evenement.clientY - cadre.top) / cadre.height) * asset.hauteur
    return {
      x: Math.max(0, Math.min(asset.largeur - 1, Math.round(x))),
      y: Math.max(0, Math.min(asset.hauteur - 1, Math.round(y))),
    }
  }

  const dessine = trace ?? (boite ? { x0: boite[0], y0: boite[1], x1: boite[2], y1: boite[3] } : null)

  return (
    <div
      data-cadre-recadrage
      style={{ aspectRatio: `${asset.largeur} / ${asset.hauteur}` }}
      className="relative max-h-full max-w-full"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        const { x, y } = point(evenement)
        setTrace({ x0: x, y0: y, x1: x, y1: y })
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        if (!trace) return
        const { x, y } = point(evenement)
        setTrace({ ...trace, x1: x, y1: y })
      }}
      onPointerUp={() => {
        if (!trace) return
        const x0 = Math.min(trace.x0, trace.x1)
        const y0 = Math.min(trace.y0, trace.y1)
        const x1 = Math.max(trace.x0, trace.x1)
        const y1 = Math.max(trace.y0, trace.y1)
        setTrace(null)
        // **Un clic n'est pas un rectangle.** Sous trois pixels de côté, le
        // geste était un clic : il retire le rectangle au lieu d'en poser un
        // d'un pixel, que personne ne voulait.
        if (x1 - x0 < 3 || y1 - y0 < 3) onBoite(null)
        else onBoite([x0, y0, x1, y1])
      }}
    >
      <img
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {dessine && (
        <span
          aria-hidden
          style={{
            left: `${(Math.min(dessine.x0, dessine.x1) / asset.largeur) * 100}%`,
            top: `${(Math.min(dessine.y0, dessine.y1) / asset.hauteur) * 100}%`,
            width: `${((Math.abs(dessine.x1 - dessine.x0) + 1) / asset.largeur) * 100}%`,
            height: `${((Math.abs(dessine.y1 - dessine.y0) + 1) / asset.hauteur) * 100}%`,
          }}
          className="pointer-events-none absolute border border-lumiere bg-lumiere/10"
        />
      )}
    </div>
  )
}
