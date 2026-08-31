// Ce qui part — le dernier écran avant que l'argent parte (E14).
//
// **Demander une image coûte de l'argent à chaque fois, et l'image qui revient
// n'est jamais deux fois la même** : on ne peut donc pas rejouer un appel raté
// sans le repayer. Cet écran-ci est là pour qu'on relise, une dernière fois, ce
// qui va vraiment partir — et pour qu'on puisse encore le changer.
//
// **Il ne montre pas un résumé.** Le texte exact, mot pour mot, et chaque image
// jointe, chacun sur sa ligne, avec un interrupteur. Ce qui est éteint ne part
// pas. Ce qu'on corrige ici **ne vaut que pour cet appel** et ne remonte nulle
// part : le réglage durable se fait sur la fiche de la chose, dans l'ambiance ou
// dans l'assistant, et garder une correction est un second geste, écrit.
//
// **Ce qui l'a fait basculer d'un dépliant à un écran est une mesure.** Sur le
// plus long appel payé du dépôt, le style pèse 890 caractères sur 1 690 et le
// sujet 40 — 53 % contre 2 %. Un bloc replié qui résume 53 % de ce qui part
// n'est pas un résumé, c'est un angle mort.
//
// **Aucun glyphe neuf, aucune largeur neuve.** L'interrupteur est le carré plein
// et le carré creux que le produit emploie déjà dans la barre des tables et dans
// le codex, où ils disent « cette place est prise » et « cette place est vide ».
// Ici ils disent « cette chose part » et « cette chose ne part pas ». Le sens est
// le même : une place occupée ou non.

import { useEffect, useRef, useState } from "react"
import {
  dollars,
  type Envoi,
  type ImageQuiPart,
  type LigneQuiPart,
  type OptionQuiPart,
  type Tri,
} from "../api"
import { Bouton, Libelle, Raison } from "./chassis"

/** Le tri de départ — **rien**. Il ne porte que des écarts, jamais un état
 *  complet : c'est ce qui fait qu'éteindre les trois lignes d'une ambiance
 *  rallume les textes du jeu d'eux-mêmes. */
export const TRI_VIDE: Tri = { eteints: [], allumes: [], textes: {} }

const NOM_DU_GROUPE: Record<string, string> = {
  jeu: "les textes du jeu",
  ambiance: "son ambiance",
  sujet: "le sujet",
  planche: "la planche",
}

export function EcranEnvoi({
  envoi,
  tri,
  onTri,
  onImage,
  onPayer,
  onFermer,
  onGarder,
  onSauter,
  onReprendre,
  refus,
}: {
  /** Ce que le serveur rend, `null` tant qu'il n'a pas répondu. L'écran dit
   *  alors qu'il ne sait pas encore, jamais un texte deviné. */
  envoi: Envoi | null
  tri: Tri
  onTri: (tri: Tri) => void
  /** **Une image se décoche par la portée de cette génération-là**, pas par le
   *  tri : cette portée existe depuis C1, elle décide seule quand elle a un
   *  avis, et deux listes qui écartent les mêmes images auraient fini par se
   *  contredire. */
  onImage: (asset: string, cochee: boolean) => void
  onPayer: () => void
  onFermer: () => void
  /** **Le second geste, nommé** : il écrit dans la fiche de la chose du jeu.
   *  Garder est possible ; ce n'est jamais un effet de bord. */
  onGarder: (ligne: LigneQuiPart) => void
  /** Sauter cet écran **pour la série en cours**. Il revient dès qu'on change
   *  de chose ou de pose : une case définitive éteindrait le seul écran qui
   *  montre ce qui part, et on la cocherait le premier jour.
   *
   *  **`null` quand il n'y a pas de série** — un texte écrit à la main, sans
   *  chose du jeu visée, n'a pas de suivant qui lui ressemble. La case ne
   *  paraît alors pas du tout. */
  onSauter: ((saute: boolean) => void) | null
  /** **Reprendre le texte à la main** (R2, US-159, US-160) : le champ reçoit
   *  l'assemblé et il part mot pour mot. Il vit ici depuis E14, sous le texte
   *  qu'on reprendrait — on ne reprend pas un texte qu'on ne voit pas. */
  onReprendre: (texte: string) => void
  refus: string | null
}) {
  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

  const basculer = (clef: string, allumee: boolean) =>
    onTri({
      ...tri,
      eteints: allumee
        ? [...tri.eteints.filter((c) => c !== clef), clef]
        : tri.eteints.filter((c) => c !== clef),
      allumes: allumee
        ? tri.allumes.filter((c) => c !== clef)
        : [...tri.allumes.filter((c) => c !== clef), clef],
    })

  const corriger = (clef: string, texte: string) =>
    onTri({ ...tri, textes: { ...tri.textes, [clef]: texte } })

  const remettre = (clef: string) => {
    const restant = { ...tri.textes }
    delete restant[clef]
    onTri({ ...tri, textes: restant })
  }

  const groupes = ["jeu", "ambiance", "sujet", "planche"] as const

  return (
    <div
      data-envoi
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px] bg-fond-0"
    >
      {/* ── Les groupes, et ce que chacun pèse ─────────────────────────────
          « 4 sur 7 » se lit ici : on sait qu'il y a quelque chose d'éteint
          avant d'être descendu jusqu'à lui. */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord p-4">
        <div className="flex items-baseline gap-2">
          <Libelle>ce qui part</Libelle>
          <button
            type="button"
            onClick={onFermer}
            title="Échap revient sans rien dépenser"
            className="mesure ml-auto px-1 text-[10px] text-texte-3 hover:text-texte"
          >
            ‹ revenir
          </button>
        </div>

        {refus && <Raison texte={refus} />}

        {envoi && (
          <>
            <ul className="flex flex-col">
              {envoi.groupes.map((groupe) => (
                <li
                  key={groupe.clef}
                  className="mesure flex h-[26px] items-center gap-2 text-[10px]"
                >
                  <span className="flex-1 truncate text-texte-2">
                    {groupe.nom}
                  </span>
                  <span className="text-texte">
                    {groupe.allumees} sur {groupe.total}
                  </span>
                </li>
              ))}
            </ul>

            {/* **Un compte qu'on voit sans descendre** : on a divergé, et de
                combien. */}
            {envoi.corrections > 0 && (
              <p className="mesure text-[10px] leading-4 text-epingle">
                {envoi.corrections} correction
                {envoi.corrections > 1 ? "s" : ""} pour cet appel
              </p>
            )}

            {/* ── Le sixième groupe, qui ne part pas ────────────────────────
                **Rien de tout ça ne part au modèle, et rien ne coûte un
                centime.** C'est montré parce que l'image qu'on verra revenir
                n'est pas celle que le modèle envoie, et qu'il vaut mieux le
                savoir avant que le savoir après. En gris, et c'est un mot du
                produit : *ce n'est pas de ça qu'on parle en ce moment*. */}
            {envoi.retour.length > 0 && (
              <section className="flex flex-col gap-1 border-t border-bord pt-4">
                <Libelle>ce qui se passe au retour</Libelle>
                <ul className="flex flex-col">
                  {envoi.retour.map((ligne) => (
                    <li
                      key={ligne.nom}
                      className="mesure flex h-[26px] items-center gap-2 text-[10px] text-texte-3"
                    >
                      <span className="flex-1 truncate">{ligne.nom}</span>
                      <span>{ligne.detail}</span>
                    </li>
                  ))}
                </ul>
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  sur la machine, après coup, et sans un centime. Ces réglages-là
                  se font dans les tables — une chose est réglée à un seul
                  endroit.
                </p>
              </section>
            )}
          </>
        )}
      </aside>

      {/* ── Une ligne par chose qui part ───────────────────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-5 overflow-y-auto p-5">
        {!envoi ? (
          <p className="mesure text-[10px] text-texte-3">…</p>
        ) : (
          groupes.map((groupe) => {
            const miennes = envoi.lignes.filter((l) => l.groupe === groupe)
            if (!miennes.length) return null
            return (
              <section key={groupe} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <Libelle>{NOM_DU_GROUPE[groupe]}</Libelle>
                  <span className="mesure text-[9.5px] text-texte-3">
                    {miennes.filter((l) => l.allumee).length} sur{" "}
                    {miennes.length}
                  </span>
                </div>
                <ul className="flex flex-col border-t border-bord">
                  {miennes.map((ligne) => (
                    <Ligne
                      key={ligne.clef}
                      ligne={ligne}
                      onBasculer={() => basculer(ligne.clef, ligne.allumee)}
                      onCorriger={(texte) => corriger(ligne.clef, texte)}
                      onRemettre={() => remettre(ligne.clef)}
                      onGarder={() => onGarder(ligne)}
                    />
                  ))}
                </ul>
              </section>
            )
          })
        )}

        {/* ── Les images jointes, et ce que chacune coûte ─────────────────── */}
        {envoi && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <Libelle>les images jointes</Libelle>
              <span className="mesure text-[9.5px] text-texte-3">
                {envoi.images.cochees} cochée
                {envoi.images.cochees > 1 ? "s" : ""}
                {envoi.prix.images !== null && (
                  <>
                    {" · "}
                    <span className="text-epingle">
                      {dollars(envoi.prix.images)}
                    </span>
                    {envoi.prix.total !== null && ` des ${dollars(envoi.prix.total)}`}
                  </>
                )}
                {envoi.images.places > 0 &&
                  ` · ${envoi.images.places} places sur ce modèle`}
              </span>
            </div>
            {envoi.images.lignes.length === 0 &&
            !envoi.images.gabarit &&
            !envoi.images.palette ? (
              <p className="mesure text-[10px] leading-4 text-texte-3">
                aucune image ne part avec cet appel.
              </p>
            ) : (
              <ul className="flex flex-col border-t border-bord">
                {envoi.images.lignes.map((image) => (
                  <LigneImage
                    key={image.asset}
                    image={image}
                    onBasculer={() => onImage(image.asset, image.cochee)}
                  />
                ))}
              </ul>
            )}
            {/* **Ce qui part et ne se décoche pas**, avec sa raison : décocher
                le gabarit reviendrait à demander une planche sans dire à quoi
                elle ressemble. */}
            {envoi.images.gabarit > 0 && (
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                + le gabarit de la grille, qui dit au modèle où poser les{" "}
                {envoi.cases} sujets. Il ne se décoche pas — une planche sans lui
                ne dit pas à quoi elle ressemble — et il compte dans les places.
              </p>
            )}
            {/* **La palette compte dans le total, elle doit donc se voir ici.**
                Sans cette ligne, l'en-tête annonçait « 1 cochée » au-dessus d'une
                liste vide : le compte était juste et l'image introuvable. Elle se
                décoche là où elle se coche, dans les options — une chose se règle
                à un seul endroit. */}
            {envoi.images.palette > 0 && (
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                + la bande des couleurs du jeu, cochée dans les options plus bas.
                Elle compte dans les places du modèle, et dans le prix.
              </p>
            )}
          </section>
        )}

        {/* ── Les options que le modèle sait faire ─────────────────────────── */}
        {envoi && envoi.options.length > 0 && (
          <section className="flex flex-col gap-2">
            <Libelle>les options</Libelle>
            <ul className="flex flex-col border-t border-bord">
              {envoi.options.map((option) => (
                <LigneOption
                  key={option.clef}
                  option={option}
                  onBasculer={() => basculer(option.clef, option.allumee)}
                />
              ))}
            </ul>
          </section>
        )}
      </section>

      {/* ── Ce qui part, mot pour mot ──────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-bord p-4">
        <Libelle>ce qui part, mot pour mot</Libelle>
        {envoi && (
          <>
            <p className="mesure whitespace-pre-wrap rounded-[2px] border border-bord bg-fond-2 p-2 text-[10.5px] leading-[1.45] text-texte-2">
              {envoi.texte || "rien encore — écris un sujet"}
            </p>

            {/* **Reprendre pose le texte exact, et rien d'autre** (US-159) :
                l'univers n'est pas touché, la bible reste ce qu'elle est. C'est
                la différence entre corriger une formulation et démonter son
                projet. */}
            <button
              type="button"
              onClick={() => onReprendre(envoi.texte)}
              disabled={!envoi.texte}
              className="mesure h-[26px] self-start text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
            >
              Reprendre le texte ›
            </button>

            <p className="mesure text-[9.5px] leading-4 text-texte-3">
              {envoi.caracteres.total} caractères ·{" "}
              {envoi.images.cochees} image{envoi.images.cochees > 1 ? "s" : ""}{" "}
              jointe{envoi.images.cochees > 1 ? "s" : ""}
              {envoi.caracteres.total > 0 && (
                <>
                  <br />
                  le sujet pèse{" "}
                  <span className="text-texte-2">
                    {envoi.caracteres.sujet} car.
                  </span>
                  , soit{" "}
                  {Math.round(
                    (envoi.caracteres.sujet / envoi.caracteres.total) * 100,
                  )}{" "}
                  %
                </>
              )}
              {envoi.caracteres.eteints > 0 && (
                <>
                  <br />
                  {envoi.caracteres.eteints} caractères éteints à la main
                </>
              )}
            </p>

            {/* **Le compte des avertissements, repris ici** : on sait qu'il y en
                a même sans être descendu jusqu'à eux — et chacun est écrit sur
                sa ligne, jamais en bandeau. */}
            {envoi.avertissements.length > 0 && (
              <p className="mesure text-[9.5px] leading-4 text-epingle">
                {envoi.avertissements.length} avertissement
                {envoi.avertissements.length > 1 ? "s" : ""} — non bloquant
                {envoi.avertissements.length > 1 ? "s" : ""}, écrit
                {envoi.avertissements.length > 1 ? "s" : ""} sur la ligne
                concernée
              </p>
            )}

            {envoi.cases > 1 && (
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                {envoi.cases} cases sur 1 planche — un compte faux ne fait rien
                entrer, et la planche entière se relance au prix plein.
              </p>
            )}

            {/* ── Le prix, et la mesure qui le porte ───────────────────────── */}
            <section className="flex flex-col gap-1.5 border-t border-bord pt-4">
              {envoi.prix.mesure.prix === null ? (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  ce modèle n'a encore rien facturé sur cette machine — le prix
                  reste inconnu plutôt que deviné.
                </p>
              ) : (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  mesuré sur {envoi.prix.mesure.appels} appel
                  {envoi.prix.mesure.appels > 1 ? "s" : ""} payé
                  {envoi.prix.mesure.appels > 1 ? "s" : ""} à{" "}
                  <span className="text-texte-2">{envoi.modele.nom}</span>.
                  {envoi.prix.mesure.par_image !== null &&
                    envoi.prix.mesure.base !== null && (
                      <>
                        {" "}
                        Un appel sans image jointe a coûté{" "}
                        {dollars(envoi.prix.mesure.base)} sur{" "}
                        {envoi.prix.mesure.sur_base} appels ; chaque image
                        jointe en ajoute{" "}
                        <span className="text-epingle">
                          {dollars(envoi.prix.mesure.par_image)}
                        </span>
                        , mesuré sur {envoi.prix.mesure.sur_jointes}. Une moyenne
                        n'est le prix de personne : elle ne tombera juste sur
                        aucun appel donné.
                      </>
                    )}
                  {envoi.prix.mesure.par_image === null && (
                    <>
                      {" "}
                      Le pas d'une image jointe n'est pas mesurable ici — il y
                      faudrait des appels à plusieurs comptes d'images. Le prix
                      affiché est la médiane, images comprises.
                    </>
                  )}
                </p>
              )}

              <Bouton
                principal
                inactif={Boolean(refus) || !envoi}
                onClick={onPayer}
                enfants={
                  refus
                    ? refus
                    : envoi.prix.total !== null
                      ? `Payer et lancer ${dollars(envoi.prix.total)}`
                      : "Payer et lancer"
                }
              />
              <button
                type="button"
                onClick={onFermer}
                className="mesure h-[26px] text-[10px] text-texte-3 hover:text-texte-2"
              >
                Revenir sans rien dépenser
              </button>
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                rien n'est dépensé tant que le bouton n'est pas pressé.
              </p>

              {/* **Il s'évite, et jamais pour toujours.** Quand on refait dix
                  fois la même chose, relire dix fois est une punition ; mais une
                  case définitive éteindrait le seul écran qui montre ce qui
                  part, et on la cocherait le premier jour, quand on ne sait pas
                  encore qu'on en aura besoin.

                  **Et pas de case du tout quand il n'y a pas de série** —
                  corrigé le 31 août 2026, sur un bug signalé par l'auteur qui
                  coûtait de l'argent à chaque clic. Une série est *une chose et
                  une pose* ; sans chose du jeu, chaque texte est écrit à la main
                  et n'a rien à voir avec le précédent. Offrir la case là
                  revenait à proposer d'éteindre l'écran pour toutes les
                  générations libres à venir, dans tous les jeux — c'est-à-dire
                  exactement la case « pour toujours » que le produit refuse. */}
              {onSauter && (
                <>
                  <label className="mesure flex cursor-pointer items-center gap-2 pt-1 text-[10px] text-texte-3 hover:text-texte-2">
                    <input
                      type="checkbox"
                      onChange={(e) => onSauter(e.target.checked)}
                      className="h-3 w-3 accent-signal"
                    />
                    <span>ne plus me le montrer pour cette série</span>
                  </label>
                  <p className="mesure text-[9.5px] leading-4 text-texte-3">
                    il revient dès qu'on change de chose ou de pose. Il n'y a pas
                    de case « pour toujours ».
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  )
}

/** Une chose qui part : son interrupteur, son nom, son texte, son origine.
 *
 *  **Toutes les lignes ont la même forme**, quel que soit ce qu'elles portent :
 *  c'est ce qui permet de descendre l'écran sans réapprendre à lire à chaque
 *  groupe. L'interrupteur est tout à gauche, donc tous alignés en colonne — on
 *  descend et on éteint, sans viser. */
function Ligne({
  ligne,
  onBasculer,
  onCorriger,
  onRemettre,
  onGarder,
}: {
  ligne: LigneQuiPart
  onBasculer: () => void
  onCorriger: (texte: string) => void
  onRemettre: () => void
  onGarder: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ouvert) champ.current?.focus()
  }, [ouvert])

  const remplacee = Boolean(ligne.remplacee_par)

  return (
    <li className="flex items-start gap-3 border-b border-bord py-2">
      {/* **Le carré, et aucun glyphe neuf.** Plein : cette chose part. Creux :
          elle ne part pas. Gris : elle part et ne se décoche pas. */}
      <button
        type="button"
        disabled={!ligne.eteignable}
        onClick={onBasculer}
        aria-pressed={ligne.allumee}
        aria-label={`${ligne.allumee ? "Éteindre" : "Allumer"} ${ligne.nom}`}
        title={
          ligne.eteignable
            ? ligne.allumee
              ? "cette chose part"
              : remplacee
                ? "remplacée par la ligne du dessous"
                : "cette chose ne part pas"
            : ligne.raison
        }
        className="mt-[3px] flex h-[9px] w-[9px] shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            !ligne.eteignable
              ? "border-texte-3 bg-texte-3"
              : ligne.allumee
                ? "border-signal bg-signal"
                : "border-bord-fort",
          ].join(" ")}
        />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <div className="flex items-baseline gap-2">
          <span className="mesure text-[9.5px] uppercase tracking-[.11em] text-texte-3">
            {ligne.nom}
          </span>
          <span className="mesure text-[9.5px] text-texte-3">
            {ligne.corrigee ? "corrigé pour cet appel" : ligne.origine}
          </span>
          {remplacee && (
            <span className="mesure text-[9.5px] text-texte-3">remplacé ↓</span>
          )}
          {!ligne.eteignable && ligne.raison && (
            <span className="mesure text-[9.5px] text-texte-3">
              · {ligne.raison}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {ligne.corrigee && (
              <button
                type="button"
                onClick={onRemettre}
                className="mesure text-[10px] text-signal hover:text-signal-clair"
              >
                remettre
              </button>
            )}
            {/* **Garder est un second geste, écrit** — jamais un effet de
                bord. Il n'est proposé que là où il a une case où aller. */}
            {ligne.corrigee && ligne.gardable && (
              <button
                type="button"
                onClick={onGarder}
                className="mesure text-[10px] text-signal hover:text-signal-clair"
              >
                garder sur la chose ›
              </button>
            )}
            <button
              type="button"
              onClick={() => setOuvert((o) => !o)}
              className="mesure text-[10px] text-signal hover:text-signal-clair"
            >
              {ouvert ? "fermer" : "corriger"}
            </button>
          </span>
        </div>

        {ouvert ? (
          <textarea
            ref={champ}
            value={ligne.texte}
            onChange={(e) => onCorriger(e.target.value)}
            rows={2}
            aria-label={`Corriger ${ligne.nom}`}
            className="mesure min-h-[44px] resize-y rounded-[2px] border border-signal bg-fond-2 px-2 py-1 text-[10.5px] leading-[1.45] text-texte"
          />
        ) : (
          /* **Le texte entier, exact, sans coupure et sans résumé.** Un texte
             tronqué par des points de suspension trahirait la règle la plus
             ancienne du produit sur l'écran qui existe justement pour la
             tenir. */
          <p
            className={[
              "mesure whitespace-pre-wrap text-[10.5px] leading-[1.45]",
              ligne.allumee ? "text-texte-2" : "text-texte-3 line-through",
            ].join(" ")}
          >
            {ligne.texte}
          </p>
        )}

        {ligne.remplace && (
          <p className="mesure text-[9.5px] leading-4 text-texte-3 line-through">
            {ligne.remplace}
          </p>
        )}

        {/* **L'avertissement s'écrit sur la ligne fautive, pas en haut de
            l'écran.** Une bannière dirait « attention, deux problèmes » et
            laisserait chercher lesquels ; la ligne dit lequel, et le bouton pour
            le réparer est déjà à côté. */}
        {ligne.avertissement && (
          <p className="mesure text-[9.5px] leading-4 text-epingle">
            ⚠ {ligne.avertissement}
          </p>
        )}
      </div>
    </li>
  )
}

/** Une image jointe : son interrupteur, sa provenance, son prix.
 *
 *  **Le prix s'écrit sur la ligne où l'on coche**, en doré comme tout écart du
 *  produit. Une case éteinte le garde en gris : c'est ce qu'elle coûterait si on
 *  la rallumait. */
function LigneImage({
  image,
  onBasculer,
}: {
  image: ImageQuiPart
  onBasculer: () => void
}) {
  return (
    <li className="flex items-center gap-3 border-b border-bord py-2">
      <button
        type="button"
        onClick={onBasculer}
        aria-pressed={image.cochee}
        aria-label={`${image.cochee ? "Décocher" : "Cocher"} ${image.provenance}`}
        className="flex h-[9px] w-[9px] shrink-0 items-center justify-center"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            image.cochee ? "border-signal bg-signal" : "border-bord-fort",
          ].join(" ")}
        />
      </button>
      <span className="mesure min-w-0 flex-1 truncate text-[10px] text-texte-2">
        {image.provenance}
        {image.ecartee_par && (
          <span className="text-texte-3"> · {image.ecartee_par}</span>
        )}
        {image.hors_plafond && (
          <span className="text-epingle"> · au-delà des places du modèle</span>
        )}
      </span>
      {image.prix !== null && (
        <span
          className={[
            "mesure text-[10px]",
            image.cochee ? "text-epingle" : "text-texte-3",
          ].join(" ")}
        >
          +{dollars(image.prix)}
        </span>
      )}
    </li>
  )
}

/** Une option du modèle. **Grisée avec sa raison quand il ne sait pas la
 *  faire**, jamais absente : l'absence n'apprend rien, le grisé apprend
 *  pourquoi. */
function LigneOption({
  option,
  onBasculer,
}: {
  option: OptionQuiPart
  onBasculer: () => void
}) {
  return (
    <li
      className={[
        "flex items-start gap-3 border-b py-2",
        option.refus ? "border-dashed border-bord" : "border-bord",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={Boolean(option.refus)}
        onClick={onBasculer}
        aria-pressed={option.allumee}
        aria-label={`${option.allumee ? "Décocher" : "Cocher"} ${option.nom}`}
        className="mt-[3px] flex h-[9px] w-[9px] shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={[
            "block h-[9px] w-[9px] rounded-[1px] border",
            option.refus
              ? "border-texte-3"
              : option.allumee
                ? "border-signal bg-signal"
                : "border-bord-fort",
          ].join(" ")}
        />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <div className="flex items-baseline gap-2">
          <span className="mesure text-[9.5px] uppercase tracking-[.11em] text-texte-3">
            {option.nom}
          </span>
          <span className="mesure text-[9.5px] text-texte-3">
            {option.detail}
          </span>
        </div>
        <p className="mesure text-[10.5px] leading-[1.45] text-texte-2">
          {option.texte}
        </p>
        {option.refus && <Raison texte={`indisponible : ${option.refus}`} />}
      </div>
    </li>
  )
}
