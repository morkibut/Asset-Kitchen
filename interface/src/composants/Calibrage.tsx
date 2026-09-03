// Le calibrage — toutes les poses d'une chose à la même hauteur (E17),
// **et l'écran dit enfin quel défaut il répare** (R9).
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
//
// ── Ce que R9 y a changé, et pourquoi ──────────────────────────────────────
//
// *« C'est super d'avoir plein d'outils, mais si on ne comprend pas à quoi ils
// servent ni comment on s'en sert, il faut les revoir. »*
//
// **Un outil montre le défaut qu'il répare avant de proposer de le réparer.**
// L'écran ouvrait sur « 6 poses · 5 calées » — un décompte — puis sur un bouton
// marqué « Calibrer les 5 poses » — un verbe. Rien ne disait ce qui n'allait
// pas, ni ce qu'on obtiendrait. Il ouvre maintenant sur la phrase du recueil,
// **lue et non retapée**, suivie des hauteurs réellement mesurées sur cette
// chose-ci ; puis sur les trois faits que le bouton engage, **au-dessus** de
// lui ; puis sur l'empilement d'aujourd'hui et celui d'après, côte à côte.
//
// **Le bouton annonce son résultat, pas son verbe** — « Mettre les 5 poses à
// 53 px » —, exactement comme le bouton qui paie annonce ce qu'il va coûter. Et
// il s'éteint quand il n'y a rien à changer, avec sa raison dans la fente
// permanente : il restait allumé sur une chose déjà calée, ce qui invite à un
// geste sans effet.
//
// **Deux symboles partent, deux mots les remplacent.** L'encadré « réf » et le
// rond plein étaient un vocabulaire à apprendre. *Prendre comme référence* et
// *mettre de côté* s'écrivent en toutes lettres dans le bloc de la pose choisie ;
// sur la ligne il ne reste qu'une marque dorée, sans encadré et sans clic —
// **une marque dit un état, un mot fait un geste.**
//
// **Et la silhouette revient sur chaque ligne**, comme le premier dessin le
// demandait sans que ce soit construit : c'est elle qui fait voir d'un coup que
// l'attaque est large et basse et que la mort est couchée, sans lire un chiffre.

import { useEffect, useState, type ReactNode, type Ref } from "react"
import { api, type Calibrage, type Personnage, type PoseCalee } from "../api"
import { Bouton, EnTeteDeSection, Libelle, Raison } from "./chassis"
import { PANNEAU, POINTILLE, useInfobulle } from "./Infobulle"

/** Les deux façons de regarder l'empilement.
 *
 *  **Trois traitements, la même silhouette** : la pose qu'on règle est pleine,
 *  la référence est à demi, les autres sont en transparence forte. `seules` ne
 *  garde que les deux premières — à six poses l'empilement devient une bouillie,
 *  et comparer deux silhouettes est très exactement ce qu'on vient faire.
 *
 *  **Une légende les nomme depuis R9.** Le premier dessin assumait de ne rien
 *  écrire ; à l'usage, personne ne devine que la silhouette à demi effacée est
 *  celle qui sert de référence. */
type Vue = "toutes" | "seules"

type Etat = "reglee" | "reference" | "autre"

/** Les trois traitements, nommés une fois — la légende et l'empilement lisent la
 *  même liste, sans quoi le carré de la légende et la silhouette qu'il annonce
 *  finiraient par ne plus se ressembler. */
const OPACITE: Record<Etat, string> = {
  reglee: "opacity-100",
  reference: "opacity-60",
  autre: "opacity-20",
}

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
  const retenues = lu?.poses.filter((p) => !p.de_cote) ?? []
  const misesDeCote = lu?.poses.filter((p) => p.de_cote) ?? []

  // **Pourquoi le bouton est éteint, et il l'est pour trois raisons distinctes.**
  // Le produit interdit de proposer puis de refuser : un contrôle indisponible
  // porte sa raison dans une petite ligne permanente juste en dessous. La règle
  // existait, l'écran ne l'appliquait pas ici — il s'éteignait dans le seul cas
  // dégénéré, et muet.
  const raisonDuBouton = !lu
    ? null
    : lu.poses.length === 0
      ? "aucune pose de cette chose n'a encore de corps — il n'y a rien à empiler"
      : retenues.length === 0
        ? "toutes les poses sont mises de côté — il ne reste rien à caler ensemble"
        : lu.a_faire === 0
          ? "elles y sont déjà — il n'y a rien à changer"
          : null

  return (
    <div
      data-calibrage
      className="grid min-h-0 flex-1 grid-cols-[308px_minmax(0,1fr)] bg-fond-0"
    >
      {/* **La colonne se déclare comme panneau** (R9) : elle porte cinq
          poignées d'explication sur 308 px, et une bulle qui sortirait de
          l'ancre seule couvrirait le réglage d'à côté — celui-là même qu'on
          compare. Elle n'en portait aucune avant cette tranche, et la
          déclaration n'avait donc rien à faire. */}
      <aside
        {...PANNEAU}
        className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord p-4"
      >
        <button
          type="button"
          onClick={onFermer}
          title="Échap ramène à l'établi"
          className="mesure -mb-2 self-end px-1 text-[10px] text-texte-3 hover:text-texte"
        >
          ‹ l'établi
        </button>

        {/* **Ce qu'il répare, avant de proposer de le réparer** (R9). La phrase
            est lue dans le recueil — l'entrée existait depuis le 30 août 2026 et
            n'était accrochée à rien —, et le pointillé sous le nom ouvre sa
            version longue. */}
        <EnTeteDeSection
          aide="etabli.calibrage"
          compte={
            lu
              ? `${lu.poses.length} pose${lu.poses.length > 1 ? "s" : ""} · ${
                  retenues.length
                } calée${retenues.length > 1 ? "s" : ""}${
                  misesDeCote.length
                    ? ` · ${misesDeCote.length} mise${misesDeCote.length > 1 ? "s" : ""} de côté`
                    : ""
                }`
              : undefined
          }
        />

        {refus && <Raison texte={refus} />}

        {lu && (
          <>
            {/* **Le défaut, sur cette chose-ci et non dans l'absolu** (R9). La
                maquette citait les six hauteurs du vrai projet ; les compter sur
                les poses qu'on a sous les yeux dit la même chose et ne peut pas
                devenir faux — c'est la leçon de `G1`, où douze phrases justes le
                jour de leur écriture avaient cessé de l'être. */}
            {lu.poses.length > 0 && (
              <p className="mesure -mt-2 text-[10px] leading-[1.5] text-texte-3">
                {lu.poses.length === 1 ? "sa pose sort" : "ses poses sortent"} à{" "}
                <span className="text-texte-2">
                  {lu.poses.map((p) => p.rendue).join(", ")}
                </span>{" "}
                px de haut
              </p>
            )}

            {/* ── Le calibrage ────────────────────────────────────────────── */}
            <section className="flex flex-col gap-1.5">
              {/* **Les faits sont au-dessus du bouton, une ligne par fait**
                  (R9). Ils étaient dessous, en un paragraphe de deux phrases
                  coupé par un retour à la ligne : on sait maintenant ce qu'on va
                  obtenir et ce qu'on va perdre avant d'avoir la main sur la
                  souris. */}
              <Libelle>ce que ça donnerait</Libelle>
              {lu.commune > 0 ? (
                <div className="flex flex-col">
                  <Fait nom="hauteur commune" valeur={`${lu.commune} px sur ${lu.cible}`} />
                  <Fait nom="la pose qui limite" valeur={lu.limite} dore />
                  <Fait
                    nom="résolution perdue"
                    valeur={
                      lu.perdus
                        ? `${lu.perdus} px · ${Math.round((lu.perdus / lu.cible) * 100)} %`
                        : "aucune"
                    }
                  />
                  {/* **La lecture du troisième fait, et non une raison** (R8) :
                      la fente sous un contrôle sert à dire pourquoi il est
                      éteint, et rien d'autre. Une explication rangée là prend
                      l'air d'un avertissement, et l'œil apprend à la sauter. */}
                  <p className="mt-1 text-[10px] leading-[1.5] text-texte-2">
                    c'est le prix de la cohérence : une fois calées, elles font
                    toutes la même taille dans le jeu
                  </p>
                </div>
              ) : (
                <p className="mesure text-[10px] leading-4 text-texte-3">
                  rien à mesurer tant qu'aucune pose n'a de corps
                </p>
              )}

              {/* **Le bouton annonce son résultat, pas son verbe** (R9) : le
                  nombre de poses qu'il touche et la hauteur qu'il pose. Cinq et
                  non six quand une pose est de côté — ce chiffre-là est
                  justement celui qu'on veut vérifier d'un coup d'œil avant
                  d'appuyer. */}
              <Bouton
                principal
                inactif={raisonDuBouton !== null}
                onClick={() =>
                  void appeler(
                    () => api.calibrer(personnage.identifiant),
                    "calibrage refusé",
                  )
                }
                enfants={`Mettre ${retenues.length > 1 ? `les ${retenues.length} poses` : "la pose"} à ${lu.commune} px`}
              />
              {/* **La fente permanente, et elle ne sert qu'à ça** : dire
                  pourquoi le bouton est éteint. Il s'éteignait déjà, dans le
                  seul cas dégénéré, et il s'éteignait **muet**. */}
              <Raison texte={raisonDuBouton} />

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
                  aide="calibrage.occupation"
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
                  aide="calibrage.decalage"
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

                {/* **Les deux gestes s'écrivent en toutes lettres** (R9), et ils
                    ont quitté la ligne de pose, qui n'a pas la place. Le produit
                    dit déjà *retenir*, *éteindre*, *rallumer* : un geste est un
                    mot. */}
                <div className="mesure flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1 text-[10px]">
                  <Geste
                    aide="calibrage.reference"
                    onClick={() => setReference(courante.pose)}
                    inactif={courante.pose === reference}
                    ton="epingle"
                  >
                    {courante.pose === reference
                      ? "c'est la référence"
                      : "prendre comme référence"}
                  </Geste>
                  <Geste
                    aide="calibrage.mise_de_cote"
                    onClick={() =>
                      void appeler(
                        () =>
                          api.mettreDeCote(
                            personnage.identifiant,
                            courante.pose,
                            !courante.de_cote,
                          ),
                        "mise de côté refusée",
                      )
                    }
                    ton="signal"
                  >
                    {courante.de_cote
                      ? "la faire rentrer dans le calage"
                      : "mettre de côté"}
                  </Geste>
                </div>

                {/* **En gris de lecture, pas dans la fente des refus** (R8) :
                    c'est une explication, et la fente ne porte que des
                    raisons. */}
                <p className="text-[10px] leading-[1.5] text-texte-2">
                  la taille est une part de la case : changer la taille de la
                  case ne défait aucun calage
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
                    {quoi === "toutes" ? "toutes les poses" : "celle-ci et la référence"}
                  </button>
                ))}
              </div>
              {/* **La légende nomme les trois traitements** (R9). Le premier
                  dessin assumait de n'écrire rien ; à l'usage, personne ne
                  devine que la silhouette à demi effacée est la référence. */}
              <ul className="mesure flex flex-col gap-1 text-[9.5px] text-texte-3">
                <Legende etat="reglee" quoi={`celle qu'on règle${reglee ? ` — ${reglee}` : ""}`} />
                <Legende
                  etat="reference"
                  quoi={`la référence${reference ? ` — ${reference}` : ""}`}
                />
                {vue === "toutes" && <Legende etat="autre" quoi="les autres poses" />}
              </ul>
            </section>
          </>
        )}
      </aside>

      {lu && (
        <Scene calibrage={lu} reglee={reglee} reference={reference} vue={vue} />
      )}
    </div>
  )
}

/** Un geste écrit en toutes lettres, **et qui porte son explication**.
 *
 *  **Le mot est à la fois le geste et la poignée**, et c'est pour ça que le
 *  pointillé se pose ici sans `Libelle` : un élément focalisable imbriqué dans un
 *  bouton est du HTML invalide et un piège au clavier. `epinglable: false` laisse
 *  le survol et le focus sur le bouton lui-même — c'est déjà l'idiome de l'en-tête
 *  d'un bloc repliable, repris tel quel.
 *
 *  **Les deux entrées existent parce que les deux gestes ne se devinent pas** :
 *  prendre une pose comme référence ne change rien à ce qui sera écrit, et mettre
 *  une pose de côté ne la fait pas disparaître. Deux malentendus qu'une bulle
 *  lève, et qu'aucun mot de deux syllabes ne lèverait. */
function Geste({
  aide,
  onClick,
  inactif = false,
  ton,
  children,
}: {
  aide: string
  onClick: () => void
  inactif?: boolean
  ton: "epingle" | "signal"
  children: ReactNode
}) {
  const infobulle = useInfobulle(aide, { epinglable: false })
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={inactif}
        {...infobulle.declencheurs}
        className={
          ton === "epingle"
            ? "text-epingle hover:text-texte disabled:text-texte-3"
            : "text-signal hover:text-signal-clair disabled:text-texte-3"
        }
      >
        <span
          ref={infobulle.ancre as Ref<HTMLSpanElement>}
          className={infobulle.presente ? POINTILLE : ""}
        >
          {children}
        </span>
      </button>
      {infobulle.bulle}
    </>
  )
}

/** Un fait qui justifie le bouton : son nom à gauche, son chiffre à droite.
 *
 *  **Une ligne par fait, jamais un paragraphe** (R9) : les trois se lisent
 *  comme une colonne, et un chiffre se compare à celui du dessus. */
function Fait({
  nom,
  valeur,
  dore = false,
}: {
  nom: string
  valeur: string
  dore?: boolean
}) {
  return (
    <p
      data-fait
      className="mesure flex h-[18px] items-baseline gap-2 text-[10px] text-texte-3"
    >
      <span className="min-w-0 flex-1 truncate">{nom}</span>
      <span className={dore ? "shrink-0 text-epingle" : "shrink-0 text-texte-2"}>
        {valeur}
      </span>
    </p>
  )
}

/** Une entrée de la légende : le carré traité comme la silhouette qu'il
 *  annonce, et le mot à côté. */
function Legende({ etat, quoi }: { etat: Etat; quoi: string }) {
  return (
    <li data-legende className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={[
          "inline-block h-[9px] w-[9px] shrink-0 rounded-[1px] bg-texte-2",
          OPACITE[etat],
        ].join(" ")}
      />
      <span className="min-w-0 truncate">{quoi}</span>
    </li>
  )
}

/** Une pose dans la colonne : sa silhouette, son nom, et ses deux mesures.
 *
 *  **Le pourcentage est ce qu'on écrit, les pixels sont ce qu'on obtient**, et
 *  les deux ne disent pas la même chose — c'est la même règle que dans la table
 *  grille, où un pourcentage seul ment aux petites cases.
 *
 *  **Deux colonnes de largeur fixe, et la ligne ne se replie plus** (R9). Les
 *  deux mesures tenaient dans une seule chaîne — « 100 % · 64 px » — dans un
 *  espace de 86 px sans insécable : ses quatre espaces étaient quatre points de
 *  coupe, et la ligne s'étalait sur trois. On lit maintenant la colonne des
 *  hauteurs comme une colonne, et c'est là que le défaut se voit.
 *
 *  **Il ne reste sur la ligne qu'une marque, sans encadré et sans clic** : les
 *  deux gestes sont descendus dans le bloc de la pose choisie, en toutes
 *  lettres. Une marque dit un état, un mot fait un geste. */
function LignePose({
  pose,
  reglee,
  reference,
  onRegler,
}: {
  pose: PoseCalee
  reglee: boolean
  reference: boolean
  onRegler: () => void
}) {
  return (
    <li className="flex h-[34px] items-center gap-2">
      {/* **La silhouette était au premier dessin et n'a jamais été
          construite** (R9) : c'est elle qui fait voir d'un coup que l'attaque
          est large et basse, sans lire un chiffre. La vignette et non l'image
          pleine — six timbres-poste ne valent pas six fichiers entiers. */}
      <span
        data-silhouette
        className="damier flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-[1px] border border-bord"
      >
        <img
          src={api.vignette(pose.asset, pose.empreinte, 64)}
          alt=""
          loading="lazy"
          decoding="async"
          className={pose.de_cote ? "h-full w-full opacity-50 grayscale" : "h-full w-full"}
          style={{ imageRendering: "pixelated" }}
        />
      </span>
      <button
        type="button"
        aria-pressed={reglee}
        onClick={onRegler}
        className={[
          "mesure min-w-0 flex-1 truncate rounded-[2px] px-1 text-left text-[11px] transition-colors duration-[80ms]",
          reglee ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
          pose.de_cote ? "line-through opacity-60" : "",
        ].join(" ")}
      >
        {pose.pose}
      </button>
      {/* La marque de la référence : un mot doré, sans encadré et sans clic. La
          colonne est réservée sur toutes les lignes, sinon les deux mesures
          danseraient d'une ligne à l'autre. */}
      <span
        data-marque-reference
        className="mesure w-[22px] shrink-0 text-right text-[9px] text-epingle"
      >
        {reference ? "réf" : ""}
      </span>
      <span className="mesure w-[36px] shrink-0 text-right text-[9.5px] whitespace-nowrap text-texte-3">
        {pose.de_cote ? "" : `${pose.occupation} %`}
      </span>
      <span
        className={[
          "mesure w-[46px] shrink-0 text-right text-[9.5px] whitespace-nowrap",
          pose.de_cote ? "text-texte-3" : "text-texte-2",
        ].join(" ")}
      >
        {pose.de_cote ? "de côté" : `${pose.rendue} px`}
      </span>
    </li>
  )
}

/** Un réglage repris à la main : sa valeur, et les deux crans qui la bougent.
 *
 *  **Pas de rail** : la valeur se lit et se tape, et les deux boutons font le
 *  pas de un. Un rail demanderait une largeur que cette colonne n'a pas, et le
 *  chiffre est ce qu'on regarde.
 *
 *  **Le nom porte son explication depuis R9** : c'est un libellé, donc une
 *  poignée, et les deux entrées du recueil s'ouvrent d'où l'on règle. */
function Reglage({
  nom,
  aide,
  valeur,
  unite,
  min,
  max,
  onChange,
}: {
  nom: string
  aide: string
  valeur: number
  unite: string
  min: number
  max: number
  onChange: (valeur: number) => void
}) {
  const borner = (v: number) => Math.max(min, Math.min(max, v))
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0">
        <Libelle aide={aide}>{nom}</Libelle>
      </span>
      <input
        type="number"
        value={valeur}
        min={min}
        max={max}
        onChange={(e) => onChange(borner(Number(e.target.value)))}
        aria-label={`${nom} de la pose réglée`}
        className="mesure h-[26px] w-[60px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte-2"
      />
      <span className="mesure w-[18px] shrink-0 text-[9.5px] text-texte-3">
        {unite}
      </span>
      <button
        type="button"
        onClick={() => onChange(borner(valeur - 1))}
        aria-label={`${nom} — un de moins`}
        className="mesure h-[26px] w-[26px] shrink-0 rounded-[2px] border border-bord text-[11px] text-texte-2 hover:text-signal"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onChange(borner(valeur + 1))}
        aria-label={`${nom} — un de plus`}
        className="mesure h-[26px] w-[26px] shrink-0 rounded-[2px] border border-bord text-[11px] text-texte-2 hover:text-signal"
      >
        +
      </button>
    </div>
  )
}

/** La scène — **l'empilement d'aujourd'hui et celui d'après, côte à côte** (R9).
 *
 *  C'est la réponse visuelle à *« qu'est-ce que ce bouton va faire »*, et elle
 *  se lit avant qu'on ait touché à quoi que ce soit.
 *
 *  **Quand il n'y a rien à calibrer, la seconde case ne se dessine pas** : la
 *  répéter à l'identique serait un dessin qui ment sur son propre propos. La
 *  place revient à une phrase qui dit pourquoi il n'y a rien à faire. */
function Scene({
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
  // telle quelle. La largeur de référence tombe de 384 à 256 px parce que deux
  // cases se partagent maintenant la place.
  const aFaire = calibrage.a_faire > 0
  const large = aFaire ? 256 : 200
  const echelle = Math.max(1, Math.floor(large / Math.max(1, calibrage.cible)))
  const cote = calibrage.cible * echelle

  const montrees = calibrage.poses
    .map((pose) => ({
      pose,
      etat: (pose.pose === reglee
        ? "reglee"
        : pose.pose === reference
          ? "reference"
          : "autre") as Etat,
    }))
    .filter(({ etat }) => vue === "toutes" || etat !== "autre")

  // **Le compte est celui des hauteurs distinctes, pas celui des poses** : deux
  // poses qui sortent à la même hauteur ne sont pas deux hauteurs, et écrire
  // « 4 hauteurs différentes » sous quatre poses dont deux sont d'accord est un
  // chiffre faux — la famille de défauts que `G1` a passé une tranche à
  // corriger.
  const hauteurs = calibrage.poses.map((p) => p.rendue)
  const distinctes = new Set(hauteurs)
  const etendue =
    distinctes.size > 1
      ? `de ${Math.min(...hauteurs)} à ${Math.max(...hauteurs)} px · ${distinctes.size} hauteurs différentes`
      : `toutes à ${hauteurs[0] ?? 0} px`

  return (
    <div className="flex min-h-0 flex-col items-center justify-center gap-4 overflow-auto p-8">
      <div className="flex items-end gap-10">
        <Empilement
          titre="aujourd'hui"
          montrees={montrees}
          cote={cote}
          echelle={echelle}
          commune={0}
          sous={etendue}
        />
        {aFaire ? (
          <Empilement
            titre="après le calibrage"
            apres
            montrees={montrees}
            cote={cote}
            echelle={echelle}
            commune={calibrage.commune}
            sous={
              calibrage.poses.some((p) => p.de_cote)
                ? `toutes à ${calibrage.commune} px · la pose mise de côté reste où elle est`
                : `toutes à ${calibrage.commune} px`
            }
          />
        ) : (
          <div className="max-w-[230px] self-center">
            <p className="mb-2.5 font-serif text-[24px] leading-[1.2] text-texte-2">
              Rien à calibrer.
            </p>
            <p className="text-[12px] leading-[1.5] text-texte-3">
              Les poses de cette chose atteignent déjà la même hauteur. Le bouton
              se rallumera de lui-même dès qu'une pose sortira à une autre taille.
            </p>
          </div>
        )}
      </div>
      <p className="mesure text-[9.5px] text-texte-3">
        case de {calibrage.cible} × {calibrage.cible} px, montrée ×{echelle}
        {calibrage.commune > 0 &&
          " · la ligne dorée est la hauteur que toutes atteindront"}
      </p>
    </div>
  )
}

/** Une case et ce qu'elle contient — la même, deux fois, à deux moments. */
function Empilement({
  titre,
  apres = false,
  montrees,
  cote,
  echelle,
  commune,
  sous,
}: {
  titre: string
  apres?: boolean
  montrees: { pose: PoseCalee; etat: Etat }[]
  cote: number
  echelle: number
  commune: number
  sous: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={[
          "mesure text-[9.5px] tracking-[.11em] uppercase",
          apres ? "text-ok" : "text-texte-3",
        ].join(" ")}
      >
        {titre}
      </span>
      <div
        data-canevas={apres ? "apres" : "aujourdhui"}
        className="damier relative"
        style={{ width: cote, height: cote }}
      >
        {montrees.map(({ pose, etat }) => (
          <Silhouette
            key={pose.pose}
            pose={pose}
            cote={cote}
            etat={etat}
            apres={apres}
          />
        ))}

        {/* La hauteur commune, et le sol. Deux traits qu'on ne discute pas. */}
        {commune > 0 && (
          <div
            aria-hidden
            data-hauteur-commune
            className="absolute right-0 left-0 border-t border-dashed border-epingle/70"
            style={{ bottom: commune * echelle }}
          >
            <span className="mesure absolute -top-[13px] right-[3px] text-[9px] text-epingle">
              {commune} px
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="absolute right-0 bottom-0 left-0 border-t border-bord-fort"
        />
      </div>
      <span className="mesure text-[9.5px] text-texte-3">{sous}</span>
    </div>
  )
}

/** Une silhouette dans l'empilement.
 *
 *  **Trois niveaux de lecture, et la légende les nomme depuis R9.** Celle qu'on
 *  règle est pleine, la référence est à demi, les autres sont en transparence
 *  forte. Une image mise de côté reste montrée — sortir du calage n'est pas
 *  disparaître.
 *
 *  **L'après est la même image, agrandie autour de son ancrage.** Le produit ne
 *  fabrique aucune image pour ce dessin : la pose rendrait `apres` pixels là où
 *  elle en rend `rendue`, et le rapport des deux est exactement ce qu'on lui
 *  applique. L'agrandir autour du centre la ferait décoller du sol quand elle
 *  est ancrée en bas — c'est pourquoi l'ancrage voyage avec la pose. */
function Silhouette({
  pose,
  cote,
  etat,
  apres,
}: {
  pose: PoseCalee
  cote: number
  etat: Etat
  apres: boolean
}) {
  const facteur = apres ? pose.apres / Math.max(1, pose.rendue) : 1
  return (
    <img
      // **Le rendu change sous la même adresse à chaque cran**, et l'empreinte
      // de la recette est ce qui fait chercher une image neuve au navigateur.
      // Sans elle, on réglerait l'occupation en regardant l'image d'avant.
      src={`/api/assets/${pose.asset}/image?v=${pose.empreinte}`}
      alt={pose.pose}
      className={[
        "absolute inset-0",
        OPACITE[etat],
        // **Mise de côté n'est pas disparue** : elle reste montrée, en gris, et
        // sa case se remplit comme les autres. Seul le calage commun l'ignore.
        pose.de_cote ? "grayscale" : "",
      ].join(" ")}
      style={{
        width: cote,
        height: cote,
        imageRendering: "pixelated",
        transform: facteur === 1 ? undefined : `scale(${facteur})`,
        transformOrigin:
          pose.ancrage === "centre" ? "center center" : "bottom center",
      }}
      title={
        apres
          ? `${pose.pose} — ${pose.apres} px de haut après le calibrage`
          : `${pose.pose} — ${pose.rendue} px de haut, ${pose.occupation} % de la case`
      }
    />
  )
}
