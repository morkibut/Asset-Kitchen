/**
 * « Livrer au jeu » — **un seul écran, sans onglet** (`RV8`).
 *
 * Avant, deux boutons ouvraient deux écrans qui ne voyaient pas le même
 * dossier de jeu (`RV8`, §1) : *Livrer dans Godot* (AU1, un paquet par sujet)
 * et *Exporter des fichiers* (B21/RP17, des PNG à plat). Ils écrivent deux
 * choses différentes — la référence reste AU1 — et les deux écritures gardent
 * leurs octets (`RV8`, §2). Ce qui change ici, c'est **l'endroit où le
 * dossier est rangé** (une seule source, `association.json`) et **l'écran**.
 *
 * **Quatre zones.** Un bandeau — le dossier Godot du jeu, une fois. À gauche,
 * ce qui part : la portée, la nature, la forme. Au centre, l'arbre de ce qui
 * change ; « Pas prêt » et « la dernière sortie » en dessous. C'est tout —
 * la troisième colonne de 380 px de l'ancien écran est partie avec elle, et
 * c'était la cause probable du débordement mesuré à 1280 px.
 *
 * **La nature ne propose pas toutes les portées.** Le paquet Godot d'un jeu
 * entier ou d'une famille ne sait préparer que des animations
 * (`prevoirLivraisonsDuJeu`, `RV8`, §3 : « un `prevoir` par sujet ») ; une
 * image ou un jeu de tuiles se choisissent un par un. La portée ne se montre
 * donc que pour les animations ; les autres natures montrent directement ce
 * qu'elles demandent — un sujet, un jeu de tuiles, ou rien pour les sons, qui
 * sortent toujours au niveau du jeu entier.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  Refus,
  type ApercuDeSortie,
  type ApercuLivraison,
  type Bande,
  type DecisionSurConflit,
  type LivraisonGodot,
  type Personnage,
  type ReglagesDeLaSortie,
} from "../api"
import { tuiles, type EnsembleTuiles } from "../api-tuiles"
import type { FiltreDeSortie } from "../lieux"
import { BandeQuiTourne } from "./Apercu"
import { ImagesALivrer } from "./ImagesALivrer"
import { SonsALivrer, SonsDuSujetALivrer } from "./SonsALivrer"
import {
  ArbreDeSortie,
  Bloc,
  Choix,
  DerniereSortie,
  Intitule,
  MOTS,
  PasPretDeSortie,
  Raison,
  ReglagesFichiersReplies,
  Segmente,
} from "./Sortie"

const champ = "rounded-7 border border-contour bg-carte px-[8px] py-[8px] text-[13px] text-encre"
const bouton = "rounded-7 border border-contour px-[14px] py-[8px] text-[13px] text-encre-controle disabled:opacity-50"

type Nature = "animation" | "image" | "son" | "tuiles"
type Forme = "paquet" | "fichiers"
type FamilleFixe = "personnages" | "objets" | "decors" | "interface"
type Portee = { genre: "tout" } | { genre: "famille"; famille: FamilleFixe } | { genre: "sujet"; sujet: string }

const FAMILLES: FamilleFixe[] = ["personnages", "objets", "decors", "interface"]

/** Le sujet visé par une portée qui n'en tient pas encore un explicite — le
 *  premier sujet du jeu, comme le sélecteur l'affiche déjà (`RP17`). Sans
 *  ceci, le sujet à l'écran et celui envoyé au serveur divergent tant que
 *  l'auteur n'a pas touché au menu. */
function sujetDe(portee: Portee, sujets: Personnage[]): string {
  if (portee.genre === "sujet" && portee.sujet) return portee.sujet
  return sujets[0]?.identifiant ?? ""
}

/** Les trois décisions de `RP10`, et ce que chacune fait — **dit avant d'être
 *  prise**, pas après : un conflit se décide une fois, et le fichier du jeu ne
 *  revient pas. */
const DECISIONS: { cle: DecisionSurConflit; nom: string; fait: string }[] = [
  { cle: "conserver", nom: "Conserver", fait: "Le fichier du jeu reste. L’atelier n’écrit rien ici." },
  { cle: "copier", nom: "Copier à côté", fait: "L’atelier écrit le sien sous le même nom suivi de .copie-atelier. Le fichier du jeu ne bouge pas." },
  { cle: "remplacer", nom: "Remplacer", fait: "L’atelier écrit par-dessus. Ce que contient le fichier du jeu est perdu." },
]

function decide(decision: DecisionSurConflit | null | undefined) {
  const mots: Record<DecisionSurConflit, string> = { conserver: "conservé", copier: "copié à côté", remplacer: "remplacé" }
  return decision ? mots[decision] : "à décider"
}

/** Le porteur d'un lieu filtré (`RV8`, §4) vers ce qu'on lui donne au départ. */
function depuisLeFiltre(filtre: FiltreDeSortie | undefined): { portee: Portee; nature: Nature } {
  if (filtre?.genre === "sujet") return { portee: { genre: "sujet", sujet: filtre.sujet }, nature: "animation" }
  if (filtre?.genre === "son") return { portee: { genre: "tout" }, nature: "son" }
  if (filtre?.genre === "tuiles") return { portee: { genre: "tout" }, nature: "tuiles" }
  // Sans filtre, la portée par défaut reste **un sujet** — c'est ce que le
  // paquet Godot a toujours préparé avant `RV8` (`prevoir_plusieurs` est
  // l'exception, pas la règle) : « tout le jeu » et « une famille » restent un
  // choix explicite, pas le premier écran qu'on voit.
  return { portee: { genre: "sujet", sujet: "" }, nature: "animation" }
}

/** Le paquet Godot d'un sujet, d'une image ou d'un jeu de tuiles — **un
 *  aperçu `ApercuLivraison`, ses conflits `RP10`, et le bouton qui livre**.
 *  Les trois natures qui produisent ce type d'aperçu passent par cette même
 *  carte : c'est le modèle de style que l'étape E des tuiles donnait déjà. */
function CartePaquet({ projet, apercu, onApercu, onLivre, titre }: {
  projet: string
  apercu: ApercuLivraison
  onApercu: (a: ApercuLivraison) => void
  onLivre?: (l: LivraisonGodot) => void
  titre?: string
}) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const [livree, setLivree] = useState(false)
  const aDecider = apercu.conflits.filter((c) => !c.decision).length
  async function agir(geste: () => Promise<void>) {
    setOccupe(true); setErreur("")
    try { await geste() } catch (e) { setErreur(e instanceof Error ? e.message : "La livraison n’a pas abouti.") }
    finally { setOccupe(false) }
  }
  return <section className="flex flex-col gap-[14px] rounded-10 border border-trait bg-carte p-[14px]" aria-label={titre ?? "Ce qui va être écrit"}>
    {titre && <h3 className="font-serif text-[15px] text-encre">{titre}</h3>}
    <p className="break-all text-[11.5px] text-encre-3">{apercu.dossier}</p>
    {apercu.pivot && <p className="text-[13px]">Repère relu : X {apercu.pivot.x} · Y {apercu.pivot.y} pixels.</p>}
    {apercu.ressource && <p className="break-all text-[12px] text-encre-3">Texture à utiliser directement : {apercu.ressource}</p>}
    <ul className="flex flex-col gap-[8px]">{apercu.fichiers.map(f => <li key={f.chemin} className="flex items-center justify-between gap-[14px] text-[12px]"><span className="min-w-0 break-all font-mono">{f.chemin}</span><span className="shrink-0 text-encre-3">{({ inchange: "inchangé", nouveau: "nouveau", remplace: "remplacé", conflit: "conflit" } as Record<string, string>)[f.etat] ?? f.etat}{f.etat === "conflit" && ` · ${decide(apercu.conflits.find(c => c.chemin === f.chemin)?.decision)}`} · {Math.ceil(f.octets / 1024)} ko</span></li>)}</ul>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!!apercu.conflits.length && <div className="flex flex-col gap-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px]" aria-label="Conflits à décider">
      <p role="alert" className="text-[13px] text-echec">{aDecider ? `${aDecider} fichier${aDecider > 1 ? "s" : ""} à décider avant de livrer.` : "Chaque conflit a sa décision. La livraison peut partir."} Le jeu contient déjà {apercu.conflits.length === 1 ? "ce fichier" : "ces fichiers"}, et l’atelier ne {apercu.conflits.length === 1 ? "l’a" : "les a"} pas écrit{apercu.conflits.length > 1 ? "s" : ""}.</p>
      {apercu.conflits.map(c => <div key={c.chemin} className="flex flex-col gap-[8px] border-t border-trait pt-[14px] first:border-0 first:pt-0">
        <p className="min-w-0 break-all font-mono text-[12px]">{c.chemin}</p>
        <p className="text-[11.5px] text-encre-3">{c.raison}</p>
        <ul className="flex flex-col gap-[4px]" aria-label={`Décider de ${c.chemin}`}>{DECISIONS.map(d => <li key={d.cle} className="flex flex-wrap items-center gap-[8px]">
          <button className={`${bouton} ${c.decision === d.cle ? "border-encre-4 font-medium text-encre" : ""}`} aria-pressed={c.decision === d.cle} disabled={occupe} onClick={() => agir(async () => {
            onApercu(await api.deciderConflit(projet, apercu.jeton, c.chemin, d.cle))
          })}>{d.nom}</button>
          <span className="min-w-0 flex-1 text-[11.5px] text-encre-3">{d.fait}</span>
        </li>)}</ul>
        {c.voisin && <p className="break-all text-[11.5px] text-encre-3">La copie s’écrira dans {c.voisin}.</p>}
      </div>)}
    </div>}
    {livree
      ? <p role="status" className="rounded-7 border border-trait-ok bg-fond-ok p-[8px] text-[12.5px] text-encre-ok">Livrée. Ouvre {apercu.scene} dans Godot.</p>
      : <button className={`${bouton} self-start bg-signal text-encre-sur-signal`} disabled={occupe || !apercu.pret} onClick={() => agir(async () => {
          const livraison = await api.livrerGodot(projet, apercu.jeton)
          setLivree(true)
          onLivre?.(livraison)
        })}>{occupe ? "Livraison en cours…" : "Livrer ces versions dans Godot"}</button>}
  </section>
}

/** Le bandeau du haut — **le dossier Godot du jeu, une seule fois** (`RV8`,
 *  §4). Il réunit les deux champs d'avant (`Livraisons.tsx`, `Sortie.tsx`) en
 *  un seul : la racine où vit `project.godot`. Le sous-dossier de chaque
 *  forme garde son défaut, invisible ici — ce n'est pas le lieu où le
 *  choisir, seulement celui où dire où est le jeu. */
function BandeauGodot({ reglages, occupe, onAssocie }: {
  reglages: ReglagesDeLaSortie | null
  occupe: boolean
  onAssocie: (dossier: string, sousDossier?: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [dossier, setDossier] = useState("")
  useEffect(() => { setDossier(reglages?.racine ?? "") }, [reglages?.racine])
  // Pas de `role="status"` ici : une livraison réussie pose le sien plus bas
  // (« Livrée. Ouvre … »), et deux statuts en même temps — celui-ci ne part
  // jamais si `reglagesDeLaSortie` échoue sans réponse — rendraient
  // `findByRole("status")` ambigu.
  if (!reglages) return <p className="px-[30px] py-[8px] text-[13px] text-encre-3">Lecture du jeu…</p>
  return <div className="flex flex-col gap-[8px] border-b border-trait bg-carte px-[30px] py-[14px]">
    <div className="flex flex-wrap items-center gap-[14px]">
      <Intitule enfants="Le jeu Godot" />
      {reglages.origine === "jeu" && <span className="mesure break-all text-[12.5px] text-encre">{reglages.racine}</span>}
      {reglages.origine === "ancien" && <span className="text-[12.5px] text-encre-attention">{reglages.mention} — {reglages.racine}</span>}
      {reglages.origine === "aucun" && <span className="text-[12.5px] text-echec">{reglages.refus || "aucun dossier de jeu"}</span>}
      {reglages.origine === "jeu" && <button className={bouton} disabled={occupe} onClick={() => setOuvert((o) => !o)}>Changer</button>}
      {/* **Un clic, sans formulaire** : le serveur propose déjà le dossier et
          son sous-dossier — celui où l'ancienne sortie écrivait déjà, pour
          que rattacher ne déplace rien (`RV8`, §3). */}
      {reglages.origine !== "jeu" && reglages.rattacher && <button className={bouton} disabled={occupe} onClick={() => onAssocie(reglages.rattacher!.dossier, reglages.rattacher!.sous_dossier)}>Rattacher</button>}
      {reglages.origine !== "jeu" && !reglages.rattacher && <button className={bouton} disabled={occupe} onClick={() => setOuvert((o) => !o)}>Rattacher</button>}
    </div>
    {reglages.origine === "jeu" && reglages.refus && <p role="alert" className="text-[12px] text-echec">{reglages.refus}</p>}
    {ouvert && <div className="flex flex-wrap items-center gap-[8px]">
      <input className={`${champ} min-w-[300px] flex-1`} value={dossier} placeholder="C:\Jeux\Mon jeu" onChange={(e) => setDossier(e.target.value)} />
      <button className={bouton} disabled={!dossier.trim() || occupe} onClick={() => { onAssocie(dossier); setOuvert(false) }}>Associer ce dossier</button>
    </div>}
  </div>
}

export function Livraisons({ projet, filtre, onFerme, onErreur }: {
  projet: string | null
  filtre?: FiltreDeSortie
  onFerme: () => void
  onErreur?: (refus: Refus) => void
}) {
  if (!projet) return <p className="p-[30px]">Ouvre un jeu pour préparer sa livraison.</p>
  return <EcranDeSortie key={projet} projet={projet} filtre={filtre} onFerme={onFerme} onErreur={onErreur} />
}

function EcranDeSortie({ projet, filtre, onFerme, onErreur }: {
  projet: string; filtre?: FiltreDeSortie; onFerme: () => void; onErreur?: (refus: Refus) => void
}) {
  const depart = useMemo(() => depuisLeFiltre(filtre), [filtre])
  const [sujets, setSujets] = useState<Personnage[]>([])
  const [reglages, setReglages] = useState<ReglagesDeLaSortie | null>(null)
  const [portee, setPortee] = useState<Portee>(depart.portee)
  const [nature, setNature] = useState<Nature>(depart.nature)
  const [forme, setForme] = useState<Forme>("paquet")
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  /** L'historique des paquets Godot déjà préparés ou livrés — **au jeu
   *  entier**, comme avant `RV8` : une image comme une animation peuvent s'y
   *  relire. « Relire cette livraison » restaure la portée, la nature et
   *  l'aperçu d'un coup, sans repasser par la préparation. */
  const [historique, setHistorique] = useState<LivraisonGodot[]>([])
  const [apercuRepris, setApercuRepris] = useState<ApercuLivraison | null>(null)
  const direLErreur = useRef(onErreur)
  direLErreur.current = onErreur

  const relireReglages = () => api.reglagesDeLaSortie(projet).then(setReglages).catch((e) => direLErreur.current?.(e as Refus))
  const relireHistorique = () => api.livraisonsGodot(projet).then((r) => setHistorique(r.livraisons ?? [])).catch(() => {})
  useEffect(() => {
    relireReglages(); relireHistorique()
    api.production().then((p) => setSujets(p.personnages ?? [])).catch((e) => direLErreur.current?.(e as Refus))
  }, [projet])

  async function reprendre(l: LivraisonGodot) {
    setErreur("")
    try {
      const lu = l.etat === "terminee" ? await api.reprendreLivraison(projet, l.jeton) : l
      setNature(lu.nature === "image" ? "image" : "animation")
      setForme("paquet")
      setPortee({ genre: "sujet", sujet: lu.personnage ?? "" })
      setApercuRepris(lu)
    } catch (e) { setErreur(e instanceof Error ? e.message : "La livraison n’a pas pu être relue.") }
  }

  // Un sujet, une forme fichiers : quand le sujet vient d'un filtre, forcer la
  // forme paquet n'aurait pas de sens si l'auteur veut le voir en fichiers —
  // les deux formes restent proposées.
  useEffect(() => {
    if ((nature === "son" || nature === "tuiles") && forme === "fichiers") setForme("paquet")
  }, [nature, forme])

  async function associerJeu(dossier: string, sousDossier?: string) {
    setOccupe(true); setErreur("")
    try {
      await api.associerGodot(projet, { dossier, sous_dossier: "assets/asset-kitchen" })
      await api.reglerSousDossier(sousDossier ?? "assets/asset-kitchen/fichiers", projet)
      await relireReglages()
    } catch (e) { setErreur(e instanceof Error ? e.message : "Le jeu n’a pas pu être associé.") }
    finally { setOccupe(false) }
  }

  return <section className="defile flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Livrer au jeu">
    <header className="flex items-start justify-between gap-[14px] px-[30px] pt-[22px]">
      <div><h1 className="font-serif text-[38px] text-encre">Livrer au jeu</h1><p className="text-[13px] text-encre-3">Choisis ce qui part, relis les fichiers, puis retrouve-les dans Godot.</p></div>
      <button className={bouton} onClick={onFerme}>‹ Fermer</button>
    </header>
    <BandeauGodot reglages={reglages} occupe={occupe} onAssocie={associerJeu} />
    {erreur && <p role="alert" className="mx-[30px] mt-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur}</p>}
    <div className="flex min-h-0 flex-1 gap-[22px] p-[30px]">
      {/* ── À gauche — ce qui part ───────────────────────────────────── */}
      <div className="defile flex w-[300px] shrink-0 flex-col overflow-y-auto">
        <Bloc titre="Ce qui part">
          {nature === "animation" && <PorteeAnimation portee={portee} onPortee={setPortee} sujets={sujets} />}
          {nature === "image" && <PorteeSujet sujet={portee.genre === "sujet" ? portee.sujet : ""} onSujet={(s) => setPortee({ genre: "sujet", sujet: s })} sujets={sujets} />}
          {nature === "son" && <Raison enfants="Tous les sons du jeu, rangés par famille." />}
        </Bloc>
        <Bloc titre="La nature">
          <div className="flex flex-wrap gap-[8px]" role="radiogroup" aria-label="La nature">
            {(["animation", "image", "son", "tuiles"] as const).map((n) => <button key={n} className={bouton} aria-pressed={nature === n} onClick={() => setNature(n)}>{{ animation: "Animations", image: "Images fixes", son: "Sons", tuiles: "Tuiles" }[n]}</button>)}
          </div>
        </Bloc>
        {(nature === "animation" || nature === "image") && <Bloc titre="La forme">
          <Segmente nom="La forme" valeurs={["paquet", "fichiers"]} choisie={forme} onChoisir={(v) => setForme(v as Forme)} />
          <Raison enfants={forme === "paquet" ? "Une scène et un SpriteFrames, prêts à ouvrir dans Godot (AU1)." : "Des PNG et un descriptif, rangés à ta façon."} />
        </Bloc>}
      </div>

      {/* ── Au centre — l'arbre, puis pas prêt et la dernière sortie ─── */}
      <div className="defile flex min-w-0 flex-1 flex-col gap-[22px] overflow-y-auto">
        {forme === "fichiers"
          ? <PanneauFichiers projet={projet} portee={portee} nature={nature as "animation" | "image"} reglages={reglages} occupeGlobal={occupe} />
          : <PanneauPaquet
              projet={projet} portee={portee} nature={nature} sujets={sujets} filtre={filtre}
              apercuRepris={apercuRepris} onApercuReprisConsomme={() => setApercuRepris(null)}
              onLivre={() => { void relireReglages(); void relireHistorique() }}
            />}
        {forme === "paquet" && (nature === "animation" || nature === "image") && (
          <HistoriqueDesPaquets historique={historique} occupe={occupe} onReprendre={reprendre} />
        )}
      </div>
    </div>
  </section>
}

// ── La portée (animations) ────────────────────────────────────────────────

function PorteeAnimation({ portee, onPortee, sujets }: { portee: Portee; onPortee: (p: Portee) => void; sujets: Personnage[] }) {
  return <div className="flex flex-col gap-[8px]">
    <div role="radiogroup" aria-label="Ce qui part">
      <Choix nom="Tout le jeu" choisi={portee.genre === "tout"} onChoisir={() => onPortee({ genre: "tout" })} />
      <Choix nom="Une famille" choisi={portee.genre === "famille"} onChoisir={() => onPortee({ genre: "famille", famille: FAMILLES[0] })} />
      <Choix nom="Un sujet" choisi={portee.genre === "sujet"} onChoisir={() => onPortee({ genre: "sujet", sujet: sujets[0]?.identifiant ?? "" })} />
    </div>
    {portee.genre === "famille" && <select aria-label="Laquelle" className={champ} value={portee.famille} onChange={(e) => onPortee({ genre: "famille", famille: e.target.value as FamilleFixe })}>
      {FAMILLES.map((f) => <option key={f} value={f}>{MOTS[f] ?? f}</option>)}
    </select>}
    {portee.genre === "sujet" && <select aria-label="Lequel" className={champ} value={portee.sujet || sujets[0]?.identifiant || ""} onChange={(e) => onPortee({ genre: "sujet", sujet: e.target.value })}>
      {!sujets.length && <option value="">Aucun sujet créé</option>}
      {sujets.map((s) => <option key={s.identifiant} value={s.identifiant}>{s.nom}</option>)}
    </select>}
  </div>
}

function PorteeSujet({ sujet, onSujet, sujets }: { sujet: string; onSujet: (s: string) => void; sujets: Personnage[] }) {
  return <label className="flex flex-col gap-[4px] text-[13px]">Sujet
    <select aria-label="Sujet" className={champ} value={sujet || sujets[0]?.identifiant || ""} onChange={(e) => onSujet(e.target.value)}>
      {!sujets.length && <option value="">Aucun sujet créé</option>}
      {sujets.map((s) => <option key={s.identifiant} value={s.identifiant}>{s.nom}</option>)}
    </select>
  </label>
}

// ── La forme « fichiers » ────────────────────────────────────────────────

function PanneauFichiers({ projet, portee, nature, reglages, occupeGlobal }: {
  projet: string; portee: Portee; nature: "animation" | "image"; reglages: ReglagesDeLaSortie | null; occupeGlobal: boolean
}) {
  const [rangement, setRangement] = useState("a_plat")
  const [collision, setCollision] = useState("remplacer")
  const [moteur, setMoteur] = useState("aucun")
  const [apercu, setApercu] = useState<ApercuDeSortie | null>(null)
  const [filtreArbre, setFiltreArbre] = useState<"change" | "tout">("tout")
  const [encours, setEncours] = useState(false)
  const [bilan, setBilan] = useState<{ compte: number; dossier: string } | null>(null)
  const [erreur, setErreur] = useState("")

  const lot = nature === "animation" ? "animations" : portee.genre === "famille" ? portee.famille : "tout"
  const sujet = portee.genre === "sujet" ? portee.sujet : ""
  const reglage = useMemo(() => ({ projet, lot, dossier: null, rangement, collision, moteur, sujet }), [projet, lot, rangement, collision, moteur, sujet])

  useEffect(() => {
    let vivant = true
    api.prevoirLaSortie(reglage).then((v) => { if (vivant) setApercu(v) }).catch((e) => vivant && setErreur(e instanceof Error ? e.message : "L’aperçu n’a pas pu être lu."))
    return () => { vivant = false }
  }, [reglage])

  const inactif = occupeGlobal || encours || !apercu || apercu.refus !== "" || apercu.compte === 0

  return <>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    <ReglagesFichiersReplies reglages={reglages} rangement={rangement} onRangement={setRangement} collision={collision} onCollision={setCollision} moteur={moteur} onMoteur={setMoteur} comptes={apercu?.comptes ?? {}} />
    <ArbreDeSortie apercu={apercu} filtre={filtreArbre} onFiltre={setFiltreArbre} />
    <div className="flex flex-col gap-[8px]">
      <button type="button" disabled={inactif} onClick={() => {
        setEncours(true)
        api.sortir(reglage).then((fait) => { setBilan({ compte: fait.compte, dossier: fait.dossier }); return api.prevoirLaSortie(reglage).then(setApercu) })
          .catch((e) => setErreur(e instanceof Error ? e.message : "La sortie n’a pas abouti.")).finally(() => setEncours(false))
      }} className={`${bouton} h-[34px] w-fit shrink-0 border-encre-4 font-medium`}>
        {encours ? "…" : `Livrer ${apercu?.compte ?? 0} fichier${(apercu?.compte ?? 0) > 1 ? "s" : ""} ›`}
      </button>
      <p className="text-[11.5px] text-encre-4">{apercu?.refus || `${apercu ? Math.ceil((apercu.octets ?? 0) / 1024) : 0} ko · rien ne part sur le réseau`}</p>
      {bilan && <p role="status" className="rounded-7 border border-trait-ok bg-fond-ok p-[8px] text-[12px] text-encre-ok">{bilan.compte} fichier{bilan.compte > 1 ? "s" : ""} posé{bilan.compte > 1 ? "s" : ""} dans {bilan.dossier}.</p>}
    </div>
    <PasPretDeSortie apercu={apercu} />
    <DerniereSortie apercu={apercu} />
  </>
}

// ── La forme « paquet Godot » ───────────────────────────────────────────

function PanneauPaquet({ projet, portee, nature, sujets, filtre, apercuRepris, onApercuReprisConsomme, onLivre }: {
  projet: string; portee: Portee; nature: Nature; sujets: Personnage[]
  filtre?: FiltreDeSortie
  apercuRepris: ApercuLivraison | null
  onApercuReprisConsomme: () => void
  onLivre: () => void
}) {
  if (nature === "son") return <SonsALivrer projet={projet} />
  if (nature === "tuiles") return <PaquetTuiles projet={projet} jeuInitial={filtre?.genre === "tuiles" ? filtre.jeu : ""} />
  if (nature === "image") {
    const sujet = sujetDe(portee, sujets)
    return sujet ? <PaquetImage projet={projet} sujet={sujet} onLivre={onLivre} apercuInitial={apercuRepris} onConsomme={onApercuReprisConsomme} /> : <p className="text-[13px] text-encre-3">Crée un sujet pour livrer une image.</p>
  }
  return <PaquetAnimation projet={projet} portee={portee} sujets={sujets} onLivre={onLivre} apercuRepris={apercuRepris} onApercuReprisConsomme={onApercuReprisConsomme} />
}

/** L'historique des paquets Godot — **au jeu entier**, image comme animation
 *  comprises. « Relire cette livraison » restaure la portée et la nature qui
 *  l'ont produite, et affiche son aperçu sans repasser par la préparation. */
function HistoriqueDesPaquets({ historique, occupe, onReprendre }: {
  historique: LivraisonGodot[]; occupe: boolean; onReprendre: (l: LivraisonGodot) => void
}) {
  if (!historique.length) return null
  return <section aria-label="Historique">
    <Intitule enfants="La dernière sortie" />
    <ul className="flex flex-col gap-[8px] pt-[8px]">{historique.map((l, i) => <li key={l.jeton || l.revision || i} className="rounded-7 border border-trait bg-carte p-[14px] text-[13px]">
      <p>{l.nom ? `${l.nom} · ` : ""}{l.nature === "image" ? "Image fixe · " : ""}Révision {l.revision.slice(0, 8)} · {({ preparee: "À relire", en_cours: "En cours", interrompue: "Interrompue", terminee: "Livrée" })[l.etat ?? "preparee"]}</p>
      <p className="break-all text-[11.5px] text-encre-3">Scène à utiliser dans le jeu : {l.scene}</p>
      <button className={`${bouton} mt-[8px]`} disabled={occupe} onClick={() => onReprendre(l)}>Relire cette livraison</button>
    </li>)}</ul>
  </section>
}

function PaquetImage({ projet, sujet, onLivre, apercuInitial, onConsomme }: {
  projet: string; sujet: string; onLivre: () => void
  apercuInitial: ApercuLivraison | null; onConsomme: () => void
}) {
  const [apercu, setApercu] = useState<ApercuLivraison | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (!apercuInitial) return
    setApercu(apercuInitial)
    onConsomme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apercuInitial])
  return <div className="flex flex-col gap-[14px]">
    <ImagesALivrer projet={projet} personnage={sujet} associe onApercu={setApercu} onInvalider={() => setApercu(null)} onOccupation={setOccupe} />
    {apercu && <CartePaquet projet={projet} apercu={apercu} onApercu={setApercu} onLivre={onLivre} />}
    {occupe && <p role="status" className="text-[12px] text-encre-3">Préparation…</p>}
  </div>
}

function PaquetTuiles({ projet, jeuInitial }: { projet: string; jeuInitial?: string }) {
  const [jeux, setJeux] = useState<EnsembleTuiles[]>([])
  const [jeuId, setJeuId] = useState(jeuInitial || "")
  const [apercu, setApercu] = useState<ApercuLivraison | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => { tuiles.lister(projet).then((r) => { const l = Array.isArray(r) ? r : []; setJeux(l); if (!jeuId && l[0]) setJeuId(l[0].identifiant) }).catch((e) => setErreur(e instanceof Error ? e.message : "Les jeux de tuiles n’ont pas pu être lus.")) }, [projet])
  const jeu = jeux.find((j) => j.identifiant === jeuId)
  useEffect(() => {
    if (!jeu) return
    let vivant = true
    tuiles.prevoir(projet, jeu.identifiant, jeu.revision).then((a) => { if (vivant) setApercu(a) }).catch((e) => vivant && setErreur(e instanceof Error ? e.message : "La livraison n’a pas pu être préparée."))
    return () => { vivant = false }
  }, [projet, jeu?.identifiant, jeu?.revision])
  if (erreur) return <p role="alert" className="text-[13px] text-echec">{erreur}</p>
  if (!jeux.length) return <p className="text-[13px] text-encre-3">Ce jeu n’a pas encore de jeu de tuiles.</p>
  return <div className="flex flex-col gap-[14px]">
    <label className="flex flex-col gap-[4px] text-[13px]">Jeu de tuiles
      <select className={champ} value={jeuId} onChange={(e) => { setApercu(null); setJeuId(e.target.value) }}>
        {jeux.map((j) => <option key={j.identifiant} value={j.identifiant}>{j.nom}</option>)}
      </select>
    </label>
    {apercu ? <CartePaquet projet={projet} apercu={apercu} onApercu={setApercu} /> : <p className="text-[13px] text-encre-3">Préparation…</p>}
  </div>
}

function PaquetAnimation({ projet, portee, sujets, onLivre, apercuRepris, onApercuReprisConsomme }: {
  projet: string; portee: Portee; sujets: Personnage[]; onLivre: () => void
  apercuRepris: ApercuLivraison | null; onApercuReprisConsomme: () => void
}) {
  if (portee.genre === "tout" || portee.genre === "famille") {
    const personnages = portee.genre === "famille" ? sujets.filter((s) => s.famille === portee.famille).map((s) => s.identifiant) : undefined
    return <PaquetsDuJeu projet={projet} personnages={personnages} onLivre={onLivre} />
  }
  return <PaquetSujet projet={projet} sujet={sujetDe(portee, sujets)} sujets={sujets} onLivre={onLivre} apercuInitial={apercuRepris} onConsomme={onApercuReprisConsomme} />
}

function PaquetsDuJeu({ projet, personnages, onLivre }: { projet: string; personnages: string[] | undefined; onLivre: () => void }) {
  const [paquets, setPaquets] = useState<ApercuLivraison[]>([])
  const [ecartes, setEcartes] = useState<{ personnage: string; nom: string; raison: string }[]>([])
  const [erreur, setErreur] = useState("")
  const [charge, setCharge] = useState(false)
  useEffect(() => {
    let vivant = true
    setCharge(false)
    api.prevoirLivraisonsDuJeu(projet, personnages).then((r) => { if (vivant) { setPaquets(r.paquets ?? []); setEcartes(r.ecartes ?? []) } })
      .catch((e) => vivant && setErreur(e instanceof Error ? e.message : "La préparation n’a pas abouti."))
      .finally(() => vivant && setCharge(true))
    return () => { vivant = false }
  }, [projet, personnages?.join(",")])
  if (erreur) return <p role="alert" className="text-[13px] text-echec">{erreur}</p>
  if (!charge) return <p role="status" className="text-[13px] text-encre-3">Préparation des paquets…</p>
  return <div className="flex flex-col gap-[22px]">
    {!paquets.length && <p className="text-[13px] text-encre-3">Aucune animation livrable pour cette portée.</p>}
    {paquets.map((p, i) => <CartePaquet key={p.jeton || i} projet={projet} apercu={p} onApercu={(a) => setPaquets((ps) => ps.map((x, j) => j === i ? a : x))} onLivre={onLivre} titre={p.nom || p.personnage || undefined} />)}
    {!!ecartes.length && <div className="flex flex-col gap-[8px]">
      <Intitule enfants="Pas prêt" />
      {ecartes.map((e) => <p key={e.personnage} className="text-[12.5px] text-encre-attention">{e.nom} : {e.raison}</p>)}
    </div>}
  </div>
}

function PaquetSujet({ projet, sujet, sujets, onLivre, apercuInitial, onConsomme }: {
  projet: string; sujet: string; sujets: Personnage[]; onLivre: () => void
  apercuInitial: ApercuLivraison | null; onConsomme: () => void
}) {
  const [choisies, setChoisies] = useState<string[]>([])
  const [boucles, setBoucles] = useState<Record<string, boolean>>({})
  const [pivot, setPivot] = useState({ x: "", y: "" })
  const [apercu, setApercu] = useState<ApercuLivraison | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const requete = useRef(0)
  const perso = sujets.find((s) => s.identifiant === sujet)
  const [bandes, brouillons] = useMemo(() => {
    const uniques = new Map<string, Bande>()
    const sansCase = new Map<string, Bande>()
    for (const c of perso?.cases ?? []) for (const b of c.bandes ?? [])
      if (!b.supprime && b.compte > 0) (b.brouillon ? sansCase : uniques).set(b.identifiant, b)
    return [[...uniques.values()], [...sansCase.values()]] as const
  }, [perso])

  useEffect(() => { setChoisies([]); setBoucles({}); setApercu(null); requete.current++ }, [sujet])

  useEffect(() => {
    if (!apercuInitial) return
    setChoisies(apercuInitial.animations.map((a) => a.bande || a.identifiant || "").filter(Boolean))
    setBoucles(Object.fromEntries(apercuInitial.animations.map((a) => [a.bande || a.identifiant || "", a.boucle ?? true])))
    if (apercuInitial.pivot) setPivot({ x: String(apercuInitial.pivot.x), y: String(apercuInitial.pivot.y) })
    setApercu(apercuInitial)
    onConsomme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apercuInitial])

  async function prevoir() {
    const numero = ++requete.current
    setOccupe(true); setErreur("")
    try {
      const lu = await api.prevoirLivraison(projet, {
        personnage: sujet, bandes: choisies, boucles,
        ...(pivot.x !== "" ? { pivot_x: Number(pivot.x) } : {}),
        ...(pivot.y !== "" ? { pivot_y: Number(pivot.y) } : {}),
      })
      if (numero === requete.current) setApercu(lu)
    } catch (e) { if (numero === requete.current) setErreur(e instanceof Error ? e.message : "La livraison n’a pas pu être préparée.") }
    finally { setOccupe(false) }
  }
  function invalider() { requete.current++; setApercu(null) }

  return <div className="flex flex-col gap-[14px]">
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {sujet && <SonsDuSujetALivrer projet={projet} sujet={sujet} />}
    {!bandes.length && <p className="text-[13px] text-encre-3">Ce sujet n’a pas encore d’animation. Crée ou importe un clip, puis garde une bande dans le montage.</p>}
    {!!brouillons.length && <p role="status" className="rounded-7 border border-trait bg-papier-cote p-[8px] text-[11.5px] text-encre-3">
      {brouillons.length} brouillon{brouillons.length > 1 ? "s" : ""} mis de côté : {brouillons.map(b => b.nom).join(", ")}. Donne-leur leur mouvement et leur direction pour pouvoir les livrer — sans case visée, leur nom dans le jeu changerait le jour où on les range.
    </p>}
    {bandes.length > 1 && <div className="flex flex-wrap items-center gap-[8px]">
      <button className={bouton} disabled={choisies.length === bandes.length} onClick={() => { invalider(); setChoisies(bandes.map(b => b.identifiant)) }}>Tout sélectionner</button>
      <button className={bouton} disabled={!choisies.length} onClick={() => { invalider(); setChoisies([]) }}>Tout décocher</button>
      <span className="text-[11.5px] text-encre-3">{choisies.length} sur {bandes.length}</span>
    </div>}
    <div className="flex flex-col gap-[8px]">
      {bandes.map(b => <div key={b.identifiant} className="flex flex-wrap items-center gap-[14px] rounded-7 border border-trait p-[8px]">
        <label className="flex min-w-0 flex-1 items-center gap-[14px]"><input type="checkbox" checked={choisies.includes(b.identifiant)} onChange={e => { invalider(); setChoisies(c => e.target.checked ? [...c, b.identifiant] : c.filter(id => id !== b.identifiant)) }} />
          <BandeQuiTourne bande={b} cote={54} /><span><strong className="block text-[13px]">{b.nom}</strong><span className="text-[11.5px] text-encre-3">{b.pose} · {b.direction || "Sans direction"} · {b.compte} frames · {b.cadence} i/s{b.favori ? " · Retenue" : ""}</span></span>
        </label>
        <label className="flex items-center gap-[8px] text-[11.5px]"><input type="checkbox" checked={boucles[b.identifiant] ?? true} onChange={e => { invalider(); setBoucles(c => ({ ...c, [b.identifiant]: e.target.checked })) }} />Jouer en boucle</label>
      </div>)}
    </div>
    <details><summary className="cursor-pointer text-[13px]">Repère du personnage dans Godot</summary><p className="py-[8px] text-[11.5px] text-encre-3">En pixels de l’image exportée. Vide : le centre du pied. Le même repère s’applique aux animations sélectionnées.</p>
      <div className="flex gap-[14px]">{(["x", "y"] as const).map(axe => <label key={axe} className="text-[13px]">{axe.toUpperCase()} <input type="number" className={`${champ} w-[70px]`} value={pivot[axe]} onChange={e => { invalider(); setPivot(p => ({ ...p, [axe]: e.target.value })) }} /></label>)}</div>
    </details>
    <button className={`${bouton} self-start`} disabled={!choisies.length || occupe} onClick={prevoir}>Relire {choisies.length || "les"} animation{choisies.length !== 1 ? "s" : ""} à livrer</button>
    {apercu && <CartePaquet projet={projet} apercu={apercu} onApercu={setApercu} onLivre={onLivre} />}
  </div>
}
