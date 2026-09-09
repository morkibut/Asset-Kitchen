/**
 * La retouche — B16. **La chaîne entière, rangée dans la grammaire du carnet.**
 *
 * `docs/pistes-2026-09-04/carnet/Retouche.dc.html` et les dix
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
 * **Ce qu'il ne prend pas, et pourquoi.** Les trois gestes qui désignent un
 * endroit de *cette* image-là — le point de la pipette, la forme entourée, le
 * pinceau — restent où ils sont. Ils ont besoin de la surface de l'image, leurs
 * moteurs se réécrivent en `B17`, et ce sont exactement les valeurs dont
 * l'invariant du lot U dit qu'elles **ne voyagent pas**. L'écran les montre
 * comme posées ou non, et il le dit.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
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
  type Methode,
  type Nature,
  type Passe,
  type Quantification,
  type Recadrage,
  type Recette,
  type TachesDeLAsset,
  type Univers,
} from "../api"
import { imageAsset, sujetAsset, useVisee } from "./Apercu"
// **Deux fonctions pures, et rien d'autre de `chassis.tsx`.** Aucun fichier du
// carnet n'importe ce module — il porte le balisage de l'ancien châssis, et ses
// couleurs ne sont pas celles du papier. Ces deux-là n'ont ni balise ni jeton :
// c'est la courbe de la jauge et le battement qui la nourrit. Les réécrire
// aurait fabriqué **deux vérités sur la même attente**, et c'est précisément la
// panne que cette tranche répare ailleurs.
import { part, useEcoule } from "./chassis"
import {
  CIBLES,
  CURSEURS,
  DURCISSEMENT_LIVRE,
  FINESSES,
  MOTEUR,
  PAIRE_VIDE,
  RESUME,
  SENS_DU_RETOURNEMENT,
  SENS_LIVRES,
  TOLERANCE_D_UNE_PAIRE_MAX,
  TROUS,
  debord,
  defautGrille,
  quantificationDe,
  useMesures,
  useRecette,
} from "./Places"
import { EcranSuperposition } from "./Superposition"
import {
  ARRETS_ZOOM,
  TABLES,
  ZOOM_MAX,
  ZOOM_MIN,
  avecVeille,
  borner,
  copierDansLePressePapier,
  defautDeLaPasse,
  dort,
  indisponible,
  lireLePressePapier,
  placeDe,
  valeur,
  type Table,
  type ZoomTable,
} from "./Tables"

// ── Le vocabulaire des planches ─────────────────────────────────────────────

/** **Les noms que l'auteur lit, en face des clés que le domaine écrit.**
 *
 *  Les planches et le code ne nomment pas les mêmes choses : `Pixéliser` est
 *  `grille`, `Couleurs` est `quantification`, `Nettoyer` est `bords`, et
 *  `Superposer` est `superposition`. C'est le vocabulaire des planches qui
 *  gagne à l'écran — *le sujet entre dans la case du jeu* se comprend, *la
 *  grille* ne se comprend qu'après avoir lu le code.
 *
 *  ⚠️ **La clé, elle, ne bouge pas** : c'est celle de la recette, et la
 *  renommer changerait l'empreinte de tout ce qui est déjà écrit. */
const NOM_DE_LA_TABLE: Record<Table, string> = {
  detourage: "Détourer",
  recadrage: "Recadrer",
  grille: "Pixéliser",
  quantification: "Couleurs",
  bords: "Nettoyer",
  contours: "Le contour",
  retournement: "Retourner",
  main: "La main",
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

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

/** **La raison d'un grisé, et le geste qui le rallume.**
 *
 *  Règle 2 de `docs/DESIGN.md` : *un bouton éteint dit à côté de lui pourquoi
 *  il l'est, et donne le geste qui le rallume. Jamais une infobulle.* Le geste
 *  est un vrai bouton quand il mène quelque part — la marge du recadrage
 *  renvoie vers *Pixéliser*, où la hauteur fait ce qu'on croyait lui demander. */
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
  children,
}: {
  nom: string
  /** Ce que la commande ne dit pas elle-même. Un curseur et un choix portent
   *  déjà leur valeur : ils ne passent rien ici. */
  dit?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <span className="text-[12.5px] text-encre-2">{nom}</span>
        {dit && <span className="mesure text-[10.5px] text-encre-4">{dit}</span>}
      </div>
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
  valeur: T
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
 *  évite de payer une file d'attente par cran. */
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
  return (
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
        className={`curseur h-[22px] min-w-0 flex-1 ${eteint ? "opacity-40" : ""}`}
      />
      <span
        className={`mesure w-[34px] shrink-0 text-right text-[11.5px] ${eteint ? "text-eteint" : "text-encre-2"}`}
      >
        {valeur}
        {unite}
      </span>
    </div>
  )
}

/** L'interrupteur de la veille. **Éteindre n'est pas vider** (invariant du lot
 *  U) : les réglages restent écrits et se retrouvent tels quels au réveil. */
function Interrupteur({
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

// ── La colonne de droite, table par table ───────────────────────────────────

type Poste = {
  recette: Recette
  univers: Univers
  traitement: EtatTraitement
  mesures: TachesDeLAsset | null
  regler: (r: Recette) => void
  poser: (r: Recette) => void
  ouvrir: (table: Table) => void
}

function ReglagesDuDetourage({
  recette,
  univers,
  traitement,
  poser,
  regler,
  asset,
  onErreur,
  onUnivers,
}: Poste & {
  asset: Asset
  onErreur: (raison: string) => void
  /** **Le dossier du jeu vient de changer** (M7) — promouvoir un détourage en
   *  défaut du projet l'écrit, et l'atelier doit en tenir compte sans
   *  recharger. Absent, le geste se fait quand même : c'est l'écran d'à côté
   *  qui montrerait l'ancien réglage jusqu'au prochain aller-retour. */
  onUnivers?: (univers: Univers) => void
}) {
  const passes = recette.passes
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

  const changer = (rang: number, suite: Partial<Passe>) =>
    passes.map((p, i) => (i === rang ? { ...p, ...suite } : p))

  return (
    <div className="flex flex-col gap-[14px]">
      {passes.length === 0 && (
        <p className="text-[12.5px] text-encre-3">
          Aucune passe. Le fond est encore là.
        </p>
      )}

      {passes.map((passe, rang) => (
        <div key={rang} className="flex flex-col gap-[8px] border-t border-trait-faible pt-[8px]">
          <div className="flex items-baseline justify-between gap-[8px]">
            <Etiquette>passe {rang + 1}</Etiquette>
            <button
              type="button"
              onClick={() =>
                void poser({ ...recette, passes: passes.filter((_, i) => i !== rang) })
              }
              className="text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre"
            >
              La retirer
            </button>
          </div>

          <Reglage nom="moteur">
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

          {(passe.moteur === "bord" || passe.moteur === "couleur" || passe.moteur === "trace") && (
            <Reglage nom="tolérance">
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

          <Reglage nom="bord rongé">
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
            <Reglage nom="comparaison">
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
            <Reglage nom="couleur visée">
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
            <Reglage nom="portée">
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

          {/* **Ce qui ne voyage pas se montre, et ne se règle pas ici.** Un
              point de pipette et une forme entourée désignent un endroit de
              *cette* image-là ; ils ont besoin de sa surface, et l'invariant du
              lot U dit qu'ils ne partent ni par un collage ni par une recette
              nommée. */}
          {(passe.moteur === "couleur" || passe.moteur === "trace") && (
            <Pourquoi
              texte={
                passe.moteur === "couleur"
                  ? passe.point
                    ? `un point est visé sur cette image · ${passe.point[0]}, ${passe.point[1]} — il se déplace sur l'image, et il ne voyage pas`
                    : "aucun point visé — la pipette se pointe sur l'image, et ce point ne voyage pas"
                  : passe.trace.length > 0
                    ? `une forme est entourée sur cette image · ${passe.trace.length} points — elle se trace sur l'image, et elle ne voyage pas`
                    : "aucune forme entourée — la sélection se trace sur l'image, et elle ne voyage pas"
              }
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => void poser({ ...recette, passes: [...passes, PASSE_PAR_DEFAUT] })}
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        Une passe de plus
      </button>

      {/* **La couleur du fond se devine par défaut, et se vise depuis B18.**
          Le jeu la déclare dans ses règles, elle part dans le prompt — et
          `atelier/domaine/fond.py` reste hors de la recette et du traitement
          (B16) : c'est le réglage « couleur visée » de chaque passe `bord`,
          ci-dessus, qui copie la couleur déclarée au lieu de la relire en
          direct. Sans lui, le détourage reprend la médiane des bordures,
          qu'un sujet débordant sur un bord fait basculer. */}
      <Pourquoi texte="chaque passe « bord » devine sur les bordures, sauf si elle vise la couleur déclarée du jeu — réglage « couleur visée » ci-dessus" />

      <PromotionDuDetourage
        asset={asset}
        recette={recette}
        univers={univers}
        onUnivers={onUnivers}
        onErreur={onErreur}
      />
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
          enregistrer ce réglage comme défaut du projet ›
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
      <Etiquette>en faire un défaut du projet</Etiquette>
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
 *  écrans qui n'en ont pas besoin (`PanneauRecadrage`, l'écran de montage). */
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

function ReglagesDuRecadrage({ recette, mesures, regler, poser, ouvrir }: Poste) {
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
          eteints={
            recadrage.boite
              ? {}
              : { tracee: "on trace le rectangle sur l'image, pas depuis cette colonne" }
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
          geste="Pixéliser"
          onGeste={() => ouvrir("grille")}
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

function ReglagesDeLaGrille({ recette, univers, traitement, regler, poser }: Poste) {
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

      <Reglage nom="ancrage">
        <Choix
          valeurs={Object.keys(NOM_DE_L_ANCRAGE) as Ancrage[]}
          valeur={grille.ancrage}
          libelles={NOM_DE_L_ANCRAGE}
          onChange={(ancrage) => changer({ ancrage })}
        />
      </Reglage>

      <Reglage nom="façon de réduire">
        <Choix
          valeurs={traitement.reductions.map((r) => r.nom)}
          valeur={grille.methode}
          libelles={NOM_DE_LA_METHODE}
          eteints={grisees}
          onChange={(methode) => changer({ methode })}
        />
      </Reglage>

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

function ReglagesDesCouleurs({
  recette,
  univers,
  traitement,
  mesures,
  regler,
  poser,
}: Poste) {
  const valeurs = quantificationDe(recette, univers)
  const paliers = paliersDeCouleurs(recette.grille?.cible ?? 64)

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

  return (
    <div className="flex flex-col gap-[14px]">
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
        palette={univers.palette}
        eteint={valeurs.palette.length > 0}
        onChange={(gardees) => void poser(avec({ gardees }))}
      />

      {/* ── L'échange de couleurs, après la réduction (B17) ────────────────
          Posé avant, il serait défait par la réduction, qui renverrait la
          couleur écrite au plus proche de la palette. */}
      <TableDEchange
        echanges={valeurs.echanges ?? []}
        palette={univers.palette}
        onChange={(echanges) => void poser(avec({ echanges }))}
      />
    </div>
  )
}

/** La raison écrite à côté du grisé, quand la palette du jeu est posée.
 *  **Écrite une fois** : trois grisés qui la recopieraient finiraient par ne
 *  plus dire la même chose. */
const SOUS_LA_PALETTE = "la palette du jeu décide seule des couleurs"

/** Les couleurs qu'aucune fusion n'emporte (`B18`).
 *
 *  **Le même geste que la table d'échange, en plus court** : une pastille, une
 *  couleur, et rien d'autre. Elle se pique sur la palette du jeu quand il y en
 *  a une, et se tape à la main sinon — la pipette sur l'image appartient à la
 *  surface à coordonnées, que cette table ne porte pas.
 *
 *  ⚠️ **La planche la veut à la pipette sur l'image** ; ce qui est livré ici est
 *  le choix parmi les couleurs connues. Le geste de pipette vit dans la
 *  surface à coordonnées de l'ancien écran, que `B16` a laissée en place et que
 *  cette table ne double pas. */
function CouleursGardees({
  gardees,
  palette,
  eteint,
  onChange,
}: {
  gardees: string[]
  palette: string[]
  eteint: boolean
  onChange: (gardees: string[]) => void
}) {
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

      {eteint ? (
        <Pourquoi texte={SOUS_LA_PALETTE} />
      ) : gardees.length >= GARDEES_MAX ? (
        <Pourquoi
          texte={`${GARDEES_MAX} couleurs gardées au plus — au-delà il ne reste rien à choisir`}
        />
      ) : palette.length > 0 ? (
        <div className="flex flex-wrap gap-[6px]">
          {palette
            .filter((c) => !gardees.includes(c))
            .map((couleur) => (
              <button
                key={couleur}
                type="button"
                aria-label={`garder ${couleur}`}
                className="h-[14px] w-[14px] rounded-5 border border-trait-faible opacity-60 hover:opacity-100"
                style={{ background: couleur }}
                onClick={() => onChange([...gardees, couleur])}
              />
            ))}
        </div>
      ) : (
        <Pourquoi texte="le jeu n'a pas encore de palette où piquer une couleur" />
      )}
    </div>
  )
}

/** La table de correspondance — *cette couleur-ci devient celle-là*, après la
 *  réduction. Le même geste que `Places.tsx` § `PanneauQuantification`, dans
 *  le vocabulaire de cet écran : une paire en train de se faire reste ici, à
 *  l'écran, et ne rejoint la recette qu'une fois ses deux couleurs nommées —
 *  sans quoi le seul geste qui ouvre la table est aussi celui que le serveur
 *  refuse (*une paire nomme deux couleurs*), trouvé au navigateur. */
function TableDEchange({
  echanges,
  palette,
  onChange,
}: {
  echanges: Echange[]
  palette: string[]
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
              palette={palette}
              onChange={(depuis) =>
                encours ? changerLeBrouillon({ depuis }) : changer(rang, { depuis })
              }
            />
          </Reglage>
          <Reglage nom="celle qui vient">
            <ChoixDeCouleur
              couleur={echange.vers}
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
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-encre-4 disabled:hover:border-trait"
      >
        Échanger une couleur
      </button>
    </div>
  )
}

/** Une couleur, choisie par pipette de palette ou entrée en clair — la même
 *  règle que `Places.tsx` (US-210) : *proposée, jamais imposée*. Rien ici ne
 *  désigne un endroit de cette image-là, donc rien n'appartient au pinceau. */
function ChoixDeCouleur({
  couleur,
  palette,
  onChange,
}: {
  couleur: string
  palette: string[]
  onChange: (couleur: string) => void
}) {
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
      </div>
      {palette.length > 0 && (
        <div className="flex flex-wrap gap-[4px]">
          {palette.map((c) => (
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
          ))}
        </div>
      )}
    </div>
  )
}

function ReglagesDuNettoyage({ recette, mesures, regler, poser }: Poste) {
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

function ReglagesDuContour({ recette, univers, mesures, regler, poser }: Poste) {
  const contour: Contour = recette.contours ?? CONTOUR_PAR_DEFAUT
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

      {univers.palette.length > 0 && (
        <Reglage nom="couleur">
          <div className="flex flex-wrap gap-[4px]">
            {univers.palette.slice(0, 12).map((couleur) => (
              <button
                key={couleur}
                type="button"
                aria-label={couleur}
                aria-pressed={contour.couleur === couleur}
                onClick={() => changer({ couleur })}
                style={{ background: couleur }}
                className={`h-[22px] w-[22px] rounded-5 border transition-colors duration-120 ${
                  contour.couleur === couleur ? "border-encre" : "border-trait"
                }`}
              />
            ))}
          </div>
        </Reglage>
      )}

      {/* **Le seul réglage de la chaîne qui change la taille du rendu**, et il
          l'écrit au moment où on choisit — pas après. */}
      {croissance > 0 && cible !== null && (
        <Pourquoi
          texte={`la case du jeu fait ${cible} px, le fichier qui sort en fera ${cible + croissance}`}
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
        <label className="flex items-start gap-[8px] text-[12.5px] text-encre-2">
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

        <label className="flex items-start gap-[8px] text-[12.5px] text-encre-2">
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

        <label className="flex items-start gap-[8px] text-[12.5px] text-encre-2">
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

        <label className="flex items-start gap-[8px] text-[12.5px] text-encre-2">
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

        <label className="flex items-start gap-[8px] text-[12.5px] text-encre-2">
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

function ReglagesDuRetournement({ recette, poser }: Poste) {
  const retournement = recette.retournement ?? RETOURNEMENT_PAR_DEFAUT
  return (
    <div className="flex flex-col gap-[14px]">
      {/* **Les dix sens depuis `B18`** — le détail de l'angle, du repli et des
          zones protégées se règle sur la table elle-même (`Places.tsx`) : cet
          écran range et nomme, il ne porte pas le réglage fin d'un moteur. */}
      <Reglage nom="sens">
        <Choix
          valeurs={SENS_LIVRES}
          valeur={retournement.sens}
          libelles={SENS_DU_RETOURNEMENT}
          onChange={(sens) => void poser({ ...recette, retournement: { ...retournement, sens } })}
        />
      </Reglage>
    </div>
  )
}

function ReglagesDeLaMain({ recette, mesures, poser }: Poste) {
  const main = recette.main ?? MAIN_VIDE
  const pose = mesures?.main ?? null
  return (
    <div className="flex flex-col gap-[14px]">
      {main.calques.length === 0 && main.opacite.length === 0 && (
        <p className="text-[12.5px] text-encre-3">Aucun passage. Rien n'a été repeint.</p>
      )}
      {main.calques.map((calque, rang) => (
        <div
          key={rang}
          className="flex items-baseline justify-between gap-[8px] border-t border-trait-faible pt-[8px]"
        >
          <span className="text-[12.5px] text-encre-2">
            {calque.nom || `calque ${rang + 1}`}
          </span>
          <span className="mesure text-[10.5px] text-encre-4">
            {calque.passages.length} passages
            {pose && pose.calques[rang] !== undefined ? ` · ${pose.calques[rang]} px` : ""}
          </span>
        </div>
      ))}
      {main.opacite.length > 0 && (
        <p className="mesure text-[10.5px] text-encre-4">
          {main.opacite.length} passages sur l'opacité
          {pose ? ` · ${pose.opacite} px touchés` : ""}
        </p>
      )}
      <button
        type="button"
        onClick={() => void poser({ ...recette, main: MAIN_VIDE })}
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        Tout effacer
      </button>
      {/* **Le pinceau est une coordonnée**, comme le point de la pipette et la
          forme entourée : il se pose sur l'image, il ne voyage pas, et il ne se
          règle pas depuis une colonne. */}
      <Pourquoi texte="on repeint sur l'image elle-même — un passage de la main ne voyage pas" />
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

export function Retouche({
  asset,
  soeurs,
  univers,
  traitement,
  onFermer,
  onSoeur,
  decoupe,
  onErreur,
  onUnivers,
}: {
  asset: Asset
  /** Les images voisines — les attitudes de la chose (`B24`, déménagé de
   *  `Tables.tsx`). **On passe à l'image voisine sans que la table ouverte se
   *  referme** : c'est le geste qui distingue une table d'un panneau. */
  soeurs: Asset[]
  univers: Univers
  traitement: EtatTraitement
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
  const { recette, setRecette, regler, poser, revenirAuBrut, enVol } = useRecette(
    asset,
    onErreur,
  )
  const mesures = useMesures(asset)
  const [ouverte, setOuverte] = useState<Table>("detourage")
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

  const [zoom, setZoom] = useState<ZoomTable>("ajuste")
  // Changer d'image rouvre en ajusté, pour la même raison que la table.
  useEffect(() => setZoom("ajuste"), [asset.identifiant])

  // **Le damier cède la place au fond choisi**, et seulement sur la table du
  // contour — c'est elle qui pose la question, les sept autres n'en ont pas
  // besoin. Le damier peint son propre fond derrière l'image ; il faut donc
  // l'ôter, sans quoi la couleur posée sur le cadre ne se verrait jamais.
  const montreUnFond = ouverte === "contours" && FONDS_APERCU[fondApercu] !== null

  /** Ce qu'on regarde vraiment. **Le rendu peut faire 64 px là où l'origine
   *  en fait 1 024** : le pour cent ajusté se calcule sur celle des deux
   *  qu'on travaille, jamais sur l'autre. */
  const largeurVue = (travail === "brut" ? asset.largeur : asset.rendu_largeur || asset.largeur) || 1
  const hauteurVue = (travail === "brut" ? asset.hauteur : asset.rendu_hauteur || asset.hauteur) || 1

  /** **Le pour cent qui fait tenir l'image entière dans le cadre.** Il
   *  descend sous cent, et il ne s'arrondit à aucun multiple : la règle des
   *  multiples entiers appartient à ce qui *montre* une image, pas à ce qui
   *  la travaille. Deux images côte à côte se partagent la place, donc le
   *  témoin « à côté » compte double. */
  const ajuste = borner(
    Math.min(
      dispo.largeur > 0
        ? dispo.largeur / (largeurVue * (temoin === "cote" ? 2 : 1))
        : 1,
      dispo.hauteur > 0 ? dispo.hauteur / hauteurVue : 1,
    ) * 100 || 100,
  )
  const facteur = (zoom === "ajuste" ? ajuste : zoom) / 100

  const poste: Poste = {
    recette,
    univers,
    traitement,
    mesures,
    regler,
    poser,
    ouvrir: setOuverte,
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
  // **Le presse-papiers vit hors de React**, dans `Tables.tsx` — importé ici,
  // pas recréé : copier dans un écran et coller dans l'autre doit rester un
  // seul geste tant que les deux coexistent (`Tables.tsx`, `copiee`).
  const [nommees, setNommees] = useState<string[]>([])
  const [annonceRecette, setAnnonceRecette] = useState<string[] | null>(null)
  const [aCopier, setACopier] = useState(lireLePressePapier() !== null)
  const [recettesOuvertes, setRecettesOuvertes] = useState(false)

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

  return (
    <main
      data-retouche
      aria-label={`La retouche de ${asset.label}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            ‹ Ses images
          </button>
          <span className="min-w-0 truncate text-[12.5px] text-encre-3">{asset.label}</span>

          {/* **Les recettes vivent au bout du bandeau**, comme dans
              `Tables.tsx` : elles ont la portée de la recette entière, pas
              d'une table, et un geste de portée générale ne se cherche pas au
              milieu d'une colonne. */}
          <div className="relative ml-auto shrink-0">
            <button
              type="button"
              aria-expanded={recettesOuvertes}
              onClick={() => setRecettesOuvertes((deja) => !deja)}
              className={[
                "h-[26px] rounded-7 border px-[14px] text-[12.5px] transition-colors duration-120",
                recettesOuvertes
                  ? "border-encre-4 bg-carte text-encre"
                  : "border-trait bg-carte text-encre-2 hover:border-encre-4 hover:text-encre",
              ].join(" ")}
            >
              Recettes ›
            </button>
            {recettesOuvertes && (
              <PanneauDesRecettes
                recette={recette}
                nommees={recettes.nommees}
                annonce={recettes.annonce}
                aCopier={recettes.aCopier}
                onFermer={() => setRecettesOuvertes(false)}
                onLister={recettes.onLister}
                onCopier={recettes.onCopier}
                onColler={recettes.onColler}
                onEnregistrer={recettes.onEnregistrer}
                onAppliquer={recettes.onAppliquer}
                onOublier={recettes.onOublier}
              />
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">La retouche</h1>
            <p className="text-[13px] text-encre-2">
              une suite d'étapes, toujours dans le même ordre — chacune se règle,
              s'endort, et se rejoue sans rien coûter
            </p>
          </div>
          <div className="flex flex-col items-end gap-[4px]">
            <Etiquette>toute la chaîne</Etiquette>
            <span className="font-serif text-[25px] leading-none text-encre-ok">gratuite</span>
            <span className="text-[11px] text-encre-4">
              rien ne sort de la machine, tout marche réseau coupé
            </span>
          </div>
        </div>

        {/* ── La barre : huit tables, un trait, deux fabriques ─────────────
            **L'ordre vient de `TABLES`, et il n'est écrit qu'une fois.** C'est
            celui du domaine ; le lire autrement mentirait sur ce que l'image a
            subi. Aucune table n'est cachée — même indisponible, elle s'ouvre et
            porte sa raison à la place de ses réglages. */}
        <div data-barre-des-tables className="flex flex-wrap items-center gap-[4px]">
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
                  onClick={() => setOuverte(t.cle)}
                  // ⚠️ **Pas d'infobulle ici.** Vu au navigateur : un `title`
                  // sur un bouton devient son nom dans l'arbre
                  // d'accessibilité — la barre s'annonçait « Les bords vides
                  // sautent. » au lieu de « Recadrer ». La phrase est déjà
                  // écrite en clair sous la barre pour la table ouverte ; la
                  // répéter au survol coûtait le nom du bouton.
                  className={[
                    "flex h-[30px] items-center gap-[4px] rounded-7 border px-[8px] text-[12.5px] transition-colors duration-120",
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
        </div>

        {/* **La fabrique prend le cadre entier.** Elle ne pose rien sur
            l'image ouverte : elle en écrit d'autres, et le montrer entre une
            colonne de réglages et une colonne de sœurs mentirait sur ce
            qu'elle fait — la règle de `Tables.tsx` (`B24`). */}
        {ouverte === "decoupage" ? (
          <div className="flex min-h-0 flex-1 overflow-hidden pb-[22px]">
            {decoupe(() => setOuverte("detourage"))}
          </div>
        ) : ouverte === "superposition" ? (
          <div className="flex min-h-0 flex-1 overflow-hidden pb-[22px]">
            <EcranSuperposition
              asset={asset}
              soeurs={soeurs}
              onErreur={onErreur}
              onFabrique={(nees) => nees.length > 0 && onSoeur(nees[0].identifiant)}
            />
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden pb-[22px]">
          {/* ── L'image, et rien par-dessus ─────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <div className="flex flex-wrap items-center justify-between gap-[8px]">
              <span className="min-w-0 truncate text-[12.5px] text-encre-2">
                {CE_QUE_LA_TABLE_FAIT[ouverte]}
              </span>

              <div className="flex flex-wrap items-center gap-[8px]">
                {/* ⚠️ **Un grossissement affiché est un grossissement
                    appliqué.** Vu au navigateur sur un jeu en dessin : l'écran
                    disait ×4 sur une image de 2 048 px que le cadre réduisait
                    en fait à un cinquième. Le pour cent libre descend en
                    dessous de cent au lieu de se rabattre sur une phrase :
                    l'image entière se voit toujours, à un pour cent qui est le
                    pour cent appliqué. */}
                <div data-zoom className="flex items-center gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                  <CommandesDuZoom zoom={zoom} onZoom={setZoom} ajuste={ajuste} />
                </div>

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
            </div>

            <div
              ref={setNoeudCadre}
              data-scene-de-retouche
              style={montreUnFond ? { backgroundColor: FONDS_APERCU[fondApercu] as string } : undefined}
              className="flex min-h-[300px] flex-1 overflow-auto rounded-8 bg-pourtour p-[22px]"
            >
              {/* **`m-auto` sur la boîte, jamais `justify-center` sur le
                  cadre qui défile** (`B24`) : un contenu centré par
                  `justify-center` déborde des deux côtés à la fois et le
                  début — le bord gauche, le haut — devient inatteignable au
                  défilement. C'est très exactement le piège que `Tables.tsx`
                  a réparé pour son propre zoom ; même remède ici. */}
              <div className="m-auto flex shrink-0 items-center gap-[8px]">
                {temoin === "cote" && (
                  <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                    <img
                      src={imageAsset(asset, travail !== "brut")}
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
                      className="damier block max-h-full min-w-0 object-contain"
                    />
                    <figcaption className="mesure text-[10.5px] text-carte">
                      témoin ·{" "}
                      {travail === "brut" ? asset.rendu_largeur || asset.largeur : asset.largeur}×
                      {travail === "brut" ? asset.rendu_hauteur || asset.hauteur : asset.hauteur}
                    </figcaption>
                  </figure>
                )}
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
                      src={imageAsset(asset, travail === "brut")}
                      alt={asset.label}
                      width={Math.max(1, Math.round(largeurVue * facteur))}
                      height={Math.max(1, Math.round(hauteurVue * facteur))}
                      style={{ imageRendering: "pixelated" }}
                      className={[
                        montreUnFond ? "" : "damier",
                        "block h-full w-full object-contain",
                      ].join(" ")}
                    />
                    {/* **Un calque de lecture, et il ne prend pas le pointeur.**
                        Le curseur d'opacité continue de dire ce qu'on voit ; une
                        image posée par-dessus qui intercepterait les clics serait
                        le défaut que `Tables.tsx` a réparé en U2. */}
                    {temoin === "dessus" && (
                      <img
                        src={imageAsset(asset, travail !== "brut")}
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
            className="flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto rounded-8 bg-papier-cote p-[22px]"
          >
            <div className="flex items-start justify-between gap-[8px]">
              <div className="flex flex-col gap-[4px]">
                <h2 className="font-serif text-[25px] leading-none text-encre">
                  {NOM_DE_LA_TABLE[ouverte]}
                </h2>
                <span className="mesure text-[10.5px] text-encre-4">
                  {CE_QUE_L_ETAT_DIT[etatDe(ouverte, recette, traitement, mesures)]}
                  {resume ? ` · ${resume}` : ""}
                </span>
              </div>
              {/* **Une place s'éteint sans se vider** : l'interrupteur ne
                  paraît que là où il y a une place à éteindre — les deux
                  fabriques n'en ont pas. */}
              {place !== null && raison === null && (
                <Interrupteur
                  endormie={endormie}
                  onBasculer={() => void poser(avecVeille(recette, ouverte, !endormie))}
                />
              )}
            </div>

            {raison !== null ? (
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
              <ReglagesDesCouleurs {...poste} />
            ) : ouverte === "bords" ? (
              <ReglagesDuNettoyage {...poste} />
            ) : ouverte === "contours" ? (
              <ReglagesDuContour {...poste} />
            ) : ouverte === "retournement" ? (
              <ReglagesDuRetournement {...poste} />
            ) : ouverte === "main" ? (
              <ReglagesDeLaMain {...poste} />
            ) : null}

            <div className="mt-auto flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <button
                type="button"
                onClick={() => void revenirAuBrut()}
                className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                Revenir au brut
              </button>
              {/* ⚠️ **On n'annule pas un calcul ; on annule un réglage**
                  (B16). Rien n'interrompt un calcul en route : la route est
                  synchrone, le calcul a lieu dans le gestionnaire de requête,
                  et couper la connexion n'arrêterait pas la machine. Le dire
                  vaut mieux qu'un bouton qui aurait l'air de le faire. */}
              <Pourquoi texte="un calcul ne s'interrompt pas — 28 ms pour la chaîne, 1,3 s au pire pour un modèle ; ce qui se défait, c'est le réglage" />
            </div>
          </aside>

          {/* ── Ses sœurs (`B24`, déménagé de `Tables.tsx`) ────────────────
              **On passe à la sœur suivante sans que la table ouverte se
              referme** : c'est le geste qui distingue une table d'un
              panneau, et la barre se rafraîchit d'elle-même sur `asset`. */}
          <aside
            data-ses-soeurs
            aria-label="Ses sœurs"
            className="flex w-[128px] shrink-0 flex-col gap-[8px] overflow-y-auto rounded-8 bg-papier-cote p-[14px]"
          >
            <Etiquette>ses sœurs</Etiquette>
            <div className="flex flex-wrap content-start gap-[6px]">
              {soeurs.map((soeur) => (
                <SoeurDuCarnet
                  key={soeur.identifiant}
                  asset={soeur}
                  courante={soeur.identifiant === asset.identifiant}
                  onChoisir={() => onSoeur(soeur.identifiant)}
                />
              ))}
              {soeurs.length === 0 && (
                <p className="text-[10.5px] text-encre-4">cette image n'a pas de voisine</p>
              )}
            </div>
          </aside>
        </div>
        )}
      </div>
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
        "overflow-hidden rounded-7 border p-[2px] transition-colors duration-120",
        courante ? "border-encre-4" : "border-transparent hover:border-trait",
      ].join(" ")}
    >
      <img
        src={sujetAsset(asset).src}
        alt={asset.label}
        className="damier h-[48px] w-[48px] object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  )
}

/** *moins*, le pour cent, *plus*, et le retour à cent — **repris de
 *  `CommandesDeZoom` (`Tables.tsx`, U2/`B24`)**, seul l'habillage passe au
 *  papier du carnet. Le champ suit le zoom effectif, y compris en `ajusté` :
 *  un champ vide pendant qu'on regarde une image à 59 % laisserait deviner le
 *  nombre. */
function CommandesDuZoom({
  zoom,
  onZoom,
  ajuste,
}: {
  zoom: ZoomTable
  onZoom: (zoom: ZoomTable) => void
  ajuste: number
}) {
  const effectif = zoom === "ajuste" ? ajuste : zoom
  const [ecrit, setEcrit] = useState<string | null>(null)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseInt(texte.replace(/[^\d]/g, ""), 10)
    // **Hors bornes, on ramène — on ne refuse pas.**
    if (Number.isFinite(lu)) onZoom(borner(lu))
  }

  return (
    <span className="flex items-center gap-[4px]">
      <button
        type="button"
        aria-label="Reculer"
        title="Reculer"
        disabled={effectif <= ZOOM_MIN}
        onClick={() =>
          onZoom(
            borner([...ARRETS_ZOOM].reverse().find((a) => a < effectif) ?? ZOOM_MIN),
          )
        }
        className="flex h-[26px] w-[26px] items-center justify-center rounded-7 text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Pour cent d'agrandissement"
        value={ecrit ?? `${effectif}`}
        onChange={(e) => setEcrit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") valider((e.target as HTMLInputElement).value)
          // Échap rend la valeur d'avant — comme partout ailleurs.
          if (e.key === "Escape") setEcrit(null)
        }}
        onBlur={(e) => ecrit !== null && valider(e.target.value)}
        className="mesure h-[26px] w-[42px] rounded-7 border border-trait bg-carte px-[4px] text-right text-[12px] text-encre tabular-nums"
      />
      <span className="text-[12px] text-encre-4">%</span>
      <button
        type="button"
        aria-label="Approcher"
        title="Approcher"
        disabled={effectif >= ZOOM_MAX}
        onClick={() => onZoom(borner(ARRETS_ZOOM.find((a) => a > effectif) ?? ZOOM_MAX))}
        className="flex h-[26px] w-[26px] items-center justify-center rounded-7 text-[12px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
      >
        +
      </button>
      <button
        type="button"
        title="Un pixel d'image pour un pixel d'écran"
        aria-pressed={zoom === 100}
        onClick={() => onZoom(100)}
        className={[
          "h-[26px] shrink-0 whitespace-nowrap rounded-7 px-[8px] text-[12px] transition-colors duration-120",
          zoom === 100 ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
        ].join(" ")}
      >
        100 %
      </button>
      <button
        type="button"
        title="Toute l'image dans le cadre"
        aria-pressed={zoom === "ajuste"}
        onClick={() => onZoom("ajuste")}
        className={[
          "h-[26px] shrink-0 whitespace-nowrap rounded-7 px-[8px] text-[12px] transition-colors duration-120",
          zoom === "ajuste" ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
        ].join(" ")}
      >
        ajusté
      </button>
    </span>
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
  onFermer,
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
  onFermer: () => void
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

  useEffect(() => {
    const ecouter = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [onFermer])

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
      className="absolute right-0 top-full z-30 mt-[6px] w-[300px] rounded-8 border border-trait bg-carte p-[14px] text-left shadow-[0_4px_18px_rgba(0,0,0,.12)]"
    >
      {/* ── La séance ──────────────────────────────────────────────────── */}
      <p className="mb-[8px] text-[11px] text-encre-4">
        Les réglages de cette image, ailleurs
      </p>
      <div className="mb-[12px] flex gap-[8px]">
        <button
          type="button"
          onClick={onCopier}
          className="h-[28px] flex-1 rounded-7 border border-trait text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
        >
          Copier les réglages
        </button>
        <button
          type="button"
          onClick={onColler}
          disabled={!aCopier}
          className="h-[28px] flex-1 rounded-7 border border-trait text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint disabled:hover:border-trait disabled:hover:text-eteint"
        >
          Coller
        </button>
      </div>
      {!aCopier && (
        <Pourquoi texte="rien de copié pour l'instant — copie d'abord les réglages d'une image." />
      )}

      {/* ── Ce qui survit à la séance ──────────────────────────────────── */}
      <p className="mb-[8px] mt-[12px] border-t border-trait-faible pt-[12px] text-[11px] text-encre-4">
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
          className="h-[28px] min-w-0 flex-1 rounded-7 border border-trait bg-papier px-[8px] text-[12px] text-encre placeholder:text-eteint"
        />
        <button
          type="button"
          onClick={enregistrer}
          disabled={!propre}
          className="h-[28px] shrink-0 rounded-7 border border-trait px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint"
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
        <ul className="flex max-h-[180px] flex-col overflow-y-auto">
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
          className="mt-[12px] border-t border-trait-faible pt-[12px] text-[11px] leading-[1.5] text-encre-2"
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
      <p className="mt-[12px] border-t border-trait-faible pt-[8px] text-[11px] text-encre-4">
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
