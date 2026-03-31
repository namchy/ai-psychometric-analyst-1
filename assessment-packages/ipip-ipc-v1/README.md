# IPIP-IPC v1 Package Scope

Ovaj folder trenutno nije puni assessment content package.

Namjena u trenutnoj fazi:

- import test-specific `prompt_versions` zapisa za `ipip-ipc-v1`
- import `prompt_version_localizations` za participant i HR audience
- podrška postojećem IPC runtime report generation hookup-u

Šta ovaj package trenutno namjerno **ne** predstavlja:

- završen katalog IPC dimenzija
- završen katalog IPC pitanja
- završen katalog IPC answer option sadržaja
- gotov assessment sadržaj spreman za puni candidate flow

Zbog toga su trenutno prazni:

- `dimensions.json`
- `items.json`
- `options.json`
- `locales/bs/questions.json`
- `locales/hr/questions.json`
- `locales/bs/options.json`
- `locales/hr/options.json`

To je svjesno privremeno stanje kako bi prompt/runtime sloj bio stvaran i importabilan bez lažne poruke da je IPC assessment content već implementiran.

Kasniji korak:

- zamijeniti ovaj bootstrap package punim `ipip-ipc-v1` content package-om
- popuniti stvarne oktante, item bank, skalu odgovora i lokalizacije
- zadržati ili prilagoditi postojeće IPC prompt definitions po potrebi
