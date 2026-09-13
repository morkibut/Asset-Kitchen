/**
 * Un emploi d'une pièce — B19, *le vestiaire*. **La page d'une façon de servir**
 * : « Portée par Le goliath », « À part », « En scène ».
 *
 * `docs/archive/pistes-2026-09-04/carnet/Emploi.dc.html`. Une profondeur de plus que la
 * page d'une pièce, ouverte depuis la liste de ses emplois — et elle ne fabrique
 * rien : elle montre les calques déjà là et règle **comment** ils se posent.
 *
 * **Aucun chiffre neuf ne s'y calcule.** `fait` et `attendu` viennent de
 * `EmploiResolu` (`interface/src/api.ts`), calculés par le serveur qui lit les
 * calques ; les recompter ici aurait fait deux comptes à tenir d'accord, et
 * c'est toujours le second qui ment. L'écran n'appelle ni `api.*` ni `fetch` :
 * il remonte les six gestes du vestiaire à son parent, comme `GrilleDuJeu.tsx`.
 *
 * ── Ce que la planche dit et que le code ne suit pas ────────────────────────
 *
 * ⚠️ **La planche annonce « vingt-quatre calques : six poses, quatre
 * directions », et dessine une grille de 6 × 4. C'est faux dans ce dépôt, et
 * c'en est une décision de la tranche.**
 *
 * Un calque n'a pas de direction. Le service range les calques **par pose
 * seule** : `atelier/services/equipement.py`, `corps()` fait une entrée par
 * pose (`par_pose.setdefault(asset.pose, …)`) et `plier()` une case par pose ;
 * `atelier/services/production.py`, `cases()`, écrit
 * `calques[pose][piece]` — pas le moindre axe d'angle. Le critère
 * d'acceptation de la tranche le dit en toutes lettres : *un calque reste
 * solidaire de sa **pose***.
 *
 * La matrice de cet écran est donc **une colonne de poses**, jamais une grille.
 * Suivre la planche aurait demandé quatre calques par pose là où le disque n'en
 * garde qu'un, et l'écran aurait annoncé dix-huit manques imaginaires sur un
 * emploi complet. `Emploi.test.tsx` verrouille ce choix.
 *
 * Deux autres morceaux de la planche ne sont pas ici, et pour des raisons
 * différentes :
 *
 * - **« Caler à la main »**, l'atelier de superposition — l'échelle, les deux
 *   décalages, le seuil. Il existe déjà ailleurs dans le produit
 *   (`atelier/services/superposition.py`), c'est un atelier à lui, et le
 *   glisser dans un volet de 380 px l'aurait dupliqué au lieu de l'ouvrir.
 * - **« Ses animations, image par image »** — la planche la marque elle-même
 *   « à construire », et elle appartient à `B20`. Rien de ce qu'elle demande
 *   n'existe : une bande n'a aucun champ `pièce`.
 *
 * ⚠️ **Le manque n'a aucune couleur.** Une pose sans calque est un trait fin en
 * `border-contour`, et rien d'autre. La couleur d'accent dit *ce qui se clique*,
 * jamais *ce qui manque* — un écran qui rougit devant une case vide fait passer
 * un travail à faire pour une panne.
 */

import { useState, type ReactNode } from "react"
import {
  identiteDEmploi,
  type Asset,
  type Case,
  type EmplacementCorps,
  type EmploiResolu,
  type Personnage,
  type Piece,
} from "../api"
import { imageAsset } from "./Apercu"
import { CalquesDeLEmploi } from "./CalquesDeLEmploi"

/** Ce que le titre écrit — **la règle vit dans `api.ts`**, pas ici.
 *
 *  `identiteDEmploi` dit ce que l'emploi *est* ; le nom libre de l'auteur se
 *  montre à côté, en sous-ligne, comme la planche le dessine. La liste des
 *  emplois et le fil, eux, appellent `libelleDEmploi`, qui met le nom de
 *  l'auteur devant. Trois copies de cette composition divergeaient déjà sur le
 *  cas du porteur disparu — « personne » ici, « quelqu'un » là. */

/** Une rangée de la matrice : **une pose, un calque ou rien**. */
export type RangeeDePose = {
  pose: string
  nom: string
  calque: Asset | null
}

/** Le calque que cette pose sortirait dans le jeu, pour cette pièce-là.
 *
 *  `retenus` est calculé par le serveur au même endroit que `calques`
 *  (`atelier/services/production.py`, `cases()`) : l'écran le lit, il ne
 *  départage pas. Sans entrée dans `retenus`, la case est vide — désigner
 *  d'office le premier de la liste ferait montrer autre chose que ce qui part. */
function calqueRetenu(sienne: Case, piece: string): Asset | null {
  const liste = sienne.calques[piece] ?? []
  const retenu = sienne.retenus[piece]
  return liste.find((asset) => asset.identifiant === retenu) ?? null
}

/** Les rangées d'un porteur, **dans l'ordre de son plan**.
 *
 *  `Personnage.cases` arrive déjà rangé par le serveur (« ses cases, dans
 *  l'ordre du plan ») ; le plan ne sert donc qu'à nommer les poses. Le refaire à
 *  l'écran aurait été un second tri à tenir d'accord avec le premier. */
export function rangeesDuPorteur(
  porteur: Personnage | null,
  piece: string,
): RangeeDePose[] {
  if (porteur === null) return []
  const noms = new Map(porteur.plan.map((pose) => [pose.identifiant, pose.nom]))
  return porteur.cases.map((sienne) => ({
    pose: sienne.pose,
    nom: noms.get(sienne.pose) ?? sienne.pose,
    calque: calqueRetenu(sienne, piece),
  }))
}

/** Ce que le compteur dit — **le compte du serveur, relu tel quel**. */
export function compteDesCalques(fait: number, attendu: number): string {
  const manque = Math.max(0, attendu - fait)
  if (manque === 0) return `${fait} sur ${attendu} · rien ne manque`
  // « 1 manquent » aurait été la lettre de la maquette et une faute de
  // français ; le carnet écrit simplement, donc le singulier s'accorde.
  return `${fait} sur ${attendu} · ${manque} ${manque === 1 ? "manque" : "manquent"}`
}

/** Un champ de texte qui se garde le temps qu'on l'écrive.
 *
 *  Le brouillon se remet à la valeur servie **quand on change d'emploi**, pas à
 *  chaque rendu : une remise sur `valeur` effacerait la frappe en cours dès que
 *  le parent recharge. C'est le motif d'état dérivé de React, sans effet. */
function useBrouillon(valeur: string, cle: string) {
  const [brouillon, setBrouillon] = useState(valeur)
  const [vu, setVu] = useState(cle)
  if (vu !== cle) {
    setVu(cle)
    setBrouillon(valeur)
  }
  return [brouillon, setBrouillon] as const
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

// ── La matrice ──────────────────────────────────────────────────────────────

/** Une rangée : le nom de la pose, puis ce que la case porte.
 *
 *  Pleine, elle se clique et ouvre le calque. Vide, elle n'est pas un bouton :
 *  il n'y a rien à ouvrir, et un bouton qui ne fait rien se clique quand même. */
function Rangee({
  rangee,
  onCalque,
}: {
  rangee: RangeeDePose
  onCalque: (asset: string) => void
}) {
  const calque = rangee.calque
  return (
    <div
      data-rangee-de-pose={rangee.pose}
      className="flex items-center gap-[14px] border-t border-trait-faible py-[8px]"
    >
      <span className="w-[300px] shrink-0 text-[13px] text-encre">{rangee.nom}</span>
      {calque ? (
        <button
          type="button"
          onClick={() => onCalque(calque.identifiant)}
          data-calque-de-pose={calque.identifiant}
          aria-label={`Le calque de ${rangee.nom}`}
          className="block h-[54px] w-[54px] shrink-0 overflow-hidden rounded-7 border border-trait bg-pourtour transition-colors duration-120 hover:border-encre-4"
        >
          <img
            src={imageAsset(calque)}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </button>
      ) : (
        // **Le manque n'a pas de couleur** — un trait fin, et rien d'autre. Ni
        // pointillé d'alerte, ni fond, ni mot en rouge : la case est vide, ce
        // qui est un état ordinaire et non une panne.
        <span
          data-case-vide={rangee.pose}
          aria-hidden
          className="flex h-[54px] w-[54px] shrink-0 items-center"
        >
          <span className="block w-full border-t border-contour" />
        </span>
      )}
    </div>
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

export function Emploi({
  projet,
  emploi,
  piece,
  emplacements,
  porteur,
  onRegler,
  onRetirer,
  onCalque,
  onLesAutresEmplois,
  onPorteur,
  onCalquesAnimes,
  cibleInitiale,
  varianteInitiale,
}: {
  projet?: string
  emploi: EmploiResolu
  piece: Piece
  emplacements: readonly EmplacementCorps[]
  /** Le personnage qui porte, avec ses cases — `null` pour un emploi qui ne
   *  porte personne, ou dont le porteur n'est plus dans le jeu. */
  porteur: Personnage | null
  onRegler: (champs: {
    nom?: string
    emplacement?: string
    devant?: boolean
    description?: string
  }) => void
  onRetirer: () => void
  onCalque: (asset: string) => void
  onLesAutresEmplois: () => void
  /** **Revenir à la page du personnage qui porte** — une pièce nommée depuis sa
   *  fiche garde ce lien, et le chemin du retour reste ouvert quel que soit
   *  l'endroit d'où l'emploi a été ouvert (US-537). `undefined` sur un emploi
   *  qui ne porte personne : il n'y a alors pas de page où revenir. */
  onPorteur?: () => void
  /** Ouvrir *ses animations, image par image* (`B20`). Le bouton ne paraît que
   *  sur un emploi **porté** : sans porteur il n'y a ni pose, ni bande, ni rien
   *  à habiller. */
  onCalquesAnimes: () => void
  cibleInitiale?: import("../api-calques").CibleCalque
  varianteInitiale?: string
}) {
  const [historique, setHistorique] = useState(false)
  const [nom, setNom] = useBrouillon(emploi.nom, emploi.identifiant)
  const [description, setDescription] = useBrouillon(
    emploi.description,
    emploi.identifiant,
  )

  const libelle = identiteDEmploi(emploi)
  const porte = emploi.genre === "porte"
  const rangees = rangeesDuPorteur(porteur, piece.identifiant)

  /** Le nom de l'emplacement que la pièce déclare, pour l'option vide. **Vide
   *  veut dire « celui de la pièce », jamais « aucun »** — c'est écrit sur
   *  `Emploi.emplacement`, et l'option le répète en clair. */
  const sienDeLaPiece =
    emplacements.find((e) => e.identifiant === piece.emplacement)?.nom ??
    "aucun pour l'instant"

  const garderLeNom = () => {
    if (nom !== emploi.nom) onRegler({ nom })
  }

  if (projet && porte && porteur !== null && !historique) return <CalquesDeLEmploi
    key={`${projet}:${piece.identifiant}:${emploi.identifiant}`} projet={projet} emploi={emploi} piece={piece}
    porteur={porteur} emplacements={emplacements} onRegler={onRegler}
    cibleInitiale={cibleInitiale} varianteInitiale={varianteInitiale} onPorteur={onPorteur}
    onHistorique={() => setHistorique(true)} onLesAutresEmplois={onLesAutresEmplois} />

  return (
    <main
      data-emploi
      aria-label={`${libelle} — ${piece.nom}`}
      className="flex min-h-0 min-w-0 flex-1 bg-papier"
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        {/* ── L'entête ──────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex min-w-0 flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
              {libelle}
            </h1>
            <input
              value={nom}
              onChange={(evenement) => setNom(evenement.target.value)}
              onBlur={garderLeNom}
              onKeyDown={(evenement) => {
                if (evenement.key === "Enter") garderLeNom()
              }}
              aria-label="Le nom de cet emploi"
              placeholder="lui donner un nom, si le titre ne suffit pas"
              className="h-[30px] w-[380px] rounded-7 border border-trait bg-carte px-[8px] text-[13px] text-encre transition-colors duration-120 hover:border-contour"
            />
            <p className="text-[13px] text-encre-2">
              Un calque se pose sur le personnage. Il ne le remplace pas et ne le
              modifie pas.
            </p>
            {projet && porte && porteur !== null && <button className="mt-[8px] h-[30px] self-start rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle" onClick={() => setHistorique(false)}>Revenir aux calques par image et par frame</button>}
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            {onPorteur && porteur !== null && (
              <button
                type="button"
                onClick={onPorteur}
                className="h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle transition-colors duration-120 hover:border-encre-3"
              >
                Revenir à {porteur.nom}
              </button>
            )}
            <button
              type="button"
              onClick={onLesAutresEmplois}
              className="h-[30px] shrink-0 rounded-7 px-[14px] text-[13px] text-encre-3 transition-colors duration-120 hover:text-encre"
            >
              Les autres emplois de {piece.nom} ›
            </button>
          </div>
        </div>

        {/* ── La matrice — une colonne de poses, jamais une grille ──────── */}
        <div className="flex items-baseline gap-[8px]">
          <Etiquette>Une rangée par pose</Etiquette>
          {/* **Et pendant les animations** (B20) — aucun calque de plus n'est
              généré : c'est celui de la pose qui est recalé sur chaque image,
              sur la machine et gratuitement. Le bouton ne paraît que sur un
              emploi porté, parce que lui seul a des animations à habiller. */}
          {porte && porteur !== null ? (
            <button
              type="button"
              data-voir-les-calques-animes
              onClick={onCalquesAnimes}
              className="h-[26px] rounded-7 px-[8px] text-[12.5px] text-encre-3 transition-colors duration-120 hover:text-encre"
            >
              Ses animations, image par image ›
            </button>
          ) : null}
          <span className="mesure ml-auto text-[12.5px] text-encre-3">
            {compteDesCalques(emploi.fait, emploi.attendu)}
          </span>
        </div>

        <div
          data-la-matrice
          className="defile flex min-h-0 flex-1 flex-col overflow-y-auto pb-[22px]"
        >
          {rangees.length === 0 ? (
            <p className="text-[13px] leading-[1.45] text-encre-3">
              {porte
                ? // L'orphelin se dit, il ne se cache pas et ne fait tomber
                  // personne : « jamais de cascade », `EmploiResolu.orphelin`.
                  "Son porteur n'est plus dans le jeu. Ses calques, eux, sont restés dans la galerie ; cet emploi se retire d'un clic, en bas à droite."
                : "Cet emploi ne se pose sur personne : il n'a ni pose ni calque, seulement une description."}
            </p>
          ) : (
            rangees.map((rangee) => (
              <Rangee key={rangee.pose} rangee={rangee} onCalque={onCalque} />
            ))
          )}
        </div>
      </section>

      {/* ── Comment le calque se pose ───────────────────────────────────── */}
      <aside
        data-comment-le-calque-se-pose
        aria-label="Comment le calque se pose"
        className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
      >
        <div className="flex flex-col gap-[4px]">
          <span className="font-serif text-[25px] leading-[1.15] text-encre">
            Comment le calque se pose
          </span>
          <p className="text-[13px] leading-[1.45] text-encre-2">
            Ces réglages valent pour toutes les poses à la fois.
          </p>
        </div>

        {porte ? (
          <>
            {/* ── L'emplacement ──────────────────────────────────────── */}
            <div className="flex flex-col gap-[4px]">
              <Etiquette>L'emplacement</Etiquette>
              <select
                value={emploi.emplacement}
                onChange={(evenement) =>
                  onRegler({ emplacement: evenement.target.value })
                }
                aria-label="L'emplacement"
                className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
              >
                <option value="">celui de la pièce ({sienDeLaPiece})</option>
                {emplacements.map((emplacement) => (
                  <option key={emplacement.identifiant} value={emplacement.identifiant}>
                    {emplacement.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Devant ou derrière ─────────────────────────────────── */}
            <div className="flex flex-col gap-[4px]">
              <Etiquette>Devant ou derrière</Etiquette>
              <div className="flex gap-[4px] rounded-8 bg-ligne-ouverte p-[4px]">
                {(
                  [
                    [true, "devant le corps"],
                    [false, "derrière le corps"],
                  ] as const
                ).map(([valeur, mot]) => (
                  <button
                    key={mot}
                    type="button"
                    aria-pressed={emploi.devant === valeur}
                    onClick={() => onRegler({ devant: valeur })}
                    className={[
                      "flex h-[26px] flex-1 items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                      emploi.devant === valeur
                        ? "bg-carte font-medium text-encre"
                        : "text-encre-3 hover:text-encre",
                    ].join(" ")}
                  >
                    {mot}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Le porteur — en lecture, et il le reste ─────────────── */}
            <div
              data-le-porteur
              className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]"
            >
              <Etiquette>Le porteur</Etiquette>
              <span className="text-[13px] text-encre">
                {emploi.porteur_nom || "aucun"}
              </span>
              <span className="text-[12px] text-encre-3">
                {porteur === null ? (
                  "il n'est plus dans le jeu"
                ) : (
                  <>
                    <span className="mesure">{porteur.cases.length}</span>{" "}
                    {porteur.cases.length > 1 ? "poses" : "pose"}
                  </>
                )}
              </span>
              <p className="text-[11.5px] leading-[1.45] text-encre-4">
                Il ne se change pas : les calques déjà faits sont rangés sous lui, et
                les déplacer les laisserait derrière. Se tromper de porteur se répare
                en retirant l'emploi, puis en en créant un autre.
              </p>
            </div>
          </>
        ) : (
          /* Un emploi qui ne porte personne n'a ni emplacement ni porteur : il
             n'y a pas de corps sur quoi se poser, et une liste d'emplacements y
             serait un choix sans effet. Ce qu'il a, c'est ce que l'auteur en
             dit. */
          <div className="flex flex-col gap-[4px]">
            <Etiquette>La description</Etiquette>
            <textarea
              value={description}
              onChange={(evenement) => setDescription(evenement.target.value)}
              onBlur={() => {
                if (description !== emploi.description) onRegler({ description })
              }}
              aria-label="La description"
              rows={4}
              className="defile rounded-7 border border-contour bg-carte p-[8px] text-[13px] leading-[1.45] text-encre transition-colors duration-120 hover:border-encre-4"
            />
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              Cet emploi ne se pose sur personne — l'atelier ne lui fabrique aucun
              calque, il le compte et le nomme.
            </p>
          </div>
        )}

        {/* ── Retirer ────────────────────────────────────────────────── */}
        <div className="mt-auto flex flex-col gap-[8px] border-t border-trait pt-[14px]">
          <button
            type="button"
            onClick={onRetirer}
            className="h-[34px] rounded-7 text-[13px] text-echec transition-colors duration-120 hover:bg-papier"
          >
            Retirer cet emploi
          </button>
          <p className="text-[11.5px] leading-[1.45] text-encre-4">
            Retirer un porteur ne supprime pas ses images : elles restent dans la
            galerie, détachées.
          </p>
        </div>
      </aside>
    </main>
  )
}
