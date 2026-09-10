// Ce qui part, et ce que ça coûte — le seul endroit d'où l'argent s'en va.
//
// La signature d'un appel, la raison qui grise *Générer*, la fenêtre de
// confirmation, le verrou du double clic, et le paiement lui-même. Tout cela
// vivait en clair dans `App.tsx` ; `C4` l'en sort avec la galerie, parce
// qu'`App` devait passer sous trois mille lignes et que ce bloc-ci est le plus
// gros de ceux qui ne parlent d'aucun écran en particulier.
//
// Rien n'y change : mêmes états, même ordre, mêmes appels.

import { useEffect, useMemo } from "react"
import {
  api,
  Refus,
  type Bibliotheque,
  type Envoi,
  type Generation,
  type Modele,
  type Pose,
  type Reinjection,
  type Tri,
  type Univers,
  type Emplacement,
} from "./api"
import { fondre } from "./flux"
import { TRI_VIDE } from "./composants/Envoi"
import type { EnVol } from "./composants/ChampPrompt"

/** Le geste qu'un refus porte, quand il y a un endroit où aller. */
export type Geste = "Réglages" | "Réessayer"

/** **La case que le prochain appel remplira** (US-120), par identifiants. */
export type CibleDeLAppel = {
  personnage: string
  poses: string[]
  piece?: string | null
  direction?: string | null
  directions?: string[] | null
}

// **Le temps qu'on laisse à la frappe de se poser** (M3). Corriger une ligne de
// la fenêtre de confirmation écrit dans le tri, et le tri commande la demande
// qui dit ce qui part : sans repos, un mot de dix lettres partait en dix
// allers-retours enchaînés. Ce n'est pas un nouveau réglage — 200 ms est déjà ce
// que le produit appelle *« la main s'est arrêtée »*.
//
// **Il ne s'applique jamais à l'ouverture** : on ouvre la fenêtre pour voir ce
// qui part, et la faire attendre un cinquième de seconde pour rien serait payer
// la réparation avec la chose qu'elle répare.
const REPOS_FRAPPE = 200

type Pose_<T> = React.Dispatch<React.SetStateAction<T>>

export type CeQueLePaiementLit = {
  bibliotheque: Bibliotheque
  cases: number
  chantier: Generation[]
  setChantier: Pose_<Generation[]>
  cible: CibleDeLAppel | null
  setCible: Pose_<CibleDeLAppel | null>
  directionsCible: string[]
  ecarteesGeneration: string[] | null
  setEcarteesGeneration: Pose_<string[] | null>
  echelle: string
  echouer: (erreur: unknown, defaut: string) => void
  enPlanche: boolean
  setEnvoi: Pose_<Envoi | null>
  envoiOuvert: boolean
  setEnvoiOuvert: (ouvert: boolean) => void
  setEnPaiement: Pose_<boolean>
  paiementEnCours: { current: boolean }
  intention: { current: { signature: string; identifiant: string } | null }
  liaison: boolean
  modeles: Modele[]
  panne: string | null
  modele: Modele | null
  options: Record<string, string>
  ouverture: { current: boolean }
  posesCible: Pose[]
  prompt: string
  promptNegatif: string
  proportions: string
  reinjections: Reinjection[]
  repris: boolean
  serieSautee: string | null
  setChoixDeReference: (ouvert: boolean) => void
  setEchecDuPaiement: Pose_<string | null>
  tri: Tri
  setTri: Pose_<Tri>
  triDe: string | null
  setTriDe: Pose_<string | null>
  univers: Univers
  variations: number
}

export function usePaiement({
  bibliotheque,
  cases,
  chantier,
  setChantier,
  cible,
  setCible,
  directionsCible,
  ecarteesGeneration,
  setEcarteesGeneration,
  echelle,
  echouer,
  enPlanche,
  setEnvoi,
  envoiOuvert,
  setEnvoiOuvert,
  setEnPaiement,
  paiementEnCours,
  intention,
  liaison,
  modeles,
  panne,
  modele,
  options,
  ouverture,
  posesCible,
  prompt,
  promptNegatif,
  proportions,
  reinjections,
  repris,
  serieSautee,
  setChoixDeReference,
  setEchecDuPaiement,
  tri,
  setTri,
  triDe,
  setTriDe,
  univers,
  variations,
}: CeQueLePaiementLit) {
  // **Ce qui fait qu'un appel est le même, et rien de plus** (M5).
  //
  // Ce que l'auteur **vise et écrit** : le texte, ce qu'il interdit, le modèle,
  // l'échelle, le nombre de variations, le jeu, et la case du monde qu'il
  // remplit. Changer l'un de ceux-là, c'est demander autre chose — et les
  // corrections de la demande d'avant n'ont plus de sens.
  //
  // **Ce qui n'y entre pas est aussi une décision.** Les images jointes n'y sont
  // pas : en ajouter une, ou en décocher une, est une correction *de cet
  // appel-ci* et non un appel neuf — c'est très exactement le geste que la
  // tranche rend possible, et l'y mettre viderait le tri au moment de s'en
  // servir. La bible du jeu n'y est pas non plus : elle change ce qui part, elle
  // ne change pas ce qu'on demande.
  //
  // Le séparateur est un caractère qu'aucun de ces champs ne peut porter : sans
  // lui, deux repères mis bout à bout feraient deux appels différents lus comme
  // un seul.
  const signatureDeLAppel = [
    prompt,
    promptNegatif,
    modele?.identifiant ?? "",
    echelle,
    String(variations),
    bibliotheque.courant ?? "",
    String(repris),
    cible?.personnage ?? "",
    cible?.piece ?? "",
    cible?.direction ?? "",
    posesCible.map((p) => p.identifiant).join("·"),
    directionsCible.join("·"),
  ].join("␟")


  // ── La raison qui rend générer inactif ────────────────────────────────────

  // Le refus porte **son geste** : chaque raison sait où elle mène, quand il y
  // a un endroit où aller. « Le grisé porte sa raison — jamais une infobulle. »
  const refus = useMemo<{ texte: string; geste?: Geste } | null>(() => {
    if (panne) return { texte: panne }
    if (!liaison) return { texte: "l'atelier ne répond pas" }
    if (modeles.length === 0)
      return { texte: "le catalogue n'a jamais été reçu", geste: "Réessayer" }
    if (!modele) return { texte: "aucun modèle choisi" }
    // **Ce qui manque appartient au modèle choisi, plus au produit** (F1).
    // Jusqu'à la V2.2, l'absence de clé éteignait le bouton quel que soit le
    // modèle : il n'y avait qu'un fournisseur, et c'était juste. Un fournisseur
    // ne demande désormais ni compte ni clé — refuser au nom de la clé d'un
    // autre serait un refus faux, et un refus faux est ce qui fait douter de
    // tous les autres. La phrase du fournisseur arrive donc dans `refus`, écrite
    // par le serveur, comme toutes les raisons de grisé depuis T1.
    if (modele.refus)
      return {
        texte: modele.refus.startsWith("aucune clé")
          ? modele.refus
          : `${modele.nom} ${modele.refus}`,
        geste: modele.refus.startsWith("aucune clé") ? "Réglages" : undefined,
      }
    if (!prompt.trim()) return { texte: "aucun prompt" }
    // Hors ligne, générer reste **actif** : « l'échec ne survient qu'au moment
    // où on génère, jamais à l'ouverture » (US-95).
    return null
  }, [panne, liaison, modeles, modele, prompt])

  // ── Générer ───────────────────────────────────────────────────────────────

  /** La série qu'on est en train de refaire — **une chose et une pose**.
   *
   *  C'est elle que la case « ne plus me le montrer » retient. Dès qu'on change
   *  de l'une ou de l'autre, l'écran revient : relire dix fois la même chose est
   *  une punition, relire la première d'une série ne l'est pas.
   *
   *  **`null` quand aucune case n'est visée, et c'est un bug payé en argent
   *  réel** (signalé le 31 août 2026). Sans chose du jeu, les trois morceaux
   *  sont vides : *toutes* les générations libres partageaient donc la même clé,
   *  dans tous les jeux. Cocher la case une seule fois éteignait l'écran de
   *  confirmation pour chacune d'elles jusqu'au rechargement de l'onglet — et le
   *  clic suivant sur Générer partait droit à la dépense, sans rien montrer.
   *  C'était très exactement la case « pour toujours » que le produit s'interdit,
   *  atteinte par accident. Une série est une *répétition* ; un texte écrit à la
   *  main n'en est pas une, donc il n'y a rien à sauter. */
  const serie = cible
    ? [cible.personnage, cible.poses.join("·"), cible.piece ?? ""].join("|")
    : null

  /** Le bouton de la barre qui paie — **il n'envoie plus, il fait relire** (E14).
   *
   *  L'écran de confirmation s'intercale entre le bouton et la dépense. Il se
   *  saute pour la série en cours, et seulement pour elle : une case définitive
   *  éteindrait le seul écran qui montre ce qui part, et on la cocherait le
   *  premier jour, quand on ne sait pas encore qu'on en aura besoin. */
  /** Ce qui est **payé et pas encore arrivé**, tous lots confondus.
   *
   *  Le chantier tenait déjà sa place dans la grille de la galerie, avant même
   *  que l'image existe. Mais on paie aussi depuis le codex et depuis l'établi,
   *  et là rien ne bougeait : l'auteur dépensait, l'écran restait immobile, et
   *  il recliquait — ce qui repayait. Deux endroits le disent maintenant, et ils
   *  se partagent le travail : le **bloc en route** prend la place du bouton là
   *  où l'on vient de payer, la **pastille de l'onglet Galerie** suit d'un lieu
   *  à l'autre.
   *
   *  Les échecs n'y sont pas : ils ont leur propre locataire dans la fente, le
   *  revers, et deux tenants à la fois est ce que la fente s'interdit. */

  const enRoute = chantier.flatMap((generation) =>
    generation.emplacements.filter(
      (e) => e.statut === "en_attente" || e.statut === "en_cours",
    ),
  )

  /** Le plus ancien départ encore en route — `null` tant que tout attend en
   *  file chez le fournisseur.
   *
   *  **C'est lui que la jauge mesure, et c'est le bon.** Les emplacements d'un
   *  lot partent *ensemble* — `atelier/services/generation.py`, « un
   *  emplacement, un appel, tous en parallèle » —, donc ils partagent leur
   *  attente et le plus ancien est celui dont on attend la fin. Quand deux lots
   *  se chevauchent, la barre suit le premier ; il arrive, et elle passe au
   *  suivant sans jamais reculer. */
  const plusAncien = enRoute.reduce<Emplacement | null>(
    (ancien, emplacement) =>
      emplacement.demarre_le !== null &&
      (ancien === null ||
        ancien.demarre_le === null ||
        emplacement.demarre_le < ancien.demarre_le)
        ? emplacement
        : ancien,
    null,
  )

  const enVol: EnVol | null =
    enRoute.length === 0
      ? null
      : {
          images: enRoute.length,
          demarreLe: plusAncien?.demarre_le ?? null,
          attendue: plusAncien?.duree_attendue_s ?? 0,
        }

  /** **Ce qui part, réduit à une chaîne** (U1). Deux appels qui rendraient la
   *  même chaîne sont la même intention, et se partagent donc un identifiant ;
   *  dès qu'un caractère change, l'intention est neuve et l'identifiant l'est
   *  aussi. C'est la liste exacte du corps envoyé par `payer` — un champ oublié
   *  ici ferait passer deux appels différents pour un seul, et le serveur
   *  refuserait le second sans rien dire.
   *
   *  **Ce n'est pas un `useMemo`** : elle se lit dans `payer`, une fois, au
   *  moment du clic. La mémoriser à chaque rendu coûterait un `JSON.stringify`
   *  par frappe dans le champ de prompt, pour une valeur qu'on ne regarde qu'en
   *  payant. */
  const signatureEnvoi = () =>
    JSON.stringify([
      cible?.personnage ?? null,
      !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
      cases ? null : (cible?.direction ?? null),
      enPlanche ? directionsCible : null,
      cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
      cible?.piece ?? null,
      ecarteesGeneration,
      modele?.identifiant ?? null,
      prompt.trim(),
      promptNegatif.trim(),
      proportions,
      cases ? 1 : variations,
      options,
      reinjections,
      echelle,
      repris,
      tri,
    ])

  /** L'identifiant de l'intention courante — le même tant que rien de ce qui
   *  part n'a changé, et **c'est lui qui empêche le second clic de payer**. */
  const identifiantDeLIntention = () => {
    const signature = signatureEnvoi()
    if (intention.current?.signature !== signature)
      intention.current = {
        signature,
        identifiant: crypto.randomUUID().replace(/-/g, ""),
      }
    return intention.current.identifiant
  }

  /** Refermer la fenêtre de confirmation, **et ce qui s'est posé par-dessus**
   *  (M5).
   *
   *  Le choix d'une référence est un état de cette fenêtre-là, pas du produit :
   *  le laisser derrière rouvrirait la grille à la prochaine ouverture, devant
   *  un appel qui n'a rien demandé. Les quatre façons de sortir passent donc
   *  ici — le bouton, Échap, l'onglet, et reprendre le texte à la main. */
  const fermerCeQuiPart = () => {
    setEnvoiOuvert(false)
    setChoixDeReference(false)
  }

  const generer = () => {
    if (refus || !modele) return
    // L'échec d'avant appartenait à l'appel d'avant.
    setEchecDuPaiement(null)
    // **Pas de série, pas de saut.** `serie` vaut `null` quand aucune case n'est
    // visée, et `serieSautee` vaut `null` quand rien n'a été sauté : les
    // comparer sans ce garde-fou rendait vrai « rien saute rien », et l'écran
    // disparaissait pour toutes les générations libres.
    if (serie !== null && serieSautee === serie) {
      void payer()
      return
    }
    // **Le tri repart de rien dès que l'appel change** (M5, révisant E14).
    //
    // La règle disait *à chaque ouverture*, et elle visait un vrai danger : un
    // réglage qui traînerait d'un appel au suivant. Elle reste. Ce qui change
    // est **ce qu'elle appelle un autre appel** — sortir chercher une image et
    // revenir n'en est pas un. Ce qu'on a éteint pour *cet* appel-ci vaut
    // encore pour lui ; ce qu'on avait éteint pour un autre ne le suit pas.
    if (triDe !== signatureDeLAppel) {
      setTri(TRI_VIDE)
      setTriDe(signatureDeLAppel)
    }
    setEnvoiOuvert(true)
  }

  const payer = async () => {
    if (refus || !modele) return
    // **Le verrou qui arrête le second clic** (U1). Lu et écrit dans le même
    // tour de boucle, avant tout `await` : c'est la seule façon d'arrêter deux
    // clics partis dans la même image de rendu, que le drapeau d'état
    // n'attraperait pas — il n'est vrai qu'au rendu suivant.
    if (paiementEnCours.current) return
    paiementEnCours.current = true
    setEnPaiement(true)
    setEchecDuPaiement(null)
    // **Un identifiant par intention** : le même pour deux clics sur le même
    // envoi, neuf dès que ce qui part change. C'est lui qui empêche une double
    // soumission de facturer deux fois — le serveur rend *déjà soumise* et ne
    // facture rien quand il le revoit.
    const identifiant = identifiantDeLIntention()
    const retenues = Object.fromEntries(
      Object.entries(options).filter(([nom]) => nom in modele.options),
    )
    try {
      const generation = await api.generer({
        // **La case visée, quand la matrice a armé** (US-120). L'image qui
        // reviendra y tombera d'elle-même : personne n'a à la ranger, et une
        // relance de cet appel visera toujours la même case.
        personnage: cible?.personnage ?? null,
        // **Une case ou N, et la même route** (US-128). Il n'existe qu'un seul
        // endroit d'où l'on paie dans tout le produit : une seconde route pour
        // les lots en aurait fait deux, et l'invariant de C1 serait tombé le
        // jour où elle serait apparue. C'est le compte qui décide, pas l'écran.
        // **Une planche de pose garde sa pose** : c'est elle qui porte
        // l'attitude commune aux N cases, et les directions qui les
        // distinguent partent à côté.
        pose:
          !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
        // **Et sous quel angle** (E10). L'image qui reviendra tombe dans la
        // case *et* dans la direction, sans que personne ait à l'y ranger. Vide
        // pour un lot, qui vise N cases : c'est `poses` qui les nomme.
        direction: cases ? null : (cible?.direction ?? null),
        // **Les angles d'une planche de pose** (E13). Chaque case sait déjà
        // dans quelle direction son image se rangera — le rangement cesse
        // d'être un geste séparé qu'on peut oublier, puisque c'est une
        // condition de l'appel.
        directions: enPlanche ? directionsCible : null,
        poses:
          cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
        // **La pièce que cet appel pose** (C3, US-140). Elle fait de la planche
        // une planche d'*équipement* : elle part pleine des corps que `poses`
        // désigne, et ce qui revient est comparé case par case à ce qui est
        // parti. Sans elle, la même route crée des corps — c'est C2.
        piece: cible?.piece ?? null,
        // **Ce que cette génération-ci écarte.** `null` laisse parler les deux
        // portées durables — c'est ce que reçoit un agent, qui n'a pas de
        // panneau devant lui.
        references_ecartees: ecarteesGeneration,
        modele: modele.identifiant,
        prompt: prompt.trim(),
        prompt_negatif: promptNegatif.trim(),
        proportions,
        // **Un lot part en un seul appel, et l'écran envoie ce qu'il affiche.**
        // Le segment est éteint quand un lot est armé, mais la valeur d'avant
        // vit encore dans l'état : sans cette ligne, un « 4 » choisi puis un lot
        // coché enverraient 4 pendant que l'écran montre 1 — et le refus
        // arriverait après le clic qui paie, ce que le grisé existe pour éviter.
        variations: cases ? 1 : variations,
        options: retenues,
        identifiant,
        references: reinjections,
        // Le sujet : c'est lui qui décide des artworks qui partent, du modèle
        // par défaut et de la part de case que l'image occupera.
        echelle,
        // **Le texte part mot pour mot** (US-160). Il ne touche qu'au texte :
        // l'échelle ci-dessus décide toujours des artworks, du modèle par
        // défaut et de l'occupation, et le gabarit d'un lot part toujours.
        repris,
        // **Ce que l'écran de confirmation a trié** (E14). Il ne remonte nulle
        // part : le prochain appel repart des réglages, comme si de rien
        // n'était.
        tri,
        // **La palette en image**, quand la case est cochée : une bande de
        // pastilles qui occupe une des places de référence du modèle.
        palette: tri.allumes.includes("options.palette"),
      })
      // Le flux l'a peut-être déjà annoncée — on fond, on n'empile pas.
      setChantier((liste) => fondre(liste, generation))
      // L'avis de cette génération-là est parti avec elle : le suivant se
      // reprend aux portées durables, comme au premier prompt de la séance.
      setEcarteesGeneration(null)
      // L'écran de confirmation se referme avec l'appel qu'il a relu, et le tri
      // part avec lui. **Ici il part pour de bon** (M5) : l'appel est parti,
      // donc il n'y a plus d'appel dont ces corrections-là seraient les
      // corrections. C'est la différence avec un aller-retour.
      fermerCeQuiPart()
      setTri(TRI_VIDE)
      setTriDe(null)
      // **La cible se désarme dès que l'appel est parti.** C'est une intention
      // qui vaut pour *cette* génération : la garder enverrait l'image suivante
      // — un tonneau, un décor — dans la case d'un personnage, sans que rien
      // ne l'ait demandé. On réarme d'un clic depuis la matrice.
      setCible(null)
      // **L'intention est consommée** (U1). Le même identifiant réemployé après
      // un appel parti ferait rendre *déjà soumise* par le serveur : deux images
      // volontairement identiques, demandées deux fois de suite, n'en feraient
      // qu'une, et rien ne le dirait.
      intention.current = null
    } catch (erreur) {
      // **L'identifiant reste**, et c'est voulu : rien n'a été enregistré côté
      // serveur, donc réessayer est la *même* intention. Le bouton redevient
      // cliquable — c'est le seul cas où il le redevient.
      setEchecDuPaiement(
        erreur instanceof Refus ? erreur.message : "génération refusée",
      )
    } finally {
      paiementEnCours.current = false
      setEnPaiement(false)
    }
  }

  // ── Ce que l'écran de confirmation montre ─────────────────────────────────
  //
  // **Un aller-retour, et il porte le texte et le prix ensemble.** Un écran qui
  // demanderait son texte à une route et son prix à une autre finirait par
  // afficher un texte d'avant à côté d'un prix d'après. Rien n'est facturé, rien
  // n'est enregistré, et l'appel ne sort pas de la machine.
  //
  // **Et la demande attend que la frappe se pose** (M3). Corriger une ligne
  // écrit dans le tri, qui est une dépendance d'ici : un mot de dix lettres
  // partait en dix allers-retours enchaînés. Le repos vaut pour tout ce qui
  // change pendant que la fenêtre est ouverte, et pour rien à l'ouverture — la
  // première demande part sur-le-champ.
  useEffect(() => {
    if (!envoiOuvert || !modele) {
      // Fenêtre fermée : la prochaine ouverture repart sans attendre.
      ouverture.current = true
      return
    }
    let vivant = true
    const attente = ouverture.current ? 0 : REPOS_FRAPPE
    ouverture.current = false
    const minuterie = window.setTimeout(() => {
      void api
        .envoi({
          prompt: prompt.trim(),
          modele: modele.identifiant,
          projet: bibliotheque.courant,
          echelle,
          personnage: cible?.personnage ?? null,
          pose: !cases || enPlanche ? (posesCible[0]?.identifiant ?? null) : null,
          direction: cases ? null : (cible?.direction ?? null),
          directions: enPlanche ? directionsCible : null,
          poses:
            cases && !enPlanche ? posesCible.map((p) => p.identifiant) : null,
          piece: cible?.piece ?? null,
          references: reinjections,
          references_ecartees: ecarteesGeneration,
          variations: cases ? 1 : variations,
          repris,
          tri,
          // **Ce que l'auteur interdit de sa main** (D3) : le fond du jeu s'y
          // ajoute, et sans lui l'écran montrerait l'interdiction du produit
          // seule là où l'appel en enverra deux.
          prompt_negatif: promptNegatif.trim(),
        })
        .then((recu) => {
          if (!vivant) return
          setEnvoi(recu)
        })
        .catch((erreur) => {
          if (!vivant) return
          setEnvoi(null)
          echouer(erreur, "l'atelier ne dit pas ce qui partirait")
        })
    }, attente)
    return () => {
      vivant = false
      window.clearTimeout(minuterie)
    }
    // Les poses et les directions **jointes** et non les tableaux : ils se
    // refabriquent à chaque rendu, et deux appels de même taille sur des cases
    // différentes n'enverraient pas les mêmes consignes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    envoiOuvert,
    modele?.identifiant,
    prompt,
    repris,
    echelle,
    variations,
    bibliotheque.courant,
    cible?.personnage,
    cible?.piece,
    cible?.direction,
    cible?.poses.join("·"),
    directionsCible.join("·"),
    enPlanche,
    cases,
    reinjections,
    ecarteesGeneration,
    tri,
    promptNegatif,
    univers,
  ])

  return {
    enVol,
    fermerCeQuiPart,
    generer,
    payer,
    refus,
    serie,
    signatureDeLAppel,
  }
}
