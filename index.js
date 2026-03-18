import { 
    makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import NodeCache from 'node-cache';
import pino from 'pino';
import { handler } from './handler.js';
import qrcode from 'qrcode-terminal';
import { rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =================================================================
// LOGGER SETUP (Fix error logger.child)
// =================================================================
const logger = pino({ 
    level: 'silent', // 'info' buat debug, 'silent' buat clean
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
}).child({ class: 'baileys' });

console.log('🤖 Initializing bot with features...\n');

let conflictCount = 0;

// =================================================================
// BOT CONNECTION
// =================================================================
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');
    const { version } = await fetchLatestBaileysVersion();
    
    console.log(`📱 Using Baileys v${version.join('.')}`);

    let qrRefreshInterval = null;
    let isConnected = false;

    const sock = makeWASocket({
        version,
        logger, // <-- Pake logger pino yang udah dibuat
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ['Mac OS', 'Chrome', '14.4.1'],
        connectTimeoutMs: 180000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 60000,
        emitOwnEvents: true,
        fireInitQueries: true,
        shouldSyncHistoryMessage: () => true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        msgRetryCounterCache: new NodeCache({ stdTTL: 0, checkperiod: 0 }),
    });

    // QR & Connection Handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            // Clear any existing QR refresh interval
            if (qrRefreshInterval) clearInterval(qrRefreshInterval);
            
            // Display QR immediately
            const displayQR = () => {
                console.clear();
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📲 SCAN QR CODE dengan WhatsApp (Berlaku 40 detik)');
                console.log(`⏰ Generated: ${new Date().toLocaleTimeString('id-ID')}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                qrcode.generate(qr, { small: true });
                console.log('\n✨ QR code valid 40 detik - ada cukup waktu untuk scan!\n');
            };
            
            displayQR();
            
            // Auto-refresh QR setiap 40 detik untuk member scanning
            qrRefreshInterval = setInterval(displayQR, 40000);
        }
        
        if (connection === 'close') {
            // Clear QR refresh interval when disconnected
            if (qrRefreshInterval) clearInterval(qrRefreshInterval);
            
            const reason = lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message || 'Unknown';
            console.log('❌ Connection closed:', reason);

            const isConflict = String(reason).toLowerCase().includes('conflict') ||
                               lastDisconnect?.error?.output?.statusCode === DisconnectReason.connectionReplaced;

            const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                                   lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

            if (isConflict) {
                conflictCount = (conflictCount || 0) + 1;
                console.log(`⚠️ Conflict #${conflictCount} - Multiple sessions active. Clearing and retrying...`);
                
                // Clear session after 2 seconds to ensure old connections are fully closed
                setTimeout(() => {
                    try {
                        rmSync(join(__dirname, 'session_auth'), { recursive: true, force: true });
                        console.log('✅ Session cleared. Restarting connection...');
                        setTimeout(connectToWhatsApp, 2000);
                    } catch (e) {
                        console.error('Failed to clear session:', e.message);
                        setTimeout(connectToWhatsApp, 5000);
                    }
                }, 2000);
                return;
            }

            if (shouldReconnect) {
                console.log('🔄 Reconnecting in 5s...');
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('🚫 Logged out! Hapus folder session_auth dan restart.');
                console.log('   rm -rf session_auth/ && node index.js');
            }
        } else if (connection === 'open') {
            // Clear QR refresh when successfully connected
            if (qrRefreshInterval) clearInterval(qrRefreshInterval);
            isConnected = true;
            
            console.clear();
            console.log('✅ Bot connected!');
            console.log(`👤 User: ${sock.user?.name || sock.user?.id}`);
            console.log('\n🚀 Bot is ready to receive commands!\n');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // =================================================================
    // MESSAGE HANDLER
    // =================================================================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log(`📬 Upsert type: ${type}, message count: ${messages.length}`);
        
        if (type !== 'notify') {
            console.log(`⏭️ Skipped (not notify): ${type}`);
            return;
        }
        
        const m = messages[0];
        console.log(`📨 Message received. Has .message: ${!!m.message}, FromMe: ${m.key.fromMe}`);
        
        if (!m.message) {
            console.log('⏭️ Skipped: no m.message');
            return;
        }
        
        if (m.key.fromMe) {
            console.log('⏭️ Skipped: message from me');
            return;
        }

        const msgType = Object.keys(m.message)[0];
        let body = '';
        
        if (msgType === 'conversation') body = m.message.conversation;
        else if (msgType === 'extendedTextMessage') body = m.message.extendedTextMessage?.text || '';
        else if (msgType === 'imageMessage') body = m.message.imageMessage?.caption || '';
        else if (msgType === 'videoMessage') body = m.message.videoMessage?.caption || '';
        else if (msgType === 'documentMessage') body = m.message.documentMessage?.caption || '';

        // Show all incoming messages
        const sender = m.key.remoteJid?.split('@')[0];
        const isSenderMe = m.key.participant?.split('@')[0] || sender;
        console.log(`📨 [${msgType}] ${isSenderMe}: ${body || '(media)'}`);

        try {
            await handler(sock, m);
        } catch (err) {
            console.error(`❌ Error in message handler:`, err.message);
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ Error: ${err.message}`
            }, { quoted: m }).catch(() => {});
        }
    });

    return sock;
}

connectToWhatsApp().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});