// L'Atelier — l'écran du travail quotidien.
//
// En T1 il tient deux colonnes : les réglages, puis le prompt et la grille.
// L'arbre des projets et la fiche asset arrivent avec la bibliothèque (T3) ;
// les afficher vides maintenant serait montrer du cadrage au lieu de servir le
// geste — c'est exactement ce qui a fait écarter `docs/maquette-atelier.html`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  dollars,
  heure,
  Refus,
  type Etat,
  type Generation,
  type Modele,
} from "./api"
import { Bouton, Point } from "./composants/chassis"
import { ChampPrompt } from "./composants/ChampPrompt"
import { EcranCle } from "./composants/EcranCle"
import { PanneauReglages } from "./composants/PanneauReglages"
import { Tuile } from "./composants/Tuile"

const BATTEMENT_MS = 1000

export function App() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [catalogueRepli, setCatalogueRepli] = useState<{
    repli: boolean
    raison: string | null
    recu_le: number
  }>({ repli: false, raison: null, recu_le: 0 })
  const [defaut, setDefaut] = useState<{
    modele: string | null
    options: Record<string, string>
  }>({ modele: null, options: {} })
  const [generations, setGenerations] = useState<Generation[]>([])
  const [panne, setPanne] = useState<string | null>(null)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)

  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [promptNegatif, setPromptNegatif] = useState("")
  const [proportions, setProportions] = useState("1:1")
  const [variations, setVariations] = useState(1)
  const [options, setOptions] = useState<Record<string, string>>({})

  // ── Ce que l'atelier sait de lui-même ─────────────────────────────────────

  const relire = useCallback(async () => {
    try {
      const [nouvelEtat, catalogue] = await Promise.all([
        api.etat(),
        api.modeles(proportions),
      ])
      setEtat(nouvelEtat)
      setModeles(catalogue.modeles)
      setDefaut(catalogue.defaut)
      setCatalogueRepli({
        repli: catalogue.repli,
        raison: catalogue.raison,
        recu_le: catalogue.recu_le,
      })
      setPanne(null)
    } catch (erreur) {
      setPanne(erreur instanceof Refus ? erreur.message : "l'atelier ne répond pas")
    }
  }, [proportions])

  useEffect(() => {
    void relire()
  }, [relire])

  // Le battement : on redemande les générations tant qu'une tourne. Le flux
  // d'événements (SSE) le remplacera au jalon suivant — ici, un sondage d'une
  // seconde suffit et ne coûte rien : tout est local.
  const tourne = useMemo(
    () => generations.some((g) => g.statut === "en_cours" || g.statut === "en_attente"),
    [generations],
  )
  const battement = useRef<number | null>(null)

  const relireGenerations = useCallback(async () => {
    try {
      const { generations: liste } = await api.generations(24)
      setGenerations(liste)
    } catch {
      /* le battement ne fait jamais de bruit : la panne se voit ailleurs */
    }
  }, [])

  useEffect(() => {
    void relireGenerations()
  }, [relireGenerations])

  useEffect(() => {
    if (!tourne) return
    battement.current = window.setInterval(() => {
      void relireGenerations()
      void api.etat().then(setEtat).catch(() => undefined)
    }, BATTEMENT_MS)
    return () => {
      if (battement.current) window.clearInterval(battement.current)
    }
  }, [tourne, relireGenerations])

  // ── Le modèle choisi reste choisi ─────────────────────────────────────────
  // Même devenu invalide : c'est générer qui devient inactif, avec sa raison.
  // Aucune substitution silencieuse (US-9).

  const modele = useMemo(
    () => modeles.find((m) => m.identifiant === modeleChoisi) ?? null,
    [modeles, modeleChoisi],
  )

  // Le premier modèle d'une séance vient du serveur, pas d'un choix arbitraire
  // du navigateur : c'est le modèle que le banc a retenu, avec ses réglages.
  useEffect(() => {
    if (modeleChoisi || !defaut.modele) return
    setModeleChoisi(defaut.modele)
    setOptions((precedentes) => ({ ...defaut.options, ...precedentes }))
  }, [defaut, modeleChoisi])

  // ── La raison qui rend générer inactif ────────────────────────────────────

  const refus = useMemo(() => {
    if (panne) return panne
    if (!etat?.cle.presente) return etat?.cle.raison ?? "aucune clé OpenRouter"
    if (modeles.length === 0) return "aucun modèle — le catalogue n'a jamais été reçu"
    if (!modele) return "aucun modèle choisi"
    if (modele.refus) return `${modele.nom} ${modele.refus}`
    if (!prompt.trim()) return "aucun prompt"
    return null
  }, [panne, etat, modeles, modele, prompt])

  // ── Générer ───────────────────────────────────────────────────────────────

  const generer = async () => {
    if (refus || !modele) return
    // L'identifiant est fabriqué ici : c'est lui qui empêche une double
    // soumission de facturer deux fois, même si le clic part deux fois.
    const identifiant = crypto.randomUUID().replace(/-/g, "")
    const retenues = Object.fromEntries(
      Object.entries(options).filter(([nom]) => nom in modele.options),
    )
    try {
      const generation = await api.generer({
        modele: modele.identifiant,
        prompt: prompt.trim(),
        prompt_negatif: promptNegatif.trim(),
        proportions,
        variations,
        options: retenues,
        identifiant,
      })
      setGenerations((liste) => [generation, ...liste])
    } catch (erreur) {
      setPanne(erreur instanceof Refus ? erreur.message : "génération refusée")
    }
  }

  const relancer = async (identifiant: string, rang: number) => {
    try {
      const generation = await api.relancer(identifiant, rang)
      setGenerations((liste) =>
        liste.map((g) => (g.identifiant === identifiant ? generation : g)),
      )
    } catch (erreur) {
      setPanne(erreur instanceof Refus ? erreur.message : "relance refusée")
    }
  }

  // ── L'écran ───────────────────────────────────────────────────────────────

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)_26px] bg-fond-0">
      <BarreDeTete
        etat={etat}
        catalogue={catalogueRepli}
        onReglages={() => setReglagesOuverts(true)}
        onRafraichir={async () => {
          await api.rafraichirCatalogue().catch(() => undefined)
          await relire()
        }}
      />

      <main className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)]">
        <PanneauReglages
          modeles={modeles}
          choisi={modele}
          onChoisir={setModeleChoisi}
          proportions={proportions}
          onProportions={setProportions}
          variations={variations}
          onVariations={setVariations}
          options={options}
          onOptions={setOptions}
        />

        <section className="flex min-h-0 flex-col">
          <ChampPrompt
            prompt={prompt}
            onPrompt={setPrompt}
            promptNegatif={promptNegatif}
            onPromptNegatif={setPromptNegatif}
            refus={refus}
            ouAller={refus === etat?.cle.raison ? "Réglages" : undefined}
            onAller={() => setReglagesOuverts(true)}
            onGenerer={generer}
            variations={variations}
          />
          <Grille generations={generations} onRelancer={relancer} />
        </section>
      </main>

      <BarreEtat etat={etat} catalogue={catalogueRepli} panne={panne} />

      {reglagesOuverts && etat && (
        <EcranCle
          etat={etat.cle}
          onDeposee={relire}
          onFermer={() => setReglagesOuverts(false)}
        />
      )}
    </div>
  )
}

// ── La barre de tête ────────────────────────────────────────────────────────

function BarreDeTete({
  etat,
  catalogue,
  onReglages,
  onRafraichir,
}: {
  etat: Etat | null
  catalogue: { repli: boolean; raison: string | null; recu_le: number }
  onReglages: () => void
  onRafraichir: () => void
}) {
  return (
    <header className="flex items-center gap-4 border-b border-bord bg-fond-1 px-4">
      {/* Le seul endroit où l'outil a un visage — 17 px, l'unique exception à
          la règle « Instrument Serif ne descend jamais sous 24 px ». */}
      <h1 className="font-serif text-[17px] leading-none text-texte">Asset Kitchen</h1>

      <div className="ml-auto flex items-center gap-4">
        {catalogue.repli && (
          <span className="mesure text-[10px] text-epingle">
            catalogue du {heure(catalogue.recu_le)} — {catalogue.raison}
          </span>
        )}
        <span className="mesure text-[10px] text-texte-3">
          {dollars(etat?.couts.total_usd ?? 0)} dépensés
        </span>
        <Bouton onClick={onRafraichir} enfants="Catalogue" />
        <Bouton onClick={onReglages} enfants="Réglages" />
      </div>
    </header>
  )
}

// ── La grille ───────────────────────────────────────────────────────────────

function Grille({
  generations,
  onRelancer,
}: {
  generations: Generation[]
  onRelancer: (identifiant: string, rang: number) => void
}) {
  if (generations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="max-w-[380px] text-center font-serif text-[32px] leading-tight text-texte-3">
          Rien n'est encore sorti d'ici. <em className="text-texte-2">Écris.</em>
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-[9px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
      >
        {generations.flatMap((generation) =>
          generation.emplacements.map((emplacement) => (
            <Tuile
              key={`${generation.identifiant}-${emplacement.rang}`}
              generation={generation}
              emplacement={emplacement}
              onRelancer={(rang) => onRelancer(generation.identifiant, rang)}
            />
          )),
        )}
      </div>
    </div>
  )
}

// ── La barre d'état ─────────────────────────────────────────────────────────

function BarreEtat({
  etat,
  catalogue,
  panne,
}: {
  etat: Etat | null
  catalogue: { repli: boolean; raison: string | null }
  panne: string | null
}) {
  const [couleur, texte] = panne
    ? ["var(--color-echec)", panne]
    : catalogue.repli
      ? ["var(--color-info)", "hors ligne — dernier catalogue reçu"]
      : ["var(--color-ok)", "en ligne"]

  return (
    <footer className="mesure flex items-center gap-4 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
      <span className="flex items-center gap-1.5">
        <Point couleur={couleur} />
        {texte}
      </span>
      <span>{etat?.catalogue.modeles ?? 0} modèles</span>
      <span className="ml-auto">
        {etat?.cle.presente ? `clé …${etat.cle.apercu}` : "aucune clé"}
      </span>
    </footer>
  )
}
