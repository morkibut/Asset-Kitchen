// -*- coding: utf-8 -*-
/** **L'atelier d'une animation gardée** (A7) — image par image.
 *
 *  > ### ⚠️ Une animation gardée était un cul-de-sac
 *  >
 *  > Le produit savait garder une animation avec tous ses réglages — le cadre,
 *  > la recette, la vitesse, le sens, ses images — et **ne savait pas la
 *  > rouvrir**. La vignette de la matrice remontait au *clip* : l'écran
 *  > repartait donc des réglages du jeu, et corriger une virgule demandait de
 *  > tout refaire de mémoire. Trouvé à l'usage par l'auteur le 4 septembre 2026.
 *
 *  **Ce n'est pas l'écran de montage, et le partage est net.** Le montage
 *  *taille un clip en animations* : on y choisit des images sur une pellicule.
 *  Celui-ci *retravaille une animation gardée* : on y corrige une image à la
 *  fois. Deux écrans parce que ce sont deux moments — on ne taille pas et on ne
 *  corrige pas avec la même main.
 *
 *  **La grammaire est celle des tables** (E3) : le réglage à gauche, la chose en
 *  grand au milieu, ses voisines à droite. Ici les voisines sont **les images de
 *  l'animation**, et le lecteur est sous elles.
 *
 *  ## Ce qui n'est pas automatique, et pourquoi
 *
 *  Les corrections vivent d'abord à l'écran : l'aperçu se refait à chaque geste
 *  et **rien n'est écrit** tant que l'auteur n'a pas enregistré. C'est la règle
 *  déjà tenue par le montage — *c'est un bouton et pas un automatisme* —, et
 *  elle vaut double ici : une correction au pixel se tâtonne, et enregistrer à
 *  chaque flèche écrirait vingt planches pour un seul geste.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  api,
  type Ancrage,
  type AtelierDeBande as AtelierRecu,
  type CadrePose,
  type Prise,
  type Recette,
} from "../api"
import { rangDeLaBande } from "./Apercu"
import { Curseur, EnTetePanneau, Libelle } from "./chassis"
import { PANNEAU } from "./Infobulle"

/** Les neuf points, **dans l'ordre où ils se dessinent** — trois par rangée.
 *  Les mots sont ceux du serveur, à la lettre : deux vocabulaires pour la même
 *  chose finiraient par ne plus désigner le même point. */
const ANCRAGES: readonly (readonly Ancrage[])[] = [
  ["haut-gauche", "haut", "haut-droite"],
  ["gauche", "centre", "droite"],
  ["bas-gauche", "bas", "bas-droite"],
]

/** Ce que chaque point veut dire en clair. Un carré de neuf cases sans un mot
 *  est un test de devinette : l'auteur doit savoir ce qu'il choisit avant de
 *  cliquer, pas après. */
const MOT_DE_L_ANCRAGE: Record<Ancrage, string> = {
  "haut-gauche": "accroché en haut à gauche",
  haut: "accroché en haut, centré",
  "haut-droite": "accroché en haut à droite",
  gauche: "accroché à gauche, à mi-hauteur",
  centre: "au milieu, dans les deux sens",
  droite: "accroché à droite, à mi-hauteur",
  "bas-gauche": "posé au sol, à gauche",
  bas: "posé au sol, centré — le défaut du produit",
  "bas-droite": "posé au sol, à droite",
}

/** D'où le rectangle vient. Les mots sont ceux du serveur, pour la même raison
 *  que les neuf points : deux vocabulaires finiraient par ne plus désigner la
 *  même mesure. */
const MOT_DU_CADRE: Record<string, string> = {
  clip: "pris sur le clip entier — toutes ses bandes ont la même assise",
  bande: "pris sur cette animation seule",
  main: "posé à la main",
}

export function EcranAtelierDeBande({
  identifiant,
  onFermer,
  onErreur,
  onChangee,
}: {
  identifiant: string
  onFermer: () => void
  onErreur: (raison: string) => void
  /** L'animation a changé sur le disque — la matrice et la galerie l'affichent
   *  aussi, et une vignette qui montrerait l'ancienne planche serait un
   *  mensonge silencieux. */
  onChangee?: () => void
}) {
  const [recu, setRecu] = useState<AtelierRecu | null>(null)
  const [prises, setPrises] = useState<Prise[]>([])
  const [recette, setRecette] = useState<Recette | null>(null)
  const [cadence, setCadence] = useState(8)
  const [sens, setSens] = useState<"boucle" | "aller-retour">("boucle")
  const [courante, setCourante] = useState(0)
  const [pelure, setPelure] = useState(0)
  const [joue, setJoue] = useState(true)
  const [pas, setPas] = useState(0)
  const [planche, setPlanche] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(false)
  const [remesure, setRemesure] = useState(false)
  const toile = useRef<HTMLDivElement | null>(null)

  // **Dire une panne ne doit pas relancer l'aperçu.** L'écran d'accueil passe
  // une fonction neuve à chaque rendu ; la laisser dans les dépendances ferait
  // repartir la demande d'aperçu à chaque rendu de l'écran au-dessus, pour un
  // geste que l'auteur n'a pas fait.
  const direPanne = useRef(onErreur)
  direPanne.current = onErreur

  // ── Ouvrir ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let vivant = true
    void (async () => {
      try {
        const ouvert = await api.ouvrirLaBande(identifiant)
        if (!vivant) return
        setRecu(ouvert)
        setPrises(ouvert.bande.prises)
        setRecette(ouvert.bande.recette)
        setCadence(ouvert.bande.cadence)
        setSens(ouvert.bande.sens)
        setPlanche(ouvert.planche)
      } catch (erreur) {
        if (vivant) direPanne.current((erreur as Error).message)
      }
    })()
    return () => {
      vivant = false
    }
  }, [identifiant])

  // ── Ce qui a bougé depuis l'ouverture ─────────────────────────────────────
  //
  // Comparé au départ et non compté au fil de l'eau : pousser une image puis la
  // repousser dans l'autre sens ne laisse **rien** à enregistrer, et un compteur
  // qui monterait à deux mentirait sur ce qu'il reste à faire.
  const change = useMemo(() => {
    if (!recu) return false
    return (
      JSON.stringify(prises) !== JSON.stringify(recu.bande.prises) ||
      JSON.stringify(recette) !== JSON.stringify(recu.bande.recette) ||
      cadence !== recu.bande.cadence ||
      sens !== recu.bande.sens
    )
  }, [recu, prises, recette, cadence, sens])

  // ── L'aperçu, refait à chaque geste et **sans rien écrire** ───────────────

  useEffect(() => {
    if (!recu || prises.length === 0) return
    let vivant = true
    // Un petit délai, parce que les flèches se tiennent enfoncées : sans lui,
    // une pression continue enverrait une demande par répétition du clavier.
    const minuteur = window.setTimeout(() => {
      void (async () => {
        try {
          const apercu = await api.apercuDeBande({
            clip: recu.bande.clip,
            prises,
            recette,
            cadre: recu.bande.cadre,
          })
          if (vivant) setPlanche(apercu.planche)
        } catch (erreur) {
          if (vivant) direPanne.current((erreur as Error).message)
        }
      })()
    }, 120)
    return () => {
      vivant = false
      window.clearTimeout(minuteur)
    }
  }, [recu, prises, recette])

  // ── Le lecteur ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!joue || prises.length < 2 || cadence <= 0) return
    const minuteur = window.setInterval(
      () => setPas((p) => p + 1),
      1000 / cadence,
    )
    return () => window.clearInterval(minuteur)
  }, [joue, prises.length, cadence])

  // Arrêté, on regarde l'image choisie ; en marche, celle du cycle. Le rang du
  // cycle est calculé par la **même** règle que partout ailleurs.
  const rang = joue
    ? rangDeLaBande(pas, prises.length, sens)
    : Math.min(courante, Math.max(0, prises.length - 1))

  // ── Les gestes ────────────────────────────────────────────────────────────
  //
  // ⚠️ **On corrige l'image qu'on regarde**, et il a fallu l'écrire exprès :
  // l'animation tourne à l'ouverture, donc la première flèche arrive pendant que
  // les images défilent. Sans cette ligne, elle poussait la *première* image de
  // la bande — celle que l'auteur ne regardait pas —, l'animation s'arrêtait
  // ailleurs, et la correction se voyait sur une pose au hasard. Vu à l'écran le
  // 5 septembre 2026, sur l'atelier jetable de la tranche.
  const affichee = useRef(0)
  affichee.current = rang

  const corriger = useCallback(
    (change: (prise: Prise) => Prise) => {
      const cible = affichee.current
      setJoue(false)
      setCourante(cible)
      setPrises((avant) =>
        avant.map((prise, index) => (index === cible ? change(prise) : prise)),
      )
    },
    [],
  )

  const pousser = useCallback(
    (dx: number, dy: number) =>
      corriger((prise) => ({ ...prise, dx: prise.dx + dx, dy: prise.dy + dy })),
    [corriger],
  )

  const remettreDroit = useCallback(
    () => corriger((prise) => ({ ...prise, dx: 0, dy: 0 })),
    [corriger],
  )

  const remplacer = useCallback(
    (numero: number, clip: string) =>
      corriger((prise) => ({ ...prise, numero, clip })),
    [corriger],
  )

  const annuler = useCallback(() => {
    if (!recu) return
    setPrises(recu.bande.prises)
    setRecette(recu.bande.recette)
    setCadence(recu.bande.cadence)
    setSens(recu.bande.sens)
  }, [recu])

  const enregistrer = useCallback(async () => {
    if (!recu) return
    setEnregistre(true)
    try {
      await api.corrigerLaBande(recu.bande.identifiant, {
        prises,
        recette,
        cadence,
        sens,
      })
      // On repart de ce que le serveur a **vraiment** écrit, pas de ce qu'on
      // croyait envoyer : la poussée est bornée là-bas, donc une correction
      // poussée hors de la case revient corrigée — et c'est ce qu'il faut voir.
      //
      // Rouvrir plutôt que garder la bande rendue, parce qu'un détourage changé
      // périme la fenêtre commune : c'est le serveur qui sait le dire, et un
      // écran qui l'annoncerait encore à jour serait un mensonge silencieux.
      const ouvert = await api.ouvrirLaBande(recu.bande.identifiant)
      setRecu(ouvert)
      setPrises(ouvert.bande.prises)
      setPlanche(ouvert.planche)
      onChangee?.()
    } catch (erreur) {
      onErreur((erreur as Error).message)
    } finally {
      setEnregistre(false)
    }
  }, [recu, prises, recette, cadence, sens, onChangee, onErreur])

  // ── Reprendre la fenêtre commune ──────────────────────────────────────────
  //
  // **Le seul geste de cet écran qui écrit sans passer par « Enregistrer »**, et
  // c'est pourquoi il est fermé tant que des corrections attendent : mesurer
  // avec la recette du disque puis écrire par-dessus des réglages en cours
  // laisserait la bande à moitié neuve, ce que le critère interdit.
  const reprendreLeCadre = useCallback(async () => {
    if (!recu) return
    setRemesure(true)
    try {
      await api.reprendreLeCadreDeLaBande(recu.bande.identifiant)
      const ouvert = await api.ouvrirLaBande(recu.bande.identifiant)
      setRecu(ouvert)
      setPrises(ouvert.bande.prises)
      setPlanche(ouvert.planche)
      onChangee?.()
    } catch (erreur) {
      onErreur((erreur as Error).message)
    } finally {
      setRemesure(false)
    }
  }, [recu, onChangee, onErreur])

  // ── Le clavier ────────────────────────────────────────────────────────────

  useEffect(() => {
    const ecouter = (evenement: KeyboardEvent) => {
      const dans = toile.current
      if (!dans || !dans.contains(document.activeElement)) return
      const pasDuGeste = evenement.shiftKey ? 5 : 1
      const gestes: Record<string, [number, number]> = {
        ArrowLeft: [-pasDuGeste, 0],
        ArrowRight: [pasDuGeste, 0],
        ArrowUp: [0, -pasDuGeste],
        ArrowDown: [0, pasDuGeste],
      }
      const geste = gestes[evenement.key]
      if (!geste) return
      evenement.preventDefault()
      pousser(geste[0], geste[1])
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [pousser])

  if (!recu || !planche) {
    return (
      <div
        data-atelier-de-bande
        className="mesure flex h-full items-center justify-center text-[11px] text-texte-3"
      >
        on rouvre l'animation…
      </div>
    )
  }

  const bande = recu.bande
  const compte = prises.length
  const large = bande.case_largeur || 64
  const haut = bande.case_hauteur || 64
  // Au plus proche voisin et à facteur entier : un sprite lissé n'est plus un
  // sprite, et un facteur fractionnaire déforme ses pixels carrés.
  const facteur = Math.max(1, Math.floor(Math.min(420 / haut, 420 / large)))

  return (
    <div
      data-atelier-de-bande={bande.identifiant}
      className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_240px]"
    >
      {/* ── Ce qu'on règle pour toute l'animation ────────────────────────── */}
      <aside
        {...PANNEAU}
        className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-bord bg-fond-1 p-3"
      >
        <div className="flex items-baseline gap-2">
          <EnTetePanneau>{bande.nom}</EnTetePanneau>
          <button
            type="button"
            onClick={onFermer}
            className="mesure ml-auto text-[10px] text-texte-3 hover:text-signal"
          >
            ‹ fermer
          </button>
        </div>

        <p className="mesure text-[10px] leading-4 text-texte-3">
          {compte} image{compte > 1 ? "s" : ""}, {cadence} par seconde —{" "}
          {bande.secondes} s par tour. Ce qui se règle ici vaut pour{" "}
          <b className="text-texte-2">toute l'animation</b> ; ce qui se corrige
          au milieu ne vaut que pour l'image choisie.
        </p>

        <ReglagesDeLaBande
          recette={recette}
          onRecette={setRecette}
          cadence={cadence}
          onCadence={setCadence}
          sens={sens}
          onSens={setSens}
        />

        <ChoixDeLAncrage
          ancrage={recette?.grille?.ancrage ?? "bas"}
          onAncrage={(point) =>
            setRecette((avant) =>
              avant?.grille
                ? { ...avant, grille: { ...avant.grille, ancrage: point } }
                : avant,
            )
          }
        />

        <FenetreDeLaBande
          cadre={bande.cadre}
          etat={recu.cadre}
          enCours={remesure}
          bloquee={change}
          onReprendre={() => void reprendreLeCadre()}
        />

        {change && (
          <div className="flex flex-col gap-1.5 border-t border-bord pt-2">
            <p className="mesure text-[10px] leading-4 text-signal">
              des corrections attendent — rien n'est écrit tant que vous n'avez
              pas enregistré
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void enregistrer()}
                disabled={enregistre}
                className="mesure border border-signal px-2 py-1 text-[10px] text-signal hover:bg-signal hover:text-fond-0 disabled:opacity-50"
              >
                {enregistre ? "on enregistre…" : "Enregistrer ›"}
              </button>
              <button
                type="button"
                onClick={annuler}
                className="mesure border border-bord px-2 py-1 text-[10px] text-texte-3 hover:text-texte-1"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── L'image qu'on corrige, en grand ──────────────────────────────── */}
      <div className="flex min-h-0 flex-col items-center justify-center gap-3 p-4">
        <CaseEnGrand
          ref={toile}
          planche={planche}
          rang={rang}
          precedent={rang > 0 ? rang - 1 : compte - 1}
          compte={compte}
          large={large}
          haut={haut}
          facteur={facteur}
          pelure={pelure}
          onPousser={pousser}
        />

        <CorrectionDeLImage
          prise={prises[rang]}
          clipDeLaBande={bande.clip}
          imagesParClip={recu.images_par_clip}
          voisins={recu.clips_voisins}
          melangee={bande.melangee}
          pelure={pelure}
          onPelure={setPelure}
          onRemplacer={remplacer}
          onRemettreDroit={remettreDroit}
        />
      </div>

      {/* ── Ses images, et le lecteur sous elles ─────────────────────────── */}
      <aside
        {...PANNEAU}
        className="flex min-h-0 flex-col border-l border-bord bg-fond-1"
      >
        <EnTetePanneau>Ses images</EnTetePanneau>
        <div className="defile flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto p-2">
          {prises.map((prise, index) => (
            <ImageDeLaBande
              key={`${prise.clip}-${prise.numero}-${index}`}
              prise={prise}
              index={index}
              planche={planche}
              large={large}
              haut={haut}
              compte={compte}
              courante={index === rang}
              venueDAilleurs={Boolean(prise.clip) && prise.clip !== bande.clip}
              onChoisir={() => {
                setJoue(false)
                setCourante(index)
              }}
            />
          ))}
        </div>

        <Lecteur
          joue={joue}
          onJoue={setJoue}
          cadence={cadence}
          onCadence={setCadence}
          rang={rang}
          compte={compte}
        />
      </aside>
    </div>
  )
}

/** L'image en grand, **avec la précédente en transparence dessous**.
 *
 *  La pelure d'oignon est le geste que l'animation demande depuis toujours :
 *  juger un déplacement au lieu de le deviner. Elle est **réglable et éteinte
 *  par défaut** — allumée d'office, elle ferait croire à un défaut de rendu sur
 *  la première ouverture. */
const CaseEnGrand = (() => {
  function Rendu(
    {
      planche,
      rang,
      precedent,
      compte,
      large,
      haut,
      facteur,
      pelure,
      onPousser,
    }: {
      planche: string
      rang: number
      precedent: number
      compte: number
      large: number
      haut: number
      facteur: number
      pelure: number
      onPousser: (dx: number, dy: number) => void
    },
    ref: React.Ref<HTMLDivElement>,
  ) {
    const depart = useRef<{ x: number; y: number } | null>(null)

    const fond = (place: number) => ({
      width: large * facteur,
      height: haut * facteur,
      backgroundImage: `url(${planche})`,
      backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`,
      backgroundPosition: `-${place * large * facteur}px 0`,
      imageRendering: "pixelated" as const,
    })

    return (
      <div
        ref={ref}
        tabIndex={0}
        data-case-en-grand={rang}
        role="application"
        aria-label="l'image à corriger — les flèches la déplacent d'un pixel"
        title="cliquez, puis les flèches — Maj pour cinq pixels à la fois"
        className="relative cursor-move border border-bord bg-fond-2 outline-none focus:border-signal"
        style={{ width: large * facteur, height: haut * facteur }}
        onPointerDown={(evenement) => {
          evenement.currentTarget.setPointerCapture(evenement.pointerId)
          depart.current = { x: evenement.clientX, y: evenement.clientY }
        }}
        onPointerMove={(evenement) => {
          if (!depart.current) return
          // La souris se compte en pixels d'écran, la correction en pixels du
          // sprite : sans cette division, un geste d'un centimètre pousserait
          // le sujet de trente blocs.
          const dx = Math.round(
            (evenement.clientX - depart.current.x) / facteur,
          )
          const dy = Math.round(
            (evenement.clientY - depart.current.y) / facteur,
          )
          if (!dx && !dy) return
          depart.current = {
            x: depart.current.x + dx * facteur,
            y: depart.current.y + dy * facteur,
          }
          onPousser(dx, dy)
        }}
        onPointerUp={() => {
          depart.current = null
        }}
      >
        {pelure > 0 && compte > 1 && (
          <span
            data-pelure
            aria-hidden
            className="absolute left-0 top-0"
            style={{ ...fond(precedent), opacity: pelure / 100 }}
          />
        )}
        <span className="absolute left-0 top-0" style={fond(rang)} />
      </div>
    )
  }
  return Object.assign(
    // eslint-disable-next-line react-hooks/rules-of-hooks
    (props: Parameters<typeof Rendu>[0] & { ref?: React.Ref<HTMLDivElement> }) =>
      Rendu(props, props.ref ?? null),
    { displayName: "CaseEnGrand" },
  )
})()

/** Ce qui se corrige sur **l'image choisie**, et rien que sur elle. */
function CorrectionDeLImage({
  prise,
  clipDeLaBande,
  imagesParClip,
  voisins,
  melangee,
  pelure,
  onPelure,
  onRemplacer,
  onRemettreDroit,
}: {
  prise: Prise | undefined
  clipDeLaBande: string
  imagesParClip: Record<string, number>
  voisins: AtelierRecu["clips_voisins"]
  melangee: boolean
  pelure: number
  onPelure: (v: number) => void
  onRemplacer: (numero: number, clip: string) => void
  onRemettreDroit: () => void
}) {
  if (!prise) return null
  const venue = prise.clip || clipDeLaBande
  const combien =
    imagesParClip[venue] ??
    voisins.find((c) => c.identifiant === venue)?.images ??
    0
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <Libelle aide="codex.bande.image">l'image choisie</Libelle>
        <span className="mesure ml-auto text-[10px] text-texte-3">
          image {prise.numero}
          {melangee && (
            <>
              {" "}
              — du clip <b className="text-texte-2">{venue.slice(0, 8)}</b>
            </>
          )}
        </span>
      </div>

      <p className="mesure text-[10px] leading-4 text-texte-3">
        Poussée de <b className="text-texte-2">{prise.dx}</b> horizontalement et{" "}
        <b className="text-texte-2">{prise.dy}</b> verticalement, en pixels du
        sprite. Aux bords, les flèches <b className="text-texte-2">cessent
        d'avoir un effet</b> plutôt que de rogner l'image.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(prise.dx !== 0 || prise.dy !== 0) && (
          <button
            type="button"
            onClick={onRemettreDroit}
            className="mesure border border-bord px-2 py-1 text-[10px] text-texte-3 hover:text-signal"
          >
            remettre cette image droite
          </button>
        )}
        {combien > 0 && (
          <label className="mesure flex items-center gap-1.5 text-[10px] text-texte-3">
            la remplacer par l'image
            <input
              type="number"
              min={0}
              max={combien - 1}
              value={prise.numero}
              onChange={(evenement) =>
                onRemplacer(Number(evenement.target.value), prise.clip)
              }
              aria-label="remplacer par une autre image du clip"
              className="w-16 border border-bord bg-fond-2 px-1 py-0.5 text-texte-1"
            />
            <span>sur {combien}</span>
          </label>
        )}
      </div>

      {/* **Aller la chercher dans un autre clip** — ce qui reste de l'ancienne
          `A3`. Quand deux clips sont chacun bons à moitié, on prend une image
          dans l'un et une dans l'autre. La liste ne montre que les clips du
          **même personnage** : un clip d'ailleurs donnerait une animation où le
          sujet change au milieu. Elle ne paraît pas quand il n'y a qu'un clip —
          un menu à un seul choix n'est pas un choix. */}
      {voisins.length > 1 && (
        <label className="mesure flex flex-wrap items-center gap-1.5 text-[10px] text-texte-3">
          la prendre dans
          <select
            value={venue}
            onChange={(evenement) => {
              const choisi = evenement.target.value
              const combienLa =
                voisins.find((c) => c.identifiant === choisi)?.images ?? 0
              // Le numéro est borné sur le clip d'arrivée : l'image 40 d'un clip
              // de cinquante n'existe pas dans un clip de vingt, et le serveur
              // refuserait la correction entière.
              onRemplacer(
                Math.min(prise.numero, Math.max(0, combienLa - 1)),
                choisi === clipDeLaBande ? "" : choisi,
              )
            }}
            aria-label="prendre cette image dans un autre clip"
            className="border border-bord bg-fond-2 px-1 py-0.5 text-texte-1"
          >
            {voisins.map((clip) => (
              <option key={clip.identifiant} value={clip.identifiant}>
                {/* **Le repère court avec le mouvement**, et pas seulement le
                    mouvement : deux tirages de la même marche portent le même
                    mot, et la liste les rendrait indiscernables. C'est le même
                    repère que la vignette écrit à côté de l'image. */}
                {clip.mouvement || "clip"} · {clip.identifiant.slice(0, 8)} —{" "}
                {clip.images} images
                {clip.identifiant === clipDeLaBande ? " · celui de l'animation" : ""}
              </option>
            ))}
          </select>
          <span>· le clip est payé, en reprendre une image ne coûte rien</span>
        </label>
      )}

      <Curseur
        libelle="L'image d'avant, en transparence"
        valeur={pelure}
        min={0}
        max={80}
        pas={5}
        unite=" %"
        onChange={onPelure}
      />
    </div>
  )
}

/** Une image de l'animation, dans la colonne de droite. */
function ImageDeLaBande({
  prise,
  index,
  planche,
  large,
  haut,
  compte,
  courante,
  venueDAilleurs,
  onChoisir,
}: {
  prise: Prise
  index: number
  planche: string
  large: number
  haut: number
  compte: number
  courante: boolean
  venueDAilleurs: boolean
  onChoisir: () => void
}) {
  const cote = 64
  const facteur = Math.max(1, Math.floor(Math.min(cote / haut, cote / large)))
  return (
    <button
      type="button"
      onClick={onChoisir}
      data-image-de-la-bande={index}
      aria-label={`l'image ${prise.numero}, ${index + 1}ᵉ de l'animation`}
      aria-current={courante}
      title={
        venueDAilleurs
          ? `image ${prise.numero}, prise dans un autre clip`
          : `image ${prise.numero}`
      }
      className={`relative flex items-center justify-center overflow-hidden border bg-fond-2 ${
        courante ? "border-signal" : "border-bord hover:border-texte-3"
      }`}
      style={{ width: cote, height: cote }}
    >
      <span
        style={{
          display: "block",
          width: large * facteur,
          height: haut * facteur,
          backgroundImage: `url(${planche})`,
          backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`,
          backgroundPosition: `-${index * large * facteur}px 0`,
          imageRendering: "pixelated",
        }}
      />
      {venueDAilleurs && (
        <span
          data-venue-d-ailleurs
          aria-hidden
          title="prise dans un autre clip"
          className="absolute right-0 top-0 h-1.5 w-1.5 bg-signal"
        />
      )}
      {(prise.dx !== 0 || prise.dy !== 0) && (
        <span
          data-poussee
          aria-hidden
          title="cette image a été poussée"
          className="mesure absolute bottom-0 left-0 bg-fond-0/80 px-0.5 text-[7px] text-signal"
        >
          {prise.dx},{prise.dy}
        </span>
      )}
    </button>
  )
}

/** Le lecteur — **sous les images, pas ailleurs**. C'est là qu'on les regarde,
 *  donc c'est là qu'on les met en marche. */
function Lecteur({
  joue,
  onJoue,
  cadence,
  onCadence,
  rang,
  compte,
}: {
  joue: boolean
  onJoue: (v: boolean) => void
  cadence: number
  onCadence: (v: number) => void
  rang: number
  compte: number
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-bord p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onJoue(!joue)}
          aria-label={joue ? "arrêter l'animation" : "faire tourner l'animation"}
          className="mesure border border-bord px-2 py-1 text-[10px] text-texte-2 hover:border-signal hover:text-signal"
        >
          {joue ? "⏸ pause" : "▶ jouer"}
        </button>
        <span className="mesure text-[10px] text-texte-3">
          image {rang + 1} sur {compte}
        </span>
      </div>
      <Curseur
        libelle="Vitesse"
        valeur={cadence}
        min={1}
        max={30}
        unite=" par seconde"
        onChange={onCadence}
      />
      <p className="mesure text-[10px] leading-4 text-texte-3">
        La vitesse est celle de l'animation, pas celle de l'aperçu :{" "}
        <b className="text-texte-2">c'est le même chiffre qui part dans le
        jeu</b>.
      </p>
    </div>
  )
}

/** Les réglages qui valent pour toute l'animation. Ce sont **ceux du montage**,
 *  et volontairement les mêmes : deux écrans qui régleraient la même recette
 *  avec deux jeux de curseurs différents finiraient par ne plus rendre la même
 *  image. */
function ReglagesDeLaBande({
  recette,
  onRecette,
  cadence,
  onCadence,
  sens,
  onSens,
}: {
  recette: Recette | null
  onRecette: (r: Recette) => void
  cadence: number
  onCadence: (v: number) => void
  sens: "boucle" | "aller-retour"
  onSens: (v: "boucle" | "aller-retour") => void
}) {
  if (!recette) return null
  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="bande.recette">la recette de l'animation</Libelle>
      {recette.grille && (
        <Curseur
          libelle="Taille du pixel"
          valeur={recette.grille.cible}
          min={16}
          max={128}
          pas={4}
          unite=" px de haut"
          onChange={(v) =>
            onRecette({
              ...recette,
              grille: recette.grille ? { ...recette.grille, cible: v } : null,
            })
          }
        />
      )}
      {recette.quantification && (
        <Curseur
          libelle="Couleurs"
          valeur={recette.quantification.couleurs}
          min={4}
          max={64}
          onChange={(v) =>
            onRecette({
              ...recette,
              quantification: recette.quantification
                ? { ...recette.quantification, couleurs: v }
                : null,
            })
          }
        />
      )}
      {recette.passes[0] && (
        <Curseur
          libelle="Détourage, tolérance"
          valeur={recette.passes[0].tolerance}
          min={4}
          max={80}
          onChange={(v) =>
            onRecette({
              ...recette,
              passes: recette.passes.map((passe, index) =>
                index === 0 ? { ...passe, tolerance: v } : passe,
              ),
            })
          }
        />
      )}
      <div className="mt-1 flex items-center gap-2">
        <span className="mesure text-[10px] text-texte-3">sens de lecture</span>
        {(["boucle", "aller-retour"] as const).map((choix) => (
          <button
            key={choix}
            type="button"
            onClick={() => onSens(choix)}
            aria-pressed={sens === choix}
            className={`mesure border px-1.5 py-0.5 text-[10px] ${
              sens === choix
                ? "border-signal text-signal"
                : "border-bord text-texte-3 hover:text-texte-1"
            }`}
          >
            {choix}
          </button>
        ))}
      </div>
      <Curseur
        libelle="Vitesse"
        valeur={cadence}
        min={1}
        max={30}
        unite=" par seconde"
        onChange={onCadence}
      />
    </div>
  )
}

/** La fenêtre commune : son rectangle, d'où il vient, et s'il est d'avant.
 *
 *  **Une fenêtre mesurée avec un autre détourage n'est pas fausse : elle est
 *  d'avant.** La reprendre coûte une vingtaine de secondes, et personne ne doit
 *  les payer sans raison — c'est donc un bouton, jamais un rattrapage
 *  automatique.
 *
 *  Il se ferme tant que des corrections attendent, et la phrase le dit : mesurer
 *  avec la recette du disque puis écrire par-dessus des réglages en cours
 *  laisserait la bande à moitié neuve. */
function FenetreDeLaBande({
  cadre,
  etat,
  enCours,
  bloquee,
  onReprendre,
}: {
  cadre: CadrePose
  etat: { choix: string; a_jour: boolean; mesuree_le: number | null }
  enCours: boolean
  bloquee: boolean
  onReprendre: () => void
}) {
  const gauche = cadre.gauche ?? 0
  const sommet = cadre.sommet ?? 0
  const droite = cadre.droite ?? 0
  const bas = cadre.bas ?? 0
  const pose = droite > gauche && bas > sommet
  return (
    <div data-fenetre className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="bande.cadre">la fenêtre commune</Libelle>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        {pose ? (
          <>
            <b className="text-texte-2">
              {droite - gauche + 1} × {bas - sommet + 1}
            </b>{" "}
            pixels, {MOT_DU_CADRE[etat.choix] ?? MOT_DU_CADRE.clip}.
          </>
        ) : (
          <>Aucun rectangle posé — chaque image se recadre sur elle-même.</>
        )}
      </p>

      {!etat.a_jour && (
        <p data-fenetre-davant className="mesure text-[10px] leading-4 text-signal">
          Elle a été mesurée avec un autre détourage. Elle n'est pas fausse, elle
          est d'avant : le sujet peut dépasser d'un côté.
        </p>
      )}

      <button
        type="button"
        disabled={enCours || bloquee}
        onClick={onReprendre}
        className="mesure self-start border border-bord px-2 py-1 text-[10px] text-texte-3 hover:text-texte-1 disabled:opacity-40"
      >
        {enCours ? "on remesure…" : "Reprendre la fenêtre"}
      </button>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        {bloquee
          ? "Enregistrez d'abord : reprendre la fenêtre écrit sur l'animation, et le faire par-dessus des réglages en cours la laisserait à moitié neuve."
          : "Une vingtaine de secondes — toutes les images sont redétourées et remesurées. Rien n'est dépensé."}
      </p>
    </div>
  )
}

/** Les neuf points, en carré. **La forme dit la chose** : un menu déroulant de
 *  neuf noms obligerait à traduire « bas-droite » en un endroit de l'image ;
 *  un carré de neuf cases le montre. */
function ChoixDeLAncrage({
  ancrage,
  onAncrage,
}: {
  ancrage: Ancrage
  onAncrage: (point: Ancrage) => void
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="grille.ancrage">par où l'animation tient</Libelle>
      <div
        data-ancrages
        role="radiogroup"
        aria-label="par où l'animation tient dans sa case"
        className="grid w-[72px] grid-cols-3 gap-px border border-bord bg-bord"
      >
        {ANCRAGES.flat().map((point) => (
          <button
            key={point}
            type="button"
            role="radio"
            aria-checked={ancrage === point}
            aria-label={MOT_DE_L_ANCRAGE[point]}
            title={MOT_DE_L_ANCRAGE[point]}
            onClick={() => onAncrage(point)}
            className={`h-5 w-5 ${
              ancrage === point ? "bg-signal" : "bg-fond-2 hover:bg-fond-3"
            }`}
          />
        ))}
      </div>
      <p className="mesure text-[10px] leading-4 text-texte-3">
        {MOT_DE_L_ANCRAGE[ancrage] ?? MOT_DE_L_ANCRAGE.bas}. Un personnage tient
        par ses pieds, une bannière par son haut, une porte par son côté.
      </p>
    </div>
  )
}
