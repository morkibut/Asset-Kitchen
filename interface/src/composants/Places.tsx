// Les places de la recette — leurs réglages, et la mécanique qui les pose.
//
// **Écrit une fois, rendu à deux endroits.** Ces cinq panneaux vivaient dans la
// fiche de 380 px, seul endroit du produit où l'on retouchait. La V2.1 leur
// donne un écran à leur taille — une *table*, plein cadre, avec l'image en
// grand entre la table et ses sœurs — et la fiche continue de les montrer tant
// qu'elle les porte (E4 les lui retire). Deux copies auraient fini par proposer
// deux réglages pour la même place, et le premier qui aurait divergé serait
// celui que personne ne regarde.
//
// **Ce qui est ici, et ce qui n'y est pas.** Ici : le contenu d'une place, et
// la machine qui envoie une recette au serveur. Pas ici : la forme du cadre qui
// la porte — repliée dans un bloc de fiche, ou seule dans la colonne d'une
// table —, parce que c'est très exactement ce qui change entre les deux.

import { useEffect, useRef, useState } from "react"
import {
  api,
  CE_QUE_LA_METHODE_REND,
  CONTOUR_PAR_DEFAUT,
  MAIN_VIDE,
  PASSE_PAR_DEFAUT,
  RECETTE_VIDE,
  occupationMax,
  type Asset,
  type Contour,
  type GrilleDuModele,
  type Main,
  type MesuresDuFond,
  type Methode,
  type TachesDeLAsset,
  type Bords,
  type EtatTraitement,
  type Grille,
  type Passe,
  type Quantification,
  type Recadrage,
  type Recette,
  type Trait,
  type Univers,
} from "../api"
import {
  Curseur,
  EchantillonDeHauteur,
  Libelle,
  NomDuReglage,
  Raison,
  Segments,
} from "./chassis"

/** Les cibles proposées. Reprises de `MySpriteAi`, où elles ont servi pour de
 *  vrai — 16 pour une tuile, 64 pour un sprite, 128 pour un décor.
 *
 *  **Les neuf sont celles du domaine, et c'est une correction.** La table n'en
 *  acceptait que sept, 16 à 128 ; l'assistant de démarrage et l'univers en
 *  proposent neuf depuis le 30 août 2026, 8 et 256 compris
 *  (`atelier/domaine/vue.py`, `TAILLES`). **Un jeu réglé sur 8 ou sur 256
 *  n'avait donc aucun outil pour appliquer sa propre taille** — le réglage du
 *  projet nommait une case que la table ne savait pas poser. Signalé par
 *  l'auteur le 31 août 2026, et déjà arbitré dans le croquis de l'écran
 *  (`docs/maquettes-v2.1/13-table-grille.html`, première annotation).
 *
 *  Les deux listes sont tenues ensemble par `tests/test_e8.py` : elles disent le
 *  même fait, et deux listes pour un fait finissent toujours par diverger — la
 *  divergence de sept contre neuf en est la preuve. */
// **512 est entré en D2**, avec le pixel art haute résolution que l'auteur a
//  demandé le 3 septembre 2026 : *« il faut ajouter le 256 et 512 pour le pixel
//  art haute résolution car c'est un style intéressant »*. Dix valeurs, donc, et
//  `tests/test_e8.py` tient toujours les deux listes ensemble.
export const CIBLES = [8, 16, 24, 32, 48, 64, 96, 128, 256, 512] as const

export const MOTEUR: Record<Passe["moteur"], string> = {
  bord: "bord",
  couleur: "pipette",
  modele: "modèle",
  trace: "sélection",
}

/** **Ce que chaque moteur ronge de bord sans que personne l'ait posé** (D1).
 *
 *  Comptée le 3 septembre 2026 sur les 123 passes de détourage écrites à la
 *  main dans ce dépôt : le bord laisse le durcissement à zéro 78 fois sur 100,
 *  la pipette ne le laisse jamais à zéro et y met 1 le plus souvent, le modèle
 *  ne le laisse jamais à zéro et y met 2 quatre fois sur cinq. À moteur égal, la
 *  nature de l'image ne décide presque plus rien — c'est le moteur qui décide.
 *
 *  La raison tient en une phrase : le bord **ne produit aucun pixel à demi
 *  transparent**, il est net par construction, donc il n'y a pas de frange à
 *  ronger ; le modèle en produit sur presque tout le sujet.
 *
 *  **La même table vit dans `atelier/domaine/recette.py`**, et les deux sont
 *  tenues ensemble par un essai — comme les crans de cible et le nom des
 *  moteurs avant elles. */
export const DURCISSEMENT_LIVRE: Record<Passe["moteur"], number> = {
  bord: 0,
  couleur: 1,
  modele: 2,
  trace: 0,
}

/** Ce qu'une place posée dit d'elle-même quand elle est repliée
 *  (`docs/design-motifs.md` § Le bloc repliable). Une ligne, en mono, à droite du
 *  titre — c'est ce qui permet de lire la recette entière sans rien ouvrir.
 *
 *  Le résumé est **la valeur, jamais le fait qu'il y en ait une** : « 2 passes »
 *  n'apprend rien de plus qu'un carré plein, alors que « bord · 28 » dit ce que
 *  l'image a subi. La seule exception est le pluriel, où la valeur ne tient
 *  plus : deux passes ont deux moteurs, et c'est le nombre qui devient le fait. */
export const RESUME = {
  detourage: (recette: Recette) =>
    recette.passes.length === 1
      ? `${MOTEUR[recette.passes[0].moteur]} · ${recette.passes[0].tolerance}`
      : `${recette.passes.length} passes`,
  /** **Ce qui agit, et rien d'autre** (U2). Un recadrage porte deux réglages
   *  indépendants — une boîte tracée, une marge —, et le résumé disait toujours
   *  la marge, y compris quand elle valait zéro à côté d'un rectangle qui,
   *  lui, coupait. Il dit maintenant ce qui change l'image, dans l'ordre où ça
   *  compte. */
  recadrage: (r: Recadrage) =>
    [
      r.boite ? `tracé ${r.boite[2] - r.boite[0] + 1}×${r.boite[3] - r.boite[1] + 1}` : null,
      r.marge > 0 ? `marge ${r.marge} px` : null,
    ]
      .filter(Boolean)
      .join(" · ") || `marge ${r.marge} px`,
  grille: (g: Grille) => `${g.cible} px · ${g.occupation} %`,
  quantification: (q: Quantification) => `${q.couleurs} couleurs`,
  bords: (b: Bords) => `tache ${b.aire_min} px`,
  contours: (c: Contour) => `${c.epaisseur} px · ${POSITIONS[c.position]}`,
  /** **Le compte des passages, pas celui des calques.** Trois calques vides ne
   *  changent rien à l'image, et le résumé d'une place dit ce que l'image a
   *  subi — c'est la même règle que « 2 passes » plutôt que « détourage ». */
  main: (m: Main) => {
    const passages = m.opacite.length + m.calques.reduce((n, c) => n + c.passages.length, 0)
    return `${passages} passage${passages > 1 ? "s" : ""}`
  },
}

export const POSITIONS: Record<Contour["position"], string> = {
  externe: "externe",
  interne: "interne",
  centre: "centré",
}

export const TROUS: Record<Contour["trous"], string> = {
  cercles: "cerclés",
  laisses: "laissés",
}

/** Ce qu'une position fait aux dimensions du rendu, en pixels et par côté.
 *
 *  **Écrit une fois, et c'est la même arithmétique que le serveur** : à cheval,
 *  la moitié qui ne tombe pas juste va vers l'extérieur — agrandir est
 *  réversible, manger le sujet ne l'est pas. Un second calcul écrit à l'écran
 *  aurait fini par annoncer autre chose que ce que l'image fait. */
export function debord(contour: Contour): number {
  if (contour.position === "interne") return 0
  if (contour.position === "centre") return Math.ceil(contour.epaisseur / 2)
  return contour.epaisseur
}

export const defautGrille = (): Grille => ({
  cible: 64,
  occupation: 100,
  ancrage: "bas",
  // **Zéro** (E17) : le décalage n'est écrit que par le calibrage, et une
  // recette qu'il n'a pas touchée rend exactement l'image d'avant.
  decalage: 0,
  // **`proche` et non le défaut du produit** (D2). Ceci complète une recette
  // qui n'avait pas de grille du tout ; le vote en deux temps est ce qu'un
  // *projet neuf* met dans ses recettes, et il arrive alors du serveur. Écrire
  // le défaut du produit ici changerait l'image d'une recette ancienne au
  // premier réglage posé, sans que personne l'ait demandé.
  methode: "proche",
})

// ── La machine qui pose une recette ─────────────────────────────────────────

/**
 * Tenir la recette d'une image, et l'envoyer au serveur.
 *
 * **Deux gestes, pas un.** `regler` bouge la valeur à l'écran et ne demande
 * rien ; `poser` l'envoie. Un segment fait les deux d'un coup — c'est un choix,
 * il part. Un curseur ne pose qu'au relâchement : la valeur suit la main, le
 * rendu suit la main lâchée.
 *
 * **L'attente s'apprend au lieu d'être écrite.** Mesuré au navigateur le 27 août
 * 2026 : un cran de tolérance coûte 1 492 ms, le moteur modèle 2 255, là où
 * l'occupation en coûte 29. Le serveur ne publie pas de durée attendue pour une
 * retouche comme il le fait pour une génération ; on garde donc ce que la
 * dernière du même genre a mis, sur cette machine et sur cette image.
 */
export function useRecette(asset: Asset, onErreur: (raison: string) => void) {
  const [recette, setRecette] = useState<Recette>(asset.recette)
  const attentes = useRef({ detourage: 1.5, queue: 0.05 })
  const envoyee = useRef<Recette>(asset.recette)
  const envols = useRef(0)
  const [enVol, setEnVol] = useState<{ depuis: number; attendue: number } | null>(null)

  // Changer d'image remet la recette sur celle-là. Sans ça, l'écran garderait
  // les réglages de la précédente et on croirait les avoir posés.
  //
  // **Sur l'identifiant seul, jamais sur la recette.** Chaque retouche revient
  // par le flux d'événements ; se resynchroniser dessus ferait reculer un
  // curseur qu'on est en train de faire glisser, au rythme des allers-retours.
  // C'est l'écran qui mène la recette tant qu'il est ouvert, et le serveur qui
  // tranche quand il refuse — `poser` remet alors l'état d'avant.
  useEffect(() => {
    setRecette(asset.recette)
    envoyee.current = asset.recette
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])

  const regler = (suivante: Recette) => setRecette(suivante)

  const poser = async (suivante: Recette) => {
    setRecette(suivante)

    // Rien à envoyer si c'est déjà ce qui est posé — un relâchement de curseur
    // qui n'a rien déplacé. Le serveur sérialise les retouches : un appel pour
    // rien, c'est une seconde et demie de file pour rien.
    if (JSON.stringify(suivante) === JSON.stringify(envoyee.current)) return

    const lourde =
      JSON.stringify(suivante.passes) !== JSON.stringify(envoyee.current.passes)
    envoyee.current = suivante

    const depart = Date.now() / 1000
    envols.current += 1
    // La jauge garde le **premier** départ : le serveur sérialise, donc deux
    // retouches lancées coup sur coup sont une seule attente, pas deux.
    setEnVol(
      (deja) =>
        deja ?? {
          depuis: depart,
          attendue: lourde ? attentes.current.detourage : attentes.current.queue,
        },
    )

    try {
      await api.poserRecette(asset.identifiant, suivante)
      const mise = Date.now() / 1000 - depart
      attentes.current = lourde
        ? { ...attentes.current, detourage: mise }
        : { ...attentes.current, queue: mise }
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "retouche refusée")
      setRecette(asset.recette) // l'écran ne garde pas un réglage que le serveur refuse
      envoyee.current = asset.recette
    } finally {
      envols.current -= 1
      if (envols.current === 0) setEnVol(null)
    }
  }

  const revenirAuBrut = async () => {
    try {
      await api.revenirAuBrut(asset.identifiant)
      setRecette(RECETTE_VIDE)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "retour au brut refusé")
    }
  }

  return { recette, setRecette, regler, poser, revenirAuBrut, enVol }
}

// ── Ce qu'une place contient ────────────────────────────────────────────────

export type Reglages = {
  recette: Recette
  univers: Univers
  traitement: EtatTraitement
  regler: (recette: Recette) => void
  poser: (recette: Recette) => void
  /** Ce que le serveur a mesuré sur cette image — les taches, les poches, les
   *  crans d'occupation. `null` tant qu'il n'a pas répondu : une place se rend
   *  sans, et se tait alors sur ce qu'elle ne sait pas encore. */
  mesures: TachesDeLAsset | null
}

/**
 * Demander au serveur ce qu'une table a besoin de savoir de l'image.
 *
 * **Une lecture à part de l'asset**, comme `impose` : un remplissage par plages
 * sur mille pixels de côté n'a rien à faire dans la charge que la grille relit
 * deux cents fois. Elle se redemande quand la recette **posée** change, parce
 * que c'est ce qui change les taches — pas à chaque cran de curseur.
 */
export function useMesures(asset: Asset) {
  const [mesures, setMesures] = useState<TachesDeLAsset | null>(null)
  useEffect(() => {
    let vivant = true
    setMesures(null)
    api
      .taches(asset.identifiant)
      .then((recu) => vivant && setMesures(recu))
      // Une image disparue pendant qu'on la regardait : il n'y a rien à dire de
      // plus ici qu'« on ne sait pas », et c'est ce que `null` veut dire.
      .catch(() => vivant && setMesures(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant, asset.empreinte])
  return mesures
}

/** Un réglage : son libellé à gauche, sa commande à droite. */
export function Reglage({
  libelle,
  aide,
  children,
}: {
  libelle: string
  aide?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-[104px] shrink-0">
        <Libelle aide={aide}>{libelle}</Libelle>
      </span>
      {/* **Le nom descend jusqu'au contrôle** (U3). Le champ où une valeur
          s'écrit a besoin d'un nom pour être trouvable, et ce nom est déjà
          écrit à gauche : le faire redire à chaque emploi aurait fabriqué
          autant d'occasions de le laisser diverger de ce qui s'affiche. */}
      <div className="min-w-0 flex-1">
        <NomDuReglage.Provider value={libelle}>{children}</NomDuReglage.Provider>
      </div>
    </div>
  )
}

export function PanneauDetourage({
  recette,
  traitement,
  regler,
  poser,
  mesures,
  BlocPasse,
  visee,
  onViser,
  promotion,
}: Reglages & {
  BlocPasse: React.ComponentType<any>
  /** **Le geste qui promeut ce détourage en défaut du projet** (M7), ou rien
   *  quand la place est rendue ailleurs qu'à sa table — dans la fiche, par
   *  exemple, qui n'a pas la largeur d'un choix de portée.
   *
   *  Rendu ici en nœud, comme la fabrique du découpage l'est dans les tables :
   *  le geste a besoin de la famille de l'image et du dossier du jeu, que ce
   *  panneau-ci n'a pas et n'a pas à apprendre. */
  promotion?: React.ReactNode
  /** Le rang de la passe qui attend son clic dans l'image, ou `null`.
   *
   *  **L'état vit au-dessus des deux colonnes**, dans l'écran des tables : la
   *  passe se règle à gauche et se vise au milieu, et un état tenu d'un seul
   *  côté aurait laissé l'autre l'ignorer. */
  visee?: number | null
  onViser?: (rang: number | null) => void
}) {
  const raisonModele =
    traitement.moteurs.find((m) => m.nom === "modele")?.raison ?? null
  return (
    <div className="flex flex-col gap-2">
      {recette.passes.map((passe, rang) => (
        <BlocPasse
          key={rang}
          rang={rang}
          passe={passe}
          raisonModele={raisonModele}
          silhouettes={traitement.silhouettes ?? []}
          visee={mesures?.visees?.[rang] ?? null}
          enVisee={visee === rang}
          onViser={(arme: boolean) => onViser?.(arme ? rang : null)}
          onChange={(suivante: Passe) =>
            regler({
              ...recette,
              passes: recette.passes.map((p, i) => (i === rang ? suivante : p)),
            })
          }
          onFini={(suivante: Passe) =>
            void poser({
              ...recette,
              passes: recette.passes.map((p, i) => (i === rang ? suivante : p)),
            })
          }
          onRetirer={
            recette.passes.length > 1
              ? () =>
                  poser({
                    ...recette,
                    passes: recette.passes.filter((_, i) => i !== rang),
                  })
              : undefined
          }
        />
      ))}
      <button
        type="button"
        onClick={() =>
          poser({ ...recette, passes: [...recette.passes, { ...PASSE_PAR_DEFAUT }] })
        }
        className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair"
      >
        + une passe
      </button>

      {/* **Le geste inverse, et il vient là où l'on voit ce qu'on promeut**
          (M7). L'étape des réglages du jeu demande ces mêmes valeurs *avant*
          d'avoir fabriqué la moindre image — on ne sait quel détourage convient
          qu'après en avoir vu quelques-unes. D'ici, on règle, on regarde, et
          l'on dit « garde ça ». L'étape devient la relecture de ce qu'on a
          promu, au lieu de l'endroit où l'on devine à froid. */}
      {promotion}

      {/* **Les poches de fond enfermées par le sujet.** Un détourage par
          tolérance de bord efface le fond qu'il atteint depuis les bords ; ce
          qu'il n'atteint pas reste — la lumière entre un bras et un torse, le
          trou d'une anse, l'intérieur d'un anneau. Parfois c'est du fond qu'on
          veut retirer, parfois de la matière qu'on veut garder : un cabochon de
          lanterne, un vitrail.

          **Le produit ne tranche pas.** Il les compte, il propose la plus
          grande, et il n'en efface aucune de lui-même — la proposition attend un
          clic, et le clic ne fait qu'armer la pipette sur elle.

          **Une liste est devenue une proposition** (E3, 31 août 2026). L'ancien
          bloc listait des poches qu'il n'avait jamais trouvées : il lisait les
          trous de la silhouette, qui sont l'inverse, et rendait zéro sur les
          soixante images du dépôt. La mesure juste, elle, en trouve quarante-
          trois par image en médiane — dont les trois quarts font un à trois
          pixels. Les lister toutes ferait une page de chiffres pour un geste qui
          vise une zone à la fois. */}
      {mesures && mesures.poches.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-bord pt-2">
          <Libelle aide="detourage.poches">
            {mesures.poches_total} poche{mesures.poches_total > 1 ? "s" : ""} de fond
            enfermée{mesures.poches_total > 1 ? "s" : ""}
          </Libelle>
          <Raison texte="du fond que le remplissage depuis le bord ne peut pas atteindre : il n'y mène aucun chemin, à aucune tolérance" />
          <ul className="flex flex-col">
            {mesures.poches.map((poche) => (
              <li
                key={poche.point.join(",")}
                className="mesure flex h-[24px] items-center gap-2 text-[10px] text-texte-3"
              >
                <span
                  aria-hidden
                  style={{ background: poche.couleur }}
                  className="inline-block h-3 w-3 shrink-0 rounded-full border border-bord"
                />
                <span>{poche.aire} px</span>
                {/* **Le geste, sur la ligne de ce qu'il vise.** Il ajoute une
                    passe pipette déjà visée sur un pixel *de la poche* — jamais
                    le centre de sa boîte, qui tombe dans le sujet dès que la
                    zone est courbe. Rien n'est effacé sans que la recette le
                    dise : c'est une passe comme une autre, qui s'annule. */}
                <button
                  type="button"
                  onClick={() =>
                    void poser({
                      ...recette,
                      passes: [
                        ...recette.passes,
                        {
                          ...PASSE_PAR_DEFAUT,
                          moteur: "couleur",
                          point: poche.point,
                        },
                      ],
                    })
                  }
                  className="ml-auto text-[10px] text-signal hover:text-signal-clair"
                >
                  la retirer ›
                </button>
              </li>
            ))}
          </ul>
          {mesures.poches_total > mesures.poches.length && (
            <Raison
              texte={`${mesures.poches_total - mesures.poches.length} plus petites, non listées — les plus grandes sont celles dont on se demande vraiment si c'est du fond`}
            />
          )}
          <Raison texte="le produit n'en efface aucune — c'est du fond, ou c'est de la matière, et lui ne peut pas le savoir" />
        </div>
      )}

      {mesures?.fond && <MesuresDuFondRendues mesures={mesures.fond} />}
    </div>
  )
}

/** **Les deux mesures d'acceptation du fond** (D3) — et ce qu'elles remplacent.
 *
 *  La tranche du fond exigeait huit tirages par branche avant sa première ligne
 *  de code. L'auteur l'a retiré le 2 septembre 2026 : *« pas besoin de tester
 *  ça »*. Ce qui prend la place du banc est plus utile que lui — **deux nombres
 *  lus sur les images qu'on voulait de toute façon**, ici, à côté du curseur qui
 *  les explique.
 *
 *  **Aucun des deux n'est un réglage**, comme les six autres mesures de cette
 *  table : ils décrivent ce que l'appel a rendu, et c'est l'auteur qui décide.
 *
 *  **La couleur affichée est celle qui est *revenue*, pas celle qu'on avait
 *  demandée** : c'est la seule qui réponde à la question qui compte, *le modèle
 *  a-t-il rendu le fond qu'on lui a demandé ?* Comparer la couleur demandée à
 *  elle-même n'aurait rien mesuré. */
function MesuresDuFondRendues({ mesures }: { mesures: MesuresDuFond }) {
  if (mesures.sujet === 0) return null
  // **Une virgule et non un point** — c'est ainsi que le produit écrit tous ses
  // nombres décimaux, prix compris. Vu au navigateur : un « 9.1 % » au milieu
  // d'une phrase française se remarque, et il se remarque comme une faute.
  const part = (mesures.part_collee * 100).toFixed(1).replace(".", ",")
  return (
    <div className="border-t border-bord pt-2">
      <Libelle aide="detourage.fond">Le fond, tel qu'il est revenu</Libelle>
      <div className="mt-1 flex items-center gap-2">
        <span
          title={mesures.fond}
          style={{ background: mesures.fond }}
          className="h-4 w-4 shrink-0 rounded-[2px] border border-bord"
        />
        <span className="mesure text-[10px] text-texte-2">{mesures.fond}</span>
      </div>
      {/* **Le pourtour est le dénominateur de la frange**, et il est dit avec
          elle : « 312 pixels à demi transparents » ne veut rien dire tant qu'on
          ne sait pas si le bord en fait 300 ou 30 000. */}
      <Raison
        texte={
          mesures.frange === 0
            ? `aucun pixel à demi transparent — le bord est franc sur ses ${mesures.bord} px de pourtour`
            : `${mesures.frange} px à demi transparents sur ${mesures.bord} px de pourtour — c'est ce qui fabrique un halo, et c'est ce que le bord rongé retire`
        }
      />
      {/* **La seconde mesure est le prix exact d'un fond mal choisi** : ces
          pixels-là sont ceux qu'un cran de tolérance de plus aurait mangés. Une
          couleur franche que rien dans le jeu ne contient les met à zéro. */}
      <Raison
        texte={
          mesures.colles === 0
            ? "aucun pixel du sujet n'est encore à la couleur du fond — le découpage n'a rien à manger de plus"
            : `${mesures.colles} px du sujet sont encore à la couleur du fond, soit ${part} % — un cran de tolérance de plus les emporterait ; un fond d'une couleur que le jeu ne contient pas les met à zéro`
        }
      />
    </div>
  )
}

/** Les côtés d'une image — **avec leur préposition**, parce que le français
 *  n'en met pas la même devant un bord et devant un côté : *en haut*, mais *à
 *  gauche*. Deux tables les nomment, et une seule liste évite d'écrire deux
 *  fois la même exception. */
const COTES: Record<string, string> = {
  haut: "en haut",
  bas: "en bas",
  gauche: "à gauche",
  droite: "à droite",
}

/** Le nom nu d'un bord, pour la phrase qui dit *le sujet touche le bord …*. */
const BORDS: Record<string, string> = {
  haut: "haut",
  bas: "bas",
  gauche: "gauche",
  droite: "droit",
}

export function PanneauRecadrage({ recette, regler, poser, mesures }: Reglages) {
  const boite = recette.recadrage?.boite ?? null
  const marge = recette.recadrage?.marge ?? 0
  const vu = mesures?.recadrage ?? null
  // **La marge est sans effet quand une case est posée**, et c'est mesuré, pas
  // supposé : la grille recherche elle-même la boîte du sujet et rogne dessus
  // avant de mettre à l'échelle, si bien que les pixels transparents gardés par
  // la marge disparaissent. Le même fichier à l'octet près, marge 0 comme
  // marge 40 — la mesure du 30 août 2026, dans
  // `docs/maquettes-v2.1/12-table-recadrage.html`.
  const margeSansEffet = recette.grille != null
  // Ce qu'on garde, écrit avec sa provenance : un constat n'est pas un réglage.
  const depart = boite ?? vu?.sujet ?? null
  return (
    <div className="flex flex-col gap-2">
      {/* ── Ce qu'on garde ────────────────────────────────────────────────
          **Deux valeurs, pas une case à cocher.** *La boîte du sujet* est le
          calcul — remesurée chaque fois que le détourage change. *Une boîte
          tracée* est un rectangle qu'on a posé soi-même, et qui ne bouge plus.
          La seconde ne se choisit pas ici : **on trace, et le segment
          bascule**. Le premier segment est donc le clic qui défait. */}
      <Reglage libelle="ce qu'on garde" aide="recadrage.boite">
        <Segments
          valeurs={["sujet", "tracee"] as const}
          valeur={boite ? "tracee" : "sujet"}
          libelles={{ sujet: "la boîte du sujet", tracee: "une boîte tracée" }}
          // Il n'y a pas de geste pour *devenir* tracée depuis la colonne : on
          // trace sur l'image. Le segment est donc indisponible tant qu'aucun
          // rectangle n'existe, avec sa raison sous lui.
          indisponibles={boite ? [] : (["tracee"] as const)}
          plusieursRangees
          onChange={(quoi) => {
            if (quoi === "sujet" && boite)
              void poser({ ...recette, recadrage: { marge, boite: null } })
          }}
        />
      </Reglage>

      {/* **Les coordonnées sont écrites, avec leur provenance.** *mesurée sur
          l'alpha* dit que ce n'est pas un réglage qu'on a posé : c'est un
          constat. C'est la règle du dépôt — *ce qui est devinable est prérempli
          avec sa provenance* — appliquée à un rectangle plutôt qu'à un texte. */}
      {depart && vu && (
        <p
          data-coordonnees-recadrage
          className={`mesure text-[10px] leading-4 ${boite ? "text-texte-2" : "text-epingle"}`}
        >
          {boite ? "tracée à la main" : "mesurée sur l'alpha"} · {depart[0]},
          {depart[1]} → {depart[2]},{depart[3]}
        </p>
      )}
      {/* **La part jetée est la mesure utile de cette table.** Elle dit d'un
          coup quelle part du fichier ne contient pas le sujet — et c'est ce qui
          explique qu'un sprite paraisse flou après la grille : un sujet qui
          n'occupait qu'un quart du fichier a peu de pixels à donner. */}
      {vu?.obtenue && (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          {vu.origine[0]}×{vu.origine[1]} →{" "}
          <span className="text-texte-2">
            {vu.obtenue[2] - vu.obtenue[0] + 1}×{vu.obtenue[3] - vu.obtenue[1] + 1}
          </span>{" "}
          · <span className="text-texte-2">{Math.round(vu.jete * 100)} %</span> de
          l'image d'origine est jeté
        </p>
      )}
      {/* **Une boîte n'agit que quand elle coupe le sujet.** La phrase
          importante de la table : plus large que lui, elle est sans effet sur
          le rendu — la grille recherche la boîte du sujet et rogne dessus. La
          dire évite de croire qu'on a réglé quelque chose. */}
      {boite && vu && (
        <Raison
          texte={
            Object.keys(vu.coupe).length === 0
              ? "plus large que le sujet · sans effet sur le rendu"
              : `coupe le sujet · ${Object.entries(vu.coupe)
                  .map(([cote, px]) => `${px} px ${COTES[cote] ?? cote}`)
                  .join(", ")}`
          }
        />
      )}

      <Reglage libelle="marge" aide="recadrage.marge">
        <Curseur
          valeur={marge}
          min={0}
          max={64}
          unite=" px"
          onChange={(prochaine) =>
            regler({ ...recette, recadrage: { marge: prochaine, boite } })
          }
          // **Régler la marge n'efface plus la boîte.** L'écran d'avant la
          // réécrivait à vide à chaque cran du curseur ; comme rien n'écrivait
          // jamais de boîte, ça ne se voyait pas. Dès que la table sait tracer,
          // ça se verrait tout de suite : on trace un cadrage, on ajuste la
          // marge, le cadrage disparaît.
          onFini={(prochaine) =>
            void poser({ ...recette, recadrage: { marge: prochaine, boite } })
          }
        />
      </Reglage>
      {/* **Grisée avec sa raison, comme un contrôle indisponible.** Le réglage
          n'est pas absent, il est sans effet ici — et ce qui donne l'air autour
          du sujet quand une case est posée, c'est l'occupation, qui s'exprime
          en part de la case là où la marge s'exprime en pixels de l'image
          d'origine. Douze pixels ne veulent pas dire la même chose sur une
          image de 512 et sur une de 2048 ; dix pour cent, si. */}
      {margeSansEffet && (
        <Raison texte="la grille est posée : c'est l'occupation qui donne l'air autour du sujet" />
      )}
      {/* **Ce que la table a vu, et qui n'est pas un réglage.** Le sujet touche
          un bord de l'image d'origine : le modèle l'a peint coupé, et la marge
          vaudra zéro de ce côté-là. Aucune autre table ne le mesure, et rien ne
          se répare ici — il faut regénérer. */}
      {vu && vu.bords.length > 0 && (
        <Raison
          texte={`le sujet touche le bord ${vu.bords
            .map((b) => BORDS[b] ?? b)
            .join(" et le bord ")} de l'image d'origine — le modèle l'a peint contre le bord`}
        />
      )}
    </div>
  )
}

/** Ce que la grille retrouvée dit à l'auteur, en une phrase (D2).
 *
 *  **Deux états, et le second n'est pas une panne.** Quand la détection a
 *  trouvé, elle donne le pas et surtout ce qu'il vaut en carrés — parce que la
 *  taille se règle en carrés, jamais en pixels de l'image reçue, et qu'un pas
 *  seul obligerait l'auteur à faire la division lui-même. Quand elle renonce,
 *  elle rend **la phrase du serveur telle quelle** : c'est lui qui sait
 *  *pourquoi* il s'est tu, et réécrire ici une phrase générique ferait deux
 *  vérités sur le même refus.
 *
 *  Rien de tout cela ne remplit un réglage. La taille reste demandée et jamais
 *  déduite de l'image reçue (US-61) ; ce texte l'éclaire, il ne la pose pas. */
export function ceQueLeModeleAPeint(grille: GrilleDuModele): string {
  if (grille.raison !== null || grille.pas < 2) return grille.raison ?? ""
  return (
    `le modèle a peint des carrés de ${grille.pas} pixels : l'image en compte ` +
    `${grille.carres} de côté, et au-delà il n'y a plus de détail à récupérer`
  )
}

export function PanneauGrille({
  recette,
  regler,
  poser,
  mesures,
  traitement,
}: Reglages) {
  /** **Le curseur ne s'arrête que là où l'image change.** Quatre-vingt-onze
   *  positions pour une trentaine de tailles possibles : deux crans voisins
   *  rendaient la même image, et la main croyait régler quelque chose. */
  const crans = mesures?.crans_occupation ?? []
  const cible = recette.grille?.cible ?? 64
  const occupation = recette.grille?.occupation ?? 100
  /** **Le plafond vient du serveur quand il a parlé** (tranche des tailles) : il
   *  dépend de la case, et c'est lui qui refuse. L'écran sait le recalculer —
   *  il en a besoin avant la première mesure —, mais il ne l'invente pas quand
   *  la réponse est là. */
  const plafond = mesures?.hauteur?.max ?? occupationMax(cible)
  /** **Ce que cette machine-ci sait faire**, dit par le serveur (D2). On ne
   *  propose que les méthodes installées ; les autres sont annoncées sous les
   *  segments avec leur raison, jamais offertes puis refusées au clic. */
  const reductions = traitement.reductions.filter((r) => r.raison === null)
  const indisponibles = traitement.reductions.filter((r) => r.raison !== null)
  const methode = recette.grille?.methode ?? "proche"
  const libelleDe = (nom: Methode) =>
    traitement.reductions.find((r) => r.nom === nom)?.libelle ?? nom
  return (
    <div className="flex flex-col gap-2">
      {/* **Sur quoi on travaille, avant de régler quoi que ce soit** (D2). La
          table portait quatre réglages et ne disait jamais ce que le modèle
          avait rendu : un dessin peint sur des carrés de 8 pixels ne rendra
          jamais 128 carrés propres, et rien à l'écran ne le disait. La mesure
          se place **au-dessus** de la taille, parce que c'est elle qui
          l'éclaire — et elle ne la remplit pas : la taille est demandée,
          jamais déduite de l'image reçue. Quand la détection renonce, elle le
          dit avec ses mots plutôt que d'inventer un pas, et le réglage
          juste en dessous est alors la seule réponse — celle de l'auteur. */}
      {mesures?.grille_du_modele && (
        <div className="flex flex-col gap-1">
          <Libelle aide="grille.du-modele">les carrés du modèle</Libelle>
          <Raison texte={ceQueLeModeleAPeint(mesures.grille_du_modele)} />
        </div>
      )}
      <Reglage libelle="cible" aide="grille.cible">
        <Segments
          // Neuf valeurs ne tiennent pas sur la largeur de la colonne, et
          // aucune taille de segment ne les y ferait tenir : la suite passe à
          // la ligne plutôt que de pousser le panneau à défiler de côté.
          plusieursRangees
          valeurs={CIBLES}
          valeur={(recette.grille?.cible ?? 64) as (typeof CIBLES)[number]}
          onChange={(cible) =>
            poser({ ...recette, grille: { ...(recette.grille ?? defautGrille()), cible } })
          }
        />
      </Reglage>
      <Reglage libelle="hauteur" aide="grille.occupation">
        <Curseur
          valeur={occupation}
          min={10}
          max={plafond}
          crans={crans.length > 0 ? crans : undefined}
          unite=" %"
          onChange={(occupation) =>
            regler({
              ...recette,
              grille: { ...(recette.grille ?? defautGrille()), occupation },
            })
          }
          onFini={(occupation) =>
            void poser({
              ...recette,
              grille: { ...(recette.grille ?? defautGrille()), occupation },
            })
          }
        />
      </Reglage>
      {/* **L'échantillon, et non plus un pour cent seul** (tranche des tailles).
          Un pour cent n'est pas une mesure : ce que la hauteur décide est un
          nombre de carrés, et c'est celui-là qu'on compare d'une image à
          l'autre. Depuis que le réglage peut dépasser le personnage, il faut de
          surcroît voir *de combien* — le dessin le montre, le texte le compte. */}
      <EchantillonDeHauteur occupation={occupation} cible={cible} haut={64} />
      {crans.length > 0 && (
        <Raison
          texte={`${crans.length} crans changent l'image, sur les ${plafond - 10 + 1} du curseur`}
        />
      )}
      <Reglage libelle="ancrage" aide="grille.ancrage">
        <Segments
          valeurs={["bas", "centre"] as const}
          valeur={recette.grille?.ancrage ?? "bas"}
          onChange={(ancrage) =>
            poser({
              ...recette,
              grille: { ...(recette.grille ?? defautGrille()), ancrage },
            })
          }
        />
      </Reglage>
      {/* **La façon de réduire, image par image** (D2). Le projet donne le
          départ ; ici on en change pour *cette* image, parce que les quatre
          méthodes rendent des sprites franchement différents et que le choix
          est un parti pris de style, pas un classement. */}
      <Reglage libelle="réduction" aide="grille.methode">
        <Segments
          plusieursRangees
          valeurs={reductions.map((r) => r.libelle)}
          valeur={libelleDe(methode)}
          onChange={(libelle) => {
            const choisie = reductions.find((r) => r.libelle === libelle)
            if (!choisie) return
            poser({
              ...recette,
              grille: { ...(recette.grille ?? defautGrille()), methode: choisie.nom },
            })
          }}
        />
      </Reglage>
      {/* **Ce que cette méthode-là rend**, en une ligne. Un libellé de trois
          mots ne dit pas ce qu'on gagne et ce qu'on perd, et c'est précisément
          ce qui départage les quatre. */}
      <Raison texte={CE_QUE_LA_METHODE_REND[methode]} />
      {/* **Grisée avec sa raison, jamais proposée puis refusée.** « Traits
          épaissis » tire une bibliothèque lourde ; absente, elle ne figure pas
          dans les segments, et on dit pourquoi plutôt que de la taire. */}
      {indisponibles.map((r) => (
        <Raison key={r.nom} texte={r.raison ?? ""} />
      ))}
    </div>
  )
}

export function PanneauQuantification({ recette, univers, poser }: Reglages) {
  const q = recette.quantification
  /** **Deux sources de couleurs, et le modèle les portait déjà.** Une palette
   *  vide veut dire *déduite de l'image elle-même* — le domaine le dit depuis
   *  T2, et aucun écran ne l'avait jamais proposé : la fiche reposait toujours
   *  celle du projet. Les deux régimes donnent des images différentes, et
   *  choisir entre eux était impossible sans passer par le modèle. */
  const surLImage = q !== null && q.palette.length === 0
  return (
    <div className="flex flex-col gap-2">
      <Reglage libelle="couleurs de" aide="quantification.palette">
        <Segments
          valeurs={["le jeu", "l'image"] as const}
          valeur={surLImage ? "l'image" : "le jeu"}
          indisponibles={univers.palette.length === 0 ? ["le jeu"] : []}
          onChange={(source) =>
            poser({
              ...recette,
              quantification: {
                couleurs: q?.couleurs ?? univers.couleurs,
                palette: source === "l'image" ? [] : univers.palette,
                tramage: q?.tramage ?? "aucun",
              },
            })
          }
        />
      </Reglage>
      {univers.palette.length === 0 && (
        <Raison texte="ce jeu n'a pas de palette — l'univers en déduit une des artworks officiels" />
      )}
      {univers.palette.length > 0 && !surLImage && (
        <Reglage libelle="palette du jeu">
          <div className="flex flex-wrap gap-[2px]">
            {univers.palette.map((couleur) => (
              <span
                key={couleur}
                title={couleur}
                style={{ background: couleur }}
                className="h-4 w-4 rounded-[2px] border border-bord"
              />
            ))}
          </div>
        </Reglage>
      )}
      <Reglage libelle="couleurs" aide="quantification.couleurs">
        <Segments
          valeurs={[4, 8, 16, 32, 64] as const}
          valeur={(q?.couleurs ?? 32) as 4 | 8 | 16 | 32 | 64}
          onChange={(couleurs) =>
            poser({
              ...recette,
              quantification: {
                couleurs,
                palette: q?.palette ?? univers.palette,
                tramage: q?.tramage ?? "aucun",
              },
            })
          }
        />
      </Reglage>
      {/* **Le tramage**, porté par le modèle depuis T2 et jamais montré. Il
          décide de ce qu'on voit d'un dégradé réduit à seize couleurs : sans
          lui les aplats se posent en bandes, avec lui ils se mêlent. */}
      <Reglage libelle="tramage" aide="quantification.tramage">
        <Segments
          valeurs={["aucun", "floyd"] as const}
          valeur={(q?.tramage ?? "aucun") as "aucun" | "floyd"}
          onChange={(tramage) =>
            poser({
              ...recette,
              quantification: {
                couleurs: q?.couleurs ?? univers.couleurs,
                palette: q?.palette ?? univers.palette,
                tramage,
              },
            })
          }
        />
      </Reglage>
    </div>
  )
}

// ── La couleur, proposée et jamais imposée ──────────────────────────────────

/**
 * La palette du projet en rangée, et un champ libre à côté.
 *
 * **La règle du produit tient en une ligne** : *la palette est imposée par la
 * quantification, qui ramène chaque pixel sur la couleur la plus proche ; elle
 * est proposée partout ailleurs, où une couleur hors palette se marque au lieu
 * d'être refusée* (US-210). Les deux places de E5 sont *après* la
 * quantification : ce qu'elles posent ne sera pas rattrapé, et c'est
 * précisément ce qui mérite d'être dit plutôt que refusé.
 */
function ChoixDeCouleur({
  couleur,
  palette,
  onChange,
}: {
  couleur: string
  palette: string[]
  onChange: (couleur: string) => void
}) {
  const dedans = palette.some((c) => c.toLowerCase() === couleur.toLowerCase())
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(couleur) ? couleur : "#000000"}
          aria-label="Couleur"
          onChange={(e) => onChange(e.target.value)}
          className="h-[26px] w-[34px] shrink-0 rounded-[2px] border border-bord bg-fond-2"
        />
        <input
          type="text"
          value={couleur}
          aria-label="Couleur, en hexadécimal"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte"
        />
      </div>
      {palette.length > 0 && (
        <div className="flex flex-wrap gap-[2px]">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Prendre ${c}`}
              onClick={() => onChange(c)}
              style={{ background: c }}
              className={[
                "h-4 w-4 rounded-[2px] border",
                c.toLowerCase() === couleur.toLowerCase()
                  ? "border-lumiere"
                  : "border-bord",
              ].join(" ")}
            />
          ))}
        </div>
      )}
      {/* **Le produit constate ; il ne refuse pas.** Une couleur de plus dans
          un jeu est un fait qui se lit, et il mérite d'être dit ici puisque la
          quantification est déjà passée et ne la rattrapera pas. */}
      {palette.length > 0 && (
        <span
          className={["mesure text-[10px]", dedans ? "text-texte-3" : "text-epingle"].join(
            " ",
          )}
        >
          {couleur} · {dedans ? "dans la palette" : "hors palette"}
        </span>
      )}
    </div>
  )
}

/** La plus sombre de la palette du projet — ce que la table propose à
 *  l'ouverture, et la seule chose qu'elle devine. */
export function laPlusSombre(palette: string[]): string | null {
  if (palette.length === 0) return null
  const clarte = (hexa: string) => {
    const n = parseInt(hexa.replace("#", ""), 16)
    if (Number.isNaN(n)) return 255
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114
  }
  return palette.reduce((a, b) => (clarte(b) < clarte(a) ? b : a))
}

/** **Dans quelle unité l'épaisseur du trait se compte** (D4) — et il y en a deux.
 *
 *  Une fois la case du projet posée, l'image rendue *est* la case : un pixel y
 *  est un bloc du sprite, et le trait était déjà juste. **Sans case**, l'image
 *  fait encore mille pixels de côté, un trait d'un pixel y est un cheveu
 *  invisible, et il ne longe pas la frontière du sprite mais les dentelures que
 *  le modèle a peintes à l'intérieur d'un bloc. Le trait se pose alors sur la
 *  maille que le modèle a employée, quand la mesure la trouve.
 *
 *  **Et quand elle se tait, c'est une peinture** : il n'y a pas de maille, la
 *  seule frontière est celle de l'image telle qu'elle est, et la phrase le dit
 *  au lieu de promettre une grille qui n'existe pas.
 */
export function uniteDuTrait(
  epaisseur: number,
  recette: Recette,
  mesures?: TachesDeLAsset | null,
): string {
  // **Une place endormie est sautée, et la question posée ici est *agit-elle ?*
  // et non *est-elle écrite ?*** C'est la même lecture que le serveur fait dans
  // `queue` ; une seconde façon de la poser aurait fini par répondre autrement.
  const surCase = recette.grille !== null && !(recette.veille ?? []).includes("grille")
  if (surCase) {
    return `${epaisseur} px de l'image rendue — celle qui part dans le jeu`
  }
  const pas = mesures?.grille_du_modele?.pas ?? 0
  if (pas > 1) {
    return `${epaisseur} bloc${epaisseur > 1 ? "s" : ""} de ${pas} px — la maille sur laquelle le modèle a peint, pas les pixels du fichier`
  }
  return `${epaisseur} px de l'image telle qu'elle est — aucune case posée, et le modèle n'a peint aucune grille où caler le trait`
}

export function PanneauContours({ recette, univers, poser, regler, mesures }: Reglages) {
  const contour = recette.contours ?? {
    ...CONTOUR_PAR_DEFAUT,
    couleur: laPlusSombre(univers.palette) ?? CONTOUR_PAR_DEFAUT.couleur,
  }
  const pose = (suivant: Contour) => void poser({ ...recette, contours: suivant })
  const croissance = debord(contour) * 2

  /** Les taches que le trait va longer — **celles que les bords laissent**.
   *  La mesure est prise avant le nettoyage, qui vient juste avant : ce que le
   *  seuil efface ne recevra pas de trait, et l'écran le retranche plutôt que
   *  de faire redescendre l'image une seconde fois. */
  const seuil = recette.bords?.aire_min ?? 0
  const contournees = (mesures?.taches ?? []).filter((t) => t.aire >= seuil)
  // **Les trous, pas les poches** — les deux sont exactement inverses, et le
  // contour lit bien celui-ci : un trou de silhouette est du transparent que le
  // sujet entoure, et c'est lui que le trait longe ou pas.
  const trous = mesures?.trous ?? []

  return (
    <div className="flex flex-col gap-2">
      <Reglage libelle="épaisseur" aide="contours.epaisseur">
        <Curseur
          valeur={contour.epaisseur}
          min={1}
          max={8}
          unite=" px"
          onChange={(epaisseur) =>
            regler({ ...recette, contours: { ...contour, epaisseur } })
          }
          onFini={(epaisseur) => pose({ ...contour, epaisseur })}
        />
      </Reglage>
      {/* **Le chiffre et son jumeau.** Un nombre seul demanderait « de
          quoi ? » : l'épaisseur se compte dans l'image rendue, et c'est elle
          qui part dans le jeu.
          **Et depuis D4, l'unité peut ne pas être le pixel** : sans case posée,
          l'image fait encore mille pixels de côté et un trait d'un pixel y est
          un cheveu invisible. Le trait se pose alors sur la maille du modèle, et
          l'écran dit laquelle plutôt que de laisser deviner. */}
      <Raison texte={uniteDuTrait(contour.epaisseur, recette, mesures)} />
      {/* **La forme du pinceau, dite au moment du choix** (D4). Les deux ont
          raison à des épaisseurs différentes, et rien à l'écran ne le disait :
          la croix à un pixel — le carré poserait des pixels en diagonale des
          coins —, le carré au-dessus, parce qu'une croix répétée donne un
          losange visible aux quatre coins d'un sprite. */}
      <Raison
        texte={
          contour.epaisseur <= 1
            ? "en croix, la convention du pixel art à une épaisseur — le carré poserait des pixels en diagonale des coins"
            : "en carré, au-delà d'une épaisseur — une croix répétée donnerait un losange"
        }
      />

      <Reglage libelle="couleur" aide="contours.couleur">
        <ChoixDeCouleur
          couleur={contour.couleur}
          palette={univers.palette}
          onChange={(couleur) => pose({ ...contour, couleur })}
        />
      </Reglage>
      {recette.contours === null && univers.palette.length > 0 && (
        <span className="mesure text-[10px] text-epingle">
          proposé, d'après ta palette · la plus sombre
        </span>
      )}

      <Reglage libelle="position" aide="contours.position">
        <Segments
          valeurs={["externe", "interne", "centre"] as const}
          valeur={contour.position}
          libelles={POSITIONS}
          onChange={(position) => pose({ ...contour, position })}
        />
      </Reglage>
      {/* **Le seul réglage du produit qui change les dimensions du rendu sans
          qu'on le lui ait demandé** (US-206) — donc il le dit, au moment où on
          choisit, et avec le vrai chiffre. À cheval sur une épaisseur impaire,
          le pixel qui ne tombe pas juste va dehors : la croissance vaut alors
          un de plus que l'épaisseur, et l'annoncer autrement serait faux. */}
      <Raison
        texte={
          croissance === 0
            ? "la boîte ne bouge pas — le sujet est mangé de l'épaisseur"
            : `la silhouette grandit de ${croissance} px sur chaque dimension`
        }
      />

      <Reglage libelle="les trous" aide="contours.trous">
        <Segments
          valeurs={["cercles", "laisses"] as const}
          valeur={contour.trous}
          libelles={TROUS}
          onChange={(trous) => pose({ ...contour, trous })}
        />
      </Reglage>
      {trous.length > 0 && (
        <Raison
          texte={`${trous.length} trou${trous.length > 1 ? "s" : ""} dans la silhouette · le plus petit fait ${Math.min(
            ...trous.map((t) => t.aire),
          )} px`}
        />
      )}

      {/* **Il n'y a pas d'aire minimale ici, et c'est écrit.** La table des
          bords existe pour retirer les miettes, elle est juste avant dans
          l'ordre, et deux réglages qui font la même chose à deux endroits
          finissent par se contredire. Ce que cette table fait à la place,
          c'est le dire — un compte qui surprend envoie dans les bords. */}
      {contournees.length > 0 && (
        <div className="border-t border-bord pt-2">
          <Libelle aide="contours.taches">
            {contournees.length} tache{contournees.length > 1 ? "s" : ""} contournée
            {contournees.length > 1 ? "s" : ""}
          </Libelle>
          {/* **« La plus petite » d'une seule n'est pas une mesure**, c'est une
              tournure. À une tache, la phrase dit sa taille ; au-delà, elle dit
              celle de la plus petite — qui est le nombre qui décide. */}
          <Raison
            texte={
              contournees.length === 1
                ? `elle fait ${contournees[0].aire} px`
                : `la plus petite fait ${Math.min(
                    ...contournees.map((t) => t.aire),
                  )} px — un compte qui surprend se règle dans la table des bords`
            }
          />
        </div>
      )}
    </div>
  )
}

export function PanneauBords({ recette, regler, poser, mesures }: Reglages) {
  const seuil = recette.bords?.aire_min ?? 3
  const liste = mesures?.taches ?? []
  const partent = liste.filter((t) => t.aire < seuil).length
  return (
    <div className="flex flex-col gap-2">
      <Reglage libelle="tache minimale" aide="bords.aire_min">
        <Curseur
          valeur={seuil}
          min={0}
          max={64}
          unite=" px"
          onChange={(aire_min) => regler({ ...recette, bords: { aire_min } })}
          onFini={(aire_min) => void poser({ ...recette, bords: { aire_min } })}
        />
      </Reglage>

      {/* **La liste de ce qui va partir, triée du plus petit au plus grand, et
          coupée là où le seuil tombe.** L'ordre est la moitié de la réponse :
          le nettoyage efface *en dessous d'un seuil*, donc ce qu'on veut lire
          d'abord est ce qui partira en premier. Le trait dit où le curseur est
          posé — au-dessus ce qui s'efface, au-dessous ce qui reste. */}
      {liste.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-bord pt-2">
          <Libelle aide="bords.taches">
            {partent} tache{partent > 1 ? "s" : ""} effacée{partent > 1 ? "s" : ""} sur{" "}
            {liste.length}
          </Libelle>
          <ul className="flex flex-col">
            {liste.map((tache, rang) => {
              const part = tache.aire < seuil
              const dernierEfface =
                part && liste[rang + 1] !== undefined && liste[rang + 1].aire >= seuil
              return (
                <li
                  key={tache.boite.join(",")}
                  className={[
                    "mesure flex h-[24px] items-center gap-2 text-[10px]",
                    part ? "text-texte-2" : "text-texte-3",
                    dernierEfface ? "border-b border-signal" : "",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    style={{ background: tache.couleur }}
                    className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-bord"
                  />
                  <span>{tache.aire} px</span>
                  <span className="ml-auto">
                    {tache.boite[0]},{tache.boite[1]}
                  </span>
                </li>
              )
            })}
          </ul>
          {mesures && mesures.coupees > 0 && (
            <Raison
              texte={`${mesures.coupees} taches de plus, non listées — la liste sert à regarder`}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── La main — la septième et dernière place ─────────────────────────────────
//
// **C'est la seule table du produit qui ne pose pas une règle.** Les six autres
// appliquent quelque chose à toute l'image ; celle-ci ne fait que ce que
// l'auteur désigne. Elle est aussi la seule qui grandira — un mode manuel n'a
// pas de fin naturelle —, et trois décisions d'aujourd'hui gardent la porte
// ouverte : un passage est un vecteur, la couleur est portée par le passage, et
// l'opacité est un calque de la pile plutôt qu'un mode à part.

/** Le sol de la pile. **Il ne se supprime pas et ne se déplace pas** — c'est
 *  vrai par construction, puisqu'il n'est pas dans la liste. */
export const OPACITE = -1

export const mainDe = (recette: Recette): Main => recette.main ?? MAIN_VIDE

/** Ce que la pile change, tous calques confondus. */
export const passagesDe = (main: Main): number =>
  main.opacite.length + main.calques.reduce((n, c) => n + c.passages.length, 0)

/** Le rayon d'un diamètre. **C'est le diamètre qui s'affiche** — la largeur du
 *  trait est ce que la main voit, le rayon est ce que le calcul veut — et il
 *  n'est qu'impair, parce qu'un pinceau a un centre. */
export const rayonDe = (diametre: number): number => Math.max(0, (diametre - 1) / 2)

/** Poser un passage sur la couche active, ou en retirer le dernier.
 *
 *  **Écrites ici, appelées par le panneau et par la surface** : la table et
 *  l'image font le même geste vu de deux endroits, et deux compositions
 *  écrites séparément auraient fini par ranger le passage à deux places. */
export function avecPassage(main: Main, actif: number, trait: Trait): Main {
  if (actif === OPACITE) return { ...main, opacite: [...main.opacite, trait] }
  return {
    ...main,
    calques: main.calques.map((c, i) =>
      i === actif ? { ...c, passages: [...c.passages, trait] } : c,
    ),
  }
}

export function sansLeDernier(main: Main, actif: number): Main {
  if (actif === OPACITE) return { ...main, opacite: main.opacite.slice(0, -1) }
  return {
    ...main,
    calques: main.calques.map((c, i) =>
      i === actif ? { ...c, passages: c.passages.slice(0, -1) } : c,
    ),
  }
}

/** Ce que l'écran tient de la main, et que la recette n'a pas à porter.
 *
 *  Le calque actif, le sens du geste, le diamètre et la couleur ne décrivent
 *  pas l'image : ils décrivent la **main**. Les écrire dans la recette les
 *  aurait fait entrer dans l'empreinte, donc changer de pinceau aurait
 *  recalculé un rendu identique.
 */
export type EtatMain = ReturnType<typeof useEtatMain>

export function useEtatMain(univers: Univers) {
  const [actif, choisir] = useState<number>(OPACITE)
  const [sens, setSens] = useState(true)
  const [diametre, setDiametre] = useState(5)
  const [couleur, setCouleur] = useState(univers.palette[0] ?? "#ffffff")
  return { actif, choisir, sens, setSens, diametre, setDiametre, couleur, setCouleur }
}

/** Une rangée de la pile. Le calque actif porte l'anneau `--lumiere` — la
 *  sélection du produit, jamais une seconde marque. */
function RangeeDeCalque({
  nom,
  passages,
  visible,
  actif,
  pixels,
  onChoisir,
  onVisible,
  onNommer,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  nom: string
  passages: number
  visible: boolean
  actif: boolean
  pixels: number | null
  onChoisir: () => void
  onVisible?: () => void
  onNommer?: (nom: string) => void
  onMonter?: () => void
  onDescendre?: () => void
  onSupprimer?: () => void
}) {
  return (
    <li
      className={[
        "flex h-[26px] items-center gap-2 rounded-[2px] border px-1",
        actif ? "border-lumiere bg-fond-3" : "border-transparent hover:bg-fond-2",
      ].join(" ")}
    >
      {/* Le carré plein à gauche est la visibilité ; **masquer un calque
          n'efface rien**, et c'est très exactement la différence entre masquer
          et supprimer. */}
      <button
        type="button"
        aria-label={visible ? `Masquer ${nom}` : `Montrer ${nom}`}
        aria-pressed={visible}
        disabled={!onVisible}
        onClick={onVisible}
        className={[
          "h-[9px] w-[9px] shrink-0",
          visible ? "bg-signal" : "border border-texte-3",
        ].join(" ")}
      />
      {onNommer ? (
        <input
          value={nom}
          aria-label={`Nom du calque ${nom}`}
          onFocus={onChoisir}
          onChange={(e) => onNommer(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[11.5px] text-texte outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onChoisir}
          className="min-w-0 flex-1 text-left text-[11.5px] text-texte"
        >
          {nom}
        </button>
      )}
      <button
        type="button"
        onClick={onChoisir}
        aria-label={`Choisir ${nom}`}
        className="mesure shrink-0 text-[10px] text-texte-3"
      >
        {pixels === null ? passages : `${passages} · ${pixels} px`}
      </button>
      {onMonter && (
        <button
          type="button"
          aria-label={`Monter ${nom}`}
          onClick={onMonter}
          className="mesure h-[24px] shrink-0 px-1 text-[10px] text-texte-3 hover:text-signal"
        >
          ↑
        </button>
      )}
      {onDescendre && (
        <button
          type="button"
          aria-label={`Descendre ${nom}`}
          onClick={onDescendre}
          className="mesure h-[24px] shrink-0 px-1 text-[10px] text-texte-3 hover:text-signal"
        >
          ↓
        </button>
      )}
      {onSupprimer && (
        <button
          type="button"
          aria-label={`Supprimer ${nom}`}
          onClick={onSupprimer}
          className="mesure h-[24px] shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
        >
          ×
        </button>
      )}
    </li>
  )
}

export function PanneauMain({
  recette,
  univers,
  poser,
  regler,
  mesures,
  etat,
}: Reglages & { etat: EtatMain }) {
  const main = mainDe(recette)
  const { actif, choisir, sens, setSens, diametre, setDiametre, couleur, setCouleur } =
    etat
  const pose = (suivante: Main) => void poser({ ...recette, main: suivante })

  const surLOpacite = actif === OPACITE
  const calqueActif = surLOpacite ? null : main.calques[actif]
  const passagesActifs = surLOpacite
    ? main.opacite.length
    : (calqueActif?.passages.length ?? 0)
  const dernier = surLOpacite
    ? main.opacite[main.opacite.length - 1]
    : calqueActif?.passages[(calqueActif?.passages.length ?? 0) - 1]

  const pixels = (rang: number): number | null => {
    if (!mesures?.main) return null
    return rang === OPACITE ? mesures.main.opacite : (mesures.main.calques[rang] ?? 0)
  }

  const deplacer = (rang: number, vers: number) => {
    const calques = [...main.calques]
    const [pris] = calques.splice(rang, 1)
    calques.splice(vers, 0, pris)
    choisir(vers)
    pose({ ...main, calques })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* **La raison du grisé du comparateur, et elle vit ici.** La bande de
          38 px n'a pas la place d'une phrase.

          **Elle a fondu de trois grisés à un.** Elle en expliquait trois : le
          brut et les deux comparaisons, au motif que *côte à côte* met deux
          images à l'écran et que la main n'aurait pas su sur laquelle elle
          écrit. L'argument tombe avec la scène qui l'a créé — le témoin ne
          porte plus rien, il est cerclé ou il ne prend pas le pointeur. Ne
          reste que le brut, et pour une autre raison : le pinceau écrit sur le
          résultat. */}
      <Raison texte="la main se pose sur le rendu — le brut s'éteint dans le comparateur, et « Avant › » le rend le temps d'un appui" />

      {/* **La pile se lit du dessus au dessous**, comme partout où il y a des
          calques — et elle est *rangée* du dessous vers le dessus, qui est
          l'ordre d'application. Le renversement est écrit ici, et nulle part
          ailleurs. */}
      <div className="flex flex-col gap-1">
        <Libelle aide="main.calques">les calques</Libelle>
        <ul className="flex flex-col">
          {main.calques
            .map((calque, rang) => ({ calque, rang }))
            .reverse()
            .map(({ calque, rang }) => (
              <RangeeDeCalque
                key={rang}
                nom={calque.nom || `calque ${rang + 1}`}
                passages={calque.passages.length}
                visible={calque.visible}
                actif={actif === rang}
                pixels={pixels(rang)}
                onChoisir={() => choisir(rang)}
                onVisible={() =>
                  pose({
                    ...main,
                    calques: main.calques.map((c, i) =>
                      i === rang ? { ...c, visible: !c.visible } : c,
                    ),
                  })
                }
                onNommer={(nom) =>
                  regler({
                    ...recette,
                    main: {
                      ...main,
                      calques: main.calques.map((c, i) => (i === rang ? { ...c, nom } : c)),
                    },
                  })
                }
                onMonter={
                  rang < main.calques.length - 1 ? () => deplacer(rang, rang + 1) : undefined
                }
                onDescendre={rang > 0 ? () => deplacer(rang, rang - 1) : undefined}
                onSupprimer={() => {
                  choisir(OPACITE)
                  pose({ ...main, calques: main.calques.filter((_, i) => i !== rang) })
                }}
              />
            ))}
          <RangeeDeCalque
            nom="l'opacité"
            passages={main.opacite.length}
            visible
            actif={surLOpacite}
            pixels={pixels(OPACITE)}
            onChoisir={() => choisir(OPACITE)}
          />
        </ul>
        <Raison texte="« l'opacité » est le sol de la pile : elle ne se supprime pas et ne se déplace pas" />
        <button
          type="button"
          onClick={() => {
            choisir(main.calques.length)
            pose({
              ...main,
              calques: [
                ...main.calques,
                { nom: `calque ${main.calques.length + 1}`, visible: true, passages: [] },
              ],
            })
          }}
          className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair"
        >
          + calque de dessin
        </button>
      </div>

      {/* **Les deux segments changent de nom avec le calque actif.** C'est la
          même mécanique — un passage qui ajoute, un passage qui retire — et le
          segment allumé dit ce que le geste fera. */}
      <Reglage libelle="le sens" aide="main.sens">
        <Segments
          valeurs={["ajoute", "retire"] as const}
          valeur={sens ? "ajoute" : "retire"}
          libelles={
            surLOpacite
              ? { ajoute: "remettre", retire: "ôter" }
              : { ajoute: "poser", retire: "effacer" }
          }
          onChange={(v) => setSens(v === "ajoute")}
        />
      </Reglage>

      <Reglage libelle="le pinceau" aide="main.diametre">
        <Curseur
          valeur={diametre}
          min={1}
          max={129}
          pas={2}
          unite=" px"
          onChange={setDiametre}
        />
      </Reglage>
      {/* **Le cran 1 px est le pixel** : un rayon nul ne couvre qu'un pixel de
          large, et c'est l'autre bout de « à main levée, puis au pixel ». */}
      <Raison
        texte={
          diametre === 1
            ? "1 px — c'est le pixel, l'autre bout du geste à main levée"
            : `${diametre} px du rendu · impairs seulement, un pinceau a un centre`
        }
      />

      {!surLOpacite && (
        <Reglage libelle="la couleur" aide="main.couleur">
          <ChoixDeCouleur
            couleur={couleur}
            palette={univers.palette}
            onChange={setCouleur}
          />
        </Reglage>
      )}
      {surLOpacite && (
        <Raison texte="l'opacité ne pose aucune couleur : elle décide de ce qui est là" />
      )}

      {/* **Il n'y a pas de liste de passages, et c'est la seule table dans ce
          cas.** Un geste à main levée en produit des dizaines : trente rangées
          ne se relisent pas, elles se subissent. Le calque est l'unité de
          lecture ; le passage n'existe que comme un compte et un Ctrl+Z. */}
      <div className="flex flex-col gap-1 border-t border-bord pt-2">
        <Libelle aide="main.passages">le calque actif</Libelle>
        <span className="mesure text-[10px] text-texte-2">
          {surLOpacite ? "l'opacité" : calqueActif?.nom || "calque"} · {passagesActifs}{" "}
          passage{passagesActifs > 1 ? "s" : ""}
        </span>
        {/* Sans cette ligne, défaire est un pari. */}
        {dernier && (
          <span className="mesure text-[10px] text-texte-3">
            dernier : {dernier.garde ? (surLOpacite ? "remettre" : "poser") : surLOpacite ? "ôter" : "effacer"} ·{" "}
            {2 * dernier.rayon + 1} px{dernier.couleur ? ` · ${dernier.couleur}` : ""}
          </span>
        )}
        <button
          type="button"
          disabled={passagesActifs === 0}
          onClick={() => pose(sansLeDernier(main, actif))}
          className="mesure h-6 self-start text-[10px] text-texte-3 hover:text-signal disabled:text-texte-3"
        >
          Défaire le dernier · Ctrl + Z
        </button>
      </div>

      <Raison
        texte={`${main.calques.length} calque${main.calques.length > 1 ? "s" : ""} · ${passagesDe(main)} passage${passagesDe(main) > 1 ? "s" : ""}`}
      />
    </div>
  )
}
