// Les pièces : les quelques contrôles que tout le reste réutilise —
// `docs/DESIGN.md` § Les onze pièces. Elles portent les hauteurs de contrôle du
// § Spacing : c'est cette grille de densité, pas les marges, qui fait
// l'instrument.
//
// **Le fichier s'appelait `chassis.tsx`, et il portait deux habillages** : celui
// du châssis chaud et sombre, et celui du papier du carnet, derrière une prop
// `papier` posée au fil de `C5`-`D5`. `D6` a retiré le premier — plus un seul
// écran du produit ne le demandait —, donc la prop n'avait plus qu'une valeur.
// Une prop qui ne peut valoir qu'une chose est un endroit où se tromper : elle
// est partie avec la branche, et le fichier porte enfin le nom de ce qu'il est.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react"
import {
  coteDuCanevas,
  coteDuSujet,
  quantite,
  secondes,
  type Modele,
  type Reserve,
} from "../api"
import { POINTILLE, useInfobulle } from "./Infobulle"
import { explication } from "../aide"
import { coupDeMain, type CeQuiPart } from "../api-coup-de-main"
import { JE_NE_SAIS_PAS } from "../touche-demander"

/** Comment un modèle se dit dans une liste déroulante (F1).
 *
 *  **Le fournisseur devant, toujours.** Deux fournisseurs peuvent proposer un
 *  modèle du même nom — le relevé du 31 août a trouvé les modèles de Leonardo
 *  hébergés chez Cloudflare —, et deux lignes identiques dans un menu déroulant
 *  font du choix un tirage au sort. C'est écrit ici, une fois, parce que ces
 *  listes sont trois et qu'une quatrième viendra.
 *
 *  Le nom du catalogue porte déjà l'éditeur quand il en a un — `Meta: Muse
 *  Image` —, donc on ne le répète pas : ce qu'on ajoute est **à qui l'appel se
 *  paie**, qui est une autre question. */
export function libelleModele(modele: { fournisseur?: string | null; nom: string }): string {
  return modele.fournisseur ? `${modele.fournisseur} · ${modele.nom}` : modele.nom
}

// ── Le choix d'un modèle, les habitués d'abord (TS17) ───────────────────────
//
// **La demande de l'auteur** : « je me sers presque toujours des mêmes
// modèles, gratuits ou payants ». Le panneau montre d'abord ses trois plus
// utilisés de chaque côté — comptés côté serveur, jamais recalculés ici — puis
// « voir plus de modèles » ouvre la liste complète avec sa recherche.
//
// **Un seul composant, posé partout où un modèle d'image se choisit** : la
// barre de fabrication de la toile d'abord, pour ne pas en maintenir un
// second gabarit ailleurs qui finirait par diverger.

export type Habitues = { gratuits: string[]; payants: string[] }

function OptionModele({
  modele,
  actif,
  onChoisir,
}: {
  modele: Modele
  actif: boolean
  onChoisir: () => void
}) {
  return (
    <li role="option" aria-selected={actif} aria-disabled={!!modele.refus}>
      <button
        type="button"
        disabled={!!modele.refus}
        title={modele.refus ?? undefined}
        onClick={onChoisir}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-5 px-[8px] py-[8px] text-left text-[11.5px]",
          modele.refus ? "cursor-not-allowed text-encre-4" : "text-encre hover:bg-papier-cote",
          actif && !modele.refus ? "bg-papier-cote" : "",
        ].join(" ")}
      >
        <span className="truncate">{libelleModele(modele)}</span>
        {modele.refus && (
          <span className="shrink-0 truncate text-[10.5px] text-echec">{modele.refus}</span>
        )}
      </button>
    </li>
  )
}

function SectionDeModeles({
  titre,
  modeles,
  visibles,
  actif,
  onChoisir,
}: {
  titre: string
  modeles: Modele[]
  visibles: Modele[]
  actif: number
  onChoisir: (m: Modele) => void
}) {
  return (
    <div className="mb-1">
      <p className="px-[8px] py-[4px] text-[10.5px] tracking-wide text-encre-4 uppercase">{titre}</p>
      <ul>
        {modeles.map((m) => (
          <OptionModele
            key={m.identifiant}
            modele={m}
            actif={visibles.indexOf(m) === actif}
            onChoisir={() => onChoisir(m)}
          />
        ))}
      </ul>
    </div>
  )
}

/** Le panneau de choix d'un modèle (TS17). **Sans historique, la liste
 *  complète paraît directement** (critère 3 du plan) : `habitues` vide des
 *  deux côtés saute droit à la recherche, sans un « voir plus » qui n'aurait
 *  rien à montrer avant lui.
 *
 *  **Le catalogue décide toujours** : un modèle grisé reste affiché, avec sa
 *  raison, dans son top comme dans la liste complète — il ne se choisit pas,
 *  il ne disparaît pas non plus.
 *
 *  Échap ferme. Les flèches déplacent la ligne active parmi ce qui est
 *  **affiché** — les habitués repliés, ou la liste filtrée une fois
 *  dépliée —, Entrée choisit la ligne active si elle n'est pas grisée.
 *
 *  **`optionVide`** (posé le 24 septembre 2026, en posant le composant dans
 *  `FabricationSuivie.tsx`) : une ligne hors catalogue, toujours visible,
 *  jamais filtrée par la recherche — « utiliser seulement une image
 *  existante » n'est pas un modèle que le catalogue connaît, c'est l'absence
 *  d'un modèle. Sans elle, un écran qui a besoin de ce choix-là devrait
 *  garder un second contrôle à côté, ce que ce point du plan interdit. */
export function ChoixModele({
  modeles,
  valeur,
  onChange,
  habitues,
  optionVide,
  ariaLabel = "Modèle",
  className = "",
}: {
  modeles: readonly Modele[]
  valeur: string | null
  onChange: (identifiant: string) => void
  /** `null`/`undefined` se lit comme « rien compté encore » — les deux tops
   *  vides, donc la liste complète directement. */
  habitues?: Habitues | null
  /** Une ligne de plus, avant tout le reste, qui choisit la chaîne vide. */
  optionVide?: { libelle: string }
  ariaLabel?: string
  className?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [etendu, setEtendu] = useState(false)
  const [recherche, setRecherche] = useState("")
  const [actif, setActif] = useState(0)
  const boite = useRef<HTMLDivElement>(null)

  const parIdentifiant = new Map(modeles.map((m) => [m.identifiant, m]))
  const gratuits = (habitues?.gratuits ?? [])
    .map((id) => parIdentifiant.get(id))
    .filter((m): m is Modele => !!m)
  const payants = (habitues?.payants ?? [])
    .map((id) => parIdentifiant.get(id))
    .filter((m): m is Modele => !!m)
  const sansHistorique = gratuits.length === 0 && payants.length === 0

  useEffect(() => {
    if (!ouvert) return
    setEtendu(sansHistorique)
    setRecherche("")
    setActif(0)
    // N'y répondre qu'à l'ouverture — `sansHistorique` ne doit pas replier une
    // recherche en cours si le catalogue se rafraîchit pendant que c'est ouvert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false)
    }
    window.addEventListener("mousedown", fermer)
    return () => window.removeEventListener("mousedown", fermer)
  }, [ouvert])

  const actuel = modeles.find((m) => m.identifiant === valeur) ?? null
  // **La ligne vide** : un pseudo-modèle sans fournisseur — `libelleModele`
  // rend alors son `nom` tel quel — jamais grisé, toujours en tête, jamais
  // filtré par la recherche puisqu'il ne vient pas du catalogue.
  const modeleVide: Modele | null = optionVide
    ? {
        identifiant: "",
        nom: optionVide.libelle,
        fournisseur: "",
        chez_lui: "",
        references_max: 0,
        proportions: [],
        resolutions: [],
        variations_max: 0,
        options: {},
        refus: null,
        repli: false,
        recu_le: 0,
        unite: "usd",
      }
    : null
  const filtres = etendu
    ? modeles.filter((m) =>
        libelleModele(m).toLowerCase().includes(recherche.trim().toLowerCase()),
      )
    : []
  const visibles = [
    ...(modeleVide ? [modeleVide] : []),
    ...(etendu ? filtres : [...gratuits, ...payants]),
  ]

  useEffect(() => setActif(0), [etendu, recherche])

  const choisir = (m: Modele) => {
    if (m.refus) return
    onChange(m.identifiant)
    setOuvert(false)
  }

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // **Seulement quand la liste est ouverte** (relecture du 24 septembre
      // 2026, défaut 9) : fermée, il n'y a rien à faire ici, et avaler la
      // touche quand même l'empêchait d'atteindre le `cancel` natif de la
      // `CadreDialogue` qui porte ce champ — un deuxième Échap était
      // nécessaire pour fermer la fenêtre. Et ouverte, `preventDefault` en
      // plus de `stopPropagation` : sans lui, ce même `cancel` natif partait
      // quand même, refermant la fenêtre entière pour une touche qui ne
      // visait que la liste.
      if (ouvert) {
        e.preventDefault()
        e.stopPropagation()
        setOuvert(false)
      }
      return
    }
    if (!ouvert || visibles.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActif((i) => Math.min(i + 1, visibles.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActif((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      const m = visibles[actif]
      if (m) {
        e.preventDefault()
        choisir(m)
      }
    }
  }

  return (
    <div ref={boite} className={`relative ${className}`} onKeyDown={surTouche}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={ariaLabel}
        // **Un `value` lisible comme celui d'un `<select>`** — l'écran de
        // fabrication et ses essais relisaient déjà `.value` pour savoir le
        // modèle retenu ; le panneau garde ce contrat plutôt que d'en ouvrir
        // un second.
        value={actuel?.identifiant ?? ""}
        onClick={() => setOuvert((v) => !v)}
        className="h-[30px] w-full min-w-0 truncate rounded-7 border border-trait bg-carte px-[8px] text-left text-[11.5px] text-encre-controle"
      >
        {actuel
          ? libelleModele(actuel)
          : modeleVide && !valeur
            ? modeleVide.nom
            : "Choisir un modèle…"}
      </button>
      {ouvert && (
        <div
          role="listbox"
          aria-label="Liste des modèles"
          className="absolute bottom-full z-20 mb-1 max-h-[380px] w-[240px] overflow-auto rounded-7 border border-trait bg-carte p-[8px] shadow-[0_2px_10px_rgba(0,0,0,.12)]"
        >
          {modeleVide && (
            <ul className="mb-1 border-b border-trait pb-1">
              <OptionModele
                modele={modeleVide}
                actif={visibles.indexOf(modeleVide) === actif}
                onChoisir={() => choisir(modeleVide)}
              />
            </ul>
          )}
          {!etendu && (
            <>
              {gratuits.length > 0 && (
                <SectionDeModeles
                  titre="Les plus utilisés · gratuits"
                  modeles={gratuits}
                  visibles={visibles}
                  actif={actif}
                  onChoisir={choisir}
                />
              )}
              {payants.length > 0 && (
                <SectionDeModeles
                  titre="Les plus utilisés · payants"
                  modeles={payants}
                  visibles={visibles}
                  actif={actif}
                  onChoisir={choisir}
                />
              )}
              <button
                type="button"
                className="mt-1 w-full rounded-5 px-[8px] py-[8px] text-left text-[11px] text-encre-3 hover:text-encre"
                onClick={() => setEtendu(true)}
              >
                voir plus de modèles
              </button>
            </>
          )}
          {etendu && (
            <>
              <input
                type="text"
                aria-label="Rechercher un modèle"
                placeholder="Chercher un modèle…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoFocus
                className="mb-1 h-[26px] w-full rounded-5 border border-trait bg-papier px-[8px] text-[11px] text-encre"
              />
              <ul>
                {filtres.map((m) => (
                  <OptionModele
                    key={m.identifiant}
                    modele={m}
                    actif={visibles.indexOf(m) === actif}
                    onChoisir={() => choisir(m)}
                  />
                ))}
                {filtres.length === 0 && (
                  <li className="px-[8px] py-[8px] text-[11px] text-encre-4">Aucun modèle</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Ce qui reste chez un fournisseur, **et d'où le chiffre vient** (F2).
 *
 *  Écrit ici parce que deux écrans le disent — celui où l'on choisit un modèle
 *  et celui qui confirme un appel — et qu'ils doivent dire *la même chose*.
 *  C'est la règle payée en écrivant E13 : deux calculs à deux endroits ont
 *  annoncé $0,0128 et $0,0160 pour le même appel, à trois centimètres l'un de
 *  l'autre.
 *
 *  **Trois phrases possibles, et la première est la plus fréquente.** Aucun
 *  fournisseur du produit n'annonce d'allocation aujourd'hui : Pollinations
 *  limite une cadence, pas un nombre. Écrire « il reste 0 » serait faux —
 *  *rien* ne reste à épuiser. On dit alors ce qui est parti, et depuis quand.
 */
export function phrasesDeReserve(reserve: Reserve): string[] {
  const dit: string[] = []
  const releve =
    reserve.source === "fournisseur"
      ? "relevé chez le fournisseur"
      : "compté ici, sur les appels partis de cette machine"

  if (reserve.reste === null) {
    dit.push(
      `ce fournisseur n'annonce aucune réserve — ${quantite(
        reserve.consomme,
        reserve.unite,
      )} parti${reserve.consomme >= 2 ? "s" : ""}${
        reserve.renouvellement ? ` depuis ${reserve.renouvellement}` : ""
      }, ${releve}.`,
    )
  } else {
    dit.push(
      `il reste ${quantite(reserve.reste, reserve.unite)} sur ${quantite(
        reserve.plafond ?? 0,
        reserve.unite,
      )}${
        reserve.renouvellement ? `, renouvelés à ${reserve.renouvellement}` : ""
      } — ${releve}.`,
    )
  }

  if (reserve.cadence_s)
    dit.push(
      `une génération toutes les ${reserve.cadence_s} secondes, pas davantage — c'est une cadence, pas un quota.`,
    )

  // **Ce qui manquerait pour finir ce lot-ci**, annoncé avant qu'il ne parte.
  // Posé par l'écran qui confirme seulement : celui où l'on choisit ne sait pas
  // encore ce qui partira.
  if (reserve.manque)
    dit.push(
      `il manquerait ${quantite(
        reserve.manque,
        reserve.unite,
      )} pour finir ce lot — la réserve n'y suffit pas.`,
    )

  return dit
}

/** Les mêmes phrases, posées à l'écran. Le manque passe en épinglé : c'est le
 *  seul des trois qui demande une décision — attendre demain, ou payer. */
export function LigneReserve({ reserve }: { reserve: Reserve }) {
  return (
    <p className="mesure text-[10.5px] leading-4 text-encre-4">
      {phrasesDeReserve(reserve).map((phrase, rang) => (
        <span
          key={phrase}
          className={
            rang === phrasesDeReserve(reserve).length - 1 && reserve.manque
              ? "text-encre-attention"
              : undefined
          }
        >
          {rang > 0 ? " " : ""}
          {phrase}
        </span>
      ))}
    </p>
  )
}

// ── Les crans de taille ─────────────────────────────────────────────────────
//
// « Les vignettes 1× / 2× / 4× sont les crans du zoom de la grille »
// (`docs/design-motifs.md` § L'écran Univers). **Un seul vocabulaire de taille dans tout le
// produit**, donc un seul endroit qui l'écrive : la grille d'assets s'en sert
// pour la largeur minimale d'une tuile, le tableau d'inspiration pour le nombre
// de colonnes qu'une carte occupe. Les deux contrôles ne cohabitent jamais —
// ils vivent sur deux écrans —, mais ils comptent pareil.

export type Zoom = 1 | 2 | 4
export const ZOOMS: readonly Zoom[] = [1, 2, 4]

/** La largeur minimale d'une tuile, par cran. 128 est la valeur de T3 : 1× ne
 *  change donc rien à ce qu'on regardait, le zoom s'ajoute au repos plutôt que
 *  de le redéfinir. */
export const CRANS: Record<Zoom, number> = { 1: 128, 2: 256, 4: 512 }

/** Ce que l'auteur lit — le multiplicateur, jamais le nombre de pixels. */
export const LIBELLES_ZOOM: Partial<Record<string, string>> = {
  "1": "1×",
  "2": "2×",
  "4": "4×",
}

/**
 * CM5 (`docs/PLAN-assistant.md` § CM5) — la petite marque qui développe une
 * raison de blocage. **Posée une seule fois, ici, dans `Raison`** : le
 * composant commun à tout le produit pour « le grisé porte sa raison »
 * (comme CM7 a posé la marque « améliorer » une seule fois, sur
 * `ChampPrompt.tsx`).
 *
 * **Elle ne paraît que si l'appelant fournit `ecran`** — une clé d'`ECRANS`
 * côté serveur. Sans elle, rien ne se propose : ni faux contexte inventé ici,
 * ni geste qui échouerait en 422. C'est pour ça qu'aujourd'hui elle n'est
 * branchée que sur l'écran *Relire avant l'envoi* (`Envoi.tsx`, « la barre
 * qui paie ») — les autres endroits où `Raison` affiche un grisé
 * (`ChampPrompt.tsx`, `PanneauReglages.tsx`, `BarreQuiPaie.tsx`…) sont
 * partagés entre plusieurs écrans à la fois, et leur donner un `ecran` fixe
 * mentirait sur l'un des deux. Ils restent à câbler, un par un, comme `CHAMPS`
 * l'a été en CM3 puis CM7.
 *
 * Décision 6 du plan, comme partout ailleurs dans le coup de main :
 * indisponible (pas de clé, plafond atteint…), la marque ne paraît pas du
 * tout.
 */
function ExpliquerLeBlocage({
  ecran,
  champ,
  raison,
}: {
  ecran: string
  champ?: string
  raison: string
}) {
  const [dispo, setDispo] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const [reponse, setReponse] = useState<{ texte: string; fini: boolean } | null>(null)
  const [voir, setVoir] = useState<CeQuiPart | null>(null)
  const coupure = useRef<AbortController | null>(null)

  useEffect(() => {
    let vivant = true
    coupDeMain.etat().then((e) => { if (vivant) setDispo(e.disponible === true) }).catch(() => undefined)
    return () => { vivant = false }
  }, [])

  function fermer() {
    coupure.current?.abort()
    coupure.current = null
    setOuvert(false)
    setReponse(null)
    setVoir(null)
  }

  // Refermer coupe l'appel en cours, comme le reste du coup de main.
  useEffect(() => () => coupure.current?.abort(), [])

  // Échap, où que soit le focus tant que l'explication est ouverte — même
  // geste que `AvecCoupDeMain` et `AvecDemande` : elle referme l'explication,
  // elle ne referme pas l'écran qui est autour (donc pas l'écran d'envoi).
  useEffect(() => {
    if (!ouvert) return
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault(); e.stopPropagation()
      fermer()
    }
    window.addEventListener("keydown", touche, true)
    return () => window.removeEventListener("keydown", touche, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert])

  async function expliquer() {
    setOuvert(true)
    setVoir(null)
    const coupe = new AbortController()
    coupure.current = coupe
    let recu = ""
    setReponse({ texte: "", fini: false })
    const corps = { texte: raison, ecran, ...(champ ? { champ } : {}), blocage: raison }
    try {
      const fin = await coupDeMain.demander("blocage", corps, (m) => {
        if (coupe.signal.aborted) return
        if (m.genre === "texte") { recu += m.texte; setReponse({ texte: recu, fini: false }) }
      }, coupe.signal)
      if (coupe.signal.aborted) return
      if (fin?.genre === "fin" && fin.issue === "repondu" && recu.trim()) {
        setReponse({ texte: recu.trim(), fini: true })
        return
      }
      // Revenu sans réponse — indisponible, refusé, délai passé : elle se tait.
      if (fin?.genre === "indisponible") setDispo(false)
      fermer()
    } catch {
      if (!coupe.signal.aborted) { setDispo(false); fermer() }
    }
  }

  async function basculerVoir() {
    if (voir) { setVoir(null); return }
    const corps = { texte: raison, ecran, ...(champ ? { champ } : {}), blocage: raison }
    try { setVoir(await coupDeMain.ceQuiPart("blocage", corps)) } catch { setVoir(null) }
  }

  if (!dispo) return null
  const jeNeSaisPas = reponse?.fini && reponse.texte.toLowerCase().replace(/[.!]+$/, "") === JE_NE_SAIS_PAS

  return (
    <span className="mesure inline">
      {!ouvert && (
        <button type="button" onClick={() => void expliquer()} className="ml-1 text-signal hover:opacity-70">
          pourquoi ›
        </button>
      )}
      {ouvert && (
        <span role="group" aria-label="Pourquoi c'est bloqué" className="mt-1 block max-w-[380px] rounded-7 border border-trait bg-papier p-[8px]">
          {reponse && (
            <p aria-live="polite" className="text-[11px] leading-4 text-encre">
              {jeNeSaisPas ? "Le coup de main ne sait pas expliquer ce blocage-ci." : (reponse.texte || "…")}
            </p>
          )}
          <span className="mt-[8px] flex flex-wrap items-center gap-[8px]">
            <button type="button" className="text-[11px] text-encre-2 underline underline-offset-2 hover:text-encre" aria-expanded={voir !== null} onClick={() => void basculerVoir()}>
              {voir ? "Cacher ce qui part" : "Voir ce qui part"}
            </button>
            <small className="text-[10.5px] text-encre-3">Échap pour fermer</small>
          </span>
          {voir && <span className="mt-[8px] block space-y-[8px]">
            {voir.morceaux.filter((m) => m.texte).map((m) => <span key={m.titre} className="block">
              <span className="mesure block text-[10.5px] uppercase tracking-[0.14em] text-encre-3">{m.titre}</span>
              <pre className="mesure mt-[4px] whitespace-pre-wrap rounded-5 border border-trait bg-carte p-[8px] text-[10.5px] text-encre-2">{m.texte}</pre>
            </span>)}
            <small className="block text-[10.5px] text-encre-3">{voir.jamais}</small>
          </span>}
        </span>
      )}
    </span>
  )
}

/**
 * « Le grisé porte sa raison — jamais une infobulle. »
 *
 * Une ligne sœur permanente sous le contrôle indisponible : mono 10 px,
 * `--texte-3`, précédée d'un tiret de 8 px, avec un lien en `--signal` quand il
 * y a un endroit où aller. Le produit interdit de proposer puis de refuser :
 * l'apparence doit donc dire pourquoi sans qu'on ait à chercher.
 *
 * **CM5** : `ecran` (facultatif) branche la petite marque « pourquoi › » qui
 * développe cette raison avec le coup de main — voir `ExpliquerLeBlocage`
 * ci-dessus pour ce qu'elle fait et où elle est posée aujourd'hui.
 */
export function Raison({
  texte,
  ouAller,
  onAller,
  ecran,
  champ,
}: {
  texte: string | null
  ouAller?: string
  onAller?: () => void
  /** La clé d'écran (`ECRANS` côté serveur) où cette raison est affichée. */
  ecran?: string
  /** Le geste bloqué, en clair — nommé par l'appelant, jamais deviné. */
  champ?: string
}) {
  if (!texte) return null
  return (
    <p className="mesure mt-1 flex flex-col text-[10.5px] leading-4 text-encre-4">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-px w-2 bg-encre-4" />
        <span>{texte}</span>
        {ouAller && onAller && (
          <button type="button" onClick={onAller} className="text-signal hover:opacity-70">
            {ouAller} ›
          </button>
        )}
        {ecran && <ExpliquerLeBlocage ecran={ecran} champ={champ} raison={texte} />}
      </span>
    </p>
  )
}

/**
 * « Le revers — l'actif qui porte son risque. »
 *
 * Le repli hors ligne est le seul endroit du produit où l'on propose puis
 * refuse : le catalogue est une photo, générer reste **actif**, et l'échec ne
 * survient qu'au moment du clic (US-95). C'est l'exception à `Raison`, et elle
 * se rend dans **la même fente, avec la même forme** — tiret de 8 px, mono
 * 10 px, lien `--signal` pour le geste. Ce qui change est le mot : le grisé dit
 * *pourquoi c'est fermé*, le revers dit *ce qui va casser*.
 *
 * En `--encre-attention` et non `--info` : arrêté à un instant, que le système ne
 * bougera pas tout seul, et que seul un geste de l'auteur relance — exactement
 * la définition que partagent « réglé à la main » et « interrompu ».
 * `docs/design-motifs.md`. *(C'était `--epingle` sur le châssis sombre ; le
 * papier dit la même chose en `--encre-attention`, comme `Envoi.tsx` depuis
 * `C5`.)*
 */
export function Revers({
  texte,
  geste,
  onGeste,
  enCours = false,
}: {
  texte: string
  geste: string
  onGeste: () => void
  enCours?: boolean
}) {
  return (
    <p className="mesure mt-1 flex items-center gap-1.5 text-[10.5px] leading-4 whitespace-nowrap text-encre-attention">
      <span aria-hidden className="inline-block h-px w-2 bg-encre-attention" />
      <span>{texte}</span>
      <button
        type="button"
        onClick={onGeste}
        disabled={enCours}
        className="text-signal hover:opacity-70 disabled:text-eteint"
      >
        {enCours ? "…" : `${geste} ›`}
      </button>
    </p>
  )
}

export function EnTetePanneau({ children }: { children: ReactNode }) {
  return (
    <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-2 text-[10.5px] tracking-[.11em] text-encre-4 uppercase">
      {children}
    </div>
  )
}

/**
 * Le nom d'un réglage — et sa propre poignée d'explication.
 *
 * « Le libellé est la cible — aucun glyphe neuf » (`docs/design-motifs.md` §
 * L'infobulle explique, elle n'excuse jamais). Passer `aide` pose le pointillé
 * `--bord-fort` et branche le survol ; sans `aide`, le libellé est exactement
 * ce qu'il était, et **c'est le cas d'un réglage que le corpus ne documente pas
 * encore** : aucune marque, aucune bulle vide, rien qui casse.
 *
 * Ne jamais y faire passer une **raison** : ce qui refuse un geste vit dans une
 * fente permanente (`Raison`), et se survoler serait proposer puis refuser.
 */
export function Libelle({
  children,
  aide,
  eteint = false,
}: {
  children: ReactNode
  aide?: string
  /** Le libellé d'un contrôle qui ne porte rien — un champ de bible vide ou
   *  désactivé. Il descend d'un ton, et **c'est la seule variante permise** :
   *  un second gabarit de libellé serait un second endroit où poser le
   *  pointillé, donc un endroit où l'oublier. */
  eteint?: boolean
}) {
  const { presente, ancre, declencheurs, bulle } = useInfobulle(aide)
  // **`w-fit`, et c'est la poignée qui en dépend.** Un `<span>` posé dans un
  // conteneur flexible est *blockifié* — son `display` calculé vaut `block`,
  // quel que soit celui qu'on écrit. Dans une rangée il se dimensionne sur son
  // texte ; dans une **colonne**, `align-items: stretch` l'étire sur toute la
  // largeur du panneau. Mesuré à l'atelier : « Proportions » occupait 268 px
  // pour 60 px de mot, soit 208 px de zone morte qui ouvrait quand même la
  // bulle et allumait quand même le pointillé — à côté de « Modèle », content,
  // dans le même panneau. « Le libellé est la cible » ne tient que si la cible
  // *est* le libellé. Une largeur en `fit-content` neutralise l'étirement sans
  // toucher à l'alignement, donc sans défaire l'`items-baseline` des rangées.
  const base = `w-fit text-[11px] ${eteint ? "text-eteint" : "text-encre-3"}`
  if (!presente) return <span className={base}>{children}</span>
  return (
    <>
      <span ref={ancre as Ref<HTMLSpanElement>} {...declencheurs} className={`${base} ${POINTILLE}`}>
        {children}
      </span>
      {bulle}
    </>
  )
}

/**
 * L'en-tête d'une section : son nom, son propos écrit dessous, son compte.
 *
 * **Le troisième rendu du recueil, et il n'ajoute aucun texte** (R8). Le corpus
 * servait la bulle au survol et le Guide ; il sert ici la ligne écrite **à
 * demeure** sous un titre. Le nom vient de l'entrée, le propos est sa première
 * ligne — *ce que c'est* —, et le pointillé sous le nom rend la version longue
 * au survol. Corriger l'entrée corrige les trois affichages d'un coup.
 *
 * **Ce n'est pas une 75ᵉ phrase écrite en dur.** Le produit en a 74 dans
 * dix-sept écrans, et la règle « un seul corpus, deux rendus » ne les a jamais
 * interdites : ce qu'elle interdit est de **recopier le corpus** ailleurs, parce
 * que deux copies divergent en trois semaines et que la fausse est celle qu'on a
 * sous les yeux au moment du doute. Lire l'entrée tient la règle mieux que ne la
 * tenaient ces 74 lignes.
 *
 * **Elle ne s'écrit que là où l'on peut se tromper de section** — le même test
 * binaire qui décide déjà de l'existence d'une bulle. Sur un panneau où chaque
 * ligne porte un nom sans ambiguïté, le pointillé au survol suffit, et cet
 * en-tête n'a rien à y faire.
 *
 * **Sans entrée, il ne casse rien** : le titre paraît seul, sans pointillé et
 * sans propos, exactement comme un `Libelle` sans aide. C'est ce qui permet
 * d'écrire l'écran avant le recueil sans laisser de bulle vide.
 */
export function EnTeteDeSection({
  aide,
  titre,
  compte,
}: {
  /** La clef de l'entrée du recueil. Elle donne le nom **et** le propos. */
  aide: string
  /** Quand l'écran nomme la section autrement que le recueil. À éviter : deux
   *  noms pour une chose sont deux choses pour qui lit. */
  titre?: ReactNode
  /** Le compte de la section, aligné à droite. **Écrit une fois** : c'est la
   *  correction de R8, où le même compte figurait à trois endroits. */
  compte?: ReactNode
}) {
  const entree = explication(aide)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-3">
        <Libelle aide={aide}>{titre ?? entree?.nom ?? aide}</Libelle>
        {compte && (
          <span className="mesure ml-auto text-[10.5px] text-encre-4">{compte}</span>
        )}
      </div>
      {entree && (
        <p className="max-w-[64ch] text-[11.5px] leading-[1.5] text-encre-3">
          {entree.quoi}
        </p>
      )}
    </div>
  )
}

// ── Le bloc repliable ───────────────────────────────────────────────────────
//
// « Un bloc replié ne se tait pas — il porte son réglage, en mono, à droite de
// son titre » (`docs/design-motifs.md` § Le bloc repliable). C'est cette ligne qui
// fait tout : le repli cesse d'être un rangement pour devenir un **résumé**, et
// un panneau plié se lit mieux que déplié.
//
// **L'état de repli est global et par bloc**, tenu ici et non dans un écran :
// il doit survivre au changement d'asset et à la fermeture de la fiche, qui se
// démonte. C'est la promesse d'US-37 — « fermer le panneau remet exactement où
// l'on était » — et personne ne veut gérer deux cents états de repli.

const ouverts = new Set<string>()
const abonnes = new Set<() => void>()

function abonner(prevenir: () => void) {
  abonnes.add(prevenir)
  return () => {
    abonnes.delete(prevenir)
  }
}

function prevenirTous() {
  abonnes.forEach((prevenir) => prevenir())
}

function basculer(cle: string) {
  if (ouverts.has(cle)) ouverts.delete(cle)
  else ouverts.add(cle)
  prevenirTous()
}

/** Tout replier — l'état de repos du produit.
 *
 *  Le repli global vit dans ce module et non dans un écran, donc il survit à
 *  tout ce qui se démonte : c'est ce qu'on veut d'une image à l'autre, et c'est
 *  ce qu'on ne veut pas d'un essai à l'autre. Les essais d'écran le remettent à
 *  zéro dans leur `beforeEach`, comme ils remettent le flux et l'horloge. */
export function toutReplier() {
  if (ouverts.size === 0) return
  ouverts.clear()
  prevenirTous()
}

function useOuvert(cle: string) {
  return useSyncExternalStore(
    abonner,
    () => ouverts.has(cle),
    () => false,
  )
}

/**
 * Un repli qui n'est pas un `Bloc`, mais qui vit dans le même registre.
 *
 * Le dépliant « Ce qui partira » et le prompt négatif se replient sans être des
 * blocs de réglages : ils n'ont ni en-tête de rangée ni valeur résumée. Ils
 * n'en tenaient pas moins leur état chez eux, ce qui allait tant que le champ
 * de saisie ne se démontait jamais — la galerie était le fond du produit.
 *
 * **La V2.1 en fait un onglet, et le fond disparaît.** Aller poser un champ de
 * bible dans l'Univers puis revenir refermait le dépliant qu'on avait ouvert,
 * exactement le défaut que le registre existe pour empêcher : « fermer le
 * panneau remet exactement où l'on était » (US-37). Le registre est déjà
 * global, déjà remis à zéro par les essais, déjà abonné — il ne manquait que la
 * porte.
 */
export function usePli(cle: string): [boolean, () => void] {
  return [useOuvert(cle), () => basculer(cle)]
}

/** La valeur d'un bloc replié. `null` — rien de posé — se dit par le tiret du
 *  produit, en `--encre-4` ; un réglage posé se dit en `--signal`, la couleur
 *  de ce qui est choisi partout ailleurs. */
function Valeur({ etat }: { etat: string | null | undefined }) {
  return (
    <span
      className={[
        "mesure ml-auto max-w-[60%] truncate pl-2 text-[10.5px]",
        etat ? "text-signal" : "text-encre-4",
      ].join(" ")}
    >
      {etat || "—"}
    </span>
  )
}

/**
 * Un bloc de réglages qui se replie.
 *
 * **La marque de repli est la valeur elle-même** : replié, l'en-tête porte le
 * réglage ; ouvert, il se tait, parce que la valeur est dans le bloc, sous les
 * yeux. Aucun glyphe neuf n'entre dans le produit — les deux candidats évidents
 * sont pris : le `+` en bout de rangée veut dire *nouvelle entrée* dans
 * l'arbre, et le triangle plein veut dire *favori* sur une tuile.
 *
 * La rangée fait 26 px, celle du § Spacing. Aucune hauteur neuve non plus.
 *
 * **Le repli est instantané**, et c'est le § Motion qui le tranche par sa
 * propre règle d'admission : un mouvement n'entre dans la liste close que si la
 * chose qui arrive n'a aucun autre moyen d'être remarquée. On a cliqué.
 */
export function Bloc({
  cle,
  titre,
  etat,
  mesure,
  aide,
  children,
}: {
  /** L'identité du bloc dans le repli global. Stable d'un asset à l'autre. */
  cle: string
  titre: string
  /** La clé de l'entrée du corpus, s'il y en a une.
   *
   *  **Un titre de bloc n'épingle pas** : son clic est déjà pris — il replie.
   *  Les gestes vont donc sur le bouton et non sur le titre, parce qu'un
   *  élément focalisable imbriqué dans un bouton est du HTML invalide et un
   *  piège au clavier ; le survol révèle, le focus du bouton aussi, et c'est
   *  tout ce que ce cas mérite. */
  aide?: string
  /** Ce que le bloc porte, dit en une ligne. `null` — rien de posé. */
  etat?: string | null
  /** Le fait que le bloc garde visible une fois **ouvert**. La droite de la
   *  rangée dit toujours un fait sur le bloc : replié c'est sa valeur, ouvert
   *  c'est ce qu'il veut qu'on garde sous les yeux en le réglant — « 24 au
   *  catalogue » pendant qu'on choisit un modèle. Les deux ne cohabitent
   *  jamais : ils occupent la même fente. */
  mesure?: string | null
  children: ReactNode
}) {
  const ouvert = useOuvert(cle)
  const infobulle = useInfobulle(aide, { epinglable: false })
  return (
    <section className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => basculer(cle)}
        aria-expanded={ouvert}
        {...infobulle.declencheurs}
        className="-mx-1 flex h-[26px] items-center rounded-5 px-1 text-left transition-colors duration-120 hover:bg-papier-cote"
      >
        <span
          ref={infobulle.ancre as Ref<HTMLSpanElement>}
          // `w-fit` pour la même raison que dans `Libelle` : la poignée est
          // bornée à son mot **quelle que soit l'orientation du parent**. Cette
          // rangée-ci est en `flex … items-center`, donc contente aujourd'hui —
          // la classe dit qu'elle le restera si la rangée devient une colonne.
          className={`w-fit text-[11px] text-encre-3 ${infobulle.presente ? POINTILLE : ""}`}
        >
          {titre}
        </span>
        {ouvert ? (
          mesure && (
            <span className="mesure ml-auto truncate pl-2 text-[10.5px] text-encre-4">
              {mesure}
            </span>
          )
        ) : (
          <Valeur etat={etat} />
        )}
      </button>
      {/* Hors du bouton, exprès : la bulle porte le lien « Le guide › », et un
          bouton dans un bouton est invalide — le clic du lien replierait le
          bloc au passage. Elle est en `fixed`, donc sa place à l'écran ne doit
          rien à l'endroit où elle est rendue. */}
      {infobulle.bulle}
      {ouvert && children}
    </section>
  )
}

export function Bouton({
  enfants,
  principal = false,
  inactif = false,
  onClick,
  titre,
}: {
  enfants: ReactNode
  principal?: boolean
  inactif?: boolean
  onClick?: () => void
  titre?: string
}) {
  const base =
    "h-[34px] rounded-7 px-3 text-[13px] transition-colors duration-120 disabled:cursor-not-allowed"
  const couleurs = inactif
    ? "border border-trait bg-papier-cote text-eteint"
    : principal
      ? "border border-signal bg-signal text-encre-sur-signal hover:opacity-90 font-medium"
      : "border border-contour bg-carte text-encre-controle hover:bg-papier-cote"
  return (
    <button
      type="button"
      title={titre}
      disabled={inactif}
      onClick={onClick}
      className={`${base} ${couleurs}`}
    >
      {enfants}
    </button>
  )
}

/** Un choix parmi peu — proportions, variations. Un segment indisponible est
 *  grisé, jamais caché : l'absence n'apprend rien, le grisé apprend pourquoi. */
export function Segments<T extends string | number>({
  valeurs,
  valeur,
  onChange,
  indisponibles = [],
  libelles,
  plusieursRangees = false,
}: {
  valeurs: readonly T[]
  valeur: T
  onChange: (v: T) => void
  indisponibles?: readonly T[]
  /** Ce que l'auteur lit, quand ce n'est pas ce que l'API transporte. Le nom
   *  d'un moteur voyage sans accent — il traverse du JSON et des chemins — mais
   *  ce qui s'affiche est français, comme tout le reste de l'écran. */
  libelles?: Partial<Record<string, string>>
  /** Autorise la suite à passer à la ligne quand elle est trop longue pour sa
   *  colonne. **Faux par défaut, et c'est voulu** : dans une bande de hauteur
   *  fermée — la barre d'outils —, une deuxième rangée sortirait de la bande.
   *
   *  **Mesuré au navigateur le 31 août 2026**, sur la cible de la table de
   *  grille : neuf segments réclament 347 px et la colonne n'en offre que 224,
   *  barre de défilement verticale déduite. Le débordement ne se voyait pas
   *  comme un défaut — le panneau se mettait simplement à défiler de côté, et
   *  **les deux plus grandes valeurs, 128 et 256, tombaient hors de l'écran**.
   *  Un réglage qu'on ne peut pas atteindre n'existe pas. Sur deux rangées la
   *  suite tient — six puis trois — et le défilement latéral disparaît.
   *
   *  **Le croquis les montre sur une rangée, et ce n'est pas une contradiction
   *  à corriger** : il pose son libellé *au-dessus* des segments, qui disposent
   *  alors de toute la colonne, et il les dessine plus petits que ceux du
   *  produit. L'écran, lui, met le libellé *à côté*, comme tous ses autres
   *  réglages. À cette largeur-là, aucune taille de segment ne fait tenir neuf
   *  valeurs sur une rangée — vérifié au navigateur avant d'en arriver là. */
  plusieursRangees?: boolean
}) {
  return (
    <div className={plusieursRangees ? "flex flex-wrap gap-1" : "flex gap-1"}>
      {valeurs.map((v) => {
        const choisi = v === valeur
        const grise = indisponibles.includes(v)
        return (
          <button
            key={String(v)}
            type="button"
            disabled={grise}
            onClick={() => onChange(v)}
            className={[
              // `whitespace-nowrap` : un segment qui se replie sur deux lignes
              // sort de la hauteur de sa bande, et une bande de la liste
              // fermée ne grandit pas. Trouvé au navigateur en tenant E5, sur
              // « côte à côte » dans un comparateur devenu étroit.
              "mesure h-[26px] min-w-[34px] shrink-0 rounded-7 whitespace-nowrap border px-2 text-[11.5px] transition-colors duration-120",
              grise
                ? "border-trait bg-papier-cote text-eteint"
                : choisi
                  ? "border-signal bg-ligne-ouverte text-signal"
                  : "border-trait bg-carte text-encre-3 hover:bg-papier-cote",
            ].join(" ")}
          >
            {libelles?.[String(v)] ?? v}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Un réglage continu — la tolérance d'un détourage, l'occupation d'une case.
 *
 * Le seul contrôle ajouté au châssis en T2, et il l'est pour une raison de
 * comportement : viser une valeur dans un champ de nombre avant de voir ce
 * qu'elle donne est l'inverse du geste. On fait glisser, et on regarde.
 *
 * **`onChange` bouge la valeur, `onFini` la pose.** Écrit le 27 août 2026, à la
 * mesure : une retouche qui touche le détourage coûte 1,5 à 2,3 s au serveur,
 * pas les 28 ms de la queue de recette sur lesquels T2 avait promis « chaque
 * réglage répond sans attente perceptible ». Un appel par cran de curseur, ce
 * sont vingt-deux appels sérialisés pour un glissement de la tolérance, soit
 * une demi-minute de file pendant laquelle l'image défile des valeurs que
 * personne n'a demandé à voir. Le curseur envoie donc **ce qu'on a lâché, pas
 * ce qu'on a traversé** — la valeur suit la main sans attendre, le rendu suit
 * le relâchement. Un cran de segment reste un choix, et part tout de suite.
 *
 * **Et sa valeur s'écrit** (U3, 1<sup>er</sup> septembre 2026). Le geste
 * d'origine reste le bon — on fait glisser, on regarde — mais il ne suffit pas
 * quand on connaît déjà le nombre : refaire à la souris un réglage qu'on a noté
 * sur l'image d'à côté est une punition, et aucun logiciel d'image ne l'impose.
 * Le champ est à droite, à la place où la valeur s'écrivait déjà ; **la frappe
 * pendant qu'on tient le curseur le remplit sans qu'on ait à le viser**, comme
 * ailleurs. Entrée valide, Échap rend la valeur d'avant, quitter le champ vaut
 * Entrée.
 *
 * **Un chiffre écrit vaut un relâchement** : un seul envoi, jamais un par
 * frappe. C'est la règle de T2, appliquée à l'autre façon de régler.
 *
 * Il n'introduit aucune couleur : rail en `--bord`, curseur en `--signal`,
 * valeur en mono à droite comme toute mesure du produit.
 */
export function Curseur({
  valeur,
  min,
  max,
  pas = 1,
  unite = "",
  onChange,
  onFini,
  inactif = false,
  crans,
  libelle,
}: {
  valeur: number
  min: number
  max: number
  pas?: number
  unite?: string
  /** **Les seules valeurs où quelque chose change.** Un curseur qui s'arrête à
   *  chaque pour cent sur une échelle qui n'a qu'une trentaine d'états
   *  distincts fait croire à la main qu'elle règle quelque chose. Quand la
   *  liste est donnée, la valeur saute au cran le plus proche — et le nombre
   *  affiché reste celui du cran, jamais celui de la position de la main.
   *
   *  Sans liste, le curseur est celui de T2 : rien ne change pour les six
   *  autres réglages du produit, qui n'ont pas de crans à eux. */
  crans?: readonly number[]
  onChange: (v: number) => void
  /** Le relâchement — souris, doigt ou touche. Sans lui, `onChange` fait tout,
   *  ce qui reste juste pour un réglage qui ne coûte rien à celui d'en face. */
  onFini?: (v: number) => void
  inactif?: boolean
  /** Le nom du réglage, pour le champ où sa valeur s'écrit (U3). Sans lui le
   *  champ s'appelle *valeur*, ce qui suffit à le trouver mais pas à savoir
   *  lequel on tient quand il y en a cinq dans la colonne. */
  libelle?: string
}) {
  /** Le cran le plus proche, ou la valeur telle quelle. */
  const arrondir = (brute: number) =>
    crans && crans.length
      ? crans.reduce((a, b) => (Math.abs(b - brute) < Math.abs(a - brute) ? b : a))
      : brute
  const fini = (e: { currentTarget: HTMLInputElement }) =>
    onFini?.(arrondir(Number(e.currentTarget.value)))

  // ── Le champ où la valeur s'écrit (U3) ──────────────────────────────────
  //
  // **`null` tant qu'on n'écrit pas.** Le champ montre alors la valeur du
  // curseur, si bien que les deux disent toujours la même chose sans qu'un état
  // ait à les tenir d'accord. Il ne prend une valeur à lui que pendant la
  // frappe, qui est un état de passage.
  const [ecrit, setEcrit] = useState<string | null>(null)
  // **Ce qu'on a ramené, et il se dit.** Une valeur hors bornes n'est pas
  // refusée — un champ qui rejette une frappe oblige à deviner ce qu'il
  // accepte —, elle est ramenée, et la ligne dessous dit laquelle. Elle part à
  // la frappe suivante.
  const [ramene, setRamene] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseFloat(texte.replace(",", ".").replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(lu)) return
    const borne = Math.max(min, Math.min(max, lu))
    const pose = arrondir(borne)
    if (pose !== lu)
      setRamene(
        borne !== lu
          ? `ramené à ${pose}${unite} — les bornes sont ${min} et ${max}`
          : `ramené à ${pose}${unite} — c'est le cran le plus proche`,
      )
    else setRamene(null)
    // **Un chiffre écrit vaut un relâchement** : la valeur bouge et se pose
    // dans le même geste, un seul envoi. `onChange` seul laisserait le réglage
    // à l'écran sans jamais l'appliquer sur les places qui attendent `onFini`.
    onChange(pose)
    onFini?.(pose)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={pas}
          value={valeur}
          disabled={inactif}
          onChange={(e) => onChange(arrondir(Number(e.target.value)))}
          onPointerUp={fini}
          onKeyUp={fini}
          // **La frappe pendant qu'on tient le curseur remplit le champ**
          // (U3), sans qu'on ait eu à le viser — le geste des logiciels
          // d'image. Les touches qui font vivre le curseur lui-même — les
          // flèches, Origine, Fin — ne sont pas détournées.
          onKeyDown={(e) => {
            if (!/^[0-9]$/.test(e.key)) return
            e.preventDefault()
            setEcrit(e.key)
            setRamene(null)
            champ.current?.focus()
          }}
          className="curseur-papier h-[26px] min-w-0 flex-1"
        />
        <input
          ref={champ}
          type="text"
          inputMode="numeric"
          aria-label={libelle ? `${libelle}, en chiffres` : "Valeur, en chiffres"}
          disabled={inactif}
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
            // Échap rend la valeur d'avant, comme partout ailleurs.
            if (e.key === "Escape") {
              setEcrit(null)
              setRamene(null)
            }
          }}
          // **Quitter le champ vaut Entrée.** Sans quoi une valeur tapée puis
          // abandonnée resterait à l'écran sans agir : le champ dirait une
          // chose et l'image en montrerait une autre.
          onBlur={(e) => ecrit !== null && valider(e.target.value)}
          className={[
            // 70, la seule largeur de petit contrôle déclarée
            // (`docs/DESIGN.md` § Spacing) : le champ tenait 46 px sur le
            // châssis sombre, une largeur libre que les listes fermées ne
            // connaissent pas.
            "mesure w-[70px] shrink-0 rounded-5 border border-transparent bg-transparent px-1 text-right text-[10.5px] tabular-nums",
            "hover:border-trait focus:border-contour focus:bg-carte focus:outline-none",
            inactif ? "text-eteint" : "text-encre-3",
          ].join(" ")}
        />
      </div>
      {ramene && <Raison texte={ramene} />}
    </div>
  )
}

// ── La jauge ────────────────────────────────────────────────────────────────

/**
 * La jauge du produit — **déterminée**, `docs/DESIGN.md` § Motion : « ça
 * travaille, et voilà où ça en est ». Le seul mouvement continu du produit, et
 * il n'y en a qu'un : une génération dans la grille et une retouche **dans les
 * tables** portent la même barre, de la même épaisseur, dans la même couleur.
 *
 * **Un filet d'un pixel en `--encre-3`, et non deux pixels de rouille** (`D6`).
 * Les planches disent « deux pixels de haut » ; elles décrivent la barre du
 * châssis sombre, où un pixel de cyan disparaît. Sur le papier, un filet d'un
 * pixel *est* le vocabulaire du carnet — c'est l'épaisseur de tous ses traits —
 * et 2 n'est pas dans la liste fermée des écarts. C'est exactement ce que
 * `Retouche.tsx` avait déjà tranché pour sa propre jauge en `B26` ; les deux
 * disent maintenant la même chose. Le rouille, lui, reste ce qu'il est partout
 * ailleurs : **le bouton qui dépense, un seul par écran** — une barre d'attente
 * en fond rouille en aurait fait un second.
 *
 * *La phrase disait « une retouche dans la fiche » ; la retouche a quitté la
 * fiche pour les tables en `E4`, le 31 août 2026, et l'exemple désignait depuis
 * un endroit où la barre ne paraît plus (`G1`).*
 *
 * Elle ne ment pas sur ce qu'elle sait : la barre avance vers l'attente
 * mesurée, puis ralentit sans jamais atteindre le bout, parce qu'elle ne sait
 * pas quand ça finira.
 *
 * Deux réglages, parce que les deux attentes du produit n'ont pas la même
 * échelle. Une génération court dix à vingt secondes et on peut quitter
 * l'écran : elle porte son **compteur**, et c'est lui qui dit s'il faut
 * attendre. Une retouche court une à deux secondes, la main encore sur le
 * curseur : `00:01 / ~00:02` y serait un nombre qui change deux fois. Elle
 * porte donc un **seuil** à la place — rien ne paraît sous 240 ms, la borne du
 * § Motion, parce qu'une queue de recette répond en 29 ms et qu'y faire
 * clignoter une jauge serait pire que de ne rien montrer.
 */
export function Jauge({
  demarreLe,
  attendue,
  compteur = true,
  seuil = 0,
}: {
  /** L'instant du départ, en secondes Unix. `null` — pas encore parti. */
  demarreLe: number | null
  /** Ce que cette opération-là a mis la dernière fois, en secondes. */
  attendue: number
  /** Le temps écoulé et l'attente, en mono sous la barre. */
  compteur?: boolean
  /** Sous cette durée, la jauge ne paraît pas du tout. En secondes. */
  seuil?: number
}) {
  const ecoule = useEcoule(demarreLe)

  // Pas encore parti : la tuile tient sa place, mais il n'y a rien à mesurer.
  const enAttente = demarreLe === null

  if (seuil > 0 && !enAttente && ecoule < seuil) return null

  return (
    <>
      {compteur && (
        <span className="mesure text-[10.5px] text-papier">
          {enAttente ? "en file" : `${secondes(ecoule)} / ~${secondes(attendue)}`}
        </span>
      )}
      <span className="block h-px w-full overflow-hidden bg-trait-faible">
        <span
          className="block h-full bg-encre-3 transition-[width] duration-220 ease-linear"
          style={{ width: `${part(ecoule, attendue, enAttente) * 100}%` }}
        />
      </span>
    </>
  )
}

const depuis = (horodatage: number | null) =>
  horodatage === null ? 0 : Math.max(0, Date.now() / 1000 - horodatage)

/**
 * Le temps écoulé depuis un départ, rafraîchi quatre fois par seconde.
 *
 * **Extrait de la jauge le 31 août 2026**, quand le bouton qui paie s'est mis à
 * porter son propre compteur (E-BUG-2). Les deux montrent le même temps, du même
 * départ, et un second `setInterval` écrit à la main aurait fini par battre à
 * contretemps du premier — deux durées pour un seul fait est la panne que ce
 * dépôt refuse partout ailleurs.
 *
 * Le quart de seconde n'est pas un réglage de confort : la barre transitionne
 * sur 220 ms (§ Motion), et rafraîchir plus vite ne ferait qu'écraser une
 * transition en cours par la suivante.
 */
export function useEcoule(demarreLe: number | null): number {
  const [ecoule, setEcoule] = useState(() => depuis(demarreLe))

  useEffect(() => {
    setEcoule(depuis(demarreLe))
    const battement = setInterval(() => setEcoule(depuis(demarreLe)), 250)
    return () => clearInterval(battement)
  }, [demarreLe])

  return ecoule
}

/**
 * Où en est la jauge, entre 0 et 1.
 *
 * Linéaire jusqu'à 85 % au moment de l'attente estimée, puis asymptotique :
 * chaque seconde supplémentaire avance moins que la précédente, et le bout
 * n'est jamais atteint. Une jauge qui se colle à 100 % avant l'arrivée dit une
 * chose fausse ; celle-ci dit « ça dépasse, et ça continue ».
 */
export function part(ecoule: number, attendue: number, enAttente: boolean): number {
  if (enAttente || attendue <= 0) return 0
  const fraction = ecoule / attendue
  if (fraction <= 1) return 0.85 * fraction
  return 0.85 + 0.14 * (1 - 1 / fraction)
}

// ── La zone de texte qui grandit avec ce qu'on y écrit ──────────────────────

/**
 * Un champ de texte long dont la hauteur suit son contenu, entre un plancher et
 * un plafond.
 *
 * **Pourquoi il existe** — ajouté le 31 août 2026. Le produit écrivait ses
 * textes les plus longs dans des boîtes de deux ou trois lignes : la
 * description d'un personnage, qui repart avec **chaque** image de ce
 * personnage et décide donc de ce qu'on paie, se composait par un hublot de
 * quatre lignes sur vingt-quatre — mesuré, 733 signes dont un sixième visible.
 * Le document de présentation du jeu, 4 350 mots, se corrigeait dans trois
 * lignes. Écrire long dans une fente courte n'est pas un inconfort : on ne
 * relit pas, donc on ne corrige pas, et le texte le plus cher du produit est
 * celui qu'on regarde le moins.
 *
 * **Un plafond, et pas seulement un plancher.** Sans lui, une note de quatre
 * mille mots repousserait tout ce qui la suit hors de l'écran — c'est
 * exactement le défaut que la carte de texte du tableau avait payé le 31 août
 * 2026, et qu'`aspect-square` avait réparé. Au-delà du plafond, la zone défile,
 * et la barre de 9 px du produit dit qu'il y a plus.
 *
 * La hauteur se mesure au navigateur (`scrollHeight`), jamais estimée depuis le
 * nombre de signes : la largeur du champ, la police et les retours à la ligne
 * décident, et eux seuls savent.
 */
export function ZoneTexte({
  valeur,
  onChange,
  onBlur,
  lignesMin = 3,
  lignesMax = 16,
  className = "",
  ...reste
}: {
  valeur: string
  onChange: (valeur: string) => void
  onBlur?: () => void
  /** La hauteur au repos, en lignes. Le champ n'est jamais plus court. */
  lignesMin?: number
  /** Là où il s'arrête de grandir et se met à défiler. */
  lignesMax?: number
  className?: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur" | "rows" | "className"
>) {
  const zone = useRef<HTMLTextAreaElement>(null)

  // `useLayoutEffect` et non `useEffect` : la hauteur est posée avant que le
  // navigateur peigne, sinon le champ saute d'une frappe à l'autre.
  useLayoutEffect(() => {
    const noeud = zone.current
    if (!noeud) return
    // La ligne se mesure sur le champ lui-même — sa police, son interligne —
    // plutôt que sur une constante qui vieillirait à la première retouche de
    // style. `18` n'est employé que si le navigateur ne rend pas encore de
    // hauteur de ligne calculable, ce qui n'arrive qu'en essai.
    const ligne = parseFloat(getComputedStyle(noeud).lineHeight) || 18
    const bords = noeud.offsetHeight - noeud.clientHeight
    const plancher = ligne * lignesMin
    const plafond = ligne * lignesMax
    // Remettre à zéro d'abord : `scrollHeight` ne redescend jamais tout seul
    // en dessous de la hauteur déjà posée, et le champ ne rétrécirait plus
    // quand on efface.
    noeud.style.height = "0px"
    const voulue = Math.min(Math.max(noeud.scrollHeight, plancher), plafond)
    noeud.style.height = `${voulue + bords}px`
    noeud.style.overflowY = noeud.scrollHeight > plafond ? "auto" : "hidden"
  }, [valeur, lignesMin, lignesMax])

  return (
    <textarea
      ref={zone}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`defile resize-none ${className}`}
      {...reste}
    />
  )
}

/** **Le rectangle que l'image occupe vraiment dans la surface qui reçoit le
 *  geste** (U2, puis U11).
 *
 *  Le dépôt a déjà appris cette leçon une fois, sur l'écran de découpe : *le
 *  cadre **est** l'image, mis à l'échelle par calcul ; une boîte qui ment
 *  décale ce qu'on pose dessus.* Elle se réapprend ici, à deux endroits — le
 *  rectangle de recadrage et le pinceau de la main —, et c'est la même erreur :
 *  la surface est dimensionnée d'après les mesures que l'atelier garde de
 *  l'image, l'image est posée dedans en *tenant dans le cadre*, donc centrée
 *  avec des bandes vides de chaque côté dès que les deux proportions diffèrent
 *  d'un cheveu. Un calcul qui mesure la surface au lieu de l'image se décale de
 *  la largeur de la bande, et un recadrage change précisément les proportions
 *  du rendu.
 *
 *  Cette fonction refait ce que `object-contain` fait — la plus grande échelle
 *  qui tienne, centrée — et rend le rectangle en coordonnées d'écran. Toute
 *  surface qui transforme un clic en pixel d'image passe par elle. */
export function rectangleDeLImage(
  surface: { left: number; top: number; width: number; height: number },
  largeur: number,
  hauteur: number,
) {
  if (largeur <= 0 || hauteur <= 0) return surface
  const echelle = Math.min(surface.width / largeur, surface.height / hauteur)
  const rendue = { width: largeur * echelle, height: hauteur * echelle }
  return {
    left: surface.left + (surface.width - rendue.width) / 2,
    top: surface.top + (surface.height - rendue.height) / 2,
    ...rendue,
  }
}

/** Le point de la barre d'état. Quatre pixels et un arrondi de 5 — la pastille
 *  du pied du carnet, la même que `Carnet.tsx` (`D6` : elle en faisait 5 avec un
 *  rayon plein, deux valeurs hors des listes fermées de `docs/DESIGN.md`). */
export function Point({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[4px] w-[4px] rounded-5"
      style={{ background: couleur }}
    />
  )
}

/**
 * L'échantillon de hauteur — **le sujet à côté d'un personnage** (tranche des
 * tailles, 3 septembre 2026 ; fondu avec celui de la retouche en `B27`).
 *
 * **Il répond à une demande précise de l'auteur** : *« les deux, avec un rappel
 * visuel, une sorte d'échantillon »*. Les deux, ce sont les deux façons de dire
 * la même hauteur — un nombre de carrés, que réclament les moteurs de jeu et les
 * outils de dessin ; un nombre de personnages, qui est ce qu'on a en tête quand
 * on décrit un monde. Ni l'une ni l'autre n'est de trop, et un pourcentage seul
 * ne dit ni l'un ni l'autre.
 *
 * **Le dessin qu'il remplace plafonnait à la case**, et c'est ce qui le rendait
 * faux : une barre dans un carré ne peut jamais dépasser le carré, donc elle ne
 * pouvait pas montrer un moulin plus haut qu'un personnage — le dessin disait
 * exactement ce que le produit ne savait pas faire. Ici le cadre **est** le
 * fichier qui reviendra, et le trait pointillé marque la hauteur d'un
 * personnage : au-dessous de 100 % il se confond avec le haut du cadre, au-delà
 * il descend, et le rapport se lit d'un coup d'œil.
 *
 * **Elle a été mise en commun par `B27`, quand elle avait deux appelants** :
 * l'assistant sur le châssis sombre, `Retouche.tsx` sur le papier du carnet.
 * L'assistant est parti avec `C2`, et son réglage `palette` avec lui en `C9` :
 * il ne restait qu'une valeur employée. Elle ne se dessine plus que sur le
 * papier, et le jour où un second appelant sombre revient, c'est un réglage à
 * rouvrir — pas une branche morte à garder au chaud.
 */
export function EchantillonDeHauteur({
  occupation,
  cible,
  haut = 84,
  largeur = 56,
}: {
  occupation: number
  cible: number
  /** La hauteur du dessin, en points d'écran. Le seul réglage : les deux écrans
   *  qui s'en servent n'ont pas la même place. */
  haut?: number
  /** La largeur du cadre, en points d'écran — même raison que `haut`. */
  largeur?: number
}) {
  const enPersonnages = Math.max(1, occupation) / 100
  // **L'échelle du dessin est le plus grand des deux** — le sujet ou le
  // personnage —, sans quoi un moulin de trois personnages sortirait du cadre au
  // lieu de le remplir.
  const echelle = Math.max(1, enPersonnages)
  const hSujet = Math.max(2, Math.round((haut * enPersonnages) / echelle))
  const hPersonnage = Math.round(haut / echelle)
  const carres = coteDuCanevas(cible, occupation)
  const sujet = coteDuSujet(cible, occupation)
  const depasse = occupation > 100
  const nombre = (n: number) =>
    n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
  return (
    <div className={"flex items-end gap-[14px]"}>
      <span
        aria-hidden
        className={"relative flex shrink-0 items-end justify-center border border-trait bg-papier-cote"}
        style={{ height: `${haut}px`, width: `${largeur}px` }}
      >
        <span
          className={"block w-full bg-encre-4"}
          style={{ height: `${hSujet}px` }}
        />
        {/* **La hauteur d'un personnage, en pointillé.** Dessinée seulement
            quand elle dit quelque chose : à 100 % et au-dessous elle est le haut
            du cadre, et un trait posé sur une bordure n'est pas un repère. */}
        {depasse && (
          <span
            className="absolute right-0 left-0 border-t border-dashed border-epingle"
            style={{ bottom: `${hPersonnage}px` }}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span
          className={"text-[12px] leading-tight text-encre-2"}
        >
          {depasse
            ? `${nombre(enPersonnages)} personnages de haut`
            : `${occupation} % d'un personnage`}
        </span>
        <span
          className={"mesure text-[10.5px] leading-tight text-encre-4"}
        >
          {sujet === carres
            ? `l'image revient en ${carres} carrés de côté`
            : `${sujet} carrés dans une image de ${carres}`}
        </span>
      </div>
    </div>
  )
}
