# Vacancy Workflow Suite

A manual userscript conversion of the selected Automa vacancy workflows. It works only on the platform page the user has opened and never starts searches, applications, appointments, sign-ins, or sheet writes by itself.

## Source workflow matrix

| Source workflow | Automa ID | Manual command | Behaviour preserved |
| --- | --- | --- | --- |
| CIEE internship | `15VkhkVawt0wNn3QFh5l8` | **Apply CIEE internship filter** | Runs only on the CIEE internship route. It fills Salvador, selects the rendered `Salvador - BA` source suggestion, applies it, waits for results, loads source result pages, and extracts `codigoVaga` from `a.vaga-row`/`.btn-view-vaga-detail`. |
| CIEE apprenticeship | `5liJHVLno0Egu6wS_bxpz` | **Apply CIEE apprenticeship filter** | Runs only on the CIEE apprenticeship route and preserves its source URL. |
| CIEE scheduling check | `w5_3hT16UMxcm85-SUJ1K` | **Inspect CIEE … scheduling sources** / **Confirm interest …** | Reads only the authorized `alertasCiee` D-column range for the selected kind, shows source links, and identifies login, calendar, application, or interest state on the currently rendered page. |
| ISBET | `CTlt7KktrAUhC_la9zSX6` | **Apply ISBET apprenticeship filter** / **Apply ISBET internship filter** | Selects J or E, then BA, waits for the state-dependent Salvador option (`2162`), applies the filter, and extracts only `div#api > div a[data-href]` source rows. |
| Start Carreiras | `LBmhZ6LbUrNEXRL1oXY3o` | **Save rendered vacancies to central** | Reads only an already rendered `tbody.MuiTableBody-root > tr`; opens the row share control and reads its clipboard URL. A denied clipboard permission is an explicit failure, never a guessed link. |
| IEL apprenticeship | `fd9eRCVe-oLyxG2TZIf9f` | **Apply IEL apprenticeship filter** | Sets category `1`, Salvador, PCD `1`, runs the source search, and waits for results. |
| IEL internship | `hs13F0ymRT4tl67F9TkiM` | **Apply IEL internship filter** | Sets Salvador, Psicologia, PCD `1`, runs the source search, and waits for results. |
| IEL vacancy link | `w5gObXeqGAuCmrrDXsw3S` | **Rebuild IEL Login/Vaga links** | Rebuilds only source titles matching `#ID - title` from `#grid` or `.detalhe.resultados` as `Login/Vaga?id=…` links. |
| ESPRO TAQE | `wo3xxsyRKsc6akV8-9Eky` | **Apply TAQE Salvador filter** | Fills Salvador and uses the source search control. Saving extracts only cards with a source `Saiba mais` link. |

## Install and configure

1. Install `vacancy-workflow-suite.user.js` in Violentmonkey or Tampermonkey.
2. On a supported platform, open **Configure Workflow Sheets Adapter** from the userscript menu or panel.
3. Enter the adapter `/exec` URL and current access token. They remain in the userscript manager’s local storage and must not be published.
4. Choose whether to read authorized legacy platform sources before a save. This setting reads only permitted source keys/ranges, such as `alertasCiee` and `AlertasEstagio!A:A`; it never reads `alertasCentral`.

The adapter request format is `POST { operation, accessToken, … }`. Saving uses `appendVacancyAlert` and remains compatible with the central `Alertas capturados` sheet. Legacy reads use only the adapter’s `read` operation and configured `sheetKey`/`range` authorization.

## Saving and deduplication

**Save rendered vacancies to central** is an explicit, confirmed action. It uses source-specific extractors, not generic `a[href]` collection. A local persistent key is scoped to platform and vacancy ID and is written only after the adapter responds with `{ ok: true }`. If legacy reads are enabled, rows already found in that authorized source are skipped too.

Only one save can run at a time. If an adapter response fails after earlier rows succeeded, the panel reports the precise partial count and the unsaved row remains eligible for a later retry.

## CIEE scheduling boundary

The original scheduling graph can inspect source links and detect login, calendar, application, or interest controls, but it provides no authoritative time-slot selection, final confirmation, or success signal. The suite therefore:

- does **not** bypass login;
- does **not** select or invent an appointment time;
- does **not** click the application control;
- requires a separate confirmation for the single currently rendered vacancy before clicking `a.link-interesse`; and
- reports that click as a request only, not as successful interest or scheduling.

Open a displayed source link yourself, log in yourself when required, then inspect the rendered page again. No account mutation occurs merely by installing, opening, filtering, inspecting, or saving alerts.

## Start Carreiras source boundary

The source graph contains authenticated, positional UI steps and private login inputs but no stable, named filter contract. This suite intentionally does not replay those credentials or guess the positional filters. After the user signs in and renders the source table, its exact row/share/clipboard extraction is fully available through the explicit save command.

## Permissions and browser requirements

- The Start action requires the browser clipboard-read permission after the user initiates the save action. Denial stops the operation without saving that row.
- CIEE, IEL, ISBET, and TAQE filters use DOM state waits. In particular, ISBET waits for the city option to become enabled after BA is selected.
- Platform sites can change their source markup. The suite fails explicitly instead of substituting navigation links or generic anchors for vacancies.

## Manual smoke scenario

Use the local DOM fixture supplied to the maintainer with the whole userscript installed. It covers navigation-versus-vacancy selectors, state/city dependency, ISBET E selection, Start clipboard success/denial, adapter success/failure deduplication, and partial-save reporting. Do not point a smoke run at a real logged-in account or production adapter.
