// La superposition — deux images, et une troisième qui en sort.
//
// **Ce n'est pas une table, et c'est la seule chose à comprendre.** Une table
// règle une image et rend la même ; celle-ci en prend deux et en fabrique une
// troisième. C'est ce qui la range à droite du trait de la barre, avec le
// découpage, et ce qui l'a sortie de la recette : une place de recette ne nomme
// jamais un second asset.
//
// **C'est aussi le seul endroit du produit où le comparateur à quatre modes ne
// s'applique pas.** Il montre une image dans quatre dispositions ; ici il y a
// trois choses différentes à regarder en même temps — le travail, le calque
// seul, le résultat —, et ce ne sont pas des dispositions l'une de l'autre.
//
// **Rien ici ne coûte un centime.** Les deux images sont déjà payées ; changer
// le calage, le seuil ou le rectangle coûte des millisecondes.
//
// **Passé au papier en `C8`.** Montée depuis `Retouche.tsx`, qui est déjà du
// carnet ; c'est ce fichier-ci qui ne l'était pas encore. Le vocabulaire de
// réglage (`Champ`, `Choix`, `Glissiere`, `Pourquoi`) n'est pas partagé avec
// `Decoupe.tsx` : chaque fabrique tient le sien, comme `Retouche.tsx` tient
// déjà le sien pour ses tables.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  api,
  POSE_VIDE,
  type ApercuSuperposition,
  type Asset,
  type Cadrage,
  type MesuresCalque,
  type OuvertureSuperposition,
  type Superposition,
  type Trait,
} from "../api"
import { PANNEAU } from "./Infobulle"
import { SurfaceZoomable } from "./SurfaceZoomable"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { BibliothequePourImage } from "./BibliothequePourImage"

// ── Le petit vocabulaire de cet écran ───────────────────────────────────────

function EnTete({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
      {children}
    </div>
  )
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-[8px]">
      <span className="w-[128px] shrink-0 text-[11px] text-encre-2">{libelle}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** « Le grisé porte sa raison. » Une ligne sœur, mono 10,5 px, tiret de 8 px,
 *  avec un lien souligné quand il y a un endroit où aller — jamais en rouille,
 *  réservé au bouton qui fabrique et au chiffre qui coûte. */
function Pourquoi({
  texte,
  geste,
  onGeste,
}: {
  texte: string
  geste?: string
  onGeste?: () => void
}) {
  return (
    <p className="mesure flex flex-wrap items-baseline gap-[6px] text-[10.5px] leading-4 text-encre-4">
      <span aria-hidden className="mt-[8px] inline-block h-px w-[8px] shrink-0 bg-contour" />
      <span className="min-w-0">{texte}</span>
      {geste && onGeste && (
        <button
          type="button"
          onClick={onGeste}
          className="text-encre-2 underline decoration-pointille underline-offset-2 transition-colors duration-120 hover:text-encre"
        >
          {geste} ›
        </button>
      )}
    </p>
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
        className="curseur h-[22px] min-w-0 flex-1"
      />
      <span className="mesure w-[54px] shrink-0 text-right text-[10.5px] text-encre-2">
        {valeur}
        {unite}
      </span>
    </div>
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

/** Les six fonds du calque seul. **Ils servent à repérer les pixels oubliés** —
 *  ceux qui auraient dû partir avec le corps et sont restés accrochés. Sur le
 *  damier ils se confondent ; sur un aplat vif ils sautent aux yeux, et la
 *  bonne couleur dépend de celles du sprite. */
const FONDS = ["damier", "blanc", "noir", "rose", "bleu", "vert"] as const
type Fond = (typeof FONDS)[number]

const COULEUR_DE_FOND: Record<Fond, string | undefined> = {
  damier: undefined,
  blanc: "var(--color-diag-blanc)",
  noir: "var(--color-diag-noir)",
  rose: "var(--color-diag-rose)",
  bleu: "var(--color-diag-bleu)",
  vert: "var(--color-diag-vert)",
}

/** Les trois modes de couleur du dessous. `teinte` repeint tous ses pixels
 *  opaques d'une seule couleur vive — c'est celui qui sert au calage, parce
 *  qu'aucune de ces couleurs n'existe dans un sprite. */
const TEINTES = ["normale", "teinte", "negatif"] as const
type Teinte = (typeof TEINTES)[number]

const LIBELLE_TEINTE: Record<string, string> = {
  normale: "normale",
  teinte: "teinte",
  negatif: "négatif",
}

const FILTRE: Record<Teinte, string | undefined> = {
  normale: undefined,
  teinte: "saturate(0) sepia(1) hue-rotate(240deg) saturate(6)",
  negatif: "invert(1)",
}

/** Un cran, sa touche, et le pas — écrits sous le rail qu'ils commandent.
 *
 *  **La touche est aussi le bouton**, et c'est ce qui fait qu'une seule chose à
 *  l'écran fait deux métiers : elle enseigne et elle agit. */
function Cran({
  libelle,
  valeur,
  unite,
  min,
  max,
  pas,
  touches,
  onChange,
  onFini,
  note,
}: {
  libelle: string
  valeur: number
  unite: string
  min: number
  max: number
  pas: number
  touches: [string, string]
  onChange: (v: number) => void
  onFini: (v: number) => void
  note?: string
}) {
  const borner = (v: number) => Math.max(min, Math.min(max, v))
  const bouger = (sens: number, dix: boolean) =>
    onFini(borner(Number((valeur + sens * pas * (dix ? 10 : 1)).toFixed(3))))
  return (
    <div className="flex flex-col gap-[4px]">
      <Champ libelle={libelle}>
        <div className="flex items-center gap-[8px]">
          <input
            type="range"
            min={min}
            max={max}
            step={pas}
            value={valeur}
            aria-label={libelle}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={(e) => onFini(Number(e.currentTarget.value))}
            onKeyUp={(e) => onFini(Number(e.currentTarget.value))}
            className="curseur h-[26px] min-w-0 flex-1"
          />
          <input
            type="number"
            value={valeur}
            step={pas}
            aria-label={`${libelle}, en chiffres`}
            onChange={(e) => onFini(borner(Number(e.target.value)))}
            className="mesure h-[26px] w-[70px] shrink-0 rounded-5 border border-trait bg-carte px-[4px] text-right text-[10.5px] text-encre"
          />
        </div>
      </Champ>
      <div className="mesure flex items-center gap-[4px] pl-[128px] text-[10.5px] text-encre-4">
        <button
          type="button"
          aria-label={`${libelle} — ${touches[0]}`}
          onClick={(e) => bouger(-1, e.shiftKey)}
          className="h-[22px] w-[22px] rounded-5 border border-trait bg-carte hover:border-encre-4 hover:text-encre"
        >
          {touches[0]}
        </button>
        <button
          type="button"
          aria-label={`${libelle} — ${touches[1]}`}
          onClick={(e) => bouger(1, e.shiftKey)}
          className="h-[22px] w-[22px] rounded-5 border border-trait bg-carte hover:border-encre-4 hover:text-encre"
        >
          {touches[1]}
        </button>
        <span>
          {pas}
          {unite} · Maj ×10
        </span>
        {note && <span className="ml-auto text-signal">{note}</span>}
      </div>
    </div>
  )
}

/** Les cinq mesures, une ligne chacune. **Aucune ne refuse quoi que ce soit** :
 *  elles disent si la superposition a réussi, et le seul refus automatique du
 *  produit reste le compte d'images. */
function Mesures({ mesures }: { mesures: MesuresCalque }) {
  const lignes: [string, string][] = [
    ["silhouette", mesures.silhouette.toFixed(2)],
    ["corps repeint", `${Math.round(mesures.repeint * 100)} %`],
    ["ajout", `${Math.round(mesures.ajout * 100)} %`],
    ["échelle", mesures.echelle.toFixed(2)],
    ["compacité", mesures.compacite.toFixed(2)],
  ]
  return (
    <ul className="flex flex-col">
      {lignes.map(([nom, valeur]) => (
        <li
          key={nom}
          className="mesure flex h-[22px] items-center gap-[8px] text-[10.5px] text-encre-4"
        >
          <span>{nom}</span>
          <span className="ml-auto text-encre-2">{valeur}</span>
        </li>
      ))}
    </ul>
  )
}

export function EcranSuperposition({
  asset,
  soeurs,
  onErreur,
  onFabrique,
}: {
  /** L'image ouverte — **le dessus par défaut**, parce que c'est elle qu'on
   *  regardait. Le dessous se prérremplit de ce que sa superposition désignait,
   *  et les deux se changent. */
  asset: Asset
  /** Les images voisines : c'est parmi elles qu'on choisit l'autre. */
  soeurs: Asset[]
  onErreur: (raison: string) => void
  onFabrique?: (nees: Asset[]) => void
}) {
  const [ouverture, setOuverture] = useState<OuvertureSuperposition | null>(null)
  const [pose, setPose] = useState<Superposition>({ ...POSE_VIDE, dessus: asset.identifiant })
  const [apercu, setApercu] = useState<ApercuSuperposition | null>(null)
  const [teinte, setTeinte] = useState<Teinte>("teinte")
  const [opaciteDessous, setOpaciteDessous] = useState(50)
  const [opaciteDessus, setOpaciteDessus] = useState(92)
  const [fond, setFond] = useState<Fond>("damier")
  const [sorties, setSorties] = useState<string[]>(["calque"])
  const [garder, setGarder] = useState(false)
  const [masque, setMasque] = useState(false)
  const [choisir, setChoisir] = useState<"dessus" | "dessous" | null>(null)
  const [recalage, setRecalage] = useState(false)
  const [fabrication, setFabrication] = useState(false)
  const [outil, setOutil] = useState<"deplacer" | "rectangle" | "garder" | "retirer">("deplacer")
  const [diametre, setDiametre] = useState(5)
  const [vue, setVue] = useState<"travail" | "calque" | "resultat">("travail")
  const envol = useRef(0)
  const [originePose, setOriginePose] = useState<{ id: string; pose: Superposition } | null>(null)
  const brouillon = useBrouillonLocal({
    cle: `extraction:${asset.identifiant}`, pret: originePose?.id === asset.identifiant,
    reference: { pose: originePose?.pose ?? pose, sorties: ["calque"], garder: false }, etat: { pose, sorties, garder },
    ecran: "L’extraction", quoi: asset.label || asset.identifiant,
    appliquer: async (recu) => {
      const sources = await api.ouvrirSuperposition(recu.pose.dessus, recu.pose.dessous || undefined)
      if (!sources.pose) throw new Error("Sources indisponibles")
      setOuverture(sources); setPose(recu.pose); setSorties(recu.sorties); setGarder(recu.garder); setApercu(null)
    },
  })

  // ── L'ouverture ───────────────────────────────────────────────────────────
  useEffect(() => {
    let vivant = true
    api
      .ouvrirSuperposition(asset.identifiant)
      .then((recu) => {
        // **Un serveur plus vieux que l'écran répond sans se plaindre.** On
        // regarde donc la forme avant de s'y fier.
        if (!vivant || !recu?.pose) return
        setOuverture(recu)
        setOriginePose({ id: asset.identifiant, pose: recu.pose })
        setPose(recu.pose)
      })
      .catch((erreur) => vivant && onErreur(String(erreur)))
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])

  // ── Les trois vues sont vivantes ──────────────────────────────────────────
  //
  // **Déplacer le dessus d'un pixel les met toutes à jour.** L'aperçu se
  // redemande au **relâchement**, jamais à chaque cran : le serveur sérialise.
  const rafraichir = useCallback(
    (suivante: Superposition) => {
      if (!suivante.dessus || !suivante.dessous) return
      const rang = ++envol.current
      api
        .apercuSuperposition(suivante)
        .then((recu) => {
          if (rang === envol.current) setApercu(recu)
        })
        .catch((erreur) => onErreur(String(erreur)))
    },
    [onErreur],
  )

  useEffect(() => {
    rafraichir(pose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pose.dessus,
    pose.dessous,
    pose.echelle,
    pose.dx,
    pose.dy,
    pose.seuil,
    pose.rectangle,
    pose.main,
    // **Changer d'image du dessus change tout ce qui en découle** (G16).
    pose.dessus_arrivee,
  ])

  const poser = (suivante: Partial<Superposition>) =>
    setPose((deja) => ({ ...deja, ...suivante }))

  const dessous = ouverture?.dessous ?? null
  const dessus = ouverture?.dessus ?? asset
  const pret = Boolean(pose.dessus && pose.dessous)
  const changerImages = async (haut: string, bas: string) => {
    try {
      const recu = await api.ouvrirSuperposition(haut, bas)
      setOuverture(recu)
      setPose(recu.pose)
      setApercu(null)
      setChoisir(null)
    } catch (erreur) { onErreur(String(erreur)) }
  }

  const recaler = async () => {
    if (!pret) return
    setRecalage(true)
    try {
      const trouve = await api.recalerSuperposition(pose.dessus, pose.dessous, pose.dessus_arrivee)
      poser({ echelle: trouve.echelle, dx: trouve.dx, dy: trouve.dy })
    } catch (erreur) {
      onErreur(String(erreur))
    } finally {
      setRecalage(false)
    }
  }

  const fabriquer = async () => {
    if (fabrication) return
    setFabrication(true)
    try {
      const { superpositions } = await api.fabriquerSuperposition(pose, sorties, garder)
      brouillon.effacer()
      onFabrique?.(superpositions)
    } catch (erreur) {
      onErreur(String(erreur))
    } finally { setFabrication(false) }
  }

  // **L'échelle est le seul réglage de l'outil qui abîme l'image** :
  // rééchantillonner du pixel art à un facteur qui n'est pas simple détruit la
  // grille. L'écran le marque, il ne le refuse pas.
  const simple = [0.25, 0.5, 1, 2, 3, 4].some((v) => Math.abs(pose.echelle - v) < 1e-6)

  return (
    <div
      data-superposition
      className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_380px] grid-rows-[minmax(0,1fr)_auto] bg-papier"
    >
      {/* ── La colonne de gauche ─────────────────────────────────────────── */}
      <aside {...PANNEAU} className="col-start-2 row-span-2 row-start-1 flex min-h-0 flex-col border-l border-trait bg-papier-cote">
        <EnTete>superposition</EnTete>
        <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[8px]">
          <AvisBrouillon brouillon={brouillon} />
          {/* Les deux images. Le dessus se déplace, le dessous ne bouge pas. */}
          <div className="flex flex-col gap-[4px]">
            <p className="text-[11px] text-encre-2">les deux images</p>
            <ImageChoisie
              asset={dessus}
              role={pose.dessus_arrivee ? "DESSUS · TEL QU'IL EST ARRIVÉ" : "DESSUS · SE DÉPLACE"}
              actif
              arrivee={pose.dessus_arrivee}
              onChanger={() => setChoisir("dessus")}
            />
            {/* **De quelle image du dessus on part** (G16, US-503). */}
            {ouverture?.arrivee_possible && (
              <div className="flex flex-col gap-[4px] pt-[4px]">
                <Choix<string>
                  valeurs={["telle qu'arrivée", "telle que rangée"] as const}
                  valeur={pose.dessus_arrivee ? "telle qu'arrivée" : "telle que rangée"}
                  onChange={(quoi) => poser({ dessus_arrivee: quoi === "telle qu'arrivée" })}
                />
                <span className="mesure text-[10.5px] leading-4 text-encre-4">
                  {pose.dessus_arrivee
                    ? "la case telle que le modèle l'a rendue — c'est d'elle qu'on repart pour refaire le calage"
                    : "le vêtement déjà découpé et calé : refaire le calage sur lui repartirait du résultat"}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={!pret}
              onClick={() => void changerImages(pose.dessous, pose.dessus)}
              className="mesure h-[22px] self-start text-[10.5px] text-encre-2 underline decoration-pointille underline-offset-2 hover:text-encre"
            >
              ↕ échanger
            </button>
            {dessous ? (
              <ImageChoisie asset={dessous} role="DESSOUS · FIXE" onChanger={() => setChoisir("dessous")} />
            ) : (
              // **Sans dessous, il faut un moyen d'en choisir un.**
              <button
                type="button"
                onClick={() => setChoisir("dessous")}
                className="mesure h-[26px] rounded-5 border border-encre-4 px-[8px] text-left text-[10.5px] text-encre-2 hover:text-encre"
              >
                choisir l'image du dessous — celle sur laquelle on pose ›
              </button>
            )}
          </div>

          {/* « Avant de caler » — l'état du détourage des deux images. */}
          {ouverture && (
            <div className="flex flex-col gap-[4px] border-t border-trait pt-[8px]">
              <p className="text-[11px] text-encre-2">avant de caler</p>
              <span className="mesure text-[10.5px] text-encre-4">
                le dessous · {ouverture.passes_dessous} passe
                {ouverture.passes_dessous > 1 ? "s" : ""} — le dessus ·{" "}
                {ouverture.passes_dessus} passe{ouverture.passes_dessus > 1 ? "s" : ""}
              </span>
              {ouverture.sans_alpha && (
                <Pourquoi
                  texte="sans alpha sur le dessus, le calque prendrait tout le fond"
                  geste={
                    !dessous || ouverture.passes_dessous === 0
                      ? undefined
                      : `reprendre les ${ouverture.passes_dessous} passes du dessous`
                  }
                  onGeste={() =>
                    void api
                      .heriterDetourage(pose.dessus, pose.dessous)
                      .then(() => api.ouvrirSuperposition(pose.dessus, pose.dessous))
                      .then((recu) => {
                        setOuverture(recu)
                        rafraichir(pose)
                      })
                      .catch((erreur) => onErreur(String(erreur)))
                  }
                />
              )}
            </div>
          )}

          {/* Les deux blocs « voir » ne changent que l'affichage. */}
          <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
            <p className="text-[11px] text-encre-2">voir le dessous — ne change pas la sortie</p>
            <Choix valeurs={TEINTES} valeur={teinte} libelles={LIBELLE_TEINTE} onChange={setTeinte} />
            <Champ libelle="opacité">
              <Glissiere valeur={opaciteDessous} min={0} max={100} unite=" %" onChange={setOpaciteDessous} />
            </Champ>
            <Champ libelle="le dessus">
              <Glissiere valeur={opaciteDessus} min={0} max={100} unite=" %" onChange={setOpaciteDessus} />
            </Champ>
          </div>

          {/* Le calage. **Recaler est un bouton, pas un mode.** */}
          <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
            <p className="text-[11px] text-encre-2">le calage du dessus</p>
            {apercu?.cadrage.ramene && (
              <Pourquoi
                texte={
                  `le dessus a été ramené au cadre — ${apercu.cadrage.source_largeur}×` +
                  `${apercu.cadrage.source_hauteur} réduit à ` +
                  `${Math.round(apercu.cadrage.facteur * 100)} % pour y entrer entier, ` +
                  `et l'échelle ci-dessous part de là`
                }
              />
            )}
            <button
              type="button"
              disabled={!pret || recalage}
              onClick={() => void recaler()}
              className="h-[34px] w-full rounded-7 border border-encre-4 bg-carte text-[11.5px] text-encre-2 transition-colors duration-120 hover:text-encre disabled:text-eteint"
            >
              {recalage ? "cherche…" : "Recaler"}
            </button>
            <Cran
              libelle="échelle"
              valeur={pose.echelle}
              unite=""
              min={0.25}
              max={4}
              pas={0.01}
              touches={["−", "+"]}
              onChange={(echelle) => setPose((d) => ({ ...d, echelle }))}
              onFini={(echelle) => poser({ echelle })}
              note={simple ? undefined : "rééchantillonne"}
            />
            <Cran
              libelle="horizontal"
              valeur={pose.dx}
              unite=" px"
              min={-2048}
              max={2048}
              pas={1}
              touches={["←", "→"]}
              onChange={(dx) => setPose((d) => ({ ...d, dx }))}
              onFini={(dx) => poser({ dx })}
            />
            <Cran
              libelle="vertical"
              valeur={pose.dy}
              unite=" px"
              min={-2048}
              max={2048}
              pas={1}
              touches={["↑", "↓"]}
              onChange={(dy) => setPose((d) => ({ ...d, dy }))}
              onFini={(dy) => poser({ dy })}
            />
            <button
              type="button"
              onClick={() => poser({ echelle: 1, dx: 0, dy: 0 })}
              className="mesure h-[22px] self-start text-[10.5px] text-encre-3 hover:text-encre-2"
            >
              remettre à zéro ›
            </button>
          </div>

          {/* Ce qu'on garde du dessus. Le rectangle sert deux fois. */}
          <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
            <p className="text-[11px] text-encre-2">ce qu'on garde du dessus</p>
            <Champ libelle="seuil">
              <Glissiere
                valeur={pose.seuil}
                min={0}
                max={255}
                onChange={(seuil) => poser({ seuil })}
              />
            </Champ>
            <Pourquoi texte="de combien une couleur doit changer pour compter comme changée" />
            {pose.rectangle && (
              <button
                type="button"
                onClick={() => poser({ rectangle: null })}
                className="mesure h-[22px] self-start text-[10.5px] text-encre-3 hover:text-echec"
              >
                × le rectangle — {pose.rectangle[2] - pose.rectangle[0] + 1}×
                {pose.rectangle[3] - pose.rectangle[1] + 1}
              </button>
            )}
            {!pose.rectangle && (
              <Pourquoi texte="aucun rectangle — choisis Rectangle au-dessus de l'image pour borner ce qui part" />
            )}
            <p className="text-[11px] text-encre-3">Garder récupère les pixels du dessus que la différence a manqués. Retirer efface les pixels indésirables du calque.</p>
            <label className="flex items-center gap-[8px] text-[12px]">Taille du pinceau <input aria-label="Taille du pinceau d’extraction" type="range" min={1} max={63} step={2} value={diametre} onChange={(e) => setDiametre(Number(e.target.value))} className="min-w-0 flex-1" /><input aria-label="Taille du pinceau d’extraction, en pixels" type="number" min={1} max={63} step={2} value={diametre} onChange={(e) => setDiametre(Math.max(1, Math.min(63, Math.round(Number(e.target.value) / 2) * 2 - 1)))} className="w-[54px] rounded-5 border border-trait bg-carte p-[4px]" /></label>
            <button type="button" disabled={!pose.main.length} onClick={() => poser({ main: pose.main.slice(0, -1) })} className="self-start text-[12px] disabled:text-eteint">Défaire le dernier trait ({pose.main.length})</button>
          </div>

          {/* Ce qu'on en sort. Les deux se cochent au lieu de s'exclure. */}
          <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
            <p className="text-[11px] text-encre-2">ce qu'on en sort</p>
            {(
              [
                ["calque", "ce que le dessus ajoute · va au vestiaire"],
                ["aplat", "les deux fondues · un asset ordinaire"],
              ] as const
            ).map(([nom, quoi]) => (
              <label key={nom} className="flex items-start gap-[8px] text-[11px] text-encre-2">
                <input
                  type="checkbox"
                  checked={sorties.includes(nom)}
                  onChange={(e) =>
                    setSorties((deja) =>
                      e.target.checked ? [...deja, nom] : deja.filter((s) => s !== nom),
                    )
                  }
                  className="mt-[4px]"
                />
                <span>
                  {nom}
                  <span className="mesure block text-[10.5px] text-encre-4">{quoi}</span>
                </span>
              </label>
            ))}
            <label className="flex items-center gap-[8px] text-[11px] text-encre-2">
              <input type="checkbox" checked={garder} onChange={(e) => setGarder(e.target.checked)} />
              enregistrer ces réglages
            </label>
            {ouverture?.repris && (
              <div className="flex flex-col gap-[4px]">
                <Pourquoi texte={`repris de « ${ouverture.repris.depuis} »`} />
                <button
                  type="button"
                  onClick={() =>
                    void api
                      .oublierReglagesSuperposition(pose.dessous)
                      .then(() => {
                        setOuverture((deja) => (deja ? { ...deja, repris: null } : deja))
                        poser({ echelle: 1, dx: 0, dy: 0, rectangle: null, seuil: 32 })
                      })
                      .catch((erreur) => onErreur(String(erreur)))
                  }
                  className="mesure h-[22px] self-start text-[10.5px] text-encre-3 hover:text-encre-2"
                >
                  repartir de zéro ›
                </button>
              </div>
            )}
          </div>

          {apercu && (
            <div className="border-t border-trait pt-[8px]">
              <p className="mb-[4px] text-[11px] text-encre-2">ce que la comparaison a mesuré</p>
              <Mesures mesures={apercu.mesures} />
            </div>
          )}
        </div>

        {/* Le pied porte l'état et le geste. **Rien n'est détruit : rien n'est
            encore fabriqué.** */}
        <div className="flex shrink-0 flex-col border-t border-trait">
          <button
            type="button"
            disabled={!pret || sorties.length === 0 || fabrication}
            onClick={() => void fabriquer()}
            className="h-[34px] bg-signal px-[14px] text-left text-[11.5px] text-encre-sur-signal transition-colors duration-120 hover:opacity-90 disabled:bg-carte disabled:text-eteint"
          >
            Fabriquer — {sorties.length} image{sorties.length > 1 ? "s" : ""} ›
          </button>
          <button
            type="button"
            onClick={() => poser({ echelle: 1, dx: 0, dy: 0, rectangle: null, main: [] })}
            className="mesure h-[26px] border-t border-trait px-[8px] text-left text-[10.5px] text-encre-3 hover:text-echec"
          >
            Tout défaire ›
          </button>
        </div>
      </aside>

      {/* ── Le travail ───────────────────────────────────────────────────── */}
      <div className="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col">
        {choisir ? <BibliothequePourImage retour="Superposition" voisines={soeurs} onFermer={() => setChoisir(null)} onChoisir={(image) => void changerImages(choisir === "dessus" ? image.identifiant : pose.dessus, choisir === "dessous" ? image.identifiant : pose.dessous)} /> : <>
        <div className="flex flex-wrap gap-[8px] border-b border-trait p-[8px]">
          <Choix valeurs={["travail", "calque", "resultat"] as const} valeur={vue} libelles={{ travail: "Caler et retoucher", calque: "Calque seul", resultat: "Résultat" }} onChange={setVue} />
          {vue === "travail" && <Choix valeurs={["deplacer", "rectangle", "garder", "retirer"] as const} valeur={outil} libelles={{ deplacer: "Déplacer le dessus", rectangle: "Rectangle", garder: "Garder", retirer: "Retirer" }} onChange={setOutil} />}
        </div>
        <SurfaceZoomable largeur={dessous?.rendu_largeur || dessous?.largeur || 1} hauteur={dessous?.rendu_hauteur || dessous?.hauteur || 1} libelle="l’extraction">
        {vue === "travail" ?
          <CadreDuTravail
            dessous={dessous}
            dessus={dessus}
            pose={pose}
            cadrage={apercu?.cadrage ?? null}
            teinte={teinte}
            opaciteDessous={opaciteDessous}
            opaciteDessus={opaciteDessus}
            onRectangle={(rectangle) => poser({ rectangle })}
            outil={outil} rayon={(diametre - 1) / 2}
            onDeplacer={(dx, dy) => poser({ dx, dy })}
            onTrait={(trait) => setPose((ancienne) => ({ ...ancienne, main: [...ancienne.main, trait] }))}
            calque={apercu?.calque}
          />
        : apercu && <img src={vue === "calque" ? apercu.calque : apercu.aplat} alt={vue === "calque" ? "Calque agrandi" : "Résultat agrandi"} className="damier-papier h-full w-full object-contain" style={{ imageRendering: "pixelated", background: COULEUR_DE_FOND[fond] }} />}
        </SurfaceZoomable></>}
        <div className="mesure flex h-[34px] shrink-0 items-center gap-[14px] border-t border-trait bg-papier-cote px-[14px] text-[10.5px] text-encre-4">
          <span className="whitespace-nowrap">
            × {pose.echelle.toFixed(3)} · {pose.dx >= 0 ? "+" : ""}
            {pose.dx} · {pose.dy >= 0 ? "+" : ""}
            {pose.dy}
          </span>
          {apercu && (
            <span className="whitespace-nowrap">ajout {Math.round(apercu.mesures.ajout * 100)} %</span>
          )}
          <span className="ml-auto whitespace-nowrap text-encre-4">aucun appel ne part d'ici</span>
        </div>
      </div>

      {/* ── Les deux rendus ──────────────────────────────────────────────── */}
      <aside {...PANNEAU} className="col-start-1 row-start-2 flex max-h-[300px] min-h-0 flex-col border-t border-trait bg-papier-cote">
        <EnTete>ce qui en sortira</EnTete>
        <div className="defile grid min-h-0 flex-1 grid-cols-2 gap-[8px] overflow-y-auto p-[8px]">
          <div className="flex min-w-0 flex-col gap-[4px]">
          <p className="text-[11px] text-encre-2">le calque seul</p>
          <div
            className={COULEUR_DE_FOND[fond] ? "" : "damier-papier"}
            style={{ background: COULEUR_DE_FOND[fond] }}
          >
            {apercu ? (
              <img
                src={apercu.calque}
                alt="le calque seul"
                className="h-[128px] w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="h-[128px]" />
            )}
          </div>
          <Choix valeurs={FONDS} valeur={fond} onChange={setFond} />
          <Pourquoi texte="un aplat vif fait sauter aux yeux les pixels oubliés — sur le damier ils se confondent" />
          </div><div className="flex min-w-0 flex-col gap-[4px]">
          <div className="border-t border-trait pt-[8px]">
            <p className="text-[11px] text-encre-2">le résultat</p>
          </div>
          <div className="damier-papier">
            {apercu && (
              <img
                src={masque && dessous ? api.rendu(dessous.identifiant, dessous.empreinte) : apercu.aplat}
                alt="le résultat"
                className="h-[128px] w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            )}
          </div>
          <button
            type="button"
            onPointerDown={() => setMasque(true)}
            onPointerUp={() => setMasque(false)}
            onPointerLeave={() => setMasque(false)}
            className="mesure h-[22px] self-start rounded-5 border border-encre-4 px-[8px] text-[10.5px] text-encre-2 hover:text-encre"
          >
            masquer le calque
          </button>
          <Pourquoi texte="l'avant/après — c'est ce qui dit si la pièce tient sur le corps" />
          </div>
        </div>
      </aside>
    </div>
  )
}

/** Une des deux images, avec son rôle. */
function ImageChoisie({
  asset,
  role,
  actif,
  arrivee = false,
  onChanger,
}: {
  asset: Asset
  role: string
  actif?: boolean
  /** **Montrer ce qui part, et non ce qui est rangé** (G16). */
  arrivee?: boolean
  onChanger: () => void
}) {
  return (
    <div
      className={[
        "flex items-center gap-[8px] rounded-5 border p-[4px]",
        actif ? "border-signal" : "border-trait",
      ].join(" ")}
    >
      <img
        src={arrivee ? api.arrivee(asset.identifiant) : api.rendu(asset.identifiant, asset.empreinte)}
        alt={asset.label}
        className="damier-papier h-[54px] w-[54px] shrink-0 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] text-encre">{asset.label}</span>
        <span className="mesure block text-[10.5px] text-encre-4">{role}</span>
      </span>
      <button
        type="button"
        onClick={onChanger}
        className="mesure shrink-0 text-[10.5px] text-encre-2 underline decoration-pointille underline-offset-2 hover:text-encre"
      >
        changer ›
      </button>
    </div>
  )
}

/**
 * Les deux images telles qu'on les a réglées, et le rectangle qu'on y glisse.
 *
 * **Ce qui est hors du rectangle gardé est assombri plutôt que caché** : on voit
 * encore où on en est dans l'image.
 */
function CadreDuTravail({
  dessous,
  dessus,
  pose,
  cadrage,
  teinte,
  opaciteDessous,
  opaciteDessus,
  onRectangle,
  outil, rayon, onDeplacer, onTrait, calque,
}: {
  dessous: Asset | null
  dessus: Asset
  pose: Superposition
  /** Où le serveur pose le dessus dans le cadre (M1). `null` tant que le
   *  premier aperçu n'est pas revenu. */
  cadrage: Cadrage | null
  teinte: Teinte
  opaciteDessous: number
  opaciteDessus: number
  onRectangle: (r: number[] | null) => void
  outil: "deplacer" | "rectangle" | "garder" | "retirer"
  rayon: number
  onDeplacer: (dx: number, dy: number) => void
  onTrait: (trait: Trait) => void
  calque?: string
}) {
  const [trace, setTrace] = useState<[number, number, number, number] | null>(null)
  const [curseur, setCurseur] = useState<[number, number] | null>(null)
  const [points, setPoints] = useState<[number, number][] | null>(null)
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  if (!dessous) {
    return (
      <p className="mesure text-[10.5px] text-encre-4">
        choisis une seconde image — une superposition en demande deux
      </p>
    )
  }
  const largeur = dessous.rendu_largeur || dessous.largeur
  const hauteur = dessous.rendu_hauteur || dessous.hauteur

  const point = (e: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const cadre = e.currentTarget.getBoundingClientRect()
    return [
      Math.max(0, Math.min(largeur - 1, Math.floor(((e.clientX - cadre.left) / cadre.width) * largeur))),
      Math.max(0, Math.min(hauteur - 1, Math.floor(((e.clientY - cadre.top) / cadre.height) * hauteur))),
    ]
  }
  const dessine = trace ?? (pose.rectangle as [number, number, number, number] | null)

  return (
    <div
      data-cadre-superposition
      style={{ aspectRatio: `${largeur} / ${hauteur}`, cursor: outil === "deplacer" ? "move" : "crosshair", touchAction: "none" }}
      className="relative h-full w-full"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const [x, y] = point(e)
        if (outil === "rectangle") setTrace([x, y, x, y])
        else if (outil === "deplacer") drag.current = { x: e.clientX, y: e.clientY, dx: pose.dx, dy: pose.dy }
        else setPoints([[x, y]])
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const [x, y] = point(e)
        setCurseur([x, y])
        if (drag.current) {
          const boite = e.currentTarget.getBoundingClientRect()
          onDeplacer(Math.max(-2048, Math.min(2048, drag.current.dx + Math.round((e.clientX - drag.current.x) * largeur / boite.width))), Math.max(-2048, Math.min(2048, drag.current.dy + Math.round((e.clientY - drag.current.y) * hauteur / boite.height))))
        }
        if (points && (points.at(-1)?.[0] !== x || points.at(-1)?.[1] !== y)) setPoints([...points, [x, y]])
        if (trace) setTrace([trace[0], trace[1], x, y])
      }}
      onPointerUp={() => {
        drag.current = null
        if (points) { onTrait({ garde: outil === "garder", rayon, points, couleur: "" }); setPoints(null) }
        if (!trace) return
        const [x0, y0, x1, y1] = trace
        setTrace(null)
        const boite: [number, number, number, number] = [
          Math.min(x0, x1),
          Math.min(y0, y1),
          Math.max(x0, x1),
          Math.max(y0, y1),
        ]
        // Un clic n'est pas un rectangle : sous trois pixels de côté, il le
        // retire au lieu d'en poser un d'un pixel que personne ne voulait.
        onRectangle(boite[2] - boite[0] < 3 || boite[3] - boite[1] < 3 ? null : boite)
      }}
      onPointerLeave={() => setCurseur(null)}
      onPointerCancel={() => { drag.current = null; setPoints(null); setTrace(null) }}
    >
      <img
        src={api.rendu(dessous.identifiant, dessous.empreinte)}
        alt={dessous.label}
        draggable={false}
        className="damier-papier h-full w-full object-contain select-none"
        style={{
          imageRendering: "pixelated",
          opacity: opaciteDessous / 100,
          filter: FILTRE[teinte],
        }}
      />
      {/* **Le dessus tel qu'il part au calcul, pas tel qu'il est rangé** (G16). */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: (outil === "garder" || outil === "retirer") && calque ? 0 : opaciteDessus / 100,
          transform: `translate(${(pose.dx / largeur) * 100}%, ${(pose.dy / hauteur) * 100}%) scale(${pose.echelle})`,
        }}
      >
        <img
          src={pose.dessus_arrivee ? api.arrivee(dessus.identifiant) : api.rendu(dessus.identifiant, dessus.empreinte)}
          alt={dessus.label}
          draggable={false}
          data-dessus-cadre
          className={
            cadrage ? "absolute select-none" : "absolute inset-0 h-full w-full object-contain select-none"
          }
          style={
            cadrage
              ? {
                  left: `${(cadrage.gauche / largeur) * 100}%`,
                  top: `${(cadrage.sommet / hauteur) * 100}%`,
                  width: `${(cadrage.largeur / largeur) * 100}%`,
                  height: `${(cadrage.hauteur / hauteur) * 100}%`,
                  // **Lissé quand l'image a été réduite, net sinon.**
                  imageRendering: cadrage.ramene ? "auto" : "pixelated",
                }
              : { imageRendering: "pixelated" }
          }
        />
      </div>
      {(outil === "garder" || outil === "retirer") && calque && <img src={calque} alt="Masque en cours" className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ imageRendering: "pixelated" }} />}
      {dessine && (
        <span
          aria-hidden
          style={{
            left: `${(Math.min(dessine[0], dessine[2]) / largeur) * 100}%`,
            top: `${(Math.min(dessine[1], dessine[3]) / hauteur) * 100}%`,
            width: `${((Math.abs(dessine[2] - dessine[0]) + 1) / largeur) * 100}%`,
            height: `${((Math.abs(dessine[3] - dessine[1]) + 1) / hauteur) * 100}%`,
          }}
          className="pointer-events-none absolute border-2 border-signal"
        />
      )}
      {points && <svg aria-hidden viewBox={`0 0 ${largeur} ${hauteur}`} className="pointer-events-none absolute inset-0 h-full w-full"><polyline points={points.map(([x, y]) => `${x + .5},${y + .5}`).join(" ")} fill="none" stroke="var(--color-signal)" strokeOpacity={0.5} strokeWidth={rayon * 2 + 1} strokeLinecap="square" /></svg>}
      {curseur && (outil === "garder" || outil === "retirer") && <span data-pinceau-extraction aria-hidden className="pointer-events-none absolute border border-signal" style={{ left: `${(curseur[0] - rayon) / largeur * 100}%`, top: `${(curseur[1] - rayon) / hauteur * 100}%`, width: `${(rayon * 2 + 1) / largeur * 100}%`, height: `${(rayon * 2 + 1) / hauteur * 100}%` }} />}
    </div>
  )
}
