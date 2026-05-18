# 🚀 Eidolyth Launcher 2.0.2

Une nouvelle mise à jour du launcher est disponible !

Cette version apporte une **refonte graphique complète** du launcher, tout en améliorant la **stabilité**, la **compatibilité du modpack** et la fiabilité générale du lancement. ✨

## 🔥 Points forts

- 🎨 **Refonte graphique complète** du launcher avec une interface modernisée, plus propre et plus cohérente avec l'identité visuelle d'Eidolyth.
- 🧩 **Correction d'un problème de compatibilité** avec certains mods et content packs NeoForge/Forge qui avaient besoin d'être présents physiquement dans le dossier `mods` au runtime.
- 📦 Les mods Forge activés sont maintenant **préparés automatiquement dans `instance/mods`** avant le lancement, tout en conservant le chargement standard via `forgeMods.list`.
- 🧹 Réactivation du nettoyage des vrais drop-in mods utilisateur pour garder une instance propre et éviter les conflits parasites.
- 🪵 Ajout de logs plus explicites pour suivre les mods préparés automatiquement par le launcher avant le démarrage.

## ⚡ Améliorations

- Mise à jour de la source du statut serveur vers `https://eidolyth.fr/status.json`
- Adaptation du parsing du statut serveur au nouveau format de réponse
- Mise à jour du branding et de la documentation vers **Eidolyth Launcher**
- Correction du packaging Windows pour garantir une meilleure cohérence avec le système d'auto-update

## 📋 Résumé de la version

| Version | Domaine | Détail |
| --- | --- | --- |
| `2.0.2` | Interface | Refonte graphique complète du launcher |
| `2.0.2` | Compatibilité | Correction du chargement de mods/content packs sensibles au dossier `mods` |
| `2.0.2` | Lancement | Staging automatique des mods Forge gérés par le launcher |
| `2.0.2` | Diagnostic | Logs de lancement plus clairs pour le staging des mods |
| `2.0.2` | Maintenance | README, branding et export Windows mis à jour |

## 📦 Téléchargements

| Plateforme | Architecture | Fichier |
| --- | --- | --- |
| Windows | x64 | `Eidolyth-Launcher-setup-2.0.2.exe` |

## ℹ️ Notes importantes

- Cette version vise avant tout à fiabiliser le lancement du client sur le modpack Eidolyth.
- Les mods ajoutés manuellement dans `instance/mods` ne sont pas conservés s'ils ne font pas partie des mods gérés par la distribution du launcher.
- Pour l'auto-update Windows, il faut publier ensemble :
  `Eidolyth-Launcher-setup-2.0.2.exe`, `Eidolyth-Launcher-setup-2.0.2.exe.blockmap` et `latest.yml`.

## ❤️ Merci

Merci pour les retours et les tests effectués sur cette version. Ils ont permis d'isoler et de corriger un problème de chargement assez discret, mais important pour la compatibilité du client.

**Full Changelog:** `v2.0.1...v2.0.2`
