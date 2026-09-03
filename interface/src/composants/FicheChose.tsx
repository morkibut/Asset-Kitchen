// La fiche d'une chose du jeu — ce qu'elle est, ce qui l'habille, ce qu'on lui
// réclame (E12), **et à quoi chaque partie sert** (R8).
//
// **Le codex dit ce qui manque. La fiche dit tout le reste.** L'établi n'a de la
// place que pour le travail : une colonne de 300 px à gauche, la matrice à
// droite, la barre qui paie en pied. Or une chose du jeu porte bien plus que
// ça — un signalement qui part dans chaque prompt, sept textes de style qui
// viennent du jeu ou de son ambiance, des images de référence qui partent avec
// elle. Rien de ça ne tient dans 300 px, et **rien de ça ne coûte un centime**.
//
// **Elle s'ouvre en plein cadre depuis l'établi**, exactement comme un outil de
// retouche s'y ouvre déjà — et comme lui, elle fait disparaître la barre qui
// paie, parce que régler ne se paie pas. Aucun lieu neuf, aucune largeur neuve.
//
// **La panne qu'elle répare est mesurée sur le vrai projet, le 30 août 2026.**
// Dix-sept appels payés sur vingt-huit sont partis sans une seule image de
// référence, sur des modèles qui en acceptent quatorze. La bible annonçait
// `64x64` en toutes lettres pendant que le projet imposait 128. Et quatre
// mécanismes du domaine — écrire un texte sur une chose, retenir une image,
// ranger une pose, ranger une référence — avaient zéro emploi sur trois
// personnages et quarante-huit images, faute d'un écran qui les atteigne.
//
// ── Ce que R8 y a changé, et pourquoi ───────────────────────────────────────
//
// **Elle ne montrait pas la chose dont elle est la fiche.** Pas une image, pas
// même son nom : le nom ne vivait que dans le fil du châssis, et l'écran entier
// était du texte. Elle porte maintenant, en tête, le portrait de la chose —
// **pris parmi ses images déjà faites**, rien n'est fabriqué et rien n'est payé
// — et son nom en grand, une seule fois.
//
// **Ses cinq parties étaient cinq onglets.** Pour savoir si une chose était bien
// réglée, il fallait cliquer cinq fois et se souvenir. Ce sont maintenant cinq
// sections d'une seule page qui défile, et la colonne de gauche en est le
// sommaire — exactement la disposition du Guide, qui est déjà celle du produit
// pour lire une page longue.
//
// **Et aucune de ces parties ne disait à quoi elle servait.** *« Il n'y a que du
// texte, pas une image. Pas d'explication sur le propos de chaque partie de la
// fiche et leur utilité. »* Chaque section porte donc son propos écrit sous son
// titre, et sa version longue au survol — **le même texte, lu dans le recueil**,
// jamais retapé ici. Voir `EnTeteDeSection`, dans le châssis.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  NOM_CHAMP,
  type Asset,
  type Calibrage,
  type Case,
  type Habillage,
  type ChampHabille,
  type Personnage,
  type Pose,
  type ReferenceDeLaChose,
  type ReferencesDeLaChose,
} from "../api"
import { explication } from "../aide"
import { EnTeteDeSection, Libelle } from "./chassis"
import { sujetAsset, sujetCarte, useVisee, vignetteAsset } from "./Apercu"

/** Les cinq blocs, dans l'ordre où leur contenu part vers le modèle.
 *
 *  **Chacun porte la clef de son entrée au recueil**, et c'est de là que
 *  viennent son titre et son propos : l'écran ne nomme plus ses sections
 *  lui-même. Corriger l'entrée corrige le sommaire, le titre, la bulle au
 *  survol et le guide, du même geste. */
const BLOCS = [
  { clef: "sujet", aide: "codex.chose.sujet" },
  { clef: "habillage", aide: "codex.chose.habillage" },
  { clef: "exemples", aide: "codex.chose.exemples" },
  { clef: "poses", aide: "codex.chose.poses" },
  { clef: "faites", aide: "codex.chose.faites" },
] as const

type Bloc = (typeof BLOCS)[number]["clef"]

/** **Où passe la ligne de lecture**, en pixels sous le haut de la colonne : une
 *  section devient *celle qu'on lit* quand son titre l'a franchie. Huit pixels
 *  et non un tiers de colonne — le titre est le repère, et le lire au tiers
 *  ferait basculer le sommaire sur la section suivante alors qu'on est encore
 *  dans la précédente. */
const LIGNE_DE_LECTURE = 8

/** Ce que la chose a de fait, **compté une seule fois** (R8).
 *
 *  Le même compte était écrit à trois endroits — le sommaire, un grand chiffre
 *  au milieu, le total de la matrice — et **deux d'entre eux ne comptaient pas
 *  pareil** : l'un portait sur toutes les cases, rangées comprises, l'autre sur
 *  les seules poses tenues. Une chose à 6 sur 21 dont on rangeait quinze poses
 *  passait à 6 sur 6 d'un côté et restait 6 sur 21 de l'autre.
 *
 *  **La définition retenue est celle de la matrice** : les poses que cette
 *  chose-là tient, les rangées comptées **à côté** et jamais fondues dedans.
 *  C'est celle qui porte le garde-fou — une jauge pleine obtenue en rangeant se
 *  lit comme telle. */
function comptes(personnage: Personnage, plan: Pose[]) {
  const cases: Record<string, Case> = Object.fromEntries(
    personnage.cases.map((c) => [c.pose, c]),
  )
  const tenues = plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const faites = tenues.filter((p) => {
    const sienne = cases[p.identifiant]
    return (sienne?.images.length ?? 0) >= (sienne?.demandees ?? p.images)
  }).length
  return { cases, tenues, faites, rangees: plan.length - tenues.length }
}

/** Le portrait de la chose — **pris parmi ses images déjà faites** (R8).
 *
 *  *« celle qu'on a marquée comme préférée, sinon la plus récente »* : c'est la
 *  règle que le produit emploie déjà pour désigner le corps qui part en planche
 *  d'équipement, et elle est reprise telle quelle plutôt que réinventée.
 *
 *  **Rien n'est fabriqué, rien n'est payé.** Sans aucune image faite, il n'y a
 *  pas de portrait — et c'est un état qui se constate, pas un manque à réparer :
 *  une chose neuve n'a rien à montrer d'elle-même, et une case vide le dit mieux
 *  qu'un dessin d'attente. */
function portraitDe(personnage: Personnage, plan: Pose[]): {
  asset: Asset
  pose: string
} | null {
  const { cases, tenues } = comptes(personnage, plan)
  for (const pose of tenues) {
    const images = cases[pose.identifiant]?.images ?? []
    if (!images.length) continue
    const favori = images.find((i) => i.favori)
    const recente = images.reduce((a, b) => (b.cree_le > a.cree_le ? b : a))
    return { asset: favori ?? recente, pose: pose.nom }
  }
  return null
}

export function FicheDeLaChose({
  personnage,
  plan,
  onPersonnage,
  onFermer,
  onVitrine,
  onCalibrage,
  onErreur,
}: {
  personnage: Personnage
  /** Ce que cette chose-là réclame (E9) — sa liste, pas celle du jeu. */
  plan: Pose[]
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onFermer: () => void
  /** **La fiche porte la porte de la vitrine**, et le compte qui donne envie de
   *  l'ouvrir. Elle n'en dessine rien : la vitrine est définie dans son propre
   *  écran, et une chose est définie à un seul endroit. */
  onVitrine: () => void
  /** **Et celle du calibrage** (R8). L'outil qui met toutes les poses d'une
   *  chose à la même taille ne s'atteignait que depuis l'établi ; la fiche est
   *  l'endroit où l'on regarde une chose en entier, et c'est là qu'on s'aperçoit
   *  qu'une pose sort du lot. */
  onCalibrage: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [enVue, setEnVue] = useState<Bloc>("sujet")
  const [habillage, setHabillage] = useState<Habillage | null>(null)
  const [references, setReferences] = useState<ReferencesDeLaChose | null>(null)
  // **L'état du calibrage, pour la ligne du sommaire** : combien de poses sont
  // déjà à la taille commune. Lu comme le reste, jamais recalculé ici — c'est le
  // service du calibrage qui décide de ce qu'est une pose calée.
  const [cale, setCale] = useState<Calibrage | null>(null)
  const defile = useRef<HTMLDivElement | null>(null)
  const sections = useRef<Record<string, HTMLElement | null>>({})

  const relire = useCallback(() => {
    void api
      .habillage(personnage.identifiant)
      .then((recu) => setHabillage(recu ?? null))
      .catch(() => setHabillage(null))
    void api
      .referencesDeLaChose(personnage.identifiant)
      .then((recu) => setReferences(recu ?? null))
      .catch(() => setReferences(null))
    void api
      .calibrage(personnage.identifiant)
      .then((recu) => setCale(recu ?? null))
      // Le calibrage n'est pas une condition de la fiche : sans lui, sa ligne
      // se tait plutôt que d'écrire un refus dans un sommaire.
      .catch(() => setCale(null))
  }, [personnage.identifiant])

  useEffect(relire, [relire, personnage.ambiance, personnage.cases.length])

  // **Le sommaire suit le défilement**, il ne le commande pas seul : on peut
  // descendre à la main et savoir où l'on est.
  //
  // **Lu à la demande, jamais par un guetteur** — et c'est un piège déjà payé,
  // écrit dans `docs/PIEGES.md` : *un `ResizeObserver` ne livre rien à un onglet
  // qui ne compose pas ses images*, parce que ses rappels passent par la boucle
  // de rendu. `IntersectionObserver` est de la même famille, et la première
  // écriture de cette fiche l'employait : sur un onglet qui ne se compose pas,
  // aucune section ne croise jamais rien et le sommaire reste allumé sur la
  // première pour toute la session. La garde du piège est la même ici : on lit
  // les positions **quand on défile**, avec `getBoundingClientRect`.
  //
  // **Et la règle qu'un guetteur ne pouvait pas rendre.** Les cinq sections
  // sont plus hautes que le tiers haut de la colonne — « ce qui l'habille » fait
  // 797 px mesurés —, si bien que trois d'entre elles croisent la bande à la
  // fois. Prendre la plus haute des trois désigne celle qu'on vient de quitter ;
  // prendre la plus basse désigne celle où l'on n'est pas encore arrivé. Celle
  // qu'on lit est **la dernière dont le titre a passé le haut**, et le fond de
  // la page est un cas à part : la dernière section ne peut plus l'atteindre.
  const suivre = useCallback(() => {
    const racine = defile.current
    if (!racine) return
    if (racine.scrollTop + racine.clientHeight >= racine.scrollHeight - 2) {
      setEnVue(BLOCS[BLOCS.length - 1].clef)
      return
    }
    const haut = racine.getBoundingClientRect().top + LIGNE_DE_LECTURE
    let choisie: Bloc = BLOCS[0].clef
    for (const { clef } of BLOCS) {
      const noeud = sections.current[clef]
      if (noeud && noeud.getBoundingClientRect().top <= haut) choisie = clef
    }
    setEnVue(choisie)
  }, [])

  useEffect(suivre, [suivre, personnage.identifiant])

  // **Échap rend l'établi, à l'endroit exact d'où l'on venait.** C'est le geste
  // que le produit emploie déjà pour fermer un plein cadre, et un second geste
  // ici aurait fait deux façons de sortir du même endroit.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  const poser = async (champs: Parameters<typeof api.reglerPersonnage>[1]) => {
    try {
      const rendu = await api.reglerPersonnage(personnage.identifiant, champs)
      onPersonnage(rendu.personnage)
      relire()
    } catch (erreur) {
      onErreur(erreur, "réglage refusé")
    }
  }

  const aller = (bloc: Bloc) => {
    sections.current[bloc]?.scrollIntoView({ behavior: "smooth", block: "start" })
    setEnVue(bloc)
  }

  const { faites, tenues, rangees } = comptes(personnage, plan)
  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])

  /** L'état d'une section dans le sommaire — **un mot ou deux, jamais une
   *  phrase tronquée** (R8). Un sommaire dit où aller, il ne résume pas ce qu'on
   *  y trouvera : le « 7 champs · 0 de son ambi… » d'avant ne résumait plus
   *  rien. */
  const etatDuBloc = (bloc: Bloc): string => {
    if (bloc === "sujet") return personnage.description ? "écrit" : "vide"
    if (bloc === "habillage")
      return habillage ? `${habillage.champs.length} textes` : "…"
    if (bloc === "exemples")
      return references ? `${references.disponibles} retenue${references.disponibles > 1 ? "s" : ""}` : "…"
    if (bloc === "poses")
      return `${tenues.length} pose${tenues.length > 1 ? "s" : ""}`
    return `${faites} sur ${tenues.length}`
  }

  return (
    // **Trois colonnes — 240 · 1fr · 380**, les mêmes que le codex et la
    // galerie. À gauche le sommaire ; au milieu les cinq sections, qui défilent
    // dans une seule page ; à droite la matrice, qui ne bouge pas : on règle à
    // gauche et on voit les cases changer à droite, sans rien refermer.
    <div
      data-fiche
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px]"
    >
      <aside className="defile flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-bord bg-fond-1 p-3">
        <Libelle>sa fiche</Libelle>
        {BLOCS.map(({ clef, aide }) => (
          <button
            key={clef}
            type="button"
            data-sommaire={clef}
            // **Le sommaire mène, il n'ouvre pas** : les cinq sections sont
            // toutes là. Son nom accessible le dit, et il le distingue du titre
            // de la section, qui porte le même mot trois centimètres plus loin.
            aria-label={`Aller à ${titreDuBloc(aide)}`}
            aria-pressed={enVue === clef}
            onClick={() => aller(clef)}
            // **Onze pixels et non onze et demi, et six de marge et non huit**
            // — mesuré au navigateur, pas deviné : à 11,5 px, « Ses images
            // d'exemple » demandait 138 px pour 125, et « Ce que le jeu
            // réclame » 145 pour 136. Un titre coupé dans un sommaire est pire
            // qu'un résumé coupé : on ne sait plus où l'on va.
            className={[
              "mesure flex h-[34px] w-full items-center gap-1.5 rounded-[2px] px-1.5 text-left text-[11px] transition-colors duration-[80ms]",
              enVue === clef ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
            ].join(" ")}
          >
            <span className="min-w-0 flex-1 truncate">{titreDuBloc(aide)}</span>
            {/* **La colonne porte l'état de chaque bloc** : elle devient le
                récapitulatif de la chose, lisible sans rien ouvrir. */}
            <span
              className={[
                "shrink-0 text-[9.5px]",
                clef === "faites" && faites === tenues.length && tenues.length > 0
                  ? "text-ok"
                  : "text-texte-3",
              ].join(" ")}
            >
              {etatDuBloc(clef)}
            </span>
          </button>
        ))}

        {/* **Le calibrage se rejoint depuis le sommaire.** C'est l'outil qui met
            toutes les poses d'une chose à la même taille ; on ne l'atteignait
            que depuis l'établi, alors que c'est ici qu'on regarde une chose en
            entier — et donc ici qu'on voit qu'une pose sort du lot. */}
        <button
          type="button"
          onClick={onCalibrage}
          className="mesure mt-2 flex h-[26px] w-full items-center gap-2 border-t border-bord px-2 pt-2 text-left text-[10px] text-texte-3 hover:text-signal"
        >
          <span className="min-w-0 flex-1 truncate">le calibrage</span>
          {cale && (
            <span className="shrink-0">
              {cale.poses.filter((p) => !p.de_cote).length} pose
              {cale.poses.filter((p) => !p.de_cote).length > 1 ? "s" : ""} calée
              {cale.poses.filter((p) => !p.de_cote).length > 1 ? "s" : ""}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onFermer}
          className="mesure mt-2 h-[26px] rounded-[2px] border border-bord px-2 text-[10px] text-texte-3 hover:text-signal"
        >
          Fermer la fiche — Échap
        </button>
      </aside>

      <div
        ref={defile}
        onScroll={suivre}
        className="defile flex min-h-0 min-w-0 flex-col overflow-y-auto"
      >
        {/* ── Le bandeau d'identité ────────────────────────────────────────
            **Une fiche montre la chose dont elle est la fiche.** Elle n'en
            montrait rien : ni image, ni nom sur sa propre surface. */}
        <div className="flex shrink-0 items-start gap-4 border-b border-bord p-4">
          <div className="flex w-[96px] shrink-0 flex-col gap-1">
            <span
              data-portrait
              className="damier flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-[1px] border border-bord"
            >
              {portrait && (
                <img
                  src={vignetteAsset(portrait.asset, 192)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </span>
            <span className="mesure w-[96px] text-center text-[9.5px] leading-4 text-texte-3">
              {portrait
                ? `sa pose « ${portrait.pose} »`
                : "aucune image encore"}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            {/* **Le seul emploi de la police à empattements sur cet écran**, et
                c'est un nom, pas une mesure : le grand chiffre à empattements
                qui occupait cette place est parti là où les chiffres vont. */}
            <h1 className="truncate font-serif text-[32px] leading-[1.05] text-texte">
              {personnage.nom}
            </h1>
            <p className="mesure text-[11px] leading-5 text-texte-2">
              {faites} case{faites > 1 ? "s" : ""} sur {tenues.length}
              {references && ` · ${references.disponibles} image${references.disponibles > 1 ? "s" : ""} d'exemple`}
              {habillage?.cible_px ? ` · pixel de ${habillage.cible_px} px` : ""}
            </p>
            <p className="mesure text-[10px] leading-4 text-texte-3">
              {personnage.ambiance
                ? habillage?.ambiance?.nom ?? "son ambiance"
                : "aucune ambiance"}
              {" · "}
              <button
                type="button"
                onClick={onVitrine}
                className="text-signal hover:text-signal-clair"
              >
                la voir en grand ›
              </button>
            </p>
          </div>
        </div>

        {/* ── Les cinq sections, dans une seule page qui défile ─────────────
            **Elles étaient cinq onglets** : pour savoir si une chose était bien
            réglée, il fallait cliquer cinq fois et se souvenir. C'est la
            disposition du Guide, celle que le produit emploie déjà pour lire
            une page longue. */}
        <section
          data-bloc="sujet"
          ref={(n) => {
            sections.current.sujet = n
          }}
          className="flex flex-col gap-3 border-b border-bord p-4"
        >
          <EnTeteDeSection
            aide="codex.chose.sujet"
            compte={`${personnage.description.length} lettres`}
          />
          <CeQuIlEst personnage={personnage} onPoser={poser} />
        </section>

        <section
          data-bloc="habillage"
          ref={(n) => {
            sections.current.habillage = n
          }}
          className="flex flex-col gap-3 border-b border-bord p-4"
        >
          <EnTeteDeSection
            aide="codex.chose.habillage"
            compte={
              habillage
                ? `${habillage.champs.length} textes · ${habillage.de_l_ambiance} de son ambiance`
                : "…"
            }
          />
          <CeQuiLHabille habillage={habillage} onPoser={poser} />
        </section>

        <section
          data-bloc="exemples"
          ref={(n) => {
            sections.current.exemples = n
          }}
          className="flex flex-col gap-3 border-b border-bord p-4"
        >
          <EnTeteDeSection
            aide="codex.chose.exemples"
            compte={
              references
                ? `${references.disponibles} retenue${references.disponibles > 1 ? "s" : ""} · ${references.propositions.length} proposée${references.propositions.length > 1 ? "s" : ""}`
                : "…"
            }
          />
          <SesReferences
            references={references}
            onPromouvoir={(asset, promue) =>
              void api
                .promouvoirReference(personnage.identifiant, asset, promue)
                .then((recu) => {
                  onPersonnage(recu.personnage)
                  setReferences(recu.references)
                })
                .catch((erreur) => onErreur(erreur, "promotion refusée"))
            }
          />
        </section>

        <section
          data-bloc="poses"
          ref={(n) => {
            sections.current.poses = n
          }}
          className="flex flex-col gap-3 border-b border-bord p-4"
        >
          <EnTeteDeSection
            aide="codex.chose.poses"
            compte={
              rangees > 0
                ? `${tenues.length} poses · ${rangees} rangée${rangees > 1 ? "s" : ""}`
                : `${tenues.length} pose${tenues.length > 1 ? "s" : ""} · rien de rangé`
            }
          />
          <CeQuOnLuiReclame personnage={personnage} plan={plan} />
        </section>

        <section
          data-bloc="faites"
          ref={(n) => {
            sections.current.faites = n
          }}
          className="flex flex-col gap-3 p-4"
        >
          <EnTeteDeSection
            aide="codex.chose.faites"
            compte={`${faites} case${faites > 1 ? "s" : ""} sur ${tenues.length}`}
          />
          <CeQuiEstFait
            personnage={personnage}
            plan={plan}
            onVitrine={onVitrine}
          />
        </section>
      </div>

      {/* **La matrice reste affichée**, et c'est la seule raison pour laquelle
          la fiche garde une colonne de 380 px au lieu de s'étaler : ranger une
          pose est un geste qui coûte ou qui économise, et on doit le voir au
          moment où on le fait.

          **Elle ne gagne aucune vignette, et c'est délibéré.** Son métier est de
          bouger pendant qu'on règle à gauche ; y poser des images en ferait une
          seconde planche contact, ce que le produit s'interdit — il n'a qu'une
          galerie d'images, et les images faites vivent à trois centimètres de
          là, dans la section qui les porte. */}
      <aside className="defile flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-bord bg-fond-1 p-3">
        <EnTeteDeSection aide="codex.chose.matrice" />
        <MatriceCompacte personnage={personnage} plan={plan} />
      </aside>
    </div>
  )
}

/** Le titre d'une section — **lu dans le recueil**, jamais écrit ici.
 *
 *  Le sommaire et la section portent donc littéralement le même mot, sans qu'on
 *  ait à les tenir d'accord : renommer une partie se fait dans le recueil, et
 *  les deux suivent. */
function titreDuBloc(aide: string): string {
  return explication(aide)?.nom ?? aide
}

// ── 1 · Ce qu'il est ────────────────────────────────────────────────────────

/** Le signalement — **le seul endroit du produit où on l'écrit**.
 *
 *  Mesuré : un personnage sur trois n'en avait aucun, et il avait quand même
 *  quatre appels payés. Le texte qui devait partir avec chacune de ses images
 *  était vide, et rien ne le disait. */
function CeQuIlEst({
  personnage,
  onPoser,
}: {
  personnage: Personnage
  onPoser: (champs: Parameters<typeof api.reglerPersonnage>[1]) => Promise<void>
}) {
  const [texte, setTexte] = useState(personnage.description)

  useEffect(() => setTexte(personnage.description), [personnage.description])

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={texte}
        rows={6}
        aria-label="Son signalement"
        placeholder="ce qu'il faut redire au modèle à chaque image de cette chose"
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => {
          if (texte !== personnage.description) void onPoser({ description: texte })
        }}
        className="mesure w-full max-w-[720px] resize-y rounded-[2px] border border-bord bg-fond-1 p-2 text-[11.5px] leading-5 text-texte placeholder:text-texte-3"
      />
      {/* **Le manque se constate, il ne s'écrit plus dans la fente des refus**
          (R8) : ce qui part vide est un fait sur la chose, pas un refus. Il est
          donc dans le gris de lecture, comme le propos au-dessus. */}
      {!personnage.description && (
        <p className="mesure text-[10px] leading-4 text-texte-2">
          aucun signalement — chaque appel part sans dire de quoi il s'agit
        </p>
      )}
    </div>
  )
}

// ── 2 · Ce qui l'habille ────────────────────────────────────────────────────

/** Les sept textes, **et d'où chacun vient**.
 *
 *  Un résumé ne dit pas ce qui part : l'établi écrivait « hérité de la bible —
 *  pixel · 64×64 · vue 3/4 » et cachait sept textes. Ici chacun porte son
 *  origine parmi cinq, **et l'origine est lisible sans clic**. */
function CeQuiLHabille({
  habillage,
  onPoser,
}: {
  habillage: Habillage | null
  onPoser: (champs: Parameters<typeof api.reglerPersonnage>[1]) => Promise<void>
}) {
  if (!habillage) return null

  return (
    <div className="flex flex-col gap-3">
      {habillage.ambiance && (
        <p className="mesure text-[10px] leading-4 text-texte-2">
          ambiance {habillage.ambiance.nom} — elle remplace le monde, l'éclairage
          et le trait ; le corriger là-bas le corrige pour tout ce qui s'en sert
        </p>
      )}

      {habillage.champs.map((champ) => (
        <ChampDeStyle key={champ.nom} champ={champ} onPoser={onPoser} />
      ))}

      {/* **La contradiction que seule la fiche met sous les yeux.** La taille de
          pixel s'impose — ni une ambiance ni une chose ne la change —, et deux
          champs de la bible écrivent la grille en toutes lettres. On demande
          donc au modèle une grille de 64 pendant que l'atelier ramène l'image
          sur 128. La fiche ne corrige rien : elle rend la faute impossible à ne
          pas voir. */}
      <div className="flex flex-col gap-1 border-t border-bord pt-3">
        <div className="mesure flex items-baseline gap-2 text-[10px]">
          <span className="w-[80px] shrink-0 text-texte-2">taille</span>
          <span className="text-texte-2">
            {habillage.cible_px
              ? `${habillage.cible_px} px de grille`
              : "aucune grille imposée"}
          </span>
          <span className="text-texte-3">verrouillé</span>
        </div>
        {habillage.desaccord.length > 0 && (
          <p className="mesure text-[10px] leading-4 text-echec">
            {habillage.desaccord.map((nom) => NOM_CHAMP[nom] ?? nom).join(" et ")}{" "}
            {habillage.desaccord.length > 1 ? "annoncent" : "annonce"} une autre
            grille dans le texte qui part — la bible se corrige dans l'Univers.
          </p>
        )}
      </div>

      {habillage.palette && (
        <div className="mesure flex items-baseline gap-2 text-[10px]">
          <span className="w-[80px] shrink-0 text-texte-2">palette</span>
          <span className="text-texte-2">
            {habillage.palette.nom} — {habillage.palette.couleurs} couleurs
          </span>
          <span className="text-texte-3">son ambiance</span>
        </div>
      )}
    </div>
  )
}

/** Un des sept textes, avec son origine et ce qu'il remplace. */
function ChampDeStyle({
  champ,
  onPoser,
}: {
  champ: ChampHabille
  onPoser: (champs: Parameters<typeof api.reglerPersonnage>[1]) => Promise<void>
}) {
  const [brouillon, setBrouillon] = useState(champ.texte)

  useEffect(() => setBrouillon(champ.texte), [champ.texte, champ.origine])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        {/* **Le nom d'un réglage n'est pas un grisé** (R8, `docs/DESIGN.md`
            § Color) : le gris le plus sourd porte l'indisponible, la méta et la
            raison — trois choses qu'autre chose redit ailleurs. Rien ne redit
            le nom d'un champ ; il est donc au gris de lecture. */}
        <span className="mesure w-[80px] shrink-0 text-[10px] text-texte-2">
          {NOM_CHAMP[champ.nom] ?? champ.nom}
        </span>
        {/* **L'origine est lisible sans clic** : c'est le seul moyen de savoir
            si corriger ici serait une exception ou une redite. Elle, en
            revanche, est bien une méta — le texte juste à côté la redit. */}
        <span className="mesure text-[9.5px] text-texte-3">
          {ORIGINE[champ.origine]}
          {champ.ambiance ? ` · ${champ.ambiance}` : ""}
          {champ.ouvert ? "" : " · fermé aux ambiances"}
        </span>
        {champ.origine === "eteint" ? (
          <button
            type="button"
            onClick={() => void onPoser({ rallumer: champ.nom })}
            className="mesure ml-auto px-1 text-[9.5px] text-signal hover:text-signal-clair"
          >
            rallumer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onPoser({ eteindre: champ.nom })}
            title="ce champ ne partira plus pour cette chose — un refus écrit, pas une case vide"
            className="mesure ml-auto px-1 text-[9.5px] text-texte-3 hover:text-echec"
          >
            éteindre
          </button>
        )}
      </div>

      {champ.origine === "eteint" ? (
        // Le texte qui serait parti, barré : on voit ce à quoi on a renoncé.
        <p className="mesure max-w-[720px] text-[11px] leading-5 text-texte-3 line-through">
          {champ.remplace || "—"}
        </p>
      ) : (
        <textarea
          value={brouillon}
          rows={2}
          aria-label={NOM_CHAMP[champ.nom] ?? champ.nom}
          placeholder="vide — ce que le jeu dit s'applique"
          onChange={(e) => setBrouillon(e.target.value)}
          onBlur={() => {
            if (brouillon !== champ.texte)
              void onPoser({ textes: { [champ.nom]: brouillon } })
          }}
          className="mesure w-full max-w-[720px] resize-y rounded-[2px] border border-bord bg-fond-1 p-2 text-[11px] leading-5 text-texte placeholder:text-texte-3"
        />
      )}

      {/* **Un texte écrit ici montre en dessous, barré, celui qu'il
          remplace** : on doit pouvoir lire ce à quoi on a renoncé sans aller
          le chercher ailleurs. */}
      {champ.origine === "ici" && champ.remplace && (
        <p className="mesure max-w-[720px] text-[10px] leading-4 text-texte-3 line-through">
          {champ.remplace}
        </p>
      )}
    </div>
  )
}

const ORIGINE: Record<string, string> = {
  jeu: "du jeu",
  ambiance: "son ambiance",
  ici: "écrit ici",
  eteint: "éteint",
  verrouille: "verrouillé",
}

// ── 3 · Ses images d'exemple ────────────────────────────────────────────────

/** **Ce qui est disponible, pas ce qui part.** Ce qui part vraiment se coche
 *  juste avant de payer ; c'est ici que les images de référence d'une chose
 *  existent — on en promeut une, on en écarte une, et ça vaut pour toutes ses
 *  générations à venir. Une chose est définie à un seul endroit.
 *
 *  **Chacune porte sa vignette depuis R8** : on retient ou on retire une image
 *  **en la regardant**, ce qui est très exactement le geste que la section
 *  demande. Elles étaient des lignes de texte avec un nom, et l'on décidait de
 *  mémoire. */
function SesReferences({
  references,
  onPromouvoir,
}: {
  references: ReferencesDeLaChose | null
  onPromouvoir: (asset: string, promue: boolean) => void
}) {
  if (!references) return null

  return (
    <div className="flex flex-col gap-3">
      {references.lignes.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-2">
          Aucune encore. Dix-sept appels payés sur vingt-huit sont partis sans
          une seule image de référence, sur des modèles qui en acceptent
          quatorze.
        </p>
      ) : (
        <ul className="flex flex-col">
          {references.lignes.map((ligne) => (
            <LigneReference
              key={`${ligne.genre}-${ligne.reference}`}
              ligne={ligne}
              action={
                ligne.genre === "asset"
                  ? {
                      mot: "retirer",
                      ton: "gris",
                      faire: () => onPromouvoir(ligne.reference, false),
                    }
                  : null
              }
            />
          ))}
        </ul>
      )}

      {/* **L'atelier propose de lui-même**, et il ne décide pas : il propose,
          avec la provenance écrite, et une proposition se refuse d'un clic. */}
      {references.propositions.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-bord pt-2">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            proposées, d'après ce qui est fait
          </span>
          <ul className="flex flex-col">
            {references.propositions.map((proposition) => (
              <LigneReference
                key={proposition.reference}
                ligne={proposition}
                action={{
                  mot: "retenir ›",
                  ton: "signal",
                  faire: () => onPromouvoir(proposition.reference, true),
                }}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="mesure text-[10px] leading-4 text-texte-2">
        la planche des quatre directions viendra avec la planche d'une pose : les
        angles existent, l'image qui les montre ensemble pas encore
      </p>
    </div>
  )
}

/** Une image d'exemple : sa vignette, son nom, ce qu'elle est, et le geste.
 *
 *  **La barre d'espace l'ouvre en grand**, du même geste que partout ailleurs
 *  dans le produit — il n'a jamais de bouton pour l'annoncer, et il n'en gagne
 *  pas un ici. */
function LigneReference({
  ligne,
  action,
}: {
  ligne: ReferenceDeLaChose
  action: { mot: string; ton: "gris" | "signal"; faire: () => void } | null
}) {
  const sujet =
    ligne.montre?.sorte === "asset"
      ? sujetAsset(ligne.montre.asset)
      : ligne.montre?.sorte === "carte"
        ? sujetCarte(ligne.montre.carte)
        : null
  const visee = useVisee(sujet)
  const vignette =
    ligne.montre?.sorte === "asset"
      ? vignetteAsset(ligne.montre.asset, 128)
      : (sujet?.src ?? "")

  return (
    <li
      className="flex h-[38px] items-center gap-2.5 border-b border-bord last:border-b-0"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <span
        data-vignette-exemple
        className={[
          "damier h-[30px] w-[30px] shrink-0 overflow-hidden rounded-[1px] border border-bord",
          ligne.ecartee ? "opacity-40" : "",
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
      <span className="mesure min-w-0 flex-1 truncate text-[11px] text-texte-2">
        {ligne.provenance}
      </span>
      <span className="mesure shrink-0 truncate text-[9.5px] text-texte-3">
        {ligne.detail}
      </span>
      {action && (
        <button
          type="button"
          aria-label={`${action.mot.replace(" ›", "")} ${ligne.provenance}`}
          onClick={action.faire}
          className={[
            "mesure shrink-0 px-1 text-[10px]",
            action.ton === "signal"
              ? "text-signal hover:text-signal-clair"
              : "text-texte-3 hover:text-echec",
          ].join(" ")}
        >
          {action.mot}
        </button>
      )}
    </li>
  )
}

// ── 4 · Ce que le jeu réclame ───────────────────────────────────────────────

/** Ce qu'elle réclame, pose par pose, **avec l'origine de chacune** (E9). */
function CeQuOnLuiReclame({
  personnage,
  plan,
}: {
  personnage: Personnage
  plan: Pose[]
}) {
  const origines = Object.fromEntries(
    personnage.cases.map((c) => [c.pose, c.origine]),
  )
  const tenues = plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const rangees = plan.filter((p) => personnage.ecartees.includes(p.identifiant))

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {tenues.map((pose) => (
          <li
            key={pose.identifiant}
            className="mesure flex h-[26px] items-center gap-2 border-b border-bord text-[11px] text-texte-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{pose.nom}</span>
            <span className="shrink-0 text-[10px] text-texte-3">
              {pose.images} image{pose.images > 1 ? "s" : ""}
            </span>
            <span className="shrink-0 text-[9.5px] text-texte-3">
              {origines[pose.identifiant] === "ici" ? "ajoutée ici" : "de son type"}
            </span>
          </li>
        ))}
      </ul>
      {rangees.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-bord pt-2">
          <span className="mesure text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            rangé — pas pour cette chose
          </span>
          <div className="flex flex-wrap gap-2">
            {rangees.map((pose) => (
              <span
                key={pose.identifiant}
                className="mesure h-[24px] rounded-[2px] border border-bord px-2 text-[10px] leading-[22px] text-texte-3 line-through opacity-60"
              >
                {pose.nom}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 5 · Ce qui est fait ─────────────────────────────────────────────────────

/** Les images déjà faites, **montrées** — et la porte de la vitrine.
 *
 *  **Un grand chiffre à empattements occupait cette place**, et il enfreignait
 *  deux fois la règle : une mesure s'écrit dans la police des mesures, et un
 *  compte déjà écrit ailleurs n'a pas besoin de trente-deux pixels. Ce qui le
 *  remplace est ce qu'on venait voir : les images.
 *
 *  **Une case vide occupe la même place qu'une case pleine** — c'est la règle du
 *  produit pour ses tableaux de poses : le manque prend autant de place que le
 *  fait, sinon on ne le voit plus. */
function CeQuiEstFait({
  personnage,
  plan,
  onVitrine,
}: {
  personnage: Personnage
  plan: Pose[]
  onVitrine: () => void
}) {
  const { cases, tenues } = comptes(personnage, plan)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        {tenues.map((pose) => {
          const images = cases[pose.identifiant]?.images ?? []
          const image = images.find((i) => i.favori) ?? images[images.length - 1]
          return (
            <CaseFaite key={pose.identifiant} nom={pose.nom} image={image ?? null} />
          )
        })}
      </div>
      <button
        type="button"
        onClick={onVitrine}
        className="mesure self-start text-[10px] text-signal hover:text-signal-clair"
      >
        les voir toutes en grand, l'une après l'autre ›
      </button>
      <p className="mesure text-[10px] leading-4 text-texte-2">
        sur le fond que la bible décrit, à des multiples entiers — rien n'est
        fabriqué ni modifié
      </p>
    </div>
  )
}

/** Une case du tableau des poses : son image, ou son absence, à taille égale. */
function CaseFaite({ nom, image }: { nom: string; image: Asset | null }) {
  const visee = useVisee(image ? sujetAsset(image) : null)
  return (
    <figure
      className="m-0 flex w-[56px] flex-col gap-1"
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
    >
      <span
        data-case-faite
        className={[
          "damier flex h-[56px] w-[56px] items-center justify-center overflow-hidden rounded-[1px] border border-bord",
          image ? "" : "border-dashed",
        ].join(" ")}
      >
        {image && (
          <img
            src={vignetteAsset(image, 128)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </span>
      <figcaption className="mesure w-[56px] truncate text-center text-[9.5px] text-texte-3">
        {nom}
      </figcaption>
    </figure>
  )
}

// ── La matrice, à droite ────────────────────────────────────────────────────

/** Ce qui est fait et ce qui manque, **pendant qu'on règle**.
 *
 *  **Le piège, et ce qui le tient** : ranger fait monter la jauge sans qu'une
 *  seule image ait été fabriquée — une chose à 6/21 passe à 6/6 si on range
 *  tout, et elle a l'air finie. Ce qui l'empêche est que le compte des rangées
 *  est écrit **à côté**, jamais fondu dedans : `6 / 6 · 15 rangées`, et une
 *  jauge pleine obtenue en rangeant se lit comme telle. */
function MatriceCompacte({
  personnage,
  plan,
}: {
  personnage: Personnage
  plan: Pose[]
}) {
  const { cases, tenues, faites, rangees } = comptes(personnage, plan)

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col">
        {tenues.map((pose) => {
          const combien = cases[pose.identifiant]?.images.length ?? 0
          return (
            <li
              key={pose.identifiant}
              className="mesure flex h-[26px] items-center gap-2 text-[11px] text-texte-2"
            >
              <span className="min-w-0 flex-1 truncate">{pose.nom}</span>
              <span
                className={[
                  "shrink-0 text-[10px]",
                  combien >= pose.images ? "text-ok" : "text-texte-3",
                ].join(" ")}
              >
                {combien} / {pose.images}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mesure border-t border-bord pt-2 text-[10px] text-texte-3">
        {faites} / {tenues.length}
        {rangees > 0 && ` · ${rangees} rangée${rangees > 1 ? "s" : ""}`}
      </p>
    </div>
  )
}
