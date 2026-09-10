// Le calque — ce que la pièce a ajouté au corps, posé sur lui, la zone qui le
// borne (C3, US-143 à US-147), et la main qui rattrape le reste (C4, US-149 à
// US-153).
//
// **On juge à l'œil, pas au chiffre.** C'est la phrase de US-143, et elle décide
// de tout ce panneau : le corps de la pose est dessous, le calque est dessus, et
// les cinq mesures sont *à côté* — jamais à la place. Un panneau qui n'aurait
// montré que des nombres aurait demandé de faire confiance à une mesure pour
// juger un dessin. C'est la même phrase qui met le corps sous la retouche au
// pixel : on corrige en voyant ce sur quoi ça se pose (US-150).
//
// **Trois outils, une seule surface.** Le cadre ne change pas selon l'outil —
// c'est toujours le calque sur son corps —, seul ce que la main y fait change.
// Trois cadres auraient donné trois vérités sur la même image, et il aurait
// fallu les tenir d'accord.
//
// **380 px, encore.** C'est la colonne de la fiche asset, de l'écran Univers et
// de la réserve, réemployée pour ce qu'elle nomme déjà — *ce qu'on pose et ce
// qu'on manipule*. Aucune largeur neuve n'entre par cet écran.
//
// **Rien ici ne coûte un centime**, et ça se lit dans ses appels : `api.borner`,
// `api.affiner` et `api.recaler`, et aucun des trois ne touche le fournisseur.
// Déplacer la zone, passer la main, retoucher au pixel recalculent le calque à
// partir de l'image déjà payée et du corps déjà là — le journal du projet ne
// bouge pas (US-145). Recaler relit la planche payée et refait l'alignement, qui
// est la seule partie du calque que le rendu ne rejoue pas : elle est dans le
// brut, et le brut d'un calque est un dérivé (R5, US-173).

import { useEffect, useRef, useState } from "react"
import {
  api,
  type Asset,
  type Couche,
  type MesuresCalque,
  type Trait,
} from "../api"
import { sujetAsset } from "./Apercu"
import { Bouton, EnTetePanneau, Libelle, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"

/** Le côté du cadre où l'on regarde le calque. Assez grand pour juger un
 *  sprite de 64 px agrandi douze fois, assez petit pour tenir dans la colonne
 *  de 380 avec ses marges. */
const CADRE = 340

/** Un rectangle de la zone, **inclusif aux deux bouts** et en pixels de l'image
 *  rendue — la convention du produit depuis T5, et une seule dans tout le
 *  dépôt. */
type Zone = [number, number, number, number]

/** Ce que la main tient. **`zone` est le geste de C3**, les deux autres sont les
 *  couches de C4 et portent leur nom de domaine — celui que le port transporte,
 *  pour qu'il n'y ait pas de table de traduction où se tromper de couche. */
type Outil = "zone" | Couche

/** Les trois rayons offerts, en pixels de l'image rendue.
 *
 *  **Zéro est le pixel**, et c'est très exactement la seconde moitié de « à main
 *  levée, puis au pixel » (US-149) : les deux échelles du geste sont les deux
 *  bouts d'un seul réglage, et non deux outils qu'il faudrait apprendre. Ce qui
 *  s'affiche est le **diamètre** — la largeur du trait est ce que la main voit,
 *  le rayon est ce que le calcul veut. */
const RAYONS = [0, 2, 6] as const
const LARGEURS: Record<string, string> = { 0: "1 px", 2: "5 px", 6: "13 px" }

/** Ce qu'un geste est en train de faire au rectangle.
 *
 *  **Trois gestes et un seul état**, parce qu'ils s'excluent : on ne déplace pas
 *  en même temps qu'on retaille. Deux états auraient permis l'instant où les
 *  deux sont vrais, qui n'existe pas. */
type Geste =
  | { quoi: "tracer"; depart: [number, number] }
  | { quoi: "deplacer"; depart: [number, number]; zone: Zone }
  | { quoi: "retailler"; zone: Zone }

export function PanneauCalque({
  calque,
  corps,
  pose,
  piece,
  retenu,
  onFermer,
  onSupprimer,
  onSuperposition,
  onErreur,
}: {
  calque: Asset
  /** Le corps de **sa** pose — celui que la planche a envoyé. Absent quand
   *  l'image a quitté la bibliothèque : le calque se montre alors seul, ce qui
   *  est exactement ce qu'il est sur le disque. */
  corps: Asset | null
  pose: string
  piece: string
  /** **Est-ce ce calque-ci qui partirait dans le jeu ?** Calculé par le
   *  serveur, jamais ici : la règle — *le favori d'abord, sinon le plus
   *  récent* — s'écrit une fois et se lit des deux côtés. */
  retenu: boolean
  onFermer: () => void
  /** **Jeter celui qu'on n'a pas choisi.** Absent, la rangée du jugement
   *  n'offre que le favori — c'est ce que fait la galerie quand une image n'y
   *  est plus. */
  onSupprimer?: () => void
  /** **Refaire le calage à la main** (G16) : ouvre la table de superposition
   *  sur ce vêtement. Absent, le bouton ne paraît pas — la carte se lit
   *  exactement comme avant. */
  onSuperposition?: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const difference = calque.recette.difference
  // **La zone vit dans l'onglet pendant le geste, et sur le disque après.** On
  // ne poste pas à chaque pixel parcouru : le calque se recalculerait cent fois
  // pour un glissement, et l'écran clignoterait sous la main. Le geste finit,
  // et *alors* le serveur reçoit. Un passage de la main suit la même règle, et
  // pour la même raison — c'est `trace` plus bas.
  const [zone, setZone] = useState<Zone | null>(
    (difference?.zone as Zone | undefined) ?? null,
  )
  const [geste, setGeste] = useState<Geste | null>(null)
  const [rejeu, setRejeu] = useState(false)
  const [outil, setOutil] = useState<Outil>("zone")
  const [garde, setGarde] = useState(true)
  const [rayon, setRayon] = useState<number>(RAYONS[1])
  // Le passage en cours, en pixels de l'image. Il n'existe que sous la main :
  // lâché, il part au serveur et revient par le flux, dans la recette.
  const [trace, setTrace] = useState<[number, number][] | null>(null)
  // **Tenir montre l'avant** (US-151). Un état d'appui, jamais une bascule :
  // une bascule laisserait l'écran sur l'avant après le regard, et la retouche
  // suivante se ferait sur une image qui n'est plus celle qu'on modifie.
  const [avant, setAvant] = useState(false)
  // **Ce que la carte montre : le vêtement découpé, ou ce qui est arrivé.**
  // Une bascule et non un appui, contrairement à *tenir montre l'avant* : on
  // regarde ce qui est arrivé pour le juger, pas pour le comparer d'un coup
  // d'œil — et on veut pouvoir le regarder les deux mains libres (G16).
  const [arrivee, setArrivee] = useState(false)
  // **Y a-t-il une case arrivée à montrer ?** Demandé une fois à l'ouverture,
  // parce que **l'écran ne propose pas un geste qui échouera** : une planche
  // partie du disque, un découpage qui ne correspond plus, et la réponse est
  // non. C'est l'ouverture de la table de superposition qui porte le fait —
  // c'est la même question, et deux endroits pour y répondre finiraient par
  // répondre deux choses.
  const [arriveePossible, setArriveePossible] = useState(false)
  const cadre = useRef<HTMLDivElement>(null)

  // Un calque changé ailleurs — un autre onglet, un recalcul — arrive par le
  // flux. Sans ça, le rectangle garderait celui d'avant et le réécrirait au
  // premier glissement.
  useEffect(() => {
    if (geste) return
    setZone((difference?.zone as Zone | undefined) ?? null)
  }, [calque.identifiant, difference?.zone?.join(","), geste])

  useEffect(() => {
    let vivant = true
    setArrivee(false)
    setArriveePossible(false)
    if (!difference) return
    api
      .ouvrirSuperposition(calque.identifiant)
      .then((recu) => vivant && setArriveePossible(Boolean(recu?.arrivee_possible)))
      // **Un silence, pas une alerte** : ne pas savoir s'il y a une case
      // arrivée n'empêche rien de ce que la carte fait déjà. La bascule ne
      // paraît pas, et c'est tout ce que ça change.
      .catch(() => vivant && setArriveePossible(false))
    return () => {
      vivant = false
    }
  }, [calque.identifiant, Boolean(difference)])

  const largeur = calque.traite ? calque.rendu_largeur : calque.largeur
  const hauteur = calque.traite ? calque.rendu_hauteur : calque.hauteur
  const echelle = largeur > 0 ? CADRE / largeur : 1
  const haut = Math.round(hauteur * echelle)

  const affinage = difference?.affinage ?? []
  const retouche = difference?.retouche ?? []
  const couche: Trait[] = outil === "retouche" ? retouche : affinage
  // **Ce qui rend l'avant comparable** : la main est-elle passée quelque part ?
  // La même question que `main_posee` côté serveur, et elle se pose ici sur les
  // mêmes deux listes — il n'y a pas de drapeau à tenir d'accord.
  const mainPosee = affinage.length > 0 || retouche.length > 0

  /** Le pixel de l'image sous le pointeur. **Borné au cadre** : un geste qui
   *  sort de l'image ne lève pas, il se plaque au bord — un rectangle qui
   *  déborderait serait rogné par le serveur de toute façon, et le voir sortir
   *  pendant le geste ferait croire qu'il tiendra. */
  const pixel = (e: { clientX: number; clientY: number }): [number, number] => {
    const boite = cadre.current?.getBoundingClientRect()
    if (!boite) return [0, 0]
    return [
      Math.max(0, Math.min(largeur - 1, Math.floor((e.clientX - boite.left) / echelle))),
      Math.max(0, Math.min(hauteur - 1, Math.floor((e.clientY - boite.top) / echelle))),
    ]
  }

  const poser = async (suivante: Zone | null) => {
    setZone(suivante)
    try {
      await api.borner(calque.identifiant, suivante)
    } catch (erreur) {
      onErreur(erreur, "zone refusée")
    }
  }

  /** Poser une couche de la main — **la liste entière, jamais un ajout**.
   *
   *  L'écran envoie ce que la recette portait plus le passage qu'on vient de
   *  faire : deux onglets qui empileraient chacun leur delta ne convergeraient
   *  jamais, et c'est déjà la règle des références écartées. Une liste vide
   *  annule la couche, et c'est le geste unique du retour en arrière. */
  const affiner = async (quelle: Couche, traits: Trait[]) => {
    try {
      await api.affiner(calque.identifiant, quelle, traits)
    } catch (erreur) {
      onErreur(erreur, "retouche refusée")
    }
  }

  /** Rejouer le recalage de la planche (R5, US-173).
   *
   *  **Le bouton s'éteint pendant le rejeu**, et c'est tout ce qu'il annonce :
   *  la lecture d'une planche coûte des millisecondes, pas une jauge. Ce qui
   *  revient arrive par le flux, comme après un masque — l'écran ne pose donc
   *  rien lui-même, sans quoi il tiendrait une seconde vérité sur des images
   *  que le serveur vient d'écrire. */
  const recaler = async () => {
    setRejeu(true)
    try {
      await api.recaler(calque.identifiant)
    } catch (erreur) {
      onErreur(erreur, "recalage refusé")
    } finally {
      setRejeu(false)
    }
  }

  const commencer = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = pixel(e)
    if (outil !== "zone") {
      setTrace([point])
      return
    }
    const [x, y] = point
    if (zone && x >= zone[0] && x <= zone[2] && y >= zone[1] && y <= zone[3]) {
      setGeste({ quoi: "deplacer", depart: [x, y], zone })
      return
    }
    setGeste({ quoi: "tracer", depart: [x, y] })
    setZone([x, y, x, y])
  }

  const suivre = (e: React.PointerEvent) => {
    if (trace) {
      const point = pixel(e)
      // **Les points identiques ne s'empilent pas.** Un pointeur envoie
      // beaucoup plus d'événements que l'image n'a de pixels ; sans ce filtre,
      // un geste lent enverrait mille fois le même point dans la recette.
      setTrace((precedents) => {
        if (!precedents) return precedents
        const dernier = precedents[precedents.length - 1]
        if (dernier[0] === point[0] && dernier[1] === point[1]) return precedents
        return [...precedents, point]
      })
      return
    }
    if (!geste) return
    const [x, y] = pixel(e)
    if (geste.quoi === "tracer") {
      const [x0, y0] = geste.depart
      setZone([Math.min(x0, x), Math.min(y0, y), Math.max(x0, x), Math.max(y0, y)])
      return
    }
    if (geste.quoi === "retailler") {
      const [x0, y0] = geste.zone
      setZone([Math.min(x0, x), Math.min(y0, y), Math.max(x0, x), Math.max(y0, y)])
      return
    }
    // Déplacer : le rectangle garde sa taille et se plaque aux bords. Le rogner
    // au bord l'aurait rétréci sans qu'on l'ait demandé, et il ne serait jamais
    // revenu à sa taille en repartant dans l'autre sens.
    const [dx, dy] = [x - geste.depart[0], y - geste.depart[1]]
    const [ax, ay, bx, by] = geste.zone
    const glisse = Math.max(-ax, Math.min(largeur - 1 - bx, dx))
    const monte = Math.max(-ay, Math.min(hauteur - 1 - by, dy))
    setZone([ax + glisse, ay + monte, bx + glisse, by + monte])
  }

  const finir = () => {
    if (trace) {
      const points = trace
      const quelle: Couche = outil === "retouche" ? "retouche" : "affinage"
      // **Le passage reste sous les yeux jusqu'à ce que l'image le porte.**
      // L'effacer avant la réponse ferait clignoter le trait qu'on vient de
      // faire : il disparaîtrait, puis reviendrait dessiné. Un passage plus
      // récent ne se laisse pas effacer par la réponse du précédent — d'où la
      // comparaison d'identité plutôt qu'un `null` sec.
      // `couleur` vide : une couche de masque décide de ce qui reste, elle ne
      // pose aucune couleur. Le champ est arrivé en E5 avec les calques de
      // dessin de la huitième place.
      void affiner(quelle, [...couche, { garde, rayon, points, couleur: "" }]).finally(() =>
        setTrace((courant) => (courant === points ? null : courant)),
      )
      return
    }
    if (!geste) return
    setGeste(null)
    // Un clic sans glissement n'est pas un rectangle : il **retire** la zone,
    // ce qui est le geste unique du retour à la différence brute. Une zone d'un
    // pixel n'aurait rien montré et se serait ôtée au geste suivant.
    const trace_ = zone && zone[2] > zone[0] + 1 && zone[3] > zone[1] + 1 ? zone : null
    void poser(trace_)
  }

  const sujetCalque = sujetAsset(calque)
  const sujetCorps = corps ? sujetAsset(corps) : null
  // L'avant se demande à la même adresse, sous une autre question. `empreinte`
  // y voyage comme partout : le rendu change sous la même adresse à chaque
  // geste, et sans elle le navigateur resservirait l'image d'avant l'avant.
  const source = arrivee
    ? api.arrivee(calque.identifiant)
    : avant && mainPosee
      ? api.avant(calque.identifiant, calque.empreinte)
      : sujetCalque.src

  return (
    <aside
      {...PANNEAU}
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-trait bg-papier-cote"
    >
      <EnTetePanneau papier>
        {piece} · {pose}
        {/* **Refaire le calage à la main** (G16, US-503). À droite du titre,
            parce que c'est un geste sur la carte entière et non sur l'un de ses
            réglages — et qu'il emmène ailleurs, comme *sa fiche ›* ou *le
            calibrage ›* de la colonne de gauche. Il ne paraît que sur un
            vêtement : un corps habillé n'a rien à recaler. */}
        {difference && onSuperposition && (
          <button
            type="button"
            onClick={onSuperposition}
            title="Refaire la superposition à la main, sans rien repayer"
            className="mesure ml-auto px-1 text-[10px] normal-case text-encre-4 hover:text-encre"
          >
            superposition ›
          </button>
        )}
      </EnTetePanneau>

      <div className="defile flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {/* **Juger, c'est marquer favori ou supprimer** — la phrase de la
            galerie (US-25, US-26), et les deux mêmes gestes, posés ici où l'on
            regarde le calque.

            **Ils manquaient, et c'est ce manque qui se voyait** : une pose qui
            a deux calques n'a jamais dit lequel des deux partirait dans le
            jeu, et l'on ne pouvait ni le choisir ni jeter l'autre sans aller
            le retrouver dans la galerie — c'est-à-dire sans savoir que la
            règle existe. Relevé par l'auteur le 4 septembre 2026.

            **La phrase dit d'abord la réponse, le bouton ensuite.** Ce que
            l'auteur demande est *« lequel part ? »* : y répondre par deux
            boutons sans le dire aurait laissé la question entière. */}
        <Jugement
          asset={calque}
          retenu={retenu}
          onSupprimer={onSupprimer}
          onErreur={onErreur}
        />

        {/* **Ce que la carte montre** (G16, US-502). Le vêtement découpé, ou la
            case telle qu'elle est arrivée du modèle — l'image payée, que rien
            n'ouvrait jusqu'ici. Elle ne paraît que quand il y a vraiment
            quelque chose à montrer : sans planche sur le disque, la bascule
            serait un bouton qui échoue.

            **Et elle dit ce que *brut* veut dire ici**, parce que le mot en
            désigne deux : sur un corps habillé, le brut rangé *est* la case
            telle qu'elle est arrivée ; sur un vêtement, c'est celle que
            l'atelier a déjà mise à l'échelle et calée. Une bascule sans cette
            phrase aurait laissé croire qu'on regarde le fichier rangé. */}
        {arriveePossible && (
          <div className="flex flex-col gap-2">
            <Libelle papier>Ce qu'on regarde</Libelle>
            <Segments<string>
              papier
              valeurs={["calque", "brut"] as const}
              valeur={arrivee ? "brut" : "calque"}
              onChange={(quoi) => setArrivee(quoi === "brut")}
            />
            <p className="mesure text-[10px] leading-4 text-encre-4">
              {arrivee
                ? "la case telle qu'elle est arrivée du modèle, avant que l'atelier ne la mette à l'échelle et ne la cale sur le corps"
                : "le vêtement seul, découpé par différence avec le corps"}
            </p>
          </div>
        )}

        {/* **Les trois outils au-dessus du cadre**, parce qu'on choisit ce qu'on
            va faire avant de le faire. Ils ne paraissent que sur un calque : un
            corps habillé n'a ni masque ni retouche, et trois segments morts
            au-dessus de son image seraient du cadrage affiché. */}
        {difference && !arrivee && (
          <div className="flex flex-col gap-2">
            <Libelle papier>Ce que la main tient</Libelle>
            <Segments<Outil>
              papier
              valeurs={["zone", "affinage", "retouche"] as const}
              valeur={outil}
              onChange={setOutil}
              libelles={{
                zone: "zone",
                affinage: "masque",
                retouche: "retouche",
              }}
            />
          </div>
        )}

        {/* **Le corps dessous, le calque dessus, au pixel.** Les deux images ont
            les mêmes dimensions rendues — c'est la différence qui les leur donne
            —, donc la superposition est exacte sans qu'aucune mise à l'échelle
            n'ait à être calculée ici. Le damier dit ce qui est transparent, comme
            partout ailleurs dans le produit. */}
        {/* **Pendant qu'on regarde ce qui est arrivé, la main ne tient rien**
            (G16). Le cadre cesse d'être une surface de geste : la case arrivée
            n'a ni les dimensions ni le cadrage du vêtement, et un rectangle
            tracé dessus serait posé sur une image que le serveur ne connaît pas
            sous ce nom-là. Le corps dessous s'efface pour la même raison — il
            ne se superpose plus au pixel. */}
        <div
          ref={cadre}
          onPointerDown={arrivee ? undefined : commencer}
          onPointerMove={arrivee ? undefined : suivre}
          onPointerUp={arrivee ? undefined : finir}
          onPointerCancel={arrivee ? undefined : finir}
          role={arrivee ? undefined : "application"}
          aria-label={
            arrivee
              ? undefined
              : `Zone du calque ${piece} sur ${pose}`
          }
          className={[
            "damier relative shrink-0 touch-none select-none",
            arrivee ? "" : "cursor-crosshair",
          ].join(" ")}
          style={{ width: CADRE, height: haut }}
        >
          {sujetCorps && !arrivee && (
            <img
              src={sujetCorps.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-45"
              style={{ imageRendering: "pixelated" }}
            />
          )}
          <img
            src={source}
            alt={calque.label}
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
          {/* Le passage en cours, à la largeur qu'il aura. **En `--signal`, quel
              que soit son sens** : garder et ôter sont deux gestes ordinaires,
              et `--echec` veut dire *ce qui échoue ou ce qui détruit*. Ce qu'il
              fait est dit par le segment allumé juste en dessous ; ce qu'il
              couvre est dit par le trait lui-même, et ça suffit. */}
          {trace && !arrivee && (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0"
              width={CADRE}
              height={haut}
            >
              <polyline
                points={trace
                  .map(
                    ([x, y]) =>
                      `${(x + 0.5) * echelle},${(y + 0.5) * echelle}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth={(2 * rayon + 1) * echelle}
                /* **Bouts et joints carrés depuis U11**, parce que le pinceau
                    du serveur l'est : c'est la même fonction qui peint ici et
                    dans la table de la main, et un aperçu rond au-dessus d'un
                    pinceau carré serait une promesse fausse. */
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
          )}
          {/* **Le rectangle reste visible sous les trois outils, sa poignée
              non.** Il est la base dont la main part quand elle affine le masque
              (`masque_de`) : le cacher pendant qu'on l'affine aurait caché ce
              qu'on affine. La poignée, elle, appartient au geste de C3 — la
              laisser sous un pinceau aurait mis une cible de retaille au milieu
              de la surface qu'on peint. */}
          {zone && !arrivee && (
            <>
              <div
                className={[
                  "pointer-events-none absolute border",
                  outil === "zone" ? "border-signal" : "border-contour",
                ].join(" ")}
                style={{
                  left: zone[0] * echelle,
                  top: zone[1] * echelle,
                  width: (zone[2] - zone[0] + 1) * echelle,
                  height: (zone[3] - zone[1] + 1) * echelle,
                }}
              />
              {/* La poignée de retaille, au coin bas-droit. **Un seul coin** :
                  quatre poignées sur un rectangle de trois centimètres se
                  chevaucheraient, et retailler par l'autre bout est le même
                  geste vu à l'envers — on le refait de l'autre côté. */}
              {outil === "zone" && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setGeste({
                      quoi: "retailler",
                      zone: [zone[0], zone[1], zone[0], zone[1]],
                    })
                  }}
                  onPointerMove={suivre}
                  onPointerUp={finir}
                  onPointerCancel={finir}
                  aria-label="Retailler la zone"
                  className="absolute h-2.5 w-2.5 cursor-nwse-resize bg-signal"
                  style={{
                    left: (zone[2] + 1) * echelle - 5,
                    top: (zone[3] + 1) * echelle - 5,
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* **Le sens et la largeur, et rien d'autre.** Deux réglages pour deux
            couches : la main fait la même chose des deux côtés — elle garde ou
            elle ôte, largement ou au pixel —, seule la surface sur laquelle elle
            le fait change. Deux jeux de réglages auraient demandé de les tenir
            d'accord pour un geste que la main ne distingue pas. */}
        {outil !== "zone" && !arrivee && (
          <div className="flex flex-wrap items-center gap-2">
            <Segments<string>
              papier
              valeurs={["garder", "ôter"] as const}
              valeur={garde ? "garder" : "ôter"}
              onChange={(quoi) => setGarde(quoi === "garder")}
            />
            <Segments<number>
              papier
              valeurs={RAYONS}
              valeur={rayon}
              onChange={setRayon}
              libelles={LARGEURS}
            />
          </div>
        )}

        {/* L'état de la couche qu'on tient, son annulation, et l'avant. **La même
            rangée trois fois** : ce que porte cette couche à gauche, le geste
            qui la vide à droite. « Chaque couche s'annule » (C4) n'est donc pas
            trois boutons à trouver, c'est le même à la même place. */}
        <div className="flex items-center gap-2">
          <span className="mesure text-[10px] text-encre-4">
            {outil === "zone"
              ? zone
                ? `zone ${zone[2] - zone[0] + 1} × ${zone[3] - zone[1] + 1} px`
                : "toute la case"
              : couche.length === 0
                ? outil === "retouche"
                  ? "aucune retouche"
                  : "aucun passage"
                : `${couche.length} passage${couche.length > 1 ? "s" : ""}`}
          </span>

          {/* **Tenir montre l'avant** (US-151). Absent tant que la main n'est
              passée nulle part : il n'y a pas de chose indisponible, il n'y a
              rien à comparer — la bascule de `+ personnage` et du geste du lot. */}
          {mainPosee && (
            <button
              type="button"
              onPointerDown={() => setAvant(true)}
              onPointerUp={() => setAvant(false)}
              onPointerLeave={() => setAvant(false)}
              onPointerCancel={() => setAvant(false)}
              aria-label="Voir le calque avant la main"
              title="maintenir pour voir le calque tel que la différence l'avait rendu — rien n'est changé, et rien n'est redemandé au fournisseur"
              className={[
                "mesure ml-auto px-1 text-[10px]",
                avant ? "text-signal" : "text-signal hover:opacity-70",
              ].join(" ")}
            >
              {avant ? "Avant" : "Avant ›"}
            </button>
          )}

          {/* **Revenir en arrière est un geste unique** (C3 pour la zone, C4
              pour les deux couches de la main). Absent quand il n'y a rien à
              retirer, pour la même raison qu'au-dessus. */}
          {(outil === "zone" ? zone !== null : couche.length > 0) && (
            <button
              type="button"
              onClick={() => {
                if (outil === "zone") return void poser(null)
                void affiner(outil, [])
              }}
              title={
                outil === "zone"
                  ? "la différence est de nouveau cherchée sur toute la case — rien n'est redemandé au fournisseur"
                  : "la couche est vidée d'un coup, l'autre ne bouge pas — rien n'est redemandé au fournisseur"
              }
              className={[
                "mesure px-1 text-[10px] text-signal hover:opacity-70",
                mainPosee ? "" : "ml-auto",
              ].join(" ")}
            >
              {outil === "zone"
                ? "Sans zone ›"
                : outil === "retouche"
                  ? "Sans retouche ›"
                  : "Sans passages ›"}
            </button>
          )}
        </div>

        <Mesures mesures={calque.calque} calque={difference !== null} />

        {/* **Le rejeu se pose sous les mesures, parce que c'est elles qu'il
            refait** (R5, US-173). Ce n'est pas un contrôle de la zone : la zone
            se rejoue déjà à chaque rendu, elle n'a rien à redemander. Ce qui
            est figé dans l'image, et seulement là, c'est l'alignement trouvé au
            dépliage — et l'échelle juste au-dessus est le chiffre qui en sort.
            Il ne se grise jamais faute de raison connue d'ici : la planche est
            sur le disque ou elle ne l'est pas, et c'est le serveur qui le sait.
            Un refus part donc dans la fente, comme partout ailleurs. */}
        <button
          type="button"
          disabled={rejeu}
          onClick={() => void recaler()}
          title="la planche payée est relue et l'alignement recalculé — aucune image n'est redemandée, et rien ne naît ni ne meurt"
          className="mesure self-start px-1 text-[10px] text-signal hover:opacity-70 disabled:text-encre-4"
        >
          {rejeu ? "Recalage…" : "Recaler depuis la planche ›"}
        </button>

        {/* **Une phrase par outil**, parce que le cadre est le même pour les
            trois et que rien d'autre ne dirait ce que la main est en train de
            faire. C'est la place de la ligne d'aide de C3, tenue par l'outil au
            lieu d'être écrite trois fois. */}
        <p className="mesure text-[10px] leading-4 text-encre-4">
          {outil === "zone" ? (
            <>
              Glisser trace une zone, la traîner la déplace, le coin la retaille.
              Hors d'elle, la différence est effacée.
            </>
          ) : outil === "affinage" ? (
            <>
              La main affine le masque : elle dit où la différence a le droit de
              garder ce qu'elle a trouvé. Elle part de la zone quand il y en a
              une, de toute la case sinon.
            </>
          ) : (
            <>
              La main retouche le calque lui-même : elle ôte ce qui est en trop,
              et <em>ramène ce que la différence n'a pas vu</em> — une pièce qui
              se substitue au corps au lieu de s'y ajouter.
            </>
          )}{" "}
          Rien de tout cela ne redemande d'image : le calque se recalcule sur
          place, et le journal du projet ne bouge pas. Le masque et la retouche
          sont deux couches séparées — reprendre l'une ne défait jamais l'autre.
        </p>

        <div className="mt-auto flex justify-end pt-2">
          <Bouton papier onClick={onFermer} enfants="Fermer" />
        </div>
      </div>
    </aside>
  )
}

/** Lequel des calques de cette case part dans le jeu, et les deux gestes qui
 *  en décident.
 *
 *  **La même rangée que la fiche de la galerie**, aux mêmes mots — *◤ favori*
 *  et *Supprimer*. Deux rangées différentes pour un même jugement auraient
 *  fait croire à deux jugements ; et le coin plein en cyan veut dire *favori*
 *  partout ailleurs dans le produit.
 *
 *  **La phrase au-dessus est la réponse, et elle passe avant les boutons.**
 *  Sans elle, une case à deux calques offrait deux gestes sans jamais dire
 *  lequel des deux gagnait déjà — ce qui est très exactement la question
 *  posée. */
function Jugement({
  asset,
  retenu,
  onSupprimer,
  onErreur,
}: {
  asset: Asset
  retenu: boolean
  onSupprimer?: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const basculerFavori = async () => {
    try {
      await api.favori([asset.identifiant], !asset.favori)
    } catch (erreur) {
      onErreur(erreur, "favori refusé")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Libelle papier>Ce qu'on garde</Libelle>
      <p className="mesure text-[10px] leading-4 text-encre-4">
        {retenu
          ? "c'est ce calque-ci qui part dans le jeu, et qui sert de référence à cette pièce."
          : "un autre calque de cette case part dans le jeu — le favori d'abord, sinon le plus récent. Marque celui-ci favori pour que ce soit lui."}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void basculerFavori()}
          title={
            asset.favori
              ? "retirer la marque — le plus récent redeviendrait celui qui part"
              : "c'est lui qui partira dans le jeu, même si un autre est fait après"
          }
          className={[
            "mesure h-[26px] rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
            asset.favori
              ? "border-signal bg-signal/13 text-signal"
              : "border-trait bg-carte text-encre-3 hover:bg-carte",
          ].join(" ")}
        >
          {asset.favori ? "◤ favori" : "favori"}
        </button>
        {onSupprimer && (
          <button
            type="button"
            onClick={onSupprimer}
            title="l'image part à la corbeille — le pied de l'écran propose de la rendre"
            className="mesure ml-auto h-[26px] px-1 text-[10px] text-encre-4 hover:text-echec"
          >
            {/* **« Cette image », et non « Supprimer » tout court.** La
                colonne de gauche du même écran porte déjà un *Supprimer* —
                celui de la chose entière —, et deux boutons du même nom sur
                un écran où l'un jette un personnage et l'autre une image
                auraient été un piège. */}
            Supprimer cette image
          </button>
        )}
      </div>
    </div>
  )
}

/** Les cinq mesures, et **aucune ne refuse** (US-147).
 *
 *  Un `<dl>` comme *Ce qui part* de l'atelier : le fait à gauche, le chiffre à
 *  droite, et rien entre les deux. **Aucun seuil, aucune couleur d'alarme** —
 *  `--echec` veut dire *ce qui échoue ou ce qui détruit*, et une pièce qui a
 *  repeint 4 % du corps n'échoue pas : elle est là, gardée, et c'est l'auteur
 *  qui décide. C'est la règle de la ressemblance de C2, appliquée une seconde
 *  fois. */
function Mesures({
  mesures,
  calque,
}: {
  mesures: MesuresCalque | null
  calque: boolean
}) {
  if (!mesures) return null
  const part = (valeur: number) => `${(valeur * 100).toFixed(1).replace(".", ",")} %`
  return (
    <section className="flex flex-col gap-1.5">
      <Libelle papier>Ce qui a bougé</Libelle>
      {/* **La dérive est nommée, pas devinée** (US-148). Quand l'échelle a fait
          renoncer au calque, la phrase le dit ici, à l'endroit même où l'on
          cherche pourquoi il n'y en a pas — et elle nomme le chiffre qui a
          décidé. */}
      {!calque && (
        <p className="mesure text-[10px] leading-4 text-encre-3">
          Aucun calque : le sujet est revenu à{" "}
          {mesures.echelle.toFixed(2).replace(".", ",")}× de la taille envoyée.
          Ce qui revient est gardé comme un corps habillé — il s'exporte, il ne
          s'empile pas.
        </p>
      )}
      <dl className="mesure flex flex-col gap-1 text-[10px]">
        <Ligne
          nom="silhouette retrouvée"
          valeur={part(mesures.silhouette)}
          pire={mesures.pire === "silhouette retrouvée"}
        />
        <Ligne
          nom="corps repeint"
          valeur={part(mesures.repeint)}
          pire={mesures.pire === "corps repeint"}
        />
        <Ligne nom="part ajoutée" valeur={part(mesures.ajout)} />
        <Ligne
          nom="échelle au retour"
          valeur={`${mesures.echelle.toFixed(2).replace(".", ",")}×`}
          pire={mesures.pire === "échelle au retour"}
        />
        <Ligne
          nom="objet ou poussière"
          valeur={part(mesures.compacite)}
          pire={mesures.pire === "objet ou poussière"}
        />
      </dl>
    </section>
  )
}

/** Une mesure, et **la plus défavorable se voit sans couleur ni glyphe neuf**
 *  (C4, US-152).
 *
 *  Elle monte d'un ton — `--texte-2` et `--texte` là où les autres sont en
 *  `--texte-3` et `--texte-2` : c'est le contraste qui la désigne, comme le
 *  compte plein d'une case. Pas `--echec`, qui dirait *ça a échoué* quand la
 *  phrase juste est *c'est par là qu'il faut commencer* ; pas un signe de plus
 *  non plus, le produit n'en ouvre pas. La marque est **redondante** avec le
 *  tri de la matrice, qui range ce qui reste à regarder sur ce même chiffre :
 *  ne pas la voir ne fait rien perdre. */
function Ligne({
  nom,
  valeur,
  pire = false,
}: {
  nom: string
  valeur: string
  pire?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3"
      title={
        pire
          ? "la plus défavorable des quatre — c'est elle qui met ce calque en tête de ce qui reste à regarder"
          : undefined
      }
    >
      <dt className={pire ? "text-encre-3" : "text-encre-4"}>{nom}</dt>
      <dd className={pire ? "text-encre" : "text-encre-3"}>{valeur}</dd>
    </div>
  )
}
