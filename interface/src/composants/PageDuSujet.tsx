/**
 * La page d'un sujet — B10. **On arrive sur la chose, plus sur son atelier.**
 *
 * `docs/pistes-2026-09-04/carnet/Fiche.dc.html` pour l'onglet *Sa fiche* ;
 * *Ses images* vit dans `ImagesDuSujet.tsx`, qui est le gros de la tranche.
 * Quatre onglets, un seul écran : le carnet ne bouge pas quand on passe de l'un
 * à l'autre, et rien ne se recharge — l'onglet est un état de cette page, pas
 * un lieu de la pile (`interface/src/lieux.ts`).
 *
 * ⚠️ **La matrice de l'établi ne disparaît pas : elle descend d'un cran**, et
 * c'est la décision qui a coûté le plus de relevé.
 *
 * Le plan de B10 fait de cette page la vue par défaut à la place de la matrice.
 * Le relevé du 8 septembre 2026 a mesuré ce que la matrice porte encore, et que
 * B10 ne reprend pas : commander un clip (`onAnimer`), l'atelier d'une
 * animation, le vestiaire et sa colonne de pièce, la planche d'une pose, le
 * calibrage, la vitrine, le miroir d'une case, les poses cochées, et la fiche
 * plein cadre de `FicheChose.tsx`. **Aucune de ces huit fonctions n'a d'autre
 * chemin dans le produit** avant `B11`, `B12` et `B19`. Les retirer maintenant
 * pour livrer un onglet aurait été une régression, pas une refonte — et 349 des
 * 744 essais d'écran passent par là.
 *
 * La matrice devient donc **la profondeur suivante de cette page**, atteinte
 * depuis *Sa fiche*, exactement comme la fiche plein cadre, la vitrine et le
 * calibrage étaient déjà des profondeurs de la matrice. Elle s'en ira quand ses
 * huit locataires auront déménagé, pas avant.
 *
 * **`data-etabli` est sur cette page** et non plus sur la matrice : c'est elle,
 * désormais, le lieu « un sujet est ouvert ». La matrice, elle, porte
 * `data-matrice` — deux marqueurs identiques imbriqués auraient fait dire au
 * premier `querySelector` venu autre chose selon la profondeur ouverte.
 *
 * **Aucun bouton rouille ici.** Le seul de l'écran est la barre qui paie, au
 * pied, et elle appartient au châssis. La planche en dessine un second,
 * *Demander une image* — il aurait dit ce que la barre dit déjà, à trente
 * pixels d'elle.
 *
 * ⚠️ **Sauf sur *L'essai*, où la barre se retire** (`B12`). Cet onglet-là porte
 * sa propre porte vers une dépense — *Demander un clip* —, et deux boutons
 * rouille sur le même écran est très exactement ce que `docs/DESIGN.md`
 * interdit : le rouille cesse de vouloir dire quelque chose dès qu'il y en a
 * deux. C'est aussi ce que la planche `Essai.dc.html` dessine, et le même geste
 * que la barre fait déjà quand un outil s'ouvre.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  api,
  Refus,
  type Collection,
  type Echelle,
  type GroupeDeRangement,
  type Personnage,
  type Piece,
  type Pose,
  type EmplacementCorps,
  type Univers,
  type VestiaireDuJeu,
} from "../api"
import type { Fente } from "./BarreChassis"
import { vignetteAsset } from "./Apercu"
import { comptes, portraitDe } from "./FicheChose"
import { EcranEtabli } from "./Personnages"
import { ImagesDuSujet } from "./ImagesDuSujet"
import { AnimationsDuSujet } from "./AnimationsDuSujet"
import { EssaiDuSujet } from "./EssaiDuSujet"
import { VestiaireDuSujet } from "./VestiaireDuSujet"

/** Les quatre onglets, dans l'ordre de la planche. **Les quatre sont
 *  construits depuis `B12`** — le dernier, *L'essai*, était nommé bien avant
 *  d'exister, pour qu'un onglet ajouté plus tard ne déplace pas les trois
 *  autres et que la page ne change pas de forme à chaque tranche. */
type Onglet = "fiche" | "images" | "animations" | "essai"

const ONGLETS: readonly { clef: Onglet; nom: string }[] = [
  { clef: "fiche", nom: "Sa fiche" },
  { clef: "images", nom: "Ses images" },
  { clef: "animations", nom: "Ses animations" },
  { clef: "essai", nom: "L'essai" },
]

/** Ce que ses images ont coûté — **et rien de plus que ça.**
 *
 *  ⚠️ Ce n'est pas *ce que le sujet a coûté*, et la nuance est la règle 5 de
 *  `docs/DESIGN.md` (*un chiffre affiché est un chiffre compté*). Le coût porté
 *  par une image est une copie prise à sa naissance ; les appels ratés, eux, ne
 *  laissent aucune image et ne sont donc pas là. La seule source exacte est
 *  `GET /spending`, qui rend les cinq cents derniers appels de **tout**
 *  l'atelier, sans filtre de sujet : un total tiré de là serait tronqué sans le
 *  dire, ce qui est pire qu'un total plus étroit qui dit ce qu'il compte.
 *  Nommer ce qu'on sait compter est la seule sortie honnête, et l'écran des
 *  dépenses reste l'endroit où l'argent se compte en entier. */
function ceQueSesImagesOntCoute(personnage: Personnage): {
  total: number
  images: number
  moyenne: number
} {
  const toutes = personnage.cases.flatMap((c) => [
    ...c.images,
    ...Object.values(c.calques).flat(),
  ])
  const payees = toutes.filter((a) => a.cout_usd > 0)
  const total = payees.reduce((somme, a) => somme + a.cout_usd, 0)
  return {
    total,
    images: payees.length,
    moyenne: payees.length === 0 ? 0 : total / payees.length,
  }
}

// ── Les pièces ──────────────────────────────────────────────────────────────

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

function Carte({ nombre, mot, teinte }: { nombre: string; mot: string; teinte?: string }) {
  return (
    <span className="flex flex-col rounded-8 border border-trait bg-carte px-[14px] py-[8px]">
      <span className={`mesure text-[25px] leading-[1.15] ${teinte ?? "text-encre"}`}>
        {nombre}
      </span>
      <span className="text-[12.5px] text-encre-3">{mot}</span>
    </span>
  )
}

/** Un manque, et le geste qui le comble — **quand ce geste existe**.
 *
 *  Sans `onFaire`, la carte dit ce qui manque et s'arrête là. C'est le cas de
 *  la plupart des manques que la planche dessine avec un bouton : générer les
 *  calques d'équipement en masse, dupliquer, comparer à un autre sujet n'ont
 *  aucune route. *Une commande que rien n'appelle est une ligne morte* — le
 *  motif est déjà tenu par `Famille.tsx`. */
function Manque({
  titre,
  quoi,
  faire,
  onFaire,
}: {
  titre: string
  quoi: string
  faire?: string
  onFaire?: () => void
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <p className="text-[13px] font-medium text-encre">{titre}</p>
      <p className="text-[12px] leading-[1.5] text-encre-2">{quoi}</p>
      {faire && onFaire && (
        <button
          type="button"
          onClick={onFaire}
          className="h-[30px] rounded-7 border border-contour bg-carte text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
        >
          {faire}
        </button>
      )}
    </div>
  )
}

// ── L'onglet « Sa fiche » ───────────────────────────────────────────────────

/** Ce que la fiche lit au serveur, **et que la page tient à sa place**.
 *
 *  Les deux lectures vivent un cran au-dessus parce que l'onglet se démonte en
 *  changeant : gardées ici, revenir sur la fiche ne redemande rien, et le
 *  critère *passer d'un onglet à l'autre ne recharge pas* vaut dans les deux
 *  sens et pas seulement en s'en allant. */
type CeQueLaFicheLit = {
  bareme: Echelle[]
  /** Les collections de ce sujet, ou `null` tant qu'on ne les sait pas. */
  siennes: Collection[] | null
  groupes: GroupeDeRangement[]
}

function SaFiche({
  personnage,
  plan,
  lu,
  onRange,
  onPersonnage,
  onArmer,
  onAnimer,
  onImages,
  onMatrice,
  dossierJeu,
  vestiaire,
  onPiece,
  onCreerPiece,
  onRetirerLEmploi,
  onErreur,
}: {
  personnage: Personnage
  plan: Pose[]
  lu: CeQueLaFicheLit
  onRange: () => void
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (personnage: Personnage, poses: Pose[]) => void
  onAnimer: (personnage: Personnage, pose: Pose) => void
  onImages: () => void
  onMatrice: () => void
  dossierJeu: string
  vestiaire: VestiaireDuJeu | null
  onPiece: (piece: string) => void
  onCreerPiece: (nom: string) => void
  onRetirerLEmploi: (piece: string, emploi: string) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [nom, setNom] = useState(personnage.nom)
  const [description, setDescription] = useState(personnage.description)
  const [rangerOuvert, setRangerOuvert] = useState(false)

  useEffect(() => {
    setNom(personnage.nom)
    setDescription(personnage.description)
  }, [personnage.identifiant, personnage.nom, personnage.description])

  const poser = useCallback(
    async (champs: { nom?: string; description?: string }) => {
      try {
        const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
        onPersonnage(rendu.personnage)
      } catch (erreur) {
        setNom(personnage.nom)
        setDescription(personnage.description)
        onErreur(erreur, "le réglage a été refusé")
      }
    },
    [personnage.identifiant, personnage.nom, personnage.description, onPersonnage, onErreur],
  )

  const { cases, tenues, faites } = comptes(personnage, plan)
  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])
  const argent = ceQueSesImagesOntCoute(personnage)
  const echelle = lu.bareme.find((e) => e.nom === personnage.type) ?? null

  const images = personnage.cases.reduce((somme, c) => somme + c.images.length, 0)
  // Ce qu'il porte, tel que le serveur le compte — et non les pièces trouvées
  // sur ses calques. Depuis `B19` les deux divergent : retirer un porteur ne
  // supprime aucune image, donc les calques d'une pièce qu'il ne porte plus
  // restent sur le disque. Compter les calques faisait dire « 2 équipements
  // portés » à la carte au-dessus d'un vestiaire qui n'en montrait qu'un.
  const equipements = personnage.pieces.length
  const animations = personnage.cases.reduce((somme, c) => somme + c.bandes.length, 0)
  const manquante = tenues.find(
    (p) => (cases[p.identifiant]?.images.length ?? 0) === 0,
  )

  const ranger = async (collection: string) => {
    try {
      await api.rangerSujet(collection, personnage.projet, personnage.identifiant)
      setRangerOuvert(false)
      onRange()
    } catch (erreur) {
      onErreur(erreur, "le rangement a été refusé")
    }
  }

  const retirer = async (collection: string) => {
    try {
      await api.retirerSujet(collection, personnage.projet, personnage.identifiant)
      onRange()
    } catch (erreur) {
      onErreur(erreur, "le retrait a été refusé")
    }
  }

  const siennes = lu.siennes
  const ailleurs = lu.groupes.filter(
    (g) => !(siennes ?? []).some((c) => c.identifiant === g.identifiant),
  )

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* `min-w-0` : sans lui, la fiche pousse le volet de 380 px hors de la
          fenêtre dès qu'on resserre — voir la note de `ImagesDuSujet.tsx`. */}
      <section className="defile flex min-h-0 min-w-0 flex-1 flex-col gap-[22px] overflow-y-auto pr-[14px]">
        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-[22px]">
          {/* ── Son image de référence ────────────────────────────────────── */}
          <div className="flex flex-col gap-[8px]">
            <Etiquette>Son image de référence</Etiquette>
            <div
              data-portrait-du-sujet
              className="flex h-[300px] items-center justify-center overflow-hidden rounded-8 bg-pourtour"
            >
              {portrait ? (
                <img
                  src={vignetteAsset(portrait.asset, 600)}
                  alt={portrait.asset.label}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="px-[14px] text-center text-[12.5px] text-eteint">
                  aucune image encore
                </span>
              )}
            </div>
            {portrait && (
              <button
                type="button"
                onClick={onImages}
                className="h-[34px] rounded-7 border border-contour bg-carte text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
              >
                En choisir une autre
              </button>
            )}
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              {portrait
                ? `C'est elle qui le représente — la retenue de ${portrait.pose}, sinon la plus récente. En retenir une autre dans « Ses images » change celle-ci.`
                : "Elle se choisit toute seule parmi ses images : la retenue d'abord, sinon la plus récente."}
            </p>
          </div>

          {/* ── Ce qu'il est ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-[14px]">
            <div className="grid grid-cols-2 gap-[14px]">
              <label className="flex flex-col gap-[4px]">
                <Etiquette>Son nom</Etiquette>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  onBlur={() => {
                    if (nom.trim() && nom !== personnage.nom) void poser({ nom: nom.trim() })
                    else setNom(personnage.nom)
                  }}
                  aria-label="Nom du sujet"
                  className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre outline-none focus:border-encre-4"
                />
              </label>
              <div className="flex flex-col gap-[4px]">
                <Etiquette>Son dossier</Etiquette>
                <span className="mesure flex h-[34px] items-center truncate rounded-7 border border-trait bg-papier-cote px-[14px] text-[12.5px] text-encre-4">
                  {personnage.identifiant}
                </span>
              </div>
            </div>
            <p className="text-[11.5px] text-encre-4">
              Le dossier est fixé à la création : le renommer casserait les images déjà
              sur le disque.
            </p>

            <label className="flex flex-col gap-[4px]">
              <span className="flex items-baseline justify-between">
                <Etiquette>Sa description</Etiquette>
                <span className="text-[11.5px] text-encre-4">
                  elle part avec chaque génération
                </span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== personnage.description) void poser({ description })
                }}
                rows={3}
                placeholder="ce qu'il faut redire au modèle à chaque image de ce sujet"
                aria-label="Description du sujet"
                className="defile resize-y rounded-8 border border-contour bg-carte p-[14px] text-[13px] leading-[1.55] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
              />
            </label>
            <p className="text-[11.5px] text-encre-4">
              En anglais : les modèles la comprennent mieux. Le reste du prompt vient du
              jeu.
            </p>

            <div className="grid grid-cols-2 gap-[22px]">
              <div className="flex flex-col gap-[8px]">
                <Etiquette>Ses collections</Etiquette>
                {siennes === null ? (
                  <p className="text-[12px] leading-[1.45] text-encre-4">
                    Elles se rangent depuis la grille de sa famille.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-[4px]">
                    {siennes.map((c) => (
                      <span
                        key={c.identifiant}
                        data-collection-du-sujet={c.identifiant}
                        className="inline-flex h-[26px] items-center gap-[4px] rounded-full bg-trait-faible px-[14px] text-[12.5px] text-encre-2"
                      >
                        {c.nom}
                        <button
                          type="button"
                          onClick={() => void retirer(c.identifiant)}
                          aria-label={`Retirer de ${c.nom}`}
                          className="text-encre-4 transition-colors duration-120 hover:text-echec"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {rangerOuvert ? (
                      ailleurs.length === 0 ? (
                        <span className="text-[12px] text-encre-4">
                          aucune autre collection
                        </span>
                      ) : (
                        ailleurs.map((g) => (
                          <button
                            key={g.identifiant}
                            type="button"
                            onClick={() => void ranger(g.identifiant)}
                            className="inline-flex h-[26px] items-center rounded-full border border-contour px-[14px] text-[12.5px] text-encre-2 transition-colors duration-120 hover:bg-ligne-ouverte"
                          >
                            {g.nom}
                          </button>
                        ))
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRangerOuvert(true)}
                        className="inline-flex h-[26px] items-center rounded-full border border-contour px-[14px] text-[12.5px] text-encre-4 transition-colors duration-120 hover:text-encre-2"
                      >
                        + ranger
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-[8px]">
                <Etiquette>Son type</Etiquette>
                <span className="text-[13px] font-medium text-encre">
                  {personnage.type || "aucun — il suit le plan du jeu"}
                </span>
                <span className="text-[11.5px] text-encre-3">
                  {echelle
                    ? `il occupe ${Math.round(echelle.occupation * 100)} % de la hauteur`
                    : "son occupation se règle dans les réglages de sa famille"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Ce qui existe de lui ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
          <Etiquette>Ce qui existe de lui</Etiquette>
          <div className="grid grid-cols-4 gap-[14px]">
            <Carte
              nombre={`${faites} / ${tenues.length}`}
              mot="poses"
              teinte={faites >= tenues.length && tenues.length > 0 ? "text-ok" : undefined}
            />
            <Carte nombre={String(images)} mot={images > 1 ? "images" : "image"} />
            <Carte
              nombre={String(equipements)}
              mot={equipements > 1 ? "équipements portés" : "équipement porté"}
            />
            <Carte
              nombre={String(animations)}
              mot={animations > 1 ? "animations" : "animation"}
            />
          </div>
        </div>

        {/* ── Son vestiaire (`B19`) ──────────────────────────────────────── */}
        {/* Il vient juste après *Ce qui existe de lui* parce qu'il en est la
            suite : la carte « équipements portés » ci-dessus donne le compte,
            celui-ci donne les images et les deux gestes. Les deux lisent la
            même liste — la carte compte `personnage.pieces`, la section lit le
            même partage dans le vestiaire résolu. */}
        <VestiaireDuSujet
          personnage={personnage}
          vestiaire={vestiaire}
          onPiece={onPiece}
          onCreerPiece={onCreerPiece}
          onRetirerLEmploi={onRetirerLEmploi}
        />

        <div className="flex items-center justify-between gap-[22px] border-t border-trait py-[8px] text-[12.5px] text-encre-3">
          <span>
            Rien de ce qui est ici ne coûte quoi que ce soit. Seul le champ du pied
            dépense.
          </span>
          {/* La porte de tout ce que B10 n'a pas repris : le vestiaire, la
              planche, le calibrage, la vitrine, le miroir, les poses cochées et
              la commande d'un clip vivent encore là. */}
          <button
            type="button"
            onClick={onMatrice}
            data-porte-de-la-matrice
            className="whitespace-nowrap text-[12.5px] text-encre-2 underline transition-colors duration-120 hover:text-encre"
          >
            Ses cases, une par une ›
          </button>
        </div>
      </section>

      {/* ── Ce qui lui manque ─────────────────────────────────────────────── */}
      <aside
        data-ce-qui-lui-manque
        aria-label="Ce qui lui manque"
        className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
      >
        <Etiquette>Ce qui lui manque</Etiquette>

        {manquante && (
          <Manque
            titre={`${tenues.length - faites} ${tenues.length - faites > 1 ? "poses" : "pose"} sans image`}
            quoi={`« ${manquante.nom} » n'a encore rien. Armer une case remplit le prompt et ne dépense pas : c'est le champ du pied qui paie.`}
            faire={`Armer ${manquante.nom}`}
            onFaire={() => onArmer(personnage, [manquante])}
          />
        )}

        {animations === 0 && tenues.length > 0 && (
          <Manque
            titre="Aucune animation"
            quoi="Ses poses sont des images fixes. Une marche demande plusieurs images de la même pose."
            faire="Commencer une animation"
            onFaire={() => onAnimer(personnage, tenues[0])}
          />
        )}

        {!personnage.description.trim() && (
          <Manque
            titre="Aucune description"
            quoi="Sans elle, chaque génération repart du nom seul. Elle s'écrit une fois, à gauche."
          />
        )}

        {manquante === undefined && animations > 0 && personnage.description.trim() && (
          <p className="text-[13px] leading-[1.45] text-encre-2">
            Rien ne manque : ses poses sont faites, il est décrit, il est animé.
          </p>
        )}

        <div className="mt-auto flex flex-col gap-[8px]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-[4px] text-[12.5px]">
            <span className="text-encre-2">Ce que ses images ont coûté</span>
            {/* **Le rouille ne teinte que ce qui coûte vraiment.** Un total à
                zéro — un sujet fait d'images importées — n'est pas une dépense,
                et le peindre en rouille en aurait fait une. Vu au navigateur,
                sur des images importées. */}
            <span
              className={`mesure text-right ${argent.total > 0 ? "text-signal" : "text-encre-3"}`}
            >
              {argent.total > 0 ? `$${argent.total.toFixed(3)}` : "rien"}
            </span>
            <span className="text-encre-2">Combien sont payées</span>
            <span className="mesure text-right text-encre">{argent.images}</span>
            <span className="text-encre-2">Le prix d'une de ses images</span>
            <span className="mesure text-right text-encre">
              {argent.images === 0 ? "—" : `$${argent.moyenne.toFixed(4)}`}
            </span>
          </div>
          <p className="text-[11.5px] leading-[1.45] text-encre-4">
            Ce total compte ses images, pas ses appels : une génération ratée ne laisse
            aucune image, et se lit dans Les dépenses.
          </p>
          <span aria-hidden className="h-px bg-contour" />
          <Exporter personnage={personnage} dossierJeu={dossierJeu} onErreur={onErreur} />
          <button
            type="button"
            onClick={async () => {
              try {
                const parti = await api.supprimerPersonnage(personnage.identifiant)
                onPersonnage({ ...parti.personnage, supprime: true })
              } catch (erreur) {
                onErreur(erreur, "le retrait a été refusé")
              }
            }}
            title="ses images restent, marquées « sujet supprimé »"
            className="h-[34px] rounded-7 px-[14px] text-left text-[12.5px] text-echec transition-colors duration-120 hover:bg-fond-echec"
          >
            Le retirer du jeu
          </button>
        </div>
      </aside>
    </div>
  )
}

/** Poser ses fichiers dans le dossier du jeu.
 *
 *  **Grisé avec sa raison, jamais caché** : ici la chose existe, et ce qui
 *  manque est nommé. Ce que la sortie regarde est `Case.corps`, calculé par le
 *  serveur — celui-là même qui écrira les fichiers. */
function Exporter({
  personnage,
  dossierJeu,
  onErreur,
}: {
  personnage: Personnage
  dossierJeu: string
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [compte, setCompte] = useState<number | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => setCompte(null), [personnage.identifiant])

  const remplies = personnage.cases.filter((c) => c.corps).length
  const raison =
    remplies === 0
      ? "aucune pose remplie — il n'y a rien à sortir"
      : !dossierJeu.trim()
        ? "aucun dossier de jeu — pose-le dans L'installation"
        : null

  return (
    <>
      <button
        type="button"
        disabled={raison !== null || enCours}
        onClick={async () => {
          setEnCours(true)
          try {
            const sortie = await api.sortirPersonnage(personnage.identifiant)
            setCompte(sortie.compte)
          } catch (erreur) {
            onErreur(erreur, "la sortie a été refusée")
          } finally {
            setEnCours(false)
          }
        }}
        className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-left text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:border-trait disabled:text-eteint"
      >
        {enCours ? "Sortie…" : "L'exporter pour le moteur…"}
      </button>
      <p className="text-[11.5px] leading-[1.45] text-encre-4">
        {raison ??
          (compte === null
            ? `Un fichier par pose, dans ${dossierJeu}. C'est le rendu qui part ; l'image payée reste ici.`
            : `${compte} fichiers posés. Rien n'a été écrasé.`)}
      </p>
    </>
  )
}

// ── La page ─────────────────────────────────────────────────────────────────

export function PageDuSujet(proprietes: {
  ouvert: Personnage
  plan: Pose[]
  /** Tous les sujets du jeu — **pour en poser un à côté dans l'essai** (`B12`)
   *  et comparer les tailles en mouvement. Ils sont déjà chargés un cran
   *  au-dessus ; un appel de plus pour les relire ferait deux vérités. */
  personnages: Personnage[]
  /** Les règles du jeu, pour la case et la couleur de fond de la scène de
   *  l'essai (`B12`) — la même prop que `GrilleDuJeu` et `Comparer` reçoivent. */
  univers: Univers
  emplacements: EmplacementCorps[]
  pieces: Piece[]
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onArmer: (
    personnage: Personnage,
    poses: Pose[],
    piece?: Piece | null,
    direction?: string | null,
    directions?: string[] | null,
  ) => void
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  dossierJeu: string
  onFente: (fente: Fente) => void
  barreQuiPaie: ReactNode
  onOuvrirCase: (identifiant: string) => void
  onMonterLaBande: (clip: string) => void
  onOuvrirLaBande: (bande: string) => void
  onSuperposition: (identifiant: string) => void
  onSupprimer: (identifiants: string[]) => void
  /** Ouvre la grille du jeu pour ce sujet (`B13`) — une profondeur de plus de
   *  cette page, comme la matrice. */
  onGrille: () => void
  /** Et comparer, à côté — la même profondeur, l'autre écran. */
  onComparer: () => void
  /** Le vestiaire résolu du jeu (`B19`), ou `null` tant qu'on ne l'a pas lu.
   *  La fiche montre ce que **ce sujet-là** porte, jamais l'équipement du jeu
   *  entier — c'est le troisième grief que la tranche lève. */
  vestiaire: VestiaireDuJeu | null
  /** Ouvrir la page d'une pièce. */
  onPiece: (piece: string) => void
  /** Nommer une pièce **que ce sujet porte** — elle lui est attribuée
   *  d'emblée, en un seul aller-retour. */
  onCreerPiece: (nom: string) => void
  /** Il ne la porte plus. **Ses calques restent** — jamais de cascade. */
  onRetirerLEmploi: (piece: string, emploi: string) => void
  /** **La chaîne de retouche redessinée** (B16) — sur l'image de référence du
   *  sujet. Optionnelle : la page se rend sans, et le bouton se grise alors
   *  comme les deux autres. */
  onRetoucher?: () => void
  outil: ReactNode
}) {
  const { ouvert, plan, barreQuiPaie, outil, onFente } = proprietes
  const [onglet, setOnglet] = useState<Onglet>("fiche")
  // **B13** — la grille du jeu et comparer n'ont rien à montrer sans une
  // image. Les deux liens se grisent avec leur raison plutôt que de
  // disparaître, comme partout ailleurs dans ce fichier.
  const auMoinsUneImage = ouvert.cases.some((c) => c.images.length > 0)
  // La matrice, profondeur suivante de cette page — voir l'en-tête du fichier.
  const [matriceOuverte, setMatriceOuverte] = useState(false)
  const [lu, setLu] = useState<CeQueLaFicheLit>({
    bareme: [],
    siennes: null,
    groupes: [],
  })
  const [range, setRange] = useState(0)

  // Changer de sujet rend la fiche et referme la matrice : les onglets décrivent
  // celui qu'on regardait, et rester sur « Ses images » du précédent ferait
  // croire qu'on regarde encore les siennes.
  useEffect(() => {
    setOnglet("fiche")
    setMatriceOuverte(false)
  }, [ouvert.identifiant])

  // **Le barème du jeu, pour l'occupation de sa nature.** Lu une fois pour la
  // vie de la page : il ne change pas pendant qu'on regarde un sujet.
  useEffect(() => {
    let vivant = true
    void api
      .univers()
      .then((recu) => vivant && setLu((avant) => ({ ...avant, bareme: recu?.univers?.bareme ?? [] })))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  // **Les collections de ce sujet, et il faut aller les chercher loin.** Aucune
  // route ne dit « dans quelles collections est ce sujet » : la seule qui le
  // sache est celle de sa famille (B9), et elle répond par une page de sujets.
  // On l'interroge donc sur son nom, et on s'y retrouve par son identifiant.
  // Introuvable, la fiche ne ment pas — elle dit où l'on range.
  useEffect(() => {
    let vivant = true
    setLu((avant) => ({ ...avant, siennes: null, groupes: [] }))
    void api
      .familleDeSujets(ouvert.famille, { recherche: ouvert.nom })
      .then((recu) => {
        if (!vivant) return
        const sien = (recu?.personnages ?? []).find(
          (s) => s.identifiant === ouvert.identifiant,
        )
        setLu((avant) => ({
          ...avant,
          siennes: sien ? (sien.collections as Collection[]) : null,
          groupes: recu?.groupes ?? [],
        }))
      })
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [ouvert.identifiant, ouvert.nom, ouvert.famille, range])

  const echouer = useCallback(
    (erreur: unknown, defaut: string) =>
      onFente({
        ton: "echec",
        texte: erreur instanceof Refus || erreur instanceof Error ? erreur.message : defaut,
      }),
    [onFente],
  )

  const sienPlan = ouvert.plan ?? plan

  // **La matrice prend toute la page, la barre qui paie comprise** : elle est
  // l'un des deux lieux d'où l'argent part, et la lui retirer aurait obligé à
  // remonter d'un cran pour dépenser.
  if (matriceOuverte || outil)
    return (
      <div data-etabli className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier">
        {!outil && (
          <div className="flex items-center gap-[8px] border-b border-trait bg-papier-cote px-[30px] py-[8px]">
            <button
              type="button"
              onClick={() => setMatriceOuverte(false)}
              className="h-[26px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
            >
              ‹ Sa page
            </button>
            <span className="text-[12.5px] text-encre-3">
              Ses cases — le vestiaire, les planches, le calibrage et les animations
              vivent encore ici.
            </span>
          </div>
        )}
        <EcranEtabli {...proprietes} />
      </div>
    )

  return (
    <main
      data-etabli
      data-page-du-sujet
      aria-label={`La page de ${ouvert.nom}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
              {ouvert.nom}
            </h1>
            <p className="text-[13px] text-encre-2">
              {ouvert.type || "un sujet"} — ces quatre onglets sont le même écran.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-[14px]">
          <div role="tablist" aria-label="La page du sujet" className="flex gap-[4px] self-start rounded-8 bg-papier-cote p-[4px]">
            {ONGLETS.map(({ clef, nom }) => (
              <button
                key={clef}
                type="button"
                role="tab"
                aria-selected={onglet === clef}
                onClick={() => setOnglet(clef)}
                className={[
                  "flex h-[30px] items-center rounded-7 px-[14px] text-[13.5px] transition-colors duration-120",
                  onglet === clef
                    ? "bg-carte font-medium text-encre"
                    : "text-encre-3 hover:text-encre",
                ].join(" ")}
              >
                {nom}
              </button>
            ))}
          </div>

          {/* **B13** — la grille du jeu, et comparer : deux profondeurs de
              plus de cette page, jamais deux onglets de plus, parce
              qu'aucune des deux ne remplace la fiche ou les images. Grisées
              avec leur raison tant que le sujet n'a aucune image : la
              grille n'aurait rien à poser, et comparer rien à montrer. */}
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={proprietes.onGrille}
              disabled={!auMoinsUneImage}
              title={auMoinsUneImage ? undefined : "aucune image encore — rien à poser sur la grille"}
              className="h-[30px] rounded-7 px-[14px] text-[13.5px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:text-eteint disabled:hover:text-eteint"
            >
              Voir la grille du jeu
            </button>
            <button
              type="button"
              onClick={proprietes.onComparer}
              disabled={!auMoinsUneImage}
              title={auMoinsUneImage ? undefined : "aucune image encore — rien à comparer"}
              className="h-[30px] rounded-7 px-[14px] text-[13.5px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:text-eteint disabled:hover:text-eteint"
            >
              Comparer ›
            </button>
            {/* **B16** — la chaîne de retouche redessinée, troisième
                profondeur de cette page et la seule des trois qui écrive. Elle
                s'ouvre sur l'image de référence du sujet, celle que la fiche
                nomme déjà : la retouche d'une image précise garde sa porte, sur
                la ligne de l'image, dans *Ses images*. */}
            <button
              type="button"
              onClick={proprietes.onRetoucher}
              disabled={!auMoinsUneImage}
              title={auMoinsUneImage ? undefined : "aucune image encore — rien à retoucher"}
              className="h-[30px] rounded-7 px-[14px] text-[13.5px] text-encre-3 transition-colors duration-120 hover:text-encre disabled:text-eteint disabled:hover:text-eteint"
            >
              La retouche ›
            </button>
          </div>
        </div>

        {onglet === "fiche" && (
          <SaFiche
            personnage={ouvert}
            plan={sienPlan}
            lu={lu}
            onRange={() => setRange((n) => n + 1)}
            onPersonnage={proprietes.onPersonnage}
            onArmer={(personnage, poses) => proprietes.onArmer(personnage, poses)}
            onAnimer={(personnage, pose) => proprietes.onAnimer(personnage, pose)}
            onImages={() => setOnglet("images")}
            onMatrice={() => setMatriceOuverte(true)}
            dossierJeu={proprietes.dossierJeu}
            vestiaire={proprietes.vestiaire}
            onPiece={proprietes.onPiece}
            onCreerPiece={proprietes.onCreerPiece}
            onRetirerLEmploi={proprietes.onRetirerLEmploi}
            onErreur={echouer}
          />
        )}

        {onglet === "images" && (
          <ImagesDuSujet
            personnage={ouvert}
            plan={sienPlan}
            pieces={proprietes.pieces}
            onArmer={proprietes.onArmer}
            onOuvrirCase={proprietes.onOuvrirCase}
            onEcarter={proprietes.onSupprimer}
            onErreur={echouer}
          />
        )}

        {onglet === "animations" && (
          <AnimationsDuSujet
            personnage={ouvert}
            plan={sienPlan}
            onAnimer={(personnage, pose, direction) =>
              proprietes.onAnimer(personnage, pose, direction)
            }
            onOuvrirLaBande={proprietes.onOuvrirLaBande}
            onErreur={echouer}
          />
        )}

        {onglet === "essai" && (
          <EssaiDuSujet
            personnage={ouvert}
            personnages={proprietes.personnages}
            plan={sienPlan}
            univers={proprietes.univers}
            onAnimer={(personnage, pose, direction) =>
              proprietes.onAnimer(personnage, pose, direction)
            }
            onAnimations={() => setOnglet("animations")}
          />
        )}
      </div>

      {/* Voir l'en-tête : sur *L'essai*, la porte vers la dépense est dans
          l'onglet, et la barre se retire pour qu'il n'y ait qu'un rouille. */}
      {onglet !== "essai" && barreQuiPaie}
    </main>
  )
}
