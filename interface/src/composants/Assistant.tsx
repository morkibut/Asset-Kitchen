// L'assistant de démarrage — et il est aussi l'écran des réglages.
//
// **Il n'y a pas d'autre panneau de réglages à côté**, et c'est la décision :
// deux endroits qui règlent la même chose finissent toujours par se
// contredire, et c'est exactement ce qui arrivait. C'est le côté *Réglages* de
// l'onglet Univers, décrit en entier ; il s'ouvre tout seul à la création d'un
// jeu, et on le rouvre chaque fois qu'on veut changer quelque chose.
//
// **La panne qu'il répare est mesurée, sur le vrai projet.** Créer un jeu ne
// demandait qu'une chose — son nom — et l'on arrivait devant sept cases de
// texte blanches, à remplir soi-même, en anglais, sans exemple et sans ordre.
// Deux conséquences : le réglage disait *128 points de côté* pendant que le
// texte envoyé disait *64*, **trois fois** ; et le nombre de directions était
// retapé **sept fois**, sans que rien ne relie ces sept endroits.
//
// **Ce que l'assistant change : un choix unique remplit tous les endroits qui
// doivent s'accorder.** On choisit « de dessus 3/4 » une fois, et l'atelier
// écrit la phrase qui part *et* le nombre d'images par pose. Ces endroits ne
// peuvent plus diverger, parce qu'ils viennent du même geste.
//
// ── Ce que la séance d'usage du 1ᵉʳ septembre 2026 a changé ──────────────────
//
// **Dix étapes, et quatre d'entre elles n'étaient pas des étapes.** Ce fichier
// définissait `EtapeOuverte` avec sa règle en commentaire — *titrée, entière, et
// jamais repliable* — et construisait quand même quatre étapes avec le bloc
// repliable du châssis. Le repli global naissant fermé, ouvrir *Les types
// d'objets* rendait **26 points de contenu dans une scène de 1 360 × 754**, dont
// le seul mot était `Barème d'échelles`. Mesuré au navigateur ; six étapes sur
// dix employaient moins de la moitié de la place qu'on leur donnait, et quatre
// n'avaient aucun titre.
//
// Ce qui suit applique la règle aux dix, et en tire les conséquences :
//
// * **Une étape a un numéro et un titre**, en serif 24 px — le deuxième des
//   trois emplois que `docs/DESIGN.md` accorde au serif, celui des titres
//   d'écran. Une étape *est* un écran.
// * **Une étape explique avant de demander**, en 14 px — la taille que
//   l'échelle réserve à la prose longue —, et elle dit ce que le choix change
//   ailleurs, pas ce que le contrôle fait.
// * **Le pied porte le geste** : 44 px, `‹ Retour` à gauche, `Continuer →` en
//   bouton principal à droite. Le geste qu'on répète dix fois était le plus
//   petit contrôle du produit — 10 px de mono —, et il n'y avait **aucun
//   retour**. Un écran où l'on avance ou l'on abandonne est un tunnel.
// * **Une seule humeur.** L'enchaînement n'existait que sur un univers vierge et
//   se perdait au premier *j'ai fini pour l'instant* : l'auteur qui rouvrait ses
//   réglages n'avait plus rien pour avancer. Le pied est toujours là.
// * **Ce qui se montre passe devant ce qui se décrit** : les vues en cartes,
//   les tailles à leur vraie échelle, les types côte à côte. *(Les trois
//   comptes qui étaient écrits ici sont retirés : ils ont bougé trois fois
//   depuis, et ce que la ligne dit ne dépend d'aucun d'eux — `G1`.)*
//
// Le tout est dessiné dans `docs/maquettes-v2.1/06quater-assistant-pas-a-pas.html`.

import { useEffect, useState, type ReactNode } from "react"
import {
  api,
  CE_QUE_LA_METHODE_REND,
  FAMILLES,
  AUCUNE_CIBLE,
  CIBLE_DE_REFERENCE,
  NOM_CHAMP,
  NOM_FAMILLE,
  PALIERS_DE_COULEURS,
  occupationMax,
  paliersDeCouleurs,
  Refus,
  type Carte,
  type Consequences,
  type EtatTraitement,
  type Methode,
  type Tiroir,
  type Echelle,
  type EmplacementCorps,
  type Etiquette,
  type Famille,
  type FondPropose,
  type Pose,
  type PosesDesTypes,
  type TailleDImage,
  type VueDuJeu,
  type VuesEtTailles,
  type DefautDetourage,
  type Modele,
  type Moteur,
  type Passe,
  type Style,
  type Univers,
} from "../api"
import {
  Curseur,
  EnTetePanneau,
  libelleModele,
  EchantillonDeHauteur,
  Libelle,
  Raison,
  Segments,
} from "./chassis"
// **Le nom des moteurs et leur bord rongé livré vivent avec les tables**, où
// l'auteur les manipule image par image. L'étape des défauts les emprunte
// plutôt que d'en tenir une seconde liste (D1).
import { DURCISSEMENT_LIVRE, MOTEUR } from "./Places"
import { PANNEAU } from "./Infobulle"
import { TiroirDesSecrets } from "./Secrets"

/** Ce que l'auteur lit d'une cible. Zéro n'est pas « 0 px » — c'est l'absence
 *  de remise sur grille, et l'écrire en pixels serait un mensonge de mesure. */
const NOM_CIBLE: Partial<Record<string, string>> = { "0": "aucune" }
// **Les paliers de couleurs viennent de `api.ts` depuis D2**, et ils sont
// plafonnés par la taille du sprite : la liste écrite ici — 8, 12, 16, 24, 32,
// 48 — ne connaissait pas la taille et proposait donc 48 couleurs sur un sprite
// de 32 carrés, où l'image n'en contient pas tant. Voir `paliersDeCouleurs`.

/** Poser un réglage, et **dire s'il a pris**. Le booléen n'est pas de la
 *  politesse : un bloc qui tient un brouillon doit savoir revenir à la valeur
 *  d'avant quand le serveur refuse, sinon l'écran reste sur la valeur tentée —
 *  celle que le fichier du projet ne porte pas. */
type Regler = (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<boolean>

/** Les douze étapes, dans l'ordre où on les remplit, et **rangées en quatre
 *  groupes**.
 *
 *  Le groupe n'est pas de la décoration : *le jeu* dit ce qu'on fabrique, *le
 *  style* comment ça doit avoir l'air, *la production* combien d'images il
 *  faudra, *l'atelier* ce qui vaut pour tous les jeux. La dixième — la clé du
 *  fournisseur — est seule dans son groupe **parce qu'elle ne dépend d'aucun
 *  jeu**, exactement comme la base d'étiquettes.
 *
 *  **La onzième est arrivée en D1** — le détourage de départ —, et elle est
 *  dans « la production » avec les emplacements et les IA : comme eux, elle ne
 *  décide de rien de ce qui part au modèle, seulement de ce que l'atelier fait
 *  de l'image au retour. */
const ETAPES = [
  { cle: "nom", groupe: "le jeu", nom: "Le nom" },
  // **Le style graphique, arrivé en D2, et il est deuxième exprès.** C'est la
  // première question de toutes après le nom : elle décide de ce que *toutes*
  // les suivantes veulent dire — la taille devient un nombre de carrés ou une
  // finesse, les couleurs se réduisent ou non, la phrase qui part au modèle dit
  // « pixel art » ou se tait. Jusqu'ici elle n'existait pas : la réponse se
  // déduisait de la neuvième valeur d'une liste de tailles, trois étapes plus
  // loin, dont le libellé disait *ce jeu n'est pas en pixel art*.
  { cle: "style", groupe: "le jeu", nom: "Le style" },
  { cle: "vue", groupe: "le jeu", nom: "La vue" },
  // **Seule étape à porter deux noms**, et c'est le style qui dit lequel (D2).
  // Ce n'est pas un synonyme : en pixel art elle demande *combien de carrés*,
  // en dessin *combien de détail*. La colonne de gauche et le titre de l'écran
  // doivent dire le même mot — les voir se contredire à 240 px l'un de l'autre
  // ferait douter qu'on soit au bon endroit —, et le rang se retrouve par l'un
  // comme par l'autre, sans quoi l'étape perdrait sa ligne « étape 4 · le jeu ».
  { cle: "taille", groupe: "le jeu", nom: "La taille", nomDessin: "La finesse" },
  { cle: "types", groupe: "le jeu", nom: "Les types d'objets" },
  { cle: "allure", groupe: "le style", nom: "L'allure" },
  { cle: "references", groupe: "le style", nom: "Références et couleurs" },
  { cle: "poses", groupe: "la production", nom: "Poses et états" },
  { cle: "emplacements", groupe: "la production", nom: "Emplacements" },
  { cle: "modeles", groupe: "la production", nom: "Les IA à utiliser" },
  // **Le détourage de départ** (D1). Dans « la production » et pas dans « le
  // style », parce qu'il ne décide de rien de ce qui part au modèle : il décide
  // de ce que l'atelier fait de l'image **au retour**, comme les emplacements et
  // les IA à côté de lui. Il est le dernier du groupe parce qu'il est le dernier
  // dans le temps — après l'appel.
  { cle: "detourage", groupe: "la production", nom: "Le détourage de départ" },
  { cle: "cle", groupe: "l'atelier", nom: "Les fournisseurs" },
] as const

type Etape = (typeof ETAPES)[number]["cle"]

/** Le nom d'une étape **tel que le style le dit** (D2) — voir « La taille ». */
function nomDeLEtape(etape: (typeof ETAPES)[number], style: Style): string {
  return "nomDessin" in etape && style === "dessin" ? etape.nomDessin : etape.nom
}

/** Le rang d'une étape retrouvé **par n'importe lequel de ses noms** (D2).
 *
 *  L'écran ouvert ne connaît que son titre, et une étape qui change de nom avec
 *  le style ne doit pas pour autant changer de numéro : la trouver par le seul
 *  `nom` la rendait introuvable en dessin, et elle s'affichait alors sans sa
 *  ligne de repère — la seule des douze. */
function rangDuTitre(titre: string): number {
  return ETAPES.findIndex(
    (e) => e.nom === titre || ("nomDessin" in e && e.nomDessin === titre),
  )
}

/** Le rang d'une étape, **compté depuis la liste et jamais écrit à la main** (G1).
 *
 *  Sept phrases du produit citaient un numéro en dur. L'insertion de l'étape du
 *  style les a **toutes décalées d'un cran le même jour**, sans qu'une seule
 *  erreur se lève (`G1`) : elles disaient « la deuxième » d'une étape devenue
 *  la troisième, et c'est exact au caractère près — simplement faux. Un numéro qui
 *  ne se calcule pas est un numéro qui vieillit sans prévenir. */
function rangDeLEtape(cle: Etape): number {
  return ETAPES.findIndex((e) => e.cle === cle) + 1
}

/** Comment une phrase du produit **désigne** une autre étape (G1).
 *
 *  **Le nom d'abord, le rang ensuite.** C'est le nom qu'on retrouve dans la
 *  colonne de gauche — elle n'affiche que des noms —, et le rang dit à quelle
 *  distance il est. Un numéro seul demandait de compter les lignes.
 *
 *  Le nom suit le style, parce que la quatrième étape en porte deux — *La
 *  taille* en pixel art, *La finesse* en dessin — et qu'un renvoi vers un nom
 *  qu'on ne lit nulle part ne renvoie à rien. */
function laDesignation(cle: Etape, style: Style): string {
  const etape = ETAPES.find((e) => e.cle === cle)
  if (!etape) return "une autre étape"
  return `« ${nomDeLEtape(etape, style)} », l'étape ${rangDeLEtape(cle)}`
}

const GROUPES = ["le jeu", "le style", "la production", "l'atelier"] as const

/**
 * Le côté Réglages — la liste des étapes à gauche, l'étape ouverte à droite.
 *
 * **240 px, la colonne de ce qui range** (`docs/DESIGN.md` § Largeurs de
 * colonne), la même que l'arbre de la galerie et que les familles du codex.
 * Aucune largeur neuve : c'est ce que la V2.1 s'est imposé, et c'est ce que
 * cette colonne nomme déjà.
 *
 * **Ce que ça règle, mesuré.** La même matière tenait dans une bande de 380 px
 * haute de 1 843 px, dans 646 px visibles : il fallait faire défiler deux fois
 * et demie sa propre hauteur pour atteindre le dernier bloc, et la liste des
 * étapes n'existait nulle part. Une étape à la fois tient dans un écran.
 */
export function Assistant({
  onSortir,
  univers,
  modeles,
  artworks,
  traitement,
  onUnivers,
  onErreur,
  onRealigner,
  onDeposee,
}: {
  /** **Sortir de l'assistant** (E19) : on tombe dans le codex, avec le champ
   *  qui nomme allumé. Absent quand l'assistant est ouvert comme écran de
   *  réglages ordinaire — il n'y a alors nulle part d'où sortir, on y est
   *  venu exprès. */
  onSortir?: () => void
  univers: Univers
  modeles: Modele[]
  artworks: Carte[]
  /** **Ce que cette machine-ci sait faire** (D2) — les quatre façons de réduire
   *  et leur raison de grisé. L'assistant en a besoin pour ne proposer que les
   *  méthodes installées, jamais pour refuser au clic. */
  traitement: EtatTraitement
  onUnivers: (univers: Univers) => void
  onErreur: (raison: string) => void
  onRealigner: () => void
  /** Ce qu'il faut relire quand un secret vient d'être déposé — l'état, donc la
   *  barre du haut, et le catalogue, donc le grisé des modèles (F3). */
  onDeposee: () => void
}) {
  const [etape, setEtape] = useState<Etape>("nom")
  const [vues, setVues] = useState<VuesEtTailles | null>(null)
  const [etiquettes, setEtiquettes] = useState<Etiquette[]>([])
  /** **Ce que l'atelier proposerait comme fond à ce jeu-là** (D3), `null` tant
   *  que le serveur n'a pas répondu — l'étape dit alors qu'elle ne sait pas
   *  encore, jamais une couleur devinée. */
  const [fondPropose, setFondPropose] = useState<FondPropose | null>(null)
  /** **Ce qu'on a ouvert au moins une fois**, et c'est tout ce que le fil du
   *  pied a besoin de savoir de plus que la valeur d'une étape. Une étape sans
   *  valeur qu'on a lue n'est pas en retard ; une étape qu'on n'a jamais
   *  ouverte non plus — mais elle n'a rien à dire, et le point creux le dit. */
  const [vues_une_fois, setVuesUneFois] = useState<Set<Etape>>(new Set(["nom"]))

  const aller = (cle: Etape) => {
    setEtape(cle)
    setVuesUneFois((deja) => (deja.has(cle) ? deja : new Set(deja).add(cle)))
  }

  // Les deux listes fermées et la base d'étiquettes viennent du serveur : c'est
  // le même choix qui remplit le réglage *et* la phrase de la bible, et deux
  // listes tenues à deux endroits finiraient par diverger.
  useEffect(() => {
    // **On regarde la forme avant de s'y fier** : un serveur plus vieux que
    // l'écran répond 200 sans se plaindre, et c'est le piège que E3 a payé.
    void api
      .vuesEtTailles()
      .then((recu) => setVues(recu?.vues ? recu : null))
      .catch(() => setVues(null))
    void api
      .etiquettes()
      .then((recu) => setEtiquettes(recu?.etiquettes ?? []))
      .catch(() => setEtiquettes([]))
    // **Ce que l'atelier proposerait comme fond** (D3). Il vient du serveur
    // comme les deux listes fermées ci-dessus, et pour la même raison : la
    // distance qui décide de la sûreté d'un fond est celle du détourage, et une
    // seconde arithmétique ici finirait par proposer une couleur que le
    // découpage mange.
    void api
      .univers()
      .then((recu) => setFondPropose(recu?.fond_propose ?? null))
      .catch(() => setFondPropose(null))
  }, [])

  const regler: Regler = async (reglage) => {
    try {
      const recu = await api.reglerUnivers(reglage)
      onUnivers(recu.univers)
      // **La proposition suit le réglage** : promouvoir un artwork change la
      // palette, donc change ce que l'atelier proposerait. Garder l'ancienne
      // montrerait une couleur calculée sur des images qui ne sont plus là.
      if (recu.fond_propose) setFondPropose(recu.fond_propose)
      return true
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "réglage refusé")
      return false
    }
  }

  const rang = ETAPES.findIndex((e) => e.cle === etape)
  const laVue = vues?.vues?.find((v: VueDuJeu) => v.identifiant === univers.vue) ?? null

  return (
    <div data-assistant className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
      <aside
        {...PANNEAU}
        className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
      >
        <EnTetePanneau>Ce jeu</EnTetePanneau>
        {/* **La colonne dit deux choses à la fois, et c'est la même colonne** :
            ce que le jeu vaut — donc le récapitulatif, lisible sans rien
            ouvrir — et où l'on en est. Elle ne change plus d'humeur : la
            valeur d'une étape est ce qu'elle porte, et la coche verte dit
            *ça porte quelque chose*, jamais *c'est fait*. Rien n'est exigé ici,
            donc une étape sans coche n'est pas en retard. */}
        <div className="defile min-h-0 flex-1 overflow-y-auto p-2">
          {GROUPES.map((groupe) => (
            <div key={groupe} className="mb-2">
              <p className="mesure px-2 py-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
                {groupe}
              </p>
              {ETAPES.filter((e) => e.groupe === groupe).map((e) => {
                const { cle } = e
                // **Le nom que le style dit**, et c'est celui du titre de
                // l'écran : « La taille » en pixel art, « La finesse » en
                // dessin. Voir `nomDeLEtape`.
                const nom = nomDeLEtape(e, univers.style)
                const numero = ETAPES.findIndex((e) => e.cle === cle) + 1
                const vaut = valeurDeLEtape(cle, univers, laVue)
                return (
                  <button
                    key={cle}
                    type="button"
                    // **Le nom de l'étape, et rien d'autre.** Sans lui, le nom
                    // accessible de la rangée changerait avec son humeur — le
                    // numéro, la coche, la valeur — et une rangée qu'on désigne
                    // par ce qu'elle vaut n'est plus une rangée qu'on désigne.
                    aria-label={nom}
                    aria-pressed={etape === cle}
                    onClick={() => aller(cle)}
                    className={[
                      "flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[11.5px] transition-colors duration-[80ms]",
                      etape === cle
                        ? "bg-fond-3 text-texte"
                        : "text-texte-2 hover:bg-fond-2",
                    ].join(" ")}
                  >
                    <span className="mesure shrink-0 text-[10px] text-texte-3">
                      {numero}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{nom}</span>
                    <span className="mesure shrink-0 truncate text-[10px] text-texte-3">
                      {vaut}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {/* **Ce que cet univers envoie**, en pied de la colonne qui le règle et
            nulle part ailleurs. Voir `CeQueLUniversEnvoie`. */}
        <CeQueLUniversEnvoie univers={univers} artworks={artworks} />
      </aside>

      {/* **C'est un panneau de réglages, et il se déclare** (`docs/design-motifs.md`
          § L'infobulle explique) : c'est ce qui dit à une bulle de sortir par le
          bord de la colonne plutôt que par celui de l'écran. Le marqueur vivait
          sur la colonne de 380 px ; il suit ce qu'elle portait. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div
          {...PANNEAU}
          className="defile flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
        >
          {etape === "nom" && <LeNom onErreur={onErreur} />}
          {etape === "style" && <LeStyle univers={univers} onRegler={regler} />}
          {etape === "vue" && (
            <LaVue univers={univers} vues={vues?.vues ?? []} onRegler={regler} />
          )}
          {etape === "taille" && (
            <LaTaille
              univers={univers}
              tailles={univers.style === "dessin" ? vues?.finesses ?? [] : vues?.tailles ?? []}
              traitement={traitement}
              onRegler={regler}
              onRealigner={onRealigner}
            />
          )}
          {etape === "types" && <LesTypes univers={univers} onRegler={regler} />}
          {etape === "allure" && (
            <LAllure
              univers={univers}
              etiquettes={etiquettes}
              onEtiquettes={setEtiquettes}
              onRegler={(bible) => regler({ bible })}
              onErreur={onErreur}
            />
          )}
          {etape === "references" && (
            <LesReferences
              univers={univers}
              artworks={artworks}
              vue={laVue}
              fondPropose={fondPropose}
              onRegler={regler}
            />
          )}
          {etape === "poses" && (
            <LesPoses univers={univers} onErreur={onErreur} vue={laVue} />
          )}
          {etape === "emplacements" && (
            <LesEmplacements univers={univers} onErreur={onErreur} />
          )}
          {etape === "modeles" && (
            <LesIA univers={univers} modeles={modeles} onRegler={regler} />
          )}
          {etape === "detourage" && (
            <LeDetourage univers={univers} onRegler={regler} />
          )}
          {etape === "cle" && <LaCle onErreur={onErreur} onDeposee={onDeposee} />}
        </div>

        <PiedDeLAssistant
          rang={rang}
          vues={vues_une_fois}
          univers={univers}
          laVue={laVue}
          onAller={aller}
          onSortir={onSortir}
        />
      </div>
    </div>
  )
}

/**
 * Le pied de l'assistant — **44 px, et le geste qu'on répète y est un bouton**.
 *
 * **La panne était mesurable à l'œil.** Le geste qu'on fait dix fois dans un
 * assistant de dix étapes était `suivant →` en JetBrains Mono 10 px, dans une
 * bande de 38, à côté d'un `passer` en `--texte-3` — c'est-à-dire le plus petit
 * contrôle du produit pour son geste le plus répété. L'échelle de
 * `docs/DESIGN.md` donne 13 px sur 34 de haut à un bouton, et le fond plein
 * `--signal` à ce qui doit être pressé.
 *
 * **44 px, et la liste fermée des hauteurs gagne un locataire, pas une valeur** :
 * c'est celle de la barre de tête. 38 laisserait 2 px de garde autour d'un
 * bouton de 34, qui toucherait les traits.
 *
 * **Et il y a un retour.** Il n'y en avait aucun : on avançait ou l'on
 * abandonnait, ce qui est la définition d'un tunnel — et le produit s'est
 * expressément interdit les tunnels en ouvrant cet écran (A-9, A-10).
 */
function PiedDeLAssistant({
  rang,
  vues,
  univers,
  laVue,
  onAller,
  onSortir,
}: {
  rang: number
  vues: Set<Etape>
  univers: Univers
  laVue: VueDuJeu | null
  onAller: (cle: Etape) => void
  onSortir?: () => void
}) {
  const bouton =
    "mesure flex h-[34px] shrink-0 items-center rounded-[2px] px-3 text-[13px] transition-colors duration-[80ms]"
  return (
    <div className="flex h-[44px] shrink-0 items-center gap-4 border-t border-bord bg-fond-1 px-4">
      <button
        type="button"
        disabled={rang <= 0}
        onClick={() => onAller(ETAPES[Math.max(rang - 1, 0)].cle)}
        className={`${bouton} border border-bord-fort bg-fond-2 text-texte hover:bg-fond-3 disabled:border-bord disabled:bg-transparent disabled:text-texte-3`}
      >
        ‹ Retour
      </button>

      {/* **Dix points, et ils disent trois choses d'un coup** : vert ce qui
          porte une valeur, allongé en `--signal` où l'on est, creux ce qui n'a
          pas été ouvert. C'est le vocabulaire de la coche de la colonne, en une
          seule ligne — et il n'y a ni glyphe ni couleur neufs.

          **Muet pour qui ne voit pas l'écran** : le compteur juste à côté dit
          la même chose en toutes lettres, et deux fois la même information au
          clavier est du bruit. */}
      <span aria-hidden className="flex shrink-0 items-center gap-[5px]">
        {ETAPES.map(({ cle }, i) => {
          const porte = Boolean(valeurDeLEtape(cle, univers, laVue))
          return (
            <i
              key={cle}
              className={[
                "block h-[6px] rounded-full transition-colors duration-[80ms]",
                i === rang
                  ? "w-4 bg-ancien-signal"
                  : porte
                    ? "w-[6px] bg-ancien-ok"
                    : vues.has(cle)
                      ? "w-[6px] bg-bord-fort"
                      : "w-[6px] bg-bord",
              ].join(" ")}
            />
          )
        })}
      </span>
      <span className="mesure shrink-0 text-[10px] text-texte-3">
        étape {rang + 1} sur {ETAPES.length}
      </span>

      {/* **Une porte n'en est une que si elle s'ouvre dans les deux sens**
          (E19). On tombe dans le codex, avec le champ qui nomme allumé — pas
          dans la galerie, qui ne montre que des images produites et n'en a
          aucune. On peut partir dès la première étape et fabriquer quand même. */}
      <button
        type="button"
        onClick={() => onSortir?.()}
        title="rien n'est exigé — une étape passée reste passée, et se rouvre d'un clic"
        className={`${bouton} ml-auto text-texte-2 hover:text-ancien-signal`}
      >
        j'ai fini pour l'instant
      </button>
      <button
        type="button"
        disabled={rang >= ETAPES.length - 1}
        onClick={() => onAller(ETAPES[Math.min(rang + 1, ETAPES.length - 1)].cle)}
        className={`${bouton} bg-ancien-signal font-medium text-fond-0 hover:bg-ancien-signal-clair disabled:bg-fond-2 disabled:text-texte-3`}
      >
        Continuer →
      </button>
    </div>
  )
}

/** Ce qu'une étape vaut, en une ligne — **c'est ce qui fait de la colonne un
 *  récapitulatif**. Vide veut dire *pas encore ouverte*, et rien ne le réclame :
 *  le manque n'a pas de couleur, ici comme dans le codex. */
function valeurDeLEtape(
  etape: Etape,
  univers: Univers,
  vue: VueDuJeu | null,
): string {
  const cases = univers.bible.filter((c) => c.actif && c.texte.trim()).length
  switch (etape) {
    case "vue":
      return vue ? `${vue.libelle} · ${vue.images} img.` : ""
    case "taille":
      return univers.cible_px ? String(univers.cible_px) : ""
    case "types":
      return `${univers.bareme.length} types`
    case "allure":
      return cases ? `${cases} sur ${univers.bible.length}` : ""
    case "references":
      return univers.palette.length ? `${univers.palette.length} coul.` : ""
    case "modeles": {
      // **Les quatre familles de sujet, et « tous » n'en est pas une** : c'est
      // la clé du catalogue qui dit *n'importe quel sujet*, et l'étape ne lui
      // offre pas de rangée. La compter ferait dire quatre à une colonne qui
      // en montre trois.
      const familles = FAMILLES.filter((f) => f !== "tous")
      const reglees = familles.filter((f) => univers.modeles[f]).length
      return reglees ? `${reglees} sur ${familles.length}` : ""
    }
    case "detourage": {
      // **Le compte de ce qui a été posé**, natures comprises : ce sont trois
      // façons de régler la même chose, et n'en compter qu'une ferait dire
      // « rien » à une colonne qui montre un réglage.
      const poses =
        (univers.detourage_image ? 1 : 0) +
        (univers.detourage_planche ? 1 : 0) +
        Object.keys(univers.detourages).length
      return poses ? `${poses} posé${poses > 1 ? "s" : ""}` : ""
    }
    default:
      return ""
  }
}

/**
 * Ce que cet univers envoie — le bloc en pied de colonne.
 *
 * **Un univers ne se lisait nulle part.** Sept cases de texte, chacune avec son
 * interrupteur, une palette, une taille de pixel, un barème : rien ne disait ce
 * qui part vraiment avec un appel, ni combien ça pèse. Mesuré dans ce dépôt, le
 * style représente 53 % du texte envoyé et le sujet 2 % — un chiffre qu'aucun
 * écran ne montrait, et qui décide de ce qu'on peut espérer changer en
 * réécrivant son prompt.
 *
 * **Il dit aussi ce qui n'agit qu'au retour**, et c'est la moitié la moins
 * évidente : la taille de pixel et le barème ne partent pas chez le
 * fournisseur — ils s'appliquent à l'image quand elle revient. Les mélanger
 * avec ce qui part ferait croire qu'on peut demander au modèle de rendre du
 * 64 px, ce qu'aucun modèle ne fait.
 */
function CeQueLUniversEnvoie({
  univers,
  artworks,
}: {
  univers: Univers
  artworks: Carte[]
}) {
  const actives = univers.bible.filter((c) => c.actif && c.texte.trim())
  const signes = actives.reduce((somme, c) => somme + c.texte.trim().length, 0)
  return (
    <div className="mesure shrink-0 border-t border-bord p-2 text-[10px] text-texte-3">
      <p className="mb-1 text-[9.5px] tracking-[.11em] uppercase">
        Ce que cet univers envoie
      </p>
      <p className="flex items-center gap-2">
        <span>cases de style</span>
        <span className="ml-auto text-texte-2">
          {actives.length} sur {univers.bible.length}
        </span>
      </p>
      <p className="flex items-center gap-2">
        <span>signes de texte</span>
        <span className="ml-auto text-texte-2">{signes}</span>
      </p>
      <p className="flex items-center gap-2">
        <span>images officielles</span>
        <span className="ml-auto text-texte-2">{artworks.length}</span>
      </p>
      {/* **Ce qui n'agit qu'au retour**, dit à part et nommé comme tel. */}
      <p className="mt-1 flex items-start gap-1.5 border-t border-bord pt-1">
        <span aria-hidden className="mt-1.5 inline-block h-px w-2 shrink-0 bg-texte-3" />
        <span>
          la taille de pixel et le barème ne partent pas : ils s'appliquent à
          l'image qui revient
        </span>
      </p>
    </div>
  )
}

/** Une étape ouverte — **titrée, entière, et jamais repliable**.
 *
 *  Le bloc repliable sert à ranger plusieurs réglages dans une colonne étroite.
 *  Ici l'étape *est* l'unité : la colonne de gauche dit laquelle est ouverte, et
 *  l'écran entier lui est donné. Un repli à l'intérieur serait un repli de trop
 *  — il faudrait déplier pour voir ce qu'on vient d'ouvrir.
 *
 *  **La règle était écrite ici et enfreinte quatre fois** : quatre étapes sur
 *  dix étaient construites avec le `Bloc` du châssis, dont le registre naît
 *  fermé. Elles ne le sont plus, et ce composant est désormais le seul chemin
 *  vers une étape — c'est ce qui empêche la cinquième.
 *
 *  **Le titre est en serif 24 px**, le deuxième des trois emplois que
 *  `docs/DESIGN.md` accorde au serif : celui des titres d'écran. Aucune règle
 *  neuve — une étape *est* un écran, et la version d'avant le disait déjà en
 *  lui donnant la scène entière. Il est nu, comme celui de la fenêtre des
 *  réglages : **la poignée d'infobulle ne monte pas dessus**, parce qu'un
 *  libellé du produit fait 11 px et que le pointillé est dessiné pour cette
 *  taille-là. Elle se pose sur la ligne de repère juste au-dessus, qui dit le
 *  rang de l'étape et son groupe — donc où l'on est dans les dix.
 *
 *  **La conduite est en 14 px**, la taille que l'échelle réserve à la prose
 *  longue. Elle dit ce que ce choix change **ailleurs**, jamais ce que le
 *  contrôle fait : ça, on le voit. */
function EtapeOuverte({
  titre,
  aide,
  conduite,
  children,
}: {
  /** Le nom de l'étape, tel que la colonne le range. **Le rang et le groupe
   *  s'en déduisent** : deux endroits qui numéroteraient les mêmes dix étapes
   *  finiraient par se contredire, et c'est exactement la panne que
   *  l'assistant répare ailleurs. Un titre absent de la liste — le texte à
   *  copier, qui vit sous les références — n'a pas de ligne de repère, et c'est
   *  ce qui le dit demi-étape. */
  titre: string
  aide?: string
  conduite?: ReactNode
  children: ReactNode
}) {
  const rang = rangDuTitre(titre)
  return (
    <section data-etape={titre} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {rang >= 0 && (
          <Libelle aide={aide}>
            étape {rang + 1} · {ETAPES[rang].groupe}
          </Libelle>
        )}
        <h2 className="font-serif text-[24px] leading-tight text-texte">{titre}</h2>
        {conduite && (
          <p className="max-w-[66ch] text-[14px] leading-normal text-texte-2">
            {conduite}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

// ── Les vignettes d'exemple ─────────────────────────────────────────────────

/**
 * Le dessin d'une vue, **en grand** — et c'est tout ce qui change.
 *
 * **Mesuré, dessin par dessin, le 1ᵉʳ septembre 2026** : les huit vignettes de
 * vue font entre 438 et 1 763 points de haut, et l'écran les montrait dans une
 * case de 64 × 64. Entre **0,20 % et 1,89 % de leurs pixels** survivaient — 1 %
 * en moyenne. Pendant ce temps la liste verticale débordait en hauteur (778 px
 * de contenu pour 754 offerts) et n'employait que 240 des 1 360 px de largeur.
 *
 * On ne choisit pas *isométrique* dans l'abstrait : on choisit la vue qu'on
 * reconnaît. Une bande de 190 px la rend reconnaissable ; 64 px non.
 */
function Vignette({ nom, alt }: { nom: string; alt: string }) {
  const [absente, setAbsente] = useState(false)
  if (absente) {
    return (
      <span className="mesure flex h-full w-full items-center justify-center p-2 text-center text-[9.5px] text-texte-3">
        pas encore dessinée
      </span>
    )
  }
  return (
    <img
      src={`/vignettes/${nom}.png`}
      alt={alt}
      onError={() => setAbsente(true)}
      className="max-h-full max-w-full object-contain"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

/**
 * Un sprite de taille, **à sa taille**, posé sur le sol commun.
 *
 * **L'écran contredisait sa propre phrase.** Il écrit — et il a raison — *« un
 * nombre ne dit rien, deux personnages côte à côte disent tout »*, puis il
 * posait les neuf sprites dans neuf cases de 64 px : le 8 agrandi huit fois, le
 * 256 réduit au quart. **L'écart de ×32 qui existe dans le jeu devenait ×1 à
 * l'écran**, et la seule chose que le choix demande de voir était exactement
 * celle qui était effacée.
 *
 * Un pixel d'image pour un pixel d'écran, donc, et rien d'autre à décider.
 */
function SpriteDeTaille({ cible }: { cible: number }) {
  const [absent, setAbsent] = useState(false)
  if (absent) {
    return (
      <span
        style={{ width: cible, height: cible }}
        className="mesure flex items-center justify-center border border-dashed border-bord text-center text-[9px] text-texte-3"
      />
    )
  }
  return (
    <img
      src={`/vignettes/taille-${cible}.png`}
      alt=""
      width={cible}
      height={cible}
      onError={() => setAbsent(true)}
      className="block"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// ── Les dix étapes ──────────────────────────────────────────────────────────

/** L'étape « Le nom » — le nom du jeu.
 *
 *  **L'assistant ne crée pas le jeu, il le renomme** : sur une machine neuve,
 *  le « Bac à sable » existe déjà, et rien n'est exigé pour commencer.
 *  L'identifiant, lui, ne bouge pas. */
function LeNom({ onErreur }: { onErreur: (raison: string) => void }) {
  const [projet, setProjet] = useState<{ identifiant: string; nom: string } | null>(null)
  const [brouillon, setBrouillon] = useState("")

  useEffect(() => {
    void api
      .arbre()
      .then((arbre) => {
        const ouvert = arbre?.projets?.find((p) => p.identifiant === arbre.courant)
        if (!ouvert) return
        setProjet({ identifiant: ouvert.identifiant, nom: ouvert.nom })
        setBrouillon(ouvert.nom)
      })
      .catch(() => setProjet(null))
  }, [])

  return (
    <EtapeOuverte
      aide="assistant.nom"
      titre="Le nom"
      conduite={
        <>
          Comment le jeu s'appelle. C'est le seul réglage qui{" "}
          <strong className="text-texte">ne part jamais au modèle</strong> : il
          sert à s'y retrouver, et rien d'autre.
        </>
      }
    >
      <div className="flex items-center gap-2">
        <input
          value={brouillon}
          aria-label="Le nom du jeu"
          onChange={(e) => setBrouillon(e.target.value)}
          className="h-[34px] min-w-0 max-w-[420px] flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[13px] text-texte"
        />
        <button
          type="button"
          disabled={!projet || !brouillon.trim() || brouillon === projet?.nom}
          onClick={() =>
            projet &&
            void api
              .renommerProjet(projet.identifiant, brouillon)
              .then(({ projet: neuf }) =>
                setProjet({ identifiant: projet.identifiant, nom: neuf.nom }),
              )
              .catch((erreur) => onErreur(String(erreur)))
          }
          className="mesure h-[34px] shrink-0 rounded-[2px] border border-bord-fort px-3 text-[11.5px] text-texte-2 hover:text-ancien-signal disabled:text-texte-3"
        >
          renommer
        </button>
      </div>
      {projet && (
        <Raison
          texte={`le dossier reste « ${projet.identifiant} » — un dossier qui se renomme sous ses fichiers est un déménagement, pas un renommage`}
        />
      )}
    </EtapeOuverte>
  )
}

/** L'étape « La vue » — la vue du jeu.
 *
 *  **Chaque vue est une carte, pas une ligne de texte** : on ne choisit pas
 *  *isométrique* dans l'abstrait, on choisit celle qu'on reconnaît. Le dessin
 *  passe devant, et il a la place — quatre par rangée, bande de 190 px. La
 *  mesure qui a fait passer la vignette de 64 à 190 est dans `Vignette`. */
function LaVue({
  univers,
  vues,
  onRegler,
}: {
  univers: Univers
  vues: VueDuJeu[]
  onRegler: Regler
}) {
  return (
    <EtapeOuverte
      aide="assistant.vue"
      titre="La vue"
      conduite={
        <>
          D'où l'on regarde le monde. Ce choix ne décide pas de l'apparence du
          jeu : il décide de{" "}
          <strong className="text-texte">combien d'images il faut par pose</strong>{" "}
          — le chiffre qui multiplie toute la production, donc tout ce qu'on
          paiera.
        </>
      }
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[9px]">
        {(vues ?? []).map((vue) => {
          const choisie = univers.vue === vue.identifiant
          return (
            <li key={vue.identifiant}>
              <button
                type="button"
                aria-pressed={choisie}
                aria-label={vue.libelle}
                onClick={() => void onRegler({ vue: vue.identifiant })}
                className={[
                  "flex h-full w-full flex-col overflow-hidden rounded-[2px] border text-left transition-colors duration-[80ms]",
                  choisie
                    ? "border-ancien-signal bg-ancien-signal/13"
                    : "border-bord hover:bg-fond-2",
                ].join(" ")}
              >
                <span className="flex h-[190px] items-center justify-center overflow-hidden border-b border-bord bg-fond-0">
                  <Vignette nom={vue.identifiant} alt={vue.libelle} />
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-[14px] leading-tight text-texte">
                    {vue.libelle}
                  </span>
                  <span className="mesure text-[10px] leading-snug text-texte-3">
                    {vue.exemples}
                  </span>
                  {/* **Le gros chiffre n'est pas décoratif** : c'est le
                      multiplicateur de tout ce qu'on paiera. La phrase de
                      conduite le dit déjà — et le chiffre le dit mieux. */}
                  <span className="mesure mt-auto flex items-baseline gap-1.5 border-t border-bord pt-2 text-[11px] text-texte-2">
                    <b
                      className={`text-[15px] font-medium ${choisie ? "text-ancien-signal-clair" : "text-ancien-signal"}`}
                    >
                      {vue.images}
                    </b>{" "}
                    image{vue.images > 1 ? "s" : ""} par pose
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {univers.vue && (
        <Raison texte="ce choix écrit aussi la phrase de cadrage qui part au modèle — le réglage et le texte envoyé ne peuvent plus se contredire" />
      )}
    </EtapeOuverte>
  )
}

/** L'étape « La taille » — la taille des images.
 *
 *  **Le plus coûteux des dix.** Tout ce qui a été fabriqué a été découpé à
 *  l'ancienne taille : les images ne se recoupent pas, il faut les refabriquer,
 *  et chacune se paie. La ligne le dit avec le compte et le coût — puis laisse
 *  passer. **Le réglage n'est jamais grisé.**
 *
 *  **Et les neuf sprites sont à leur vraie taille**, sur un seul sol : voir
 *  `SpriteDeTaille` pour la mesure qui l'impose. La bande fait 256 px de haut et
 *  672 de large ; c'est cher, et c'est payé volontiers — l'étape en employait
 *  269 sur 754 pour un résultat qui ne montrait rien. */
/** L'étape « Le style » — le style graphique du jeu (D2).
 *
 *  **La première question de toutes après le nom, et elle n'existait pas.** La
 *  réponse se déduisait d'un détail trois étapes plus loin : la neuvième valeur
 *  de la règle des tailles, « aucune », dont le libellé disait en toutes lettres
 *  *ce jeu n'est pas en pixel art*. Le style était donc une conséquence d'un
 *  réglage de taille, quand c'est l'inverse — **le style décide de ce que la
 *  taille veut dire**.
 *
 *  **Deux images, pas deux phrases**, et c'est la demande de l'auteur : *« on
 *  met une image cliquable pour chaque style qui permet de faire le choix »*.
 *  Les deux montrent **le même personnage, au même cadrage** — seul le style
 *  change —, parce qu'une comparaison entre deux sujets différents ne compare
 *  plus le style. C'est la règle des dix-sept vignettes déjà là
 *  (`docs/vignettes-vues.md`), et elles sont fabriquées par la chaîne du produit
 *  elle-même (`essais/vignettes_de_style.py`). */
function LeStyle({ univers, onRegler }: { univers: Univers; onRegler: Regler }) {
  const styles = [
    {
      cle: "pixel" as const,
      titre: "En pixel art",
      quoi: "Des carrés de couleur visibles, comme les jeux rétro.",
      // **Ce que le choix change ailleurs, pas ce que le contrôle fait** —
      // la règle d'écriture des étapes.
      suite: "L'étape suivante demandera combien de carrés, de 8 à 512.",
    },
    {
      cle: "dessin" as const,
      titre: "En dessin",
      quoi: "Un dessin normal, sans carrés apparents.",
      suite: "L'étape suivante demandera quelle finesse, de 256 à 2048.",
    },
  ]
  return (
    <EtapeOuverte
      aide="univers.style"
      titre="Le style"
      conduite={
        <>
          Comment ton jeu est-il dessiné ?{" "}
          <strong className="text-texte">
            C'est la question qui commande toutes les autres
          </strong>{" "}
          : elle décide de ce que « la taille » veut dire, de ce qui part au
          modèle, et de ce que l'atelier fait de l'image au retour.
        </>
      }
    >
      <ul className="flex flex-wrap gap-4">
        {styles.map(({ cle, titre, quoi, suite }) => {
          const marque = univers.style === cle
          return (
            <li key={cle}>
              <button
                type="button"
                aria-pressed={marque}
                onClick={() => void onRegler({ style: cle })}
                className={[
                  "flex w-[268px] flex-col gap-2 rounded-[2px] border p-3 text-left transition-colors duration-[80ms]",
                  marque
                    ? "border-ancien-signal bg-ancien-signal/13"
                    : "border-bord hover:bg-fond-2",
                ].join(" ")}
              >
                <VignetteDeStyle cle={cle} />
                <span
                  className={`text-[14px] leading-tight ${marque ? "text-ancien-signal" : "text-texte"}`}
                >
                  {titre}
                </span>
                <span className="mesure text-[10px] leading-snug text-texte-3">
                  {quoi}
                </span>
                <span className="mesure text-[9.5px] leading-snug text-texte-3">
                  {suite}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {/* **Ce que le changement ne fait pas**, et c'est ce qui le rend sans
          danger : aucune image déjà rendue ne bouge. Ce que le style change
          entre dans les prochaines recettes, comme la taille de case. */}
      <Raison texte="changer de style ne rejoue aucune image déjà rendue — il change ce qui part et ce qu'on fait des suivantes" />
      {univers.style === "dessin" && (
        <Raison texte="en dessin, les couleurs ne sont plus réduites à une palette : un dessin garde ses nuances, les réduire en ferait une affiche" />
      )}
    </EtapeOuverte>
  )
}

/** La vignette d'un style. **Absente, elle le dit** — même règle que les
 *  vignettes de vue et de taille : une image manquante ne casse pas l'étape, et
 *  le choix reste possible sur le titre et sa phrase. */
function VignetteDeStyle({ cle }: { cle: "pixel" | "dessin" }) {
  const [absent, setAbsent] = useState(false)
  if (absent) {
    return (
      <span className="mesure flex h-[180px] items-center justify-center rounded-[2px] border border-dashed border-bord text-[9px] text-texte-3">
        pas encore dessinée
      </span>
    )
  }
  return (
    <img
      src={`/vignettes/style-${cle}.png`}
      alt=""
      onError={() => setAbsent(true)}
      className="block h-[180px] w-full rounded-[2px] bg-fond-0 object-contain"
      // **Au plus proche, et pour les deux** : la vignette du pixel art perdrait
      // ses carrés si le navigateur la lissait, et c'est très exactement ce
      // qu'on demande de comparer.
      style={{ imageRendering: "pixelated" }}
    />
  )
}

function LaTaille({
  univers,
  tailles,
  traitement,
  onRegler,
  onRealigner,
}: {
  univers: Univers
  tailles: TailleDImage[]
  traitement: EtatTraitement
  onRegler: Regler
  onRealigner: () => void
}) {
  const [vise, setVise] = useState<number | null>(null)
  const [casse, setCasse] = useState<Consequences | null>(null)
  /** **Seulement ce que cette machine-ci sait faire** (D2) : « traits épaissis »
   *  tire une bibliothèque lourde et peut manquer. On ne la propose pas alors,
   *  plutôt que de l'offrir et de refuser au clic. */
  const reductions = traitement.reductions.filter((r) => r.raison === null)
  const indisponibles = traitement.reductions.filter((r) => r.raison !== null)
  const libelleDeLaMethode = (nom: Methode) =>
    traitement.reductions.find((r) => r.nom === nom)?.libelle ?? nom
  /** **La même étape pose deux questions**, selon le style (D2) : *combien de
   *  carrés* ou *quelle finesse*. Ce ne sont ni les mêmes valeurs, ni le même
   *  mot, ni la même conséquence — et les confondre est ce qui faisait croire
   *  qu'un jeu en dessin n'a pas de taille du tout. */
  const dessin = univers.style === "dessin"

  useEffect(() => {
    if (vise === null || vise === univers.cible_px) {
      setCasse(null)
      return
    }
    void api
      .consequences(vise)
      .then(setCasse)
      .catch(() => setCasse(null))
  }, [vise, univers.cible_px])

  const survolee = tailles.find((t) => t.cible === vise)
  const choisie = tailles.find((t) => t.cible === univers.cible_px)
  const dite = survolee ?? choisie

  return (
    <EtapeOuverte
      aide="assistant.taille"
      titre={dessin ? "La finesse" : "La taille"}
      conduite={
        dessin ? (
          <>
            Combien de détail chaque image garde.{" "}
            <strong className="text-texte">
              Ce n'est pas un nombre de carrés : ton jeu n'est pas en pixel art
            </strong>{" "}
            — c'est la finesse du fichier, à choisir d'après la taille à
            l'écran. Environ le double de la hauteur affichée, pour rester net.
          </>
        ) : (
          <>
            Le côté de la case où tout ce qui rentre est ramené.{" "}
            <strong className="text-texte">
              Le même personnage est dessiné à chaque taille, et à sa vraie taille
            </strong>{" "}
            : un nombre ne dit rien, deux personnages côte à côte disent tout.
          </>
        )
      }
    >
      {/* **« Aucune » est une valeur, pas un trou** (US-163), et elle est en
          tête parce qu'elle est la première question — *ce jeu est-il en pixel
          art ?* — et non la dernière. Elle n'a pas de sprite : il n'y a rien
          à montrer d'une image qu'on ne ramène nulle part. */}
      <button
        type="button"
        aria-pressed={univers.cible_px === AUCUNE_CIBLE}
        onPointerEnter={() => setVise(AUCUNE_CIBLE)}
        onPointerLeave={() => setVise(null)}
        onClick={() => void onRegler({ cible_px: AUCUNE_CIBLE })}
        className={[
          "flex h-[34px] w-fit items-center gap-2 rounded-[2px] border px-3 text-left text-[11.5px] transition-colors duration-[80ms]",
          univers.cible_px === AUCUNE_CIBLE
            ? "border-ancien-signal bg-ancien-signal/13 text-ancien-signal"
            : "border-bord text-texte-2 hover:bg-fond-2",
        ].join(" ")}
      >
        {NOM_CIBLE["0"]}
        <span className="mesure text-[10px] text-texte-3">
          {/* **La phrase d'avant est devenue fausse en D2** : elle disait « ce
              jeu n'est pas en pixel art », ce qui était vrai tant que « aucune »
              *était* la façon de le déclarer. Le style le dit maintenant
              lui-même, et « aucune » redevient ce qu'elle prétend être — aucune
              contrainte de taille, dans l'un ou l'autre style. */}
          {dessin
            ? "— l'image garde la finesse que le modèle lui a donnée"
            : "— l'image garde la taille que le modèle lui a donnée"}
        </span>
      </button>
      {/* **Ce qui continue de s'appliquer**, dit là où on choisit de ne plus
          remettre sur grille : sans cette ligne, « aucune » se lirait comme
          « plus aucun traitement », ce qui est faux. */}
      {univers.cible_px === AUCUNE_CIBLE && (
        <Raison texte="aucune remise sur grille — le détourage, le recadrage et la palette s'appliquent toujours" />
      )}

      {/* **La règle des neuf tailles.** Elle déborde latéralement plutôt que de
          se réduire : une règle qui triche sur l'échelle ne sert à rien du tout.
          C'est la seule surface de l'assistant qui ait ce droit, et elle le dit
          avec la barre de 9 px de partout ailleurs. */}
      <div className="defile overflow-x-auto rounded-[2px] border border-bord bg-fond-0 px-4">
        <ul className="flex items-end gap-4 pt-6">
          {tailles.map(({ cible, quoi }) => {
            const marquee = univers.cible_px === cible
            return (
              <li key={cible} className="flex shrink-0 flex-col items-center">
                <button
                  type="button"
                  aria-pressed={marquee}
                  onPointerEnter={() => setVise(cible)}
                  onPointerLeave={() => setVise(null)}
                  onClick={() => void onRegler({ cible_px: cible })}
                  // Le nom accessible est la mesure, et rien de plus : le titre
                  // et l'alternative de l'image s'ajouteraient sinon au nom, et
                  // une case qu'on désigne par trois choses n'est plus une case.
                  aria-label={`${cible} px`}
                  title={quoi}
                  className={[
                    "flex items-end justify-center rounded-[2px] border p-1 transition-colors duration-[80ms]",
                    marquee
                      ? "border-ancien-signal bg-ancien-signal/13"
                      : "border-transparent hover:border-bord",
                  ].join(" ")}
                >
                  <SpriteDeTaille cible={cible} />
                </button>
                <span aria-hidden className="mt-1 h-px w-full bg-bord-fort" />
                <span
                  className={`mesure pt-2 pb-4 text-[10px] whitespace-nowrap ${marquee ? "text-ancien-signal" : "text-texte-3"}`}
                >
                  {cible}
                </span>
              </li>
            )
          })}
        </ul>
        {/* **Une seule phrase, à un seul endroit** : celle de la taille visée,
            ou de la taille choisie. Neuf phrases à la fois ne se lisent pas. */}
        <p className="mesure flex items-center gap-3 border-t border-bord py-2 text-[9.5px] text-texte-3">
          <span>
            le même personnage, dessiné neuf fois — un pixel d'image pour un
            pixel d'écran
          </span>
          {dite && (
            <span className="ml-auto text-texte-2">
              {dite.cible} px · {dite.quoi}
            </span>
          )}
        </p>
      </div>

      {/* **Un changement qui casse du travail payé annonce les vrais chiffres**,
          puis laisse décider : le produit n'a qu'un seul refus automatique, et
          en ajouter un deuxième reviendrait à bloquer un auteur sur son jeu. */}
      {casse && casse.images > 0 && (
        <p className="mesure text-[10px] text-epingle">
          {casse.images} image{casse.images > 1 ? "s ont" : " a"} déjà été
          découpée{casse.images > 1 ? "s" : ""} en {casse.cible} px — les
          refabriquer coûte environ {casse.cout_usd.toFixed(2)} $
        </p>
      )}
      <Raison texte="ce choix écrit aussi la phrase de grille et celle de calage — le réglage et le texte envoyé ne peuvent plus se contredire" />

      {/* **La façon de réduire, juste sous la taille** (D2), parce que c'est la
          même question posée deux fois : la taille dit *combien de carrés*, la
          méthode dit *comment on y arrive*. Séparées, on règle la première sans
          savoir que la seconde décide autant du rendu.

          **Elle disparaît avec « aucune ».** Sans remise sur grille il n'y a
          aucune réduction à faire, et un réglage sans effet vaut mieux caché
          qu'expliqué. */}
      {univers.cible_px !== AUCUNE_CIBLE && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex w-fit items-center gap-3">
            <Libelle aide="grille.methode">Façon de réduire</Libelle>
            <Segments
              plusieursRangees
              valeurs={reductions.map((r) => r.libelle)}
              valeur={libelleDeLaMethode(univers.methode_pixels)}
              onChange={(libelle) => {
                const choisie = reductions.find((r) => r.libelle === libelle)
                if (choisie) void onRegler({ methode_pixels: choisie.nom })
              }}
            />
          </div>
          <Raison texte={CE_QUE_LA_METHODE_REND[univers.methode_pixels]} />
          {/* **Une méthode absente est annoncée, jamais tue.** « Ce qui est
              indisponible est grisé avec sa raison » — et la taire serait pire
              qu'un grisé : l'auteur croirait que le produit n'en propose que
              trois, et ne saurait pas qu'il en manque une qu'il peut installer. */}
          {indisponibles.map((r) => (
            <Raison key={r.nom} texte={r.raison ?? ""} />
          ))}
          {/* **Ce qu'elle ne fait pas**, et c'est ce qui rend le réglage sans
              danger : les images déjà rendues portent leur propre méthode et ne
              bougent pas. C'est la même règle que la taille de case. */}
          <Raison texte="ce choix part dans les prochaines recettes — les images déjà rendues gardent la leur, et se règlent une par une sur leur fiche" />
        </div>
      )}

      <button
        type="button"
        onClick={onRealigner}
        className="mesure h-6 self-start text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        Tout réaligner ›
      </button>
    </EtapeOuverte>
  )
}

/** L'étape « Les types d'objets » — ce que le jeu contient.
 *
 *  **« Barème d'échelles » a quitté l'écran le 1ᵉʳ septembre 2026.** Le mot est
 *  juste, il est même précis, et il ne se comprend pas : personne ne cherche un
 *  barème en créant un jeu. Il survit dans l'aide, où il sert à retrouver le mot
 *  du code ; l'étape, elle, demande *de quoi ton jeu est fait*.
 *
 *  **Et l'étape s'ouvre entière.** Elle était un bloc repliable dont le registre
 *  naît fermé : ouverte, elle rendait 26 points de contenu dans 754. La mesure
 *  qui plaidait le repli — « trois contrôles dépliés faisaient 92 px par ligne,
 *  644 px pour sept types » — était juste **sur une colonne de 380 px**, et
 *  cette colonne n'existe plus depuis E7. Sur 1 360, quatre cartes tiennent par
 *  rangée.
 *
 *  **Les huit sont visibles ensemble, et c'est le point** : l'échelle d'un type
 *  ne veut rien dire toute seule. Ce qui compte est que le tonneau soit plus
 *  petit que le nain, et cela ne se voit que si les deux sont à l'écran. */
function LesTypes({ univers, onRegler }: { univers: Univers; onRegler: Regler }) {
  const poser = (bareme: Echelle[]) => void onRegler({ bareme })
  /** **La case contre laquelle les hauteurs se jugent.** Un jeu en dessin n'en
   *  impose aucune, et l'échantillon a pourtant besoin d'en dessiner une : c'est
   *  la case par défaut qui sert alors de mètre, exactement comme le serveur la
   *  prend pour juger le barème d'un projet sans taille. */
  const cible = univers.cible_px || CIBLE_DE_REFERENCE
  const plafond = occupationMax(cible)

  return (
    <EtapeOuverte
      aide="univers.bareme"
      titre="Les types d'objets"
      conduite={
        <>
          Les sortes d'objets que tu vas fabriquer. Chacune décide de{" "}
          <strong className="text-texte">trois choses à la fois</strong> : quelles
          images de référence partent avec elle,{" "}
          <strong className="text-texte">quelle hauteur</strong> elle fait — en
          personnages —, et si elle se découpe.
        </>
      }
    >
      {/* **La hauteur n'agit que par la grille**, qui est ce qui met un sujet
          à l'échelle de sa case : sans taille de pixel, elle ne s'applique pas.
          La famille et la silhouette, elles, continuent — l'une décide des
          artworks qui partent, l'autre du détourage. */}
      {univers.cible_px === AUCUNE_CIBLE && (
        <Raison texte="sans taille de pixel, la hauteur ne s'applique pas — les images de référence et le découpage, si" />
      )}
      {/* **Ce que la tranche des tailles vient d'ouvrir, dit une fois.** Le
          plafond était le personnage, et personne ne pouvait le savoir : un
          curseur qui s'arrête n'explique pas pourquoi. Maintenant qu'il monte,
          il faut dire jusqu'où et dans quelle unité on compte. */}
      <Raison
        texte={`un type peut dépasser le personnage : 300 % fait un bâtiment de trois personnages de haut, et l'image revient d'autant plus grande — jusqu'à ${plafond} % sur une case de ${cible} carrés`}
      />

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-[9px]">
        {univers.bareme.map((echelle, rang) => (
          <li
            key={echelle.nom}
            className="flex flex-col gap-2 rounded-[2px] border border-bord bg-fond-1 p-3"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[14px] leading-tight text-texte">{echelle.nom}</span>
              <label className="mesure flex items-center gap-2 text-[9.5px] text-texte-3">
                <span className="shrink-0">images de référence</span>
                <select
                  value={echelle.famille}
                  aria-label={`Images de référence de ${echelle.nom}`}
                  onChange={(e) =>
                    poser(
                      univers.bareme.map((x, i) =>
                        i === rang ? { ...x, famille: e.target.value as Famille } : x,
                      ),
                    )
                  }
                  className="mesure ml-auto h-[24px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
                >
                  {FAMILLES.map((f) => (
                    <option key={f} value={f}>
                      {NOM_FAMILLE[f]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* **La hauteur dessinée est le réglage**, et le dessin dit
                maintenant ce qu'il ne pouvait pas dire : une barre dans un carré
                ne dépasse jamais le carré, donc l'ancien échantillon montrait
                très exactement la limite qu'on vient de lever. Voir
                `EchantillonDeHauteur` — le cadre y est le fichier qui reviendra,
                et le pointillé la hauteur d'un personnage. */}
            <div className="flex flex-col gap-2">
              <EchantillonDeHauteur
                occupation={echelle.occupation}
                cible={univers.cible_px || CIBLE_DE_REFERENCE}
              />
              {/* **Pas de crans ici, contrairement au curseur d'une image.**
                  Là-bas ils évitent que la main croie régler quelque chose quand
                  deux positions rendent la même image ; ici la valeur est une
                  *déclaration* — « ce type fait trois personnages » —, et un cran
                  la ferait glisser à 294 % sur une petite case, où trois
                  personnages ne tombent pas sur un compte rond de carrés. */}
              <Curseur
                libelle={`la hauteur de ${echelle.nom}`}
                valeur={echelle.occupation}
                min={10}
                max={plafond}
                unite=" %"
                onChange={(occupation) =>
                  poser(
                    univers.bareme.map((x, i) =>
                      i === rang ? { ...x, occupation } : x,
                    ),
                  )
                }
              />
            </div>

            <button
              type="button"
              onClick={() =>
                poser(
                  univers.bareme.map((x, i) =>
                    i === rang ? { ...x, silhouette: !x.silhouette } : x,
                  ),
                )
              }
              className={[
                "flex h-[26px] items-center gap-2 rounded-[2px] border border-bord bg-fond-2 px-2 text-left text-[11.5px] transition-colors duration-[80ms] hover:bg-fond-3",
                echelle.silhouette ? "text-texte-2" : "text-epingle",
              ].join(" ")}
            >
              {/* **Plein quand c'est vrai** — une case cochée est une case
                  remplie, et l'inverse se lirait à contresens. */}
              <span
                aria-hidden
                className={`h-[14px] w-[14px] shrink-0 border ${echelle.silhouette ? "border-ancien-signal bg-ancien-signal" : "border-bord-fort"}`}
              />
              {echelle.silhouette ? "il se découpe" : "plein cadre, pas de découpe"}
            </button>
          </li>
        ))}
      </ul>

      {/* **Montré grisé plutôt que caché** : on apprend qu'il existe, et on sait
          pourquoi il n'est pas là. C'est déjà la règle du produit pour tout ce
          qui est indisponible. */}
      {/* **Le compte se lit sur le projet ouvert** (G1). « Les huit types »
          était juste le jour de son écriture ; un huitième est entré dans le
          barème livré le 31 août, et la phrase annonçait alors huit types à un
          auteur qui en voyait sept — ou l'inverse, selon son jeu. Le barème est
          juste au-dessus, dans la même étape : le compter est gratuit, et il ne
          peut plus mentir. */}
      <button
        type="button"
        disabled
        className="mesure h-[26px] self-start px-2 text-[10px] text-texte-3"
      >
        + type sur mesure — plus tard, les {univers.bareme.length} types de ce
        jeu couvrent ce qu'on sait faire
      </button>
    </EtapeOuverte>
  )
}

/** Les deux cases qui décrivent **le cadre**, et non la matière.
 *
 *  La frontière passe exactement là où elle était déjà dans l'ordre des sept ;
 *  elle n'avait simplement jamais rien fait. Elle fait maintenant trois choses :
 *  sur une **reprise**, seules les cinq cases de matière partent — la pièce
 *  ajoutée a besoin de savoir qu'elle est naine et forgée, pas qu'on lui redise
 *  l'angle de caméra que la feuille montre déjà et que la consigne interdit de
 *  changer. **Une ambiance ne peut toucher qu'à la matière.** Et **aucune
 *  étiquette n'y est livrée** : ces deux cases se choisissent deux étapes plus
 *  haut, avec une vignette, et un second endroit qui règle la même chose finit
 *  toujours par la contredire. */
const CADRE = ["vue", "technique"] as const

/** Les sept cases de la bible, **posées en questions**.
 *
 *  Un nom de champ ne se répond pas ; une question, si. C'est le seul
 *  changement de vocabulaire de l'étape, et il ne coûte rien : `NOM_CHAMP`
 *  reste ce que le reste du produit affiche — la fiche d'une chose, l'écran de
 *  confirmation —, où l'on lit un intitulé plutôt qu'on ne remplit un champ. */
const QUESTIONS: Record<string, string> = {
  monde: "Où ça se passe",
  epoque: "À quelle époque",
  rendu: "Comment c'est dessiné",
  trait: "Le trait et les aplats",
  eclairage: "La lumière",
  vue: "D'où l'on regarde",
  technique: "Comment l'image est calée",
}

/** L'aide de chaque question, en une phrase — elle paraît sous la question
 *  ouverte et nulle part ailleurs.
 *
 *  **Une fonction et non plus une table**, depuis `G1` : deux de ces phrases
 *  renvoient vers une autre étape, et une étape se désigne par son nom et son
 *  rang **calculés** (`G1`). Écrites à la main, elles annonçaient la deuxième
 *  et la troisième là où il faut lire la troisième et la quatrième. */
function aideDeLaCase(nom: string, style: Style): string {
  const cases: Record<string, string> = {
    monde: "Le lieu et l'univers du jeu — ce qu'on verrait en regardant autour de soi.",
    // **Ce qu'elle fait, et pas ce qu'elle déciderait à ta place** (G1). La
    // phrase d'avant disait qu'elle « décide des armes, des vêtements et des
    // outils » : c'est toi qui les décides, en les écrivant. Elle, elle pose un
    // moment technologique, et c'est tout ce qu'elle fait.
    epoque:
      "Le moment technologique du jeu — ce qui existe déjà, et ce qui n'existe pas encore. Elle ne choisit rien à ta place : elle empêche une arbalète de ressortir avec une lunette de visée.",
    rendu:
      "La technique de dessin — pas le sujet, la manière. C'est la case qui décide si ton jeu ressemble à du 16 bits, à de l'aquarelle ou à du papier découpé.",
    trait: "Comment les formes sont bordées et remplies : un contour ou pas, des aplats ou des dégradés.",
    eclairage: "D'où vient la lumière et de quelle couleur elle est. C'est ce qui donne l'heure et l'humeur.",
    vue: `Écrite par ${laDesignation("vue", style)}. On la lit ici, on la choisit là-bas — sur une vignette.`,
    technique: `Écrite par ${laDesignation("taille", style)}. On la lit ici, on la choisit là-bas — sur la règle des tailles.`,
  }
  return cases[nom] ?? ""
}

const PLACEHOLDERS: Record<string, string> = {
  monde: "royaume de tourbe et de fer, marais au nord",
  epoque: "haut moyen âge, avant la poudre",
  rendu: "pixel art 16 bits, palette limitée",
  trait: "contour brun d'un pixel, aplats, pas de dégradé",
  eclairage: "lumière rasante, ombres portées courtes",
  vue: "",
  technique: "",
}

/**
 * L'étape « L'allure » — sept questions qui s'ouvrent une à une.
 *
 * **La plus longue des dix, et celle qui pèse le plus lourd** : sur une
 * génération payée, ces sept cases représentent 890 caractères sur 1 690 — 53 %
 * du texte envoyé — quand le sujet tapé en fait 40, soit 2 %. La description
 * pèse vingt-deux fois le sujet ; ce qu'elle dit de travers, elle le dit fort.
 *
 * **Elle éditait le même texte à deux endroits, et le commentaire du fichier
 * annonçait le contraire.** Le bloc *Bible* avait une zone de saisie par case ;
 * le bloc des étiquettes en avait une de plus, intitulée *ce qui partira*. Le
 * code disait pourtant : « un second contrôle du même texte aurait fait deux
 * endroits qui règlent la même chose ». Il y en avait deux. **Il n'y en a plus
 * qu'un**, et l'interrupteur de la case est descendu sur sa rangée.
 *
 * **Et la liste d'étiquettes n'est plus vide.** Trois lignes de l'écran disaient
 * la même absence — `disponibles — 0 dans la base`, la phrase qui l'expliquait,
 * et une zone de saisie à `0 caractère`. Soixante-dix paires arrivent désormais
 * avec l'atelier (`docs/etiquettes-livrees.md`).
 */
function LAllure({
  univers,
  etiquettes,
  onEtiquettes,
  onRegler,
  onErreur,
}: {
  univers: Univers
  etiquettes: Etiquette[]
  onEtiquettes: (etiquettes: Etiquette[]) => void
  onRegler: (bible: { nom: string; texte: string; actif: boolean }[]) => Promise<boolean>
  onErreur: (raison: string) => void
}) {
  const [ouverte, setOuverte] = useState<string>("")
  const [cherche, setCherche] = useState("")
  const [neuve, setNeuve] = useState<{ libelle: string; texte: string } | null>(null)
  const [brouillon, setBrouillon] = useState(univers.bible)

  useEffect(() => setBrouillon(univers.bible), [univers.bible])

  /** **Le seul endroit de l'univers qui tienne un brouillon**, parce qu'il porte
   *  du texte qu'on tape. Refusé, le brouillon revient à ce que le projet
   *  porte : sans ça l'écran resterait sur la valeur tentée, celle que le
   *  fichier ne connaît pas. */
  const poser = async (suivante: typeof univers.bible) => {
    setBrouillon(suivante)
    if (!(await onRegler(suivante))) setBrouillon(univers.bible)
  }

  const cadre = (nom: string) => CADRE.includes(nom as (typeof CADRE)[number])

  const disponibles = etiquettes
    .filter((e) => e.case === ouverte)
    .filter((e) => e.libelle.toLowerCase().includes(cherche.trim().toLowerCase()))
    .sort((a, b) => b.emplois - a.emplois)

  const actives = brouillon.filter((c) => c.actif && c.texte.trim()).length

  return (
    <EtapeOuverte
      aide="univers.bible"
      titre="L'allure"
      conduite={
        <>
          {/* **La proportion a disparu de la phrase, elle n'y reviendra pas**
              (G1). Elle disait « plus de la moitié du texte » ; c'était juste
              le jour où elle a été écrite, et le bloc caméra l'a démentie le
              soir même en ajoutant cinq cents caractères ailleurs. Un rapport
              entre deux textes qui bougent chacun de leur côté ne peut pas être
              tenu à jour à la main, et le calculer ici demanderait d'assembler
              le prompt entier pour afficher une phrase d'introduction. Ce qui
              reste est ce qui ne bouge pas : **c'est le bloc le plus lourd**. */}
          Sept questions sur l'univers de ton jeu. C'est le bloc le plus lourd de
          ce qui part au modèle, et donc{" "}
          <strong className="text-texte">
            ce qui décide le plus de ce que tu recevras
          </strong>
          . <strong className="text-texte">Clique plutôt que d'écrire</strong> :
          chaque étiquette pose une formule qui marche.
        </>
      }
    >
      <ul className="flex flex-col overflow-hidden rounded-[2px] border border-bord bg-fond-1">
        {brouillon.map((champ, rang) => {
          const question = QUESTIONS[champ.nom] ?? NOM_CHAMP[champ.nom] ?? champ.nom
          const est_ouverte = ouverte === champ.nom
          // **On regarde la forme avant de s'y fier** : un serveur plus vieux
          // que l'écran répond 200 sans se plaindre, et il ne connaît pas
          // encore les phrases que l'atelier écrit lui-même. C'est le piège que
          // E3 a payé, et il se paie ici en écran blanc.
          const atelier = (univers.phrases ?? {})[champ.nom] ?? ""
          const porte = champ.actif && Boolean(champ.texte.trim() || atelier)
          return (
            <li key={champ.nom} className="border-b border-bord last:border-b-0">
              <button
                type="button"
                aria-expanded={est_ouverte}
                aria-label={question}
                onClick={() => {
                  setOuverte(est_ouverte ? "" : champ.nom)
                  setCherche("")
                  setNeuve(null)
                }}
                className={[
                  "flex h-[38px] w-full items-center gap-3 px-3 text-left transition-colors duration-[80ms]",
                  est_ouverte ? "bg-fond-2" : "hover:bg-fond-2",
                ].join(" ")}
              >
                <span
                  className={`mesure w-[14px] shrink-0 text-[10px] ${est_ouverte ? "text-ancien-signal" : "text-texte-3"}`}
                >
                  {rang + 1}
                </span>
                <span
                  className={
                    est_ouverte
                      ? "min-w-0 flex-1 text-[14px] text-texte"
                      : "min-w-0 flex-1 text-[13px] text-texte-2"
                  }
                >
                  {question}
                </span>
                {/* **Une rangée fermée dit ce qu'elle porte** — le début du
                    texte, tronqué, en mono. On lit sa description entière sans
                    rien ouvrir, ce que ni le bloc replié ni les segments ne
                    permettaient. */}
                {!est_ouverte && (
                  <span className="mesure max-w-[38ch] truncate text-[10px] text-texte-3">
                    {champ.texte.trim() || atelier}
                  </span>
                )}
                <span className="mesure w-[14px] shrink-0 text-right text-[11px] text-ancien-ok">
                  {porte ? "✓" : ""}
                </span>
              </button>

              {est_ouverte && (
                <div className="flex flex-col gap-3 border-b border-bord bg-fond-2 px-3 pb-4 pl-9">
                  <p className="max-w-[64ch] text-[13px] text-texte-2">
                    {aideDeLaCase(champ.nom, univers.style)}
                  </p>

                  {/* **L'interrupteur de la case est ici, et nulle part
                      ailleurs.** « Doser ce qui contraint » est un geste qu'on
                      fait en regardant ce qu'on relâche. */}
                  <button
                    type="button"
                    aria-pressed={champ.actif}
                    aria-label={`${question} — ${champ.actif ? "part avec chaque génération" : "ne part pas"}`}
                    onClick={() =>
                      void poser(
                        brouillon.map((c, i) =>
                          i === rang ? { ...c, actif: !c.actif } : c,
                        ),
                      )
                    }
                    className={[
                      "flex h-[26px] w-fit items-center gap-2 rounded-[2px] border px-2 text-[11.5px] transition-colors duration-[80ms]",
                      champ.actif
                        ? "border-ancien-signal bg-ancien-signal/13 text-ancien-signal"
                        : "border-bord bg-fond-1 text-texte-3 hover:bg-fond-3",
                    ].join(" ")}
                  >
                    <span aria-hidden className="mesure text-[10px]">
                      {champ.actif ? "●" : "○"}
                    </span>
                    {champ.actif
                      ? "part avec chaque génération"
                      : "ne part pas"}
                  </button>

                  {/* ── Les étiquettes de cette case ─────────────────────── */}
                  {cadre(champ.nom) ? (
                    <Raison
                      texte={
                        champ.nom === "vue"
                          ? `cette case est écrite par ${laDesignation("vue", univers.style)} — on la choisit sur une vignette, pas en mots`
                          : `cette case est écrite par ${laDesignation("taille", univers.style)} — on la choisit sur la règle des tailles`
                      }
                    />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Libelle aide="assistant.etiquettes">
                        à cliquer — {disponibles.length} étiquette
                        {disponibles.length > 1 ? "s" : ""}
                      </Libelle>
                      {etiquettes.filter((e) => e.case === champ.nom).length > 6 && (
                        <input
                          value={cherche}
                          aria-label={`Rechercher une étiquette de ${question.toLowerCase()}`}
                          placeholder="rechercher…"
                          onChange={(e) => setCherche(e.target.value)}
                          className="mesure h-[26px] w-full max-w-[260px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte"
                        />
                      )}
                      {/* **Une base vide le dit franchement.** Soixante-dix
                          paires arrivent avec l'atelier, mais une case peut
                          n'en avoir aucune qui reste — on les oublie une à une
                          —, et trois lignes qui répètent la même absence ne
                          valent pas une phrase qui dit quoi faire. */}
                      {disponibles.length === 0 && (
                        <Raison
                          texte={
                            cherche.trim()
                              ? "rien qui porte ces lettres — le texte se tape aussi à la main, juste en dessous"
                              : "rien dans la base pour cette case — fabriques-en une, et elle servira à tous tes jeux"
                          }
                        />
                      )}
                      <ul className="flex flex-wrap gap-[5px]">
                        {disponibles.map((etiquette) => (
                          <li key={etiquette.identifiant}>
                            <button
                              type="button"
                              title={etiquette.texte}
                              onClick={() => {
                                const deja = champ.texte.trim()
                                void poser(
                                  brouillon.map((c, i) =>
                                    i === rang
                                      ? {
                                          ...c,
                                          texte: deja
                                            ? `${deja}, ${etiquette.texte}`
                                            : etiquette.texte,
                                        }
                                      : c,
                                  ),
                                )
                                void api
                                  .etiquetteServie(etiquette.identifiant)
                                  .then((recu) => onEtiquettes(recu.etiquettes))
                                  .catch(() => undefined)
                              }}
                              className={[
                                "flex h-[24px] items-center rounded-[2px] border bg-fond-1 px-[9px] text-[11.5px] transition-colors duration-[80ms] hover:text-ancien-signal",
                                // **Ce qui vient de l'auteur porte l'ambre**,
                                // comme le modèle réglé à la main et
                                // l'occupation épinglée d'un asset. Aucun
                                // vocabulaire neuf.
                                etiquette.livree
                                  ? "border-bord text-texte-2"
                                  : "border-epingle text-epingle",
                              ].join(" ")}
                            >
                              {etiquette.libelle}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setNeuve({ libelle: "", texte: "" })}
                        className="mesure h-6 self-start text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
                      >
                        + fabriquer une étiquette
                      </button>
                      {neuve && (
                        <div className="flex max-w-[420px] flex-col gap-1 border-t border-bord pt-2">
                          <input
                            value={neuve.libelle}
                            aria-label="Le libellé français"
                            placeholder="le libellé, en français — « brume basse »"
                            onChange={(e) =>
                              setNeuve({ ...neuve, libelle: e.target.value })
                            }
                            className="h-[26px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[11.5px] text-texte"
                          />
                          <input
                            value={neuve.texte}
                            aria-label="Le texte anglais qui partira"
                            placeholder="le texte anglais qui partira — « thick low-lying fog »"
                            onChange={(e) =>
                              setNeuve({ ...neuve, texte: e.target.value })
                            }
                            className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte"
                          />
                          <button
                            type="button"
                            disabled={!neuve.libelle.trim() || !neuve.texte.trim()}
                            onClick={() =>
                              void api
                                .fabriquerEtiquette(
                                  neuve.libelle,
                                  neuve.texte,
                                  champ.nom,
                                )
                                .then((recu) => {
                                  onEtiquettes(recu.etiquettes)
                                  setNeuve(null)
                                })
                                .catch((erreur) => onErreur(String(erreur)))
                            }
                            className="mesure h-6 self-start text-[10px] text-ancien-signal hover:text-ancien-signal-clair disabled:text-texte-3"
                          >
                            la fabriquer ›
                          </button>
                          <Raison texte="elle rejoint la base pour tous les jeux de l'atelier — comme la clé du fournisseur, elle ne dépend d'aucun" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Ce qui partira ───────────────────────────────────── */}
                  <div className="flex flex-col gap-1">
                    <Libelle>
                      ce qui partira — {(atelier ? atelier.length + 2 : 0) + champ.texte.trim().length}{" "}
                      caractères
                    </Libelle>
                    {/* **La phrase de l'atelier, en ambre, hors du champ de
                        saisie** — c'est la grille, le calage ou le cadrage, et
                        elle se calcule depuis la taille et la vue. Rangée dans
                        le texte, elle cessait de suivre le réglage dès qu'un mot
                        s'ajoutait à côté d'elle : une seule étiquette cliquée
                        gelait la grille pour toujours. */}
                    {atelier && (
                      <p className="mesure rounded-[2px] border border-bord bg-fond-1 px-2 py-1 text-[10px] leading-relaxed text-epingle">
                        {atelier}
                        <span className="ml-2 text-texte-3">
                          — écrit par l'atelier, depuis l'étape{" "}
                          {champ.nom === "vue" ? "2" : "3"}
                        </span>
                      </p>
                    )}
                    {!cadre(champ.nom) && (
                      <textarea
                        value={champ.texte}
                        aria-label={`Le texte de la case ${NOM_CHAMP[champ.nom] ?? champ.nom}`}
                        placeholder={PLACEHOLDERS[champ.nom] ?? ""}
                        rows={3}
                        onChange={(e) =>
                          setBrouillon(
                            brouillon.map((c, i) =>
                              i === rang ? { ...c, texte: e.target.value } : c,
                            ),
                          )
                        }
                        onBlur={() => void poser(brouillon)}
                        className={[
                          "mesure resize-none rounded-[2px] border border-bord bg-fond-1 p-2 text-[10px] leading-relaxed placeholder:text-texte-3",
                          champ.actif ? "text-texte" : "text-texte-3",
                        ].join(" ")}
                      />
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <Raison
        texte={`${actives} case${actives > 1 ? "s" : ""} sur ${brouillon.length} part${actives > 1 ? "ent" : ""} avec chaque génération`}
      />
    </EtapeOuverte>
  )
}

/** L'étape « Références et couleurs ».
 *
 *  **La palette est déduite par calcul, jamais saisie** (US-54). Montrée pour
 *  qu'on vérifie ce que la machine y a lu, et recalculée dès qu'on retire un
 *  artwork (US-55). Le seul réglage qu'on ait sur elle est le nombre de
 *  couleurs qu'on lui demande. */
function LesReferences({
  univers,
  artworks,
  vue,
  fondPropose,
  onRegler,
}: {
  univers: Univers
  artworks: Carte[]
  vue: VueDuJeu | null
  /** **Ce que l'atelier proposerait comme fond** (D3), `null` tant que le
   *  serveur n'a pas répondu. */
  fondPropose: FondPropose | null
  onRegler: Regler
}) {
  /** **Les paliers que cette taille-là peut porter** (D2). Le plafond est le
   *  côté du sprite : *« on ne peut pas avoir du 128 couleurs sur du 32px »*. */
  const paliers = paliersDeCouleurs(univers.cible_px)
  /** **C'est le style qui décide, plus la taille** (D2). La quantification
   *  n'entre qu'en pixel art : réduire les couleurs d'un dessin en ferait une
   *  affiche sérigraphiée. Une taille « aucune » en pixel art n'a pas non plus
   *  de palier à proposer, faute de grille où les compter. */
  const pixelArt = univers.style === "pixel" && univers.cible_px !== AUCUNE_CIBLE
  return (
    <EtapeOuverte
      aide="univers.palette"
      titre="Références et couleurs"
      conduite={
        <>
          Les couleurs du jeu ne se saisissent jamais :{" "}
          <strong className="text-texte">elles se calculent</strong> à partir
          des images que tu as promues en artworks officiels, sur le tableau
          d'inspiration.
        </>
      }
    >
      {univers.palette.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-[2px]">
            {univers.palette.map((couleur) => (
              <span
                key={couleur}
                title={couleur}
                style={{ background: couleur }}
                className="h-6 w-6 rounded-[2px] border border-bord"
              />
            ))}
          </div>
          <p className="mesure text-[10px] text-texte-3">
            {univers.palette.length} couleurs · lues sur {artworks.length}{" "}
            artwork{artworks.length > 1 ? "s" : ""}
          </p>
        </>
      ) : (
        /* **Ce n'est plus un refus, c'est une annonce** (D2). Jusqu'ici cette
           branche disait seulement « aucun artwork » et **cachait le réglage
           des couleurs** — or sans artwork le produit ne réduisait aucune
           couleur du tout, et les sprites sortaient à dix mille teintes sans
           qu'un mot le dise. Le réglage descend donc hors de cette condition :
           il agit dans les deux cas, il se montre dans les deux cas. */
        <div className="flex w-fit flex-col gap-1 rounded-[2px] border border-bord bg-fond-2 px-3 py-2">
          {/* **La même absence ne se raconte pas pareil selon le style** (D2).
              En pixel art, sans artwork les couleurs se réduisent quand même —
              image par image, faute de palette commune. En dessin elles ne se
              réduisent pas du tout : dire « elles se déduisent de chaque
              image » y promettrait un travail qui n'a pas lieu. */}
          <Raison
            texte={
              pixelArt
                ? "aucun artwork officiel — les couleurs se déduisent de chaque image, pas de la palette du jeu"
                : "aucun artwork officiel — le jeu n'a pas encore de palette à joindre en référence aux images qu'il demande"
            }
          />
          <Raison texte="pour que le jeu parle d'une seule voix : promeus une carte du tableau d'inspiration en artwork officiel, et la palette se lira dessus" />
        </div>
      )}
      {/* **Le nombre de couleurs, dans les deux cas** — avec palette il dit
          combien de teintes y lire, sans palette combien en garder sur chaque
          image. C'est le même réglage, et il agit des deux côtés. */}
      {pixelArt && (
        <div className="flex w-fit items-center gap-3 pt-1">
          <Libelle aide="univers.couleurs">Couleurs demandées</Libelle>
          <Segments
            valeurs={paliers}
            valeur={paliers.includes(univers.couleurs) ? univers.couleurs : paliers[paliers.length - 1]}
            onChange={(couleurs) => void onRegler({ couleurs })}
          />
        </div>
      )}
      {/* **Le plafond est le côté du sprite**, et il est mesuré : au-delà,
          l'image ne contient plus assez de teintes distinctes pour remplir la
          palette demandée. Dit ici pour qu'une liste courte ne se lise pas
          comme un bug. */}
      {pixelArt && paliers.length < PALIERS_DE_COULEURS.length && (
          <Raison
            texte={`un sprite de ${univers.cible_px} carrés de côté ne porte pas plus de ${paliers[paliers.length - 1]} couleurs — au-delà, l'image n'a plus assez de teintes distinctes`}
          />
        )}
      {!pixelArt && (
        <Raison texte="ce jeu est en dessin : les couleurs ne sont pas réduites, un dessin garde ses nuances" />
      )}
      <LeFondDuJeu
        univers={univers}
        propose={fondPropose}
        onRegler={onRegler}
      />
      <LeTexteACopier univers={univers} vue={vue} />
    </EtapeOuverte>
  )
}

/** **Le fond sur lequel le sujet est posé** (D3) — et pourquoi il est rangé ici.
 *
 *  Il vit sous la palette parce que c'est elle qui décide de sa sûreté : une
 *  couleur de fond est bonne quand **rien dans le jeu ne la contient**, et la
 *  palette est la seule liste qui dise ce que le jeu contient. Le proposer
 *  ailleurs aurait demandé de regarder deux écrans pour trancher une question.
 *
 *  **L'atelier propose, il n'impose jamais.** C'est l'arbitrage de l'auteur du
 *  2 septembre 2026, et c'est ce qui a retiré à cette tranche le banc de huit
 *  tirages qu'elle réclamait : si la couleur choisie donne un moins bon
 *  résultat, on la change en un geste et on le voit sur l'image suivante.
 *
 *  **Ce qu'un fond franc achète, dit avec ses mots.** Le produit demandait *un
 *  fond plat* sans dire lequel, et le modèle rendait un gris clair — c'est-à-dire
 *  une couleur que le sujet porte aussi, d'où le découpage à reprendre sur
 *  presque chaque image. */
function LeFondDuJeu({
  univers,
  propose,
  onRegler,
}: {
  univers: Univers
  propose: FondPropose | null
  onRegler: Regler
}) {
  const pose = univers.fond !== ""
  return (
    <div className="flex flex-col gap-2 border-t border-bord pt-3">
      <Libelle aide="univers.fond">Le fond du jeu</Libelle>
      <p className="max-w-[54ch] text-[14px] leading-[1.5] text-texte-2">
        Sur quelle couleur le sujet est demandé. Une couleur{" "}
        <strong className="text-texte">que rien dans ton jeu ne contient</strong>{" "}
        rend le découpage presque parfait ; un gris clair — ce que le modèle rend
        quand on ne dit rien — est aussi la couleur d'une joue, et le découpage la
        mange avec le fond.
      </p>
      <div className="flex items-center gap-2">
        {/* ⚠️ **Pas de sélecteur de couleur tant qu'aucun fond n'est posé**, et
            c'est une correction, pas un choix d'origine. Un `input type=color`
            n'a pas d'état vide : il *doit* porter une couleur, et il portait donc
            le magenta de la proposition — une pastille magenta juste à côté des
            mots « aucun fond posé ». Vu au navigateur le 3 septembre 2026, et
            c'est le piège déjà payé de la case qui ne change rien : un contrôle
            qui montre un état qu'il n'a pas est pire qu'un contrôle absent.
            Le damier est la réponse du produit à « pas de couleur » partout
            ailleurs — c'est lui qui dit la transparence d'un sprite détouré. */}
        {pose ? (
          <input
            type="color"
            value={univers.fond}
            aria-label="Couleur du fond"
            onChange={(e) => void onRegler({ fond: e.target.value })}
            className="h-[26px] w-[34px] shrink-0 rounded-[2px] border border-bord bg-fond-2"
          />
        ) : (
          // **Le damier reste cliquable**, et il le faut : quand aucun candidat
          // n'est sûr, le refus lui-même invite à en choisir une à la main.
          // Un carré seulement décoratif aurait fermé le seul chemin qui reste.
          // Le sélecteur s'ouvre donc dessous, transparent, sur la couleur
          // proposée — qu'il montre à l'ouverture sans la donner d'avance.
          <span className="damier relative h-[26px] w-[34px] shrink-0 overflow-hidden rounded-[2px] border border-bord">
            <input
              type="color"
              value={propose?.couleur || "#FF00FF"}
              aria-label="Couleur du fond"
              onChange={(e) => void onRegler({ fond: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </span>
        )}
        <span className="mesure text-[10px] text-texte-2">
          {pose ? univers.fond : "aucun fond posé"}
        </span>
        {pose && (
          <button
            type="button"
            onClick={() => void onRegler({ fond: "" })}
            className="mesure h-[26px] text-[10px] text-texte-3 hover:text-texte"
          >
            Retirer
          </button>
        )}
      </div>
      {/* **La proposition, et l'écart qui la porte.** Un chiffre nu ne se lit
          pas : « à 192 de la couleur de ton jeu la plus proche » dit à la fois
          ce qu'on gagne et sur quoi le calcul a porté. */}
      {propose?.couleur && propose.couleur !== univers.fond && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onRegler({ fond: propose.couleur })}
            style={{ background: propose.couleur }}
            aria-label={`Prendre ${propose.couleur}`}
            className="h-4 w-4 shrink-0 rounded-[2px] border border-bord"
          />
          <button
            type="button"
            onClick={() => void onRegler({ fond: propose.couleur })}
            className="mesure text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
          >
            Prendre {propose.nom || propose.couleur}
          </button>
          <span className="mesure text-[10px] text-texte-3">
            à {propose.ecart} de {propose.voisine}, la couleur de ton jeu la plus
            proche
          </span>
        </div>
      )}
      {/* **Aucun candidat sûr est une réponse, pas une panne** — et l'atelier le
          dit au lieu de choisir en silence. C'est le quatrième critère de la
          tranche, pris à la lettre. */}
      {propose?.raison && <Raison texte={propose.raison} />}
      {pose && (
        <Raison texte="la couleur part dans le texte, et une phrase interdit au modèle de l'employer sur le sujet — sur sa tenue, sa peau, ses cheveux, ses accessoires, ses reflets et ses ombres" />
      )}
      {/* ⚠️ **Le prix, dit une fois et écrit** : changer le fond change ce qui
          part au fournisseur, donc les images d'avant et d'après ne se comparent
          plus. C'est un prix accepté, pas un oubli. */}
      {pose && (
        <Raison texte="⚠ changer le fond change ce qui part : les images tirées avant ne se comparent plus à celles d'après" />
      )}
    </div>
  )
}

/** L'étape « Références et couleurs », seconde moitié — le texte à copier
 *  dans un outil d'images.
 *
 *  **Il répond à un vrai problème : on n'a pas toujours d'images à déposer.** Un
 *  jeu qui démarre n'a que des mots. L'assistant assemble donc, à partir des
 *  étapes précédentes, un texte tout prêt à coller dans n'importe quel outil
 *  grand public — on récupère quatre images, on en garde une ou deux, on les
 *  dépose ici. **Rien n'est payé par l'atelier.**
 *
 *  L'atelier a bien de quoi générer lui-même, mais chaque image se paierait
 *  avant même que le jeu existe, et sur un modèle choisi à un moment où l'auteur
 *  n'a encore rien réglé. Et il a une seconde vertu : c'est la première fois
 *  qu'on voit sa description **assemblée** — beaucoup de contradictions se
 *  remarquent là. */
function LeTexteACopier({
  univers,
  vue,
}: {
  univers: Univers
  vue: VueDuJeu | null
}) {
  const [copie, setCopie] = useState(false)
  const lignes = [
    "I am designing a 2D game. Here is what I know so far.",
    "",
    ...(vue ? [`View: ${vue.phrase}`] : []),
    ...(univers.cible_px ? [`Sprite size: ${univers.cible_px} x ${univers.cible_px} pixels`] : []),
    ...univers.bible
      .filter((c) => c.texte.trim())
      .map((c) => `${NOM_CHAMP[c.nom] ?? c.nom}: ${c.texte.trim()}`),
    "",
    // **Trois manières de penser la scène, et non trois températures de
    // couleur** (G1). La demande d'avant faisait rendre quatre fois la même
    // image dans quatre teintes : on choisissait un filtre, pas une direction.
    // Ce qu'on cherche à ce moment-là est justement l'inverse — voir plusieurs
    // façons d'habiter le même monde avant d'en retenir une.
    "Produce one key image that captures the mood of this game, plus three",
    "variants that each take a genuinely different approach to the same scene —",
    "different composition, different moment, different mood. A single scene,",
    "not a grid. No text, no interface elements, landscape format.",
  ]
  const texte = lignes.join("\n")

  return (
    <section className="flex flex-col gap-2 border-t border-bord pt-4">
      <Libelle aide="assistant.texte">Le texte à copier — pour ne pas partir de rien</Libelle>
      <p className="max-w-[66ch] text-[14px] leading-normal text-texte-2">
        Colle-le dans ChatGPT, Midjourney ou tout autre outil d'images, puis
        dépose ici ce qui te plaît.{" "}
        <strong className="text-texte">Rien n'est payé par l'atelier</strong> :
        c'est la première fois qu'on voit sa description assemblée, et beaucoup
        de contradictions se remarquent là.
      </p>
      <pre className="mesure defile max-h-[220px] max-w-[720px] overflow-auto rounded-[2px] border border-bord bg-fond-2 p-2 text-[10px] whitespace-pre-wrap text-texte-2">
        {texte}
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(texte)
          setCopie(true)
        }}
        className="mesure h-[34px] self-start rounded-[2px] border border-bord-fort px-3 text-[11.5px] text-texte-2 hover:text-ancien-signal"
      >
        {copie ? "copié" : "copier"}
      </button>
    </section>
  )
}

/** L'étape « Poses et états » — ce que les choses font, **type par type** (E9).
 *
 *  Une pose, c'est un moment d'un objet : un personnage au repos, en marche,
 *  qui attaque ; un coffre fermé, ouvert, vidé. **Le nombre d'images de chaque
 *  pose vient du choix de vue**, à l'étape « La vue » : il ne se tape plus à la main, et
 *  c'est ce qui répare les sept endroits qui ne se parlaient pas.
 *
 *  **La liste appartient au type d'objet, plus au jeu entier** (E9). Avant, le
 *  jeu déclarait une seule liste et tout la recevait : un coffre héritait de
 *  *marche* et de *course*, qu'il fallait ranger une par une, sur chaque
 *  coffre. Chaque rangée dit donc d'où sa liste lui vient — écrite ici, proposée
 *  par l'atelier, ou partagée avec le jeu — parce qu'une liste héritée ne doit
 *  pas avoir l'air d'une liste choisie.
 *
 *  **Et le produit `poses × images` s'affiche**, ce qui n'était nulle part : le
 *  compte existait pose par pose et jamais en somme, alors que c'est lui qu'on
 *  vient chercher — c'est lui qui devient une facture. */
function LesPoses({
  univers,
  vue,
  onErreur,
}: {
  /** **Seulement pour nommer une autre étape** (G1) : la quatrième en porte
   *  deux noms selon le style, et un renvoi qui se calcule a besoin de savoir
   *  lequel est affiché. Rien d'autre de cette étape-ci n'en dépend. */
  univers: Univers
  vue: VueDuJeu | null
  onErreur: (raison: string) => void
}) {
  const [plan, setPlan] = useState<Pose[]>([])
  const [types, setTypes] = useState<PosesDesTypes["types"]>([])
  // Quelle rangée est dépliée. **De l'écran, jamais du jeu** : ouvrir un type
  // ne change rien.
  const [ouvert, setOuvert] = useState("")

  const fondre = (recu: PosesDesTypes | undefined) => {
    setTypes(recu?.types ?? [])
    setPlan(recu?.plan ?? [])
  }

  useEffect(() => {
    void api
      .posesDesTypes()
      .then(fondre)
      .catch(() => fondre(undefined))
  }, [])

  const echouer = (erreur: unknown) => onErreur(String(erreur))
  const parPose = vue?.images ?? 1
  const total = types.reduce(
    (somme, type) =>
      somme + type.poses.reduce((n, p) => n + (p.images || parPose), 0),
    0,
  )

  return (
    <EtapeOuverte
      aide="assistant.poses"
      titre="Poses et états"
      conduite={
        <>
          Un personnage est <strong className="text-texte">au repos</strong>, il{" "}
          <strong className="text-texte">marche</strong>, il{" "}
          <strong className="text-texte">attaque</strong>. Un coffre est{" "}
          <strong className="text-texte">fermé</strong>,{" "}
          <strong className="text-texte">ouvert</strong>,{" "}
          <strong className="text-texte">vidé</strong>. Une tuile ne fait rien du
          tout. Chacun de ces moments est une image à fabriquer — c'est ici qu'on
          dit lesquels.
        </>
      }
    >
      {/* **Le produit est le fait de l'étape.** Ajouter une pose ajoute N
          images ; changer de vue les multiplie toutes. C'est le nombre qui
          devient une facture, et il n'était nulle part. */}
      <div className="flex w-fit items-stretch overflow-hidden rounded-[2px] border border-bord bg-fond-1">
        <span className="flex flex-col gap-1 px-4 py-3">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            poses déclarées
          </span>
          <span className="mesure text-[22px] text-texte">
            {types.reduce((n, t) => n + t.poses.length, 0)}
          </span>
        </span>
        <span className="mesure flex items-center border-l border-bord px-3 text-[15px] text-texte-3">
          ×
        </span>
        <span className="flex flex-col gap-1 border-l border-bord px-4 py-3">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            images par pose
          </span>
          <span className="mesure text-[22px] text-texte">{parPose}</span>
        </span>
        <span className="mesure flex items-center border-l border-bord px-3 text-[15px] text-texte-3">
          =
        </span>
        <span className="flex flex-col gap-1 border-l border-bord bg-fond-2 px-4 py-3">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            images à fabriquer
          </span>
          <span className="mesure text-[22px] text-ancien-signal">{total}</span>
        </span>
      </div>
      <Raison
        texte={
          vue
            ? `le second nombre vient de la vue du jeu — ${vue.libelle} —, choisie à ${laDesignation("vue", univers.style)}, et ne se tape pas ici`
            : `aucune vue choisie — c'est ${laDesignation("vue", univers.style)} qui décide du nombre d'images par pose`
        }
      />

      {/* **Le plan du jeu en premier, et il n'a pas disparu.** C'est ce que
          suivent le personnage, la créature, et toutes les choses créées avant
          que les types aient leur liste — c'est ce qui les reprend sans perte.
          Le cacher aurait rendu ces choses-là irréglables. */}
      <ListeDePoses
        titre="Le plan du jeu"
        raison="ce que suivent le personnage, la créature, et les choses sans type"
        poses={plan}
        images={parPose}
        onAjouter={(nom, images) =>
          void api
            .ajouterPose(nom, images)
            .then((recu) => setPlan(recu.plan))
            .catch(echouer)
        }
        onRetirer={(pose) =>
          void api
            .retirerPose(pose)
            .then((recu) => setPlan(recu?.plan ?? []))
            .catch(echouer)
        }
      />

      <ul className="flex flex-col rounded-[2px] border border-bord">
        {types.map((type) => {
          const images = type.poses.reduce((n, p) => n + (p.images || parPose), 0)
          return (
            <li key={type.nom} className="border-b border-bord last:border-b-0">
              <button
                type="button"
                aria-pressed={ouvert === type.nom}
                aria-label={type.nom}
                onClick={() => setOuvert(ouvert === type.nom ? "" : type.nom)}
                className={[
                  "mesure flex h-[26px] w-full items-center gap-2 px-2 text-left text-[10px] transition-colors duration-[80ms]",
                  ouvert === type.nom ? "bg-fond-3" : "hover:bg-fond-2",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte">
                  {type.nom}
                </span>
                <span className="shrink-0 text-texte-3">
                  {type.poses.length === 0
                    ? "aucune pose"
                    : `${type.poses.length} pose${type.poses.length > 1 ? "s" : ""} · ${images} image${images > 1 ? "s" : ""}`}
                  {" · "}
                  {ORIGINE_DU_TYPE[type.origine]}
                </span>
              </button>

              {ouvert === type.nom && (
                <div className="flex flex-col gap-2 px-2 pb-2">
                  <ListeDePoses
                    raison={RAISON_ORIGINE[type.origine]}
                    poses={type.poses}
                    images={parPose}
                    // **Écrire ici donne à ce type sa propre liste**, et le
                    // texte le dit avant qu'on écrive : une liste partagée qui
                    // se détache d'un jeu sans prévenir serait une surprise, et
                    // le produit constate plutôt qu'il ne surprenne.
                    onAjouter={(nom, images) =>
                      void api
                        .poserPosesDuType(type.nom, [
                          ...type.poses,
                          {
                            identifiant: identifiantDePose(nom, type.poses),
                            nom,
                            images,
                            // **Vide, et c'est une valeur** (E10) : le produit
                            // ne traduit pas en anglais le nom qu'on vient de
                            // taper. C'est alors le nom qui part, et l'écran le
                            // dit.
                            consigne: "",
                            ecartees: [],
                            images_avant: 0,
                          },
                        ])
                        .then(fondre)
                        .catch(echouer)
                    }
                    onRetirer={(pose) =>
                      void api
                        .poserPosesDuType(
                          type.nom,
                          type.poses.filter((p) => p.identifiant !== pose),
                        )
                        .then(fondre)
                        .catch(echouer)
                    }
                  />

                  {/* **Revenir à la liste proposée** — et seulement quand il y a
                      quelque chose à défaire. Sans ce geste, un type ne pourrait
                      jamais y revenir : il faudrait la retaper de mémoire, et la
                      moindre faute de frappe ferait une case orpheline. */}
                  {type.origine === "écrite" && (
                    <button
                      type="button"
                      onClick={() =>
                        void api
                          .oublierPosesDuType(type.nom)
                          .then(fondre)
                          .catch(echouer)
                      }
                      title="les images ne bougent pas — elles gardent l'identifiant de leur pose"
                      className="mesure self-start px-1 text-[9.5px] text-texte-3 hover:text-ancien-signal"
                    >
                      revenir à la liste proposée
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </EtapeOuverte>
  )
}

/** Ce que la rangée d'un type dit de sa liste, en un mot. */
const ORIGINE_DU_TYPE: Record<string, string> = {
  écrite: "écrite ici",
  connue: "proposée",
  projet: "celle du jeu",
}

/** Et la même chose en une phrase, sous la liste dépliée. */
const RAISON_ORIGINE: Record<string, string> = {
  écrite: "cette liste a été écrite pour ce type — elle ne suit plus rien d'autre",
  connue: "ce que l'atelier propose pour ce type — l'écrire ici lui donnera la sienne",
  projet:
    "ce type suit le plan du jeu — écrire ici lui donnera sa propre liste, qui cessera de le suivre",
}

/** L'identifiant d'une pose neuve, **calculé où on l'écrit**.
 *
 *  Le serveur en fabrique un quand on nomme une pose du jeu ; ici c'est une
 *  liste entière qui part, et il faut donc en poser un. Les accents tombent,
 *  les espaces deviennent des tirets, et un doublon reçoit un numéro — la même
 *  règle que `repere` côté serveur, sur le seul point où elle doit s'accorder :
 *  deux poses de même identifiant seraient deux lignes que la matrice ne
 *  saurait pas distinguer. */
function identifiantDePose(nom: string, deja: Pose[]): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pose"
  const prises = new Set(deja.map((p) => p.identifiant))
  if (!prises.has(base)) return base
  let rang = 2
  while (prises.has(`${base}-${rang}`)) rang += 1
  return `${base}-${rang}`
}

/** Une liste de poses qui se lit, se complète et se raccourcit.
 *
 *  Écrite une fois et servie deux — au plan du jeu et à chaque type —, parce
 *  que ces deux listes n'ont aucune raison de se lire différemment. Ce qui
 *  change entre elles est **où l'écriture part**, et c'est l'appelant qui le
 *  décide. */
function ListeDePoses({
  titre,
  raison,
  poses,
  images,
  onAjouter,
  onRetirer,
}: {
  titre?: string
  raison: string
  poses: Pose[]
  /** Ce qu'une pose neuve demandera — **le choix de vue**, jamais un nombre
   *  tapé ici. C'est le lien qui répare les sept endroits qui divergeaient. */
  images: number
  onAjouter: (nom: string, images: number) => void
  onRetirer: (pose: string) => void
}) {
  const [neuve, setNeuve] = useState("")

  return (
    <div className="flex max-w-[560px] flex-col gap-1">
      {titre && <Libelle>{titre}</Libelle>}
      <Raison texte={raison} />
      {poses.length === 0 ? (
        // **Aucune pose est une réponse, pas un trou** : un décor et une tuile
        // ne bougent pas, ils se raccordent. La phrase le dit plutôt que de
        // laisser une liste vide passer pour un oubli.
        <p className="mesure text-[10px] leading-4 text-texte-3">
          aucune pose — une seule image remplit ce type
        </p>
      ) : (
        <ul className="flex flex-col">
          {poses.map((pose) => (
            <li
              key={pose.identifiant}
              className="mesure flex h-[26px] items-center gap-2 text-[11.5px] text-texte-2"
            >
              <span className="min-w-0 flex-1 truncate">{pose.nom}</span>
              <span className="text-[10px] text-texte-3">
                {pose.images} image{pose.images > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                aria-label={`Retirer ${pose.nom}`}
                onClick={() => onRetirer(pose.identifiant)}
                className="shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={neuve}
          aria-label={titre ? "Une pose de plus" : `Une pose de plus — ${raison}`}
          placeholder="une pose de plus…"
          onChange={(e) => setNeuve(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && neuve.trim()) {
              onAjouter(neuve.trim(), images)
              setNeuve("")
            }
          }}
          className="h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11.5px] text-texte"
        />
        <button
          type="button"
          disabled={!neuve.trim()}
          onClick={() => {
            onAjouter(neuve.trim(), images)
            setNeuve("")
          }}
          className="mesure h-[26px] shrink-0 px-2 text-[10px] text-ancien-signal hover:text-ancien-signal-clair disabled:text-texte-3"
        >
          + ajouter
        </button>
      </div>
    </div>
  )
}

/** L'étape « Emplacements » — les emplacements d'équipement.
 *
 *  **« L'ordre compte » n'était pas une phrase, et l'ordre ne se changeait
 *  pas.** Cette demi-phrase énonçait une règle au-dessus d'une liste qui
 *  n'offrait que *retirer* et *ajouter* : le serveur sait pourtant reclasser —
 *  `reglerEmplacement` accepte un rang — et **aucun écran de l'interface ne
 *  l'appelait**. L'étape énonçait donc une règle sur une chose qu'elle ne
 *  permettait pas de faire.
 *
 *  **Deux flèches plutôt qu'un glissé** : le glisser-déposer appartient à la
 *  toile, où l'on place à main levée. Ici l'ordre est une liste de six lignes, et
 *  deux boutons de 24 px sont plus rapides, atteignables au clavier, et
 *  n'exigent aucun apprentissage.
 *
 *  **Proposée seulement si un type à silhouette existe** : un jeu de tuiles et
 *  de décors n'équipe personne, et lui montrer une liste vide serait lui
 *  demander de comprendre pourquoi elle l'est. */
function LesEmplacements({
  univers,
  onErreur,
}: {
  univers: Univers
  onErreur: (raison: string) => void
}) {
  const [emplacements, setEmplacements] = useState<EmplacementCorps[]>([])
  const [neuf, setNeuf] = useState("")
  const equipe = univers.bareme.some((e) => e.silhouette)

  useEffect(() => {
    void api
      .production()
      .then((recu) => setEmplacements(recu?.emplacements ?? []))
      .catch(() => setEmplacements([]))
  }, [])

  const echouer = (erreur: unknown) => onErreur(String(erreur))

  /** Échanger deux rangs. **Deux appels, et c'est assez** : le serveur relit le
   *  projet à chacun, et l'ordre est un tri stable — deux rangs égaux, le temps
   *  d'un aller-retour raté, ne perdent aucune ligne. */
  const deplacer = (rang: number, vers: number) => {
    const un = emplacements[rang]
    const autre = emplacements[vers]
    if (!un || !autre) return
    void api
      .reglerEmplacement(un.identifiant, { rang: autre.rang })
      .then(() => api.reglerEmplacement(autre.identifiant, { rang: un.rang }))
      .then((recu) => setEmplacements(recu?.emplacements ?? []))
      .catch(echouer)
  }

  if (!equipe) {
    return (
      <EtapeOuverte
        aide="assistant.emplacements"
        titre="Emplacements"
        conduite="Rien à régler ici, et c'est une réponse, pas un trou."
      >
        <Raison
          texte={`aucun type de ce jeu n'a de silhouette — un jeu de tuiles et de décors ne porte pas d'équipement. Donne une silhouette à un type à ${laDesignation("types", univers.style)}, et cette étape-ci se remplira d'elle-même`}
        />
      </EtapeOuverte>
    )
  }

  return (
    <EtapeOuverte
      aide="assistant.emplacements"
      titre="Emplacements"
      conduite={
        <>
          Les endroits d'un corps où l'on peut accrocher une pièce d'équipement.{" "}
          <strong className="text-texte">
            Le rang décide de ce qui se dessine par-dessus quoi
          </strong>{" "}
          : la cape au rang 1 passe derrière le corps, le casque au dernier rang
          passe devant tout le reste. Monte et descends les rangées jusqu'à ce
          que l'empilement soit juste.
        </>
      }
    >
      {emplacements.length === 0 ? (
        // **Une liste vide ne se laisse pas vide.** Le vestiaire naît vide et
        // continue — personne ne sait d'avance ce qu'un jeu équipe —, mais une
        // liste vide sous une règle sur l'ordre rend la règle indémontrable.
        // Le geste est proposé, jamais fait derrière le dos de l'auteur.
        <div className="flex w-fit flex-col gap-2 rounded-[2px] border border-bord bg-fond-1 p-3">
          <p className="max-w-[52ch] text-[12.5px] text-texte-2">
            Rien n'est encore posé. L'atelier en propose six, dans l'ordre de
            l'empilement — le dos, le corps, les jambes, le torse, les mains, la
            tête.
          </p>
          <button
            type="button"
            onClick={() =>
              void api
                .poserLesEmplacementsProposes()
                .then((recu) => setEmplacements(recu?.emplacements ?? []))
                .catch(echouer)
            }
            className="mesure h-[34px] w-fit rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11.5px] text-texte hover:bg-fond-3"
          >
            poser les six ›
          </button>
        </div>
      ) : (
        <ul className="flex max-w-[420px] flex-col overflow-hidden rounded-[2px] border border-bord bg-fond-1">
          {emplacements.map((emplacement, rang) => (
            <li
              key={emplacement.identifiant}
              className="flex h-[34px] items-center gap-2 border-b border-bord px-2 text-[12.5px] text-texte-2 last:border-b-0"
            >
              <span className="mesure w-[14px] shrink-0 text-[10px] text-texte-3">
                {rang + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{emplacement.nom}</span>
              <span className="flex shrink-0 gap-[3px]">
                <button
                  type="button"
                  aria-label={`Monter ${emplacement.nom}`}
                  disabled={rang === 0}
                  onClick={() => deplacer(rang, rang - 1)}
                  className="mesure flex h-[24px] w-[24px] items-center justify-center rounded-[2px] border border-bord-fort text-[10px] text-texte-2 hover:text-ancien-signal disabled:border-bord disabled:text-texte-3"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Descendre ${emplacement.nom}`}
                  disabled={rang === emplacements.length - 1}
                  onClick={() => deplacer(rang, rang + 1)}
                  className="mesure flex h-[24px] w-[24px] items-center justify-center rounded-[2px] border border-bord-fort text-[10px] text-texte-2 hover:text-ancien-signal disabled:border-bord disabled:text-texte-3"
                >
                  ↓
                </button>
              </span>
              <button
                type="button"
                aria-label={`Retirer ${emplacement.nom}`}
                onClick={() =>
                  void api
                    .retirerEmplacement(emplacement.identifiant)
                    .then((recu) => setEmplacements(recu?.emplacements ?? []))
                    .catch(echouer)
                }
                className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-ancien-echec"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex max-w-[420px] items-center gap-2">
        <input
          value={neuf}
          aria-label="Un emplacement de plus"
          placeholder="un emplacement de plus — la ceinture, l'épaule…"
          onChange={(e) => setNeuf(e.target.value)}
          className="h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11.5px] text-texte"
        />
        <button
          type="button"
          disabled={!neuf.trim()}
          onClick={() =>
            void api
              .ajouterEmplacement(neuf)
              .then((recu) => {
                setEmplacements(recu.emplacements)
                setNeuf("")
              })
              .catch(echouer)
          }
          className="mesure h-[26px] shrink-0 px-2 text-[10px] text-ancien-signal hover:text-ancien-signal-clair disabled:text-texte-3"
        >
          + ajouter
        </button>
      </div>
    </EtapeOuverte>
  )
}

/** L'étape « Les IA à utiliser » — le modèle par défaut, **par famille**, pas un réglage global
 *  (US-58). */
function LesIA({
  univers,
  modeles,
  onRegler,
}: {
  univers: Univers
  modeles: Modele[]
  onRegler: Regler
}) {
  return (
    <EtapeOuverte
      aide="univers.modeles"
      titre="Les IA à utiliser"
      conduite={
        <>
          Quel moteur d'image l'atelier proposera selon{" "}
          <strong className="text-texte">ce que tu fabriques</strong>. Une famille
          sans modèle n'est pas un trou : c'est un réglage que rien ne t'oblige à
          poser, et le catalogue décide alors à ta place.
        </>
      }
    >
      <ul className="flex max-w-[560px] flex-col rounded-[2px] border border-bord">
        {FAMILLES.filter((f) => f !== "tous").map((famille) => (
          <li
            key={famille}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2">
              {NOM_FAMILLE[famille]}
            </span>
            <select
              value={univers.modeles[famille] ?? ""}
              onChange={(e) =>
                void onRegler({
                  modeles: { ...univers.modeles, [famille]: e.target.value },
                })
              }
              className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
            >
              <option value="">—</option>
              {modeles.map((m) => (
                <option key={m.identifiant} value={m.identifiant}>
                  {libelleModele(m)}
                </option>
              ))}
            </select>
            {/* **Une liste vide dit ce qui décidera à sa place.** On apprend la
                règle en lisant le réglage, sans avoir à la chercher ailleurs. */}
            {!univers.modeles[famille] && (
              <span className="mesure shrink-0 text-[9.5px] text-texte-3">
                aucun choisi —{" "}
                {univers.modele_planche
                  ? "l'atelier emploiera le modèle de planche"
                  : "l'atelier emploiera le défaut du catalogue"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* **Deux défauts d'appel, et pas une famille de plus** (C2). La liste
          au-dessus est indexée par *ce qu'on fabrique* ; ces deux-ci répondent
          à *quelle sorte d'appel on fait*, et les mêler aurait demandé deux clés
          réservées dans un espace de noms qui est celui de l'auteur.

          Deux, et pas un : à l'essai du 28 août, un modèle rend les traits du
          gabarit dans l'image là où un autre les ignore comme demandé. */}
      <ul className="mt-2 flex max-w-[560px] flex-col rounded-[2px] border border-bord">
        {(
          [
            ["modele_planche", "planche", "quand un lot d'attitudes part"],
            ["modele_edition", "édition", "quand un corps se retouche"],
          ] as const
        ).map(([champ, nom, quand]) => (
          <li
            key={champ}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2" title={quand}>
              {nom}
            </span>
            <select
              value={univers[champ] ?? ""}
              onChange={(e) => void onRegler({ [champ]: e.target.value })}
              aria-label={`Modèle par défaut pour une ${nom}`}
              className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
            >
              <option value="">—</option>
              {modeles.map((m) => (
                <option key={m.identifiant} value={m.identifiant}>
                  {libelleModele(m)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </EtapeOuverte>
  )
}

/** L'étape « Le détourage de départ » — par nature d'image puis par famille (D1).
 *
 *  ── ⚠️ La mesure qui avait caché deux réglages, refaite (M7) ───────────────
 *
 *  `D1` n'offrait ici que le moteur et le bord rongé, et l'écartement des deux
 *  autres était **écrit et chiffré** : *« comptées sur les 123 passes écrites à
 *  la main, la tolérance est restée à sa valeur livrée 96 fois sur 100, et le
 *  seuil de transparence aussi »*.
 *
 *  **Recompté le 4 septembre 2026 sur les 147 passes du dépôt, le chiffre ne se
 *  retrouve que pour l'un des deux.** La tolérance a été déplacée 13 fois — une
 *  sur onze, et la décision tient encore pour elle, de justesse. Le seuil de
 *  transparence, lui, l'a été **34 fois, près d'une sur quatre**, dans cinq
 *  projets sur six, et vingt-deux de ces trente-quatre fois avec le moteur du
 *  modèle. Un réglage déplacé une fois sur quatre n'est pas un réglage que
 *  personne ne touche.
 *
 *  Les quatre reviennent donc, **visibles et non repliés** : le nombre de
 *  contrôles se règle par le repli de l'étape entière (`G8`), pas par le repli
 *  de chacun de ses réglages.
 *
 *  **Le modèle de silhouette n'y revient pas**, et c'est tranché : celui qui
 *  s'annonce comme lourd ne détoure rien du tout aujourd'hui — la bibliothèque
 *  ne connaît pas ce nom-là et retombe en silence sur le rapide. Offrir un choix
 *  dont un des termes ne fait rien serait pire que de ne pas l'offrir. Il attend
 *  `G13`. */
function LeDetourage({
  univers,
  onRegler,
}: {
  univers: Univers
  onRegler: Regler
}) {
  const familles = FAMILLES.filter((f) => f !== "tous")
  return (
    <EtapeOuverte
      aide="univers.detourage"
      titre="Le détourage de départ"
      conduite={
        <>
          Comment l'atelier <strong className="text-texte">retire le fond</strong>{" "}
          d'une image qui revient, avant que tu y touches. Rien n'est obligatoire :
          une ligne laissée vide n'est pas un trou, c'est un réglage que le produit
          décide à ta place — et changer un réglage ici{" "}
          <strong className="text-texte">ne retouche aucune image déjà faite</strong>.
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Rangees titre="selon comment l'image est venue">
          {(
            [
              ["detourage_image", "image seule", "quand une image arrive toute seule"],
              [
                "detourage_planche",
                "morceau de planche",
                "quand une planche est découpée en sujets",
              ],
            ] as const
          ).map(([champ, nom, quand]) => (
            <RangeeDetourage
              key={champ}
              nom={nom}
              quand={quand}
              passe={univers[champ]}
              herite="le produit décide"
              onPoser={(defaut) => void onRegler({ [champ]: defaut })}
            />
          ))}
        </Rangees>

        {/* **La famille l'emporte sur la nature, et elle l'emporte en entier.**
            Un réglage de famille qui ne remplacerait que ce qu'il déclare
            demanderait de distinguer « posé à zéro » de « pas posé » sur chaque
            réglage — et l'écran devrait montrer cette distinction-là. La règle
            simple est celle que la tranche écrit : sans réglage de famille, on
            hérite de sa nature. C'est pour qu'elle ne surprenne jamais que la
            fiche de chaque image dit ensuite d'où vient ce qui s'est appliqué. */}
        <Rangees titre="ou selon ce que l'image montre — et alors ça l'emporte">
          {familles.map((famille) => (
            <RangeeDetourage
              key={famille}
              nom={NOM_FAMILLE[famille]}
              quand={`pour tout ce que tu ranges dans ${NOM_FAMILLE[famille]}`}
              passe={univers.detourages[famille] ?? null}
              herite="comme sa nature d'image"
              onPoser={(defaut) =>
                void onRegler({
                  detourages: sansVide({
                    ...univers.detourages,
                    [famille]: defaut,
                  }),
                })
              }
            />
          ))}
        </Rangees>

        {/* **Les quatre réglages sont nommés en clair, une fois, sous le
            tableau** — et pas en survol de chaque case : on les lit avant de
            toucher au premier, et non un par un en cherchant lequel fait quoi. */}
        <p className="max-w-[66ch] text-[11.5px] leading-relaxed text-texte-3">
          La <strong className="text-texte-2">tolérance</strong> dit jusqu'où une
          couleur compte encore comme du fond ; le{" "}
          <strong className="text-texte-2">seuil de transparence</strong>, à partir
          de quand un pixel est traité comme transparent ; le{" "}
          <strong className="text-texte-2">bord rongé</strong>, combien de pixels
          on mange au contour pour retirer le liseré que le fond y laisse.
        </p>
        {/* ⚠️ **La décision de D1 est réécrite ici avec le bon chiffre**, et
            elle est réécrite là où elle était écrite. Elle ne disparaît pas en
            silence : c'est elle qui avait caché les deux réglages, et l'auteur
            l'avait lue. */}
        <p className="max-w-[66ch] text-[11.5px] leading-relaxed text-texte-3">
          Deux d'entre eux manquaient ici, écartés sur un comptage —{" "}
          <em>tu les laisses à leur valeur livrée 96 fois sur 100</em>. Recompté
          sur tes <strong className="text-texte-2">147 détourages</strong>, ce
          n'est vrai que de la tolérance, déplacée{" "}
          <strong className="text-texte-2">une fois sur onze</strong> : pour elle
          la remarque tenait, de justesse. Le seuil de transparence, lui, tu l'as
          déplacé <strong className="text-texte-2">près d'une fois sur quatre</strong>,
          dans cinq de tes six jeux.
        </p>
        <p className="max-w-[66ch] text-[11.5px] leading-relaxed text-texte-3">
          Le choix du modèle de silhouette n'est pas ici, et ce n'est pas un
          oubli : celui qui s'annonce comme lourd ne retire aucun fond
          aujourd'hui. Offrir un choix dont un des termes ne fait rien serait pire
          que de ne pas l'offrir — il reviendra quand ce sera réparé.
        </p>
        <p className="max-w-[66ch] text-[11.5px] leading-relaxed text-texte-3">
          Tu n'as pas à deviner ces valeurs à froid : règle une image dans sa
          table de détourage, et quand le résultat te convient,{" "}
          <em>enregistre ce réglage comme défaut du projet</em> depuis l'image
          elle-même. Cet écran-ci devient alors la relecture de ce que tu as
          promu.
        </p>
      </div>
    </EtapeOuverte>
  )
}

/** Un bloc de rangées avec son intitulé. Deux blocs, parce que ce sont deux
 *  questions — *comment l'image est venue* et *ce qu'elle montre* — et qu'un
 *  seul tableau les aurait fait passer pour une même liste. */
function Rangees({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex max-w-[700px] flex-col gap-1">
      <Libelle>{titre}</Libelle>
      <ul className="flex flex-col rounded-[2px] border border-bord">{children}</ul>
    </div>
  )
}

/** Une ligne : ce qu'on règle, avec quel moteur, et combien de bord il ronge.
 *
 *  **Un seul geste pose et retire.** Le moteur « — » n'est pas une valeur du
 *  produit : c'est *aucun réglage*, et le choisir renvoie `null`, ce que la
 *  route lit comme « remets-le au produit ». Un bouton de retrait en plus aurait
 *  fait deux façons de dire la même chose. */
function RangeeDetourage({
  nom,
  quand,
  passe,
  herite,
  onPoser,
}: {
  nom: string
  quand: string
  passe: Passe | null
  /** Ce qui décidera si cette ligne reste vide — la phrase se lit sur place,
   *  sans avoir à chercher la règle ailleurs. */
  herite: string
  onPoser: (defaut: DefautDetourage | null) => void
}) {
  /** Ce que la ligne porte aujourd'hui, réduit à ce qu'un défaut retient. Une
   *  passe posée sur une image porte en plus son point de pipette et son tracé,
   *  qui n'ont aucun sens sans image où viser : le domaine les retire à
   *  l'entrée, et les reconstruire ici en ferait une seconde vérité. */
  const defaut = (): DefautDetourage => ({
    moteur: passe!.moteur,
    tolerance: passe!.tolerance,
    seuil_alpha: passe!.seuil_alpha,
    durcissement: passe!.durcissement,
    modele: passe!.modele,
  })

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-bord px-2 py-1.5 last:border-b-0">
      <span className="w-[130px] shrink-0 text-[11px] text-texte-2" title={quand}>
        {nom}
      </span>
      <select
        value={passe?.moteur ?? ""}
        aria-label={`Moteur de détourage pour ${nom}`}
        onChange={(e) =>
          onPoser(e.target.value ? defautPourMoteur(e.target.value as Moteur) : null)
        }
        className="mesure h-[26px] w-[110px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
      >
        <option value="">—</option>
        {(Object.keys(MOTEUR) as Moteur[]).map((m) => (
          <option key={m} value={m}>
            {MOTEUR[m]}
          </option>
        ))}
      </select>
      {passe ? (
        /* **Les quatre réglages de la ligne, et non deux** (M7). Le moteur
           décide de la façon de chercher le fond ; les trois nombres décident
           de ce qu'on en retire. Ils reviennent visibles, parce que le chiffre
           qui les avait cachés ne se retrouve pas — voir la mesure au-dessus. */
        <>
          <ChampDuDetourage
            libelle="tolérance"
            propos="jusqu'où une couleur compte encore comme du fond"
            nom={nom}
            valeur={passe.tolerance}
            min={0}
            max={120}
            onPoser={(tolerance) => onPoser({ ...defaut(), tolerance })}
          />
          <ChampDuDetourage
            libelle="seuil de transparence"
            propos="à partir de quand un pixel est traité comme transparent"
            nom={nom}
            valeur={passe.seuil_alpha}
            min={1}
            max={255}
            onPoser={(seuil_alpha) => onPoser({ ...defaut(), seuil_alpha })}
          />
          <ChampDuDetourage
            libelle="bord rongé"
            propos="combien de pixels on mange au contour, pour retirer le liseré du fond"
            nom={nom}
            valeur={passe.durcissement}
            min={0}
            max={4}
            unite="px"
            onPoser={(durcissement) => onPoser({ ...defaut(), durcissement })}
          />
        </>
      ) : (
        /* **Une ligne vide dit ce qui décidera à sa place**, comme la liste des
           IA juste avant : on apprend la règle en lisant le réglage.
           **Et depuis M7 elle dit aussi ce qu'elle cache** : les trois nombres
           n'apparaissent qu'une fois le moteur choisi, et rien ne le disait —
           l'auteur a lu le bord rongé comme absent du produit. */
        <span className="mesure shrink-0 text-[9.5px] text-texte-3">
          aucun réglage — {herite} · choisis un moteur pour régler la tolérance,
          le seuil et le bord rongé
        </span>
      )}
    </li>
  )
}

/** Un des trois nombres d'une ligne de détourage — son nom, son champ, son
 *  unité s'il en a une.
 *
 *  **Le nom est écrit, jamais deviné du contexte** : trois champs de nombre
 *  côte à côte sans étiquette seraient trois cases à essayer. Le propos, lui,
 *  vit en survol — la phrase entière sur chacun ferait une ligne illisible, et
 *  les quatre sont dits en clair sous le tableau.
 *
 *  ⚠️ **Le champ garde ce qu'on tape jusqu'à ce qu'on le quitte**, et c'est ce
 *  qui le rend utilisable au clavier. Sans ce brouillon, borner à chaque frappe
 *  réécrit le champ sous les doigts : vider le seuil de transparence, dont le
 *  plus petit est un, y posait `1` sur-le-champ, et taper `200` ensuite donnait
 *  `1200` puis le maximum. On ne pouvait plus atteindre la valeur qu'on visait
 *  autrement qu'en corrigeant chiffre par chiffre. Le même motif que le champ
 *  de correction de l'écran de confirmation (`M3`), pour la même raison : ce
 *  qu'on écrit appartient à celui qui écrit tant qu'il écrit. */
function ChampDuDetourage({
  libelle,
  propos,
  nom,
  valeur,
  min,
  max,
  unite,
  onPoser,
}: {
  libelle: string
  propos: string
  /** Ce que la ligne règle — il entre dans le nom du champ, sans quoi vingt-huit
   *  champs du même écran porteraient le même. */
  nom: string
  valeur: number
  min: number
  max: number
  unite?: string
  onPoser: (valeur: number) => void
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null)
  return (
    <label
      className="mesure flex shrink-0 items-center gap-1 text-[9.5px] text-texte-3"
      title={propos}
    >
      {libelle}
      <input
        type="number"
        min={min}
        max={max}
        value={brouillon ?? String(valeur)}
        aria-label={`${libelle} pour ${nom}`}
        onChange={(e) => {
          const texte = e.target.value
          setBrouillon(texte)
          // **Ce qui est déjà dans les bornes part tout de suite** : le réglage
          // suit la frappe, comme les autres contrôles de l'étape. Ce qui n'y
          // est pas encore attend la fin de la saisie, sans rien effacer.
          const nombre = Number(texte)
          if (texte !== "" && Number.isFinite(nombre) && nombre >= min && nombre <= max)
            onPoser(nombre)
        }}
        onBlur={() => {
          // **Quitter le champ le remet dans ses bornes** — ou rend la valeur
          // posée quand ce qui reste n'est pas un nombre. Le champ ne garde
          // jamais un état que le jeu n'a pas.
          if (brouillon !== null) {
            const nombre = Number(brouillon)
            const borne =
              brouillon !== "" && Number.isFinite(nombre)
                ? Math.max(min, Math.min(max, nombre))
                : valeur
            if (borne !== valeur) onPoser(borne)
          }
          setBrouillon(null)
        }}
        className="mesure h-[26px] w-[46px] rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
      />
      {unite}
    </label>
  )
}

/** Le défaut que le produit pose pour un moteur — **et son bord rongé arrive
 *  avec lui**.
 *
 *  La même table que `DURCISSEMENT_LIVRE` côté serveur, et les deux sont tenues
 *  ensemble par un essai : c'est la mesure du 3 septembre 2026, où le moteur
 *  décide du bord rongé dans quatre cas sur cinq et la nature de l'image dans
 *  presque aucun. */
function defautPourMoteur(moteur: Moteur): DefautDetourage {
  return {
    moteur,
    tolerance: 28,
    seuil_alpha: 128,
    durcissement: DURCISSEMENT_LIVRE[moteur],
    modele: "",
  }
}

/** Le dictionnaire des familles sans celles qu'on vient de vider. Retirer une
 *  famille, c'est **l'absence de sa clé** — la même convention que les modèles
 *  par famille, et le serveur n'a donc rien de neuf à comprendre. */
function sansVide(
  familles: Partial<Record<Famille, DefautDetourage | Passe | null>>,
): Partial<Record<Famille, DefautDetourage>> {
  const gardees: Partial<Record<Famille, DefautDetourage>> = {}
  for (const [famille, defaut] of Object.entries(familles)) {
    if (!defaut) continue
    gardees[famille as Famille] = {
      moteur: defaut.moteur,
      tolerance: defaut.tolerance,
      seuil_alpha: defaut.seuil_alpha,
      durcissement: defaut.durcissement,
      modele: defaut.modele,
    }
  }
  return gardees
}

/** L'étape « Les fournisseurs » — **ce qu'ils demandent** (F3).
 *
 *  **Seule dans son groupe, parce qu'elle vaut pour tous les jeux** — comme la
 *  base d'étiquettes, elle ne dépend d'aucun.
 *
 *  **Trois portes, une seule pièce**, et l'étape gagne des portes sans gagner de
 *  pièce : elle rend le tiroir de la fenêtre des réglages, tel quel. Ce qu'on
 *  dépose ici est la même valeur au même endroit — et il n'y a pas deux façons
 *  d'écrire le `.env`, parce qu'il n'y a qu'un composant.
 */
function LaCle({
  onErreur,
  onDeposee,
}: {
  onErreur: (raison: string) => void
  /** **La barre du haut lit le même tiroir, et elle est rendue ailleurs.**
   *  Sans ce mot-là, déposer ici laisserait la barre annoncer *1 sur 2* sur un
   *  atelier où les deux fournisseurs sont prêts — et le grisé des modèles du
   *  fournisseur qu'on vient de servir ne tomberait qu'au prochain
   *  rafraîchissement. C'est le même geste que dans la fenêtre des réglages,
   *  parce que c'est le même dépôt. */
  onDeposee: () => void
}) {
  const [tiroirs, setTiroirs] = useState<Tiroir[]>([])

  // **Ce qu'on lit ici est ce que la fenêtre des réglages lit**, et ce que la
  // barre du haut annonce. L'état vient donc du serveur, jamais d'une copie
  // tenue à l'écran.
  useEffect(() => {
    void api
      .etat()
      .then((recu) => setTiroirs(recu.secrets))
      .catch((erreur) => onErreur(String(erreur)))
  }, [onErreur])

  return (
    <EtapeOuverte
      aide="assistant.fournisseurs"
      titre="Les fournisseurs"
      conduite={
        <>
          Un fournisseur payant tient un style sur dix sujets, et il demande une
          clé ; sans elle, ses modèles sont grisés et les autres restent
          utilisables. Ce qu'on dépose ici vaut pour{" "}
          <strong className="text-texte">tous les jeux</strong> de l'atelier, et
          c'est le même tiroir que dans la fenêtre des réglages.
        </>
      }
    >
      <TiroirDesSecrets
        tiroirs={tiroirs}
        onChange={(rendus) => {
          setTiroirs(rendus)
          onDeposee()
        }}
        compact
      />
    </EtapeOuverte>
  )
}
