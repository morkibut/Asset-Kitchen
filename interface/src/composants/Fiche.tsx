// La fiche — 380 px, la quatrième colonne de `docs/DESIGN.md` § Layout.
//
// « La fiche asset est un panneau latéral, pas une page. Une page ferait perdre
// la grille et le prompt ; fermer le panneau remet exactement où l'on était. »
//
// Elle s'est ouverte en T2 avec ce que T2 possédait : la visionneuse, la
// recette, le retour au brut. T3 y ajoute ce que la bibliothèque rend possible
// — le jugement (favori, suppression), la filiation, et la réinjection dans ses
// quatre rôles. Aucune rubrique n'y est arrivée vide : montrer du cadrage au
// lieu de servir le geste est le reproche qui a fait écarter
// `docs/archive/maquette-atelier.html`.
//
// **Portée au papier le 11 septembre 2026 (`D3`)**, d'après la colonne de
// droite de `docs/archive/pistes-2026-09-04/carnet/Galerie.dc.html`. Rien n'y a changé
// de contenu ni de structure : les jetons, les tailles, les arrondis et les
// durées seulement — et le vocabulaire papier de `pieces.tsx` pour `Bloc`,
// `Bouton`, `Libelle`, `Raison`, `Segments` et `EnTetePanneau`. *(Il s'obtenait
// par une prop `papier` jusqu'à `D6`, qui a retiré l'autre branche : c'est
// désormais le seul habillage de ces pièces.)*
//
// ⚠️ **Les rappels facultatifs n'ont pas bougé** : `identite`,
// `directionsAConfirmer`, `onDirection`, `onVariante` et `onEcarter` servent
// *Ses images* (`PageDuSujet`) et personne d'autre — la galerie n'en passe
// aucun. `data-identite-de-l-image` reste posé au même endroit.

import { useEffect, useState } from "react"
import {
  api,
  NOM_DE_LA_METHODE,
  depense,
  estArgent,
  quantite,
  ROLES,
  type Asset,
  type Filiation,
  type Generation,
  type Impose,
  type Origine,
  type Personnage,
  type Pose,
  type Recette,
  type Role,
  type Univers,
} from "../api"
import { type EmplacementAvecGraine } from "../api-workflows"
import { matieres } from "../api-tuiles"
import { sujetAsset, useVisee } from "./Apercu"
import { Bloc, Bouton, EnTetePanneau, Libelle, Raison, Segments } from "./pieces"
import { PANNEAU } from "./Infobulle"
import { posesTenues } from "../production"
import { MOTEUR, RESUME } from "../recette"
// P1c (V3.5) : refaire, lister et supprimer les découpages d'une planche.
import { LesDecoupagesDeLaPlanche } from "./Depliages"

/** Le modèle qui a produit une image, tel qu'il se lit (US-123).
 *
 *  **Trois cas, et le troisième n'est pas un trou.** Une image générée nomme le
 *  modèle exact — l'identifiant du fournisseur, celui qu'on redemandera ; une
 *  image importée n'a pas de modèle et le dit ; et une image dont la génération
 *  a disparu du disque ne peut plus le savoir. Elle ne l'invente pas : « zéro
 *  n'est pas une dimension mesurée, c'est l'absence de mesure »
 *  (`docs/PIEGES.md`), et un nom de modèle deviné vaudrait pire que rien —
 *  c'est très exactement l'information à qui l'on va faire confiance.
 *
 *  **Le fournisseur reste devant, et il ne se coupe jamais** (F1). Un modèle se
 *  nomme par son fournisseur *et* par son nom depuis la V2.2 ; deux
 *  fournisseurs peuvent proposer le même — Cloudflare héberge les modèles de
 *  Leonardo — et couper la moitié gauche rendrait deux images indiscernables
 *  sur la seule question qui compte ici : *à qui redemander*. Le deux-points de
 *  l'identifiant devient un point médian, parce qu'on le lit et qu'on ne le
 *  tape pas. Un nom sans deux-points date d'avant la V2.2 et se rend tel quel. */
/** Le mot français d'une nature de sujet, avec son article (RG3, 20 septembre
 *  2026). Sert deux fois : dire pourquoi le jeu ne détoure pas une matière, et
 *  dire pourquoi une case Pose reste vide.
 *
 *  **Couvre les neuf natures livrées avec le produit**
 *  (`atelier/domaine/projet.py`, `BAREME_PAR_DEFAUT`). Une nature ajoutée par
 *  l'auteur retombe sur son nom entre guillemets — deviner le genre d'un mot
 *  qu'on ne connaît pas vaudrait pire que ne pas le deviner
 *  (`docs/PIEGES.md`). */
const NATURE_AVEC_ARTICLE: Record<string, string> = {
  personnage: "un personnage",
  créature: "une créature",
  meuble: "un meuble",
  "objet posé": "un objet posé",
  "objet tenu": "un objet tenu",
  décor: "un décor",
  tuile: "une tuile",
  matière: "une matière",
  "élément d'interface": "un élément d'interface",
}
const natureAvecArticle = (nom: string): string => NATURE_AVEC_ARTICLE[nom] ?? `« ${nom} »`

export const nomDuModele = (modele: string): string => {
  if (modele === "import") return "importé"
  // **Un mot à elle** (A13). Les deux n'ont appelé personne et ne se relancent
  // pas, mais une image importée est arrivée d'un disque et une image prélevée
  // **vient de quelque chose qui a été payé** — c'est ce que sa filiation garde,
  // et écrire *importée* dessus ferait perdre ce que le produit sait d'elle.
  if (modele === "clip") return "prélevée d'un clip"
  if (!modele) return "modèle inconnu"
  const coupe = modele.indexOf(":")
  if (coupe < 0) return modele
  return `${modele.slice(0, coupe)} · ${modele.slice(coupe + 1)}`
}

export function Fiche({
  asset,
  univers,
  plan,
  personnages,
  onFermer,
  onErreur,
  onReinjecter,
  onReglages,
  onSupprimer,
  onOuvrirLEtabli,
  onRetoucher,
  onDecouper,
  onPoserSurLaToile,
  onOuvrir,
  identite,
  directionsAConfirmer,
  onDirection,
  onVariante,
  onEcarter,
  onReference,
  estLaReference = false,
  // P1c (V3.5) : refaire ou supprimer un découpage change ce que la grille
  // montre — absent, la fiche se contente de se relire elle-même.
  onDecoupageChange,
}: {
  asset: Asset
  /** Le plan du jeu et ses personnages, pour désigner cette image comme le
   *  corps d'une case (US-122). **Il n'y a pas d'écran de création de
   *  personnage avec son propre prompt** : le corps naît dans l'atelier, et
   *  c'est ici — sur l'image obtenue — qu'on dit ce qu'il est. */
  plan: Pose[]
  personnages: Personnage[]
  /** L'univers du projet ouvert. La fiche n'y touche pas — elle le lit pour
   *  savoir sur quelle palette quantifier, et pour proposer de réaligner un
   *  asset que l'auteur avait réglé à la main (US-69). */
  univers: Univers
  onFermer: () => void
  onErreur: (raison: string) => void
  /** Renvoyer cette image au générateur, dans l'un des trois rôles qui portent
   *  une image (US-12). */
  onReinjecter: (role: Role) => void
  /** Le quatrième rôle : reprendre les réglages de la génération qui a produit
   *  cet asset. Aucune image ne part — c'est le générateur qu'on repeuple. */
  onReglages: () => void
  onSupprimer: () => void
  /** **Les deux portes de la fiche** (E4). L'établi de la chose à qui l'image
   *  appartient — grisé avec sa raison quand elle n'appartient à personne — et
   *  la retouche, qui s'ouvre sur n'importe quelle image. Le découpage n'a
   *  plus de porte à lui : c'est une fabrique de la retouche, et on ne le
   *  cherche plus. */
  /** ⚠️ **Absent quand on est déjà dans l'établi** (`C4`) : la fiche est montée
   *  dans *Ses images*, qui **est** l'établi de la chose. Un bouton qui ouvre
   *  l'écran où l'on se trouve ne mène nulle part. */
  onOuvrirLEtabli?: () => void
  onRetoucher: () => void
  /** Ouvrir la découpe sur l'image brute (18 septembre 2026). Absent là où
   *  l'écran n'en a pas la porte. */
  onDecouper?: () => void
  /** Poser cette image, telle quelle, sur la toile de l'univers — **sans
   *  nouvelle fabrication** (US-540). Absent sur les écrans qui n'ont pas de
   *  projet ouvert ou pas de toile à côté d'eux : la même règle que les deux
   *  portes ci-dessous, plutôt qu'un bouton grisé sans jeu ouvert. */
  onPoserSurLaToile?: () => void
  /** Remonter ou descendre la filiation sans quitter le panneau. */
  onOuvrir: (identifiant: string) => void
  // ── `C4` · ce que le volet d'`ImagesDuSujet` savait faire ────────────────
  //
  // **Il y avait deux volets de fiche d'image dans le produit** — celui-ci, et
  // un second écrit en clair dans `ImagesDuSujet.tsx`, même métier, deux
  // surfaces. Le second est parti ; les quatre choses qu'il savait faire et que
  // celui-ci ne savait pas sont ici, **derrière des rappels facultatifs** : sur
  // la galerie, personne ne les passe, et la fiche est exactement ce qu'elle
  // était. Sur la page d'un sujet, on sait de quelle case on parle, et elles
  // paraissent.
  /** De quoi cette image est l'image — *le pèlerin, repos, vers l'est*. Le
   *  volet d'avant l'écrivait parce qu'une rangée de cinq vignettes ne dit pas
   *  laquelle est décrite. */
  identite?: string | null
  /** Les angles que le jeu déclare pour la pose de cette image, quand elle ne
   *  dit pas d'où elle regarde. **Le seul endroit d'où l'on confirme** : c'est
   *  le seul où l'on sait de quelle case il s'agit. */
  directionsAConfirmer?: readonly { identifiant: string; nom: string }[]
  onDirection?: (direction: string) => void
  /** Redemander la même case au générateur. */
  onVariante?: () => void
  /** **Écarter est un jugement, pas un effacement.** Le geste passe par le
   *  parent, qui est le seul à porter le bandeau *la rendre*. */
  onEcarter?: () => void
  /** **En faire l'image de référence du sujet** (RP19) — le portrait montré en
   *  grand en haut de sa page. Absent partout où l'on ne sait pas de quel sujet
   *  on parle : sur la galerie, la même image n'a pas de fiche à orner.
   *
   *  Ce n'est ni promouvoir en référence permanente — ça, c'est la liste qui
   *  repart avec chaque appel —, ni retenir la case pour le jeu. Rien ne part,
   *  rien n'est payé. */
  onReference?: (faire: boolean) => void
  /** Celle-ci **est** déjà la référence : le geste se grise avec sa raison, et
   *  le geste inverse paraît à côté. */
  estLaReference?: boolean
  /** Refaire ou supprimer un découpage de planche a changé la bibliothèque —
   *  la grille qui l'a ouverte se relit. */
  onDecoupageChange?: () => void
}) {
  const [montrerBrut, setMontrerBrut] = useState(false)
  /** La génération de cette image, **lue une fois pour la fiche entière** (U8) :
   *  deux blocs la lisent — ce que l'ambiance a donné, et le texte qui a fait
   *  l'image —, et deux appels pour le même fichier auraient fait deux instants
   *  différents du même fait. */
  const generation = useGeneration(asset)
  /** Ce que le projet impose à **cette** image (US-164). Demandé au serveur —
   *  il est le seul à savoir sur quelle échelle l'image est née, et l'échelle
   *  décide de l'occupation. `null` tant qu'il n'a pas répondu. */
  const [impose, setImpose] = useState<Impose | null>(null)

  // **La recette se lit ici, elle ne se règle plus ici** (E4) : la machine qui
  // la pose vit dans `Places`, avec les cinq panneaux qu'elle sert, et les
  // tables l'emploient. La fiche n'en garde que la lecture — donc rien à tenir,
  // rien à resynchroniser, et l'asset fait foi à chaque rendu.
  const recette = asset.recette

  // Changer d'asset remet la fiche sur celui-là.
  useEffect(() => {
    setMontrerBrut(false)
  }, [asset.identifiant])

  // ── Ce que le projet a imposé à cette image ───────────────────────────────
  //
  // « Je veux lire sur la fiche le traitement que le projet lui a imposé, afin
  // de comprendre pourquoi l'image affichée ne ressemble pas à celle qui est
  // arrivée du fournisseur » (US-164).
  //
  // **Une lecture à part de l'asset, et c'est la grille qui le décide** : la
  // charge d'un asset part deux cents fois par relecture de grille, celle-ci
  // une fois par fiche ouverte. Elle se redemande aussi quand l'univers bouge,
  // parce que la phrase est « ce que le projet impose *maintenant* » : une
  // taille de pixel changée dans l'autre onglet doit se lire ici sans qu'on
  // referme la fiche.
  useEffect(() => {
    let vivant = true
    setImpose(null)
    api
      .imposeSurAsset(asset.identifiant)
      .then((recu) => vivant && setImpose(recu))
      // Un asset disparu pendant qu'on le regardait : la fiche se ferme de son
      // côté, et il n'y a rien à dire de plus ici qu'« on ne sait pas ».
      .catch(() => vivant && setImpose(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant, univers])

  return (
    <aside
      {...PANNEAU}
      /* **Aucune animation d'entrée ici** : c'est la colonne qui glisse, sur les
         220 ms du § Motion, et le volet arriverait une seconde fois par-dessus
         son propre mouvement. Une seule chose bouge à la fois. */
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-trait bg-papier-cote"
    >
      <EnTetePanneau>
        <span className="truncate">Fiche</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="ml-auto text-encre-4 transition-colors duration-120 hover:text-encre"
        >
          ✕
        </button>
      </EnTetePanneau>

      {/* **La visionneuse ne défile pas.** C'est le sujet du panneau : on règle
          un détourage en regardant ce qu'il fait, et un curseur posé six cents
          pixels sous l'image obligeait à remonter à chaque cran pour voir ce
          qu'on venait de faire. Ce qui **bouge quand on règle** reste sous les
          yeux — l'image, la bascule rendu/brut, les dimensions ; ce qui ne
          bouge pas descend dans le défilement, à commencer par le sujet de la
          génération, qu'on lit une fois. `docs/design-motifs.md` § La visionneuse. */}
      <Visionneuse
        asset={asset}
        brut={montrerBrut}
        onBrut={setMontrerBrut}
        traite={!estVide(recette)}
      />

      <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        <p className="truncate text-[11.5px] text-encre-2" title={asset.label}>
          {asset.label}
        </p>

        {/* **De quelle image on parle** (`C4`) — sans quoi la fiche décrit « une
            image » et l'on ne sait laquelle des cinq de la rangée. Écrit
            seulement là où la case est connue : sur la galerie, c'est le label
            juste au-dessus qui la nomme. */}
        {identite && (
          <p data-identite-de-l-image className="text-[11.5px] text-encre-2">
            {identite}
          </p>
        )}

        {/* ══ Zone 1 · Où elle est rangée — la seule zone où l'on décide (RG3) ══
            « Corps de » devient « Sujet », et Favori / Supprimer y viennent
            plutôt que de couper le texte descriptif en deux. */}
        <div className="flex flex-col gap-2 border-t border-trait pt-2">
          <CaseDeLAsset
            asset={asset}
            plan={plan}
            personnages={personnages}
            onErreur={onErreur}
          />

          {/* **La direction, quand l'image ne la dit pas** (`C4`, relogé du
              volet d'`ImagesDuSujet`). Le seul endroit d'où l'on confirme,
              parce que c'est le seul où l'on sait de quelle case on parle. Un
              clic la range. */}
          {asset.direction === null &&
            asset.pose &&
            directionsAConfirmer &&
            directionsAConfirmer.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-5 border border-trait-attention bg-fond-attention p-2">
                <p className="mesure text-[10.5px] text-encre-attention">
                  Sa direction est à confirmer
                </p>
                <p className="text-[11px] leading-4 text-encre-3">
                  Elle a été faite avant que le jeu ne déclare ses angles.
                  L'atelier ne la devine pas.
                </p>
                <div className="flex flex-wrap gap-1">
                  {directionsAConfirmer.map((d) => (
                    <button
                      key={d.identifiant}
                      type="button"
                      onClick={() => onDirection?.(d.identifiant)}
                      className="mesure rounded-5 border border-contour bg-carte px-2 py-0.5 text-[10.5px] text-encre-controle hover:border-encre-3"
                    >
                      {d.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

          <DecisionsDeLaFiche asset={asset} onErreur={onErreur} onSupprimer={onSupprimer} />

          {/* **Une matière détourée à tort, et ce qu'on peut y faire** (RG8). Ici et
              non en zone 3, comme « Sa direction est à confirmer » juste au-dessus :
              c'est une décision, et elle doit se voir sans ouvrir le bloc replié
              « Ce que le jeu lui a fait ». Absente de toute image saine. */}
          <MatiereDetouree asset={asset} onErreur={onErreur} />
        </div>

        {/* ══ Zone 2 · S'en resservir — l'actuel « Réinjecter », et les deux
            portes (RG3) ══ */}
        <SEnResservir
          asset={asset}
          onReinjecter={onReinjecter}
          onReglages={onReglages}
          onOuvrirLEtabli={onOuvrirLEtabli}
          onRetoucher={onRetoucher}
          onDecouper={onDecouper}
        />

        {/* ══ Zone 3 · D'où elle vient — tout ce qui se lit, replié (RG3) ══ */}
        <div className="flex flex-col gap-3 border-t border-trait pt-2">
          <PrisDeLAmbiance generation={generation} />
          <SansLeStyleDuJeu generation={generation} />
          <DecoupeALArriveeDeLaPlanche
            asset={asset}
            generation={generation}
            personnages={personnages}
            onOuvrir={onOuvrir}
          />

          {/* **Le texte avant la filiation.** On lit son texte quand on se
              demande d'où elle vient — c'est la même question que la
              filiation, en amont d'un cran, et les deux se répondent l'une à
              l'autre sur les images nées d'une planche. */}
          <LeTexteQuiLAFaite
            asset={asset}
            generation={generation}
            onOuvrir={onOuvrir}
          />

          <Descendance asset={asset} onOuvrir={onOuvrir} onErreur={onErreur} />

          {/* **Le retour en arrière du dépliage** (P1c, V3.5) : refaire le
              découpage d'une planche, voir ses découpages, en supprimer un —
              ou, sur une image qui en sort, le rappel d'une ligne vers elle. */}
          <LesDecoupagesDeLaPlanche
            asset={asset}
            onErreur={onErreur}
            onOuvrir={onOuvrir}
            onChangee={() => onDecoupageChange?.()}
          />

          <CeQueLeJeuLuiAFait impose={impose} recette={recette} univers={univers} />

          {/* ── Faire rentrer un épinglé dans le rang ──────────────────────
              « Je veux réaligner d'un geste, depuis sa fiche, un asset que
              j'avais réglé à la main » (US-69). La proposition ne paraît que
              sur un épinglé : sur les autres, elle dirait de faire ce qui est
              déjà fait. Elle ne coûte rien — aucun appel payant, aucun rendu
              recalculé avant qu'on le regarde. */}
          {asset.epingle && !univers.vide && (
            <div className="flex flex-col gap-1">
              <p className="mesure flex items-center gap-1.5 text-[10.5px] leading-4 text-encre-attention">
                <span aria-hidden className="inline-block h-px w-2 bg-encre-attention" />
                réglé à la main — un changement de palette le saute
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.realigner([asset.identifiant])
                  } catch (erreur) {
                    onErreur(
                      erreur instanceof Error ? erreur.message : "réalignement refusé",
                    )
                  }
                }}
                className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
              >
                Le remettre sur l'univers du jeu ›
              </button>
            </div>
          )}

          {/* **Le modèle et la graine, en pied de cette zone** (RG3) : ce sont
              les deux derniers faits de provenance, une fois tout le reste
              lu. **Qui a dessiné cette image** (US-123) — une ligne de
              provenance, au même titre que le coût : elle se lit, elle ne se
              règle pas — donc aucun libellé, aucun pointillé, rien à
              survoler. L'identifiant exact plutôt que le nom du catalogue :
              c'est lui qu'on redemande, et il reste vrai quand le catalogue
              est hors ligne. */}
          <p className="mesure truncate text-[10.5px] text-encre-4" title={asset.modele}>
            {nomDuModele(asset.modele)}
          </p>
          <SaGraineLocale asset={asset} generation={generation} />
        </div>

        {/* ── Le reste du pied — hors des trois zones ─────────────────────── */}
        <div className="flex flex-col gap-1 border-t border-trait pt-2">
          {/* **Réutiliser sans refabriquer** (US-540). La toile range des
              inspirations, pas des sorties de générateur : ce bouton pose donc
              l'image reçue telle quelle, en réserve, sans passer par un moteur.
              Absent quand aucun projet n'est ouvert. */}
          {onPoserSurLaToile && (
            <Bouton onClick={onPoserSurLaToile} enfants="Poser sur la toile" />
          )}
          {/* **Les deux gestes de la case** (`C4`, relogés du volet
              d'`ImagesDuSujet`). Redemander la même case, et écarter celle-ci.
              Ils n'existent que là où l'on sait de quelle case on parle. */}
          {onVariante && (
            <Bouton onClick={onVariante} enfants="En générer une variante" />
          )}
          {/* **Le portrait de la fiche** (RP19). Grisé avec sa raison sur celle
              qui l'est déjà — le produit n'offre jamais un geste qui ne ferait
              rien —, et le geste inverse paraît en dessous, de la même forme
              discrète que *L'écarter* : défaire un choix n'est pas aussi lourd
              que le faire. */}
          {onReference && (
            <>
              <Bouton
                inactif={estLaReference}
                onClick={() => onReference(true)}
                enfants="En faire l'image de référence"
              />
              {estLaReference && (
                <>
                  <Raison texte="c'est déjà l'image de référence de ce sujet" />
                  <button
                    type="button"
                    onClick={() => onReference(false)}
                    className="mesure mt-1 text-[10.5px] text-encre-controle hover:text-encre"
                  >
                    Ne plus en faire la référence
                  </button>
                </>
              )}
            </>
          )}
          {onEcarter && (
            <>
              <button
                type="button"
                onClick={onEcarter}
                className="mesure mt-1 text-[10.5px] text-echec hover:text-encre"
              >
                L'écarter
              </button>
              <p className="text-[11px] leading-4 text-encre-3">
                Écarter est un jugement, pas un effacement : le fichier reste sur
                le disque et la dépense reste au journal.
              </p>
            </>
          )}
          <a
            href={api.telechargementAsset(asset.identifiant, montrerBrut)}
            download
            className="mesure mt-1 text-[10.5px] text-signal hover:opacity-70"
          >
            PNG ↓
          </a>
        </div>
      </div>
    </aside>
  )
}

// ── Ce que le jeu lui a fait — le bloc fusionné (RG3, 20 septembre 2026) ────
//
// **« Imposé par le jeu » et « Sa recette » ne font plus qu'un**, sur la
// spécification de `docs/RG3-bloc-fusionne.md`. Les deux blocs d'avant se
// disputaient la même question — pourquoi cette image ne ressemble-t-elle
// pas à ce que le modèle a rendu ? — sans jamais dire *pourquoi* une étape
// existe ou n'existe pas : la nature du sujet, pas un réglage qu'on aurait
// oublié de poser.
//
// **Règle centrale, à ne jamais trahir** : la valeur affichée est celle que
// l'image **porte** (`recette`) ; `impose` ne sert qu'à dire la provenance et
// à détecter l'écart. Une place vide des deux côtés n'est jamais « réglée à
// la main » — c'est le défaut que cette fusion corrige : une matière n'a
// jamais eu de détourage, et l'ancien bloc l'accusait d'en avoir défait un.

/** D'où vient le détourage qui s'est appliqué, dit à l'auteur (D1).
 *
 *  Trois phrases pour trois niveaux, et **la dernière ne s'excuse pas** : « le
 *  réglage livré » est une réponse complète, pas un aveu de réglage manquant.
 *  C'est la même règle que le modèle par famille : il n'y a jamais de trou,
 *  seulement un réglage qu'on n'a pas posé. */
const VENU_DE: Record<Origine, string> = {
  famille: "ton réglage pour cette famille",
  nature: "ton réglage pour cette sorte d'image",
  produit: "le réglage livré",
}

type LigneDuBloc = { quoi: string; valeurEtRaison: string; marque: "main" | "toi" | null }

function CeQueLeJeuLuiAFait({
  impose,
  recette,
  univers,
}: {
  impose: Impose | null
  /** La recette **à l'écran**, pas celle de l'asset : un curseur qu'on vient de
   *  lâcher doit faire basculer la ligne sur « réglé à la main » tout de suite,
   *  sans attendre le retour du flux. */
  recette: Recette
  /** Le barème du projet — la seule façon de savoir si le nom d'une échelle
   *  est **connu** du jeu, ou si l'image a été fabriquée pour une nature que
   *  personne n'a ajoutée au barème (US-164, défaut mesuré le 19/09/2026). */
  univers: Univers
}) {
  // Tant que le serveur n'a pas répondu, la rubrique n'existe pas. Une rubrique
  // vide qui se remplit une demi-seconde plus tard fait sauter tout ce qui est
  // dessous — la recette entière, sur laquelle la main est déjà partie.
  if (impose === null) return null

  const pose = impose.impose

  if (pose === null)
    return (
      <Bloc
        cle="fiche.recette"
        aide="fiche.recette"
        titre="Ce que le jeu lui a fait"
        etat="on ne sait pas"
        mesure="la génération n'est plus sur le disque"
      >
        <p className="mesure text-[10.5px] leading-4 text-encre-4">
          Sa génération n'est plus sur le disque, et le produit ne devine pas :
          « rien n'est posé » serait une réponse différente, et fausse.
        </p>
      </Bloc>
    )

  // **Image entrée telle quelle** (`traiter=False` ou sans projet) : le jeu
  // n'impose rien du tout, et aucune des dix lignes n'a de cause à montrer.
  // C'est la phrase que « Sa recette » portait seule avant la fusion — elle
  // ne part pas, elle se déplace.
  if (impose.detourage === null && estVide(pose)) {
    return (
      <Bloc cle="fiche.recette" aide="fiche.recette" titre="Ce que le jeu lui a fait" etat="rien — elle est entrée telle quelle">
        <p className="mesure text-[10.5px] leading-4 text-encre-4">
          Rien n'est posé : cette image est celle qui est arrivée du
          fournisseur.
        </p>
      </Bloc>
    )
  }

  // **L'échelle nommée à la naissance n'est plus au barème du jeu** (défaut
  // mesuré le 19/09/2026, `docs/RG3-bloc-fusionne.md` § 1) : le jeu retombe
  // alors sur `silhouette=True` par défaut, et traite l'image comme un
  // personnage sans le dire nulle part. C'est la cause à corriger en premier,
  // et elle prend le pas sur tout le reste de la lecture fermée.
  const echelleNommee = impose.echelle !== ""
  const echelleConnue = echelleNommee
    ? (univers.bareme.find((e) => e.nom === impose.echelle) ?? null)
    : null
  const echelleIntrouvable = echelleNommee && echelleConnue === null
  // **Plein cadre, dit par le barème et non par le compte de passes.** Une
  // matière déclarée au barème dit `silhouette: false` ; c'est ce fait-là qui
  // décide, pas le nombre de passes imposées — qui peut être vide pour
  // d'autres raisons (aucune provenance connue, par exemple).
  const plainCadre = !echelleIntrouvable && echelleConnue !== null && !echelleConnue.silhouette

  const lignes: LigneDuBloc[] = []

  // **1 · Découpe du contour** — toujours présente, sauf quand le jeu n'impose
  // rien (branche « entrée telle quelle » ci-dessus, déjà sortie).
  if (impose.detourage) {
    const { passe, origine } = impose.detourage
    const passesImposees = pose.passes
    let valeurEtRaison: string
    if (echelleIntrouvable) {
      valeurEtRaison = `oui — « ${impose.echelle} » n'est pas au barème du jeu, il la découpe comme un personnage`
    } else if (plainCadre) {
      valeurEtRaison = `non — ${natureAvecArticle(impose.echelle)} remplit son cadre`
    } else if (passesImposees.length > 1) {
      valeurEtRaison = `${passesImposees.length} passes`
    } else {
      const durc = passe.durcissement
      valeurEtRaison =
        `${MOTEUR[passe.moteur]}` +
        (durc ? `, ${durc} px rongé${durc > 1 ? "s" : ""}` : "") +
        ` — ${VENU_DE[origine]}`
    }
    // **La règle qui corrige le défaut** : comparer les passes posées, pas
    // deviner sur une seule. Vide des deux côtés compare égal — jamais
    // « réglé à la main » sur une matière qui n'a jamais eu de détourage.
    const main = JSON.stringify(recette.passes) !== JSON.stringify(passesImposees)
    lignes.push({ quoi: "Découpe du contour", valeurEtRaison, marque: main ? "main" : null })
  }

  // **2 · Cadre resserré** — seulement quand elle dit quelque chose. Le
  // recadrage automatique n'a pas de ligne à lui : sa cause est celle de la
  // découpe, juste au-dessus.
  if (recette.recadrage && (recette.recadrage.marge > 0 || recette.recadrage.boite !== null)) {
    lignes.push({
      quoi: "Cadre resserré",
      valeurEtRaison: RESUME.recadrage(recette.recadrage),
      marque: null,
    })
  }

  // **3 · Taille des pixels** — toujours présente.
  if (pose.grille === null) {
    lignes.push({
      quoi: "Taille des pixels",
      valeurEtRaison: "aucune — ce jeu n'impose pas de taille de pixel",
      marque: recette.grille !== null ? "main" : null,
    })
  } else {
    lignes.push({
      quoi: "Taille des pixels",
      valeurEtRaison: `${pose.grille.cible} px`,
      marque: recette.grille?.cible !== pose.grille.cible ? "main" : null,
    })
  }

  // **4 · Part de la case remplie** — présente quand la grille existe.
  if (pose.grille !== null) {
    const valeurEtRaison = echelleIntrouvable
      ? `100 % — « ${impose.echelle} » n'est pas au barème du jeu, il la met plein cadre`
      : plainCadre
        ? `100 % — c'est ce que le jeu donne à ${natureAvecArticle(impose.echelle)}`
        : `${pose.grille.occupation} % — c'est ce que le jeu donne à ${natureAvecArticle(impose.echelle || "ce sujet")}`
    lignes.push({
      quoi: "Part de la case remplie",
      valeurEtRaison,
      marque: recette.grille?.occupation !== pose.grille.occupation ? "main" : null,
    })
  }

  // **5 · Façon de réduire** — présente quand la grille existe. Pas de
  // raison : c'est un réglage du jeu, pas une conséquence de la nature.
  if (pose.grille !== null) {
    lignes.push({
      quoi: "Façon de réduire",
      valeurEtRaison: NOM_DE_LA_METHODE[pose.grille.methode],
      marque: recette.grille?.methode !== pose.grille.methode ? "main" : null,
    })
  }

  // **6 · Couleurs** — toujours présente.
  {
    let valeurEtRaison: string
    let main: boolean
    if (pose.quantification === null) {
      valeurEtRaison =
        univers.style === "dessin"
          ? "toutes — ce jeu est en dessin, on ne réduit pas les couleurs"
          : pose.grille === null
            ? "toutes — sans taille de pixel, le jeu ne réduit pas les couleurs"
            : "toutes"
      main = recette.quantification !== null
    } else if (pose.quantification.palette.length === 0) {
      valeurEtRaison = `${pose.quantification.couleurs} — lues sur l'image, ce jeu n'a pas de palette`
      main =
        recette.quantification === null ||
        recette.quantification.couleurs !== pose.quantification.couleurs
    } else {
      valeurEtRaison = `${pose.quantification.palette.length} — sur la palette du jeu`
      main =
        recette.quantification === null ||
        recette.quantification.palette.join() !== pose.quantification.palette.join()
    }
    lignes.push({ quoi: "Couleurs", valeurEtRaison, marque: main ? "main" : null })
  }

  // **7 à 10 · Ce que le jeu n'impose jamais** — chacune présente uniquement
  // si elle est posée, et marquée « posé par toi » : écrire « réglé à la
  // main » sur un nettoyage de bords laisserait croire qu'il existait un
  // réglage du jeu à déranger. Valeurs reprises telles quelles de `RESUME`.
  if (recette.bords)
    lignes.push({
      quoi: "Nettoyage des bords",
      valeurEtRaison: RESUME.bords(recette.bords),
      marque: "toi",
    })
  if (recette.contours)
    lignes.push({
      quoi: "Contour ajouté",
      valeurEtRaison: RESUME.contours(recette.contours),
      marque: "toi",
    })
  if (recette.retournement)
    lignes.push({
      quoi: "Retourné",
      valeurEtRaison: RESUME.retournement(recette.retournement),
      marque: "toi",
    })
  if (recette.main)
    lignes.push({
      quoi: "Retouches au pixel",
      valeurEtRaison: RESUME.main(recette.main),
      marque: "toi",
    })

  const nombreAMain = lignes.filter((l) => l.marque === "main").length

  // **L'état fermé** — au plus trois segments. La taille et les couleurs sont
  // les deux valeurs qui font qu'une image ne ressemble pas à ce qui est
  // revenu du modèle ; la découpe ne s'y lit que quand elle dit *non*, parce
  // que c'est l'état surprenant ; le compte des reprises à la main passe
  // devant les couleurs si les trois segments ne tiennent pas.
  const decoupeNon = plainCadre ? "sans découpe" : null
  const tailleFermee = pose.grille ? `${pose.grille.cible} px` : null
  const couleursFermees = pose.quantification
    ? pose.quantification.palette.length > 0
      ? `${pose.quantification.palette.length} couleurs`
      : `${pose.quantification.couleurs} couleurs`
    : "toutes les couleurs"
  const aMainFerme = nombreAMain > 0 ? `${nombreAMain} à la main` : null

  let etatFerme: string
  if (echelleIntrouvable) {
    etatFerme = `« ${impose.echelle} » n'est pas au barème`
  } else {
    const base = [decoupeNon, tailleFermee].filter((s): s is string => s !== null)
    const reste = [couleursFermees, aMainFerme].filter((s): s is string => s !== null)
    etatFerme =
      base.length + reste.length <= 3
        ? [...base, ...reste].join(" · ")
        : [...base, aMainFerme ?? couleursFermees].join(" · ")
  }

  return (
    <Bloc
      cle="fiche.recette"
      aide="fiche.recette"
      titre="Ce que le jeu lui a fait"
      etat={etatFerme}
      mesure={
        nombreAMain > 0
          ? `${nombreAMain} réglé${nombreAMain > 1 ? "s" : ""} à la main`
          : "tout est appliqué"
      }
    >
      <ul className="flex flex-col gap-[3px]">
        {lignes.map((ligne) => (
          <li key={ligne.quoi} className="flex items-baseline gap-2">
            <span className="text-[11px] text-encre-2">{ligne.quoi}</span>
            <span className="mesure ml-auto text-right text-[10.5px] text-encre">
              {ligne.valeurEtRaison}
            </span>
            <span
              className={[
                "mesure w-24 shrink-0 text-right text-[10.5px]",
                ligne.marque === "main" ? "text-encre-attention" : "text-encre-4",
              ].join(" ")}
            >
              {ligne.marque === "main"
                ? "réglé à la main"
                : ligne.marque === "toi"
                  ? "posé par toi"
                  : ""}
            </span>
          </li>
        ))}
      </ul>
      {/* **Le pied du bloc.** La spécification prévoit un lien vers les
          règles du jeu, et un second vers le barème quand une nature manque.
          Ni l'un ni l'autre n'a de porte de navigation depuis la fiche —
          `App.tsx` la porterait, et il est hors de cette tranche. Le texte
          reste donc en lecture, sans lien cliquable ; à brancher le jour où
          la fiche reçoit un `onNaviguer`. */}
      <p className="mesure text-[10.5px] text-encre-controle">
        {echelleIntrouvable
          ? `Ajouter « ${impose.echelle} » au barème de l'écran Univers`
          : "Ces règles se changent dans Réglages"}
      </p>
    </Bloc>
  )
}

// ── Ce que le lot de style a donné à cette image ────────────────────────────

/** Une ligne de provenance de plus, et elle ne se lit que sur les images qui en
 *  ont une (E14).
 *
 *  Un **lot de style** est un jeu de textes, d'images et de couleurs désigné sur
 *  une chose du monde — la forge d'un nain, les ruines d'un donjon. Ce qu'on lui
 *  prend se décide au moment de fabriquer, et pas une fois pour toutes.
 *
 *  **Sans cette ligne, relire une vieille image ne dirait plus d'où venait ce
 *  qu'elle montre.** Le réglage de la chose aura changé, le lot aura été
 *  retouché, et le texte enregistré porte les mots sans dire lequel venait du
 *  monde et lequel du lot. Elle se lit, elle ne se règle pas — comme le nom du
 *  modèle juste au-dessus : aucun libellé, aucun pointillé, rien à survoler.
 *
 *  La génération est allée la chercher, et non l'image : recopier deux champs de
 *  plus sur chaque image aurait fait une seconde vérité sur une question à
 *  laquelle l'enregistrement de l'appel répond déjà. La fiche fait déjà cet
 *  aller-retour-là pour la filiation, et une fiche s'ouvre une à la fois. */
/** La génération d'une image, lue **une fois pour la fiche entière** (U8).
 *
 *  Deux blocs la lisent — ce que l'ambiance a donné, et le texte qui a fait
 *  l'image —, et deux appels pour le même fichier auraient fait deux instants
 *  différents du même fait. Elle est donc lue en haut et descendue en
 *  paramètre, comme le tableau descend ses cartes.
 *
 *  **Le silence, et pas un message**, quand elle a disparu : une génération
 *  effacée du disque est le cas normal d'une vieille image ; s'en plaindre à
 *  chaque fiche ouverte apprendrait moins que de ne rien dire. */
function useGeneration(asset: Asset): Generation | null {
  const [generation, setGeneration] = useState<Generation | null>(null)

  useEffect(() => {
    let vivant = true
    setGeneration(null)
    api
      .generation(asset.generation)
      .then((lue) => vivant && setGeneration(lue))
      .catch(() => vivant && setGeneration(null))
    return () => {
      vivant = false
    }
  }, [asset.generation])

  return generation
}

/**
 * **Cette image est partie sans le style du jeu** (F6), et voici combien
 * d'images ne l'ont pas accompagnée.
 *
 * **Elle répare un trou que la tranche creuse elle-même.** Le modèle
 * d'exploration de l'agent est devenu gratuit, et un modèle gratuit n'accepte
 * aucune image d'entrée : ce que le jeu ajoute de lui-même — ses artworks, les
 * concept arts de la chose, les images de son ambiance — ne part donc pas. À
 * multiplier les brouillons, on se retrouve des semaines plus tard avec des
 * images qui ne ressemblent pas aux autres **sans savoir pourquoi**, et c'est
 * exactement le genre de question qu'on ne pose jamais deux fois : on jette
 * l'image et on recommence.
 *
 * **Elle ne paraît que quand il y a quelque chose à dire.** Aucune ligne sur
 * une image faite avec tout ce qu'il fallait, aucune sur une image d'avant F6 —
 * l'appel était alors refusé tout entier, donc le cas n'existait pas.
 *
 * **Et elle ne juge pas.** « Sans » plutôt que « privée de » : la même image
 * refaite chez un modèle qui prend des références est un geste d'un clic —
 * *reprendre les réglages*, changer de modèle —, et rien ici ne suggère qu'il
 * fallait le faire.
 */
function SansLeStyleDuJeu({ generation }: { generation: Generation | null }) {
  const laissees = generation?.hors_plafond ?? []
  if (laissees.length === 0) return null

  return (
    <p className="mesure text-[10.5px] leading-4 text-encre-4">
      partie sans le style du jeu — {laissees.length}{" "}
      {laissees.length === 1 ? "image n'a" : "images n'ont"} pas suivi, ce modèle
      n'en accepte pas
    </p>
  )
}

/**
 * **Ce que la découpe à l'arrivée a fait de cette planche** (RS9). RS7 et RS8
 * écrivent la marque sur l'emplacement de la génération dès que la planche
 * revient ; jusqu'ici, rien ne la montrait — l'auteur ne le savait qu'en
 * comptant les images sous le sujet.
 *
 * **Lue sur la génération que la fiche a déjà chargée** (`useGeneration`,
 * juste au-dessus), pas sur une route à part : `GET /generations/{id}` porte
 * déjà `emplacements[].decoupe` (RS7), et une planche ne revient qu'une fois
 * par fiche ouverte.
 *
 * **Une seule des quatre formes à la fois** — coupée avec directions, coupée
 * sans direction, refusée, ou en cours — jamais deux à l'écran : c'est
 * exactement ce que le serveur a tranché pour cette planche-là.
 *
 * Absente sur une vue découpée (`asset.parent` posé) : son propre emplacement
 * ne porte pas de marque, seule la planche d'où elle sort en porte une.
 */
function DecoupeALArriveeDeLaPlanche({
  asset,
  generation,
  personnages,
  onOuvrir,
}: {
  asset: Asset
  generation: Generation | null
  personnages: Personnage[]
  onOuvrir: (identifiant: string) => void
}) {
  const decoupe = generation?.emplacements.find((e) => e.rang === asset.rang)?.decoupe
  if (!decoupe) return null

  if ("en_cours" in decoupe)
    return <p className="mesure text-[10.5px] leading-4 text-encre-4">Découpe en cours…</p>

  if ("raison" in decoupe)
    return (
      <p className="mesure text-[10.5px] leading-4 text-encre-4">
        Pas découpée : {decoupe.raison}
      </p>
    )

  // **Le sujet visé par cet appel** (RS6, RS7) — celui dont les morceaux
  // reçoivent la recette et la direction. C'est la source la plus simple : la
  // génération le porte déjà, il n'y a pas à le redéduire d'un morceau.
  const sujet = personnages.find((p) => p.identifiant === generation?.personnage) ?? null
  const nomsDeDirection = new Map(
    (sujet?.cases.flatMap((c) => c.directions) ?? []).map(
      (d) => [d.identifiant, d.nom] as const,
    ),
  )
  const compte = decoupe.morceaux.length

  const phrase = decoupe.directions
    ? `Découpée en ${compte} : ${decoupe.directions
        .map((d) => nomsDeDirection.get(d) ?? d)
        .join(", ")}`
    : `Découpée en ${compte}, sans direction — ${
        decoupe.sans_direction ?? "l'ordre des vues ne convient pas"
      }`

  return (
    <div className="flex flex-col gap-1.5">
      <p className="mesure text-[10.5px] leading-4 text-encre-2">
        {phrase}
        {sujet?.recette && ` · recette ${sujet.recette}`}
      </p>
      <div className="flex flex-wrap gap-1">
        {decoupe.morceaux.map((identifiant) => (
          <button
            key={identifiant}
            type="button"
            onClick={() => onOuvrir(identifiant)}
            aria-label="Ouvrir cette vue"
            className="h-[26px] w-[26px] shrink-0 overflow-hidden rounded-5 border border-contour bg-carte"
          >
            <img
              src={api.vignette(identifiant, "", 64)}
              alt="Vue découpée"
              className="h-full w-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/** **La graine d'une image locale, enfin visible** (défaut 6 de la relecture
 *  du 18/09/2026). Elle est enregistrée depuis toujours sur l'emplacement qui
 *  a produit l'image (`GET /api/generations/{id}` → `emplacements[].graine`),
 *  et aucun écran ne la montrait — la règle 8nonies s'applique telle quelle :
 *  une route qui sert quelque chose que nul écran n'affiche n'existe pas.
 *
 *  **`asset.rang` retrouve son emplacement** : c'est la même paire
 *  `<génération>-<rang>` que la grille emploie pour poser une image sur
 *  l'attente qu'elle remplace (voir `Tuile.tsx`). Rien ne paraît pour un
 *  modèle distant, qui ne tire pas sa graine de la même façon — le champ y
 *  est simplement absent.
 *
 *  **Rejouer avec la même graine n'est pas branché ici** : ce geste dépend
 *  d'un correctif serveur en cours ailleurs (`composer(graine=…)` n'est
 *  encore alimenté par aucune route). Le jour où il l'est, le bouton irait
 *  ici, à côté du nombre qu'il reprendrait. */
function SaGraineLocale({
  asset,
  generation,
}: {
  asset: Asset
  generation: Generation | null
}) {
  const emplacement = generation?.emplacements.find((e) => e.rang === asset.rang)
  const graine = (emplacement as unknown as EmplacementAvecGraine | undefined)?.graine
  if (graine === null || graine === undefined) return null
  return (
    <p className="mesure truncate text-[10.5px] text-encre-4">
      graine {graine}
    </p>
  )
}

function PrisDeLAmbiance({ generation }: { generation: Generation | null }) {
  const nom = generation?.ambiance
  if (!nom) return null

  // Les trois mots du produit, écrits comme on les lit ailleurs. Une liste vide
  // est un fait : le lot était désigné, et cet appel-là ne lui a rien pris.
  const dit: Record<string, string> = {
    textes: "ses textes",
    references: "ses images",
    couleurs: "ses couleurs",
  }
  const pris = (generation?.pris ?? []).map((quoi) => dit[quoi] ?? quoi)

  return (
    <p className="mesure text-[10.5px] leading-4 text-encre-4">
      d'après « {nom} » — {pris.length ? pris.join(", ") : "rien de repris"}
    </p>
  )
}

// ── Le texte qui a fait cette image (U8) ────────────────────────────────────

/**
 * Le prompt d'origine, **entier**, replié par défaut, dépliable et copiable.
 *
 * **Il était enregistré depuis toujours, et affiché nulle part.** La fiche ne
 * montrait que le titre — les cinquante-six premiers caractères — et le seul
 * moyen de lire le reste était *reprendre les réglages*, qui change d'onglet et
 * remplit le champ de génération : c'est-à-dire qui fait tout autre chose que
 * lire.
 *
 * **C'est le texte tel qu'il est parti**, avec ce que le jeu et l'ambiance y
 * avaient ajouté, et non le seul sujet écrit dans le champ. Depuis E14 le champ
 * ne porte plus que le sujet, et une vieille image doit dire ce qui l'a faite,
 * pas ce qu'on taperait aujourd'hui. Le fichier de la génération porte le texte
 * complet ; il n'y a rien à recomposer.
 *
 * **Une image sans texte à elle nomme sa parente et ne montre pas son texte**
 * (`US-352`, tranché au cadrage du 1ᵉʳ septembre 2026). Une découpe de planche,
 * un calque rendu : on va le lire là où il a été écrit. Montrer le texte de la
 * planche sur l'un de ses huit morceaux aurait affiché sur une image un texte
 * qui en décrit huit.
 */
function LeTexteQuiLAFaite({
  asset,
  generation,
  onOuvrir,
}: {
  asset: Asset
  generation: Generation | null
  onOuvrir: (identifiant: string) => void
}) {
  const [copie, setCopie] = useState(false)
  const parti = generation?.demande.prompt?.trim() ?? ""

  // **Née d'une autre image** : sa parente porte le texte, pas elle.
  if (asset.parent)
    return (
      <Bloc
        cle="fiche.prompt"
        titre="Son texte"
        etat="vient d'une autre image"
        mesure="le texte est sur sa parente"
      >
        <p className="text-[11px] leading-snug text-encre-2">
          Cette image est née d'une autre — une planche découpée, un calque posé.
          Le texte qui l'a fabriquée est écrit là-bas, sur l'image dont elle
          descend.{" "}
          <button
            type="button"
            onClick={() => onOuvrir(asset.parent!)}
            className="mesure text-[10.5px] text-signal underline-offset-2 hover:underline"
          >
            aller la lire ›
          </button>
        </p>
      </Bloc>
    )

  // **Entrée par import, prélevée d'un clip, ou génération disparue** : il n'y
  // a pas de texte, et le dire vaut mieux qu'un blanc dont on ne sait pas s'il
  // charge encore. Les trois cas ne se ressemblent pas — le dernier est une
  // perte, les deux premiers sont l'état ordinaire d'une image qui n'a pas été
  // décrite.
  if (!parti)
    return (
      <Bloc cle="fiche.prompt" titre="Son texte" etat="aucun texte">
        <p className="text-[11px] leading-snug text-encre-2">
          {asset.modele === "import"
            ? "Cette image est entrée par import : personne ne l'a décrite ici."
            : asset.modele === "clip"
              ? "Cette image a été prélevée d'un clip : c'est le clip qui a été "
                + "décrit, et c'est lui qui a été payé."
              : "Le texte de cette image n'est plus sur le disque — sa génération a été effacée."}
        </p>
      </Bloc>
    )

  return (
    <Bloc
      cle="fiche.prompt"
      titre="Son texte"
      /* Replié, il porte son début : c'est ce qui permet de reconnaître une
         image dans une fiche sans rien ouvrir. Ouvert, il porte sa longueur —
         un texte de mille signes ne se lit pas comme un texte de trente. */
      etat={parti}
      mesure={`${parti.length} signes`}
    >
      <div className="flex flex-col gap-1.5">
        {/* **Il défile dedans, il ne pousse pas la fiche.** Un prompt de bible
            repliée fait plusieurs milliers de signes ; le laisser s'étaler
            enverrait tout ce qui suit — la recette, le réalignement — hors de
            portée du défilement, pour un texte qu'on lit une fois. */}
        <p
          data-prompt-parti
          className="defile max-h-[300px] overflow-y-auto rounded-5 border border-trait bg-carte p-2 text-[11px] leading-snug whitespace-pre-wrap text-encre-2"
        >
          {parti}
        </p>
        {/* **Copier, et rien d'autre.** *Reprendre les réglages* existe déjà
            deux blocs plus haut et fait autre chose : il change d'onglet et
            remplit le champ qui paie. Ici on lit, et on emporte le texte. */}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(parti)
              .then(() => setCopie(true))
              .catch(() => setCopie(false))
          }}
          className="mesure self-start text-[10.5px] text-signal hover:opacity-70"
        >
          {copie ? "copié" : "copier le texte"}
        </button>
      </div>
    </Bloc>
  )
}

// ── Le jugement — favori, supprimer (RG3, zone « Où elle est rangée ») ──────

/**
 * Ce qu'on décide de cette image, une fois qu'on l'a regardée.
 *
 * « Juger, c'est marquer favori ou supprimer » — jamais accepter (US-25, US-26,
 * US-27). **Déplacé dans la zone des décisions par RG3** : favori et supprimer
 * vivaient au milieu du texte descriptif de la fiche, entre la provenance et
 * la case du personnage — deux endroits pour décider, coupés par tout ce qui
 * ne fait que se lire.
 */
function DecisionsDeLaFiche({
  asset,
  onErreur,
  onSupprimer,
}: {
  asset: Asset
  onErreur: (raison: string) => void
  onSupprimer: () => void
}) {
  const basculerFavori = async () => {
    try {
      await api.favori([asset.identifiant], !asset.favori)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "favori refusé")
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={basculerFavori}
        className={[
          "mesure h-[26px] rounded-7 border px-2 text-[11px] transition-colors duration-120",
          asset.favori
            ? "border-signal bg-ligne-ouverte text-signal"
            : "border-contour bg-carte text-encre-3 hover:bg-papier-cote",
        ].join(" ")}
      >
        Favori
      </button>
      {/* **Le prix, ou le mot « gratuit »** — et ce qu'il a consommé
          derrière, avec son unité (F2). La fiche est le seul des deux
          endroits qui ait la place des deux : la tuile ne porte que le
          premier. */}
      <span className="mesure text-[10.5px] text-encre-4">
        {depense(asset.consomme, asset.unite)}
        {!estArgent(asset.unite) && asset.consomme > 0 && (
          <span className="text-encre-4">
            {" "}
            · {quantite(asset.consomme, asset.unite)}
          </span>
        )}
      </span>
      {/* **`Découper` a quitté cette rangée** (E3). Le geste était là parce
          qu'une planche est une image comme une autre et que rien ne permet
          de deviner qu'elle en contient huit — l'argument tient toujours, et
          c'est pourquoi le découpage est devenu une **fabrique de la barre
          des tables** : il y est pour toute image, toujours, sans qu'on ait à
          le chercher. Une porte de moins ici, pas un geste de moins. */}
      <button
        type="button"
        onClick={onSupprimer}
        className="mesure ml-auto h-[26px] px-1 text-[10.5px] text-encre-4 hover:text-echec"
      >
        Supprimer
      </button>
    </div>
    <RangerEnMatiere asset={asset} onErreur={onErreur} />
    </div>
  )
}

/**
 * **Une image ordinaire devient une matière en un geste** (RG6) : la marque se
 * pose — ou se retire — sur l'image elle-même, sans qu'un sujet n'entre ni ne
 * sorte de rien. Une matière paraît ensuite dans « Mes matières », à l'écran
 * des tuiles, et se pose dans un jeu.
 *
 * - *Hors projet* (`projet` nul) : le geste n'est pas proposé — une image qui
 *   n'est dans aucun jeu n'a pas de bibliothèque où entrer.
 * - *Déjà marquée* : « Retirer des matières », toujours ouvert (le serveur ne
 *   refuse jamais ce sens-là).
 * - *Rangée dans un sujet* : le geste se grise et **dit pourquoi**, comme
 *   partout ailleurs (`Raison`). Le serveur refuse pareil, avec une phrase plus
 *   longue qui dit aussi l'autre chemin ; ici on n'attend pas le refus.
 *
 * Le libellé suit la marque tout de suite (`pose`), sans attendre le flux : il
 * rend la main à l'asset dès que celui-ci a changé.
 */
function RangerEnMatiere({
  asset,
  onErreur,
}: {
  asset: Asset
  onErreur: (raison: string) => void
}) {
  const [pose, setPose] = useState<boolean | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    setPose(null)
  }, [asset.identifiant, asset.matiere])

  if (!asset.projet) return null
  const projet = asset.projet
  const matiere = pose ?? asset.matiere
  const dansUnSujet = !matiere && !!asset.personnage

  const changer = async () => {
    const valeur = !matiere
    setOccupe(true)
    try {
      await matieres.declarer(projet, asset.identifiant, valeur)
      setPose(valeur)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "matière refusée")
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={changer}
        disabled={occupe || dansUnSujet}
        title={
          matiere
            ? "Elle n'apparaîtra plus dans « Mes matières », à l'écran des tuiles."
            : "Elle apparaîtra dans « Mes matières », à l'écran des tuiles."
        }
        className="mesure h-[26px] self-start rounded-7 border border-contour bg-carte px-2 text-[11px] text-encre-3 transition-colors duration-120 hover:bg-papier-cote disabled:text-eteint disabled:hover:bg-carte"
      >
        {matiere ? "Retirer des matières" : "Ranger dans les matières"}
      </button>
      {dansUnSujet && (
        <Raison texte="Cette image est rangée dans un sujet : sors-la de son sujet d'abord." />
      )}
    </div>
  )
}

/**
 * **Une matière née détourée** (RG8) : avant le 19 septembre 2026, le barème d'un jeu
 * ne connaissait pas « matière », et chaque matière naissait découpée et recadrée comme
 * un personnage. Le correctif empêche que cela recommence ; il ne répare pas ce qui est
 * déjà né. Cette fiche le dit — seulement quand c'est vrai — et propose de le réparer.
 *
 * - *Son image d'origine est là* (`refaisable`) : un seul bouton remet la recette que
 *   le jeu donne à une matière, à partir de cette image. Rien n'est regénéré, rien ne
 *   coûte. **L'image actuelle est remplacée** : le produit ne garde pas d'historique des
 *   rendus, et la phrase le dit au lieu de le laisser croire.
 * - *Elle n'y est plus* : la phrase dit qu'il faut regénérer, et il n'y a pas de bouton.
 *
 * **Le bouton ne part jamais tout seul** : ni à l'ouverture de la fiche, ni à celle du
 * jeu. C'est l'image de l'auteur ; il clique, ou il ne clique pas.
 *
 * L'état se lit à part de l'asset (`matieres.lire`) — c'est le même calcul que la
 * bibliothèque et que l'agent —, et se relit quand la recette de l'image change : après
 * le geste, la fiche se tait d'elle-même.
 */
function MatiereDetouree({
  asset,
  onErreur,
}: {
  asset: Asset
  onErreur: (raison: string) => void
}) {
  // L'état porte l'identifiant de l'image qu'il décrit : en changeant de fiche, celui de
  // la précédente ne s'affiche pas une demi-seconde sur la suivante.
  const [etat, setEtat] = useState<{ pour: string; detouree: boolean; refaisable: boolean } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const projet = asset.projet
  const estMatiere = asset.matiere && !!projet

  useEffect(() => {
    if (!estMatiere || !projet) {
      setEtat(null)
      return
    }
    let vivant = true
    matieres
      .lire(projet, asset.identifiant)
      .then((m) => vivant && setEtat({ pour: asset.identifiant, detouree: m.detouree, refaisable: m.refaisable }))
      // Une matière qu'on ne sait pas relire ne se dit pas détourée : mieux vaut se taire.
      .catch(() => vivant && setEtat(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant, asset.matiere, asset.projet, asset.empreinte, estMatiere, projet])

  if (!estMatiere || !projet || !etat?.detouree || etat.pour !== asset.identifiant) return null

  const refaire = async () => {
    setOccupe(true)
    try {
      const refaite = await matieres.refaire(projet, asset.identifiant)
      setEtat({ pour: asset.identifiant, detouree: refaite.detouree, refaisable: refaite.refaisable })
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "refaire la matière a été refusé")
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div
      data-matiere-detouree
      className="flex flex-col gap-1.5 rounded-5 border border-trait-attention bg-fond-attention p-2"
    >
      <p className="mesure text-[10.5px] text-encre-attention">Détourée comme un personnage</p>
      <p className="text-[11px] leading-4 text-encre-3">
        Une matière doit remplir tout son cadre, et celle-ci a été découpée et recadrée.
      </p>
      {etat.refaisable ? (
        <>
          <p className="text-[11px] leading-4 text-encre-3">
            Son image d'origine est là : on la refait sans rien regénérer, et sans
            rien payer. L'image actuelle est remplacée ; l'image d'origine n'est pas
            touchée.
          </p>
          <button
            type="button"
            onClick={refaire}
            disabled={occupe}
            className="mesure h-[26px] self-start rounded-7 border border-contour bg-carte px-2 text-[11px] text-encre-controle transition-colors duration-120 hover:bg-papier-cote disabled:text-eteint disabled:hover:bg-carte"
          >
            La refaire comme une matière
          </button>
        </>
      ) : (
        <p className="text-[11px] leading-4 text-encre-3">
          Son image d'origine n'est plus sur le disque : il faut la regénérer.
        </p>
      )}
    </div>
  )
}

// ── S'en resservir — l'actuel « Réinjecter », et les deux portes ───────────

/**
 * Repartir de cette image, de quatre façons (US-12), et les deux portes qui
 * ouvrent sur ce qu'on lui fait ensuite.
 *
 * **Renommé par RG3** : « Réinjecter » ne disait pas ce que ça fait. Les
 * quatre boutons portent maintenant leur propre geste — *référence*, *image
 * à retoucher*, *guide de style*, *reprendre ses réglages* (les trois
 * premiers mots viennent de la maquette : voir `LIBELLE_DU_ROLE` plus bas) —
 * et les deux portes de la fiche (l'établi de la chose à qui
 * l'image appartient, la retouche) descendent dans cette même zone : ce sont
 * les deux gestes qui font quelque chose *avec* l'image, l'un en fabriquant
 * une nouvelle, l'autre en reprenant celle-ci.
 */
// **Un bouton dit ce qu'il fait, il ne fait pas parler l'image** (corrigé le
// 20 septembre 2026). La spécification de RG3 proposait « elle inspire », « elle
// est le point de départ », « elle donne la manière » : trois phrases qui prêtent
// une intention à une texture, là où la consigne d'écriture du dépôt demande le
// mot concret. Ce sont ceux de la maquette validée, et « référence » est déjà le
// nom que l'atelier emploie dans le bloc « Ce qui part ».
const LIBELLE_DU_ROLE: Record<Role, string> = {
  reference: "référence",
  edition: "image à retoucher",
  style: "guide de style",
}

function SEnResservir({
  asset,
  onReinjecter,
  onReglages,
  onOuvrirLEtabli,
  onRetoucher,
  onDecouper,
}: {
  asset: Asset
  onReinjecter: (role: Role) => void
  onReglages: () => void
  onOuvrirLEtabli?: () => void
  onRetoucher: () => void
  onDecouper?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-trait pt-2">
      <Libelle aide="fiche.reinjecter">S'en resservir</Libelle>
      <p className="text-[11px] leading-4 text-encre-3">
        Repartir de cette image pour en fabriquer une autre, de quatre façons.
      </p>
      <div className="flex flex-wrap gap-1">
        {ROLES.map(({ role, libelle }) => (
          <button
            key={role}
            type="button"
            onClick={() => onReinjecter(role)}
            title={libelle}
            className="mesure h-[26px] rounded-7 border border-contour bg-carte px-2 text-[11px] text-encre-3 hover:bg-papier-cote"
          >
            {LIBELLE_DU_ROLE[role]}
          </button>
        ))}
        {/* Le quatrième rôle n'envoie aucune image : il reprend les réglages
            de la génération qui a produit cet asset. */}
        <button
          type="button"
          onClick={onReglages}
          title="reprendre prompt, modèle et réglages"
          className="mesure h-[26px] rounded-7 border border-contour bg-carte px-2 text-[11px] text-encre-3 hover:bg-papier-cote"
        >
          reprendre ses réglages
        </button>
      </div>

      {/* ── Les deux portes ────────────────────────────────────────────
          « La fiche d'une image dit ce que l'image est et porte deux portes :
          l'établi de la chose à qui elle appartient, et les tables. » Une
          image qui n'appartient à personne n'a que la seconde — et le grisé
          de la première porte sa raison, comme partout ailleurs. */}
      <div className="mt-1.5 flex flex-col gap-1">
        {onOuvrirLEtabli && (
          <Bouton
            inactif={!asset.personnage}
            onClick={onOuvrirLEtabli}
            enfants="Reprendre dans l'établi"
          />
        )}
        {onOuvrirLEtabli && !asset.personnage && (
          <Raison
            texte="cette image n'appartient à aucun sujet du jeu — la rattacher plus haut lui ouvre son établi"
          />
        )}
        {/* **Le bouton nomme ce qu'il ouvre** (`B25`) : il disait *Ouvrir les
            tables* et ouvre la retouche depuis que les six portes n'en font
            qu'une. *La retoucher* est le mot que le produit emploie déjà
            partout ailleurs — *Ses images*, le comparateur —, et deux noms
            pour un seul écran se lisent comme deux écrans. */}
        <Bouton onClick={onRetoucher} enfants="La retoucher" />
        {onDecouper && <Bouton onClick={onDecouper} enfants="Découper" />}
      </div>
    </div>
  )
}

// ── La case que cette image remplit ─────────────────────────────────────────

/**
 * Désigner cette image comme le corps d'une attitude (US-122).
 *
 * **C'est ici, et nulle part ailleurs, qu'un corps devient un corps.** Il n'y a
 * pas d'écran de création de personnage avec son propre prompt : on écrit un
 * sujet dans l'atelier, on génère, on obtient une image, et c'est cette
 * image-là qu'on désigne. Le geste ne fabrique rien et ne coûte rien.
 *
 * **Deux listes, jamais une seule** : l'attitude appartient au personnage
 * choisi, et proposer les attitudes de tout le projet ferait désigner une case
 * qui n'existe pas. Un projet sans personnage ne montre donc pas deux listes
 * vides — il dit ce qu'il faut faire d'abord.
 */
function CaseDeLAsset({
  asset,
  plan,
  personnages,
  onErreur,
}: {
  asset: Asset
  plan: Pose[]
  personnages: Personnage[]
  onErreur: (raison: string) => void
}) {
  const porteur = personnages.find((p) => p.identifiant === asset.personnage) ?? null
  const tenues = porteur ? posesTenues(plan, porteur) : []
  // **Les directions que ce sujet tient** (RS8) — l'union de celles de ses
  // cases, chacune une fois. Une image au sujet sans pose (une vue découpée
  // d'une planche) se corrige ici : son angle est tout ce qui la range.
  const directions = porteur
    ? [
        ...new Map(
          porteur.cases.flatMap((c) => c.directions).map((d) => [d.identifiant, d] as const),
        ).values(),
      ]
    : []

  const designer = async (
    personnage: string | null,
    pose: string | null,
    direction?: string | null,
  ) => {
    try {
      await api.designer(asset.identifiant, personnage, pose, direction)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "désignation refusée")
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Libelle aide="fiche.personnage">Sujet</Libelle>

      {personnages.length === 0 ? (
        <p className="mesure text-[10.5px] leading-4 text-encre-4">
          Aucun personnage dans ce jeu. Une image devient un corps quand un
          personnage l'attend — l'écran Personnages en crée un.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            aria-label="Personnage de cette image"
            value={asset.personnage ?? ""}
            onChange={(e) => {
              const choisi = e.target.value
              if (!choisi) return void designer(null, null)
              // **Rattachée au sujet, sans case encore** (`AU20`) : la pose se
              // choisit juste à côté, si on le veut.
              void designer(choisi, null)
            }}
            className="mesure h-[26px] min-w-0 flex-1 rounded-5 border border-contour bg-carte px-1 text-[11px] text-encre-2"
          >
            <option value="">aucun</option>
            {personnages.map((p) => (
              <option key={p.identifiant} value={p.identifiant}>
                {p.nom}
              </option>
            ))}
          </select>

          <select
            aria-label="Attitude de cette image"
            value={asset.pose ?? ""}
            disabled={!porteur || tenues.length === 0}
            onChange={(e) =>
              void designer(asset.personnage ?? null, e.target.value || null)
            }
            className="mesure h-[26px] w-[128px] shrink-0 rounded-5 border border-contour bg-carte px-1 text-[11px] text-encre-2 disabled:text-eteint"
          >
            <option value="">{porteur ? "sans pose" : "—"}</option>
            {tenues.map((pose) => (
              <option key={pose.identifiant} value={pose.identifiant}>
                {pose.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* **La case Pose dit pourquoi elle est vide** (RG3) — plutôt que de se
          griser sans un mot. Une matière, une tuile : ce ne sont pas des
          attitudes qu'on a oublié de fabriquer, c'est une sorte de sujet qui
          n'en réclame aucune. */}
      {porteur && tenues.length === 0 && (
        <Raison
          texte={
            porteur.type
              ? `${natureAvecArticle(porteur.type)} n'a pas de pose`
              : "ce sujet n'a pas de pose"
          }
        />
      )}

      {porteur && !asset.pose && directions.length > 0 && (
        <select
          aria-label="Direction de cette image"
          value={asset.direction ?? ""}
          onChange={(e) => void designer(porteur.identifiant, null, e.target.value || null)}
          className="mesure h-[26px] min-w-0 rounded-5 border border-contour bg-carte px-1 text-[11px] text-encre-2"
        >
          <option value="">sans direction</option>
          {directions.map((d) => (
            <option key={d.identifiant} value={d.identifiant}>
              {d.nom}
            </option>
          ))}
        </select>
      )}

      {asset.personnage_supprime && (
        <p className="mesure text-[10.5px] leading-4 text-encre-4">
          personnage supprimé — l'image reste, sa case n'existe plus
        </p>
      )}
    </div>
  )
}

// ── La filiation ────────────────────────────────────────────────────────────

/**
 * D'où vient cette image, et ce qui en descend (US-38).
 *
 * **Une filiation incomplète reste une filiation.** Un parent supprimé garde son
 * identifiant et se dit supprimé (US-29) plutôt que de disparaître en emportant
 * les maillons qui restent — c'est la contrepartie directe de « jamais de
 * cascade » : si les enfants survivent, il faut qu'ils puissent dire à quoi.
 *
 * Le bloc n'existe que s'il y a quelque chose à montrer. Un asset sans parent et
 * sans descendance n'a pas de filiation manquante : il n'en a pas, et une
 * rubrique vide dirait le contraire.
 */
function Descendance({
  asset,
  onOuvrir,
  onErreur,
}: {
  asset: Asset
  onOuvrir: (identifiant: string) => void
  onErreur: (raison: string) => void
}) {
  const [filiation, setFiliation] = useState<Filiation | null>(null)

  useEffect(() => {
    let vivant = true
    api
      .filiation(asset.identifiant)
      .then((lue) => vivant && setFiliation(lue))
      .catch((erreur) =>
        onErreur(erreur instanceof Error ? erreur.message : "filiation illisible"),
      )
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant, asset.parent_supprime])

  if (!filiation) return null
  const sansParent = filiation.parent_identifiant === null
  if (sansParent && filiation.enfants.length === 0) return null

  // Ce que la filiation dit d'elle-même repliée : le nombre de maillons, pas
  // leurs noms. Un label d'asset ne tient pas dans la fente, et deux parents
  // n'existent pas — c'est la descendance qui se compte.
  const resume = [
    filiation.parent_supprime
      ? "parent supprimé"
      : filiation.parent
        ? "1 parent"
        : null,
    filiation.enfants.length > 0
      ? `${filiation.enfants.length} descendant${filiation.enfants.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="border-t border-trait pt-2">
      <Bloc cle="fiche.filiation" titre="Ouvrir les dérivés" etat={resume}>
        <div className="flex flex-col gap-1">
          {filiation.parent && (
            <button
              type="button"
              onClick={() => onOuvrir(filiation.parent!.identifiant)}
              className="mesure flex items-center gap-1.5 text-left text-[10.5px] text-signal hover:opacity-70"
            >
              <span aria-hidden>↑</span>
              <span className="truncate">{filiation.parent.label}</span>
            </button>
          )}
          {filiation.parent_supprime && (
            <p className="mesure flex items-center gap-1.5 text-[10.5px] text-encre-attention">
              <span aria-hidden className="inline-block h-px w-2 bg-encre-attention" />
              parent supprimé — {filiation.parent_identifiant}
            </p>
          )}
          {filiation.enfants.length > 0 && (
            <div className="flex flex-col gap-[2px]">
              <span className="mesure text-[10.5px] text-encre-4">
                {filiation.enfants.length} descendant
                {filiation.enfants.length > 1 ? "s" : ""}
              </span>
              {filiation.enfants.slice(0, 8).map((enfant) => (
                <button
                  key={enfant.identifiant}
                  type="button"
                  onClick={() => onOuvrir(enfant.identifiant)}
                  className="mesure flex items-center gap-1.5 text-left text-[10.5px] text-encre-2 hover:text-signal"
                >
                  <span aria-hidden>↓</span>
                  <span className="truncate">{enfant.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Bloc>
    </div>
  )
}

// ── La visionneuse ──────────────────────────────────────────────────────────

function Visionneuse({
  asset,
  brut,
  onBrut,
  traite,
}: {
  asset: Asset
  brut: boolean
  onBrut: (v: boolean) => void
  traite: boolean
  /** Une retouche partie et pas encore revenue. L'image affichée est alors
   *  celle d'avant : c'est ce que la jauge vient dire, au bord bas de la zone
   *  image, à l'endroit exact où une tuile en génération porte la sienne. */
}) {
  const dimensions = brut || !traite
    ? `${asset.largeur}×${asset.hauteur}`
    : `${asset.rendu_largeur}×${asset.rendu_hauteur}`

  // **La visionneuse fait 380 px de large, et c'est là qu'on règle un
  // détourage** : Espace y ouvre la même image en grand, et la bascule décide
  // laquelle — l'aperçu suit ce que la surface montre, il ne rouvre pas la
  // question.
  const sujet = sujetAsset(asset, brut)
  const visee = useVisee(sujet)

  return (
    <div className="flex shrink-0 flex-col gap-1.5 px-2 pt-2">
      {/* Carrée, et large comme le panneau — sauf sur un écran court, où elle
          cède au calcul plutôt qu'aux contrôles. La borne porte sur la
          **largeur** et non sur la hauteur : `aspect-ratio` cède devant
          `max-height`, le navigateur rabote la hauteur sans redéduire la
          largeur, et le damier cesse d'être carré. C'est la leçon déjà payée
          sur le cadre de l'écran Découpe.

          **Le fond dit lequel des deux on regarde** (`D3`, même règle que sur
          la tuile) : le damier du papier sur un rendu détouré — il dit
          *transparent* —, le gris neutre de `--pourtour` sur le brut et sur ce
          qui n'a subi aucune passe. Le damier de 16 px de l'ancien châssis part
          avec lui : celui du carnet fait 14 px, et il n'y en a qu'un. */}
      <div
        onPointerEnter={visee.entrer}
        onPointerLeave={visee.sortir}
        className={`relative mx-auto aspect-square w-full max-w-[46vh] rounded-5 border border-trait ${
          traite && !brut ? "damier-papier" : "bg-pourtour"
        }`}
      >
        <img
          src={sujet.src}
          alt={asset.label}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="flex items-center gap-2">
        {/* La bascule n'est là que s'il y a deux choses à comparer. Un segment
            « Brut » seul, sur une image sans recette, dirait une différence qui
            n'existe pas. */}
        {traite ? (
          <Segments
            valeurs={["rendu", "brut"] as const}
            valeur={brut ? "brut" : "rendu"}
            onChange={(quoi) => onBrut(quoi === "brut")}
          />
        ) : (
          <span className="mesure text-[10.5px] text-encre-4">brut</span>
        )}
        <span className="mesure ml-auto text-[10.5px] text-encre-4">{dimensions}</span>
      </div>
    </div>
  )
}

const estVide = (recette: Recette) =>
  recette.passes.length === 0 &&
  !recette.recadrage &&
  !recette.grille &&
  !recette.quantification &&
  !recette.bords

// **« Sa recette » ne se lit plus seule** (RG3, 20 septembre 2026) : ses huit
// places ont rejoint le bloc fusionné `CeQueLeJeuLuiAFait`, chacune devenue
// une ligne présente seulement quand elle est posée. Voir
// `docs/RG3-bloc-fusionne.md`.
