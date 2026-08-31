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
  PASSE_PAR_DEFAUT,
  RECETTE_VIDE,
  type Asset,
  type TachesDeLAsset,
  type Bords,
  type EtatTraitement,
  type Grille,
  type Passe,
  type Quantification,
  type Recadrage,
  type Recette,
  type Univers,
} from "../api"
import { Curseur, Libelle, Raison, Segments } from "./chassis"

/** Les cibles proposées. Reprises de `MySpriteAi`, où elles ont servi pour de
 *  vrai — 16 pour une tuile, 64 pour un sprite, 128 pour un décor. */
export const CIBLES = [16, 24, 32, 48, 64, 96, 128] as const

export const MOTEUR: Record<Passe["moteur"], string> = { bord: "bord", modele: "modèle" }

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
  recadrage: (r: Recadrage) => `marge ${r.marge} px`,
  grille: (g: Grille) => `${g.cible} px · ${g.occupation} %`,
  quantification: (q: Quantification) => `${q.couleurs} couleurs`,
  bords: (b: Bords) => `tache ${b.aire_min} px`,
}

export const defautGrille = (): Grille => ({
  cible: 64,
  occupation: 100,
  ancrage: "bas",
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
      <div className="min-w-0 flex-1">{children}</div>
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
}: Reglages & { BlocPasse: React.ComponentType<any> }) {
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

      {/* **Les poches de fond enfermées par le sujet.** Un détourage par
          tolérance de bord efface le fond qu'il atteint depuis les bords ; ce
          qu'il n'atteint pas reste — la lumière entre un bras et un torse, le
          trou d'une anse, l'intérieur d'un anneau. Parfois c'est du fond qu'on
          veut retirer, parfois de la matière qu'on veut garder : un cabochon de
          lanterne, un vitrail.

          **Le produit ne tranche pas.** Il les cercle, il les compte, et il
          n'en efface aucune de lui-même. */}
      {mesures && mesures.poches.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-bord pt-2">
          <Libelle aide="detourage.poches">
            {mesures.poches.length} poche{mesures.poches.length > 1 ? "s" : ""} de fond
            enfermée{mesures.poches.length > 1 ? "s" : ""}
          </Libelle>
          <ul className="flex flex-col">
            {mesures.poches.slice(0, 8).map((poche) => (
              <li
                key={poche.boite.join(",")}
                className="mesure flex h-[24px] items-center gap-2 text-[10px] text-texte-3"
              >
                <span
                  aria-hidden
                  style={{ background: poche.couleur }}
                  className="inline-block h-3 w-3 shrink-0 rounded-full border border-bord"
                />
                <span>{poche.aire} px</span>
                <span className="ml-auto">
                  {poche.boite[0]},{poche.boite[1]}
                </span>
              </li>
            ))}
          </ul>
          <Raison texte="le produit n'en efface aucune — c'est du fond, ou c'est de la matière, et lui ne peut pas le savoir" />
        </div>
      )}
    </div>
  )
}

export function PanneauRecadrage({ recette, regler, poser }: Reglages) {
  const boite = recette.recadrage?.boite ?? null
  return (
    <div className="flex flex-col gap-2">
      <Reglage libelle="marge" aide="recadrage.marge">
        <Curseur
          valeur={recette.recadrage?.marge ?? 0}
          min={0}
          max={64}
          unite=" px"
          onChange={(marge) =>
            regler({ ...recette, recadrage: { marge, boite } })
          }
          onFini={(marge) =>
            void poser({ ...recette, recadrage: { marge, boite } })
          }
        />
      </Reglage>

      {/* **Le rectangle posé à la main.** Le modèle le porte depuis T2 et aucun
          écran ne l'avait jamais montré : une image recadrée à la main gardait
          son rectangle sans qu'on puisse ni le lire ni le retirer. Il se pose
          sur l'image, dans la table — ici on lit ce qu'il vaut, et on le
          défait. */}
      <Reglage libelle="rectangle" aide="recadrage.boite">
        {boite ? (
          <div className="flex items-center gap-2">
            <span className="mesure text-[10px] text-texte-2">
              {boite[2] - boite[0] + 1}×{boite[3] - boite[1] + 1} à {boite[0]},{boite[1]}
            </span>
            <button
              type="button"
              onClick={() =>
                poser({
                  ...recette,
                  recadrage: { marge: recette.recadrage?.marge ?? 0, boite: null },
                })
              }
              className="mesure text-[10px] text-texte-3 hover:text-echec"
            >
              ×
            </button>
          </div>
        ) : (
          <Raison texte="aucun — glisse un rectangle sur l'image pour en poser un" />
        )}
      </Reglage>
    </div>
  )
}

export function PanneauGrille({ recette, regler, poser, mesures }: Reglages) {
  /** **Le curseur ne s'arrête que là où l'image change.** Quatre-vingt-onze
   *  positions pour une trentaine de tailles possibles : deux crans voisins
   *  rendaient la même image, et la main croyait régler quelque chose. */
  const crans = mesures?.crans_occupation ?? []
  /** Sur combien de pixels le curseur tombe, à la position où il est. C'est la
   *  même arithmétique que le serveur applique — cible × occupation —, et
   *  c'est elle qui décide de ce que la case contiendra vraiment. */
  const cote = Math.round(
    ((recette.grille?.cible ?? 64) * (recette.grille?.occupation ?? 100)) / 100,
  )
  return (
    <div className="flex flex-col gap-2">
      <Reglage libelle="cible" aide="grille.cible">
        <Segments
          valeurs={CIBLES}
          valeur={(recette.grille?.cible ?? 64) as (typeof CIBLES)[number]}
          onChange={(cible) =>
            poser({ ...recette, grille: { ...(recette.grille ?? defautGrille()), cible } })
          }
        />
      </Reglage>
      <Reglage libelle="occupation" aide="grille.occupation">
        <Curseur
          valeur={recette.grille?.occupation ?? 100}
          min={10}
          max={100}
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
      {/* **Et il dit sur combien de pixels il tombe.** Un pour cent n'est pas
          une mesure : ce que l'occupation décide est un nombre de pixels dans
          la case, et c'est ce nombre-là qu'on compare d'une image à l'autre. */}
      {crans.length > 0 && (
        <Raison
          texte={`${cote} px dans la case · ${crans.length} crans changent l'image, sur les 91 du curseur`}
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
