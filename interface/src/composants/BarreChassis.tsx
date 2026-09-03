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
// H-2 de `docs/archive/v21-corrections-a-traiter.md`, qui le tranchent.

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

// ── Avec quoi on peut produire (E19, réécrit en F3) ─────────────────────────

/**
 * `2 fournisseurs prêts`, `1 sur 2`, ou `rien pour produire`.
 *
 * **Ce qui manque se lit sans ouvrir quoi que ce soit.** Sur une machine neuve,
 * l'assistant s'ouvre et la barre dit déjà où l'on en est ; rien n'est caché
 * derrière un menu. C'était vrai en E19, ça l'est resté.
 *
 * **Mais elle disait la mauvaise chose.** `clé …a41c` / `aucune clé` décrivait un
 * monde à un fournisseur : depuis F1 il y en a plusieurs, l'un ne demande rien,
 * et « aucune clé » laissait croire que rien ne pouvait produire alors qu'une
 * image partait très bien. F3 lui fait dire **avec quoi on peut produire**
 * plutôt que **ce qui manque** — et `rien pour produire` ne s'affiche que si
 * aucun fournisseur n'est utilisable, ce qui n'arrive plus : il en reste
 * toujours un.
 *
 * **Ce qui n'est pas prêt mène au tiroir.** Même règle que le grisé d'un modèle :
 * ce qui manque porte sa raison *et* le chemin vers son réglage — jamais un
 * constat sans issue.
 */
function EtatDesFournisseurs({
  tiroirs,
  onReglages,
}: {
  tiroirs: readonly { fournisseur: string; manque: string | null; pret: boolean }[] | null
  onReglages?: () => void
}) {
  if (!tiroirs || tiroirs.length === 0) return null
  const prets = tiroirs.filter((t) => t.pret)
  const manquants = tiroirs.filter((t) => !t.pret)

  const texte =
    prets.length === 0
      ? "rien pour produire"
      : manquants.length === 0
        ? `${prets.length} fournisseur${prets.length > 1 ? "s" : ""} prêt${prets.length > 1 ? "s" : ""}`
        : `${prets.length} sur ${tiroirs.length}`

  // Tout est prêt : un constat, pas une porte. Rien à réparer, rien à ouvrir.
  if (manquants.length === 0 || !onReglages)
    return (
      <span className="mesure shrink-0 text-[10px] text-texte-3">{texte}</span>
    )

  return (
    <button
      type="button"
      onClick={onReglages}
      title={manquants.map((t) => t.manque).filter(Boolean).join(" · ")}
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
 * (B-4 de `docs/archive/v21-corrections-a-traiter.md`). L'afficher aux deux endroits
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
      {/* **« en argent », et c'est un critère de F2** : le total de la barre
          de tête ne compte que ce qui se paie en argent, et son étiquette le
          dit. Depuis qu'un fournisseur consomme des jetons, « ce jeu $2,140 »
          se lirait comme *tout* ce que ce jeu a consommé — ce qu'il n'est
          plus. Le reste vit dans l'écran des dépenses, qui l'ouvre d'un clic. */}
      <span className="text-texte-3">ce jeu, en argent </span>
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

/**
 * Le nom que l'onglet **fait entendre**, quand il diffère de celui qu'il montre.
 *
 * Un seul cas : la Galerie pendant qu'un lot est en route. La pastille se lit du
 * coin de l'œil, mais elle ne se dit pas — mesuré en écrivant l'essai, le calcul
 * du nom accessible ne descend pas chercher l'`aria-label` d'un enfant, et une
 * étiquette posée sur la pastille faisait annoncer « Galerie 1 ». Un nombre sans
 * son unité est la seule chose de la barre qu'on ne pouvait pas comprendre en
 * l'écoutant.
 *
 * `undefined` partout ailleurs : **un nom accessible qu'on n'a pas besoin de
 * réécrire ne se réécrit pas**, sinon il finit par diverger du mot affiché.
 */
function nomLu(cle: Onglet, nom: string, enVol: number): string | undefined {
  if (cle !== "galerie" || enVol <= 0) return undefined
  return `${nom} · ${enVol === 1 ? "1 image en route" : `${enVol} images en route`}`
}

export function BarreChassis({
  onglet,
  onOnglet,
  chemin,
  nomDuJeu,
  montant,
  tiroirs,
  onDepenses,
  onReglagesCle,
  bascules,
  onBasculer,
  fente,
  onReglages,
  onGuide,
  enVol = 0,
}: {
  onglet: Onglet
  onOnglet: (onglet: Onglet) => void
  /** Vide sur un onglet au repos ; rempli dès qu'on descend. */
  chemin: readonly Segment[]
  nomDuJeu: string | null
  montant: string
  /** **Avec quoi on peut produire, dès la première seconde** (E19, au pluriel
   *  en F3). Ce qui manque à un fournisseur se lit sans ouvrir de menu.
   *
   *  **Ici, et plus dans la barre du bas** : la même valeur écrite à deux
   *  endroits est deux endroits à tenir d'accord, et celui-ci est celui que la
   *  maquette du premier lancement nomme.
   *
   *  Un tableau vide et `null` se valent — la barre ne dit rien tant qu'elle ne
   *  sait pas, plutôt que d'annoncer un manque le temps d'un chargement. */
  tiroirs: readonly { fournisseur: string; manque: string | null; pret: boolean }[] | null
  onDepenses?: () => void
  /** Ouvrir la fenêtre où les secrets habitent. **Trois portes, une seule
   *  pièce** : ce contrôle-ci, l'étape « Les fournisseurs » de l'assistant, et
   *  le bouton qui paie quand il est éteint mènent tous les trois au même
   *  tiroir. */
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
  /** Combien d'images sont payées et pas encore arrivées — **zéro la plupart
   *  du temps**, et alors rien ne paraît.
   *
   *  **La moitié qui suit d'un lieu à l'autre** (31 août 2026). Le bloc en route
   *  du champ de prompt dit ce qui part là où l'on a payé ; il ne dit rien une
   *  fois qu'on est passé à l'Univers ou au Codex, et c'est précisément
   *  l'endroit où l'on croit que rien ne s'est passé. La barre de tête, elle,
   *  est rendue sur les trois onglets. */
  enVol?: number
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
            aria-label={nomLu(cle, nom, enVol)}
            onClick={() => onOnglet(cle)}
            className={[
              "flex h-[26px] items-center gap-1.5 rounded-[2px] px-2.5 text-[12px] transition-colors duration-[80ms]",
              onglet === cle
                ? "bg-fond-3 text-texte"
                : "text-texte-2 hover:bg-fond-2 hover:text-texte",
            ].join(" ")}
          >
            {nom}
            {/* **La pastille de ce qui arrive, et elle ne vit que sur la
                Galerie** — c'est le seul des trois lieux où une image se pose.
                Aucune hauteur neuve : elle tient dans les 26 px de la rangée.

                Pleine, et non un simple chiffre en `--signal` : c'est ce qui la
                rend visible du coin de l'œil depuis un autre onglet, ce qui est
                tout son métier. Elle est dans le châssis, jamais dans une
                grille — la règle « aucune couleur de plus » protège les
                surfaces où l'on juge des images, et la barre de tête n'en est
                pas une.

                **`aria-hidden`, et le nom lu est celui du bouton** : voir
                `nomLu`. Mesuré en écrivant l'essai — le calcul du nom accessible
                ne descend pas chercher l'`aria-label` d'un enfant, donc une
                étiquette posée ici aurait fait annoncer « Galerie 1 », un nombre
                sans son unité. */}
            {cle === "galerie" && enVol > 0 && (
              <span
                aria-hidden
                className="mesure rounded-[2px] bg-signal px-1 py-px text-[9.5px] leading-[13px] text-fond-0"
              >
                {enVol}
              </span>
            )}
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

        <EtatDesFournisseurs tiroirs={tiroirs} onReglages={onReglagesCle} />

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
