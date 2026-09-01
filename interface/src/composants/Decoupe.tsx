// L'écran Découpe — une planche multi-sprites, et les rectangles qui en sortiront.
//
// **Un écran, pas un panneau**, et c'est le geste qui le dit : on dessine des
// rectangles sur une image de mille pixels, et la fiche en fait 380. Il couvre
// donc l'atelier, comme l'écran Univers, au lieu de s'y ajouter — et il vient de
// la fiche, où le geste commence, plutôt que d'une barre d'outils : on découpe
// **une** image, jamais une sélection.
//
// **Deux colonnes, `1fr · 380px`, et l'image passe à gauche.** L'univers montre
// ses réglages à gauche parce que c'est son sujet ; ici le sujet est la planche,
// et 380 reste la colonne de réglages du produit (`docs/DESIGN.md` § Layout).
//
// **Sa fente de refus est celle du châssis, depuis la V2.1.** Il en portait une
// à lui parce qu'il couvrait l'atelier : une raison envoyée à la barre d'état
// se serait rendue *derrière* lui, donc invisible au moment précis où elle
// compte. Devenu une profondeur de la galerie, il ne couvre plus rien — et une
// seule bande dit ce que le dernier geste a donné, quel que soit l'écran.
//
// **La détection ne décide de rien.** Elle propose ; l'auteur ajoute, retire,
// redessine, et ce qui part est sa liste. C'est cette séparation, et rien
// d'autre, qui tient « sans jamais bloquer » (US-73).
//
// ── Deux portes d'entrée depuis le 1ᵉʳ septembre 2026 ────────────────────────
//
// **Cet écran s'ouvre aussi sur une carte du tableau d'inspiration**, et ce qui
// en sort est alors des cartes (maquette `06bis-decouper-une-carte.html`). La
// demande de l'auteur était précise : *j'importe un artwork qui contient trois
// personnages sur un fond, je veux en faire trois*.
//
// **Ce qui traverse la frontière des deux familles d'images est l'outil, jamais
// l'image.** Un morceau de carte est une carte : il ne s'exporte pas, ne compte
// pas dans la bibliothèque, et n'a ni recette ni rendu. C'est pour ça que le
// sujet est une **union nommée** et non un objet flou — le type dit laquelle
// des deux familles on découpe, et ce que le geste rendra.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  api,
  Refus,
  type Asset,
  type Boite,
  type Carte,
  type Decoupable,
  type LectureDePalette,
  type ModeDecoupe,
} from "../api"
import { Bouton, Curseur, EnTetePanneau, Libelle, Raison, Segments } from "./chassis"
import type { Fente } from "./BarreChassis"
import { PANNEAU } from "./Infobulle"

/** En dessous, un rectangle est un clic qui a glissé, pas une intention. En
 *  pixels de la planche — la même unité que tout le reste de cet écran. */
const COTE_UTILE = 4

/** Le padding de la zone qui porte la planche — `docs/DESIGN.md` § Spacing,
 *  padding de zone centrale. Retiré de la place avant de calculer l'échelle :
 *  une planche qui remplirait la zone entière toucherait ses bords. */
const PADDING_ZONE = 16

const LIBELLES: Partial<Record<string, string>> = {
  auto: "zones opaques",
  grille: "grille fixe",
}

/**
 * Ce qu'on découpe — **et les deux familles d'images y sont nommées, jamais
 * confondues**.
 *
 * Le rappel de fin vit dans l'union plutôt qu'à côté, parce que les deux
 * familles ne rendent pas la même chose et que l'asymétrie mérite d'être dite :
 * une planche rend des assets qu'on ouvre tout de suite dans leur fiche, une
 * carte rend des cartes qui arrivent dans la réserve. Un seul rappel qui
 * accepterait les deux obligerait chaque appelant à vérifier ce qu'il reçoit.
 */
export type SujetDecoupe =
  | {
      famille: "planche"
      planche: Asset
      /** Ce que la découpe a produit. L'écran de l'atelier les a déjà reçues
       *  par le flux — elles arrivent une par une, comme les variations d'un
       *  appel ; ce rappel-ci sert à **fermer sur la première découpe**,
       *  ouverte dans sa fiche, pour qu'on voie tout de suite ce qu'on vient de
       *  fabriquer. */
      onDecoupe: (decoupes: Asset[]) => void
    }
  | {
      famille: "carte"
      carte: Carte
      /** Les morceaux, qui arrivent dans la réserve. Rien à ouvrir : ils ne
       *  sont pas promus, et promouvoir reste un geste. */
      onDecoupe: (morceaux: Carte[]) => void
    }

export function EcranDecoupe({
  sujet,
  onFermer,
  onFente,
}: {
  sujet: SujetDecoupe
  /** Remonter d'un étage — la touche Échap, et le fil d'Ariane du châssis. */
  onFermer: () => void
  onFente: (fente: Fente) => void
}) {
  const [mode, setMode] = useState<ModeDecoupe>("auto")
  const [coteMin, setCoteMin] = useState(16)
  const [colonnes, setColonnes] = useState(4)
  const [lignes, setLignes] = useState(2)
  /** **Décochée par défaut, et c'est la moitié de la décision.** C'est le seul
   *  endroit du produit où découper efface quelque chose ; un défaut à vrai en
   *  ferait le comportement ordinaire. */
  const [remplacer, setRemplacer] = useState(false)

  /** Ce que la palette lit de cette carte, et l'image qui le montre.
   *
   *  **L'aperçu est ici et pas dans le menu d'une carte**, et il y a une mesure
   *  derrière ce choix : le menu s'ouvre au survol, il est borné par l'écran, et
   *  sur une carte du bas de la grille il ne fait que 206 px de haut. L'image y
   *  défilait dans un hublot plus petit qu'elle. Ici elle occupe la moitié
   *  gauche de l'écran, à la taille où l'on voit ce qui est écarté — et c'est
   *  l'endroit où l'on peut agir dessus, puisqu'on y découpe.
   *
   *  Le menu, lui, garde le chiffre et sa phrase : la question « est-ce que mon
   *  fond pollue ma palette ? » se répond en un mot, et un mot tient partout. */
  const [lecture, setLecture] = useState<LectureDePalette | null>(null)
  const [magenta, setMagenta] = useState(false)

  const [boites, setBoites] = useState<Boite[]>([])
  const [detectee, setDetectee] = useState<Decoupable | null>(null)
  const [choisie, setChoisie] = useState<number | null>(null)
  const setRefus = (texte: string) =>
    onFente(texte ? { ton: "echec", texte } : null)
  const [enCours, setEnCours] = useState(false)

  /** L'image à découper, ses mesures et son nom — quelle que soit sa famille.
   *
   *  **L'image est la brute, jamais un rendu.** Le rendu d'un asset peut être un
   *  sprite de 64 px là où la planche en fait 1024, et des rectangles posés
   *  dessus ne désigneraient plus rien de découpable. Une carte n'a pas de
   *  rendu du tout : son image *est* ce qu'on découpera. */
  const vu =
    sujet.famille === "planche"
      ? {
          identifiant: sujet.planche.identifiant,
          largeur: sujet.planche.largeur,
          hauteur: sujet.planche.hauteur,
          alt: sujet.planche.label,
          image: api.rendu(
            sujet.planche.identifiant,
            sujet.planche.empreinte,
            true,
          ),
          quoi: "asset",
        }
      : {
          identifiant: sujet.carte.identifiant,
          largeur: sujet.carte.largeur,
          hauteur: sujet.carte.hauteur,
          alt: sujet.carte.note || "la carte",
          image: api.imageCarte(sujet.carte.identifiant, sujet.carte.empreinte),
          quoi: "carte",
        }

  // ── La proposition ────────────────────────────────────────────────────────
  //
  // Elle se redemande à chaque cran de réglage, et **elle remplace la liste** :
  // c'est ce qu'un changement de mode veut dire. Ce qu'on avait dessiné à la
  // main disparaît alors — d'où la ligne qui le dit sous les réglages, plutôt
  // qu'une confirmation qui couperait le geste en deux.

  const famille = sujet.famille
  const proposer = useCallback(async () => {
    const reglage = { mode, colonnes, lignes, cote_min: coteMin }
    try {
      const propose =
        famille === "planche"
          ? await api.decoupeProposee(vu.identifiant, reglage)
          : await api.decoupeDeCarteProposee(vu.identifiant, reglage)
      setDetectee(propose)
      setBoites(propose.boites)
      setChoisie(null)
      setRefus("")
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "découpe illisible")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famille, vu.identifiant, mode, colonnes, lignes, coteMin])

  useEffect(() => {
    void proposer()
  }, [proposer])

  // ── Découper ──────────────────────────────────────────────────────────────

  const decouper = async () => {
    setEnCours(true)
    try {
      if (sujet.famille === "planche") {
        const fait = await api.decouper(vu.identifiant, boites)
        sujet.onDecoupe(fait.decoupes)
      } else {
        const fait = await api.decouperCarte(vu.identifiant, boites, remplacer)
        sujet.onDecoupe(fait.morceaux)
      }
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "découpe refusée")
    } finally {
      setEnCours(false)
    }
  }

  // La touche Suppr retire le rectangle choisi — le geste attendu quand on vient
  // d'en cliquer un. Posée sur la fenêtre : le rectangle choisi n'est pas un
  // champ, il n'a pas le focus, et exiger un clic sur une croix de 10 px pour
  // retirer douze faux positifs serait douze fois trop cher.
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") return onFermer()
      if (choisie === null) return
      if (evenement.key !== "Delete" && evenement.key !== "Backspace") return
      setBoites((liste) => liste.filter((_, i) => i !== choisie))
      setChoisie(null)
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [choisie, onFermer])

  // **Demandée d'entrée, et une seule fois.** Cet écran s'ouvre par un clic,
  // pas par un survol : une mesure au chargement est du même ordre que la
  // détection, qui part déjà toute seule. Elle ne concerne que les cartes — un
  // asset produit ne nourrit aucune palette.
  const carte = sujet.famille === "carte" ? sujet.carte : null
  useEffect(() => {
    if (!carte) return
    let vivant = true
    void api
      .lectureDePalette(carte.identifiant)
      .then((lu) => vivant && setLecture(lu))
      // **Un aperçu qui manque ne fait pas de fente.** Ce n'est pas le sujet de
      // l'écran ; il découpe, et il découpe très bien sans savoir ça.
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [carte?.identifiant])

  const corrigee = detectee !== null && !memesBoites(boites, detectee.boites)

  return (
    // **Une profondeur de la galerie, plus un écran posé dessus.** Il occupait
    // tout l'écran en `fixed`, avec son propre en-tête de 44 px : son nom, le
    // label de la planche, ses dimensions, sa fente de refus, et un bouton pour
    // revenir. Le nom et le label sont désormais dans le fil d'Ariane de la
    // barre du châssis — `Cœur de pierre › Galerie › tonneau-cerclé-02 ›
    // Découpage` —, la fente est celle du châssis, et le retour se fait par le
    // fil, dont chaque segment ramène à son étage.
    <div data-decoupe className="flex min-h-0 flex-col bg-fond-0">
      <div className="flex min-h-0 flex-1">
        <Planche
          vu={
            magenta && carte
              ? { ...vu, image: api.apercuDeLaLecture(carte.identifiant, carte.empreinte) }
              : vu
          }
          boites={boites}
          choisie={choisie}
          onChoisir={setChoisie}
          onDessiner={(boite) => {
            setBoites((liste) => [...liste, boite])
            setChoisie(boites.length)
          }}
        />

        <aside
          {...PANNEAU}
          className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-bord bg-fond-1"
        >
          <EnTetePanneau>
            Ce qui sortira
            {/* Les dimensions de la planche viennent d'ici : l'en-tête de
                panneau est déjà l'endroit du produit où l'on lit ce que
                l'image est, et le fil d'Ariane porte des noms, pas des
                mesures. */}
            <span className="ml-auto normal-case tracking-normal">
              {vu.largeur}×{vu.hauteur}
            </span>
          </EnTetePanneau>

          <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
            {/* **La réponse à la question qui amène ici.** Une planche trouvée
                porte trois personnages sur un fond ; on vient la couper en
                croyant que c'est le fond qui salit la palette. Ce n'est pas le
                fond — il est déjà écarté. Ce sont les voisins. Le dire avant de
                dessiner un rectangle évite un découpage pour rien. */}
            {lecture && (
              <div className="flex flex-col gap-1.5 border-b border-bord pb-3">
                <Libelle aide="carte.lecture">Ce que la palette y lit</Libelle>
                {lecture.entiere ? (
                  <p className="text-[11.5px] leading-snug text-texte-2">
                    Rien n'est mis de côté : l'image entière donne ses couleurs.
                    C'est ce qui arrive à une matière ou à une texture, qui n'ont
                    pas de fond.
                  </p>
                ) : (
                  <>
                    <p className="text-[11.5px] leading-snug text-texte-2">
                      <span className="mesure text-texte">{lecture.part} %</span>{" "}
                      de l'image {carte?.officiel ? "donne" : "donnerait"} ses
                      couleurs au jeu. Le reste — le fond — est écarté tout seul.
                    </p>
                    <button
                      type="button"
                      aria-pressed={magenta}
                      onClick={() => setMagenta(!magenta)}
                      className="flex items-start gap-2 text-left text-[11.5px] leading-snug text-texte-2 hover:text-texte"
                    >
                      <span
                        aria-hidden
                        className={`mt-[3px] block h-[14px] w-[14px] shrink-0 rounded-[2px] border ${
                          magenta ? "border-signal bg-signal" : "border-bord-fort"
                        }`}
                      />
                      <span>
                        me le montrer sur l'image
                        <span className="mesure block text-[9.5px] text-texte-3">
                          en magenta, ce qui ne compte pas
                        </span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Libelle aide="decoupe.mode">Détection</Libelle>
              <Segments
                valeurs={["auto", "grille"] as const}
                valeur={mode}
                onChange={setMode}
                libelles={LIBELLES}
              />
            </div>

            {mode === "auto" ? (
              <Reglage libelle="taille minimale" aide="decoupe.taille_min">
                <Curseur
                  valeur={coteMin}
                  min={0}
                  max={128}
                  unite=" px"
                  onChange={setCoteMin}
                />
              </Reglage>
            ) : (
              <>
                <Reglage libelle="colonnes" aide="decoupe.colonnes">
                  <Curseur
                    valeur={colonnes}
                    min={1}
                    max={16}
                    onChange={setColonnes}
                  />
                </Reglage>
                <Reglage libelle="lignes" aide="decoupe.lignes">
                  <Curseur valeur={lignes} min={1} max={16} onChange={setLignes} />
                </Reglage>
              </>
            )}

            <Raison texte={detectee?.raison ?? null} />

            {/* Ce que la détection ne peut pas savoir se dit ici, avant qu'on
                s'en aperçoive : dessiner remplace la détection, changer de
                réglage remplace ce qu'on a dessiné. */}
            <p className="mesure flex items-start gap-1.5 text-[10px] leading-4 text-texte-3">
              <span aria-hidden className="mt-[7px] inline-block h-px w-2 shrink-0 bg-texte-3" />
              <span>
                {corrigee
                  ? "corrigé à la main — changer un réglage relancera la détection"
                  : "glisse sur l'image pour ajouter un rectangle, clique pour en choisir un"}
              </span>
            </p>

            <ListeBoites
              boites={boites}
              choisie={choisie}
              onChoisir={setChoisie}
              onRetirer={(rang) => {
                setBoites((liste) => liste.filter((_, i) => i !== rang))
                setChoisie(null)
              }}
            />
          </div>

          <div className="flex flex-col gap-1 border-t border-bord p-2">
            {/* **Recadrer, c'est découper en un seul rectangle** — et sans
                cette case, ça coûterait cinq mouvements : découper, retrouver
                le morceau dans la réserve, le poser, le promouvoir avec sa
                famille, retirer l'ancienne. Oublier le cinquième ferait compter
                les deux dans la palette.

                **Proposée seulement quand il n'y a qu'un rectangle**, parce qu'à
                plusieurs la question n'a pas de réponse : un morceau parmi
                plusieurs ne peut pas prétendre être l'originale. */}
            {sujet.famille === "carte" && boites.length === 1 && (
              <button
                type="button"
                aria-pressed={remplacer}
                onClick={() => setRemplacer(!remplacer)}
                className="mb-1 flex items-start gap-2 text-left text-[11.5px] leading-snug text-texte-2 hover:text-texte"
              >
                <span
                  aria-hidden
                  className={`mt-[3px] block h-[14px] w-[14px] shrink-0 rounded-[2px] border ${
                    remplacer ? "border-signal bg-signal" : "border-bord-fort"
                  }`}
                />
                <span>
                  ce morceau prend la place de l'originale
                  <span className="mesure block text-[9.5px] text-texte-3">
                    il hérite de sa promotion, sa famille, son groupe et sa place
                    — et l'originale s'en va
                  </span>
                </span>
              </button>
            )}
            <div className="flex items-center gap-2">
              <Bouton
                principal
                inactif={boites.length === 0 || enCours}
                onClick={decouper}
                enfants={
                  enCours
                    ? "…"
                    : `Découper en ${boites.length} ${vu.quoi}${boites.length > 1 ? "s" : ""}`
                }
              />
              <button
                type="button"
                onClick={() => {
                  setBoites([])
                  setChoisie(null)
                }}
                className="mesure ml-auto text-[10px] text-texte-3 hover:text-texte-2"
              >
                Tout retirer
              </button>
            </div>
            {boites.length === 0 && (
              <Raison texte="aucun rectangle — il n'y a rien à découper" />
            )}
            {/* Ce que les morceaux deviennent, dit avant de cliquer. La réserve
                *est* l'endroit de ce qui n'est pas rangé, et promouvoir reste
                un geste : quatre promotions automatiques seraient quatre
                artworks que personne n'a choisis. */}
            {sujet.famille === "carte" && boites.length > 0 && !remplacer && (
              <Raison texte="les morceaux arrivent dans la réserve, non promus — l'originale reste où elle est" />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── La planche, et les rectangles dessus ────────────────────────────────────

/**
 * L'image **brute**, à sa taille d'affichage, et les rectangles par-dessus.
 *
 * Brute et jamais rendue : le rendu peut être un sprite de 64 px là où la
 * planche en fait 1024, et des rectangles posés dessus ne désigneraient plus
 * rien de découpable. C'est la même image que le serveur découpera.
 *
 * **Les coordonnées vivent en pixels de planche, jamais en pixels d'écran.**
 * L'image est mise à l'échelle pour tenir dans la place disponible ; tout ce
 * qui sort d'ici est reconverti tout de suite, sans quoi une fenêtre
 * redimensionnée déplacerait des rectangles déjà posés.
 */
function Planche({
  vu,
  boites,
  choisie,
  onChoisir,
  onDessiner,
}: {
  /** Ce que le sujet donne à voir — ses mesures, son image, son nom. **La
   *  planche n'est plus un asset**, parce que ce cadre découpe aussi une carte
   *  du tableau, et qu'une carte n'a ni recette ni rendu. */
  vu: { largeur: number; hauteur: number; alt: string; image: string }
  boites: Boite[]
  choisie: number | null
  onChoisir: (rang: number | null) => void
  onDessiner: (boite: Boite) => void
}) {
  const zone = useRef<HTMLElement>(null)
  const cadre = useRef<HTMLDivElement>(null)
  const [trace, setTrace] = useState<Boite | null>(null)
  const [place, setPlace] = useState({ largeur: 0, hauteur: 0 })

  // ── La taille du cadre, calculée et non déléguée au CSS ───────────────────
  //
  // **`aspect-ratio` cède devant `max-height`, et le rectangle ment.** Première
  // version : `width: 100%` plus `aspect-ratio` plus `max-h-full`. Sur une
  // planche carrée de 1024 px dans une zone de 1420 × 906, le navigateur donne
  // 1420 de large, en déduit 1420 de haut, puis **rabote la hauteur à 874 sans
  // redéduire la largeur** — le cadre fait 1388 × 874 pour une image carrée.
  // L'image, elle, reste centrée par `object-contain` : les rectangles, posés
  // en pourcentage du **cadre**, se décalent alors de l'image qu'ils désignent.
  // Vu en mesurant le cadre au navigateur, jamais à l'œil.
  //
  // On tient donc la mise à l'échelle nous-mêmes : un seul facteur, celui qui
  // fait entrer la planche dans la place, et le cadre **est** l'image. Les
  // pourcentages redeviennent exacts, et la conversion clic → pixel aussi.
  const mesurerPlace = useCallback(() => {
    const vue = zone.current
    if (!vue) return
    setPlace({
      largeur: vue.clientWidth - 2 * PADDING_ZONE,
      hauteur: vue.clientHeight - 2 * PADDING_ZONE,
    })
  }, [])

  useLayoutEffect(mesurerPlace, [mesurerPlace, vu.image])

  useEffect(() => {
    window.addEventListener("resize", mesurerPlace)
    return () => window.removeEventListener("resize", mesurerPlace)
  }, [mesurerPlace])

  const facteur = Math.min(
    (place.largeur || vu.largeur) / vu.largeur,
    (place.hauteur || vu.hauteur) / vu.hauteur,
  )

  const enPixels = (evenement: React.PointerEvent): [number, number] => {
    const boite = cadre.current!.getBoundingClientRect()
    const echelle = vu.largeur / boite.width
    return [
      borner(Math.round((evenement.clientX - boite.left) * echelle), vu.largeur),
      borner(Math.round((evenement.clientY - boite.top) * echelle), vu.hauteur),
    ]
  }

  const depart = useRef<[number, number] | null>(null)

  return (
    <section
      ref={zone}
      className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
    >
      <div
        ref={cadre}
        className="damier relative border border-bord select-none"
        style={{
          width: Math.max(1, Math.floor(vu.largeur * facteur)),
          height: Math.max(1, Math.floor(vu.hauteur * facteur)),
        }}
        onPointerDown={(evenement) => {
          if (evenement.button !== 0) return
          evenement.currentTarget.setPointerCapture(evenement.pointerId)
          depart.current = enPixels(evenement)
          setTrace(null)
        }}
        onPointerMove={(evenement) => {
          if (!depart.current) return
          setTrace(entre(depart.current, enPixels(evenement)))
        }}
        onPointerUp={(evenement) => {
          const debut = depart.current
          depart.current = null
          setTrace(null)
          if (!debut) return
          const boite = entre(debut, enPixels(evenement))
          // Un clic n'est pas un rectangle : sous quatre pixels de côté, c'est
          // le geste « je choisis » ou « je désélectionne », pas « j'ajoute ».
          if (boite[2] - boite[0] < COTE_UTILE || boite[3] - boite[1] < COTE_UTILE) {
            if (evenement.target === evenement.currentTarget) onChoisir(null)
            return
          }
          onDessiner(boite)
        }}
      >
        <img
          src={vu.image}
          alt={vu.alt}
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />

        {boites.map((boite, rang) => (
          <Rectangle
            key={rang}
            boite={boite}
            vu={vu}
            numero={rang + 1}
            choisi={rang === choisie}
            onChoisir={() => onChoisir(rang)}
          />
        ))}
        {trace && (
          <Rectangle
            boite={trace}
            vu={vu}
            numero={boites.length + 1}
            choisi
          />
        )}
      </div>
    </section>
  )
}

/** Un rectangle sur la planche. **La même grammaire que la tuile** : l'anneau
 *  `--lumiere` ne veut dire que « choisi », et le numéro est un fait mesuré,
 *  donc en mono. Aucune couleur supplémentaire n'entre ici. */
function Rectangle({
  boite,
  vu,
  numero,
  choisi,
  onChoisir,
}: {
  boite: Boite
  /** Les mesures de l'image dessous, et rien d'autre : le rectangle se place en
   *  pourcentage, il n'a que faire de la famille de ce qu'il découpe. */
  vu: { largeur: number; hauteur: number }
  numero: number
  choisi: boolean
  onChoisir?: () => void
}) {
  const [x0, y0, x1, y1] = boite
  return (
    <button
      type="button"
      tabIndex={onChoisir ? 0 : -1}
      onPointerUp={(evenement) => {
        if (!onChoisir) return
        evenement.stopPropagation()
        onChoisir()
      }}
      style={{
        left: `${(x0 / vu.largeur) * 100}%`,
        top: `${(y0 / vu.hauteur) * 100}%`,
        width: `${((x1 - x0 + 1) / vu.largeur) * 100}%`,
        height: `${((y1 - y0 + 1) / vu.hauteur) * 100}%`,
      }}
      className={[
        "absolute block border transition-colors duration-[80ms]",
        choisi
          ? "border-lumiere shadow-[0_0_0_1px_var(--color-lumiere)]"
          : "border-signal hover:border-signal-clair",
      ].join(" ")}
    >
      <span className="mesure absolute top-0 left-0 bg-[rgba(11,13,16,.82)] px-1 text-[8.5px] leading-[13px] text-texte-2">
        {numero}
      </span>
    </button>
  )
}

// ── La liste ────────────────────────────────────────────────────────────────

/** Ce qui sortira, et dans quel ordre. La liste **est** la numérotation posée
 *  sur l'image : les deux se lisent ensemble, et le serveur garde cet ordre —
 *  le réordonner de son côté ferait mentir les numéros au moment du clic. */
function ListeBoites({
  boites,
  choisie,
  onChoisir,
  onRetirer,
}: {
  boites: Boite[]
  choisie: number | null
  onChoisir: (rang: number) => void
  onRetirer: (rang: number) => void
}) {
  if (boites.length === 0) return null
  return (
    <div className="flex flex-col gap-[2px] border-t border-bord pt-2">
      <Libelle>{boites.length} rectangle{boites.length > 1 ? "s" : ""}</Libelle>
      {boites.map((boite, rang) => (
        <div
          key={rang}
          className={[
            "mesure flex items-center gap-2 rounded-[2px] px-1 text-[10px]",
            rang === choisie ? "bg-fond-3 text-texte" : "text-texte-3",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => onChoisir(rang)}
            className="flex flex-1 items-center gap-2 text-left hover:text-texte-2"
          >
            <span className="w-4 shrink-0">{rang + 1}</span>
            <span>
              {boite[2] - boite[0] + 1}×{boite[3] - boite[1] + 1}
            </span>
            <span className="text-texte-3">
              @ {boite[0]},{boite[1]}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onRetirer(rang)}
            aria-label={`Retirer le rectangle ${rang + 1}`}
            className="shrink-0 px-1 hover:text-echec"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Le gabarit d'un réglage — le même que dans la fiche ─────────────────────

function Reglage({
  libelle,
  aide,
  children,
}: {
  libelle: string
  /** La clé de l'entrée du corpus (`src/aide.ts`), s'il y en a une. Le libellé
   *  devient alors sa propre poignée ; sans clé, rien ne se marque. */
  aide?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Libelle aide={aide}>{libelle}</Libelle>
      {children}
    </div>
  )
}

// ── Outils ──────────────────────────────────────────────────────────────────

const borner = (valeur: number, taille: number) =>
  Math.max(0, Math.min(taille - 1, valeur))

const entre = (a: [number, number], b: [number, number]): Boite => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
]

const memesBoites = (a: Boite[], b: Boite[]) =>
  a.length === b.length && a.every((boite, i) => boite.every((v, j) => v === b[i][j]))
