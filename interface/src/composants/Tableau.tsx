// Le tableau d'inspiration — la grille de cartes de l'écran Univers, et la
// réserve de la toile, qui est la même grille filtrée.
//
// **Le collage est le geste principal** (`docs/ARCHITECTURE.md` §6.1 : « entrée
// par collage (Ctrl+V, le geste principal) »). Tout le reste — le glisser-
// déposer, l'adresse, le texte — arrive par le même chemin : on colle, et
// l'atelier devine ce que c'est et le dit.
//
// **Ce n'est pas la grille d'assets, et ça se voit.** Une tuile d'asset a le
// rayon 0 et se lit comme une planche contact ; une carte a le rayon 2 du
// châssis, parce qu'elle *est* du châssis — de la matière rassemblée, pas un
// produit du travail. C'est la seule différence de forme, et elle suffit : « une
// seule grille d'assets dans tout le produit » reste vraie, celle-ci n'en est
// pas une.
//
// **Deux vues sur la même matière depuis T8, et une seule grille pour les
// deux.** La réserve n'est pas une grille de plus : c'est celle-ci, filtrée sur
// ce qui n'a encore ni groupe ni place (`docs/DESIGN.md` § La toile, la réserve
// et les îlots). Le corps qui la rend est donc littéralement le même —
// `GrilleCartes` —, et c'est ce qui garantit qu'une carte se lit pareil des deux
// côtés de la frontière.
//
// Les vignettes 1× / 2× / 4× sont les mêmes crans que le zoom de la grille
// d'assets — un seul vocabulaire de taille dans tout le produit.

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  api,
  COULEUR_TEINTE,
  FAMILLES,
  NOM_FAMILLE,
  NOM_TEINTE,
  Refus,
  TEINTES,
  type Carte,
  type Famille,
  type Teinte,
} from "../api"
import { sujetCarte, useVisee } from "./Apercu"
import { Libelle, Raison, Segments } from "./chassis"

const SPAN: Record<number, string> = { 1: "span 1", 2: "span 2", 4: "span 4" }

/** La gouttière de la grille — un seul vocabulaire d'écart dans tout le produit.
 *  La toile la reprend telle quelle pour ranger ce qu'elle dispose seule. */
export const GOUTTIERE = 9

/** La largeur minimale d'une colonne de la grille. Écrite ici parce que la toile
 *  la **mesure** au lieu de la deviner : `gridTemplateColumns` calculé donne la
 *  largeur réelle d'une carte 1×, et c'est d'elle que l'aimant de la largeur
 *  libre tire ses trois crans (`docs/DESIGN.md` § La toile). */
export const COLONNE_MIN = 148

/** Les deux façons de voir la même matière (T8). */
export type Vue = "grille" | "toile"

// ── Le survol qui ouvre, et le clic qui retient ─────────────────────────────
//
// **Le menu d'une carte se pose par-dessus, jamais dans le flux.** Il vivait
// dans la carte, qui grandissait de 300 px en s'ouvrant : la rangée entière
// suivait, et les voisines devenaient des rectangles vides. Une grille qui se
// recompose quand on regarde une carte, c'est ce que le produit refuse déjà
// pour la grille d'assets — « l'œil reste exactement où il était ».
//
// **Le survol révèle, le clic retient.** Le menu porte deux champs de saisie ;
// un menu qui s'évapore parce que le pointeur a dérivé pendant qu'on tape une
// note est inutilisable. Le clic d'avant n'est donc pas remplacé, il devient
// l'épingle — le survol s'ajoute par-dessus.

/** Le repos qu'il faut sur une carte pour que son menu paraisse. Assez long
 *  pour traverser la grille sans rien déclencher, assez court pour battre le
 *  clic — c'est ce que le survol doit gagner sur lui, sinon il ne sert à rien. */
const REPOS_MS = 200

/** La grâce avant qu'un menu non épinglé s'efface : le temps de traverser la
 *  gouttière de 9 px qui sépare la carte de son menu, sans le perdre. */
const GRACE_MS = 150

/** Ce qu'on laisse entre le menu et le bord du tableau. La gouttière de la
 *  grille — un seul vocabulaire d'écart dans tout le produit. */
const MARGE = 9

/**
 * Le survol, tenu **une fois pour toutes les cartes** : il n'y en a qu'un à la
 * fois, et une minuterie par carte sur cinquante cartes, ce sont cinquante
 * minuteries à annuler quand le pointeur traverse la grille.
 *
 * Partagé par la grille et par la toile depuis T8 : une carte se survole pareil
 * des deux côtés, et deux minuteries concurrentes se voleraient le menu.
 */
export function useSurvol(epingle: boolean) {
  const [survolee, setSurvolee] = useState<string | null>(null)
  const minuterie = useRef<number | null>(null)

  const survoler = (identifiant: string, dedans: boolean) => {
    if (minuterie.current !== null) clearTimeout(minuterie.current)
    if (dedans) {
      // **On ne vole pas un menu à un clavier en train de s'en servir.** Sans
      // cette ligne, épingler une carte pour taper sa note, puis dériver d'un
      // pixel vers la voisine, effacerait le champ sous les doigts.
      //
      // **Ce qui est épinglé n'est plus forcément une carte** (T9) : la toile
      // épingle aussi le pavé d'un lien, qui porte le champ du mot, et le menu
      // d'un îlot. Le garde recevait jusqu'ici l'identifiant de la carte
      // choisie, et il aurait donc été aveugle exactement là où on tape — la
      // règle était juste, son hypothèse a changé sous elle. Il reçoit
      // désormais la question qu'il posait déjà : *y a-t-il quelque chose
      // d'épinglé ?*
      const saisieEnCours =
        epingle &&
        document.activeElement instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      if (saisieEnCours) return
      minuterie.current = window.setTimeout(() => setSurvolee(identifiant), REPOS_MS)
    } else {
      minuterie.current = window.setTimeout(() => setSurvolee(null), GRACE_MS)
    }
  }

  useEffect(
    () => () => {
      if (minuterie.current !== null) clearTimeout(minuterie.current)
    },
    [],
  )

  return { survolee, survoler }
}

// ── Coller ──────────────────────────────────────────────────────────────────
//
// **Le collage devine et le dit** (`docs/PRD.md` § Ce qui entre par la main) :
// des octets d'image font une carte image, une adresse fait une carte en
// attente, le reste fait une carte texte. Il n'y a aucun menu à traverser
// avant de coller.
//
// **Branché une seule fois, au-dessus des deux vues** (T8). L'écoute est posée
// sur la fenêtre : deux surfaces qui l'installeraient chacune feraient deux
// cartes pour un collage. Et « coller pendant qu'on compose » n'a rien de
// particulier à faire — une carte neuve n'a ni groupe ni place, donc elle
// paraît en réserve et rien ne bouge sur la toile.

export type Doublon = { nom: string; carte: Carte }

export function useCollage({
  onErreur,
  onRafraichir,
}: {
  onErreur: (raison: string) => void
  onRafraichir: () => void
}) {
  const [doublon, setDoublon] = useState<Doublon | null>(null)

  const collerFichier = async (fichier: File, forcer = false) => {
    try {
      const rendue = await api.collerImage(fichier, fichier.name || "l'image collée", forcer)
      if (rendue.doublon) setDoublon({ nom: fichier.name, carte: rendue.doublon })
      else onRafraichir()
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "collage refusé")
    }
  }

  const collerTexte = async (texte: string) => {
    const propre = texte.trim()
    if (!propre) return
    try {
      // Une adresse est une adresse ; tout le reste est une intention. La
      // règle est ici parce que c'est un geste d'écran, mais le serveur la
      // rejoue et refuse ce qui n'est pas du http(s) : l'écran devine, il ne
      // décide pas.
      if (/^https?:\/\/\S+$/i.test(propre)) await api.collerAdresse(propre)
      else await api.collerTexte(propre)
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "collage refusé")
    }
  }

  useEffect(() => {
    const surColle = (evenement: ClipboardEvent) => {
      const presse = evenement.clipboardData
      if (!presse) return
      const fichiers = Array.from(presse.files)
      if (fichiers.length) {
        evenement.preventDefault()
        // **Un appel par fichier, et chacun répond pour lui-même** : « savoir
        // lequel des douze fichiers déposés pose problème » (US-45). Les onze
        // premières cartes paraissent sans attendre que la douzième soit lue.
        fichiers.forEach((fichier) => void collerFichier(fichier))
        return
      }
      const texte = presse.getData("text/plain")
      if (texte.trim()) {
        evenement.preventDefault()
        void collerTexte(texte)
      }
    }
    window.addEventListener("paste", surColle)
    return () => window.removeEventListener("paste", surColle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { doublon, setDoublon, collerFichier, collerTexte }
}

/** Ce qu'une surface doit brancher pour accepter un dépôt de fichiers.
 *
 *  Chaque surface tient **son** état de survol : la grille, la toile et la
 *  réserve peuvent recevoir un dépôt, et un état partagé les allumerait toutes
 *  les trois pour un seul pointeur. */
export function useDepot(
  collerFichier: (f: File) => void,
  collerTexte: (t: string) => void,
) {
  const [survole, setSurvole] = useState(false)
  return {
    survole,
    props: {
      onDragOver: (evenement: React.DragEvent) => {
        // Un glissement venu de la réserve n'est pas un dépôt de fichier : la
        // toile s'en occupe elle-même, et l'allumer ici dirait le contraire.
        if (evenement.dataTransfer.types.includes(GLISSE_CARTE)) return
        evenement.preventDefault()
        setSurvole(true)
      },
      onDragLeave: () => setSurvole(false),
      onDrop: (evenement: React.DragEvent) => {
        if (evenement.dataTransfer.types.includes(GLISSE_CARTE)) return
        evenement.preventDefault()
        setSurvole(false)
        Array.from(evenement.dataTransfer.files).forEach((f) => void collerFichier(f))
        const texte = evenement.dataTransfer.getData("text/plain")
        if (!evenement.dataTransfer.files.length && texte) void collerTexte(texte)
      },
    },
  }
}

/** Le type que porte une carte tirée de la réserve vers la toile.
 *
 *  Un type à nous, et **pas `text/plain`** : une carte lâchée à côté de la
 *  toile deviendrait alors une carte texte portant un identifiant, c'est-à-dire
 *  une note dont personne n'a jamais voulu. Le glissement qui traverse la
 *  frontière est du code maison, et il se reconnaît à son étiquette. */
export const GLISSE_CARTE = "application/x-carte-atelier"

/** Ce que le pied d'une carte porte quand elle n'a ni famille ni groupe.
 *
 *  **Une mesure ne s'affiche que si elle a été prise.** Une carte d'adresse qui
 *  n'a pas abouti annonçait `0×0` — un fait mesuré sur une image qui n'existe
 *  pas. Vu en ouvrant l'atelier : le produit dit partout « les dimensions
 *  mesurées font foi », et zéro n'est pas une dimension mesurée, c'est
 *  l'absence de mesure. */
const pied = (carte: Carte) => {
  if (carte.genre === "texte") return "note"
  if (!carte.montrable) return carte.statut === "echouee" ? "sans image" : "en route"
  return `${carte.largeur}×${carte.hauteur}`
}

// ── La grille, et la réserve qui en est une lecture ──────────────────────────

/** Le corps de la grille — **un seul, pour les deux vues**.
 *
 *  La réserve « n'introduit pas une grille de plus : c'est la grille du tableau,
 *  filtrée sur ce qui n'a pas encore de place » (`docs/ARCHITECTURE.md` §6.2).
 *  Le filtrage se fait chez l'appelant, le rendu est ici, et il n'y a donc rien
 *  qui puisse diverger entre les deux côtés de la frontière. */
export function GrilleCartes({
  cartes,
  choisie,
  survolee,
  onSurvol,
  onChoisir,
  onErreur,
  glissable = false,
  cadre,
  vide,
}: {
  cartes: Carte[]
  choisie: string | null
  survolee: string | null
  onSurvol: (identifiant: string, dedans: boolean) => void
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  /** Vrai dans la réserve : une carte s'en tire vers la toile. */
  glissable?: boolean
  /** Le nœud de la grille elle-même, dont la toile mesure les colonnes.
   *
   *  **C'est pour lui que la grille est rendue même vide.** L'aimant de la
   *  largeur libre se règle sur la largeur réelle d'une colonne ; une grille
   *  qu'on remplace par un état vide n'a pas de colonne à mesurer, et la toile
   *  perdrait son repère au moment précis où la réserve se vide — c'est-à-dire
   *  quand tout est classé, donc quand on compose le plus. */
  cadre?: React.Ref<HTMLDivElement>
  /** Ce qui paraît quand il n'y a rien — **à côté de la grille, pas à sa
   *  place** : elle reste là pour être mesurée. */
  vide?: ReactNode
}) {
  return (
    <div className="defile min-h-0 flex-1 overflow-y-auto p-4">
      <div
        ref={cadre}
        data-grille
        className="grid"
        style={{
          gap: GOUTTIERE,
          gridTemplateColumns: `repeat(auto-fill, minmax(${COLONNE_MIN}px, 1fr))`,
        }}
      >
        {cartes.map((carte) => (
          <CarteTuile
            key={carte.identifiant}
            carte={carte}
            choisie={carte.identifiant === choisie}
            survolee={carte.identifiant === survolee}
            glissable={glissable}
            onSurvol={(dedans) => onSurvol(carte.identifiant, dedans)}
            onChoisir={() =>
              onChoisir(carte.identifiant === choisie ? null : carte.identifiant)
            }
            onErreur={onErreur}
          />
        ))}
      </div>
      {cartes.length === 0 && vide}
    </div>
  )
}

export function Tableau({
  cartes,
  vue,
  onVue,
  choisie,
  onChoisir,
  onErreur,
  collage,
}: {
  cartes: Carte[]
  vue: Vue
  onVue: (vue: Vue) => void
  choisie: string | null
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  collage: ReturnType<typeof useCollage>
}) {
  const { survolee, survoler } = useSurvol(choisie !== null)
  const depot = useDepot(collage.collerFichier, collage.collerTexte)

  return (
    <section
      {...depot.props}
      className={[
        "flex min-h-0 min-w-0 flex-1 flex-col border-l border-bord",
        depot.survole ? "bg-fond-2" : "bg-fond-0",
      ].join(" ")}
    >
      <BarreTableau cartes={cartes} vue={vue} onVue={onVue} />
      <BandeauDoublon collage={collage} onChoisir={onChoisir} onErreur={onErreur} />

      {cartes.length === 0 ? (
        <Vide />
      ) : (
        <GrilleCartes
          cartes={cartes}
          choisie={choisie}
          survolee={survolee}
          onSurvol={survoler}
          onChoisir={onChoisir}
          onErreur={onErreur}
        />
      )}
    </section>
  )
}

/**
 * La réserve — **la grille du tableau, filtrée sur ce qui reste à classer**.
 *
 * « La toile montre ce qui est classé, la réserve contient ce qui reste à
 * classer » : c'est la phrase entière de l'écran, et cette colonne en est la
 * seconde moitié. Elle reprend la 380 de la fiche asset, pour ce que cette
 * largeur nomme déjà — la colonne de ce qu'on manipule.
 *
 * Le filtre est `en_reserve`, que **le serveur calcule** : ni classée, ni posée.
 * L'écran ne rejoue pas la règle de son côté.
 */
export function Reserve({
  cartes,
  choisie,
  onChoisir,
  onErreur,
  collage,
  cadre,
  onDepot,
}: {
  cartes: Carte[]
  choisie: string | null
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  collage: ReturnType<typeof useCollage>
  /** Mesuré par la toile : la largeur réelle d'une colonne de cette grille est
   *  ce qui donne à l'aimant ses trois crans. */
  cadre?: React.Ref<HTMLDivElement>
  /** Une carte ramenée de la toile : elle perd sa place **et** son groupe. */
  onDepot: (carte: string) => void
}) {
  const { survolee, survoler } = useSurvol(choisie !== null)
  const depot = useDepot(collage.collerFichier, collage.collerTexte)
  const enReserve = cartes.filter((c) => c.en_reserve)
  const glisseCarte = (evenement: React.DragEvent) =>
    evenement.dataTransfer.types.includes(GLISSE_CARTE)

  return (
    <aside
      data-reserve
      {...depot.props}
      onDragOver={(evenement) => {
        if (glisseCarte(evenement)) evenement.preventDefault()
        else depot.props.onDragOver(evenement)
      }}
      onDrop={(evenement) => {
        if (!glisseCarte(evenement)) return depot.props.onDrop(evenement)
        evenement.preventDefault()
        onDepot(evenement.dataTransfer.getData(GLISSE_CARTE))
      }}
      className={[
        "flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord",
        depot.survole ? "bg-fond-2" : "bg-fond-1",
      ].join(" ")}
    >
      <div className="mesure flex h-[30px] shrink-0 items-center gap-2 border-b border-bord px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Réserve
        <span className="tracking-normal text-texte-2 normal-case">
          {enReserve.length} à classer
        </span>
      </div>

      <GrilleCartes
        cartes={enReserve}
        choisie={choisie}
        survolee={survolee}
        onSurvol={survoler}
        onChoisir={onChoisir}
        onErreur={onErreur}
        glissable
        cadre={cadre}
        vide={
          <div className="flex flex-col items-center gap-2 pt-10">
            <p className="text-center font-serif text-[20px] leading-tight text-texte-2">
              Tout est classé.
            </p>
            <p className="mesure max-w-[280px] text-center text-[9.5px] leading-relaxed text-texte-3">
              Ce que tu colleras maintenant paraîtra ici, jamais au milieu d'un
              îlot qu'on vient de faire.
            </p>
          </div>
        }
      />
    </aside>
  )
}

/** Le bandeau du doublon proposé — jamais un refus, une proposition (US-46). */
function BandeauDoublon({
  collage,
  onChoisir,
  onErreur,
}: {
  collage: ReturnType<typeof useCollage>
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
}) {
  const { doublon, setDoublon, collerFichier } = collage
  if (!doublon) return null
  return (
    <div className="mesure flex h-[38px] shrink-0 items-center gap-2 border-b border-bord bg-fond-1 px-4 text-[10px] text-epingle">
      <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
      <span>« {doublon.nom} » est déjà sur le tableau</span>
      <button
        type="button"
        onClick={() => {
          onChoisir(doublon.carte.identifiant)
          setDoublon(null)
        }}
        className="text-signal hover:text-signal-clair"
      >
        La voir ›
      </button>
      <span className="text-texte-3">·</span>
      <button
        type="button"
        onClick={() => {
          const nom = doublon.nom
          setDoublon(null)
          onErreur("")
          void (async () => {
            // Réimporter demande les octets ; on les redemande à la carte
            // existante plutôt que de garder le fichier collé en mémoire.
            const reponse = await fetch(
              api.imageCarte(doublon.carte.identifiant, doublon.carte.empreinte),
            )
            await collerFichier(
              new File([await reponse.blob()], nom, { type: "image/png" }),
              true,
            )
          })()
        }}
        className="text-signal hover:text-signal-clair"
      >
        Importer quand même ›
      </button>
    </div>
  )
}

/**
 * La barre du tableau, et l'interrupteur de vue.
 *
 * **`grille` et `toile` sont un segment de barre, pas un onglet** (`docs/DESIGN.md`
 * § La toile, la réserve et les îlots) : l'écran ne se dédouble pas, c'est la
 * même matière regardée autrement. Il se pose à côté de ce qui compte les
 * cartes, dans la forme des segments existants.
 *
 * **Les groupes se lisent sur les cartes que l'écran tient**, et non sur la
 * liste que la route a rendue au chargement. Depuis T8 composer *écrit* des
 * groupes à chaque glissement : une liste posée une fois serait fausse avant la
 * fin du premier geste. La règle qui la calcule est la même des deux côtés —
 * les groupes non vides des cartes — et il n'y en a plus qu'une à l'écran.
 */
export function BarreTableau({
  cartes,
  vue,
  onVue,
}: {
  cartes: Carte[]
  vue: Vue
  onVue: (vue: Vue) => void
}) {
  const artworks = cartes.filter((c) => c.artwork).length
  const groupes = groupesDe(cartes)
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-bord bg-fond-1 px-4">
      <span className="mesure shrink-0 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Tableau
      </span>
      <span className="mesure shrink-0 text-[10px] text-texte-2">
        {cartes.length} carte{cartes.length > 1 ? "s" : ""}
      </span>
      {artworks > 0 && (
        <span className="mesure shrink-0 text-[10px] text-signal">
          {artworks} artwork{artworks > 1 ? "s" : ""} officiel{artworks > 1 ? "s" : ""}
        </span>
      )}
      {groupes.length > 0 && (
        <span className="mesure min-w-0 truncate text-[10px] text-texte-3">
          {groupes.join(" · ")}
        </span>
      )}
      {/* `min-w-0` sur ce qui doit céder, `shrink-0` sur ce qui doit rester :
          une barre sans retour à la ligne qui demande plus que sa colonne
          élargit la colonne, puis la page — et pousse hors de l'écran ce qui est
          ancré à droite. */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Libelle aide="tableau.vue">Vue</Libelle>
        <Segments
          valeurs={["grille", "toile"] as const}
          valeur={vue}
          onChange={onVue}
        />
      </div>
    </div>
  )
}

/**
 * Les sept pastilles d'une teinte — **six couleurs et le châssis**.
 *
 * « La liste est fermée, et il n'existe aucun sélecteur libre : le premier îlot
 * rouge vif se lirait comme un échec » (`docs/DESIGN.md` § Les teintes d'îlot).
 * Elles prennent la forme exacte du carré de palette de l'écran Univers — le
 * seul motif de couleur nue du produit —, parce qu'une pastille n'est pas une
 * marque : c'est la couleur montrée.
 *
 * **La septième n'est pas une septième teinte, c'est l'absence de teinte
 * montrée.** Un îlot sans couleur porte celle du châssis — `--fond-2` bordé
 * `--bord` —, et `docs/DESIGN.md` dit que c'est *ce qu'il est*, pas un réglage
 * manquant. La rendre évite un huitième glyphe en forme de croix, et la liste
 * close du domaine ne bouge pas d'un nom : `atelier/domaine/teinte.py` garde
 * ses six, et le vide reste ce qu'il a toujours été — une valeur.
 *
 * Partagée par la note et par l'îlot, parce que c'est le même geste sur deux
 * objets. Deux rangées écrites à deux endroits auraient fini par proposer deux
 * listes.
 */
export function Pastilles({
  teinte,
  onChoisir,
}: {
  teinte: Teinte
  onChoisir: (teinte: Teinte) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["", ...TEINTES] as Teinte[]).map((valeur) => (
        <button
          key={valeur || "aucune"}
          type="button"
          aria-label={valeur ? NOM_TEINTE[valeur] : "sans teinte"}
          aria-pressed={teinte === valeur}
          onClick={() => onChoisir(valeur)}
          style={valeur ? { background: COULEUR_TEINTE[valeur] } : undefined}
          className={[
            "h-5 w-5 rounded-[2px] border transition-colors duration-[80ms]",
            valeur ? "border-bord" : "border-bord bg-fond-2",
            // L'anneau de la chose choisie, et il n'en existe qu'un dans le
            // produit : `--lumiere` ne veut dire que ça.
            teinte === valeur ? "ring-2 ring-lumiere" : "",
          ].join(" ")}
        />
      ))}
    </div>
  )
}

/** Les groupes qui existent — c'est-à-dire les îlots. **Une seule définition
 *  dans tout l'écran** : un îlot *est* le groupe, et deux façons de dresser la
 *  liste finiraient par en montrer une de plus que la toile n'en dessine. */
export function groupesDe(cartes: Carte[]): string[] {
  return [...new Set(cartes.map((c) => c.groupe).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  )
}

/** L'état vide. En serif, parce que c'est une invitation et non un message
 *  d'erreur — `docs/DESIGN.md` § Typography, règle 1. */
function Vide() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="font-serif text-[32px] leading-tight text-texte-2">
        Le tableau est vide. <span className="italic text-texte">Colle.</span>
      </p>
      <p className="mesure max-w-[420px] text-center text-[10px] leading-relaxed text-texte-3">
        Une image devient une carte. Une adresse fait paraître une carte en
        attente, et l'image arrive ensuite. Un texte devient une note au milieu
        des images.
      </p>
    </div>
  )
}

// ── Une carte ───────────────────────────────────────────────────────────────

/**
 * Une carte — **la même des deux côtés de la frontière**.
 *
 * « Une carte sur la toile est la carte du tableau, sans un pixel de
 * différence : même rayon 2, même menu au survol, même coin plein pour l'artwork
 * officiel » (`docs/DESIGN.md`). Une seconde forme de carte ferait une troisième
 * grille dans un produit qui n'en veut qu'une, d'où un seul composant et deux
 * façons de le poser.
 *
 * **Ce que `plan` change, et rien d'autre** : dans la grille, la carte occupe
 * son cran de colonnes et son image tient dans un carré ; sur la toile, elle
 * remplit le nœud qu'on lui a donné et son image garde **son** rapport, parce
 * qu'une place sur un plan est une place et non une case. Le rayon, le menu, le
 * coin et le pied ne bougent pas.
 */
export function CarteTuile({
  carte,
  choisie,
  survolee,
  plan = false,
  glissable = false,
  onSurvol,
  onChoisir,
  onErreur,
}: {
  carte: Carte
  /** Épinglée par un clic : son menu ne s'efface plus au survol perdu. */
  choisie: boolean
  /** Le pointeur s'est reposé dessus assez longtemps. */
  survolee: boolean
  /** Posée sur la toile plutôt que dans la grille. */
  plan?: boolean
  /** Tirable vers la toile — vrai dans la réserve seulement. */
  glissable?: boolean
  onSurvol: (dedans: boolean) => void
  onChoisir: () => void
  onErreur: (raison: string) => void
}) {
  const ouvert = choisie || survolee
  // **La teinte d'une note colore sa surface, jamais une marque posée dessus**
  // (`docs/DESIGN.md` § Les teintes d'îlot, discipline n°2). Le fond à 8 %, sous
  // le seuil où l'œil la trouve seule et assez pour délimiter — la même valeur
  // que le fond d'un îlot, parce que c'est la même chose : une surface qui dit
  // à quoi elle appartient.
  //
  // **Le bord cède à l'anneau `--lumiere`, le fond jamais.** *Choisi* est un
  // état et un état l'emporte sur un rangement — mais faire céder les deux
  // rendait la teinte invisible tant que la carte reste choisie, c'est-à-dire
  // **à l'instant précis où on vient de la choisir** : on cliquait une pastille
  // et rien ne changeait. Vu à l'atelier lancé. Les deux ne se disputent que le
  // bord, et le bord suffit à dire *choisi*.
  const teinte = carte.genre === "texte" ? carte.teinte : ""
  const couleur = teinte ? COULEUR_TEINTE[teinte] : null
  // **La visée n'est pas le survol du menu, et les deux vivent côte à côte.**
  // Le menu attend 200 ms de repos parce qu'il se déploie et qu'il déplace le
  // regard ; l'aperçu ne se déploie pas tant qu'on n'a pas appuyé, donc il n'a
  // aucune raison de faire attendre. Une note ne rend pas de sujet : Espace n'y
  // fait rien, et c'est la bonne réponse — son texte est déjà entier.
  const visee = useVisee(sujetCarte(carte))
  return (
    <article
      style={{
        ...(plan
          ? { width: "100%", height: "100%" }
          : { gridColumn: SPAN[carte.taille] ?? "span 1" }),
        ...(couleur
          ? {
              background: `color-mix(in srgb, ${couleur} 8%, var(--color-fond-2))`,
              ...(choisie ? {} : { borderColor: couleur }),
            }
          : {}),
      }}
      onPointerEnter={() => {
        visee.entrer()
        onSurvol(true)
      }}
      onPointerLeave={() => {
        visee.sortir()
        onSurvol(false)
      }}
      className={[
        // `relative` et **pas** `overflow-hidden` : le menu se pose par-dessus
        // les voisines, donc il doit pouvoir sortir de la carte. Le rognage des
        // coins descend sur l'image, qui est la seule chose à rogner.
        "relative flex flex-col rounded-[2px] border bg-fond-2 transition-colors duration-[80ms]",
        choisie ? "border-lumiere shadow-[0_0_0_2px_var(--color-lumiere)]" : "border-bord",
        // La carte ouverte passe devant ses voisines, et devant le menu d'une
        // autre qui serait en train de s'effacer.
        ouvert ? "z-20" : "z-0",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onChoisir}
        draggable={glissable}
        onDragStart={(evenement) => {
          if (!glissable) return
          evenement.dataTransfer.setData(GLISSE_CARTE, carte.identifiant)
          evenement.dataTransfer.effectAllowed = "move"
        }}
        aria-label={carte.genre === "texte" ? "Ouvrir la note" : "Ouvrir la carte"}
        className={[
          "relative block w-full overflow-hidden rounded-t-[2px]",
          // Sur la toile, l'image prend ce que le pied laisse : c'est le nœud
          // qui porte la hauteur, et elle a été calculée sur le rapport.
          plan ? "min-h-0 flex-1" : "",
        ].join(" ")}
      >
        {carte.genre === "texte" ? (
          <p
            className={[
              "p-3 text-left text-[12.5px] leading-relaxed text-texte",
              plan ? "h-full overflow-hidden" : "min-h-[92px]",
            ].join(" ")}
          >
            {carte.texte}
          </p>
        ) : carte.montrable ? (
          <img
            src={api.imageCarte(carte.identifiant, carte.empreinte)}
            alt={carte.note || carte.source || "carte"}
            className={[
              "damier w-full object-contain",
              plan ? "h-full" : "aspect-square",
            ].join(" ")}
          />
        ) : (
          <Attente carte={carte} plan={plan} />
        )}

        {/* La seule marque visuelle, comme le coin favori d'une tuile : ce que
            l'auteur pose est une forme, ce que le système constate est un mot. */}
        {carte.artwork && (
          <span
            aria-label="artwork officiel"
            className="absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-t-signal border-l-transparent"
          />
        )}
      </button>

      <div className="mesure flex shrink-0 items-center gap-1.5 border-t border-bord px-1.5 py-1 text-[9.5px] text-texte-3">
        {carte.artwork ? (
          <span className="text-signal">{NOM_FAMILLE[carte.famille]}</span>
        ) : carte.groupe ? (
          <span className="truncate">{carte.groupe}</span>
        ) : (
          <span className="truncate">{pied(carte)}</span>
        )}
        {/* **Posée n'est pas classée, et le pied le dit** (US-104). Une carte
            sur la toile hors de tout îlot est un état réel — le brouillon,
            trois images côte à côte pour voir si elles vont ensemble — et il
            n'existe aucune autre marque à l'écran qui le distingue d'un îlot
            d'une seule carte. */}
        {plan && !carte.groupe && <span className="text-texte-3 italic">posée</span>}
        <span className="ml-auto">{carte.taille}×</span>
      </div>

      {ouvert && <Menu carte={carte} borne={!plan} onErreur={onErreur} />}
    </article>
  )
}

/**
 * Le menu d'une carte — posé **sous** la carte, ou au-dessus d'elle si le bas
 * du tableau est trop près, jamais dessus.
 *
 * C'est la règle qui répond à « le menu est plus grand que la vignette » : il
 * fait 300 px pour une carte 1× qui en fait 190, donc il déborde forcément.
 * Il déborde sur les **voisines**, hors du flux — et jamais sur l'image qu'il
 * règle, ce qui serait absurde puisque c'est elle qu'on regarde en réglant.
 *
 * Largeur : celle de la carte, et au moins 240 px. Une carte 1× est trop
 * étroite pour la rangée des familles, qui y passerait à cinq lignes.
 *
 * **Sur la toile, il ne se borne pas, et c'est une décision** : un plan n'a pas
 * de bord contre lequel un menu se cogne — on le déplace, ou on l'agrandit. Une
 * hauteur maximale mesurée en pixels d'écran serait de toute façon fausse dès le
 * premier cran de zoom, puisqu'elle s'appliquerait à l'intérieur d'une surface
 * mise à l'échelle.
 */
function Menu({
  carte,
  borne = true,
  onErreur,
}: {
  carte: Carte
  borne?: boolean
  onErreur: (r: string) => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{
    haut: boolean
    gauche: boolean
    hauteurMax: number | null
  }>({ haut: false, gauche: false, hauteurMax: null })

  // Mesuré à l'ouverture, une fois. Le tableau ne défile pas sous un menu
  // ouvert — le pointeur est dessus — donc il n'y a rien à suivre ensuite.
  //
  // **La place se mesure autour de la carte, jamais autour du menu.** Première
  // écriture faite dans l'autre sens : le menu rendu par défaut sous la carte,
  // on regardait la place au-dessus de *lui*, qui comprend la carte entière.
  // Il basculait donc vers le haut en croyant tenir, et se posait 200 px
  // au-dessus du cadre visible. La carte est l'ancre ; c'est autour d'elle
  // qu'on compte.
  useEffect(() => {
    if (!borne) return
    const el = boite.current
    const ancre = el?.parentElement
    const defilant = el?.closest(".defile")
    if (!el || !ancre || !defilant) return

    const cadre = defilant.getBoundingClientRect()
    const carte = ancre.getBoundingClientRect()
    // `scrollHeight` et non `offsetHeight` : la hauteur que le menu *veut*,
    // même quand un plafond posé au passage précédent la lui a déjà retirée.
    const veut = el.scrollHeight + 2

    const dessous = cadre.bottom - carte.bottom - MARGE
    const dessus = carte.top - cadre.top - MARGE
    // Dessous d'abord — c'est là qu'on regarde après avoir regardé l'image.
    // On ne bascule que si ça ne tient pas dessous **et** que ça tient mieux
    // dessus ; sinon on reste dessous et c'est le plafond qui règle le reste.
    const haut = veut > dessous && dessus > dessous
    const offert = haut ? dessus : dessous

    setPlace({
      haut,
      // Le menu déborde à droite du cadre : il s'aligne sur le bord droit de la
      // carte au lieu du gauche. La largeur est celle de la carte, au moins 240.
      gauche: carte.left + Math.max(carte.width, 240) > cadre.right,
      // **Un menu est borné par l'écran, jamais par son contenu** — la règle du
      // § Layout, un cran plus bas. Sur un écran court il n'y a la place ni
      // au-dessus ni en dessous : il prend alors exactement ce qui est offert et
      // défile en dedans. Sans plancher, exprès — un plancher rendait le menu
      // plus haut que la place, donc rogné par le cadre du tableau, donc son
      // pied inatteignable. Un menu court qui défile vaut mieux qu'un menu
      // complet dont on ne peut pas atteindre « Retirer ».
      hauteurMax: veut > offert ? offert : null,
    })
  }, [carte.identifiant, borne])

  return (
    <div
      ref={boite}
      style={place.hauteurMax ? { maxHeight: place.hauteurMax } : undefined}
      className={[
        "absolute z-30 min-w-[240px] rounded-[2px] border border-bord bg-fond-1",
        // Le fondu : le menu paraît **sans clic**, donc sans geste qui dise
        // qu'on l'a demandé. 80 ms suffisent à dire « ceci est venu se poser
        // par-dessus » plutôt que « la grille s'est recomposée » — c'est ce que
        // le mouvement porte ici, et c'est ce qui le fait entrer dans la liste
        // close du § Motion.
        "paraitre",
        place.hauteurMax ? "defile overflow-y-auto" : "",
        place.haut ? "bottom-full mb-[3px]" : "top-full mt-[3px]",
        place.gauche ? "right-0" : "left-0",
      ].join(" ")}
    >
      <Reglages carte={carte} onErreur={onErreur} />
    </div>
  )
}

/** Une carte d'adresse qui n'a pas encore son image — ou qui ne l'aura pas.
 *
 *  Elle garde son adresse et sa raison (US-43), et elle ne se retente pas toute
 *  seule : « rien n'est jamais relancé automatiquement » vaut ici comme pour une
 *  génération coupée. */
function Attente({ carte, plan = false }: { carte: Carte; plan?: boolean }) {
  const echouee = carte.statut === "echouee"
  return (
    <div
      className={[
        "flex w-full flex-col justify-center gap-1.5 p-3 text-left",
        plan ? "h-full" : "aspect-square",
        echouee ? "bg-echec/5" : "bg-fond-2",
      ].join(" ")}
    >
      <span
        className={["mesure text-[10px]", echouee ? "text-echec" : "text-epingle"].join(" ")}
      >
        {echouee ? "pas arrivée" : "en attente…"}
      </span>
      <span className="mesure break-all text-[9.5px] leading-snug text-texte-3">
        {carte.source}
      </span>
      {carte.raison && (
        <span className="mesure text-[9.5px] leading-snug text-echec">{carte.raison}</span>
      )}
    </div>
  )
}

/** Ce qu'on règle sur une carte : son groupe, sa note, sa taille, sa promotion.
 *
 *  Dans la carte et non dans un panneau : une carte porte quatre réglages, un
 *  asset en porte quinze. Ouvrir un panneau pour quatre champs ferait perdre le
 *  tableau, qui est exactement ce qu'on regarde en les posant.
 *
 *  **C'est ici que naît un îlot, et il n'y a pas d'autre geste pour ça** (T8).
 *  Un îlot *est* un groupe : taper un nom qui n'existait pas le fait paraître
 *  sur la toile, et le dernier membre qui en sort l'emporte. Un bouton
 *  « nouvel îlot » aurait créé un îlot vide, c'est-à-dire un groupe qui n'est
 *  écrit sur aucune carte — donc rien. */
function Reglages({ carte, onErreur }: { carte: Carte; onErreur: (r: string) => void }) {
  const [groupe, setGroupe] = useState(carte.groupe)
  const [note, setNote] = useState(carte.note)
  const [texte, setTexte] = useState(carte.texte)

  useEffect(() => {
    setGroupe(carte.groupe)
    setNote(carte.note)
    setTexte(carte.texte)
  }, [carte.identifiant])

  const echouer = (erreur: unknown, defaut: string) =>
    onErreur(erreur instanceof Refus ? erreur.message : defaut)

  const regler = async (reglage: Parameters<typeof api.reglerCarte>[1]) => {
    try {
      await api.reglerCarte(carte.identifiant, reglage)
    } catch (erreur) {
      echouer(erreur, "réglage refusé")
    }
  }

  const promouvoir = async (officiel: boolean, famille = carte.famille) => {
    try {
      await api.promouvoir(carte.identifiant, officiel, famille)
    } catch (erreur) {
      echouer(erreur, "promotion refusée")
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Les deux seuls champs du produit qui n'avaient pas de libelle : leur
          nom vivait dans un `placeholder`, donc il disparaissait des qu'on
          tapait dedans. Un champ dont le nom s'efface ne peut ni s'identifier
          ni porter une explication — c'est exactement ce qui a rendu `groupe`
          incomprehensible. */}
      <div className="flex flex-col gap-1">
        <Libelle aide="carte.groupe">Groupe</Libelle>
        <input
          value={groupe}
          placeholder="aucun"
          onChange={(e) => setGroupe(e.target.value)}
          onBlur={() => groupe !== carte.groupe && void regler({ groupe })}
          className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Libelle aide="carte.note">Note</Libelle>
        <textarea
          value={note}
          placeholder="—"
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== carte.note && void regler({ note })}
          className="resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11.5px] leading-snug text-texte placeholder:text-texte-3"
        />
      </div>

      <div className="flex items-center justify-between">
        <Libelle aide="carte.taille">Taille</Libelle>
        <Segments
          valeurs={[1, 2, 4] as const}
          valeur={carte.taille}
          onChange={(taille) => void regler({ taille })}
        />
      </div>

      {/* **Ce qui n'appartient qu'à une note**, et qui n'existe donc pas sur une
          carte image : son texte, et sa teinte. L'absence du bloc **est** le
          critère « une carte image ne porte aucune couleur d'organisation » —
          rien n'est grisé, parce qu'il n'y a pas de réglage à refuser. C'est la
          symétrique exacte du bloc *Artwork officiel*, qui n'existe que pour une
          image. */}
      {carte.genre === "texte" && (
        <div className="flex flex-col gap-2 border-t border-bord pt-2">
          <div className="flex flex-col gap-1">
            <Libelle aide="note.texte">Texte</Libelle>
            <textarea
              value={texte}
              rows={3}
              onChange={(e) => setTexte(e.target.value)}
              onBlur={() =>
                texte.trim() && texte !== carte.texte && void regler({ texte })
              }
              className="resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11.5px] leading-snug text-texte"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Libelle aide="note.teinte">Teinte de la note</Libelle>
            <Pastilles
              teinte={carte.teinte}
              onChoisir={(teinte) => void regler({ teinte })}
            />
          </div>
        </div>
      )}

      {carte.genre === "image" && (
        <div className="flex flex-col gap-1.5 border-t border-bord pt-2">
          <div className="flex items-center justify-between">
            <Libelle aide="carte.officiel">Artwork officiel</Libelle>
            <button
              type="button"
              onClick={() => void promouvoir(!carte.officiel)}
              disabled={carte.statut !== "prete"}
              aria-pressed={carte.officiel}
              className={[
                "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
                carte.statut !== "prete"
                  ? "border-bord bg-fond-2 text-texte-3"
                  : carte.officiel
                    ? "border-signal bg-signal/13 text-signal"
                    : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
              ].join(" ")}
            >
              {carte.officiel ? "promue" : "promouvoir"}
            </button>
          </div>
          {carte.statut !== "prete" && (
            <Raison texte="cette image n'est pas encore arrivée" />
          )}
          {carte.officiel && (
            <>
              <Libelle aide="carte.famille">Famille</Libelle>
              <div className="flex flex-wrap gap-1">
                {FAMILLES.map((famille) => (
                  <button
                    key={famille}
                    type="button"
                    onClick={() => void promouvoir(true, famille as Famille)}
                    className={[
                      "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
                      carte.famille === famille
                        ? "border-signal bg-signal/13 text-signal"
                        : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
                    ].join(" ")}
                  >
                    {NOM_FAMILLE[famille]}
                  </button>
                ))}
              </div>
              <p className="mesure text-[9.5px] leading-snug text-texte-3">
                {carte.famille === "tous"
                  ? "part avec toutes les générations"
                  : `ne part qu'avec les sujets de la famille ${NOM_FAMILLE[carte.famille]}`}
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-bord pt-2">
        {carte.source && carte.statut === "echouee" && (
          <button
            type="button"
            onClick={() =>
              void api
                .reessayerCarte(carte.identifiant)
                .catch((e) => echouer(e, "récupération refusée"))
            }
            className="mesure text-[10px] text-signal hover:text-signal-clair"
          >
            Réessayer ›
          </button>
        )}
        {carte.source && carte.statut === "prete" && (
          <a
            href={carte.source}
            target="_blank"
            rel="noreferrer"
            className="mesure truncate text-[10px] text-texte-3 hover:text-signal"
            title={carte.source}
          >
            {carte.source}
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            void api
              .oublierCarte(carte.identifiant)
              .catch((e) => echouer(e, "suppression refusée"))
          }
          className="mesure ml-auto text-[10px] text-texte-3 hover:text-echec"
        >
          Retirer
        </button>
      </div>
    </div>
  )
}
