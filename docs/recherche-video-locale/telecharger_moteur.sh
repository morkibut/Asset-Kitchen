#!/usr/bin/env bash
# Les deux moitiés du moteur — dix-neuf gigaoctets, et c'est là que ça casse.
#
# **Pourquoi un script à part.** La première tentative s'est fait couper en cours
# de route sur les deux fichiers, et le script général ne l'a pas dit : `curl`
# échouait, la chaîne `&&` s'arrêtait, et la fonction rendait la main comme si
# tout allait bien. Un fichier à moitié descendu ressemblait alors à un fichier
# absent.
#
# **Ce que celui-ci fait de plus.** Il demande d'abord au serveur la taille
# exacte du fichier, puis il reprend (`-C -`) tant que ce qu'il a sur le disque
# n'atteint pas cette taille. Il ne renomme qu'à l'octet près. Et il **le dit**
# quand il abandonne.
set -u
M="/c/Users/damie/AppData/Local/Comfy-Desktop/ComfyUI-Shared/models/diffusion_models"
Q=https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF/resolve/main
ESSAIS_MAX=40

descendre() { # nom  adresse
  local n="$1" u="$2" attendu vu essai=0
  mkdir -p "$M"
  [ -f "$M/$n" ] && { echo ">> $n : déjà complet"; return 0; }

  attendu=$(curl -sIL -m 60 "$u" | grep -i "^content-length" | tail -1 | tr -d '\r' | awk '{print $2}')
  if [ -z "$attendu" ]; then echo "!! $n : le serveur ne dit pas la taille, j'abandonne"; return 1; fi
  echo ">> $n — $((attendu/1048576)) Mo attendus"

  while [ "$essai" -lt "$ESSAIS_MAX" ]; do
    essai=$((essai+1))
    curl -L -C - --retry 10 --retry-delay 5 --retry-all-errors \
         --connect-timeout 30 --speed-time 120 --speed-limit 10240 \
         -s -o "$M/$n.part" "$u"
    vu=$(stat -c%s "$M/$n.part" 2>/dev/null || echo 0)
    if [ "$vu" = "$attendu" ]; then
      mv "$M/$n.part" "$M/$n"
      echo "   COMPLET après $essai reprise(s) : $((vu/1048576)) Mo"
      return 0
    fi
    echo "   coupé à $((vu/1048576))/$((attendu/1048576)) Mo — reprise $essai"
    sleep 3
  done
  echo "!! $n : abandonné après $ESSAIS_MAX reprises, $((vu/1048576))/$((attendu/1048576)) Mo"
  return 1
}

descendre Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf "$Q/HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"
descendre Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf  "$Q/LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf"

echo
echo "=== état final ==="
for n in Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf; do
  if [ -f "$M/$n" ]; then echo "  OK      $(du -h "$M/$n" | cut -f1)  $n"
  else echo "  MANQUE  $n"; fi
done
