// L'écran Univers — le tableau d'inspiration, la bible, la palette, le barème.
//
// « Au début d'un projet, puis ponctuel » (`docs/ARCHITECTURE.md` §6.2). C'est
// la contrepartie exacte de l'Atelier : celui-ci ne montre que ce qu'on touche
// **à chaque** génération, celui-là tout ce qu'on pose **une fois** et qui
// s'applique ensuite tout seul.
//
// **Deux colonnes, et la grille reste disciplinée.** `380px · 1fr` — l'univers
// à gauche, le tableau à droite. La largeur de 380 est celle de la fiche asset
// (`docs/DESIGN.md` § Layout) : c'est la colonne des réglages du produit, et lui
// en donner une troisième valeur ferait un troisième vocabulaire de largeur.
//
// **Aucune rubrique n'y paraît vide sans le dire.** Montrer du cadrage au lieu
// de servir le geste est le reproche qui a fait écarter la maquette : un univers
// vide ne montre donc pas des champs morts, il montre ce qu'ils feront.

import { useEffect, useState } from "react"
import {
  api,
  FAMILLES,
  NOM_CHAMP,
  NOM_FAMILLE,
  Refus,
  type Carte,
  type Echelle,
  type Famille,
  type Modele,
  type Univers,
} from "../api"
import {
  Bloc,
  Bouton,
  Curseur,
  EnTetePanneau,
  Libelle,
  Raison,
  Segments,
} from "./chassis"
import { Tableau } from "./Tableau"

/** Les cibles proposées, reprises de la fiche — 16 pour une tuile, 64 pour un
 *  sprite, 128 pour un décor. Elles se choisissent **ici** depuis T4 : la taille
 *  de pixel est une propriété du projet, imposée à tout ce qui rentre (US-60). */
const CIBLES = [16, 24, 32, 48, 64, 96, 128] as const
const COULEURS = [8, 12, 16, 24, 32, 48] as const

export function EcranUnivers({
  projet,
  univers,
  modeles,
  cartes,
  groupes,
  onRelire,
  onFermer,
}: {
  projet: { identifiant: string; nom: string } | null
  univers: Univers
  modeles: Modele[]
  /** Le tableau, tenu par `App` — comme la grille et l'arbre. **Un seul endroit
   *  écoute le flux**, pour toute la vie de l'onglet : un second abonnement
   *  ouvert à l'ouverture de cet écran-ci se rebrancherait à chaque aller-retour
   *  vers l'atelier, et le serveur renverrait l'état complet à chaque fois. */
  cartes: Carte[]
  groupes: string[]
  onRelire: () => void
  onFermer: () => void
}) {
  const [choisie, setChoisir] = useState<string | null>(null)
  const [compte, setCompte] = useState<{ realignes: number; conserves: number } | null>(
    null,
  )
  // **Le refus se pose où le geste a eu lieu.** Cet écran couvre l'atelier :
  // une raison envoyée à la barre d'état de l'atelier serait rendue derrière
  // lui, donc invisible au moment précis où elle compte. Elle a donc sa fente
  // ici, dans la forme des autres — tiret de 8 px, mono 10 px.
  const [refus, setRefus] = useState<string>("")

  const realigner = async () => {
    try {
      const fait = await api.realigner()
      setCompte({ realignes: fait.realignes, conserves: fait.conserves })
      setRefus("")
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "réalignement refusé")
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-fond-0">
      <header className="flex h-[44px] shrink-0 items-center gap-4 border-b border-bord bg-fond-1 px-4">
        <h1 className="font-serif text-[17px] leading-none text-texte">Univers</h1>
        <span className="mesure text-[10px] text-texte-2">
          {projet ? projet.nom : "sans projet"}
        </span>
        {univers.vide && (
          <span className="mesure text-[10px] text-texte-3">
            rien n'est posé — les défauts du produit s'appliquent
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {refus && (
            <span className="mesure flex items-center gap-1.5 text-[10px] text-echec">
              <span aria-hidden className="inline-block h-px w-2 bg-echec" />
              {refus}
            </span>
          )}
          {compte && (
            <span className="mesure text-[10px] text-ok">
              {compte.realignes} remis à jour · {compte.conserves} conservés tels quels
            </span>
          )}
          <Bouton onClick={onFermer} enfants="Retour à l'atelier" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <PanneauUnivers
          univers={univers}
          modeles={modeles}
          artworks={cartes.filter((c) => c.artwork)}
          onErreur={setRefus}
          onRealigner={realigner}
        />
        <Tableau
          cartes={cartes}
          groupes={groupes}
          choisie={choisie}
          onChoisir={setChoisir}
          onErreur={setRefus}
          onRafraichir={onRelire}
        />
      </div>
    </div>
  )
}

// ── La colonne de 380 px ────────────────────────────────────────────────────

function PanneauUnivers({
  univers,
  modeles,
  artworks,
  onErreur,
  onRealigner,
}: {
  univers: Univers
  modeles: Modele[]
  artworks: Carte[]
  onErreur: (raison: string) => void
  onRealigner: () => void
}) {
  const echouer = (erreur: unknown, defaut: string) =>
    onErreur(erreur instanceof Refus ? erreur.message : defaut)

  const regler = async (reglage: Parameters<typeof api.reglerUnivers>[0]) => {
    try {
      await api.reglerUnivers(reglage)
    } catch (erreur) {
      echouer(erreur, "réglage refusé")
    }
  }

  return (
    <aside className="flex min-h-0 w-[380px] shrink-0 flex-col bg-fond-1">
      <EnTetePanneau>L'univers</EnTetePanneau>
      <div className="defile flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-2">
        <Bible bible={univers.bible} onRegler={(bible) => void regler({ bible })} />
        <Palette univers={univers} artworks={artworks} onRegler={regler} />
        <Grille univers={univers} onRegler={regler} onRealigner={onRealigner} />
        <Bareme univers={univers} onRegler={regler} />
        <Defauts univers={univers} modeles={modeles} onRegler={regler} />
      </div>
    </aside>
  )
}

/** La bible — cinq champs nommés, chacun activable indépendamment (US-56).
 *
 *  Le texte libre est ce qu'on retape ; les champs nommés sont ce qu'on dose.
 *  L'interrupteur est à côté du champ et pas dans un menu : « doser ce qui
 *  contraint » est un geste qu'on fait en regardant ce qu'on relâche. */
function Bible({
  bible,
  onRegler,
}: {
  bible: { nom: string; texte: string; actif: boolean }[]
  onRegler: (bible: { nom: string; texte: string; actif: boolean }[]) => void
}) {
  const [brouillon, setBrouillon] = useState(bible)

  useEffect(() => setBrouillon(bible), [bible])

  const poser = (suivante: typeof bible) => {
    setBrouillon(suivante)
    onRegler(suivante)
  }

  const actifs = brouillon.filter((c) => c.actif && c.texte.trim()).length

  return (
    <Bloc
      cle="univers.bible"
      aide="univers.bible"
      titre="Bible"
      etat={actifs ? `${actifs} champ${actifs > 1 ? "s" : ""}` : null}
      mesure={`${actifs} champ${actifs > 1 ? "s" : ""} part${actifs > 1 ? "ent" : ""} avec chaque génération`}
    >
      {brouillon.map((champ, rang) => (
        <div key={champ.nom} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={champ.actif}
              aria-label={`${NOM_CHAMP[champ.nom] ?? champ.nom} — ${champ.actif ? "actif" : "inactif"}`}
              onClick={() =>
                poser(
                  brouillon.map((c, i) => (i === rang ? { ...c, actif: !c.actif } : c)),
                )
              }
              className={[
                "mesure h-[26px] w-[26px] shrink-0 rounded-[2px] border text-[10px] transition-colors duration-[80ms]",
                champ.actif
                  ? "border-signal bg-signal/13 text-signal"
                  : "border-bord bg-fond-2 text-texte-3 hover:bg-fond-3",
              ].join(" ")}
            >
              {champ.actif ? "●" : "○"}
            </button>
            {/* Cinq champs voisins, tous du texte libre, et rien à l'écran ne
                disait lequel porte quoi : la forme exacte du défaut `groupe`
                contre `famille`, à cinq exemplaires. Chacun porte donc son
                pointillé, et son entrée dit sous quel intitulé anglais il
                part. */}
            <Libelle aide={`bible.${champ.nom}`} eteint={!(champ.actif && champ.texte.trim())}>
              {NOM_CHAMP[champ.nom] ?? champ.nom}
            </Libelle>
          </div>
          <textarea
            value={champ.texte}
            rows={2}
            placeholder={PLACEHOLDERS[champ.nom] ?? ""}
            onChange={(e) =>
              setBrouillon(
                brouillon.map((c, i) => (i === rang ? { ...c, texte: e.target.value } : c)),
              )
            }
            onBlur={() => onRegler(brouillon)}
            className={[
              "resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11.5px] leading-snug placeholder:text-texte-3",
              champ.actif ? "text-texte" : "text-texte-3",
            ].join(" ")}
          />
        </div>
      ))}
    </Bloc>
  )
}

const PLACEHOLDERS: Record<string, string> = {
  monde: "royaume de tourbe et de fer, marais au nord",
  epoque: "haut moyen âge, avant la poudre",
  trait: "contour brun d'un pixel, aplats, pas de dégradé",
  eclairage: "lumière rasante, ombres portées courtes",
  technique: "sprite sur fond uni, une seule pose",
}

/** La palette — **déduite par calcul, jamais saisie** (US-54).
 *
 *  Montrée pour qu'on vérifie ce que la machine y a lu, et recalculée dès qu'on
 *  retire un artwork (US-55). Le seul réglage qu'on ait sur elle est le nombre
 *  de couleurs qu'on lui demande. */
function Palette({
  univers,
  artworks,
  onRegler,
}: {
  univers: Univers
  artworks: Carte[]
  onRegler: (r: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
}) {
  return (
    <Bloc
      cle="univers.palette"
      aide="univers.palette"
      titre="Palette"
      etat={univers.palette.length ? `${univers.palette.length} couleurs` : null}
      mesure={
        univers.palette.length
          ? `${univers.palette.length} couleurs · ${artworks.length} artwork${artworks.length > 1 ? "s" : ""}`
          : "déduite des artworks"
      }
    >

      {univers.palette.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-[2px]">
            {univers.palette.map((couleur) => (
              <span
                key={couleur}
                title={couleur}
                style={{ background: couleur }}
                className="h-5 w-5 rounded-[2px] border border-bord"
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Libelle aide="univers.couleurs">Couleurs demandées</Libelle>
            <Segments
              valeurs={COULEURS}
              valeur={
                (COULEURS.includes(univers.couleurs as (typeof COULEURS)[number])
                  ? univers.couleurs
                  : 24) as (typeof COULEURS)[number]
              }
              onChange={(couleurs) => void onRegler({ couleurs })}
            />
          </div>
        </>
      ) : (
        <div className="rounded-[2px] border border-bord bg-fond-2 px-2 py-2">
          <Raison texte="aucun artwork officiel — promeus une carte du tableau" />
        </div>
      )}
    </Bloc>
  )
}

/** La taille de pixel du projet — imposée à tout ce qui rentre, jamais déduite
 *  de l'image reçue (US-60, US-61). */
function Grille({
  univers,
  onRegler,
  onRealigner,
}: {
  univers: Univers
  onRegler: (r: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
  onRealigner: () => void
}) {
  return (
    <Bloc
      cle="univers.grille"
      aide="univers.cible_px"
      titre="Taille de pixel"
      etat={`${univers.cible_px} px`}
      mesure="imposée à ce qui rentre"
    >
      <Segments
        valeurs={CIBLES}
        valeur={
          (CIBLES.includes(univers.cible_px as (typeof CIBLES)[number])
            ? univers.cible_px
            : 64) as (typeof CIBLES)[number]
        }
        onChange={(cible_px) => void onRegler({ cible_px })}
      />
      <div className="flex items-center justify-between pt-1">
        <span className="mesure text-[10px] text-texte-3">
          les assets déjà là ne bougent pas tout seuls
        </span>
        <button
          type="button"
          onClick={onRealigner}
          className="mesure text-[10px] text-signal hover:text-signal-clair"
        >
          Tout réaligner ›
        </button>
      </div>
    </Bloc>
  )
}

/** Le barème d'échelles — quelle part de la toile un sujet occupe selon sa nature.
 *
 *  « Sans lui, tout ce qui sort du produit fait la même hauteur » : la séance du
 *  27 août l'a montré sur cinq sujets réels, un coffre aussi haut qu'un
 *  personnage. Une échelle porte aussi sa **famille**, et c'est ce qui garde un
 *  seul contrôle au générateur : dire « c'est un objet tenu en main », c'est du
 *  même coup dire quels artworks partent. */
function Bareme({
  univers,
  onRegler,
}: {
  univers: Univers
  onRegler: (r: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
}) {
  const poser = (bareme: Echelle[]) => void onRegler({ bareme })

  return (
    <Bloc
      cle="univers.bareme"
      aide="univers.bareme"
      titre="Barème d'échelles"
      etat={
        univers.bareme.length
          ? `${univers.bareme.length} échelle${univers.bareme.length > 1 ? "s" : ""}`
          : null
      }
      mesure="part de la case, et famille"
    >
      <ul className="flex flex-col rounded-[2px] border border-bord">
        {univers.bareme.map((echelle, rang) => (
          <li
            key={echelle.nom}
            className="flex flex-col gap-1 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-[11.5px] text-texte">{echelle.nom}</span>
              <select
                value={echelle.famille}
                onChange={(e) =>
                  poser(
                    univers.bareme.map((x, i) =>
                      i === rang ? { ...x, famille: e.target.value as Famille } : x,
                    ),
                  )
                }
                className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
              >
                {FAMILLES.map((f) => (
                  <option key={f} value={f}>
                    {NOM_FAMILLE[f]}
                  </option>
                ))}
              </select>
            </div>
            <Curseur
              valeur={echelle.occupation}
              min={10}
              max={100}
              unite=" %"
              onChange={(occupation) =>
                poser(
                  univers.bareme.map((x, i) => (i === rang ? { ...x, occupation } : x)),
                )
              }
            />
            <button
              type="button"
              aria-pressed={echelle.silhouette}
              onClick={() =>
                poser(
                  univers.bareme.map((x, i) =>
                    i === rang ? { ...x, silhouette: !x.silhouette } : x,
                  ),
                )
              }
              className={[
                "mesure self-start text-[9.5px] transition-colors duration-[80ms]",
                echelle.silhouette ? "text-texte-3 hover:text-signal" : "text-epingle",
              ].join(" ")}
            >
              {echelle.silhouette
                ? "se détoure et vit dans une case"
                : "plein cadre, aucun détourage"}
            </button>
          </li>
        ))}
      </ul>
    </Bloc>
  )
}

/** Le modèle par défaut, **par famille** — pas un réglage global (US-58). */
function Defauts({
  univers,
  modeles,
  onRegler,
}: {
  univers: Univers
  modeles: Modele[]
  onRegler: (r: Parameters<typeof api.reglerUnivers>[0]) => Promise<void>
}) {
  const poses = FAMILLES.filter((f) => f !== "tous" && univers.modeles[f]).length

  return (
    <Bloc
      cle="univers.defauts"
      aide="univers.modeles"
      titre="Modèle par famille"
      etat={
        poses ? `${poses} famille${poses > 1 ? "s" : ""} réglée${poses > 1 ? "s" : ""}` : null
      }
      mesure="sinon, le défaut du catalogue"
    >
      <ul className="flex flex-col rounded-[2px] border border-bord">
        {FAMILLES.filter((f) => f !== "tous").map((famille) => (
          <li
            key={famille}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2">
              {NOM_FAMILLE[famille]}
            </span>
            <select
              value={univers.modeles[famille] ?? ""}
              onChange={(e) =>
                void onRegler({
                  modeles: { ...univers.modeles, [famille]: e.target.value },
                })
              }
              className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
            >
              <option value="">—</option>
              {modeles.map((m) => (
                <option key={m.identifiant} value={m.identifiant}>
                  {m.nom}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Bloc>
  )
}
