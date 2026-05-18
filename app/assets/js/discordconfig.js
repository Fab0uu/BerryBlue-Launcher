/**
 * Local Discord Rich Presence settings.
 * Fill the strings below with the values from your Discord application,
 * then flip `enabled` to true.
 */
const DiscordRPCConfig = {
    enabled: true,
    global: {
        clientId: '1436894736362377236',
        smallImageKey: 'mc', // Optionnel : laissez vide pour ne pas afficher de petite image.
        smallImageText: 'Minecraft Neoforge 1.21.1'
    },
    server: {
        shortId: 'Eidolyth 1.21.1',
        largeImageKey: 'logo',
        largeImageText: 'Aventure moddé Eidolyth'
    }
}

module.exports = DiscordRPCConfig
