/**
 * Les règles du jeu, en quatre étapes — B14.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Nouveau-jeu.dc.html`. Le nom, l'allure, la vue,
 * le monde : **ce parcours ne demande que ce qui part avec chaque demande
 * d'image, ou ce qui décide de la façon dont l'image est fabriquée.** C'est le
 * critère d'entrée de l'auteur, et il exclut tout le reste — la palette, les
 * natures, les poses, le détourage, la clé — qui se règle là où l'on s'en sert.
 *
 * ⚠️ **Un seul parcours, deux entrées, et c'est un critère d'acceptation.**
 * `mode="creation"` le déroule dans l'ordre avant qu'un jeu existe ;
 * `mode="reglages"` l'ouvre sur la liste des quatre, et l'on va droit à celle
 * qu'on veut reprendre. Ce sont **les mêmes écrans et les mêmes écritures** —
 * un seul chemin, pas deux formulaires qui divergeront au premier réglage
 * ajouté. C'est pour ça que ce fichier a un mode plutôt qu'un jumeau.
 *
 * **Deux écrans du produit prennent la fenêtre entière** (`docs/PLAN-carnet.md`
 * § Le châssis) : l'ouverture et le parcours de création. La réouverture, elle,
 * est un lieu ordinaire — `{ genre: "regles" }` — et le carnet reste visible à
 * côté. Les quatre étapes ne sont **pas** quatre lieux : elles sont un état de
 * cet écran, comme les onglets de `PageDuSujet.tsx`.
 *
 * ⚠️ **Le piège du `PUT /universe`, le même qu'en `B9.7`** : `bible` est
 * remplacée **en entier** dès que la clé est envoyée. L'étape du monde renvoie
 * donc toujours les sept cases — les cinq qu'elle montre, et les deux que
 * l'atelier écrit, dont le texte d'auteur devenu inerte qu'il ne faut pas
 * effacer au passage.
 *
 * **`rendu` et `vue` ne se tapent plus** (`CHAMPS_DE_L_ATELIER`, côté serveur).
 * C'est le cœur de la tranche : l'auteur pouvait écrire sa caméra dans la case
 * `vue` de la bible *et* choisir une vue ailleurs, et les deux partaient dans le
 * même envoi. Les deux lignes sont ici en lecture seule, avec l'étape qui les
 * remplit — et ce que l'auteur y avait tapé avant est montré barré plutôt que
 * jeté (`atelier.sans_effet`).
 *
 * **Le texte de caméra affiché est celui du serveur, au caractère près.** Il
 * vient de `api.vuesEtTailles()` — `phrase`, `contrainte`, `volume`, `corps` —,
 * qui sont littéralement les chaînes qui atteignent le fournisseur. Une
 * paraphrase serait devenue fausse au premier mot changé dans
 * `atelier/domaine/vue.py`, et rien ne l'aurait dit.
 *
 * **Ce que la planche dessine et qui n'a aucune route derrière** — non
 * construit, et nommé plutôt que caché, comme `B10` l'a fait pour « Recadrer » :
 * *Copier les règles d'un autre jeu* (rien ne copie un univers dans un autre),
 * et les comptes « 1 jeu sur 6 » sous les styles et les méthodes
 * (`GET /universe` ne sert que le jeu ouvert ; les compter demanderait de rouvrir
 * les autres un par un). *Une commande que rien n'appelle est une ligne morte.*
 *
 * ── `C2` · ce que l'assistant savait faire, et où c'est parti ───────────────
 *
 * `Assistant.tsx` (3 258 lignes) était **le doublon vrai de ce fichier** : les
 * deux écrivaient `api.reglerUnivers`, et les deux réglaient le nom, le style,
 * la vue et la taille. Il est parti avec `C2`. Ses douze étapes, une par une,
 * et ce qu'elles sont devenues — **rien n'a été perdu en silence** :
 *
 * | L'étape de l'assistant | Où elle est maintenant |
 * |---|---|
 * | 1 · Le nom | ici, étape « Son nom » — le seul endroit qui crée ou renomme |
 * | 2 · Le style | ici, étape « Son allure » |
 * | 3 · La vue | ici, étape « Sa vue » |
 * | 4 · La taille / la finesse | ici, étape « Son allure » |
 * | 5 · Les types d'objets (barème d'échelles) | `ReglagesDeFamille.tsx`, table 1 — les natures se règlent dans la famille qui les porte |
 * | 6 · L'allure (les cinq cases de la bible) | ici, étape « Son monde » |
 * | 7a · Références et couleurs (le nombre de couleurs) | **relogé ici**, étape « Son allure » — il part avec chaque demande d'image, donc il passe le critère d'entrée du parcours |
 * | 7b · La couleur de fond du jeu | **relogé ici**, étape « Son allure » — même raison, et l'assistant en était le seul écrivain. `ReglesDAilleurs` la renvoyait à « l'atelier Détourer », qui ne l'a jamais écrite : le renvoi était faux, il est retiré |
 * | 7c · Le texte à copier dans un outil d'images | **retiré.** Il assemblait une description à coller ailleurs pour récupérer des images d'inspiration à la main. La toile de l'univers reçoit ces images par collage ou par dépôt, sans passer par un texte que personne ne relit ; et le parcours neuf montre déjà la description assemblée, étape « Son monde » |
 * | 8 · Poses et états | `ReglagesDeFamille.tsx`, table 2 — le plan de poses est propre à chaque nature |
 * | 9 · Emplacements de corps | `ReglagesDeFamille.tsx`, table 3a — famille personnages |
 * | 10a · Le modèle de chaque famille | `ReglagesDeFamille.tsx`, table 3b |
 * | 10b · `modele_planche` et `modele_edition` | **retirés.** Deux surcharges pour deux gestes rares — un lot d'attitudes qui part, un corps qui se retouche. Sans elles le catalogue décide, ce qui est déjà la règle écrite partout ailleurs (« le catalogue décide du reste »), et la fiche de chaque image dit quel modèle a servi. Un troisième endroit qui règle un modèle aurait été le défaut que cette tranche répare |
 * | 11 · Le détourage de départ | `Retouche.tsx` — il y pose le défaut de la nature *et* celui de la famille, depuis la passe qu'on vient de régler sur une vraie image |
 * | 12 · Les fournisseurs (le tiroir des clés) | `Installation.tsx`, étape « Les images » ; le tiroir lui-même est `BlocSecrets`, plus bas dans ce fichier, monté par l'onglet *Moteurs & workflows* de `Reglages.tsx` (`RP2`) |
 *
 * Et deux choses qui n'étaient pas des étapes :
 *
 * * **Le pied qui numérotait chaque écran** — le rang sur douze, `‹ Retour`,
 *   `Continuer →`. Retiré : ce parcours-ci a le sien, sur quatre écrans au lieu
 *   de douze.
 * * **Le réalignement de tout le projet** (`api.realigner()` sans cible), qui
 *   vivait dans le pied de l'écran Univers et n'était appelé que par
 *   l'assistant. **Relogé ici**, étape « Son allure », à côté du nombre de
 *   couleurs : réaligner, c'est reposer la palette et la grille, donc l'allure.
 *   `Fiche.tsx` garde le réalignement d'une seule image.
 *
 * **Ce que l'assistant savait faire de mieux et qu'on ne reprend pas** : il
 * enchaînait ses douze étapes dans un ordre imposé, sur un jeu neuf. Ce
 * parcours-ci fait la même chose sur quatre — `mode="creation"` —, et les huit
 * autres se règlent là où l'on s'en sert, quand on s'en sert. C'est le choix
 * de `B14`, pas une perte.
 *
 * **Ce que la planche annonce comme manquant et qui existe** : les étiquettes.
 * Elle écrit « à ajouter — les étiquettes n'existent pas » ; elles sont dans le
 * dépôt depuis le 1ᵉʳ septembre 2026, soixante-dix livrées rangées par case
 * (`GET /api/labels`). La planche est en retard sur le code, comme celle de
 * l'atelier d'animation l'était déjà.
 */

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AUCUNE_CIBLE,
  CE_QUE_LA_METHODE_REND,
  NOM_CHAMP,
  NOM_DE_LA_METHODE,
  Refus,
  api,
  dollars,
  estArgent,
  paliersDeCouleurs,
  quantite,
  type CeQueLAtelierEcrit,
  type Champ,
  type EtatAgent,
  type EtatSecret,
  type Etiquette,
  type FondPropose,
  type GardeFous,
  type Methode,
  type Modele,
  type Style,
  type TailleDImage,
  type Tiroir,
  type Univers,
  type VueDuJeu,
} from "../api"
import { workflows, type MoteurParFamille, type ProfilWorkflow } from "../api-workflows"
import { Bouton, Curseur, Libelle, Raison, libelleModele } from "./pieces"
import { nomDuModele } from "./Fiche"
import { nomMoteurSonore } from "./WorkflowsLocaux"
import { BlocDirectionsAnimees, BlocMouvements, BlocStyles } from "./Mouvements"

// ── Les quatre étapes ────────────────────────────────────────────────────────

export type Etape = "nom" | "allure" | "vue" | "monde" | "son"

/** L'ordre est fermé et il ne se négocie pas : c'est celui de la planche, et
 *  c'est aussi celui des dépendances — l'allure décide de ce que « la taille »
 *  veut dire, la vue décide du nombre de directions, et le monde lit les deux.
 *
 *  **« Ses sons » ferme la marche** (SN2, `docs/archi-son.md` §4.2) : le même
 *  geste que « Son monde », pour l'oreille — on décrit le son, l'univers ajoute
 *  le style. Elle passe le même critère d'entrée que les quatre autres : ce
 *  bloc part avec chaque demande de son. */
const ETAPES: readonly { clef: Etape; titre: string; question: string }[] = [
  { clef: "nom", titre: "Son nom", question: "Comment s'appelle ce jeu ?" },
  { clef: "allure", titre: "Son allure", question: "Quelle allure a ce jeu ?" },
  { clef: "vue", titre: "Sa vue", question: "D'où regarde-t-on ce jeu ?" },
  { clef: "monde", titre: "Son monde", question: "De quoi ce monde est-il fait ?" },
  { clef: "son", titre: "Ses sons", question: "Comment sonne ce monde ?" },
]

/** Quelle étape remplit chacune des deux cases que l'atelier écrit — c'est ce
 *  que la ligne en lecture seule affiche à droite, pour qu'on sache où aller. */
const ETAPE_DE_LA_CASE: Record<string, { clef: Etape; nom: string }> = {
  rendu: { clef: "allure", nom: "son allure" },
  vue: { clef: "vue", nom: "sa vue" },
}

/** Le dossier, tel que le serveur le dérivera du nom.
 *
 *  ⚠️ **Une prévisualisation, pas la règle.** La règle vit dans
 *  `atelier.domaine.projet.repere`, et elle seule décide — elle ajoute
 *  notamment le `-2` d'un dossier déjà pris, ce que l'écran ne peut pas savoir
 *  avant d'avoir demandé. On montre ici la dérivation du nom, qui est la partie
 *  stable et la seule que l'étape ait à expliquer : accents enlevés, minuscules,
 *  tirets. Le dossier réel s'affiche dès que le jeu existe, et c'est lui qui
 *  fait foi. */
export function dossierPrevu(nom: string): string {
  return (
    nom
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "projet"
  )
}

// ── Les pièces ───────────────────────────────────────────────────────────────

function Intitule({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

/** Une phrase qui explique une conséquence — jamais un ordre, jamais une
 *  personnification. Même rôle que `Raison` dans l'ancien assistant. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-8 border border-trait bg-papier-cote p-[14px] text-[12px] leading-[1.5] text-encre-2">
      {children}
    </p>
  )
}

function Alerte({ children }: { children: ReactNode }) {
  return (
    <p
      data-avertissement
      role="status"
      className="rounded-8 border border-trait-attention bg-fond-attention p-[14px] text-[12px] leading-[1.5] text-encre-attention"
    >
      {children}
    </p>
  )
}

/** Une carte qu'on choisit — le geste répété de l'allure et de la vue.
 *
 *  **`desactive`** (RT2) : la seule case du produit qui en a besoin est une
 *  méthode de pixelisation absente de la machine — `pixeloe` tire `torch`, et
 *  l'aperçu comme la fabrication partagent le même moteur (`apercu_allure.py`,
 *  en tête). Une méthode qu'on ne peut pas prévisualiser est une méthode que
 *  la fabrication ne rendrait pas non plus : la désactiver dit la vérité, elle
 *  ne cache pas une limite provisoire de l'écran. */
function Choix({
  titre,
  quoi,
  choisi,
  onChoisir,
  children,
  desactive = false,
}: {
  titre: string
  quoi: string
  choisi: boolean
  onChoisir: () => void
  children?: ReactNode
  desactive?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={choisi}
      aria-label={titre}
      disabled={desactive}
      onClick={onChoisir}
      className={[
        "flex h-full flex-col gap-[4px] rounded-8 border p-[14px] text-left transition-colors duration-120",
        desactive
          ? "cursor-not-allowed border-trait bg-papier-cote opacity-60"
          : choisi
            ? "border-signal bg-ligne-ouverte"
            : "border-trait bg-carte hover:border-encre-4",
      ].join(" ")}
    >
      {children}
      <span className="text-[13px] font-medium text-encre">{titre}</span>
      <span className="text-[11.5px] leading-[1.45] text-encre-3">{quoi}</span>
    </button>
  )
}

/** La vignette d'une vue ou d'un style. **Absente, elle le dit** — une image
 *  manquante ne casse pas l'étape, et le choix reste possible sur le titre. */
function Vignette({ fichier, alt }: { fichier: string; alt: string }) {
  const [absente, setAbsente] = useState(false)
  useEffect(() => setAbsente(false), [fichier])
  if (absente) {
    return (
      <span className="flex aspect-[4/3] w-full items-center justify-center rounded-5 border border-dashed border-pointille text-[11px] text-eteint">
        pas encore dessinée
      </span>
    )
  }
  return (
    <img
      src={`/vignettes/${fichier}.png`}
      alt={alt}
      onError={() => setAbsente(true)}
      className="aspect-[4/3] w-full rounded-5 bg-pourtour object-contain"
      // Au plus proche : une vignette de pixel art perdrait ses carrés si le
      // navigateur la lissait, et c'est très exactement ce qu'on compare.
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// ── Les vignettes calculées de « Son allure » (RT2) ──────────────────────────
//
// RT1 a ouvert `GET /universe/allure/preview.png` : le rôdeur réduit par une
// combinaison — taille, méthode, couleurs —, calculé par le même moteur que
// la vraie fabrication, et gardé sur le disque de l'atelier. Cette tranche
// branche les trois rangées dessus : jusqu'ici elles ne montraient que des
// mots, l'auteur veut « choisir en voyant ».

/** Les neuf tailles que la route sait rendre — **exactement** celles que le
 *  serveur propose pour cette grille (`atelier/services/apercu_allure.py`,
 *  `TAILLES_PERMISES`), pas les dix, plus larges, des jeux déjà fabriqués. Une
 *  taille hors de cette liste ne se demande jamais à la route : elle
 *  recevrait un refus systématique, pour un aperçu que rien n'affiche déjà. */
const TAILLES_APERCU = new Set<number>([8, 16, 24, 32, 48, 64, 96, 128, 256])

/** Une combinaison déjà vue ne se redemande pas pendant que l'onglet reste
 *  ouvert : le disque de l'atelier la garde déjà (RT1), mais épargner
 *  l'aller-retour réseau garde la rangée réactive quand on revient sur une
 *  taille déjà vue. Les images sont petites — rien ne justifie de les
 *  libérer avant la fermeture de l'onglet. */
const CACHE_APERCU_ALLURE = new Map<string, Promise<string>>()

/** Réservé aux essais : sans ce vidage entre deux montages, un refus vu dans
 *  un essai — la méthode absente qu'on simule — resterait mémorisé pour le
 *  suivant, qui verrait alors le refus d'avant plutôt que sa propre machine
 *  doublée. */
export function _reinitialiserCacheApercuAllurePourEssais(): void {
  CACHE_APERCU_ALLURE.clear()
}

function chargerApercuAllure(taille: number, methode: string, couleurs: number): Promise<string> {
  const cle = `${taille}-${methode}-${couleurs}`
  let promesse = CACHE_APERCU_ALLURE.get(cle)
  if (!promesse) {
    promesse = api.apercuAllure(taille, methode, couleurs).then((octets) => URL.createObjectURL(octets))
    // Un refus ne se garde pas : la méthode absente aujourd'hui peut
    // s'installer pendant que l'onglet reste ouvert, et le prochain rendu
    // doit la redemander plutôt que répéter indéfiniment le refus d'avant.
    promesse.catch(() => CACHE_APERCU_ALLURE.delete(cle))
    CACHE_APERCU_ALLURE.set(cle, promesse)
  }
  return promesse
}

/** L'état d'une case : en attente, refusée — nommée, jamais muette —, ou son
 *  image. **Chaque case a son propre appel** : neuf tailles, c'est neuf
 *  appels, et rien ici ne bloque `onChoisir` pendant qu'ils arrivent — la
 *  rangée reste utilisable avant que tout soit calculé. `taille` à `null`
 *  n'appelle rien : c'est le cas d'« aucune » taille imposée, ou d'une taille
 *  hors de ce que la route sait rendre. */
function useApercuAllure(
  taille: number | null,
  methode: string,
  couleurs: number,
): { url: string | null; refus: string | null; enAttente: boolean } {
  const [etat, setEtat] = useState<{ url: string | null; refus: string | null; enAttente: boolean }>(
    { url: null, refus: null, enAttente: taille !== null },
  )

  useEffect(() => {
    if (taille === null) {
      setEtat({ url: null, refus: null, enAttente: false })
      return
    }
    let vivant = true
    setEtat({ url: null, refus: null, enAttente: true })
    chargerApercuAllure(taille, methode, couleurs)
      .then((url) => vivant && setEtat({ url, refus: null, enAttente: false }))
      .catch(
        (e: unknown) =>
          vivant &&
          setEtat({
            url: null,
            refus: e instanceof Refus ? e.message : "l'aperçu n'a pas pu être calculé",
            enAttente: false,
          }),
      )
    return () => {
      vivant = false
    }
  }, [taille, methode, couleurs])

  return etat
}

/** L'image elle-même, ou un aplat qui respire pendant le calcul — jamais un
 *  vide qui laisserait croire que la case n'aura jamais rien. */
function VisuelApercu({
  url,
  alt,
}: {
  url: string | null
  alt: string
}) {
  return (
    <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-5 bg-pourtour">
      {url ? (
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-contain"
          // Au plus proche, comme `Vignette` : un aperçu de pixel art perdrait
          // ses carrés si le navigateur le lissait, et c'est très exactement
          // ce que la case compare.
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span aria-hidden className="h-full w-full animate-pulse bg-papier-cote" />
      )}
    </span>
  )
}

/** Une case refusée — nommée dans le texte qui l'accompagne, jamais laissée
 *  vide ni cassée. */
function EmplacementRefuse({ children }: { children: ReactNode }) {
  return (
    <span className="flex aspect-[4/3] w-full items-center justify-center rounded-5 border border-dashed border-pointille p-[4px] text-center text-[10.5px] leading-[1.3] text-eteint">
      {children}
    </span>
  )
}

/** La vignette d'une case de taille ou de couleurs — jamais désactivée : ces
 *  deux réglages restent valides même quand l'aperçu qui les illustre a
 *  échoué, à la différence d'une méthode absente de la machine (`CaseMethode`,
 *  juste dessous). */
function CaseApercu({
  taille,
  methode,
  couleurs,
  alt,
}: {
  taille: number | null
  methode: string
  couleurs: number
  alt: string
}) {
  const { url, refus } = useApercuAllure(taille, methode, couleurs)
  return refus ? <EmplacementRefuse>aperçu indisponible</EmplacementRefuse> : <VisuelApercu url={url} alt={alt} />
}

/** Une case de la rangée des méthodes : sa vignette, et son choix se ferme
 *  s'il n'y a rien à en montrer. Voir la note de `Choix` sur `desactive`. */
function CaseMethode({
  methode,
  taille,
  couleurs,
  choisi,
  onChoisir,
}: {
  methode: Methode
  taille: number | null
  couleurs: number
  choisi: boolean
  onChoisir: () => void
}) {
  const { url, refus } = useApercuAllure(taille, methode, couleurs)
  return (
    <Choix
      titre={NOM_DE_LA_METHODE[methode]}
      quoi={refus ?? CE_QUE_LA_METHODE_REND[methode]}
      choisi={choisi}
      onChoisir={onChoisir}
      desactive={Boolean(refus)}
    >
      {refus ? (
        <EmplacementRefuse>pas sur cette machine</EmplacementRefuse>
      ) : (
        <VisuelApercu url={url} alt={`Le rôdeur réduit par « ${NOM_DE_LA_METHODE[methode]} »`} />
      )}
    </Choix>
  )
}

// ── L'étape « Son nom » ──────────────────────────────────────────────────────

function SonNom({
  mode,
  nom,
  onNom,
  dossier,
  avertissement,
}: {
  mode: Mode
  nom: string
  onNom: (nom: string) => void
  /** Le dossier réel quand le jeu existe ; sinon, celui que le nom laisse
   *  prévoir. Les deux se distinguent à l'écran : l'un est un fait, l'autre
   *  une prévision. */
  dossier: string | null
  avertissement: string
}) {
  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Le nom se change quand on veut. Le dossier, non — alors il vaut mieux le
        voir tout de suite.
      </p>

      <label className="flex flex-col gap-[4px]">
        <Intitule>Le nom du jeu</Intitule>
        <input
          value={nom}
          onChange={(e) => onNom(e.target.value)}
          placeholder="Le Marais du Vieux Moulin"
          aria-label="Le nom du jeu"
          className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
        />
        <span className="text-[11.5px] text-encre-4">
          Il s'affiche en haut du carnet, et se change quand on veut.
        </span>
      </label>

      <div className="flex flex-col gap-[4px]">
        <Intitule>Son dossier sur le disque</Intitule>
        <span
          data-dossier-du-jeu
          className="mesure flex h-[34px] items-center truncate rounded-7 border border-trait bg-papier-cote px-[14px] text-[12.5px] text-encre-4"
        >
          {/* **Rien tant que rien n'est tapé.** Vu au navigateur : le champ
              vide affichait `projet`, qui est le repli du serveur pour un nom
              sans une seule lettre — un dossier annoncé que personne n'aura
              jamais, puisque le bouton est éteint tant que le nom est vide. */}
          {dossier ?? (nom.trim() ? dossierPrevu(nom) : "")}
        </span>
        <span className="text-[11.5px] leading-[1.45] text-encre-4">
          {dossier
            ? "Calculé du nom à la création : accents enlevés, minuscules, tirets. Il ne changera plus jamais, même si le nom change."
            : "Il se calculera du nom : accents enlevés, minuscules, tirets. C'est là que les images iront se ranger, et il ne changera plus jamais."}
        </span>
      </div>

      {avertissement && <Alerte>{avertissement}</Alerte>}

      <Note>
        {mode === "creation"
          ? "On peut s'arrêter ici : un jeu créé sans rien régler fonctionne, avec les valeurs de l'atelier. Rien de ce parcours ne coûte quoi que ce soit — la première dépense arrive quand on demande la première image."
          : "Le nom se change ici ; le dossier reste celui de la création. Renommer ne déplace aucun fichier et ne change aucune image."}
      </Note>
    </div>
  )
}

// ── L'étape « Son allure » ───────────────────────────────────────────────────

const STYLES: readonly { cle: Style; titre: string; quoi: string }[] = [
  { cle: "pixel", titre: "Pixel", quoi: "Chaque pixel se voit et se compte." },
  { cle: "dessin", titre: "Dessin", quoi: "Traits et aplats lisses, sans grille." },
]

const METHODES: readonly Methode[] = ["vote", "pixeloe", "lanczos", "proche"]

function SonAllure({
  univers,
  tailles,
  finesses,
  fondPropose,
  retourDuRealignement,
  onRegler,
  onRealigner,
}: {
  univers: Univers
  tailles: TailleDImage[]
  finesses: TailleDImage[]
  /** **Ce que l'atelier proposerait comme fond à ce jeu-là** (D3), calculé par
   *  le serveur — `null` tant qu'aucun univers n'a été lu. Il arrive par le GET
   *  et il est rafraîchi par chaque PUT : la couleur sûre dépend de la palette,
   *  et la palette bouge. */
  fondPropose: FondPropose | null
  retourDuRealignement: string | null
  onRegler: (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
  onRealigner: () => void
}) {
  const enPixel = univers.style === "pixel"
  const echelle = enPixel ? tailles : finesses
  const posee = echelle.find((t) => t.cible === univers.cible_px) ?? null
  const paliers = paliersDeCouleurs(univers.cible_px)
  const fondPose = univers.fond !== ""

  // **La taille à passer à la route d'aperçu** (RT2) : `null` quand aucune
  // n'est imposée, ou quand la taille posée dépasse ce que la route sait
  // rendre — les deux rangées du dessous se contentent alors de leur case
  // sans image plutôt que d'un refus systématique.
  const tailleApercu = TAILLES_APERCU.has(univers.cible_px) ? univers.cible_px : null
  // **Le nombre de couleurs à illustrer sur la rangée des méthodes** : celui
  // posé quand il tient sur la taille courante, sinon le plus haut palier
  // qu'elle porte — la même règle que l'écran applique déjà pour ne jamais
  // demander une combinaison hors barème.
  const couleursPourApercu = paliers.includes(univers.couleurs) ? univers.couleurs : paliers[paliers.length - 1]
  /** Le nombre de couleurs à illustrer sur une case de la rangée des
   *  **tailles** — chaque taille candidate a son propre plafond de couleurs,
   *  qui n'est pas forcément celui de la taille posée. */
  const couleursPourTaille = (cible: number): number => {
    const p = paliersDeCouleurs(cible)
    return p.includes(univers.couleurs) ? univers.couleurs : p[p.length - 1]
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="max-w-[880px] text-[13px] leading-[1.55] text-encre-2">
        Le style commande le reste : en pixel on choisit une taille de case et
        une façon de réduire, en dessin ces deux-là disparaissent et une finesse
        les remplace. Ce choix part avec chaque demande d'image.
      </p>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Le style</Intitule>
        <div className="grid grid-cols-2 gap-[14px] lg:max-w-[880px]">
          {STYLES.map(({ cle, titre, quoi }) => (
            <Choix
              key={cle}
              titre={titre}
              quoi={quoi}
              choisi={univers.style === cle}
              onChoisir={() => void onRegler({ style: cle })}
            >
              <Vignette fichier={`style-${cle}`} alt="" />
            </Choix>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-[8px]">
        <Intitule>
          {enPixel
            ? "La taille — le côté de l'image, en pixels"
            : "La finesse — combien de détail le fichier garde"}
        </Intitule>
        {/* **En pixel, chaque case montre le rôdeur à cette taille-là**
            (RT2) : une image, pas un nombre nu, à la méthode et au nombre de
            couleurs déjà posés. **En dessin, aucune vignette** — la finesse
            ne pixelise ni ne quantifie rien, un aperçu construit sur cette
            route-là mentirait sur ce que le style rend vraiment (« aperçu
            orphelin », critère d'acceptation RT2) : la rangée reste des
            boutons nus, comme avant. */}
        {enPixel ? (
          <div
            data-echelle-du-jeu
            className="grid grid-cols-3 gap-[8px] sm:grid-cols-5 xl:grid-cols-9"
            role="group"
            aria-label="La taille de l'image"
          >
            {echelle.map(({ cible }) => (
              <Choix
                key={cible}
                titre={String(cible)}
                quoi=""
                choisi={univers.cible_px === cible}
                onChoisir={() => void onRegler({ cible_px: cible })}
              >
                {TAILLES_APERCU.has(cible) && (
                  <CaseApercu
                    taille={cible}
                    methode={univers.methode_pixels}
                    couleurs={couleursPourTaille(cible)}
                    alt={`Le rôdeur à ${cible} pixels de côté`}
                  />
                )}
              </Choix>
            ))}
            <button
              type="button"
              aria-pressed={univers.cible_px === AUCUNE_CIBLE}
              onClick={() => void onRegler({ cible_px: AUCUNE_CIBLE })}
              className={[
                "h-[30px] rounded-7 border px-[14px] text-[12.5px] transition-colors duration-120",
                univers.cible_px === AUCUNE_CIBLE
                  ? "border-signal bg-ligne-ouverte text-encre"
                  : "border-trait bg-carte text-encre-3 hover:border-encre-4",
              ].join(" ")}
            >
              aucune
            </button>
          </div>
        ) : (
          <div
            data-echelle-du-jeu
            className="flex flex-wrap gap-[4px]"
            role="group"
            aria-label="La finesse"
          >
            {echelle.map(({ cible }) => (
              <button
                key={cible}
                type="button"
                aria-pressed={univers.cible_px === cible}
                onClick={() => void onRegler({ cible_px: cible })}
                className={[
                  "mesure h-[30px] rounded-7 border px-[14px] text-[12.5px] transition-colors duration-120",
                  univers.cible_px === cible
                    ? "border-signal bg-ligne-ouverte text-encre"
                    : "border-trait bg-carte text-encre-3 hover:border-encre-4",
                ].join(" ")}
              >
                {cible}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={univers.cible_px === AUCUNE_CIBLE}
              onClick={() => void onRegler({ cible_px: AUCUNE_CIBLE })}
              className={[
                "h-[30px] rounded-7 border px-[14px] text-[12.5px] transition-colors duration-120",
                univers.cible_px === AUCUNE_CIBLE
                  ? "border-signal bg-ligne-ouverte text-encre"
                  : "border-trait bg-carte text-encre-3 hover:border-encre-4",
              ].join(" ")}
            >
              aucune
            </button>
          </div>
        )}
        <p className="text-[11.5px] leading-[1.45] text-encre-3">
          {posee
            ? `${posee.cible} — ${posee.quoi}`
            : "Aucune taille imposée : ce que le modèle rend entre tel quel."}
        </p>
      </section>

      {enPixel && (
        <section className="flex flex-col gap-[8px]">
          <Intitule>
            La pixelisation — comment la grande image devient {univers.cible_px || "N"}{" "}
            pixels
          </Intitule>
          <div className="grid grid-cols-2 gap-[14px] xl:grid-cols-4">
            {METHODES.map((m) => (
              <CaseMethode
                key={m}
                methode={m}
                taille={tailleApercu}
                couleurs={couleursPourApercu}
                choisi={univers.methode_pixels === m}
                onChoisir={() => void onRegler({ methode_pixels: m })}
              />
            ))}
          </div>
          <Note>
            Les quatre sont des partis pris, pas un classement. Changer de méthode
            et refaire la réduction se fait sur la machine, sans rien payer.
          </Note>
        </section>
      )}

      {/* ── Le nombre de couleurs (`C2`, relogé de l'assistant) ────────────
          **Le même réglage agit des deux côtés** : avec une palette il dit
          combien de teintes y lire, sans palette combien en garder sur chaque
          image. Il ne paraît qu'en pixel — un dessin garde ses nuances. */}
      {enPixel && (
        <section className="flex flex-col gap-[8px]">
          <Intitule>Les couleurs demandées</Intitule>
          <div
            data-couleurs-du-jeu
            className="grid grid-cols-3 gap-[8px] sm:grid-cols-6"
            role="group"
            aria-label="Les couleurs demandées"
          >
            {paliers.map((palier) => (
              <Choix
                key={palier}
                titre={String(palier)}
                quoi=""
                choisi={univers.couleurs === palier}
                onChoisir={() => void onRegler({ couleurs: palier })}
              >
                <CaseApercu
                  taille={tailleApercu}
                  methode={univers.methode_pixels}
                  couleurs={palier}
                  alt={`Le rôdeur avec ${palier} couleurs`}
                />
              </Choix>
            ))}
          </div>
          {/* **Le plafond est le côté du sprite, et il est mesuré** : au-delà,
              l'image ne contient plus assez de teintes distinctes pour remplir
              la palette demandée. Dit ici pour qu'une liste courte ne se lise
              pas comme une panne. */}
          <p className="text-[11.5px] leading-[1.45] text-encre-3">
            {paliers.length < 6
              ? `Une image de ${univers.cible_px} carrés de côté ne porte pas plus de ${paliers[paliers.length - 1]} couleurs — au-delà, l'image n'a plus assez de teintes distinctes.`
              : "Avec une palette, c'est le nombre de teintes à y lire ; sans palette, le nombre à garder sur chaque image."}
          </p>
          <button
            type="button"
            onClick={onRealigner}
            className="mesure h-[30px] w-fit rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre-2 transition-colors duration-120 hover:border-encre-4"
          >
            Réappliquer la palette à tout le jeu
          </button>
          {retourDuRealignement && (
            <p
              data-retour-du-realignement
              className="mesure text-[11.5px] text-encre-3"
            >
              {retourDuRealignement}
            </p>
          )}
          <Note>
            Le réalignement repose la palette et la grille sur les images déjà
            faites, en sautant les épinglées. Tout se passe sur la machine :
            rien n'est payé.
          </Note>
        </section>
      )}

      {/* ── La couleur de fond (`C2`, relogée de l'assistant) ──────────────
          Elle part avec chaque demande d'image, donc elle est ici. L'assistant
          en était le seul écrivain du produit. */}
      <section className="flex flex-col gap-[8px]">
        <Intitule>Le fond du jeu</Intitule>
        <p className="max-w-[880px] text-[13px] leading-[1.55] text-encre-2">
          Sur quelle couleur le sujet est demandé. Une couleur que rien dans ton
          jeu ne contient rend le découpage presque parfait ; un gris clair — ce
          que le modèle rend quand on ne dit rien — est aussi la couleur d'une
          joue, et le découpage la mange avec le fond.
        </p>
        <div className="flex items-center gap-[8px]">
          {/* ⚠️ **Pas de pastille de couleur tant qu'aucun fond n'est posé.**
              Un `input type=color` n'a pas d'état vide : il *doit* porter une
              couleur, et il porterait donc celle de la proposition, juste à
              côté des mots « aucun fond posé ». Le damier est ce que le produit
              montre partout ailleurs pour « pas de couleur » — et il reste
              cliquable, parce que quand aucun candidat n'est sûr, c'est le seul
              chemin qui reste. */}
          {fondPose ? (
            <input
              type="color"
              value={univers.fond}
              aria-label="Couleur du fond"
              onChange={(e) => void onRegler({ fond: e.target.value })}
              className="h-[26px] w-[34px] shrink-0 rounded-5 border border-trait bg-carte"
            />
          ) : (
            <span className="damier-papier relative h-[26px] w-[34px] shrink-0 overflow-hidden rounded-5 border border-trait">
              {/* Le sélecteur est transparent par-dessus le damier : il
                  s'ouvre sur la couleur proposée quand il y en a une, et sur
                  ce que le navigateur met par défaut quand il n'y en a pas.
                  **Aucune couleur de repli n'est écrite ici** — une couleur en
                  clair dans un écran est ce que le banc des jetons refuse, et
                  celle-ci ne se voit de toute façon jamais. */}
              <input
                type="color"
                value={fondPropose?.couleur ?? ""}
                aria-label="Couleur du fond"
                onChange={(e) => void onRegler({ fond: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
          )}
          <span className="mesure text-[11.5px] text-encre-3">
            {fondPose ? univers.fond : "aucun fond posé"}
          </span>
          {fondPose && (
            <button
              type="button"
              onClick={() => void onRegler({ fond: "" })}
              className="mesure h-[26px] text-[11.5px] text-encre-4 hover:text-encre"
            >
              Retirer
            </button>
          )}
        </div>
        {/* **La proposition, et l'écart qui la porte.** Un chiffre nu ne se lit
            pas : « à 192 de la couleur de ton jeu la plus proche » dit à la fois
            ce qu'on gagne et sur quoi le calcul a porté. */}
        {fondPropose?.couleur && fondPropose.couleur !== univers.fond && (
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={() => void onRegler({ fond: fondPropose.couleur })}
              style={{ background: fondPropose.couleur }}
              aria-label={`Prendre ${fondPropose.couleur}`}
              className="h-[22px] w-[22px] shrink-0 rounded-5 border border-trait"
            />
            <button
              type="button"
              onClick={() => void onRegler({ fond: fondPropose.couleur })}
              className="mesure text-[11.5px] text-signal hover:text-encre"
            >
              Prendre {fondPropose.nom || fondPropose.couleur}
            </button>
            <span className="mesure text-[11.5px] text-encre-4">
              à {fondPropose.ecart} de {fondPropose.voisine}, la couleur de ton
              jeu la plus proche
            </span>
          </div>
        )}
        {/* **Aucun candidat sûr est une réponse, pas une panne** — et l'atelier
            le dit au lieu de choisir en silence. */}
        {fondPropose?.raison && <Note>{fondPropose.raison}</Note>}
        {fondPose && (
          <Alerte>
            Changer le fond change ce qui part au fournisseur : les images
            tirées avant ne se comparent plus à celles d'après.
          </Alerte>
        )}
      </section>

      <Note>
        La taille de case est le seul choix qu'on ne reprend pas gratuitement :
        changer le style ou la méthode se refait sur la machine, puisque la grande
        image est gardée sur le disque. Changer la taille après coup laisse les
        images déjà faites à leur ancienne taille.
      </Note>
    </div>
  )
}

// ── L'étape « Sa vue » ───────────────────────────────────────────────────────

function SaVue({
  univers,
  vues,
  onRegler,
}: {
  univers: Univers
  vues: VueDuJeu[]
  onRegler: (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
}) {
  const choisie = vues.find((v) => v.identifiant === univers.vue) ?? null

  // **Deux vues écrivent exactement la même consigne**, et la planche le dit.
  // On ne le recopie pas : on le calcule sur les textes servis, si bien que la
  // phrase disparaîtra d'elle-même le jour où les deux vues divergeront.
  const jumelles = useMemo(() => {
    if (!choisie?.contrainte) return [] as VueDuJeu[]
    return vues.filter(
      (v) => v.identifiant !== choisie.identifiant && v.contrainte === choisie.contrainte,
    )
  }, [choisie, vues])

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="max-w-[880px] text-[13px] leading-[1.55] text-encre-2">
        Huit vues, une seule par jeu. C'est elle qui décide du nombre de
        directions — donc du travail que chaque personnage demandera.
      </p>

      <div className="grid grid-cols-2 gap-[14px] xl:grid-cols-4">
        {vues.map((v) => (
          <Choix
            key={v.identifiant}
            titre={v.libelle}
            quoi={v.exemples}
            choisi={univers.vue === v.identifiant}
            onChoisir={() => void onRegler({ vue: v.identifiant })}
          >
            <Vignette fichier={v.identifiant} alt="" />
            <span className="mesure text-[11px] text-encre-4">
              {v.images} direction{v.images > 1 ? "s" : ""}
            </span>
          </Choix>
        ))}
      </div>

      {choisie ? (
        <section className="flex flex-col gap-[8px]">
          <Intitule>Ce que ce choix écrit, mot pour mot</Intitule>
          {/* **Le texte du serveur, au caractère près.** Une paraphrase serait
              devenue fausse au premier mot changé dans `atelier/domaine/vue.py`,
              et rien ne l'aurait dit. */}
          <div
            data-texte-de-camera
            className="mesure flex flex-col gap-[8px] rounded-8 border border-trait bg-papier-cote p-[14px] text-[12px] leading-[1.55] text-encre-2"
          >
            <p>
              <span className="text-encre-4">View and framing: </span>
              {choisie.phrase}
            </p>
            <p>{choisie.contrainte}</p>
            {choisie.volume && <p>{choisie.volume}</p>}
            {choisie.corps && (
              <p>
                {choisie.corps}
                <span className="text-encre-4"> — pour ce qui a un corps seulement</span>
              </p>
            )}
          </div>
          <p className="text-[11.5px] leading-[1.45] text-encre-4">
            La première ligne part en tête de la demande, avec le reste du monde ;
            les autres la ferment, juste avant l'envoi.
          </p>
          {jumelles.length > 0 && (
            <Note>
              « {jumelles.map((v) => v.libelle).join(" », « ")} » écrit la même
              consigne de caméra, mot pour mot. Seul le nom change.
            </Note>
          )}
        </section>
      ) : (
        <Note>
          <strong className="text-encre">
            Sans vue choisie, l'atelier n'écrit rien.
          </strong>{" "}
          Le modèle décide seul de sa caméra, et il change d'avis d'une image à
          l'autre.
        </Note>
      )}

      <Note>
        Changer la vue change le nombre de directions. Les images déjà faites
        restent, et les nouvelles cases apparaissent vides.
      </Note>
    </div>
  )
}

// ── L'étape « Son monde » ────────────────────────────────────────────────────

/** Ce que chaque ligne de la bible demande — la question, pas la définition. */
const QUESTION_DE_LA_CASE: Record<string, string> = {
  monde: "de quoi ce monde est fait",
  epoque: "quand ça se passe, et avec quelle technique",
  trait: "comment le trait et les aplats se comportent",
  eclairage: "d'où vient la lumière, et ce qu'elle fait aux ombres",
  technique: "ce que le modèle ne doit jamais faire",
}

function SonMonde({
  univers,
  atelier,
  etiquettes,
  onBible,
  onEtape,
  onEtiquettes,
}: {
  univers: Univers
  atelier: CeQueLAtelierEcrit
  etiquettes: Etiquette[]
  onBible: (bible: Champ[]) => Promise<void>
  onEtape: (etape: Etape) => void
  onEtiquettes: (etiquettes: Etiquette[]) => void
}) {
  // Le brouillon des cinq cases qu'on tape. Les deux autres ne se tapent pas ;
  // leur texte voyage quand même dans l'envoi, sans quoi le `PUT` les
  // effacerait — voir le piège en tête de fichier.
  const [brouillon, setBrouillon] = useState<Record<string, string>>({})
  const [ouverte, setOuverte] = useState<string | null>(null)

  useEffect(() => {
    setBrouillon(Object.fromEntries(univers.bible.map((c) => [c.nom, c.texte])))
  }, [univers.bible])

  const deLAtelier = new Set(atelier.champs)

  const poser = async (nom: string, texte: string) => {
    if (texte === (univers.bible.find((c) => c.nom === nom)?.texte ?? "")) return
    // **Les sept cases, toujours** : la clé `bible` remplace la liste entière.
    await onBible(
      univers.bible.map((c) => ({
        ...c,
        texte: c.nom === nom ? texte : (brouillon[c.nom] ?? c.texte),
      })),
    )
  }

  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Sept lignes, qui partent dans cet ordre en tête de chaque demande
        d'image. Cinq s'écrivent ici ; deux sont déjà remplies par les étapes
        d'avant, et on ne les tape pas deux fois.
      </p>

      <ul className="flex flex-col gap-[8px]">
        {univers.bible.map((champ) => {
          const nom = NOM_CHAMP[champ.nom] ?? champ.nom
          const ecritParLAtelier = deLAtelier.has(champ.nom)
          const etape = ETAPE_DE_LA_CASE[champ.nom]
          const phrase = univers.phrases?.[champ.nom] ?? ""
          const inerte = atelier.sans_effet[champ.nom] ?? ""

          if (ecritParLAtelier) {
            return (
              <li
                key={champ.nom}
                data-case-de-l-atelier={champ.nom}
                className="flex flex-col gap-[4px] rounded-8 border border-trait bg-papier-cote p-[14px]"
              >
                <div className="flex items-baseline gap-[8px]">
                  <span className="text-[13px] font-medium text-encre">{nom}</span>
                  <span className="mesure min-w-0 flex-1 truncate text-[12px] text-encre-3">
                    {phrase || "rien ne part"}
                  </span>
                  {etape && (
                    <button
                      type="button"
                      onClick={() => onEtape(etape.clef)}
                      className="shrink-0 text-[12px] text-encre-2 underline transition-colors duration-120 hover:text-encre"
                    >
                      étape {etape.nom} ›
                    </button>
                  )}
                </div>
                <span className="text-[11.5px] leading-[1.45] text-encre-4">
                  Cette ligne s'écrit toute seule, depuis l'étape à droite. La
                  taper ici aurait fait deux consignes dans le même envoi.
                </span>
                {inerte && (
                  <p
                    data-texte-sans-effet={champ.nom}
                    className="text-[11.5px] leading-[1.45] text-encre-attention"
                  >
                    Ce qui avait été tapé ici ne part plus :{" "}
                    <s className="text-encre-4">{inerte}</s> — rien n'est effacé, et
                    ce texte se recopie ailleurs s'il a encore quelque chose à dire.
                  </p>
                )}
              </li>
            )
          }

          const siennes = etiquettes.filter((e) => e.case === champ.nom)
          const texte = brouillon[champ.nom] ?? ""

          return (
            <li
              key={champ.nom}
              data-case-de-la-bible={champ.nom}
              className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]"
            >
              <button
                type="button"
                aria-expanded={ouverte === champ.nom}
                onClick={() => setOuverte(ouverte === champ.nom ? null : champ.nom)}
                className="flex items-baseline gap-[8px] text-left"
              >
                <span className="text-[13px] font-medium text-encre">{nom}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-encre-3">
                  {texte || QUESTION_DE_LA_CASE[champ.nom] || ""}
                </span>
                <span className="mesure shrink-0 text-[11px] text-encre-4">
                  {texte.trim() ? "écrit" : "vide"}
                </span>
              </button>

              {ouverte === champ.nom && (
                <>
                  <textarea
                    value={texte}
                    onChange={(e) =>
                      setBrouillon((b) => ({ ...b, [champ.nom]: e.target.value }))
                    }
                    onBlur={() => void poser(champ.nom, texte)}
                    rows={2}
                    aria-label={`La ligne « ${nom} »`}
                    placeholder={QUESTION_DE_LA_CASE[champ.nom]}
                    className="defile resize-y rounded-7 border border-contour bg-papier p-[8px] text-[13px] leading-[1.55] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
                  />
                  {siennes.length > 0 && (
                    <div className="flex flex-wrap gap-[4px]">
                      {siennes.slice(0, 16).map((e) => (
                        <button
                          key={e.identifiant}
                          type="button"
                          title={e.texte}
                          onClick={() => {
                            // Cliquer ajoute ses mots ; ce qui part reste ce
                            // qui est écrit dans le champ, pas la liste.
                            const suite = texte.trim()
                              ? `${texte.trim()}, ${e.texte}`
                              : e.texte
                            setBrouillon((b) => ({ ...b, [champ.nom]: suite }))
                            void poser(champ.nom, suite)
                            api
                              .etiquetteServie(e.identifiant)
                              .then((recu) => onEtiquettes(recu.etiquettes))
                              .catch(() => undefined)
                          }}
                          className={[
                            "h-[26px] rounded-full border px-[14px] text-[12px] transition-colors duration-120",
                            e.livree
                              ? "border-trait text-encre-3 hover:bg-ligne-ouverte"
                              : "border-epingle text-encre-2 hover:bg-ligne-ouverte",
                          ].join(" ")}
                        >
                          {e.libelle}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11.5px] leading-[1.45] text-encre-4">
                    Cliquer une étiquette ajoute ses mots dans le champ. On peut
                    aussi n'en cliquer aucune et tout écrire : ce qui part est ce
                    qui est écrit là, pas la liste des étiquettes.
                  </p>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <Note>
        Une ligne vide ne part pas. Puis vient la description du sujet : c'est
        tout ce qui part, rien n'est ajouté dans le dos.
      </Note>
    </div>
  )
}

// ── L'étape « Ses sons » ─────────────────────────────────────────────────────
//
// Le bloc sonore de l'univers (SN2) : le même geste que « Son monde », pour
// l'oreille. Quatre lignes de texte — époque et matière, rendu, orchestre,
// humeur — puis la tonalité et le tempo de référence, et le moteur choisi par
// famille de sons. **Un univers sans ce bloc ne contraint rien** : la
// description d'un son part seule, avec la prise de son de sa famille.

/** Vers quoi chaque case sonore part, en quelques mots (`docs/archi-son.md`
 *  §4.2) — montré sous chaque ligne pour qu'on sache ce qu'on règle. */
const PART_VERS_SON: Record<string, string> = {
  epoque: "bruitages, ambiances",
  rendu: "bruitages, interface",
  orchestre: "musique",
  humeur: "musique, ambiances",
}

const NOM_CHAMP_SON: Record<string, string> = {
  epoque: "époque et matière",
  rendu: "rendu sonore",
  orchestre: "orchestre",
  humeur: "humeur",
}

const QUESTION_DE_LA_CASE_SON: Record<string, string> = {
  epoque: "quand ça se passe, et de quoi c'est fait — en anglais",
  rendu: "la prise de son : rétro 8 bits, réaliste et proche…",
  orchestre: "quels instruments jouent",
  humeur: "l'humeur générale de la musique",
}

/** Les 34 tonalités que le serveur reconnaît (`atelier.domaine.workflow.
 *  TONALITES`), recopiées au caractère près — un choix qui n'y figure pas est
 *  un refus, jamais un oubli muet. */
const NOTES_TONALITE = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
] as const
const TONALITES: readonly string[] = (["major", "minor"] as const).flatMap((mode) =>
  NOTES_TONALITE.map((note) => `${note} ${mode}`),
)
/** Le nom français de chaque note, pour l'écran seulement : la valeur envoyée
 *  au serveur reste l'anglais de `TONALITES`, au caractère près. */
const NOM_NOTE_FR: Record<(typeof NOTES_TONALITE)[number], string> = {
  C: "do", "C#": "do♯", Db: "ré♭", D: "ré", "D#": "ré♯", Eb: "mi♭", E: "mi", F: "fa", "F#": "fa♯",
  Gb: "sol♭", G: "sol", "G#": "sol♯", Ab: "la♭", A: "la", "A#": "la♯", Bb: "si♭", B: "si",
}
function tonaliteEnFrancais(tonalite: string): string {
  const [note, mode] = tonalite.split(" ")
  const nom = NOM_NOTE_FR[note as (typeof NOTES_TONALITE)[number]]
  if (!nom || (mode !== "major" && mode !== "minor")) return tonalite
  return `${nom} ${mode === "minor" ? "mineur" : "majeur"}`
}

/** Les sept familles de sons (`atelier.domaine.son.FAMILLES_SON`), et leur nom
 *  français — la seule liste vit côté serveur, recopiée ici pour l'ordre de
 *  l'écran, comme les autres listes fermées de ce fichier. */
const FAMILLES_SON = ["bruitage", "interface", "ambiance", "musique", "jingle", "chanson", "voix"] as const
const NOM_FAMILLE_SON: Record<(typeof FAMILLES_SON)[number], string> = {
  bruitage: "Bruitage",
  interface: "Interface et rétro",
  ambiance: "Ambiance",
  musique: "Musique",
  jingle: "Jingle",
  chanson: "Chanson",
  voix: "Voix",
}

function LeSon({
  univers,
  projet,
  onRegler,
}: {
  univers: Univers
  /** Le jeu ouvert : les méthodes installées et le défaut de chaque famille en
   *  dépendent. `null` tant que le jeu n'existe pas encore (création). */
  projet: string | null
  onRegler: (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
}) {
  const son = univers.son
  const [brouillon, setBrouillon] = useState<Record<string, string>>({})
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [defauts, setDefauts] = useState<Record<string, MoteurParFamille>>({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState("")

  useEffect(() => {
    setBrouillon(Object.fromEntries(son.champs.map((c) => [c.nom, c.texte])))
  }, [son.champs])

  // Le tempo ne part qu'à la sortie du champ (ou Entrée) : envoyer une
  // modification d'univers à chaque frappe (« 1 » refusé, puis « 12 », puis
  // « 120 ») ferait trois appels, dont un refus, pour un seul geste voulu.
  const [tempoBrouillon, setTempoBrouillon] = useState(son.tempo != null ? String(son.tempo) : "")
  useEffect(() => {
    setTempoBrouillon(son.tempo != null ? String(son.tempo) : "")
  }, [son.tempo])

  const relireLesMoteurs = useCallback(() => {
    if (!projet) return
    void workflows
      .moteursParFamille(projet)
      .then((recu) => setDefauts(recu.familles))
      .catch(() => undefined)
  }, [projet])

  useEffect(() => {
    if (!projet) {
      setChargement(false)
      return
    }
    let vivant = true
    setChargement(true)
    Promise.all([workflows.lister(), workflows.moteursParFamille(projet)])
      .then(([liste, def]) => {
        if (!vivant) return
        // Un profil garde chacune de ses versions ; cet écran ne montre que
        // la plus récente par identifiant, sinon un même moteur offrirait
        // deux options (et deux clés React) dans le choix de sa famille.
        const parIdentifiant = new Map<string, ProfilWorkflow>()
        for (const p of liste.profils) {
          if (p.nature !== "audio") continue
          const actuel = parIdentifiant.get(p.identifiant)
          if (!actuel || p.cree_le > actuel.cree_le) parIdentifiant.set(p.identifiant, p)
        }
        setProfils([...parIdentifiant.values()])
        setDefauts(def.familles)
      })
      .catch(
        (erreur: unknown) =>
          vivant &&
          setErreur(
            erreur instanceof Error ? erreur.message : "les méthodes sonores n'ont pas pu être lues",
          ),
      )
      .finally(() => vivant && setChargement(false))
    return () => {
      vivant = false
    }
  }, [projet])

  const poserChamp = async (nom: string, texte: string) => {
    if (texte === (son.champs.find((c) => c.nom === nom)?.texte ?? "")) return
    await onRegler({
      son: {
        champs: son.champs.map((c) => ({
          ...c,
          texte: c.nom === nom ? texte : (brouillon[c.nom] ?? c.texte),
        })),
      },
    })
  }

  const poserTempo = async () => {
    const valeur = tempoBrouillon.trim() === "" ? null : Number(tempoBrouillon)
    if (valeur !== null && !Number.isFinite(valeur)) return
    if (valeur === (son.tempo ?? null)) return
    await onRegler({ son: { tempo: valeur } })
  }

  const poserMoteur = async (famille: string, identifiant: string) => {
    await onRegler({ son: { moteurs: { [famille]: identifiant } } })
    relireLesMoteurs()
  }

  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Le même geste que pour l'image : on décrit le son à fabriquer, et ces
        quatre lignes ajoutent le style du jeu devant chaque description.
      </p>

      {erreur && (
        <p role="alert" className="text-[13px] text-echec">
          {erreur}
        </p>
      )}

      <ul className="flex flex-col gap-[8px]">
        {son.champs.map((champ) => {
          const nom = NOM_CHAMP_SON[champ.nom] ?? champ.nom
          const texte = brouillon[champ.nom] ?? ""

          return (
            <li
              key={champ.nom}
              data-case-du-son={champ.nom}
              className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]"
            >
              <button
                type="button"
                aria-expanded={ouverte === champ.nom}
                onClick={() => setOuverte(ouverte === champ.nom ? null : champ.nom)}
                className="flex items-baseline gap-[8px] text-left"
              >
                <span className="text-[13px] font-medium text-encre">{nom}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-encre-3">
                  {texte || QUESTION_DE_LA_CASE_SON[champ.nom] || ""}
                </span>
                <span className="mesure shrink-0 text-[11px] text-encre-4">
                  {texte.trim() ? "écrit" : "vide"}
                </span>
              </button>

              {ouverte === champ.nom && (
                <>
                  <textarea
                    value={texte}
                    onChange={(e) =>
                      setBrouillon((b) => ({ ...b, [champ.nom]: e.target.value }))
                    }
                    onBlur={() => void poserChamp(champ.nom, texte)}
                    rows={2}
                    aria-label={`La ligne sonore « ${nom} »`}
                    placeholder={QUESTION_DE_LA_CASE_SON[champ.nom]}
                    className="defile resize-y rounded-7 border border-contour bg-papier p-[8px] text-[13px] leading-[1.55] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
                  />
                  <span className="text-[11.5px] leading-[1.45] text-encre-4">
                    Part vers : {PART_VERS_SON[champ.nom]}.
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Tonalité et tempo de référence</Intitule>
        <p className="text-[11.5px] leading-[1.45] text-encre-4">
          Part vers la musique ; les jingles s'y calent.
        </p>
        <div className="flex flex-wrap items-end gap-[14px]">
          <label className="flex flex-col gap-[4px] text-[13px]">
            Tonalité
            <select
              aria-label="Tonalité de référence"
              value={son.tonalite}
              onChange={(e) => void onRegler({ son: { tonalite: e.target.value } })}
              className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre"
            >
              <option value="">aucune</option>
              {TONALITES.map((t) => (
                <option key={t} value={t}>
                  {tonaliteEnFrancais(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-[4px] text-[13px]">
            Tempo
            <input
              type="number"
              min={10}
              max={300}
              aria-label="Tempo de référence"
              value={tempoBrouillon}
              placeholder="aucun"
              onChange={(e) => setTempoBrouillon(e.target.value)}
              onBlur={() => void poserTempo()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur()
              }}
              className="h-[34px] w-[70px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre"
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Le moteur de chaque famille</Intitule>
        <p className="text-[11.5px] leading-[1.45] text-encre-4">
          Le choix n'offre que les méthodes déjà installées. Sans choix,
          l'atelier prend la première méthode installée de la famille.
        </p>
        {chargement ? (
          <p className="text-[12.5px] text-encre-3">Lecture des méthodes sonores…</p>
        ) : (
          <ul className="flex flex-col">
            {FAMILLES_SON.map((famille) => {
              const pose = son.moteurs[famille] ?? ""
              const defaut = defauts[famille]
              // Les moteurs de la famille, et celui déjà posé s'il n'en est pas.
              const proposes = profils.filter(
                (p) => (defaut?.possibles ?? []).includes(p.identifiant) || p.identifiant === pose,
              )
              // Un moteur possible pour cette famille (`sound-defaults`) mais
              // qu'aucun profil installé ne porte : montré quand même, grisé
              // avec sa raison — jamais caché en silence.
              const installes = new Set(proposes.map((p) => p.identifiant))
              const nonInstalles = (defaut?.possibles ?? []).filter((id) => !installes.has(id))
              const nomDuMoteur =
                defaut?.moteur === "sfxr"
                  ? "sfxr, calculé sans IA"
                  : (profils.find((p) => p.identifiant === defaut?.moteur)?.nom ?? defaut?.moteur)
              return (
                <li
                  key={famille}
                  data-moteur-de-famille={famille}
                  className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)] items-start gap-[14px] border-b border-trait py-[8px] text-[12.5px] last:border-b-0"
                >
                  <span className="text-encre-2">{NOM_FAMILLE_SON[famille]}</span>
                  <div className="flex flex-col gap-[4px]">
                    <select
                      aria-label={`Moteur pour ${NOM_FAMILLE_SON[famille]}`}
                      value={pose}
                      onChange={(e) => void poserMoteur(famille, e.target.value)}
                      className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12.5px] text-encre"
                    >
                      <option value="">automatique</option>
                      {proposes.map((p) => (
                        <option key={p.identifiant} value={p.identifiant}>
                          {p.nom}
                        </option>
                      ))}
                      {nonInstalles.map((id) => (
                        <option key={id} value={id} disabled>
                          {nomMoteurSonore(id)} — pas installé
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-encre-4">
                      {defaut?.moteur
                        ? `en ce moment : ${nomDuMoteur}`
                        : (defaut?.raison ?? "aucune méthode installée")}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Note>
        Un univers sans ce bloc ne contraint rien : la description d'un son
        part seule, avec la prise de son de sa famille.
      </Note>
    </div>
  )
}

// ── Ce qui s'applique à tout le jeu, mais se règle ailleurs ──────────────────

/** Les lignes que le carnet perd, rassemblées ici en **lecture seule**.
 *
 *  ⚠️ **« La couleur de fond » en est sortie avec `C2`.** Elle renvoyait à
 *  « l'atelier Détourer », qui ne l'a jamais écrite : `Assistant.tsx` en était
 *  le seul écrivain du produit, et le renvoi était donc faux. Elle se règle
 *  maintenant à l'étape « Son allure », deux écrans plus haut.
 *
 *  Elles ne sont pas dans le parcours parce qu'elles ne passent pas son critère
 *  d'entrée — elles ne partent pas avec la demande d'image, ou elles ne
 *  décident pas de la façon dont l'image est fabriquée. Les lire ici évite
 *  qu'on les cherche ; les écrire ici en aurait fait un second endroit. */
function ReglesDAilleurs({ univers }: { univers: Univers }) {
  const ailleurs: { quoi: string; etat: string; ou: string }[] = [
    {
      quoi: "La palette et les ambiances",
      etat: univers.palette.length
        ? `${univers.palette.length} couleurs`
        : "aucune couleur encore — elle se lit sur les images promues",
      ou: "la toile de l'univers",
    },
    { quoi: "Le détourage de départ", etat: "par nature et par famille", ou: "Détourage" },
    {
      quoi: "Les natures de sujets",
      etat: `${univers.bareme.length} réparties sur les familles`,
      ou: "chaque famille",
    },
    { quoi: "Le plan de poses", etat: "propre à chaque nature", ou: "chaque famille" },
    { quoi: "Les emplacements de corps", etat: "communs au casting", ou: "la famille personnages" },
    {
      quoi: "Le modèle de chaque famille",
      etat: `${Object.values(univers.modeles).filter(Boolean).length} posés, le catalogue décide du reste`,
      ou: "chaque famille",
    },
    { quoi: "La clé et le catalogue des modèles", etat: "pour toute la machine", ou: "l'installation" },
  ]
  return (
    <section data-regles-d-ailleurs className="flex flex-col gap-[8px]">
      <Intitule>S'applique à tout le jeu, mais se règle ailleurs</Intitule>
      <p className="text-[12px] leading-[1.5] text-encre-3">
        Ces lignes se lisent ici ; elles s'écrivent là où l'on s'en sert. Un
        réglage ne se pose jamais à deux endroits.
      </p>
      <ul className="flex flex-col">
        {ailleurs.map(({ quoi, etat, ou }) => (
          <li
            key={quoi}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-baseline gap-[14px] border-b border-trait py-[8px] text-[12.5px] last:border-b-0"
          >
            <span className="text-encre-2">{quoi}</span>
            <span className="truncate text-encre-4">{etat}</span>
            <span className="mesure shrink-0 text-[11px] text-encre-4">{ou} ›</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── L'atelier — l'agent, le dossier, la clé (D1, rangés par RP2) ───────────
//
// `EcranReglages.tsx` (433 lignes) et `Secrets.tsx` (184 lignes) sont partis
// avec `D1` : les deux boutons qui les ouvraient encore — « Réglages » et
// l'état de la clé, tous deux dans la barre — menaient à un panneau écrit sur
// l'ancien châssis sombre, dernier des cinq que `C1` n'avait pas basculé.
// `D1` les avait relogés dans `PanneauAtelier`, une fenêtre posée par-dessus
// le carnet.
//
// **`RP2` a dissous cette fenêtre.** La maquette validée ne connaît qu'une
// porte vers les réglages, et elle a quatre onglets ; deux d'entre eux
// reprennent mot pour mot les blocs ci-dessous — *Moteurs & workflows* prend
// « Les fournisseurs », *Agent MCP* prend « L'agent » et « Les dossiers ».
// C'est pour ça qu'ils s'exportent : `Reglages.tsx` les monte, et personne
// d'autre. Le seul chemin vers eux passe désormais par le mot « Réglages ».

/** Le titre d'un bloc de l'atelier — la même forme que celle de
 *  `Mouvements.tsx`, recopiée pour la même raison qu'elle donne : un détail de
 *  mise en page privé à ces blocs-là n'a pas à devenir une pièce du châssis.
 *
 *  Il s'exporte depuis `RP2` pour la seule raison qui vaille : les blocs
 *  qu'il coiffe sont montés par `Reglages.tsx`, qui en pose un de plus à côté
 *  d'eux. Deux titres de même rang écrits deux fois divergeraient. */
export function TitreDeLAtelier({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-[34px] mb-[14px] border-b border-trait pb-[8px] text-[10.5px] uppercase tracking-[.14em] text-encre-3">
      {children}
    </h3>
  )
}

/** Le carré ●/○ d'un garde-fou — la forme du choix sélectionné ailleurs sur
 *  cet écran (`Choix`), posée sur un interrupteur plutôt qu'une carte. */
function Interrupteur({
  actif,
  nom,
  onBasculer,
}: {
  actif: boolean
  nom: string
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={`${nom} — ${actif ? "actif" : "inactif"}`}
      onClick={onBasculer}
      className={[
        "h-[26px] w-[26px] shrink-0 rounded-7 border text-[11px] transition-colors duration-120",
        actif
          ? "border-signal bg-ligne-ouverte text-signal"
          : "border-trait bg-carte text-encre-3 hover:bg-papier-cote",
      ].join(" ")}
    >
      {actif ? "●" : "○"}
    </button>
  )
}

// ── Le tiroir à secrets, et l'état de la clé ────────────────────────────────

export function BlocSecrets({
  tiroirs,
  onDeposee,
}: {
  tiroirs: Tiroir[]
  onDeposee: (tiroirs: Tiroir[]) => void
}) {
  return (
    <>
      <TitreDeLAtelier>Les fournisseurs</TitreDeLAtelier>
      <p className="text-[12.5px] leading-[1.5] text-encre-2">
        Ce qu'un fournisseur demande se dépose une fois, et l'atelier ne le
        réaffiche plus jamais. Tout est écrit dans{" "}
        <span className="text-[11.5px] text-encre">.env</span>, qui n'est
        jamais versionné.{" "}
        <strong className="text-encre">Déposer chez l'un ne touche à aucun autre</strong>,
        et retirer ne grise que ses modèles : ses images et ses lignes de
        dépense restent.
      </p>

      <div className="mt-[14px] flex flex-col gap-[22px]">
        {tiroirs.map((tiroir) => (
          <PlaceDunFournisseur key={tiroir.fournisseur} tiroir={tiroir} onChange={onDeposee} />
        ))}
      </div>
    </>
  )
}

function PlaceDunFournisseur({
  tiroir,
  onChange,
}: {
  tiroir: Tiroir
  onChange: (tiroirs: Tiroir[]) => void
}) {
  return (
    <section className="flex flex-col gap-[8px]">
      <div className="flex items-baseline gap-[8px]">
        <span className="text-[12.5px] text-encre">{tiroir.fournisseur}</span>
        <span className={["text-[10.5px]", tiroir.pret ? "text-encre-ok" : "text-encre-4"].join(" ")}>
          {tiroir.pret ? "prêt" : "en attente"}
        </span>
      </div>

      {/* **Un tiroir vide se dit, il ne se cache pas.** Sans cette ligne, un
          fournisseur sans secret paraîtrait comme un fournisseur mal réglé. */}
      {tiroir.secrets.length === 0 ? (
        <p className="text-[11.5px] leading-[1.5] text-encre-4">
          Ce fournisseur ne demande rien — ni compte, ni clé. Il est
          utilisable tel quel.
        </p>
      ) : (
        <>
          {tiroir.manque && <Raison texte={tiroir.manque} />}
          {tiroir.secrets.map((secret) => (
            <UnePlace key={secret.nom} secret={secret} onChange={onChange} />
          ))}
        </>
      )}
    </section>
  )
}

function UnePlace({
  secret,
  onChange,
}: {
  secret: EtatSecret
  onChange: (tiroirs: Tiroir[]) => void
}) {
  const [saisie, setSaisie] = useState("")
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const agir = async (quoi: () => Promise<{ tiroirs: Tiroir[] }>) => {
    setEnCours(true)
    setRefus(null)
    try {
      onChange((await quoi()).tiroirs)
      setSaisie("")
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex flex-wrap items-baseline gap-x-[8px] text-[10.5px]">
        <span className="text-encre-2">{secret.libelle}</span>
        {secret.presente ? (
          <span className="text-encre-4">
            …{secret.apercu} · {secret.origine}
          </span>
        ) : (
          secret.ou && <span className="text-encre-4">{secret.ou}</span>
        )}
      </div>

      <div className="flex items-start gap-[8px]">
        <input
          type="password"
          value={saisie}
          aria-label={secret.libelle}
          placeholder={secret.presente ? "remplacer…" : "…"}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            saisie.trim().length >= 8 &&
            void agir(() => api.deposerSecret(secret.nom, saisie.trim()))
          }
          className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-papier-cote px-[14px] text-[12.5px] text-encre placeholder:text-eteint"
        />
        <Bouton
          principal
          inactif={saisie.trim().length < 8 || enCours}
          onClick={() => void agir(() => api.deposerSecret(secret.nom, saisie.trim()))}
          enfants={secret.presente ? "Remplacer" : "Déposer"}
        />
        {/* **Retirer ne se propose que si ça retire vraiment.** Une valeur
            venue de l'environnement de la machine ne s'enlève pas d'ici, et un
            bouton qui semblerait le faire serait pire que pas de bouton du
            tout. */}
        {secret.retirable && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => void agir(() => api.retirerSecret(secret.nom))}
            title="ses modèles se grisent — ses images et ses lignes de dépense restent"
            className="h-[34px] shrink-0 rounded-7 border border-trait px-[8px] text-[10.5px] text-encre-4 transition-colors duration-120 hover:text-echec disabled:cursor-not-allowed"
          >
            retirer
          </button>
        )}
      </div>
      <Raison texte={refus} />
    </div>
  )
}

// ── L'agent ─────────────────────────────────────────────────────────────────

export function BlocAgent({
  agent,
  modeles,
  onAgent,
}: {
  agent: EtatAgent
  modeles: Modele[]
  onAgent: (agent: EtatAgent) => void
}) {
  const [refus, setRefus] = useState<string | null>(null)
  const cadre = agent.garde_fous
  const compte = agent.consommation
  // Le curseur bouge sous le doigt ; seul le relâchement écrit. Même règle
  // que les curseurs de la recette : un réglage qui coûte un aller-retour ne
  // part pas à chaque pixel parcouru.
  const [plafond, setPlafond] = useState(cadre.plafond)

  const poser = async (champs: Partial<GardeFous>) => {
    setRefus(null)
    try {
      onAgent(await api.reglerAgent(champs))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "réglage refusé")
    }
  }

  return (
    <>
      <TitreDeLAtelier>L'agent</TitreDeLAtelier>
      <p className="text-[12.5px] leading-[1.5] text-encre-2">
        Un agent qui code le jeu appelle l'atelier par le serveur MCP, sur{" "}
        <span className="text-[11.5px] text-encre">/mcp</span>. Il ne demande
        jamais d'autorisation — ces deux garde-fous sont ce qui tient sa
        place, et ils prennent effet à son appel suivant.
      </p>

      {/* Le compteur, discret et permanent. Il est ici, à côté du réglage
          qu'il fait relever : lu ailleurs, il faudrait revenir. */}
      <dl className="mt-[14px] grid grid-cols-[auto_1fr] gap-x-[14px] gap-y-[4px] rounded-7 border border-trait bg-papier-cote px-[14px] py-[8px] text-[11px]">
        <dt className="text-encre-4">cette séance</dt>
        <dd className="text-encre-2">
          {compte.generations} image{compte.generations > 1 ? "s" : ""}
          {compte.reste !== null && ` · ${compte.reste} avant le plafond`}
        </dd>
        {/* « dépensé par l'agent », et pas « dépensé » : ce montant ne compte
            que les appels venus du serveur MCP. */}
        <dt className="text-encre-4">dépensé par l'agent</dt>
        <dd className="text-encre-2">{dollars(compte.depense_usd)}</dd>
        {/* Et ce qu'il a consommé sans argent, compté à part. */}
        {compte.consomme.map((ligne) => (
          <Fragment key={ligne.unite}>
            <dt className="text-encre-4">consommé sans argent</dt>
            <dd className="text-encre-2">{quantite(ligne.quantite, ligne.unite)}</dd>
          </Fragment>
        ))}
      </dl>

      <div className="mt-[14px] flex flex-col gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <Interrupteur
            actif={cadre.plafond_actif}
            nom="Plafond de la séance"
            onBasculer={() => void poser({ plafond_actif: !cadre.plafond_actif })}
          />
          <Libelle aide="agent.plafond" eteint={!cadre.plafond_actif}>
            Plafond de la séance
          </Libelle>
        </div>
        <Curseur
          libelle="le plafond de la séance"
          valeur={plafond}
          min={1}
          max={200}
          unite=" images"
          inactif={!cadre.plafond_actif}
          onChange={setPlafond}
          onFini={(v) => void poser({ plafond: v })}
        />
      </div>

      <div className="mt-[14px] flex flex-col gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <Interrupteur
            actif={cadre.modele_actif}
            nom="Modèle d'exploration"
            onBasculer={() => void poser({ modele_actif: !cadre.modele_actif })}
          />
          <Libelle aide="agent.modele" eteint={!cadre.modele_actif}>
            Modèle d'exploration
          </Libelle>
        </div>
        {/* Le nom seulement quand la liste ne le porte pas. */}
        {!modeles.some((m) => m.identifiant === cadre.modele) && (
          <p className="text-[10.5px] leading-[1.4] text-encre-4" title={cadre.modele}>
            {nomDuModele(cadre.modele)}
            {Object.entries(cadre.options).map(([nom, valeur]) => (
              <span key={nom}> · {nom} {valeur}</span>
            ))}
          </p>
        )}

        <ChoixDuGratuit
          modeles={modeles}
          choisi={cadre.modele}
          eteint={!cadre.modele_actif}
          onChoisir={(modele) => void poser({ modele })}
        />
      </div>

      <Raison texte={refus} />
    </>
  )
}

/**
 * Parmi quoi le modèle d'exploration se choisit — **les gratuits, et eux
 * seuls**. La liste ne contient aucun modèle payant, et ce n'est pas un
 * filtre d'affichage : c'est ce que le garde-fou *est*.
 */
function ChoixDuGratuit({
  modeles,
  choisi,
  eteint,
  onChoisir,
}: {
  modeles: Modele[]
  choisi: string
  eteint: boolean
  onChoisir: (modele: string) => void
}) {
  const gratuits = modeles.filter((m) => !estArgent(m.unite) && !m.refus)
  if (gratuits.length === 0)
    return (
      <p className="text-[10.5px] leading-[1.4] text-encre-4">
        aucun modèle gratuit dans cet atelier — le garde-fou n'a rien à
        imposer
      </p>
    )

  return (
    <div className="mt-[4px] flex flex-wrap gap-[4px]">
      {gratuits.map((modele) => (
        <button
          key={modele.identifiant}
          type="button"
          disabled={eteint}
          onClick={() => onChoisir(modele.identifiant)}
          aria-pressed={modele.identifiant === choisi}
          title={modele.identifiant}
          className={[
            "h-[26px] min-w-[34px] shrink-0 whitespace-nowrap rounded-7 border px-[8px] text-[11.5px] transition-colors duration-120",
            modele.identifiant === choisi
              ? "border-signal bg-ligne-ouverte text-signal"
              : "border-trait bg-carte text-encre-3 hover:bg-papier-cote",
            eteint ? "opacity-40" : "",
          ].join(" ")}
        >
          {libelleModele(modele)}
        </button>
      ))}
    </div>
  )
}

// ── Les dossiers ────────────────────────────────────────────────────────────

export function BlocDossiers({
  agent,
  onAgent,
}: {
  agent: EtatAgent
  onAgent: (agent: EtatAgent) => void
}) {
  const [dossier, setDossier] = useState(agent.garde_fous.dossier_jeu)
  const [refus, setRefus] = useState<string | null>(null)
  const change = dossier.trim() !== agent.garde_fous.dossier_jeu

  const poser = async () => {
    setRefus(null)
    try {
      onAgent(await api.reglerAgent({ dossier_jeu: dossier.trim() }))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "réglage refusé")
    }
  }

  return (
    <>
      <TitreDeLAtelier>Les dossiers</TitreDeLAtelier>
      <div className="flex flex-col gap-[8px]">
        <Libelle aide="agent.dossier">
          Dossier du jeu
        </Libelle>
        <div className="flex items-start gap-[8px]">
          <input
            value={dossier}
            onChange={(e) => setDossier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && change && poser()}
            placeholder="C:\\Jeux\\mon-jeu\\assets"
            className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-papier-cote px-[14px] text-[11.5px] text-encre placeholder:text-eteint"
          />
          <Bouton inactif={!change} onClick={poser} enfants="Poser" />
        </div>
      </div>
      <Raison texte={refus} />
    </>
  )
}

// ── L'écran ──────────────────────────────────────────────────────────────────

export type Mode = "creation" | "reglages"

export function ReglesDuJeu({
  mode,
  nomDuJeu,
  dossierDuJeu,
  onFerme,
  onCree,
  onRenomme,
  onErreur,
}: {
  mode: Mode
  /** Le nom du jeu ouvert — vide en création, où il n'y en a pas encore. */
  nomDuJeu: string
  /** Son dossier, `null` tant que le jeu n'existe pas. */
  dossierDuJeu: string | null
  onFerme: () => void
  /** Le jeu vient d'être créé et ouvert : le parent recharge sa bibliothèque. */
  onCree: (identifiant: string) => void
  onRenomme: () => void
  onErreur: (raison: string) => void
}) {
  // En création on déroule ; en réglages on ouvre sur la liste des quatre.
  const [ouverte, setOuverte] = useState<Etape | null>(mode === "creation" ? "nom" : null)
  const [nom, setNom] = useState(nomDuJeu)
  const [avertissement, setAvertissement] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [cree, setCree] = useState(false)

  const [univers, setUnivers] = useState<Univers | null>(null)
  const [atelier, setAtelier] = useState<CeQueLAtelierEcrit>({
    champs: [],
    sans_effet: {},
  })
  const [vues, setVues] = useState<VueDuJeu[]>([])
  const [tailles, setTailles] = useState<TailleDImage[]>([])
  const [finesses, setFinesses] = useState<TailleDImage[]>([])
  const [etiquettes, setEtiquettes] = useState<Etiquette[]>([])
  /** **La couleur de fond que l'atelier proposerait** (D3, relogée par `C2`).
   *  Le serveur la calcule sur la palette du jeu ; l'écran ne la recalcule
   *  jamais, parce que la distance qui décide de la sûreté d'un fond est celle
   *  du détourage. */
  const [fondPropose, setFondPropose] = useState<FondPropose | null>(null)
  /** Ce que le dernier réalignement a fait, ou rien. Il se pose sous son
   *  bouton : c'est là qu'on l'a demandé. */
  const [retourDuRealignement, setRetourDuRealignement] = useState<string | null>(null)

  const echouer = useCallback(
    (erreur: unknown, defaut: string) =>
      onErreur(erreur instanceof Refus || erreur instanceof Error ? erreur.message : defaut),
    [onErreur],
  )

  useEffect(() => setNom(nomDuJeu), [nomDuJeu])

  // **Les deux listes fermées, et le catalogue d'étiquettes.** Lues une fois :
  // elles ne dépendent d'aucun jeu et ne changent pas pendant le parcours.
  useEffect(() => {
    let vivant = true
    api
      .vuesEtTailles()
      .then((recu) => {
        if (!vivant) return
        setVues(recu.vues ?? [])
        setTailles(recu.tailles ?? [])
        setFinesses(recu.finesses ?? [])
      })
      .catch((erreur) => vivant && echouer(erreur, "les vues n'ont pas pu être lues"))
    // Non critique : sans étiquettes, les cinq cases restent des champs libres.
    api
      .etiquettes()
      .then((recu) => vivant && setEtiquettes(recu?.etiquettes ?? []))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [echouer])

  const relireLUnivers = useCallback(async () => {
    const recu = await api.univers()
    setUnivers(recu.univers)
    setAtelier(recu.atelier ?? { champs: [], sans_effet: {} })
    setFondPropose(recu.fond_propose ?? null)
  }, [])

  // En réglages, le jeu existe déjà : on lit son univers tout de suite. En
  // création il n'y en a pas encore — la lecture attend que l'étape du nom l'ait
  // créé.
  useEffect(() => {
    if (mode === "creation") return
    let vivant = true
    void api
      .univers()
      .then((recu) => {
        if (!vivant) return
        setUnivers(recu.univers)
        setAtelier(recu.atelier ?? { champs: [], sans_effet: {} })
        setFondPropose(recu.fond_propose ?? null)
      })
      .catch((erreur) => vivant && echouer(erreur, "l'univers n'a pas pu être lu"))
    return () => {
      vivant = false
    }
  }, [mode, echouer])

  const regler = useCallback(
    async (reglage: Parameters<typeof api.reglerUnivers>[0]) => {
      try {
        const recu = await api.reglerUnivers(reglage)
        setUnivers(recu.univers)
        setAtelier(recu.atelier ?? { champs: [], sans_effet: {} })
        setFondPropose(recu.fond_propose ?? null)
      } catch (erreur) {
        echouer(erreur, "le réglage a été refusé")
      }
    },
    [echouer],
  )

  /** **Réappliquer la palette et la grille à tout le jeu** (`C2`, relogé du
   *  pied de l'écran Univers, qui en était la seule porte). Sans identifiants :
   *  tout le projet, en sautant les épinglées. Rien n'est payé — tout se passe
   *  sur la machine. */
  const realigner = useCallback(() => {
    setRetourDuRealignement(null)
    void api
      .realigner()
      .then((fait) => {
        // **Sans cible, le balayage a remis la palette et *retiré* la grille**
        // (US-163) : il n'a rééchantillonné personne, et le dire tient en
        // quatre mots plutôt qu'en une infobulle.
        setRetourDuRealignement(
          `${fait.realignes} remis à jour · ${fait.conserves} conservés tels quels` +
            (fait.sur_grille ? "" : " · aucune remise sur grille"),
        )
      })
      .catch((erreur) => echouer(erreur, "réalignement refusé"))
  }, [echouer])

  /** Le nom **tel qu'il est sur le serveur**, pour ne réécrire que ce qui a
   *  changé. Vide en création tant que le jeu n'existe pas.
   *
   *  Sans lui, revenir sur l'étape du nom après l'avoir passée renverrait un
   *  renommage du nom vers lui-même à chaque clic — un appel qui ne fait rien,
   *  mais qui rejouerait l'avertissement d'homonyme et le ferait clignoter. */
  const [nomPose, setNomPose] = useState(mode === "reglages" ? nomDuJeu : "")
  useEffect(() => {
    if (mode === "reglages") setNomPose(nomDuJeu)
  }, [mode, nomDuJeu])

  /** L'étape du nom — **le seul endroit qui crée ou renomme**, et le même dans les
   *  deux modes du point de vue de l'auteur : il tape un nom, il continue.
   *
   *  Rend l'avertissement du serveur avec le verdict, plutôt que de le laisser
   *  seulement dans l'état : l'appelant a besoin de savoir qu'il *vient*
   *  d'arriver pour ne pas passer par-dessus sans le montrer. */
  const poserLeNom = useCallback(async (): Promise<{
    ok: boolean
    avertissement: string
  }> => {
    const propre = nom.trim()
    if (!propre || enCours) return { ok: false, avertissement: "" }
    setEnCours(true)
    try {
      if (mode === "creation" && !cree) {
        const recu = await api.creerProjet(propre)
        setAvertissement(recu.avertissement)
        setNomPose(propre)
        setCree(true)
        onCree(recu.projet.identifiant)
        await relireLUnivers()
        return { ok: true, avertissement: recu.avertissement }
      }
      if (propre !== nomPose && dossierDuJeu) {
        const recu = await api.renommerProjet(dossierDuJeu, propre)
        setAvertissement(recu.avertissement)
        setNomPose(propre)
        onRenomme()
        return { ok: true, avertissement: recu.avertissement }
      }
      // Rien à écrire : le nom est déjà celui du serveur.
      return { ok: true, avertissement: "" }
    } catch (erreur) {
      echouer(erreur, mode === "creation" ? "création refusée" : "renommage refusé")
      return { ok: false, avertissement: "" }
    } finally {
      setEnCours(false)
    }
  }, [
    nom,
    enCours,
    mode,
    cree,
    nomPose,
    dossierDuJeu,
    onCree,
    onRenomme,
    relireLUnivers,
    echouer,
  ])

  // Échap referme l'étape ouverte, puis l'écran. En création, il ferme tout de
  // suite : il n'y a pas d'étage à remonter, l'écran est la fenêtre entière.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (mode === "reglages" && ouverte !== null) {
        setOuverte(null)
        return
      }
      onFerme()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [mode, ouverte, onFerme])

  const rang = ouverte === null ? -1 : ETAPES.findIndex((e) => e.clef === ouverte)
  const courante = ouverte === null ? null : ETAPES[rang]

  /** Avancer d'une étape — en création, l'étape du nom crée d'abord. */
  const continuer = async () => {
    if (ouverte === "nom") {
      const dit = await poserLeNom()
      if (!dit.ok) return
      // **On ne passe pas par-dessus un avertissement sans l'avoir montré.**
      // Trouvé par l'essai : le geste écrivait la phrase d'homonyme *et*
      // changeait d'étape dans le même clic, si bien que personne ne la lisait
      // jamais. Rien n'est bloqué pour autant — le jeu est déjà créé, et le
      // clic suivant continue. C'est la seule fois où le bouton ne fait pas ce
      // qu'il annonce, et c'est parce qu'il a quelque chose à dire d'abord.
      if (dit.avertissement && dit.avertissement !== avertissement) return
    }
    if (mode === "reglages") {
      setOuverte(null)
      return
    }
    const suivante = ETAPES[rang + 1]
    if (suivante) setOuverte(suivante.clef)
    else onFerme()
  }

  const dossier = cree || mode === "reglages" ? dossierDuJeu : null
  // Le jeu existe-t-il ? En création, seulement après l'étape du nom.
  const pret = mode === "reglages" || cree

  return (
    <main
      data-regles-du-jeu
      data-mode={mode}
      aria-label={mode === "creation" ? "Commencer un jeu" : "Réglages"}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-papier"
    >
      {/* ── L'en-tête et les quatre étapes ──────────────────────────────── */}
      <header className="flex shrink-0 items-end justify-between gap-[22px] border-b border-trait px-[30px] pb-[14px] pt-[22px]">
        <div className="flex min-w-0 flex-col gap-[4px]">
          <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
            {mode === "creation" ? "Commencer un jeu" : "Réglages"}
          </h1>
          <p className="text-[13px] text-encre-2">
            {mode === "creation"
              ? "Cinq étapes, et rien d'autre : ce qui part avec chaque demande d'image ou de son."
              : "Le même parcours, rouvert. On clique l'étape qu'on veut reprendre."}
          </p>
        </div>
        {/* **Une seule sortie par écran** : en réglages, cet écran est le
            premier onglet de `Reglages.tsx`, dont la barre d'onglets porte
            déjà le bouton de sortie et annonce Échap. Deux boutons côte à
            côte qui font la même chose se lisent comme une panne. */}
        {mode === "creation" && (
          <button
            type="button"
            onClick={onFerme}
            className="h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            Fermer
          </button>
        )}
      </header>

      <nav
        aria-label="Les cinq étapes"
        className="flex shrink-0 gap-[4px] border-b border-trait px-[30px] py-[8px]"
      >
        {ETAPES.map((etape, i) => {
          // En création, on n'accède pas à une étape tant que le jeu n'existe
          // pas : l'univers qu'elles règlent n'a pas encore de fichier.
          const atteignable = i === 0 || pret
          return (
            <button
              key={etape.clef}
              type="button"
              disabled={!atteignable}
              aria-current={ouverte === etape.clef}
              onClick={() => setOuverte(etape.clef)}
              className={[
                "flex h-[30px] items-center gap-[8px] rounded-7 px-[14px] text-[13px] transition-colors duration-120",
                ouverte === etape.clef
                  ? "bg-papier-cote font-medium text-encre"
                  : "text-encre-3 hover:text-encre",
                atteignable ? "" : "text-eteint hover:text-eteint",
              ].join(" ")}
            >
              <span className="mesure text-[11px] text-encre-4">{i + 1}</span>
              {etape.titre}
            </button>
          )
        })}
      </nav>

      {/* ── Le corps ─────────────────────────────────────────────────────── */}
      <div className="defile min-h-0 flex-1 overflow-y-auto px-[30px] py-[22px]">
        {courante && (
          <h2 className="mb-[14px] font-serif text-[25px] leading-[1.15] text-encre">
            {courante.question}
          </h2>
        )}

        {ouverte === "nom" && (
          <SonNom
            mode={mode}
            nom={nom}
            onNom={setNom}
            dossier={dossier}
            avertissement={avertissement}
          />
        )}

        {ouverte === "allure" && univers && (
          <SonAllure
            univers={univers}
            tailles={tailles}
            finesses={finesses}
            fondPropose={fondPropose}
            retourDuRealignement={retourDuRealignement}
            onRegler={regler}
            onRealigner={realigner}
          />
        )}

        {ouverte === "vue" && univers && (
          <SaVue univers={univers} vues={vues} onRegler={regler} />
        )}

        {ouverte === "monde" && univers && (
          <SonMonde
            univers={univers}
            atelier={atelier}
            etiquettes={etiquettes}
            onBible={(bible) => regler({ bible })}
            onEtape={setOuverte}
            onEtiquettes={setEtiquettes}
          />
        )}

        {ouverte === "son" && univers && (
          <LeSon univers={univers} projet={dossier} onRegler={regler} />
        )}

        {ouverte !== null && ouverte !== "nom" && !univers && (
          <p className="text-[13px] text-encre-3">Les réglages du jeu se chargent…</p>
        )}

        {/* La liste des quatre — l'entrée du mode réglages. */}
        {ouverte === null && (
          <div className="flex max-w-[880px] flex-col gap-[22px]">
            <ul className="flex flex-col">
              {ETAPES.map((etape, i) => (
                <li key={etape.clef}>
                  <button
                    type="button"
                    onClick={() => setOuverte(etape.clef)}
                    data-etape-des-regles={etape.clef}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-[14px] border-b border-trait py-[14px] text-left transition-colors duration-120 hover:bg-ligne-ouverte"
                  >
                    <span className="mesure text-[11px] text-encre-4">{i + 1}</span>
                    <span className="text-[13.5px] text-encre">{etape.titre}</span>
                    <span className="truncate text-[12.5px] text-encre-3">
                      {resumeDeLEtape(etape.clef, univers, nomDuJeu, dossierDuJeu, vues)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {univers && <ReglesDAilleurs univers={univers} />}
            {/* **Ce qui part avec chaque animation** (18 septembre 2026) : la
                phrase de chaque direction, puis le texte de chaque mouvement.
                Ils étaient rangés, faute de place, dans l'onglet de l'agent. */}
            {mode === "reglages" && dossierDuJeu && (
              <section data-textes-des-animations className="flex flex-col">
                <BlocDirectionsAnimees />
                <BlocMouvements projet={dossierDuJeu} />
                <BlocStyles projet={dossierDuJeu} />
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Le pied — passer, revenir, continuer ─────────────────────────── */}
      {ouverte !== null && (
        <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait px-[30px] py-[14px]">
          <button
            type="button"
            onClick={() => (rang > 0 ? setOuverte(ETAPES[rang - 1].clef) : onFerme())}
            className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            {rang > 0 ? `‹ ${ETAPES[rang - 1].titre}` : mode === "reglages" ? "‹ Réglages" : "Fermer"}
          </button>
          <div className="flex items-center gap-[14px]">
            <span className="text-[11.5px] text-encre-4">
              {mode === "creation"
                ? `Étape ${rang + 1} sur ${ETAPES.length} — chacune se saute.`
                : "Ce qui est déjà fabriqué ne bouge pas."}
            </span>
            {/* **Le seul bouton rouille de l'écran** — la règle de `D0` : le
                rouille ne sert qu'au bouton qui lance et au chiffre qui coûte.
                Ici rien ne coûte, et c'est ce bouton qui mène au bout. */}
            <button
              type="button"
              disabled={enCours || (ouverte === "nom" && !nom.trim())}
              onClick={() => void continuer()}
              className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec disabled:opacity-60"
            >
              {libelleDuBouton(mode, ouverte, rang, cree)}
            </button>
          </div>
        </footer>
      )}
    </main>
  )
}

/** Ce que le bouton de pied annonce — **ce qu'il fait, pas « suivant »**.
 *
 *  En création, l'étape du nom crée ; les suivantes se sautent et le disent, parce
 *  qu'un « suivant » aurait laissé croire qu'il faut régler pour avancer. */
function libelleDuBouton(mode: Mode, ouverte: Etape, rang: number, cree: boolean): string {
  if (mode === "reglages") return "‹ Réglages"
  if (ouverte === "nom") return cree ? "Choisir son allure" : "Créer et choisir son allure"
  if (rang === ETAPES.length - 1) return "Ouvrir le jeu"
  return `Passer à ${ETAPES[rang + 1].titre.toLowerCase()}`
}

/** Une ligne de résumé par étape, pour la liste du mode réglages. */
function resumeDeLEtape(
  etape: Etape,
  univers: Univers | null,
  nom: string,
  dossier: string | null,
  vues: readonly VueDuJeu[],
): string {
  if (etape === "nom") return dossier ? `${nom} · ${dossier}` : nom
  if (!univers) return "…"
  if (etape === "allure") {
    const taille = univers.cible_px ? `${univers.cible_px} px` : "aucune taille"
    if (univers.style !== "pixel") return `dessin · ${taille}`
    return `pixel · ${taille} · ${NOM_DE_LA_METHODE[univers.methode_pixels]}`
  }
  if (etape === "vue") {
    const choisie = vues.find((v) => v.identifiant === univers.vue)
    if (!choisie) return "aucune — le modèle décide seul"
    return `${choisie.libelle} · ${choisie.images} direction${choisie.images > 1 ? "s" : ""}`
  }
  if (etape === "son") {
    const ecrites = univers.son.champs.filter((c) => c.texte.trim()).length
    const reglage = [
      univers.son.tonalite || null,
      univers.son.tempo ? `${univers.son.tempo} BPM` : null,
    ].filter(Boolean)
    const base = `${ecrites} ligne${ecrites > 1 ? "s" : ""} sur 4 écrite${ecrites > 1 ? "s" : ""}`
    return reglage.length ? `${base} · ${reglage.join(" · ")}` : base
  }
  const ecrites = univers.bible.filter(
    (c) => c.texte.trim() && !["rendu", "vue"].includes(c.nom),
  ).length
  return `${ecrites} ligne${ecrites > 1 ? "s" : ""} sur 5 écrite${ecrites > 1 ? "s" : ""}`
}
