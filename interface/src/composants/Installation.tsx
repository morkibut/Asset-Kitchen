/**
 * L'installation de la machine, en quatre étapes — B15.
 *
 * `docs/archive/pistes-2026-09-04/carnet/Installation.dc.html`. Ce qu'on branche une
 * fois sur cette machine et qui n'appartient à aucun jeu : le compte et la clé,
 * ComfyUI, le dossier de travail. **Aucune des trois n'est obligatoire** —
 * l'atelier s'ouvre sans rien de tout ça et fabrique des images gratuitement,
 * et c'est la première chose que l'écran écrit.
 *
 * ⚠️ **Un seul écran, deux entrées, comme `ReglesDuJeu.tsx` en `B14`.**
 * `mode="premiere"` le déroule dans l'ordre au tout premier lancement ;
 * `mode="reglages"` l'ouvre sur le sommaire des quatre, et l'on va droit à
 * celle qu'on veut reprendre. **Mêmes écrans, mêmes écritures** — un essai
 * compare les deux entrées sur la route, la méthode et le corps du message.
 *
 * ⚠️ **Aucune valeur de secret ne traverse ce fichier.** Il n'a pas un seul
 * champ de lecture de clé : il en envoie une par `api.deposerSecret`, et ne
 * relit jamais que `EtatSecret`, qui ne porte que six caractères d'aperçu. Le
 * champ de saisie est un `type="password"`, et il se vide dès que la valeur est
 * partie.
 *
 * **Trois choses que cet écran ne fait pas, et c'est écrit plutôt que caché** :
 *
 * - **il ne déplace rien.** Choisir un dossier de travail écrit une adresse ;
 *   l'atelier la lit **au démarrage suivant**, et ce qui est déjà rangé reste
 *   exactement où il est. L'écran montre les deux chemins côte à côte pour
 *   qu'une copie à la main soit faisable sans réfléchir ;
 * - **il ne crée rien tout seul.** Un dossier qui n'existe pas est refusé avec
 *   sa raison, et *Créer ce dossier* est un bouton à part. Sur Windows un
 *   chemin se tape à la main, et une faute de frappe sèmerait des dossiers
 *   vides ;
 * - **il n'efface rien.** Le bouton *Vider les rendus* de la planche **n'est
 *   pas construit** : `B15` mesure le disque, poste par poste, et dit ce qu'un
 *   nettoyage libérerait. Une suppression de masse mérite sa tranche et ses
 *   essais (`docs/tranches/V4.md` § B15).
 *
 * **Ce que la planche dessine et qui n'a aucune route derrière** — non
 * construit, et nommé, comme `B10` l'a fait pour « Recadrer » : le bouton
 * *Parcourir…* (aucun navigateur ne donne le chemin d'un dossier à une page
 * web ; on tape le chemin, et l'écran le vérifie avant de l'accepter),
 * *Ouvrir le dossier de travail* (le serveur ne lance pas de programme sur la
 * machine de quelqu'un), et la ligne *Silhouettes* de la mesure du disque —
 * le détourage ne pose aucun masque sur le disque.
 *
 * **Aucun compte de modèles n'est écrit en dur.** La planche écrit « 49 » sept
 * fois ; la photo du catalogue en portait 51 le 9 septembre 2026, et
 * `docs/PIEGES.md` dit que ce nombre bouge d'un jour à l'autre. L'écran compte
 * ce que le catalogue lui sert.
 *
 * **Ce que cet écran ne reprend pas** : les garde-fous de l'agent et la
 * bibliothèque de mouvements, qui vivent depuis `RP2` dans l'onglet *Agent
 * MCP* de `Reglages.tsx` — ce sont des réglages d'un jeu, pas de la machine.
 * Le lien nommé du pied y mène ; le retirer rendrait l'agent injoignable,
 * ce qui est exactement la branche morte que `lieux.ts` raconte dans son
 * en-tête.
 *
 * **Et cet écran garde le sien de lieu**, alors que `RP2` a rangé tous les
 * autres réglages sous quatre onglets : c'est le seul qui ne parle d'aucun
 * jeu, et il se déroule aussi tout seul au premier lancement. L'onglet
 * *Moteurs & workflows* y mène, et l'on en revient là.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  api,
  type DossierDeTravail,
  type EtatDuMoteur,
  type EtatInstallation,
  type EtatSecret,
  type Modele,
  type Tiroir,
  type VerificationDuFournisseur,
} from "../api"

// ── Les quatre étapes ────────────────────────────────────────────────────────

export type Etape = "tour" | "images" | "animations" | "dossier"

export type Mode = "premiere" | "reglages"

/** L'ordre est celui de la planche, et il est aussi celui de l'utilité : on
 *  fabrique des images bien avant d'animer, et l'on ne déplace son dossier de
 *  travail qu'une fois — au début, quand il est vide. */
const ETAPES: readonly {
  clef: Etape
  titre: string
  question: string
  /** Et comment le bouton du bas nomme cette étape-là quand il y va. « Passer
   *  à les images » ne s'écrit pas, alors la phrase se pose à côté du titre,
   *  une fois. Le retour, lui, n'a plus ce problème : un retour dit où l'on
   *  va, jamais d'où l'on vient, et « ‹ {titre} » ne conjugue rien. */
  suite: string
}[] = [
  {
    clef: "tour",
    titre: "Ce qui va être demandé",
    question: "Trois choses à brancher — et aucune n'est obligatoire",
    suite: "à ce qui va être demandé",
  },
  {
    clef: "images",
    titre: "Les images",
    question: "Avec quoi fabrique-t-on les images ?",
    suite: "aux images",
  },
  {
    clef: "animations",
    titre: "Les animations",
    question: "Animer sur cette machine ?",
    suite: "aux animations",
  },
  {
    clef: "dossier",
    titre: "Où tout se range",
    question: "Un seul dossier, pour tout",
    suite: "au dossier de travail",
  },
]

/** Ce que la planche annonce sous chaque titre, dans son sommaire de gauche. */
const SOUS_TITRES: Record<Etape, string> = {
  tour: "deux minutes, et rien d'obligé",
  images: "un compte, ou rien du tout",
  animations: "cette machine, ou un fournisseur",
  dossier: "un dossier sur le disque",
}

// ── Les pièces ───────────────────────────────────────────────────────────────

function Intitule({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

/** Une phrase qui explique une conséquence — jamais un ordre. Même pièce que
 *  dans `ReglesDuJeu.tsx`, et volontairement la même : deux parcours qui se
 *  ressemblent doivent se ressembler jusque dans leurs encadrés. */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-8 border border-trait bg-papier-cote p-[14px] text-[12px] leading-[1.5] text-encre-2">
      {children}
    </p>
  )
}

function Alerte({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-8 border border-trait-attention bg-fond-attention p-[14px] text-[12px] leading-[1.5] text-encre-attention"
    >
      {children}
    </p>
  )
}

/** Ce qui a été refusé, dit là où on l'a demandé.
 *
 *  **Sur place et pas dans un bandeau global** : cet écran fait six appels
 *  différents, et un refus posé en haut de la page ne dirait pas lequel a
 *  échoué. `Refus` d'`api.ts` est une classe d'erreur, pas une pièce — la
 *  phrase qu'elle porte arrive ici par `erreur.message`. */
function Souci({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p
      role="alert"
      className="rounded-8 border border-trait-echec bg-fond-echec p-[14px] text-[12px] leading-[1.5] text-echec"
    >
      {texte}
    </p>
  )
}

/** Un bouton ordinaire. **Aucun n'est rouille** : la règle de `D0` n'en laisse
 *  qu'un par écran, et c'est celui du pied qui mène au bout. */
function Bouton({
  enfants,
  onClick,
  inactif = false,
  marque,
}: {
  enfants: string
  onClick: () => void
  inactif?: boolean
  marque?: string
}) {
  return (
    <button
      type="button"
      disabled={inactif}
      onClick={onClick}
      {...(marque ? { [marque]: true } : {})}
      className="h-[34px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:opacity-60"
    >
      {enfants}
    </button>
  )
}

/** Un geste numéroté du parcours — les quatre d'OpenRouter, les trois de
 *  ComfyUI. Le rang est calculé par la liste, jamais tapé : `tests/test_g1.py`
 *  refuse un numéro d'étape écrit à la main, et il a raison. */
function Geste({
  rang,
  titre,
  children,
}: {
  rang: number
  titre: string
  children: ReactNode
}) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] gap-[14px] border-b border-trait py-[14px]">
      <span className="mesure text-[11px] text-encre-4">{rang}</span>
      <div className="flex flex-col gap-[4px]">
        <span className="text-[13px] font-medium text-encre">{titre}</span>
        <span className="text-[12px] leading-[1.5] text-encre-3">{children}</span>
      </div>
    </li>
  )
}

/** Un chemin de disque, en chasse fixe et jamais tronqué à l'œil sans le dire. */
function Chemin({ children, marque }: { children: string; marque?: string }) {
  return (
    <span
      {...(marque ? { [marque]: true } : {})}
      title={children}
      className="mesure block truncate rounded-7 border border-trait bg-papier-cote px-[14px] py-[4px] text-[12px] text-encre-2"
    >
      {children}
    </span>
  )
}

/** Les octets, dans l'unité qui se lit. Le produit dit déjà les dollars par
 *  `dollars()` ; il ne disait les mégaoctets nulle part. */
export function mesureDuDisque(mo: number): string {
  if (mo >= 1024) return `${(mo / 1024).toFixed(1).replace(".", ",")} Go`
  if (mo < 0.1) return "moins de 0,1 Mo"
  return `${mo.toFixed(1).replace(".", ",")} Mo`
}

/** Un nombre de gigaoctets déjà arrondi par le serveur, **à la française**.
 *
 *  Le serveur met la virgule dans ses *phrases* (`maison.py`, `_virgule`) mais
 *  rend ses *nombres* nus, avec le point du JSON. Sans ce passage, le même
 *  écran affichait « il manque 26,5 Go » et, deux lignes plus bas, « 8.7 Go » —
 *  vu au navigateur le 9 septembre 2026, et invisible aux essais d'écran, qui
 *  attendaient la chaîne telle qu'elle sortait. */
export function gigas(go: number): string {
  return `${go}`.replace(".", ",")
}

// ── L'étape « Ce qui va être demandé » ───────────────────────────────────────

function LeTour({ etat, tiroirs }: { etat: EtatInstallation | null; tiroirs: Tiroir[] }) {
  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        L'atelier fabrique les images et les animations d'un jeu. Pour ça il lui
        faut un compte quelque part, ou une carte graphique, ou rien du tout. Ce
        tour prend deux minutes, et se refait quand on veut.
      </p>

      <Note>
        L'atelier s'ouvre sans rien de tout ça et fabrique des images
        gratuitement. Chaque étape se refait plus tard, par L'installation, en
        bas du carnet.
      </Note>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Ce que ça coûte</Intitule>
        <dl className="flex flex-col">
          {[
            ["Ce guide", "rien"],
            ["Créer un compte chez un fournisseur", "rien"],
            ["Installer ComfyUI", "rien"],
            ["Une image, ensuite", "ce que le modèle facture, écrit sur le bouton"],
            ["Une seconde d'animation", "rien sur cette machine, sinon au clip"],
          ].map(([quoi, combien]) => (
            <div
              key={quoi}
              className="flex items-baseline justify-between gap-[14px] border-b border-trait py-[8px]"
            >
              <dt className="text-[12.5px] text-encre-2">{quoi}</dt>
              <dd className="text-[12.5px] text-encre-3">{combien}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11.5px] leading-[1.45] text-encre-4">
          Rien n'est prélevé pendant ce tour. La première dépense arrive quand on
          demande la première image, et son prix est écrit sur le bouton avant
          qu'on appuie.
        </p>
      </section>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Ce qui répond, pour l'instant</Intitule>
        <dl className="flex flex-col">
          {tiroirs.map((tiroir) => (
            <div
              key={tiroir.fournisseur}
              className="flex items-baseline justify-between gap-[14px] border-b border-trait py-[8px]"
            >
              <dt className="text-[12.5px] text-encre-2">{tiroir.fournisseur}</dt>
              <dd
                className={[
                  "text-[12.5px]",
                  tiroir.pret ? "text-encre-ok" : "text-encre-4",
                ].join(" ")}
              >
                {tiroir.secrets.length === 0
                  ? "déjà là — il ne demande rien"
                  : tiroir.pret
                    ? "la clé est posée"
                    : tiroir.manque}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-[14px] border-b border-trait py-[8px]">
            <dt className="text-[12.5px] text-encre-2">Le dossier de travail</dt>
            <dd className="text-[12.5px] text-encre-3">
              {etat ? etat.dossier : "…"}
            </dd>
          </div>
        </dl>
      </section>

      <Note>
        Ce guide ne parle pas de votre jeu. Le nom du jeu, son allure, son monde :
        c'est l'autre parcours, Commencer un jeu, qui vient juste après. Ici on ne
        branche que la machine, et on n'y revient presque jamais.
      </Note>
    </div>
  )
}

// ── L'étape « Les images » ───────────────────────────────────────────────────

/** Les quatre gestes du compte payant. Ils sont écrits ici plutôt que servis
 *  par le serveur : ce sont des instructions pour un humain, pas une donnée du
 *  produit — et `Secret.ou` porte déjà, côté serveur, la seule chose qui puisse
 *  changer : l'adresse où l'on prend la clé. */
const GESTES_DU_COMPTE: readonly { titre: string; quoi: string }[] = [
  {
    titre: "Créer un compte",
    quoi: "Une adresse e-mail suffit ; aucune carte n'est demandée à l'inscription.",
  },
  {
    titre: "Mettre un peu d'argent dessus",
    quoi: "Le compte se recharge à la main, du montant qu'on veut. Rien n'est prélevé tout seul, et il n'y a pas d'abonnement.",
  },
  {
    titre: "Créer une clé",
    quoi: "On lui donne un nom, puis on la copie : elle ne se réaffiche jamais après.",
  },
  {
    titre: "La coller ici",
    quoi: "Vérifier l'essaie tout de suite et affiche ce qu'elle ouvre.",
  },
]

function LesImages({
  tiroirs,
  etat,
  onTiroirs,
}: {
  tiroirs: Tiroir[]
  etat: EtatInstallation | null
  onTiroirs: (tiroirs: Tiroir[]) => void
}) {
  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Les fournisseurs branchés d'avance sont ci-dessous. Le gratuit répond
        déjà ; le payant fait de bien meilleures images et demande un compte.
      </p>

      {tiroirs.map((tiroir) => (
        <UnFournisseur key={tiroir.fournisseur} tiroir={tiroir} onTiroirs={onTiroirs} />
      ))}

      <section className="flex flex-col gap-[8px]">
        <Intitule>Où la clé est gardée</Intitule>
        {etat && <Chemin marque="data-fichier-des-cles">{etat.fichier_env}</Chemin>}
        <p className="text-[12px] leading-[1.5] text-encre-3">
          Dans un fichier à côté de l'application, sur cette machine. Elle n'est
          envoyée qu'à son fournisseur, et l'écran ne la réaffiche jamais en
          entier : six caractères, pour la reconnaître. Une clé vaut pour tous les
          jeux de cette machine — c'est pour ça qu'elle n'est pas demandée quand
          on crée un jeu.
        </p>
        <p className="text-[12px] leading-[1.5] text-encre-3">
          Ce fichier reste où il est, même si le dossier de travail change
          d'endroit : une clé qui suivrait un réglage disparaîtrait au premier
          changement d'adresse.
        </p>
      </section>
    </div>
  )
}

function UnFournisseur({
  tiroir,
  onTiroirs,
}: {
  tiroir: Tiroir
  onTiroirs: (tiroirs: Tiroir[]) => void
}) {
  const [dit, setDit] = useState<VerificationDuFournisseur | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  const verifier = async () => {
    setEnCours(true)
    setRefus(null)
    try {
      setDit(await api.verifierLeFournisseur(tiroir.fournisseur))
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "la vérification a échoué")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      data-fournisseur={tiroir.fournisseur}
      className="flex flex-col gap-[14px] rounded-8 border border-trait bg-carte p-[14px]"
    >
      <div className="flex items-baseline justify-between gap-[14px]">
        <span className="text-[13.5px] font-medium text-encre">
          {tiroir.fournisseur}
        </span>
        <span
          className={[
            "text-[11.5px]",
            tiroir.pret ? "text-encre-ok" : "text-encre-4",
          ].join(" ")}
        >
          {tiroir.secrets.length === 0
            ? "déjà là"
            : tiroir.pret
              ? "prêt"
              : "une clé à poser"}
        </span>
      </div>

      {tiroir.secrets.length === 0 ? (
        <p className="text-[12px] leading-[1.5] text-encre-3">
          Gratuit, sans compte, sans clé. Les images sont plus grossières. C'est
          lui qui répond tant qu'on ne fait rien, et il reste le filet quand le
          reste tombe.
        </p>
      ) : (
        <>
          <ol className="flex flex-col">
            {GESTES_DU_COMPTE.map((geste, i) => (
              <Geste key={geste.titre} rang={i + 1} titre={geste.titre}>
                {geste.quoi}
                {i === 0 && tiroir.secrets[0]?.ou ? ` Sur ${tiroir.secrets[0].ou}.` : ""}
              </Geste>
            ))}
          </ol>

          {tiroir.secrets.map((secret) => (
            <UnePlace key={secret.nom} secret={secret} onTiroirs={onTiroirs} />
          ))}
        </>
      )}

      <div className="flex items-center gap-[14px]">
        <Bouton
          enfants={enCours ? "On demande…" : "Vérifier"}
          inactif={enCours}
          onClick={() => void verifier()}
        />
        {dit && (
          <span
            data-verification={tiroir.fournisseur}
            className={[
              "text-[12.5px]",
              dit.joignable ? "text-encre-ok" : "text-echec",
            ].join(" ")}
          >
            {dit.phrase}
          </span>
        )}
      </div>
      <Souci texte={refus} />
    </section>
  )
}

/** Une place à remplir. **Aucune lecture, jamais** : le champ part vide, se vide
 *  après l'envoi, et ce qui revient du serveur n'est que l'aperçu. */
function UnePlace({
  secret,
  onTiroirs,
}: {
  secret: EtatSecret
  onTiroirs: (tiroirs: Tiroir[]) => void
}) {
  const [saisie, setSaisie] = useState("")
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const agir = async (quoi: () => Promise<{ tiroirs: Tiroir[] }>) => {
    setEnCours(true)
    setRefus(null)
    try {
      onTiroirs((await quoi()).tiroirs)
      setSaisie("")
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "refusé")
    } finally {
      setEnCours(false)
    }
  }

  const deposer = () => void agir(() => api.deposerSecret(secret.nom, saisie.trim()))

  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex flex-wrap items-baseline gap-[8px]">
        <Intitule>{secret.libelle}</Intitule>
        {secret.presente && (
          <span className="mesure text-[11px] text-encre-4">
            …{secret.apercu} · {secret.origine}
          </span>
        )}
      </div>
      <div className="flex items-start gap-[8px]">
        <input
          type="password"
          value={saisie}
          aria-label={`${secret.libelle} — ${secret.nom}`}
          placeholder={secret.presente ? "remplacer…" : "coller la clé ici"}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saisie.trim().length >= 8 && deposer()}
          className="mesure h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
        />
        <Bouton
          enfants={secret.presente ? "Remplacer" : "Déposer"}
          inactif={saisie.trim().length < 8 || enCours}
          onClick={deposer}
        />
        {/* **Retirer ne se propose que si ça retire vraiment.** Une valeur venue
            de l'environnement de la machine ne s'enlève pas d'ici, et un bouton
            qui semblerait le faire serait pire que pas de bouton du tout. */}
        {secret.retirable && (
          <Bouton
            enfants="Retirer"
            inactif={enCours}
            onClick={() => void agir(() => api.retirerSecret(secret.nom))}
          />
        )}
      </div>
      <span className="text-[11.5px] leading-[1.45] text-encre-4">
        Retirer grise les modèles de ce fournisseur-là, et n'efface ni une image
        ni une ligne de dépense.
      </span>
      <Souci texte={refus} />
    </div>
  )
}

// ── L'étape « Les animations » ───────────────────────────────────────────────

const GESTES_DU_MOTEUR: readonly { titre: string; quoi: string }[] = [
  {
    titre: "Installer ComfyUI",
    quoi: "C'est une autre application, gratuite, qu'on prend sur comfy.org — l'installateur de bureau suffit. L'atelier ne l'installe pas, ne la lance pas, et ne modifie jamais son réglage.",
  },
  {
    titre: "La laisser ouverte",
    quoi: "L'atelier la cherche tout seul à l'adresse ci-dessous. Si elle écoute ailleurs, l'adresse se change juste là.",
  },
  {
    titre: "Descendre les fichiers de modèle",
    quoi: "Là, c'est l'atelier qui travaille : il demande à ComfyUI où sont ses dossiers et y dépose ce qui manque. Une fois pour toutes, et une coupure se reprend où elle s'est arrêtée.",
  },
]

function LesAnimations({
  etat,
  onEtat,
}: {
  etat: EtatInstallation | null
  onEtat: (etat: EtatInstallation) => void
}) {
  const [adresse, setAdresse] = useState(etat?.comfy ?? "")
  const [moteur, setMoteur] = useState<EtatDuMoteur | null>(null)
  const [enCours, setEnCours] = useState<"" | "cherche" | "descend">("")
  const [refus, setRefus] = useState<string | null>(null)
  const [descendus, setDescendus] = useState<string[] | null>(null)

  useEffect(() => setAdresse(etat?.comfy ?? ""), [etat?.comfy])

  const chercher = async () => {
    setEnCours("cherche")
    setRefus(null)
    try {
      // **Poser puis chercher, dans cet ordre et dans le même geste.** Deux
      // boutons — l'un qui écrit l'adresse, l'autre qui visite — auraient laissé
      // quelqu'un chercher à l'ancienne adresse en croyant avoir changé.
      if (adresse.trim() && adresse.trim() !== etat?.comfy) {
        await api.poserLAdresseDeComfy(adresse.trim())
        onEtat(await api.installation())
      }
      setMoteur(await api.etatDuMoteur())
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "la recherche a échoué")
    } finally {
      setEnCours("")
    }
  }

  const descendre = async () => {
    setEnCours("descend")
    setRefus(null)
    try {
      const recu = await api.telechargerLesModeles()
      setDescendus(recu.descendus)
      setMoteur(recu)
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "le téléchargement a échoué")
    } finally {
      setEnCours("")
    }
  }

  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Une animation se fabrique à partir d'une image, par un modèle vidéo. Sur
        votre carte graphique c'est gratuit et lent ; chez un fournisseur c'est
        immédiat et payé au clip. Cette étape est la plus longue et la plus facile
        à sauter.
      </p>

      <ol className="flex flex-col">
        {GESTES_DU_MOTEUR.map((geste, i) => (
          <Geste key={geste.titre} rang={i + 1} titre={geste.titre}>
            {geste.quoi}
          </Geste>
        ))}
      </ol>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Où elle écoute</Intitule>
        <div className="flex items-start gap-[8px]">
          <input
            value={adresse}
            aria-label="L'adresse de ComfyUI"
            placeholder="http://127.0.0.1:8188"
            onChange={(e) => setAdresse(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void chercher()}
            data-adresse-de-comfy
            className="mesure h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
          />
          <Bouton
            enfants={enCours === "cherche" ? "On cherche…" : "Chercher"}
            inactif={enCours !== ""}
            onClick={() => void chercher()}
          />
          {etat?.origine_de_l_adresse === "fichier" && (
            <Bouton
              enfants="Remettre l'adresse d'origine"
              inactif={enCours !== ""}
              onClick={() => {
                void api
                  .oublierLAdresseDeComfy()
                  .then(() => api.installation())
                  .then(onEtat)
                  .catch(() => setRefus("l'adresse n'a pas pu être remise"))
              }}
            />
          )}
        </div>
        <span className="text-[11.5px] leading-[1.45] text-encre-4">
          {etat?.origine_de_l_adresse === "environnement"
            ? "Cette adresse vient de l'environnement de la machine : elle passe devant ce qui est réglé ici."
            : "Ce réglage prend effet tout de suite, sans redémarrer l'atelier."}
        </span>
      </section>

      {moteur !== null && (
        <section data-etat-du-moteur className="flex flex-col gap-[8px]">
          <Intitule>Ce que la recherche a trouvé</Intitule>
          <p
            className={[
              "text-[12.5px] leading-[1.5]",
              moteur.allume ? "text-encre-ok" : "text-encre-attention",
            ].join(" ")}
          >
            {moteur.allume
              ? moteur.phrase || "elle répond, et tout ce qu'il lui faut est là"
              : "elle ne répond pas — ouvrez-la, puis cliquez Chercher"}
          </p>
          {moteur.allume && moteur.carte && (
            <p className="text-[12px] text-encre-3">
              {moteur.carte} · {gigas(moteur.memoire_libre_go)} Go de mémoire libre
            </p>
          )}
          {moteur.manquants.length > 0 && (
            <>
              <ul className="flex flex-col">
                {moteur.manquants.map((fichier) => (
                  <li
                    key={fichier.nom}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-[14px] border-b border-trait py-[8px]"
                  >
                    <span className="mesure truncate text-[11.5px] text-encre-2">
                      {fichier.nom}
                    </span>
                    {/* **La licence est ici et pas dans un repli.** C'est une
                        question qu'on se pose avant de télécharger, jamais
                        après : ce qui descend là finit dans un jeu vendu. */}
                    <span className="text-[11.5px] text-encre-4">
                      {fichier.famille} · {fichier.licence}
                    </span>
                    <span className="text-[11.5px] text-encre-3">
                      {gigas(fichier.go)} Go ·{" "}
                      {fichier.obligatoire ? "obligé" : "facultatif"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-[14px]">
                <Bouton
                  enfants={
                    enCours === "descend"
                      ? "On descend les fichiers…"
                      : moteur.manquants.length === 1
                        ? `Descendre le fichier — ${gigas(moteur.go_a_telecharger)} Go`
                        : `Descendre les ${moteur.manquants.length} fichiers — ${gigas(moteur.go_a_telecharger)} Go`
                  }
                  inactif={enCours !== ""}
                  onClick={() => void descendre()}
                />
                <span className="text-[11.5px] text-encre-4">
                  Une coupure se reprend où elle s'est arrêtée, à l'octet près.
                </span>
              </div>
            </>
          )}
          {descendus && (
            <p className="text-[12px] text-encre-ok">
              {descendus.length === 0
                ? "Rien à descendre : tout était déjà là."
                : `${descendus.length} fichier${descendus.length > 1 ? "s" : ""} descendu${descendus.length > 1 ? "s" : ""}.`}
            </p>
          )}
        </section>
      )}

      <Note>
        Les fichiers de modèle ne vont pas dans le dossier de travail de
        l'atelier : ils vivent chez ComfyUI, dans ses propres dossiers, et
        l'atelier les y dépose sans jamais les recopier. Déplacer le dossier de
        travail ne les déplace pas.
      </Note>

      <Souci texte={refus} />
    </div>
  )
}

// ── L'étape « Où tout se range » ─────────────────────────────────────────────

/** Ce qui se range dans le dossier de travail — l'arbre de la planche, écrit
 *  d'après `atelier/depot/fichiers.py` et non d'après le dessin. */
const CE_QUI_SE_RANGE: readonly { quoi: string; ce_que_c_est: string }[] = [
  { quoi: "atelier.sqlite3", ce_que_c_est: "l'index — jetable, il se reconstruit" },
  { quoi: "projets/", ce_que_c_est: "un dossier par jeu, avec ses règles" },
  { quoi: "generations/", ce_que_c_est: "tout ce qui est revenu, et ses rendus" },
  { quoi: "collections.json", ce_que_c_est: "les collections, tous jeux confondus" },
  { quoi: "etiquettes.json", ce_que_c_est: "les étiquettes, partagées" },
]

function OuToutSeRange({
  etat,
  onEtat,
}: {
  etat: EtatInstallation | null
  onEtat: (etat: EtatInstallation) => void
}) {
  const [chemin, setChemin] = useState("")
  const [vu, setVu] = useState<DossierDeTravail | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [pose, setPose] = useState(false)

  const change = chemin.trim() !== "" && chemin.trim() !== etat?.dossier

  const faire = async (quoi: () => Promise<void>) => {
    setEnCours(true)
    setRefus(null)
    try {
      await quoi()
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex max-w-[880px] flex-col gap-[22px]">
      <p className="text-[13px] leading-[1.55] text-encre-2">
        Les images reçues, les jeux et l'index de l'atelier vont au même endroit.
        On garde celui qui est proposé, ou on en choisit un autre.
      </p>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Le dossier d'aujourd'hui</Intitule>
        {etat && <Chemin marque="data-dossier-de-travail">{etat.dossier}</Chemin>}
        {/* **Deux chemins tant que l'atelier n'a pas redémarré.** Choisir n'a
            rien déplacé : l'atelier écrit encore dans celui du haut. Dire
            « il a été choisi ici » sous un chemin qui n'est pas celui qu'on
            vient de choisir se lisait comme un réglage qui n'a pas pris. */}
        <span className="text-[11.5px] leading-[1.45] text-encre-4">
          {etat?.dossier_au_prochain_demarrage
            ? "C'est là que l'atelier écrit en ce moment. Il n'a pas redémarré depuis le choix."
            : etat?.origine_du_dossier === "environnement"
              ? "Il vient de l'environnement de la machine : ce qui est réglé ici ne passe pas devant."
              : etat?.origine_du_dossier === "fichier"
                ? "Il a été choisi ici. Le remettre à celui d'origine demande de retaper son chemin."
                : "C'est celui d'origine, à côté de l'application."}
        </span>
      </section>

      {etat?.dossier_au_prochain_demarrage && (
        <section className="flex flex-col gap-[8px]">
          <Intitule>Au prochain démarrage</Intitule>
          <Chemin marque="data-dossier-au-prochain-demarrage">
            {etat.dossier_au_prochain_demarrage}
          </Chemin>
          <span className="text-[11.5px] leading-[1.45] text-encre-4">
            Rien n'a été déplacé. Pour retrouver ce qui est déjà rangé, copiez le
            contenu du dossier du dessus dans celui-ci avant de relancer.
          </span>
        </section>
      )}

      <section className="flex flex-col gap-[8px]">
        <Intitule>En choisir un autre</Intitule>
        <div className="flex items-start gap-[8px]">
          <input
            value={chemin}
            aria-label="Le chemin du dossier de travail"
            placeholder="C:\\Users\\…\\Documents\\atelier"
            onChange={(e) => {
              setChemin(e.target.value)
              setVu(null)
              setPose(false)
            }}
            data-chemin-du-dossier
            className="mesure h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[14px] text-[12px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
          />
          <Bouton
            enfants="Regarder ce dossier"
            inactif={!change || enCours}
            onClick={() =>
              void faire(async () => setVu(await api.examinerLeDossier(chemin.trim())))
            }
          />
        </div>
        <span className="text-[11.5px] leading-[1.45] text-encre-4">
          Le chemin se tape : un navigateur ne donne jamais à une page le chemin
          d'un dossier de votre disque.
        </span>

        {vu && (
          <div data-verdict-du-dossier className="flex flex-col gap-[8px]">
            {vu.refus ? (
              <Alerte>{vu.refus}</Alerte>
            ) : (
              <p className="text-[12.5px] text-encre-ok">
                {vu.contenu.length === 0
                  ? "Ce dossier est vide et l'atelier peut y écrire."
                  : `L'atelier peut y écrire, et il y trouve déjà : ${vu.contenu.join(", ")}.`}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-[8px]">
              {!vu.existe && (
                <Bouton
                  enfants="Créer ce dossier"
                  inactif={enCours}
                  onClick={() =>
                    void faire(async () =>
                      setVu(await api.creerLeDossier(chemin.trim())),
                    )
                  }
                />
              )}
              {vu.utilisable && (
                <Bouton
                  enfants="Ranger ici à partir du prochain démarrage"
                  inactif={enCours}
                  onClick={() =>
                    void faire(async () => {
                      const recu = await api.poserLeDossier(chemin.trim())
                      onEtat(recu.installation)
                      setPose(true)
                    })
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* **Court, parce que le haut de l'écran dit maintenant le reste.**
            Depuis que les deux chemins s'affichent séparément avec la phrase
            qui explique la copie, redire ici que rien n'a bougé faisait deux
            paragraphes du même propos à trois lignes d'écart. */}
        {pose && (
          <Alerte>
            C'est écrit — rien n'a été déplacé, rien n'a été effacé. Le nouveau
            chemin est en haut de cet écran.
          </Alerte>
        )}

        <Souci texte={refus} />
      </section>

      <section className="flex flex-col gap-[8px]">
        <Intitule>Ce qui s'y range</Intitule>
        <dl className="flex flex-col">
          {CE_QUI_SE_RANGE.map(({ quoi, ce_que_c_est }) => (
            <div
              key={quoi}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-baseline gap-[14px] border-b border-trait py-[8px]"
            >
              <dt className="mesure truncate text-[12px] text-encre-2">{quoi}</dt>
              <dd className="text-[12px] text-encre-3">{ce_que_c_est}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] leading-[1.5] text-encre-3">
          Le fichier des clés, lui, n'y est pas : il reste à côté de
          l'application. Les fichiers de modèle de ComfyUI non plus — ils vivent
          chez lui.
        </p>
      </section>

      {etat && <LeDisque etat={etat} />}
    </div>
  )
}

/** Ce que le dossier de travail occupe, poste par poste.
 *
 *  ⚠️ **Aucun bouton pour vider.** La planche en dessine un ; `B15` mesure et
 *  n'efface pas. Une suppression de masse pilotée par un motif de nom est le
 *  piège que `docs/PIEGES.md` a déjà payé une fois, et aucun critère de cette
 *  tranche ne la demande. */
function LeDisque({ etat }: { etat: EtatInstallation }) {
  return (
    <section data-disque className="flex flex-col gap-[8px]">
      <Intitule>Ce que ça occupe</Intitule>
      {etat.disque.postes.length === 0 ? (
        <p className="text-[12.5px] text-encre-3">
          Rien encore : ce dossier ne porte aucune image.
        </p>
      ) : (
        <dl className="flex flex-col">
          {etat.disque.postes.map((poste) => (
            <div
              key={poste.nom}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-[14px] border-b border-trait py-[8px]"
            >
              <dt className="text-[12.5px] text-encre-2">{poste.nom}</dt>
              <dd className="text-[12.5px] text-encre-3">
                {mesureDuDisque(poste.mo)}
              </dd>
              <dd className="text-[11.5px] text-encre-4">
                {poste.recalculable ? "se refait tout seul" : "ne se refait pas"}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-[11.5px] leading-[1.45] text-encre-4">
        {etat.disque.recalculable_mo > 0
          ? `${mesureDuDisque(etat.disque.recalculable_mo)} se refont tout seuls et pourraient être jetés. L'atelier ne les jette pas : il n'a pas de bouton pour ça, et effacer en masse mérite mieux qu'un clic.`
          : "Rien de ce qui est là ne se refait tout seul."}
      </p>
    </section>
  )
}

// ── Le sommaire, et ce qu'il porte en plus ───────────────────────────────────

/** Le catalogue, tel que le serveur le sert — **aucun compte n'est écrit ici**.
 *
 *  C'est aussi ce qui montre les deux critères du grisé : retirer une clé grise
 *  les modèles de ce fournisseur-là, et un fournisseur injoignable grise les
 *  siens. Les deux se lisent dans la colonne de droite, sans quitter l'écran. */
function LeCatalogue({ modeles }: { modeles: Modele[] }) {
  const [tout, setTout] = useState(false)
  const montres = tout ? modeles : modeles.slice(0, 5)
  const grises = modeles.filter((m) => m.refus).length

  return (
    <section data-catalogue className="flex flex-col gap-[8px]">
      <Intitule>Le catalogue des modèles</Intitule>
      <p className="text-[12px] text-encre-3">
        {modeles.length} au catalogue
        {grises > 0 ? ` · ${grises} grisé${grises > 1 ? "s" : ""}` : ""}
      </p>
      <dl className="flex flex-col">
        {montres.map((modele) => (
          <div
            key={modele.identifiant}
            data-modele={modele.identifiant}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-baseline gap-[14px] border-b border-trait py-[8px]"
          >
            <dt className="mesure truncate text-[12px] text-encre-2">
              {modele.identifiant}
            </dt>
            <dd
              className={[
                "truncate text-[11.5px]",
                modele.refus ? "text-encre-attention" : "text-encre-4",
              ].join(" ")}
              title={modele.refus ?? ""}
            >
              {modele.refus ?? "disponible"}
            </dd>
          </div>
        ))}
      </dl>
      {modeles.length > 5 && (
        <Bouton
          enfants={tout ? "N'en montrer que cinq" : `Les ${modeles.length - 5} autres`}
          onClick={() => setTout(!tout)}
        />
      )}
    </section>
  )
}

function LesJeux({ jeux }: { jeux: string[] }) {
  return (
    <section data-jeux-de-la-machine className="flex flex-col gap-[8px]">
      <Intitule>Les jeux sur cette machine</Intitule>
      {jeux.length === 0 ? (
        <p className="text-[12.5px] text-encre-3">Aucun pour l'instant.</p>
      ) : (
        <ul className="flex flex-col">
          {jeux.map((nom) => (
            <li
              key={nom}
              className="border-b border-trait py-[8px] text-[12.5px] text-encre-2"
            >
              {nom}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── L'écran ──────────────────────────────────────────────────────────────────

export function Installation({
  mode,
  tiroirs,
  modeles,
  onTiroirs,
  onFerme,
  onLesAutresReglages,
}: {
  mode: Mode
  /** **Une place par fournisseur** (F3), tel que `GET /status` le sert. L'écran
   *  ne le recalcule jamais : une clé posée peut être masquée par une variable
   *  d'environnement, et seul le serveur le sait. */
  tiroirs: Tiroir[]
  /** Le catalogue entier, avec le refus de chacun déjà composé par le serveur. */
  modeles: Modele[]
  onTiroirs: (tiroirs: Tiroir[]) => void
  onFerme: () => void
  /** Les garde-fous de l'agent et les mouvements, que `B15` ne reprend pas. */
  onLesAutresReglages: () => void
}) {
  const [etat, setEtat] = useState<EtatInstallation | null>(null)
  const [ouverte, setOuverte] = useState<Etape | null>(
    mode === "premiere" ? "tour" : null,
  )

  useEffect(() => {
    let vivant = true
    void api
      .installation()
      .then((recu) => vivant && setEtat(recu))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  // **Le tour ne se rouvrira plus tout seul** dès qu'on l'a ouvert une fois en
  // première ouverture — passé, fini ou fermé au milieu, c'est pareil : la
  // planche dit *« il ne revient plus de lui-même, même si tout a été passé »*.
  const fermer = useCallback(() => {
    if (mode === "premiere") void api.tourFait().catch(() => undefined)
    onFerme()
  }, [mode, onFerme])

  // Échap referme l'étape ouverte, puis l'écran — même geste qu'en `B14`.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (mode === "reglages" && ouverte !== null) {
        setOuverte(null)
        return
      }
      fermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [mode, ouverte, fermer])

  const rang = ouverte === null ? -1 : ETAPES.findIndex((e) => e.clef === ouverte)
  const courante = ouverte === null ? null : ETAPES[rang]

  const continuer = () => {
    if (mode === "reglages") {
      setOuverte(null)
      return
    }
    const suivante = ETAPES[rang + 1]
    if (suivante) setOuverte(suivante.clef)
    else fermer()
  }

  const resumes = useMemo(
    () => resumeDesEtapes(etat, tiroirs),
    [etat, tiroirs],
  )

  return (
    <main
      data-installation
      data-mode={mode}
      aria-label="L'installation"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-papier"
    >
      <header className="flex shrink-0 items-end justify-between gap-[22px] border-b border-trait px-[30px] pb-[14px] pt-[22px]">
        <div className="flex min-w-0 flex-col gap-[4px]">
          <h1 className="font-serif text-[38px] leading-[1.05] text-encre">
            {mode === "premiere" ? "Bienvenue" : "L'installation"}
          </h1>
          <p className="text-[13px] text-encre-2">
            {mode === "premiere"
              ? "Quatre étapes, deux minutes, et aucune n'est obligatoire."
              : "Ce qu'on branche une fois sur cette machine. On clique l'étape qu'on veut reprendre."}
          </p>
        </div>
        <button
          type="button"
          onClick={fermer}
          className="h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
        >
          {mode === "premiere" ? "Tout passer et ouvrir l'atelier" : "Fermer"}
        </button>
      </header>

      <nav
        aria-label="Les quatre étapes"
        className="flex shrink-0 gap-[4px] border-b border-trait px-[30px] py-[8px]"
      >
        {ETAPES.map((etape, i) => (
          <button
            key={etape.clef}
            type="button"
            aria-current={ouverte === etape.clef}
            onClick={() => setOuverte(etape.clef)}
            className={[
              "flex h-[30px] items-center gap-[8px] rounded-7 px-[14px] text-[13px] transition-colors duration-120",
              ouverte === etape.clef
                ? "bg-papier-cote font-medium text-encre"
                : "text-encre-3 hover:text-encre",
            ].join(" ")}
          >
            <span className="mesure text-[11px] text-encre-4">{i + 1}</span>
            {etape.titre}
          </button>
        ))}
      </nav>

      <div className="defile min-h-0 flex-1 overflow-y-auto px-[30px] py-[22px]">
        {courante && (
          <h2 className="mb-[14px] font-serif text-[25px] leading-[1.15] text-encre">
            {courante.question}
          </h2>
        )}

        {ouverte === "tour" && <LeTour etat={etat} tiroirs={tiroirs} />}
        {ouverte === "images" && (
          <LesImages tiroirs={tiroirs} etat={etat} onTiroirs={onTiroirs} />
        )}
        {ouverte === "animations" && <LesAnimations etat={etat} onEtat={setEtat} />}
        {ouverte === "dossier" && <OuToutSeRange etat={etat} onEtat={setEtat} />}

        {ouverte === null && (
          <div className="flex max-w-[880px] flex-col gap-[22px]">
            <ul className="flex flex-col">
              {ETAPES.map((etape, i) => (
                <li key={etape.clef}>
                  <button
                    type="button"
                    onClick={() => setOuverte(etape.clef)}
                    data-etape-de-l-installation={etape.clef}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-[14px] border-b border-trait py-[14px] text-left transition-colors duration-120 hover:bg-ligne-ouverte"
                  >
                    <span className="mesure text-[11px] text-encre-4">{i + 1}</span>
                    <span className="flex flex-col gap-[4px]">
                      <span className="text-[13.5px] text-encre">{etape.titre}</span>
                      <span className="text-[11.5px] text-encre-4">
                        {SOUS_TITRES[etape.clef]}
                      </span>
                    </span>
                    <span className="truncate text-[12.5px] text-encre-3">
                      {resumes[etape.clef]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <LeCatalogue modeles={modeles} />
            {etat && <LesJeux jeux={etat.jeux} />}
            {etat && <LeDisque etat={etat} />}

            <section className="flex flex-col gap-[8px]">
              <Intitule>Ce qui se règle ailleurs</Intitule>
              <p className="text-[12px] leading-[1.5] text-encre-3">
                Les garde-fous de l'agent — son plafond de séance, le modèle qu'on
                lui impose, le dossier où il dépose — et la bibliothèque de
                mouvements ne sont pas ici.
              </p>
              <div>
                <Bouton
                  enfants="Les garde-fous de l'agent et les mouvements"
                  onClick={onLesAutresReglages}
                />
              </div>
            </section>
          </div>
        )}
      </div>

      {ouverte !== null && (
        <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait px-[30px] py-[14px]">
          <button
            type="button"
            onClick={() => (rang > 0 ? setOuverte(ETAPES[rang - 1].clef) : fermer())}
            className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
          >
            {rang > 0 ? `‹ ${ETAPES[rang - 1].titre}` : mode === "reglages" ? "‹ Réglages" : "Fermer"}
          </button>
          <div className="flex items-center gap-[14px]">
            <span className="text-[11.5px] text-encre-4">
              {mode === "premiere"
                ? `Étape ${rang + 1} sur 4 — chacune se saute.`
                : "Rien de ce qui est ici ne coûte quoi que ce soit."}
            </span>
            {/* **Le seul bouton rouille de l'écran** — la règle de `D0`. Rien ne
                coûte ici ; c'est lui qui mène au bout. */}
            <button
              type="button"
              onClick={continuer}
              className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec"
            >
              {libelleDuBouton(mode, rang)}
            </button>
          </div>
        </footer>
      )}
    </main>
  )
}

/** Ce que le bouton de pied annonce — **ce qu'il fait, pas « suivant »**. */
function libelleDuBouton(mode: Mode, rang: number): string {
  if (mode === "reglages") return "‹ Réglages"
  if (rang === ETAPES.length - 1) return "C'est prêt — ouvrir l'atelier"
  return `Passer ${ETAPES[rang + 1].suite}`
}

/** Une ligne de résumé par étape, pour le sommaire. **Comptée, jamais devinée**. */
export function resumeDesEtapes(
  etat: EtatInstallation | null,
  tiroirs: readonly Tiroir[],
): Record<Etape, string> {
  const posees = tiroirs.filter((t) => t.secrets.length > 0 && t.pret).length
  const demandeurs = tiroirs.filter((t) => t.secrets.length > 0).length
  return {
    tour: "ce qu'il faut savoir avant de commencer",
    images:
      demandeurs === 0
        ? "aucun fournisseur ne demande de clé"
        : `${posees} clé${posees > 1 ? "s" : ""} sur ${demandeurs} posée${posees > 1 ? "s" : ""}`,
    animations: etat ? etat.comfy : "…",
    dossier: etat ? etat.dossier : "…",
  }
}
