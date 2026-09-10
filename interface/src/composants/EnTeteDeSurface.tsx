// L'en-tête de la surface — 34 px de papier, à la place de la barre du châssis.
//
// **Ce qu'elle remplace, et ce qu'elle ne remplace pas.** `BarreChassis.tsx`
// portait sept choses dans ses 44 px : trois onglets, le fil d'Ariane, le
// total, l'état des fournisseurs, les bascules de repli, la fente de l'écran,
// et le couple *Réglages · Guide*. `C9` retire les onglets — **le carnet est le
// seul chemin**, et deux systèmes de navigation dans la même fenêtre étaient un
// de trop. Les six autres restent, mot pour mot, sur le papier du carnet.
//
// **Pourquoi une bande, et pas le carnet.** Le carnet dit où l'on peut aller ;
// cette bande dit où l'on est et ce que l'écran ouvert a à dire. Descendre le
// fil d'Ariane dans le carnet l'aurait mis à côté des lignes qu'il ne nomme
// pas — on lirait « Détourage » sous « Les personnages », sans rapport.
//
// **Le nom du jeu ne s'écrit qu'une fois dans la bande** : déployé, le fil le
// porte à son premier étage ; sans fil, c'est le total qui le porte. C'est la
// règle d'avant, et elle n'a pas changé de raison — deux fois le même nom dans
// une bande de 34 px est du cadrage.

import type { ReactNode } from "react"

// ── Le fil d'Ariane ─────────────────────────────────────────────────────────

/** Un étage du chemin. Sans `onAller`, c'est l'étage où l'on est : il ne
 *  ramène nulle part, et c'est ce qui le rend lisible comme la fin du fil. */
export type Segment = { libelle: string; onAller?: () => void }

/**
 * « Cinq segments, et pas un de plus » — `Navigation.dc.html` § Le fil.
 *
 * **Il a deux formes, et c'est la porte d'entrée qui décide** — pas l'écran
 * d'arrivée. Venu d'une famille, il nomme chaque étage traversé :
 * `Le Marais › Les personnages › Balthazar › marche · sud · image 3 ›
 * Détourage`. Venu de la galerie, l'image n'appartient pas forcément à une
 * chose du jeu et l'on n'est passé par aucune famille : le fil est court —
 * `Le Marais › La galerie › tonneau-cerclé-02 › Détourage`.
 *
 * Le même écran montre donc deux fils différents selon d'où l'on vient, et
 * chacun dit d'où l'on vient. C'est le seul endroit du produit où l'apparence
 * dépend du chemin parcouru, et c'est précisément son métier.
 */
function Fil({ chemin }: { chemin: readonly Segment[] }) {
  return (
    // `flex-1 min-w-0` : le fil prend la place libre et **cède en dernier**.
    // Une bande qui dit où l'on est ne peut pas être la première à se faire
    // rogner — mesuré au navigateur le 31 août 2026, sans ces deux mots les
    // quatre segments tombaient à `Le Mar… › La gal… › tonneau-… › Déto…`.
    <nav aria-label="Où l'on est" className="flex min-w-0 flex-1 items-center gap-[8px]">
      {chemin.map((segment, rang) => {
        const dernier = rang === chemin.length - 1
        return (
          <span
            key={`${segment.libelle}-${rang}`}
            // **Le dernier segment ne se rogne pas.** C'est l'étage où l'on
            // est, donc le seul dont le nom ne se devine pas par le contexte :
            // les précédents se laissent couper d'abord.
            className={[
              "flex items-center gap-[8px]",
              dernier ? "shrink-0" : "min-w-0",
            ].join(" ")}
          >
            {rang > 0 && (
              <span aria-hidden className="mesure shrink-0 text-[11px] text-encre-4">
                ›
              </span>
            )}
            {segment.onAller && !dernier ? (
              <button
                type="button"
                onClick={segment.onAller}
                className="truncate text-[11.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
              >
                {segment.libelle}
              </button>
            ) : (
              <span
                aria-current={dernier ? "page" : undefined}
                className={[
                  "truncate text-[11.5px]",
                  dernier ? "text-encre" : "text-encre-3",
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
 * l'assistant s'ouvre et la bande dit déjà où l'on en est ; rien n'est caché
 * derrière un menu.
 *
 * **Avec quoi on peut produire** (F3), et non plus *ce qui manque* :
 * `rien pour produire` ne s'affiche que si aucun fournisseur n'est utilisable,
 * ce qui n'arrive plus — il en reste toujours un.
 *
 * **Ce qui n'est pas prêt mène au tiroir.** Même règle que le grisé d'un
 * modèle : ce qui manque porte sa raison *et* le chemin vers son réglage.
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
    return <span className="mesure shrink-0 text-[10.5px] text-encre-4">{texte}</span>

  return (
    <button
      type="button"
      onClick={onReglages}
      title={manquants.map((t) => t.manque).filter(Boolean).join(" · ")}
      className="mesure shrink-0 text-[10.5px] text-encre-4 transition-colors duration-120 hover:text-signal"
    >
      {texte}
    </button>
  )
}

// ── Le total, et ce qu'il ne dit plus ───────────────────────────────────────

/**
 * « Le total de la bande dit toujours de quoi il est le total. »
 *
 * `ce jeu, en argent $2,140 ›`, jamais un montant nu, et cliquable : il ouvre
 * l'écran des dépenses. La raison tient en une phrase — **un montant affiché
 * est une question posée** —, et un chiffre qui laisse deviner sa portée finit
 * par être lu comme le total de tout, ce qu'il n'est pas.
 *
 * **Et le second total n'est pas ici.** La bande affichait `$3,180 en tout` à
 * côté ; il vit dans l'écran des dépenses, dont c'est la seule chose qu'on
 * vient y chercher. L'afficher aux deux endroits lui retirait sa raison
 * d'exister.
 */
function Total({
  nomDuJeu,
  montant,
  onDepenses,
}: {
  /** `null` quand le fil le porte déjà, ou qu'aucun projet n'est ouvert. */
  nomDuJeu: string | null
  montant: string
  onDepenses?: () => void
}) {
  const etiquette = (
    <>
      {nomDuJeu && (
        <>
          <span className="text-encre-4">{nomDuJeu}</span>
          <span aria-hidden className="text-encre-4"> · </span>
        </>
      )}
      {/* **« en argent », et c'est un critère de F2** : le total ne compte que
          ce qui se paie en argent, et son étiquette le dit. Depuis qu'un
          fournisseur consomme des jetons, « ce jeu $2,140 » se lirait comme
          *tout* ce que ce jeu a consommé — ce qu'il n'est plus. */}
      <span className="text-encre-4">ce jeu, en argent </span>
      <span className="text-encre-3">{montant}</span>
    </>
  )

  if (!onDepenses)
    return (
      <span className="mesure flex min-w-0 items-center gap-[8px] text-[10.5px]">
        {etiquette}
      </span>
    )

  return (
    <button
      type="button"
      onClick={onDepenses}
      title="Ouvrir les dépenses"
      className="mesure text-[10.5px] transition-colors duration-120 hover:text-encre"
    >
      {etiquette}
      <span className="text-encre-4"> ›</span>
    </button>
  )
}

// ── La bande ────────────────────────────────────────────────────────────────

export type Bascule = { cle: string; nom: string; repliee: boolean }

/**
 * Ce que l'écran actif a à dire, à côté du geste qui l'a provoqué.
 *
 * Deux tons seulement : un refus (`echec`) et un compte rendu (`ok`). Ils ont
 * la forme des raisons du produit — tiret de 8 px, mono 10.5 px —, et jamais
 * celle d'une alerte : le pied de l'écran dit l'état du monde, cette fente-ci
 * dit ce que le dernier geste a donné.
 */
export type Fente = { ton: "echec" | "ok"; texte: ReactNode } | null

function FenteEcran({ fente }: { fente: Fente }) {
  if (!fente) return null
  return (
    <span
      className={[
        "mesure flex items-center gap-[8px] text-[10.5px]",
        fente.ton === "echec" ? "text-echec" : "text-encre-ok",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "inline-block h-px w-2",
          fente.ton === "echec" ? "bg-echec" : "bg-encre-ok",
        ].join(" ")}
      />
      {fente.texte}
    </span>
  )
}

export function EnTeteDeSurface({
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
}: {
  /** Vide sur une surface au repos ; rempli dès qu'on descend. */
  chemin: readonly Segment[]
  nomDuJeu: string | null
  montant: string
  /** **Avec quoi on peut produire, dès la première seconde** (E19, au pluriel
   *  en F3). Un tableau vide et `null` se valent — la bande ne dit rien tant
   *  qu'elle ne sait pas, plutôt que d'annoncer un manque le temps d'un
   *  chargement. */
  tiroirs: readonly { fournisseur: string; manque: string | null; pret: boolean }[] | null
  onDepenses?: () => void
  /** Ouvrir la fenêtre où les secrets habitent. **Trois portes, une seule
   *  pièce** : ce contrôle-ci, l'étape « Les fournisseurs » de l'assistant, et
   *  le bouton qui paie quand il est éteint. */
  onReglagesCle?: () => void
  /** **Chaque bascule nomme la colonne qu'elle replie sur l'écran courant.**
   *  Deux mots uniques — `arbre` et `réglages` — servaient les quatre écrans,
   *  et mentaient sur trois. */
  bascules: readonly Bascule[]
  onBasculer: (cle: string) => void
  fente: Fente
  onReglages: () => void
  onGuide: () => void
}) {
  return (
    <header className="flex h-[34px] items-center gap-[14px] border-b border-trait bg-papier-cote px-[14px]">
      {chemin.length > 0 && <Fil chemin={chemin} />}

      {/* `min-w-0` et non `shrink-0` : ce groupe **cède avant le fil**. Ce
          qu'il porte de plus long est une raison de grisé, qui se relit et se
          devine ; ce que le fil porte est l'adresse de l'écran, qui ne se
          devine pas. Les contrôles, eux, gardent leur taille. */}
      <div className="ml-auto flex min-w-0 items-center gap-[14px]">
        <FenteEcran fente={fente} />

        <Total nomDuJeu={nomDuJeu} montant={montant} onDepenses={onDepenses} />

        <EtatDesFournisseurs tiroirs={tiroirs} onReglages={onReglagesCle} />

        {bascules.length > 0 && (
          <div className="flex shrink-0 items-center gap-[4px]">
            {bascules.map(({ cle, nom, repliee }) => (
              <button
                key={cle}
                type="button"
                onClick={() => onBasculer(cle)}
                aria-pressed={!repliee}
                className={[
                  "mesure h-[22px] rounded-5 border border-contour px-[8px] text-[10.5px] transition-colors duration-120",
                  repliee
                    ? "bg-papier-cote text-eteint hover:bg-papier"
                    : "bg-carte text-encre-3 hover:bg-papier",
                ].join(" ")}
              >
                {nom}
              </button>
            ))}
          </div>
        )}

        {/* Ce qui parle de l'outil et non du travail — donc le seul groupe
            séparé de la bande. Les deux se disent **en toutes lettres** : les
            premiers croquis dessinaient une roue dentée et un point
            d'interrogation, et ce sont les mots qui restent (B-5).

            ⚠️ **Ils doublent deux lignes du pied du carnet, et c'est
            provisoire.** *Réglages* ouvre `EcranReglages.tsx`, qui porte
            encore les garde-fous de l'agent, le dossier du jeu et les
            mouvements — ce qu'`Installation.tsx` ne reprend pas. *Guide* ouvre
            le même guide que le pied. Les deux partiront avec
            `EcranReglages.tsx`, pas avant : le retirer ici rendrait trois
            réglages introuvables. */}
        <div className="flex shrink-0 items-center gap-[8px] border-l border-trait pl-[14px]">
          <button
            type="button"
            onClick={onReglages}
            className="h-[22px] rounded-5 border border-contour bg-carte px-[8px] text-[11.5px] text-encre-controle transition-colors duration-120 hover:bg-papier"
          >
            Réglages
          </button>
          <button
            type="button"
            onClick={onGuide}
            className="h-[22px] rounded-5 border border-contour bg-carte px-[8px] text-[11.5px] text-encre-controle transition-colors duration-120 hover:bg-papier"
          >
            Guide
          </button>
        </div>
      </div>
    </header>
  )
}
