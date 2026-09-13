// Commander un clip — l'écran où l'animation se paie (A9, V3).
//
// C'est le premier moment de `docs/archive/maquettes-v3/01-du-sprite-a-la-bande.html` :
// à gauche l'image de départ et le mouvement, au milieu ce qu'on va recevoir et
// dans quel format, à droite les modèles avec leur prix et le bouton qui porte
// le montant. **Rien ne part tant qu'on n'a pas appuyé sur le bouton du tiroir.**
//
// ── Ce qu'il change à une règle du produit, et pourquoi c'est assumé ────────
//
// Le produit tenait jusqu'ici *deux lieux seulement d'où l'argent part* : la
// barre qui paie, qui sert l'établi et le codex. Cet écran-ci en est un
// troisième, et c'est la V3 qui l'ouvre — on ne peut pas commander une
// animation depuis une barre de saisie faite pour des images, parce qu'on n'y
// choisit ni durée, ni format, ni image de départ obligatoire.
//
// **Ce qui tenait derrière la règle tient toujours, et c'est ce qui compte.**
// L'argent ne part jamais sans un écran qui recouvre le produit, montre
// exactement ce qui va partir, et porte le montant sur son bouton. C'était vrai
// de l'écran de confirmation ; c'est vrai de celui-ci, qui est sa moitié vidéo.
// Ce qui passe de deux à trois est un compte, pas une garantie.
//
// ── Deux choses le distinguent de l'écran de confirmation ──────────────────
//
// 1. **Le prix porte la formule qui le produit.** Un modèle vidéo se facture au
//    jeton — hauteur × largeur × images par seconde × durée —, et un prix qui se
//    calcule doit pouvoir se vérifier. Un montant seul serait à croire sur
//    parole.
// 2. **Chaque modèle dit ce que ce dépôt a mesuré de lui.** Aucun des trois
//    n'atteint la barre des huit tirages : ce sont des propositions étayées,
//    pas un arbitrage clos, et l'écran le dit à l'endroit où l'on choisit
//    plutôt que de faire passer une hypothèse pour un résultat.
//
// ── V3.01.1 : la relecture avant la dépense ─────────────────────────────────
//
// L'usage a montré ce qui manquait : on lisait le texte du mouvement sur cet
// écran, mais on ne pouvait pas le corriger, et l'argent partait d'un clic sur
// un écran plein de réglages. Le bouton « Commander ce clip » ouvre donc un
// **tiroir de relecture** entre lui et la dépense — la même place que l'écran
// des images, et le même contrat : ce qui part, mot pour mot, corrigeable pour
// cet appel seulement ; et ce qui ne part jamais, nommé — l'image de départ,
// qui reste obligatoire et le dit. Rien ne part tant que le bouton du tiroir
// n'a pas été pressé, et le mouvement de la bibliothèque ne bouge pas : une
// correction est un geste pour cet appel, comme partout dans le produit.
//
// ── Ce qu'A11 y ajoute, et l'invariant qu'il ne casse pas ──────────────────
//
// Un des modèles de la liste tourne sur la machine de l'auteur et ne coûte pas
// d'argent. **L'invariant tient tel quel — rien ne part sans que ce que ça coûte
// soit annoncé —, il change seulement d'unité** : le bouton porte un temps au
// lieu d'un montant, et ce temps est mesuré, pas deviné.
//
// Ce modèle-là est dans la même liste que les autres, avec le même geste pour le
// choisir. Une liste à part en ferait une option de réglages, et ce n'en est
// pas une : c'est une façon de produire un clip parmi trois.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  api,
  dollars,
  type Asset,
  type AttenteVideo,
  type BaseModelesVideo,
  type EtatDuMoteur,
  type Generation,
  type ImageDeDepart,
  type ModeleVideo,
  type Mouvement,
  type Personnage,
  type Pose,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { Bouton, Libelle, Raison } from "./pieces"

/** La case qu'on vient animer. **La pose peut manquer** : on anime aussi un
 *  personnage sans viser d'attitude — c'est alors son portrait qui part. */
export type CibleDuClip = {
  personnage: Personnage
  pose: Pose | null
  direction: { identifiant: string; nom: string } | null
}

/** Les durées que l'écran propose. **Elles ne remplacent pas le catalogue** :
 *  un modèle qui ne fait pas cinq secondes le dit lui-même, et se grise avec sa
 *  raison. Ce qui est ici est ce qu'on peut demander, pas ce qui est possible. */
const DUREES = [1, 2, 3, 4, 5, 6] as const
const PROPORTIONS = [
  { cle: "1:1", nom: "carré" },
  { cle: "16:9", nom: "16:9" },
  { cle: "9:16", nom: "9:16" },
] as const
const RESOLUTIONS = [
  { cle: "480p", nom: "petit format" },
  { cle: "720p", nom: "grand format" },
] as const

/** Combien de clips d'un coup. **Un est le défaut, et le produit n'impose
 *  jamais un lot** : c'est tout ce qui reste de l'ancienne tranche `A3`. */
const LOTS = [1, 2, 4, 8] as const

/** Une taille de fichier telle qu'elle s'écrit en français. **La virgule n'est
 *  pas un détail** : le serveur écrit « 8,9 Go » dans sa phrase, et un bouton
 *  qui dirait « 8.9 Go » juste au-dessous ferait douter que les deux parlent du
 *  même chiffre. */
function gigas(valeur: number): string {
  return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Go`
}

/** Ce qu'un lot de `nombre` clips prendra de temps, **et il ne se multiplie pas
 *  comme un prix** : le premier tirage charge le modèle en mémoire, les suivants
 *  non. Le serveur envoie les deux mesures — le rapport entre elles ne se
 *  calcule pas, il se mesure.
 *
 *  ⚠️ **Un seul endroit le calcule**, et c'est délibéré : le bouton d'envoi et la
 *  carte du modèle affichent le même nombre, et deux formules pour un seul
 *  chiffre finissent toujours par ne plus donner le même. */
function attenteDeLot(attente: AttenteVideo | null, nombre: number): number | null {
  if (!attente) return null
  if (nombre <= 1) return attente.secondes
  return attente.secondes + (nombre - 1) * (attente.secondes_suivant || attente.secondes)
}

/** Une durée en toutes lettres. **Jamais un nombre de secondes nu** au-delà de
 *  la minute : « 442 s » ne se lit pas, « 7 min » se lit. */
export function duree(secondes: number): string {
  if (secondes < 60) return `${Math.round(secondes)} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste ? `${heures} h ${reste} min` : `${heures} h`
}

export function EcranClip({
  cible,
  onFermer,
  onCommande,
}: {
  cible: CibleDuClip
  onFermer: () => void
  /** Les clips partis. `App` referme l'écran et les regarde arriver dans la
   *  galerie : ils y tiennent déjà leur place, comme n'importe quel appel. */
  onCommande: (clips: Generation[]) => void
}) {
  // ── Ce qu'on demande ──────────────────────────────────────────────────────
  const [secondes, setSecondes] = useState<number>(5)
  const [proportions, setProportions] = useState<string>("1:1")
  const [resolution, setResolution] = useState<string>("480p")
  const [nombre, setNombre] = useState<number>(1)
  const [modele, setModele] = useState<string | null>(null)

  // ── Ce que le serveur répond ──────────────────────────────────────────────
  const [depart, setDepart] = useState<ImageDeDepart | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [mouvement, setMouvement] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<BaseModelesVideo | null>(null)

  // ── Le filtre de la liste (V3.01.2) ──────────────────────────────────────
  //
  // **Allumé par défaut** : la colonne ne montre que ce qui peut partir, et la
  // liste reste courte — le cas d'école étant un atelier sans clé, où vingt-huit
  // cartes grisées avaleraient tout. Éteint, elles reparaissent, intercalées
  // par prix avec leur raison : le choix *n'est* pas possible, mais la lecture
  // de ce qui manque l'est, à l'endroit où l'on choisit.
  const [seulementPossibles, setSeulementPossibles] = useState(true)

  // ── L'état de l'écran ─────────────────────────────────────────────────────
  const [refus, setRefus] = useState<string | null>(null)
  const [enVol, setEnVol] = useState(false)
  const [choixOuvert, setChoixOuvert] = useState(false)
  /** L'image choisie à la main, qui remplace la proposition. `null` tant qu'on
   *  n'a rien changé — et c'est ce qui fait que la proposition se remet à
   *  suivre la case quand on change de case. */
  const [choisie, setChoisie] = useState<Asset | null>(null)

  // ── Le tiroir de relecture (V3.01.1) ──────────────────────────────────────
  //
  // Le bouton « Commander ce clip » l'ouvre au lieu d'envoyer, et c'est le
  // bouton du tiroir qui part. **La correction vit ici et ne remonte nulle
  // part** : `null` veut dire *rien corrigé* — le serveur relit alors le
  // mouvement de la bibliothèque, et le texte anglais ne se duplique nulle
  // part (A6).
  const [confirmer, setConfirmer] = useState(false)
  const [texteCorrige, setTexteCorrige] = useState<string | null>(null)

  const personnage = cible.personnage
  const pose = cible.pose

  // **Échap referme le tiroir avant de refermer l'écran** — la même touche que
  // sur l'écran de confirmation, et pour la même raison : le dernier écran
  // avant l'argent doit pouvoir se quitter sans chercher un bouton. Deux
  // niveaux, deux Échap : le tiroir rend la main à l'écran de commande, qui
  // rend la main à l'établi.
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape" && !evenement.defaultPrevented) {
        if (confirmer) setConfirmer(false)
        else onFermer()
      }
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer, confirmer])

  // ── La proposition d'image de départ ──────────────────────────────────────
  //
  // **Elle se redemande quand la case change, et seulement alors.** La règle
  // vit au serveur — la case visée si elle porte une image, le portrait
  // sinon —, et l'écran ne la rejoue jamais : deux endroits qui choisissent
  // l'image de départ finiraient par en montrer deux.
  useEffect(() => {
    let vivant = true
    api
      .imageDeDepart(
        personnage.identifiant,
        pose?.identifiant ?? null,
        cible.direction?.identifiant ?? null,
      )
      .then((recu) => {
        if (!vivant) return
        setDepart(recu)
        setChoisie(null)
      })
      .catch((erreur) =>
        setRefus(
          erreur instanceof Error ? erreur.message : "l'image de départ ne vient pas",
        ),
      )
    return () => {
      vivant = false
    }
  }, [personnage.identifiant, pose?.identifiant, cible.direction?.identifiant])

  // ── Le mouvement ──────────────────────────────────────────────────────────
  //
  // La liste vient d'`A6` et n'appartient à aucun jeu. **Le mouvement de départ
  // est celui qui porte le nom de la pose visée**, et c'est le serveur qui
  // apparie : l'écran ne recolle jamais une pose à un mouvement de son côté.
  useEffect(() => {
    let vivant = true
    api
      .mouvements()
      .then((base) => vivant && setMouvements(base.mouvements))
      .catch(() => vivant && setMouvements([]))
    return () => {
      vivant = false
    }
  }, [])

  useEffect(() => {
    if (!pose) return
    let vivant = true
    api
      .mouvementDeLaPose(pose.identifiant)
      .then((recu) => {
        if (vivant && recu.mouvement) setMouvement(recu.mouvement.identifiant)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [pose?.identifiant])

  // ── Le catalogue et son prix ──────────────────────────────────────────────
  //
  // **Le prix se recalcule à chaque changement de format.** Une seconde de
  // plus, une résolution de plus, et il change : un catalogue chiffré une fois
  // au démarrage annoncerait le prix d'autre chose que ce qu'on va demander.
  const relireLeCatalogue = useCallback(() => {
    let vivant = true
    api
      .modelesVideo(secondes, resolution, proportions)
      .then((recu) => {
        if (!vivant) return
        setCatalogue(recu)
        // Le premier modèle non grisé, et rien d'autre : on ne préselectionne
        // pas un modèle que la demande courante rend impossible.
        setModele((deja) => {
          const possible = recu.modeles.filter((m) => m.grise === null)
          if (deja && possible.some((m) => m.identifiant === deja)) return deja
          return possible[0]?.identifiant ?? null
        })
      })
      .catch((erreur) =>
        setRefus(
          erreur instanceof Error ? erreur.message : "le catalogue vidéo ne répond pas",
        ),
      )
    return () => {
      vivant = false
    }
  }, [secondes, resolution, proportions])

  useEffect(relireLeCatalogue, [relireLeCatalogue])

  const choisi = catalogue?.modeles.find((m) => m.identifiant === modele) ?? null
  const texte = mouvements.find((m) => m.identifiant === mouvement)?.texte ?? ""
  const image = choisie ?? depart?.asset ?? null

  // **Ce que la colonne montre : la liste triée du serveur, filtrée par le
  // réglage du dessus.** L'écran ne trie rien — l'ordre arrive déjà fait, avec
  // son prix —, il range seulement ce qui ne peut pas partir.
  const modelesVisibles = (catalogue?.modeles ?? []).filter(
    (m) => !seulementPossibles || m.grise === null,
  )
  const grisesMasquees = (catalogue?.modeles.length ?? 0) - modelesVisibles.length

  // **Le montant du lot, jamais celui d'un clip seul** : c'est ce qui va
  // partir, et l'annoncer à l'unité ferait payer quatre fois ce qu'on a lu une
  // fois. `null` quand le prix n'a pas pu être relu — le modèle est alors grisé.
  const montant =
    choisi?.prix.montant !== null && choisi?.prix.montant !== undefined
      ? choisi.prix.montant * nombre
      : null

  const attente = choisi?.attente ?? null
  const attenteDuLot = attenteDeLot(attente, nombre)

  // **Ce qui va s'écrire sur le bouton, en une seule décision.** Un modèle
  // coûte de l'argent ou du temps, jamais les deux, et jamais rien : l'écran
  // écrit ce qu'il a plutôt que de choisir entre deux formules à trois endroits.
  const cout =
    attenteDuLot !== null
      ? `≈ ${duree(attenteDuLot)}`
      : montant !== null
        ? `≈ ${dollars(montant)}`
        : null

  const empeche = !image
    ? "un clip part toujours d'une image : choisissez-en une"
    : !texte
      ? "choisissez un mouvement — c'est lui qui écrit ce qui part"
      : !choisi
        ? "aucun modèle vidéo ne peut honorer cette demande"
        : (choisi.grise ?? null)

  // Le texte que le tiroir montre et envoie : la correction si elle existe,
  // le texte du mouvement sinon. Le tiroir seul décide, et ce calcul n'existe
  // nulle part ailleurs.
  const texteFinal = (texteCorrige ?? texte).trim()

  // **Le dernier geste — dans le tiroir, jamais ici.** `commander` au sens
  // d'avant n'existe plus : le bouton de cet écran ouvre la relecture, et c'est
  // le bouton du tiroir qui envoie. La correction part telle quelle, et le
  // mouvement reste dans l'appel : le serveur l'inscrit sur la génération pour
  // que le montage sache quoi tailler dans le clip.
  const partir = async () => {
    if (enVol || !image || !choisi || !texteFinal) return
    setRefus(null)
    setEnVol(true)
    try {
      const { clips } = await api.commanderClips({
        modele: choisi.identifiant,
        asset: image.identifiant,
        // **La correction, et rien d'autre.** Sans correction, `prompt` reste
        // absent et le serveur relit le mouvement (A6) : deux chemins vers le
        // même texte partiraient en un troisième.
        prompt: texteCorrige ?? undefined,
        mouvement,
        secondes,
        resolution,
        proportions,
        nombre,
        personnage: personnage.identifiant,
        pose: pose?.identifiant ?? null,
        direction: cible.direction?.identifiant ?? null,
      })
      onCommande(clips)
    } catch (erreur) {
      // **L'échec se lit là où l'on a cliqué**, et il ne grise pas le bouton :
      // ce qu'on veut faire d'un appel qui n'est pas parti est le refaire.
      setRefus(erreur instanceof Error ? erreur.message : "le clip n'est pas parti")
      setEnVol(false)
    }
  }

  if (confirmer && choisi) {
    return (
      <ConfirmationClip
        texte={texte}
        texteCorrige={texteCorrige}
        onCorriger={setTexteCorrige}
        onRemettre={() => setTexteCorrige(null)}
        image={image}
        onChangerImage={(asset) => setChoisie(asset)}
        secondes={secondes}
        proportions={proportions}
        resolution={resolution}
        nombre={nombre}
        modele={choisi}
        montant={montant}
        attente={attente}
        attenteDuLot={attenteDuLot}
        cout={cout}
        texteFinal={texteFinal}
        enVol={enVol}
        refus={refus}
        onRevenir={() => setConfirmer(false)}
        onPartir={() => void partir()}
      />
    )
  }

  const ou = cible.direction ? ` · ${cible.direction.nom}` : ""

  return (
    <div
      data-clip
      className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_380px] bg-papier"
    >
      {/* ── L'image de départ et le mouvement ─────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-trait p-4">
        <div className="flex items-baseline gap-2">
          <Libelle aide="clip.depart">l'image de départ</Libelle>
          <button
            type="button"
            onClick={onFermer}
            title="Échap revient sans rien dépenser"
            className="mesure ml-auto px-1 text-[10px] text-encre-4 hover:text-encre"
          >
            ‹ revenir
          </button>
        </div>

        <ImageDeDepartVue asset={image} />

        <p className="text-[11px] leading-relaxed text-encre-3">
          {choisie
            ? `${choisie.label} — choisie à la main.`
            : (depart?.raison ?? "…")}
        </p>
        <p className="mesure text-[10px] leading-4 text-encre-4">
          Le sprite est agrandi sur la toile du format demandé avant de partir :
          un modèle qui rend du grand format inventerait tout ce qu'il ne voit
          pas d'un sprite de soixante-quatre pixels.
        </p>

        <button
          type="button"
          onClick={() => setChoixOuvert((o) => !o)}
          className="mesure self-start text-[10px] text-signal hover:opacity-70"
        >
          {choixOuvert ? "fermer la bibliothèque" : "changer d'image ›"}
        </button>

        {choixOuvert && (
          <ChoixDansLaBibliotheque
            onChoisir={(asset) => {
              setChoisie(asset)
              setChoixOuvert(false)
            }}
          />
        )}

        <div className="mt-2 border-t border-trait pt-3">
          <Libelle aide="mouvement.texte">le mouvement</Libelle>
        </div>
        <select
          value={mouvement ?? ""}
          onChange={(e) => setMouvement(e.target.value || null)}
          aria-label="Le mouvement"
          className="mesure h-[30px] rounded-[2px] border border-contour bg-carte px-2 text-[11px] text-encre"
        >
          <option value="">— aucun —</option>
          {mouvements.map((m) => (
            <option key={m.identifiant} value={m.identifiant}>
              {m.nom}
            </option>
          ))}
        </select>

        {/* **Le texte qui part se lit avant l'envoi.** Il n'est pas retapé
            ici : c'est celui de la bibliothèque de mouvements, et c'est très
            exactement celui que le serveur enverra — l'écran envoie le
            mouvement, pas le texte. */}
        <p
          data-texte-du-clip
          className="mesure rounded-[2px] border border-trait bg-carte p-2 text-[10.5px] leading-4 text-encre-3"
        >
          {texte || "choisissez un mouvement pour lire ce qui partira"}
        </p>
        <p className="mesure text-[10px] leading-4 text-encre-4">
          C'est le texte anglais du mouvement, écrit une fois dans les Réglages
          et jamais retapé ici. Le corriger pour tous les clips suivants se fait
          là-bas.
        </p>
      </aside>

      {/* ── Ce qu'on va recevoir, et dans quel format ──────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        <div>
          <h2 className="text-[15px] text-encre">
            Animer {personnage.nom}
            {pose ? ` — ${pose.nom}${ou}` : ""}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-encre-3">
            Un clip part d'une image et revient en vidéo. Vous en découperez
            ensuite autant d'animations que vous voudrez, sans repayer.
          </p>
        </div>

        <table className="w-full text-[11.5px] leading-relaxed text-encre-3">
          <tbody>
            <tr>
              <td className="w-[130px] py-1 align-top text-encre">Un clip</td>
              <td className="py-1">
                {secondes} seconde{secondes > 1 ? "s" : ""},{" "}
                {PROPORTIONS.find((p) => p.cle === proportions)?.nom ?? proportions},{" "}
                {RESOLUTIONS.find((r) => r.cle === resolution)?.nom ?? resolution}.
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top text-encre">Ses images</td>
              <td className="py-1">
                {/* **Le compte réel, quand le modèle en impose un.** Celui de la
                    maison n'accepte que certains nombres d'images et arrondit
                    vers le haut ; il est calculé au serveur, parce que la règle
                    est une contrainte du moteur et que deux endroits qui la
                    calculent finiraient par ne plus donner le même nombre. */}
                {choisi?.images_par_duree?.[String(secondes)] ? (
                  <>
                    <strong className="text-encre">
                      {choisi.images_par_duree[String(secondes)]} images
                    </strong>{" "}
                    — le moteur n'accepte que certains comptes et prend celui du
                    dessus, jamais celui du dessous : un clip plus court que
                    demandé serait un geste à refaire. Elles sont{" "}
                  </>
                ) : null}
                tirées à l'arrivée, une fois, et rangées à côté du clip.
                {catalogue?.decodeur && (
                  <>
                    {" "}
                    <span className="text-encre-attention">{catalogue.decodeur}</span> —
                    le clip s'achète quand même, il reste payé, et ses images se
                    tireront le jour où ce qui manque sera là.
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top text-encre">L'attente</td>
              <td className="py-1">
                {attenteDuLot === null ? (
                  <>
                    deux minutes environ. <strong className="text-encre">Vous
                    pouvez fermer l'atelier</strong> : le clip continue de se
                    fabriquer chez le fournisseur, et vous le retrouverez.
                  </>
                ) : (
                  <>
                    <strong className="text-encre">
                      {duree(attenteDuLot)}
                    </strong>{" "}
                    {nombre > 1 ? "pour les " + nombre + " ensemble" : "environ"}.{" "}
                    {/* ⚠️ **Ce qui change par rapport à un clip payé, et qui se
                        dit ici plutôt que d'être découvert.** Un clip payé se
                        fabrique ailleurs ; celui-ci se fabrique sur cette
                        machine. L'atelier peut se fermer — c'est l'autre
                        fenêtre qui travaille —, mais la carte graphique est
                        prise, et laisser la phrase d'à côté le passerait sous
                        silence. */}
                    Il se fabrique <strong className="text-encre">sur cette
                    machine</strong>, dans la fenêtre du moteur. Vous pouvez
                    fermer l'atelier ; ne fermez pas celle-là, et attendez-vous à
                    ce que le reste de l'ordinateur rame pendant ce temps.
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="rounded-[2px] border-l-2 border-signal bg-carte p-3 text-[11.5px] leading-relaxed text-encre-3">
          <strong className="text-encre">Ce clip n'hérite que de votre
          sprite.</strong> Ni les textes du jeu, ni ses images d'ambiance ne
          partent avec lui : un modèle vidéo ne prend qu'une seule image, et
          c'est celle du personnage.
        </p>

        <div className="flex flex-col gap-2 border-t border-trait pt-4">
          <Libelle aide="clip.format">le format</Libelle>
          <Choix
            valeurs={DUREES.map((d) => ({
              cle: String(d),
              nom: d === secondes ? `${d} secondes` : `${d} s`,
            }))}
            valeur={String(secondes)}
            onChange={(v) => setSecondes(Number(v))}
          />
          <Choix
            valeurs={PROPORTIONS.map((p) => ({ cle: p.cle, nom: p.nom }))}
            valeur={proportions}
            onChange={setProportions}
          />
          <Choix
            valeurs={RESOLUTIONS.map((r) => ({ cle: r.cle, nom: r.nom }))}
            valeur={resolution}
            onChange={setResolution}
          />
          <p className="mesure text-[10px] leading-4 text-encre-4">
            Le carré coûte près de moitié moins que le format large et cadre
            mieux un personnage seul. Le prix se recalcule à chaque changement,
            à droite.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-trait pt-4">
          <Libelle aide="clip.lot">combien de clips</Libelle>
          <Choix
            valeurs={LOTS.map((n) => ({ cle: String(n), nom: String(n) }))}
            valeur={String(nombre)}
            onChange={(v) => setNombre(Number(v))}
          />
          <p className="mesure text-[10px] leading-4 text-encre-4">
            Un même texte ne rend jamais deux fois le même clip. En lancer
            plusieurs et n'en garder qu'un est un geste ordinaire ici — et{" "}
            <strong className="text-encre-3">
              chacun se paie, y compris ceux qu'on jette
            </strong>
            . Ils reviennent un par un, et chacun se voit dès son arrivée.
          </p>
        </div>
      </section>

      {/* ── Qui peut le faire, et pour combien ─────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-trait p-4">
        <Libelle aide="clip.prix">qui peut le faire</Libelle>

        {catalogue === null && (
          <p className="mesure text-[10px] text-encre-4">on demande…</p>
        )}
        {/* ── Le filtre, puis les modèles, puis le bouton (V3.01.2) ──────────────── */}
        {/* **L'interrupteur « seulement ce qui peut partir », allumé.**
            Le carré est celui du produit — plein : ce qui reste se lit avec le
            filtre ; creux : tout se lit, les grisés avec leur raison. */}
        <button
          type="button"
          aria-pressed={seulementPossibles}
          onClick={() => setSeulementPossibles((v) => !v)}
          data-filtre-modeles
          className="mesure flex items-center gap-2 rounded-[2px] border border-trait bg-carte px-2 py-1.5 text-left text-[10px] text-encre-3 hover:border-contour hover:text-encre"
        >
          <span
            aria-hidden
            className={[
              "block h-[9px] w-[9px] rounded-[1px] border",
              seulementPossibles ? "border-signal bg-signal" : "border-contour",
            ].join(" ")}
          />
          <span className="flex-1">seulement ce qui peut partir</span>
          {grisesMasquees > 0 && (
            <span className="text-encre-4">
              {grisesMasquees} masqué{grisesMasquees > 1 ? "s" : ""}
            </span>
          )}
        </button>

        {catalogue?.modeles.length === 0 && (
          <Raison texte={catalogue.raison ?? catalogue.manque ?? "aucun modèle vidéo"} />
        )}

        {modelesVisibles.length === 0 && catalogue !== null && (
          <Raison texte="aucun modèle ne peut partir — éteignez le filtre pour lire pourquoi" />
        )}

        <ul className="flex flex-col gap-2">
          {modelesVisibles.map((m) => (
            <CarteModele
              key={m.identifiant}
              modele={m}
              choisi={m.identifiant === modele}
              nombre={nombre}
              onChoisir={() => setModele(m.identifiant)}
            />
          ))}
        </ul>

        {/* **Le panneau du moteur de la maison**, sous les cartes et pas
            ailleurs : ce qu'il rapatrie ne sert qu'à animer, et le mettre dans
            les Réglages obligerait à quitter l'écran qui pose la question. Il ne
            paraît que si cet atelier a un moteur local. */}
        {catalogue?.moteurs.some((m) => m.moteur) && (
          <PanneauDuMoteur
            onChange={() => {
              relireLeCatalogue()
            }}
          />
        )}

        <div className="mt-3 flex flex-col gap-2 border-t border-trait pt-3">
          {/* **Le bouton ouvre le tiroir de relecture (V3.01.1) au lieu
              d'envoyer** : l'argent ne part plus d'un écran plein de réglages,
              il part d'un écran qui ne montre que ce qui part. C'est le
              bouton du tiroir qui porte le montant, et son libellé est le
              même — on ne change pas de verbe pour passer de la commande à
              sa confirmation. */}
          <Bouton
            principal
            inactif={empeche !== null || enVol}
            onClick={() => setConfirmer(true)}
            titre={empeche ?? undefined}
            enfants={
              enVol
                ? "il part…"
                : `Commander ${nombre > 1 ? `ces ${nombre} clips` : "ce clip"}` +
                  (cout === null ? "" : ` · ${cout}`)
            }
          />
          <Raison texte={empeche} />
          <Raison texte={refus} />
          {attente ? (
            <p className="mesure text-[10px] leading-4 text-encre-4">
              Ce clip ne coûte rien : il se fabrique sur votre machine.{" "}
              <strong className="text-encre-3">
                Ce qu'il coûte est ce temps-là
              </strong>
              , et pendant qu'il tourne la carte graphique est prise.{" "}
              {attente.premier
                ? "Ce premier tirage charge le modèle en mémoire ; les suivants seront plus courts."
                : "Le modèle est déjà chargé — c'est la cadence de croisière."}{" "}
              {attente.mesure}.
            </p>
          ) : (
            <p className="mesure text-[10px] leading-4 text-encre-4">
              Ce montant est une <strong className="text-encre-3">estimation
              haute</strong>. Ce qui sera enregistré est ce que la facture dira, et
              l'écart mesuré va jusqu'à moitié moins.
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}

/** Le tiroir de relecture (V3.01.1) — entre « Commander ce clip » et la dépense.
 *
 *  **Le même contrat que l'écran des images fixes, appliqué à un clip.** Ce qui
 *  part est peu et se tient en entier : une image — obligatoire, et le tiroir le
 *  dit en toutes lettres, car un modèle vidéo n'en accepte qu'une et **aucun
 *  plafond ne la fait céder** (A9) —, et un texte, mot pour mot, corrigeable
 *  pour cet appel seulement. Rien d'autre ne part : ni textes du jeu, ni images
 *  d'ambiance. La phrase *« ce clip n'hérite que de votre sprite »* reste vraie,
 *  et ce tiroir ne la force pas.
 *
 *  **La correction ne remonte nulle part.** Elle part avec cet appel, le
 *  mouvement de la bibliothèque ne bouge pas, et « remettre le texte du
 *  mouvement » le redonne intact — c'est le contrat de l'écran des images,
 *  repris tel quel. Corriger pour tous les clips suivants se fait dans la
 *  bibliothèque de mouvements, comme avant.
 *
 *  **Le bouton porte le montant du lot** — ou le temps, chez le local — et ne
 *  lèse personne : chacun des N clips se paie, et ce qui se lit ici est ce qui
 *  s'est lu partout depuis le début de l'écran. */
function ConfirmationClip({
  texte,
  texteCorrige,
  onCorriger,
  onRemettre,
  image,
  onChangerImage,
  secondes,
  proportions,
  resolution,
  nombre,
  modele,
  montant,
  attente,
  attenteDuLot,
  cout,
  texteFinal,
  enVol,
  refus,
  onRevenir,
  onPartir,
}: {
  /** Le texte du mouvement, celui de la bibliothèque (A6). */
  texte: string
  /** `null` veut dire *rien corrigé* — le serveur relit alors le mouvement. */
  texteCorrige: string | null
  onCorriger: (texte: string) => void
  onRemettre: () => void
  image: Asset | null
  onChangerImage: (asset: Asset) => void
  secondes: number
  proportions: string
  resolution: string
  nombre: number
  modele: ModeleVideo
  montant: number | null
  attente: AttenteVideo | null
  attenteDuLot: number | null
  cout: string | null
  texteFinal: string
  enVol: boolean
  refus: string | null
  onRevenir: () => void
  onPartir: () => void
}) {
  const [champOuvert, setChampOuvert] = useState(false)
  // **Le brouillon fait autorité pendant qu'on écrit** (M3) : il ne remplace
  // rien, la correction part à chaque lettre, et c'est la *demande* qui attend
  // que la frappe se pose. `null` veut dire « rien tapé ici », et le champ
  // montre alors ce qui partirait.
  const [brouillon, setBrouillon] = useState<string | null>(null)
  const [choixOuvert, setChoixOuvert] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (champOuvert) champ.current?.focus()
  }, [champOuvert])

  const corrigee = texteCorrige !== null
  const montre = brouillon ?? (texteCorrige ?? texte)
  const proportion = PROPORTIONS.find((p) => p.cle === proportions)?.nom ?? proportions
  const taille = RESOLUTIONS.find((r) => r.cle === resolution)?.nom ?? resolution

  return (
    <div
      data-confirmation-clip
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px] bg-papier"
    >
      {/* ── Ce qui part : l'image, le format, le lot ──────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-trait p-4">
        <div className="flex items-baseline gap-2">
          <Libelle>ce qui part</Libelle>
          <button
            type="button"
            onClick={onRevenir}
            title="Échap revient sans rien dépenser"
            className="mesure ml-auto px-1 text-[10px] text-encre-4 hover:text-encre"
          >
            ‹ revenir
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Libelle aide="clip.depart">l'image de départ</Libelle>
          <ImageDeDepartVue asset={image} />
          {/* **Obligatoire, et ce n'est pas un détail qu'on replie.** Un
              modèle vidéo n'accepte qu'une image, et aucun plafond ne la fait
              céder : il n'y a donc rien à débrayer, et proposer un interrupteur
              qui ne voudrait rien dire serait un mensonge de forme. La seule
              question qui reste est laquelle — et « changer d'image » y
              répond. */}
          <p className="mesure text-[10px] leading-4 text-encre-3">
            <strong className="text-encre">elle est obligatoire et ne cède
            jamais</strong> — un modèle vidéo n'en accepte qu'une, et la retirer
            ne veut rien dire. Vous pouvez seulement la changer.
          </p>
          <button
            type="button"
            onClick={() => setChoixOuvert((o) => !o)}
            className="mesure self-start text-[10px] text-signal hover:opacity-70"
          >
            {choixOuvert ? "fermer la bibliothèque" : "changer d'image ›"}
          </button>
          {choixOuvert && (
            <ChoixDansLaBibliotheque
              onChoisir={(asset) => {
                onChangerImage(asset)
                setChoixOuvert(false)
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-trait pt-4">
          <Libelle>le format</Libelle>
          <ul className="mesure flex flex-col gap-1 text-[10px] text-encre-3">
            <li>
              {secondes} seconde{secondes > 1 ? "s" : ""} · {proportion} ·{" "}
              {taille}
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-1 border-t border-trait pt-4">
          <Libelle>combien de clips</Libelle>
          <ul className="mesure flex flex-col gap-1 text-[10px] text-encre-3">
            <li>
              {nombre} clip{nombre > 1 ? "s" : ""}
              {nombre > 1 && (
                <>
                  {" "}
                  — <strong className="text-encre">chacun se paie</strong>, y
                  compris ceux qu'on jettera après
                </>
              )}
            </li>
          </ul>
        </div>
      </aside>

      {/* ── Ce qui part, mot pour mot ─────────────────────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
        <Libelle>ce qui part, mot pour mot</Libelle>

        {champOuvert ? (
          <textarea
            ref={champ}
            value={montre}
            onChange={(e) => {
              setBrouillon(e.target.value)
              onCorriger(e.target.value)
            }}
            rows={6}
            aria-label="Corriger le texte du clip, pour cet appel"
            data-correction-clip
            className="mesure min-h-[120px] resize-y rounded-[2px] border border-signal bg-carte px-2 py-1 text-[10.5px] leading-[1.45] text-encre"
          />
        ) : (
          <p
            data-texte-confirme
            className="mesure whitespace-pre-wrap rounded-[2px] border border-trait bg-carte p-2 text-[10.5px] leading-[1.45] text-encre-3"
          >
            {texteFinal}
          </p>
        )}

        <div className="flex items-baseline gap-2">
          {corrigee && (
            <span className="mesure text-[9.5px] leading-4 text-encre-attention">
              corrigé pour cet appel seulement
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {corrigee && (
              <button
                type="button"
                onClick={() => {
                  // **Remettre efface le brouillon avec la correction.** Sans
                  // ça, le champ continuerait de montrer ce qu'on vient de
                  // reprendre alors que le texte qui part est revenu à
                  // l'original — le champ mentirait sur ce qui part.
                  setBrouillon(null)
                  onRemettre()
                  setChampOuvert(false)
                }}
                className="mesure text-[10px] text-signal hover:opacity-70"
              >
                remettre le texte du mouvement
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setBrouillon(null)
                setChampOuvert((o) => !o)
              }}
              className="mesure text-[10px] text-signal hover:opacity-70"
            >
              {champOuvert ? "fermer" : "corriger"}
            </button>
          </span>
        </div>
        <p className="mesure text-[9.5px] leading-4 text-encre-4">
          {corrigee
            ? "la correction part avec ce clip — le mouvement de la bibliothèque ne bouge pas. Le corriger pour tous les clips suivants se fait dans les Réglages."
            : "c'est le texte du mouvement, écrit une fois dans la bibliothèque et jamais retapé ici — ce qui est lu ici part mot pour mot."}
        </p>
      </section>

      {/* ── Le modèle, le montant du lot, et le bouton qui part ───────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-trait p-4">
        <div className="flex flex-col gap-1">
          <Libelle aide="clip.prix">le modèle</Libelle>
          <span className="text-[12.5px] text-encre">{modele.nom}</span>
          <span className="mesure text-[10px] text-encre-4">
            {modele.fournisseur}
          </span>
        </div>

        {attenteDuLot !== null ? (
          <>
            <span className="mesure text-[11.5px] text-encre">
              ≈ {duree(attenteDuLot)}
              <span className="ml-1.5 text-[9.5px] text-encre-4">
                sur votre carte · gratuit{nombre > 1 ? ` · ${nombre} clips` : ""}
              </span>
            </span>
            <p className="mesure text-[9.5px] leading-4 text-encre-4">
              {attente?.images} images à {attente?.mesure} — et le premier clip
              charge le modèle en mémoire, les suivants non
              {attente?.premier
                ? " : l'attente annoncée est celle du premier tirage."
                : "."}
            </p>
          </>
        ) : montant !== null ? (
          <>
            <span className="mesure text-[11.5px] text-encre">
              ≈ {dollars(montant)}
              <span className="ml-1.5 text-[9.5px] text-encre-4">
                {modele.prix.nature}
                {nombre > 1 ? ` · ${nombre} clips` : ""}
              </span>
            </span>
            <p className="mesure text-[9.5px] leading-4 text-encre-4">
              {modele.prix.formule}
            </p>
            <p className="mesure text-[9.5px] leading-4 text-encre-4">
              {modele.mesure ||
                "ce dépôt n'a encore rien mesuré de ce modèle — proposé, jamais éprouvé"}
            </p>
            <p className="mesure text-[9.5px] leading-4 text-encre-4">
              estimation haute : ce qui s'enregistrera est ce que la facture
              dira, et l'écart mesuré va jusqu'à moitié moins.
            </p>
          </>
        ) : (
          <p className="mesure text-[9.5px] leading-4 text-encre-4">
            {modele.grise ?? "le prix n'a pas pu être relu"}
          </p>
        )}

        <section className="mt-auto flex flex-col gap-2 border-t border-trait pt-3">
          <Bouton
            principal
            inactif={Boolean(refus) || !texteFinal || enVol}
            onClick={onPartir}
            enfants={
              refus
                ? refus
                : enVol
                  ? "il part…"
                  : `Commander ${nombre > 1 ? `ces ${nombre} clips` : "ce clip"}` +
                    (cout === null ? "" : ` · ${cout}`)
            }
          />
          <Raison texte={!texteFinal ? "un clip part d'un texte — écrivez-en un" : null} />
          <button
            type="button"
            onClick={onRevenir}
            disabled={enVol}
            className="mesure h-[26px] text-[10px] text-encre-4 hover:text-encre-3 disabled:cursor-not-allowed"
          >
            {enVol
              ? "l'appel est parti — il ne se rattrape plus"
              : "Revenir sans rien dépenser"}
          </button>
          <p className="mesure text-[9.5px] leading-4 text-encre-4">
            rien n'est consommé tant que ce bouton n'est pas pressé.
          </p>
        </section>
      </aside>
    </div>
  )
}

/** L'image de départ, en grand. Le damier dit la transparence, comme partout. */
function ImageDeDepartVue({ asset }: { asset: Asset | null }) {
  const visee = useVisee(asset ? sujetAsset(asset) : null)
  if (!asset)
    return (
      <div className="flex aspect-square w-full items-center justify-center border border-trait bg-carte">
        <span className="mesure text-[10px] text-encre-4">aucune image</span>
      </div>
    )
  return (
    <div
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      className="aspect-square w-full overflow-hidden border border-trait bg-carte"
    >
      <img
        src={vignetteAsset(asset, 512)}
        alt={asset.label}
        className="damier-papier h-full w-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}

/** N'importe quelle image de la bibliothèque, d'un clic.
 *
 *  **Ce n'est pas une seconde galerie** : pas de filtre, pas de tri, pas de
 *  sélection multiple. C'est une liste de vignettes pour attraper l'image qu'on
 *  a en tête, et la vraie grille reste la seule du produit. */
function ChoixDansLaBibliotheque({
  onChoisir,
}: {
  onChoisir: (asset: Asset) => void
}) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [recherche, setRecherche] = useState("")

  useEffect(() => {
    let vivant = true
    api
      .assets({ recherche })
      .then((recu) => vivant && setAssets(recu.assets))
      .catch(() => vivant && setAssets([]))
    return () => {
      vivant = false
    }
  }, [recherche])

  return (
    <div className="flex flex-col gap-2 border border-trait bg-carte p-2">
      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="chercher une image"
        aria-label="Chercher une image de départ"
        className="mesure h-[26px] rounded-[2px] border border-contour bg-papier px-2 text-[10.5px] text-encre placeholder:text-encre-4"
      />
      <ul className="defile grid max-h-[240px] grid-cols-3 gap-1 overflow-y-auto">
        {(assets ?? []).map((asset) => (
          <li key={asset.identifiant}>
            <button
              type="button"
              onClick={() => onChoisir(asset)}
              title={asset.label}
              className="block aspect-square w-full overflow-hidden border border-trait hover:border-signal"
            >
              <img
                src={vignetteAsset(asset, 128)}
                alt={asset.label}
                loading="lazy"
                className="damier-papier h-full w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
          </li>
        ))}
      </ul>
      {assets?.length === 0 && (
        <p className="mesure text-[10px] text-encre-4">aucune image ici</p>
      )}
    </div>
  )
}

/** Un modèle vidéo, replié — **deux gestes qui ne se confondent pas** (V3.01.2).
 *
 *  Repliée, la carte ne montre que son nom et son estimation — le montant du
 *  lot, ou le temps chez le local : c'est tout ce qu'il faut pour comparer
 *  d'un coup d'œil, et la colonne cesse d'être un mur de texte. **Le geste qui
 *  choisit** est le bouton du nom ; **le geste qui déplie** est le chevron, à
 *  côté, et il reste vivant sur une carte grisée — seul le choix est interdit,
 *  la raison se lit toujours.
 *
 *  Déplié, on retrouve ce que la carte entière montrait avant : la formule,
 *  la durée conseillée et sa raison, ce que le dépôt a mesuré — et, sur une
 *  carte grisée, la raison du grisage. Rien n'est résumé : c'est un pli qu'on
 *  ouvre, comme le texte de l'écran de confirmation (U9). */
function CarteModele({
  modele,
  choisi,
  nombre,
  onChoisir,
}: {
  modele: ModeleVideo
  choisi: boolean
  nombre: number
  onChoisir: () => void
}) {
  const grise = modele.grise !== null
  const attente = modele.attente
  const [deplie, setDeplie] = useState(false)
  return (
    <li
      className={[
        "flex flex-col gap-1 rounded-[2px] border p-2 transition-colors duration-[80ms]",
        grise
          ? "border-trait bg-carte opacity-60"
          : choisi
            ? "border-signal bg-carte"
            : "border-trait bg-carte hover:border-contour",
      ].join(" ")}
    >
      <div className="flex items-start gap-1.5">
        {/* **Le geste qui choisit : le nom et ce que ça coûte, en un seul
            bouton.** Sur une carte grisée, il est seul à s'éteindre. */}
        <button
          type="button"
          disabled={grise}
          onClick={onChoisir}
          aria-pressed={choisi}
          aria-label={`Choisir ${modele.nom}`}
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-[1px] text-left"
        >
          <span className="text-[12.5px] text-encre">{modele.nom}</span>

          {attente ? (
            // **Un temps à la place d'un montant, et le mot « gratuit » avec.**
            // Écrire « ≈ 4 min » tout seul se lirait comme un délai de
            // livraison ; c'est un coût, et l'unité seule ne le dit pas.
            <span className="mesure text-[11.5px] text-encre">
              ≈ {duree(attenteDeLot(attente, nombre) ?? 0)}
              <span className="ml-1.5 text-[9.5px] text-encre-4">
                sur votre carte · gratuit
                {nombre > 1 ? ` · ${nombre} clips` : ""}
              </span>
            </span>
          ) : modele.prix.montant !== null ? (
            <span className="mesure text-[11.5px] text-encre">
              ≈ {dollars(modele.prix.montant * nombre)}
              <span className="ml-1.5 text-[9.5px] text-encre-4">
                {modele.prix.nature}
                {nombre > 1 ? ` · ${nombre} clips` : ""}
              </span>
            </span>
          ) : (
            // La carte est grisée : il n'y a pas d'estimation à montrer, et
            // une phrase creuse vaudrait un prix. La raison est dans le pli.
            <span className="mesure text-[10px] leading-4 text-encre-4">
              ne peut pas partir — dépliez pour lire pourquoi
            </span>
          )}
        </button>

        {/* **Le geste qui déplie, distinct du choix** — et il reste vivant sur
            une carte grisée : seul le choix est interdit, la lecture ne l'est
            jamais. */}
        <button
          type="button"
          aria-expanded={deplie}
          aria-label={`${deplie ? "replier" : "déplier"} ce qu'on sait de ${modele.nom}`}
          onClick={() => setDeplie((d) => !d)}
          className="mesure mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[2px] border border-trait text-[10px] text-encre-3 hover:border-contour hover:text-encre"
        >
          {deplie ? "▴" : "▾"}
        </button>
      </div>

      {deplie && (
        <div className="flex flex-col gap-1 border-t border-trait pt-1.5">
          {/* **La raison du grisage d'abord, quand il y en a une** : c'est
              elle qu'on vient chercher en dépliant cette carte-là. */}
          {grise && (
            <span className="mesure text-[9.5px] leading-4 text-encre-attention">
              {modele.grise}
            </span>
          )}

          {!grise && attente && (
            <span className="mesure text-[9.5px] leading-4 text-encre-4">
              {attente.images} images à {attente.mesure}
            </span>
          )}
          {!grise && !attente && modele.prix.formule && (
            <>
              {/* **La formule, sous le montant.** Un prix vidéo se calcule ; un
                  prix qu'on ne peut pas refaire de tête n'est pas vérifiable. */}
              <span className="mesure text-[9.5px] leading-4 text-encre-4">
                {modele.prix.formule}
              </span>
              {modele.prix.montant === null && (
                <span className="mesure text-[9.5px] leading-4 text-encre-attention">
                  {modele.grise}
                </span>
              )}
            </>
          )}

          {/* **La durée conseillée, avec sa raison, là où on choisit.** ⚠️ Ce
              que cette raison dit — que la bande se dégrade au-delà d'une
              seconde et qu'aucune mesure automatique ne le voit — est le genre
              de fait qui se perd dans un document et qui se lit ici. */}
          {modele.duree_conseillee > 0 && (
            <span className="mesure text-[9.5px] leading-4 text-encre-attention">
              conseillé : {modele.duree_conseillee} seconde
              {modele.duree_conseillee > 1 ? "s" : ""} — {modele.raison_de_la_duree}
            </span>
          )}

          {/* **Ce que ce dépôt a mesuré, et rien d'autre.** Vide veut dire *on
              n'en sait rien*, et l'écrire vaut mieux que de laisser croire
              qu'un modèle proposé a été éprouvé. */}
          <span className="mesure text-[9.5px] leading-4 text-encre-4">
            {modele.mesure ||
              "ce dépôt n'a encore rien mesuré de ce modèle — proposé, jamais éprouvé"}
          </span>
        </div>
      )}
    </li>
  )
}

/** Ce que la carte de la maison peut faire aujourd'hui — **et les trois
 *  absences ne se ressemblent pas** (A11).
 *
 *  1. L'application du moteur n'est pas ouverte : le modèle est grisé, parce que
 *     rien ne peut partir et que l'atelier ne sait pas ouvrir une fenêtre à la
 *     place de l'auteur.
 *  2. Des fichiers manquent : le modèle **reste choisissable**, et ce panneau
 *     propose de les rapatrier. Refuser obligerait à sortir de l'atelier pour un
 *     téléchargement que l'atelier sait faire.
 *  3. Le greffon qui garde les gros pixels manque : simple avertissement. Le
 *     clip sortira, il sortira lissé — et un clip lissé se juge, alors qu'un
 *     refus ne se juge pas.
 *
 *  Les confondre ferait sortir de l'atelier pour rien, ou laisserait tomber une
 *  attente de plusieurs minutes sur un geste annoncé comme immédiat. */
function PanneauDuMoteur({ onChange }: { onChange: () => void }) {
  const [etat, setEtat] = useState<EtatDuMoteur | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  const relire = useCallback(() => {
    api
      .etatDuMoteur()
      .then(setEtat)
      .catch(() => setEtat(null))
  }, [])

  useEffect(relire, [relire])

  if (!etat) return null

  const rapatrier = async () => {
    setRefus(null)
    setEnCours(true)
    try {
      setEtat(await api.telechargerLesModeles())
      // Le catalogue se relit : ce qui vient d'arriver peut faire tomber le
      // grisé, et l'auteur ne devrait pas avoir à s'en occuper.
      onChange()
    } catch (erreur) {
      setRefus(
        erreur instanceof Error ? erreur.message : "le téléchargement s'est arrêté",
      )
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div
      data-moteur
      className="mt-2 flex flex-col gap-2 rounded-[2px] border border-trait bg-carte p-2"
    >
      <div className="flex items-baseline gap-2">
        <Libelle aide="clip.moteur">la carte de cette machine</Libelle>
        <button
          type="button"
          onClick={relire}
          className="mesure ml-auto text-[9.5px] text-encre-4 hover:text-encre"
        >
          revoir
        </button>
      </div>

      {/* Ce qu'elle est, quand elle répond. Une attente sans sa machine ne veut
          rien dire — la même mesure sur une autre carte donnerait autre chose. */}
      {etat.carte && (
        <span className="mesure text-[9.5px] leading-4 text-encre-4">
          {etat.carte} · {gigas(etat.memoire_libre_go)} libres
        </span>
      )}

      {/* La phrase du moment, déjà écrite au serveur. **Vide veut dire qu'il n'y
          a rien à dire**, et rien à dire est une réponse. */}
      {etat.phrase && (
        <p
          data-moteur-phrase
          className="mesure text-[10px] leading-4 text-encre-3"
        >
          {etat.phrase}
        </p>
      )}

      {etat.manquants.length > 0 && (
        <>
          {/* **La liste avec les tailles et les licences, avant le bouton.**
              Vingt-six gigaoctets ne se descendent pas dans le dos de quelqu'un,
              et la licence est une question qu'on se pose avant, jamais après :
              ce qui descend ici finira dans un jeu vendu. */}
          <ul className="mesure flex flex-col gap-0.5 text-[9.5px] leading-4 text-encre-4">
            {etat.manquants.map((fichier) => (
              <li key={fichier.nom} className="flex gap-2">
                <span className="truncate" title={fichier.nom}>
                  {fichier.nom}
                </span>
                <span className="ml-auto whitespace-nowrap">
                  {gigas(fichier.go)} · {fichier.licence}
                </span>
              </li>
            ))}
          </ul>
          <Bouton
            inactif={enCours}
            onClick={() => void rapatrier()}
            enfants={
              enCours
                ? "ça descend…"
                : `Télécharger · ${gigas(etat.go_a_telecharger)}`
            }
          />
          <p className="mesure text-[9.5px] leading-4 text-encre-4">
            Une seule fois, puis plus jamais. Un téléchargement coupé se reprend
            là où il s'est arrêté : relancez, rien n'est perdu.
          </p>
        </>
      )}

      <Raison texte={refus} />
    </div>
  )
}

/** Un choix parmi peu, à la taille de cet écran. Même grammaire que les
 *  segments du produit : ce qui est choisi est plein, le reste est un contour. */
function Choix({
  valeurs,
  valeur,
  onChange,
}: {
  valeurs: readonly { cle: string; nom: string }[]
  valeur: string
  onChange: (cle: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {valeurs.map((v) => (
        <button
          key={v.cle}
          type="button"
          onClick={() => onChange(v.cle)}
          aria-pressed={v.cle === valeur}
          className={[
            "mesure h-[26px] rounded-[2px] px-2 text-[10.5px] transition-colors duration-[80ms]",
            v.cle === valeur
              ? "bg-signal text-papier"
              : "border border-trait bg-carte text-encre-3 hover:text-encre",
          ].join(" ")}
        >
          {v.nom}
        </button>
      ))}
    </div>
  )
}
