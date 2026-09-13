// Un seul bouton « Importer », qui regarde ce qu'on lui donne et enchaîne.
//
// **On ne demande rien avant de savoir ce que c'est** (`AU21`). Le choix d'avant
// posait la même question à tout le monde — *quel mouvement, quelle direction ?*
// — y compris pour une vidéo, à qui ça ne veut rien dire : une vidéo devient un
// clip, et c'est la bande qu'on y taille qui se range sur un mouvement.
//
// Trois choses peuvent entrer, et chacune a sa suite :
//
// | Ce qu'on donne | Ce que ça devient | Ce qui s'ouvre ensuite |
// |---|---|---|
// | une vidéo | un clip du sujet | le montage, pour y tailler l'animation |
// | une planche | une image du sujet | la découpe, cases déjà détectées |
// | une image | une image du sujet | rien — elle attend dans « Pas encore rangé » |
//
// **La planche se reconnaît toute seule** : le serveur sait déjà détecter les
// cases d'une image (`GET /assets/{id}/slices`), et c'est ce qu'on lui demande
// juste après l'import. Deux cases ou plus, c'est une planche. L'auteur n'a pas
// à le déclarer — il le voit à l'œil, la machine aussi.
//
// ⚠️ **Rien n'est jamais perdu, même quand la suite ne s'ouvre pas.** L'import
// et le rattachement au sujet se font d'abord ; la détection et l'ouverture
// viennent après, et si elles échouent, ce qui est entré est déjà rangé sur la
// fiche. C'est l'ordre qui tient la promesse, pas un `try` bien placé.

import { useState } from "react"
import { api, type Personnage } from "../api"

const VIDEO = /\.(mp4|webm|mov|mkv|avi|m4v)$/i

/** Deux cases détectées, c'est une planche. Une seule, c'est une image — le
 *  détourage en trouve toujours au moins une, et l'ouvrir dans la découpe pour
 *  un seul rectangle serait un écran de plus pour rien. */
const PLANCHE_DES = 2

export function ImporterIntelligemment({
  personnage,
  classe,
  onDecouper,
  onMonter,
  onChange,
  onErreur,
}: {
  personnage: Personnage
  classe: string
  /** Ouvrir la découpe sur la planche qui vient d'entrer. */
  onDecouper?: (asset: string) => void
  /** Ouvrir le montage sur le clip qui vient d'entrer. */
  onMonter?: (clip: string) => void
  onChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const [avis, setAvis] = useState("")
  const [occupe, setOccupe] = useState(false)

  async function entrer(fichier: File | undefined) {
    if (!fichier || occupe) return
    setOccupe(true)
    setAvis("")
    try {
      if (fichier.type.startsWith("video/") || VIDEO.test(fichier.name)) {
        await uneVideo(fichier)
      } else {
        await uneImage(fichier)
      }
      onChange?.()
    } catch (erreur) {
      setAvis(erreur instanceof Error ? erreur.message : "Import impossible.")
      onErreur?.(erreur, "ce fichier n’a pas pu entrer")
    } finally {
      setOccupe(false)
    }
  }

  /** Une vidéo devient un clip du sujet, **et on ne lui demande pas de pose** :
   *  ce qui se range sur un mouvement, c'est la bande qu'on y taillera. Le
   *  montage s'ouvre donc tout de suite, là où ce geste-là se fait. */
  async function uneVideo(fichier: File) {
    const recu = await api.importerClip(fichier, {
      nom: fichier.name,
      personnage: personnage.identifiant,
    })
    const clip = recu.clip ?? recu.doublon
    if (!clip) return
    setAvis(
      recu.doublon
        ? `« ${fichier.name} » était déjà là — on ouvre son montage.`
        : `« ${fichier.name} » est entrée · ${clip.clip!.images} images. On ouvre le montage.`,
    )
    onMonter?.(clip.identifiant)
  }

  /** Une image entre, se range sur le sujet, **puis** on regarde si c'est une
   *  planche. L'ordre compte : le rattachement est fait avant que quoi que ce
   *  soit d'autre puisse échouer. */
  async function uneImage(fichier: File) {
    const recu = await api.televerser(fichier)
    const asset = recu.asset ?? recu.doublon
    if (!asset) return
    await api.designer(asset.identifiant, personnage.identifiant, null, null)

    let cases = 0
    try {
      cases = (await api.decoupeProposee(asset.identifiant, { mode: "auto" })).boites.length
    } catch {
      // La détection n'est pas la promesse : l'image est déjà sur la fiche.
      cases = 0
    }
    if (cases >= PLANCHE_DES && onDecouper) {
      setAvis(`« ${fichier.name} » — ${cases} cases détectées. On ouvre la découpe.`)
      onDecouper(asset.identifiant)
      return
    }
    setAvis(
      `« ${fichier.name} » est rangée sur ${personnage.nom}, dans « Pas encore rangé ».`,
    )
  }

  return (
    <>
      <label className={`${classe} inline-flex cursor-pointer items-center`}>
        {occupe ? "Lecture…" : "Importer…"}
        <input
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          aria-label="Fichier à importer"
          disabled={occupe}
          onChange={(e) => {
            void entrer(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </label>
      {avis && (
        <span role="status" className="text-[12px] text-encre-3">
          {avis}
        </span>
      )}
    </>
  )
}
