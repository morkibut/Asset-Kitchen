import { appeler, type Asset, type ApercuLivraison } from "./api"

export type LivraisonImage = ApercuLivraison & {
  nature: "image"; nom: string; image: string; usage: "monde" | "interface"
  ressource: string; sprite_frames: null; dimensions: { largeur: number; hauteur: number }
}
export const livraisonImages = {
  lister: (p: string, s: string) => appeler<{ personnage: string; nom: string; famille: string; usage_conseille: "monde" | "interface"; images: Asset[] }>(`/projects/${encodeURIComponent(p)}/characters/${encodeURIComponent(s)}/delivery-images`),
  prevoir: (p: string, choix: { personnage: string; image: string; usage: "monde" | "interface"; pivot_x?: number; pivot_y?: number }) => appeler<LivraisonImage>(`/projects/${encodeURIComponent(p)}/image-deliveries/preview`, { method: "POST", body: JSON.stringify(choix) }),
}
