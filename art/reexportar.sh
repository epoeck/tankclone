#!/usr/bin/env bash
# Reexporta um .vectorcraft de art/fontes para o SVG correspondente em art/export.
# Para body/arm (pele) e hair-back/hair-front (cabelo) devolve o currentColor:
# o VectorCraft não guarda currentColor (vira a cor literal na importação), então a cor
# padrão funciona como cor-chave e é trocada de volta por currentColor no SVG exportado.
#
# uso: art/reexportar.sh art/fontes/chars/body/body-1.vectorcraft [saida.svg]
set -euo pipefail
in="$1"
out="${2:-$(echo "$in" | sed -e 's#/fontes/#/export/#' -e 's#\.vectorcraft$#.svg#')}"
vectorcraft-cli convert "$in" "$out" >/dev/null

case "$in" in
  */chars/body/*|*/chars/arm/*)                key='#F2C79F' ;;  # pele
  */chars/hair-back/*|*/chars/hair-front/*)    key='#6B3A1F' ;;  # cabelo
  *) exit 0 ;;
esac
k="${key#\#}"
sed -i -E \
  -e "s/(fill|stroke)=\"#${k}\"/\1=\"currentColor\"/Ig" \
  -e "0,/<svg /s//<svg color=\"${key}\" /" \
  "$out"
echo "$out (currentColor = $key)"
