import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// HELPER: Get extension from content-type
// ============================================================
function getExtensionFromContentType(contentType = '') {
    const mimeMap = {
        'video/mp4': '.mp4',
        'video/x-matroska': '.mkv',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'video/x-ms-wmv': '.wmv',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'audio/aac': '.aac',
        'audio/flac': '.flac',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'application/zip': '.zip',
        'application/x-rar-compressed': '.rar',
        'application/x-7z-compressed': '.7z',
        'text/plain': '.txt',
        'application/json': '.json',
    };

    const type = contentType.split(';')[0].toLowerCase().trim();
    return mimeMap[type] || '';
}

// ============================================================
// HELPER: Extract filename from content-disposition header
// ============================================================
function extractFileName(headers, serviceName = 'download') {
    const contentDisposition = headers['content-disposition'] || '';
    const contentType = headers['content-type'] || '';

    let fileName = null;

    if (contentDisposition) {
        const match1 = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
        if (match1) {
            try { fileName = decodeURIComponent(match1[1].trim()); }
            catch (e) { fileName = match1[1].trim(); }
        }

        if (!fileName) {
            const match2 = contentDisposition.match(/filename="([^"]+)"/i);
            if (match2) fileName = match2[1].trim();
        }

        if (!fileName) {
            const match3 = contentDisposition.match(/filename=([^;,\n]+)/i);
            if (match3) fileName = match3[1].trim().replace(/['"]/g, '');
        }
    }

    if (fileName && !path.extname(fileName)) {
        const ext = getExtensionFromContentType(contentType);
        if (ext) fileName += ext;
    }

    if (!fileName || fileName.length === 0) {
        const ext = getExtensionFromContentType(contentType) || '.bin';
        fileName = `${serviceName}_${Date.now()}${ext}`;
    }

    return fileName;
}

// ============================================================
// HELPER: Download stream dari WhatsApp message
// ============================================================
async function downloadWAStream(msgContent, mediaType) {
    const stream = await downloadContentFromMessage(msgContent, mediaType);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// ============================================================
// DOWNLOAD FROM GOFILE
// ============================================================
async function downloadFromGofile(url) {
    try {
        const gofileMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/);
        if (!gofileMatch) return { success: false, error: 'Invalid Gofile URL format' };

        const fileId = gofileMatch[1];

        // Method 1: Allamy scraper
        try {
            console.log(`[GOFILE] Trying allamy.me scraper for ID: ${fileId}`);
            const scraperUrl = `https://api.allamy.me/download?url=${encodeURIComponent(url)}`;
            const response = await axios.get(scraperUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.status === 200 && response.data?.length > 0) {
                return {
                    success: true,
                    buffer: Buffer.from(response.data),
                    fileName: extractFileName(response.headers, 'gofile'),
                    size: response.data.length
                };
            }
        } catch (e) {
            console.log(`[GOFILE] Allamy scraper failed: ${e.message}`);
        }

        // Method 2: Direct download
        try {
            console.log(`[GOFILE] Trying direct download...`);
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://gofile.io/'
                },
                maxRedirects: 5,
                validateStatus: () => true
            });

            if (response.status === 200 && response.data?.length > 0) {
                return {
                    success: true,
                    buffer: Buffer.from(response.data),
                    fileName: extractFileName(response.headers, `gofile_${fileId}`),
                    size: response.data.length
                };
            }
        } catch (e) {
            console.log(`[GOFILE] Direct download failed: ${e.message}`);
        }

        return { success: false, error: 'Gofile: All methods failed. File may require password or be deleted.' };
    } catch (err) {
        return { success: false, error: `Gofile: ${err.message}` };
    }
}

// ============================================================
// DOWNLOAD FROM PIXELDRAIN
// ============================================================
async function downloadFromPixeldrain(url) {
    try {
        let fileId = url.split('/u/')[1] || url.split('/').pop();
        fileId = fileId.split('?')[0];

        if (!fileId) return { success: false, error: 'Invalid Pixeldrain URL format' };

        const apiUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://pixeldrain.com/'
            },
            validateStatus: () => true
        });

        if (response.status !== 200 || !response.data?.length) {
            return { success: false, error: 'Pixeldrain: File not found or access denied' };
        }

        return {
            success: true,
            buffer: Buffer.from(response.data),
            fileName: extractFileName(response.headers, 'pixeldrain'),
            size: response.data.length
        };
    } catch (err) {
        return { success: false, error: `Pixeldrain: ${err.message}` };
    }
}

// ============================================================
// DOWNLOAD FROM BUZZHEAVIER
// ============================================================
async function downloadFromBuzzheavier(url) {
    try {
        if (!url.includes('buzzheavier.com')) return { success: false, error: 'Invalid Buzzheavier URL' };

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://buzzheavier.com/',
                'Accept': '*/*'
            },
            validateStatus: () => true,
            maxRedirects: 10
        });

        if (response.status === 404 || !response.data?.length) {
            return { success: false, error: 'Buzzheavier: File not found or deleted' };
        }

        if (response.status >= 400 && response.status < 500) {
            return { success: false, error: `Buzzheavier: Access denied (HTTP ${response.status})` };
        }

        if (response.data.length < 10000) {
            const preview = response.data.toString('utf-8', 0, Math.min(500, response.data.length));
            if (preview.toLowerCase().includes('<!doctype') || preview.toLowerCase().includes('<html')) {
                return { success: false, error: 'Buzzheavier: Server returned HTML (file may not exist)' };
            }
        }

        let fileName = extractFileName(response.headers, 'buzzheavier');
        if (!path.extname(fileName)) {
            const ext = getExtensionFromContentType(response.headers['content-type']) || '.bin';
            fileName += ext;
        }

        return {
            success: true,
            buffer: Buffer.from(response.data),
            fileName,
            size: response.data.length
        };
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            return { success: false, error: 'Buzzheavier: Download timeout (file too large or slow connection)' };
        }
        return { success: false, error: `Buzzheavier: ${err.message}` };
    }
}

// ============================================================
// MAIN COMMAND HANDLER
// ============================================================
export default {
    command: ['mirror', 'gf', 'pd', 'bh', 'gofile', 'pixeldrain', 'buzzheavier'],
    execute: async (sock, m, { sender, q, isOwner, command }) => {
        const chatId = sender;

        // ✅ FIX #1: Ambil command dari parameter 'command' yang dikasih dispatcher,
        // bukan parse ulang dari pesan. Fallback ke parse manual kalau dispatcher
        // belum kasih parameter 'command'.
        let cmd = (command || '').toLowerCase().replace(/^\./, '');

        if (!cmd) {
            // Fallback: parse dari teks pesan langsung
            const rawText =
                m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                m.message?.imageMessage?.caption ||
                m.message?.videoMessage?.caption ||
                m.message?.documentMessage?.caption || '';

            cmd = rawText.trim().split(/\s+/)[0].toLowerCase().replace(/^\./, '');
        }

        // ============================================================
        // MIRROR: Re-upload file ke chat WA
        // ============================================================
        if (cmd === 'mirror') {
            try {
                let fileBuffer, fileName, fileSize;

                // ✅ FIX #2: Cek quoted message (user reply ke file)
                const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const directMsgType = Object.keys(m.message)[0];

                const MEDIA_TYPES = ['documentMessage', 'videoMessage', 'audioMessage', 'imageMessage'];

                if (quotedMsg) {
                    // User reply ke file orang lain
                    const quotedType = Object.keys(quotedMsg).find(k => MEDIA_TYPES.includes(k));

                    if (!quotedType) {
                        return sock.sendMessage(chatId, {
                            text: '❌ Reply ke file dong (dokumen, video, audio, atau gambar)!'
                        }, { quoted: m });
                    }

                    const mediaType = quotedType.replace('Message', ''); // 'document', 'video', dll
                    fileBuffer = await downloadWAStream(quotedMsg[quotedType], mediaType);
                    fileName = quotedMsg[quotedType].fileName || `mirror_${Date.now()}`;
                    fileSize = fileBuffer.length;

                } else if (MEDIA_TYPES.includes(directMsgType)) {
                    // User kirim file langsung bareng command
                    const mediaType = directMsgType.replace('Message', '');
                    fileBuffer = await downloadWAStream(m.message[directMsgType], mediaType);
                    fileName = m.message[directMsgType].fileName || `mirror_${Date.now()}`;
                    fileSize = fileBuffer.length;

                } else {
                    return sock.sendMessage(chatId, {
                        text: '❌ Cara pakai:\n• Reply ke file lalu ketik `.mirror`\n• Atau kirim file sambil tulis `.mirror` di caption'
                    }, { quoted: m });
                }

                // Kirim balik ke chat
                await sock.sendMessage(chatId, {
                    document: fileBuffer,
                    mimetype: 'application/octet-stream',
                    fileName: fileName
                }, { quoted: m });

                await sock.sendMessage(chatId, {
                    text: `✅ *Mirror berhasil!*\n📁 ${fileName.slice(0, 40)}${fileName.length > 40 ? '...' : ''}\n💾 ${(fileSize / 1024 / 1024).toFixed(2)} MB`
                }, { quoted: m });

            } catch (error) {
                console.error('[MIRROR] Error:', error);
                await sock.sendMessage(chatId, {
                    text: `❌ Mirror gagal!\n\n*Error:* ${error.message}`
                }, { quoted: m });
            }
        }

        // ============================================================
        // DOWNLOAD COMMANDS: gf, pd, bh
        // ============================================================
        else if (['gf', 'gofile', 'pd', 'pixeldrain', 'bh', 'buzzheavier'].includes(cmd)) {
            // ✅ FIX #3: Validasi URL lebih ketat
            const urlMatch = (q || '').match(/(https?:\/\/[^\s]+)/i);
            if (!urlMatch) {
                return sock.sendMessage(chatId, {
                    text: `❌ Kasih URL yang valid!\n\n*Contoh:* \`.${cmd} https://...\``
                }, { quoted: m });
            }

            const url = urlMatch[0];

            try {
                await sock.sendMessage(chatId, {
                    text: `⏳ Downloading dari *${cmd.toUpperCase()}*...\n🔗 ${url.slice(0, 50)}${url.length > 50 ? '...' : ''}`
                }, { quoted: m });

                let result;
                if (['gf', 'gofile'].includes(cmd)) {
                    result = await downloadFromGofile(url);
                } else if (['pd', 'pixeldrain'].includes(cmd)) {
                    result = await downloadFromPixeldrain(url);
                } else if (['bh', 'buzzheavier'].includes(cmd)) {
                    result = await downloadFromBuzzheavier(url);
                }

                if (result?.success) {
                    await sock.sendMessage(chatId, {
                        document: result.buffer,
                        mimetype: 'application/octet-stream',
                        fileName: result.fileName
                    }, { quoted: m });

                    await sock.sendMessage(chatId, {
                        text: `✅ *Download berhasil dari ${cmd.toUpperCase()}!*\n📁 ${result.fileName.slice(0, 40)}\n💾 ${(result.size / 1024 / 1024).toFixed(2)} MB`
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `❌ *Download gagal!*\n\n${result?.error || 'Unknown error'}`
                    }, { quoted: m });
                }

            } catch (error) {
                console.error(`[${cmd.toUpperCase()}] Error:`, error);
                await sock.sendMessage(chatId, {
                    text: `❌ Error tidak terduga!\n\n*Error:* ${error.message}`
                }, { quoted: m });
            }
        }

        // ============================================================
        // Command tidak dikenali
        // ============================================================
        else {
            await sock.sendMessage(chatId, {
                text: `❓ Command tidak dikenali: \`${cmd}\``
            }, { quoted: m });
        }
    }
};