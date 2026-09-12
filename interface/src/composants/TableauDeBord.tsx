/**
 * Le tableau de bord du jeu — **le seul lieu que `B0` branche vraiment.**
 *
 * `docs/pistes-2026-09-04/carnet/Accueil.dc.html`. C'est la balle traçante de
 * la tranche : si le carnet, la pile de lieux et l'aide de navigation des
 * essais tiennent sur un lieu, ils tiendront sur vingt.
 *
 * **C'est aussi le seul chemin de retour du produit** : partout ailleurs on
 * descend dans le jeu, jamais on ne remonte.
 *
 * **B5 le complète** : la barre de complétude par famille, « ce qui manque le
 * plus » avec son coût, et le bandeau d'une feuille qui attend d'être
 * découpée. Les deux premiers viennent de `GET /dashboard`
 * (`ServiceProduction.bilan_du_jeu`) — **jamais recalculés ici** : un chiffre
 * affiché est un chiffre compté, et compter sur une seule page de personnages
 * dirait faux dès qu'un jeu en a plus qu'une page.
 *
 * **Cinq familles, et la planche en montre six** : *Les terrains* n'en est pas
 * une dans le code (`interface/src/composants/Carnet.tsx`), et une carte qui ne
 * mènerait nulle part serait pire qu'une carte absente. Les terrains arrivent
 * avec les tuiles, hors du périmètre de la V4.
 *
 * **Le manque n'a aucune couleur d'alerte** (E2) : les phrases restent dans la
 * palette neutre du texte, jamais `text-signal` ni une teinte d'échec.
 */

import { useEffect, useState } from "react"
import { api, dollars, type BilanDuJeu, type Generation } from "../api"
import type { LigneDeFamille } from "./Carnet"

export function TableauDeBord({
  jeu,
  images,
  depense,
  generations,
  familles,
  feuilleEnAttente,
  surLaFamille,
  surDemanderUneImage,
  surAllerDecouper,
  surLaToile,
  surLesAssets,
  surLesFabrications,
  surLivrer,
}: {
  jeu: string
  images: number
  depense: number
  /** Le nombre d'appels payés, ou `null` quand on ne le sait pas encore. */
  generations: number | null
  familles: readonly LigneDeFamille[]
  /** Une planche reçue, payée, qui attend encore d'être découpée — ou `null`
   *  s'il n'y en a pas. Lue dans le chantier déjà en mémoire (B4) : c'est le
   *  même `pliage.attend_un_choix` que la tuile de la galerie porte. */
  feuilleEnAttente: Generation | null
  surLaFamille: (cle: string) => void
  surDemanderUneImage: () => void
  /** Mène à l'écran où cette feuille se découpe — **la galerie**, qui montre
   *  déjà sa tuile en attente ; B5 n'ajoute aucun lieu de plus. */
  surAllerDecouper: () => void
  surLaToile?: () => void
  surLesAssets?: () => void
  surLesFabrications?: () => void
  surLivrer?: () => void
}) {
  const [bilan, setBilan] = useState<BilanDuJeu | null>(null)

  useEffect(() => {
    let vivant = true
    setBilan(null)
    api
      .bilanDuJeu()
      .then((recu) => vivant && setBilan(recu))
      .catch(() => vivant && setBilan({ familles: [], manques: [], lot: { images: 0, feuilles: 0, cout_usd: 0 } }))
    return () => {
      vivant = false
    }
    // Rechargé à chaque jeu, pour ne jamais montrer le bilan du précédent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeu])

  const detailParFamille = new Map((bilan?.familles ?? []).map((f) => [f.cle, f]))

  return (
    <main
      data-tableau-de-bord
      aria-label="Le tableau de bord du jeu"
      className="defile min-h-0 flex-1 overflow-y-auto bg-papier p-[30px]"
    >
      {/* ── Le jeu ouvert ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-[22px]">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
            {jeu}
          </h1>
          <p className="mt-[8px] text-[15px] leading-[1.55] text-encre-2">
            {images === 0 ? "aucune image" : `${images} images`}
            {" · "}
            <span className="mesure text-signal">{dollars(depense)}</span>
            {generations == null
              ? " dépensés"
              : ` dépensés en ${generations} générations`}
          </p>
        </div>
        {/* **Le seul bouton rouille de l'écran** — c'est ce qui lance, et le
            rouille ne sert qu'à ça et au chiffre qui coûte. Il n'engage rien
            lui-même : il mène là où la dépense s'annonce. */}
        <button
          type="button"
          onClick={surDemanderUneImage}
          className="h-[34px] shrink-0 rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec"
        >
          Demander une image
        </button>
      </div>

      {surLaToile && <div className="mt-[22px] grid grid-cols-2 gap-[14px]">
        <section className="rounded-8 border border-trait bg-carte p-[22px]"><p className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Imaginer le monde</p><h2 className="mt-[8px] font-serif text-[25px] text-encre">L’univers commence sur la toile</h2><p className="mt-[8px] text-[13px] leading-[1.5] text-encre-3">Références, notes et îlots composent le monde. Les règles du jeu accompagnent ensuite les fabrications.</p><button onClick={surLaToile} className="mt-[14px] h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle">Ouvrir la toile</button></section>
        <section className="rounded-8 border border-trait bg-carte p-[22px]"><p className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-4">Fabriquer pour le jeu</p><h2 className="mt-[8px] font-serif text-[25px] text-encre">Des assets fixes et animés</h2><p className="mt-[8px] text-[13px] leading-[1.5] text-encre-3">Choisissez une chose du jeu, préparez ses mouvements et ses directions, puis retouchez ses images avant de les livrer.</p><div className="mt-[14px] flex flex-wrap gap-[8px]"><button onClick={surLesAssets} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle">Parcourir les assets</button><button onClick={surLivrer} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle">Préparer la livraison</button></div></section>
        <button onClick={surLesFabrications} className="col-span-2 rounded-8 border border-trait bg-carte px-[22px] py-[14px] text-left text-[13px] text-encre-controle">Suivre les fabrications et reprendre les résultats →</button>
      </div>}

      {/* ── Ce que le jeu contient, par famille ───────────────────────────── */}
      <h2 className="mesure mt-[34px] mb-[14px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
        Ce que le jeu contient
      </h2>
      <ul className="grid grid-cols-3 gap-[14px]">
        {familles.map((famille) => {
          const detail = detailParFamille.get(famille.cle)
          return (
            <li key={famille.cle}>
              <button
                type="button"
                onClick={() => surLaFamille(famille.cle)}
                className="flex w-full flex-col gap-[9px] rounded-8 border border-trait bg-carte p-[14px] text-left transition-colors duration-120 hover:border-contour"
              >
                <span className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[14px] font-medium text-encre">
                    {famille.nom}
                  </span>
                  <span className="mesure text-[15px] text-encre">
                    {famille.compte == null ? "aucun" : famille.compte}
                  </span>
                </span>
                {/* La barre ne paraît que si le serveur a un compte à en
                    tirer — une famille sans sujet n'a rien à mesurer. */}
                {detail && detail.complet != null && (
                  <span className="block h-[4px] overflow-hidden rounded-5 bg-trait-faible">
                    <span
                      className="block h-full rounded-5 bg-ok"
                      style={{ width: `${Math.round(detail.complet * 100)}%` }}
                    />
                  </span>
                )}
                {/* **Le manque, dit en clair, sans couleur d'alerte** (E2). */}
                {detail && (
                  <span className="text-[12px] leading-[1.4] text-encre-3">
                    {detail.manque_texte}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-[26px] grid grid-cols-2 gap-[22px]">
        {/* ── Ce qui manque le plus ─────────────────────────────────────── */}
        <div>
          <h2 className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
            Ce qui manque le plus
          </h2>
          {bilan && bilan.manques.length === 0 ? (
            <p className="text-[12.5px] text-encre-3">
              rien ne manque, à ce qu'on a compté
            </p>
          ) : (
            <div className="rounded-8 border border-trait bg-carte p-[4px]">
              {(bilan?.manques ?? []).map((manque, rang) => (
                <div
                  key={`${manque.sujet}-${manque.famille}-${rang}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[14px] rounded-5 p-[8px] text-[12.5px] text-encre-2"
                >
                  <span className="mesure text-encre-3">
                    {manque.quantite} {manque.nature === "animation" ? "animation" : "pose"}{manque.quantite > 1 ? "s" : ""}
                  </span>
                  <span className="truncate">{manque.phrase}</span>
                  <span className="truncate text-encre-3">{manque.famille}</span>
                  <span className="mesure text-right">
                    {manque.cout_connu === false ? <span className="text-encre-4">à estimer</span> : manque.cout_usd > 0 ? (
                      <span className="text-signal">{dollars(manque.cout_usd)}</span>
                    ) : (
                      <span className="text-encre-4">rien</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          {bilan && bilan.lot.images > 0 && (
            <p className="mt-[8px] text-[12px] leading-[1.45] text-encre-4">
              Pour les images fixes : {bilan.lot.images} image
              {bilan.lot.images > 1 ? "s" : ""} en {bilan.lot.feuilles} feuille
              {bilan.lot.feuilles > 1 ? "s" : ""} pliée
              {bilan.lot.feuilles > 1 ? "s" : ""},{" "}
              <span className="mesure text-signal">
                {bilan.lot.cout_connu === false ? "coût à estimer" : `≈ ${dollars(bilan.lot.cout_usd)}`}
              </span>
              .
            </p>
          )}
          {bilan && (bilan.lot.animations ?? 0) > 0 && <p className="mt-[8px] text-[12px] text-encre-4">{bilan.lot.animations} animation{(bilan.lot.animations ?? 0) > 1 ? "s" : ""} à fabriquer. Choisissez leur source et leur modèle pour préparer l’estimation.</p>}
        </div>

        {/* ── Une feuille en attente ────────────────────────────────────── */}
        <div>
          {feuilleEnAttente && (
            <div
              data-feuille-en-attente
              className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]"
            >
              <p className="text-[13px] font-medium text-encre">
                Une feuille attend d'être découpée
              </p>
              <p className="text-[12px] leading-[1.5] text-encre-2">
                Une planche est revenue et elle est payée. Tant qu'elle n'est
                pas découpée, elle ne compte pas dans le jeu.
              </p>
              <button
                type="button"
                onClick={surAllerDecouper}
                className="h-[34px] self-start rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre transition-colors duration-120 hover:border-contour"
              >
                Aller la découper
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
