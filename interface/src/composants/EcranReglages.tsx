// L'écran Réglages — **clé, garde-fous, dossiers. Un seul endroit** (US-96).
//
// En T1 il n'existait que pour la clé, et son en-tête annonçait déjà la suite :
// « les garde-fous de l'agent et les dossiers le rejoindront en T7 ». Les voici,
// et l'écran garde sa forme — un panneau posé sur l'atelier, pas un quatrième
// écran plein. Trois blocs, trois questions, et rien qui ait à être cherché
// ailleurs : c'est exactement ce que la user story demande.
//
// **Ce qui se règle ici prend effet à l'appel suivant, sans redémarrage**
// (US-91). Rien à faire pour ça côté écran : le serveur relit son fichier à
// chaque question posée, comme il relit la clé. L'écran pose, il ne prévient
// personne.
//
// La clé, elle, se dépose une fois et n'est plus jamais redemandée. Elle n'est
// jamais relue par l'interface : le serveur n'en rend que les six derniers
// caractères.

import { useState } from "react"
import {
  api,
  dollars,
  type EtatAgent,
  type EtatCle,
  type GardeFous,
} from "../api"
import { Bouton, Curseur, Libelle, Raison } from "./chassis"

export function EcranReglages({
  etat,
  agent,
  onDeposee,
  onAgent,
  onFermer,
}: {
  etat: EtatCle
  /** Le cadre et la consommation, tels que le serveur les sert. **Jamais
   *  recalculés ici** : le refus opposé à l'agent et le chiffre lu par l'auteur
   *  doivent être le même calcul. */
  agent: EtatAgent
  onDeposee: () => void
  onAgent: (agent: EtatAgent) => void
  onFermer: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-fond-0/70 py-[8vh]"
      onClick={onFermer}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] rounded-[3px] border border-bord bg-fond-1 p-6"
      >
        <h2 className="font-serif text-[24px] leading-tight text-texte">Réglages</h2>

        <BlocCle etat={etat} onDeposee={onDeposee} onFermer={onFermer} />
        <BlocAgent agent={agent} onAgent={onAgent} />
        <BlocDossiers agent={agent} onAgent={onAgent} />

        <div className="mt-6 flex justify-end">
          <Bouton onClick={onFermer} enfants="Fermer" />
        </div>
      </section>
    </div>
  )
}

/** Le titre d'un bloc — la forme de l'en-tête de panneau, réemployée.
 *
 *  Aucune typographie neuve sur cet écran : les majuscules à `.11em` disent
 *  « section » partout ailleurs dans le produit, et un troisième niveau de
 *  titre inventé ici serait un troisième niveau à entretenir. */
function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mesure mt-7 mb-3 border-b border-bord pb-1.5 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
      {children}
    </h3>
  )
}

// ── La clé ──────────────────────────────────────────────────────────────────

function BlocCle({
  etat,
  onDeposee,
  onFermer,
}: {
  etat: EtatCle
  onDeposee: () => void
  onFermer: () => void
}) {
  const [cle, setCle] = useState("")
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const deposer = async () => {
    setEnCours(true)
    setRefus(null)
    try {
      await api.deposerCle(cle.trim())
      setCle("")
      onDeposee()
      onFermer()
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "dépôt refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <Titre>La clé</Titre>
      <p className="text-[12.5px] leading-relaxed text-texte-2">
        La clé OpenRouter se dépose une fois. Elle est écrite dans{" "}
        <span className="mesure text-[11px] text-texte">.env</span>, qui n'est
        jamais versionné, et l'atelier ne la réaffiche plus jamais.
      </p>

      {etat.presente ? (
        <div className="mt-3 flex items-center gap-3 rounded-[2px] border border-bord bg-fond-2 px-3 py-2">
          <span className="mesure text-[11px] text-ok">clé présente</span>
          <span className="mesure text-[11px] text-texte-3">
            …{etat.apercu} · {etat.origine}
          </span>
        </div>
      ) : (
        <Raison texte={etat.raison} />
      )}

      <div className="mt-3 flex items-start gap-2">
        <input
          type="password"
          value={cle}
          onChange={(e) => setCle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && cle.trim().length >= 8 && deposer()}
          placeholder="sk-or-…"
          className="mesure h-8 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11px] text-texte placeholder:text-texte-3"
        />
        <Bouton
          principal
          inactif={cle.trim().length < 8 || enCours}
          onClick={deposer}
          enfants={etat.presente ? "Remplacer" : "Déposer"}
        />
      </div>
      <Raison texte={refus} />
    </>
  )
}

// ── L'agent ─────────────────────────────────────────────────────────────────

function BlocAgent({
  agent,
  onAgent,
}: {
  agent: EtatAgent
  onAgent: (agent: EtatAgent) => void
}) {
  const [refus, setRefus] = useState<string | null>(null)
  const cadre = agent.garde_fous
  const compte = agent.consommation
  // Le curseur bouge sous le doigt ; seul le relâchement écrit. Même règle que
  // les curseurs de la recette : un réglage qui coûte un aller-retour ne part
  // pas à chaque pixel parcouru.
  const [plafond, setPlafond] = useState(cadre.plafond)

  const poser = async (champs: Partial<GardeFous>) => {
    setRefus(null)
    try {
      onAgent(await api.reglerAgent(champs))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "réglage refusé")
    }
  }

  return (
    <>
      <Titre>L'agent</Titre>
      <p className="text-[12.5px] leading-relaxed text-texte-2">
        Un agent qui code le jeu appelle l'atelier par le serveur MCP, sur{" "}
        <span className="mesure text-[11px] text-texte">/mcp</span>. Il ne
        demande jamais d'autorisation — ces deux garde-fous sont ce qui tient sa
        place, et ils prennent effet à son appel suivant.
      </p>

      {/* Le compteur, discret et permanent (US-90). Il est ici, à côté du
          réglage qu'il fait relever : lu ailleurs, il faudrait revenir. */}
      <dl className="mesure mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[2px] border border-bord bg-fond-2 px-3 py-2 text-[10px]">
        <dt className="text-texte-3">cette séance</dt>
        <dd className="text-texte-2">
          {compte.generations} image{compte.generations > 1 ? "s" : ""}
          {compte.reste !== null && ` · ${compte.reste} avant le plafond`}
        </dd>
        <dt className="text-texte-3">dépensé</dt>
        <dd className="text-texte-2">{dollars(compte.depense_usd)}</dd>
      </dl>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Interrupteur
            actif={cadre.plafond_actif}
            nom="Plafond de la séance"
            onBasculer={() => void poser({ plafond_actif: !cadre.plafond_actif })}
          />
          <Libelle aide="agent.plafond" eteint={!cadre.plafond_actif}>
            Plafond de la séance
          </Libelle>
        </div>
        <Curseur
          valeur={plafond}
          min={1}
          max={200}
          unite=" images"
          inactif={!cadre.plafond_actif}
          onChange={setPlafond}
          onFini={(v) => void poser({ plafond: v })}
        />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Interrupteur
            actif={cadre.modele_actif}
            nom="Modèle d'exploration"
            onBasculer={() => void poser({ modele_actif: !cadre.modele_actif })}
          />
          <Libelle aide="agent.modele" eteint={!cadre.modele_actif}>
            Modèle d'exploration
          </Libelle>
        </div>
        <p className="mesure text-[10px] leading-4 text-texte-3">
          {cadre.modele}
          {Object.entries(cadre.options).map(([nom, valeur]) => (
            <span key={nom}> · {nom} {valeur}</span>
          ))}
        </p>
      </div>

      <Raison texte={refus} />
    </>
  )
}

// ── Les dossiers ────────────────────────────────────────────────────────────

function BlocDossiers({
  agent,
  onAgent,
}: {
  agent: EtatAgent
  onAgent: (agent: EtatAgent) => void
}) {
  const [dossier, setDossier] = useState(agent.garde_fous.dossier_jeu)
  const [refus, setRefus] = useState<string | null>(null)
  const change = dossier.trim() !== agent.garde_fous.dossier_jeu

  const poser = async () => {
    setRefus(null)
    try {
      onAgent(await api.reglerAgent({ dossier_jeu: dossier.trim() }))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "réglage refusé")
    }
  }

  return (
    <>
      <Titre>Les dossiers</Titre>
      <div className="flex flex-col gap-1.5">
        <Libelle aide="agent.dossier">Dossier du jeu</Libelle>
        <div className="flex items-start gap-2">
          <input
            value={dossier}
            onChange={(e) => setDossier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && change && poser()}
            placeholder="C:\\Jeux\\mon-jeu\\assets"
            className="mesure h-8 min-w-0 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11px] text-texte placeholder:text-texte-3"
          />
          <Bouton inactif={!change} onClick={poser} enfants="Poser" />
        </div>
      </div>
      <Raison texte={refus} />
    </>
  )
}

/** Le carré ●/○ des champs de bible, réemployé tel quel.
 *
 *  « Un second gabarit serait un second endroit où l'oublier » : le produit a
 *  déjà un interrupteur, celui qui allume un champ de l'univers. Le même geste
 *  se pose ici sur un garde-fou, sans inventer ni glyphe ni couleur. */
function Interrupteur({
  actif,
  nom,
  onBasculer,
}: {
  actif: boolean
  nom: string
  onBasculer: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={`${nom} — ${actif ? "actif" : "inactif"}`}
      onClick={onBasculer}
      className={[
        "mesure h-[26px] w-[26px] shrink-0 rounded-[2px] border text-[10px] transition-colors duration-[80ms]",
        actif
          ? "border-signal bg-signal/13 text-signal"
          : "border-bord bg-fond-2 text-texte-3 hover:bg-fond-3",
      ].join(" ")}
    >
      {actif ? "●" : "○"}
    </button>
  )
}
