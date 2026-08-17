# Eidolyth Launcher

Launcher Electron dedie au serveur Minecraft **Eidolyth**.

Ce projet est base sur [Helios Launcher](https://github.com/dscalzi/HeliosLauncher) et adapte pour la distribution, l'authentification, l'interface et le flux de lancement propres a l'ecosysteme Eidolyth.

## Apercu

Eidolyth Launcher simplifie l'acces au serveur et a son modpack en gerant automatiquement :

- la recuperation de la distribution du launcher
- la verification et le telechargement des fichiers du jeu
- le lancement de Minecraft avec la configuration Eidolyth
- la gestion des comptes Microsoft

## Fonctionnalites

- Interface personnalisee pour Eidolyth
- Verification et mise a jour automatiques des fichiers
- Gestion du modpack et des bibliotheques via la distribution
- Parametres Java et allocation memoire configurables
- Journalisation integree pour le diagnostic
- Builds Windows, macOS et Linux via `electron-builder`

## Gatekeeper

Avant chaque lancement, le launcher authentifie le compte auprès de `https://api.eidolyth.fr/gatekeeper/v1`, obtient une session Gatekeeper et la transmet au mod client par un fichier temporaire privé. Le fichier est supprimé dès sa lecture et aucun jeton n'est écrit dans les journaux de lancement.

Le heartbeat envoyé pendant l'exécution sert uniquement au suivi d'activité : une interruption réseau ne fait pas expirer Minecraft et ne force jamais le joueur à redémarrer son jeu. La session est révoquée lorsque le processus Minecraft se ferme normalement. L'endpoint de production est fixé à `api.eidolyth.fr` ; les tests peuvent injecter une adresse locale sans modifier le comportement distribué.

## Particularites du chargement des mods

Pour les versions NeoForge/Forge recentes, le launcher :

- construit `forgeMods.list`
- lance le jeu avec `--fml.modLists`
- materialise aussi les mods Forge actives dans `instance/mods`

Ce double mecanisme ameliore la compatibilite avec certains mods ou content packs qui attendent une presence physique dans `mods/` au runtime.

## Developpement

### Prerequis

- Node.js 20
- npm 11

### Installation

```bash
npm install
```

### Lancement en developpement

```bash
npm start
```

Le script de demarrage nettoie les variables Electron heritees de certains environnements sandbox et contourne le `chrome-sandbox` local non setuid sur Linux. Il faut tout de meme lancer cette commande depuis une session graphique avec `DISPLAY` ou Wayland disponible.

### Lint

```bash
npm run lint
```

### Tests Linux cibles

```bash
npm run test:linux
```

Ces tests verrouillent les comportements Linux critiques du lancement Minecraft : executable Java, separateur classpath, filtrage/extraction des natives et resolution des bibliotheques de sous-modules.

### Verification des artefacts Linux

```bash
npm run verify:linux-artifacts
```

Cette verification inspecte le contenu des artefacts Linux generes. En environnement local sans RPM fonctionnel, utiliser `npm run verify:linux-artifacts -- --allow-missing-rpm` apres avoir genere au moins l'AppImage et le `.deb`.

## Build

### Build Windows

```bash
npm run dist:win
```

### Build macOS

```bash
npm run dist:mac
```

### Build Linux

```bash
npm run dist:linux
```

Le build Linux produit un `AppImage`, un paquet `.deb` et un paquet `.rpm` x64 dans `dist/`.

#### Notes Linux

- Le launcher cible les distributions desktop x64 courantes : Ubuntu/Debian, Fedora, Arch/Manjaro et derivees.
- Le script `dist:linux` force un nom produit interne sans espace pour obtenir des chemins de paquet stables sous `/opt/Eidolyth`, tout en gardant le nom affiche `Eidolyth Launcher`.
- Le JDK compatible est detecte via `JAVA_HOME`, `JRE_HOME`, `JDK_HOME`, `/usr/lib/jvm` ou le runtime telecharge par le launcher.
- Si aucun JDK compatible n'est trouve, le launcher telecharge et extrait automatiquement un JDK dans le dossier de donnees Eidolyth.
- L'AppImage peut necessiter FUSE selon la distribution. Si FUSE n'est pas disponible, utiliser le paquet `.deb` ou `.rpm` adapte.
- Les integrations optionnelles comme Discord Rich Presence restent non bloquantes si le client Discord ou son IPC n'est pas disponible.

Les artefacts generes se trouvent dans `dist/`.

## Configuration principale

- Distribution distante : `https://api.eidolyth.fr/NeoNebula/root/distribution.json`
- Statut serveur : `https://api.eidolyth.fr/status/minecraft/status.json`

## Credits

- Base du projet : Helios Launcher par Daniel Scalzi
- Adaptation Eidolyth : Fabrice Lozac'h et contributeurs du projet
