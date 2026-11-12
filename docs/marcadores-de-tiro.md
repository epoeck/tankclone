# Marcas do último tiro

Na referência, `EnergyView.__beginNewTurn` conserva a largura da faixa cinza do
último disparo e `ArrowView` conserva uma cópia da agulha. No HUD do projeto,
a faixa cinza e a agulha cinza ficam ocultas até existir um tiro confirmado e
usam força, ângulo absoluto e lado desse tiro. O importador opcional
`scripts/import-reborn-ui.py` traz os bitmaps originais `arrowCloneAsset` e
`rulingGrayStripAsset`; sem eles, a interface usa marcadores CSS. A agulha atual fica à frente
quando coincide com a antiga. As marcas são visuais; a trajetória continua
usando a mira e a força atuais.
