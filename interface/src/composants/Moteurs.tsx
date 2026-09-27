// MO2 · La page « Moteurs », dans Réglages › Moteurs & workflows.
//
// « Chaque moteur d'IA est décrit une seule fois, et tous les outils de
// l'atelier lisent cette description. » (`docs/PLAN-catalogue-des-moteurs.md`
// § MOM). Cette page-ci couvre l'image — créer et repeindre (MO2) — et le son
// (MO4) : la vidéo (MO3), la 3D et le détourage (MO5) et les workflows
// importés (MO6) ajouteront leurs propres cartes à la suite, dans des
// tranches séparées. `PageDesMoteurs` est donc volontairement un composant
// par groupe de capacité, pas un fourre-tout : une section de plus s'ajoutera
// sans toucher aux autres.
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
import { api, Refus, type Modele } from "../api"
import {
  NOM_MOTEUR_LOCAL, NOM_REFERENCE, ORDRE_MOTEURS_LOCAUX, moteursSonores, stylesLocaux, workflows,
  type MoteurSonore, type StyleLocal,
} from "../api-workflows"
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
export type EtatBadge = EtatMachine | "indisponible" | "cle-manquante"

const BADGE: Record<EtatBadge, { texte: string; classe: string }> = {
  installe: { texte: "Installé", classe: "border-trait-ok bg-fond-ok text-encre-ok" },
  "a-installer": { texte: "À installer", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  manque: { texte: "Fichiers manquants", classe: "border-trait bg-papier-cote text-encre-3" },
  indisponible: { texte: "Indisponible", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
  // MO3 : un moteur vidéo en ligne sans sa clé le dit par son nom.
  "cle-manquante": { texte: "Clé manquante", classe: "border-trait-attention bg-fond-attention text-encre-attention" },
}

export function Badge({ etat }: { etat: EtatBadge }) {
  const b = BADGE[etat]
  return <span className={`ml-auto inline-flex h-[22px] shrink-0 items-center rounded-5 border px-[8px] text-[12px] whitespace-nowrap ${b.classe}`}>{b.texte}</span>
}

export function PageDesMoteurs({
  modeles,
  signale,
  onSignale,
  onInstallation,
  onInstallationSon,
}: {
  /** Le catalogue d'images déjà lu par l'atelier (`App.tsx`) — la même liste
   *  que la barre qui paie et la fabrique Repeindre, jamais une seconde
   *  lecture d'ici. */
  modeles: Modele[]
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
