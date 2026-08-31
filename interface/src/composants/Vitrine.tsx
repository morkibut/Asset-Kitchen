// La vitrine — l'écran qui regarde une image finie (E16).
//
// **Le codex compte des cases ; la vitrine montre des images finies.** Le
// produit avait quatre lieux et aucun ne montrait : le codex dit *il manque
// quinze images*, l'établi dit *voilà la case et voilà le prompt*, la galerie
// dit *voilà les fichiers, rangés*. Personne ne disait *voilà ce que ça donne*.
//
// **Ce ne serait qu'un confort si le compte du codex disait la vérité.** Il ne
// la dit pas, et c'est mesuré : une case est prise dès qu'une image porte le nom
// de la pose, même si cette image n'est jamais passée par la recette. Sur les
// quarante-huit images du projet réel, dix-huit seulement sont à la taille du
// jeu. La vitrine n'ajoute **aucune règle** au codex : elle montre l'image, et
// une image qu'on regarde répond toute seule.
//
// **Elle ne fabrique rien, ne modifie rien, ne coûte rien** — et comme la fiche,
// elle fait disparaître la barre qui paie.

import { useCallback, useEffect, useState } from "react"
import { api, type Personnage, type Pose, type Vitrine as VitrineDuJeu } from "../api"
import { sujetAsset } from "./Apercu"
import { Libelle, Raison, Segments } from "./chassis"

/** **Des multiples entiers, et rien d'autre.** C'est la seule règle dure de cet
 *  écran, et elle vient de ce qu'est le pixel art : un sprite de 128 px agrandi
 *  à 192 px — une fois et demie — doit fabriquer 64 pixels qui n'existent pas,
 *  et il les prend en doublant une ligne sur deux. Le résultat a des lignes
 *  épaisses et des lignes fines, et **le défaut qu'on croirait voir n'existerait
 *  que dans la fenêtre où on l'a regardé**. */
const ECHELLES = [1, 2, 4, 8] as const
type Echelle = (typeof ECHELLES)[number]

export function EcranVitrine({
  personnage,
  personnages,
  plan,
  onFermer,
  onErreur,
}: {
  /** La chose qu'on regardait, ou rien — et rien veut dire **le monde entier**.
   *  Un seul écran, un seul jeu de réglages, deux contenus : la vitrine montre
   *  ce qu'on regardait quand on l'a ouverte. */
  personnage: Personnage | null
  /** Toutes les choses du jeu, pour la portée du monde : leurs images sont déjà
   *  là, et un second appel pour les relire ferait deux vérités. */
  personnages: Personnage[]
  plan: Pose[]
  onFermer: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [vitrine, setVitrine] = useState<VitrineDuJeu | null>(null)
  const [echelle, setEchelle] = useState<Echelle>(2)
  const [fond, setFond] = useState(0)
  const [regardee, setRegardee] = useState<string>("")
  // **Toutes ses poses à la même échelle** : c'est comme ça qu'une pose sortie
  // d'un quart plus petite se voit — elle rapetisse au milieu de ses sœurs.
  const [ensemble, setEnsemble] = useState(true)

  const relire = useCallback(() => {
    void api
      .vitrine(personnage?.identifiant ?? "")
      .then((recu) => setVitrine(recu ?? null))
      .catch((erreur) => onErreur(erreur, "la vitrine n'a pas pu s'ouvrir"))
  }, [personnage?.identifiant, onErreur])

  useEffect(relire, [relire])

  // **Échap ferme la vitrine** — le même geste que la fiche et que les outils.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  if (!vitrine) return null

  const choisi = vitrine.fonds[Math.min(fond, vitrine.fonds.length - 1)]
  const images = vitrine.images
  const vue = images.find((i) => i.asset === regardee) ?? images[0]
  const assets = (personnage ? [personnage] : personnages).flatMap((p) =>
    p.cases.flatMap((c) => c.images),
  )

  return (
    <div data-vitrine className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px]">
      {/* ── Comment on regarde ───────────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord bg-fond-1 p-3">
        <div className="flex flex-col gap-1">
          <Libelle>la taille</Libelle>
          <Segments<string>
            valeurs={ECHELLES.map(String)}
            valeur={String(echelle)}
            onChange={(v) => setEchelle(Number(v) as Echelle)}
            libelles={Object.fromEntries(ECHELLES.map((e) => [String(e), `×${e}`]))}
          />
          <Raison texte="multiples entiers seulement — un sprite agrandi d'une fois et demie fabrique des pixels qui n'existent pas" />
        </div>

        <div className="flex flex-col gap-1">
          <Libelle>le fond</Libelle>
          {/* **Aucune couleur libre.** Un fond de vitrine se choisit dans ce que
              le projet possède déjà — sa palette et sa bible. Un sélecteur libre
              transformerait cet écran en outil de maquillage : on trouverait
              toujours un fond sur lequel le sprite est joli, et jamais celui sur
              lequel il disparaît. */}
          <div className="flex flex-wrap gap-1">
            {vitrine.fonds.map((autre, rang) => (
              <button
                key={`${autre.genre}-${autre.couleur}-${rang}`}
                type="button"
                aria-label={`Fond ${autre.genre}${autre.couleur ? ` ${autre.couleur}` : ""}`}
                aria-pressed={rang === fond}
                onClick={() => setFond(rang)}
                style={autre.couleur ? { background: autre.couleur } : undefined}
                className={[
                  "h-[26px] w-[26px] rounded-[2px] border",
                  autre.genre === "damier" ? "damier" : "",
                  rang === fond ? "border-lumiere" : "border-bord hover:border-bord-fort",
                ].join(" ")}
              />
            ))}
          </div>
          <Raison texte={choisi?.raison ?? ""} />
        </div>

        <div className="flex flex-col gap-1">
          <Libelle>ce qu'on montre</Libelle>
          <button
            type="button"
            aria-pressed={ensemble}
            onClick={() => setEnsemble(!ensemble)}
            className={[
              "mesure h-[26px] rounded-[2px] border border-bord px-2 text-left text-[10px]",
              ensemble ? "text-signal" : "text-texte-3 hover:text-texte-2",
            ].join(" ")}
          >
            toutes ses poses à la même échelle
          </button>
        </div>

        {/* **La place du mouvement est réservée et grisée avec sa raison**,
            plutôt qu'occupée par un lecteur posé sur zéro image. */}
        <div className="flex flex-col gap-1">
          <Libelle>le mouvement</Libelle>
          <button
            type="button"
            disabled
            className="mesure h-[26px] cursor-not-allowed rounded-[2px] border border-bord bg-fond-2 px-2 text-left text-[10px] text-texte-3"
          >
            lire le cycle
          </button>
          <Raison texte={vitrine.mouvement.raison} />
        </div>

        <button
          type="button"
          onClick={onFermer}
          className="mesure mt-2 h-[26px] rounded-[2px] border border-bord px-2 text-[10px] text-texte-3 hover:text-signal"
        >
          Fermer la vitrine — Échap
        </button>
      </aside>

      {/* ── Ce qu'on regarde ─────────────────────────────────────────────── */}
      <div
        className={[
          "defile flex min-h-0 min-w-0 flex-col items-center gap-4 overflow-auto p-6",
          choisi?.genre === "damier" ? "damier" : "",
        ].join(" ")}
        style={
          choisi?.couleur ? { background: choisi.couleur } : undefined
        }
      >
        {images.length === 0 ? (
          <p className="max-w-[504px] text-center font-serif text-[32px] leading-tight text-texte-3">
            Rien n'est encore fait pour cette chose.
          </p>
        ) : ensemble ? (
          // **Toutes ses poses dans la même boîte, au même facteur.** C'est
          // comme ça que l'attaque en 96 × 96 se voit : elle rapetisse d'un
          // quart au milieu des cinq autres.
          <div className="flex flex-wrap items-end justify-center gap-4">
            {images.map((image) => (
              <Sujet
                key={image.asset}
                image={image}
                asset={assets.find((a) => a.identifiant === image.asset)}
                echelle={echelle}
                tailleCommune={vitrine.taille_commune}
                regardee={image.asset === vue?.asset}
                onRegarder={() => setRegardee(image.asset)}
                plan={plan}
                duMonde={!personnage}
              />
            ))}
          </div>
        ) : vue ? (
          <Sujet
            image={vue}
            asset={assets.find((a) => a.identifiant === vue.asset)}
            echelle={echelle}
            // **Seule, l'intruse n'écrase personne** : la réduction n'a de sens
            // que dans la comparaison. Zéro veut dire « rien à comparer », et
            // rend l'image à sa vraie échelle.
            tailleCommune={0}
            regardee
            onRegarder={() => undefined}
            plan={plan}
            duMonde={!personnage}
          />
        ) : null}
      </div>

      {/* ── La matrice, pour changer de sujet sans refermer ──────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-bord bg-fond-1 p-3">
        <Libelle>{personnage ? "Sa matrice" : "Le monde"}</Libelle>
        <Raison texte="on change de sujet sans refermer" />
        <ul className="flex flex-col">
          {(personnage ? plan : []).map((pose) => {
            const dedans = images.filter((i) => i.pose === pose.identifiant)
            const ecart = dedans.some((i) => i.hors_taille)
            return (
              <li
                key={pose.identifiant}
                className="mesure flex h-[26px] items-center gap-2 text-[11px] text-texte-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (dedans[0]) {
                      setRegardee(dedans[0].asset)
                      setEnsemble(false)
                    }
                  }}
                  disabled={dedans.length === 0}
                  className="min-w-0 flex-1 truncate text-left hover:text-signal disabled:text-texte-3 disabled:hover:text-texte-3"
                >
                  {pose.nom}
                </button>
                <span
                  className={[
                    "shrink-0 text-[10px]",
                    ecart ? "text-epingle" : "text-texte-3",
                  ].join(" ")}
                >
                  {ecart
                    ? `${dedans.find((i) => i.hors_taille)?.largeur} px`
                    : `${dedans.length} / ${pose.images}`}
                </span>
              </li>
            )
          })}
          {/* Du codex, la colonne liste les choses du monde plutôt que les
              poses d'une seule : c'est le même geste — changer de sujet sans
              refermer —, et la portée décide de ce qu'on liste. */}
          {!personnage &&
            images.map((image) => (
              <li
                key={image.asset}
                className="mesure flex h-[26px] items-center gap-2 text-[11px] text-texte-2"
              >
                <button
                  type="button"
                  onClick={() => setRegardee(image.asset)}
                  className="min-w-0 flex-1 truncate text-left hover:text-signal"
                >
                  {image.chose}
                </button>
                <span
                  className={[
                    "shrink-0 text-[10px]",
                    image.hors_taille ? "text-epingle" : "text-texte-3",
                  ].join(" ")}
                >
                  {image.largeur} px
                </span>
              </li>
            ))}
        </ul>
        {/* **La vitrine ne compte pas — elle marque ce qu'elle voit.** Les
            jauges restent celles du codex, et une image en écart porte la
            couleur des écarts, jamais celle d'un échec : un jeu en cours de
            fabrication n'échoue pas. */}
        <p className="mesure border-t border-bord pt-2 text-[10px] text-texte-3">
          {images.filter((i) => i.hors_taille).length > 0
            ? `${images.filter((i) => i.hors_taille).length} image${images.filter((i) => i.hors_taille).length > 1 ? "s" : ""} hors taille commune — ${vitrine.taille_commune} px`
            : `toutes à ${vitrine.taille_commune || "—"} px`}
        </p>
        <Raison texte="la vitrine ne compte pas — elle marque ce qu'elle voit" />
      </aside>
    </div>
  )
}

/** Une image posée, **à un multiple entier et sans le moindre lissage**.
 *
 *  `image-rendering: pixelated` est ce qui fait qu'un pixel devient un carré net
 *  de deux, quatre ou huit pixels d'écran. Sans lui, le navigateur interpole et
 *  l'on jugerait un flou que le jeu n'affichera jamais. */
function Sujet({
  image,
  asset,
  echelle,
  tailleCommune,
  regardee,
  onRegarder,
  plan,
  duMonde,
}: {
  image: VitrineDuJeu["images"][number]
  asset: Parameters<typeof sujetAsset>[0] | undefined
  echelle: Echelle
  /** La taille que la plupart des images rendent — celle qui fait référence.
   *  Zéro quand il n'y a rien à comparer. */
  tailleCommune: number
  regardee: boolean
  onRegarder: () => void
  plan: Pose[]
  /** La portée : le monde entier, ou une chose et ses poses. */
  duMonde: boolean
}) {
  // **Une image plus grande que la taille commune redescend à la taille
  // commune ; une plus petite reste petite.** Corrigé le 31 août 2026.
  //
  // La règle de l'écran est *toutes ses poses à la même échelle*, et elle
  // existe pour une chose précise : voir qu'une pose est sortie d'un quart
  // plus petite que ses sœurs. Cette lecture-là est intacte — le plus petit
  // reste plus petit, c'est même tout ce qu'on lui demande.
  //
  // Ce que la règle ne prévoyait pas est l'intruse : une image d'un autre
  // format, trois fois plus grande, que multiplier par deux laisse trois fois
  // plus grande. Mesuré sur un vrai personnage : **une image sur six occupait
  // 67 % de la surface d'image de la page**, et repoussait la deuxième rangée
  // de poses à un écran et demi de défilement. La comparaison que l'écran
  // existe pour rendre possible devenait impossible, et l'écran s'arrêtait au
  // constat — il écrit « hors taille commune » et laisse faire.
  //
  // La réduction se dit sous l'image : une échelle tue ne serait plus la même
  // échelle, et le pied de cet écran ne mentirait plus qu'à moitié.
  const reduite =
    tailleCommune > 0 && image.largeur > tailleCommune
      ? tailleCommune / image.largeur
      : 1
  const facteur = echelle * reduite
  const cote = image.largeur * facteur
  // **Du codex, c'est le nom de la chose ; de son établi, celui de la pose.**
  // Le même sujet, lu à la portée où on le regarde — et la portée se donne,
  // elle ne se devine pas : au monde, la pose existe aussi dans le plan, et la
  // deviner aurait écrit « repos » sous chacune des trois choses.
  const nom = duMonde
    ? image.chose
    : (plan.find((p) => p.identifiant === image.pose)?.nom ?? image.pose)

  return (
    <figure className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onRegarder}
        aria-label={`Regarder ${nom}`}
        className={[
          "rounded-[2px] border p-1 transition-colors duration-[80ms]",
          regardee ? "border-lumiere" : "border-transparent hover:border-bord",
          // **Le coin doré dit « hors taille commune »** : la couleur des
          // écarts, pas celle d'un échec.
          image.hors_taille ? "border-epingle" : "",
        ].join(" ")}
      >
        {asset && (
          <img
            src={sujetAsset(asset).src}
            alt={nom}
            width={cote}
            height={image.hauteur * facteur}
            style={{ imageRendering: "pixelated" }}
            className="block"
          />
        )}
      </button>
      <figcaption className="mesure text-center text-[9.5px] text-texte-3">
        {nom} · {image.largeur} × {image.hauteur}
        {image.hors_taille && " — hors taille commune"}
        {/* **Ce qui n'est pas à l'échelle des autres le dit.** Sans cette
            ligne, l'écran promettrait « toutes ses poses à la même échelle » en
            en montrant une qui ne l'est pas — ce serait un mensonge silencieux,
            et c'est ce que le produit refuse partout ailleurs. */}
        {reduite < 1 && (
          <>
            <br />
            <span className="text-epingle">
              ramenée à {Math.round(image.largeur * reduite)} px pour tenir dans
              la comparaison
            </span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
