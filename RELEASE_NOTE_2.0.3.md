# 🚀 Eidolyth Launcher - New Release

## [v2.0.3] - 2026-05-18

Une nouvelle version du launcher Eidolyth est disponible !

Cette mise à jour se concentre sur une **refonte visuelle premium**, une meilleure lisibilité de l'interface, une animation d'intro plus propre, et plusieurs corrections d'ergonomie sur les zones critiques du launcher.

## 🔥 Key Changes:

- **Refonte premium sci-fi du launcher**  
  L'interface principale a été retravaillée pour offrir un rendu plus propre, plus professionnel et plus cohérent avec l'identité Eidolyth.

- **Nouveau bouton Jouer**  
  Le CTA principal adopte maintenant un contour gradient premium, un état idle plus sobre, et un remplissage de progression plus net pendant le lancement.

- **Amélioration de l'animation d'intro**  
  Le logo disparaît maintenant de manière synchronisée avec le dernier wipe d'intro, pour un rendu plus fluide et plus maîtrisé.

- **Statut Mojang retravaillé**  
  Le statut Mojang se met désormais à jour automatiquement, sans attendre le survol. Le détail des services apparaît au hover dans un popup propre, positionné à gauche du curseur.

- **Progression et logs de lancement mieux intégrés**  
  La barre secondaire et les logs de lancement sont maintenant affichés directement dans l'encadré principal, afin de rester visibles pendant les phases de chargement.

- **Settings et pages internes nettoyés**  
  Les tailles, paddings, sliders RAM, pages Mods/Java/About et zones de navigation ont été ajustés pour réduire les problèmes de collapse et améliorer la lecture.

## ⚡ Improvements:

- Fond du launcher uniformisé pour éviter les bandes verticales et répétitions visibles.
- Réduction des effets visuels coûteux afin de limiter les ralentissements.
- Meilleure hiérarchie des colonnes landing : navigation, contenu central, compte/serveurs.
- Suppression du sélecteur serveur inutilisé sur la vue principale.
- Version et copyright regroupés dans la métadonnée basse du launcher.
- Logique d'update transférée sur l'encadré du logo en haut à gauche.
- Ajustements de placement du skin de compte.
- Amélioration des états online/offline/maintenance des serveurs.

## 📋 Release Summary

| Version | Area | Detail |
| --- | --- | --- |
| `2.0.3` | Interface | Refonte visuelle premium du launcher |
| `2.0.3` | Landing | Nouveau bouton Jouer et meilleure organisation des colonnes |
| `2.0.3` | Intro | Wipe du logo synchronisé avec le dernier volet |
| `2.0.3` | Services | Statut Mojang auto-refresh avec popup détaillé |
| `2.0.3` | Settings | Paddings, sliders RAM et pages Mods/Java/About retravaillés |
| `2.0.3` | Build | Export Windows x64 généré avec artefacts versionnés |

## 📦 Downloads:

| Platform | Architecture | Download Link |
| --- | --- | --- |
| Windows | x64 | `Eidolyth-Launcher-setup.exe` |

## ℹ️ Important Notes:

- Pour l'auto-update Windows, publier ensemble :
  - `Eidolyth-Launcher-setup.exe`
  - `Eidolyth-Launcher-setup.exe.blockmap`
  - `latest.yml`
- Cette version est centrée sur le front-end et l'expérience launcher. Les hooks et IDs consommés par les scripts existants ont été conservés.
- Les artefacts Windows gardent un nom stable afin de rester cohérents avec le système d'auto-update.

---

Merci pour les retours et les tests successifs sur l'interface. Cette version pose une base visuelle plus nette et plus durable pour les prochaines itérations du launcher Eidolyth.

**Full Changelog:** `v2.0.2...v2.0.3`
