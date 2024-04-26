# ROAR Dashboard

This web app serves as the participant and administrator dashboard for the Rapid
Online Assessment of Reading (ROAR) platform.

If you would like to contribute to this project, please read the [contribution guide](.github/CONTRIBUTING.md).

## NPM Scripts

The `npm run dev` and `npm run build` scripts have variants that define which
data source the dashboard will use. Scripts ending in `:live` will use
production data, while scripts ending in `:sandbox` will use development data:

- `npm run dev` starts a development server using sandbox data.
- `npm run dev:live` starts a development server using live data.
- `npm run build` builds the project using live data.
- `npm run build:sandbox` builds the project using sandbox data.

## Data Flow Diagram

See the [ROAR/ROAD Data Flow Diagram here](https://miro.com/app/board/uXjVNY-_qDA=/?share_link_id=967374624080).
