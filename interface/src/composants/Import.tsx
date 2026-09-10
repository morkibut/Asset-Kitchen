// Faire entrer une image depuis l'écran — R3 (US-167 à US-170).
//
// **Le geste que l'agent a depuis T7 et que l'écran n'avait jamais eu.** Un
// bouton dans la barre d'outils, et le glisser-déposer sur la grille : les deux
// appellent le même service que l'outil MCP, et il n'y a donc toujours qu'un
// seul endroit du produit qui fasse entrer une image.
//
// **Un appel par fichier, et chacun répond pour lui-même.** C'est la décision
// de T4 reconduite telle quelle : douze fichiers déposés font douze réponses,
// donc onze images qui entrent et un refus qui nomme la douzième. Un lot unique
// aurait fait attendre les onze premières que la douzième soit lue, et aurait
// dû inventer une forme de réponse partielle.

import { useState, type Ref } from "react"
import { api, Refus, type Asset } from "../api"
import { POINTILLE, useInfobulle } from "./Infobulle"

/** Ce qui n'est pas entré, et pourquoi. **Une entrée par fichier**, parce que
 *  c'est ce que « chacun avec son propre sort » veut dire : dix fichiers
 *  déposés peuvent donner huit images, un refus et un doublon, et les trois
 *  issues doivent se lire ensemble.
 *
 *  `fichier` n'est gardé que pour le doublon, et il l'est pour une raison
 *  précise : forcer l'import redemande les octets, et un `File` venu d'un dépôt
 *  reste lisible tant qu'on le tient. Le tableau d'inspiration, lui, va les
 *  rechercher sur la carte existante — il n'avait pas le fichier sous la main. */
export type EnAttente =
  | { genre: "refus"; nom: string; raison: string }
  | { genre: "doublon"; nom: string; asset: Asset; fichier: File }

export function useImport({
  onErreur,
  onEntree,
}: {
  /** Ce qui ne se range dans aucune des deux issues — l'atelier ne répond pas,
   *  par exemple. Il va à la barre d'état, comme toute panne. */
  onErreur: (raison: string) => void
  /** Une image est entrée. La grille se redemande — le serveur l'annonce aussi
   *  par le flux, mais l'onglet qui a fait le geste ne doit pas attendre. */
  onEntree: () => void
}) {
  /** **« Telle quelle » est le défaut, et c'est une correction** (US-170) :
   *  l'import héritait de la recette du projet en silence, donc une référence
   *  de 2048 pixels revenait à 64 sans que personne l'ait demandé.
   *
   *  Le choix vit ici, pour la séance, et pas dans un dialogue qui s'ouvrirait
   *  à chaque dépôt : le produit n'a aucune boîte modale, et douze fichiers
   *  déposés ensemble poseraient douze fois la même question. */
  const [traiter, setTraiter] = useState(false)
  const [attente, setAttente] = useState<EnAttente[]>([])

  const oublier = (rang: number) =>
    setAttente((deja) => deja.filter((_, i) => i !== rang))

  const entrer = async (fichier: File, forcer = false) => {
    try {
      const entree = await api.televerser(fichier, { traiter, forcer })
      if (entree.doublon)
        setAttente((deja) => [
          ...deja,
          {
            genre: "doublon",
            nom: fichier.name,
            asset: entree.doublon as Asset,
            fichier,
          },
        ])
      else onEntree()
    } catch (erreur) {
      // **Le refus nomme le fichier, et il vient du serveur** (US-169) : c'est
      // lui qui a regardé les octets, et sa phrase porte déjà le nom. L'écran
      // ne devine pas ce qui est une image — il l'a essayé.
      if (erreur instanceof Refus)
        setAttente((deja) => [
          ...deja,
          { genre: "refus", nom: fichier.name, raison: erreur.message },
        ])
      else onErreur("l'atelier ne répond pas")
    }
  }

  /** Faire entrer plusieurs fichiers, **sans attendre les uns les autres**.
   *  Le serveur sérialise ce qu'il veut ; l'écran, lui, ne doit pas se figer
   *  sur un fichier de dix mégaoctets pendant que les onze autres attendent. */
  const entrerTous = (fichiers: Iterable<File>) => {
    for (const fichier of fichiers) void entrer(fichier)
  }

  return { traiter, setTraiter, attente, oublier, entrer, entrerTous }
}

export type Import = ReturnType<typeof useImport>

/** Le bouton, et le fait que le sort de ce qui entre énonce.
 *
 *  **Deux contrôles, pas un menu.** Le libellé du second dit *ce qui se
 *  passera*, pas ce que le clic ferait — c'est la forme qu'a déjà prise le
 *  détourage d'une échelle dans le barème (« se détoure et vit dans une case »
 *  contre « plein cadre, aucun détourage »), et c'est la seule qui se lise sans
 *  avoir à l'essayer.
 *
 *  **`brute` et non « telle quelle », et ce n'est pas une abréviation.** C'est
 *  le mot que la visionneuse de la fiche emploie déjà pour exactement la même
 *  chose — l'image telle qu'elle est arrivée, avant toute recette. Reprendre le
 *  vocabulaire du produit vaut mieux que d'en inventer un second, et il se
 *  trouve qu'il tient dans la barre : mesurée à 1280 px panneaux ouverts, elle
 *  déborde de 32 px avec « telle quelle », et pas avec celui-ci. Le cran de
 *  zoom 4× passait derrière un défilement pour un mot plus long.
 *
 *  Il est ancré à droite, contre l'export, et pour la raison qui y a mis
 *  l'export : ce sont les deux portes de la bibliothèque, et une porte qui se
 *  déplace est une porte qu'on cherche. */
export function Importer({ etat }: { etat: Import }) {
  // **Ni l'un ni l'autre n'épingle** : leur clic est déjà pris — le premier
  // bascule le sort de ce qui entre, le second ouvre le sélecteur de fichiers.
  // Même règle qu'un en-tête de bloc, et pour la même raison.
  const surLeChoix = useInfobulle("atelier.import.traitement", { epinglable: false })
  const surLeBouton = useInfobulle("atelier.import", { epinglable: false })
  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-pressed={etat.traiter}
        onClick={() => etat.setTraiter(!etat.traiter)}
        {...surLeChoix.declencheurs}
        className={[
          "mesure whitespace-nowrap text-[10px] transition-colors duration-[80ms]",
          etat.traiter ? "text-signal-froid" : "text-texte-3 hover:text-texte-2",
        ].join(" ")}
      >
        <span
          ref={surLeChoix.ancre as Ref<HTMLSpanElement>}
          className={`w-fit ${surLeChoix.presente ? POINTILLE : ""}`}
        >
          {etat.traiter ? "traitée" : "brute"}
        </span>
      </button>
      {surLeChoix.bulle}
      {/* Un `label` plutôt qu'un bouton qui clique un champ caché : le
          navigateur ouvre alors le sélecteur de lui-même, sans que l'écran
          n'ait à tenir une référence sur un élément qu'il ne rend pas. */}
      <label
        {...surLeBouton.declencheurs}
        className="mesure h-[26px] cursor-pointer rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[11px] leading-[24px] text-texte transition-colors duration-[80ms] hover:bg-fond-3"
      >
        <span
          ref={surLeBouton.ancre as Ref<HTMLSpanElement>}
          className={surLeBouton.presente ? POINTILLE : ""}
        >
          Importer
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          aria-label="Importer des images"
          className="hidden"
          onChange={(e) => {
            etat.entrerTous(e.target.files ?? [])
            // Le champ garde ce qu'on lui a donné : sans ça, redéposer le même
            // fichier ne déclencherait rien la seconde fois.
            e.target.value = ""
          }}
        />
      </label>
      {surLeBouton.bulle}
    </span>
  )
}

/** Ce qui n'est pas entré — **une ligne par fichier**, et chacune porte son sort.
 *
 *  Un bandeau plutôt qu'une fente : il n'y a pas de fente pour ça au-dessus de
 *  la grille, et le tableau d'inspiration en a déjà un pour très exactement le
 *  même message. Il n'ajoute de hauteur que lorsqu'il a quelque chose à dire,
 *  et il disparaît dès qu'on a tranché.
 *
 *  **Le doublon n'est pas un refus** (US-169) : il propose, il n'empêche pas.
 *  D'où deux gestes et non un — voir l'existante, ou faire entrer quand même. */
export function CeQuiNEstPasEntre({
  etat,
  onOuvrir,
}: {
  etat: Import
  /** Aller voir l'image qui est déjà là. La fiche s'ouvre, et le bandeau part —
   *  il a fait ce qu'il avait à faire. */
  onOuvrir: (identifiant: string) => void
}) {
  if (etat.attente.length === 0) return null
  return (
    <div className="defile flex max-h-[76px] shrink-0 flex-col overflow-y-auto border-b border-bord bg-fond-1 px-4 py-1">
      {etat.attente.map((une, rang) => (
        <p
          key={`${une.nom}-${rang}`}
          className={[
            "mesure flex h-[24px] shrink-0 items-center gap-2 text-[10px]",
            une.genre === "refus" ? "text-echec-froid" : "text-epingle",
          ].join(" ")}
        >
          <span
            aria-hidden
            className={[
              "inline-block h-px w-2",
              une.genre === "refus" ? "bg-echec-froid" : "bg-epingle",
            ].join(" ")}
          />
          {une.genre === "refus" ? (
            <span className="truncate">{une.raison}</span>
          ) : (
            <>
              <span className="truncate">
                « {une.nom} » est déjà dans la bibliothèque
              </span>
              <button
                type="button"
                onClick={() => {
                  onOuvrir(une.asset.identifiant)
                  etat.oublier(rang)
                }}
                className="shrink-0 text-signal-froid hover:text-signal-froid-clair"
              >
                La voir ›
              </button>
              <span className="text-texte-3">·</span>
              <button
                type="button"
                onClick={() => {
                  etat.oublier(rang)
                  void etat.entrer(une.fichier, true)
                }}
                className="shrink-0 text-signal-froid hover:text-signal-froid-clair"
              >
                Importer quand même ›
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => etat.oublier(rang)}
            aria-label={`Oublier « ${une.nom} »`}
            className="ml-auto shrink-0 text-texte-3 hover:text-texte-2"
          >
            ✕
          </button>
        </p>
      ))}
    </div>
  )
}
