/**
 * Les réglages de la famille — un volet par-dessus l'écran d'une famille (B9.7).
 *
 * `docs/pistes-2026-09-04/carnet/Famille.dc.html`, bloc « Les trois tables, sur
 * la famille ». Trois choses s'y règlent : quelles natures existent dans cette
 * famille et ce que chacune réclame comme poses, quels emplacements de corps
 * porte le jeu, et quel modèle sert de défaut à cette famille.
 *
 * ⚠️ **Le piège du fichier, et la raison de sa forme.** La conception de `B9`
 * affirme que `PUT /api/universe` accepte `bareme` et `modeles` en « PATCH
 * partiel ». C'est vrai d'un cran — ne pas envoyer la clé ne touche à rien —
 * et faux du cran qui compte : **dès que la clé est envoyée, elle remplace la
 * liste (ou le dictionnaire) en entier.** Un panneau qui ne montre qu'une
 * famille, et qui renverrait seulement ses lignes, effacerait au premier
 * `Enregistrer` les natures et le modèle des trois autres familles — leurs
 * poses écrites comprises. Ce fichier garde donc **l'univers entier** en
 * mémoire (`bareme`, `modeles`) : `Enregistrer` modifie seulement les lignes
 * de la famille ouverte, et renvoie toujours la totalité, les autres familles
 * inchangées.
 *
 * **Les poses et les emplacements de corps ne suivent pas ce chemin.** Ce sont
 * de vrais patchs, un identifiant à la fois (`PUT .../types/{type}/poses`,
 * `POST`/`PUT`/`DELETE .../slots`) : ils s'écrivent tout de suite, et le
 * bouton `Enregistrer` ne les concerne pas.
 *
 * **Les emplacements de corps ne valent que pour les personnages.** Ils
 * vivent sur le projet entier (`Projet.emplacements`), pas sur une famille, et
 * seuls les personnages portent de l'équipement — la table ne paraît donc que
 * pour cette famille-là, une phrase dit pourquoi ailleurs.
 *
 * ⚠️ **Renommer une nature la fait repartir sans poses** : le service ne
 * regarde que le nom pour recopier les poses d'avant, un nom qui change ne
 * retrouve donc rien. Le champ le rappelle avant que `Enregistrer` ne le
 * fasse vraiment.
 */

import { useEffect, useState } from "react"
import {
  api,
  type Echelle,
  type EmplacementCorps,
  type Famille,
  type Modele,
  type Pose,
  type PosesDesTypes,
} from "../api"

// ── Les mots qui changent avec la famille ───────────────────────────────────

const MOT_DE_LA_NATURE: Record<string, string> = {
  personnages: "de personnage",
  objets: "d'objet",
  decors: "de décor",
  interface: "d'élément d'interface",
}

const SINGULIER_DU_SUJET: Record<string, string> = {
  personnages: "personnage",
  objets: "objet",
  decors: "décor",
  interface: "élément d'interface",
}

const SUJET_INDEFINI: Record<string, string> = {
  objets: "Un objet",
  decors: "Un décor",
  interface: "Une interface",
}

// ── Les pièces ───────────────────────────────────────────────────────────────

/** Un identifiant stable pour une pose neuve, dérivé de son nom — le même
 *  procédé qu'ailleurs dans le produit pour ce genre de liste (E9) : la lettre
 *  qui reste après avoir ôté les accents et la ponctuation, et un rang en
 *  suffixe si le nom est déjà pris. */
function identifiantDePose(nom: string, deja: readonly Pose[]): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pose"
  const prises = new Set(deja.map((p) => p.identifiant))
  if (!prises.has(base)) return base
  let rang = 2
  while (prises.has(`${base}-${rang}`)) rang += 1
  return `${base}-${rang}`
}

/** Un bouton pointillé qui devient un petit champ — le geste « nommer, c'est
 *  créer » répété trois fois dans ce fichier (une nature, une pose, un
 *  emplacement), toujours de la même façon. */
function AjouterLigne({
  texte,
  surValider,
}: {
  texte: string
  surValider: (nom: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [valeur, setValeur] = useState("")

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-[8px] h-[26px] w-full shrink-0 rounded-5 border border-dashed border-pointille text-[12px] text-encre-3 transition-colors duration-120 hover:bg-papier"
      >
        {texte}
      </button>
    )
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault()
        const propre = valeur.trim()
        if (!propre) return
        surValider(propre)
        setValeur("")
        setOuvert(false)
      }}
      className="mt-[8px] flex shrink-0 gap-[8px]"
    >
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input
        autoFocus
        value={valeur}
        onChange={(evenement) => setValeur(evenement.target.value)}
        onBlur={() => {
          if (!valeur.trim()) setOuvert(false)
        }}
        placeholder="son nom"
        aria-label={texte}
        className="h-[26px] min-w-0 flex-1 rounded-5 border border-contour bg-carte px-[8px] text-[12px] text-encre outline-none"
      />
      <button
        type="submit"
        className="h-[26px] shrink-0 rounded-5 border border-contour px-[8px] text-[10.5px] text-encre-3 transition-colors duration-120 hover:bg-papier"
      >
        ajouter
      </button>
    </form>
  )
}

// ── Le panneau ───────────────────────────────────────────────────────────────

export function ReglagesDeFamille({
  famille,
  nom,
  onFermer,
  onErreur,
}: {
  /** La clé de la famille : `"personnages" | "objets" | "decors" |
   *  "interface"`. Reste `string` — c'est le lieu (`lieux.ts`) qui la valide
   *  déjà en amont, ce fichier n'a pas à revalider ce que son appelant garantit. */
  famille: string
  /** Son nom dans le carnet — « Les personnages ». */
  nom: string
  onFermer: () => void
  onErreur: (raison: string) => void
}) {
  // Le barème et les modèles au moment de l'ouverture — jamais réécrits
  // ailleurs qu'ici. C'est à cette copie qu'on compare pour savoir si une
  // nature a été renommée (§ le piège du renommage), et c'est elle qui donne
  // le total « huit natures » de la note de bas de table.
  const [baremeOriginal, setBaremeOriginal] = useState<Echelle[] | null>(null)
  // Le brouillon — modifié sur place, envoyé d'un bloc par « Enregistrer ».
  const [bareme, setBareme] = useState<Echelle[] | null>(null)
  const [modeles, setModeles] = useState<Partial<Record<Famille, string>> | null>(null)

  const [posesDesTypes, setPosesDesTypes] = useState<PosesDesTypes | null>(null)
  // `null` tant que non chargé ; `[]` pour une famille qui n'en a pas besoin
  // (tout ce qui n'est pas « personnages ») — la distinction évite de croire
  // qu'un jeu sans emplacement n'a simplement pas encore répondu.
  const [emplacements, setEmplacements] = useState<EmplacementCorps[] | null>(null)
  const [modelesDisponibles, setModelesDisponibles] = useState<Modele[]>([])

  const [natureChoisie, setNatureChoisie] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  useEffect(() => {
    let vivant = true
    setBaremeOriginal(null)
    setBareme(null)
    setModeles(null)
    setPosesDesTypes(null)
    setEmplacements(null)
    setNatureChoisie(null)

    const echouerAuChargement = (erreur: unknown) => {
      if (vivant) onErreur(erreur instanceof Error ? erreur.message : String(erreur))
    }

    api
      .univers()
      .then((recu) => {
        if (!vivant) return
        setBaremeOriginal(recu.univers.bareme)
        setBareme(recu.univers.bareme)
        setModeles(recu.univers.modeles)
        const premiere = recu.univers.bareme.find((e) => e.famille === famille)
        setNatureChoisie(premiere?.nom ?? null)
      })
      .catch(echouerAuChargement)

    api
      .posesDesTypes()
      .then((recu) => vivant && setPosesDesTypes(recu))
      .catch(echouerAuChargement)

    // Le catalogue des modèles — non critique : une famille sans modèle
    // disponible garde quand même son sélecteur, réduit au seul choix
    // « le catalogue décide ».
    api
      .modeles("1:1")
      .then((recu) => vivant && setModelesDisponibles(recu.modeles))
      .catch(() => vivant && setModelesDisponibles([]))

    if (famille === "personnages") {
      api
        .production()
        .then((recu) => vivant && setEmplacements(recu.emplacements))
        .catch(echouerAuChargement)
    } else {
      setEmplacements([])
    }

    return () => {
      vivant = false
    }
  }, [famille, onErreur])

  const echouer = (erreur: unknown) => onErreur(erreur instanceof Error ? erreur.message : String(erreur))

  // ── Table 1 — les natures de cette famille ─────────────────────────────
  const lignesDeLaFamille =
    bareme === null ? [] : bareme.map((e, i) => ({ e, i })).filter(({ e }) => e.famille === famille)

  function majEchelle(i: number, champs: Partial<Echelle>) {
    setBareme((b) => (b === null ? b : b.map((e, j) => (j === i ? { ...e, ...champs } : e))))
  }

  function ajouterNature(nomNeuf: string) {
    setBareme((b) =>
      b === null ? b : [...b, { nom: nomNeuf, famille: famille as Famille, occupation: 100, silhouette: true }],
    )
    setNatureChoisie(nomNeuf)
  }

  function compteDePoses(i: number, e: Echelle): number {
    const cle = baremeOriginal?.[i]?.nom ?? e.nom
    return posesDesTypes?.types.find((t) => t.nom === cle)?.poses.length ?? 0
  }

  // ── Table 2 — les poses de la nature choisie ───────────────────────────
  const natureData =
    natureChoisie === null ? undefined : posesDesTypes?.types.find((t) => t.nom === natureChoisie)
  const posesActuelles = natureData?.poses ?? []
  const natureEstEnregistree = natureData !== undefined

  function ajouterPose(nomNeuf: string) {
    if (natureChoisie === null || !natureEstEnregistree) return
    const poses: Pose[] = [
      ...posesActuelles,
      {
        identifiant: identifiantDePose(nomNeuf, posesActuelles),
        nom: nomNeuf,
        images: 1,
        consigne: "",
        ecartees: [],
        images_avant: 0,
      },
    ]
    api.poserPosesDuType(natureChoisie, poses).then(setPosesDesTypes).catch(echouer)
  }

  function retirerPose(identifiant: string) {
    if (natureChoisie === null) return
    const poses = posesActuelles.filter((p) => p.identifiant !== identifiant)
    api.poserPosesDuType(natureChoisie, poses).then(setPosesDesTypes).catch(echouer)
  }

  // ── Table 3a — les emplacements de corps (personnages seulement) ──────
  const emplacementsTries = [...(emplacements ?? [])].sort((a, b) => a.rang - b.rang)

  function ajouterUnEmplacement(nomNeuf: string) {
    api.ajouterEmplacement(nomNeuf).then((r) => setEmplacements(r.emplacements)).catch(echouer)
  }
  function renommerEmplacement(identifiant: string, nomActuel: string, nomNeuf: string) {
    const propre = nomNeuf.trim()
    if (!propre || propre === nomActuel) return
    api.reglerEmplacement(identifiant, { nom: propre }).then((r) => setEmplacements(r.emplacements)).catch(echouer)
  }
  function retirerUnEmplacement(identifiant: string) {
    api.retirerEmplacement(identifiant).then((r) => setEmplacements(r.emplacements)).catch(echouer)
  }
  function poserLesSixProposes() {
    api.poserLesEmplacementsProposes().then((r) => setEmplacements(r.emplacements)).catch(echouer)
  }

  // ── Table 3b — le modèle de la famille ─────────────────────────────────
  const modeleActuel = modeles?.[famille as Famille] ?? ""
  function choisirModele(valeur: string) {
    setModeles((m) => (m === null ? m : { ...m, [famille as Famille]: valeur }))
  }

  // ── Le pied — un seul PUT, le barème et les modèles complets ───────────
  async function enregistrer() {
    if (bareme === null || modeles === null) return
    setEnregistrement(true)
    try {
      const recu = await api.reglerUnivers({ bareme, modeles })
      setBareme(recu.univers.bareme)
      setBaremeOriginal(recu.univers.bareme)
      setModeles(recu.univers.modeles)
      // Une nature renommée repart sans poses (le piège ci-dessus) : la
      // liste des poses par type peut donc avoir changé sous nos pieds.
      const posesFraiches = await api.posesDesTypes()
      setPosesDesTypes(posesFraiches)
    } catch (erreur) {
      echouer(erreur)
    } finally {
      setEnregistrement(false)
    }
  }

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  const motDeLaNature = MOT_DE_LA_NATURE[famille] ?? famille
  const singulierDuSujet = SINGULIER_DU_SUJET[famille] ?? famille
  const sujetIndefini = SUJET_INDEFINI[famille] ?? "Ce sujet"

  return (
    <div
      data-reglages-de-famille
      className="fixed inset-0 z-50 bg-papier/85"
      onMouseDown={onFermer}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Les réglages de la famille"
        className="volet mx-auto mt-[9%] flex max-h-[80vh] w-[880px] max-w-full flex-col overflow-hidden rounded-10 border border-contour bg-carte"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── L'en-tête ─────────────────────────────────────────────────── */}
        <header className="flex shrink-0 items-baseline gap-[14px] border-b border-trait px-[22px] py-[14px]">
          <h1 className="flex min-w-0 flex-1 items-baseline gap-[8px]">
            <span className="truncate text-[15px] text-encre-3">{nom} ›</span>
            <span className="font-serif text-[25px] leading-none text-encre">Ses réglages</span>
          </h1>
          <p className="shrink-0 text-[12px] text-encre-4">Ils ne valent que pour cette famille.</p>
          <button
            type="button"
            onClick={onFermer}
            className="h-[26px] shrink-0 rounded-5 border border-contour px-[8px] text-[10.5px] text-encre-3 transition-colors duration-120 hover:bg-papier"
          >
            Fermer
          </button>
        </header>

        {/* ── Le corps — trois tables ───────────────────────────────────── */}
        <div className="defile min-h-0 flex-1 overflow-y-auto p-[22px]">
          <div className="grid grid-cols-3 gap-[22px]">
            {/* ── Table 1 — Les natures ────────────────────────────────── */}
            <section data-table-des-natures className="flex min-w-0 flex-col">
              <h2 className="text-[14px] font-medium text-encre">Les natures {motDeLaNature}</h2>
              <p className="mt-[8px] text-[12px] leading-[1.5] text-encre-2">
                Une nature dit quelle part de sa case le sujet remplit. Sans elle, un coffre sort
                aussi haut qu'une prêtresse.
              </p>
              <ul className="mt-[14px] flex flex-col gap-[8px]">
                {lignesDeLaFamille.map(({ e, i }) => {
                  const originalDeLaLigne = baremeOriginal?.[i]
                  const poses = compteDePoses(i, e)
                  return (
                    <li
                      key={i}
                      aria-current={natureChoisie === e.nom ? "true" : undefined}
                      onClick={() => setNatureChoisie(e.nom)}
                      className={[
                        "flex flex-col gap-[4px] rounded-8 border border-trait p-[8px] transition-colors duration-120",
                        natureChoisie === e.nom ? "bg-ligne-ouverte" : "bg-carte hover:bg-papier",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-[8px]">
                        <input
                          value={e.nom}
                          onChange={(evenement) => majEchelle(i, { nom: evenement.target.value })}
                          aria-label={`Le nom de la nature « ${originalDeLaLigne?.nom ?? e.nom} »`}
                          className="min-w-0 flex-1 rounded-5 border border-trait bg-papier px-[8px] text-[13px] text-encre outline-none"
                        />
                        <span className="mesure shrink-0 text-[11px] text-encre-4">
                          {poses} pose{poses > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-[4px] text-[12px] text-encre-3">
                        <input
                          type="number"
                          min={1}
                          max={800}
                          value={e.occupation}
                          onChange={(evenement) => majEchelle(i, { occupation: Number(evenement.target.value) || 0 })}
                          aria-label={`L'occupation de « ${e.nom} »`}
                          className="mesure h-[22px] w-[34px] shrink-0 rounded-5 border border-trait bg-papier px-[4px] text-[12px] text-encre outline-none"
                        />
                        <span className="shrink-0">% de la case ·</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={e.silhouette}
                          onClick={() => majEchelle(i, { silhouette: !e.silhouette })}
                          className="shrink-0 text-encre-3 underline decoration-pointille transition-colors duration-120 hover:text-encre"
                        >
                          {e.silhouette ? "se découpe" : "pas de découpe"}
                        </button>
                      </div>
                      {originalDeLaLigne !== undefined && originalDeLaLigne.nom !== e.nom && (
                        <p className="text-[11px] leading-[1.4] text-encre-4">
                          Renommer fait repartir « {originalDeLaLigne.nom} » sans poses : elles ne
                          sont gardées que si le nom ne change pas.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
              <AjouterLigne texte="+ une nature" surValider={ajouterNature} />
              <p className="mt-[14px] rounded-8 border border-trait-attention bg-fond-attention p-[8px] text-[11px] leading-[1.5] text-encre-attention">
                Les {bareme?.length ?? 0} natures du jeu sont réparties sur les quatre familles. Ici
                on ne voit que les {lignesDeLaFamille.length} des personnages ; les décors ont les
                leurs, et une tuile n'a pas de contour à découper.
              </p>
            </section>

            {/* ── Table 2 — Les poses de la nature choisie ─────────────── */}
            <section data-table-des-poses className="flex min-w-0 flex-col">
              <h2 className="truncate text-[14px] font-medium text-encre">
                Les poses de « {natureChoisie ?? "…"} »
              </h2>
              <p className="mt-[8px] text-[12px] leading-[1.5] text-encre-2">
                Ce qu'on attend de chaque {singulierDuSujet}. La barre 5 / 6 de la grille compte
                celles-ci.
              </p>
              {natureChoisie === null ? (
                <p className="mt-[14px] text-[12px] text-encre-3">
                  Choisis une nature pour voir ses poses.
                </p>
              ) : !natureEstEnregistree ? (
                <p className="mt-[14px] text-[12px] leading-[1.5] text-encre-3">
                  Enregistre d'abord cette nature (le bouton en pied de panneau) pour pouvoir lui
                  donner des poses.
                </p>
              ) : (
                <ul className="mt-[14px] flex flex-col gap-[8px]">
                  {posesActuelles.map((p) => (
                    <li key={p.identifiant} className="flex items-center gap-[8px] text-[13px] text-encre">
                      <span aria-hidden className="shrink-0 text-encre-4">
                        ≡
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.nom}</span>
                      <span className="mesure shrink-0 text-[11px] text-encre-4">
                        {p.images} image{p.images > 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        aria-label={`Retirer la pose « ${p.nom} »`}
                        onClick={() => retirerPose(p.identifiant)}
                        className="shrink-0 text-encre-4 transition-colors duration-120 hover:text-echec"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                  <AjouterLigne texte="+ une pose" surValider={ajouterPose} />
                </ul>
              )}
              <p className="mt-[14px] text-[11px] leading-[1.5] text-encre-4">
                La liste appartient à la nature, pas au jeu. Une créature en a quatre, un meuble
                trois états, une tuile aucune.
              </p>
            </section>

            {/* ── Colonne 3 — emplacements et modèle ───────────────────── */}
            <div className="flex min-w-0 flex-col gap-[22px]">
              <section data-table-des-emplacements className="flex min-w-0 flex-col">
                <h2 className="text-[14px] font-medium text-encre">Les emplacements de corps</h2>
                {famille !== "personnages" ? (
                  <p className="mt-[8px] text-[12px] leading-[1.5] text-encre-3">
                    {sujetIndefini} n'a ni tête ni mains : les emplacements de corps ne valent que
                    pour les personnages.
                  </p>
                ) : (
                  <>
                    <p className="mt-[8px] text-[12px] leading-[1.5] text-encre-2">
                      Les endroits où une pièce se pose, du fond vers l'avant.
                    </p>
                    <ul className="mt-[14px] flex flex-col gap-[8px]">
                      {emplacementsTries.map((emp, rang) => (
                        <li
                          key={emp.identifiant}
                          className="flex items-center gap-[8px] text-[13px] text-encre"
                        >
                          <span className="mesure w-[14px] shrink-0 text-encre-4">{rang + 1}</span>
                          <input
                            key={`${emp.identifiant}-${emp.nom}`}
                            defaultValue={emp.nom}
                            onBlur={(evenement) =>
                              renommerEmplacement(emp.identifiant, emp.nom, evenement.target.value)
                            }
                            aria-label={`Le nom de l'emplacement « ${emp.nom} »`}
                            className="min-w-0 flex-1 rounded-5 border border-trait bg-papier px-[8px] text-[13px] text-encre outline-none"
                          />
                          <span className="shrink-0 text-[11px] text-encre-4">
                            {rang === 0 && "derrière le corps"}
                            {rang === emplacementsTries.length - 1 && rang !== 0 && "devant tout"}
                          </span>
                          <button
                            type="button"
                            aria-label={`Retirer l'emplacement « ${emp.nom} »`}
                            onClick={() => retirerUnEmplacement(emp.identifiant)}
                            className="shrink-0 text-encre-4 transition-colors duration-120 hover:text-echec"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    {emplacements !== null && emplacements.length === 0 ? (
                      <button
                        type="button"
                        onClick={poserLesSixProposes}
                        className="mt-[8px] h-[26px] w-full shrink-0 rounded-5 border border-dashed border-pointille text-[12px] text-encre-3 transition-colors duration-120 hover:bg-papier"
                      >
                        Poser les six proposés
                      </button>
                    ) : (
                      <AjouterLigne texte="+ un emplacement" surValider={ajouterUnEmplacement} />
                    )}
                  </>
                )}
              </section>

              <section data-table-du-modele className="flex min-w-0 flex-col">
                <h2 className="text-[14px] font-medium text-encre">Le modèle de cette famille</h2>
                <select
                  value={modeleActuel}
                  onChange={(evenement) => choisirModele(evenement.target.value)}
                  aria-label="Le modèle de cette famille"
                  className="mt-[8px] h-[30px] w-full rounded-5 border border-contour bg-carte px-[8px] text-[13px] text-encre outline-none"
                >
                  <option value="">Le choix du catalogue</option>
                  {modelesDisponibles.map((m) => (
                    <option key={m.identifiant} value={m.identifiant}>
                      {m.nom} — {m.fournisseur}
                    </option>
                  ))}
                </select>
                <p className="mt-[8px] text-[11px] leading-[1.5] text-encre-4">
                  Les décors et les tuiles ont le leur. La clé et la liste des modèles sont dans
                  l'installation : c'est la machine, pas le jeu.
                </p>
              </section>
            </div>
          </div>
        </div>

        {/* ── Le pied ───────────────────────────────────────────────────── */}
        <footer className="flex shrink-0 flex-col gap-[8px] border-t border-trait p-[22px]">
          <p className="text-[11px] leading-[1.5] text-encre-4">
            Les poses et les emplacements de corps s'enregistrent tout de suite, chacun par son
            propre geste ; ce bouton ne porte que les natures et le modèle.
          </p>
          <button
            type="button"
            onClick={() => void enregistrer()}
            disabled={enregistrement || bareme === null || modeles === null}
            className="h-[34px] w-fit shrink-0 rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec disabled:opacity-60"
          >
            Enregistrer
          </button>
          <p className="text-[11px] leading-[1.5] text-encre-4">
            Ce qui est déjà fabriqué ne bouge pas. Le changement vaut pour la suite.
          </p>
        </footer>
      </div>
    </div>
  )
}
