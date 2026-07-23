# Deploying for free (plain-English guide)

The app is one Node process that serves everything — website + API — with
`node server/dist/index.js`. Two free paths:

- **Render free tier (easiest, no card, no server)** — runs the app in
  *shared-passcode mode*: one office passcode instead of individual
  accounts, no OTP emails, headers shared and seeded from a setting,
  50 MB upload cap. See "Deploying on Render" just below.
- **Oracle Cloud Always Free (a real server, all features intact)** —
  individual accounts, OTP reset, per-user headers, 200 MB uploads.
  Needs a card for identity verification. See Part 1 onwards.

---

## Deploying on Render (free, no card) — shared-passcode mode

What you give up vs. the full version: personal logins (everyone shares
one passcode), OTP password reset, per-user header lists (one shared
list; edits made in the UI reset to the DEFAULT_HEADERS setting whenever
the service restarts). What you keep: all splitting features, previews,
exclusions, ZIPs, 10-minute auto-expiry, HTTPS. Free-tier behavior: the
app sleeps after ~15 idle minutes and takes ~1 minute to wake for the
next visitor.

1. **Put the code on GitHub** (Render deploys from a Git repository):
   create a GitHub account if needed, then a new **private** repository
   named `pdf-splitter`, then from your Mac:

   ```bash
   cd ~/Desktop/PDF_Splitter
   git remote add origin https://github.com/YOURNAME/pdf-splitter.git
   git push -u origin main
   ```

   (The repo is already initialized and committed locally; secrets like
   users.json/smtp.json are gitignored.)

2. **Create the Render service:** sign up free at render.com (GitHub
   login, no card) → **New → Blueprint** → connect your `pdf-splitter`
   repository. Render reads `render.yaml` and pre-fills everything.

3. **Set the passcode:** when prompted for `ACCESS_PASSCODE`, type the
   office passcode (at least 6 characters — longer is better, e.g.
   `courtsplit2026!`). This is what staff will enter to use the site.

4. Click **Apply/Deploy** and wait ~3 minutes. Your site is live at
   `https://pdf-splitter-XXXX.onrender.com` — HTTPS included, no domain
   or Caddy needed.

5. **Changing things later** (all in the Render dashboard → Environment):
   - Change the passcode: edit `ACCESS_PASSCODE`, save (auto-redeploys).
   - Change the office's standard header list: add a `DEFAULT_HEADERS`
     env var, pipe-separated (e.g. `L I R|CC NI ACT|CT CASES, CC NI ACT`).
     Without it, the full built-in default list applies.
   - Updating the app: `git push` from your Mac — Render redeploys
     automatically.

To later "upgrade" to the full-featured version on a real server, deploy
the same code with `AUTH_MODE` unset (or `accounts`) — nothing to rebuild.

---

## Full-featured path: Oracle Cloud Always Free

---

## Part 1 — Get a free server (Oracle Cloud, ~20 minutes)

1. Go to **oracle.com/cloud/free** and click "Start for free".
2. Sign up. You'll need your email, phone, and a credit/debit card —
   the card is only for identity verification; Always Free resources
   never charge it. Pick **India (Mumbai)** as your home region.
3. In the Oracle console: **Compute → Instances → Create instance**.
   - Image: **Ubuntu 24.04**.
   - Shape: click "Change shape" → **Ampere / VM.Standard.A1.Flex**,
     set 2 CPUs and 12 GB RAM (all inside the free allowance).
     If Mumbai shows "out of capacity", retry later — or start with the
     always-available **VM.Standard.E2.1.Micro** (1 GB, fine to begin).
   - Download the **SSH private key** it offers you. Keep it safe.
4. Create the instance and note its **public IP address**.
5. Open the web ports: **Networking → Virtual Cloud Networks → (your
   VCN) → Security Lists → Default** → **Add Ingress Rules**:
   - Source `0.0.0.0/0`, protocol TCP, destination port `80`
   - Source `0.0.0.0/0`, protocol TCP, destination port `443`

## Part 2 — Get a free domain name (5 minutes)

1. Go to **duckdns.org**, sign in (Google/GitHub), and create a
   subdomain, e.g. `mycourtsplitter` → gives you
   `mycourtsplitter.duckdns.org`.
2. In the "current ip" box put your server's public IP and click update.

## Part 3 — Put the app on the server

From your Mac, in a terminal (replace the IP and key path):

```bash
# copy the project up (excluding node_modules)
rsync -av --exclude node_modules --exclude dist -e "ssh -i ~/path/to/oracle-key.key" \
  ~/Desktop/PDF_Splitter/ ubuntu@YOUR_SERVER_IP:~/pdf-splitter/

# log in to the server
ssh -i ~/path/to/oracle-key.key ubuntu@YOUR_SERVER_IP
```

On the server:

```bash
# 1. install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. build the app
cd ~/pdf-splitter
npm install
npm run build

# 3. open the local firewall (Ubuntu images from Oracle ship with iptables rules)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## Part 4 — Run it permanently (systemd service)

```bash
sudo tee /etc/systemd/system/pdf-splitter.service > /dev/null <<'EOF'
[Unit]
Description=Legal PDF Splitter
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/pdf-splitter
Environment=PORT=3001
Environment=SECURE_COOKIES=1
ExecStart=/usr/bin/node server/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now pdf-splitter
systemctl status pdf-splitter    # should say "active (running)"
```

`Restart=always` means if the app ever crashes, it restarts by itself.

## Part 5 — Free HTTPS (Caddy)

```bash
sudo apt-get install -y caddy

sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
mycourtsplitter.duckdns.org {
    reverse_proxy localhost:3001
    request_body {
        max_size 210MB
    }
}
EOF

sudo systemctl reload caddy
```

Caddy automatically fetches and renews a free HTTPS certificate. That's
it — open **https://mycourtsplitter.duckdns.org** and you should see the
sign-in page.

## Part 6 — Turn on OTP emails

On the server:

```bash
cp ~/pdf-splitter/server/config/smtp.example.json ~/pdf-splitter/server/config/smtp.json
nano ~/pdf-splitter/server/config/smtp.json   # put in your Gmail app password
sudo systemctl restart pdf-splitter
```

(Gmail app password: Google Account → Security → 2-Step Verification →
App passwords.)

## Updating the site later

From your Mac: rerun the `rsync` command, then on the server:

```bash
cd ~/pdf-splitter && npm install && npm run build && sudo systemctl restart pdf-splitter
```

## Backing up (do this occasionally)

Everything worth keeping lives in one folder. From your Mac:

```bash
scp -i ~/path/to/oracle-key.key -r ubuntu@YOUR_SERVER_IP:~/pdf-splitter/server/config ./backup-config
```

---

## Alternative: serving straight from your Mac

The Ubuntu commands above (apt-get, systemd, iptables, Caddy) are
Linux-only — do NOT type them on macOS. On the Mac the equivalents are:

### A. Office / same-Wi-Fi use (simplest)

```bash
cd ~/Desktop/PDF_Splitter
npm install && npm run build
node server/dist/index.js
```

Find your Mac's IP (System Settings → Wi-Fi → Details, e.g.
`192.168.1.42`) and colleagues on the same network open
`http://192.168.1.42:3001`. Notes:

- Keep the Mac awake: System Settings → Battery/Energy → prevent sleep,
  or run it as `caffeinate -s node server/dist/index.js`.
- Do not set `SECURE_COOKIES` here — this mode is plain HTTP, acceptable
  only on a trusted office network.
- To auto-restart on crashes/reboots, use pm2:

  ```bash
  npm install -g pm2
  pm2 start server/dist/index.js --name pdf-splitter
  pm2 save && pm2 startup   # follow the printed instruction once
  ```

### B. Public internet from the Mac (free quick tunnel)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3001
```

This prints a free public `https://something-random.trycloudflare.com`
address anyone can open — no account, no router setup, HTTPS included.
Set `SECURE_COOKIES=1` when running the app in this mode. Caveat: the
random URL changes every time the tunnel restarts, so this is for demos
and temporary use. For a permanent public address, use the Oracle setup
above (or a named Cloudflare Tunnel, which requires owning a domain).

### Why a Mac isn't a great permanent server for ~200 users

The site is only up while the laptop is on, awake, connected, and at
home/office — a closed lid takes the whole site down. Fine for testing,
demos, and small office use; for an always-on service, use the free
Oracle server above.

## Alternative: an office PC instead of Oracle (also free)

If an office computer can stay on during working hours, run Parts 3, 4
and 6 on it (skip Oracle entirely), then expose it with a free
**Cloudflare Tunnel** instead of Caddy — no router configuration, free
HTTPS, and the documents never leave the building. See
developers.cloudflare.com/cloudflare-one → Tunnels.
