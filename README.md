# Eidolyth Launcher

Launcher Electron dedie au serveur Minecraft **Eidolyth**.

Ce projet est base sur [Helios Launcher](https://github.com/dscalzi/HeliosLauncher) et adapte pour la distribution, l'authentification, l'interface et le flux de lancement propres a l'ecosysteme Eidolyth.

## Apercu

Eidolyth Launcher simplifie l'acces au serveur et a son modpack en gerant automatiquement :

- la recuperation de la distribution du launcher
- la verification et le telechargement des fichiers du jeu
- le lancement de Minecraft avec la configuration Eidolyth
- l'autoconnect au serveur
- la gestion des comptes Microsoft

## Fonctionnalites

- Interface personnalisee pour Eidolyth
- Verification et mise a jour automatiques des fichiers
- Gestion du modpack et des bibliotheques via la distribution
- Parametres Java et allocation memoire configurables
- Journalisation integree pour le diagnostic
- Build Windows via `electron-builder`

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

### Lint

```bash
npm run lint
```

## Build

### Build Windows

```bash
npm run dist:win
```

Le setup genere se trouve dans `dist/`.

## Configuration principale

- Distribution distante : `https://api.eidolyth.fr/NeoNebula/root/distribution.json`
- Statut serveur : `https://eidolyth.fr/status.json`

## Credits

- Base du projet : Helios Launcher par Daniel Scalzi
- Adaptation Eidolyth : Fabrice Lozac'h et contributeurs du projet
