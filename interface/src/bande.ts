/** Les règles d'une bande, partagées par l'atelier de bande et le montage.
 *
 *  Sorties d'`AtelierDeBande.tsx` le 22 septembre 2026 (revue du 21, `RV14`) :
 *  le montage est entré dans le carnet, et un écran du carnet n'emprunte pas
 *  une logique à un autre écran (`essais/essai_imports.py`). */
import type { Bande, Generation, Personnage, Prise } from "./api"

/** Deux prises désignent-elles **la même image du même clip** ? Une prise sans
 *  clip nommé prend celui de la bande — c'est la règle du serveur, et la
 *  réécrire autrement ferait entrer deux fois la même image au chutier. */
const memeImage = (une: Prise, autre: Prise, clipDeLaBande: string) =>
  une.numero === autre.numero &&
  (une.clip || clipDeLaBande) === (autre.clip || clipDeLaBande)

/** **Mettre des images au chutier** (V3.03.3), sans jamais l'y écrire deux fois.
 *
 *  Le chutier est la réserve de la bande : les images retirées du ruban, et
 *  celles qu'on est allé chercher dans le clip. Une prise y arrive **entière** —
 *  sa recette individuelle comprise —, parce que la reposer trois gestes plus
 *  loin doit la rendre telle qu'elle était : *retirer puis remettre* n'est pas
 *  une façon d'effacer un réglage.
 *
 *  ⚠️ **Elle n'y entre qu'une fois.** La même image mise de côté deux fois
 *  ferait deux vignettes identiques dans une réserve qu'on lit d'un coup d'œil,
 *  et il faudrait choisir laquelle poser. La dernière venue gagne : c'est celle
 *  dont on vient de décider, et elle porte les réglages les plus récents.
 *
 *  Écrite ici et employée aussi par le montage, qui repose un découpage sur une
 *  animation gardée — **deux règles pour le même fait finiraient par ne pas
 *  ranger pareil**. */
/** **L'image de départ d'un clip** (RV6, porte « En générer une variante ») :
 *  la référence « edition » de sa génération — celle qui l'a engendré. `null`
 *  sans elle : le clip est parti sans image jointe, ou sa génération n'est
 *  plus dans la liste reçue (un vieux clip, hors de la fenêtre glissante que
 *  le jeu relit). Une variante propose alors la reprise habituelle plutôt
 *  qu'une image perdue. */
export function imageDeDepartDuClip(clips: readonly Generation[], clip: string): string | null {
  return clips.find((g) => g.identifiant === clip)?.references?.find((r) => r.role === "edition")?.asset ?? null
}

export function auChutier(
  chutier: Prise[],
  emportees: Prise[],
  clipDeLaBande: string,
): Prise[] {
  const rendu = [...chutier]
  for (const prise of emportees) {
    const deja = rendu.findIndex((une) => memeImage(une, prise, clipDeLaBande))
    if (deja >= 0) rendu[deja] = prise
    else rendu.push(prise)
  }
  return rendu
}

/** **Reposer un découpage sur une animation déjà gardée** (V3.03.3).
 *
 *  C'est ce que « Reprendre le montage » écrit au retour : le montage ne connaît
 *  que des **numéros d'image**, l'animation porte des **prises** — d'où elles
 *  viennent, de combien elles sont poussées, et leur recette à elles.
 *
 *  > ### ⚠️ Une recette individuelle voyage avec sa prise
 *  >
 *  > Une image qu'on garde retrouve **sa** prise, poussée et recette comprises :
 *  > passer par le montage pour ajouter une image ne doit pas défaire les
 *  > réglages posés sur les onze autres. Et une image que le nouveau découpage
 *  > laisse tombe **au chutier** au lieu de disparaître — changer d'avis sur une
 *  > image ne doit pas effacer ce qu'on avait réglé dessus.
 *
 *  Une image demandée deux fois — le geste *dupliquer* — reçoit la prise
 *  d'origine une fois et une prise neuve ensuite : c'est la même image, et rien
 *  ne dit que la seconde copie doit hériter d'une correction au pixel posée sur
 *  la première.
 *
 *  > ### ⚠️ Le chutier est cherché lui aussi, et ce qu'on y prend en sort
 *  >
 *  > Une image mise de côté que le montage reprend revenait **neuve** : sans sa
 *  > poussée, sans sa recette — et elle restait au chutier par-dessus le marché,
 *  > si bien que le ruban la jouait pendant que la réserve proposait encore de
 *  > la poser. C'est très exactement ce à quoi le chutier sert, et la reprise
 *  > était le seul chemin qui le contournait. Vu au navigateur le 5 septembre
 *  > 2026, sur l'atelier jetable de la tranche. */
export function remonterLaBande(
  bande: Bande,
  clip: string,
  retenues: number[],
  occurrences?: (string | undefined)[],
): { prises: Prise[]; chutier: Prise[] } {
  const restantes = [...bande.prises]
  const reserve = [...bande.chutier]
  const chercher = (ou: Prise[], numero: number, identifiant?: string) => {
    const la = ou.findIndex(
      (prise) => prise.numero === numero && (prise.clip || bande.clip) === clip && (!identifiant || prise.identifiant === identifiant),
    )
    return la < 0 ? undefined : ou.splice(la, 1)[0]
  }
  const prises = retenues.map(
    (numero, index) =>
      chercher(restantes, numero, occurrences?.[index]) ??
      chercher(reserve, numero, occurrences?.[index]) ?? { numero, clip: "", dx: 0, dy: 0, ...(occurrences?.[index] ? { identifiant: occurrences[index] } : {}) },
  )
  return { prises, chutier: auChutier(reserve, restantes, bande.clip) }
}

// ── Les cases d'un lot d'animation (RV6) ────────────────────────────────────
//
// Sorties d'`AnimerEnLot.tsx` le 22 septembre 2026 (RV6) : `AnimerEnLot`
// disparaît — les onze portes ouvrent maintenant la fenêtre unique — mais
// `AnimationsDuSujet.tsx` s'appuie toujours sur ce que ces deux fonctions
// décident, et un écran du carnet n'emprunte pas de logique à un autre écran
// (`essais/essai_imports.py`).

export type EtatDeCase = "retenue" | "en-route" | "ratee" | "a-juger" | "vide"

export type CaseAAnimer = {
  pose: string
  poseNom: string
  direction: string | null
  directionNom: string | null
  etat: EtatDeCase
}

const enRoute = (g: Generation) =>
  g.statut === "en_attente" || g.statut === "en_cours"

/** **Ratée au contrôle d'arrivée** (RV1) : `echouee`, et `clip.controle` le
 *  dit. Un clip échoué pour une autre raison (fournisseur, réseau) ne porte
 *  pas ce champ, et ne paraît donc pas ici. */
const ratee = (g: Generation) => g.statut === "echouee" && !!g.clip?.controle

/** Les clips de ce sujet **pas encore montés** : en route, ratés, ou arrivés
 *  sans animation taillée dedans. Ce sont eux que la rangée montre en
 *  vignette — une case ratée y reste visible, avec sa raison, au lieu de
 *  disparaître sans bruit. */
export function clipsNonMontes(
  clips: readonly Generation[],
  personnage: Personnage,
): Generation[] {
  const montes = new Set<string>()
  for (const sienne of personnage.cases) {
    const bandes: Bande[] = [
      ...sienne.bandes,
      ...sienne.bandes_ecartees,
      ...sienne.directions.flatMap((d) => [...d.bandes, ...d.bandes_ecartees]),
    ]
    for (const b of bandes) montes.add(b.clip)
  }
  return clips.filter(
    (g) =>
      g.personnage === personnage.identifiant &&
      g.clip &&
      !g.clip.jete &&
      (!g.clip.nature || g.clip.nature === "video") &&
      (enRoute(g) || ratee(g) || (g.statut === "reussie" && !montes.has(g.identifiant))),
  )
}

/** L'état d'une case pour un lot : ce qui décide si elle repart. */
export function etatDeLaCase(
  rangee: { pose: string; direction: string | null; retenue: Bande | null; compte: number },
  nonMontes: readonly Generation[],
): EtatDeCase {
  if (rangee.retenue) return "retenue"
  const siens = nonMontes.filter(
    (g) => g.pose === rangee.pose && (g.direction ?? null) === rangee.direction,
  )
  if (siens.some(enRoute)) return "en-route"
  if (siens.some(ratee)) return "ratee"
  if (rangee.compte > 0 || siens.length > 0) return "a-juger"
  return "vide"
}
