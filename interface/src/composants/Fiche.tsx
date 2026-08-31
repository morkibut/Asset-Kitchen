// La fiche — 380 px, la quatrième colonne de `docs/DESIGN.md` § Layout.
//
// « La fiche asset est un panneau latéral, pas une page. Une page ferait perdre
// la grille et le prompt ; fermer le panneau remet exactement où l'on était. »
//
// Elle s'est ouverte en T2 avec ce que T2 possédait : la visionneuse, la
// recette, le retour au brut. T3 y ajoute ce que la bibliothèque rend possible
// — le jugement (favori, suppression), la filiation, et la réinjection dans ses
// quatre rôles. Aucune rubrique n'y est arrivée vide : montrer du cadrage au
// lieu de servir le geste est le reproche qui a fait écarter
// `docs/maquette-atelier.html`.

import { useEffect, useRef, useState } from "react"
import {
  api,
  dollars,
  PASSE_PAR_DEFAUT,
  RECETTE_VIDE,
  ROLES,
  type Asset,
  type Bords,
  type EtatTraitement,
  type Filiation,
  type Grille,
  type Impose,
  type Passe,
  type Personnage,
  type Pose,
  type Quantification,
  type Recadrage,
  type Recette,
  type Role,
  type Univers,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import {
  Bloc,
  Bouton,
  Curseur,
  EnTetePanneau,
  Etape,
  Jauge,
  Libelle,
  Raison,
  Segments,
} from "./chassis"
import { PANNEAU, POINTILLE, useInfobulle } from "./Infobulle"
import { posesTenues } from "./Personnages"

/** Les cibles proposées. Reprises de `MySpriteAi`, où elles ont servi pour de
 *  vrai — 16 pour une tuile, 64 pour un sprite, 128 pour un décor. La valeur
 *  n'est jamais déduite de l'image reçue (US-61) : elle se choisit ici, et
 *  deviendra une propriété du projet en T4. */
const CIBLES = [16, 24, 32, 48, 64, 96, 128] as const

const MOTEUR: Record<Passe["moteur"], string> = { bord: "bord", modele: "modèle" }

/** Le modèle qui a produit une image, tel qu'il se lit (US-123).
 *
 *  **Trois cas, et le troisième n'est pas un trou.** Une image générée nomme le
 *  modèle exact — l'identifiant du fournisseur, celui qu'on redemandera ; une
 *  image importée n'a pas de modèle et le dit ; et une image dont la génération
 *  a disparu du disque ne peut plus le savoir. Elle ne l'invente pas : « zéro
 *  n'est pas une dimension mesurée, c'est l'absence de mesure »
 *  (`docs/PIEGES.md`), et un nom de modèle deviné vaudrait pire que rien —
 *  c'est très exactement l'information à qui l'on va faire confiance. */
export const nomDuModele = (modele: string): string =>
  modele === "import" ? "importé" : modele || "modèle inconnu"

/** Ce qu'une étape posée dit d'elle-même quand elle est repliée
 *  (`docs/design-motifs.md` § Le bloc repliable). Une ligne, en mono, à droite du
 *  titre — c'est ce qui permet de lire la recette entière sans rien ouvrir.
 *
 *  Le résumé est **la valeur, jamais le fait qu'il y en ait une** : « 2 passes »
 *  n'apprend rien de plus qu'un carré plein, alors que « bord · 28 » dit ce que
 *  l'image a subi. La seule exception est le pluriel, où la valeur ne tient
 *  plus : deux passes ont deux moteurs, et c'est le nombre qui devient le fait. */
const RESUME = {
  detourage: (recette: Recette) =>
    recette.passes.length === 1
      ? `${MOTEUR[recette.passes[0].moteur]} · ${recette.passes[0].tolerance}`
      : `${recette.passes.length} passes`,
  recadrage: (r: Recadrage) => `marge ${r.marge} px`,
  grille: (g: Grille) => `${g.cible} px · ${g.occupation} %`,
  quantification: (q: Quantification) => `${q.couleurs} couleurs`,
  bords: (b: Bords) => `tache ${b.aire_min} px`,
}

export function Fiche({
  asset,
  traitement,
  univers,
  plan,
  personnages,
  onFermer,
  onErreur,
  onReinjecter,
  onReglages,
  onSupprimer,
  onDecouper,
  onOuvrir,
}: {
  asset: Asset
  traitement: EtatTraitement
  /** Le plan du jeu et ses personnages, pour désigner cette image comme le
   *  corps d'une case (US-122). **Il n'y a pas d'écran de création de
   *  personnage avec son propre prompt** : le corps naît dans l'atelier, et
   *  c'est ici — sur l'image obtenue — qu'on dit ce qu'il est. */
  plan: Pose[]
  personnages: Personnage[]
  /** L'univers du projet ouvert. La fiche n'y touche pas — elle le lit pour
   *  savoir sur quelle palette quantifier, et pour proposer de réaligner un
   *  asset que l'auteur avait réglé à la main (US-69). */
  univers: Univers
  onFermer: () => void
  onErreur: (raison: string) => void
  /** Renvoyer cette image au générateur, dans l'un des trois rôles qui portent
   *  une image (US-12). */
  onReinjecter: (role: Role) => void
  /** Le quatrième rôle : reprendre les réglages de la génération qui a produit
   *  cet asset. Aucune image ne part — c'est le générateur qu'on repeuple. */
  onReglages: () => void
  onSupprimer: () => void
  /** Ouvrir l'écran de découpe sur cette image (US-72). **Un écran, pas une
   *  rubrique de plus ici** : on dessine des rectangles sur une planche de
   *  mille pixels, et cette colonne en fait 380. */
  onDecouper: () => void
  /** Remonter ou descendre la filiation sans quitter le panneau. */
  onOuvrir: (identifiant: string) => void
}) {
  const [recette, setRecette] = useState<Recette>(asset.recette)
  const [montrerBrut, setMontrerBrut] = useState(false)
  const [nom, setNom] = useState("")
  /** Ce que le projet impose à **cette** image (US-164). Demandé au serveur —
   *  il est le seul à savoir sur quelle échelle l'image est née, et l'échelle
   *  décide de l'occupation. `null` tant qu'il n'a pas répondu. */
  const [impose, setImpose] = useState<Impose | null>(null)

  // ── Ce qui est en vol, et ce que ça coûte ─────────────────────────────────
  //
  // « Chaque réglage répond sans attente perceptible » (critère T2) était vrai
  // de la queue de recette et faux du détourage : mesuré au navigateur le
  // 27 août 2026, un cran de tolérance coûte **1 492 ms**, le moteur modèle
  // 2 255, là où l'occupation en coûte 29. Une seconde et demie de rien, sur
  // une image qui ne change pas encore — c'est ce que la jauge dit.
  //
  // **L'attente s'apprend au lieu d'être écrite.** Le serveur ne publie pas de
  // durée attendue pour une retouche comme il le fait pour une génération ;
  // l'écran garde donc ce que la dernière du même genre a mis, sur cette
  // machine et sur cette image. Les deux valeurs de départ sont celles de la
  // mesure, et elles se corrigent au premier passage.
  const attentes = useRef({ detourage: 1.5, queue: 0.05 })
  const envoyee = useRef<Recette>(asset.recette)
  const envols = useRef(0)
  const [enVol, setEnVol] = useState<{ depuis: number; attendue: number } | null>(null)

  // Changer d'asset remet la fiche sur la recette de celui-là. Sans ça, le
  // panneau garderait les réglages du précédent et on croirait les avoir posés.
  //
  // **Sur l'identifiant seul, jamais sur la recette.** Chaque retouche revient
  // par le flux d'événements ; se resynchroniser dessus ferait reculer un
  // curseur qu'on est en train de faire glisser, au rythme des allers-retours.
  // C'est l'écran qui mène la recette tant que la fiche est ouverte, et le
  // serveur qui tranche quand il refuse — `poser` remet alors l'état d'avant.
  useEffect(() => {
    setRecette(asset.recette)
    envoyee.current = asset.recette
    setMontrerBrut(false)
    setNom("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])

  // ── Ce que le projet a imposé à cette image ───────────────────────────────
  //
  // « Je veux lire sur la fiche le traitement que le projet lui a imposé, afin
  // de comprendre pourquoi l'image affichée ne ressemble pas à celle qui est
  // arrivée du fournisseur » (US-164).
  //
  // **Une lecture à part de l'asset, et c'est la grille qui le décide** : la
  // charge d'un asset part deux cents fois par relecture de grille, celle-ci
  // une fois par fiche ouverte. Elle se redemande aussi quand l'univers bouge,
  // parce que la phrase est « ce que le projet impose *maintenant* » : une
  // taille de pixel changée dans l'autre onglet doit se lire ici sans qu'on
  // referme la fiche.
  useEffect(() => {
    let vivant = true
    setImpose(null)
    api
      .imposeSurAsset(asset.identifiant)
      .then((recu) => vivant && setImpose(recu))
      // Un asset disparu pendant qu'on le regardait : la fiche se ferme de son
      // côté, et il n'y a rien à dire de plus ici qu'« on ne sait pas ».
      .catch(() => vivant && setImpose(null))
    return () => {
      vivant = false
    }
  }, [asset.identifiant, univers])

  // ── Poser la recette ──────────────────────────────────────────────────────
  //
  // **Deux gestes, pas un.** `regler` bouge la valeur à l'écran et ne demande
  // rien ; `poser` l'envoie. Un segment fait les deux d'un coup — c'est un
  // choix, il part. Un curseur ne pose qu'au relâchement : la valeur suit la
  // main, le rendu suit la main lâchée.
  //
  // Le serveur garde le détourage entre deux réglages et ne refait que la queue
  // de la recette quand les passes n'ont pas bougé — c'est ce qui sépare 29 ms
  // de 1 492, et c'est aussi ce qui dit à la jauge quelle attente afficher.

  const regler = (suivante: Recette) => setRecette(suivante)

  const poser = async (suivante: Recette) => {
    setRecette(suivante)

    // Rien à envoyer si c'est déjà ce qui est posé — un relâchement de curseur
    // qui n'a rien déplacé, un `onKeyUp` sur une touche qui n'est pas une
    // flèche. Le serveur sérialise les retouches : un appel pour rien, c'est
    // une seconde et demie de file pour rien.
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

  const enregistrer = async () => {
    try {
      await api.nommerRecette(nom.trim(), recette)
      setNom("")
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "recette refusée")
    }
  }

  const raisonModele =
    traitement.moteurs.find((m) => m.nom === "modele")?.raison ?? null

  return (
    <aside
      {...PANNEAU}
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord bg-fond-1"
    >
      <EnTetePanneau>
        <span className="truncate">Fiche</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="ml-auto text-texte-3 transition-colors duration-[80ms] hover:text-texte"
        >
          ✕
        </button>
      </EnTetePanneau>

      {/* **La visionneuse ne défile pas.** C'est le sujet du panneau : on règle
          un détourage en regardant ce qu'il fait, et un curseur posé six cents
          pixels sous l'image obligeait à remonter à chaque cran pour voir ce
          qu'on venait de faire. Ce qui **bouge quand on règle** reste sous les
          yeux — l'image, la bascule rendu/brut, les dimensions ; ce qui ne
          bouge pas descend dans le défilement, à commencer par le sujet de la
          génération, qu'on lit une fois. `docs/design-motifs.md` § La visionneuse. */}
      <Visionneuse
        asset={asset}
        brut={montrerBrut}
        onBrut={setMontrerBrut}
        traite={!estVide(recette)}
        enVol={enVol}
      />

      <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        <p className="truncate text-[11.5px] text-texte-2" title={asset.label}>
          {asset.label}
        </p>

        {/* **Qui a dessiné cette image** (US-123). Une ligne de provenance, au
            même titre que le coût : elle se lit, elle ne se règle pas — donc
            aucun libellé, aucun pointillé, rien à survoler. L'identifiant
            exact plutôt que le nom du catalogue : c'est lui qu'on redemande, et
            il reste vrai quand le catalogue est hors ligne. */}
        <p className="mesure truncate text-[10px] text-texte-3" title={asset.modele}>
          {nomDuModele(asset.modele)}
        </p>

        <Jugement
          asset={asset}
          onErreur={onErreur}
          onReinjecter={onReinjecter}
          onReglages={onReglages}
          onSupprimer={onSupprimer}
          onDecouper={onDecouper}
        />

        <CaseDeLAsset
          asset={asset}
          plan={plan}
          personnages={personnages}
          onErreur={onErreur}
        />

        <Descendance asset={asset} onOuvrir={onOuvrir} onErreur={onErreur} />

        <ImposeParLeProjet impose={impose} recette={recette} />

        <div className="flex flex-col gap-2">
          {/* ── 1. Détourage ─────────────────────────────────────────────── */}
          <Etape
            cle="fiche.detourage"
            aide="etape.detourage"
            titre="Détourage"
            active={recette.passes.length > 0}
            etat={RESUME.detourage(recette)}
            onBasculer={() =>
              poser({
                ...recette,
                passes: recette.passes.length ? [] : [{ ...PASSE_PAR_DEFAUT }],
              })
            }
          >
            <div className="flex flex-col gap-2">
              {recette.passes.map((passe, rang) => (
                <BlocPasse
                  key={rang}
                  rang={rang}
                  passe={passe}
                  raisonModele={raisonModele}
                  onChange={(suivante) =>
                    regler({
                      ...recette,
                      passes: recette.passes.map((p, i) => (i === rang ? suivante : p)),
                    })
                  }
                  onFini={(suivante) =>
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
                  poser({
                    ...recette,
                    passes: [...recette.passes, { ...PASSE_PAR_DEFAUT }],
                  })
                }
                className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair"
              >
                + une passe
              </button>
            </div>
          </Etape>

          {/* ── 2. Recadrage ─────────────────────────────────────────────── */}
          <Etape
            cle="fiche.recadrage"
            aide="etape.recadrage"
            titre="Recadrage"
            active={recette.recadrage !== null}
            etat={recette.recadrage && RESUME.recadrage(recette.recadrage)}
            onBasculer={() =>
              poser({
                ...recette,
                recadrage: recette.recadrage ? null : { marge: 0, boite: null },
              })
            }
          >
            <Reglage libelle="marge" aide="recadrage.marge">
              <Curseur
                valeur={recette.recadrage?.marge ?? 0}
                min={0}
                max={64}
                unite=" px"
                onChange={(marge) =>
                  regler({ ...recette, recadrage: { marge, boite: null } })
                }
                onFini={(marge) =>
                  void poser({ ...recette, recadrage: { marge, boite: null } })
                }
              />
            </Reglage>
          </Etape>

          {/* ── 3. Grille ────────────────────────────────────────────────── */}
          <Etape
            cle="fiche.grille"
            aide="etape.grille"
            titre="Grille"
            active={recette.grille !== null}
            etat={recette.grille && RESUME.grille(recette.grille)}
            onBasculer={() =>
              poser({
                ...recette,
                grille: recette.grille
                  ? null
                  : { cible: 64, occupation: 100, ancrage: "bas" },
              })
            }
          >
            <div className="flex flex-col gap-2">
              <Reglage libelle="cible" aide="grille.cible">
                <Segments
                  valeurs={CIBLES}
                  valeur={(recette.grille?.cible ?? 64) as (typeof CIBLES)[number]}
                  onChange={(cible) =>
                    poser({
                      ...recette,
                      grille: { ...(recette.grille ?? defautGrille()), cible },
                    })
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
          </Etape>

          {/* ── 4. Quantification — branchée, et grisée avec sa raison ────── */}
          <Etape
            cle="fiche.quantification"
            aide="etape.quantification"
            titre="Quantification"
            active={recette.quantification !== null}
            etat={recette.quantification && RESUME.quantification(recette.quantification)}
            raison={traitement.quantification.raison}
            onBasculer={() =>
              poser({
                ...recette,
                quantification: recette.quantification
                  ? null
                  : {
                      couleurs: univers.couleurs,
                      // **La palette vient du projet, jamais d'ici.** Elle se
                      // déduit par calcul des artworks officiels (US-54) ; une
                      // palette vide veut dire « déduite de l'image
                      // elle-même », ce que le serveur refuse à l'écran. La
                      // reposer vide à chaque cran, comme le faisait T2, aurait
                      // fait tomber la quantification au premier réglage.
                      palette: univers.palette,
                      tramage: "aucun",
                    },
              })
            }
          >
            <div className="flex flex-col gap-2">
              {univers.palette.length > 0 && (
                <Reglage libelle="palette" aide="quantification.palette">
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
                  valeur={
                    (recette.quantification?.couleurs ?? 32) as 4 | 8 | 16 | 32 | 64
                  }
                  onChange={(couleurs) =>
                    poser({
                      ...recette,
                      quantification: {
                        couleurs,
                        palette:
                          recette.quantification?.palette ?? univers.palette,
                        tramage: recette.quantification?.tramage ?? "aucun",
                      },
                    })
                  }
                />
              </Reglage>
            </div>
          </Etape>

          {/* ── 5. Bords ─────────────────────────────────────────────────── */}
          <Etape
            cle="fiche.bords"
            aide="etape.bords"
            titre="Nettoyage des bords"
            active={recette.bords !== null}
            etat={recette.bords && RESUME.bords(recette.bords)}
            onBasculer={() =>
              poser({
                ...recette,
                bords: recette.bords ? null : { aire_min: 3 },
              })
            }
          >
            <Reglage libelle="tache minimale" aide="bords.aire_min">
              <Curseur
                valeur={recette.bords?.aire_min ?? 3}
                min={0}
                max={64}
                unite=" px"
                onChange={(aire_min) => regler({ ...recette, bords: { aire_min } })}
                onFini={(aire_min) => void poser({ ...recette, bords: { aire_min } })}
              />
            </Reglage>
          </Etape>
        </div>

        {/* ── Faire rentrer un épinglé dans le rang ──────────────────────
            « Je veux réaligner d'un geste, depuis sa fiche, un asset que
            j'avais réglé à la main » (US-69). La proposition ne paraît que sur
            un épinglé : sur les autres, elle dirait de faire ce qui est déjà
            fait. Elle ne coûte rien — aucun appel payant, aucun rendu recalculé
            avant qu'on le regarde. */}
        {asset.epingle && !univers.vide && (
          <div className="mt-4 flex flex-col gap-1 border-t border-bord pt-2">
            <p className="mesure flex items-center gap-1.5 text-[10px] leading-4 text-epingle">
              <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
              réglé à la main — un changement de palette le saute
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.realigner([asset.identifiant])
                } catch (erreur) {
                  onErreur(
                    erreur instanceof Error ? erreur.message : "réalignement refusé",
                  )
                }
              }}
              className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
            >
              Le remettre sur l'univers du projet ›
            </button>
          </div>
        )}

        {/* ── La recette elle-même ───────────────────────────────────────── */}
        <div className="mt-auto flex flex-col gap-2 border-t border-bord pt-2">
          {traitement.recettes.length > 0 && (
            <div className="flex flex-col gap-1">
              <Libelle aide="fiche.recettes">Recettes</Libelle>
              <div className="flex flex-wrap gap-1">
                {traitement.recettes.map((enregistree) => (
                  <button
                    key={enregistree}
                    type="button"
                    onClick={async () => {
                      try {
                        const suivant = await api.appliquerRecette(
                          asset.identifiant,
                          enregistree,
                        )
                        setRecette(suivant.recette)
                      } catch (erreur) {
                        onErreur(
                          erreur instanceof Error ? erreur.message : "recette refusée",
                        )
                      }
                    }}
                    className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte-2 hover:bg-fond-3"
                  >
                    {enregistree}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="nommer cette recette"
              className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
            />
            <Bouton
              inactif={!nom.trim() || estVide(recette)}
              onClick={enregistrer}
              enfants="Enregistrer"
            />
          </div>
          {estVide(recette) && nom.trim() !== "" && (
            <Raison texte="une recette vide n'a rien à rejouer" />
          )}

          <div className="flex items-center gap-2">
            <Bouton
              inactif={estVide(recette)}
              onClick={revenirAuBrut}
              enfants="Revenir au brut"
            />
            <a
              href={api.telechargementAsset(asset.identifiant, montrerBrut)}
              download
              className="mesure ml-auto text-[10px] text-signal hover:text-signal-clair"
            >
              PNG ↓
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Ce que le projet a imposé ───────────────────────────────────────────────

/** Le traitement que le projet a posé sur cette image, et ce que l'auteur a
 *  changé depuis (US-164).
 *
 *  **Le défaut que cette rubrique répare est un défaut de composition**, pas de
 *  code : « la dérive de grille est le cas normal » et « le style vient de la
 *  bible et d'un seul endroit » sont justes séparément, et leur composition
 *  produisait un atelier qui imposait une apparence que l'auteur n'avait jamais
 *  posée — sans jamais lui montrer laquelle. Trois lignes suffisent à le dire,
 *  et elles se lisent avant la recette, pas dedans : c'est le *pourquoi* de ce
 *  qui suit.
 *
 *  Elle ne se règle pas — elle se lit. Un bloc quand même, et repliable comme
 *  les cinq étapes : « un bloc replié ne se tait pas, il porte sa valeur »
 *  (`docs/DESIGN.md`), et une ligne d'état suffit alors à dire ce que le projet
 *  a fait. Aucun pointillé sur les valeurs : ce qui se règle est juste en
 *  dessous. */
function ImposeParLeProjet({
  impose,
  recette,
}: {
  impose: Impose | null
  /** La recette **à l'écran**, pas celle de l'asset : un curseur qu'on vient de
   *  lâcher doit faire basculer la ligne sur « réglé à la main » tout de suite,
   *  sans attendre le retour du flux. */
  recette: Recette
}) {
  // Tant que le serveur n'a pas répondu, la rubrique n'existe pas. Une rubrique
  // vide qui se remplit une demi-seconde plus tard fait sauter tout ce qui est
  // dessous — la recette entière, sur laquelle la main est déjà partie.
  if (impose === null) return null

  const pose = impose.impose

  if (pose === null)
    return (
      <Bloc
        cle="fiche.impose"
        aide="fiche.impose"
        titre="Imposé par le projet"
        etat="on ne sait pas"
        mesure="la génération n'est plus sur le disque"
      >
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Sa génération n'est plus sur le disque, et le produit ne devine pas :
          « rien d'imposé » serait une réponse différente, et fausse.
        </p>
      </Bloc>
    )

  const lignes: { quoi: string; valeur: string; main: boolean }[] = []

  lignes.push(
    pose.grille === null
      ? {
          quoi: "taille de pixel",
          valeur: "aucune",
          main: recette.grille !== null,
        }
      : {
          quoi: "taille de pixel",
          valeur: `${pose.grille.cible} px`,
          main: recette.grille?.cible !== pose.grille.cible,
        },
  )

  // **L'occupation ne se lit qu'avec sa nature de sujet à côté.** « 40 % » seul
  // n'explique rien ; « 40 % · objet tenu » dit d'où vient le chiffre et où le
  // changer — dans le barème du projet, pas ici.
  if (pose.grille !== null)
    lignes.push({
      quoi: "occupation",
      valeur:
        `${pose.grille.occupation} %` +
        (impose.echelle ? ` · ${impose.echelle}` : ""),
      main: recette.grille?.occupation !== pose.grille.occupation,
    })

  lignes.push(
    pose.quantification === null
      ? {
          quoi: "palette",
          valeur: "aucune",
          main: recette.quantification !== null,
        }
      : {
          quoi: "palette",
          valeur: `${pose.quantification.palette.length} couleurs`,
          main:
            recette.quantification === null ||
            recette.quantification.palette.join() !==
              pose.quantification.palette.join(),
        },
  )

  return (
    <Bloc
      cle="fiche.impose"
      aide="fiche.impose"
      titre="Imposé par le projet"
      /* Replié, le bloc porte les trois valeurs du projet — c'est ce qui permet
         de lire la fiche entière sans rien ouvrir. Ouvert, il garde sous les
         yeux ce que la lecture décide : combien de lignes ont été reprises à la
         main. */
      etat={lignes.map((l) => l.valeur.split(" · ")[0]).join(" · ")}
      mesure={
        lignes.some((l) => l.main)
          ? `${lignes.filter((l) => l.main).length} repris à la main`
          : "tout est appliqué"
      }
    >
      <ul className="flex flex-col gap-[3px]">
        {lignes.map((ligne) => (
          <li key={ligne.quoi} className="flex items-baseline gap-2">
            <span className="text-[11px] text-texte-2">{ligne.quoi}</span>
            <span className="mesure ml-auto text-[10px] text-texte">{ligne.valeur}</span>
            {/* **Le distinguo est la moitié de la rubrique** : sans lui, une
                valeur affichée ne dit pas si elle vient du projet ou de la main
                de l'auteur, et c'est exactement la question posée. Le token
                `epingle` est celui qui porte déjà « réglé à la main » plus bas
                dans cette même fiche. */}
            <span
              className={[
                "mesure w-[76px] shrink-0 text-right text-[9.5px]",
                ligne.main ? "text-epingle" : "text-texte-3",
              ].join(" ")}
            >
              {ligne.main ? "réglé à la main" : "appliqué"}
            </span>
          </li>
        ))}
      </ul>
    </Bloc>
  )
}

// ── Le jugement, et la réinjection ──────────────────────────────────────────

/**
 * Ce qu'on fait de cette image, une fois qu'on l'a regardée.
 *
 * « Juger, c'est marquer favori ou supprimer » — jamais accepter (US-25, US-26,
 * US-27). Et réinjecter, qui n'est pas un jugement mais son prolongement
 * naturel : ce qui marche repart (US-12).
 */
function Jugement({
  asset,
  onErreur,
  onReinjecter,
  onReglages,
  onSupprimer,
  onDecouper,
}: {
  asset: Asset
  onErreur: (raison: string) => void
  onReinjecter: (role: Role) => void
  onReglages: () => void
  onSupprimer: () => void
  onDecouper: () => void
}) {
  const basculerFavori = async () => {
    try {
      await api.favori([asset.identifiant], !asset.favori)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "favori refusé")
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-bord pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={basculerFavori}
          className={[
            "mesure h-[26px] rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
            asset.favori
              ? "border-signal bg-signal/13 text-signal"
              : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
          ].join(" ")}
        >
          {asset.favori ? "◤ favori" : "favori"}
        </button>
        <span className="mesure text-[10px] text-texte-3">
          {dollars(asset.cout_usd)}
        </span>
        {/* **Découper vit dans la rangée des gestes, pas dans une rubrique.**
            Une planche est une image comme une autre : rien ne permet de savoir
            d'avance qu'elle en contient huit, donc rien ne doit paraître ou
            disparaître selon ce qu'on croit deviner. Le geste est là, toujours,
            et il coûte une ligne de mono — la densité que le § La tuile impose
            à la grille vaut aussi pour la fiche. */}
        <button
          type="button"
          onClick={onDecouper}
          title="découper une planche multi-sprites en assets"
          className="mesure ml-auto h-[26px] px-1 text-[10px] text-texte-3 hover:text-signal"
        >
          Découper ›
        </button>
        <button
          type="button"
          onClick={onSupprimer}
          className="mesure h-[26px] px-1 text-[10px] text-texte-3 hover:text-echec"
        >
          Supprimer
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Libelle aide="fiche.reinjecter">Réinjecter</Libelle>
        <div className="flex flex-wrap gap-1">
          {ROLES.map(({ role, libelle, explique }) => (
            <button
              key={role}
              type="button"
              onClick={() => onReinjecter(role)}
              title={explique}
              className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte-2 hover:bg-fond-3"
            >
              {libelle}
            </button>
          ))}
          {/* Le quatrième rôle n'envoie aucune image : il reprend les réglages
              de la génération qui a produit cet asset. */}
          <button
            type="button"
            onClick={onReglages}
            title="reprendre prompt, modèle et réglages"
            className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte-2 hover:bg-fond-3"
          >
            jeu de réglages
          </button>
        </div>
      </div>
    </div>
  )
}

// ── La case que cette image remplit ─────────────────────────────────────────

/**
 * Désigner cette image comme le corps d'une attitude (US-122).
 *
 * **C'est ici, et nulle part ailleurs, qu'un corps devient un corps.** Il n'y a
 * pas d'écran de création de personnage avec son propre prompt : on écrit un
 * sujet dans l'atelier, on génère, on obtient une image, et c'est cette
 * image-là qu'on désigne. Le geste ne fabrique rien et ne coûte rien.
 *
 * **Deux listes, jamais une seule** : l'attitude appartient au personnage
 * choisi, et proposer les attitudes de tout le projet ferait désigner une case
 * qui n'existe pas. Un projet sans personnage ne montre donc pas deux listes
 * vides — il dit ce qu'il faut faire d'abord.
 */
function CaseDeLAsset({
  asset,
  plan,
  personnages,
  onErreur,
}: {
  asset: Asset
  plan: Pose[]
  personnages: Personnage[]
  onErreur: (raison: string) => void
}) {
  const porteur = personnages.find((p) => p.identifiant === asset.personnage) ?? null
  const tenues = porteur ? posesTenues(plan, porteur) : []

  const designer = async (personnage: string | null, pose: string | null) => {
    try {
      await api.designer(asset.identifiant, personnage, pose)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "désignation refusée")
    }
  }

  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle aide="fiche.personnage">Corps de</Libelle>

      {personnages.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Aucun personnage dans ce jeu. Une image devient un corps quand un
          personnage l'attend — l'écran Personnages en crée un.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            aria-label="Personnage de cette image"
            value={asset.personnage ?? ""}
            onChange={(e) => {
              const choisi = e.target.value
              if (!choisi) return void designer(null, null)
              // Un personnage choisi sans attitude ne désigne rien : la
              // première qu'il tient est proposée, et se change juste à côté.
              const suivant =
                personnages.find((p) => p.identifiant === choisi) ?? null
              const premiere = suivant ? posesTenues(plan, suivant)[0] : null
              if (!premiere)
                return onErreur("ce personnage ne tient aucune attitude")
              void designer(choisi, premiere.identifiant)
            }}
            className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2"
          >
            <option value="">aucun</option>
            {personnages.map((p) => (
              <option key={p.identifiant} value={p.identifiant}>
                {p.nom}
              </option>
            ))}
          </select>

          <select
            aria-label="Attitude de cette image"
            value={asset.pose ?? ""}
            disabled={!porteur}
            onChange={(e) =>
              void designer(asset.personnage ?? null, e.target.value || null)
            }
            className="mesure h-[26px] w-[120px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2 disabled:text-texte-3"
          >
            {!porteur && <option value="">—</option>}
            {tenues.map((pose) => (
              <option key={pose.identifiant} value={pose.identifiant}>
                {pose.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {asset.personnage_supprime && (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          personnage supprimé — l'image reste, sa case n'existe plus
        </p>
      )}
    </div>
  )
}

// ── La filiation ────────────────────────────────────────────────────────────

/**
 * D'où vient cette image, et ce qui en descend (US-38).
 *
 * **Une filiation incomplète reste une filiation.** Un parent supprimé garde son
 * identifiant et se dit supprimé (US-29) plutôt que de disparaître en emportant
 * les maillons qui restent — c'est la contrepartie directe de « jamais de
 * cascade » : si les enfants survivent, il faut qu'ils puissent dire à quoi.
 *
 * Le bloc n'existe que s'il y a quelque chose à montrer. Un asset sans parent et
 * sans descendance n'a pas de filiation manquante : il n'en a pas, et une
 * rubrique vide dirait le contraire.
 */
function Descendance({
  asset,
  onOuvrir,
  onErreur,
}: {
  asset: Asset
  onOuvrir: (identifiant: string) => void
  onErreur: (raison: string) => void
}) {
  const [filiation, setFiliation] = useState<Filiation | null>(null)

  useEffect(() => {
    let vivant = true
    api
      .filiation(asset.identifiant)
      .then((lue) => vivant && setFiliation(lue))
      .catch((erreur) =>
        onErreur(erreur instanceof Error ? erreur.message : "filiation illisible"),
      )
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant, asset.parent_supprime])

  if (!filiation) return null
  const sansParent = filiation.parent_identifiant === null
  if (sansParent && filiation.enfants.length === 0) return null

  // Ce que la filiation dit d'elle-même repliée : le nombre de maillons, pas
  // leurs noms. Un label d'asset ne tient pas dans la fente, et deux parents
  // n'existent pas — c'est la descendance qui se compte.
  const resume = [
    filiation.parent_supprime
      ? "parent supprimé"
      : filiation.parent
        ? "1 parent"
        : null,
    filiation.enfants.length > 0
      ? `${filiation.enfants.length} descendant${filiation.enfants.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="border-t border-bord pt-2">
      <Bloc cle="fiche.filiation" titre="Filiation" etat={resume}>
        <div className="flex flex-col gap-1">
          {filiation.parent && (
            <button
              type="button"
              onClick={() => onOuvrir(filiation.parent!.identifiant)}
              className="mesure flex items-center gap-1.5 text-left text-[10px] text-signal hover:text-signal-clair"
            >
              <span aria-hidden>↑</span>
              <span className="truncate">{filiation.parent.label}</span>
            </button>
          )}
          {filiation.parent_supprime && (
            <p className="mesure flex items-center gap-1.5 text-[10px] text-epingle">
              <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
              parent supprimé — {filiation.parent_identifiant}
            </p>
          )}
          {filiation.enfants.length > 0 && (
            <div className="flex flex-col gap-[2px]">
              <span className="mesure text-[10px] text-texte-3">
                {filiation.enfants.length} descendant
                {filiation.enfants.length > 1 ? "s" : ""}
              </span>
              {filiation.enfants.slice(0, 8).map((enfant) => (
                <button
                  key={enfant.identifiant}
                  type="button"
                  onClick={() => onOuvrir(enfant.identifiant)}
                  className="mesure flex items-center gap-1.5 text-left text-[10px] text-texte-2 hover:text-signal"
                >
                  <span aria-hidden>↓</span>
                  <span className="truncate">{enfant.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Bloc>
    </div>
  )
}

// ── La visionneuse ──────────────────────────────────────────────────────────

function Visionneuse({
  asset,
  brut,
  onBrut,
  traite,
  enVol,
}: {
  asset: Asset
  brut: boolean
  onBrut: (v: boolean) => void
  traite: boolean
  /** Une retouche partie et pas encore revenue. L'image affichée est alors
   *  celle d'avant : c'est ce que la jauge vient dire, au bord bas de la zone
   *  image, à l'endroit exact où une tuile en génération porte la sienne. */
  enVol: { depuis: number; attendue: number } | null
}) {
  const dimensions = brut || !traite
    ? `${asset.largeur}×${asset.hauteur}`
    : `${asset.rendu_largeur}×${asset.rendu_hauteur}`

  // **La visionneuse fait 380 px de large, et c'est là qu'on règle un
  // détourage** : Espace y ouvre la même image en grand, et la bascule décide
  // laquelle — l'aperçu suit ce que la surface montre, il ne rouvre pas la
  // question.
  const sujet = sujetAsset(asset, brut)
  const visee = useVisee(sujet)

  return (
    <div className="flex shrink-0 flex-col gap-1.5 px-2 pt-2">
      {/* Carrée, et large comme le panneau — sauf sur un écran court, où elle
          cède au calcul plutôt qu'aux contrôles. La borne porte sur la
          **largeur** et non sur la hauteur : `aspect-ratio` cède devant
          `max-height`, le navigateur rabote la hauteur sans redéduire la
          largeur, et le damier cesse d'être carré. C'est la leçon déjà payée
          sur le cadre de l'écran Découpe. */}
      <div
        onPointerEnter={visee.entrer}
        onPointerLeave={visee.sortir}
        className="damier damier-fiche relative mx-auto aspect-square w-full max-w-[46vh] border border-bord"
      >
        <img
          src={sujet.src}
          alt={asset.label}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
        {enVol && (
          <div className="absolute inset-x-0 bottom-0">
            <Jauge
              demarreLe={enVol.depuis}
              attendue={enVol.attendue}
              compteur={false}
              seuil={0.24}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* La bascule n'est là que s'il y a deux choses à comparer. Un segment
            « Brut » seul, sur une image sans recette, dirait une différence qui
            n'existe pas. */}
        {traite ? (
          <Segments
            valeurs={["rendu", "brut"] as const}
            valeur={brut ? "brut" : "rendu"}
            onChange={(quoi) => onBrut(quoi === "brut")}
          />
        ) : (
          <span className="mesure text-[10px] text-texte-3">brut</span>
        )}
        <span className="mesure ml-auto text-[10px] text-texte-3">{dimensions}</span>
      </div>
    </div>
  )
}

// ── Une passe de détourage ──────────────────────────────────────────────────

export function BlocPasse({
  rang,
  passe,
  raisonModele,
  onChange,
  onFini,
  onRetirer,
}: {
  rang: number
  passe: Passe
  raisonModele: string | null
  /** La valeur bouge à l'écran, rien ne part. */
  onChange: (p: Passe) => void
  /** La valeur est arrêtée : elle part. Un segment appelle celui-ci
   *  directement — un choix n'a pas d'états intermédiaires à traverser. */
  onFini: (p: Passe) => void
  onRetirer?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[2px] border border-bord bg-fond-2 p-2">
      <div className="flex items-center gap-2">
        <span className="mesure text-[9.5px] text-texte-3">passe {rang + 1}</span>
        {onRetirer && (
          <button
            type="button"
            onClick={onRetirer}
            className="mesure ml-auto text-[10px] text-texte-3 hover:text-echec"
          >
            retirer
          </button>
        )}
      </div>

      {/* **Le seul contrôle de la passe qui n'avait pas de nom.** Ses trois
          voisins en portaient un ; celui-ci se lisait sur ses deux segments,
          « bord » et « modèle », c'est-à-dire sur ses valeurs. Un contrôle qui
          n'est nommé que par ce qu'il vaut n'a nulle part où accrocher son
          explication — la même règle que les `placeholder` du menu de carte.
          La raison du grisé reste sous la rangée, sur toute la largeur : elle
          parle du modèle indisponible, pas du réglage. */}
      <Reglage libelle="moteur" aide="detourage.moteur">
        <Segments
          valeurs={["bord", "modele"] as const}
          valeur={passe.moteur}
          onChange={(moteur) => onFini({ ...passe, moteur })}
          indisponibles={raisonModele ? (["modele"] as const) : []}
          libelles={{ bord: "bord", modele: "modèle" }}
        />
      </Reglage>
      {raisonModele && <Raison texte={raisonModele} />}

      {passe.moteur === "bord" && (
        <Reglage libelle="tolérance" aide="detourage.tolerance">
          <Curseur
            valeur={passe.tolerance}
            min={0}
            max={120}
            onChange={(tolerance) => onChange({ ...passe, tolerance })}
            onFini={(tolerance) => onFini({ ...passe, tolerance })}
          />
        </Reglage>
      )}
      <Reglage libelle="seuil alpha" aide="detourage.seuil_alpha">
        <Curseur
          valeur={passe.seuil_alpha}
          min={1}
          max={255}
          onChange={(seuil_alpha) => onChange({ ...passe, seuil_alpha })}
          onFini={(seuil_alpha) => onFini({ ...passe, seuil_alpha })}
        />
      </Reglage>
      <Reglage libelle="durcissement" aide="detourage.durcissement">
        <Segments
          valeurs={[0, 1, 2, 3, 4] as const}
          valeur={passe.durcissement as 0 | 1 | 2 | 3 | 4}
          onChange={(durcissement) => onFini({ ...passe, durcissement })}
        />
      </Reglage>
    </div>
  )
}

// ── Le gabarit d'un réglage ─────────────────────────────────────────────────

function Reglage({
  libelle,
  aide,
  children,
}: {
  libelle: string
  /** La cle de l'entree du corpus (`src/aide.ts`), s'il y en a une. Le libelle
   *  devient alors sa propre poignee : pointille `--bord-fort`, survol pour
   *  reveler, clic pour epingler. Sans cle, rien ne se marque. */
  aide?: string
  children: React.ReactNode
}) {
  const { presente, ancre, declencheurs, bulle } = useInfobulle(aide)
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
      <span
        ref={ancre as React.Ref<HTMLSpanElement>}
        {...declencheurs}
        className={`mesure text-[10px] text-texte-3 ${presente ? POINTILLE : ""}`}
      >
        {libelle}
      </span>
      {children}
      {bulle}
    </div>
  )
}

const defautGrille = () => ({ cible: 64, occupation: 100, ancrage: "bas" as const })

const estVide = (recette: Recette) =>
  recette.passes.length === 0 &&
  !recette.recadrage &&
  !recette.grille &&
  !recette.quantification &&
  !recette.bords
