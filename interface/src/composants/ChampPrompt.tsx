// Le champ de prompt — 56 px au minimum, 13,5 px, le seul endroit du produit
// où le texte est plus gros que le châssis.
//
// « L'atelier s'ouvre sur un champ de prompt actif, sans écran à traverser »
// (`docs/PLAN.md`, T1). Le prompt négatif est replié : on l'écrit rarement, on
// le lit encore moins.
//
// **Et depuis R2, ce qui partira se voit** (US-158). Un dépliant sous le champ
// montre le texte tel qu'il part, dans l'ordre où il part : la bible active, le
// sujet, puis les consignes de planche quand un lot est armé. Il est replié par
// défaut — le geste quotidien est d'écrire, pas de relire —, et il ne se compose
// pas ici : le serveur le rend, parce que c'est le même chemin que la
// soumission emprunte.

import { useEffect, useRef, type Ref } from "react"
import type { ApercuPrompt, PartiePrompt } from "../api"
import { Bouton, ouvrirPli, Raison, Revers, usePli } from "./chassis"
import { POINTILLE, useInfobulle } from "./Infobulle"

/** D'où vient chaque bloc, en un mot. **Le libellé n'est pas dans le texte** :
 *  ce qui part est le texte seul, et une étiquette collée dedans serait
 *  exactement le « montrer autre chose que ce qui part » que la tranche
 *  refuse. */
const ORIGINE: Record<PartiePrompt["origine"], string> = {
  bible: "bible",
  sujet: "sujet",
  planche: "planche",
  repris: "ton texte",
}

export function ChampPrompt({
  prompt,
  onPrompt,
  promptNegatif,
  onPromptNegatif,
  apercu,
  apercuRefus,
  repris,
  onReprendre,
  onRendre,
  refus,
  ouAller,
  onAller,
  revers,
  provenance,
  onGenerer,
  variations,
}: {
  prompt: string
  onPrompt: (v: string) => void
  promptNegatif: string
  onPromptNegatif: (v: string) => void
  /** Ce qui partira, composé par le serveur. `null` tant qu'il n'a pas
   *  répondu — le dépliant dit alors qu'il ne sait pas encore, jamais un texte
   *  deviné. */
  apercu: ApercuPrompt | null
  /** Pourquoi il n'y a pas d'aperçu — un lot dont une case a disparu, par
   *  exemple. La raison est celle du serveur, et c'est la même qui refuserait
   *  la soumission. */
  apercuRefus: string | null
  /** Le texte est repris à la main : le champ **est** ce qui partira. */
  repris: boolean
  /** Basculer en édition libre — le champ reçoit le texte complet. */
  onReprendre: () => void
  /** Rendre la main à l'atelier : le champ redevient le sujet seul. */
  onRendre: () => void
  refus: string | null
  ouAller?: string
  onAller?: () => void
  /** Le repli hors ligne, quand il y a un catalogue à servir. */
  revers?: { texte: string; enCours: boolean; onReessayer: () => void } | null
  /** **D'où vient ce qui est écrit là, quand ce n'est pas l'auteur** (E2).
   *
   *  C'est la règle jumelle de celle que le produit tient depuis T1 : *ce qui
   *  est indisponible est grisé avec sa raison* avait besoin de son revers —
   *  **ce qui est devinable est prérempli avec sa provenance, et se défait d'un
   *  clic**. Un champ prérempli n'est pas un champ décidé.
   *
   *  Et se défaire ne change **rien** au réglage durable : c'est le texte de
   *  cet appel-ci qu'on efface, pas la consigne de la pose ni le signalement de
   *  la chose, qui restent où ils sont écrits. */
  provenance?: { texte: string; onDefaire: () => void } | null
  onGenerer: () => void
  variations: number
}) {
  // **Les deux replis vivent dans le registre du châssis, pas ici.** La
  // galerie était le fond du produit et ce champ ne se démontait jamais ; la
  // V2.1 en fait un onglet, et un état local se serait perdu à chaque
  // aller-retour vers l'Univers ou le Codex — refermant sous la main le
  // dépliant qu'on venait d'ouvrir pour comparer.
  const [negatifOuvert, basculerNegatif] = usePli("prompt.negatif")
  const [apercuOuvert, basculerApercu] = usePli("prompt.ce-qui-partira")
  const champ = useRef<HTMLTextAreaElement>(null)
  // **Le titre du dépliant n'épingle pas**, comme un en-tête de bloc : son clic
  // est déjà pris — il déplie. Les gestes vont donc sur le bouton, un élément
  // focalisable imbriqué dans un bouton étant du HTML invalide et un piège au
  // clavier.
  const infobulle = useInfobulle("atelier.apercu", { epinglable: false })

  useEffect(() => champ.current?.focus(), [])

  // **Reprendre ouvre le dépliant, et ne le referme jamais tout seul.** On ne
  // reprend pas un texte qu'on ne voit pas ; et le refermer au retour à
  // l'atelier ferait disparaître sous la main ce qu'on venait de comparer.
  useEffect(() => {
    if (repris) ouvrirPli("prompt.ce-qui-partira")
  }, [repris])

  const toucheGenerer = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !refus) {
      e.preventDefault()
      onGenerer()
    }
  }

  // Combien de blocs partiront en plus du sujet : c'est ce que le pied annonce
  // quand le dépliant est fermé. Repris, il n'y a plus de blocs — il y a un
  // texte, et le dire autrement serait mentir sur ce qui part.
  const enPlus = (apercu?.parties ?? []).filter((p) => p.origine !== "sujet").length

  return (
    <div className="flex flex-col gap-2 border-b border-bord bg-fond-1 p-4">
      <textarea
        ref={champ}
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={toucheGenerer}
        rows={repris ? 6 : 2}
        placeholder={
          repris
            ? "Le texte part exactement tel qu'il est écrit ici."
            : "Décris ce que tu veux fabriquer."
        }
        className={[
          "resize-y rounded-[3px] border px-3 py-2 placeholder:text-texte-3",
          repris
            ? "mesure min-h-[120px] leading-relaxed border-signal bg-fond-2 text-[11.5px] text-texte"
            : // **56 px, la première des deux exceptions nommées à la liste
              // fermée des hauteurs** (`docs/DESIGN.md` § Spacing) : ce n'est
              // pas une bande, c'est une zone de saisie sur plusieurs lignes.
              //
              // L'interligne est écrit ici et non hérité, parce que c'est lui
              // qui fait la mesure : deux lignes à 19 px, plus 8 px de garde en
              // haut et en bas, plus le trait, font exactement 56. Avec
              // `leading-relaxed` (1,625 → 22 px) les deux mêmes lignes en
              // faisaient 62, et le `min-h` n'y pouvait rien — il est un
              // minimum, pas une hauteur.
              "min-h-[56px] leading-[19px] border-bord-fort bg-fond-2 text-[13.5px] text-texte",
        ].join(" ")}
      />

      {/* La ligne de provenance, **sous le champ** : elle parle de ce qui est
          écrit dedans, pas de ce qui va partir. */}
      {provenance && (
        <p className="mesure flex items-center gap-1.5 text-[10px] leading-4 text-texte-3">
          <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
          <span>{provenance.texte}</span>
          <button
            type="button"
            onClick={provenance.onDefaire}
            className="text-signal hover:text-signal-clair"
          >
            défaire ›
          </button>
        </p>
      )}

      {negatifOuvert && (
        <textarea
          value={promptNegatif}
          onChange={(e) => onPromptNegatif(e.target.value)}
          onKeyDown={toucheGenerer}
          rows={1}
          placeholder="Ce que tu ne veux pas."
          className="min-h-[34px] resize-y rounded-[3px] border border-bord bg-fond-2 px-3 py-2 text-[12.5px] leading-[16px] text-texte-2 placeholder:text-texte-3"
        />
      )}

      {/* ── Ce qui partira ──────────────────────────────────────────────────
          Le dépliant. Fermé, il tient sur une ligne de pied et dit combien de
          blocs s'ajoutent au sujet ; ouvert, il montre le texte entier, dans
          l'ordre d'envoi, sans rien de masqué. Il ne coûte rien : le serveur le
          compose sans sortir de la machine. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={basculerApercu}
            aria-expanded={apercuOuvert}
            {...infobulle.declencheurs}
            className="mesure flex h-6 items-center gap-1 text-[10px] text-texte-3 hover:text-texte-2"
          >
            <span>{apercuOuvert ? "−" : "+"}</span>
            <span
              ref={infobulle.ancre as Ref<HTMLSpanElement>}
              className={`w-fit ${infobulle.presente ? POINTILLE : ""}`}
            >
              ce qui partira
            </span>
            {repris ? (
              <span className="text-signal">· repris</span>
            ) : enPlus > 0 ? (
              <span>· +{enPlus}</span>
            ) : null}
          </button>

          {apercuOuvert &&
            (repris ? (
              <button
                type="button"
                onClick={onRendre}
                className="mesure ml-auto h-6 text-[10px] text-signal hover:text-signal-clair"
              >
                Rendre la main à l'atelier ›
              </button>
            ) : (
              <button
                type="button"
                onClick={onReprendre}
                disabled={apercu === null}
                className="mesure ml-auto h-6 text-[10px] text-signal hover:text-signal-clair disabled:text-texte-3"
              >
                Reprendre le texte ›
              </button>
            ))}
        </div>
        {/* Hors du bouton, exprès : la bulle porte le lien « Le guide › », et
            un bouton dans un bouton est invalide. */}
        {infobulle.bulle}

        {apercuOuvert && (
          <div
            /* Nommé, parce qu'il est lu autant que regardé : un lecteur d'écran
               doit pouvoir aller à « ce qui partira » comme on y va de l'œil. */
            role="region"
            aria-label="Ce qui partira"
            className="defile max-h-[220px] overflow-y-auto rounded-[2px] border border-bord bg-fond-2 p-2"
          >
            {apercuRefus ? (
              <Raison texte={apercuRefus} />
            ) : apercu === null ? (
              <p className="mesure text-[10px] text-texte-3">…</p>
            ) : apercu.parties.length === 0 ? (
              /* Ni bible, ni sujet, ni planche. Ce n'est pas un trou : c'est un
                 atelier qui vient de s'ouvrir sur un champ vide, dans un projet
                 dont la bible ne dit rien. */
              <p className="mesure text-[10px] text-texte-3">
                rien encore — écris un sujet
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {apercu.parties.map((partie, rang) => (
                  <div key={rang} className="flex flex-col gap-[2px]">
                    <span className="mesure text-[9.5px] uppercase tracking-[.11em] text-texte-3">
                      {ORIGINE[partie.origine]}
                    </span>
                    <p className="mesure whitespace-pre-wrap text-[10.5px] leading-[1.45] text-texte-2">
                      {partie.texte}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={basculerNegatif}
          className="mesure h-[34px] text-[10px] text-texte-3 hover:text-texte-2"
        >
          {negatifOuvert ? "− " : "+ "}prompt négatif
          {promptNegatif && !negatifOuvert ? " ·" : ""}
        </button>

        <div className="ml-auto flex flex-col items-end">
          <Bouton principal inactif={refus !== null} onClick={onGenerer} enfants={
            variations > 1 ? `Générer ${variations} variations` : "Générer"
          } />
          {/* La fente : une ligne mono 10 px alignée à droite, trois
              locataires, **jamais deux à la fois** — `docs/DESIGN.md`
              `docs/design-motifs.md`, *Le revers*. Le refus l'emporte : quand le catalogue
              n'a jamais été reçu, il n'y a ni date à porter ni nuance à faire,
              et c'est le grisé ordinaire qui reprend la main. */}
          {refus ? (
            <Raison texte={refus} ouAller={ouAller} onAller={onAller} />
          ) : revers ? (
            <Revers
              texte={revers.texte}
              geste="Réessayer"
              onGeste={revers.onReessayer}
              enCours={revers.enCours}
            />
          ) : (
            <p className="mesure mt-1 text-[10px] text-texte-3">Ctrl + Entrée</p>
          )}
        </div>
      </div>
    </div>
  )
}
