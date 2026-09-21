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
import {
  api,
  type BaseMouvements,
  type BaseStyles,
  type Direction,
  type DirectionsDuJeu,
  type Mouvement,
  type StyleDeCombat,
} from "../api"
import { Bouton, Libelle, Raison } from "./pieces"

const CHAMP =
  "mesure h-[30px] min-w-0 rounded-[2px] border border-contour bg-carte px-2 text-[11px] text-encre placeholder:text-eteint"

export function BlocMouvements({ projet }: { projet: string | null }) {
  const [base, setBase] = useState<BaseMouvements | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  // Lequel est ouvert en édition. **Un seul à la fois** : deux lignes dépliées
  // dans un panneau de 520 px feraient perdre la liste de vue, et le geste
  // courant ici est de lire, pas de corriger.
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [fabrique, setFabrique] = useState(false)

  useEffect(() => {
    let vivant = true
    setOuvert(null)
    api
      .mouvements(projet)
      .then((recu) => vivant && setBase(recu))
      .catch(() => vivant && setBase({ mouvements: [], masques: [] }))
    return () => {
      vivant = false
    }
  }, [projet])

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
        Le texte anglais envoyé au modèle vidéo quand on anime une pose du même
        nom. La phrase de la direction (bloc du dessus) se place devant.
      </p>
      <p data-mouvements-du-jeu className="mt-2 text-[12.5px] leading-relaxed text-encre-2">
        {base.propres_au_jeu
          ? "Ce jeu a ses propres textes."
          : "Ce jeu utilise les textes de départ de l'atelier. Ta première modification lui en fait une copie : les autres jeux ne changent pas."}
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
              poser(api.reglerMouvement(mouvement.identifiant, champs, projet))
            }
            onMasquer={() => {
              setOuvert(null)
              return poser(api.masquerMouvement(mouvement.identifiant, projet))
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
              onClick={() => poser(api.montrerMouvement(mouvement.identifiant, projet))}
              className="rounded-[2px] border border-trait px-1.5 py-0.5 text-encre-2 hover:text-signal"
            >
              {mouvement.nom} · remontrer
            </button>
          ))}
        </p>
      )}

      <Raison texte={refus} />

      {fabrique ? (
        <Fabrique
          onFermer={() => setFabrique(false)}
          onPoser={async (nom, texte, cadence) => {
            await poser(api.fabriquerMouvement(nom, texte, cadence, undefined, projet))
            setFabrique(false)
          }}
        />
      ) : (
        <div className="mt-3">
          <Bouton onClick={() => setFabrique(true)} enfants="Nommer un mouvement" />
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
        <button
          type="button"
          onClick={onOuvrir}
          className="mesure rounded-[2px] border border-trait px-1.5 py-0.5 text-[10px] text-encre-2 hover:text-signal"
        >
          {ouvert ? "fermer" : "modifier"}
        </button>
      </div>

      {/* Le texte anglais est visible sans déplier : **c'est lui qui part**, et
          c'est la seule chose que l'auteur vient vérifier ici. */}
      <p className="mesure mt-0.5 truncate text-[10px] text-encre-3" title={mouvement.texte}>
        {mouvement.texte}
      </p>

      {ouvert && (
        <div className="mt-2 flex flex-col gap-2 border-t border-trait pt-2">
          <label className="flex flex-col gap-1">
            <Libelle aide="mouvement.nom">Nom</Libelle>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Libelle aide="mouvement.texte">Ce qui part au modèle</Libelle>
            <textarea
              value={texte}
              rows={2}
              onChange={(e) => setTexte(e.target.value)}
              className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
            />
          </label>
          <label className="flex items-baseline gap-2">
            <Libelle aide="mouvement.cadence">Cadence</Libelle>
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
        <Libelle aide="mouvement.nom">Nom</Libelle>
        <input
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="nage"
          className={CHAMP}
        />
      </label>
      <label className="flex flex-col gap-1">
        <Libelle aide="mouvement.texte">Ce qui part au modèle</Libelle>
        <textarea
          value={texte}
          rows={2}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="swimming cycle, arms stroking, looping seamlessly"
          className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
        />
      </label>
      <label className="flex items-baseline gap-2">
        <Libelle aide="mouvement.cadence">Cadence</Libelle>
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
        <Bouton onClick={onFermer} enfants="Laisser" />
        <Bouton
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

/** Les directions en animation (18 septembre 2026) — **la phrase qui part en
 *  tête de chaque clip**, écrite une fois pour tout le jeu.
 *
 *  L'auteur tapait à la main *The character is shown from behind* pour qu'une
 *  course vers le nord garde le dos du personnage. Le champ montre en grisé la
 *  phrase livrée : c'est elle qui part tant qu'on n'a rien écrit, et vider le
 *  champ la remet. */
export function BlocDirectionsAnimees() {
  const [lu, setLu] = useState<DirectionsDuJeu | null>(null)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    api
      .directions()
      .then((recu) => vivant && setLu(recu))
      .catch(() => vivant && setLu(null))
    return () => {
      vivant = false
    }
  }, [])

  if (!lu) return null

  const poser = async (direction: Direction, animation: string) => {
    setRefus(null)
    try {
      setLu(await api.reglerDirection(direction.identifiant, { animation }))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "geste refusé")
    }
  }

  return (
    <>
      <Titre>Les directions en animation</Titre>
      <p className="text-[12.5px] leading-relaxed text-encre-2">
        La phrase placée devant le texte du mouvement, pour chaque direction du
        jeu : d'où l'on voit le personnage, et vers où va son geste. Laissez
        vide pour garder la phrase proposée (en gris).
      </p>
      {lu.directions.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-encre-3">Ce jeu n'a pas encore de direction.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {lu.directions.map((direction) => (
            <PhraseDeDirection
              key={direction.identifiant}
              direction={direction}
              livree={lu.phrases_livrees?.[direction.identifiant] ?? ""}
              onPoser={(animation) => poser(direction, animation)}
            />
          ))}
        </ul>
      )}
      <Raison texte={refus} />
    </>
  )
}

function PhraseDeDirection({
  direction,
  livree,
  onPoser,
}: {
  direction: Direction
  livree: string
  onPoser: (animation: string) => Promise<void>
}) {
  const ecrite = direction.animation ?? ""
  const [texte, setTexte] = useState(ecrite)
  useEffect(() => setTexte(ecrite), [ecrite])
  const change = texte.trim() !== ecrite

  return (
    <li className="rounded-[2px] border border-trait bg-carte px-2.5 py-1.5">
      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] text-encre">{direction.nom}</span>
        <textarea
          value={texte}
          rows={2}
          aria-label={`Phrase d'animation — ${direction.nom}`}
          placeholder={livree || "aucune phrase proposée pour cette direction — écris-en une"}
          onChange={(e) => setTexte(e.target.value)}
          className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
        />
      </label>
      {change && (
        <div className="mt-1.5 flex justify-end gap-2">
          <Bouton onClick={() => setTexte(ecrite)} enfants="Annuler" />
          <Bouton principal onClick={() => void onPoser(texte.trim())} enfants="Poser" />
        </div>
      )}
    </li>
  )
}

/** Les styles de combat (SC4, 18 septembre 2026) — **comment** un personnage
 *  se bat, sur le même modèle que `BlocMouvements` juste au-dessus : une
 *  liste, ouvrir une ligne montre un texte par mouvement, nommer en fabrique
 *  un neuf, masquer/remontrer comme pour un mouvement livré.
 *
 *  **La liste des mouvements vient d'ici aussi** : un style dit un texte par
 *  identifiant de mouvement, et il faut la liste du jeu pour proposer les
 *  bons champs — sans elle, on ne saurait pas quels mouvements un style peut
 *  dire. */
export function BlocStyles({ projet }: { projet: string | null }) {
  const [base, setBase] = useState<BaseStyles | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [refus, setRefus] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [fabrique, setFabrique] = useState(false)

  useEffect(() => {
    let vivant = true
    setOuvert(null)
    api
      .styles(projet)
      .then((recu) => vivant && setBase(recu))
      .catch(() => vivant && setBase({ styles: [], masques: [] }))
    api
      .mouvements(projet)
      .then((recu) => vivant && setMouvements(recu.mouvements))
      .catch(() => vivant && setMouvements([]))
    return () => {
      vivant = false
    }
  }, [projet])

  const poser = async (promesse: Promise<BaseStyles>) => {
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
      <Titre>Les styles de combat</Titre>
      <p className="text-[12.5px] leading-relaxed text-encre-2">
        Comment un personnage se bat. Quand il a ce style, le texte écrit ici
        pour un mouvement remplace celui du mouvement ; les autres mouvements
        gardent le leur.
      </p>
      <p data-styles-du-jeu className="mt-2 text-[12.5px] leading-relaxed text-encre-2">
        {base.propres_au_jeu
          ? "Ce jeu a ses propres styles."
          : "Ce jeu utilise les styles de départ de l'atelier. Ta première modification lui en fait une copie : les autres jeux ne changent pas."}
      </p>

      <ul className="mt-3 flex flex-col gap-px">
        {base.styles.map((style) => (
          <LigneDeStyle
            key={style.identifiant}
            style={style}
            mouvements={mouvements}
            ouvert={ouvert === style.identifiant}
            onOuvrir={() =>
              setOuvert(ouvert === style.identifiant ? null : style.identifiant)
            }
            onRegler={(champs) =>
              poser(api.reglerStyle(style.identifiant, champs, projet))
            }
            onMasquer={() => {
              setOuvert(null)
              return poser(api.masquerStyle(style.identifiant, projet))
            }}
          />
        ))}
      </ul>

      {base.masques.length > 0 && (
        <p className="mesure mt-2 flex flex-wrap items-center gap-2 text-[10px] text-encre-3">
          <span>masqués</span>
          {base.masques.map((style) => (
            <button
              key={style.identifiant}
              type="button"
              onClick={() => poser(api.montrerStyle(style.identifiant, projet))}
              className="rounded-[2px] border border-trait px-1.5 py-0.5 text-encre-2 hover:text-signal"
            >
              {style.nom} · remontrer
            </button>
          ))}
        </p>
      )}

      <Raison texte={refus} />

      {fabrique ? (
        <FabriqueStyle
          mouvements={mouvements}
          onFermer={() => setFabrique(false)}
          onPoser={async (nom, tient, textes) => {
            await poser(api.fabriquerStyle(nom, tient, textes, projet))
            setFabrique(false)
          }}
        />
      ) : (
        <div className="mt-3">
          <Bouton onClick={() => setFabrique(true)} enfants="Nommer un style" />
        </div>
      )}
    </>
  )
}

function LigneDeStyle({
  style,
  mouvements,
  ouvert,
  onOuvrir,
  onRegler,
  onMasquer,
}: {
  style: StyleDeCombat
  mouvements: Mouvement[]
  ouvert: boolean
  onOuvrir: () => void
  onRegler: (champs: {
    nom?: string
    tient?: string
    textes?: Record<string, string>
  }) => Promise<void>
  onMasquer: () => Promise<void>
}) {
  const [nom, setNom] = useState(style.nom)
  const [tient, setTient] = useState(style.tient)
  const [textes, setTextes] = useState<Record<string, string>>(style.textes)

  useEffect(() => {
    if (!ouvert) {
      setNom(style.nom)
      setTient(style.tient)
      setTextes(style.textes)
    }
  }, [ouvert, style])

  const change =
    nom.trim() !== style.nom ||
    tient.trim() !== style.tient ||
    mouvements.some((m) => (textes[m.identifiant] ?? "").trim() !== (style.textes[m.identifiant] ?? ""))

  const ceQuIlDit = mouvements.filter((m) => style.textes[m.identifiant]).map((m) => m.nom)

  return (
    <li className="rounded-[2px] border border-trait bg-carte px-2.5 py-1.5">
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={onOuvrir}
          aria-expanded={ouvert}
          className="text-[12.5px] text-encre hover:text-signal"
        >
          {style.nom}
        </button>
        {!style.livre && (
          <span className="mesure text-[9px] tracking-[.08em] text-epingle uppercase">
            nommé ici
          </span>
        )}
        <span className="mesure ml-auto text-[10px] text-encre-3">
          {ceQuIlDit.length > 0 ? ceQuIlDit.join(", ") : "aucun texte"}
        </span>
        <button
          type="button"
          onClick={onOuvrir}
          className="mesure rounded-[2px] border border-trait px-1.5 py-0.5 text-[10px] text-encre-2 hover:text-signal"
        >
          {ouvert ? "fermer" : "modifier"}
        </button>
      </div>

      {/* Ce qu'il tient est visible sans déplier : c'est ce qui distingue un
          style d'un autre, plus vite que ses textes. */}
      <p className="mesure mt-0.5 truncate text-[10px] text-encre-3">
        {style.tient || "mains nues"}
      </p>

      {ouvert && (
        <div className="mt-2 flex flex-col gap-2 border-t border-trait pt-2">
          <label className="flex flex-col gap-1">
            <Libelle aide="style.nom">Nom</Libelle>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={CHAMP}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Libelle aide="style.tient">Ce qu'il tient en main</Libelle>
            <input
              value={tient}
              placeholder="mains nues"
              onChange={(e) => setTient(e.target.value)}
              className={CHAMP}
            />
          </label>
          {mouvements.map((mouvement) => (
            <label key={mouvement.identifiant} className="flex flex-col gap-1">
              <Libelle aide="style.texte">{mouvement.nom}</Libelle>
              <textarea
                value={textes[mouvement.identifiant] ?? ""}
                rows={2}
                aria-label={`${style.nom} — ${mouvement.nom}`}
                placeholder="vide — ce style ne dit rien pour ce mouvement, il garde son texte"
                onChange={(e) =>
                  setTextes((t) => ({ ...t, [mouvement.identifiant]: e.target.value }))
                }
                className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
              />
            </label>
          ))}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => void onMasquer()}
              className="mesure text-[10px] text-encre-3 hover:text-signal"
            >
              {style.livre ? "masquer — il se remontre" : "masquer — il s'en va"}
            </button>
            <Bouton
              inactif={!change}
              principal
              onClick={() =>
                void onRegler({
                  nom: nom.trim(),
                  tient: tient.trim(),
                  textes: Object.fromEntries(
                    mouvements.map((m) => [m.identifiant, (textes[m.identifiant] ?? "").trim()]),
                  ),
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

function FabriqueStyle({
  mouvements,
  onPoser,
  onFermer,
}: {
  mouvements: Mouvement[]
  onPoser: (nom: string, tient: string, textes: Record<string, string>) => Promise<void>
  onFermer: () => void
}) {
  const [nom, setNom] = useState("")
  const [tient, setTient] = useState("")
  const [textes, setTextes] = useState<Record<string, string>>({})
  // **Le nom et au moins un texte sont la définition** — même garde que
  // `ServiceStyles.fabriquer` : un style sans texte ne fait jamais rien
  // partir de plus que le mouvement seul, donc n'est pas un style.
  const complet = nom.trim().length > 0 && Object.values(textes).some((t) => t.trim())

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[2px] border border-contour bg-carte p-2.5">
      <label className="flex flex-col gap-1">
        <Libelle aide="style.nom">Nom</Libelle>
        <input
          autoFocus
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="bâton à deux mains"
          className={CHAMP}
        />
      </label>
      <label className="flex flex-col gap-1">
        <Libelle aide="style.tient">Ce qu'il tient en main</Libelle>
        <input
          value={tient}
          onChange={(e) => setTient(e.target.value)}
          placeholder="a long wooden staff held in both hands"
          className={CHAMP}
        />
      </label>
      {mouvements.map((mouvement) => (
        <label key={mouvement.identifiant} className="flex flex-col gap-1">
          <Libelle aide="style.texte">{mouvement.nom}</Libelle>
          <textarea
            value={textes[mouvement.identifiant] ?? ""}
            rows={2}
            onChange={(e) =>
              setTextes((t) => ({ ...t, [mouvement.identifiant]: e.target.value }))
            }
            className={`${CHAMP} h-auto py-1.5 leading-relaxed`}
          />
        </label>
      ))}
      <div className="flex justify-end gap-2">
        <Bouton onClick={onFermer} enfants="Laisser" />
        <Bouton
          principal
          inactif={!complet}
          onClick={() =>
            void onPoser(
              nom.trim(),
              tient.trim(),
              Object.fromEntries(
                Object.entries(textes)
                  .map(([m, t]) => [m, t.trim()])
                  .filter(([, t]) => t),
              ),
            )
          }
          enfants="Nommer"
        />
      </div>
    </div>
  )
}
