/**
 * Les réglages — **une seule porte, quatre onglets** (`RP2`).
 *
 * La maquette validée le 12 septembre 2026 ne connaît qu'un mot *Réglages*, et
 * il ouvre quatre onglets : Univers · Moteurs & workflows · Agent MCP ·
 * Consommations (`docs/releves/2026-09-13-carte-de-la-maquette.md` § Réglages).
 * Le produit, lui, en avait cinq endroits — dont **deux qu'aucun clic
 * n'atteignait** :
 *
 * - les quatre questions du jeu (`ReglesDuJeu` en mode `reglages`) — celles qui
 *   partent dans chaque demande d'image ; `setReglesOuvertes(true)` n'était
 *   appelé nulle part ;
 * - le cadre de délégation (`DelegationDuJeu`) — **le seul écran d'où l'on
 *   borne ce que l'agent a le droit de dépenser** ; rien n'écrivait jamais son
 *   lieu.
 *
 * **Cet écran ne réécrit rien : il range.** Chaque onglet monte ce qui existait
 * déjà, tel quel. C'est pour ça qu'il est court, et c'est ce qui garantit qu'on
 * n'a rien perdu en chemin.
 *
 * ⚠️ **Il ne paie pas.** Il pose des bornes — plafonds, modèles autorisés,
 * règles du jeu — et il n'ouvre aucun chemin d'envoi : les deux lieux d'où
 * l'argent part restent deux. `ProfilsWorkflow` est monté **sans ses trois
 * rappels** (`onImage`, `onVideo`, `onAudio`), donc son bouton « Utiliser ce
 * workflow » ne paraît pas ici : un réglage ne lance pas une fabrication.
 */

import { useEffect, useState } from "react"

import type { EtatAgent, EtatTraitement, Modele, Tiroir } from "../api"
import { DelegationDuJeu } from "./DelegationDuJeu"
import { EcranDepenses } from "./Depenses"
import { PANNEAU } from "./Infobulle"
import { PageDesMoteurs } from "./Moteurs"
import { Bouton } from "./pieces"
import {
  BlocAgent,
  BlocDossiers,
  BlocSecrets,
  ReglesDuJeu,
  TitreDeLAtelier,
} from "./ReglesDuJeu"
import { ProfilsWorkflow } from "./WorkflowsLocaux"

/** Les quatre onglets, dans l'ordre de la maquette. **La liste est fermée** :
 *  un cinquième onglet serait une porte de plus vers les réglages, et c'est
 *  exactement ce que la tranche vient de refermer. */
export type OngletDesReglages = "univers" | "moteurs" | "agent" | "consommations"

const ONGLETS: readonly { clef: OngletDesReglages; titre: string }[] = [
  { clef: "univers", titre: "Univers" },
  { clef: "moteurs", titre: "Moteurs & workflows" },
  { clef: "agent", titre: "Agent MCP" },
  { clef: "consommations", titre: "Consommations" },
]

export function Reglages({
  onglet,
  onOnglet,
  nomDuJeu,
  dossierDuJeu,
  tiroirs,
  agent,
  modeles,
  traitement,
  onDeposee,
  onAgent,
  onRenomme,
  onInstallation,
  onTravail,
  onFerme,
  onErreur,
  moteurASignaler = null,
  onMoteurSignale,
}: {
  onglet: OngletDesReglages
  onOnglet: (onglet: OngletDesReglages) => void
  /** Le nom du jeu ouvert, et son dossier — `null` s'il n'y en a pas. */
  nomDuJeu: string
  dossierDuJeu: string | null
  /** L'état de l'atelier, `null` tant qu'il n'est pas arrivé. */
  tiroirs: Tiroir[] | null
  agent: EtatAgent | null
  modeles: Modele[]
  /** MO5 : le catalogue des cinq modèles de détourage (`traitement.
   *  silhouettes`) — la page « Moteurs » le montre, elle ne le relit pas. */
  traitement?: EtatTraitement | null
  onDeposee: () => void
  onAgent: (agent: EtatAgent) => void
  onRenomme: () => void
  /** L'installation de la machine — un écran à elle, et le seul qui ne parle
   *  d'aucun jeu. L'onglet des moteurs y mène ; on en revient ici. */
  onInstallation: () => void
  onTravail: (identifiant: string) => void
  onFerme: () => void
  onErreur: (raison: string) => void
  /** MO2 : le moteur vers lequel un outil (Créer, Repeindre) vient de
   *  renvoyer — la page « Moteurs » y défile et le met en évidence un
   *  instant. `null` sans renvoi en cours ; absent, pareil. */
  moteurASignaler?: string | null
  /** Le signalement consommé — l'appelant (`App.tsx`) l'efface une fois
   *  l'effet joué. Sans `moteurASignaler`, jamais appelé. */
  onMoteurSignale?: () => void
}) {
  // Échap referme les réglages, d'où qu'on soit dans les quatre onglets — la
  // règle du produit. `defaultPrevented` laisse la main à ce qui est posé
  // par-dessus : une fenêtre ouverte se ferme avant l'écran qui la porte.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      onFerme()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFerme])

  return (
    <div
      data-reglages
      className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-papier"
    >
      <nav
        aria-label="Réglages"
        className="flex shrink-0 items-center gap-[4px] border-b border-trait px-[30px] py-[8px]"
      >
        {ONGLETS.map((sien) => (
          <button
            key={sien.clef}
            type="button"
            aria-current={onglet === sien.clef}
            data-onglet-des-reglages={sien.clef}
            onClick={() => onOnglet(sien.clef)}
            className={[
              "flex h-[30px] items-center rounded-7 px-[14px] text-[13px] transition-colors duration-120",
              onglet === sien.clef
                ? "bg-papier-cote font-medium text-encre"
                : "text-encre-3 hover:text-encre",
            ].join(" ")}
          >
            {sien.titre}
          </button>
        ))}
        <button
          type="button"
          onClick={onFerme}
          className="ml-auto h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
        >
          Fermer les réglages — Échap
        </button>
      </nav>

      {/* ── 1 · Univers ────────────────────────────────────────────────────
          **Les quatre réglages qui partent dans chaque demande d'image** : le
          nom du jeu, son allure, sa vue, son monde. C'est le même écran qu'à la
          création du jeu, dans son autre mode — les quatre questions ne sont
          écrites qu'une fois. */}
      {onglet === "univers" && (
        <ReglesDuJeu
          mode="reglages"
          nomDuJeu={nomDuJeu}
          dossierDuJeu={dossierDuJeu}
          onCree={() => undefined}
          onRenomme={onRenomme}
          onFerme={onFerme}
          onErreur={onErreur}
        />
      )}

      {onglet === "moteurs" && (
        <MoteursEtWorkflows
          tiroirs={tiroirs}
          modeles={modeles}
          traitement={traitement}
          onDeposee={onDeposee}
          onInstallation={onInstallation}
          moteurASignaler={moteurASignaler}
          onMoteurSignale={onMoteurSignale ?? (() => undefined)}
        />
      )}

      {onglet === "agent" && (
        <AgentMcp
          dossierDuJeu={dossierDuJeu}
          agent={agent}
          modeles={modeles}
          onAgent={onAgent}
          onMoteurs={() => onOnglet("moteurs")}
          onTravail={onTravail}
        />
      )}

      {/* ── 4 · Consommations ──────────────────────────────────────────────
          Ce qui a été dépensé, tel que l'écran des dépenses le montre déjà :
          gardé, payé pour rien, refusé. Il porte sa propre sortie. */}
      {onglet === "consommations" && (
        <EcranDepenses
          projetCourant={dossierDuJeu}
          onErreur={onErreur}
          onFermer={onFerme}
        />
      )}
    </div>
  )
}

// ── 2 · Moteurs & workflows ─────────────────────────────────────────────────

/**
 * Avec quoi on fabrique : les comptes chez les fournisseurs, la page des
 * moteurs d'image (MO2), la machine, et les méthodes locales qu'on a nommées.
 *
 * **L'installation garde son écran à elle** et ne s'ouvre pas dans l'onglet :
 * c'est le seul lieu du produit qui ne parle d'aucun jeu — une clé, un dossier
 * de travail et ComfyUI valent pour tous —, et il porte quatre étapes qui se
 * déroulent aussi au premier lancement. On en revient ici.
 *
 * **MO2 : `PageDesMoteurs` vient juste après les clés**, pas à la place des
 * sections qui suivent. Elle remplace la gestion des vingt-deux styles de
 * sc-clone que `ProfilsWorkflow` montrait jusque-là (`StylesDeScClone`,
 * fondue ici — une seule page qui les décrit, pas deux) ; « La machine » (le
 * bouton d'installation) et « Les workflows locaux » (les profils importés à
 * la main, vidéo et son compris) restent ce qu'ils étaient : cette tranche ne
 * couvre que l'image.
 *
 * **MO4 : la section « Le son » de `PageDesMoteurs` fond « Les méthodes
 * sonores » du même geste** — même chose, un même écran qui les décrit tous.
 * `onInstallationSon` relaie l'installation d'un moteur sonore jusqu'ici,
 * pour que « Les workflows locaux » juste en dessous relise ses profils à son
 * tour (SN1) : c'est la même mécanique qu'avant, juste déclenchée d'un
 * endroit différent.
 */
function MoteursEtWorkflows({
  tiroirs,
  modeles,
  traitement,
  onDeposee,
  onInstallation,
  moteurASignaler,
  onMoteurSignale,
}: {
  tiroirs: Tiroir[] | null
  modeles: Modele[]
  traitement?: EtatTraitement | null
  onDeposee: () => void
  onInstallation: () => void
  moteurASignaler: string | null
  onMoteurSignale: () => void
}) {
  // Change à chaque installation de méthodes sonores, pour que « Les
  // workflows locaux » juste au-dessus relise ses profils à son tour (SN1).
  const [actualisationSon, setActualisationSon] = useState(0)
  return (
    <main
      aria-label="Moteurs & workflows"
      className="defile min-h-0 min-w-0 overflow-y-auto bg-papier px-[30px] py-[22px]"
    >
      <div className="flex max-w-[880px] flex-col">
        {tiroirs === null ? (
          <p className="text-[13px] text-encre-3">Les fournisseurs se chargent…</p>
        ) : (
          <section {...PANNEAU} className="flex flex-col">
            <BlocSecrets tiroirs={tiroirs} onDeposee={onDeposee} />
          </section>
        )}

        <div className="mt-[34px]">
          <PageDesMoteurs
            modeles={modeles}
            traitement={traitement}
            signale={moteurASignaler}
            onSignale={onMoteurSignale}
            onInstallation={onInstallation}
            onInstallationSon={() => setActualisationSon((n) => n + 1)}
          />
        </div>

        <section className="mt-[34px] flex flex-col">
          <TitreDeLAtelier>La machine</TitreDeLAtelier>
          <p className="text-[12.5px] leading-[1.5] text-encre-2">
            ComfyUI, le dossier où tout se range et ce que cette machine sait
            faire se branchent une fois, pour tous les jeux.
          </p>
          <div className="mt-[14px]">
            <Bouton onClick={onInstallation} enfants="Ouvrir l'installation" />
          </div>
        </section>

        {/* Les workflows locaux portent déjà leur titre : en poser un second
            au-dessus ferait lire deux sections là où il n'y en a qu'une. */}
        <div className="mt-[34px]">
          <ProfilsWorkflow actualiserSur={actualisationSon} />
        </div>
      </div>
    </main>
  )
}

// ── 3 · Agent MCP ───────────────────────────────────────────────────────────

/**
 * Ce que l'agent a le droit de faire, et ce qu'il a fait.
 *
 * **Les deux cadres ne se recouvrent pas**, et c'est pour ça qu'ils sont tous
 * les deux ici :
 *
 * - `DelegationDuJeu` borne **une demande complète** de l'agent — plafond
 *   d'appels, plafond en argent, droit de payer, droit d'appeler la machine,
 *   modèles autorisés par type de résultat. Il est propre à ce jeu-ci.
 * - « L'agent » et « Les dossiers » bornent **la séance** — le plafond
 *   d'images, le modèle d'exploration imposé, le dossier où l'agent dépose.
 *
 * « Les mouvements » était rangé ici faute de place ; il est passé le
 * 18 septembre 2026 dans l'onglet Univers, avec les phrases des directions.
 */
function AgentMcp({
  dossierDuJeu,
  agent,
  modeles,
  onAgent,
  onMoteurs,
  onTravail,
}: {
  dossierDuJeu: string | null
  agent: EtatAgent | null
  modeles: Modele[]
  onAgent: (agent: EtatAgent) => void
  onMoteurs: () => void
  onTravail: (identifiant: string) => void
}) {
  return (
    <main
      aria-label="Agent MCP"
      className="defile min-h-0 min-w-0 overflow-y-auto bg-papier px-[30px] py-[22px]"
    >
      <div className="flex max-w-[880px] flex-col gap-[34px]">
        {dossierDuJeu ? (
          <DelegationDuJeu
            projet={dossierDuJeu}
            onAtelier={onMoteurs}
            onTravail={(travail) => onTravail(travail.identifiant)}
          />
        ) : (
          <p className="text-[13px] text-encre-3">
            Le cadre de délégation appartient à un jeu ; ouvre-en un pour le
            régler.
          </p>
        )}

        {agent === null ? (
          <p className="text-[13px] text-encre-3">Les garde-fous se chargent…</p>
        ) : (
          <section {...PANNEAU} className="flex flex-col">
            <BlocAgent agent={agent} modeles={modeles} onAgent={onAgent} />
            <BlocDossiers agent={agent} onAgent={onAgent} />
          </section>
        )}
      </div>
    </main>
  )
}
