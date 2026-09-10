// Les mouvements — **ce que la même pose dit quand on l'anime** (A6, V3).
//
// Le produit savait déjà dire une pose : la case « marche » d'un plan sait
// qu'elle s'écrit `walking posture, full body`. C'est une **posture figée**,
// juste pour une image et fausse pour un clip. Ce qui manquait n'est pas une
// liste de plus — deux listes concurrentes finiraient par diverger, et l'auteur
// découvrirait l'écart sur une case, un jour, sans savoir laquelle des deux
// ment. Le lien se fait donc **par l'identifiant**, et rien n'est relié à la
// main.
//
// **Pourquoi ce panneau est dans les Réglages, et pas dans l'univers d'un jeu.**
// Un mouvement appartient à l'atelier, pas à un projet — c'est la décision
// durable de la V3, et c'est exactement ce que l'écran des Réglages tient
// depuis T1 : ce qui ne dépend d'aucun jeu. La clé du fournisseur, les
// garde-fous de l'agent, le dossier du jeu, et maintenant le vocabulaire du
// mouvement. **On l'écrit ici, on le choisit ailleurs** — l'écran qui commande
// un clip ne fait que le lire, et deux endroits qui écriraient la même liste
// finiraient par en montrer deux.
//
// **Rien ici n'appelle personne et rien ici ne coûte** : c'est du vocabulaire,
// il s'écrit sur le disque, et tout y marche réseau coupé.

import { useEffect, useState } from "react"
import { api, type BaseMouvements, type Mouvement } from "../api"
import { Bouton, Libelle, Raison } from "./chassis"

const CHAMP =
  "mesure h-[30px] min-w-0 rounded-[2px] border border-contour bg-carte px-2 text-[11px] text-encre placeholder:text-eteint"

export function BlocMouvements() {
  const [base, setBase] = useState<BaseMouvements | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  // Lequel est ouvert en édition. **Un seul à la fois** : deux lignes dépliées
  // dans un panneau de 520 px feraient perdre la liste de vue, et le geste
  // courant ici est de lire, pas de corriger.
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [fabrique, setFabrique] = useState(false)

  useEffect(() => {
    api
      .mouvements()
      .then(setBase)
      .catch(() => setBase({ mouvements: [], masques: [] }))
  }, [])

  const poser = async (promesse: Promise<BaseMouvements>) => {
    setRefus(null)
    try {
      setBase(await promesse)
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "geste refusé")
    }
  }

  if (!base) return null

  return (
    <>
      <Titre>Les mouvements</Titre>
      <p className="text-[12.5px] leading-relaxed text-encre-2">
        Un mouvement dit <strong className="text-encre">ce qu'une pose devient
        quand on l'anime</strong> : un cycle qui boucle au lieu d'une attitude
        figée, une cadence, et les directions où il a un sens. Une case du plan
        de poses hérite du mouvement qui porte son nom, sans rien relier à la
        main — et deux clips du même mouvement partent avec exactement le même
        texte.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-encre-2">
        Cette liste-ci <strong className="text-encre">appartient à l'atelier</strong>,
        pas à un jeu : elle suit tous les projets suivants. Rien ici ne part
        chez un fournisseur et rien ici ne coûte.
      </p>

      <ul className="mt-3 flex flex-col gap-px">
        {base.mouvements.map((mouvement) => (
          <Ligne
            key={mouvement.identifiant}
            mouvement={mouvement}
            ouvert={ouvert === mouvement.identifiant}
            onOuvrir={() =>
              setOuvert(ouvert === mouvement.identifiant ? null : mouvement.identifiant)
            }
            onRegler={(champs) =>
              poser(api.reglerMouvement(mouvement.identifiant, champs))
            }
            onMasquer={() => {
              setOuvert(null)
              return poser(api.masquerMouvement(mouvement.identifiant))
            }}
          />
        ))}
      </ul>

      {/* Les masqués — **la seule liste où ils paraissent**, et elle existe pour
          une raison : sans elle, masquer serait irréversible, et un geste
          irréversible sur du vocabulaire livré n'a aucune raison d'être. */}
      {base.masques.length > 0 && (
        <p className="mesure mt-2 flex flex-wrap items-center gap-2 text-[10px] text-encre-3">
          <span>masqués</span>
          {base.masques.map((mouvement) => (
            <button
              key={mouvement.identifiant}
              type="button"
              onClick={() => poser(api.montrerMouvement(mouvement.identifiant))}
              className="rounded-[2px] border border-trait px-1.5 py-0.5 text-encre-2 hover:text-signal"
            >
              {mouvement.nom} · remontrer
            </button>
          ))}
        </p>
      )}

      <Raison texte={refus} papier />

      {fabrique ? (
        <Fabrique
          onFermer={() => setFabrique(false)}
          onPoser={async (nom, texte, cadence) => {
            await poser(api.fabriquerMouvement(nom, texte, cadence))
            setFabrique(false)
          }}
        />
      ) : (
        <div className="mt-3">
          <Bouton papier onClick={() => setFabrique(true)} enfants="Nommer un mouvement" />
        </div>
      )}
    </>
  )
}

/** Le titre d'un bloc — **la même forme que les trois autres blocs de l'écran**.
 *
 *  Recopié plutôt qu'importé pour une raison bête et suffisante : le titre est
 *  privé à l'écran des Réglages, et l'exporter pour un seul appelant ferait
 *  d'un détail de mise en page une pièce du châssis. Les majuscules à `.11em`
 *  disent « section » partout dans le produit ; aucune typographie neuve ici. */
function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mesure mt-7 mb-3 border-b border-trait pb-1.5 text-[9.5px] tracking-[.11em] text-encre-3 uppercase">
      {children}
    </h3>
  )
}

function Ligne({
  mouvement,
  ouvert,
  onOuvrir,
  onRegler,
  onMasquer,
}: {
  mouvement: Mouvement
  ouvert: boolean
  onOuvrir: () => void
  onRegler: (champs: {
    nom?: string
    texte?: string
    cadence?: number
  }) => Promise<void>
  onMasquer: () => Promise<void>
}) {
  const [nom, setNom] = useState(mouvement.nom)
  const [texte, setTexte] = useState(mouvement.texte)
  const [cadence, setCadence] = useState(String(mouvement.cadence))

  // Rouvrir une ligne repart de ce que le serveur dit, jamais de ce qu'on avait
  // tapé et abandonné : un champ qui garde une frappe annulée ment.
  useEffect(() => {
    if (!ouvert) {
      setNom(mouvement.nom)
      setTexte(mouvement.texte)
      setCadence(String(mouvement.cadence))
    }
  }, [ouvert, mouvement])

  const change =
    nom.trim() !== mouvement.nom ||
    texte.trim() !== mouvement.texte ||
    Number(cadence) !== mouvement.cadence

  return (
    <li className="rounded-[2px] border border-trait bg-carte px-2.5 py-1.5">
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={onOuvrir}
          aria-expanded={ouvert}
          className="text-[12.5px] text-encre hover:text-signal"
        >
          {mouvement.nom}
        </button>
        {/* **La marque de ce que l'auteur a nommé lui-même**, comme partout
            ailleurs dans le produit. Un livré est le même chez tout le monde ;
            un fabriqué n'existe que dans cet atelier-ci. */}
        {!mouvement.livre && (
          <span className="mesure text-[9px] tracking-[.08em] text-epingle uppercase">
            nommé ici
          </span>
        )}
        <span className="mesure ml-auto text-[10px] text-encre-3">
          {mouvement.cadence} i/s
          {mouvement.directions.length > 0 &&
            ` · ${mouvement.directions.join(", ")}`}
        </span>
      </div>

      {/* Le texte anglais est visible sans déplier : **c'est lui qui part**, et
          c'est la seule chose que l'auteur vient vérifier ici. */}
      <p className="mesure mt-0.5 truncate text-[10px] text-encre-3" title={mouvement.texte}>
        {mouvement.texte}
      </p>

      {ouvert && (
        <div className="mt-2 flex flex-col gap-2 border-t border-trait pt-2">
          <label className="flex flex-col gap-1">
            <Libelle aide="mouvement.nom" papier>Nom</Libelle>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Libelle aide="mouvement.texte" papier>Ce qui part au modèle</Libelle>
            <textarea
              value={texte}
              rows={2}
              onChange={(e) => setTexte(e.target.value)}
              className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
            />
          </label>
          <label className="flex items-baseline gap-2">
            <Libelle aide="mouvement.cadence" papier>Cadence</Libelle>
            <input
              value={cadence}
              inputMode="decimal"
              onChange={(e) => setCadence(e.target.value)}
              className={`${CHAMP} w-[64px]`}
            />
            <span className="mesure text-[10px] text-encre-3">images par seconde</span>
          </label>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => void onMasquer()}
              className="mesure text-[10px] text-encre-3 hover:text-signal"
            >
              {mouvement.livre ? "masquer — il se remontre" : "masquer — il s'en va"}
            </button>
            <Bouton
              papier
              inactif={!change}
              principal
              onClick={() =>
                void onRegler({
                  nom: nom.trim(),
                  texte: texte.trim(),
                  cadence: Number(cadence) || undefined,
                })
              }
              enfants="Poser"
            />
          </div>
        </div>
      )}
    </li>
  )
}

function Fabrique({
  onPoser,
  onFermer,
}: {
  onPoser: (nom: string, texte: string, cadence?: number) => Promise<void>
  onFermer: () => void
}) {
  const [nom, setNom] = useState("")
  const [texte, setTexte] = useState("")
  const [cadence, setCadence] = useState("")
  // **Les deux textes sont la définition** : un mouvement sans texte anglais ne
  // fait rien partir, un mouvement sans nom ne se clique pas. Le bouton le dit
  // avant que le serveur ait à le refuser.
  const complet = nom.trim().length > 0 && texte.trim().length > 0

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[2px] border border-contour bg-carte p-2.5">
      <label className="flex flex-col gap-1">
        <Libelle aide="mouvement.nom" papier>Nom</Libelle>
        <input
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="nage"
          className={CHAMP}
        />
      </label>
      <label className="flex flex-col gap-1">
        <Libelle aide="mouvement.texte" papier>Ce qui part au modèle</Libelle>
        <textarea
          value={texte}
          rows={2}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="swimming cycle, arms stroking, looping seamlessly"
          className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
        />
      </label>
      <label className="flex items-baseline gap-2">
        <Libelle aide="mouvement.cadence" papier>Cadence</Libelle>
        <input
          value={cadence}
          inputMode="decimal"
          placeholder="12"
          onChange={(e) => setCadence(e.target.value)}
          className={`${CHAMP} w-[64px]`}
        />
        <span className="mesure text-[10px] text-encre-3">images par seconde</span>
      </label>
      <div className="flex justify-end gap-2">
        <Bouton papier onClick={onFermer} enfants="Laisser" />
        <Bouton
          papier
          principal
          inactif={!complet}
          onClick={() =>
            void onPoser(nom.trim(), texte.trim(), Number(cadence) || undefined)
          }
          enfants="Nommer"
        />
      </div>
    </div>
  )
}
