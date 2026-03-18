import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commands = new Map();
const featurePath = path.join(__dirname, 'features');

async function loadCommands() {
    if (fs.existsSync(featurePath)) {
        const featureFolders = fs.readdirSync(featurePath);
        for (const folder of featureFolders) {
            const folderPath = path.join(featurePath, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                for (const file of files) {
                    try {
                        const module = await import(`./features/${folder}/${file}`);
                        if (module.default && module.default.command) {
                            const aliases = Array.isArray(module.default.command) ? module.default.command : [module.default.command];
                            aliases.forEach(cmd => commands.set(cmd, module.default));
                            console.log(`  ✅ ${folder}/${file.replace('.js', '')} → [${aliases.join(', ')}]`);
                        }
                    } catch (err) {
                        console.error(`  ❌ ${folder}/${file}: ${err.message}`);
                    }
                }
            }
        }
    }
    console.log(`\n🚀 Total ${commands.size} commands loaded\n`);
}

await loadCommands();

export async function handler(sock, m) {
    try {
        if (!m.message) return;
        
        // Extract body dari berbagai message type
        let body = '';
        const msgType = Object.keys(m.message)[0];
        
        if (msgType === 'conversation') {
            body = m.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            body = m.message.extendedTextMessage?.text || '';
        } else if (msgType === 'imageMessage') {
            body = m.message.imageMessage?.caption || '';
        } else if (msgType === 'videoMessage') {
            body = m.message.videoMessage?.caption || '';
        } else if (msgType === 'documentMessage') {
            body = m.message.documentMessage?.caption || '';
        }

        if (!body) return; // Jika gak ada body, skip
        
        const isCmd = body.startsWith('.');
        if (!isCmd) return; // Jika bukan command, skip
        
        const command = body.slice(1).split(' ')[0].toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');
        
        // --- LOGIKA PENGIRIM VS TUJUAN BALASAN ---
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        // 1. Siapa yang mengetik pesan? (Untuk cek Owner)
        const user = isGroup ? m.key.participant : m.key.remoteJid;
        
        // 2. Kemana bot harus membalas? (Grup atau Private)
        const chatId = m.key.remoteJid;
        
        // Cek Owner
        const userNum = user.split('@')[0];
        const ownerNum = config.ownerNumber.split('@')[0];
        const isOwner = userNum === ownerNum;
        // ------------------------------------------

        if (commands.has(command)) {
            const feature = commands.get(command);
            
            if (feature.ownerOnly && !isOwner) {
                return sock.sendMessage(chatId, { text: '❌ Fitur ini khusus Owner!' }, { quoted: m });
            }

            console.log(`[CMD] .${command} dari ${userNum} | ${isGroup ? '👥 Grup' : '💬 Private'} | Owner: ${isOwner}`);
            
            // Kita kirim context lengkap untuk kompatibilitas dengan semua fitur
            await feature.execute(sock, m, { 
                args, 
                q, 
                isOwner, 
                sender: chatId, 
                realSender: user,
                pushName: m.pushName || '',
                messageType: msgType,
                body: body
            });
        } else {
            console.log(`[?] .${command} - Not found`);
        }
    } catch (e) {
        console.error("❌ Handler Error:", e.message);
    }
}
