# Third-party notices

DDTank Reborn reuses material from the projects below. Their original licenses and credits are kept here.

## SkelletonX/DDTank4.1 — https://github.com/SkelletonX/DDTank4.1

Used for: server/client source used as reference (PvE mission/NPC scripts, vendored as `vendor/DDTank4.1`),
PT-BR client language strings and translated client artwork (images imported into the client SWFs under
apps/api/assets/flash).

```
MIT License

Copyright (c) 2021 SkelletonX

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## yutikeyux/ddt-34-csharp — https://github.com/yutikeyux/ddt-34-csharp

Used for: 61 PvE mission scripts (`GameServerScript.AI.Messions.*`, ported into `packages/fight/src/pve/scripts/generated/Messions/`)
that exist in `Mission_Info` but had no C# in `vendor/DDTank41`/`vendor/DDTank4.1`/`vendor/DDT-6600` — see
`research/qa/mission-sources.md`.

```
MIT License

Copyright (c) 2017 Ilya Meyta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## dk-khoado/Gunny-3.0 — https://github.com/dk-khoado/Gunny-3.0

Used for: 3 PvE mission scripts (`Aiga4002`, `Aiga4003`, `DCSM4001`, ported into
`packages/fight/src/pve/scripts/generated/Messions/`) — see `research/qa/mission-sources.md`. No license file is
published in that repository (same status as `pnkl1999/DDTank41` below); credit to its authors.

## barrydevp/ddt3.4server — https://github.com/barrydevp/ddt3.4server
## barrydevp/ddt3.8 — https://github.com/barrydevp/ddt3.8

Used for: the 3 Forja › Forno screens that the Flash client ships (`store/equipGhost`, `store/fineStore`,
`FineBringUpController.as`) but that `vendor/DDTank41`/`vendor/DDT-6600` never implemented server-side
(confirmed in `research/qa/feature-sources.md`) — `EquipGhostHandler.cs`/`SpiritMgr.cs` (391 EQUIP_GHOST,
ported into `apps/game/src/handlers/forja/espirito-do-equipamento.ts`), `EquipBringUpHandler.cs` (308
EQUIP_BRING_UP, `aprimorar.ts`) and `FineStoreSuitHandler.cs` (295 STORE_FINE_SUIT, `refinar-conjunto.ts`).
Also the real seed data for `app."SpiritInfo"` (391's stat/level table — genuinely new, decoded from
`Tank.Request/spiritinfolist.xml`, see `packages/db/src/schema/app.ts`). 295's own data table turned out
to already exist in the original catalog (`game."Sets_Build_Temp"`, 70 real rows, byte-identical to the
fork's `Request/SetsBuildTemp.xml` — same data lineage, just never loaded by `apps/game`), so no credit
needed there beyond the handler logic itself. No license file is published in either repository (same
status as `pnkl1999/DDTank41` below); credit to its authors.

## pnkl1999/DDTank41 — https://github.com/pnkl1999/DDTank41

Used as the reference C# server, database schema and original Flash client the TypeScript port mirrors. No license file is
published in that repository; credit to its authors.

## tohru48/DDT-6600 — https://github.com/tohru48/DDT-6600

Used only as a reference for later-version behaviour. No license file is published in that repository; credit to its authors.

## Ruffle — https://ruffle.rs

The self-hosted Ruffle build in `apps/client-harness/public/ruffle/` (Flash Player emulator that runs the client
in the browser) is dual-licensed MIT / Apache-2.0; its license files ship next to it (`LICENSE_MIT`,
`LICENSE_APACHE`).

## DDTank

DDTank and its original client assets belong to their respective owners (7Road and licensed publishers). This is a
non-commercial fan project.
