import { useEffect, useMemo, useState } from "react"
import { api, libelleDEmploi, type Asset, type VestiaireDuJeu } from "../api"
import { apiCalques, cleCible, type CiblesEmploi, type RoleCalque, type VarianteCalque } from "../api-calques"
import { imageAsset } from "./Apercu"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"

/** Porte depuis la retouche : l’image reste en bibliothèque, l’association
 * nomme séparément la pièce, son emploi, la cible et le rôle de cette image. */
export function AssocierImageEquipement({ image, projet, onFermer, onAssocie }: {
  image: Asset; projet: string; onFermer: () => void
  onAssocie?: (piece: string, emploi: string, variante: VarianteCalque) => void
}) {
  const [vestiaire, setVestiaire] = useState<VestiaireDuJeu | null>(null)
  const [piece, setPiece] = useState("")
  const [emploi, setEmploi] = useState("")
  const [donnees, setDonnees] = useState<CiblesEmploi | null>(null)
  const [cible, setCible] = useState("")
  const [role, setRole] = useState<RoleCalque>("reference")
  const [erreur, setErreur] = useState("")
  const [message, setMessage] = useState("")
  const [attente, setAttente] = useState(false)
  const chemin = useMemo(() => ({ projet, piece, emploi }), [projet, piece, emploi])
  useEffect(() => { let vivant = true; api.emploisDuJeu().then((v) => { if (vivant) setVestiaire(v) }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire les équipements.") }); return () => { vivant = false } }, [projet])
  useEffect(() => {
    setDonnees(null); setCible("")
    if (!piece || !emploi) return
    let vivant = true
    apiCalques.cibles(chemin).then((r) => { if (vivant) setDonnees(r) }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire les cibles de cet emploi.") })
    return () => { vivant = false }
  }, [chemin, piece, emploi])
  const sienne = vestiaire?.pieces.find((p) => p.piece.identifiant === piece)
  const visee = donnees?.cibles.find((c) => cleCible(c.cible) === cible)
  return <section aria-label="Associer cette image à un équipement" className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto bg-papier p-[22px]">
    <header className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">Utiliser cette image pour un équipement</h2><button className={CONTROLE} disabled={attente} onClick={onFermer}>Revenir à la retouche</button></header>
    <p className="text-[13px] text-encre-3">Une pièce peut appartenir à plusieurs héros. Choisissez son emploi et l’image précise sur laquelle ce résultat doit servir.</p>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}{message && <p role="status" className="text-[13px] text-encre-2">{message}</p>}
    <div className="flex items-start gap-[22px]"><img src={imageAsset(image)} alt={image.label} className="damier-papier w-[128px] shrink-0 object-contain" /><div className="flex min-w-0 flex-1 flex-col gap-[14px]">
      <label className="flex flex-col gap-[4px] text-[13px] text-encre">Pièce<select aria-label="Pièce de cette image" value={piece} onChange={(e) => { setPiece(e.target.value); setEmploi(""); setMessage("") }} className={CONTROLE}><option value="">Choisir un équipement…</option>{vestiaire?.pieces.map((p) => <option key={p.piece.identifiant} value={p.piece.identifiant}>{p.piece.nom}</option>)}</select></label>
      <label className="flex flex-col gap-[4px] text-[13px] text-encre">Emploi<select aria-label="Emploi de cette image" disabled={!piece} value={emploi} onChange={(e) => setEmploi(e.target.value)} className={CONTROLE}><option value="">Choisir le personnage qui la porte…</option>{sienne?.emplois.filter((e) => e.genre === "porte" && !e.orphelin).map((e) => <option key={e.identifiant} value={e.identifiant}>{libelleDEmploi(e)}</option>)}</select></label>
      <label className="flex flex-col gap-[4px] text-[13px] text-encre">Rôle de l’image<select aria-label="Rôle de l’image associée" value={role} onChange={(e) => setRole(e.target.value as RoleCalque)} className={CONTROLE}><option value="reference">Référence d’apparence</option><option value="source-equipee">Personnage équipé, à extraire</option><option value="calque">Calque transparent déjà extrait</option></select></label>
      <p className="text-[12px] text-encre-3">{role === "reference" ? "La référence ne devient pas une couche superposable et ne compte pas comme un calque terminé." : role === "source-equipee" ? "Le corps complet reste dans l’image source. Une extraction séparée créera le calque à corriger et à retenir." : "Seuls les pixels de l’équipement doivent être visibles. Vous devrez vérifier la superposition avant de retenir cette variante."}</p>
    </div></div>
    {donnees && <><h3 className="font-serif text-[25px] text-encre">Image ou frame de base</h3><div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[8px]">{donnees.cibles.map((c) => <button key={cleCible(c.cible)} aria-pressed={cible === cleCible(c.cible)} onClick={() => setCible(cleCible(c.cible))} className={`rounded-7 border p-[8px] text-left ${cible === cleCible(c.cible) ? "border-signal bg-ligne-ouverte" : "border-trait bg-carte"}`}><img src={apiCalques.imageCible(chemin, c.cible)} alt="" loading="lazy" className="damier-papier h-[54px] w-full object-contain" /><span className="mt-[4px] block text-[12px] text-encre">{c.pose} · {c.direction || "sans direction"}</span><span className="text-[11px] text-encre-3">{c.cible.nature === "frame" ? `${c.nom_bande} · frame ${(c.rang ?? 0) + 1}` : "Image fixe"}</span></button>)}</div>{!donnees.cibles.length && <p className="text-[13px] text-encre-3">Ce personnage n’a pas encore de pose ou de frame disponible. Créez ou importez son corps avant d’y associer un équipement.</p>}</>}
    {vestiaire && !vestiaire.pieces.length && <p className="text-[13px] text-encre-3">Créez d’abord une pièce depuis l’onglet Équipements du personnage. Vous pourrez ensuite y associer cette image.</p>}
    <button disabled={!visee || attente} className={`${CONTROLE} self-start`} onClick={async () => { if (!visee) return; setAttente(true); setErreur(""); try { const v = await apiCalques.creer(chemin, visee.cible, image.identifiant, role); setMessage("Image associée. Sa source et les autres variantes sont conservées."); onAssocie?.(piece, emploi, v) } catch (e) { setErreur(e instanceof Error ? e.message : "L’association n’a pas pu être enregistrée.") } finally { setAttente(false) } }}>Associer à cette cible</button>
  </section>
}
