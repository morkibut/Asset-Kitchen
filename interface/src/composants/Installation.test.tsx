// L'écran de l'installation (B15). Aucun de ces essais ne coûte un centime :
// `fetch` est doublé à la main, route par route — jamais de serveur, jamais de
// réseau, jamais un vrai ComfyUI. Le double **jette sur une route non doublée**,
// si bien qu'un appel imprévu se voit au lieu de renvoyer `undefined` en silence.
//
// **Les trois essais les plus importants du fichier**, et ce sont les trois
// garde-fous de la tranche :
//
// 1. *La clé ne se relit jamais* — le champ est un `type="password"`, il part
//    vide, il se vide après l'envoi, et rien de ce que le serveur rend n'en
//    porte plus que l'aperçu de six caractères. C'est le seul écran du produit
//    qui manipule un secret.
// 2. *Poser un dossier n'appelle aucune route qui crée ou qui efface* — mesuré
//    sur la **liste des appels partis**, pas sur ce que l'écran affiche : un
//    dossier absent est refusé, et *Créer ce dossier* est un second geste que
//    l'on doit cliquer soi-même.
// 3. *Les deux modes écrivent la même chose* — le septième critère de `B14`,
//    repris ici mot pour mot : un fichier, deux entrées, et un essai qui compare
//    la route, la méthode **et le corps du message**.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Installation, mesureDuDisque, resumeDesEtapes } from "./Installation"
import type { EtatInstallation, Modele, Tiroir } from "../api"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── Le décor ────────────────────────────────────────────────────────────────

/** ⚠️ **Une valeur explicitement fictive**, comme côté serveur. Un essai qui
 *  poserait quelque chose ressemblant à une vraie clé finirait recopié quelque
 *  part comme si c'en était une. */
const CLE_FICTIVE = "essai-1234567890"

const TIROIR_PAYANT: Tiroir = {
  fournisseur: "OpenRouter",
  secrets: [
    {
      nom: "OPENROUTER_API_KEY",
      libelle: "la clé",
      ou: "openrouter.ai/settings/keys",
      presente: false,
      origine: "absente",
      apercu: "",
      retirable: false,
    },
  ],
  manque: "aucune clé OpenRouter",
  pret: false,
}

const TIROIR_POSE: Tiroir = {
  ...TIROIR_PAYANT,
  secrets: [
    {
      ...TIROIR_PAYANT.secrets[0],
      presente: true,
      origine: "fichier",
      apercu: "567890",
      retirable: true,
    },
  ],
  manque: null,
  pret: true,
}

const TIROIR_GRATUIT: Tiroir = {
  fournisseur: "Pollinations",
  secrets: [],
  manque: null,
  pret: true,
}

const MODELES: Modele[] = [
  {
    identifiant: "OpenRouter:google/gemini-2.5-flash-image",
    nom: "Gemini",
    fournisseur: "OpenRouter",
    proportions: ["1:1"],
    resolutions: [],
    variations_max: 1,
    references_max: 4,
    options: [],
    refus: "aucune clé OpenRouter",
    repli: false,
    recu_le: null,
    unite: "usd",
  } as unknown as Modele,
  {
    identifiant: "Pollinations:flux",
    nom: "Flux",
    fournisseur: "Pollinations",
    proportions: ["1:1"],
    resolutions: [],
    variations_max: 1,
    references_max: 0,
    options: [],
    refus: null,
    repli: false,
    recu_le: null,
    unite: "jeton",
  } as unknown as Modele,
]

const INSTALLATION: EtatInstallation = {
  dossier: "C:\\atelier\\donnees",
  origine_du_dossier: "defaut",
  // Le cas ordinaire : rien n'a été choisi, il n'y a qu'un dossier à montrer.
  dossier_au_prochain_demarrage: "",
  disque: {
    postes: [
      { nom: "Les images et les clips reçus", octets: 4404019, mo: 4.2, recalculable: false },
      { nom: "Les rendus", octets: 12373196, mo: 11.8, recalculable: true },
    ],
    total_mo: 16,
    recalculable_mo: 11.8,
  },
  fichier_env: "C:\\atelier\\.env",
  comfy: "http://127.0.0.1:8188",
  origine_de_l_adresse: "defaut",
  premiere_ouverture: false,
  jeux: ["Le Marais du Vieux Moulin", "Les Salines"],
}

type Appel = { url: string; methode: string; corps: unknown }

function construireDouble(
  options: {
    installation?: Partial<EtatInstallation>
    /** Ce que `POST /install/workspace/check` répond, par chemin demandé. */
    dossiers?: Record<string, Partial<import("../api").DossierDeTravail>>
    /** `PUT /install/workspace` refuse-t-il ? La phrase du refus. */
    refusDuDossier?: string
    verification?: Partial<import("../api").VerificationDuFournisseur>
    moteur?: Partial<import("../api").EtatDuMoteur>
  } = {},
) {
  const appels: Appel[] = []
  let installation: EtatInstallation = { ...INSTALLATION, ...options.installation }

  const rendre = (charge: unknown) =>
    ({ ok: true, status: 200, json: async () => charge }) as Response

  const refuser = (raison: string) =>
    ({
      ok: false,
      status: 400,
      json: async () => ({ code: "erreur", raison, ou_aller: "reglages" }),
    }) as Response

  const fetchDouble = vi.fn(async (chemin: unknown, init?: RequestInit) => {
    const url = String(chemin)
    const methode = init?.method ?? "GET"
    const corps = (() => {
      if (!init?.body || typeof init.body !== "string") return undefined
      try {
        return JSON.parse(init.body)
      } catch {
        return undefined
      }
    })()
    appels.push({ url, methode, corps })

    if (url === "/api/install" && methode === "GET") return rendre(installation)

    if (url === "/api/install/done" && methode === "POST") {
      installation = { ...installation, premiere_ouverture: false }
      return rendre(installation)
    }

    if (url === "/api/install/workspace/check" && methode === "POST") {
      const vise = String((corps as { chemin: string }).chemin)
      const dit = options.dossiers?.[vise] ?? {}
      return rendre({
        chemin: vise,
        existe: true,
        est_un_dossier: true,
        inscriptible: true,
        contenu: [],
        utilisable: true,
        refus: null,
        ...dit,
      })
    }

    if (url === "/api/install/workspace/create" && methode === "POST") {
      const vise = String((corps as { chemin: string }).chemin)
      return rendre({
        chemin: vise,
        existe: true,
        est_un_dossier: true,
        inscriptible: true,
        contenu: [],
        utilisable: true,
        refus: null,
      })
    }

    if (url === "/api/install/workspace" && methode === "PUT") {
      if (options.refusDuDossier) return refuser(options.refusDuDossier)
      const vise = String((corps as { chemin: string }).chemin)
      installation = { ...installation, dossier: vise, origine_du_dossier: "fichier" }
      return rendre({
        dossier: {
          chemin: vise,
          existe: true,
          est_un_dossier: true,
          inscriptible: true,
          contenu: [],
          utilisable: true,
          refus: null,
        },
        installation,
      })
    }

    if (url === "/api/install/comfy" && methode === "PUT") {
      installation = {
        ...installation,
        comfy: String((corps as { adresse: string }).adresse),
        origine_de_l_adresse: "fichier",
      }
      return rendre({ comfy: installation.comfy, origine: "fichier" })
    }

    if (url === "/api/install/comfy" && methode === "DELETE") {
      installation = {
        ...installation,
        comfy: "http://127.0.0.1:8188",
        origine_de_l_adresse: "defaut",
      }
      return rendre({ comfy: installation.comfy, origine: "defaut" })
    }

    if (url.startsWith("/api/install/check/") && methode === "POST") {
      return rendre({
        fournisseur: "OpenRouter",
        joignable: true,
        modeles: 49,
        reserve: "il reste $4,84 sur ce compte",
        raison: null,
        phrase: "49 modèles trouvés · il reste $4,84 sur ce compte",
        ...options.verification,
      })
    }

    if (url === "/api/clips/engine" && methode === "GET") {
      return rendre({
        allume: false,
        grise: "le moteur de la maison n'est pas allumé — ouvrez ComfyUI",
        manquants: [],
        go_a_telecharger: 0,
        greffon_absent: false,
        carte: "",
        memoire_libre_go: 0,
        phrase: "le moteur de la maison n'est pas allumé — ouvrez ComfyUI",
        ...options.moteur,
      })
    }

    if (url === "/api/clips/engine/download" && methode === "POST") {
      return rendre({
        descendus: ["wan_2.1_vae.safetensors"],
        allume: true,
        grise: null,
        manquants: [],
        go_a_telecharger: 0,
        greffon_absent: false,
        carte: "RTX 3080",
        memoire_libre_go: 6,
        phrase: "",
      })
    }

    if (url.startsWith("/api/settings/keys/") && methode === "PUT") {
      return rendre({ tiroirs: [TIROIR_POSE, TIROIR_GRATUIT] })
    }

    if (url.startsWith("/api/settings/keys/") && methode === "DELETE") {
      return rendre({ tiroirs: [TIROIR_PAYANT, TIROIR_GRATUIT] })
    }

    throw new Error(`route non doublée : ${methode} ${url}`)
  })

  vi.stubGlobal("fetch", fetchDouble)
  return { appels, fetchDouble }
}

function poser(
  props: Partial<Parameters<typeof Installation>[0]> = {},
) {
  const onTiroirs = vi.fn()
  const onFerme = vi.fn()
  const onLesAutresReglages = vi.fn()
  render(
    <Installation
      mode="reglages"
      tiroirs={[TIROIR_PAYANT, TIROIR_GRATUIT]}
      modeles={MODELES}
      onTiroirs={onTiroirs}
      onFerme={onFerme}
      onLesAutresReglages={onLesAutresReglages}
      {...props}
    />,
  )
  return { onTiroirs, onFerme, onLesAutresReglages }
}

/** Ouvrir une étape **par la barre du haut**, jamais par la ligne du sommaire.
 *
 *  Les deux existent en mode réglages et portent le même nom : c'est voulu — on
 *  y va d'un clic depuis le sommaire, et l'on change d'étape depuis la barre —,
 *  mais un essai doit dire laquelle il vise. La barre vient en premier dans le
 *  document, et elle existe dans les deux modes. */
const ouvrir = async (etape: string) => {
  const boutons = await screen.findAllByRole("button", { name: new RegExp(etape) })
  fireEvent.click(boutons[0])
}

// ── Le sommaire, et les deux modes ──────────────────────────────────────────

describe("le sommaire des quatre étapes", () => {
  test("rouvert, il s'ouvre sur la liste — jamais sur une étape", async () => {
    construireDouble()
    poser()

    // Le titre paraît deux fois — dans la barre et dans le sommaire —, et
    // c'est voulu : on y va d'un clic, on y revient de l'autre.
    expect((await screen.findAllByText("Ce qui va être demandé")).length).toBe(2)
    for (const titre of ["Les images", "Les animations", "Où tout se range"]) {
      expect(screen.getAllByText(titre).length).toBeGreaterThan(0)
    }
    // Aucune question d'étape n'est affichée : on est bien sur le sommaire.
    expect(screen.queryByText("Avec quoi fabrique-t-on les images ?")).toBeNull()
  })

  test("en première ouverture, il se déroule à partir de la première étape", async () => {
    construireDouble()
    poser({ mode: "premiere" })

    expect(
      await screen.findByText("Trois choses à brancher — et aucune n'est obligatoire"),
    ).toBeTruthy()
    expect(screen.getByText("Bienvenue")).toBeTruthy()
  })

  test("le sommaire compte les clés posées, il ne les devine pas", () => {
    const dit = resumeDesEtapes(INSTALLATION, [TIROIR_POSE, TIROIR_GRATUIT])

    expect(dit.images).toBe("1 clé sur 1 posée")
    expect(dit.dossier).toBe("C:\\atelier\\donnees")
    expect(dit.animations).toBe("http://127.0.0.1:8188")
  })

  test("un atelier sans fournisseur à clé le dit, plutôt que d'annoncer 0 sur 0", () => {
    expect(resumeDesEtapes(INSTALLATION, [TIROIR_GRATUIT]).images).toBe(
      "aucun fournisseur ne demande de clé",
    )
  })

  test("le tour passé s'écrit, et il ne se rouvrira plus tout seul", async () => {
    const { appels } = construireDouble()
    const { onFerme } = poser({ mode: "premiere" })

    fireEvent.click(
      await screen.findByRole("button", { name: "Tout passer et ouvrir l'atelier" }),
    )

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/install/done")).toBe(true),
    )
    expect(onFerme).toHaveBeenCalled()
  })

  test("rouvert, fermer n'écrit rien — le tour n'a pas à être repassé", async () => {
    const { appels } = construireDouble()
    const { onFerme } = poser()

    fireEvent.click(await screen.findByRole("button", { name: "Fermer" }))

    expect(appels.some((a) => a.url === "/api/install/done")).toBe(false)
    expect(onFerme).toHaveBeenCalled()
  })

  test("ce que B15 ne reprend pas porte un lien nommé, jamais une disparition", async () => {
    construireDouble()
    const { onLesAutresReglages } = poser()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Les garde-fous de l'agent et les mouvements",
      }),
    )

    expect(onLesAutresReglages).toHaveBeenCalled()
  })

  test("les boutons de navigation nomment l'étape en français", async () => {
    // ⚠️ Le libellé d'avance se composait à partir du titre : `Passer à
    // ${titre}` donnait « Passer à les images ». Le français n'a pas de règle
    // qui se calcule ici — il faudrait le genre et l'article de chaque
    // titre —, alors chaque étape porte sa propre phrase. Le retour, lui, n'a
    // plus ce problème depuis que la liste fermée l'écrit « ‹ {titre} », sans
    // verbe à accorder. Vu au navigateur le 9 septembre 2026 ; aucun essai ne
    // regardait ces deux boutons.
    construireDouble({ installation: { premiere_ouverture: true } })
    poser({ mode: "premiere" })

    expect(
      await screen.findByRole("button", { name: "Passer aux images" }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Passer aux images" }))

    expect(
      await screen.findByRole("button", { name: "‹ Ce qui va être demandé" }),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Passer aux animations" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Passer aux animations" }))
    expect(
      await screen.findByRole("button", { name: "‹ Les images" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Passer au dossier de travail" }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Passer au dossier de travail" }))
    expect(
      await screen.findByRole("button", { name: "‹ Les animations" }),
    ).toBeTruthy()
    // La dernière étape ne dit pas « passer à » : elle ouvre l'atelier.
    expect(
      screen.getByRole("button", { name: "C'est prêt — ouvrir l'atelier" }),
    ).toBeTruthy()
  })
})

// ── La clé ──────────────────────────────────────────────────────────────────

describe("la clé se pose, et ne se relit jamais", () => {
  test("le champ est masqué, part vide, et se vide après l'envoi", async () => {
    const { appels } = construireDouble()
    const { onTiroirs } = poser()
    await ouvrir("Les images")

    const champ = (await screen.findByLabelText(
      /la clé — OPENROUTER_API_KEY/,
    )) as HTMLInputElement

    expect(champ.type).toBe("password")
    expect(champ.value).toBe("")

    fireEvent.change(champ, { target: { value: CLE_FICTIVE } })
    fireEvent.click(screen.getByRole("button", { name: "Déposer" }))

    await waitFor(() => expect(onTiroirs).toHaveBeenCalled())
    expect(champ.value).toBe("")

    const pose = appels.find((a) => a.methode === "PUT" && a.url.includes("/keys/"))
    expect(pose?.url).toBe("/api/settings/keys/OPENROUTER_API_KEY")
    expect(pose?.corps).toEqual({ valeur: CLE_FICTIVE })
  })

  test("l'écran ne demande jamais la valeur d'une clé déjà posée", async () => {
    const { appels } = construireDouble()
    poser({ tiroirs: [TIROIR_POSE, TIROIR_GRATUIT] })
    await ouvrir("Les images")

    // Ce que l'écran montre d'une clé posée : six caractères, et d'où elle vient.
    expect(await screen.findByText("…567890 · fichier")).toBeTruthy()
    // Et aucune route de lecture de secret n'existe dans ses appels.
    expect(appels.every((a) => !(a.methode === "GET" && a.url.includes("/keys")))).toBe(
      true,
    )
  })

  test("retirer ne se propose que là où ça retire vraiment", async () => {
    construireDouble()
    const { rerender } = { rerender: null as never }
    void rerender
    poser({ tiroirs: [TIROIR_PAYANT, TIROIR_GRATUIT] })
    await ouvrir("Les images")

    // Place vide : rien à retirer.
    expect(screen.queryByRole("button", { name: "Retirer" })).toBeNull()

    cleanup()
    construireDouble()
    poser({ tiroirs: [TIROIR_POSE, TIROIR_GRATUIT] })
    await ouvrir("Les images")

    expect(screen.getByRole("button", { name: "Retirer" })).toBeTruthy()
  })

  test("un fournisseur qui ne demande rien le dit, il ne se cache pas", async () => {
    construireDouble()
    poser()
    await ouvrir("Les images")

    expect(
      await screen.findByText(/Gratuit, sans compte, sans clé/),
    ).toBeTruthy()
  })

  test("la vérification annonce ce que le serveur a compté, sans le recomposer", async () => {
    construireDouble()
    poser()
    await ouvrir("Les images")

    fireEvent.click((await screen.findAllByRole("button", { name: "Vérifier" }))[0])

    expect(
      await screen.findByText("49 modèles trouvés · il reste $4,84 sur ce compte"),
    ).toBeTruthy()
  })

  test("une clé refusée se dit, et la phrase ne porte pas la clé", async () => {
    construireDouble({
      verification: {
        joignable: false,
        modeles: 0,
        reserve: null,
        raison: "la clé n'a pas été acceptée par OpenRouter",
        phrase: "la clé n'a pas été acceptée par OpenRouter",
      },
    })
    poser()
    await ouvrir("Les images")

    fireEvent.click((await screen.findAllByRole("button", { name: "Vérifier" }))[0])

    const dit = await screen.findByText("la clé n'a pas été acceptée par OpenRouter")
    expect(dit.textContent).not.toContain(CLE_FICTIVE)
  })

  test("l'écran dit où la clé habite, et qu'elle ne suit pas le dossier", async () => {
    construireDouble()
    poser()
    await ouvrir("Les images")

    expect(await screen.findByText("C:\\atelier\\.env")).toBeTruthy()
    expect(screen.getByText(/Ce fichier reste où il est/)).toBeTruthy()
  })
})

// ── ComfyUI ─────────────────────────────────────────────────────────────────

describe("l'adresse de ComfyUI", () => {
  test("elle se change, et le même geste va chercher — jamais deux boutons", async () => {
    const { appels } = construireDouble()
    poser()
    await ouvrir("Les animations")

    const champ = (await screen.findByLabelText(
      "L'adresse de ComfyUI",
    )) as HTMLInputElement
    expect(champ.value).toBe("http://127.0.0.1:8188")

    fireEvent.change(champ, { target: { value: "10.0.0.4:8188" } })
    fireEvent.click(screen.getByRole("button", { name: "Chercher" }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/clips/engine")).toBe(true),
    )
    const posee = appels.find((a) => a.url === "/api/install/comfy" && a.methode === "PUT")
    expect(posee?.corps).toEqual({ adresse: "10.0.0.4:8188" })
    // **L'ordre compte** : poser d'abord, chercher ensuite. Chercher avant
    // d'écrire aurait interrogé l'ancienne adresse en laissant croire le
    // contraire.
    expect(appels.findIndex((a) => a.url === "/api/install/comfy")).toBeLessThan(
      appels.findIndex((a) => a.url === "/api/clips/engine"),
    )
  })

  test("chercher sans avoir changé l'adresse n'écrit rien", async () => {
    const { appels } = construireDouble()
    poser()
    await ouvrir("Les animations")

    fireEvent.click(await screen.findByRole("button", { name: "Chercher" }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/clips/engine")).toBe(true),
    )
    expect(appels.some((a) => a.url === "/api/install/comfy")).toBe(false)
  })

  test("un moteur éteint le dit, et ne propose rien à descendre", async () => {
    construireDouble()
    poser()
    await ouvrir("Les animations")

    fireEvent.click(await screen.findByRole("button", { name: "Chercher" }))

    expect(
      await screen.findByText(
        "elle ne répond pas — ouvre-la, puis clique Chercher",
      ),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Descendre les/ })).toBeNull()
  })

  test("les fichiers qui manquent portent leur taille, leur dossier et leur licence", async () => {
    construireDouble({
      moteur: {
        allume: true,
        grise: null,
        phrase: "il manque 8,7 Go de modèles",
        go_a_telecharger: 8.7,
        carte: "RTX 3080",
        memoire_libre_go: 6,
        manquants: [
          {
            nom: "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
            famille: "diffusion_models",
            go: 8.7,
            licence: "Apache 2.0",
            obligatoire: true,
          },
        ] as never,
      },
    })
    poser()
    await ouvrir("Les animations")

    fireEvent.click(await screen.findByRole("button", { name: "Chercher" }))

    expect(
      await screen.findByText("Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"),
    ).toBeTruthy()
    // **La licence est lue, pas seulement transportée.** Ce nom d'essai la
    // promettait depuis le début et ne la vérifiait pas ; l'écran ne l'affichait
    // pas, et c'est le navigateur qui l'a dit le 9 septembre 2026.
    expect(screen.getByText("diffusion_models · Apache 2.0")).toBeTruthy()
    // ⚠️ **La virgule, pas le point.** Le serveur rend `8.7` en JSON ; l'écran
    // écrit « 8,7 Go » comme il écrit « 26,5 Go » deux lignes plus haut.
    expect(screen.getByText("8,7 Go · obligé")).toBeTruthy()
    // Et le compte s'accorde : un seul fichier ne se dit pas « les 1 fichiers ».
    expect(
      screen.getByRole("button", { name: "Descendre le fichier — 8,7 Go" }),
    ).toBeTruthy()
  })

  test("plusieurs fichiers se comptent au pluriel, et en virgule", async () => {
    construireDouble({
      moteur: {
        allume: true,
        grise: null,
        phrase: "il manque 9,3 Go de modèles",
        go_a_telecharger: 9.3,
        carte: "RTX 3080",
        memoire_libre_go: 6.9,
        manquants: [
          {
            nom: "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
            famille: "diffusion_models",
            go: 8.7,
            licence: "Apache 2.0",
            obligatoire: true,
          },
          {
            nom: "wan_2.1_vae.safetensors",
            famille: "vae",
            go: 0.6,
            licence: "Apache 2.0",
            obligatoire: false,
          },
        ] as never,
      },
    })
    poser()
    await ouvrir("Les animations")

    fireEvent.click(await screen.findByRole("button", { name: "Chercher" }))

    expect(
      await screen.findByRole("button", { name: "Descendre les 2 fichiers — 9,3 Go" }),
    ).toBeTruthy()
    expect(screen.getByText("0,6 Go · facultatif")).toBeTruthy()
    // La mémoire libre passe par la même virgule que le reste de l'écran ;
    // l'identifiant technique de la carte (« RTX 3080 ») ne s'affiche pas (RV4).
    expect(screen.getByText("Mémoire libre : 6,9 Go")).toBeTruthy()
    expect(screen.queryByText(/RTX 3080/)).not.toBeInTheDocument()
  })

  test("le téléchargement ne part que sur demande, et se reprend", async () => {
    const { appels } = construireDouble({
      moteur: {
        allume: true,
        grise: null,
        phrase: "il manque 0,3 Go de modèles",
        go_a_telecharger: 0.3,
        manquants: [
          {
            nom: "wan_2.1_vae.safetensors",
            famille: "vae",
            go: 0.3,
            licence: "Apache 2.0",
            obligatoire: true,
          },
        ] as never,
      },
    })
    poser()
    await ouvrir("Les animations")

    fireEvent.click(await screen.findByRole("button", { name: "Chercher" }))
    await screen.findByText("wan_2.1_vae.safetensors")

    // Rien n'est parti tant qu'on n'a pas cliqué : vingt-cinq gigaoctets ne se
    // descendent pas dans le dos de quelqu'un.
    expect(appels.some((a) => a.url === "/api/clips/engine/download")).toBe(false)

    // La reprise après coupure est annoncée **avant** qu'on clique, à côté du
    // bouton : c'est ce qui rend le clic possible sans crainte sur 25 Go.
    expect(
      screen.getByText(/Une coupure se reprend où elle s'est arrêtée/),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Descendre le fichier/ }))

    expect(await screen.findByText("1 fichier descendu.")).toBeTruthy()
  })

  test("une adresse venue de l'environnement se dit, et ne se remet pas d'ici", async () => {
    construireDouble({
      installation: { comfy: "http://ailleurs:1", origine_de_l_adresse: "environnement" },
    })
    poser()
    await ouvrir("Les animations")

    expect(
      await screen.findByText(/Cette adresse vient de l'environnement de la machine/),
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Remettre l'adresse d'origine" }),
    ).toBeNull()
  })
})

// ── Le dossier de travail ───────────────────────────────────────────────────

describe("le dossier de travail", () => {
  test("il se regarde avant d'être choisi, et regarder n'écrit rien", async () => {
    const { appels } = construireDouble()
    poser()
    await ouvrir("Où tout se range")

    const champ = await screen.findByLabelText("Le chemin du dossier de travail")
    fireEvent.change(champ, { target: { value: "D:\\atelier" } })
    fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))

    expect(
      await screen.findByText("Ce dossier est vide et l'atelier peut y écrire."),
    ).toBeTruthy()
    expect(
      appels.some((a) => a.url === "/api/install/workspace" && a.methode === "PUT"),
    ).toBe(false)
    expect(appels.some((a) => a.url === "/api/install/workspace/create")).toBe(false)
  })

  test("un dossier qui n'existe pas propose de le créer — et c'est un second geste", async () => {
    const { appels } = construireDouble({
      dossiers: {
        "D:\\neuf": {
          existe: false,
          est_un_dossier: false,
          inscriptible: false,
          utilisable: false,
          refus: "ce dossier n'existe pas encore",
        },
      },
    })
    poser()
    await ouvrir("Où tout se range")

    fireEvent.change(await screen.findByLabelText("Le chemin du dossier de travail"), {
      target: { value: "D:\\neuf" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))

    expect(await screen.findByText("ce dossier n'existe pas encore")).toBeTruthy()
    // Il n'est pas encore choisissable : il n'existe pas.
    expect(
      screen.queryByRole("button", { name: /Ranger ici/ }),
    ).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Créer ce dossier" }))

    await waitFor(() =>
      expect(appels.some((a) => a.url === "/api/install/workspace/create")).toBe(true),
    )
    // Créer ne pose pas : c'est le clic suivant qui décide.
    expect(
      appels.some((a) => a.url === "/api/install/workspace" && a.methode === "PUT"),
    ).toBe(false)
    expect(await screen.findByRole("button", { name: /Ranger ici/ })).toBeTruthy()
  })

  test("un dossier déjà plein n'est pas un refus, et dit ce qu'il porte", async () => {
    construireDouble({
      dossiers: { "D:\\copie": { contenu: ["projets", "atelier.sqlite3"] } },
    })
    poser()
    await ouvrir("Où tout se range")

    fireEvent.change(await screen.findByLabelText("Le chemin du dossier de travail"), {
      target: { value: "D:\\copie" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))

    expect(
      await screen.findByText(
        "L'atelier peut y écrire, et il y trouve déjà : projets, atelier.sqlite3.",
      ),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: /Ranger ici/ })).toBeTruthy()
  })

  test("le poser dit que rien n'a bougé, et comment retrouver ses fichiers", async () => {
    const { appels } = construireDouble()
    poser()
    await ouvrir("Où tout se range")

    fireEvent.change(await screen.findByLabelText("Le chemin du dossier de travail"), {
      target: { value: "D:\\atelier" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))
    fireEvent.click(await screen.findByRole("button", { name: /Ranger ici/ }))

    expect(
      await screen.findByText(/C'est écrit — rien n'a été déplacé, rien n'a été effacé/),
    ).toBeTruthy()
    const posee = appels.find(
      (a) => a.url === "/api/install/workspace" && a.methode === "PUT",
    )
    expect(posee?.corps).toEqual({ chemin: "D:\\atelier" })
  })

  test("un refus du serveur s'affiche là où on a cliqué", async () => {
    construireDouble({ refusDuDossier: "l'atelier n'a pas le droit d'écrire ici" })
    poser()
    await ouvrir("Où tout se range")

    fireEvent.change(await screen.findByLabelText("Le chemin du dossier de travail"), {
      target: { value: "D:\\interdit" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))
    fireEvent.click(await screen.findByRole("button", { name: /Ranger ici/ }))

    expect(
      await screen.findByText("l'atelier n'a pas le droit d'écrire ici"),
    ).toBeTruthy()
  })

  test("tant qu'on n'a pas redémarré, les deux dossiers se lisent séparément", async () => {
    // ⚠️ Le décalage entre le chemin en service et le chemin choisi dure
    // jusqu'au redémarrage. L'écran n'en montrait qu'un, sous l'origine de
    // l'autre : « il a été choisi ici » sous un chemin qui n'était pas celui
    // qu'on venait de choisir. Vu au navigateur le 9 septembre 2026.
    construireDouble({
      installation: {
        dossier: "D:\\ancien",
        origine_du_dossier: "fichier",
        dossier_au_prochain_demarrage: "D:\\neuf",
      },
    })
    poser()
    await ouvrir("Où tout se range")

    expect(await screen.findByText("D:\\ancien")).toBeTruthy()
    expect(
      screen.getByText(/C'est là que l'atelier écrit en ce moment/),
    ).toBeTruthy()
    expect(screen.getByText("Au prochain démarrage")).toBeTruthy()
    expect(screen.getByText("D:\\neuf")).toBeTruthy()
    // Et l'ancienne phrase, celle qui trompait, ne paraît plus.
    expect(screen.queryByText(/Il a été choisi ici/)).toBeNull()
  })

  test("sans réglage posé, il n'y a qu'un seul dossier à l'écran", async () => {
    construireDouble()
    poser()
    await ouvrir("Où tout se range")

    await screen.findByText("Ce qui s'y range")
    expect(screen.queryByText("Au prochain démarrage")).toBeNull()
  })

  test("l'écran dit ce qui s'y range, et ce qui n'y va pas", async () => {
    construireDouble()
    poser()
    await ouvrir("Où tout se range")

    expect(await screen.findByText("atelier.sqlite3")).toBeTruthy()
    expect(screen.getByText("generations/")).toBeTruthy()
    expect(screen.getByText(/Le fichier des clés, lui, n'y est pas/)).toBeTruthy()
  })
})

// ── Ce que le disque porte ──────────────────────────────────────────────────

describe("la mesure du disque", () => {
  test("elle sépare ce qui a été payé de ce qui se refait", async () => {
    construireDouble()
    poser()

    expect(await screen.findByText("Les images et les clips reçus")).toBeTruthy()
    expect(screen.getAllByText("ne se refait pas").length).toBeGreaterThan(0)
    expect(screen.getAllByText("se refait tout seul").length).toBeGreaterThan(0)
  })

  test("⚠️ aucun bouton ne vide quoi que ce soit — B15 mesure, elle n'efface pas", async () => {
    construireDouble()
    poser()

    await screen.findByText("Les rendus")
    expect(screen.queryByRole("button", { name: /Vider/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Effacer/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Supprimer/ })).toBeNull()
  })

  test("les octets se lisent dans l'unité qui se lit", () => {
    expect(mesureDuDisque(11.8)).toBe("11,8 Mo")
    expect(mesureDuDisque(2048)).toBe("2,0 Go")
    expect(mesureDuDisque(0.02)).toBe("moins de 0,1 Mo")
  })
})

// ── Le catalogue et les jeux ────────────────────────────────────────────────

describe("ce que le sommaire porte en plus", () => {
  test("le catalogue montre le grisé de chaque modèle, et son fournisseur avec", async () => {
    construireDouble()
    poser()

    expect(await screen.findByText("2 au catalogue · 1 grisé")).toBeTruthy()
    expect(screen.getByText("aucune clé OpenRouter")).toBeTruthy()
    expect(screen.getByText("disponible")).toBeTruthy()
  })

  test("aucun compte de modèles n'est écrit en dur", async () => {
    construireDouble()
    poser({ modeles: [] })

    expect(await screen.findByText("0 au catalogue")).toBeTruthy()
    expect(screen.queryByText(/49/)).toBeNull()
  })

  test("les jeux de la machine viennent du serveur", async () => {
    construireDouble()
    poser()

    expect(await screen.findByText("Le Marais du Vieux Moulin")).toBeTruthy()
    expect(screen.getByText("Les Salines")).toBeTruthy()
  })
})

// ── Les deux modes écrivent la même chose ───────────────────────────────────

describe("un fichier, deux modes", () => {
  test("poser une clé écrit la même chose depuis les deux entrées", async () => {
    const partis: Appel[][] = []

    for (const mode of ["premiere", "reglages"] as const) {
      const { appels } = construireDouble()
      poser({ mode })
      await ouvrir("Les images")

      const champ = await screen.findByLabelText(/la clé — OPENROUTER_API_KEY/)
      fireEvent.change(champ, { target: { value: CLE_FICTIVE } })
      fireEvent.click(screen.getByRole("button", { name: "Déposer" }))

      await waitFor(() =>
        expect(appels.some((a) => a.url.includes("/keys/"))).toBe(true),
      )
      partis.push(appels.filter((a) => a.url.includes("/keys/")))
      cleanup()
    }

    // La route, la méthode **et le corps du message** — c'est le septième
    // critère de `B14`, repris tel quel : un fichier, deux entrées, un seul
    // chemin d'écriture.
    expect(partis[0]).toEqual(partis[1])
  })

  test("poser un dossier écrit la même chose depuis les deux entrées", async () => {
    const partis: Appel[][] = []

    for (const mode of ["premiere", "reglages"] as const) {
      const { appels } = construireDouble()
      poser({ mode })
      await ouvrir("Où tout se range")

      fireEvent.change(await screen.findByLabelText("Le chemin du dossier de travail"), {
        target: { value: "D:\\atelier" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Regarder ce dossier" }))
      fireEvent.click(await screen.findByRole("button", { name: /Ranger ici/ }))

      await waitFor(() =>
        expect(
          appels.some((a) => a.url === "/api/install/workspace" && a.methode === "PUT"),
        ).toBe(true),
      )
      partis.push(appels.filter((a) => a.url.startsWith("/api/install/workspace")))
      cleanup()
    }

    expect(partis[0]).toEqual(partis[1])
  })
})
