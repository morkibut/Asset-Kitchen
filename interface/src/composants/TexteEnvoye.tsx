// Un texte envoyé à un modèle, copiable — et un bouton « Copier » seul,
// pour les endroits qui composent déjà leur propre affichage du texte (RV20,
// 23 septembre 2026, retour de l'auteur).
//
// **Trois endroits redisaient chacun, à leur façon, « voici le texte parti » :**
// le volet d'un clip le coupait à une ligne, lisible en entier seulement dans
// une bulle au survol — « je peux le lire mais pas le récupérer » — ; la fiche
// d'une image savait déjà copier, mais échouait en silence si le navigateur
// refusait ; le tiroir de relecture, côté image fixe, ne savait que reprendre
// le texte dans le champ de génération, jamais l'emporter tel quel. Un seul
// petit composant sert maintenant les trois.
//
// **La copie dit son échec.** `navigator.clipboard` peut manquer — contexte
// non sécurisé, permission refusée — et le composant le dit au lieu de
// laisser croire que rien ne s'est passé.

import { useEffect, useState } from "react"

type EtatCopie = "repos" | "copie" | "echec"

/** Le bouton « Copier », seul. Met le texte entier dans le presse-papiers,
 *  dit « copié » un instant, et dit l'échec si le navigateur refuse. */
export function BoutonCopierTexte({
  texte,
  libelle = "Copier",
  className = "",
}: {
  texte: string
  /** Le mot du bouton au repos — la fiche d'une image gardait « copier le
   *  texte », déjà lu par un essai ; les autres endroits prennent le défaut. */
  libelle?: string
  className?: string
}) {
  const [etat, setEtat] = useState<EtatCopie>("repos")

  useEffect(() => {
    if (etat === "repos") return
    const t = window.setTimeout(() => setEtat("repos"), etat === "copie" ? 1500 : 2500)
    return () => window.clearTimeout(t)
  }, [etat])

  const copier = () => {
    if (!navigator.clipboard?.writeText) {
      setEtat("echec")
      return
    }
    navigator.clipboard
      .writeText(texte)
      .then(() => setEtat("copie"))
      .catch(() => setEtat("echec"))
  }

  return (
    <button
      type="button"
      onClick={copier}
      className={`mesure self-start text-[10.5px] text-signal hover:opacity-70 ${className}`}
    >
      {etat === "copie" ? "copié" : etat === "echec" ? "copie refusée par le navigateur" : libelle}
    </button>
  )
}

/** Le texte envoyé, coupé à une ligne, qui se déplie **au clic** — au lieu de
 *  n'exister qu'en bulle au survol — avec le bouton « Copier » sous lui. */
export function TexteEnvoye({
  texte,
  className = "",
}: {
  texte: string
  className?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        title={ouvert ? undefined : texte}
        aria-label={ouvert ? "replier le texte" : "déplier le texte"}
        className={[
          "mesure text-left text-[11.5px] leading-snug text-encre-2",
          ouvert ? "whitespace-pre-wrap" : "truncate",
        ].join(" ")}
      >
        {texte}
      </button>
      <BoutonCopierTexte texte={texte} />
    </div>
  )
}
