import type { Personnage, Pose } from "./api"

/** Lecture du plan historique, commune aux fiches et aux ateliers. */
export const posesTenues = (plan: Pose[], personnage: Personnage): Pose[] =>
  plan.filter(pose => !personnage.ecartees.includes(pose.identifiant))
