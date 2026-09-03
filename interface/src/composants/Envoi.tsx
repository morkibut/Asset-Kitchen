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
// **L'invariant a été amendé le 1ᵉʳ septembre 2026 (U9), et il l'est aux trois
// endroits où il vit** — ici, dans `docs/carte-du-depot.md` et dans
// `docs/maquettes-v2.1/08bis-ecran-de-confirmation.html`. Corrigé à un seul, il
// serait devenu une contradiction. Il disait *sans coupure et sans résumé*, et
// la séance a montré la limite : le texte réellement employé dans ce dépôt fait
// plus de mille deux cents caractères, et un écran qu'on doit parcourir d'un
// coup d'œil avant de payer ne le fait pas quand une seule ligne l'occupe tout
// entier. Ce qui le remplace est plus fort que lui : **rien n'est résumé, rien
// n'est réécrit, et tout est atteignable en un clic depuis l'endroit où on le
// lit.** Un long texte se replie, le bouton du pli dit combien de caractères il
// cache, et le déplier rend le texte entier — ce n'est pas une troncature
// muette, c'est un pli qu'on ouvre. Et chaque image jointe porte **sa
// vignette** : la barre d'espace l'ouvre en grand, du même geste que partout
// ailleurs dans le produit.
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
  estArgent,
  quantite,
  type Envoi,
  type ImageQuiPart,
  type LigneQuiPart,
  type OptionQuiPart,
  type Tri,
} from "../api"
import { Bouton, Libelle, LigneReserve, Raison } from "./chassis"
import { sujetAsset, sujetCarte, useVisee, vignetteAsset } from "./Apercu"

/** Le tri de départ — **rien**. Il ne porte que des écarts, jamais un état
 *  complet : c'est ce qui fait qu'éteindre les trois lignes d'une ambiance
 *  rallume les textes du jeu d'eux-mêmes. */
export const TRI_VIDE: Tri = { eteints: [], allumes: [], textes: {}, fond: null }

/** Le nom français d'un groupe de lignes.
 *
 *  **Deux manquaient** — `jointes` et `cadrage`, rendus depuis le
 *  1ᵉʳ septembre 2026 : leurs sections s'affichaient sans titre, et personne ne
 *  l'avait vu parce que le titre absent ne laisse pas de trou, il laisse un
 *  blanc. Trouvé en construisant R7, en cherchant où poser les parties. */
const NOM_DU_GROUPE: Record<string, string> = {
  jeu: "les textes du jeu",
  ambiance: "son ambiance",
  sujet: "le sujet",
  planche: "la planche",
  jointes: "ce que les images disent",
  cadrage: "la caméra",
}

/** Les groupes de chaque partie, **dans l'ordre où le texte les assemble** (R7).
 *
 *  C'est la table `DE_LA_PARTIE` du domaine, lue à l'envers : là-bas un groupe
 *  dit sa partie, ici une partie dit ses groupes. Elle est recopiée plutôt
 *  qu'appelée parce que l'écran n'a pas de serveur sous la main pour dessiner
 *  ses sections — et chaque ligne rendue porte, elle, la partie que le serveur
 *  lui a donnée : si les deux divergeaient, une section resterait vide et ça se
 *  verrait au premier coup d'œil. */
const GROUPES_DE_LA_PARTIE: Record<string, readonly string[]> = {
  contexte: ["jeu", "ambiance"],
  references: ["jointes"],
  demande: ["sujet", "planche", "cadrage"],
}

export function EcranEnvoi({
  envoi,
  tri,
  onTri,
  onImage,
  onPayer,
  enPaiement = false,
  echec = null,
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
  /** **L'appel est parti, on attend** (U1). Le bouton le dit et cesse d'être
   *  cliquable ; il ne le redevient que si l'appel échoue, puisqu'une réussite
   *  referme l'écran. Cinq clics rapides lançaient cinq appels payants. */
  enPaiement?: boolean
  /** **Ce que le dernier appel a répondu quand il n'est pas passé** (U1).
   *  Distinct de `refus`, qui empêche de partir : celui-ci dit qu'on est parti
   *  et qu'on est revenu sans image, et le bouton reste vivant — ce qu'on veut
   *  faire d'un appel raté est le refaire. */
  echec?: string | null
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

  // **L'ordre est celui de l'assemblage**, et depuis R7 il se lit en trois
  // parties : le contexte, les références, la demande. On lit de haut en bas ce
  // qui part de gauche à droite, et les titres de l'écran sont ceux que le
  // fournisseur reçoit — traduits une fois, ici, comme les intitulés de la
  // bible.
  //
  // **Les parties viennent du serveur**, qui les compose en même temps que le
  // texte : l'écran ne fait que les afficher dans l'ordre où elles arrivent. Il
  // garde en revanche la table des groupes de chaque partie, parce que le
  // milieu de l'écran range des *lignes* — celles qu'on éteint et qu'on corrige
  // — et non des paragraphes.
  const parties = envoi?.parties ?? []

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
            {/* **Le sommaire suit les trois parties** (R7) : on y lit d'abord
                à quoi sert ce qui part, puis d'où chaque morceau vient. Les
                groupes qu'aucune partie rendue ne réclame — il n'y en a pas
                aujourd'hui — resteraient invisibles, et c'est le seul cas où le
                sommaire mentirait ; le repli en fin de liste les rattrape. */}
            <ul className="flex flex-col">
              {parties.map((partie) => {
                const siens = envoi.groupes.filter(
                  (g) => g.partie === partie.clef,
                )
                if (!siens.length) return null
                return (
                  <li key={partie.clef} className="flex flex-col">
                    <span className="mesure mt-2 flex h-[22px] items-center text-[9.5px] tracking-[.11em] text-texte-3 uppercase first:mt-0">
                      {partie.nom}
                    </span>
                    <ul className="flex flex-col">
                      {siens.map((groupe) => (
                        <li
                          key={groupe.clef}
                          className="mesure flex h-[26px] items-center gap-2 pl-2 text-[10px]"
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
                  </li>
                )
              })}
              {envoi.groupes
                .filter(
                  (g) => !parties.some((p) => p.clef === g.partie),
                )
                .map((groupe) => (
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
          parties.map((partie) => {
            const groupes = partie.repris
              ? ["sujet"]
              : (GROUPES_DE_LA_PARTIE[partie.clef] ?? [])
            const dedans = groupes.filter((groupe) =>
              envoi.lignes.some((l) => l.groupe === groupe),
            )
            if (!dedans.length) return null
            return (
              // **La partie porte son titre et son propos, puis ses groupes.**
              // Le titre est celui que le fournisseur reçoit, écrit en mono
              // juste après le nom français : c'est un fait sur ce qui part, pas
              // un libellé, et le produit écrit les faits dans la police des
              // chiffres.
              <section
                key={partie.clef}
                data-partie={partie.clef}
                className="flex flex-col gap-3 border-t border-bord-fort pt-4 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <Libelle>{partie.nom}</Libelle>
                    {partie.titre && (
                      <span className="mesure text-[9.5px] text-texte-3">
                        part sous « {partie.titre} »
                      </span>
                    )}
                  </div>
                  <p className="mesure text-[10px] leading-4 text-texte-2">
                    {partie.propos}
                  </p>
                </div>
                {dedans.map((groupe) => {
                  const miennes = envoi.lignes.filter(
                    (l) => l.groupe === groupe,
                  )
                  return (
                    <div key={groupe} className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <Libelle>{NOM_DU_GROUPE[groupe] ?? groupe}</Libelle>
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
                    </div>
                  )
                })}
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
                {/* **La part des images, dans l'unité de l'appel** (F2). Chez
                    un fournisseur qui ne facture pas, une image jointe n'ajoute
                    aucun dollar — mais l'écran ne doit pas pour autant écrire
                    « $0,0000 », qui se lit *sans limite*. */}
                {envoi.prix.images !== null && (
                  <>
                    {" · "}
                    <span className="text-epingle">
                      {quantite(envoi.prix.images, envoi.prix.mesure.unite)}
                    </span>
                    {envoi.prix.total !== null &&
                      ` des ${quantite(envoi.prix.total, envoi.prix.mesure.unite)}`}
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
                    places={envoi.images.places}
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
                {envoi.images.rang_gabarit !== null &&
                  `Image ${envoi.images.rang_gabarit} · `}
                le gabarit de la grille, qui dit au modèle où poser les{" "}
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
                {envoi.images.rang_palette !== null &&
                  `Image ${envoi.images.rang_palette} · `}
                la bande des couleurs du jeu, cochée dans les options plus bas.
                Elle compte dans les places du modèle, et dans le prix.
              </p>
            )}
            {/* **Ce que les images ont à dire, écrit là où elles sont** — et
                c'était un trou. L'en-tête de l'écran annonce « N avertissements,
                écrits sur la ligne concernée » ; les avertissements du bloc
                d'images n'ont pas de ligne de prompt à eux, et n'étaient donc
                **comptés nulle part visible**. On lisait « 1 avertissement » et
                l'on cherchait où. Trouvé en regardant l'écran chez un modèle
                sans places (F6) ; les deux autres — *aucune image jointe*, *14
                places pour 16 cochées* — l'attendaient depuis E14. */}
            {envoi.images.avertissements.map((a) => (
              <p
                key={a.clef}
                className="mesure text-[9.5px] leading-4 text-epingle"
              >
                ⚠ {a.texte}
              </p>
            ))}
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

        {/* ── Le fond, corrigeable avant de payer ──────────────────────────── */}
        {envoi && (
          <SectionFond
            fond={envoi.fond}
            onFond={(couleur) => onTri({ ...tri, fond: couleur })}
          />
        )}
      </section>

      {/* ── Ce qui part, mot pour mot ──────────────────────────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-bord p-4">
        <Libelle>ce qui part, mot pour mot</Libelle>
        {envoi && (
          <>
            {/* **Le pavé se coupe là où le texte se coupe** (R7). C'était un
                seul bloc de mille deux cents caractères ; ce sont maintenant
                trois blocs, chacun sous le titre que le fournisseur reçoit —
                et le titre est écrit **dans** le bloc, en tête, parce qu'il
                part avec. Rien n'est résumé, rien n'est réécrit, et recoller
                les blocs dans l'ordre rend exactement `envoi.texte`. */}
            {parties.every((p) => !p.texte.trim()) ? (
              <p className="mesure rounded-[2px] border border-bord bg-fond-2 p-2 text-[10.5px] leading-[1.45] text-texte-3">
                rien encore — écris un sujet
              </p>
            ) : (
              parties
                .filter((partie) => partie.texte.trim())
                .map((partie) => (
                  <div key={partie.clef} className="flex flex-col gap-1">
                    <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
                      {partie.nom}
                    </span>
                    <p
                      data-partie-qui-part={partie.clef}
                      className="mesure whitespace-pre-wrap rounded-[2px] border border-bord bg-fond-2 p-2 text-[10.5px] leading-[1.45] text-texte-2"
                    >
                      {partie.titre && (
                        <span className="text-texte-3">
                          {partie.titre}
                          {"\n\n"}
                        </span>
                      )}
                      {partie.texte}
                    </p>
                  </div>
                ))
            )}

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
              {/* **Ce qui reste chez ce fournisseur, avant de partir** (F2).
                  Le même objet que l'écran où l'on choisit lit : deux calculs à
                  deux endroits ont déjà annoncé deux chiffres pour le même
                  appel, à trois centimètres l'un de l'autre (E13). */}
              {envoi.reserve && <LigneReserve reserve={envoi.reserve} />}

              {envoi.prix.mesure.prix === null ? (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  {estArgent(envoi.prix.mesure.unite)
                    ? "ce modèle n'a encore rien facturé sur cette machine — le prix reste inconnu plutôt que deviné."
                    : "ce modèle n'a encore rien consommé sur cette machine — ce qu'il prendra reste inconnu plutôt que deviné."}
                </p>
              ) : (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  mesuré sur {envoi.prix.mesure.appels} appel
                  {envoi.prix.mesure.appels > 1 ? "s" : ""}{" "}
                  {estArgent(envoi.prix.mesure.unite) ? "payé" : "passé"}
                  {envoi.prix.mesure.appels > 1 ? "s" : ""} à{" "}
                  <span className="text-texte-2">{envoi.modele.nom}</span>.
                  {envoi.prix.mesure.par_image !== null &&
                    envoi.prix.mesure.base !== null && (
                      <>
                        {" "}
                        Un appel sans image jointe a{" "}
                        {estArgent(envoi.prix.mesure.unite) ? "coûté" : "pris"}{" "}
                        {quantite(envoi.prix.mesure.base, envoi.prix.mesure.unite)}{" "}
                        sur {envoi.prix.mesure.sur_base} appels ; chaque image
                        jointe en ajoute{" "}
                        <span className="text-epingle">
                          {quantite(
                            envoi.prix.mesure.par_image,
                            envoi.prix.mesure.unite,
                          )}
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
                      faudrait des appels à plusieurs comptes d'images. Le
                      chiffre affiché est la médiane, images comprises.
                    </>
                  )}
                </p>
              )}

              {/* **L'appel raté se lit à l'endroit où l'on a cliqué**, et il ne
                  grise rien : c'est le seul état de l'écran d'où le bon geste
                  est de recommencer. */}
              {echec && (
                <p className="mesure text-[10px] leading-4 text-echec">
                  {echec} — rien n'a été facturé, on peut relancer.
                </p>
              )}
              {/* **Le bouton qui paie refuse le second clic** (U1). Le mot
                  change autant que l'état : un bouton grisé qui garde son
                  libellé se lit comme un refus, alors que c'est une attente. */}
              <Bouton
                principal
                inactif={Boolean(refus) || !envoi || enPaiement}
                onClick={onPayer}
                enfants={
                  refus
                    ? refus
                    : enPaiement
                      ? "Paiement en cours…"
                      : envoi.prix.total !== null
                        ? estArgent(envoi.prix.mesure.unite)
                          ? `Payer et lancer ${dollars(envoi.prix.total)}`
                          : `Lancer — gratuit, ${quantite(
                              envoi.prix.total,
                              envoi.prix.mesure.unite,
                            )}`
                        : estArgent(envoi.prix.mesure.unite)
                          ? "Payer et lancer"
                          : "Lancer — gratuit"
                }
              />
              <button
                type="button"
                onClick={onFermer}
                disabled={enPaiement}
                className="mesure h-[26px] text-[10px] text-texte-3 hover:text-texte-2 disabled:cursor-not-allowed disabled:hover:text-texte-3"
              >
                {enPaiement
                  ? "l'appel est parti — il ne se rattrape plus"
                  : "Revenir sans rien dépenser"}
              </button>
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                rien n'est consommé tant que le bouton n'est pas pressé.
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

/** **Le fond, et ce qu'il interdit — corrigeable jusqu'au dernier moment** (D3).
 *
 *  **Pourquoi une section et pas une ligne.** Tout le reste de cet écran est une
 *  ligne de texte avec son interrupteur ; le fond n'en est pas une. C'est un
 *  réglage du jeu qui *fabrique* une ligne — la phrase de calage, qu'on lit plus
 *  haut dans « les textes du jeu » — **et** qui fabrique en plus l'interdiction,
 *  laquelle part dans un autre champ de la demande. Le corriger en tapant dans
 *  la ligne aurait changé l'une sans l'autre : l'appel serait parti en demandant
 *  un fond magenta tout en interdisant le cyan, sans que rien ne le dise.
 *
 *  **L'interdiction est montrée ici parce qu'elle ne peut être montrée nulle
 *  part ailleurs.** Elle est le seul morceau de ce qui part que le texte ne
 *  contient pas — les adaptateurs la replient en fin de demande sous *« Do not
 *  include: »*. Sans ce bloc, l'écran qui promet de tout montrer aurait un angle
 *  mort, et ce serait celui que la tranche vient d'ouvrir.
 *
 *  **La correction ne remonte nulle part**, comme tout ce que cet écran renvoie.
 *  Poser le fond durablement est un second geste, qui passe par le codex — la
 *  même règle que « garder cette correction » sur une ligne de texte. */
function SectionFond({
  fond,
  onFond,
}: {
  fond: Envoi["fond"]
  onFond: (couleur: string | null) => void
}) {
  const propose = fond.propose
  return (
    <section className="flex flex-col gap-2">
      <Libelle>le fond</Libelle>
      <div className="flex flex-col gap-2 border-t border-bord pt-2">
        <div className="flex items-center gap-2">
          {/* ⚠️ **Le damier quand il n'y a pas de fond**, la même correction
              qu'au codex et pour la même raison : un `input type=color` n'a pas
              d'état vide, il portait donc une pastille magenta juste à côté des
              mots « aucun fond ». Le sélecteur reste dessous, transparent — sans
              lui, un appel sans fond ne pourrait plus en reprendre un. */}
          {fond.couleur ? (
            <input
              type="color"
              value={fond.couleur}
              aria-label="Couleur du fond, pour cet appel"
              onChange={(e) => onFond(e.target.value)}
              className="h-[26px] w-[34px] shrink-0 rounded-[2px] border border-bord bg-fond-2"
            />
          ) : (
            <span className="damier relative h-[26px] w-[34px] shrink-0 overflow-hidden rounded-[2px] border border-bord">
              <input
                type="color"
                value={propose.couleur || "#FF00FF"}
                aria-label="Couleur du fond, pour cet appel"
                onChange={(e) => onFond(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
          )}
          <span className="mesure text-[10px] text-texte-2">
            {fond.couleur || "aucun fond — le modèle rendra ce qu'il voudra"}
          </span>
          {/* **Remettre celui du jeu, et retirer le fond, sont deux gestes** :
              l'un annule la correction, l'autre en est une. Les confondre aurait
              rendu « pas de fond pour cet essai » impossible à demander sur un
              jeu qui en a un. */}
          {fond.corrige && (
            <button
              type="button"
              onClick={() => onFond(null)}
              className="mesure h-[26px] text-[10px] text-texte-3 hover:text-texte"
            >
              Remettre celui du jeu
            </button>
          )}
          {!fond.corrige && fond.couleur !== "" && (
            <button
              type="button"
              onClick={() => onFond("")}
              className="mesure h-[26px] text-[10px] text-texte-3 hover:text-texte"
            >
              Sans fond
            </button>
          )}
        </div>

        {fond.corrige && (
          <Raison texte="corrigé pour cet appel seulement — le jeu garde le sien" />
        )}

        {/* **La proposition n'apparaît que si elle ajoute quelque chose** : la
            reproposer quand elle est déjà prise ferait cliquer sur ce qu'on a
            déjà. */}
        {propose.couleur && propose.couleur !== fond.couleur && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFond(propose.couleur)}
              style={{ background: propose.couleur }}
              aria-label={`Prendre ${propose.couleur}`}
              className="h-4 w-4 shrink-0 rounded-[2px] border border-bord"
            />
            <button
              type="button"
              onClick={() => onFond(propose.couleur)}
              className="mesure text-[10px] text-signal hover:text-signal-clair"
            >
              Prendre {propose.nom || propose.couleur}
            </button>
            <span className="mesure text-[10px] text-texte-3">
              à {propose.ecart} de {propose.voisine}
            </span>
          </div>
        )}

        {/* **Ce qui part dans l'autre champ**, mot pour mot et sans repli : il
            fait deux lignes, pas mille deux cents caractères. */}
        {fond.interdiction ? (
          <div className="flex flex-col gap-1">
            <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
              ce qui part en interdiction
            </span>
            <p className="mesure whitespace-pre-wrap rounded-[2px] border border-bord bg-fond-2 p-2 text-[10.5px] leading-[1.45] text-texte-2">
              {fond.interdiction}
            </p>
          </div>
        ) : (
          <Raison texte="rien n'est interdit à ce modèle — pose un fond, et la couleur lui sera interdite sur le sujet" />
        )}
      </div>
    </section>
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
          <TexteQuiPart texte={ligne.texte} allumee={ligne.allumee} />
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

/** Le texte d'une ligne — **entier, jamais résumé, et replié quand il est long**
 *  (U9, 1ᵉʳ septembre 2026).
 *
 *  **L'invariant est amendé, et l'amendement est écrit.** La règle disait *mot
 *  pour mot, sans coupure et sans résumé — des points de suspension trahiraient
 *  la règle que cet écran existe pour tenir*. Elle tenait tant qu'un texte
 *  faisait quelques lignes ; le prompt réellement employé dans ce dépôt fait
 *  plus de mille deux cents caractères, et un écran qui doit se parcourir d'un
 *  coup d'œil avant de payer ne le fait pas quand une seule ligne occupe tout.
 *
 *  **Ce qui remplace la promesse est plus fort qu'elle** : *rien n'est résumé,
 *  rien n'est réécrit, et tout est atteignable en un clic depuis l'endroit où on
 *  le lit.* Le repli est visible, son bouton dit combien de caractères il cache,
 *  et il se referme. Ce n'est pas une troncature muette — c'est un pli qu'on
 *  ouvre. La phrase d'origine est réécrite aux trois endroits où elle vit : ici,
 *  dans `docs/carte-du-depot.md` et dans
 *  `docs/maquettes-v2.1/08bis-ecran-de-confirmation.html`.
 */
const LONG = 320

function TexteQuiPart({ texte, allumee }: { texte: string; allumee: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const long = texte.length > LONG
  // **La coupure tombe sur une fin de mot**, jamais au milieu d'un : un pli qui
  // couperait « pixe » ferait douter de ce qu'il cache, et c'est exactement ce
  // que le pli ne doit pas faire.
  const coupe = long && !ouvert
  const debut = coupe
    ? texte.slice(0, texte.lastIndexOf(" ", LONG) > 0 ? texte.lastIndexOf(" ", LONG) : LONG)
    : texte

  return (
    <div className="flex flex-col gap-1">
      <p
        data-texte-qui-part
        className={[
          "mesure whitespace-pre-wrap text-[10.5px] leading-[1.45]",
          allumee ? "text-texte-2" : "text-texte-3 line-through",
        ].join(" ")}
      >
        {debut}
        {coupe && <span className="text-texte-3"> …</span>}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
        >
          {ouvert
            ? "replier"
            : `déplier — ${texte.length - debut.length} caractères de plus`}
        </button>
      )}
    </div>
  )
}

/** Une image jointe : son interrupteur, sa provenance, son prix.
 *
 *  **Le prix s'écrit sur la ligne où l'on coche**, en doré comme tout écart du
 *  produit. Une case éteinte le garde en gris : c'est ce qu'elle coûterait si on
 *  la rallumait. */
function LigneImage({
  image,
  places,
  onBasculer,
}: {
  image: ImageQuiPart
  /** Combien d'images ce modèle prend. **Zéro est un cas à part** (F6), et il
   *  a besoin d'autres mots : « au-delà des places du modèle » suppose qu'il y
   *  en a, et laisse croire qu'en décocher deux ferait passer la troisième. */
  places: number
  onBasculer: () => void
}) {
  // **Ce que l'image montre, et le geste qui l'ouvre en grand** (U9). L'écran
  // qui décide de ce qui part ne montrait aucune image : les références y
  // étaient des lignes de texte avec un prix. La barre d'espace ouvre celle que
  // le pointeur vise — le geste de l'aperçu, celui qui existe déjà partout
  // ailleurs dans le produit et qui n'a jamais de bouton pour l'annoncer.
  const sujet =
    image.montre?.sorte === "asset"
      ? sujetAsset(image.montre.asset)
      : image.montre?.sorte === "carte"
        ? sujetCarte(image.montre.carte)
        : null
  const visee = useVisee(sujet)
  const vignette =
    image.montre?.sorte === "asset"
      ? vignetteAsset(image.montre.asset, 128)
      : (sujet?.src ?? "")

  return (
    <li
      className="flex items-center gap-3 border-b border-bord py-2"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
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
      {/* **La vignette est le sujet de la ligne**, pas une décoration : c'est
          elle qu'on regarde pour décider de décocher. Une image décochée est
          grisée comme son prix — elle dit ce qui *ne* partira pas. */}
      <span
        data-vignette-jointe
        className={[
          "damier h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[1px] border border-bord",
          image.cochee ? "" : "opacity-40",
        ].join(" ")}
      >
        {vignette && (
          <img
            src={vignette}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </span>
      {/* **Le numéro que le texte lui donne** (R7). Le prompt dit « Image 3 —
          STYLE REFERENCE » ; sans ce chiffre-là sur la ligne, on lit un texte
          qui parle d'images et on regarde une liste qui ne les numérote pas.
          Une image qui ne part pas n'en a pas — elle n'en a pas dans le texte
          non plus —, et la colonne garde sa largeur pour que les noms restent
          alignés. */}
      <span className="mesure w-[46px] shrink-0 text-[10px] text-texte-3">
        {image.rang === null ? "" : `Image ${image.rang}`}
      </span>
      <span className="mesure min-w-0 flex-1 truncate text-[10px] text-texte-2">
        {image.provenance}
        {image.ecartee_par && (
          <span className="text-texte-3"> · {image.ecartee_par}</span>
        )}
        {image.hors_plafond && (
          <span className="text-epingle">
            {" · "}
            {places > 0
              ? "au-delà des places du modèle"
              : "ce modèle n'en prend aucune"}
          </span>
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
