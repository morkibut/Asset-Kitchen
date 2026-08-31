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

import { useState } from "react"
import { api, type Asset, type EtatTraitement, type Recette, type Univers } from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { EnTetePanneau, Raison, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"
import {
  PanneauBords,
  PanneauDetourage,
  PanneauGrille,
  PanneauQuantification,
  PanneauRecadrage,
  RESUME,
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
function indisponible(table: Table, traitement: EtatTraitement): string | null {
  if (table === "quantification") return traitement.quantification.raison
  if (table === "contours")
    return "le tracé de contour n'est pas encore construit — il arrive avec la table des contours"
  if (table === "main")
    return "la retouche à la main n'est pas encore construite — elle arrive avec la table de la main"
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
  ouverte,
  onOuvrir,
  onToutDefaire,
}: {
  recette: Recette
  traitement: EtatTraitement
  ouverte: Table
  onOuvrir: (table: Table) => void
  onToutDefaire: () => void
}) {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-1 border-b border-bord bg-fond-1 px-4">
      {TABLES.map(({ cle, nom, fabrique }, rang) => {
        const dehors = indisponible(cle, traitement)
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
                "mesure flex h-[24px] items-center gap-1.5 rounded-[2px] px-2 text-[10px] transition-colors duration-[80ms]",
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

      {/* **`tout défaire` vit au bout de la barre, pas dans l'en-tête d'une
          table.** Il y était posé en face du nom de la table, et il vidait la
          recette entière — donc il mentait sur sa portée. La barre *est* la
          recette : le geste qui la vide appartient à ce qui la représente. Le
          pied de chaque table garde son `Sans <table> ›`, qui ne touche qu'elle. */}
      <span aria-hidden className="mx-2 h-4 w-px bg-bord" />
      <button
        type="button"
        onClick={onToutDefaire}
        className="mesure ml-auto flex h-[24px] items-center gap-1.5 px-2 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-echec"
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
}: {
  asset: Asset
  mode: Mode
  onMode: (mode: Mode) => void
  opacite: number
  onOpacite: (opacite: number) => void
}) {
  return (
    <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px]">
      <span className="text-texte-3">
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
        onChange={(v) => onMode(v as Mode)}
      />
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
  onDecouper,
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
  onDecouper: () => void
  onErreur: (raison: string) => void
  /** Le bloc d'une passe de détourage, rendu par la fiche depuis T2. Passé en
   *  paramètre plutôt qu'importé : il vit encore dans la fiche, et E4 le fera
   *  descendre ici avec le reste. */
  BlocPasse: React.ComponentType<any>
}) {
  const { recette, regler, poser, revenirAuBrut } = useRecette(asset, onErreur)
  const [mode, setMode] = useState<Mode>("rendu")
  const [opacite, setOpacite] = useState(50)

  const dehors = indisponible(ouverte, traitement)
  const reglages = { recette, univers, traitement, regler, poser }

  return (
    <div data-tables className="flex min-h-0 flex-1 flex-col">
      <BarreDesTables
        recette={recette}
        traitement={traitement}
        ouverte={ouverte}
        onOuvrir={onOuvrir}
        onToutDefaire={() => void revenirAuBrut()}
      />

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
            ) : ouverte === "decoupage" ? (
              <div className="flex flex-col gap-2">
                <p className="mesure text-[10px] leading-4 text-texte-3">
                  Le découpage coupe cette image en plusieurs. Il n'écrit rien
                  sur elle — c'est une fabrique, et elle n'a pas de carré.
                </p>
                <button
                  type="button"
                  onClick={onDecouper}
                  className="mesure h-[34px] rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11px] text-texte hover:bg-fond-3"
                >
                  Ouvrir le découpage
                </button>
              </div>
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
            {(mode === "rendu" || mode === "brut") && (
              <img
                src={api.rendu(asset.identifiant, asset.empreinte, mode === "brut")}
                alt={asset.label}
                className="damier max-h-full max-w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            )}
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
