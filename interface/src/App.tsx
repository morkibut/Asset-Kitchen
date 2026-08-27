// L'Atelier — l'écran du travail quotidien.
//
// En T1 il tient deux colonnes : les réglages, puis le prompt et la grille.
// L'arbre des projets et la fiche asset arrivent avec la bibliothèque (T3) ;
// les afficher vides maintenant serait montrer du cadrage au lieu de servir le
// geste — c'est exactement ce qui a fait écarter `docs/maquette-atelier.html`.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  api,
  dollars,
  ecouter,
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

type Repli = { repli: boolean; raison: string | null; recu_le: number }

export function App() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [catalogueRepli, setCatalogueRepli] = useState<Repli>({
    repli: false,
    raison: null,
    recu_le: 0,
  })
  const [defaut, setDefaut] = useState<{
    modele: string | null
    options: Record<string, string>
  }>({ modele: null, options: {} })
  const [generations, setGenerations] = useState<Generation[]>([])
  const [panne, setPanne] = useState<string | null>(null)
  const [liaison, setLiaison] = useState(true)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const [relecture, setRelecture] = useState(false)

  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [promptNegatif, setPromptNegatif] = useState("")
  const [proportions, setProportions] = useState("1:1")
  const [variations, setVariations] = useState(1)
  const [options, setOptions] = useState<Record<string, string>>({})

  // ── Ce que l'atelier sait de lui-même ─────────────────────────────────────

  // Le catalogue est le seul appel que l'interface refait d'elle-même : la
  // liste des modèles dépend de la demande en cours (proportions, références),
  // et c'est le serveur qui décide du grisé de chacun. Tout le reste arrive par
  // le flux.
  const relireCatalogue = useCallback(async () => {
    try {
      const catalogue = await api.modeles(proportions)
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
    void relireCatalogue()
  }, [relireCatalogue])

  // ── Le flux d'événements ──────────────────────────────────────────────────
  //
  // Plus aucun sondage. On se branche une fois, on écoute, et l'atelier dit ce
  // qu'il fait au moment où il le fait. Le premier message est l'état complet :
  // c'est lui qui fait qu'un onglet rouvert retrouve les images produites
  // pendant son absence — et `EventSource` se rebranche seul, donc une veille
  // de machine ou un redémarrage du serveur se rattrapent sans rien recharger.

  useEffect(() => {
    return ecouter({
      etat: (recu) => {
        setEtat(recu)
        if (recu.generations) setGenerations(recu.generations)
      },
      generation: (recue) =>
        setGenerations((liste) => {
          const connue = liste.some((g) => g.identifiant === recue.identifiant)
          return connue
            ? liste.map((g) => (g.identifiant === recue.identifiant ? recue : g))
            : [recue, ...liste]
        }),
      catalogue: (recu) => {
        setCatalogueRepli(recu)
        // Le repli change ce que chaque modèle peut honorer : la liste, elle,
        // se redemande — c'est le serveur qui écrit les raisons du grisé.
        void relireCatalogue()
      },
      liaison: setLiaison,
    })
  }, [relireCatalogue])

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
    if (!liaison) return "l'atelier ne répond pas"
    if (!etat?.cle.presente) return etat?.cle.raison ?? "aucune clé OpenRouter"
    if (modeles.length === 0) return "aucun modèle — le catalogue n'a jamais été reçu"
    if (!modele) return "aucun modèle choisi"
    if (modele.refus) return `${modele.nom} ${modele.refus}`
    if (!prompt.trim()) return "aucun prompt"
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95). Le repli se dit dans le
    // bandeau et la barre d'état, il ne barre pas la route.
    return null
  }, [panne, liaison, etat, modeles, modele, prompt])

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

  // Redemander le catalogue au fournisseur. Le résultat n'est pas lu ici : le
  // serveur publie le nouvel état sur le flux, et c'est ce message qui relit la
  // liste des modèles — pour cet onglet comme pour les autres. Le lire aussi en
  // retour ferait demander la même chose deux fois.
  const redemanderCatalogue = async () => {
    setRelecture(true)
    try {
      await api.rafraichirCatalogue()
    } catch (erreur) {
      setPanne(erreur instanceof Refus ? erreur.message : "l'atelier ne répond pas")
    } finally {
      setRelecture(false)
    }
  }

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)_26px] bg-fond-0">
      <BarreDeTete
        etat={etat}
        onReglages={() => setReglagesOuverts(true)}
        onRafraichir={redemanderCatalogue}
      />

      {/* Le bandeau vit **dans** la rangée du travail, pas dans une rangée à
          lui : une rangée de gabarit qui n'a pas toujours d'occupant décale
          tout le reste les jours où le réseau va bien. */}
      <div className="flex min-h-0 flex-col">
        <BandeauHorsLigne
          catalogue={catalogueRepli}
          relecture={relecture}
          onReessayer={redemanderCatalogue}
        />

        <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
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
      </div>

      <BarreEtat
        etat={etat}
        catalogue={catalogueRepli}
        panne={panne}
        liaison={liaison}
      />

      {reglagesOuverts && etat && (
        <EcranCle
          etat={etat.cle}
          onDeposee={async () => {
            // La clé n'est pas un fait que le serveur annonce : c'est l'écran
            // qui vient de la poser. Il relit donc l'état une fois, ici, et
            // nulle part ailleurs.
            setEtat(await api.etat().catch(() => etat))
            await relireCatalogue()
          }}
          onFermer={() => setReglagesOuverts(false)}
        />
      )}
    </div>
  )
}

// ── La barre de tête ────────────────────────────────────────────────────────

function BarreDeTete({
  etat,
  onReglages,
  onRafraichir,
}: {
  etat: Etat | null
  onReglages: () => void
  onRafraichir: () => void
}) {
  return (
    <header className="flex items-center gap-4 border-b border-bord bg-fond-1 px-4">
      {/* Le seul endroit où l'outil a un visage — 17 px, l'unique exception à
          la règle « Instrument Serif ne descend jamais sous 24 px ». */}
      <h1 className="font-serif text-[17px] leading-none text-texte">Asset Kitchen</h1>

      <div className="ml-auto flex items-center gap-4">
        <span className="mesure text-[10px] text-texte-3">
          {dollars(etat?.couts.total_usd ?? 0)} dépensés
        </span>
        <Bouton onClick={onRafraichir} enfants="Catalogue" />
        <Bouton onClick={onReglages} enfants="Réglages" />
      </div>
    </header>
  )
}

// ── Le repli hors ligne, à l'écran ──────────────────────────────────────────
//
// « Le catalogue affiche sa date en clair, un prompt se prépare, et l'échec ne
// survient qu'au moment de générer » — critère d'acceptation de T1.
//
// Le bandeau ne barre rien et ne s'excuse pas : il date ce qu'on voit, dit ce
// qui marche encore, dit ce qui échouera, et donne le geste pour réessayer. En
// `--info`, pas en `--echec` : hors ligne n'est pas une panne du produit, c'est
// un état dans lequel il continue de servir.

function BandeauHorsLigne({
  catalogue,
  relecture,
  onReessayer,
}: {
  catalogue: Repli
  relecture: boolean
  onReessayer: () => void
}) {
  if (!catalogue.repli) return null

  const jamaisRecu = catalogue.recu_le === 0

  return (
    <div className="mesure flex shrink-0 items-center gap-2 border-b border-info/35 bg-info/8 px-4 py-1.5 text-[10px] leading-4 text-info">
      <span aria-hidden className="inline-block h-px w-2 bg-info" />
      <span className="text-texte-2">
        {jamaisRecu
          ? "Hors ligne, et le catalogue n'a jamais été reçu."
          : `Hors ligne — catalogue du ${heure(catalogue.recu_le)}.`}
      </span>
      <span>
        {jamaisRecu
          ? "Aucun modèle à proposer tant que le réseau n'est pas revenu."
          : "On peut écrire et régler ; générer échouera tant que le réseau est coupé."}
      </span>
      {catalogue.raison && <span className="text-texte-3">· {catalogue.raison}</span>}
      <button
        type="button"
        onClick={onReessayer}
        disabled={relecture}
        className="ml-auto text-signal hover:text-signal-clair disabled:text-texte-3"
      >
        {relecture ? "…" : "Réessayer ›"}
      </button>
    </div>
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
  liaison,
}: {
  etat: Etat | null
  catalogue: Repli
  panne: string | null
  liaison: boolean
}) {
  // Trois choses différentes, et il ne faut pas les confondre : l'atelier est
  // arrêté (liaison rompue), le fournisseur est injoignable (repli), ou tout
  // va bien. La première l'emporte — sans serveur, le reste ne veut rien dire.
  const [couleur, texte] = !liaison
    ? ["var(--color-echec)", "l'atelier ne répond pas"]
    : panne
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
