/**
 * Les calques d'animation d'un emploi — B20. **Ses animations, image par image.**
 *
 * `docs/pistes-2026-09-04/carnet/Emploi.dc.html`, la vue que la planche marquait
 * elle-même « à construire » et renvoyait à cette tranche. Une profondeur de plus
 * que la page d'un emploi, et elle ne fabrique rien : le calque existe, les
 * images du clip existent, et ce qu'on pose entre les deux est un calcul qui
 * tourne sur la machine.
 *
 * ── Une rangée par pose *et par direction*, et c'est légitime ici ────────────
 *
 * `Emploi.tsx` refuse la grille de vingt-quatre cases, et il a raison : un
 * calque n'a pas de direction. Cet écran-ci la rend pourtant — parce que ce
 * qu'il range n'est pas un calque, c'est une **bande**, et une bande porte sa
 * direction depuis `A10`.
 *
 * Les deux ne se contredisent pas, ils disent la même chose depuis deux côtés :
 * la direction vit sur l'animation, jamais sur ce qu'on pose dessus. Habiller
 * les quatre bandes d'une pose relit **le même** calque quatre fois — c'est ce
 * que `test_b20.py` verrouille, et c'est ce qui fait qu'ajouter les directions
 * ne crée pas dix-huit générations à payer.
 *
 * ── Ce qui compte, et ce qui ne compte pas ──────────────────────────────────
 *
 * ⚠️ **Une case sans animation du personnage n'est pas un manque.** Une
 * animation d'équipement suit celle du personnage : là où il n'a rien, il n'y a
 * rien à habiller, et aucun clic ne le changerait. Elle se dit, elle ne se
 * compte pas — annoncer un trou que personne ne peut combler ferait passer un
 * travail impossible pour un travail en retard.
 *
 * **Aucun chiffre ne se calcule ici.** `fait` et `attendu` viennent du serveur,
 * qui seul sait quelles cases comptent ; les recompter à l'écran aurait fait
 * deux comptes à tenir d'accord, et c'est toujours le second qui ment.
 *
 * **Le manque n'a aucune couleur**, comme sur la page d'un emploi : un trait fin
 * et rien d'autre. Le seul signal de cet écran est le bouton qui pose — et
 * comme il ne dépense pas, il n'est pas rouille : *cliquer ne coûte jamais*.
 */

import {
  type CalageParImage,
  type MatriceDesCalquesAnimes,
  type RangeeDeCalqueAnime,
  type TenueDuCalque,
} from "../api"

/** Ce que le compteur dit — **le compte du serveur, relu tel quel**.
 *
 *  Écrit à part de `compteDesCalques` (`Emploi.tsx`) pour une seule raison, et
 *  elle est dans la phrase : celui-ci parle de cases **habillables**, et doit
 *  pouvoir dire à côté combien ne le sont pas. Les fondre aurait obligé l'un des
 *  deux à mentir sur ce qu'il compte. */
export function compteDesAnimations(
  fait: number,
  attendu: number,
  sansAnimation: number,
): string {
  const reste = Math.max(0, attendu - fait)
  const debut =
    reste === 0
      ? `${fait} sur ${attendu} · rien ne manque`
      : `${fait} sur ${attendu} · ${reste} à poser`
  if (sansAnimation === 0) return debut
  // **Ce qui ne compte pas se dit quand même.** Sans cette moitié de phrase,
  // l'auteur lit « 2 sur 2 » sur un personnage à six poses et cherche l'erreur.
  return `${debut} · ${sansAnimation} sans animation`
}

/** Le mot d'une rangée, **et il vient du serveur** sauf pour les deux tenues.
 *
 *  Le serveur dit l'état ; la tenue, elle, n'a de sens que sur une case déjà
 *  habillée, et c'est l'habillage qui la porte. Les deux phrases sont celles de
 *  la planche, au mot près. */
export function motDeLaRangee(rangee: RangeeDeCalqueAnime): string {
  if (rangee.etat !== "habille" || rangee.habillee === null) return rangee.mot
  return rangee.habillee.habillage?.tenue === "glisse"
    ? "le calque glisse"
    : "le calque tient"
}

/** La phrase sous le mot — **ce que la tenue coûte, et ce qu'elle rend**.
 *
 *  Elle dit un nombre compté et non un adjectif : *huit calculs* se vérifie,
 *  *bien calé* ne se vérifie pas. C'est la règle 5 du design. */
export function detailDeLaRangee(rangee: RangeeDeCalqueAnime): string {
  if (rangee.etat !== "habille" || rangee.habillee === null) return ""
  const images = rangee.habillee.calages.length
  if (rangee.habillee.habillage?.tenue === "glisse") {
    return `Un seul calage a servi pour les ${images}. Moins de calcul, et ça se voit dès que le personnage tourne la tête.`
  }
  return `Le calque a été recalé sur chacune des ${images} images. ${images} calculs, sur la machine, gratuits.`
}

/** Le calage le plus douteux de la bande, **quand il y en a un à montrer**.
 *
 *  La couverture est ce que le recalage a trouvé de commun entre les deux
 *  images. Elle sert à dire *celui-là tombe mal* sans obliger l'auteur à
 *  regarder les huit images une par une. */
export function pireCalage(calages: readonly CalageParImage[]): CalageParImage | null {
  if (calages.length === 0) return null
  return calages.reduce((pire, celui) =>
    celui.couverture < pire.couverture ? celui : pire,
  )
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

// ── Une rangée ──────────────────────────────────────────────────────────────

function Rangee({
  rangee,
  onPoser,
  onBasculer,
  onRetirer,
}: {
  rangee: RangeeDeCalqueAnime
  onPoser: (bande: string, tenue: TenueDuCalque) => void
  onBasculer: (habillee: string, tenue: TenueDuCalque) => void
  onRetirer: (habillee: string) => void
}) {
  const habillee = rangee.habillee
  const tenue: TenueDuCalque = habillee?.habillage?.tenue ?? "tient"
  const cle = `${rangee.pose}-${rangee.direction}`

  return (
    <div
      data-rangee-animee={cle}
      data-etat={rangee.etat}
      className="flex items-start gap-[14px] border-t border-trait-faible py-[8px]"
    >
      {/* Le nom de la case : la pose, puis sa direction et son compte d'images */}
      <div className="flex w-[300px] shrink-0 flex-col gap-[4px]">
        <span className="text-[13px] text-encre">{rangee.pose_nom}</span>
        <span className="mesure text-[11.5px] text-encre-3">
          {rangee.direction_nom || "sans direction"}
          {rangee.compte > 0 ? ` · ${rangee.compte} images` : ""}
        </span>
      </div>

      {/* Ce que la case porte, et le geste qui la remplit */}
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <span
            data-mot-de-la-rangee
            className={
              rangee.etat === "sans-animation"
                ? "text-[13px] text-eteint"
                : "text-[13px] text-encre-2"
            }
          >
            {motDeLaRangee(rangee)}
          </span>

          {/* **Poser ne dépense pas, donc le bouton n'est pas rouille.** */}
          {rangee.etat === "a-habiller" && rangee.bande !== null ? (
            <button
              type="button"
              data-poser-le-calque={cle}
              onClick={() => onPoser(rangee.bande as string, "tient")}
              className="h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
            >
              Poser le calque
            </button>
          ) : null}

          {rangee.etat === "habille" && habillee !== null ? (
            <>
              <button
                type="button"
                data-basculer-la-tenue={cle}
                onClick={() =>
                  onBasculer(
                    habillee.identifiant,
                    tenue === "tient" ? "glisse" : "tient",
                  )
                }
                className="h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
              >
                {tenue === "tient"
                  ? "le faire glisser"
                  : "le faire tenir image par image"}
              </button>
              <button
                type="button"
                data-retirer-le-calque={cle}
                onClick={() => onRetirer(habillee.identifiant)}
                className="h-[26px] rounded-7 px-[8px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
              >
                Retirer
              </button>
            </>
          ) : null}
        </div>

        {rangee.etat === "habille" ? (
          <p className="text-[12.5px] leading-[1.45] text-encre-3">
            {detailDeLaRangee(rangee)}
            {habillee?.habillage?.a_la_main ? " Le calage a été posé à la main." : ""}
          </p>
        ) : null}

        {/* **Le manque n'a pas de couleur** — un trait fin, et rien d'autre. */}
        {rangee.etat === "sans-calque" ? (
          <span
            data-case-sans-calque={cle}
            aria-hidden
            className="flex h-[22px] items-center"
          >
            <span className="block w-[300px] border-t border-contour" />
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export function CalquesAnimes({
  matrice,
  onPoser,
  onBasculer,
  onRetirer,
  onRevenirALEmploi,
}: {
  matrice: MatriceDesCalquesAnimes
  onPoser: (bande: string, tenue: TenueDuCalque) => void
  onBasculer: (habillee: string, tenue: TenueDuCalque) => void
  onRetirer: (habillee: string) => void
  onRevenirALEmploi: () => void
}) {
  return (
    <main
      data-calques-animes
      aria-label={`Les calques d'animation — ${matrice.piece.nom}`}
      className="flex min-h-0 min-w-0 flex-1 bg-papier"
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex min-w-0 flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
              Ses animations, image par image
            </h1>
            <p className="text-[13px] text-encre-2">
              Le calque déjà obtenu sur la pose est reposé sur chaque image de
              l'animation. Aucune génération de plus n'est demandée.
            </p>
          </div>
          <button
            type="button"
            onClick={onRevenirALEmploi}
            className="h-[30px] shrink-0 rounded-7 px-[14px] text-[13px] text-encre-3 transition-colors duration-120 hover:text-encre"
          >
            Revenir aux calques de {matrice.piece.nom} ›
          </button>
        </div>

        <div className="flex items-baseline gap-[8px]">
          <Etiquette>Une rangée par pose et par direction</Etiquette>
          <span className="mesure ml-auto text-[12.5px] text-encre-3">
            {compteDesAnimations(
              matrice.fait,
              matrice.attendu,
              matrice.sans_animation,
            )}
          </span>
        </div>

        <div
          data-la-matrice-animee
          className="defile flex min-h-0 flex-1 flex-col overflow-y-auto pb-[22px]"
        >
          {matrice.rangees.length === 0 ? (
            <p className="text-[13px] leading-[1.45] text-encre-3">
              {matrice.porteur.nom} n'a encore aucune pose. Son plan se remplit
              depuis sa fiche, et les animations suivront.
            </p>
          ) : (
            matrice.rangees.map((rangee) => (
              <Rangee
                key={`${rangee.pose}-${rangee.direction}`}
                rangee={rangee}
                onPoser={onPoser}
                onBasculer={onBasculer}
                onRetirer={onRetirer}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Ce que le recalage fait, et ce qu'il ne coûte pas ──────────────── */}
      <aside
        data-ce-que-le-recalage-fait
        aria-label="Ce que le recalage fait"
        className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
      >
        <div className="flex flex-col gap-[4px]">
          <span className="font-serif text-[25px] leading-[1.15] text-encre">
            Deux façons de suivre
          </span>
          <p className="text-[13px] leading-[1.45] text-encre-2">
            Les deux sont gratuites. Ce qui les sépare est le temps de calcul, et
            ce qu'on obtient pour ce temps.
          </p>
        </div>

        <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
          <span className="text-[13px] text-encre">Le calque tient</span>
          <p className="text-[12.5px] leading-[1.45] text-encre-2">
            Le recalage est rejoué sur chaque image. C'est ce qui suit un
            personnage qui tourne la tête ou lève le bras.
          </p>
        </div>

        <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
          <span className="text-[13px] text-encre">Le calque glisse</span>
          <p className="text-[12.5px] leading-[1.45] text-encre-2">
            Un seul calage sert à toute la bande. Moins de calcul, et le calque
            décroche dès que le corps bouge autrement qu'en bloc.
          </p>
        </div>

        <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-papier p-[14px]">
          <span className="text-[13px] text-encre">
            Une case vide n'est pas un manque
          </span>
          <p className="text-[12.5px] leading-[1.45] text-encre-2">
            Une animation d'équipement suit celle du personnage. Là où il n'a pas
            encore l'animation, il n'y a rien à habiller — et cette case-là ne
            compte pas dans le total.
          </p>
        </div>

        <p className="mt-auto text-[12.5px] leading-[1.45] text-encre-3">
          Rien sur cet écran ne dépense. Le recalage tourne sur la machine, et
          fonctionne réseau coupé.
        </p>
      </aside>
    </main>
  )
}
