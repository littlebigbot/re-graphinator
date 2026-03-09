# Re-Graphinator

A filmography overlap visualiser. Search for two or more people or titles, hit Compare, and see where their credits intersect on an interactive Venn diagram. Click a region to filter the results grid to that overlap.

Supports up to 6 subjects simultaneously. Works in both directions — find films that share cast/crew, or find cast/crew that share films.

## Setup

**Prerequisites:** Node.js 18+, [corepack](https://nodejs.org/api/corepack.html) enabled.

```sh
corepack enable
```

**1. Get a TMDB API key**

Create a free account at [themoviedb.org](https://www.themoviedb.org/), then generate an API key under Settings → API.

**2. Clone and install**

```sh
git clone git@github.com:littlebigbot/re-graphinator.git
cd re-graphinator
yarn install
```

**3. Configure environment**

```sh
cp .env.example .env
```

Open `.env` and replace `your_tmdb_api_key_here` with your key.

**4. Run**

```sh
yarn dev
```

App runs at `http://localhost:5173`.

## Stack

- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vitejs.dev/)
- [D3](https://d3js.org/) for the Venn diagram
- [TMDB API](https://developer.themoviedb.org/docs) for film/TV data
