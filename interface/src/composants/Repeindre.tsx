// La fabrique « Repeindre » — une zone, un texte, un calque (PX3).
//
// Le geste de PixelLab : on peint une zone sur l'image, on écrit ce qu'on veut
// y voir, et un moteur local repeint **la zone seulement**. Ce qui revient est un
// calque qui ne porte que les pixels changés dans la zone, ramenés à la grille et
// aux couleurs de l'image. On le garde, on le jette, ou on recommence sur une
// autre graine — un tirage sur trois ou quatre ne se garde pas (banc PX1), et ce
// trio de boutons en est la réponse.
//
// **C'est une fabrique, pas une table** : elle ne touche pas l'image ouverte,
// elle en écrit une autre. D'où sa place à droite du trait, avec Découper et
// Superposer, et son verbe.
//
// **Aucun bouton qui échoue** : sans modèle capable, l'écran dit pourquoi et
// comment installer l'outil ; sans zone ou sans texte, le bouton est grisé avec
// sa raison écrite dessous. **Le bouton porte un temps, jamais un prix**
// (`AGENTS.md`, point 8ter) : la médiane mesurée sur cette machine, ou la
// vitesse relevée, dite comme une estimation.
//
// **Ce qui part se lit avant de partir** (point 6) : le texte exact, composé
// par le serveur avec les méthodes de l'envoi. Après, c'est la génération qui
// dit ce qui est vraiment parti.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { api, type Asset, type Trait } from "../api"
import { origineDuTemps, stylesLocaux, tempsParImage } from "../api-workflows"
import { type CalqueRepeint, type EtatDeLaZone, TERMINES, zone as routes } from "../api-zone"
import { OPACITE, rayonDe, type EtatMain } from "../recette"
import { PANNEAU } from "./Infobulle"
import { Libelle, useEcoule } from "./pieces"
import { ToileDeLaMain } from "./Retouche"

const DIAMETRES = [1, 3, 5, 9, 15] as const

/** La zone peinte, dessinée comme le serveur la rastérise : des passages au
 *  pinceau carré, dans leur ordre — la gomme retire ce qu'un passage avait posé. */
function ZonePeinte({ traits, largeur, hauteur, attenuee }: { traits: Trait[]; largeur: number; hauteur: number; attenuee: boolean }) {
  const id = useMemo(() => `zone-${Math.random().toString(36).slice(2)}`, [])
  if (traits.length === 0) return null
  return (
    <svg
      aria-hidden
      data-zone-peinte
      viewBox={`0 0 ${largeur} ${hauteur}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={largeur} height={hauteur}>
          <rect x={0} y={0} width={largeur} height={hauteur} fill="black" />
          {traits.map((t, rang) => {
            const r = t.rayon
            const couleur = t.garde ? "white" : "black"
            if (t.points.length === 1) {
              const [x, y] = t.points[0]
              return <rect key={rang} x={x - r} y={y - r} width={2 * r + 1} height={2 * r + 1} fill={couleur} />
            }
            return (
              <polyline
                key={rang}
                points={t.points.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
                fill="none"
                stroke={couleur}
                strokeWidth={2 * r + 1}
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            )
          })}
        </mask>
      </defs>
      <rect x={0} y={0} width={largeur} height={hauteur} fill="var(--color-signal)" fillOpacity={attenuee ? 0.16 : 0.42} mask={`url(#${id})`} />
    </svg>
  )
}

function Vignette({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-[4px]">
      <div className="damier-papier relative aspect-square w-full overflow-hidden rounded-5 border border-trait">{children}</div>
      <figcaption className="text-[11px] text-encre-3">{titre}</figcaption>
    </figure>
  )
}

const PIXELS = { imageRendering: "pixelated" as const }

export function EcranRepeindre({
  asset,
  onErreur,
  onRetoucher,
  intervalle = 1000,
}: {
  /** L'image ouverte : c'est elle qu'on repeint, et elle ne bouge jamais. */
  asset: Asset
  onErreur: (raison: string) => void
  /** Ouvre le calque dans l'atelier de retouche — la main et l'éditeur de
   *  pixels y passent sur lui comme sur un calque d'équipement. */
  onRetoucher?: (identifiant: string) => void
  /** Le pas du suivi d'une zone lancée, en millisecondes. */
  intervalle?: number
}) {
  const [etat, setEtat] = useState<EtatDeLaZone | null>(null)
  const [traits, setTraits] = useState<Trait[]>([])
  const [sens, setSens] = useState(true)
  const [diametre, setDiametre] = useState<number>(3)
  const [texte, setTexte] = useState("")
  const [force, setForce] = useState<number | null>(null)
  const [graine, setGraine] = useState("")
  const [couleurs, setCouleurs] = useState<number | null>(null)
  const [apercu, setApercu] = useState<{ texte: string; negatif: string } | null>(null)
  const [enCours, setEnCours] = useState<{ generation: string; depuis: number } | null>(null)
  const [resultat, setResultat] = useState<CalqueRepeint | null>(null)
  // PX7 : le modèle choisi, parmi ceux qui savent repeindre une zone. `null`
  // veut dire « le défaut du catalogue » — jamais un identifiant vide envoyé
  // pour rien.
  const [modeleChoisi, setModeleChoisi] = useState<string | null>(null)
  const [installe, setInstalle] = useState<string | null>(null)
  // **Un seul suivi vivant à la fois.** Une zone relancée ou un calque rouvert
  // pendant qu'une autre tourne : ce qui revient de l'ancienne ne s'affiche pas
  // à la place de ce qu'on regarde.
  const suivi = useRef(0)

  const largeur = asset.rendu_largeur || asset.largeur
  const hauteur = asset.rendu_hauteur || asset.hauteur

  const charger = useCallback(() => {
    return routes
      .etat(asset.identifiant)
      .then((recu) => {
        setEtat(recu)
        return recu
      })
      .catch((erreur) => {
        onErreur(erreur instanceof Error ? erreur.message : String(erreur))
        return null
      })
  }, [asset.identifiant, onErreur])

  useEffect(() => {
    void charger()
  }, [charger])

  // ── Le modèle choisi (PX7) — **le défaut, sauf s'il manque** ──────────────
  // Un choix déjà fait qui reste dans la liste ne bouge pas ; sinon, le défaut
  // du catalogue reprend la main (un modèle grisé n'a pas disparu).
  useEffect(() => {
    if (!etat) return
    setModeleChoisi((actuel) => {
      if (actuel && etat.modeles.some((m) => m.identifiant === actuel)) return actuel
      return etat.modele?.identifiant ?? null
    })
  }, [etat])

  const modeleActif = etat?.modeles.find((m) => m.identifiant === modeleChoisi) ?? null
  // Le modèle qui partira vraiment : celui qu'on a choisi s'il existe encore,
  // le défaut du serveur sinon — jamais un identifiant qu'on invente.
  const raisonDuModele = modeleChoisi ? (modeleActif ? modeleActif.raison : "modèle inconnu") : (etat?.raison ?? null)

  // ── Ce qui part, lu sur le serveur ────────────────────────────────────────
  useEffect(() => {
    if (!texte.trim() || !etat?.modele) {
      setApercu(null)
      return
    }
    let vivant = true
    const attente = setTimeout(() => {
      routes
        .cequiPart(asset.identifiant, texte, modeleChoisi)
        .then((recu) => vivant && setApercu(recu))
        .catch(() => vivant && setApercu(null))
    }, 250)
    return () => {
      vivant = false
      clearTimeout(attente)
    }
  }, [texte, etat?.modele, asset.identifiant, modeleChoisi])

  // ── Le suivi d'une zone lancée ────────────────────────────────────────────
  useEffect(() => {
    if (!enCours) return
    const rang = suivi.current
    const battement = setInterval(() => {
      routes
        .resultat(enCours.generation)
        .then((recu) => {
          if (rang !== suivi.current || !TERMINES.includes(recu.statut)) return
          setEnCours(null)
          if (recu.calque) {
            setResultat(recu.calque)
            void charger()
          } else {
            onErreur(recu.raison ?? "la zone n'a pas été repeinte")
          }
        })
        .catch((erreur) => onErreur(erreur instanceof Error ? erreur.message : String(erreur)))
    }, intervalle)
    return () => clearInterval(battement)
  }, [enCours, intervalle, charger, onErreur])

  const ecoule = useEcoule(enCours?.depuis ?? null)

  const pinceau = {
    actif: OPACITE,
    choisir: () => {},
    sens,
    setSens,
    diametre,
    setDiametre,
    couleur: "",
    setCouleur: () => {},
  } as unknown as EtatMain

  const raisonDuBouton = !etat
    ? "on lit ce que l'atelier sait faire…"
    : raisonDuModele
      ? raisonDuModele
      : traits.length === 0
        ? "Peignez d'abord la zone à repeindre."
        : !texte.trim()
          ? "Écrivez ce qu'il faut mettre dans la zone."
          : enCours
            ? "Une zone est déjà en train d'être repeinte."
            : null

  const partir = async (demande: { texte: string; zone: Trait[]; force: number | null; couleurs: number | null; graine: number | null; modele: string | null }) => {
    suivi.current += 1
    try {
      const recu = await routes.lancer(asset.identifiant, {
        texte: demande.texte,
        zone: demande.zone,
        ...(demande.graine !== null ? { graine: demande.graine } : {}),
        ...(demande.force !== null ? { force: demande.force } : {}),
        ...(demande.couleurs !== null ? { couleurs: demande.couleurs } : {}),
        ...(demande.modele !== null ? { modele: demande.modele } : {}),
      })
      setResultat(null)
      setEnCours({ generation: recu.generation, depuis: Date.now() / 1000 })
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : String(erreur))
    }
  }

  const lancer = () => {
    if (raisonDuBouton) return
    const lue = graine.trim() === "" ? null : Number(graine)
    void partir({ texte: texte.trim(), zone: traits, force, couleurs, graine: Number.isInteger(lue) ? lue : null, modele: modeleChoisi })
  }

  const garder = () => {
    setResultat(null)
    void charger()
  }

  const jeter = async (calque: CalqueRepeint) => {
    try {
      await api.supprimerAssets([calque.identifiant])
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : String(erreur))
      return
    }
    setResultat(null)
    void charger()
  }

  // **Recommencer reprend ce qui est parti pour ce calque-là**, pas ce que le
  // champ porte maintenant : on a pu continuer d'écrire pendant que la zone
  // tournait, et relancer ce brouillon-là serait un autre geste. Une autre
  // graine, tirée par le serveur.
  const recommencer = async (calque: CalqueRepeint) => {
    await jeter(calque)
    await partir({ texte: calque.texte, zone: calque.zone, force: calque.force, couleurs: calque.couleurs, graine: null, modele: calque.modele })
  }

  const rouvrir = (calque: CalqueRepeint) => {
    suivi.current += 1
    setEnCours(null)
    setTraits(calque.zone)
    setTexte(calque.texte)
    setForce(calque.force)
    setCouleurs(calque.couleurs)
    setGraine(calque.graine === null ? "" : String(calque.graine))
    // Le calque garde le modèle qui l'a repeint — le rouvrir choisit ce
    // même modèle, sinon la fiche mentirait sur ce qui repartirait.
    setModeleChoisi(calque.modele)
    setResultat(calque)
  }

  // PX7 : un outil se demande par son identifiant — sdxl comme les quatre
  // autres. `installe` porte celui qui s'installe, pour ne griser que son
  // propre bouton.
  const installer = async (identifiant: string) => {
    setInstalle(identifiant)
    try {
      await stylesLocaux.installer(identifiant)
      await charger()
    } catch (erreur) {
      onErreur(erreur instanceof Error ? erreur.message : String(erreur))
    } finally {
      setInstalle(null)
    }
  }

  // Le temps suit le modèle choisi (PX7) — celui du défaut sans choix.
  const temps = modeleActif?.temps ?? etat?.temps ?? null
  const annonce = tempsParImage(temps) ?? "durée non encore mesurée"
  const forceMontree = force ?? etat?.force?.defaut ?? 0.9
  const couleursMontrees = couleurs ?? etat?.couleurs.defaut ?? 4

  return (
    <div data-repeindre className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_380px] bg-papier">
      {/* ── L'image, la zone peinte par-dessus, et le calque revenu ────────── */}
      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-[8px] p-[22px]">
        <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${largeur} / ${hauteur}`, height: "min(100%, 72vh)" }}>
          <ToileDeLaMain
            asset={asset}
            avant={false}
            etat={pinceau}
            onPassage={(trait) => setTraits((deja) => [...deja, { ...trait, couleur: "" }])}
            rendu={
              <div className="relative h-full w-full">
                <img src={api.rendu(asset.identifiant, asset.empreinte ?? "")} alt={asset.label} draggable={false} className="damier-papier absolute inset-0 h-full w-full object-contain select-none" style={PIXELS} />
                {resultat && (
                  <img data-calque-repeint src={api.rendu(resultat.identifiant, resultat.empreinte ?? "")} alt={`Le calque « ${resultat.texte} »`} draggable={false} className="absolute inset-0 h-full w-full object-contain select-none" style={PIXELS} />
                )}
                <ZonePeinte traits={traits} largeur={largeur} hauteur={hauteur} attenuee={Boolean(resultat)} />
              </div>
            }
          />
        </div>
        <p className="text-[12px] text-encre-3">
          {sens ? "Le pinceau peint la zone à repeindre." : "La gomme retire de la zone."} Le reste de l'image ne bouge pas d'un pixel.
        </p>
      </div>

      {/* ── Le panneau ──────────────────────────────────────────────────────── */}
      <aside {...PANNEAU} className="flex min-h-0 flex-col border-l border-trait bg-papier-cote">
        <div className="mesure flex h-[30px] shrink-0 items-center border-b border-trait px-[8px] text-[10.5px] tracking-[0.14em] text-encre-4 uppercase">
          Repeindre
        </div>
        <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[8px]">
          {/* Pas de modèle du tout : pourquoi, et comment en avoir un. */}
          {etat && !etat.modele && (
            <div data-sans-modele className="flex flex-col gap-[4px] rounded-7 border border-trait bg-carte p-[8px]">
              <p className="text-[12px] text-encre">{etat.raison}</p>
              {etat.outil.pret ? (
                <button type="button" disabled={installe === etat.outil.identifiant} onClick={() => void installer(etat.outil.identifiant)} className="h-[30px] self-start rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50">
                  {installe === etat.outil.identifiant ? "installation…" : `Installer l’outil « ${etat.outil.nom} »`}
                </button>
              ) : (
                <p className="mesure text-[10.5px] text-encre-4">
                  Il manque, dans ComfyUI : {etat.outil.manque.join(" · ") || "ComfyUI ne répond pas"}.
                </p>
              )}
            </div>
          )}

          {/* PX7 : un outil par famille de moteur local — celui qui manque
              encore s'installe d'ici, qu'un autre soit déjà prêt ou non. */}
          {etat && etat.outils.some((o) => !o.modele) && (
            <div data-moteurs-locaux className="flex flex-col gap-[6px] rounded-7 border border-trait bg-carte p-[8px]">
              <p className="text-[11px] text-encre-2">les moteurs locaux</p>
              {etat.outils.map((outil) => (
                <div key={outil.identifiant} className="flex items-center justify-between gap-[8px] text-[12px]">
                  <span className="min-w-0 truncate text-encre">{outil.nom}</span>
                  {outil.modele ? (
                    <span className="mesure shrink-0 text-[10.5px] text-encre-4">installé</span>
                  ) : outil.pret ? (
                    <button
                      type="button"
                      disabled={installe === outil.identifiant}
                      onClick={() => void installer(outil.identifiant)}
                      className="h-[26px] shrink-0 rounded-5 border border-contour bg-carte px-[8px] text-[11px] text-encre-controle disabled:opacity-50"
                    >
                      {installe === outil.identifiant ? "installation…" : "Installer"}
                    </button>
                  ) : (
                    <span className="mesure shrink-0 truncate text-[10.5px] text-encre-4" title={outil.manque.join(" · ")}>
                      manque : {outil.manque.join(" · ") || "ComfyUI ne répond pas"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PX7 : le choix du modèle, parmi ceux qui savent repeindre une
              zone — un modèle absent ou incapable est grisé, avec sa raison. */}
          {etat && etat.modeles.length > 0 && (
            <label className="flex flex-col gap-[4px] border-t border-trait pt-[8px] text-[12px] text-encre-2">
              <Libelle aide="repeint.modele">Modèle</Libelle>
              <select
                aria-label="Modèle"
                data-choix-modele-zone
                value={modeleChoisi ?? ""}
                onChange={(e) => setModeleChoisi(e.target.value || null)}
                className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
              >
                {etat.modeles.map((m) => (
                  <option key={m.identifiant} value={m.identifiant} disabled={!!m.raison} title={m.raison ?? undefined}>
                    {m.nom}
                    {m.raison ? ` — ${m.raison}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* La zone : pinceau, gomme, taille, effacer. */}
          <div className="flex flex-col gap-[8px]">
            <p className="text-[11px] text-encre-2">la zone</p>
            <div role="group" aria-label="Pinceau ou gomme" className="flex gap-[4px]">
              {([true, false] as const).map((peint) => (
                <button key={String(peint)} type="button" aria-pressed={sens === peint} onClick={() => setSens(peint)} className={`h-[30px] rounded-7 border px-[8px] text-[12px] ${sens === peint ? "border-encre-4 bg-carte text-encre" : "border-trait text-encre-3"}`}>
                  {peint ? "Pinceau" : "Gomme"}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Taille du pinceau" className="flex flex-wrap gap-[4px]">
              {DIAMETRES.map((d) => (
                <button key={d} type="button" aria-pressed={diametre === d} onClick={() => setDiametre(d)} className={`mesure h-[26px] min-w-[34px] rounded-5 border px-[4px] text-[11px] ${diametre === d ? "border-encre-4 bg-carte text-encre" : "border-trait text-encre-3"}`}>
                  {d} px
                </button>
              ))}
            </div>
            <div className="flex items-center gap-[8px]">
              <button type="button" disabled={traits.length === 0} onClick={() => setTraits((deja) => deja.slice(0, -1))} className="text-[12px] text-encre-2 disabled:text-eteint">
                Défaire le dernier trait
              </button>
              <button type="button" disabled={traits.length === 0} onClick={() => setTraits([])} className="text-[12px] text-encre-2 disabled:text-eteint">
                Effacer la zone
              </button>
            </div>
            <span className="mesure text-[10.5px] text-encre-4">pinceau carré de {2 * rayonDe(diametre) + 1} px, sur les pixels de l'image</span>
          </div>

          {/* Le texte, et ce qui part. */}
          <div className="flex flex-col gap-[4px] border-t border-trait pt-[8px]">
            <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
              ce qu'il faut y mettre
              <textarea
                aria-label="Ce qu'il faut mettre dans la zone"
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={2}
                placeholder="blue spiky hair"
                className="rounded-7 border border-trait bg-carte p-[8px] text-[13px] text-encre"
              />
            </label>
            <span className="mesure text-[10.5px] text-encre-4">le moteur local lit l'anglais ; ton texte part mot pour mot, sans l'univers du jeu</span>
            {apercu && (
              <div data-ce-qui-part className="flex flex-col gap-[4px] rounded-5 bg-carte p-[8px]">
                <span className="text-[11px] text-encre-3">ce qui part</span>
                <code className="mesure text-[11px] break-words text-encre">{apercu.texte}</code>
                {apercu.negatif && <code className="mesure text-[10.5px] break-words text-encre-4">à éviter : {apercu.negatif}</code>}
                <span className="mesure text-[10.5px] text-encre-4">avec l'image ouverte, et la zone en noir et blanc</span>
              </div>
            )}
          </div>

          {/* Les deux réglages de la génération. */}
          {etat?.force && (
            <div className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
              <label className="flex items-center gap-[8px] text-[12px] text-encre-2">
                Force
                <input aria-label="Force de la retouche" type="range" min={etat.force.minimum} max={etat.force.maximum} step={0.05} value={forceMontree} onChange={(e) => setForce(Number(e.target.value))} className="min-w-0 flex-1" />
                <span className="mesure w-[34px] text-[11px]">{forceMontree.toFixed(2)}</span>
              </label>
              <label className="flex items-center gap-[8px] text-[12px] text-encre-2">
                Couleurs neuves
                <input aria-label="Couleurs neuves permises" type="number" min={0} max={etat.couleurs.maximum} value={couleursMontrees} onChange={(e) => setCouleurs(Math.max(0, Math.min(etat.couleurs.maximum, Math.round(Number(e.target.value)))))} className="w-[54px] rounded-5 border border-trait bg-carte p-[4px]" />
              </label>
              <label className="flex items-center gap-[8px] text-[12px] text-encre-2">
                Graine
                <input aria-label="Graine" type="number" min={0} value={graine} placeholder="tirée au hasard" onChange={(e) => setGraine(e.target.value)} className="min-w-0 flex-1 rounded-5 border border-trait bg-carte p-[4px]" />
              </label>
            </div>
          )}

          {/* Le bouton, et le temps qu'il annonce. */}
          <div className="flex flex-col gap-[4px] border-t border-trait pt-[8px]">
            <button type="button" data-lancer-la-zone disabled={raisonDuBouton !== null} onClick={lancer} className="h-[34px] rounded-7 bg-signal px-[14px] text-[12px] text-encre-sur-signal disabled:opacity-50">
              Repeindre · {annonce}
            </button>
            {raisonDuBouton && etat && <span className="mesure text-[10.5px] text-encre-4">— {raisonDuBouton}</span>}
            {etat?.modele && <span className="mesure text-[10.5px] text-encre-4">{origineDuTemps(temps)} Sur cette machine, rien n'est payé.</span>}
            {enCours && (
              <p role="status" className="text-[12px] text-encre-2">
                La zone se repeint… {Math.round(ecoule)} s écoulées{temps?.secondes ? ` sur ≈ ${Math.round(temps.secondes)}` : ""}.
              </p>
            )}
          </div>

          {/* Le résultat : l'image avec le calque, le calque seul, et le jugement. */}
          {resultat && (
            <div data-resultat-de-la-zone className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
              <p className="text-[11px] text-encre-2">le calque « {resultat.texte} »</p>
              <div className="flex gap-[8px]">
                <Vignette titre="l'image avec le calque">
                  <img src={api.rendu(asset.identifiant, asset.empreinte ?? "")} alt="" className="absolute inset-0 h-full w-full object-contain" style={PIXELS} />
                  <img src={api.rendu(resultat.identifiant, resultat.empreinte ?? "")} alt="" className="absolute inset-0 h-full w-full object-contain" style={PIXELS} />
                </Vignette>
                <Vignette titre="le calque seul">
                  <img src={api.rendu(resultat.identifiant, resultat.empreinte ?? "")} alt="" className="absolute inset-0 h-full w-full object-contain" style={PIXELS} />
                </Vignette>
              </div>
              {resultat.mesures && (
                <span className="mesure text-[10.5px] text-encre-4">
                  {resultat.mesures.pixels_changes} pixels changés · {resultat.mesures.pixels_hors_zone} hors de la zone · {resultat.mesures.couleurs_neuves} couleur{resultat.mesures.couleurs_neuves > 1 ? "s" : ""} neuve{resultat.mesures.couleurs_neuves > 1 ? "s" : ""}
                </span>
              )}
              <span className="mesure text-[10.5px] text-encre-4">
                graine {resultat.graine ?? "—"} · force {resultat.force ?? "—"}
                {resultat.parti ? ` · parti : « ${resultat.parti.texte} »` : ""}
              </span>
              <div className="flex gap-[8px]">
                <button type="button" onClick={garder} className="h-[30px] rounded-7 border border-encre-4 bg-carte px-[8px] text-[12px] font-medium text-encre">Garder</button>
                <button type="button" onClick={() => void jeter(resultat)} className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle">Jeter</button>
                <button type="button" disabled={Boolean(enCours) || Boolean(etat?.raison)} onClick={() => void recommencer(resultat)} className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50">Recommencer</button>
              </div>
              {onRetoucher && (
                <button type="button" onClick={() => onRetoucher(resultat.identifiant)} className="self-start text-[12px] text-encre-2">
                  Retoucher ce calque ›
                </button>
              )}
            </div>
          )}

          {/* Les calques déjà repeints sur cette image : ils se rouvrent. */}
          {etat && etat.calques.length > 0 && (
            <div data-calques-repeints className="flex flex-col gap-[4px] border-t border-trait pt-[8px]">
              <p className="text-[11px] text-encre-2">les calques repeints sur cette image</p>
              {etat.calques.map((calque) => (
                <button key={calque.identifiant} type="button" aria-pressed={resultat?.identifiant === calque.identifiant} onClick={() => rouvrir(calque)} className="flex items-center gap-[8px] rounded-5 border border-trait bg-carte p-[4px] text-left text-[12px] text-encre hover:border-encre-4">
                  <span className="damier-papier relative h-[30px] w-[30px] shrink-0 overflow-hidden rounded-5">
                    <img src={api.rendu(calque.identifiant, calque.empreinte ?? "")} alt="" className="absolute inset-0 h-full w-full object-contain" style={PIXELS} />
                  </span>
                  <span className="min-w-0 truncate">{calque.texte}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
