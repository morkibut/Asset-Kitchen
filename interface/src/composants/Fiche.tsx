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
// `docs/maquette-atelier.html`.

import { Fragment, useEffect, useState } from "react"
import {
  api,
  dollars,
  ROLES,
  type Asset,
  type Filiation,
  type Generation,
  type Impose,
  type Passe,
  type Personnage,
  type Pose,
  type Recette,
  type Role,
  type Univers,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import {
  Bloc,
  Bouton,
  Curseur,
  EnTetePanneau,
  Libelle,
  NomDuReglage,
  Raison,
  Segments,
} from "./chassis"
import { PANNEAU, POINTILLE, useInfobulle } from "./Infobulle"
import { posesTenues } from "./Personnages"
import { RESUME } from "./Places"

/** Le modèle qui a produit une image, tel qu'il se lit (US-123).
 *
 *  **Trois cas, et le troisième n'est pas un trou.** Une image générée nomme le
 *  modèle exact — l'identifiant du fournisseur, celui qu'on redemandera ; une
 *  image importée n'a pas de modèle et le dit ; et une image dont la génération
 *  a disparu du disque ne peut plus le savoir. Elle ne l'invente pas : « zéro
 *  n'est pas une dimension mesurée, c'est l'absence de mesure »
 *  (`docs/PIEGES.md`), et un nom de modèle deviné vaudrait pire que rien —
 *  c'est très exactement l'information à qui l'on va faire confiance. */
export const nomDuModele = (modele: string): string =>
  modele === "import" ? "importé" : modele || "modèle inconnu"

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
  onOuvrirLesTables,
  onOuvrir,
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
   *  les tables, qui s'ouvrent sur n'importe quelle image. Le découpage n'a
   *  plus de porte à lui : c'est une fabrique de la barre des tables, et on ne
   *  le cherche plus. */
  onOuvrirLEtabli: () => void
  onOuvrirLesTables: () => void
  /** Remonter ou descendre la filiation sans quitter le panneau. */
  onOuvrir: (identifiant: string) => void
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
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord bg-fond-1"
    >
      <EnTetePanneau>
        <span className="truncate">Fiche</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="ml-auto text-texte-3 transition-colors duration-[80ms] hover:text-texte"
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
        <p className="truncate text-[11.5px] text-texte-2" title={asset.label}>
          {asset.label}
        </p>

        {/* **Qui a dessiné cette image** (US-123). Une ligne de provenance, au
            même titre que le coût : elle se lit, elle ne se règle pas — donc
            aucun libellé, aucun pointillé, rien à survoler. L'identifiant
            exact plutôt que le nom du catalogue : c'est lui qu'on redemande, et
            il reste vrai quand le catalogue est hors ligne. */}
        <p className="mesure truncate text-[10px] text-texte-3" title={asset.modele}>
          {nomDuModele(asset.modele)}
        </p>

        <PrisDeLAmbiance generation={generation} />

        <Jugement
          asset={asset}
          onErreur={onErreur}
          onReinjecter={onReinjecter}
          onReglages={onReglages}
          onSupprimer={onSupprimer}
        />

        <CaseDeLAsset
          asset={asset}
          plan={plan}
          personnages={personnages}
          onErreur={onErreur}
        />

        {/* **Le texte avant la filiation, et après le jugement.** On juge une
            image en la regardant ; on lit son texte quand on se demande d'où
            elle vient — c'est la même question que la filiation, en amont d'un
            cran, et les deux se répondent l'une à l'autre sur les images nées
            d'une planche. */}
        <LeTexteQuiLAFaite
          asset={asset}
          generation={generation}
          onOuvrir={onOuvrir}
        />

        <Descendance asset={asset} onOuvrir={onOuvrir} onErreur={onErreur} />

        <ImposeParLeProjet impose={impose} recette={recette} />

        {/* **La recette se lit ici, elle ne se règle plus ici** (E4). Les cinq
            places tenaient cette colonne de 380 px, à côté d'une image de
            380 px : on y réglait un détourage en regardant une vignette. Elles
            ont un écran à leur taille depuis E3 — une table, plein cadre, avec
            l'image en grand entre la table et ses sœurs. La fiche garde ce
            qu'elle a toujours été : ce que l'image **est**. */}
        <RecetteEnLecture recette={recette} />

        {/* ── Faire rentrer un épinglé dans le rang ──────────────────────
            « Je veux réaligner d'un geste, depuis sa fiche, un asset que
            j'avais réglé à la main » (US-69). La proposition ne paraît que sur
            un épinglé : sur les autres, elle dirait de faire ce qui est déjà
            fait. Elle ne coûte rien — aucun appel payant, aucun rendu recalculé
            avant qu'on le regarde. */}
        {asset.epingle && !univers.vide && (
          <div className="mt-4 flex flex-col gap-1 border-t border-bord pt-2">
            <p className="mesure flex items-center gap-1.5 text-[10px] leading-4 text-epingle">
              <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
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
              className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
            >
              Le remettre sur l'univers du projet ›
            </button>
          </div>
        )}

        {/* ── Les deux portes ────────────────────────────────────────────
            « La fiche d'une image dit ce que l'image est et porte deux portes :
            l'établi de la chose à qui elle appartient, et les tables. » Une
            image qui n'appartient à personne n'a que la seconde — et le grisé
            de la première porte sa raison, comme partout ailleurs. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-bord pt-2">
          <Bouton
            inactif={!asset.personnage}
            onClick={onOuvrirLEtabli}
            enfants="Reprendre dans l'établi"
          />
          {!asset.personnage && (
            <Raison texte="cette image n'appartient à aucune chose du jeu — la rattacher plus haut lui ouvre son établi" />
          )}
          <Bouton onClick={onOuvrirLesTables} enfants="Ouvrir les tables" />
          <a
            href={api.telechargementAsset(asset.identifiant, montrerBrut)}
            download
            className="mesure mt-1 text-[10px] text-signal hover:text-signal-clair"
          >
            PNG ↓
          </a>
        </div>
      </div>
    </aside>
  )
}

// ── Ce que le projet a imposé ───────────────────────────────────────────────

/** Le traitement que le projet a posé sur cette image, et ce que l'auteur a
 *  changé depuis (US-164).
 *
 *  **Le défaut que cette rubrique répare est un défaut de composition**, pas de
 *  code : « la dérive de grille est le cas normal » et « le style vient de la
 *  bible et d'un seul endroit » sont justes séparément, et leur composition
 *  produisait un atelier qui imposait une apparence que l'auteur n'avait jamais
 *  posée — sans jamais lui montrer laquelle. Trois lignes suffisent à le dire,
 *  et elles se lisent avant la recette, pas dedans : c'est le *pourquoi* de ce
 *  qui suit.
 *
 *  Elle ne se règle pas — elle se lit. Un bloc quand même, et repliable comme
 *  les places de la recette : « un bloc replié ne se tait pas, il porte sa valeur »
 *  (`docs/DESIGN.md`), et une ligne d'état suffit alors à dire ce que le projet
 *  a fait. Aucun pointillé sur les valeurs : ce qui se règle est juste en
 *  dessous. */
function ImposeParLeProjet({
  impose,
  recette,
}: {
  impose: Impose | null
  /** La recette **à l'écran**, pas celle de l'asset : un curseur qu'on vient de
   *  lâcher doit faire basculer la ligne sur « réglé à la main » tout de suite,
   *  sans attendre le retour du flux. */
  recette: Recette
}) {
  // Tant que le serveur n'a pas répondu, la rubrique n'existe pas. Une rubrique
  // vide qui se remplit une demi-seconde plus tard fait sauter tout ce qui est
  // dessous — la recette entière, sur laquelle la main est déjà partie.
  if (impose === null) return null

  const pose = impose.impose

  if (pose === null)
    return (
      <Bloc
        cle="fiche.impose"
        aide="fiche.impose"
        titre="Imposé par le projet"
        etat="on ne sait pas"
        mesure="la génération n'est plus sur le disque"
      >
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Sa génération n'est plus sur le disque, et le produit ne devine pas :
          « rien d'imposé » serait une réponse différente, et fausse.
        </p>
      </Bloc>
    )

  const lignes: { quoi: string; valeur: string; main: boolean }[] = []

  lignes.push(
    pose.grille === null
      ? {
          quoi: "taille de pixel",
          valeur: "aucune",
          main: recette.grille !== null,
        }
      : {
          quoi: "taille de pixel",
          valeur: `${pose.grille.cible} px`,
          main: recette.grille?.cible !== pose.grille.cible,
        },
  )

  // **L'occupation ne se lit qu'avec sa nature de sujet à côté.** « 40 % » seul
  // n'explique rien ; « 40 % · objet tenu » dit d'où vient le chiffre et où le
  // changer — dans le barème du projet, pas ici.
  if (pose.grille !== null)
    lignes.push({
      quoi: "occupation",
      valeur:
        `${pose.grille.occupation} %` +
        (impose.echelle ? ` · ${impose.echelle}` : ""),
      main: recette.grille?.occupation !== pose.grille.occupation,
    })

  lignes.push(
    pose.quantification === null
      ? {
          quoi: "palette",
          valeur: "aucune",
          main: recette.quantification !== null,
        }
      : {
          quoi: "palette",
          valeur: `${pose.quantification.palette.length} couleurs`,
          main:
            recette.quantification === null ||
            recette.quantification.palette.join() !==
              pose.quantification.palette.join(),
        },
  )

  return (
    <Bloc
      cle="fiche.impose"
      aide="fiche.impose"
      titre="Imposé par le projet"
      /* Replié, le bloc porte les trois valeurs du projet — c'est ce qui permet
         de lire la fiche entière sans rien ouvrir. Ouvert, il garde sous les
         yeux ce que la lecture décide : combien de lignes ont été reprises à la
         main. */
      etat={lignes.map((l) => l.valeur.split(" · ")[0]).join(" · ")}
      mesure={
        lignes.some((l) => l.main)
          ? `${lignes.filter((l) => l.main).length} repris à la main`
          : "tout est appliqué"
      }
    >
      <ul className="flex flex-col gap-[3px]">
        {lignes.map((ligne) => (
          <li key={ligne.quoi} className="flex items-baseline gap-2">
            <span className="text-[11px] text-texte-2">{ligne.quoi}</span>
            <span className="mesure ml-auto text-[10px] text-texte">{ligne.valeur}</span>
            {/* **Le distinguo est la moitié de la rubrique** : sans lui, une
                valeur affichée ne dit pas si elle vient du projet ou de la main
                de l'auteur, et c'est exactement la question posée. Le token
                `epingle` est celui qui porte déjà « réglé à la main » plus bas
                dans cette même fiche. */}
            <span
              className={[
                "mesure w-[76px] shrink-0 text-right text-[9.5px]",
                ligne.main ? "text-epingle" : "text-texte-3",
              ].join(" ")}
            >
              {ligne.main ? "réglé à la main" : "appliqué"}
            </span>
          </li>
        ))}
      </ul>
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
    <p className="mesure text-[10px] leading-4 text-texte-3">
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
        <p className="text-[11px] leading-snug text-texte-2">
          Cette image est née d'une autre — une planche découpée, un calque posé.
          Le texte qui l'a fabriquée est écrit là-bas, sur l'image dont elle
          descend.{" "}
          <button
            type="button"
            onClick={() => onOuvrir(asset.parent!)}
            className="mesure text-[10px] text-signal underline-offset-2 hover:underline"
          >
            aller la lire ›
          </button>
        </p>
      </Bloc>
    )

  // **Entrée par import, ou génération disparue** : il n'y a pas de texte, et
  // le dire vaut mieux qu'un blanc dont on ne sait pas s'il charge encore.
  if (!parti)
    return (
      <Bloc cle="fiche.prompt" titre="Son texte" etat="aucun texte">
        <p className="text-[11px] leading-snug text-texte-2">
          {asset.modele === "import"
            ? "Cette image est entrée par import : personne ne l'a décrite ici."
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
          className="defile max-h-[220px] overflow-y-auto rounded-[2px] border border-bord bg-fond-0 p-2 text-[11px] leading-snug whitespace-pre-wrap text-texte-2"
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
          className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
        >
          {copie ? "copié" : "copier le texte"}
        </button>
      </div>
    </Bloc>
  )
}

// ── Le jugement, et la réinjection ──────────────────────────────────────────

/**
 * Ce qu'on fait de cette image, une fois qu'on l'a regardée.
 *
 * « Juger, c'est marquer favori ou supprimer » — jamais accepter (US-25, US-26,
 * US-27). Et réinjecter, qui n'est pas un jugement mais son prolongement
 * naturel : ce qui marche repart (US-12).
 */
function Jugement({
  asset,
  onErreur,
  onReinjecter,
  onReglages,
  onSupprimer,
}: {
  asset: Asset
  onErreur: (raison: string) => void
  onReinjecter: (role: Role) => void
  onReglages: () => void
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
    <div className="flex flex-col gap-2 border-t border-bord pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={basculerFavori}
          className={[
            "mesure h-[26px] rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
            asset.favori
              ? "border-signal bg-signal/13 text-signal"
              : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
          ].join(" ")}
        >
          {asset.favori ? "◤ favori" : "favori"}
        </button>
        <span className="mesure text-[10px] text-texte-3">
          {dollars(asset.cout_usd)}
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
          className="mesure ml-auto h-[26px] px-1 text-[10px] text-texte-3 hover:text-echec"
        >
          Supprimer
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Libelle aide="fiche.reinjecter">Réinjecter</Libelle>
        <div className="flex flex-wrap gap-1">
          {ROLES.map(({ role, libelle, explique }) => (
            <button
              key={role}
              type="button"
              onClick={() => onReinjecter(role)}
              title={explique}
              className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte-2 hover:bg-fond-3"
            >
              {libelle}
            </button>
          ))}
          {/* Le quatrième rôle n'envoie aucune image : il reprend les réglages
              de la génération qui a produit cet asset. */}
          <button
            type="button"
            onClick={onReglages}
            title="reprendre prompt, modèle et réglages"
            className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte-2 hover:bg-fond-3"
          >
            jeu de réglages
          </button>
        </div>
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

  const designer = async (personnage: string | null, pose: string | null) => {
    try {
      await api.designer(asset.identifiant, personnage, pose)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "désignation refusée")
    }
  }

  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="fiche.personnage">Corps de</Libelle>

      {personnages.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
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
              // Un personnage choisi sans attitude ne désigne rien : la
              // première qu'il tient est proposée, et se change juste à côté.
              const suivant =
                personnages.find((p) => p.identifiant === choisi) ?? null
              const premiere = suivant ? posesTenues(plan, suivant)[0] : null
              if (!premiere)
                return onErreur("ce personnage ne tient aucune attitude")
              void designer(choisi, premiere.identifiant)
            }}
            className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2"
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
            disabled={!porteur}
            onChange={(e) =>
              void designer(asset.personnage ?? null, e.target.value || null)
            }
            className="mesure h-[26px] w-[120px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2 disabled:text-texte-3"
          >
            {!porteur && <option value="">—</option>}
            {tenues.map((pose) => (
              <option key={pose.identifiant} value={pose.identifiant}>
                {pose.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {asset.personnage_supprime && (
        <p className="mesure text-[10px] leading-4 text-texte-3">
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
    <div className="border-t border-bord pt-2">
      <Bloc cle="fiche.filiation" titre="Filiation" etat={resume}>
        <div className="flex flex-col gap-1">
          {filiation.parent && (
            <button
              type="button"
              onClick={() => onOuvrir(filiation.parent!.identifiant)}
              className="mesure flex items-center gap-1.5 text-left text-[10px] text-signal hover:text-signal-clair"
            >
              <span aria-hidden>↑</span>
              <span className="truncate">{filiation.parent.label}</span>
            </button>
          )}
          {filiation.parent_supprime && (
            <p className="mesure flex items-center gap-1.5 text-[10px] text-epingle">
              <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
              parent supprimé — {filiation.parent_identifiant}
            </p>
          )}
          {filiation.enfants.length > 0 && (
            <div className="flex flex-col gap-[2px]">
              <span className="mesure text-[10px] text-texte-3">
                {filiation.enfants.length} descendant
                {filiation.enfants.length > 1 ? "s" : ""}
              </span>
              {filiation.enfants.slice(0, 8).map((enfant) => (
                <button
                  key={enfant.identifiant}
                  type="button"
                  onClick={() => onOuvrir(enfant.identifiant)}
                  className="mesure flex items-center gap-1.5 text-left text-[10px] text-texte-2 hover:text-signal"
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
          sur le cadre de l'écran Découpe. */}
      <div
        onPointerEnter={visee.entrer}
        onPointerLeave={visee.sortir}
        className="damier damier-fiche relative mx-auto aspect-square w-full max-w-[46vh] border border-bord"
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
          <span className="mesure text-[10px] text-texte-3">brut</span>
        )}
        <span className="mesure ml-auto text-[10px] text-texte-3">{dimensions}</span>
      </div>
    </div>
  )
}

// ── Une passe de détourage ──────────────────────────────────────────────────

export function BlocPasse({
  rang,
  passe,
  raisonModele,
  visee,
  enVisee,
  onViser,
  onChange,
  onFini,
  onRetirer,
}: {
  rang: number
  passe: Passe
  raisonModele: string | null
  /** La couleur sous le point de cette passe, **mesurée par le serveur**, ou
   *  `null` si la passe n'est pas une pipette ou n'a pas encore été visée. */
  visee?: string | null
  /** Cette passe-ci attend son clic dans l'image. */
  enVisee?: boolean
  /** Armer — ou désarmer — la visée de cette passe. */
  onViser?: (arme: boolean) => void
  /** La valeur bouge à l'écran, rien ne part. */
  onChange: (p: Passe) => void
  /** La valeur est arrêtée : elle part. Un segment appelle celui-ci
   *  directement — un choix n'a pas d'états intermédiaires à traverser. */
  onFini: (p: Passe) => void
  onRetirer?: () => void
}) {
  const pipette = passe.moteur === "couleur"

  // ── Masquer une passe, et pourquoi toucher un réglage la remontre (U10) ───
  //
  // **C'est la règle de la veille d'une table (U4), un cran plus bas** : poser
  // une valeur *dit* qu'on veut cette passe, et bloquer le curseur parce
  // qu'elle est masquée obligerait à faire un geste préalable pour avoir le
  // droit de faire le geste qu'on voulait. On remontre plutôt que de refuser.
  //
  // **Et sans bandeau d'annonce, contrairement à la table.** L'annonce existait
  // là-bas parce que l'interrupteur d'une table vit dans une barre, loin de la
  // colonne où l'on règle : le réveil se produisait hors du regard. Ici le
  // bouton est vingt pixels au-dessus du curseur qu'on touche, et le bloc
  // entier cesse d'être grisé sous les doigts — le dire une seconde fois serait
  // dire ce qu'on voit.
  const remontrer = (p: Passe): Passe => (p.masquee ? { ...p, masquee: false } : p)
  const change = (p: Passe) => onChange(remontrer(p))
  const fini = (p: Passe) => onFini(remontrer(p))

  // **Le nom de la passe devient sa propre poignée**, comme les libellés de
  // réglage : le corpus y dit ce que masquer veut dire, et surtout ce qu'une
  // passe supplémentaire fait de celle qui la précède — la question qui a
  // ouvert cette étape se pose ici, elle doit avoir sa réponse ici.
  const { presente, ancre, declencheurs, bulle } = useInfobulle("detourage.masquee")

  return (
    <div className="flex flex-col gap-1.5 rounded-[2px] border border-bord bg-fond-2 p-2">
      <div className="flex items-center gap-2">
        <span
          ref={ancre as React.Ref<HTMLSpanElement>}
          {...declencheurs}
          className={[
            "mesure text-[9.5px] text-texte-3",
            presente ? POINTILLE : "",
            passe.masquee ? "line-through" : "",
          ].join(" ")}
        >
          passe {rang + 1}
        </span>
        {/* **Masquer n'est pas retirer, et les deux mots le disent** : l'un
            rend la passe au calcul d'un clic, l'autre la perd. Ils sont côte à
            côte parce que c'est là qu'on hésite entre les deux, et seul le
            second est de la couleur d'un échec. */}
        <button
          type="button"
          role="switch"
          aria-checked={!passe.masquee}
          aria-label={`passe ${rang + 1} — ${passe.masquee ? "masquée" : "visible"}`}
          title="la retirer du calcul le temps de regarder — elle garde ses réglages"
          onClick={() => onFini({ ...passe, masquee: !passe.masquee })}
          className="mesure ml-auto text-[10px] text-signal hover:text-signal-clair"
        >
          {passe.masquee ? "montrer" : "masquer"}
        </button>
        {onRetirer && (
          <button
            type="button"
            onClick={onRetirer}
            className="mesure text-[10px] text-texte-3 hover:text-echec"
          >
            retirer
          </button>
        )}
        {bulle}
      </div>
      {passe.masquee && (
        <Raison texte="masquée : retirée du calcul, elle garde tous ses réglages — la remontrer rend l'image d'avant" />
      )}

      {/* **Les réglages restent lisibles, et ils restent réglables** — c'est le
          grisé de la table endormie (U4), pas un verrou. Ce qu'on éteint garde
          ses réglages, et les cacher rendrait le masque impossible à défaire en
          connaissance de cause. */}
      <div
        className={["flex flex-col gap-1.5", passe.masquee ? "opacity-50" : ""].join(
          " ",
        )}
      >
        {/* **Le seul contrôle de la passe qui n'avait pas de nom.** Ses trois
            voisins en portaient un ; celui-ci se lisait sur ses deux segments,
            « bord » et « modèle », c'est-à-dire sur ses valeurs. Un contrôle qui
            n'est nommé que par ce qu'il vaut n'a nulle part où accrocher son
            explication — la même règle que les `placeholder` du menu de carte.
            La raison du grisé reste sous la rangée, sur toute la largeur : elle
            parle du modèle indisponible, pas du réglage. */}
        <Reglage libelle="moteur" aide="detourage.moteur">
          <Segments
            valeurs={["bord", "couleur", "modele"] as const}
            valeur={passe.moteur}
            onChange={(moteur) => {
              fini({ ...passe, moteur })
              // **Choisir la pipette, c'est demander à viser.** Le réglage n'a
              // aucune valeur tant qu'aucun point n'est posé ; obliger à un
              // second clic sur un bouton pour avoir le droit de faire le seul
              // geste possible serait une porte devant une porte.
              onViser?.(moteur === "couleur" && passe.point === null)
            }}
            indisponibles={raisonModele ? (["modele"] as const) : []}
            libelles={{ bord: "bord", couleur: "pipette", modele: "modèle" }}
          />
        </Reglage>
        {raisonModele && <Raison texte={raisonModele} />}

        {/* ── La pipette ────────────────────────────────────────────────────
            **La couleur ne se tape pas, elle se désigne.** Le clic dans l'image
            pose le point ; la pastille et son code disent ce qu'il y avait
            dessous. Recliquer ailleurs *remplace* le point de cette passe — sans
            quoi trois hésitations feraient trois passes, et personne ne veut
            d'une passe par clic. */}
        {pipette && (
          <>
            <Reglage libelle="couleur visée" aide="detourage.couleur">
              {passe.point && visee ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{ background: visee }}
                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-bord"
                  />
                  <span className="mesure text-[10px] text-texte-2">{visee}</span>
                  <button
                    type="button"
                    onClick={() => onViser?.(!enVisee)}
                    className="mesure ml-auto text-[10px] text-signal hover:text-signal-clair"
                  >
                    {enVisee ? "annuler" : "viser à nouveau ›"}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onViser?.(!enVisee)}
                  className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
                >
                  {enVisee ? "clique dans l'image" : "viser dans l'image ›"}
                </button>
              )}
            </Reglage>
            {/* **Une pipette non visée ne retire rien**, et le dire vaut mieux que
                de laisser croire à une passe qui ne marche pas. */}
            {!passe.point && (
              <Raison texte="tant qu'aucun point n'est posé, cette passe ne retire rien" />
            )}
            <Reglage libelle="portée" aide="detourage.portee">
              <Segments
                valeurs={["tache", "partout"] as const}
                valeur={passe.portee}
                libelles={{ tache: "cette tache", partout: "partout" }}
                onChange={(portee) => fini({ ...passe, portee })}
              />
            </Reglage>
          </>
        )}

        {/* **La tolérance sert les deux moteurs qui remplissent par plages**, et
            c'est le même écart par canal : le bord part des bordures, la pipette
            part du point, et ce qui les sépare est l'amorce, pas le seuil. */}
        {(passe.moteur === "bord" || pipette) && (
          <Reglage libelle="tolérance" aide="detourage.tolerance">
            <Curseur
              valeur={passe.tolerance}
              min={0}
              max={120}
              onChange={(tolerance) => change({ ...passe, tolerance })}
              onFini={(tolerance) => fini({ ...passe, tolerance })}
            />
          </Reglage>
        )}
        <Reglage libelle="seuil alpha" aide="detourage.seuil_alpha">
          <Curseur
            valeur={passe.seuil_alpha}
            min={1}
            max={255}
            onChange={(seuil_alpha) => change({ ...passe, seuil_alpha })}
            onFini={(seuil_alpha) => fini({ ...passe, seuil_alpha })}
          />
        </Reglage>
        <Reglage libelle="durcissement" aide="detourage.durcissement">
          <Segments
            valeurs={[0, 1, 2, 3, 4] as const}
            valeur={passe.durcissement as 0 | 1 | 2 | 3 | 4}
            onChange={(durcissement) => fini({ ...passe, durcissement })}
          />
        </Reglage>
      </div>
    </div>
  )
}

// ── Le gabarit d'un réglage ─────────────────────────────────────────────────

function Reglage({
  libelle,
  aide,
  children,
}: {
  libelle: string
  /** La cle de l'entree du corpus (`src/aide.ts`), s'il y en a une. Le libelle
   *  devient alors sa propre poignee : pointille `--bord-fort`, survol pour
   *  reveler, clic pour epingler. Sans cle, rien ne se marque. */
  aide?: string
  children: React.ReactNode
}) {
  const { presente, ancre, declencheurs, bulle } = useInfobulle(aide)
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
      <span
        ref={ancre as React.Ref<HTMLSpanElement>}
        {...declencheurs}
        className={`mesure text-[10px] text-texte-3 ${presente ? POINTILLE : ""}`}
      >
        {libelle}
      </span>
      {/* **Le nom descend jusqu'au contrôle** (U3), et le fournisseur ne rend
          aucun nœud : la grille de deux colonnes reste une grille de deux
          colonnes. */}
      <NomDuReglage.Provider value={libelle}>{children}</NomDuReglage.Provider>
      {bulle}
    </div>
  )
}


const estVide = (recette: Recette) =>
  recette.passes.length === 0 &&
  !recette.recadrage &&
  !recette.grille &&
  !recette.quantification &&
  !recette.bords


// ── La recette, en lecture ──────────────────────────────────────────────────

/**
 * Ce que l'image a subi, et rien de plus.
 *
 * **Elle se lit ici, elle se règle ailleurs** — c'est le partage de E4 : la
 * fiche dit ce que l'image *est*, les tables disent ce qu'on lui *fait*. Les
 * deux ne se disputent plus la même colonne de 380 px, et la seule qui montre
 * l'image en grand est celle où l'on règle.
 *
 * Le résumé est celui des puces de la barre des tables, écrit au même endroit —
 * `Places.RESUME`. Deux façons de résumer la même recette auraient fini par en
 * dire deux choses.
 */
function RecetteEnLecture({ recette }: { recette: Recette }) {
  const places: [string, string | null][] = [
    ["détourage", recette.passes.length ? RESUME.detourage(recette) : null],
    ["recadrage", recette.recadrage ? RESUME.recadrage(recette.recadrage) : null],
    ["grille", recette.grille ? RESUME.grille(recette.grille) : null],
    [
      "quantification",
      recette.quantification ? RESUME.quantification(recette.quantification) : null,
    ],
    ["bords", recette.bords ? RESUME.bords(recette.bords) : null],
  ]
  const posees = places.filter(([, valeur]) => valeur !== null)

  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="fiche.recette">Sa recette</Libelle>
      {posees.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Rien n'est posé : cette image est celle qui est arrivée du fournisseur.
        </p>
      ) : (
        <dl className="mesure grid grid-cols-[auto_1fr] gap-x-3 text-[10px]">
          {posees.map(([nom, valeur]) => (
            <Fragment key={nom}>
              <dt className="text-texte-3">{nom}</dt>
              <dd className="text-right text-texte-2">{valeur}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {/* **Aucune porte ici** — retiré le 31 août 2026. Cette rubrique portait
          un lien « La régler dans les tables › » qui appelait exactement la
          même fonction que le bouton « Ouvrir les tables » du pied, douze
          lignes plus bas dans le même panneau : deux noms, une seule
          destination, dans une colonne qu'on lit d'un coup d'œil. Or le pied de
          cette fiche écrit lui-même la règle — « la fiche porte **deux portes** :
          l'établi de la chose à qui elle appartient, et les tables ». Un
          troisième chemin qui double l'une des deux ne s'annonce pas comme un
          doublon : il se lit comme une nuance qu'on aurait ratée. */}
    </div>
  )
}
