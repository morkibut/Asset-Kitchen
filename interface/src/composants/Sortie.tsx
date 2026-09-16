/**
 * La sortie — **un seul écran, et il dit ce qu'il va écrire avant de l'écrire**.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Sortie.dc.html`. Il remplace quatre boutons
 * posés à quatre endroits : exporter une sélection de la galerie, exporter un
 * personnage, exporter ses animations, exporter une bande. Aucun des quatre ne
 * disait quels fichiers allaient sortir, et aucun ne savait ce qu'il avait
 * écrit la fois d'avant.
 *
 * ⚠️ **Depuis `RP17`, « remplace » est vrai pour celui qui écrivait dans le jeu.**
 * Le bouton de la fiche d'un sujet posait les fichiers sur le disque tout de
 * suite ; il est parti, et *un seul sujet* — premier bloc — fait le même geste
 * en le montrant d'abord. Les trois autres rendaient une archive au navigateur,
 * pas une écriture : ils restent où ils sont.
 *
 * **Trois colonnes.** À gauche, cinq blocs numérotés qui se lisent de haut en
 * bas comme une phrase — ce qui sort, où, comment ça se range, ce qu'on fait de
 * ce qui est déjà là, pour quel moteur — et le bouton qui porte le compte exact
 * et le poids. Au milieu, l'arbre des fichiers avec leurs vrais noms, en trois
 * marques. À droite, ce qui n'est pas prêt, et tout en bas la date de la sortie
 * précédente.
 *
 * **Cliquer ne coûte jamais** (`docs/DESIGN.md`, règle 1). Chaque changement de
 * réglage redemande un aperçu, et un aperçu ne touche pas au disque : il lit le
 * dossier de destination pour comparer, et c'est tout. On peut donc tourner les
 * cinq boutons sans rien risquer, ce qui est exactement le point de l'écran.
 *
 * **Aucune des cinq listes n'est écrite ici.** Elles viennent du serveur, qui
 * les tient dans `atelier/domaine/sortie.py` : l'écran ne peut donc pas
 * proposer une valeur qu'on refuserait, et un moteur de plus paraît sans qu'une
 * ligne de ce fichier bouge. Ce qui vit ici, ce sont **les mots** — le serveur
 * envoie `en_dossiers`, l'écran écrit *en dossiers*.
 *
 * ⚠️ **« Choisir… » n'existe pas, et c'est dit plutôt que dessiné.** La planche
 * pose un bouton de sélection de dossier à côté du chemin ; aucun navigateur ne
 * donne le chemin d'un dossier à une page web, et `Installation.tsx` porte déjà
 * la même absence pour la même raison. Le chemin se tape, et la ligne en
 * dessous dit ce qui se passe s'il n'existe pas encore.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  api,
  Refus,
  type ApercuDeSortie,
  type BilanDeSortie,
  type FichierDeSortie,
  type ReglagesDeLaSortie,
} from "../api"

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
  // 1 · Ce qui sort
  tout: "Tout le jeu",
  personnages: "les personnages",
  objets: "les objets",
  decors: "les décors",
  interface: "l'interface",
  animations: "Les animations",
  // 3 · Comment ça se range
  a_plat: "à plat",
  en_dossiers: "en dossiers",
  // 4 · Ce qui existe déjà là-bas
  remplacer: "Remplacer",
  numeroter: "Garder les deux, numéroter",
  arreter: "S'arrêter s'il y a un doublon",
  effacer: "Effacer ce qui ne sort plus",
  // 5 · Pour quel moteur
  aucun: "aucun",
  godot: "Godot",
  unity: "Unity",
  phaser: "Phaser",
}

/** Ce qu'une marque dit, et de quelle encre. **Trois couleurs, pas quatre** :
 *  vert ce qui arrive, rouille ce qui écrase, gris ce qui ne bouge pas. Le
 *  quatrième — ce qui part — est un échec, parce qu'effacer est le seul geste
 *  de cet écran qui retire quelque chose. */
const MARQUES: Record<string, { mot: string; encre: string }> = {
  nouveau: { mot: "nouveau", encre: "text-encre-ok" },
  remplace: { mot: "remplace", encre: "text-signal" },
  inchange: { mot: "inchangé", encre: "text-encre-4" },
  reste: { mot: "à effacer", encre: "text-echec" },
}

/** Ce que chaque alerte annonce, en tête de son bloc. Le compte vient du
 *  serveur ; la phrase aussi. Ce qui est ici est le titre, qui accorde le
 *  chiffre. */
const ALERTES: Record<string, (compte: number) => string> = {
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

function Intitule({ enfants }: { enfants: string }) {
  return (
    <span className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {enfants}
    </span>
  )
}

/** La raison d'un bloc — une phrase qui dit la conséquence, jamais la règle. */
function Raison({ enfants }: { enfants: ReactNode }) {
  return (
    <p className="text-[11.5px] leading-[1.45] text-encre-4">{enfants}</p>
  )
}

/** Un segmenté : les valeurs côte à côte, une seule allumée. */
function Segmente({
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
function Choix({
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

// ── L'écran ─────────────────────────────────────────────────────────────────

export function Sortie({
  projet,
  onFerme,
  onErreur,
}: {
  projet: string | null
  onFerme: () => void
  /** Un refus du serveur remonte tel quel — l'écran n'invente aucun message. */
  onErreur?: (refus: Refus) => void
}) {
  const [reglages, setReglages] = useState<ReglagesDeLaSortie | null>(null)
  const [lot, setLot] = useState("tout")
  /** Un seul sujet, choisi dans la même liste que les lots (`RP17`). Vide, le
   *  lot décide ; posé, il emporte ce sujet-là en entier. */
  const [sujet, setSujet] = useState("")
  const [dossier, setDossier] = useState("")
  const [rangement, setRangement] = useState("a_plat")
  const [collision, setCollision] = useState("remplacer")
  const [moteur, setMoteur] = useState("aucun")
  const [apercu, setApercu] = useState<ApercuDeSortie | null>(null)
  const [filtre, setFiltre] = useState<"change" | "tout">("tout")
  const [bilan, setBilan] = useState<BilanDeSortie | null>(null)
  const [encours, setEncours] = useState(false)

  useEffect(() => {
    let vivant = true
    api
      .reglagesDeLaSortie(projet)
      .then((lus) => {
        if (!vivant) return
        setReglages(lus)
        setDossier(lus.dossier)
      })
      .catch((panne) => onErreur?.(panne as Refus))
    return () => {
      vivant = false
    }
  }, [projet, onErreur])

  const reglage = useMemo(
    () => ({ projet, lot, dossier, rangement, collision, moteur, sujet }),
    [projet, lot, dossier, rangement, collision, moteur, sujet],
  )

  /** L'aperçu se redemande à chaque réglage. **Il ne coûte rien** : ni réseau,
   *  ni disque écrit — le serveur lit le dossier de destination et compare. */
  useEffect(() => {
    let vivant = true
    api
      .prevoirLaSortie(reglage)
      .then((vu) => {
        if (vivant) setApercu(vu)
      })
      .catch((panne) => onErreur?.(panne as Refus))
    return () => {
      vivant = false
    }
  }, [reglage, onErreur])

  const sortir = useCallback(() => {
    setEncours(true)
    api
      .sortir(reglage)
      .then((fait) => {
        setBilan(fait)
        // **Le compte rendu ne remplace pas l'arbre** : on refait un aperçu, et
        // tout doit s'y lire « inchangé ». C'est la vérification que l'auteur
        // fait de toute façon en rouvrant son dossier.
        return api.prevoirLaSortie(reglage).then(setApercu)
      })
      .catch((panne) => onErreur?.(panne as Refus))
      .finally(() => setEncours(false))
  }, [reglage, onErreur])

  const comptes = apercu?.comptes ?? {}
  const montres =
    filtre === "tout"
      ? (apercu?.fichiers ?? [])
      : (apercu?.fichiers ?? []).filter((f) => f.marque !== "inchange")
  const groupes = useMemo(() => parDossier(montres), [montres])
  const inactif = encours || !apercu || apercu.refus !== "" || apercu.compte === 0

  return (
    <div
      data-ecran-de-sortie
      className="flex min-h-0 flex-1 gap-[14px] overflow-hidden p-[30px]"
    >
      {/* ── À gauche — les cinq blocs, et le bouton ────────────────────── */}
      <div className="defile flex w-[380px] shrink-0 flex-col overflow-y-auto">
        <h1 className="font-serif text-[38px] leading-[1.1] text-encre">
          Livrer au jeu
        </h1>
        <p className="pt-[8px] text-[13px] leading-[1.5] text-encre-2">
          Ce qui sort du jeu, où ça va, et ce qui a changé depuis la dernière
          fois.
        </p>

        <Bloc titre="1 · Ce qui sort">
          <div role="radiogroup" aria-label="Ce qui sort">
            {(reglages?.lots ?? []).map((valeur) => (
              <Choix
                key={valeur}
                nom={MOTS[valeur] ?? valeur}
                decale={valeur !== "tout" && valeur !== "animations"}
                choisi={sujet === "" && lot === valeur}
                onChoisir={() => {
                  setSujet("")
                  setLot(valeur)
                }}
              />
            ))}
            {/* **Un seul sujet, et il prend la place du lot** (`RP17`) : la
                fiche d'un sujet avait son propre bouton de sortie, qui écrivait
                sans rien montrer. Il est ici, au-dessus du même arbre. */}
            {(reglages?.sujets ?? []).length > 0 && (
              <Choix
                nom="Un seul sujet"
                choisi={sujet !== ""}
                onChoisir={() =>
                  setSujet(sujet || (reglages?.sujets[0]?.identifiant ?? ""))
                }
              />
            )}
          </div>
          {sujet !== "" && (
            <select
              aria-label="Lequel"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              className="ml-[22px] h-[30px] max-w-full self-start rounded-7 border border-contour bg-carte px-[8px] text-[12.5px] text-encre outline-none focus:border-encre-4"
            >
              {(reglages?.sujets ?? []).map((s) => (
                <option key={s.identifiant} value={s.identifiant}>
                  {s.nom}
                </option>
              ))}
            </select>
          )}
          <Raison
            enfants={
              sujet !== ""
                ? "Ses images et ses animations, tout ce qu'il a. Le reste du jeu ne sort pas."
                : "Les calques d'équipement suivent leur corps : un calque seul dans" +
                  " un dossier de jeu ne se pose sur rien."
            }
          />
        </Bloc>

        <Bloc titre="2 · Où">
          <input
            aria-label="Le dossier du jeu"
            value={dossier}
            onChange={(e) => setDossier(e.target.value)}
            placeholder="D:\jeux\mon-jeu\assets"
            className="mesure h-[34px] w-full rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
          />
          <Raison
            enfants={
              "Gardé avec ce jeu-ci : deux jeux ouverts tour à tour ne se" +
              " déposent plus au même endroit. Le chemin se tape — aucun" +
              " navigateur ne donne le chemin d'un dossier à une page. S'il" +
              " n'existe pas, il sera créé."
            }
          />
        </Bloc>

        <Bloc titre="3 · Comment ça se range">
          <Segmente
            nom="Comment ça se range"
            valeurs={reglages?.rangements ?? []}
            choisie={rangement}
            onChoisir={setRangement}
          />
          <Raison
            enfants={
              "En dossiers range par famille — un mot que vous avez posé, pas" +
              " une arborescence que l'atelier invente."
            }
          />
        </Bloc>

        <Bloc titre="4 · Ce qui existe déjà là-bas">
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
                onChoisir={() => setCollision(valeur)}
              />
            ))}
          </div>
          <Raison
            enfants={
              "Effacer ne retire que ce que la sortie précédente avait posé ici." +
              " Un fichier que vous avez mis là n'est jamais touché."
            }
          />
        </Bloc>

        <Bloc titre="5 · Pour quel moteur">
          <Segmente
            nom="Pour quel moteur"
            valeurs={reglages?.moteurs ?? []}
            choisie={moteur}
            onChoisir={setMoteur}
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

        <div className="flex flex-col gap-[8px] pt-[22px]">
          <button
            type="button"
            data-sortir
            disabled={inactif}
            onClick={sortir}
            className="h-[34px] shrink-0 rounded-7 bg-signal text-[13px] text-encre-sur-signal transition-colors duration-120 disabled:opacity-60"
          >
            {encours
              ? "…"
              : `Livrer ${apercu?.compte ?? 0} fichier${(apercu?.compte ?? 0) > 1 ? "s" : ""} ›`}
          </button>
          <p className="text-center text-[11.5px] text-encre-4">
            {apercu?.refus
              ? apercu.refus
              : `${poids(apercu?.octets ?? 0)} · rien ne part sur le réseau`}
          </p>
        </div>
      </div>

      {/* ── Au milieu — l'arbre ────────────────────────────────────────── */}
      <div className="defile flex min-w-0 flex-1 flex-col overflow-y-auto">
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
                onClick={() => setFiltre(cle)}
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
            // **La raison n'est pas répétée ici.** Elle est sous le bouton,
            // qui est l'endroit où l'on va cliquer — la dire deux fois ferait
            // douter qu'il s'agisse du même empêchement.
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

        {bilan && (
          <p
            role="status"
            className="mt-[14px] rounded-8 border border-trait-ok bg-fond-ok p-[14px] text-[12px] leading-[1.5] text-encre-ok"
          >
            {bilan.compte} fichier{bilan.compte > 1 ? "s" : ""} posé
            {bilan.compte > 1 ? "s" : ""} dans {bilan.dossier}.{" "}
            {bilan.inchanges > 0 && `${bilan.inchanges} n'ont pas bougé. `}
            {bilan.effaces.length > 0 &&
              `${bilan.effaces.length} effacé${bilan.effaces.length > 1 ? "s" : ""}. `}
            {bilan.catalogue && "Le catalogue du moteur est écrit."}
          </p>
        )}
      </div>

      {/* ── À droite — ce qui n'est pas prêt, et la fois d'avant ───────── */}
      <div className="defile flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto">
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

        <div className="mt-auto flex flex-col gap-[4px] border-t border-trait pt-[14px]">
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
          <button
            type="button"
            onClick={onFerme}
            className="mt-[8px] h-[30px] self-start rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[8px] border-b border-trait py-[14px]">
      <Intitule enfants={titre} />
      {children}
    </section>
  )
}

/** Une ligne de l'arbre : le nom, sa mesure, sa marque.
 *
 *  `entier` écrit le chemin complet plutôt que le seul nom. Il sert aux restes,
 *  qui ne sont rangés sous aucun dossier de l'arbre — sans lui, deux fichiers
 *  de dossiers différents portant le même nom se lisent comme un seul. */
function Ligne({
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
