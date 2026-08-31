// L'assistant de démarrage — et il est aussi l'écran des réglages.
//
// **Il n'y a pas d'autre panneau de réglages à côté**, et c'est la décision :
// deux endroits qui règlent la même chose finissent toujours par se
// contredire, et c'est exactement ce qui arrivait. C'est le côté *Réglages* de
// l'onglet Univers, décrit en entier ; il s'ouvre tout seul à la création d'un
// jeu, et on le rouvre chaque fois qu'on veut changer quelque chose.
//
// **La panne qu'il répare est mesurée, sur le vrai projet.** Créer un jeu ne
// demandait qu'une chose — son nom — et l'on arrivait devant sept cases de
// texte blanches, à remplir soi-même, en anglais, sans exemple et sans ordre.
// Deux conséquences : le réglage disait *128 points de côté* pendant que le
// texte envoyé disait *64*, **trois fois** ; et le nombre de directions était
// retapé **sept fois**, sans que rien ne relie ces sept endroits.
//
// **Ce que l'assistant change : un choix unique remplit tous les endroits qui
// doivent s'accorder.** On choisit « de dessus 3/4 » une fois, et l'atelier
// écrit la phrase qui part *et* le nombre d'images par pose. Ces endroits ne
// peuvent plus diverger, parce qu'ils viennent du même geste.
//
// **Dix étapes, en quatre groupes, et deux humeurs.** La première fois elles
// s'enchaînent dans l'ordre, avec un bouton *suivant* et une coche sur ce qui
// est fait. Ensuite on clique directement l'étape à changer, et la colonne
// affiche la **valeur** de chacune : elle devient le récapitulatif du jeu,
// lisible sans rien ouvrir. Les aides, les vignettes et les exemples ne
// disparaissent jamais.

import { useEffect, useState, type ReactNode } from "react"
import {
  api,
  FAMILLES,
  AUCUNE_CIBLE,
  NOM_CHAMP,
  NOM_FAMILLE,
  Refus,
  type Carte,
  type Consequences,
  type EtatCle,
  type Echelle,
  type EmplacementCorps,
  type Etiquette,
  type Famille,
  type Pose,
  type PosesDesTypes,
  type TailleDImage,
  type VueDuJeu,
  type VuesEtTailles,
  type Modele,
  type Univers,
} from "../api"
import {
  Bloc,
  Curseur,
  EnTetePanneau,
  Libelle,
  Raison,
  Segments,
} from "./chassis"
import { PANNEAU } from "./Infobulle"

/** Ce que l'auteur lit d'une cible. Zéro n'est pas « 0 px » — c'est l'absence
 *  de remise sur grille, et l'écrire en pixels serait un mensonge de mesure. */
const NOM_CIBLE: Partial<Record<string, string>> = { "0": "aucune" }
const COULEURS = [8, 12, 16, 24, 32, 48] as const

/** Poser un réglage, et **dire s'il a pris**. Le booléen n'est pas de la
 *  politesse : un bloc qui tient un brouillon doit savoir revenir à la valeur
 *  d'avant quand le serveur refuse, sinon l'écran reste sur la valeur tentée —
 *  celle que le fichier du projet ne porte pas. */
type Regler = (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<boolean>

/** Les dix étapes, dans l'ordre où on les remplit, et **rangées en quatre
 *  groupes**.
 *
 *  Le groupe n'est pas de la décoration : *le jeu* dit ce qu'on fabrique, *le
 *  style* comment ça doit avoir l'air, *la production* combien d'images il
 *  faudra, *l'atelier* ce qui vaut pour tous les jeux. La dixième — la clé du
 *  fournisseur — est seule dans son groupe **parce qu'elle ne dépend d'aucun
 *  jeu**, exactement comme la base d'étiquettes. */
const ETAPES = [
  { cle: "nom", groupe: "le jeu", nom: "Le nom" },
  { cle: "vue", groupe: "le jeu", nom: "La vue" },
  { cle: "taille", groupe: "le jeu", nom: "La taille" },
  { cle: "types", groupe: "le jeu", nom: "Les types d'objets" },
  { cle: "allure", groupe: "le style", nom: "L'allure" },
  { cle: "references", groupe: "le style", nom: "Références et couleurs" },
  { cle: "poses", groupe: "la production", nom: "Poses et états" },
  { cle: "emplacements", groupe: "la production", nom: "Emplacements" },
  { cle: "modeles", groupe: "la production", nom: "Les IA à utiliser" },
  { cle: "cle", groupe: "l'atelier", nom: "La clé" },
] as const

type Etape = (typeof ETAPES)[number]["cle"]

const GROUPES = ["le jeu", "le style", "la production", "l'atelier"] as const

/**
 * Le côté Réglages — la liste des étapes à gauche, l'étape ouverte à droite.
 *
 * **240 px, la colonne de ce qui range** (`docs/DESIGN.md` § Largeurs de
 * colonne), la même que l'arbre de la galerie et que les familles du codex.
 * Aucune largeur neuve : c'est ce que la V2.1 s'est imposé, et c'est ce que
 * cette colonne nomme déjà.
 *
 * **Ce que ça règle, mesuré.** La même matière tenait dans une bande de 380 px
 * haute de 1 843 px, dans 646 px visibles : il fallait faire défiler deux fois
 * et demie sa propre hauteur pour atteindre le dernier bloc, et la liste des
 * étapes n'existait nulle part. Une étape à la fois tient dans un écran.
 */
export function Assistant({
  onSortir,
  univers,
  modeles,
  artworks,
  onUnivers,
  onErreur,
  onRealigner,
}: {
  /** **Sortir de l'assistant** (E19) : on tombe dans le codex, avec le champ
   *  qui nomme allumé. Absent quand l'assistant est ouvert comme écran de
   *  réglages ordinaire — il n'y a alors nulle part d'où sortir, on y est
   *  venu exprès. */
  onSortir?: () => void
  univers: Univers
  modeles: Modele[]
  artworks: Carte[]
  onUnivers: (univers: Univers) => void
  onErreur: (raison: string) => void
  onRealigner: () => void
}) {
  const [etape, setEtape] = useState<Etape>("nom")
  const [enchaine, setEnchaine] = useState(univers.vide)
  const [vues, setVues] = useState<VuesEtTailles | null>(null)
  const [etiquettes, setEtiquettes] = useState<Etiquette[]>([])

  // Les deux listes fermées et la base d'étiquettes viennent du serveur : c'est
  // le même choix qui remplit le réglage *et* la phrase de la bible, et deux
  // listes tenues à deux endroits finiraient par diverger.
  useEffect(() => {
    // **On regarde la forme avant de s'y fier** : un serveur plus vieux que
    // l'écran répond 200 sans se plaindre, et c'est le piège que E3 a payé.
    void api
      .vuesEtTailles()
      .then((recu) => setVues(recu?.vues ? recu : null))
      .catch(() => setVues(null))
    void api
      .etiquettes()
      .then((recu) => setEtiquettes(recu?.etiquettes ?? []))
      .catch(() => setEtiquettes([]))
  }, [])

  const regler: Regler = async (reglage) => {
    try {
      onUnivers((await api.reglerUnivers(reglage)).univers)
      return true
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "réglage refusé")
      return false
    }
  }

  const rang = ETAPES.findIndex((e) => e.cle === etape)
  const laVue = vues?.vues?.find((v: VueDuJeu) => v.identifiant === univers.vue) ?? null

  return (
    <div data-assistant className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
      <aside
        {...PANNEAU}
        className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
      >
        <EnTetePanneau>Ce jeu</EnTetePanneau>
        {/* **La colonne change de métier avec l'humeur**, et c'est la seule
            chose qui change entre les deux : en enchaînant elle dit *où on en
            est*, ensuite elle dit *ce que le jeu vaut* — et devient le
            récapitulatif, lisible sans rien ouvrir. */}
        <div className="defile min-h-0 flex-1 overflow-y-auto p-2">
          {GROUPES.map((groupe) => (
            <div key={groupe} className="mb-2">
              <p className="mesure px-2 py-1 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
                {groupe}
              </p>
              {ETAPES.filter((e) => e.groupe === groupe).map(({ cle, nom }) => {
                const numero = ETAPES.findIndex((e) => e.cle === cle) + 1
                const vaut = valeurDeLEtape(cle, univers, laVue)
                return (
                  <button
                    key={cle}
                    type="button"
                    // **Le nom de l'étape, et rien d'autre.** Sans lui, le nom
                    // accessible de la rangée changerait avec son humeur — le
                    // numéro, la coche, la valeur — et une rangée qu'on désigne
                    // par ce qu'elle vaut n'est plus une rangée qu'on désigne.
                    aria-label={nom}
                    aria-pressed={etape === cle}
                    onClick={() => setEtape(cle)}
                    className={[
                      "flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[11.5px] transition-colors duration-[80ms]",
                      etape === cle
                        ? "bg-fond-3 text-texte"
                        : "text-texte-2 hover:bg-fond-2",
                    ].join(" ")}
                  >
                    <span className="mesure shrink-0 text-[10px] text-texte-3">
                      {numero}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{nom}</span>
                    {enchaine ? (
                      // Une coche pour ce qui est fait, rien pour ce qui n'a
                      // pas été ouvert. **Le manque n'a pas de couleur** : c'est
                      // la règle du codex, et elle vaut ici aussi.
                      vaut && (
                        <span aria-label="fait" className="shrink-0 text-ok">
                          ✓
                        </span>
                      )
                    ) : (
                      <span className="mesure shrink-0 truncate text-[10px] text-texte-3">
                        {vaut}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {/* **Ce que cet univers envoie**, en pied de la colonne qui le règle et
            nulle part ailleurs. Voir `CeQueLUniversEnvoie`. */}
        <CeQueLUniversEnvoie univers={univers} artworks={artworks} />
      </aside>

      {/* **C'est un panneau de réglages, et il se déclare** (`docs/design-motifs.md`
          § L'infobulle explique) : c'est ce qui dit à une bulle de sortir par le
          bord de la colonne plutôt que par celui de l'écran. Le marqueur vivait
          sur la colonne de 380 px ; il suit ce qu'elle portait. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div
          {...PANNEAU}
          className="defile flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
        >
          {etape === "nom" && <LeNom onErreur={onErreur} />}
          {etape === "vue" && (
            <LaVue univers={univers} vues={vues?.vues ?? []} onRegler={regler} />
          )}
          {etape === "taille" && (
            <LaTaille
              univers={univers}
              tailles={vues?.tailles ?? []}
              onRegler={regler}
              onRealigner={onRealigner}
                    />
          )}
          {etape === "types" && <Bareme univers={univers} onRegler={regler} />}
          {/* **La bible ne change pas, seul l'endroit change** : ce qu'on
              règle est le même, et les étiquettes se posent à côté d'elle plutôt
              qu'à sa place. Un second contrôle du même texte aurait fait deux
              endroits qui règlent la même chose. */}
          {etape === "allure" && (
            <>
              <Bible bible={univers.bible} onRegler={(bible) => regler({ bible })} />
              <LesEtiquettes
                univers={univers}
                etiquettes={etiquettes}
                onEtiquettes={setEtiquettes}
                onRegler={(bible) => regler({ bible })}
                onErreur={onErreur}
              />
            </>
          )}
          {etape === "references" && (
            <>
              <Palette univers={univers} artworks={artworks} onRegler={regler} />
              <LeTexteACopier univers={univers} vue={laVue} />
            </>
          )}
          {etape === "poses" && <LesPoses onErreur={onErreur} vue={laVue} />}
          {etape === "emplacements" && <LesEmplacements univers={univers} onErreur={onErreur} />}
          {etape === "modeles" && (
            <Defauts univers={univers} modeles={modeles} onRegler={regler} />
          )}
          {etape === "cle" && <LaCle onErreur={onErreur} />}
        </div>

        {/* **Le pied ne change qu'entre les deux humeurs.** En enchaînant :
            l'étape sur dix, *passer*, *suivant*. Ensuite : rien — on est allé
            droit au but, il n'y a nulle part où aller ensuite. Et
            *j'ai fini pour l'instant* est visible en permanence, parce qu'on
            sort à n'importe quelle étape. */}
        <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px]">
          {enchaine && (
            <span className="text-texte-3">
              étape {rang + 1} sur {ETAPES.length}
            </span>
          )}
          {/* **Une porte n'en est une que si elle s'ouvre dans les deux
              sens** (E19). Elle ne se contentait plus d'arrêter l'enchaînement :
              on tombe dans le codex, avec le champ qui nomme allumé — pas dans
              la galerie, qui ne montre que des images produites et n'en a
              aucune. On peut partir dès l'étape 1 et fabriquer quand même. */}
          <button
            type="button"
            onClick={() => {
              setEnchaine(false)
              onSortir?.()
            }}
            title="rien n'est exigé — une étape passée reste passée, et se rouvre d'un clic"
            className="text-texte-2 hover:text-signal"
          >
            j'ai fini pour l'instant
          </button>
          {enchaine && (
            <>
              <button
                type="button"
                onClick={() =>
                  setEtape(ETAPES[Math.min(rang + 1, ETAPES.length - 1)].cle)
                }
                className="ml-auto text-texte-3 hover:text-signal"
              >
                passer
              </button>
              <button
                type="button"
                disabled={rang >= ETAPES.length - 1}
                onClick={() =>
                  setEtape(ETAPES[Math.min(rang + 1, ETAPES.length - 1)].cle)
                }
                className="rounded-[2px] border border-bord-fort px-2 py-1 text-texte-2 hover:text-signal disabled:text-texte-3"
              >
                suivant →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Ce qu'une étape vaut, en une ligne — **c'est ce qui fait de la colonne un
 *  récapitulatif**. Vide veut dire *pas encore ouverte*, et rien ne le réclame :
 *  le manque n'a pas de couleur, ici comme dans le codex. */
function valeurDeLEtape(
  etape: Etape,
  univers: Univers,
  vue: VueDuJeu | null,
): string {
  const cases = univers.bible.filter((c) => c.actif && c.texte.trim()).length
  switch (etape) {
    case "vue":
      return vue ? `${vue.libelle} · ${vue.images} img.` : ""
    case "taille":
      return univers.cible_px ? String(univers.cible_px) : ""
    case "types":
      return `${univers.bareme.length} types`
    case "allure":
      return cases ? `${cases} cases` : ""
    case "references":
      return univers.palette.length ? `${univers.palette.length} coul.` : ""
    case "modeles": {
      const vides = FAMILLES.filter((f) => !univers.modeles[f]).length
      return vides ? `${vides} vides` : "toutes réglées"
    }
    default:
      return ""
  }
}

/**
 * Ce que cet univers envoie — le bloc en pied de colonne.
 *
 * **Un univers ne se lisait nulle part.** Sept cases de texte, chacune avec son
 * interrupteur, une palette, une taille de pixel, un barème : rien ne disait ce
 * qui part vraiment avec un appel, ni combien ça pèse. Mesuré dans ce dépôt, le
 * style représente 53 % du texte envoyé et le sujet 2 % — un chiffre qu'aucun
 * écran ne montrait, et qui décide de ce qu'on peut espérer changer en
 * réécrivant son prompt.
 *
 * **Il dit aussi ce qui n'agit qu'au retour**, et c'est la moitié la moins
 * évidente : la taille de pixel et le barème ne partent pas chez le
 * fournisseur — ils s'appliquent à l'image quand elle revient. Les mélanger
 * avec ce qui part ferait croire qu'on peut demander au modèle de rendre du
 * 64 px, ce qu'aucun modèle ne fait.
 */
function CeQueLUniversEnvoie({
  univers,
  artworks,
}: {
  univers: Univers
  artworks: Carte[]
}) {
  const actives = univers.bible.filter((c) => c.actif && c.texte.trim())
  const signes = actives.reduce((somme, c) => somme + c.texte.trim().length, 0)
  return (
    <div className="mesure shrink-0 border-t border-bord p-2 text-[10px] text-texte-3">
      <p className="mb-1 text-[9.5px] tracking-[.11em] uppercase">
        Ce que cet univers envoie
      </p>
      <p className="flex items-center gap-2">
        <span>cases de style</span>
        <span className="ml-auto text-texte-2">
          {actives.length} sur {univers.bible.length}
        </span>
      </p>
      <p className="flex items-center gap-2">
        <span>signes de texte</span>
        <span className="ml-auto text-texte-2">{signes}</span>
      </p>
      <p className="flex items-center gap-2">
        <span>images officielles</span>
        <span className="ml-auto text-texte-2">{artworks.length}</span>
      </p>
      {/* **Ce qui n'agit qu'au retour**, dit à part et nommé comme tel. */}
      <p className="mt-1 flex items-start gap-1.5 border-t border-bord pt-1">
        <span aria-hidden className="mt-1.5 inline-block h-px w-2 shrink-0 bg-texte-3" />
        <span>
          la taille de pixel et le barème ne partent pas : ils s'appliquent à
          l'image qui revient
        </span>
      </p>
    </div>
  )
}


// ── Les cinq réglages du jeu ────────────────────────────────────────────────
//
// **La colonne de 380 px est morte avec E7.** Elle empilait ces cinq blocs sur
// 1 843 px de hauteur dans 646 px visibles, à côté d'un tableau qui n'avait plus
// que la moitié de l'écran. Ils vivent maintenant un par un dans le côté
// Réglages, où chacun a la place entière, et la liste de gauche dit lequel est
// ouvert.



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
  onRegler: Regler
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
  onRegler: Regler
}) {
  const poser = (bareme: Echelle[]) => void onRegler({ bareme })
  // Quelle rangée est dépliée. **De l'écran, jamais de l'univers** : ouvrir une
  // rangée ne change pas le jeu.
  const [ouvert, setOuvert] = useState("")

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
      {/* **L'occupation n'agit que par la grille**, qui est ce qui met un sujet
          à l'échelle de sa case : sans taille de pixel, elle ne s'applique
          pas. La famille et la silhouette, elles, continuent — l'une décide des
          artworks qui partent, l'autre du détourage. Le barème reste donc
          lisible et réglable : ce qui manque est une étape, pas un droit. */}
      {univers.cible_px === AUCUNE_CIBLE && (
        <Raison texte="sans taille de pixel, l'occupation ne s'applique pas — la famille et la silhouette, si" />
      )}
      {/* **Une rangée de 26 px par type, et ses trois réglages dessous.**
          Mesuré : les trois contrôles dépliés en permanence faisaient 92 px par
          ligne, soit 644 px pour sept types — plus haut que la description, qui
          part pourtant avec chaque génération. Régler deux types de suite
          demande deux clics de plus ; c'est un geste rare — une valeur sur 63 a
          bougé en trois projets — et la lecture, elle, est permanente. */}
      <ul className="flex flex-col rounded-[2px] border border-bord">
        {univers.bareme.map((echelle, rang) => (
          <li key={echelle.nom} className="border-b border-bord last:border-b-0">
            <button
              type="button"
              aria-pressed={ouvert === echelle.nom}
              aria-label={echelle.nom}
              onClick={() => setOuvert(ouvert === echelle.nom ? "" : echelle.nom)}
              className={[
                "mesure flex h-[26px] w-full items-center gap-2 px-2 text-left text-[10px] transition-colors duration-[80ms]",
                ouvert === echelle.nom ? "bg-fond-3" : "hover:bg-fond-2",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte">
                {echelle.nom}
              </span>
              <span className="shrink-0 text-texte-3">
                {NOM_FAMILLE[echelle.famille]} · {echelle.occupation} %
                {echelle.silhouette ? " · silhouette" : ""}
              </span>
            </button>
            {ouvert === echelle.nom && (
              <div className="flex flex-col gap-1 px-2 pb-2">
                <select
                  value={echelle.famille}
                  aria-label={`Famille de ${echelle.nom}`}
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
                <Curseur
                  libelle="l'occupation"
                  valeur={echelle.occupation}
                  min={10}
                  max={100}
                  unite=" %"
                  onChange={(occupation) =>
                    poser(
                      univers.bareme.map((x, i) =>
                        i === rang ? { ...x, occupation } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
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
              </div>
            )}
          </li>
        ))}
      </ul>
      {/* **Montré grisé plutôt que caché** : on apprend qu'il existe, et on sait
          pourquoi il n'est pas là. C'est déjà la règle du produit pour tout ce
          qui est indisponible. */}
      <button
        type="button"
        disabled
        className="mesure h-[26px] self-start px-2 text-[10px] text-texte-3"
      >
        + type sur mesure — plus tard, les huit types couvrent ce qu'on sait faire
      </button>
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
  onRegler: Regler
}) {
  const poses = FAMILLES.filter((f) => f !== "tous" && univers.modeles[f]).length

  return (
    <Bloc
      cle="univers.defauts"
      aide="univers.modeles"
      titre="Modèle par défaut"
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
            {/* **Une liste vide dit ce qui décidera à sa place.** Ce n'est pas
                un réglage inutile : c'est un réglage que rien n'oblige à
                toucher, et dont la valeur vide veut dire quelque chose. On
                apprend la règle en lisant le réglage, sans avoir à la chercher
                ailleurs. */}
            {!univers.modeles[famille] && (
              <span className="mesure shrink-0 text-[9.5px] text-texte-3">
                aucun choisi —{" "}
                {univers.modele_planche
                  ? "l'atelier emploiera le modèle de planche"
                  : "l'atelier emploiera le défaut du catalogue"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* **Deux défauts d'appel, et pas une famille de plus** (C2). La liste
          au-dessus est indexée par *ce qu'on fabrique* ; ces deux-ci répondent
          à *quelle sorte d'appel on fait*, et les mêler aurait demandé deux clés
          réservées dans un espace de noms qui est celui de l'auteur.

          Deux, et pas un : à l'essai du 28 août, un modèle rend les traits du
          gabarit dans l'image là où un autre les ignore comme demandé. */}
      <ul className="mt-2 flex flex-col rounded-[2px] border border-bord">
        {(
          [
            ["modele_planche", "planche", "quand un lot d'attitudes part"],
            ["modele_edition", "édition", "quand un corps se retouche"],
          ] as const
        ).map(([champ, nom, quand]) => (
          <li
            key={champ}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2" title={quand}>
              {nom}
            </span>
            <select
              value={univers[champ] ?? ""}
              onChange={(e) => void onRegler({ [champ]: e.target.value })}
              aria-label={`Modèle par défaut pour une ${nom}`}
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

/** La bible — sept champs nommés, chacun activable indépendamment (US-56).
 *
 *  Le texte libre est ce qu'on retape ; les champs nommés sont ce qu'on dose.
 *  L'interrupteur est à côté du champ et pas dans un menu : « doser ce qui
 *  contraint » est un geste qu'on fait en regardant ce qu'on relâche. */
function Bible({
  bible,
  onRegler,
}: {
  bible: { nom: string; texte: string; actif: boolean }[]
  onRegler: (bible: { nom: string; texte: string; actif: boolean }[]) => Promise<boolean>
}) {
  const [brouillon, setBrouillon] = useState(bible)

  useEffect(() => setBrouillon(bible), [bible])

  /** **Le seul bloc de l'univers qui tienne un brouillon**, parce qu'il porte
   *  du texte qu'on tape. Les quatre autres lisent l'univers tel qu'il est, et
   *  une valeur refusée ne s'y affiche donc jamais. Ici il faut le dire :
   *  refusé, le brouillon revient à ce que le projet porte. */
  const poser = async (suivante: typeof bible) => {
    setBrouillon(suivante)
    if (!(await onRegler(suivante))) setBrouillon(bible)
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
                void poser(
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
            {/* Sept champs voisins, tous du texte libre, et rien à l'écran ne
                disait lequel porte quoi : la forme exacte du défaut `groupe`
                contre `famille`, à sept exemplaires. Chacun porte donc son
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
            onBlur={() => void poser(brouillon)}
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
  rendu: "pixel art 16 bits, palette limitée",
  trait: "contour brun d'un pixel, aplats, pas de dégradé",
  eclairage: "lumière rasante, ombres portées courtes",
  vue: "trois quarts, corps entier, sujet centré",
  technique: "sprite sur fond uni, une seule pose",
}

/** Une étape ouverte — titrée, entière, et **jamais repliable**.
 *
 *  Le bloc repliable sert à ranger plusieurs réglages dans une colonne étroite.
 *  Ici l'étape *est* l'unité : la colonne de gauche dit laquelle est ouverte, et
 *  l'écran entier lui est donné. Un repli à l'intérieur serait un repli de trop
 *  — il faudrait déplier pour voir ce qu'on vient d'ouvrir. */
function EtapeOuverte({
  titre,
  aide,
  children,
}: {
  titre: string
  aide?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[12.5px] text-texte">
        <Libelle aide={aide}>{titre}</Libelle>
      </h2>
      {children}
    </section>
  )
}

// ── Les étapes neuves de E8 ─────────────────────────────────────────────────

/**
 * Une vignette d'exemple, ou son identifiant quand l'image n'est pas là.
 *
 * **Les dix-sept vignettes sont une production d'images, pas du code** : huit
 * vues, neuf tailles, à faire une fois. Tant qu'une manque, la case le dit
 * plutôt que de faire semblant — c'est la règle du grisé qui porte sa raison,
 * appliquée à une image absente. Les consignes de production vivent dans
 * `docs/vignettes-vues.md`.
 */
function Vignette({ nom, alt }: { nom: string; alt: string }) {
  const [absente, setAbsente] = useState(false)
  if (absente) {
    return (
      <span className="mesure flex h-[64px] w-[64px] shrink-0 items-center justify-center border border-bord bg-fond-2 p-1 text-center text-[9.5px] text-texte-3">
        pas encore dessinée
      </span>
    )
  }
  return (
    <img
      src={`/vignettes/${nom}.png`}
      alt={alt}
      onError={() => setAbsente(true)}
      className="damier h-[64px] w-[64px] shrink-0 border border-bord object-contain"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

/** Étape 1 — le nom du jeu.
 *
 *  **L'assistant ne crée pas le jeu, il le renomme** : sur une machine neuve,
 *  le « Bac à sable » existe déjà, et rien n'est exigé pour commencer.
 *  L'identifiant, lui, ne bouge pas. */
function LeNom({ onErreur }: { onErreur: (raison: string) => void }) {
  const [projet, setProjet] = useState<{ identifiant: string; nom: string } | null>(null)
  const [brouillon, setBrouillon] = useState("")

  useEffect(() => {
    void api
      .arbre()
      .then((arbre) => {
        const ouvert = arbre?.projets?.find((p) => p.identifiant === arbre.courant)
        if (!ouvert) return
        setProjet({ identifiant: ouvert.identifiant, nom: ouvert.nom })
        setBrouillon(ouvert.nom)
      })
      .catch(() => setProjet(null))
  }, [])

  return (
    <EtapeOuverte aide="assistant.nom" titre="1 · Le nom">
      <p className="text-[12.5px] text-texte-2">
        Comment le jeu s'appelle. C'est le seul réglage qui ne part jamais au
        modèle : il sert à s'y retrouver.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={brouillon}
          aria-label="Le nom du jeu"
          onChange={(e) => setBrouillon(e.target.value)}
          className="h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[13px] text-texte"
        />
        <button
          type="button"
          disabled={!projet || !brouillon.trim() || brouillon === projet?.nom}
          onClick={() =>
            projet &&
            void api
              .renommerProjet(projet.identifiant, brouillon)
              .then(({ projet: neuf }) =>
                setProjet({ identifiant: projet.identifiant, nom: neuf.nom }),
              )
              .catch((erreur) => onErreur(String(erreur)))
          }
          className="mesure h-[34px] shrink-0 rounded-[2px] border border-bord-fort px-3 text-[11.5px] text-texte-2 hover:text-signal disabled:text-texte-3"
        >
          renommer
        </button>
      </div>
      {projet && (
        <Raison
          texte={`le dossier reste « ${projet.identifiant} » — un dossier qui se renomme sous ses fichiers est un déménagement, pas un renommage`}
        />
      )}
    </EtapeOuverte>
  )
}

/** Étape 2 — la vue du jeu.
 *
 *  **Chaque vue est une vignette, pas une ligne de texte** : on ne choisit pas
 *  *isométrique* dans l'abstrait, on choisit celle qu'on reconnaît. */
function LaVue({
  univers,
  vues,
  onRegler,
}: {
  univers: Univers
  vues: VueDuJeu[]
  onRegler: Regler
}) {
  return (
    <EtapeOuverte aide="assistant.vue" titre="2 · La vue">
      <p className="text-[12.5px] text-texte-2">
        Ce choix ne décide pas de l'apparence du jeu. Il décide de{" "}
        <strong className="text-texte">combien d'images il faut par pose</strong>{" "}
        — c'est le chiffre qui multiplie toute la production, donc tout ce qu'on
        paiera.
      </p>
      <ul className="flex flex-col gap-1">
        {(vues ?? []).map((vue) => (
          <li key={vue.identifiant}>
            <button
              type="button"
              aria-pressed={univers.vue === vue.identifiant}
              onClick={() => void onRegler({ vue: vue.identifiant })}
              className={[
                "flex w-full items-center gap-3 rounded-[2px] border p-2 text-left transition-colors duration-[80ms]",
                univers.vue === vue.identifiant
                  ? "border-signal bg-signal/13"
                  : "border-bord hover:bg-fond-2",
              ].join(" ")}
            >
              <Vignette nom={vue.identifiant} alt={vue.libelle} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-texte">{vue.libelle}</span>
                <span className="mesure block text-[10px] text-texte-3">
                  {vue.exemples}
                </span>
              </span>
              <span className="mesure shrink-0 text-[10px] text-texte-2">
                {vue.images} image{vue.images > 1 ? "s" : ""} par pose
              </span>
            </button>
          </li>
        ))}
      </ul>
      {univers.vue && (
        <Raison texte="ce choix écrit aussi la phrase de la case « vue » — les deux ne peuvent plus se contredire" />
      )}
    </EtapeOuverte>
  )
}

/** Étape 3 — la taille des images.
 *
 *  **Le plus coûteux des dix.** Tout ce qui a été fabriqué a été découpé à
 *  l'ancienne taille : les images ne se recoupent pas, il faut les refabriquer,
 *  et chacune se paie. La ligne le dit avec le compte et le coût — puis laisse
 *  passer. **Le réglage n'est jamais grisé.** */
function LaTaille({
  univers,
  tailles,
  onRegler,
  onRealigner,
}: {
  univers: Univers
  tailles: TailleDImage[]
  onRegler: Regler
  onRealigner: () => void
}) {
  const [vise, setVise] = useState<number | null>(null)
  const [casse, setCasse] = useState<Consequences | null>(null)

  useEffect(() => {
    if (vise === null || vise === univers.cible_px) {
      setCasse(null)
      return
    }
    void api
      .consequences(vise)
      .then(setCasse)
      .catch(() => setCasse(null))
  }, [vise, univers.cible_px])

  return (
    <EtapeOuverte aide="assistant.taille" titre="3 · La taille">
      <p className="text-[12.5px] text-texte-2">
        Le côté de la case où tout ce qui rentre est ramené. Le même personnage
        est dessiné à chaque taille : un nombre ne dit rien, deux personnages
        côte à côte disent tout.
      </p>
      {/* **« Aucune » est une valeur, pas un trou** (US-163), et elle est en
          tête parce qu'elle est la première question — *ce jeu est-il en pixel
          art ?* — et non la dernière. Elle n'a pas de vignette : il n'y a rien
          à montrer d'une image qu'on ne ramène nulle part. */}
      <button
        type="button"
        aria-pressed={univers.cible_px === AUCUNE_CIBLE}
        onPointerEnter={() => setVise(AUCUNE_CIBLE)}
        onPointerLeave={() => setVise(null)}
        onClick={() => void onRegler({ cible_px: AUCUNE_CIBLE })}
        className={[
          "flex h-[34px] items-center gap-2 rounded-[2px] border px-2 text-left text-[11.5px] transition-colors duration-[80ms]",
          univers.cible_px === AUCUNE_CIBLE
            ? "border-signal bg-signal/13 text-signal"
            : "border-bord text-texte-2 hover:bg-fond-2",
        ].join(" ")}
      >
        {NOM_CIBLE["0"]}
        <span className="mesure text-[10px] text-texte-3">
          — ce jeu n'est pas en pixel art : l'image entre telle que le modèle l'a rendue
        </span>
      </button>
      {/* **Ce qui continue de s'appliquer**, dit là où on choisit de ne plus
          remettre sur grille : sans cette ligne, « aucune » se lirait comme
          « plus aucun traitement », ce qui est faux. */}
      {univers.cible_px === AUCUNE_CIBLE && (
        <Raison texte="aucune remise sur grille — le détourage, le recadrage et la palette s'appliquent toujours" />
      )}
      <ul className="flex flex-wrap gap-1">
        {tailles.map(({ cible, quoi }) => (
          <li key={cible}>
            <button
              type="button"
              aria-pressed={univers.cible_px === cible}
              onPointerEnter={() => setVise(cible)}
              onPointerLeave={() => setVise(null)}
              onClick={() => void onRegler({ cible_px: cible })}
              // Le nom accessible est la mesure, et rien de plus : l'alternative
              // de la vignette et le libellé s'ajouteraient sinon au nom, et une
              // case qu'on désigne par trois choses n'est plus une case.
              aria-label={`${cible} px`}
              title={quoi}
              className={[
                "flex w-[86px] flex-col items-center gap-1 rounded-[2px] border p-1 transition-colors duration-[80ms]",
                univers.cible_px === cible
                  ? "border-signal bg-signal/13"
                  : "border-bord hover:bg-fond-2",
              ].join(" ")}
            >
              <Vignette nom={`taille-${cible}`} alt={`${cible} pixels`} />
              <span className="mesure text-[10px] text-texte-2">{cible} px</span>
            </button>
          </li>
        ))}
      </ul>
      {/* **Un changement qui casse du travail payé annonce les vrais chiffres**,
          puis laisse décider : le produit n'a qu'un seul refus automatique, et
          en ajouter un deuxième reviendrait à bloquer un auteur sur son jeu. */}
      {casse && casse.images > 0 && (
        <p className="mesure text-[10px] text-epingle">
          {casse.images} image{casse.images > 1 ? "s ont" : " a"} déjà été
          découpée{casse.images > 1 ? "s" : ""} en {casse.cible} px — les
          refabriquer coûte environ {casse.cout_usd.toFixed(2)} $
        </p>
      )}
      <Raison texte="ce choix écrit aussi la phrase de grille et celle de calage — le réglage et le texte envoyé ne peuvent plus se contredire" />
      <button
        type="button"
        onClick={onRealigner}
        className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair"
      >
        Tout réaligner ›
      </button>
    </EtapeOuverte>
  )
}

/** Les deux cases qui décrivent **le cadre**, et non la matière.
 *
 *  La frontière passe exactement là où elle était déjà dans l'ordre des sept ;
 *  elle n'avait simplement jamais rien fait. Elle fait maintenant deux choses :
 *  sur une **reprise**, seules les cinq cases de matière partent — la pièce
 *  ajoutée a besoin de savoir qu'elle est naine et forgée, pas qu'on lui redise
 *  l'angle de caméra que la feuille montre déjà et que la consigne interdit de
 *  changer. Et **une ambiance ne peut toucher qu'à la matière**. */
const CADRE = ["vue", "technique"] as const

/** Étape 5 — l'allure, et les étiquettes.
 *
 *  **La plus longue des dix, et celle qui pèse le plus lourd** : sur une
 *  génération payée, ces sept cases représentent 890 caractères sur 1 690 — 53 %
 *  du texte envoyé — quand le sujet tapé en fait 40, soit 2 %. La description
 *  pèse vingt-deux fois le sujet ; ce qu'elle dit de travers, elle le dit fort.
 */
function LesEtiquettes({
  univers,
  etiquettes,
  onEtiquettes,
  onRegler,
  onErreur,
}: {
  univers: Univers
  etiquettes: Etiquette[]
  onEtiquettes: (etiquettes: Etiquette[]) => void
  onRegler: (bible: { nom: string; texte: string; actif: boolean }[]) => Promise<boolean>
  onErreur: (raison: string) => void
}) {
  const [ouverte, setOuverte] = useState<string>("monde")
  const [cherche, setCherche] = useState("")
  const [neuve, setNeuve] = useState<{ libelle: string; texte: string } | null>(null)

  const champ = univers.bible.find((c) => c.nom === ouverte) ?? {
    nom: ouverte,
    texte: "",
    actif: true,
  }

  const poser = (texte: string) =>
    void onRegler(
      univers.bible.map((c) => (c.nom === ouverte ? { ...c, texte } : c)),
    )

  // **Une recherche d'étiquettes ne montre que celles de la case où l'on se
  // trouve** : une étiquette d'éclairage ne paraît pas dans la case du trait.
  // Sans ce filtre, la liste cesserait d'être une liste.
  const disponibles = etiquettes
    .filter((e) => e.case === ouverte)
    .filter((e) => e.libelle.toLowerCase().includes(cherche.trim().toLowerCase()))
    .sort((a, b) => b.emplois - a.emplois)

  return (
    <EtapeOuverte aide="assistant.etiquettes" titre="Décrire en cliquant plutôt qu'en rédigeant">
      <Segments
        valeurs={univers.bible.map((c) => c.nom)}
        valeur={ouverte}
        libelles={NOM_CHAMP}
        onChange={setOuverte}
      />
      {CADRE.includes(ouverte as (typeof CADRE)[number]) && (
        <Raison texte="ces deux cases décrivent le cadre : elles ne partent pas dans une reprise" />
      )}



      {/* **Une étiquette est une paire** : un libellé qu'on clique, et le texte
          anglais qui part vraiment. C'est ce qui rend la description mécanique
          au lieu d'être rédigée. */}
      <div className="flex flex-col gap-1">
        <Libelle aide="assistant.etiquettes">
          disponibles — {disponibles.length} dans la base
        </Libelle>
        <input
          value={cherche}
          aria-label={`Rechercher une étiquette de ${NOM_CHAMP[ouverte] ?? ouverte}`}
          placeholder={`rechercher une étiquette de ${NOM_CHAMP[ouverte] ?? ouverte}…`}
          onChange={(e) => setCherche(e.target.value)}
          className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte"
        />
        {disponibles.length === 0 && (
          // **La base naît vide, et elle le dit franchement** plutôt que de
          // faire semblant : au premier jeu, cette étape est sept champs de
          // texte libre.
          <Raison texte="rien dans la base pour cette case — au premier jeu c'est normal, et chaque étiquette fabriquée sert ensuite à tous les jeux" />
        )}
        <ul className="flex flex-wrap gap-1">
          {disponibles.map((etiquette) => (
            <li key={etiquette.identifiant}>
              <button
                type="button"
                title={etiquette.texte}
                onClick={() => {
                  poser(
                    champ.texte.trim()
                      ? `${champ.texte.trim()}, ${etiquette.texte}`
                      : etiquette.texte,
                  )
                  void api
                    .etiquetteServie(etiquette.identifiant)
                    .then((recu) => onEtiquettes(recu.etiquettes))
                    .catch(() => undefined)
                }}
                className="mesure h-[24px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte-2 hover:text-signal"
              >
                {etiquette.libelle}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setNeuve({ libelle: "", texte: "" })}
          className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair"
        >
          + fabriquer une étiquette
        </button>
        {neuve && (
          <div className="flex flex-col gap-1 border-t border-bord pt-2">
            <input
              value={neuve.libelle}
              aria-label="Le libellé français"
              placeholder="le libellé, en français — « brume basse »"
              onChange={(e) => setNeuve({ ...neuve, libelle: e.target.value })}
              className="h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11.5px] text-texte"
            />
            <input
              value={neuve.texte}
              aria-label="Le texte anglais qui partira"
              placeholder="le texte anglais qui partira — « thick low-lying fog »"
              onChange={(e) => setNeuve({ ...neuve, texte: e.target.value })}
              className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte"
            />
            <button
              type="button"
              disabled={!neuve.libelle.trim() || !neuve.texte.trim()}
              onClick={() =>
                void api
                  .fabriquerEtiquette(neuve.libelle, neuve.texte, ouverte)
                  .then((recu) => {
                    onEtiquettes(recu.etiquettes)
                    setNeuve(null)
                  })
                  .catch((erreur) => onErreur(String(erreur)))
              }
              className="mesure h-6 self-start text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
            >
              la fabriquer ›
            </button>
            <Raison texte="elle rejoint la base pour tous les jeux de l'atelier — comme la clé du fournisseur, elle ne dépend d'aucun" />
          </div>
        )}
      </div>

      {/* **Le texte final, en lecture seule** : c'est la règle du produit — ce
          qui est montré est ce qui part, mot pour mot. */}
      <div className="flex flex-col gap-1 border-t border-bord pt-2">
        <Libelle>ce qui partira — {champ.texte.trim().length} caractères</Libelle>
        <textarea
          value={champ.texte}
          aria-label={`Le texte de la case ${NOM_CHAMP[ouverte] ?? ouverte}`}
          onChange={(e) => poser(e.target.value)}
          rows={3}
          className="mesure rounded-[2px] border border-bord bg-fond-2 p-2 text-[10px] text-texte"
        />
      </div>
    </EtapeOuverte>
  )
}

/** Étape 6, seconde moitié — le texte à copier dans un outil d'images.
 *
 *  **Il répond à un vrai problème : on n'a pas toujours d'images à déposer.** Un
 *  jeu qui démarre n'a que des mots. L'assistant assemble donc, à partir des
 *  étapes précédentes, un texte tout prêt à coller dans n'importe quel outil
 *  grand public — on récupère quatre images, on en garde une ou deux, on les
 *  dépose ici. **Rien n'est payé par l'atelier.**
 *
 *  L'atelier a bien de quoi générer lui-même, mais chaque image se paierait
 *  avant même que le jeu existe, et sur un modèle choisi à un moment où l'auteur
 *  n'a encore rien réglé. Et il a une seconde vertu : c'est la première fois
 *  qu'on voit sa description **assemblée** — beaucoup de contradictions se
 *  remarquent là. */
function LeTexteACopier({
  univers,
  vue,
}: {
  univers: Univers
  vue: VueDuJeu | null
}) {
  const [copie, setCopie] = useState(false)
  const lignes = [
    "I am designing a 2D game. Here is what I know so far.",
    "",
    ...(vue ? [`View: ${vue.phrase}`] : []),
    ...(univers.cible_px ? [`Sprite size: ${univers.cible_px} x ${univers.cible_px} pixels`] : []),
    ...univers.bible
      .filter((c) => c.texte.trim())
      .map((c) => `${NOM_CHAMP[c.nom] ?? c.nom}: ${c.texte.trim()}`),
    "",
    "Produce one key image that captures the mood of this game, plus three",
    "variants that explore different colour temperatures. A single scene, not a",
    "grid. No text, no interface elements, landscape format.",
  ]
  const texte = lignes.join("\n")

  return (
    <EtapeOuverte aide="assistant.texte" titre="Le texte à copier — pour ne pas partir de rien">
      <p className="text-[12.5px] text-texte-2">
        Collez-le dans ChatGPT, Midjourney ou tout autre outil d'images, puis
        déposez ici ce qui vous plaît. <strong className="text-texte">Rien
        n'est payé par l'atelier</strong> : c'est la première fois qu'on voit sa
        description assemblée, et beaucoup de contradictions se remarquent là.
      </p>
      <pre className="mesure defile max-h-[220px] overflow-auto rounded-[2px] border border-bord bg-fond-2 p-2 text-[10px] whitespace-pre-wrap text-texte-2">
        {texte}
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(texte)
          setCopie(true)
        }}
        className="mesure h-[34px] self-start rounded-[2px] border border-bord-fort px-3 text-[11.5px] text-texte-2 hover:text-signal"
      >
        {copie ? "copié" : "copier"}
      </button>
    </EtapeOuverte>
  )
}

/** Étape 7 — les poses et les états, **type par type** (E9).
 *
 *  Une pose, c'est un moment d'un objet : un personnage au repos, en marche,
 *  qui attaque ; un coffre fermé, ouvert, vidé. **Le nombre d'images de chaque
 *  pose vient du choix de vue**, à l'étape 2 : il ne se tape plus à la main, et
 *  c'est ce qui répare les sept endroits qui ne se parlaient pas.
 *
 *  **La liste appartient au type d'objet, plus au jeu entier** (E9). Avant, le
 *  jeu déclarait une seule liste et tout la recevait : un coffre héritait de
 *  *marche* et de *course*, qu'il fallait ranger une par une, sur chaque
 *  coffre. Chaque rangée dit donc d'où sa liste lui vient — écrite ici, proposée
 *  par l'atelier, ou partagée avec le jeu — parce qu'une liste héritée ne doit
 *  pas avoir l'air d'une liste choisie. */
function LesPoses({
  vue,
  onErreur,
}: {
  vue: VueDuJeu | null
  onErreur: (raison: string) => void
}) {
  const [plan, setPlan] = useState<Pose[]>([])
  const [types, setTypes] = useState<PosesDesTypes["types"]>([])
  // Quelle rangée est dépliée. **De l'écran, jamais du jeu** : ouvrir un type
  // ne change rien — c'est la décision déjà prise par le barème, deux étapes
  // plus haut, et pour la même mesure.
  const [ouvert, setOuvert] = useState("")

  const fondre = (recu: PosesDesTypes | undefined) => {
    setTypes(recu?.types ?? [])
    setPlan(recu?.plan ?? [])
  }

  useEffect(() => {
    void api
      .posesDesTypes()
      .then(fondre)
      .catch(() => fondre(undefined))
  }, [])

  const echouer = (erreur: unknown) => onErreur(String(erreur))

  return (
    <EtapeOuverte aide="assistant.poses" titre="7 · Poses et états">
      <p className="text-[12.5px] text-texte-2">
        Ce que chaque type d'objet peut faire. Le nombre d'images vient de la vue
        {vue ? ` — ${vue.libelle}, ${vue.images} par pose` : ""}.
      </p>

      {/* **Le plan du jeu en premier, et il n'a pas disparu.** C'est ce que
          suivent le personnage, la créature, et toutes les choses créées avant
          que les types aient leur liste — c'est ce qui les reprend sans perte.
          Le cacher aurait rendu ces choses-là irréglables. */}
      <ListeDePoses
        titre="Le plan du jeu"
        raison="ce que suivent le personnage, la créature, et les choses sans type"
        poses={plan}
        images={vue?.images ?? 1}
        onAjouter={(nom, images) =>
          void api
            .ajouterPose(nom, images)
            .then((recu) => setPlan(recu.plan))
            .catch(echouer)
        }
        onRetirer={(pose) =>
          void api
            .retirerPose(pose)
            .then((recu) => setPlan(recu?.plan ?? []))
            .catch(echouer)
        }
      />

      <ul className="flex flex-col rounded-[2px] border border-bord">
        {types.map((type) => (
          <li key={type.nom} className="border-b border-bord last:border-b-0">
            <button
              type="button"
              aria-pressed={ouvert === type.nom}
              aria-label={type.nom}
              onClick={() => setOuvert(ouvert === type.nom ? "" : type.nom)}
              className={[
                "mesure flex h-[26px] w-full items-center gap-2 px-2 text-left text-[10px] transition-colors duration-[80ms]",
                ouvert === type.nom ? "bg-fond-3" : "hover:bg-fond-2",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte">
                {type.nom}
              </span>
              <span className="shrink-0 text-texte-3">
                {type.poses.length === 0
                  ? "aucune pose"
                  : `${type.poses.length} pose${type.poses.length > 1 ? "s" : ""}`}
                {" · "}
                {ORIGINE_DU_TYPE[type.origine]}
              </span>
            </button>

            {ouvert === type.nom && (
              <div className="flex flex-col gap-2 px-2 pb-2">
                <ListeDePoses
                  raison={RAISON_ORIGINE[type.origine]}
                  poses={type.poses}
                  images={vue?.images ?? 1}
                  // **Écrire ici donne à ce type sa propre liste**, et le texte
                  // le dit avant qu'on écrive : une liste partagée qui se
                  // détache d'un jeu sans prévenir serait une surprise, et le
                  // produit constate plutôt qu'il ne surprenne.
                  onAjouter={(nom, images) =>
                    void api
                      .poserPosesDuType(type.nom, [
                        ...type.poses,
                        {
                          identifiant: identifiantDePose(nom, type.poses),
                          nom,
                          images,
                          // **Vide, et c'est une valeur** (E10) : le produit ne
                          // traduit pas en anglais le nom qu'on vient de taper.
                          // C'est alors le nom qui part, et l'écran le dit.
                          consigne: "",
                          ecartees: [],
                          images_avant: 0,
                        },
                      ])
                      .then(fondre)
                      .catch(echouer)
                  }
                  onRetirer={(pose) =>
                    void api
                      .poserPosesDuType(
                        type.nom,
                        type.poses.filter((p) => p.identifiant !== pose),
                      )
                      .then(fondre)
                      .catch(echouer)
                  }
                />

                {/* **Revenir à la liste proposée** — et seulement quand il y a
                    quelque chose à défaire. Sans ce geste, un type ne pourrait
                    jamais y revenir : il faudrait la retaper de mémoire, et la
                    moindre faute de frappe ferait une case orpheline. */}
                {type.origine === "écrite" && (
                  <button
                    type="button"
                    onClick={() =>
                      void api
                        .oublierPosesDuType(type.nom)
                        .then(fondre)
                        .catch(echouer)
                    }
                    title="les images ne bougent pas — elles gardent l'identifiant de leur pose"
                    className="mesure self-start px-1 text-[9.5px] text-texte-3 hover:text-signal"
                  >
                    revenir à la liste proposée
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </EtapeOuverte>
  )
}

/** Ce que la rangée d'un type dit de sa liste, en un mot. */
const ORIGINE_DU_TYPE: Record<string, string> = {
  écrite: "écrite ici",
  connue: "proposée",
  projet: "celle du jeu",
}

/** Et la même chose en une phrase, sous la liste dépliée. */
const RAISON_ORIGINE: Record<string, string> = {
  écrite: "cette liste a été écrite pour ce type — elle ne suit plus rien d'autre",
  connue: "ce que l'atelier propose pour ce type — l'écrire ici lui donnera la sienne",
  projet:
    "ce type suit le plan du jeu — écrire ici lui donnera sa propre liste, qui cessera de le suivre",
}

/** L'identifiant d'une pose neuve, **calculé où on l'écrit**.
 *
 *  Le serveur en fabrique un quand on nomme une pose du jeu ; ici c'est une
 *  liste entière qui part, et il faut donc en poser un. Les accents tombent,
 *  les espaces deviennent des tirets, et un doublon reçoit un numéro — la même
 *  règle que `repere` côté serveur, sur le seul point où elle doit s'accorder :
 *  deux poses de même identifiant seraient deux lignes que la matrice ne
 *  saurait pas distinguer. */
function identifiantDePose(nom: string, deja: Pose[]): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pose"
  const prises = new Set(deja.map((p) => p.identifiant))
  if (!prises.has(base)) return base
  let rang = 2
  while (prises.has(`${base}-${rang}`)) rang += 1
  return `${base}-${rang}`
}

/** Une liste de poses qui se lit, se complète et se raccourcit.
 *
 *  Écrite une fois et servie deux — au plan du jeu et à chaque type —, parce
 *  que ces deux listes n'ont aucune raison de se lire différemment. Ce qui
 *  change entre elles est **où l'écriture part**, et c'est l'appelant qui le
 *  décide. */
function ListeDePoses({
  titre,
  raison,
  poses,
  images,
  onAjouter,
  onRetirer,
}: {
  titre?: string
  raison: string
  poses: Pose[]
  /** Ce qu'une pose neuve demandera — **le choix de vue**, jamais un nombre
   *  tapé ici. C'est le lien qui répare les sept endroits qui divergeaient. */
  images: number
  onAjouter: (nom: string, images: number) => void
  onRetirer: (pose: string) => void
}) {
  const [neuve, setNeuve] = useState("")

  return (
    <div className="flex flex-col gap-1">
      {titre && <Libelle>{titre}</Libelle>}
      <Raison texte={raison} />
      {poses.length === 0 ? (
        // **Aucune pose est une réponse, pas un trou** : un décor et une tuile
        // ne bougent pas, ils se raccordent. La phrase le dit plutôt que de
        // laisser une liste vide passer pour un oubli.
        <p className="mesure text-[10px] leading-4 text-texte-3">
          aucune pose — une seule image remplit ce type
        </p>
      ) : (
        <ul className="flex flex-col">
          {poses.map((pose) => (
            <li
              key={pose.identifiant}
              className="mesure flex h-[26px] items-center gap-2 text-[11.5px] text-texte-2"
            >
              <span className="min-w-0 flex-1 truncate">{pose.nom}</span>
              <span className="text-[10px] text-texte-3">
                {pose.images} image{pose.images > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                aria-label={`Retirer ${pose.nom}`}
                onClick={() => onRetirer(pose.identifiant)}
                className="shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          value={neuve}
          aria-label={titre ? "Une pose de plus" : `Une pose de plus — ${raison}`}
          placeholder="une pose de plus…"
          onChange={(e) => setNeuve(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && neuve.trim()) {
              onAjouter(neuve.trim(), images)
              setNeuve("")
            }
          }}
          className="h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11.5px] text-texte"
        />
        <button
          type="button"
          disabled={!neuve.trim()}
          onClick={() => {
            onAjouter(neuve.trim(), images)
            setNeuve("")
          }}
          className="mesure h-[26px] shrink-0 px-2 text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
        >
          + ajouter
        </button>
      </div>
    </div>
  )
}

/** Étape 8 — les emplacements d'équipement.
 *
 *  **Proposée seulement si un type à silhouette existe** : un jeu de tuiles et
 *  de décors n'équipe personne, et lui montrer une liste vide serait lui
 *  demander de comprendre pourquoi elle l'est. */
function LesEmplacements({
  univers,
  onErreur,
}: {
  univers: Univers
  onErreur: (raison: string) => void
}) {
  const [emplacements, setEmplacements] = useState<EmplacementCorps[]>([])
  const [neuf, setNeuf] = useState("")
  const equipe = univers.bareme.some((e) => e.silhouette)

  useEffect(() => {
    void api
      .production()
      .then((recu) => setEmplacements(recu?.emplacements ?? []))
      .catch(() => setEmplacements([]))
  }, [])

  if (!equipe) {
    return (
      <EtapeOuverte aide="assistant.emplacements" titre="8 · Emplacements">
        <Raison texte="aucun type de ce jeu n'a de silhouette — un jeu de tuiles et de décors n'équipe personne, et cette étape n'a rien à régler" />
      </EtapeOuverte>
    )
  }

  return (
    <EtapeOuverte aide="assistant.emplacements" titre="8 · Emplacements">
      <p className="text-[12.5px] text-texte-2">
        Où l'on peut accrocher une pièce sur un corps. <strong className="text-texte">
        L'ordre compte</strong> : il décide de quelle pièce se dessine par-dessus
        l'autre.
      </p>
      <ul className="flex flex-col">
        {emplacements.map((emplacement) => (
          <li
            key={emplacement.identifiant}
            className="mesure flex h-[26px] items-center gap-2 text-[11.5px] text-texte-2"
          >
            <span className="min-w-0 flex-1 truncate">{emplacement.nom}</span>
            <button
              type="button"
              aria-label={`Retirer ${emplacement.nom}`}
              onClick={() =>
                void api
                  .retirerEmplacement(emplacement.identifiant)
                  .then((recu) => setEmplacements(recu?.emplacements ?? []))
                  .catch((erreur) => onErreur(String(erreur)))
              }
              className="shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={neuf}
          aria-label="Un emplacement de plus"
          placeholder="un emplacement de plus — la tête, le dos…"
          onChange={(e) => setNeuf(e.target.value)}
          className="h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[11.5px] text-texte"
        />
        <button
          type="button"
          disabled={!neuf.trim()}
          onClick={() =>
            void api
              .ajouterEmplacement(neuf)
              .then((recu) => {
                setEmplacements(recu.emplacements)
                setNeuf("")
              })
              .catch((erreur) => onErreur(String(erreur)))
          }
          className="mesure h-[26px] shrink-0 px-2 text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
        >
          + ajouter
        </button>
      </div>
    </EtapeOuverte>
  )
}

/** Étape 10 — la clé du fournisseur.
 *
 *  **Seule dans son groupe, parce qu'elle vaut pour tous les jeux** — comme la
 *  base d'étiquettes, elle ne dépend d'aucun. Trois portes, une seule pièce :
 *  ce qu'on dépose ici est la même valeur au même endroit que dans la fenêtre
 *  des réglages. */
function LaCle({ onErreur }: { onErreur: (raison: string) => void }) {
  const [etat, setEtat] = useState<EtatCle | null>(null)
  const [saisie, setSaisie] = useState("")

  // **Trois portes, une seule pièce** : ce qu'on lit ici est ce que la fenêtre
  // des réglages lit, et ce que la barre du haut annonce. L'état vient donc du
  // serveur, jamais d'une copie tenue à l'écran.
  useEffect(() => {
    void api
      .etat()
      .then((recu) => setEtat(recu.cle))
      .catch(() => setEtat(null))
  }, [])

  return (
    <EtapeOuverte aide="assistant.cle" titre="10 · La clé">
      <p className="text-[12.5px] text-texte-2">
        Le seul préalable dur du produit : sans elle, rien ne part chez le
        fournisseur. Elle vaut pour <strong className="text-texte">tous les
        jeux</strong> de l'atelier.
      </p>
      {etat?.presente ? (
        <Raison texte={`posée — ${etat.apercu}, depuis ${etat.origine}`} />
      ) : (
        <Raison
          texte={
            etat?.raison ??
            "aucune clé — le bouton qui paie reste éteint tant qu'elle manque"
          }
        />
      )}
      <div className="flex items-center gap-2">
        <input
          value={saisie}
          type="password"
          aria-label="La clé du fournisseur"
          placeholder="sk-or-…"
          onChange={(e) => setSaisie(e.target.value)}
          className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[10px] text-texte"
        />
        <button
          type="button"
          disabled={saisie.trim().length < 8}
          onClick={() =>
            void api
              .deposerCle(saisie)
              .then((recu) => {
                setEtat(recu)
                setSaisie("")
              })
              .catch((erreur) => onErreur(String(erreur)))
          }
          className="mesure h-[34px] shrink-0 rounded-[2px] border border-bord-fort px-3 text-[11.5px] text-texte-2 hover:text-signal disabled:text-texte-3"
        >
          déposer
        </button>
      </div>
    </EtapeOuverte>
  )
}
