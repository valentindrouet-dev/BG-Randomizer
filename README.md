# 🎲 Roulette à jeux

Une petite appli iPhone (web app installable) qui tire au sort un jeu de société
dans ta collection [BoardGameGeek](https://boardgamegeek.com) selon tes critères.

- **Critères** : nombre de joueurs, durée, joué récemment / pas récemment / jamais,
  complexité, style (stratégie, famille, ambiance, coop, thème, cartes, abstrait, enfants).
- **Roulette** : choix n°1 en gros, choix n°2 en dessous.
- **BGG** : récupère les jeux possédés et les parties enregistrées (*Logged Plays*)
  pour savoir ce qui a été joué récemment.
- **« On y joue ! »** note la partie dans l'appli (jusqu'à la prochaine synchro BGG).
- Fonctionne hors ligne une fois la collection synchronisée.

Pas de compilation : du HTML/CSS/JS pur.

## 1. Mettre l'appli en ligne (GitHub Pages)

1. Fusionner cette branche dans `main`.
2. Sur GitHub : **Settings → Pages → Build and deployment → Deploy from a branch**,
   branche `main`, dossier `/ (root)`.
3. L'appli sera sur `https://<ton-compte>.github.io/BG-Randomizer/`.

## 2. L'installer sur l'iPhone

Ouvrir l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
L'appli s'ouvre alors en plein écran, comme une vraie appli.

## 3. Brancher BoardGameGeek

Dans l'appli : ⚙️ → **Pseudo BGG** → **Synchroniser**.

Depuis 2025, l'API XML de BGG demande un **jeton d'application**
(à créer sur <https://boardgamegeek.com/applications>). Deux façons de le fournir :

### Option A — via le proxy (recommandé)

Le navigateur ne peut pas toujours lire les réponses de BGG directement (CORS).
Le dossier [`proxy/`](proxy/) contient un mini relais Cloudflare Worker (gratuit)
qui ajoute le jeton et les en-têtes nécessaires :

```sh
cd proxy
npx wrangler login
npx wrangler secret put BGG_TOKEN   # colle ton jeton BGG
npx wrangler deploy                 # affiche l'URL, ex. https://bgg-proxy.xxx.workers.dev
```

Puis dans l'appli : ⚙️ → **🔑 Accès API** → **Proxy** = l'URL du worker.

Le relais n'accepte que les trois appels utilisés par l'appli (`collection`, `plays`, `thing`).
Pour le réserver à ton appli, décommente `ALLOWED_ORIGIN` dans `proxy/wrangler.toml`.

### Option B — jeton direct

Laisser **Proxy** vide et coller le jeton dans **Jeton BGG**. Ça ne marche que si
BGG autorise les appels depuis le navigateur ; sinon l'appli affiche
« Connexion bloquée » et il faut passer par le proxy.

Le jeton reste stocké uniquement sur ton téléphone.

## Essayer sans BGG

⚙️ → **🎁 Jeux exemples** charge 16 jeux connus pour tester la roulette.

## Détails des critères

| Critère | Règle |
|---|---|
| 👥 Joueurs | le nombre choisi est dans la fourchette min–max du jeu (6+ = jusqu'à 6 ou plus) |
| ⏱️ Durée | durée BGG : ≤ 30 min, ≤ 1 h, ≤ 2 h, plus de 2 h |
| 📅 Récent | joué dans les 30 derniers jours ; *Pas récent* = pas depuis 30 jours ; *Jamais* = aucune partie |
| 🧠 Complexité | poids BGG : < 2 léger, 2–3 moyen, > 3 costaud |
| 🎭 Style | familles de classement, catégories et mécaniques BGG (plusieurs choix = l'un ou l'autre) |

Les dernières parties sont lues sur les 500 parties les plus récentes enregistrées sur BGG.
