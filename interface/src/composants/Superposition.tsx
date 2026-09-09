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
// le calage, le seuil ou le rectangle coûte des millisecondes. Avant, un
// recalage raté n'avait aucun recours : le calque était perdu et il fallait
// relancer une génération.

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
} from "../api"
import {
  Curseur,
  EnTetePanneau,
  Libelle,
  NomDuReglage,
  Raison,
  Segments,
} from "./chassis"
import { PANNEAU } from "./Infobulle"

/** Un réglage : son libellé à gauche, sa commande à droite.
 *
 *  **Repris de `Places.tsx` tel quel** (`B26`) : cet écran-ci est le dernier à
 *  s'en servir, et le fichier qui le portait part avec l'ancien châssis. Le
 *  descendre dans le module de vocabulaire n'aurait servi à rien — c'est du
 *  balisage, et il n'a plus qu'un lecteur. Il repartira le jour où la
 *  superposition passera au papier du carnet. */
function Reglage({
  libelle,
  aide,
  children,
}: {
  libelle: string
  aide?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-[104px] shrink-0">
        <Libelle aide={aide}>{libelle}</Libelle>
      </span>
      {/* **Le nom descend jusqu'au contrôle** (U3). Le champ où une valeur
          s'écrit a besoin d'un nom pour être trouvable, et ce nom est déjà
          écrit à gauche : le faire redire à chaque emploi aurait fabriqué
          autant d'occasions de le laisser diverger de ce qui s'affiche. */}
      <div className="min-w-0 flex-1">
        <NomDuReglage.Provider value={libelle}>{children}</NomDuReglage.Provider>
      </div>
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
  blanc: "#ffffff",
  noir: "#000000",
  rose: "#ff2d95",
  bleu: "#1e6fff",
  vert: "#12c46a",
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
 *  l'écran fait deux métiers : elle enseigne et elle agit. Un raccourci écrit
 *  dans une aide n'est jamais lu ; dessiné sous le réglage qu'il commande, il
 *  se voit au moment où on en a besoin.
 */
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
  aide,
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
  aide?: string
  note?: string
}) {
  const borner = (v: number) => Math.max(min, Math.min(max, v))
  const bouger = (sens: number, dix: boolean) =>
    onFini(borner(Number((valeur + sens * pas * (dix ? 10 : 1)).toFixed(3))))
  return (
    <div className="flex flex-col gap-1">
      <Reglage libelle={libelle} aide={aide}>
        <div className="flex items-center gap-2">
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
            className="mesure h-[26px] w-[64px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte"
          />
        </div>
      </Reglage>
      <div className="mesure flex items-center gap-1 pl-[116px] text-[10px] text-texte-3">
        <button
          type="button"
          aria-label={`${libelle} — ${touches[0]}`}
          onClick={(e) => bouger(-1, e.shiftKey)}
          className="h-[24px] w-[24px] rounded-[2px] border border-bord bg-fond-2 hover:text-ancien-signal"
        >
          {touches[0]}
        </button>
        <button
          type="button"
          aria-label={`${libelle} — ${touches[1]}`}
          onClick={(e) => bouger(1, e.shiftKey)}
          className="h-[24px] w-[24px] rounded-[2px] border border-bord bg-fond-2 hover:text-ancien-signal"
        >
          {touches[1]}
        </button>
        <span>
          {pas}
          {unite} · Maj ×10
        </span>
        {note && <span className="ml-auto text-epingle">{note}</span>}
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
          className="mesure flex h-[24px] items-center gap-2 text-[10px] text-texte-3"
        >
          <span>{nom}</span>
          <span className="ml-auto text-texte-2">{valeur}</span>
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
  const envol = useRef(0)

  // ── L'ouverture ───────────────────────────────────────────────────────────
  useEffect(() => {
    let vivant = true
    api
      .ouvrirSuperposition(asset.identifiant)
      .then((recu) => {
        // **Un serveur plus vieux que l'écran répond sans se plaindre.** C'est
        // le piège que E3 a payé : le double rendait « {} » en 200, la table
        // lisait dedans, et l'application entière disparaissait. On regarde
        // donc la forme avant de s'y fier.
        if (!vivant || !recu?.pose) return
        setOuverture(recu)
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
  // **Déplacer le dessus d'un pixel les met toutes à jour.** C'est ce qui
  // permet de caler en regardant le résultat plutôt que le travail, et c'est la
  // raison d'être de cette disposition à trois panneaux. L'aperçu se redemande
  // au **relâchement**, jamais à chaque cran : c'est la règle du curseur de la
  // recette, et elle vaut ici pour la même raison — le serveur sérialise.
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
    // **Changer d'image du dessus change tout ce qui en découle** (G16) :
    // sans cette ligne, la bascule aurait laissé les trois vues sur le calcul
    // d'avant, et l'écran aurait montré autre chose que ce qu'il allait
    // fabriquer.
    pose.dessus_arrivee,
  ])

  const poser = (suivante: Partial<Superposition>) =>
    setPose((deja) => ({ ...deja, ...suivante }))

  const dessous = ouverture?.dessous ?? null
  const dessus = ouverture?.dessus ?? asset
  const pret = Boolean(pose.dessus && pose.dessous)

  const recaler = async () => {
    if (!pret) return
    setRecalage(true)
    try {
      const trouve = await api.recalerSuperposition(
        pose.dessus,
        pose.dessous,
        pose.dessus_arrivee,
      )
      poser({ echelle: trouve.echelle, dx: trouve.dx, dy: trouve.dy })
    } catch (erreur) {
      onErreur(String(erreur))
    } finally {
      setRecalage(false)
    }
  }

  const fabriquer = async () => {
    try {
      const { superpositions } = await api.fabriquerSuperposition(pose, sorties, garder)
      onFabrique?.(superpositions)
    } catch (erreur) {
      onErreur(String(erreur))
    }
  }

  // **L'échelle est le seul réglage de l'outil qui abîme l'image** :
  // rééchantillonner du pixel art à un facteur qui n'est pas simple détruit la
  // grille. L'écran le marque, il ne le refuse pas.
  const simple = [0.25, 0.5, 1, 2, 3, 4].some((v) => Math.abs(pose.echelle - v) < 1e-6)

  return (
    <div data-superposition className="grid min-h-0 min-w-0 flex-1 grid-cols-[380px_minmax(0,1fr)_380px]">
      {/* ── La colonne de gauche ─────────────────────────────────────────── */}
      <aside {...PANNEAU} className="flex min-h-0 flex-col border-r border-bord bg-fond-1">
        <EnTetePanneau>superposition</EnTetePanneau>
        <div className="defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {/* Les deux images. Le dessus se déplace, le dessous ne bouge pas. */}
          <div className="flex flex-col gap-1">
            <Libelle aide="superposition.images">les deux images</Libelle>
            <ImageChoisie
              asset={dessus}
              role={
                pose.dessus_arrivee
                  ? "DESSUS · TEL QU'IL EST ARRIVÉ"
                  : "DESSUS · SE DÉPLACE"
              }
              actif
              arrivee={pose.dessus_arrivee}
              onChanger={() => setChoisir("dessus")}
            />
            {/* **De quelle image du dessus on part** (G16, US-503). Elle ne
                paraît que là où la question se pose vraiment : un vêtement
                sorti d'une planche, dont le fichier rangé est *déjà* mis à
                l'échelle et calé sur son corps. Repartir de là pour refaire le
                calage reviendrait à repartir du résultat qu'on veut défaire —
                c'est pourquoi le défaut est *telle qu'elle est arrivée*, et
                non l'inverse. Partout ailleurs, les deux sont le même fichier
                et la rangée n'a rien à dire. */}
            {ouverture?.arrivee_possible && (
              <div className="flex flex-col gap-1 pt-1">
                <Segments<string>
                  valeurs={["telle qu'arrivée", "telle que rangée"] as const}
                  valeur={
                    pose.dessus_arrivee ? "telle qu'arrivée" : "telle que rangée"
                  }
                  onChange={(quoi) =>
                    poser({ dessus_arrivee: quoi === "telle qu'arrivée" })
                  }
                />
                <span className="mesure text-[10px] leading-4 text-texte-3">
                  {pose.dessus_arrivee
                    ? "la case telle que le modèle l'a rendue — c'est d'elle qu'on repart pour refaire le calage"
                    : "le vêtement déjà découpé et calé : refaire le calage sur lui repartirait du résultat"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                poser({ dessus: pose.dessous, dessous: pose.dessus })
              }
              className="mesure h-6 self-start text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
            >
              ↕ échanger
            </button>
            {dessous ? (
              <ImageChoisie
                asset={dessous}
                role="DESSOUS · FIXE"
                onChanger={() => setChoisir("dessous")}
              />
            ) : (
              // **Sans dessous, il faut un moyen d'en choisir un.** La rangée
              // qui porte « changer › » n'existe que quand l'image existe : la
              // raison est donc le bouton, comme l'alerte du détourage juste en
              // dessous — trouvé au navigateur en tenant E6, où l'outil
              // s'ouvrait sans aucune porte vers sa seconde image.
              <button
                type="button"
                onClick={() => setChoisir("dessous")}
                className="mesure h-[26px] rounded-[2px] border border-bord-fort px-2 text-left text-[10px] text-texte-2 hover:text-ancien-signal"
              >
                choisir l'image du dessous — celle sur laquelle on pose ›
              </button>
            )}
          </div>

          {choisir && (
            <div className="flex flex-col gap-1 border-t border-bord pt-2">
              <Libelle>choisir {choisir === "dessus" ? "le dessus" : "le dessous"}</Libelle>
              <div className="flex flex-wrap gap-1">
                {soeurs.map((soeur) => (
                  <button
                    key={soeur.identifiant}
                    type="button"
                    title={soeur.label}
                    aria-label={`Prendre ${soeur.label} comme ${choisir}`}
                    onClick={() => {
                      poser({ [choisir]: soeur.identifiant } as Partial<Superposition>)
                      setChoisir(null)
                      void api
                        .ouvrirSuperposition(
                          choisir === "dessus" ? soeur.identifiant : pose.dessus,
                          choisir === "dessus" ? pose.dessous : soeur.identifiant,
                        )
                        .then(setOuverture)
                    }}
                    className="rounded-[2px] border border-transparent p-[2px] hover:border-bord"
                  >
                    <img
                      src={api.rendu(soeur.identifiant, soeur.empreinte)}
                      alt={soeur.label}
                      className="damier h-[38px] w-[38px] object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* « Avant de caler » — l'état du détourage des deux images.
              **L'alerte nomme la conséquence et elle est aussi le bouton.** */}
          {ouverture && (
            <div className="flex flex-col gap-1 border-t border-bord pt-2">
              <Libelle aide="superposition.detourage">avant de caler</Libelle>
              <span className="mesure text-[10px] text-texte-3">
                le dessous · {ouverture.passes_dessous} passe
                {ouverture.passes_dessous > 1 ? "s" : ""} — le dessus ·{" "}
                {ouverture.passes_dessus} passe{ouverture.passes_dessus > 1 ? "s" : ""}
              </span>
              {ouverture.sans_alpha && (
                <>
                  <Raison texte="sans alpha sur le dessus, le calque prendrait tout le fond" />
                  <button
                    type="button"
                    disabled={!dessous || ouverture.passes_dessous === 0}
                    onClick={() =>
                      void api
                        .heriterDetourage(pose.dessus, pose.dessous)
                        .then(() => api.ouvrirSuperposition(pose.dessus, pose.dessous))
                        .then((recu) => {
                          setOuverture(recu)
                          rafraichir(pose)
                        })
                        .catch((erreur) => onErreur(String(erreur)))
                    }
                    className="mesure h-6 self-start text-[10px] text-ancien-signal hover:text-ancien-signal-clair disabled:text-texte-3"
                  >
                    reprendre les {ouverture.passes_dessous} passes du dessous ›
                  </button>
                </>
              )}
            </div>
          )}

          {/* Les deux blocs « voir » ne changent que l'affichage : rien de tout
              ça ne touche à ce qui sort, et l'en-tête le dit. */}
          <div className="flex flex-col gap-2 border-t border-bord pt-2">
            <Libelle aide="superposition.voir">voir le dessous — ne change pas la sortie</Libelle>
            <Segments
              valeurs={TEINTES}
              valeur={teinte}
              libelles={LIBELLE_TEINTE}
              onChange={setTeinte}
            />
            <Reglage libelle="opacité">
              <Curseur valeur={opaciteDessous} min={0} max={100} unite=" %" onChange={setOpaciteDessous} />
            </Reglage>
            <Reglage libelle="le dessus">
              <Curseur valeur={opaciteDessus} min={0} max={100} unite=" %" onChange={setOpaciteDessus} />
            </Reglage>
          </div>

          {/* Le calage. **Recaler est un bouton, pas un mode** : on est toujours
              en manuel, il remplit les trois valeurs et s'arrête là. */}
          <div className="flex flex-col gap-2 border-t border-bord pt-2">
            <Libelle aide="superposition.calage">le calage du dessus</Libelle>
            {/* **Ce qui a été fait avant que le calage commence** (M1). Le
                dessus plus grand que le cadre y entre entier, réduit pour
                tenir — et sans cette phrase on lirait « × 1,00 » en croyant
                que l'image part de sa taille d'arrivée. Elle ne paraît que
                lorsqu'il y a eu réduction : dans le cas courant, il n'y a rien
                à dire. */}
            {apercu?.cadrage.ramene && (
              <Raison
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
              className="mesure h-[34px] w-full rounded-[2px] border border-bord-fort bg-fond-2 text-[11.5px] text-texte-2 hover:text-ancien-signal disabled:text-texte-3"
            >
              {recalage ? "cherche…" : "Recaler"}
            </button>
            <Cran
              libelle="échelle"
              aide="superposition.echelle"
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
              aide="superposition.decalage"
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
              className="mesure h-6 self-start text-[10px] text-texte-3 hover:text-ancien-signal"
            >
              remettre à zéro ›
            </button>
          </div>

          {/* Ce qu'on garde du dessus. Le rectangle sert deux fois. */}
          <div className="flex flex-col gap-2 border-t border-bord pt-2">
            <Libelle aide="superposition.seuil">ce qu'on garde du dessus</Libelle>
            <Reglage libelle="seuil" aide="superposition.seuil">
              <Curseur
                valeur={pose.seuil}
                min={0}
                max={255}
                onChange={(seuil) => setPose((d) => ({ ...d, seuil }))}
                onFini={(seuil) => poser({ seuil })}
              />
            </Reglage>
            <Raison texte="de combien une couleur doit changer pour compter comme changée" />
            {pose.rectangle && (
              <button
                type="button"
                onClick={() => poser({ rectangle: null })}
                className="mesure h-6 self-start text-[10px] text-texte-3 hover:text-ancien-echec"
              >
                × le rectangle — {pose.rectangle[2] - pose.rectangle[0] + 1}×
                {pose.rectangle[3] - pose.rectangle[1] + 1}
              </button>
            )}
            {!pose.rectangle && (
              <Raison texte="aucun rectangle — glisse-en un sur l'image pour borner ce qui part" />
            )}
          </div>

          {/* Ce qu'on en sort. Les deux se cochent au lieu de s'exclure. */}
          <div className="flex flex-col gap-2 border-t border-bord pt-2">
            <Libelle aide="superposition.sorties">ce qu'on en sort</Libelle>
            {(
              [
                ["calque", "ce que le dessus ajoute · va au vestiaire"],
                ["aplat", "les deux fondues · un asset ordinaire"],
              ] as const
            ).map(([nom, quoi]) => (
              <label key={nom} className="flex items-start gap-2 text-[11.5px] text-texte-2">
                <input
                  type="checkbox"
                  checked={sorties.includes(nom)}
                  onChange={(e) =>
                    setSorties((deja) =>
                      e.target.checked
                        ? [...deja, nom]
                        : deja.filter((s) => s !== nom),
                    )
                  }
                  className="mt-[3px]"
                />
                <span>
                  {nom}
                  <span className="mesure block text-[10px] text-texte-3">{quoi}</span>
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-[11.5px] text-texte-2">
              <input
                type="checkbox"
                checked={garder}
                onChange={(e) => setGarder(e.target.checked)}
              />
              enregistrer ces réglages
            </label>
            {ouverture?.repris && (
              <div className="flex flex-col gap-1">
                <Raison texte={`repris de « ${ouverture.repris.depuis} »`} />
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
                  className="mesure h-6 self-start text-[10px] text-texte-3 hover:text-ancien-signal"
                >
                  repartir de zéro ›
                </button>
              </div>
            )}
          </div>

          {apercu && (
            <div className="border-t border-bord pt-2">
              <Libelle aide="superposition.mesures">ce que la comparaison a mesuré</Libelle>
              <Mesures mesures={apercu.mesures} />
            </div>
          )}
        </div>

        {/* Le pied porte l'état et le geste. **Rien n'est détruit : rien n'est
            encore fabriqué.** */}
        <div className="flex shrink-0 flex-col border-t border-bord">
          <button
            type="button"
            disabled={!pret || sorties.length === 0}
            onClick={() => void fabriquer()}
            className="mesure h-[34px] px-3 text-left text-[11.5px] text-ancien-signal hover:text-ancien-signal-clair disabled:text-texte-3"
          >
            Fabriquer — {sorties.length} image{sorties.length > 1 ? "s" : ""} ›
          </button>
          <button
            type="button"
            onClick={() => poser({ echelle: 1, dx: 0, dy: 0, rectangle: null, main: [] })}
            className="mesure h-[26px] border-t border-bord px-3 text-left text-[10px] text-texte-3 hover:text-ancien-echec"
          >
            Tout défaire ›
          </button>
        </div>
      </aside>

      {/* ── Le travail ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <CadreDuTravail
            dessous={dessous}
            dessus={dessus}
            pose={pose}
            cadrage={apercu?.cadrage ?? null}
            teinte={teinte}
            opaciteDessous={opaciteDessous}
            opaciteDessus={opaciteDessus}
            onRectangle={(rectangle) => poser({ rectangle })}
          />
        </div>
        <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
          <span className="whitespace-nowrap">
            × {pose.echelle.toFixed(3)} · {pose.dx >= 0 ? "+" : ""}
            {pose.dx} · {pose.dy >= 0 ? "+" : ""}
            {pose.dy}
          </span>
          {apercu && (
            <span className="whitespace-nowrap">
              ajout {Math.round(apercu.mesures.ajout * 100)} %
            </span>
          )}
          <span className="ml-auto whitespace-nowrap text-texte-3">
            aucun appel ne part d'ici
          </span>
        </div>
      </div>

      {/* ── Les deux rendus ──────────────────────────────────────────────── */}
      <aside {...PANNEAU} className="flex min-h-0 flex-col border-l border-bord bg-fond-1">
        <EnTetePanneau>ce qui en sortira</EnTetePanneau>
        <div className="defile flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <Libelle aide="superposition.fond">le calque seul</Libelle>
          <div
            className={COULEUR_DE_FOND[fond] ? "" : "damier"}
            style={{ background: COULEUR_DE_FOND[fond] }}
          >
            {apercu ? (
              <img
                src={apercu.calque}
                alt="le calque seul"
                className="h-[180px] w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="h-[180px]" />
            )}
          </div>
          <Segments valeurs={FONDS} valeur={fond} onChange={setFond} />
          <Raison texte="un aplat vif fait sauter aux yeux les pixels oubliés — sur le damier ils se confondent" />

          <div className="border-t border-bord pt-2">
            <Libelle aide="superposition.resultat">le résultat</Libelle>
          </div>
          <div className="damier">
            {apercu && (
              <img
                src={
                  masque && dessous
                    ? api.rendu(dessous.identifiant, dessous.empreinte)
                    : apercu.aplat
                }
                alt="le résultat"
                className="h-[180px] w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            )}
          </div>
          <button
            type="button"
            onPointerDown={() => setMasque(true)}
            onPointerUp={() => setMasque(false)}
            onPointerLeave={() => setMasque(false)}
            className="mesure h-[24px] self-start rounded-[2px] border border-bord-fort px-2 text-[10px] text-texte-2 hover:text-ancien-signal"
          >
            masquer le calque
          </button>
          <Raison texte="l'avant/après — c'est ce qui dit si la pièce tient sur le corps" />
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
  /** **Montrer ce qui part, et non ce qui est rangé** (G16). Quand la table
   *  travaille sur la case telle qu'elle est arrivée, la vignette la montre :
   *  une vignette du calque au-dessus d'un calcul fait sur autre chose serait
   *  le genre de mensonge tranquille que cette version répare. */
  arrivee?: boolean
  onChanger: () => void
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-[2px] border p-1",
        actif ? "border-lumiere" : "border-bord",
      ].join(" ")}
    >
      <img
        src={
          arrivee
            ? api.arrivee(asset.identifiant)
            : api.rendu(asset.identifiant, asset.empreinte)
        }
        alt={asset.label}
        className="damier h-[38px] w-[38px] shrink-0 object-contain"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] text-texte">{asset.label}</span>
        <span className="mesure block text-[10px] text-texte-3">{role}</span>
      </span>
      <button
        type="button"
        onClick={onChanger}
        className="mesure shrink-0 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
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
}: {
  dessous: Asset | null
  dessus: Asset
  pose: Superposition
  /** Où le serveur pose le dessus dans le cadre (M1). `null` tant que le
   *  premier aperçu n'est pas revenu — l'image tient alors la place entière,
   *  comme avant. */
  cadrage: Cadrage | null
  teinte: Teinte
  opaciteDessous: number
  opaciteDessus: number
  onRectangle: (r: number[] | null) => void
}) {
  const [trace, setTrace] = useState<[number, number, number, number] | null>(null)
  if (!dessous) {
    return (
      <p className="mesure text-[10px] text-texte-3">
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
      style={{ aspectRatio: `${largeur} / ${hauteur}` }}
      className="relative max-h-full max-w-full"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const [x, y] = point(e)
        setTrace([x, y, x, y])
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!trace) return
        const [x, y] = point(e)
        setTrace([trace[0], trace[1], x, y])
      }}
      onPointerUp={() => {
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
    >
      <img
        src={api.rendu(dessous.identifiant, dessous.empreinte)}
        alt={dessous.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{
          imageRendering: "pixelated",
          opacity: opaciteDessous / 100,
          filter: FILTRE[teinte],
        }}
      />
      {/* **Le dessus tel qu'il part au calcul, pas tel qu'il est rangé** (G16).
          Sans cette ligne, le cadre où l'on trace le rectangle montrait le
          vêtement déjà découpé pendant que le serveur travaillait sur la case
          telle qu'elle est arrivée : on découpait sur une image, et l'atelier
          coupait dans une autre. Trouvé en usage le 4 septembre 2026 — la
          vignette de gauche avait été corrigée, le grand cadre non.

          **Et posé là où le serveur le pose** (M1). Le calque enveloppant porte
          l'échelle et le décalage — il fait la taille du cadre, donc ses
          pour-cent de déplacement sont ceux du serveur ; l'image, dedans, prend
          la place que le cadrage lui donne. Un `object-contain` seul mentait des
          deux côtés à la fois : il réduisait ce que le serveur coupait, et il
          agrandissait ce que le serveur laissait dans son coin. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: opaciteDessus / 100,
          transform: `translate(${(pose.dx / largeur) * 100}%, ${(pose.dy / hauteur) * 100}%) scale(${pose.echelle})`,
        }}
      >
        <img
          src={
            pose.dessus_arrivee
              ? api.arrivee(dessus.identifiant)
              : api.rendu(dessus.identifiant, dessus.empreinte)
          }
          alt={dessus.label}
          draggable={false}
          data-dessus-cadre
          className={
            cadrage
              ? "absolute select-none"
              : "absolute inset-0 h-full w-full object-contain select-none"
          }
          style={
            cadrage
              ? {
                  left: `${(cadrage.gauche / largeur) * 100}%`,
                  top: `${(cadrage.sommet / hauteur) * 100}%`,
                  width: `${(cadrage.largeur / largeur) * 100}%`,
                  height: `${(cadrage.hauteur / hauteur) * 100}%`,
                  // **Lissé quand l'image a été réduite, net sinon.** Le serveur
                  // réduit en moyenne de surface ; demander au navigateur le
                  // plus proche voisin sur la même réduction montrerait un autre
                  // dessin que celui qui est mesuré.
                  imageRendering: cadrage.ramene ? "auto" : "pixelated",
                }
              : { imageRendering: "pixelated" }
          }
        />
      </div>
      {dessine && (
        <span
          aria-hidden
          style={{
            left: `${(Math.min(dessine[0], dessine[2]) / largeur) * 100}%`,
            top: `${(Math.min(dessine[1], dessine[3]) / hauteur) * 100}%`,
            width: `${((Math.abs(dessine[2] - dessine[0]) + 1) / largeur) * 100}%`,
            height: `${((Math.abs(dessine[3] - dessine[1]) + 1) / hauteur) * 100}%`,
          }}
          className="pointer-events-none absolute border border-lumiere"
        />
      )}
    </div>
  )
}
