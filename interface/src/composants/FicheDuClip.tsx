// La fiche d'un clip — la même colonne de droite que la fiche d'une image,
// pour ce que la galerie garde sans que ce soit une image (V3.02).
//
// **Un clip n'entre pas en bibliothèque, et pourtant il a une fiche.** Il a été
// payé — sa dépense est au journal —, il est arrivé, il a produit des bandes ;
// jusqu'ici la seule porte que la galerie lui ouvrait était le montage, alors
// qu'un montage est un écran qui *travaille*. Une image se regarde d'un clic ;
// un clip se regarde maintenant de la même manière.
//
// **La vidéo d'abord.** La vignette du clip, c'est la vidéo elle-même, en
// boucle, avec jeu, pause et une barre qui se déplace — pas une image prélevée
// que l'écran rejoue à sa cadence : la vidéo porte le rythme du modèle, ses
// fondus, ce qu'il fait entre deux images (A7 bis ③). La route existe depuis
// `A9`, les demandes de plage depuis `A7` bis — la fiche ne branche que ce qui
// était déjà payé.
//
// **Rien ici ne dépense.** Le clip est déjà payé, et la phrase le dit en pied,
// comme le pied du montage — c'est la même garantie.
//
// **Ce qui ne s'écrit pas ici.** Garder et jeter restent les gestes de la
// grille : le chemin de suppression du produit est unique, et la fiche ne le
// contourne pas.
//
// **Portée au papier le 11 septembre 2026 (`D4`)**, au mot près sur la même
// colonne que `Fiche.tsx` (`D3`) : mêmes jetons, mêmes tailles, le même
// vocabulaire papier de `pieces.tsx` pour `Bouton`, `EnTetePanneau` et
// `Libelle`.

import { useEffect, useState } from "react"
import {
  api,
  depense,
  type Asset,
  type Bande,
  type Generation,
  type Personnage,
  type Pose,
} from "../api"
import { vignetteAsset } from "./Apercu"
import { Bouton, EnTetePanneau, Libelle } from "./pieces"
import { nomDuModele } from "./Fiche"
import { PANNEAU } from "./Infobulle"
import { TexteEnvoye } from "./TexteEnvoye"

/** La fiche d'un clip, posée dans la quatrième colonne — la même largeur, les
 *  mêmes classes, la même grammaire que la fiche d'une image. */
export function FicheDuClip({
  generation,
  plan,
  personnages,
  depart,
  onFermer,
  onDecouper,
  onOuvrirLaBande,
  onOuvrir,
}: {
  generation: Generation
  plan: Pose[]
  personnages: Personnage[]
  /** L'asset dont le clip est parti, lorsqu'il est encore dans la
   *  bibliothèque. `null` tant qu'il n'y est plus — la fiche ne montre alors
   *  rien plutôt que de deviner. */
  depart: Asset | null
  onFermer: () => void
  /** Ouvrir le montage de ce clip. **Rien n'y dépense** : c'est la même
   *  garantie que le bouton de la tuile. */
  onDecouper: () => void
  /** Ouvrir une bande de ce clip dans l'atelier d'une animation (A7). */
  onOuvrirLaBande: (identifiant: string) => void
  /** Ouvrir la fiche d'une image — le sprite de départ. */
  onOuvrir: (identifiant: string) => void
}) {
  const clip = generation.clip
  /** Les bandes déjà taillées dans ce clip, ou `null` tant qu'elles n'ont pas
   *  été relues. Une fiche qui s'ouvre ne les connaît pas : la galerie n'en
   *  tient pas la liste, et la demander est le seul aller-retour de l'écran —
   *  une énumération, jamais une étude. */
  const [bandes, setBandes] = useState<Bande[] | null>(null)

  // **Changer de clip remet la fiche sur celui-là** — le même geste que la
  // fiche d'une image, qui se referme sur l'asset auquel elle tient.
  useEffect(() => {
    let vivant = true
    setBandes(null)
    if (!generation.clip) return
    api
      .bandesDuClip(generation.identifiant)
      .then((recu) => vivant && setBandes(recu.bandes))
      // Réseau coupé : la fiche se tait plutôt que de faire semblant, et le
      // reste — la vidéo, ce que le clip porte — ne dépend de rien.
      .catch(() => vivant && setBandes([]))
    return () => {
      vivant = false
    }
  }, [generation.identifiant])

  if (!clip) return null

  return (
    <aside
      {...PANNEAU}
      data-fiche-clip={generation.identifiant}
      className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-trait bg-papier-cote"
    >
      <EnTetePanneau>
        <span className="truncate">Le clip</span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="ml-auto text-encre-4 transition-colors duration-120 hover:text-encre"
        >
          ✕
        </button>
      </EnTetePanneau>

      {/* **La vidéo ne défile pas.** C'est le sujet du panneau : on vient voir
          le clip, et ce qu'on vient voir reste sous les yeux. Elle ne démarre
          pas en silence sur un écran plein de lecteurs : elle est la vignette
          de la fiche, et elle tourne — muette — comme la boucle du montage. */}
      <div className="flex items-center justify-center bg-pourtour px-2 py-2">
        <video
          key={generation.identifiant}
          src={api.videoDuClip(generation.identifiant)}
          controls
          loop
          autoPlay
          muted
          aria-label="la vidéo du clip, telle qu'elle est arrivée"
          className="max-h-60 w-auto object-contain"
        />
      </div>

      <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
        {/* **Le texte qui l'a fait** — le même rang que sur la fiche d'une
            image, où l'on lit d'où l'image vient. Ici c'est le texte anglais
            qui est parti, corrigé ou non par le tiroir : c'est lui, et
            personne d'autre, qui a écrit ce mouvement.
            **Se déplie au clic et se copie** (RV20) : il était coupé à une
            ligne, lisible en entier seulement en bulle au survol. */}
        <TexteEnvoye texte={generation.demande.prompt} />
        <p className="mesure truncate text-[10.5px] text-encre-4" title={generation.modele}>
          {nomDuModele(generation.modele)}
        </p>

        {clip.images > 0 ? (
          <div className="flex flex-col gap-1 border-t border-trait pt-2">
            <Libelle aide="clip.fiche">ce qu'il porte</Libelle>
            <p className="mesure text-[10.5px] leading-4 text-encre-2">
              {clip.images} images · {clip.cadence.toFixed(0)} i/s ·{" "}
              {clip.secondes} s demandées · {clip.proportions} · {clip.resolution}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 border-t border-trait pt-2">
            <Libelle aide="clip.fiche">ce qu'il porte</Libelle>
            <p className="mesure text-[10.5px] leading-4 text-encre-4">
              {clip.extraction_refus ?? "images non tirées"} — le clip, lui, reste
              payé et se découpera quand ce qui manque sera installé.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-trait pt-2">
          <Libelle aide="clip.fiche">ce qu'il a coûté</Libelle>
          <p className="mesure text-[10.5px] leading-4 text-encre-2">
            {depense(generation.consomme, generation.unite)}
          </p>
          {/* **Relu ou non, en toutes lettres** (A9) : le montant enregistré dit
              s'il a été relu chez le fournisseur ou déduit d'ailleurs, et un
              zéro faute de réponse ne s'écrit pas comme un zéro gratuit. */}
          <p
            className="mesure text-[10.5px] leading-4 text-encre-4"
            title={clip.montant_dit}
          >
            {clip.montant_dit}
          </p>
        </div>

        <CaseDuClip
          generation={generation}
          plan={plan}
          personnages={personnages}
        />

        {depart && (
          <div className="flex items-center gap-2 border-t border-trait pt-2">
            <button
              type="button"
              onClick={() => onOuvrir(depart.identifiant)}
              className="shrink-0"
              title="l'image dont ce clip est parti"
              aria-label="l'image dont ce clip est parti — ouvrir sa fiche"
            >
              <img
                src={vignetteAsset(depart, 96)}
                alt={depart.label}
                className="damier-papier h-[54px] w-[54px] rounded-5 border border-trait object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
            <div className="flex min-w-0 flex-col gap-1">
              <Libelle aide="clip.fiche">l'image dont il part</Libelle>
              <p className="mesure truncate text-[10.5px] leading-4 text-encre-4">
                {depart.label}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-trait pt-2">
          <Libelle aide="clip.fiche">les bandes qu'il a faites</Libelle>
          {bandes === null ? null : bandes.length === 0 ? (
            <p className="mesure text-[10.5px] leading-4 text-encre-4">
              aucune bande gardée — découper ce clip en fera la première.
            </p>
          ) : (
            bandes.map((bande) => (
              <BandeDeCeClip
                key={bande.identifiant}
                bande={bande}
                plan={plan}
                personnages={personnages}
                onOuvrirLaBande={onOuvrirLaBande}
              />
            ))
          )}
        </div>

        {/* **La porte, et la garantie.** Découper se prend ici comme sur la
            tuile — la fiche n'interdit pas le chemin court — et rien ne
            dépense : le clip est déjà payé, et c'est la même phrase que le
            pied du montage. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-trait pt-2">
          <Bouton onClick={onDecouper} enfants="Découper ›" />
          <p className="mesure text-[10.5px] leading-4 text-encre-4">
            rien ici ne dépense — le clip est déjà payé, et garder ou jeter
            restent les gestes de la grille.
          </p>
        </div>
      </div>
    </aside>
  )
}

/** La case du plan de poses que le clip anime, et le mouvement inscrit à la
 *  commande — résolus en noms, comme la fiche d'une image résout les siens.
 *  L'identifiant reste au bout du `title` : il est vrai même quand le
 *  catalogue est hors ligne. */
function CaseDuClip({
  generation,
  plan,
  personnages,
}: {
  generation: Generation
  plan: Pose[]
  personnages: Personnage[]
}) {
  const porteur = personnages.find((p) => p.identifiant === generation.personnage)
  const pose = plan.find((p) => p.identifiant === generation.pose)
  const bits = [porteur?.nom, pose?.nom, generation.direction].filter(Boolean)
  const mouvement = generation.demande.mouvement
  if (bits.length === 0 && !mouvement) return null
  return (
    <div className="flex flex-col gap-1 border-t border-trait pt-2">
      <Libelle aide="clip.fiche">ce qu'il anime</Libelle>
      {bits.length > 0 && (
        <p
          className="mesure truncate text-[10.5px] leading-4 text-encre-2"
          title={[generation.personnage, generation.pose, generation.direction ?? ""]
            .filter(Boolean)
            .join(" · ")}
        >
          {bits.join(" · ")}
        </p>
      )}
      {mouvement && (
        <p className="mesure truncate text-[10.5px] leading-4 text-encre-4">
          mouvement : {mouvement}
        </p>
      )}
    </div>
  )
}

/** Une bande déjà taillée dans ce clip — son nom, la case qu'elle remplit, et
 *  une ouverture vers l'atelier d'une animation (A7), où elle se retravaille
 *  sans refaire le montage. */
function BandeDeCeClip({
  bande,
  plan,
  personnages,
  onOuvrirLaBande,
}: {
  bande: Bande
  plan: Pose[]
  personnages: Personnage[]
  onOuvrirLaBande: (identifiant: string) => void
}) {
  const porteur = personnages.find((p) => p.identifiant === bande.personnage)
  const pose = plan.find((p) => p.identifiant === bande.pose)
  const caseNom = [porteur?.nom, pose?.nom, bande.direction].filter(Boolean).join(" · ")
  return (
    <button
      type="button"
      onClick={() => onOuvrirLaBande(bande.identifiant)}
      className="mesure flex min-w-0 items-baseline gap-x-2 gap-y-0.5 text-left text-[10.5px] text-signal hover:opacity-70"
      title="ouvrir cette animation dans l'atelier"
    >
      <span className="truncate">{bande.nom}</span>
      {!bande.brouillon && caseNom && (
        <span className="truncate text-encre-4">{caseNom}</span>
      )}
      {bande.melangee && <span className="shrink-0 text-encre-4">mélangée</span>}
    </button>
  )
}