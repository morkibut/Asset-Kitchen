// Le montage — l'écran où un clip payé devient plusieurs bandes (A10, V3).
//
// C'est le troisième moment de `docs/maquettes-v3/01-du-sprite-a-la-bande.html`,
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
  type ApercuDeBande,
  type Asset,
  type Bande,
  type Montage,
  type Mouvement,
  type PropositionDeRythme,
  type Recette,
} from "../api"
import { Bouton, Curseur, Libelle, Raison, Segments } from "./chassis"

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
  onFermer,
  onErreur,
}: {
  clip: string
  onFermer: () => void
  onErreur: (raison: string) => void
}) {
  const [montage, setMontage] = useState<Montage | null>(null)
  const [refus, setRefus] = useState<string | null>(null)

  // ── Ce que l'auteur compose ───────────────────────────────────────────────
  /** Les images retenues, **dans l'ordre où elles se jouent**. Rien n'oblige à
   *  ce qu'elles soient régulièrement espacées : c'est très exactement ce que
   *  cet écran apporte au produit. */
  const [retenues, setRetenues] = useState<number[]>([])
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
  /** `null` veut dire **celle du jeu**, et c'est le cas courant : une bande
   *  gardée sans y toucher n'a aucun écart à afficher. */
  const [recette, setRecette] = useState<Recette | null>(null)
  const [pose, setPose] = useState<string | null>(null)
  const [direction, setDirection] = useState<string | null>(null)

  // ── Ce que le serveur répond ──────────────────────────────────────────────
  const [apercu, setApercu] = useState<ApercuDeBande | null>(null)
  const [bandes, setBandes] = useState<Bande[]>([])
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [reprend, setReprend] = useState(false)

  // ── L'état de l'écran ─────────────────────────────────────────────────────
  /** Le cran du métronome. **Un seul pour les deux boucles** : c'est ce qui les
   *  garde en phase, et c'est ce qui manquait au banc. */
  const [pas, setPas] = useState(0)
  const [survol, setSurvol] = useState<number | null>(null)
  /** L'image que le clavier désigne. Le geste se répète trois fois par clip :
   *  il doit se faire au clavier autant qu'à la souris. */
  const [curseur, setCurseur] = useState(0)
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
    const nomme = mouvements.find((m) => m.identifiant === montage?.clip.mouvement)
    if (nomme?.cadence) setCadence(nomme.cadence)
  }, [mouvements, montage?.clip.mouvement])

  // ── L'aperçu, refait à chaque geste ───────────────────────────────────────
  //
  // Il ne coûte rien — le clip est payé —, mais il coûte une attente : on ne le
  // relance qu'une fois la main reposée. Sans ce délai, faire glisser une
  // poignée sur cent vingt images enverrait cent vingt demandes.
  useEffect(() => {
    if (!montage || retenues.length === 0) {
      setApercu(null)
      return
    }
    let vivant = true
    const minuteur = window.setTimeout(() => {
      api
        .apercuDeBande({
          clip,
          images: retenues,
          recette,
          cadre:
            cadre === "main" && cadreMain
              ? { choix: cadre, ...cadreMain }
              : { choix: cadre },
        })
        .then((recu) => vivant && setApercu(recu))
        .catch((erreur) =>
          setRefus(
            erreur instanceof Error ? erreur.message : "l'aperçu ne se monte pas",
          ),
        )
    }, 90)
    return () => {
      vivant = false
      window.clearTimeout(minuteur)
    }
  }, [clip, montage, retenues, recette, cadre, cadreMain])

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
  const basculer = useCallback((numero: number) => {
    setRetenues((deja) =>
      deja.includes(numero)
        ? deja.filter((n) => n !== numero)
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
        setCurseur((c) => {
          basculer(c)
          return c
        })
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
        recette,
        cadre:
          cadre === "main" && cadreMain
            ? { choix: cadre, ...cadreMain }
            : { choix: cadre },
        pose,
        direction,
      })
      setBandes((deja) => [...deja, bande])
      // Le prix par bande vient de baisser : on redemande ce qui le porte
      // plutôt que de le recalculer ici, où il finirait par diverger.
      api.ouvrirLeMontage(clip).then((recu) => setMontage(recu)).catch(() => {})
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "la bande n'est pas gardée")
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

  const reprendreLeCadre = async () => {
    setReprend(true)
    try {
      const recu = await api.reprendreLeCadre(clip, recette)
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
      <div className="flex min-h-0 flex-1 items-start justify-center bg-fond-0 p-8">
        <div className="w-[520px]">
          <Raison texte={refus} ouAller="revenir" onAller={onFermer} />
        </div>
      </div>
    )
  }

  if (!montage) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-fond-0">
        <p className="mesure text-[11px] text-texte-3">le clip s'ouvre…</p>
      </div>
    )
  }

  const du_jeu = montage.recette_du_jeu
  const active = recette ?? du_jeu
  const numero = retenues[rang] ?? retenues[0] ?? 0

  return (
    <div
      data-montage
      className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] bg-fond-0"
    >
      {/* ── Les deux boucles, la pellicule, ce qui est retenu ─────────────── */}
      <section className="defile flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] text-texte">
            {montage.clip.mouvement || "ce clip"}
          </h2>
          <span className="mesure text-[10px] text-texte-3">
            {montage.clip.images} images · {montage.clip.secondes} s ·{" "}
            {montage.clip.montant_dit}
          </span>
          <button
            type="button"
            onClick={onFermer}
            title="Échap referme — les bandes gardées sont déjà rangées"
            className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-texte"
          >
            ‹ revenir
          </button>
        </div>

        {refus && <Raison texte={refus} ouAller="fermer" onAller={() => setRefus(null)} />}

        <div className="grid grid-cols-2 gap-4">
          <Boucle
            titre="Ce que le modèle a rendu"
            question="le mouvement est-il bon ?"
            badge="brut · fond compris"
          >
            {retenues.length > 0 && (
              <img
                src={api.imageDuClip(clip, numero)}
                alt={`Image ${numero} du clip`}
                className="max-h-[220px] w-auto"
              />
            )}
          </Boucle>
          <Boucle
            titre="La bande, passée par la chaîne du jeu"
            question="le découpage est-il bon ?"
            badge={
              active.grille ? `${active.grille.cible} px` : "sans mise à la taille"
            }
          >
            <CaseDeLaPlanche apercu={apercu} rang={rang} />
          </Boucle>
        </div>

        <p className="mesure max-w-[70ch] text-[10px] leading-4 text-texte-3">
          Les deux tournent sur <b className="text-texte-2">le même métronome</b>, à
          la même vitesse et démarrées ensemble. Juger un mouvement et juger un
          découpage sont deux métiers, et une seule image obligerait à en trancher
          un au jugé.
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
            className="rounded-[2px] border border-bord bg-fond-2 px-3 py-2 text-left hover:bg-fond-3"
          >
            <span className="mesure block text-[9.5px] uppercase tracking-wide text-texte-3">
              repartir de zéro
            </span>
            <span className="text-[11px] text-texte">
              ne garder aucune image — et les choisir une par une
            </span>
          </button>
        </div>
        <p className="mesure max-w-[74ch] text-[10px] leading-4 text-texte-3">
          Les deux propositions sont calculées à l'ouverture et ne coûtent rien.{" "}
          <b className="text-texte-2">Elles ne décident de rien</b> : elles disent
          où regarder, et ce qu'elles posent se corrige ensuite image par image.
        </p>

        <Retenues
          apercu={apercu}
          retenues={retenues}
          rang={rang}
          onRetirer={basculer}
        />
        <p className="mesure max-w-[74ch] text-[10px] leading-4 text-texte-3">
          C'est <b className="text-texte-2">exactement</b> ce qui sera monté, dans
          cet ordre. Un clic sur une vignette la retire ; un clic sur la pellicule
          en ajoute une.{" "}
          <b className="text-texte-2">
            Rien n'oblige à ce qu'elles soient régulièrement espacées
          </b>{" "}
          — un cycle de marche peut demander deux images serrées au moment du
          contact et une seule pendant la glisse. Au clavier : les flèches
          déplacent, la barre d'espace prend ou laisse.
        </p>
      </section>

      {/* ── Ce qu'on garde ────────────────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-bord p-4">
        <Libelle aide="bande.nom">cette animation</Libelle>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          aria-label="Le nom de l'animation"
          placeholder="repos, marche, attaque…"
          className="h-[30px] rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[12px] text-texte"
        />

        <div className="flex items-baseline justify-between">
          <span className="mesure text-[10px] text-texte-3">Remplit la case</span>
          <span className="mesure text-[10px] text-signal-clair">
            {pose ? `${pose}${direction ? ` · ${direction}` : ""}` : "aucune — brouillon"}
          </span>
        </div>
        <p className="mesure text-[10px] leading-4 text-texte-3">
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
            className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
          >
            {pose ? "en faire un brouillon" : `viser ${montage.clip.pose} ›`}
          </button>
        )}

        <div className="mt-2 border-t border-bord pt-3">
          <Libelle aide="bande.cadre">le cadre — la fenêtre commune</Libelle>
        </div>
        <Segments
          valeurs={["clip", "bande", "main"] as const}
          valeur={cadre}
          onChange={(choisi) => {
            // **Passer à la main sème le rectangle en vigueur.** L'auteur y va
            // pour élargir un cadre qui tombe mal, pas pour recommencer un
            // cadrage que la machine venait de faire correctement.
            if (choisi === "main" && !cadreMain && apercu?.fenetre) {
              const { gauche, sommet, droite, bas } = apercu.fenetre
              setCadreMain({ gauche, sommet, droite, bas })
            }
            setCadre(choisi)
          }}
          libelles={{ clip: "du clip", bande: "de la bande", main: "à la main" }}
        />
        <p className="mesure text-[10px] leading-4 text-texte-3">
          {apercu?.cadre.mot ??
            "pris sur le clip entier — toutes ses bandes ont la même assise"}
        </p>
        {apercu?.fenetre && (
          <p className="mesure text-[10px] text-texte-2">
            {apercu.fenetre.largeur} × {apercu.fenetre.hauteur}, pris sur{" "}
            {apercu.fenetre.images}{" "}
            {apercu.fenetre.images > 1 ? "images" : "image"}
          </p>
        )}
        {cadre === "main" && cadreMain && (
          <CadreALaMain
            sujet={apercu?.sujet ?? null}
            sujetLargeur={apercu?.sujet_largeur ?? 0}
            sujetHauteur={apercu?.sujet_hauteur ?? 0}
            ancrage={apercu?.ancrage ?? "bas"}
            cadre={cadreMain}
            onPoser={setCadreMain}
          />
        )}
        <button
          type="button"
          disabled={reprend}
          onClick={reprendreLeCadre}
          className="mesure self-start text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
        >
          {reprend
            ? "il remesure les images du clip…"
            : "reprendre le cadre sur tout le clip ›"}
        </button>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Il remesure les {montage.clip.images} images une par une : comptez une
          vingtaine de secondes sur un clip de cinq secondes. C'est pour ça que
          c'est un bouton et pas un automatisme.
        </p>

        <div className="mt-2 border-t border-bord pt-3">
          <div className="flex items-baseline gap-2">
            <Libelle aide="bande.recette">la recette du découpage</Libelle>
            {recette && (
              <button
                type="button"
                onClick={() => setRecette(null)}
                className="mesure ml-auto text-[10px] text-signal hover:text-signal-clair"
              >
                revenir à celle du jeu
              </button>
            )}
          </div>
        </div>
        {active.grille && (
          <Curseur
            libelle="Taille du pixel"
            valeur={active.grille.cible}
            min={16}
            max={128}
            pas={4}
            unite=" px de haut"
            onChange={(v) =>
              setRecette({
                ...active,
                grille: active.grille ? { ...active.grille, cible: v } : null,
              })
            }
          />
        )}
        {active.quantification && (
          <Curseur
            libelle="Couleurs"
            valeur={active.quantification.couleurs}
            min={4}
            max={64}
            onChange={(v) =>
              setRecette({
                ...active,
                quantification: active.quantification
                  ? { ...active.quantification, couleurs: v }
                  : null,
              })
            }
          />
        )}
        {active.passes[0] && (
          <Curseur
            libelle="Détourage, tolérance"
            valeur={active.passes[0].tolerance}
            min={4}
            max={80}
            onChange={(v) =>
              setRecette({
                ...active,
                passes: active.passes.map((p, rang) =>
                  rang === 0 ? { ...p, tolerance: v } : p,
                ),
              })
            }
          />
        )}
        {apercu && apercu.ecarts.length > 0 && (
          <ul className="mesure flex flex-col gap-1 rounded-[2px] border border-bord bg-fond-2 p-2 text-[10px] leading-4 text-texte-2">
            {apercu.ecarts.map((mot) => (
              <li key={mot}>— {mot}</li>
            ))}
          </ul>
        )}
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Elle part de celle du jeu. Ce que vous changez ici s'écrit{" "}
          <b className="text-texte-2">sur la bande</b>, pas sur le jeu — et tout
          écart se lit juste au-dessus. Changer le détourage ne reprend pas le
          cadre : il se reprend au bouton, plus haut.
        </p>

        <div className="mt-2 border-t border-bord pt-3">
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
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Cette vitesse est <b className="text-texte-2">celle qui partira dans le
          jeu</b>. Un second réglage à l'export finirait par la contredire.
        </p>

        {bandes.length > 0 && (
          <>
            <div className="mt-2 border-t border-bord pt-3">
              <Libelle aide="bande.gardees">gardées de ce clip</Libelle>
            </div>
            <ul className="flex flex-col gap-1">
              {bandes.map((bande) => (
                <li
                  key={bande.identifiant}
                  className="flex items-baseline gap-2 rounded-[2px] border border-bord bg-fond-2 px-2 py-1.5"
                >
                  <span className="text-[11px] text-texte">{bande.nom}</span>
                  <span className="mesure text-[10px] text-texte-3">
                    {bande.pose
                      ? `${bande.pose}${bande.direction ? ` · ${bande.direction}` : ""}`
                      : "brouillon"}
                  </span>
                  <span className="mesure ml-auto text-[10px] text-texte-3">
                    {bande.compte} images
                  </span>
                  <button
                    type="button"
                    onClick={() => void oublier(bande.identifiant)}
                    aria-label={`Effacer la bande ${bande.nom}`}
                    className="mesure text-[10px] text-texte-3 hover:text-signal"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-2 rounded-[2px] border border-bord bg-fond-2 p-3">
          <p className="text-[15px] text-texte">
            {dollars(montage.prix.par_bande)}
          </p>
          <p className="mesure text-[10px] leading-4 text-texte-3">
            par animation gardée — le clip a coûté {dollars(montage.prix.clip)}, et{" "}
            {montage.prix.bandes === 0
              ? "aucune bande n'en est encore sortie"
              : montage.prix.bandes === 1
                ? "une bande en est sortie"
                : `${montage.prix.bandes} bandes en sont sorties`}
            . Une de plus ferait tomber ce prix à{" "}
            {dollars(montage.prix.si_une_de_plus)}.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
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
        </div>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          <b className="text-texte-2">Rien sur cet écran ne dépense.</b> Le clip
          est payé. Découpez, recommencez, changez d'avis.
        </p>
      </aside>
    </div>
  )
}

// ── Les pièces de l'écran ───────────────────────────────────────────────────

function Boucle({
  titre,
  question,
  badge,
  children,
}: {
  titre: string
  question: string
  badge: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="mesure text-[10px] text-texte-2">{titre}</span>
        <b className="mesure text-[10px] font-normal text-texte-3">{question}</b>
      </div>
      <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-[2px] border border-bord bg-fond-1">
        {children}
        <span className="mesure absolute bottom-1 right-1 rounded-[2px] bg-fond-0/80 px-1 text-[9px] text-texte-3">
          {badge}
        </span>
      </div>
    </div>
  )
}

/** Une case de la planche de sprites, montrée à la loupe.
 *
 *  **La planche entière est chargée une fois et décalée**, plutôt qu'une image
 *  par cran : c'est la même image que l'export écrira, et l'animer en la
 *  décalant garantit qu'on regarde exactement ce qui sortira. */
function CaseDeLaPlanche({
  apercu,
  rang,
}: {
  apercu: ApercuDeBande | null
  rang: number
}) {
  if (!apercu || apercu.compte === 0) {
    return <span className="mesure text-[10px] text-texte-3">…</span>
  }
  // Le facteur d'agrandissement : la case emplit la vue sans jamais la dépasser,
  // et **au plus proche voisin** — un sprite lissé n'est plus un sprite.
  const facteur = Math.max(
    1,
    Math.floor(Math.min(200 / apercu.case_hauteur, 200 / apercu.case_largeur)),
  )
  return (
    <div
      data-case-de-la-planche
      style={{
        width: apercu.case_largeur * facteur,
        height: apercu.case_hauteur * facteur,
        backgroundImage: `url(${apercu.planche})`,
        backgroundSize: `${apercu.largeur * facteur}px ${apercu.hauteur * facteur}px`,
        backgroundPosition: `-${rang * apercu.case_largeur * facteur}px 0`,
        imageRendering: "pixelated",
      }}
    />
  )
}

/** Le cadre qu'on reprend à la main, **posé sur le sujet lui-même**.
 *
 *  ## Ce que le rectangle veut dire, et pourquoi ça change
 *
 *  Le cadre a **deux régimes**, et c'est la recette qui décide lequel :
 *
 *  - **Quand elle recadre** — le cas courant, celui du jeu —, chaque image est
 *    déjà recoupée sur sa propre silhouette avant d'arriver ici. Le cadre n'est
 *    alors plus une position, c'est **une taille** : la boîte dans laquelle
 *    toutes les images du clip se posent, au centre et sur leurs pieds. Élargir
 *    la boîte ne déplace pas le personnage, ça lui laisse de la place.
 *  - **Quand elle ne recadre pas** — un décor, une image entrée telle quelle —,
 *    le cadre est un vrai rectangle dans les coordonnées de l'image, et le
 *    déplacer déplace ce qu'on garde.
 *
 *  **Le même geste sert les deux**, et c'est voulu : quatre bords qu'on tire.
 *  Ce qui change entre les deux régimes est ce que l'écran montre du résultat,
 *  et il le montre pour de vrai — le sujet est posé dans la boîte par la même
 *  règle que la chaîne, `ancrage` compris, lue au serveur et non réécrite ici.
 *
 *  ## Pourquoi le sujet est en main plutôt que redemandé
 *
 *  Le rectangle **suit la souris**, donc il se redessine à chaque pixel. Une
 *  demande au serveur par pixel de glissement rendrait le geste impossible ;
 *  l'aperçu pixelisé, lui, ne se refait qu'au relâchement — c'est le seul moment
 *  où il change de rien à quelque chose. */
function CadreALaMain({
  sujet,
  sujetLargeur,
  sujetHauteur,
  ancrage,
  cadre,
  onPoser,
}: {
  sujet: string | null
  sujetLargeur: number
  sujetHauteur: number
  ancrage: string
  cadre: { gauche: number; sommet: number; droite: number; bas: number }
  onPoser: (cadre: {
    gauche: number
    sommet: number
    droite: number
    bas: number
  }) => void
}) {
  /** Ce qu'on tire pendant qu'on le tire. **Le vrai cadre ne bouge qu'au
   *  relâchement** : c'est lui qui relance l'aperçu pixelisé, et le relancer à
   *  chaque pixel enverrait une demande par pixel. */
  const [brouillon, setBrouillon] = useState<typeof cadre | null>(null)

  const vu = brouillon ?? cadre
  const largeur = Math.max(1, vu.droite - vu.gauche + 1)
  const hauteur = Math.max(1, vu.bas - vu.sommet + 1)

  // **L'échelle est celle du sujet, pas celle de la boîte.** Le personnage garde
  // sa taille à l'écran pendant qu'on tire, et c'est la boîte qu'on voit grandir
  // autour de lui — ce qui se passe vraiment.
  const facteur = Math.min(
    4,
    Math.max(0.25, sujetHauteur > 0 ? APPUI / sujetHauteur : 1),
  )

  /** **Les écouteurs se posent dans le geste, pas dans un effet.**
   *
   *  Mesuré au navigateur le 4 septembre 2026 : un `useEffect` déclenché par un
   *  état posé au `mousedown` s'exécute **après** le rendu, et un glissement
   *  rapide a le temps d'envoyer son `mousemove` et son `mouseup` avant.
   *  Le geste ne faisait alors rien du tout, sans la moindre erreur nulle part.
   *  Un humain lent ne s'en apercevrait pas ; un coup sec, si — et c'est
   *  précisément le geste de quelqu'un qui refait un cadrage pour la dixième
   *  fois.
   *
   *  `stopPropagation` pour la seconde moitié de la même mesure : sans lui, le
   *  `mousedown` d'un bord remonte au rectangle, qui l'entend comme *déplacer*.
   *  Tirer un bord **déplaçait** la boîte au lieu de la redimensionner. */
  const prendre = (bord: Bord) => (evenement: React.MouseEvent) => {
    evenement.preventDefault()
    evenement.stopPropagation()
    const origine = { x: evenement.clientX, y: evenement.clientY, cadre: vu }
    setBrouillon(vu)
    const bouge = (glissement: MouseEvent) => {
      const dx = Math.round((glissement.clientX - origine.x) / facteur)
      const dy = Math.round((glissement.clientY - origine.y) / facteur)
      setBrouillon(pousser(origine.cadre, bord, dx, dy))
    }
    const lache = () => {
      window.removeEventListener("mousemove", bouge)
      window.removeEventListener("mouseup", lache)
      // **Le vrai cadre ne change qu'ici**, au relâchement : c'est lui qui
      // relance l'aperçu pixelisé, et le relancer à chaque pixel enverrait une
      // demande par pixel.
      setBrouillon((pose) => {
        if (pose) onPoser(pose)
        return null
      })
    }
    window.addEventListener("mousemove", bouge)
    window.addEventListener("mouseup", lache)
  }

  // Le sujet dans sa boîte, **par la règle de la chaîne** : au centre, et sur
  // ses pieds sauf si la grille du jeu ancre au milieu.
  const x = Math.max(0, Math.floor((largeur - sujetLargeur) / 2))
  const y =
    ancrage === "centre"
      ? Math.max(0, Math.floor((hauteur - sujetHauteur) / 2))
      : Math.max(0, hauteur - sujetHauteur)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        data-cadre-a-la-main
        className="flex items-center justify-center overflow-hidden rounded-[2px] border border-bord bg-fond-1 p-2"
        style={{ height: APPUI + 40 }}
      >
        <div
          className="relative cursor-move"
          onMouseDown={prendre("tout")}
          style={{
            width: largeur * facteur,
            height: hauteur * facteur,
            outline: "1px solid var(--color-signal)",
            background: "var(--color-fond-0)",
          }}
        >
          {sujet && (
            <span
              className="absolute block"
              style={{
                left: x * facteur,
                top: y * facteur,
                width: sujetLargeur * facteur,
                height: sujetHauteur * facteur,
                backgroundImage: `url(${sujet})`,
                backgroundSize: "100% 100%",
                imageRendering: "pixelated",
              }}
            />
          )}
          {BORDS.map(([bord, classe]) => (
            <span
              key={bord}
              data-bord={bord}
              onMouseDown={prendre(bord)}
              className={`absolute bg-signal/50 hover:bg-signal ${classe}`}
            />
          ))}
        </div>
      </div>
      {/* Les mêmes deux nombres, au clavier. Le geste se répète trois fois par
          clip, et une boîte qui ne se règle qu'à la souris n'est réglable que
          par ceux qui en ont une. */}
      <Curseur
        libelle="Largeur du cadre"
        valeur={largeur}
        min={8}
        max={512}
        pas={1}
        unite=" px"
        onChange={(v) => onPoser({ ...cadre, droite: cadre.gauche + v - 1 })}
      />
      <Curseur
        libelle="Hauteur du cadre"
        valeur={hauteur}
        min={8}
        max={512}
        pas={1}
        unite=" px"
        onChange={(v) => onPoser({ ...cadre, bas: cadre.sommet + v - 1 })}
      />
    </div>
  )
}

/** La hauteur à laquelle le sujet est montré sous le cadre. Assez pour viser un
 *  bord, assez peu pour que le panneau ne devienne pas l'écran. */
const APPUI = 110

type Bord = "tout" | "gauche" | "sommet" | "droite" | "bas"

const BORDS: readonly (readonly [Bord, string])[] = [
  ["gauche", "inset-y-0 -left-1 w-2 cursor-ew-resize"],
  ["droite", "inset-y-0 -right-1 w-2 cursor-ew-resize"],
  ["sommet", "inset-x-0 -top-1 h-2 cursor-ns-resize"],
  ["bas", "inset-x-0 -bottom-1 h-2 cursor-ns-resize"],
] as const

/** Le cadre déplacé d'un bord, **jamais retourné ni plus petit que huit
 *  pixels**. Une boîte de zéro pixel ferait un aperçu vide, et l'auteur
 *  chercherait la panne ailleurs. */
function pousser(
  cadre: { gauche: number; sommet: number; droite: number; bas: number },
  bord: Bord,
  dx: number,
  dy: number,
) {
  const MIN = 8
  if (bord === "tout") {
    return {
      gauche: cadre.gauche + dx,
      droite: cadre.droite + dx,
      sommet: cadre.sommet + dy,
      bas: cadre.bas + dy,
    }
  }
  if (bord === "gauche") {
    return { ...cadre, gauche: Math.min(cadre.gauche + dx, cadre.droite - MIN + 1) }
  }
  if (bord === "droite") {
    return { ...cadre, droite: Math.max(cadre.droite + dx, cadre.gauche + MIN - 1) }
  }
  if (bord === "sommet") {
    return { ...cadre, sommet: Math.min(cadre.sommet + dy, cadre.bas - MIN + 1) }
  }
  return { ...cadre, bas: Math.max(cadre.bas + dy, cadre.sommet + MIN - 1) }
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
        className="relative flex select-none overflow-hidden rounded-[2px] border border-bord bg-fond-1"
        style={{ height: RUBAN }}
      >
        {Array.from({ length: images }, (_, numero) => {
          const colonne = numero % contact.colonnes
          const ligne = Math.floor(numero / contact.colonnes)
          const prise = retenues.includes(numero)
          const misee = prelevees.includes(numero)
          return (
            <button
              key={numero}
              type="button"
              aria-label={`Image ${numero}${prise ? " — retenue" : ""}${
                misee ? " — mise de côté" : ""
              }`}
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
              className="shrink-0 border-r border-fond-0/40 last:border-r-0"
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
          className="pointer-events-none absolute inset-y-0 w-px bg-texte"
          style={{ left: `${((curseur + 0.5) / images) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="mesure text-[10px] text-texte-3">image 0</span>
        <span className="mesure text-[10px] text-texte-2">
          {retenues.length} {retenues.length > 1 ? "images retenues" : "image retenue"}
        </span>
        <span className="mesure text-[10px] text-texte-3">image {images - 1}</span>
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
          className="shrink-0 rounded-[2px] border border-bord-fort"
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
          <span className="mesure text-[10px] text-texte-3">image {regarde}</span>

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
            className="mesure w-fit px-1 text-[10px] text-signal hover:text-signal-clair"
          >
            Mettre de côté ›
          </button>

          {/* **Ce qui vient d'arriver, en une phrase.** Un bandeau à chasser
              rendrait long un geste qui se répète ; et le doublon n'est pas un
              refus — le produit signale ce dont il est certain, les mêmes octets
              deux fois, et l'auteur décide. */}
          {misDeCote && (
            <span className="mesure text-[9.5px] leading-4 text-texte-3">
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
      className="rounded-[2px] border border-bord bg-fond-2 px-3 py-2 text-left hover:bg-fond-3"
    >
      <span className="mesure block text-[9.5px] uppercase tracking-wide text-texte-3">
        l'atelier a remarqué
      </span>
      <span className="text-[11px] text-texte">{proposition.mot}</span>
    </button>
  )
}

/** Les images retenues, **dans l'ordre et au format de la bande**.
 *
 *  Elles viennent de la planche, donc de ce qui sortira : ce ne sont pas des
 *  vignettes du clip, ce sont les cases elles-mêmes. */
function Retenues({
  apercu,
  retenues,
  rang,
  onRetirer,
}: {
  apercu: ApercuDeBande | null
  retenues: number[]
  rang: number
  onRetirer: (numero: number) => void
}) {
  if (retenues.length === 0) {
    return (
      <p className="mesure rounded-[2px] border border-dashed border-bord p-3 text-[10px] text-texte-3">
        aucune image retenue — cliquez la pellicule, ou posez une des deux
        propositions
      </p>
    )
  }
  const facteur = apercu ? Math.max(1, Math.floor(56 / apercu.case_hauteur)) : 1
  return (
    <div className="flex flex-wrap gap-1.5">
      {retenues.map((numero, place) => (
        <button
          key={numero}
          type="button"
          onClick={() => onRetirer(numero)}
          title={`Image ${numero} — un clic la retire`}
          aria-label={`Retirer l'image ${numero}`}
          className="rounded-[2px] border p-0.5"
          style={{
            // Même correction qu'à la pellicule, et elle coûtait plus cher
            // ici : c'est ce liseré qui dit **quelle image retenue passe en ce
            // moment** dans la boucle, et il ne s'était jamais allumé.
            borderColor:
              place === rang ? "var(--color-signal)" : "var(--color-bord)",
            background: "var(--color-fond-1)",
          }}
        >
          {apercu && apercu.compte > place ? (
            <span
              className="block"
              style={{
                width: apercu.case_largeur * facteur,
                height: apercu.case_hauteur * facteur,
                backgroundImage: `url(${apercu.planche})`,
                backgroundSize: `${apercu.largeur * facteur}px ${
                  apercu.hauteur * facteur
                }px`,
                backgroundPosition: `-${place * apercu.case_largeur * facteur}px 0`,
                imageRendering: "pixelated",
              }}
            />
          ) : (
            <span className="mesure block px-2 py-4 text-[10px] text-texte-3">
              {numero}
            </span>
          )}
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
