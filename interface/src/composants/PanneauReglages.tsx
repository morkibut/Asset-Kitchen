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
import { NOM_FAMILLE, type CompteReferences, type Modele, type Univers } from "../api"
import { EnTetePanneau, Libelle, Raison, Segments } from "./chassis"

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
    // `min-h-0` : sans lui, une case de grille prend la hauteur de son contenu
    // et le panneau pousse la barre d'état hors de l'écran au lieu de défiler.
    <aside className="flex min-h-0 w-[300px] shrink-0 flex-col border-r border-bord bg-fond-1">
      <EnTetePanneau>Réglages</EnTetePanneau>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        {/* ── Le modèle ─────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Libelle>Modèle</Libelle>
            <span className="mesure text-[9.5px] text-texte-3">
              {modeles.length} au catalogue
            </span>
          </div>

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
        </section>

        {/* ── Le cadrage ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-1.5">
          <Libelle>Proportions</Libelle>
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
          <Libelle>Variations</Libelle>
          <Segments
            valeurs={[1, 2, 4] as const}
            valeur={variations}
            onChange={onVariations}
          />
          <Raison
            texte={
              variations > 1
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
              <Libelle>Sujet</Libelle>
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
        <section className="mt-auto rounded-[2px] border border-bord bg-fond-2 p-2">
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
          </dl>
        </section>
      </div>
    </aside>
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
