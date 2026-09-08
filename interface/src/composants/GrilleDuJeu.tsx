/**
 * La grille du jeu — B13. **Le sujet posé sur les cases du moteur, avec ses
 * voisins étiquetés de leur occupation.**
 *
 * `docs/pistes-2026-09-04/carnet/Grille.dc.html`. Une profondeur de plus de la
 * page d'un sujet (`interface/src/lieux.ts`, genre `"grille"`), ouverte depuis
 * son bandeau d'onglets — exactement comme la matrice l'était déjà avant
 * `B10`.
 *
 * **Aucun chiffre neuf ne s'y calcule.** Le plafond réel d'occupation —
 * `occupationMax(cible)` — existe déjà (`interface/src/api.ts`), testé côté
 * serveur (`tests/test_tailles.py`) et déjà employé par `Assistant.tsx` et
 * `Places.tsx`. Cet écran ne fait que le montrer à côté du reste.
 *
 * **Les voisins sont des types, pas des sujets réels du jeu.** Aller chercher
 * un vrai moulin et une vraie grenouille aurait demandé un appel de plus et un
 * choix arbitraire ; le voisinage montre un exemplaire de chacun des sept
 * autres types du barème, à l'occupation exacte que le barème leur donne.
 *
 * Elle ne fabrique rien, ne modifie rien, ne coûte rien — comme la vitrine et
 * le calibrage, elle n'a pas de barre qui paie.
 */

import { useMemo, useState, type ReactNode } from "react"
import {
  AUCUNE_CIBLE,
  CIBLE_DE_REFERENCE,
  NOM_DE_LA_METHODE,
  coteDuSujet,
  occupationMax,
  type Ancrage,
  type Echelle,
  type Methode,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"
import { imageAsset } from "./Apercu"
import { portraitDe } from "./FicheChose"

/** Des multiples entiers, et rien d'autre — la même règle que `Vitrine.tsx`,
 *  pour la même raison : un sprite agrandi d'une fois et demie fabrique des
 *  pixels qui n'existent pas. */
const ZOOMS = [1, 2, 4, 8] as const
type Zoom = (typeof ZOOMS)[number]

const NOM_DE_L_ANCRAGE: Record<Ancrage, string> = {
  "haut-gauche": "en haut, à gauche",
  haut: "en haut, au centre",
  "haut-droite": "en haut, à droite",
  gauche: "au centre, à gauche",
  centre: "au centre",
  droite: "au centre, à droite",
  "bas-gauche": "en bas, à gauche",
  bas: "en bas, au centre",
  "bas-droite": "en bas, à droite",
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

export function GrilleDuJeu({
  personnage,
  plan,
  univers,
  onFermer,
  onComparer,
}: {
  personnage: Personnage
  plan: Pose[]
  univers: Univers
  onFermer: () => void
  onComparer: () => void
}) {
  const [zoom, setZoom] = useState<Zoom>(2)
  const [voisins, setVoisins] = useState<ReadonlySet<string>>(new Set())

  const cible = univers.cible_px || CIBLE_DE_REFERENCE
  const plafondReel = occupationMax(cible)
  const echelle = univers.bareme.find((e) => e.nom === personnage.type) ?? null
  const occupation = echelle?.occupation ?? 100

  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])
  const grille = portrait?.asset.recette.grille ?? null

  const hauteurAffichee = coteDuSujet(cible, occupation) * zoom
  const rapport = portrait
    ? (portrait.asset.rendu_largeur || portrait.asset.largeur || 1) /
      (portrait.asset.rendu_hauteur || portrait.asset.hauteur || 1)
    : 1
  const largeurAffichee = hauteurAffichee * rapport

  const autresTypes = univers.bareme.filter((e) => e.nom !== personnage.type)

  const basculerVoisin = (nom: string) =>
    setVoisins((avant) => {
      const suite = new Set(avant)
      if (suite.has(nom)) suite.delete(nom)
      else suite.add(nom)
      return suite
    })

  return (
    <main
      data-grille-du-jeu
      aria-label={`La grille du jeu, pour ${personnage.nom}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            ‹ Sa page
          </button>
          <span className="text-[12.5px] text-encre-3">{personnage.nom}</span>
        </div>

        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
              Sur la grille du jeu
            </h1>
            <p className="text-[13px] text-encre-2">
              à sa vraie taille, sur les cases du jeu, à côté de ce qui l'entoure
            </p>
          </div>
          <button
            type="button"
            onClick={onComparer}
            className="h-[30px] rounded-7 px-[14px] text-[13.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
          >
            Comparer ›
          </button>
        </div>

        <div className="flex items-center gap-[14px]">
          <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => setZoom(z)}
                className={[
                  "flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                  zoom === z
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                ×{z}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-encre-4">
            un facteur entier, jamais un zoom continu — à ×1,5 un pixel du jeu
            n'est plus un carré
          </span>
        </div>

        <div className="flex min-h-0 flex-1 gap-[22px] overflow-hidden">
          {/* ── La scène : le sujet sur ses cases, avec ses voisins ────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
            <div
              data-scene-de-la-grille
              className="relative flex min-h-[300px] flex-1 items-end justify-center gap-[8px] overflow-auto rounded-8 bg-pourtour p-[22px]"
              style={{
                // Une grille pleine avec `--color-eteint` (déjà déclaré) serait
                // trop marquée sur `bg-pourtour` ; le mélange « overlay » entre
                // les deux fonds de cet élément adoucit le trait sans écrire de
                // couleur littérale — ce que la liste fermée interdit.
                backgroundImage:
                  "linear-gradient(to right, var(--color-eteint) 1px, transparent 1px), linear-gradient(to bottom, var(--color-eteint) 1px, transparent 1px)",
                backgroundSize: `${cible * zoom}px ${cible * zoom}px`,
                backgroundBlendMode: "overlay",
              }}
            >
              {autresTypes
                .filter((e) => voisins.has(e.nom))
                .map((e) => (
                  <VoisinType key={e.nom} echelle={e} cible={cible} zoom={zoom} />
                ))}

              <figure className="flex flex-col items-center gap-[4px]">
                {portrait ? (
                  <img
                    src={imageAsset(portrait.asset)}
                    alt={personnage.nom}
                    width={Math.round(largeurAffichee)}
                    height={Math.round(hauteurAffichee)}
                    style={{ imageRendering: "pixelated" }}
                    className="block"
                  />
                ) : (
                  <span
                    style={{ width: 40 * zoom, height: hauteurAffichee }}
                    className="block rounded-t-5 bg-contour"
                  />
                )}
                <figcaption className="mesure text-[10.5px] text-carte">
                  {personnage.nom}
                </figcaption>
              </figure>
            </div>

            <div className="flex flex-wrap items-center gap-[8px] rounded-8 border border-trait bg-carte px-[14px] py-[8px]">
              <span className="shrink-0 text-[12.5px] text-encre-3">À côté de lui</span>
              {autresTypes.map((e) => (
                <button
                  key={e.nom}
                  type="button"
                  aria-pressed={voisins.has(e.nom)}
                  onClick={() => basculerVoisin(e.nom)}
                  className={[
                    "h-[26px] rounded-full border px-[14px] text-[12.5px] transition-colors duration-120",
                    voisins.has(e.nom)
                      ? "border-contour bg-papier-cote text-encre"
                      : "border-trait text-encre-3 hover:text-encre",
                  ].join(" ")}
                >
                  {e.nom} · {e.occupation} %
                </button>
              ))}
            </div>
          </div>

          {/* ── Ce qu'il occupe ─────────────────────────────────────────── */}
          <aside
            data-ce-qu-il-occupe
            aria-label="Ce qu'il occupe"
            className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
          >
            <span className="font-serif text-[25px] leading-[1.15] text-encre">
              Ce qu'il occupe
            </span>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-[4px] text-[12.5px]">
              <span className="text-encre-3">Son type de sujet</span>
              <span className="text-right text-encre">{personnage.type || "aucun"}</span>
              <span className="text-encre-3">Ce qu'il occupe</span>
              <span className="text-right text-encre">{occupation} % d'une case</span>
              <span className="text-encre-3">La case du jeu</span>
              <span className="text-right text-encre">
                {univers.cible_px === AUCUNE_CIBLE ? "aucune imposée" : `${cible} px`}
              </span>
              <span className="text-encre-3">Son ancrage</span>
              <span className="text-right text-encre">
                {NOM_DE_L_ANCRAGE[grille?.ancrage ?? "bas"]}
              </span>
              <span className="text-encre-3">Son décalage</span>
              <span className="text-right text-encre">{grille?.decalage ?? 0} px</span>
              <span className="text-encre-3">Sa réduction</span>
              <span className="text-right text-encre">
                {NOM_DE_LA_METHODE[(grille?.methode ?? "proche") as Methode]}
              </span>
              <span className="text-encre-3">Se détoure</span>
              <span
                className={`text-right ${(echelle?.silhouette ?? true) ? "text-ok" : "text-encre-3"}`}
              >
                {(echelle?.silhouette ?? true) ? "oui" : "non"}
              </span>
            </div>

            <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <Etiquette>Le plafond réel de sa case</Etiquette>
              <p className="mesure text-[25px] leading-[1.15] text-encre">
                {plafondReel} %
              </p>
              <p className="text-[11.5px] leading-[1.5] text-encre-4">
                {plafondReel < 800
                  ? `La toile ne dépasse pas 2 048 px de côté : sur une case de ${cible} px, le plafond descend de 800 % (huit personnages) à ${plafondReel} %.`
                  : "Huit personnages de haut au plus — la borne du métier, pas celle de la machine, qui autoriserait bien plus sur cette case."}
              </p>
            </div>

            <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <Etiquette>Le barème du jeu</Etiquette>
              {univers.bareme.map((e) => (
                <div
                  key={e.nom}
                  className={[
                    "flex items-center justify-between gap-[8px] rounded-5 px-[8px] py-[4px] text-[12px]",
                    e.nom === personnage.type ? "bg-carte" : "",
                  ].join(" ")}
                >
                  <span className={e.nom === personnage.type ? "text-encre" : "text-encre-2"}>
                    {e.nom}
                  </span>
                  <span className="mesure text-[11px] text-encre-4">{e.occupation} %</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

/** Un voisin représenté par son type, à sa vraie occupation — **pas un sujet
 *  réel du jeu**. Le barème donne déjà le seul nombre qui compte ici, et aller
 *  chercher un vrai porteur de ce type aurait demandé un appel de plus pour un
 *  choix que rien ne guide. */
function VoisinType({
  echelle,
  cible,
  zoom,
}: {
  echelle: Echelle
  cible: number
  zoom: Zoom
}) {
  const hauteur = coteDuSujet(cible, echelle.occupation) * zoom
  return (
    <figure className="flex flex-col items-center gap-[4px]">
      <span
        style={{ width: Math.max(10, hauteur * 0.55), height: hauteur }}
        className="block rounded-t-5 bg-contour"
      />
      <figcaption className="mesure whitespace-nowrap text-[10.5px] text-carte">
        {echelle.nom} · {echelle.occupation} %
      </figcaption>
    </figure>
  )
}
