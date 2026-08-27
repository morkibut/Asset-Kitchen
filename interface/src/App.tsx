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
type Geste = "Réglages" | "Réessayer"

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
        // Ce message part **une fois par abonnement**, donc à chaque
        // rebranchement. Deux conséquences, et le repli dépend des deux.
        //
        // Son catalogue fait autorité sur celui que l'onglet gardait : sans ça,
        // un serveur redémarré pendant une veille laisse la barre d'état dater
        // une photo qui n'existe plus — ou n'en dater aucune alors qu'il y en a
        // une, et générer partirait sans le moindre avertissement.
        setCatalogueRepli(recu.catalogue)
        // Et son arrivée **prouve** que l'atelier répond : une panne posée
        // pendant son absence est un fait périmé. Sans ce nettoyage, un
        // redémarrage ne « se rattrape sans rien recharger » que sur le papier.
        setPanne(null)
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

  // Le refus porte **son geste** : chaque raison sait où elle mène, quand il y
  // a un endroit où aller. « Le grisé porte sa raison — jamais une infobulle. »
  const refus = useMemo<{ texte: string; geste?: Geste } | null>(() => {
    if (panne) return { texte: panne }
    if (!liaison) return { texte: "l'atelier ne répond pas" }
    if (!etat?.cle.presente)
      return {
        texte: etat?.cle.raison ?? "aucune clé OpenRouter",
        geste: "Réglages",
      }
    if (modeles.length === 0)
      return { texte: "le catalogue n'a jamais été reçu", geste: "Réessayer" }
    if (!modele) return { texte: "aucun modèle choisi" }
    if (modele.refus) return { texte: `${modele.nom} ${modele.refus}` }
    if (!prompt.trim()) return { texte: "aucun prompt" }
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95). Le repli se dit dans la
    // fente sous le bouton et dans la barre d'état, il ne barre pas la route.
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

  // « Le revers — l'actif qui porte son risque. » La fente **prédit** : elle dit
  // ce qui cassera au prochain clic, et le geste qui répare. Elle ne date pas la
  // photo — une date est un fait sur le monde, pas sur le clic à venir, et elle
  // vit donc dans la barre d'état, qui est rendue en permanence.
  //
  // C'est ce qui rend l'ordre des trois locataires juste plutôt que subi : tant
  // que la demande n'est pas composée, le refus tient la fente, et il n'y a
  // aucune prédiction à faire puisqu'il n'y a pas de geste possible.
  // `docs/DESIGN.md` § Motifs, *Le revers*.
  const revers =
    catalogueRepli.repli && catalogueRepli.recu_le > 0
      ? {
          texte: "seul générer échouera",
          enCours: relecture,
          onReessayer: redemanderCatalogue,
        }
      : null

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)_26px] bg-fond-0">
      <BarreDeTete
        etat={etat}
        onReglages={() => setReglagesOuverts(true)}
        onRafraichir={redemanderCatalogue}
      />

      {/* Trois rangées, et rien de plus : 44 px en tête, le travail, 26 px en
          pied. Le repli hors ligne n'ajoute **aucune hauteur** — il se pose
          dans une fente qui existe déjà, sous le bouton Générer. */}
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
            refus={refus?.texte ?? null}
            ouAller={refus?.geste}
            onAller={
              refus?.geste === "Réessayer"
                ? redemanderCatalogue
                : () => setReglagesOuverts(true)
            }
            revers={revers}
            onGenerer={generer}
            variations={variations}
          />
          <Grille generations={generations} onRelancer={relancer} />
        </section>
      </main>

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
  //
  // Le repli est en `--epingle` : arrêté à un instant, que le système ne
  // bougera pas tout seul, et que seul un geste de l'auteur relance. `--info`
  // ne lisait pas comme une couleur à 10 px — il est retiré de la palette.
  const [couleur, texte] = !liaison
    ? ["var(--color-echec)", "l'atelier ne répond pas"]
    : panne
      ? ["var(--color-echec)", panne]
      : catalogue.repli
        ? ["var(--color-epingle)", "hors ligne"]
        : ["var(--color-ok)", "en ligne"]

  // Deux altitudes, deux métiers : le pied porte **l'état du monde** — et
  // pourquoi, quand le port a su le dire en français. Il ne prédit jamais ce
  // qui va casser : ça, c'est la fente sous le bouton Générer.
  return (
    <footer className="mesure flex items-center gap-4 border-t border-bord bg-fond-1 px-4 text-[10px] text-texte-3">
      <span className="flex items-center gap-1.5">
        <Point couleur={couleur} />
        {texte}
      </span>
      {/* **La date vit ici**, et nulle part ailleurs — dans un segment à elle,
          jamais fondue dans la phrase d'état. La mettre dans la fente sous
          Générer la rendait invisible à l'ouverture, où le refus « aucun prompt »
          occupe la fente ; la fondre dans la phrase la rendait invisible dès
          qu'une panne ou une liaison rompue prend cette phrase. Or c'est
          précisément quand ça va mal que l'âge de la photo compte (US-93).
          Sans photo, il n'y a rien à dater : c'est la fente, où générer est
          grisé avec sa raison, qui dit que le catalogue n'est jamais arrivé. */}
      {catalogue.repli && catalogue.recu_le > 0 && (
        <span className="text-epingle">catalogue du {heure(catalogue.recu_le)}</span>
      )}
      {catalogue.repli && catalogue.raison && <span>{catalogue.raison}</span>}
      <span>{etat?.catalogue.modeles ?? 0} modèles</span>
      <span className="ml-auto">
        {etat?.cle.presente ? `clé …${etat.cle.apercu}` : "aucune clé"}
      </span>
    </footer>
  )
}
