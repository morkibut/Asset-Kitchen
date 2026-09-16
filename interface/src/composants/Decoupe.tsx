// L'écran Découpe — une planche multi-sprites, et les rectangles qui en sortiront.
//
// **Une fabrique, posée dans la retouche.** Elle ne règle pas l'image ouverte :
// elle en écrit d'autres, et `Retouche.tsx` lui réserve tout le cadre de travail
// dès qu'on choisit sa table — la règle de `B24`. On dessine des rectangles sur
// une image de mille pixels, et la colonne de droite en fait 380, la largeur de
// réglages du produit (`docs/DESIGN.md` § Layout).
//
// **Sa fente de refus est celle du châssis**, passée par `onFente`.
//
// **La détection ne décide de rien.** Elle propose ; l'auteur ajoute, retire,
// redessine, et ce qui part est sa liste. C'est cette séparation, et rien
// d'autre, qui tient « sans jamais bloquer » (US-73).
//
// ── Deux portes d'entrée depuis le 1ᵉʳ septembre 2026 ────────────────────────
//
// **Cet écran s'ouvre aussi sur une carte du tableau d'inspiration**, et ce qui
// en sort est alors des cartes. La demande de l'auteur était précise :
// *j'importe un artwork qui contient trois personnages sur un fond, je veux en
// faire trois*.
//
// **Ce qui traverse la frontière des deux familles d'images est l'outil, jamais
// l'image.** Un morceau de carte est une carte : il ne s'exporte pas, ne compte
// pas dans la bibliothèque, et n'a ni recette ni rendu. C'est pour ça que le
// sujet est une **union nommée** et non un objet flou — le type dit laquelle
// des deux familles on découpe, et ce que le geste rendra.
//
// **Passé au papier en `C8`.** Montée depuis `Retouche.tsx`, qui est déjà du
// carnet ; c'est ce fichier-ci qui ne l'était pas encore.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  api,
  Refus,
  type Asset,
  type Bande,
  type Boite,
  type Carte,
  type Decoupable,
  type Direction,
  type LectureDePalette,
  type ModeDecoupe,
  type Production,
} from "../api"
import type { Fente } from "./EnTeteDeSurface"
import { PANNEAU } from "./Infobulle"
import { SurfaceZoomable } from "./SurfaceZoomable"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"

/** En dessous, un rectangle est un clic qui a glissé, pas une intention. En
 *  pixels de la planche — la même unité que tout le reste de cet écran. */
const COTE_UTILE = 4

/** En dessous, un côté réglé au clavier ou tiré par son coin ne désigne plus
 *  rien de découpable — la même borne que le serveur (`ServiceDecoupe.
 *  COTE_UTILE`), pour ne jamais proposer une taille qu'il refuserait. */
const COTE_MIN_REGLE = 2

/** **Une zone, pas un rectangle brut.** Le rectangle est ce que le serveur
 *  découpe ; `nom` et `garder` n'existent que sur cet écran — l'auteur les
 *  règle avant d'envoyer, ils ne voyagent que dans la liste qu'il a validée
 *  (`decouper`/`decouperCarte` prennent `noms`, alignés aux boîtes gardées).
 *  Un nom vide laisse le serveur reprendre son libellé numéroté. */
type Zone = { boite: Boite; nom: string; garder: boolean }

const zonesDepuis = (boites: Boite[]): Zone[] =>
  boites.map((boite) => ({ boite, nom: "", garder: true }))

const LIBELLES: Partial<Record<string, string>> = {
  auto: "zones opaques",
  grille: "grille fixe",
  gouttieres: "les gouttières",
}

/** Au-delà, l'écran annonce ce que la détection a coûté (`B18`) — jamais
 *  avant, pour ne pas alarmer sur ce qui se sent à peine. */
const SEUIL_LENT_MS = 240

/**
 * Ce qu'on découpe — **et les deux familles d'images y sont nommées, jamais
 * confondues**.
 *
 * Le rappel de fin vit dans l'union plutôt qu'à côté, parce que les deux
 * familles ne rendent pas la même chose : une planche rend des assets qu'on
 * ouvre tout de suite dans leur fiche, une carte rend des cartes qui arrivent
 * dans la réserve.
 */
export type SujetDecoupe =
  | {
      famille: "planche"
      planche: Asset
      /** Ce que la découpe a produit — fermer sur la première découpe, ouverte
       *  dans sa fiche. */
      onDecoupe: (decoupes: Asset[]) => void
      /** **La seconde sortie de l'écran** (`AU19`) : les mêmes rectangles, mais
       *  les cases deviennent les images d'une animation au lieu de douze
       *  images séparées. Absente, le bouton ne paraît pas — une carte ne
       *  s'anime pas. */
      onAnimer?: (bandes: Bande[]) => void
    }
  | {
      famille: "carte"
      carte: Carte
      /** Les morceaux, qui arrivent dans la réserve. Rien à ouvrir : ils ne
       *  sont pas promus, et promouvoir reste un geste. */
      onDecoupe: (morceaux: Carte[]) => void
      /** **La seconde sortie de l'écran, ici aussi** (`RP21`) : les mêmes
       *  rectangles, sur une carte plutôt que sur une planche de la
       *  bibliothèque. Absente, le bouton ne paraît pas — même règle que côté
       *  planche. */
      onAnimer?: (bandes: Bande[]) => void
    }

export function EcranDecoupe({
  sujet,
  onFermer,
  onFente,
}: {
  sujet: SujetDecoupe
  /** Remonter d'un étage — la touche Échap, et le fil d'Ariane du châssis. */
  onFermer: () => void
  onFente: (fente: Fente) => void
}) {
  const [mode, setMode] = useState<ModeDecoupe>("auto")
  const [coteMin, setCoteMin] = useState(16)
  const [colonnes, setColonnes] = useState(4)
  const [lignes, setLignes] = useState(2)
  /** **Décochée par défaut, et c'est la moitié de la décision.** C'est le seul
   *  endroit du produit où découper efface quelque chose ; un défaut à vrai en
   *  ferait le comportement ordinaire. */
  const [remplacer, setRemplacer] = useState(false)

  /** Ce que la palette lit de cette carte, et l'image qui le montre. */
  const [lecture, setLecture] = useState<LectureDePalette | null>(null)
  const [magenta, setMagenta] = useState(false)

  const [zones, setZones] = useState<Zone[]>([])
  const [detectee, setDetectee] = useState<Decoupable | null>(null)
  const [choisie, setChoisie] = useState<number | null>(null)
  const setRefus = (texte: string) => onFente(texte ? { ton: "echec", texte } : null)
  const [enCours, setEnCours] = useState(false)
  /** **Le dernier geste se défait.** Une pile d'états entiers, plutôt qu'un
   *  journal d'actions : plus simple, et c'est toujours l'état d'avant le
   *  dernier tracé, ajout, retrait, déplacement ou redimensionnement qui
   *  revient — jamais un geste plus ancien. Bornée pour ne pas grossir sans
   *  fin sur une longue séance de réglage. */
  const [historique, setHistorique] = useState<Zone[][]>([])
  const memoriser = () => setHistorique((h) => [...h.slice(-19), zones])
  const annulerLeDernierReglage = () => {
    if (historique.length === 0) return
    setZones(historique[historique.length - 1])
    setHistorique((h) => h.slice(0, -1))
    setChoisie(null)
  }
  /** Une session d'édition continue (un champ qu'on tape) ne mémorise qu'une
   *  fois, à la prise de focus — sans quoi chaque frappe mangerait un cran
   *  d'annulation. */
  const sessionEdition = useRef<string | null>(null)
  const commencerEdition = (cle: string) => {
    if (sessionEdition.current === cle) return
    sessionEdition.current = cle
    memoriser()
  }
  /** Ce qui part réellement : une zone écartée ne sort ni en image, ni en
   *  animation. C'est la même liste, filtrée une fois. */
  const gardees = zones.filter((z) => z.garder)
  const [relecture, setRelecture] = useState(false)

  /** L'image à découper, ses mesures et son nom — quelle que soit sa famille.
   *
   *  **L'image est la brute, jamais un rendu.** Une carte n'a pas de rendu du
   *  tout : son image *est* ce qu'on découpera. */
  const vu =
    sujet.famille === "planche"
      ? {
          identifiant: sujet.planche.identifiant,
          largeur: sujet.planche.largeur,
          hauteur: sujet.planche.hauteur,
          alt: sujet.planche.label,
          image: api.rendu(sujet.planche.identifiant, sujet.planche.empreinte, true),
          quoi: "asset",
        }
      : {
          identifiant: sujet.carte.identifiant,
          largeur: sujet.carte.largeur,
          hauteur: sujet.carte.hauteur,
          alt: sujet.carte.note || "la carte",
          image: api.imageCarte(sujet.carte.identifiant, sujet.carte.empreinte),
          quoi: "carte",
        }

  // ── Ce que l'auteur fait à une zone ─────────────────────────────────────────
  //
  // Six gestes, et chacun mémorise avant de changer la liste — c'est ce qui
  // rend « le dernier geste se défait » vrai pour n'importe lequel des six.

  const ajouterZone = (boite: Boite) => {
    memoriser()
    setZones((z) => [...z, { boite, nom: "", garder: true }])
    setChoisie(zones.length)
  }
  const retirerZone = (rang: number) => {
    memoriser()
    setZones((z) => z.filter((_, i) => i !== rang))
    setChoisie(null)
  }
  const deplacerZone = (rang: number, boite: Boite) => {
    setZones((z) => z.map((zone, i) => (i === rang ? { ...zone, boite } : zone)))
  }
  const redimensionnerZone = (rang: number, boite: Boite) => {
    setZones((z) => z.map((zone, i) => (i === rang ? { ...zone, boite } : zone)))
  }
  const renommerZone = (rang: number, nom: string) => {
    setZones((z) => z.map((zone, i) => (i === rang ? { ...zone, nom } : zone)))
  }
  const basculerGarder = (rang: number) => {
    memoriser()
    setZones((z) => z.map((zone, i) => (i === rang ? { ...zone, garder: !zone.garder } : zone)))
  }
  const reglerCoordonnee = (rang: number, champ: "x" | "y" | "largeur" | "hauteur", valeur: number) => {
    setZones((z) => z.map((zone, i) => {
      if (i !== rang) return zone
      const [x0, y0, x1, y1] = zone.boite
      const largeurZone = x1 - x0 + 1
      const hauteurZone = y1 - y0 + 1
      let boite: Boite
      if (champ === "x") {
        const nx0 = Math.max(0, Math.min(vu.largeur - largeurZone, Math.round(valeur)))
        boite = [nx0, y0, nx0 + largeurZone - 1, y1]
      } else if (champ === "y") {
        const ny0 = Math.max(0, Math.min(vu.hauteur - hauteurZone, Math.round(valeur)))
        boite = [x0, ny0, x1, ny0 + hauteurZone - 1]
      } else if (champ === "largeur") {
        const nl = Math.max(COTE_MIN_REGLE, Math.min(vu.largeur - x0, Math.round(valeur)))
        boite = [x0, y0, x0 + nl - 1, y1]
      } else {
        const nh = Math.max(COTE_MIN_REGLE, Math.min(vu.hauteur - y0, Math.round(valeur)))
        boite = [x0, y0, x1, y0 + nh - 1]
      }
      return { ...zone, boite }
    }))
  }

  const etatDecoupe = { mode, coteMin, colonnes, lignes, remplacer, zones }
  const [origineDecoupe, setOrigineDecoupe] = useState<{ id: string; etat: typeof etatDecoupe } | null>(null)
  const revisionProposition = useRef(0)
  const propositionAignorer = useRef<string | null>(null)
  const brouillon = useBrouillonLocal({
    cle: `decoupe:${vu.quoi}:${vu.identifiant}`, pret: origineDecoupe?.id === vu.identifiant,
    reference: origineDecoupe?.etat ?? etatDecoupe, etat: etatDecoupe,
    ecran: "La découpe", quoi: vu.alt || vu.identifiant,
    appliquer: (recu) => {
      revisionProposition.current += 1
      propositionAignorer.current = JSON.stringify([vu.identifiant, recu.mode, recu.colonnes, recu.lignes, recu.coteMin])
      // Un brouillon plus ancien portait des rectangles nus, sans nom ni case
      // « garder » : relu ici, jamais perdu pour autant.
      const zonesRecues: Zone[] = Array.isArray((recu as { zones?: Zone[] }).zones)
        ? (recu as { zones: Zone[] }).zones
        : zonesDepuis((recu as unknown as { boites: Boite[] }).boites ?? [])
      setMode(recu.mode); setCoteMin(recu.coteMin); setColonnes(recu.colonnes); setLignes(recu.lignes)
      setRemplacer(recu.remplacer); setZones(zonesRecues); setChoisie(null); setHistorique([])
    },
  })

  // ── La proposition ────────────────────────────────────────────────────────
  //
  // Elle se redemande à chaque cran de réglage, et **elle remplace la liste** :
  // c'est ce qu'un changement de mode veut dire.
  const famille = sujet.famille
  const proposer = useCallback(async () => {
    const revision = ++revisionProposition.current
    const reglage = { mode, colonnes, lignes, cote_min: coteMin }
    try {
      const propose =
        famille === "planche"
          ? await api.decoupeProposee(vu.identifiant, reglage)
          : await api.decoupeDeCarteProposee(vu.identifiant, reglage)
      if (revision !== revisionProposition.current) return
      setDetectee(propose)
      const zonesProposees = zonesDepuis(propose.boites)
      setOrigineDecoupe((avant) => avant?.id === vu.identifiant ? avant : { id: vu.identifiant, etat: { mode, coteMin, colonnes, lignes, remplacer, zones: zonesProposees } })
      setZones(zonesProposees)
      setChoisie(null)
      setHistorique([])
      setRefus("")
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "découpe illisible")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famille, vu.identifiant, mode, colonnes, lignes, coteMin])

  useEffect(() => {
    const signature = JSON.stringify([vu.identifiant, mode, colonnes, lignes, coteMin])
    if (propositionAignorer.current === signature) return
    propositionAignorer.current = null
    void proposer()
    return () => { revisionProposition.current += 1 }
  }, [proposer])

  // ── Découper ──────────────────────────────────────────────────────────────
  //
  // **Ce qui part est ce que la relecture vient de montrer** : les zones
  // gardées, dans leur ordre, avec le nom que l'auteur leur a donné — un nom
  // vide laisse le serveur reprendre son libellé numéroté (`docs/DESIGN.md`
  // « l'auteur déclare, l'application enregistre »).

  const decouper = async () => {
    const boitesEnvoyees = gardees.map((z) => z.boite)
    const noms = gardees.map((z) => z.nom.trim() || null)
    const unNomEcrit = noms.some((n) => n !== null)
    setEnCours(true)
    try {
      if (sujet.famille === "planche") {
        const fait = unNomEcrit
          ? await api.decouper(vu.identifiant, boitesEnvoyees, noms)
          : await api.decouper(vu.identifiant, boitesEnvoyees)
        brouillon.effacer()
        setRelecture(false)
        sujet.onDecoupe(fait.decoupes)
      } else {
        const fait = unNomEcrit
          ? await api.decouperCarte(vu.identifiant, boitesEnvoyees, remplacer, noms)
          : await api.decouperCarte(vu.identifiant, boitesEnvoyees, remplacer)
        brouillon.effacer()
        setRelecture(false)
        sujet.onDecoupe(fait.morceaux)
      }
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "découpe refusée")
    } finally {
      setEnCours(false)
    }
  }

  // ── En faire une animation ────────────────────────────────────────────────
  //
  // **La seconde sortie, et elle part des mêmes rectangles** (`AU19`). Ce qui
  // change est ce qu'ils deviennent : les images d'une animation, dans l'ordre
  // où on les voit, au lieu de douze images séparées dans la galerie.
  //
  // ⚠️ **Elle demande le sujet et le mouvement depuis `AU20`, et c'est une
  // décision retournée.** `AU19` avait tranché l'inverse — *on garde d'abord,
  // on range ensuite*, la question posée plus tard dans l'atelier de
  // l'animation — au motif que demander ici alourdirait le geste. Mesuré à
  // l'usage le 13 septembre 2026 : ce qui n'est rangé nulle part **n'est nulle
  // part**. Une planche découpée sur la fiche d'un personnage rendait une
  // animation sans personnage, que la fiche ne montrait donc pas, et l'auteur
  // la voyait disparaître au moment même où il venait de la faire.
  //
  // Le geste reste léger parce que la réponse est **déjà remplie** : la feuille
  // porte son sujet et sa case quand elle est entrée par une fiche, et les deux
  // listes ne font que le montrer. On les change, ou on répond « à ranger plus
  // tard » — mais on ne le fait plus sans le savoir.
  //
  // **Les directions sont demandées ici, et à personne d'autre.** Elles ne
  // vivent ni dans l'univers ni dans le plan de poses, et les faire descendre
  // depuis le châssis aurait traversé trois écrans pour une case à cocher.
  const [directionsDuJeu, setDirectionsDuJeu] = useState<Direction[]>([])
  /** **La même condition pour les deux familles** (`RP21`) : une carte de la
   *  toile offre *Animer* aux mêmes conditions qu'une planche de la
   *  bibliothèque — c'est `onAnimer` qui porte la décision, jamais la
   *  famille du sujet. */
  const animable = Boolean(sujet.onAnimer)
  useEffect(() => {
    if (!animable) return
    let vivant = true
    void api
      .directions()
      .then((lues) => vivant && setDirectionsDuJeu(lues.directions))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [animable])
  /** **À qui l'animation appartiendra, et sur quel mouvement** (`AU20`).
   *
   *  Le défaut vient de la feuille elle-même : découper la planche d'un
   *  personnage rend l'animation de ce personnage-là, ce qui est vrai neuf fois
   *  sur dix et se corrige d'un clic la dixième. Le serveur tient la même règle
   *  pour l'agent (`ServicePlancheAnimee.animer`) ; ces deux listes ne font que
   *  la rendre visible — et modifiable — avant qu'on clique. */
  const planche = sujet.famille === "planche" ? sujet.planche : null
  const [production, setProduction] = useState<Production | null>(null)
  const [sujetVise, setSujetVise] = useState(planche?.personnage ?? "")
  const [poseVisee, setPoseVisee] = useState(planche?.pose ?? "")
  useEffect(() => {
    if (!animable) return
    let vivant = true
    void api
      .production()
      .then((lue) => vivant && setProduction(lue))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [animable])
  const personnageVise = production?.personnages.find((p) => p.identifiant === sujetVise) ?? null
  /** Les mouvements que ce sujet-là tient — jamais tout le plan du jeu : une
   *  case qu'il a écartée n'est pas une case où quelque chose peut se ranger. */
  const posesDuSujet =
    personnageVise && production
      ? production.plan.filter((p) => personnageVise.cases.some((c) => c.pose === p.identifiant))
      : []
  // Changer de sujet rend la case caduque : la pose d'un personnage n'est pas
  // celle d'un autre, et la garder rangerait l'animation dans une case que le
  // nouveau sujet ne tient peut-être pas.
  useEffect(() => {
    if (poseVisee && !posesDuSujet.some((p) => p.identifiant === poseVisee)) setPoseVisee("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujetVise, production])

  /** Proposée seulement quand la grille a exactement autant de lignes que le
   *  jeu a de directions : c'est la feuille à quatre directions, et hors de ce
   *  cas le partage serait une supposition. */
  const parLignePossible =
    mode === "grille" && lignes > 1 && directionsDuJeu.length === lignes
  const [parLigne, setParLigne] = useState(false)
  useEffect(() => {
    if (!parLignePossible) setParLigne(false)
  }, [parLignePossible])

  const animer = async () => {
    if (!sujet.onAnimer) return
    const onAnimer = sujet.onAnimer
    setEnCours(true)
    try {
      const source =
        sujet.famille === "planche"
          ? { feuille: vu.identifiant }
          : { carte: vu.identifiant, projet: sujet.carte.projet }
      const fait = await api.animerUneFeuille(source, gardees.map((z) => z.boite), {
        nom: vu.alt,
        directions: parLigne ? directionsDuJeu.map((d) => d.identifiant) : null,
        // **La chaîne vide dit « aucun », et ce n'est pas la même chose que
        // l'absence** : sans réponse, le serveur reprend le sujet de la
        // feuille, ce qui est justement ce qu'on vient de laisser l'auteur
        // corriger. Ce qui est affiché est donc ce qui part.
        personnage: sujetVise,
        pose: sujetVise ? poseVisee : "",
      })
      brouillon.effacer()
      onAnimer(fait.bandes)
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "animation refusée")
    } finally {
      setEnCours(false)
    }
  }

  // La touche Suppr retire le rectangle choisi. Échap referme d'abord la
  // relecture si elle est ouverte — c'est elle que l'auteur regarde alors,
  // pas l'écran entier.
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") {
        if (relecture) { setRelecture(false); return }
        return onFermer()
      }
      if (choisie === null) return
      if (evenement.key !== "Delete" && evenement.key !== "Backspace") return
      retirerZone(choisie)
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choisie, onFermer, relecture, zones])

  // **Demandée d'entrée, et une seule fois.** Ne concerne que les cartes.
  const carte = sujet.famille === "carte" ? sujet.carte : null
  useEffect(() => {
    if (!carte) return
    let vivant = true
    void api
      .lectureDePalette(carte.identifiant)
      .then((lu) => vivant && setLecture(lu))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [carte?.identifiant])

  const corrigee = detectee !== null && !memesBoites(zones.map((z) => z.boite), detectee.boites)

  return (
    <div data-decoupe className="flex min-h-0 flex-1 flex-col bg-papier">
      <AvisBrouillon brouillon={brouillon} />
      <div className="flex min-h-0 flex-1">
        <Planche
          vu={
            magenta && carte
              ? { ...vu, image: api.apercuDeLaLecture(carte.identifiant, carte.empreinte) }
              : vu
          }
          zones={zones}
          choisie={choisie}
          onChoisir={setChoisie}
          onDessiner={ajouterZone}
          onDeplacer={deplacerZone}
          onRedimensionner={redimensionnerZone}
          onDebutGeste={memoriser}
        />

        <aside
          {...PANNEAU}
          className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-trait bg-papier-cote"
        >
          <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
            Ce qui sortira
            <span className="ml-auto normal-case tracking-normal">
              {vu.largeur}×{vu.hauteur}
            </span>
          </div>

          <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[8px]">
            {/* **La réponse à la question qui amène ici.** Une planche trouvée
                porte trois personnages sur un fond ; on vient la couper en
                croyant que c'est le fond qui salit la palette. Ce ne sont pas
                le fond — il est déjà écarté. Ce sont les voisins. */}
            {lecture && (
              <div className="flex flex-col gap-[6px] border-b border-trait pb-[14px]">
                <p className="text-[11px] text-encre-2">Ce que la palette y lit</p>
                {lecture.entiere ? (
                  <p className="text-[11px] leading-snug text-encre-2">
                    Rien n'est mis de côté : l'image entière donne ses couleurs.
                    C'est ce qui arrive à une matière ou à une texture, qui n'ont
                    pas de fond.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] leading-snug text-encre-2">
                      <span className="mesure text-encre">{lecture.part} %</span>{" "}
                      de l'image {carte?.officiel ? "donne" : "donnerait"} ses
                      couleurs au jeu.{" "}
                      {lecture.part >= 100
                        ? "Rien n'en est écarté : le détourage n'a trouvé aucun fond à retirer."
                        : "Le reste — le fond — est écarté tout seul."}
                    </p>
                    {lecture.part < 100 && (
                      <button
                        type="button"
                        aria-pressed={magenta}
                        onClick={() => setMagenta(!magenta)}
                        className="flex items-start gap-[8px] text-left text-[11px] text-encre-2 hover:text-encre"
                      >
                        <Case cochee={magenta} />
                        <span>
                          me le montrer sur l'image
                          <span className="mesure block text-[10.5px] text-encre-4">
                            en magenta, ce qui ne compte pas
                          </span>
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-[4px]">
              <p className="text-[11px] text-encre-2">Détection</p>
              <Choix
                valeurs={["auto", "grille", "gouttieres"] as const}
                valeur={mode}
                onChange={setMode}
                libelles={LIBELLES}
              />
            </div>

            {mode === "auto" && (
              <Champ libelle="taille minimale">
                <Glissiere valeur={coteMin} min={0} max={128} unite=" px" onChange={setCoteMin} />
              </Champ>
            )}

            {mode === "grille" && (
              <>
                <Champ libelle="colonnes">
                  <Glissiere valeur={colonnes} min={1} max={16} onChange={setColonnes} />
                </Champ>
                <Champ libelle="lignes">
                  <Glissiere valeur={lignes} min={1} max={16} onChange={setLignes} />
                </Champ>
              </>
            )}

            {mode === "gouttieres" && (
              <p className="text-[11px] leading-snug text-encre-2">
                Cherche les rangées et les colonnes entièrement d'une seule
                couleur, et coupe là — rien à régler.
              </p>
            )}

            <Pourquoi texte={detectee?.raison ?? null} />

            {detectee && (detectee.duree_ms ?? 0) > SEUIL_LENT_MS && (
              <p className="mesure text-[10.5px] leading-4 text-encre-4">
                détection : {Math.round(detectee.duree_ms ?? 0)} ms
              </p>
            )}

            {/* Ce que la détection ne peut pas savoir se dit ici, avant qu'on
                s'en aperçoive : dessiner remplace la détection, changer de
                réglage remplace ce qu'on a dessiné. */}
            <p className="mesure flex items-start gap-[6px] text-[10.5px] leading-4 text-encre-4">
              <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
              <span>
                {corrigee
                  ? "corrigé à la main — changer un réglage relancera la détection"
                  : "glisse pour ajouter un rectangle ; glisse-le pour le déplacer, son coin bas-droit pour le redimensionner"}
              </span>
            </p>

            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => ajouterZone([0, 0, Math.min(63, vu.largeur - 1), Math.min(63, vu.hauteur - 1)])}
                className="h-[26px] rounded-7 border border-trait px-[8px] text-[12px] text-encre-2 transition-colors duration-120 hover:border-encre-4 hover:text-encre"
              >
                + Zone
              </button>
              <button
                type="button"
                disabled={historique.length === 0}
                onClick={annulerLeDernierReglage}
                className="h-[26px] rounded-7 border border-trait px-[8px] text-[12px] text-encre-3 transition-colors duration-120 hover:border-encre-4 hover:text-encre disabled:text-eteint"
              >
                Annuler le dernier réglage
              </button>
            </div>

            <ListeZones
              zones={zones}
              choisie={choisie}
              onChoisir={setChoisie}
              onRetirer={retirerZone}
              onRenommer={renommerZone}
              onCommencerEdition={(rang) => commencerEdition(`nom-${rang}`)}
              onBasculerGarder={basculerGarder}
            />

            {choisie !== null && zones[choisie] && (
              <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
                <p className="text-[11px] text-encre-2">Zone sélectionnée</p>
                <div className="grid grid-cols-2 gap-[8px]">
                  <ChampNombre
                    libelle="X" valeur={zones[choisie].boite[0]}
                    onFocus={() => commencerEdition(`x-${choisie}`)}
                    onChange={(v) => reglerCoordonnee(choisie, "x", v)}
                  />
                  <ChampNombre
                    libelle="Y" valeur={zones[choisie].boite[1]}
                    onFocus={() => commencerEdition(`y-${choisie}`)}
                    onChange={(v) => reglerCoordonnee(choisie, "y", v)}
                  />
                  <ChampNombre
                    libelle="Largeur" valeur={zones[choisie].boite[2] - zones[choisie].boite[0] + 1}
                    onFocus={() => commencerEdition(`largeur-${choisie}`)}
                    onChange={(v) => reglerCoordonnee(choisie, "largeur", v)}
                  />
                  <ChampNombre
                    libelle="Hauteur" valeur={zones[choisie].boite[3] - zones[choisie].boite[1] + 1}
                    onFocus={() => commencerEdition(`hauteur-${choisie}`)}
                    onChange={(v) => reglerCoordonnee(choisie, "hauteur", v)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => retirerZone(choisie)}
                  className="h-[26px] rounded-7 border border-trait px-[8px] text-[12px] text-encre-3 transition-colors duration-120 hover:border-echec hover:text-echec"
                >
                  Retirer cette zone
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[4px] border-t border-trait p-[8px]">
            {/* **Recadrer, c'est découper en un seul rectangle.** Proposée
                seulement quand il n'y a qu'un rectangle gardée : à plusieurs la
                question n'a pas de réponse. */}
            {sujet.famille === "carte" && gardees.length === 1 && (
              <button
                type="button"
                aria-pressed={remplacer}
                onClick={() => setRemplacer(!remplacer)}
                className="mb-[4px] flex items-start gap-[8px] text-left text-[11px] text-encre-2 hover:text-encre"
              >
                <Case cochee={remplacer} />
                <span>
                  ce morceau prend la place de l'originale
                  <span className="mesure block text-[10.5px] text-encre-4">
                    il hérite de sa promotion, sa famille, son groupe et sa place
                    — et l'originale s'en va
                  </span>
                </span>
              </button>
            )}
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                disabled={gardees.length === 0 || enCours}
                onClick={() => setRelecture(true)}
                className="h-[34px] rounded-7 border border-trait px-[14px] text-[13px] text-encre transition-colors duration-120 hover:bg-carte disabled:text-eteint"
              >
                {`Relire ${gardees.length} sortie${gardees.length > 1 ? "s" : ""}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (zones.length > 0) memoriser()
                  setZones([])
                  setChoisie(null)
                }}
                className="mesure ml-auto text-[10.5px] text-encre-3 hover:text-encre-2"
              >
                Tout retirer
              </button>
            </div>
            {zones.length === 0 && <Pourquoi texte="aucun rectangle — il n'y a rien à découper" />}
            {zones.length > 0 && gardees.length === 0 && (
              <Pourquoi texte="aucune zone gardée — coche « garder » sur au moins une" />
            )}
            {/* **La seconde sortie** (`AU19`, ouverte à une carte en `RP21`) :
                les mêmes rectangles, joués au lieu d'être rangés. Sous le
                bouton principal et non à côté — on découpe le plus souvent en
                images, et l'animation est le geste du jour où l'image en est
                une. */}
            {animable && (
              <div className="mt-[8px] flex flex-col gap-[4px] border-t border-trait pt-[8px]">
                {/* **À quoi elle se rattache, demandé avant de cliquer**
                    (`AU20`). Deux lignes, déjà remplies : ce n'est pas un
                    formulaire, c'est ce qui va se passer, écrit là où on le
                    lit. */}
                <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
                  Animation de
                  <select
                    value={sujetVise}
                    onChange={(e) => setSujetVise(e.target.value)}
                    className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
                  >
                    <option value="">Personne — elle ira dans la galerie du jeu</option>
                    {production?.personnages.map((p) => (
                      <option key={p.identifiant} value={p.identifiant}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </label>
                {sujetVise && (
                  <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
                    Mouvement
                    <select
                      value={poseVisee}
                      onChange={(e) => setPoseVisee(e.target.value)}
                      className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
                    >
                      <option value="">À ranger plus tard — elle attendra sur la fiche</option>
                      {posesDuSujet.map((p) => (
                        <option key={p.identifiant} value={p.identifiant}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {parLignePossible && (
                  <button
                    type="button"
                    aria-pressed={parLigne}
                    onClick={() => setParLigne(!parLigne)}
                    className="flex items-start gap-[8px] text-left text-[11px] text-encre-2 hover:text-encre"
                  >
                    <Case cochee={parLigne} />
                    <span>
                      une animation par ligne
                      <span className="mesure block text-[10.5px] text-encre-4">
                        {directionsDuJeu.map((d) => d.nom).join(", ")} — dans cet ordre,
                        de haut en bas
                      </span>
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={gardees.length === 0 || enCours}
                  onClick={() => void animer()}
                  className="h-[34px] rounded-7 border border-trait px-[14px] text-[13px] text-encre transition-colors duration-120 hover:bg-carte disabled:text-eteint"
                >
                  {enCours
                    ? "…"
                    : parLigne
                      ? `En faire ${lignes} animations`
                      : `En faire une animation de ${gardees.length} images`}
                </button>
                {gardees.length > 0 && (
                  <Pourquoi texte="les cases deviennent les images de l'animation, dans l'ordre où elles sont numérotées — son atelier s'ouvre ensuite pour la régler" />
                )}
              </div>
            )}
            {/* Ce que les morceaux deviennent, dit avant de cliquer. */}
            {sujet.famille === "carte" && gardees.length > 0 && !remplacer && (
              <Pourquoi texte="les morceaux arrivent dans la réserve, non promus — l'originale reste où elle est" />
            )}
          </div>
        </aside>
      </div>

      {relecture && (
        <FenetreRelecture
          zones={gardees}
          destination={
            sujet.famille === "carte"
              ? remplacer ? "remplace l'originale" : "la réserve"
              : "Images du sujet"
          }
          enCours={enCours}
          onFermer={() => setRelecture(false)}
          onConfirmer={() => void decouper()}
        />
      )}
    </div>
  )
}

// ── Le petit vocabulaire de cet écran ───────────────────────────────────────

/** Une case à cocher dessinée — le geste est porté par un bouton entier
 *  (`aria-pressed`), pas par le carré seul : la cible cliquable est toute la
 *  ligne, texte compris. */
function Case({ cochee }: { cochee: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "mt-[4px] block h-[14px] w-[14px] shrink-0 rounded-5 border",
        cochee ? "border-encre-4 bg-encre-4" : "border-encre-4 bg-transparent",
      ].join(" ")}
    />
  )
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <p className="text-[11px] text-encre-2">{libelle}</p>
      {children}
    </div>
  )
}

/** Une zone se règle au clavier — X, Y, Largeur, Hauteur, quatre champs
 *  identiques. `onFocus` ouvre une session d'annulation : les touches qui
 *  suivent, jusqu'au prochain champ, ne mémorisent qu'une fois. */
function ChampNombre({
  libelle, valeur, onFocus, onChange,
}: {
  libelle: string; valeur: number; onFocus: () => void; onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
      {libelle}
      <input
        type="number"
        value={valeur}
        onFocus={onFocus}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
      />
    </label>
  )
}

/** « Le grisé porte sa raison. » Une ligne sœur, mono 10,5 px, tiret de 8 px. */
function Pourquoi({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p className="mesure flex items-start gap-[6px] text-[10.5px] leading-4 text-encre-4">
      <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
      <span>{texte}</span>
    </p>
  )
}

/** Le segmenté — la même grammaire que les tables de `Retouche.tsx`. */
function Choix<T extends string>({
  valeurs,
  valeur: courante,
  libelles,
  onChange,
}: {
  valeurs: readonly T[]
  valeur: T
  libelles?: Partial<Record<string, string>>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-[4px]">
      {valeurs.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={courante === v}
          onClick={() => onChange(v)}
          className={[
            "h-[26px] rounded-7 border px-[8px] text-[12px] transition-colors duration-120",
            courante === v
              ? "border-encre-4 bg-carte font-medium text-encre"
              : "border-trait bg-carte text-encre-3 hover:border-encre-4 hover:text-encre",
          ].join(" ")}
        >
          {libelles?.[v] ?? v}
        </button>
      ))}
    </div>
  )
}

/** Un curseur, et sa valeur qui s'écrit à côté. */
function Glissiere({
  valeur,
  min,
  max,
  unite = "",
  onChange,
}: {
  valeur: number
  min: number
  max: number
  unite?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <input
        type="range"
        min={min}
        max={max}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="curseur-papier h-[22px] min-w-0 flex-1"
      />
      <span className="mesure w-[54px] shrink-0 text-right text-[10.5px] text-encre-2">
        {valeur}
        {unite}
      </span>
    </div>
  )
}

// ── La planche, et les rectangles dessus ────────────────────────────────────

/** Le geste en cours sur la planche — un seul à la fois, celui que le doigt
 *  ou la souris tient depuis le dernier appui. */
type Geste =
  | { type: "dessiner"; depart: [number, number] }
  | { type: "deplacer" | "redimensionner"; rang: number; depart: [number, number]; boiteDepart: Boite }

/**
 * L'image **brute**, à sa taille d'affichage, et les rectangles par-dessus.
 *
 * **Les coordonnées vivent en pixels de planche, jamais en pixels d'écran.**
 * L'image est mise à l'échelle pour tenir dans la place disponible ; tout ce
 * qui sort d'ici est reconverti tout de suite, sans quoi une fenêtre
 * redimensionnée déplacerait des rectangles déjà posés.
 *
 * **Trois gestes, une seule surface.** Poser le doigt sur la poignée d'une
 * zone la redimensionne, le poser sur son corps la déplace, le poser ailleurs
 * trace un nouveau rectangle — départagés au clic, sur ce qui est vraiment
 * sous le pointeur (`data-poignee`/`data-zone`), jamais sur une coordonnée
 * recalculée à côté qui finirait par s'en écarter.
 */
function Planche({
  vu,
  zones,
  choisie,
  onChoisir,
  onDessiner,
  onDeplacer,
  onRedimensionner,
  onDebutGeste,
}: {
  vu: { largeur: number; hauteur: number; alt: string; image: string }
  zones: Zone[]
  choisie: number | null
  onChoisir: (rang: number | null) => void
  onDessiner: (boite: Boite) => void
  onDeplacer: (rang: number, boite: Boite) => void
  onRedimensionner: (rang: number, boite: Boite) => void
  onDebutGeste: () => void
}) {
  const cadre = useRef<HTMLDivElement>(null)
  const [trace, setTrace] = useState<Boite | null>(null)
  const geste = useRef<Geste | null>(null)

  const enPixels = (evenement: React.PointerEvent): [number, number] => {
    const boite = cadre.current!.getBoundingClientRect()
    const echelle = vu.largeur / boite.width
    return [
      borner(Math.round((evenement.clientX - boite.left) * echelle), vu.largeur),
      borner(Math.round((evenement.clientY - boite.top) * echelle), vu.hauteur),
    ]
  }

  return (
    <SurfaceZoomable largeur={vu.largeur} hauteur={vu.hauteur} libelle="la découpe">
      <div
        ref={cadre}
        data-planche-decoupe
        className="damier-papier relative h-full w-full select-none"
        onPointerDown={(evenement) => {
          if (evenement.button !== 0) return
          const cible = evenement.target as HTMLElement
          const poignee = cible.closest("[data-poignee]")
          const corps = cible.closest("[data-zone]")
          const point = enPixels(evenement)
          evenement.currentTarget.setPointerCapture(evenement.pointerId)
          if (poignee) {
            const rang = Number(poignee.getAttribute("data-poignee"))
            onDebutGeste()
            geste.current = { type: "redimensionner", rang, depart: point, boiteDepart: zones[rang].boite }
            onChoisir(rang)
          } else if (corps) {
            const rang = Number(corps.getAttribute("data-zone"))
            onDebutGeste()
            geste.current = { type: "deplacer", rang, depart: point, boiteDepart: zones[rang].boite }
            onChoisir(rang)
          } else {
            geste.current = { type: "dessiner", depart: point }
            setTrace(null)
          }
        }}
        onPointerMove={(evenement) => {
          const g = geste.current
          if (!g) return
          const point = enPixels(evenement)
          if (g.type === "dessiner") { setTrace(entre(g.depart, point)); return }
          if (g.type === "deplacer") {
            onDeplacer(g.rang, decaler(g.boiteDepart, point[0] - g.depart[0], point[1] - g.depart[1], vu))
            return
          }
          onRedimensionner(g.rang, redimensionnerBoite(g.boiteDepart, point[0], point[1], vu))
        }}
        onPointerUp={(evenement) => {
          const g = geste.current
          geste.current = null
          if (!g) return
          if (g.type !== "dessiner") { setTrace(null); return }
          setTrace(null)
          const boite = entre(g.depart, enPixels(evenement))
          // Un clic n'est pas un rectangle : sous quatre pixels de côté, c'est
          // le geste « je désélectionne ».
          if (boite[2] - boite[0] < COTE_UTILE || boite[3] - boite[1] < COTE_UTILE) {
            onChoisir(null)
            return
          }
          onDessiner(boite)
        }}
      >
        <img
          src={vu.image}
          alt={vu.alt}
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />

        {zones.map((zone, rang) => (
          <Rectangle
            key={rang}
            rang={rang}
            boite={zone.boite}
            vu={vu}
            numero={rang + 1}
            choisi={rang === choisie}
            garder={zone.garder}
          />
        ))}
        {trace && <Rectangle boite={trace} vu={vu} numero={zones.length + 1} choisi garder />}
      </div>
    </SurfaceZoomable>
  )
}

/** Un rectangle sur la planche. Le numéro est un fait mesuré, donc en mono.
 *  Une zone écartée s'efface aux trois quarts — elle reste lisible, sans
 *  prétendre qu'elle partira. */
function Rectangle({
  rang,
  boite,
  vu,
  numero,
  choisi,
  garder,
}: {
  rang?: number
  boite: Boite
  vu: { largeur: number; hauteur: number }
  numero: number
  choisi: boolean
  garder: boolean
}) {
  const [x0, y0, x1, y1] = boite
  return (
    <div
      data-zone={rang !== undefined ? rang : undefined}
      style={{
        left: `${(x0 / vu.largeur) * 100}%`,
        top: `${(y0 / vu.hauteur) * 100}%`,
        width: `${((x1 - x0 + 1) / vu.largeur) * 100}%`,
        height: `${((y1 - y0 + 1) / vu.hauteur) * 100}%`,
        opacity: garder ? 1 : 0.35,
      }}
      className={[
        "absolute border transition-colors duration-120",
        rang !== undefined ? "cursor-move" : "",
        choisi
          ? "border-2 border-signal shadow-[0_0_0_2px_var(--color-carte)]"
          : "border-signal/70 hover:border-signal",
      ].join(" ")}
    >
      <span className="mesure absolute top-0 left-0 bg-encre px-[4px] text-[10.5px] leading-[13px] text-papier">
        {numero}
      </span>
      {rang !== undefined && (
        <span
          data-poignee={rang}
          aria-hidden
          className="absolute -right-[4px] -bottom-[4px] h-[8px] w-[8px] cursor-nwse-resize border border-papier bg-encre"
        />
      )}
    </div>
  )
}

// ── La liste ────────────────────────────────────────────────────────────────

/** Ce qui sortira, et dans quel ordre. La liste **est** la numérotation posée
 *  sur l'image : le serveur garde cet ordre — le réordonner de son côté ferait
 *  mentir les numéros au moment du clic. Une zone se garde ou s'écarte, se
 *  renomme, et se règle (« Régler » l'ouvre au clavier, ci-dessous). */
function ListeZones({
  zones,
  choisie,
  onChoisir,
  onRetirer,
  onRenommer,
  onCommencerEdition,
  onBasculerGarder,
}: {
  zones: Zone[]
  choisie: number | null
  onChoisir: (rang: number) => void
  onRetirer: (rang: number) => void
  onRenommer: (rang: number, nom: string) => void
  onCommencerEdition: (rang: number) => void
  onBasculerGarder: (rang: number) => void
}) {
  if (zones.length === 0) return null
  return (
    <div className="flex flex-col gap-[2px] border-t border-trait pt-[8px]">
      <p className="text-[11px] text-encre-2">
        {zones.length} zone{zones.length > 1 ? "s" : ""}
      </p>
      {zones.map((zone, rang) => (
        <div
          key={rang}
          className={[
            "mesure flex items-center gap-[6px] rounded-5 px-[4px] py-[4px] text-[10.5px]",
            rang === choisie ? "bg-ligne-ouverte text-encre" : "text-encre-3",
          ].join(" ")}
        >
          <button
            type="button"
            aria-pressed={zone.garder}
            aria-label={`Garder la zone ${rang + 1}`}
            onClick={() => onBasculerGarder(rang)}
            className="shrink-0"
          >
            <Case cochee={zone.garder} />
          </button>
          <input
            aria-label={`Nom de la zone ${rang + 1}`}
            value={zone.nom}
            placeholder={`Image ${rang + 1}`}
            onFocus={() => onCommencerEdition(rang)}
            onChange={(e) => onRenommer(rang, e.target.value)}
            className="h-[22px] min-w-0 flex-1 rounded-5 border border-transparent bg-transparent px-[4px] text-[10.5px] text-encre hover:border-trait focus:border-encre-4 focus:bg-carte focus:outline-none"
          />
          <span className="shrink-0 text-encre-3">
            {zone.boite[2] - zone.boite[0] + 1}×{zone.boite[3] - zone.boite[1] + 1}
          </span>
          <button type="button" onClick={() => onChoisir(rang)} className="shrink-0 hover:text-encre">
            Régler
          </button>
          <button
            type="button"
            onClick={() => onRetirer(rang)}
            aria-label={`Retirer le rectangle ${rang + 1}`}
            className="shrink-0 px-[4px] hover:text-echec"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── La relecture, avant de créer ─────────────────────────────────────────────

/** **Ce que l'auteur voit avant de payer un clic irréversible** : chaque
 *  sortie, son nom et sa taille. Fermer revient aux zones sans rien créer ;
 *  seul « Créer ces résultats » écrit quelque chose. */
function FenetreRelecture({
  zones,
  destination,
  enCours,
  onFermer,
  onConfirmer,
}: {
  zones: Zone[]
  destination: string
  enCours: boolean
  onFermer: () => void
  onConfirmer: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-papier/85" onMouseDown={onFermer} role="presentation">
      <div
        role="dialog"
        aria-label="Découper une image"
        className="volet mx-auto mt-[9%] flex max-h-[80vh] w-[380px] max-w-full flex-col overflow-hidden rounded-10 border border-contour bg-carte"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-baseline gap-[14px] border-b border-trait px-[22px] py-[14px]">
          <h1 className="font-serif text-[25px] leading-none text-encre">Découper une image</h1>
        </header>
        <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[22px]">
          <p className="text-[12px] text-encre-2">
            {zones.length} sortie{zones.length > 1 ? "s" : ""} · {destination}. L'original reste disponible.
          </p>
          <ul className="flex flex-col gap-[8px]">
            {zones.map((zone, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-[8px] rounded-5 border border-trait px-[8px] py-[4px]"
              >
                <span className="text-[12.5px] text-encre">{zone.nom.trim() || `Image ${i + 1}`}</span>
                <span className="mesure text-[10.5px] text-encre-3">
                  {zone.boite[2] - zone.boite[0] + 1} × {zone.boite[3] - zone.boite[1] + 1} px
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-[8px] border-t border-trait p-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[34px] rounded-7 border border-trait px-[14px] text-[13px] text-encre transition-colors duration-120 hover:bg-papier"
          >
            ‹ Les zones
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={onConfirmer}
            className="ml-auto h-[34px] rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:opacity-90 disabled:bg-carte disabled:text-eteint"
          >
            {enCours ? "…" : "Créer ces résultats"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Outils ──────────────────────────────────────────────────────────────────

const borner = (valeur: number, taille: number) => Math.max(0, Math.min(taille - 1, valeur))

const entre = (a: [number, number], b: [number, number]): Boite => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
]

/** Translater un rectangle sans changer sa taille, borné à l'image — un
 *  déplacement qui sortirait du cadre glisse le long du bord plutôt que de
 *  disparaître. */
const decaler = (boite: Boite, dx: number, dy: number, vu: { largeur: number; hauteur: number }): Boite => {
  const largeur = boite[2] - boite[0]
  const hauteur = boite[3] - boite[1]
  const x0 = Math.max(0, Math.min(vu.largeur - 1 - largeur, boite[0] + dx))
  const y0 = Math.max(0, Math.min(vu.hauteur - 1 - hauteur, boite[1] + dy))
  return [x0, y0, x0 + largeur, y0 + hauteur]
}

/** Le coin haut-gauche ne bouge pas : c'est le coin bas-droit qui règle la
 *  taille, borné pour ne jamais repasser sous le côté utile. */
const redimensionnerBoite = (boite: Boite, x: number, y: number, vu: { largeur: number; hauteur: number }): Boite => {
  const x1 = Math.max(boite[0] + COTE_UTILE - 1, Math.min(vu.largeur - 1, x))
  const y1 = Math.max(boite[1] + COTE_UTILE - 1, Math.min(vu.hauteur - 1, y))
  return [boite[0], boite[1], x1, y1]
}

const memesBoites = (a: Boite[], b: Boite[]) =>
  a.length === b.length && a.every((boite, i) => boite.every((v, j) => v === b[i][j]))
