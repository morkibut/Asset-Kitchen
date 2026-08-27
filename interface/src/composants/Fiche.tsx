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

import { useEffect, useState } from "react"
import {
  api,
  dollars,
  PASSE_PAR_DEFAUT,
  RECETTE_VIDE,
  ROLES,
  type Asset,
  type EtatTraitement,
  type Filiation,
  type Passe,
  type Recette,
  type Role,
  type Univers,
} from "../api"
import { Bouton, Curseur, EnTetePanneau, Etape, Libelle, Raison, Segments } from "./chassis"

/** Les cibles proposées. Reprises de `MySpriteAi`, où elles ont servi pour de
 *  vrai — 16 pour une tuile, 64 pour un sprite, 128 pour un décor. La valeur
 *  n'est jamais déduite de l'image reçue (US-61) : elle se choisit ici, et
 *  deviendra une propriété du projet en T4. */
const CIBLES = [16, 24, 32, 48, 64, 96, 128] as const

export function Fiche({
  asset,
  traitement,
  univers,
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
    setMontrerBrut(false)
    setNom("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])

  // ── Poser la recette ──────────────────────────────────────────────────────
  //
  // À chaque cran de curseur, et c'est tenable : le serveur garde le détourage
  // et ne refait que la queue de la recette — 28 ms contre 130. C'est ce qui
  // rend vrai « chaque réglage répond sans attente perceptible ».

  const poser = async (suivante: Recette) => {
    setRecette(suivante)
    try {
      await api.poserRecette(asset.identifiant, suivante)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "retouche refusée")
      setRecette(asset.recette) // l'écran ne garde pas un réglage que le serveur refuse
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
    <aside className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord bg-fond-1">
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        <Visionneuse
          asset={asset}
          brut={montrerBrut}
          onBrut={setMontrerBrut}
          traite={!estVide(recette)}
        />

        <Jugement
          asset={asset}
          onErreur={onErreur}
          onReinjecter={onReinjecter}
          onReglages={onReglages}
          onSupprimer={onSupprimer}
          onDecouper={onDecouper}
        />

        <Descendance asset={asset} onOuvrir={onOuvrir} onErreur={onErreur} />

        <div className="flex flex-col gap-2">
          {/* ── 1. Détourage ─────────────────────────────────────────────── */}
          <Etape
            titre="Détourage"
            active={recette.passes.length > 0}
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
                    poser({
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
            titre="Recadrage"
            active={recette.recadrage !== null}
            onBasculer={() =>
              poser({
                ...recette,
                recadrage: recette.recadrage ? null : { marge: 0, boite: null },
              })
            }
          >
            <Reglage libelle="marge">
              <Curseur
                valeur={recette.recadrage?.marge ?? 0}
                min={0}
                max={64}
                unite=" px"
                onChange={(marge) =>
                  poser({ ...recette, recadrage: { marge, boite: null } })
                }
              />
            </Reglage>
          </Etape>

          {/* ── 3. Grille ────────────────────────────────────────────────── */}
          <Etape
            titre="Grille"
            active={recette.grille !== null}
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
              <Reglage libelle="cible">
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
              <Reglage libelle="occupation">
                <Curseur
                  valeur={recette.grille?.occupation ?? 100}
                  min={10}
                  max={100}
                  unite=" %"
                  onChange={(occupation) =>
                    poser({
                      ...recette,
                      grille: { ...(recette.grille ?? defautGrille()), occupation },
                    })
                  }
                />
              </Reglage>
              <Reglage libelle="ancrage">
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
            titre="Quantification"
            active={recette.quantification !== null}
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
                <Reglage libelle="palette">
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
              <Reglage libelle="couleurs">
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
            titre="Nettoyage des bords"
            active={recette.bords !== null}
            onBasculer={() =>
              poser({
                ...recette,
                bords: recette.bords ? null : { aire_min: 3 },
              })
            }
          >
            <Reglage libelle="tache minimale">
              <Curseur
                valeur={recette.bords?.aire_min ?? 3}
                min={0}
                max={64}
                unite=" px"
                onChange={(aire_min) => poser({ ...recette, bords: { aire_min } })}
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
              <Libelle>Recettes</Libelle>
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
              className="mesure h-8 min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
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
        <Libelle>Réinjecter</Libelle>
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

  return (
    <div className="flex flex-col gap-1 border-t border-bord pt-2">
      <Libelle>Filiation</Libelle>
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
  )
}

// ── La visionneuse ──────────────────────────────────────────────────────────

function Visionneuse({
  asset,
  brut,
  onBrut,
  traite,
}: {
  asset: Asset
  brut: boolean
  onBrut: (v: boolean) => void
  traite: boolean
}) {
  const dimensions = brut || !traite
    ? `${asset.largeur}×${asset.hauteur}`
    : `${asset.rendu_largeur}×${asset.rendu_hauteur}`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="damier damier-fiche aspect-square w-full border border-bord">
        <img
          src={api.rendu(asset.identifiant, asset.empreinte, brut)}
          alt={asset.label}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
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
      <p className="truncate text-[11.5px] text-texte-2" title={asset.label}>
        {asset.label}
      </p>
    </div>
  )
}

// ── Une passe de détourage ──────────────────────────────────────────────────

function BlocPasse({
  rang,
  passe,
  raisonModele,
  onChange,
  onRetirer,
}: {
  rang: number
  passe: Passe
  raisonModele: string | null
  onChange: (p: Passe) => void
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

      <Segments
        valeurs={["bord", "modele"] as const}
        valeur={passe.moteur}
        onChange={(moteur) => onChange({ ...passe, moteur })}
        indisponibles={raisonModele ? (["modele"] as const) : []}
        libelles={{ bord: "bord", modele: "modèle" }}
      />
      {raisonModele && <Raison texte={raisonModele} />}

      {passe.moteur === "bord" && (
        <Reglage libelle="tolérance">
          <Curseur
            valeur={passe.tolerance}
            min={0}
            max={120}
            onChange={(tolerance) => onChange({ ...passe, tolerance })}
          />
        </Reglage>
      )}
      <Reglage libelle="seuil alpha">
        <Curseur
          valeur={passe.seuil_alpha}
          min={1}
          max={255}
          onChange={(seuil_alpha) => onChange({ ...passe, seuil_alpha })}
        />
      </Reglage>
      <Reglage libelle="durcissement">
        <Segments
          valeurs={[0, 1, 2, 3, 4] as const}
          valeur={passe.durcissement as 0 | 1 | 2 | 3 | 4}
          onChange={(durcissement) => onChange({ ...passe, durcissement })}
        />
      </Reglage>
    </div>
  )
}

// ── Le gabarit d'un réglage ─────────────────────────────────────────────────

function Reglage({
  libelle,
  children,
}: {
  libelle: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2">
      <span className="mesure text-[10px] text-texte-3">{libelle}</span>
      {children}
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
