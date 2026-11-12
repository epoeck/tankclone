# Projéteis e sons da referência

A bola 3 (avião do item F) e as bolas 101/111 (Prisma), 381/391 (Marreta) e 161/171 (Fornalha) usam
as bibliotecas convertidas localmente do cliente Flash do DDTank Reborn. O
clone consultado corresponde à revisão `dab2b445f153a6852b48182d4afe5c43ebbe3e16`;
os arquivos convertidos são produtos locais do `swf-export`, não um compromisso
de que os binários gerados estejam versionados nessa revisão. Os hashes de cada
arquivo importado estão em `packages/client/public/projectiles/manifest.json`.
A redistribuição destes recursos de referência está sujeita aos direitos de seus
respectivos titulares; os avisos do Reborn estão em `third_party/ddtank-reborn`.

Para reproduzir com um clone local com os recursos convertidos disponíveis:

```sh
python scripts/import-projectiles.py /caminho/ddtank-reborn
```

O importador copia os `library.json` e suas imagens de formas, sem executar
código externo. A biblioteca `blastoutN` exporta `bulletN` (voo), enquanto
`bulletN` exporta `blastOutMovieN` (impacto). As linhas do tempo usam os 24 ou
25 quadros por segundo declarados em cada biblioteca. Os sons são selecionados
pelos campos `ShootSound` e `BombSound` do seed `Ball.json.gz`, cujo hash está
no manifesto. São respectivamente 023/087, 069/088, 116/107, 113/105,
025/087 e 083/088, na ordem das bolas acima.

`/effects.html` no servidor de desenvolvimento mostra os seis voos e impactos;
clique na metade esquerda ou direita de uma linha para ouvir tiro ou impacto.
O renderer Canvas reproduz formas, matrizes, profundidade e multiplicador de
alfa. Não é um runtime Flash completo: não implementa filtros nem transformações
RGB; estas bibliotecas só apresentam duas transformações de cor, ambas alfa no
impacto 391, e não apresentam campos de filtro nas operações exportadas. As formas dos rastros usam os emissores 1, 2, 7, 8, 27 e 26 do `partical.xml`,
com os intervalos e vidas originais; os índices `displayCreator` foram mapeados
pela lista `ParticalShapLib.data` do `shape.swf` (índices 12/24/214/215/43/44
para classes 13/25/220/221/44/45). A emissão interpola a trajetória amostrada e usa os parâmetros de velocidade,
movimento, peso, rotação, tamanho e as curvas de alfa, tamanho e cor do XML,
avaliados em passos visuais de 40 ms conforme `ParticleEnginee`/`Particle`.
O gerador aleatório visual é determinístico por emissão, portanto não replica a
sequência aleatória nem a cadência de quadros específica de uma sessão Flash.
A interpolação da trajetória e o recorte de formas coloridas em uma tela de
256 × 256 px também podem produzir diferenças na comparação quadro a quadro.

O avião usa `bullet3` (voo) e `blastOutMovie3` (impacto), sem rastro
`FlyingPartical` no seed Ball. Seus sons são 023 no lançamento e 096 no
impacto; o último foi decodificado do FLV/Nellymoser para WAV PCM pelo ffmpeg
do clone (ou o ffmpeg do PATH). O manifesto registra os hashes do arquivo de
origem e do resultado. A prévia inclui o avião na última linha.
