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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  CONTOUR_PAR_DEFAUT,
  FORCE_TRAMAGE_LIVREE,
  GARDEES_MAX,
  GRAIN_MAX,
  LISSAGE_MAX,
  MAIN_VIDE,
  NOM_DE_LA_METHODE,
  PASSE_PAR_DEFAUT,
  RETOURNEMENT_PAR_DEFAUT,
  occupationMax,
  paliersDeCouleurs,
  type Ancrage,
  type Asset,
  type Bords,
  type Contour,
  type Echange,
  type EtatTraitement,
  type Grille,
  type Methode,
  type Passe,
  type Quantification,
  type Recette,
  type TachesDeLAsset,
  type Univers,
} from "../api"
import { imageAsset } from "./Apercu"
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
  SENS_A_AJOUTER,
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
import { TABLES, avecVeille, dort, indisponible, placeDe, valeur, type Table } from "./Tables"

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

function ReglagesDuDetourage({ recette, traitement, poser, regler }: Poste) {
  const passes = recette.passes
  const grises = Object.fromEntries(
    traitement.moteurs.filter((m) => m.raison).map((m) => [m.nom, m.raison as string]),
  ) as Partial<Record<Passe["moteur"], string>>

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
              valeurs={["bord", "couleur", "modele", "trace"] as const}
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
                  }),
                })
              }
            />
          </Reglage>

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

          <Reglage nom="bord rongé">
            <Choix
              valeurs={[0, 1, 2, 3, 4] as const}
              valeur={passe.durcissement}
              onChange={(durcissement) =>
                void poser({ ...recette, passes: changer(rang, { durcissement }) })
              }
            />
          </Reglage>

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

      {/* ⚠️ **La couleur du fond est devinée, pas lue** (B16). Le jeu en
          déclare une dans ses règles, elle part dans le prompt — et
          `atelier/domaine/fond.py` n'est importé ni par la recette ni par le
          traitement. Le détourage reprend la couleur médiane des bordures,
          qu'un sujet débordant sur un bord fait basculer.

          C'est ici que ça mord : on règle une tolérance contre une couleur, et
          croire qu'on vise celle du jeu fait chercher le défaut au mauvais
          endroit. Le moteur qui lirait la couleur déclarée appartient à `B18`. */}
      <Pourquoi texte="la couleur du fond est devinée sur les bordures de l'image — le détourage ne lit pas encore celle que le jeu a déclarée" />
    </div>
  )
}

function ReglagesDuRecadrage({ recette, mesures, regler, poser, ouvrir }: Poste) {
  const recadrage = recette.recadrage ?? { marge: 0, boite: null }
  const vu = mesures?.recadrage ?? null
  // ⚠️ **La condition vient du serveur, jamais d'ici** (B16). L'écran la
  // dérivait de `recette.grille != null`, et c'est faux dans trois cas : grille
  // endormie, grille sans détourage vif, et l'inverse. La règle vit une seule
  // fois, dans `Recette.marge_sans_effet`.
  const margeAvalee = vu?.marge_sans_effet ?? false
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
              void poser({ ...recette, recadrage: { marge: recadrage.marge, boite: null } })
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
          onRegler={(marge) =>
            regler({ ...recette, recadrage: { marge, boite: recadrage.boite } })
          }
          onPoser={(marge) =>
            void poser({ ...recette, recadrage: { marge, boite: recadrage.boite } })
          }
        />
      </Reglage>
      {margeAvalee && (
        <Pourquoi
          texte="la case avale la marge : c'est la hauteur qui donne l'air autour du sujet"
          geste="Pixéliser"
          onGeste={() => ouvrir("grille")}
        />
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
  const taches = mesures?.taches ?? []
  const partent = taches.filter((t) => t.aire < seuil).length

  /** **Toujours la table entière** (B17, la même leçon qu'au-dessus pour les
   *  couleurs) : régler la tache minimale ne doit pas effacer un grain ou un
   *  lissage déjà posés. */
  const avec = (suivant: Partial<Bords>): Recette => ({
    ...recette,
    bords: { aire_min: seuil, grain_min: grain, lissage, ...suivant },
  })

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

      {/* ── Le grain de couleur, et l'escalier (B17) ───────────────────────
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
      </div>
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
    </div>
  )
}

function ReglagesDuRetournement({ recette, poser }: Poste) {
  const retournement = recette.retournement ?? RETOURNEMENT_PAR_DEFAUT
  return (
    <div className="flex flex-col gap-[14px]">
      <Reglage nom="sens">
        <Choix
          valeurs={SENS_LIVRES}
          valeur={retournement.sens}
          libelles={SENS_DU_RETOURNEMENT}
          onChange={(sens) => void poser({ ...recette, retournement: { sens } })}
        />
      </Reglage>
      {/* **Les neuf autres paraissent, grisés, au lieu d'être cachés** : c'est
          ce qui dit ce que l'atelier saura faire, et cette table est la seule
          de la chaîne qui manque presque en entier. Ils viennent en `B18`. */}
      <div className="flex flex-col gap-[4px]">
        <Etiquette>neuf sens à venir</Etiquette>
        <Choix
          valeurs={SENS_A_AJOUTER}
          valeur=""
          eteints={Object.fromEntries(SENS_A_AJOUTER.map((s) => [s, "n'existe pas encore"]))}
          onChange={() => {}}
        />
      </div>
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

/** Les deux fabriques. **Elles ne s'endorment pas et ne posent rien sur cette
 *  image** : elles en écrivent d'autres, et c'est le critère qui les range à
 *  droite du trait. */
function LaFabrique({ table, onAller }: { table: Table; onAller: () => void }) {
  const dit =
    table === "decoupage"
      ? "Une image en entrée, plusieurs sujets en sortie. Elle ne change pas l'image ouverte, elle en écrit d'autres — les morceaux naissent à zéro."
      : "Elle prend deux images et en fabrique une troisième — l'armure sur le garde, la neige sur le toit du moulin. Dans la recette, elle occupe bel et bien une place, la seconde ; à l'écran elle vit à droite du trait, parce qu'elle nomme deux images et qu'une table n'en règle qu'une."
  return (
    <div className="flex flex-col gap-[14px]">
      <p className="text-[13px] leading-[1.5] text-encre-2">{dit}</p>
      <button
        type="button"
        onClick={onAller}
        className="h-[30px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        L'ouvrir ›
      </button>
      <Pourquoi texte="elle ne s'endort pas : il n'y a rien à éteindre sur cette image-ci" />
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

/** Ce que le témoin montre. **Il ne retire jamais un geste** — c'est la règle
 *  que la V2.1 a payée : une comparaison pose un témoin à côté, elle ne
 *  remplace pas l'outil. */
type Temoin = "avant" | "deux" | "apres"

const CE_QUE_LE_TEMOIN_MONTRE: Record<Temoin, string> = {
  avant: "Avant",
  deux: "Les deux",
  apres: "Après",
}

/** ⚠️ **Des multiples entiers, et un sprite de 64 px n'est pas regardable à
 *  ×1.** Vu au navigateur : l'image occupait un huitième d'un cadre de cinq
 *  cents pixels, et l'on ne pouvait juger d'aucun réglage — c'est-à-dire qu'on
 *  ne pouvait rien faire de l'écran. Aucun essai d'écran ne pouvait le voir :
 *  ils n'ont pas de largeur.
 *
 *  La règle est celle de `Vitrine.tsx` et de `GrilleDuJeu.tsx`, pour la même
 *  raison : à ×1,5 un pixel du jeu n'est plus un carré. */
const ZOOMS = [1, 2, 4, 8] as const
type Zoom = (typeof ZOOMS)[number]

export function Retouche({
  asset,
  univers,
  traitement,
  onFermer,
  onDecouper,
  onSuperposer,
  onErreur,
}: {
  asset: Asset
  univers: Univers
  traitement: EtatTraitement
  onFermer: () => void
  onDecouper: () => void
  onSuperposer: () => void
  onErreur: (raison: string) => void
}) {
  const { recette, regler, poser, revenirAuBrut, enVol } = useRecette(asset, onErreur)
  const mesures = useMesures(asset)
  const [ouverte, setOuverte] = useState<Table>("detourage")
  const [temoin, setTemoin] = useState<Temoin>("apres")
  const [zoom, setZoom] = useState<Zoom>(4)

  // Changer d'image rouvre la première table : garder celle d'avant ferait
  // croire qu'on a réglé quelque chose sur celle qu'on vient d'ouvrir.
  useEffect(() => setOuverte("detourage"), [asset.identifiant])

  // ── Le grossissement, mesuré sur le cadre ────────────────────────────────
  //
  // Le cadre est mesuré plutôt que deviné : sa largeur dépend de la fenêtre,
  // et un cran de grossissement qui n'y tient pas afficherait un chiffre faux.
  const cadre = useRef<HTMLDivElement>(null)
  const [coteDuCadre, setCoteDuCadre] = useState(0)
  useEffect(() => {
    const noeud = cadre.current
    if (!noeud) return
    const mesurer = () =>
      // Les 22 px de marge intérieure, des deux côtés. Zéro veut dire *pas
      // encore mesuré* — sous `jsdom` il n'y a aucune mise en page, et un
      // cadre inconnu ne doit retirer aucun cran.
      setCoteDuCadre(Math.max(0, Math.min(noeud.clientWidth, noeud.clientHeight) - 44))
    mesurer()
    if (typeof ResizeObserver === "undefined") return
    const oeil = new ResizeObserver(mesurer)
    oeil.observe(noeud)
    return () => oeil.disconnect()
  }, [])

  /** Le plus grand côté à montrer — deux images côte à côte se partagent la
   *  place, donc le témoin « les deux » compte double. */
  const coteDeLImage =
    Math.max(
      asset.largeur,
      asset.hauteur,
      asset.rendu_largeur || 0,
      asset.rendu_hauteur || 0,
    ) * (temoin === "deux" ? 2 : 1)
  const zoomsTenables = ZOOMS.filter(
    (z) => coteDuCadre === 0 || coteDeLImage * z <= coteDuCadre,
  )
  const zoomTenu: Zoom = zoomsTenables.includes(zoom)
    ? zoom
    : (zoomsTenables.at(-1) ?? 1)

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
          <span className="text-[12.5px] text-encre-3">{asset.label}</span>
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

        <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden pb-[22px]">
          {/* ── L'image, et rien par-dessus ─────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <div className="flex items-center justify-between gap-[8px]">
              <span className="min-w-0 truncate text-[12.5px] text-encre-2">
                {CE_QUE_LA_TABLE_FAIT[ouverte]}
              </span>
              {/* ⚠️ **Un grossissement affiché est un grossissement appliqué.**
                  Vu au navigateur sur un jeu en dessin : l'écran disait ×4 sur
                  une image de 2 048 px que le cadre réduisait en fait à un
                  cinquième. Les crans que le cadre ne peut pas tenir sont donc
                  retirés, et quand aucun ne tient, la rangée cède la place à la
                  phrase qui dit ce qui se passe vraiment. */}
              {zoomsTenables.length > 0 ? (
                <div data-zoom className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
                  {zoomsTenables.map((z) => (
                    <button
                      key={z}
                      type="button"
                      aria-pressed={zoomTenu === z}
                      onClick={() => setZoom(z)}
                      className={[
                        "flex h-[26px] min-w-[22px] items-center justify-center rounded-7 text-[12px] transition-colors duration-120",
                        zoomTenu === z
                          ? "bg-carte font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      ×{z}
                    </button>
                  ))}
                </div>
              ) : (
                <span data-zoom-impossible className="mesure text-[10.5px] text-encre-4">
                  réduite pour tenir dans le cadre
                </span>
              )}
              <div
                data-temoin
                className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]"
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
              </div>
            </div>

            <div
              ref={cadre}
              data-scene-de-retouche
              className="flex min-h-[300px] flex-1 items-center justify-center gap-[8px] overflow-auto rounded-8 bg-pourtour p-[22px]"
            >
              {(temoin === "avant" || temoin === "deux") && (
                <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                  <img
                    src={imageAsset(asset, true)}
                    alt={`${asset.label}, avant`}
                    width={asset.largeur * zoomTenu}
                    height={asset.hauteur * zoomTenu}
                    style={{ imageRendering: "pixelated" }}
                    className="damier block max-h-full min-w-0 object-contain"
                  />
                  <figcaption className="mesure text-[10.5px] text-carte">
                    avant · {asset.largeur}×{asset.hauteur}
                  </figcaption>
                </figure>
              )}
              {(temoin === "apres" || temoin === "deux") && (
                <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                  <img
                    src={imageAsset(asset)}
                    alt={`${asset.label}, après`}
                    width={(asset.rendu_largeur || asset.largeur) * zoomTenu}
                    height={(asset.rendu_hauteur || asset.hauteur) * zoomTenu}
                    style={{ imageRendering: "pixelated" }}
                    className="damier block max-h-full min-w-0 object-contain"
                  />
                  {/* **La taille rendue est écrite sous l'image**, parce que
                      c'est le seul endroit où le contour se voit changer les
                      dimensions du fichier qui part dans le jeu. */}
                  <figcaption className="mesure text-[10.5px] text-carte">
                    après · {asset.rendu_largeur || asset.largeur}×
                    {asset.rendu_hauteur || asset.hauteur}
                  </figcaption>
                </figure>
              )}
            </div>

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
              <ReglagesDuDetourage {...poste} />
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
            ) : (
              <LaFabrique
                table={ouverte}
                onAller={ouverte === "decoupage" ? onDecouper : onSuperposer}
              />
            )}

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
        </div>
      </div>
    </main>
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
