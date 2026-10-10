import { useCallback, useEffect, useMemo, useState } from "react"
import { api, Refus, type Appel, type Generation, type Statut } from "./api"
import { nomDuTravail, travaux, type Travail, type TravailSuivi } from "./api-travaux"
import { fileLocale, type EtapeLocale } from "./api-file-locale"
import type { TravailImageLocale } from "./api-workflows"
import type { TravailEquipement } from "./api-travaux-equipement"
import { nomDuModele } from "./composants/Fiche"
import { libelleModele } from "./composants/pieces"

// ── RV9 : une seule liste de fabrications ───────────────────────────────────
//
// Trois listes vivaient côte à côte sur l'écran Fabrications : « Créer et
// suivre » (les travaux suivis), « Les calculs locaux » (la file locale) et
// « Rechercher une fabrication » (le journal des appels). La même fabrication
// pouvait déjà y paraître deux fois — un travail garde `generation_image`,
// `clip` et `etape_locale`, les identifiants **des mêmes lignes** que le
// journal et la file locale connaissent sous leur propre nom : ce ne sont pas
// trois fabrications, c'est une fabrication racontée à trois endroits.
//
// La fusion ci-dessous **retire** du journal et de la file locale ce qu'un
// travail porte déjà, avant de tout trier ensemble par date de départ. Elle
// vit ici, dans le seul écran qui la montre — une route serveur n'apportait
// rien que le client n'ait déjà : `generation_image`, `clip` et
// `etape_locale` voyagent tous les trois dans le JSON d'un travail depuis
// leur tranche d'origine, seul leur type TypeScript manquait.

/** Les quatre humeurs qu'un filtre reconnaît, toutes origines confondues — un
 *  travail suivi, un calcul local ou une ligne du journal. Une fabrication
 *  encore « prête à lancer » (jamais partie) n'en porte aucune : elle vit dans
 *  le tiroir des brouillons, pas ici — cette liste ne montre que ce qui est
 *  **parti**. */
export type Humeur = "en_cours" | "terminee" | "ratee" | "a_reprendre"
export const NOM_DE_L_HUMEUR: Record<Humeur, string> = { en_cours: "En cours", terminee: "Terminées", ratee: "Ratées", a_reprendre: "À reprendre" }
export const NATURES_LOCALES: Record<EtapeLocale["nature"], string> = { image: "Image", video: "Vidéo", modele3d: "Modèle 3D", rig: "Rigging", rendu3d: "Rendu 3D", audio: "Son" }
export const LETTRES_LOCALES: Record<EtapeLocale["nature"], string> = { image: "I", video: "V", modele3d: "3D", rig: "3D", rendu3d: "3D", audio: "S" }

export function humeurDuTravail(etat: Travail["etat"]): Humeur | null {
  if (etat === "en_cours") return "en_cours"
  if (etat === "termine" || etat === "annule") return "terminee"
  if (etat === "a_verifier") return "ratee"
  if (etat === "a_reprendre" || etat === "externe_inconnu") return "a_reprendre"
  return null // "prepare" : pas encore parti, le tiroir des brouillons le porte déjà
}
export function humeurDeLAppel(statut: Statut): Humeur {
  if (statut === "en_attente" || statut === "en_cours") return "en_cours"
  if (statut === "reussie") return "terminee"
  if (statut === "echouee") return "ratee"
  return "a_reprendre"
}
export function humeurLocale(etat: EtapeLocale["etat"]): Humeur {
  if (etat === "en_attente" || etat === "en_cours") return "en_cours"
  if (etat === "termine" || etat === "annule") return "terminee"
  if (etat === "echoue") return "ratee"
  return "a_reprendre"
}
// La série d'un travail d'animation (RV5/RV6) n'est pas encore typée sur
// `Travail` : un travail son (`TravailAudio`) porte un champ du même nom mais
// d'une autre forme (`{identifiant,rang}`, sans `cle`). Lire les deux à la
// prudence évite de figer un type commun aux deux, qui n'existe pas côté
// serveur.
export function cleDeLaSerieDuTravail(t: TravailSuivi): string | null {
  const s = (t as unknown as { serie?: { cle?: string; identifiant?: string } }).serie
  return s?.cle ?? s?.identifiant ?? null
}

export type LigneFabrication = {
  cle: string
  origine: "travail" | "locale" | "appel"
  titre: string
  sousTitre: string
  humeur: Humeur
  raison: string | null
  laceLe: number
  serieCle: string | null
  vignette: { src: string | null; lettre: string }
  travail?: TravailSuivi
  locale?: EtapeLocale
  appel?: Appel
  generation?: Generation
}

/** **RV9 : le regroupement d'une série.** Deux lignes se regroupent quand le
 *  serveur leur connaît la même série (RV5/RV6 : plusieurs clips d'une même
 *  case, ou plusieurs directions lancées d'un coup). Sans série — un son ou un
 *  calcul local relancés à la main plusieurs fois de suite —, elles se
 *  regroupent quand elles partagent l'origine et le titre et sont parties à
 *  moins d'une minute d'écart : passé la minute, ce n'est plus le même geste. */
export function cleDeGroupe(l: LigneFabrication): string {
  if (l.serieCle) return `serie:${l.serieCle}`
  return `seule:${l.origine}:${l.titre}:${Math.floor(l.laceLe / 60)}`
}

export const LETTRE_DU_TRAVAIL: Record<string, string> = { equipement: "É", audio: "S", "3d": "3D", "image-locale": "I", "video-libre": "V" }

/** **Quatre champs qu'un travail d'animation porte, et que deux natures
 *  (équipement, 3D) ne portent pas du tout** — `TravailEquipement` et
 *  `Travail3D` ne dérivent pas de `Travail` (`api-travaux-equipement.ts`,
 *  `api-3d.ts`). Lus à la prudence plutôt que d'importer les cinq types
 *  satellites pour un champ optionnel chacun : à l'exécution, ils sont
 *  simplement absents pour les natures qui ne les portent pas. */
export function champsAnimes(t: TravailSuivi) {
  return t as unknown as { clip?: string | null; entree_video?: { url: string }; lance_le?: number; modifie_le?: number; generation_image?: string | null; etape_locale?: string | null }
}

export function vignetteDuTravail(t: TravailSuivi): { src: string | null; lettre: string } {
  const anime = t.nature === undefined || t.nature === "animation" || t.nature === "video-libre"
  const { clip, entree_video: entreeVideo } = champsAnimes(t)
  if (anime && clip && t.etat === "termine") return { src: api.couvertureDuClip(clip, 108), lettre: "" }
  if ((t.nature === undefined || t.nature === "animation") && entreeVideo) return { src: entreeVideo.url, lettre: "" }
  // **RV9, retour de l'auteur du 23 septembre** : une image locale terminée
  // montre l'image qu'elle a produite (`assets`, posé à l'arrivée par
  // `travaux_workflow.py`) ; une pièce d'équipement montre la première case
  // déjà couverte, dès qu'elle en a une — pas seulement le travail entier
  // terminé, une pièce pouvant couvrir certaines cases avant les autres.
  if (t.nature === "image-locale") { const assets = (t as TravailImageLocale).assets; if (t.etat === "termine" && assets?.length) return { src: api.vignette(assets[0], "", 108), lettre: "" } }
  if (t.nature === "equipement") { const cibles = (t as TravailEquipement).cibles; if (cibles?.length) return { src: cibles[0].url, lettre: "" } }
  return { src: null, lettre: LETTRE_DU_TRAVAIL[t.nature ?? "animation"] ?? "A" }
}

/** Le sujet d'un texte composé (`atelier/domaine/envoi.py`, `TITRE`) : ce qui
 *  suit `REQUEST`. Un texte qui n'a pas de titres est rendu tel quel. Filet
 *  pour le seul cas où le journal n'a pas encore la ligne. */
export function texteDeLAuteur(prompt: string): string {
  const lignes = prompt.split(/\r?\n/)
  const debut = lignes.findIndex((l) => l.trim() === "REQUEST")
  if (debut < 0) return prompt
  const suite = lignes.slice(debut + 1)
  const fin = suite.findIndex((l) => /^(CONTEXT|REFERENCES|REQUEST)$/.test(l.trim()))
  return (fin < 0 ? suite : suite.slice(0, fin)).join("\n").trim() || prompt
}

const message = (e: unknown) => e instanceof Refus ? e.message : "Impossible de relire cette fabrication. Réessayez."

/** **La liste des fabrications, une seule règle pour deux lecteurs** : l'écran
 *  Fabrications (`SuiviDesTravaux`) et le pied du carnet (`SuiviDuCarnet`).
 *  Chacun monte sa propre copie du crochet — deux relectures toutes les cinq
 *  secondes quand l'écran est ouvert, sur la machine même —, mais la fusion
 *  n'existe qu'ici. */
export function useLignesDeFabrication({ projet, personnages, chantier, clips }: {
  projet: string | null; personnages: readonly { identifiant: string; nom: string }[]
  chantier: readonly Generation[]; clips: readonly Generation[]
}) {
  const [liste, setListe] = useState<TravailSuivi[]>([])
  const [appels, setAppels] = useState<Appel[]>([])
  const [locales, setLocales] = useState<EtapeLocale[]>([])
  const [erreur, setErreur] = useState("")
  const [tour, setTour] = useState(0)
  // **RV9, retour de l'auteur du 23 septembre : plus d'identifiant technique.**
  // Le journal et la file locale ne connaissent chacun qu'une chaîne brute
  // (« ComfyUI:qwen21-qualite@empreinte… ») ; le nom lisible qu'`RV4` a mis
  // partout ailleurs (`libelleModele`) vient du catalogue des modèles, image
  // et vidéo, chargé une fois ici — jamais recalculé depuis la chaîne.
  const [catalogueModeles, setCatalogueModeles] = useState<Map<string, { nom: string; fournisseur: string }>>(new Map())
  useEffect(() => {
    let vivant = true
    // `allSettled` : un catalogue qui échoue (vidéo, par exemple, sans clip en
    // cours) ne doit pas priver l'autre de ses noms.
    Promise.allSettled([api.modeles("1:1"), api.modelesVideo(1.5, "480p", "1:1")])
      .then((resultats) => {
        if (!vivant) return
        const carte = new Map<string, { nom: string; fournisseur: string }>()
        for (const r of resultats) if (r.status === "fulfilled") for (const m of r.value.modeles) carte.set(m.identifiant, { nom: m.nom, fournisseur: m.fournisseur })
        setCatalogueModeles(carte)
      })
    return () => { vivant = false }
  }, [])

  useEffect(() => {
    if (!projet) { setListe([]); return }
    let vivant = true
    const lire = () => void travaux.lister(projet).then((r) => { if (vivant) setListe(r) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    lire(); const intervalle = window.setInterval(lire, 5000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet, tour])
  useEffect(() => {
    let vivant = true
    const lire = () => void api.journal(projet).then((j) => { if (vivant) setAppels(j.appels) }).catch(() => {})
    lire(); const intervalle = window.setInterval(lire, 5000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet])
  useEffect(() => {
    let vivant = true
    const lire = () => void fileLocale.lire().then((f) => { if (vivant) setLocales(f.etapes) }).catch(() => {})
    lire(); const intervalle = window.setInterval(lire, 5000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [])

  const lignes = useMemo<LigneFabrication[]>(() => {
    const libelleDuModele = (identifiant: string): string => {
      const m = catalogueModeles.get(identifiant)
      return m ? libelleModele(m) : nomDuModele(identifiant)
    }
    const generationsDeTravaux = new Set(liste.flatMap((t) => { const c = champsAnimes(t); return [c.generation_image, c.clip].filter((x): x is string => !!x) }))
    const etapesDeTravaux = new Set(liste.map((t) => champsAnimes(t).etape_locale).filter((x): x is string => !!x))

    const deTravaux: LigneFabrication[] = liste.flatMap((t) => {
      const h = humeurDuTravail(t.etat)
      if (!h) return []
      return [{
        cle: `travail:${t.identifiant}`, origine: "travail" as const,
        titre: nomDuTravail(t, personnages), sousTitre: t.acteur === "agent" ? "Agent" : "Création manuelle",
        humeur: h, raison: h !== "en_cours" ? (t.raison ?? null) : null,
        laceLe: champsAnimes(t).lance_le ?? champsAnimes(t).modifie_le ?? t.cree_le, serieCle: cleDeLaSerieDuTravail(t),
        vignette: vignetteDuTravail(t), travail: t,
      }]
    })

    // **Le même mélange qu'avant RV9** (chantier et clips l'emportent sur le
    // journal à identifiant égal, RP11) — sauf ce qu'un travail porte déjà.
    const parGeneration = new Map<string, { appel: Appel; generation?: Generation }>()
    appels.forEach((a) => { if (!generationsDeTravaux.has(a.identifiant)) parGeneration.set(a.identifiant, { appel: a }) })
    // ⚠️ Le flux porte le texte **composé** (« CONTEXT … REQUEST … ») ; le
    // journal, celui que l'auteur a tapé. Le statut vient du flux, plus frais ;
    // le texte et l'image produite, du journal quand il les a (27 septembre 2026).
    ;[...clips, ...chantier].filter((g) => g.projet === projet && !generationsDeTravaux.has(g.identifiant)).forEach((g) => {
      const duJournal = parGeneration.get(g.identifiant)?.appel
      parGeneration.set(g.identifiant, { appel: { identifiant: g.identifiant, modele: g.modele, prompt: duJournal?.prompt ?? texteDeLAuteur(g.demande.prompt), cree_le: g.cree_le, cout_usd: g.cout_usd, statut: g.statut, reussies: g.reussies, rates: duJournal?.rates ?? [], vignette: duJournal?.vignette ?? null }, generation: g })
    })
    const dAppels: LigneFabrication[] = [...parGeneration.values()].map(({ appel: a, generation: g }) => ({
      cle: `appel:${a.identifiant}`, origine: "appel" as const,
      titre: a.prompt || "Demande sans texte", sousTitre: libelleDuModele(a.modele),
      humeur: humeurDeLAppel(a.statut), raison: a.rates.find((r) => r.raison)?.raison ?? null,
      laceLe: a.cree_le, serieCle: null,
      // **RV9, retour de l'auteur du 23 septembre** : un clip garde sa
      // couverture ; une image lit l'asset que le journal joint désormais
      // (`vignette`, servi par `bibliotheque.journal`) — plus de carré gris
      // pour un appel réussi dont l'image existe toujours.
      vignette: g?.clip ? { src: api.couvertureDuClip(a.identifiant, 108), lettre: "" }
        : a.vignette ? { src: api.vignette(a.vignette, "", 108), lettre: "" }
        : { src: null, lettre: "I" },
      appel: a, generation: g,
    }))

    const deLocales: LigneFabrication[] = locales
      .filter((e) => !etapesDeTravaux.has(e.identifiant) && (e.projet === projet || e.projet === null))
      .map((e) => ({
        cle: `locale:${e.identifiant}`, origine: "locale" as const,
        titre: `${NATURES_LOCALES[e.nature]} · ${libelleDuModele(e.modele)}`, sousTitre: e.acteur === "agent" ? "Agent" : "Création manuelle",
        humeur: humeurLocale(e.etat), raison: e.raison || null,
        laceLe: e.cree_le, serieCle: null,
        vignette: { src: null, lettre: LETTRES_LOCALES[e.nature] },
        locale: e,
      }))

    return [...deTravaux, ...dAppels, ...deLocales].sort((a, b) => b.laceLe - a.laceLe)
  }, [liste, appels, locales, chantier, clips, projet, personnages, catalogueModeles])

  /** Relire les travaux tout de suite — à la fermeture d'une fenêtre de
   *  travail, qui a pu en changer l'état. */
  const relireLesTravaux = useCallback(() => setTour((n) => n + 1), [])
  /** Ce qu'un geste sur une étape locale vient de changer, sans attendre le
   *  prochain tour de la file. */
  const poserEtatLocal = useCallback((identifiant: string, etat: EtapeLocale["etat"]) =>
    setLocales((ls) => ls.map((x) => x.identifiant === identifiant ? { ...x, etat } : x)), [])
  return { lignes, erreur, setErreur, relireLesTravaux, poserEtatLocal }
}
