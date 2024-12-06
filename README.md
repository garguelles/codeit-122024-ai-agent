# Onchain AI Prototype


### API

```
$ cd api
$ deno install --allow-scripts
$ deno run --allow-read --allow-ffi --allow-env --allow-net --env-file --allow-write main.ts
```

- Setup .env
```
CDP_API_KEY_NAME="cdp-api-key"
CDP_API_KEY_PRIVATE_KEY="cdp-api-key-private-key"
ANTHROPIC_API_KEY="anthropic-api-key" # or OPEN_AI_KEY
NETWORK_ID="base-sepolia"
```

### Web

```
$ cd web
$ bun i
$ bun dev
```
