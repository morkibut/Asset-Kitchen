// L'Atelier — l'écran du travail quotidien.
//
// Quatre colonnes depuis T3, et c'est la grille de `docs/DESIGN.md` § Layout :
// `240px · 300px · minmax(0,1fr) · 380px` — arbre · réglages · prompt + grille ·
// fiche. Chacune se replie **par choix**, pour voir la grille en grand, jamais
// par contrainte de place (US-97). Écran large uniquement : aucun point de
// rupture, aucun menu escamoté, aucune mise en page de repli à écrire.
//
// **Une seule grille dans tout le produit** (US-31). Celle qui sert à réutiliser
// est exactement celle qui sert à organiser : mêmes filtres, même recherche,
// même sélection multiple. Elle est faite d'assets — la bibliothèque —, et un
// emplacement qui n'a pas encore donné son asset y tient sa place sous la même
// clé, donc à la même place. L'image ne se glisse pas à côté de son attente :
// elle la remplace.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react"
import {
  api,
  dollars,
  FILTRE_VIDE,
  libelleDEmploi,
  Refus,
  type Action,
  type Envoi,
  type Tri,
  type Bibliotheque,
  type GroupeDeRangement,
  type Etat,
  type Bande,
  type Asset,
  type Generation,
  type Modele,
  type Reinjection,
  type Reserve,
  type Carte,
  type Lien,
  type Fabrique,
  type Teinte,
  type CompteReferences,
  type EmplacementCorps,
  type Personnage,
  type Piece,
  type MatriceDesCalquesAnimes,
  type VestiaireDuJeu,
  type Pose,
  type Univers,
  UNIVERS_VIDE,
} from "./api"
import {
  Apercu,
  fermerApercu,
  useApercu,
} from "./composants/Apercu"
import {
  EnTeteDeSurface,
  type Bascule,
  type Fente,
  type Segment,
} from "./composants/EnTeteDeSurface"
import { BarreQuiPaie } from "./composants/BarreQuiPaie"
import { PreparerUneFabrication } from "./composants/PreparerUneFabrication"
// P2 (V3.5) : commander une planche de plusieurs objets en un seul appel.
import { PlancheDePlusieursObjets } from "./composants/PlancheDePlusieursObjets"
import type { OptionsAnimer, TypeDeResultat } from "./fabrication"
import { EcranDecoupe } from "./composants/Decoupe"
import { Emplois } from "./composants/Emplois"
import { Emploi } from "./composants/Emploi"
import { CalquesAnimes } from "./composants/CalquesAnimes"
import {
  FAMILLES,
  NOM_DANS_LE_CARNET,
  type LigneDeFamille,
} from "./composants/Carnet"
import { NavigationAtelier } from "./composants/NavigationAtelier"
import { TiroirDesBrouillons, useBrouillonsEnPlan } from "./composants/Brouillons"
import { noterOuLonEst } from "./brouillons"
import { ImporterPourUnSujet } from "./composants/ImporterPourUnSujet"
import { Tuiles, type VueTuiles } from "./composants/Tuiles"
import { tailleDeLUnivers } from "./tuiles/atelier"
import { AtelierSon } from "./composants/AtelierSon"
import { EcranFamille } from "./composants/Famille"
import { ReglagesDeFamille } from "./composants/ReglagesDeFamille"
import { TableauDeBord } from "./composants/TableauDeBord"
import { CreerUnAsset } from "./composants/CreerUnAsset"
import { Fabrications } from "./composants/Fabrications"
import { TravailConserve } from "./composants/FabricationSuivie"
import { Ouverture } from "./composants/Ouverture"
import { Installation } from "./composants/Installation"
import { Livraisons } from "./composants/Livraisons"
import { Source3DConservee } from "./composants/Source3DConservee"
import type { Source3D } from "./api-3d"
import { ReglesDuJeu } from "./composants/ReglesDuJeu"
import { Reglages, type OngletDesReglages } from "./composants/Reglages"
import {
  PILE_INITIALE,
  dans,
  entrer,
  filDAriane,
  lieu,
  poser,
  racine,
  remonterA,
  sortir,
  type FiltreDeSortie,
  type Lieu,
  type Racine,
} from "./lieux"
import { EcranDepenses } from "./composants/Depenses"
import { EcranEnvoi, TRI_VIDE } from "./composants/Envoi"
import { PageDuSujet, type Onglet as OngletDuSujet } from "./composants/PageDuSujet"
import { MemoireDuParcours, useEtatDuParcours, useEcrireDansLeParcours } from "./composants/MemoireDuParcours"
import { GrilleDuJeu } from "./composants/GrilleDuJeu"
import { Comparer } from "./composants/Comparer"
import { Retouche } from "./composants/Retouche"
import { AssocierImageEquipement } from "./composants/AssocierImageEquipement"
import { CadreDialogue } from "./composants/CadreDialogue"
import { BibliothequePourImage } from "./composants/BibliothequePourImage"
// ── `C4` · la galerie est un fichier ────────────────────────────────────────
// Elle était écrite en clair ici ; elle a désormais son fichier, comme les
// vingt et un autres écrans du carnet. `App` n'en garde que ce que les autres
// écrans lui empruntent — la cible et les réinjections vivent dans la barre qui
// paie, et `fondreAsset` sert au flux d'événements.
import { useFlux } from "./flux"
import { useGestes } from "./gestes"
import { useVestiaire } from "./vestiaire"
import { useRelectures } from "./relectures"
import { usePaiement } from "./paiement"
import { nommerLeLieu } from "./lieux-noms"
import { ecouterLesFabrications } from "./retours"
import { BarreEtat, type Repli } from "./composants/BarreEtat"
import { Galerie, useGalerie } from "./composants/Galerie"
// ⚠️ **`EcranTables` n'est plus monté nulle part** (`B25`) : les six portes de
// la retouche mènent toutes à `Retouche.tsx`. Il ne reste de ce fichier que le
// type de la table qu'une porte demande — il s'en ira avec lui en `B26`.
import type { Table } from "./recette"
import { EcranAtelierDeBande } from "./composants/AtelierDeBande"
import { EcranMontage } from "./composants/Montage"
import { VoletGuide, fermerGuide, ouvrirGuide, useGuide } from "./composants/Guide"
import type { Explication } from "./aide"
import { Barre, fermerBarre, ouvrirBarre, useBarre } from "./composants/Barre"
import { EcranUnivers, type Cote } from "./composants/Univers"
import { type Vue as VueUnivers } from "./composants/Tableau"


const BIBLIOTHEQUE_VIDE: Bibliotheque = {
  courant: null,
  projets: [],
  collections: [],
  sans_projet: { assets: 0, total_usd: 0 },
  total_usd: 0,
}



export function App() {
  return <MemoireDuParcours><AtelierApp /></MemoireDuParcours>
}

function AtelierApp() {
  const memoriserParcours = useEcrireDansLeParcours()
  const [etat, setEtat] = useState<Etat | null>(null)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [catalogueRepli, setCatalogueRepli] = useState<Repli>({
    repli: false,
    raison: null,
    recu_le: 0,
  })
  // Ce qu'une image a coûté chez chaque modèle, mesuré sur les derniers appels
  // (US-121). Une mesure, jamais un tarif — le produit ne porte aucun prix de
  // catalogue, et il dit « jamais appelé » plutôt que d'inventer.
  const [couts, setCouts] = useState<Record<string, number>>({})
  // **Ce qui reste chez chaque fournisseur** (F2), tel que `/models` le rend.
  // Gardé par nom de fournisseur : un modèle dit le sien, et c'est ainsi que
  // l'écran où l'on choisit et celui qui confirme montrent le même chiffre.
  const [reserves, setReserves] = useState<Record<string, Reserve>>({})
  const [compteReferences, setCompteReferences] = useState<CompteReferences | null>(
    null,
  )
  const [defaut, setDefaut] = useState<{
    modele: string | null
    options: Record<string, string>
  }>({ modele: null, options: {} })

  // Le chantier : ce qui tourne, et ce qu'un redémarrage a coupé. Ce qui a
  // réussi est en bibliothèque, ce qui a échoué est au journal du projet.
  const [chantier, setChantier] = useState<Generation[]>([])
  /** **Les clips gardés du jeu ouvert, relus depuis le dépôt** (B22) — pas
   *  seulement ceux que le chantier tient encore en mémoire. Un clip payé n'a
   *  aucun asset qui prend sa place à l'arrivée ; sans cette liste-ci, il ne
   *  restait visible que le temps que le chantier le tienne, c'est-à-dire
   *  jusqu'au premier rechargement. Relue à l'ouverture du jeu — un clip payé
   *  ne change jamais, une relecture régulière n'apprendrait rien de plus. */
  const [clipsDuJeu, setClipsDuJeuBrut] = useState<Generation[]>([])
  /** Vrai dès la première lecture : avant, une liste vide ne veut pas dire
   *  « aucun clip », et la pastille des nouveaux clips s'allumerait à tort. */
  const [clipsDuJeuLus, setClipsDuJeuLus] = useState(false)
  const setClipsDuJeu = useCallback((liste: SetStateAction<Generation[]>) => {
    setClipsDuJeuBrut(liste)
    setClipsDuJeuLus(true)
  }, [])
  const [bibliotheque, setBibliotheque] = useState<Bibliotheque>(BIBLIOTHEQUE_VIDE)
  const [panne, setPanne] = useState<string | null>(null)
  /** Ce qu'on montre d'un refus : ce que le serveur a su dire en français,
   *  sinon la phrase de repli. Écrit ici, tout en haut, parce que la galerie
   *  s'en sert dès son crochet (`C4`). */
  const echouer = (erreur: unknown, defaut_: string) =>
    setPanne(erreur instanceof Refus ? erreur.message : defaut_)
  // **L'échec d'un appel n'est pas une panne de l'atelier** (U1). Les deux
  // vivaient dans le même état, et une génération refusée grisait donc le
  // bouton qui paie jusqu'à ce qu'un autre geste relise le catalogue : le seul
  // moment où l'on veut recliquer était précisément celui où l'on ne pouvait
  // plus. Une panne dit *l'atelier ne répond pas* et empêche de partir ; un
  // échec dit *cet appel-là n'est pas passé* et invite à recommencer. Il se
  // vide à chaque nouvelle tentative et à chaque ouverture de l'écran de
  // confirmation.
  const [echecDuPaiement, setEchecDuPaiement] = useState<string | null>(null)
  const [liaison, setLiaison] = useState(true)
  /** Quel onglet des réglages est ouvert (`RP2`).
   *
   *  **Un état de l'écran, jamais un lieu** — la règle écrite en tête de
   *  `lieux.ts` : on ne descend pas dans un onglet, on le choisit, et un fil
   *  d'Ariane qui les annoncerait ferait croire à une profondeur qui n'existe
   *  pas. C'est déjà ce que font les quatre étapes des règles du jeu et les
   *  quatre de l'installation. */
  const [ongletDesReglages, setOngletDesReglages] =
    useState<OngletDesReglages>("univers")
  const [relecture, setRelecture] = useState(false)

  // ── Les trois onglets (E1) ────────────────────────────────────────────────
  //
  // **Un seul allumé à la fois, et rien ne se superpose.** Avant la V2.1, quatre
  // booléens indépendants — `universOuvert`, `personnagesOuverts`, et deux
  // autres — décidaient chacun de couvrir l'atelier : rien n'empêchait deux
  // écrans d'être « ouverts » ensemble, et le dessous était celui qui avait été
  // monté en dernier. Un seul état à trois valeurs rend cette question
  // impossible à poser.
  //
  // La galerie est l'onglet de départ : c'est l'écran qu'on regardait déjà en
  // arrivant, et un produit ne change pas d'accueil pour se réorganiser.
  //
  // ── B0 · La pile de lieux ─────────────────────────────────────────────────
  //
  // **Ce `useState`-ci est le seul état de navigation du produit.** Les douze
  // qui suivaient — l'onglet, les dépenses, le clip, le montage, l'atelier de
  // bande, la confirmation, la carte découpée, le sujet, la case, les tables —
  // n'ont pas disparu : ils sont **dérivés** de la pile, avec exactement le
  // même nom, le même type et le même setter. Les deux cents endroits qui les
  // lisent n'ont pas bougé d'une ligne, et il n'y a plus qu'une vérité.
  //
  // Ce que ça change tout de suite : le fil d'Ariane se **lit** au lieu de se
  // reconstruire (`interface/src/lieux.ts`, `filDAriane`), et un lieu que plus
  // rien n'ouvre se voit — `decoupeOuverte` avait sept écritures, toutes à
  // `null`, et son écran était injoignable depuis des jours.
  const [pile, setPile] = useState<Lieu[]>(() => [...PILE_INITIALE])
  // **Où l'on est, dit une fois pour toutes** (`RP16`). Un brouillon garde la
  // pile du moment où il s'écrit, et le tiroir la repose : la porte commune la
  // lit ici plutôt que de la faire descendre en propriété jusqu'aux treize
  // écrans qui gardent un brouillon.
  useEffect(() => { noterOuLonEst(pile) }, [pile])
  const [tiroirDesBrouillons, setTiroirDesBrouillons] = useState(false)
  const [imageAEquiper, setImageAEquiper] = useState<Asset | null>(null)

  /** L'ouverture (B4) — **prend la fenêtre entière**, comme le parcours de
   *  création, et ce n'est pas un lieu de la pile : elle ne parle pas d'un
   *  jeu, elle sert à en choisir un. On y va depuis le nom du jeu, dans le
   *  carnet ; on en part en choisissant un jeu, en en créant un, ou par
   *  Échap — la pile, elle, ne bouge pas : il y a toujours un jeu ouvert
   *  dessous, sauf à l'avoir choisi soi-même.
   *
   *  `"creer"` n'ouvre plus le même écran depuis `B14` : il ouvre **le parcours
   *  des règles du jeu en mode création**, dont la première étape est le nom.
   *  L'ouverture, elle, garde son rôle — choisir parmi ceux qui existent. */
  const [choixDuJeu, setChoixDuJeu] = useState<null | "jeux" | "creer">(null)

  /** Le jeu que le parcours de création vient de créer, ou `null`.
   *
   *  **Le parcours doit connaître son dossier** — c'est ce que l'étape du nom montre
   *  une fois le jeu créé, et c'est l'identifiant que l'étape renomme si l'on y
   *  revient. `bibliotheque.courant` le dirait aussi, mais une frappe plus tard
   *  seulement : `creer_projet` ouvre le jeu côté serveur, et l'arbre ne
   *  revient qu'au rafraîchissement suivant. */
  const [creeParLeParcours, setCreeParLeParcours] = useState<string | null>(null)

  /** Les réglages (`B14`, devenus les quatre onglets de la maquette en `RP2`)
   *  — **une profondeur, pas une racine**.
   *
   *  Le carnet visible à côté est ce qui les distingue du parcours de création :
   *  on règle un jeu qui tourne, on ne le fabrique pas. Les quatre onglets sont
   *  un état de l'écran, jamais quatre lieux (`interface/src/lieux.ts`).
   *
   *  **C'est maintenant la seule porte vers les réglages** : le mot de la
   *  colonne, le bouton de la bande et l'état de la clé ouvrent tous les trois
   *  cet écran-ci. */
  const reglesOuvertes = dans(pile, "regles")
  const setReglesOuvertes = (ouvert: boolean) =>
    setPile((p) => (ouvert ? entrer(p, { genre: "regles" }) : sortir(p, "regles")))
  /** Ouvrir les réglages sur l'onglet que le geste désigne. Sans onglet dit,
   *  celui qu'on regardait la dernière fois.
   *
   *  **La sortie se referme devant eux.** Les deux se posent sur n'importe
   *  quelle racine ; laissées empilées, celle qui perd la chaîne de gardes
   *  resterait ouverte sans rien montrer, et le fil annoncerait un étage qu'on
   *  n'a pas descendu. */
  const ouvrirLesReglages = (onglet?: OngletDesReglages) => {
    if (onglet) setOngletDesReglages(onglet)
    setPile((p) => entrer(sortir(p, "sortie"), { genre: "regles" }))
  }

  /** L'installation de la machine (`B15`) — **le seul lieu qui ne parle d'aucun
   *  jeu**. Les clés, ComfyUI, le dossier de travail : ce qu'on branche une fois
   *  et qui vaut pour tous les jeux. Le pied du carnet l'ouvre, d'où qu'on
   *  vienne — comme les dépenses et les règles.
   *
   *  ⚠️ **Trois réglages n'ont jamais rejoint ce lieu-ci** : les garde-fous
   *  de l'agent, le dossier du jeu et la bibliothèque de mouvements, que
   *  `B15` ne reprend pas — ils sont d'un jeu, pas de la machine. `D1` les
   *  avait relogés dans une fenêtre posée par-dessus le carnet ; `RP2` a
   *  dissous cette fenêtre dans l'onglet *Agent MCP* des réglages, et
   *  l'installation s'ouvre désormais depuis l'onglet *Moteurs & workflows*.
   *  Elle reste un lieu à part, parce qu'elle se déroule aussi toute seule au
   *  premier lancement. */
  const installationOuverte = dans(pile, "installation")
  const setInstallationOuverte = (ouvert: boolean) =>
    setPile((p) =>
      ouvert ? entrer(p, { genre: "installation" }) : sortir(p, "installation"),
    )

  /** La sortie (`B21`) — **le seul écran d'où les fichiers du jeu s'en vont**.
   *
   *  Elle s'ouvre d'où qu'on vienne, comme les dépenses, les règles et
   *  l'installation. Ce qui la distingue de la dernière : elle appartient au
   *  jeu — son dossier est gardé avec lui, et son lot est fait de ses sujets. */
  const sortieOuverte = dans(pile, "sortie")
  const filtreDeSortie = lieu(pile, "sortie")?.filtre
  /** Une demande complète de l'agent, ouverte depuis le cadre de délégation —
   *  l'onglet *Agent MCP* des réglages. */
  const travailOuvert = lieu(pile, "travail")?.travail
  /** `filtre` ouvre l'écran unique déjà posé sur une chose (`RV8`, §4) — la
   *  fiche d'un sujet, la page d'un son, un jeu de tuiles. */
  const setSortieOuverte = (ouvert: boolean, filtre?: FiltreDeSortie) =>
    setPile((p) => (ouvert ? entrer(p, { genre: "sortie", ...(filtre ? { filtre } : {}) }) : sortir(p, "sortie")))

  /** Les jeux de tuiles (`TU3`) — **un lieu, plus un dialogue**. On y entre par le
   *  bouton *Les tuiles* des familles ; la liste, un jeu ouvert et sa livraison sont
   *  trois étages de la pile, et le fil les nomme. Les noms des jeux remontent de
   *  l'écran, qui seul les tient — celui qu'on est en train de taper compris. */
  const tuilesOuvertes = dans(pile, "tuiles")
  const jeuDeTuiles = lieu(pile, "jeu-de-tuiles")
  /** La livraison d'un jeu de tuiles (`GU13`) — **lue comme un lieu, et plus
   *  seulement comme un champ de `vueDesTuiles`**. `ecranDuGuide` en a besoin
   *  pour router vers son écran de guide ; la vue ci-dessous la relit du même
   *  endroit, pour qu'il n'y ait pas deux façons de savoir où l'on est. */
  const livraisonDeTuiles = dans(pile, "livraison-de-tuiles")
  const vueDesTuiles: VueTuiles = jeuDeTuiles
    ? { jeu: jeuDeTuiles.jeu, ...(jeuDeTuiles.ecran ? { ecran: jeuDeTuiles.ecran } : {}), livraison: livraisonDeTuiles }
    : null
  const [nomsDesTuiles, setNomsDesTuiles] = useState<Record<string, string>>({})
  const ouvrirLesTuiles = () =>
    setPile((p) => entrer(sortir(sortir(p, "sortie"), "regles"), { genre: "tuiles" }))
  const allerDansLesTuiles = (v: VueTuiles) =>
    setPile((p) => {
      const base = sortir(p, "jeu-de-tuiles")
      if (!v) return base
      const ouvert = entrer(base, { genre: "jeu-de-tuiles", jeu: v.jeu, ...(v.ecran ? { ecran: v.ecran } : {}) })
      return v.livraison ? entrer(ouvert, { genre: "livraison-de-tuiles" }) : ouvert
    })

  /** Les sons du jeu (`RT8`) — **un lieu de la pile, comme les tuiles**, et plus
   *  un dialogue plein écran gardé à part : `lieux.ts`, genre `sons`, en dit la
   *  raison. `ouvrirLesSons` ferme d'abord la sortie et les réglages, comme
   *  `ouvrirLesTuiles` — un jeu qu'on livre ou dont on règle les réglages ne
   *  doit pas rester ouvert sous un écran qui n'en parle plus. */
  const sonsOuverts = lieu(pile, "sons")
  const ouvrirLesSons = (identifiant?: string) =>
    setPile((p) => entrer(sortir(sortir(p, "sortie"), "regles"), { genre: "sons", ...(typeof identifiant === "string" && identifiant ? { identifiant } : {}) }))

  /** Le tour du propriétaire doit-il se dérouler tout seul ? (`B15`)
   *
   *  **Le serveur seul décide**, sur deux faits : personne n'a jamais réglé
   *  quoi que ce soit ici, et l'atelier n'a encore rien produit
   *  (`ServiceBibliotheque.neuf()`, écrite en E19 et réemployée). Un atelier
   *  injoignable ou une route absente rendent `false` : un guide de bienvenue
   *  qui surgirait sur une erreur de réseau serait pire que pas de guide. */
  const [tourAOuvrir, setTourAOuvrir] = useState(false)
  const tourVu = useRef(false)
  useEffect(() => {
    let vivant = true
    void api
      .installation()
      .then((recu) => {
        if (vivant && recu.premiere_ouverture && !tourVu.current) setTourAOuvrir(true)
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  /** Le tableau de bord est **le seul lieu neuf de `B0`** : c'est le lieu du
   *  jeu entier, et le seul chemin de retour. */
  const tableauDeBord = racine(pile) === "tableau-de-bord"
  /** **La surface de repos sur laquelle la pile est posée** — ce que `racine()`
   *  rend, sans détour.
   *
   *  Avant `C9` cette ligne mentait : elle rendait `"galerie"` quand on était
   *  sur le tableau de bord, parce qu'un onglet devait bien être allumé et
   *  qu'aucun ne s'appelait comme lui. Les onglets sont partis avec
   *  `BarreChassis.tsx`, et avec eux le besoin de mentir. */
  const surface = racine(pile)
  /** Aller ailleurs **repose la pile**, donc remonte de toute profondeur. */
  const poserLaRacine = (prochaine: Racine) => setPile(poser(prochaine))

  /**
   * Le geste qui dit « ailleurs » — **une ligne de racine du carnet.**
   *
   * C'était `onOnglet` jusqu'à `C9`, et il faisait neuf appels à la main. Huit
   * sont devenus inutiles le jour où la pile est devenue la seule vérité :
   * reposer la pile ferme du même coup les dépenses, le clip, la retouche, la
   * chose ouverte et la carte découpée, qui en sont tous dérivés.
   *
   * **Les deux qui restent ne sont pas dans la pile, et c'est voulu.** L'écran
   * de confirmation de l'envoi est un moment, pas un endroit — le laisser
   * ouvert derrière une autre racine, c'est l'écran enfermé qu'aucun onglet ne
   * pouvait fermer (U1). La fente dit ce que le *dernier geste* a donné : le
   * geste suivant est celui-ci.
   *
   * ⚠️ **Le tri, lui, ne part pas avec.** Il partait, et c'est ce qui mettait
   * l'auteur devant un choix que personne n'avait voulu lui imposer (M5) :
   * garder ses corrections, ou sortir chercher l'image dont il venait de voir
   * qu'elle manquait.
   */
  const allerA = (prochaine: Racine) => {
    fermerCeQuiPart()
    // ⚠️ **Le choix d'une référence sortait avec, et il ne sortait plus.**
    //     Le cadre de dialogue qui le porte vit dans un état à lui, et
    //     personne ne le refermait. Partir par une porte laissait donc une
    //     fenêtre modale posée sur l'écran d'à côté, devant un appel qui
    //     n'avait rien demandé — très exactement ce que la sortie par l'onglet
    //     existe pour éviter.
    setReferenceDePreparation(false)
    setFente(null)
    poserLaRacine(prochaine)
  }

  // **L'écran des dépenses est une profondeur, pas un quatrième onglet** (E18).
  // Il s'ouvre depuis le total de la barre de tête, et le fil dit d'où l'on
  // vient : `Cœur de pierre › Les dépenses`. Il n'a pas de lieu à lui parce
  // qu'il ne parle d'aucun des trois — il parle de l'atelier entier.
  const depensesOuvertes = dans(pile, "depenses")
  const setDepensesOuvertes = (ouvert: boolean) =>
    setPile((p) =>
      ouvert ? entrer(p, { genre: "depenses" }) : sortir(p, "depenses"),
    )

  /** **Le clip qu'on est en train de découper** (A10) — l'identifiant de sa
   *  génération, ou rien.
   *
   *  Il prend la place de la grille dans la galerie, comme l'écran du choix
   *  d'une planche : c'est la profondeur suivante du même endroit, et on y va
   *  depuis la tuile du clip, là où on le regarde. **Il ne recouvre pas le
   *  produit** — contrairement aux trois écrans qui paient —, parce qu'il ne
   *  dépense rien : le clip est déjà payé, et découper se refait autant de fois
   *  qu'on veut. */
  const montageOuvert = lieu(pile, "montage")?.clip ?? null
  const setMontageOuvert = (clip: string | null) =>
    setPile((p) =>
      clip ? entrer(p, { genre: "montage", clip }) : sortir(p, "montage"),
    )

  // **L'atelier d'une animation gardée** (A7). Il prend la place de la
  // matrice, comme le montage prend celle de la galerie : on y entre depuis
  // la vignette de l'animation, et rien n'y dépense.
  const bandeOuverte = lieu(pile, "bande")?.bande ?? null
  /** **Le montage rouvert sur une animation gardée** (V3.03.3) — pour en
   *  changer les images retenues.
   *
   *  Il prend la place de l'atelier de l'animation, comme l'atelier prend celle
   *  de la matrice : c'est la profondeur suivante du même endroit, et les deux
   *  ne peuvent pas être à l'écran ensemble. L'animation entière est gardée ici
   *  plutôt que son seul identifiant, parce que le montage a besoin de ses
   *  prises — ce qu'on garde retrouve sa recette — et qu'un second aller-retour
   *  au serveur pour ce qu'on vient de lire serait un état de plus à tenir. */
  const montageDeLaBande = lieu(pile, "montage-de-bande")?.bande ?? null
  const setMontageDeLaBande = (bande: Bande | null) =>
    setPile((p) =>
      bande
        ? entrer(p, { genre: "montage-de-bande", bande })
        : sortir(p, "montage-de-bande"),
    )
  /** Ouvrir — ou refermer — l'atelier d'une animation. **Une seule porte**, et
   *  elle referme le montage au passage : sans elle, ouvrir une seconde
   *  animation pendant qu'on remonte la première montrerait le montage de
   *  celle qu'on vient de quitter.
   *
   *  La pile le tient par construction : `montage-de-bande` est plus haut que
   *  `bande`, donc entrer dans une autre bande coupe ce qui est au-dessus. */
  /** **Ouvrir un clip sans perdre d'où l'on vient** (18 septembre 2026).
   *  Toutes les portes reposaient la pile sur la galerie : ouvert depuis les
   *  fabrications, le clip se refermait sur la galerie, et la liste qu'on
   *  regardait était perdue. Depuis les fabrications, le clip se pose
   *  maintenant par-dessus elles ; ailleurs, il s'ouvre dans la galerie,
   *  seul endroit qui sait l'afficher. */
  const ouvrirLeMontage = useCallback((clip: string) => {
    setPile((p) => {
      const ici = racine(p)
      return ici === "fabrications" || ici === "galerie"
        ? entrer(p, { genre: "montage", clip })
        : entrer(poser("galerie"), { genre: "montage", clip })
    })
  }, [])

  const ouvrirLAtelierDeBande = useCallback((identifiant: string | null) => {
    setPile((p) =>
      identifiant
        ? entrer(sortir(p, "montage-de-bande"), {
            genre: "bande",
            bande: identifiant,
          })
        : sortir(p, "bande"),
    )
  }, [])

  // **Chaque écran replie ses colonnes, et les nomme.** Une seule table pour
  // les trois : c'est la barre du châssis qui rend les bascules, et elle ne
  // rend que celles de l'onglet où l'on est. Les deux mots uniques d'avant —
  // `arbre` et `réglages` — servaient les quatre écrans et mentaient sur trois.
  const [navigationRepliee, setNavigationRepliee] = useState(false)
  const [grilleARelire, setGrilleARelire] = useState(0)
  const [replies, setReplies] = useState<Record<string, boolean>>({
    arbre: false,
    reglages: false,
    univers: false,
    reserve: false,
    familles: false,
    fiche: false,
  })

  // Ce que l'écran actif a à dire au moment du geste : un refus, ou le compte
  // rendu d'un balayage. **Une seule fente pour les trois onglets** — tant que
  // chaque écran couvrait les autres, chacun devait porter la sienne.
  const [fente, setFente] = useState<Fente>(null)

  // ── T4 : le tableau et l'univers ──────────────────────────────────────────
  //
  // Tenus ici, comme la grille et l'arbre, parce que **l'onglet n'a qu'un
  // abonnement** et qu'il vit ici. L'écran Univers les reçoit en propriétés : un
  // second abonnement ouvert à son ouverture se rebrancherait à chaque
  // aller-retour vers l'atelier.
  const [univers, setUnivers] = useState<Univers>(UNIVERS_VIDE)
  // ── Le plan de poses et les personnages du projet (C1) ────────────────────
  //
  // Tenus ici comme les cartes, et pour la même raison : **un seul endroit
  // écoute le flux**, pour toute la vie de l'onglet. Un second abonnement ouvert
  // à l'ouverture de l'écran Personnages se rebrancherait à chaque aller-retour
  // vers l'atelier, et le serveur renverrait l'état complet à chaque fois.
  const [plan, setPlan] = useState<Pose[]>([])
  const [personnages, setPersonnages] = useState<Personnage[]>([])

  /** **Ce qu'on a laissé en plan** (`RP16`) — les brouillons de ce navigateur
   *  et les travaux que le serveur donne pour non finis. Le carnet en tire son
   *  compteur, le tiroir sa liste. */
  const enPlan = useBrouillonsEnPlan(bibliotheque.courant)

  // **Ce que le flux a besoin de savoir, sans le faire se rebrancher.**
  //
  // L'abonnement est ouvert **une fois par onglet**, et il le reste : c'est la
  // promesse de T1, « on se branche une fois, on écoute ». Mettre le filtre, le
  // projet ouvert ou les proportions dans les dépendances de l'effet aurait
  // fermé la liaison et en aurait rouvert une à chaque changement — donc à
  // chaque frappe dans le champ de recherche —, et le serveur aurait renvoyé
  // l'état complet à chaque fois. Un ref porte donc ce qui bouge, et l'effet ne
  // dépend de rien.
  const vivant = useRef({
    filtre: FILTRE_VIDE,
    courant: null as string | null,
    relireCatalogue: async () => {},
    relireGrille: async () => {},
    relireEtat: async () => {},
    fondrePersonnage: (_recu: Personnage & { supprime?: boolean }) => {},
    relireProduction: async () => {},
    relireLeVestiaire: async () => {},
    personnages: [] as Personnage[],
  })

  // ── La galerie (`C4`) ─────────────────────────────────────────────────────
  //
  // **Elle est un fichier, plus une partie de celui-ci.** Ce qu'elle tient — sa
  // grille, son filtre, sa sélection, son zoom, ses jugements — vit dans
  // `composants/Galerie.tsx`. `App` ne lui passe que ce qui ne lui appartient
  // pas et qu'elle lit, et lui reprend ce que les autres écrans lui empruntent :
  // supprimer une image se fait aussi depuis la matrice d'un sujet, et la barre
  // du châssis compte ce que la grille montre.
  const galerie = useGalerie({
    bibliotheque,
    chantier,
    setChantier,
    clipsDuJeu,
    echouer,
    setPanne,
    setFente,
    replies,
    vivant,
  })
  const {
    fiche,
    ficheClip,
    filtre,
    grille,
    mesurerCentre,
    relireGrille,
    rendre,
    selection,
    setGrille,
    setSelection,
    supprimer,
  } = galerie
  // **Le vestiaire du projet** (C3) — l'autre axe de la même matrice, tenu ici
  // pour la raison du plan : un seul endroit écoute le flux, pour toute la vie
  // de l'onglet. Il arrive dans le même aller-retour que le plan et les
  // personnages, parce qu'une colonne n'existe que par la pièce qui la nomme.
  const [emplacements, setEmplacements] = useState<EmplacementCorps[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  /** **Le vestiaire *résolu*** (`B19`) — les pièces avec leurs emplois, leurs
   *  comptes, et les choses qui peuvent porter.
   *
   *  ⚠️ **Il ne se confond pas avec `pieces` juste au-dessus**, et il ne le
   *  remplace pas : celui-là est la forme du fichier, servie par les six gestes
   *  du vestiaire et par le flux ; celui-ci lit les images, parce que c'est le
   *  seul moyen de savoir qui porte une pièce qui n'a jamais rien déclaré —
   *  toutes celles d'avant `B19`. Les fondre aurait fait payer ce balayage à
   *  chaque renommage de pièce.
   *
   *  `null` tant qu'on ne l'a pas lu : les écrans le disent plutôt que de
   *  montrer un vestiaire vide qui ressemblerait à « il ne porte rien ». */
  const [vestiaireDuJeu, setVestiaireDuJeu] = useState<VestiaireDuJeu | null>(null)
  /** La matrice des calques d'animation de l'emploi ouvert (`B20`), ou `null`
   *  tant que l'écran n'est pas ouvert — voir `relireLesCalquesAnimes`. */
  const [calquesAnimes, setCalquesAnimes] =
    useState<MatriceDesCalquesAnimes | null>(null)
  // **La case que le prochain appel remplira** (US-120). Armée depuis la
  // matrice, désarmée dès que l'appel est parti : c'est une intention qui vaut
  // pour *cette* génération, et une intention qui survivrait à son geste
  // enverrait la suivante dans une case que personne ne vise plus.
  // **Des identifiants, jamais des copies.** Une cible qui garderait l'objet
  // du moment où on l'a armée porterait un personnage périmé dès la première
  // description écrite : le nom affiché, ce qu'il écarte, ses concept arts —
  // tout cela continue de vivre ailleurs. On retient donc *lequel*, et on le
  // relit dans la liste que le flux tient à jour.
  //
  // **Une cible porte N cases depuis C2**, jamais une seule. Un lot est la même
  // intention que la case unique de C1 — *ce que le prochain appel remplira* —,
  // et en faire un second état aurait donné deux façons de dire la même chose,
  // qui se seraient contredites au premier désarmement. Une case armée est un
  // lot d'une case ; c'est le compte qui décide si l'appel se plie.
  //
  // **Et une pièce depuis C3**, quand ce qui est armé n'est plus « fabriquer ces
  // corps » mais « habiller ceux qui existent ». Le troisième champ du même état
  // plutôt qu'un état de plus : c'est la même intention — *ce que le prochain
  // appel remplira* —, et un second état se serait contredit avec celui-ci au
  // premier désarmement, comme le lot l'aurait fait avec la case unique.
  const [cible, setCible] = useState<{
    personnage: string
    poses: string[]
    piece?: string | null
    /** **La direction que cet appel remplira** (E10). Une case est une pose
     *  dans une direction, et c'est elle qui part avec la génération. */
    direction?: string | null
    /** **Les directions d'une planche de pose** (E13). Deux ou plus, et l'appel
     *  part en une planche d'une seule attitude vue sous N angles — la plus
     *  petite planche qui vaille la peine d'exister, et la plus courante : un
     *  jeu vu de dessus réclame quatre directions par pose.
     *
     *  Le quatrième champ du même état plutôt qu'un état de plus, pour la raison
     *  qui a déjà décidé des trois premiers : c'est la même intention — *ce que
     *  le prochain appel remplira* —, et un second état se serait contredit avec
     *  celui-ci au premier désarmement. */
    directions?: string[] | null
    /** **La première planche du sujet** (TS3) — voir `paiement.ts`,
     *  `CibleDeLAppel`. */
    premierePlanche?: boolean
  } | null>(null)
  // **Ce que cette génération-ci n'envoie pas** (US-126). `null` — aucun avis,
  // donc les deux portées durables s'appliquent telles que le serveur les rend.
  // Il ne s'écrit nulle part : c'est la portée la plus étroite, elle vit dans
  // l'onglet et part avec l'appel — comme la pile d'annulation de la toile.
  const [ecarteesGeneration, setEcarteesGeneration] = useState<string[] | null>(null)

  // ── L'écran de confirmation, entre le bouton et la dépense (E14) ──────────
  //
  // **Il s'intercale, il ne remplace pas.** Le bouton reste celui de la barre
  // qui paie, il n'y a toujours qu'un seul endroit d'où l'argent part, et rien
  // n'est dépensé tant que le bouton *de cet écran-là* n'est pas pressé.
  const envoiOuvert = dans(pile, "envoi")
  // Une profondeur de réglages ou de livraison occupe la surface centrale.
  // Sa racine reste dans le fil, elle ne monte pas un second écran dessous.
  const surfaceDisponible = !reglesOuvertes && !installationOuverte && !sortieOuverte && !travailOuvert && !tuilesOuvertes && !sonsOuverts
  const setEnvoiOuvert = (ouvert: boolean) =>
    setPile((p) => (ouvert ? entrer(p, { genre: "envoi" }) : sortir(p, "envoi")))
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  // **Vrai tant que la fenêtre vient de s'ouvrir** (M3) : c'est ce qui fait
  // partir la première demande sans attendre, alors que toutes les suivantes
  // laissent à la frappe le temps de se poser. Une référence plutôt qu'un état :
  // elle change pendant l'effet, et un état y déclencherait un second rendu — et
  // donc un second appel — pour ne rien dire de neuf à l'écran.
  const ouverture = useRef(true)
  // **Le tri ne porte que des écarts, jamais un état complet**, et il ne
  // s'enregistre nulle part : une correction faite ici vaut pour cet appel
  // seulement, et le prochain repart des réglages.
  const [tri, setTri] = useState<Tri>(TRI_VIDE)
  // **De quel appel ces corrections-là sont les corrections** (M5).
  //
  // La règle disait *le tri repart de rien à chaque ouverture*, et elle visait
  // un vrai danger : un réglage qui traînerait d'un appel au suivant. Elle
  // reste. Ce qui change est **ce qu'elle appelle un autre appel** — sortir
  // chercher une image et revenir n'en est pas un.
  //
  // Le défaut n'était l'oubli de personne : trois décisions justes se
  // rencontraient. La fenêtre de confirmation recouvre tout le produit, donc il
  // n'existe aucun chemin vers une image sans la refermer ; *réinjecter* va où
  // son effet se voit, donc ajouter une référence force un changement d'onglet ;
  // et le tri repartait de rien à chaque ouverture. L'auteur se retrouvait
  // devant un choix que personne n'avait voulu lui imposer — garder ses
  // corrections, ou ajouter l'image dont il venait de voir qu'elle manquait — au
  // seul endroit du produit qui montre quelles références partent, donc le seul
  // où l'on s'aperçoit qu'il en manque une.
  //
  // `null` veut dire « aucune correction en réserve ».
  const [triDe, setTriDe] = useState<string | null>(null)
  // **La série qu'on a choisi de ne plus relire.** Une chose et une pose : dès
  // qu'on change de l'une ou de l'autre, l'écran revient. Il n'existe aucune
  // case « pour toujours » — on la cocherait le premier jour, quand on ne sait
  // pas encore qu'on en aura besoin.
  const [serieSautee, setSerieSautee] = useState<string | null>(null)

  // ── Le verrou de l'argent (U1) ────────────────────────────────────────────
  //
  // **L'appel est parti, on ne repaie pas.** Cinq clics rapides sur *Payer et
  // lancer* lançaient cinq appels payants, en silence — signalé par l'auteur le
  // 31 août 2026, sur sa machine et sur son argent. Le garde-fou existait
  // pourtant côté serveur depuis T1 : une génération porte un identifiant, et
  // `preparer` rend *déjà soumise* sans rien facturer quand il revoit le même.
  // **C'est l'écran qui le jetait**, en fabriquant un identifiant neuf à chaque
  // clic : chaque clic était donc une intention neuve, et chacune se payait.
  //
  // Deux verrous, et il en faut deux. Le **drapeau d'état** dit à l'écran que
  // ça paie et grise le bouton ; il ne suffit pas, parce que deux clics dans la
  // même image de rendu partent tous les deux avant que React ait redessiné
  // quoi que ce soit. Le **repère** ci-dessous, lui, est lu et écrit dans le
  // même tour de boucle : c'est lui qui arrête le second clic.
  const [enPaiement, setEnPaiement] = useState(false)
  const paiementEnCours = useRef(false)
  // **Un identifiant par intention, pas un par clic.** Il se refait quand ce
  // qui part change — c'est `signatureEnvoi` qui le dit — et quand un appel est
  // réellement parti : le réemployer après coup ferait rendre *déjà soumise*
  // par le serveur, c'est-à-dire refuserait en silence une seconde image
  // volontairement identique.
  const intention = useRef<{ signature: string; identifiant: string } | null>(null)

  // La case visée, relue dans ce que le flux tient à jour. Ni l'une ni l'autre
  // ne survit à sa disparition : un personnage supprimé, une pose retirée du
  // plan, et la bande s'efface — la case n'existe plus.
  const personnageCible =
    personnages.find((p) => p.identifiant === cible?.personnage) ?? null
  // **Dans l'ordre du plan, pas dans celui des clics.** C'est cet ordre-là que
  // la planche portera case par case, et c'est celui que l'auteur a sous les
  // yeux dans la matrice : deux ordres pour la même chose se contrediraient au
  // moment où l'on compare la planche à la colonne.
  const posesCible = plan.filter((p) => cible?.poses.includes(p.identifiant))
  // Deux ou plus, et l'appel se plie. En dessous, c'est la génération de C1 :
  // plier une seule case ferait payer un gabarit et une consigne de grille pour
  // une image que le produit sait déjà demander.
  //
  // **Sauf pour une pièce, où une seule case est déjà une planche** (C3). Il n'y
  // a pas d'autre chemin : un calque ne se fabrique que par une planche, fût-elle
  // d'une case, et l'image qu'elle porte est le corps — pas un gabarit vide.
  const pieceCible = cible?.piece ? (pieces.find((p) => p.identifiant === cible.piece) ?? null) : null
  // **La planche d'une pose** (E13) : une attitude, N directions. Deux ou plus,
  // et l'appel se plie exactement comme un lot de poses — c'est le *nombre de
  // cases* qui décide de plier, jamais ce qui les distingue les unes des autres.
  const directionsCible = cible?.directions ?? []
  const enPlanche = pieceCible === null && directionsCible.length >= 2
  const cases =
    pieceCible !== null
      ? posesCible.length
      : enPlanche
        ? directionsCible.length
        : posesCible.length >= 2
          ? posesCible.length
          : 0
  const [cartes, setCartes] = useState<Carte[]>([])
  // **Les traits et les teintes voyagent avec les cartes**, parce qu'ils
  // viennent de la même route : une toile se lit en un aller-retour. Tenus ici
  // et non dans l'écran Univers, comme les cartes elles-mêmes — un seul endroit
  // écoute le flux, pour toute la vie de l'onglet.
  const [liens, setLiens] = useState<Lien[]>([])
  const [teintes, setTeintes] = useState<Record<string, Teinte>>({})
  // **Ce que chaque paquet a produit** (U7) — sa palette, son ambiance. Même
  // route, même raison : un îlot qui montrerait sa marque un aller-retour après
  // les cartes aurait un instant où il paraît n'avoir rien fabriqué.
  const [fabriques, setFabriques] = useState<Record<string, Fabrique>>({})
  /** La carte qu'on est en train de découper, ou rien.
   *
   *  **Tenue ici et pas dans l'écran Univers**, pour une seule raison : c'est un
   *  étage, et un étage se dit dans le fil d'Ariane. La découpe d'une planche a
   *  le sien depuis E3 ; celle d'une carte l'aurait perdu, et *Échap* aurait été
   *  la seule porte de sortie d'un écran plein cadre. */
  const carteDecoupee = lieu(pile, "carte")?.carte ?? null
  const setCarteDecoupee = (carte: Carte | null) =>
    setPile((p) => (carte ? entrer(p, { genre: "carte", carte }) : sortir(p, "carte")))

  /** Ce que la toile demande d'ouvrir côté Ambiances, ou rien (U7).
   *
   *  **L'objet fabriqué vit dans un autre côté de l'onglet**, et c'est très
   *  exactement ce que la séance a relevé : le geste partait sans retour, vers
   *  un endroit qu'il ne montrait pas. Le chemin passe donc par ici, qui est le
   *  seul point commun entre la toile et le côté Ambiances. */
  const [cibleAmbiances, setCibleAmbiances] = useState<{
    genre: "palette" | "ambiance"
    identifiant: string
  } | null>(null)
  // Lequel des trois côtés de l'onglet Univers est allumé. **Monté ici avec la
  // V2.1** : la barre du châssis doit savoir quelles colonnes l'écran replie, et
  // la réserve n'a de colonne qu'en vue toile. Un état de navigation qui décide
  // du contenu d'une bande partagée ne peut plus vivre sous cette bande.
  const [vueUnivers, setVueUnivers] = useState<VueUnivers>("toile")
  // **Lequel des trois côtés de l'Univers est allumé** (E7). Monté ici pour la
  // même raison que la vue : la barre du châssis rend les bascules de repli de
  // l'écran actif, et il n'y en a qu'au côté Inspiration, en vue toile.
  const [coteUnivers, setCoteUnivers] = useState<Cote>("inspiration")

  // ── La grille d'une famille (`B9`) ────────────────────────────────────────
  //
  // **La famille vit dans la pile, pas à côté.** `rubrique` a longtemps porté
  // « laquelle » pendant que la pile ne disait que *codex* : deux portes vers la
  // même famille n'atterrissaient donc pas au même endroit, et le fil d'Ariane
  // devinait ce que la pile ne savait pas. La pile le sait maintenant, et
  // `rubrique` ne sert plus qu'à l'ancien codex — celui des directions, des
  // poses et du vestiaire, qui ne sont pas des familles de sujets.
  const familleOuverte = lieu(pile, "famille")?.famille ?? null
  /** **`poser` puis `entrer`, et jamais l'inverse** : la famille se pose *sur*
   *  le codex, elle n'en est pas une cinquième racine — l'onglet *Codex* reste
   *  le geste qui dit « ailleurs », et c'est lui qui la referme. */
  const ouvrirLaFamille = (cle: string) => {
    setCollectionOuverte(null)
    // Une pièce possède des emplois, pas les cases d'un sujet. La bibliothèque
    // lit donc les pièces directement ; l'ancienne grille de famille ne saurait
    // pas les servir et renvoyait sur une surface de création vide.
    if (cle === "equipement") {
      setPile([{ genre: "bibliotheque", famille: "equipement" }])
      return
    }
    setPile(entrer(poser("codex"), { genre: "famille", famille: cle }))
  }
  /** Le groupe ouvert sous la famille, ou `null` pour « Tous ». **Pas un lieu**
   *  (`lieux.ts` le dit : un état de l'écran où l'on est n'est pas un endroit où
   *  l'on va) — mais le fil le nomme, parce qu'il change ce que la grille
   *  montre. */
  const [collectionOuverte, setCollectionOuverte] = useState<string | null>(null)
  /** Les collections du jeu, telles que la grille les a lues. Le carnet les
   *  montre sans aller les chercher lui-même : une seconde lecture dirait un
   *  compte d'un autre instant. */
  const [groupesDeLaFamille, setGroupesDeLaFamille] = useState<GroupeDeRangement[]>([])
  /** Un compteur, pas un drapeau : deux rangements de suite doivent relire deux
   *  fois, et un booléen déjà à vrai ne redéclencherait rien (le patron de
   *  `nommer`, E19). */
  const [reglagesDeFamille, setReglagesDeFamille] = useState(false)
  /** « + Nouvelle collection », cliqué dans le carnet : c'est la grille qui sait
   *  demander le nom, et un compteur plutôt qu'un drapeau — deux clics de suite
   *  doivent rouvrir le champ deux fois (le patron de `nommer`, E19). */
  /** Nommer une chose depuis le repos de l'onglet Créer (`C3`), sans passer
   *  par le carnet : le même geste que la grille d'une famille propose déjà
   *  (`Famille.tsx`), posé ici en un seul champ. Créée sans famille précisée,
   *  la chose tombe en "personnages" côté serveur (défaut de `POST
   *  /api/characters`), comme au repos de l'ancien codex. */
  const [nomDeLaCreationRapide, setNomDeLaCreationRapide] = useState("")
  const [creationAssetOuverte, setCreationAssetOuverte] = useState<string | null>(null)
  // TS2 — la carte qui part avec la fenêtre « Créer un sujet », quand elle
  // s'ouvre depuis le panneau d'une carte de la toile plutôt que du Codex.
  const [carteSourceDuSujet, setCarteSourceDuSujet] = useState<Carte | null>(null)
  // P2 (V3.5) : la fenêtre de commande d'une planche de plusieurs objets.
  const [commanderPlusieursOuvert, setCommanderPlusieursOuvert] = useState(false)
  const [source3Douverte, setSource3Douverte] = useState<Source3D | null>(null)
  const [creationRapideEnCours, setCreationRapideEnCours] = useState(false)
  const creerRapidement = async () => {
    const propre = nomDeLaCreationRapide.trim()
    if (!propre) return
    setCreationRapideEnCours(true)
    try {
      const { personnage } = await api.creerPersonnage(propre, "")
      setNomDeLaCreationRapide("")
      fondrePersonnage(personnage)
      setChoseOuverte(personnage.identifiant)
    } catch (erreur) {
      setPanne(erreur instanceof Error ? erreur.message : String(erreur))
    } finally {
      setCreationRapideEnCours(false)
    }
  }


  const choseOuverteId = lieu(pile, "sujet")?.sujet ?? null
  const setChoseOuverte = (sujet: string | null) =>
    setPile((p) => (sujet ? entrer(p, { genre: "sujet", sujet }) : sortir(p, "sujet")))
  /** La grille du jeu, et comparer (`B13`) — deux profondeurs de plus de la
   *  page d'un sujet, ouvertes depuis son bandeau d'onglets. Ni l'une ni
   *  l'autre ne dépense : aucune des deux n'a besoin de fermer la barre qui
   *  paie, elles n'en reçoivent simplement pas. */
  const grilleOuverte = lieu(pile, "grille")?.sujet ?? null
  const setGrilleOuverte = (sujet: string | null) =>
    setPile((p) => (sujet ? entrer(p, { genre: "grille", sujet }) : sortir(p, "grille")))
  const comparerOuvert = lieu(pile, "comparer")?.sujet ?? null
  const setComparerOuvert = (sujet: string | null) =>
    setPile((p) =>
      sujet ? entrer(p, { genre: "comparer", sujet }) : sortir(p, "comparer"),
    )
  /** La pièce d'équipement ouverte, et l'emploi ouvert dedans (`B19`).
   *
   *  **Deux lieux, pas un** : la page d'une pièce montre ses emplois, celle
   *  d'un emploi montre ses calques — c'est une profondeur, comme la case d'un
   *  sujet sous sa matrice, et le fil doit pouvoir remonter d'un cran.
   *
   *  ⚠️ **Ouvrir une pièce referme l'emploi qu'on regardait** : `entrer` coupe
   *  ce qui est plus profond, sans quoi l'emploi d'une épée s'afficherait sous
   *  le nom d'un casque. */
  const pieceOuverte = lieu(pile, "piece")?.piece ?? null
  const ouvrirLaPiece = (piece: string | null) =>
    setPile((p) =>
      piece
        ? entrer(poser("codex"), { genre: "piece", piece })
        : sortir(p, "piece"),
    )
  const emploiOuvertLieu = lieu(pile, "emploi")
  const ouvrirLEmploi = (emploi: string | null) =>
    setPile((p) =>
      emploi && pieceOuverte
        ? entrer(p, { genre: "emploi", piece: pieceOuverte, emploi })
        : sortir(p, "emploi"),
    )
  /** Les calques d'animation d'un emploi (`B20`) — une profondeur de plus.
   *
   *  **Le porteur est passé au lieu**, et non déduit à l'ouverture : cet écran
   *  range des bandes, et une bande appartient à un personnage. Un emploi qui ne
   *  porte personne n'a donc rien à y montrer, et le bouton qui y mène ne
   *  paraît pas sur lui. */
  const calquesAnimesLieu = lieu(pile, "calques-animes")
  const ouvrirLesCalquesAnimes = (porteur: string | null) =>
    setPile((p) =>
      porteur && pieceOuverte && emploiOuvertLieu
        ? entrer(p, {
            genre: "calques-animes",
            piece: pieceOuverte,
            emploi: emploiOuvertLieu.emploi,
            porteur,
          })
        : sortir(p, "calques-animes"),
    )

  /** La pièce et l'emploi ouverts, **relus dans le vestiaire vivant** — même
   *  raison que `choseOuverte` : une pièce retirée referme sa page, et un
   *  emploi renommé y suit son nom sans qu'on écrive un mot. */
  const pieceEtSesEmplois =
    vestiaireDuJeu?.pieces.find((p) => p.piece.identifiant === pieceOuverte) ?? null
  const emploiOuvert =
    pieceEtSesEmplois?.emplois.find(
      (e) => e.identifiant === emploiOuvertLieu?.emploi,
    ) ?? null

  /** La retouche (`B16`) — la chaîne redessinée. Elle ne dépense rien :
   *  *cliquer ne coûte jamais*, et toute la chaîne se rejoue sans un centime.
   *
   *  **Une seule porte, et un seul chemin d'écriture** (`B25`). Les genres
   *  `"case"` et `"tables"` ont fondu dans celui-ci : les six portes du produit
   *  — la fiche d'une image de la galerie, *Ses images*, un calque, l'écart du
   *  comparateur, les deux fabriques et le bandeau *La retouche ›* — passent
   *  toutes par `ouvrirLaRetouche`, et il n'y a plus qu'un endroit où une
   *  condition peut manquer. */
  const retoucheOuverte = lieu(pile, "retouche")?.asset ?? null
  /** La table sur laquelle la porte demande qu'on s'ouvre, ou `null` pour
   *  *Détourer*, le défaut. **Elle n'est pas un lieu** (`lieux.ts`, § *Ce qui
   *  n'est pas un lieu*) : c'est un état de l'écran, et il vit dans
   *  `Retouche.tsx` une fois l'écran ouvert. Ceci n'est que la demande de la
   *  porte, lue au montage — l'écran est toujours fermé quand une porte
   *  l'ouvre, et une seconde demande le remonte donc à neuf. */
  const [tableDeLaPorte, setTableDeLaPorte] = useState<Table | null>(null)
  /** **Le seul endroit du produit qui écrive la retouche dans la pile.** */
  const ouvrirLaRetouche = (asset: string | null, table: Table | null = null) => {
    setTableDeLaPorte(table)
    setPile((p) =>
      asset ? entrer(p, { genre: "retouche", asset }) : sortir(p, "retouche"),
    )
  }
  /** D'où vient ce qui est écrit dans le champ, quand ce n'est pas l'auteur.
   *  Posée en armant une case vide, effacée dès qu'on écrit dedans : un texte
   *  qu'on a repris à la main n'est plus une proposition. */
  const [provenance, setProvenance] = useState<string | null>(null)

  /** La chose ouverte, **relue dans la liste vivante**. Un personnage supprimé
   *  ou renommé ferme donc l'établi, ou l'y suit, sans qu'on écrive un mot. */
  const choseOuverte =
    personnages.find((p) => p.identifiant === choseOuverteId) ?? null

  /** **L'onglet ouvert dans la page d'un sujet** (`B25`) — *Sa fiche*, *Ses
   *  images*, *Ses animations*, *L'essai*.
   *
   *  ⚠️ **Ce n'est pas un lieu**, et il ne s'écrit pas dans la pile : `lieux.ts`
   *  range les onglets d'un écran avec la table ouverte et le panneau de
   *  droite. Il est tenu ici parce que la retouche se monte **à la place** de
   *  cette page depuis `B25`, et qu'une page démontée oublie son onglet :
   *  ouvrir une image de *Ses images* puis remonter d'un cran ramenait sur *Sa
   *  fiche*, ce qui n'est pas d'où l'on venait. */
  const cleDuSujet = `sujet:${bibliotheque.courant}:${choseOuverteId}`
  const [ongletDuSujet, setOngletDuSujet] = useEtatDuParcours<OngletDuSujet>(`${cleDuSujet}:onglet`, "fiche")

  /** Le sujet dont la grille du jeu, ou le comparateur, est ouvert — **relus
   *  dans la liste vivante**, pour la même raison que `choseOuverte`. */
  const sujetDeLaGrille =
    personnages.find((p) => p.identifiant === grilleOuverte) ?? null
  const sujetDuComparateur =
    personnages.find((p) => p.identifiant === comparerOuvert) ?? null

  /** Les images du sujet ouvert — ses attitudes, calques compris. */
  const imagesDuSujetOuvert = (choseOuverte?.cases ?? []).flatMap((c) => [
    ...c.images,
    ...Object.values(c.calques).flat(),
  ])

  /** L'image de la retouche **quand elle appartient au sujet ouvert**, ou
   *  `null`. C'est elle qui décide de la colonne des sœurs juste en dessous :
   *  les attitudes de la chose, ou les voisines de la grille. */
  const imageDuSujetEnRetouche =
    imagesDuSujetOuvert.find((a) => a.identifiant === retoucheOuverte) ?? null

  /** L'image dont la chaîne de retouche est ouverte (`B16`) — **relue à chaque
   *  rendu, jamais gardée**. C'est la règle du dépôt : on tient des
   *  identifiants, pas des objets, sans quoi une image retouchée resterait
   *  affichée telle qu'elle était quand on l'a ouverte.
   *
   *  ⚠️ **Deux endroits où la chercher, et c'est la septième porte** (`B25`).
   *  Elle n'était relue que dans la charge du sujet ; la porte de la galerie
   *  sert justement des images qui n'appartiennent à **aucune** chose du jeu, et
   *  l'écran se refermait donc sans un mot sur celles-là — le seul cas que les
   *  deux écrans ne couvraient pas pareil, et celui qui empêchait de retirer
   *  l'ancien. Le sujet d'abord, la grille ensuite : une image qui est dans les
   *  deux est d'abord celle du sujet qu'on regarde. */
  const imageDeLaRetouche =
    imageDuSujetEnRetouche ??
    grille.find((a) => a.identifiant === retoucheOuverte) ??
    null

  /** Les sœurs de l'image en retouche — **ses voisines, selon d'où l'on
   *  vient**. Les attitudes de la chose quand elle en a une, les voisines de la
   *  grille quand elle n'en a pas : dans les deux cas, on passe de l'une à
   *  l'autre sans que la table ouverte se referme. */
  const soeursDeLaRetouche = imageDuSujetEnRetouche
    ? (choseOuverte?.cases ?? []).flatMap((c) => c.images)
    : grille

  // ── T5 : la découpe — **retirée en `B0`, parce qu'elle était morte** ──────
  //
  // `decoupeOuverte` portait l'asset ouvert dans l'écran de découpe de la
  // galerie. Le relevé du 6 septembre 2026 a trouvé **sept écritures, toutes à
  // `null`** : plus aucune porte ne l'ouvrait. La sienne était le bouton de la
  // fiche d'une image, retiré quand le découpage est devenu la première des
  // deux fabriques de la barre des tables — sans que l'état, son écran ni sa
  // branche de fil d'Ariane partent avec lui.
  //
  // ⚠️ **Rien ne pouvait le dire avant.** Une chaîne de ternaires ne signale
  // pas une branche qu'on n'atteint plus, aucun essai ne vérifie ce qu'un
  // écran *ne montre pas*, et le compilateur voyait sept usages. C'est la pile
  // de lieux qui l'a rendu visible : il fallait lui donner un genre, et un
  // genre où l'on n'entre jamais se remarque tout de suite.
  //
  // La découpe d'une planche reste joignable — par la barre des tables, qui
  // est son vrai chemin depuis `E3`.

  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  /** **Une seule fenêtre de préparation, et son type de départ** (RP4).
   *
   *  Trois états vivaient ici : l'image, l'aiguillage à trois portes, et
   *  l'animation d'un sujet. Trois fenêtres, trois façons d'entrer, et aucun
   *  passage de l'une à l'autre. Il n'en reste qu'un : le bouton pressé dit
   *  seulement sur *quel type* la fenêtre s'ouvre — elle sait changer d'elle-même. */
  /** **RV6** : `sujet` porte l'identifiant du sujet visé quand la porte n'en
   *  ouvre aucune fiche derrière elle (Fabrications, un workflow local) —
   *  sans lui, `sujet={choseOuverte ?? personnageCible}` retomberait sur rien.
   *  `cases`, `referenceAsset` et `relance` sont celles d'`OptionsAnimer`
   *  (`fabrication.ts`), transmises telles quelles à
   *  `FabricationSuivie.cibleInitiale`. */
  const [preparation, setPreparation] = useState<{ type: TypeDeResultat; pose?: string; direction?: string; modele?: string; avecQuoi?: "catalogue" | "workflow"; sujet?: string } & OptionsAnimer | null>(null)
  // **L'import vise une case, ou n'en vise aucune.** Ouvert par le bouton du
  // haut il ne sait rien ; ouvert depuis une rangée vide d'*Images fixes* ou
  // depuis « Fabriquer… », il arrive déjà pointé sur la pose qu'on regardait.
  const [importDuSujet, setImportDuSujet] = useState<{ pose?: string; direction?: string } | null>(null)
  /** Le type que la fenêtre de préparation montre **maintenant** (`GU14`). Elle
   *  s'ouvre sur `preparation.type`, mais le type se change dedans, et seule
   *  elle le sait : `ecranDuGuide` a besoin de savoir si l'on est sur *Un son*. */
  const [typeDePreparation, setTypeDePreparation] = useState<TypeDeResultat | null>(null)
  const [referenceDePreparation, setReferenceDePreparation] = useState(false)
  const [promptNegatif, setPromptNegatif] = useState("")
  /** **Le champ porte le texte entier, et il part mot pour mot** (US-159).
   *
   *  Deux états du même champ, pas deux champs : reprendre le texte, c'est
   *  continuer à écrire là où on écrivait — un second éditeur à côté aurait
   *  demandé de choisir lequel des deux part. */
  const [repris, setRepris] = useState(false)
  /** **Refaire une planche** (RS2) : l'appel garde la mise en page de la
   *  planche du sujet, sinon de la première image jointe. Une intention de cet
   *  appel-ci, comme la cible : elle retombe dès qu'il est parti. */
  const [garderMiseEnPage, setGarderMiseEnPage] = useState(false)
  /** **La couper à l'arrivée** (RS7). Recochée chaque fois que la mise en page
   *  l'est (`BarreQuiPaie`) ; ne part qu'avec elle (`paiement.ts`). */
  const [decouperALArrivee, setDecouperALArrivee] = useState(true)
  const [proportions, setProportions] = useState("1:1")
  const [variations, setVariations] = useState(1)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [reinjections, setReinjections] = useState<Reinjection[]>([])
  /** **Ce que l'auteur fabrique**, nommé dans le barème de son projet. Un seul
   *  contrôle, et il décide de trois choses : quels artworks partent en
   *  référence, quel modèle est le défaut, et quelle part de la case le sujet
   *  occupera. Vide est permis — un univers vide ne contraint rien (US-57). */
  const [echelle, setEchelle] = useState("")


  // **Le guide s'ouvre sur `?`**, et se ferme sur Échap comme tout écran du
  // produit. Jamais quand on est en train d'écrire : le champ de prompt et les
  // notes de carte prennent la touche avant lui.
  const guideOuvert = useGuide()

  // **L'aperçu est branché ici, et une seule fois.** Il se pose au-dessus de
  // tout — l'atelier, l'Univers, la Découpe, le Guide —, donc son écoute de
  // touche vit au-dessus de tous les écrans. Ce qu'il montre lui vient des
  // vignettes elles-mêmes, sans traverser cet étage : le pointeur dit ce qu'il
  // vise, personne n'a à le faire descendre.
  const apercu = useApercu()

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return
      const cible = e.target as HTMLElement | null
      const saisie =
        cible?.tagName === "INPUT" ||
        cible?.tagName === "TEXTAREA" ||
        cible?.isContentEditable
      if (saisie) return
      e.preventDefault()
      ouvrirGuide()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [])

  // **B7 — l'écran que le volet doit expliquer.** Répond à « où est-on ? »
  // depuis les mêmes états que le `ouvert` de `Carnet` (plus bas), pour un
  // autre public : ce n'est pas la même liste de destinations, parce que le
  // guide descend là où le carnet ne mène pas — une image, un clip, une
  // animation. Priorité aux profondeurs : une table ouverte l'emporte sur le
  // simple fait d'être dans le codex.
  //
  // ⚠️ **`tables` et `case` sont des écrans du guide, pas des genres de lieu**
  // (`B25`). La pile n'en porte plus qu'un pour la retouche ; le corpus, lui,
  // garde ses deux groupes parce qu'ils ne disent pas la même chose : `tables`
  // range les soixante-dix réglages de la chaîne — c'est la retouche —, et
  // `case`, que `Guide.tsx` nomme *La fiche d'une image*, range les quatre
  // champs de `Fiche.tsx`. Ces quatre-là sont **enfin joints à leur écran** :
  // ils étaient adressés à l'image ouverte dans la page d'un sujet, où aucun
  // des quatre ne paraît, alors qu'ils vivent dans le panneau de la galerie.
  //
  // ⚠️ **Deux écrans s'appelaient « Réglages » et un seul était servi — pas le
  // bon** (`GU7`, § *Le grand constat* de
  // `docs/releves/guide-2026-09-20.md`). La valeur `jeu` du corpus — que
  // `Guide.tsx` nomme *Réglages* — ne pouvait être produite que par
  // `coteUnivers`, typé `Cote` (`"inspiration" | "ambiances"`) : vingt-cinq
  // fiches écrites, **zéro atteignable**. Pendant ce temps l'écran qui porte
  // vraiment ce titre — le lieu `regles` — tombait tout entier sur `reglages`,
  // quel que soit l'onglet. L'onglet *Univers* monte `ReglesDuJeu` en mode
  // reprise : c'est lui, `jeu`. Les trois autres — moteurs, agent,
  // consommations — restent `reglages`.
  //
  // ⚠️ **L'installation n'était testée nulle part** : l'ouvrir montrait le
  // guide de la racine du dessous. Elle rejoint `reglages`, qui documente déjà
  // ce qui vaut pour toute la machine — et `Reglages.tsx` monte ses blocs
  // (`BlocSecrets`) dans l'onglet *Moteurs & workflows*, donc les deux écrans
  // partagent vraiment des réglages.
  //
  // **L'ordre suit les gardes du rendu, plus bas**, et pas l'inverse :
  // `depensesOuvertes` couvre les deux autres, `installationOuverte` couvre
  // les réglages (`reglesOuvertes && !installationOuverte`).
  //
  // ⚠️ **`sortieOuverte` n'était testé nulle part** (`GU12`, § *Ce qui reste
  // ouvert pour la suite* de `docs/releves/guide-2026-09-20.md`) : ouvrir
  // *Livrer au jeu* montrait le guide de la racine du dessous — la panne de
  // `ou: "jeu"` que `GU7` (1/2) a réparée, ici sur la sortie. Elle se pose au
  // même rang que les dépenses, les réglages et l'installation : les quatre
  // s'ouvrent d'où qu'on vienne, par-dessus n'importe quelle racine.
  //
  // ⚠️ **Les trois lieux des tuiles n'étaient testés nulle part non plus**
  // (`GU13`), et c'est la même panne une troisième fois : ouvrir *Les tuiles
  // du jeu* montrait le guide de la racine d'où l'on venait — `codex` le plus
  // souvent, qui ne dit pas un mot des matières ni des raccords. Ils entrent
  // ici, **au même rang que la sortie**, et pour la même raison : le lieu
  // `tuiles` couvre la surface entière (c'est `surfaceDisponible`, plus bas,
  // qui l'écrit : `!tuilesOuvertes`), et les deux autres se posent sur la
  // racine d'où l'on vient (`lieux.ts`, § *Les jeux de tuiles*). Les tester
  // après `surface` aurait rendu la racine du dessous, c'est-à-dire la panne.
  //
  // **Du plus profond au moins profond**, parce que les trois s'empilent : la
  // livraison se pose sur un jeu ouvert, qui se pose sur la liste. Tester la
  // liste en premier aurait donné son guide aux deux autres.
  //
  // ⚠️ **Le son avait deux portes sans écran de guide** (`GU14`). *Un son*
  // (`FabricationAudio.tsx`) est le corps de la fenêtre de préparation quand
  // son type est *Son* ; elle reste un dialogue, et passe donc **avant tout le
  // reste**, pour la même raison que `envoiOuvert` plus loin — un dialogue posé
  // par-dessus une racine qu'on testerait après elle rendrait le guide de la
  // racine du dessous, la panne que `GU7`, `GU12` et `GU13` ont réparée trois
  // fois.
  //
  // **L'atelier des sons, lui, n'est plus un dialogue** (`RT8`) : il est devenu
  // un lieu de la pile — `sonsOuverts`, plus haut, relit `lieu(pile, "sons")`
  // au lieu d'un `useState` à part — et se teste donc au même rang que les
  // tuiles, plus bas, pas ici.
  //
  // *Ce que ce rang ne couvre pas :* un travail sonore rouvert depuis le suivi
  // (`travail` → `FenetreDuTravail`, `nature === "audio"`) monte le même
  // formulaire, mais `App` n'y sait que l'identifiant du travail, pas sa
  // nature. Il tombe donc sur `fabrications` avec les autres travaux rouverts
  // (voir juste en dessous). Idem pour l'onglet *Sons* d'un sujet, qui garde
  // `sujet`.
  //
  // ── `GU15` (1/2) — écran ou état, genre par genre ───────────────────────
  //
  // **Chaque genre de `lieux.ts` est maintenant nommé ici**, et plus aucun ne
  // tombe sur la racine par accident. Quatre écrans neufs, sept héritages
  // décidés, un routage corrigé.
  //
  // *Quatre écrans neufs.* `envoi` — *Relire avant l'envoi* (`Relecture.tsx`),
  // le seul écran du produit où l'argent part : il n'était testé nulle part, et
  // l'ouvrir montrait le guide de la racine du dessous. `fabrications` — la
  // racine du même nom, dont les neuf fiches logeaient sous `ou: "clip"`.
  // `grille` — *Sur la grille du jeu* et `comparer` — *Deux côte à côte* : les
  // deux **prennent la place** de la page d'un sujet au lieu de s'y poser, et
  // le résumé de `sujet` (« on y écrit qui il est », « on y fabrique ce qui
  // manque ») n'y est vrai d'aucune de ses trois lignes.
  //
  // *Sept héritages décidés — un état, pas un repli.* Chacun est écrit dans la
  // chaîne sous le nom de son genre, pour qu'un genre oublié se voie :
  //
  // - `bibliotheque` et `famille` → `codex`. Les deux montent **le même
  //   composant** que le codex, `EcranFamille` (`Famille.tsx`), dont le `<h1>`
  //   est *Codex* — le nom que `Guide.tsx` donne déjà à `codex`. Une famille
  //   ouverte, c'est cette grille restreinte à une famille.
  // - `travail` → `fabrications`. Le lieu monte `FenetreDuTravail`, la fenêtre
  //   que `Fabrications.tsx` rend déjà **en place** quand on clique une demande
  //   dans *Créer et suivre les fabrications* : c'est la même fenêtre par une
  //   seconde porte (l'onglet *Agent MCP*). Six des neuf fiches de
  //   `fabrications` la décrivent — la demande relue, la vidéo libre, les
  //   quatre du rendu 3D.
  // - `emploi` et `calques-animes` → `equipement`. Les deux fiches de cet écran
  //   viennent de `CalquesDeLEmploi.tsx`, c'est-à-dire de la page d'un emploi,
  //   et son résumé parle déjà des calques qui manquent.
  // - `carte` → `inspiration`. Découper une carte prend la place du tableau
  //   sans quitter le côté *Inspiration* (`Univers.tsx` ne rend `EcranDecoupe`
  //   que si `cote === "inspiration"`), et la fiche `carte.decouper` du même
  //   côté décrit ce geste et ce que les morceaux deviennent.
  // - `grille` et `comparer` ne sont **pas** dans cette liste : voir ci-dessus.
  //
  // *Un routage corrigé.* `montage-de-bande` héritait de `bande` ; il monte
  // `EcranMontage` en mode reprise — le même écran que le lieu `montage`, pas
  // l'atelier d'une bande. Le résumé de `bande` y parlait de tables qui n'y
  // sont pas. Il suit `montage` désormais.
  //
  // *Ce qui reste ouvert :* les cinq réglages visibles sur la découpe d'une
  // carte (`decoupe.mode`, `decoupe.taille_min`, `decoupe.colonnes`,
  // `decoupe.lignes`, `decoupe.animation`) vivent sous `ou: "tables"`, parce que
  // `Decoupe.tsx` est aussi une fabrique de la retouche. Les quatre portes de
  // cet écran — la carte, la planche de la galerie, celle de l'atelier de
  // bande, la retouche — n'en sont qu'une seule dans la pile ; un `ou` à lui
  // n'en servirait qu'une.
  const ecranDuGuide: Explication["ou"] | null = preparation && !envoiOuvert && typeDePreparation === "son"
    ? "un-son"
    : // **Le seul écran d'où l'argent part** (`GU15`) : il prend la place de
      // tout ce qui est en dessous — `depensesOuvertes`, la racine, la
      // préparation juste au-dessus le nomment déjà dans leur garde de rendu.
      envoiOuvert
    ? "envoi"
    : // **Une demande rouverte par l'onglet *Agent MCP*** (`GU15`) — même
      // fenêtre que celle des fabrications, testée avant les réglages parce
      // qu'elle se pose par-dessus eux.
      travailOuvert
    ? "fabrications"
    : depensesOuvertes
    ? "depenses"
    : installationOuverte
      ? "reglages"
      : reglesOuvertes
        ? ongletDesReglages === "univers"
          ? "jeu"
          : "reglages"
        : sortieOuverte
          ? "sortie"
          : livraisonDeTuiles
          ? "livraison-de-tuiles"
          : jeuDeTuiles
          ? "jeu-de-tuiles"
          : tuilesOuvertes
          ? "tuiles"
          : sonsOuverts
          ? // Un lieu au même rang que les tuiles, et pour la même raison
            // (`RT8`) : une surface posée sur la racine d'où l'on vient,
            // plus un dialogue à tester avant tout le reste.
            "son"
          : tableauDeBord
          ? "tableau-de-bord"
          : surface === "univers"
            ? // Le genre `carte` — la découpe d'une carte — est un état du côté
              // *Inspiration*, jamais d'*Ambiances* : `Univers.tsx` ne le rend
              // que là. Nommé plutôt que déduit, pour qu'il se voie.
              carteDecoupee
              ? "inspiration"
              : coteUnivers
            : retoucheOuverte
              ? "tables"
              : surface === "galerie" && selection.length === 1
                ? "case"
                : // `montage-de-bande` monte `EcranMontage` en mode reprise —
                  // le même écran que `montage`, et non l'atelier d'une bande
                  // (`GU15`).
                  montageOuvert || montageDeLaBande
                  ? "montage"
                  : bandeOuverte
                    ? "bande"
                    : // **`ficheClip` est l'état de la colonne de droite de la
                      // galerie, et il survit quand on la quitte** : une fiche
                      // de clip laissée ouverte donnait « Un clip » sur *Les
                      // sujets*, *Fabrications* et tout ce qui suit dans cette
                      // chaîne (`GU16`, vu au navigateur). Il ne compte que
                      // sur la galerie, comme `selection` juste au-dessus.
                      surface === "galerie" && ficheClip
                      ? "clip"
                      : // **Les entrées des fabriques trouvent enfin leur
                        // écran** (`B19`). Elles étaient rangées sous
                        // `equipement` depuis `B7`, et **aucun écran ne
                        // rendait jamais cette valeur** : dix-sept
                        // explications écrites, joignables par rien. La page
                        // d'une pièce et celle d'un emploi les servent.
                        //
                        // `emploi` et `calques-animes` sont deux profondeurs de
                        // la même page, nommées ici plutôt que ramassées par
                        // `pieceOuverte` — un genre qu'on lit est un genre
                        // qu'on peut contredire (`GU15`).
                        pieceOuverte || emploiOuvertLieu || calquesAnimesLieu
                        ? "equipement"
                        : // Les deux profondeurs de la page d'un sujet qui la
                          // **remplacent** à l'écran (`GU15`) : elles ne
                          // montrent ni son établi ni ses onglets, donc elles
                          // n'héritent pas de son guide.
                          grilleOuverte
                        ? "grille"
                        : comparerOuvert
                        ? "comparer"
                        : choseOuverteId
                        ? "sujet"
                        : // La grille d'une famille et la racine
                          // `bibliotheque` montent **le même composant** que le
                          // codex — `EcranFamille`, dont le `<h1>` est *Les
                          // sujets*. Un état, pas un repli (`GU15`).
                          familleOuverte ||
                          surface === "codex" ||
                          surface === "bibliotheque"
                          ? "codex"
                          : surface === "fabrications"
                          ? "fabrications"
                          : "galerie"

  // ── B6 · La barre ─────────────────────────────────────────────────────────
  //
  // **Ctrl+K, et Cmd+K sur un Mac.** C'est la touche que tout le monde essaie
  // en premier, et elle ne sert à rien d'autre dans le produit. Comme le guide,
  // elle ne prend jamais la main quand on écrit : une barre qui s'ouvre au
  // milieu d'un prompt fait perdre la phrase.
  const barreOuverte = useBarre()

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return
      if (!e.ctrlKey && !e.metaKey) return
      const cible = e.target as HTMLElement | null
      const saisie =
        cible?.tagName === "INPUT" ||
        cible?.tagName === "TEXTAREA" ||
        cible?.isContentEditable
      if (saisie) return
      e.preventDefault()
      ouvrirBarre()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [])

  /** Ce que le serveur sait faire **maintenant**, dans ce jeu-ci.
   *
   *  Relu à chaque bascule de jeu et à chaque ouverture de la barre : ce qui
   *  est proposé dépend de ce que le jeu contient — un personnage créé fait
   *  paraître quatre gestes —, et une liste vieille de dix minutes montrerait
   *  des gestes morts ou en cacherait de vivants.
   *
   *  **L'écran ne filtre rien** : il affiche ce qu'il reçoit. La règle « ce qui
   *  ne peut pas se faire ne s'affiche pas » est tenue par le serveur, une
   *  fois, plutôt que par chaque écran qui lirait la liste. */
  const [actions, setActions] = useState<Action[]>([])

  useEffect(() => {
    if (!barreOuverte) return
    let vivant = true
    api
      .actions()
      .then((recu) => vivant && setActions(recu.actions))
      .catch(() => vivant && setActions([]))
    return () => {
      vivant = false
    }
  }, [barreOuverte, bibliotheque.courant])



  // **Et à chaque geste qui change la largeur.** Le repli d'un panneau et
  // l'ouverture de la fiche déplacent les colonnes ; la transition de 160 ms
  // fait que la mesure prise ici est celle d'**avant**, et c'est
  // `onTransitionEnd` qui pose la bonne. Les deux servent : sans celle-ci, un
  // onglet où les transitions ne s'exécutent pas ne remesurerait jamais.
  // `onglet` en dépendance parce que la galerie se **démonte** quand un autre
  // onglet est allumé (E1) : sans cette ligne, la largeur mesurée resterait
  // celle d'avant le départ, et le grisé du zoom mentirait au retour.
  // `retoucheOuverte` pour la même raison, depuis le 31 août 2026 : la galerie
  // se démonte aussi quand la retouche s'ouvre par-dessus elle, et la mesure
  // doit se reprendre au retour. L'identifiant plutôt que l'asset trouvé —
  // celui-ci change d'identité à chaque relecture de grille, et ferait courir
  // la mesure pour rien.
  useLayoutEffect(mesurerCentre, [
    mesurerCentre,
    replies.arbre,
    fiche,
    surface,
    retoucheOuverte,
  ])

  // ── Ce que l'atelier sait de lui-même ─────────────────────────────────────

  // Le catalogue est le seul appel que l'interface refait d'elle-même : la
  // liste des modèles dépend de la demande en cours — les proportions, le
  // **nombre d'images réinjectées**, et depuis T4 **le sujet**, qui décide des
  // artworks qui partent —, et c'est le serveur qui décide du grisé de chacun.
  // Tout le reste arrive par le flux.
  const relireCatalogue = useCallback(async () => {
    try {
      const catalogue = await api.modeles(
        proportions,
        reinjections.length,
        echelle,
        // **Le personnage visé décide de ce qui part** : ses concept arts
        // rejoignent les artworks, et ce qu'il écarte s'applique. Le compte
        // vient donc du serveur avec la case sous les yeux.
        cible?.personnage ?? "",
        // **Le lot armé décide de deux choses au serveur** : le gabarit compte
        // dans le plafond du modèle — c'est une image qui part vraiment —, et
        // le défaut devient le modèle de planche du projet plutôt que celui de
        // la famille du sujet.
        cases,
        // **Et la pièce armée** : ses concept arts partent avec l'appel, et le
        // défaut devient le modèle d'édition du projet — habiller un corps est
        // une édition, pas une création de planche.
        cible?.piece ?? "",
        // **Et la première planche** (TS3) : le concept art qui part comme le
        // personnage à reproduire grise d'avance un modèle sans image d'entrée.
        cible?.premierePlanche ?? false,
      )
      setModeles(catalogue.modeles)
      setDefaut(catalogue.defaut)
      // Le compte qui partira vraiment, artworks compris et dédoublonné. Il
      // vient d'ici et jamais d'une addition faite à l'écran : l'écran ne
      // connaît pas les artworks, et deux comptes finiraient par diverger.
      setCompteReferences(catalogue.references)
      setCouts(catalogue.couts ?? {})
      setReserves(
        Object.fromEntries(
          (catalogue.fournisseurs ?? [])
            .filter((f) => f.reserve)
            .map((f) => [f.nom, f.reserve as Reserve]),
        ),
      )
      setCatalogueRepli({
        repli: catalogue.repli,
        raison: catalogue.raison,
        recu_le: catalogue.recu_le,
      })
      setPanne(null)
    } catch (erreur) {
      echouer(erreur, "l'atelier ne répond pas")
    }
  }, [proportions, reinjections.length, echelle, cible?.personnage, cases, cible?.premierePlanche])

  useEffect(() => {
    void relireCatalogue()
  }, [relireCatalogue])

  // ── Ce qui partira : ce n'est plus un dépliant, c'est un écran (E14) ──────
  //
  // « Avant de lancer, le texte exact qui partira s'affiche » (US-158) tient
  // toujours, et sa surface a grandi pour rester vraie. Le dépliant montrait le
  // texte assemblé sans qu'on puisse rien y toucher ; l'écran de confirmation
  // montre chaque texte et chaque image sur sa ligne, avec un interrupteur.
  // C'est une mesure qui l'a fait basculer, pas un goût : sur le plus long appel
  // payé du dépôt, le style pèse 53 % de ce qui part et le sujet 2 %, et un bloc
  // replié qui résume 53 % de l'appel n'est pas un résumé, c'est un angle mort.
  //
  // La composition n'a pas bougé d'un mot : elle est **demandée**, jamais
  // recomposée ici, et c'est le chemin que la soumission emprunte.



  // ── Ce que l'écran redemande au serveur (`C4`) ────────────────────────────
  const {
    fondrePersonnage,
    projetDeLUnivers,
    relireEtat,
    relireLeVestiaire,
    relireLesCalquesAnimes,
    relireClipsDuJeu,
    relireProduction,
    relireTableau,
  } = useRelectures({
    bibliotheque,
    calquesAnimesLieu,
    echouer,
    setCalquesAnimes,
    setCartes,
    setClipsDuJeu,
    setEmplacements,
    setEtat,
    setFabriques,
    setLiens,
    setPersonnages,
    setPieces,
    setPlan,
    setTeintes,
    setUnivers,
    setVestiaireDuJeu,
    vivant,
  })

  // **Un clip qui aboutit se relit dans la liste des clips du jeu.** Sans ça,
  // il n'apparaissait sur la fiche du sujet qu'au rechargement de la page —
  // et la pastille de « Sources & clips » n'avait rien pour s'allumer.
  const clipsAboutis = useMemo(
    () => chantier.filter((g) => g.clip && g.statut === "reussie").map((g) => g.identifiant).sort().join(","),
    [chantier],
  )
  useEffect(() => {
    if (clipsAboutis) void relireClipsDuJeu()
  }, [clipsAboutis, relireClipsDuJeu])

  /** L'univers tel que l'onglet le tient, en une chaîne. Un `ref` et non un
   *  état : il ne rend rien, il ne sert qu'à répondre « est-ce que ce message
   *  change quelque chose ? » au moment où le message arrive. */
  const empreinteUnivers = useRef("")

  // Posé à chaque rendu, lu par le flux : le seul but est de tenir l'abonnement
  // ouvert pendant que ce qu'il consulte, lui, change. Écrit **après** les
  // fonctions qu'il porte — une constante lue avant sa déclaration lève.
  vivant.current = {
    filtre,
    courant: bibliotheque.courant,
    relireCatalogue,
    relireGrille,
    relireEtat,
    fondrePersonnage,
    relireProduction,
    relireLeVestiaire,
    personnages,
  }

  // ── Le flux d'événements — branché dans `flux.ts` depuis `C4` ─────────────
  useFlux({
    vivant,
    empreinteUnivers,
    projetDeLUnivers,
    setBibliotheque,
    setCartes,
    setCatalogueRepli,
    setChantier,
    setEmplacements,
    setEtat,
    setGrille,
    setLiaison,
    setLiens,
    setPanne,
    setPieces,
    setPlan,
    setTeintes,
    setUnivers,
  })

  // ── Le modèle choisi reste choisi ─────────────────────────────────────────
  // Même devenu invalide : c'est générer qui devient inactif, avec sa raison.
  // Aucune substitution silencieuse (US-9).

  const modele = useMemo(
    () => modeles.find((m) => m.identifiant === modeleChoisi) ?? null,
    [modeles, modeleChoisi],
  )

  useEffect(() => {
    if (modeleChoisi || !defaut.modele) return
    setModeleChoisi(defaut.modele)
    setOptions((precedentes) => ({ ...defaut.options, ...precedentes }))
  }, [defaut, modeleChoisi])

  // ── Ce qui part, et ce que ça coûte (`C4`) ────────────────────────────────
  //
  // La signature d'un appel, la raison qui grise *Générer*, la fenêtre de
  // confirmation et le paiement vivent dans `paiement.ts`. `App` leur passe ce
  // qu'ils lisent, et leur reprend les cinq choses que l'écran montre.
  const { enVol, actualisationEnvoi, fermerCeQuiPart, generer, payer, refus, serie } = usePaiement({
    bibliotheque,
    cases,
    chantier,
    setChantier,
    cible,
    setCible,
    directionsCible,
    ecarteesGeneration,
    setEcarteesGeneration,
    echelle,
    echouer,
    enPlanche,
    garderMiseEnPage,
    setGarderMiseEnPage,
    decouperALArrivee,
    setEnvoi,
    envoiOuvert,
    setEnvoiOuvert,
    setEnPaiement,
    paiementEnCours,
    intention,
    liaison,
    modele,
    modeles,
    panne,
    options,
    ouverture,
    posesCible,
    prompt,
    promptNegatif,
    proportions,
    reinjections,
    repris,
    serieSautee,
    setEchecDuPaiement,
    tri,
    setTri,
    triDe,
    setTriDe,
    univers,
    variations,
    // **RV7** : une image partie **vers une case** referme la fenêtre de
    // préparation — rouverte derrière l'écran de confirmation, elle serait
    // revenue « Sans case visée », la cible venant d'être désarmée (US-120).
    // Le retour se lit dans la case, « en cours » puis la vignette. Une image
    // libre garde la fenêtre et son « Générer encore ».
    apresLeDepart: (versUneCase) => { if (versUneCase) setPreparation(null) },
  })

  // ── RV7 : l'avis d'arrivée, dans la fente du châssis ──────────────────────
  //
  // **Un clip qui arrive, ou qui rate, se dit là où l'on est** — la fente est
  // la place des comptes rendus, sur tous les écrans. Le lien mène à la case :
  // la fiche du sujet, onglet des animations, sa pose dépliée. Un avis par
  // travail et par issue : le flux peut redire la même chose, l'écran non.
  const avisDonnes = useRef(new Set<string>())
  useEffect(() => ecouterLesFabrications((d) => {
    if (d.genre !== "travail") return
    const a = d.annonce
    if (a.projet !== bibliotheque.courant || !a.personnage || (a.nature && a.nature !== "animation")) return
    const ratee = a.etat === "a_verifier"
    if (a.etat !== "termine" && !ratee) return
    const cle = `${a.identifiant}:${a.etat}`
    if (avisDonnes.current.has(cle)) return
    avisDonnes.current.add(cle)
    const sujet = personnages.find((p) => p.identifiant === a.personnage)
    const pose = plan.find((p) => p.identifiant === a.pose)?.nom ?? a.pose ?? ""
    const direction = sujet?.cases.find((c) => c.pose === a.pose)?.directions.find((x) => x.identifiant === a.direction)?.nom ?? a.direction ?? ""
    const quoi = [sujet?.nom ?? a.personnage, pose, direction].filter(Boolean).join(" · ")
    const projet = a.projet
    const allerALaCase = () => {
      memoriserParcours(`sujet:${projet}:${a.personnage}:onglet`, "animations")
      if (a.pose) memoriserParcours(`animations:${projet}:${a.personnage}:pose`, a.pose)
      setPreparation(null)
      setFente(null)
      setPile(entrer(poser("codex"), { genre: "sujet", sujet: a.personnage! }))
    }
    setFente({
      ton: ratee ? "echec" : "ok",
      texte: (
        <>
          {quoi} : {ratee ? `ratée${a.raison ? ` — ${a.raison}` : ""}` : "l’animation est arrivée"} —{" "}
          <button type="button" data-avis-d-arrivee={a.identifiant} onClick={allerALaCase} className="underline underline-offset-2 hover:text-encre">
            voir la case
          </button>
        </>
      ),
    })
  }), [bibliotheque.courant, personnages, plan, memoriserParcours])


  // ── Les gestes du vestiaire et des calques d'animation (`C4`) ─────────────
  const {
    ajouterUnEmploi,
    deshabillerUneBande,
    donnerUnePiece,
    habillerUneBande,
    reglerUnCalqueAnime,
    reglerUnEmploi,
    retirerLaPiece,
    retirerUnEmploi,
  } = useVestiaire({
    calquesAnimesLieu,
    echouer,
    emploiOuvertLieu,
    ouvrirLEmploi,
    ouvrirLaPiece,
    relireLeVestiaire,
    relireLesCalquesAnimes,
    relireProduction,
  })

  // ── Les gestes qui arment l'appel suivant (`C4`) ──────────────────────────
  const {
    ajouterUneReference,
    armer: armerLaCible,
    armerPremierePlanche,
    garderLeTexte,
    reinjecter,
    reprendreReglages,
  } = useGestes({
    bibliotheque,
    cible,
    echouer,
    relireProduction,
    setCible,
    setModeleChoisi,
    poserLaRacine,
    setGarderMiseEnPage,
    setOptions,
    setPrompt,
    setPromptNegatif,
    setProportions,
    setProvenance,
    setReinjections,
    setRepris,
    setTri,
    setVariations,
    ouvrirPreparation: () => setPreparation({ type: "image" }),
  })
  const armer = (...parametres: Parameters<typeof armerLaCible>) => void armerLaCible(...parametres)
  // ── L'écran ───────────────────────────────────────────────────────────────

  const redemanderCatalogue = async () => {
    setRelecture(true)
    try {
      await api.rafraichirCatalogue()
    } catch (erreur) {
      echouer(erreur, "l'atelier ne répond pas")
    } finally {
      setRelecture(false)
    }
  }

  const revers =
    catalogueRepli.repli && catalogueRepli.recu_le > 0
      ? {
          texte: "seul générer échouera",
          enCours: relecture,
          onReessayer: redemanderCatalogue,
        }
      : null


  // ── Ce que le carnet et l'en-tête lisent de la surface ouverte ───────────

  const projetCourant =
    bibliotheque.projets.find((p) => p.identifiant === bibliotheque.courant) ?? null

  /** Ce que le carnet montre, famille par famille.
   *
   *  **Les noms portent leur article** — *Les personnages*, *L'interface* —,
   *  et c'est ce que la planche écrit. Ce n'est pas de la coquetterie : la
   *  grille du codex a déjà des boutons nommés *Personnages*, et deux gestes
   *  différents portant le même nom dans la même fenêtre ne se distinguent ni
   *  à l'œil ni à l'oreille.
   *
   *  ⚠️ **Cinq familles, et la planche en montre six** : *Les terrains* n'en
   *  est pas une dans le code, et une ligne qui ne mène nulle part serait pire
   *  qu'une ligne absente. Les terrains arrivent avec les tuiles, hors du
   *  périmètre de la V4. */
  const famillesDuCarnet: LigneDeFamille[] = FAMILLES.map((famille) => {
    const compte = famille.cle === "equipement" ? pieces.length : personnages.filter(
      (p) => (p.famille ?? "personnages") === famille.cle,
    ).length
    return {
      cle: famille.cle,
      nom: NOM_DANS_LE_CARNET[famille.cle] ?? famille.nom,
      compte: compte || null,
    }
  })


  /** Les colonnes que l'écran actif peut replier, **nommées par lui**. La
   *  réserve n'a de bascule qu'en vue toile : sans elle il n'y a pas de
   *  colonne, et une bascule pour une colonne absente mentirait sur ce que
   *  l'écran contient (`docs/DESIGN.md` § Layout). */
  const bascules: Bascule[] =
    surface === "codex" && !choseOuverteId && !familleOuverte
      ? // **Plus de colonnes à replier ici** (`C3`) : l'ancien codex en avait
        // deux, la surface de repos n'en a plus aucune — elle ne porte que la
        // barre qui paie.
        []
      : surface === "univers"
        ? // **La colonne de l'univers n'existe plus** (E7) : ses cinq réglages
          // ont un côté à eux, qui prend l'écran entier. Ne reste que la
          // réserve, et seulement en vue toile — sans elle il n'y a pas de
          // colonne, et une bascule pour une colonne absente mentirait.
          coteUnivers === "inspiration" && vueUnivers === "toile"
          ? [{ cle: "reserve", nom: "réserve", repliee: replies.reserve }]
          : []
        : []

  /** Le fil d'Ariane, **lu depuis la pile et de nulle part ailleurs**.
   *
   *  Chaque étage ramène à sa profondeur, sauf le dernier, qui est l'étage où
   *  l'on est. Remonter, c'est couper la pile — un seul geste au lieu des
   *  quatorze remises à zéro que les anciens `onAller` faisaient à la main. */
  const chemin: Segment[] = filDAriane(
    pile,
    projetCourant?.nom ?? "sans jeu",
    nommerLeLieu({
      choseOuverte,
      clips: clipsDuJeu,
      collectionOuverte,
      groupesDeLaFamille,
      grille,
      personnages,
      pieces,
      vestiaireDuJeu,
      nomsDesTuiles,
    }),
  ).map((etage) => ({
    libelle: etage.libelle,
    onAller:
      etage.profondeur == null
        ? undefined
        : () => {
            const cible = etage.profondeur as number
            setPile((p) => remonterA(p, cible))
            // **Revenir par le nom d'une image la remet en sélection** — donc
            // rouvre sa fiche —, revenir par le mot *Galerie* ne le fait pas.
            // Les deux ramènent au même étage : c'est le rang du nom dans son
            // lieu qui les sépare, pas son libellé.
            // Le rang 1 n'est le nom de l'image que sur la galerie, où le lieu
            // dit *Galerie › l'image › La retouche* ; sous un sujet il est
            // *La retouche* elle-même, dernier étage, qui ne ramène nulle part.
            if (etage.de?.genre === "retouche" && etage.rang === 1) {
              setSelection([etage.de.asset])
            }
          },
  }))

  /** La barre qui paie — **une seule dans tout le produit** (E2), sortie en
   *  fichier propre en `D5` : `composants/BarreQuiPaie.tsx`. Elle sert les
   *  deux lieux d'où l'argent part — l'établi d'une chose et le repos de
   *  l'onglet Créer —, et se retire de tout écran incapable de dépenser. */
  const barreQuiPaie = (
    <BarreQuiPaie
      presentation="preparation"
      onChoisirReference={() => setReferenceDePreparation(true)}
      modeles={modeles}
      modele={modele}
      onChoisirModele={setModeleChoisi}
      proportions={proportions}
      onProportions={setProportions}
      variations={variations}
      onVariations={setVariations}
      garderMiseEnPage={garderMiseEnPage}
      // **Incompatible avec la première planche** (TS3) : sans cette case, la
      // barre ne montre plus « Garder la mise en page de la référence ».
      onGarderMiseEnPage={cible?.premierePlanche ? undefined : setGarderMiseEnPage}
      decouperALArrivee={decouperALArrivee}
      onDecouperALArrivee={setDecouperALArrivee}
      options={options}
      onOptions={setOptions}
      reinjections={reinjections}
      grille={grille}
      onRetirerReinjection={(asset) =>
        setReinjections((deja) => deja.filter((r) => r.asset !== asset))
      }
      onRoleReinjection={(asset, role) => setReinjections((deja) => deja.map((r) => r.asset === asset ? { ...r, role } : r))}
      projetNom={projetCourant?.nom ?? null}
      univers={univers}
      echelle={echelle}
      onEchelle={setEchelle}
      compteReferences={compteReferences}
      cout={modele ? (couts[modele.identifiant] ?? null) : null}
      reserve={modele ? (reserves[modele.fournisseur] ?? null) : null}
      // Combien de cases le lot armé demande, ou zéro. La barre en tire
      // deux choses : ce que le lot coûte — **un appel, pas N** — et ce
      // qu'un compte faux coûterait.
      cases={cases}
      personnageCible={personnageCible}
      posesCible={posesCible}
      onRetirerPose={(pose) =>
        setCible((precedente) => {
          // La forme fonctionnelle, jamais la valeur du rendu : deux retraits
          // rapprochés partagent le même rendu, donc la même liste périmée,
          // et le second effacerait le premier.
          const restantes =
            precedente?.poses.filter((p) => p !== pose.identifiant) ?? []
          return restantes.length && precedente
            ? { ...precedente, poses: restantes }
            : null
        })
      }
      onDesarmer={() => setCible(null)}
      ecarteesGeneration={ecarteesGeneration}
      onEcarterGeneration={setEcarteesGeneration}
      onErreur={setPanne}
      prompt={prompt}
      onPrompt={(texte) => {
        setPrompt(texte)
        // Écrire dedans en fait le texte de l'auteur : la provenance ne
        // décrit plus rien, et la garder mentirait sur qui l'a écrit.
        setProvenance(null)
      }}
      promptNegatif={promptNegatif}
      onPromptNegatif={setPromptNegatif}
      repris={repris}
      /* Rendre la main : le champ redevient le sujet seul. **Il ne se vide
         pas** — on ne perd pas ce qui a été écrit —, et l'atelier reprend son
         habillage par-dessus. Reprendre, lui, s'est déplacé avec le texte
         assemblé : il vit dans l'écran de confirmation, sous ce qui part mot
         pour mot (E14). */
      onRendre={() => setRepris(false)}
      refus={refus?.texte ?? null}
      ouAller={refus?.geste}
      onAller={
        refus?.geste === "Réessayer"
          ? redemanderCatalogue
          : () => setInstallationOuverte(true)
      }
      revers={revers}
      provenance={provenance}
      onDefaireProvenance={() => {
        // **Se défaire ne change rien au réglage durable** : c'est le
        // texte de cet appel-ci qui s'efface, pas la consigne de la
        // pose ni le signalement de la chose.
        setPrompt("")
        setProvenance(null)
      }}
      /* **Il consulte le saut, il ne le désarme pas.** `generer(true)` forçait
         la relecture : la case « ne plus me le montrer pour cette série » était
         alors une case qui ne faisait rien, puisque le seul bouton qui paie
         reprenait l'écran avant même de la lire. Sans l'argument, `generer`
         retrouve sa règle — l'écran s'ouvre, sauf pour la série qu'on vient de
         sauter, et seulement pour celle-là. */
      onGenerer={() => generer()}
      /* **Ce bouton-ci paie directement quand la série est sautée**, et le
         guichet doit alors cesser de promettre une relecture qui n'aura pas
         lieu. */
      sautLaRelecture={serie !== null && serieSautee === serie}
      /* **Le raccourci porte le même verrou** (U1). Quand la série est
         sautée, ce bouton-ci paie sans passer par l'écran de confirmation :
         il doit donc dire qu'il paie et refuser le second clic exactement
         comme l'autre. */
      enPaiement={enPaiement}
      /* **Et le raccourci a besoin du même retour** : quand la série est
         sautée, il n'y a pas d'écran de confirmation où lire l'échec. */
      echec={echecDuPaiement}
      /* **Ce qui est parti se voit là où l'on a payé.** Le chantier ne
         paraissait que dans la grille de la galerie ; le codex et l'établi,
         d'où l'on paie aussi, ne montraient rien du tout. */
      enVol={enVol}
    />
  )

  /** Ouvrir un jeu — carnet, ouverture, et l'ancien `Arbre` un jour.
   *
   *  **Le point dur de `B4`.** `ouvrirProjet` ne rend que la bibliothèque ;
   *  l'univers, lui, ne suit qu'au prochain rebranchement du flux — c'est
   *  l'effet posé sur `bibliotheque.courant`, plus haut, qui referme cet
   *  écart dès que `setBibliotheque` fait avancer cette valeur-ci. Poser la
   *  réponse tout de suite, plutôt que d'attendre l'annonce du flux, évite
   *  un aller-retour de plus pour un geste qui se veut immédiat. */
  const ouvrirJeu = async (identifiant: string | null) => {
    try {
      setBibliotheque(await api.ouvrirProjet(identifiant))
    } catch (erreur) {
      echouer(erreur, "ce jeu ne s'ouvre pas")
    }
  }

  /** Relire l'arbre — **après un geste qui change la liste des jeux**, création
   *  et renommage. Le parcours de `B14` ne rend pas la bibliothèque lui-même :
   *  il ne la tient pas, et deux façons de la poser auraient fini par en
   *  laisser une en retard. */
  const rafraichirLArbre = async () => {
    try {
      setBibliotheque(await api.arbre())
    } catch {
      // Sans conséquence : le nom du carnet se rafraîchira au prochain geste.
    }
  }

  // **Le parcours de création prend la fenêtre entière**, comme l'ouverture —
  // ce sont les deux seuls écrans du produit dans ce cas (`docs/PLAN-carnet.md`
  // § Le châssis). Il fait lui-même les quatre étapes, la première comprise :
  // c'est elle qui crée le jeu. Le champ de nom en ligne qu'`Ouverture` portait
  // avant `B14` a disparu — il était l'étape du nom en plus petit, et à un autre
  // endroit.
  // **Le tour du propriétaire prend la fenêtre entière, avant l'écran
  // d'ouverture** (`B15`) — la planche le dit, et c'est le seul moment où il
  // s'ouvre tout seul. Un troisième écran plein cadre s'ajoute donc aux deux du
  // châssis (`docs/PLAN-carnet.md` § Le châssis), et pour la même raison
  // qu'eux : il n'y a pas encore de jeu à montrer dans le carnet.
  //
  // ⚠️ **Il ne peut pas surgir chez quelqu'un qui travaille** : le serveur ne
  // l'annonce que sur un atelier qui n'a rien produit *et* où le tour n'a jamais
  // été passé. Le fermer l'écrit, et il ne revient plus de lui-même — on le
  // rouvre par le pied du carnet.
  if (tourAOuvrir) {
    return (
      <Installation
        mode="premiere"
        tiroirs={etat?.secrets ?? []}
        modeles={modeles}
        onTiroirs={() => void api.etat().then(setEtat).catch(() => undefined)}
        onFerme={() => {
          tourVu.current = true
          setTourAOuvrir(false)
        }}
        // **Le tour prend la fenêtre entière** : on en sort avant d'ouvrir
        // l'écran qui porte les garde-fous, sinon il resterait dessous sans
        // que rien ne le montre.
        onLesAutresReglages={() => {
          tourVu.current = true
          setTourAOuvrir(false)
          ouvrirLesReglages("agent")
        }}
      />
    )
  }

  if (choixDuJeu === "creer") {
    return (
      <ReglesDuJeu
        mode="creation"
        nomDuJeu=""
        dossierDuJeu={creeParLeParcours}
        onCree={(identifiant) => {
          setCreeParLeParcours(identifiant)
          void rafraichirLArbre()
        }}
        onRenomme={() => void rafraichirLArbre()}
        onFerme={() => {
          // **Le fil d'Ariane repart de l'accueil** (`RV15`) : sans ça, la
          // pile gardait l'endroit qu'on regardait dans le jeu d'avant —
          // parfois un sujet dont l'identifiant n'existe même pas dans le
          // jeu neuf. Fermer le parcours mène donc à l'accueil de ce jeu,
          // comme le ferait un jeu choisi dans le carnet.
          setChoixDuJeu(null)
          setCreeParLeParcours(null)
          poserLaRacine("tableau-de-bord")
        }}
        onErreur={setPanne}
      />
    )
  }

  if (choixDuJeu) {
    return (
      <Ouverture
        bibliotheque={bibliotheque}
        onOuvrir={(identifiant) => {
          void ouvrirJeu(identifiant)
          setChoixDuJeu(null)
        }}
        onCommencer={() => setChoixDuJeu("creer")}
        onSupprimer={async (identifiant) => {
          const reponse = await api.supprimerProjet(identifiant)
          setBibliotheque(reponse.bibliotheque)
        }}
        onReconstruire={async () => {
          const reponse = await api.reconstruire()
          setBibliotheque(reponse.bibliotheque)
        }}
        onFermer={() => setChoixDuJeu(null)}
        onGuide={() => ouvrirGuide()}
        onInstallation={() => setInstallationOuverte(true)}
        onErreur={setPanne}
      />
    )
  }

  return (
    <div className="flex h-full bg-papier">
      <NavigationAtelier
        jeu={projetCourant?.nom ?? "Sans jeu"}
        descriptionJeu={`${projetCourant?.assets ?? 0} images dans ce jeu`}
        actif={installationOuverte || reglesOuvertes ? "reglages" : sortieOuverte ? "livraison" : tuilesOuvertes || sonsOuverts ? "assets" : surface === "fabrications" ? "fabrications" : tableauDeBord ? "jeu" : surface === "univers" ? "univers" : surface === "galerie" ? "galerie" : "assets"}
        // **Toutes les familles, pas une seule** (`RP16`) : les emplacements
        // d'images encore en route, et les travaux du serveur qui ne sont ni
        // finis ni annulés — animations, équipements, images locales, vidéos
        // libres, 3D, sons.
        travauxEnCours={(enVol?.images ?? 0) + enPlan.fabricationsEnCours}
        brouillons={enPlan.nombre}
        onBrouillons={() => setTiroirDesBrouillons(true)}
        replie={navigationRepliee}
        onReplier={setNavigationRepliee}
        onAller={(destination) => {
          setFente(null)
          if (destination === "jeu") setPile(poser("tableau-de-bord"))
          else if (destination === "assets") allerA("bibliotheque")
          else if (destination === "univers") allerA("univers")
          else if (destination === "galerie") allerA("galerie")
          else if (destination === "fabrications") allerA("fabrications")
          // Et symétriquement : les réglages et la machine se referment devant
          // la sortie, sinon la porte ne mènerait nulle part.
          else if (destination === "livraison")
            setPile((p) =>
              entrer(sortir(sortir(p, "installation"), "regles"), { genre: "sortie" }),
            )
          // **Le mot *Réglages* ouvre les réglages** (`RP2`). Il ouvrait
          // l'installation de la machine — les clés, ComfyUI, le dossier de
          // travail —, et les quatre règles du jeu n'avaient plus de porte.
          else ouvrirLesReglages()
        }}
        onChangerJeu={() => setChoixDuJeu("jeux")}
        onGuide={() => ouvrirGuide()}
        onRecherche={ouvrirBarre}
        etatAtelier={!liaison ? "L’atelier ne répond pas" : undefined}
      />

      <div className="grid min-w-0 flex-1 grid-rows-[34px_minmax(0,1fr)_26px] bg-papier">
      {/* **L'en-tête de la surface** (`C9`) — 34 px de papier, à la place des
          44 px de `BarreChassis.tsx`. Elle porte les six choses que la barre
          portait en dehors des onglets ; les onglets, eux, sont partis avec
          elle : le carnet est le seul chemin. */}
      <EnTeteDeSurface
        preferencesDansNavigation
        chemin={chemin}
        // **Le nom du jeu ne s'écrit qu'une fois dans la bande.** Déployé, le
        // fil le porte à son premier étage ; sans fil, c'est le total qui le
        // porte.
        nomDuJeu={chemin.length ? null : (projetCourant?.nom ?? "sans jeu")}
        montant={dollars(
          projetCourant ? projetCourant.total_usd : bibliotheque.sans_projet.total_usd,
        )}
        // **Le total ouvre l'écran qui l'explique.**
        onDepenses={() => {
          setFente(null)
          setDepensesOuvertes(true)
        }}
        // **L'état de la clé, dès la première seconde** (E19), lu une seule
        // fois : la même valeur à deux endroits est deux endroits à tenir
        // d'accord. **Avec quoi on peut produire** (F3), et non plus ce qui
        // manque.
        tiroirs={etat?.secrets ?? null}
        // La clé manque : on arrive là où on la dépose, pas ailleurs.
        onReglagesCle={() => ouvrirLesReglages("moteurs")}
        bascules={depensesOuvertes ? [] : bascules}
        onBasculer={(cle) => setReplies((r) => ({ ...r, [cle]: !r[cle] }))}
        fente={fente}
        // **Le même écran que la porte de la colonne** (`RP2`) : il n'y a plus
        // qu'une seule porte vers les réglages.
        onReglages={() => ouvrirLesReglages()}
        onGuide={() => ouvrirGuide()}
      />

      {/* **La découpe est une profondeur de la galerie, pas un écran posé
          dessus.** Elle occupait tout l'écran ; elle occupe maintenant la même
          case que la grille, et c'est le fil d'Ariane qui dit qu'on est
          descendu — `Cœur de pierre › Galerie › tonneau-cerclé-02 ›
          Découpage`. Elle disparaîtra en E3, quand le découpage deviendra la
          première des deux fabriques de la barre des tables ; d'ici là elle
          garde sa porte, celle de la fiche. */}
      {/* **Une profondeur de l'onglet où l'on se trouve, quel qu'il soit.** Il
          s'ouvre depuis le total de la barre de tête, qui est sur les trois ;
          il n'a donc pas de lieu à lui, parce qu'il ne parle d'aucun des
          trois — il parle de l'atelier entier. */}
      {depensesOuvertes && !envoiOuvert && (
        <EcranDepenses
          projetCourant={bibliotheque.courant}
          onErreur={setPanne}
          onFermer={() => setDepensesOuvertes(false)}
        />
      )}

      {/* ── Les réglages, en quatre onglets (`B14`, rangés par `RP2`) ───────
          **La seule porte vers les réglages**, et son premier onglet est le
          parcours de création du jeu dans son autre mode — les quatre
          questions qui partent dans chaque demande d'image ne sont écrites
          qu'une fois.

          Il prend la même ligne de grille que les dépenses, et la même chaîne
          de gardes : il n'appartient à aucune des quatre racines — les règles
          sont celles du jeu, et on les rouvre d'où qu'on vienne. Une demande de
          l'agent ouverte depuis l'onglet *Agent MCP* passe devant, comme
          l'installation ouverte depuis *Moteurs & workflows*. */}
      {reglesOuvertes &&
        !installationOuverte &&
        !travailOuvert &&
        !depensesOuvertes &&
        !envoiOuvert &&
        (
          <Reglages
            onglet={ongletDesReglages}
            onOnglet={setOngletDesReglages}
            nomDuJeu={projetCourant?.nom ?? ""}
            dossierDuJeu={bibliotheque.courant}
            tiroirs={etat?.secrets ?? null}
            agent={etat?.agent ?? null}
            modeles={modeles}
            onDeposee={() => {
              void api.etat().then(setEtat).catch(() => undefined)
              void relireCatalogue()
            }}
            // **Ce que le serveur vient de rendre, posé tel quel.** Le PUT rend
            // le cadre entier et sa consommation ; recalculer l'un des deux ici
            // ferait deux vérités sur le même chiffre — et l'événement `agent`
            // arrive de toute façon derrière.
            onAgent={(agent) => setEtat((e) => (e ? { ...e, agent } : e))}
            onRenomme={() => void rafraichirLArbre()}
            onInstallation={() => setInstallationOuverte(true)}
            onTravail={(travail) => setPile((p) => entrer(p, { genre: "travail", travail }))}
            onFerme={() => setReglesOuvertes(false)}
            onErreur={setPanne}
          />
        )}

      {/* ── L'installation de la machine (`B15`) ────────────────────────────
          **Le même écran que le tour de première ouverture, et les mêmes
          écritures** — un fichier, deux modes, comme `B14`. Ce qui change est
          ce qui l'entoure : ici le carnet reste visible, parce qu'on revient
          régler une machine qui tourne.

          Même ligne de grille que les réglages, et elle passe devant eux :
          l'onglet *Moteurs & workflows* y mène, et la refermer y ramène. */}
      {installationOuverte &&
        !travailOuvert &&
        !depensesOuvertes &&
        !envoiOuvert &&
        (
          <Installation
            mode="reglages"
            tiroirs={etat?.secrets ?? []}
            modeles={modeles}
            onTiroirs={() => void api.etat().then(setEtat).catch(() => undefined)}
            onFerme={() => setInstallationOuverte(false)}
            // Les garde-fous de l'agent et les mouvements ont leur onglet
            // depuis `RP2` ; ce bouton y mène, en refermant la machine.
            onLesAutresReglages={() => {
              setInstallationOuverte(false)
              ouvrirLesReglages("agent")
            }}
          />
        )}

      {/* ── La sortie (`B21`) ───────────────────────────────────────────────
          **Un seul écran, là où il y avait quatre boutons.** Il prend la même
          ligne de grille et la même chaîne de gardes que les règles et
          l'installation : il n'appartient à aucune des quatre racines, et on
          l'ouvre d'où qu'on vienne.

          Le carnet reste visible — sortir n'est pas un parcours dont on ne
          revient pas, c'est un geste qu'on refait cinquante fois. */}
      {sortieOuverte &&
        !reglesOuvertes &&
        !installationOuverte &&
        !depensesOuvertes &&
        !envoiOuvert &&
        (
          <Livraisons
            projet={projetCourant?.identifiant ?? null}
            filtre={filtreDeSortie}
            onFerme={() => setSortieOuverte(false)}
            onErreur={(refus) => setPanne(refus.message)}
          />
        )}

      {/* ── Les jeux de tuiles (`TU3`) ──────────────────────────────────────
          **Un lieu, plus un dialogue** : la même ligne de grille et la même chaîne
          de gardes que la sortie. Il se pose sur la racine d'où l'on vient — les
          familles, le plus souvent —, et le fil dit *Les tuiles › son nom*. */}
      {tuilesOuvertes &&
        bibliotheque.courant &&
        !reglesOuvertes &&
        !installationOuverte &&
        !sortieOuverte &&
        !travailOuvert &&
        !depensesOuvertes &&
        !envoiOuvert &&
        (
          <Tuiles
            key={bibliotheque.courant}
            projet={bibliotheque.courant}
            vue={vueDesTuiles}
            onVue={allerDansLesTuiles}
            onNoms={setNomsDesTuiles}
            // « Mes matières » n'est plus calculé ici (RG6) : l'écran des tuiles lit la
            // bibliothèque du projet, et aucun sujet n'est consulté.
            tailleDuJeu={tailleDeLUnivers(univers)}
            paletteUnivers={univers.palette}
            onAsset={(a) => setPile(entrer(poser("galerie"), { genre: "retouche", asset: a.identifiant }))}
            onLivraisons={(jeu) => setPile((p) => entrer(sortir(p, "tuiles"), { genre: "sortie", ...(jeu ? { filtre: { genre: "tuiles", jeu } } : {}) }))}
            onUnivers={() => allerA("univers")}
          />
        )}

      {/* ── Les sons du jeu (`RT8`) ─────────────────────────────────────────
          **Un lieu, comme les tuiles juste au-dessus** — la même chaîne de
          gardes, et pour la même raison : il se pose sur la racine d'où l'on
          vient, la navigation de gauche reste en place, et la porte qui y
          mène (*Les sons*, sous « Ailleurs dans le jeu ») reste marquée
          active, comme celle des tuiles.

          Point dur tranché ici (`RT8`) : ni `onFermer` ni un bouton *Fermer*
          — exactement comme *Les tuiles*, qui n'en a pas non plus. Un lieu
          posé sur la pile se quitte en cliquant ailleurs dans la navigation
          ou le fil d'Ariane, pas par un geste qui lui serait propre ; lui en
          donner un aurait recréé, en plus petit, le bouton unique du dialogue
          qu'on vient de retirer. `onLivraisons` seul reste : c'est un aller
          vers un autre lieu (*Livrer au jeu*), pas une fermeture, exactement
          comme `onLivraisons` des tuiles ci-dessus. */}
      {sonsOuverts &&
        bibliotheque.courant &&
        !reglesOuvertes &&
        !installationOuverte &&
        !sortieOuverte &&
        !travailOuvert &&
        !depensesOuvertes &&
        !envoiOuvert &&
        (
          <AtelierSon
            key={bibliotheque.courant}
            projet={bibliotheque.courant}
            identifiantInitial={sonsOuverts.identifiant}
            onFabriquer={() => { setCible(null); setPreparation({ type: "son" }) }}
            onLivraisons={(son) => setPile((p) => entrer(sortir(p, "sons"), { genre: "sortie", ...(son ? { filtre: { genre: "son", son } } : {}) }))}
          />
        )}

      {/* ── Ce qui part, entre le bouton et la dépense (E14) ──────────────
          **Il s'intercale, il ne remplace rien.** Il prend la ligne du milieu,
          comme les dépenses, parce qu'il n'appartient à aucun des trois onglets :
          il paraît partout où l'on paie. Il n'a pas besoin de la barre qui paie
          sous lui — c'est lui qui porte le bouton, cette fois, et il n'y a
          toujours qu'un seul endroit d'où l'argent part. */}
      {envoiOuvert && (
        <EcranEnvoi
          presentation="atelier"
          actualisation={actualisationEnvoi}
          reglages={{ proportions, variations: cases ? 1 : variations, options }}
          envoi={envoi}
          tri={tri}
          onTri={setTri}
          onImage={(asset, cochee) =>
            setEcarteesGeneration((deja) => {
              // **La portée de cette génération-là décide seule quand elle a un
              // avis** (US-126). La première coche la fabrique à partir de ce
              // que le serveur écarte déjà, sinon décocher une image
              // rallumerait toutes celles que les portées durables retiennent.
              const base =
                deja ??
                (envoi?.images.lignes ?? [])
                  .filter((l) => !l.cochee)
                  .map((l) => l.asset)
              return cochee
                ? [...base.filter((a) => a !== asset), asset]
                : base.filter((a) => a !== asset)
            })
          }
          onPayer={() => void payer()}
          /* **Le bouton dit qu'il paie, et n'accepte pas de second clic** (U1).
             Il ne redevient cliquable que si l'appel échoue : quand il réussit,
             l'écran se referme avec lui. */
          enPaiement={enPaiement}
          /* **L'appel qui n'est pas passé se lit là où on a cliqué** (U1), et
             il ne grise pas le bouton : ce qu'on veut faire d'un appel raté est
             le refaire. */
          echec={echecDuPaiement}
          onFermer={() => {
            setReferenceDePreparation(false)
            fermerCeQuiPart()
          }}
          onGarder={(ligne) => void garderLeTexte(ligne)}
          onSauter={
            serie === null
              ? null
              : (saute: boolean) => setSerieSautee(saute ? serie : null)
          }
          /* **Reprendre pose le texte exact, et referme l'écran** : le champ
             *est* désormais ce qui partira, et le relire ligne par ligne
             n'aurait plus de lignes à montrer — il n'y a plus de bible d'un côté
             et de sujet de l'autre, il y a un texte. */
          onReprendre={(texte) => {
            setPrompt(texte)
            setRepris(true)
            fermerCeQuiPart()
          }}
          refus={refus?.texte ?? null}
          /* **L'adresse de l'image que la planche joint** (M4). Elle se compose
             ici et pas dans l'écran, parce que c'est ici que vivent les repères
             de l'appel — le même endroit qui les envoie déjà à la confirmation.
             Elle décrit donc exactement l'appel qui vient d'être composé. */
          plancheJointe={
            envoi?.images.jointe && modele
              ? api.plancheJointe({
                  modele: modele.identifiant,
                  projet: bibliotheque.courant,
                  personnage: cible?.personnage ?? null,
                  pose:
                    !cases || enPlanche
                      ? (posesCible[0]?.identifiant ?? null)
                      : null,
                  piece: cible?.piece ?? null,
                  poses:
                    cases && !enPlanche
                      ? posesCible.map((p) => p.identifiant)
                      : null,
                  directions: enPlanche ? directionsCible : null,
                })
              : null
          }
          /* **Ajouter une référence sans refermer** (M5). Le geste vit dans la
             section des images jointes, là où l'on vient de voir qu'il en
             manquait une. */
          onAjouterUneReference={() => setReferenceDePreparation(true)}
        />
      )}

      {/* ── Le tableau de bord du jeu — le seul lieu que `B0` branche ──────
          Il prend la surface, jamais la fenêtre : le carnet reste à gauche. Il
          n'a pas de fil d'Ariane, parce qu'il est le haut du jeu — c'est de lui
          qu'on descend, et c'est vers lui qu'on remonte. */}
      {surfaceDisponible && tableauDeBord && !bandeOuverte && !depensesOuvertes && !envoiOuvert && (
        <TableauDeBord
          jeu={projetCourant?.nom ?? "sans jeu"}
          images={projetCourant?.assets ?? 0}
          depense={
            projetCourant
              ? projetCourant.total_usd
              : bibliotheque.sans_projet.total_usd
          }
          generations={null}
          familles={famillesDuCarnet}
          feuilleEnAttente={
            chantier.find((g) => g.pliage?.attend_un_choix === true) ?? null
          }
          surLaFamille={ouvrirLaFamille}
          surLeSujet={(id) => { memoriserParcours(`sujet:${bibliotheque.courant}:${id}:onglet`, "objectif"); setPile(entrer(poser("codex"), { genre: "sujet", sujet: id })) }}
          surDemanderUneImage={() => { setCible(null); setPreparation({ type: "image" }) }}
          surCreerUnAsset={() => setCreationAssetOuverte("personnages")}
          // **La galerie montre déjà la tuile en attente** (elle en tient le
          // chantier) : B5 n'ouvre donc aucun lieu de plus, elle y ramène.
          surAllerDecouper={() => setPile(poser("galerie"))}
          surLaToile={() => allerA("univers")}
          surLesAssets={() => allerA("bibliotheque")}
          surLesFabrications={() => allerA("fabrications")}
          surLivrer={() => setSortieOuverte(true)}
        />
      )}

      {/* ── La porte « Codex » — **la même grille qu'une famille** (`RP7`)
          Elle montre toutes les familles ; ouvrir une famille montre la même
          grille restreinte. Un seul composant, un seul appel, un seul type de
          glisser : `BibliothequeDesAssets.tsx` est parti le 16 septembre 2026. */}
      {surfaceDisponible && !bandeOuverte && !depensesOuvertes && !envoiOuvert && surface === "bibliotheque" && (
        <EcranFamille key={`${bibliotheque.courant}:${lieu(pile, "bibliotheque")?.famille ?? ""}`}
          famille={lieu(pile, "bibliotheque")?.famille ?? null}
          nom={NOM_DANS_LE_CARNET[lieu(pile, "bibliotheque")?.famille ?? ""]}
          jeu={bibliotheque.courant ?? ""} pieces={pieces} personnages={personnages} univers={univers} rafraichi={grilleARelire}
          surGroupes={setGroupesDeLaFamille} surCollection={setCollectionOuverte}
          surFamille={ouvrirLaFamille} surToutesLesFamilles={() => allerA("bibliotheque")}
          surRange={() => void api.arbre().then(setBibliotheque).catch(() => {})}
          surReglages={() => setReglagesDeFamille(true)} surErreur={setPanne}
          onTuiles={ouvrirLesTuiles} onSons={ouvrirLesSons}
          onOuvrir={(id) => { setPile(entrer(poser("codex"), { genre: "sujet", sujet: id })) }}
          onCree={fondrePersonnage}
          onPiece={ouvrirLaPiece} onGalerie={() => allerA("galerie")}
          onCreer={(famille) => setCreationAssetOuverte(famille)} onCommanderPlusieurs={() => setCommanderPlusieursOuvert(true)} />
      )}

      {surfaceDisponible && !bandeOuverte && !depensesOuvertes && !envoiOuvert && surface === "fabrications" && montageOuvert && (
        /* **Le clip ouvert depuis les fabrications** reste chez elles : il en
           prend la place, et « revenir » y ramène. */
        <EcranMontage
          clip={montageOuvert}
          personnages={personnages}
          retour="Fabrications"
          onBande={ouvrirLAtelierDeBande}
          onFermer={() => setMontageOuvert(null)}
          onErreur={(raison) => setPanne(raison)}
        />
      )}

      {surfaceDisponible && !bandeOuverte && !depensesOuvertes && !envoiOuvert && surface === "fabrications" && !montageOuvert && (
        <Fabrications projet={bibliotheque.courant} chantier={chantier} clips={clipsDuJeu} personnages={personnages}
          onSon={ouvrirLesSons}
          onAsset={(id) => setPile(entrer(poser("galerie"), { genre: "retouche", asset: id }))}
          onToile={(id) => { if (bibliotheque.courant) void api.poserAssetSurToile(bibliotheque.courant, id).then(async () => { await relireTableau(); allerA("univers") }).catch((e) => echouer(e, "L’image n’a pas pu être posée sur la toile.")) }}
          onCalqueEquipement={(piece, emploi, cible, variante) => setPile(entrer(entrer(poser("codex"), { genre: "piece", piece }), { genre: "emploi", piece, emploi, cible, variante }))}
          onBande={ouvrirLAtelierDeBande}
          onCreer={() => { setCible(null); setPreparation({ type: "image" }) }} onGalerie={() => allerA("galerie")}
          onMethodesLocales={() => ouvrirLesReglages("moteurs")}
          onClip={ouvrirLeMontage}
          onSujet={(id) => { memoriserParcours(`sujet:${bibliotheque.courant}:${id}:onglet`, "animations"); setPile(entrer(poser("codex"), { genre: "sujet", sujet: id })) }}
          onDepenses={() => setDepensesOuvertes(true)} />
      )}

      {/* ── La galerie (`C4`) ───────────────────────────────────────────────
          Elle a son fichier depuis `C4` : `composants/Galerie.tsx`. Ce qui suit
          n'est plus que la condition de son montage — la même qu'avant, aux
          mêmes mots. */}
      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && !tableauDeBord && surface === "galerie" &&
        !imageDeLaRetouche && !bandeOuverte && (
        <Galerie
          g={galerie}
          bibliotheque={bibliotheque}
          echouer={echouer}
          etat={etat}
          montageOuvert={montageOuvert}
          setMontageOuvert={setMontageOuvert}
          ouvrirLAtelierDeBande={ouvrirLAtelierDeBande}
          ouvrirLaRetouche={ouvrirLaRetouche}
          onSon={ouvrirLesSons}
          onSource3D={setSource3Douverte}
          personnages={personnages}
          plan={plan}
          reinjecter={reinjecter}
          reprendreReglages={reprendreReglages}
          setChantier={setChantier}
          setChoseOuverte={setChoseOuverte}
          poserLaRacine={poserLaRacine}
          setPanne={setPanne}
          univers={univers}
        />
      )}

      {/* **Les deux autres onglets, dans la même case de grille.** Ils ne
          couvrent plus rien : ils occupent la ligne du milieu, entre la barre du
          châssis et la barre d'état, exactement comme la galerie. C'est ce qui
          leur retire leur en-tête de 44 px — il y en avait trois, un par écran,
          et il n'y en a plus qu'un — et leur fente de refus, désormais
          partagée. */}
      {/* **La garde sur `etat` est partie avec l'assistant** (`C2`) : elle
          existait parce que le côté Réglages avait besoin de savoir quelles
          façons de réduire cette machine-ci sait faire. Les deux côtés qui
          restent ne lisent que le tableau. */}
      {surfaceDisponible && !bandeOuverte && !depensesOuvertes && !envoiOuvert && surface === "univers" && (
        <EcranUnivers
          projet={bibliotheque.courant ?? ""}
          cartes={cartes}
          liens={liens}
          teintes={teintes}
          personnages={personnages}
          cote={coteUnivers}
          onCote={setCoteUnivers}
          vue={vueUnivers}
          onVue={setVueUnivers}
          replies={{ univers: replies.univers, reserve: replies.reserve }}
          onFente={setFente}
          onRelire={relireTableau}
          fabriques={fabriques}
          // **Aller voir ce qu'on vient de fabriquer** (U7) : le côté change et
          // l'objet s'ouvre, en un geste. La cible est consommée par le côté
          // Ambiances, qui la rend ensuite — sans quoi rouvrir l'onglet
          // rouvrirait toujours la même palette.
          onAllerAuxAmbiances={(cible) => {
            setCoteUnivers("ambiances")
            setCibleAmbiances(cible)
          }}
          cibleAmbiances={cibleAmbiances}
          onCibleVue={() => setCibleAmbiances(null)}
          // **Découper une carte, depuis son menu** (06bis). L'état monte jusqu'ici
          // parce que le fil d'Ariane le nomme ; l'écran, lui, se rend en bas,
          // à la place du tableau.
          carteDecoupee={carteDecoupee}
          onDecouperCarte={setCarteDecoupee}
          // TS2 — le panneau d'une carte image ouvre « Créer un sujet »,
          // pré-remplie avec elle ; une carte déjà concept art ouvre son sujet.
          onCreerSujet={(carte) => {
            setCarteSourceDuSujet(carte)
            setCreationAssetOuverte(carte.famille !== "tous" ? carte.famille : "personnages")
          }}
          onOuvrirSujet={(id) => {
            memoriserParcours(`sujet:${bibliotheque.courant}:${id}:onglet`, "objectif")
            setPile(entrer(poser("codex"), { genre: "sujet", sujet: id }))
          }}
          // **Une carte découpée en animation ouvre son atelier** (`RP21`),
          // la même porte que depuis la découpe d'une planche.
          onAnimerCarte={(bandes) => {
            if (bandes.length > 0) ouvrirLAtelierDeBande(bandes[0].identifiant)
          }}
          // **La toile donne du travail** (`RP9`). Les cartes choisies entrent
          // en références de la prochaine demande — **en guide de style, et
          // jamais autrement** : la bibliothèque ne connaît pas les cartes,
          // donc aucune filiation ne peut en descendre. Les notes, si l'auteur
          // l'a dit, s'ajoutent en consigne au bas du texte.
          //
          // **Aucune troisième place ne paie** (E2) : le geste ouvre la
          // préparation qui existe, et rien ne part avant qu'on y ait relu ce
          // qui part.
          onFabriquerDepuisLaToile={(cartesChoisies, notes) => {
            setCible(null)
            setReinjections((deja) => [
              ...deja.filter((r) => !cartesChoisies.includes(r.asset)),
              ...cartesChoisies.map((carte) => ({
                asset: carte,
                role: "style" as const,
                origine: "carte" as const,
              })),
            ])
            if (notes.length)
              setPrompt((texte) => [texte.trim(), ...notes].filter(Boolean).join("\n"))
            setPreparation({ type: "image" })
          }}
        />
      )}

      {/* ── La grille d'une famille (`B9`) ─────────────────────────────────
          **Elle remplace le codex comme destination du carnet**, elle ne s'ajoute
          pas à côté : cliquer « Les personnages » ouvrait l'ancien écran, et
          deux écrans pour le même geste auraient été deux vérités sur ce qu'est
          une famille. Nommer une chose neuve se fait maintenant depuis cet
          écran lui-même — plus par un aller-retour vers le codex (`C3`). */}
      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && familleOuverte && !choseOuverte && !bandeOuverte && !imageDeLaRetouche && !sujetDeLaGrille && !sujetDuComparateur && !pieceOuverte && (
        <EcranFamille
          famille={familleOuverte}
          nom={NOM_DANS_LE_CARNET[familleOuverte] ?? familleOuverte}
          jeu={bibliotheque.courant ?? ""}
          collectionInitiale={collectionOuverte}
          pieces={pieces}
          personnages={personnages}
          univers={univers}
          rafraichi={grilleARelire}
          surGroupes={setGroupesDeLaFamille}
          // La collection ouverte n'est pas un lieu, mais le fil la nomme : la
          // grille la choisit, et le fil l'apprend d'elle.
          surCollection={setCollectionOuverte}
          surFamille={ouvrirLaFamille}
          surToutesLesFamilles={() => allerA("bibliotheque")}
          onPiece={ouvrirLaPiece}
          onGalerie={() => allerA("galerie")}
          onTuiles={ouvrirLesTuiles}
          onSons={ouvrirLesSons}
          onCreer={(famille) => setCreationAssetOuverte(famille)}
          onCommanderPlusieurs={() => setCommanderPlusieursOuvert(true)}
          // Le carnet compte les groupes ; un rangement fait dans la grille
          // doit donc redescendre jusqu'à lui, sans quoi la ligne resterait à
          // son chiffre d'avant.
          surRange={() => void api.arbre().then(setBibliotheque).catch(() => {})}
          surReglages={() => setReglagesDeFamille(true)}
          surErreur={setPanne}
          onCree={fondrePersonnage}
          onOuvrir={setChoseOuverte}
        />
      )}

      {reglagesDeFamille && familleOuverte && (
        <ReglagesDeFamille
          famille={familleOuverte}
          nom={NOM_DANS_LE_CARNET[familleOuverte] ?? familleOuverte}
          onFermer={() => setReglagesDeFamille(false)}
          onErreur={setPanne}
        />
      )}

      {/* **Le repos de l'onglet Créer** (`C3` — `Codex.tsx` est parti). Sa
          colonne des familles était le carnet, sa grille était celle d'une
          famille : les deux existaient déjà ailleurs. Ce qui restait sans
          maison neuve est la barre qui paie elle-même — **l'un des deux lieux
          d'où l'argent part**, l'autre étant l'établi d'une chose — donc cette
          surface ne porte plus qu'elle, sans colonnes. */}
      {/* ⚠️ **Et pas non plus quand une pièce est ouverte** (`B19`) : la page
          d'une pièce se pose ici comme la grille d'une famille. */}
      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && surface === "codex" && !choseOuverte && !familleOuverte && !pieceOuverte && !bandeOuverte && !imageDeLaRetouche && !sujetDeLaGrille && !sujetDuComparateur && (
        <div
          data-codex
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-papier p-4"
        >
          <p className="mesure max-w-[420px] text-center text-[12px] leading-5 text-encre-4">
            Choisis une famille dans le carnet à gauche, nomme un sujet du jeu,
            ou écris directement ce que tu veux fabriquer.
          </p>
          <input
            value={nomDeLaCreationRapide}
            onChange={(e) => setNomDeLaCreationRapide(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void creerRapidement() }}
            disabled={creationRapideEnCours}
            placeholder="nommer un sujet du jeu"
            aria-label="Nom du sujet du jeu à créer"
            className="mesure h-[34px] w-full max-w-[380px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre outline-none"
          />
          <button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal" onClick={() => { setCible(null); setPreparation({ type: "image" }) }}>Fabriquer une image libre</button>
        </div>
      )}

      {/* **L'atelier d'une animation gardée** (A7) — il passe avant la
          matrice pour la raison du montage : les deux ne peuvent pas être
          ouverts ensemble, on ne corrige pas une animation depuis un écran
          qui en montre douze. */}
      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && bandeOuverte && etat ? (
        montageDeLaBande ? (
        /* **Le montage rouvert sur cette animation** (V3.03.3). Il prend la
           place de l'atelier, comme l'atelier prend celle de la matrice : ce
           n'est pas une fenêtre par-dessus, c'est la profondeur suivante du
           même endroit. Revenir refait naître l'atelier, qui relit donc
           l'animation sur le disque — y compris ce que le montage vient d'y
           écrire. */
        <EcranMontage
          clip={montageDeLaBande.clip}
          personnages={personnages}
          onBande={(id) => { setMontageDeLaBande(null); setPile((p) => entrer(p, { genre: "bande", bande: id })) }}
          reprise={{
            bande: montageDeLaBande,
            onRepris: () => {
              setMontageDeLaBande(null)
              void relireProduction()
            },
          }}
          onFermer={() => setMontageDeLaBande(null)}
          onErreur={(raison) => setPanne(raison)}
        />
        ) : (
        <EcranAtelierDeBande
          identifiant={bandeOuverte}
          // **Les tables de l'établi, posées sur une frame** (V3.03.1). Elles
          // ont besoin de ce que l'établi leur donne : la palette du jeu, et ce
          // que la machine sait faire — quels moteurs de détourage répondent,
          // quelles réductions sont disponibles. Les deux vivent déjà ici, et
          // les redemander depuis l'atelier serait un second état de la même
          // chose, qui finirait par griser autre chose que l'établi.
          univers={univers}
          traitement={etat.traitement}
          onFermer={() => ouvrirLAtelierDeBande(null)}
          onErreur={(raison) => setPanne(raison)}
          // La planche a changé sur le disque, et la matrice l'affiche
          // aussi : une vignette qui montrerait l'ancienne serait un
          // mensonge silencieux.
          onChangee={() => void relireProduction()}
          onReprendreLeMontage={setMontageDeLaBande}
          onVersLeSujet={(id) => { memoriserParcours(`sujet:${bibliotheque.courant}:${id}:onglet`, "animations"); setPile(entrer(poser("codex"), { genre: "sujet", sujet: id })) }}
          nomDuSujet={(id) => personnages.find((p) => p.identifiant === id)?.nom}
        />
        )
      ) : null}

      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && surface === "codex" && choseOuverte && !pieceOuverte && !bandeOuverte && !sujetDeLaGrille && !sujetDuComparateur && !imageDeLaRetouche && (
        /* **La page du sujet, et non plus sa matrice** (B10) : on arrive sur la
           chose, quatre onglets sur un seul écran. La matrice est devenue une
           profondeur de cette page — elle porte encore le vestiaire, les
           planches, le calibrage, la vitrine et la commande d'un clip, que B10
           ne reprend pas. Les rappels ci-dessous sont ceux d'avant, aux mêmes
           signatures : la page en sert la moitié et passe l'autre à la
           matrice. */
        <PageDuSujet
          // **RV6** : sur l'onglet *Animations*, « Fabriquer… » ouvre un clip
          // pour ce sujet ; ailleurs, une image, comme avant.
          onFabriquer={(onglet) => setPreparation(onglet === "animations" ? { type: "clip", sujet: choseOuverteId ?? undefined } : { type: "image" })}
          onImporter={(cible) => setImportDuSujet(cible ?? {})}
          onDecouper={(id) => ouvrirLaRetouche(id, "decoupage")}
          onExtraire={(id) => ouvrirLaRetouche(id, "superposition")}
          onLivrer={() => choseOuverteId && setSortieOuverte(true, { genre: "sujet", sujet: choseOuverteId })}
          onSon={ouvrirLesSons}
          ouvert={choseOuverte}
          plan={plan}
          // **L'onglet survit au montage de la retouche** (`B25`) : elle prend
          // la place de cette page, et une page démontée oublie le sien.
          onglet={ongletDuSujet}
          onOnglet={setOngletDuSujet}
          clips={clipsDuJeu}
          clipsLus={clipsDuJeuLus}
          onClipsChange={() => void relireClipsDuJeu()}
          onObjectifChange={() => void relireProduction()}
          /* **B12** — l'essai pose un second sujet à côté pour comparer les
             tailles en mouvement, et règle sa scène sur la case et la couleur
             de fond du jeu. Les deux sont déjà ici ; les relire aurait fait
             deux vérités. */
          personnages={personnages}
          univers={univers}
          onPersonnage={fondrePersonnage}
          emplacements={emplacements}
          pieces={pieces}
          onArmer={armer}
          onPremierePlanche={armerPremierePlanche}
          onAllerALaToile={() => { setPreparation(null); setVueUnivers("toile"); allerA("univers") }}
          /* **Animer une case ouvre la fenêtre unique de préparation, en mode
             clip** (A9, RP4, RV6). Onze portes du produit passaient par
             `EcranClip` ou `AnimerEnLot` chacune à sa façon ; elles ouvrent
             maintenant toutes le même écran, déjà rempli. La matrice désigne,
             cet écran-là paie. */
          onAnimer={(personnage, pose, direction, options) =>
            setPreparation({
              type: "clip",
              sujet: personnage.identifiant,
              pose: pose.identifiant,
              direction: direction?.identifiant,
              ...options,
            })
          }
          onFente={setFente}
          barreQuiPaie={null}
          // **Une image de *Ses images* ouvre la retouche** (`B25`) — la même
          // porte que partout ailleurs. Elle menait à l'écran de l'ancien
          // châssis, monté en volet dans cette page-ci ; il ne reste plus rien
          // à y aller chercher depuis que `B23` et `B24` ont fait déménager ses
          // neuf locataires, et la doubler d'un second genre de lieu était la
          // dernière raison pour laquelle une condition pouvait manquer
          // quelque part.
          onOuvrirCase={(identifiant) => ouvrirLaRetouche(identifiant)}
          // **La retouche s'ouvre sur l'image qu'on regarde** (`B25`). Le
          // bandeau prenait la référence du sujet, ou sa dernière image —
          // jamais celle qu'on désigne. C'était juste tant qu'il existait une
          // seconde porte par image ; ce ne l'est plus depuis qu'il n'y en a
          // qu'une. La page passe donc l'image de sa vitrine, et la référence
          // ne sert plus que de repli quand elle n'en montre aucune.
          onRetoucher={(regardee) => {
            const reference = choseOuverte.cases
              .flatMap((c) => c.images)
              .find((a) => a.favori)
            const derniere = choseOuverte.cases.flatMap((c) => c.images).at(-1)
            const image = regardee ?? reference?.identifiant ?? derniere?.identifiant
            if (image) ouvrirLaRetouche(image)
          }}
          /* **Une case animée se remonte jusqu'à son clip** (A12), et le clip
             se découpe dans la galerie : deux gestes en un, comme la
             superposition juste en dessous. C'est écrit ici parce que seul
             `App` sait qu'il existe des onglets — la matrice, elle, ne fait
             que nommer un clip. */
          onMonterLaBande={(clip) => {
            poserLaRacine("galerie")
            setMontageOuvert(clip)
          }}
          /* **Et la vignette, elle, ouvre l'animation** (A7) — sans changer
             d'onglet : on la retravaille là où on la regarde. */
          onOuvrirLaBande={ouvrirLAtelierDeBande}
          // **Jeter depuis la matrice passe par le même geste que la galerie**
          // (US-505) : un seul chemin de suppression dans tout le produit.
          //
          // **Mais le geste rendait dans le vide, et c'est le navigateur qui
          // l'a dit** (4 septembre 2026) : le bandeau *annuler* vit dans la
          // barre d'outils de la galerie, et cet écran-ci ne la montre pas. On
          // supprimait donc depuis un endroit d'où l'on ne pouvait pas défaire,
          // alors que l'infobulle du bouton promettait le contraire. Le compte
          // rendu part dans la fente du châssis — la place des comptes rendus —
          // **avec le geste qui rend**, et non un simple mot.
          onSupprimer={(identifiants) => {
            void supprimer(identifiants).then((jetes) => {
              if (!jetes) return
              setFente({
                ton: "ok",
                texte: (
                  <>
                    l'image est à la corbeille —{" "}
                    <button
                      type="button"
                      onClick={() => {
                        void rendre(jetes)
                        setFente(null)
                      }}
                      className="underline underline-offset-2 hover:text-encre"
                    >
                      la rendre
                    </button>
                  </>
                ),
              })
            })
          }}
          // **B13** — la grille du jeu et comparer, ouvertes depuis le
          // bandeau d'onglets. Deux profondeurs de plus, comme la matrice.
          onGrille={() => setGrilleOuverte(choseOuverte.identifiant)}
          onComparer={() => setComparerOuvert(choseOuverte.identifiant)}
          /* **B19** — son vestiaire, dans sa fiche. Ce qu'il porte, lui, et
             non l'équipement du jeu entier. */
          vestiaire={vestiaireDuJeu}
          onPiece={(piece) => ouvrirLaPiece(piece)}
          onEmploiEquipement={(piece, emploi, cible, variante) => setPile((p) => entrer(entrer(p, { genre: "piece", piece }), { genre: "emploi", piece, emploi, cible, variante }))}
          onCreerPiece={(nom) => void donnerUnePiece(nom, choseOuverte.identifiant)}
          /* **Les deux rôles de la fiche d'une image** (`C4`) : elle est montée
             dans *Ses images* depuis que le produit n'a plus qu'un seul volet de
             fiche, et ces deux gestes-là sont les siens depuis toujours. */
          onReinjecter={reinjecter}
          onReglages={(asset) => { void reprendreReglages(asset) }}
          onRetirerLEmploi={(piece, emploi) => void retirerUnEmploi(piece, emploi)}
        />
      )}

      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && !tableauDeBord &&
        (surface === "galerie" || surface === "codex") &&
        imageDeLaRetouche && etat && !bandeOuverte && (
        /* **La retouche** (B16) — la chaîne redessinée sur le papier du
           carnet : huit tables dans leur ordre, un trait, deux fabriques à
           droite de lui. Elle écrit — c'est le seul de ces trois écrans qui le
           fasse — mais elle ne dépense pas : *cliquer ne coûte jamais*.

           **Les deux fabriques s'ouvrent ici même** (`B24`) : la découpe et
           la superposition écrivent d'autres fichiers, mais renvoyer à
           l'ancien `EcranTables` pour les atteindre n'en aurait pas fait des
           fabriques — c'est le défaut que cette tranche répare.

           **Un seul montage pour les six portes** (`B25`), et il se pose sur
           les deux racines : la galerie comme le codex. Il y en avait trois —
           celui-ci, l'ancien écran à la profondeur de la galerie, et le même
           monté en volet dans la page d'un sujet. Trois montages, c'est trois
           conditions à tenir d'accord ; celle de la galerie et celle du codex
           s'étaient déjà écartées sur ce qu'une image sans chose du jeu
           pouvait ouvrir. */
        <Retouche
          asset={imageDeLaRetouche}
          // **Les sœurs d'une image sont ses voisines** — les attitudes de la
          // chose quand elle en a une, les images de la grille quand elle n'en
          // a pas (`B25`). On passe de l'une à l'autre sans que la table
          // ouverte se referme.
          soeurs={soeursDeLaRetouche}
          univers={univers}
          traitement={etat.traitement}
          // **Le bouton de gauche nomme ce qu'il y a derrière** (`B25`) : la
          // galerie quand on en vient, les images de la chose du jeu sinon —
          // et c'est aussi ce que la colonne des sœurs montre dans chaque cas.
          //
          // ⚠️ **Et l'emploi fait un troisième cas.** *La différence* d'un
          // calque s'ouvre depuis la page d'un emploi (plus bas, `onCalque`) :
          // écrire *Ses images* là mentait, on n'en venait pas. Le nom est celui
          // que le fil d'Ariane donne déjà à cet étage — `libelleDEmploi`, la
          // même fonction — sans quoi le bouton et le fil diraient deux choses
          // du même endroit.
          retour={
            emploiOuvert
              ? libelleDEmploi(emploiOuvert)
              : surface === "galerie"
                ? "Galerie"
                : "Ses images"
          }
          tableDeLaPorte={tableDeLaPorte}
          onFermer={() => ouvrirLaRetouche(null)}
          onSoeur={(identifiant) => ouvrirLaRetouche(identifiant)}
          onAssocierEquipement={bibliotheque.courant ? () => setImageAEquiper(imageDeLaRetouche) : undefined}
          decoupe={(fermerLaFabrique) => (
            <EcranDecoupe
              sujet={{
                famille: "planche",
                planche: imageDeLaRetouche,
                // ⚠️ **Les images d'une découpe n'ont ni `personnage` ni
                // `pose`** (`atelier/services/decoupe.py`) : elles vont dans
                // la grille libre, jamais dans une case d'un sujet. Rouvrir
                // la retouche dessus (`B24`) demandait `imageDeLaRetouche`
                // de la trouver dans `choseOuverte.cases`, où elle n'est
                // jamais — l'écran se refermait donc sans un mot juste après
                // la découpe. Elle sait les lire depuis `B25`, mais le geste
                // ne navigue toujours pas : on vient d'en fabriquer huit, et
                // en ouvrir une au hasard déciderait à la place de l'auteur.
                // Fermer la fabrique et sélectionner le résultat.
                onDecoupe: (decoupes) => {
                  fermerLaFabrique()
                  if (decoupes.length > 0) setSelection([decoupes[0].identifiant])
                },
                // **La seconde sortie mène là où l'auteur voulait aller**
                // (`AU19`) : l'atelier de l'animation qu'on vient de monter,
                // où elle tourne, se règle et se range sur un mouvement. Ici
                // ouvrir la première n'est pas décider à sa place — quatre
                // directions montées d'un geste sont une seule animation vue
                // de quatre côtés, et c'est la même qu'il vient de dessiner.
                onAnimer: (bandes) => {
                  fermerLaFabrique()
                  if (bandes.length > 0) ouvrirLAtelierDeBande(bandes[0].identifiant)
                },
              }}
              onFermer={fermerLaFabrique}
              onFente={setFente}
            />
          )}
          onErreur={setPanne}
          onUnivers={setUnivers}
        />
      )}

      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && surface === "codex" && sujetDeLaGrille && !bandeOuverte && !imageDeLaRetouche && (
        /* **La grille du jeu** (B13) — une profondeur de plus de la page d'un
           sujet, comme la matrice l'était déjà avant B10. Elle ne dépense
           rien : pas de barre qui paie. */
        <GrilleDuJeu
          personnage={sujetDeLaGrille}
          plan={plan}
          univers={univers}
          onFermer={() => setGrilleOuverte(null)}
          onComparer={() => {
            setGrilleOuverte(null)
            setComparerOuvert(sujetDeLaGrille.identifiant)
          }}
        />
      )}

      {surfaceDisponible && !depensesOuvertes && !envoiOuvert && surface === "codex" && sujetDuComparateur && !bandeOuverte && !imageDeLaRetouche && (
        /* **Comparer** (B13) — deux sujets côte à côte, ou deux images d'un
           même sujet. Elle non plus ne dépense rien. */
        <Comparer
          personnage={sujetDuComparateur}
          personnages={personnages}
          plan={plan}
          univers={univers}
          onFermer={() => setComparerOuvert(null)}
          onGrille={() => {
            setComparerOuvert(null)
            setGrilleOuverte(sujetDuComparateur.identifiant)
          }}
          // **« La retoucher » peut viser l'image de l'autre sujet.** La
          // retouche relit d'abord l'image dans les cases de `choseOuverte`
          // (`imageDeLaRetouche`, plus haut) ; ouvrir sans changer de sujet lui
          // faisait chercher une image absente de la page affichée. Changer de
          // sujet d'abord referme Comparer de lui-même — `entrer` coupe tout ce
          // qui est plus profond que l'étage remplacé (`lieux.ts`) — ce qui est
          // le geste juste : on va corriger l'image là où elle vit.
          onOuvrirCase={(sujet, asset) => {
            setChoseOuverte(sujet)
            ouvrirLaRetouche(asset)
          }}
          // **« La retoucher », du côté des animations** (RP12). L'atelier est
          // plus profond que Comparer, donc l'ouvrir referme la comparaison de
          // lui-même — le même geste que pour une image.
          onOuvrirLaBande={ouvrirLAtelierDeBande}
        />
      )}

      {/* ── Le vestiaire : la page d'une pièce, et celle d'un emploi (`B19`) ── */}
      {/* **Deux écrans, deux profondeurs**, posés sur le codex comme la grille
          d'une famille. Ni l'un ni l'autre ne dépense : ils ne reçoivent pas la
          barre qui paie, et c'est cette privation qui tient la promesse.
          L'emploi passe devant sa pièce — il est plus profond, et deux surfaces
          à la fois n'existent pas. */}
      {surfaceDisponible && !depensesOuvertes &&
        !envoiOuvert &&
        surface === "codex" &&
        !bandeOuverte &&
        !imageDeLaRetouche &&
        pieceEtSesEmplois &&
        !emploiOuvert && (
          <Emplois
            projet={bibliotheque.courant ?? undefined}
            pieceEtSesEmplois={pieceEtSesEmplois}
            porteurs={vestiaireDuJeu?.porteurs ?? []}
            onEmploi={(emploi) => ouvrirLEmploi(emploi)}
            onAjouterEmploi={(corps) =>
              void ajouterUnEmploi(pieceEtSesEmplois.piece.identifiant, corps)
            }
            onRetirerLaPiece={() =>
              void retirerLaPiece(pieceEtSesEmplois.piece.identifiant)
            }
            onErreur={(raison) => setPanne(raison)}
          />
        )}

      {surfaceDisponible && !depensesOuvertes &&
        !envoiOuvert &&
        surface === "codex" &&
        !bandeOuverte &&
        /* **Et la retouche passe devant les deux** (`B25`) : *retoucher ce
           calque* descend d'un cran de plus, et deux surfaces à la fois
           n'existent pas. La condition manquait ici — c'est le genre d'oubli
           que fondre les trois genres en un rend visible. */
        !imageDeLaRetouche &&
        pieceEtSesEmplois &&
        emploiOuvert &&
        /* **Les calques d'animation passent devant leur emploi**, comme
           l'emploi passe devant sa pièce : ils sont plus profonds, et deux
           surfaces à la fois n'existent pas. */
        !calquesAnimesLieu && (
          <Emploi
            projet={bibliotheque.courant ?? undefined}
            cibleInitiale={emploiOuvertLieu?.cible} varianteInitiale={emploiOuvertLieu?.variante}
            emploi={emploiOuvert}
            piece={pieceEtSesEmplois.piece}
            emplacements={emplacements}
            /* **Relu dans la liste vivante**, et `null` quand il n'y est plus :
               retirer un personnage ne va pas nettoyer les pièces derrière lui,
               et l'écran doit savoir le dire plutôt que de tomber. */
            porteur={
              personnages.find((p) => p.identifiant === emploiOuvert.porteur) ?? null
            }
            onRegler={(champs) =>
              void reglerUnEmploi(
                pieceEtSesEmplois.piece.identifiant,
                emploiOuvert.identifiant,
                champs,
              )
            }
            onRetirer={() =>
              void retirerUnEmploi(
                pieceEtSesEmplois.piece.identifiant,
                emploiOuvert.identifiant,
              )
            }
            onCalque={(asset) => {
              // Un calque se retouche là où il vit — dans la page de son
              // porteur. Ouvrir la case sans changer de sujet laisserait
              // l'outil chercher une image absente de la page affichée, le
              // défaut que `Comparer` a payé en `B13`.
              if (emploiOuvert.porteur) setChoseOuverte(emploiOuvert.porteur)
              ouvrirLaRetouche(asset)
            }}
            onLesAutresEmplois={() => ouvrirLEmploi(null)}
            /* **Le retour au personnage, dans les deux sens** (US-537). Une
               pièce nommée depuis la fiche de qui la porte descend jusqu'à ses
               calques ; sans ce geste, remonter demandait de repasser par le
               codex — et l'emploi ouvert depuis la galerie ou depuis un travail
               conservé n'a même pas son porteur sous lui dans la pile. On pose
               donc la page du sujet à la racine, sur son onglet Équipement :
               c'est là que son vestiaire se lit. */
            onPorteur={
              emploiOuvert.porteur && personnages.some((p) => p.identifiant === emploiOuvert.porteur)
                ? () => {
                    const qui = emploiOuvert.porteur
                    memoriserParcours(
                      `sujet:${bibliotheque.courant}:${qui}:onglet`,
                      "equipement",
                    )
                    setPile(entrer(poser("codex"), { genre: "sujet", sujet: qui }))
                  }
                : undefined
            }
            /* **Seulement sur un emploi porté** : un emploi qui ne porte
               personne n'a pas d'animation à habiller — il n'a ni pose, ni
               calque, seulement une description. L'écran d'`Emploi` décide de
               montrer le bouton ou non, à partir de ce porteur-là. */
            onCalquesAnimes={() =>
              ouvrirLesCalquesAnimes(emploiOuvert.porteur || null)
            }
          />
        )}

      {/* ── Les calques d'animation d'un emploi (`B20`) ─────────────────────
          *Ses animations, image par image* — le calque de la pose, reposé sur
          chaque image de chaque bande. **Aucun bouton de cet écran ne
          dépense** : le recalage tourne sur la machine. */}
      {surfaceDisponible && !depensesOuvertes &&
        !envoiOuvert &&
        surface === "codex" &&
        !bandeOuverte &&
        calquesAnimesLieu &&
        calquesAnimes && (
          <CalquesAnimes
            matrice={calquesAnimes}
            onPoser={(bande, tenue) => void habillerUneBande(bande, tenue)}
            onBasculer={(habillee, tenue) =>
              void reglerUnCalqueAnime(habillee, tenue)
            }
            onRetirer={(habillee) => void deshabillerUneBande(habillee)}
            onRevenirALEmploi={() => ouvrirLesCalquesAnimes(null)}
          />
        )}

      <BarreEtat
        etat={etat}
        catalogue={catalogueRepli}
        panne={panne}
        liaison={liaison}
        bibliotheque={bibliotheque}
        onRelireCatalogue={redemanderCatalogue}
      />

      {/* **Le guide est un volet depuis `B7`** : il ne recouvre plus l'atelier,
          il se pose à droite de ce qu'il documente, sur l'écran que
          `ecranDuGuide` vient de calculer. Il ne porte pas de fente de refus :
          il ne demande rien au serveur, ne dépense rien, ne peut pas échouer. */}
      {guideOuvert && <VoletGuide onFermer={fermerGuide} ecran={ecranDuGuide} />}

      {/* **La barre est la troisième zone du châssis** (B6) : par-dessus le
          carnet et la surface, appelée au clavier, jamais à côté d'eux.

          **Elle ne paie ni ne lance rien**, et ce n'est pas gardé ici : une
          action qui coûte arrive du serveur sans route, donc `surJouer` ne peut
          pas la prendre. Ce qui s'ouvre alors est l'écran d'envoi, où le prix
          est sous les yeux. */}
      {barreOuverte && (
        <Barre
          actions={actions}
          personnages={personnages}
          pieces={pieces}
          images={grille}
          chantier={chantier}
          plan={plan}
          surUnPersonnage={(identifiant) => {
            setPile(poser("codex"))
            setChoseOuverte(identifiant)
          }}
          // **Le vestiaire, et non plus la grille des objets.** La barre
          // ouvrait la rubrique *objets* pour une pièce d'équipement, qui n'y a
          // jamais figuré : les pièces vivent au vestiaire, et c'est lui qu'on
          // ouvre. Trouvé en unifiant les portes vers une famille — la ligne du
          // carnet et celle de la barre menaient à deux endroits différents.
          surUnePiece={() => ouvrirLaFamille("equipement")}
          surUneImage={(identifiant) => {
            setPile(poser("galerie"))
            ouvrirLaRetouche(identifiant)
          }}
          surUneGeneration={() => setPile(poser("galerie"))}
          surUnLieu={(ou) => {
            // **Sept destinations, et le défaut est la galerie.** Un `ou` que
            // cet écran ne connaît pas — parce qu'un outil neuf en a déclaré un
            // — mène quelque part plutôt que nulle part.
            if (ou === "codex") setPile(poser("codex"))
            else if (ou === "univers") setPile(poser("univers"))
            else if (ou === "depenses") setDepensesOuvertes(true)
            else if (ou === "reglages") setInstallationOuverte(true)
            else if (ou === "jeux") setChoixDuJeu("jeux")
            // La sortie vers le dossier du jeu (`RP17`) : les deux outils de la
            // porte unique la déclarent, et sans cette ligne ils menaient à la
            // galerie — un lieu qui ne porte pas le geste qu'ils nomment.
            else if (ou === "sortie") setSortieOuverte(true)
            else setPile(poser("galerie"))
          }}
          surEnvoi={() => setEnvoiOuvert(true)}
          surJouer={(action) => {
            // Gratuit, sur place, et par la route que le serveur a servie. Ce
            // qui revient n'est pas lu : le flux d'événements annonce déjà ce
            // que l'atelier vient de faire, et le relire ici en ferait deux
            // vérités.
            void api
              .jouerUneAction(action.route)
              .catch((erreur) => echouer(erreur, "ce geste n'a pas abouti"))
          }}
          onFermer={fermerBarre}
        />
      )}

      {travailOuvert && bibliotheque.courant && <TravailConserve projet={bibliotheque.courant} identifiant={travailOuvert} personnages={personnages} onAsset={(id) => setPile(entrer(poser("galerie"), { genre: "retouche", asset: id }))} onToile={async (id) => { await api.poserAssetSurToile(bibliotheque.courant!, id); await relireTableau(); allerA("univers") }} onCalqueEquipement={(piece, emploi, cible, variante) => setPile(entrer(entrer(poser("codex"), { genre: "piece", piece }), { genre: "emploi", piece, emploi, cible, variante }))} onFermer={() => setPile((p) => sortir(p, "travail"))} onClip={(id) => setPile(entrer(poser("galerie"), { genre: "montage", clip: id }))} onBande={(id) => setPile(entrer(poser("codex"), { genre: "bande", bande: id }))} onSon={ouvrirLesSons} />}

      {/* **Le tiroir des brouillons** (`RP16`) — une fenêtre partagée, pas un
          lieu : on l'ouvre du pied du carnet, on y reprend un travail, et il se
          referme sur l'écran qu'on rejoint. */}
      {tiroirDesBrouillons && <TiroirDesBrouillons
        lignes={enPlan.lignes}
        travauxEnPlan={enPlan.travauxEnPlan}
        sujets={personnages}
        onReprendre={(retour) => { if (retour.length) setPile(retour) }}
        onTravail={(identifiant) => setPile((p) => entrer(p, { genre: "travail", travail: identifiant }))}
        onChangement={enPlan.relireLesBrouillons}
        onFermer={() => setTiroirDesBrouillons(false)}
      />}
      {/* ── La fenêtre unique de préparation (`RP4`) ──────────────────────
          Huit fenêtres et un aiguillage se sont rangés là-dedans. Le type de
          résultat s'y choisit ; le bouton pressé ne fait plus que dire lequel
          est ouvert en arrivant. */}
      {preparation && !envoiOuvert && <PreparerUneFabrication
        projet={bibliotheque.courant}
        // **RV6** : le sujet nommé par la porte l'emporte — c'est lui qu'elle
        // vient d'armer —, sinon la fiche ouverte, sinon la case armée par la
        // barre qui paie.
        sujet={personnages.find((p) => p.identifiant === preparation.sujet) ?? choseOuverte ?? personnageCible}
        plan={plan}
        personnages={personnages}
        typeInitial={preparation.type}
        onType={setTypeDePreparation}
        poseInitiale={preparation.pose ?? posesCible[0]?.identifiant ?? ""}
        clipInitial={{ cases: preparation.cases, referenceAsset: preparation.referenceAsset, relance: preparation.relance }}
        posesVisees={posesCible}
        sujetVise={personnageCible}
        directionInitiale={preparation.direction ?? cible?.direction ?? ""}
        modeleInitial={preparation.modele}
        avecQuoiInitial={preparation.avecQuoi}
        preparationImage={barreQuiPaie}
        onViser={(vise, pose, direction) => {
          if (vise && pose) armer(vise, [pose], null, direction)
          // **Rattachée au sujet, sans case** : le prompt n'est pas touché,
          // l'image reviendra sur sa fiche sans être rangée dans une pose.
          else if (vise) setCible({ personnage: vise.identifiant, poses: [] })
          else setCible(null)
        }}
        onObjectif={() => { setPreparation(null); setOngletDuSujet("objectif") }}
        onClip={(id) => { setPreparation(null); ouvrirLeMontage(id) }}
        onBande={(id) => { setPreparation(null); ouvrirLAtelierDeBande(id) }}
        onAsset={(id) => { setPreparation(null); ouvrirLaRetouche(id) }}
        onSon={ouvrirLesSons}
        onLivraisons={() => { setPreparation(null); setSortieOuverte(true) }}
        onFermer={() => { setPreparation(null); void relireProduction() }}
      />}
      {/* P2 (V3.5) : la commande d'une planche de plusieurs objets — indépendante
          des quatre types fermés de la préparation, elle appelle les deux mêmes
          routes que toute image (`/outgoing` puis `/generations`). */}
      {commanderPlusieursOuvert && bibliotheque.courant && (
        <PlancheDePlusieursObjets
          projet={bibliotheque.courant}
          modeles={modeles}
          onFermer={() => setCommanderPlusieursOuvert(false)}
          onLancee={() => { setCommanderPlusieursOuvert(false); void relireProduction() }}
        />
      )}
      {creationAssetOuverte && <CreerUnAsset familleInitiale={creationAssetOuverte}
        carteInitiale={carteSourceDuSujet}
        cartesImages={cartes.filter((c) => c.genre === "image" && c.montrable)}
        onFermer={() => { setCreationAssetOuverte(null); setCarteSourceDuSujet(null) }}
        onPersonnage={(personnage) => {
          fondrePersonnage(personnage)
          // **Un sujet neuf s'ouvre sur ses images** (`RV15`) : « Objectifs »
          // ne dit rien à faire, et n'existe plus comme onglet depuis `RV12`
          // — il redirigeait déjà ici, cette mémoire suit juste la
          // destination réelle.
          memoriserParcours(`sujet:${personnage.projet}:${personnage.identifiant}:onglet`, "images")
          setCreationAssetOuverte(null)
          setCarteSourceDuSujet(null)
          setPile(entrer(poser("codex"), { genre: "sujet", sujet: personnage.identifiant }))
          void relireProduction().catch(e => echouer(e, "L’asset est créé ; sa liste n’a pas pu être actualisée."))
          void relireTableau().catch(e => echouer(e, "L’asset est créé ; le tableau n’a pas pu être actualisé."))
        }}
        // TS2 — une carte déjà concept art d'un sujet : on ouvre ce sujet-là
        // au lieu d'en créer un second, la forme du doublon au collage.
        onDeja={(identifiant) => {
          memoriserParcours(`sujet:${bibliotheque.courant}:${identifiant}:onglet`, "images")
          setCreationAssetOuverte(null)
          setCarteSourceDuSujet(null)
          setPile(entrer(poser("codex"), { genre: "sujet", sujet: identifiant }))
        }}
        onPiece={(piece) => {
          setPieces(deja => [...deja.filter(p => p.identifiant !== piece.identifiant), piece])
          setCreationAssetOuverte(null)
          ouvrirLaPiece(piece.identifiant)
          void relireProduction().catch(e => echouer(e, "L’équipement est créé ; sa liste n’a pas pu être actualisée."))
        }} />}
      {source3Douverte && <Source3DConservee source={source3Douverte} onFermer={() => setSource3Douverte(null)} onBande={(id) => { setSource3Douverte(null); ouvrirLAtelierDeBande(id) }} onPersonnage={(id) => { setSource3Douverte(null); memoriserParcours(`sujet:${bibliotheque.courant}:${id}:onglet`, "sources"); setPile(entrer(poser("codex"), { genre: "sujet", sujet: id })) }} />}
      {referenceDePreparation && <CadreDialogue titre="Choisir une référence" onFermer={() => setReferenceDePreparation(false)} enfants={<BibliothequePourImage retour="Ce qui part" onFermer={() => setReferenceDePreparation(false)} onChoisir={(asset) => { ajouterUneReference(asset.identifiant); setReferenceDePreparation(false) }} />} />}
      {imageAEquiper && bibliotheque.courant && <CadreDialogue titre="Associer cette image à un équipement" onFermer={() => setImageAEquiper(null)} enfants={<AssocierImageEquipement image={imageAEquiper} projet={bibliotheque.courant} onFermer={() => setImageAEquiper(null)} onAssocie={(piece, emploi) => { setImageAEquiper(null); setPile((p) => entrer(entrer(surface === "codex" ? sortir(p, "retouche") : poser("codex"), { genre: "piece", piece }), { genre: "emploi", piece, emploi })) }} />} />}

      {/* **L'aperçu couvre tout, y compris les écrans qui couvrent l'atelier**
          — c'est le seul du produit dans ce cas, et c'est ce que son geste
          demande : on le tient une seconde au-dessus de ce qu'on faisait, on le
          referme, et on n'a rien quitté. Il ne porte pas de fente de refus,
          pour la même raison que le Guide : il ne demande rien au serveur. */}
      {importDuSujet && choseOuverte && <ImporterPourUnSujet personnage={choseOuverte} plan={plan} poseInitiale={importDuSujet.pose} directionInitiale={importDuSujet.direction} onFermer={() => setImportDuSujet(null)} onChange={() => {
        void relireProduction()
        void relireEtat()
        // **Une vidéo entre ici aussi depuis `RP5`** : sans cette relecture,
        // le clip qui vient d'entrer n'existe pour aucun autre écran.
        void relireClipsDuJeu()
        void api.arbre().then(setBibliotheque).catch(e => echouer(e, "L’image est importée ; les comptes du jeu n’ont pas pu être actualisés."))
        setGrilleARelire(n => n + 1)
      }} onOuvrir={(id) => { setImportDuSujet(null); ouvrirLaRetouche(id) }}
        /* **La suite qui convient** (`RP5`) : une planche mène à la découpe, une
           vidéo au montage. Les deux rappels sont ceux que la page du sujet
           donnait déjà à l'autre import, aux mêmes signatures. */
        onDecouper={(id) => { setImportDuSujet(null); ouvrirLaRetouche(id, "decoupage") }}
        onMonter={(clip) => { setImportDuSujet(null); poserLaRacine("galerie"); setMontageOuvert(clip) }} />}
      {apercu && <Apercu sujet={apercu} onFermer={fermerApercu} />}
      </div>
    </div>
  )
}

