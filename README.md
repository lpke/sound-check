# Sound Check

Simple Next.js app for testing browser audio inputs and outputs.

## Scripts

```bash
pnpm cert:phone
pnpm cert:phone:serve
pnpm dev
pnpm dev:phone
pnpm build
pnpm lint
pnpm format
```

## iPhone LAN Preview

The audio APIs used by this app require a secure browser context. `localhost`
works over HTTP, but `192.168.20.18` does not, so phone testing needs HTTPS.

Generate the local certificate:

```bash
pnpm cert:phone
```

Install the generated `certificates/rootCA.pem` on the iPhone. One quick way is:

```bash
pnpm cert:phone:serve
```

Then visit `http://192.168.20.18:8000/rootCA.pem` from Safari on the iPhone.
Install the downloaded profile from Settings > General > VPN & Device
Management, then enable it from Settings > General > About > Certificate Trust
Settings. Stop `pnpm cert:phone:serve` after the certificate is installed.

Run the HTTPS dev server:

```bash
pnpm dev:phone
```

Open `https://192.168.20.18:3000` on the iPhone.
