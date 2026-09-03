#!/usr/bin/env bash
# Les six fichiers du chemin « pixel art » — Wan 2.2 image vers vidéo, 14 milliards,
# compressé, plus le greffon pixel art et le greffon d'accélération.
#
# Chaque fichier se reprend là où il s'est arrêté (`-C -`) : couper et relancer ne
# recommence rien. Rien n'est écrasé si le fichier est déjà complet.
set -u
M="/c/Users/damie/AppData/Local/Comfy-Desktop/ComfyUI-Shared/models"

prendre() { # dossier  nom  adresse
  local d="$M/$1" n="$2" u="$3"
  mkdir -p "$d"
  if [ -f "$d/$n" ]; then
    echo ">> $n : déjà là ($(du -h "$d/$n" | cut -f1))"
    return
  fi
  echo ">> $n"
  curl -L -C - --retry 5 --retry-delay 5 -# -o "$d/$n.part" "$u" && mv "$d/$n.part" "$d/$n" && echo "   fini : $(du -h "$d/$n" | cut -f1)"
}

Q=https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF/resolve/main
C=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files
W=https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files
S=https://huggingface.co/styly-agents/Wan2-2-pixel-animate/resolve/main
G=https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main

# Le décodeur et l'encodeur d'abord : petits, et sans eux rien ne part.
prendre vae           wan_2.1_vae.safetensors                                   "$W/vae/wan_2.1_vae.safetensors"
prendre text_encoders umt5-xxl-encoder-Q5_K_M.gguf                              "$G/umt5-xxl-encoder-Q5_K_M.gguf"
# Les deux greffons : c'est eux qui font la différence, et ils sont légers.
prendre loras         wan2.2_animate_adapter_model.safetensors                  "$S/wan2.2_animate_adapter_model.safetensors"
prendre loras         wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors "$C/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
prendre loras         wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors  "$C/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"
# Le moteur en dernier : 18 Go à lui seul, et les deux moitiés sont indispensables.
prendre diffusion_models Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf                  "$Q/HighNoise/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf"
prendre diffusion_models Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf                   "$Q/LowNoise/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf"

echo
echo "=== ce qui est en place ==="
for f in vae/wan_2.1_vae.safetensors text_encoders/umt5-xxl-encoder-Q5_K_M.gguf \
         loras/wan2.2_animate_adapter_model.safetensors \
         loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors \
         loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors \
         diffusion_models/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf \
         diffusion_models/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf; do
  if [ -f "$M/$f" ]; then echo "  OK   $(du -h "$M/$f" | cut -f1)  $f"; else echo "  MANQUE           $f"; fi
done
echo "place libre : $(df -h /c | tail -1 | awk '{print $4}')"
