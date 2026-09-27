// MO2 · La page « Moteurs », dans Réglages › Moteurs & workflows.
//
// « Chaque moteur d'IA est décrit une seule fois, et tous les outils de
// l'atelier lisent cette description. » (`docs/PLAN-catalogue-des-moteurs.md`
// § MOM). Cette page-ci couvre l'image — créer et repeindre (MO2) —, le son
// (MO4), la vidéo (MO3, `SectionMoteursVideo`), les workflows importés par
// l'auteur (MO6, `SectionWorkflowsImportes`), et la 3D, le détourage et le
// coup de main (MO5). `PageDesMoteurs` est donc
// volontairement un composant par groupe de capacité, pas un fourre-tout :
// une section de plus s'ajoutera sans toucher aux autres.
//
// **Le catalogue décide, jamais une liste en dur** (`AGENTS.md`) : « Sur cette
// machine » vient des vingt-deux styles de sc-clone
// (`GET /workflow-profiles/styles`, groupés sous leurs cinq moteurs comme
// `WorkflowsLocaux.tsx` le faisait déjà) ; « En ligne » vient du même
// catalogue d'images que la barre qui paie et la fabrique Repeindre lisent
// déjà (`modeles: Modele[]`) ; « Le son » vient du catalogue des moteurs
// sonores (`GET /workflow-profiles/sound-engines`,
// `atelier/services/installation_son.py`, MO4) — cette page ne recopie aucun
// nom, aucun état.
//
// **Ce que MO1 avait annoncé** (`docs/PLAN-catalogue-des-moteurs.md` § MO1) :
// « un moteur installé pour créer sait repeindre sans rien installer de
// plus ». C'est pour ça qu'un moteur de cette machine n'est **pas** décrit
// une fois par réglage qui sait créer et une fois par réglage qui sait
// repeindre : une seule carte par moteur, « Repeindre une zone » n'apparaît
// que comme une capacité de plus.

import { useEffect, useRef, useState } from "react"
import { api, Refus, type EtatTraitement, type Modele, type Silhouette } from "../api"
import { sources3d } from "../api-3d"
import { coupDeMain, type EtatCoupDeMain } from "../api-coup-de-main"
import {
  NOM_MOTEUR_LOCAL, NOM_REFERENCE, ORDRE_MOTEURS_LOCAUX, moteursSonores, stylesLocaux, workflows,
  type MoteurSonore, type StyleLocal,
} from "../api-workflows"
import { nomDuModele } from "./Fiche"
import { SectionWorkflowsImportes } from "./MoteursImportes"
import { SectionMoteursVideo } from "./MoteursVideo"
import { ListeManque } from "./WorkflowsLocaux"

/** Le libellé d'une famille de son (`atelier/audio/graphes.py`, `FAMILLES`),
 *  pour l'étiquette de capacité d'un moteur — les sept clés du domaine sont
 *  déjà des mots français, seule la casse change. `voix` et `interface`
 *  n'apparaissent jamais ici : aucun moteur ComfyUI ne les sert encore
 *  (`FAMILLES["voix"] == ()`, `FAMILLES["interface"] == ("sfxr",)` — sfxr
 *  n'est pas un graphe ComfyUI, il ne passe pas par ce catalogue). */
const LIBELLE_FAMILLE: Record<string, string> = {
  bruitage: "Bruitage", ambiance: "Ambiance", musique: "Musique", jingle: "Jingle", chanson: "Chanson",
}

const message = (e: unknown) => (e instanceof Refus || e instanceof Error ? e.message : "L’opération n’a pas abouti. Réessayez.")

export const BOUTON = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[4px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-3 disabled:opacity-50"
export const CAPACITE = "inline-flex h-[22px] items-center rounded-5 bg-papier-cote px-[8px] text-[11.5px] text-encre-2"

/** L'état d'un moteur, réduit aux trois badges que cette page montre — un
 *  quatrième (« clé manquante ») vit dans `EtatEnLigne`, ci-dessous : les deux
 *  familles de moteurs ne se grisent pas pour la même raison. */
type EtatMachine = "installe" | "a-installer" | "manque"

/** Les badges de la page, section vidéo (MO3) comprise. */
export type EtatBadge =
  | EtatMachine
  | "indisponible"
  | "cle-manquante"
  // MO5 : la 3D (adresse jamais réglée depuis l'atelier), le détourage par
  // modèle (l'extension manque, ou le poids n'est pas encore descendu — ce
  // n'est jamais un bouton, `rembg` le télécharge tout seul au premier appel)
  // et le coup de main (son unique plafond mensuel, distinct d'une clé
  // absente : la marque le dit déjà par une ligne grise, jamais un silence).
  | "non-configure"
  | "extension-absente"
  | "au-premier-appel"
  | "plafond-atteint"
  // MO6 : un workflow importé à qui il manque un nœud, un fichier ou un champ
  // — pas forcément un fichier, d'où un mot à lui plutôt que « Fichiers
  // manquants ».
  | "a-completer"

const BADGE: Record<EtatBadge, { texte: string; classe: string }> = {
  installe: { texte: "Installé", classe: "border-trait-ok bg-fond-ok text-encre-ok" },
  "a-installer": { texte: "À installer", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  manque: { texte: "Fichiers manquants", classe: "border-trait bg-papier-cote text-encre-3" },
  indisponible: { texte: "Indisponible", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  // MO3 : un moteur vidéo en ligne sans sa clé le dit par son nom.
  "cle-manquante": { texte: "Clé manquante", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  "non-configure": { texte: "Non configuré", classe: "border-trait bg-papier-cote text-encre-3" },
  "extension-absente": { texte: "Extension absente", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  "au-premier-appel": { texte: "Au premier appel", classe: "border-trait bg-papier-cote text-encre-3" },
  "plafond-atteint": { texte: "Plafond atteint", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  "a-completer": { texte: "À compléter", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
}

export function Badge({ etat }: { etat: EtatBadge }) {
  const b = BADGE[etat]
  return <span className={`ml-auto inline-flex h-[22px] shrink-0 items-center rounded-5 border px-[8px] text-[12px] whitespace-nowrap ${b.classe}`}>{b.texte}</span>
}

export function PageDesMoteurs({
  modeles,
  traitement,
  signale,
  onSignale,
  onInstallation,
  onInstallationSon,
  actualiserImportesSur,
  onWorkflowRelie,
}: {
  /** Le catalogue d'images déjà lu par l'atelier (`App.tsx`) — la même liste
   *  que la barre qui paie et la fabrique Repeindre, jamais une seconde
   *  lecture d'ici. */
  modeles: Modele[]
  /** MO5 : ce que le post-traitement sait faire sur cette machine — porte
   *  déjà le catalogue des cinq modèles de détourage (`traitement.
   *  silhouettes`, `atelier/image/traitement.py`, `etat_des_silhouettes`).
   *  Même donnée que `Retouche.tsx` lit pour le choix d'un modèle dans une
   *  passe : une seconde lecture d'ici aurait été la même liste deux fois.
   *  `null` tant que l'état de l'atelier n'est pas encore arrivé. */
  traitement?: EtatTraitement | null
  /** Le moteur vers lequel un outil vient de renvoyer — la clé de famille
   *  pour un moteur de cette machine (`qwen21`, `zimage`…), l'identifiant du
   *  modèle pour un moteur en ligne. `null` sans renvoi en cours. */
  signale: string | null
  /** Le signalement se consomme : une fois l'effet joué (défilement, mise en
   *  évidence), l'appelant l'efface — sinon un second renvoi vers le même
   *  moteur ne rejouerait rien. */
  onSignale: () => void
  /** MO3 : ouvre « L'installation », où les fichiers de Wan se descendent avec
   *  leur taille et leur licence — la page n'a pas de second chemin pour ça. */
  onInstallation?: () => void
  /** MO4 : prévient l'appelant qu'un moteur sonore vient d'être (ré)installé,
   *  pour qu'il relise à son tour « Les workflows locaux » (`Reglages.tsx`) —
   *  même mécanique que `MethodesSonores.onInstalle` avant elle. */
  onInstallationSon?: () => void
  /** MO6 : change quand « Les workflows locaux » vient d'importer une version
   *  — « Les workflows importés » se relit. */
  actualiserImportesSur?: number
  /** MO6 : une version vient d'être écrite depuis « Les workflows importés »
   *  (relier ce que le graphe reçoit) — l'appelant relit « Les workflows
   *  locaux ». */
  onWorkflowRelie?: () => void
}) {
  const [styles, setStyles] = useState<StyleLocal[] | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState("")
  const [installation, setInstallation] = useState<string | null>(null)
  const [sons, setSons] = useState<MoteurSonore[] | null>(null)
  const [chargementSon, setChargementSon] = useState(true)
  const [erreurSon, setErreurSon] = useState("")
  const [installationSon, setInstallationSon] = useState<string | null>(null)

  async function relire() {
    setChargement(true)
    setErreur("")
    try {
      setStyles((await stylesLocaux.lister()).styles)
    } catch (e) {
      setErreur(message(e))
    } finally {
      setChargement(false)
    }
  }
  useEffect(() => {
    void relire()
  }, [])

  // MO4 : le catalogue des moteurs sonores — un `GET` de plus, comme les
  // styles ci-dessus, qui ne pose jamais de profil (`atelier.installation_son.
  // catalogue`, jamais `.installer`).
  async function relireSon() {
    setChargementSon(true)
    setErreurSon("")
    try {
      setSons((await moteursSonores.lister()).moteurs)
    } catch (e) {
      setErreurSon(message(e))
    } finally {
      setChargementSon(false)
    }
  }
  useEffect(() => {
    void relireSon()
  }, [])

  // MO5 : la 3D — `sources3d.connexion()` dit si une adresse a été posée
  // (lecture d'un fichier, jamais un ping) ; `sources3d.catalogue()` fait les
  // deux vrais appels HTTP qui disent si asset3d y répond vraiment
  // (`atelier/fournisseur/asset3d.py`). Ni l'un ni l'autre ne pose ni ne
  // télécharge quoi que ce soit — la même règle que « Sur cette machine » et
  // « Le son » plus haut : rien ne s'installe tout seul.
  const [connexion3D, setConnexion3D] = useState<{ adresse: string; configure: boolean } | null>(null)
  const [pret3D, setPret3D] = useState<boolean | null>(null)
  const [erreur3D, setErreur3D] = useState("")
  useEffect(() => {
    let vivant = true
    void sources3d
      .connexion()
      .then((c) => {
        if (!vivant) return
        setConnexion3D(c)
        if (!c.configure) return
        sources3d
          .catalogue()
          .then(() => vivant && setPret3D(true))
          .catch(() => vivant && setPret3D(false))
      })
      .catch((e) => vivant && setErreur3D(message(e)))
    return () => {
      vivant = false
    }
  }, [])

  // MO5 : le coup de main — `GET /assist` dit s'il peut répondre (clé posée,
  // plafond du mois non atteint) sans jamais rien envoyer au fournisseur
  // (`atelier/api/coup_de_main.py`, `atelier/services/coup_de_main.py`).
  const [assist, setAssist] = useState<EtatCoupDeMain | null>(null)
  const [erreurAssist, setErreurAssist] = useState("")
  useEffect(() => {
    let vivant = true
    void coupDeMain
      .etat()
      .then((e) => vivant && setAssist(e))
      .catch((e) => vivant && setErreurAssist(message(e)))
    return () => {
      vivant = false
    }
  }, [])

  async function installerSonUn(identifiant: string) {
    setInstallationSon(identifiant)
    setErreurSon("")
    try {
      await workflows.installerSon([identifiant])
      await relireSon()
      onInstallationSon?.()
    } catch (e) {
      setErreurSon(message(e))
    } finally {
      setInstallationSon(null)
    }
  }
  async function installerLesSonsPrets() {
    setInstallationSon("*")
    setErreurSon("")
    try {
      await workflows.installerSon()
      await relireSon()
      onInstallationSon?.()
    } catch (e) {
      setErreurSon(message(e))
    } finally {
      setInstallationSon(null)
    }
  }

  async function installerUn(identifiant: string) {
    setInstallation(identifiant)
    setErreur("")
    try {
      await stylesLocaux.installer(identifiant)
      await api.rafraichirCatalogue()
      await relire()
    } catch (e) {
      setErreur(message(e))
    } finally {
      setInstallation(null)
    }
  }
  async function installerLesPrets() {
    setInstallation("*")
    setErreur("")
    try {
      await stylesLocaux.installerPrets()
      await api.rafraichirCatalogue()
      await relire()
    } catch (e) {
      setErreur(message(e))
    } finally {
      setInstallation(null)
    }
  }

  // ── Le renvoi depuis un outil (Créer, Repeindre) : défiler jusqu'à la
  // carte visée et la mettre en évidence un instant — la mécanique que
  // `docs/maquettes-atelier-unifie/moteurs.js` simule, rejouée pour de vrai.
  // Dépend aussi de `styles` : un renvoi vers un moteur de cette machine
  // arrive souvent avant que `GET /workflow-profiles/styles` ait répondu, et
  // tant que la carte ne s'est pas montée, on ne démarre **pas** le compte à
  // rebours des 2200ms — sinon il s'écoulerait pendant l'attente et
  // effacerait le signalement avant même le premier défilement.
  const cartes = useRef<Record<string, HTMLElement | null>>({})
  useEffect(() => {
    if (!signale) return
    const carte = cartes.current[signale]
    if (!carte) return
    carte.scrollIntoView({ block: "center", behavior: "smooth" })
    const t = setTimeout(onSignale, 2200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signale, styles, sons])

  const parMoteur = new Map<string, StyleLocal[]>()
  for (const s of styles ?? []) {
    const l = parMoteur.get(s.famille) ?? []
    l.push(s)
    parMoteur.set(s.famille, l)
  }
  // « Installer les styles prêts » reste un geste transversal, pas répété sur
  // chaque carte : il n'a jamais été un bouton par moteur, et le garder tel
  // quel évite de faire cliquer cinq fois qui ne veut qu'un geste.
  const pretsTotal = (styles ?? []).filter((s) => s.pret).length
  const pretsNonInstalles = (styles ?? []).filter((s) => s.pret && !s.modele).length

  const sonsPretsNonInstalles = (sons ?? []).filter((s) => s.pret && !s.modele).length

  // « En ligne » : le même catalogue d'images que partout ailleurs, réduit
  // aux modèles distants — un fournisseur, puis un nom, pour un ordre stable.
  const enLigne = modeles
    .filter((m) => !m.locale)
    .slice()
    .sort((a, b) => (a.fournisseur === b.fournisseur ? a.nom.localeCompare(b.nom) : a.fournisseur.localeCompare(b.fournisseur)))

  return (
    <section aria-label="Les moteurs" className="space-y-[22px] text-encre">
      <header>
        <h2 className="font-serif text-[38px]">Les moteurs</h2>
        <p className="mt-[8px] text-[13px] text-encre-3">
          Chaque moteur, décrit une seule fois : ce qu’il sait faire, ses réglages, et son état. Créer, Repeindre et Fabriquer un son lisent cette même
          liste — un moteur d’image ou de son non installé y renvoie d’un clic —, et les deux écrans qui font une vidéo lisent la section « Vidéo ».
        </p>
      </header>

      {erreur && (
        <p role="alert" className="text-[13px] text-echec">
          {erreur}
        </p>
      )}

      <section aria-label="Sur cette machine" className="space-y-[8px]">
        <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
          <h3 className="font-serif text-[25px]">Sur cette machine</h3>
          {styles && pretsTotal > 0 && (
            <button type="button" className={BOUTON} onClick={() => void installerLesPrets()} disabled={installation !== null}>
              {installation === "*" ? "Installation…" : pretsNonInstalles > 0 ? `Installer les styles prêts (${pretsNonInstalles})` : "Relire les fichiers des styles"}
            </button>
          )}
        </div>
        <p className="text-[12px] text-encre-3">ComfyUI, une fois installé, sert tous les moteurs de ce groupe. Rien n’est téléchargé depuis l’atelier.</p>
        {!styles && chargement && (
          <p role="status" className="text-[13px] text-encre-3">
            Lecture des styles…
          </p>
        )}
        {styles && (
          <div className="grid gap-[8px]">
            {ORDRE_MOTEURS_LOCAUX.filter((f) => parMoteur.has(f)).map((f) => (
              <CarteMoteurMachine
                key={f}
                famille={f}
                styles={parMoteur.get(f) ?? []}
                installation={installation}
                onInstaller={installerUn}
                signale={signale === f}
                referer={(el) => {
                  cartes.current[f] = el
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="En ligne" className="space-y-[8px]">
        <h3 className="font-serif text-[25px]">En ligne</h3>
        <p className="text-[12px] text-encre-3">
          La liste arrive de chaque fournisseur ; elle entre dans le même catalogue, sans en changer la source. Une clé manquante se branche juste
          au-dessus, dans « Les fournisseurs ».
        </p>
        {enLigne.length === 0 ? (
          <p className="text-[13px] text-encre-3">Aucun moteur en ligne dans le catalogue d’images pour l’instant.</p>
        ) : (
          <div className="grid gap-[8px]">
            {enLigne.map((m) => (
              <CarteMoteurEnLigne
                key={m.identifiant}
                modele={m}
                signale={signale === m.identifiant}
                referer={(el) => {
                  cartes.current[m.identifiant] = el
                }}
              />
            ))}
          </div>
        )}
      </section>

      <SectionMoteursVideo onInstallation={onInstallation} />

      {/* MO4 : « Le son » — les moteurs sonores du même catalogue
          (`GET /workflow-profiles/sound-engines`), même geste qu'« Installer
          les styles prêts » ci-dessus. Fond « Les méthodes sonores »
          (`WorkflowsLocaux.tsx`), qui tenait sa propre liste de cinq noms. */}
      <section aria-label="Le son" className="space-y-[8px]">
        <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
          <h3 className="font-serif text-[25px]">Le son</h3>
          {sons && sonsPretsNonInstalles > 0 && (
            <button type="button" className={BOUTON} onClick={() => void installerLesSonsPrets()} disabled={installationSon !== null}>
              {installationSon === "*" ? "Installation…" : `Installer les méthodes sonores prêtes (${sonsPretsNonInstalles})`}
            </button>
          )}
        </div>
        <p className="text-[12px] text-encre-3">
          Cinq moteurs fabriquent les sons du jeu. Rien n’est jamais téléchargé par l’atelier : c’est toi qui poses les fichiers, l’atelier ne fait que
          les retrouver.
        </p>
        {erreurSon && (
          <p role="alert" className="text-[13px] text-echec">
            {erreurSon}
          </p>
        )}
        {!sons && chargementSon && (
          <p role="status" className="text-[13px] text-encre-3">
            Lecture des moteurs sonores…
          </p>
        )}
        {sons && (
          <div className="grid gap-[8px]">
            {sons.map((m) => (
              <CarteMoteurSonore
                key={m.identifiant}
                moteur={m}
                installation={installationSon}
                onInstaller={installerSonUn}
                signale={signale === m.identifiant}
                referer={(el) => {
                  cartes.current[m.identifiant] = el
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* MO6 : « Les workflows importés » — ce que l'auteur a importé lui-même,
          chacun avec ce qu'il sait faire et ce qui lui manque. Dans son propre
          fichier, comme « Vidéo ». */}
      <SectionWorkflowsImportes actualiserSur={actualiserImportesSur} onRelie={onWorkflowRelie} />

      {/* MO5 : « La 3D » — un seul programme, jamais un par famille ; son
          adresse et ses réglages détaillés restent les siens
          (`docs/PLAN-catalogue-des-moteurs.md` § Ce que ce n'est pas). La
          page ne fait que dire s'il est réglé et s'il répond — le régler se
          fait toujours depuis la fiche d'un personnage. */}
      <section aria-label="La 3D" className="space-y-[8px]">
        <h3 className="font-serif text-[25px]">La 3D</h3>
        <p className="text-[12px] text-encre-3">
          Un programme à part (asset3d), sur cette machine. Son adresse se règle depuis la fiche d’un personnage, « Ses sources 3D ».
        </p>
        {erreur3D && (
          <p role="alert" className="text-[13px] text-echec">
            {erreur3D}
          </p>
        )}
        {connexion3D === null ? (
          <p role="status" className="text-[13px] text-encre-3">
            Lecture de l’état d’asset3d…
          </p>
        ) : (
          <CarteMoteur3D connexion={connexion3D} pret={pret3D} />
        )}
      </section>

      {/* MO5 : « Le détourage » — les cinq modèles du catalogue
          (`traitement.silhouettes`), la même liste que la passe « Modèle » de
          `Retouche.tsx`. Jamais de bouton installer : `rembg` télécharge le
          poids tout seul au premier appel (`AGENTS.md` § Lancer) — l’absence
          qui se grise ici est celle de l’extension elle-même. */}
      <section aria-label="Le détourage" className="space-y-[8px]">
        <h3 className="font-serif text-[25px]">Le détourage</h3>
        <p className="text-[12px] text-encre-3">
          Cinq modèles pour détourer une image sans dessiner un contour à la main. Le poids de chacun se télécharge tout seul, la première fois qu’on
          s’en sert.
        </p>
        {!traitement ? (
          <p role="status" className="text-[13px] text-encre-3">
            Lecture des moteurs de détourage…
          </p>
        ) : (
          <div className="grid gap-[8px]">
            {traitement.silhouettes.map((s) => (
              <CarteMoteurDetourage key={s.nom} silhouette={s} />
            ))}
          </div>
        )}
      </section>

      {/* MO5 : « Le coup de main » — un seul modèle fixe
          (`docs/PLAN-assistant.md`), déjà exposé par `GET /assist`
          pour la petite marque posée sur les champs de texte. Cette carte-ci
          ne fait que le montrer au même endroit que les autres moteurs. */}
      <section aria-label="Le coup de main" className="space-y-[8px]">
        <h3 className="font-serif text-[25px]">Le coup de main</h3>
        <p className="text-[12px] text-encre-3">Un modèle de texte, pour améliorer un champ, répondre à une question ou expliquer un blocage.</p>
        {erreurAssist && (
          <p role="alert" className="text-[13px] text-echec">
            {erreurAssist}
          </p>
        )}
        {assist === null ? (
          <p role="status" className="text-[13px] text-encre-3">
            Lecture de l’état du coup de main…
          </p>
        ) : (
          <CarteMoteurCoupDeMain assist={assist} />
        )}
      </section>
    </section>
  )
}

function CarteMoteurSonore({
  moteur,
  installation,
  onInstaller,
  signale,
  referer,
}: {
  moteur: MoteurSonore
  installation: string | null
  onInstaller: (identifiant: string) => void
  signale: boolean
  referer: (el: HTMLElement | null) => void
}) {
  const etat: EtatMachine = moteur.modele ? "installe" : moteur.pret ? "a-installer" : "manque"
  return (
    <article
      ref={referer}
      data-moteur-carte={moteur.identifiant}
      className={`grid gap-[8px] rounded-8 border bg-carte p-[14px] transition-shadow duration-120 ${
        signale ? "border-signal shadow-[0_0_0_2px_var(--color-signal)]" : "border-trait"
      }`}
    >
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">{moteur.nom}</h4>
        <Badge etat={etat} />
      </div>
      <p className="text-[12px] text-encre-3">{moteur.description}</p>
      <div className="flex flex-wrap gap-[4px]">
        {moteur.familles.map((f) => (
          <span key={f} className={CAPACITE}>
            {LIBELLE_FAMILLE[f] ?? f}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-[8px] border-t border-trait pt-[8px]">
        <p className="text-[13px] text-encre-3">{moteur.pret ? (moteur.modele ? "prêt · installé" : "prêt") : "il manque des fichiers"}</p>
        {moteur.pret && (
          <button type="button" className={BOUTON} disabled={installation !== null} onClick={() => onInstaller(moteur.identifiant)}>
            {installation === moteur.identifiant ? "Installation…" : moteur.modele ? "Réinstaller" : "Installer"}
          </button>
        )}
      </div>
      {!moteur.pret && <ListeManque manque={moteur.manque} />}
    </article>
  )
}

function CarteMoteurMachine({
  famille,
  styles,
  installation,
  onInstaller,
  signale,
  referer,
}: {
  famille: string
  styles: StyleLocal[]
  installation: string | null
  onInstaller: (identifiant: string) => void
  signale: boolean
  referer: (el: HTMLElement | null) => void
}) {
  const repeint = styles.some((s) => s.repeint)
  const installe = styles.some((s) => s.modele)
  const pret = styles.some((s) => s.pret)
  const etat: EtatMachine = installe ? "installe" : pret ? "a-installer" : "manque"
  return (
    <article
      ref={referer}
      data-moteur-carte={famille}
      className={`grid gap-[8px] rounded-8 border bg-carte p-[14px] transition-shadow duration-120 ${
        signale ? "border-signal shadow-[0_0_0_2px_var(--color-signal)]" : "border-trait"
      }`}
    >
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">{NOM_MOTEUR_LOCAL[famille] ?? famille}</h4>
        <Badge etat={etat} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Créer une image</span>
        {repeint && <span className={CAPACITE}>Repeindre une zone</span>}
      </div>
      <ul className="space-y-[8px] border-t border-trait pt-[8px]">
        {styles.map((style) => (
          <li key={style.identifiant} className={`flex flex-wrap items-center justify-between gap-[8px] ${style.pret ? "" : "opacity-50"}`}>
            <div>
              <p className="text-[13px]">{style.nom}</p>
              <p className="text-[12px] text-encre-3">
                {style.pret ? (style.modele ? "prêt · installé" : "prêt") : `il manque ${style.manque.join(", ")}`} · {style.vitesse}
                {style.reference && ` · ${NOM_REFERENCE[style.reference]}`}
              </p>
            </div>
            {style.pret && (
              <button type="button" className={BOUTON} disabled={installation !== null} onClick={() => onInstaller(style.identifiant)}>
                {installation === style.identifiant ? "Installation…" : style.modele ? "Réinstaller" : "Installer"}
              </button>
            )}
            {!style.pret && (
              <p className="text-[12px] text-encre-3">
                dans <code>C:\STOCKAGE\PROJET\_DEV\sc-clone</code> : <code>node scripts/install-models.mjs</code>
              </p>
            )}
          </li>
        ))}
      </ul>
    </article>
  )
}

function CarteMoteurEnLigne({
  modele,
  signale,
  referer,
}: {
  modele: Modele
  signale: boolean
  referer: (el: HTMLElement | null) => void
}) {
  const indisponible = modele.refus
  return (
    <article
      ref={referer}
      data-moteur-carte={modele.identifiant}
      className={`grid gap-[8px] rounded-8 border bg-carte p-[14px] transition-shadow duration-120 ${
        signale ? "border-signal shadow-[0_0_0_2px_var(--color-signal)]" : "border-trait"
      }`}
    >
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">
          <span className="text-encre-3">{modele.fournisseur} · </span>
          {modele.nom}
        </h4>
        <Badge etat={indisponible ? "indisponible" : "installe"} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Créer une image</span>
        {modele.masque && <span className={CAPACITE}>Repeindre une zone</span>}
      </div>
      {indisponible && <p className="text-[12px] text-encre-attention">{indisponible}</p>}
    </article>
  )
}

// ── MO5 ──────────────────────────────────────────────────────────────────────

/** **Un seul programme, jamais un par famille** — asset3d n'a pas de réglage à
 *  choisir ici : ses trois capacités sont ses trois étapes (`ETAPES`,
 *  `Fabrication3D.tsx`), et son adresse reste posée depuis la fiche d'un
 *  personnage. Cette carte ne fait que dire si elle est réglée et si le
 *  programme y répond — jamais un bouton qui la réglerait à sa place. */
function CarteMoteur3D({
  connexion,
  pret,
}: {
  connexion: { adresse: string; configure: boolean }
  /** `null` : configuré mais pas encore vérifié ; `true`/`false` : le
   *  résultat du dernier `sources3d.catalogue()`. Toujours `null` sans
   *  adresse posée — il n'y a rien à vérifier. */
  pret: boolean | null
}) {
  const etat: EtatBadge = !connexion.configure ? "non-configure" : pret === false ? "indisponible" : "installe"
  return (
    <article className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">asset3d</h4>
        <Badge etat={etat} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Créer le modèle 3D</span>
        <span className={CAPACITE}>Poser le squelette</span>
        <span className={CAPACITE}>Produire les images</span>
      </div>
      {connexion.configure ? (
        <p className="text-[12px] text-encre-3">
          {connexion.adresse}
          {pret === false && " — ne répond pas à cette adresse ; les copies déjà importées restent disponibles"}
          {pret === null && " — vérification…"}
        </p>
      ) : (
        <p className="text-[12px] text-encre-3">Aucune adresse posée — se règle depuis la fiche d’un personnage, « Ses sources 3D ».</p>
      )}
    </article>
  )
}

/** **Jamais de bouton installer** : `rembg` télécharge le poids tout seul au
 *  premier appel (`AGENTS.md` § Lancer). Ce que cette carte grise, c'est
 *  l'extension elle-même — absente, aucun des cinq modèles ne répond, et
 *  `s.raison` porte alors la même phrase pour les cinq. */
function CarteMoteurDetourage({ silhouette: s }: { silhouette: Silhouette }) {
  const etat: EtatBadge = s.raison ? "extension-absente" : s.descendu ? "installe" : "au-premier-appel"
  const mo = Math.round(s.octets / 1_000_000)
  return (
    <article className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">
          {s.titre}
          <span className="text-encre-3"> · {s.nom}</span>
          {s.defaut && <span className="text-encre-3"> · défaut</span>}
        </h4>
        <Badge etat={etat} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Détourer une image</span>
      </div>
      {s.raison ? (
        <p className="text-[12px] text-encre-3">
          {s.raison} — dans <code>C:\STOCKAGE\PROJET\_DEV\gag2</code> : <code>uv pip install -e ".[detourage]"</code>
        </p>
      ) : (
        <p className="text-[12px] text-encre-3">
          {mo} Mo · {s.secondes_par_image ? `${s.secondes_par_image} s par image` : "durée encore inconnue"} · {s.licence}
          {!s.descendu && " · se télécharge tout seul au premier appel"}
        </p>
      )}
    </article>
  )
}

/** **Le même modèle fixe partout** (`docs/PLAN-assistant.md`) : une
 *  seule carte, jamais un choix — `GET /assist` est déjà la porte que la
 *  petite marque des champs de texte lit, cette carte ne fait que la montrer
 *  au même endroit que les autres moteurs. */
function CarteMoteurCoupDeMain({ assist }: { assist: EtatCoupDeMain }) {
  const etat: EtatBadge = assist.disponible ? "installe" : assist.motif === "plafond" ? "plafond-atteint" : "cle-manquante"
  return (
    <article className="grid gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-wrap items-center gap-[14px]">
        <h4 className="text-[14px]">{nomDuModele(assist.modele)}</h4>
        <Badge etat={etat} />
      </div>
      <div className="flex flex-wrap gap-[4px]">
        <span className={CAPACITE}>Améliorer un champ</span>
        <span className={CAPACITE}>Répondre à une question</span>
        <span className={CAPACITE}>Expliquer un blocage</span>
      </div>
      {assist.raison && <p className="text-[12px] text-encre-3">{assist.raison}</p>}
    </article>
  )
}
