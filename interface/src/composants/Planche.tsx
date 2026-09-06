// La planche d'une pose — ce qu'on achète, vu avant de payer (E13).
//
// **Quand un jeu regarde le monde de dessus, marcher n'est pas une image : c'est
// quatre.** Vers le nord, le sud, l'est, l'ouest. Un modèle fait payer chaque
// *appel*, pas chaque image — donc demander les quatre marches d'un coup, sur
// une seule feuille qu'on découpe ensuite, coûte beaucoup moins cher que quatre
// demandes séparées.
//
// **Cette feuille est l'unité de ce qu'on achète, et elle mérite son écran pour
// une raison simple** : il faut voir ce qu'on achète avant de payer — combien de
// cases, ce qui est écrit dans chacune, ce qui part en référence, et le prix.
//
// **C'est le seul plein cadre de l'établi qui garde la barre qui paie.** La
// fiche règle, la vitrine juge, le calibrage recalcule : aucun des trois ne
// dépense. Celui-ci, si — c'est même tout ce qu'il fait.
//
// **Il ne décide rien.** Choisir une ligne du tableau *arme* la barre qui paie ;
// c'est elle qui envoie, comme partout ailleurs dans le produit. Il n'existe
// qu'un seul endroit d'où l'argent part.

import { useEffect, useState } from "react"
import {
  api,
  dollars,
  type Personnage,
  type Planche,
  type Pose,
  type ChoixDePlanche,
  type CaseDePlanche,
} from "../api"
import { Bouton, Libelle, Raison } from "./chassis"
import { faitesDeLaCase } from "./Personnages"

export function EcranPlanche({
  personnage,
  pose,
  plan,
  onPose,
  onFermer,
  onVitrine,
  onArmer,
  onErreur,
}: {
  personnage: Personnage
  /** La pose dont on regarde la planche. **Tenue par l'établi**, pas ici : on
   *  change de pose en cliquant dans la matrice de droite, sans refermer. */
  pose: string
  plan: Pose[]
  onPose: (pose: string) => void
  onFermer: () => void
  /** **La quatrième porte de la vitrine** (E16). Son critère la réservait à E13
   *  — *la porte s'y posera avec elle, l'écran ne bouge pas* — et c'est le cas :
   *  la vitrine ne change pas d'une ligne, elle gagne un endroit d'où on
   *  l'ouvre. On regarde ce qu'on a avant de repayer ce qu'on a. */
  onVitrine: () => void
  /** **Armer, jamais envoyer.** La barre qui paie reçoit la pose et les
   *  directions ; elle seule appelle le fournisseur. */
  onArmer: (pose: string, directions: string[]) => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [lu, setLu] = useState<Planche | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  // Le choix retenu — de l'écran, jamais du serveur : c'est une intention, pas
  // un état du jeu, et l'enregistrer en ferait quelque chose à remettre
  // d'accord avec le disque à chaque image qui arrive.
  const [retenu, setRetenu] = useState<ChoixDePlanche["clef"]>("refaire")

  useEffect(() => {
    let vivant = true
    setLu(null)
    void api
      .planche(personnage.identifiant, pose)
      .then((recu) => {
        if (!vivant) return
        setLu(recu)
        setRefus(null)
        setRetenu("refaire")
      })
      .catch((erreur) => {
        if (!vivant) return
        setLu(null)
        setRefus(
          erreur instanceof Error ? erreur.message : "la planche ne répond pas",
        )
      })
    return () => {
      vivant = false
    }
  }, [personnage.identifiant, pose])

  useEffect(() => {
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [onFermer])

  const choix = lu?.choix.find((c) => c.clef === retenu) ?? null
  // **Quelles cases partent, selon le choix retenu.** Refaire les envoie toutes,
  // compléter n'envoie que les vides, et l'unité n'est pas une planche — elle
  // arme la première case qui manque, une à la fois.
  const partantes: string[] = !lu
    ? []
    : retenu === "refaire"
      ? lu.cases.map((c) => c.direction)
      : lu.cases.filter((c) => !c.pleine).map((c) => c.direction)

  const armer = () => {
    if (!lu || !choix || choix.refus) return
    try {
      // L'unité arme **une** case, pas une planche : c'est la génération de C1,
      // et la plier ferait payer un gabarit pour une image que le produit sait
      // déjà demander.
      onArmer(lu.pose, retenu === "unite" ? partantes.slice(0, 1) : partantes)
    } catch (erreur) {
      onErreur(erreur, "la planche n'a pas pu être armée")
    }
  }

  return (
    <div
      data-planche
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px] bg-fond-0"
    >
      {/* ── Les réglages ───────────────────────────────────────────────────
          Ce que l'atelier a décidé, montré et non modifiable : la grille se
          déduit du nombre de cases, et la changer casserait le rangement de ce
          qui revient. */}
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord p-4">
        <div className="flex items-baseline gap-2">
          <Libelle>la planche</Libelle>
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
            <section className="flex flex-col gap-1">
              <Mesure nom="Cases" valeur={`${lu.geometrie.cases}`} />
              <Mesure
                nom="Grille"
                valeur={`${lu.geometrie.colonnes} × ${lu.geometrie.lignes}`}
              />
              <Mesure
                nom="Un sujet revient à"
                valeur={`${lu.geometrie.sujet_px} px`}
              />
              {/* **Écrite par l'atelier, montrée, non modifiable** — avec sa
                  raison, comme tout ce qui est indisponible dans ce produit. */}
              <p className="mesure pt-1 text-[9.5px] leading-4 text-texte-3">
                la grille se déduit du nombre de cases, et elle n'est pas
                modifiable : c'est elle qui permet de découper le retour sans
                deviner.
                {lu.geometrie.cible_px > 0 && (
                  <>
                    {" "}
                    La cible du jeu est{" "}
                    <span className="text-texte-2">
                      {lu.geometrie.cible_px} px
                    </span>{" "}
                    — un sujet revient {lu.geometrie.fois_la_cible} fois plus
                    grand, donc plier ne coûte pas de qualité.
                  </>
                )}
              </p>
            </section>

            {/* ── Ce qui part en référence ────────────────────────────────
                **Compté par le serveur**, jamais par l'écran : il ne connaît
                ni les artworks du jeu, ni les concept arts de la chose, ni le
                dédoublonnage entre les trois. */}
            <section className="flex flex-col gap-1.5">
              <Libelle>les images jointes</Libelle>
              <Mesure
                nom="partent avec l'appel"
                valeur={`${lu.jointes.total}`}
              />
              <p className="mesure text-[9.5px] leading-4 text-texte-3">
                {[
                  lu.jointes.gabarit
                    ? `${lu.jointes.gabarit} gabarit de grille`
                    : "",
                  lu.jointes.artworks
                    ? `${lu.jointes.artworks} artwork${
                        lu.jointes.artworks > 1 ? "s" : ""
                      } du jeu`
                    : "",
                  lu.jointes.concepts
                    ? `${lu.jointes.concepts} concept art${
                        lu.jointes.concepts > 1 ? "s" : ""
                      }`
                    : "",
                  lu.jointes.manuelles
                    ? `${lu.jointes.manuelles} image${
                        lu.jointes.manuelles > 1 ? "s" : ""
                      } retenue${lu.jointes.manuelles > 1 ? "s" : ""}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "rien ne part en référence"}
                . Le gabarit dit au modèle où poser les {lu.geometrie.cases}{" "}
                sujets ; il compte dans le plafond du modèle, et chez ceux qui
                facturent au texte, il coûte.
              </p>
            </section>

            {/* ── Ce qui entre en bibliothèque ────────────────────────────
                **La phrase disait le contraire, et elle a tenu un jour.** Elle
                affirmait *la planche n'y entre pas — c'est une ruse pour payer
                moins, pas un format de livraison*, ce qui était vrai jusqu'au
                3 septembre 2026 à 23 h 45, heure de la livraison de G16. Depuis,
                la planche entre : elle se regarde, se met en favori, s'exporte,
                et un fichier entier du produit ne décrit qu'elle. L'écran, lui,
                n'avait pas été rouvert. */}
            <section className="flex flex-col gap-1.5">
              <Libelle>ce qui entre en bibliothèque</Libelle>
              <p className="mesure text-[10px] leading-4 text-texte-3">
                la planche <span className="text-texte-2">y entre</span>, et
                elle porte le prix de l'appel — ses {lu.geometrie.cases}{" "}
                morceaux entrent à côté, chacun dans sa direction, sans prix
                propre. Ce qui a été payé se regarde donc en entier : la feuille
                telle qu'elle est revenue, et ce que l'atelier en a tiré.
              </p>
            </section>

            {/* ── Ce que refaire coûte, nommé avant de lancer ────────────── */}
            {retenu === "refaire" && lu.deja_pleines.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <Libelle>ce que refaire coûte</Libelle>
                <p className="mesure text-[10px] leading-4 text-texte-3">
                  {lu.deja_pleines.length} case
                  {lu.deja_pleines.length > 1 ? "s sont" : " est"} déjà pleine
                  {lu.deja_pleines.length > 1 ? "s" : ""} —{" "}
                  <span className="text-texte-2">
                    {lu.deja_pleines.join(" · ")}
                  </span>
                  . L'ancienne image ne disparaît pas : elle reste en
                  bibliothèque avec son prix payé, et c'est la neuve qui prend la
                  case. Mais on aura payé deux fois pour cette case-là.
                </p>
              </section>
            )}
          </>
        )}
      </aside>

      {/* ── Ce qu'on regarde ───────────────────────────────────────────────── */}
      <section className="defile flex min-h-0 flex-col gap-5 overflow-y-auto p-5">
        {lu && (
          <>
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] text-texte">
                la planche de {lu.pose_nom}
              </h2>
              <span className="mesure text-[10px] text-texte-3">
                {lu.geometrie.cases} case{lu.geometrie.cases > 1 ? "s" : ""}
                {lu.deja_pleines.length > 0 &&
                  ` · ${lu.deja_pleines.length} déjà pleine${
                    lu.deja_pleines.length > 1 ? "s" : ""
                  }`}
              </span>
              {/* **On regarde ce qu'on a avant de repayer ce qu'on a** (E16).
                  La porte n'existe que quand il y a quelque chose à regarder :
                  une planche dont toutes les cases sont vides n'a rien à
                  montrer, et une porte qui ouvre sur le vide est pire qu'une
                  porte absente. */}
              {lu.deja_pleines.length > 0 && (
                <button
                  type="button"
                  onClick={onVitrine}
                  title="voir en grand ce qui est déjà fait, avant de le refaire"
                  className="mesure ml-auto px-1 text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
                >
                  la vitrine ›
                </button>
              )}
            </div>

            {lu.cases.length < 2 && (
              <Raison texte="ce jeu ne déclare qu'une direction pour cette pose — il n'y a rien à plier, et un appel simple suffit" />
            )}

            {/* ── Les cases, dans l'ordre de lecture de la grille ────────── */}
            <ul className="flex flex-col border-t border-bord">
              {lu.cases.map((cellule) => (
                <LigneDeCase
                  key={cellule.direction}
                  cellule={cellule}
                  part={partantes.includes(cellule.direction)}
                />
              ))}
            </ul>

            {/* ── Ce qu'on peut demander ─────────────────────────────────── */}
            <section className="flex flex-col gap-2">
              <Libelle>ce qu'on peut demander</Libelle>
              <ul className="flex flex-col">
                {lu.choix.map((ligne) => (
                  <LigneDeChoix
                    key={ligne.clef}
                    ligne={ligne}
                    retenu={ligne.clef === retenu}
                    onRetenir={() => !ligne.refus && setRetenu(ligne.clef)}
                  />
                ))}
              </ul>

              {/* **Les deux moitiés de ce que la mesure dit**, et la seconde
                  n'est pas un détail : elle explique pourquoi il n'y a qu'un
                  prix d'appel ici plutôt qu'un par nombre de cases. */}
              {lu.prix.mesure ? (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  une planche coûte le prix d'{" "}
                  <span className="text-texte-2">un appel</span>, quel que soit
                  ce qu'elle porte : {dollars(lu.prix.prix)} en médiane sur{" "}
                  {lu.prix.appels} appels{" "}
                  {lu.prix.origine === "ici"
                    ? "payés par ce modèle sur cette machine"
                    : "payés par les bancs du dépôt"}
                  . Le gain est par image — plus il y a de cases, moins chaque
                  image revient cher.
                  {lu.modele && (
                    <>
                      {" "}
                      Le prix est celui de{" "}
                      <span className="text-texte-2">{lu.modele}</span>, le
                      modèle de planche du jeu ; la barre qui paie garde celui
                      que vous y avez choisi.
                    </>
                  )}
                  {/* **L'écart de cette machine, quand il y en a un.** Deux
                      appels d'un même modèle peuvent avoir coûté exactement le
                      même prix ; l'écrire « de $0,0342 à $0,0342 » ne dit rien
                      et fait perdre confiance dans le reste. */}
                  {lu.prix.haut > lu.prix.bas && (
                    <>
                      <br />
                      Ici même, un appel a coûté de {dollars(lu.prix.bas)} à{" "}
                      {dollars(lu.prix.haut)}.
                    </>
                  )}
                  {/* **Pourquoi il n'y a pas un prix par nombre de cases**, et
                      les chiffres qui le portent. Ils viennent du banc, et
                      l'écran le dit : la phrase était affirmée sur les chiffres
                      de la machine, qui ne la démontraient pas. */}
                  {lu.banc.mesure && (
                    <>
                      <br />
                      Les bancs du dépôt ont payé {lu.banc.appels} appels, de une
                      à six cases : de {dollars(lu.banc.bas)} à{" "}
                      {dollars(lu.banc.haut)}, sans que le nombre de cases
                      explique l'écart —{" "}
                      <span className="text-texte-2">
                        deux appels identiques s'écartent plus que deux tailles
                        de planche
                      </span>
                      . Un prix par nombre de cases montrerait donc du bruit
                      comme si c'était une structure. Il n'y en a pas ici.
                    </>
                  )}
                </p>
              ) : (
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  aucun appel de planche n'a encore été mesuré dans ce dépôt —
                  les prix restent inconnus plutôt que devinés.
                </p>
              )}
            </section>

            {/* ── Ce qui part, et ce qu'un compte faux coûterait ─────────── */}
            {choix && (
              <section className="flex flex-col gap-1.5 border-t border-bord pt-4">
                <Bouton
                  principal
                  inactif={Boolean(choix.refus) || partantes.length === 0}
                  onClick={armer}
                  enfants={
                    choix.refus
                      ? choix.refus
                      : retenu === "unite"
                        ? `Armer la première case — ${
                            lu.cases.find((c) => !c.pleine)?.nom ?? ""
                          }`
                        : `Armer la planche — ${partantes.length} case${
                            partantes.length > 1 ? "s" : ""
                          }`
                  }
                />
                {/* **Trouvée en relisant l'écran en entier** (M4). Elle disait
                    *un compte de cases faux ne fait rien entrer*, ce qui n'est
                    plus vrai que d'une moitié depuis R6 : un sujet qui manque
                    refuse encore — il manque une étape, et aucun choix ne la
                    fabriquera —, mais un sujet de trop ne jette plus rien. Le
                    relevé qui a changé la règle est net : quatre planches sur
                    treize du banc d'animation étaient refusées pour un sujet en
                    trop, soit 31 % des appels payés perdus sur un geste dont
                    c'est le régime normal. */}
                <p className="mesure text-[9.5px] leading-4 text-texte-3">
                  armer pose la planche dans la barre qui paie, en bas : c'est
                  elle qui envoie, ici comme partout ailleurs. Un jet unique — le
                  modèle n'en rend pas deux. S'il revient{" "}
                  <span className="text-texte-2">moins</span> de sujets que de
                  cases, rien n'entre et la planche entière se relance, au prix
                  plein ; s'il en revient{" "}
                  <span className="text-texte-2">plus</span>, rien n'est jeté —
                  la planche s'ouvre avec ses sujets mesurés, et on écarte ceux
                  qu'on ne veut pas.
                </p>
              </section>
            )}
          </>
        )}
      </section>

      {/* ── La matrice — on change de pose sans refermer ──────────────────── */}
      <aside className="defile flex min-h-0 flex-col gap-1 overflow-y-auto border-l border-bord p-4">
        <Libelle>sa matrice</Libelle>
        <p className="mesure pb-1 text-[9.5px] leading-4 text-texte-3">
          on change de pose sans refermer
        </p>
        <ul className="flex flex-col">
          {plan
            .filter((p) => !personnage.ecartees.includes(p.identifiant))
            .map((attitude) => {
              const case_ = personnage.cases.find(
                (c) => c.pose === attitude.identifiant,
              )
              return (
                <li key={attitude.identifiant}>
                  <button
                    type="button"
                    aria-pressed={attitude.identifiant === pose}
                    onClick={() => onPose(attitude.identifiant)}
                    className={[
                      "mesure flex h-[44px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[11px] transition-colors duration-[80ms]",
                      attitude.identifiant === pose
                        ? "bg-fond-3 text-texte"
                        : "text-texte-2 hover:bg-fond-2 hover:text-texte",
                    ].join(" ")}
                  >
                    <span className="flex-1 truncate">{attitude.nom}</span>
                    <span className="text-[10px] text-texte-3">
                      {faitesDeLaCase(case_)} / {case_?.demandees ?? 0}
                    </span>
                  </button>
                </li>
              )
            })}
        </ul>
      </aside>
    </div>
  )
}

/** Un chiffre de la colonne de gauche : son nom, sa valeur.
 *
 *  **Aucun n'est réglable, et c'est le sujet** : la géométrie est écrite par
 *  l'atelier parce que c'est elle qui rend le découpage du retour possible. */
function Mesure({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <div className="mesure flex h-[24px] items-center gap-2 text-[10px]">
      <span className="flex-1 text-texte-3">{nom}</span>
      <span className="text-texte">{valeur}</span>
    </div>
  )
}

/** Une case de la planche : sa direction, son état, et ce qui est écrit dedans.
 *
 *  **Le texte vient du chemin de l'envoi**, pas d'une recomposition locale :
 *  c'est ce qui rend vraie la règle *ce qui est montré est ce qui part*, plutôt
 *  que seulement affirmée.
 *
 *  **Trois marques, et aucun glyphe neuf.** Le carré plein dit *prise*, le carré
 *  creux dit *attendue*, le pointillé dit *cette case part dans la planche en
 *  cours*. Le produit en a toujours eu trois. */
function LigneDeCase({
  cellule,
  part,
}: {
  cellule: CaseDePlanche
  part: boolean
}) {
  return (
    <li className="flex items-start gap-3 border-b border-bord py-2">
      <span
        aria-hidden
        title={
          part
            ? "cette case part dans la planche"
            : cellule.pleine
              ? "case prise"
              : "case attendue"
        }
        className={[
          "mt-[3px] h-[9px] w-[9px] shrink-0 rounded-[1px]",
          part
            ? "border border-dashed border-ancien-signal"
            : cellule.pleine
              ? "bg-texte-3"
              : "border border-bord",
        ].join(" ")}
      />
      <span className="mesure w-[72px] shrink-0 text-[11px] text-texte">
        {cellule.nom}
      </span>
      <span className="mesure w-[86px] shrink-0 text-[10px] text-texte-3">
        {cellule.pleine
          ? part
            ? "sera refaite"
            : `${cellule.images.length} image${
                cellule.images.length > 1 ? "s" : ""
              }`
          : "vide"}
      </span>
      <span className="min-w-0 flex-1 text-[11px] leading-4 text-texte-2">
        {cellule.texte || (
          <span className="text-texte-3">
            — pas de consigne : cette planche n'a qu'une case
          </span>
        )}
      </span>
      <span className="mesure shrink-0 text-[9.5px] text-texte-3">
        L{cellule.ligne + 1} C{cellule.colonne + 1}
      </span>
    </li>
  )
}

/** Une façon de remplir ce qui manque, avec son prix et son étayage.
 *
 *  **La colonne des appels n'est pas décorative** : c'est elle qui porte toute
 *  la différence, maintenant qu'on sait qu'une planche coûte le prix d'un appel
 *  quel que soit ce qu'elle porte. Et c'est aussi ce que le critère demande —
 *  le nombre d'appels sur lequel chaque prix repose, à côté du prix. */
function LigneDeChoix({
  ligne,
  retenu,
  onRetenir,
}: {
  ligne: ChoixDePlanche
  retenu: boolean
  onRetenir: () => void
}) {
  return (
    <li>
      <button
        type="button"
        disabled={Boolean(ligne.refus)}
        aria-pressed={retenu}
        onClick={onRetenir}
        title={ligne.refus || undefined}
        className={[
          "mesure flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[10px] transition-colors duration-[80ms]",
          ligne.refus
            ? "cursor-not-allowed text-texte-3"
            : retenu
              ? "bg-fond-3 text-texte"
              : "text-texte-2 hover:bg-fond-2 hover:text-texte",
        ].join(" ")}
      >
        <span className="flex-1 truncate">{ligne.quoi}</span>
        {/* **L'étayage à côté du prix**, jamais ailleurs : un gain annoncé sur
            une mesure unique est un gain encadré, pas un gain affirmé. */}
        <span className="w-[92px] shrink-0 text-right text-texte-3">
          {ligne.appels} appel{ligne.appels > 1 ? "s" : ""}
        </span>
        <span className="w-[64px] shrink-0 text-right">
          {ligne.mesure && ligne.cases > 0 ? dollars(ligne.prix) : "?"}
        </span>
        <span className="w-[92px] shrink-0 text-right text-texte-3">
          {ligne.mesure && ligne.cases > 0
            ? `${dollars(ligne.par_image)} l'image`
            : ""}
        </span>
      </button>
      {ligne.refus && (
        <p className="mesure px-2 pb-1 text-[9.5px] leading-4 text-texte-3">
          {ligne.refus}
        </p>
      )}
    </li>
  )
}
