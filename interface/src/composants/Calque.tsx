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
  onFermer,
  onErreur,
}: {
  calque: Asset
  /** Le corps de **sa** pose — celui que la planche a envoyé. Absent quand
   *  l'image a quitté la bibliothèque : le calque se montre alors seul, ce qui
   *  est exactement ce qu'il est sur le disque. */
  corps: Asset | null
  pose: string
  piece: string
  onFermer: () => void
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
  const cadre = useRef<HTMLDivElement>(null)

  // Un calque changé ailleurs — un autre onglet, un recalcul — arrive par le
  // flux. Sans ça, le rectangle garderait celui d'avant et le réécrirait au
  // premier glissement.
  useEffect(() => {
    if (geste) return
    setZone((difference?.zone as Zone | undefined) ?? null)
  }, [calque.identifiant, difference?.zone?.join(","), geste])

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
      // dessin de la septième place.
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
  const source =
    avant && mainPosee
      ? api.avant(calque.identifiant, calque.empreinte)
      : sujetCalque.src

  return (
    <aside
      {...PANNEAU}
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord bg-fond-1"
    >
      <EnTetePanneau>
        {piece} · {pose}
      </EnTetePanneau>

      <div className="defile flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {/* **Les trois outils au-dessus du cadre**, parce qu'on choisit ce qu'on
            va faire avant de le faire. Ils ne paraissent que sur un calque : un
            corps habillé n'a ni masque ni retouche, et trois segments morts
            au-dessus de son image seraient du cadrage affiché. */}
        {difference && (
          <div className="flex flex-col gap-2">
            <Libelle>Ce que la main tient</Libelle>
            <Segments<Outil>
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
        <div
          ref={cadre}
          onPointerDown={commencer}
          onPointerMove={suivre}
          onPointerUp={finir}
          onPointerCancel={finir}
          role="application"
          aria-label={`Zone du calque ${piece} sur ${pose}`}
          className="damier relative shrink-0 cursor-crosshair touch-none select-none"
          style={{ width: CADRE, height: haut }}
        >
          {sujetCorps && (
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
          {trace && (
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
                stroke="var(--signal)"
                strokeWidth={(2 * rayon + 1) * echelle}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {/* **Le rectangle reste visible sous les trois outils, sa poignée
              non.** Il est la base dont la main part quand elle affine le masque
              (`masque_de`) : le cacher pendant qu'on l'affine aurait caché ce
              qu'on affine. La poignée, elle, appartient au geste de C3 — la
              laisser sous un pinceau aurait mis une cible de retaille au milieu
              de la surface qu'on peint. */}
          {zone && (
            <>
              <div
                className={[
                  "pointer-events-none absolute border",
                  outil === "zone" ? "border-signal" : "border-bord-fort",
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
        {outil !== "zone" && (
          <div className="flex flex-wrap items-center gap-2">
            <Segments<string>
              valeurs={["garder", "ôter"] as const}
              valeur={garde ? "garder" : "ôter"}
              onChange={(quoi) => setGarde(quoi === "garder")}
            />
            <Segments<number>
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
          <span className="mesure text-[10px] text-texte-3">
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
                avant ? "text-signal-clair" : "text-signal hover:text-signal-clair",
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
                "mesure px-1 text-[10px] text-signal hover:text-signal-clair",
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
          className="mesure self-start px-1 text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
        >
          {rejeu ? "Recalage…" : "Recaler depuis la planche ›"}
        </button>

        {/* **Une phrase par outil**, parce que le cadre est le même pour les
            trois et que rien d'autre ne dirait ce que la main est en train de
            faire. C'est la place de la ligne d'aide de C3, tenue par l'outil au
            lieu d'être écrite trois fois. */}
        <p className="mesure text-[10px] leading-4 text-texte-3">
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
          <Bouton onClick={onFermer} enfants="Fermer" />
        </div>
      </div>
    </aside>
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
      <Libelle>Ce qui a bougé</Libelle>
      {/* **La dérive est nommée, pas devinée** (US-148). Quand l'échelle a fait
          renoncer au calque, la phrase le dit ici, à l'endroit même où l'on
          cherche pourquoi il n'y en a pas — et elle nomme le chiffre qui a
          décidé. */}
      {!calque && (
        <p className="mesure text-[10px] leading-4 text-texte-2">
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
      <dt className={pire ? "text-texte-2" : "text-texte-3"}>{nom}</dt>
      <dd className={pire ? "text-texte" : "text-texte-2"}>{valeur}</dd>
    </div>
  )
}
