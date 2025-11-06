// Requirements
const { URL }                 = require('url')
const {
    MojangRestAPI,
    getServerStatus
}                             = require('helios-core/mojang')
const {
    RestResponseStatus,
    isDisplayableError,
    validateLocalFile,
    getMojangOS,
    isLibraryCompatible
}                             = require('helios-core/common')
const {
    FullRepair,
    DistributionIndexProcessor,
    MojangIndexProcessor,
    downloadFile,
    downloadQueue,
    getExpectedDownloadSize,
    HashAlgo
}                             = require('helios-core/dl')
const {
    validateSelectedJvm,
    ensureJavaDirIsRoot,
    javaExecFromRoot,
    discoverBestJvmInstallation,
    latestOpenJDK,
    extractJdk
}                             = require('helios-core/java')

// Keep reference to Minecraft Process
let proc
// NOUVEAU : état runtime
let isLaunching = false        // true = on est en phase de lancement (bouton bloqué)
let gameIsRunning = false      // true = on pense que le jeu tourne déjà

// Is DiscordRPC enabled
let hasRPC = false

// Joined server regex
// Change this if your server uses something different.
const GAME_JOINED_REGEX = /\[.+\]: Sound engine started/
const GAME_LAUNCH_REGEX = /^\[.+\]: (?:MinecraftForge .+ Initialized|ModLauncher .+ starting: .+|Loading Minecraft .+ with Fabric Loader .+)$/
const MIN_LINGER = 5000

// Internal Requirements
const DiscordWrapper          = require('./assets/js/discordwrapper')
const ProcessBuilder          = require('./assets/js/processbuilder')
const DropinCleanerUtil       = require('./assets/js/dropinmodutil')
const fsExtra                 = require('fs-extra')
const nodePath                = require('path')

// Launch Elements
const launch_content          = document.getElementById('launch_content')
const launch_details          = document.getElementById('launch_details')
const launch_progress         = document.getElementById('launch_progress')
const launch_progress_label   = document.getElementById('launch_progress_label')
const launch_details_text     = document.getElementById('launch_details_text')
const server_selection_button = document.getElementById('server_selection_button') || { innerHTML: '', onclick: null, style: {} }
const user_text               = document.getElementById('user_text')

const loggerLanding = LoggerUtil.getLogger('Landing')

document.getElementById('main')?.style.setProperty('display','block','important');
document.getElementById('landingContainer')?.style.setProperty('display','block','important');


// === Intro launcher plan 1-2-3 ===
// 1) écran noir
// 2) slide plaque grise (révèle le logo déjà en place dans le menu) + zoom du logo 0.88 -> 1.00
// 3) second slide de la plaque pour révéler le reste du menu

(function(){
  const SWEEP_MS = 1200;   // durée slide-in
  const EXIT_MS  = 1400;    // durée slide-out
  const GAP_MS   = 900;    // delay before the main curtain leaves
  const LOGO_REVEAL_DELAY = 150;  // hold time before revealing the logo
  const LOGO_ZOOM_MS = 1100;
  const LOGO_FADE_MS = 3500; // fade-out duration for overlay logo
  const LOGO_FADE_DELAY_MS = 1500; // delay before starting the fade-out
  const LOGO_MARGIN = 36;         // padding around the logo curtain
  const START_DELAY = 120;
  const UNDERLAY_INITIAL_SCALE = 1; // CSS body[data-intro] #menuBgLogo scale
  // Simple sleep utility
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  // Promise resolving when distro loading is done (or after a fallback timeout)
  function waitForDistroReady(timeoutMs = 10000){
    return new Promise(async (resolve) => {
      try {
        const data = await DistroAPI.getDistribution()
        if (data) return resolve(true)
      } catch(e) { /* ignore */ }

      let settled = false
      const done = () => { if(!settled){ settled = true; resolve(true) } }
      const fail = () => { if(!settled){ settled = true; resolve(false) } }

      const onMsg = async (_, res) => {
        ipcRenderer.off('distributionIndexDone', onMsg)
        if(res){
          try {
            await DistroAPI.getDistribution()
            setTimeout(() => done(), 50)
          } catch(e){ done() }
        } else {
          fail()
        }
      }
      ipcRenderer.on('distributionIndexDone', onMsg)
      setTimeout(() => { if(!settled){ ipcRenderer.off('distributionIndexDone', onMsg); resolve(false) } }, timeoutMs)
    })
  }
async function runIntro(){
    const overlay = document.getElementById('introOverlay')
    const curtain = overlay ? overlay.querySelector('.curtain') : null
    const main    = document.getElementById('main')
    const loader  = document.getElementById('loadingContainer')
    const backdrop = document.getElementById('introBackdrop')
    const legacyCurtain = document.getElementById('introCurtain')
    const body    = document.body

    if(!overlay || !curtain || !main) return

    const menuLogo = document.getElementById('menuBgLogo')
    const logoWrapper = menuLogo ? menuLogo.parentElement : null
    const originalLogoZIndex = menuLogo ? (menuLogo.style.zIndex || '') : ''
    const originalLogoTransition = menuLogo ? (menuLogo.style.transition || '') : ''
    const originalWrapperZIndex = logoWrapper ? (logoWrapper.style.zIndex || '') : ''

    main.style.display = 'block'

    if(loader) loader.style.display = 'none'
    if(backdrop) backdrop.style.display = 'none'
    if(legacyCurtain) legacyCurtain.style.display = 'none'

    body.setAttribute('data-intro', '1')
    body.removeAttribute('data-intro-zoom')

    overlay.classList.remove('hide')
    overlay.classList.remove('show')
    curtain.style.animation = 'none'
    curtain.offsetHeight
    curtain.style.animation = ''

    const MAIN_CURTAIN_BG = curtain ? window.getComputedStyle(curtain).backgroundColor || '#2b2b2b' : '#2b2b2b'
    const LOGO_CURTAIN_BG = '#24202b' // distinct dark blue-grey for the first slide
    overlay.style.display = 'block'
    // Ensure initial paint matches the first slide color to avoid flash.
    overlay.style.background = LOGO_CURTAIN_BG
    if(curtain) curtain.style.zIndex = '2'
    let logoCurtain = null
    let logoCurtainMetrics = null
    let overlayLogo = null
    let overlayLogoInitialLeft = null
    let menuLogoInitialScale = 1

    const getCurrentScale = (el) => {
      try{
        const t = window.getComputedStyle(el).transform
        if(t && t !== 'none'){
          const m = t.match(/matrix\(([^)]+)\)/)
          if(m){
            const p = m[1].split(',').map(v => parseFloat(v.trim()))
            if(p.length >= 6){
              const a = p[0], b = p[1]
              const scale = Math.sqrt(a*a + b*b)
              return isFinite(scale) && scale > 0 ? scale : 1
            }
          }
        }
      }catch(e){}
      return 1
    }

    const prepareLogoCurtain = () => {
      if(!menuLogo) return null
      const rect = menuLogo.getBoundingClientRect()
      if(rect.width <= 0 || rect.height <= 0) return null

      const margin = LOGO_MARGIN
      // Full-screen first slide: present from the start, covering the entire view.
      const top = 0
      const finalLeft = 0
      const width = Math.ceil(window.innerWidth + margin * 2)
      const height = Math.ceil(window.innerHeight)
      const offscreenLeft = -width - margin

      const existing = document.getElementById('introLogoCurtain')
      if(existing) existing.remove()

      const panel = document.createElement('div')
      panel.id = 'introLogoCurtain'
      panel.className = 'logo-curtain'
      Object.assign(panel.style, {
        position: 'fixed',
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        left: `${finalLeft}px`,        // start already covering the screen
        background: LOGO_CURTAIN_BG,
        zIndex: '5',
        pointerEvents: 'none',
        transition: `left ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1)`
      })

      overlay.appendChild(panel)

      // No slide-in. It's already in place at left=0.

      return {
        panel,
        offscreenLeft
      }
    }

    // Create overlay copy of the logo so it can be shown before the menu.
    const prepareOverlayLogo = () => {
      if(!menuLogo) return null
      const rect = menuLogo.getBoundingClientRect()
      if(rect.width <= 0 || rect.height <= 0) return null
      const img = document.createElement('img')
      img.id = 'introOverlayLogo'
      img.className = 'intro-logo'
      img.src = menuLogo.currentSrc || menuLogo.src
        Object.assign(img.style, {
            position: 'fixed',
            left: `${rect.left}px`,
            top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: '3',
        pointerEvents: 'none',
        transformOrigin: 'center center',
        opacity: '1',
        transition: 'transform ' + LOGO_ZOOM_MS + 'ms ease, opacity ' + LOGO_FADE_MS + 'ms ease'
      })
      // Ensure zoom applies even if a CSS rule had !important previously.
      img.style.setProperty('transform', 'scale(1)', 'important')
      img.style.setProperty('will-change', 'transform')
        overlay.appendChild(img)
        overlayLogoInitialLeft = rect.left
        return img
    }

    if(menuLogo){
      const waitForLogoReady = () => {
        if(menuLogo.complete && menuLogo.naturalWidth > 0) return Promise.resolve()
        if(typeof menuLogo.decode === 'function'){
          return menuLogo.decode().catch(() => {})
        }
        return new Promise(resolve => {
          const done = () => {
            menuLogo.removeEventListener('load', done)
            menuLogo.removeEventListener('error', done)
            resolve()
          }
          menuLogo.addEventListener('load', done, { once: true })
          menuLogo.addEventListener('error', done, { once: true })
        })
      }

      try {
        await Promise.race([
          waitForLogoReady(),
          new Promise(resolve => setTimeout(resolve, 800))
        ])
      } catch {
        // ignore, the curtain keeps the flash hidden
      }

      // place overlay logo copy so it can be revealed first
      overlayLogo = prepareOverlayLogo()
      // Capture the menu logo's current scale BEFORE switching body attributes.
      menuLogoInitialScale = getCurrentScale(menuLogo) || 0.92

      const metrics = prepareLogoCurtain()
      if(metrics){
        logoCurtain = metrics.panel
        logoCurtainMetrics = metrics
      }
    }

    if(menuLogo && !logoCurtain){
      const metrics = prepareLogoCurtain()
      if(metrics){
        logoCurtain = metrics.panel
        logoCurtainMetrics = metrics
      }
    }

    // Do not animate the full-screen curtain in. Keep it covering the screen statically.
    // The first visible slide should be the small logo panel only.
    if(curtain){
      curtain.style.transform = 'translateX(0%)'
    }

    setTimeout(() => {
      const revealLogo = () => {
        if(menuLogo){
          menuLogo.style.transition = 'transform ' + LOGO_ZOOM_MS + 'ms ease'
        }
        body.setAttribute('data-intro-zoom', '1')
        body.removeAttribute('data-intro')

        // Smooth zoom on the overlay logo
        if(overlayLogo){
          const targetScale = 1 / (menuLogoInitialScale || 0.92)
          overlayLogo.style.setProperty('transform', 'scale(' + targetScale.toFixed(4) + ')', 'important')
        }

        if(logoCurtain && logoCurtainMetrics){
          logoCurtain.style.transition = `left ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1)`
          requestAnimationFrame(() => {
            logoCurtain.style.left = `${logoCurtainMetrics.offscreenLeft}px`
          })
        }
      }

      setTimeout(() => {
        revealLogo()      // Show a small loading text near the logo while waiting
      }, LOGO_REVEAL_DELAY)
      // Gate the second slide on distro readiness, while ensuring minimum visual hold.
      ;(async () => {
        const minHold = sleep(LOGO_ZOOM_MS + GAP_MS)
        await Promise.all([minHold, waitForDistroReady(12000)])

        // Proceed with exit animation
        overlay.style.background = 'transparent'

        // Determine if we should fast-exit (welcome or loginOptions shown).
        let fastExit = false
        try {
          const hasAccounts = Object.keys(ConfigManager.getAuthAccounts() || {}).length > 0
          const isFirst = typeof ConfigManager.isFirstLaunch === 'function' ? ConfigManager.isFirstLaunch() : false
          fastExit = isFirst || !hasAccounts
        } catch(e) {}

        if(overlayLogo){
          if(fastExit){
            if(logoCurtain && logoCurtainMetrics && typeof overlayLogoInitialLeft === 'number'){
              const existingTransition = overlayLogo.style.transition || ''
              const leftTransition = `left ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1)`
              overlayLogo.style.transition = existingTransition ? `${existingTransition}, ${leftTransition}` : leftTransition
              const targetLeft = overlayLogoInitialLeft + logoCurtainMetrics.offscreenLeft
              requestAnimationFrame(() => {
                overlayLogo.style.left = `${targetLeft}px`
              })
            } else {
              overlayLogo.style.opacity = '0'
            }
          } else {
            setTimeout(() => { overlayLogo.style.opacity = '0' }, LOGO_FADE_DELAY_MS)
          }
        }
        overlay.classList.remove('show')
        overlay.classList.add('hide')

        const REMOVE_DELAY = fastExit ? EXIT_MS : Math.max(EXIT_MS, LOGO_FADE_DELAY_MS + LOGO_FADE_MS)
        setTimeout(() => {
          overlay.style.display = 'none'
          overlay.classList.remove('hide')

          if(logoCurtain){
            logoCurtain.remove()
            logoCurtain = null
            logoCurtainMetrics = null
          }

          if(menuLogo){
            if(originalLogoZIndex){
              menuLogo.style.zIndex = originalLogoZIndex
            } else {
              menuLogo.style.removeProperty('z-index')
            }
            if(originalLogoTransition){
              menuLogo.style.transition = originalLogoTransition
            } else {
              menuLogo.style.removeProperty('transition')
            }
          }
          if(overlayLogo){
            overlayLogo.remove()
            overlayLogo = null
          }
          if(logoWrapper){
            if(originalWrapperZIndex){
              logoWrapper.style.zIndex = originalWrapperZIndex
            } else {
              logoWrapper.style.removeProperty('z-index')
            }
          }
        }, REMOVE_DELAY)
      })()
    }, START_DELAY)
  }

  // Lance l’intro au chargement du DOM.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', runIntro, { once: true })
  } else {
    runIntro()
  }
})();


/* Launch Progress Wrapper Functions */

/**
 * Show/hide the loading area.
 * 
 * @param {boolean} loading True if the loading area should be shown, otherwise false.
 */
function toggleLaunchArea(loading){
    if(loading){
        launch_details.style.display = 'flex'
    } else {
        launch_details.style.display = 'none'
    }
}

function setLaunchStarting() {
    const btn = document.getElementById('launch_button')
    const text = btn.querySelector('.launch_text')
    const progText = btn.querySelector('.launch_progress_text')
    const fill = btn.querySelector('.launch_fill')

    // Cache "JOUER"
    text.style.opacity = '0'

    // Montre la zone de statut (qui deviendra % plus tard)
    progText.style.opacity = '1'
    progText.textContent = 'CHARGEMENT...'

    // Barre blanche reset
    fill.style.width = '0%'
}

/**
 * Set the details text of the loading area.
 * 
 * @param {string} details The new text for the loading details.
 */
function setLaunchDetails(details){
    launch_details_text.innerHTML = details
}

/**
 * Met à jour la progression visuelle.
 * - si percent == 0 → on garde "Chargement..."
 * - si percent > 0 → on affiche "xx%"
 */
function setLaunchPercentage(percent){
    const btn = document.getElementById('launch_button')
    const textPlay    = btn.querySelector('.launch_text')
    const textLoading = btn.querySelector('.launch_loading_text')
    const progText    = btn.querySelector('.launch_progress_text')
    const fill        = btn.querySelector('.launch_fill')

    // Tant qu'on est en lancement/téléchargement, le bouton ne doit PAS être cliquable.
    setLaunchEnabled(false)

    if (percent === 0){
        // Juste après clic :
        // - cacher "JOUER"
        // - afficher "Chargement..."
        // - cacher le pourcentage
        if(textPlay)    textPlay.style.opacity = '0'
        if(textLoading) textLoading.style.opacity = '1'
        if(progText)    progText.style.opacity = '0'
        if(fill)        fill.style.width = '0%'
    } else {
        // Téléchargement effectif avec progression :
        // - cacher "JOUER"
        // - cacher "Chargement..."
        // - afficher "XX%"
        if(textPlay)    textPlay.style.opacity = '0'
        if(textLoading) textLoading.style.opacity = '0'
        if(progText){
            progText.style.opacity = '1'
            progText.textContent = `${percent}%`
        }
        if(fill)        fill.style.width = `${percent}%`
    }

    // synchro avec l'UI legacy du bas
    launch_progress.setAttribute('max', 100)
    launch_progress.setAttribute('value', percent)
    launch_progress_label.innerHTML = percent + '%'
}


/**
 * Remet le bouton dans son état neutre visuellement :
 * - "JOUER" visible
 * - "Chargement..." masqué
 * - % masqué
 * - barre blanche vidée
 */
function resetLaunchButtonUI() {
    const btn = document.getElementById('launch_button')
    if (!btn) return

    const textPlay     = btn.querySelector('.launch_text')
    const textLoading  = btn.querySelector('.launch_loading_text')
    const textPercent  = btn.querySelector('.launch_progress_text')
    const fill         = btn.querySelector('.launch_fill')

    // montrer "JOUER"
    textPlay.style.opacity    = '1'

    // cacher "Chargement..." et le pourcentage
    textLoading.style.opacity = '0'
    textPercent.style.opacity = '0'
    textPercent.textContent   = '0%'

    // reset de la barre blanche
    fill.style.width = '0%'

    // on masque la zone de progression sous le bouton
    toggleLaunchArea(false)

    // on redonne la main au bouton
    setLaunchEnabled(true)

    // on marque qu'on n'est plus en phase de lancement
    isLaunching = false
}

function promptAlreadyRunning() {
    // on remet le bouton dans l'état normal AVANT d'afficher la pop-up
    resetLaunchButtonUI()

    setOverlayContent(
        'Le jeu est déjà lancé',
        'Une instance du jeu semble déjà en cours. Lancer une deuxième instance peut causer des problèmes. Tu veux quand même lancer une autre instance ?',
        'Lancer quand même',
        'Ne pas relancer'
    )

    // si l’utilisateur CONFIRME: on lance quand même
    setOverlayHandler(async () => {
        toggleOverlay(false)
        await startLaunchSequence()
    })

    // si l’utilisateur REFUSE ou ferme avec Échap: on reste tranquille
    setDismissHandler(() => {
        toggleOverlay(false)
        // on NE relance PAS le jeu
        isLaunching = false
        // le bouton reste en mode "JOUER" actif
    })

    // on affiche l’overlay avec les deux boutons
    toggleOverlay(true, true)
}

async function startLaunchSequence() {
    if (isLaunching) return
    isLaunching = true

    // bloque le bouton immédiatement
    setLaunchEnabled(false)

    loggerLanding.info('Launching game..')
    try {
        const server = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())
        const jExe = ConfigManager.getJavaExecutable(ConfigManager.getSelectedServer())

        if (jExe == null) {
            await asyncSystemScan(server.effectiveJavaOptions)
        } else {

            setLaunchDetails(Lang.queryJS('landing.launch.pleaseWait'))
            toggleLaunchArea(true)
            setLaunchPercentage(0)

            const details = await validateSelectedJvm(
                ensureJavaDirIsRoot(jExe),
                server.effectiveJavaOptions.supported
            )

            if (details != null) {
                loggerLanding.info('Jvm Details', details)
                await dlAsync()
            } else {
                await asyncSystemScan(server.effectiveJavaOptions)
            }
        }
    } catch (err) {
        loggerLanding.error('Unhandled error in during launch process.', err)
        showLaunchFailure(
            Lang.queryJS('landing.launch.failureTitle'),
            Lang.queryJS('landing.launch.failureText')
        )

        // échec -> on réactive le bouton et on remet l'état visuel d'origine
        resetLaunchButtonUI()
    }
}

function isGameRunning(){
    return !!(proc && proc.exitCode === null)
}

async function beginLaunchSequence(){
    loggerLanding.info('Launching game..')
    try {
        // Empêche le spam clic immédiatement.
        setLaunchEnabled(false)

        const server = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())
        const jExe = ConfigManager.getJavaExecutable(ConfigManager.getSelectedServer())

        if(jExe == null){
            // pas de Java -> scan système
            await asyncSystemScan(server.effectiveJavaOptions)
        } else {

            setLaunchDetails(Lang.queryJS('landing.launch.pleaseWait'))
            toggleLaunchArea(true)

            // passe le bouton en mode "Chargement..." instantanément
            setLaunchPercentage(0)

            const details = await validateSelectedJvm(
                ensureJavaDirIsRoot(jExe),
                server.effectiveJavaOptions.supported
            )

            if(details != null){
                loggerLanding.info('Jvm Details', details)
                await dlAsync()
            } else {
                await asyncSystemScan(server.effectiveJavaOptions)
            }
        }
    } catch(err) {
        loggerLanding.error('Unhandled error during launch.', err)
        showLaunchFailure(
            Lang.queryJS('landing.launch.failureTitle'),
            Lang.queryJS('landing.launch.failureText')
        )

        // En cas d'erreur : on remet le bouton propre et cliquable.
        resetLaunchButtonUI()
        setLaunchEnabled(true)
        toggleLaunchArea(false)
    }
}


/**
 * Set the value of the OS progress bar and display that on the UI.
 * 
 * @param {number} percent Percentage (0-100)
 */
function setDownloadPercentage(percent){
    remote.getCurrentWindow().setProgressBar(percent/100)
    setLaunchPercentage(percent)
}


/**
 * Enable or disable the launch button.
 * 
 * @param {boolean} val True to enable, false to disable.
 */
function setLaunchEnabled(val){
    document.getElementById('launch_button').disabled = !val
}

// Bind launch button
// Bind launch button
// Bind launch button
document.getElementById('launch_button').addEventListener('click', async e => {
    // Si un process jeu existe et qu'il n'est pas encore terminé -> popup de confirmation.
    if (typeof proc !== 'undefined' && proc && proc.exitCode === null) {
        setOverlayContent(
            'Le jeu est déjà en cours',
            'Minecraft semble déjà lancé. Relancer peut ouvrir une deuxième instance.',
            'Ne pas relancer le jeu',
            'Relancer quand même'
        )

        // Gros bouton principal : NE PAS relancer.
        setOverlayHandler(() => {
            toggleOverlay(false)
            // Remet le bouton en mode "JOUER" proprement.
            if (typeof resetLaunchButtonUI === 'function') {
                resetLaunchButtonUI()
            } else {
                // fallback minimal si ta fonction n'existe pas
                setLaunchPercentage(0)
                setLaunchEnabled(true)
            }
        })

        // Lien secondaire : relancer quand même (force un nouveau lancement).
        setDismissHandler(async () => {
            toggleOverlay(false)
            await actuallyStartLaunch()
        })

        toggleOverlay(true, true)
        return
    }

    // Sinon, lancement normal.
    await actuallyStartLaunch()
})

async function actuallyStartLaunch(){
    loggerLanding.info('Launching game..')
    // Désactiver le bouton pendant le chargement (sans l’assombrir si ton CSS a été ajusté).
    setLaunchEnabled(true)  // s’assure que l’attribut existe
    document.getElementById('launch_button').disabled = true

    try {
        const server = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())
        const jExe = ConfigManager.getJavaExecutable(ConfigManager.getSelectedServer())

        if (jExe == null) {
            await asyncSystemScan(server.effectiveJavaOptions)
        } else {
            setLaunchDetails(Lang.queryJS('landing.launch.pleaseWait'))
            toggleLaunchArea(true)
            setLaunchPercentage(0, 100)

            const details = await validateSelectedJvm(
                ensureJavaDirIsRoot(jExe),
                server.effectiveJavaOptions.supported
            )

            if (details != null) {
                loggerLanding.info('Jvm Details', details)
                await dlAsync()
            } else {
                await asyncSystemScan(server.effectiveJavaOptions)
            }
        }
    } catch (err) {
        loggerLanding.error('Unhandled error in during launch process.', err)
        showLaunchFailure(
            Lang.queryJS('landing.launch.failureTitle'),
            Lang.queryJS('landing.launch.failureText')
        )
        // En cas d’erreur immédiate, on réactive le bouton.
        document.getElementById('launch_button').disabled = false
    }
}


// Bind settings button
const settingsBtn = document.getElementById('settingsMediaButton')
if (settingsBtn) {
    settingsBtn.onclick = async e => {
        await prepareSettings()
        switchView(getCurrentView(), VIEWS.settings)
    }
}

// Bind mods button
const modsBtn = document.getElementById('modsMediaButton')
if (modsBtn) {
    modsBtn.onclick = async e => {
        await prepareSettings()
        // Open settings and select the Mods tab.
        switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
            const modsNav = document.getElementById('settingsNavMods') || Array.from(document.getElementsByClassName('settingsNavItem')).find(v => v.getAttribute('rSc') === 'settingsTabMods')
            if (modsNav) settingsNavItemListener(modsNav, false)
        })
    }
}

// Bind website button
const websiteBtn = document.getElementById('websiteMediaButton')
if (websiteBtn) {
    websiteBtn.onclick = () => {
        try { shell.openExternal('https://www.eidolyth.fr/') } catch (e) { console.error('Failed to open website', e) }
    }
}

// Bind Discord button
const discordBtn = document.getElementById('discordMediaButton')
if (discordBtn) {
    discordBtn.onclick = () => {
        try { shell.openExternal('https://discord.com/invite/CvFxSu6NHa') } catch (e) { console.error('Failed to open Discord invite', e) }
    }
}

// Bind avatar overlay button (désactivé si inexistant)
const avatarOverlay = document.getElementById('avatarOverlay')
if (avatarOverlay) {
    avatarOverlay.onclick = async e => {
        await prepareSettings()
        switchView(getCurrentView(), VIEWS.settings, 500, 500, () => {
            settingsNavItemListener(document.getElementById('settingsNavAccount'), false)
        })
    }
}


// Bind selected account
function updateSelectedAccount(authUser) {
    const userText = document.getElementById('user_text')
    const avatarContainer = document.getElementById('avatarContainer')

    if (!userText || !avatarContainer) return // évite tout plantage si supprimé

    let username = Lang.queryJS('landing.selectedAccount.noAccountSelected')
    if (authUser != null) {
        if (authUser.displayName != null) {
            username = authUser.displayName
        }
        if (authUser.uuid != null) {
            avatarContainer.style.backgroundImage = `url('https://mc-heads.net/body/${authUser.uuid}/right')`
        }
    }
    userText.innerHTML = username
}
if (typeof updateSelectedAccount === 'function') {
    try { updateSelectedAccount(ConfigManager.getSelectedAccount()) } catch(e) { console.warn('updateSelectedAccount skipped', e) }
}

// Force le serveur unique dès le chargement
document.addEventListener('DOMContentLoaded', () => {
    resetLaunchButtonUI()
})

function updateSelectedServer(serv) {
    if (getCurrentView() === VIEWS.settings) {
        fullSettingsSave()
    }

    if (serv == null) {
        const dist = ConfigManager.getDistribution()
        if (dist && dist.servers && dist.servers.length > 0) {
            serv = { rawServer: dist.servers[0] }
        }
    }

    ConfigManager.setSelectedServer(serv ? serv.rawServer.id : null)
    ConfigManager.save()

    if (server_selection_button && server_selection_button.innerHTML !== undefined) {
        server_selection_button.innerHTML = '&#8226; ' + (serv ? serv.rawServer.name : Lang.queryJS('landing.noSelection'))
    }

    if (getCurrentView() === VIEWS.settings) {
        animateSettingsTabRefresh()
    }

    setLaunchEnabled(serv != null)
}

const dotSurvie = document.getElementById('dot-survie');
const txtSurvie = document.getElementById('text-survie');
const dotCrea   = document.getElementById('dot-crea');
const txtCrea   = document.getElementById('text-crea');

const colorMap = { green:'#22c55e', red:'#ef4444', orange:'#f59e0b' };
const toColor = (state) => {
  if (state === true) return colorMap.green;
  if (state === 'maintenance') return colorMap.orange;
  return colorMap.red;
};

if (dotSurvie) dotSurvie.style.backgroundColor = toColor(mcSurvie);
if (txtSurvie) txtSurvie.textContent = mcSurvie ? 'ONLINE' : 'OFFLINE';

if (dotCrea) dotCrea.style.backgroundColor = toColor(mcCreaMohist);
if (txtCrea) {
  if (mcCreaMohist) {
    const n = Number.isFinite(crea_count) ? crea_count : 0;
    txtCrea.textContent = `${n} JOUEUR${n>1?'S':''}`;
  } else {
    txtCrea.textContent = 'OFFLINE';
  }
}

/**
 * Shows an error overlay, toggles off the launch area.
 * 
 * @param {string} title The overlay title.
 * @param {string} desc The overlay description.
 */
function showLaunchFailure(title, desc){
    setOverlayContent(
        title,
        desc,
        Lang.queryJS('landing.launch.okay')
    )
    setOverlayHandler(null)
    toggleOverlay(true)
    toggleLaunchArea(false)
}

/* System (Java) Scan */

/**
 * Asynchronously scan the system for valid Java installations.
 * 
 * @param {boolean} launchAfter Whether we should begin to launch after scanning. 
 */
async function asyncSystemScan(effectiveJavaOptions, launchAfter = true){

    setLaunchDetails(Lang.queryJS('landing.systemScan.checking'))
    toggleLaunchArea(true)
    setLaunchPercentage(0, 100)

    const jvmDetails = await discoverBestJvmInstallation(
        ConfigManager.getDataDirectory(),
        effectiveJavaOptions.supported
    )

    if(jvmDetails == null) {
        // If the result is null, no valid Java installation was found.
        // Show this information to the user.
        setOverlayContent(
            Lang.queryJS('landing.systemScan.noCompatibleJava'),
            Lang.queryJS('landing.systemScan.installJavaMessage', { 'major': effectiveJavaOptions.suggestedMajor }),
            Lang.queryJS('landing.systemScan.installJava'),
            Lang.queryJS('landing.systemScan.installJavaManually')
        )
        setOverlayHandler(() => {
            setLaunchDetails(Lang.queryJS('landing.systemScan.javaDownloadPrepare'))
            toggleOverlay(false)
            
            try {
                downloadJava(effectiveJavaOptions, launchAfter)
            } catch(err) {
                loggerLanding.error('Unhandled error in Java Download', err)
                showLaunchFailure(Lang.queryJS('landing.systemScan.javaDownloadFailureTitle'), Lang.queryJS('landing.systemScan.javaDownloadFailureText'))
            }
        })
        setDismissHandler(() => {
            $('#overlayContent').fadeOut(250, () => {
                //$('#overlayDismiss').toggle(false)
                setOverlayContent(
                    Lang.queryJS('landing.systemScan.javaRequired', { 'major': effectiveJavaOptions.suggestedMajor }),
                    Lang.queryJS('landing.systemScan.javaRequiredMessage', { 'major': effectiveJavaOptions.suggestedMajor }),
                    Lang.queryJS('landing.systemScan.javaRequiredDismiss'),
                    Lang.queryJS('landing.systemScan.javaRequiredCancel')
                )
                setOverlayHandler(() => {
                    toggleLaunchArea(false)
                    toggleOverlay(false)
                })
                setDismissHandler(() => {
                    toggleOverlay(false, true)

                    asyncSystemScan(effectiveJavaOptions, launchAfter)
                })
                $('#overlayContent').fadeIn(250)
            })
        })
        toggleOverlay(true, true)
    } else {
        // Java installation found, use this to launch the game.
        const javaExec = javaExecFromRoot(jvmDetails.path)
        ConfigManager.setJavaExecutable(ConfigManager.getSelectedServer(), javaExec)
        ConfigManager.save()

        // We need to make sure that the updated value is on the settings UI.
        // Just incase the settings UI is already open.
        settingsJavaExecVal.value = javaExec
        await populateJavaExecDetails(settingsJavaExecVal.value)

        // TODO Callback hell, refactor
        // TODO Move this out, separate concerns.
        if(launchAfter){
            await dlAsync()
        }
    }

}

async function downloadJava(effectiveJavaOptions, launchAfter = true) {

    // TODO Error handling.
    // asset can be null.
    const asset = await latestOpenJDK(
        effectiveJavaOptions.suggestedMajor,
        ConfigManager.getDataDirectory(),
        effectiveJavaOptions.distribution)

    if(asset == null) {
        throw new Error(Lang.queryJS('landing.downloadJava.findJdkFailure'))
    }

    let received = 0
    await downloadFile(asset.url, asset.path, ({ transferred }) => {
        received = transferred
        setDownloadPercentage(Math.trunc((transferred/asset.size)*100))
    })
    setDownloadPercentage(100)

    if(received != asset.size) {
        loggerLanding.warn(`Java Download: Expected ${asset.size} bytes but received ${received}`)
        if(!await validateLocalFile(asset.path, asset.algo, asset.hash)) {
            log.error(`Hashes do not match, ${asset.id} may be corrupted.`)
            // Don't know how this could happen, but report it.
            throw new Error(Lang.queryJS('landing.downloadJava.javaDownloadCorruptedError'))
        }
    }

    // Extract
    // Show installing progress bar.
    remote.getCurrentWindow().setProgressBar(2)

    // Wait for extration to complete.
    const eLStr = Lang.queryJS('landing.downloadJava.extractingJava')
    let dotStr = ''
    setLaunchDetails(eLStr)
    const extractListener = setInterval(() => {
        if(dotStr.length >= 3){
            dotStr = ''
        } else {
            dotStr += '.'
        }
        setLaunchDetails(eLStr + dotStr)
    }, 750)

    const newJavaExec = await extractJdk(asset.path)

    // Extraction complete, remove the loading from the OS progress bar.
    remote.getCurrentWindow().setProgressBar(-1)

    // Extraction completed successfully.
    ConfigManager.setJavaExecutable(ConfigManager.getSelectedServer(), newJavaExec)
    ConfigManager.save()

    clearInterval(extractListener)
    setLaunchDetails(Lang.queryJS('landing.downloadJava.javaInstalled'))

    // TODO Callback hell
    // Refactor the launch functions
    asyncSystemScan(effectiveJavaOptions, launchAfter)

}

function resolveArtifactHash(artifact){
    if(artifact == null){
        return null
    }
    if(artifact.sha1){
        return { algo: HashAlgo.SHA1, hash: artifact.sha1 }
    }
    if(artifact.sha256){
        return { algo: HashAlgo.SHA256, hash: artifact.sha256 }
    }
    if(artifact.md5){
        return { algo: HashAlgo.MD5, hash: artifact.md5 }
    }
    return null
}

async function ensureModLoaderLibraries(modLoaderData, loggerLaunchSuite){
    if(modLoaderData == null || !Array.isArray(modLoaderData.libraries) || modLoaderData.libraries.length === 0){
        return []
    }

    const librariesDir = nodePath.join(ConfigManager.getCommonDirectory(), 'libraries')
    const assetsToDownload = []
    const seenPaths = new Set()
    const forcedModulePathEntries = new Map()

    const moduleKeywords = [
        'bootstraplauncher',
        'securejarhandler',
        'modlauncher',
        'jarjarfilesystem',
        'accesstransformer',
        'asm-',
        'slf4j',
        'log4j',
        'antlr',
        'jopt-simple',
        'joptsimple',
        // Additional mod-loader utilities that NeoForge requires before game launch.
        'night-config',
        'typetools',
        'terminalconsoleappender',
        'sponge-mixin',
        'nashorn',
        'guava',
        'commons-lang3',
        'commons-io',
        'mergetool',
        'srgutils'
    ]

    const shouldForceModulePath = (libName, artifactPath) => {
        if(!artifactPath){
            return false
        }
        const loweredPath = artifactPath.toLowerCase()
        const loweredName = (libName || '').toLowerCase()
        return moduleKeywords.some(keyword =>
            loweredPath.includes(keyword) || loweredName.includes(keyword)
        )
    }

    const queueArtifact = async (libName, artifact, label, destination, relativePath) => {
        if(artifact == null || artifact.url == null || artifact.path == null){
            return
        }
        if(typeof destination !== 'string' || destination.length === 0){
            return
        }
        const hashInfo = resolveArtifactHash(artifact)
        if(hashInfo == null){
            return
        }
        const normalizedDestination = nodePath.normalize(destination)
        const relativeNormalized = relativePath != null ? relativePath.replace(/\\/g, '/').replace(/^\//, '') : null

        if(shouldForceModulePath(libName, normalizedDestination)){
            forcedModulePathEntries.set(normalizedDestination, relativeNormalized)
        }

        if(seenPaths.has(normalizedDestination)){
            return
        }
        if(await validateLocalFile(normalizedDestination, hashInfo.algo, hashInfo.hash)){
            return
        }
        seenPaths.add(normalizedDestination)
        assetsToDownload.push({
            id: `${libName}${label}`,
            hash: hashInfo.hash,
            algo: hashInfo.algo,
            size: artifact.size || 0,
            url: artifact.url,
            path: normalizedDestination
        })
    }

    for(const lib of modLoaderData.libraries){
        if(!isLibraryCompatible(lib.rules, lib.natives)){
            continue
        }

        const downloads = lib.downloads
        if(downloads == null){
            continue
        }

        if(downloads.artifact){
            const relativePath = downloads.artifact.path
            if(typeof relativePath !== 'string' || relativePath.length === 0){
                loggerLaunchSuite?.warn?.(`Skipping mod loader library ${lib.name}, missing artifact path definition.`)
                continue
            }
            const destination = nodePath.join(librariesDir, relativePath)
            await queueArtifact(lib.name, downloads.artifact, '', destination, relativePath)
        }

        if(lib.natives && downloads.classifiers){
            const nativeDescriptor = lib.natives[getMojangOS()]
            if(typeof nativeDescriptor === 'string'){
                const classifierKey = nativeDescriptor.replace('${arch}', process.arch.replace('x', ''))
                const nativeArtifact = downloads.classifiers[classifierKey]
                if(nativeArtifact){
                    const relativeNativePath = nativeArtifact.path
                    if(typeof relativeNativePath !== 'string' || relativeNativePath.length === 0){
                        loggerLaunchSuite?.warn?.(`Skipping native classifier ${classifierKey} for ${lib.name}, missing artifact path definition.`)
                        continue
                    }
                    const destination = nodePath.join(librariesDir, relativeNativePath)
                    await queueArtifact(lib.name, nativeArtifact, `@${classifierKey}`, destination, relativeNativePath)
                }
            }
        }
    }

    if(assetsToDownload.length === 0){
        return Array.from(forcedModulePathEntries)
    }

    loggerLaunchSuite.info(`Downloading ${assetsToDownload.length} missing mod loader librar${assetsToDownload.length === 1 ? 'y' : 'ies'}.`)

    setLaunchDetails(Lang.queryJS('landing.dlAsync.downloadingFiles'))
    setDownloadPercentage(0)

    const totalSize = getExpectedDownloadSize(assetsToDownload)

    await downloadQueue(assetsToDownload, received => {
        if(totalSize > 0){
            setDownloadPercentage(Math.trunc((received/totalSize)*100))
        }
    })

    setDownloadPercentage(100)
    remote.getCurrentWindow().setProgressBar(-1)

    const failed = []
    for(const asset of assetsToDownload){
        if(!await validateLocalFile(asset.path, asset.algo, asset.hash)){
            failed.push(asset.id)
        }
    }

    if(failed.length > 0){
        throw new Error(`Failed to validate mod loader libraries: ${failed.join(', ')}`)
    }

    setLaunchDetails(Lang.queryJS('landing.dlAsync.preparingToLaunch'))

    return Array.from(forcedModulePathEntries.entries()).map(([absolutePath, relativePath]) => ({
        absolutePath,
        relativePath
    }))
}

async function dlAsync(login = true) {

    // Login parameter is temporary for debug purposes. Allows testing the validation/downloads without
    // launching the game.

    const loggerLaunchSuite = LoggerUtil.getLogger('LaunchSuite')

    setLaunchDetails(Lang.queryJS('landing.dlAsync.loadingServerInfo'))

    let distro

    try {
        distro = await DistroAPI.refreshDistributionOrFallback()
        onDistroRefresh(distro)
    } catch(err) {
        loggerLaunchSuite.error('Unable to refresh distribution index.', err)
        showLaunchFailure(
            Lang.queryJS('landing.dlAsync.fatalError'),
            Lang.queryJS('landing.dlAsync.unableToLoadDistributionIndex')
        )
        // remet le bouton dispo
        resetLaunchButtonUI()
        return
    }

    const serv = distro.getServerById(ConfigManager.getSelectedServer())

    if(login) {
        if(ConfigManager.getSelectedAccount() == null){
            loggerLanding.error('You must be logged into an account.')
            resetLaunchButtonUI()
            return
        }
    }

    setLaunchDetails(Lang.queryJS('landing.dlAsync.pleaseWait'))
    toggleLaunchArea(true)
    setLaunchPercentage(0)

    // Clean any user-added drop-in mods before validation/download.
    try {
        const modsDir = nodePath.join(ConfigManager.getInstanceDirectory(), serv.rawServer.id, 'mods')
        const found = DropinCleanerUtil.scanForDropinMods(modsDir, serv.rawServer.minecraftVersion)
        if (Array.isArray(found) && found.length > 0) {
            const loggerLaunchSuite = LoggerUtil.getLogger('LaunchSuite')
            loggerLaunchSuite.info(`Removing ${found.length} drop-in mod(s) from ${modsDir}`)
            for (const m of found) {
                try {
                    fsExtra.removeSync(nodePath.join(modsDir, m.fullName))
                } catch (e) {
                    loggerLaunchSuite.warn(`Failed to remove drop-in mod: ${m.fullName}`, e)
                }
            }
        }
    } catch (e) {
        // Non-fatal: continue launch even if cleanup fails
        try { LoggerUtil.getLogger('LaunchSuite').warn('Drop-in mods cleanup failed.', e) } catch(_) {}
    }

    const fullRepairModule = new FullRepair(
        ConfigManager.getCommonDirectory(),
        ConfigManager.getInstanceDirectory(),
        ConfigManager.getLauncherDirectory(),
        ConfigManager.getSelectedServer(),
        DistroAPI.isDevMode()
    )

    fullRepairModule.spawnReceiver()

    fullRepairModule.childProcess.on('error', (err) => {
        loggerLaunchSuite.error('Error during launch', err)
        showLaunchFailure(
            Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'),
            err.displayable || Lang.queryJS('landing.dlAsync.errorDuringLaunchText')
        )
        resetLaunchButtonUI()
    })
    fullRepairModule.childProcess.on('close', (code, _signal) => {
        if(code !== 0){
            loggerLaunchSuite.error(`Full Repair Module exited with code ${code}, assuming error.`)
            showLaunchFailure(
                Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'),
                Lang.queryJS('landing.dlAsync.seeConsoleForDetails')
            )
            resetLaunchButtonUI()
        }
    })

    loggerLaunchSuite.info('Validating files.')
    setLaunchDetails(Lang.queryJS('landing.dlAsync.validatingFileIntegrity'))
    let invalidFileCount = 0
    try {
        invalidFileCount = await fullRepairModule.verifyFiles(percent => {
            setLaunchPercentage(percent)
        })
        setLaunchPercentage(100)
    } catch (err) {
        loggerLaunchSuite.error('Error during file validation.')
        showLaunchFailure(
            Lang.queryJS('landing.dlAsync.errorDuringFileVerificationTitle'),
            err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails')
        )
        resetLaunchButtonUI()
        return
    }
    

    if(invalidFileCount > 0) {
        loggerLaunchSuite.info('Downloading files.')
        setLaunchDetails(Lang.queryJS('landing.dlAsync.downloadingFiles'))
        setLaunchPercentage(0)
        try {
            await fullRepairModule.download(percent => {
                setDownloadPercentage(percent)
            })
            setDownloadPercentage(100)
        } catch(err) {
            loggerLaunchSuite.error('Error during file download.')
            showLaunchFailure(
                Lang.queryJS('landing.dlAsync.errorDuringFileDownloadTitle'),
                err.displayable || Lang.queryJS('landing.dlAsync.seeConsoleForDetails')
            )
            resetLaunchButtonUI()
            return
        }
    } else {
        loggerLaunchSuite.info('No invalid files, skipping download.')
    }

    // Remove download bar.
    remote.getCurrentWindow().setProgressBar(-1)

    fullRepairModule.destroyReceiver()

    setLaunchDetails(Lang.queryJS('landing.dlAsync.preparingToLaunch'))

    const mojangIndexProcessor = new MojangIndexProcessor(
        ConfigManager.getCommonDirectory(),
        serv.rawServer.minecraftVersion)
    const distributionIndexProcessor = new DistributionIndexProcessor(
        ConfigManager.getCommonDirectory(),
        distro,
        serv.rawServer.id
    )

    const modLoaderData = await distributionIndexProcessor.loadModLoaderVersionJson(serv)
    const modulePathExtras = await ensureModLoaderLibraries(modLoaderData, loggerLaunchSuite) || []
    if(modulePathExtras.length > 0){
        modLoaderData.modulePathExtras = modulePathExtras
    }
    if(modulePathExtras.length > 0 && Array.isArray(modLoaderData?.arguments?.jvm)){
        const modulePathIdx = modLoaderData.arguments.jvm.indexOf('-p')
        if(modulePathIdx > -1){
            const sep = ProcessBuilder.getClasspathSeparator()
            const current = modLoaderData.arguments.jvm[modulePathIdx + 1] || ''
            const existingEntries = current.split(sep).filter(Boolean)
            const existingNormalized = new Set(existingEntries.map(entry => nodePath.normalize(entry)))
            const librariesDir = nodePath.join(ConfigManager.getCommonDirectory(), 'libraries')
            const placeholderRegex = /^\$\{library_directory\}[\\/]?/i
            const existingRelative = new Set(existingEntries.map(entry => {
                if(placeholderRegex.test(entry)){
                    return entry.replace(placeholderRegex, '').replace(/\\/g, '/')
                }
                if(entry.startsWith(librariesDir)){
                    return entry.substring(librariesDir.length + 1).replace(/\\/g, '/')
                }
                return null
            }).filter(Boolean))

            const additions = []
            for(const extra of modulePathExtras){
                if(typeof extra?.absolutePath !== 'string' || extra.absolutePath.length === 0){
                    continue
                }
                const normalized = nodePath.normalize(extra.absolutePath)
                const relative = typeof extra.relativePath === 'string' && extra.relativePath.length > 0
                    ? extra.relativePath.replace(/\\/g, '/')
                    : null
                if(existingNormalized.has(normalized)){
                    continue
                }
                if(relative != null && existingRelative.has(relative)){
                    continue
                }
                existingNormalized.add(normalized)
                if(relative != null){
                    existingRelative.add(relative)
                }
                additions.push(normalized)
            }

            if(additions.length > 0){
                modLoaderData.arguments.jvm[modulePathIdx + 1] = existingEntries.concat(additions).join(sep)
            }
        }
    }
    const versionData = await mojangIndexProcessor.getVersionJson()

    if(login) {
        const authUser = ConfigManager.getSelectedAccount()
        loggerLaunchSuite.info(`Sending selected account (${authUser.displayName}) to ProcessBuilder.`)
        let pb = new ProcessBuilder(serv, versionData, modLoaderData, authUser, remote.app.getVersion())
        setLaunchDetails(Lang.queryJS('landing.dlAsync.launchingGame'))

        // const SERVER_JOINED_REGEX = /\[.+\]: \[CHAT\] [a-zA-Z0-9_]{1,16} joined the game/
        const SERVER_JOINED_REGEX = new RegExp(`\\[.+\\]: \\[CHAT\\] ${authUser.displayName} joined the game`)

        // ⬇⬇⬇ MODIFIÉ ICI
        const onLoadComplete = () => {
            // le client est parti, on considère que le jeu tourne maintenant.
            // on remet tout de suite le bouton dans l'état "JOUER"
            // mais gameIsRunning reste true => si tu recliques, tu auras la popup.
            resetLaunchButtonUI()

            if(hasRPC){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.loading'))
                proc.stdout.on('data', gameStateChange)
            }

            proc.stdout.removeListener('data', tempListener)
            proc.stderr.removeListener('data', gameErrorListener)
        }
        // ⬆⬆⬆ FIN MODIF

        const start = Date.now()

        // Attach a temporary listener to the client output.
        // Will wait for a certain bit of text meaning that
        // the client application has started, and we can hide
        // the progress bar stuff.
        const tempListener = function(data){
            if(GAME_LAUNCH_REGEX.test(data.trim())){
                const diff = Date.now()-start
                if(diff < MIN_LINGER) {
                    setTimeout(onLoadComplete, MIN_LINGER-diff)
                } else {
                    onLoadComplete()
                }
            }
        }

        // Listener for Discord RPC.
        const gameStateChange = function(data){
            data = data.trim()
            if(SERVER_JOINED_REGEX.test(data)){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.joined'))
            } else if(GAME_JOINED_REGEX.test(data)){
                DiscordWrapper.updateDetails(Lang.queryJS('landing.discord.joining'))
            }
        }

        const gameErrorListener = function(data){
            data = data.trim()
            if(data.indexOf('Could not find or load main class net.minecraft.launchwrapper.Launch') > -1){
                loggerLaunchSuite.error('Game launch failed, LaunchWrapper was not downloaded properly.')
                showLaunchFailure(
                    Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'),
                    Lang.queryJS('landing.dlAsync.launchWrapperNotDownloaded')
                )
                resetLaunchButtonUI()
            }
        }

        try {
            // Build Minecraft process.
            proc = pb.build()

            // on marque que le jeu tourne
            gameIsRunning = true

            // Bind listeners to stdout/err.
            proc.stdout.on('data', tempListener)
            proc.stderr.on('data', gameErrorListener)

            setLaunchDetails(Lang.queryJS('landing.dlAsync.doneEnjoyServer'))

            // Init Discord Hook
            if(distro.rawDistribution.discord != null && serv.rawServer.discord != null){
                DiscordWrapper.initRPC(distro.rawDistribution.discord, serv.rawServer.discord)
                hasRPC = true
            }

            // quand le jeu se ferme :
            proc.on('close', (code, signal) => {
                loggerLaunchSuite.info('Minecraft process closed with code', code, 'signal', signal)

                // jeu plus en cours
                gameIsRunning = false

                // on coupe RPC si actif
                if(hasRPC){
                    loggerLaunchSuite.info('Shutting down Discord Rich Presence..')
                    DiscordWrapper.shutdownRPC()
                    hasRPC = false
                }

                proc = null

                // on remet le bouton "JOUER" (au cas où)
                resetLaunchButtonUI()
            })

        } catch(err) {

            loggerLaunchSuite.error('Error during launch', err)
            showLaunchFailure(
                Lang.queryJS('landing.dlAsync.errorDuringLaunchTitle'),
                Lang.queryJS('landing.dlAsync.checkConsoleForDetails')
            )

            // en cas d’erreur, bouton remis normal
            resetLaunchButtonUI()
        }
    }

}


/**
 * News Loading Functions
 */

// DOM Cache
const newsContent                   = document.getElementById('newsContent')
const newsArticleTitle              = document.getElementById('newsArticleTitle')
const newsArticleDate               = document.getElementById('newsArticleDate')
const newsArticleAuthor             = document.getElementById('newsArticleAuthor')
const newsArticleComments           = document.getElementById('newsArticleComments')
const newsNavigationStatus          = document.getElementById('newsNavigationStatus')
const newsArticleContentScrollable  = document.getElementById('newsArticleContentScrollable')
const nELoadSpan                    = document.getElementById('nELoadSpan')

// News slide caches.
let newsActive = false
let newsGlideCount = 0

/**
 * Show the news UI via a slide animation.
 * 
 * @param {boolean} up True to slide up, otherwise false. 
 */
function slide_(up){
    const lCUpper = document.querySelector('#landingContainer > #upper')
    const lCLLeft = document.querySelector('#landingContainer > #lower > #left')
    const lCLCenter = document.querySelector('#landingContainer > #lower > #center')
    const lCLRight = document.querySelector('#landingContainer > #lower > #right')
    const newsBtn = document.querySelector('#landingContainer > #lower > #center #content')
    const landingContainer = document.getElementById('landingContainer')
    const newsContainer = document.querySelector('#landingContainer > #newsContainer')

    newsGlideCount++

    if(up){
        lCUpper.style.top = '-200vh'
        lCLLeft.style.top = '-200vh'
        lCLCenter.style.top = '-200vh'
        lCLRight.style.top = '-200vh'
        newsBtn.style.top = '130vh'
        newsContainer.style.top = '0px'
        //date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})
        //landingContainer.style.background = 'rgba(29, 29, 29, 0.55)'
        landingContainer.style.background = 'rgba(0, 0, 0, 0.50)'
        setTimeout(() => {
            if(newsGlideCount === 1){
                lCLCenter.style.transition = 'none'
                newsBtn.style.transition = 'none'
            }
            newsGlideCount--
        }, 2000)
    } else {
        setTimeout(() => {
            newsGlideCount--
        }, 2000)
        landingContainer.style.background = null
        lCLCenter.style.transition = null
        newsBtn.style.transition = null
        newsContainer.style.top = '100%'
        lCUpper.style.top = '0px'
        lCLLeft.style.top = '0px'
        lCLCenter.style.top = '0px'
        lCLRight.style.top = '0px'
        newsBtn.style.top = '10px'
    }
}

/**
 * Show the news alert indicating there is new news.
 */
function showNewsAlert(){
    newsAlertShown = true
    $(newsButtonAlert).fadeIn(250)
}

async function digestMessage(str) {
    const msgUint8 = new TextEncoder().encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    return hashHex
}

/**
 * Add keyboard controls to the news UI. Left and right arrows toggle
 * between articles. If you are on the landing page, the up arrow will
 * open the news UI.
 */
document.addEventListener('keydown', (e) => {
    if(newsActive){
        if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
            document.getElementById(e.key === 'ArrowRight' ? 'newsNavigateRight' : 'newsNavigateLeft').click()
        }
        // Interferes with scrolling an article using the down arrow.
        // Not sure of a straight forward solution at this point.
        // if(e.key === 'ArrowDown'){
        //     document.getElementById('newsButton').click()
        // }
    } else {
        if(getCurrentView() === VIEWS.landing){
            if(e.key === 'ArrowUp'){
                document.getElementById('newsButton').click()
            }
        }
    }
})

/**
 * Display a news article on the UI.
 * 
 * @param {Object} articleObject The article meta object.
 * @param {number} index The article index.
 */
function displayArticle(articleObject, index){
    newsArticleTitle.innerHTML = articleObject.title
    newsArticleTitle.href = articleObject.link
    newsArticleAuthor.innerHTML = 'by ' + articleObject.author
    newsArticleDate.innerHTML = articleObject.date
    newsArticleComments.innerHTML = articleObject.comments
    newsArticleComments.href = articleObject.commentsLink
    newsArticleContentScrollable.innerHTML = '<div id="newsArticleContentWrapper"><div class="newsArticleSpacerTop"></div>' + articleObject.content + '<div class="newsArticleSpacerBot"></div></div>'
    Array.from(newsArticleContentScrollable.getElementsByClassName('bbCodeSpoilerButton')).forEach(v => {
        v.onclick = () => {
            const text = v.parentElement.getElementsByClassName('bbCodeSpoilerText')[0]
            text.style.display = text.style.display === 'block' ? 'none' : 'block'
        }
    })
    newsNavigationStatus.innerHTML = Lang.query('ejs.landing.newsNavigationStatus', {currentPage: index, totalPages: newsArr.length})
    newsContent.setAttribute('article', index-1)
}

/**
 * Load news information from the RSS feed specified in the
 * distribution index.
 */
async function loadNews(){

    const distroData = await DistroAPI.getDistribution()
    if(!distroData.rawDistribution.rss) {
        loggerLanding.debug('No RSS feed provided.')
        return null
    }

    const promise = new Promise((resolve, reject) => {
        
        const newsFeed = distroData.rawDistribution.rss
        const newsHost = new URL(newsFeed).origin + '/'
        $.ajax({
            url: newsFeed,
            success: (data) => {
                const items = $(data).find('item')
                const articles = []

                for(let i=0; i<items.length; i++){
                // JQuery Element
                    const el = $(items[i])

                    // Resolve date.
                    const date = new Date(el.find('pubDate').text()).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'})

                    // Resolve comments.
                    let comments = el.find('slash\\:comments').text() || '0'
                    comments = comments + ' Comment' + (comments === '1' ? '' : 's')

                    // Fix relative links in content.
                    let content = el.find('content\\:encoded').text()
                    let regex = /src="(?!http:\/\/|https:\/\/)(.+?)"/g
                    let matches
                    while((matches = regex.exec(content))){
                        content = content.replace(`"${matches[1]}"`, `"${newsHost + matches[1]}"`)
                    }

                    let link   = el.find('link').text()
                    let title  = el.find('title').text()
                    let author = el.find('dc\\:creator').text()

                    // Generate article.
                    articles.push(
                        {
                            link,
                            title,
                            date,
                            author,
                            content,
                            comments,
                            commentsLink: link + '#comments'
                        }
                    )
                }
                resolve({
                    articles
                })
            },
            timeout: 2500
        }).catch(err => {
            resolve({
                articles: null
            })
        })
    })

    return await promise
}

try {
  const { app } = require('electron').remote || require('@electron/remote')
  const version = app.getVersion()
  const versionSpan = document.getElementById('launcherVersion')
  if (versionSpan) versionSpan.textContent = version
  console.log('Launcher version:', version)
} catch (err) {
  console.error('Impossible de récupérer la version du launcher:', err)
}





