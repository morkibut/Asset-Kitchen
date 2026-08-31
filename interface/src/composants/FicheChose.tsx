// La fiche d'une chose du jeu — ce qu'elle est, ce qui l'habille, ce qu'on lui
// réclame (E12).
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

import { useCallback, useEffect, useState } from "react"
import {
  api,
  NOM_CHAMP,
  type Habillage,
  type ChampHabille,
  type Personnage,
  type Pose,
  type ReferencesDeLaChose,
} from "../api"
import { Libelle, Raison } from "./chassis"

/** Les cinq blocs, dans l'ordre où leur contenu part vers le modèle. */
const BLOCS = [
  "Ce qu'il est",
  "Ce qui l'habille",
  "Ses images de référence",
  "Ce que le jeu lui réclame",
  "Ce qui est fait",
] as const

type Bloc = (typeof BLOCS)[number]

export function FicheDeLaChose({
  personnage,
  plan,
  onPersonnage,
  onFermer,
  onErreur,
}: {
  personnage: Personnage
  /** Ce que cette chose-là réclame (E9) — sa liste, pas celle du jeu. */
  plan: Pose[]
  onPersonnage: (personnage: Personnage & { supprime?: boolean }) => void
  onFermer: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const [bloc, setBloc] = useState<Bloc>("Ce qu'il est")
  const [habillage, setHabillage] = useState<Habillage | null>(null)
  const [references, setReferences] = useState<ReferencesDeLaChose | null>(null)

  const relire = useCallback(() => {
    void api
      .habillage(personnage.identifiant)
      .then((recu) => setHabillage(recu ?? null))
      .catch(() => setHabillage(null))
    void api
      .referencesDeLaChose(personnage.identifiant)
      .then((recu) => setReferences(recu ?? null))
      .catch(() => setReferences(null))
  }, [personnage.identifiant])

  useEffect(relire, [relire, personnage.ambiance, personnage.cases.length])

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

  return (
    // **Trois colonnes — 240 · 1fr · 380**, les mêmes que le codex et la
    // galerie. À gauche les cinq blocs ; au milieu celui qui est ouvert ; à
    // droite la matrice, qui ne bouge pas : on règle à gauche et on voit les
    // cases changer à droite, sans rien refermer.
    <div
      data-fiche
      className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_380px]"
    >
      <aside className="defile flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-bord bg-fond-1 p-3">
        <Libelle>sa fiche</Libelle>
        {BLOCS.map((nom) => (
          <button
            key={nom}
            type="button"
            aria-pressed={bloc === nom}
            onClick={() => setBloc(nom)}
            className={[
              "mesure flex h-[34px] w-full flex-col justify-center rounded-[2px] px-2 text-left text-[11.5px] transition-colors duration-[80ms]",
              bloc === nom ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
            ].join(" ")}
          >
            <span className="truncate">{nom}</span>
            {/* **La colonne porte la valeur de chaque bloc** : elle devient le
                récapitulatif de la chose, lisible sans rien ouvrir. */}
            <span className="truncate text-[9.5px] text-texte-3">
              {valeurDuBloc(nom, personnage, plan, habillage, references)}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onFermer}
          className="mesure mt-2 h-[26px] rounded-[2px] border border-bord px-2 text-[10px] text-texte-3 hover:text-signal"
        >
          Fermer la fiche — Échap
        </button>
      </aside>

      <div className="defile flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        {bloc === "Ce qu'il est" && (
          <CeQuIlEst personnage={personnage} onPoser={poser} />
        )}
        {bloc === "Ce qui l'habille" && (
          <CeQuiLHabille habillage={habillage} onPoser={poser} />
        )}
        {bloc === "Ses images de référence" && (
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
        )}
        {bloc === "Ce que le jeu lui réclame" && (
          <CeQuOnLuiReclame personnage={personnage} plan={plan} />
        )}
        {bloc === "Ce qui est fait" && <CeQuiEstFait personnage={personnage} plan={plan} />}
      </div>

      {/* **La matrice reste affichée**, et c'est la seule raison pour laquelle
          la fiche garde une colonne de 380 px au lieu de s'étaler : ranger une
          pose est un geste qui coûte ou qui économise, et on doit le voir au
          moment où on le fait. Sans ça on règle à l'aveugle et on découvre le
          résultat en refermant — l'aller-retour que la refonte supprime. */}
      <aside className="defile flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-bord bg-fond-1 p-3">
        <Libelle>Sa matrice</Libelle>
        <Raison texte="elle répond pendant qu'on règle" />
        <MatriceCompacte personnage={personnage} plan={plan} />
      </aside>
    </div>
  )
}

/** Ce que la colonne de gauche écrit sous chaque bloc. */
function valeurDuBloc(
  bloc: Bloc,
  personnage: Personnage,
  plan: Pose[],
  habillage: Habillage | null,
  references: ReferencesDeLaChose | null,
): string {
  const faites = personnage.cases.filter((c) => c.images.length >= c.demandees).length
  if (bloc === "Ce qu'il est")
    return personnage.description
      ? `signalement · ${personnage.description.length} caractères`
      : "aucun signalement — il part vide"
  if (bloc === "Ce qui l'habille")
    return habillage
      ? `7 champs · ${habillage.de_l_ambiance} de son ambiance`
      : "…"
  if (bloc === "Ses images de référence")
    return references ? `${references.disponibles} disponibles` : "…"
  if (bloc === "Ce que le jeu lui réclame")
    return `${plan.length} pose${plan.length > 1 ? "s" : ""} · ${personnage.ecartees.length} rangée${personnage.ecartees.length > 1 ? "s" : ""}`
  return `${faites} case${faites > 1 ? "s" : ""} sur ${plan.length}`
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
    <section className="flex flex-col gap-2">
      <Libelle>Ce qu'il est</Libelle>
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
      {personnage.description ? (
        <Raison texte={`${personnage.description.length} caractères — ils partent avec chaque image de cette chose`} />
      ) : (
        // Le manque n'a aucune couleur d'alerte, et il ne réclame rien : il se
        // constate.
        <Raison texte="aucun signalement — chaque appel part sans dire de quoi il s'agit" />
      )}
    </section>
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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <Libelle>Ce qui l'habille</Libelle>
        <span className="mesure text-[10px] text-texte-3">
          7 champs · {habillage.de_l_ambiance} viennent de son ambiance ·{" "}
          {habillage.poses_ici} posés sur cette chose seule
        </span>
      </div>

      {habillage.ambiance && (
        <Raison
          texte={`ambiance ${habillage.ambiance.nom} — elle remplace le monde, l'éclairage et le trait ; le corriger là-bas le corrige pour tout ce qui s'en sert`}
        />
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
          <span className="w-[80px] shrink-0 text-texte-3">taille</span>
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
          <span className="w-[80px] shrink-0 text-texte-3">palette</span>
          <span className="text-texte-2">
            {habillage.palette.nom} — {habillage.palette.couleurs} couleurs
          </span>
          <span className="text-texte-3">son ambiance</span>
        </div>
      )}
    </section>
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
        <span className="mesure w-[80px] shrink-0 text-[10px] text-texte-3">
          {NOM_CHAMP[champ.nom] ?? champ.nom}
        </span>
        {/* **L'origine est lisible sans clic** : c'est le seul moyen de savoir
            si corriger ici serait une exception ou une redite. */}
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

// ── 3 · Ses images de référence ─────────────────────────────────────────────

/** **Ce qui est disponible, pas ce qui part.** Ce qui part vraiment se coche
 *  juste avant de payer ; c'est ici que les images de référence d'une chose
 *  existent — on en promeut une, on en écarte une, et ça vaut pour toutes ses
 *  générations à venir. Une chose est définie à un seul endroit. */
function SesReferences({
  references,
  onPromouvoir,
}: {
  references: ReferencesDeLaChose | null
  onPromouvoir: (asset: string, promue: boolean) => void
}) {
  if (!references) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <Libelle>Ses images de référence</Libelle>
        <span className="mesure text-[10px] text-texte-3">
          {references.disponibles} disponible
          {references.disponibles > 1 ? "s" : ""}
        </span>
      </div>
      <Raison texte="ce bloc dit ce qui est disponible — ce qui part vraiment se coche juste avant de payer" />

      {references.lignes.length === 0 ? (
        <p className="mesure text-[10px] leading-4 text-texte-3">
          Aucune encore. Dix-sept appels payés sur vingt-huit sont partis sans
          une seule image de référence, sur des modèles qui en acceptent
          quatorze.
        </p>
      ) : (
        <ul className="flex flex-col">
          {references.lignes.map((ligne) => (
            <li
              key={`${ligne.genre}-${ligne.reference}`}
              className="mesure flex h-[30px] items-center gap-2 border-b border-bord text-[11px] text-texte-2 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate">{ligne.provenance}</span>
              <span className="shrink-0 truncate text-[9.5px] text-texte-3">
                {ligne.detail}
              </span>
              {ligne.genre === "asset" && (
                <button
                  type="button"
                  aria-label={`Dépromouvoir ${ligne.reference}`}
                  onClick={() => onPromouvoir(ligne.reference, false)}
                  title="elle reste en bibliothèque — c'est la promotion qu'on défait"
                  className="shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
                >
                  ×
                </button>
              )}
            </li>
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
          {references.propositions.map((proposition) => (
            <div
              key={proposition.reference}
              className="mesure flex h-[30px] items-center gap-2 text-[11px] text-texte-2"
            >
              <span className="min-w-0 flex-1 truncate">
                {proposition.provenance}
              </span>
              <span className="shrink-0 truncate text-[9.5px] text-texte-3">
                {proposition.detail}
              </span>
              <button
                type="button"
                onClick={() => onPromouvoir(proposition.reference, true)}
                className="mesure shrink-0 px-1 text-[10px] text-signal hover:text-signal-clair"
              >
                retenir ›
              </button>
            </div>
          ))}
        </div>
      )}

      {/* **La planche des directions n'est pas encore proposable**, et elle le
          dit plutôt que d'être absente : les directions arrivent avec la vue du
          jeu, et une pose n'a pas encore d'angles à montrer. */}
      <Raison texte="la planche des quatre directions viendra quand le jeu déclarera ses directions" />
    </section>
  )
}

// ── 4 · Ce que le jeu lui réclame ───────────────────────────────────────────

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
    <section className="flex flex-col gap-2">
      <Libelle>Ce que le jeu lui réclame</Libelle>
      <Raison texte="les poses viennent de son type d'objet, et elle peut en ajouter pour elle seule — ça se règle dans l'établi" />
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
    </section>
  )
}

// ── 5 · Ce qui est fait ─────────────────────────────────────────────────────

/** La porte de la vitrine, et le compte qui donne envie de l'ouvrir. */
function CeQuiEstFait({
  personnage,
  plan,
}: {
  personnage: Personnage
  plan: Pose[]
}) {
  const faites = personnage.cases.filter((c) => c.images.length >= c.demandees).length

  return (
    <section className="flex flex-col gap-2">
      <Libelle>Ce qui est fait</Libelle>
      <p className="font-serif text-[32px] leading-tight text-texte-2">
        {faites} case{faites > 1 ? "s" : ""} sur {plan.length}
      </p>
      <Raison texte="le codex compte, l'établi fabrique — la vitrine montrera, et elle a sa propre étape" />
    </section>
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
  const cases = Object.fromEntries(personnage.cases.map((c) => [c.pose, c]))
  const tenues = plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const faites = tenues.filter(
    (p) => (cases[p.identifiant]?.images.length ?? 0) >= p.images,
  ).length
  const rangees = plan.length - tenues.length

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
      <Raison texte="ranger une pose retire sa ligne et son coût — le compte des rangées reste écrit à côté" />
    </div>
  )
}
