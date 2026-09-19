// Commander une planche de plusieurs objets (P2, V3.5).
//
// **Ce qu'elle divise.** Demander huit objets un par un coûte huit appels ;
// les demander en une planche numérotée n'en coûte qu'un, et l'atelier les
// range chacun à sa place. Cet écran choisit la liste, dans l'ordre, et montre
// le prix — celui de la planche, et celui d'un objet — avant qu'un centime
// parte.
//
// **Objets et équipement seulement** (décision de l'auteur, 18 septembre
// 2026) : les décors et les tuiles se raccordent entre eux et ne tiennent pas
// seuls dans une case — ils restent au chantier des tuiles, et ne paraissent
// pas dans les deux familles proposées ici.
//
// **Une fenêtre de plus, pas une cinquième famille.** `PreparerUneFabrication`
// tient à ses quatre types fermés (image, clip, son, rendu 3D) ; celle-ci vit
// à côté, ouverte depuis le même repos que « Fabriquer une image libre », et
// n'appelle que les deux routes déjà éprouvées : `POST /outgoing` pour lire le
// prix, `POST /generations` pour payer — jamais l'inverse, et jamais avant
// l'accord du bouton.

import { useEffect, useState } from "react"
import {
  api,
  estArgent,
  prix as ecrirePrix,
  Refus,
  type Modele,
  type SujetDeLaGrille,
} from "../api"
import { CadreDialogue } from "./CadreDialogue"
import { Bouton, Raison } from "./pieces"

const FAMILLES = [
  { cle: "objets", nom: "Objets" },
  { cle: "personnages", nom: "Personnages" },
  { cle: "interface", nom: "Interface" },
] as const

type Famille = (typeof FAMILLES)[number]["cle"]

/** La phrase en tête de la demande. **Le serveur l'exige non vide**, et c'est
 *  la liste numérotée qui suit qui dit chaque objet : celle-ci ne dit que
 *  l'ensemble. La même à l'annonce du prix et à l'envoi, pour que ce qu'on
 *  paie soit ce qu'on a lu. */
const DEMANDE = "A set of separate game items."

export function PlancheDePlusieursObjets({
  projet,
  modeles,
  onFermer,
  onLancee,
}: {
  projet: string | null
  modeles: Modele[]
  onFermer: () => void
  /** La génération soumise — l'atelier la déplie tout seul, comme toute
   *  planche (P1). */
  onLancee: (identifiant: string) => void
}) {
  const [famille, setFamille] = useState<Famille>("objets")
  const [recherche, setRecherche] = useState("")
  const [trouves, setTrouves] = useState<SujetDeLaGrille[]>([])
  // **La liste choisie, dans l'ordre de lecture** — la n-ième case porte le
  // n-ième objet (décision de l'auteur, 18 septembre 2026).
  const [choisis, setChoisis] = useState<{ identifiant: string; nom: string }[]>([])
  const [modele, setModele] = useState(modeles.find((m) => !m.locale && !m.refus)?.identifiant ?? modeles[0]?.identifiant ?? "")
  // **Le défaut du jeu pour une planche**, et ses réglages : le modèle de
  // planche du jeu, sinon celui du produit, en qualité basse. Sans lui, la
  // commande partait sans réglage — à la qualité que le fournisseur choisit —
  // et sur le premier modèle de la liste (banc payé du 19 septembre 2026).
  const [defaut, setDefaut] = useState<{ modele: string | null; options: Record<string, string> } | null>(null)
  const [modeleTouche, setModeleTouche] = useState(false)
  const [envoi, setEnvoi] = useState<Awaited<ReturnType<typeof api.envoi>> | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [enPaiement, setEnPaiement] = useState(false)

  useEffect(() => {
    let vivant = true
    api
      .modeles("1:1", 0, "", "", 2)
      .then((catalogue) => vivant && setDefaut(catalogue.defaut))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [projet])

  useEffect(() => {
    if (modeleTouche || !defaut?.modele) return
    if (modeles.some((m) => m.identifiant === defaut.modele)) setModele(defaut.modele)
  }, [defaut, modeles, modeleTouche])

  useEffect(() => {
    let vivant = true
    void api
      .familleDeSujets(famille, { recherche, limite: 40 })
      .then((lu) => vivant && setTrouves(lu.personnages))
      .catch(() => vivant && setTrouves([]))
    return () => {
      vivant = false
    }
  }, [famille, recherche])

  // **Le prix se relit à chaque changement de la liste ou du modèle** — la
  // même règle que la barre qui paie : ce qui part est ce qui est montré.
  useEffect(() => {
    if (choisis.length < 2 || !modele) {
      setEnvoi(null)
      setRefus(choisis.length === 1 ? "une planche à plusieurs objets en demande au moins deux" : null)
      return
    }
    let vivant = true
    setRefus(null)
    api
      .envoi({
        prompt: DEMANDE,
        modele,
        projet,
        sujets: choisis.map((c) => c.identifiant),
      })
      .then((lu) => vivant && setEnvoi(lu))
      .catch((erreur) => {
        if (!vivant) return
        setEnvoi(null)
        setRefus(erreur instanceof Refus ? erreur.message : "la préparation a été refusée")
      })
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choisis, modele, projet])

  const ajouter = (sujet: SujetDeLaGrille) => {
    if (choisis.some((c) => c.identifiant === sujet.identifiant)) return
    setChoisis((deja) => [...deja, { identifiant: sujet.identifiant, nom: sujet.nom }])
  }
  const retirer = (identifiant: string) =>
    setChoisis((deja) => deja.filter((c) => c.identifiant !== identifiant))
  const deplacer = (rang: number, sens: -1 | 1) =>
    setChoisis((deja) => {
      const cible = rang + sens
      if (cible < 0 || cible >= deja.length) return deja
      const suivant = [...deja]
      ;[suivant[rang], suivant[cible]] = [suivant[cible], suivant[rang]]
      return suivant
    })

  const payer = async () => {
    setEnPaiement(true)
    try {
      const generation = await api.generer({
        modele,
        prompt: DEMANDE,
        prompt_negatif: "",
        proportions: "",
        variations: 1,
        // Les réglages du défaut ne valent que pour son modèle.
        options: defaut && modele === defaut.modele ? defaut.options : {},
        identifiant: crypto.randomUUID(),
        references: [],
        echelle: "",
        repris: false,
        sujets: choisis.map((c) => c.identifiant),
      })
      onLancee(generation.identifiant)
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "l'envoi a été refusé")
    } finally {
      setEnPaiement(false)
    }
  }

  const champ = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px]"
  const prixTotal = ecrirePrix(envoi?.prix.total ?? null, envoi?.prix.mesure.unite)
  const parObjet = envoi?.prix.par_sujet != null ? ecrirePrix(envoi.prix.par_sujet, envoi.prix.mesure.unite) : null

  return (
    <CadreDialogue
      titre="Commander une planche de plusieurs objets"
      format="preparation"
      onFermer={onFermer}
      enfants={
      <div className="flex min-h-0 flex-1 flex-col text-[13px]">
        <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]">
          <div>
            <h1 className="font-serif text-[25px]">Commander une planche de plusieurs objets</h1>
            <p className="mt-[4px] text-encre-3">
              Choisis les objets dans l'ordre : la case 1 porte le premier, la case 2 le second…
            </p>
          </div>
          <button
            type="button"
            className="h-[34px] rounded-7 border border-contour bg-carte px-[14px]"
            onClick={onFermer}
          >
            Fermer
          </button>
        </header>

        <div className="defile grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-[22px] overflow-y-auto p-[22px]">
          <section className="flex flex-col gap-[14px]">
            <div className="flex gap-[8px]">
              {FAMILLES.map((f) => (
                <button
                  key={f.cle}
                  type="button"
                  aria-pressed={famille === f.cle}
                  onClick={() => setFamille(f.cle)}
                  className={`h-[30px] rounded-7 border px-[12px] text-[12px] ${famille === f.cle ? "border-signal text-signal" : "border-contour text-encre-3"}`}
                >
                  {f.nom}
                </button>
              ))}
            </div>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="chercher un objet du jeu"
              aria-label="Chercher un objet du jeu"
              className={champ}
            />
            <ul className="flex flex-col gap-[4px]">
              {trouves.map((s) => (
                <li key={s.identifiant} className="flex items-center justify-between gap-[8px] text-[12px]">
                  <span className="truncate">{s.nom}</span>
                  <button
                    type="button"
                    onClick={() => ajouter(s)}
                    disabled={choisis.some((c) => c.identifiant === s.identifiant)}
                    className="mesure shrink-0 text-[10.5px] text-signal hover:opacity-70 disabled:opacity-40"
                  >
                    ajouter ›
                  </button>
                </li>
              ))}
              {trouves.length === 0 && (
                <li className="text-[11px] text-encre-4">aucun objet trouvé</li>
              )}
            </ul>
          </section>

          <section className="flex flex-col gap-[14px]">
            <label className="flex flex-col gap-[4px]">
              <span className="font-medium">Modèle</span>
              <select className={champ} value={modele} onChange={(e) => { setModeleTouche(true); setModele(e.target.value) }}>
                {modeles.map((m) => (
                  <option key={m.identifiant} value={m.identifiant} disabled={!!m.refus}>
                    {m.fournisseur} · {m.nom}
                    {m.refus ? ` — ${m.refus}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="font-medium">La planche, dans l'ordre</p>
              {choisis.length === 0 ? (
                <p className="mt-[8px] text-[11px] text-encre-4">
                  aucun objet choisi — il en faut au moins deux
                </p>
              ) : (
                <ol className="mt-[8px] flex flex-col gap-[4px]">
                  {choisis.map((c, rang) => (
                    <li key={c.identifiant} className="flex items-center gap-[6px] text-[12px]">
                      <span className="w-[16px] shrink-0 text-encre-4">{rang + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{c.nom}</span>
                      <button
                        type="button"
                        disabled={rang === 0}
                        onClick={() => deplacer(rang, -1)}
                        className="shrink-0 text-encre-4 hover:text-signal disabled:opacity-30"
                        aria-label={`Monter ${c.nom}`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={rang === choisis.length - 1}
                        onClick={() => deplacer(rang, 1)}
                        className="shrink-0 text-encre-4 hover:text-signal disabled:opacity-30"
                        aria-label={`Descendre ${c.nom}`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => retirer(c.identifiant)}
                        className="shrink-0 text-encre-4 hover:text-echec"
                        aria-label={`Retirer ${c.nom}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {refus && <Raison texte={refus} />}
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]">
          <div>
            {envoi && (
              <p>
                Planche : <span className="font-medium">{prixTotal}</span>
                {parObjet && (
                  <span className="text-encre-3"> — soit {parObjet} par objet ({choisis.length} objets)</span>
                )}
              </p>
            )}
            {!envoi && !refus && choisis.length >= 2 && (
              <p className="text-encre-3">calcul du prix…</p>
            )}
            <p className="mt-[4px] text-encre-4">rien n'est consommé tant que le bouton n'est pas pressé.</p>
          </div>
          <Bouton
            principal
            inactif={!envoi || enPaiement || !!refus}
            onClick={() => void payer()}
            enfants={
              enPaiement
                ? "Envoi en cours…"
                : envoi && estArgent(envoi.prix.mesure.unite)
                  ? `Payer et lancer${prixTotal ? ` ${prixTotal}` : ""}`
                  : "Lancer la fabrication"
            }
          />
        </footer>
      </div>
      }
    />
  )
}
