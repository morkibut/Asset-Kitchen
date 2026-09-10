// Le côté Ambiances et couleurs — les palettes, et les lots de style (E11).
//
// **Un jeu n'a pas un seul style.** Il a un style général, et des coins qui s'en
// écartent : le marais plus gris et plus brumeux, les monstres de l'ombre plus
// froids. Redire ça sur chaque créature serait long et finirait par diverger.
// Une ambiance le dit une fois, et on s'en sert autant de fois qu'on veut.
//
// **Deux sortes d'objets, et les premières servent les secondes** : les palettes
// de couleurs, et les ambiances qui s'en servent. D'où l'ordre de la colonne —
// les ambiances d'abord, ce qu'on désigne ; les palettes ensuite, ce qui les
// alimente.
//
// **Le projet est l'ambiance générale du jeu** : il porte exactement les mêmes
// trois choses — une palette, des images de référence, des cases de texte. Une
// ambiance, c'est le même objet en plus petit et en plusieurs exemplaires. Il
// n'y a donc pas deux notions à apprendre.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  api,
  NOM_DE_CE_QU_ON_PREND,
  type AmbianceDuJeu,
  type ApercuDePalette,
  type CoteAmbiances,
  type PaletteNommee,
  type Pastille,
  type RetoucheDePalette,
  type SourceDePalette,
} from "../api"
import { Curseur, Jauge, Libelle, Raison, Segments } from "./chassis"

/** Ce qu'un onglet du panneau montre. Les mêmes quatre pour une ambiance, les
 *  mêmes quatre pour une palette : c'est le même geste — ouvrir une partie —,
 *  et deux vocabulaires auraient fait deux choses à apprendre. */
type Onglet = string

/** Ce que la colonne a ouvert. Le genre est dans la clé : une palette et une
 *  ambiance peuvent porter le même identifiant sans se confondre. */
type Ouvert = { genre: "ambiance" | "palette"; identifiant: string } | null

/** Ce qu'un autre écran demande d'ouvrir ici (U7).
 *
 *  **Le même type que `Ouvert`, et c'est délibéré** : la toile ne demande rien
 *  d'autre que ce que la colonne sait ouvrir, et un second vocabulaire pour la
 *  même chose aurait fabriqué une traduction à tenir. */
export type CibleAmbiances = NonNullable<Ouvert>

export function CoteAmbiancesEtCouleurs({
  onErreur,
  cible = null,
  onCibleVue,
}: {
  onErreur: (raison: string) => void
  /** L'objet qu'un autre écran veut voir ouvert ici — la palette qu'on vient de
   *  fabriquer depuis un îlot de la toile (U7). */
  cible?: CibleAmbiances | null
  /** **La cible se consomme**, sans quoi revenir sur ce côté rouvrirait
   *  toujours le même objet, longtemps après le geste qui l'a demandé. */
  onCibleVue?: () => void
}) {
  const [cote, setCote] = useState<CoteAmbiances | null>(null)
  const [ouvert, setOuvert] = useState<Ouvert>(null)

  useEffect(() => {
    if (!cible) return
    setOuvert(cible)
    onCibleVue?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible])

  const fondre = useCallback((recu: CoteAmbiances | undefined) => {
    // **Toute réponse d'une route est traitée comme une forme inconnue.** Le
    // produit a payé trois fois le contraire : un `{}` rendu par une route que
    // le double d'essai ne connaissait pas, lu comme une liste, blanchissait
    // l'application entière (`docs/PIEGES.md`).
    setCote({
      projet: recu?.projet ?? "",
      palettes: recu?.palettes ?? [],
      ambiances: recu?.ambiances ?? [],
      du_jeu: recu?.du_jeu ?? [],
    })
  }, [])

  useEffect(() => {
    void api
      .coteAmbiances()
      .then(fondre)
      .catch(() => fondre(undefined))
  }, [fondre])

  const echouer = (erreur: unknown) => onErreur(String(erreur))

  // ── L'attente se voit, avec la jauge du produit (U6) ──────────────────────
  //
  // **Une jauge, pas une neuve.** Le produit en a exactement une — celle de la
  // génération et de la retouche — et elle porte déjà le seuil de 240 ms qui
  // l'empêche de clignoter sur un geste court. C'est celle-là qu'on emploie :
  // un second indicateur d'attente aurait été une seconde grammaire à
  // apprendre pour la même chose.
  //
  // **Sans compteur.** Une palette se règle la main sur le curseur, comme une
  // retouche : `00:00 / ~00:00` y serait un nombre qui ne change jamais.
  //
  // *Après l'étape, elle ne devrait presque jamais paraître* — c'est le but.
  // Elle reste pour le seul cas qui coûte encore : la première lecture d'un
  // paquet d'images que rien n'a encore lu.
  const [enVol, setEnVol] = useState<{ depuis: number; attendue: number } | null>(
    null,
  )
  const attendue = useRef(0.3)
  const envols = useRef(0)

  const poser = (promesse: Promise<CoteAmbiances>) => {
    const depart = Date.now() / 1000
    envols.current += 1
    // La jauge garde le **premier** départ, comme celle de la retouche : deux
    // réglages posés coup sur coup sont une seule attente, pas deux.
    setEnVol((deja) => deja ?? { depuis: depart, attendue: attendue.current })
    void promesse
      .then((recu) => {
        attendue.current = Math.max(0.05, Date.now() / 1000 - depart)
        fondre(recu)
      })
      .catch(echouer)
      .finally(() => {
        envols.current -= 1
        if (envols.current === 0) setEnVol(null)
      })
  }

  if (!cote) return null

  const palette =
    ouvert?.genre === "palette"
      ? cote.palettes.find((p) => p.identifiant === ouvert.identifiant)
      : undefined
  const ambiance =
    ouvert?.genre === "ambiance"
      ? cote.ambiances.find((a) => a.identifiant === ouvert.identifiant)
      : undefined

  return (
    // **240 px à gauche, et c'est une des trois largeurs du produit** : la
    // colonne ne porte que des noms et des comptes, et une largeur inventée
    // pour elle aurait ouvert la porte à toutes les autres.
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
      <aside className="defile flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-bord bg-fond-1 p-3">
        <ListeDAmbiances
          ambiances={cote.ambiances}
          ouvert={ouvert}
          onOuvrir={setOuvert}
          onCreer={(nom) => poser(api.creerAmbiance(nom))}
          onErreur={echouer}
        />
        <ListeDePalettes
          palettes={cote.palettes}
          duJeu={cote.du_jeu}
          ouvert={ouvert}
          onOuvrir={setOuvert}
          onCreer={(nom) => poser(api.creerPalette(nom))}
          onErreur={echouer}
        />
      </aside>

      <div className="defile flex min-h-0 min-w-0 flex-col overflow-y-auto p-4">
        {/* Deux pixels réservés en permanence : une jauge qui pousserait le
            panneau vers le bas en paraissant ferait sauter ce qu'on regarde,
            et c'est précisément le geste où l'œil est resté sur les couleurs. */}
        <div data-attente-palette className="mb-3 h-[2px] shrink-0">
          {enVol && (
            <Jauge
              demarreLe={enVol.depuis}
              attendue={enVol.attendue}
              compteur={false}
              seuil={0.24}
            />
          )}
        </div>
        {ambiance ? (
          <PanneauAmbiance
            ambiance={ambiance}
            palettes={cote.palettes}
            onRegler={(champs) =>
              poser(api.reglerAmbiance(ambiance.identifiant, champs))
            }
            onSupprimer={() => {
              poser(api.supprimerAmbiance(ambiance.identifiant))
              setOuvert(null)
            }}
          />
        ) : palette ? (
          <PanneauPalette
            palette={palette}
            palettes={cote.palettes}
            onRegler={(champs) =>
              poser(api.reglerPalette(palette.identifiant, champs))
            }
            onSupprimer={() => {
              poser(api.supprimerPalette(palette.identifiant))
              setOuvert(null)
            }}
            onErreur={echouer}
          />
        ) : (
          <Vide />
        )}
      </div>
    </div>
  )
}

/** L'état vide, en serif — comme la bibliothèque et le tableau : c'est une
 *  invitation, et le troisième emploi du display. */
function Vide() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-[504px] flex-col items-center gap-3 text-center">
        <p className="font-serif text-[32px] leading-tight text-texte-3">
          Un jeu n'a pas un seul style.{" "}
          <em className="text-texte-2">Nomme le premier coin.</em>
        </p>
        <p className="mesure text-[10px] leading-relaxed text-texte-3">
          Une ambiance dit une fois ce qu'un coin du jeu a de différent — le
          marais plus gris, les monstres plus froids — et sert autant de fois
          qu'on veut. Une palette est la liste de couleurs qu'elle emploie ;
          celle du jeu en est une comme les autres.
        </p>
      </div>
    </div>
  )
}

// ── Les deux listes ─────────────────────────────────────────────────────────

function ListeDAmbiances({
  ambiances,
  ouvert,
  onOuvrir,
  onCreer,
  onErreur,
}: {
  ambiances: AmbianceDuJeu[]
  ouvert: Ouvert
  onOuvrir: (ouvert: Ouvert) => void
  onCreer: (nom: string) => void
  onErreur: (raison: string) => void
}) {
  return (
    <section className="flex flex-col gap-1">
      <Libelle>les ambiances</Libelle>
      <ul className="flex flex-col">
        {ambiances.map((ambiance) => (
          <li key={ambiance.identifiant}>
            <button
              type="button"
              aria-pressed={
                ouvert?.genre === "ambiance" &&
                ouvert.identifiant === ambiance.identifiant
              }
              onClick={() =>
                onOuvrir({ genre: "ambiance", identifiant: ambiance.identifiant })
              }
              className={[
                "mesure flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[10px] transition-colors duration-[80ms]",
                ouvert?.genre === "ambiance" &&
                ouvert.identifiant === ambiance.identifiant
                  ? "bg-fond-3"
                  : "hover:bg-fond-2",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte">
                {ambiance.nom}
              </span>
              {/* **Qui s'en sert, dès la liste** : c'est la question qu'on se
                  pose avant d'en ouvrir une, et la faire ouvrir pour y répondre
                  aurait coûté un clic par ambiance. */}
              <span className="shrink-0 text-texte-3">
                {ambiance.emplois.length === 0
                  ? "personne"
                  : `${ambiance.emplois.length} chose${ambiance.emplois.length > 1 ? "s" : ""}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ChampQuiCree
        libelle="Nouvelle ambiance"
        invite="+ nouvelle ambiance…"
        onCreer={onCreer}
        onErreur={onErreur}
      />
    </section>
  )
}

function ListeDePalettes({
  palettes,
  duJeu,
  ouvert,
  onOuvrir,
  onCreer,
  onErreur,
}: {
  palettes: PaletteNommee[]
  duJeu: string[]
  ouvert: Ouvert
  onOuvrir: (ouvert: Ouvert) => void
  onCreer: (nom: string) => void
  onErreur: (raison: string) => void
}) {
  return (
    <section className="flex flex-col gap-1">
      <Libelle>les palettes</Libelle>
      <ul className="flex flex-col">
        {/* **Celle du jeu en tête, et elle n'est pas un objet à part** : le
            projet *est* l'ambiance générale du jeu. Elle ne s'ouvre pas ici —
            elle se règle à l'étape « Références et couleurs » de l'assistant, où ses
            sources vivent —,
            et le dire évite d'aller la chercher dans deux endroits. */}
        <li className="mesure flex h-[26px] items-center gap-2 px-2 text-[10px]">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte-2">
            du jeu
          </span>
          <span className="shrink-0 text-texte-3">
            {duJeu.length ? `${duJeu.length} couleurs` : "aucune encore"}
          </span>
        </li>
        {palettes.map((palette) => (
          <li key={palette.identifiant}>
            <button
              type="button"
              aria-pressed={
                ouvert?.genre === "palette" &&
                ouvert.identifiant === palette.identifiant
              }
              onClick={() =>
                onOuvrir({ genre: "palette", identifiant: palette.identifiant })
              }
              className={[
                "mesure flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[10px] transition-colors duration-[80ms]",
                ouvert?.genre === "palette" &&
                ouvert.identifiant === palette.identifiant
                  ? "bg-fond-3"
                  : "hover:bg-fond-2",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-texte">
                {palette.nom}
              </span>
              <span className="shrink-0 text-texte-3">
                {palette.rendue.length} · {palette.sources.length} src
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ChampQuiCree
        libelle="Nouvelle palette"
        invite="+ nouvelle palette…"
        onCreer={onCreer}
        onErreur={onErreur}
      />
    </section>
  )
}

/** **Nommer, c'est créer.** Un champ, une entrée, et la chose existe — sans
 *  formulaire, sans bouton d'ouverture, et sans rien payer. C'est le geste du
 *  codex, ramené ici parce que c'est le même. */
function ChampQuiCree({
  libelle,
  invite,
  onCreer,
  onErreur,
}: {
  libelle: string
  invite: string
  onCreer: (nom: string) => void
  onErreur: (raison: string) => void
}) {
  const [nom, setNom] = useState("")

  return (
    <input
      value={nom}
      aria-label={libelle}
      placeholder={invite}
      onChange={(e) => setNom(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return
        const propre = nom.trim()
        if (!propre) return
        try {
          onCreer(propre)
          setNom("")
        } catch (erreur) {
          onErreur(String(erreur))
        }
      }}
      className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte placeholder:text-texte-3"
    />
  )
}

// ── Le panneau d'une palette ────────────────────────────────────────────────

/** Une palette n'est pas une liste, **c'est une recette** — et c'est le point
 *  le plus délicat de la tranche.
 *
 *  Pouvoir retirer une couleur, en ajouter une, doser entre deux palettes et
 *  finir à la main **casserait** la règle du dépôt si la palette devenait une
 *  liste qu'on modifie : elle cesserait de suivre ses sources, et promouvoir une
 *  nouvelle image ne changerait plus rien. Le produit a le motif qui s'en sort
 *  et l'applique partout : on garde la source et la recette, le résultat est un
 *  calcul jetable.
 *
 *  Les trois parties sont donc montrées dans l'ordre où elles s'appliquent :
 *  les sources, la fusion, les retouches — puis la palette rendue, puis
 *  l'aperçu qui la rend jugeable. */
function PanneauPalette({
  palette,
  palettes,
  onRegler,
  onSupprimer,
  onErreur,
}: {
  palette: PaletteNommee
  palettes: PaletteNommee[]
  onRegler: (champs: Parameters<typeof api.reglerPalette>[1]) => void
  onSupprimer: () => void
  onErreur: (raison: string) => void
}) {
  return (
    <section className="flex flex-col gap-5">
      <EnTete nom={palette.nom} onSupprimer={onSupprimer} />

      {/* **Une source disparue ne perd pas les couleurs.** Un paquet du tableau
          n'a pas d'identité à lui : il disparaît avec sa dernière carte. La
          palette garde alors ses couleurs — c'est un résultat rangé, il ne
          s'évapore pas — et affiche que sa source a disparu. */}
      {palette.sources_perdues.length > 0 && (
        <Raison
          texte={`${palette.sources_perdues.join(", ")} — cette source a disparu ; les couleurs, elles, restent`}
        />
      )}

      <LesSources
        palette={palette}
        palettes={palettes}
        onRegler={onRegler}
      />
      <LaFusion palette={palette} onRegler={onRegler} />
      <LesRetouches palette={palette} onRegler={onRegler} />
      <LaPaletteRendue palette={palette} onRegler={onRegler} />
      <LApercu palette={palette} onErreur={onErreur} />
    </section>
  )
}

function EnTete({ nom, onSupprimer }: { nom: string; onSupprimer: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="min-w-0 flex-1 truncate text-[15px] leading-none text-texte">
        {nom}
      </h2>
      <button
        type="button"
        onClick={onSupprimer}
        title="aucune image ne bouge — ce qui s'en servait retombe sur le jeu"
        className="mesure shrink-0 px-1 text-[10px] text-texte-3 hover:text-echec-froid"
      >
        Supprimer
      </button>
    </div>
  )
}

/** Ce dans quoi les couleurs se lisent. Trois genres et pas un de plus, et
 *  **l'ordre compte** : la première source est celle dont la proportion
 *  prélève. */
function LesSources({
  palette,
  palettes,
  onRegler,
}: {
  palette: PaletteNommee
  palettes: PaletteNommee[]
  onRegler: (champs: Parameters<typeof api.reglerPalette>[1]) => void
}) {
  const [paquet, setPaquet] = useState("")
  const poser = (sources: SourceDePalette[]) => onRegler({ sources })

  return (
    <div className="flex flex-col gap-2">
      <Libelle>1 · les sources</Libelle>
      <Raison texte="la première décide de ce que la proportion prélève ; les suivantes fournissent le reste" />
      <ul className="flex flex-wrap items-center gap-2">
        {palette.sources.map((source, rang) => (
          <li key={`${source.genre}-${source.reference}-${rang}`}>
            <span className="mesure inline-flex h-[26px] items-center gap-1 rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte-2">
              {nomDeSource(source, palettes)}
              <button
                type="button"
                aria-label={`Retirer la source ${nomDeSource(source, palettes)}`}
                onClick={() =>
                  poser(palette.sources.filter((_, autre) => autre !== rang))
                }
                className="px-1 text-texte-3 hover:text-echec-froid"
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            poser([...palette.sources, { genre: "officiels", reference: "" }])
          }
          className="mesure h-[26px] rounded-[2px] border border-bord px-2 text-[10px] text-texte-2 hover:text-signal-froid"
        >
          + les images officielles du jeu
        </button>
        <select
          value=""
          aria-label="Ajouter une palette en source"
          onChange={(e) => {
            if (!e.target.value) return
            poser([
              ...palette.sources,
              { genre: "palette", reference: e.target.value },
            ])
          }}
          className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
        >
          <option value="">+ une autre palette…</option>
          {palettes
            .filter((autre) => autre.identifiant !== palette.identifiant)
            .map((autre) => (
              <option key={autre.identifiant} value={autre.identifiant}>
                {autre.nom}
              </option>
            ))}
        </select>
        {/* Un paquet du tableau se désigne par son nom : un îlot **est** son
            groupe et n'a pas d'identité propre. C'est aussi pourquoi une
            palette lui survit — et le dit quand il disparaît. */}
        <input
          value={paquet}
          aria-label="Ajouter un paquet du tableau en source"
          placeholder="+ un paquet du tableau…"
          onChange={(e) => setPaquet(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !paquet.trim()) return
            poser([
              ...palette.sources,
              { genre: "images", reference: paquet.trim() },
            ])
            setPaquet("")
          }}
          className="mesure h-[26px] w-[200px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte placeholder:text-texte-3"
        />
      </div>
    </div>
  )
}

const nomDeSource = (source: SourceDePalette, palettes: PaletteNommee[]) => {
  if (source.genre === "officiels") return "la palette du jeu"
  if (source.genre === "palette")
    return palettes.find((p) => p.identifiant === source.reference)?.nom ?? source.reference
  return source.reference
}

/** Les deux curseurs, et **ils répondent à deux questions différentes** :
 *  combien de couleurs viennent d'où, et de combien elles se rapprochent. Les
 *  confondre rendrait le résultat imprévisible.
 *
 *  Mesuré au banc avant d'être écrit : croisés, ils rendent 21 résultats
 *  distincts sur 25 combinaisons. Et le banc a trouvé le seul endroit où
 *  l'attraction meurt — c'est celui qui est grisé, avec sa raison. */
function LaFusion({
  palette,
  onRegler,
}: {
  palette: PaletteNommee
  onRegler: (champs: Parameters<typeof api.reglerPalette>[1]) => void
}) {
  const [duJeu, setDuJeu] = useState(palette.du_jeu)
  const [attraction, setAttraction] = useState(Math.round(palette.attraction * 100))
  const seule = palette.sources.length < 2

  useEffect(() => {
    setDuJeu(palette.du_jeu)
    setAttraction(Math.round(palette.attraction * 100))
  }, [palette.identifiant, palette.du_jeu, palette.attraction])

  return (
    <div className="flex flex-col gap-2">
      <Libelle>2 · la fusion</Libelle>
      {seule ? (
        // **Une source seule donne toute la palette** : le curseur n'a rien à
        // partager. Grisé avec sa raison, jamais caché — on apprend qu'il
        // existe, et on sait pourquoi il ne sert pas encore.
        <Raison texte="une seule source — tout vient d'elle ; ajoute-en une seconde pour doser" />
      ) : (
        <div className="flex flex-col gap-1">
          <div className="mesure flex items-center gap-2 text-[10px] text-texte-3">
            <span className="w-[110px] text-texte-2">La proportion</span>
            <span>
              {duJeu} sur {palette.couleurs} viennent de {"« "}
              {palette.sources[0] ? "la première source" : "rien"}
              {" »"}
            </span>
          </div>
          <Curseur
            libelle="la proportion"
            valeur={duJeu}
            min={0}
            max={palette.couleurs}
            onChange={setDuJeu}
            onFini={(v) => onRegler({ du_jeu: v })}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="mesure flex items-center gap-2 text-[10px] text-texte-3">
          <span className="w-[110px] text-texte-2">L'attraction</span>
          <span>{attraction} %</span>
        </div>
        <Curseur
          libelle="l'attraction"
          valeur={attraction}
          min={0}
          max={100}
          inactif={palette.attraction_inerte}
          onChange={setAttraction}
          onFini={(v) => onRegler({ attraction: v / 100 })}
        />
        {/* **Le grisé porte sa raison**, et celle-ci est mesurée : à « tout de
            la première source », il ne reste aucune couleur à tirer, et les
            cinq valeurs rendent le même fichier. */}
        <Raison
          texte={
            palette.attraction_inerte
              ? "tout vient déjà de la première source — il ne reste aucune couleur à rapprocher"
              : "chaque couleur des autres sources est tirée vers la plus proche de la première"
          }
        />
      </div>
    </div>
  )
}

/** Des gestes **rangés un par un**, jamais fondus dans le résultat : chacun
 *  s'annule seul, chacun se voit, et le tout se rejoue si une source change. */
function LesRetouches({
  palette,
  onRegler,
}: {
  palette: PaletteNommee
  onRegler: (champs: Parameters<typeof api.reglerPalette>[1]) => void
}) {
  const defaire = (rang: number) =>
    onRegler({
      retouches: palette.retouches.filter((_, autre) => autre !== rang),
    })

  return (
    <div className="flex flex-col gap-2">
      <Libelle>3 · les retouches</Libelle>
      {palette.retouches.length === 0 ? (
        <Raison texte="aucune — la palette est exactement ce que ses sources donnent" />
      ) : (
        <ul className="flex flex-col gap-1">
          {palette.retouches.map((retouche, rang) => (
            <li
              key={`${retouche.geste}-${retouche.couleur}-${rang}`}
              className="mesure flex h-[26px] items-center gap-2 text-[10px] text-texte-2"
            >
              <span className="w-[70px] shrink-0 text-texte-3">
                {NOM_DU_GESTE[retouche.geste]}
              </span>
              <Carre couleur={retouche.couleur} />
              <span className="min-w-0 flex-1 truncate">{retouche.couleur}</span>
              {retouche.remplacement && (
                <>
                  <span className="text-texte-3">→</span>
                  <Carre couleur={retouche.remplacement} />
                </>
              )}
              <button
                type="button"
                aria-label={`Défaire ${NOM_DU_GESTE[retouche.geste]} ${retouche.couleur}`}
                onClick={() => defaire(rang)}
                className="shrink-0 px-1 text-texte-3 hover:text-echec-froid"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const NOM_DU_GESTE: Record<string, string> = {
  retirer: "retirée",
  ajouter: "ajoutée",
  remplacer: "remplacée",
}

function Carre({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      style={{ background: couleur }}
      className="inline-block h-[14px] w-[14px] shrink-0 rounded-[1px] border border-bord"
    />
  )
}

/** La palette rendue, **et chaque pastille dit d'où elle vient**.
 *
 *  C'est la seule façon de comprendre ce qu'on regarde : une palette d'ambiance
 *  est un mélange, et sans ces marques on ne saurait pas si un gris vient du jeu
 *  — donc si le changer ici serait une exception ou une redite. Une couleur
 *  retirée reste **montrée, barrée**, jamais cachée : c'est une décision qu'on a
 *  prise, on doit pouvoir l'annuler d'un clic. */
function LaPaletteRendue({
  palette,
  onRegler,
}: {
  palette: PaletteNommee
  onRegler: (champs: Parameters<typeof api.reglerPalette>[1]) => void
}) {
  const basculer = (pastille: Pastille) => {
    const retirees = palette.retouches.filter(
      (r) => r.geste === "retirer" && r.couleur === pastille.couleur,
    )
    const suivantes: RetoucheDePalette[] = retirees.length
      ? palette.retouches.filter(
          (r) => !(r.geste === "retirer" && r.couleur === pastille.couleur),
        )
      : [
          ...palette.retouches,
          { geste: "retirer", couleur: pastille.couleur, remplacement: "" },
        ]
    onRegler({ retouches: suivantes })
  }

  return (
    <div className="flex flex-col gap-2">
      <Libelle>
        la palette rendue — {palette.rendue.length} couleur
        {palette.rendue.length > 1 ? "s" : ""}
      </Libelle>
      <ul className="flex flex-wrap gap-1">
        {palette.pastilles.map((pastille) => (
          <li key={pastille.couleur}>
            <button
              type="button"
              aria-label={`${pastille.couleur} — ${VENUE[pastille.venue]}${pastille.retiree ? ", retirée" : ""}`}
              title={`${VENUE[pastille.venue]} — ${pastille.retiree ? "retirée : un clic la remet" : "un clic la retire"}`}
              onClick={() => basculer(pastille)}
              style={{ background: pastille.couleur }}
              className={[
                "relative h-[30px] w-[30px] rounded-[2px] border transition-opacity duration-[80ms]",
                pastille.retiree
                  ? "border-echec-froid opacity-40"
                  : "border-bord hover:border-bord-fort",
              ].join(" ")}
            >
              {/* La lettre de provenance, posée sur la pastille — J, A ou M.
                  Un mot n'aurait pas tenu sur 30 px, et une couleur de bordure
                  aurait été un troisième vocabulaire de couleur à apprendre. */}
              <span className="mesure absolute bottom-px right-[3px] text-[8px] leading-none text-fond-1 mix-blend-difference">
                {LETTRE[pastille.venue]}
              </span>
              {/* **Barrée, et visiblement** : le trait traverse la pastille. */}
              {pastille.retiree && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 rotate-[-30deg] bg-echec-froid"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="mesure text-[9.5px] leading-4 text-texte-3">
        J venue de la première source · A venue des suivantes · M posée à la main
        · une pastille barrée est retirée, montrée et non cachée
      </p>
    </div>
  )
}

const VENUE: Record<string, string> = {
  jeu: "venue de la première source",
  ambiance: "venue des autres sources",
  main: "posée à la main",
}
const LETTRE: Record<string, string> = { jeu: "J", ambiance: "A", main: "M" }

/** **La palette posée sur de vraies images du jeu**, côte à côte.
 *
 *  C'est ce qui rend le réglage des deux curseurs jugeable : un mélange se voit
 *  sur un sprite, pas sur une bande de pastilles. Deux rangées des mêmes
 *  objets — avec les couleurs du jeu, avec celles de la palette —, parce qu'une
 *  seule ne dirait pas ce qui a changé. */
function LApercu({
  palette,
  onErreur,
}: {
  palette: PaletteNommee
  onErreur: (raison: string) => void
}) {
  const [apercu, setApercu] = useState<ApercuDePalette | null>(null)

  useEffect(() => {
    let vivant = true
    void api
      .apercuDePalette(palette.identifiant)
      .then((recu) => {
        if (vivant) setApercu(recu ?? null)
      })
      .catch((erreur) => onErreur(String(erreur)))
    return () => {
      vivant = false
    }
    // L'empreinte, et non la palette entière : c'est elle qui dit que les
    // couleurs ont changé, et se redemander à chaque rendu aurait refait le
    // calcul pour un simple survol.
  }, [palette.identifiant, palette.empreinte])

  if (!apercu?.images?.length) return null

  return (
    <div className="flex flex-col gap-2">
      <Libelle>l'aperçu — la palette posée sur de vraies images</Libelle>
      <div className="flex flex-wrap gap-4">
        {apercu.images.map((image) => (
          <figure key={image.asset} className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-2">
              <img
                src={image.du_jeu}
                alt={`${image.nom} avec les couleurs du jeu`}
                className="h-[96px] w-[96px] rounded-[2px] border border-bord object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <img
                src={image.de_la_palette}
                alt={`${image.nom} avec ${palette.nom}`}
                className="h-[96px] w-[96px] rounded-[2px] border border-bord-fort object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <figcaption className="mesure max-w-[200px] truncate text-[9.5px] text-texte-3">
              {image.nom} — du jeu, puis {palette.nom}
            </figcaption>
          </figure>
        ))}
      </div>
      {/* **Combien de couleurs ne servent à rien**, dit en clair. Le produit
          constate — il ne conseille pas de les retirer. */}
      <p className="mesure text-[9.5px] text-texte-3">
        {apercu.employees.length} des {apercu.couleurs.length} employées par ces
        images — {apercu.couleurs.length - apercu.employees.length} ne servent à
        aucune
      </p>
    </div>
  )
}

// ── Le panneau d'une ambiance ───────────────────────────────────────────────

/** Une ambiance porte **trois choses, et trois seulement** : une palette, des
 *  images de référence, trois cases de texte.
 *
 *  Ce qui lui est fermé l'est pour une raison écrite, et l'écran la donne plutôt
 *  que de laisser chercher : *vue* et *technique* décrivent la mécanique du jeu,
 *  et une ambiance qui les remplacerait fabriquerait des images qui ne rentrent
 *  pas dans le jeu — erreur qui ne se verrait qu'après avoir payé. *Époque* et
 *  *rendu* restent au jeu parce qu'un coin plus sombre reste du même siècle et
 *  du même pixel art. */
function PanneauAmbiance({
  ambiance,
  palettes,
  onRegler,
  onSupprimer,
}: {
  ambiance: AmbianceDuJeu
  palettes: PaletteNommee[]
  onRegler: (champs: Parameters<typeof api.reglerAmbiance>[1]) => void
  onSupprimer: () => void
}) {
  const [onglet, setOnglet] = useState<Onglet>("sa palette")
  const palette = palettes.find((p) => p.identifiant === ambiance.palette)

  return (
    <section className="flex flex-col gap-4">
      <EnTete nom={ambiance.nom} onSupprimer={onSupprimer} />

      <Segments<Onglet>
        valeurs={["sa palette", "ses références", "ses trois cases", "qui s'en sert"]}
        valeur={onglet}
        onChange={setOnglet}
        libelles={{
          "sa palette": "1 · sa palette",
          "ses références": `2 · ses images de référence ${ambiance.references.length}`,
          "ses trois cases": "3 · ses trois cases",
          "qui s'en sert": `qui s'en sert ${ambiance.emplois.length}`,
        }}
      />

      {onglet === "sa palette" && (
        <div className="flex flex-col gap-2">
          <select
            value={ambiance.palette}
            aria-label="La palette de cette ambiance"
            onChange={(e) => onRegler({ palette: e.target.value })}
            className="mesure h-[26px] w-[240px] rounded-[2px] border border-bord bg-fond-1 px-1 text-[11px] text-texte-2"
          >
            <option value="">aucune — les couleurs du jeu</option>
            {palettes.map((autre) => (
              <option key={autre.identifiant} value={autre.identifiant}>
                {autre.nom} — {autre.rendue.length} couleurs
              </option>
            ))}
          </select>
          <Raison texte="la palette agit toujours au retour, sur la machine, sans rien payer et rétroactivement" />
          {palette && (
            <ul className="flex flex-wrap gap-1 pt-1">
              {palette.rendue.map((couleur) => (
                <li key={couleur}>
                  <Carre couleur={couleur} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onglet === "ses références" && (
        <div className="flex flex-col gap-2">
          <Raison texte="elles partent en image avec les générations qui utilisent l'ambiance, et prennent les places que le projet aurait remplies" />
          {ambiance.references.length === 0 ? (
            <p className="mesure text-[10px] leading-4 text-texte-3">
              Aucune encore. Une carte du tableau d'inspiration se désigne ici —
              elle reste où elle est, aucune copie n'est faite.
            </p>
          ) : (
            <ul className="flex flex-wrap items-center gap-2">
              {ambiance.references.map((reference) => (
                <li
                  key={reference}
                  className="mesure inline-flex h-[26px] items-center gap-1 rounded-[2px] border border-bord bg-fond-1 px-2 text-[10px] text-texte-2"
                >
                  <span className="max-w-[180px] truncate">{reference}</span>
                  <button
                    type="button"
                    aria-label={`Retirer la référence ${reference}`}
                    onClick={() =>
                      onRegler({
                        references: ambiance.references.filter(
                          (autre) => autre !== reference,
                        ),
                      })
                    }
                    className="px-1 text-texte-3 hover:text-echec-froid"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onglet === "ses trois cases" && (
        <div className="flex flex-col gap-3">
          {(
            [
              ["monde", "Le monde", ambiance.monde],
              ["eclairage", "L'éclairage", ambiance.eclairage],
              ["trait", "Le trait", ambiance.trait],
            ] as const
          ).map(([cle, libelle, texte]) => (
            <CaseDeTexte
              key={cle}
              libelle={libelle}
              texte={texte}
              onPoser={(valeur) => onRegler({ [cle]: valeur })}
            />
          ))}
          {/* **Ce qui lui est fermé, dit ici** plutôt que laissé à chercher :
              c'est le grisé qui porte sa raison, appliqué à une absence. */}
          <Raison texte="la vue et la technique ne s'ouvrent pas à une ambiance — elles portent la mécanique du jeu, et des images qui ne rentrent pas ne se verraient qu'après avoir payé" />
          <Raison texte="l'époque et le rendu restent au jeu — un coin plus sombre reste du même siècle et du même pixel art" />
        </div>
      )}

      {onglet === "qui s'en sert" && (
        <div className="flex flex-col gap-2">
          {ambiance.emplois.length === 0 ? (
            <p className="mesure text-[10px] leading-4 text-texte-3">
              Personne encore. Une chose du jeu la désigne sur sa fiche — jamais
              par la collection où elle est rangée : une collection est un
              dossier, et un rangement ne change pas un style.
            </p>
          ) : (
            <ul className="flex flex-col">
              {ambiance.emplois.map((emploi) => (
                <li
                  key={emploi.identifiant}
                  className="mesure flex h-[26px] items-center gap-2 border-b border-bord text-[11px] text-texte-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate">{emploi.nom}</span>
                  <span className="shrink-0 text-[10px] text-texte-3">
                    lui prend {NOM_DE_CE_QU_ON_PREND[emploi.prend] ?? emploi.prend}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/** Une case de texte d'ambiance. Elle **remplace celle du jeu** pour les choses
 *  qui utilisent l'ambiance ; laissée vide, elle garde ce que dit le jeu. */
function CaseDeTexte({
  libelle,
  texte,
  onPoser,
}: {
  libelle: string
  texte: string
  onPoser: (valeur: string) => void
}) {
  const [brouillon, setBrouillon] = useState(texte)

  useEffect(() => setBrouillon(texte), [texte])

  return (
    <div className="flex flex-col gap-1">
      <Libelle>{libelle}</Libelle>
      <textarea
        value={brouillon}
        rows={2}
        aria-label={libelle}
        placeholder="vide — ce que dit le jeu s'applique"
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={() => {
          if (brouillon !== texte) onPoser(brouillon)
        }}
        className="mesure w-full max-w-[560px] resize-y rounded-[2px] border border-bord bg-fond-1 p-2 text-[11px] leading-5 text-texte placeholder:text-texte-3"
      />
    </div>
  )
}
