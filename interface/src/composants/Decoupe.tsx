// L'écran Découpe — une planche multi-sprites, et les rectangles qui en sortiront.
//
// **Une fabrique, posée dans la retouche.** Elle ne règle pas l'image ouverte :
// elle en écrit d'autres, et `Retouche.tsx` lui réserve tout le cadre de travail
// dès qu'on choisit sa table — la règle de `B24`. On dessine des rectangles sur
// une image de mille pixels, et la colonne de droite en fait 380, la largeur de
// réglages du produit (`docs/DESIGN.md` § Layout).
//
// **Sa fente de refus est celle du châssis**, passée par `onFente`.
//
// **La détection ne décide de rien.** Elle propose ; l'auteur ajoute, retire,
// redessine, et ce qui part est sa liste. C'est cette séparation, et rien
// d'autre, qui tient « sans jamais bloquer » (US-73).
//
// ── Deux portes d'entrée depuis le 1ᵉʳ septembre 2026 ────────────────────────
//
// **Cet écran s'ouvre aussi sur une carte du tableau d'inspiration**, et ce qui
// en sort est alors des cartes. La demande de l'auteur était précise :
// *j'importe un artwork qui contient trois personnages sur un fond, je veux en
// faire trois*.
//
// **Ce qui traverse la frontière des deux familles d'images est l'outil, jamais
// l'image.** Un morceau de carte est une carte : il ne s'exporte pas, ne compte
// pas dans la bibliothèque, et n'a ni recette ni rendu. C'est pour ça que le
// sujet est une **union nommée** et non un objet flou — le type dit laquelle
// des deux familles on découpe, et ce que le geste rendra.
//
// **Passé au papier en `C8`.** Montée depuis `Retouche.tsx`, qui est déjà du
// carnet ; c'est ce fichier-ci qui ne l'était pas encore.

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
import type { Fente } from "./EnTeteDeSurface"
import { PANNEAU } from "./Infobulle"

/** En dessous, un rectangle est un clic qui a glissé, pas une intention. En
 *  pixels de la planche — la même unité que tout le reste de cet écran. */
const COTE_UTILE = 4

/** Le padding de la zone qui porte la planche — `docs/DESIGN.md` § Spacing.
 *  Retiré de la place avant de calculer l'échelle : une planche qui remplirait
 *  la zone entière toucherait ses bords. */
const PADDING_ZONE = 14

const LIBELLES: Partial<Record<string, string>> = {
  auto: "zones opaques",
  grille: "grille fixe",
  gouttieres: "les gouttières",
}

/** Au-delà, l'écran annonce ce que la détection a coûté (`B18`) — jamais
 *  avant, pour ne pas alarmer sur ce qui se sent à peine. */
const SEUIL_LENT_MS = 240

/**
 * Ce qu'on découpe — **et les deux familles d'images y sont nommées, jamais
 * confondues**.
 *
 * Le rappel de fin vit dans l'union plutôt qu'à côté, parce que les deux
 * familles ne rendent pas la même chose : une planche rend des assets qu'on
 * ouvre tout de suite dans leur fiche, une carte rend des cartes qui arrivent
 * dans la réserve.
 */
export type SujetDecoupe =
  | {
      famille: "planche"
      planche: Asset
      /** Ce que la découpe a produit — fermer sur la première découpe, ouverte
       *  dans sa fiche. */
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

  /** Ce que la palette lit de cette carte, et l'image qui le montre. */
  const [lecture, setLecture] = useState<LectureDePalette | null>(null)
  const [magenta, setMagenta] = useState(false)

  const [boites, setBoites] = useState<Boite[]>([])
  const [detectee, setDetectee] = useState<Decoupable | null>(null)
  const [choisie, setChoisie] = useState<number | null>(null)
  const setRefus = (texte: string) => onFente(texte ? { ton: "echec", texte } : null)
  const [enCours, setEnCours] = useState(false)

  /** L'image à découper, ses mesures et son nom — quelle que soit sa famille.
   *
   *  **L'image est la brute, jamais un rendu.** Une carte n'a pas de rendu du
   *  tout : son image *est* ce qu'on découpera. */
  const vu =
    sujet.famille === "planche"
      ? {
          identifiant: sujet.planche.identifiant,
          largeur: sujet.planche.largeur,
          hauteur: sujet.planche.hauteur,
          alt: sujet.planche.label,
          image: api.rendu(sujet.planche.identifiant, sujet.planche.empreinte, true),
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
  // c'est ce qu'un changement de mode veut dire.
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

  // La touche Suppr retire le rectangle choisi.
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

  // **Demandée d'entrée, et une seule fois.** Ne concerne que les cartes.
  const carte = sujet.famille === "carte" ? sujet.carte : null
  useEffect(() => {
    if (!carte) return
    let vivant = true
    void api
      .lectureDePalette(carte.identifiant)
      .then((lu) => vivant && setLecture(lu))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [carte?.identifiant])

  const corrigee = detectee !== null && !memesBoites(boites, detectee.boites)

  return (
    <div data-decoupe className="flex min-h-0 flex-1 flex-col bg-papier">
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
          className="flex min-h-0 w-[380px] shrink-0 flex-col border-l border-trait bg-papier-cote"
        >
          <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
            Ce qui sortira
            <span className="ml-auto normal-case tracking-normal">
              {vu.largeur}×{vu.hauteur}
            </span>
          </div>

          <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[8px]">
            {/* **La réponse à la question qui amène ici.** Une planche trouvée
                porte trois personnages sur un fond ; on vient la couper en
                croyant que c'est le fond qui salit la palette. Ce ne sont pas
                le fond — il est déjà écarté. Ce sont les voisins. */}
            {lecture && (
              <div className="flex flex-col gap-[6px] border-b border-trait pb-[14px]">
                <p className="text-[11px] text-encre-2">Ce que la palette y lit</p>
                {lecture.entiere ? (
                  <p className="text-[11px] leading-snug text-encre-2">
                    Rien n'est mis de côté : l'image entière donne ses couleurs.
                    C'est ce qui arrive à une matière ou à une texture, qui n'ont
                    pas de fond.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] leading-snug text-encre-2">
                      <span className="mesure text-encre">{lecture.part} %</span>{" "}
                      de l'image {carte?.officiel ? "donne" : "donnerait"} ses
                      couleurs au jeu.{" "}
                      {lecture.part >= 100
                        ? "Rien n'en est écarté : le détourage n'a trouvé aucun fond à retirer."
                        : "Le reste — le fond — est écarté tout seul."}
                    </p>
                    {lecture.part < 100 && (
                      <button
                        type="button"
                        aria-pressed={magenta}
                        onClick={() => setMagenta(!magenta)}
                        className="flex items-start gap-[8px] text-left text-[11px] text-encre-2 hover:text-encre"
                      >
                        <Case cochee={magenta} />
                        <span>
                          me le montrer sur l'image
                          <span className="mesure block text-[10.5px] text-encre-4">
                            en magenta, ce qui ne compte pas
                          </span>
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-[4px]">
              <p className="text-[11px] text-encre-2">Détection</p>
              <Choix
                valeurs={["auto", "grille", "gouttieres"] as const}
                valeur={mode}
                onChange={setMode}
                libelles={LIBELLES}
              />
            </div>

            {mode === "auto" && (
              <Champ libelle="taille minimale">
                <Glissiere valeur={coteMin} min={0} max={128} unite=" px" onChange={setCoteMin} />
              </Champ>
            )}

            {mode === "grille" && (
              <>
                <Champ libelle="colonnes">
                  <Glissiere valeur={colonnes} min={1} max={16} onChange={setColonnes} />
                </Champ>
                <Champ libelle="lignes">
                  <Glissiere valeur={lignes} min={1} max={16} onChange={setLignes} />
                </Champ>
              </>
            )}

            {mode === "gouttieres" && (
              <p className="text-[11px] leading-snug text-encre-2">
                Cherche les rangées et les colonnes entièrement d'une seule
                couleur, et coupe là — rien à régler.
              </p>
            )}

            <Pourquoi texte={detectee?.raison ?? null} />

            {detectee && (detectee.duree_ms ?? 0) > SEUIL_LENT_MS && (
              <p className="mesure text-[10.5px] leading-4 text-encre-4">
                détection : {Math.round(detectee.duree_ms ?? 0)} ms
              </p>
            )}

            {/* Ce que la détection ne peut pas savoir se dit ici, avant qu'on
                s'en aperçoive : dessiner remplace la détection, changer de
                réglage remplace ce qu'on a dessiné. */}
            <p className="mesure flex items-start gap-[6px] text-[10.5px] leading-4 text-encre-4">
              <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
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

          <div className="flex flex-col gap-[4px] border-t border-trait p-[8px]">
            {/* **Recadrer, c'est découper en un seul rectangle.** Proposée
                seulement quand il n'y a qu'un rectangle : à plusieurs la
                question n'a pas de réponse. */}
            {sujet.famille === "carte" && boites.length === 1 && (
              <button
                type="button"
                aria-pressed={remplacer}
                onClick={() => setRemplacer(!remplacer)}
                className="mb-[4px] flex items-start gap-[8px] text-left text-[11px] text-encre-2 hover:text-encre"
              >
                <Case cochee={remplacer} />
                <span>
                  ce morceau prend la place de l'originale
                  <span className="mesure block text-[10.5px] text-encre-4">
                    il hérite de sa promotion, sa famille, son groupe et sa place
                    — et l'originale s'en va
                  </span>
                </span>
              </button>
            )}
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                disabled={boites.length === 0 || enCours}
                onClick={() => void decouper()}
                className="h-[34px] rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:opacity-90 disabled:bg-carte disabled:text-eteint"
              >
                {enCours
                  ? "…"
                  : `Découper en ${boites.length} ${vu.quoi}${boites.length > 1 ? "s" : ""}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoites([])
                  setChoisie(null)
                }}
                className="mesure ml-auto text-[10.5px] text-encre-3 hover:text-encre-2"
              >
                Tout retirer
              </button>
            </div>
            {boites.length === 0 && <Pourquoi texte="aucun rectangle — il n'y a rien à découper" />}
            {/* Ce que les morceaux deviennent, dit avant de cliquer. */}
            {sujet.famille === "carte" && boites.length > 0 && !remplacer && (
              <Pourquoi texte="les morceaux arrivent dans la réserve, non promus — l'originale reste où elle est" />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Le petit vocabulaire de cet écran ───────────────────────────────────────

/** Une case à cocher dessinée — le geste est porté par un bouton entier
 *  (`aria-pressed`), pas par le carré seul : la cible cliquable est toute la
 *  ligne, texte compris. */
function Case({ cochee }: { cochee: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "mt-[4px] block h-[14px] w-[14px] shrink-0 rounded-5 border",
        cochee ? "border-encre-4 bg-encre-4" : "border-encre-4 bg-transparent",
      ].join(" ")}
    />
  )
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <p className="text-[11px] text-encre-2">{libelle}</p>
      {children}
    </div>
  )
}

/** « Le grisé porte sa raison. » Une ligne sœur, mono 10,5 px, tiret de 8 px. */
function Pourquoi({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p className="mesure flex items-start gap-[6px] text-[10.5px] leading-4 text-encre-4">
      <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
      <span>{texte}</span>
    </p>
  )
}

/** Le segmenté — la même grammaire que les tables de `Retouche.tsx`. */
function Choix<T extends string>({
  valeurs,
  valeur: courante,
  libelles,
  onChange,
}: {
  valeurs: readonly T[]
  valeur: T
  libelles?: Partial<Record<string, string>>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-[4px]">
      {valeurs.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={courante === v}
          onClick={() => onChange(v)}
          className={[
            "h-[26px] rounded-7 border px-[8px] text-[12px] transition-colors duration-120",
            courante === v
              ? "border-encre-4 bg-carte font-medium text-encre"
              : "border-trait bg-carte text-encre-3 hover:border-encre-4 hover:text-encre",
          ].join(" ")}
        >
          {libelles?.[v] ?? v}
        </button>
      ))}
    </div>
  )
}

/** Un curseur, et sa valeur qui s'écrit à côté. */
function Glissiere({
  valeur,
  min,
  max,
  unite = "",
  onChange,
}: {
  valeur: number
  min: number
  max: number
  unite?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <input
        type="range"
        min={min}
        max={max}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="curseur-papier h-[22px] min-w-0 flex-1"
      />
      <span className="mesure w-[54px] shrink-0 text-right text-[10.5px] text-encre-2">
        {valeur}
        {unite}
      </span>
    </div>
  )
}

// ── La planche, et les rectangles dessus ────────────────────────────────────

/**
 * L'image **brute**, à sa taille d'affichage, et les rectangles par-dessus.
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
  // `aspect-ratio` cède devant `max-height` sur une planche carrée : le
  // navigateur donne une largeur, en déduit une hauteur, puis rabote la
  // hauteur sans redéduire la largeur — le cadre ne serait plus l'image, et
  // les rectangles, posés en pourcentage du cadre, se décaleraient de ce
  // qu'ils désignent. On tient donc la mise à l'échelle nous-mêmes.
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
      className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-[14px]"
    >
      <div
        ref={cadre}
        className="damier-papier relative border border-trait select-none"
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
          // le geste « je choisis » ou « je désélectionne ».
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
        {trace && <Rectangle boite={trace} vu={vu} numero={boites.length + 1} choisi />}
      </div>
    </section>
  )
}

/** Un rectangle sur la planche. Le numéro est un fait mesuré, donc en mono. */
function Rectangle({
  boite,
  vu,
  numero,
  choisi,
  onChoisir,
}: {
  boite: Boite
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
        "absolute block border transition-colors duration-120",
        choisi
          ? "border-2 border-signal shadow-[0_0_0_2px_var(--color-carte)]"
          : "border-signal/70 hover:border-signal",
      ].join(" ")}
    >
      <span className="mesure absolute top-0 left-0 bg-encre px-[4px] text-[10.5px] leading-[13px] text-papier">
        {numero}
      </span>
    </button>
  )
}

// ── La liste ────────────────────────────────────────────────────────────────

/** Ce qui sortira, et dans quel ordre. La liste **est** la numérotation posée
 *  sur l'image : le serveur garde cet ordre — le réordonner de son côté ferait
 *  mentir les numéros au moment du clic. */
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
    <div className="flex flex-col gap-[2px] border-t border-trait pt-[8px]">
      <p className="text-[11px] text-encre-2">
        {boites.length} rectangle{boites.length > 1 ? "s" : ""}
      </p>
      {boites.map((boite, rang) => (
        <div
          key={rang}
          className={[
            "mesure flex items-center gap-[8px] rounded-5 px-[4px] text-[10.5px]",
            rang === choisie ? "bg-ligne-ouverte text-encre" : "text-encre-3",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => onChoisir(rang)}
            className="flex flex-1 items-center gap-[8px] text-left hover:text-encre-2"
          >
            <span className="w-[14px] shrink-0">{rang + 1}</span>
            <span>
              {boite[2] - boite[0] + 1}×{boite[3] - boite[1] + 1}
            </span>
            <span className="text-encre-3">
              @ {boite[0]},{boite[1]}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onRetirer(rang)}
            aria-label={`Retirer le rectangle ${rang + 1}`}
            className="shrink-0 px-[4px] hover:text-echec"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Outils ──────────────────────────────────────────────────────────────────

const borner = (valeur: number, taille: number) => Math.max(0, Math.min(taille - 1, valeur))

const entre = (a: [number, number], b: [number, number]): Boite => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
]

const memesBoites = (a: Boite[], b: Boite[]) =>
  a.length === b.length && a.every((boite, i) => boite.every((v, j) => v === b[i][j]))
