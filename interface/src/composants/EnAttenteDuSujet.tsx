// L'onglet « Pas encore rangé » — ce qui est à ce sujet sans occuper de case.
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

import { useCallback, useEffect, useState } from "react"
import { api, type Asset, type Bande, type Generation, type Personnage, type Pose } from "../api"

const BOUTON = "h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"

type EnAttente = {
  images: Asset[]
  clips: Generation[]
  animations: Bande[]
}

const VIDE: EnAttente = { images: [], clips: [], animations: [] }

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

  const relire = useCallback(async () => {
    try {
      const recu = await api.enAttenteDuSujet(personnage.identifiant, personnage.projet)
      setLu({ images: recu.images, clips: recu.clips, animations: recu.animations })
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

  const total = lu.images.length + lu.clips.length + lu.animations.length

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

  if (!charge)
    return (
      <section aria-label="Pas encore rangé">
        <p className="text-[13px] text-encre-3">Lecture…</p>
      </section>
    )

  return (
    <section aria-label="Pas encore rangé" className="space-y-[22px]">
      <div className="flex items-end justify-between gap-[14px]">
        <div>
          <h2 className="font-serif text-[25px] text-encre">Pas encore rangé</h2>
          <p className="mt-[8px] text-[13px] text-encre-3">
            {total
              ? `${total} élément${total > 1 ? "s" : ""} appartiennent à ${personnage.nom} sans occuper de case. Rien n’est perdu : choisissez un mouvement pour les ranger.`
              : `Tout ce qui appartient à ${personnage.nom} est rangé sur un mouvement.`}
          </p>
        </div>
        {total > 0 && (
          <button className={BOUTON} onClick={() => void relire()}>
            Relire
          </button>
        )}
      </div>

      {lu.images.length > 0 && (
        <div>
          <h3 className="text-[13px] text-encre-2">
            Images · {lu.images.length}
          </h3>
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
            Rien n’a encore été tiré de ceux-ci. Ouvrez leur montage depuis
            « Sources &amp; clips » pour en tailler une animation.
          </p>
          <div className="mt-[14px] grid grid-cols-2 gap-[14px]">
            {lu.clips.map((g) => (
              <article
                key={g.identifiant}
                className="overflow-hidden rounded-8 border border-trait bg-carte"
              >
                <video
                  controls
                  preload="metadata"
                  src={api.videoDuClip(g.identifiant)}
                  aria-label={`Clip de ${personnage.nom} · ${g.identifiant}`}
                  className="h-[128px] w-full bg-pourtour object-contain"
                />
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
    </section>
  )
}
