import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function uploadToTmpfiles(filePath, fileName) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), fileName);

        const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: { ...form.getHeaders() },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60000
        });

        if (res.data?.status === 'success') {
            return res.data.data;
        }
        throw new Error('Invalid response from server');
    } catch (e) {
        console.error('Upload Error:', e.response?.data || e.message);
        throw new Error(e.response?.data?.message || 'Failed to upload file');
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default {
    command: ['mirror', 'tmpfiles', 'upload', 'up'],
    execute: async (sock, m, { q, sender, pushName }) => {
        const chatId = m.chat || m.key.remoteJid;
        const namaUser = pushName || m.pushName || 'Tanpa Nama';
        
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isQuoted = quotedMsg?.documentMessage || quotedMsg?.imageMessage || 
                        quotedMsg?.videoMessage || quotedMsg?.audioMessage;
        const isDirect = m.message?.documentMessage || m.message?.imageMessage || 
                        m.message?.videoMessage || m.message?.audioMessage;
        
        const target = isQuoted || isDirect;

        if (!target) {
            return sock.sendMessage(chatId, {
                text: `📤 *MIRROR FILE - tmpfiles.org*\n\n` +
                      `*Cara Penggunaan:*\n` +
                      `• Reply file dengan: *.mirror*\n` +
                      `• Kirim file dengan caption: *.mirror*\n\n` +
                      `*Alias Command:*\n` +
                      `• *.upload* atau *.up*\n` +
                      `• *.tmpfiles*\n\n` +
                      `*Support:* Dokumen, Gambar, Video, Audio\n` +
                      `*Limit:* Max 100MB, Expired 60 menit`
            }, { quoted: m });
        }

        // Loading reaction
        await sock.sendMessage(chatId, { react: { text: '⏳', key: m.key }});

        const outputDir = path.join(__dirname, '../temp_uploads');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const fileMsg = target.documentMessage || target.imageMessage || 
                       target.videoMessage || target.audioMessage || target;
        const fileName = fileMsg.fileName || `mirror_${Date.now()}.bin`;
        const fileSize = formatSize(Number(fileMsg.fileLength || 0));

        const tempPath = path.join(outputDir, `mirror_${Date.now()}_${fileName}`);

        try {
            // Download file
            const stream = await downloadContentFromMessage(target, fileMsg.mimetype.split('/')[0]);
            let buffer = Buffer.from([]);
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            fs.writeFileSync(tempPath, buffer);

            // Check size (100MB limit)
            const stats = fs.statSync(tempPath);
            if (stats.size > 100 * 1024 * 1024) {
                fs.unlinkSync(tempPath);
                throw new Error('File terlalu besar! Max 100MB');
            }

            // Upload to tmpfiles.org
            const data = await uploadToTmpfiles(tempPath, fileName);
            const expires = Math.ceil((new Date(data.expires_at) - new Date()) / 60000);

            // Success message
            const successText = `
╭━━━ ⬣ *MIRROR SUCCESS* ⬣ ━━━╮
┃
┃ 📁 *Nama:* ${data.name}
┃ 📊 *Ukuran:* ${formatSize(data.size)}
┃ ⏰ *Expired:* ${expires} menit
┃
┃ 🔗 *Download Link:*
┃ ${data.url_full}
┃
┃ 📌 *Short URL:*
┃ ${data.url}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

✅ File berhasil di-mirror!
⚡ Download sebelum expired ya bre!
`;

            await sock.sendMessage(chatId, {
                text: successText,
                contextInfo: {
                    externalAdReply: {
                        title: "📤 File Mirror - DamarBotz",
                        body: `Uploaded by ${namaUser}`,
                        thumbnailUrl: "https://tmpfiles.org/static/favicon.png",
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        sourceUrl: data.url_full
                    }
                }
            }, { quoted: m });

            // Success reaction
            await sock.sendMessage(chatId, { react: { text: '✅', key: m.key }});

        } catch (err) {
            // Error reaction
            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key }});
            
            sock.sendMessage(chatId, {
                text: `❌ *Mirror Failed*\n\n💬 *Error:* ${err.message}\n\n` +
                      `*Tips:*\n` +
                      `• Pastikan file < 100MB\n` +
                      `• Cek koneksi internet\n` +
                      `• Coba lagi nanti`
            }, { quoted: m });
            
        } finally {
            // Cleanup
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }
};