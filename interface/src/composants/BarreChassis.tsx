// La barre de tête du produit — 44 px, la même sur les trois onglets.
//
// **Ce qu'elle remplace.** Jusqu'ici la barre portait cinq boutons de même
// poids — Univers, Personnages, Catalogue, Réglages, Guide — et les écrans
// qu'ils ouvraient se **couvraient** les uns les autres : sept surfaces
// empilées, dont aucune ne savait laquelle était dessous. La V2.1 en fait trois
// onglets, `Univers · Codex · Galerie`, dans l'ordre du travail — on pose ce qui
// s'applique à tout, on déclare ce que le monde contient, on regarde ce qu'on a
// produit — `docs/maquettes-v2.1/03-chassis-des-tables.html`, au paragraphe
// « Le menu principal — trois onglets, dans l'ordre où ils servent ».
//
// **Ce qui parle de l'outil se sépare de ce qui parle du travail.** Réglages et
// Guide passent à droite, derrière un trait. C'était déjà le cas du Guide seul
// depuis T1 ; la V2.1 lui donne un voisin plutôt que de lui retirer son trait.
//
// Deux bandes empilées au-dessus du travail, jamais trois : 44 pour celle-ci,
// 34 pour la barre des tables quand elle existera (E3). **Le fil d'Ariane n'est
// pas une bande** — il vit dans les 44 px d'ici, à la place du nom de l'onglet.
// C'est le paragraphe « La barre complète » de la même maquette, et le point
// H-2 de `docs/v21-corrections-a-traiter.md`, qui le tranchent.

import type { ReactNode } from "react"
import { Bouton } from "./chassis"

// ── Les trois onglets ───────────────────────────────────────────────────────

export type Onglet = "univers" | "codex" | "galerie"

/** L'ordre n'est ni alphabétique ni arbitraire : c'est celui du travail. Il est
 *  écrit **une fois**, ici, et l'interface le lit — deux listes ordonnées de la
 *  même chose finiraient par diverger. */
export const ONGLETS: readonly { cle: Onglet; nom: string }[] = [
  { cle: "univers", nom: "Univers" },
  { cle: "codex", nom: "Codex" },
  { cle: "galerie", nom: "Galerie" },
]

// ── Le fil d'Ariane ─────────────────────────────────────────────────────────

/** Un étage du chemin. Sans `onAller`, c'est l'étage où l'on est : il ne
 *  ramène nulle part, et c'est ce qui le rend lisible comme la fin du fil. */
export type Segment = { libelle: string; onAller?: () => void }

/**
 * « Cinq segments, et pas un de plus » — `docs/maquettes-v2.1/03-chassis-des-tables.html`,
 * au paragraphe « La barre complète ».
 *
 * **Il a deux formes, et c'est la porte d'entrée qui décide** — pas l'écran
 * d'arrivée. Venu du codex, il nomme chaque étage traversé :
 * `Cœur de pierre › Personnages › Balthazar › marche · sud · image 3 ›
 * Détourage`. Venu de la galerie, l'image n'appartient pas forcément à une
 * chose du jeu et l'on n'est passé par aucune famille : le fil est court —
 * `Cœur de pierre › Galerie › tonneau-cerclé-02 › Découpage`.
 *
 * Le même écran montre donc deux fils différents selon d'où l'on vient, et
 * chacun dit d'où l'on vient. C'est le seul endroit du produit où l'apparence
 * dépend du chemin parcouru, et c'est précisément son métier.
 */
function Fil({ chemin }: { chemin: readonly Segment[] }) {
  return (
    // `flex-1 min-w-0` : le fil prend la place libre et **cède en dernier**.
    // Mesuré au navigateur le 31 août 2026 sur une fenêtre de 1 280 px : sans
    // ces deux mots, la droite de la bande prenait 672 px — plus de la moitié —
    // et les quatre segments tombaient à `cœur de pier… › Gal… › helmet-r… ›
    // Décou…`, c'est-à-dire à rien. Une bande qui dit où l'on est ne peut pas
    // être la première à se faire rogner.
    <nav aria-label="Où l'on est" className="flex min-w-0 flex-1 items-center gap-1.5">
      {chemin.map((segment, rang) => {
        const dernier = rang === chemin.length - 1
        return (
          <span
            key={`${segment.libelle}-${rang}`}
            // **Le dernier segment ne se rogne pas.** C'est l'étage où l'on
            // est, donc le seul dont le nom ne se devine pas par le contexte :
            // les précédents se laissent couper d'abord.
            className={[
              "flex items-center gap-1.5",
              dernier ? "shrink-0" : "min-w-0",
            ].join(" ")}
          >
            {rang > 0 && (
              <span aria-hidden className="mesure shrink-0 text-[11px] text-texte-3">
                ›
              </span>
            )}
            {segment.onAller && !dernier ? (
              <button
                type="button"
                onClick={segment.onAller}
                className="truncate text-[11.5px] text-texte-2 transition-colors duration-[80ms] hover:text-texte"
              >
                {segment.libelle}
              </button>
            ) : (
              <span
                aria-current={dernier ? "page" : undefined}
                className={[
                  "truncate text-[11.5px]",
                  dernier ? "text-texte" : "text-texte-2",
                ].join(" ")}
              >
                {segment.libelle}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// ── La clé, dès la première seconde (E19) ───────────────────────────────────

/**
 * `clé …a41c` ou `aucune clé`, dans la barre du haut.
 *
 * **Le seul préalable dur du produit se lit sans ouvrir quoi que ce soit.** Sur
 * une machine neuve, l'assistant s'ouvre et la barre dit déjà ce qui manque ;
 * rien n'est caché derrière un menu.
 *
 * **Sans clé, le mot mène au champ.** C'est la même règle que le bouton qui
 * paie éteint : ce qui est indisponible porte sa raison *et* le chemin vers son
 * réglage — jamais un constat sans issue.
 */
function EtatDeLaCle({
  cle,
  onReglages,
}: {
  cle: { presente: boolean; apercu: string } | null
  onReglages?: () => void
}) {
  if (!cle) return null
  const texte = cle.presente ? `clé …${cle.apercu}` : "aucune clé"
  if (cle.presente || !onReglages)
    return (
      <span className="mesure shrink-0 text-[10px] text-texte-3">{texte}</span>
    )
  return (
    <button
      type="button"
      onClick={onReglages}
      title="sans elle, le bouton qui paie reste éteint — le reste de l'atelier fonctionne"
      className="mesure shrink-0 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-signal"
    >
      {texte}
    </button>
  )
}

// ── Le total, et ce qu'il ne dit plus ───────────────────────────────────────

/**
 * « Le total de la barre de tête dit toujours de quoi il est le total. »
 *
 * `ce jeu $2,140 ›`, jamais un montant nu, et cliquable : il ouvre l'écran des
 * dépenses. La raison tient en une phrase — **un montant affiché est une
 * question posée** —, et un chiffre qui laisse deviner sa portée finit par être
 * lu comme le total de tout, ce qu'il n'est pas.
 *
 * **Le nom du jeu ne s'écrit qu'une fois.** Quand un fil d'Ariane est déployé,
 * son premier étage porte déjà le nom du projet : le répéter ici ferait deux
 * fois la même chose dans la même bande. Sans fil, le total le porte. C'est la
 * différence exacte entre les deux croquis de
 * `docs/maquettes-v2.1/01-structure.html` : celui de la galerie écrit
 * `Cœur de pierre — 01 · ce jeu $2,140 ›`, celui de l'établi `ce jeu $2,140 ›`,
 * parce que son fil porte déjà le nom.
 *
 * **Et le second total est parti d'ici.** La barre affichait `$3,180 en tout` à
 * côté ; il vit désormais dans l'écran des dépenses, dont c'est *« la seule
 * chose qu'on vient chercher et qu'on ne trouve nulle part ailleurs »*
 * (B-4 de `docs/v21-corrections-a-traiter.md`). L'afficher aux deux endroits
 * retirait à cet écran sa raison d'exister.
 */
function Total({
  nomDuJeu,
  montant,
  onDepenses,
}: {
  /** `null` quand le fil le porte déjà, ou qu'aucun projet n'est ouvert. */
  nomDuJeu: string | null
  montant: string
  /** `undefined` tant que l'écran des dépenses n'existe pas (E18). Le contrôle
   *  reste alors **visible et grisé, avec sa raison** — le produit n'a pas le
   *  droit de proposer puis de refuser, mais il n'a pas non plus le droit de
   *  cacher ce qui existera. */
  onDepenses?: () => void
}) {
  const etiquette = (
    <>
      {nomDuJeu && (
        <>
          <span className="text-texte-3">{nomDuJeu}</span>
          <span aria-hidden className="text-texte-3"> · </span>
        </>
      )}
      <span className="text-texte-3">ce jeu </span>
      <span className="text-texte-2">{montant}</span>
    </>
  )

  if (!onDepenses)
    return (
      <span className="mesure flex min-w-0 items-center gap-1.5 text-[10px]">
        {etiquette}
        <span className="truncate text-texte-3">
          — pas encore d'écran des dépenses
        </span>
      </span>
    )

  return (
    <button
      type="button"
      onClick={onDepenses}
      title="Ouvrir les dépenses"
      className="mesure text-[10px] transition-colors duration-[80ms] hover:text-texte"
    >
      {etiquette}
      <span className="text-texte-3"> ›</span>
    </button>
  )
}

// ── La barre ────────────────────────────────────────────────────────────────

export type Bascule = { cle: string; nom: string; repliee: boolean }

/**
 * Ce que l'écran actif a à dire, à côté du geste qui l'a provoqué.
 *
 * Deux tons seulement : un refus (`echec`) et un compte rendu (`ok`). Ils ont
 * la forme des raisons du produit — tiret de 8 px, mono 10 px —, et jamais
 * celle d'une alerte : le pied de l'écran dit l'état du monde, cette fente-ci
 * dit ce que le dernier geste a donné.
 */
export type Fente = { ton: "echec" | "ok"; texte: ReactNode } | null

function FenteEcran({ fente }: { fente: Fente }) {
  if (!fente) return null
  return (
    <span
      className={[
        "mesure flex items-center gap-1.5 text-[10px]",
        fente.ton === "echec" ? "text-echec" : "text-ok",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "inline-block h-px w-2",
          fente.ton === "echec" ? "bg-echec" : "bg-ok",
        ].join(" ")}
      />
      {fente.texte}
    </span>
  )
}

export function BarreChassis({
  onglet,
  onOnglet,
  chemin,
  nomDuJeu,
  montant,
  cle,
  onDepenses,
  onReglagesCle,
  bascules,
  onBasculer,
  fente,
  onReglages,
  onGuide,
}: {
  onglet: Onglet
  onOnglet: (onglet: Onglet) => void
  /** Vide sur un onglet au repos ; rempli dès qu'on descend. */
  chemin: readonly Segment[]
  nomDuJeu: string | null
  montant: string
  /** **L'état de la clé, dès la première seconde** (E19). Elle est le seul
   *  préalable dur du produit : sans elle, rien ne part chez le fournisseur, et
   *  ne pas le dire d'emblée obligerait à ouvrir un menu pour l'apprendre.
   *
   *  **Ici, et plus dans la barre du bas** : la même valeur écrite à deux
   *  endroits est deux endroits à tenir d'accord, et celui-ci est celui que la
   *  maquette du premier lancement nomme. */
  cle: { presente: boolean; apercu: string } | null
  onDepenses?: () => void
  /** Ouvrir la fenêtre où la clé habite. **Trois portes, une seule pièce** : ce
   *  contrôle-ci, l'étape 10 de l'assistant, et le bouton qui paie quand il est
   *  éteint mènent tous les trois au même champ. */
  onReglagesCle?: () => void
  /** **Chaque bascule nomme la colonne qu'elle replie sur l'écran courant.**
   *  Deux mots uniques — `arbre` et `réglages` — servaient les quatre écrans,
   *  et mentaient sur trois. L'écran actif dit donc lui-même ce qu'il replie. */
  bascules: readonly Bascule[]
  onBasculer: (cle: string) => void
  /** Ce que l'écran actif a à dire — un refus, ou le résultat d'un geste.
   *  **Une seule fente pour les trois onglets** : tant que chaque écran couvrait
   *  les autres, chacun devait porter la sienne, sinon sa raison se rendait
   *  derrière lui. Les onglets rendent la barre d'état visible partout, et cette
   *  fente-ci reste pour ce qui doit se lire à côté du geste. */
  fente: Fente
  onReglages: () => void
  onGuide: () => void
}) {
  return (
    <header className="flex h-[44px] items-center gap-4 border-b border-bord bg-fond-1 px-4">
      {/* Le seul endroit où l'outil a un visage — 17 px, l'unique exception à
          la règle « Instrument Serif ne descend jamais sous 24 px ». */}
      <h1 className="shrink-0 font-serif text-[17px] leading-none text-texte">
        Asset Kitchen
      </h1>

      {/* Un seul onglet allumé à la fois, et rien ne se superpose. Le carré
          plein de l'onglet actif est la même marque que celle d'une place de
          recette qui agit : le produit n'a qu'un vocabulaire de l'état.

          **Un onglet éteint est en `--texte-2`, jamais en `--texte-3`** —
          corrigé le 31 août 2026. `--texte-3` est sous le seuil de lisibilité
          délibérément, et `docs/DESIGN.md` § Le texte dit à quelle condition :
          il ne porte que du redondant. Un onglet de navigation n'est ni un
          grisé, ni une méta, ni une raison — c'est **l'adresse d'un lieu**, et
          rien d'autre à l'écran ne dit que ce lieu existe. Le mettre là le
          rendait lisible seulement au survol, c'est-à-dire une fois qu'on
          l'avait déjà trouvé. L'écart avec l'onglet allumé se dit par le fond
          plein, qui est la marque, pas par l'effacement du texte. */}
      <nav aria-label="Les trois lieux" className="flex shrink-0 items-center gap-1">
        {ONGLETS.map(({ cle, nom }) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => onOnglet(cle)}
            className={[
              "h-[26px] rounded-[2px] px-2.5 text-[12px] transition-colors duration-[80ms]",
              onglet === cle
                ? "bg-fond-3 text-texte"
                : "text-texte-2 hover:bg-fond-2 hover:text-texte",
            ].join(" ")}
          >
            {nom}
          </button>
        ))}
      </nav>

      {chemin.length > 0 && <Fil chemin={chemin} />}

      {/* `min-w-0` et non `shrink-0` : ce groupe **cède avant le fil**. Ce
          qu'il porte de plus long est une raison de grisé, qui se relit et se
          devine ; ce que le fil porte est l'adresse de l'écran, qui ne se
          devine pas. Les contrôles, eux, gardent leur taille. */}
      <div className="ml-auto flex min-w-0 items-center gap-4">
        <FenteEcran fente={fente} />

        <Total nomDuJeu={nomDuJeu} montant={montant} onDepenses={onDepenses} />

        <EtatDeLaCle cle={cle} onReglages={onReglagesCle} />

        {bascules.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {bascules.map(({ cle, nom, repliee }) => (
              <button
                key={cle}
                type="button"
                onClick={() => onBasculer(cle)}
                aria-pressed={!repliee}
                className={[
                  "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
                  repliee
                    ? "border-bord bg-fond-2 text-texte-3"
                    : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
                ].join(" ")}
              >
                {nom}
              </button>
            ))}
          </div>
        )}

        {/* Ce qui parle de l'outil et non du travail — donc le seul groupe
            séparé de la barre. Les deux se disent **en toutes lettres** : les
            premiers croquis dessinaient une roue dentée et un point
            d'interrogation, et ce sont les mots qui restent (B-5). */}
        <div className="flex shrink-0 items-center gap-2 border-l border-bord pl-4">
          <Bouton onClick={onReglages} enfants="Réglages" />
          <Bouton onClick={onGuide} enfants="Guide" />
        </div>
      </div>
    </header>
  )
}
