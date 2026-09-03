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

import { Fragment, useEffect, useState } from "react"
import {
  api,
  dollars,
  estArgent,
  quantite,
  type EtatAgent,
  type Modele,
  type Tiroir,
  type GardeFous,
} from "../api"
import { Bouton, Curseur, Libelle, libelleModele, Raison } from "./chassis"
import { nomDuModele } from "./Fiche"
import { TiroirDesSecrets } from "./Secrets"
import { PANNEAU } from "./Infobulle"

export function EcranReglages({
  tiroirs,
  agent,
  modeles,
  onDeposee,
  onAgent,
  onFermer,
}: {
  /** **Une place par fournisseur** (F3) — le même objet que rend l'étape « Les
   *  fournisseurs » de l'assistant, et le même composant le dessine : trois
   *  portes, une seule pièce. */
  tiroirs: Tiroir[]
  /** Le cadre et la consommation, tels que le serveur les sert. **Jamais
   *  recalculés ici** : le refus opposé à l'agent et le chiffre lu par l'auteur
   *  doivent être le même calcul. */
  agent: EtatAgent
  /** Le catalogue entier. **L'écran n'en garde que les gratuits** (F6), et il
   *  le fait au moment de proposer plutôt qu'en amont : c'est ce réglage-ci qui
   *  a la règle, et la lui prendre en ferait deux endroits à tenir d'accord. */
  modeles: Modele[]
  onDeposee: () => void
  onAgent: (agent: EtatAgent) => void
  onFermer: () => void
}) {
  // **Échap ferme les Réglages** — ajouté le 31 août 2026. Le Guide et la
  // vitrine le faisaient déjà, et tous deux l'écrivent sur leur bouton de
  // sortie : c'est donc une règle du produit, et ce panneau-ci était l'un des
  // deux qui ne la tenaient pas. Il ne se fermait qu'en cliquant à côté — un
  // geste qui ne s'annonce nulle part et qu'on ne devine pas.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  return (
    <div
      data-reglages
      className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-fond-0/70 py-[8vh]"
      onClick={onFermer}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        {...PANNEAU}
        // **Déclaré comme une fenêtre posée par-dessus.** Sans ces trois mots,
        // un lecteur d'écran continue d'annoncer la page du dessous comme si
        // elle était encore atteignable.
        role="dialog"
        aria-modal="true"
        aria-label="Réglages"
        className="w-[520px] rounded-[3px] border border-bord bg-fond-1 p-6"
      >
        <h2 className="font-serif text-[24px] leading-tight text-texte">Réglages</h2>

        <BlocSecrets tiroirs={tiroirs} onDeposee={onDeposee} />
        <BlocAgent agent={agent} modeles={modeles} onAgent={onAgent} />
        <BlocDossiers agent={agent} onAgent={onAgent} />

        {/* Le bouton dit la touche, comme celui du Guide et celui de la
            vitrine : une sortie au clavier qui ne s'écrit nulle part ne se
            trouve pas. */}
        <div className="mt-6 flex justify-end">
          <Bouton onClick={onFermer} enfants="Fermer — Échap" />
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

// ── Le tiroir à secrets (F3) ────────────────────────────────────────────────

function BlocSecrets({
  tiroirs,
  onDeposee,
}: {
  tiroirs: Tiroir[]
  onDeposee: () => void
}) {
  return (
    <>
      <Titre>Les fournisseurs</Titre>
      <p className="text-[12.5px] leading-relaxed text-texte-2">
        Ce qu'un fournisseur demande se dépose une fois, et l'atelier ne le
        réaffiche plus jamais. Tout est écrit dans{" "}
        <span className="mesure text-[11px] text-texte">.env</span>, qui n'est
        jamais versionné.{" "}
        <strong className="text-texte">Déposer chez l'un ne touche à aucun autre</strong>,
        et retirer ne grise que ses modèles : ses images et ses lignes de dépense
        restent.
      </p>

      <div className="mt-3">
        <TiroirDesSecrets tiroirs={tiroirs} onChange={() => onDeposee()} />
      </div>
    </>
  )
}

// ── L'agent ─────────────────────────────────────────────────────────────────

function BlocAgent({
  agent,
  modeles,
  onAgent,
}: {
  agent: EtatAgent
  modeles: Modele[]
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
        {/* « dépensé par l'agent », et pas « dépensé » — corrigé le 31 août 2026
            (E0). Ce montant ne compte que les appels venus du serveur MCP, et
            un montant qui laisse deviner sa portée finit lu comme le total de
            tout. Le produit en compte deux autres — celui du jeu ouvert, celui
            de toutes les séances —, et chacun porte son étiquette. */}
        <dt className="text-texte-3">dépensé par l'agent</dt>
        <dd className="text-texte-2">{dollars(compte.depense_usd)}</dd>
        {/* **Et ce qu'il a consommé sans argent, compté à part** (F2). Sans
            cette ligne, une séance entière passée chez un fournisseur gratuit
            se lisait « $0,0000 » — c'est-à-dire comme une séance sans un seul
            appel. Absente tant qu'il n'a travaillé que chez un payant. */}
        {compte.consomme.map((ligne) => (
          <Fragment key={ligne.unite}>
            <dt className="text-texte-3">consommé sans argent</dt>
            <dd className="text-texte-2">
              {quantite(ligne.quantite, ligne.unite)}
            </dd>
          </Fragment>
        ))}
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
          libelle="le plafond de la séance"
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
        {/* **Le nom seulement quand la liste ne le porte pas** (F6). La liste
            ci-dessous marque le modèle choisi ; l'écrire aussi au-dessus ferait
            deux endroits à tenir d'accord pour une seule valeur, et ils se
            liraient à trois centimètres l'un de l'autre. Il reste utile dans le
            cas contraire : un garde-fou posé avant F6 porte un modèle payant,
            et un modèle dont le fournisseur ne répond plus n'est plus proposé —
            dans les deux cas, ce qui est imposé doit se lire quelque part. */}
        {!modeles.some((m) => m.identifiant === cadre.modele) && (
          <p className="mesure text-[10px] leading-4 text-texte-3" title={cadre.modele}>
            {/* Le fournisseur devant, comme partout ailleurs (F1) : ce réglage
                impose un modèle, et un modèle se nomme par deux choses. */}
            {nomDuModele(cadre.modele)}
            {Object.entries(cadre.options).map(([nom, valeur]) => (
              <span key={nom}> · {nom} {valeur}</span>
            ))}
          </p>
        )}

        <ChoixDuGratuit
          modeles={modeles}
          choisi={cadre.modele}
          eteint={!cadre.modele_actif}
          onChoisir={(modele) => void poser({ modele })}
        />
      </div>

      <Raison texte={refus} />
    </>
  )
}

/**
 * Parmi quoi le modèle d'exploration se choisit — **les gratuits, et eux seuls**
 * (F6).
 *
 * **Ce garde-fou n'était pas réglable, et il se lisait comme un fait du
 * produit.** L'écran l'affichait ; on ne pouvait qu'éteindre l'interrupteur,
 * c'est-à-dire rendre la main à l'agent. Depuis que le modèle imposé ne coûte
 * plus rien, le choix a un sens : deux fournisseurs gratuits ne rendent pas la
 * même image, et l'auteur est le seul à savoir lequel lui parle.
 *
 * **La liste ne contient aucun modèle payant, et ce n'est pas un filtre
 * d'affichage** : c'est ce que le garde-fou *est*. Un « modèle d'exploration »
 * qui pourrait être le plus cher du catalogue ne protégerait de rien, et le
 * seul moyen honnête de dire ça à l'écran est de ne pas les proposer. Pour
 * imposer un payant, on éteint l'interrupteur — l'agent nomme alors ce qu'il
 * veut, et c'est un autre réglage.
 *
 * **Une liste vide se dit.** Un atelier composé sans fournisseur gratuit est un
 * état légitime ; l'écran l'écrit plutôt que d'afficher un cadre vide dont on
 * ne saurait pas s'il charge encore.
 */
function ChoixDuGratuit({
  modeles,
  choisi,
  eteint,
  onChoisir,
}: {
  modeles: Modele[]
  choisi: string
  eteint: boolean
  onChoisir: (modele: string) => void
}) {
  // **Le serveur dit l'unité, l'écran ne la devine pas** (F2). Un tarif à zéro
  // ne veut pas dire gratuit : il veut dire *jamais appelé*.
  const gratuits = modeles.filter((m) => !estArgent(m.unite) && !m.refus)
  if (gratuits.length === 0)
    return (
      <p className="mesure text-[10px] leading-4 text-texte-3">
        aucun modèle gratuit dans cet atelier — le garde-fou n'a rien à imposer
      </p>
    )

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {gratuits.map((modele) => (
        <button
          key={modele.identifiant}
          type="button"
          disabled={eteint}
          onClick={() => onChoisir(modele.identifiant)}
          aria-pressed={modele.identifiant === choisi}
          title={modele.identifiant}
          className={[
            "mesure h-[24px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
            modele.identifiant === choisi
              ? "border-signal bg-fond-3 text-texte"
              : "border-bord bg-fond-2 text-texte-3 hover:bg-fond-3",
            eteint ? "opacity-40" : "",
          ].join(" ")}
        >
          {libelleModele(modele)}
        </button>
      ))}
    </div>
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
            className="mesure h-[34px] min-w-0 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11px] text-texte placeholder:text-texte-3"
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
