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
import type { Modele } from "../api"
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
}) {
  const [filtre, setFiltre] = useState("")

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
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-bord bg-fond-1">
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
            <dd className="text-right text-texte-2">
              0 / {choisi?.references_max ?? 0}
            </dd>
            <dt className="text-texte-3">univers</dt>
            <dd className="text-right text-texte-3">aucun — T4</dd>
            <dt className="text-texte-3">grille imposée</dt>
            <dd className="text-right text-texte-3">aucune — T2</dd>
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
