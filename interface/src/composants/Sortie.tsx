/**
 * La forme « fichiers » de l'écran unique — **ce qui reste de l'ancien écran
 * `Sortie` après `RV8`**.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Sortie.dc.html`. Cet écran-ci avait
 * trois colonnes et son propre dossier ; l'écran unique (`Livraisons.tsx`) en
 * a repris le bandeau (un seul dossier Godot, mémorisé par le jeu, plus
 * question) et la portée (« Ce qui sort » devient la portée et la nature,
 * partagées avec le paquet Godot). Ce qui reste ici, et qui ne sert qu'à la
 * forme « fichiers » : le rangement, ce qu'on fait de ce qui existe déjà, le
 * moteur — repliés sous « Fichiers » — et l'arbre qui montre ce qui va être
 * écrit, avec ses trois marques.
 *
 * **Aucune des listes n'est écrite ici.** Elles viennent du serveur, tenu
 * dans `atelier/domaine/sortie.py` : l'écran ne peut donc pas proposer une
 * valeur qu'on refuserait, et un moteur de plus paraît sans qu'une ligne de
 * ce fichier bouge. Ce qui vit ici, ce sont **les mots** — le serveur envoie
 * `en_dossiers`, l'écran écrit *en dossiers*.
 */

import { useMemo, type ReactNode } from "react"
import type { ApercuDeSortie, FichierDeSortie, ReglagesDeLaSortie } from "../api"

/**
 * Comment chaque valeur du serveur se dit à l'écran.
 *
 * **Les clés sont celles du domaine, les mots sont ceux de la planche.** Une
 * valeur que le serveur enverrait sans être ici s'afficherait telle quelle
 * plutôt que de disparaître : un lot qu'on ne sait pas nommer reste choisissable,
 * et c'est le repli le moins mauvais — l'écran dit un mot laid, il ne cache pas
 * une possibilité.
 */
export const MOTS: Record<string, string> = {
  // Ce qui sort (portée et nature partagées avec le paquet Godot)
  tout: "Tout le jeu",
  personnages: "les personnages",
  objets: "les objets",
  decors: "les décors",
  interface: "l'interface",
  animations: "Les animations",
  // Comment ça se range
  a_plat: "à plat",
  en_dossiers: "en dossiers",
  // Ce qui existe déjà là-bas
  remplacer: "Remplacer",
  numeroter: "Garder les deux, numéroter",
  arreter: "S'arrêter s'il y a un doublon",
  effacer: "Effacer ce qui ne sort plus",
  // Pour quel moteur
  aucun: "aucun",
  godot: "Godot",
  unity: "Unity",
  phaser: "Phaser",
}

/** Ce qu'une marque dit, et de quelle encre. **Trois couleurs, pas quatre** :
 *  vert ce qui arrive, rouille ce qui écrase, gris ce qui ne bouge pas. Le
 *  quatrième — ce qui part — est un échec, parce qu'effacer est le seul geste
 *  de cet écran qui retire quelque chose. */
export const MARQUES: Record<string, { mot: string; encre: string }> = {
  nouveau: { mot: "nouveau", encre: "text-encre-ok" },
  remplace: { mot: "remplace", encre: "text-signal" },
  inchange: { mot: "inchangé", encre: "text-encre-4" },
  reste: { mot: "à effacer", encre: "text-echec" },
}

/** Ce que chaque alerte annonce, en tête de son bloc. Le compte vient du
 *  serveur ; la phrase aussi. Ce qui est ici est le titre, qui accorde le
 *  chiffre. */
export const ALERTES: Record<string, (compte: number) => string> = {
  sans_image: (n) => `${n} sujet${n > 1 ? "s" : ""} n'${n > 1 ? "ont" : "a"} aucune image qui sort`,
  une_seule_direction: (n) =>
    `${n} sujet${n > 1 ? "s" : ""} n'${n > 1 ? "ont" : "a"} qu'une direction`,
  animation_vide: (n) => `${n} animation${n > 1 ? "s" : ""} sans images`,
  corps_habille: (n) => `${n} pièce${n > 1 ? "s" : ""} sortent en corps entier`,
}

/**
 * Un poids de fichier, tel qu'on l'écrit en français.
 *
 * **La virgule est mise ici, jamais par le serveur** : le dépôt a déjà payé un
 * écran qui affichait « il manque 26,5 Go » et, deux lignes plus bas, « 8.7 Go »
 * — le serveur met la virgule dans ses phrases, jamais dans ses nombres.
 */
export function poids(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`
}

/** La date d'une sortie, lisible — « 4 septembre 2026, 18 h 40 ». */
export function quand(horodatage: number): string {
  const date = new Date(horodatage * 1000)
  return `${date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}, ${date.getHours()} h ${String(date.getMinutes()).padStart(2, "0")}`
}

/**
 * L'arbre, groupé par dossier.
 *
 * **Le groupement se fait ici et pas au serveur**, parce que c'est une question
 * d'affichage : le serveur rend une liste de chemins, qui est ce qui sera écrit ;
 * l'écran la plie en dossiers, qui est ce qui se lit. Un serveur qui rendrait un
 * arbre aurait décidé de la présentation à la place de l'écran.
 */
export function parDossier(
  fichiers: readonly FichierDeSortie[],
): { dossier: string; fichiers: FichierDeSortie[] }[] {
  const groupes = new Map<string, FichierDeSortie[]>()
  for (const fichier of fichiers) {
    const coupe = fichier.chemin.lastIndexOf("/")
    const dossier = coupe < 0 ? "" : fichier.chemin.slice(0, coupe)
    const deja = groupes.get(dossier)
    if (deja) deja.push(fichier)
    else groupes.set(dossier, [fichier])
  }
  // La racine en dernier : c'est là que vivent le descriptif et le catalogue,
  // et c'est ce que la planche dessine — les dossiers d'abord, ce qui les
  // surplombe ensuite.
  return [...groupes.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([dossier, fichiers]) => ({ dossier, fichiers }))
}

// ── Les pièces ──────────────────────────────────────────────────────────────

export function Intitule({ enfants }: { enfants: string }) {
  return (
    <span className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {enfants}
    </span>
  )
}

/** La raison d'un bloc — une phrase qui dit la conséquence, jamais la règle. */
export function Raison({ enfants }: { enfants: ReactNode }) {
  return (
    <p className="text-[11.5px] leading-[1.45] text-encre-4">{enfants}</p>
  )
}

export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[8px] border-b border-trait py-[14px] last:border-0">
      <Intitule enfants={titre} />
      {children}
    </section>
  )
}

/** Un segmenté : les valeurs côte à côte, une seule allumée. */
export function Segmente({
  valeurs,
  choisie,
  onChoisir,
  nom,
}: {
  valeurs: readonly string[]
  choisie: string
  onChoisir: (valeur: string) => void
  nom: string
}) {
  return (
    <div role="radiogroup" aria-label={nom} className="flex rounded-7 border border-contour">
      {valeurs.map((valeur, rang) => (
        <button
          key={valeur}
          type="button"
          role="radio"
          aria-checked={valeur === choisie}
          onClick={() => onChoisir(valeur)}
          className={[
            "h-[30px] flex-1 text-[12px] transition-colors duration-120",
            rang > 0 ? "border-l border-contour" : "",
            valeur === choisie
              ? "bg-ligne-ouverte text-encre"
              : "text-encre-controle hover:bg-papier",
          ].join(" ")}
        >
          {MOTS[valeur] ?? valeur}
        </button>
      ))}
    </div>
  )
}

/** Une ligne de choix, avec son compte à droite quand il y en a un.
 *
 *  Le compte est en chasse fixe et aligné à droite : c'est un fait mesuré
 *  (`docs/DESIGN.md`, § Les compteurs). */
export function Choix({
  nom,
  choisi,
  compte,
  decale,
  onChoisir,
}: {
  nom: string
  choisi: boolean
  compte?: string
  decale?: boolean
  onChoisir: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={choisi}
      onClick={onChoisir}
      className={[
        "flex h-[26px] w-full items-center gap-[8px] text-left text-[12.5px]",
        decale ? "pl-[22px]" : "",
        "transition-colors duration-120",
        choisi ? "text-encre" : "text-encre-controle hover:text-encre-2",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "h-[8px] w-[8px] shrink-0 rounded-5 border",
          choisi ? "border-encre bg-encre" : "border-contour",
        ].join(" ")}
      />
      <span className="truncate">{nom}</span>
      {compte != null && (
        <span className="mesure ml-auto shrink-0 text-[11px] text-encre-4">
          {compte}
        </span>
      )}
    </button>
  )
}

/** Une ligne de l'arbre : le nom, sa mesure, sa marque.
 *
 *  `entier` écrit le chemin complet plutôt que le seul nom. Il sert aux restes,
 *  qui ne sont rangés sous aucun dossier de l'arbre — sans lui, deux fichiers
 *  de dossiers différents portant le même nom se lisent comme un seul. */
export function Ligne({
  fichier,
  decale,
  entier,
}: {
  fichier: FichierDeSortie
  decale?: boolean
  entier?: boolean
}) {
  const marque = MARQUES[fichier.marque] ?? {
    mot: fichier.marque,
    encre: "text-encre-4",
  }
  const coupe = fichier.chemin.lastIndexOf("/")
  return (
    <div
      data-fichier={fichier.chemin}
      className={`flex gap-[8px] ${decale ? "pl-[14px]" : ""}`}
    >
      <span className="truncate text-encre-2">
        {entier || coupe < 0 ? fichier.chemin : fichier.chemin.slice(coupe + 1)}
      </span>
      <span className="ml-auto shrink-0 text-encre-4">
        {/* **Zéro n'est pas une dimension, c'est l'absence de mesure** : un
            descriptif est du texte, et rien ne s'écrit à sa place. */}
        {fichier.largeur > 0 ? `${fichier.largeur}×${fichier.hauteur}` : ""}
        {fichier.images > 0 ? ` ${fichier.images} images` : ""}
      </span>
      <span className={`shrink-0 ${marque.encre}`}>{marque.mot}</span>
    </div>
  )
}

/** L'arbre B21 — ce qui va être écrit, groupé par dossier, avec le filtre
 *  « ce qui a changé » et les quatre comptes en dessous. C'est **le panneau
 *  central** de l'écran unique quand la forme est « Fichiers ». */
export function ArbreDeSortie({
  apercu,
  filtre,
  onFiltre,
}: {
  apercu: ApercuDeSortie | null
  filtre: "change" | "tout"
  onFiltre: (f: "change" | "tout") => void
}) {
  const montres =
    filtre === "tout"
      ? (apercu?.fichiers ?? [])
      : (apercu?.fichiers ?? []).filter((f) => f.marque !== "inchange")
  const groupes = useMemo(() => parDossier(montres), [montres])
  const comptes = apercu?.comptes ?? {}
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-[14px]">
        <Intitule enfants="Les fichiers qui seront écrits" />
        <div className="ml-auto flex rounded-7 border border-contour">
          {(
            [
              ["change", "ce qui a changé"],
              ["tout", "tout"],
            ] as const
          ).map(([cle, mot], rang) => (
            <button
              key={cle}
              type="button"
              aria-pressed={filtre === cle}
              onClick={() => onFiltre(cle)}
              className={[
                "h-[22px] px-[8px] text-[11px] transition-colors duration-120",
                rang > 0 ? "border-l border-contour" : "",
                filtre === cle
                  ? "bg-ligne-ouverte text-encre"
                  : "text-encre-controle hover:bg-papier",
              ].join(" ")}
            >
              {mot}
            </button>
          ))}
        </div>
      </div>

      <div className="mesure mt-[14px] min-w-0 overflow-x-auto rounded-8 border border-trait bg-carte p-[14px] text-[11.5px] leading-[1.6]">
        <div className="text-encre-3">{apercu?.dossier || "…"}</div>
        {groupes.map(({ dossier: ou, fichiers }) => (
          <div key={ou || "."}>
            {ou !== "" && <div className="pt-[8px] text-encre-2">{ou}/</div>}
            {fichiers.map((fichier) => (
              <Ligne key={fichier.chemin} fichier={fichier} decale={ou !== ""} />
            ))}
          </div>
        ))}
        {/* **Les restes portent leur chemin entier**, et c'est une correction
            venue du navigateur. Affichés comme les autres — le nom seul —,
            ils se rangeaient sous la racine à côté d'un fichier prévu du même
            nom : on lisait deux fois `le-pelerin-repos-est.png`, une fois
            « nouveau » et une fois « à effacer ». Ce sont deux chemins
            différents, et seul le chemin entier le dit. */}
        {(apercu?.restes ?? []).map((reste) => (
          <Ligne key={`reste-${reste.chemin}`} fichier={reste} entier />
        ))}
        {groupes.length === 0 && (
          <div className="text-encre-4">rien à montrer</div>
        )}
      </div>

      <div data-comptes className="flex flex-wrap gap-[14px] pt-[14px]">
        {(
          [
            ["nouveau", "nouveaux"],
            ["remplace", "remplacés"],
            ["inchange", "inchangés"],
            ["reste", "à effacer"],
          ] as const
        ).map(([cle, mot]) => (
          <span key={cle} className="text-[11.5px] text-encre-4">
            <span className={`mesure ${MARQUES[cle].encre}`}>
              {comptes[cle] ?? 0}
            </span>{" "}
            {mot}
          </span>
        ))}
      </div>
    </div>
  )
}

/** « Pas prêt » pour la forme « fichiers » — sous l'arbre, comme le veut
 *  l'écran unique. */
export function PasPretDeSortie({ apercu }: { apercu: ApercuDeSortie | null }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <Intitule enfants="Ce qui n'est pas prêt" />
      {(apercu?.pas_prets ?? []).length === 0 && (
        <p className="text-[12px] text-encre-4">
          Tout ce que ce lot contient a de quoi sortir.
        </p>
      )}
      {(apercu?.pas_prets ?? []).map((alerte) => (
        <div
          key={alerte.genre}
          className="flex flex-col gap-[8px] rounded-8 border border-trait-attention bg-fond-attention p-[14px]"
        >
          <span className="text-[12.5px] text-encre-attention">
            {(ALERTES[alerte.genre] ?? (() => alerte.genre))(alerte.compte)}
          </span>
          <p className="text-[11.5px] leading-[1.45] text-encre-attention">
            {alerte.phrase}
          </p>
          <ul className="flex flex-col">
            {alerte.sujets.slice(0, 3).map((sujet) => (
              <li
                key={`${sujet.identifiant}-${sujet.quoi}`}
                className="flex gap-[8px] text-[11.5px] text-encre-attention"
              >
                <span className="truncate">{sujet.nom}</span>
                <span className="mesure ml-auto shrink-0">{sujet.quoi}</span>
              </li>
            ))}
          </ul>
          {alerte.compte > 3 && (
            <span className="text-[11px] text-encre-attention">
              et {alerte.compte - 3} autre{alerte.compte - 3 > 1 ? "s" : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** « La dernière sortie » pour la forme « fichiers » — sous « Pas prêt ». */
export function DerniereSortie({ apercu }: { apercu: ApercuDeSortie | null }) {
  return (
    <div className="flex flex-col gap-[4px] border-t border-trait pt-[14px]">
      <Intitule enfants="la dernière sortie" />
      {apercu?.precedente ? (
        <>
          <span className="text-[12.5px] text-encre-2">
            {quand(apercu.precedente.le)}
          </span>
          <span className="mesure text-[11.5px] text-encre-4">
            {apercu.precedente.compte} fichiers · {poids(apercu.precedente.octets)}
          </span>
        </>
      ) : (
        <span className="text-[12px] text-encre-4">
          Ce jeu n'est jamais sorti. Tout sera nouveau.
        </span>
      )}
    </div>
  )
}

/** Rangement, écrasement, moteur — **repliés**, quand la forme est
 *  « Fichiers » (`RV8`, §4). Le rangement et l'écrasement ne concernent que
 *  cette forme-là ; le paquet Godot a ses propres décisions (`RP10`), au fil
 *  de l'arbre. */
export function ReglagesFichiersReplies({
  reglages,
  rangement,
  onRangement,
  collision,
  onCollision,
  moteur,
  onMoteur,
  comptes,
}: {
  reglages: ReglagesDeLaSortie | null
  rangement: string
  onRangement: (v: string) => void
  collision: string
  onCollision: (v: string) => void
  moteur: string
  onMoteur: (v: string) => void
  comptes: Record<string, number>
}) {
  return (
    <details className="rounded-7 border border-trait bg-carte p-[8px]">
      <summary className="cursor-pointer text-[12.5px] text-encre-controle">
        Rangement, écrasement et moteur
      </summary>
      <div className="flex flex-col gap-[8px] pt-[8px]">
        <Bloc titre="Comment ça se range">
          <Segmente
            nom="Comment ça se range"
            valeurs={reglages?.rangements ?? []}
            choisie={rangement}
            onChoisir={onRangement}
          />
          <Raison
            enfants={
              "En dossiers range par famille — un mot que tu as posé, pas" +
              " une arborescence que l'atelier invente."
            }
          />
        </Bloc>
        <Bloc titre="Ce qui existe déjà là-bas">
          <div role="radiogroup" aria-label="Ce qui existe déjà là-bas">
            {(reglages?.collisions ?? []).map((valeur) => (
              <Choix
                key={valeur}
                nom={MOTS[valeur] ?? valeur}
                choisi={collision === valeur}
                compte={
                  valeur === "remplacer" && comptes.remplace
                    ? String(comptes.remplace)
                    : valeur === "effacer" && comptes.reste
                      ? String(comptes.reste)
                      : undefined
                }
                onChoisir={() => onCollision(valeur)}
              />
            ))}
          </div>
          <Raison
            enfants={
              "Effacer ne retire que ce que la sortie précédente avait posé ici." +
              " Un fichier que tu as mis là n'est jamais touché."
            }
          />
        </Bloc>
        <Bloc titre="Pour quel moteur">
          <Segmente
            nom="Pour quel moteur"
            valeurs={(reglages?.moteurs ?? []).filter((m) => m !== "godot")}
            choisie={moteur}
            onChoisir={onMoteur}
          />
          <Raison
            enfants={
              moteur === "unity"
                ? "Unity n'a pas de catalogue en texte qu'on dépose dans un dossier : ce fichier-ci se lit par un petit script d'éditeur."
                : moteur === "aucun"
                  ? "Des PNG et un descriptif — ce que l'atelier écrit depuis toujours."
                  : "Un fichier de plus, à côté du descriptif, que le moteur charge seul."
            }
          />
        </Bloc>
      </div>
    </details>
  )
}
