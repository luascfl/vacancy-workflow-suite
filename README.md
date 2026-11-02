# Vacancy Workflow Suite

A manual userscript conversion of the selected Automa vacancy workflows. It works only on the platform page the user has opened. CIEE route filters and the ISBET Apprenticeship filter run once on their supported vacancy pages; it never starts applications, appointments, sign-ins, or sheet writes by itself.

## Source workflow matrix

| Source workflow | Automa ID | Panel command or trigger | Behaviour preserved |
| --- | --- | --- | --- |
| CIEE internship | `15VkhkVawt0wNn3QFh5l8` | Automatic page filter | Runs only on the CIEE internship route. It fills Salvador, selects the rendered `Salvador - BA` source suggestion, applies it, waits for results, loads source result pages, and extracts `codigoVaga` from `a.vaga-row`/`.btn-view-vaga-detail`. |
| CIEE apprenticeship | `5liJHVLno0Egu6wS_bxpz` | Automatic page filter | Runs only on the CIEE apprenticeship route and preserves its source URL. |
| CIEE scheduling check | `w5_3hT16UMxcm85-SUJ1K` | **Inspect internship sources** / **Inspect apprenticeship sources** / **Confirm vacancy interest** | Reads only the authorized `alertasCiee` D-column range for the selected kind, shows source links, and identifies login, calendar, application, or interest state on the currently rendered page. |
| ISBET | `CTlt7KktrAUhC_la9zSX6` | **Apprenticeship** / **Internship** | The panel presents two filter buttons for Salvador, BA. Each selects the source vacancy type, then BA, waits for the state-dependent Salvador option (`2162`), and applies the filter. The selected button changes only after rendered results confirm success. |
| Start Carreiras | `LBmhZ6LbUrNEXRL1oXY3o` | **Save vacancies** | Reads only an already rendered `tbody.MuiTableBody-root > tr`; opens the row share control and reads its clipboard URL. A denied clipboard permission is an explicit failure, never a guessed link. |
| IEL apprenticeship | `fd9eRCVe-oLyxG2TZIf9f` | **Filter apprenticeships** | Sets category `1`, Salvador, PCD `1`, runs the source search, and waits for results. |
| IEL internship | `hs13F0ymRT4tl67F9TkiM` | **Filter internships** | Sets Salvador, Psicologia, PCD `1`, runs the source search, and waits for results. |
| IEL vacancy link | `w5gObXeqGAuCmrrDXsw3S` | **Rebuild vacancy links** | Rebuilds only source titles matching `#ID - title` from `#grid` or `.detalhe.resultados` as `Login/Vaga?id=…` links. |
| ESPRO TAQE | `wo3xxsyRKsc6akV8-9Eky` | **Filter Salvador** | Fills Salvador and uses the source search control. Saving extracts only cards with a source `Saiba mais` link. |

## Install and configure

1. Install `vacancy-workflow-suite.user.js` in Violentmonkey or Tampermonkey.
2. On a supported platform, a compact floating **Vacancy tools** panel appears automatically. It starts expanded, is constrained to the viewport, and its header control minimizes or restores the tool content.
3. On ISBET, **Apprenticeship** and **Internship** are short filter controls for Salvador, BA. Their selection state indicates a successfully rendered source filter, not a pending request.
4. **Save vacancies** is the primary explicit action. Settings, CIEE scheduling/interest inspection, and other secondary platform actions are grouped under **More tools**.
5. The userscript-manager menu includes **Open CIEE internship vacancies**, **Open CIEE apprenticeship vacancies**, **Open IEL Bahia vacancies**, **Open TAQE vacancies**, **Open ISBET vacancies**, and **Open Start Carreiras vacancies**. Each opens its platform in a new tab.
6. Choose **Settings** from the panel or **Configure Workflow Sheets Adapter** from the userscript menu.
7. Enter the adapter `/exec` URL and current access token. They remain in the userscript manager’s local storage and must not be published.
8. Choose whether to read authorized legacy platform sources before a save. This setting reads only permitted source keys/ranges, such as `alertasCiee` and `AlertasEstagio!A:A`; it never reads `alertasCentral`.

The adapter request format is `POST { operation, accessToken, … }`. Saving uses `appendVacancyAlert` and remains compatible with the central `Alertas capturados` sheet. Legacy reads use only the adapter’s `read` operation and configured `sheetKey`/`range` authorization.

## Automatic source filters

On page open, the suite runs one source filter only where the prior workflow did: the CIEE internship or apprenticeship route applies its matching Salvador filter, and the ISBET vacancy page applies the Salvador **Apprenticeship** filter. The ISBET button remains unselected until the filter completes successfully. While an ISBET filter runs, the two filter buttons are disabled so a manual click cannot overlap the automatic or in-progress filter.

A completed search with zero vacancies is valid: the chosen type remains selected and the other filter can still be used. The panel waits for ISBET's result announcement before changing the selected state and will not change the native filter controls while a previous search is still loading.

Automatic filtering does not save a vacancy, read scheduling sources, submit an application, mark interest, sign in, or write to a sheet.


## Saving and deduplication

**Save vacancies** is an explicit, confirmed action. It uses source-specific extractors, not generic `a[href]` collection. A local persistent key is scoped to platform and vacancy ID and is written only after the adapter responds with `{ ok: true }`. If legacy reads are enabled, rows already found in that authorized source are skipped too.

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

Start Carreiras now redirects its student portal to `estudante.vetto.ai`, so the userscript matches both hosts. The source graph contains authenticated, positional UI steps and private login inputs but no stable, named filter contract. This suite intentionally does not replay those credentials or guess the positional filters. After the user signs in and renders the source table, its exact row/share/clipboard extraction is fully available through the explicit save command.

## Permissions and browser requirements

- The Start action requires the browser clipboard-read permission after the user initiates the save action. Denial stops the operation without saving that row.
- CIEE, IEL, ISBET, and TAQE filters use DOM state waits. In particular, ISBET waits for the city option to become enabled after BA is selected.
- Platform sites can change their source markup. The suite fails explicitly instead of substituting navigation links or generic anchors for vacancies.

## Manual smoke scenario

Use the local DOM fixture supplied to the maintainer with the whole userscript installed. It covers navigation-versus-vacancy selectors, state/city dependency, ISBET E selection, Start clipboard success/denial, adapter success/failure deduplication, and partial-save reporting. Do not point a smoke run at a real logged-in account or production adapter.
