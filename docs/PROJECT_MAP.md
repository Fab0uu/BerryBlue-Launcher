# Cartographie du projet Eidolyth Launcher

## Vue d'ensemble

Eidolyth Launcher est une application Electron/Node basee sur Helios Launcher. Elle gere l'authentification Microsoft/Mojang, la recuperation de la distribution Eidolyth, la validation/telechargement des fichiers Minecraft, la configuration Java et le lancement du client modde.

## Points d'entree

- `package.json` : scripts npm, dependances Electron, version du launcher.
- `index.js` : processus principal Electron, fenetres, auto-update, auth Microsoft, IPC systeme.
- `app/app.ejs` et vues `app/*.ejs` : structure renderer.
- `app/assets/js/preloader.js` : charge la configuration, la distribution et nettoie les natives temporaires.
- `app/assets/js/scripts/landing.js` : flux principal de lancement, validation Java, telechargements, Discord RPC et etat UI.

## Modules applicatifs principaux

- `configmanager.js` : configuration persistante, chemins de donnees, comptes, Java, memoire et options de jeu.
- `distromanager.js` : acces a la distribution distante Eidolyth.
- `processbuilder.js` : construction des arguments JVM, classpath/module-path, extraction des natives et demarrage du processus Minecraft.
- `tests/linux/processbuilder.test.js` : tests Node ciblant les comportements Linux critiques de `processbuilder.js`.
- `authmanager.js` : flux Mojang/Microsoft et persistance des comptes.
- `dropinmodutil.js` : gestion des mods et shaderpacks ajoutes localement.
- `discordwrapper.js` / `discordconfig.js` : Discord Rich Presence optionnel et non bloquant.
- `langloader.js` et `app/assets/lang/*.toml` : internationalisation.

## Donnees et ressources

- `docs/sample_distribution.json` et `docs/distro.md` documentent le format de distribution.
- `libraries/java/PackXZExtract.jar` est inclus comme ressource externe de build.
- `app/assets/images`, `app/assets/fonts`, `app/assets/css` contiennent l'interface Eidolyth.
- Les donnees runtime du launcher vont dans le dossier utilisateur Electron, et les donnees jeu dans le dossier configure par `ConfigManager`.

## Build et publication

- `electron-builder.yml` pilote les artefacts Windows, macOS et Linux.
- `scripts/run-electron.js` lance Electron en developpement et neutralise les variables/sandbox qui cassent le demarrage Linux local.
- `scripts/verify-linux-artifacts.js` inspecte les artefacts Linux generes pour verifier les chemins installes, l'executable, le desktop file et les ressources critiques.
- Windows conserve NSIS x64.
- macOS conserve DMG x64.
- Linux cible AppImage, deb et rpm x64. Le script `dist:linux` force `productName=Eidolyth` pour eviter les espaces dans le chemin d'installation RPM/DEB, tandis que l'entree desktop garde le nom affiche `Eidolyth Launcher`.
- `.github/workflows/build.yml` execute lint puis builds Windows/macOS/Linux avec Node 20.

## Audit Linux

Compatibilites deja presentes ou renforcees :

- Chemins construits avec `path.join` dans les modules critiques.
- Separateur classpath `:` sous Linux via `ProcessBuilder.getClasspathSeparator()`.
- Java detecte via `helios-core` dans `JAVA_HOME`, `JRE_HOME`, `JDK_HOME`, `/usr/lib/jvm` et le runtime telecharge.
- JDK Linux telecharge via Adoptium/Corretto selon les options de distribution.
- Build repertoire Linux valide avec executable `eidolyth-launcher` et ressources embarquees.
- Demarrage developpement Linux passe les blocages `electron.exe`, `ELECTRON_RUN_AS_NODE` et `chrome-sandbox`; il requiert une session graphique pour ouvrir la fenetre.
- Extraction des natives rendue synchrone pour eviter une course avant le spawn JVM.
- Filtrage des natives 1.19+ par OS Mojang et architecture.
- Java executable verifie avant lancement et rendu executable sur Unix si necessaire.
- Discord RPC reste optionnel si Discord ou IPC n'est pas disponible.
- Suppression de fichiers via `shell.trashItem`, compatible Electron multiplateforme.

Points encore a valider sur machine Linux complete ou CI :

- Creation `.rpm` dans un environnement RPM natif. La sandbox locale atteint `rpmbuild`, mais echoue avec une liste de fichiers fantome; la CI Ubuntu installe `rpm` hors sandbox pour couvrir ce point.
- Lancement reel Minecraft avec natives Linux et modpack Eidolyth courant.
- Auth Microsoft dans une session desktop Linux avec navigateur/fenetre Electron.
- Auto-update AppImage via `latest-linux.yml`.

## Commandes de validation

```bash
npm run lint
npm run test:linux
npm run dist:linux
npm run verify:linux-artifacts
npm run dist:win
npm run dist:mac
```

Dans l'environnement Codex Flatpak actuel, Node/npm hote n'est pas fiable via `flatpak-spawn`; les validations locales ont ete executees avec un Node 20 portable dans `/tmp`.
