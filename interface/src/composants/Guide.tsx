/**
 * Le guide — un volet depuis `B7`, plus un écran.
 *
 * `docs/pistes-2026-09-04/carnet/Guide.dc.html`. Avant cette tranche, ouvrir
 * le guide recouvrait tout l'atelier et montrait les 157 entrées du corpus à
 * la file, groupées par les neuf écrans de la V1 — dont six avaient disparu
 * depuis longtemps. **Il montre maintenant ce qui concerne l'écran ouvert,
 * et rien d'autre** : un volet de 380 px, posé à droite, qui ne cache jamais
 * ce qu'il documente.
 *
 * **Il n'a aucune liste à lui.** Ce qu'il affiche vient de `entree.ou` — le
 * même champ que `pieces.tsx` et chaque bulle lisent déjà pour `nom`/`quoi` —
 * et de l'écran que `App.tsx` calcule depuis la pile de lieux. Ajouter une
 * entrée au corpus avec le bon `ou` la fait paraître ici sans toucher ce
 * fichier.
 *
 * **Il ne porte pas de fente de refus**, pour la même raison qu'avant : il ne
 * demande rien au serveur, ne dépense rien, ne peut pas échouer.
 *
 * **Ce qui ne fait pas le voyage depuis l'écran d'avant** : les six pas de
 * « Le geste » et les quatre visites d'écran (« L'univers », « Le codex »,
 * « La galerie », « L'établi ») — une prose longue, écrite pour une colonne de
 * 540 px et pour des noms d'écrans que le carnet a en partie remplacés.
 * Aucun des six critères de `B7` ne la réclame, et la retailler de force dans
 * 380 px lui aurait fait dire autre chose. Elle reste lisible dans l'historique
 * Git (`git show HEAD~1:interface/src/composants/Guide.tsx`) si elle doit un
 * jour redevenir un vrai parcours d'accueil.
 */

import { useEffect, useRef, useSyncExternalStore } from "react"
import { AIDE, SANS_ENTREE, type Explication } from "../aide"

// ── Ouvrir le guide depuis n'importe où ─────────────────────────────────────
//
// Le patron de la barre, et pour la même raison : il s'appelle au clavier
// depuis n'importe quel écran, et on ne fait pas descendre un rappel à
// travers quatre étages pour un volet qui se pose par-dessus tout.

let ouvert = false
let ancre: string | null = null
const abonnes = new Set<() => void>()

function prevenir() {
  abonnes.forEach((f) => f())
}

/** `cle`, s'il est donné, force l'écran du volet à celui de cette entrée-là —
 *  c'est le lien « Le guide › » d'une bulle, et il doit toujours retomber
 *  juste, même si on le clique depuis un écran que l'entrée ne concerne pas. */
export function ouvrirGuide(cle?: string) {
  ouvert = true
  ancre = cle ?? null
  prevenir()
}

export function fermerGuide() {
  if (!ouvert) return
  ouvert = false
  ancre = null
  prevenir()
}

export function useGuide() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    () => ouvert,
    () => false,
  )
}

/** Remettre le guide à zéro — les essais d'écran, comme pour la barre. */
export function reinitialiserGuide() {
  ouvert = false
  ancre = null
  prevenir()
}

// ── L'écran, en toutes lettres ───────────────────────────────────────────────

/** Comment un écran se nomme dans l'en-tête du volet. Fermée : ajouter un
 *  membre à `Explication["ou"]` sans l'ajouter ici est une erreur de type,
 *  pas un oubli silencieux. */
const NOM_DE_LECRAN: Record<Explication["ou"], string> = {
  "tableau-de-bord": "Le tableau de bord",
  codex: "Le codex",
  sujet: "La fiche d'un sujet",
  galerie: "La galerie",
  case: "La fiche d'une image",
  clip: "Un clip",
  bande: "Une animation",
  montage: "Le montage d'un clip",
  tables: "Les tables",
  depenses: "Les dépenses",
  inspiration: "Inspiration",
  jeu: "Réglages du jeu",
  ambiances: "Ambiances et couleurs",
  reglages: "L'installation",
  equipement: "Les équipements",
}

// ── Le panneau des touches ────────────────────────────────────────────────
//
// **Rien n'y entre sans avoir été vérifié dans le code qui la lit** — c'est
// le critère qui commande la tranche. Une touche qui ne répond plus un jour
// doit sortir d'ici le même jour.
//
// **Les tables n'y sont pas.** `Ctrl Z` défait un trait de pinceau, mais
// seulement sur la place « la main » — une des huit — et cette place vit
// dans un état propre à la retouche (`interface/src/recette.ts`, `useEtatMain`),
// jamais remonté jusqu'ici. L'annoncer pour tout l'écran des tables la
// rendrait fausse sur les sept autres.
const CTRL_Z = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘Z" : "Ctrl Z"

const TOUCHES: Partial<Record<Explication["ou"], readonly { touche: string; quoi: string }[]>> = {
  inspiration: [
    { touche: "suppr", quoi: "retire le rectangle de découpe choisi" },
    { touche: CTRL_Z, quoi: "défait le dernier geste de composition sur la toile" },
  ],
  montage: [
    { touche: "← →", quoi: "déplace le curseur sur le ruban du clip" },
    { touche: "espace", quoi: "prend ou laisse l'image visée" },
  ],
  bande: [
    { touche: "↑ ↓ ← →", quoi: "déplace la case choisie d'un pixel" },
    { touche: "maj + flèche", quoi: "déplace de cinq pixels" },
  ],
}

// ── Le volet ─────────────────────────────────────────────────────────────

export function VoletGuide({
  onFermer,
  ecran,
}: {
  onFermer: () => void
  /** L'écran ouvert, calculé par `App.tsx` depuis la pile de lieux — ou
   *  `null` sur un parcours qui n'en a pas encore (l'ouverture, par exemple). */
  ecran: Explication["ou"] | null
}) {
  const corps = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  // Un lien de bulle force l'écran de sa propre entrée : ouvrir « Le guide › »
  // depuis un réglage retombe toujours sur ce réglage, jamais sur un groupe
  // vide parce que l'écran calculé aurait divergé d'un rendu à l'autre.
  const cible = ancre && AIDE[ancre] ? AIDE[ancre] : null
  const scope = cible?.ou ?? ecran

  useEffect(() => {
    if (!ancre) return
    const noeud = corps.current?.querySelector(`#reglage-${ancre.replace(/\W/g, "-")}`)
    noeud?.scrollIntoView({ block: "start" })
  }, [])

  const entrees = scope ? Object.entries(AIDE).filter(([, e]) => e.ou === scope) : []
  const touches = scope ? TOUCHES[scope] : undefined
  const rien = entrees.length === 0 && !touches

  return (
    <div
      data-volet-du-guide
      aria-label="Le guide"
      className="fixed inset-y-0 right-0 z-10 flex w-[380px] shrink-0 flex-col border-l border-trait bg-carte"
    >
      <header className="flex h-[54px] shrink-0 items-center gap-[8px] border-b border-trait px-[14px]">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[15px] leading-none text-encre">Guide</h1>
          {scope && (
            <p className="mesure mt-[4px] truncate text-[11px] text-encre-4">
              {NOM_DE_LECRAN[scope]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="mesure h-[26px] shrink-0 rounded-5 border border-contour px-[8px] text-[10.5px] text-encre-3 transition-colors duration-120 hover:bg-papier"
        >
          fermer · Échap
        </button>
      </header>

      <div ref={corps} className="defile min-h-0 flex-1 overflow-y-auto p-[22px]">
        {rien && (
          <p className="text-[12px] leading-[1.5] text-encre-3">
            Rien à expliquer ici pour l'instant.
          </p>
        )}

        {touches && touches.length > 0 && (
          <div className="mb-[22px] rounded-8 border border-trait bg-papier p-[14px]">
            <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Les touches de cet écran
            </h2>
            <ul className="flex flex-col gap-[8px]">
              {touches.map((t) => (
                <li key={t.touche} className="flex items-baseline gap-[8px] text-[12px] text-encre-2">
                  <span className="mesure shrink-0 rounded-5 border border-contour px-[4px] py-px text-[10.5px] text-encre-3">
                    {t.touche}
                  </span>
                  <span>{t.quoi}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entrees.map(([cle, entree]) => (
          <Reglage key={cle} cle={cle} entree={entree} />
        ))}

        {SANS_ENTREE.length > 0 && (
          <div className="mt-[34px] border-t border-trait pt-[14px]">
            <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Ce qui n'est pas encore écrit
            </h2>
            <ul className="flex flex-col gap-[4px] text-[11px] text-encre-4">
              {SANS_ENTREE.map((nom) => (
                <li key={nom}>{nom}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Une entrée du corpus — **le même texte que la bulle**, jamais recopié. */
function Reglage({ cle, entree }: { cle: string; entree: Explication }) {
  return (
    <section id={`reglage-${cle.replace(/\W/g, "-")}`} className="mt-[22px] first:mt-0">
      <h3 className="text-[13px] font-medium text-encre">{entree.nom}</h3>
      <p className="mt-[4px] text-[12px] leading-[1.5] text-encre">{entree.quoi}</p>
      <p className="mt-[4px] text-[12px] leading-[1.5] text-encre-2">{entree.change}</p>
      <p className="mesure mt-[8px] text-[10.5px] text-encre-4">{entree.origine}</p>
      {entree.long
        ?.split("\n\n")
        .map((para, i) => (
          <p key={i} className="mt-[8px] text-[12px] leading-[1.5] text-encre-2">
            {para}
          </p>
        ))}
    </section>
  )
}
