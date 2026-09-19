// **Les sons, dans « Livrer au jeu »** (maquette `son.js`, `vueLivrer`) :
// rangés par famille, un jeu de variantes comme un seul son, les sons d'un
// sujet sous son nom (ils partent aussi avec lui). Chacun se relit et se livre
// par l'aperçu qui existe déjà : rien n'est écrit tant qu'on n'a pas livré.
import { useEffect, useState } from "react"
import { jeuxDeVariantes, type FamilleSon, type JeuVariantes } from "../api-series-son"
import { sonsDuSujet, type LigneIndex } from "../api-sons-du-sujet"
import { sons as apiSons, type Son } from "../api-sons"
import { ApercuLivraisonSon } from "./ApercuLivraisonSon"

const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const ORDRE: (FamilleSon | "aucune")[] = ["bruitage", "interface", "ambiance", "musique", "jingle", "chanson", "voix", "aucune"]
const TITRES: Record<FamilleSon | "aucune", string> = { bruitage: "Bruitages", interface: "Interface et rétro", ambiance: "Ambiances", musique: "Musique", jingle: "Jingles", chanson: "Chansons", voix: "Voix", aucune: "Sans famille" }
const message = (e: unknown) => e instanceof Error ? e.message : "Les sons du jeu n’ont pas pu être lus."

type Ligne = { cle: string; titre: string; famille: FamilleSon | "aucune"; detail: string; sujet: string | null; son?: Son; jeu?: JeuVariantes }

/** Les lignes à livrer : chaque jeu de variantes, puis chaque son qui n'est
 *  dans aucun jeu. Un son sans sujet reste un son du jeu, et se liste ici. */
export function lignesALivrer(sons: Son[], jeux: JeuVariantes[], index: LigneIndex[]): Ligne[] {
  const duSujet = (nature: "jeu" | "son", id: string) => index.find((i) => i.contenu.nature === nature && i.contenu.identifiant === id)
  const dansUnJeu = new Set(jeux.flatMap((j) => j.sons))
  const lignes: Ligne[] = jeux.filter((j) => j.membres.length > 0).map((j) => {
    const i = duSujet("jeu", j.identifiant)
    return { cle: `jeu-${j.identifiant}`, titre: j.nom, famille: j.famille ?? "aucune", jeu: j, sujet: i ? `${i.nom_sujet} › ${i.nom}` : null,
      detail: j.a_livrer.length > 1 ? `${j.a_livrer.length} variantes · le jeu en joue une au hasard` : j.a_livrer.length ? "un son" : "rien de livrable pour l’instant" }
  })
  for (const s of sons) {
    if (dansUnJeu.has(s.identifiant)) continue
    const i = duSujet("son", s.identifiant)
    // Un tirage d'une série que personne n'a gardé ne part pas au jeu :
    // la maquette ne livre que ce qui est gardé.
    if (s.provenance?.serie && !i) continue
    lignes.push({ cle: `son-${s.identifiant}`, titre: s.nom, famille: s.famille ?? "aucune", son: s, sujet: i ? `${i.nom_sujet} › ${i.nom}` : null,
      detail: s.recette.boucle ? "en boucle" : "un son" })
  }
  return lignes
}

export function SonsALivrer({ projet }: { projet: string }) {
  const [lignes, setLignes] = useState<Ligne[] | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let vivant = true
    Promise.all([apiSons.lister(projet), jeuxDeVariantes.lister(projet), sonsDuSujet.index(projet).catch(() => [] as LigneIndex[])])
      .then(([s, j, i]) => { if (vivant) setLignes(lignesALivrer(s, j, i)) })
      .catch((e) => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet])
  if (erreur) return <p role="alert" className="text-[13px] text-echec">{erreur}</p>
  if (!lignes) return <p className="text-[13px] text-encre-3">Lecture des sons du jeu…</p>
  if (!lignes.length) return <p className="text-[13px] text-encre-3">Le jeu n’a pas encore de son. Fabriquez-en un dans Fabrications › Un son, ou depuis l’onglet Sons d’un sujet.</p>
  return <div className="grid gap-[22px]">
    {ORDRE.filter((f) => lignes.some((l) => l.famille === f)).map((f) => <section key={f} aria-label={TITRES[f]} className="grid gap-[8px]">
      <h3 className="font-serif text-[25px]">{TITRES[f]}</h3>
      {f === "aucune" && <p className="text-[12px] text-encre-3">Posez-leur une famille sur leur fiche pour qu’ils partent en fichiers prêts pour le jeu.</p>}
      {lignes.filter((l) => l.famille === f).map((l) => <div key={l.cle} className="grid gap-[8px] rounded-7 border border-trait p-[8px]">
        <div className="flex flex-wrap items-center gap-[14px]">
          <span className="min-w-0 flex-1"><strong className="block text-[13px]">{l.titre}</strong>
            <span className="text-[12px] text-encre-3">{l.detail}{l.sujet ? ` · part aussi avec ${l.sujet}` : ""}</span></span>
          <button type="button" className={BOUTON} aria-expanded={ouverte === l.cle} onClick={() => setOuverte((o) => o === l.cle ? null : l.cle)}>Voir ce qui part au jeu</button>
        </div>
        {ouverte === l.cle && <ApercuLivraisonSon projet={projet} son={l.son} jeu={l.jeu} />}
      </div>)}
    </section>)}
  </div>
}

/** Dans la livraison d'un sujet : les sons qui partent avec lui, sous leurs noms stables. */
export function SonsDuSujetALivrer({ projet, sujet }: { projet: string; sujet: string }) {
  const [remplis, setRemplis] = useState<{ nom: string; nom_stable: string; n: number }[]>([])
  useEffect(() => {
    let vivant = true
    setRemplis([])
    sonsDuSujet.lire(projet, sujet)
      .then((v) => { if (vivant) setRemplis(v.emplacements.filter((e) => e.rempli && e.contenu?.a_livrer.length).map((e) => ({ nom: e.nom, nom_stable: e.nom_stable, n: e.contenu!.a_livrer.length }))) })
      .catch(() => {})
    return () => { vivant = false }
  }, [projet, sujet])
  if (!remplis.length) return null
  return <p className="text-[12px] text-encre-3">Ses sons partent avec lui : {remplis.map((r) => `${r.nom.toLowerCase()} (${r.nom_stable}${r.n > 1 ? `, ${r.n} variantes` : ""})`).join(" · ")}.</p>
}
