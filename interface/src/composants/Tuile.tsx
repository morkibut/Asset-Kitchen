// La tuile — l'objet central du produit.
//
// « L'emplacement » (`docs/DESIGN.md`) : au moment où la génération part,
// N tuiles paraissent **à leur taille définitive**, jauge en pied de zone image
// et compteur en mono. La tuile devient l'image, ou devient l'échec. La grille
// ne se recompose jamais entre le départ et l'arrivée — l'œil reste où il est,
// et l'échec atterrit à l'endroit précis où le succès serait arrivé.
//
// **Depuis T3, la grille est faite d'assets** — c'est la bibliothèque, et c'est
// la seule grille du produit (US-31). Un emplacement qui n'a pas encore donné
// son asset y tient quand même sa place, et il la tient sous **la même clé**
// (`<génération>-<rang>`, qui est précisément l'identifiant que l'asset
// portera) : l'image ne se glisse donc pas à côté de son attente, elle la
// remplace. C'est ce qui rend vraie, sans machinerie, la phrase du design.
//
// Rayon 0, aucune ombre : le bord de la tuile et le bord du sprite sont la même
// sorte de ligne, et la grille se lit comme une planche contact.

import {
  api,
  dollars,
  type Asset,
  type Emplacement,
  type Generation,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { Jauge, type Zoom } from "./chassis"

/**
 * Ce que la grille itère. Un asset, ou un emplacement qui l'attend encore.
 *
 * `cle` est la même dans les deux cas, et c'est tout le mécanisme :
 * `<génération>-<rang>`, l'identifiant que l'asset porte à sa naissance.
 * `date` et `rang` sont l'ordre — la date du **lot**, jamais celle de
 * l'arrivée, sans quoi les variations d'un même lot glisseraient les unes par
 * rapport aux autres pendant qu'on les regarde.
 */
export type Entree =
  | { cle: string; date: number; rang: number; sorte: "asset"; asset: Asset }
  | {
      cle: string
      date: number
      rang: number
      sorte: "emplacement"
      generation: Generation
      emplacement: Emplacement
    }

export function Tuile({
  entree,
  selectionnee,
  cote,
  zoom,
  onOuvrir,
  onRelancer,
}: {
  entree: Entree
  selectionnee: boolean
  /** Le cran de la grille, en pixels — ce que la tuile demande au serveur, et
   *  non ce qu'elle rend. Voir `api.vignette`. */
  cote: number
  /** Le cran de zoom de la grille — 1, 2 ou 4 (U8).
   *
   *  **Le vocabulaire du produit, pas une largeur mesurée.** La tuile pourrait
   *  se mesurer elle-même et décider à partir de sa largeur ; elle dépendrait
   *  alors d'une mise en page qui n'existe pas encore au premier rendu, et
   *  clignoterait le temps d'une image. Le cran, lui, est connu d'avance et
   *  c'est déjà lui qui décide de tout le reste de la grille. */
  zoom: Zoom
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRelancer: (generation: string, rang: number) => void
}) {
  const asset = entree.sorte === "asset" ? entree.asset : null
  const emplacement = entree.sorte === "emplacement" ? entree.emplacement : null
  const lot = entree.sorte === "emplacement" ? entree.generation : null
  const rate =
    emplacement !== null &&
    (emplacement.statut === "echouee" || emplacement.statut === "interrompue")
  const enCours =
    emplacement !== null &&
    (emplacement.statut === "en_cours" || emplacement.statut === "en_attente")

  const titre =
    entree.sorte === "asset" ? entree.asset.label : entree.generation.demande.prompt

  // **La tuile montre ce que l'asset est devenu**, pas ce que le fournisseur a
  // rendu : dès qu'une recette existe, c'est le rendu qui s'affiche. Juger sur
  // le brut alors qu'on a détouré et remis sur grille ferait juger autre chose
  // que ce qui partira dans le jeu.
  //
  // C'est `sujetAsset` qui le dit, et il le dit **une fois pour trois surfaces**
  // — la tuile, la fiche et l'aperçu. Espace, le pointeur posé ici, ouvre donc
  // exactement l'image qui est sous les yeux, jamais une autre.
  const sujet = asset ? sujetAsset(asset) : null
  // **La grille demande une vignette, l'aperçu demande le fichier.** Ce sont
  // deux emplois, donc deux adresses : la tuile fait cent quarante-cinq pixels
  // de côté et recevait jusqu'à mille vingt-quatre — mesuré, 25,5 Mo
  // téléchargés pour 0,5 Mo affiché sur un seul passage. `sujet` reste ce que
  // le pointeur vise, et c'est bien le fichier entier qu'Espace doit ouvrir.
  const source = asset ? vignetteAsset(asset, cote) : null
  const visee = useVisee(sujet)

  /** La tuile est-elle à la taille de repos ? **Mesuré, pas estimé** : à 1× la
   *  tuile fait 132,6 px et la ligne des mesures en réclame 137 (U8). Aux deux
   *  autres crans, la place suffit largement. */
  const serree = zoom === 1

  return (
    <figure
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      className={[
        // **`min-w-0`, et c'est lui qui répare le débordement** (U8). Une case
        // de grille vaut `min-width: auto` par défaut, c'est-à-dire *au moins
        // la largeur de mon contenu* : la ligne des mesures réclamait 137 px
        // dans une tuile de 132,6, et la tuile s'élargissait pour la loger —
        // donc le lien *PNG ↓* sortait de 13,2 px sur la droite et se posait
        // sur la voisine. Mesuré au navigateur le 31 août 2026. La tuile est
        // désormais bornée par sa colonne, et c'est à son contenu de tenir
        // dedans.
        "arrivee relative flex min-w-0 flex-col border",
        rate ? "border-echec/45 bg-echec/5" : "border-bord bg-fond-2",
        // L'anneau du sélectionné — « la lampe de la table », `docs/design-motifs.md`
        // § La tuile. Aucune couleur de plus dans la grille.
        selectionnee ? "shadow-[0_0_0_2px_var(--color-lumiere)]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={!asset}
        onClick={(evenement) => asset && onOuvrir(asset.identifiant, evenement)}
        aria-label="Ouvrir la fiche"
        className="relative aspect-square w-full cursor-pointer overflow-hidden disabled:cursor-default"
      >
        {source && (
          <img
            src={source}
            alt={titre.slice(0, 80)}
            // **Rien ne part pour ce qui est sous le bas de l'écran.** Toutes
            // les images de la grille partaient d'un coup, y compris celles
            // qu'il aurait fallu faire défiler pour voir. Mesuré : 82 requêtes
            // d'image pour un seul passage, la plus lente à arriver après
            // 3,8 s — en local, sans réseau.
            loading="lazy"
            decoding="async"
            className="damier h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {enCours && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2">
            <Jauge
              demarreLe={emplacement.demarre_le}
              attendue={emplacement.duree_attendue_s}
            />
          </div>
        )}
        {rate && <Raté raison={emplacement.raison} />}
        <Pastille asset={asset} emplacement={emplacement} />
        {/* « Coin plein haut-droit, `--signal`, 13 px — la seule marque
            visuelle, parce que c'est la seule que l'auteur pose lui-même »
            (`docs/design-motifs.md` § La tuile). Ce que le système constate est un
            mot ; ce que l'auteur pose est une forme. */}
        {asset?.favori && <CoinFavori />}
      </button>

      <figcaption className="flex min-h-[38px] flex-col justify-center gap-[3px] border-t border-bord px-2 py-1.5">
        <span className="truncate text-[11.5px] text-texte" title={titre}>
          {titre}
        </span>
        {rate && lot && emplacement ? (
          <button
            type="button"
            onClick={() => onRelancer(lot.identifiant, emplacement.rang)}
            className="mesure self-start text-[9.5px] text-signal hover:text-signal-clair"
          >
            Relancer
          </button>
        ) : asset ? (
          <Mesures asset={asset} serree={serree} />
        ) : (
          <span className="mesure text-[9.5px] text-texte-3">en attente</span>
        )}
      </figcaption>
    </figure>
  )
}

/** Une tuile porte au maximum un nom et trois mesures. Au-delà, c'est la fiche
 *  qui prend le relais — c'est la règle qui empêche la grille de se charger.
 *
 *  **`--texte-2` et 11 px, et c'est la règle du projet qui l'impose** — corrigé
 *  le 31 août 2026. `--texte-3` est sous le seuil de lisibilité *délibérément*
 *  (`docs/DESIGN.md` § Le texte), et la phrase qui l'autorise dit à quelle
 *  condition : « il ne porte jamais d'information dont l'absence bloquerait —
 *  il porte le grisé, la méta et la raison, tous redondants avec une autre
 *  marque ». **Le prix n'est redondant avec rien** : l'image ne dit pas ce
 *  qu'elle a coûté, et l'argent est l'enjeu que le produit met au centre — il a
 *  un écran à lui. Il était donc le seul fait non redondant de la carte, écrit
 *  dans le gris réservé à ce qui l'est. */
function Mesures({ asset, serree }: { asset: Asset; serree: boolean }) {
  return (
    <div
      data-mesures
      className="mesure flex min-w-0 items-center gap-1.5 text-[11px] text-texte-2"
    >
      {/* Les dimensions **du rendu** quand il y en a un : c'est l'image qu'on
          regarde, donc c'est elle qu'on mesure.

          **Elle est la seule des trois qui cède** (U8). Le prix est l'enjeu que
          le produit met au centre et le téléchargement est une cible : ni l'un
          ni l'autre ne se tronque. Les dimensions, elles, sont redites en entier
          sur la fiche, à un clic — et une largeur coupée reste lisible là où un
          prix coupé ne veut plus rien dire. */}
      <span className="min-w-0 truncate">
        {asset.traite
          ? `${asset.rendu_largeur}×${asset.rendu_hauteur}`
          : `${asset.largeur}×${asset.hauteur}`}
      </span>
      {/* **Le point de séparation cède avant les mesures.** Mesuré au
          navigateur : à la taille de repos, la ligne dispose de 120 px et ses
          quatre morceaux en réclament 124 — les dimensions se coupaient donc de
          trois pixels, et `831×907` se lisait `831×9…`. Le point et son écart
          valent treize pixels à eux deux, et un point n'est pas une mesure : ce
          qu'il fait, l'écart le fait déjà. */}
      {!serree && (
        <span aria-hidden className="shrink-0">
          ·
        </span>
      )}
      <span className="shrink-0">{dollars(asset.cout_usd)}</span>
      {/* **À la taille de repos, le lien se réduit à sa flèche.** La planche
          contact ne perd pas une colonne pour un bouton secondaire, et le
          téléchargement reste atteignable aux trois tailles — c'est le mot qui
          part, pas la cible. Le nom complet reste dans le `title` et dans le
          nom accessible, pour qui lit l'écran autrement qu'avec les yeux. */}
      <a
        href={api.telechargementAsset(asset.identifiant)}
        download
        onClick={(e) => e.stopPropagation()}
        title="télécharger le PNG"
        aria-label="télécharger le PNG"
        className="ml-auto shrink-0 text-signal hover:text-signal-clair"
      >
        {serree ? "↓" : "PNG ↓"}
      </a>
    </div>
  )
}

/**
 * Une pastille, et une seule — pour un état **subi**.
 *
 * `docs/design-motifs.md` § La tuile en donne la liste close : `réglé`, `agent`,
 * `parent supprimé`. « interrompu » lui appartient depuis T1, pour la même
 * raison : c'est ce que le système constate, jamais ce que l'auteur pose.
 *
 * L'ordre n'est pas arbitraire : une filiation cassée se lit avant un réglage,
 * parce qu'elle change ce qu'on peut encore comprendre de l'image.
 */
function Pastille({
  asset,
  emplacement,
}: {
  asset: Asset | null
  emplacement: Emplacement | null
}) {
  // **`agent` passe avant `réglé`, et c'est l'ordre qui décide** puisqu'une
  // tuile n'en porte qu'une. « Savoir à qui parler quand quelque chose me
  // surprend » (US-39) est ce qu'on cherche en premier devant une image
  // inattendue ; qu'elle ait aussi été retouchée se lit dans sa fiche.
  const [mot, teinte] =
    emplacement?.statut === "interrompue"
      ? ["interrompu", "text-epingle"]
      : asset?.parent_supprime
        ? ["parent supprimé", "text-epingle"]
        : asset?.provenance === "agent"
          ? // `--signal-clair`, nommé pour cet emploi au § Palette. Une
            // troisième couleur de pastille aurait été une couleur de plus
            // dans la grille ; celle-ci est déjà celle du survol du signal.
            ["agent", "text-signal-clair"]
          : asset?.epingle
            ? ["réglé", "text-epingle"]
            : [null, ""]
  if (!mot) return null
  return (
    <span
      className={`mesure absolute top-1.5 left-1.5 bg-fond-0/82 px-1 py-px text-[8.5px] ${teinte}`}
    >
      {mot}
    </span>
  )
}

function CoinFavori() {
  return (
    <span
      aria-label="favori"
      className="absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-t-signal border-l-transparent"
    />
  )
}

/** « Un raté affiche sa raison en clair à la place de l'image. » */
function Raté({ raison }: { raison: string | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      <p className="text-center text-[11.5px] leading-snug text-echec">
        {raison ?? "échec sans raison connue"}
      </p>
    </div>
  )
}
