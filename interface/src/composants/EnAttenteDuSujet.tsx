// « Pas encore rangé » — ce qui est à ce sujet sans occuper de case.
//
// **Il existe parce que « ranger plus tard » voulait dire « perdre »** (`AU20`).
// Le produit n'a jamais voulu qu'on range au moment d'importer : on fait entrer
// une planche, une vidéo, une image, et on décide ensuite où ça va. Mais la
// fiche ne montrait que des cases. Tout ce qui entrait sans case quittait donc
// l'écran à l'instant même où on venait de le faire entrer — mesuré à l'usage
// le 13 septembre 2026, sur une vidéo importée et sur une planche découpée.
//
// **Une seule liste pour trois familles**, et c'est la décision de l'écran. La
// question que l'auteur se pose est *qu'est-ce que j'ai fait entrer ici et que
// je n'ai pas rangé ?* — elle ne distingue pas une image d'un clip. Trois
// sections séparées auraient rendu cette question-là en trois endroits.
//
// **Ranger se fait ici, sans changer d'écran.** Une liste qui montre un problème
// sans porter son geste est une liste qu'on relit trois fois.
//
// **Depuis `RV12`, ce n'est plus un onglet, c'est un bandeau** (la fiche à
// quatre onglets n'en a plus la place) : il ne s'affiche que lorsqu'il y a
// vraiment quelque chose à ranger, replié par défaut — un bandeau qui
// paraîtrait toujours, même vide, cesserait d'être un signal. La liste
// elle-même, une fois dépliée, n'a pas changé de forme.

import { useCallback, useEffect, useState } from "react"
import { api, PlancheAConfirmer, type Asset, type Bande, type Generation, type Personnage, type Pose } from "../api"
import { useVisee, sujetVideo } from "./Apercu"
import { FenteAnnulation, type Annulation } from "./BarreOutils"
import { Libelle } from "./pieces"

const BOUTON = "h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"

type EnAttente = {
  images: Asset[]
  clips: Generation[]
  animations: Bande[]
}

const VIDE: EnAttente = { images: [], clips: [], animations: [] }

/** Même délai que le sursis serveur de la suppression (`ANNULATION_S`,
 *  `atelier/services/bibliotheque.py`) — pour que les deux fentes du bandeau
 *  décomptent pareil — mais tenu côté client : Écarter n'a pas de sursis
 *  serveur à décompter, `designer` agit tout de suite. */
const DELAI_ANNULATION_ECART_S = 8

type AnnulationEcart = Annulation & { pose: string | null; direction: string | null }

/** Une vidéo qui s'ouvre en grand à la barre d'espace, comme une image. */
function VideoDuClip({ clip, titre }: { clip: string; titre: string }) {
  const visee = useVisee(sujetVideo(clip, titre))
  return (
    <video
      controls
      preload="metadata"
      src={api.videoDuClip(clip)}
      aria-label={titre}
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      className="h-[128px] w-full bg-pourtour object-contain"
    />
  )
}

export function EnAttenteDuSujet({
  personnage,
  plan,
  onOuvrir,
  onChange,
  onErreur,
}: {
  personnage: Personnage
  /** Les mouvements de ce sujet-là, pas le plan du jeu : une pose qu'il a
   *  écartée n'est pas une case où quelque chose peut se ranger. */
  plan: Pose[]
  /** Ouvrir une image dans sa fiche — le même geste que depuis la grille. */
  onOuvrir?: (asset: string) => void
  /** Quelque chose vient d'être rangé : les cases de la fiche ont bougé. */
  onChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const [lu, setLu] = useState<EnAttente>(VIDE)
  const [charge, setCharge] = useState(false)
  const [occupe, setOccupe] = useState("")

  const poses = plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const directionsDe = (pose: string) =>
    personnage.cases.find((c) => c.pose === pose)?.directions ?? []

  const [ouvert, setOuvert] = useState(false)
  const [annulation, setAnnulation] = useState<Annulation | null>(null)
  const [ecarte, setEcarte] = useState<AnnulationEcart | null>(null)

  const relire = useCallback(async () => {
    try {
      const recu = await api.enAttenteDuSujet(personnage.identifiant, personnage.projet)
      // **Un repli défensif** : le double d'un essai qui ne connaît pas
      // encore cette route rend `{}`, et un bandeau qui plante à l'affichage
      // ferait tomber toutes les pages du produit, puisqu'il est monté
      // partout depuis `RV12`.
      setLu({ images: recu.images ?? [], clips: recu.clips ?? [], animations: recu.animations ?? [] })
    } catch (erreur) {
      onErreur?.(erreur, "la liste de ce qui attend n’a pas pu être lue")
    } finally {
      setCharge(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnage.identifiant, personnage.projet])

  useEffect(() => {
    void relire()
  }, [relire])

  /** Ranger une image sur une case. La direction reste à préciser : la choisir
   *  ici demanderait deux réponses là où l'auteur n'en a qu'une en tête. */
  async function rangerImage(asset: Asset, pose: string) {
    if (!pose || occupe) return
    setOccupe(asset.identifiant)
    try {
      await api.designer(asset.identifiant, personnage.identifiant, pose, null)
      await relire()
      onChange?.()
    } catch (erreur) {
      onErreur?.(erreur, "cette image n’a pas pu être rangée")
    } finally {
      setOccupe("")
    }
  }

  async function rangerAnimation(bande: Bande, pose: string) {
    if (!pose || occupe) return
    setOccupe(bande.identifiant)
    try {
      // **La direction part avec, quand le sujet n'en tient qu'une** : la
      // laisser vide sur un mouvement qui n'a qu'un angle ferait une animation
      // rangée dans une case sans angle, c'est-à-dire invisible dans la matrice.
      const angles = directionsDe(pose)
      await api.affecterLaBande(
        bande.identifiant,
        pose,
        angles.length === 1 ? angles[0].identifiant : null,
        personnage.identifiant,
      )
      await relire()
      onChange?.()
    } catch (erreur) {
      onErreur?.(erreur, "cette animation n’a pas pu être rangée")
    } finally {
      setOccupe("")
    }
  }

  /** Écarter : l'image quitte le sujet et retourne à la Galerie, intacte —
   *  le même `personnage: null` que la fiche pose déjà pour en détacher une
   *  (US-122, `api.designer`). Rien n'est supprimé, rien n'est payé.
   *
   *  **S'annule comme Supprimer** (RV22, relu le 24 septembre 2026) : même
   *  fente, même délai de 8 s — client-only ici, `designer` n'ayant pas de
   *  sursis serveur comme la suppression. L'annulation rattache l'image avec
   *  la pose et la direction qu'elle portait avant, jamais `null` en dur :
   *  dans ce bandeau elles valent `null` la plupart du temps (c'est la
   *  définition de « pas encore rangé »), mais une image « à confirmer » peut
   *  porter une direction sans pose, et l'écraser la perdrait. */
  async function ecarterImage(asset: Asset) {
    if (occupe) return
    setOccupe(asset.identifiant)
    try {
      await api.designer(asset.identifiant, null, null, null)
      setEcarte({
        identifiants: [asset.identifiant],
        expireLe: Date.now() / 1000 + DELAI_ANNULATION_ECART_S,
        pose: asset.pose,
        direction: asset.direction,
      })
      await relire()
      onChange?.()
    } catch (erreur) {
      onErreur?.(erreur, "cette image n’a pas pu être écartée")
    } finally {
      setOccupe("")
    }
  }

  /** Rendre ce qui vient d'être écarté — même geste qu'`annulerSuppression`,
   *  mais qui rattache plutôt que restaure : l'image n'a jamais quitté la
   *  bibliothèque, seul son lien au sujet a bougé. */
  async function annulerEcart() {
    if (!ecarte) return
    const [identifiant] = ecarte.identifiants
    try {
      await api.designer(identifiant, personnage.identifiant, ecarte.pose, ecarte.direction)
      setEcarte(null)
      await relire()
      onChange?.()
    } catch (erreur) {
      setEcarte(null)
      onErreur?.(erreur, "annulation refusée")
    }
  }

  /** Supprimer : le geste de jugement de la Galerie, à l'identique — même
   *  route confirmable, même délai d'annulation (US-27). Une planche dont
   *  d'autres images dépendent se refuse ici comme là-bas ; ce bandeau ne
   *  rejoue pas sa question « confirmer quand même », il renvoie vers la
   *  Galerie qui la pose déjà. */
  async function supprimerImage(asset: Asset) {
    if (occupe) return
    setOccupe(asset.identifiant)
    try {
      const rendu = await api.supprimerAssetsConfirmable([asset.identifiant])
      setAnnulation({ identifiants: rendu.supprimes, expireLe: rendu.expire_le })
      await relire()
      onChange?.()
    } catch (erreur) {
      if (erreur instanceof PlancheAConfirmer)
        onErreur?.(erreur, "cette image appartient à une planche partagée — supprime-la depuis la Galerie")
      else onErreur?.(erreur, "cette image n’a pas pu être supprimée")
    } finally {
      setOccupe("")
    }
  }

  /** Rendre ce qui vient d'être supprimé, comme `Galerie.annuler` — les
   *  identifiants sont ceux que la suppression a renvoyés, jamais relus sur
   *  `annulation`, qui aurait encore sa valeur d'avant au même rendu. */
  async function annulerSuppression() {
    if (!annulation) return
    try {
      await api.restaurer(annulation.identifiants)
      setAnnulation(null)
      await relire()
      onChange?.()
    } catch (erreur) {
      setAnnulation(null)
      onErreur?.(erreur, "annulation refusée")
    }
  }

  const total = lu.images.length + lu.clips.length + lu.animations.length

  // **Le bandeau ne paraît que s'il y a quelque chose à ranger** — replié le
  // temps de la lecture, absent une fois qu'on sait qu'il n'y a rien. **Sauf
  // une annulation encore possible** (suppression ou écart) : vider le
  // dernier élément au même rendu, et un bandeau qui s'efface avec lui
  // emporterait le seul endroit où « Annuler » se trouve.
  if (!charge || (total === 0 && !annulation && !ecarte)) return null

  const choixDePose = (surChoix: (pose: string) => void, desactive: boolean) => (
    <select
      className={BOUTON}
      disabled={desactive || !poses.length}
      defaultValue=""
      onChange={(e) => {
        surChoix(e.target.value)
        e.target.value = ""
      }}
    >
      <option value="">Ranger dans…</option>
      {poses.map((p) => (
        <option key={p.identifiant} value={p.identifiant}>
          {p.nom}
        </option>
      ))}
    </select>
  )

  return (
    <section data-bandeau-pas-encore-range aria-label="Pas encore rangé" className="shrink-0 rounded-8 border border-trait-attention bg-fond-attention px-[14px] py-[8px]">
      <div className="flex flex-wrap items-center justify-between gap-[14px]">
        {total > 0 ? (
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            className="flex min-w-0 flex-1 items-center gap-[8px] py-[4px] text-left"
          >
            <span aria-hidden className="text-[12px] text-encre-attention">{ouvert ? "▾" : "▸"}</span>
            <span className="font-serif text-[13px] text-encre-attention">Pas encore rangé</span>
            <span className="text-[12.5px] text-encre-attention">
              {total} élément{total > 1 ? "s" : ""} appartiennent à {personnage.nom} sans occuper de case — rien n’est perdu, choisis un mouvement pour les ranger.
            </span>
          </button>
        ) : (
          // **Le bandeau lui-même vient de se vider** (dernière image écartée
          // ou supprimée) : la seule chose qu'il porte encore est l'annulation
          // ci-dessous, le temps qu'elle reste possible.
          <p className="flex min-w-0 flex-1 items-center gap-[8px] py-[4px] text-[12.5px] text-encre-attention">
            Plus rien à ranger pour {personnage.nom}.
          </p>
        )}
        <div className="flex shrink-0 items-center gap-[14px]">
          {annulation && <FenteAnnulation annulation={annulation} onAnnuler={() => void annulerSuppression()} />}
          {ecarte && <FenteAnnulation annulation={ecarte} onAnnuler={() => void annulerEcart()} verbe="écarté" />}
          {ouvert && total > 0 && (
            <button className={BOUTON} onClick={() => void relire()}>
              Relire
            </button>
          )}
        </div>
      </div>

      {ouvert && total > 0 && <div className="mt-[14px] space-y-[22px]">

      {lu.images.length > 0 && (
        <div>
          <h3 className="text-[13px] text-encre-2">
            Images · {lu.images.length}
          </h3>
          {/* **Marque d'aide** (défaut 7 de la relecture du 24 septembre
              2026) : les deux gestes de fin de chaque carte, sans entrée
              reliée jusqu'ici. Une seule légende pour les deux, plutôt qu'une
              par carte répétée quatre fois par rangée. **Le mot du libellé
              n'est jamais celui du bouton** : le même mot, avec le même rôle
              de survol, ferait deux éléments « Écarter », et un essai qui
              cherche le bouton par son nom tomberait sur les deux. */}
          <p className="mt-[4px] text-[10.5px] text-encre-4">
            <Libelle aide="bandeau.ecarter">détacher</Libelle> renvoie à la bibliothèque sans supprimer ;{" "}
            <Libelle aide="bandeau.supprimer">supprimer</Libelle> juge, comme la Galerie.
          </p>
          <div className="mt-[14px] grid grid-cols-4 gap-[14px]">
            {lu.images.map((a) => (
              <article
                key={a.identifiant}
                className="overflow-hidden rounded-8 border border-trait bg-carte"
              >
                <img
                  src={api.fichier(a.identifiant)}
                  alt={a.label || a.identifiant}
                  className="damier-papier h-[128px] w-full object-contain"
                />
                <div className="p-[8px]">
                  <p className="truncate text-[12px] text-encre">{a.label || a.identifiant}</p>
                  <div className="mt-[8px] flex flex-wrap gap-[4px]">
                    {choixDePose((pose) => void rangerImage(a, pose), occupe === a.identifiant)}
                    {onOuvrir && (
                      <button className={BOUTON} onClick={() => onOuvrir(a.identifiant)}>
                        Ouvrir
                      </button>
                    )}
                    {/* **Écarter et Supprimer** (`RV22`) : une image qui n'ira
                        nulle part ne doit pas rester là pour rien. Écarter
                        rejoue le même détachement que la fiche (`api.designer`
                        avec `personnage: null`) ; Supprimer rejoue le geste de
                        jugement de la Galerie, avec sa même annulation. */}
                    <button
                      className={BOUTON}
                      disabled={occupe === a.identifiant}
                      onClick={() => void ecarterImage(a)}
                    >
                      Écarter
                    </button>
                    <button
                      className={`${BOUTON} hover:text-echec`}
                      disabled={occupe === a.identifiant}
                      onClick={() => void supprimerImage(a)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {lu.animations.length > 0 && (
        <div>
          <h3 className="text-[13px] text-encre-2">
            Animations · {lu.animations.length}
          </h3>
          <div className="mt-[14px] grid grid-cols-2 gap-[14px]">
            {lu.animations.map((b) => (
              <article
                key={b.identifiant}
                className="flex items-center gap-[14px] rounded-8 border border-trait bg-carte p-[14px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-encre">{b.nom}</p>
                  <p className="mesure mt-[4px] text-[11px] text-encre-3">
                    {b.images.length} images · {b.cadence} i/s
                    {b.direction ? ` · ${b.direction}` : ""}
                  </p>
                </div>
                {choixDePose((pose) => void rangerAnimation(b, pose), occupe === b.identifiant)}
              </article>
            ))}
          </div>
        </div>
      )}

      {lu.clips.length > 0 && (
        <div>
          <h3 className="text-[13px] text-encre-2">
            Clips et vidéos · {lu.clips.length}
          </h3>
          {/* **Un clip ne se range pas sur une case : on y taille une bande,
              et c'est la bande qui se range.** Le dire ici évite de proposer
              un geste qui n'existe pas, et de laisser croire que ce clip-là
              est bloqué. */}
          <p className="mt-[4px] text-[12px] text-encre-3">
            Rien n’a encore été tiré de ceux-ci. Ouvre leur montage depuis
            « Animations › Sources » pour en tailler une animation.
          </p>
          <div className="mt-[14px] grid grid-cols-2 gap-[14px]">
            {lu.clips.map((g) => (
              <article
                key={g.identifiant}
                className="overflow-hidden rounded-8 border border-trait bg-carte"
              >
                <VideoDuClip clip={g.identifiant} titre={`Clip de ${personnage.nom} · ${g.identifiant}`} />
                <div className="p-[8px]">
                  <p className="truncate text-[12px] text-encre">{g.demande.prompt}</p>
                  <p className="mesure mt-[4px] text-[11px] text-encre-3">
                    {g.clip?.images} images à {g.clip?.cadence} i/s
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      </div>}
    </section>
  )
}
