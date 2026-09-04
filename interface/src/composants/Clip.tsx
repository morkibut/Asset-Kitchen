// Commander un clip — l'écran où l'animation se paie (A9, V3).
//
// C'est le premier moment de `docs/maquettes-v3/01-du-sprite-a-la-bande.html` :
// à gauche l'image de départ et le mouvement, au milieu ce qu'on va recevoir et
// dans quel format, à droite les modèles avec leur prix et le bouton qui porte
// le montant. **Rien ne part tant qu'on n'a pas appuyé sur ce bouton.**
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

import { useCallback, useEffect, useState } from "react"
import {
  api,
  dollars,
  type Asset,
  type BaseModelesVideo,
  type Generation,
  type ImageDeDepart,
  type ModeleVideo,
  type Mouvement,
  type Personnage,
  type Pose,
} from "../api"
import { sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import { Bouton, Libelle, Raison } from "./chassis"

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

  // ── L'état de l'écran ─────────────────────────────────────────────────────
  const [refus, setRefus] = useState<string | null>(null)
  const [enVol, setEnVol] = useState(false)
  const [choixOuvert, setChoixOuvert] = useState(false)
  /** L'image choisie à la main, qui remplace la proposition. `null` tant qu'on
   *  n'a rien changé — et c'est ce qui fait que la proposition se remet à
   *  suivre la case quand on change de case. */
  const [choisie, setChoisie] = useState<Asset | null>(null)

  const personnage = cible.personnage
  const pose = cible.pose

  // **Échap revient sans rien dépenser** — la même touche que sur l'écran de
  // confirmation, et pour la même raison : le dernier écran avant l'argent doit
  // pouvoir se quitter sans chercher un bouton.
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape" && !evenement.defaultPrevented) onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

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

  // **Le montant du lot, jamais celui d'un clip seul** : c'est ce qui va
  // partir, et l'annoncer à l'unité ferait payer quatre fois ce qu'on a lu une
  // fois. `null` quand le prix n'a pas pu être relu — le modèle est alors grisé.
  const montant =
    choisi?.prix.montant !== null && choisi?.prix.montant !== undefined
      ? choisi.prix.montant * nombre
      : null

  const empeche = !image
    ? "un clip part toujours d'une image : choisissez-en une"
    : !texte
      ? "choisissez un mouvement — c'est lui qui écrit ce qui part"
      : !choisi
        ? "aucun modèle vidéo ne peut honorer cette demande"
        : (choisi.grise ?? null)

  const commander = async () => {
    if (empeche || !image || !choisi) return
    setRefus(null)
    setEnVol(true)
    try {
      const { clips } = await api.commanderClips({
        modele: choisi.identifiant,
        asset: image.identifiant,
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

  const ou = cible.direction ? ` · ${cible.direction.nom}` : ""

  return (
    <div
      data-clip
      className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_380px] bg-fond-0"
    >
      {/* ── L'image de départ et le mouvement ─────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-bord p-4">
        <div className="flex items-baseline gap-2">
          <Libelle aide="clip.depart">l'image de départ</Libelle>
          <button
            type="button"
            onClick={onFermer}
            title="Échap revient sans rien dépenser"
            className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-texte"
          >
            ‹ revenir
          </button>
        </div>

        <ImageDeDepartVue asset={image} />

        <p className="text-[11px] leading-relaxed text-texte-2">
          {choisie
            ? `${choisie.label} — choisie à la main.`
            : (depart?.raison ?? "…")}
        </p>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Le sprite est agrandi sur la toile du format demandé avant de partir :
          un modèle qui rend du grand format inventerait tout ce qu'il ne voit
          pas d'un sprite de soixante-quatre pixels.
        </p>

        <button
          type="button"
          onClick={() => setChoixOuvert((o) => !o)}
          className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
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

        <div className="mt-2 border-t border-bord pt-3">
          <Libelle aide="mouvement.texte">le mouvement</Libelle>
        </div>
        <select
          value={mouvement ?? ""}
          onChange={(e) => setMouvement(e.target.value || null)}
          aria-label="Le mouvement"
          className="mesure h-[30px] rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[11px] text-texte"
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
          className="mesure rounded-[2px] border border-bord bg-fond-2 p-2 text-[10.5px] leading-4 text-texte-2"
        >
          {texte || "choisissez un mouvement pour lire ce qui partira"}
        </p>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          C'est le texte anglais du mouvement, écrit une fois dans les Réglages
          et jamais retapé ici. Le corriger pour tous les clips suivants se fait
          là-bas.
        </p>
      </aside>

      {/* ── Ce qu'on va recevoir, et dans quel format ──────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        <div>
          <h2 className="text-[15px] text-texte">
            Animer {personnage.nom}
            {pose ? ` — ${pose.nom}${ou}` : ""}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-texte-2">
            Un clip part d'une image et revient en vidéo. Vous en découperez
            ensuite autant d'animations que vous voudrez, sans repayer.
          </p>
        </div>

        <table className="w-full text-[11.5px] leading-relaxed text-texte-2">
          <tbody>
            <tr>
              <td className="w-[130px] py-1 align-top text-texte">Un clip</td>
              <td className="py-1">
                {secondes} seconde{secondes > 1 ? "s" : ""},{" "}
                {PROPORTIONS.find((p) => p.cle === proportions)?.nom ?? proportions},{" "}
                {RESOLUTIONS.find((r) => r.cle === resolution)?.nom ?? resolution}.
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top text-texte">Ses images</td>
              <td className="py-1">
                tirées à l'arrivée, une fois, et rangées à côté du clip.
                {catalogue?.decodeur && (
                  <>
                    {" "}
                    <span className="text-epingle">{catalogue.decodeur}</span> —
                    le clip s'achète quand même, il reste payé, et ses images se
                    tireront le jour où ce qui manque sera là.
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td className="py-1 align-top text-texte">L'attente</td>
              <td className="py-1">
                deux minutes environ. <strong className="text-texte">Vous
                pouvez fermer l'atelier</strong> : le clip continue de se
                fabriquer, et vous le retrouverez.
              </td>
            </tr>
          </tbody>
        </table>

        <p className="rounded-[2px] border-l-2 border-info bg-fond-2 p-3 text-[11.5px] leading-relaxed text-texte-2">
          <strong className="text-texte">Ce clip n'hérite que de votre
          sprite.</strong> Ni les textes du jeu, ni ses images d'ambiance ne
          partent avec lui : un modèle vidéo ne prend qu'une seule image, et
          c'est celle du personnage.
        </p>

        <div className="flex flex-col gap-2 border-t border-bord pt-4">
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
          <p className="mesure text-[10px] leading-4 text-texte-3">
            Le carré coûte près de moitié moins que le format large et cadre
            mieux un personnage seul. Le prix se recalcule à chaque changement,
            à droite.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-bord pt-4">
          <Libelle aide="clip.lot">combien de clips</Libelle>
          <Choix
            valeurs={LOTS.map((n) => ({ cle: String(n), nom: String(n) }))}
            valeur={String(nombre)}
            onChange={(v) => setNombre(Number(v))}
          />
          <p className="mesure text-[10px] leading-4 text-texte-3">
            Un même texte ne rend jamais deux fois le même clip. En lancer
            plusieurs et n'en garder qu'un est un geste ordinaire ici — et{" "}
            <strong className="text-texte-2">
              chacun se paie, y compris ceux qu'on jette
            </strong>
            . Ils reviennent un par un, et chacun se voit dès son arrivée.
          </p>
        </div>
      </section>

      {/* ── Qui peut le faire, et pour combien ─────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-bord p-4">
        <Libelle aide="clip.prix">qui peut le faire</Libelle>

        {catalogue === null && (
          <p className="mesure text-[10px] text-texte-3">on demande…</p>
        )}
        {catalogue?.modeles.length === 0 && (
          <Raison texte={catalogue.raison ?? catalogue.manque ?? "aucun modèle vidéo"} />
        )}

        {catalogue?.modeles.map((m) => (
          <CarteModele
            key={m.identifiant}
            modele={m}
            choisi={m.identifiant === modele}
            nombre={nombre}
            onChoisir={() => setModele(m.identifiant)}
          />
        ))}

        <div className="mt-3 flex flex-col gap-2 border-t border-bord pt-3">
          <Bouton
            principal
            inactif={empeche !== null || enVol}
            onClick={() => void commander()}
            titre={empeche ?? undefined}
            enfants={
              enVol
                ? "il part…"
                : `Commander ${nombre > 1 ? `ces ${nombre} clips` : "ce clip"}` +
                  (montant === null ? "" : ` · ≈ ${dollars(montant)}`)
            }
          />
          <Raison texte={empeche} />
          <Raison texte={refus} />
          <p className="mesure text-[10px] leading-4 text-texte-3">
            Ce montant est une <strong className="text-texte-2">estimation
            haute</strong>. Ce qui sera enregistré est ce que la facture dira, et
            l'écart mesuré va jusqu'à moitié moins.
          </p>
        </div>
      </aside>
    </div>
  )
}

/** L'image de départ, en grand. Le damier dit la transparence, comme partout. */
function ImageDeDepartVue({ asset }: { asset: Asset | null }) {
  const visee = useVisee(asset ? sujetAsset(asset) : null)
  if (!asset)
    return (
      <div className="flex aspect-square w-full items-center justify-center border border-bord bg-fond-2">
        <span className="mesure text-[10px] text-texte-3">aucune image</span>
      </div>
    )
  return (
    <div
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      className="aspect-square w-full overflow-hidden border border-bord bg-fond-2"
    >
      <img
        src={vignetteAsset(asset, 512)}
        alt={asset.label}
        className="damier h-full w-full object-contain"
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
    <div className="flex flex-col gap-2 border border-bord bg-fond-2 p-2">
      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="chercher une image"
        aria-label="Chercher une image de départ"
        className="mesure h-[26px] rounded-[2px] border border-bord-fort bg-fond-0 px-2 text-[10.5px] text-texte placeholder:text-texte-3"
      />
      <ul className="defile grid max-h-[240px] grid-cols-3 gap-1 overflow-y-auto">
        {(assets ?? []).map((asset) => (
          <li key={asset.identifiant}>
            <button
              type="button"
              onClick={() => onChoisir(asset)}
              title={asset.label}
              className="block aspect-square w-full overflow-hidden border border-bord hover:border-signal"
            >
              <img
                src={vignetteAsset(asset, 128)}
                alt={asset.label}
                loading="lazy"
                className="damier h-full w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </button>
          </li>
        ))}
      </ul>
      {assets?.length === 0 && (
        <p className="mesure text-[10px] text-texte-3">aucune image ici</p>
      )}
    </div>
  )
}

/** Un modèle vidéo : ce à quoi il sert, ce qu'il coûte, **la formule qui produit
 *  ce prix**, et ce que ce dépôt a mesuré de lui.
 *
 *  Les deux dernières lignes sont ce qui distingue cette carte de tout ce que le
 *  produit affichait avant. Un prix vidéo se calcule : sans sa formule il serait
 *  à croire sur parole. Et un modèle proposé sans avoir été assez éprouvé doit
 *  le dire **là où on le choisit** — pas dans un document. */
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
  return (
    <button
      type="button"
      disabled={grise}
      onClick={onChoisir}
      aria-pressed={choisi}
      className={[
        "flex flex-col gap-1 rounded-[2px] border p-2 text-left transition-colors duration-[80ms]",
        grise
          ? "cursor-not-allowed border-bord bg-fond-2 opacity-60"
          : choisi
            ? "border-signal bg-fond-2"
            : "border-bord bg-fond-2 hover:border-bord-fort",
      ].join(" ")}
    >
      <span className="text-[12.5px] text-texte">{modele.nom}</span>

      {grise ? (
        <span className="mesure text-[10px] leading-4 text-texte-3">
          {modele.grise}
        </span>
      ) : (
        <>
          <span className="mesure text-[11.5px] text-texte">
            ≈ {dollars((modele.prix.montant ?? 0) * nombre)}
            <span className="ml-1.5 text-[9.5px] text-texte-3">
              {modele.prix.nature}
              {nombre > 1 ? ` · ${nombre} clips` : ""}
            </span>
          </span>
          {/* **La formule, à côté du montant.** Un prix vidéo se calcule ; un
              prix qu'on ne peut pas refaire de tête n'est pas vérifiable. */}
          <span className="mesure text-[9.5px] leading-4 text-texte-3">
            {modele.prix.formule}
          </span>
        </>
      )}

      {/* **Ce que ce dépôt a mesuré, et rien d'autre.** Vide veut dire *on n'en
          sait rien*, et l'écrire vaut mieux que de laisser croire qu'un modèle
          proposé a été éprouvé. */}
      <span className="mesure text-[9.5px] leading-4 text-texte-3">
        {modele.mesure ||
          "ce dépôt n'a encore rien mesuré de ce modèle — proposé, jamais éprouvé"}
      </span>
    </button>
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
              ? "bg-signal text-fond-0"
              : "border border-bord bg-fond-2 text-texte-2 hover:text-texte",
          ].join(" ")}
        >
          {v.nom}
        </button>
      ))}
    </div>
  )
}
