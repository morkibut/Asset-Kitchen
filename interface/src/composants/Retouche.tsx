/**
 * La retouche — B16. **La chaîne entière, rangée dans la grammaire du carnet.**
 *
 * `docs/archive/pistes-2026-09-04/carnet/Retouche.dc.html` et les dix
 * `atelier-*.dc.html`. Une profondeur de plus de la page d'un sujet
 * (`interface/src/lieux.ts`, genre `"tables"`), atteinte depuis une image.
 *
 * **Trois choses tiennent cet écran, et elles viennent des planches.**
 *
 * 1. **La barre est horizontale, et les deux fabriques sont à droite du trait.**
 *    C'est le mot de la planche — *« à l'écran elle vit à droite du trait,
 *    parce qu'elle nomme deux images et qu'une table n'en règle qu'une »* —, et
 *    c'est aussi ce qui range le découpage : une fabrique **écrit d'autres
 *    fichiers** au lieu de poser sur celui-ci.
 * 2. **Les réglages sont hors de l'image**, dans la colonne de droite. L'image
 *    prend la place, et on ne règle jamais par-dessus ce qu'on regarde.
 * 3. **Un grisé porte sa raison et le geste qui le rallume**, à côté de lui —
 *    jamais une infobulle (`docs/DESIGN.md`, règle 2).
 *
 * ⚠️ **Huit tables, et non sept.** Les planches en dessinent sept et mettent
 * *Retourner* à part, sous *« n'existe pas »* ; c'était vrai le 4 septembre, et
 * `B1` a livré le retournement depuis. Faire disparaître une table qui existe
 * pour tenir un compte périmé aurait été le contraire de ce qu'on demande —
 * *aucune n'est cachée*.
 *
 * **Cet écran n'ajoute aucun moteur** : c'est le périmètre de `B17` et `B18`.
 * Il range, il nomme, et il montre ce qui manque là où ça manque.
 *
 * **Les quatre gestes qui se posent sur l'image vivent ici** (`B23`) — le
 * rectangle de recadrage, le point de la pipette, la forme entourée et le
 * pinceau de la main. `B16` les avait laissés derrière en promettant leur
 * déménagement ; il a lieu ici, et il est un déménagement : le calcul des
 * quatre surfaces est repris tel quel, seul leur habillage passe au papier.
 * Elles restent ce dont l'invariant du lot U dit qu'il **ne voyage pas** — un
 * point désigne un endroit de *cette* image-là, et la colonne le dit.
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  api,
  CONTOUR_PAR_DEFAUT,
  FORCE_TRAMAGE_LIVREE,
  GARDEES_MAX,
  GARDER_MAX,
  GRAIN_MAX,
  LISSAGE_MAX,
  MAIN_VIDE,
  MORPHOLOGIE_MAX,
  NOM_DE_LA_METHODE,
  NOM_DE_LA_NATURE,
  NOM_FAMILLE,
  PASSE_PAR_DEFAUT,
  RETOURNEMENT_PAR_DEFAUT,
  Refus,
  CE_QUE_LA_METHODE_REND,
  megaoctets,
  occupationMax,
  paliersDeCouleurs,
  type Ancrage,
  type Asset,
  type Bords,
  type Contour,
  type Echange,
  type EtatTraitement,
  type Famille,
  type FormatDeRecadrage,
  type Grille,
  type Impose,
  type Main,
  type Methode,
  type Nature,
  type PaletteNommee,
  type Passe,
  type Quantification,
  type Recadrage,
  type Recette,
  type Retournement,
  type TachesDeLAsset,
  type Trait,
  type Univers,
} from "../api"
import { imageAsset, sujetAsset, useVisee } from "./Apercu"
// **Trois fonctions pures, et rien d'autre de `pieces.tsx`.** Aucun fichier du
// carnet n'importe ce module — il porte le balisage de l'ancien châssis, et ses
// couleurs ne sont pas celles du papier. Ces trois-là n'ont ni balise ni jeton :
// c'est la courbe de la jauge, le battement qui la nourrit, et le rectangle que
// l'image occupe vraiment dans la surface qui reçoit un geste. Les réécrire
// aurait fabriqué **deux vérités sur la même attente**, et c'est précisément la
// panne que cette tranche répare ailleurs.
import { EchantillonDeHauteur, part, rectangleDeLImage, useEcoule } from "./pieces"
import { EcranSuperposition } from "./Superposition"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { useEtatDuParcours } from "./MemoireDuParcours"
import { CommandesDuZoom } from "./CommandesDuZoom"
import { useMainDuParcours } from "./MainDuParcours"
import { useRetoucheBrouillon } from "./RetoucheBrouillon"
import { CadreDialogue } from "./CadreDialogue"
import { EditeurDePixels, mainAvecLesCoups } from "./EditeurDePixels"
import { EnregistrerSous, raisonDEnregistrerSous } from "./EnregistrerSous"
// **Le vocabulaire vient d'un module sans écran** (`B26`). Les listes fermées,
// les fonctions pures et les trois crochets de la recette ne sont pas du
// balisage : ce sont des faits du domaine, et une seconde définition d'un même
// fait finit toujours par diverger de la première.
import {
  CIBLES,
  CURSEURS,
  DURCISSEMENT_LIVRE,
  FINESSES,
  MOITIES_DU_REPLI,
  MOTEUR,
  OPACITE,
  PAIRE_VIDE,
  RESUME,
  SENS_DU_RETOURNEMENT,
  SENS_LIVRES,
  TABLES,
  TOLERANCE_D_UNE_PAIRE_MAX,
  TROUS,
  ZOOM_MAX,
  ZOOM_MIN,
  avecPassage,
  avecVeille,
  copierDansLePressePapier,
  debord,
  defautDeLaPasse,
  defautGrille,
  dort,
  indisponible,
  laPlusSombre,
  lireLePressePapier,
  mainDe,
  passagesDe,
  placeDe,
  quantificationDe,
  rayonDe,
  sansLeDernier,
  uniteDuTrait,
  useMesures,
  useRecette,
  valeur,
  videe,
  type EtatMain,
  type Table,
  type ZoomTable,
} from "../recette"

// ── Le vocabulaire des planches ─────────────────────────────────────────────

/** **Les noms que l'auteur lit, en face des clés que le domaine écrit.**
 *
 *  Les planches et le code ne nomment pas les mêmes choses : `Pixelisation` est
 *  `grille`, `Couleurs` est `quantification`, `Nettoyage` est `bords`, et
 *  `Superposer` est `superposition`. C'est le vocabulaire des planches qui
 *  gagne à l'écran — *le sujet entre dans la case du jeu* se comprend, *la
 *  grille* ne se comprend qu'après avoir lu le code.
 *
 *  ⚠️ **La clé, elle, ne bouge pas** : c'est celle de la recette, et la
 *  renommer changerait l'empreinte de tout ce qui est déjà écrit. */
const NOM_DE_LA_TABLE: Record<Table, string> = {
  detourage: "Détourage",
  recadrage: "Recadrage",
  grille: "Pixelisation",
  quantification: "Couleurs",
  bords: "Nettoyage",
  contours: "Contour",
  retournement: "Retournement",
  main: "Main",
  decoupage: "Découper",
  superposition: "Superposer",
}

/** Ce que chaque table fait, en une phrase — celles de `Retouche.dc.html`. */
const CE_QUE_LA_TABLE_FAIT: Record<Table, string> = {
  detourage: "Le fond part, le sujet reste.",
  recadrage: "Les bords vides sautent.",
  grille: "Le sujet entre dans la case du jeu.",
  quantification: "La palette du monde s'impose.",
  bords: "Les taches détachées s'effacent.",
  contours: "Un trait se retrace autour du sujet.",
  retournement: "Les autres directions, sans repayer.",
  main: "On repeint soi-même, par-dessus.",
  decoupage: "Une image, plusieurs sujets.",
  superposition: "Deux images, un calque.",
}

/** Un chiffre suivi de son mot, accordé. « 1 taches détachées » était vu à
 *  l'écran : le compte est juste, la phrase est fausse, et la phrase est ce
 *  qu'on lit. */
function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}

const NOM_DE_L_ANCRAGE: Record<Ancrage, string> = {
  "haut-gauche": "en haut, à gauche",
  haut: "en haut",
  "haut-droite": "en haut, à droite",
  gauche: "à gauche",
  centre: "au centre",
  droite: "à droite",
  "bas-gauche": "en bas, à gauche",
  bas: "en bas",
  "bas-droite": "en bas, à droite",
}

// ── Les quatre états d'une table ────────────────────────────────────────────

/** **Quatre, et la planche les nomme.** Sa légende dit *posée, elle agit* /
 *  *endormie, réglages gardés* / *rien à faire ici* / *n'existe pas encore*.
 *
 *  Le quatrième n'a plus de locataire : les huit tables et les deux fabriques
 *  existent toutes. Il n'est donc pas dessiné — un état qui ne peut jamais
 *  paraître est une pièce qui ment. */
type Etat = "posee" | "endormie" | "rien" | "vide"

const CE_QUE_L_ETAT_DIT: Record<Etat, string> = {
  posee: "posée, elle agit",
  endormie: "endormie, réglages gardés",
  rien: "rien à faire ici",
  vide: "rien de posé",
}

/** L'état d'une table, **et il se lit dans cet ordre-là**.
 *
 *  *Rien à faire ici* passe devant *endormie* : une table indisponible sur
 *  cette image n'agirait pas même réveillée, et dire « endormie » ferait croire
 *  qu'un clic suffit. */
function etatDe(
  table: Table,
  recette: Recette,
  traitement: EtatTraitement,
  mesures: TachesDeLAsset | null,
): Etat {
  if (indisponible(table, traitement, mesures) !== null) return "rien"
  if (dort(recette, table)) return "endormie"
  return valeur(table, recette) !== null ? "posee" : "vide"
}

/** La pastille — un disque de 8 px, et rien d'autre.
 *
 *  **Le carré barré de l'ancien châssis devient un disque creux.** Les deux
 *  disent la même chose — *il y a quelque chose ici, et ça ne s'applique pas* —,
 *  et le disque est la forme du carnet. */
function Pastille({ etat }: { etat: Etat }) {
  const peinture: Record<Etat, string> = {
    posee: "bg-ok",
    endormie: "border border-encre-4 bg-transparent",
    rien: "border border-trait bg-transparent",
    vide: "border border-contour bg-transparent",
  }
  return (
    <span
      aria-hidden
      data-pastille={etat}
      className={`inline-block h-[8px] w-[8px] shrink-0 rounded-[5px] ${peinture[etat]}`}
    />
  )
}

// ── La jauge ────────────────────────────────────────────────────────────────

/** **240 ms, et jamais avant.**
 *
 *  Elle existait déjà et personne ne la lisait : `useRecette` calcule `enVol`
 *  depuis toujours, et l'écran des tables le jetait. C'est le manque que trois
 *  planches nomment — *« la jauge de l'atelier existe et n'est simplement pas
 *  branchée ici »*.
 *
 *  Le seuil n'est pas un réglage de confort : une queue de recette répond en
 *  29 ms, et y faire clignoter une barre serait pire que de ne rien montrer.
 *  240 ms est la borne de `docs/DESIGN.md` § Motion.
 *
 *  **Elle ne ment pas sur ce qu'elle sait** : linéaire jusqu'à 85 % de l'attente
 *  apprise, puis asymptotique, et le bout n'est jamais atteint. Et **jamais un
 *  pourcentage** — les onze pièces disent *le temps qui reste*.
 *
 *  ⚠️ **Elle ne porte aucun bouton d'annulation, et c'est une décision.** Rien
 *  n'interrompt un calcul : `PUT …/recipe` est synchrone, le calcul a lieu dans
 *  le gestionnaire de requête, et couper la connexion n'arrêterait pas la
 *  machine. Un bouton qui a l'air d'annuler et qui ne fait que cesser d'écouter
 *  est pire que pas de bouton. Ce qui se défait ici, c'est le **réglage**. */
function JaugeDuCalcul({
  enVol,
  quoi,
}: {
  enVol: { depuis: number; attendue: number } | null
  quoi: string
}) {
  const ecoule = useEcoule(enVol?.depuis ?? null)
  if (enVol === null || ecoule < 0.24) return null
  return (
    <div data-jauge-de-retouche className="flex flex-col gap-[4px]">
      {/* **Un filet d'un pixel, et non les deux de l'ancienne jauge.** Les
          planches disent « deux pixels de haut » ; elles décrivent la barre du
          châssis sombre, où un pixel de cyan disparaît. Sur le papier, un filet
          d'un pixel *est* le vocabulaire du carnet — c'est l'épaisseur de tous
          ses traits —, et 2 n'est pas dans la liste fermée des écarts. Élargir
          une liste fermée pour un pixel aurait coûté plus cher que de dessiner
          juste. */}
      <span className="block h-px w-full overflow-hidden bg-trait-faible">
        <span
          className="block h-full bg-encre-3 transition-[width] duration-220 ease-linear"
          style={{ width: `${part(ecoule, enVol.attendue, false) * 100}%` }}
        />
      </span>
      <span className="mesure text-[10.5px] text-encre-4">{quoi}</span>
    </div>
  )
}

// ── Les pièces de la colonne de droite ──────────────────────────────────────

function Etiquette({ children, barree }: { children: ReactNode; barree?: boolean }) {
  return (
    <span
      className={[
        "text-[10.5px] uppercase tracking-[0.14em] text-encre-4",
        // **Barré, et non grisé** (U10) : une passe masquée est toujours là et
        // garde ses réglages. Le grisé dirait *presque vide* ; la barre dit
        // *il y a quelque chose ici, et ça ne s'applique pas*.
        barree ? "line-through" : "",
      ].join(" ")}
    >
      {children}
    </span>
  )
}

/** **La raison d'un grisé, et le geste qui le rallume.**
 *
 *  Règle 2 de `docs/DESIGN.md` : *un bouton éteint dit à côté de lui pourquoi
 *  il l'est, et donne le geste qui le rallume. Jamais une infobulle.* Le geste
 *  est un vrai bouton quand il mène quelque part — la marge du recadrage
 *  renvoie vers *Pixelisation*, où la hauteur fait ce qu'on croyait lui demander. */
function Pourquoi({
  texte,
  geste,
  onGeste,
}: {
  texte: string
  geste?: string
  onGeste?: () => void
}) {
  return (
    <p className="mesure flex flex-wrap items-baseline gap-[4px] text-[10.5px] leading-[1.5] text-encre-4">
      <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
      <span className="min-w-0">{texte}</span>
      {geste && onGeste && (
        <button
          type="button"
          onClick={onGeste}
          className="text-encre-2 underline decoration-pointille underline-offset-2 transition-colors duration-120 hover:text-encre"
        >
          {geste} ›
        </button>
      )}
    </p>
  )
}

/** Un réglage : son nom au-dessus, sa commande dessous, sa raison sous elle.
 *
 *  ⚠️ **`dit` ne sert qu'aux commandes qui ne portent pas leur valeur.** Vu au
 *  navigateur : la tolérance affichait « 28 » à droite du nom **et** « 28 » à
 *  droite de son curseur, et le bord rongé son « 0 » à côté d'un segment déjà
 *  allumé sur 0. Deux fois le même chiffre à deux centimètres l'un de l'autre
 *  se lit comme deux réglages, pas comme un — et `docs/DESIGN.md` dit *la
 *  valeur se lit à droite*, une fois. Aucun essai d'écran ne pouvait le voir :
 *  ils cherchent un texte, et le texte était bien là. */
function Reglage({
  nom,
  dit,
  aide,
  children,
}: {
  nom: string
  /** Ce que la commande ne dit pas elle-même. Un curseur et un choix portent
   *  déjà leur valeur : ils ne passent rien ici. */
  dit?: string
  /** Ce que fait le réglage, en une phrase simple, sous son nom (22 septembre
   *  2026) — l'auteur ne devinait pas à quoi servaient la moitié d'entre eux. */
  aide?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <span className="text-[12px] font-medium text-encre">{nom}</span>
        {dit && <span className="mesure text-[10.5px] text-encre-4">{dit}</span>}
      </div>
      {aide && <p className="text-[11.5px] leading-[1.45] text-encre-3">{aide}</p>}
      {children}
    </div>
  )
}

/** Un choix entre quelques valeurs. **Un cran indisponible se montre grisé,
 *  jamais retiré** — c'est ce qui dit ce que l'atelier saura faire.
 *
 *  ⚠️ **La raison s'écrit sous la rangée, pas dans un `title`.** Vu au
 *  navigateur : « une boîte tracée » était bien grisé, mais sa raison ne
 *  sortait qu'au survol. `docs/DESIGN.md` règle 2 : *un bouton éteint dit à
 *  côté de lui pourquoi il l'est … jamais une infobulle.* Une infobulle ne
 *  s'imprime pas, ne se lit pas au clavier et n'existe pas au doigt. Les
 *  raisons sont donc écrites en clair, dédoublonnées — les quatre sens qui
 *  manquent au retournement partagent une seule ligne. */
function Choix<T extends string | number>({
  valeurs,
  valeur: courante,
  libelles,
  eteints = {},
  onChange,
}: {
  valeurs: readonly T[]
  // **`null` veut dire aucun choix posé** (RP22) : la seule liste où renoncer
  // a un sens est celle du retournement, et un cran qui resterait toujours
  // affiché pressé quand la place est vide interdirait de le voir s'éteindre.
  valeur: T | null
  libelles?: Partial<Record<T, string>>
  eteints?: Partial<Record<T, string>>
  onChange: (v: T) => void
}) {
  const raisons = [...new Set(valeurs.map((v) => eteints[v]).filter(Boolean))] as string[]
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex flex-wrap gap-[4px]">
        {valeurs.map((v) => {
          const raison = eteints[v]
          return (
            <button
              key={String(v)}
              type="button"
              aria-pressed={courante === v}
              disabled={Boolean(raison)}
              onClick={() => onChange(v)}
              className={[
                "h-[26px] rounded-7 border px-[8px] text-[12px] transition-colors duration-120",
                raison
                  ? "cursor-not-allowed border-trait-faible bg-papier-cote text-eteint"
                  : courante === v
                    ? "border-encre-4 bg-carte font-medium text-encre"
                    : "border-trait bg-carte text-encre-3 hover:border-encre-4",
              ].join(" ")}
            >
              {libelles?.[v] ?? String(v)}
            </button>
          )
        })}
      </div>
      {raisons.map((r) => (
        <Pourquoi key={r} texte={r} />
      ))}
    </div>
  )
}

/** Un curseur. **Il ne pose qu'au relâchement** : la valeur suit la main, le
 *  rendu suit la main lâchée — c'est la règle de `useRecette`, et c'est ce qui
 *  évite de payer une file d'attente par cran.
 *
 *  **Et sa valeur s'écrit** (U3, rendue à l'écran neuf le 9 septembre 2026). Le
 *  nombre de droite était en lecture seule : refaire à la souris un réglage
 *  qu'on a noté sur l'image d'à côté est une punition, et c'était un critère
 *  déjà coché du lot `U` que le déménagement de `B25` avait fait retomber.
 *  Le comportement est celui de `Curseur` (`pieces.tsx`), repris et non
 *  réinventé : Entrée valide, Échap rend la valeur d'avant, quitter le champ
 *  vaut Entrée, une valeur hors bornes est **ramenée** — jamais refusée — et la
 *  ligne dessous dit laquelle. Taper un chiffre pendant qu'on tient la
 *  glissière remplit le champ sans qu'on ait eu à le viser.
 *
 *  **Un chiffre écrit vaut un relâchement** : un seul envoi, jamais un par
 *  frappe — la règle de `T2` appliquée à l'autre façon de régler. */
function Glissiere({
  valeur,
  min,
  max,
  unite = "",
  eteint = false,
  nom,
  onRegler,
  onPoser,
}: {
  valeur: number
  min: number
  max: number
  unite?: string
  eteint?: boolean
  nom: string
  onRegler: (v: number) => void
  onPoser: (v: number) => void
}) {
  // **`null` tant qu'on n'écrit pas.** Le champ montre alors la valeur de la
  // glissière, si bien que les deux disent toujours la même chose sans qu'un
  // état ait à les tenir d'accord. Il ne prend une valeur à lui que pendant la
  // frappe, qui est un état de passage.
  const [ecrit, setEcrit] = useState<string | null>(null)
  // Ce qu'on a ramené, et il se dit. Effacé à la frappe suivante.
  const [ramene, setRamene] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseFloat(texte.replace(",", ".").replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(lu)) return
    const pose = Math.max(min, Math.min(max, lu))
    setRamene(
      pose !== lu ? `ramené à ${pose}${unite} — les bornes sont ${min} et ${max}` : null,
    )
    // La valeur bouge et se pose dans le même geste : `onRegler` seul laisserait
    // le réglage à l'écran sans jamais l'appliquer.
    onRegler(pose)
    onPoser(pose)
  }

  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-center gap-[8px]">
        <input
          type="range"
          aria-label={nom}
          value={valeur}
          min={min}
          max={max}
          disabled={eteint}
          onChange={(e) => onRegler(Number(e.target.value))}
          onPointerUp={(e) => onPoser(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => onPoser(Number((e.target as HTMLInputElement).value))}
          // **La frappe pendant qu'on tient la glissière remplit le champ**,
          // sans qu'on ait eu à le viser — le geste des logiciels d'image. Les
          // touches qui font vivre le curseur — les flèches, Origine, Fin — ne
          // sont pas détournées.
          onKeyDown={(e) => {
            if (!/^[0-9]$/.test(e.key)) return
            e.preventDefault()
            setEcrit(e.key)
            setRamene(null)
            champ.current?.focus()
          }}
          className={`curseur h-[22px] min-w-0 flex-1 ${eteint ? "opacity-40" : ""}`}
        />
        <input
          ref={champ}
          type="text"
          inputMode="numeric"
          aria-label={`${nom}, en chiffres`}
          disabled={eteint}
          value={ecrit ?? `${valeur}${unite}`}
          onChange={(e) => {
            setEcrit(e.target.value)
            setRamene(null)
          }}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              valider((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === "Escape") {
              setEcrit(null)
              setRamene(null)
            }
          }}
          // **Quitter le champ vaut Entrée.** Sans quoi une valeur tapée puis
          // abandonnée resterait à l'écran sans agir : le champ dirait une chose
          // et l'image en montrerait une autre.
          onBlur={(e) => ecrit !== null && valider(e.target.value)}
          className={[
            "mesure w-[34px] shrink-0 rounded-7 border border-transparent bg-transparent px-[4px] text-right text-[11.5px] tabular-nums",
            "hover:border-trait focus:border-encre-4 focus:bg-papier-cote focus:outline-none",
            eteint ? "text-eteint" : "text-encre-2",
          ].join(" ")}
        />
      </div>
      {ramene && <Pourquoi texte={ramene} />}
    </div>
  )
}

/** L'interrupteur de la veille. **Éteindre n'est pas vider** (invariant du lot
 *  U) : les réglages restent écrits et se retrouvent tels quels au réveil.
 *
 *  **Exportée pour l'atelier d'une animation** (RP22) : la bascule de
 *  l'établi, posée contre la même table, et pas une seconde écrite à côté. */
export function Interrupteur({
  endormie,
  onBasculer,
}: {
  endormie: boolean
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      data-veille={endormie ? "endormie" : "eveillee"}
      aria-pressed={endormie}
      onClick={onBasculer}
      className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-3 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
    >
      {endormie ? "La réveiller" : "L'endormir"}
    </button>
  )
}

/** Vider une table sans l'éteindre — le second geste de la veille (RP22).
 *
 *  **Elle vide, elle n'endort pas** : posée à côté de `Interrupteur`, jamais à
 *  sa place, parce que les deux gestes ne s'annulent pas l'un l'autre — une
 *  table vidée continue d'agir (sur rien), une table endormie garde son
 *  contenu et cesse d'agir. */
export function RemettreAZero({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-3 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
    >
      Remettre à zéro
    </button>
  )
}

// ── La colonne de droite, table par table ───────────────────────────────────

/** Ce qu'un poste de réglage attend pour se rendre.
 *
 *  ⚠️ **Quatre champs sont facultatifs, et c'est ce qui rend ces postes
 *  montables ailleurs** (`B26`). L'atelier d'une animation les empile sur la
 *  recette d'une bande, qui n'est l'image d'aucun asset : il n'a ni surface où
 *  viser, ni pile de calques, ni barre de places à ouvrir. **L'absence du geste
 *  voyage**, elle ne se remplace pas par une fonction qui ne fait rien : un
 *  bouton inerte ne se distingue pas d'un bouton cassé, et chaque poste dit ce
 *  qui est posé au lieu d'offrir de le poser. */
export type Poste = {
  recette: Recette
  univers: Univers
  traitement: EtatTraitement
  mesures: TachesDeLAsset | null
  regler: (r: Recette) => void
  poser: (r: Recette) => void
  /** Ouvrir une autre place de la barre — le geste que porte un grisé. Absent
   *  là où les postes sont empilés et où il n'y a pas de barre. */
  ouvrir?: (table: Table) => void
  /** Le rang de la passe qui attend son geste **dans l'image**, ou `null`.
   *
   *  **L'état vit au-dessus des deux colonnes** (B23, repris de l'écran des
   *  tables) : la passe se règle à droite et se vise au milieu, et un état tenu
   *  d'un seul côté aurait laissé l'autre l'ignorer. */
  armee?: number | null
  onArmer?: (rang: number | null) => void
  /** Le rang de l'échange (table « Couleurs ») qui attend un clic dans
   *  l'image pour « celle qui part » (RV24) — comme `armee`, mais pour une
   *  pipette qui ne désigne aucune passe de détourage. Un état à part : les
   *  deux pipettes partagent la même surface à coordonnées, jamais le même
   *  rang, et confondre les deux ferait viser une passe en croyant régler un
   *  échange. Absent là où il n'y a pas de surface à coordonnées — l'atelier
   *  d'une bande, qui montre la planche déjà traitée. */
  viseeEchange?: number | null
  onViserEchange?: (rang: number | null) => void
  /** Ce que l'écran tient de la main — le calque actif, le sens, le diamètre et
   *  la couleur. Ils décrivent la **main**, pas l'image : les écrire dans la
   *  recette les aurait fait entrer dans l'empreinte, donc changer de pinceau
   *  aurait recalculé un rendu identique. */
  etatMain?: EtatMain
  /** Combien d'images ce réglage recalcule — l'animation entière dans l'atelier
   *  d'une bande. Sert à dire l'attente d'un modèle de détourage. */
  images?: number
}

/** Une durée écrite à la française : « 1,2 s », « 16 s », « 2 min ». */
function secondesLisibles(secondes: number): string {
  if (secondes >= 90) return `${Math.round(secondes / 60)} min`
  if (secondes >= 10) return `${Math.round(secondes)} s`
  return `${secondes.toFixed(1).replace(".", ",")} s`
}

/** Ce que fait chaque méthode, en une phrase (22 septembre 2026). */
const AIDE_DU_MOTEUR: Record<Passe["moteur"], string> = {
  bord: "Retire le fond uni qui touche les bords de l'image. Le plus rapide, pour un fond d'une seule couleur.",
  couleur: "Tu cliques sur une couleur dans l'image, elle est retirée.",
  modele: "Une IA locale repère le sujet et retire tout le reste. Pour les fonds chargés ou dégradés.",
  trace: "Tu entoures le sujet à la main ; le bord est cherché à l'intérieur.",
  palette: "Les couleurs de la palette du jeu sont protégées ; toute autre couleur reliée au bord de l'image est retirée.",
}

export function ReglagesDuDetourage({
  recette,
  univers,
  traitement,
  mesures,
  poser,
  regler,
  armee,
  onArmer,
  asset,
  onErreur,
  onUnivers,
  images,
}: Poste & {
  /** L'image sur laquelle ce détourage se règle, ou rien.
   *
   *  **Rien, c'est l'atelier d'une animation** (`B26`) : on y règle la recette
   *  d'une bande, qui n'est l'image d'aucun asset. Deux gestes en dépendent —
   *  viser dans l'image et promouvoir ce détourage en défaut du projet — et
   *  **ils s'absentent plutôt que de rester là sans rien faire** : un bouton
   *  inerte ne se distingue pas d'un bouton cassé (`AGENTS.md`, 8nonies). */
  asset?: Asset
  onErreur?: (raison: string) => void
  /** **Le dossier du jeu vient de changer** (M7) — promouvoir un détourage en
   *  défaut du projet l'écrit, et l'atelier doit en tenir compte sans
   *  recharger. Absent, le geste se fait quand même : c'est l'écran d'à côté
   *  qui montrerait l'ancien réglage jusqu'au prochain aller-retour. */
  onUnivers?: (univers: Univers) => void
}) {
  const passes = recette.passes
  /** Les passes repliées (22 septembre 2026) — un état d'écran, pas de recette. */
  const [repliees, setRepliees] = useState<ReadonlySet<number>>(new Set())
  const replier = (rang: number) => setRepliees((avant) => {
    const suite = new Set(avant)
    if (suite.has(rang)) suite.delete(rang); else suite.add(rang)
    return suite
  })
  /** **Aucune image brute sous la main** — l'atelier d'une animation montre la
   *  planche déjà traitée. Les deux gestes qui visent un pixel s'absentent au
   *  lieu d'offrir un bouton qui ne fait rien, et la colonne dit ce qui est
   *  posé plutôt que de faire croire qu'on peut le poser d'ici. */
  const sansSurface = onArmer === undefined
  /** Le catalogue des modèles de silhouette, tel que le serveur le rend (U13).
   *
   *  **Rattrapé en `B26`**, avec le catalogue lui-même : il ne vivait que dans
   *  `BlocPasse` (`Fiche.tsx`), monté par le panneau de l'ancien châssis. Le
   *  moteur `modele` était donc choisissable ici, mais **lequel** ne l'était
   *  pas : `Passe.modele` partait toujours vide, c'est-à-dire au défaut du
   *  produit, sans que rien ne le dise. Vide tant que le serveur n'a pas
   *  répondu — on montre alors le moteur sans son choix de modèle, jamais une
   *  liste devinée. */
  const silhouettes = traitement.silhouettes ?? []
  const grises = {
    ...(Object.fromEntries(
      traitement.moteurs.filter((m) => m.raison).map((m) => [m.nom, m.raison as string]),
    ) as Partial<Record<Passe["moteur"], string>>),
    // **La palette du jeu grisée avec sa raison, comme le modèle par
    // silhouette** (B18) : sans artwork officiel promu, il n'y a aucune
    // couleur à garder — proposer le moteur puis le refuser au premier essai
    // serait exactement l'invariant que `docs/PLAN.md` interdit.
    ...(univers.palette.length === 0
      ? { palette: "aucune palette du jeu — dépose un artwork officiel pour lui en donner une" }
      : {}),
  }

  /** ── Toucher un réglage remontre la passe masquée (U10) ──────────────────
   *
   *  **C'est la règle de la place endormie (U4), un cran plus bas** : poser une
   *  valeur *dit* qu'on veut cette passe, et refuser le curseur parce qu'elle
   *  est masquée obligerait à un geste préalable pour avoir le droit de faire
   *  le geste qu'on voulait. On remontre plutôt que de refuser.
   *
   *  **Et sans annonce, contrairement à la place endormie.** L'annonce existait
   *  là-bas parce que l'interrupteur vit en haut de la colonne, loin du réglage
   *  qu'on touche ; ici le bouton est vingt pixels au-dessus du curseur, et le
   *  bloc cesse d'être grisé sous les doigts — le redire serait dire ce qu'on
   *  voit. */
  const changer = (rang: number, suite: Partial<Passe>) =>
    passes.map((p, i) =>
      i === rang ? { ...(p.masquee ? { ...p, masquee: false } : p), ...suite } : p,
    )

  return (
    <div className="flex flex-col gap-[14px]">
      {passes.length === 0 && (
        <p className="text-[12px] text-encre-3">
          Aucune passe. Le fond est encore là.
        </p>
      )}

      {passes.map((passe, rang) => {
      /** La couleur **mesurée par le serveur sous le point**, jamais recopiée
       *  dans la recette : ce qui part est le point, et une couleur écrite à
       *  côté de lui serait une copie que plus rien ne met à jour. */
      const couleurVisee = mesures?.visees?.[rang] ?? null
      return (
        // **Une passe, une carte** (22 septembre 2026) : un simple filet ne
        // séparait pas une passe de la suivante ni du reste du panneau.
        <section key={rang} data-passe={rang} className="flex flex-col gap-[14px] rounded-8 border border-trait bg-papier p-[14px]">
          <div className={`flex items-center justify-between gap-[8px] ${repliees.has(rang) ? "" : "border-b border-trait-faible pb-[8px]"}`}>
            <h3 className={`min-w-0 text-[13px] font-medium text-encre ${passe.masquee ? "line-through opacity-60" : ""}`}>
              <button type="button" data-replier-passe={rang} aria-expanded={!repliees.has(rang)} onClick={() => replier(rang)} className="flex items-center gap-[6px] text-left hover:text-encre-2">
                <span aria-hidden className={`inline-block text-[10.5px] text-encre-3 transition-transform duration-120 ${repliees.has(rang) ? "" : "rotate-90"}`}>▶</span>
                <span>Passe {rang + 1}<span className="font-normal text-encre-3"> · {MOTEUR[passe.moteur]}</span></span>
              </button>
            </h3>
            {/* **Masquer n'est pas retirer, et les deux mots le disent** (U10,
                rattrapé en `B26` — le geste ne vivait que dans `BlocPasse`) :
                l'un rend la passe au calcul d'un clic, l'autre la perd. Ils
                sont côte à côte parce que c'est là qu'on hésite entre les
                deux. */}
            <div className="flex items-center gap-[4px]">
              <button
                type="button"
                role="switch"
                aria-checked={!passe.masquee}
                aria-label={`passe ${rang + 1} — ${passe.masquee ? "masquée" : "visible"}`}
                onClick={() =>
                  void poser({
                    ...recette,
                    passes: passes.map((p, i) =>
                      i === rang ? { ...p, masquee: !p.masquee } : p,
                    ),
                  })
                }
                className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                {passe.masquee ? "La montrer" : "La masquer"}
              </button>
              <button
                type="button"
                onClick={() =>
                  void poser({ ...recette, passes: passes.filter((_, i) => i !== rang) })
                }
                className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                La retirer
              </button>
            </div>
          </div>
          {!repliees.has(rang) && <>
          {passe.masquee && (
            <Pourquoi texte="masquée : retirée du calcul, elle garde tous ses réglages — la remontrer rend l'image d'avant" />
          )}

          {/* **Les réglages restent lisibles, et ils restent réglables** — le
              grisé de la place endormie, pas un verrou. Les cacher rendrait le
              masque impossible à défaire en connaissance de cause. */}
          <div
            className={[
              "flex flex-col gap-[8px]",
              passe.masquee ? "opacity-50" : "",
            ].join(" ")}
          >
          <Reglage nom="Méthode" aide={AIDE_DU_MOTEUR[passe.moteur]}>
            <Choix
              valeurs={["bord", "couleur", "modele", "trace", "palette"] as const}
              valeur={passe.moteur}
              libelles={MOTEUR}
              eteints={grises}
              onChange={(moteur) =>
                void poser({
                  ...recette,
                  // **Le durcissement suit le moteur** (D1) : le bord ne
                  // produit aucun pixel à demi transparent, le modèle en
                  // produit sur presque tout le sujet. La table le pose comme
                  // le domaine le pose.
                  passes: changer(rang, {
                    moteur,
                    durcissement: DURCISSEMENT_LIVRE[moteur],
                    // **La palette se copie dans la passe au moment du choix**
                    // (B18) — comme `Quantification.palette` avant elle, et
                    // pour la même raison : une recette est un calcul complet,
                    // rejouable sans redemander au projet ce qu'il contenait
                    // ce jour-là.
                    ...(moteur === "palette" ? { palette: univers.palette } : {}),
                  }),
                })
              }
            />
          </Reglage>

          {/* ── Quel modèle de silhouette (U13, rattrapé en `B26`) ───────────
              **Le catalogue décide, jamais une liste en dur.** Le moteur par
              modèle n'en connaissait qu'un seul, écrit dans le code : on ne
              pouvait pas en essayer un autre sans toucher au code. Le choix se
              fait passe par passe, comme le moteur lui-même.

              **Vide veut dire le défaut du produit**, et c'est le serveur qui
              dit lequel — l'écran ne choisit pas de défaut. */}
          {passe.moteur === "modele" && silhouettes.length > 0 && (() => {
            const choisi =
              silhouettes.find((s) => s.nom === passe.modele) ??
              silhouettes.find((s) => s.defaut) ??
              silhouettes[0]
            return (
              <>
                <Reglage nom="Modèle" aide="Les modèles plus lourds suivent mieux les cheveux, la fourrure et les détails fins, mais prennent plus de temps.">
                  <Choix
                    valeurs={silhouettes.map((s) => s.nom)}
                    valeur={choisi.nom}
                    libelles={Object.fromEntries(silhouettes.map((s) => [s.nom, s.titre]))}
                    onChange={(modele) =>
                      void poser({ ...recette, passes: changer(rang, { modele }) })
                    }
                  />
                </Reglage>
                {choisi.secondes_par_image ? (
                  <Pourquoi
                    texte={
                      `≈ ${secondesLisibles(choisi.secondes_par_image)} par image` +
                      (images && images > 1
                        ? ` · ≈ ${secondesLisibles(choisi.secondes_par_image * images)} pour l'animation (${images} images)`
                        : "")
                    }
                  />
                ) : null}
                {/* **Ce que ça pèse, dit avant l'attente** — pas au milieu.
                    Un modèle qui n'est pas encore descendu se rapatrie tout
                    seul au premier rendu ; ce qu'on doit à l'auteur, c'est de
                    le lui annoncer, pas de l'envoyer l'installer à la main. */}
                {!choisi.descendu && !choisi.raison && (
                  <p
                    data-modele-a-descendre
                    role="status"
                    className="mesure text-[10.5px] text-epingle"
                  >
                    {`la première fois, l'atelier descendra ce modèle — ${megaoctets(choisi.octets)}`}
                  </p>
                )}
              </>
            )
          })()}

          {(passe.moteur === "bord" || passe.moteur === "couleur" || passe.moteur === "trace") && (
            <Reglage nom="Tolérance" aide="Plus c'est haut, plus les couleurs proches du fond partent avec lui. Trop haut, le sujet commence à être mangé.">
              <Glissiere
                nom={`tolérance de la passe ${rang + 1}`}
                valeur={passe.tolerance}
                min={0}
                max={255}
                onRegler={(tolerance) =>
                  regler({ ...recette, passes: changer(rang, { tolerance }) })
                }
                onPoser={(tolerance) =>
                  void poser({ ...recette, passes: changer(rang, { tolerance }) })
                }
              />
            </Reglage>
          )}
          <Reglage nom="Grignoter le contour" aide="Retire 0 à 4 pixels autour du sujet, pour effacer le liseré de fond qui reste souvent collé au bord.">
            <Choix
              valeurs={[0, 1, 2, 3, 4] as const}
              valeur={passe.durcissement}
              onChange={(durcissement) =>
                void poser({ ...recette, passes: changer(rang, { durcissement }) })
              }
            />
          </Reglage>

          {/* **Comparer par teinte plutôt que canal par canal** (B18). Un
              fond assombri par une ombre ou un dégradé reste la même couleur
              *tournée* d'un cran plus sombre : la teinte l'ignore, la valeur
              (l'écart par canal) en a besoin d'une tolérance plus large — qui
              mange alors une peau ou un pelage qui n'a rien à voir. */}
          {(passe.moteur === "bord" || passe.moteur === "couleur") && (
            <Reglage nom="Comparer les couleurs" aide="« Par teinte » ignore les ombres et dégradés du fond ; « par canal » est plus strict.">
              <Choix
                valeurs={["canal", "teinte"] as const}
                valeur={passe.teinte ? "teinte" : "canal"}
                libelles={{ canal: "par canal", teinte: "par teinte" }}
                onChange={(choix) =>
                  void poser({ ...recette, passes: changer(rang, { teinte: choix === "teinte" }) })
                }
              />
            </Reglage>
          )}

          {/* **La couleur déclarée du jeu, visée au lieu d'être devinée**
              (B18). `bord` prend par défaut la médiane des quatre bordures ;
              un sujet qui déborde largement sur un bord la fait glisser vers
              sa propre couleur. Grisé sans fond déclaré — proposer un réglage
              qui n'a rien à viser serait un réglage qui n'a l'air que de
              marcher. */}
          {passe.moteur === "bord" && univers.fond && (
            <Reglage nom="Couleur du fond" aide="Le moteur « bord » devine sur les bordures de l'image, sauf si cette passe vise la couleur déclarée du jeu — à choisir ici.">
              <Choix
                valeurs={["", univers.fond] as const}
                valeur={passe.couleur_du_jeu ?? ""}
                libelles={{ "": "devinée sur les bordures", [univers.fond]: "la couleur déclarée du jeu" }}
                onChange={(couleur_du_jeu) =>
                  void poser({ ...recette, passes: changer(rang, { couleur_du_jeu }) })
                }
              />
            </Reglage>
          )}
          {passe.moteur === "bord" && !univers.fond && (
            <Pourquoi texte="aucune couleur déclarée dans les règles du jeu — la médiane des bordures reste devinée" />
          )}

          {passe.moteur === "couleur" && (
            <Reglage nom="Où retirer" aide="« Cette tache » retire seulement la zone touchée autour du point ; « partout » retire cette couleur dans toute l'image.">
              <Choix
                valeurs={["tache", "partout"] as const}
                valeur={passe.portee}
                libelles={{ tache: "cette tache", partout: "partout" }}
                onChange={(portee) =>
                  void poser({ ...recette, passes: changer(rang, { portee }) })
                }
              />
            </Reglage>
          )}

          {passe.moteur === "palette" && (() => {
            const compte = passe.palette?.length ?? 0
            return (
              <Pourquoi
                texte={
                  compte > 0
                    ? `${compte} couleur${compte > 1 ? "s" : ""} du jeu, intouchable${compte > 1 ? "s" : ""} — un pixel qui n'en est aucune, et qui touche un bord, est du fond`
                    : "aucune couleur posée — cette passe ne retire rien, comme une pipette non visée"
                }
              />
            )
          })()}

          {(passe.traits?.length ?? 0) > 0 && (
            <Pourquoi
              texte={`${passe.traits!.length} passage${passe.traits!.length > 1 ? "s" : ""} du pinceau posé${passe.traits!.length > 1 ? "s" : ""} sur cette image, avant le recadrage — ils ne voyagent pas non plus`}
            />
          )}

          {/* ── Les deux gestes qui se posent sur l'image (B23) ─────────────
              **Le bouton arme, l'image reçoit.** Le point de la pipette et la
              forme entourée désignent un endroit de *cette* image-là : ils ont
              besoin de sa surface, et l'invariant du lot U dit qu'ils ne partent
              ni par un collage ni par une recette nommée. La colonne dit donc ce
              qui est posé, et elle ouvre la surface — elle ne règle pas quatre
              nombres à sa place. */}
          {passe.moteur === "couleur" && (
            <Reglage nom="Couleur à retirer" aide="Clique dans l'image sur la couleur du fond.">
              <div className="flex flex-col gap-[4px]">
                {passe.point && couleurVisee && (
                  <span className="flex items-center gap-[8px]">
                    <span
                      aria-hidden
                      style={{ background: couleurVisee }}
                      className="inline-block h-[14px] w-[14px] shrink-0 rounded-5 border border-trait"
                    />
                    <span className="mesure text-[11.5px] text-encre-2">{couleurVisee}</span>
                  </span>
                )}
                {sansSurface ? (
                  <span className="mesure text-[11.5px] text-encre-4">
                    {passe.point
                      ? `${passe.point[0]}, ${passe.point[1]} — visé ailleurs`
                      : "aucun point visé"}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-viser={rang}
                    aria-pressed={armee === rang}
                    onClick={() => onArmer?.(armee === rang ? null : rang)}
                    className="h-[26px] self-start rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
                  >
                    {/* ⚠️ **Les coordonnées ne se disent qu'une fois.** Elles
                        sont écrites sous le bouton, avec ce qu'elles veulent
                        dire ; les répéter sur le bouton se lirait comme deux
                        points visés (`docs/DESIGN.md`, *la valeur se lit une
                        fois*). */}
                    {armee === rang
                      ? "clique dans l'image"
                      : passe.point
                        ? "viser à nouveau ›"
                        : "viser dans l'image ›"}
                  </button>
                )}
              </div>
            </Reglage>
          )}
          {passe.moteur === "couleur" && (
            <Pourquoi
              texte={
                sansSurface
                  ? "la pipette se pose sur l'image brute, dans la retouche — cet écran-ci n'a que la planche déjà traitée"
                  : passe.point
                    ? `le point désigne un endroit de cette image-là · ${passe.point[0]}, ${passe.point[1]} — il ne voyage pas`
                    : "tant qu'aucun point n'est posé, cette passe ne retire rien — et le point qu'on posera ne voyagera pas"
              }
            />
          )}

          {passe.moteur === "trace" && (
            <Reglage nom="Zone du sujet" aide="Entoure le sujet dans l'image : tout ce qui est dehors est retiré.">
              {sansSurface ? (
                <span className="mesure text-[11.5px] text-encre-4">
                  {passe.trace.length > 0
                    ? `${passe.trace.length} points, tracés ailleurs`
                    : "aucune forme entourée"}
                </span>
              ) : (
                <button
                  type="button"
                  data-entourer={rang}
                  aria-pressed={armee === rang}
                  onClick={() => onArmer?.(armee === rang ? null : rang)}
                  className="h-[26px] self-start rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
                >
                  {armee === rang
                    ? "entoure le sujet dans l'image"
                    : passe.trace.length > 0
                      ? `${passe.trace.length} points · entourer à nouveau ›`
                      : "entourer dans l'image ›"}
                </button>
              )}
            </Reglage>
          )}
          {passe.moteur === "trace" && (
            <Pourquoi
              texte={
                sansSurface
                  ? "la sélection se dessine sur l'image brute, dans la retouche — cet écran-ci n'a que la planche déjà traitée"
                  : passe.trace.length > 0
                    ? "le bord est cherché à l'intérieur de ce que tu as entouré — rien ne bouge au-dehors, et cette forme ne voyage pas"
                    : "tant qu'aucune forme n'est entourée, cette passe ne retire rien — et cette forme ne voyage pas"
              }
            />
          )}
          </div>
          </>}
        </section>
      )
      })}

      {/* **Le fond enfermé dans le sujet, et le moyen de l'enlever** (RV25).
          Le cas du bus : un modèle détoure l'objet entier, vitres comprises,
          et le vert du fond reste opaque derrière elles — ni « bord » ni le
          nettoyage des bords ne le disent. La phrase **propose**, elle
          n'agit jamais seule : rien ne change sans ce clic, et ce qu'il ajoute
          est la passe « couleur » qui existe déjà, visant le fond, partout. */}
      {(mesures?.fond_enferme?.zones ?? 0) > 0 && mesures?.fond_enferme.point && (
        <Pourquoi
          texte={`des morceaux du fond restent dans le sujet : ${mesures.fond_enferme.zones} ${pluriel(mesures.fond_enferme.zones, "zone", "zones")}`}
          geste="les retirer aussi"
          onGeste={() => {
            const point = mesures.fond_enferme.point
            if (!point) return
            void poser({
              ...recette,
              passes: [
                ...passes,
                { ...PASSE_PAR_DEFAUT, moteur: "couleur", portee: "partout", point },
              ],
            })
          }}
        />
      )}

      <button
        type="button"
        onClick={() => void poser({ ...recette, passes: [...passes, PASSE_PAR_DEFAUT] })}
        className="h-[30px] rounded-7 border border-dashed border-contour bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        + Ajouter une passe
      </button>
      {passes.length > 0 && <p className="text-[11.5px] leading-[1.45] text-encre-3">Les passes s'appliquent l'une après l'autre : chacune retire ce que la précédente a laissé.</p>}

      {/* **La couleur du fond se devine par défaut, et se vise depuis B18.**
          Le jeu la déclare dans ses règles, elle part dans le prompt — et
          `atelier/domaine/fond.py` reste hors de la recette et du traitement
          (B16) : c'est le réglage « couleur visée » de chaque passe `bord`,
          ci-dessus, qui copie la couleur déclarée au lieu de la relire en
          direct. Sans lui, le détourage reprend la médiane des bordures,
          qu'un sujet débordant sur un bord fait basculer. */}

      {/* **Promouvoir suppose une image à promouvoir.** Le geste écrit le
          détourage de *cette image-ci* dans les règles du jeu, avec sa portée —
          la nature de l'image, ou la famille de ce qu'elle montre. Une frame
          d'animation n'a ni l'une ni l'autre : le geste s'absente, il ne se
          grise pas. */}
      {asset !== undefined && onErreur !== undefined && (
        <PromotionDuDetourage
          asset={asset}
          recette={recette}
          univers={univers}
          onUnivers={onUnivers}
          onErreur={onErreur}
        />
      )}
    </div>
  )
}

// ── Promouvoir un détourage en défaut du projet (M7, déménagé en `B24`) ─────
//
// **Le geste inverse de l'étape des réglages, et le calcul est celui de
// `Tables.tsx`, repris tel quel** — seul l'habillage passe au papier du
// carnet. L'étape *Le détourage de départ* est la onzième des douze de
// l'univers : on la traverse en réglant son jeu, avant d'avoir fabriqué la
// moindre image, alors qu'on ne sait quel détourage convient qu'après en
// avoir vu quelques-unes. Ici, on règle, on regarde, et l'on dit « garde ça ».
//
// **Une portée se choisit, elle ne se devine pas.** Le produit en connaît deux
// pour un détourage : la nature de l'image — venue seule, ou découpée d'une
// planche — et la famille de ce qu'elle montre. Les deux sont proposées,
// jamais l'une supposée.
function PromotionDuDetourage({
  asset,
  recette,
  univers,
  onUnivers,
  onErreur,
}: {
  asset: Asset
  recette: Recette
  univers: Univers
  onUnivers?: (univers: Univers) => void
  onErreur: (raison: string) => void
}) {
  /** **La nature de l'image et sa famille viennent du serveur**, qui est le
   *  seul à les savoir : la famille se lit dans le barème du jeu, jamais sur
   *  l'image. C'est la même route que la fiche interroge. */
  const [impose, setImpose] = useState<Impose | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [pose, setPose] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    setImpose(null)
    setOuvert(false)
    setPose(null)
    void api
      .imposeSurAsset(asset.identifiant)
      .then((recu) => {
        if (vivant) setImpose(recu)
      })
      .catch(() => {
        if (vivant) setImpose(null)
      })
    return () => {
      vivant = false
    }
  }, [asset.identifiant])

  // **La première passe, et c'est structurel, pas arbitraire.** Un défaut ne
  // porte qu'une passe : c'est celle qui s'applique à une image que personne
  // n'a encore touchée, donc la première. Les suivantes corrigent *cette*
  // image-là, sur ce que la première a déjà retiré.
  const premiere = recette.passes[0] ?? null
  const famille = (impose?.detourage?.famille ?? "") as Famille | ""
  const nature = impose?.nature ?? ""

  if (!premiere || nature === "") return null

  const poserDefaut = async (quoi: "nature" | "famille") => {
    const defaut = defautDeLaPasse(premiere)
    try {
      const recu = await api.reglerUnivers(
        quoi === "nature"
          ? nature === "planche"
            ? { detourage_planche: defaut }
            : { detourage_image: defaut }
          : {
              // **Le dictionnaire entier repart**, pas seulement la case qu'on
              // change : le serveur lit ce champ comme la liste complète des
              // familles réglées.
              detourages: {
                ...Object.fromEntries(
                  Object.entries(univers.detourages).map(([f, p]) => [
                    f,
                    defautDeLaPasse(p),
                  ]),
                ),
                [famille as Famille]: defaut,
              },
            },
      )
      onUnivers?.(recu.univers)
      setOuvert(false)
      setPose(
        quoi === "nature"
          ? NOM_DE_LA_NATURE[nature as Nature]
          : `tout ce que tu ranges dans ${NOM_FAMILLE[famille as Famille]}`,
      )
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "réglage refusé")
    }
  }

  const resume =
    `${MOTEUR[premiere.moteur]} · tolérance ${premiere.tolerance}` +
    ` · seuil ${premiere.seuil_alpha}` +
    ` · ${premiere.durcissement} px rongé${premiere.durcissement > 1 ? "s" : ""}`

  if (!ouvert)
    return (
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <button
          type="button"
          data-promouvoir-detourage
          onClick={() => {
            setPose(null)
            setOuvert(true)
          }}
          className="text-[12px] text-encre-2 underline decoration-pointille underline-offset-2 transition-colors duration-120 hover:text-encre"
        >
          enregistrer ce réglage comme défaut du jeu ›
        </button>
        {/* **Ce qui vient d'être posé se dit ici, et dit où le relire.** Un
            geste dont l'effet vit dans un autre écran doit nommer cet écran. */}
        {pose && (
          <p role="status" className="text-[12px] leading-[1.5] text-encre-ok">
            c'est fait — {pose} partira désormais de ce détourage. Ça se relit
            dans Univers › réglages › Le détourage de départ.
          </p>
        )}
      </div>
    )

  return (
    <div
      data-portee-du-defaut
      className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]"
    >
      <Etiquette>en faire un défaut du jeu</Etiquette>
      <p className="text-[12px] leading-[1.5] text-encre-3">{resume}</p>
      {/* **Deux portées, nommées par ce qu'elles couvrent** — jamais par le
          mot du dépôt. */}
      <button
        type="button"
        onClick={() => void poserDefaut("nature")}
        className="text-[12px] text-encre-2 underline decoration-pointille underline-offset-2 transition-colors duration-120 hover:text-encre self-start"
      >
        pour {NOM_DE_LA_NATURE[nature as Nature]} ›
      </button>
      {famille && famille !== "tous" ? (
        <button
          type="button"
          onClick={() => void poserDefaut("famille")}
          className="text-[12px] text-encre-2 underline decoration-pointille underline-offset-2 transition-colors duration-120 hover:text-encre self-start"
        >
          pour tout ce que tu ranges dans {NOM_FAMILLE[famille]} ›
        </button>
      ) : (
        // **Sans famille, on ne propose pas une portée vide.**
        <Pourquoi texte="cette image n'a pas de famille — ce que tu fabriquais ne la nommait pas" />
      )}
      <Pourquoi texte="aucune image déjà faite n'est retouchée : un défaut vaut pour ce qui arrivera" />
      {recette.passes.length > 1 && (
        <Pourquoi
          texte={`la passe 1 seule — un défaut n'en porte qu'une, et les ${recette.passes.length - 1} suivantes corrigent cette image-ci`}
        />
      )}
      {(premiere.moteur === "couleur" || premiere.moteur === "trace") && (
        <Pourquoi texte="ce que tu as visé dans l'image ne part pas avec — un défaut n'a pas d'image où viser" />
      )}
      <button
        type="button"
        onClick={() => setOuvert(false)}
        className="text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre self-start"
      >
        annuler
      </button>
    </div>
  )
}

/** Les huit champs, aucun optionnel — **ce que cette colonne envoie toujours**,
 *  quand bien même le type `Recadrage` du port les laisse absents pour les
 *  appelants qui n'en ont pas besoin (`ReglagesDuRecadrage` monté par
 *  `AtelierDeBande.tsx`). */
type RecadrageComplet = Required<Recadrage>

const RECADRAGE_PAR_DEFAUT: RecadrageComplet = {
  marge: 0,
  boite: null,
  taille: null,
  format: "",
  multiple: 0,
  masse: false,
  ligne_pied: null,
  bord_uni: false,
}

const NOM_DU_FORMAT: Record<FormatDeRecadrage, string> = {
  "": "libre",
  carre: "carré",
  "2:1": "2 pour 1",
  "3:4": "3 pour 4",
}

export function ReglagesDuRecadrage({ recette, mesures, regler, poser, ouvrir }: Poste) {
  // **Toujours les huit champs**, jamais un objet partiel (B18) : un envoi qui
  // n'en garderait que deux effacerait les six autres au premier geste posé
  // depuis cette colonne — la même faute que `decalage` en E17.
  const recadrage: RecadrageComplet = { ...RECADRAGE_PAR_DEFAUT, ...(recette.recadrage ?? {}) }
  const vu = mesures?.recadrage ?? null
  // ⚠️ **La condition vient du serveur, jamais d'ici** (B16). L'écran la
  // dérivait de `recette.grille != null`, et c'est faux dans trois cas : grille
  // endormie, grille sans détourage vif, et l'inverse. La règle vit une seule
  // fois, dans `Recette.marge_sans_effet`.
  const margeAvalee = vu?.marge_sans_effet ?? false
  const hauteurOrigine = vu?.origine[1] ?? 0
  const changer = (suite: Partial<RecadrageComplet>): RecadrageComplet => ({
    ...recadrage,
    ...suite,
  })
  return (
    <div className="flex flex-col gap-[14px]">
      <Reglage nom="ce qu'on garde">
        <Choix
          valeurs={["sujet", "tracee"] as const}
          valeur={recadrage.boite ? "tracee" : "sujet"}
          libelles={{ sujet: "la boîte du sujet", tracee: "une boîte tracée" }}
          // **La raison a changé de sens avec `B23`** : le rectangle se trace
          // désormais *ici*, sur l'image à gauche. Le cran reste éteint tant
          // qu'aucune boîte n'est tracée — il n'y a rien à choisir —, et sa
          // phrase dit maintenant le geste au lieu de renvoyer ailleurs.
          eteints={
            recadrage.boite
              ? {}
              : { tracee: "glisse le rectangle sur l'image, à gauche — il ne se tape pas en quatre nombres" }
          }
          onChange={(quoi) => {
            if (quoi === "sujet" && recadrage.boite)
              void poser({ ...recette, recadrage: changer({ boite: null }) })
          }}
        />
      </Reglage>

      {vu?.sujet && (
        <p className="mesure text-[10.5px] text-encre-4">
          {recadrage.boite ? "tracée à la main" : "mesurée sur l'alpha"} ·{" "}
          {(recadrage.boite ?? vu.sujet).join(", ")}
        </p>
      )}

      <Reglage nom="marge">
        <Glissiere
          nom="marge du recadrage"
          valeur={recadrage.marge}
          min={0}
          max={64}
          unite=" px"
          // **Éteinte pour de bon, pas seulement commentée** (B16). La phrase
          // était déjà là et le curseur restait actif : on ne tenait que la
          // moitié de la règle 2.
          eteint={margeAvalee}
          onRegler={(marge) => regler({ ...recette, recadrage: changer({ marge }) })}
          onPoser={(marge) => void poser({ ...recette, recadrage: changer({ marge }) })}
        />
      </Reglage>
      {margeAvalee && (
        <Pourquoi
          texte="la case avale la marge : c'est la hauteur qui donne l'air autour du sujet"
          geste="Pixelisation"
          onGeste={ouvrir ? () => ouvrir("grille") : undefined}
        />
      )}

      {/* **Le format verrouillé** (B18) : le rectangle grandit depuis son
          centre pour tenir ce rapport, au lieu de partir en losange. */}
      <Reglage nom="format">
        <Choix
          valeurs={["", "carre", "2:1", "3:4"] as const}
          valeur={recadrage.format}
          libelles={NOM_DU_FORMAT}
          onChange={(format) => void poser({ ...recette, recadrage: changer({ format }) })}
        />
      </Reglage>

      {/* **Le calage sur un multiple** (B18) : les bords bas et droit du
          rectangle sautent au multiple choisi, jamais entre deux. */}
      <Reglage nom="caler sur un multiple">
        <Choix
          valeurs={[0, 8, 16, 32] as const}
          valeur={recadrage.multiple}
          libelles={{ 0: "aucun", 8: "8", 16: "16", 32: "32" }}
          onChange={(multiple) => void poser({ ...recette, recadrage: changer({ multiple }) })}
        />
      </Reglage>

      {/* **Le rognage d'un bord de couleur unie** (B18) : la boîte se cherche
          par couleur plutôt que par transparence, sans passer par le
          détourage d'abord. */}
      <Reglage nom="ce qui borde le sujet">
        <Choix
          valeurs={["non", "oui"] as const}
          valeur={recadrage.bord_uni ? "oui" : "non"}
          libelles={{ non: "la transparence", oui: "un bord de couleur unie" }}
          onChange={(quoi) =>
            void poser({ ...recette, recadrage: changer({ bord_uni: quoi === "oui" }) })
          }
        />
      </Reglage>

      {/* **La ligne de pied** (B18) : un rang de l'image d'origine, tracé une
          fois, sur lequel le bas du rectangle se cale. */}
      <Reglage nom="ligne de pied">
        <Choix
          valeurs={["non", "oui"] as const}
          valeur={recadrage.ligne_pied !== null ? "oui" : "non"}
          libelles={{ non: "non posée", oui: "posée" }}
          onChange={(quoi) =>
            void poser({
              ...recette,
              recadrage: changer({
                ligne_pied:
                  quoi === "oui" ? (vu?.sujet?.[3] ?? Math.max(0, hauteurOrigine - 1)) : null,
              }),
            })
          }
        />
      </Reglage>
      {recadrage.ligne_pied !== null && hauteurOrigine > 0 && (
        <Glissiere
          nom="ligne de pied"
          valeur={recadrage.ligne_pied}
          min={0}
          max={Math.max(0, hauteurOrigine - 1)}
          unite=" px"
          onRegler={(ligne_pied) => regler({ ...recette, recadrage: changer({ ligne_pied }) })}
          onPoser={(ligne_pied) => void poser({ ...recette, recadrage: changer({ ligne_pied }) })}
        />
      )}

      {/* **Un cadre de taille imposée** (B18) : le sujet se loge dans
          exactement `largeur × hauteur`, agrandi ou réduit pour tenir. Deux
          curseurs à zéro veulent dire *aucune taille imposée*. */}
      <Reglage nom="taille imposée" dit={recadrage.taille ? `${recadrage.taille[0]} × ${recadrage.taille[1]} px` : "aucune"}>
        <div className="flex flex-col gap-[6px]">
          <Glissiere
            nom="largeur imposée"
            valeur={recadrage.taille?.[0] ?? 0}
            min={0}
            max={2048}
            unite=" px"
            onRegler={(largeur) => {
              const hauteur = recadrage.taille?.[1] ?? largeur
              regler({
                ...recette,
                recadrage: changer({ taille: largeur > 0 && hauteur > 0 ? [largeur, hauteur] : null }),
              })
            }}
            onPoser={(largeur) => {
              const hauteur = recadrage.taille?.[1] ?? largeur
              void poser({
                ...recette,
                recadrage: changer({ taille: largeur > 0 && hauteur > 0 ? [largeur, hauteur] : null }),
              })
            }}
          />
          <Glissiere
            nom="hauteur imposée"
            valeur={recadrage.taille?.[1] ?? 0}
            min={0}
            max={2048}
            unite=" px"
            onRegler={(hauteur) => {
              const largeur = recadrage.taille?.[0] ?? hauteur
              regler({
                ...recette,
                recadrage: changer({ taille: largeur > 0 && hauteur > 0 ? [largeur, hauteur] : null }),
              })
            }}
            onPoser={(hauteur) => {
              const largeur = recadrage.taille?.[0] ?? hauteur
              void poser({
                ...recette,
                recadrage: changer({ taille: largeur > 0 && hauteur > 0 ? [largeur, hauteur] : null }),
              })
            }}
          />
        </div>
      </Reglage>
      {/* **Centré sur la masse** (B18) — ne change quelque chose que si une
          taille imposée laisse un espace vide sur un axe. */}
      <Reglage nom="centrage">
        <Choix
          valeurs={["non", "oui"] as const}
          valeur={recadrage.masse ? "oui" : "non"}
          libelles={{ non: "sur le rectangle", oui: "sur la masse du sujet" }}
          onChange={(quoi) =>
            void poser({ ...recette, recadrage: changer({ masse: quoi === "oui" }) })
          }
        />
      </Reglage>
      {recadrage.masse && !recadrage.taille && (
        <Pourquoi texte="sans effet ici : le centrage ne se voit que sur une taille imposée" />
      )}
    </div>
  )
}

export function ReglagesDeLaGrille({
  recette,
  univers,
  traitement,
  regler,
  poser,
  sansAncrage = false,
}: Poste & {
  /** **Retirer l'ancrage de ce poste**, parce qu'il appartient à autre chose là
   *  où l'on s'en sert.
   *
   *  Sur une image, l'ancrage est un réglage de la grille comme un autre. Sur
   *  une **animation**, il appartient à la bande entière : il décide par où le
   *  sujet tient dans sa case, et un ancrage par image ferait sauter le
   *  personnage d'une frame à l'autre. L'atelier d'une animation le rend donc
   *  avec la vitesse et le sens, et il serait ici une seconde commande du même
   *  réglage — à une portée différente, ce qui est pire que deux fois la
   *  même. */
  sansAncrage?: boolean
}) {
  const grille: Grille = recette.grille ?? defautGrille()
  const plafond = occupationMax(grille.cible)
  const grisees = Object.fromEntries(
    traitement.reductions.filter((r) => r.raison).map((r) => [r.nom, r.raison as string]),
  ) as Partial<Record<Methode, string>>
  // **La liste suit le style du jeu** — c'est l'autre moitié de la
  // contradiction du plafond. En pixel art la case est un nombre de carrés
  // (8 → 512) ; en dessin c'est une finesse (256 → 2048), et un jeu réglé sur
  // 1024 n'avait ici aucun cran à cliquer. L'assistant et les règles du jeu
  // font déjà ce partage : la table le refusait, seule.
  const dessin = univers.style === "dessin"
  const tailles: readonly number[] = dessin ? FINESSES : CIBLES
  const changer = (suite: Partial<Grille>) =>
    void poser({ ...recette, grille: { ...grille, ...suite } })
  return (
    <div className="flex flex-col gap-[14px]">
      <Reglage nom={dessin ? "finesse" : "taille de case"}>
        <Choix
          valeurs={tailles}
          valeur={grille.cible}
          onChange={(cible) =>
            // Le plafond de hauteur descend quand la case monte : on ramène la
            // valeur sous le nouveau plafond plutôt que d'envoyer un refus.
            changer({ cible, occupation: Math.min(grille.occupation, occupationMax(cible)) })
          }
        />
      </Reglage>

      <Reglage nom="hauteur">
        <Glissiere
          nom="hauteur dans la case"
          valeur={grille.occupation}
          min={10}
          max={plafond}
          unite=" %"
          onRegler={(occupation) => regler({ ...recette, grille: { ...grille, occupation } })}
          onPoser={(occupation) => changer({ occupation })}
        />
      </Reglage>
      <EchantillonDeHauteur
        occupation={grille.occupation}
        cible={grille.cible}
        haut={64}
        largeur={34}
      />

      {!sansAncrage && (
        <Reglage nom="ancrage">
          <Choix
            valeurs={Object.keys(NOM_DE_L_ANCRAGE) as Ancrage[]}
            valeur={grille.ancrage}
            libelles={NOM_DE_L_ANCRAGE}
            onChange={(ancrage) => changer({ ancrage })}
          />
        </Reglage>
      )}

      <Reglage nom="façon de réduire">
        <Choix
          valeurs={traitement.reductions.map((r) => r.nom)}
          valeur={grille.methode}
          libelles={NOM_DE_LA_METHODE}
          eteints={grisees}
          onChange={(methode) => changer({ methode })}
        />
      </Reglage>
      {/* **Ce que cette méthode-là rend**, en une ligne (rattrapé en `B26`).
          Un libellé de trois mots ne dit pas ce qu'on gagne et ce qu'on perd,
          et c'est précisément ce qui départage les quatre. */}
      <Pourquoi texte={CE_QUE_LA_METHODE_REND[grille.methode]} />

      {/* **Le décalage est une coordonnée** (E17) : il n'est écrit que par le
          calibrage, il ne se règle pas ici, et il ne voyage pas. Le montrer
          plutôt que le taire évite de croire l'image centrée. */}
      {grille.decalage !== 0 && (
        <Pourquoi
          texte={`décalé de ${grille.decalage} px dans sa case — posé par le calibrage, et cette coordonnée ne voyage pas`}
        />
      )}
    </div>
  )
}

export function ReglagesDesCouleurs({
  recette,
  univers,
  traitement,
  mesures,
  regler,
  poser,
  viseeEchange,
  onViserEchange,
  asset,
}: Poste & {
  /** L'image sur laquelle la pipette de « celle qui part » se pose (RV24).
   *
   *  **Absente dans l'atelier d'une bande** (`AtelierDeBande.tsx`), qui règle
   *  la recette d'une planche et non l'image d'un asset — même absence que
   *  `asset` sur `ReglagesDuDetourage`, pour la même raison : le geste
   *  s'efface plutôt que d'offrir un bouton qui ne ferait rien. */
  asset?: Asset
}) {
  const valeurs = quantificationDe(recette, univers)
  const paliers = paliersDeCouleurs(recette.grille?.cible ?? 64)
  /** **Les couleurs de l'image telle qu'elle sort de la réduction** (RV24) —
   *  avant celles du jeu, puisque c'est elles qui manquaient : *« dans la
   *  grille des couleurs affichée, il n'y a pas le vert que je vois sur
   *  l'image »*. Mesurées par le serveur sur le rendu du brouillon en cours,
   *  jamais lues dans le navigateur — la liste change donc avec la recette,
   *  sans second calcul côté écran. */
  const couleursImage = mesures?.couleurs?.liste ?? []
  /** **Une palette vide veut dire *déduite de l'image elle-même***, et le
   *  domaine le dit depuis `T2`. L'écran lisait déjà ce fait — c'est lui qui
   *  grise l'algorithme —, mais aucun poste ne le **posait** : on reposait
   *  toujours celle du jeu. Rattrapé en `B26` : le geste ne vivait que dans le
   *  panneau de l'ancien châssis, et les deux régimes rendent des images
   *  franchement différentes. */
  const surLImage = valeurs.palette.length === 0

  /** **« 24 demandées, 14 obtenues »** (`B18`) — le seul chiffre qui explique
   *  pourquoi monter le réglage ne change plus rien. Il vient du serveur, qui le
   *  lit sur le rendu final ; le recalculer ici demanderait de décoder l'image,
   *  et donnerait un second compte qui finirait par ne plus dire le premier. */
  const compte = mesures?.couleurs ?? null

  /** **Toujours la table entière, jamais deux champs sur neuf** (B17, la leçon
   *  de `decalage` / E17) : reposer le nombre de couleurs à côté d'un échange
   *  déjà posé ne doit pas le faire disparaître. */
  const avec = (suivant: Partial<Quantification>): Recette => ({
    ...recette,
    quantification: { ...valeurs, ...suivant },
  })

  /** **Les palettes nommées du jeu** (TS12) — celles qu'on fabrique sur la
   *  toile. `null` le temps de les lire : sans ça, une recette qui nomme une
   *  palette dirait « elle n'existe plus » avant que la liste n'arrive. */
  const palettes = usePalettesDuJeu()
  const nommee = valeurs.palette_nommee ?? ""
  const choisie = nommee && palettes ? palettes.find((p) => p.identifiant === nommee) ?? null : null
  const perdue = Boolean(nommee) && palettes !== null && choisie === null
  const aChange = choisie !== null && !memesCouleurs(choisie.rendue, valeurs.palette)
  /** **Le jeu et l'image effacent la provenance** : la copie ne vient plus
   *  d'une palette nommée, et la garder ferait dire à l'écran le nom d'une
   *  palette qui n'y est plus. */
  const sansProvenance = { palette_nommee: undefined, palette_nom: undefined }
  /** **La palette se copie dans la recette au moment du choix** (TS12, la
   *  règle de `B26` pour le jeu) — ses couleurs, son identifiant pour la
   *  retrouver, son nom pour la dire. Si elle change ensuite sur la toile, la
   *  recette rend toujours la même image. */
  const prendre = (palette: PaletteNommee) =>
    void poser(
      avec({
        palette: palette.rendue,
        palette_nommee: palette.identifiant,
        palette_nom: palette.nom,
      }),
    )

  return (
    <div className="flex flex-col gap-[14px]">
      {/* ── D'où viennent les couleurs (rattrapé en `B26`, étendu en TS12) ──
          **Trois sources.** *Le jeu* copie la palette du projet dans la
          recette ; *l'image* la vide, et l'algorithme choisi ci-dessous décide
          alors des couleurs sur l'image elle-même ; *une palette nommée* de la
          toile copie les siennes, et garde son nom pour qu'on la reconnaisse. */}
      <Reglage nom="couleurs de">
        <Choix
          valeurs={["le jeu", "l'image"] as const}
          valeur={nommee ? null : surLImage ? "l'image" : "le jeu"}
          eteints={
            univers.palette.length === 0
              ? {
                  "le jeu":
                    "ce jeu n'a pas de palette — dépose un artwork officiel pour lui en donner une",
                }
              : {}
          }
          onChange={(source) =>
            // **La palette se copie dans la recette au moment du choix**, comme
            // celle d'une passe `palette` : une recette est un calcul complet,
            // rejouable sans redemander au projet ce qu'il contenait ce jour-là.
            void poser(
              avec({
                palette: source === "l'image" ? [] : univers.palette,
                ...sansProvenance,
              }),
            )
          }
        />
        {palettes && palettes.length > 0 && (
          <PalettesDuJeu palettes={palettes} choisie={nommee} onChoisir={prendre} />
        )}
        {perdue && (
          <Pourquoi
            texte={`la palette « ${valeurs.palette_nom || nommee} » n'existe plus — ses ${valeurs.palette.length} couleurs restent dans la recette`}
          />
        )}
        {aChange && choisie && (
          <div
            data-palette-changee
            className="flex flex-wrap items-center gap-[8px] text-[11.5px] leading-[1.45] text-encre-3"
          >
            <span>la palette « {choisie.nom} » a changé depuis — la recette garde ses anciennes couleurs</span>
            <button
              type="button"
              className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-4"
              onClick={() => prendre(choisie)}
            >
              Reprendre ses couleurs
            </button>
          </div>
        )}
      </Reglage>

      <Reglage nom="couleurs">
        <Choix
          valeurs={paliers}
          valeur={valeurs.couleurs}
          onChange={(couleurs) => void poser(avec({ couleurs }))}
        />
      </Reglage>

      {/* ── D'où viennent les couleurs, et comment on les choisit (B18) ─────
          Le premier réglage de la table dans la planche : *« Où on prend les
          couleurs »*. Grisé quand la palette du jeu est posée — c'est elle qui
          décide alors, et l'algorithme n'a plus rien à choisir. */}
      <Reglage nom="algorithme">
        <Choix
          valeurs={["mediane", "kmoyennes", "octree"] as const}
          valeur={valeurs.algorithme ?? "mediane"}
          libelles={{
            mediane: "coupe médiane",
            kmoyennes: "k-moyennes",
            octree: "découpe en huit",
          }}
          eteints={
            valeurs.palette.length > 0
              ? {
                  mediane: SOUS_LA_PALETTE,
                  kmoyennes: SOUS_LA_PALETTE,
                  octree: SOUS_LA_PALETTE,
                }
              : {}
          }
          onChange={(algorithme) => void poser(avec({ algorithme }))}
        />
      </Reglage>

      {/* **La graine ne paraît qu'avec k-moyennes**, seul algorithme qui tire
          quelque chose. La montrer ailleurs serait un réglage qui ne fait
          rien — ce que `docs/PIEGES.md` compte comme pire qu'un réglage
          absent. */}
      {valeurs.algorithme === "kmoyennes" && valeurs.palette.length === 0 && (
        <>
          <Reglage nom="graine">
            <Glissiere
              nom="graine"
              valeur={valeurs.graine ?? 0}
              min={0}
              max={99}
              onRegler={(v) => regler(avec({ graine: v }))}
              onPoser={(v) => void poser(avec({ graine: v }))}
            />
          </Reglage>
          <Pourquoi texte="la graine est écrite dans la recette — deux fois la même demande rendent la même image" />
        </>
      )}

      <Reglage nom="tramage">
        <Choix
          valeurs={["aucun", "floyd", "trame"] as const}
          valeur={valeurs.tramage}
          libelles={{ aucun: "aucun", floyd: "diffusion", trame: "trame régulière" }}
          onChange={(tramage) => void poser(avec({ tramage }))}
        />
      </Reglage>

      {/* **La force ne paraît qu'avec un tramage**, et la planche le montre
          ainsi : *« Grisée : aucun tramage n'est choisi. »* */}
      <Reglage nom="force du tramage">
        <Glissiere
          nom="force du tramage"
          valeur={valeurs.force_tramage ?? FORCE_TRAMAGE_LIVREE}
          min={0}
          max={100}
          unite=" %"
          eteint={valeurs.tramage === "aucun"}
          onRegler={(v) => regler(avec({ force_tramage: v }))}
          onPoser={(v) => void poser(avec({ force_tramage: v }))}
        />
      </Reglage>
      {valeurs.tramage === "aucun" && (
        <Pourquoi texte="aucun tramage n'est choisi" />
      )}

      {/* ── Comment on mesure « la plus proche » (B18) ────────────────────── */}
      <Reglage nom="distance des couleurs">
        <Choix
          valeurs={["brute", "oeil"] as const}
          valeur={valeurs.distance ?? "brute"}
          libelles={{ brute: "brute", oeil: "à l'œil" }}
          onChange={(distance) => void poser(avec({ distance }))}
        />
      </Reglage>

      {/* ── Ce qu'on compte (B18) ──────────────────────────────────────────
          Le magenta retiré est encore sous la transparence, et il prend une
          place de la palette : demander 8 couleurs en rend 7 visibles. */}
      <Reglage nom="ne compter que ce qu'on voit">
        <Choix
          valeurs={["non", "oui"] as const}
          valeur={valeurs.visibles_seuls ? "oui" : "non"}
          onChange={(v) => void poser(avec({ visibles_seuls: v === "oui" }))}
        />
      </Reglage>

      {/* **La note du serveur, telle quelle.** Elle *annonce* au lieu
          d'interdire : sans artwork officiel les couleurs viennent de chaque
          image et non de la palette du jeu, et c'est très exactement le piège
          de `D5` — une place qui peut ne pas faire ce qu'on croit doit le
          dire. */}
      {traitement.quantification.note && (
        <Pourquoi texte={traitement.quantification.note} />
      )}
      {univers.palette.length > 0 && (
        <p className="mesure text-[10.5px] text-encre-4">
          la palette du jeu porte {univers.palette.length} couleurs
        </p>
      )}

      {/* ── « 24 demandées, 14 obtenues » (B18) ────────────────────────────
          Sans ce chiffre, l'auteur monte le réglage en croyant gagner du
          détail. Avec, il voit à quel cran l'image cesse d'avoir des teintes
          à donner. */}
      {compte !== null && compte.demandees > 0 && (
        <p className="mesure text-[10.5px] text-encre-4">
          {compte.demandees} demandées, {compte.obtenues} obtenues
          {compte.obtenues < compte.demandees &&
            " — cette image n'a plus de teintes différentes à donner"}
        </p>
      )}

      {/* ── Les quatre curseurs, avant la réduction (B17) ──────────────────
          Ils s'appliquent avant que la table ne réduise l'image : les lire
          après les réglages de réduction dirait le contraire de ce que la
          machine fait. */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <Etiquette>avant de réduire — {valeurs.couleurs} couleurs pour dire l'image</Etiquette>
        {CURSEURS.map(({ cle, nom, min, max, unite }) => (
          <Reglage key={cle} nom={nom}>
            <Glissiere
              nom={nom}
              valeur={valeurs[cle] ?? 0}
              min={min}
              max={max}
              unite={unite}
              onRegler={(v) => regler(avec({ [cle]: v }))}
              onPoser={(v) => void poser(avec({ [cle]: v }))}
            />
          </Reglage>
        ))}
      </div>

      {/* ── Les couleurs gardées, avant que l'algorithme ne choisisse (B18) ──
          Elles sont posées d'office dans la palette : à 8 couleurs, garder le
          noir du contour et le vert de la grenouille laisse six places à
          l'algorithme. Grisées sous une palette de jeu, qui décide seule. */}
      <CouleursGardees
        gardees={valeurs.gardees ?? []}
        couleursImage={couleursImage}
        palette={univers.palette}
        eteint={valeurs.palette.length > 0}
        onChange={(gardees) => void poser(avec({ gardees }))}
      />

      {/* ── L'échange de couleurs, après la réduction (B17) ────────────────
          Posé avant, il serait défait par la réduction, qui renverrait la
          couleur écrite au plus proche de la palette. */}
      <TableDEchange
        echanges={valeurs.echanges ?? []}
        couleursImage={couleursImage}
        palette={univers.palette}
        asset={asset}
        viseeEchange={viseeEchange ?? null}
        onViserEchange={onViserEchange}
        onChange={(echanges) => void poser(avec({ echanges }))}
      />
    </div>
  )
}

/** Deux listes de couleurs sont-elles la même palette ? L'ordre compte : c'est
 *  celui que la palette rend, et la recette le recopie tel quel. */
function memesCouleurs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((c, i) => c.toLowerCase() === (b[i] ?? "").toLowerCase())
}

/** Les palettes nommées du jeu (TS12), lues à l'ouverture de la table.
 *
 *  **Lues ici plutôt que portées par `Poste`** : les deux écrans qui montent
 *  cette table — la retouche d'une image et l'atelier d'une animation — n'ont
 *  pas à les connaître pour autre chose, et les leur faire charger tous deux
 *  aurait fait deux lectures à tenir d'accord. `null` tant que rien n'est lu. */
function usePalettesDuJeu(): PaletteNommee[] | null {
  const [palettes, setPalettes] = useState<PaletteNommee[] | null>(null)
  useEffect(() => {
    let vivant = true
    api
      .coteAmbiances()
      .then((recu) => {
        if (vivant) setPalettes(Array.isArray(recu?.palettes) ? recu.palettes : [])
      })
      .catch(() => {
        if (vivant) setPalettes([])
      })
    return () => {
      vivant = false
    }
  }, [])
  return palettes
}

/** Combien de pastilles une ligne montre avant de compter le reste. */
const PASTILLES_MONTREES = 12

/** **Chaque palette nommée, montrée avec ses pastilles** (TS12) — un nom seul
 *  ne dit pas ce qu'on va poser sur l'image. Une palette sans couleur est
 *  grisée avec sa raison, jamais retirée. */
function PalettesDuJeu({
  palettes,
  choisie,
  onChoisir,
}: {
  palettes: PaletteNommee[]
  choisie: string
  onChoisir: (palette: PaletteNommee) => void
}) {
  const videExiste = palettes.some((p) => p.rendue.length === 0)
  return (
    <div role="group" aria-label="les palettes du jeu" className="flex flex-col gap-[4px]">
      {palettes.map((palette) => {
        const vide = palette.rendue.length === 0
        const pressee = choisie === palette.identifiant
        return (
          <button
            key={palette.identifiant}
            type="button"
            aria-pressed={pressee}
            aria-label={`palette ${palette.nom}`}
            disabled={vide}
            onClick={() => onChoisir(palette)}
            className={[
              "flex min-h-[26px] items-center gap-[8px] rounded-7 border px-[8px] py-[4px] text-left text-[12px] transition-colors duration-120",
              vide
                ? "cursor-not-allowed border-trait-faible bg-papier-cote text-eteint"
                : pressee
                  ? "border-encre-4 bg-carte font-medium text-encre"
                  : "border-trait bg-carte text-encre-3 hover:border-encre-4",
            ].join(" ")}
          >
            <span className="min-w-0 flex-1 truncate">{palette.nom}</span>
            <span aria-hidden className="flex shrink-0 flex-wrap items-center gap-[2px]">
              {palette.rendue.slice(0, PASTILLES_MONTREES).map((couleur, rang) => (
                <span
                  key={`${couleur}-${rang}`}
                  data-pastille-de-palette
                  className="h-[14px] w-[14px] rounded-5 border border-trait-faible"
                  style={{ background: couleur }}
                />
              ))}
              {palette.rendue.length > PASTILLES_MONTREES && (
                <span className="mesure text-[10.5px] text-encre-4">
                  +{palette.rendue.length - PASTILLES_MONTREES}
                </span>
              )}
            </span>
          </button>
        )
      })}
      {videExiste && (
        <Pourquoi texte="une palette sans couleur ne se choisit pas — donne-lui des images sur la toile" />
      )}
    </div>
  )
}

/** La raison écrite à côté du grisé, quand la palette du jeu est posée.
 *  **Écrite une fois** : trois grisés qui la recopieraient finiraient par ne
 *  plus dire la même chose. */
const SOUS_LA_PALETTE = "la palette choisie décide seule des couleurs"

/** Deux petits titres au-dessus des pastilles, jamais un seul tas (RV24).
 *
 *  **L'image d'abord, le jeu ensuite** — c'est l'ordre du retour de l'auteur :
 *  *« dans la grille des couleurs affichée, il n'y a pas le vert que je vois
 *  sur l'image »*. Une couleur de l'image absente de la palette du jeu ne se
 *  choisissait donc nulle part ; les deux groupes disent maintenant laquelle
 *  est laquelle, plutôt que de les mêler dans une seule rangée où rien ne le
 *  dirait. `null` quand aucune des deux sources n'a de couleur à proposer. */
function GroupesDeCouleurs({
  couleursImage,
  palette,
  rendre,
}: {
  couleursImage: string[]
  palette: string[]
  rendre: (couleur: string) => ReactNode
}) {
  if (couleursImage.length === 0 && palette.length === 0) return null
  return (
    <div className="flex flex-col gap-[8px]">
      {couleursImage.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          <span className="mesure text-[10.5px] text-encre-4">les couleurs de l'image</span>
          <div className="flex flex-wrap gap-[6px]">{couleursImage.map(rendre)}</div>
        </div>
      )}
      {palette.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          <span className="mesure text-[10.5px] text-encre-4">la palette du jeu</span>
          <div className="flex flex-wrap gap-[6px]">{palette.map(rendre)}</div>
        </div>
      )}
    </div>
  )
}

/** Les couleurs qu'aucune fusion n'emporte (`B18`).
 *
 *  **Le même geste que la table d'échange, en plus court** : une pastille, une
 *  couleur, et rien d'autre. Elle se pique sur les couleurs de l'image et sur
 *  la palette du jeu (RV24) quand il y en a, et se tape à la main sinon.
 *
 *  ⚠️ **La planche la veut à la pipette sur l'image** ; ce qui est livré ici est
 *  le choix parmi les couleurs connues. La surface à coordonnées de cet écran ne
 *  sert que le détourage, le recadrage et la main — lui faire porter un
 *  cinquième geste demanderait de savoir, au clic, lequel des cinq on fait. */
function CouleursGardees({
  gardees,
  couleursImage,
  palette,
  eteint,
  onChange,
}: {
  gardees: string[]
  couleursImage: string[]
  palette: string[]
  eteint: boolean
  onChange: (gardees: string[]) => void
}) {
  const pasEncoreGardee = (c: string) =>
    !gardees.some((g) => g.toLowerCase() === c.toLowerCase())
  return (
    <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
      <Etiquette>couleurs gardées — jamais fondues avec une voisine</Etiquette>

      {gardees.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {gardees.map((couleur, rang) => (
            <button
              key={`${couleur}-${rang}`}
              type="button"
              aria-label={`retirer ${couleur} des couleurs gardées`}
              className="h-[22px] w-[22px] rounded-5 border border-trait-faible"
              style={{ background: couleur }}
              onClick={() => onChange(gardees.filter((_, i) => i !== rang))}
            />
          ))}
        </div>
      )}

      {(() => {
        const image = couleursImage.filter(pasEncoreGardee)
        const jeu = palette.filter(pasEncoreGardee)
        if (eteint) return <Pourquoi texte={SOUS_LA_PALETTE} />
        if (gardees.length >= GARDEES_MAX)
          return (
            <Pourquoi
              texte={`${GARDEES_MAX} couleurs gardées au plus — au-delà il ne reste rien à choisir`}
            />
          )
        if (image.length === 0 && jeu.length === 0)
          return <Pourquoi texte="ni l'image ni le jeu n'ont encore de couleur où piquer" />
        return (
          <GroupesDeCouleurs
            couleursImage={image}
            palette={jeu}
            rendre={(couleur) => (
              <button
                key={couleur}
                type="button"
                aria-label={`garder ${couleur}`}
                title={couleur}
                className="h-[14px] w-[14px] rounded-5 border border-trait-faible opacity-60 hover:opacity-100"
                style={{ background: couleur }}
                onClick={() => onChange([...gardees, couleur])}
              />
            )}
          />
        )
      })()}
    </div>
  )
}

/** La table de correspondance — *cette couleur-ci devient celle-là*, après la
 *  réduction. Le geste de la table des couleurs, dans le vocabulaire de cet
 *  écran : une paire en train de se faire reste ici, à
 *  l'écran, et ne rejoint la recette qu'une fois ses deux couleurs nommées —
 *  sans quoi le seul geste qui ouvre la table est aussi celui que le serveur
 *  refuse (*une paire nomme deux couleurs*), trouvé au navigateur. */
function TableDEchange({
  echanges,
  couleursImage,
  palette,
  asset,
  viseeEchange,
  onViserEchange,
  onChange,
}: {
  echanges: Echange[]
  couleursImage: string[]
  palette: string[]
  /** Pour la pipette de « celle qui part » (RV24) — voir `ReglagesDesCouleurs`. */
  asset?: Asset
  viseeEchange: number | null
  onViserEchange?: (rang: number | null) => void
  onChange: (echanges: Echange[]) => void
}) {
  const [brouillon, setBrouillon] = useState<Echange | null>(null)

  const changer = (rang: number, suivant: Partial<Echange>) =>
    onChange(echanges.map((e, i) => (i === rang ? { ...e, ...suivant } : e)))

  const changerLeBrouillon = (suivant: Partial<Echange>) => {
    const prochain = { ...(brouillon ?? PAIRE_VIDE), ...suivant }
    if (prochain.depuis && prochain.vers) {
      setBrouillon(null)
      onChange([...echanges, prochain])
      return
    }
    setBrouillon(prochain)
  }

  const lignes = [
    ...echanges.map((echange, rang) => ({ echange, rang, encours: false })),
    ...(brouillon ? [{ echange: brouillon, rang: echanges.length, encours: true }] : []),
  ]

  return (
    <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
      <Etiquette>après la réduction — une couleur en remplace une autre</Etiquette>

      {lignes.map(({ echange, rang, encours }) => (
        <div key={rang} className="flex flex-col gap-[8px]">
          <Reglage nom="celle qui part">
            <ChoixDeCouleur
              couleur={echange.depuis}
              couleursImage={couleursImage}
              palette={palette}
              onChange={(depuis) =>
                encours ? changerLeBrouillon({ depuis }) : changer(rang, { depuis })
              }
              // **Pas sur la paire en train de se faire** (RV24) : la
              // surface à coordonnées désigne un rang de `echanges`, et cette
              // ligne-là n'y est pas encore — elle n'a pas de rang à viser
              // tant qu'elle n'a pas rejoint la recette.
              pipette={
                !encours && asset && onViserEchange
                  ? {
                      armee: viseeEchange === rang,
                      onArmer: () => onViserEchange(viseeEchange === rang ? null : rang),
                    }
                  : undefined
              }
            />
          </Reglage>
          <Reglage nom="celle qui vient">
            <ChoixDeCouleur
              couleur={echange.vers}
              couleursImage={couleursImage}
              palette={palette}
              onChange={(vers) =>
                encours ? changerLeBrouillon({ vers }) : changer(rang, { vers })
              }
            />
          </Reglage>
          <Reglage nom="tolérance de la paire">
            <Glissiere
              nom="tolérance de la paire"
              valeur={echange.tolerance}
              min={0}
              max={TOLERANCE_D_UNE_PAIRE_MAX}
              onRegler={(tolerance) =>
                encours ? setBrouillon({ ...echange, tolerance }) : changer(rang, { tolerance })
              }
              onPoser={(tolerance) =>
                encours ? setBrouillon({ ...echange, tolerance }) : changer(rang, { tolerance })
              }
            />
          </Reglage>
          {encours && (
            <Pourquoi
              texte={
                echange.depuis
                  ? "il manque la couleur qui vient — rien n'est appliqué tant que la paire n'en nomme pas deux"
                  : "il manque la couleur qui part — rien n'est appliqué tant que la paire n'en nomme pas deux"
              }
            />
          )}
          <button
            type="button"
            onClick={() =>
              encours ? setBrouillon(null) : onChange(echanges.filter((_, i) => i !== rang))
            }
            className="self-start text-[11.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
          >
            Retirer cet échange
          </button>
        </div>
      ))}

      <button
        type="button"
        disabled={brouillon !== null}
        onClick={() => setBrouillon({ ...PAIRE_VIDE, depuis: palette[0] ?? "" })}
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-encre-4 disabled:hover:border-trait"
      >
        Échanger une couleur
      </button>
    </div>
  )
}

/** Une couleur, choisie par pipette de palette, par pipette dans l'image ou
 *  entrée en clair — la règle d'US-210 : *proposée, jamais imposée*.
 *
 *  **Deux pipettes, et elles ne se confondent pas** (RV24). L'une pique une
 *  pastille déjà connue — palette du jeu, et depuis RV24 les couleurs de
 *  l'image ; l'autre, `pipette`, vise un pixel de l'image elle-même, comme la
 *  couleur à retirer d'un détourage. Rien d'autre ici ne désigne un endroit de
 *  cette image-là, donc rien d'autre n'appartient au pinceau. */
function ChoixDeCouleur({
  couleur,
  couleursImage = [],
  palette,
  onChange,
  pipette,
}: {
  couleur: string
  /** Absente sur les deux postes qui n'ont pas de rendu de brouillon à lire —
   *  la couleur du contour et celle du pinceau : ni l'un ni l'autre n'ouvre
   *  la table « Couleurs », donc `mesures.couleurs.liste` ne les concerne
   *  pas. La table « Couleurs » (RV24), elle, la passe toujours. */
  couleursImage?: string[]
  palette: string[]
  onChange: (couleur: string) => void
  /** La pipette dans l'image, réservée à « celle qui part » (RV24) — armée ou
   *  non, jamais les deux. La surface à coordonnées qui reçoit le clic vit
   *  dans le cadre central de `Retouche`, pas ici : ce bouton ne fait
   *  qu'armer, exactement comme « viser dans l'image › » du détourage. */
  pipette?: { armee: boolean; onArmer: () => void }
}) {
  const dansUneSource = (c: string) =>
    couleursImage.some((k) => k.toLowerCase() === c.toLowerCase()) ||
    palette.some((k) => k.toLowerCase() === c.toLowerCase())
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-center gap-[8px]">
        {/* **Aucune couleur de repli écrite ici.** Une valeur qui n'est pas
            un hexadécimal à six chiffres — la paire vide, ou une couleur en
            cours de frappe — n'est pas une valeur valide pour ce contrôle
            natif, et le navigateur la remplace lui-même sans qu'on ait à
            écrire laquelle. */}
        <input
          type="color"
          value={couleur}
          aria-label="Couleur"
          onChange={(e) => onChange(e.target.value)}
          className="h-[26px] w-[34px] shrink-0 rounded-7 border border-trait bg-carte"
        />
        <input
          type="text"
          value={couleur}
          aria-label="Couleur, en hexadécimal"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="mesure h-[26px] min-w-0 flex-1 rounded-7 border border-trait bg-carte px-[8px] text-[11.5px] text-encre"
        />
        {pipette && (
          <button
            type="button"
            aria-pressed={pipette.armee}
            onClick={pipette.onArmer}
            className="h-[26px] shrink-0 rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
          >
            {pipette.armee ? "clique dans l'image" : "pipette ›"}
          </button>
        )}
      </div>
      <GroupesDeCouleurs
        couleursImage={couleursImage}
        palette={palette}
        rendre={(c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Prendre ${c}`}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={[
              "h-[14px] w-[14px] border",
              c.toLowerCase() === couleur.toLowerCase() ? "border-encre" : "border-trait",
            ].join(" ")}
          />
        )}
      />
      {/* **Le produit constate ; il ne refuse pas** (D4, rattrapé en `B26`).
          Une couleur de plus dans un jeu est un fait qui se lit, et il mérite
          d'être dit ici puisque la réduction des couleurs est déjà passée et ne
          la rattrapera pas. */}
      {(couleursImage.length > 0 || palette.length > 0) && (
        <span
          className={[
            "mesure text-[10.5px]",
            dansUneSource(couleur) ? "text-encre-4" : "text-epingle",
          ].join(" ")}
        >
          {couleur} · {dansUneSource(couleur) ? "dans la palette" : "hors palette"}
        </span>
      )}
    </div>
  )
}

export function ReglagesDuNettoyage({ recette, mesures, regler, poser }: Poste) {
  // ⚠️ **Zéro, pas trois** (B16). L'écran affichait 3 px et annonçait « 4
  // taches effacées sur 11 » alors que rien n'était posé et que l'image n'avait
  // pas bougé d'un pixel — pendant que la table des contours lisait la même
  // absence comme un zéro. Un chiffre affiché est un chiffre compté.
  const seuil = recette.bords?.aire_min ?? 0
  const grain = recette.bords?.grain_min ?? 0
  const lissage = recette.bords?.lissage ?? 0
  const garder = recette.bords?.garder ?? 0
  const boucher = recette.bords?.boucher_jusqua ?? 0
  const reboucher = recette.bords?.reboucher_jusqua ?? 0
  const ouverture = recette.bords?.ronger_regonfler ?? 0
  const fermeture = recette.bords?.regonfler_ronger ?? 0
  const vote = recette.bords?.vote_voisins ?? 0
  const epargneFins = recette.bords?.epargner_traits_fins ?? true
  const designations = recette.bords?.designations ?? []
  const taches = mesures?.taches ?? []
  const trous = mesures?.trous ?? []
  const poches = mesures?.poches ?? []
  const partent = taches.filter((t) => t.aire < seuil).length

  /** **Toujours la table entière** (B17, B18 — la même leçon qu'au-dessus pour
   *  les couleurs) : régler un curseur ne doit effacer aucun des autres
   *  moteurs déjà posés sur cette même place. */
  const avec = (suivant: Partial<Bords>): Recette => ({
    ...recette,
    bords: {
      aire_min: seuil,
      grain_min: grain,
      lissage,
      garder,
      boucher_jusqua: boucher,
      reboucher_jusqua: reboucher,
      ronger_regonfler: ouverture,
      regonfler_ronger: fermeture,
      vote_voisins: vote,
      epargner_traits_fins: epargneFins,
      designations,
      ...suivant,
    },
  })

  /** Efface l'amas sous ce point — **la désignation à la main** (B18). La
   *  dernière sur un même point l'emporte : on retire d'abord toute
   *  désignation antérieure de ce point, comme `Trait.points` le fait déjà
   *  pour un passage de la main. */
  const designer = (point: [number, number]) => {
    const propres = designations.filter(
      (d) => d.point[0] !== point[0] || d.point[1] !== point[1]
    )
    void poser(avec({ designations: [...propres, { point, garde: false }] }))
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <Reglage nom="tache minimale">
        <Glissiere
          nom="tache minimale"
          valeur={seuil}
          min={0}
          max={64}
          unite=" px"
          onRegler={(aire_min) => regler(avec({ aire_min }))}
          onPoser={(aire_min) => void poser(avec({ aire_min }))}
        />
      </Reglage>
      <Pourquoi
        texte={
          seuil === 0
            ? `zéro n'efface rien — ${taches.length} ${pluriel(taches.length, "tache détachée", "taches détachées")} sur cette image`
            : `${partent} ${pluriel(partent, "tache effacée", "taches effacées")} sur ${taches.length}`
        }
      />

      {/* ── Garder le sujet seul (B18) ──────────────────────────────────────
          **Un rang, jamais une taille.** Ce que la tache minimale ne peut pas
          faire : effacer un amas collé au sujet, quelle que soit son aire. */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <Reglage nom="garder les plus grandes">
          <Glissiere
            nom="garder les plus grandes"
            valeur={garder}
            min={0}
            max={GARDER_MAX}
            unite={garder === 0 ? "" : garder > 1 ? " amas" : " amas"}
            onRegler={(v) => regler(avec({ garder: v }))}
            onPoser={(v) => void poser(avec({ garder: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            garder === 0
              ? "désactivé — rien ne se trie par rang"
              : `seuls les ${garder} plus grands amas sur ${taches.length} restent, quelle que soit leur aire`
          }
        />
      </div>

      {/* ── Boucher les trous, reboucher les poches de fond (B18) ──────────
          **Deux lectures inverses de la même chose** : un trou est
          transparent et entouré de sujet ; une poche de fond est opaque, à la
          couleur du bord, et enfermée. Les confondre a déjà coûté cher au
          détourage (voir `atelier/image/taches.py`). */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <Reglage nom="boucher les trous jusqu'à">
          <Glissiere
            nom="boucher les trous jusqu'à"
            valeur={boucher}
            min={0}
            max={64}
            unite=" px"
            onRegler={(v) => regler(avec({ boucher_jusqua: v }))}
            onPoser={(v) => void poser(avec({ boucher_jusqua: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            boucher === 0
              ? `désactivé — ${trous.length} ${pluriel(trous.length, "trou", "trous")} de silhouette laissé${trous.length > 1 ? "s" : ""} tel${trous.length > 1 ? "s" : ""} quel${trous.length > 1 ? "s" : ""}`
              : `${trous.filter((t) => t.aire <= boucher).length} des ${trous.length} ${pluriel(trous.length, "trou", "trous")} se combleraient, avec la couleur qui les entoure`
          }
        />
        <Reglage nom="reboucher les poches de fond jusqu'à">
          <Glissiere
            nom="reboucher les poches de fond jusqu'à"
            valeur={reboucher}
            min={0}
            max={64}
            unite=" px"
            onRegler={(v) => regler(avec({ reboucher_jusqua: v }))}
            onPoser={(v) => void poser(avec({ reboucher_jusqua: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            reboucher === 0
              ? `désactivé — ${poches.length} ${pluriel(poches.length, "poche de fond enfermée", "poches de fond enfermées")} laissée${poches.length > 1 ? "s" : ""} opaque${poches.length > 1 ? "s" : ""}`
              : `${poches.filter((t) => t.aire <= reboucher).length} des ${poches.length} poches deviendraient transparentes`
          }
        />
      </div>

      {/* ── Les deux morphologies (B18) ─────────────────────────────────────
          **Deux opérations inverses, dans un ordre qui compte** : ronger puis
          regonfler retire ce qui est trop fin pour survivre à l'érosion ;
          regonfler puis ronger comble ce qui est trop fin pour survivre au
          gonflement. */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <Reglage nom="ronger puis regonfler">
          <Glissiere
            nom="ronger puis regonfler"
            valeur={ouverture}
            min={0}
            max={MORPHOLOGIE_MAX}
            unite={ouverture === 0 ? "" : " px"}
            onRegler={(v) => regler(avec({ ronger_regonfler: v }))}
            onPoser={(v) => void poser(avec({ ronger_regonfler: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            ouverture === 0
              ? "désactivé — aucune excroissance n'est retirée"
              : "les excroissances plus fines que ce rayon disparaissent, le corps garde sa taille"
          }
        />
        <Reglage nom="épargner les traits fins">
          <Choix
            valeurs={["oui", "non"] as const}
            valeur={epargneFins ? "oui" : "non"}
            onChange={(v) =>
              void poser(avec({ epargner_traits_fins: v === "oui" }))
            }
          />
        </Reglage>
        <Pourquoi
          texte={
            epargneFins
              ? "une hampe, un brin d'herbe — un pixel de large — survit au rongement"
              : "rien n'est épargné : un trait d'un pixel de large disparaît comme le reste"
          }
        />
        <Reglage nom="regonfler puis ronger">
          <Glissiere
            nom="regonfler puis ronger"
            valeur={fermeture}
            min={0}
            max={MORPHOLOGIE_MAX}
            unite={fermeture === 0 ? "" : " px"}
            onRegler={(v) => regler(avec({ regonfler_ronger: v }))}
            onPoser={(v) => void poser(avec({ regonfler_ronger: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            fermeture === 0
              ? "désactivé — aucune entaille du bord n'est comblée"
              : "les entailles du bord plus fines que ce rayon se comblent, le corps garde sa taille"
          }
        />
      </div>

      {/* ── Le grain de couleur, l'escalier, et le vote des voisins ─────────
          **Ce que la tache minimale n'a jamais pu atteindre.** Elle compte des
          taches dans la silhouette ; un pixel vert vif au milieu d'une robe
          brune est opaque et collé au sujet, donc aucune valeur de ce
          curseur-là ne l'a jamais vu. */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <Etiquette>la couleur, pas la silhouette</Etiquette>
        <Reglage nom="grain de couleur">
          <Glissiere
            nom="grain de couleur"
            valeur={grain}
            min={0}
            max={GRAIN_MAX}
            unite={grain === 0 ? "" : " voisins"}
            onRegler={(grain_min) => regler(avec({ grain_min }))}
            onPoser={(grain_min) => void poser(avec({ grain_min }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            grain === 0
              ? "rien de posé : un pixel isolé au milieu d'un aplat reste où il est"
              : `un pixel dont moins de ${grain} voisin${grain > 1 ? "s" : ""} porte${grain > 1 ? "nt" : ""} sa couleur prend celle de la majorité — le bord du sujet n'est jamais touché`
          }
        />
        <Reglage nom="lissage">
          <Glissiere
            nom="lissage"
            valeur={lissage}
            min={0}
            max={LISSAGE_MAX}
            unite={lissage === 0 ? "" : lissage > 1 ? " passes" : " passe"}
            onRegler={(v) => regler(avec({ lissage: v }))}
            onPoser={(v) => void poser(avec({ lissage: v }))}
          />
        </Reglage>
        <Reglage nom="vote des voisins">
          <Glissiere
            nom="vote des voisins"
            valeur={vote}
            min={0}
            max={LISSAGE_MAX}
            unite={vote === 0 ? "" : vote > 1 ? " passes" : " passe"}
            onRegler={(v) => regler(avec({ vote_voisins: v }))}
            onPoser={(v) => void poser(avec({ vote_voisins: v }))}
          />
        </Reglage>
        <Pourquoi
          texte={
            vote === 0
              ? "désactivé — un bord irrégulier le reste"
              : "chaque pixel du bord suit la majorité franche de ses huit voisins"
          }
        />
      </div>

      {/* ── La désignation à la main (B18) ──────────────────────────────────
          **Le seul endroit de la table où l'on désigne au pixel près** — la
          planche le dit en toutes lettres. Une ligne, un clic, la tache s'en
          va, quel que soit le seuil au-dessus. */}
      {taches.length > 0 && (
        <div className="flex flex-col gap-[6px] border-t border-trait-faible pt-[8px]">
          <Etiquette>désigner une tache</Etiquette>
          <div className="flex flex-col gap-[2px]">
            {taches.slice(0, 8).map((t) => {
              const designee = designations.some(
                (d) => d.point[0] === t.point[0] && d.point[1] === t.point[1] && !d.garde
              )
              return (
                <div
                  key={`${t.point[0]},${t.point[1]}`}
                  className="flex items-center justify-between gap-[8px] text-[11.5px]"
                >
                  <span className="flex items-center gap-[6px] text-encre-3">
                    <span
                      aria-hidden
                      className="inline-block h-[8px] w-[8px] shrink-0 border border-trait"
                      style={{ background: t.couleur }}
                    />
                    {t.aire} px
                  </span>
                  <button
                    type="button"
                    disabled={designee}
                    onClick={() => designer(t.point)}
                    className={[
                      "h-[22px] rounded-7 border px-[8px] text-[11px]",
                      designee
                        ? "cursor-not-allowed border-trait-faible text-eteint"
                        : "border-trait text-encre-3 hover:border-encre-4",
                    ].join(" ")}
                  >
                    {designee ? "effacée" : "effacer"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReglagesDuContour({ recette, univers, mesures, regler, poser }: Poste) {
  /** **La seule chose que ce poste devine** (D4, rendu en `B26`) : la plus
   *  sombre de la palette du jeu, plutôt que le noir du produit. L'ancien
   *  panneau la proposait déjà ; le poste neuf posait `CONTOUR_PAR_DEFAUT` tel
   *  quel, si bien que le premier réglage touché écrivait dans la recette une
   *  couleur que le jeu n'emploie pas. Deux écrans du même atelier ne
   *  proposaient pas la même. */
  const contour: Contour = recette.contours ?? {
    ...CONTOUR_PAR_DEFAUT,
    couleur: laPlusSombre(univers.palette) ?? CONTOUR_PAR_DEFAUT.couleur,
  }
  const changer = (suite: Partial<Contour>) =>
    void poser({ ...recette, contours: { ...contour, ...suite } })
  const croissance = debord(contour) * 2
  const cible = recette.grille?.cible ?? null
  return (
    <div className="flex flex-col gap-[14px]">
      <Reglage nom="épaisseur">
        <Glissiere
          nom="épaisseur du contour"
          valeur={contour.epaisseur}
          min={1}
          max={8}
          unite=" px"
          onRegler={(epaisseur) =>
            regler({ ...recette, contours: { ...contour, epaisseur } })
          }
          onPoser={(epaisseur) => changer({ epaisseur })}
        />
      </Reglage>
      {/* **Un nombre seul demanderait « de quoi ? »** (D4, rattrapé en `B26`).
          L'épaisseur se compte dans l'image rendue — sauf sans case posée, où
          l'image fait encore mille pixels de côté et où un trait d'un pixel est
          un cheveu invisible : le trait se pose alors sur la maille du modèle,
          et l'écran dit laquelle plutôt que de laisser deviner. */}
      <Pourquoi texte={uniteDuTrait(contour.epaisseur, recette, mesures)} />
      {/* **La forme du pinceau, dite au moment du choix** (D4). Les deux ont
          raison à des épaisseurs différentes : la croix à un pixel — le carré
          poserait des pixels en diagonale des coins —, le carré au-dessus,
          parce qu'une croix répétée donne un losange visible aux quatre coins
          d'un sprite. */}
      <Pourquoi
        texte={
          contour.epaisseur <= 1
            ? "en croix, la convention du pixel art à une épaisseur — le carré poserait des pixels en diagonale des coins"
            : "en carré, au-delà d'une épaisseur — une croix répétée donnerait un losange"
        }
      />

      <Reglage nom="position">
        <Choix
          valeurs={["externe", "interne", "centre"] as const}
          valeur={contour.position}
          libelles={{ externe: "dehors", interne: "dedans", centre: "à cheval" }}
          onChange={(position) => changer({ position })}
        />
      </Reglage>

      <Reglage nom="les trous">
        <Choix
          valeurs={["cercles", "laisses"] as const}
          valeur={contour.trous}
          libelles={TROUS}
          onChange={(trous) => changer({ trous })}
        />
      </Reglage>

      {/* **La palette entière, et non ses douze premières** (D4, rattrapé en
          `B26`). Le choix passe par la pièce que les autres postes emploient
          déjà : elle porte la pastille de chaque couleur du jeu, le champ
          hexadécimal pour celles qui n'y sont pas, et elle dit sous elle si la
          couleur posée est dans la palette ou hors d'elle. */}
      <Reglage nom="couleur">
        <ChoixDeCouleur
          couleur={contour.couleur}
          palette={univers.palette}
          onChange={(couleur) => changer({ couleur })}
        />
      </Reglage>
      {/* **Ce que le poste a deviné, dit une fois** : tant que rien n'est posé,
          la couleur montrée est la plus sombre de la palette — proposée, pas
          choisie. */}
      {recette.contours === null && univers.palette.length > 0 && (
        <Pourquoi texte="proposé, d'après ta palette · la plus sombre" />
      )}

      {/* **Le seul réglage de la chaîne qui change la taille du rendu**, et il
          l'écrit au moment où on choisit — pas après. À cheval sur une
          épaisseur impaire, le pixel qui ne tombe pas juste va dehors : la
          croissance vaut alors un de plus que l'épaisseur.
          **Et il le dit sans case posée aussi** (rattrapé en `B26`) : la
          silhouette grandit du même nombre de pixels, que le jeu ait une case
          ou non — n'en parler qu'avec une case laissait l'autre moitié des
          images sans un mot. */}
      {cible !== null ? (
        croissance > 0 && (
          <Pourquoi
            texte={`la case du jeu fait ${cible} px, le fichier qui sort en fera ${cible + croissance}`}
          />
        )
      ) : (
        <Pourquoi
          texte={
            croissance === 0
              ? "la boîte ne bouge pas — le sujet est mangé de l'épaisseur"
              : `la silhouette grandit de ${croissance} px sur chaque dimension`
          }
        />
      )}
      {(mesures?.trous.length ?? 0) > 0 && (
        <Pourquoi
          texte={`${mesures?.trous.length} ${pluriel(
            mesures?.trous.length ?? 0,
            "trou",
            "trous",
          )} dans la silhouette — ${
            contour.trous === "cercles" ? "le trait les longe" : "le trait les bouche d'abord"
          }`}
        />
      )}

      {/* ── Les six capacités de B18 ─────────────────────────────────────── */}
      <div className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
        <label className="flex items-start gap-[8px] text-[12px] text-encre-2">
          <input
            type="checkbox"
            checked={contour.derivee}
            onChange={(e) => changer({ derivee: e.target.checked })}
            className="mt-[4px]"
          />
          <span>
            couleur dérivée
            <span className="mesure block text-[10.5px] text-encre-4">
              chaque pixel du trait prend la teinte du bord le plus proche, assombrie — la
              couleur choisie plus haut est alors ignorée
            </span>
          </span>
        </label>

        <label className="flex items-start gap-[8px] text-[12px] text-encre-2">
          <input
            type="checkbox"
            checked={contour.reserver}
            onChange={(e) => changer({ reserver: e.target.checked })}
            className="mt-[4px]"
          />
          <span>
            réserver la place
            <span className="mesure block text-[10.5px] text-encre-4">
              la case ne grandit jamais, quel que soit le choix de position — le sujet perd
              l'épaisseur du trait sur son bord plutôt que le fichier
            </span>
          </span>
        </label>

        <label className="flex items-start gap-[8px] text-[12px] text-encre-2">
          <input
            type="checkbox"
            checked={contour.inegal}
            onChange={(e) => changer({ inegal: e.target.checked })}
            className="mt-[4px]"
          />
          <span>
            trait inégal
            <span className="mesure block text-[10.5px] text-encre-4">
              dégradé du haut (presque rien) vers le bas (plein), comme si la lumière venait
              du ciel — et rien sous les pieds
            </span>
          </span>
        </label>

        <label className="flex items-start gap-[8px] text-[12px] text-encre-2">
          <input
            type="checkbox"
            checked={contour.sur_calques}
            onChange={(e) => changer({ sur_calques: e.target.checked })}
            className="mt-[4px]"
          />
          <span>
            sur l'ensemble empilé
            <span className="mesure block text-[10.5px] text-encre-4">
              cerne la silhouette de tous les calques posés ensemble, pas ce calque seul —
              une pièce d'équipement ne garde alors plus son propre liseré
            </span>
          </span>
        </label>

        <label className="flex items-start gap-[8px] text-[12px] text-encre-2">
          <input
            type="checkbox"
            checked={contour.desactive_plein_cadre}
            onChange={(e) => changer({ desactive_plein_cadre: e.target.checked })}
            className="mt-[4px]"
          />
          <span>
            s'éteindre sur une tuile
            <span className="mesure block text-[10.5px] text-encre-4">
              quand le sujet touche les quatre bords de l'image sur toute leur longueur — une
              tuile, un décor plein cadre — le trait ne se trace pas
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}

export function ReglagesDuRetournement({ recette, regler, poser }: Poste) {
  // **`actif` est `null` tant que rien n'est posé** — à ne pas confondre avec
  // `retournement`, la valeur affichée sous les réglages secondaires (angle,
  // moitié, zones), qui retombe sur le défaut pour rester calculable même
  // quand la table est vide.
  const actif = recette.retournement
  const retournement = actif ?? RETOURNEMENT_PAR_DEFAUT
  const posant = (partiel: Partial<Retournement>) =>
    void poser({ ...recette, retournement: { ...retournement, ...partiel } })
  const reglant = (partiel: Partial<Retournement>) =>
    regler({ ...recette, retournement: { ...retournement, ...partiel } })
  const zones = retournement.zones_protegees ?? []
  return (
    <div className="flex flex-col gap-[14px]">
      {/* **Les dix sens depuis `B18`, et un choix qui se déclique** (RP22) :
          avant, le cran affiché restait pressé même la table vide — un
          « miroir gauche-droite » qu'on ne pouvait jamais voir s'éteindre, et
          reposer le même sens ne changeait donc jamais rien à l'écran. Cliquer
          le sens déjà posé vide la table entière au lieu de la reposer à
          l'identique : c'est la seule place où un cran de la liste *est* la
          place, l'éteindre revient à la vider. */}
      <Reglage nom="sens">
        <Choix
          valeurs={SENS_LIVRES}
          valeur={actif?.sens ?? null}
          libelles={SENS_DU_RETOURNEMENT}
          onChange={(sens) =>
            void poser({
              ...recette,
              retournement: actif?.sens === sens ? null : { ...retournement, sens },
            })
          }
        />
      </Reglage>

      {/* ── Les trois réglages qui ne comptent que pour trois sens (B23) ────
          **Chacun ne paraît que sous le sens auquel il s'applique**, jamais
          tous à la fois : un angle sous « miroir haut-bas » ne voudrait rien
          dire. Ils viennent de la table du retournement, repris tels quels —
          seules leurs commandes passent au papier. */}
      {(retournement.sens === "angle-libre" || retournement.sens === "rotsprite") && (
        <Reglage nom="angle">
          <Glissiere
            nom="angle du retournement"
            valeur={retournement.angle ?? 0}
            min={-180}
            max={180}
            unite="°"
            onRegler={(angle) => reglant({ angle })}
            onPoser={(angle) => posant({ angle })}
          />
        </Reglage>
      )}

      {retournement.sens === "repli" && (
        <Reglage nom="moitié gardée">
          <Choix
            valeurs={["gauche", "droite"] as const}
            valeur={retournement.moitie_repli ?? "gauche"}
            libelles={MOITIES_DU_REPLI}
            onChange={(moitie_repli) => posant({ moitie_repli })}
          />
        </Reglage>
      )}

      {retournement.sens === "sauf-zones" && (
        <div className="flex flex-col gap-[8px]">
          <Reglage
            nom="zones protégées"
            dit={`${zones.length} zone${zones.length > 1 ? "s" : ""}`}
          >
            <div className="flex flex-wrap gap-[4px]">
              <button
                type="button"
                onClick={() =>
                  posant({
                    zones_protegees: [
                      ...zones,
                      { garde: true, rayon: 5, points: [[32, 32]], couleur: "" },
                    ],
                  })
                }
                className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                Une zone au centre
              </button>
              {zones.length > 0 && (
                <button
                  type="button"
                  onClick={() => posant({ zones_protegees: [] })}
                  className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-3 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
                >
                  Les vider
                </button>
              )}
            </div>
          </Reglage>
          {/* ⚠️ **Aucune main ne les peint encore, et c'est dit.** `B18` a livré
              le moteur côté serveur ; la surface qui les tracerait poserait des
              coordonnées *au rang du retournement*, qui n'est pas celui du
              rendu qu'on regarde — un quart de tour en amont suffit à les
              décaler. Un bouton qui pose une zone au centre est ce qu'on peut
              tenir sans mentir sur le pixel visé. */}
          <Pourquoi texte="la zone se pose au centre, à cinq pixels de rayon — le tracé à la main attend que ses coordonnées soient celles du rendu qu'on regarde" />
        </div>
      )}
    </div>
  )
}

/** Une rangée de la pile de la main. **Le calque actif porte le filet d'encre**
 *  — la marque du choix dans le carnet, et jamais une seconde. */
function RangeeDeCalque({
  nom,
  passages,
  visible,
  actif,
  pixels,
  onChoisir,
  onVisible,
  onNommer,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  nom: string
  passages: number
  visible: boolean
  actif: boolean
  pixels: number | null
  onChoisir: () => void
  onVisible?: () => void
  onNommer?: (nom: string) => void
  onMonter?: () => void
  onDescendre?: () => void
  onSupprimer?: () => void
}) {
  return (
    <li
      className={[
        "flex h-[26px] items-center gap-[8px] rounded-7 border px-[8px]",
        actif ? "border-encre-4 bg-carte" : "border-transparent hover:bg-carte",
      ].join(" ")}
    >
      {/* Le disque plein à gauche est la visibilité ; **masquer un calque
          n'efface rien**, et c'est très exactement la différence entre masquer
          et supprimer. */}
      <button
        type="button"
        aria-label={visible ? `Masquer ${nom}` : `Montrer ${nom}`}
        aria-pressed={visible}
        disabled={!onVisible}
        onClick={onVisible}
        className={[
          "h-[8px] w-[8px] shrink-0 rounded-5",
          visible ? "bg-ok" : "border border-contour",
        ].join(" ")}
      />
      {onNommer ? (
        <input
          value={nom}
          aria-label={`Nom du calque ${nom}`}
          onFocus={onChoisir}
          onChange={(e) => onNommer(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-encre outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onChoisir}
          className="min-w-0 flex-1 text-left text-[12px] text-encre"
        >
          {nom}
        </button>
      )}
      <button
        type="button"
        onClick={onChoisir}
        aria-label={`Choisir ${nom}`}
        className="mesure shrink-0 text-[10.5px] text-encre-4"
      >
        {pixels === null ? passages : `${passages} · ${pixels} px`}
      </button>
      {onMonter && (
        <button
          type="button"
          aria-label={`Monter ${nom}`}
          onClick={onMonter}
          className="mesure h-[22px] shrink-0 text-[10.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
        >
          ↑
        </button>
      )}
      {onDescendre && (
        <button
          type="button"
          aria-label={`Descendre ${nom}`}
          onClick={onDescendre}
          className="mesure h-[22px] shrink-0 text-[10.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
        >
          ↓
        </button>
      )}
      {onSupprimer && (
        <button
          type="button"
          aria-label={`Supprimer ${nom}`}
          onClick={onSupprimer}
          className="mesure h-[22px] shrink-0 text-[10.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
        >
          ×
        </button>
      )}
    </li>
  )
}

/** La huitième place — **la seule table du produit qui ne pose pas une règle**.
 *
 *  Elle a déménagé entière avec `B23` : la pile des calques, l'opacité qui en
 *  est le sol, le sens du geste, le diamètre du pinceau et sa couleur. Sans
 *  eux, la surface qui reçoit le passage n'aurait rien à peindre — c'est
 *  l'autre moitié du même geste, et les deux moitiés se tiennent maintenant sur
 *  le même écran. */
export function ReglagesDeLaMain({
  recette,
  univers,
  mesures,
  regler,
  poser,
  etatMain,
  section,
}: Poste & { etatMain: EtatMain; section?: "calques" | "peinture" }) {
  const main = mainDe(recette)
  const { actif, choisir, sens, setSens, diametre, setDiametre, couleur, setCouleur } =
    etatMain
  const pose = (suivante: Main) => void poser({ ...recette, main: suivante })

  const surLOpacite = actif === OPACITE
  const calqueActif = surLOpacite ? null : main.calques[actif]
  const passagesActifs = surLOpacite
    ? main.opacite.length
    : (calqueActif?.passages.length ?? 0)
  const dernier: Trait | undefined = surLOpacite
    ? main.opacite[main.opacite.length - 1]
    : calqueActif?.passages[(calqueActif?.passages.length ?? 0) - 1]

  const pixels = (rang: number): number | null => {
    if (!mesures?.main) return null
    return rang === OPACITE ? mesures.main.opacite : (mesures.main.calques[rang] ?? 0)
  }

  const deplacer = (rang: number, vers: number) => {
    const calques = [...main.calques]
    const [pris] = calques.splice(rang, 1)
    calques.splice(vers, 0, pris)
    choisir(vers)
    pose({ ...main, calques })
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* **La pile se lit du dessus au dessous**, comme partout où il y a des
          calques — et elle est *rangée* du dessous vers le dessus, qui est
          l'ordre d'application. Le renversement est écrit ici, et nulle part
          ailleurs. */}
      {section !== "peinture" && <div className="flex flex-col gap-[4px]">
        <Etiquette>les calques</Etiquette>
        <ul className="flex flex-col">
          {main.calques
            .map((calque, rang) => ({ calque, rang }))
            .reverse()
            .map(({ calque, rang }) => (
              <RangeeDeCalque
                key={rang}
                nom={calque.nom || `calque ${rang + 1}`}
                passages={calque.passages.length}
                visible={calque.visible}
                actif={actif === rang}
                pixels={pixels(rang)}
                onChoisir={() => choisir(rang)}
                onVisible={() =>
                  pose({
                    ...main,
                    calques: main.calques.map((c, i) =>
                      i === rang ? { ...c, visible: !c.visible } : c,
                    ),
                  })
                }
                onNommer={(nom) =>
                  regler({
                    ...recette,
                    main: {
                      ...main,
                      calques: main.calques.map((c, i) => (i === rang ? { ...c, nom } : c)),
                    },
                  })
                }
                onMonter={
                  rang < main.calques.length - 1 ? () => deplacer(rang, rang + 1) : undefined
                }
                onDescendre={rang > 0 ? () => deplacer(rang, rang - 1) : undefined}
                onSupprimer={() => {
                  choisir(OPACITE)
                  pose({ ...main, calques: main.calques.filter((_, i) => i !== rang) })
                }}
              />
            ))}
          <RangeeDeCalque
            nom="l'opacité"
            passages={main.opacite.length}
            visible
            actif={surLOpacite}
            pixels={pixels(OPACITE)}
            onChoisir={() => choisir(OPACITE)}
          />
        </ul>
        <Pourquoi texte="« l'opacité » est le sol de la pile : elle ne se supprime pas et ne se déplace pas" />
        <button
          type="button"
          onClick={() => {
            choisir(main.calques.length)
            pose({
              ...main,
              calques: [
                ...main.calques,
                { nom: `calque ${main.calques.length + 1}`, visible: true, passages: [] },
              ],
            })
          }}
          className="h-[30px] rounded-7 border border-trait bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
        >
          Un calque de dessin de plus
        </button>
      </div>}

      {/* **Les deux crans changent de nom avec le calque actif.** C'est la même
          mécanique — un passage qui ajoute, un passage qui retire — et le cran
          allumé dit ce que le geste fera. */}
      {section !== "calques" && <><Reglage nom="le sens">
        <Choix
          valeurs={["ajoute", "retire"] as const}
          valeur={sens ? "ajoute" : "retire"}
          libelles={
            surLOpacite
              ? { ajoute: "remettre", retire: "ôter" }
              : { ajoute: "poser", retire: "effacer" }
          }
          onChange={(v) => setSens(v === "ajoute")}
        />
      </Reglage>

      <Reglage nom="le pinceau">
        <Glissiere
          nom="diamètre du pinceau"
          valeur={diametre}
          min={1}
          max={129}
          unite=" px"
          // **Impair seulement, parce qu'un pinceau a un centre** — le curseur
          // rend le cran impair le plus proche, comme le pas de deux de la
          // table d'origine.
          onRegler={(v) => setDiametre(v % 2 === 0 ? v + 1 : v)}
          onPoser={(v) => setDiametre(v % 2 === 0 ? v + 1 : v)}
        />
      </Reglage>
      {/* **Le cran 1 px est le pixel** : un rayon nul ne couvre qu'un pixel de
          large, et c'est l'autre bout de « à main levée, puis au pixel ». */}
      <Pourquoi
        texte={
          diametre === 1
            ? "1 px — c'est le pixel, l'autre bout du geste à main levée"
            : `${diametre} px du rendu · impairs seulement, un pinceau a un centre`
        }
      />

      {!surLOpacite && (
        <Reglage nom="la couleur">
          <ChoixDeCouleur
            couleur={couleur}
            palette={univers.palette}
            onChange={setCouleur}
          />
        </Reglage>
      )}
      {surLOpacite && (
        <Pourquoi texte="l'opacité ne pose aucune couleur : elle décide de ce qui est là" />
      )}

      {/* **Il n'y a pas de liste de passages, et c'est la seule table dans ce
          cas.** Un geste à main levée en produit des dizaines : trente rangées
          ne se relisent pas, elles se subissent. Le calque est l'unité de
          lecture ; le passage n'existe que comme un compte et un Ctrl + Z. */}
      <div className="flex flex-col gap-[4px] border-t border-trait-faible pt-[8px]">
        <Etiquette>le calque actif</Etiquette>
        <span className="mesure text-[10.5px] text-encre-3">
          {surLOpacite ? "l'opacité" : calqueActif?.nom || "calque"} · {passagesActifs}{" "}
          passage{passagesActifs > 1 ? "s" : ""}
        </span>
        {/* Sans cette ligne, défaire est un pari. */}
        {dernier && (
          <span className="mesure text-[10.5px] text-encre-4">
            dernier : {dernier.garde ? (surLOpacite ? "remettre" : "poser") : surLOpacite ? "ôter" : "effacer"} ·{" "}
            {2 * dernier.rayon + 1} px{dernier.couleur ? ` · ${dernier.couleur}` : ""}
          </span>
        )}
        <button
          type="button"
          disabled={passagesActifs === 0}
          onClick={() => pose(sansLeDernier(main, actif))}
          className="h-[30px] rounded-7 border border-trait bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint disabled:hover:border-trait"
        >
          Défaire le dernier · Ctrl + Z
        </button>
      </div>

      <button
        type="button"
        onClick={() => void poser({ ...recette, main: MAIN_VIDE })}
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        Tout effacer
      </button>
      <Pourquoi
        texte={`${main.calques.length} calque${main.calques.length > 1 ? "s" : ""} · ${passagesDe(main)} passage${passagesDe(main) > 1 ? "s" : ""} — on repeint sur l'image, à gauche, et un passage de la main ne voyage pas`}
      /></>}
    </div>
  )
}

// ── Les quatre surfaces à coordonnées ───────────────────────────────────────
//
// **Elles ont déménagé, elles n'ont pas été réécrites** (B23). Les quatre sont
// nées avec le lot U dans l'écran des tables ; leur calcul est repris au
// caractère près, et seul leur habillage passe au papier. Deux implémentations
// d'un même geste finiraient par ne plus viser le même pixel, et c'est
// l'invariant que `B18` a payé sur `palette.py`.
//
// ⚠️ **Une convention de coordonnées, et une seule.** Les quatre lisent le
// rectangle de *l'image* et non celui de la surface (`rectangleDeLImage`),
// coins inclus. Trois travaillent en pixels de l'image **brute** — le
// recadrage s'applique avant la remise sur grille, et c'est ce qui fait
// survivre un point aux passes qui le précèdent ; la main, seule, travaille sur
// le **rendu**, parce que c'est sur lui que la huitième place s'applique et
// c'est lui qui part dans le jeu.

/**
 * L'image en grand, et le passage qu'on y trace.
 *
 * **Les coordonnées sont celles de l'image rendue**, coins inclus — c'est sur
 * elle que la huitième place s'applique, et c'est elle qui part dans le jeu.
 * Le cadre *est* l'image, mis à l'échelle par calcul : une boîte qui ment
 * décale ce qu'on pose dessus, et c'est la leçon du cadre de la Découpe.
 *
 * **Le trait se dessine à la largeur et à la couleur qu'il aura.** Sur un
 * calque de dessin, la couleur choisie ; sur l'opacité, le rouille dans les
 * deux sens — garder et ôter sont deux gestes ordinaires, et l'échec voudrait
 * dire *ça détruit*, ce qu'une gomme ne fait pas.
 *
 * **Le curseur est le carré exact que le prochain passage couvrira** (U11). Il
 * était un cercle qui suivait le pointeur ; il est désormais calé sur le pixel
 * visé, à la taille qu'il aura vraiment — c'est la moitié du réglage, et sans
 * lui le curseur de diamètre serait un nombre abstrait. La forme suit celle du
 * pinceau, qui est carrée parce qu'on peint des pixels.
 */
/** Le choix reste au-dessus du défilement des réglages. Les fabriques ont
 * leurs propres écrans et ne figurent pas parmi les traitements d'une image. */
export function SelecteurDeTable({ table, onTable }: { table: Table; onTable: (table: Table) => void }) {
  return <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
    Table de retouche
    <select aria-label="Table de retouche" value={table} onChange={(event) => onTable(event.target.value as Table)}
      className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-[13px] text-encre">
      {TABLES.filter((outil) => !outil.fabrique).map((outil) => <option key={outil.cle} value={outil.cle}>{NOM_DE_LA_TABLE[outil.cle]}</option>)}
    </select>
  </label>
}

export function ToileDeLaMain({
  asset,
  avant,
  etat,
  onPassage,
  rendu,
  onDebut,
  onTrace,
  sansTrace = false,
}: {
  asset: Pick<Asset, "identifiant" | "empreinte" | "label" | "largeur" | "hauteur" | "rendu_largeur" | "rendu_hauteur">
  avant: boolean
  etat: EtatMain
  onPassage: (trait: Trait) => void
  /** Une frame de planche se peint dans la même surface qu'une image. */
  rendu?: React.ReactNode
  onDebut?: () => void
  /** Le trait en cours, à chaque pixel parcouru — pour qu'un rendu en direct
   *  le peigne pendant le geste (16 septembre 2026). */
  onTrace?: (trait: Trait | null) => void
  /** Le rendu montre déjà le trait : pas de tracé orange par-dessus. */
  sansTrace?: boolean
}) {
  const [trace, setTrace] = useState<[number, number][] | null>(null)
  /** Le pixel visé — **et non la place du pointeur** (U11). Le curseur est le
   *  carré que le prochain passage couvrira, donc il se cale sur la grille de
   *  l'image ; le suivre au pixel d'écran près le décalerait d'un demi-pixel
   *  d'image dès que le zoom dépasse cent pour cent. */
  const [vise, setVise] = useState<[number, number] | null>(null)

  // Les dimensions du **rendu** : c'est lui que la main touche. Une recette
  // vide n'en a pas — le rendu *est* le brut, et ce sont ses dimensions.
  const largeur = asset.rendu_largeur || asset.largeur
  const hauteur = asset.rendu_hauteur || asset.hauteur

  const surLOpacite = etat.actif === OPACITE
  const teinte = surLOpacite ? "var(--color-signal)" : etat.couleur
  const suivreLeTrace = useRef(onTrace)
  suivreLeTrace.current = onTrace
  useEffect(() => {
    suivreLeTrace.current?.(trace ? { garde: etat.sens, rayon: rayonDe(etat.diametre), points: trace, couleur: surLOpacite ? "" : etat.couleur } : null)
  }, [trace, etat.sens, etat.diametre, etat.couleur, surLOpacite])

  /** Le point sous le pointeur, en pixels de l'image rendue.
   *
   *  **Il se lit dans le rectangle de l'image, pas dans celui de la surface**
   *  (U11). C'est le défaut que la seconde séance a relevé — *le trait tombe à
   *  quelques pixels de l'endroit visé, vers la gauche* —, et le mécanisme est
   *  le même que celui trouvé dans la table de recadrage : la surface est
   *  dimensionnée d'après les mesures que l'atelier garde de l'image rendue,
   *  l'image est posée dedans en *tenant dans le cadre*, donc centrée avec des
   *  bandes vides de chaque côté dès que les deux proportions diffèrent d'un
   *  cheveu. Un recadrage change précisément les proportions du rendu : c'est
   *  lui qui ouvrait l'écart, et l'auteur avait raison de le soupçonner. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, largeur, hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * largeur
    const y = ((evenement.clientY - image.top) / image.height) * hauteur
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
      data-toile-main
      style={{ aspectRatio: `${largeur} / ${hauteur}` }}
      className="relative h-full w-full cursor-none"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        evenement.stopPropagation()
        onDebut?.()
        setTrace([point(evenement)])
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        const [x, y] = point(evenement)
        setVise([x, y])
        if (!trace) return
        const dernier = trace[trace.length - 1]
        // **Un point par pixel, pas un par événement.** Un pointeur envoie ce
        // qu'il peut ; garder les doublons gonflerait la recette sans rien
        // ajouter au tracé, que le serveur relie de toute façon.
        if (dernier[0] === x && dernier[1] === y) return
        setTrace([...trace, [x, y]])
      }}
      onPointerUp={terminer}
      onPointerLeave={() => {
        setVise(null)
        terminer()
      }}
    >
      {rendu ?? <img
        src={
          avant
            ? api.avant(asset.identifiant, asset.empreinte)
            : api.rendu(asset.identifiant, asset.empreinte)
        }
        alt={asset.label}
        draggable={false}
        className="damier-papier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />}

      {/* Le passage en cours, à sa vraie largeur : elle vaut (2 × rayon + 1)
          pixels d'image, mise à l'échelle du cadre. Zoomer l'épaissit ; c'est
          voulu, puisqu'elle mesure l'image et non le châssis. */}
      {!sansTrace && trace && trace.length > 0 && (
        <svg
          aria-hidden
          viewBox={`0 0 ${largeur} ${hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {/* **Bouts et joints carrés** (U11), parce que le pinceau l'est. Un
              bout carré déborde d'une demi-largeur au-delà du dernier point,
              ce qui est exactement ce qu'un carré posé sur ce point couvre. */}
          <polyline
            points={trace.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
            fill="none"
            stroke={etat.sens ? teinte : "var(--color-signal)"}
            strokeOpacity={etat.sens ? 1 : 0.45}
            strokeWidth={etat.diametre}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      )}

      {/* Le curseur : **le carré exact que le prochain passage couvrira**
          (U11). Il est calé sur la grille de l'image et non sur le pointeur —
          c'est ce qui en fait une promesse plutôt qu'une indication —, et il
          fait `2 × rayon + 1` pixels d'image, la largeur que le serveur peint.
          Il ne suit pas le zoom du châssis : il mesure l'image, donc il
          grandit avec elle. */}
      {vise && (
        <span
          aria-hidden
          data-curseur-main
          style={{
            left: `${((vise[0] - rayonDe(etat.diametre)) / largeur) * 100}%`,
            top: `${((vise[1] - rayonDe(etat.diametre)) / hauteur) * 100}%`,
            width: `${((2 * rayonDe(etat.diametre) + 1) / largeur) * 100}%`,
            height: `${((2 * rayonDe(etat.diametre) + 1) / hauteur) * 100}%`,
          }}
          className="pointer-events-none absolute border border-signal"
        />
      )}
    </div>
  )
}

/**
 * L'image, et le point qu'on y désigne.
 *
 * **Un cercle, et rien d'autre.** Pas de tracé, pas de rectangle, pas de
 * poignée : cette table ne se peint pas. Le cercle suit le pointeur avec le
 * pixel visé marqué en son centre, et il ne paraît que pendant qu'on vise —
 * sinon le pointeur est celui du produit, et une pipette permanente ferait de
 * chaque regard sur l'image un risque de clic.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, comme le rectangle
 * de recadrage : une seule convention dans tout le produit.
 */
export function PipetteSurImage({
  asset,
  source,
  point,
  onPoint,
}: {
  asset: Pick<Asset, "identifiant" | "empreinte" | "label" | "largeur" | "hauteur">
  source?: string
  /** Le point déjà posé sur cette passe, marqué en creux — on vise à nouveau
   *  en voyant d'où l'on part. */
  point: [number, number] | null
  onPoint: (point: [number, number]) => void
}) {
  const [survol, setSurvol] = useState<{ x: number; y: number } | null>(null)

  /** Le pixel sous le pointeur. **Un plancher, pas un arrondi** : on désigne le
   *  pixel qu'on survole, et un arrondi ferait basculer la visée sur le voisin
   *  dès qu'on dépasse sa moitié — le rectangle de recadrage arrondit, lui,
   *  parce qu'il pose un coin et non un pixel. */
  const pixel = (evenement: React.MouseEvent<HTMLDivElement>) => {
    // **Dans le rectangle de l'image, pas dans celui de la surface** (U11) —
    // la troisième des trois surfaces qui reçoivent un geste, et le même
    // calcul pour les trois.
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return {
      x: Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      y: Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    }
  }

  /** Le centre d'un pixel, en pour cent du cadre — pas son coin. Un cercle posé
   *  sur le coin est décalé d'un demi-pixel, ce qui se voit dès que l'image est
   *  petite et affichée grande. */
  const centre = (x: number, y: number) => ({
    left: `${((x + 0.5) / asset.largeur) * 100}%`,
    top: `${((y + 0.5) / asset.hauteur) * 100}%`,
  })

  return (
    <div
      data-pipette
      style={{ aspectRatio: `${asset.largeur} / ${asset.hauteur}` }}
      className="relative h-full w-full cursor-crosshair"
      onPointerMove={(evenement) => setSurvol(pixel(evenement))}
      onPointerLeave={() => setSurvol(null)}
      onClick={(evenement) => {
        const { x, y } = pixel(evenement)
        onPoint([x, y])
      }}
    >
      <img
        src={source ?? api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier-papier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {point && (
        <span
          aria-hidden
          style={{ ...centre(point[0], point[1]), width: 9, height: 9 }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal"
        />
      )}
      {survol && (
        <span
          aria-hidden
          style={{ ...centre(survol.x, survol.y), width: 15, height: 15 }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-encre"
        >
          <span className="absolute left-1/2 top-1/2 h-px w-px -translate-x-1/2 -translate-y-1/2 bg-encre" />
        </span>
      )}
    </div>
  )
}

/**
 * L'image, et la forme qu'on entoure à main levée autour du sujet.
 *
 * **On trace gros, l'atelier ajuste au bord.** Le trait qu'on fait ne devient
 * jamais le contour du sprite : il borne la recherche, et c'est le serveur qui
 * va chercher le bord du sujet à l'intérieur. C'est pour ça qu'on peut trembler.
 *
 * **La forme se ferme d'elle-même**, et le trait de fermeture se voit pendant
 * qu'on trace : le geste est *entourer*, pas *dessiner une ligne*, et montrer la
 * corde qui manque évite de croire qu'on a laissé un trou.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, comme le point de
 * la pipette et le rectangle de recadrage : une seule convention dans tout le
 * produit, et c'est ce qui fait survivre le tracé aux passes qui le précèdent.
 */
export function TraceSurImage({
  asset,
  source,
  trace,
  onTrace,
}: {
  asset: Pick<Asset, "identifiant" | "empreinte" | "label" | "largeur" | "hauteur">
  source?: string
  /** La forme déjà posée sur cette passe, montrée en creux — on entoure à
   *  nouveau en voyant ce qu'on remplace. */
  trace: [number, number][]
  onTrace: (trace: [number, number][]) => void
}) {
  const [encours, setEncours] = useState<[number, number][] | null>(null)

  const point = (evenement: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return [
      Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    ]
  }

  const terminer = () => {
    if (!encours) return
    setEncours(null)
    // **Moins de trois points n'entoure rien**, et un clic isolé n'est pas un
    // geste raté : c'est un geste qu'on n'a pas fait. On ne pose donc rien
    // plutôt que de poser une forme vide qui n'effacerait rien en silence.
    if (encours.length >= 3) onTrace(encours)
  }

  const montree = encours ?? trace

  return (
    <div
      data-trace
      style={{ aspectRatio: `${asset.largeur} / ${asset.hauteur}` }}
      className="relative h-full w-full cursor-crosshair"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        setEncours([point(evenement)])
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        if (!encours) return
        const [x, y] = point(evenement)
        const dernier = encours[encours.length - 1]
        // **Un point tous les deux pixels, pas un par événement.** Un pointeur
        // envoie ce qu'il peut ; garder les doublons gonflerait la recette sans
        // rien ajouter à une forme que le serveur remplit de toute façon.
        if (Math.abs(dernier[0] - x) < 2 && Math.abs(dernier[1] - y) < 2) return
        setEncours([...encours, [x, y]])
      }}
      onPointerUp={terminer}
      onPointerLeave={terminer}
    >
      {/* **On entoure sur le brut, et pas sur le rendu**, pour la raison exacte
          de la pipette : la forme est en pixels de l'image d'origine, et le
          rendu porte le recadrage et la remise sur grille, qui déplacent tous
          les deux ce qu'on montre. */}
      <img
        src={source ?? api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier-papier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {montree.length > 1 && (
        <svg
          aria-hidden
          viewBox={`0 0 ${asset.largeur} ${asset.hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon
            points={montree.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
            fill="var(--color-signal)"
            fillOpacity={0.14}
            stroke="var(--color-signal)"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  )
}

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
export function CadreDeRecadrage({
  asset,
  source,
  boite,
  onBoite,
  obtenue,
}: {
  asset: Pick<Asset, "identifiant" | "empreinte" | "label" | "largeur" | "hauteur">
  source?: string
  boite: [number, number, number, number] | null
  onBoite: (boite: [number, number, number, number] | null) => void
  /** **Le rectangle réellement gardé, marge comprise** (U2) — mesuré par le
   *  serveur, jamais recalculé ici. La marge s'ajoute à la boîte tracée, ce qui
   *  est le comportement voulu mais que rien ne montrait : on dessinait un
   *  rectangle et le rendu en gardait un autre, sans qu'aucun des deux ne soit
   *  faux. Les deux sont désormais à l'écran ensemble, le second en pointillé. */
  obtenue: [number, number, number, number] | null
}) {
  const [trace, setTrace] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  )

  /** Le point sous le pointeur, en pixels de l'image brute.
   *
   *  **Il se lit dans le rectangle de l'image, pas dans celui de la surface**
   *  (U2, U11). L'image est posée en *tenant dans le cadre* : dès que les deux
   *  proportions diffèrent d'un cheveu — un arrondi de zoom suffit —, elle est
   *  centrée avec des bandes vides de chaque côté, et mesurer la surface
   *  décalerait le tracé de la largeur de la bande. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>) => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return {
      x: Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      y: Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    }
  }

  const dessine = trace ?? (boite ? { x0: boite[0], y0: boite[1], x1: boite[2], y1: boite[3] } : null)
  /** La place d'un rectangle d'image dans la surface, en pour cent. Une seule
   *  arithmétique pour les deux rectangles : ils doivent se superposer
   *  exactement quand la marge est nulle. */
  const place = (x0: number, y0: number, x1: number, y1: number) => ({
    left: `${(Math.min(x0, x1) / asset.largeur) * 100}%`,
    top: `${(Math.min(y0, y1) / asset.hauteur) * 100}%`,
    width: `${((Math.abs(x1 - x0) + 1) / asset.largeur) * 100}%`,
    height: `${((Math.abs(y1 - y0) + 1) / asset.hauteur) * 100}%`,
  })

  return (
    <div
      data-cadre-recadrage
      className="relative h-full w-full"
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
        src={source ?? api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier-papier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {/* **Ce qui est jeté est assombri, pas masqué** — c'est le but : on voit
          qu'on le coupe. Un masque plein montrerait un joli cadrage et
          cacherait ce qu'on est en train de perdre. Quatre bandes plutôt qu'une
          découpe : la même arithmétique que le rectangle, prise à l'envers. */}
      {obtenue && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          <span
            className="absolute left-0 right-0 top-0 bg-encre/40"
            style={{ height: `${(obtenue[1] / asset.hauteur) * 100}%` }}
          />
          <span
            className="absolute bottom-0 left-0 right-0 bg-encre/40"
            style={{
              height: `${((asset.hauteur - 1 - obtenue[3]) / asset.hauteur) * 100}%`,
            }}
          />
          <span
            className="absolute left-0 bg-encre/40"
            style={{
              top: `${(obtenue[1] / asset.hauteur) * 100}%`,
              height: `${((obtenue[3] - obtenue[1] + 1) / asset.hauteur) * 100}%`,
              width: `${(obtenue[0] / asset.largeur) * 100}%`,
            }}
          />
          <span
            className="absolute right-0 bg-encre/40"
            style={{
              top: `${(obtenue[1] / asset.hauteur) * 100}%`,
              height: `${((obtenue[3] - obtenue[1] + 1) / asset.hauteur) * 100}%`,
              width: `${((asset.largeur - 1 - obtenue[2]) / asset.largeur) * 100}%`,
            }}
          />
        </span>
      )}
      {/* **Le rectangle obtenu, en pointillé** — celui que le rendu montre. Il
          se dessine sous le rectangle tracé, pour que le second reste net quand
          les deux coïncident. */}
      {obtenue && (
        <span
          aria-hidden
          data-boite-obtenue
          style={place(obtenue[0], obtenue[1], obtenue[2], obtenue[3])}
          className="pointer-events-none absolute border border-dashed border-encre-4"
        />
      )}
      {dessine && (
        <span
          aria-hidden
          data-boite-tracee
          style={place(dessine.x0, dessine.y0, dessine.x1, dessine.y1)}
          className="pointer-events-none absolute border border-signal"
        />
      )}
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

/** Ce qu'on travaille — **c'est toujours celle-là que l'outil touche**, quel
 *  que soit le témoin posé à côté. Repris de `Comparateur` (`Tables.tsx`,
 *  U2/`B24`) : seul l'habillage change. */
type Travail = "brut" | "rendu"

const CE_QU_ON_TRAVAILLE: Record<Travail, string> = { brut: "Brut", rendu: "Rendu" }

/** Ce qu'on met à côté pour comparer. **Il ne porte jamais rien** — c'est la
 *  règle que la V2.1 a payée : une comparaison pose un témoin à côté, elle ne
 *  remplace pas l'outil. */
type Temoin = "aucun" | "cote" | "dessus"

const CE_QUE_LE_TEMOIN_MONTRE: Record<Temoin, string> = {
  aucun: "Aucun",
  cote: "À côté",
  dessus: "Par-dessus",
}

/** Voir le trait sur plusieurs fonds (B18) — la question que pose le contour
 *  est « est-ce que ça se voit sur l'herbe », et un damier de transparence n'y
 *  répond pas. Les trois teintes sont celles de `atelier-contour.dc.html`. */
type FondApercu = "damier" | "herbe" | "pierre" | "eau"

const FONDS_APERCU: Record<FondApercu, string | null> = {
  damier: null,
  herbe: "var(--color-apercu-herbe)",
  pierre: "var(--color-apercu-pierre)",
  eau: "var(--color-apercu-eau)",
}

/** Ce que la surface fait, écrit sous elle — **le geste, jamais le nom de la
 *  table**, qui est déjà en haut de la colonne. */
const CE_QUE_LA_SURFACE_DIT: Record<"main" | "pipette" | "trace" | "recadrage" | "echange", string> = {
  main: "on repeint",
  pipette: "on vise un pixel",
  trace: "on entoure le sujet",
  recadrage: "on trace le rectangle",
  // **RV24** : la pipette de « celle qui part » vise, comme celle du
  // détourage, mais sur le rendu — d'où le mot différent, pour ne pas laisser
  // croire qu'on retire quelque chose.
  echange: "on vise la couleur qui part",
}

export function Retouche({
  asset: originale,
  soeurs,
  univers,
  traitement,
  retour = "Ses images",
  tableDeLaPorte = null,
  onFermer,
  onSoeur,
  decoupe,
  onErreur,
  onUnivers,
  onAssocierEquipement,
  onPoserSurLaToile,
  enregistrementImmediat = false,
}: {
  asset: Asset
  /** Compatibilité des anciens bancs des tables ; l’application utilise le brouillon. */
  enregistrementImmediat?: boolean
  onAssocierEquipement?: () => void
  /** « Poser sur la toile » (TS18) — **seulement quand on est entré ici
   *  depuis une carte** : la version retouchée se pose sur la toile, reliée à
   *  la carte d'origine. `undefined` ailleurs (la Galerie, un sujet) : ce
   *  geste-là vit déjà sur la fiche d'un asset, et le répéter ici sans lien à
   *  offrir ferait deux boutons pour deux choses différentes. */
  onPoserSurLaToile?: () => void
  /** Les images voisines — les attitudes de la chose quand elle en a une, les
   *  voisines de la grille quand elle n'en a pas (`B24`, déménagé de
   *  `Tables.tsx` ; `B25` pour le second cas). **On passe à l'image voisine sans
   *  que la table ouverte se referme** : c'est le geste qui distingue une table
   *  d'un panneau. */
  soeurs: Asset[]
  univers: Univers
  traitement: EtatTraitement
  /** **Ce qu'il y a derrière** — le nom du lieu où le bouton de gauche remonte
   *  (`B25`). Les sœurs sont les attitudes d'une chose du jeu ou les voisines de
   *  la grille selon d'où l'on vient ; écrire *Ses images* dans les deux cas
   *  mentait à qui arrivait de la galerie sur une image que personne n'a
   *  adoptée — et à qui arrivait d'un emploi par *la différence* d'un calque,
   *  qui fait le troisième cas. C'est `App.tsx` qui le nomme : il est le seul à
   *  savoir d'où l'on vient. */
  retour?: string
  /** La table sur laquelle la porte demande qu'on s'ouvre (`B25`) — *la
   *  différence* d'un calque arrive directement sur la fabrique de
   *  superposition, en un geste, comme `G16` le tenait déjà.
   *
   *  ⚠️ **Lue au montage, et une seule fois.** La table ouverte appartient à
   *  cet écran-ci une fois qu'il est ouvert : la relire à chaque rendu
   *  reposerait la superposition sous les doigts de qui vient d'en sortir. Les
   *  portes ouvrent toujours un écran fermé — c'est le sens même d'une porte —,
   *  donc une seconde demande le remonte à neuf et se lit comme la première. */
  tableDeLaPorte?: Table | null
  onFermer: () => void
  onSoeur: (identifiant: string) => void
  /** La fabrique du découpage, **rendue dans le cadre de la retouche** et non
   *  ailleurs — sans repasser par l'ancien `EcranTables` (`B24`). Une
   *  fonction plutôt qu'un nœud déjà construit : `ouverte` vit dans cet écran
   *  et pas chez l'appelant, qui a donc besoin du geste qui la referme pour
   *  construire son propre `onFermer`. */
  decoupe: (fermerLaFabrique: () => void) => ReactNode
  onErreur: (raison: string) => void
  /** **Le dossier du jeu vient de changer** (M7) — promouvoir un détourage en
   *  défaut du projet l'écrit. */
  onUnivers?: (univers: Univers) => void
}) {
  const immediat = useRecette(originale, onErreur)
  const session = useRetoucheBrouillon(originale, onErreur, !enregistrementImmediat)
  const { recette, setRecette, regler, poser, revenirAuBrut, enVol } = enregistrementImmediat ? immediat : session
  const apercu = enregistrementImmediat ? null : session.apercu
  const asset = apercu ? { ...originale, rendu_largeur: apercu.largeur, rendu_hauteur: apercu.hauteur } : originale
  const mesuresEnregistrees = useMesures(originale)
  const mesures = apercu?.mesures ?? mesuresEnregistrees
  const imageVisible = (brut = false) => brut ? imageAsset(originale, true) : apercu?.rendu ?? imageAsset(originale)
  const [sortie, setSortie] = useState<(() => void) | null>(null)
  // **Enregistrer sous** (`RP20`) — la fenêtre qui demande la case d'arrivée.
  // La raison se lit **avant** le clic : un bouton grisé sans phrase est un
  // bouton cassé (`docs/DESIGN.md`).
  const [enregistrerSous, setEnregistrerSous] = useState(false)
  // **L'éditeur de pixels** (22 septembre 2026) — le même que sur une frame
  // d'animation, ouvert depuis la main.
  const [editeur, setEditeur] = useState(false)
  const sortir = (action: () => void) => { if (!enregistrementImmediat && session.modifie) setSortie(() => action); else action() }
  const [ouverte, setOuverte] = useEtatDuParcours<Table>(`retouche:${asset.projet ?? ""}:table`, tableDeLaPorte ?? "detourage")
  const [panneau, setPanneau] = useEtatDuParcours<"retouche" | "calques" | "recettes">(`retouche:${asset.projet ?? ""}:panneau`, "retouche")
  useEffect(() => { if (tableDeLaPorte) { setOuverte(tableDeLaPorte); setPanneau("retouche") } }, [tableDeLaPorte, setOuverte, setPanneau])
  const [aAppliquer, setAAppliquer] = useState(false)
  useEffect(() => setAAppliquer(false), [asset.identifiant])
  const brouillonHistorique = useBrouillonLocal({
    cle: `retouche:${asset.projet ?? ""}:${asset.identifiant}`, pret: enregistrementImmediat, reference: asset.recette, etat: recette,
    ecran: "La retouche", quoi: asset.label || asset.identifiant,
    appliquer: (suite) => { setRecette(suite); setAAppliquer(true) },
  })
  const brouillon = enregistrementImmediat ? brouillonHistorique : session.brouillon
  const [travail, setTravail] = useState<Travail>("rendu")
  const [temoin, setTemoin] = useState<Temoin>("aucun")
  const [opacite, setOpacite] = useState(50)
  // **L'aperçu sur plusieurs fonds (B18)** — une préférence d'écran, jamais un
  // réglage de la recette : poser le sujet sur de l'herbe ne change pas un
  // pixel du fichier qui part dans le jeu. Le rendu porte déjà son alpha ; le
  // fond se pose donc en CSS, derrière l'image, sans redemander quoi que ce
  // soit au serveur — `apercu_sur_fonds` (`atelier/image/traitement.py`)
  // rend le même calcul côté serveur, pour l'export et pour l'essai.
  const [fondApercu, setFondApercu] = useState<FondApercu>("damier")

  // ⚠️ **La table ouverte survit au changement d'image, délibérément**
  // (`B24`) : passer d'une sœur à l'autre ne doit pas refermer la table sur
  // laquelle on est — c'est le geste qui distingue une table d'un panneau, et
  // c'est aussi le comportement réel de `Tables.tsx`/`App.tsx`, où `ouverte`
  // est un état levé qu'aucune ouverture d'image ne réinitialise seule ; ce
  // n'est que la fabrique qui se referme sur `detourage` en la quittant. Un
  // effet posé ici sur `asset.identifiant` rouvrirait la première table à
  // chaque sœur, ce qui est très exactement le défaut que ce critère interdit.

  // ── Les quatre surfaces à coordonnées (B23) ──────────────────────────────

  const etatMain = useMainDuParcours(`retouche:${asset.projet ?? ""}:${asset.identifiant}:main`, univers)

  /** La passe de détourage qui attend son geste dans l'image, ou `null`.
   *
   *  **L'état vit ici et pas dans la colonne** : la passe se règle à droite et
   *  se vise au milieu, et les deux moitiés du geste n'ont que cet écran-ci en
   *  commun. */
  const [viseeArmee, setViseeArmee] = useState<number | null>(null)
  /** **Dérivée, jamais nettoyée par un effet.** Retirer une passe ou la faire
   *  repasser au bord laisserait un rang armé qui ne désigne plus rien ; le
   *  vérifier au moment de s'en servir évite d'avoir à le corriger après coup,
   *  et un état qu'on corrige après coup est visible un rendu sur deux. */
  const visee =
    viseeArmee !== null && recette.passes[viseeArmee]?.moteur === "couleur"
      ? viseeArmee
      : null
  /** La passe qui attend qu'on **entoure** dans l'image (U12) — le même état
   *  armé, lu par l'autre moteur. Deux états auraient pu s'armer ensemble, et
   *  la surface aurait alors reçu deux gestes à la fois. */
  const entourage =
    viseeArmee !== null && recette.passes[viseeArmee]?.moteur === "trace"
      ? viseeArmee
      : null

  /** La pipette de la table d'échange — « celle qui part » (RV24). **Un état
   *  à part de `viseeArmee`** : elle ne vise aucune passe de détourage, mais
   *  un rang de `recette.quantification.echanges`, et confondre les deux
   *  ferait viser une passe en croyant régler un échange. */
  const [viseeEchangeArmee, setViseeEchangeArmee] = useState<number | null>(null)
  /** **Dérivée, comme `visee`** : retirer l'échange qu'on vise laisserait un
   *  rang armé qui ne désigne plus rien. */
  const echangeVise =
    viseeEchangeArmee !== null &&
    (recette.quantification?.echanges?.[viseeEchangeArmee] ?? null) !== null
      ? viseeEchangeArmee
      : null

  /** La surface que la table ouverte pose sur l'image, ou `null` quand elle
   *  n'en porte aucune. **Une seule à la fois** : une surface qui recevrait
   *  deux gestes ne saurait pas lequel on vient de faire. */
  const surface: "main" | "pipette" | "trace" | "recadrage" | "echange" | null =
    ouverte === "main"
      ? "main"
      : ouverte === "detourage" && visee !== null
        ? "pipette"
        : ouverte === "detourage" && entourage !== null
          ? "trace"
          : ouverte === "quantification" && echangeVise !== null
            ? "echange"
            : ouverte === "recadrage"
              ? "recadrage"
              : null

  /** Le côté de ce que la surface montre. **Trois travaillent sur le brut, la
   *  main et l'échange sur le rendu** : c'est la convention de coordonnées de
   *  chacune, et la mesurer autrement décalerait ce qu'on pose dessus. La
   *  pipette d'un échange vise une couleur « après la réduction » (B17) —
   *  donc le rendu, jamais le brut, exactement comme la main. */
  const coteDeLaSurface: [number, number] =
    surface === "main" || surface === "echange"
      ? [asset.rendu_largeur || asset.largeur, asset.rendu_hauteur || asset.hauteur]
      : [asset.largeur, asset.hauteur]

  // Ctrl + Z retire le dernier passage de la couche active. La touche n'est
  // écoutée que dans la table de la main : ailleurs elle appartient à la toile
  // du tableau d'inspiration, et deux piles d'annulation sur la même touche
  // seraient une pile de trop.
  useEffect(() => {
    if (!enregistrementImmediat) return
    if (surface !== "main") return
    const ecouter = (evenement: KeyboardEvent) => {
      if (!(evenement.ctrlKey || evenement.metaKey) || evenement.key !== "z") return
      const main = mainDe(recette)
      if (passagesDe(main) === 0) return
      evenement.preventDefault()
      void poser({ ...recette, main: sansLeDernier(main, etatMain.actif) })
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [surface, recette, etatMain.actif, poser, enregistrementImmediat])
  useEffect(() => {
    if (enregistrementImmediat) return
    const touches = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement)?.matches("input,textarea,[contenteditable=true]")) return
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey) session.refaire(); else session.defaire() }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void session.enregistrer() }
    }
    window.addEventListener("keydown", touches)
    return () => window.removeEventListener("keydown", touches)
  }, [session, enregistrementImmediat])

  // ── Le grossissement, libre entre 1 et 250 % (`B24`, U2 déménagée) ───────
  //
  // **Repris de `Tables.tsx`, tel quel.** Les crans ×1/×2/×4/×8 se rabattaient
  // sur « réduite pour tenir dans le cadre » dès qu'une image de 1 024 px
  // arrivait : un dessin ne se juge plus quand on n'en voit que ce que
  // `object-contain` en laisse. Le pour cent libre descend sous cent — et
  // c'est tout ce qui change.
  // ⚠️ **Une `ref` posée dans une branche démontée perd son observateur**
  // (`B24`) : `ouverte === "decoupage" | "superposition"` démonte ce cadre
  // pour poser la fabrique à sa place, React y remonte un nœud DOM neuf au
  // retour, et un `ResizeObserver` armé une fois pour toutes (`[]`) continue
  // d'observer l'ancien nœud, orphelin — la fenêtre cesse d'être suivie après
  // le premier aller-retour par une fabrique. Une `ref` de rappel réarme
  // l'observateur à chaque nœud reçu, y compris le second.
  const [noeudCadre, setNoeudCadre] = useState<HTMLDivElement | null>(null)
  const [dispo, setDispo] = useState({ largeur: 0, hauteur: 0 })
  useEffect(() => {
    const noeud = noeudCadre
    if (!noeud) return
    const mesurer = () =>
      setDispo((deja) => {
        // Les 22 px de marge intérieure, des deux côtés. Zéro veut dire *pas
        // encore mesuré* — sous `jsdom` il n'y a aucune mise en page, et un
        // cadre inconnu ne doit retirer aucun cran.
        const largeur = Math.max(0, noeud.clientWidth - 44)
        const hauteur = Math.max(0, noeud.clientHeight - 44)
        return deja.largeur === largeur && deja.hauteur === hauteur
          ? deja
          : { largeur, hauteur }
      })
    mesurer()
    if (typeof ResizeObserver === "undefined") return
    const oeil = new ResizeObserver(mesurer)
    oeil.observe(noeud)
    return () => oeil.disconnect()
  }, [noeudCadre])

  const [zoom, setZoom] = useEtatDuParcours<ZoomTable>(`retouche:${asset.projet ?? ""}:${asset.identifiant}:zoom`, "ajuste")
  const zoomMaximum = enregistrementImmediat ? ZOOM_MAX : 1600
  const bornerZoom = (v: number) => Math.max(ZOOM_MIN, Math.min(zoomMaximum, Math.round(v)))
  // Changer d'image rouvre en ajusté, pour la même raison que la table.

  // **Le damier cède la place au fond choisi**, et seulement sur la table du
  // contour — c'est elle qui pose la question, les sept autres n'en ont pas
  // besoin. Le damier peint son propre fond derrière l'image ; il faut donc
  // l'ôter, sans quoi la couleur posée sur le cadre ne se verrait jamais.
  const montreUnFond = ouverte === "contours" && FONDS_APERCU[fondApercu] !== null

  /** Ce qu'on regarde vraiment. **Le rendu peut faire 64 px là où l'origine
   *  en fait 1 024** : le pour cent ajusté se calcule sur celle des deux
   *  qu'on travaille, jamais sur l'autre.
   *
   *  ⚠️ **Et quand une surface est posée, c'est elle qu'on regarde** (`B23`,
   *  fusionné en `B24`). Elle prend la place de l'image, et ses coordonnées ne
   *  sont pas celles que `travail` désigne : trois des quatre travaillent en
   *  pixels du brut, la main sur le rendu. Mesurer l'ajusté sur l'autre côté
   *  rendrait un pour cent qui ne fait tenir personne — une surface de
   *  2 048 px ajustée sur un rendu de 64 px sortirait du cadre de tous les
   *  côtés à la fois, et c'est très exactement le coin haut-gauche qu'on ne
   *  pourrait plus atteindre. */
  const largeurVue =
    (surface !== null
      ? coteDeLaSurface[0]
      : travail === "brut"
        ? asset.largeur
        : asset.rendu_largeur || asset.largeur) || 1
  const hauteurVue =
    (surface !== null
      ? coteDeLaSurface[1]
      : travail === "brut"
        ? asset.hauteur
        : asset.rendu_hauteur || asset.hauteur) || 1

  /** **Le pour cent qui fait tenir l'image entière dans le cadre.** Il
   *  descend sous cent, et il ne s'arrondit à aucun multiple : la règle des
   *  multiples entiers appartient à ce qui *montre* une image, pas à ce qui
   *  la travaille. Deux images côte à côte se partagent la place, donc le
   *  témoin « à côté » compte double. */
  const ajuste = bornerZoom(
    Math.min(
      dispo.largeur > 0
        ? dispo.largeur / (largeurVue * (temoin === "cote" ? 2 : 1))
        : 1,
      dispo.hauteur > 0 ? dispo.hauteur / hauteurVue : 1,
    ) * 100 || 100,
  )
  const facteur = (zoom === "ajuste" ? ajuste : zoom) / 100

  // ── La molette approche et recule, et le point visé ne bouge pas ──────────
  //
  // **Repris de `Tables.tsx`, tel quel** (U2, rendue à l'écran neuf le
  // 9 septembre 2026). `B25` avait recâblé les six portes sans que la molette
  // ait déménagé avec elles : approcher ne se faisait plus qu'au champ et aux
  // deux boutons, alors que c'est un critère déjà coché du lot `U`.
  //
  // **Un écouteur natif et non `onWheel`.** React pose ses écouteurs de molette
  // en *passif* sur la racine : `preventDefault` y est ignoré, et la page
  // défilerait derrière le zoom. Posé à la main avec `{ passive: false }`, il
  // arrête le défilement — c'est ce qui rend la molette utilisable dans un cadre
  // qui défile.
  //
  // **Le point sous le pointeur reste sous le pointeur**, et ça se fait en deux
  // temps : on note où l'on était *dans l'image* au moment du geste, puis on
  // rattrape le défilement une fois que la nouvelle taille est posée. Le faire
  // en un temps demanderait de prédire la mise en page — le `m-auto` qui centre
  // une image plus petite que son cadre, les 22 px de garde — et une prédiction
  // fausse se voit comme un sursaut.
  const boiteImage = useRef<HTMLDivElement>(null)
  const ancreDuZoom = useRef<{ ux: number; uy: number; x: number; y: number } | null>(
    null,
  )
  // `ajuste` est recalculé à chaque rendu ; l'écouteur, lui, n'est posé qu'à
  // chaque nœud de cadre. Un repère plutôt qu'une dépendance : le rebrancher à
  // chaque redimensionnement en poserait un par image de rendu.
  const ajusteVu = useRef(ajuste)
  ajusteVu.current = ajuste

  // ⚠️ **`noeudCadre` en dépendance, et non `[]`** : le cadre est démonté quand
  // une fabrique prend sa place (`B24`), et un écouteur armé une fois pour
  // toutes resterait sur le nœud orphelin — même piège que le `ResizeObserver`
  // juste au-dessus.
  useEffect(() => {
    if (!noeudCadre) return
    const molette = (evenement: WheelEvent) => {
      evenement.preventDefault()
      const rectangle = boiteImage.current?.getBoundingClientRect()
      if (rectangle && rectangle.width > 0 && rectangle.height > 0)
        ancreDuZoom.current = {
          ux: (evenement.clientX - rectangle.left) / rectangle.width,
          uy: (evenement.clientY - rectangle.top) / rectangle.height,
          x: evenement.clientX,
          y: evenement.clientY,
        }
      // Un cran de molette vaut un huitième d'octave : assez pour que le geste
      // réponde, assez peu pour qu'on s'arrête où l'on veut.
      const pas = evenement.deltaY < 0 ? 1.09 : 1 / 1.09
      setZoom((courant) =>
        bornerZoom((courant === "ajuste" ? ajusteVu.current : courant) * pas),
      )
    }
    noeudCadre.addEventListener("wheel", molette, { passive: false })
    return () => noeudCadre.removeEventListener("wheel", molette)
  }, [noeudCadre])

  useLayoutEffect(() => {
    const vise = ancreDuZoom.current
    ancreDuZoom.current = null
    const rectangle = boiteImage.current?.getBoundingClientRect()
    if (!vise || !noeudCadre || !rectangle) return
    noeudCadre.scrollLeft += rectangle.left + vise.ux * rectangle.width - vise.x
    noeudCadre.scrollTop += rectangle.top + vise.uy * rectangle.height - vise.y
  }, [facteur, noeudCadre])

  /** **La surface est réduite pour tenir dans le cadre** (`B23`) — l'ajusté est
   *  descendu sous cent parce que l'image ne rentrait pas autrement. C'était le
   *  cas que les crans ×1/×2/×4/×8 ne savaient pas dire : ×1 ne tenait pas, la
   *  surface prenait ses pixels réels, et le coin haut-gauche d'une image de
   *  1 024 dans un cadre de 545 devenait inatteignable pour toujours — plus
   *  moyen d'y poser un coin de recadrage, d'y viser un pixel, d'y peindre.
   *  Le pour cent libre le dit maintenant tout seul, et le dit à l'écran.
   *
   *  L'attribut reste sur la figure parce que c'est la seule marque
   *  observable de ce repli, et que `rectangleDeLImage` convertit à la taille
   *  affichée : réduire la surface ne décale aucune coordonnée envoyée. */
  const surfaceAuCadre = surface !== null && zoom === "ajuste" && ajuste < 100
  /** Ce par quoi multiplier le côté de la surface. **Le même facteur que
   *  l'image**, et pas une échelle à elle : la surface prend la place de
   *  l'image, donc lui en donner une seconde ferait mentir le pour cent
   *  affiché — l'invariant de `B24`. C'est `ajuste` qui la fait tenir dans le
   *  cadre, et le `m-auto` du cadre qui garde ses deux coins atteignables
   *  quand on la grossit au-delà. */
  const echelleDeLaSurface = facteur

  /** **Cet écran-ci les a tous les quatre**, et le type le dit : il montre une
   *  image, il tient la pile de la main, et sa barre ouvre les autres places.
   *  Les quatre facultatifs de `Poste` sont facultatifs pour l'atelier d'une
   *  animation, pas pour la retouche. */
  const poste: Poste & { etatMain: EtatMain } = {
    recette,
    univers,
    traitement,
    mesures,
    regler,
    poser,
    ouvrir: setOuverte,
    armee: viseeArmee,
    onArmer: setViseeArmee,
    viseeEchange: echangeVise,
    onViserEchange: setViseeEchangeArmee,
    etatMain,
  }

  const raison = indisponible(ouverte, traitement, mesures)
  const place = placeDe(ouverte)
  const endormie = dort(recette, ouverte)
  const resume = valeur(ouverte, recette)

  /** Ce qui travaille, écrit en clair sous la jauge. **Avec des mots, pas un
   *  pourcentage** — les onze pièces disent *le temps qui reste*. */
  const quoiTravaille = useMemo(
    () =>
      enVol === null
        ? ""
        : enVol.attendue > 0.5
          ? "on redemande la silhouette au modèle"
          : `on rejoue la chaîne · ${NOM_DE_LA_TABLE[ouverte].toLowerCase()}`,
    [enVol, ouverte],
  )

  // ── Ce qui voyage d'une image à l'autre (U5, déménagé en `B24`) ──────────
  //
  // **Le presse-papiers vit hors de React**, dans `interface/src/recette.ts`
  // — importé ici, pas recréé : copier dans un écran et coller dans l'autre
  // reste un seul geste tant que ce module reste la seule source de vérité.
  const [nommees, setNommees] = useState<string[]>([])
  const [annonceRecette, setAnnonceRecette] = useState<string[] | null>(null)
  const [aCopier, setACopier] = useState(lireLePressePapier() !== null)
  useEffect(() => setAnnonceRecette(null), [asset.identifiant])

  /** Ce que le serveur a posé revient dans l'écran, recette comprise — coller
   *  et appliquer ne passent pas par `poser` : c'est le serveur qui décide de
   *  ce qui arrive. */
  const recevoirRecette = (recu: { asset: Asset; laisse: string[] }) => {
    setRecette(recu.asset.recette)
    setAnnonceRecette(recu.laisse)
  }

  const recettes = {
    nommees,
    annonce: annonceRecette,
    aCopier,
    onLister: () => {
      void api
        .recettesNommees()
        .then((recu) => setNommees(Object.keys(recu.recettes).sort()))
        .catch(() => setNommees([]))
    },
    onCopier: () => {
      copierDansLePressePapier(recette)
      setACopier(true)
      setAnnonceRecette(null)
    },
    onColler: () => {
      const copiee = lireLePressePapier()
      if (copiee === null) return
      if (!enregistrementImmediat) { void session.coller(copiee); return }
      void api
        .collerRecette(asset.identifiant, copiee)
        .then(recevoirRecette)
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "collage refusé"),
        )
    },
    onEnregistrer: (nom: string) => {
      void api
        .nommerRecette(nom, recette)
        .then((recu) => {
          setNommees(Object.keys(recu.recettes).sort())
          setAnnonceRecette(recu.laisse)
        })
        .catch((erreur) =>
          onErreur(
            erreur instanceof Error ? erreur.message : "recette non enregistrée",
          ),
        )
    },
    onAppliquer: (nom: string) => {
      if (!enregistrementImmediat) { void session.appliquer(nom); return }
      void api
        .appliquerRecette(asset.identifiant, nom)
        .then(recevoirRecette)
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "recette refusée"),
        )
    },
    onOublier: (nom: string) => {
      void api
        .oublierRecette(nom)
        .then((recu) => setNommees(Object.keys(recu.recettes).sort()))
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "oubli refusé"),
        )
    },
  }

  // ── La barre : huit tables, un trait, deux fabriques ───────────────────────
  // **L'ordre vient de `TABLES`, et il n'est écrit qu'une fois.** C'est celui
  // du domaine ; le lire autrement mentirait sur ce que l'image a subi. Aucune
  // table n'est cachée — même indisponible, elle s'ouvre et porte sa raison à
  // la place de ses réglages. Elle vit dans le panneau (onglet Retouche) ; et
  // dans l'en-tête tant qu'une fabrique occupe le cadre, panneau compris, pour
  // qu'on passe d'une fabrique ou d'une table à l'autre sans détour.
  const fabriqueOuverte = ouverte === "decoupage" || ouverte === "superposition"
  const barreDesTables = (
    <details className="shrink-0 text-[12px] text-encre-3"><summary className="cursor-pointer">Toutes les tables et leur état</summary>
    <div data-barre-des-tables className="flex flex-wrap items-center gap-[4px] pt-[8px]">
      {TABLES.map((t, rang) => {
        const etat = etatDe(t.cle, recette, traitement, mesures)
        const premiereFabrique = t.fabrique && !TABLES[rang - 1]?.fabrique
        return (
          <div key={t.cle} className="flex items-center gap-[4px]">
            {premiereFabrique && (
              <span
                aria-hidden
                data-trait-des-fabriques
                className="mx-[8px] inline-block h-[22px] w-px bg-contour"
              />
            )}
            <button
              type="button"
              data-table={t.cle}
              data-etat={etat}
              aria-pressed={ouverte === t.cle}
              onClick={() => {
                const ouvrir = () => { setPanneau("retouche"); setOuverte(t.cle) }
                if (t.fabrique) sortir(ouvrir)
                else ouvrir()
              }}
              // ⚠️ **Pas d'infobulle ici.** Vu au navigateur : un `title` sur
              // un bouton devient son nom dans l'arbre d'accessibilité — la
              // barre s'annonçait « Les bords vides sautent. » au lieu de
              // « Recadrage ». La phrase est déjà écrite en clair pour la
              // table ouverte ; la répéter au survol coûtait le nom du bouton.
              className={[
                "flex h-[30px] items-center gap-[4px] rounded-7 border px-[8px] text-[12px] transition-colors duration-120",
                ouverte === t.cle
                  ? "border-encre-4 bg-carte font-medium text-encre"
                  : "border-trait bg-carte text-encre-3 hover:border-encre-4 hover:text-encre",
              ].join(" ")}
            >
              {!t.fabrique && <Pastille etat={etat} />}
              {NOM_DE_LA_TABLE[t.cle]}
            </button>
          </div>
        )
      })}
    </div></details>
  )

  return (
    <main
      data-retouche
      aria-label={`La retouche de ${asset.label}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      {/* **La charpente de l'atelier d'animation** (`AtelierDeBande.tsx`) :
          une grille, l'en-tête en travers, la scène à gauche, le panneau à
          droite sur deux rangs, et les sœurs sous la scène à la place du
          ruban des frames. La colonne de droite suit la largeur de l'écran
          (40 %, jamais moins de 300 px) au lieu d'un 300 px fixe qui
          faisait heurter les titres de table contre leurs boutons. */}
      <div className="atelier-image-unifie grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,40%)] grid-rows-[auto_minmax(0,1fr)_auto] gap-[14px] overflow-hidden bg-papier p-[14px]">
        <header className="col-span-2 flex min-w-0 items-center justify-between gap-[22px]">
          <div className="min-w-0"><h1 className="truncate font-serif text-[25px] text-encre">{asset.label}</h1><p className="mt-[4px] text-[12px] text-encre-3">Image · {asset.largeur}×{asset.hauteur} px · {enregistrementImmediat ? "réglages enregistrés au fil des gestes" : session.modifie ? "Brouillon de retouche" : "Version enregistrée"}</p>{fabriqueOuverte && barreDesTables}</div>
          <div className="flex shrink-0 items-center gap-[8px]">
            {/* Une fabrique ouverte prend le cadre entier, panneau compris :
                le retour à la Main (et la barre, à gauche) restent donc dans
                l'en-tête tant qu'elle est là. */}
            {fabriqueOuverte && <button type="button" onClick={() => setOuverte("main")} className="h-[34px] px-[8px] text-[12px] text-signal">‹ Main</button>}
            <button type="button" onClick={() => sortir(onFermer)} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre-controle">‹ {retour}</button>
            {!enregistrementImmediat && <button type="button" disabled={!session.modifie || !session.valide || !!enVol || session.enregistre} onClick={() => void session.enregistrer()} className="h-[34px] rounded-7 bg-signal px-[14px] text-[12px] text-encre-sur-signal disabled:opacity-50">{session.enregistre ? "on enregistre…" : "Enregistrer ›"}</button>}
            {/* **Enregistrer sous…, à côté d’Enregistrer** (`RP20`). Grisé
                avec sa raison tant qu’aucune retouche n’est appliquée : sans
                recette, le geste rangerait la même image dans une seconde
                case. */}
            <button type="button" title={raisonDEnregistrerSous(recette) ?? "Le résultat devient une autre pose ou direction"} disabled={!!raisonDEnregistrerSous(recette)} onClick={() => setEnregistrerSous(true)} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre-controle disabled:opacity-50">Enregistrer sous…</button>
          </div>
        </header>

        {/* **La fabrique prend le cadre entier.** Elle ne pose rien sur
            l'image ouverte : elle en écrit d'autres, et le montrer entre une
            colonne de réglages et une colonne de sœurs mentirait sur ce
            qu'elle fait — la règle de `Tables.tsx` (`B24`). */}
        {ouverte === "decoupage" ? (
          <div className="col-span-2 row-start-2 row-span-2 flex min-h-0 overflow-hidden pb-[22px]">
            {decoupe(() => setOuverte("detourage"))}
          </div>
        ) : ouverte === "superposition" ? (
          <div className="col-span-2 row-start-2 row-span-2 flex min-h-0 overflow-hidden pb-[22px]">
            <EcranSuperposition
              asset={asset}
              soeurs={soeurs}
              onErreur={onErreur}
              onFabrique={(nees) => nees.length > 0 && onSoeur(nees[0].identifiant)}
            />
          </div>
        ) : (
        <>
          {/* ── L'image, et rien par-dessus ─────────────────────────────── */}
          <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col gap-[8px]">
            {/* **La rangée de l'animation** (`AtelierDeBande.tsx`) : Défaire,
                Refaire, et la taille à droite. Sans défaire (enregistrement
                immédiat), la taille reste seule à sa place. */}
            <div className="flex min-h-[30px] shrink-0 items-center gap-[8px]">
              {!enregistrementImmediat && <><button type="button" disabled={!session.peutDefaire} onClick={session.defaire} title="Ctrl + Z" className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 disabled:opacity-50">Défaire</button><button type="button" disabled={!session.peutRefaire} onClick={session.refaire} title="Ctrl + Maj + Z" className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 disabled:opacity-50">Refaire</button>{!session.valide && !enVol && <button type="button" onClick={() => void poser(recette)} className="text-[12px] text-signal">Recalculer l’aperçu</button>}</>}
              <span className="ml-auto text-[12px] text-encre-3">{largeurVue} × {hauteurVue} px</span>
            </div>
            {/* **La barre du zoom de l'animation**, les bascules à la place
                du rappel des gestes. Pas de `BarreDuZoom` : son rappel
                « Ctrl + molette · Espace + glisser » serait faux ici, la
                molette seule zoome et l'espace ne déplace pas la vue. */}
            <div className="flex w-full shrink-0 flex-wrap items-center gap-[8px] py-[4px]">
              <div className="flex flex-wrap items-center gap-[8px]">
                {/* ⚠️ **Un grossissement affiché est un grossissement
                    appliqué.** Vu au navigateur sur un jeu en dessin : l'écran
                    disait ×4 sur une image de 2 048 px que le cadre réduisait
                    en fait à un cinquième. Le pour cent libre descend en
                    dessous de cent au lieu de se rabattre sur une phrase :
                    l'image entière se voit toujours, à un pour cent qui est le
                    pour cent appliqué. **Et ce qu'il dit arrive aussi pour la
                    surface** (`B23`) : c'est elle que l'ajusté mesure quand
                    elle est posée, donc elle tient dans le cadre comme
                    l'image. (Le zoom lui-même est posé à droite, plus bas.) */}
                {/* **« Sur », et « témoin » — deux questions, deux contrôles**
                    (`Comparateur`, `Tables.tsx`, `B24`). Le premier dit quelle
                    image porte le regard, le second dit ce qu'on met à côté
                    pour comparer ; aucun croisement n'est interdit. */}
                <div data-travail className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                  {(Object.keys(CE_QU_ON_TRAVAILLE) as Travail[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={travail === t}
                      onClick={() => setTravail(t)}
                      className={[
                        "flex h-[26px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                        travail === t
                          ? "bg-carte font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      {CE_QU_ON_TRAVAILLE[t]}
                    </button>
                  ))}
                </div>

                <div
                  data-temoin
                  className="flex items-center gap-[4px] rounded-8 bg-papier-cote p-[4px]"
                >
                  {(Object.keys(CE_QUE_LE_TEMOIN_MONTRE) as Temoin[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={temoin === t}
                      onClick={() => setTemoin(t)}
                      className={[
                        "flex h-[26px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                        temoin === t
                          ? "bg-carte font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      {CE_QUE_LE_TEMOIN_MONTRE[t]}
                    </button>
                  ))}
                  {temoin === "dessus" && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={opacite}
                      aria-label="Opacité du témoin par-dessus"
                      onChange={(e) => setOpacite(Number(e.target.value))}
                      className="w-[70px]"
                    />
                  )}
                </div>

                {/* **Sur plusieurs fonds, seulement là où la question se
                    pose** (B18) — les autres tables n'ont pas à en tenir
                    compte, et le proposer partout aurait dilué l'unique
                    raison d'être de celui-ci : voir si le trait se détache. */}
                {ouverte === "contours" && (
                  <div
                    data-fond-apercu
                    className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]"
                  >
                    {(Object.keys(FONDS_APERCU) as FondApercu[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={fondApercu === f}
                        onClick={() => setFondApercu(f)}
                        className={[
                          "flex h-[26px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                          fondApercu === f
                            ? "bg-carte font-medium text-encre"
                            : "text-encre-3 hover:text-encre",
                        ].join(" ")}
                      >
                        {f === "damier" ? "Damier" : f[0].toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div data-zoom className="ml-auto flex items-center gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                <CommandesDuZoom zoom={zoom} onZoom={setZoom} ajuste={ajuste} maximum={zoomMaximum} />
              </div>
            </div>

            <div
              ref={setNoeudCadre}
              data-scene-de-retouche
              style={montreUnFond ? { backgroundColor: FONDS_APERCU[fondApercu] as string } : undefined}
              className="defile flex min-h-0 flex-1 overflow-auto rounded-7 border border-trait bg-pourtour"
            >
              {/* **`m-auto` sur la boîte, jamais `justify-center` sur le
                  cadre qui défile** (`B24`) : un contenu centré par
                  `justify-center` déborde des deux côtés à la fois et le
                  début — le bord gauche, le haut — devient inatteignable au
                  défilement. C'est très exactement le piège que `Tables.tsx`
                  a réparé pour son propre zoom ; même remède ici, et c'est
                  aussi ce qui garde les coins de la surface (`B23`)
                  atteignables quand on la grossit au-delà de l'ajusté. */}
              {/* **`data-boite-image` est ce que la molette vise** : c'est la
                  boîte dont le rectangle donne le point de l'image resté sous
                  le pointeur. */}
              <div
                ref={boiteImage}
                data-boite-image
                className="m-auto flex shrink-0 items-center gap-[8px]"
              >
                {temoin === "cote" && (
                  <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                    <img
                      src={imageVisible(travail !== "brut")}
                      alt={`${asset.label}, témoin — ${travail === "brut" ? "le rendu" : "l'image d'origine"}`}
                      width={Math.max(
                        1,
                        Math.round(
                          (travail === "brut" ? asset.rendu_largeur || asset.largeur : asset.largeur) *
                            facteur,
                        ),
                      )}
                      height={Math.max(
                        1,
                        Math.round(
                          (travail === "brut" ? asset.rendu_hauteur || asset.hauteur : asset.hauteur) *
                            facteur,
                        ),
                      )}
                      style={{ imageRendering: "pixelated" }}
                      className="damier-papier block max-h-full min-w-0 object-contain"
                    />
                    <figcaption className="mesure text-[10.5px] text-carte">
                      témoin ·{" "}
                      {travail === "brut" ? asset.rendu_largeur || asset.largeur : asset.largeur}×
                      {travail === "brut" ? asset.rendu_hauteur || asset.hauteur : asset.hauteur}
                    </figcaption>
                  </figure>
                )}

                {/* ── La surface qui reçoit le geste (B23) ─────────────────
                    **Elle prend la place de l'image, elle ne se pose pas
                    dessus.** Les quatre portent leur propre image — le brut
                    pour les trois qui travaillent en pixels d'origine, le
                    rendu pour la main —, et le cadre qui les tient *est*
                    l'image, à la taille du grossissement choisi : une boîte
                    qui ment décale ce qu'on pose dedans.

                    ⚠️ **Elle est ce que l'ajusté mesure.** Le pour cent qui
                    fait tenir l'image se calcule sur ses côtés à elle dès
                    qu'elle est posée, sans quoi un coin resterait hors
                    d'atteinte. Voir `surfaceAuCadre`. */}
                {surface !== null ? (
                <figure
                  data-surface={surface}
                  data-surface-au-cadre={surfaceAuCadre ? "" : undefined}
                  className="flex min-w-0 flex-col items-center gap-[4px]"
                >
                  <div
                    style={{
                      width: coteDeLaSurface[0] * echelleDeLaSurface,
                      height: coteDeLaSurface[1] * echelleDeLaSurface,
                    }}
                    className="min-w-0 shrink-0"
                  >
                    {surface === "main" ? (
                      <ToileDeLaMain
                        asset={asset}
                        avant={travail === "brut"}
                        etat={etatMain}
                        rendu={!enregistrementImmediat ? <img src={imageVisible(travail === "brut")} alt={asset.label} draggable={false} className="damier-papier h-full w-full select-none object-contain" style={{ imageRendering: "pixelated" }} /> : undefined}
                        onPassage={(trait) =>
                          void poser({
                            ...recette,
                            main: avecPassage(mainDe(recette), etatMain.actif, trait),
                          })
                        }
                      />
                    ) : surface === "pipette" && visee !== null ? (
                      <PipetteSurImage
                        asset={asset}
                        point={recette.passes[visee].point}
                        onPoint={(point) => {
                          void poser({
                            ...recette,
                            passes: recette.passes.map((p, i) =>
                              i === visee ? { ...p, point } : p,
                            ),
                          })
                          // **Le clic désarme.** Viser est un geste qui se
                          // termine ; une visée qui reste armée ferait du
                          // prochain regard sur l'image un déplacement du
                          // point, sans que rien l'ait demandé.
                          setViseeArmee(null)
                        }}
                      />
                    ) : surface === "trace" && entourage !== null ? (
                      <TraceSurImage
                        asset={asset}
                        trace={recette.passes[entourage].trace}
                        onTrace={(trace) => {
                          void poser({
                            ...recette,
                            passes: recette.passes.map((p, i) =>
                              i === entourage ? { ...p, trace } : p,
                            ),
                          })
                          // Le tracé fini désarme, pour la raison du clic de la
                          // pipette.
                          setViseeArmee(null)
                        }}
                      />
                    ) : surface === "echange" && echangeVise !== null ? (
                      // **La pipette de « celle qui part » (RV24)** — même
                      // geste que celle du détourage, sur le rendu plutôt que
                      // le brut : c'est là qu'existe la couleur que l'échange
                      // remplace. Le point ne se garde pas, contrairement à
                      // `passe.point` : une seule paire vise, jamais un
                      // historique, et le serveur qui répond dit directement
                      // la couleur — pas un point qui resterait à relire.
                      <PipetteSurImage
                        asset={{ ...asset, largeur: coteDeLaSurface[0], hauteur: coteDeLaSurface[1] }}
                        source={imageVisible(false)}
                        point={null}
                        onPoint={(point) => {
                          // **Le clic désarme**, comme les trois autres
                          // pipettes de cet écran.
                          setViseeEchangeArmee(null)
                          const quantification = recette.quantification
                          if (!quantification) return
                          const echanges = quantification.echanges ?? []
                          void api
                            .apercuRecette(asset.identifiant, recette, { viser: point })
                            .then((reponse) => {
                              const couleur = reponse.mesures.couleurs.visee
                              // `undefined` sur un serveur plus vieux que la
                              // route, `null` sur un point transparent ou hors
                              // image (`atelier/services/assets.py`,
                              // `_couleur_au_point`) : dans les deux cas rien
                              // à poser — « celle qui part » reste ce qu'elle
                              // était plutôt que de devenir une couleur
                              // inventée.
                              if (!couleur) return
                              void poser({
                                ...recette,
                                quantification: {
                                  ...quantification,
                                  echanges: echanges.map((e, i) =>
                                    i === echangeVise ? { ...e, depuis: couleur } : e,
                                  ),
                                },
                              })
                            })
                            .catch(() => {
                              // Un échec de réseau laisse « celle qui part »
                              // telle qu'elle était — rien de pire qu'un geste
                              // qui n'a pas eu lieu.
                            })
                        }}
                      />
                    ) : (
                      <CadreDeRecadrage
                        asset={asset}
                        boite={
                          (recette.recadrage?.boite as
                            | [number, number, number, number]
                            | undefined) ?? null
                        }
                        obtenue={mesures?.recadrage?.obtenue ?? null}
                        // ⚠️ **Les huit champs, jamais deux** — la même leçon
                        // que la colonne d'à côté : un envoi partiel effacerait
                        // les six autres réglages du recadrage au premier
                        // rectangle tracé.
                        onBoite={(boite) =>
                          void poser({
                            ...recette,
                            recadrage: {
                              ...RECADRAGE_PAR_DEFAUT,
                              ...(recette.recadrage ?? {}),
                              boite,
                            },
                          })
                        }
                      />
                    )}
                  </div>
                  <figcaption className="mesure text-[10.5px] text-carte">
                    {CE_QUE_LA_SURFACE_DIT[surface]} · {coteDeLaSurface[0]}×
                    {coteDeLaSurface[1]}
                  </figcaption>
                </figure>
                ) : (
                <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                  {/* **Le calque de témoin ne partage son conteneur relatif
                      qu'avec l'image qu'il double** (`B24`) : posé plus haut,
                      dans une `<figure>` qui contenait aussi la légende, il
                      se décalait de l'image — mesuré au navigateur, +9 px au
                      repos et hors-échelle à 250 %. `Tables.tsx` ne met rien
                      d'autre que l'image dans son `<span className="relative">` ;
                      la légende sort donc du conteneur relatif, et le
                      `<span>` porte la taille exacte de l'image affichée pour
                      que le calque en `h-full w-full` coïncide au pixel. */}
                  <span
                    className="relative block max-h-full min-w-0"
                    style={{
                      width: Math.max(1, Math.round(largeurVue * facteur)),
                      height: Math.max(1, Math.round(hauteurVue * facteur)),
                    }}
                  >
                    <img
                      src={imageVisible(travail === "brut")}
                      alt={asset.label}
                      width={Math.max(1, Math.round(largeurVue * facteur))}
                      height={Math.max(1, Math.round(hauteurVue * facteur))}
                      style={{ imageRendering: "pixelated" }}
                      className={[
                        montreUnFond ? "" : "damier-papier",
                        "block h-full w-full object-contain",
                      ].join(" ")}
                    />
                    {/* **Un calque de lecture, et il ne prend pas le pointeur.**
                        Le curseur d'opacité continue de dire ce qu'on voit ; une
                        image posée par-dessus qui intercepterait les clics serait
                        le défaut que `Tables.tsx` a réparé en U2. */}
                    {temoin === "dessus" && (
                      <img
                        src={imageVisible(travail !== "brut")}
                        alt={`${asset.label}, témoin — ${travail === "brut" ? "le rendu" : "l'image d'origine"}`}
                        style={{ imageRendering: "pixelated", opacity: opacite / 100 }}
                        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                      />
                    )}
                  </span>
                  {/* **La taille rendue est écrite sous l'image**, parce que
                      c'est le seul endroit où le contour se voit changer les
                      dimensions du fichier qui part dans le jeu. */}
                  <figcaption className="mesure text-[10.5px] text-carte">
                    {travail === "brut" ? "brut" : "rendu"} · {largeurVue}×{hauteurVue}
                  </figcaption>
                </figure>
                )}
              </div>
            </div>

            {/* **Le seul état durable qui change ce qu'un outil touche.** Il
                se redit en ambre sous l'image, sinon on juge la mauvaise —
                repris de `Comparateur` (`Tables.tsx`, `B24`). */}
            {travail === "brut" && (
              <span className="text-[10.5px] text-epingle">on travaille sur le brut</span>
            )}

            {/* **La jauge est sous l'image, jamais dessus** — et elle ne
                paraît qu'au-delà de 240 ms. */}
            <JaugeDuCalcul enVol={enVol} quoi={quoiTravaille} />
          </div>

          {/* ── Les réglages, hors de l'image ───────────────────────────── */}
          <aside
            data-reglages-de-la-table
            aria-label={`Les réglages de ${NOM_DE_LA_TABLE[ouverte]}`}
            className="col-start-2 row-start-2 row-span-2 flex min-h-0 flex-col gap-[14px] overflow-hidden rounded-8 border border-trait bg-carte p-[14px]"
          >
            <h2 className="font-serif text-[25px] text-encre">Le résultat</h2>
            {/* **Trois onglets, comme l'animation** (Retouche · Calques ·
                Recettes) : les recettes ont la portée de la recette entière,
                pas d'une table — elles ont leur page plutôt qu'un menu posé
                au bout du bandeau. */}
            <div className="flex gap-[4px] rounded-7 bg-papier-cote p-[4px]">{(["retouche", "calques", "recettes"] as const).map((nom) => <button key={nom} type="button" aria-pressed={panneau === nom} onClick={() => { setPanneau(nom); if (nom === "calques") setOuverte("main") }} className={`h-[30px] flex-1 rounded-7 px-[8px] text-[12px] ${panneau === nom ? "bg-carte text-encre" : "text-encre-3"}`}>{{ retouche: "Retouche", calques: "Calques", recettes: "Recettes" }[nom]}</button>)}</div>
            <AvisBrouillon brouillon={brouillon} />
            {aAppliquer && <button type="button" onClick={async () => {
              try { await api.poserRecette(asset.identifiant, recette); brouillon.effacer(); setAAppliquer(false) }
              catch (e) { onErreur((e as Error).message) }
            }} className="h-[34px] shrink-0 rounded-7 border border-signal px-[14px] text-[12px]">Appliquer les réglages repris à l’image</button>}
            {panneau === "retouche" && <SelecteurDeTable table={ouverte} onTable={setOuverte} />}
            {panneau === "retouche" && barreDesTables}
            {/* **Pas de second titre** : le sélecteur dit déjà la table, et un
                titre de 25 px heurtait les boutons dans la colonne étroite.
                La remise à zéro et l'interrupteur ont leur propre rangée,
                comme dans l'animation, puis l'état en petit. */}
            {panneau !== "recettes" && (
              <div className="flex shrink-0 flex-col gap-[8px]">
                {/* **Une place s'éteint sans se vider, et se vide sans
                    s'éteindre** (RP22) : les deux gestes ne paraissent que là
                    où il y a une place à éteindre ou à vider — les deux
                    fabriques n'en ont pas. */}
                {place !== null && raison === null && (
                  <div className="flex shrink-0 items-center gap-[8px]">
                    <RemettreAZero onClick={() => void poser(videe(recette, ouverte))} />
                    <Interrupteur
                      endormie={endormie}
                      onBasculer={() => void poser(avecVeille(recette, ouverte, !endormie))}
                    />
                  </div>
                )}
                <span className="mesure text-[10.5px] text-encre-4">
                  {panneau === "calques" ? "Calques de l’image · " : ""}
                  {CE_QUE_L_ETAT_DIT[etatDe(ouverte, recette, traitement, mesures)]}
                  {resume ? ` · ${resume}` : ""}
                </span>
              </div>
            )}
            {/* **Les gestes qui écrivent d'autres images, au pied du
                panneau**, là où l'animation met « Découper cette frame ». */}
            <div className="order-last flex shrink-0 flex-wrap gap-[8px] border-t border-trait pt-[14px] text-[12px]">
              <button type="button" onClick={() => sortir(() => { setPanneau("retouche"); setOuverte("decoupage") })} className="rounded-7 border border-trait px-[8px] py-[4px]">Découper une image</button>
              <button type="button" onClick={() => sortir(() => { setPanneau("retouche"); setOuverte("superposition") })} className="rounded-7 border border-trait px-[8px] py-[4px]">Extraire un élément</button>
              {onAssocierEquipement && <button type="button" onClick={() => sortir(onAssocierEquipement)} className="rounded-7 border border-trait px-[8px] py-[4px]">Utiliser comme équipement…</button>}
              {onPoserSurLaToile && <button type="button" onClick={() => sortir(onPoserSurLaToile)} className="rounded-7 border border-trait px-[8px] py-[4px]">Poser sur la toile</button>}
            </div>
            {panneau === "recettes" ? (
            <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto">
              <PanneauDesRecettes
                recette={recette}
                nommees={recettes.nommees}
                annonce={enregistrementImmediat ? recettes.annonce : session.annonce}
                aCopier={recettes.aCopier}
                onLister={recettes.onLister}
                onCopier={recettes.onCopier}
                onColler={recettes.onColler}
                onEnregistrer={recettes.onEnregistrer}
                onAppliquer={recettes.onAppliquer}
                onOublier={recettes.onOublier}
              />
            </div>
            ) : (
            <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto">
            {(panneau === "calques" || (ouverte === "main" && raison === null && !endormie)) && (
              <button type="button" data-ouvrir-l-editeur onClick={() => setEditeur(true)} className="h-[34px] shrink-0 rounded-7 border border-trait bg-carte px-[14px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre">Éditer les pixels…</button>
            )}
            {panneau === "calques" ? <ReglagesDeLaMain {...poste} section="calques" /> : raison !== null ? (
              /* **Une table indisponible s'ouvre quand même**, et son panneau
                 porte la raison à la place de ses réglages. C'est la règle de
                 T1 déplacée, pas retirée : une pastille n'a pas la place d'une
                 phrase. */
              <Pourquoi texte={raison} />
            ) : endormie ? (
              <Pourquoi texte="endormie : ses réglages sont gardés et se retrouvent tels quels au réveil" />
            ) : ouverte === "detourage" ? (
              <ReglagesDuDetourage
                {...poste}
                asset={asset}
                onErreur={onErreur}
                onUnivers={onUnivers}
              />
            ) : ouverte === "recadrage" ? (
              <ReglagesDuRecadrage {...poste} />
            ) : ouverte === "grille" ? (
              <ReglagesDeLaGrille {...poste} />
            ) : ouverte === "quantification" ? (
              <ReglagesDesCouleurs {...poste} asset={asset} />
            ) : ouverte === "bords" ? (
              <ReglagesDuNettoyage {...poste} />
            ) : ouverte === "contours" ? (
              <ReglagesDuContour {...poste} />
            ) : ouverte === "retournement" ? (
              <ReglagesDuRetournement {...poste} />
            ) : ouverte === "main" ? (
              <ReglagesDeLaMain {...poste} section="peinture" />
            ) : null}

            <div className="mt-auto flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <button
                type="button"
                onClick={() => void revenirAuBrut()}
                className="h-[30px] rounded-7 border border-trait bg-carte text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                Tout remettre à zéro
              </button>
              {/* ⚠️ **On n'annule pas un calcul ; on annule un réglage**
                  (B16). Rien n'interrompt un calcul en route : la route est
                  synchrone, le calcul a lieu dans le gestionnaire de requête,
                  et couper la connexion n'arrêterait pas la machine. Le dire
                  vaut mieux qu'un bouton qui aurait l'air de le faire. */}
            </div>
            </div>
            )}
          </aside>

          {/* ── Ses sœurs (`B24`, déménagé de `Tables.tsx`) ────────────────
              **On passe à la sœur suivante sans que la table ouverte se
              referme** : c'est le geste qui distingue une table d'un
              panneau, et la barre se rafraîchit d'elle-même sur `asset`. */}
          <aside
            data-ses-soeurs
            aria-label="Ses sœurs"
            className="col-start-1 row-start-3 flex min-w-0 flex-col gap-[8px] rounded-8 border-t border-trait pt-[8px]"
          >
            <Etiquette>ses sœurs</Etiquette>
            <div className="defile flex gap-[8px] overflow-x-auto">
              {soeurs.map((soeur) => (
                <SoeurDuCarnet
                  key={soeur.identifiant}
                  asset={soeur}
                  courante={soeur.identifiant === asset.identifiant}
                  onChoisir={() => sortir(() => onSoeur(soeur.identifiant))}
                />
              ))}
              {soeurs.length === 0 && (
                <p className="text-[10.5px] text-encre-4">cette image n'a pas de voisine</p>
              )}
            </div>
          </aside>
        </>
        )}
      </div>
      {enregistrerSous && <EnregistrerSous quoi="image" identifiant={originale.identifiant} recette={recette} onFermer={() => setEnregistrerSous(false)} />}
      {editeur && <EditeurDePixels
        titre={asset.label}
        planche={imageVisible()}
        rang={0}
        large={asset.rendu_largeur || asset.largeur}
        haut={asset.rendu_hauteur || asset.hauteur}
        attente={null}
        palette={univers.palette}
        couleurDepart={etatMain.couleur}
        onValider={(coups) => { setEditeur(false); void poser({ ...recette, main: mainAvecLesCoups(mainDe(recette), etatMain.actif, coups) }) }}
        onFermer={() => setEditeur(false)}
      />}
      {sortie && <CadreDialogue titre="Quitter les retouches" format="preparation" onFermer={() => setSortie(null)} enfants={<section className="w-full max-w-[880px] rounded-8 border border-trait bg-papier p-[22px]"><h2 className="font-serif text-[25px]">Des retouches attendent</h2><p className="mt-[14px] text-[13px]">La version enregistrée reste intacte. Garde le brouillon pour plus tard, ou enregistrez les retouches avant de continuer. La découpe, l’extraction, l’équipement et la pose sur la toile utilisent la version enregistrée.</p><div className="mt-[22px] flex flex-wrap gap-[8px]"><button type="button" onClick={() => setSortie(null)} className="h-[34px] rounded-7 border border-trait bg-carte px-[14px] text-[12px]">Continuer à retoucher</button><button type="button" onClick={() => { const action = sortie; setSortie(null); action() }} className="h-[34px] rounded-7 border border-trait bg-carte px-[14px] text-[12px]">Garder le brouillon et continuer</button><button type="button" onClick={() => { const action = sortie; session.abandonner(); setSortie(null); action() }} className="h-[34px] rounded-7 border border-trait bg-carte px-[14px] text-[12px]">Abandonner les retouches</button><button type="button" disabled={!session.valide || !!enVol || session.enregistre} onClick={async () => { if (await session.enregistrer()) { const action = sortie; setSortie(null); action() } }} className="h-[34px] rounded-7 border border-signal bg-carte px-[14px] text-[12px] text-signal disabled:opacity-50">Enregistrer et continuer</button></div></section>} />}
    </main>
  )
}

/** Une sœur, dans sa colonne (`Tables.tsx`, déménagée en `B24`). */
function SoeurDuCarnet({
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
        "overflow-hidden rounded-7 border p-[4px] transition-colors duration-120",
        courante ? "border-encre-4" : "border-transparent hover:border-trait",
      ].join(" ")}
    >
      <img
        src={sujetAsset(asset).src}
        alt={asset.label}
        className="damier-papier h-[54px] w-[54px] object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  )
}

/** Les gestes qui font voyager une recette (U5, déménagé en `B24`).
 *
 *  **Repris de `PanneauDesRecettes` (`Tables.tsx`)**, avec le presse-papiers
 *  qu'il importe plutôt qu'un second : copier ici, coller là doit rester le
 *  même geste tant que les deux écrans coexistent. Seul l'habillage change. */
function PanneauDesRecettes({
  recette,
  nommees,
  onLister,
  onCopier,
  onColler,
  onEnregistrer,
  onAppliquer,
  onOublier,
  aCopier,
  annonce,
}: {
  recette: Recette
  nommees: string[]
  onLister: () => void
  onCopier: () => void
  onColler: () => void
  onEnregistrer: (nom: string) => void
  onAppliquer: (nom: string) => void
  onOublier: (nom: string) => void
  /** Y a-t-il quelque chose dans le presse-papiers ? */
  aCopier: boolean
  /** Ce que le serveur a laissé au dernier voyage, ou ce qui vient d'être
   *  fait. **Rendue par le serveur, jamais recalculée ici** : la règle du
   *  voyage vit d'un seul côté. */
  annonce: string[] | null
}) {
  const [nom, setNom] = useState("")
  const [aRemplacer, setARemplacer] = useState<string | null>(null)
  const propre = nom.trim()
  const dejaPris = nommees.includes(propre)

  // **Un onglet ne se ferme pas à l'Échap** : depuis que les recettes vivent
  // dans le panneau, il n'y a plus de menu flottant à refermer.

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onLister(), [])

  const enregistrer = () => {
    if (!propre) return
    // **Un nom déjà pris propose de remplacer, et ne remplace jamais en
    // silence.**
    if (dejaPris && aRemplacer !== propre) return setARemplacer(propre)
    setARemplacer(null)
    onEnregistrer(propre)
  }

  return (
    <div
      data-recettes
      className="text-left"
    >
      {/* ── La séance ──────────────────────────────────────────────────── */}
      <p className="mb-[8px] text-[11px] text-encre-4">
        Les réglages de cette image, ailleurs
      </p>
      <div className="mb-[14px] flex gap-[8px]">
        <button
          type="button"
          onClick={onCopier}
          className="h-[26px] flex-1 rounded-7 border border-trait text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
        >
          Copier les réglages
        </button>
        <button
          type="button"
          onClick={onColler}
          disabled={!aCopier}
          className="h-[26px] flex-1 rounded-7 border border-trait text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint disabled:hover:border-trait disabled:hover:text-eteint"
        >
          Coller
        </button>
      </div>
      {!aCopier && (
        <Pourquoi texte="rien de copié pour l'instant — copie d'abord les réglages d'une image." />
      )}

      {/* ── Ce qui survit à la séance ──────────────────────────────────── */}
      <p className="mb-[8px] mt-[14px] border-t border-trait-faible pt-[14px] text-[11px] text-encre-4">
        Les recettes nommées
      </p>
      <div className="mb-[8px] flex gap-[8px]">
        <input
          value={nom}
          onChange={(evenement) => {
            setNom(evenement.target.value)
            setARemplacer(null)
          }}
          onKeyDown={(evenement) => evenement.key === "Enter" && enregistrer()}
          placeholder="un nom pour ces réglages"
          aria-label="le nom de la recette"
          className="h-[26px] min-w-0 flex-1 rounded-7 border border-trait bg-papier px-[8px] text-[12px] text-encre placeholder:text-eteint"
        />
        <button
          type="button"
          onClick={enregistrer}
          disabled={!propre}
          className="h-[26px] shrink-0 rounded-7 border border-trait px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
        >
          {aRemplacer === propre ? "Remplacer ›" : "Enregistrer"}
        </button>
      </div>
      {aRemplacer === propre && (
        <Pourquoi
          texte={`« ${propre} » existe déjà — reclique pour la remplacer par les réglages de cette image.`}
        />
      )}

      {nommees.length === 0 ? (
        <p className="text-[12px] text-encre-4">aucune recette nommée pour l'instant.</p>
      ) : (
        <ul className="flex max-h-[30vh] flex-col overflow-y-auto">
          {nommees.map((enregistree) => (
            <li
              key={enregistree}
              className="flex items-center gap-[8px] border-t border-trait-faible py-[4px] first:border-t-0"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-encre-2">
                {enregistree}
              </span>
              <button
                type="button"
                onClick={() => onAppliquer(enregistree)}
                className="shrink-0 text-[11px] text-encre-3 transition-colors duration-120 hover:text-encre"
              >
                appliquer
              </button>
              <button
                type="button"
                onClick={() => onOublier(enregistree)}
                aria-label={`oublier « ${enregistree} »`}
                className="shrink-0 text-[11px] text-encre-3 transition-colors duration-120 hover:text-echec"
              >
                oublier
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* **Ce qui n'a pas voyagé se dit là où le geste a eu lieu**, et reste
          jusqu'au geste suivant. */}
      {annonce !== null && (
        <div
          data-recettes-annonce
          role="status"
          className="mt-[14px] border-t border-trait-faible pt-[14px] text-[11px] leading-[1.5] text-encre-2"
        >
          {annonce.length === 0 ? (
            <span>c'est posé — tous les réglages ont voyagé.</span>
          ) : (
            <>
              <span className="text-epingle">
                posé, sauf ce qui désignait un endroit de l'autre image :
              </span>
              <ul className="mt-[4px] flex flex-col gap-[2px] text-encre-4">
                {annonce.map((phrase) => (
                  <li key={phrase}>· {phrase}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* La recette courante en un mot. */}
      <p className="mt-[14px] border-t border-trait-faible pt-[8px] text-[11px] text-encre-4">
        {TABLES.filter((t) => valeur(t.cle, recette) !== null)
          .map((t) => NOM_DE_LA_TABLE[t.cle])
          .join(" · ") || "cette image n'a aucun réglage posé"}
      </p>
    </div>
  )
}

/** Le résumé de la recette entière, en une ligne — **la valeur, jamais le fait
 *  qu'il y en ait une**. Réemployé tel quel de la barre de l'ancien châssis. */
export function resumeDeLaChaine(recette: Recette): string {
  return TABLES.filter((t) => !t.fabrique)
    .map((t) => {
      const v = valeur(t.cle, recette)
      return v === null ? null : `${NOM_DE_LA_TABLE[t.cle].toLowerCase()} ${v}`
    })
    .filter(Boolean)
    .join(" · ")
}

export { NOM_DE_LA_TABLE, CE_QUE_LA_TABLE_FAIT, etatDe, RESUME }
