// Le montage — l'écran où un clip payé devient plusieurs bandes (A10, V3).
//
// C'est le troisième moment de `docs/archive/maquettes-v3/01-du-sprite-a-la-bande.html`,
// et **le cœur de la version**. Tout le reste amène ici : `A6` écrit le
// mouvement, `A9` commande le clip et l'attend, `A2` sait recadrer plusieurs
// images sur une seule fenêtre. Cet écran-ci est celui qui rend le clip utile.
//
// ── Ce qu'il a de différent de tous les autres écrans du produit ────────────
//
// 1. **Il ne dépense rien, et il le dit.** Le clip est payé ; on découpe, on
//    garde, on efface, on recommence, et le total du projet ne bouge pas d'un
//    centime. La barre qui paie ne le suit pas ici, comme sur la vitrine et sur
//    le calibrage.
// 2. **On trie *dans* un tirage, pas *entre* des tirages.** Partout ailleurs le
//    produit fait choisir entre quatre images qui viennent d'arriver. Ici les
//    cent vingt images sont le même appel, et ce qu'on choisit est un instant.
// 3. **Deux boucles, un seul métronome.** À gauche ce que le modèle a rendu,
//    fond compris — *le mouvement est-il bon ?* ; à droite les mêmes images
//    passées par la chaîne du jeu — *le découpage est-il bon ?* Juger un
//    mouvement et juger un découpage sont deux métiers, et une seule image
//    obligerait à en trancher un au jugé. Elles partent ensemble et tournent à
//    la même vitesse : au banc, chacune démarrait quand elle avait fini de
//    charger, donc jamais en phase avec sa voisine.
//
// ── Ce que l'écran ne fait pas, et c'est délibéré ───────────────────────────
//
// Il ne recalcule **jamais** la fenêtre commune de son côté. Elle se mesure sur
// les cent vingt images du clip, ce qui coûte une vingtaine de secondes, et
// c'est le serveur qui la garde. Reprendre le cadre est un bouton, avec ce
// qu'il coûte écrit à côté : le faire à chaque cran de curseur rendrait l'écran
// inutilisable, le faire dans le dos de l'auteur le ferait attendre sans
// pouvoir dire pourquoi.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  dollars,
  poserLeFichier,
  type Asset,
  type Bande,
  type Montage,
  type Mouvement,
  type PropositionDeRythme,
  type Prise,
  type Personnage,
} from "../api"
import { remonterLaBande } from "./AtelierDeBande"
import { Bouton, Curseur, Libelle, Raison, Segments } from "./pieces"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"

/** La hauteur du ruban, et la largeur d'une tranche. **Sept pixels**, comme la
 *  maquette : c'est ce qui fait tenir cent vingt images sans défilement, et
 *  c'est aussi pourquoi la loupe existe — à sept pixels de large on ne sait pas
 *  ce qu'on clique. */
const RUBAN = 44
const TRANCHE = 7

/** Ce qu'on retient au plus quand la fenêtre pose un découpage régulier. Le
 *  chemin fin — prendre et laisser image par image — n'a pas de plafond autre
 *  que celui du serveur : c'est lui qui refuse une bande de cent images. */
const ECHANTILLON_MAX = 12

export function EcranMontage({
  clip,
  reprise,
  onFermer,
  onErreur,
  personnages,
  onBande,
}: {
  clip: string
  /** **On remonte une animation déjà gardée** (V3.03.3), au lieu d'en tailler
   *  une neuve.
   *
   *  > ### ⚠️ Le montage repartait toujours des réglages du jeu
   *  >
   *  > C'est le cul-de-sac d'`A7` par l'autre bout : on savait tailler une
   *  > animation dans un clip et **pas revenir sur ce découpage**. Ajouter une
   *  > image demandait de refaire la bande entière, donc de reposer de mémoire
   *  > tous les réglages posés depuis.
   *
   *  L'écran s'ouvre alors sur **les images déjà retenues** et la vitesse de
   *  l'animation, et le geste dominant n'est plus *garder une bande de plus*
   *  mais *reprendre celle-ci*. Ce qu'on garde retrouve sa prise — sa poussée et
   *  sa recette avec elle —, ce qu'on laisse tombe au chutier. */
  reprise?: {
    bande: Bande
    /** L'animation est à jour : refermer et revenir à son atelier. */
    onRepris: () => void
  }
  onFermer: () => void
  onErreur: (raison: string) => void
  personnages?: Personnage[]
  onBande?: (identifiant: string) => void
}) {
  const [montage, setMontage] = useState<Montage | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  /** L'animation qui est en train de sortir (A4). **Une à la fois** : le
   *  navigateur ne pose qu'un fichier par clic, et deux archives fabriquées en
   *  même temps arriveraient dans le désordre. */
  const [sort, setSort] = useState<string | null>(null)

  // ── Ce que l'auteur compose ───────────────────────────────────────────────
  /** Les images retenues, **dans l'ordre où elles se jouent**. Rien n'oblige à
   *  ce qu'elles soient régulièrement espacées : c'est très exactement ce que
   *  cet écran apporte au produit. */
  const [occurrences, setOccurrences] = useState<Prise[]>([])
  const retenues = occurrences.map((prise) => prise.numero)
  const origine = useRef<Bande | null>(null)
  const ordreManuel = useRef(false)
  const setRetenues = useCallback((suivantes: number[] | ((avant: number[]) => number[])) => {
    setOccurrences((avant) => {
      const numeros = typeof suivantes === "function" ? suivantes(avant.map((prise) => prise.numero)) : suivantes
      const reserve = [...avant, ...(origine.current?.prises ?? []), ...(origine.current?.chutier ?? [])]
      const utilisees = new Set<string>()
      return numeros.map((numero) => {
        const trouvee = reserve.find((prise) => prise.numero === numero && (!prise.clip || prise.clip === clip) && !utilisees.has(prise.identifiant!))
        const prise = trouvee ?? { numero, clip: "", dx: 0, dy: 0, identifiant: crypto.randomUUID() }
        utilisees.add(prise.identifiant!)
        return prise
      })
    })
  }, [clip])
  const [nom, setNom] = useState("")
  const [cadence, setCadence] = useState(8)
  const [sens, setSens] = useState<"boucle" | "aller-retour">("boucle")
  const [cadre, setCadre] = useState<"clip" | "bande" | "main">("clip")
  /** Le rectangle que l'auteur a posé lui-même, `null` tant qu'il n'y a pas
   *  touché. **Il est semé sur celui qui était en vigueur** au moment où il
   *  passe *à la main* : partir d'un rectangle vide l'obligerait à retrouver à
   *  la souris ce que la machine venait de mesurer correctement, alors que le
   *  geste qu'il vient faire est presque toujours *un peu plus large*. */
  const [cadreMain, setCadreMain] = useState<{
    gauche: number
    sommet: number
    droite: number
    bas: number
  } | null>(null)
  /** Le point d'ancrage posé à la main (RP15), `null` tant que l'auteur n'y a
   *  pas touché. **Rien n'est envoyé dans ce cas** : un défaut affiché à
   *  l'écran n'est pas un choix de l'auteur, et le jeu garde alors le sien —
   *  le repère de l'objectif de la pose. */
  const [pivotMain, setPivotMain] = useState<{ x: number; y: number } | null>(null)
  /** `null` veut dire **celle du jeu**, et c'est le cas courant : une bande
   *  gardée sans y toucher n'a aucun écart à afficher. */
  const [pose, setPose] = useState<string | null>(null)
  const [direction, setDirection] = useState<string | null>(null)
  const [personnage, setPersonnage] = useState<string | null>(null)
  const etatMontage = { occurrences, nom, cadence, sens, cadre, cadreMain, pivotMain, pose, direction, personnage }
  const [referenceMontage, setReferenceMontage] = useState<typeof etatMontage | null>(null)
  const brouillon = useBrouillonLocal({
    cle: `montage:${clip}:${reprise?.bande.identifiant ?? "nouveau"}`, pret: montage !== null,
    reference: referenceMontage ?? etatMontage, etat: etatMontage,
    // Les nouvelles occurrences reçoivent des UUID à l’ouverture ; elles ne
    // rendent pas à elles seules le contenu d’un même montage différent.
    signature: (etat) => JSON.stringify({ ...etat, occurrences: etat.occurrences.map(({ identifiant: _id, ...prise }) => prise) }),
    appliquer: (recu) => {
      setReferenceMontage(referenceMontage ?? etatMontage)
      setOccurrences(recu.occurrences); setNom(recu.nom); setCadence(recu.cadence); setSens(recu.sens)
      setCadre(recu.cadre); setCadreMain(recu.cadreMain); setPivotMain(recu.pivotMain); setPose(recu.pose); setDirection(recu.direction); setPersonnage(recu.personnage)
      ordreManuel.current = true
    },
  })

  // ── Ce que le serveur répond ──────────────────────────────────────────────
  // **La vidéo n'est pas montrée d'emblée**, et c'est un arbitrage : ce qu'on
  // vient faire ici est découper, et les deux boucles côte à côte sur le même
  // métronome sont ce qui permet de comparer. La vidéo répond à une autre
  // question — *est-ce que le mouvement lui-même est bon ?* — et elle se
  // demande.
  const [enVideo, setEnVideo] = useState(false)
  const [bandes, setBandes] = useState<Bande[]>([])
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [sujets, setSujets] = useState<Personnage[]>([])
  const [reprend, setReprend] = useState(false)

  // ── L'état de l'écran ─────────────────────────────────────────────────────
  /** Le cran du métronome. **Un seul pour les deux boucles** : c'est ce qui les
   *  garde en phase, et c'est ce qui manquait au banc. */
  const [pas, setPas] = useState(0)
  const [survol, setSurvol] = useState<number | null>(null)
  /** L'image que le clavier désigne. Le geste se répète trois fois par clip :
   *  il doit se faire au clavier autant qu'à la souris. */
  const [curseur, setCurseur] = useState(0)
  /* ⚠️ **La barre d'espace lit le curseur ici, pas dans un `setCurseur`.**
     Le raccourci `setCurseur(c => { basculer(c); return c })` renvoie la même
     valeur : React évalue la fonction une première fois pour voir si l'état
     bouge, renonce, puis la réévalue au rendu suivant que `basculer` a lui-même
     déclenché — donc **deux bascules, et l'image ne bouge pas**. Ça ne se
     produit que selon ce qui est en attente sur le composant, ce qui en faisait
     un essai rouge un tour sur plusieurs (`docs/PIEGES.md`). */
  const ouRegarde = useRef(0)
  ouRegarde.current = curseur
  /** **Les images déjà mises de côté** (A13), pour que prélever plusieurs fois
   *  d'affilée se lise sur la pellicule au lieu de se retenir de tête. Il vit
   *  dans l'écran et nulle part ailleurs : c'est ce qu'on a fait *pendant cette
   *  visite*, et le relire au serveur demanderait de comparer des octets. */
  const [prelevees, setPrelevees] = useState<number[]>([])
  /** Ce que le dernier prélèvement a donné — l'image entrée, ou celle qui
   *  portait déjà les mêmes octets. **Une phrase, pas un bandeau** : le geste
   *  est court et se répète, et un bandeau à chasser le rendrait long. */
  const [misDeCote, setMisDeCote] = useState<{
    numero: number
    asset: Asset | null
    doublon: Asset | null
  } | null>(null)

  // **La reprise ne relance pas l'ouverture.** L'écran au-dessus passe un objet
  // neuf à chaque rendu ; le laisser dans les dépendances ferait redemander le
  // clip — et reposer le découpage de départ par-dessus celui qu'on est en train
  // de corriger. Même remède que l'aperçu de l'atelier d'une animation.
  const laReprise = useRef(reprise)
  laReprise.current = reprise

  // **Échap referme**, comme partout ailleurs — et ici il ne renonce à rien :
  // les bandes gardées sont déjà sur le disque.
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape" && !evenement.defaultPrevented) onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

  // ── L'ouverture, en un seul aller-retour ──────────────────────────────────
  useEffect(() => {
    let vivant = true
    api
      .ouvrirLeMontage(clip)
      .then((recu) => {
        if (!vivant) return
        setMontage(recu)
        setBandes(recu.bandes)
        setPose(recu.clip.pose)
        setDirection(recu.clip.direction)
        setPersonnage(recu.clip.personnage)
        // **On remonte une animation gardée** (V3.03.3) : ce qui s'ouvre est
        // *son* découpage et *sa* vitesse, pas une proposition. Poser une
        // proposition par-dessus reviendrait à effacer le travail au moment
        // même où l'on vient le reprendre.
        const remonte = laReprise.current
        if (remonte) {
          origine.current = { ...remonte.bande, prises: remonte.bande.prises.map((prise) => ({ ...prise, identifiant: prise.identifiant || crypto.randomUUID() })), chutier: remonte.bande.chutier.map((prise) => ({ ...prise, identifiant: prise.identifiant || crypto.randomUUID() })) }
          ordreManuel.current = true
          setRetenues(
            remonte.bande.prises
              .filter((prise) => !prise.clip || prise.clip === clip)
              .map((prise) => prise.numero),
          )
          setNom(remonte.bande.nom)
          setPersonnage(remonte.bande.personnage)
          setPose(remonte.bande.pose)
          setDirection(remonte.bande.direction)
          setCadence(remonte.bande.cadence)
          setSens(remonte.bande.sens)
          setCadre(remonte.bande.cadre.choix as "clip" | "bande" | "main")
          return
        }
        // **Il s'ouvre déjà en train de tourner.** La première proposition
        // pose un découpage ; s'il n'y en a aucune — un clip où rien ne se
        // referme —, on prend un échantillon régulier plutôt que de laisser
        // l'écran vide, et le premier clic le corrige.
        const posee = recu.propositions[0]?.images
        setRetenues(posee?.length ? [...posee] : regulier(0, recu.clip.images - 1))
        setNom(recu.clip.mouvement || "")
      })
      .catch((erreur) =>
        setRefus(erreur instanceof Error ? erreur.message : "ce clip ne s'ouvre pas"),
      )
    return () => {
      vivant = false
    }
  }, [clip])

  // ── La cadence vient du mouvement ─────────────────────────────────────────
  //
  // **Elle voyage avec lui depuis `A6`**, et c'est là qu'elle a été réfléchie
  // une fois. L'auteur la change ici, sur la bande ; ce qu'il change ne
  // remonte pas au mouvement — une bande a le droit d'être plus lente que la
  // moyenne de son espèce.
  useEffect(() => {
    let vivant = true
    api
      .mouvements()
      .then((base) => vivant && setMouvements(base.mouvements))
      .catch(() => vivant && setMouvements([]))
    return () => {
      vivant = false
    }
  }, [])

  useEffect(() => {
    // ⚠️ **Sauf quand on remonte une animation gardée** (V3.03.3) : elle a sa
    // vitesse, réglée une fois par l'auteur, et la moyenne de son espèce n'a
    // rien à lui apprendre. C'est le même partage qu'au-dessus — *une bande a
    // le droit d'être plus lente que son mouvement*, et la reprise arriverait
    // ici après coup pour la ramener à la moyenne, sans un mot.
    if (laReprise.current || referenceMontage) return
    const nomme = mouvements.find((m) => m.identifiant === montage?.clip.mouvement)
    if (nomme?.cadence) setCadence(nomme.cadence)
  }, [mouvements, montage?.clip.mouvement, referenceMontage])

  useEffect(() => {
    let vivant = true
    if (personnages) { setSujets(personnages); return }
    api.production().then((production) => { if (vivant) setSujets(production.personnages) }).catch(() => {})
    return () => { vivant = false }
  }, [personnages])

  // ── Le métronome ──────────────────────────────────────────────────────────
  //
  // **Un seul, et il commande les deux boucles.** Deux minuteurs partiraient
  // au même moment et dériveraient d'une image en quelques secondes ; ce qu'on
  // compare, alors, ne serait plus le même instant.
  const compte = retenues.length
  useEffect(() => {
    if (compte < 2 || cadence <= 0) return
    const minuteur = window.setInterval(() => setPas((p) => p + 1), 1000 / cadence)
    return () => window.clearInterval(minuteur)
  }, [compte, cadence])

  const rang = useMemo(() => rangDuPas(pas, compte, sens), [pas, compte, sens])

  // ── Prendre et laisser une image ──────────────────────────────────────────
  /** Prendre ou laisser une image du clip.
   *
   *  > ### ⚠️ Une reprise n'a pas le droit de retrier le ruban
   *  >
   *  > Sur un montage neuf, les images se rangent dans l'ordre du clip : il n'y
   *  > a pas d'autre ordre, et le tri est ce qui rend la pellicule lisible. Sur
   *  > une **reprise**, l'ordre vient de l'auteur — il a déplacé, dupliqué,
   *  > inséré —, et *l'ordre du ruban est l'ordre de l'export*. Le tri le
   *  > défaisait : une animation reprise pour y ajouter une seule image
   *  > revenait rangée par numéro, montage perdu. Vu au navigateur le
   *  > 5 septembre 2026, sur l'atelier jetable de la tranche.
   *
   *  Une image ajoutée à une reprise se pose donc **au bout**, et se déplace
   *  ensuite dans l'atelier — c'est là que le ruban se monte. */
  const basculer = useCallback((numero: number) => {
    const reprise = Boolean(laReprise.current)
    setRetenues((deja) =>
      deja.includes(numero)
        ? deja.filter((n) => n !== numero)
        : reprise || ordreManuel.current
          ? [...deja, numero]
          : [...deja, numero].sort((a, b) => a - b),
    )
  }, [])

  // **Le clavier fait tout ce que la souris fait**, parce que le geste se
  // répète trois fois par clip et qu'on ne vise pas trois cents fois à sept
  // pixels près.
  useEffect(() => {
    if (!montage) return
    const dernier = montage.clip.images - 1
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.defaultPrevented) return
      const cible = evenement.target as HTMLElement | null
      if (cible && ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName)) return
      if (evenement.key === "ArrowRight") {
        // **Le clavier reprend la main sur la souris** (A13) : la loupe suit ce
        // qu'on regarde, et ce qu'on regarde est le dernier des deux qui a
        // parlé. Sans ça, un survol laissé derrière figerait la loupe pendant
        // que les flèches déplacent le curseur ailleurs.
        setSurvol(null)
        setCurseur((c) => Math.min(dernier, c + 1))
      } else if (evenement.key === "ArrowLeft") {
        setSurvol(null)
        setCurseur((c) => Math.max(0, c - 1))
      } else if (evenement.key === " ") {
        evenement.preventDefault()
        basculer(ouRegarde.current)
      } else return
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [montage, basculer])

  /** **Mettre une image de côté** (A13), et rien de plus.
   *
   *  ⚠️ **Elle ne touche pas aux images retenues pour la bande** : les deux
   *  gestes vivent sur le même écran et sur la même pellicule, et c'est
   *  précisément pour ça qu'ils ne partagent aucun état. Prélever « pour voir »
   *  ne doit pas défaire un découpage en cours.
   *
   *  **Aucune case n'est visée**, et c'est un critère de la tranche : l'image
   *  entre en bibliothèque, et l'affecter à une pose ou à un objet est un second
   *  geste facultatif, par le chemin ordinaire. Poser la question ici
   *  alourdirait le geste court au moment précis où il doit rester court. */
  const prelever = async (numero: number) => {
    setRefus(null)
    try {
      const rendu = await api.prelever(clip, numero)
      setMisDeCote({ numero, ...rendu })
      setPrelevees((deja) => (deja.includes(numero) ? deja : [...deja, numero]))
    } catch (erreur) {
      // Le refus reste **dans cet écran-ci** : le geste est local, et le
      // remonter au châssis l'afficherait derrière un écran qui le recouvre.
      setRefus(
        erreur instanceof Error ? erreur.message : "cette image ne se prélève pas",
      )
    }
  }

  const garder = async () => {
    if (!montage || retenues.length === 0) return
    setRefus(null)
    try {
      const bande = await api.garderLaBande({
        clip,
        nom,
        images: retenues,
        cadence,
        sens,
        // **La recette de la bande est celle du jeu** (V3.03) : le montage ne
        // règle plus le traitement — il taille le mouvement, et le traitement
        // se règle dans l'atelier d'une animation, frame par frame.
        cadre:
          cadre === "main" && cadreMain
            ? { choix: cadre, ...cadreMain }
            : { choix: cadre },
        // Absent tant que l'auteur n'a pas touché aux champs : un défaut
        // affiché à l'écran n'est pas un réglage, et l'envoyer effacerait le
        // repère que la livraison sait déjà calculer.
        pivot: pivotMain,
        pose,
        direction,
        personnage,
      })
      setBandes((deja) => [...deja, bande])
      brouillon.effacer(); setReferenceMontage(etatMontage)
      // Le prix par bande vient de baisser : on redemande ce qui le porte
      // plutôt que de le recalculer ici, où il finirait par diverger.
      api.ouvrirLeMontage(clip).then((recu) => setMontage(recu)).catch(() => {})
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "la bande n'est pas gardée")
    }
  }

  /** **Reposer ce découpage sur l'animation qu'on remonte** (V3.03.3).
   *
   *  Ce qui part : les prises, le chutier, la vitesse et le sens.
   *
   *  ⚠️ **Ni le cadre, ni la recette.** Le montage est brut depuis la V3.03 — il
   *  ne montre aucun traitement, donc il n'en règle aucun —, et le cadre gardé
   *  porte quatre nombres mesurés que ce corps de requête ne saurait pas
   *  refaire : les renvoyer avec le seul mot « du clip » effacerait le rectangle
   *  et rendrait chaque image à son propre recadrage. La fenêtre se reprend dans
   *  l'atelier de l'animation, où le bouton dit ce qu'elle coûte. */
  const reprendre = async () => {
    if (!reprise || retenues.length === 0) return
    setRefus(null)
    let montageEnregistre = false
    try {
      const remonte = remonterLaBande(origine.current ?? reprise.bande, clip, retenues, occurrences.map((prise) => prise.identifiant))
      await api.corrigerLaBande(reprise.bande.identifiant, {
        prises: remonte.prises,
        chutier: remonte.chutier,
        cadence,
        sens,
      })
      montageEnregistre = true
      if (personnage !== reprise.bande.personnage || pose !== reprise.bande.pose || direction !== reprise.bande.direction)
        await api.affecterLaBande(reprise.bande.identifiant, pose, direction, personnage)
      brouillon.effacer()
      reprise.onRepris()
    } catch (erreur) {
      setRefus(
        (montageEnregistre ? "Le montage est enregistré, mais le classement n’a pas changé. " : "") +
        (erreur instanceof Error ? erreur.message : "l'animation ne se reprend pas"),
      )
    }
  }

  const oublier = async (identifiant: string) => {
    try {
      await api.oublierLaBande(identifiant)
      setBandes((deja) => deja.filter((b) => b.identifiant !== identifiant))
      api.ouvrirLeMontage(clip).then((recu) => setMontage(recu)).catch(() => {})
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "la bande ne s'efface pas")
    }
  }

  /** Une animation sort de l'atelier (A4).
   *
   *  **Ici, sur la ligne de la bande**, et pas dans une barre d'export à part :
   *  on vient de la garder, on veut la voir tourner dans son moteur, et une
   *  sortie qui obligerait à changer d'écran ferait perdre le clip ouvert.
   *
   *  Ce qui part est décidé par l'atelier — la planche, son descriptif, l'image
   *  animée —, et le nom du fichier vient de lui aussi. */
  const sortir = async (identifiant: string) => {
    setRefus(null)
    setSort(identifiant)
    try {
      poserLeFichier(await api.exporterLesBandes([identifiant]))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "l'animation ne sort pas")
    } finally {
      setSort(null)
    }
  }

  const reprendreLeCadre = async () => {
    setReprend(true)
    try {
      const recu = await api.reprendreLeCadre(clip)
      setMontage((deja) =>
        deja ? { ...deja, fenetre: recu.fenetre, propositions: recu.propositions } : deja,
      )
      // Le cadre change : l'aperçu doit repartir dessus.
      setCadre((choix) => choix)
      setRetenues((deja) => [...deja])
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "le cadre ne se reprend pas")
    } finally {
      setReprend(false)
    }
  }

  if (refus && !montage) {
    return (
      <div className="flex min-h-0 flex-1 items-start justify-center bg-papier p-8">
        <div className="w-[520px]">
          <Raison texte={refus} ouAller="revenir" onAller={onFermer} />
        </div>
      </div>
    )
  }

  if (!montage) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-papier">
        <p className="mesure text-[11px] text-encre-4">le clip s'ouvre…</p>
      </div>
    )
  }

  const numero = retenues[rang] ?? retenues[0] ?? 0
  const sujet = sujets.find((un) => un.identifiant === personnage)
  const poses = sujet?.cases ?? []
  const directions = poses.find((une) => une.pose === pose)?.directions ?? []

  return (
    <div
      data-montage
      onChangeCapture={() => { if (!referenceMontage) setReferenceMontage(etatMontage) }}
      onClickCapture={() => { if (!referenceMontage) setReferenceMontage(etatMontage) }}
      onDragStartCapture={() => { if (!referenceMontage) setReferenceMontage(etatMontage) }}
      onKeyDownCapture={() => { if (!referenceMontage) setReferenceMontage(etatMontage) }}
      className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] bg-papier"
    >
      {/* ── Les deux boucles, la pellicule, ce qui est retenu ─────────────── */}
      <section className="defile flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] text-encre">
            {montage.clip.mouvement || "ce clip"}
          </h2>
          <span className="mesure text-[10px] text-encre-4">
            {montage.clip.images} images · {montage.clip.secondes} s ·{" "}
            {montage.clip.montant_dit}
          </span>
          <button
            type="button"
            onClick={onFermer}
            title="Échap referme — les bandes gardées sont déjà rangées"
            className="mesure ml-auto px-1 text-[10px] text-encre-4 hover:text-encre"
          >
            ‹ revenir
          </button>
        </div>

        {refus && <Raison texte={refus} ouAller="fermer" onAller={() => setRefus(null)} />}

        <div className="grid grid-cols-2 gap-4">
          <Boucle
            titre="Ce que le modèle a rendu"
            question="le mouvement est-il bon ?"
            badge={
              enVideo
                ? `la vidéo · ${montage.clip.secondes} s`
                : "brut · fond compris"
            }
            geste={
              (!montage.clip.nature || montage.clip.nature === "video") && <button
                type="button"
                onClick={() => setEnVideo((avant) => !avant)}
                title={
                  enVideo
                    ? "revenir aux images retenues, à la vitesse de la bande"
                    : "la vidéo telle qu'elle est arrivée — son rythme, ses fondus"
                }
                className="mesure text-[10px] text-signal hover:opacity-70"
              >
                {enVideo ? "les images ›" : "la vidéo entière ›"}
              </button>
            }
          >
            {/* ⚠️ **La vidéo et les images ne montrent pas la même chose.** Les
                images sont figées et l'écran les rejoue à *sa* cadence ; la
                vidéo porte le rythme du modèle, ses fondus, ce qu'il fait entre
                deux images. Elle est sur le disque depuis son arrivée et ne se
                regardait par aucun chemin — signalé par l'auteur le 5 septembre
                2026. */}
            {enVideo ? (
              <video
                key={clip}
                src={api.videoDuClip(clip)}
                controls
                loop
                autoPlay
                muted
                aria-label="la vidéo du clip, telle qu'elle est arrivée"
                className="max-h-[240px] w-auto"
              />
            ) : (
              retenues.length > 0 && (
                <img
                  src={api.imageDuClip(clip, numero)}
                  alt={`Image ${numero} du clip`}
                  className="max-h-[220px] w-auto"
                />
              )
            )}
          </Boucle>
          <Boucle
            titre="Les images retenues"
            question="sont-elles les bonnes ?"
            badge={`${compte} image${compte > 1 ? "s" : ""}`}
          >
            {compte > 0 && (
              <img
                src={api.imageDuClip(clip, numero)}
                alt={`Image ${numero} du clip`}
                className="max-h-[220px] w-auto"
              />
            )}
          </Boucle>
        </div>

        <p className="mesure max-w-[70ch] text-[10px] leading-4 text-encre-4">
          Les deux regardent la <b className="text-encre-3">même chose</b> — les
          images retenues, telles que le modèle les a rendues, fond compris. On
          découpe d'abord ; le traitement viendra dans l'atelier d'une animation,
          où chaque frame se règle avec les tables.
        </p>

        <Pellicule
          clip={clip}
          contact={montage.contact}
          images={montage.clip.images}
          retenues={retenues}
          curseur={curseur}
          survol={survol}
          prelevees={prelevees}
          misDeCote={misDeCote}
          onSurvol={setSurvol}
          onBasculer={(numero) => {
            setCurseur(numero)
            basculer(numero)
          }}
          onPrelever={(numero) => void prelever(numero)}
          onEtendue={(debut, fin) => setRetenues(regulier(debut, fin))}
        />

        <div className="flex flex-wrap gap-2">
          {montage.propositions.map((proposition) => (
            <Indice
              key={proposition.quoi}
              proposition={proposition}
              onPoser={() => setRetenues([...proposition.images])}
            />
          ))}
          <button
            type="button"
            onClick={() => setRetenues([])}
            className="rounded-[2px] border border-trait bg-carte px-3 py-2 text-left hover:bg-carte"
          >
            <span className="mesure block text-[9.5px] uppercase tracking-wide text-encre-4">
              repartir de zéro
            </span>
            <span className="text-[11px] text-encre">
              ne garder aucune image — et les choisir une par une
            </span>
          </button>
        </div>
        <p className="mesure max-w-[74ch] text-[10px] leading-4 text-encre-4">
          Les deux propositions sont calculées à l'ouverture et ne coûtent rien.{" "}
          <b className="text-encre-3">Elles ne décident de rien</b> : elles disent
          où regarder, et ce qu'elles posent se corrige ensuite image par image.
        </p>

        <Retenues
          clip={clip}
          occurrences={occurrences}
          retenues={retenues}
          rang={rang}
          onRetirer={(index) => setOccurrences((avant) => avant.filter((_, place) => place !== index))}
          onDeplacer={(depart, arrivee) => {
            ordreManuel.current = true
            setOccurrences((avant) => { const apres = [...avant]; const [prise] = apres.splice(depart, 1); apres.splice(arrivee, 0, prise); return apres })
          }}
        />
        <p className="mesure max-w-[74ch] text-[10px] leading-4 text-encre-4">
          C'est <b className="text-encre-3">exactement</b> ce qui sera monté, dans
          cet ordre. Un clic sur une vignette la retire ; un clic sur la pellicule
          en ajoute une. Glissez une vignette pour changer l’ordre, ou utilisez Alt + flèche gauche / droite sur celle-ci.{" "}
          <b className="text-encre-3">
            Rien n'oblige à ce qu'elles soient régulièrement espacées
          </b>{" "}
          — un cycle de marche peut demander deux images serrées au moment du
          contact et une seule pendant la glisse. Au clavier : les flèches
          déplacent, la barre d'espace prend ou laisse.
        </p>
      </section>

      {/* ── Ce qu'on garde ────────────────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-trait p-4">
        <AvisBrouillon brouillon={brouillon} />
        {/* **Ce qu'on remonte, dit une fois** (V3.03.3). Le nom n'est pas un
            champ ici : on ne baptise pas une animation qui en porte déjà un, et
            un champ qui n'écrirait rien serait un contrôle mort. */}
        {reprise ? (
          <>
            <Libelle aide="bande.nom">on remonte cette animation</Libelle>
            <p data-on-remonte className="text-[13px] text-encre">
              {reprise.bande.nom}
            </p>
            <p className="mesure text-[10px] leading-4 text-encre-4">
              Elle en portait{" "}
              <b className="text-encre-3">
                {reprise.bande.compte} image
                {reprise.bande.compte > 1 ? "s" : ""}
              </b>
              . Ce que vous gardez retrouve ses réglages ; ce que vous laissez
              tombe au chutier, pas à la corbeille.
            </p>
          </>
        ) : (
          <>
            <Libelle aide="bande.nom">cette animation</Libelle>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              aria-label="Le nom de l'animation"
              placeholder="repos, marche, attaque…"
              className="h-[30px] rounded-[2px] border border-contour bg-carte px-2 text-[12px] text-encre"
            />

            <div className="flex items-baseline justify-between">
              <span className="mesure text-[10px] text-encre-4">
                Remplit la case
              </span>
              <span className="mesure text-[10px] text-signal">
                {pose
                  ? `${pose}${direction ? ` · ${direction}` : ""}`
                  : "aucune — brouillon"}
              </span>
            </div>
            <p className="mesure text-[10px] leading-4 text-encre-4">
              {pose
                ? "Elle remplira cette case du plan de poses."
                : "Une bande sans case reste un brouillon, et un brouillon ne bloque rien : on garde d'abord, on range ensuite."}
            </p>
            {montage.clip.pose && (
              <button
                type="button"
                onClick={() => {
                  setPose(pose ? null : montage.clip.pose)
                  setDirection(pose ? null : montage.clip.direction)
                }}
                className="mesure self-start text-[10px] text-signal hover:opacity-70"
              >
                {pose ? "en faire un brouillon" : `viser ${montage.clip.pose} ›`}
              </button>
            )}
          </>
        )}

        <fieldset className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
          <legend className="text-[13px] text-encre-2">Classement de l’animation</legend>
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Personnage
            <select aria-label="Personnage de l’animation" value={personnage ?? ""}
              onChange={(event) => { setPersonnage(event.target.value || null); setPose(null); setDirection(null) }}
              className="h-[34px] rounded-7 border border-trait bg-carte px-[8px] text-encre">
              <option value="">Aucun · brouillon libre</option>
              {personnage && !sujet && <option value={personnage}>{personnage}</option>}
              {sujets.map((un) => <option key={un.identifiant} value={un.identifiant}>{un.nom}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Mouvement / pose
            <select aria-label="Mouvement de l’animation" value={pose ?? ""} disabled={!personnage}
              onChange={(event) => { setPose(event.target.value || null); setDirection(null) }}
              className="h-[34px] rounded-7 border border-trait bg-carte px-[8px] text-encre disabled:opacity-50">
              <option value="">À classer</option>
              {pose && !poses.some((une) => une.pose === pose) && <option value={pose}>{pose} · ancien classement</option>}
              {poses.map((une) => <option key={une.pose} value={une.pose}>{sujet?.plan.find((p) => p.identifiant === une.pose)?.nom || une.pose}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Direction
            <select aria-label="Direction de l’animation" value={direction ?? ""} disabled={!pose || directions.length === 0}
              onChange={(event) => setDirection(event.target.value || null)}
              className="h-[34px] rounded-7 border border-trait bg-carte px-[8px] text-encre disabled:opacity-50">
              <option value="">{directions.length ? "Sans direction" : "Aucune direction prévue"}</option>
              {direction && !directions.some((une) => une.identifiant === direction) && <option value={direction}>{direction} · ancien classement</option>}
              {directions.map((une) => <option key={une.identifiant} value={une.identifiant}>{une.nom}</option>)}
            </select>
          </label>
          <p className="text-[11px] text-encre-3">Le nom reste libre. Ce classement indique où retrouver l’animation ; son clip source reste conservé.</p>
        </fieldset>

        <div className="mt-2 border-t border-trait pt-3">
          <Libelle aide="bande.cadre">le cadre — la fenêtre commune</Libelle>
        </div>
        {/* ⚠️ **Sur une reprise, le cadre se lit et ne se règle pas.** Le
            rectangle gardé porte quatre nombres mesurés ; le changer d'ici ne
            les referait pas, et un choix qui ne change rien à l'image ne se
            distingue pas d'un choix cassé. La fenêtre se reprend dans l'atelier
            de l'animation, où le bouton dit ce qu'elle coûte. */}
        {reprise ? (
          <p data-cadre-en-lecture className="mesure text-[10px] leading-4 text-encre-4">
            {/* La phrase vient du serveur, avec le cadre : deux vocabulaires de
                la même mesure finiraient par ne plus dire la même chose. */}
            {reprise.bande.cadre.mot ? <>{reprise.bande.cadre.mot}. </> : null}
            Il ne se règle pas ici :{" "}
            <b className="text-encre-3">la fenêtre se reprend dans l'atelier de
            l'animation</b>, où l'écran dit les vingt secondes que ça coûte.
          </p>
        ) : (
        <Segments
          valeurs={["clip", "bande", "main"] as const}
          valeur={cadre}
          onChange={(choisi) => {
            // **Passer à la main sème le rectangle en vigueur.** L'auteur y va
            // pour élargir un cadre qui tombe mal, pas pour recommencer un
            // cadrage que la machine venait de faire correctement. Le clip
            // entier sert de départ quand rien n'a encore été mesuré — sans
            // quoi le premier passage à « à la main » n'aurait rien à montrer.
            if (choisi === "main" && !cadreMain) {
              const { gauche, sommet, droite, bas } =
                montage.fenetre ?? { gauche: 0, sommet: 0, droite: montage.clip.largeur - 1, bas: montage.clip.hauteur - 1 }
              setCadreMain({ gauche, sommet, droite, bas })
            }
            setCadre(choisi)
          }}
          libelles={{ clip: "du clip", bande: "de la bande", main: "à la main" }}
        />
        )}
        {!reprise && (
          <>
            {cadre !== "main" && (
              <p className="mesure text-[10px] leading-4 text-encre-4">
                {cadre === "clip"
                  ? "pris sur le clip entier — toutes ses bandes ont la même assise"
                  : "pris sur cette bande seule — elle ne s'accorde plus aux autres"}
              </p>
            )}
            {montage.fenetre && cadre !== "main" && (
              <p className="mesure text-[10px] text-encre-3">
                {montage.fenetre.largeur} × {montage.fenetre.hauteur}, pris sur{" "}
                {montage.fenetre.images}{" "}
                {montage.fenetre.images > 1 ? "images" : "image"}
              </p>
            )}
            {cadre === "main" && cadreMain && (
              <>
                {/* **Ce qui fait foi, dit en clair** (RP15) : le rectangle posé
                    ici est celui que la bande gardera, quoi que la mesure
                    automatique refasse par ailleurs — elle ne l'efface pas. */}
                <p className="mesure text-[10px] leading-4 text-encre-4">
                  posé à la main — ni le clip ni la bande n'en décident. C'est ce
                  rectangle qui sort à l'export ; remesurer le clip ci-dessous ne
                  le change pas.
                </p>
                <div className="grid grid-cols-2 gap-[8px]">
                  <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                    Gauche
                    <input
                      aria-label="Gauche du cadre, en pixels"
                      type="number"
                      min={-8192}
                      max={8192}
                      step={1}
                      value={cadreMain.gauche}
                      onChange={(evenement) => {
                        const gauche = Math.round(Number(evenement.target.value))
                        if (!Number.isFinite(gauche)) return
                        setCadreMain((avant) => avant && { ...avant, gauche, droite: gauche + (avant.droite - avant.gauche) })
                      }}
                      className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                    />
                  </label>
                  <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                    Haut
                    <input
                      aria-label="Haut du cadre, en pixels"
                      type="number"
                      min={-8192}
                      max={8192}
                      step={1}
                      value={cadreMain.sommet}
                      onChange={(evenement) => {
                        const sommet = Math.round(Number(evenement.target.value))
                        if (!Number.isFinite(sommet)) return
                        setCadreMain((avant) => avant && { ...avant, sommet, bas: sommet + (avant.bas - avant.sommet) })
                      }}
                      className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                    />
                  </label>
                  <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                    Largeur
                    <input
                      aria-label="Largeur du cadre, en pixels"
                      type="number"
                      min={1}
                      max={8192}
                      step={1}
                      value={cadreMain.droite - cadreMain.gauche + 1}
                      onChange={(evenement) => {
                        const largeur = Math.round(Number(evenement.target.value))
                        if (!Number.isFinite(largeur) || largeur < 1) return
                        setCadreMain((avant) => avant && { ...avant, droite: avant.gauche + largeur - 1 })
                      }}
                      className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                    />
                  </label>
                  <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                    Hauteur
                    <input
                      aria-label="Hauteur du cadre, en pixels"
                      type="number"
                      min={1}
                      max={8192}
                      step={1}
                      value={cadreMain.bas - cadreMain.sommet + 1}
                      onChange={(evenement) => {
                        const hauteur = Math.round(Number(evenement.target.value))
                        if (!Number.isFinite(hauteur) || hauteur < 1) return
                        setCadreMain((avant) => avant && { ...avant, bas: avant.sommet + hauteur - 1 })
                      }}
                      className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                    />
                  </label>
                </div>
              </>
            )}
            <button
              type="button"
              disabled={reprend}
              onClick={reprendreLeCadre}
              className="mesure self-start text-[10px] text-signal hover:opacity-70 disabled:text-encre-4"
            >
              {reprend
                ? "il remesure les images du clip…"
                : "reprendre le cadre sur tout le clip ›"}
            </button>
            <p className="mesure text-[10px] leading-4 text-encre-4">
              Il remesure les {montage.clip.images} images une par une : comptez
              une vingtaine de secondes sur un clip de cinq secondes. C'est pour
              ça que c'est un bouton et pas un automatisme.
              {cadre === "main" && " Le rectangle posé à la main ci-dessus n'en bouge pas."}
            </p>

            <div className="mt-2 border-t border-trait pt-3">
              <Libelle aide="bande.pivot">le pivot — le point d’ancrage dans le jeu</Libelle>
            </div>
            <div className="flex flex-col gap-[8px]">
              <div className="grid grid-cols-2 gap-[8px]">
                <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                  Horizontal
                  <input
                    aria-label="Pivot horizontal, en pixels"
                    type="number"
                    min={-8192}
                    max={8192}
                    step="any"
                    placeholder="défaut du jeu"
                    value={pivotMain?.x ?? ""}
                    onChange={(evenement) => {
                      const texte = evenement.target.value
                      if (texte === "") { setPivotMain(null); return }
                      const x = Number(texte)
                      if (Number.isFinite(x)) setPivotMain((avant) => ({ x, y: avant?.y ?? 0 }))
                    }}
                    className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                  />
                </label>
                <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">
                  Vertical
                  <input
                    aria-label="Pivot vertical, en pixels"
                    type="number"
                    min={-8192}
                    max={8192}
                    step="any"
                    placeholder="défaut du jeu"
                    value={pivotMain?.y ?? ""}
                    onChange={(evenement) => {
                      const texte = evenement.target.value
                      if (texte === "") { setPivotMain(null); return }
                      const y = Number(texte)
                      if (Number.isFinite(y)) setPivotMain((avant) => ({ x: avant?.x ?? 0, y }))
                    }}
                    className="h-[34px] w-full rounded-7 border border-trait bg-carte px-[8px] text-encre"
                  />
                </label>
              </div>
              <p className="mesure text-[10px] leading-4 text-encre-4">
                {pivotMain
                  ? "posé à la main — gardé avec cette animation."
                  : "sans réglage — l'animation garde le repère de son mouvement."}
              </p>
            </div>
          </>
        )}

        <div className="mt-2 border-t border-trait pt-3">
          <Libelle aide="bande.vitesse">le jeu</Libelle>
        </div>
        <Curseur
          libelle="Vitesse"
          valeur={cadence}
          min={2}
          max={24}
          unite=" images / s"
          onChange={setCadence}
        />
        <Segments
          valeurs={["boucle", "aller-retour"] as const}
          valeur={sens}
          onChange={setSens}
          libelles={{ boucle: "en boucle", "aller-retour": "aller-retour" }}
        />
        <p className="mesure text-[10px] leading-4 text-encre-4">
          Cette vitesse est <b className="text-encre-3">celle qui partira dans le
          jeu</b>. Un second réglage à l'export finirait par la contredire.
        </p>

        {/* **Ce qu'on a déjà tiré de ce clip n'a rien à faire dans une
            reprise** (V3.03.3) : on est venu pour une animation, et la liste
            des autres n'offre ici que des gestes — sortir, effacer — qui
            appartiennent à l'écran d'où l'on vient. */}
        {!reprise && bandes.length > 0 && (
          <>
            <div className="mt-2 border-t border-trait pt-3">
              <Libelle aide="bande.gardees">gardées de ce clip</Libelle>
            </div>
            <ul className="flex flex-col gap-1">
              {bandes.map((bande) => (
                <li
                  key={bande.identifiant}
                  className="flex items-baseline gap-2 rounded-[2px] border border-trait bg-carte px-2 py-1.5"
                >
                  <span className="text-[11px] text-encre">{bande.nom}</span>
                  <span className="mesure text-[10px] text-encre-4">
                    {bande.pose
                      ? `${bande.pose}${bande.direction ? ` · ${bande.direction}` : ""}`
                      : "brouillon"}
                  </span>
                  <span className="mesure ml-auto text-[10px] text-encre-4">
                    {bande.compte} images
                  </span>
                  <button
                    type="button"
                    disabled={sort !== null}
                    onClick={() => void sortir(bande.identifiant)}
                    aria-label={`Sortir l'animation ${bande.nom}`}
                    title="planche de sprites, son descriptif, et une image qui tourne"
                    className="mesure text-[10px] text-encre-4 hover:text-encre disabled:opacity-40"
                  >
                    {sort === bande.identifiant ? "…" : "Sortir ›"}
                  </button>
                  {onBande && <button type="button" aria-label={`Retoucher l’animation ${bande.nom}`} onClick={() => onBande(bande.identifiant)} className="mesure text-[11px] text-encre-2 hover:text-signal">Retoucher ›</button>}
                  <button
                    type="button"
                    onClick={() => void oublier(bande.identifiant)}
                    aria-label={`Effacer la bande ${bande.nom}`}
                    className="mesure text-[10px] text-encre-4 hover:text-signal"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* **Le prix par bande compte les bandes qu'on garde**, et remonter
            celle-ci n'en ajoute aucune : l'afficher ici ferait croire qu'on va
            payer un cran de plus. */}
        {!reprise && (
          <div className="mt-2 rounded-[2px] border border-trait bg-carte p-3">
            <p className="text-[15px] text-encre">
              {dollars(montage.prix.par_bande)}
            </p>
            <p className="mesure text-[10px] leading-4 text-encre-4">
              par animation gardée — le clip a coûté {dollars(montage.prix.clip)},
              et{" "}
              {montage.prix.bandes === 0
                ? "aucune bande n'en est encore sortie"
                : montage.prix.bandes === 1
                  ? "une bande en est sortie"
                  : `${montage.prix.bandes} bandes en sont sorties`}
              . Une de plus ferait tomber ce prix à{" "}
              {dollars(montage.prix.si_une_de_plus)}.
            </p>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {/* **Le geste dominant dit lequel des deux écrans on tient.** Tailler
              une animation neuve et remonter celle qu'on a : deux gestes, un
              seul bouton, et son libellé nomme l'animation pour qu'aucun doute
              ne subsiste au moment où on l'écrit. */}
          {reprise ? (
            <Bouton
              principal
              inactif={retenues.length === 0}
              onClick={() => void reprendre()}
              enfants={
                retenues.length === 0
                  ? "prenez au moins une image"
                  : `Reprendre « ${reprise.bande.nom} » · ${retenues.length} images`
              }
            />
          ) : (
            <Bouton
              principal
              inactif={retenues.length === 0 || !nom.trim()}
              onClick={() => void garder()}
              enfants={
                retenues.length === 0
                  ? "prenez au moins une image"
                  : !nom.trim()
                    ? "nommez cette animation"
                    : `Garder « ${nom.trim()} » · ${retenues.length} images`
              }
            />
          )}
        </div>
        <p className="mesure text-[10px] leading-4 text-encre-4">
          <b className="text-encre-3">Rien sur cet écran ne dépense.</b> {montage.clip.nature && montage.clip.nature !== "video" ? "Les frames originales sont conservées." : "Le clip est payé."} Découpez, recommencez, changez d'avis.
          {reprise && (
            <>
              {" "}
              <b className="text-encre-3">Revenir sans reprendre</b> laisse
              l'animation telle qu'elle est.
            </>
          )}
        </p>
      </aside>
    </div>
  )
}

// ── Les pièces de l'écran ───────────────────────────────────────────────────

/** **Ce qui bouge entre les images alors que le sujet n'a pas bougé** (A5).
 *
 *  ⚠️ **Ni seuil, ni verdict, ni grisé.** Le produit ne refuse rien sur ces
 *  chiffres-là : ils se posent à côté de l'aperçu qui tourne, et c'est l'auteur
 *  qui regarde son animation en face du nombre. Un défaut fixe est un défaut ;
 *  un défaut animé est un défaut qu'on regarde, et la seule chose que l'écran
 *  puisse faire est de le mettre là où on le regarde.
 *
 *  Les deux ne se lisent pas de la même façon, et la phrase le dit :
 *
 *  - **le bord qui revient sur ses pas** est celui qui nomme le grésillement :
 *    un pixel que le sujet traverse s'allume une fois et reste allumé. Ce qui
 *    s'allume, s'éteint et se rallume est soit un vrai va-et-vient — un bras qui
 *    balance —, soit du grésil ; c'est pour ça que la phrase dit les deux ;
 *  - **les couleurs d'une seule image** ne mentent presque pas : une couleur qui
 *    ne dure qu'un huitième de seconde n'est pas une nuance, c'est un
 *    scintillement.
 *
 *  ⚠️ **Le troisième chiffre existe et ne s'affiche pas** — la part du bord qui
 *  change d'une image à l'autre. Il mélange le grésil au mouvement, et le
 *  mouvement l'écrase : sur le banc de la tranche, un réglage qui enlève un
 *  tiers du grésil ne le fait bouger que de six pour cent. Il voyage dans
 *  l'aperçu pour qui compare deux réglages, mais **un chiffre à l'écran qui ne
 *  sait pas répondre est pire qu'un chiffre absent**. */
/** Le ruban de toutes les images du clip, **en tranches prises au centre**.
 *
 *  Le repos y est uni, la marche y bat : on lit le mouvement avant de le
 *  regarder. Tout vient de la **planche contact** — une seule image pour cent
 *  vingt — et la loupe y puise aussi, à sa taille naturelle. */
function Boucle({
  titre,
  question,
  badge,
  geste,
  children,
}: {
  titre: string
  question: string
  badge: string
  /** Un geste posé au bout de l'en-tête, quand la boucle en porte un. */
  geste?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="mesure text-[10px] text-encre-3">{titre}</span>
        <b className="mesure text-[10px] font-normal text-encre-4">{question}</b>
        {geste && <span className="ml-auto">{geste}</span>}
      </div>
      <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-[2px] border border-trait bg-papier-cote">
        {children}
        <span className="mesure absolute bottom-1 right-1 rounded-[2px] bg-papier/80 px-1 text-[9px] text-encre-4">
          {badge}
        </span>
      </div>
    </div>
  )
}

/** Le ruban de toutes les images du clip, **en tranches prises au centre**.
 *
 *  Le repos y est uni, la marche y bat : on lit le mouvement avant de le
 *  regarder. Tout vient de la **planche contact** — une seule image pour cent
 *  vingt — et la loupe y puise aussi, à sa taille naturelle. */
function Pellicule({
  clip,
  contact,
  images,
  retenues,
  curseur,
  survol,
  prelevees,
  misDeCote,
  onSurvol,
  onBasculer,
  onPrelever,
  onEtendue,
}: {
  clip: string
  contact: { cote: number; colonnes: number; lignes: number }
  images: number
  retenues: number[]
  curseur: number
  survol: number | null
  /** **Les images déjà mises de côté pendant cette visite** (A13). Marquées sur
   *  le ruban, parce que prélever plusieurs images d'affilée se fait en glissant
   *  le long du clip : sans marque, on redemande deux fois la même. */
  prelevees: number[]
  /** Ce que le dernier prélèvement a donné. Une phrase sous la loupe, jamais un
   *  bandeau : le geste est court et se répète. */
  misDeCote: { numero: number; asset: Asset | null; doublon: Asset | null } | null
  onSurvol: (numero: number | null) => void
  onBasculer: (numero: number) => void
  /** **Mettre cette image de côté** (A13) — elle entre en bibliothèque, et rien
   *  de ce qui est retenu pour la bande ne bouge. */
  onPrelever: (numero: number) => void
  onEtendue: (debut: number, fin: number) => void
}) {
  const ruban = useRef<HTMLDivElement>(null)
  const debut = retenues.length ? Math.min(...retenues) : 0
  const fin = retenues.length ? Math.max(...retenues) : 0
  const url = api.contactDuClip(clip)
  const facteur = RUBAN / contact.cote
  // **L'image qu'on regarde** — celle que le pointeur survole, ou celle que le
  // clavier désigne quand c'est lui qui a parlé en dernier. Un seul nombre, et
  // c'est ce qui permet à la loupe de porter un geste : elle a toujours une
  // cible, y compris avant le premier survol.
  const regarde = survol ?? curseur

  const numeroSous = useCallback(
    (x: number) => {
      const boite = ruban.current?.getBoundingClientRect()
      if (!boite || boite.width === 0) return 0
      const part = (x - boite.left) / boite.width
      return Math.max(0, Math.min(images - 1, Math.floor(part * images)))
    },
    [images],
  )

  // Les poignées déplacent une **étendue**, et ce qu'elles posent est un
  // découpage régulier : c'est le chemin rapide, et il n'empêche plus le chemin
  // fin — chaque image se reprend au clic ensuite.
  //
  // **Les écouteurs se posent dans le geste, pas dans un effet** — même
  // correction, même jour et même mesure que le cadre à la main : un effet
  // déclenché par un état posé au `mousedown` s'exécute après le rendu, et un
  // glissement rapide passe entièrement avant lui. Le bord opposé est figé à la
  // prise, et c'est mieux ainsi : pendant qu'on tire à droite, la gauche ne doit
  // pas dériver.
  const tirer = (bord: "gauche" | "droite") => (evenement: React.MouseEvent) => {
    evenement.preventDefault()
    const fixe = { debut, fin }
    const bouge = (glissement: MouseEvent) => {
      const numero = numeroSous(glissement.clientX)
      if (bord === "gauche") onEtendue(Math.min(numero, fixe.fin), fixe.fin)
      else onEtendue(fixe.debut, Math.max(numero, fixe.debut))
    }
    const lache = () => {
      window.removeEventListener("mousemove", bouge)
      window.removeEventListener("mouseup", lache)
    }
    window.addEventListener("mousemove", bouge)
    window.addEventListener("mouseup", lache)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* ⚠️ **Le survol ne se relâche pas quand le pointeur sort** (A13), et
          c'est ce qui rend le geste de prélèvement possible : la loupe reste sur
          la dernière image regardée, et le bouton qui la met de côté est
          atteignable. Le relâcher faisait disparaître la loupe — donc sa cible —
          au moment précis où l'on partait cliquer dessus. Le clavier, lui,
          reprend la main en remettant le survol à rien. */}
      <div
        ref={ruban}
        data-pellicule
        className="relative flex select-none overflow-hidden rounded-[2px] border border-trait bg-papier-cote"
        style={{ height: RUBAN }}
      >
        {Array.from({ length: images }, (_, numero) => {
          const colonne = numero % contact.colonnes
          const ligne = Math.floor(numero / contact.colonnes)
          // **Combien de fois**, et pas seulement *si* : une image dupliquée
          // dans l'atelier est retenue deux fois, la cellule n'a qu'un état, et
          // le compte du bouton dirait alors une image de plus que la pellicule
          // n'en montre. Le laisser cliquer la retire **toutes** — c'est un
          // interrupteur, pas un compteur —, et le dire évite d'y voir un
          // défaut.
          const fois = retenues.filter((n) => n === numero).length
          const prise = fois > 0
          const misee = prelevees.includes(numero)
          return (
            <button
              key={numero}
              type="button"
              aria-label={`Image ${numero}${
                fois > 1 ? ` — retenue ${fois} fois` : prise ? " — retenue" : ""
              }${misee ? " — mise de côté" : ""}`}
              aria-pressed={prise}
              // **Une seule cellule dans l'ordre de tabulation : celle du
              // curseur.** Mesuré au navigateur : les cent vingt et une cellules
              // d'un clip de dix secondes y étaient toutes, et rejoindre le
              // bouton *Garder* au clavier demandait cent vingt et une
              // pressions. La pellicule est **un seul arrêt** — on y entre, les
              // flèches déplacent le curseur, l'espace prend ou laisse, et la
              // tabulation suivante en sort.
              tabIndex={numero === curseur ? 0 : -1}
              onMouseEnter={() => onSurvol(numero)}
              onClick={() => onBasculer(numero)}
              className="shrink-0 border-r border-papier/40 last:border-r-0"
              style={{
                width: `${100 / images}%`,
                height: RUBAN,
                backgroundImage: `url(${url})`,
                backgroundSize: `${contact.colonnes * contact.cote * facteur}px ${
                  contact.lignes * contact.cote * facteur
                }px`,
                backgroundPosition: `-${
                  colonne * contact.cote * facteur +
                  (contact.cote * facteur - TRANCHE) / 2
                }px -${ligne * contact.cote * facteur}px`,
                // `--color-signal`, et non `--signal` : le nom court n'existe
                // pas. Mesuré au navigateur, l'encadré des images retenues ne
                // s'était **jamais** dessiné — une couleur inconnue ne fait pas
                // d'erreur, elle ne fait rien.
                outline: prise ? "1px solid var(--color-signal)" : undefined,
                outlineOffset: "-1px",
                opacity: prise || misee ? 1 : 0.55,
              }}
            >
              {/* **La marque de ce qui est déjà pris** (A13) — un trait en pied,
                  et non un second encadré : l'encadré dit *retenue pour la
                  bande*, et deux encadrés sur la même cellule ne se
                  distingueraient pas. Une image peut être les deux à la fois, et
                  c'est un cas ordinaire : on garde le contact pour la bande et
                  on prélève la même image comme pose fixe. */}
              {misee && (
                <span
                  aria-hidden
                  data-mise-de-cote={numero}
                  className="pointer-events-none block h-[2px] w-full bg-ok"
                  style={{ marginTop: RUBAN - 2 }}
                />
              )}
            </button>
          )
        })}
        {retenues.length > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 border border-signal"
            style={{
              left: `${(debut / images) * 100}%`,
              width: `${((fin - debut + 1) / images) * 100}%`,
            }}
          >
            <span
              data-poignee="gauche"
              onMouseDown={tirer("gauche")}
              className="pointer-events-auto absolute inset-y-0 -left-1 w-2 cursor-ew-resize bg-signal/60"
            />
            <span
              data-poignee="droite"
              onMouseDown={tirer("droite")}
              className="pointer-events-auto absolute inset-y-0 -right-1 w-2 cursor-ew-resize bg-signal/60"
            />
          </div>
        )}
        <span
          className="pointer-events-none absolute inset-y-0 w-px bg-encre"
          style={{ left: `${((curseur + 0.5) / images) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="mesure text-[10px] text-encre-4">image 0</span>
        <span className="mesure text-[10px] text-encre-3">
          {retenues.length} {retenues.length > 1 ? "images retenues" : "image retenue"}
        </span>
        <span className="mesure text-[10px] text-encre-4">image {images - 1}</span>
      </div>

      {/* **La loupe, parce qu'à sept pixels de large on ne sait pas ce qu'on
          clique.** Elle prend la même planche contact, à sa taille naturelle.

          **Elle ne disparaît plus** (A13) : elle montre la dernière image
          regardée — au pointeur, ou au clavier quand c'est lui qui a parlé en
          dernier — et c'est ce qui lui permet de porter un geste. Une loupe qui
          s'efface au moment où l'on va cliquer dessus n'est pas une surface,
          c'est un reflet. */}
      <div className="flex items-center gap-2">
        <div
          data-loupe
          className="shrink-0 rounded-[2px] border border-contour"
          style={{
            width: contact.cote,
            height: contact.cote,
            backgroundImage: `url(${url})`,
            backgroundPosition: `-${(regarde % contact.colonnes) * contact.cote}px -${
              Math.floor(regarde / contact.colonnes) * contact.cote
            }px`,
          }}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="mesure text-[10px] text-encre-4">image {regarde}</span>

          {/* **Le second geste de la pellicule** (A13), et il est ici plutôt que
              sur le ruban : à sept pixels de large, une cellule ne porte pas
              deux gestes qu'on puisse viser. La loupe, elle, montre déjà *cette
              image-là* en grand — c'est la surface qui sait de quoi elle parle.

              ⚠️ **Il ne touche pas aux images retenues.** On prélève « pour
              voir » pendant qu'un découpage est en cours, et le découpage ne
              doit pas s'en apercevoir. */}
          <button
            type="button"
            onClick={() => onPrelever(regarde)}
            aria-label={`Mettre l'image ${regarde} de côté`}
            title="elle entre en bibliothèque — rien n'est dépensé, et les images retenues ne bougent pas"
            className="mesure w-fit px-1 text-[10px] text-signal hover:opacity-70"
          >
            Mettre de côté ›
          </button>

          {/* **Ce qui vient d'arriver, en une phrase.** Un bandeau à chasser
              rendrait long un geste qui se répète ; et le doublon n'est pas un
              refus — le produit signale ce dont il est certain, les mêmes octets
              deux fois, et l'auteur décide. */}
          {misDeCote && (
            <span className="mesure text-[9.5px] leading-4 text-encre-4">
              {misDeCote.doublon
                ? `l'image ${misDeCote.numero} était déjà en bibliothèque — `
                  + `« ${misDeCote.doublon.label} »`
                : `l'image ${misDeCote.numero} est en bibliothèque — on la range `
                  + `quand on veut, dans une case ou sur un objet`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Indice({
  proposition,
  onPoser,
}: {
  proposition: PropositionDeRythme
  onPoser: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPoser}
      className="rounded-[2px] border border-trait bg-carte px-3 py-2 text-left hover:bg-carte"
    >
      <span className="mesure block text-[9.5px] uppercase tracking-wide text-encre-4">
        l'atelier a remarqué
      </span>
      <span className="text-[11px] text-encre">{proposition.mot}</span>
    </button>
  )
}

/** Les images retenues, **dans l'ordre**, en numéros — le montage est brut
 *  (V3.03) : il n'a plus la planche sous la main. Le liseré dit quelle image
 *  passe en ce moment. */
function Retenues({
  clip,
  occurrences,
  retenues,
  rang,
  onRetirer,
  onDeplacer,
}: {
  clip: string
  occurrences: Prise[]
  retenues: number[]
  rang: number
  onRetirer: (numero: number) => void
  onDeplacer: (depart: number, arrivee: number) => void
}) {
  const glissee = useRef<number | null>(null)
  if (retenues.length === 0) {
    return (
      <p className="mesure rounded-[2px] border border-dashed border-trait p-3 text-[10px] text-encre-4">
        aucune image retenue — cliquez la pellicule, ou posez une des deux
        propositions
      </p>
    )
  }
  return (
    <div aria-label="Ordre des frames retenues" className="flex flex-wrap gap-[8px]">
      {retenues.map((numero, place) => (
        <button
          key={occurrences[place]?.identifiant || `${numero}-${place}`}
          type="button"
          onClick={() => onRetirer(place)}
          draggable
          onDragStart={(event) => { glissee.current = place; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(place)) }}
          onDragOver={(event) => { if (glissee.current !== null) event.preventDefault() }}
          onDrop={(event) => { event.preventDefault(); if (glissee.current !== null) onDeplacer(glissee.current, place); glissee.current = null }}
          onDragEnd={() => { glissee.current = null }}
          onKeyDown={(event) => {
            if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return
            event.preventDefault(); event.stopPropagation()
            onDeplacer(place, Math.max(0, Math.min(retenues.length - 1, place + (event.key === "ArrowLeft" ? -1 : 1))))
          }}
          title={`Image ${numero} — un clic la retire`}
          aria-label={`Retirer l'image ${numero}`}
          className="rounded-[2px] border p-0.5"
          style={{
            borderColor:
              place === rang ? "var(--color-signal)" : "var(--color-trait)",
            background: "var(--color-carte)",
          }}
        >
          <img src={api.imageDuClip(clip, numero)} alt="" draggable={false} className="h-[54px] w-[54px] object-contain" />
          <span className="mesure block text-[11px] text-encre-4">
            {numero}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Deux calculs, écrits une fois ───────────────────────────────────────────

/** Des images régulièrement espacées entre deux bornes.
 *
 *  **Le seul endroit de l'écran qui en pose**, et c'est le chemin rapide : la
 *  fenêtre ne sait pas où sont les instants qui comptent. Ce qu'elle pose se
 *  corrige ensuite image par image, et c'est tout le reste de l'écran. */
function regulier(debut: number, fin: number): number[] {
  const total = fin - debut + 1
  if (total <= 0) return []
  if (total <= ECHANTILLON_MAX) {
    return Array.from({ length: total }, (_, rang) => debut + rang)
  }
  const rangs = new Set<number>()
  for (let cran = 0; cran < ECHANTILLON_MAX; cran += 1) {
    rangs.add(
      Math.round(debut + (cran * (total - 1)) / (ECHANTILLON_MAX - 1)),
    )
  }
  return [...rangs].sort((a, b) => a - b)
}

/** Où en est le métronome, selon le sens.
 *
 *  **L'aller-retour double la durée sans doubler les images** : c'est la bonne
 *  réponse pour un balancement, une respiration, une flamme — et c'est aussi
 *  pourquoi il ne se calcule pas au serveur, qui garde la liste telle qu'elle
 *  est jouée à l'endroit. */
function rangDuPas(pas: number, compte: number, sens: string): number {
  if (compte <= 1) return 0
  if (sens !== "aller-retour") return pas % compte
  const cycle = (compte - 1) * 2
  const place = pas % cycle
  return place < compte ? place : cycle - place
}
