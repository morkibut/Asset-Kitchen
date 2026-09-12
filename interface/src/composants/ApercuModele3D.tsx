import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import type { Camera3D } from "../api-3d"

const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
type Commandes = { animation: number; joue: boolean; temps: number; squelette: boolean; azimut: number; elevation: number; zoom: number }

/** La fenêtre se calcule sur l’union des poses, puis reste fixe pendant la
 * lecture. Recadrer sur la frame courante ferait sauter les pieds à chaque pas. */
export default function ApercuModele3D({ url, nom, cameraInitiale, onCamera }: { url: string; nom: string; cameraInitiale?: Camera3D; onCamera?: (camera: Camera3D) => void }) {
  const cadre = useRef<HTMLDivElement>(null)
  const [erreur, setErreur] = useState("")
  const [charge, setCharge] = useState(false)
  const [animations, setAnimations] = useState<{ nom: string; duree: number }[]>([])
  const [commande, setCommande] = useState<Commandes>({ animation: 0, joue: true, temps: 0, squelette: false, azimut: cameraInitiale?.azimut ?? 45, elevation: cameraInitiale?.elevation ?? 25, zoom: 1 })
  const commandes = useRef(commande)
  commandes.current = commande
  const afficherTemps = useRef<(temps: number) => void>(() => {})
  const duree = animations[commande.animation]?.duree ?? 0

  useEffect(() => {
    const conteneur = cadre.current
    if (!conteneur) return
    let vivant = true, raf = 0, rendu: THREE.WebGLRenderer | undefined, orbit: OrbitControls | undefined
    let racine: THREE.Object3D | undefined, squelette: THREE.SkeletonHelper | undefined, mixer: THREE.AnimationMixer | undefined
    let observer: ResizeObserver | undefined
    setCharge(false); setErreur(""); setAnimations([])
    const detruire = (objet: THREE.Object3D) => objet.traverse((o) => {
      const maille = o as THREE.Mesh
      maille.geometry?.dispose()
      for (const materiau of (Array.isArray(maille.material) ? maille.material : maille.material ? [maille.material] : [])) {
        for (const v of Object.values(materiau)) if (v instanceof THREE.Texture) v.dispose()
        materiau.dispose()
      }
    })
    const ouvrir = async () => {
      try {
        rendu = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        rendu.setClearAlpha(0)
        rendu.outputColorSpace = THREE.SRGBColorSpace
        rendu.domElement.setAttribute("aria-label", `Vue 3D de ${nom}`)
        rendu.domElement.setAttribute("role", "img")
        conteneur.appendChild(rendu.domElement)
        const scene = new THREE.Scene()
        const teinte = getComputedStyle(conteneur).getPropertyValue("--color-diag-blanc").trim()
        scene.add(new THREE.AmbientLight(teinte, 1.5))
        const lumiere = new THREE.DirectionalLight(teinte, 3)
        lumiere.position.set(3, 5, 4); scene.add(lumiere)
        const gestion = new THREE.LoadingManager()
        // Une copie GLB est autonome. Elle ne doit pas charger en silence une
        // texture réseau qui ferait disparaître l’aperçu moteur éteint.
        gestion.setURLModifier((adresse) => {
          if (adresse === url || adresse.startsWith("blob:") || adresse.startsWith("data:")) return adresse
          throw new Error("Ce modèle demande une texture externe. Importez un GLB avec ses textures intégrées.")
        })
        const gltf = await new GLTFLoader(gestion).loadAsync(url)
        if (!vivant) { detruire(gltf.scene); return }
        racine = gltf.scene; scene.add(racine)
        mixer = new THREE.AnimationMixer(racine)
        const boite = new THREE.Box3().setFromObject(racine, true)
        for (const clip of gltf.animations) {
          const action = mixer.clipAction(clip).play()
          for (let i = 0; i <= 32; i++) {
            mixer.setTime(clip.duration * i / 32)
            racine.updateMatrixWorld(true)
            boite.union(new THREE.Box3().setFromObject(racine, true))
          }
          action.stop()
        }
        mixer.setTime(0)
        if (boite.isEmpty() || !Number.isFinite(boite.min.x + boite.max.x)) throw new Error("Ce modèle ne contient aucune géométrie visible.")
        const centre = boite.getCenter(new THREE.Vector3())
        const rayon = Math.max(boite.getSize(new THREE.Vector3()).length() / 2, .001) * 1.12
        const camera = new THREE.OrthographicCamera(-rayon, rayon, rayon, -rayon, rayon / 1000, rayon * 20)
        const poserCamera = (c: Commandes) => {
          const a = THREE.MathUtils.degToRad(c.azimut), e = THREE.MathUtils.degToRad(c.elevation)
          camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(rayon * 5).add(centre)
          camera.zoom = c.zoom; camera.lookAt(centre); camera.updateProjectionMatrix()
          orbit?.target.copy(centre); orbit?.update()
        }
        poserCamera(commandes.current)
        orbit = new OrbitControls(camera, rendu.domElement)
        orbit.target.copy(centre); orbit.enableDamping = false; orbit.minZoom = .25; orbit.maxZoom = 8
        orbit.addEventListener("end", () => {
          const relative = camera.position.clone().sub(orbit!.target)
          centre.copy(orbit!.target)
          setCommande((c) => ({ ...c, azimut: THREE.MathUtils.radToDeg(Math.atan2(relative.x, relative.z)), elevation: THREE.MathUtils.radToDeg(Math.asin(relative.y / relative.length())), zoom: camera.zoom }))
        })
        squelette = new THREE.SkeletonHelper(racine)
        squelette.visible = commandes.current.squelette; scene.add(squelette)
        setAnimations(gltf.animations.map((a, i) => ({ nom: a.name || `Animation ${i + 1}`, duree: a.duration })))
        setCharge(true)
        const adapter = () => {
          const largeur = Math.max(1, conteneur.clientWidth), hauteur = Math.max(1, conteneur.clientHeight), ratio = largeur / hauteur
          camera.left = -rayon * Math.max(1, ratio); camera.right = -camera.left
          camera.top = rayon * Math.max(1, 1 / ratio); camera.bottom = -camera.top
          camera.updateProjectionMatrix(); rendu!.setSize(largeur, hauteur)
        }
        observer = new ResizeObserver(adapter); observer.observe(conteneur); adapter()
        let animation = -1, action: THREE.AnimationAction | undefined, derniere = performance.now(), publication = 0
        let azimut = commandes.current.azimut, elevation = commandes.current.elevation, zoom = commandes.current.zoom
        afficherTemps.current = (t) => { if (action) { action.time = t; mixer!.update(0) } }
        const jouer = (maintenant: number) => {
          if (!vivant) return
          const c = commandes.current, delta = Math.min((maintenant - derniere) / 1000, .1)
          derniere = maintenant
          if (animation !== c.animation) {
            mixer!.stopAllAction(); animation = c.animation
            const clip = gltf.animations[animation]
            action = clip ? mixer!.clipAction(clip).reset().play() : undefined
          }
          if (c.azimut !== azimut || c.elevation !== elevation || c.zoom !== zoom) {
            poserCamera(c); azimut = c.azimut; elevation = c.elevation; zoom = c.zoom
          }
          squelette!.visible = c.squelette
          if (c.joue && action && !document.hidden) mixer!.update(delta)
          if (action && c.joue && maintenant - publication > 100) {
            publication = maintenant; const temps = action.time
            setCommande((precedente) => ({ ...precedente, temps }))
          }
          rendu!.render(scene, camera)
          raf = requestAnimationFrame(jouer)
        }
        raf = requestAnimationFrame(jouer)
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : "La vue 3D ne peut pas s’ouvrir sur cette machine.")
      }
    }
    void ouvrir()
    return () => {
      vivant = false; cancelAnimationFrame(raf); observer?.disconnect(); orbit?.dispose()
      afficherTemps.current = () => {}; mixer?.stopAllAction()
      if (racine) { mixer?.uncacheRoot(racine); detruire(racine) }
      if (squelette) detruire(squelette)
      rendu?.dispose(); rendu?.domElement.remove()
    }
  }, [url, nom])

  const reglage = (cle: "azimut" | "elevation" | "zoom", libelle: string, min: number, max: number, pas: number) => <label className="flex min-w-0 flex-col gap-[4px] text-[12px]">{libelle}<div className="flex items-center gap-[8px]"><input aria-label={libelle} type="range" min={min} max={max} step={pas} value={commande[cle]} onChange={(e) => setCommande((c) => ({ ...c, [cle]: Number(e.target.value) }))} className="min-w-0 flex-1 accent-signal" /><input aria-label={`Valeur — ${libelle}`} type="number" min={min} max={max} step={pas} value={Number(commande[cle].toFixed(2))} onChange={(e) => setCommande((c) => ({ ...c, [cle]: Math.max(min, Math.min(max, Number(e.target.value))) }))} className={`${CHAMP} w-[128px]`} /></div></label>
  return <div className="flex min-h-0 flex-1 flex-col gap-[14px]">
    <div ref={cadre} className="damier-papier relative min-h-0 flex-1 overflow-hidden rounded-8 border border-trait" />
    {erreur ? <p role="alert" className="text-[13px] text-echec">{erreur} Le fichier reste téléchargeable.</p> : !charge && <p role="status" className="text-[13px] text-encre-3">Ouverture du modèle et calcul du cadre de ses animations…</p>}
    <div className="flex flex-wrap items-center gap-[14px]">
      {!!animations.length && <><select aria-label="Animation du modèle" className={CHAMP} value={commande.animation} onChange={(e) => setCommande((c) => ({ ...c, animation: Number(e.target.value), temps: 0 }))}>{animations.map((a, i) => <option key={i} value={i}>{a.nom}</option>)}</select><button className={CHAMP} onClick={() => setCommande((c) => ({ ...c, joue: !c.joue }))}>{commande.joue ? "Pause" : "Lire"}</button><input aria-label="Position dans l’animation 3D" type="range" min={0} max={duree} step={.01} value={commande.temps} onChange={(e) => { const t = Number(e.target.value); setCommande((c) => ({ ...c, joue: false, temps: t })); afficherTemps.current(t) }} className="min-w-0 flex-1 accent-signal" /><span className="font-mono text-[12px]">{commande.temps.toFixed(2)} / {duree.toFixed(2)} s</span></>}
      <label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={commande.squelette} onChange={(e) => setCommande((c) => ({ ...c, squelette: e.target.checked }))} />Voir le squelette</label>
    </div>
    <div className="grid grid-cols-3 gap-[22px]">{reglage("azimut", "Tourner autour du modèle (°)", -180, 180, 1)}{reglage("elevation", "Hauteur de la caméra (°)", -85, 85, 1)}{reglage("zoom", "Zoom", .25, 8, .05)}</div>
    <p className="text-[12px] text-encre-3">Glisser pour tourner · molette pour zoomer · clic droit pour déplacer la vue. Cette inspection ne modifie pas le rendu conservé ni ses réglages.</p>
    {onCamera && <button className={`${CHAMP} self-start`} disabled={!charge} onClick={() => onCamera({ azimut: (commande.azimut % 360 + 360) % 360, elevation: commande.elevation })}>Utiliser cet angle pour le rendu</button>}
  </div>
}
