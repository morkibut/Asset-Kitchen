// Les doublures des essais d'écran du son : une série, ses tirages, un jeu de
// variantes — la forme exacte que renvoient les routes (`atelier/services/series_son.py`).
import type { JeuVariantes, SerieSon as Serie, TirageSerie } from "./api-series-son"

export const mesures = (o: Partial<{ duree: number; crete_db: number; ecretes: number; lufs: number }> = {}) =>
  ({ duree: 0.82, taux: 44100, canaux: 1, echantillons: 36000, crete_db: -1.2, rms_db: -18, silencieux: false, ecretes: 0, lufs: null, ...o })
export const tirageRendu = (rang: number, o: Partial<{ sature: boolean; crete_db: number; ecretes: number }> = {}): TirageSerie => ({
  rang, travail: `t${rang}`, graine: 100 + rang, etat: "rendu", raison: "", prochaine_action: "ecouter",
  son: { identifiant: `s${rang}`, existe: true, nom: "Épée", revision: 1, famille: "bruitage", pret: true, raison: "", jugement: "a-juger",
    mesures: mesures({ crete_db: o.crete_db ?? -1.2, ecretes: o.ecretes ?? 0 }), sature: !!o.sature, silencieux: false },
})
export const serie = (tirages: TirageSerie[], o: Partial<Serie> = {}): Serie => ({
  identifiant: "serie1", projet: "jeu", cle: "c", nom: "Sword leaves a leather sheath", famille: "bruitage", modele: "ComfyUI:sa3@1",
  nombre: tirages.length, demande: { famille: "bruitage", prompt: "Sword leaves a leather sheath" }, cree_le: 1,
  tirages, compte: {}, etat: "terminee", prochaine_action: "ecouter_et_garder",
  reste: { temps_s: 0, mesures: 3, cout_usd: 0, phrase: "" }, jeux: [], ...o,
})
export const jeu = (rangs: number[], o: Partial<JeuVariantes> = {}): JeuVariantes => ({
  identifiant: "jeu1", projet: "jeu", nom: "Sword leaves a leather sheath", famille: "bruitage", serie: "serie1", cle: null,
  membres: rangs.map((r) => ({ son: `s${r}`, rang: r, ajoute_le: 1, statut: "present", a_livrer: true, signal: r === 2 ? "Ce son sature : il reste dans le jeu, à toi de décider." : "", sature: r === 2,
    nom: "Épée", revision: 2, famille: "bruitage", pret: true, raison: "", mesures: mesures() })),
  sons: rangs.map((r) => `s${r}`), a_livrer: rangs.map((r) => `s${r}`), signalements: [], vide: false, revision: 1, cree_le: 1, ...o,
})

