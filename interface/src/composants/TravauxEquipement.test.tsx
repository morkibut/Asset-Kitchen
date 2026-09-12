import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { api } from "../api"
import { equipements, type CouvertureEquipement, type TravailEquipement } from "../api-travaux-equipement"
import { RelectureEquipement } from "./RelectureEquipement"
import { CouvertureDeLEmploi } from "./CouvertureDeLEmploi"
import { TravailConserve } from "./FabricationSuivie"
import { travaux } from "../api-travaux"

const chemin = { projet: "marais", piece: "casque", emploi: "porte-pelerin" }
const cible = { nature: "frame" as const, resultat: "marche-1", prise: "occurrence-1" }
const t = { nature: "equipement", identifiant: "travail-1", projet: "marais", piece: "casque", emploi: "porte-pelerin", acteur: "auteur", cle: "cle-initiale", cree_le: 123, etat: "prepare", etape: "relecture",
  demande: { cle: "cle-initiale", modele: "essai:image", cibles: [cible], methode: "planches", cases_par_planche: 4, occupation: .63, prompt: "Un casque", references: ["reference-casque"], options: { quality: "high" } },
  piece_fiche: { nom: "Casque" }, catalogue: { modele: "essai:image", fournisseur: "essai", references_max: 2, capacite_cases_max: null, capacite_explication: "Aucune limite de cases déclarée par le catalogue." },
  annonce: { images_ciblees: 1, planches: 1, appels: 1, reservation_usd: .12, limite: "Le prix d’un appel, pas d’une case.", origine: "Pliage 2D" },
  cibles: [{ cible, base: { pose: "marche", direction: "ouest" }, url: "/base-figee.png", variante: null }],
  appels: [{ numero: 0, generation: "gen-1", cibles: [0], etat: "prepare", snapshot: { prompt: "Texte final complet avec les consignes", prompt_negatif: "sans cornes", proportions: "1:1", resolution: "1K", options: { quality: "high" } },
    references: [{ url: "/planche-figee.png", reference: { asset: "planche", role: "edition" } }, { url: "/ref-figee.png", reference: { asset: "reference-casque", role: "reference" } }], hors_plafond: [], reservation_usd: .12,
    pliage: { occupation: .63, colonnes: 1, lignes: 1, attend_un_choix: false }, consommation_annoncee: { montant: .11, unite: "usd", mesuree: true } }], variantes: [], consommations: [],
} as unknown as TravailEquipement

beforeEach(() => {
  // La sélection et la lecture vivent dans le stockage de séance : un essai qui
  // en laisserait derrière lui déciderait de l'écran du suivant.
  sessionStorage.clear()
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [{ identifiant: "essai:image", references_max: 2, resolutions: ["1K", "2K"], options: { quality: { nom: "Qualité", genre: "choix", valeurs: ["low", "high"] } }, refus: null }] } as unknown as Awaited<ReturnType<typeof api.modeles>>)
  vi.spyOn(equipements, "preparer").mockImplementation(async (_c, demande) => ({ ...t, identifiant: "nouveau-travail", demande }))
  vi.spyOn(equipements, "demarrer").mockResolvedValue({ ...t, etat: "en_cours" })
  vi.spyOn(equipements, "lire").mockResolvedValue(t)
  vi.spyOn(equipements, "lister").mockResolvedValue([])
  vi.spyOn(equipements, "annuler").mockResolvedValue({ ...t, etat: "annule" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("relire montre les références figées, le modèle, la consommation et les cibles sans départ", () => {
  render(<RelectureEquipement chemin={chemin} initiale={t} onFermer={vi.fn()} />)
  expect(screen.getByText("Texte final complet avec les consignes")).toBeInTheDocument()
  expect(screen.getByAltText("Base 1")).toHaveAttribute("src", "/base-figee.png")
  expect(screen.getByAltText("Référence envoyée 2")).toHaveAttribute("src", "/ref-figee.png")
  expect(screen.getByText("images ciblées")).toBeInTheDocument()
  expect(screen.getByText("planches de bases")).toBeInTheDocument()
  expect(screen.getByText("appels distincts")).toBeInTheDocument()
  expect(screen.getByText("essai:image")).toBeInTheDocument()
  expect(equipements.demarrer).not.toHaveBeenCalled()
})

test("éditer un texte exact et retirer une référence crée une nouvelle relecture avant le lancement", async () => {
  render(<RelectureEquipement chemin={chemin} initiale={t} onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Passer en édition" }))
  expect(screen.getByLabelText("Place occupée par le corps (%)")).toHaveValue(63)
  fireEvent.change(screen.getByLabelText("Texte exact de l’appel 1"), { target: { value: "Casque corrigé, chaque corps inchangé" } })
  fireEvent.click(screen.getByRole("checkbox", { name: "Référence 1" }))
  fireEvent.click(screen.getByRole("button", { name: "Relire avant envoi" }))
  await waitFor(() => expect(equipements.preparer).toHaveBeenCalledOnce())
  const [c, d] = vi.mocked(equipements.preparer).mock.calls[0]
  expect(c).toEqual(chemin)
  expect(d.cle).not.toBe(t.cle)
  expect(d.textes_appels).toEqual({ "0": "Casque corrigé, chaque corps inchangé" })
  expect(d.references).toEqual([])
  expect(d.references_ecartees).toEqual(["reference-casque"])
  expect(equipements.demarrer).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole("button", { name: /Lancer 1 appel/ }))
  await waitFor(() => expect(equipements.demarrer).toHaveBeenCalledWith(chemin, "nouveau-travail"))
})

test("un retour s’ouvre sur la bonne occurrence et une reprise n’invente pas une nouvelle demande", async () => {
  const ouvrir = vi.fn()
  render(<RelectureEquipement chemin={chemin} initiale={{ ...t, etat: "a_verifier", cibles: [{ ...t.cibles[0], variante: "source-equipee-1" }], appels: [{ ...t.appels[0], retour_url: "/retour-recu.png", etat: "a-verifier" }] }} onFermer={vi.fn()} onCalque={ouvrir} />)
  expect(screen.getByAltText("Planche reçue de l’appel 1")).toHaveAttribute("src", "/retour-recu.png")
  fireEvent.click(screen.getByRole("button", { name: "Extraire / corriger" }))
  expect(ouvrir).toHaveBeenCalledWith(cible, "source-equipee-1")
  fireEvent.click(screen.getByRole("button", { name: "Reprendre les résultats conservés" }))
  await waitFor(() => expect(equipements.demarrer).toHaveBeenCalledWith(chemin, "travail-1", true))
  expect(equipements.preparer).not.toHaveBeenCalled()
})

test("la couverture n’invente aucune frame pour une animation absente et fabrique seulement les manques choisis", async () => {
  const compteur = { bases_attendues: 1, bases_absentes: 0, bases_a_choisir: 0, images_connues: 1, absente: 1, "a-extraire": 0, "a-verifier": 0, prete: 0, "a-revoir": 0 }
  const vue = { piece: { nom: "Casque" }, images: { ...compteur, bases_attendues: 0, images_connues: 0, absente: 0 }, animations: { ...compteur, bases_attendues: 2, bases_absentes: 1 }, cases: [
    { identifiant: "marche", nature: "animation", nom_pose: "Marche", nom_direction: "Ouest", demandee: true, versions: [{ resultat: "marche-1", nom: "Marche lente", choisie: true, etat: "retenue", images: [{ cible, rang: 0, etat: "absente", fabricable: true, variante: null }] }] },
    { identifiant: "course", nature: "animation", nom_pose: "Course", nom_direction: "Ouest", demandee: true, bases_absentes: 1, raison: "animation à produire ; son nombre de frames n’est pas encore connu", versions: [] },
  ] } as unknown as CouvertureEquipement
  vi.spyOn(equipements, "couverture").mockResolvedValue(vue)
  render(<CouvertureDeLEmploi chemin={chemin} onCalque={vi.fn()} />)
  expect(await screen.findByText(/1 animations à produire/)).toBeInTheDocument()
  expect(screen.getAllByRole("checkbox")).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Fabriquer les 1 manques" }))
  expect(await screen.findByLabelText("Fournisseur et modèle")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Fournisseur et modèle"), { target: { value: "essai:image" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant envoi" }))
  await waitFor(() => expect(equipements.preparer).toHaveBeenCalledOnce())
  expect(vi.mocked(equipements.preparer).mock.calls[0][1].cibles).toEqual([cible])
})

test("le suivi général rouvre une demande d’équipement sans lire les champs vidéo", async () => {
  vi.spyOn(travaux, "lireSuivi").mockResolvedValue(t)
  const ouvrir = vi.fn()
  render(<TravailConserve projet="marais" identifiant="travail-1" personnages={[]} onClip={vi.fn()} onBande={vi.fn()} onFermer={vi.fn()} onCalqueEquipement={ouvrir} />)
  expect(await screen.findByText("Texte final complet avec les consignes")).toBeInTheDocument()
  expect(screen.queryByText("Nom du personnage")).not.toBeInTheDocument()
  expect(equipements.demarrer).not.toHaveBeenCalled()
})

// ── US-537 · la référence de la pièce, annoncée avant l'envoi ───────────────
//
// Le serveur joint les références communes de la pièce de lui-même
// (`atelier/services/travaux_equipement.py`, rôle `style`). L'écran ne les
// montrait qu'après la préparation : l'auteur lisait « 0 référence » sur une
// pièce qui en envoyait deux, et ne le découvrait qu'une fois le texte composé.
test("les références communes de la pièce se voient et s’écartent avant la préparation", async () => {
  const compteur = { bases_attendues: 1, bases_absentes: 0, bases_a_choisir: 0, images_connues: 1, absente: 1, "a-extraire": 0, "a-verifier": 0, prete: 0, "a-revoir": 0 }
  const vue = { piece: { identifiant: "casque", nom: "Casque", references: ["ref-commune-1", "ref-commune-2"] },
    images: { ...compteur, bases_attendues: 0, images_connues: 0, absente: 0 },
    animations: compteur, cases: [
      { identifiant: "marche", nature: "animation", nom_pose: "Marche", nom_direction: "Ouest", demandee: true, versions: [{ resultat: "marche-1", nom: "Marche lente", choisie: true, etat: "retenue", images: [{ cible, rang: 0, etat: "absente", fabricable: true, variante: null }] }] },
    ] } as unknown as CouvertureEquipement
  vi.spyOn(equipements, "couverture").mockResolvedValue(vue)
  vi.spyOn(api, "lireAsset").mockImplementation(async (identifiant) => ({ identifiant, label: `Vue de ${identifiant}`, empreinte: identifiant } as Awaited<ReturnType<typeof api.lireAsset>>))
  render(<CouvertureDeLEmploi chemin={chemin} onCalque={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Fabriquer les 1 manques" }))
  expect(await screen.findByText("Références communes de Casque (2)")).toBeInTheDocument()
  // La vignette vient de la fiche relue, non d'un identifiant affiché brut.
  expect(await screen.findByAltText("Vue de ref-commune-1")).toBeInTheDocument()
  // Et les références ajoutées à cet envoi restent un compte distinct.
  expect(screen.getByText("Références ajoutées à cet envoi (0)")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Fournisseur et modèle"), { target: { value: "essai:image" } })
  fireEvent.click(screen.getByRole("checkbox", { name: "Référence commune 2" }))
  fireEvent.click(screen.getByRole("button", { name: "Relire avant envoi" }))
  await waitFor(() => expect(equipements.preparer).toHaveBeenCalledOnce())
  const envoye = vi.mocked(equipements.preparer).mock.calls[0][1]
  expect(envoye.references_ecartees).toEqual(["ref-commune-2"])
  // Décocher ne touche pas la fiche de la pièce : aucun réglage n'est écrit.
  expect(envoye.references).toEqual([])
  expect(equipements.demarrer).not.toHaveBeenCalled()
})

// ── AU16 · fermer pendant la lecture, puis rouvrir ─────────────────────────
//
// La bande se lit avec ses calques posés (« Vérifier en animation »). Ce qui
// doit revenir : la sélection, la bande choisie, la frame affichée, la lecture
// elle-même, puis — relues du serveur — les sources et les corrections. Aucune
// de ces valeurs n'est celle du départ, sinon l'essai ne prouverait rien.
//
// ⚠️ La cadence est ramenée à une image par seconde avant de lancer la
// lecture : le minuteur battrait sinon pendant les assertions et la frame
// retrouvée deviendrait une loterie.
const varianteCorrigee = {
  identifiant: "calque-2", cible: { nature: "frame" as const, resultat: "marche-1", prise: "occurrence-2" },
  role: "calque" as const, source: "source-casque", source_fiche: { identifiant: "source-casque", label: "Le pèlerin casqué" },
  revision: 3, placement: { dx: 11, dy: -2, echelle: 1.5, rotation: 0, opacite: 1, devant: false, ordre: 0 },
  masques: { calque: [], corps: [], derriere: [{ garde: true, rayon: 2, points: [[30, 19]], couleur: "" }] },
  extraction: null, historique: [], base: { cadre: { largeur: 64, hauteur: 64 }, repere: { x: 30, y: 61 }, pose: "marche", direction: "ouest" },
  etat: "a-verifier" as const, raison: "", retenue: false, utilisable: false,
}

function couvertureAnimee() {
  const frame = (n: number, etat: string, variante: unknown = null) => ({
    cible: { nature: "frame" as const, resultat: "marche-1", prise: `occurrence-${n}` }, rang: n - 1,
    pose: "marche", direction: "ouest", nom_bande: "Marche lente", etat, fabricable: etat === "absente",
    raison: "", variante: variante ? varianteCorrigee.identifiant : null, variantes: variante ? [variante] : [],
  })
  const compteur = { bases_attendues: 1, bases_absentes: 0, bases_a_choisir: 0, images_connues: 3, absente: 1, "a-extraire": 1, "a-verifier": 1, prete: 0, "a-revoir": 0 }
  return { piece: { identifiant: "casque", nom: "Casque" }, prete: false,
    images: { ...compteur, bases_attendues: 0, images_connues: 0, absente: 0, "a-extraire": 0, "a-verifier": 0 },
    animations: compteur, cibles: [],
    cases: [{ identifiant: "marche", nature: "animation", nom_pose: "Marche", nom_direction: "Ouest", demandee: true, prete: false, versions: [
      { resultat: "marche-1", nom: "Marche lente", choisie: true, etat: "retenue", cadence: 11, images: [
        frame(1, "absente"), frame(2, "a-verifier", varianteCorrigee), frame(3, "a-extraire"),
      ] },
    ] }] } as unknown as CouvertureEquipement
}

test("fermer pendant la lecture puis rouvrir retrouve sélection, bande, frame, sources et corrections", async () => {
  sessionStorage.clear()
  vi.spyOn(equipements, "couverture").mockResolvedValue(couvertureAnimee())
  const montage = render(<CouvertureDeLEmploi chemin={chemin} onCalque={vi.fn()} />)
  const cases = await screen.findAllByRole("checkbox")
  expect(cases).toHaveLength(3)
  fireEvent.click(cases[1])
  fireEvent.click(cases[2])
  expect(screen.getByText("2 images sélectionnées")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Vérifier en animation" }))
  const lecture = screen.getByLabelText("Vérifier les calques en mouvement")
  // La cadence de la bande est reprise du corps, puis ralentie à la main.
  expect(screen.getByLabelText("Images par seconde")).toHaveValue(11)
  fireEvent.change(screen.getByLabelText("Images par seconde"), { target: { value: "1" } })
  fireEvent.click(screen.getByRole("button", { name: "Frame suivante" }))
  fireEvent.click(screen.getByRole("button", { name: "Lire la bande" }))
  expect(within(lecture).getByRole("status")).toHaveTextContent("Frame 2 / 3 · À vérifier")

  montage.unmount()
  render(<CouvertureDeLEmploi chemin={chemin} onCalque={vi.fn()} />)
  const relue = await screen.findByLabelText("Vérifier les calques en mouvement")
  // La lecture était en cours : elle l'est encore.
  expect(within(relue).getByRole("button", { name: "Mettre en pause" })).toBeInTheDocument()
  expect(screen.getByLabelText("Images par seconde")).toHaveValue(1)
  expect(screen.getByLabelText("Bande ou image à vérifier")).toHaveValue("marche-1")
  expect(within(relue).getByRole("status")).toHaveTextContent("Frame 2 / 3")
  expect(within(relue).getByRole("button", { name: "Examiner la frame 2" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByText("2 images sélectionnées")).toBeInTheDocument()
  // Les corrections et la source, relues du serveur, avec leurs vraies valeurs.
  expect(within(relue).getByText(/décalé de 11, -2 px · à 150 % · sous le corps · une partie peinte/)).toBeInTheDocument()
  expect(within(relue).getByText(/Le pèlerin casqué · calque transparent/)).toBeInTheDocument()
})

test("une image équipée seule se lit « à extraire », jamais comme une couverture remplie", async () => {
  sessionStorage.clear()
  vi.spyOn(equipements, "couverture").mockResolvedValue(couvertureAnimee())
  render(<CouvertureDeLEmploi chemin={chemin} onCalque={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "Vérifier en animation" }))
  const lecture = screen.getByLabelText("Vérifier les calques en mouvement")
  fireEvent.click(within(lecture).getByRole("button", { name: "Examiner la frame 3" }))
  expect(within(lecture).getByRole("status")).toHaveTextContent("Frame 3 / 3 · À extraire")
  expect(within(lecture).getByText("Corrections de cette frame : aucun calque sur cette frame.")).toBeInTheDocument()
  // Un seul calque prêt annoncé : zéro, sur trois frames connues.
  expect(screen.getByText("3 images connues · 0 calques prêts")).toBeInTheDocument()
})
