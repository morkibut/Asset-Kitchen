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
} from "react"
import {
  api,
  dollars,
  ecouter,
  filtreActif,
  FILTRE_VIDE,
  heure,
  poserLeFichier,
  Refus,
  type Asset,
  type Bibliotheque,
  type Etat,
  type Filtre,
  type Generation,
  type Modele,
  type Reinjection,
  type Role,
  type Carte,
  type CompteReferences,
  type Univers,
  UNIVERS_VIDE,
} from "./api"
import { Arbre } from "./composants/Arbre"
import { BarreOutils, type Annulation } from "./composants/BarreOutils"
import { Bouton, CRANS, Point, ZOOMS, type Zoom } from "./composants/chassis"
import { ChampPrompt } from "./composants/ChampPrompt"
import { EcranDecoupe } from "./composants/Decoupe"
import { EcranCle } from "./composants/EcranCle"
import { Fiche } from "./composants/Fiche"
import { PanneauReglages } from "./composants/PanneauReglages"
import { Tuile, type Entree } from "./composants/Tuile"
import { EcranUnivers } from "./composants/Univers"

type Repli = { repli: boolean; raison: string | null; recu_le: number }
type Geste = "Réglages" | "Réessayer"

const BIBLIOTHEQUE_VIDE: Bibliotheque = {
  courant: null,
  projets: [],
  collections: [],
  sans_projet: { assets: 0, total_usd: 0 },
  total_usd: 0,
}

/** Poser une génération dans la liste **sans jamais la doubler**.
 *
 *  Deux chemins amènent la même génération à l'écran, et ils se croisent : la
 *  réponse du POST, et l'annonce du flux — que le serveur publie dès qu'il a
 *  enregistré, donc *avant* que le POST ne soit revenu. Insérer sans regarder
 *  d'un côté et fondre de l'autre laissait deux copies de tout ce qui était
 *  lancé depuis cet onglet. Elles restaient jumelles — la mise à jour les
 *  touchait toutes les deux — mais la clé React devenait double, et une clé
 *  double laisse des tuiles orphelines que le rendu suivant ne retire plus.
 *
 *  Le défaut ne survivait à aucun rechargement : le message d'état remplace la
 *  liste entière par celle du serveur, qui, lui, n'a jamais rien doublé. C'est
 *  ce qui l'a rendu invisible jusqu'à une séance faite au navigateur.
 */
const fondre = (liste: Generation[], recue: Generation): Generation[] =>
  liste.some((g) => g.identifiant === recue.identifiant)
    ? liste.map((g) => (g.identifiant === recue.identifiant ? recue : g))
    : [recue, ...liste]

// « Zoom 1× / 2× / 4× — un niveau indisponible à la largeur courante est
// **grisé, pas caché** » (`docs/DESIGN.md` § Layout). Les crans eux-mêmes vivent
// dans le châssis : ce sont ceux des vignettes du tableau d'inspiration, et un
// seul vocabulaire de taille traverse tout le produit.
//
// Le padding de la zone centrale et la gouttière de la grille, `docs/DESIGN.md`
// § Spacing. Ils servent à répondre à une seule question : **combien de tuiles
// de ce cran tiennent côte à côte ?**
const PADDING = 16
const GOUTTIERE = 9

/**
 * Un cran tient-il à cette largeur ?
 *
 * **Il faut deux colonnes, pas une.** Trouvé en ouvrant l'atelier, jamais au
 * banc : `minmax(cran, 1fr)` accepte une colonne unique et l'**étire** jusqu'au
 * bord — à 4× sur une colonne de 1060 px, une seule tuile occupait 1028 px, soit
 * huit fois la taille de repos pour un contrôle qui en annonce quatre. Une
 * grille d'une colonne n'est plus une planche contact, c'est une visionneuse, et
 * ce n'est pas ce que le zoom promet.
 *
 * **1× est toujours disponible.** C'est l'état de repos du produit, et quelque
 * chose doit se rendre : le griser laisserait la grille sans cran valide.
 */
const tient = (cran: Zoom, largeur: number): boolean =>
  cran === 1 || 2 * CRANS[cran] + GOUTTIERE <= largeur - 2 * PADDING

export function App() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [catalogueRepli, setCatalogueRepli] = useState<Repli>({
    repli: false,
    raison: null,
    recu_le: 0,
  })
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
  // La bibliothèque telle que le serveur l'a filtrée. C'est **lui** qui filtre :
  // la recherche doit porter sur tout, pas sur ce que cet onglet a en mémoire.
  const [grille, setGrille] = useState<Asset[]>([])
  const [bibliotheque, setBibliotheque] = useState<Bibliotheque>(BIBLIOTHEQUE_VIDE)
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_VIDE)
  const [selection, setSelection] = useState<string[]>([])
  const [annulation, setAnnulation] = useState<Annulation | null>(null)
  // **Le seul geste du produit dont le résultat n'arrive pas par le flux** :
  // une archive ne s'annonce pas, elle se télécharge. Ce drapeau ne sert
  // qu'à empêcher un second clic pendant que le premier fabrique le ZIP —
  // deux archives identiques dans les téléchargements pour un double-clic.
  const [exportEnCours, setExportEnCours] = useState(false)
  const [panne, setPanne] = useState<string | null>(null)
  const [liaison, setLiaison] = useState(true)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const [relecture, setRelecture] = useState(false)
  const [replies, setReplies] = useState<{ arbre: boolean; reglages: boolean }>({
    arbre: false,
    reglages: false,
  })

  // ── T4 : le tableau et l'univers ──────────────────────────────────────────
  //
  // Tenus ici, comme la grille et l'arbre, parce que **l'onglet n'a qu'un
  // abonnement** et qu'il vit ici. L'écran Univers les reçoit en propriétés : un
  // second abonnement ouvert à son ouverture se rebrancherait à chaque
  // aller-retour vers l'atelier.
  const [univers, setUnivers] = useState<Univers>(UNIVERS_VIDE)
  const [cartes, setCartes] = useState<Carte[]>([])
  const [groupes, setGroupes] = useState<string[]>([])
  const [universOuvert, setUniversOuvert] = useState(false)

  // ── T5 : la découpe ───────────────────────────────────────────────────────
  //
  // **L'identifiant, jamais l'objet.** L'asset ouvert dans l'écran de découpe
  // continue d'arriver par le flux — une retouche, un rangement, un
  // réalignement de lot. Gardé en copie, il serait celui d'avant ; gardé en
  // identifiant, il se relit dans la grille, qui est la seule vérité de cet
  // onglet. Même règle que la fiche, et pour la même raison.
  const [decoupeOuverte, setDecoupeOuverte] = useState<string | null>(null)

  /** Le zoom de la grille — 1× / 2× / 4×, `docs/DESIGN.md` § Layout. Il n'est
   *  ni sauvegardé ni partagé : c'est un réglage de coup d'œil, pas une
   *  propriété de la bibliothèque. */
  const [zoom, setZoom] = useState<Zoom>(1)
  /** La largeur de la colonne centrale, **mesurée**. C'est elle qui décide
   *  quels crans de zoom tiennent. Zéro veut dire « pas encore mesurée » et non
   *  « nulle » : rien n'est grisé tant qu'on n'a pas regardé. */
  const [largeurCentre, setLargeurCentre] = useState(0)
  const centre = useRef<HTMLElement>(null)

  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [promptNegatif, setPromptNegatif] = useState("")
  const [proportions, setProportions] = useState("1:1")
  const [variations, setVariations] = useState(1)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [reinjections, setReinjections] = useState<Reinjection[]>([])
  /** **Ce que l'auteur fabrique**, nommé dans le barème de son projet. Un seul
   *  contrôle, et il décide de trois choses : quels artworks partent en
   *  référence, quel modèle est le défaut, et quelle part de la case le sujet
   *  occupera. Vide est permis — un univers vide ne contraint rien (US-57). */
  const [echelle, setEchelle] = useState("")

  const dernierClic = useRef<string | null>(null)

  // ── La largeur de la colonne centrale, mesurée ────────────────────────────
  //
  // **On regarde la colonne, on ne la recalcule pas.** Les largeurs du § Layout
  // sont déjà écrites une fois, dans `colonnes` ; les soustraire à nouveau ici
  // en ferait une seconde vérité, et le jour où l'une des deux bouge, le grisé
  // du zoom mentirait sans que rien ne le dise.
  //
  // **Trois moments, et il n'y en a pas d'autre** : au montage, quand la fenêtre
  // change de taille, et quand la transition de 160 ms sur les colonnes s'achève
  // — c'est-à-dire quand un panneau s'est replié ou que la fiche s'est ouverte.
  // Mesurer au moment où l'on replie donnerait la largeur d'**avant** : la
  // transition n'a pas commencé, et c'est l'arrivée qui compte.
  //
  // Pas de `ResizeObserver` : ses rappels sont livrés par la boucle de rendu, et
  // un onglet qui ne compose pas ses images ne les livre jamais — vu le 27 août
  // au navigateur, où le grisé du zoom n'est **jamais** apparu. Un rectangle se
  // lit à la demande, dans tous les cas.
  const mesurerCentre = useCallback(() => {
    const largeur = centre.current?.getBoundingClientRect().width ?? 0
    setLargeurCentre((deja) => (Math.abs(deja - largeur) < 1 ? deja : largeur))
  }, [])

  useEffect(() => {
    window.addEventListener("resize", mesurerCentre)
    return () => window.removeEventListener("resize", mesurerCentre)
  }, [mesurerCentre])

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
  })

  // **La fiche n'est pas un état : c'est la sélection quand elle vaut un.**
  //
  // Les tenir tous les deux, c'était deux vérités sur la même chose — et elles
  // ont divergé au premier clic un peu vif : deux clics dans le même tick
  // lisaient la même sélection périmée, et le second effaçait le premier au
  // lieu de s'y ajouter. Vu au navigateur, jamais au banc, parce qu'une main
  // humaine met plus d'un rendu entre deux clics.
  //
  // La déduire tient aussi la promesse de `docs/DESIGN.md` : l'anneau
  // `--lumiere` dit « sélectionné », et il n'a plus qu'un seul sens.
  const fiche = selection.length === 1 ? selection[0] : null

  // **Et à chaque geste qui change la largeur.** Le repli d'un panneau et
  // l'ouverture de la fiche déplacent les colonnes ; la transition de 160 ms
  // fait que la mesure prise ici est celle d'**avant**, et c'est
  // `onTransitionEnd` qui pose la bonne. Les deux servent : sans celle-ci, un
  // onglet où les transitions ne s'exécutent pas ne remesurerait jamais.
  useLayoutEffect(mesurerCentre, [
    mesurerCentre,
    replies.arbre,
    replies.reglages,
    fiche,
  ])

  const echouer = (erreur: unknown, defaut_: string) =>
    setPanne(erreur instanceof Refus ? erreur.message : defaut_)

  // ── Ce que l'atelier sait de lui-même ─────────────────────────────────────

  // Le catalogue est le seul appel que l'interface refait d'elle-même : la
  // liste des modèles dépend de la demande en cours — les proportions, le
  // **nombre d'images réinjectées**, et depuis T4 **le sujet**, qui décide des
  // artworks qui partent —, et c'est le serveur qui décide du grisé de chacun.
  // Tout le reste arrive par le flux.
  const relireCatalogue = useCallback(async () => {
    try {
      const catalogue = await api.modeles(proportions, reinjections.length, echelle)
      setModeles(catalogue.modeles)
      setDefaut(catalogue.defaut)
      // Le compte qui partira vraiment, artworks compris et dédoublonné. Il
      // vient d'ici et jamais d'une addition faite à l'écran : l'écran ne
      // connaît pas les artworks, et deux comptes finiraient par diverger.
      setCompteReferences(catalogue.references)
      setCatalogueRepli({
        repli: catalogue.repli,
        raison: catalogue.raison,
        recu_le: catalogue.recu_le,
      })
      setPanne(null)
    } catch (erreur) {
      echouer(erreur, "l'atelier ne répond pas")
    }
  }, [proportions, reinjections.length, echelle])

  useEffect(() => {
    void relireCatalogue()
  }, [relireCatalogue])

  // ── La grille ─────────────────────────────────────────────────────────────
  //
  // Elle se redemande quand le filtre change, et **seulement** alors. Le
  // filtrage vit côté serveur : le rejouer ici sur les deux cents assets que cet
  // onglet a en mémoire ferait dire à la recherche autre chose qu'à la
  // bibliothèque, et c'est exactement la divergence relevée chez SpriteCook.

  const relireGrille = useCallback(async () => {
    try {
      const { assets } = await api.assets({
        ...filtre,
        sansProjet: bibliotheque.courant === null,
      })
      setGrille(assets)
    } catch (erreur) {
      echouer(erreur, "la bibliothèque ne répond pas")
    }
  }, [filtre, bibliotheque.courant])

  useEffect(() => {
    void relireGrille()
  }, [relireGrille])

  // ── Le tableau d'inspiration ──────────────────────────────────────────────
  //
  // Il se redemande quand le projet ouvert change, et **seulement** alors : le
  // tableau appartient à son projet, et un tableau tenu en mémoire pendant qu'on
  // change d'univers montrerait les inspirations d'un autre jeu.

  const relireTableau = useCallback(async () => {
    try {
      const vu = await api.tableau()
      setCartes(vu.cartes)
      setGroupes(vu.groupes)
    } catch (erreur) {
      echouer(erreur, "le tableau ne répond pas")
    }
  }, [bibliotheque.courant])

  useEffect(() => {
    void relireTableau()
  }, [relireTableau])

  /** Redemander ce que le serveur grise — et lui seul.
   *
   *  La quantification s'allume quand une palette existe (US-65), et c'est le
   *  serveur qui écrit cette phrase-là. L'écran pourrait la déduire de
   *  `univers.palette` ; il ne le fait pas, parce que « l'interface affiche la
   *  raison qu'elle reçoit, elle ne rejoue jamais la règle de son côté ». */
  const relireEtat = useCallback(async () => {
    try {
      setEtat(await api.etat())
    } catch {
      // Muet : l'état complet revient de toute façon au prochain rebranchement
      // du flux, et une panne a déjà sa phrase ailleurs.
    }
  }, [])

  // Posé à chaque rendu, lu par le flux : le seul but est de tenir l'abonnement
  // ouvert pendant que ce qu'il consulte, lui, change. Écrit **après** les
  // fonctions qu'il porte — une constante lue avant sa déclaration lève.
  vivant.current = {
    filtre,
    courant: bibliotheque.courant,
    relireCatalogue,
    relireGrille,
    relireEtat,
  }

  // ── Le flux d'événements ──────────────────────────────────────────────────
  //
  // Plus aucun sondage. On se branche une fois, on écoute, et l'atelier dit ce
  // qu'il fait au moment où il le fait. Le premier message est l'état complet :
  // c'est lui qui fait qu'un onglet rouvert retrouve les images produites
  // pendant son absence — et `EventSource` se rebranche seul, donc une veille
  // de machine ou un redémarrage du serveur se rattrapent sans rien recharger.

  useEffect(() => {
    return ecouter({
      etat: (recu) => {
        setEtat(recu)
        setBibliotheque(recu.bibliotheque)
        setUnivers(recu.univers ?? UNIVERS_VIDE)
        if (recu.generations) setChantier(recu.generations)
        if (recu.assets) setGrille(recu.assets)
        // Ce message part **une fois par abonnement**, donc à chaque
        // rebranchement. Son catalogue fait autorité sur celui que l'onglet
        // gardait : sans ça, un serveur redémarré pendant une veille laisse la
        // barre d'état dater une photo qui n'existe plus.
        setCatalogueRepli(recu.catalogue)
        // Et son arrivée **prouve** que l'atelier répond : une panne posée
        // pendant son absence est un fait périmé.
        setPanne(null)
      },
      generation: (recue) => setChantier((liste) => fondre(liste, recue)),
      asset: (recu) =>
        setGrille((liste) =>
          fondreAsset(liste, recu, vivant.current.filtre, vivant.current.courant),
        ),
      bibliotheque: setBibliotheque,
      // **Une carte se fond par identifiant, jamais ne s'empile.** Elle arrive
      // par deux chemins qui se croisent — la réponse du POST et l'annonce du
      // flux —, exactement comme une génération en T1. Et comme un asset, elle
      // doit être confrontée à ce qu'on regarde : une carte d'un autre projet
      // n'entre pas dans le tableau du projet ouvert.
      carte: (recue) =>
        setCartes((liste) => {
          if (recue.projet !== vivant.current.courant)
            return liste.filter((c) => c.identifiant !== recue.identifiant)
          if (recue.oubliee)
            return liste.filter((c) => c.identifiant !== recue.identifiant)
          return liste.some((c) => c.identifiant === recue.identifiant)
            ? liste.map((c) => (c.identifiant === recue.identifiant ? recue : c))
            : [recue, ...liste]
        }),
      // Un seul message pour un lot entier : palette recalculée, réglage posé,
      // ou balayage terminé. La grille se redemande alors — c'est le troisième
      // et dernier appel que l'interface refait d'elle-même, et il porte sur des
      // rendus dont l'empreinte vient de changer.
      univers: (recu) => {
        if (recu.projet !== vivant.current.courant) return
        setUnivers(recu.univers)
        // Un balayage a changé des recettes, donc des empreintes, donc les
        // adresses des rendus : la grille se redemande une fois, pour le lot.
        if (recu.realignes) void vivant.current.relireGrille()
        // Et le grisé de la quantification suit la palette : c'est le serveur
        // qui l'écrit, l'écran ne rejoue jamais la règle.
        void vivant.current.relireEtat()
        // **Et le catalogue, parce que promouvoir change ce qui partira.**
        // Trouvé en ouvrant l'atelier, pas au banc : le bloc « Ce qui part »
        // annonçait zéro référence alors que le serveur en comptait une, et il
        // ne se corrigeait qu'au premier changement de sujet. La règle de T1
        // n'avait pas bougé — « le catalogue se redemande parce que le grisé de
        // chaque modèle dépend de la demande en cours » —, c'est la demande qui
        // a gagné une composante que l'écran ne pilote pas.
        void vivant.current.relireCatalogue()
      },
      catalogue: (recu) => {
        setCatalogueRepli(recu)
        // Le repli change ce que chaque modèle peut honorer : la liste, elle,
        // se redemande — c'est le serveur qui écrit les raisons du grisé.
        void vivant.current.relireCatalogue()
      },
      liaison: setLiaison,
    })
  }, [])

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

  // ── Ce que la grille montre ───────────────────────────────────────────────

  const entrees = useMemo<Entree[]>(() => {
    const parCle = new Map<string, Entree>()
    // Le chantier d'abord : il tient sa place **avant** que l'image n'existe.
    // Il ne paraît pas quand un filtre est posé — un lot qui n'est pas encore
    // arrivé n'a rien à quoi un filtre puisse s'appliquer, et le faire
    // apparaître dans une recherche mentirait sur ce qu'elle a trouvé.
    if (!filtreActif(filtre)) {
      for (const generation of chantier) {
        for (const emplacement of generation.emplacements) {
          if (emplacement.statut === "reussie") continue
          const cle = `${generation.identifiant}-${emplacement.rang}`
          parCle.set(cle, {
            cle,
            date: generation.cree_le,
            rang: emplacement.rang,
            sorte: "emplacement",
            generation,
            emplacement,
          })
        }
      }
    }
    // Puis la bibliothèque : un asset **remplace** l'emplacement qui l'attendait,
    // à la même clé et donc à la même place.
    for (const asset of grille) {
      parCle.set(asset.identifiant, {
        cle: asset.identifiant,
        date: asset.cree_le,
        rang: asset.rang,
        sorte: "asset",
        asset,
      })
    }
    return [...parCle.values()].sort(
      (a, b) => b.date - a.date || a.rang - b.rang,
    )
  }, [chantier, grille, filtre])

  // ── La raison qui rend générer inactif ────────────────────────────────────

  // Le refus porte **son geste** : chaque raison sait où elle mène, quand il y
  // a un endroit où aller. « Le grisé porte sa raison — jamais une infobulle. »
  const refus = useMemo<{ texte: string; geste?: Geste } | null>(() => {
    if (panne) return { texte: panne }
    if (!liaison) return { texte: "l'atelier ne répond pas" }
    if (!etat?.cle.presente)
      return {
        texte: etat?.cle.raison ?? "aucune clé OpenRouter",
        geste: "Réglages",
      }
    if (modeles.length === 0)
      return { texte: "le catalogue n'a jamais été reçu", geste: "Réessayer" }
    if (!modele) return { texte: "aucun modèle choisi" }
    if (modele.refus) return { texte: `${modele.nom} ${modele.refus}` }
    if (!prompt.trim()) return { texte: "aucun prompt" }
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95).
    return null
  }, [panne, liaison, etat, modeles, modele, prompt])

  // ── Générer ───────────────────────────────────────────────────────────────

  const generer = async () => {
    if (refus || !modele) return
    // L'identifiant est fabriqué ici : c'est lui qui empêche une double
    // soumission de facturer deux fois, même si le clic part deux fois.
    const identifiant = crypto.randomUUID().replace(/-/g, "")
    const retenues = Object.fromEntries(
      Object.entries(options).filter(([nom]) => nom in modele.options),
    )
    try {
      const generation = await api.generer({
        modele: modele.identifiant,
        prompt: prompt.trim(),
        prompt_negatif: promptNegatif.trim(),
        proportions,
        variations,
        options: retenues,
        identifiant,
        references: reinjections,
        // Le sujet : c'est lui qui décide des artworks qui partent, du modèle
        // par défaut et de la part de case que l'image occupera.
        echelle,
      })
      // Le flux l'a peut-être déjà annoncée — on fond, on n'empile pas.
      setChantier((liste) => fondre(liste, generation))
    } catch (erreur) {
      echouer(erreur, "génération refusée")
    }
  }

  const relancer = async (identifiant: string, rang: number) => {
    try {
      const generation = await api.relancer(identifiant, rang)
      setChantier((liste) => fondre(liste, generation))
    } catch (erreur) {
      echouer(erreur, "relance refusée")
    }
  }

  // ── Juger : sélectionner, marquer, jeter ──────────────────────────────────

  const ouvrir = (identifiant: string, evenement?: React.MouseEvent) => {
    const multiple = evenement?.ctrlKey || evenement?.metaKey
    const etendue = evenement?.shiftKey
    if (multiple) {
      // La forme fonctionnelle, et pas la valeur du rendu courant : deux clics
      // rapprochés partagent le même rendu, donc la même sélection périmée.
      setSelection((precedente) =>
        precedente.includes(identifiant)
          ? precedente.filter((i) => i !== identifiant)
          : [...precedente, identifiant],
      )
    } else if (etendue && dernierClic.current) {
      const cles = entrees.map((e) => e.cle)
      const depart = cles.indexOf(dernierClic.current)
      const arrivee = cles.indexOf(identifiant)
      if (depart >= 0 && arrivee >= 0) {
        const [a, b] = depart < arrivee ? [depart, arrivee] : [arrivee, depart]
        setSelection(
          cles
            .slice(a, b + 1)
            .filter((cle) => grille.some((g) => g.identifiant === cle)),
        )
      }
    } else {
      setSelection([identifiant])
    }
    dernierClic.current = identifiant
  }

  const supprimer = async (identifiants: string[]) => {
    if (identifiants.length === 0) return
    try {
      const rendu = await api.supprimerAssets(identifiants)
      setAnnulation({ identifiants: rendu.supprimes, expireLe: rendu.expire_le })
      setSelection([])
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "suppression refusée")
    }
  }

  const annuler = async () => {
    if (!annulation) return
    try {
      await api.restaurer(annulation.identifiants)
      setAnnulation(null)
      await relireGrille()
    } catch (erreur) {
      setAnnulation(null)
      echouer(erreur, "annulation refusée")
    }
  }

  const marquerFavori = async (identifiants: string[], favori: boolean) => {
    try {
      await api.favori(identifiants, favori)
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "favori refusé")
    }
  }

  /** L'export d'une sélection (US-76).
   *
   *  **La sélection reste après coup**, contrairement au rangement qui la vide :
   *  exporter ne change rien à la bibliothèque, donc rien ne justifie de perdre
   *  ce qu'on avait sous la main — on exporte souvent deux fois de suite, une
   *  fois pour le jeu et une fois pour l'archive.
   */
  const exporter = async () => {
    if (exportEnCours) return
    setExportEnCours(true)
    try {
      poserLeFichier(await api.exporter(selection))
    } catch (erreur) {
      echouer(erreur, "export refusé")
    } finally {
      setExportEnCours(false)
    }
  }

  const ranger = async (rangement: {
    projet?: string | null
    collection?: string | null
  }) => {
    try {
      await api.ranger(selection, rangement)
      setSelection([])
      await relireGrille()
    } catch (erreur) {
      echouer(erreur, "rangement refusé")
    }
  }

  // ── Réinjecter ────────────────────────────────────────────────────────────

  const reinjecter = (asset: string, role: Role) =>
    setReinjections((deja) => [
      ...deja.filter((r) => r.asset !== asset),
      { asset, role },
    ])

  /** Le quatrième rôle : reprendre les réglages, sans envoyer d'image. */
  const reprendreReglages = async (asset: Asset) => {
    try {
      const generation = await api.generation(asset.generation)
      setPrompt(generation.demande.prompt)
      setPromptNegatif(generation.demande.prompt_negatif)
      setProportions(generation.demande.proportions)
      setVariations(generation.demande.variations)
      setModeleChoisi(generation.modele)
      setOptions(
        Object.fromEntries(
          Object.entries(generation.demande.options).map(([n, v]) => [n, String(v)]),
        ),
      )
    } catch (erreur) {
      echouer(erreur, "réglages illisibles")
    }
  }

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

  const colonnes = [
    `${replies.arbre ? 0 : 240}px`,
    `${replies.reglages ? 0 : 300}px`,
    "minmax(0,1fr)",
    `${fiche ? 380 : 0}px`,
  ].join(" ")

  const ouverte = fiche ? grille.find((a) => a.identifiant === fiche) : undefined
  const planche = decoupeOuverte
    ? grille.find((a) => a.identifiant === decoupeOuverte)
    : undefined

  // **Un cran est indisponible quand la colonne est trop étroite pour lui**, et
  // c'est une largeur mesurée qui le dit — pas une soustraction refaite ici à
  // partir des largeurs du § Layout, qui serait une seconde vérité sur la même
  // chose. Tant que rien n'a été mesuré, rien n'est grisé : **zéro n'est pas
  // une largeur, c'est l'absence de mesure**, exactement comme le `0×0` d'une
  // carte qui n'a pas abouti.
  const indisponibles = largeurCentre
    ? ZOOMS.filter((cran) => !tient(cran, largeurCentre))
    : []

  // **Le cran choisi reste choisi**, même devenu trop grand — c'est la règle
  // du modèle du catalogue (US-9), et il n'y a aucune raison d'en avoir deux.
  // Mais une grille doit rendre quelque chose : elle rend donc au plus grand
  // cran qui tient, et la barre d'outils **dit** que c'est ce qui se passe.
  // Sans cette phrase, le contrôle annoncerait 4× sur des tuiles de 400 px.
  const zoomRendu = indisponibles.includes(zoom)
    ? ([...ZOOMS].reverse().find((cran) => !indisponibles.includes(cran)) ?? 1)
    : zoom

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)_26px] bg-fond-0">
      <BarreDeTete
        etat={etat}
        bibliotheque={bibliotheque}
        replies={replies}
        onReplier={(quoi) => setReplies((r) => ({ ...r, [quoi]: !r[quoi] }))}
        onReglages={() => setReglagesOuverts(true)}
        onUnivers={() => setUniversOuvert(true)}
        univers={univers}
        onRafraichir={redemanderCatalogue}
      />

      {/* Quatre colonnes, largeurs absolues, et 160 ms sur la largeur quand
          l'une se replie ou que la fiche s'ouvre — `docs/DESIGN.md` § Motion,
          « tu n'as pas perdu ta place ». Les panneaux restent montés : replier
          n'est pas fermer, et retrouver un panneau où on l'avait laissé fait
          partie de ce que le mouvement promet.

          **Chaque case est `flex`, et c'est ce qui borne le panneau qu'elle
          porte** — `docs/DESIGN.md` § Un panneau est borné par l'écran. Une case
          de grille est haute comme sa piste, mais un `aside` posé dedans en
          bloc reste haut comme *son contenu* : son `overflow-y-auto` intérieur
          n'a alors rien à contraindre, et l'`overflow-hidden` de la case rogne
          en silence. Mesuré au navigateur le 27 août 2026 : 300 px coupés dans
          les réglages, 660 px dans la fiche — la filiation entière hors
          d'atteinte. En `flex`, l'`aside` est étiré, exactement comme sur
          l'écran Univers, seul panneau du produit qui défilait. */}
      <main
        className="grid min-h-0"
        onTransitionEnd={mesurerCentre}
        style={{
          gridTemplateColumns: colonnes,
          transition: "grid-template-columns 160ms ease-in-out",
        }}
      >
        <div className="flex min-h-0 overflow-hidden">
          <Arbre
            bibliotheque={bibliotheque}
            collection={filtre.collection}
            onCollection={(collection) => setFiltre((f) => ({ ...f, collection }))}
            onErreur={setPanne}
            onRelancer={relancer}
          />
        </div>

        <div className="flex min-h-0 overflow-hidden">
          <PanneauReglages
            modeles={modeles}
            choisi={modele}
            onChoisir={setModeleChoisi}
            proportions={proportions}
            onProportions={setProportions}
            variations={variations}
            onVariations={setVariations}
            options={options}
            onOptions={setOptions}
            references={reinjections.length}
            projet={
              bibliotheque.projets.find((p) => p.identifiant === bibliotheque.courant)
                ?.nom ?? null
            }
            univers={univers}
            echelle={echelle}
            onEchelle={setEchelle}
            compte={compteReferences}
          />
        </div>

        {/* `min-w-0` **et** `min-h-0` : une piste de grille en `minmax(0,1fr)`
            n'empêche pas son contenu de l'élargir — c'est l'élément posé dedans
            qui vaut `min-width: auto`, donc la largeur de ce qu'il contient. Une
            barre d'outils trop pleine faisait alors glisser la page entière sur
            la droite, en-tête et pied compris. Constaté au navigateur le 27 août
            2026, à la première sélection. */}
        <section ref={centre} className="flex min-h-0 min-w-0 flex-col">
          <Reinjections
            reinjections={reinjections}
            grille={grille}
            onRetirer={(asset) =>
              setReinjections((deja) => deja.filter((r) => r.asset !== asset))
            }
            onRole={(asset, role) => reinjecter(asset, role)}
          />
          <ChampPrompt
            prompt={prompt}
            onPrompt={setPrompt}
            promptNegatif={promptNegatif}
            onPromptNegatif={setPromptNegatif}
            refus={refus?.texte ?? null}
            ouAller={refus?.geste}
            onAller={
              refus?.geste === "Réessayer"
                ? redemanderCatalogue
                : () => setReglagesOuverts(true)
            }
            revers={revers}
            onGenerer={generer}
            variations={variations}
          />
          <BarreOutils
            recherche={filtre.recherche}
            onRecherche={(recherche) => setFiltre((f) => ({ ...f, recherche }))}
            favoris={filtre.favoris}
            onFavoris={(favoris) => setFiltre((f) => ({ ...f, favoris }))}
            collection={filtre.collection}
            collections={bibliotheque.collections}
            projets={bibliotheque.projets}
            selection={selection}
            onRanger={ranger}
            onFavori={(favori) => void marquerFavori(selection, favori)}
            onSupprimer={() => void supprimer(selection)}
            onVider={() => setSelection([])}
            onExporter={() => void exporter()}
            exportEnCours={exportEnCours}
            annulation={annulation}
            onAnnuler={annuler}
            compte={grille.length}
            zoom={zoom}
            onZoom={setZoom}
            zoomsIndisponibles={indisponibles}
            zoomRendu={zoomRendu}
          />
          <Grille
            entrees={entrees}
            selection={selection}
            filtre={filtre}
            zoom={zoomRendu}
            onRelancer={relancer}
            onOuvrir={ouvrir}
            onRetirerFiltre={() => setFiltre(FILTRE_VIDE)}
          />
        </section>

        <div className="flex min-h-0 overflow-hidden">
          {ouverte && etat && (
            <Fiche
              asset={ouverte}
              traitement={etat.traitement}
              univers={univers}
              onFermer={() => setSelection([])}
              onErreur={setPanne}
              onReinjecter={(role) => reinjecter(ouverte.identifiant, role)}
              onReglages={() => void reprendreReglages(ouverte)}
              onSupprimer={() => void supprimer([ouverte.identifiant])}
              onDecouper={() => setDecoupeOuverte(ouverte.identifiant)}
              onOuvrir={(identifiant) => setSelection([identifiant])}
            />
          )}
        </div>
      </main>

      <BarreEtat
        etat={etat}
        catalogue={catalogueRepli}
        panne={panne}
        liaison={liaison}
        bibliotheque={bibliotheque}
      />

      {/* **L'écran de découpe couvre l'atelier**, comme l'écran Univers : on
          dessine des rectangles sur une planche de mille pixels, et la fiche en
          fait 380. Il se ferme sur la première découpe, ouverte dans sa fiche —
          la grille, elle, les a déjà toutes reçues par le flux. */}
      {planche && (
        <EcranDecoupe
          planche={planche}
          onFermer={() => setDecoupeOuverte(null)}
          onDecoupe={(decoupes) => {
            setDecoupeOuverte(null)
            if (decoupes.length > 0) setSelection([decoupes[0].identifiant])
          }}
        />
      )}

      {universOuvert && (
        <EcranUnivers
          projet={
            bibliotheque.projets.find((p) => p.identifiant === bibliotheque.courant) ??
            null
          }
          univers={univers}
          modeles={modeles}
          cartes={cartes}
          groupes={groupes}
          onRelire={relireTableau}
          onFermer={() => setUniversOuvert(false)}
        />
      )}

      {reglagesOuverts && etat && (
        <EcranCle
          etat={etat.cle}
          onDeposee={async () => {
            setEtat(await api.etat().catch(() => etat))
            await relireCatalogue()
          }}
          onFermer={() => setReglagesOuverts(false)}
        />
      )}
    </div>
  )
}

/** Fondre un asset annoncé dans la grille — et l'en **retirer** quand il l'a
 *  quittée.
 *
 *  Trois façons de la quitter, et elles se lisent toutes sur l'objet reçu : il
 *  est supprimé, il a changé de projet, ou il ne répond plus au filtre posé.
 *  Le manque de la troisième s'est vu tout de suite au navigateur — supprimer un
 *  projet détache ses assets, chaque détachement est annoncé, et les trois
 *  détachés venaient s'installer dans la grille du projet **ouvert**, qui n'est
 *  pas le leur.
 *
 *  Ce que cette fonction refuse de trancher, c'est **la recherche** : elle vit
 *  sur le serveur, et la rejouer ici ferait dire à la grille autre chose qu'à la
 *  bibliothèque. Sous recherche, un asset inconnu n'entre pas — on redemande. */
function fondreAsset(
  liste: Asset[],
  recu: Asset,
  filtre: Filtre,
  courant: string | null,
): Asset[] {
  const dehors =
    recu.supprime_le !== null ||
    recu.projet !== courant ||
    (filtre.collection !== null && recu.collection !== filtre.collection) ||
    (filtre.favoris && !recu.favori)
  if (dehors) return liste.filter((a) => a.identifiant !== recu.identifiant)
  if (liste.some((a) => a.identifiant === recu.identifiant))
    return liste.map((a) => (a.identifiant === recu.identifiant ? recu : a))
  if (filtre.recherche.trim()) return liste
  return [recu, ...liste].sort((a, b) => b.cree_le - a.cree_le || a.rang - b.rang)
}

// ── La barre de tête ────────────────────────────────────────────────────────

function BarreDeTete({
  etat,
  bibliotheque,
  univers,
  replies,
  onReplier,
  onReglages,
  onUnivers,
  onRafraichir,
}: {
  etat: Etat | null
  bibliotheque: Bibliotheque
  univers: Univers
  replies: { arbre: boolean; reglages: boolean }
  onReplier: (quoi: "arbre" | "reglages") => void
  onReglages: () => void
  onUnivers: () => void
  onRafraichir: () => void
}) {
  const projet =
    bibliotheque.projets.find((p) => p.identifiant === bibliotheque.courant) ?? null

  return (
    <header className="flex items-center gap-4 border-b border-bord bg-fond-1 px-4">
      {/* Le seul endroit où l'outil a un visage — 17 px, l'unique exception à
          la règle « Instrument Serif ne descend jamais sous 24 px ». */}
      <h1 className="font-serif text-[17px] leading-none text-texte">Asset Kitchen</h1>

      {/* Replier est **un choix**, jamais une contrainte de place (US-97) : les
          deux bascules sont là en permanence, et disent l'état où elles sont. */}
      <div className="flex items-center gap-1">
        {(["arbre", "reglages"] as const).map((quoi) => (
          <button
            key={quoi}
            type="button"
            onClick={() => onReplier(quoi)}
            aria-pressed={!replies[quoi]}
            className={[
              "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
              replies[quoi]
                ? "border-bord bg-fond-2 text-texte-3"
                : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
            ].join(" ")}
          >
            {quoi === "arbre" ? "arbre" : "réglages"}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span className="mesure text-[10px] text-texte-3">
          {projet ? projet.nom : "sans projet"} ·{" "}
          {dollars(projet ? projet.total_usd : bibliotheque.sans_projet.total_usd)}
        </span>
        <span className="mesure text-[10px] text-texte-3">
          {dollars(etat?.couts.total_usd ?? 0)} en tout
        </span>
        {/* L'écran où l'on pose ce qui s'appliquera ensuite tout seul. Il
            dit d'un mot s'il a quelque chose à dire : un univers vide n'est pas
            un réglage manquant, c'est un état — et il ne réclame rien. */}
        <Bouton
          onClick={onUnivers}
          enfants={
            univers.vide ? (
              "Univers"
            ) : (
              <span className="flex items-center gap-2">
                Univers
                <span className="mesure text-[10px] text-signal">
                  {univers.palette.length
                    ? `${univers.palette.length} couleurs`
                    : "bible"}
                </span>
              </span>
            )
          }
        />
        <Bouton onClick={onRafraichir} enfants="Catalogue" />
        <Bouton onClick={onReglages} enfants="Réglages" />
      </div>
    </header>
  )
}

// ── Les images réinjectées ──────────────────────────────────────────────────

/**
 * Ce qui repartira avec l'appel (US-12).
 *
 * La bande n'existe que quand il y a quelque chose dedans : une rangée vide en
 * permanence au-dessus du prompt serait du cadrage affiché, et le prompt est
 * l'endroit où l'atelier s'ouvre.
 */
function Reinjections({
  reinjections,
  grille,
  onRetirer,
  onRole,
}: {
  reinjections: Reinjection[]
  grille: Asset[]
  onRetirer: (asset: string) => void
  onRole: (asset: string, role: Role) => void
}) {
  if (reinjections.length === 0) return null
  return (
    <div className="flex items-center gap-2 border-b border-bord bg-fond-1 px-4 pt-3">
      <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
        Repart avec
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {reinjections.map(({ asset, role }) => {
          const connu = grille.find((a) => a.identifiant === asset)
          return (
            <span
              key={asset}
              className="flex items-center gap-1.5 rounded-[2px] border border-bord bg-fond-2 py-1 pr-1 pl-1"
            >
              {connu && (
                <img
                  src={api.rendu(connu.identifiant, connu.empreinte)}
                  alt=""
                  className="damier h-6 w-6 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
              <select
                aria-label="Rôle de la réinjection"
                value={role}
                onChange={(e) => onRole(asset, e.target.value as Role)}
                className="mesure bg-transparent text-[10px] text-texte-2"
              >
                <option value="reference">référence</option>
                <option value="edition">source d'édition</option>
                <option value="style">guide de style</option>
              </select>
              <button
                type="button"
                onClick={() => onRetirer(asset)}
                aria-label="Retirer la réinjection"
                className="mesure px-1 text-[10px] text-texte-3 hover:text-echec"
              >
                ×
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── La grille ───────────────────────────────────────────────────────────────

function Grille({
  entrees,
  selection,
  filtre,
  zoom,
  onRelancer,
  onOuvrir,
  onRetirerFiltre,
}: {
  entrees: Entree[]
  selection: string[]
  filtre: Filtre
  /** Le cran **rendu**, pas le cran choisi : à une largeur où le choix ne tient
   *  pas, la grille rend le plus grand qui tienne, et la barre d'outils le dit. */
  zoom: Zoom
  onRelancer: (generation: string, rang: number) => void
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRetirerFiltre: () => void
}) {
  // **Deux états vides, et ce ne sont pas les mêmes** (US-34, US-35). Une
  // bibliothèque vide invite à écrire ; un filtre sans résultat est une impasse,
  // et une impasse doit porter le geste qui en sort — sinon la grille est muette
  // au moment précis où elle devrait aider.
  if (entrees.length === 0) {
    return filtreActif(filtre) ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Rien ne répond à ce filtre.
        </p>
        <button
          type="button"
          onClick={onRetirerFiltre}
          className="mesure text-[11px] text-signal hover:text-signal-clair"
        >
          Retirer le filtre ›
        </button>
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Rien n'est encore sorti d'ici. <em className="text-texte-2">Écris.</em>
        </p>
      </div>
    )
  }

  return (
    <div className="defile min-h-0 flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-[9px]"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${CRANS[zoom]}px, 1fr))`,
        }}
      >
        {entrees.map((entree) => (
          <Tuile
            key={entree.cle}
            entree={entree}
            selectionnee={selection.includes(entree.cle)}
            onRelancer={onRelancer}
            onOuvrir={onOuvrir}
          />
        ))}
      </div>
    </div>
  )
}

// ── La barre d'état ─────────────────────────────────────────────────────────

function BarreEtat({
  etat,
  catalogue,
  panne,
  liaison,
  bibliotheque,
}: {
  etat: Etat | null
  catalogue: Repli
  panne: string | null
  liaison: boolean
  bibliotheque: Bibliotheque
}) {
  // Trois choses différentes, et il ne faut pas les confondre : l'atelier est
  // arrêté (liaison rompue), le fournisseur est injoignable (repli), ou tout
  // va bien. La première l'emporte — sans serveur, le reste ne veut rien dire.
  const [couleur, texte] = !liaison
    ? ["var(--color-echec)", "l'atelier ne répond pas"]
    : panne
      ? ["var(--color-echec)", panne]
      : catalogue.repli
        ? ["var(--color-epingle)", "hors ligne"]
        : ["var(--color-ok)", "en ligne"]

  const assets =
    bibliotheque.projets.reduce((somme, p) => somme + p.assets, 0) +
    bibliotheque.sans_projet.assets

  // Deux altitudes, deux métiers : le pied porte **l'état du monde** — et
  // pourquoi, quand le port a su le dire en français. Il ne prédit jamais ce
  // qui va casser : ça, c'est la fente sous le bouton Générer.
  return (
    <footer className="mesure flex items-center gap-4 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
      <span className="flex items-center gap-1.5">
        <Point couleur={couleur} />
        {texte}
      </span>
      {catalogue.repli && catalogue.recu_le > 0 && (
        <span className="text-epingle">catalogue du {heure(catalogue.recu_le)}</span>
      )}
      {catalogue.repli && catalogue.raison && <span>{catalogue.raison}</span>}
      <span>{etat?.catalogue.modeles ?? 0} modèles</span>
      <span>
        {assets} asset{assets > 1 ? "s" : ""}
      </span>
      <span className="ml-auto">
        {etat?.cle.presente ? `clé …${etat.cle.apercu}` : "aucune clé"}
      </span>
    </footer>
  )
}
