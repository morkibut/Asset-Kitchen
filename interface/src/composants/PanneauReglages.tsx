// Le panneau des réglages — 300 px, largeur absolue et sans condition.
//
// « L'Atelier ne montre que ce qu'on touche à chaque génération : le sujet, le
// modèle, le nombre de variations — plus un bloc en lecture seule qui répond
// d'avance à *qu'est-ce qui part avec ?* » (`docs/DESIGN.md`).
//
// Les réglages propres à un modèle ne sont écrits nulle part ici : ils sont
// **dessinés depuis ce que le catalogue déclare**. Un modèle qui gagne un
// réglage demain l'affiche demain, sans une ligne de code.

import { useMemo, useState } from "react"
import {
  api,
  dollars,
  NOM_FAMILLE,
  type CompteReferences,
  type LigneReference,
  type Modele,
  type Personnage,
  type PorteeDurable,
  type Univers,
} from "../api"
import { Bloc, Libelle, Raison, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"

export function PanneauReglages({
  modeles,
  choisi,
  onChoisir,
  proportions,
  onProportions,
  variations,
  onVariations,
  options,
  onOptions,
  references,
  projet,
  univers,
  echelle,
  onEchelle,
  compte,
  cases,
  cout,
  cible,
  ecarteesGeneration,
  onEcarterGeneration,
  onErreur,
}: {
  modeles: Modele[]
  choisi: Modele | null
  onChoisir: (identifiant: string) => void
  proportions: string
  onProportions: (v: string) => void
  variations: number
  onVariations: (v: number) => void
  options: Record<string, string>
  onOptions: (o: Record<string, string>) => void
  /** Combien d'images réinjectées partiront avec l'appel (US-12, US-52). Le
   *  chiffre vient de l'écran parce que c'est lui qui les tient ; le **grisé**
   *  qui en découle, lui, vient du serveur — l'interface ne rejoue jamais la
   *  règle « ce modèle n'accepte que N références ». */
  references: number
  /** Le projet ouvert : c'est là que ce qui sort entrera (US-2). */
  projet: string | null
  /** L'univers du projet : son barème alimente le sujet, sa palette et sa
   *  taille de pixel s'affichent en lecture seule. « L'Atelier ne montre que ce
   *  qu'on touche à chaque génération — plus un bloc en lecture seule qui répond
   *  d'avance à *qu'est-ce qui part avec ?* » (`docs/DESIGN.md`). */
  univers: Univers
  /** Ce que l'auteur fabrique, choisi dans le barème du projet. */
  echelle: string
  onEchelle: (nom: string) => void
  /** Ce qui partira vraiment, artworks compris et dédoublonné — **calculé par
   *  le serveur** (US-52). L'écran ne connaît que sa moitié : il tient les
   *  réinjections posées à la main, pas les artworks que l'application ajoute. */
  compte: CompteReferences | null
  /** Combien de cases le lot armé demande, ou zéro pour une génération
   *  ordinaire — qui est le cas courant (C2, US-129). */
  cases: number
  /** Ce qu'une image de ce modèle a coûté, en médiane des derniers appels
   *  réussis **sur cette machine** (US-121). `null` — jamais appelé, et le
   *  produit le dit plutôt que d'inventer un tarif. */
  cout: number | null
  /** Le personnage visé, quand la matrice a armé (US-120). Il ouvre la portée
   *  du milieu — « pour ce personnage » —, et son absence la **grise avec sa
   *  raison** plutôt que de la cacher. */
  cible: Personnage | null
  /** Ce que **cette génération-ci** écarte. `null` — aucun avis, donc les deux
   *  portées durables s'appliquent telles que le serveur les rend. */
  ecarteesGeneration: string[] | null
  onEcarterGeneration: (ecartees: string[] | null) => void
  onErreur: (raison: string) => void
}) {
  const [filtre, setFiltre] = useState("")
  const echelleLue = univers.bareme.find((e) => e.nom === echelle) ?? null

  const listes = useMemo(() => {
    const terme = filtre.trim().toLowerCase()
    const retenus = terme
      ? modeles.filter(
          (m) =>
            m.nom.toLowerCase().includes(terme) ||
            m.identifiant.toLowerCase().includes(terme),
        )
      : modeles
    // Le modèle choisi reste visible même quand il devient invalide : c'est
    // générer qui devient inactif, jamais une substitution silencieuse (US-9).
    return retenus
  }, [modeles, filtre])

  const proportionsPossibles = choisi?.proportions ?? []

  return (
    // **Ce n'est plus une colonne, c'est un repli de la barre qui paie** (E4).
    // Elle était un `aside` de 300 px ouvert en permanence dans la galerie —
    // *ouvert même quand on n'y touche pas*, et sur l'écran dont le métier est
    // de juger. La galerie ne paie plus ; ce qui sert à payer suit la barre qui
    // paie, comme le prix l'a fait en E2.
    //
    // **Trois colonnes au lieu d'une**, parce que la place a changé de forme :
    // 300 px de haut sur 620 devient toute la largeur sur ce que le repli
    // laisse. Aucune largeur imposée — elles se partagent ce qu'il y a.
    <div
      {...PANNEAU}
      className="defile max-h-[40vh] overflow-y-auto border-b border-bord bg-fond-1 px-4 py-3"
    >
      <div className="grid grid-cols-3 items-start gap-x-6 gap-y-4">
        {/* ── Le modèle ─────────────────────────────────────────────────────
            **Le premier bloc repliable du produit, et celui qui l'a rendu
            nécessaire.** La liste vaut 280 px à elle seule dans une colonne qui
            en offre 620 : replié sur son choix, il en rend 26. C'est aussi le
            cas d'école de la règle — un choix déjà fait, qui se dit en une
            ligne, et qu'on ne rouvre que pour en changer.

            Les réglages propres au modèle, juste en dessous, ne se replient
            pas : un rang de segments fait 26 px, le repli lui coûterait un clic
            pour ne rien rendre. */}
        <Bloc
          cle="reglages.modele"
          titre="Modèle"
          aide="reglages.modele"
          etat={choisi?.nom ?? null}
          mesure={`${modeles.length} au catalogue`}
        >
          <div className="flex flex-col gap-1.5">
            <input
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="filtrer"
              className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
            />

            <ul className="max-h-[280px] overflow-y-auto rounded-[2px] border border-bord">
              {listes.map((modele) => (
                <LigneModele
                  key={modele.identifiant}
                  modele={modele}
                  choisi={modele.identifiant === choisi?.identifiant}
                  onChoisir={() => onChoisir(modele.identifiant)}
                />
              ))}
              {listes.length === 0 && (
                <li className="mesure px-2 py-3 text-[10px] text-texte-3">
                  aucun modèle ne porte ce nom
                </li>
              )}
            </ul>
          </div>
        </Bloc>

        {/* ── Le cadrage ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-1.5">
          <Libelle aide="reglages.proportions">Proportions</Libelle>
          <Segments
            valeurs={["1:1", "3:2", "2:3", "16:9"] as const}
            valeur={proportions}
            onChange={onProportions}
            indisponibles={
              choisi
                ? (["1:1", "3:2", "2:3", "16:9"] as const).filter(
                    (p) => !proportionsPossibles.includes(p),
                  )
                : []
            }
          />
        </section>

        <section className="flex flex-col gap-1.5">
          <Libelle aide="reglages.variations">Variations</Libelle>
          <Segments
            valeurs={[1, 2, 4] as const}
            valeur={cases ? 1 : variations}
            onChange={onVariations}
            // **Un lot plié part en un seul appel — c'est tout son intérêt.**
            // Le grisé porte sa raison, juste en dessous, plutôt que de
            // ramener silencieusement les variations à un : le serveur refuse
            // la combinaison, et un contrôle qui accepterait ce qu'il refuse
            // ferait découvrir le refus après le clic qui paie.
            indisponibles={cases ? ([2, 4] as const) : []}
          />
          <Raison
            texte={
              cases
                ? // **« cases » et non « attitudes »** (E13) : une planche de
                  // pose porte *une* attitude vue sous N angles, et l'appeler
                  // quatre attitudes en aurait fait quatre poses. Le mot juste
                  // est celui que tout le produit emploie déjà — une case est
                  // une pose dans une direction.
                  `${cases} cases en une planche — un seul appel`
                : variations > 1
                  ? `${variations} appels, ${variations} fois le prix`
                  : null
            }
          />
        </section>

        {/* ── Le sujet ──────────────────────────────────────────────────────
            **Un seul contrôle, trois conséquences.** Dire « c'est un objet tenu
            en main », c'est du même coup dire quels artworks partent en
            référence, quel modèle est le défaut, et quelle part de la case le
            sujet occupera. Le PRD écarte explicitement « la sélection manuelle
            des artworks, génération par génération » : promouvoir reste un geste
            unique, et ceci est le seul geste qui reste au moment de générer. */}
        {univers.bareme.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Libelle aide="reglages.sujet">Sujet</Libelle>
              {echelleLue && (
                <span className="mesure text-[9.5px] text-texte-3">
                  {echelleLue.occupation} % de la case
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {univers.bareme.map((e) => (
                <button
                  key={e.nom}
                  type="button"
                  onClick={() => onEchelle(e.nom === echelle ? "" : e.nom)}
                  className={[
                    "mesure h-[26px] rounded-[2px] border px-2 text-[11.5px] transition-colors duration-[80ms]",
                    e.nom === echelle
                      ? "border-signal bg-signal/13 text-signal"
                      : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
                  ].join(" ")}
                >
                  {e.nom}
                </button>
              ))}
            </div>
            {!echelle && (
              <Raison texte="aucun sujet — seules les planches « tous » partiront" />
            )}
          </section>
        )}

        {/* ── Ce que le modèle déclare en propre ────────────────────────── */}
        {choisi &&
          Object.values(choisi.options)
            .filter((o) => o.genre === "choix" && o.valeurs.length > 0)
            .map((option) => (
              <section key={option.nom} className="flex flex-col gap-1.5">
                <Libelle>{option.nom}</Libelle>
                <Segments
                  valeurs={option.valeurs}
                  valeur={options[option.nom] ?? option.valeurs[0]}
                  onChange={(v) => onOptions({ ...options, [option.nom]: v })}
                />
              </section>
            ))}

        {/* ── Qu'est-ce qui part avec ? ─────────────────────────────────── */}
        <section className="rounded-[2px] border border-bord bg-fond-2 p-2">
          <div className="mesure mb-1.5 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
            Ce qui part
          </div>
          <dl className="mesure grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
            <dt className="text-texte-3">références</dt>
            <dd
              className={[
                "text-right",
                (compte?.total ?? references) > (choisi?.references_max ?? 0)
                  ? "text-echec"
                  : "text-texte-2",
              ].join(" ")}
            >
              {compte?.total ?? references} / {choisi?.references_max ?? 0}
            </dd>
            {/* D'où elles viennent. La ligne ne paraît que s'il y a deux
                provenances à distinguer : « n'accepte que 2 images de
                référence, il en faudrait 5 » ne dit pas d'où viennent les cinq,
                et c'est cette ligne-ci qui le dit. */}
            {compte && compte.artworks > 0 && (
              <>
                <dt className="text-texte-3">dont artworks</dt>
                <dd className="text-right text-signal">
                  {compte.artworks}
                  {compte.famille ? ` · ${NOM_FAMILLE[compte.famille]} + tous` : " · tous"}
                </dd>
              </>
            )}
            {/* **Le gabarit est une image qui part vraiment** : il occupe une
                place dans le plafond du modèle et il coûte chez ceux qui
                facturent au token. Il a sa rangée et non sa ligne, parce qu'on
                ne le décoche pas — le décocher reviendrait à demander une
                planche sans dire à quoi elle ressemble. */}
            {compte && compte.gabarit > 0 && (
              <>
                <dt className="text-texte-3">dont gabarit</dt>
                <dd className="text-right text-signal">
                  1 · les {cases} cases vides
                </dd>
              </>
            )}
            <dt className="text-texte-3">projet</dt>
            <dd className="text-right text-texte-2">{projet ?? "aucun"}</dd>
            <dt className="text-texte-3">bible</dt>
            <dd className="text-right text-texte-2">
              {univers.bible.filter((c) => c.actif && c.texte.trim()).length || "—"}
              {univers.bible.some((c) => c.actif && c.texte.trim()) ? " champs" : ""}
            </dd>
            <dt className="text-texte-3">palette</dt>
            <dd className="text-right text-texte-2">
              {univers.palette.length ? `${univers.palette.length} couleurs` : "—"}
            </dd>
            <dt className="text-texte-3">grille imposée</dt>
            <dd className="text-right text-texte-2">{univers.cible_px} px</dd>
            <CoutAttendu cout={cout} cases={cases} variations={variations} />
          </dl>

          <References
            lignes={compte?.lignes ?? []}
            cible={cible}
            ecarteesGeneration={ecarteesGeneration}
            onEcarterGeneration={onEcarterGeneration}
            onErreur={onErreur}
          />
        </section>
      </div>
    </div>
  )
}

function LigneModele({
  modele,
  choisi,
  onChoisir,
}: {
  modele: Modele
  choisi: boolean
  onChoisir: () => void
}) {
  const grise = modele.refus !== null
  return (
    <li className="border-b border-bord last:border-b-0">
      <button
        type="button"
        onClick={onChoisir}
        className={[
          "flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left transition-colors duration-[80ms]",
          choisi ? "bg-fond-3" : "hover:bg-fond-3",
        ].join(" ")}
      >
        <span
          className={[
            "text-[11.5px] leading-tight",
            grise ? "text-texte-3" : choisi ? "text-signal" : "text-texte",
          ].join(" ")}
        >
          {modele.nom}
        </span>
        {grise ? (
          <Raison texte={modele.refus} />
        ) : (
          <span className="mesure text-[9.5px] text-texte-3">
            {modele.references_max} réfs · ×{modele.variations_max}
          </span>
        )}
      </button>
    </li>
  )
}

// ── Ce qui part, ligne par ligne ────────────────────────────────────────────

/**
 * Chaque image qui partira, sa provenance, et de quoi la retirer (US-121,
 * US-126, US-127).
 *
 * **Annoncer un coût sans montrer ce qui le fait n'est utile qu'à moitié.** Le
 * bloc « Ce qui part » dit depuis T4 *combien* d'images partent ; celui-ci dit
 * lesquelles, d'où elles viennent, et laquelle on veut couper.
 *
 * **Une ligne écartée reste dans la liste**, barrée et grise : une ligne qui
 * disparaîtrait ne laisserait aucun moyen de la remettre — et c'est très
 * exactement le geste qu'on veut pouvoir défaire.
 *
 * **La règle de préséance est écrite, pas déduite** : c'est un critère
 * d'acceptation de la tranche. Elle tient en une phrase, posée au-dessus des
 * lignes, et elle est vraie du code : la portée de la génération, quand elle a
 * un avis, décide seule.
 */
function References({
  lignes,
  cible,
  ecarteesGeneration,
  onEcarterGeneration,
  onErreur,
}: {
  lignes: LigneReference[]
  cible: Personnage | null
  ecarteesGeneration: string[] | null
  onEcarterGeneration: (ecartees: string[] | null) => void
  onErreur: (raison: string) => void
}) {
  if (lignes.length === 0) return null

  /** Les écartées **durables**, telles que le serveur les rend. C'est le point
   *  de départ quand la génération n'a pas encore d'avis. */
  const durables = lignes.filter((l) => l.ecartee_par).map((l) => l.asset)
  const effectives = ecarteesGeneration ?? durables

  const basculer = (asset: string) => {
    const suivantes = effectives.includes(asset)
      ? effectives.filter((a) => a !== asset)
      : [...effectives, asset]
    // Revenu à ce que les portées durables disent, l'avis de la génération
    // s'efface : elle n'a plus rien à dire de particulier, et le garder ferait
    // survivre une exception qui n'en est plus une.
    const memeQueDurable =
      suivantes.length === durables.length &&
      suivantes.every((a) => durables.includes(a))
    onEcarterGeneration(memeQueDurable ? null : suivantes)
  }

  const poser = async (portee: PorteeDurable, asset: string, ecartee: boolean) => {
    const deja = lignes
      .filter((l) => l.ecartee_par === portee)
      .map((l) => l.asset)
    const suivantes = ecartee
      ? [...new Set([...deja, asset])]
      : deja.filter((a) => a !== asset)
    try {
      await api.ecarter(portee, suivantes, cible?.identifiant)
      // La portée durable a bougé : l'avis de la génération, s'il existait,
      // portait sur l'état d'avant. On le rend au serveur plutôt que de le
      // laisser masquer ce qu'on vient de décider.
      onEcarterGeneration(null)
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : "décochage refusé")
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-bord pt-2">
      <div className="mesure text-[9.5px] leading-4 text-texte-3">
        la portée la plus étroite l'emporte — cette génération, puis ce
        personnage, puis le projet
      </div>

      <ul className="flex flex-col gap-1">
        {lignes.map((ligne) => {
          const ecartee = effectives.includes(ligne.asset)
          // La portée **retenue** : celle qui décide, et non la liste de celles
          // qui ont un avis. Écartée sans portée durable, c'est la génération.
          const portee = ecartee ? (ligne.ecartee_par ?? "cette génération") : null
          return (
            <li key={ligne.asset} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => basculer(ligne.asset)}
                  aria-pressed={!ecartee}
                  aria-label={`${ecartee ? "Remettre" : "Écarter"} ${ligne.provenance}`}
                  className={[
                    "mesure h-[18px] w-[18px] shrink-0 rounded-[2px] border text-[10px] transition-colors duration-[80ms]",
                    ecartee
                      ? "border-bord bg-fond-1 text-texte-3"
                      : "border-signal bg-signal/13 text-signal",
                  ].join(" ")}
                >
                  {ecartee ? "" : "✓"}
                </button>
                <span
                  className={[
                    "mesure min-w-0 flex-1 truncate text-[9.5px]",
                    ecartee ? "text-texte-3 line-through" : "text-texte-2",
                  ].join(" ")}
                  title={ligne.asset}
                >
                  {ligne.provenance}
                </span>
              </div>

              {ecartee && (
                <div className="flex items-center gap-1 pl-[24px]">
                  <span className="mesure text-[9.5px] text-texte-3">
                    écartée · {portee}
                  </span>
                  {/* **Élargir la portée**, jamais la deviner. Sans case
                      visée, « ce personnage » ne désigne personne : le bouton
                      ne paraît pas du tout. C'est la bascule de la réserve,
                      qui n'existe qu'en toile — un grisé porterait une raison
                      sur une chose qui n'a pas d'objet, et mentirait sur ce
                      que l'écran contient. */}
                  {(["personnage", "projet"] as const).map((large) =>
                    ligne.ecartee_par === large ? (
                      <button
                        key={large}
                        type="button"
                        onClick={() => void poser(large, ligne.asset, false)}
                        className="mesure ml-auto text-[9.5px] text-signal hover:text-signal-clair"
                      >
                        rendre au {large === "projet" ? "projet" : "personnage"}
                      </button>
                    ) : large === "personnage" && !cible ? null : (
                      <button
                        key={large}
                        type="button"
                        onClick={() => void poser(large, ligne.asset, true)}
                        className="mesure text-[9.5px] text-texte-3 hover:text-texte-2"
                      >
                        + {large}
                      </button>
                    ),
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}


/**
 * Ce que ça va coûter, et ce qu'un compte faux coûterait.
 *
 * **Mesuré sur les derniers appels de ce modèle, jamais lu dans un tarif**
 * (US-121) : le produit n'en porte aucun, et *le coût réel facturé fait foi*
 * partout ailleurs. Un modèle jamais appelé le dit ; c'est le premier appel qui
 * l'apprend, comme pour l'attente de la jauge.
 *
 * **Et ce qu'un compte faux coûterait** (US-129) — « afin d'arbitrer moi-même
 * entre le coût et le risque de tout rater d'un coup ». Le produit annonce **ce
 * que ça coûte**, jamais une probabilité : il ne sait pas si ça arrivera, il
 * sait ce que ça vaudrait. Et il ne plafonne pas — la taille du lot est le choix
 * de l'auteur. Le chiffre est le même que celui du dessus, et c'est le fait : un
 * lot refusé sur le compte est un lot entier à repayer au prix plein. L'écrire
 * deux fois n'est pas une redite, c'est la seconde moitié de l'arbitrage.
 *
 * **Écrit ici, rendu à deux endroits** (E2). Il vivait dans la colonne de
 * réglages de 300 px, qui n'existe que dans la galerie — et la galerie ne paie
 * plus. Il suit donc la barre qui paie, au pied du codex et de l'établi. Deux
 * copies auraient fini par annoncer deux prix pour le même appel.
 */
export function CoutAttendu({
  cout,
  cases,
  variations,
}: {
  cout: number | null
  cases: number
  variations: number
}) {
  return (
    <>
      <dt className="text-texte-3">coût attendu</dt>
      <dd
        className="text-right text-texte-2"
        title={
          cout === null
            ? "ce modèle n'a encore rien facturé sur cette machine"
            : "médiane des derniers appels réussis de ce modèle"
        }
      >
        {cout === null
          ? "jamais appelé"
          : cases
            ? `≈ ${dollars(cout)} · ${cases} cases`
            : `≈ ${dollars(cout * variations)}${variations > 1 ? ` · ${variations} appels` : ""}`}
      </dd>
      {cases > 0 && (
        <>
          <dt className="text-texte-3">un compte faux</dt>
          <dd
            className="text-right text-texte-2"
            title="le lot entier est refusé, rien n'entre, et il se relance au prix plein"
          >
            {cout === null ? "jamais appelé" : `≈ ${dollars(cout)} à repayer`}
          </dd>
        </>
      )}
    </>
  )
}
