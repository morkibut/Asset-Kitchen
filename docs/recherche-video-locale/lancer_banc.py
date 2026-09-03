"""Le lanceur du banc — une question, une réponse, aucun argent dépensé.

**Ce que ce banc cherche à savoir**, et rien d'autre : *sur cette carte de 8 Go,
un modèle vidéo ouvert sait-il animer notre nain, en combien de temps, et le
personnage reste-t-il lui-même ?*

**Ce qu'il ne coûte pas.** Rien. Tout tourne sur la carte de la maison. Le seul
prix est du temps — le tien pendant le téléchargement, celui de la machine
pendant le calcul — et de la place disque, annoncée avant chaque essai.

**Comment on s'en sert.**

    python lancer_banc.py --a-sec        # ce qui partirait, sans rien lancer
    python lancer_banc.py --relever      # ce qui est installé, ce qui manque
    python lancer_banc.py ltx            # l'essai LTX, le moins cher en place disque
    python lancer_banc.py wan            # l'essai Wan 2.2 TI2V-5B quantifié

Chaque essai écrit dans `bancs/<nom>/` : les images une par une, le clip, et un
`mesures.json` qui garde le temps, la mémoire prise et le montage exact envoyé —
pour qu'un résultat se relise dans six mois sans deviner ce qui l'a produit.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

# **La console de Windows parle encore le codage d'avant.** Sans cette ligne, un
# tiret cadratin dans un titre fait tomber tout le banc avant le premier calcul.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

import banc_comfy as comfy  # noqa: E402
import montages  # noqa: E402

RACINE = ICI.parent.parent  # le dépôt
ENTREE = RACINE / "essais" / "resultats_video" / "entree-480x480.png"
BANCS = ICI / "bancs"

GO = 1024**3


# ── Ce qu'il faut avoir avant de lancer ──────────────────────────────────────

ESSAIS = {
    "ltx": {
        "titre": "LTX-Video 2B — le plus léger, et son encodeur est déjà là",
        "montage": montages.ltx_2b,
        "besoins": [
            ("checkpoints", "ltx-video-2b-v0.9.5.safetensors", 5.91,
             "https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltx-video-2b-v0.9.5.safetensors"),
            ("text_encoders", "t5xxl_fp8_e4m3fn.safetensors", 4.56, "déjà installé"),
        ],
        "classe_temoin": ("CheckpointLoaderSimple", "ckpt_name"),
    },
    "wan": {
        "titre": "Wan 2.2 TI2V-5B quantifié — le plus petit qui parte d'une image",
        "montage": montages.wan_ti2v_5b,
        "besoins": [
            ("unet", "Wan2.2-TI2V-5B-Q5_K_M.gguf", 3.55,
             "https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q5_K_M.gguf"),
            ("text_encoders", "umt5-xxl-encoder-Q5_K_M.gguf", 3.86,
             "https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q5_K_M.gguf"),
            ("vae", "wan2.2_vae.safetensors", 1.31,
             "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors"),
        ],
        "classe_temoin": ("UnetLoaderGGUF", "unet_name"),
    },
    "pixel": {
        "titre": "Wan 2.2 image→vidéo 14B + le greffon pixel art — le seul qui vise nos sprites",
        "montage": montages.wan_i2v_14b_pixel,
        "entree": "entree-832x480.png",
        "besoins": [
            ("diffusion_models", "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf", 8.99, "QuantStack/Wan2.2-I2V-A14B-GGUF"),
            ("diffusion_models", "Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf", 8.99, "QuantStack/Wan2.2-I2V-A14B-GGUF"),
            ("loras", "wan2.2_animate_adapter_model.safetensors", 2.29, "styly-agents/Wan2-2-pixel-animate"),
            ("loras", "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", 1.14, "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"),
            ("loras", "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", 1.14, "Comfy-Org/Wan_2.2_ComfyUI_Repackaged"),
            ("text_encoders", "umt5-xxl-encoder-Q5_K_M.gguf", 3.86, "city96/umt5-xxl-encoder-gguf"),
            ("vae", "wan_2.1_vae.safetensors", 0.24, "Comfy-Org/Wan_2.1_ComfyUI_repackaged"),
        ],
        "classe_temoin": ("UnetLoaderGGUF", "unet_name"),
        # **Les paliers suivent ce que le greffon connaît, pas ce qu'on voudrait.**
        # Il a été entraîné par paquets de 8, 16, 24 et 32 images en 600×370. On
        # commence donc dans son terrain, et on en sort progressivement — la
        # dernière ligne est le carré que le projet vise vraiment.
        "paliers": [
            {"nom": "connu", "largeur": 832, "hauteur": 480, "images": 17},
            {"nom": "bucket32", "largeur": 832, "hauteur": 480, "images": 33},
            {"nom": "recette", "largeur": 832, "hauteur": 480, "images": 45},
            {"nom": "carre", "largeur": 480, "hauteur": 480, "images": 33},
        ],
    },
}

# Les paliers, du plus petit au plus grand. **On monte, on ne descend pas** :
# le premier palier qui casse par manque de mémoire est la réponse du banc, et
# tout ce qui est au-dessus est inutile à essayer.
PALIERS = [
    {"nom": "petit", "largeur": 320, "hauteur": 320, "secondes": 2.0},
    {"nom": "moyen", "largeur": 480, "hauteur": 480, "secondes": 3.0},
    {"nom": "vise", "largeur": 480, "hauteur": 480, "secondes": 4.0},
    {"nom": "large", "largeur": 640, "hauteur": 640, "secondes": 4.0},
]


def paliers_de(nom: str) -> list[dict]:
    """Les paliers propres à un essai, ou les paliers communs à défaut."""
    return ESSAIS[nom].get("paliers") or PALIERS


def entree_de(nom: str) -> Path:
    """L'image de départ propre à un essai — le cadrage change avec le modèle."""
    propre = ESSAIS[nom].get("entree")
    return (BANCS / propre) if propre else ENTREE


def dire_ce_qui_partirait(nom: str) -> None:
    essai = ESSAIS[nom]
    print(f"\n  {essai['titre']}")
    print(f"  {'─' * 68}")
    total = 0.0
    for dossier, fichier, go, source in essai["besoins"]:
        deja = source == "déjà installé"
        total += 0.0 if deja else go
        marque = "déjà là" if deja else f"{go:.2f} Go à télécharger"
        print(f"    {dossier}/{fichier}")
        print(f"        {marque}")
        if not deja:
            print(f"        {source}")
    print(f"\n    à télécharger en tout : {total:.2f} Go")
    libre = shutil.disk_usage(ICI.drive + "\\").free / GO
    print(f"    place libre sur le disque : {libre:.0f} Go")
    entree = entree_de(nom)
    print(f"\n    l'image qui part : {entree.name} — le nain sur fond gris uni")
    print(f"    le texte qui part, mot pour mot :")
    for ligne in _replier(montages.PROMPT_MARCHE, 66):
        print(f"        {ligne}")
    print(f"\n    les paliers, du plus petit au plus grand :")
    for p in paliers_de(nom):
        if "images" in p:
            n = ((p["images"] - 1) // 4) * 4 + 1
            print(f"        {p['nom']:<9} {p['largeur']}×{p['hauteur']}, {n} images (~{n / 16:.1f} s à 16 im/s)")
        else:
            n = montages.images_wan(p["secondes"]) if nom == "wan" else montages.images_ltx(p["secondes"])
            print(f"        {p['nom']:<9} {p['largeur']}×{p['hauteur']}, {p['secondes']:g} s → {n} images")
    print(f"\n    ce que ça coûte en argent : rien, tout tourne à la maison.")
    print(f"    ce que ça coûte en temps  : inconnu, c'est justement la question.")


def _replier(texte: str, largeur: int) -> list[str]:
    mots, lignes, courante = texte.split(), [], ""
    for mot in mots:
        if len(courante) + len(mot) + 1 > largeur:
            lignes.append(courante)
            courante = mot
        else:
            courante = f"{courante} {mot}".strip()
    if courante:
        lignes.append(courante)
    return lignes


def relever() -> None:
    """Ce que ComfyUI voit vraiment — la seule preuve d'installation qui vaille."""
    stats = comfy.etat()
    appareil = (stats.get("devices") or [{}])[0]
    print(f"\n  ComfyUI  : {stats.get('system', {}).get('comfyui_version', '?')}")
    print(f"  carte    : {appareil.get('name', '?')}")
    print(f"  mémoire  : {appareil.get('vram_free', 0) / GO:.2f} Go libres sur {appareil.get('vram_total', 0) / GO:.2f} Go")
    print()
    for nom, essai in ESSAIS.items():
        classe, champ = essai["classe_temoin"]
        try:
            vus = comfy.modeles_visibles(classe, champ)
        except comfy.BancErreur as erreur:
            print(f"  {nom:<5} : le chargeur {classe} n'existe pas ici ({erreur})")
            continue
        manquants = [f for _, f, _, s in essai["besoins"] if s != "déjà installé" and f not in vus]
        etat = "PRÊT" if not manquants else f"manque {', '.join(manquants)}"
        print(f"  {nom:<5} : {etat}")
        print(f"          {classe} voit {len(vus)} fichier(s) : {', '.join(vus[:6]) or '(aucun)'}")


def tirer_un_palier(nom: str, palier: dict, image_deposee: str, graine: int) -> dict:
    essai = ESSAIS[nom]
    dossier = BANCS / nom / f"{palier['nom']}-g{graine}"
    reglages = dict(
        image=image_deposee,
        prompt=montages.PROMPT_MARCHE,
        largeur=palier["largeur"],
        hauteur=palier["hauteur"],
        graine=graine,
        prefixe=f"banc/{nom}-{palier['nom']}",
    )
    # Deux façons de dire la longueur d'un clip : en secondes pour les montages qui
    # calculent eux-mêmes le compte d'images, en images pour celui du greffon pixel
    # art — dont les paquets d'entraînement sont comptés en images, pas en temps.
    if "images" in palier:
        reglages["images"] = palier["images"]
        combien = f"{palier['images']} images"
    else:
        reglages["secondes"] = palier["secondes"]
        combien = f"{palier['secondes']:g} s"
    montage = essai["montage"](**reglages)
    print(f"    {palier['nom']:<9} {palier['largeur']}×{palier['hauteur']}, {combien} … ", end="", flush=True)
    resultat = comfy.tirer(montage, delai_max=3600)

    ligne = {
        "palier": palier["nom"],
        "largeur": palier["largeur"],
        "hauteur": palier["hauteur"],
        "longueur_demandee": palier.get("images") or f"{palier.get('secondes')} s",
        "graine": graine,
        "secondes_de_calcul": round(resultat.secondes, 1),
        "vram_prise_go": round(resultat.vram_prise_go, 2),
        "erreur": resultat.erreur,
        "montage": montage,
    }

    if resultat.erreur:
        print(f"ÉCHEC après {resultat.secondes:.0f} s")
        print(f"           {resultat.erreur[:200]}")
    else:
        dossier.mkdir(parents=True, exist_ok=True)
        rendus = []
        for i, reference in enumerate(resultat.fichiers):
            suffixe = Path(reference["filename"]).suffix or ".png"
            vers = dossier / f"{i:03d}{suffixe}"
            comfy.recuperer(reference, vers)
            rendus.append(vers.name)
        ligne["fichiers"] = rendus
        images = [f for f in rendus if f.endswith(".png")]
        par_image = resultat.secondes / max(1, len(images))
        ligne["secondes_par_image"] = round(par_image, 2)
        print(f"OK en {resultat.secondes:.0f} s — {len(images)} images, {par_image:.1f} s/image, {resultat.vram_prise_go:.1f} Go pris")
    return ligne


def main() -> None:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("essai", nargs="?", choices=sorted(ESSAIS), help="lequel lancer")
    analyseur.add_argument("--a-sec", action="store_true", help="dire ce qui partirait, sans rien lancer")
    analyseur.add_argument("--relever", action="store_true", help="ce que ComfyUI voit vraiment")
    analyseur.add_argument("--graines", type=int, default=1, help="combien de tirages par palier")
    arguments = analyseur.parse_args()

    if arguments.relever:
        relever()
        return

    if arguments.a_sec or not arguments.essai:
        for nom in sorted(ESSAIS) if not arguments.essai else [arguments.essai]:
            dire_ce_qui_partirait(nom)
        print("\n  Rien n'a été lancé. Relance sans --a-sec pour aller au bout.\n")
        return

    nom = arguments.essai
    print(f"\n  {ESSAIS[nom]['titre']}\n")
    entree = entree_de(nom)
    if not entree.exists():
        raise SystemExit(f"  L'image de départ est introuvable : {entree}")

    depose = comfy.deposer_image(entree, "banc-video-entree.png")
    print(f"  image déposée chez ComfyUI sous « {depose} »\n")

    mesures = {"essai": nom, "seance": time.strftime("%Y-%m-%d"), "lignes": []}
    for palier in paliers_de(nom):
        casse = False
        for graine in range(1, arguments.graines + 1):
            ligne = tirer_un_palier(nom, palier, depose, graine)
            mesures["lignes"].append(ligne)
            if "MÉMOIRE ÉPUISÉE" in (ligne["erreur"] or ""):
                casse = True
                break
        (BANCS / nom).mkdir(parents=True, exist_ok=True)
        (BANCS / nom / "mesures.json").write_text(
            json.dumps(mesures, indent=1, ensure_ascii=False), "utf-8"
        )
        if casse:
            print(f"\n  La mémoire a lâché au palier « {palier['nom']} ». C'est la réponse du banc :")
            print(f"  cette carte tient jusqu'au palier d'en dessous, pas au-delà.\n")
            break

    print(f"\n  Tout est dans {BANCS / nom}\n")


if __name__ == "__main__":
    main()
