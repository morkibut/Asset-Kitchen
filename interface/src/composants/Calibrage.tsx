// Le calibrage — toutes les poses d'une chose à la même hauteur (E17).
//
// **Une seule case, pas une planche contact.** Toutes les poses y sont posées
// l'une sur l'autre, à la taille qu'elles auront dans le jeu. C'est la
// superposition qui fait voir le défaut : six vignettes côte à côte ne montrent
// pas qu'un personnage est plus petit qu'un autre, six silhouettes empilées, si.
//
// **Ce n'est pas une table, et c'est pour ça qu'il est ici.** Une table de la
// barre décrit l'image ouverte : on la règle, elle change, on voit. Le calibrage
// travaille sur *toutes* les poses à la fois et écrit dans chacune ; le mettre
// dans la barre voudrait dire que la barre de l'image A porte un outil qui
// modifie les images B, C et D — la barre cesserait de vouloir dire quelque
// chose.
//
// **Il ne coûte rien.** Aucun appel payant, aucune image neuve : il change le
// rendu de poses qui existent déjà, et un rendu est un cache — on recalcule, on
// ne repaie pas. La barre qui paie se retire donc, comme sur la vitrine.

import { useEffect, useState } from "react"
import { api, type Calibrage, type Personnage, type PoseCalee } from "../api"
import { Bouton, Libelle, Raison } from "./chassis"

/** Les deux façons de regarder l'empilement.
 *
 *  **Trois traitements, la même silhouette**, et aucun texte pour les
 *  expliquer : la pose qu'on règle est pleine, la référence est à demi, les
 *  autres sont en transparence forte. `seules` ne garde que les deux premières —
 *  à six poses l'empilement devient une bouillie, et comparer deux silhouettes
 *  est très exactement ce qu'on vient faire. */
type Vue = "toutes" | "seules"

export function EcranCalibrage({
  personnage,
  onFermer,
  onErreur,
}: {
  personnage: Personnage
  onFermer: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [lu, setLu] = useState<Calibrage | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [reglee, setReglee] = useState<string>("")
  const [vue, setVue] = useState<Vue>("toutes")
  // **La référence est celle qu'on compare, pas celle qui décide.** Par défaut
  // la première pose : c'est celle qu'on a dessinée en premier, et c'est
  // presque toujours le repos.
  const [reference, setReference] = useState<string>("")

  const poser = (recu: Calibrage) => {
    setLu(recu)
    setRefus(null)
    if (!reglee && recu.poses.length) setReglee(recu.poses[0].pose)
    if (!reference && recu.poses.length) setReference(recu.poses[0].pose)
  }

  useEffect(() => {
    let vivant = true
    void api
      .calibrage(personnage.identifiant)
      .then((recu) => vivant && poser(recu))
      .catch((erreur) => {
        if (!vivant) return
        setLu(null)
        setRefus(
          erreur instanceof Error ? erreur.message : "le calibrage ne répond pas",
        )
      })
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnage.identifiant])

  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

  const appeler = async (
    quoi: () => Promise<Calibrage>,
    defaut: string,
  ): Promise<void> => {
    try {
      poser(await quoi())
    } catch (erreur) {
      onErreur(erreur, defaut)
    }
  }

  const courante = lu?.poses.find((p) => p.pose === reglee) ?? null

  return (
    <div
      data-calibrage
      className="grid min-h-0 flex-1 grid-cols-[308px_minmax(0,1fr)] bg-fond-0"
    >
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord p-4">
        <div className="flex items-baseline gap-2">
          <Libelle>Calibrage</Libelle>
          <button
            type="button"
            onClick={onFermer}
            title="Échap ramène à l'établi"
            className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-texte"
          >
            ‹ l'établi
          </button>
        </div>

        {refus && <Raison texte={refus} />}

        {lu && (
          <>
            <p className="mesure text-[10px] leading-4 text-texte-3">
              {lu.poses.length} pose{lu.poses.length > 1 ? "s" : ""} ·{" "}
              {lu.poses.filter((p) => !p.de_cote).length} calée
              {lu.poses.filter((p) => !p.de_cote).length > 1 ? "s" : ""}
              {lu.poses.some((p) => p.de_cote) &&
                ` · ${lu.poses.filter((p) => p.de_cote).length} mise${
                  lu.poses.filter((p) => p.de_cote).length > 1 ? "s" : ""
                } de côté`}
            </p>

            {/* ── Le calibrage ────────────────────────────────────────────── */}
            <section className="flex flex-col gap-1.5">
              <Libelle>Le calibrage</Libelle>
              <Bouton
                principal
                inactif={lu.commune === 0}
                onClick={() =>
                  void appeler(
                    () => api.calibrer(personnage.identifiant),
                    "calibrage refusé",
                  )
                }
                enfants={`Calibrer les ${lu.poses.filter((p) => !p.de_cote).length} poses`}
              />
              {/* **La proposition dit ce qu'elle coûte, et qui limite.** Un
                  bouton qui pose une valeur sans dire d'où elle vient serait une
                  décision prise à la place de l'auteur. */}
              {lu.commune > 0 && (
                <p className="mesure text-[10px] leading-4 text-texte-3">
                  hauteur commune{" "}
                  <span className="text-texte-2">{lu.commune} px</span> sur{" "}
                  {lu.cible} · c'est «&nbsp;{lu.limite}&nbsp;» qui limite
                  <br />
                  {lu.perdus} px de la case ne servent pas ·{" "}
                  {Math.round((lu.perdus / lu.cible) * 100)} % de résolution en
                  moins, et c'est le prix de la cohérence
                </p>
              )}
              {/* **L'outil propose, il ne décide pas.** Il ne devine pas qu'une
                  pose est couchée : il voit qu'elle est très en dehors des
                  autres, et un clic la met de côté. */}
              {lu.de_cote && (
                <p className="mesure flex flex-wrap items-baseline gap-x-2 text-[10px] leading-4 text-texte-3">
                  <span>
                    «&nbsp;{lu.de_cote}&nbsp;» est très en dehors des autres — la
                    garder les rapetisse toutes.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void appeler(
                        () =>
                          api.mettreDeCote(personnage.identifiant, lu.de_cote, true),
                        "mise de côté refusée",
                      )
                    }
                    className="text-signal hover:text-signal-clair"
                  >
                    la mettre de côté ›
                  </button>
                </p>
              )}
            </section>

            {/* ── Les poses ───────────────────────────────────────────────── */}
            <section className="flex flex-col gap-1">
              <Libelle>Les poses</Libelle>
              <ul className="flex flex-col">
                {lu.poses.map((pose) => (
                  <LignePose
                    key={pose.pose}
                    pose={pose}
                    reglee={pose.pose === reglee}
                    reference={pose.pose === reference}
                    onRegler={() => setReglee(pose.pose)}
                    onReference={() => setReference(pose.pose)}
                    onDeCote={(de_cote) =>
                      void appeler(
                        () =>
                          api.mettreDeCote(
                            personnage.identifiant,
                            pose.pose,
                            de_cote,
                          ),
                        "mise de côté refusée",
                      )
                    }
                  />
                ))}
              </ul>
              {lu.poses.length === 0 && (
                <Raison texte="aucune pose de cette chose n'a encore de corps — il n'y a rien à empiler" />
              )}
            </section>

            {/* ── La reprise à la main ────────────────────────────────────── */}
            {courante && (
              <section className="flex flex-col gap-1.5">
                <Libelle>{courante.pose} — sa taille</Libelle>
                <Reglage
                  nom="occupation"
                  valeur={courante.occupation}
                  unite="%"
                  min={1}
                  max={100}
                  onChange={(valeur) =>
                    void appeler(
                      () =>
                        api.reglerLeCalage(personnage.identifiant, courante.pose, {
                          occupation: valeur,
                        }),
                      "réglage refusé",
                    )
                  }
                />
                <Reglage
                  nom="décalage"
                  valeur={courante.decalage}
                  unite="px"
                  min={-lu.cible}
                  max={lu.cible}
                  onChange={(valeur) =>
                    void appeler(
                      () =>
                        api.reglerLeCalage(personnage.identifiant, courante.pose, {
                          decalage: valeur,
                        }),
                      "réglage refusé",
                    )
                  }
                />
                {/* **La provenance est écrite sous les réglages, comme
                    partout** : ce que l'outil a posé et ce que la main a repris
                    ne se lisent pas pareil. */}
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  la taille est une part de la case — changer la case ne défait
                  aucun calage. Le décalage n'est écrit que par cet outil, et il
                  ne part pas dans une recette nommée.
                </p>
              </section>
            )}

            {/* ── Voir ────────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-1.5">
              <Libelle>Voir</Libelle>
              <div className="flex items-center gap-1.5">
                {(["toutes", "seules"] as const).map((quoi) => (
                  <button
                    key={quoi}
                    type="button"
                    aria-pressed={vue === quoi}
                    onClick={() => setVue(quoi)}
                    className={[
                      "mesure h-[26px] rounded-[2px] px-2 text-[10px] transition-colors duration-[80ms]",
                      vue === quoi
                        ? "bg-fond-3 text-texte"
                        : "text-texte-3 hover:bg-fond-2 hover:text-texte-2",
                    ].join(" ")}
                  >
                    {quoi === "toutes" ? "toutes" : "celle-ci et la référence"}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>

      {lu && (
        <Canevas
          calibrage={lu}
          reglee={reglee}
          reference={reference}
          vue={vue}
        />
      )}
    </div>
  )
}

/** Une pose dans la colonne : son occupation, sa hauteur rendue, et l'œil qui la
 *  met de côté.
 *
 *  **Le pourcentage est ce qu'on écrit, les pixels sont ce qu'on obtient**, et
 *  les deux ne disent pas la même chose — c'est la même règle que dans la table
 *  grille, où un pourcentage seul ment aux petites cases. */
function LignePose({
  pose,
  reglee,
  reference,
  onRegler,
  onReference,
  onDeCote,
}: {
  pose: PoseCalee
  reglee: boolean
  reference: boolean
  onRegler: () => void
  onReference: () => void
  onDeCote: (de_cote: boolean) => void
}) {
  return (
    <li className="flex h-[26px] items-center gap-2">
      <button
        type="button"
        aria-pressed={reglee}
        onClick={onRegler}
        className={[
          "mesure min-w-0 flex-1 truncate rounded-[2px] px-1 text-left text-[11px] transition-colors duration-[80ms]",
          reglee ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
        ].join(" ")}
      >
        {pose.pose}
      </button>
      <button
        type="button"
        aria-pressed={reference}
        onClick={onReference}
        aria-label={`Prendre ${pose.pose} comme référence`}
        title="celle à laquelle on compare — elle est cerclée dans le canevas"
        className={[
          "mesure h-[18px] shrink-0 rounded-[2px] border px-1 text-[9px] transition-colors duration-[80ms]",
          reference
            ? "border-epingle text-epingle"
            : "border-transparent text-texte-3 hover:border-bord",
        ].join(" ")}
      >
        réf
      </button>
      <span
        className={[
          "mesure w-[86px] shrink-0 text-right text-[9.5px]",
          pose.de_cote ? "text-texte-3 line-through opacity-60" : "text-texte-3",
        ].join(" ")}
      >
        {pose.de_cote
          ? "mise de côté"
          : `${pose.occupation} % · ${pose.rendue} px`}
      </span>
      <button
        type="button"
        onClick={() => onDeCote(!pose.de_cote)}
        aria-label={
          pose.de_cote
            ? `Faire rentrer ${pose.pose} dans le calage`
            : `Mettre ${pose.pose} de côté`
        }
        title={
          pose.de_cote
            ? "sa case existe toujours — seul le calage commun l'ignore"
            : "elle sort du calage commun ; sa case, elle, se remplit et se compte comme les autres"
        }
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-signal"
      >
        {pose.de_cote ? "◦" : "•"}
      </button>
    </li>
  )
}

/** Un réglage repris à la main : sa valeur, et les deux crans qui la bougent.
 *
 *  **Pas de rail** : la valeur se lit et se tape, et les deux boutons font le
 *  pas de un. Un rail demanderait une largeur que cette colonne n'a pas, et le
 *  chiffre est ce qu'on regarde. */
function Reglage({
  nom,
  valeur,
  unite,
  min,
  max,
  onChange,
}: {
  nom: string
  valeur: number
  unite: string
  min: number
  max: number
  onChange: (valeur: number) => void
}) {
  const borner = (v: number) => Math.max(min, Math.min(max, v))
  return (
    <div className="flex items-center gap-2">
      <span className="mesure w-[74px] shrink-0 text-[10px] text-texte-3">{nom}</span>
      <input
        type="number"
        value={valeur}
        min={min}
        max={max}
        onChange={(e) => onChange(borner(Number(e.target.value)))}
        aria-label={`${nom} de la pose réglée`}
        className="mesure h-[26px] w-[64px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte-2"
      />
      <span className="mesure shrink-0 text-[9.5px] text-texte-3">{unite}</span>
      <button
        type="button"
        onClick={() => onChange(borner(valeur - 1))}
        aria-label={`${nom} — un de moins`}
        className="mesure h-[26px] shrink-0 rounded-[2px] border border-bord px-2 text-[10px] text-texte-2 hover:text-signal"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onChange(borner(valeur + 1))}
        aria-label={`${nom} — un de plus`}
        className="mesure h-[26px] shrink-0 rounded-[2px] border border-bord px-2 text-[10px] text-texte-2 hover:text-signal"
      >
        +
      </button>
    </div>
  )
}

/** Le canevas — une seule case, toutes les poses dedans.
 *
 *  **La ligne de hauteur commune traverse le canevas**, et c'est la mesure que
 *  l'outil défend : toutes les têtes doivent la toucher. Une pose qui ne
 *  l'atteint pas se voit sans avoir à lire un chiffre — et le sol, en bas, est
 *  l'autre trait qu'on ne discute pas. */
function Canevas({
  calibrage,
  reglee,
  reference,
  vue,
}: {
  calibrage: Calibrage
  reglee: string
  reference: string
  vue: Vue
}) {
  // **Un multiple entier, et rien d'autre.** Agrandir d'une fois et demie
  // fabriquerait des pixels qui n'existent pas, et le défaut qu'on croirait voir
  // n'existerait que dans la fenêtre — c'est la règle de la vitrine, reprise
  // telle quelle.
  const echelle = Math.max(1, Math.floor(384 / Math.max(1, calibrage.cible)))
  const cote = calibrage.cible * echelle

  return (
    <div className="flex min-h-0 items-center justify-center overflow-auto p-8">
      <div className="flex flex-col items-center gap-3">
        <div
          data-canevas
          className="damier relative"
          style={{ width: cote, height: cote }}
        >
          {calibrage.poses
            .map((pose) => ({
              pose,
              etat: (pose.pose === reglee
                ? "reglee"
                : pose.pose === reference
                  ? "reference"
                  : "autre") as "reglee" | "reference" | "autre",
            }))
            .filter(({ etat }) => vue === "toutes" || etat !== "autre")
            .map(({ pose, etat }) => (
              <Silhouette
                key={pose.pose}
                pose={pose}
                cible={calibrage.cible}
                echelle={echelle}
                etat={etat}
              />
            ))}

          {/* La hauteur commune, et le sol. Deux traits qu'on ne discute pas. */}
          {calibrage.commune > 0 && (
            <div
              aria-hidden
              className="absolute right-0 left-0 border-t border-dashed border-epingle/70"
              style={{ bottom: calibrage.commune * echelle }}
            />
          )}
          <div
            aria-hidden
            className="absolute right-0 bottom-0 left-0 border-t border-bord-fort"
          />
        </div>
        <p className="mesure text-[10px] text-texte-3">
          {calibrage.cible} × {calibrage.cible} · ×{echelle} · la hauteur commune
          est à {calibrage.commune} px
        </p>
      </div>
    </div>
  )
}

/** Une silhouette dans l'empilement.
 *
 *  **Trois niveaux de lecture, et aucun texte pour les expliquer.** Celle qu'on
 *  règle est pleine, la référence est cerclée, les autres sont en transparence
 *  forte. Une image mise de côté reste montrée — sortir du calage n'est pas
 *  disparaître. */
function Silhouette({
  pose,
  cible,
  echelle,
  etat,
}: {
  pose: PoseCalee
  cible: number
  echelle: number
  etat: "reglee" | "reference" | "autre"
}) {
  return (
    <img
      // **Le rendu change sous la même adresse à chaque cran**, et l'empreinte
      // de la recette est ce qui fait chercher une image neuve au navigateur.
      // Sans elle, on réglerait l'occupation en regardant l'image d'avant.
      src={`/api/assets/${pose.asset}/image?v=${pose.empreinte}`}
      alt={pose.pose}
      className={[
        "absolute inset-0",
        etat === "reglee"
          ? "opacity-100"
          : etat === "reference"
            ? "opacity-60"
            : "opacity-20",
        // **Mise de côté n'est pas disparue** : elle reste montrée, en gris, et
        // sa case se remplit comme les autres. Seul le calage commun l'ignore.
        pose.de_cote ? "grayscale" : "",
      ].join(" ")}
      style={{
        width: cible * echelle,
        height: cible * echelle,
        imageRendering: "pixelated",
      }}
      title={`${pose.pose} — ${pose.rendue} px de haut, ${pose.occupation} % de la case`}
    />
  )
}
