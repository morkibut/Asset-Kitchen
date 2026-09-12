import { useEffect, useMemo, useState } from "react"
import { api, type EmplacementCorps, type EmploiResolu, type Personnage, type Piece } from "../api"
import { apiCalques, cleCible, ETAT_CALQUE, type CiblesEmploi, type ImageCible, type VarianteCalque } from "../api-calques"
import { ChoisirImageEquipement } from "./ChoisirImageEquipement"
import { EditeurCalqueCible } from "./EditeurCalqueCible"
import { CouvertureDeLEmploi } from "./CouvertureDeLEmploi"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"

export function CalquesDeLEmploi({ projet, emploi, piece, porteur, emplacements, onRegler, onHistorique, onLesAutresEmplois, onPorteur, cibleInitiale, varianteInitiale }: {
  projet: string; emploi: EmploiResolu; piece: Piece; porteur: Personnage; emplacements: readonly EmplacementCorps[]
  onRegler: (champs: { nom?: string; emplacement?: string; devant?: boolean; description?: string }) => void
  onHistorique: () => void; onLesAutresEmplois: () => void
  /** **Revenir au personnage qui porte** — la pièce a pu être nommée depuis sa
   *  fiche, et ce chemin-là doit rester ouvert dans les deux sens (US-537). */
  onPorteur?: () => void
  cibleInitiale?: import("../api-calques").CibleCalque; varianteInitiale?: string
}) {
  const chemin = useMemo(() => ({ projet, piece: piece.identifiant, emploi: emploi.identifiant }), [projet, piece.identifiant, emploi.identifiant])
  const [donnees, setDonnees] = useState<CiblesEmploi | null>(null)
  const [cibleChoisie, setCibleChoisie] = useState(cibleInitiale ? cleCible(cibleInitiale) : "")
  const [varianteChoisie, setVarianteChoisie] = useState(varianteInitiale ?? "")
  const [choisirImage, setChoisirImage] = useState(false)
  const [sale, setSale] = useState(false)
  const [erreur, setErreur] = useState("")
  const [nature, setNature] = useState("")
  const [filtre, setFiltre] = useState("")
  const [rafraichi, setRafraichi] = useState(0)
  const [emplacementsAjoutes, setEmplacementsAjoutes] = useState<EmplacementCorps[]>([])
  const [nouvelEmplacement, setNouvelEmplacement] = useState("")
  const [ajoutEmplacement, setAjoutEmplacement] = useState(false)
  const [sauve, setSauve] = useState("")
  const [couverture, setCouverture] = useState(false)
  useEffect(() => {
    let vivant = true
    apiCalques.cibles(chemin).then((r) => {
      if (!vivant) return
      setDonnees(r)
      setCibleChoisie((c) => c || (r.cibles[0] ? cleCible(r.cibles[0].cible) : ""))
    }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire les cibles de l’emploi.") })
    return () => { vivant = false }
  }, [chemin, rafraichi])

  const noms = new Map(porteur.plan.map((p) => [p.identifiant, p.nom]))
  const selection = donnees?.cibles.find((c) => cleCible(c.cible) === cibleChoisie)
  const variantes = donnees?.variantes.filter((v) => cleCible(v.cible) === cibleChoisie) ?? []
  const variante = variantes.find((v) => v.identifiant === varianteChoisie) ?? variantes.find((v) => v.retenue) ?? variantes.at(-1)
  const autoriser = () => { if (sale) { setErreur("Enregistrez ou abandonnez les corrections avant de changer d’image."); return false }; setErreur(""); return true }
  const choisir = (c: ImageCible) => { if (autoriser()) { setCibleChoisie(cleCible(c.cible)); setVarianteChoisie(""); setChoisirImage(false); setSauve("") } }
  const garder = (v: VarianteCalque) => {
    setSale(false); setCibleChoisie(cleCible(v.cible)); setVarianteChoisie(v.identifiant); setChoisirImage(false)
    setDonnees((d) => d ? { ...d, variantes: [...d.variantes.filter((a) => a.identifiant !== v.identifiant).map((a) => cleCible(a.cible) === cleCible(v.cible) && v.retenue ? { ...a, retenue: false, utilisable: false } : a), v] } : d)
    setSauve(v.utilisable ? "Variante vérifiée et retenue pour cette cible." : "Variante enregistrée. Les autres versions sont conservées.")
  }
  const ciblesVisibles = (donnees?.cibles ?? []).filter((c) => {
    if (nature && c.cible.nature !== nature) return false
    const vs = donnees?.variantes.filter((v) => cleCible(v.cible) === cleCible(c.cible)) ?? []
    return !filtre || (filtre === "sans-calque" ? !vs.some((v) => v.role === "calque") : filtre === "retenues" ? vs.some((v) => v.utilisable) : vs.some((v) => v.etat === filtre))
  })
  const groupes = new Map<string, Map<string, ImageCible[]>>()
  for (const c of ciblesVisibles) {
    if (!groupes.has(c.pose)) groupes.set(c.pose, new Map())
    const ds = groupes.get(c.pose)!
    ds.set(c.direction, [...(ds.get(c.direction) ?? []), c])
  }
  const toutesPlaces = [...emplacements, ...emplacementsAjoutes.filter((e) => !emplacements.some((p) => p.identifiant === e.identifiant))]
  const ajouterPlace = async () => {
    const nom = nouvelEmplacement.trim(); if (!nom) return
    try { const r = await api.ajouterEmplacement(nom); setEmplacementsAjoutes(r.emplacements); const e = r.emplacements.find((e) => e.nom.toLocaleLowerCase("fr") === nom.toLocaleLowerCase("fr")); if (e) onRegler({ emplacement: e.identifiant }); setNouvelEmplacement(""); setAjoutEmplacement(false) }
    catch (e) { setErreur(e instanceof Error ? e.message : "L’emplacement n’a pas pu être ajouté.") }
  }

  return <main aria-label={`${piece.nom} portée par ${porteur.nom}`} data-calques-cibles className="flex min-h-0 min-w-0 flex-1 flex-col bg-papier">
    <header className="flex flex-wrap items-center justify-between gap-[14px] border-b border-trait px-[30px] py-[14px]">
      <div><h1 className="font-serif text-[38px] text-encre">{piece.nom} · {porteur.nom}</h1><p className="mt-[4px] text-[13px] text-encre-3">Un calque indépendant pour chaque image et chaque frame de ce personnage.</p></div>
      <div className="flex flex-wrap gap-[8px]"><button className={CONTROLE} onClick={() => { if (autoriser()) setCouverture(!couverture) }}>{couverture ? "Retoucher les calques" : "Couverture & fabrication"}</button>{onPorteur && <button className={CONTROLE} onClick={() => { if (autoriser()) onPorteur() }}>Revenir à {porteur.nom}</button>}<button className={CONTROLE} onClick={() => { if (autoriser()) onLesAutresEmplois() }}>Les autres emplois</button><button className={CONTROLE} onClick={() => { if (autoriser()) onHistorique() }}>Calques de pose historiques</button></div>
    </header>
    {erreur && <p role="alert" className="border-b border-trait px-[30px] py-[8px] text-[13px] text-echec">{erreur} <button className="underline" onClick={() => { if (!sale) { setErreur(""); setRafraichi((n) => n + 1) } }}>Relire</button></p>}
    {sauve && <p role="status" className="px-[30px] py-[8px] text-[12px] text-encre-3">{sauve}</p>}
    {couverture ? <CouvertureDeLEmploi chemin={chemin} onCalque={(c, v) => { setCibleChoisie(cleCible(c)); setVarianteChoisie(v ?? ""); setChoisirImage(false); setCouverture(false); setRafraichi((n) => n + 1) }} /> : <div className="flex min-h-0 flex-1">
      <aside aria-label="Cibles de cet emploi" className="defile flex w-[300px] shrink-0 flex-col gap-[14px] overflow-y-auto border-r border-trait bg-papier-cote p-[14px]">
        <details><summary className="cursor-pointer text-[13px] text-encre">Emplacement et superposition par défaut</summary><div className="mt-[8px] flex flex-col gap-[8px]"><label className="text-[12px] text-encre-3">Emplacement<select aria-label="Emplacement de cet emploi" className={`${CONTROLE} mt-[4px] w-full`} value={emploi.emplacement} onChange={(e) => onRegler({ emplacement: e.target.value })}><option value="">Celui de la pièce</option>{toutesPlaces.map((p) => <option value={p.identifiant} key={p.identifiant}>{p.nom}</option>)}</select></label><button className={CONTROLE} onClick={() => setAjoutEmplacement(!ajoutEmplacement)}>Ajouter un emplacement au jeu</button>{ajoutEmplacement && <div className="flex flex-col gap-[8px]"><input aria-label="Nom du nouvel emplacement" className={CONTROLE} value={nouvelEmplacement} onChange={(e) => setNouvelEmplacement(e.target.value)} placeholder="Ex. main gauche" /><button className={CONTROLE} disabled={!nouvelEmplacement.trim()} onClick={() => void ajouterPlace()}>Créer cet emplacement</button></div>}<p className="text-[11px] text-encre-4">L’emplacement classe la pièce. La position exacte et les parties cachées se règlent sur chaque calque.</p>
          {/* ── L'ordre des images, et pourquoi ce n'est pas l'orientation ──
              Le modèle porte déjà la finesse : `placement.devant` donne l'ordre
              par défaut, et le masque `derriere` peint, calque par calque, les
              morceaux qui passent sous le corps. Aucune direction n'entre dans
              la composition (`atelier/image/calques_cibles.py`). Ce qui manquait
              était de le dire à l'écran, comme la maquette le dit. */}
          <label className="text-[12px] text-encre-3">Ordre des calques par défaut<select aria-label="Ordre des calques par défaut" className={`${CONTROLE} mt-[4px] w-full`} value={emploi.devant ? "devant" : "derriere"} onChange={(e) => onRegler({ devant: e.target.value === "devant" })}><option value="devant">Au-dessus du personnage</option><option value="derriere">Sous le personnage</option></select></label>
          <p className="text-[11px] leading-[1.45] text-encre-3">Il s’agit de l’ordre des images, pas de la direction du regard : <strong>au-dessus</strong>, l’équipement cache les pixels du personnage ; <strong>sous</strong>, le personnage cache l’équipement là où ils se recouvrent.</p>
          <details><summary className="cursor-pointer text-[12px] text-encre-3">Et en vue de dessus à 3/4 ?</summary><p className="mt-[4px] text-[11px] leading-[1.45] text-encre-3">Un sac peut dépasser de la silhouette tout en restant caché par le torse. Le réglage se corrige pour chaque direction et chaque frame. Pour une pièce qui passe des deux côtés, utilisez les pinceaux « Passer cette partie dessous » et « Ramener cette partie dessus » dans l’atelier du calque : une partie de la pièce passe alors sous le personnage et le reste au-dessus, sur cette frame seule.</p></details>
          <p className="text-[11px] text-encre-4">Le réglage initial ne modifie pas les calques déjà ajustés.</p></div></details>
        <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Résultats de base<select className={CONTROLE} aria-label="Nature des cibles" value={nature} onChange={(e) => setNature(e.target.value)}><option value="">Images et animations</option><option value="image">Images fixes</option><option value="frame">Frames d’animation</option></select></label>
        <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Afficher<select className={CONTROLE} aria-label="État des calques" value={filtre} onChange={(e) => setFiltre(e.target.value)}><option value="">Toutes les cibles</option><option value="sans-calque">Sans calque extrait</option><option value="a-extraire">À extraire</option><option value="a-verifier">À vérifier</option><option value="a-revoir">Base à revoir</option><option value="retenues">Retenues</option></select></label>
        {!donnees && <p role="status" className="text-[13px] text-encre-3">Lecture des images et des animations…</p>}
        {donnees && <p className="text-[11px] text-encre-3">{donnees.cibles.length} images de base disponibles. Chaque frame garde sa propre identité quand le montage change.</p>}
        {[...groupes].map(([pose, directions]) => <details key={pose} open className="rounded-7 border border-trait bg-carte p-[8px]"><summary className="cursor-pointer font-serif text-[25px] text-encre">{noms.get(pose) ?? pose}</summary>{[...directions].map(([direction, cs]) => <details open key={direction} className="mt-[8px]"><summary className="cursor-pointer text-[12px] text-encre-3">{direction || "Sans direction définie"}</summary><div className="mt-[8px] flex flex-col gap-[4px]">{cs.map((c) => {
          const cle = cleCible(c.cible), vs = donnees?.variantes.filter((v) => cleCible(v.cible) === cle) ?? [], retenue = vs.find((v) => v.retenue), derniere = retenue ?? vs.at(-1)
          return <button key={cle} aria-pressed={cle === cibleChoisie} onClick={() => choisir(c)} className={`flex items-center gap-[8px] rounded-7 border p-[4px] text-left ${cle === cibleChoisie ? "border-signal bg-ligne-ouverte" : "border-transparent hover:border-contour"}`}><img src={apiCalques.imageCible(chemin, c.cible)} alt="" loading="lazy" className="damier-papier h-[54px] w-[54px] shrink-0 object-contain" /><span className="min-w-0 text-[12px] text-encre"><span className="block truncate">{c.cible.nature === "frame" ? `${c.nom_bande || "Animation"} · frame ${(c.rang ?? 0) + 1}` : c.image?.label || "Image fixe"}</span><span className="block text-[11px] text-encre-3">{derniere ? `${ETAT_CALQUE[derniere.etat]}${derniere.utilisable ? " · retenue" : ""}` : "Sans calque"}</span></span></button>
        })}</div></details>)}</details>)}
        {donnees && !ciblesVisibles.length && <p className="text-[13px] text-encre-3">{donnees.cibles.length ? "Aucune cible pour ces filtres." : "Créez ou importez d’abord une pose ou une animation nue du personnage. Ses frames apparaîtront ici."}</p>}
        {!!donnees?.variantes.some((v) => !donnees.cibles.some((c) => cleCible(c.cible) === cleCible(v.cible))) && <details><summary className="text-[12px] text-encre-3">Variantes dont la base a disparu</summary>{donnees.variantes.filter((v) => !donnees.cibles.some((c) => cleCible(c.cible) === cleCible(v.cible))).map((v) => <button key={v.identifiant} className={`${CONTROLE} mt-[8px] w-full truncate`} onClick={() => { if (autoriser()) { setCibleChoisie(cleCible(v.cible)); setVarianteChoisie(v.identifiant); setChoisirImage(false) } }}>{v.base.pose} · {v.base.direction || "sans direction"} · à revoir</button>)}</details>}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {(selection || variante) && <div className="flex flex-wrap items-center gap-[8px] border-b border-trait p-[14px]"><span className="min-w-0 flex-1 text-[13px] text-encre">{noms.get(selection?.pose ?? variante?.base.pose ?? "") ?? selection?.pose ?? variante?.base.pose} · {selection?.direction || variante?.base.direction || "sans direction"}{selection?.cible.nature === "frame" ? ` · frame ${(selection.rang ?? 0) + 1}` : ""}</span>{selection && <button className={CONTROLE} onClick={() => { if (autoriser()) setChoisirImage(true) }}>Associer ou importer une image</button>}</div>}
        {variantes.length > 0 && <div aria-label="Versions de cette cible" className="defile flex shrink-0 gap-[8px] overflow-x-auto border-b border-trait p-[14px]">{variantes.map((v) => <button key={v.identifiant} aria-pressed={variante?.identifiant === v.identifiant && !choisirImage} onClick={() => { if (autoriser()) { setVarianteChoisie(v.identifiant); setChoisirImage(false) } }} className={`flex w-[128px] shrink-0 flex-col gap-[4px] rounded-7 border p-[8px] text-left ${variante?.identifiant === v.identifiant && !choisirImage ? "border-signal bg-ligne-ouverte" : "border-trait bg-carte"}`}><img src={apiCalques.image(chemin, v)} alt="" loading="lazy" className="damier-papier h-[54px] w-full object-contain" /><span className="text-[11px] text-encre">{ETAT_CALQUE[v.etat]}{v.retenue ? " · retenue" : ""}</span></button>)}</div>}
        {choisirImage && selection ? <ChoisirImageEquipement onFermer={() => setChoisirImage(false)} onChoisir={async (asset, role) => garder(await apiCalques.creer(chemin, selection.cible, asset.identifiant, role))} />
          : variante ? <EditeurCalqueCible key={`${variante.identifiant}:${variante.revision}`} chemin={chemin} variante={variante} cibles={donnees?.cibles} onGarde={garder} onSale={setSale} />
            : <div className="p-[30px]"><h2 className="font-serif text-[25px] text-encre">{selection ? "Le premier calque de cette image" : "Choisir une image du personnage"}</h2><p className="mt-[14px] max-w-prose text-[13px] leading-[1.5] text-encre-3">{selection ? "Importez le personnage équipé pour en extraire la pièce, ou associez un calque déjà transparent. La base reste conservée et chaque version se vérifie avant d’être retenue." : "La liste regroupe les résultats existants par mouvement et direction. Les calques de pose d’avant cet atelier restent accessibles par le bouton historique."}</p>{selection && <button className={`${CONTROLE} mt-[22px]`} onClick={() => setChoisirImage(true)}>Choisir une image dans la bibliothèque</button>}</div>}
      </div>
    </div>}
  </main>
}
