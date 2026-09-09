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
 * **Les quatre gestes qui se posent sur l'image vivent ici** (`B23`) — le
 * rectangle de recadrage, le point de la pipette, la forme entourée et le
 * pinceau de la main. `B16` les avait laissés derrière en promettant leur
 * déménagement ; il a lieu ici, et il est un déménagement : le calcul des
 * quatre surfaces est repris tel quel, seul leur habillage passe au papier.
 * Elles restent ce dont l'invariant du lot U dit qu'il **ne voyage pas** — un
 * point désigne un endroit de *cette* image-là, et la colonne le dit.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  type FormatDeRecadrage,
  type Grille,
  type Main,
  type Methode,
  type Passe,
  type Quantification,
  type Recadrage,
  type Recette,
  type Retournement,
  type TachesDeLAsset,
  type Trait,
  type Univers,
} from "../api"
import { imageAsset } from "./Apercu"
// **Trois fonctions pures, et rien d'autre de `chassis.tsx`.** Aucun fichier du
// carnet n'importe ce module — il porte le balisage de l'ancien châssis, et ses
// couleurs ne sont pas celles du papier. Ces trois-là n'ont ni balise ni jeton :
// c'est la courbe de la jauge, le battement qui la nourrit, et le rectangle que
// l'image occupe vraiment dans la surface qui reçoit un geste. Les réécrire
// aurait fabriqué **deux vérités sur la même attente**, et c'est précisément la
// panne que cette tranche répare ailleurs.
import { part, rectangleDeLImage, useEcoule } from "./chassis"
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
  TOLERANCE_D_UNE_PAIRE_MAX,
  TROUS,
  avecPassage,
  debord,
  defautGrille,
  mainDe,
  passagesDe,
  quantificationDe,
  rayonDe,
  sansLeDernier,
  useEtatMain,
  useMesures,
  useRecette,
  type EtatMain,
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
  /** Le rang de la passe qui attend son geste **dans l'image**, ou `null`.
   *
   *  **L'état vit au-dessus des deux colonnes** (B23, repris de l'écran des
   *  tables) : la passe se règle à droite et se vise au milieu, et un état tenu
   *  d'un seul côté aurait laissé l'autre l'ignorer. */
  armee: number | null
  onArmer: (rang: number | null) => void
  /** Ce que l'écran tient de la main — le calque actif, le sens, le diamètre et
   *  la couleur. Ils décrivent la **main**, pas l'image : les écrire dans la
   *  recette les aurait fait entrer dans l'empreinte, donc changer de pinceau
   *  aurait recalculé un rendu identique. */
  etatMain: EtatMain
}

function ReglagesDuDetourage({
  recette,
  univers,
  traitement,
  mesures,
  poser,
  regler,
  armee,
  onArmer,
}: Poste) {
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

      {passes.map((passe, rang) => {
      /** La couleur **mesurée par le serveur sous le point**, jamais recopiée
       *  dans la recette : ce qui part est le point, et une couleur écrite à
       *  côté de lui serait une copie que plus rien ne met à jour. */
      const couleurVisee = mesures?.visees?.[rang] ?? null
      return (
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

          {/* ── Les deux gestes qui se posent sur l'image (B23) ─────────────
              **Le bouton arme, l'image reçoit.** Le point de la pipette et la
              forme entourée désignent un endroit de *cette* image-là : ils ont
              besoin de sa surface, et l'invariant du lot U dit qu'ils ne partent
              ni par un collage ni par une recette nommée. La colonne dit donc ce
              qui est posé, et elle ouvre la surface — elle ne règle pas quatre
              nombres à sa place. */}
          {passe.moteur === "couleur" && (
            <Reglage nom="couleur visée">
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
                <button
                  type="button"
                  data-viser={rang}
                  aria-pressed={armee === rang}
                  onClick={() => onArmer(armee === rang ? null : rang)}
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
              </div>
            </Reglage>
          )}
          {passe.moteur === "couleur" && (
            <Pourquoi
              texte={
                passe.point
                  ? `le point désigne un endroit de cette image-là · ${passe.point[0]}, ${passe.point[1]} — il ne voyage pas`
                  : "tant qu'aucun point n'est posé, cette passe ne retire rien — et le point qu'on posera ne voyagera pas"
              }
            />
          )}

          {passe.moteur === "trace" && (
            <Reglage nom="forme entourée">
              <button
                type="button"
                data-entourer={rang}
                aria-pressed={armee === rang}
                onClick={() => onArmer(armee === rang ? null : rang)}
                className="h-[26px] self-start rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                {armee === rang
                  ? "entoure le sujet dans l'image"
                  : passe.trace.length > 0
                    ? `${passe.trace.length} points · entourer à nouveau ›`
                    : "entourer dans l'image ›"}
              </button>
            </Reglage>
          )}
          {passe.moteur === "trace" && (
            <Pourquoi
              texte={
                passe.trace.length > 0
                  ? "le bord est cherché à l'intérieur de ce que tu as entouré — rien ne bouge au-dehors, et cette forme ne voyage pas"
                  : "tant qu'aucune forme n'est entourée, cette passe ne retire rien — et cette forme ne voyage pas"
              }
            />
          )}
        </div>
      )
      })}

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
 *  a une, et se tape à la main sinon.
 *
 *  ⚠️ **La planche la veut à la pipette sur l'image** ; ce qui est livré ici est
 *  le choix parmi les couleurs connues. La surface à coordonnées de cet écran ne
 *  sert que le détourage, le recadrage et la main — lui faire porter un
 *  cinquième geste demanderait de savoir, au clic, lequel des cinq on fait. */
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
 *  réduction. Le geste de la table des couleurs, dans le vocabulaire de cet
 *  écran : une paire en train de se faire reste ici, à
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

/** Une couleur, choisie par pipette de palette ou entrée en clair — la règle
 *  d'US-210 : *proposée, jamais imposée*. Rien ici ne désigne un endroit de
 *  cette image-là, donc rien n'appartient au pinceau. */
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

function ReglagesDuRetournement({ recette, regler, poser }: Poste) {
  const retournement = recette.retournement ?? RETOURNEMENT_PAR_DEFAUT
  const posant = (partiel: Partial<Retournement>) =>
    void poser({ ...recette, retournement: { ...retournement, ...partiel } })
  const reglant = (partiel: Partial<Retournement>) =>
    regler({ ...recette, retournement: { ...retournement, ...partiel } })
  const zones = retournement.zones_protegees ?? []
  return (
    <div className="flex flex-col gap-[14px]">
      {/* **Les dix sens depuis `B18`.** */}
      <Reglage nom="sens">
        <Choix
          valeurs={SENS_LIVRES}
          valeur={retournement.sens}
          libelles={SENS_DU_RETOURNEMENT}
          onChange={(sens) => posant({ sens })}
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
function ReglagesDeLaMain({ recette, univers, mesures, regler, poser, etatMain }: Poste) {
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
      <div className="flex flex-col gap-[4px]">
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
          className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
        >
          Un calque de dessin de plus
        </button>
      </div>

      {/* **Les deux crans changent de nom avec le calque actif.** C'est la même
          mécanique — un passage qui ajoute, un passage qui retire — et le cran
          allumé dit ce que le geste fera. */}
      <Reglage nom="le sens">
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
          className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:cursor-not-allowed disabled:text-eteint disabled:hover:border-trait"
        >
          Défaire le dernier · Ctrl + Z
        </button>
      </div>

      <button
        type="button"
        onClick={() => void poser({ ...recette, main: MAIN_VIDE })}
        className="h-[30px] rounded-7 border border-trait bg-carte text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
      >
        Tout effacer
      </button>
      <Pourquoi
        texte={`${main.calques.length} calque${main.calques.length > 1 ? "s" : ""} · ${passagesDe(main)} passage${passagesDe(main) > 1 ? "s" : ""} — on repeint sur l'image, à gauche, et un passage de la main ne voyage pas`}
      />
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
export function ToileDeLaMain({
  asset,
  avant,
  etat,
  onPassage,
}: {
  asset: Asset
  avant: boolean
  etat: EtatMain
  onPassage: (trait: Trait) => void
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
  point,
  onPoint,
}: {
  asset: Asset
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
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
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
  trace,
  onTrace,
}: {
  asset: Asset
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
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
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
  boite,
  onBoite,
  obtenue,
}: {
  asset: Asset
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
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
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

/** Ce que le témoin montre. **Il ne retire jamais un geste** — c'est la règle
 *  que la V2.1 a payée : une comparaison pose un témoin à côté, elle ne
 *  remplace pas l'outil. */
type Temoin = "avant" | "deux" | "apres"

const CE_QUE_LE_TEMOIN_MONTRE: Record<Temoin, string> = {
  avant: "Avant",
  deux: "Les deux",
  apres: "Après",
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

/** Ce que la surface fait, écrit sous elle — **le geste, jamais le nom de la
 *  table**, qui est déjà en haut de la colonne. */
const CE_QUE_LA_SURFACE_DIT: Record<"main" | "pipette" | "trace" | "recadrage", string> = {
  main: "on repeint",
  pipette: "on vise un pixel",
  trace: "on entoure le sujet",
  recadrage: "on trace le rectangle",
}

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
  // **L'aperçu sur plusieurs fonds (B18)** — une préférence d'écran, jamais un
  // réglage de la recette : poser le sujet sur de l'herbe ne change pas un
  // pixel du fichier qui part dans le jeu. Le rendu porte déjà son alpha ; le
  // fond se pose donc en CSS, derrière l'image, sans redemander quoi que ce
  // soit au serveur — `apercu_sur_fonds` (`atelier/image/traitement.py`)
  // rend le même calcul côté serveur, pour l'export et pour l'essai.
  const [fondApercu, setFondApercu] = useState<FondApercu>("damier")

  // Changer d'image rouvre la première table : garder celle d'avant ferait
  // croire qu'on a réglé quelque chose sur celle qu'on vient d'ouvrir.
  useEffect(() => setOuverte("detourage"), [asset.identifiant])

  // ── Les quatre surfaces à coordonnées (B23) ──────────────────────────────

  const etatMain = useEtatMain(univers)

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

  /** La surface que la table ouverte pose sur l'image, ou `null` quand elle
   *  n'en porte aucune. **Une seule à la fois** : une surface qui recevrait
   *  deux gestes ne saurait pas lequel on vient de faire. */
  const surface: "main" | "pipette" | "trace" | "recadrage" | null =
    ouverte === "main"
      ? "main"
      : ouverte === "detourage" && visee !== null
        ? "pipette"
        : ouverte === "detourage" && entourage !== null
          ? "trace"
          : ouverte === "recadrage"
            ? "recadrage"
            : null

  /** Le côté de ce que la surface montre. **Trois travaillent sur le brut, la
   *  main sur le rendu** : c'est la convention de coordonnées de chacune, et
   *  la mesurer autrement décalerait ce qu'on pose dessus. */
  const coteDeLaSurface: [number, number] =
    surface === "main"
      ? [asset.rendu_largeur || asset.largeur, asset.rendu_hauteur || asset.hauteur]
      : [asset.largeur, asset.hauteur]

  // Ctrl + Z retire le dernier passage de la couche active. La touche n'est
  // écoutée que dans la table de la main : ailleurs elle appartient à la toile
  // du tableau d'inspiration, et deux piles d'annulation sur la même touche
  // seraient une pile de trop.
  useEffect(() => {
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
  }, [surface, recette, etatMain.actif, poser])

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

  // **Le damier cède la place au fond choisi**, et seulement sur la table du
  // contour — c'est elle qui pose la question, les sept autres n'en ont pas
  // besoin. Le damier peint son propre fond derrière l'image ; il faut donc
  // l'ôter, sans quoi la couleur posée sur le cadre ne se verrait jamais.
  const montreUnFond = ouverte === "contours" && FONDS_APERCU[fondApercu] !== null

  /** Le plus grand côté à montrer — deux images côte à côte se partagent la
   *  place, donc le témoin « les deux » compte double. **Une surface est
   *  seule** : elle prend la place de l'image, elle ne s'ajoute pas à elle. */
  const coteDeLImage =
    Math.max(
      asset.largeur,
      asset.hauteur,
      asset.rendu_largeur || 0,
      asset.rendu_hauteur || 0,
    ) * (surface === null && temoin === "deux" ? 2 : 1)
  const zoomsTenables = ZOOMS.filter(
    (z) => coteDuCadre === 0 || coteDeLImage * z <= coteDuCadre,
  )
  const zoomTenu: Zoom = zoomsTenables.includes(zoom)
    ? zoom
    : (zoomsTenables.at(-1) ?? 1)

  /** **Aucun cran ne tient : la surface se réduit au cadre.** Un cran choisi
   *  qui dépasse, on le fait défiler — c'est voulu, et ça ne change pas. Mais
   *  quand même ×1 ne tient pas, `zoomTenu` retombe à 1 sans que personne
   *  l'ait demandé, et la surface prend alors sa taille en pixels réels : une
   *  image de 1 024 dans un cadre de 545 laisse son coin haut-gauche hors
   *  d'atteinte pour toujours, parce qu'un enfant centré qui déborde ne se
   *  défile que de la moitié du débordement de chaque côté. On ne pourrait
   *  plus y poser un coin de recadrage, y viser un pixel, y commencer un
   *  tracé, y peindre. L'ancien écran montait ces mêmes surfaces en
   *  `h-full w-full`, toujours contenues quelle que soit l'image ; ici on
   *  fait pareil **en gardant les proportions**, parce que le curseur carré
   *  de la main se place en pour cent de la boîte pendant que l'image s'y
   *  contient : une boîte étirée les décalerait l'un de l'autre.
   *  `rectangleDeLImage` convertit à la taille affichée, donc réduire la
   *  surface ne décale aucune coordonnée envoyée. */
  const surfaceAuCadre = zoomsTenables.length === 0
  /** Ce par quoi multiplier le côté de la surface : le cran tenu, ou le repli
   *  au cadre quand aucun cran ne tient. `coteDuCadre` est déjà le plus petit
   *  côté du cadre moins ses marges, donc la boîte y entre dans les deux
   *  sens. */
  const echelleDeLaSurface = surfaceAuCadre
    ? coteDuCadre / Math.max(coteDeLaSurface[0], coteDeLaSurface[1], 1)
    : zoomTenu

  const poste: Poste = {
    recette,
    univers,
    traitement,
    mesures,
    regler,
    poser,
    ouvrir: setOuverte,
    armee: viseeArmee,
    onArmer: setViseeArmee,
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
                  phrase qui dit ce qui se passe vraiment. **Et ce qu'elle dit
                  arrive** : les deux images du témoin se contiennent dans le
                  cadre, et la surface s'y réduit aussi (`surfaceAuCadre`). Il
                  n'y a pas de cas où cette phrase paraît sur une image qui
                  déborde. */}
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
              {/* **Sur plusieurs fonds, seulement là où la question se pose**
                  (B18) — les autres tables n'ont pas à en tenir compte, et le
                  proposer partout aurait dilué l'unique raison d'être de
                  celui-ci : voir si le trait se détache. */}
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

            <div
              ref={cadre}
              data-scene-de-retouche
              style={montreUnFond ? { backgroundColor: FONDS_APERCU[fondApercu] as string } : undefined}
              className="flex min-h-[300px] flex-1 items-center justify-center gap-[8px] overflow-auto rounded-8 bg-pourtour p-[22px]"
            >
              {/* ── La surface qui reçoit le geste (B23) ───────────────────
                  **Elle prend la place de l'image, elle ne se pose pas
                  dessus.** Les quatre portent leur propre image — le brut pour
                  les trois qui travaillent en pixels d'origine, le rendu pour
                  la main —, et le cadre qui les tient *est* l'image, à la
                  taille du grossissement choisi : une boîte qui ment décale ce
                  qu'on pose dedans.

                  ⚠️ **Sauf quand aucun cran ne tient** : la boîte se réduit
                  alors au cadre, sans quoi un coin de l'image resterait hors
                  d'atteinte pour toujours. Voir `surfaceAuCadre`. */}
              {surface !== null && (
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
                        avant={temoin === "avant"}
                        etat={etatMain}
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
              )}

              {surface === null && (temoin === "avant" || temoin === "deux") && (
                <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                  <img
                    src={imageAsset(asset, true)}
                    alt={`${asset.label}, avant`}
                    width={asset.largeur * zoomTenu}
                    height={asset.hauteur * zoomTenu}
                    style={{ imageRendering: "pixelated" }}
                    className={[
                      montreUnFond ? "" : "damier",
                      "block max-h-full min-w-0 object-contain",
                    ].join(" ")}
                  />
                  <figcaption className="mesure text-[10.5px] text-carte">
                    avant · {asset.largeur}×{asset.hauteur}
                  </figcaption>
                </figure>
              )}
              {surface === null && (temoin === "apres" || temoin === "deux") && (
                <figure className="flex min-w-0 flex-col items-center gap-[4px]">
                  <img
                    src={imageAsset(asset)}
                    alt={`${asset.label}, après`}
                    width={(asset.rendu_largeur || asset.largeur) * zoomTenu}
                    height={(asset.rendu_hauteur || asset.hauteur) * zoomTenu}
                    style={{ imageRendering: "pixelated" }}
                    className={[
                      montreUnFond ? "" : "damier",
                      "block max-h-full min-w-0 object-contain",
                    ].join(" ")}
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
